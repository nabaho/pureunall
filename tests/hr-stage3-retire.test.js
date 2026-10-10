'use strict';
/* 인사관리 3단계 — 퇴직 (대표 지시 2026-10-10 「모두 다해라」 · 「직원 전원 DC형」)
   ═══════════════════════════════════════════════════════════════════════════
   퇴직금 셈이 네 벌(퇴사 화면 · 퇴직금 계산 · 정산 탭 · 다시 계산 단추)이었고 평균임금이 틀렸다.
     ① 3개월을 «달» 단위로 잘라 첫 달이 빠지고 월말에 3월이 빠짐 ② 상여를 그 달 받은 만큼 ③ 공제를 더함
     ④ 휴직 기간을 안 뺌 ⑤ DC 자동 적립이 empSid 를 안 봐 한 번도 안 돎 ⑥ DC 가입자에게 법정 퇴직금을 또 잡음
   ★ 날수·비율은 근로기준법 제2조·시행령 제2조, 근로자퇴직급여 보장법 제8조·제20조 그 자체라 박는다(검사고정-허용).
   실행: node --test tests/hr-stage3-retire.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripJs } = require('./strip-comments.js');

const R = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(R, 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');
function fnSrc(name){
  const i = SRC.indexOf('\nfunction ' + name + '(');
  assert.ok(i >= 0, name + ' 함수를 못 찾았습니다 — 이름이 바뀌었다면 이 검사도 함께 고치십시오');
  const j = SRC.indexOf('\nfunction ', i + 10);
  return SRC.slice(i + 1, j < 0 ? undefined : j);
}
function between(a, b){ const i = SRC.indexOf(a), j = SRC.indexOf(b, i); assert.ok(i >= 0 && j > i); return SRC.slice(i, j); }

function env(opt){
  opt = opt || {};
  const store = Object.assign({ pay_items: [], user_accounts: [], leave_of_absence: [], payroll_monthly: [], dc_contributions: [] }, opt.store || {});
  const saved = {};
  const ctx = { console, Math, Number, String, parseInt, parseFloat, isFinite, isNaN, JSON, Object, Array, Date,
    dbGet: (k, d) => (k in store ? store[k] : d), isPayrollLocked: () => false,
    calcPerfBonus: () => ({ total: 0, items: [] }), USERS_SEED: [], PAY_ITEM_SEED: [],
    getStaffPension: sid => ({ type: (opt.pension || {})[sid] || 'NONE', startDate: '' }),
    getPensionPolicy: () => ({ contributionRate: 1 / 12, autoOnConfirm: true }),
    getDCContributions: () => store.dc_contributions, setDCContributions: l => { saved.dc = l; } };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(R, 'js', 'pu-labor-core.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(R, 'js', 'pu-simpletax.js'), 'utf8'), ctx);
  vm.runInContext(between('var PAYROLL_RATES_2026 = {', '// ============ 보상휴가제') +
    '\nfunction getLoaList(){ return dbGet("leave_of_absence", []); }\n' +
    ['_awYmd', '_awParse', '_awDays', 'calcAverageWage', 'calcOrdinaryDailyWage', 'calcLegalSeverance', 'autoAccrueDCFromPayroll'].map(fnSrc).join('\n') +
    '\nthis.avg = calcAverageWage; this.sev = calcLegalSeverance; this.dc = autoAccrueDCFromPayroll;', ctx);
  ctx.saved = saved;
  return ctx;
}
/* 급여대장에서 가져온 «지급 끝난» 달 */
const led = (ym, o) => Object.assign({ id: 'pay-X-1-' + ym, empSid: 'X-1', ym, status: 'paid', baseSalary: 3000000, bonus: 0, unusedLeavePay: 0,
  grossPay: 3000000, totalDeduction: 300000, netPay: 2700000, nationalPension: 1, healthInsurance: 1, longTermCare: 1,
  employmentInsurance: 1, incomeTax: 1, localTax: 1 }, o || {});
const MONTHS = ym0 => ['2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05'].map(ym => led(ym));

