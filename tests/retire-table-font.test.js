'use strict';
/* 퇴직정산 적립금 표 — 글자 크게 · 칸 정리 (2026-10-12 대표 「퇴직정산 글자 크게 하고 열정리」)
   실행: node --test tests/retire-table-font.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { stripJs } = require('./strip-comments.js');
const SRC = stripJs(fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n'));

test('적립금 표: 글자 13px 이상 · 칸 너비를 정해(colgroup) 직원 칸이 화면을 다 먹지 않는다', () => {
  const i = SRC.indexOf("(tab === 'balance' && window.innerWidth > 768) && h('div'");
  assert.ok(i >= 0, '넓은 화면 적립금 표를 못 찾았습니다');
  const seg = SRC.slice(i, i + 4000);
  const m = seg.match(/h\('table', \{ style:\{[^}]*fontSize:'([\d.]+)px'/);
  assert.ok(m && parseFloat(m[1]) >= 13, '표 글자가 작습니다');
  assert.match(seg, /tableLayout:'fixed'/);
  assert.match(seg, /h\('colgroup', null,/);
  assert.doesNotMatch(seg, /h\('table', \{ style:\{ width:'100%'/, '표가 다시 화면 전체 폭을 씁니다');
});

test('퇴직정산 나머지 탭(월별 누계·퇴직금 계산·퇴사자 정산)도 11px 아래 글자가 없다 (2026-10-12 «추천대로»)', () => {
  const a = SRC.indexOf("tab === 'monthly' && (function(){");
  const b = SRC.indexOf('\nfunction ', a + 10);
  assert.ok(a > 0 && b > a, '퇴직정산 탭 자리를 못 찾았습니다');
  const small = (SRC.slice(a, b).match(/fontSize:\s*'(?:[0-9]|10(?:\.\d)?)px'/g) || []);
  assert.equal(small.length, 0, '아직 작은 글자: ' + small.slice(0, 5).join(' '));
});
