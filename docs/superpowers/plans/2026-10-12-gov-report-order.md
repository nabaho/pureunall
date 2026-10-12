# 컨설팅보고서 앱 UI 재정리 4단계: 사업 순서(이알피 순서 + 끌어서 바꾸기) · 업체 □ 번호 · 화면 잘림 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 대표 지시(2026-10-12) 세 가지 — ① 「푸른이알피의 사업단위로 정렬하고 업체는 항상 ㅁ와 넘버링해라」 ② 「사업은 마우스로 아래위 드래그 가능하게 해라」 ③ 「화면이 짤렸다」(표가 가운데 칸에 눌려 오른쪽 열이 잘림) — 를 한 번에 처리한다.

**Architecture:** (1) 사업 순서 = 푸른이알피 «컨설팅 사업»의 순서(`sortOrder`, 없으면 이름순)가 기본이고, 끌어서 바꾼 순서가 있으면 그것이 먼저다. 끌어서 바꾼 순서는 **새 DB 칸 `scal_bizOrder/main`**(= `{list:'코드,코드,…', by, at}` 한 문서, 쓰기 관리자·위임관리인(MGR), 읽기 직원 — 새 규칙, 추가만)에 저장해 모두가 같은 순서를 본다. 순수 모듈 `js/pu-gov-report-nav.js` 가 순서 계산(`rankMap`·`reorder`·`parseOrder`·`orderEntry`)을 맡고 `build()` 가 `order` 를 받아 «진행 사업»의 정렬에서 업체 수 내림차순을 없앤다. (2) 업체 번호 = **CSS 카운터**(`□ 1`)만 쓴다 — HTML 글자는 바꾸지 않는다(기존 검사 안 깨짐). 현황판 표는 사업 묶음 순서로 정렬하고 사업이 바뀔 때 번호가 1 로 돌아간다. (3) 화면 잘림 = 3열 격자를 1500px 아래에서 2열(오른쪽 패널은 아래 전체 너비)로.

**Tech Stack:** 정적 HTML + 바닐라 JS(IIFE), Firebase RTDB 규칙(생성기 `scripts/make-firebase-rules.js`), `node --test`.

**Spec:** 별도 설계서 없음 — 대표 지시 문장과 본 계획서 «정한 것».

