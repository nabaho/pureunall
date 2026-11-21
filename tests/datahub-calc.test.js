/* 데이터관리 계산 모듈(js/pu-datahub-calc.js) — 이알피와 «같은 잣대»인가, 두 번 세지 않는가
   ★ 값이 아니라 규칙을 본다 — 이알피의 진짜 함수를 pu-erp.html 에서 떼어 vm 에서 돌리고 같은 답인지 견준다.
   ① 입금 거르개(erpIncomeLive·erpIncomeIsRevenue·erpPerfCounts)가 이알피와 같다
   ② 자문료 미수(erpAdvisoryDues 와 그 도우미)가 이알피와 같다
   ③ 합계는 finance_income 한 곳 — 사람 몫의 합 + 담당 없음 = 그 달 입금 합 (두 번 세지 않는다)
   ④ 지운 것·되돌린 것·성과조정·과거기록·개인수익은 빠지고, 몇 줄 뺐는지 남는다
   ⑤ 사람은 sid 로만 — 명부에 없는 sid 는 이름을 짐작하지 않는다
   ⑥ 귀속월 기준·순액 기준 전환
   ⑦ 채팅에 보낼 숫자에는 실명·업체명·sid 가 없다 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path'), vm = require('vm');
const { cutFn } = require('./cut-fn');
const C = require('../js/pu-datahub-calc.js');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');
const DECLS = ['function erpIncomeLive(', 'function erpIncomeIsRevenue(', 'function erpPerfCounts(',
  'function erpAdvisoryYmOf(', 'function erpIsAdvisoryIncome(', 'function incomeIsCo(', 'function erpFeeForMonth(',
  'function erpFeeStopped(', 'function erpAdvisoryIndex(', 'function erpAdvisoryPaidFor(', 'function _erpYmShift(',
  'function erpAdvisoryDues('];
function erpBox(todayYM) {
  const ctx = { String, Array, Object, Math, Date, JSON, parseInt, isNaN, todayYM: () => todayYM,
    ERP_ARREARS_MAX_MONTHS: 24, ERP_ARREARS_TOL: 1100 };
  vm.createContext(ctx);
  vm.runInContext(DECLS.map((d) => cutFn(SRC, d)).join('\n')
    + '\nvar ERP_ARREARS_MAX_MONTHS = 24; var ERP_ARREARS_TOL = 1100;', ctx);
  return ctx;
}
/* 이알피 쪽 상수도 같은지 — 숫자가 바뀌면 이 모듈도 같이 바꿔야 한다 */
test('② 이알피 미수 상수(거슬러 보는 달·허용치)와 같은 값을 쓴다', () => {
  const tol = /var ERP_ARREARS_TOL = (\d+);/.exec(SRC), max = /var ERP_ARREARS_MAX_MONTHS = (\d+);/.exec(SRC);
  const mine = fs.readFileSync(path.join(__dirname, '..', 'js', 'pu-datahub-calc.js'), 'utf8');
  assert.ok(tol && max, '이알피에서 상수를 못 찾음');
  assert.match(mine, new RegExp('ERP_ARREARS_TOL = ' + tol[1] + ';'));
  assert.match(mine, new RegExp('ERP_ARREARS_MAX_MONTHS = ' + max[1] + ';'));
});

