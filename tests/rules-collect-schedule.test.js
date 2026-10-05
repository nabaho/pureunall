/* 모은 자료 — 밀린 메일이 있으면 «스스로» 시작한다 (대표 지시 2026-10-05 「푸른이메일에 취업규칙 더 있는데 왜 이것 밖에 없나 2020년 부터 찾아라」)

   ■ 무엇이 있었나
     이어 달리기(10-05)는 «첫 회차»가 돌아야 시작된다. 첫 회차는 하루 한 번(05:00)이거나 사람이 「지금 더 모으기」를 눌러야 했다.
     그날 오후 이 PC 의 DB 쓰기가 막혀 신호를 못 넣었고, 05:00 은 다음 날이라 — 744통(2020~2023 지난 메일 701)이 그대로 기다렸다.
   ■ 고친 것
     정해진 회차를 «30분마다» 깨운다. 깨어나면 작은 기록(run) 하나만 읽고 —
       밀린 것이 있으면(left > 0 · 모름) 돈다 → 이어 달리기가 이어받는다
       밀린 것이 없으면 하루에 한 번만(마지막 회차에서 23시간 지났을 때) — 새 메일을 보려고
       사흘째 하나도 못 담았으면(zeroStreak ≥ 3 · 고장) 하루에 한 번만 — 고장 난 채 30분마다 13MB 를 읽지 않게
     ⚠ 잠금이 있어 두 회차가 겹치지 않는다 — 이어 달리는 중에 깨어나도 그냥 돌아간다.
   실행: node --test tests/rules-collect-schedule.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const C = require('../functions/rules-collect.js');

const H = 3600e3, NOW = 2e12;
test('밀린 것이 있으면 돈다 · 모르면 돈다 · 기록이 없으면 돈다', () => {
  assert.equal(C.shouldRunScheduled({ at: NOW - H, left: 744 }, NOW), true);
  assert.equal(C.shouldRunScheduled({ at: NOW - H, mails: 8 }, NOW), true, '★ 옛 기록(left 없음)이라 밀린 것을 모르는데 안 돈다');
  assert.equal(C.shouldRunScheduled(null, NOW), true);
});
test('밀린 것이 없으면 하루 한 번만', () => {
  assert.equal(C.shouldRunScheduled({ at: NOW - H, left: 0 }, NOW), false, '★ 할 것이 없는데 30분마다 13MB 를 읽는다');
  assert.equal(C.shouldRunScheduled({ at: NOW - 24 * H, left: 0 }, NOW), true, '새 메일을 하루 한 번은 본다');
});
test('고장(사흘째 0)이면 하루 한 번만 — 밀린 것이 있어도', () => {
  assert.equal(C.shouldRunScheduled({ at: NOW - H, left: 744, zeroStreak: 3 }, NOW), false);
  assert.equal(C.shouldRunScheduled({ at: NOW - 24 * H, left: 744, zeroStreak: 3 }, NOW), true);
});
test('index.js — 30분마다 깨우고, 작은 기록만 읽어 가른다', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8');
  const at = src.indexOf('exports.collectRulesMail =');
  const fn = src.slice(at, src.indexOf('exports.collectRulesMailAsk =', at));
  assert.match(fn, /schedule\("every 30 minutes"\)/, '★ 아직 하루 한 번이다 — 첫 회차가 다음 날까지 기다린다');
  assert.match(fn, /RulesCollect\.shouldRunScheduled\(/);
  assert.match(fn, /library\/run"?\)?\.once|LIB \+ "\/run"/, '작은 기록(run)을 읽어 가르지 않는다');
});
