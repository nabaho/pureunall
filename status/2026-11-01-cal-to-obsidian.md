# 2026-11-01 · 푸른 캘린더 → 옵시디언 일정 내보내기 (S1)

- 대표 「추천」 = 설계안 7절 추천대로: 기간 지난 12개월+앞 3개월 · 지메일 보류 · 시트 1회 대조.
- 새 파일 `js/pu-cal-obsidian.js`(`?v=1`): 일정 → `일정/YYYY-MM.md` · `일정/담당자/<이름>.md` · `일정/개요.md`. 설명·참석자·만든이 이메일 제외, 구글에서 지워진 일정은 «⚠구글에서 지워짐» 표시.
- `pu-cal.html`: 스크립트 셋(`pu-rrn-mask`·`pu-mail-obsidian`·`pu-cal-obsidian`) · ☰ 서랍에 총괄관리자 전용 «🪨 옵시디언으로 내보내기» · 풀칠 `옵시디언내보내기()`(구글 공개 읽기 + 보관함 지워진 일정, `shiftDay` 재사용, 서버·달력 상태 안 건드림).
- 검사: `tests/cal-obsidian.test.js`(7).
- ⚠ 못 한 것: 업체 연결(보관함 기록이 `puSid`·`puSourceId` 를 안 담고 구글 공개 읽기엔 private 속성이 안 온다 → S1b: `my_schedules` 의 `gcalEventId`·`source` 로) · 로그인된 달력 화면·대표 PC 에서 실제 실행 · 시트 1회 대조(S3) · S2(이알피 업무요약 머리말 `sid`·`company_id`).
