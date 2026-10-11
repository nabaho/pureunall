/* 명세서 연차표·연차 사용촉진 안내 — 동명이인에게 남의 연차를 싣지 않는다 (2026-10-11 검토 A7)
   leaveLedgerWithIds 는 «이름이 하나뿐일 때만» 사번을 붙인다 → 사번 없는 줄은 동명이인이라 못 붙인 줄일 수 있다.
   그런데 명세서(HTML·화면)는 사번 없는 줄을 이름으로 맞춰 동명이인 «둘 모두»에게 남의 연차를 실었고,
   촉진 안내는 만료일을 구할 때 이름 첫 건(퇴직한 동명이인일 수 있다)의 입사일을 썼다.
   규칙 (erpPerfShareIsMine 과 같은 잣대):
   ① 사번이 있는 줄은 사번만 본다
   ② 사번 없는 줄은 명부(재직·퇴직 전부)에 그 이름이 하나뿐이고 그 사람이 나일 때만
   ③ 동명이인의 사번 없는 줄은 누구의 명세서에도 안 실린다
   ④ 촉진 안내는 위에서 찾은 «그 사람»의 입사일로 만료일을 낸다 · 부르는 곳은 사번을 넘긴다 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { cutFn } = require('./cut-fn');
const src = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8');
const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

function box(users, ledger) {
  const ctx = { USERS_SEED: [], dbGet: (k, d) => (k === 'user_accounts' ? users : k === 'leave_ledger' ? ledger : k === 'policy_leave' ? {} : k === 'user_dir' ? [] : d) };
  vm.createContext(ctx);
  vm.runInContext(cutFn(src, 'function erpLeaveLedgerRowIsMine(') + '\n' + cutFn(src, 'function getLeavePromoNotice('), ctx);
  return ctx;
}
const ACT = { sid: 'A-001', name: '홍길동', status: 'active' };
const RET = { sid: 'T-001', name: '홍길동', status: 'retired', retireDate: '2025-01-31' };
const OTHER = { sid: 'A-002', name: '김철수', status: 'active' };

test('① 사번이 있는 줄은 사번만 본다', () => {
  const c = box([ACT, RET, OTHER], []);
  assert.equal(c.erpLeaveLedgerRowIsMine({ sid: 'A-001', name: '홍길동' }, 'A-001', '홍길동'), true);
  assert.equal(c.erpLeaveLedgerRowIsMine({ sid: 'T-001', name: '홍길동' }, 'A-001', '홍길동'), false);
});

test('② 사번 없는 줄은 이름이 명부에 하나뿐일 때만', () => {
  const c = box([ACT, OTHER], []);
  assert.equal(c.erpLeaveLedgerRowIsMine({ name: '홍길동' }, 'A-001', '홍길동'), true);
  assert.equal(c.erpLeaveLedgerRowIsMine({ name: '김철수' }, 'A-001', '홍길동'), false);
});

test('③ 동명이인(퇴직자 포함)의 사번 없는 줄은 누구에게도 안 실린다', () => {
  const c = box([ACT, RET, OTHER], []);
  assert.equal(c.erpLeaveLedgerRowIsMine({ name: '홍길동' }, 'A-001', '홍길동'), false);
  assert.equal(c.erpLeaveLedgerRowIsMine({ name: '홍길동' }, 'T-001', '홍길동'), false);
});

test('③ 명세서 두 곳(HTML·화면)이 이 함수를 쓴다 — 날것 이름 비교가 남지 않았다', () => {
  const S = strip(src);
  const uses = S.match(/dbGet\('leave_ledger',\[\]\)\|\|\[\]\)\.filter\(function\(x\)\{[^}]*\}/g) || [];
  assert.ok(uses.length >= 2, '명세서 연차표 두 곳을 못 찾았다');
  uses.forEach((u) => {
    assert.match(u, /erpLeaveLedgerRowIsMine\(x, u\.sid, u\.name\)/);
    assert.doesNotMatch(u, /x\.name ?=== ?u\.name/);
  });
});

/* 촉진 안내 — 오늘 기준 «만료 6개월 안» 이 되도록 입사일을 고른다 (기념일이 두 달 뒤) */
function hireMonthsAhead(months, yearsAgo) {
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const d = new Date(t.getFullYear() - yearsAgo, t.getMonth() + months, 15);
  const p = (n) => (n < 10 ? '0' : '') + n;
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}
function expiryOf(hire) {
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const hd = new Date(hire);
  let c = new Date(t.getFullYear(), hd.getMonth(), hd.getDate());
  if (c.getTime() <= t.getTime()) c = new Date(t.getFullYear() + 1, hd.getMonth(), hd.getDate());
  c.setDate(c.getDate() - 1);
  const p = (n) => (n < 10 ? '0' : '') + n;
  return c.getFullYear() + '-' + p(c.getMonth() + 1) + '-' + p(c.getDate());
}
const Y = new Date().getFullYear();

test('④ 촉진 안내의 만료일은 «그 사람»의 입사일 — 이름이 같은 퇴직자 것이 아니다', () => {
  const act = Object.assign({}, ACT, { hireDate: hireMonthsAhead(2, 3) });
  const ret = Object.assign({}, RET, { hireDate: hireMonthsAhead(4, 5) });
  const c = box([ret, act, OTHER], [{ sid: 'A-001', name: '홍길동', year: Y, remain: 5 }]);
  const n = c.getLeavePromoNotice('홍길동', 'A-001');
  assert.ok(n, '안내가 나와야 한다');
  assert.equal(n.expiryStr, expiryOf(act.hireDate));
  assert.notEqual(n.expiryStr, expiryOf(ret.hireDate));
});

test('④ 사번 없는 대장 줄 + 퇴직한 동명이인 → 안내를 안 적는다', () => {
  const act = Object.assign({}, ACT, { hireDate: hireMonthsAhead(2, 3) });
  const ret = Object.assign({}, RET, { hireDate: hireMonthsAhead(2, 5) });
  const c = box([ret, act, OTHER], [{ name: '홍길동', year: Y, remain: 5 }]);
  assert.equal(c.getLeavePromoNotice('홍길동', 'A-001'), null);
});

test('④ 동명이인이 없으면 사번 없는 옛 줄로도 안내가 나온다', () => {
  const act = Object.assign({}, ACT, { hireDate: hireMonthsAhead(2, 3) });
  const c = box([act, OTHER], [{ name: '홍길동', year: Y, remain: 5 }]);
  assert.ok(c.getLeavePromoNotice('홍길동', 'A-001'));
});

test('④ 촉진 안내를 부르는 곳은 모두 사번을 넘긴다', () => {
  const S = strip(src).replace(/function getLeavePromoNotice\(/, '');
  const calls = S.match(/getLeavePromoNotice\([^)]*\)/g) || [];
  assert.ok(calls.length >= 3);
  calls.forEach((k) => assert.match(k, /,\s*[A-Za-z_$][\w$.]*sid\)/, '사번 없이 부른다: ' + k));
  assert.doesNotMatch(strip(cutFn(src, 'function getLeavePromoNotice(')), /users\[j\]\.name ?=== ?empName/);
});
