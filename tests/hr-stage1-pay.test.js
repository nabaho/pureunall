'use strict';
/* 인사관리 1단계 — 자기 직원 급여 (대표 지시 2026-10-10 「모두 다해라」)
   ═══════════════════════════════════════════════════════════════════════════
   검토에서 나온 급여 문제를 고친 것을 «돌려서» 확인한다.
     ① 멈춘 달(잠금·지급)은 다시 셈하지 않는다 — 요율을 고쳐도 지난 명세서가 안 바뀐다
     ② 요율은 엔진(PuLaborCore) 연도표에서 — 이름만 2026 이고 값은 2025 이던 상수를 쓰지 않는다
     ③ 소득세는 공식 간이세액표 — 근사식은 실제의 약 4.5배를 뗐다
     ④ 식대 칸은 지급총액에 들어간다 ⑤ 무급 휴직은 일할에서 빠진다 ⑥ 휴일 8시간은 하루 단위
     ⑦ 일용·기타·사업소득 원천징수 ⑧ 최저임금 산입범위 ⑨ 명세서 = 계산 결과 ⑩ 급여대장은 머리줄 이름으로
   ★ 법정 요율·세율은 그 자체가 법이라 박는다 — 그 줄에 까닭을 적었다(검사고정-허용).
   실행: node --test tests/hr-stage1-pay.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripJs } = require('./strip-comments.js');

const R = path.join(__dirname, '..');
const RAW = fs.readFileSync(path.join(R, 'pu-erp.html'), 'utf8');
const SRC = RAW.replace(/\r\n/g, '\n');
function fnSrc(name){
  const i = SRC.indexOf('\nfunction ' + name + '(');
  assert.ok(i >= 0, name + ' 함수를 못 찾았습니다 — 이름이 바뀌었다면 이 검사도 함께 고치십시오');
  const j = SRC.indexOf('\nfunction ', i + 10);
  return SRC.slice(i + 1, j < 0 ? undefined : j);
}
function between(a, b){
  const i = SRC.indexOf(a), j = SRC.indexOf(b, i);
  assert.ok(i >= 0 && j > i, '구간을 못 찾았습니다: ' + a.slice(0, 40));
  return SRC.slice(i, j);
}

/* 급여 계산 한 벌을 vm 에 올린다 — 엔진·간이세액표는 «진짜» 파일을 싣는다 */
function payEnv(opt){
  opt = opt || {};
  const store = Object.assign({ pay_items: [], user_accounts: [], leave_of_absence: [] }, opt.store || {});
  const ctx = {
    console, Math, Number, String, parseInt, parseFloat, isFinite, isNaN, JSON, Object, Array, Date,
    dbGet: (k, d) => (k in store ? store[k] : d),
    isPayrollLocked: ym => (opt.locked || []).indexOf(ym) >= 0,
    calcPerfBonus: () => ({ total: opt.perf || 0, items: [] }),
    USERS_SEED: [], PAY_ITEM_SEED: []
  };
  vm.createContext(ctx);
  if (!opt.noEngine){
    vm.runInContext(fs.readFileSync(path.join(R, 'js', 'pu-labor-core.js'), 'utf8'), ctx);
    vm.runInContext(fs.readFileSync(path.join(R, 'js', 'pu-simpletax.js'), 'utf8'), ctx);
  }
  vm.runInContext(between('var PAYROLL_RATES_2026 = {', '// ============ 보상휴가제') + '\n' + fnSrc('getLoaList').replace(/^function getLoaList[\s\S]*?\n/, '') +
    '\nfunction getLoaList(){ return dbGet("leave_of_absence", []); }' +
    '\nthis.calcPayroll = calcPayroll; this.calcPayrollFresh = calcPayrollFresh; this.payslipLines = payslipLines;' +
    ' this.erpPayRates = erpPayRates; this.erpIncomeTax = erpIncomeTax; this.payrollSnapshotOf = payrollSnapshotOf;' +
    ' this.calcIncomeTax2026 = calcIncomeTax2026; this.payslipMethods = payslipMethods;', ctx);
  return ctx;
}
const REC = (o) => Object.assign({ id: 'pay-X-1-2026-09', empSid: 'X-1', ym: '2026-09', baseSalary: 3000000, dependents: 1,
  allowances: [], legalAllowances: {}, status: 'draft' }, o || {});

