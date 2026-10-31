'use strict';
/* 사건위임계약서(한국공인노무사회 승인서식) 「공인노무사명 | 권형하노무사」 칸 — 명단을 한 줄로 이어 쓴다
   (대표 「추천대로」 2026-10-31: 세로로 한 줄에 1명씩 늘리면 1쪽 공식 서식이 2쪽이 된다). 위임장의 「성 명 :」 줄은 그대로 세로 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { test } = require('node:test');
const T = require('../js/esign-hwp-tpl.js');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'js/esign-hwp-tpl.js'), 'utf8').replace(/\r\n/g, '\n');

test('이름만 한 줄로 — 「대표/ 공인노무사」·띄어 쓴 이름도', () => {
  assert.strictEqual(T.cellNamesLine(['대표/ 공인노무사 권 형 하', '공인노무사 박한별', '공인노무사 김혜민']), '권형하, 박한별, 김혜민');
  assert.strictEqual(T.cellNamesLine([]), '');
  assert.strictEqual(T.cellNamesLine(null), '');
});

test('표 칸 이름만 든 꼴은 한 줄, 「성 명 :」 줄은 세로 그대로', () => {
  assert.match(SRC, /if \(c && NAME_CELL\.test\(tx\)\) \{ A\.set\(paras\[i\]\.key, cellNamesLine\(vertical\)\); n\+\+; continue; \}/);
  assert.match(SRC, /writeLines\(A, paras\[i\]\.key, m\[1\], vertical, reuse\);/, '위임장 「성 명 :」 줄은 세로로');
});
