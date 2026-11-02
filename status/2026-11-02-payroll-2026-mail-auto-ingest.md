# 2026-11-02 — 급여아웃소싱 2026 미입력 사업장(114곳) 푸른메일함 수신·발신·첨부 전수 자동수집·입력

- **무엇을 했나**:
  1. 전체 급여 사업장 114곳 중 2026년 데이터가 `자료 없음` / `미도착`으로 뜨던 원인을 규명(`_harness_out/payroll_all.json` 내 `잔업수당*1.5` 등 `.` 포함 키로 인한 RTDB 업로드 중단, `site_co_link`·`site_cards`·`inbox` 미반영, `ymOf(rec)` 연도 판독 규칙)하고 전수 보완했습니다.
  2. 푸른메일함(`mailbox/msgs` 10,253건, `pucards/sentBox` 보낸메일 912건, `paydata/maillog` 500건, `pu_paydata/_mail/pending/*.xlsx` 첨부 엑셀 234건, `pucards/coInfo` 620건)을 전수 대조·파싱하여 전체 114개 급여 사업장의 2026년(1월~11월) 급여·근태·입퇴사·수신함·메일 요약 데이터를 실시간 DB(`/payroll_os`)와 로컬 `_harness_out`에 반영했습니다.
  3. `payroll-os.html`에 `autoSync2026FromMail()` 자동 동기화 엔진과 `mailDigestPanelHtml()`(📬 푸른메일함 수신·발신·첨부 자동수집 내역 카드)을 추가하고, `importPayroll()`에서 RTDB 금지 키 문자(`. # $ [ ] /`)를 자동 정화하도록 고쳤습니다.
- **검사**: `tests/labor-core.test.js`, `tests/labor-screens.test.js` (145 통과), `tests/payroll-shell.test.js`, `tests/co-thread.test.js`, `tests/color-palette-apps.test.js`, `tests/app-soon-gate.test.js` 전체 통과.
