'use strict';
/* 홈페이지 «올리기»가 새 판 자동 갈아타기에 끊기지 않는다 — 대표 「고쳐라」(2026-11-16)
   ═══════════════════════════════════════════════════════════════════════════
   그날 얼굴 사진 7장을 올리는 30초 사이에 다른 배포가 들어와 js/pu-version.js 가 «손을 30초 놓은 탭»을
   새 판으로 갈아탔다 — 6장째에서 끊겨 사진 기록 1장과 구성원 쪽 갱신이 빠졌다.
   ★ 지키는 것: ① 올리는 세 길(구성원·쪽·자문사 로고)이 확인 창 «올리기» 뒤, 서버에 쓰기 «전»에
     pu:save-state «saving» 을 켜고 끝나면(실패해도) 끈다 ② 겹쳐도 마지막이 끝나야 «saved»
     ③ 다시 알림 간격이 pu-version 이 저절로 놓는 시간보다 짧다 ④ pu-version 이 «saving» 을 막는 상태로 본다.
   실행: node --test tests/home-publish-save-state.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const HOME = fs.readFileSync(path.join(ROOT, 'pu-home.html'), 'utf8');
const VER = fs.readFileSync(path.join(ROOT, 'js', 'pu-version.js'), 'utf8');

/* 부품 덩이: «const 올리는중 = {» 부터 «window.올리는중켜기 = 올리는중켜기;» 까지 */
function 부품() {
  const a = HOME.indexOf('const 올리는중 = {');
  const b = HOME.indexOf('window.올리는중켜기 = 올리는중켜기;', a);
  assert.ok(a >= 0 && b > a, '올리는중 부품을 못 찾았습니다');
  return HOME.slice(a, b + 'window.올리는중켜기 = 올리는중켜기;'.length);
}
function 돌리기() {
  const 받은 = [];
  const 시계들 = [];
  let 지금 = 1000;
  const ctx = {
    Date: { now: () => 지금 },
    Math,
    setInterval: (fn, ms) => { const t = { fn, ms, 멈춤: false }; 시계들.push(t); return t; },
    clearInterval: (t) => { if (t) t.멈춤 = true; },
    CustomEvent: function (name, init) { this.type = name; this.detail = init && init.detail; },
    window: null,
  };
  ctx.window = { dispatchEvent: (e) => { if (e.type === 'pu:save-state') 받은.push(e.detail.state); } };
  vm.createContext(ctx);
  vm.runInContext(부품() + '\nthis.__켜기 = 올리는중켜기; this.__상태 = 올리는중;', ctx);
  return { 켜기: ctx.__켜기, 상태: ctx.__상태, 받은, 시계들, 시간: (ms) => { 지금 += ms; } };
}
/* 함수 몸통 — «async function 이름(» 부터 «window.이름 = 이름;» 까지 */
function 몸통(이름) {
  const a = HOME.indexOf('async function ' + 이름 + '(');
  const b = HOME.indexOf('window.' + 이름 + ' = ' + 이름 + ';', a);
  assert.ok(a >= 0 && b > a, 이름 + ' 를 못 찾았습니다');
  return HOME.slice(a, b);
}

test('켜면 «saving», 끄면 «saved» — 끄기를 두 번 불러도 한 번만 센다', () => {
  const r = 돌리기();
  const 끄기 = r.켜기();
  assert.deepEqual(r.받은, ['saving']);
  끄기(); 끄기();
  assert.deepEqual(r.받은, ['saving', 'saved']);
  assert.equal(r.상태.수, 0, '센 수가 0 아래로 내려가면 안 된다');
});

test('겹쳐 켜면 «마지막 하나»가 끝나야 «saved» 를 보낸다', () => {
  const r = 돌리기();
  const 하나 = r.켜기();
  const 둘 = r.켜기();
  하나();
  assert.ok(!r.받은.includes('saved'), '아직 하나가 올리는 중인데 «saved» 를 보냈다');
  둘();
  assert.equal(r.받은[r.받은.length - 1], 'saved');
});

test('오래 걸리면 다시 알리고(saved→saving), 끝나면 시계를 멈춘다', () => {
  const r = 돌리기();
  const 끄기 = r.켜기();
  assert.equal(r.시계들.length, 1, '다시 알림 시계가 없다');
  r.시계들[0].fn();
  assert.deepEqual(r.받은.slice(-2), ['saved', 'saving']);
  끄기();
  assert.ok(r.시계들[0].멈춤, '끝났는데 시계가 계속 돈다');
});

test('응답이 영영 안 오면 한도 뒤에는 다시 알리기를 멈추고 «saved» 로 놓아 준다', () => {
  const r = 돌리기();
  r.켜기();
  r.시간(r.상태.다시알림한도ms + 1);
  r.시계들[0].fn();
  assert.ok(r.시계들[0].멈춤, '한도가 지났는데 시계가 계속 돈다');
  assert.equal(r.받은[r.받은.length - 1], 'saved',
    '알리기만 멈추면 마지막 «saving» 이 남아 pu-version 이 영영 붙잡힌다(2026-11-16 검토)');
});

/* ★ 실제 pu-version.js 의 받는 쪽과 맞물려 돌린다 — 부품만 보면 «놓아 주는가»를 못 본다(2026-11-16 검토가 짚음).
   받는 쪽 덩이: «var BLOCK_MAX_MS» 부터 pu:save-state 듣기의 끝까지. */
