상태: 완료
# 2026-10-12 · 정부사업일정 공휴일을 공공데이터 공용 자리에서 (대표 「진행」)

가지: `consult-holidays`
- gov-consulting.html getHoliday: 받아 온 해(pubdata/common/holidays)는 천문연이 이기고, 못 받은 해는 미리 계산한 표(HOLIDAYS)로.
- 까닭: 표에 2026·2027 노동절·제헌절, 2027 대체공휴일(노동절·제헌절)이 없었다(실측) — isBlocked 가 그날을 막지 않아 일정이 잡힐 수 있었다.
- 검사: tests/pubdata-holidays.test.js 정부사업일정 칸.