## 정한 것 (제가 정했다 — 대표 「묻지말고 끝까지」)
- **순서 규칙**: ① 끌어서 정한 순서 목록(`GR.bizOrder`, 코드 배열)에 있는 사업은 그 순서대로 앞에, ② 목록에 없는 사업은 그 뒤에 이알피 `sortOrder`(없으면 맨 뒤)·이름순. **「진행 사업」도 업체 수 내림차순을 쓰지 않는다**(= 이알피 순서). 묶음(진행·업체 없음·서류 틀 없음·연결 없음·종결)은 지금처럼 그대로이고 묶음 안에서 이 순서를 쓴다.
- **끌기**: 왼쪽 사업 항목(`.bz`)을 마우스로 끌어 같은 묶음 안 다른 항목 위·아래에 놓는다(HTML5 drag & drop — 폰 터치는 안 된다). 놓으면 «전체 순서 목록»(모든 보이는 사업, 현재 정렬 그대로)에서 그 코드를 목표 앞/뒤로 옮긴 새 목록을 만들어 `scal_bizOrder/main` 에 **한 번 `.set`**(낙관적 갱신 → 실패하면 되돌리고 「저장하지 못했습니다 — 관리자만 사업 순서를 바꿀 수 있습니다」). 다른 묶음 항목 위에는 놓을 수 없다(표시 안 됨). 목록이 비면 쓰지 않는다(빈 노드는 저장 관문이 물리 삭제로 막는다).
- **저장 모양**: `scal_bizOrder/main = { list:'A,B,C', by:'이름', at:숫자 }`. `list` = 쉼표로 이은 사업 코드(코드 꼴 `^[A-Za-z0-9_-]{1,40}$`, 최대 200개, 전체 길이 ≤ 4000, 중복 없음). 규칙은 `list` 글자 꼴 `^[A-Za-z0-9_,-]*$` 와 길이만 검사하고 코드 개수·중복은 화면이 지킨다(읽을 때도 `parseOrder` 가 걸러낸다).
- **읽기 실패**(규칙 게시 전·권한)는 «끌어서 정한 순서 없음»으로 보고 앱은 그대로 돈다(오류 줄 없음).
- **업체 번호**: `□ 1`, `□ 2` … — 현황판 표(업체 칸) · 서류 체크표(업체 칸) · 사업 대시보드 업체 줄. 번호는 그 목록의 보이는 순서(1부터), **현황판 표는 사업이 바뀌면 1로 돌아간다**. 번호는 CSS 카운터(`counter-reset`/`counter-increment`, `::before`)로만 — 글자 노드를 바꾸지 않는다. 오늘 할 일·보드 카드는 번호 없음(알림 줄·열별 카드라 번호가 뜻이 없다).
- **현황판 표 정렬**: 사업 묶음 순서(= 위 순서 규칙의 순위)로 정렬하고 같은 사업 안에서는 지금 순서 그대로(안정 정렬). 이알피 사업에 이어지지 않은 일정 사업은 맨 뒤.
- **화면 잘림 · 전체 폭(대표 「사업은 왼쪽으로 대시보드로 만들어라 좌우로 넓게 모든화면 다 사용해라」)**: 원인 = `main{max-width:1280px;margin:0 auto}`(가운데 칸이 눌림). → `main{max-width:none;margin:0;padding:14px clamp(12px,1.5vw,28px) 60px}`(화면 전체 사용), 격자 `grid-template-columns:clamp(300px,23vw,420px) minmax(0,1fr) clamp(280px,18vw,340px)`, `@media (max-width:1500px){ .grid{grid-template-columns:clamp(280px,24vw,360px) minmax(0,1fr)} .side{grid-column:1/-1; display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); gap:12px} }` — 기존 1100px 이하(220px + 1fr)·900px 이하(1열) 규칙은 그대로(뒤에 둔다). 왼쪽 패널 `.bizp` 는 `position:sticky; top:<머리 높이>; max-height:calc(100vh - <머리 높이> - 16px); overflow:auto` 로 사업이 많아도 따라온다(머리 높이는 `#head` 실제 높이를 JS 로 읽지 말고 CSS 변수 `--head-h:64px` 고정값 + 줄바꿈 시 `top` 만 어긋나는 정도는 허용). 표는 `overflow:auto` 그대로.
- **왼쪽 = 사업 대시보드**: 이름이 잘리지 않게(말줄임 없음 — 이름은 줄바꿈) 사업 카드로: 위 한 줄 요약(진행 사업 N · 업체 M · 막힘 K — 고른 연도·종결 제외), 카드마다 **사업 이름(굵게)** · (수행기관)·종류 딱지 · 업체 N곳 · 단계 누적 막대(3단계 `grTodayCalc` 결과의 사업 카드 데이터 `bar` 재사용, 계산을 다시 하지 않는다) · 「막힘 n」/「기한 n」 딱지. 막대 데이터가 없는 사업(서류 틀 없음·업체 없음·기록 못 읽음)은 막대 없이 업체 수만. 묶음(업체 없음·서류 틀 없음·연결 없음·종결)은 지금처럼 접는 목록(작은 줄)로 둔다. 끌기(Task 2)·클릭(고르기/풀기)·종결 표시는 그대로 동작한다.

## Global Constraints

