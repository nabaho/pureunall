# 2026-10-07 · 급여 확정 기록 — 누가·언제 확정, 누가·왜 되돌림 (payroll-lock-log)

- 보고서 우선순위 14번(계산자≠확정자·감사 로그) 중 «기록» 부분. 계산자≠확정자 강제는 인원 구성에 따른 대표 결정이 필요해 보류.
- 확정 잠금(payroll_locked)은 시각만 남겨 「누가 확정했나」를 댈 수 없었다 → payroll_os/lock_log/{사업장}/{push}={months, action(확정·되돌리기·일괄 확정), by, at, why}.
- 되돌릴 때 사유 필수(비우면 안 되돌림). 잠금 저장 꼴은 그대로(신호·명세서·relockFor 가 기댐).
- 한눈에 「확정 기록」 최근 10건(그 회사 것만, limitToLast).
- 검사: tests/payroll-lock-log.test.js 4건(사유 필수 고장넣기 확인).
