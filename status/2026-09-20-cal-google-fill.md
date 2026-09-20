# 2026-09-20 feat/cal-google-fill

## 무엇을 했나

대표 지시 「본인의 업무가 구분되게 색조정 더하고 싶다 … 각사람마다의 색을 어떻게
중복되지 않게 할 것인가」. 견본 셋(구글식 채움·내 것만 채움·조용하게)을 9월 실제
일정으로 그려 보여 드리고 「1」(구글식 채움)을 골랐다.

- `pu-cal.html` — `chipHtml`: 내 일정(사번이 ME 와 같음)은 원색으로 채우고, 남의
  일정은 옅게 깔고 왼쪽에 원래 색 띠를 남긴다. `textOn`: 사람 눈 밝기 어림(0.62
  문턱) 대신 «실제 대비를 재서» 흰/검을 고른다 — 옛 어림은 초록(#51b749) 위에
  짙은 글자를 놓아 2.55:1까지 떨어졌었다.
- `pu-erp.html` — 새 외부 협력자를 등록할 때 색을 정하던 `EXT_COLOR_PALETTE`
  (열 자리에 파랑 여섯·초록 셋뿐 — 넣을수록 겹쳤다)를 지우고, «지금 쓰이는 모든
  색(직원+외부)과 가장 먼 색»을 계산해서 주는 `extNextColor`/`extColorDistance`
  로 바꿨다. 후보 24색은 서로 ΔE 20 이상이도록 재서 짰다.
- **실데이터 고침(Firebase, 코드가 아니라 값)**: 실측으로 확인한 실제 충돌 둘 —
  장한돌(#7c3aed)·박병훈(#9333ea) ΔE 7.1, 박은비(#51b749)·추연철(#16a34a) ΔE 13.0.
  `external_staff`(`/data/external_staff/v/ex-seed-{3,7,8}/color`)의 추연철·
  박병훈·장기진 색을 새 값(#1d1de7·#e71ddd·#812d8b)으로 바꿨다. 직원 열 명 색은
  안 건드렸다(이알피/구글이 정하는 것 — [[cal-gcal-is-the-real-data]] 규칙).
  ⚠ 첫 시도에서 경로를 잘못 짚어(`/data/external_staff/ex-seed-N/color` — `v.`
  한 단을 빼먹음) 곁가지 키 셋을 만들 뻔했다. 곧바로 지우고 다시 확인한 뒤 올바른
  경로(`/v/ex-seed-N/color`)로 다시 썼다. 최종 확인: 8개 레코드 모두 색 세 개만
  바뀌고 나머지 칸(연락처·메모·shareKey·sortOrder)은 그대로다.

## 검사

- 새 `tests/cal-mine-first.test.js` — 채움/내일정 구분/textOn 대비/어두운판/
  extNextColor 아홉 개.
- `tests/cal-dark-mode.test.js` — 칩 자체 검사(②~⑤)는 새 파일로 옮기고, 나머지
  (mixHex·어두운판 단추·팔레트·오늘칸)는 그대로 남김. 네 번째 판을 헤더에 적음.
- `tests/cal-fits-one-screen.test.js` — chipHtml 이 참조하는 새 상수(칩_어둠_누름·
  칩_옅게)와 `ME`를 상자에 추가.
- `tests/color-palette.test.js` — 사람 구분색(EXT_PERSON_COLORS) 예외 추가.
  gov-consulting.html 의 GCAL11 예외와 같은 근거(대표 결정 2026-08-30 「가」).
- 전체 `cal-*`·팔레트·`staff-color-one-place` 213개 통과.

## 남은 일

- 없음. 이 판(견본 「1」)이 최종 결정이다.
