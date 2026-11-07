# 2026-11-05 · 유료 API 통제 2·3단계 (claude/login-start-screen-386qu2)

- `readGeminiKey`: 금고(GEMINI_KEY)만 — 실시간DB 갈래 삭제. 쓰는 함수 11개 모두 secrets 확인(`tests/ai-key-vault-only.test.js`).
- `enter.html` 포털 설정에서 Gemini 키 칸 삭제(다음 저장 때 옛 값도 지워짐).
- `recordBillingAlert`: 하루 폭주면 관리자 폰 알림(하루 1번, `pushedAt`) — `BA.spikePushPayload`, `tests/billing-spike-push.test.js`.
- ⚠ 남은 일: 함수 배포(readDoc·photoEdit·mailCardRead·suggestionAssist·suggestionAssistNow·recruitWatch·뉴스레터 넷·recordBillingAlert) ·
  Gemini 열쇠 새로 바꾸기(사람) · 콘솔 할당량(사람) · 클로드 프록시 확인.