test('pu-erp.html 이 엔진(pu-labor-core)·간이세액표(pu-simpletax)를 캐시 번호와 함께 싣는다', () => {
  assert.match(RAW, /<script src="js\/pu-labor-core\.js\?v=\d+"><\/script>/);
  assert.match(RAW, /<script src="js\/pu-simpletax\.js\?v=\d+"><\/script>/);
});

test('② 2026년 4대보험은 엔진 연도표의 요율 — 연금 4.75%·건보 3.595%·장기 13.14%·고용 0.9%, 원 미만 절사', () => {
  /* 검사고정-허용: 국민연금법 개정(2026 총 9.5%)·건보공단 2026 요율 고시 — 법정 요율이다 */
  const c = payEnv().calcPayroll(REC());
  assert.equal(c.pension, 142500);     // 3,000,000 × 4.75%
  assert.equal(c.healthIns, 107850);   // 3,000,000 × 3.595%
  assert.equal(c.longCare, 14171);     // 107,850 × 13.14% = 14,171.49 → 절사
  assert.equal(c.empIns, 27000);
  assert.equal(c.ratesFrom, 'engine', '엔진이 실렸는데 상수 쪽으로 셈했습니다');
});

test('② 2025년 달은 2025년 요율로 — 연도가 바뀌어도 옛 달이 새 요율로 다시 셈해지지 않는다', () => {
  const c = payEnv().calcPayroll(REC({ ym: '2025-05' }));
  assert.equal(c.pension, Math.floor(3000000 * 0.045));   // 검사고정-허용: 2025 연금 4.5%
  assert.equal(c.healthIns, Math.floor(3000000 * 0.03545)); // 검사고정-허용: 2025 건보 3.545%
});

test('② 엔진이 안 실려도 상수가 2025 값이 아니다 (마지막 자리도 2026)', () => {
  const c = payEnv({ noEngine: true }).calcPayroll(REC());
  assert.equal(c.ratesFrom, 'fallback');
  assert.equal(c.pension, 142500, '엔진 없을 때 쓰는 상수가 옛 4.5% 입니다');
});

test('② 국민연금 기준소득월액 상한은 «7월»에 바뀐다 — 6월과 7월의 상한이 다르다', () => {
  const E = payEnv();
  const jun = E.calcPayroll(REC({ ym: '2026-06', baseSalary: 9000000 }));
  const jul = E.calcPayroll(REC({ ym: '2026-07', baseSalary: 9000000 }));
  assert.ok(jul.pension > jun.pension, '7월 상한 조정이 반영되지 않았습니다');
  assert.equal(jun.pension % 1, 0);
});

test('③ 소득세는 공식 간이세액표 값 — 옛 근사식(연간 세율을 월급에 댄 것)이 아니다', () => {
  const E = payEnv();
  const c = E.calcPayroll(REC());
  const t = E.PuLaborCore.pickSimpleTaxTable(E.PuSimpleTax.tables, '2026-09');
  const want = E.PuLaborCore.withholdingTax({ table: t, 월과세급여: 3000000, 부양가족수: 1 }).소득세;
  assert.equal(c.incomeTax, want);
  assert.ok(c.incomeTax < E.calcIncomeTax2026(3000000, 1) / 2, '근사식 값과 비슷합니다 — 근사식으로 셈하고 있습니다');
  assert.equal(c.localTax % 10, 0, '지방소득세는 10원 미만 절사');
  assert.match(c.incomeTaxBasis, /간이세액표/);
});

test('③ 직접 입력한 공제(공단 고지액 등)는 그대로 쓴다', () => {
  const c = payEnv().calcPayroll(REC({ incomeTaxOverride: 12340, healthInsOverride: 100000 }));
  assert.equal(c.incomeTax, 12340);
  assert.equal(c.healthIns, 100000);
  assert.equal(c.incomeTaxBasis, '직접 입력');
});

test('④ 식대 칸은 지급총액에 들어가고, 한도(20만원)까지만 비과세', () => {
  const c = payEnv().calcPayroll(REC({ nonTaxableMeal: 250000 }));
  assert.equal(c.grossPay, 3250000, '식대가 지급총액에 안 들어갔습니다 — 명세서(320만)와 계산(300만)이 어긋나던 결함');
  assert.equal(c.insurableBase, 3050000, '한도를 넘는 5만원은 과세되어야 합니다');   // 검사고정-허용: 식대 비과세 한도 월 20만원(소득세법 시행령 제17조의2)
});

