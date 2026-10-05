'use strict';
/* 기업 상세 옆줄 「사업」 — 컨설팅 사업 탭만 보인다 (대표 지시 2026-10-05 「추천대로 해라」)
   ■ 못 박는 것
     ① 「사업」 칸은 사업 이름 목록(CO_BIZ_TABS)에 있는 탭만 보여 준다
     ② 서류 종류 딱지(「서류 탭」)는 여전히 접혀 있다(대표 지시 2026-08-26)
     ③ 누르면 그 탭으로 거르고(pickCoFolder 't:'), 한 번 더 누르면 푼다 */
const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const { test } = require('node:test');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8').replace(/\r\n/g, '\n');

test('사업 탭 목록에 현장클리닉·기술보호울타리가 있고, 목록에 있는 것만 거른다', () => {
  assert.match(SRC, /const CO_BIZ_TABS = \['현장클리닉', '기술보호울타리'\];/);
  assert.match(SRC, /\.filter\(x => CO_BIZ_TABS\.indexOf\(x\.t\) >= 0\)/);
  assert.match(SRC, /<div class="pcsec">사업<\/div>/);
});

test('서류 탭은 여전히 접혀 있다', () => {
  assert.match(SRC, /const CO_SIDE_DOC_TABS = false;/);
});

test('누르면 그 탭으로, 다시 누르면 푼다', () => {
  /* ⚠ 정규식으로 쓰면 「t:」 뒤 역슬래시가 PC 경로로 잡힌다(tests-no-local-path) — 글자 그대로 찾는다 */
  assert.ok(SRC.includes("pickCoFolder(state.coTag==='${esc(x.t)}' ? '' : 't:' + '${esc(x.t)}')".replace("'t:' + '", "'t:")),
    '사업 탭을 누르면 그 탭으로 거르고 다시 누르면 풀어야 합니다');
  assert.match(SRC, /if\(k\.indexOf\('t:'\)===0\)\{ state\.coTag=k\.slice\(2\); state\.coFolder=''; \}/);
});
