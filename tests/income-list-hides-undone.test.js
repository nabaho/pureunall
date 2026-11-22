'use strict';
/* 확정을 되돌린 입금(undoneDate)은 입금 리스트·종류별 입금 탭에서 «없는 돈» 으로 빠져야 한다.
   값이 아니라 규칙을 본다 — 거르개(erpIncomeLive)가 목록을 만드는 자리마다 붙어 있는가. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');

function bodyAfter(marker, len) {
  const i = src.indexOf(marker);
  assert.ok(i >= 0, marker + ' 를 찾지 못했다');
  return src.slice(i, i + len);
}

test('입금 리스트 탭: 보여줄 줄과 유형 깔때기 모두 살아 있는 입금만', () => {
  assert.match(bodyAfter('var kindFunnelBase = incomes.filter', 300), /erpIncomeLive\(it\)/);
  assert.match(bodyAfter('var filtered = incomes.filter(function(it){\n    if(!erpIncomeLive', 200), /erpIncomeLive\(it\)/);
});

test('종류별 입금 탭도 되돌린 입금을 거른다', () => {
  assert.match(bodyAfter('var filtered = allIncomes.filter(function(it){', 200), /erpIncomeLive\(it\)/);
});

test('erpIncomeLive 는 undoneDate 를 «없는 돈» 으로 본다', () => {
  const m = src.match(/function erpIncomeLive\(fi\)\{[\s\S]*?\n\}/);
  assert.ok(m);
  assert.match(m[0], /undoneDate/);
});
