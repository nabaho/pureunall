'use strict';
/* 서류 보관함 미리보기 — 모든 쪽을 끌어 내려 본다 (대표 지시 2026-10-02
   「미리보기 화면 드레그 내려서 어떻게 되었는지 확인할 수 있게 해라」)
   못 박는 것: ① 첫 장만이 아니라 모든 쪽 ② 칸이 «굴러간다»(넘치면 감추지 않는다) ③ 끌면 내려간다 · 손잡이는 한 번만 */
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

test('① 모든 쪽을 붙인다 — 첫 장만 두지 않는다', () => {
  const f = 떼기('function dsPrevDraw(');
  assert.match(f, /querySelectorAll\('canvas,img,svg'\)/);
  assert.doesNotMatch(f, /querySelector\('canvas,img,svg'\)/, '★ 첫 장만 두면 채운 결과(둘째 쪽부터)를 못 본다');
  assert.match(f, /dsPvDragWire\(img\)/);
});

test('② 미리보기 칸은 굴러간다 — 넘친 쪽을 감추지 않는다', () => {
  const css = SRC.match(/\.ds-pv-img\{[^}]*\}/)[0];
  assert.match(css, /overflow-y:auto/);
  assert.match(css, /max-height:/, '높이 한도는 있어야 정보·단추가 화면 안에 남는다');
});

test('③ 끌면 내려간다 · 살짝 누른 것은 끌기가 아니다 · 문서 손잡이는 한 번만', () => {
  const 듣 = {}; let 붙임 = 0;
  const 칸 = () => { const h = {}; const c = new Set(); return { scrollTop: 100, h, classList: { add: (x) => c.add(x), remove: (x) => c.delete(x), contains: (x) => c.has(x) }, addEventListener: (t, f) => { h[t] = f; } }; };
  const ctx = { document: { addEventListener: (t, f) => { 듣[t] = f; 붙임++; } } };
  vm.createContext(ctx);
  vm.runInContext(SRC.match(/var _dsDrag=null, _dsDragBound=false;/)[0] + 떼기('function dsPvDragWire('), ctx);
  const a = 칸(); ctx.a = a;
  vm.runInContext('dsPvDragWire(a)', ctx);
  a.h.mousedown({ button: 0, clientY: 300 });
  듣.mousemove({ clientY: 299, preventDefault() {} });
  assert.equal(a.scrollTop, 100, '1px 움직임은 끌기가 아니다');
  듣.mousemove({ clientY: 200, preventDefault() {} });
  assert.equal(a.scrollTop, 200, '위로 끌면 아래 쪽이 올라온다');
  듣.mouseup();
  const b = 칸(); ctx.b = b; vm.runInContext('dsPvDragWire(b)', ctx);
  assert.equal(붙임, 2, '★ 다시 그릴 때마다 문서 손잡이가 쌓이면 끌기가 무거워진다');
});
