# 컨설팅보고서 앱 UI 재정리 — 3단계: 「오늘 할 일」 첫 화면 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사업을 안 골랐을 때(첫 화면) 지금 표 대신 «오늘 할 일»을 첫 화면으로 보여 준다 — ① 사업별 카드 띠(단계 진행 막대·막힘/기한 한 줄) ② 급함 / 챙기기 / 이번 주 세 묶음의 «한 줄 = 한 가지 일» 목록(업체·사업·이유·「서류 열기」) ③ 받은 서류 확인 요약. 지금의 숫자·거르개·전체 표는 「📋 전체 현황」 탭으로 그대로 남긴다. (대표 「섞어서 진행」·「2 3 단계 순서대로」의 3단계 — 목업 C, 저장소 밖.)

**Architecture:** 새 순수 모듈 `js/pu-gov-report-today.js`(`PuGovReportToday`)가 이미 있는 알림 결과(`PuGovReportList.alerts` · `PuGovReportTrack.alertsExtra` · `PuGovReportDocs.blockedAlerts`)와 사업별 대시보드 요약(`PuGovReportDash.summarize`, 2단계)을 받아 «할 일 목록»과 «사업 카드 띠»를 계산한다. 화면(`gov-report.html`)은 첫 화면 영역 `#today` 와 탭(오늘 할 일 / 전체 현황)을 더하고, 사업을 고르면 지금처럼 사업 대시보드(2단계)로 간다. **새 DB 칸·새 쓰기·새 규칙 없음.** 마지막으로 연 탭은 `localStorage`(편의용, try/catch).

**Tech Stack:** 정적 HTML + 바닐라 JS(IIFE), `node --test`.

**Spec:** 별도 설계서 없음 — 대표가 고른 목업 C(오늘 할 일 중심)와 본 계획서 «정한 것»이 설계다.

## 정한 것 (제가 정했다 — 대표 「묻지말고 끝까지」)
- **자리·전환**: `GR.f.biz === ''`(사업 안 고름)일 때 가운데 영역에 탭 둘 — 「🎯 오늘 할 일 N」(기본) · 「📋 전체 현황」(지금의 숫자 칸·거르개·전체 표). 사업을 고르면 탭은 숨고 2단계 사업 대시보드 + 표/보드. 왼쪽 목록 머리에 「🎯 오늘 할 일」 단추를 둬 사업을 푼다(`grSetBiz('')` + 탭 `today`). 연도 막대는 두 탭 모두 위에 그대로.
- **할 일 종류와 묶음**(한 업체·사업 쌍은 한 줄만 — 아래 순서가 앞선 종류가 이긴다):
  1. 🔥 급함 `hot`: `overdue`(제출 기한 지남 — `alertsExtra.overdue`, 간단형) · `blocked`(막힌 단계 — `blockedAlerts`) · `unwritten`(종료 14일 넘은 미작성 — `alerts.unwritten`)
  2. ⏳ 챙기기 `mid`: `waitSign`(서명 회신 7일 넘게 기다림 — `alertsExtra.waitSign`) · `soon`(계약 종료 7일 안·아직 안 끝남 — 대시보드 업체 줄의 `dueDays` 0~7 && !finished, 기한 지난 것은 `overdue` 쪽에서 다룸; 간단형·대형 모두)
  3. 📝 이번 주 `low`: `staleDraft`(초안 7일 넘게 묵음 — `alerts.staleDraft`)
  - 종결 사업은 이미 입력에서 빠져 있다(호출하는 쪽이 `grClosedTypes` 로 거른다). 기록을 못 읽었으면(`trackErr`) `blocked`·`waitSign`·`overdue`·`soon` 은 못 만든다 — 목록 위에 «기록을 못 불러와 일부 할 일을 알 수 없습니다» 한 줄.
