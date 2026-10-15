상태: 완료
이어하기시도: 0
작업폴더: C:\Users\fair0\Documents\pu-wt-news-trend
가지: docs/news-core-deployed

# 뉴스레터 핵심판 — functions 배포 완료 (2026-10-15)

대표 「배포」 승인(2026-10-15). `status/2026-10-13-news-core3.md`·`status/2026-10-15-news-core-review.md` 에 «functions 배포가 아직 필요»라고 적힌 것은 **이 기록으로 해소**됐다.

- 기준: origin/main `99c28ec5`(#2632 합침 포함) — 깨끗한 작업폴더에서 `functions/` `npm install` 뒤 배포.
- 배포한 함수(이름 지정, asia-northeast3, 전부 «Successful update operation»):
  `weeklyNewsletterPrepare` · `weeklyNewsletterSend` · `newsletterWatchRetry` · `newsletterWatchSunday` · `newsletterSundayRefill`
- 명령: `FUNCTIONS_DISCOVERY_TIMEOUT=180` + `firebase deploy --only functions:<5개> --project pureun-erp`.
- 일부러 안 올린 것: `newsletterBounceScan` · `newsletterWatchDelivery` · `newsView` 등 — 이번에 바뀐 핵심판·후보·저장 코드를 쓰지 않는다(옛 사본이 그대로 돈다).

## 아직 못 본 것
- 배포 «성공 로그»만 확인했다. **새 코드가 실제로 도는지는 다음 금요일(10/16 13시) 준비 결과**로 본다:
  `newsletter/weeklyReady` 기록과 검토 메일의 «핵심판 / 후보 N장 / 카드 있으나 안 켜짐 / 카드 없음» 안내 줄.
