/* 성과급 몫은 «사번»으로 맞춘다 — 이름은 옛 자료 호환일 뿐 (2026-10-11 검토 A6)
   성과관리 화면(calcEmpPerf)만 동명이인을 막았고, 급여에 실제로 붙는 calcPerfBonus·erpPerfBreakdown·_perfShareMatch 는
   이름이 같으면 사번이 달라도 맞췄다 → 퇴직자 몫이 같은 이름의 재직자 급여에 붙어 돈이 두 번 나갈 수 있었다.
   규칙: ① 사번이 맞으면 맞다 ② 몫에 «다른 사번»이 있으면 이름이 같아도 아니다 ③ 이름이 명부에 둘 이상이면 이름으로 안 맞춘다
   ④ 이름으로 맞추는 것은 «사번이 없는 몫» 또는 «사번 자리에 이름이 든 옛 몫»뿐 ⑤ 세 곳이 모두 이 함수를 쓴다. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const src = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8');
function cutFn(h) { const i = src.indexOf(h); assert.ok(i >= 0, h + ' 를 못 찾음'); let j = src.indexOf('{', i), d = 0;
  for (; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}' && --d === 0) break; } return src.slice(i, j + 1); }
function box(users) {
  const ctx = { window: {}, dbGet: (k, d) => (k === 'user_accounts' ? users : k === 'user_dir' ? [] : d) };
  vm.createContext(ctx);
  vm.runInContext(cutFn('function erpPerfShareIsMine('), ctx);
  return ctx;
}
const U1 = [{ sid: 'A-001', name: '홍길동', status: 'active' }, { sid: 'A-002', name: '김철수', status: 'active' }];
const DUP = U1.concat([{ sid: 'T-001', name: '홍길동', status: 'retired' }]);   // 퇴직자와 이름이 같다

test('사번이 맞으면 맞다', () => {
  assert.equal(box(U1).erpPerfShareIsMine({ sid: 'A-001', name: '홍길동' }, 'A-001', '홍길동'), true);
});

test('몫에 다른 사번이 있으면 이름이 같아도 아니다 — 동명이인 퇴직자 몫이 재직자에게 안 붙는다', () => {
  const c = box(DUP);
  assert.equal(c.erpPerfShareIsMine({ sid: 'T-001', name: '홍길동', amount: 100000 }, 'A-001', '홍길동'), false);
  assert.equal(c.erpPerfShareIsMine({ sid: 'A-001', name: '홍길동', amount: 100000 }, 'A-001', '홍길동'), true);
});

test('이름이 명부에 둘 이상이면 «사번 없는 몫»도 이름으로 안 맞춘다', () => {
  assert.equal(box(DUP).erpPerfShareIsMine({ name: '홍길동' }, 'A-001', '홍길동'), false);
});

test('이름이 하나뿐일 때만 옛 자료(사번 없는 몫·사번 자리에 이름)를 이름으로 맞춘다', () => {
  const c = box(U1);
  assert.equal(c.erpPerfShareIsMine({ name: '홍길동' }, 'A-001', '홍길동'), true, '사번 없는 옛 몫');
  assert.equal(c.erpPerfShareIsMine({ sid: '홍길동' }, 'A-001', '홍길동'), true, '사번 자리에 이름이 든 옛 몫');
  assert.equal(c.erpPerfShareIsMine({ sid: '김철수' }, 'A-001', '홍길동'), false, '다른 사람 이름');
});

test('빈 값은 맞지 않는다', () => {
  const c = box(U1);
  assert.equal(c.erpPerfShareIsMine(null, 'A-001', '홍길동'), false);
  assert.equal(c.erpPerfShareIsMine({ sid: 'A-001' }, '', '홍길동'), false);
  assert.equal(c.erpPerfShareIsMine({ name: '' }, 'A-001', ''), false);
});

test('급여에 붙는 세 자리가 모두 이 함수를 쓴다 — 날것 이름 비교가 남아 있지 않다', () => {
  ['function calcPerfBonus(', 'function erpPerfBreakdown(', 'function _perfShareMatch('].forEach((h) => {
    const b = cutFn(h);
    assert.match(b, /erpPerfShareIsMine\(/, h + ' 가 공용 함수를 써야 한다');
    assert.doesNotMatch(b, /p\.name\s*===\s*empName/, h + ' 에 날것 이름 비교가 남았다');
  });
});
