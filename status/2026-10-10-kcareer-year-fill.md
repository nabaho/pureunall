# 2026-10-10 · 경력관리 — 실적 «연도 모름» 채우기 (feat/kcareer-year-fill)

대표 지시: 「년도모름도 채워라」.
실측: 컨설팅 실적 «모름» 58건이 모두 이알피의 «진행 중» 건이었다 — 실적 연도는 «끝난 해»라 끝나기 전엔 비었다.

- 연도 = 끝난 해(closedDate·endDate) → 없으면 시작한 해(startDate·contractDate·signDate) → 없으면 관리번호 속 해.
  아무것도 없으면 그대로 «모름»(지어내지 않음). `KcareerPuSync.yearOf` 한 곳.
- 새로 들어오는 실적도 같은 셈 · 이미 있는 실적은 `buildYearUpdates` — 영구 열쇠 건 중 «빈 연도»만.
- 나중에 끝나면 완료 갱신(buildStatusUpdates)이 «끝난 해»로 바꾼다 — 그대로다.
- 실측: 58건 모두 2026 으로.
- 검사: `tests/kcareer-pusync-year.test.js`.
