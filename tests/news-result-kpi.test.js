'use strict';
/* 보낸 결과 KPI — 작게 · 위에 고정 · 누르면 그 데이터만 (대표 지시 2026-10-05
   「kpi 크기 작게하고 틀고정해라 그리고 나감 대기 실패 등 kpi 클릭하면 그 데이터만 볼수 있게 만들어라」) */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const C = require('../js/pu-news-core.js');
const { stripComments } = require('./strip-comments.js');
const 화면 = stripComments(fs.readFileSync(path.join(__dirname, '..', 'pu-news.html'), 'utf8')).replace(/\r\n/g, '\n');
const 함 = (n) => { const i = 화면.indexOf('function ' + n + '('); return 화면.slice(i, 화면.indexOf('\n}\n', i) + 2); };

test('★ KPI 는 누르는 단추이고, 위에 붙는 머리 안에 있다', () => {
  const 몸 = 함('결과화면');
  assert.match(몸, /class="kpi' \+ \(켜짐 \? ' on' : ''\) \+ '" onclick="결과거르기바꿈\(/);
  assert.ok(몸.indexOf('<div class="res-head">') < 몸.indexOf('띠 + \'</div>\''), 'KPI 가 붙는 머리 밖에 있다');
  assert.match(화면, /\.res-head\{position:sticky;top:0/);
  /* 작게 — 숫자가 19px 큰 칸이 아니다 */
  assert.ok(!/font-size:19px/.test(몸), 'KPI 숫자가 아직 크다');
});

test('★★ 누르면 그 데이터만 — 다시 누르면 전체', () => {
  const 짐 = { App: { 결과거르기: '' }, Core: C, render: () => {}, String };
  vm.createContext(짐);
  vm.runInContext(함('결과거르기맞나') + '\n' + 함('결과거르기바꿈'), 짐);
  const 줄 = [
    { 보냄표: true, 나갔나: '모름' },                                   /* 나감 */
    { 보냄표: true, 나갔나: 'waiting' },                                /* 대기 */
    { 보냄표: true, 오류: '550' },                                       /* 실패 */
    { 보냄표: true, 나갔나: '모름', 열람: true, 클릭: true },
    { 보냄표: true, 나갔나: '모름', 메일함: { 갈래: '반송' } }];
  const 센다 = (k) => 줄.filter((x) => 짐.결과거르기맞나(x, k)).length;
  assert.strictEqual(센다(''), 5);
  assert.strictEqual(센다('나감'), 3);
  assert.strictEqual(센다('대기'), 1);
  assert.strictEqual(센다('실패'), 1);
  assert.strictEqual(센다('열람'), 1);
  assert.strictEqual(센다('클릭'), 1);
  assert.strictEqual(센다('반송'), 1);
  vm.runInContext("결과거르기바꿈('실패')", 짐);
  assert.strictEqual(짐.App.결과거르기, '실패');
  vm.runInContext("결과거르기바꿈('실패')", 짐);
  assert.strictEqual(짐.App.결과거르기, '', '같은 것을 다시 누르면 전체로 안 돌아온다');
  /* 회차를 바꾸면 거르개가 풀린다 */
  assert.match(화면, /function 결과회차고르기\(k\)\{[^}]*App\.결과거르기 = ''/);
});
