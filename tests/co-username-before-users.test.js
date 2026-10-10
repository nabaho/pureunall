/* 업체관리: 담당자 이름이 빈 입금이 하나만 있어도 화면이 통째로 멎던 것 (2026-10-10)
   CompanyManagement 안의 userName 은 위쪽 «주담당 폴백»(입금의 managerName 이 빌 때)에서
   var users 가 채워지기 «전»에 불린다 — 함수 선언만 끌어올려지고 값은 undefined 였다.
   이 검사는 «users 를 만들기 전에 불러도 직원 명부를 스스로 읽는다»는 규칙을 본다. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const src = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8');

function cutFn(s, h) { const i = s.indexOf(h); assert.ok(i >= 0, h + ' 를 못 찾음'); let j = s.indexOf('{', i), d = 0;
  for (; j < s.length; j++) { if (s[j] === '{') d++; else if (s[j] === '}' && --d === 0) break; } return s.slice(i, j + 1); }

test('업체관리 userName 은 users 가 아직 비어 있어도 멎지 않는다', () => {
  const cm = cutFn(src, 'function CompanyManagement(');
  const un = cutFn(cm, 'function userName(');
  const ctx = { getAssignableUsers: () => [{ sid: 'A-001', name: '홍길동' }] };
  vm.createContext(ctx);
  // users 를 만들기 «전» 상태 그대로: var users 는 선언만 되고 값은 undefined
  vm.runInContext('var users; ' + un, ctx);
  assert.equal(ctx.userName('A-001'), '홍길동');
  assert.equal(ctx.userName('Z-999'), '-');
});
