# 2026-10-12 · 취업규칙 🏢 사업장 표 — 50곳씩 쪽 · 머리줄 거르기·순서

설계 `docs/superpowers/specs/2026-10-03-취업규칙-새로짓기-design.md` §12 · 계획 `docs/superpowers/plans/2026-10-12-취업규칙-사업장표-쪽·거르기.md`.

## 왜
사업장 표가 한 번에 수백 곳을 그려 길고, 칸별로 걸러 보거나 순서를 바꿀 길이 없었다.

## 한 것
- `js/rules-v2/lib-sitecols.js`(셈) · `js/rules-v2/view-sites.js`(머리 단추·창·거른 조건 띠·쪽 막대) — 앞 단계에서 끝.
- `rules-v2.html` 꽂기(이번):
  - 스크립트 `lib-sitecols.js?v=1` 를 lib-sites 뒤·view-sites 앞에.
  - 상태 `ST.sites` 에 `cols`·`sort`·`page`·`pop`·`popq`·`popPos` — 저장하지 않는다(새로 열면 처음 상태).
  - 손잡이 `colOpen`·`colClose`·`colSort`·`colToggle`·`colClear`·`colsClear`·`colWho`·`colq`·`pageGo`.
    `colClose` 는 늘 다시 그린다(그림이 «창이 열려 있을 때만» 부르므로).
  - 칩·검색·담당·칸 거르기·순서를 바꾸면 1쪽으로. 사업장 고르기·새로고침은 쪽을 안 건드린다(없는 쪽은 그리는 쪽이 당긴다).
  - 쪽을 누르면 표 맨 위로. 모양(CSS)은 이 화면에 이미 쓰인 색만, 창 입력칸은 16px.
- 이름 창(`🔍 이름 · 사업자번호`)에서 글을 칠 때 포커스가 위쪽 검색칸으로 튀지 않게 `sq` 의 포커스 되돌림이 «열린 창 안 입력칸»을 먼저 찾는다.
- 검사 `tests/rules-sitecols-wire.test.js` — 손잡이 이름·조건 바꾸면 1쪽·순서 단추 다시 누르면 풀림·캐시 번호·창 닫기 무조건 다시 그림.

## 남은 일
- 「📥 모은 자료」 표에도 같은 쪽 막대 — 대표 확인 후.
- 담당 칸은 «한 사람 고르기»만 지원(여럿 고르기는 안 함).
