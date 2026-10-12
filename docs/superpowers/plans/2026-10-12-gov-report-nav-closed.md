# 컨설팅보고서 앱 UI 재정리 — 1단계: 연도별 사업 목록 · 사업이름(수행기관) · 종결 사업 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 대표 지시(2026-10-12 「섞어서 진행」·「A 를 기준으로 연도별로, 사업이름 중심 ()에 수행기관」·「종결된 것은 종결 사업으로 뺄 수 있게」)의 **1단계**: 왼쪽 사업 목록을 «선택한 연도 기준 · 사업이름 (수행기관) · 종결 사업 묶음»으로 다시 짜고, 사업을 종결/되돌릴 수 있게 한다. (2단계: 사업별 대시보드 — 단계 진행 막대·대형 보드 보기. 3단계: 「오늘 할 일」 첫 화면. 각각 별도 계획서·PR.)

**Architecture:** 새 순수 모듈 `js/pu-gov-report-nav.js`(`PuGovReportNav`)가 사업 목록 모델(진행/업체 없음/서류 틀 없음/연결 없음/종결)·라벨(`이름 (기관)`)·종결 판정(`closedFrom` 연도)·종결 기록 검사를 맡는다. 종결 표시는 **새 DB 칸 `scal_bizState/{사업 코드}`**(새 규칙 — 추가만, 관리자·위임관리인만 쓰기). 화면(`gov-report.html`)은 그 모델로 왼쪽 `#biz` 를 다시 그리고, 연도 막대·종결 창·종결 배너·«종결 사업은 숫자·챙길 것에서 뺀다»를 더한다. 목업: 대표에게 보낸 `mock-A2-year-groups`·`mock-A3-year-header`·`mock-A5-closed-flow`(저장소 밖).

**Tech Stack:** 정적 HTML + 바닐라 JS(IIFE 브라우저·Node 겸용), Firebase RTDB 규칙(생성기 `scripts/make-firebase-rules.js`), `node --test`.

## 정한 것 (대표 「섞어서 진행」 — 제가 정했다)
- **연도**: 상단 연도 막대(목업 A3)가 앱 전체 기준 연도를 정한다(왼쪽 숫자·가운데 표·오른쪽 챙길 것이 그 해 기준 — 지금 `#fYear` 와 같은 상태 `GR.f.year`). 왼쪽 목록은 그 해에 업체가 있는 사업을 위로, 없는 사업은 접힌 묶음으로.
- **이름 표기**: 한 항목 = 두 줄 — 굵게 사업 이름, 아래에 «(수행기관)»(이알피 컨설팅 사업의 기관 칸; 비어 있으면 「(기관 미지정)」). 기관별 묶음 머리는 없앤다(이름 중심).
- **종결**: 사업 단위 + «이 연도부터»(`closedFrom`, 「전체」 = `2000`) 종결. 종결한 해(`≥ closedFrom`)에는 «종결 사업» 묶음으로 가고 **숫자·⏰ 알림·전역 받은 서류 확인에서 빠진다**; 그 앞 해에는 그대로 진행 사업. 기록은 지우지 않고 눌러 읽고 고칠 수 있다. 되돌리기 = closedFrom '9999' 표시(지우지 않는다 — 누가 언제 되돌렸는지 남는다; 저장 관문이 물리적 삭제 `.remove` 를 막는다 — 2026-10-12 조정 판정).
- **권한**: 종결 표시 쓰기는 관리자·위임관리인(규칙 `MGR`). 직원은 읽기만 — 단추는 보이되 눌러 거절되면 「관리자만 종결할 수 있습니다」.
- **규칙**: `scal_bizState` 새 규칙(추가만). 대표 「묻지말고 끝까지」에 따라 합치기 전에 `scripts/rules-deploy.js --deploy`(컨트롤러가 한다 — 실행자는 **생성만**).

## Global Constraints

