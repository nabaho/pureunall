'use strict';
/* 메일 창 — 자료가 «들어와서» 다시 그리기는 120ms 에 한 번으로 묶는다 (대표 지시 2026-10-03 「1번」)
   「느린 까닭」 남은 뿌리 — 처음 열 때 폴더·분류·규칙·씨앗·부담당·봤음 기록·이알피 업체가
   따로따로 도착하며 그때마다 옆줄·목록을 통째로 다시 그렸다(옆줄 16번).

   지키는 것
   ① 붙어서 온 도착은 «한 번»만 그린다 · 밀린 그리기는 반드시 일어난다
   ② 그릴 때 메일 화면이 아니면 안 그린다
   ③ 도착 자리는 묶개를 쓴다 — 사람이 누른 자리는 «바로» 그린다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { sliceFn } = require('./fnslice.js');

const app = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8').replace(/\r\n/g, '\n');
const strip = (s) => String(s).replace(/\/\*[\s\S]*?\*\//g, ' ');

function box(view) {
  const timers = [];
  const ctx = {
    state: { view: view || 'mail' }, draws: 0,
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
  };
  ctx.renderPCSide = () => {};
  ctx.renderMailPage = () => { ctx.draws++; };
  vm.createContext(ctx);
  vm.runInContext(sliceFn(app, 'function makeBurstRunner('), ctx);
  const i = app.indexOf('const MB_DRAW_GAP');
  const j = app.indexOf('});', app.indexOf('const mbDrawSoon', i)) + 3;
  vm.runInContext(app.slice(i, j).replace(/\bconst /g, 'var '), ctx);
  ctx.flush = () => { const t = timers.splice(0); t.forEach((x) => x.fn()); return t; };
  return ctx;
}

test('★★★ 붙어서 온 도착 열 번은 «한 번»만 그린다 — 밀린 것은 반드시 그린다', () => {
  const c = box();
  for (let i = 0; i < 10; i++) c.mbDrawSoon();
  assert.equal(c.draws, 0, '★ 도착하자마자 그립니다 — 묶지 않습니다');
  const t = c.flush();
  assert.equal(t.length, 1, '★★★ 열 번 도착에 시계를 ' + t.length + '개 겁니다');
  assert.equal(c.draws, 1, '★★★ 밀린 그리기가 안 일어납니다');
  assert.ok(t[0].ms > 16 && t[0].ms <= 250, '★★ 묶는 틈이 한 프레임보다 짧거나 너무 깁니다: ' + t[0].ms + 'ms');
  c.mbDrawSoon(); c.flush();
  assert.equal(c.draws, 2, '★★ 그린 뒤에 온 도착을 안 그립니다');
});

test('★★ 그릴 때 메일 화면이 아니면 안 그린다', () => {
  const c = box('list');
  c.mbDrawSoon(); c.flush();
  assert.equal(c.draws, 0);
});

test('★★★ 도착 자리는 묶개를 쓴다', () => {
  const uses = (name) => strip(sliceFn(app, 'function ' + name + '(')).indexOf('mbDrawSoon()') >= 0;
  ['mbOldStateLoad', 'mbSeedRefresh', 'mbFillNeed', 'mbEnsureFolders', 'mbEnsureBins', 'mbBinRuleMap',
    'mbBizSubsLoad', 'mbSeenLoad', 'mbAutoFill', 'openMailBox']
    .forEach((n) => assert.ok(uses(n), '★★★ ' + n + ' 가 도착할 때마다 바로 다시 그립니다'));
  const i = app.indexOf('ErpMatch.companies=cos;');
  assert.match(app.slice(i, i + 600), /state\.view==='mail'[^\n]*mbDrawSoon\(\)/, '★★ 이알피 업체가 올 때 메일 창을 바로 다시 그립니다');
});

test('★★ 사람이 누른 자리는 «바로» 그린다 — 묶개로 늦추지 않는다', () => {
  ['mbSetDash', 'mbFilter', 'mbOpenMsg', 'mbMoveTo'].forEach((n) => {
    const b = strip(sliceFn(app, 'function ' + n + '('));
    assert.match(b, /renderPCSide\(\); renderMailPage\(\);/, '★★ ' + n + ' 가 바로 안 그립니다');
    assert.doesNotMatch(b, /mbDrawSoon\(\)/, '★★ ' + n + ' 를 묶개로 늦춥니다 — 누른 것이 바로 안 보입니다');
  });
});
