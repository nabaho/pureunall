# 6차산업컨설팅 — 충남·세종·충북만 담고 지역을 가르다 (2026-11-28, `feat/sixth-region-split`)

대표 지시: 6차산업 컨설팅 프로그램에는 충남·세종·충북 센터 사업만 넣고, 지역(충남·충북)을 분명하게 가르고,
사업장 이름·연도 열과 대시보드를 정리한다.

## 바뀐 것
- `js/pu-consult-catalogs-b.js` `sixthind`: 트랙을 충남·세종·충북 셋으로(지역 `region`·짧은 이름·배지), `hasLeftDashboard`·`regionLabel`·`leftDash` 문구·`listCols:'split'`·`excludeTrackIds`(`sx_cert`·`sx_gyeonggi`) 추가.
- `js/pu-consult-intake.js`: 후보 추천을 지역 글자 먼저로(충남센터의 인증지원은 충남에 남김). 지역 없는 인증 현장평가·경기는 `excluded` 로 표시해 후보에서 뺀다.
- `js/pu-consult-view.js`: `excludeTrackIds` 사업은 목록·집계에서만 뺀다(자료는 그대로). 왼쪽 대시보드 문구를 카탈로그 값으로(상공회의소 기본 문구는 그대로), `regionManageable:false` 면 «새 지역 추가» 숨김. `listCols:'split'` 이면 표 열을 `연도 · 사업장명 · 지역 센터 · 진행상태` 독립 열로, 같은 연도 안에서 지역 → 사업장명 순.
- `sixthind.html`: 왼쪽 지역 대시보드 틀(`.dash-shell`·`#leftDash`)과 CSS, 연도·진행상태 열 CSS(폰 2줄 카드 순서 포함).
- 공용 스크립트 세 개를 부르는 모든 화면의 `?v=` 를 1씩 올림(`scripts/check-cache-version.js --all` 통과).
- `tools/phone-audit/seeds/sixthind.js`: 충남·세종·충북·제외 대상 지어낸 사업 추가.
- 새 검사 `tests/sixth-region-split.test.js`.

## 안 건드린 것 · 남은 것
- 살아 있는 자료(`scal_sixthind`)는 건드리지 않았다. `sx_cert`·`sx_gyeonggi` 트랙으로 적힌 사업은 지워지지 않고 이 화면에서만 안 보인다 — 되살리려면 카탈로그의 `excludeTrackIds` 에서 빼고 트랙을 되돌리면 된다.
- 이 사업들이 다른 프로그램으로 가야 하는지는 정하지 않았다(대표 확인).
- 지역 글자가 없는 메일·자료는 예전처럼 세종으로 들어간다(기본값) — 지역 미지정 칸은 만들지 않았다.
- 점검: `node tools/phone-audit/run.mjs sixthind --widths=1280,375` 옆넘침·짓눌림 0, 상공회의소(`chamber`)도 같은 방식으로 그려 그대로임을 확인.
