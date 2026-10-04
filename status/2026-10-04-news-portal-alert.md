# 2026-10-04 · 포털 뉴스레터 칸 경고 (feat/news-portal-alert)

대표 지시: 「항상 자동으로 검증하고 메일이 안나가거나 문제가 발생하는부분도 자동으로 검토해라 반드시 검토해라
그리고 문제가 발생하면 푸른 통합로그인에 들어갔을떄 뉴스레터 앱에 문제 발생등에 대한 경고 표시를 해서 검토 할 수 있게 해라」

- 경고판 `newsletter/watch/현재` {경고수, 말들, 열쇠} — `NWatch.경고판짓기` 가 가장 최근 회차 감시 기록에서 셈.
  보내기 전: 발송 막힘·포기 + 점검의 안 나감/확인 필요. 보낸 뒤: 전달 실패만.
- 서버가 늘 새로 씀: 경보(`뉴스레터경보`) 뒤 · 일요일 점검 뒤 · 발송 성공 뒤 · 월 12시 전달 뒤 · 3시간마다(감시꾼 맨 앞).
- 새 검토: 월 12시에 «오늘 06시 발송이 아예 안 돌았는지»(확정본이 아직 준비/거는중 + 자동발송 켜짐) → 경보.
- 포털 `enter.html` `뉴스레터경고달기()` — 칸을 다 그린 뒤 한 번 읽어, 문제가 있을 때만 「⚠ n」 + 마우스 올리면 내용,
  누르면 `pu-news.html?tab=watch`(설정 › 자동화 점검). 문제가 없으면 아무것도 안 그린다.
- `pu-news.html` — 주소의 tab 을 첫 탭으로(모르는 값은 이번 회차).
- 검사: `tests/news-portal-alert.test.js` (망가뜨려 우는 것 확인)
- 배포: `newsletterWatchRetry,newsletterWatchSunday,newsletterWatchDelivery,weeklyNewsletterSend,newsletterSundayRefill,newsletterRefillOnce20261004` (경보 함수를 쓰는 것 전부)
