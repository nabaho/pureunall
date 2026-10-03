/* ⏱ 기업정보함 여는 길 — 단계별 시각 (대표 2026-09-30 「로그인 할 경우 계속 느려지고 있다」)
   10초 진단은 «멈춤»을 잰다 — 대표 화면은 멈춤 0ms 였다. 느린 것은 «기다림»이라 단계마다 시각을 찍는다.
   ★ 못 박는 것
     ① 로그인 확인 · 사본으로 먼저 그림 · 명함 다 옴(바뀐 것만/통째로) · 이알피 옴 — 네 자리에 찍힌다
     ② 명함과 이알피가 다 오면 «한 줄»로 한 번만 말한다 · 안 오면 30초 뒤라도 말한다
     ③ 🐌 줄은 이름을 «글자»로 편다 — 배열로 찍으면 콘솔이 (5) [{…}] 로 접는다
   node --test tests/cards-boot-marks.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8').split('\r\n').join('\n');

test('★★★ ① 네 자리에 시각이 찍힌다', () => {
  assert.match(SRC, /bootMark\('auth'\);\n\s*myEmail=/, '★ 로그인 확인 시각이 없다');
  assert.match(SRC, /bootMark\('seed'\);\n\s*_cardSeedUsed = true;/, '★ 사본으로 그린 시각이 없다');
  assert.match(SRC, /bootMark\('items', _partial \? '바뀐 것만' : '통째로'\);/, '★ 명함이 다 온 시각이 없다');
  assert.match(SRC, /ErpMatch\.ready=true; bootMark\('erp'\);/, '★ 이알피가 온 시각이 없다');
});

test('★★★ ② 명함·이알피가 다 오면 한 줄로 «한 번만» · 30초 안전줄', () => {
  const logs = [], timers = [];
  let now = 0;
  const ctx = { window: {}, console: { log: m => logs.push(m) }, setTimeout: (fn, ms) => timers.push([fn, ms]),
    performance: { now: () => now, getEntriesByType: () => [{ domContentLoadedEventEnd: 450 }] } };
  vm.createContext(ctx);
  vm.runInContext(cutFn(SRC, 'function bootMark(') + '\n' + cutFn(SRC, 'function bootReport('), ctx);
  now = 1200; ctx.bootMark('auth');
  assert.equal(timers[0][1], 30000, '★ 안 오면 영영 아무 말이 없다');
  now = 1300; ctx.bootMark('seed');
  now = 2100; ctx.bootMark('erp');
  assert.equal(logs.length, 0, '★ 명함이 오기 전에 말했다');
  now = 3800; ctx.bootMark('items', '바뀐 것만');
  ctx.bootMark('items', '통째로');
  assert.equal(logs.length, 1, '★ 두 번 말했다');
  assert.equal(logs[0], '⏱ 기업정보함 여는 길 — 페이지 0.5초 · 로그인 확인 1.2초 · 사본으로 먼저 그림 1.3초 · 명함 다 옴 3.8초(바뀐 것만) · 이알피 옴 2.1초');
  timers[0][0]();
  assert.equal(logs.length, 1, '★ 이미 말했는데 30초 뒤 또 말했다');
});

test('★★ ③ 🐌 줄은 이름을 글자로 편다', () => {
  assert.match(cutFn(SRC, 'function coWatchStart('), /'   🐌 오래 걸린 곳\(제 안에서 쓴 시간\): ' \+ hot\.map\(/);
});
