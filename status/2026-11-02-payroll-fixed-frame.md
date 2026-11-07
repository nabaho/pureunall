# 2026-11-02 급여아웃소싱 PC 틀·창 흔들림 고정 (`payroll-os.html`)

## 1. 문제 원인
1. **상단 머리줄(`header` · `.cobar`) 높이 1줄↔2줄 출렁임**
   - 지표가 많은 사업장(예: `건도네도마집`, `짐작 연결` + `확정` 포함)이나 비동기 직원 표(`ensureEmps`) 로딩 직후 `.cobar` 가 2줄로 접히면서 `header` 높이가 `48px` → `76px` 로 커져 아래 3칸(`#nav`, `#colist`, `#main`) 전체가 `28px` 아래로 밀렸고, 지표가 적은 사업장(`㈜경보엔지니어링`)을 누르면 다시 1줄로 줄어들며 화면 전체가 위로 당겨졌다.
2. **바깥 브라우저 창 전체 스크롤바 생성·소멸**
   - `.layout` 이 `min-height:calc(100vh - 46px)` 로만 잡혀 있어 본문(`#main`)이 긴 사업장을 누르면 바깥 `body` 전체에 세로 스크롤바가 생기고, 짧은 사업장을 누르면 스크롤바가 사라지면서 전체 화면 가로 폭이 약 `15px` 씩 좌우로 흔들렸다.
3. **`← 뒤로`(`#backbtn`) 표시·숨김에 따른 가로 밀림**
   - 첫 사업장을 고를 때 `display:none` 이던 `#backbtn` 이 나타나며 `급여아웃소싱` 로고와 회사 이름이 오른쪽으로 약 `64px` 밀렸다.
4. **`render()` 호출 시 스크롤 위치(`scrollTop`) 초기화**
   - 사업장 목록(`#colRows`)이나 보기 칸(`#nav`)을 내려서 클릭하거나, 비동기 데이터(`ensureEmps`, `ensureRrn`, `ensureLockLog`) 도착으로 `render()` 가 다시 불릴 때 `innerHTML` 교체로 스크롤이 맨 위(`0`)로 튀었다.

## 2. 조치 내용
- [`payroll-os.html`](../payroll-os.html)
  - `@media (min-width:761px)` 에서 `html, body` 를 `height:100%; overflow:hidden` 으로 잠그고 `header` 를 `height:48px; flex-wrap:nowrap` 1줄로 고정, `.cobar`·`.kpis` 는 `flex-wrap:nowrap; overflow-x:auto; scrollbar-width:none` 으로 줄바꿈을 차단했다.
  - PC 에서 `#backbtn[style*="none"]` 은 `visibility:hidden` 으로 자리를 유지해 첫 클릭 시 로고·회사 이름이 옆으로 밀리지 않게 했다.
  - `.layout`, `nav.viewbar`, `#colist`, `#colRows`, `main` 을 `calc(100vh - 48px)` 높이와 `scrollbar-gutter:stable` 로 분리해 3칸이 각자 칸 안에서만 스크롤되게 하고, `main > .tabs` 도 본문 상단에 고정(`position:sticky`)했다.
  - `render()` 에서 `#nav`, `#colRows` 의 `scrollTop` 을 항상 복원하고, 같은 회사·같은 탭의 비동기 갱신일 때는 `#main` 의 `scrollTop` 도 그대로 유지하도록 수정했다.
- [`tests/payroll-shell.test.js`](../tests/payroll-shell.test.js)
  - PC 틀·창 고정 CSS 규칙 및 `render()` 스크롤 위치 보존 회귀 테스트 2건 추가.
