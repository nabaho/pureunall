상태: 완료
작업폴더: C:\Users\fair0\Documents\pureunall\.claude\worktrees\relaxed-yonath-b3f950
가지: chore/news-refill-once-cleanup
이어하기시도: 0

# 2026-10-11 · 뉴스레터 «오늘만 23시 보충» 일회용 함수 코드 정리 (chore/news-refill-once-cleanup)

10/4 대표 지시(「오늘꺼 만 예외로 23시에 모아달라」)로 만든 일회용 `newsletterRefillOnce20261004`
(크론 `0 23 4 10 *` 서울 · 날짜 문지기 `서울오늘() !== "2026-10-04"`)는 10/4 23시에 한 번 돌고 끝났어야 하는데,
10/11 현재 `functions/index.js` 와 서버(pureun-erp · asia-northeast3) 양쪽에 남아 있었다(`firebase functions:list` 로 확인 — 지시문 기준).
10/5 10:00 정리 예약 작업(`newsletter-oneoff-cleanup-20261005`)은 5초 만에 «succeeded» 로 끝났지만 요약이 없고 실제로는 못 지웠다.
앞선 기록: `status/2026-10-04-news-refill-once.md` 「남은 일」.

## 바뀐 것 (이 PR = 코드만)
- `functions/index.js`: `exports.newsletterRefillOnce20261004` 블록(설명 주석 포함 15줄)을 지웠다.
  - ⚠ 몸통 `일요일보충한번(누가)` 는 «그대로» — 매주 일요일 17시 `newsletterSundayRefill` 이 계속 쓴다.
    그 위 설명 주석의 「«오늘만 23시»가 함께 부른다」 한 구절만 지금 사실로 고쳤다(동작 변화 없음 → 다른 함수는 다시 배포할 필요 없다).
  - `서울오늘()` 은 다른 세 곳에서도 쓰여 지워도 고아가 안 된다.
- `tests/billing-auto-truth.test.js`: 스케줄 함수 수 기대값 **23 → 22** (검사가 세는 것 = index.js 21→20 + mail-sync.js 2).
  - 개수는 «코드에서 `.pubsub.schedule(` 를 세는» 방식 그대로이고, 같은 줄에 `검사고정-허용` 이 이미 붙어 있다(화면 문구와 짝인 개수가 규칙).
    그 줄 위 이력 주석에 «10/11 오늘만 보충을 지워 스물둘» 을 남겼다.
  - 하루 셈(`perDay` = 508)과 `enter.html` 문구는 **그대로**다 — 오늘만 함수는 처음부터 하루 셈에 안 들어 있었고,
    `enter.html` 에는 스케줄 «개수» 합계를 적은 글이 없다(하루 횟수 508번·240번만 있고 둘 다 코드에서 셈한 값).
- `tests/news-sunday-refill.test.js`: 「오늘만 함수가 있으면 날짜 문지기를 본다」 블록을 걷어냈다.
  지운 뒤엔 대상이 없어 영영 건너뛰는 죽은 블록이 된다(걷어내기 전에도 그대로 통과했다). 옆의 낡은 주석 한 줄도 고쳤다. 나머지 단언은 그대로.

## 확인한 것
- 뉴스레터 검사 전체(`tests/news-*.test.js` 20 · `tests/newsletter-*.test.js` 77) + billing: **1304개 통과 · 실패 0** — 고치기 전(1304/0)과 같은 수.
- `functions/index.js` 를 글자로 읽는 검사 121파일: 1697개 중 1696 통과 · 실패 0 · 건너뜀 1(`functions/node_modules` 가 없을 때 물러서는 passkey 검사 — 이 변경과 무관).
- `tests/test-pin-guard.test.js` 통과(새로 박은 값 없음 — 기존 `검사고정-허용` 줄의 값만 바꿨다).
- 이빨: 새 billing 검사에 «옛 index.js(오늘만 함수 있음)» 를 먹이면 `actual: 23 / expected: 22` 로 실패한다(작업용 사본에서 시험, 저장소 파일은 안 건드렸다).
- `node --check functions/index.js` 통과 · 줄끝 CRLF 유지(작업트리 w/crlf · 저장본 i/lf).

## 실제로 있었던 일 / 주의
- 지시문·메모리의 숫자는 옛 값이다: 메모리 「20→19」는 10/4 당시 값, 지시문 「21개」는 index.js 만 센 값(21→20).
  검사가 세는 합계는 **23 → 22**. 숫자를 외워 고치지 말고 직접 세어 맞출 것(`.pubsub.schedule(` 개수, index.js + mail-sync.js).
- 정리 예약 작업이 «succeeded» 여도 일이 됐다는 뜻은 아니었다 — 이번처럼 «결과(서버 목록·코드)»를 직접 확인할 것.

## 서버 삭제 — 끝 (2026-10-11 후속)
위 코드 정리(#2460)가 병합된 뒤, 작업 요청자가 확인 창에서 「대표 승인 받음 — 지금 삭제」 를 골라 서버 함수를 지웠다
(되돌리기 어려운 운영 변경이라 그 승인 전에는 실행하지 않았다).
- 실행: `firebase functions:delete newsletterRefillOnce20261004 --region asia-northeast3 --project pureun-erp --force`
  (Git Bash · `FUNCTIONS_DISCOVERY_TIMEOUT=180`) → `functions[newsletterRefillOnce20261004(asia-northeast3)] Successful delete operation.` 종료코드 0.
- 확인: `firebase functions:list` 삭제 전 97개 → 후 96개. 사라진 것은 `newsletterRefillOnce20261004` 하나뿐이고,
  이웃 뉴스레터 함수 7개(`newsletterSundayRefill` · `newsletterBounceScan` · `newsletterWatchRetry` · `newsletterWatchSunday` ·
  `newsletterWatchDelivery` · `weeklyNewsletterPrepare` · `weeklyNewsletterSend`)는 그대로다.
- ✅ **Cloud Scheduler 도 확인함**(2026-10-11 18:50, 읽기만): 같은 이름 작업(`firebase-schedule-newsletterRefillOnce20261004-asia-northeast3`)이
  같이 지워졌다. gcloud 가 없어 firebase-tools 모듈로 읽었다 — 34개 위치를 모두 훑어 작업은 **us-central1 에만 30개**(= 예약 함수 30개)이고 그 가운데 `RefillOnce` 는 없으며, Pub/Sub 주제도 404.
  ⚠ 서울(asia-northeast3) 목록은 0개다 — 예약 작업은 프로젝트 기본 위치(us-central1)에 만들어지므로, 서울만 보고 «없다» 하지 말 것(이웃 작업이 보이는지부터).

## 남은 일
- 없다. 일회용 함수는 코드 · 서버 함수 · 예약 작업 · Pub/Sub 주제까지 모두 정리됐다.