- **줄 모양**: `{ id, kind, level, coId, typeId, coName, typeName, title, meta, tags:[…], days }` — `title` = 한 문장(예: 「다라정밀 · 수행계획서가 막혀 있습니다」), `meta` = 근거 한 줄, `tags` = [사업 이름, 종류 딱지]. 묶음 안 정렬 = 급한 순(`days` 큰 순 → 업체 이름 가나다 → 입력 순서).
- **단추**: 모든 줄 「서류 열기」 = 그 사업을 왼쪽에서 고르고(`D.erpTypeFor(typeId,…)` 의 이알피 코드; 못 찾으면 단추 대신 정부사업일정 링크 `reportHref`) 그 업체의 «목차» 창을 연다(`grOpenToc`). 쓰기 없음.
- **받은 서류 묶음**: 목록 가운데 📬 묶음 하나 — 전역 받은 서류 확인(`GR.gi`) 상태를 따른다: `idle`/`err` = 안내 + 「📥 확인」 단추(`grGlobalInbox()`, 눌렀을 때만 메일함 읽음), `ok` = 연결 안 된 건수 + 처음 5건(`서류 칸 열기` `grOpenFromInbox(i)` 재사용) + «전체는 오른쪽 📥 받은 서류 확인», `loading` = 불러오는 중. **메일함은 첫 화면이 자동으로 읽지 않는다.**
- **사업 카드 띠**: 이 해에 업체가 있는 진행 사업 카드(`PuGovReportNav.build(...).open`, 종결·업체 없음 제외). 카드 = 사업 이름 · (수행기관) 작게 · 단계 누적 막대(`Dash.summarize(...).cols` 의 `done/doing/blocked/none` 합) · 「N곳 · 막힘 n / 기한 n / 정상」 한 줄. 누르면 `grSetBiz(code)`. 틀이 없는 사업(`!auto&&!big`)은 막대 없이 업체 수만. 기록을 못 읽었으면 막대 없이 업체 수만.
- **보이기 한도**: 묶음마다 처음 8줄 + 「더 보기 (+N)」(상태 `GR.todayMore[level]`). 할 일이 하나도 없으면 «오늘 급한 일이 없습니다» 한 줄.
- **오른쪽 패널**: 오늘 할 일 탭이 열려 있을 때는 오른쪽 «⏰ 챙길 것» 구역(`#alerts` 를 감싼 `section`)을 숨긴다(같은 내용이 가운데에 있다) — 렌더는 그대로 하고 `display` 만. 양식 서고·받은 서류 확인 구역은 그대로.
- **리드 줄**: 「오늘 YYYY-MM-DD · {이름} — 급한 것부터」. 이름 = `GR.staffMap[GR.me]`(없으면 이름 없이 날짜만).

## Global Constraints

- **새 쓰기·새 DB 칸·규칙 변경 없음**(`gov-report.html` 정적 검사의 쓰기 목록 불변). 새 모듈은 순수 함수 — 입력을 바꾸지 않는다.
- 기존 `List.alerts`·`Track.alertsExtra`·`Docs.blockedAlerts`·`Docs.docsTable`·`Dash.summarize`·`Nav.build` 출력을 **바꾸지 않는다**. 오른쪽 `#alerts`·`#ginbox`·`#forms` 의 기존 검사는 그대로 통과(숨김은 `display` 만).
- 값은 `grEsc`. 합성 이름만, 검사에 `?v=숫자` 금지(`\?v=\d+`), 바뀐 스크립트는 `?v` 올림(훅, `--no-verify` 금지). `gov-report.html` 은 부분 편집·줄바꿈 보존.
- 다크 모드·좁은 화면(≤ 760px)에서 깨지지 않는다(기존 CSS 변수만, 색 직접 지정 금지).
- 새 `<script src="js/pu-gov-report-today.js?v=…">` 는 `pu-gov-report-dash.js` 다음.

## Review Focus

