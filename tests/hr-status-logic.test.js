'use strict';
/* 직원 상태 로직 (2026-10-10 대표 「(직원) 휴직아니고 퇴사인데 급여관리는 휴직으로 되어 있다 … 반드시 고쳐라」)
   실제로 일어난 일: 퇴사(2026-08-31)했는데 질병휴직 기록(2025-01-01~2026-12-31)이 열린 채라
   명부·급여·휴가 화면이 모두 «휴직»으로 봤다. 퇴사 처리가 휴직 기록을 닫지 않았기 때문이다.
   실행: node --test tests/hr-status-logic.test.js */
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
function env(store, today){
  const ctx = { Math, Number, String, Date, Array, Object, JSON, USERS_SEED: [],
    todayYMD: () => today || '2026-10-10',
    dbGet: (k, d) => (k in store ? JSON.parse(JSON.stringify(store[k])) : d),
    dbSet: (k, v) => { store[k] = JSON.parse(JSON.stringify(v)); return true; },
    dbUpsert: (k, rec) => { const l = store[k] || []; const i = l.findIndex(x => x.id === rec.id); if(i >= 0) l[i] = rec; else l.push(rec); store[k] = l; return true; } };
  vm.createContext(ctx);
  vm.runInContext(['getLoaList', 'setLoaList', 'erpCloseLoaForRetire', 'erpLastWorkDay', 'getLoaStatus', 'loaReconcileStatus', 'payrollLoaDays'].map(fnSrc).join('\n') +
    '\nthis.close = erpCloseLoaForRetire; this.loa = getLoaStatus; this.rec = loaReconcileStatus; this.days = payrollLoaDays;', ctx);
  return ctx;
}
const sick = (o) => Object.assign({ id: 'lv-1', sid: 'A-6', code: 'sick-leave', startDate: '2025-01-01', endDate: '2026-12-31', status: 'active', paidType: '무급', payrollPause: true }, o);

test('★ 퇴사하면 진행 중 휴직은 마지막 근무일에 «종료», 시작 전 휴직은 «취소» — 지우지 않는다', () => {
  const store = { user_accounts: [{ sid: 'A-6', status: 'retired', retireDate: '2026-08-31', lastWorkDate: '2026-08-31' }],
    leave_of_absence: [sick(), sick({ id: 'lv-2', startDate: '2026-11-01', endDate: '2026-11-30' }), sick({ id: 'lv-3', status: 'ended', endedDate: '2025-03-01' }), sick({ id: 'lv-x', sid: 'B-1' })] };
  const n = env(store).close('A-6', '2026-08-31');
  assert.equal(n, 2);
  const by = id => store.leave_of_absence.find(x => x.id === id);
  assert.equal(by('lv-1').status, 'ended'); assert.equal(by('lv-1').endedDate, '2026-08-31');
  assert.equal(by('lv-2').status, 'cancelled');
  assert.equal(by('lv-3').endedDate, '2025-03-01', '이미 끝난 기록은 건드리지 않는다');
  assert.equal(by('lv-x').status, 'active', '남의 기록은 건드리지 않는다');
  assert.equal(store.leave_of_absence.length, 4, '하나도 지우지 않는다');
});

test('★ 휴직 기록이 열려 있어도 퇴직자는 마지막 근무일 «뒤로는» 휴직이 아니다 (명부·급여 표시)', () => {
  const store = { user_accounts: [{ sid: 'A-6', status: 'retired', lastWorkDate: '2026-08-31' }], leave_of_absence: [sick()] };
  const E = env(store);
  assert.equal(E.loa('A-6', '2026-10-10'), null);
  assert.ok(E.loa('A-6', '2026-08-15'), '근무하던 달의 휴직 표시는 남는다');
});

test('★ 급여 무급일은 마지막 근무일에서 자른다 · 승인 안 된(대기·반려) 휴직은 세지 않는다', () => {
  const store = { user_accounts: [{ sid: 'A-6', status: 'retired', lastWorkDate: '2026-08-20' }],
    leave_of_absence: [sick({ startDate: '2026-08-01' }), sick({ id: 'p', sid: 'B-1', status: 'pending', startDate: '2026-08-01' })] };
  const E = env(store);
  assert.equal(E.days('A-6', '2026-08').unpaid, 20);
  assert.equal(E.days('B-1', '2026-08').unpaid, 0);
});

test('명부 맞추기: 대기 중 휴직으로 재직자를 휴직으로 바꾸지 않는다 · 퇴직자는 그대로', () => {
  const store = { user_accounts: [{ sid: 'B-1', status: 'active' }, { sid: 'A-6', status: 'retired' }],
    leave_of_absence: [sick({ id: 'p', sid: 'B-1', status: 'pending', startDate: '2026-10-01' }), sick()] };
  assert.equal(env(store).rec('2026-10-10'), 0);
  assert.equal(store.user_accounts[0].status, 'active');
  assert.equal(store.user_accounts[1].status, 'retired');
});

test('퇴사 처리·환경설정·명단 가져오기 세 길이 모두 휴직 기록을 닫는다', () => {
  assert.match(SRC, /function saveRetire\(data\)\{[\s\S]{0,400}erpCloseLoaForRetire\(data\.sid/);
  assert.match(SRC, /newStatus === 'retired'\)\{\s*\n\s*erpCloseLoaForRetire\(x\.sid/);
  assert.match(SRC, /_retiredNow\.forEach\(function\(x\)\{ erpCloseLoaForRetire\(/);
});

test('휴가관리 휴직 저장은 퇴직자를 휴직으로 되살리지 않는다 · 휴직 종료는 끝난 날(endedDate)을 남긴다', () => {
  assert.match(SRC, /if\(me0\.status === 'retired' \|\| me0\.status === 'scheduled'\) return;/);
  assert.match(SRC, /status:'ended', endDate: it\.endDate \|\| today, endedDate:_endD/);
});