test('① 기간은 마지막 근무일부터 «정확히 3개월» — 5/31 이면 3/1~5/31, 92일 (3월이 빠지지 않는다)', () => {
  const E = env({ store: { payroll_monthly: MONTHS() } });
  const a = E.avg('X-1', '2026-06-01', { lastWorkDate: '2026-05-31' });
  assert.equal(a.start, '2026-03-01');
  assert.equal(a.days, 92);                              // 검사고정-허용: 3·4·5월 달력 일수
  assert.equal(a.wage3m, 9000000);
  assert.equal(Math.floor(a.dailyAvg), Math.floor(9000000 / 92));
});

test('① 달 중간 퇴직 — 걸친 달은 날수만큼 (2/16~5/15, 89일)', () => {
  const E = env({ store: { payroll_monthly: MONTHS() } });
  const a = E.avg('X-1', '2026-05-16', { lastWorkDate: '2026-05-15' });
  assert.equal(a.start, '2026-02-16');
  assert.equal(a.days, 13 + 31 + 30 + 15);
  const want = 3000000 * 13 / 28 + 3000000 + 3000000 + 3000000 * 15 / 31;
  assert.ok(Math.abs(a.wage3m - want) <= 1, '걸친 달을 날수만큼 넣지 않았습니다');
});

test('② 상여·연차수당은 12개월분 × 3/12 — 그 달 받은 만큼 통째로 넣지 않는다', () => {
  const ms = MONTHS(); ms[2] = led('2026-01', { bonus: 1200000, grossPay: 4200000 });   // 1월 상여 120만
  const E = env({ store: { payroll_monthly: ms } });
  const a = E.avg('X-1', '2026-06-01', { lastWorkDate: '2026-05-31' });
  assert.equal(a.bonusAdd, 300000);                     // 검사고정-허용: 120만 × 3/12
  const inPeriod = MONTHS(); inPeriod[5] = led('2026-04', { bonus: 1200000, grossPay: 4200000 });   // 기간 «안»의 상여도
  const b = env({ store: { payroll_monthly: inPeriod } }).avg('X-1', '2026-06-01', { lastWorkDate: '2026-05-31' });
  assert.equal(b.wage3m, 9000000, '기간 안에 받은 상여를 그 달 임금에 통째로 넣었습니다');
  assert.equal(b.bonusAdd, 300000);
});

test('④ 휴직 기간은 기간과 임금에서 뺀다 (시행령 제2조①)', () => {
  const store = { payroll_monthly: MONTHS(), leave_of_absence: [{ sid: 'X-1', code: 'parental-leave', payrollPause: true, paidType: '고용보험', status: 'ended', startDate: '2026-04-01', endDate: '2026-04-30' }] };
  const a = env({ store }).avg('X-1', '2026-06-01', { lastWorkDate: '2026-05-31' });
  assert.equal(a.excludedDays, 30);
  assert.equal(a.days, 62);
  assert.equal(a.wage3m, 6000000);
});

test('기록이 없는 달은 앞 달로 어림하고 «어림»이라고 알린다 — 0 으로 두지 않는다', () => {
  const ms = MONTHS().filter(p => p.ym !== '2026-05');
  const a = env({ store: { payroll_monthly: ms } }).avg('X-1', '2026-06-01', { lastWorkDate: '2026-05-31' });
  assert.equal(JSON.stringify(a.estimated), JSON.stringify(['2026-05']));
  assert.equal(a.wage3m, 9000000);
});

test('③ 공제 항목(결근공제)을 «더하지» 않는다', () => {
  const store = { pay_items: [{ code: 'absent', name: '결근공제', category: 'deduction' }],
    payroll_monthly: ['2026-03', '2026-04', '2026-05'].map(ym => ({ id: 'p' + ym, empSid: 'X-1', ym, status: 'confirmed', baseSalary: 3000000, dependents: 1,
      allowances: ym === '2026-04' ? [{ code: 'absent', amount: 100000 }] : [], legalAllowances: {} })) };
  const a = env({ store }).avg('X-1', '2026-06-01', { lastWorkDate: '2026-05-31' });
  assert.equal(a.wage3m, 9000000 - 100000);
});

