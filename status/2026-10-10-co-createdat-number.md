# 2026-10-10 · 업체관리 「(y.createdAt || "").localeCompare is not a function」 (fix/co-createdat-number)

- 원인: 공용 저장 관문(js/pu-ontology-write.js 108줄)이 createdAt 이 없던 옛 업체(co-real-*)를 저장할 때 Date.now() «숫자»를 채운다.
  업체관리 refreshCompanies 정렬은 createdAt 을 글자로만 다뤄 멎었다. 10/10 낮(15:26~15:28) 6곳이 그렇게 저장됐다.
- 고침: 정렬이 숫자도 같은 시각의 날짜 글자로 바꿔 견준다. 자료 6곳은 같은 시각의 ISO 글자로 바꿨다(u 도 올림).
- 남은 것: 관문이 숫자를 채우는 것 자체 — 다른 표의 createdAt 도 글자로 쓰는 곳이 많다(온톨로지 방 몫).
- 검사: tests/co-sort-createdat-number.test.js (옛 코드에서 운다).