test('⑤ 한 달 내내 무급 휴직이면 기본급·보험료·소득세가 0 — 「급여 정지」가 색만 바꾸지 않는다', () => {
  const store = { leave_of_absence: [{ sid: 'X-1', code: 'parental-leave', paidType: '고용보험', payrollPause: true, status: 'active', startDate: '2026-08-15', endDate: '2027-02-14' }] };
  const c = payEnv({ store }).calcPayroll(REC({ nonTaxableMeal: 200000 }));
  assert.equal(c.fullLoa, true);
  assert.equal(c.grossPay, 0);
  assert.equal(c.pension + c.healthIns + c.empIns + c.incomeTax, 0);
});

test('⑤ 달 중간부터 무급 휴직이면 그 날수만큼 일할 / 출산전후휴가는 자동으로 빼지 않는다', () => {
  const half = payEnv({ store: { leave_of_absence: [{ sid: 'X-1', code: 'sick-leave', paidType: '무급', payrollPause: true, status: 'active', startDate: '2026-09-16', endDate: '2026-12-31' }] } })
    .calcPayroll(REC());
  assert.equal(half.workDays, 15);
  assert.equal(half.baseSalaryProrated, 1500000);
  const mat = payEnv({ store: { leave_of_absence: [{ sid: 'X-1', code: 'maternity', paidType: '고용보험', payrollPause: true, status: 'active', startDate: '2026-09-01', endDate: '2026-11-29' }] } })
    .calcPayroll(REC());
  assert.equal(mat.baseSalaryProrated, 3000000, '출산전후휴가 최초 60일은 유급입니다(근로기준법 제74조④) — 자동으로 빼면 안 됩니다');
  assert.ok(mat.loa.maternity > 0, '출산전후휴가 일수는 알려야 합니다');
});

test('⑥ 휴일근로 8시간은 «하루» 단위 — 휴일 이틀 8시간씩이면 2배 몫이 없다', () => {
  const E = payEnv();
  const two = E.calcPayroll(REC({ legalAllowances: { holidayHours: 16, holidayOver8Hours: 0 } }));
  const hourly = 3000000 / 209;
  assert.equal(two.legal.holiday, Math.floor(16 * hourly * 1.5));
  const one = E.calcPayroll(REC({ legalAllowances: { holidayHours: 10 } }));   // 날짜별 정보가 없으면 하루치
  assert.equal(one.legal.holiday, Math.floor(8 * hourly * 1.5 + 2 * hourly * 2.0));
});