test('퇴직금 = 1일 평균임금 × 30 × 재직일수 ÷ 365 · 정확히 1년(365일)이면 대상', () => {
  const E = env({ store: { payroll_monthly: MONTHS() } });
  const one = E.sev('X-1', '2025-06-01', '2026-06-01', { lastWorkDate: '2026-05-31' });
  assert.equal(one.eligible, true, '정확히 1년 다녔는데 «1년 미만»으로 봤습니다');
  assert.equal(one.workDays, 365);
  assert.equal(one.severance, Math.floor(one.dailyApplied * 30 * 365 / 365));
  const short = E.sev('X-1', '2025-06-02', '2026-06-01', { lastWorkDate: '2026-05-31' });
  assert.equal(short.eligible, false);
  assert.equal(one.due, '2026-06-15', '지급 기한은 퇴직일부터 14일');   // 검사고정-허용: 근로기준법 제36조
});

test('⑥ DC형 가입자에게는 법정 퇴직금을 잡지 않는다 — 이중 지급', () => {
  const E = env({ store: { payroll_monthly: MONTHS() }, pension: { 'X-1': 'DC' } });
  const r = E.sev('X-1', '2024-01-01', '2026-06-01', { lastWorkDate: '2026-05-31' });
  assert.equal(r.eligible, false);
  assert.equal(r.dc, true);
  assert.equal(r.severance, undefined);
});

test('통상임금이 평균임금보다 크면 통상임금 — 퇴직소득세 어림도 함께', () => {
  const E = env({ store: { payroll_monthly: MONTHS() } });
  const r = E.sev('X-1', '2020-06-01', '2026-06-01', { lastWorkDate: '2026-05-31' });
  assert.ok(r.dailyApplied >= r.ordinaryDailyWage);
  assert.ok(r.incomeTax != null && r.incomeTax >= 0, '퇴직소득세 어림이 없습니다');
});

test('⑤ DC 자동 적립은 급여 기록의 empSid 를 본다 · 지급총액(세전) 1/12', () => {
  const E = env({ pension: { 'X-1': 'DC' } });
  const rec = { id: 'p', empSid: 'X-1', ym: '2026-09', status: 'confirmed', baseSalary: 3000000, dependents: 1, nonTaxableMeal: 200000, allowances: [], legalAllowances: {} };
  assert.equal(E.dc(rec), true, 'empSid 만 있는 기록을 건너뛰었습니다 — 예전 결함(한 번도 안 돎)');
  assert.equal(E.saved.dc[0].amount, Math.round(3200000 / 12));
  assert.equal(E.saved.dc[0].sid, 'X-1');
});

test('네 군데(퇴사 화면·계산 창·정산 탭·다시 계산)가 모두 calcLegalSeverance 한 곳을 부른다', () => {
  const code = stripJs(SRC);
  const settle = code.slice(code.indexOf('function openSettle(u){'), code.indexOf('function openSettle(u){') + 3000);
  assert.match(settle, /calcLegalSeverance\(/);
  assert.doesNotMatch(settle, /sorted\.length \* 30/, '정산 탭이 옛 식(개월수×30)을 씁니다');
  const rc = code.slice(code.indexOf('function retireRecalc('), code.indexOf('function retireRecalc(') + 1500);
  assert.match(rc, /calcLegalSeverance\(/);
  assert.doesNotMatch(rc, /sorted\.length \* 30/);
  assert.match(code, /calcLegalSeverance\(u\.sid, u\.hireDate, f1\.retireDate, \{ lastWorkDate:/);
});

test('수동 조정란의 «0» 은 0 이다 / 예상 퇴직금(DC 필요 적립액)은 세전 지급총액으로', () => {
  const code = stripJs(SRC);
  assert.doesNotMatch(code, /parseInt\(settleModal\.severancePayOverride\) \|\|/);
  const lw = code.slice(code.indexOf('function calcLifetimeWage('), code.indexOf('function calcLifetimeWage(') + 900);
  assert.match(lw, /payslipLines\(p, calcPayroll\)\.gross/, '명세서 지급합계(세전)로 세야 합니다');
  assert.doesNotMatch(lw, /\.net\b/, '실지급액(세후)으로 셉니다');
});
