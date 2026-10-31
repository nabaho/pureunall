'use strict';
/* 새 사이트 구성원 쪽 부품 — 서버 사본이 화면 원본과 «한 글자까지» 같다 (2026-10-31)
   ★ 서버 배포에는 js/ 가 안 올라간다 — 사본(functions/site-people/)은 scripts/sync-site-people.js 가 만든다(손으로 고치지 않는다).
   ★ 다르면 화면의 미리보기·「새 사이트에 올리기」와 매달 자동으로 올라가는 쪽이 서로 다르게 그려진다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { 이름, 밖 } = require('../scripts/sync-site-people.js');

const 뿌리 = path.join(__dirname, '..');
const 읽기 = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

test('★ 서버 사본은 화면 원본과 한 글자까지 같다', () => {
  const 사본 = path.join(밖, 이름);
  assert.ok(fs.existsSync(사본), '사본이 없다 — node scripts/sync-site-people.js 를 돌려 주세요');
  assert.ok(읽기(path.join(뿌리, 'js', 이름)) === 읽기(사본),
    '★ functions/site-people/' + 이름 + ' 가 js/ 원본과 다릅니다 — 고칠 곳은 js/ 쪽, 고친 뒤 node scripts/sync-site-people.js');
});

test('사본 폴더에는 그 파일 하나뿐이다 — 낡은 사본이 남아 서버가 다른 판을 쓰지 않게', () => {
  assert.deepEqual(fs.readdirSync(밖), [이름]);
});

test('★ 서버 쪽 지킴이는 사본을 쓴다(js/ 를 가리키면 배포본에서 못 찾는다)', () => {
  const 글 = 읽기(path.join(뿌리, 'functions', 'homepage-newsite.js'));
  assert.match(글, /require\(["']\.\/site-people\/pu-site-people\.js["']\)/);
  assert.doesNotMatch(글, /require\(["']\.\.\/js\//);
});