- **새 쓰기는 `scal_bizOrder/main` 한 군데 `.set` 하나**(`grSaveBizOrder`). 서류 줄 `.set`·종결 `.set` 둘은 그대로 → `gov-report.html` 정적 검사의 쓰기 목록은 `.set(` 넷이 되도록 정확히 고친다(그 밖의 `.update(`·`.push(`·`.transaction(`·`.remove(` 금지).
- 규칙은 **추가만**: `scal_bizOrder` 새 자리(`.read` LOGIN, `main` 쓰기 MGR, 검사 `$other:false`). 기존 규칙 불변. `docs/firebase-rules-전체-적용본.json`·`docs/rules-paste.json` 은 생성기로 다시 만든다(앞선 `scal_bizState` 작업과 같은 방식 — `git show 13031593`). 규칙 게시는 컨트롤러가 합치기 전에 한다(실행자는 **생성만**). `tests/photos-staff-share.test.js` 의 `PENDING` 에 새 경로를 더한다(게시 뒤 비운다). 온톨로지 `js/pu-ontology.js` 의 `govreport` 소유 루트·`writeContracts` 에 `scal_bizOrder` 등록(`scal_bizState` 선례 — `78b8f932`), 그 페이지들의 `pu-ontology.js?v=` 올림은 훅이 요구하는 대로.
- 기존 `PuGovReportNav.build` 출력 모양(`open/quiet/noPlan/unlinked/closed/total`, 항목 필드)은 **그대로** — 새 입력 `order` 는 선택(없으면 이알피 순서만). `PuGovReportDocs.visibleTypes`·`byOrder` 출력 불변.
- 값은 `grEsc`. 합성 이름만, 검사에 `?v=숫자` 금지(`\?v=\d+`), 바뀐 스크립트는 `?v` 올림(훅, `--no-verify` 금지). `gov-report.html` 은 CRLF — 부분 편집·줄바꿈 보존. 새 CSS 에 hex·rgb 직접 지정 금지(기존 변수).
- 읽기 실패·쓰기 거절은 앱을 멈추지 않고 알린다. 직원 계정은 끌어도 저장이 거절된다(순서는 그 자리에서 되돌아간다).

## Review Focus

- 순서 목록에 없는 새 사업·순서 목록에만 있는 사라진 사업(지워졌거나 숨김)이 섞여도 던지지 않고 목록에 없는 사업이 뒤에 간다 — Task 1 검사.
- 목표를 자기 자신 앞에 놓기·마지막 뒤에 놓기·모르는 코드를 넘기기 — Task 1 검사(바뀐 게 없으면 `null`).
- 끌어서 놓은 뒤 저장 실패 → 화면이 원래 순서로 돌아가고 안내가 보인다 — Task 3 검사.
- 같은 이름·다른 기관 사업 두 개를 끌어도 코드로 구분된다 — Task 1·3 검사.
- 번호가 글자가 아니라 CSS 라서 현황판 표를 사업 묶음으로 정렬해도 «행 글자»가 그대로이고, 사업이 바뀌는 첫 행만 번호 초기화 표시(`ng`)를 가진다 — Task 3 검사.
- 1500px 이하에서 오른쪽 패널이 아래로 가고 표가 잘리지 않는다(CSS 규칙 존재 검사 + 합성 화면으로 컨트롤러가 눈으로 확인).

---

## File Structure

| 파일 | 일 |
|---|---|
| `js/pu-gov-report-nav.js` | 순서 모델: `rankMap`·`reorder`·`parseOrder`·`orderEntry`, `build` 의 `order` 입력 |
| `scripts/make-firebase-rules.js`, `docs/firebase-rules-전체-적용본.json`, `docs/rules-paste.json`, `js/pu-ontology.js`, `tests/gov-report-rules.test.js`, `tests/photos-staff-share.test.js` | `scal_bizOrder` 규칙·등록(생성만, 게시는 컨트롤러) |
| `gov-report.html` | 끌기·저장·되돌림, 표 정렬, 번호 CSS 카운터, 격자 CSS |
| 대응 `tests/*.test.js`, `STATUS.md`, `status/2026-10-12-gov-report-order.md` | 검사·기록 |

---

### Task 1: 순서 모델(`PuGovReportNav`) + 규칙·온톨로지(생성만)

**Files:** Modify `js/pu-gov-report-nav.js`, `tests/gov-report-nav.test.js`, `scripts/make-firebase-rules.js`, `docs/firebase-rules-전체-적용본.json`, `docs/rules-paste.json`, `js/pu-ontology.js`(+ 그 `?v` 올림 페이지들), `tests/gov-report-rules.test.js`, `tests/photos-staff-share.test.js`

