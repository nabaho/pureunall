# 컨설팅보고서 앱 UI 재정리 — 2단계: 사업별 대시보드 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 왼쪽에서 사업을 고르면 서류 패널 위에 «사업 대시보드»(숫자 4칸 · 단계별 진행 막대 · 업체별 단계 점)를 보여 주고, 대형 사업은 «표 / 보드» 보기를 바꿀 수 있게 한다. 왼쪽 사업 항목에는 막힌 단계가 있으면 붉은 숫자를 단다. (대표 「섞어서 진행」·「2 3 단계 순서대로」의 2단계 — 목업 A·B, 저장소 밖.)

**Architecture:** 새 순수 모듈 `js/pu-gov-report-dash.js`(`PuGovReportDash`)가 `PuGovReportDocs.docsTable()` 출력(업체 줄 · 단계 칸)을 받아 칸 상태 판정 → 단계별 집계 · 업체별 점 · 숫자 4칸 · 보드 열 배치를 계산한다. 화면(`gov-report.html`)의 `grRenderDocs` 가 그 결과로 대시보드 카드를 서류 표 위에 더한다. **새 DB 칸·새 쓰기·새 규칙 없음**(읽기 전용 화면 재구성). 보기 선택(표/보드)은 브라우저 `localStorage`(편의용, try/catch).

**Tech Stack:** 정적 HTML + 바닐라 JS(IIFE 브라우저·Node 겸용), `node --test`.

**Spec:** 별도 설계서 없음 — 대표가 고른 목업 A(대시보드: 숫자 4칸·단계 진행 막대·업체별 점)·B(보드)와 본 계획서 «정한 것»이 설계다.

## 정한 것 (제가 정했다 — 대표 「묻지말고 끝까지」)
- **자리**: 지금 구조(왼쪽 사업 목록 + 가운데)를 유지한다. 사업을 고르면 `#docs` 패널 맨 위(머리줄 아래)에 대시보드가 들어가고 그 아래에 기존 서류 표(또는 보드)가 온다. 3열(오른쪽 «이 사업에서 챙길 것») 개편은 3단계 「오늘 할 일」에서 한다.
- **칸 상태 5가지**: `done 완료 · doing 진행 · blocked 막힘 · none 미착수 · na 해당 없음` + 읽을 수 없음 `unknown`(서류 진행 기록을 못 읽었을 때). 집계에서 `na`·`unknown` 은 분모에 넣지 않는다.
  - 대형 칸(`cell.chip`·`cell.st`): 키 없는 칸(`chip === null`) = `na`. 기록을 못 읽었으면(`trackKnown:false`) 전부 `unknown`.
  - 간단형(자동) 줄: ①②(보고서 칸) 키 `done`→`done`, `draft`→`doing`, `todo`·`''`(「—」)→`none`(여기서 `todo` 는 «미작성» 뜻 — 막힘 아님). ③④⑤(기록 칸): `cell.st` 가 있으면 그것, 「—」 이면 기록을 읽었을 때 `na`·못 읽었으면 `unknown`.
- **숫자 4칸**: 진행 업체 N · 막힌 업체 N(막힌 칸이 하나라도 있는 업체) · 기한 14일 안 N(이미 지난 것 포함, 끝난 업체 제외) · 모두 끝 N. 기한 = 줄의 `due`(계약 종료일, `YYYY-MM-DD`; 비면 `null`).
- **끝난 업체(finished)**: 판정 가능한 칸(`unknown` 아님·`na` 아님)이 1개 이상 있고 전부 `done`.
- **보드(대형만)**: 열 = 단계(`table.cols` 순서), 업체 카드는 «다음 단계»(`line.next.id`) 열에 한 장. `next === null`(모두 끝) → 맨 끝 「모두 끝」 열, `next === undefined`(기록 못 읽음) → 「기록 미확인」 열 하나로 모은다. 카드를 누르면 그 단계의 칸 창이 열린다(칸에 칩이 있을 때 — 기존 `data-cell` 위임 그대로), 없으면 「목차」 창.
- **왼쪽 붉은 숫자**: `PuGovReportDocs.blockedAlerts` 를 사업(일정 사업 번호 typeId)별로 센 업체 수. 종결 사업·0 은 안 단다.
- **간단형도 대시보드**: 단계 막대·숫자는 간단형(자동) 사업에도 보인다(열 = `table.cols` ①~⑤). «표/보드» 전환은 대형만. 서류 틀이 없는 사업(`!auto && !big`)은 대시보드 없음(기존 그대로).

