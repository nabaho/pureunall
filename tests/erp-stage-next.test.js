'use strict';
/* ↪ «후속 계약 후보» — 확인한 단계의 다음 단계를 제안만 한다 (대표 승인 2026-11-15 「D 만들기」, 계획 5 단계 D)
 * 계획: docs/superpowers/plans/2026-11-15-quote-auto-plan5-case-stage-marks.md §4-4
 * ⚠ 이 저장소는 공개다 — 업체·사람·문구는 전부 지어낸 것이다.
 * 실행: node --test tests/erp-stage-next.test.js
 *
 * ■ 못 박는 것 — 깨지면 «자동으로 만든 계약»이나 «겹쳐 잡힌 금액»이 조용히 생긴다
 *   ① 후보는 «사람이 ☑ 한» 단계의 다음 단계에서만, 계약확정 뒤에만 나온다(읽기만 한 단계·상담접수·협의·취소는 안 냄).
 *   ② 눌러도 계약은 «만들어지지 않는다» — 씨앗을 세션에 넣고 창만 닫는다(저장은 새 계약 창에서 사람이).
 *   ③ 씨앗에는 금액·기간이 없다 — 단계마다 새 계약이라 금액은 사람이 새로 넣는다.
 *   ④ 이미 만든 후속 계약이 있으면 단추 대신 «있음», ✕ 한 단계·이 유형에서 못 고르는 단계는 안 낸다.
 * 소스 글자가 아니라 함수를 떠서 «돌려» 본다(STATUS.md 「되풀이된 실수」 ②). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn.js');
const PuCaseStage = require('../js/pu-case-stage.js');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');
const CSS = fs.readFileSync(path.join(__dirname, '..', 'css', 'pu-erp.css'), 'utf8').replace(/\r\n/g, '\n');

function cutVar(src, name) {
  const i = src.indexOf('\nvar ' + name + ' =');
  assert.ok(i >= 0, 'var 을 못 찾음: ' + name);
  let j = i + 1, depth = 0;
  for (; j < src.length; j++) {
    const ch = src[j];
    if ('[{('.includes(ch)) depth++;
    else if (']})'.includes(ch)) depth--;
    else if (ch === ';' && depth === 0) break;
  }
  return src.slice(i + 1, j + 1);
}
function h(tag, props, ...kids) { return { tag, props: props || {}, kids: kids.flat(Infinity).filter((k) => k !== false && k != null) }; }
function text(n) { return typeof n === 'object' ? n.kids.map(text).join('') : String(n); }
function find(n, pred, out = []) { if (n && typeof n === 'object') { if (pred(n)) out.push(n); n.kids.forEach((k) => find(k, pred, out)); } return out; }

const CODE = ['function erpStageNextCandidates(', 'function erpContractFollowupSeed(', 'function erpStageGoFollowup(', 'function erpStageNextRow(',
  'function caseNextStageCode(', 'function erpTakeContractSeed('].map((d) => cutFn(SRC, d)).join('\n')
  + '\n' + cutVar(SRC, 'ERP_CT_SEED_KEY') + '\n' + cutVar(SRC, 'ERP_CT_SEED_TTL');

function env(o) {
  const x = o || {};
  const store = new Map();
  const toasts = [];
  const sessionStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    removeItem: (k) => { store.delete(k); },
    setItem: (k, v) => { if (x.storageThrows) throw new Error('저장 막힘'); store.set(k, String(v)); },
  };
  const ctx = { window: x.noModule ? {} : { PuCaseStage }, h, Date, Object, Array, String, Number, JSON, Math,
    dbGet: (k, d) => (k === 'cases' ? (x.cases || []) : d), sessionStorage, showToast: (m) => toasts.push(String(m)) };
  vm.createContext(ctx);
  vm.runInContext(CODE + '\nthis.api={erpStageNextCandidates,erpContractFollowupSeed,erpStageGoFollowup,erpStageNextRow,erpTakeContractSeed,ERP_CT_SEED_KEY};', ctx);
  return { api: ctx.api, store, toasts, sessionStorage };
}
const E = env();
const OPTS = (...codes) => codes.map((c) => ({ code: c, name: c }));
const ALL = OPTS('lrc-local', 'lrc-central', 'court-admin', 'wc-apply', 'wc-review', 'wc-rereview');
const marks = (...pairs) => pairs.map(([code, state]) => ({ code, state, strength: 'strong', evidence: '', srcDoc: '', at: 1 }));
const ct = (o) => Object.assign({ id: 'ct-1', contractNo: '계약-2026-100', status: 'signed', kinds: ['case'], typeCodes: { case: 'case-dismiss' },
  companyName: '가나다기업', company: { name: '가나다기업', bizNo: '1234567890', ceo: '점검대표', contacts: [{ name: '점검담당' }] },
  managerMain: 'S1', managerSubs: ['S2'], briefs: { case: '부당해고 구제신청 대리' }, amounts: { case: 5500000 }, startDate: '2026-11-01', endDate: '2026-12-31',
  stageMarks: marks(['lrc-local', 'checked']) }, o || {});
const codes = (r) => Array.from(r.map((x) => x.code));

test('① 후보 — 사람이 ☑ 한 단계의 «다음 단계» (지노위→중노위 · 요양→심사→재심사→행정소송)', () => {
  assert.deepEqual(codes(E.api.erpStageNextCandidates(ct(), [], ALL)), ['lrc-central']);
  assert.deepEqual(codes(E.api.erpStageNextCandidates(ct({ stageMarks: marks(['lrc-local', 'checked'], ['lrc-central', 'checked']) }), [], ALL)), ['court-admin'], '지노위·중노위 둘 다 맡았으면 다음은 행정소송');
  assert.deepEqual(codes(E.api.erpStageNextCandidates(ct({ stageMarks: marks(['wc-apply', 'checked']) }), [], ALL)), ['wc-review']);
  assert.deepEqual(codes(E.api.erpStageNextCandidates(ct({ stageMarks: marks(['wc-review', 'checked']) }), [], ALL)), ['wc-rereview']);
  assert.deepEqual(codes(E.api.erpStageNextCandidates(ct({ stageMarks: marks(['wc-rereview', 'checked']) }), [], ALL)), ['court-admin']);
  assert.deepEqual(codes(E.api.erpStageNextCandidates(ct({ stageMarks: marks(['court-admin', 'checked']) }), [], ALL)), [], '마지막 단계 다음은 없다');
  assert.deepEqual(codes(E.api.erpStageNextCandidates(ct({ stageMarks: marks(['lrc-central', 'checked'], ['wc-rereview', 'checked']) }), [], ALL)), ['court-admin'], '같은 다음 단계는 한 번만');
  const r = E.api.erpStageNextCandidates(ct(), [], ALL)[0];
  assert.deepEqual([r.name, r.short, r.from, r.madeNo], ['중앙노동위원회', '중노위', 'lrc-local', '']);
});

test('① 기계가 읽기만 한(auto) 단계로는 후보를 안 낸다 · ✕ 한·이미 읽은·이미 맡은 다음 단계도 안 낸다', () => {
  assert.deepEqual(codes(E.api.erpStageNextCandidates(ct({ stageMarks: marks(['lrc-local', 'auto']) }), [], ALL)), []);
  assert.deepEqual(codes(E.api.erpStageNextCandidates(ct({ stageMarks: marks(['lrc-local', 'dismissed']) }), [], ALL)), []);
  assert.deepEqual(codes(E.api.erpStageNextCandidates(ct({ stageMarks: marks(['lrc-local', 'checked'], ['lrc-central', 'dismissed']) }), [], ALL)), [], '중노위를 ✕ 했으면 다시 묻지 않는다');
  assert.deepEqual(codes(E.api.erpStageNextCandidates(ct({ stageMarks: marks(['lrc-local', 'checked'], ['lrc-central', 'auto']) }), [], ALL)), [], '읽기만 한 중노위는 먼저 ☑ 하면 된다');
  assert.deepEqual(codes(E.api.erpStageNextCandidates(ct({ stageMarks: [] }), [], ALL)), []);
  assert.deepEqual(codes(E.api.erpStageNextCandidates(ct({ stageMarks: undefined }), [], ALL)), []);
});

test('① 계약확정 뒤에만 — 상담접수·계약협의 중이거나 취소된 계약에서는 안 낸다', () => {
  for (const st of ['signed', 'transferred', 'closed']) assert.equal(E.api.erpStageNextCandidates(ct({ status: st }), [], ALL).length, 1, st);
  for (const st of ['consult', 'review', 'cancelled', '', undefined]) assert.equal(E.api.erpStageNextCandidates(ct({ status: st }), [], ALL).length, 0, String(st));
  assert.equal(E.api.erpStageNextCandidates(null, [], ALL).length, 0);
  assert.equal(E.api.erpStageNextCandidates(ct({ id: '' }), [], ALL).length, 0, '저장된 계약(번호표 있음)만');
});

test('④ 이 사건 유형에서 못 고르는 단계는 안 낸다 · 모듈이 없으면 아무것도 안 낸다', () => {
  assert.deepEqual(codes(E.api.erpStageNextCandidates(ct(), [], OPTS('lrc-local'))), [], '중노위를 못 고르는 유형');
  assert.deepEqual(codes(E.api.erpStageNextCandidates(ct(), [], [])), []);
  assert.deepEqual(codes(E.api.erpStageNextCandidates(ct(), [], undefined)), []);
  assert.deepEqual(codes(env({ noModule: true }).api.erpStageNextCandidates(ct(), [], ALL)), []);
});

test('④ 이미 만든 후속 계약이 있으면 «있음»(계약번호)으로 — 지워진 것·다른 계약의 것은 세지 않는다', () => {
  const made = { id: 'ct-2', contractNo: '계약-2026-111', parentContractId: 'ct-1', stageCode: 'lrc-central' };
  assert.equal(E.api.erpStageNextCandidates(ct(), [made], ALL)[0].madeNo, '계약-2026-111');
  assert.equal(E.api.erpStageNextCandidates(ct(), [Object.assign({}, made, { _deleted: true })], ALL)[0].madeNo, '', '휴지통으로 간 것은 «없음»');
  assert.equal(E.api.erpStageNextCandidates(ct(), [Object.assign({}, made, { parentContractId: 'ct-9' })], ALL)[0].madeNo, '', '다른 원계약의 후속');
  assert.equal(E.api.erpStageNextCandidates(ct(), [Object.assign({}, made, { stageCode: 'court-admin' })], ALL)[0].madeNo, '', '다른 단계의 후속');
  assert.equal(E.api.erpStageNextCandidates(ct(), [Object.assign({}, made, { contractNo: '' })], ALL)[0].madeNo, '번호 없음');
});

test('③ 씨앗 — 원계약의 사업장·담당·사건 유형을 잇고, 다음 단계·원계약 번호표를 달며, 금액·기간은 싣지 않는다', () => {
  const s = E.api.erpContractFollowupSeed(ct(), 'lrc-central', []);
  assert.equal(s.source, 'followup_contract');
  assert.equal(s.stageCode, 'lrc-central');
  assert.equal(s.parentContractId, 'ct-1');
  assert.equal(s.company.name, '가나다기업');
  assert.equal(s.company.bizNo, '1234567890');
  assert.equal(s.company.ceo, '점검대표');
  assert.equal(s.company.contacts[0].name, '점검담당');
  assert.equal(s.typeCodes.case, 'case-dismiss');
  assert.equal(s.managerMain, 'S1');
  assert.deepEqual(Array.from(s.managerSubs), ['S2']);
  assert.equal(s.briefs.case, '[중노위] 부당해고 구제신청 대리');
  assert.match(s.note, /원계약\(계약-2026-100\).*중앙노동위원회/);
  const json = JSON.stringify(s);
  assert.ok(!/5500000|startDate|endDate|amounts|successFee|contractFee|signDate/.test(json), '★ 금액·기간이 씨앗에 실려 가면 단계마다 금액이 겹쳐 잡힌다: ' + json.slice(0, 200));
  assert.ok(Math.abs(s.at - Date.now()) < 5000);
  assert.equal(s.parentCaseId, '', '이관 전이면 원심 사건이 없다');
  const mine = { id: 'cs-7', caseNo: '사건-2026-007', sourceContractId: 'ct-1' };
  const withCase = E.api.erpContractFollowupSeed(ct(), 'lrc-central', [{ id: 'cs-8', sourceContractId: 'ct-0' }, Object.assign({}, mine, { _deleted: true })]);
  assert.equal(withCase.parentCaseId, '', '지워진 사건만 있으면 안 잇는다');
  const live = E.api.erpContractFollowupSeed(ct(), 'lrc-central', [{ id: 'cs-8', sourceContractId: 'ct-0' }, mine]);
  assert.deepEqual([live.parentCaseId, live.parentCaseNo], ['cs-7', '사건-2026-007'], '이관해서 생긴 원심 사건이 있으면 잇는다');
});

test('③ 씨앗 — 업무 요약은 40자·근로자는 이름 있는 사람만 새 번호표로 · 사건 유형이나 사업장 이름이 없으면 null', () => {
  const long = E.api.erpContractFollowupSeed(ct({ briefs: { case: '가'.repeat(80) } }), 'wc-review', []);
  assert.equal(long.briefs.case.length, 40);
  assert.match(long.briefs.case, /^\[심사\] /);
  const w = E.api.erpContractFollowupSeed(ct({ company: { name: '가나다기업', workers: [{ id: 'old', name: '점검근로자', phone: '010' }, { name: ' ' }, null] } }), 'lrc-central', []);
  assert.equal(w.workers.length, 1);
  assert.equal(w.workers[0].name, '점검근로자');
  assert.notEqual(w.workers[0].id, 'old', '근로자 번호표는 새로 — 원계약과 같은 사람 기록을 공유하지 않는다');
  assert.equal(E.api.erpContractFollowupSeed(ct({ typeCodes: {} }), 'lrc-central', []), null, '사건 유형이 없으면 사건 후속 계약으로 못 연다');
  assert.equal(E.api.erpContractFollowupSeed(ct({ companyName: '', company: {} }), 'lrc-central', []), null);
  assert.equal(E.api.erpContractFollowupSeed(ct(), '없는-단계', []), null);
  assert.equal(E.api.erpContractFollowupSeed(null, 'lrc-central', []), null);
});

test('② 눌렀을 때 — 계약을 만들지 않고 씨앗을 세션에 넣어 «계약 창을 닫기만» 한다 · 계약관리가 받는 모양(erpTakeContractSeed)과 맞는다', () => {
  const e = env();
  let closed = 0;
  assert.equal(e.api.erpStageGoFollowup(ct(), 'lrc-central', () => { closed++; }), true);
  assert.equal(closed, 1, '창을 닫는다(닫히면 계약관리가 씨앗을 받아 새 계약 창을 연다)');
  assert.equal(e.store.size, 1, '세션에 씨앗 하나');
  const taken = e.api.erpTakeContractSeed([e.sessionStorage], Date.now());
  assert.ok(taken, '계약관리가 이 씨앗을 받는다');
  assert.equal(taken.stageCode, 'lrc-central');
  assert.equal(taken.parentContractId, 'ct-1');
  assert.equal(taken.company.name, '가나다기업');
  assert.equal(e.store.size, 0, '한 번 받으면 지운다(안 지우면 계약관리를 열 때마다 창이 뜬다)');
  assert.equal(e.api.erpTakeContractSeed([e.sessionStorage], Date.now()), null);
});

test('② 못 열 때 — 사건 유형이 없거나 세션이 막히면 알리고, 창은 닫지 않는다', () => {
  const a = env();
  let closed = 0;
  assert.equal(a.api.erpStageGoFollowup(ct({ typeCodes: {} }), 'lrc-central', () => { closed++; }), false);
  assert.equal(closed, 0, '쓰던 창을 닫지 않는다');
  assert.match(a.toasts.join(' '), /사건 유형/);
  assert.equal(a.store.size, 0);
  const b = env({ storageThrows: true });
  assert.equal(b.api.erpStageGoFollowup(ct(), 'lrc-central', () => { closed++; }), false);
  assert.equal(closed, 0);
  assert.match(b.toasts.join(' '), /넘기지 못했습니다/);
  assert.equal(env().api.erpStageGoFollowup(ct(), 'lrc-central'), true, 'onClose 가 없어도 터지지 않는다');
});

test('줄 — 후보가 없으면 줄이 없고, 후보에는 «후속 계약 만들기» 단추 · 이미 만들었으면 단추 없이 «있음»', () => {
  assert.equal(E.api.erpStageNextRow(ct({ stageMarks: [] }), [], ALL, () => {}), null);
  assert.equal(E.api.erpStageNextRow(null, [], ALL, () => {}), null);
  const got = [];
  const row = E.api.erpStageNextRow(ct(), [], ALL, (c) => got.push(c));
  assert.match(text(row), /후속 계약 후보/);
  const btns = find(row, (n) => n.tag === 'button');
  assert.equal(btns.length, 1);
  assert.equal(text(btns[0]), '후속 계약 만들기');
  btns[0].props.onClick();
  assert.deepEqual(got, ['lrc-central'], '누르면 그 다음 단계 코드 하나만 넘어간다');
  const made = E.api.erpStageNextRow(ct(), [{ id: 'ct-2', contractNo: '계약-2026-111', parentContractId: 'ct-1', stageCode: 'lrc-central' }], ALL, () => {});
  assert.equal(find(made, (n) => n.tag === 'button').length, 0);
  assert.match(text(made), /후속 계약 있음 · 계약-2026-111/);
});

/* ── 짜임새: 계약 창에는 «저장된 계약»만 · 단계 상자 바로 아래 · 닫기 길은 계약 창의 onClose ── */
test('계약 창에 한 번, 사건 상자 안에서만 걸리고 저장된 계약(props.cur)을 넘긴다 · 계약관리는 닫힐 때 씨앗을 받는다', () => {
  assert.equal((SRC.match(/isCase && erpStageNextRow\(props\.cur, /g) || []).length, 1);
  const box = SRC.indexOf('isCase && erpStageBox(f, setF, caseStageOpts)');
  const next = SRC.indexOf('isCase && erpStageNextRow(props.cur, ');
  assert.ok(box > 0 && next > box && next - box < 900, '단계 상자 바로 아래');
  assert.match(SRC.slice(next, next + 300), /erpStageGoFollowup\(props\.cur, nx, props\.onClose\)/, '눌렀을 때 계약 창을 닫는다');
  assert.match(SRC, /useEffect\(function\(\)\{ if\(!modal\) takeNewContractSeed\(\); \}, \[modal\]\);/, '창이 닫히면 계약관리가 씨앗을 받는다(후속 계약 창이 열리는 길)');
});

test('CSS — 후보 칸은 연초록 · 이미 만든 것은 파랑', () => {
  assert.match(CSS, /\.stg-it\.stg-nx\{[^}]*#f0fdf4/);
  assert.match(CSS, /\.stg-it\.stg-nx\.stg-ck\{[^}]*#eff6ff/);
});
