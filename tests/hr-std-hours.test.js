'use strict';
/* 월 소정근로시간 — 단시간 근로자의 통상시급 (2026-10-10 인사관리)
   1일 7시간 근로자가 209시간으로 나뉘어 시급이 9,676원으로 보였다(급여대장: 183시간 · 11,050원).
   ★ 숫자는 급여대장과 같은 셈(209 × 1일 시간 ÷ 8)이라 박는다(검사고정-허용).
   실행: node --test tests/hr-std-hours.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');
function fnSrc(name){
  const i = SRC.indexOf('\nfunction ' + name + '(');
  assert.ok(i >= 0, name + ' 함수를 못 찾았습니다');
  const j = SRC.indexOf('\nfunction ', i + 10);
  return SRC.slice(i + 1, j < 0 ? undefined : j);
}
const ctx = { Math, Number, parseFloat };
vm.createContext(ctx);
vm.runInContext(fnSrc('erpMonthStdHours') + fnSrc('calcLegalAllowances') + '\nthis.H = erpMonthStdHours; this.L = calcLegalAllowances;', ctx);

test('월 소정근로시간: 8시간 209 · 7시간 183 · 4시간 105 · 주 15시간 미만은 주휴 없음', () => {
  assert.equal(ctx.H(8), 209);   // 검사고정-허용: 법정 셈
  assert.equal(ctx.H(undefined), 209, '비어 있으면 통상근로자');
  assert.equal(ctx.H(7), 183);   // 검사고정-허용: 급여대장과 같은 값
  assert.equal(ctx.H(4), 105);   // 검사고정-허용: 급여대장 단시간 근로자 소정시간
  assert.equal(ctx.H(2), 43, '주 10시간 — 주휴 없음');   // 검사고정-허용
});

test('★ 1일 7시간 근로자의 통상시급은 월급 ÷ 183 — 209 로 나누지 않는다', () => {
  const r = ctx.L({ legalAllowances: {} }, 2022180, ctx.H(7));
  assert.equal(r.ordinaryWage, 11050);   // 검사고정-허용: 급여대장 통상시급
  assert.equal(ctx.L({ legalAllowances: {} }, 2022180).ordinaryWage, Math.round(2022180 / 209), '셋째 값이 없으면 예전대로 209');
});

test('급여 계산이 그 사람의 1일 소정근로시간을 넘긴다 · 최저임금 비교도 같은 시간', () => {
  assert.match(SRC, /calcLegalAllowances\(rec, ordinaryMonthly, erpMonthStdHours\(_empH\)\)/);
  assert.match(SRC, /minWageHourly \* erpMonthStdHours\(_schedH\)/);
  assert.match(SRC, /ordinaryMonthly \/ erpMonthStdHours\(hrs\) \* hrs/);
});