const ROWS = [
  {}, { _deleted: true }, { undoneDate: '2026-10-01' }, { undoneDate: 'x', perfSettled: true },
  { sourceKind: 'perf-adjust' }, { sourceKind: 'company' }, { sourceKind: 'case' }, { isPersonalIncome: true, sourceKind: 'case' },
  { perfHistorical: true, sourceKind: 'case' }, { kind: '자문료', sourceKind: 'company', advisoryYm: '2026-09', date: '2026-10-02' },
  { kind: '컨설팅', sourceKind: 'company', date: '2026-10-02' }, null,
];
test('① 입금 거르개가 이알피 진짜 함수와 같은 답을 낸다', () => {
  const E = erpBox('2026-11');
  ROWS.forEach((r, i) => {
    assert.equal(C.erpIncomeLive(r), E.erpIncomeLive(r), 'live #' + i);
    assert.equal(C.erpIncomeIsRevenue(r), E.erpIncomeIsRevenue(r), 'revenue #' + i);
    assert.equal(C.erpPerfCounts(r, false), E.erpPerfCounts(r, false), 'perf #' + i);
    assert.equal(C.erpPerfCounts(r, true), E.erpPerfCounts(r, true), 'perf pay #' + i);
    assert.equal(C.erpIsAdvisoryIncome(r), E.erpIsAdvisoryIncome(r), 'advisory #' + i);
    if (r) assert.equal(C.erpAdvisoryYmOf(r), E.erpAdvisoryYmOf(r), 'ym #' + i);
  });
});

test('② 자문료 미수(erpAdvisoryDues)가 이알피와 같은 답을 낸다 — 요율 변경·중단·허용치·일부입금', () => {
  const E = erpBox('2026-11');
  C._setToday(() => '2026-11');
  const cos = [
    { id: 'co-1', name: '가', status: 'active', monthlyAdvisoryFee: 200000, contractStartDate: '2026-03-01' },
    { id: 'co-2', name: '나', status: 'active', monthlyAdvisoryFee: 300000, feeHistory: [{ from: '2026-01', fee: 250000 }, { from: '2026-07', fee: 300000 }] },
    { id: 'co-3', name: '다', status: 'active', monthlyAdvisoryFee: 100000, suspended: true, suspendedAt: '2026-08-15' },
    { id: 'co-4', name: '라', status: 'active', monthlyAdvisoryFee: 100000, taxInvoicePaymentDay: '선납' },
    { id: 'co-5', name: '마', status: 'closed', monthlyAdvisoryFee: 100000 },
  ];
  const inc = [
    { companyId: 'co-1', kind: '자문료', sourceKind: 'company', advisoryYm: '2026-09', amount: 200000, date: '2026-10-01' },
    { companyId: 'co-1', kind: '자문료', sourceKind: 'company', advisoryYm: '2026-10', amount: 199000, date: '2026-10-25' },
    { companyId: 'co-1', kind: '자문료', sourceKind: 'company', advisoryYm: '2026-08', amount: 100000, date: '2026-09-01' },
    { companyId: 'co-2', kind: '자문료', sourceKind: 'company', advisoryYm: '2026-06', amount: 250000, date: '2026-06-05', undoneDate: '2026-06-06' },
    { companyName: '다', kind: '자문료', sourceKind: 'company', amount: 100000, date: '2026-07-03' },
  ];
  cos.forEach((co) => {
    const a = JSON.stringify(C.erpAdvisoryDues(co, inc, { upToYm: '2026-10', maxMonths: 12 }));
    const b = JSON.stringify(E.erpAdvisoryDues(co, inc, { upToYm: '2026-10', maxMonths: 12 }));
    assert.equal(a, b, co.id + ' 의 미수 달이 이알피와 다르다');
  });
});