**Interfaces:**
- Consumes: 기존 `Nav.build(o)`(`o = {biz, tmap, input, year, state}`), `Docs.visibleTypes(biz)` → `[{code,name,short,agency,sortOrder}]`, `Nav.REASON_MAX`·`closeEntry` 꼴.
- Produces:
  - `ORDER_MAX = 200`, `ORDER_LEN_MAX = 4000`, `ORDER_NODE_KEY = 'main'`(문자열 상수)
  - `parseOrder(entry) → string[]` — `entry` 는 `scal_bizOrder/main` 값(`{list:'A,B'}`) 또는 이상한 값. 코드 꼴(`^[A-Za-z0-9_-]{1,40}$`, `__proto__`·`constructor`·`prototype` 제외)만 남기고 중복은 처음 것만, 최대 `ORDER_MAX`. 못 읽으면 `[]`.
  - `rankMap(o) → {code: 0..n-1}` — `o = {biz, order:string[]}`. `order` 에 있는 사업이 그 순서로 앞, 나머지(보이는 사업만)는 이알피 `sortOrder`(없으면 뒤)·이름순으로 뒤를 잇는다. `order` 에만 있고 보이지 않는 코드는 무시.
  - `reorder(o, code, targetCode, after) → string[] | null` — `o = {biz, order}`, 현재 전체 순서(`rankMap` 순)에서 `code` 를 `targetCode` 의 앞(`after:false`) 또는 뒤(`after:true`)로 옮긴 새 코드 배열. `code`·`targetCode` 가 보이는 사업이 아니거나 같거나 결과가 현재와 같으면 `null`.
  - `orderEntry(list, by, now) → {list:'A,B', by, at}|null` — `list` 코드 검사(꼴·중복·개수 ≤ `ORDER_MAX`·전체 길이 ≤ `ORDER_LEN_MAX`)를 통과해야 객체, 아니면 `null`. `by` 는 40자 자른다.
  - `build(o)` 는 `o.order`(선택, `string[]`)를 받아 각 묶음을 `rankMap` 순위로 정렬(진행 사업 포함 — **업체 수 내림차순 제거**). `order` 가 없으면 이알피 순서(= `rankMap` 의 `order=[]`).
- 규칙: `rules.scal_bizOrder = { '.read': LOGIN, main: { '.write': MGR, '.validate': "newData.hasChildren(['list','at'])", list: { '.validate': "newData.isString() && newData.val().length <= 4000 && newData.val().matches(/^[A-Za-z0-9_,-]*$/)" }, by: { '.validate': 'newData.isString() && newData.val().length <= 40' }, at: { '.validate': 'newData.isNumber()' }, $other: { '.validate': false } } }` — `scal_bizState` 블록과 같은 꼴·주석 스타일. 루트에는 `.write` 없음.

- [ ] **Step 1: 실패하는 검사 쓰기** — `tests/gov-report-nav.test.js`: `parseOrder`(정상/중복/잘못된 코드/`__proto__`/200 초과/비문자·null → `[]`), `rankMap`(order 우선·나머지 이알피 순·order 에만 있는 코드 무시·sortOrder 없는 사업 뒤·이름 같은 두 사업 안정), `reorder`(앞·뒤·맨 끝·같은 코드 `null`·모르는 코드 `null`·변화 없음 `null`·입력 불변), `orderEntry`(정상·중복·꼴·길이·`by` 40자), `build` 의 `order` 와 **진행 사업이 업체 수 내림차순이 아님**(업체 수 1인 사업이 앞 순서면 그대로 앞). `tests/gov-report-rules.test.js`: `scal_bizOrder` 읽기 LOGIN·루트 쓰기 문 없음·`main` 쓰기 MGR·모양(필수 list·at, `$other` 거절, `{m,n}` 범위 없음)·`list` 길이/글자 꼴 숫자가 `Nav.ORDER_LEN_MAX` 와 같음(규칙 문자열에서 읽는다). 온톨로지 등록 검사가 있으면(예: `tests/ontology*.test.js`에서 `scal_bizState` 를 찾는 곳) 같은 식으로 `scal_bizOrder` 도 확인.
- [ ] **Step 2: 실패 확인** — `node --test tests/gov-report-nav.test.js tests/gov-report-rules.test.js`.
- [ ] **Step 3: 구현** — 모듈·규칙 생성기·온톨로지. 생성기로 `docs/firebase-rules-전체-적용본.json`·`docs/rules-paste.json` 다시 만들기(바이트 안전: UTF-8 BOM 없음, 기존 줄바꿈 방식 유지 — `scal_bizState` 때 커밋 `13031593` 처럼). 줄바꿈만 다른 생성물 변경이 끼면 되돌린다. `PENDING` 에 새 경로 한 줄.
- [ ] **Step 4: 통과 확인** — 위 명령 + `gov-report-*`·`photos-staff-share`·`test-pin-guard`·온톨로지 관련 전부. `scripts/rules-deploy.js` 는 **돌리지 않는다**(게시는 컨트롤러).
- [ ] **Step 5: 커밋** — `feat(gov-report): 사업 순서 모델(이알피 순서·끌어서 바꾼 순서) + scal_bizOrder 규칙(생성만)`.