- 같은 업체·사업이 막힘 + 서명 대기 + 기한 임박에 동시에 걸려도 **한 줄**(가장 급한 종류) — Task 1 검사.
- `soon`: 기한 오늘(0일)·7일은 포함, 8일·지남은 제외(지남은 `overdue`), 끝난 업체(`finished`)는 제외 — Task 1 검사.
- 기록을 못 읽음(`known:false`/`trackErr`): `blocked`·`waitSign`·`overdue`·`soon` 줄이 **0**이고 안내 한 줄만(가짜 «정상» 없음) — Task 1·2 검사.
- 업체 이름이 같은 두 업체, `typeName` 비어 있음, `days` 없음(null) — 던지지 않고 정렬 안정 — Task 1 검사.
- 첫 화면에서 메일함을 읽지 않는다(`grLoadInbox`·`grGlobalInbox` 는 단추로만) — Task 2 검사.
- 사업을 고르면 탭이 사라지고 사업 대시보드가 보이며, 「🎯 오늘 할 일」로 돌아온다; 연도 바꿔도 탭 유지 — Task 2.

---

## File Structure

| 파일 | 일 |
|---|---|
| `js/pu-gov-report-today.js` (신설) | 할 일 목록 계산·묶음·정렬·사업 카드 띠 모델 |
| `gov-report.html` | 탭·`#today` 영역·왼쪽 「🎯 오늘 할 일」 단추·CSS·오른쪽 알림 구역 숨김 |
| `tests/gov-report-today.test.js` (신설), `tests/gov-report-app.test.js` | 검사 |
| `STATUS.md`, `status/2026-10-12-gov-report-today.md` | 기록 |

---

### Task 1: 순수 모듈 `PuGovReportToday`

**Files:** Create `js/pu-gov-report-today.js`, `tests/gov-report-today.test.js` (옆 모듈 `pu-gov-report-dash.js` 꼴)

**Interfaces:**
- Consumes (모두 이미 있는 출력, 이 모듈은 호출하지 않고 받기만 한다):
  - `alerts = {unwritten:[row], staleDraft:[row]}` (`PuGovReportList.alerts`) — `row = {coId,coName,typeId,typeName,st:{days},…}`
  - `extra = {waitSign:[{row,days}], overdue:[{row,due}]}` (`PuGovReportTrack.alertsExtra`)
  - `blocked = [{coId,typeId,coName,typeName,items:[{name,note}]}]` (`PuGovReportDocs.blockedAlerts`, 업체 이름 순)
  - `lines = [{coId,typeId,coName,typeName,bizName,dueDays:number|null,finished:bool,due:string}]` (호출하는 쪽이 사업마다 `Dash.summarize(...).lines` 에 `typeName`·`bizName` 을 붙여 합친 것)
  - `strip = [{code,name,agency,kind,n,cols:[{done,doing,blocked,none,total}],blockedN,soonN,known:bool,hasPlan:bool}]`
- Produces:
  - `LEVELS = ['hot','mid','low']`, `KINDS = ['overdue','blocked','unwritten','waitSign','soon','staleDraft']`(우선순위 순)
  - `build(o) → { hot:[task], mid:[task], low:[task], total:number }` — `o = {alerts, extra, blocked, lines, known:bool, today, soonDays:7}`. `task = {id,kind,level,coId,typeId,coName,typeName,title,meta,tags:[string],days:number|null}`. `known:false` → `blocked`·`waitSign`·`overdue`·`soon` 은 만들지 않는다. 같은 `coId|typeId` 는 `KINDS` 순서가 앞선 종류 한 줄만.
  - `titleOf(kind, o)`/문구는 모듈 안에서 정한다(아래 «문구 표»).
  - `stripOf(strip) → [{code,label:{name,agency},n,bar:{done,doing,blocked,none}|null,note,tone:'bad'|'warn'|'ok'|'idle'}]` — `bar` 는 비율(0~100 정수, 합 100 또는 모두 0), `known:false`·`!hasPlan` 이면 `null`; `note` = 막힘>0 「막힘 n」 · 기한>0 「기한 n」 · 둘 다 아니면 「정상」(`bar` 없으면 「업체 n곳」).
  - `more(list, n, shown) → {rows:[task], rest:number}` — 처음 `shown`(기본 8)줄과 남은 개수.

