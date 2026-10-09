# 2026-10-09 · 포털 기업정보함 타일의 숫자를 걷었다 (대표 지시 「숫자 안보이게 정리해달라」)

가지: `portal-cards-no-badge`

- 포털(enter.html) 기업정보함 타일의 호박색 «할 일» 숫자 배지(2026-10-04 「추천대로」로 단 것)를 걷었다 —
  `연락처배지달기` · 부르는 자리 · `.nl-warn.cn-todo` 색 규칙.
- 기업정보함(pu-cards.html)이 그 수를 `pucards/config/mailNewCount` 에 적던 `mnewCntStore` 도 걷었다 — 읽는 곳이 없어 헛쓰기.
  ⚠ 서버에 남은 옛 값 한 줄은 지우지 않았다(아무도 안 읽음, 해 없음).
- 그대로 둔 것: 기업정보함 안 「📥 연락처 정리」 수(이 기기 localStorage) · 뉴스레터 ⚠ 경고 · `?cnt=1` 로 연락처 정리 여는 길.
- 검사: `tests/portal-contact-badge.test.js` 를 «숫자를 달지 않는다»로 고쳐 씀(옛 코드에서 2건 실패 확인).
