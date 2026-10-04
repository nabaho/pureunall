'use strict';
/* 함수 초시계는 개발자가 ?prof=1 로 요청할 때만 단다 (대표 화면 2026-10-04 「계속 이렇게 나오는데 근본 해결」)

   초시계를 단 함수는 부를 때마다 6배쯤 느려진다(mbWhoKey 66만 번: 그냥 11ms · 초시계 68ms).
   처음 10초 동안 늘 달아 두면 «재는 일 자체»가 첫 화면을 멈추게 하고, 그 멈춤을 다시 알림으로 띄운다.

   지키는 것
   ① 보통 열 때는 관찰기와 초시계를 모두 안 단다
   ② 예전 자동 계측 표가 남아 있어도 지운 뒤 무시한다
   ③ ?prof=1 이면 그 자리에서 잰다 */
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

test('★★★ 지난 자동 계측 표는 지우되 다시 초시계를 달지 않는다', () => {
  const c = box();
  const s = store({ pucards_prof_next: '1' });
  assert.equal(c.coProfWanted('', s), false, '★★★ 옛 표 때문에 일반 화면에 초시계를 답니다');
  assert.equal(s._m.pucards_prof_next, undefined, '★★ 옛 표를 안 지워 다음에도 다시 확인합니다');
  assert.equal(c.coProfWanted('', s), false);
});

test('★★ ?prof=1 이면 그 자리에서 잰다 · 저장소가 막혀도 멈추지 않는다', () => {
  const c = box();
  assert.equal(c.coProfWanted('?view=mail&prof=1', store()), true);
  assert.equal(c.coProfWanted('?prof=10', store()), false);
  const broken = { getItem() { throw new Error('막힘'); } };
  assert.equal(c.coProfWanted('', broken), false);
});

test('★★★ 진단은 ?prof=1 일 때만 관찰기와 초시계를 단다', () => {
  const i = app.indexOf('function coWatchStart(');
  const body = strip(app.slice(i, app.indexOf('\nfunction ', i + 10)));
  assert.match(body, /const 잼 = coProfWanted\(location\.search, ls\);/);
  assert.match(body, /if\(!잼\) return;/, '★★★ 일반 화면에서도 진단을 시작합니다');
  assert.match(body, /try\{\s*profStop = coProfStart\(\);/, '★★ ?prof=1 에서 초시계를 안 답니다');
  assert.doesNotMatch(body, /setItem\(CO_PROF_NEXT/, '★★★ 느림을 감지할 때마다 다음 실행을 자동 계측합니다');
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
