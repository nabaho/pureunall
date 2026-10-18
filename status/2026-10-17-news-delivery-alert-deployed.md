상태: 완료
이어하기시도: 0
작업폴더: C:\Users\fair0\Documents\pu-wt-news-trend
가지: docs/news-delivery-alert-deployed

# 뉴스레터 «⚠ 전달 실패» 자동 정리 — functions 배포 완료와 확인 (2026-10-17)

대표 「배포」 승인(2026-10-17). `status/2026-10-17-news-delivery-alert-auto-clear.md` 의 «functions 배포는 대표 승인 뒤» 는 이 기록으로 해소됐다.

- 기준: origin/main `e62dace1`(#2638 합침) · 6개 이름으로 배포(asia-northeast3, 전부 «Successful update operation»):
  `weeklyNewsletterSend` · `newsletterWatchRetry` · `newsletterWatchSunday` · `newsletterBounceScan` · `newsletterWatchDelivery` · `newsletterSundayRefill`.
- ⚠ **배포하면 Cloud Scheduler 작업이 갱신돼 «every 3 hours» 시계가 배포 시각부터 다시 시작된다** —
  `newsletterWatchRetry`: 마지막 실행 13:25 → 갱신 16:21 → 다음 19:21. 그 사이 포털은 옛 경고판을 그대로 보여 «안 고쳐졌다» 로 보인다(대표 스크린샷 18:14 에 ⚠ 1).
  그래서 배포 뒤 `newsletterWatchRetry` 를 «지금 한 번» 앞당겨 돌렸다(스케줄러가 곧 할 일을 앞당긴 것 — firebase-tools 모듈로 `POST …/jobs/firebase-schedule-newsletterWatchRetry-asia-northeast3:run`).
- 결과(운영 자료는 읽기만, 쓴 것은 서버가 스스로 쓴 것뿐):
  - `newsletter/watch/현재` → 경고수 0 (이전 1).
  - `watch/2026-10-w2/전달경보` → 상태 `정리됨`, 정리.처리됨 2.
  - `watch/2026-10-w2/전달` → 실패 2 · 처리됨 2 (실제로 2통이 안 간 사실은 그대로 남는다).
- 아직 못 본 것: 대표 화면에서 타일 «⚠» 가 사라지는 모습(새로 고침 필요) · 다음 월요일(10/19) 12시 점검이 새 잣대로 도는 모습.
