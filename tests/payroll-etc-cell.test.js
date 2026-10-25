'use strict';
/* 급여대장 «기타수당» 칸 (2026-10-25 대표 「기타수당에서 숫자가 이상하다」)
   따로 칸이 없는 수당(예: 업무분담수당)의 합계가 입력칸 «위에 겹쳐» 그려져 숫자가 겹쳐 보였다 → 입력칸 왼쪽에 이름과 함께 한 줄로.
   실행: node --test tests/payroll-etc-cell.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { stripJs } = require('./strip-comments.js');
const SRC = stripJs(fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n'));

test('기타수당 칸 — 다른 수당 합계는 입력칸 위에 겹쳐 그리지 않고(absolute 금지) 같은 줄 왼쪽에 둔다', () => {
  const at = SRC.indexOf("var otherSum = otherAllows.reduce(");
  assert.ok(at > 0, '기타수당 칸 코드를 못 찾았습니다');
  const cell = SRC.slice(at, SRC.indexOf('})(),', at));
  assert.doesNotMatch(cell, /position:'absolute'/, '★ 합계가 입력칸 위에 겹쳐 그려집니다');
  assert.match(cell, /display:'flex',alignItems:'center',justifyContent:'flex-end'/, '입력칸과 합계는 한 줄(flex)');
  const badge = cell.indexOf('otherSum > 0 && h(');
  const input = cell.indexOf("h('input', {type:'text', value:etcAmt");
  assert.ok(badge > 0 && input > badge, '합계 표시는 입력칸 «왼쪽»(앞)이어야 한다');
  assert.match(cell, /otherAllows\.length === 1 \? \(otherAllows\[0\]\.name/, '수당이 하나면 이름을 같이 보인다');
});