- 새 쓰기는 **`scal_bizState/{code}` 한 군데 `.set`(종결)·`.set`(되돌리기 = closedFrom 9999 표시, `.remove` 아님)** 뿐이다(`grCloseBiz`·`grReopenBiz`). 서류 줄 쓰기(`grSaveCell` 의 `.set(`)는 그대로. `gov-report.html` 정적 검사의 «쓰기 명령 목록»은 이 둘을 정확히 허용하도록 고친다(그 밖의 쓰기·`.update(`·`.push(`·`.transaction(`는 계속 금지).
- 종결 기록 모양(규칙과 모듈이 같아야 한다): `closedFrom` `^[0-9]{4}$`(필수) · `closedAt` `YYYY-MM-DD`(선택) · `reason` 문자열 ≤ 40자(선택) · `by` ≤ 40자 · `at` 숫자(필수) · `$other:false`. 사업 코드 키: `^[A-Za-z0-9_-]{1,40}$`.
- 읽기 실패(규칙 게시 전·권한)는 «종결 없음»으로 보고 앱은 그대로 돈다(작은 안내 한 줄은 허용). 저장 실패는 화면에 알리고 값은 그대로.
- 기존 `PuGovReportDocs.sidebarGroups`·`visibleTypes`·`pairs`·`planFor`·`linkOf` 출력은 **그대로**(새 모듈이 호출만 한다). 기존 검사(칸 창·체크표·받은 서류함 등)는 그대로 통과해야 한다 — 왼쪽 패널 DOM 을 바꾸는 검사는 새 모양에 맞게 고치되 **그 검사가 지키던 뜻은 지킨다**(목록에 보인 사업·숫자·클릭 시 거르기·같은 사업 다시 누르면 풀림).
- 값은 `grEsc`. 공개 저장소: 합성 이름만, 검사에 `?v=숫자` 금지(`\?v=\d+`), 바뀐 스크립트는 `?v` 올림(훅, `--no-verify` 금지). `gov-report.html` 은 부분 편집·줄바꿈 보존.
- 규칙을 바꾸면 `tests/photos-staff-share.test.js` 의 `PENDING` 에 `'/scal_bizState/$code'`(실제 경로는 확인 — 규칙 비교 출력 그대로)를 더한다(게시 뒤 비운다).

## Review Focus

- 종결 연도 경계: `closedFrom:'2026'` → 2025 는 진행, 2026·2027 은 종결 — Task 1 검사.
- 같은 사업을 되돌리면(closedFrom 9999 표시) 모든 연도가 진행으로 — Task 1·3 검사.
- 종결 사업이 숫자(KPI·목록 행)·⏰ 알림·전역 받은 서류 확인에서 빠지지만, 그 사업을 눌러 고르면 행이 보인다 — Task 3 검사.
- 기관이 비었거나 사업 이름이 같은 두 사업(기관만 다름)이 서로 구분된다 — Task 1·3 검사.
- 상태를 못 읽었을 때(권한 거절) 앱이 평소처럼 돈다 — Task 3 검사.

---

## File Structure

| 파일 | 일 |
|---|---|
| `js/pu-gov-report-nav.js` (신설) | 사업 목록 모델·라벨·종결 판정·종결 기록 검사 |
| `scripts/make-firebase-rules.js`, `docs/firebase-rules-전체-적용본.json`, `docs/rules-paste.json` | `scal_bizState` 규칙(생성만) |
| `gov-report.html` | 연도 막대·왼쪽 목록 재그리기·종결 창·배너·종결 제외 |
| 대응 `tests/*.test.js`, `STATUS.md`, `status/2026-10-12-gov-report-nav.md` | 검사·기록 |

---

### Task 1: 순수 모듈 `PuGovReportNav`

**Files:** Create `js/pu-gov-report-nav.js`, `tests/gov-report-nav.test.js`

