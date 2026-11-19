# 2026-11-20 — AI 비용 정리 배포 완료 (`claude/ai-cost-deployed`)

대표 「지금해」 — PR #3214(AI 비용 정리 5가지)를 합친 뒤 서버 함수와 규칙을 올렸다.

## 올린 것

GitHub 「Firebase 배포」 두 번, 모두 성공했다. 함수 한 번에 10개까지라 나눠 돌렸다.

- **실행 44634743342**
  - 규칙: `rules-deploy.js --deploy` — 새로 2(`/ai_read_tally/$ymd/$app/won`·`wn`) · 바뀜 0 · 사라짐 0. 문법 검사 통과, 다시 읽어 «콘솔이 올린 것과 같음».
  - 함수 10: `readDoc`·`photoEdit`·`suggestionAssist`·`suggestionAssistNow`·`recruitWatch`·`mailCardRead`·`mailContractSweep`·`runMailContractSweep`·`syncMailbox`·`weeklyNewsletterPrepare` — 모두 «Successful update».
- **실행 44634748524**
  - 함수 4: `newsletterWatchRetry`·`newsletterWatchSunday`·`newsletterBounceScan`·`newsletterWatchDelivery` — 모두 «Successful update».

## 대상 고르는 법

이번에 바뀐 서버 길만 골랐다:
- Gemini 를 부르는 함수 — `geminiBody` 기본 상한·`callGemini` 의 model·원화 셈 `bumpSpend`
- 달 한도 `aiMonthSpend` 를 보는 함수
- 사진 지우개 모델(`photoEdit`)
- 캘린더 메일함 `cal-inbox` 를 쓰는 `syncMailbox`

⚠ `뉴스레터AI` 처럼 한글 이름 도움 함수를 «넘기기만» 하는 곳(`ai: 뉴스레터AI`)도 있어 손으로 짚었다.
메일 함수 묶음(`pullMailbox` 등)은 mail-sync 를 쓰지만 AI·한도와 무관해 뺐다.

## 이 PR

- 새 기준 `docs/firebase-rules-콘솔원문-2026-11-20.json` 을 만들개 출력으로 남겼다(배포 뒤 콘솔과 같음 확인).
- `tests/photos-staff-share.test.js` 의 «게시 전» 목록(PENDING)을 비웠다.

## 아직 확인 못 한 것

- 실제 판독이 돌아 `won`·`wn` 이 쌓이는지는 다음 판독 뒤 사진첩·포털의 «이번 달 AI 금액»으로 볼 수 있다.
- 서버 DB 는 이 방에서 직접 읽지 않았다.
