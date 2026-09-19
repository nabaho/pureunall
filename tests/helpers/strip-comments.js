'use strict';
/* 여기는 «문»일 뿐이다 — 걷개 알맹이는 tests/strip-comments.js 한 곳에 있다.
   ═══════════════════════════════════════════════════════════════════════════
   ★ 왜 이렇게 됐나 (2026-09-19)
     이 저장소에 걷개가 «두 벌» 있었다. 여기 있던 것이 진짜 파서였고,
     tests/strip-comments.js 의 stripJs 는 글자열을 몰라서 조각 안의
     accept="image/별표" 를 삼켰고 줄 끝 주석은 아예 안 걷었다.
     두 벌이면 한쪽만 고쳐지고 다른 쪽은 조용히 낡는다 — 그래서 알맹이를
     tests/strip-comments.js 로 옮기고, 여기는 그것을 도로 내주기만 한다.

   ⚠ 여기에 걷는 코드를 «다시 적지 말 것.» 그 순간 두 벌로 돌아간다.
     고칠 일이 있으면 tests/strip-comments.js 를 고친다.
     (tests/strip-comments-guard.test.js 가 「제 손으로 걷개를 적은 곳」을 찾아낸다)

   ■ 어느 것을 쓰나
       통째 HTML 문서(.html 을 통으로 읽은 것)   →  stripComments
       .js 파일 · 함수 조각 · CSS                →  stripJs
       .html 도 .js 도 받는 «읽기» 도우미        →  stripByName
       날것 엔진이 그대로 필요할 때              →  주석걷기 */

const { 주석걷기, 함수몸 } = require('../strip-comments.js');

module.exports = { 주석걷기, 함수몸 };
