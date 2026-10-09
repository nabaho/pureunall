'use strict';
/* 포털 기업정보함 타일에는 «숫자를 달지 않는다» (대표 지시 2026-10-09 「숫자 안보이게 정리해달라」)

   ■ 지난 일 — 2026-10-04 「추천대로」로 📥 연락처 정리의 «할 일» 수를 호박색 배지로 달았다
     (연락처배지달기 · .nl-warn.cn-todo · 기업정보함이 pucards/config/mailNewCount 에 수를 적음).
     10/9 대표가 타일의 「20」을 보고 «안 보이게» 정리하라고 했다 → 배지와 그 수를 적던 길을 함께 걷었다.

   ■ 지키는 것
     ① 포털이 기업정보함 타일에 숫자를 달지 않는다(그리는 함수·부르는 자리·색 규칙 모두 없다)
     ② 기업정보함은 그 수를 서버에 «더 적지 않는다» — 읽는 곳이 없는데 적기만 하면 헛쓰기다
     ③ 할 일 수 자체(기업정보함 안 · 이 기기 localStorage)는 그대로 — 화면 안 숫자까지 지우라는 말이 아니다
     ④ 뉴스레터 ⚠ 경고는 그대로 — 그것은 «경고»이고 이번 지시 밖이다
     ⑤ ?cnt=1 로 오면 연락처 정리를 여는 길은 남긴다(즐겨찾기·다른 앱이 쓸 수 있다) */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripComments } = require('./strip-comments.js');
const { sliceFn } = require('./fnslice.js');

const R = path.join(__dirname, '..');
const 포털원문 = fs.readFileSync(path.join(R, 'enter.html'), 'utf8');
const 포털 = stripComments(포털원문).replace(/\r\n/g, '\n');
const 명함원문 = fs.readFileSync(path.join(R, 'pu-cards.html'), 'utf8');
const 명함 = stripComments(명함원문).replace(/\r\n/g, '\n');

test('★★★ ① 포털이 기업정보함 타일에 숫자를 달지 않는다', () => {
  assert.ok(포털.indexOf('연락처배지달기') < 0, '★★★ 연락처 배지를 그리거나 부르는 자리가 남아 있습니다');
  assert.ok(포털.indexOf('mailNewCount') < 0, '★★★ 포털이 할 일 수를 읽습니다 — 다시 숫자를 달려는 것입니다');
  assert.ok(포털.indexOf('cn-todo') < 0, '★★ 할 일 배지 색 규칙이 남아 있습니다');
  /* 기업정보함 타일을 찾아 무언가를 붙이는 다른 길도 없어야 한다 */
  const i = 포털.indexOf('a.tile[data-key="cards"]');
  assert.equal(i, -1, '★★ 포털이 기업정보함 타일을 따로 찾아 손댑니다 — 무엇을 붙이는지 보십시오');
});

test('★★ ② 기업정보함은 그 수를 서버에 더 적지 않는다 — 읽는 곳이 없으면 헛쓰기다', () => {
  assert.ok(명함.indexOf('mailNewCount') < 0, '★★ 아무도 안 읽는 자리에 수를 적습니다');
  assert.ok(!/function mnewCntStore\(/.test(명함), '★★ 서버에 적는 함수가 남아 있습니다');
});

test('★★ ③ 할 일 수 자체는 그대로 센다 — 화면 안의 수까지 지우라는 말이 아니다', () => {
  const fn = sliceFn(명함원문, 'function mnewCount(');
  assert.match(fn, /localStorage\.setItem\(MNEW_CNT_LS/, '★★ 이 기기의 할 일 수를 안 적습니다 — 기업정보함 안 칸이 비게 됩니다');
  assert.match(fn, /return n;/);
});

test('★ ④ 뉴스레터 ⚠ 경고는 그대로 — 이번 지시 밖이다', () => {
  assert.match(포털, /hideEmptyRows\(\);\s*뉴스레터경고달기\(\);/, '★ 뉴스레터 경고까지 걷었습니다');
});

/* ══════ 기업정보함 쪽 — ?cnt=1 로 오면 그 화면을 연다 ══════ */

/* 선언을 그대로 돌린 뒤 이름을 돌려받는다 — 괄호로 감싸면 «식»이 되어 이름이 안 생긴다 */
const cntFromUrl = vm.runInNewContext(sliceFn(명함원문, 'function cntFromUrl(') + '\ncntFromUrl');

test('★★★ ?cnt=1 을 알아본다 — 포털 배지가 이 길로 온다', () => {
  ['?cnt=1', '?sso=1&cnt=1', '?cnt=1&x=2'].forEach(s =>
    assert.equal(cntFromUrl(s), true, '못 알아봅니다: ' + s));
  ['', '?sso=1', '?cnt=0', '?cnt=11', '?xcnt=1', '?cnt=1x'].forEach(s =>
    assert.equal(cntFromUrl(s), false, '★ 아무 주소나 받습니다: ' + s));
});

test('★★★ 그 길로 오면 «연락처 정리»를 연다 — 메일 문일 때는 안 가로챈다', () => {
  const i = 명함.indexOf('cntFromUrl()');
  assert.ok(i > 0, '★★★ 주소를 읽어도 아무 일이 안 납니다 — 부르는 자리가 없습니다');
  const seg = 명함.slice(i - 200, i + 200);
  assert.match(seg, /openCntPage\(\)/, '★★★ 그 화면을 안 엽니다');
  assert.match(seg, /!urlWantsMail\(\)/,
    '★★ 메일 문으로 들어와도 가로챕니다 — 메일 문은 제 화면을 이미 정했습니다');
});
