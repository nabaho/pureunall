'use strict';
/* 약어를 바꾸면 «과거 번호까지» · 다른 곳에 베껴 둔 번호도 함께 (대표 지시 2026-10-09)
   「지금 바꾸는제목은 과거도 모두 바꾸게 하고 싶다 … 모두 바꿀것인지 앞으로 바꿀것인지
    그리고 모두 과거도 바꾸면 모든 푸른통합시스템에 모든 연결되어 있는 이름도 같이 바뀌게」

   지키는 것
   ① 과거까지 — 연도·순번은 그대로, 앞 글자만 · 그 유형만(같은 약어를 쓰는 다른 유형은 안 건드림)
   ② 바꾼 번호가 이미 있으면 하나도 안 바꾼다
   ③ 사본: 계약 이관 토막·arrivedNo · 입금 caseNo · 진행 projectNo · 업무관리 no·pe_m/no·end_to · 메일 docPin·docRule
   ④ 짝은 지도 한 장으로 — 006→007 과 001→006 이 함께 있어도 엉키지 않는다
   ⑤ 메일 열쇠 꼴이 pu-cards.html caseKeyOf 와 같다(다르면 고정한 서류가 풀린다)
   ⑥ 번호가 바뀌는 세 길(약어·합치기·시작일 재정렬)이 모두 같은 함수를 부른다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn.js');
const { stripJs } = require('./strip-comments.js');

const R = path.join(__dirname, '..');
const ERP = fs.readFileSync(path.join(R, 'pu-erp.html'), 'utf8');
const CARDS = fs.readFileSync(path.join(R, 'pu-cards.html'), 'utf8');

function box(db) {
  const ctx = { Object, Array, String, JSON, parseInt };
  vm.createContext(ctx);
  const src = [
    ERP.match(/var BIZ_TYPE_MERGE_MAP = \{[\s\S]*?\n\};/)[0],
    ERP.match(/var BIZ_NO_RE = .*;/)[0],
    cutFn(ERP, 'function bizTypeCodeOf('), cutFn(ERP, 'function bizNoMapOf('), cutFn(ERP, 'function bizNoTokenSwap('),
    cutFn(ERP, 'function bizNoPinKey('), cutFn(ERP, 'function bizNoCascadeLocal('), cutFn(ERP, 'function bizNoCascadeRemote('),
    cutFn(ERP, 'function bizTypeRenamePlan('),
  ].join('\n');
  vm.runInContext(src, ctx);
  ctx.get = (k, d) => (db[k] !== undefined ? db[k] : d);
  return ctx;
}
const J = (x) => JSON.parse(JSON.stringify(x));

const DB = {
  consultings: [
    { id: 'c1', no: '현클-2026-001', typeCode: 'T-CL', companyName: '가나상사' },
    { id: 'c2', no: '현클-2025-007', typeCode: 'T-CL' },
    { id: 'c3', no: '현클-2026-002', typeCode: 'T-OTHER' },          // 같은 약어 · 다른 유형 — 건드리면 안 된다
    { id: 'c4', no: '일터-2026-001', typeCode: 'T-IL' },
  ],
  contracts: [
    { id: 'k1', transferredTo: 'consulting:현클-2026-001, case:현클-2026-001' },
    { id: 'k2', arrivedNo: '현클-2025-007' },
    { id: 'k3', transferredTo: 'consulting:현클-2026-0011' },     // 비슷하지만 다른 번호
  ],
  finance_income: [
    { id: 'f1', sourceId: 'c1', caseNo: '현클-2026-001' },
    { id: 'f2', sourceId: 'zz', caseNo: '현클-2026-001' },          // 다른 건의 사본 — 번호만 같다고 안 바꾼다
  ],
  project_progress: [{ id: 'p1', projectId: 'c2', projectNo: '현클-2025-007' }],
};

test('①★★ 과거까지 — 앞 글자만 · 그 유형만', () => {
  const c = box(J(DB));
  const p = c.bizTypeRenamePlan('consulting', 'T-CL', '현장클리', c.get);
  assert.equal(p.ok, true);
  assert.deepEqual(J(p.changes.map((x) => x.from + '>' + x.to).sort()),
    ['현클-2025-007>현장클리-2025-007', '현클-2026-001>현장클리-2026-001']);
  assert.ok(!p.changes.some((x) => x.id === 'c3'), '★★ 같은 약어를 쓰는 다른 유형까지 바꿨다');
});

test('②★★ 바꾼 번호가 이미 있으면 하나도 안 바꾼다', () => {
  const db = J(DB); db.consultings.push({ id: 'c9', no: '현장클리-2026-001', typeCode: 'T-X' });
  const c = box(db);
  const p = c.bizTypeRenamePlan('consulting', 'T-CL', '현장클리', c.get);
  assert.equal(p.ok, false, '★★ 겹치는데 바꾸려 한다 — 같은 번호가 둘 생긴다');
  assert.match(p.why, /현장클리-2026-001/);
});

test('③★★ 이알피 안의 사본 — 계약 토막·arrivedNo · 입금 · 진행', () => {
  const c = box(J(DB));
  const ch = [{ id: 'c1', from: '현클-2026-001', to: '현장클리-2026-001' }, { id: 'c2', from: '현클-2025-007', to: '현장클리-2025-007' }];
  const out = c.bizNoCascadeLocal('consulting', ch, c.get);
  const by = {}; out.forEach((o) => { by[o.store + '/' + o.id] = o.fields; });
  assert.equal(by['contracts/k1'].transferredTo, 'consulting:현장클리-2026-001, case:현클-2026-001',
    '★★ 이관 토막을 안 고쳤거나, 다른 종류(case) 토막까지 고쳤다');
  assert.equal(by['contracts/k2'].arrivedNo, '현장클리-2025-007');
  assert.equal(by['contracts/k3'], undefined, '★ 비슷한 다른 번호까지 바꿨다');
  assert.equal(by['finance_income/f1'].caseNo, '현장클리-2026-001');
  assert.equal(by['finance_income/f2'], undefined, '★★ 다른 건의 입금을 번호만 보고 바꿨다');
  assert.equal(by['project_progress/p1'].projectNo, '현장클리-2025-007');
});

test('③★★ 이알피 밖 — 업무관리 · 푸른 메일', () => {
  const c = box({});
  const ch = [{ id: 'c1', from: '현클-2026-001', to: '현장클리-2026-001' }];
  const items = {
    w1: { ref: { type: 'consulting', id: 'c1' }, no: '현클-2026-001', pe_m: { no: '현클-2026-001' } },
    w2: { ref: { type: 'case', id: 'c1' }, no: '현클-2026-001' },               // 종류가 다르면 안 바꾼다
    w3: { ref: { type: 'contract', id: 'k1' }, end_to: 'consulting:현클-2026-001' },
  };
  const co = { 가나: { docPin: { d1: 'consulting~현클-2026-001', d2: 'case~현클-2026-001' }, docRule: { n1: 'consulting~현클-2026-001' } } };
  const up = J(c.bizNoCascadeRemote('consulting', ch, items, co));
  assert.equal(up['work_erp/items/w1/no'], '현장클리-2026-001');
  assert.equal(up['work_erp/items/w1/pe_m/no'], '현장클리-2026-001');
  assert.equal(up['work_erp/items/w2/no'], undefined, '★★ 다른 종류의 업무를 바꿨다');
  assert.equal(up['work_erp/items/w3/end_to'], 'consulting:현장클리-2026-001');
  assert.equal(up['pucards/coInfo/가나/docPin/d1'], 'consulting~현장클리-2026-001', '★★ 메일에 고정한 서류가 풀린다');
  assert.equal(up['pucards/coInfo/가나/docRule/n1'], 'consulting~현장클리-2026-001');
  assert.equal(up['pucards/coInfo/가나/docPin/d2'], undefined);
});

test('④★★ 짝은 지도 한 장으로 — 006→007 · 001→006 이 엉키지 않는다', () => {
  const c = box({ contracts: [{ id: 'a', transferredTo: 'consulting:일터-2026-006' }, { id: 'b', transferredTo: 'consulting:일터혁신-2026-001' }] });
  const ch = [{ id: 'x', from: '일터-2026-006', to: '일터-2026-007' }, { id: 'y', from: '일터혁신-2026-001', to: '일터-2026-006' }];
  const by = {}; c.bizNoCascadeLocal('consulting', ch, c.get).forEach((o) => { by[o.id] = o.fields.transferredTo; });
  assert.equal(by.a, 'consulting:일터-2026-007');
  assert.equal(by.b, 'consulting:일터-2026-006', '★★ 차례로 바꿔 006 이 다시 007 이 됐다');
});

test('⑤★★ 메일 열쇠 꼴이 pu-cards.html caseKeyOf 와 같다', () => {
  const c = box({});
  const ctx = {}; vm.createContext(ctx);
  vm.runInContext(cutFn(CARDS, 'function caseKeyOf('), ctx);
  ['현클-2026-001', '일터.상생-2026-002', '산재/등-2026-003'].forEach((no) => {
    assert.equal(c.bizNoPinKey('consulting', no), ctx.caseKeyOf({ kind: 'consulting', no }),
      '★★ 메일이 쓰는 열쇠와 꼴이 다르다 — 고친 줄 알았는데 서류가 풀린다');
  });
});

test('⑥★★ 번호가 바뀌는 세 길이 모두 bizNoCascade 를 부른다', () => {
  assert.match(stripJs(cutFn(ERP, 'function reorderConsultingNos(')), /bizNoCascade\('consulting', olds/,
    '★★ 시작일 재정렬로 번호가 밀려도 사본은 옛 번호로 남는다');
  assert.match(stripJs(cutFn(ERP, 'function bizTypeMergeRun(')), /bizNoCascade\(plan\.kind/,
    '★★ 유형을 합쳐도 사본은 옛 번호로 남는다');
  assert.match(stripJs(cutFn(ERP, 'function bizTypeRenameRun(')), /bizNoCascade\(plan\.kind, done\)/,
    '★★ 약어를 과거까지 바꿔도 사본은 옛 번호로 남는다');
});

test('⑦ 약어 고치기 — 「과거까지 모두 / 앞으로만」을 고르고, 바꾸기 직전에 다시 세운다', () => {
  const ed = stripJs(cutFn(ERP, 'async function editType('));
  assert.match(ed, /key:'all', label:'과거까지 모두 바꾸기'/);
  assert.match(ed, /key:'future'/);
  assert.match(ed, /var rp2 = bizTypeRenamePlan\(/, '★ 묻는 사이 생긴 건을 못 본다');
  assert.match(ed, /bizTypeRenameRun\(rp2/);
});

/* ⑧ 2026-10-09 실측 — 바꾼 기록(renameLog)을 따로 한 번 더 저장했더니 서버에 안 남았다.
   두 저장이 잇달아 나가며 뒤의 것이 묻혔다. 약어를 바꾸는 «같은 저장»에 얹어야 한다. */