**문구 표**(정확히 이대로):
| kind | title | meta |
|---|---|---|
| overdue | `{coName} · 제출 기한이 지났습니다` | `{typeName} · 기한 {due} ({days}일 지남)` |
| blocked | `{coName} · {단계 이름}이(가) 막혀 있습니다` (단계 여럿이면 첫 단계 + « 외 n») | `{typeName}` + (메모 있으면 ` · «{note}»`) |
| unwritten | `{coName} · 보고서를 아직 안 썼습니다` | `{typeName} · 종료 후 {days}일` |
| waitSign | `{coName} · 서명 회신을 기다리는 중입니다` | `{typeName} · 회신 {days}일째` |
| soon | `{coName} · 기한이 가깝습니다` | `{typeName} · 계약 종료 {due} (D-{days})` — 0일이면 `오늘 종료` |
| staleDraft | `{coName} · 초안이 오래 묵었습니다` | `{typeName} · {days}일 전 고침` |
`tags` = `[bizName||typeName, 종류 딱지]` 딱지: 제출·막힘·미작성·서명 대기·기한 임박·초안. `days`: overdue = 지난 일수(양수, `today`−`due`), blocked = `null`→정렬에서 맨 뒤, unwritten·waitSign·staleDraft = 각 줄 값, soon = 남은 일수(작을수록 급함 → 정렬 키는 `100 - days`).

- [ ] **Step 1: 실패하는 검사 쓰기** (`tests/gov-report-today.test.js`) — 문구 표 각 줄 · 묶음 수준(hot/mid/low) · 중복 제거(막힘+서명대기+임박 → 막힘 한 줄) · `soon` 경계 0·7 포함, 8·−1 제외, `finished` 제외 · `known:false` 규칙 · 정렬(급한 순, 같으면 가나다, 안정) · `days:null`/빈 `typeName` · 입력 불변(JSON 비교) · `stripOf`(비율 합·`known:false`→`bar:null`·`note` 문구·`tone`) · `more`(경계: shown 이상/미만).
- [ ] **Step 2: 실패 확인** — `node --test tests/gov-report-today.test.js`.
- [ ] **Step 3: 구현** — 순수 함수만.
- [ ] **Step 4: 통과 확인** — 같은 명령 + `gov-report-*` 전체.
- [ ] **Step 5: 커밋** — `feat(gov-report): 오늘 할 일 순수 모듈 PuGovReportToday`.

---

### Task 2: 화면 — 탭 · 오늘 할 일 영역 · 사업 카드 띠

**Files:** Modify `gov-report.html`, `tests/gov-report-app.test.js`

**Interfaces:**
- Consumes: Task 1 의 `PuGovReportToday.build / stripOf / more`; 2단계 `PuGovReportDash.summarize`; 기존 `grClosedTypes`·`grLive`·`grOpenToc`·`grSetBiz`·`grGlobalInbox`·`grOpenFromInbox`·`GR.gi`·`PuGovReportNav.build`·`PuGovReportDocs.docsTable/blockedAlerts/erpTypeFor`.
- Produces: `#today` 영역(탭 `[data-tab="today|all"]`, 상태 `GR.tab`, `localStorage['gov_home_tab']`) · 사업 카드 띠 `.td-strip > .td-biz[data-biz]` · 묶음 `.td-sec.hot|mid|low` · 줄 `.td-task` + 「서류 열기」 `[data-td-open]` · 「더 보기」 `[data-td-more]` · 왼쪽 머리 「🎯 오늘 할 일」 `[data-home]`.

