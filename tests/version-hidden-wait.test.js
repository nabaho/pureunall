'use strict';
/* 숨은 탭은 새 판으로 갈아타지 않고 기다린다 (2026-10-12 대표 「폭주원인 찾아서 불필요하게 나가면 중단시켜」)

   ■ 무엇이 있었나
     10/11 하루 배포 107번(10/10 은 44번), 그날 요금 ₩8,458 — 이달 최고. 화면마다 5분마다 새 판을 보고 30초 손을 안 대면
     스스로 새로고침한다. 뒤에 숨은 탭은 «늘 손을 안 대는 중»이라 배포마다 새로 켜지며 자료를 다시 받았다.
   ■ 규칙
     ⓐ 보이는 탭은 예전처럼 손을 놓으면 갈아탄다.
     ⓑ 숨은 탭은 아무리 기다려도 갈아타지 않는다.
     ⓒ 그 탭을 다시 보면, 손을 놓은 뒤(30초) 한 번 갈아탄다.
     ⓓ 6시간 넘게 숨어 있으면 갈아탄다 — 옛 코드가 며칠씩 돌지 않게.
   ※ 글자를 뒤지지 않고 모듈을 실제로 돌린다(시계·문서·서버는 흉내). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'js', 'pu-version.js'), 'utf8');

function makeWorld(hidden) {
  const world = { navigated: null, clock: 0, timers: [], vis: hidden ? 'hidden' : 'visible', docListeners: {} };
  const noop = function () {};
  const el = () => ({ style: {}, setAttribute: noop, addEventListener: noop, appendChild: noop, querySelector: () => null, removeChild: noop, parentNode: null, textContent: '', className: '' });
  const doc = {
    readyState: 'complete', scripts: [{ src: 'https://x.test/js/pu-version.js?v=8' }],
    querySelector: (s) => (/pu-release/.test(s) ? { getAttribute: () => 'OLDSHA000' } : null),
    createElement: el, body: el(),
    get visibilityState() { return world.vis; },
    get hidden() { return world.vis === 'hidden'; },
    addEventListener(t, f) { (world.docListeners[t] = world.docListeners[t] || []).push(f); },
    removeEventListener(t, f) { world.docListeners[t] = (world.docListeners[t] || []).filter((x) => x !== f); }
  };
  const win = {
    PUVersion: undefined, URL, Promise, Math,
    Date: { now: () => 1700000000000 + world.clock },
    location: { href: 'https://x.test/work.html', replace(u) { world.navigated = String(u); } },
    sessionStorage: (function () { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; } }; })(),
    localStorage: (function () { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; } }; })(),
    document: doc,
    addEventListener: noop,
    setTimeout(fn, ms) { world.timers.push({ fn, at: world.clock + (ms || 0) }); return world.timers.length; },
    clearTimeout: noop,
    setInterval: () => 0,
    fetch(u) {
      if (String(u).indexOf('version.json') >= 0) return Promise.resolve({ ok: true, json: () => Promise.resolve({ sha: 'NEWSHA111', shortSha: 'newsha11' }) });
      return Promise.resolve({ ok: true, status: 200 });
    }
  };
  win.window = win;
  world.win = win;
  world.tick = function (ms) {
    const end = world.clock + ms;
    for (;;) {
      const due = world.timers.filter((t) => t.at <= end).sort((a, b) => a.at - b.at)[0];
      if (!due) break;
      world.timers = world.timers.filter((t) => t !== due);
      world.clock = Math.max(world.clock, due.at);
      due.fn();
    }
    world.clock = end;
  };
  world.show = function () { world.vis = 'visible'; (world.docListeners.visibilitychange || []).slice().forEach((f) => f()); };
  return world;
}
const settle = () => new Promise((r) => setImmediate(r));
async function boot(hidden) {
  const w = makeWorld(hidden);
  vm.createContext(w.win);
  vm.runInContext(SRC, w.win);
  await settle(); await settle();
  return w;
}
async function step(w, ms) { w.tick(ms); await settle(); await settle(); await settle(); }

test('ⓐ 보이는 탭은 예전처럼 손을 놓으면 갈아탄다', async () => {
  const w = await boot(false);
  await step(w, 2000); await step(w, 60000);
  assert.ok(w.navigated && w.navigated.indexOf('v=newsha11') > 0, '보이는 탭이 갈아타지 않았다: ' + w.navigated);
});

test('ⓑ 숨은 탭은 아무리 기다려도 갈아타지 않는다 (몇 시간)', async () => {
  const w = await boot(true);
  await step(w, 2000); await step(w, 60000);
  for (let i = 0; i < 8; i++) await step(w, 30 * 60 * 1000);   // 4시간
  assert.equal(w.navigated, null, '숨은 탭이 스스로 새로고침했다 — 배포마다 자료를 다시 받는다');
});

test('ⓒ 그 탭을 다시 보면, 손을 놓은 뒤 한 번 갈아탄다', async () => {
  const w = await boot(true);
  await step(w, 2000); await step(w, 60000);
  assert.equal(w.navigated, null);
  w.show();
  await step(w, 5000);
  assert.equal(w.navigated, null, '돌아오자마자 바로 새로고침하면 보던 사람이 놀란다 — 손을 놓을 때까지 기다린다');
  await step(w, 30000); await step(w, 5000);
  assert.ok(w.navigated && w.navigated.indexOf('v=newsha11') > 0, '돌아온 뒤에도 갈아타지 않았다: ' + w.navigated);
});

test('ⓓ 6시간 넘게 숨어 있으면 갈아탄다 — 옛 코드가 며칠씩 돌지 않게', async () => {
  const w = await boot(true);
  await step(w, 2000);
  for (let i = 0; i < 14; i++) await step(w, 30 * 60 * 1000);  // 7시간
  assert.ok(w.navigated && w.navigated.indexOf('v=newsha11') > 0, '6시간이 넘어도 안 갈아탔다');
});

test('판정 — 숨었고 6시간이 안 됐을 때만 기다린다', () => {
  const i = SRC.indexOf('function shouldWaitHidden(');
  const ctx = {}; vm.createContext(ctx);
  vm.runInContext(SRC.slice(i, SRC.indexOf('\n', i)) + '\nthis.f = shouldWaitHidden;', ctx);
  const H = 6 * 3600e3;
  assert.equal(ctx.f(true, 1000, 1000 + H - 1, H), true);
  assert.equal(ctx.f(true, 1000, 1000 + H, H), false);
  assert.equal(ctx.f(false, 1000, 2000, H), false);
  assert.equal(ctx.f(true, 0, 99999999, H), true, '언제부터인지 모르면 기다린다');
});
