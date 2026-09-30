'use strict';
/* 작성 중 서류 — 입력 화면에서는 «떠 있는 창» (대표 지적 2026-09-30 「작성중 서류보기 누르면 계속 위에 나와서
   편집기능이 계속 아래로 내려간다」 → 목업 A 승인)
   못 박는 것:
     ① 입력 화면(작업 모드)에서 「작성 중 서류 보기」는 위에 펼치지 않고 띄운다 — 문서가 밀리지 않는다
     ② 목록 화면에서는 예전처럼 펼친다
     ③ Esc·바깥·이어서·작업 모드 끝 → 닫힌다 · 버리기 확인 쪽지는 «바깥»이 아니다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');
function 떼기(머리) {
  const i = SRC.indexOf(머리); assert.ok(i > 0, 머리);
  let d = 0, s = false;
  for (let p = i; p < SRC.length; p++) { if (SRC[p] === '{') { d++; s = true; } else if (SRC[p] === '}') { d--; if (s && !d) return SRC.slice(i, p + 1); } }
}
function 반(처음) { const s = new Set(처음 || []); return { add: (c) => s.add(c), remove: (c) => s.delete(c), contains: (c) => s.has(c), s }; }

function 무대(작업중) {
  const 판 = { classList: 반(['hide']), style: {}, contains: () => false, scrollIntoView: () => { 판.밀림 = true; } };
  const 단추 = { contains: () => false, getBoundingClientRect: () => ({ right: 230, bottom: 700, width: 200, height: 34 }) };
  const 듣기 = {};
  const ctx = {
    document: {
      body: { classList: 반(작업중 ? ['rh-work-on'] : []) },
      getElementById: (id) => ({ rhDraftPanel: 판, rhDraftRailBtn: 단추 })[id] || null,
      addEventListener: (t, f) => { 듣기[t] = f; },
    },
    window: { innerWidth: 1600, innerHeight: 900 },
    rhDraftAll: () => [{ id: 'a' }], rhDraftDraw: () => { ctx.그림 = (ctx.그림 || 0) + 1; }, toast: () => {},
  };
  vm.createContext(ctx);
  vm.runInContext(SRC.match(/var _rhFloatBound=false;/)[0] + ['function rhDraftShow(', 'function rhDraftFloatOpen(', 'function rhDraftFloatClose('].map(떼기).join('\n'), ctx);
  return { ctx, 판, 듣기 };
}

test('① 입력 화면에서는 띄운다 — 위에 펼쳐 문서를 밀지 않는다', () => {
  const m = 무대(true);
  vm.runInContext('rhDraftShow()', m.ctx);
  assert.ok(m.판.classList.contains('rh-float'));
  assert.ok(!m.판.classList.contains('hide'));
  assert.ok(!m.판.밀림, '★★ 그 자리로 굴러가면(scrollIntoView) 문서가 밀린 것과 같다');
  assert.equal(m.판.style.left, '240px', '자리가 넉넉하면 기둥 단추 옆에 붙는다');
  assert.equal(m.ctx.그림, 1);
});

test('② 목록 화면에서는 예전처럼 펼친다', () => {
  const m = 무대(false);
  vm.runInContext('rhDraftShow()', m.ctx);
  assert.ok(!m.판.classList.contains('rh-float'));
  assert.ok(m.판.밀림);
});

test('③ Esc·바깥을 누르면 닫힌다 · 안쪽·버리기 쪽지는 바깥이 아니다', () => {
  const m = 무대(true);
  vm.runInContext('rhDraftShow()', m.ctx);
  const 쪽지 = { contains: () => false };
  m.ctx.document.getElementById = ((옛) => (id) => (id === 'kcDelPop' ? 쪽지 : 옛(id)))(m.ctx.document.getElementById);
  m.듣기.mousedown({ target: 쪽지 });
  assert.ok(m.판.classList.contains('rh-float'), '버리기 확인을 누르다 창이 닫히면 버리기가 안 됩니다');
  m.듣기.mousedown({ target: m.판 });
  assert.ok(m.판.classList.contains('rh-float'));
  m.듣기.mousedown({ target: {} });
  assert.ok(!m.판.classList.contains('rh-float'));
  assert.ok(m.판.classList.contains('hide'));
  vm.runInContext('rhDraftShow()', m.ctx);
  m.듣기.keydown({ key: 'Escape' });
  assert.ok(!m.판.classList.contains('rh-float'));
});

test('③ 이어서 누르면 · 작업 모드를 풀면 닫힌다', () => {
  assert.match(떼기('async function rhDraftResume('), /rhDraftFloatClose\(\)/);
  assert.match(떼기('function rhWorkSet('), /rhDraftFloatClose\(\)/);
});

test('① 좁은 창에서는 폭을 지키려 왼쪽으로 당긴다 — 표가 짓눌리지 않게', () => {
  const m = 무대(true);
  m.ctx.window.innerWidth = 800;
  vm.runInContext('rhDraftShow()', m.ctx);
  const 왼 = parseInt(m.판.style.left, 10), 폭 = parseInt(m.판.style.width, 10);
  assert.ok(폭 >= 700, '폭: ' + 폭);
  assert.ok(왼 + 폭 <= 800, '창 밖으로 넘치면 안 된다');
});