**Interfaces:**
- Consumes: `PuGovReportDocs`(`visibleTypes(biz)`·`linkOf(code,tmap,types)`·`pairs(input,typeId,year)`·`planFor(name)`·`NONE`·`KIND_KO`; Node 에서는 `require('./pu-gov-report-docs.js')`).
- Produces (`window.PuGovReportNav` / `module.exports`):
  - 상수 `REASONS = ['사업 기간 끝남','이번 연도 수행 안 함','계약 종료','기타']`, `REASON_MAX=40`, `ALL_FROM='2000'`, `NO_AGENCY='기관 미지정'`.
  - `label(item) → {name, agency, text}` — `agency` 비면 `NO_AGENCY`, `text = name + ' (' + agency + ')'`.
  - `closedFor(state, code, year) → boolean` — `state[code].closedFrom` 이 4자리이고 `closedFrom <= String(year)`; `state` 가 객체가 아니거나 키가 없거나 프로토타입 이름(`__proto__`·`constructor`)이면 `false`(자기 소유 속성만).
  - `closeEntry({from, at, reason, by, now}) → {closedFrom, closedAt?, reason?, by?, at} | null` — `from` 4자리·`at`(종결일)은 날짜 꼴일 때만·`reason` 은 40자로 자름·`by` 40자·`at` 필드는 `now` 숫자(없으면 `null` 반환).
  - `build({biz, tmap, input, year, state}) → {open:[…], quiet:[…], noPlan:[…], unlinked:[…], closed:[…], total}` — 각 항목 `{code, name, agency, label, kind, plan, typeId, count, closedFrom}`. `visibleTypes` 마다: 종결(`closedFor`)이면 `closed`(숫자 `count` 는 그대로 담되 `total` 에는 안 넣는다); 아니면 `typeId` 없으면 `unlinked`, 있고 `count>0` 이면 `open`, `count===0` 이고 `plan` 이 `none` 이면 `noPlan`, 그 밖은 `quiet`. `open` 은 `count` 내림차순 → `sortOrder` 오름차순 → 이름, 나머지는 `sortOrder`·이름 순. `total` = `open` 의 `count` 합.
  - `closedTypeIds({biz, tmap, input, year, state}) → {typeId:1}` — 종결로 판정된 사업이 이어진 정부사업일정 사업 종류 id(화면이 숫자·알림에서 거를 때 쓴다).

- [ ] **Step 1: 실패하는 검사** — `tests/gov-report-nav.test.js`(합성 자료만; `tests/gov-report-docs.test.js` 의 `sidebarGroups` 검사가 쓰는 합성 `biz`·`tmap`·`input` 모양을 읽고 같은 틀로 — 이 틀을 따르는 작은 도우미를 파일 안에 만든다):
  1. 상수 · `label`(기관 있음/없음/공백) — 이름이 같고 기관만 다른 두 사업의 `text` 가 서로 다르다.
  2. `closedFor`: `closedFrom:'2026'` → 2025 false · 2026 true · 2027 true, 상태 없음/`null`/문자열/배열 → false, `__proto__`·`constructor` 코드 → false, `closedFrom:'26'`(이상한 꼴) → false, 숫자 연도 인자도 받는다.
  3. `closeEntry`: 정상 · `from` 이상 → `null` · `reason` 41자 → 40자 · 이상한 날짜 → `closedAt` 없음 · `now` 없음 → `null`.
  4. `build`: 합성 사업 6개(진행·업체 없음 서류 틀 있음·서류 틀 없음·연결 없음·종결(2026부터)·이름 같고 기관 다른 쌍)로 묶음 배정·정렬·`total`·종결 항목의 `count` 보존·연도를 2025 로 바꾸면 종결 사업이 `open` 으로 돌아감·`state` 없음.
  5. `closedTypeIds`: 종결 사업의 `typeId` 만, 연도에 따라 달라짐.
- [ ] **Step 2: 실패 확인** — `node --test tests/gov-report-nav.test.js` FAIL(모듈 없음).
- [ ] **Step 3: 구현** — 모듈(헤더 주석 한국어, `'use strict'`, 브라우저·Node 겸용 IIFE, 옆 `js/pu-gov-report-docs.js` 와 같은 결). `hasOwnProperty` 로만 읽는다. 새 `<script>` 태그는 이 작업에서 넣지 않는다(Task 3).
- [ ] **Step 4: 통과 확인** — `node --test tests/gov-report-*.test.js tests/test-pin-guard.test.js` PASS.
- [ ] **Step 5: Commit** — `git add js/pu-gov-report-nav.js tests/gov-report-nav.test.js` · `feat(gov-report): 사업 목록 모델·종결 판정 순수 모듈 (UI 재정리 1단계)` + Co-Authored-By.

---

### Task 2: 규칙 `scal_bizState` (생성만, 게시 안 함)

**Files:** Modify `scripts/make-firebase-rules.js`, `docs/firebase-rules-전체-적용본.json`, `docs/rules-paste.json`(생성기 출력으로 다시 만든다 — 앞선 규칙 작업의 방식을 `git log -p -- docs/rules-paste.json` 으로 확인), `tests/gov-report-rules.test.js`, `tests/photos-staff-share.test.js`(`PENDING`)