## Global Constraints

- **새 쓰기·새 DB 칸·규칙 변경 없음.** `gov-report.html` 정적 검사의 쓰기 목록(`.set(` 둘: `grSaveCell`·`grCloseBiz` 계열)은 그대로.
- 기존 `PuGovReportDocs.docsTable`·`blockedAlerts`·`PuGovReportTrack` 출력은 **바꾸지 않는다**(새 모듈이 읽기만). 기존 검사(칸 창·서류 표·종결·받은 서류함)는 그대로 통과해야 한다.
- 값은 `grEsc`. 공개 저장소: 합성 이름만, 검사에 `?v=숫자` 금지(`\?v=\d+`), 바뀐 스크립트는 `?v` 올림(훅, `--no-verify` 금지). `gov-report.html` 은 부분 편집·줄바꿈 보존(CRLF 여부 먼저 확인).
- 새 `<script src="js/pu-gov-report-dash.js?v=…">` 는 `pu-gov-report-docs.js` 다음에 싣는다(`PuGovReportTrack` 상수가 필요하면 옆 모듈을 불러 쓴다).
- 다크 모드·좁은 화면(≤ 760px)에서 깨지지 않는다(기존 CSS 변수 사용, 색 직접 지정 금지 — 기존 `.st-*` 색 토큰 재사용).

## Review Focus

- 기록을 못 읽었을 때(`trackErr`): 대시보드는 «기록을 못 불러와 단계 현황을 알 수 없습니다» 한 줄 + 업체 수만, 막대에 가짜 0%/100% 를 그리지 않는다 — Task 1·2 검사.
- 단계 칸이 전부 `na` 인 열(예: 기술보호 ③): 막대 «해당 없음»으로 표시(0/0 나눗셈 없음) — Task 1 검사.
- 업체가 0 곳인 사업(`lines: []`): 대시보드 안 그림(기존 「이 사업 업체가 없습니다」) — Task 2 검사.
- 간단형 ①②: `todo` 키는 «미착수», 막힘으로 세지 않는다 — Task 1 검사.
- 보드에서 같은 이름 업체 둘·`next` 없는 업체 — Task 1 검사.
- 종결 사업을 눌러 봤을 때도 대시보드가 보인다(종결 배너 아래) — Task 2.

---

## File Structure

| 파일 | 일 |
|---|---|
| `js/pu-gov-report-dash.js` (신설) | 칸 상태 판정·단계 집계·업체 줄 요약·숫자·보드 배치·사업별 막힘 수 |
| `gov-report.html` | 대시보드 카드(숫자·막대·업체 점)·표/보드 전환·왼쪽 붉은 숫자·CSS |
| `tests/gov-report-dash.test.js` (신설), `tests/gov-report-app.test.js` | 검사 |
| `STATUS.md`, `status/2026-10-12-gov-report-dash.md` | 기록 |

---

### Task 1: 순수 모듈 `PuGovReportDash`

**Files:** Create `js/pu-gov-report-dash.js`, `tests/gov-report-dash.test.js` (IIFE — `module.exports` / `window.PuGovReportDash`, 옆 모듈 `pu-gov-report-nav.js` 의 꼴을 따른다)