---

### Task 2: 화면 — 끌어서 순서 바꾸기 · 이알피 순서 · 현황판 사업 묶음 정렬

**Files:** Modify `gov-report.html`, `tests/gov-report-app.test.js`

**Interfaces:**
- Consumes: Task 1 의 `PuGovReportNav.build/rankMap/reorder/parseOrder/orderEntry`; 기존 `grLoadBizState`(약 1485줄)·`grRenderBiz`·`grBizBtn`·`GR_BIZ`·`GR.bizState`·`grRenderRows`·`grErpFor`(3단계에서 추가된 «종결 안 된 이알피 사업 고르기») 및 3단계의 `GR.dver`(자료 버전 — 순서가 바뀌면 올릴 필요 없음, 순서는 할 일 계산에 안 쓰인다).
- Produces: `GR.bizOrder`(string[]) · `GR_BIZ.orderNode`(= `'scal_bizOrder'`)·`GR_BIZ.orderKey`(`'main'`) · `grLoadBizOrder()` · `grSaveBizOrder(list)`(유일한 새 `.set`) · `grDragBiz` 위임(`dragstart/dragover/dragleave/drop/dragend` on `#biz`) · 항목 `.bz[draggable="true"][data-grp]` · 놓을 자리 표시 `.bz.drop-before/.drop-after` · 안내 한 줄 `.bz-hint`(「⇅ 끌어서 순서를 바꿉니다」, `GR.bbmsg` 오류 줄).

- [ ] **Step 1: 실패하는 검사 쓰기**(정적 + vm world 동작) — `.set(` 목록이 정확히 넷(서류 줄·종결·되돌림·**순서 한 곳**)이고 순서 쓰기는 `GR_BIZ.orderNode`·`orderKey` 로만 · 항목에 `draggable="true"`·`data-grp` · 순서 목록이 있으면 `#biz` 의 «진행 사업» 순서가 그 순서(업체 수와 무관) · 순서 목록이 없으면 이알피 순서 · `drop` 시뮬레이션(핸들러를 직접 불러 dataTransfer 흉내)이 새 목록을 `.set` 에 한 번 쓰고 화면이 바뀐다 · 저장 실패(거절) → 원래 순서·안내 문구 · 다른 묶음 항목 위에 놓기는 무시 · 읽기 실패 → 순서 없음으로 돈다 · `grRenderRows` 가 사업 묶음 순서로 정렬(합성 두 사업)하고 사업이 바뀌는 첫 `<tr>` 만 `class="ng"`.
- [ ] **Step 2: 실패 확인** — `node --test tests/gov-report-app.test.js`.
- [ ] **Step 3: 구현** — `grLoadBizState` 안에서 `scal_bizOrder` 도 읽는다(통째 한 번; 실패하면 `[]`). `grRenderBiz`·`grClosedTypes` 등 `N.build` 를 부르는 모든 곳에 `order:GR.bizOrder` 를 넘긴다(`grep -n "PuGovReportNav.build\|N.build"` 로 전부). 끌기 처리는 `#biz` 위임 — 같은 `data-grp` 일 때만 `preventDefault`, 위/아래 절반으로 `after` 결정, 놓으면 `Nav.reorder` → `null` 이면 무시, 아니면 `GR.bizOrder` 낙관적 갱신 → 다시 그림 → `grSaveBizOrder`(`Nav.orderEntry(list, GR.me 이름 또는 '', Date.now())`) 실패 시 이전 목록 복원·`GR.bbmsg`. 현황판 표: `grView()` 결과를 `Nav.rankMap` 순위로 안정 정렬하는 한 줄(이알피 사업에 이어지지 않은 일정 사업은 맨 뒤) + `grRenderRows` 에서 사업(typeId)이 바뀌는 첫 행에 `class="ng"`.
- [ ] **Step 4: 통과 확인** — `gov-report-*`·`photos-staff-share`·`test-pin-guard`·훅 통과(`?v` 올림).
- [ ] **Step 5: 커밋** — `feat(gov-report): 사업을 끌어서 순서 바꾸기 · 이알피 순서 · 현황판 사업 묶음 정렬`.

