'use strict';
/* 소재지 칸의 우편번호 상자 — 폭을 안 주면 input 기본 폭(약 170px)으로 96px 칸을 넘쳐
 * [우편번호 검색] 단추가 그 위에 겹쳤다(대표 캡쳐 2026-09-28 「이상하다」). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8');
test('우편번호 input 은 제 칸(96px) 폭을 넘지 않는다', () => {
  assert.match(SRC, /\.addrstack \.ar1 \.zip\{width:96px;flex:none\}/);
  assert.match(SRC, /\.addrstack \.ar1 \.zip input\{width:100%/, '폭이 없으면 단추와 겹친다');
});
