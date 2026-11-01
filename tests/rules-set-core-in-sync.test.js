'use strict';
/* 기업규정집 분류 — 서버가 쓰는 셈 사본이 화면 원본과 «한 글자까지» 같다 (2026-11-01)
   ★ 서버 배포에는 js/ 가 안 올라간다 — 사본(functions/rules-set-core/)은 scripts/sync-rules-set-core.js 가 만든다(손으로 고치지 않는다).
   ★ 다르면 서버가 찍는 분류(doc.set)와 화면의 이름 짐작이 어긋나 «같은 서류가 두 분류에» 보인다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { 원본, 사본 } = require('../scripts/sync-rules-set-core.js');

const 읽기 = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

test('★ 서버 사본은 화면 원본과 한 글자까지 같다', () => {
  assert.ok(fs.existsSync(사본), '사본이 없다 — node scripts/sync-rules-set-core.js 를 돌려 주세요');
  assert.ok(읽기(원본) === 읽기(사본), '★ functions/rules-set-core/lib-set.js 가 js/rules-v2/lib-set.js 와 다릅니다 — 고칠 곳은 js/ 쪽, 고친 뒤 node scripts/sync-rules-set-core.js');
});

test('사본은 서버에서 그대로 불러 쓸 수 있다(require)', () => {
  const S = require('../functions/rules-set-core/lib-set.js');
  assert.equal(typeof S.setOfName, 'function');
  assert.equal(S.setOfName('노사협의회규정.hwp'), '노사협의회');
});

test('서버가 불러 쓰는 자리(rules-collect·rules-collect-pick)가 사본을 가리킨다 — js/ 를 가리키면 배포에서 없어진다', () => {
  ['rules-collect.js'].forEach((f) => {
    const src = 읽기(require('node:path').join(__dirname, '..', 'functions', f));
    assert.match(src, /require\(['"]\.\/rules-set-core\/lib-set(\.js)?['"]\)/, f + ' 가 분류 사본을 안 쓴다');
    assert.doesNotMatch(src, /require\(['"][^'"]*js\/rules-v2/, f + ' 가 js/ 를 부른다 — 서버 배포에는 js/ 가 없다');
  });
});
