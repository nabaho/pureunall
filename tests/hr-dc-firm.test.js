'use strict';
/* 법인 단위 DC 납입 대조 (2026-10-10) — 출금관리 퇴직연금 «근로자» 몫 vs DC 가입자 임금총액 ÷ 12 (근로자퇴직급여 보장법 제20조①)
   사람별 적립 기록이 없어도 «실제로 나간 돈»으로 법인 전체 부족 여부는 볼 수 있다. 숫자를 지어 넣지 않는다.
   실행: node --test tests/hr-dc-firm.test.js */
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
function env(store){
  const ctx = { Math, Number, String, Date, Array, USERS_SEED: [],
    dbGet: (k, d) => (k in store ? store[k] : d),
    getStaffPension: sid => ({ type: sid === 'P-1' ? 'NONE' : 'DC' }),
    calcPayroll: p => ({ grossPay: p.grossPay }) };
  vm.createContext(ctx);
  vm.runInContext(fnSrc('dcFirmCheck') + '\nthis.f = dcFirmCheck;', ctx);
  return ctx;
}

test('그달 «근로자» 몫만 견준다 — 대표 몫·DC 아닌 사람 임금은 빼고, 그달·전달 두 기준을 함께', () => {
  const store = {
    user_accounts: [{ sid: 'A-1' }, { sid: 'A-2' }, { sid: 'P-1' }],
    finance_expense: [{ category: 'exp-pension', date: '2026-02-25', details: [{ name: '대표(보험사)', amount: 999999 }, { name: '근로자(공단)', amount: 500000 }] }],
    payroll_monthly: [
      { ym: '2026-01', empSid: 'A-1', status: 'paid', grossPay: 3000000 }, { ym: '2026-01', empSid: 'A-2', status: 'paid', grossPay: 3000000 },
      { ym: '2026-02', empSid: 'A-1', status: 'paid', grossPay: 3000000 }, { ym: '2026-02', empSid: 'A-2', status: 'paid', grossPay: 3000000 },
      { ym: '2026-02', empSid: 'P-1', status: 'paid', grossPay: 9000000 }]
  };
  const rows = env(store).f('2026');
  const feb = rows.find(r => r.ym === '2026-02');
  assert.equal(feb.paid, 500000, '대표 몫이 섞였습니다');
  assert.equal(feb.need, 500000, 'DC 가 아닌 사람 임금이 섞였습니다');   // 600만 ÷ 12
  assert.equal(feb.needPrev, 500000);
  const jan = rows.find(r => r.ym === '2026-01');
  assert.equal(jan.noOutflow, true, '급여는 있는데 퇴직연금 출금이 없는 달을 알려야 합니다');
});

test('퇴직연금 화면 월별 누계 탭에 법인 대조 표가 붙는다', () => {
  assert.match(SRC, /var firm = dcFirmCheck\(selYear\);/);
  assert.match(SRC, /firmBox,\s*\n\s*\/\/ 연도 선택 \+ 안내/);
});
