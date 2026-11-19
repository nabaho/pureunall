'use strict';
/* 휴지통에 보낸 계약이 «같은 메일로 되살아나지» 않는다 (대표 지시 2026-11-18 「코드 고치기」)
 * ⚠ 이 저장소는 github.io 로 공개된다 — 회사·사람은 전부 지어낸 것이다.
 *
 * ■ 못 박는 규칙 (값이 아니라 «규칙»)
 *   ① 휴지통(_deleted)에 보낸 계약이 들고 있던 메일(srcMails)은 «사람이 처리해 치운 메일»이다 —
 *      자동 길(메일 종합 분석 · 메일 가져오기 · 견적 길 · 사진첩 계약 길)이 그 메일로 새 카드를 만들지 않는다.
 *   ② 카드를 되살리면(_deleted 가 지워지면) 그 메일은 다시 «살아 있는 카드의 메일»로 센다(저절로).
 *   ③ 지운 카드의 메일과 «새 메일»이 섞여 있으면 새 메일만 새 카드가 된다 — 새 메일을 막지 않는다.
 *   ④ 지운 카드가 없으면 예전 그대로 만든다(거르개가 넓어지지 않았다는 대조).
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

function lib(extra) {
  const writes = {};
  const ctx = { console, Date, Object, Array, String, Number, JSON, Math, Promise, RegExp, Error, parseInt, parseFloat, setTimeout };
  ctx.window = ctx; ctx.global = ctx;
  vm.createContext(ctx);
  ['pu-doc-read.js', 'pu-quote-detect.js', 'pu-doc-file.js'].forEach((f) => vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), ctx));
  return { ctx, writes, P: ctx.PuDocFile };
}
const day = (s) => Date.parse(s + 'T10:00:00+09:00');
const CONTRACT_SENT = { u: '301', d: day('2026-11-10'), t: 'hr@revive.example', s: '[푸른노무법인] 부활기업 컨설팅 위임계약서 송부', a: 1, an: ['위임계약서_부활기업.pdf'] };
const CO = { coRev: { id: 'coRev', name: '부활기업', status: 'active', email: 'hr@revive.example', managerMain: 'P-005' } };
const card = (o) => Object.assign({ id: 'ct-x', contractNo: '계약-2026-300', companyId: 'coRev', companyName: '부활기업', status: 'review', kinds: ['consulting'], srcMails: ['Sent|301'] }, o || {});

/* ─── ① 메일 종합 분석(synthesizeMailLifecycle) ─── */
function synth(contracts, extraMsgs) {
  const { P } = lib();
  const msgs = Object.assign({ '301': CONTRACT_SENT }, extraMsgs || {});
  return P.synthesizeMailLifecycle([{ slug: 'Sent', kind: 'sent', msgs }], { companies: CO, contracts, sinceMs: 0 });
}

test('① 휴지통에 보낸 카드의 메일은 «이미 처리함» — 종합 분석이 같은 메일로 새 카드 후보를 만들지 않는다', () => {
  const r = synth({ ct1: card({ _deleted: true }) });
  assert.equal(r.groups['부활기업'].excluded, 'duplicate');
  assert.equal(r.bySrcKey['Sent|301'].isDuplicateInErp, true);
  assert.equal(r.bySrcKey['Sent|301'].excluded, 'duplicate');
});

test('② 대조 — 살아 있는 카드가 같은 메일을 가졌을 때와 «지운 카드»일 때 결과가 같다 · 카드가 없으면 후보가 된다', () => {
  const live = synth({ ct1: card() });
  const dead = synth({ ct1: card({ _deleted: true }) });
  assert.equal(live.groups['부활기업'].excluded, dead.groups['부활기업'].excluded, '지운 카드도 살아 있는 카드와 같이 센다');
  const none = synth({});
  assert.equal(none.groups['부활기업'].excluded, '', '카드가 없으면 예전 그대로 후보다');
  assert.deepEqual(out(none.groups['부활기업'].srcMails), ['Sent|301']);
});

test('③ 지운 카드의 메일과 «새 메일»이 섞이면 새 메일만 후보가 된다', () => {
  const NEW = { u: '302', d: day('2026-11-14'), t: 'hr@revive.example', s: '[푸른노무법인] 부활기업 컨설팅 위임계약서 재송부', a: 1, an: ['위임계약서_부활기업_재.pdf'] };
  const r = synth({ ct1: card({ _deleted: true }) }, { '302': NEW });
  assert.equal(r.groups['부활기업'].excluded, '', '새 메일이 있으니 막지 않는다');
  assert.deepEqual(out(r.groups['부활기업'].srcMails), ['Sent|302'], '지운 카드가 들고 있던 메일은 빠지고 새 메일만 남는다');
  assert.equal(r.bySrcKey['Sent|301'].isDuplicateInErp, true, '옛 메일 하나는 계속 처리한 것으로 센다');
  assert.notEqual(r.bySrcKey['Sent|302'].isDuplicateInErp, true);
});