test('⑥ 근태 → 급여는 휴일 시간을 날짜별로 합쳐 8시간 초과를 센다 · 바꾼 시간은 감사기록에', () => {
  const body = stripJs(SRC.slice(SRC.indexOf('function syncOTToPayroll'), SRC.indexOf('function addOTRecord')));
  assert.match(body, /holidayByDate/);
  assert.match(body, /holidayOver8Hours\s*\+=/);
  assert.match(body, /addPayrollAudit\(/, '급여의 시간을 바꾸면서 기록을 안 남깁니다');
});

test('① 지급 끝난 급여대장 달은 저장된 «실제 지급값»을 그대로 — 요율이 바뀌어도 안 바뀐다', () => {
  const E = payEnv();
  const led = REC({ ym: '2026-03', status: 'paid', grossPay: 3100000, totalDeduction: 400000, netPay: 2700000,
    nationalPension: 1, healthInsurance: 2, longTermCare: 3, employmentInsurance: 4, incomeTax: 5, localTax: 6 });
  const c = E.calcPayroll(led);
  assert.equal(c.frozen, 'ledger');
  assert.equal(c.netPay, 2700000);
  assert.equal(c.grossPay, 3100000);
  assert.equal(c.pension, 1);
});

test('① 잠긴 달은 확정 사진(calcSnapshot)을 그대로 / 잠기기 전에는 새로 셈한다', () => {
  const E = payEnv({ locked: ['2026-09'] });
  const snap = E.payrollSnapshotOf(E.calcPayrollFresh(REC()));
  const rec = REC({ status: 'confirmed', calcSnapshot: Object.assign({}, snap, { netPay: 1234567 }) });
  assert.equal(E.calcPayroll(rec).netPay, 1234567);
  assert.equal(E.calcPayroll(rec).frozen, 'snapshot');
  const open = payEnv().calcPayroll(rec);   // 잠금 없음 + 확정(지급 전) → 새로 셈
  assert.notEqual(open.netPay, 1234567);
  assert.ok(!open.frozen);
  assert.doesNotThrow(() => JSON.stringify(snap));
});

test('① 확정할 때 calcSnapshot 을 저장하고, 전월 복사는 «결과» 칸을 베끼지 않는다', () => {
  const code = stripJs(SRC);
  assert.match(code, /calcSnapshot:\s*payrollSnapshotOf\(calcPayrollFresh\(rec\)\)/);
  const cp = code.slice(code.indexOf('function copyPrev'), code.indexOf('function confirmCopy'));
  for (const k of ['nationalPension', 'totalDeduction', 'netPay', 'incomeTaxOverride', 'calcSnapshot'])
    assert.ok(cp.indexOf("'" + k + "'") >= 0, '전월 복사가 ' + k + ' 를 베낍니다 — 새 달이 «앞 달 실제 금액»을 달고 나옵니다');
});

test('⑧ 최저임금은 매월 정기 임금 전부와 견준다 — 기본급 200만 + 직책수당 20만은 위반이 아니다', () => {
  const store = { pay_items: [{ code: 'pos', name: '직책수당', category: 'pay', taxable: true }] };
  const c = payEnv({ store }).calcPayroll(REC({ baseSalary: 2000000, allowances: [{ code: 'pos', amount: 200000 }] }));
  assert.equal(c.minWageWarning, false, '산입범위를 무시하고 기본급만 봅니다');
  const low = payEnv().calcPayroll(REC({ baseSalary: 2000000 }));
  assert.equal(low.minWageWarning, true, '정말 모자라면 경고해야 합니다');
});

test('⑨ 명세서(앱에서 만든 달) = 계산 결과 — 일할 기본급·성과금·공제 항목이 제자리에', () => {
  const store = { pay_items: [{ code: 'absent', name: '결근공제', category: 'deduction' }] };
  const E = payEnv({ store, perf: 300000 });
  const rec = REC({ workDays: 15, allowances: [{ code: 'absent', name: '결근공제', amount: 50000 }] });
  const c = E.calcPayroll(rec), m = E.payslipLines(rec, E.calcPayroll);
  const pay = Object.fromEntries(m.pay), ded = Object.fromEntries(m.ded);
  assert.equal(pay['기본급'], c.baseSalaryProrated, '명세서 기본급이 일할 전 금액입니다');
  assert.equal(pay['상여·성과급'], 300000, '입금 연동 성과금이 명세서에서 빠졌습니다');
  assert.equal(pay['결근공제'], undefined, '공제 항목이 지급란에 «플러스»로 찍혔습니다');
  assert.equal(ded['결근공제'], 50000);
  assert.equal(m.net, c.netPay, '명세서 실지급액과 계산 실지급액이 다릅니다');
});

test('⑨ 명세서에 지급일·계산 방법이 실린다 (근로기준법 제48조②·시행령 제27조의2)', () => {
  const code = stripJs(SRC);
  assert.match(code, /'지급일: '\+\(d\.paidDate/);
  assert.match(code, /'─── 계산 방법 ───'/);
  const E = payEnv();
  const lines = E.payslipMethods(REC({ workDays: 15, legalAllowances: { overtimeHours: 4 } }));
  assert.ok(lines.some(l => /15\/30일/.test(l)), '일할 산식이 없습니다');
  assert.ok(lines.some(l => /연장 4시간/.test(l)), '연장 시간이 없습니다');
});

test('⑦ 일용근로 원천징수 — (일급 − 15만) × 2.7%, 1,000원 미만 소액부징수', () => {
  const ctx = {}; vm.createContext(ctx);
  vm.runInContext(fnSrc('roundKRW') + fnSrc('erpWithholdTax') + fnSrc('calcIrregularTax') + '\nthis.f = calcIrregularTax; this.w = erpWithholdTax;', ctx);
  /* 검사고정-허용: 소득세법 제47조②(일 15만원 공제)·제59조(6%)·제134조③(55% 세액공제)·제86조(1,000원 미만 소액부징수) */
  assert.deepEqual([ctx.f('daily', 200000, 1).incomeTax, ctx.f('daily', 200000, 1).localTax], [1350, 130]);
  assert.equal(ctx.f('daily', 150000, 1).incomeTax, 0);
  assert.equal(ctx.f('daily', 160000, 1).incomeTax, 0, '270원은 소액부징수');
  assert.equal(ctx.f('daily', 600000, 3).incomeTax, 1350 * 3, '여러 날 묶은 금액은 하루치로 나눠 셈한다');
  /* 검사고정-허용: 소득세법 제84조 — 기타소득금액 건별 5만원 이하 과세최저한 */
  assert.equal(ctx.w(100000, 'misc', 8.8).total, 0, '기타소득 10만원(소득금액 4만원)은 과세하지 않습니다');
  assert.ok(ctx.w(200000, 'misc', 8.8).total > 0);
  assert.equal(ctx.w(30000, 'biz').total, 0, '사업소득 소득세 900원은 소액부징수');
});

test('⑩ 급여대장은 «머리줄 이름»으로 읽는다 — 칸이 늘어도 상여·업무분담수당·정산이 제자리에', () => {
  const ctx = {}; vm.createContext(ctx);
  vm.runInContext(fnSrc('payLedgerSheetRecs') + '\nthis.f = payLedgerSheetRecs;', ctx);
  const H1 = ['연번','성명','입.퇴사일','주민등록번호','부양가족 수','비고','기본시급','통상시급','소정 근로시간','월    급','연장근로','','휴일근로','','업무분담수당','성과금','상여금','소  계','지급액','과세임금','공제내역','','','','','','','','','실수령액'];
  const H2 = ['','','','','','','','','','기본급','시간','수당','시간','수당','','','','','','','소득세','지방소득세','국민연금','건강보험','장기요양','고용보험','소득세정산','지방세정산','공제총액',''];
  const row = [1,'가나다','','000000-0000000',3,'메모',10320,14354,209,3000000,2,43062,0,0,100000,50000,70000,0,3263062,3063062,0,0,1,2,3,4,5,6,21,3263041];
  const users = [{ sid: 'X-1', name: '가나다', rrn: '' }];
  const r = ctx.f([['급여대장'], H1, H2, row], '2026-09', users);
  assert.equal(r.recs.length, 1);
  const x = r.recs[0];
  assert.equal(x.empSid, 'X-1');
  assert.equal(x.dependents, 3, '부양가족 수를 비고 칸에서 읽었습니다(옛 칸 번호 결함)');
  assert.equal(x.bonus, 120000, '성과금 + 상여금');
  /* vm 안에서 만든 배열은 바깥 배열과 «다른 것»으로 본다 — 글자로 견준다 */
  assert.equal(JSON.stringify(x.allowances.map(a => [a.name, a.amount])), JSON.stringify([['업무분담수당', 100000]]));
  assert.equal(x.incomeTaxAdj, 5, '소득세정산이 건강보험정산 칸으로 갔습니다');
  assert.equal(x.healthInsuranceAdj, 0);
  assert.equal(x.overtimePay, 43062);
  assert.equal(x.legalAllowances.overtimeHours, 2);
  assert.equal('rrn' in x, false, '주민번호를 기록에 담으면 안 됩니다');
});

test('⑩ 주민번호로 찾은 사람의 이름이 엑셀 이름과 다르면 «어긋남» — 주민번호를 믿지 않는다', () => {
  const ctx = {}; vm.createContext(ctx);
  vm.runInContext(fnSrc('payLedgerSheetRecs') + '\nthis.f = payLedgerSheetRecs;', ctx);
  const H1 = ['연번','성명','주민등록번호','월    급','지급액'], H2 = ['','','','기본급',''];
  const users = [{ sid: 'A', name: '가나다', rrn: '1111111111111' }, { sid: 'B', name: '라마바', rrn: '2222222222222' }];
  /* 엑셀은 «가나다»인데 주민번호는 명부의 라마바 것 — 명부의 주민번호가 바뀐 경우 */
  const r = ctx.f([H1, H2, [1, '가나다', '222222-2222222', 3000000, 3000000]], '2026-09', users);
  assert.equal(JSON.stringify(r.conflicts), JSON.stringify(['가나다']));
  assert.equal(r.recs[0].empSid, 'A', '주민번호를 믿고 남의 사번에 붙였습니다');
  /* 동명이인이면 이름으로도 맞추지 않는다 */
  const r2 = ctx.f([H1, H2, [1, '가나다', '', 1, 1]], '2026-09', users.concat([{ sid: 'C', name: '가나다' }]));
  assert.equal(r2.recs.length, 0);
  assert.equal(JSON.stringify(r2.nomatch), JSON.stringify(['가나다']));
});