**Interfaces:** Consumes Task 1 의 `REASON_MAX`·`ALL_FROM`. Produces 규칙:

```js
/* 컨설팅보고서 앱 — 사업 종결 표시 (2026-10-12, 설계 docs/superpowers/plans/2026-10-12-gov-report-nav-closed.md)
   scal_bizState/{이알피 컨설팅 사업 코드} = { closedFrom:'YYYY'(이 해부터 종결), closedAt?, reason?, by?, at } — 되돌림은 closedFrom '9999' 표시(.set) — 지우지 않는다.
   ★ 읽기는 직원, 쓰기는 관리자·위임관리인(MGR) — 사업 하나를 «종결 사업»으로 옮기는 일이라 직원 손에 두지 않는다.
   ★ 화면 모듈 REASON_MAX 40(js/pu-gov-report-nav.js)과 같은 값 — tests/gov-report-rules.test.js. 게시는 합친 뒤. */
rules.scal_bizState = {
  '.read': LOGIN,
  $code: {
    '.write': MGR,
    '.validate': "$code.length <= 40 && $code.matches(/^[A-Za-z0-9_-]+$/) && newData.hasChildren(['closedFrom','at'])",
    closedFrom: { '.validate': "newData.isString() && newData.val().matches(/^[0-9]{4}$/)" },
    closedAt:   { '.validate': SCAL_DOCS_DAY },
    reason:     { '.validate': 'newData.isString() && newData.val().length <= 40' },
    by:         { '.validate': 'newData.isString() && newData.val().length <= 40' },
    at:         { '.validate': 'newData.isNumber()' },
    $other:     { '.validate': false }
  }
};
```
(`SCAL_DOCS_DAY` 는 `scal_docs` 블록 위에서 정의된 상수 — 새 규칙을 그 아래에 둔다. 루트 `.write` 를 만들지 않는다.)

- [ ] **Step 1: 실패하는 검사** — `tests/gov-report-rules.test.js` 끝: 규칙 JSON 에 `scal_bizState` 가 있고 `.read` 는 로그인 직원 식, `$code` 의 `.write` 는 관리자·위임관리인 식(`MGR` 와 같은 글), 루트에 `.write` 없음, `closedFrom` 정규식이 `^[0-9]{4}$`, `reason` 한도 숫자가 `Nav.REASON_MAX`(40), `$other:false`, 두 규칙 JSON(`전체-적용본`·`rules-paste`)이 같은 블록을 가짐, 생성기 출력과 같다.
- [ ] **Step 2: 실패 확인** — `node --test tests/gov-report-rules.test.js` FAIL.
- [ ] **Step 3: 구현** — 생성기에 규칙을 더하고 두 JSON 을 생성기로 다시 만든다(**`--deploy` 하지 않는다**, 콘솔 원문 스냅숏은 건드리지 않는다). 각 JSON 은 이전 대비 `scal_bizState` 블록만 늘어야 한다(줄 수 확인 — 이상하게 크면 인코딩/줄바꿈 문제). `PENDING` 에 새 경로 추가. 모든 규칙 검사(`tests/*rules*.test.js`·`firebase-access-matrix`·`rules-deploy-guards`)를 돌려 통과 확인.
- [ ] **Step 4: 통과 확인** — `node --test tests/gov-report-*.test.js tests/photos-staff-share.test.js tests/*rules*.test.js`.
- [ ] **Step 5: Commit** — `git add` 위 파일들 · `feat(gov-report): 사업 종결 표시 규칙 scal_bizState (생성만, 게시 전)` + Co-Authored-By.

---

### Task 3: 화면 — 연도 막대 · 왼쪽 목록 · 종결 창·배너 · 종결 제외

**Files:** Modify `gov-report.html`, `tests/gov-report-app.test.js`(+ 왼쪽 패널을 직접 보는 기존 검사들 — `grep -n "bz\\b\\|data-biz\\|grRenderBiz\\|sidebarGroups" tests/*.test.js` 로 찾는다)