/* ── 지어낸 자료 한 벌 (실데이터 아님) ── */
const RAW = {
  userDir: { v: [
    { sid: 'P-001', name: '노무사가', role: 'staff', title: '노무사', status: 'active' },
    { sid: 'A-001', name: '직원나', role: 'staff', title: '주임', status: 'active' },
    { sid: 'P-000', name: '대표다', role: 'admin', title: '대표노무사', status: 'active' },
  ], u: 1 },
  companies: { v: { 'co-1': { id: 'co-1', name: '가상회사', status: 'active', managerMain: 'P-001', monthlyAdvisoryFee: 200000 } }, u: 1 },
  incomes: { v: [
    { id: 'i1', date: '2026-11-03', amount: 1000000, sourceKind: 'case', perfShares: [{ sid: 'P-001', sharePct: 70 }, { sid: 'A-001', sharePct: 30 }], confirmedBy: 'A-001' },
    { id: 'i2', date: '2026-11-05', amount: 200000, sourceKind: 'company', kind: '자문료', companyId: 'co-1', advisoryYm: '2026-10', cardFee: 3000 },
    { id: 'i3', date: '2026-11-07', amount: 500000, sourceKind: 'other' },
    { id: 'i4', date: '2026-11-08', amount: 900000, sourceKind: 'case', _deleted: true },
    { id: 'i5', date: '2026-11-09', amount: 800000, sourceKind: 'case', undoneDate: '2026-11-10' },
    { id: 'i6', date: '2026-11-09', amount: 70000, sourceKind: 'perf-adjust' },
    { id: 'i7', date: '2026-11-09', amount: 60000, sourceKind: 'case', confirmed: false },
    { id: 'i8', date: '2026-11-09', amount: 50000, sourceKind: 'case', isPersonalIncome: true },
    { id: 'i9', date: '2026-11-12', amount: 333333, sourceKind: 'case', perfShares: [{ sid: 'P-001', sharePct: 50 }, { sid: 'X-999', sharePct: 50 }] },
  ], u: 1 },
  workItems: [{ id: 'w1', co_id: 'co-1' }, { id: 'w2', co_id: 'co-1', _deleted: true }],
  workLogs: [{ d: '2026-11-03', by: 'A-001' }, { d: '2026-11-04', by: 'A-001' }, { d: '2026-11-04', by: 'P-001' }, { d: '2026-11-05', by: '' }],
};

test('③ 두 번 세지 않는다 — 사람 몫의 합 + 담당 없음 = 그 달 입금 합', () => {
  const ds = C.build(RAW, { endYm: '2026-11', today: '2026-11-20' });
  const i = ds.months.indexOf('2026-11');
  const people = ds.PEOPLE.reduce((s, p) => s + p.m[i].inc, 0);
  assert.equal(people + ds.NONE.m[i].inc, ds.MTOT[i].inc, '사람 몫 합과 담당 없음을 더하면 입금 합이어야 한다');
  const cat = Object.values(ds.MTOT[i].cat).reduce((a, b) => a + b, 0);
  assert.equal(cat, ds.MTOT[i].inc, '입금 종류 합 = 입금 합');
  assert.equal(ds.MTOT[i].n, 4, '살아 있는 매출 줄만 센다');
});

test('④ 빠지는 줄 — 지움·되돌림·성과조정·과거기록·개인수익, 몇 줄인지 남긴다', () => {
  const ds = C.build(RAW, { endYm: '2026-11', today: '2026-11-20' });
  const q = ds.quality;
  assert.deepEqual([q.deleted, q.undone, q.adjust, q.historical, q.personal].map((x) => x > 0), [true, true, true, true, true]);
  assert.ok(q.noOwner >= 1, '성과 몫도 업체 주담당도 없는 입금은 «담당 없음»으로');
  assert.equal(q.logNoBy, 1, '누가 했는지 없는 기록은 세지 않고 셈만 남긴다');
});

test('⑤ 사람은 sid 로만 — 성과 몫 비율대로 나누고, 명부에 없는 sid 는 이름을 짐작하지 않는다', () => {
  const ds = C.build(RAW, { endYm: '2026-11', today: '2026-11-20' });
  const i = ds.months.indexOf('2026-11');
  const by = (sid) => ds.PEOPLE.find((p) => p.id === sid);
  assert.ok(by('P-001').m[i].inc > by('A-001').m[i].inc, '70:30 으로 나눈다');
  assert.ok(by('P-001').m[i].inc >= 200000, '성과 몫 없는 자문료는 업체 주담당(결정 ①)');
  const ghost = by('X-999');
  assert.ok(ghost && !ghost.inDir && /명부에 없음/.test(ghost.name), '명부에 없는 sid');
  assert.equal(by('P-000').kind, '대표', '대표는 노무사 평균과 섞지 않게 따로');
  assert.equal(by('A-001').m[i].proc, 1, '확정한 사람(confirmedBy) 처리 건수');
  assert.equal(by('A-001').m[i].task, 2, '업무 기록 건수');
  assert.ok(by('A-001').recRate > 0 && by('A-001').recRate <= 100);
});

