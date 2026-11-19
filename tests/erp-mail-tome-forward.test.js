'use strict';
/* 내게쓴편지함(tome)도 계약서·견적서 자동 길이 «앞으로 들어오는 것만» 훑는다 (대표 지시 2026-11-18)
 *   「푸른메일이나 내게쓴메일함에도 계약서 등이 있으면 같이 찾아 이알피에 등록 — 현재 메일함을 바로 작업하지 말고 앞으로 진행」
 * ⚠ 이 저장소는 github.io 로 공개된다 — 회사·사람은 전부 지어낸 것이다.
 *
 * ■ 못 박는 규칙 (값이 아니라 «규칙»)
 *   ① 내게쓴편지함의 «새 메일»(기준일 이후)은 보낸 메일처럼 다뤄 견적서는 상담접수, 계약서는 계약협의 요청이 된다.
 *   ② 기준일 «이전» 메일은 어떤 요청도 만들지 않는다 — 지금 들어 있는 옛 메일을 건드리지 않는다.
 *   ③ 임시보관함·예약편지함·보관함·휴지통은 훑지 않는다(보내지 않은 것·치운 것). 받은·보낸·사용자 폴더는 그대로다.
 *   ④ 요청 메모는 «내게쓴편지함에서 올림»이라고 밝힌다 — 사람이 어디서 온 것인지 알아야 한다.
 * 소스 글자가 아니라 함수를 떠서 «돌려» 본다(STATUS.md 「되풀이된 실수」 ②). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn.js');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');
const out = (v) => JSON.parse(JSON.stringify(v));
const USERS = [{ sid: 'P-005', name: '담당가' }];
const AT = (iso) => Date.parse(iso);
const OLD = AT('2026-11-17T23:00:00+09:00');   // 기준일(2026-11-18 0시) 바로 전
const NEW = AT('2026-11-18T09:00:00+09:00');   // 기준일 뒤

function lib() {
  const writes = {};
  const ctx = { console, Date, Object, Array, String, Number, JSON, Math, Promise, RegExp, Error, parseInt, parseFloat, setTimeout };
  ctx.window = ctx; ctx.global = ctx;
  vm.createContext(ctx);
  ['pu-doc-read.js', 'pu-quote-detect.js', 'pu-doc-file.js'].forEach((f) => vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), ctx));
  return { ctx, writes, P: ctx.PuDocFile };
}
const CONTRACT = (u, d, co) => ({ u, d, t: 'office@self.example', s: '[푸른노무법인] ' + co + ' 컨설팅 위임계약서 송부', a: 1, an: ['위임계약서_' + co + '.pdf'] });
const QUOTE = (u, d, co) => ({ u, d, t: 'office@self.example', s: '[푸른노무법인] ' + co + ' 컨설팅 견적서 송부', a: 1, an: ['견적서_' + co + '.pdf'] });

function synth(kind, msgs) {
  const { P } = lib();
  return P.synthesizeMailLifecycle([{ slug: 'F1', kind, msgs }], { companies: {}, contracts: {}, sinceMs: 0 });
}

test('① 내게쓴편지함의 새 메일은 보낸 메일처럼 읽힌다 — 계약서는 계약협의(review) · 견적서는 상담접수(consult), 체결본으로 올리지 않는다', () => {
  const c = synth('tome', { '1': CONTRACT('1', NEW, '하늘수산') });
  assert.ok(c.groups['하늘수산'], '새 계약서 메일이 후보가 된다');
  assert.equal(c.groups['하늘수산'].targetStage, 'review', '계약서는 계약협의까지만(확정은 사람)');
  assert.equal(c.groups['하늘수산'].hasSigned, false);
  assert.notEqual(c.groups['하늘수산'].senderVerified, false, '우리 자신이 보낸 것이라 미검증으로 격리하지 않는다');
  const q = synth('tome', { '2': QUOTE('2', NEW, '바람수산') });
  assert.equal(q.groups['바람수산'].targetStage, 'consult', '견적서는 상담접수');
  /* 대조 — 같은 메일을 «보낸메일함»에 두었을 때와 같은 결과 */
  const asSent = synth('sent', { '1': CONTRACT('1', NEW, '하늘수산') });
  assert.equal(c.groups['하늘수산'].targetStage, asSent.groups['하늘수산'].targetStage);
});