function 맞물려돌리기() {
  const a = VER.indexOf('var BLOCK_MAX_MS');
  const b = VER.indexOf("window.addEventListener('pu:save-state'", a);
  const 끝 = VER.indexOf('\n  });', b);
  assert.ok(a >= 0 && b > a && 끝 > b, 'pu-version.js 의 저장 상태 듣기를 못 찾았습니다');
  const 받는쪽 = VER.slice(a, 끝 + '\n  });'.length);
  const 듣는이 = {};
  const 시계들 = [];
  let 지금 = 1000;
  const ctx = {
    Date: { now: () => 지금 }, Math,
    setInterval: (fn, ms) => { const t = { fn, ms, 멈춤: false }; 시계들.push(t); return t; },
    clearInterval: (t) => { if (t) t.멈춤 = true; },
    CustomEvent: function (name, init) { this.type = name; this.detail = init && init.detail; },
    window: {
      addEventListener: (n, f) => { (듣는이[n] = 듣는이[n] || []).push(f); },
      dispatchEvent: (e) => { (듣는이[e.type] || []).forEach(f => f(e)); },
    },
  };
  vm.createContext(ctx);
  vm.runInContext('var saveBlocked = false; var pendingVersion = null; function scheduleApply() {}\n'
    + 받는쪽 + '\n' + 부품() + '\nthis.__켜기 = 올리는중켜기; this.__상태 = 올리는중;'
    + '\nthis.__막힘 = function () { return saveBlocked; };', ctx);
  return { 켜기: ctx.__켜기, 상태: ctx.__상태, 막힘: ctx.__막힘, 시계들, 시간: (ms) => { 지금 += ms; } };
}

test('맞물림 — 올리는 동안은 한도 안에서 계속 막고, 끝나면 푼다', () => {
  const r = 맞물려돌리기();
  const 끄기 = r.켜기();
  assert.equal(r.막힘(), true, '켰는데 pu-version 이 안 막는다');
  for (let i = 0; i < 4; i++) {           // 다시 알림 몇 번 — 한도 안
    r.시간(r.상태.다시알림ms);
    if (!r.시계들[0].멈춤) r.시계들[0].fn();
  }
  assert.equal(r.막힘(), true, '한도 안인데 pu-version 이 놓아 버렸다 — 올리는 도중 새로고침된다');
  끄기();
  assert.equal(r.막힘(), false, '끝났는데 pu-version 이 계속 붙잡혀 있다');
});

test('맞물림 — 응답이 영영 안 와도 한도가 지나면 pu-version 이 풀린다(교착 없음)', () => {
  const r = 맞물려돌리기();
  r.켜기();                                // 끄기를 끝내 안 부른다(응답이 안 오는 올리기)
  const 번 = Math.ceil(r.상태.다시알림한도ms / r.상태.다시알림ms) + 2;
  for (let i = 0; i < 번; i++) {
    r.시간(r.상태.다시알림ms);
    if (!r.시계들[0].멈춤) r.시계들[0].fn();
  }
  assert.ok(r.시계들[0].멈춤, '한도가 지났는데 다시 알리기가 계속된다');
  assert.equal(r.막힘(), false, '★ 한도가 지났는데 pu-version 이 계속 붙잡혀 있다 — 탭이 영영 새 판으로 못 간다');
});

test('다시 알림 간격이 pu-version 이 저절로 놓는 시간보다 짧다', () => {
  const m = VER.match(/BLOCK_MAX_MS\s*=\s*([0-9*\s]+);/);
  assert.ok(m, 'pu-version.js 의 BLOCK_MAX_MS 를 못 찾았습니다');
  const 놓는시간 = Function('return (' + m[1] + ')')();
  const r = 돌리기();
  assert.ok(r.상태.다시알림ms < 놓는시간, '다시 알리기 전에 pu-version 이 놓아 버린다');
});

test('pu-version 이 «saving» 을 막는 상태로 본다(이름이 어긋나면 아무것도 안 막는다)', () => {
  const m = VER.match(/function isBlockingState\(state\)\s*\{([^}]*)\}/);
  assert.ok(m, 'isBlockingState 를 못 찾았습니다');
  const 막나 = Function('state', m[1]);
  assert.equal(막나('saving'), true);
  assert.equal(막나('saved'), false);
});

for (const [이름, 첫쓰기] of [['publishPeople', '그림올리기('], ['publishPage', '올리기('], ['publishPartner', '올리기(']]) {
  test(이름 + ' — 확인 «올리기» 뒤, 서버에 쓰기 전에 켜고 · 끝나면(실패해도) 끈다', () => {
    const s = 몸통(이름);
    const 확인 = s.indexOf('if (!ok) return;');
    const 켬 = s.indexOf('올림끄기 = 올리는중켜기()');
    const 쓰기 = s.indexOf('await ' + 첫쓰기, 확인);
    assert.ok(확인 >= 0, '확인 창 뒤 갈림이 없다');
    assert.ok(켬 > 확인, '확인 창 «앞»에서 켜면 창이 떠 있는 동안 탭을 붙잡는다');
    assert.ok(쓰기 > 켬, '서버에 쓰기 «전»에 켜야 한다');
    const 끝 = s.lastIndexOf('finally');
    assert.ok(끝 > 쓰기 && /if \(올림끄기\) 올림끄기\(\)/.test(s.slice(끝)), 'finally 에서 끄지 않는다 — 실패하면 계속 붙잡는다');
  });
}
