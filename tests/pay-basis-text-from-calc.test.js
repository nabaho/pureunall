/* 명세서·계약서의 «계산 근거» 글은 계산이 «실제로 쓴» 값에서 만든다 (2026-10-11 검토 A4)
   예전에는 글에 2025년 요율과 «÷209h» 가 박혀 있었다 — 실제 셈은 엔진 연도표(erpPayRates)와
   단시간 비례 시간(erpMonthStdHours)을 쓴다. 근로자에게 나가는 문서(근로기준법 제48조②)에 계산과 다른 숫자가 찍혔다.
   규칙:
   ① 공제 근거의 요율 숫자 = 그 달 erpPayRates 가 엔진에서 꺼낸 값 (엔진 값을 바꾸면 글도 바뀐다)
   ② 통상시급 산식의 시간 = 계산이 나눈 월 소정근로시간 (확정 사진과 안 맞으면 숫자 없는 말)
   ③ 급여대장에서 가져온 달(ledger)은 요율을 찍지 않는다 — 실제 공제액이 기준
   ④ 직접 입력한 공제는 «직접 입력» 으로 — 요율을 붙이지 않는다
   ⑤ 명세서 HTML·화면·계약서·계산 방법 줄에 요율·209 숫자가 다시 박히지 않는다
   ⑥ 글을 만들어도 금액은 그대로다 (calcPayrollFresh 결과에 stdHours 만 더해진다) */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { cutFn } = require('./cut-fn');
const src = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8');

function cutVar(name) {
  const i = src.indexOf('var ' + name + ' = ');
  assert.ok(i >= 0, name + ' 를 못 찾음');
  const open = src[src.indexOf('=', i) + 2];
  const close = open === '{' ? '}' : ']';
  let j = src.indexOf(open, i), d = 0;
  for (; j < src.length; j++) { if (src[j] === open) d++; else if (src[j] === close && --d === 0) break; }
  return src.slice(i, j + 1) + ';';
}
/* 엔진은 «일부러 낯선 값» 으로 — 글이 엔진을 따르는지(상수를 베끼지 않는지)를 본다 */
function box(engine) {
  const ctx = { PuLaborCore: engine ? { insuranceRatesOf: () => engine } : undefined };
  vm.createContext(ctx);
  ['PAYROLL_RATES_2026', 'PENSION_BOUNDS', 'MIN_WAGE_HOURLY'].forEach((n) => vm.runInContext(cutVar(n), ctx));
  ['function erpMonthStdHours(', 'function erpPayRates(', 'function erpPctText(', 'function erpPayStdHoursOf(',
    'function erpOrdinaryWageFormula(', 'function erpPayBasisText('].forEach((h) => vm.runInContext(cutFn(src, h), ctx));
  return ctx;
}
const ODD = { pensionEE: 0.0612, healthEE: 0.0411, longtermRate: 0.1777, empInsEE: 0.0133 };
const calcOf = (o) => Object.assign({ insurableBase: 3000000, pension: 1, healthIns: 1, longCare: 1, empIns: 1,
  ordinaryMonthly: 2196000, stdHours: 183, legal: { ordinaryWage: 12000 }, ratesYear: '2031', ratesFrom: 'engine' }, o || {});

test('① 공제 근거의 요율은 그 달 엔진 값이다 — 상수(예전 값)를 베끼지 않는다', () => {
  const c = box(ODD);
  const r = c.erpPayRates('2031-03');
  const t = c.erpPayBasisText(calcOf(), { ym: '2031-03' }).ded.join('\n');
  [r.pension, r.healthIns, r.longCare, r.empIns].forEach((v) => assert.ok(t.includes(c.erpPctText(v)), c.erpPctText(v) + ' 가 글에 없다\n' + t));
  assert.ok(t.includes(r.pensionWageMax.toLocaleString()), '연금 상한도 그 달 표에서');
});

test('① 요율 글자 모양 — 소수 오차 없이 백분율로', () => {
  const c = box(ODD);
  /* 검사고정-허용: 0.03595 → 3.595% 는 «변환 규칙» 확인이지 요율을 박는 것이 아니다 */
  assert.equal(c.erpPctText(0.03595), '3.595%');
  assert.doesNotMatch(c.erpPctText(0.0475), /0000|9999/);
});

test('② 통상시급 산식의 시간 = 계산이 나눈 시간, 맞지 않으면 숫자 없는 말', () => {
  const c = box(ODD);
  assert.ok(c.erpOrdinaryWageFormula(calcOf()).includes('183'), '계산이 쓴 183시간');
  assert.ok(!/209/.test(c.erpOrdinaryWageFormula(calcOf())), '단시간 근로자에게 209 가 찍히면 안 된다');
  /* 확정 사진의 통상시급이 이 시간과 안 맞으면(명부 시간이 그 뒤 바뀜) 숫자를 안 찍는다 */
  const off = calcOf({ legal: { ordinaryWage: 10507 } });
  assert.doesNotMatch(c.erpOrdinaryWageFormula(off), /\d/);
  assert.doesNotMatch(c.erpOrdinaryWageFormula(calcOf({ stdHours: undefined })), /\d/);
});

