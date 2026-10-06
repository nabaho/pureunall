'use strict';
/* 근로자명부 — 노무사는 P·T, 직원은 A·T (대표 지시 2026-10-06
   「이알피에서 퇴직한사람이 p 2명밖에 없나 노무사인경우 p t 같이 나오고 직원도 at 각각 확인가능하게」)

   T- 는 예전 사번 체계의 퇴직자들이다. 사번만 보고 가르면 노무사·직원 어느 쪽에도 안 들어가
   「퇴직 + 노무사」가 P 두 명뿐으로 보였다. T- 는 직책(title)으로 가른다.
   ⚠ 대표노무사(P-001, 관리자)는 명부에서 «노무사»다 — isLawyerByUser(관리자 제외 잣대)를 쓰면 직원으로 간다. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { stripJs } = require('./strip-comments.js');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8');
function cutFn(name) {
  const at = SRC.indexOf('function ' + name + '(u){');
  assert.ok(at >= 0, name + ' 가 없습니다');
  let d = 0;
  for (let i = SRC.indexOf('{', at); i < SRC.length; i++) {
    if (SRC[i] === '{') d++; else if (SRC[i] === '}') { d--; if (!d) return SRC.slice(at, i + 1); }
  }
  throw new Error(name);
}
const ctx = {}; vm.createContext(ctx); vm.runInContext(cutFn('roleOf'), ctx);
const roleOf = ctx.roleOf;

test('P 는 노무사, A 는 직원 — 직책과 상관없이', () => {
  assert.equal(roleOf({ sid: 'P-001', title: '대표노무사', role: 'admin' }), 'lawyer', '대표노무사가 노무사에서 빠졌습니다');
  assert.equal(roleOf({ sid: 'P-004', title: '노무사' }), 'lawyer');
  assert.equal(roleOf({ sid: 'A-001', title: '사무장' }), 'staff');
  assert.equal(roleOf({ sid: 'A-009', title: '노무사' }), 'staff', 'A 사번은 직원 쪽 사번 체계다');
});

test('T 는 직책으로 — 노무사면 노무사, 아니면 직원', () => {
  assert.equal(roleOf({ sid: 'T-002', title: '노무사' }), 'lawyer');
  assert.equal(roleOf({ sid: 'T-001', title: '직원' }), 'staff');
  assert.equal(roleOf({ sid: 'T-099', title: '' }), 'staff', '직책이 비면 직원 쪽으로 둔다(노무사로 부풀리지 않는다)');
});

test('명부의 거르기·개수·딱지가 같은 가르개를 쓴다', () => {
  const js = stripJs(SRC);
  assert.match(js, /if\(roleTab === 'lawyer' && roleOf\(u\) !== 'lawyer'\) return false;/);
  assert.match(js, /if\(roleTab === 'staff'  && roleOf\(u\) !== 'staff'\) return false;/);
  assert.match(js, /lawyerCount\s*=\s*users\.filter\(function\(u\)\{return effStatus\(u\)==='active' && roleOf\(u\)==='lawyer';\}\)/);
  assert.match(js, /var isLawyer = roleOf\(u\) === 'lawyer';/);
  /* 사번 앞글자만 보던 옛 거르기가 되살아나면 T 가 다시 사라진다 */
  assert.ok(!/roleTab === 'lawyer' && !\(u\.sid\|\|''\)\.startsWith\('P-'\)/.test(js), 'P- 만 보는 옛 거르기가 남아 있습니다');
  assert.match(SRC, /노무사 \(P·T\)/);
  assert.match(SRC, /직원 \(A·T\)/);
});
