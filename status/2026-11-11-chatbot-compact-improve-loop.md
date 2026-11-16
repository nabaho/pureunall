# 2026-11-11 — 길잡이 채팅방 간소화 · 연속 대화 · 자동 개선요청-답변-승인 폐루프 (`enter.html` · `js/pu-chatbot-kb.js` · `js/pu-chatbot.js`)

## 요청 및 결정 사항
- **간결한 화면 구성**: 길잡이 채팅방 첫 화면의 겹겹이 쌓인 안내 상자와 초기 세로 스크롤을 없애고 한눈에 들어오는 알약 칩 구성으로 압축하며, 우측 하단 `● 최신` 배지·`📷` 카메라 단추와 겹치지 않도록 기본 위치(`bottom: 88px; z-index: 94`)와 창 크기(`400 × 500`)를 조정. 범주 줄(`#puChatCats`)은 `[📚 사전]` 모드에서만 노출.
- **연속 대화형 티키타카**: 답변을 설명서 나열 대신 2~4문장 대화체 요약 + 되묻기 한 줄로 간결화하고, 직전 대화 이력 기억을 6턴(`maskPersonal` 적용)으로 넓혀 꼬리질문 대화를 자연스럽게 지속.
- **자동 개선요청 ➔ 결과 답변 수신 ➔ 채팅자 확인·승인 시 최종 완성 폐루프**:
  1. 대화 중 코딩·버그 수정·기능 개선이 필요한 발화를 AI(`improve`) 및 로컬 감지기(`detectImproveIntent`)로 판별해 기존 건의·자동개발 파이프라인(`suggestions_private` · `suggestions_meta_private` · `suggestions_resolved_private/{uid}`)에 자동 접수(개인·기업 식별정보 자동 가림 적용, 일반 대화도 `[🛠 개선요청]` 원클릭 접수 지원).
  2. 개선 진행·완료 답변이 도착하면 실시간 구독(`portalChatImprove.subscribe`)으로 채팅방 안에 결과 말풍선과 머리줄 알림 배지(`#chatFabBadge` · `#puChatReqCnt`)를 띄움.
  3. 채팅자가 결과를 직접 보고 **`✅ 개선 확인 · 승인 (완성)`**을 눌러야 `resolvedOk: true`로 최종 완성되며, 미흡할 경우 **`🔄 미해결 · 보완 재요청`**(`relatedId` 연결)으로 해결될 때까지 반복 가능.

## 주요 변경 파일
- `enter.html`: `#chatFabBadge` 및 `#chatFab:focus-visible` 추가, `sgSetUser` 내 `chatImpStartWatch()` 연동, 경로 이탈 검증(`_chatImpValidId`)을 갖춘 `window.portalChatImprove`(`submit` · `approve` · `reopen` · `subscribe` · `stop` · `openAdminDetail`) 다리 구현, 스크립트 캐시 버전 갱신(`?v=3`).
- `js/pu-chatbot-kb.js`: `detectImproveIntent`, `inferImproveCat`, `buildImprovePayload`(대화 맥락 포함 개인정보 마스킹), 간결 로컬 요약(`conciseBody`), 6턴 대화형 프롬프트 및 `parseReply` 내 `improve` 정규화 추가.
- `js/pu-chatbot.js`: 간결한 첫 화면(`.puc-wchips`) 및 미승인 카드 상시 유지(`renderPendingApprovals`), 말풍선 내 1줄 압축 연결도(`.puc-flow.compact`), `[요청]` 진행·승인 탭, 사전 검색 한글 IME 조합 보존(`#puChatDictList` 부분 갱신), 승인·재요청 중복 클릭 잠금(`impBusyIds`), `.s-wait` 고대비(`#854d0e` · 7.6:1), `aria-live="polite"`, 상세 모달 `Tab` 포커스 가두기 구현.
- `tests/portal-chatbot.test.js`: 간소화 UI, 오탐 방지 의도 판별, 개인정보 마스킹, 자동 개선요청 ➔ 실시간 결과 수신 ➔ 채팅자 승인 완성·보완 재요청 전 과정, 사전 한글 IME 보존, 다중 미승인 카드 유지, 중복 클릭 잠금, 명암비 및 `portalChatImprove` 보안 검증 추가.