**Interfaces:**
- Consumes: `PuGovReportDocs.docsTable(o)` 출력 `t = {plan, auto, big?, cols:[이름], lines:[{coId,coName,typeId,year,rid,rounds,planned,cells,due,next?}]}`. 칸(cell): 간단형 = `{txt,key,(step,st,…)}`(①②는 `chips(r)` 의 `{txt,key}`), 대형 = `{id,name,step,chip:{txt,key}|null,st}`. `line.next` = `{id,name}`|`null`|(속성 없음 = 간단형 / `undefined` = 기록 못 읽음).
- Produces:
  - `STATE = ['done','doing','blocked','none','na','unknown']`
  - `cellState(cell, ctx) → STATE 중 하나` — `ctx = {auto:bool, idx:number, trackKnown:bool}`.
  - `summarize(table, o) → { known:bool, kind:'big'|'auto', cols:[{name,done,doing,blocked,none,total}], lines:[{coId,typeId,coName,states:[STATE…],blockedN:number,finished:bool,rounds:number,planned:number,next:{id,name}|null|undefined,due:string,dueDays:number|null,soon:bool}], kpi:{n,blocked,soon,finished} }` — `o = {trackKnown, today:'YYYY-MM-DD', soonDays:14}`. `table` 이 비었으면(`lines` 0) `kpi.n = 0`.
  - `board(table, summary) → { cols:[{id,name,cards:[{coId,typeId,coName,blockedN,rounds,planned,due,dueDays,cell:{step,id}|null}]}] }` — 대형만(아니면 `{cols:[]}`). 맨 끝에 `{id:'__done',name:'모두 끝'}`·(해당 업체 있을 때만) `{id:'__unknown',name:'기록 미확인'}`. 열 안 카드 순서 = 업체 이름 가나다(`localeCompare 'ko'`), 같으면 입력 순서.
  - `blockedCounts(alerts) → {typeId: 업체수}` — `blockedAlerts` 출력(업체 이름 순 배열)에서 typeId 별 업체 수(같은 업체·사업은 한 번).
  - `dueDays(due, today) → number|null` — 일 수(due − today, 음수 = 지남). 잘못된 날짜·빈 값은 `null`.

- [ ] **Step 1: 실패하는 검사 쓰기** (`tests/gov-report-dash.test.js`) — 아래를 모두 포함:
  - `cellState`: 대형 `{chip:null}`→`na`; 대형 `{chip:{key:'done'},st:'done'}`→`done`; `trackKnown:false`→`unknown`; 간단형 idx 0 `{key:'todo',txt:'미작성'}`→`none`(막힘 아님); idx 0 `draft`→`doing`; idx 1 `{txt:'—',key:''}`→`none`; idx 2 `{st:'blocked'}`→`blocked`; idx 3 `{txt:'—',key:''}` + `trackKnown:true`→`na`, `false`→`unknown`.
  - `summarize` 대형 3업체(하나 막힘·하나 모두 끝·하나 진행): 열 집계 합이 업체 수, `kpi` 값, `finished`/`blocked` 업체 수, 막힌 업체가 `blockedN≥1`.
  - 기한: `today` 2026-10-12, due 2026-10-20 → `dueDays 8`·`soon true`; due 2026-10-01 미완료 → `dueDays -11`·`soon true`(지남 포함); due 2026-12-31 → `soon false`; 끝난 업체는 due 가 임박해도 `soon false`; due `''` → `null`.
  - 열 전체가 `na`(간단형 techguard ③) → 열 `total 0`(나눗셈 없음, 던지지 않음).
  - `trackKnown:false`: `known:false`, 모든 칸 `unknown`, 열 집계 `total 0`, `kpi.blocked 0`, `kpi.n` 은 업체 수.
  - `lines: []` → `kpi.n 0`, 던지지 않음. `table` 이 `null`·`undefined` → 던지지 않고 빈 요약.
  - `board`: 열 순서 = `table.cols` + `모두 끝`; `next:{id}` 로 해당 열; `next:null`→모두 끝; `next:undefined`(속성은 있으나 값 없음)→기록 미확인 열이 **생김**, 그 업체가 없으면 열이 **없음**; 이름 같은 두 업체 순서 안정; 카드 `cell` = 그 열 단계의 칸이 칩을 가졌으면 `{step,id}`, 아니면 `null`; 간단형 table 이면 `{cols:[]}`.
  - `blockedCounts`: 같은 typeId 에 두 업체 → 2; 같은 업체·사업 중복 항목 → 1; 빈/잘못된 입력 → `{}`.
  - 입력 불변: 같은 table 을 두 번 넣어도 같은 결과·원본 안 바뀜(`JSON.stringify` 비교).