test('② 기준일 이전 메일은 어떤 후보도 만들지 않는다 — 지금 들어 있는 옛 메일을 건드리지 않는다', () => {
  const r = synth('tome', { '1': CONTRACT('1', OLD, '옛수산'), '2': QUOTE('2', OLD, '옛바다') });
  assert.equal(r.groups['옛수산'], undefined);
  assert.equal(r.groups['옛바다'], undefined);
  assert.deepEqual(out(Object.keys(r.bySrcKey)), []);
  /* 기준일은 «내게쓴편지함에만» 걸린다 — 같은 옛 메일이 보낸메일함에 있으면 예전처럼 읽힌다 */
  const sent = synth('sent', { '1': CONTRACT('1', OLD, '옛수산') });
  assert.ok(sent.groups['옛수산'], '보낸메일함의 범위는 그대로다');
});

/* ─── pullMailContracts — 어느 폴더를 훑는가 ─── */
async function pull(folders, msgsBySlug, companies) {
  const { ctx, writes, P } = lib();
  const reads = [];   // 메일을 «읽으러 간» 폴더 — 어느 폴더를 훑었는지의 증거
  ctx.firebase = { auth: () => ({ currentUser: { uid: 'u1', getIdToken: () => Promise.resolve('tok-1') } }) };
  ctx.PuDocPick = { 계약서인가: () => true, 이름갈래: () => '계약서' };
  ctx.atob = (s) => Buffer.from(s, 'base64').toString('binary');
  ctx.Uint8Array = Uint8Array; ctx.Blob = Blob;
  ctx.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, atts: [{ name: '위임계약서.pdf', part: '2' }], b64: 'dGVzdA==', name: '위임계약서.pdf' }) });
  P.init({
    db: {
      ref: (p) => ({
        limitToLast: () => ({ once: () => { reads.push(String(p).replace('mailbox/msgs/', '')); return Promise.resolve({ val: () => msgsBySlug[String(p).replace('mailbox/msgs/', '')] || {} }); } }),
        once: () => Promise.resolve({
          val: () => {
            if (p === 'mailbox/folders') return folders;
            if (p.indexOf('user_dir') >= 0) return { v: USERS };
            if (p.indexOf('companies') >= 0) return { v: companies || {} };
            if (p.indexOf('contracts') >= 0) return { v: {} };
            return {};
          }
        }),
        set: (v) => { writes[p] = v; return Promise.resolve(); },
        update: (v) => { Object.assign(writes, v || {}); return Promise.resolve(); }
      })
    }
  });
  const res = await P.pullMailContracts({ maxPull: 20 });
  return { res, writes, reads };
}
const MQ = (slug, uid) => 'data/contract_requests/mq-' + slug + '_' + uid;

test('① 내게쓴편지함의 새 계약서 메일이 계약협의 요청이 된다 — 폴더 종류가 tome 일 때', async () => {
  const { writes, reads } = await pull({ TOME1: { kind: 'tome' } }, { TOME1: { '401': CONTRACT('401', Date.now(), '하늘수산') } });
  assert.deepEqual(out(reads), ['TOME1'], '내게쓴편지함을 읽으러 간다');
  const w = writes[MQ('TOME1', '401')];
  assert.ok(w, '요청이 만들어진다');
  assert.equal(w.kind, 'advance');
  assert.equal(w.allowCreateReview, true, '계약서는 계약협의 카드까지');
  assert.equal(w.folderKind, 'tome');
  assert.equal(w.companyName, '하늘수산');
  assert.equal(w.managerMain, 'P-005');
});

