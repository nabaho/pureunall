/* ⚡ 옆줄 그리기는 몰려오면 «끝에 한 번» (대표 지시 2026-10-03 「또 느리게 자꾸 뜬다 근본적으로 해결해라」)
   대표 크롬 실측: 메일 창을 열고 0.4초 사이에 옆줄을 다섯 번 통째로 그렸다(78·24·17·26ms).
   ★ 못 박는 것
     ① 첫 번째는 바로 그린다 — 누른 것은 바로 보인다
     ② 120ms 안에 몰려온 것은 모아 두었다 «끝에 한 번»만 그린다 — 건너뛰지 않는다
     ③ 함수 자신이 묶는다 — 부르는 길(49곳)을 하나하나 막지 않는다
   node --test tests/cards-pcside-burst.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8').split('\r\n').join('\n');

function load() {
  let now = 1000; const q = []; let drawn = [];
  const ctx = { Date: { now: () => now }, setTimeout: (fn, ms) => { q.push([now + ms, fn]); return q.length; } };
  vm.createContext(ctx);
  vm.runInContext([
    SRC.match(/^const PC_SIDE_GAP = \d+;$/m)[0].replace('const', 'var'),
    'var _pcSideAt = 0, _pcSideT = null;',
    cutFn(SRC, 'function pcSideBurst('),
    'function renderPCSide(){ if(pcSideBurst()) return; _drawn.push(Date.now()); }'
  ].join('\n'), ctx);
  ctx._drawn = drawn;
  const tick = ms => { now += ms; q.sort((a, b) => a[0] - b[0]); while (q.length && q[0][0] <= now) q.shift()[1](); };
  return { ctx, drawn, tick, at: v => { now = v; } };
}

test('★★★ ① 첫 번째는 바로 · ② 몰려온 다섯 번은 «두 번»(바로 + 끝에 한 번)', () => {
  const { ctx, drawn, tick } = load();
  ctx.renderPCSide();
  assert.deepEqual(drawn, [1000], '★★★ 첫 번째를 미뤘다 — 누른 것이 늦게 보인다');
  for (let i = 0; i < 4; i++) { tick(20); ctx.renderPCSide(); }
  assert.equal(drawn.length, 1, '★★★ 몰려온 것을 그때마다 다 그렸다');
  tick(200);
  assert.equal(drawn.length, 2, '★★★ 밀린 그리기를 건너뛰었다 — 마지막 자료가 화면에 안 나온다');
  assert.ok(drawn[1] - drawn[0] >= 120, '★ 끝 한 번이 너무 이르다');
});

test('★★ 띄엄띄엄 오면 그때마다 바로 그린다', () => {
  const { ctx, drawn, tick } = load();
  ctx.renderPCSide(); tick(300); ctx.renderPCSide(); tick(300); ctx.renderPCSide();
  assert.equal(drawn.length, 3);
});

test('★★ ③ 함수 자신이 묶는다 — 그리기 맨 앞에서 거른다', () => {
  assert.match(cutFn(SRC, 'function renderPCSide('),
    /^function renderPCSide\(\)\{\s*mbMemoClear\(\);[^\n]*\n\s*if\(typeof pcSideBurst === 'function' && pcSideBurst\(\)\) return;/);
});