**Interfaces:** Consumes Task 1 모듈, 기존 `GR`·`grRenderBiz`·`grSetBiz`·`grRender`·`grRenderFilters`(연도 `#fYear`)·`grRenderKpis`·`grView`·`grRenderAlerts`·`blockedAlerts` 호출부·`grGlobalInbox`(쌍 모으기)·`grLoad`·`fbDb`. Produces: `GR.bizState`(`{코드: 기록}`), `grLoadBizState()`, `grRenderYearBar()`, `grCloseOpen()`·`grCloseBiz()`·`grReopenBiz()`, 종결 창 `#cm`, 종결 배너, 종결 제외 거르개.

설계(코드는 구현자가 기존 코드를 읽고 맞춘다):
- `<script src="js/pu-gov-report-nav.js?v=1">` 를 `pu-gov-report-docs.js` 다음에.
- **연도 막대**: 화면 맨 위(제목 줄 옆 또는 거르개 위)에 `2026 · 2025 · 2024 · …`(`L.yearsOf(GR.rows,GR.today)`) 버튼. 누르면 `GR.f.year` 를 바꾸고 `grRender()` — 기존 `#fYear` 와 **같은 상태**(`#fYear` 는 보이지 않게 두되 값 동기화, 기존 거르기 코드·검사가 그대로 돌게). 각 버튼에 그 해 업체 수(종결 제외) 작은 글.
- **왼쪽 `#biz`**: `grLoad` 가 끝난 뒤 `grLoadBizState()`(`scal_bizState` 한 번 읽기, 실패는 `{}`) → `grRenderBiz()` 가 `Nav.build({biz:d.biz, tmap:d.tmap, input:GR.input, year:GR.f.year, state:GR.bizState})` 로 묶음을 그린다: 「진행 사업」(`open`) · 접는 「업체 없음 N」(`quiet`) · 접는 「서류 틀 없음 N」(`noPlan`) · 접는 「정부사업일정에 사업 없음 N」(`unlinked`) · 접는 「🗄 종결 사업 N」(`closed`, 눌러서 선택 가능, 흐린 글, «YYYY-MM 종결» 작은 글). 항목은 `.bz` 단추(`data-biz` 유지) 두 줄(이름 굵게 + `(수행기관)` 작게)에 종류 딱지·업체 수. 같은 사업 다시 누르면 풀림(기존 `grSetBiz` 그대로).
- **종결 창** `#cm`(목업 A5): 사업을 고른 상태의 서류 패널 머리(`.dc-h`)에 「⋯ 사업 종결」 단추 → 창: 종결일(`<input type="date">` 기본 오늘)·사유(`Nav.REASONS` 선택)·「이 연도(`GR.f.year`)부터 / 사업 전체」 라디오·남은 일 경고(그 사업 업체 수·미완료 단계 수는 `D.docsTable`/`T.bigCells` 계산이 어려우면 «업체 N곳»만) → 「종결 사업으로 옮기기」 → `grCloseBiz()`: `Nav.closeEntry` 로 만든 기록을 `fbDb.ref('scal_bizState/'+code).set(entry)` — 성공하면 `GR.bizState[code]=entry` 후 다시 그림, 실패면 창에 «저장하지 못했습니다 — 관리자만 종결할 수 있습니다(규칙 게시 또는 권한 확인)». 이미 종결된 사업(고른 해 기준)이면 서류 패널 위에 **배너**(목업 A5: «종결된 사업입니다 · 종결일 · 사유 · 종결 처리자» + 「↩ 진행 사업으로 되돌리기」) → `grReopenBiz()`: `.remove()`.
- **종결 제외**: `GR.f.biz` 가 종결 사업이 **아닐 때** 숫자(`grRenderKpis`)·현황판 행(`grView`)·⏰ 알림(`grRenderAlerts` 의 기존 묶음과 `blockedAlerts`)·전역 받은 서류 확인의 쌍 모으기·연도 막대 숫자에서 `Nav.closedTypeIds(…)` 의 사업 종류를 뺀다. 종결 사업을 골랐을 때는 그 사업 행·서류 패널이 보인다(거르개 `type`).
- 상태 읽기가 실패(권한)해도 `GR.bizState={}` 로 평소처럼 돈다.

