'use strict';
/* 2021-06-01(5인 이상 전환) 전 입사자 연차 — 대법원 2024. 12. 12. 선고 2023도5476 판결로 전환 (2026-10-10 대표 「모두 다해라」)
   ① 전환 날(LEAVE_RULING_FROM)까지 생긴 연차는 그대로 — 거두지 않는다
   ② 그 뒤는 실제 입사일 기산 · 단위기간이 통째로 전환일 뒤인 것만 · 가산도 실제 입사일부터
   ③ 전환 날 «이번 주기 판결식 몫 − 받은 몫»이 모자라면 그 차이를 보정 부여 — 누구도 법정보다 적게 받지 않는다
   ★ 일수는 근로기준법 제60조 그 자체라 박는다(검사고정-허용).
   실행: node --test tests/hr-2021-ruling.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const R = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(R, 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');
function fnSrc(name){
  const i = SRC.indexOf('\nfunction ' + name + '(');
  assert.ok(i >= 0, name + ' 함수를 못 찾았습니다');
  const j = SRC.indexOf('\nfunction ', i + 10);
  return SRC.slice(i + 1, j < 0 ? undefined : j);
}
function env(todayS){
  const ctx = { Math, Number, String, parseInt, isNaN, Date, dbGet: (k, d) => d, todayYMD: () => todayS || '2026-10-10' };
  vm.createContext(ctx);
  vm.runInContext('var PUREUN_5IN_DATE = "2021-06-01";\n' +
    ['getLeaveStartDate', '_lvYmd', '_lvParse', '_lvAddMonths', '_lvDayBefore', '_lvGrantsFrom', 'erpLeaveGrants', 'calcLeavePromoStage'].map(fnSrc).join('\n') +
    '\nthis.G = erpLeaveGrants; this.promo = calcLeavePromoStage; this.CUT = LEAVE_RULING_FROM;', ctx);
  return ctx;
}
const yearOnly = l => l.filter(g => g.kind === 'year').map(g => [g.date, g.days]);

test('① 전환 날까지는 예전 규칙(2021-06-01 기산) 그대로 — 이미 준 연차를 거두지 않는다', () => {
  const E = env();
  const before = yearOnly(E.G({ hireDate: '2019-07-18' }, E.CUT));
  assert.equal(JSON.stringify(before), JSON.stringify([['2022-06-01', 15], ['2023-06-01', 15], ['2024-06-01', 16], ['2025-06-01', 16], ['2026-06-01', 17]]));
});

test('③ 전환 보정 — 판결식 이번 주기 몫(2026-07-18, 7년 근속 18일)에서 받은 17일을 뺀 1일', () => {
  const E = env();
  const all = E.G({ hireDate: '2019-07-18' }, '2027-12-31');
  const fix = all.filter(g => /전환 보정/.test(g.label));
  assert.equal(fix.length, 1);
  assert.equal(fix[0].date, E.CUT);
  assert.equal(fix[0].days, 1);
  assert.equal(fix[0].expiry, '2027-07-17', '보정분은 판결식 주기의 기한까지 쓴다');
});

test('② 전환 뒤는 실제 입사일 기념일 · 가산도 실제 입사일부터 (2027-07-18 = 8년 18일 · 2028-07-18 = 9년 19일)', () => {
  const E = env();
  const after = yearOnly(E.G({ hireDate: '2019-07-18' }, '2028-12-31')).filter(([d]) => d > E.CUT && !/-10-10$/.test(d));
  assert.equal(JSON.stringify(after), JSON.stringify([['2027-07-18', 18], ['2028-07-18', 19]]));
});

test('2021-06-01 이후 입사자는 아무것도 안 바뀐다', () => {
  const E = env();
  const g = yearOnly(E.G({ hireDate: '2022-03-02' }, '2027-12-31'));
  assert.equal(g[0][0], '2023-03-02');
  assert.ok(E.G({ hireDate: '2022-03-02' }, '2027-12-31').every(x => !/전환 보정/.test(x.label)));
});

test('사용촉진 만료일도 전환 뒤엔 실제 입사일 기념일 전날', () => {
  const p = env('2026-10-11').promo('2019-07-18', 2026);
  const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  assert.equal(ymd(p.expiry), '2027-07-17');
});