test('⑥ 귀속월·순액 전환 — 자문료는 몇 월분으로, 순액은 카드 수수료를 뺀다', () => {
  const cash = C.build(RAW, { endYm: '2026-11', today: '2026-11-20' });
  const acc = C.build(RAW, { endYm: '2026-11', basis: 'accrual', today: '2026-11-20' });
  const net = C.build(RAW, { endYm: '2026-11', net: true, today: '2026-11-20' });
  const i11 = cash.months.indexOf('2026-11'), i10 = cash.months.indexOf('2026-10');
  assert.equal(acc.MTOT[i10].cat.adv, 200000, '10월분 자문료는 귀속월 기준이면 10월');
  assert.equal(cash.MTOT[i10].cat.adv, 0);
  assert.equal(cash.MTOT[i11].inc - net.MTOT[i11].inc, 3000, '순액 = 총액 − 카드 수수료');
});

test('⑦ 채팅에 보낼 숫자에는 실명·업체명·sid 가 없다 — 가명은 화면에서만 되돌린다', () => {
  const ds = C.build(RAW, { endYm: '2026-11', today: '2026-11-20' });
  const { ctx, back } = C.pseudonymize(ds);
  const s = JSON.stringify(ctx);
  ['노무사가', '직원나', '대표다', '가상회사', 'P-001', 'A-001', 'co-1', 'X-999'].forEach((w) => assert.ok(!s.includes(w), w + ' 가 실려 나간다'));
  assert.equal(C.unalias('P1 과 P10 은 다르다', { P1: '갑', P10: '을' }), '갑 과 을 은 다르다');
  assert.ok(Object.keys(back).length >= 3);
});

test('⑦ 화면이 만든 집계는 서버(datahubAsk)가 받는 «숫자·가명» 모양 그대로다 — 한쪽만 칸을 더하면 빨개진다', () => {
  const DH = require('../functions/datahub.js');
  const ds = C.build(RAW, { endYm: '2026-11', today: '2026-11-20' });
  const ps = C.pseudonymize(ds);
  assert.equal(DH.ctxShapeOk(JSON.parse(JSON.stringify(ps.ctx))), true);
  /* 질문 속 실명·업체명은 «모든» 가명표로 바뀐다(상위 40곳 밖 업체도) */
  const q = C.maskText('노무사가 와 가상회사 입금 · 가상 회사 · 노무사 가', ps);
  ['노무사가', '가상회사', '가상 회사', '노무사 가'].forEach((w) => assert.ok(!q.includes(w), w + ' 가 질문에 남는다'));
});

test('봉투 풀기 — 배열·{id:rec} 지도·숫자 열쇠 객체를 모두 읽고, 원본은 바꾸지 않는다', () => {
  const src = { v: { a: { name: 'x' }, '0': { id: 'z' } } };
  const before = JSON.stringify(src);
  const out = C.unwrap(src);
  assert.equal(out.length, 2);
  assert.ok(out.some((r) => r.id === 'a'), '열쇠를 번호로 되살린 «사본»');
  assert.equal(JSON.stringify(src), before, '원본은 그대로');
  assert.deepEqual(C.unwrap(null), []);
});

test('주 열쇠는 업무관리와 같다 (ISO 주 — 목요일의 해)', () => {
  const W = fs.readFileSync(path.join(__dirname, '..', 'work.html'), 'utf8');
  const ctx = { Date, Math };
  vm.createContext(ctx);
  vm.runInContext(['function pad(', 'function mondayOf(', 'function addDays(', 'function weekKeyOf('].map((d) => cutFn(W, d)).join('\n'), ctx);
  ['2026-01-01', '2025-12-29', '2026-11-20', '2027-01-03', '2026-06-15'].forEach((d) => {
    assert.equal(C.weekKeyOf(d), ctx.weekKeyOf(ctx.mondayOf(new Date(d + 'T00:00:00'))), d);
  });
});