- [ ] **Step 2: 실패 확인** — `node --test tests/gov-report-dash.test.js` → 모듈 없음으로 실패.
- [ ] **Step 3: 구현** (`js/pu-gov-report-dash.js`) — 순수 함수만. DOM·전역 의존 없음. 위 «정한 것»의 상태·집계·finished·soon 규칙 그대로.
- [ ] **Step 4: 통과 확인** — 같은 명령 PASS. `node --test tests/` 중 `gov-report-*` 도 PASS.
- [ ] **Step 5: 커밋** — `feat(gov-report): 사업 대시보드 순수 모듈 PuGovReportDash`.

---

### Task 2: 화면 — 대시보드 카드 · 표/보드 전환 · 왼쪽 붉은 숫자

**Files:** Modify `gov-report.html`(CSS·`<script>`·`grRenderDocs`·`grBizBtn`/`grRenderBiz`·위임 핸들러), `tests/gov-report-app.test.js`

**Interfaces:**
- Consumes: Task 1 의 `PuGovReportDash.summarize / board / blockedCounts`; 기존 `grRenderDocs` 의 `t = D.docsTable(...)`·`GR.trackErr`·`GR.today`·`grClosedBanner()`·`.cellb[data-cell]` 위임·`btn(x,'목차')`·`PuGovReportDocs.blockedAlerts`.
- Produces: `#docs` 안 대시보드 영역 `<div class="dsh">`(숫자 4칸 `.dsh-k` · 단계 막대 `.dsh-p` · 업체 점 줄 `.dsh-l`) · 대형 사업의 보기 전환 단추 `[data-dv="table|board"]`(상태 `GR.dashView`, `localStorage['gov_dash_view']`) · 보드 `.bd-col > .bd-card`(`button.cellb` 이거나 «목차» 단추 속성) · 왼쪽 항목의 `.bz-al`(붉은 숫자).

- [ ] **Step 1: 실패하는 검사 쓰기** (`tests/gov-report-app.test.js` 의 기존 정적 검사 꼴을 따른다):
  - `<script src="js/pu-gov-report-dash.js?v=…">` 가 `pu-gov-report-docs.js` 다음에 있다(`\?v=\d+` 정규식).
  - 소스에 `PuGovReportDash.summarize(`·`PuGovReportDash.board(`·`PuGovReportDash.blockedCounts(`·`data-dv=`·`dsh`·`bd-card`·`bz-al` 이 있다.
  - 새 쓰기 명령이 없다(기존 «쓰기 명령 목록» 검사가 그대로 통과 — `.set(` 개수 불변).
  - 기록을 못 읽었을 때 안내 문구 «단계 현황을 알 수 없습니다» 가 소스에 있다(`GR.trackErr` 분기).
  - 보기 선택 저장은 `try { … } catch` 로 감싼 `localStorage` 만 쓴다(소스 정규식 검사).