test('③ 급여대장에서 가져온 달은 요율을 찍지 않는다', () => {
  const c = box(ODD);
  const t = c.erpPayBasisText(calcOf({ frozen: 'ledger' }), { ym: '2031-03' }).ded.slice(1, 5).join('\n');
  assert.doesNotMatch(t, /%/);
});

test('③ 계산이 쓴 연도와 그 달 연도가 다르면 요율을 찍지 않는다', () => {
  const c = box(ODD);
  const t = c.erpPayBasisText(calcOf({ ratesYear: '2030' }), { ym: '2031-03' }).ded.slice(1, 5).join('\n');
  assert.doesNotMatch(t, /%/);
});

test('④ 직접 입력한 공제에는 요율을 붙이지 않는다', () => {
  const c = box(ODD);
  const t = c.erpPayBasisText(calcOf(), { ym: '2031-03', pensionOverride: 0 }).ded.find((x) => /^국민연금/.test(x));
  assert.doesNotMatch(t, /%/);
  assert.match(t, /직접 입력/);
});

test('최저임금 경고 — 그 해 시급 × 계산이 쓴 시간이 그 경고의 월 금액과 맞을 때만 산식을 찍는다', () => {
  const c = box(ODD);
  const r = c.erpPayRates('2031-03');
  const ok = c.erpPayBasisText(calcOf({ minWageWarning: true, minWageBase: 100, minWageMonthly: Math.round(r.minWageHourly * 183) }), { ym: '2031-03' }).minWage;
  assert.ok(ok.includes(r.minWageHourly.toLocaleString()) && ok.includes('183'));
  assert.ok(!/209/.test(ok));
  const bad = c.erpPayBasisText(calcOf({ minWageWarning: true, minWageBase: 100, minWageMonthly: 1 }), { ym: '2031-03' }).minWage;
  assert.ok(!bad.includes('183'), '맞지 않으면 산식을 빼고 금액만');
});

test('실제 엔진(js/pu-labor-core.js)과도 글이 같은 값을 쓴다', () => {
  const LC = require('../js/pu-labor-core.js');
  const c = box(null); c.PuLaborCore = LC;
  const r = c.erpPayRates('2026-05');
  assert.equal(r.ratesFrom, 'engine');
  const t = c.erpPayBasisText(calcOf({ ratesYear: '2026' }), { ym: '2026-05' }).ded.join('\n');
  assert.ok(t.includes(c.erpPctText(LC.insuranceRatesOf('2026').pensionEE)));
  assert.ok(t.includes(c.erpPctText(LC.insuranceRatesOf('2026').healthEE)));
});

/* 주석을 걷어 낸 «코드» 에서만 본다 — 왜 바꿨는지 적은 주석에는 옛 숫자가 남아 있다 */
const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('⑤ 명세서·화면·계약서 글에 요율·209 숫자가 박혀 있지 않다', () => {
  /* 걸리면 그 자리 앞뒤만 보여 준다(파일 통째를 찍지 않게) */
  const none = (re, why) => { const m = code.match(re); assert.equal(m && m[0], null, why); };
  none(/.{0,60}÷\s*209\s*(h|시간).{0,20}/, '÷209 가 글에 박혀 있다');
  none(/.{0,60}기본급÷209.{0,20}/, '기본급÷209 가 글에 박혀 있다');
  /* 문자열(따옴표 안)만 본다 — 상수 옆 «// 건강보험 3.595%» 같은 설명 주석은 글이 아니다 */
  none(/'[^'\n]*(국민연금|건강보험|장기요양|고용보험)[^'\n]{0,12}× \d+(\.\d+)?%[^'\n]*'/, '공제 근거 요율이 글에 숫자로 박혀 있다');
  none(/.{0,60}시급 10,320원.{0,20}/, '최저임금 시급이 글에 박혀 있다');
});

test('⑤ 명세서 두 곳(HTML·화면)·계산 방법 줄·계약서가 공용 함수를 부른다', () => {
  assert.ok((code.match(/erpPayBasisText\(calc, rec\)/g) || []).length >= 2, '명세서 HTML·화면');
  assert.match(cutFn(src, 'function payslipMethods('), /erpOrdinaryWageFormula\(/);
  assert.match(cutFn(src, 'function EmploymentContractModal('), /erpMonthStdHours\(u\.scheduledHours\)/);
});

test('⑥ 계산 결과에 «나눈 시간» 이 실리고, 확정 사진에도 남는다', () => {
  assert.match(cutFn(src, 'function calcPayrollFresh('), /stdHours\s*:/);
  assert.match(cutFn(src, 'function payrollSnapshotOf('), /'stdHours'/);
});
