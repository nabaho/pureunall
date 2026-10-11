'use strict';
/* 직원 상태 — 퇴직일 = 마지막 근무일 · 퇴직 예정 · 공용 판정 · 복귀 (2026-10-11 대표 「퇴직일은 마지막근무일. 4 니가 고쳐라」)
   실행: node --test tests/hr-status-rest.test.js */
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
function env(store, today){
  const ctx = { Math, Number, String, Date, Array, Object, JSON, USERS_SEED: [],
    todayYMD: () => today || '2026-10-11',
    dbGet: (k, d) => (k in store ? JSON.parse(JSON.stringify(store[k])) : d),
    dbSet: (k, v) => { store[k] = JSON.parse(JSON.stringify(v)); return true; },
    dbUpsert: (k, rec) => { const l = store[k] || []; const i = l.findIndex(x => x.id === rec.id); if(i >= 0) l[i] = rec; else l.push(rec); store[k] = l; return true; } };
  vm.createContext(ctx);
  vm.runInContext(['getLoaList', 'setLoaList', 'erpEmpStatusAt', 'erpCloseLoaForRetire', 'erpLastWorkDay', 'getLoaStatus', 'loaReconcileStatus'].map(fnSrc).join('\n') +
    '\nthis.st = erpEmpStatusAt; this.rec = loaReconcileStatus;', ctx);
  return ctx;
}

test('공용 판정: 마지막 근무일까지 재직, 다음 날부터 퇴직 · 입사 전은 입사예정 · 승인된 휴직은 휴직', () => {
  const store = { user_accounts: [], leave_of_absence: [{ id: 'l', sid: 'B', startDate: '2026-10-01', endDate: '2026-12-31', status: 'active' }] };
  const E = env(store);
  const r = { sid: 'A', status: 'retired', hireDate: '2023-01-01', retireDate: '2026-08-31', lastWorkDate: '2026-08-31' };
  assert.equal(E.st(r, '2026-08-31'), 'active', '마지막 근무일은 아직 재직');
  assert.equal(E.st(r, '2026-09-01'), 'retired');
  assert.equal(E.st({ sid: 'N', status: 'active', hireDate: '2026-11-01' }, '2026-10-11'), 'scheduled');
  assert.equal(E.st({ sid: 'B', status: 'active', hireDate: '2020-01-01' }, '2026-10-11'), 'leave');
});

test('★ 퇴직 예정(앞날짜 퇴사 처리)은 그날까지 재직, 그날이 지나면 명부를 맞출 때 «퇴직»으로 — 휴직도 닫는다', () => {
  const store = { user_accounts: [{ sid: 'A', status: 'active', retirePending: true, retireDate: '2026-10-20', lastWorkDate: '2026-10-20' }],
    leave_of_absence: [{ id: 'l', sid: 'A', startDate: '2026-10-15', endDate: '2026-12-31', status: 'active' }] };
  assert.equal(env(store, '2026-10-20').rec('2026-10-20'), 1, '그날은 아직 재직(휴직 시작만 반영)');
  assert.notEqual(store.user_accounts[0].status, 'retired');
  env(store, '2026-10-21').rec('2026-10-21');
  assert.equal(store.user_accounts[0].status, 'retired');
  assert.equal(store.user_accounts[0].retirePending, false);
  assert.equal(store.leave_of_absence[0].status, 'ended'); assert.equal(store.leave_of_absence[0].endedDate, '2026-10-20');
});

test('퇴사 처리 창: 퇴직일 한 칸(= 마지막 근무일) · 앞날짜면 퇴직 예정으로 저장', () => {
  assert.match(SRC, /fld\('퇴직일 \* \(마지막 근무일\)'/);
  assert.doesNotMatch(SRC, /fld\('마지막 근무일', inp\(f1\.lastWorkDate/, '따로 받는 마지막 근무일 칸이 남았습니다');
  assert.match(SRC, /retireDate:f1\.retireDate, lastWorkDate:f1\.retireDate/);
  assert.match(SRC, /status: _future \? \(u\.status === 'leave' \? 'leave' : 'active'\) : 'retired', retirePending:_future/);
});

test('직원 수정 창이 퇴직일을 «마지막 근무일 다음 날»로 바꾸지 않는다', () => {
  assert.doesNotMatch(SRC, /마지막 근무일 — 입력 시 퇴직일이 비어있으면 다음 날로 자동 설정/);
  assert.match(SRC, /fld\('퇴직일 \(마지막 근무일\)'/);
});

test('복귀하면 남은 휴직을 닫고 퇴직 예정 표시를 지운다 · 폰 급여 휴직 표시도 공용 판정', () => {
  assert.match(SRC, /status:'active', retirePending:false, retireDate:''/);
  assert.match(SRC, /async function reinstate\(sid\)\{[\s\S]{0,1600}erpCloseLoaForRetire\(sid,/);
  assert.match(SRC, /erpEmpStatusAt\(u, \(rec\.ym \|\| todayYMD\(\)\.slice\(0,7\)\) \+ '-15'\) === 'leave'/);
});
