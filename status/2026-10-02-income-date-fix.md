# 2026-10-02 · income-date-fix — 입금관리 「reading 'date'」 멈춤

- 까닭: 업체입금 칸의 «받음»(isPaid)은 advisoryYm(받을 달) 먼저 보는데, 그 건을 찾는 getItem 은 입금일의 달로만 찾았다.
  늦게 들어온 자문료(예: 3월 몫이 4월 9일 입금)는 «받음»인데 못 찾아 item.date 에서 화면 전체가 멈췄다.
- 고침: getItem 도 같은 잣대로 찾는다 + 말풍선은 `paid && item`.
- 실데이터 재셈: 옛 판 멈출 칸 17개(2025년 15·2026년 2) → 새 판 0.
- 검사: tests/income-getitem-advisory-month.test.js (되돌리면 2개 모두 실패 확인).
