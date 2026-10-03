# perf/mail-allrows — 메일 창: 줄 모음 한 벌 (2026-10-03 밤)

- 대표 「메일창 확인」 실측(메일 1,887통): 처음 열기 멈춤 428ms(괜찮음) · 목록 놓기 25ms · 줄 만들기 3ms.
  느린 곳은 «칸 옮기기»(openMailBox) 139ms — mbAllRows 6번 · 스팸 판정 7,500번 · 분류 칸 규칙 15,000번.
- 까닭: mbAllRows 가 부를 때마다 1,887통을 «새 줄»로 다시 만들어, 객체를 열쇠로 기억하는 셈이 한 번도 안 맞았다.
- 고침: mbAllRows 를 그리는 동안 칸마다 한 벌(사본 배열 건넴) · mbBinIdOfRow 도 메일 한 통에 한 번.
  ⚠ 담당자 셈(mbWhoTally·mbSentTally)은 객체 «하나를 돌려 쓴다» — `_reuse:1` 표시를 달아 기억하는 셈이 건너뛰게 했다
    (안 그러면 첫 메일 답이 모든 메일에 간다 — 검사 mail-owner-dash 가 잡았다).
  mbWhoBust 가 allRows·binOf 도 버린다.
- 검사: tests/cards-mb-hot-memo.test.js ⑤⑥