test('② 기준일 이전 내게쓴편지함 메일은 요청을 만들지 않는다 — 같은 폴더의 새 메일만', async () => {
  const msgs = { TOME1: { '402': CONTRACT('402', OLD, '옛수산'), '403': CONTRACT('403', Date.now(), '새수산') } };
  const { writes } = await pull({ TOME1: { kind: 'tome' } }, msgs);
  assert.equal(writes[MQ('TOME1', '402')], undefined, '옛 메일 → 요청 없음');
  assert.ok(writes[MQ('TOME1', '403')], '새 메일 → 요청');
});

test('③ 임시보관함·예약편지함·보관함·휴지통은 훑지 않는다 · 보낸메일함은 예전 그대로', async () => {
  const folders = { SENT1: { kind: 'sent' }, DRAFT1: { kind: 'drafts' }, SCHED1: { kind: 'sched' }, ARCH1: { kind: 'archive' }, TRASH1: { kind: 'trash' } };
  const msgs = {};
  Object.keys(folders).forEach((s, i) => { msgs[s] = { [String(500 + i)]: CONTRACT(String(500 + i), Date.now(), '회색수산' + i) }; });
  const { writes, reads } = await pull(folders, msgs);
  assert.deepEqual(out(reads), ['SENT1'], '훑은 폴더는 보낸메일함뿐 — 임시보관·예약·보관·휴지통은 읽으러 가지도 않는다');
  assert.ok(writes[MQ('SENT1', '500')], '보낸메일함은 그대로');
  ['DRAFT1', 'SCHED1', 'ARCH1', 'TRASH1'].forEach((s, i) => assert.equal(writes[MQ(s, String(501 + i))], undefined, s + ' 은 훑지 않는다'));
});

/* ─── ④ 메모 ─── */
test('④ 요청 메모는 어느 폴더에서 왔는지 밝힌다 — 내게쓴편지함이면 «내게쓴편지함에서 올림»', () => {
  const ctx = { console, Date, Object, Array, String, Number, JSON, Math };
  vm.createContext(ctx);
  vm.runInContext(['function erpQuoteDay(', 'function erpQuoteNote('].map((d) => cutFn(SRC, d)).join('\n') + '\nthis.note=erpQuoteNote;', ctx);
  const base = { kind: 'advance', docKind: 'contract', at: NEW, subject: '계약서 송부', atts: ['위임계약서.pdf'] };
  assert.match(ctx.note(Object.assign({ folderKind: 'tome' }, base)), /내게쓴편지함에서 올림/);
  assert.match(ctx.note(base), /보낸메일함에서 올림/, '폴더 정보가 없으면 예전 문구 그대로');
  assert.match(ctx.note(Object.assign({ folderKind: 'sent' }, base)), /보낸메일함에서 올림/);
});

test('⑤ 내게쓴편지함은 «받는 주소(우리 자신)»로 업체를 맞추지 않는다 — 제목·첨부 이름만 쓴다 · 보낸메일함은 주소로 맞춘다(대조)', async () => {
  const COS = { coRev: { id: 'coRev', name: '부활기업', status: 'active', email: 'hr@revive.example', managerMain: 'P-005' } };
  const mail = (u) => ({ u, d: Date.now(), t: 'hr@revive.example', s: '[푸른노무법인] 하늘수산 컨설팅 위임계약서 송부', a: 1, an: ['위임계약서_하늘수산.pdf'] });
  const tome = await pull({ TOME1: { kind: 'tome' } }, { TOME1: { '601': mail('601') } }, COS);
  const wt = tome.writes[MQ('TOME1', '601')];
  assert.ok(wt, '요청은 만들어진다');
  assert.equal(wt.companyId, '', '받는 주소가 우연히 어느 업체 이메일과 같아도 그 업체로 잇지 않는다');
  assert.equal(wt.companyName, '하늘수산', '업체 이름은 제목에서 읽는다');
  const sent = await pull({ SENT1: { kind: 'sent' } }, { SENT1: { '602': mail('602') } }, COS);
  assert.equal(sent.writes[MQ('SENT1', '602')].companyId, 'coRev', '대조 — 보낸메일함은 받는 주소로 업체를 맞춘다(예전 그대로)');
});