test('⑧★★ 바꾼 기록은 약어와 «같은 저장»에 — 따로 저장하면 묻힌다', () => {
  const run = stripJs(cutFn(ERP, 'function bizTypeRenameRun('));
  assert.doesNotMatch(run, /bizTypeApply\(|dbSet\(/, '★★ 기록을 따로 저장한다 — 약어 저장과 잇달아 나가 서버에서 묻힌다');
  assert.match(run, /log:log/);
  const ed = stripJs(cutFn(ERP, 'async function editType('));
  const runAt = ed.indexOf('bizTypeRenameRun(rp2'), saveAt = ed.indexOf('persistWith(function(cur){');
  assert.ok(runAt > 0 && saveAt > runAt, '★★ 번호를 바꾸기 «전에» 약어를 저장하면 기록을 같은 저장에 못 얹는다');
  assert.match(ed.slice(saveAt), /bizTypeRenameLogAdd\(nx, rr\.log\)/, '★★ 약어 저장에 기록을 안 얹는다');
  const c = box({}); vm.runInContext(cutFn(ERP, 'function bizTypeRenameLogAdd('), c);
  const t = c.bizTypeRenameLogAdd({ code: 'T', renameLog: Array.from({ length: 10 }, (_, i) => ({ i })) }, { i: 99 });
  assert.equal(t.renameLog.length, 10, '★ 기록이 끝없이 쌓인다');
  assert.equal(t.renameLog[9].i, 99);
});