- [ ] **Step 2: 실패 확인** — `node --test tests/gov-report-app.test.js`.
- [ ] **Step 3: 구현**
  - `grRenderDocs` 에서 `t` 계산 뒤: `t.big || t.auto` 이고 `t.lines.length` 이면 `var S=PuGovReportDash.summarize(t,{trackKnown:!GR.trackErr&&!!GR.track,today:GR.today})` → `grDashHtml(t,S)` 를 머리줄 아래·표 위에 넣는다. `t.big` 이고 `GR.dashView==='board'` 이면 표 대신 `grBoardHtml(t,S)`.
  - 대시보드 카드(`grDashHtml`): 숫자 4칸(진행 업체·막힌 업체·기한 14일 안·모두 끝 — 막힌/기한 지남이 있으면 `.bad`/`.warn` 색), 단계 막대(열마다 이름 · 누적 막대 `완료/진행/막힘/미착수` · 글줄 «완료 a · 진행 b · 막힘 c»; `total 0` 이면 «해당 없음»), 업체 점 줄(업체 이름 · 점 열 · 회차 `r/n` · 다음 단계 · 막힘 딱지 — 점마다 `title="단계: 상태"`). `S.known` 이 거짓이면 숫자 4칸 대신 «기록을 못 불러와 단계 현황을 알 수 없습니다» 한 줄 + 업체 수만. 대형이면 «표 | 보드» 단추(`data-dv`). 막대 색은 기존 `.st-done`/`.st-draft`/`.st-todo`/`.st-wait` 계열 토큰을 쓴다(없으면 `--ok`/`--accent`/`--bad` 같은 기존 변수; 새 하드코딩 색 금지).
  - 보드(`grBoardHtml`): `PuGovReportDash.board(t,S)` 열을 가로 스크롤 칸으로, 카드 = `button.cellb.bd-card`(`data-cell="1" data-co data-ty data-step data-item`) — `card.cell` 이 `null` 이면 `data-toc="1"` 인 «목차» 단추로(기존 `.tocb` 위임). 막힘 카드는 붉은 왼쪽 띠·«막힘» 딱지.
  - 위임: `[data-dv]` 클릭 → `GR.dashView` 바꾸고 저장(try/catch), `grRenderDocs()` 만 다시 그림. 시작 때 `localStorage` 에서 읽어 `'board'` 만 인정(기본 `'table'`).
  - 왼쪽: `grRenderBiz` 에서 `PuGovReportDocs.blockedAlerts({input:GR.input,year:GR.f.year,track:GR.track,biz:d.biz,tmap:d.tmap,consultings:d.cons})` → `PuGovReportDash.blockedCounts` → 항목 `grBizBtn` 에 typeId(`D.linkOf(t.code,d.tmap,GR.input.types)`) 로 찾아 `<span class="bz-al" title="막힌 단계가 있는 업체 N곳">N</span>`(종결 항목·0 은 안 단다). 기록을 못 읽으면(`GR.trackErr`·`!GR.track`) 안 단다.
  - CSS 는 기존 `.dc-h`·`.dc-wide` 근처 스타일 꼴로; 좁은 화면(≤760px)에서 숫자 4칸은 2×2, 막대는 2열.
- [ ] **Step 4: 통과 확인** — `node --test tests/gov-report-app.test.js` 와 `node --test tests/` 의 `gov-report-*`·`photos-staff-share`·`test-pin-guard` 모두 PASS. 바뀐 `<script>` 와 새 스크립트는 `?v` 올림(훅 통과).
- [ ] **Step 5: 커밋** — `feat(gov-report): 사업 대시보드 — 숫자·단계 진행 막대·업체 점·대형 표/보드·왼쪽 막힘 숫자`.

---

### Task 3: 기록

**Files:** Modify `STATUS.md`(맨 끝 한 줄, BOM+CRLF 보존·byte-safe), Create `status/2026-10-12-gov-report-dash.md`

- [ ] 상태 노트(무엇을·어떻게·한계: 화면 실제 확인 못 함 등) + STATUS.md 한 줄(``[x]`` 형식은 앞 줄들을 따른다, 낡은 «[ ] 설계» 줄이 있으면 지운다).
- [ ] 커밋 — `docs(status): 사업 대시보드(UI 2단계) 기록`.
