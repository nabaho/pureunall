# 2026-10-05 · 월요일 06시 자동발송이 헛돌던 것 (fix/weekly-send-cold-lock)

- 사실: 10/5 06:00 `weeklyNewsletterSend` 가 돌았으나 「이미 처리 중이거나 완료됨」으로 끝남. weeklyReady 상태 «준비» 그대로. 11:12 대표 손 발송(보낸이 p001)으로 나감.
- 원인: `weeklyReady/상태` 거래가 `v === "준비" ? "거는중" : undefined` — 서버 함수는 그 자리를 구독하지 않아 첫 부름이 null → 접혀 서버에 묻지도 않음(memory rtdb-transaction-cold-abort, 이 저장소 네 번째). 자동발송은 지금까지 한 번도 실제로 나간 적이 없다(지난 회차는 모두 시험).
- 고침: `NewsletterWeekly.자동발송찜` — null 이면 «해 본다»(진짜 값으로 다시 불리고 «준비»만 통과). 오류 때 회차 `발송잠금` 되돌림도 null 에서 접지 않게.
- 검사: `tests/weekly-send-cold-lock.test.js` — 진짜 거래 차례(① null ② 접으면 끝 ③ 값으로 다시) 흉내. 옛 코드로 되돌리면 운다.
- 감시꾼(월 12시 «06시 발송이 아예 안 돌았나»)은 오늘 12시엔 아직 배포 전이라 못 잡았다 — 다음 주부터 잡는다.
- 배포: `weeklyNewsletterSend`
