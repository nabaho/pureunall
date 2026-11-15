# 2026-11-15 메일 일정 자동 등록 스위치 중복 클릭 방지 및 주석 경로 정리

- `pu-cards.html`: `mbCalInboxSet` / `mbCalInboxInner` 저장 진행 중(`_mbCalInboxSaving`) 버튼 `disabled` · `aria-busy="true"` · `aria-pressed` · `aria-label` 반영 및 실패 시 복구 처리 추가.
- `functions/mail-sync.js`: `CALINBOX` 호출부 주석의 설정 경로 표기를 `cal_inbox/cfg.on`으로 정리.
- `tests/mail-open-instant.test.js`: 스위치 중복 클릭 차단·접근성 속성·실패 복구 단위 테스트 추가.
