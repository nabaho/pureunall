상태: 완료
이어하기시도: 0
작업폴더: C:\Users\user\Desktop\github\pureunall\.claude\worktrees\govaid-1a3b2a
가지: claude/govaid-1a3b2a

# 🎯 기업정부지원금 — 사라진 정기 조사 예약 작업 다시 만들기 · 본문을 저장소에

2026-11-07 밤 Windows 재설치(C 드라이브 포맷)로 이 PC 의 예약 작업 둘(govaid-monthly-closure · govaid-yearly-refresh)이 없어졌다(2026-11-08 확인: 예약 작업 0개).
사용자 「다시 만들기」 → 「저장소에 남기기」.

- [x] 예약 작업 둘을 이 PC 에 다시 만듦 — 예전 본문은 사라져 README·BRIEF·스크립트를 바탕으로 다시 씀(순서·안전장치는 같고 문장은 다를 수 있음). 자동(Auto) 권한으로 저장됨
  · 매월 1일 09:30: 가. 접수 상태(export → 조사 담당 넷 → load-close) · 나. 연간 안내 자료(guide-list → 자료마다 한 명 → load-yearly → guide-done)
  · 매년 1월 20일 10:00: export → 조사 담당 일곱(기존 사업 넷 · 고용노동부 · 다른 부처 · 충남 지역) → load-yearly
  · 둘 다 기준본에서 origin/main 을 임시 폴더로 꺼내 돌리고 끝나면 지움 — 다른 방의 작업 폴더를 건드리지 않음
- [x] 본문을 저장소에: scripts/govaid-refresh/TASK-monthly.md · TASK-yearly.md, README «예약 작업 다시 만들기»
- 확인한 것(읽기만): 이 PC 에서 firebase 로 운영 사전 176건 읽힘 · 서버 공고 감시 2026-11-08 08:10 에 돎 · 이번 달 읽을 안내 자료 6건(아직 한 건도 안 읽음) · 접수 상태 마지막 기록은 2026-10-12 첫 조사
- 아직: 다시 만든 예약 작업은 실제로 돌려 보지 않았다 — 첫 실행 2026-12-01
