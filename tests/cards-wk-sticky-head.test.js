/* 👷 근로자 표 머리줄 «틀고정» (대표 지시 2026-09-30 「틀고정」)
   기업 상세·명함 표는 머리줄이 이미 붙어 있었는데 근로자 표만 빠져 있었다.
   ★ 못 박는 것
     ① 머리 칸이 sticky 로 붙는다
     ② 표에 overflow:hidden 이 «없다» — 있으면 표 자신이 스크롤 틀이 되어 머리줄이 못 붙는다
     ③ #pcWk 의 위 여백(14px) 틈으로 줄이 비치지 않게 맨 위 끝에 붙인다
   node --test tests/cards-wk-sticky-head.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8').split('\r\n').join('\n');
const bare = s => s.replace(/\/\*[\s\S]*?\*\//g, '');
function rule(sel) {
  const css = bare(SRC.slice(SRC.indexOf('<style>'), SRC.indexOf('</style>')));
  const i = css.indexOf('\n' + sel + '{');
  assert.ok(i >= 0, sel + ' 규칙이 없다');
  return css.slice(i, css.indexOf('}', i));
}

test('★★★ ① 근로자 표 머리 칸이 위에 붙는다', () => {
  const th = rule('.wktbl th');
  assert.match(th, /position:sticky/, '★★★ 머리줄이 안 붙는다 — 내리면 칸 이름이 사라진다');
  assert.match(th, /top:/);
});

test('★★★ ② 표에 overflow:hidden 이 없다 — 있으면 붙이기가 헛돈다', () => {
  assert.ok(!/overflow:hidden/.test(rule('.wktbl')), '★★★ 표가 스크롤 틀이 되어 sticky 가 안 먹는다');
});

test('★★ ③ #pcWk 안에서는 위 여백만큼 올려 붙인다 — 틈으로 줄이 비치지 않게', () => {
  const pad = (rule('#pcWk').match(/padding:(\d+)px/) || [])[1];
  assert.ok(pad, '#pcWk 위 여백을 못 읽었다');
  assert.match(rule('#pcWk .wktbl th'), new RegExp('top:-' + pad + 'px'), '★★ 여백과 올린 값이 어긋났다');
});
