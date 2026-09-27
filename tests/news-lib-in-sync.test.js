'use strict';
/* 서버의 편지 짓개 사본(functions/news-lib/)이 화면 원본(js/)과 «한 글자까지» 같은가
   (2026-09-27 금요일 자동 준비 — functions/news-friday.js)

   ⚠⚠ 다르면 금요일에 서버가 지은 편지와 대표님이 화면에서 보신 편지가 달라진다.
     고칠 곳은 늘 js/ 쪽이다. 고친 뒤:  node scripts/sync-news-lib.js
     그리고 서버 함수를 다시 올린다: weeklyNewsletterPrepare · weeklyNewsletterSend */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { 옮길것 } = require('../scripts/sync-news-lib.js');

const 뿌리 = path.join(__dirname, '..');
/* 줄끝만 맞춰 견준다 — 윈도우 작업트리는 CRLF, CI 는 LF 일 수 있다 */
const 읽기 = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

test('★★★ 서버 사본이 화면 원본과 같다 — 다르면 금요일 편지가 화면과 다르다', () => {
  assert.ok(옮길것.length >= 3, '옮길 목록이 줄었다');
  옮길것.forEach(function (이름) {
    const 원본 = path.join(뿌리, 'js', 이름);
    const 사본 = path.join(뿌리, 'functions', 'news-lib', 이름);
    assert.ok(fs.existsSync(사본), '사본이 없다: functions/news-lib/' + 이름
      + ' — node scripts/sync-news-lib.js 를 돌려 주세요');
    assert.ok(읽기(원본) === 읽기(사본), '★★★ functions/news-lib/' + 이름 + ' 이 js/' + 이름
      + ' 과 다릅니다.\n   고칠 곳은 js/ 쪽입니다. 고친 뒤  node scripts/sync-news-lib.js  를 돌리고\n'
      + '   서버 함수(weeklyNewsletterPrepare · weeklyNewsletterSend)를 다시 올려 주세요.');
  });
});

test('★ 짓개가 서로 부르는 것이 사본 안에 다 있다 — 하나라도 빠지면 서버에서 못 불러온다', () => {
  const tpl = 읽기(path.join(뿌리, 'js', 'pu-news-tpl.js'));
  const 부름 = (tpl.match(/require\('\.\/([^']+)'\)/g) || []).map((s) => s.slice(11, -2));
  assert.ok(부름.length >= 1, 'tpl 이 부르는 것을 못 찾았다 — 검사가 헛돈다');
  부름.forEach(function (이름) {
    assert.ok(옮길것.indexOf(이름) >= 0, '★ tpl 이 ' + 이름 + ' 을 부르는데 사본 목록에 없다');
  });
  /* 실제로 불러 본다 */
  const T = require('../functions/news-lib/pu-news-tpl.js');
  assert.strictEqual(typeof T.편지짓기, 'function', '서버 사본에서 편지짓기를 못 불렀다');
});
