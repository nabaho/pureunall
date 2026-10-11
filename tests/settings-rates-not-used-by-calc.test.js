/* 환경설정의 최저임금·4대보험 요율·간이세액표 화면은 «계산에 쓰이지 않는다» 고 말한다 — 그리고 확정 사진은
   계산이 «실제로 쓴» 값을 남긴다 (2026-10-11 검토 A5)
   예전: 세 화면에 아무 말이 없어 관리자가 요율을 고치면 급여가 바뀐 줄 알았다. 확정 때 RatesSnapshot 은 그
   «안 쓰이는» 칸(insurance_rates·min_wage·withholding_tax)을 찍었다 — 간이세액표 화면은 withholding_brackets 에 쓰는데.
   규칙:
   ① 세 화면 모두 «계산에 쓰이지 않음» 띠를 단다 (자료는 지우지 않는다)
   ② 그 말이 참이다 — 급여 계산 함수가 그 세 칸을 읽지 않는다 (읽게 되면 띠를 걷어야 한다)
   ③ 확정 사진은 그 달 erpPayRates 값 + 출처(source)·연도를 남기고, 환경설정 칸을 읽지 않는다
   ④ 확정 사진에 undefined 가 없다 (파이어베이스는 undefined 를 거절한다)
   ⑤ 일괄 확정이 «그 달» 을 넘겨 찍는다 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { cutFn } = require('./cut-fn');
const src = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8');
const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const SETTING_KEYS = ['insurance_rates', 'min_wage', 'withholding_brackets', 'withholding_tax'];

test('① 세 화면 모두 «계산에 쓰이지 않음» 띠를 단다', () => {
  ['function MinWageSection(', 'function InsuranceSection(', 'function WithholdingTaxSection('].forEach((h) => {
    assert.match(strip(cutFn(src, h)), /h\(ErpNotUsedByCalcNote\b/, h + ' 에 띠가 없다');
  });
  const i = src.indexOf('var ERP_NOT_USED_BY_CALC_TEXT');
  assert.ok(i >= 0);
  assert.match(src.slice(i, src.indexOf('\n', i)), /계산에는 쓰이지 않습니다/);
  assert.match(cutFn(src, 'function ErpNotUsedByCalcNote('), /ERP_NOT_USED_BY_CALC_TEXT/);
});

test('① 띠를 달아도 자료는 그대로 — 세 화면이 여전히 제 칸을 읽는다', () => {
  assert.match(cutFn(src, 'function MinWageSection('), /dbGet\('min_wage'/);
  assert.match(cutFn(src, 'function InsuranceSection('), /dbGet\('insurance_rates'/);
  assert.match(cutFn(src, 'function WithholdingTaxSection('), /dbGet\('withholding_brackets'/);
});

test('② 그 말이 참이다 — 급여 계산이 환경설정 세 칸을 읽지 않는다', () => {
  ['function erpPayRates(', 'function erpIncomeTax(', 'function calcPayrollFresh(', 'function calcPayroll('].forEach((h) => {
    const b = strip(cutFn(src, h));
    SETTING_KEYS.forEach((k) => assert.ok(!b.includes("'" + k + "'"), h + ' 가 ' + k + ' 를 읽는다 — 그렇다면 «계산에 쓰이지 않음» 띠를 걷어야 한다'));
  });
  /* 안내 글도 «저절로 참조한다» 고 말하지 않는다 */
  assert.doesNotMatch(strip(cutFn(src, 'function InsuranceSection(')), /저절로 참조/);
});

function box() {
  const seen = [];
  const ctx = {
    dbGet: (k, d) => { seen.push(k); return k === 'pay_items' ? [{ code: 'base' }] : d; },
    erpPayRates: (ym) => ({ pension: 0.0612, healthIns: 0.0411, longCare: 0.1777, empIns: 0.0133, empEmpInsExtra: 0.0025,
      empWorkers: 0.007, pensionWageMin: 1, pensionWageMax: 2, minWageHourly: 12345, minWageYear: '2031', year: String(ym).slice(0, 4), ratesFrom: 'engine' }),
    PuSimpleTax: { tables: [{ 시행: '2031-01' }] },
    PuLaborCore: { pickSimpleTaxTable: (T) => T[0] },
  };
  vm.createContext(ctx);
  const i = src.indexOf('var RatesSnapshot = {');
  const j = src.indexOf('\n};', i);
  vm.runInContext(src.slice(i, j + 3) + '\nthis.RatesSnapshot = RatesSnapshot;', ctx);
  return { ctx, seen };
}

test('③ 확정 사진 = 그 달 계산이 쓴 값 + 출처·연도, 환경설정 칸은 안 읽는다', () => {
  const { ctx, seen } = box();
  const s = ctx.RatesSnapshot.capture('2031-03');
  const r = ctx.erpPayRates('2031-03');
  assert.equal(s.source, 'engine-year-table');
  assert.equal(s.year, '2031');
  assert.equal(s.insurance.pension, r.pension);
  assert.equal(s.insurance.healthIns, r.healthIns);
  assert.equal(s.insurance.longCare, r.longCare);
  assert.equal(s.minWage.hourly, r.minWageHourly);
  SETTING_KEYS.forEach((k) => assert.ok(!seen.includes(k), k + ' 를 읽었다'));
});

test('③ 엔진이 없을 때(상수로 셈한 달)는 출처가 그렇다고 적힌다', () => {
  const { ctx } = box();
  const orig = ctx.erpPayRates;
  ctx.erpPayRates = (ym) => Object.assign(orig(ym), { ratesFrom: 'fallback' });
  assert.notEqual(ctx.RatesSnapshot.capture('2031-03').source, 'engine-year-table');
});

test('③ 사진이 없는 기록을 읽어도 환경설정 칸(withholding_tax 등)을 읽지 않는다', () => {
  const { ctx, seen } = box();
  ctx.RatesSnapshot.read({ ym: '2031-03' }, 'withholdingTax');
  ctx.RatesSnapshot.read({ ym: '2031-03' }, 'insurance');
  SETTING_KEYS.forEach((k) => assert.ok(!seen.includes(k), k + ' 를 읽었다'));
});

test('④ 확정 사진에 undefined 가 없다', () => {
  const { ctx } = box();
  const walk = (o, p) => Object.keys(o).forEach((k) => {
    assert.notEqual(o[k], undefined, p + k + ' 가 undefined');
    if (o[k] && typeof o[k] === 'object') walk(o[k], p + k + '.');
  });
  walk(ctx.RatesSnapshot.capture('2031-03'), '');
});

test('⑤ 일괄 확정이 그 달을 넘겨 찍는다', () => {
  const b = strip(cutFn(src, 'function PayrollLedger('));
  assert.match(b, /RatesSnapshot\.capture\(\s*[^)\s]+\s*\)/, '빈 capture() — 어느 달 요율인지 모른다');
  assert.doesNotMatch(b, /RatesSnapshot\.capture\(\s*\)/);
});
