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
  vm.runInContext('var DC_BANK_MEMO = /퇴직연금부담금/;\n' + fnSrc('dcBankOutflows') + '\n' + fnSrc('dcFirmCheck') + '\nthis.f = dcFirmCheck;', ctx);
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

test('★ DC 는 자동이체 — 올린 통장 거래내역의 «퇴직연금부담금» 출금을 센다 (출금관리에 안 적은 달도)', () => {
  const pay = ym => [{ ym, empSid: 'A-1', status: 'paid', grossPay: 3000000 }];
  const store = {
    user_accounts: [{ sid: 'A-1' }],
    payroll_monthly: [...pay('2026-05'), ...pay('2026-06'), ...pay('2026-07'), ...pay('2026-08')],
    ledger_batches: [
      { id: 'b1', src: 'bank', rows: [
        { _k: 'k1', type: 'expense', date: '2026-05-25', memo: '퇴직연금부담금', amount: 250000 },
        { _k: 'k2', type: 'expense', date: '2026-05-26', memo: '퇴직연금부담금', amount: 100000 },
        { _k: 'k3', type: 'expense', date: '2026-05-06', memo: '교보', amount: 636000 },
        { _k: 'k9', type: 'expense', date: '2026-07-15', memo: '점심', amount: 9000 }] },
      { id: 'b2', src: 'bank', rows: [{ _k: 'k1', type: 'expense', date: '2026-05-25', memo: '퇴직연금부담금', amount: 250000 }] },
      { id: 'b3', src: 'bank', _deleted: true, rows: [{ _k: 'kx', type: 'expense', date: '2026-08-25', memo: '퇴직연금부담금', amount: 1 }] },
      { id: 'c1', src: 'hana-sms', rows: [{ _k: 'ks', type: 'expense', date: '2026-09-30', memo: '카드', amount: 1 }] }]
  };
  const rows = env(store).f('2026');
  const by = ym => rows.find(r => r.ym === ym);
  assert.equal(by('2026-05').paid, 350000, '겹친 줄은 한 번만 · 대표 몫(교보)은 빼고 · 한 달 두 번 이체는 더한다');
  assert.equal(by('2026-05').src, 'bank');
  assert.equal(by('2026-06').noOutflow, true, '통장이 덮는 달에 출금이 없으면 «출금 없음»');
  assert.equal(by('2026-08').noBank, true, '통장이 7/15 까지면 8월은 «통장 내역 없음» — 안 본 것을 «안 냈다»로 말하지 않는다');
  assert.equal(by('2026-08').noOutflow, false);
});

test('화면에 «통장 내역 없음» 이 따로 보인다', () => {
  assert.match(SRC, /r\.noBank \? '통장 내역 없음'/);
});
