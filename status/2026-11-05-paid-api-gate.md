# 2026-11-05 · 유료 API 통제 1단계 (claude/login-start-screen-386qu2)

- 대표 지시 「유료 API 통제 — 추천대로」. 검토와 순서표: `docs/유료API-통제-2026-11-05.md`.
- `photoEdit`(AI 지우개): 이번 달 지갑 + 사람별 하루 20장 + 셈 못 읽으면 안 부름 + 요금 붙은 만큼(×15) 셈.
- `readDoc`: 판정을 `DR.budgetGate` 한 곳으로 — 사람이 누른 것도 한도 1.2배에서 멈춤, 셈 못 읽으면 자동만 멈춤.
- 검사: `tests/ai-cost-gate.test.js`(새), `tests/ai-spend-cap.test.js`(manual 무제한 → 1.2배 규칙으로).
- ⚠ 남은 일: 함수 배포(`readDoc`,`photoEdit`) · 콘솔 할당량(사람) · 키 정리 · 급증 폰 알림 · 클로드 프록시 확인.