test('② 카드를 되살리면(_deleted 가 지워지면) 그 메일은 다시 살아 있는 카드의 메일로 센다', () => {
  const restored = card({ _restoredAt: '2026-11-18T00:00:00Z' });
  assert.equal(restored._deleted, undefined);
  const r = synth({ ct1: restored });
  assert.equal(r.groups['부활기업'].excluded, 'duplicate', '살아 있는 카드가 가진 메일이다');
});

/* ─── ① 메일 가져오기(pullMailContracts) ─── */
async function pull(contractsV, sentMsgs) {
  const { ctx, writes, P } = lib();
  ctx.firebase = { auth: () => ({ currentUser: { uid: 'u1', getIdToken: () => Promise.resolve('tok-1') } }) };
  ctx.PuDocPick = { 계약서인가: () => true, 이름갈래: () => '계약서' };
  ctx.atob = (s) => Buffer.from(s, 'base64').toString('binary');
  ctx.Uint8Array = Uint8Array; ctx.Blob = Blob;
  ctx.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, atts: [{ name: '위임계약서.pdf', part: '2' }], b64: 'dGVzdA==', name: '위임계약서.pdf' }) });
  P.init({
    db: {
      ref: (p) => ({
        limitToLast: () => ({ once: () => Promise.resolve({ val: () => (p === 'mailbox/msgs/Sent' ? (sentMsgs || { '301': Object.assign({}, CONTRACT_SENT, { d: Date.now() }) }) : {}) }) }),
        once: () => Promise.resolve({
          val: () => {
            if (p === 'mailbox/folders') return { Sent: { kind: 'sent' } };
            if (p.indexOf('companies') >= 0) return { v: CO };
            if (p.indexOf('user_dir') >= 0) return { v: USERS };
            if (p.indexOf('contracts') >= 0 && p.indexOf('contract_requests') < 0) return { v: contractsV };
            return {};
          }
        }),
        set: (v) => { writes[p] = v; return Promise.resolve(); },
        update: (v) => { Object.assign(writes, v || {}); return Promise.resolve(); }
      })
    }
  });
  const res = await P.pullMailContracts({ maxPull: 10 });
  return { res, writes };
}
/* 그 메일(Sent|301)에서 나온 요청 열쇠 — main 은 계약서 첨부를 당기는 요청을 mp-…, 견적·계약 요청을 mq-… 로 쓴다(어느 쪽이든 «그 메일»이면 센다) */
const reqKeysOf = (writes) => Object.keys(writes).filter((k) => k.indexOf('data/contract_requests/') === 0 && k.indexOf('Sent_301') >= 0);

test('① 메일 가져오기도 지운 카드의 메일로 견적·계약 요청을 만들지 않고 첨부를 당겨 오지 않는다', async () => {
  const { res, writes } = await pull({ ct1: card({ _deleted: true }) });
  assert.deepEqual(reqKeysOf(writes), [], '지운 카드의 메일 → 요청 없음');
  assert.deepEqual(out(res.pulled), [], '지운 카드의 메일 → 첨부를 당겨 오지 않는다');
});

test('④ 대조 — 카드가 없으면 같은 메일에서 요청이 만들어지고 첨부를 당겨 온다', async () => {
  const { res, writes } = await pull({});
  assert.equal(reqKeysOf(writes).length, 1, '요청이 만들어진다');
  assert.equal(res.pulled.length, 1);
});

/* ─── ① 이알피 쪽 소비자(견적 길 계획 · 사진첩 계약 길) ─── */
const PLAN_FNS = ['function erpQuoteDay(', 'function erpQuoteNote(', 'function erpCoAddrKey(', 'function erpSameCompany(', 'function erpBlankContractForm(', 'function erpQuoteLanePlan('];
const STAGE_FNS = ['function erpStageMarksMerge(', 'function erpStagePartsFromContract(', 'function erpStagePartsFromQuote('];
const PuCaseStage = require('../js/pu-case-stage.js');
function planner() {
  const ctx = { console, Date, Object, Array, String, Number, JSON, Math, todayYMD: () => '2026-11-18', window: { PuCaseStage } };
  vm.createContext(ctx);
  vm.runInContext(PLAN_FNS.concat(STAGE_FNS).map((d) => cutFn(SRC, d)).join('\n') + '\nthis.fn=erpQuoteLanePlan;', ctx);
  return ctx.fn;
}
const plan = planner();
const COREC = { id: 'coRev', name: '부활기업', bizNo: '1234567890', managerMain: 'P-005' };
const QREQ = (o) => Object.assign({ kind: 'advance', docKind: 'contract', allowCreateReview: true, state: 'pending', srcKey: 'Sent|301', srcMails: ['Sent|301'],
  subject: '[푸른노무법인] 부활기업 컨설팅 위임계약서 송부', atts: ['위임계약서.pdf'], to: ['hr@revive.example'], at: Date.parse('2026-11-10T10:00:00+09:00'),
  companyId: 'coRev', managerMain: 'P-005', by: 'server' }, o || {});