- [ ] **Step 1: 실패하는 검사** — `tests/gov-report-app.test.js`(앞선 검사의 `world`/시드 도우미 재사용; 합성 사업 시드가 **진짜로 연결**되게, 침묵 우회 `if(...) return` 금지; 가짜 `fbDb` 에 `scal_bizState` 읽기·쓰기·지우기를 기록하게 확장):
  1. 정적: 인라인 스크립트의 쓰기 명령 목록이 정확히 `['.set(', '.set(', '.set(']`(서류 줄 `.set` + 종결 `.set` + 되돌리기 표시 `.set`, `.remove` 는 어디에도 없다) 이고 `.update(`·`.push(`·`.transaction(` 없음; `grCloseBiz`·`grReopenBiz` 는 `scal_bizState` 외 경로를 쓰지 않음.
  2. 왼쪽 목록: 묶음(진행·업체 없음·서류 틀 없음·연결 없음·종결), 항목 두 줄(이름 + `(기관)`; 기관 없음 → `(기관 미지정)`), 이름 같고 기관 다른 두 사업이 구분, 업체 수, `data-biz` 클릭 → 거르기·같은 사업 다시 누르면 풀림.
  3. 연도 막대: 연도 버튼이 `#fYear` 와 동기, 누르면 `GR.f.year` 와 왼쪽 목록·KPI 가 그 해 기준으로, 종결 사업의 업체는 숫자에서 빠짐(막대 숫자 포함).
  4. 종결 창: 「⋯ 사업 종결」 → 창 열림 → 확인하면 `scal_bizState/<코드>` 에 `{closedFrom:'<고른 해>', closedAt, reason, by, at}` 한 번 쓰기, 목록이 «종결 사업»으로 옮겨지고 숫자·알림에서 빠짐; 「사업 전체」 → `closedFrom:'2000'`; 쓰기 거절(reject) → 오류 문구·목록 그대로.
  5. 종결 사업을 고르면 배너(종결일·사유)와 그 사업 행·서류 패널이 보이고 「↩ 되돌리기」 → 되돌림 표시 `.set`(closedFrom 9999) 한 번 → 진행 사업으로 돌아옴. 종결 전 연도(`closedFrom` 이전 해)로 바꾸면 그 사업이 진행 사업으로 보임.
  6. 종결 사업이 ⏰ 알림·전역 받은 서류 확인 목록에서 빠짐(막힘·기한·받은 메일이 있는 합성 자료로).
  7. 상태 읽기 실패(reject)여도 평소대로 그려짐.
  8. 모든 글(사업 이름·기관·사유·처리자)이 `grEsc`(`<script>` 합성 값).
  기존 왼쪽 패널 검사는 새 모양에 맞게 고치되 위 2번이 그 뜻을 대신한다.
- [ ] **Step 2: 실패 확인** — `node --test tests/gov-report-app.test.js` 새 검사 FAIL.
- [ ] **Step 3: 구현** — 위 설계대로 부분 편집(전체 재작성 금지, 줄바꿈 보존). CSS 는 목업(A2/A3/A5)의 모양을 따르되 앱의 기존 색 토큰을 쓴다(`gov-report.html` 의 `<style>` 안 기존 변수·클래스 재사용, 새 클래스 최소).
- [ ] **Step 4: 통과 확인** — `node --test tests/gov-report-*.test.js tests/photos-staff-share.test.js tests/test-pin-guard.test.js tests/pu-hwp-preview.test.js tests/color-palette-apps.test.js`(있으면) PASS. 실제 화면(로그인)은 확인할 수 없으므로 «실제 화면 미확인»으로 적는다.
- [ ] **Step 5: Commit** — `git add gov-report.html tests/…` · `feat(gov-report): 연도 막대·사업이름(수행기관) 목록·사업 종결(UI 재정리 1단계)` + Co-Authored-By.

---

### Task 4: 기록

- [ ] `status/2026-10-12-gov-report-nav.md`(만든 것·정한 것·쓰는 곳: **새 규칙 `scal_bizState`(MGR 쓰기)**·못 한 것: 실제 화면 확인, 2단계 사업별 대시보드·3단계 오늘 할 일, 사업 단위가 아닌 «업체 단위 종결», 종결 알림/되돌리기 이력) + `STATUS.md` 줄 하나(끝 줄 충돌 잦음 — `git merge origin/main` 뒤 두 줄을 살린다; BOM 보존 방식으로 한 줄만 추가).
- [ ] 전체 검사 fail 0; `git diff --stat origin/main...HEAD` 가 계획과 같은지.
- [ ] Commit — `docs(gov-report): UI 재정리 1단계 구현 기록` + Co-Authored-By.