- [ ] **Step 1: 실패하는 검사 쓰기**(정적, 기존 꼴) — `<script …pu-gov-report-today.js?v=…>` 가 dash 다음 · 소스에 `PuGovReportToday.build(`·`stripOf(`·`more(`·`data-tab=`·`data-td-open`·`data-home` · 새 쓰기 없음(`.set(` 개수 불변) · 첫 화면 렌더 함수(`grRenderToday`) 안에 `grLoadInbox(`·`grGlobalInbox(` 호출이 **없다**(단추 `onclick` 문자열 제외) · 안내 «일부 할 일을 알 수 없습니다» 존재 · `localStorage` 는 try/catch 안에서만.
- [ ] **Step 2: 실패 확인**.
- [ ] **Step 3: 구현**
  - `GR.tab`(기본 `'today'`; `localStorage['gov_home_tab']` 에서 `'all'` 만 인정). `grRender` 가 `GR.f.biz===''` 일 때: 탭 줄 표시, `GR.tab==='today'` → `#today` 보이고 `#kpis`·`.filters`·`.tbl`·`#docs` 숨김, `'all'` → `#today` 숨김하고 기존 그대로. `GR.f.biz!==''` → 탭 줄·`#today` 숨김(지금 동작 + 2단계 대시보드).
  - `grRenderToday()`: 입력 만들기 — `rows = L.filterRows(GR.rows,{year}).filter(live)`, `alerts = L.alerts(rows,today)`, `extra = T.alertsExtra(rows,today)`, `blocked = D.blockedAlerts(...).filter(live)`(`GR.trackErr` 면 `[]`), `lines`·`strip` = `N.build(...).open` 마다 `D.docsTable(...)` → `Dash.summarize` (사업 이름·`typeName` 붙임; `docsTable` 이 던지면 그 사업만 건너뜀 try/catch). `known = !GR.trackErr && !!GR.track && docs loaded`. 그린 뒤 `GR.todayMore` 로 더 보기.
  - 줄 단추 `[data-td-open]` → `grOpenTask(coId,typeId)`: `erp = D.erpTypeFor(typeId,d.biz,d.tmap)`; 있으면 `if(GR.f.biz!==erp.code) grSetBiz(erp.code); grOpenToc(coId,typeId)`; 없으면 `location.href = L.reportHref(coId,typeId)` 단추 대신 링크.
  - 왼쪽 `#biz` 맨 위에 「🎯 오늘 할 일 (N)」 `[data-home]` 단추(첫 화면 탭이 켜져 있으면 `on`), 누르면 `GR.tab='today'; grSetBiz('')` 후 사업이 이미 비었으면 그대로 다시 그림(같은 사업 다시 누르면 풀리는 기존 `grSetBiz` 동작과 헷갈리지 않게 `GR.f.biz=''` 를 직접 쓴다).
  - 오른쪽 `#alerts` 를 감싼 `<section>` 에 id 를 주고 오늘 할 일 탭이 켜져 있을 때만 `display:none`.
  - 받은 서류 묶음: «정한 것»대로 `GR.gi.st` 분기.
  - CSS: 기존 변수만. 줄 = 아이콘 칸 + 본문 + 단추 3열 그리드(좁은 화면은 단추를 아래로). 묶음 머리 색: hot=`--bad` 계열·mid=`--warn`·low=`--info` 에 해당하는 기존 토큰(없으면 `.st-todo`/`.st-draft`/`.st-wait` 쪽 배경 변수 재사용).
- [ ] **Step 4: 통과 확인** — `gov-report-*`·`photos-staff-share`·`test-pin-guard`·`check-cache-version` 관련 전부 PASS.
- [ ] **Step 5: 커밋** — `feat(gov-report): 오늘 할 일 첫 화면 — 탭·할 일 묶음·사업 카드 띠`.

---

### Task 3: 기록

**Files:** Modify `STATUS.md`(맨 끝 한 줄, BOM+CRLF byte-safe), Create `status/2026-10-12-gov-report-today.md`

- [ ] 상태 노트 + STATUS.md 한 줄 + 커밋 `docs(status): 오늘 할 일 첫 화면(UI 3단계) 기록`.
