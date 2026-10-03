# perf/pctable-burst — 명함 표도 몰려오면 끝에 한 번 (2026-10-03 저녁)

- 대표 크롬 실측(#1827 옆줄 묶기·#1830 연락처 정리 반영 뒤, 아무것도 안 누르고 새로 열기):
  「10초 중 858ms · dupGroupsOf 90ms · coList 88ms(4번) · listItems 86ms(8번) · renderPCTable 67ms(5번)」.
- 고침: `renderPCTable` 맨 앞에서 `pcTableBurst()` — 옆줄과 같은 규칙(첫 번째 바로 · 120ms 안은 끝에 한 번).
- 같은 날 #1830(📥 연락처 정리) 실제 자료 확인: 정리할 것 31 · 정리한 것 4(이알피 업체관리 › 노리시스템(주) › 담당자 ↗) · 옆줄 불 들어옴 · 메일 차림 아님.
- 검사: `tests/cards-pcside-burst.test.js` 표 한 건 더함.