---

### Task 3: 화면 — 업체 □ 번호 · 전체 폭 격자 · 왼쪽 사업 대시보드

**Files:** Modify `gov-report.html`(CSS · `grRenderBiz`/`grBizBtn` · 필요한 `class`), `tests/gov-report-app.test.js`(+ 왼쪽 패널 DOM 을 읽는 기존 검사들 — `grep -n "\.bz\b\|bz-nm\|bz-ag\|bz-k\|data-biz\|grBizBtn" tests/*.test.js` 로 찾아, **그 검사가 지키던 뜻**(목록에 보인 사업·업체 수·클릭 시 거르기·같은 사업 다시 누르면 풀림·종결 표시·끌기)을 지키며 새 모양에 맞게 고친다)

- [ ] **Step 1: 실패하는 검사 쓰기** — (a) 번호: CSS 에 `counter-reset`/`counter-increment`/`::before`/`content:"□ "`(또는 `\25A1`) 규칙이 `#rows`·`.docs table`·`.dsh-l` 업체 칸에 있다 · 번호 CSS 는 hex·rgb 없음 · `.co`·`.dsh-c` 안 **글자 노드는 그대로**(기존 검사가 읽는 `>가나상사<` 형태 유지). (b) 폭: `main{…}` 에 `max-width:1280px` 가 없고(`max-width:none`) 격자 3열이 `clamp(` 로 정해지며, `@media (max-width:1500px)` 규칙이 `.grid` 2열과 `.side{grid-column:1 / -1}` 를 갖고 1100px·900px 규칙보다 **앞**에 있다 · `.bizp` 에 `position:sticky`. (c) 왼쪽 대시보드: 합성 자료로 `#biz` 에 요약 줄(진행 사업 N · 업체 M)과 사업 카드(이름이 `title` 만이 아니라 본문에 전체로 들어 있음 — 말줄임 클래스 없음)·카드의 막대(`dsh-bar` 재사용) 또는 막대 없는 업체 수, 기록 못 읽음이면 막대 없이 업체 수만, 종결 사업은 종결 묶음에, 끌기용 `draggable`·`data-grp` 가 그대로, 같은 사업 다시 누르면 풀림.
- [ ] **Step 2: 실패 확인**.
- [ ] **Step 3: 구현** — 번호: `#rows{counter-reset:co}` + `#rows tr td.co::before{counter-increment:co; content:"□ " counter(co) " "; color:var(--mute); font-weight:400; margin-right:2px}` + `#rows tr.ng{counter-reset:co}`(같은 요소에서 reset 이 increment 보다 먼저라 첫 행이 1) 꼴. 서류 체크표(`.docs table tbody`)·사업 대시보드 업체 줄(`.dsh-l` / `.dsh-c`)도 같은 방식, 각각 자기 컨테이너에서 `counter-reset`. 폭·왼쪽 대시보드는 «정한 것» 그대로 — 카드 막대 데이터는 `GR.td`(3단계 `grTodayCalc` 캐시)의 사업 카드 항목을 사업 코드로 찾아 쓴다(캐시가 없으면 그 자리에서 계산하지 말고 막대 없이 업체 수만 — 첫 그림 뒤 `grRender` 가 다시 돌며 채워진다는 점을 확인; 안 채워지면 `grRenderBiz` 앞에서 `grTodayCalc()` 를 부르되 캐시 열쇠가 같으면 재계산 없음을 검사로 확인).
- [ ] **Step 4: 통과 확인** — `gov-report-*`·`photos-staff-share`·`test-pin-guard`·훅.
- [ ] **Step 5: 커밋** — `feat(gov-report): 업체 □ 번호 · 화면 전체 폭 · 왼쪽 사업 대시보드(막대·막힘·기한)`.

---

### Task 4: 기록

**Files:** Modify `STATUS.md`(맨 끝 한 줄, BOM 보존·byte-safe), Create `status/2026-10-12-gov-report-order.md`

- [ ] 상태 노트(무엇을·어떻게·한계: 폰 터치 끌기 안 됨, 관리자만 저장, 규칙 게시 여부 등) + STATUS.md 한 줄 + 커밋 `docs(status): 사업 순서·업체 번호(UI 4단계) 기록`.