test('① 견적 길 계획 — 지운 카드의 메일이면 noop, 되살리면 살아 있는 카드로 센다', () => {
  assert.equal(plan(QREQ(), [COREC], [card({ _deleted: true })], USERS).action, 'noop');
  assert.match(plan(QREQ(), [COREC], [card({ _deleted: true })], USERS).why, /지운/);
  assert.equal(plan(QREQ(), [COREC], [card()], USERS).action, 'noop', '살아 있는 카드(이미 반영)와 같은 결과');
});

test('③④ 견적 길 계획 — 새 메일이 섞이면 막지 않고 · 카드가 없으면 만든다', () => {
  const mixed = plan(QREQ({ srcMails: ['Sent|301', 'Sent|302'], srcKey: 'Sent|302' }), [COREC], [card({ _deleted: true })], USERS);
  assert.notEqual(mixed.action, 'noop', '새 메일(Sent|302)이 있으면 막지 않는다');
  assert.equal(plan(QREQ(), [COREC], [], USERS).action, 'create', '카드가 없으면 예전 그대로');
});

function photoLane(contracts) {
  const calls = { persist: [], remove: 0 };
  const FN = [
    'function erpParseContractMoney(', 'function erpParseSuccessFee(', 'function erpGuessContractFromFields(',
    'function erpTypeNameTidy(', 'function erpNameRun(', 'function erpConsTypeByDocName(',
    'function erpVatTextToFlag(', 'function erpDocText(', 'function erpCmsFromDoc(',
    'function erpBlankContractForm(', 'function erpSameCompany(', 'function erpCoAddrKey(',
    'function erpCoNameKey(', 'function erpBiznoClash(', 'async function processPhotoContractRequest('
  ].map((d) => cutFn(SRC, d)).join('\n') + '\n' + STAGE_FNS.map((d) => cutFn(SRC, d)).join('\n');
  const ctx = {
    console, Date, Object, Array, String, Number, JSON, Math, Promise, parseInt, parseFloat,
    ERP_CMS_WORDS: ['CMS', '자동이체'], todayYMD: () => '2026-11-18',
    fbDb: { ref: () => ({ remove: () => { calls.remove++; return Promise.resolve(); }, update: () => Promise.resolve() }) },
    dbGet: (k, d) => (k === 'companies' ? [Object.assign({}, COREC, { name: '부활기업' })] : k === 'contracts' ? contracts : d),
    getActiveUsers: () => USERS, getKindTypes: () => [],
    erpDeferCoLinkIfNew: (f) => (f.companyId ? f : Object.assign({}, f, { companyLinkStatus: 'pending', companyId: '' })),
    isContractLocked: () => false, genContractNo: () => '계약-2026-301',
    persistOne: (o) => { calls.persist.push(o); return true; }
  };
  ctx.window = ctx; ctx.global = ctx; ctx.setTimeout = setTimeout; ctx.PuCaseStage = PuCaseStage;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'pu-doc-read.js'), 'utf8'), ctx);
  vm.runInContext(FN + '\nthis.run=processPhotoContractRequest;', ctx);
  return { run: ctx.run, calls };
}
const PREQ = (o) => Object.assign({
  source: 'photo_contract', state: 'pending', targetStatus: 'review', managerMain: 'P-005',
  company: { name: '부활기업', bizNo: '' }, srcMails: ['Sent|301'],
  contractFields: { docName: '자문계약서', scope: '인사노무 상시자문', retainer: '220만원' },
  srcPhoto: { id: 'ph-1', year: 2026, owner: 'u1', kind: 'contract', name: '자문계약서' }
}, o || {});

test('① 사진첩 계약 길 — 지운 카드의 메일·사진이면 요청만 지우고 카드를 만들지 않는다', async () => {
  const byMail = photoLane([card({ _deleted: true, srcPhoto: { id: 'other' } })]);
  const r1 = await byMail.run('k1', PREQ());
  assert.ok(r1.noop, JSON.stringify(r1));
  assert.equal(byMail.calls.persist.length, 0);
  assert.equal(byMail.calls.remove, 1, '요청은 치운다(계속 쌓이지 않게)');
  const byPhoto = photoLane([card({ _deleted: true, srcMails: [], srcPhoto: { id: 'ph-1' } })]);
  const r2 = await byPhoto.run('k2', PREQ({ srcMails: [] }));
  assert.ok(r2.noop, '같은 사진으로 지운 카드가 있으면 다시 만들지 않는다');
  assert.equal(byPhoto.calls.persist.length, 0);
});

