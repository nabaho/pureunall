'use strict';
/* 🤖 취업규칙 매일 정리 — 서버가 쓰는 셈 사본이 화면 원본과 «한 글자까지» 같다 (2026-10-31, 설계 §14-5)
   ★ 서버 배포에는 js/ 가 안 올라간다 — 사본(functions/rules-daily-core/)은 scripts/sync-rules-daily-core.js 가 만든다(손으로 고치지 않는다).
   ★ 다르면 화면의 🧹 정리하기와 서버의 자동 확정이 «다른 회사»를 고른다.
   ★ 옮길 것 목록은 고정 목록이 아니라 lib-daily.js 에서 require 를 따라간 결과와 같아야 한다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { 옮길것, 따라가기, 시작, 원본폴더 } = require('../scripts/sync-rules-daily-core.js');

const 뿌리 = path.join(__dirname, '..');
const 사본폴더 = path.join(뿌리, 'functions', 'rules-daily-core');
const 읽기 = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

test('★ 옮길 것 = lib-daily.js 에서 require 를 따라간 모든 파일(빠짐없이) — 🧹 정리하기의 셈(lib-tidy)이 들어 있다', () => {
  assert.equal(시작, 'lib-daily.js');
  assert.deepEqual([...옮길것].sort(), 따라가기(원본폴더, 시작).sort(), '고정 목록이 따라간 결과와 다릅니다 — node scripts/sync-rules-daily-core.js');
  ['lib-tidy.js', 'lib-order.js', 'lib-topics.js'].forEach((f) => assert.ok(옮길것.includes(f), f + ' 가 빠졌다'));
});

test('★ 서버 사본은 화면 원본과 한 글자까지 같다', () => {
  옮길것.forEach((이름) => {
    const 사본 = path.join(사본폴더, 이름);
    assert.ok(fs.existsSync(사본), 이름 + ' 사본이 없다 — node scripts/sync-rules-daily-core.js 를 돌려 주세요');
    assert.ok(읽기(path.join(원본폴더, 이름)) === 읽기(사본),
      '★ functions/rules-daily-core/' + 이름 + ' 가 js/rules-v2/ 원본과 다릅니다 — 고칠 곳은 js/ 쪽, 고친 뒤 node scripts/sync-rules-daily-core.js');
  });
});

test('사본 폴더에는 «옮길 것» 말고 다른 파일이 없다 · 사본 안에서 require 가 모두 풀린다', () => {
  assert.deepEqual(fs.readdirSync(사본폴더).sort(), [...옮길것].sort());
  assert.deepEqual(따라가기(사본폴더, 시작).sort(), [...옮길것].sort());
  const D = require('../functions/rules-daily-core/lib-daily.js');
  assert.equal(typeof D.plan, 'function');
  assert.equal(typeof D.summary, 'function');
});
