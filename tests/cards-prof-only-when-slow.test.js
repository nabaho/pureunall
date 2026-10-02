'use strict';
/* 함수 초시계는 «멈췄던 다음 한 번»만 단다 (대표 화면 2026-10-02 「계속 나오는데 근본적인 해결 안되나」)

   초시계를 단 함수는 부를 때마다 6배쯤 느려진다(mbWhoKey 66만 번: 그냥 11ms · 초시계 68ms).
   처음 10초 동안 늘 달아 두면 «재는 일 자체»가 첫 화면을 멈추게 하고, 그 멈춤을 다시 알림으로 띄운다.

   지키는 것
   ① 보통 열 때는 초시계를 안 단다 — 멈춤만 가볍게 잰다
   ② 멈췄으면 표를 남기고, 다음에 열 때 «한 번» 재고 표를 지운다
   ③ ?prof=1 이면 그 자리에서 잰다
   ④ 이름 없이 「멈췄다」만 띄우지 않는다 — 다른 알림(저장 폭주 등)은 그대로 띄운다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { sliceFn } = require('./fnslice.js');

const app = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8').replace(/\r\n/g, '\n');
const strip = (s) => String(s).replace(/\/\*[\s\S]*?\*\//g, ' ');

function store(init) {
  const m = Object.assign({}, init || {});
  return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); },
    removeItem: (k) => { delete m[k]; }, _m: m };
}
function box() {
  const ctx = { String, RegExp };
  vm.createContext(ctx);
  vm.runInContext("var CO_PROF_NEXT = 'pucards_prof_next';", ctx);
  vm.runInContext(sliceFn(app, 'function coProfWanted('), ctx);
  return ctx;
}

test('★★★ 보통 열 때는 초시계를 안 단다', () => {
  const c = box();
  assert.equal(c.coProfWanted('?view=mail&sso=1', store()), false, '★★★ 열 때마다 초시계를 답니다 — 첫 화면이 그만큼 느려집니다');
  assert.equal(c.coProfWanted('', null), false);
});

test('★★★ 지난번에 멈췄으면 이번에 «한 번» 재고 표를 지운다', () => {
  const c = box();
  const s = store({ pucards_prof_next: '1' });
  assert.equal(c.coProfWanted('', s), true, '★★★ 멈췄는데도 다음에 원인을 안 잽니다');
  assert.equal(s._m.pucards_prof_next, undefined, '★★ 표를 안 지워 열 때마다 잽니다');
  assert.equal(c.coProfWanted('', s), false);
});

test('★★ ?prof=1 이면 그 자리에서 잰다 · 저장소가 막혀도 멈추지 않는다', () => {
  const c = box();
  assert.equal(c.coProfWanted('?view=mail&prof=1', store()), true);
  assert.equal(c.coProfWanted('?prof=10', store()), false);
  const broken = { getItem() { throw new Error('막힘'); } };
  assert.equal(c.coProfWanted('', broken), false);
});

test('★★★ 진단은 «원할 때만» 초시계를 달고, 멈췄으면 다음을 위해 표를 남긴다', () => {
  const i = app.indexOf('function coWatchStart(');
  const body = strip(app.slice(i, app.indexOf('\nfunction ', i + 10)));
  assert.match(body, /const 잼 = coProfWanted\(location\.search, ls\);/);
  assert.match(body, /if\(잼\)\{\s*try\{\s*profStop = coProfStart\(\);/, '★★★ 원하지 않아도 초시계를 답니다');
  assert.doesNotMatch(body.replace(/if\(잼\)\{\s*try\{\s*profStop = coProfStart\(\);/, ''), /coProfStart\(\)/,
    '★★★ 초시계를 다는 자리가 또 있습니다');
  assert.match(body, /if\(!잼 && s\.blockedMs > 500\)\{\s*try\{\s*ls && ls\.setItem\(CO_PROF_NEXT, '1'\);/,
    '★★ 멈췄는데 다음에 잴 표를 안 남깁니다');
  assert.match(body, /coWatchVerdict\(잼 \? s : Object\.assign\(\{\}, s, \{ blockedMs: 0 \}\)\)/,
    '★★ 이름 없이 「멈췄다」만 띄웁니다 — 고칠 데를 모릅니다');
});

test('★★ 이름 없는 멈춤은 빼도 «저장 폭주»는 그대로 알린다', () => {
  const ctx = { Math, String };
  vm.createContext(ctx);
  vm.runInContext(sliceFn(app, 'function coWatchVerdict('), ctx);
  const s = { writes: 500, busiest: '', parked: 0, pending: 0, renders: 0, builds: 0, blockedMs: 0, secs: 10 };
  const out = Array.prototype.slice.call(ctx.coWatchVerdict(s));
  assert.ok(out.some((x) => /저장을 500번/.test(x)), '★★ 저장 폭주를 안 알립니다');
  assert.ok(!out.some((x) => /멈춰 있었습니다/.test(x)));
});
