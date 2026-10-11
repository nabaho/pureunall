'use strict';
/* 휴가관리 정리 2 (2026-10-11 대표 「글자화면 다시 더 크게 · 이미 퇴사자들 정보자료가 왜 여전히 나오나 · 년도별로 창넘기기」)
   실행: node --test tests/hr-leave-tabs.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { stripJs } = require('./strip-comments.js');

const SRC = stripJs(fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n'));
const px = v => parseFloat(v);

test('휴가관리 표 글자가 13px 이상 · 머리 12px 이상', () => {
  const LM = SRC.slice(SRC.indexOf('function LeaveManagement('));
  const m = LM.match(/var thS=\{[^}]*fontSize:'([\d.]+)px'[^}]*\};\s*var tdS=\{[^}]*fontSize:'([\d.]+)px'/);
  assert.ok(m, '휴가관리 thS/tdS 를 못 찾았습니다');
  assert.ok(px(m[1]) >= 12, '머리 글자가 작습니다: ' + m[1]);
  assert.ok(px(m[2]) >= 13, '칸 글자가 작습니다: ' + m[2]);
});

test('보상휴가: 재직 칸에는 재직자만, 퇴사자는 퇴사자 칸에서 기록 있는 사람만', () => {
  assert.match(SRC, /var rows = users\.filter\(function\(u\)\{\s*if\(!showRetired\) return !isGoneUser\(u\);/);
});

test('연차대장: 한 번에 한 해 — ◀ ▶ 로 넘긴다', () => {
  assert.match(SRC, /usePersistedState\('leave_ledger_year', ''\)/);
  assert.match(SRC, /: \[curY\]\.map\(function\(y\)\{/);
  assert.doesNotMatch(SRC, /: years\.map\(function\(y\)\{\s*var rows = ledger\.filter/, '여러 해를 한꺼번에 쌓는 자리가 남았습니다');
});

test('연차/반차: 왼쪽 표가 오른쪽 상세보다 넓다 (대표 「넓게 해달라 · 오른쪽 화면 줄여달라」 2026-10-11)', () => {
  const m = SRC.match(/tab==='annual' && h\('div',\{style:_isAdminView\?\{display:'grid',gridTemplateColumns:(?:_lvM\?'minmax\(0,1fr\)':)?'minmax\(0,([\d.]+)fr\) minmax\(0,([\d.]+)fr\)'/);   // 폰은 한 열(2026-10-12)
  assert.ok(m, '연차/반차 두 칸 배치를 못 찾았습니다');
  assert.ok(px(m[1]) > px(m[2]) * 1.4, '왼쪽 표가 충분히 넓지 않습니다: ' + m[1] + ' : ' + m[2]);
});
