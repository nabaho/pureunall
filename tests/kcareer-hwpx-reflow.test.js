'use strict';
/* 경력관리 완성본은 한글과 웹 편집기가 같은 줄·쪽 배치를 보도록 다시 조판한다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');

test('완성 HWPX는 lineseg를 다시 계산하고 재개방 검사 후 내보낸다', () => {
  assert.match(html, /async function rhFinalizeHwpx\(bytes\)/);
  assert.match(html, /doc\.reflowLinesegs\(\)/);
  assert.match(html, /PureunHwp\.openDoc\(fixed,'경력관리-검사\.hwpx'\)/);
  assert.match(html, /await rhFinalizeHwpx\(made\)/);
});

test('자동채움의 모든 경로가 같은 재조판 관문을 지난다', () => {
  const calls = html.match(/rhFinalizeHwpx\(/g) || [];
  assert.ok(calls.length >= 4, '함수 선언 외에 본 경로·예비 경로·칸지도 경로가 모두 재조판해야 합니다');
});
