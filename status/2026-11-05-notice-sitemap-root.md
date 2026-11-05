# 2026-11-05 · 주간 브리핑이 sitemap 도 함께 올린다 (홈페이지 · 뿌리)

- 증상: 월요일 07:30 `weeklyNewsBrief` 가 공지를 올리면 `tests/homepage-static.test.js`(굳힌 쪽 수 = sitemap 수)가 빨개졌다(notice/140).
  11/02 에 5e5cbc26 이 sitemap 한 줄과 «차례 글 수 박기»를 고쳐 main 은 이미 초록이었다 — 그러나 뿌리는 남아 있었다.
- 고침: `functions/notice-lib.js` 에 `사이트맵더하기(xml, 번호, 날짜)` — `/notice` 줄 아래에 한 줄(이미 있으면 그대로, `/notice` 줄이 없으면 null).
  `functions/index.js` `weeklyNewsBrief` 가 글 쪽 → sitemap → 목록 순으로 올린다. sitemap 을 못 읽으면 글만 올리고 건너뛴다(공지가 막히지 않게).
- 검사: `tests/homepage-notice.test.js` 「새 공지를 올리면 sitemap 에도 한 줄」.
- ⚠ 함수 코드라 **배포해야 효과가 난다**(`firebase deploy --only functions:weeklyNewsBrief`, 대표 PC·배포 작업). 이 PR 은 배포하지 않았다.
- ⚠ 글 쪽 올림과 sitemap 올림 사이(커밋 둘)에는 검사가 잠깐 어긋날 수 있다 — 마지막 커밋에서 맞는다.
