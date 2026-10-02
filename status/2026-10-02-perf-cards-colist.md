# perf/cards-colist — 큰 목록의 한국어 정렬 (2026-10-02)

- 대표 화면 「처음 뜰 때 느린 까닭 · coListBuild 73ms」(앞서 listItems 247ms·34번).
- 회사 목록 4천여 곳·명함 6천여 장을 `localeCompare(…,'ko')`로 정렬했는데, 이것은 견줄 때마다 한국어 정렬기를 새로 만든다.
  정렬기를 함수에 붙여 하나만 만들고(`Intl.Collator('ko')`), 견줄 값(보여 줄 이름·열 값)은 먼저 한 번 뽑는다.
  담당 열 정렬은 견줄 때마다 ErpMatch.mgrs 를 부르던 것이 한 장에 한 번이 된다.
- 순서는 같다(같은 규칙·안정 정렬). 이 PC 흉내: 4,191곳 19ms → 6ms.
- 검사: `tests/cards-ko-sort-fast.test.js`

## 남은 일
- 대표 PC 에서 「처음 뜰 때 느린 까닭」을 다시 재 본다.
