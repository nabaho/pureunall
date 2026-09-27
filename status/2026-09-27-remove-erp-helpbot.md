# 2026-09-27 · 🤖 푸른ERP AI 도우미 걷어냄

- 가지: `chore/remove-erp-helpbot`
- 대표 지시(캡쳐): 「푸른이알피 도우미가 필요가 없다 삭제해라 추후에 통합시스템 전반에 대한 챗봇이 필요할 것 같다.」

## 걷어낸 것 (`pu-erp.html`)
- 머리줄 「🤖 도우미」 단추 · 「?」 단축키 · 오른쪽 옆 창(푸른ERP AI 도우미)
- 도우미 본체 `HelpBot` 와 그것만 쓰던 `HELP_SYSTEM_PROMPT` · `SCREEN_GUIDE` · `HELP_FAQ` · `findHelpAnswer`
- 사용법 둘러보기의 「🤖 도움말」 한 장(없는 단추를 가리키게 되므로)

## 남긴 것
- ⚠ AI 로 보내는 길 `erpAiProxyUrl` — 상담기록 «AI 요약»이 계속 쓴다. 지우면 요약이 멎는다.
- 저장된 자료는 없다(도우미는 대화를 저장하지 않았다) — 서버·규칙 손댈 것 없음.

## 검사
- 새 `tests/erp-no-helpbot.test.js` — 도우미가 되살아나지 않음 · AI 요약 길은 남음(이빨 확인: 요약 길 끊으면 걸림).
- `tests/erp-ai-proxy.test.js` · `tests/erp-fetch-timeout.test.js` — 「두 곳(요약·도우미)」을 전제로 박은 것을
  «규칙»으로 고쳤다(부르는 곳 수를 못 박지 않음).

## 남은 일
- 대표 말씀: 나중에 «통합시스템 전반» 챗봇. 그때 이알피 한 화면용이 아니라 포털 차원에서 짓는다.