test('④ 사진첩 계약 길 대조 — 지운 카드가 없으면 카드를 만든다 · 메일이 달라도 만든다', async () => {
  const none = photoLane([]);
  const r = await none.run('k3', PREQ());
  assert.ok(r.made, '지운 카드가 없으면 예전 그대로 만든다');
  const other = photoLane([card({ _deleted: true, srcMails: ['Sent|999'], srcPhoto: { id: 'zzz' } })]);
  const r2 = await other.run('k4', PREQ());
  assert.ok(r2.made, '다른 메일·다른 사진의 지운 카드는 막지 않는다');
});

test('① 종합 분석이 «계약 이벤트»로 안 보는 메일도(계약서로 판정돼 첨부를 당겨 올 메일) 지운 카드가 가졌으면 다시 당겨 오지 않는다', async () => {
  /* 제목·첨부 이름에 계약서 낱말이 없어 종합 분석은 이벤트로 안 세지만, 판독 쪽(PuDocPick)이 계약서로 보는 메일 */
  const odd = { '303': { u: '303', d: Date.now(), t: 'hr@revive.example', s: '[푸른노무법인] 부활기업 서류 송부', a: 1, an: ['서류.pdf'] } };
  const control = await pull({}, odd);
  assert.equal(control.res.pulled.length, 1, '대조 — 지운 카드가 없으면 당겨 온다');
  const dead = await pull({ ct1: card({ _deleted: true, srcMails: ['Sent|303'] }) }, odd);
  assert.deepEqual(out(dead.res.pulled), [], '지운 카드가 가진 메일이면 당겨 오지 않는다');
});

/* ─── ⑤ 열쇠 «꼴»이 달라도 막는다 — 콜론 꼴·객체 꼴·폴더 별칭(main 의 normSrcMailKey·canonSrcMailKey 재사용) ─── */
const SHAPES = [
  ['콜론 꼴', 'Sent:301'],
  ['객체 꼴', { folder: 'Sent', msgId: '301' }],
  ['폴더 별칭(전체 이름+해시)', 'Sent Messages-6d8c6b35|301'],
  ['한글 폴더 이름', '보낸메일함|301']
];

test('⑤ 메일 종합 분석 — 지운 카드의 srcMails 가 콜론·객체·별칭 꼴이어도 같은 메일로 새 후보를 만들지 않는다', () => {
  SHAPES.forEach(([name, shape]) => {
    const r = synth({ ct1: card({ _deleted: true, srcMails: [shape] }) });
    assert.equal(r.groups['부활기업'].excluded, 'duplicate', name + ' — 지운 카드의 메일로 센다');
  });
  assert.equal(synth({ ct1: card({ _deleted: true, srcMails: ['Sent:999'] }) }).groups['부활기업'].excluded, '', '다른 메일 번호면 막지 않는다(대조)');
});

test('⑤ 견적 길 계획 — 지운 카드의 srcMails 꼴이 달라도 noop · 다른 메일이면 막지 않는다', () => {
  SHAPES.forEach(([name, shape]) => {
    assert.equal(plan(QREQ(), [COREC], [card({ _deleted: true, srcMails: [shape] })], USERS).action, 'noop', name);
  });
  assert.notEqual(plan(QREQ(), [COREC], [card({ _deleted: true, srcMails: ['Sent:999'] })], USERS).action, 'noop');
});

test('⑤ 사진첩 계약 길 — 지운 카드의 srcMails 꼴이 달라도 요청만 지우고 카드를 안 만든다', async () => {
  for (const [name, shape] of SHAPES) {
    const lane = photoLane([card({ _deleted: true, srcMails: [shape], srcPhoto: { id: 'other' } })]);
    const r = await lane.run('k-shape', PREQ());
    assert.ok(r.noop, name + ' — ' + JSON.stringify(r));
    assert.equal(lane.calls.persist.length, 0, name);
  }
});

test('⑤ 메일 가져오기 — 지운 카드의 srcMails 가 콜론 꼴이어도 첨부를 다시 당겨 오지 않는다', async () => {
  const odd = { '303': { u: '303', d: Date.now(), t: 'hr@revive.example', s: '[푸른노무법인] 부활기업 서류 송부', a: 1, an: ['서류.pdf'] } };
  const dead = await pull({ ct1: card({ _deleted: true, srcMails: ['Sent:303'] }) }, odd);
  assert.deepEqual(out(dead.res.pulled), [], '콜론 꼴 열쇠도 같은 메일로 센다');
});
