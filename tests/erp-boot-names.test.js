/* 🐌 이알피 처음 10초 이름 재기 (대표 지시 2026-10-03 「이알피도 확인」)
   대표 크롬: 첫 화면까지 1.8초 · 멈춤 다섯 번 모두 「아직 이름표가 안 붙은 일」 · 열린 뒤에는 안 멈춤.
   ★ 못 박는 것
     ① 평소에는 함수를 안 감싼다(재는 일 자체가 느리게 만든다) — ?prof=1 이거나 지난번 1초 넘게 멈췄을 때만
     ② 감싸도 10초 뒤 «원래 함수로» 되돌린다 · 결과는 그대로 돌려준다
     ③ 화면 조각(대문자)·h 는 안 건드린다 — preact 가 다른 화면으로 보고 상태를 버린다
     ④ 평소 1초 넘게 멈추면 「다음에 한 번 잰다」를 적어 둔다
   node --test tests/erp-boot-names.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8').split('\r\n').join('\n');
const i = SRC.indexOf('/* ══════ 🐌 처음 10초 «누가» 멈추게 했나');
const BLOCK = SRC.slice(i, SRC.indexOf('\n</script>', i));

function run(search, stored) {
  const timers = [], logs = [], ls = Object.assign({}, stored || {});
  const win = {
    performance: { now: (() => { let t = 0; return () => (t += 1); })() },
    location: { search },
    localStorage: { getItem: k => (k in ls ? ls[k] : null), setItem: (k, v) => { ls[k] = String(v); }, removeItem: k => { delete ls[k]; } },
    PerformanceObserver: function (cb) { win._lt = cb; this.observe = () => {}; },
    setTimeout: fn => timers.push(fn), console: { warn: m => logs.push(m) },
    work: function (x) { return x * 2; }, Comp: function () { return 'vnode'; }, h: function () { return 'h'; }
  };
  win.window = win;
  vm.createContext(win);
  const orig = { work: win.work, Comp: win.Comp, h: win.h };
  vm.runInContext(BLOCK, win);
  return { win, orig, logs, ls, fire: () => timers.forEach(f => f()), lt: ms => win._lt({ getEntries: () => [{ duration: ms }] }) };
}

test('★★★ ① 평소에는 아무 함수도 안 감싼다', () => {
  const c = run('');
  assert.equal(c.win.work, c.orig.work, '★★★ 평소에도 초시계를 단다 — 그 자체로 첫 화면이 느려진다');
});

test('★★★ ② ?prof=1 이면 감싸고, 결과는 그대로, 10초 뒤 되돌린다 · ③ 대문자·h 는 안 건드린다', () => {
  const c = run('?prof=1');
  assert.notEqual(c.win.work, c.orig.work, '★ 재 달라는데 안 감쌌다');
  assert.equal(c.win.work(21), 42, '★★★ 감쌌더니 결과가 달라졌다');
  assert.equal(c.win.Comp, c.orig.Comp, '★★★ 화면 조각을 감쌌다 — 되돌릴 때 preact 가 상태를 버린다');
  assert.equal(c.win.h, c.orig.h);
  c.lt(300); c.fire();
  assert.equal(c.win.work, c.orig.work, '★★★ 10초 뒤 원래 함수로 안 되돌렸다');
  assert.match(c.logs[0], /^🐌 이알피 처음 10초 — 멈춤 300ms/);
});

test('★★ ④ 평소 1초 넘게 멈추면 다음에 한 번 잰다 — 그다음 열 때 감싸고 표시는 지운다', () => {
  const a = run(''); a.lt(700); a.lt(600); a.fire();
  assert.equal(a.ls.erp_prof_next, '1', '★ 멈췄는데 다음에 잴 표시를 안 남겼다');
  assert.match(a.logs[0], /다음에 열 때 한 번 범인 이름을 잽니다/);
  const b = run('', { erp_prof_next: '1' });
  assert.notEqual(b.win.work, b.orig.work, '★ 표시가 있는데 안 쟀다');
  assert.ok(!('erp_prof_next' in b.ls), '★ 표시를 안 지웠다 — 매번 재면 그 자체로 느려진다');
  const q = run(''); q.lt(300); q.fire();
  assert.equal(q.logs.length, 0, '★ 조금 멈춘 것까지 떠든다');
});
