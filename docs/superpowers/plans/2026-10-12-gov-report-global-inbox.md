# 컨설팅보고서 앱 전역 「📥 받은 서류 확인」 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 지금은 칸 창을 열어야 «그 업체에 온 서류 후보»가 보인다. 대시보드 오른쪽 패널에 **「📥 받은 서류 확인」**을 더해, 모든 업체에서 **최근 45일 안에 받은, 아직 어느 서류 줄에도 연결되지 않은 첨부 메일**을 한 목록으로 보고 곧바로 그 업체의 서류 칸 창을 열게 한다(받은 서류함 설계 §1 「하지 않는다」에 적었던 전역 목록).

**Architecture:** 기존 받은 서류함 읽기(`grLoadInbox` — 메일함 거울 머리글만)와 후보 계산(`PuGovReportInbox.candidates`·`addrsFor`)을 그대로 쓴다. 순수 함수 두 개(`sinceWindow`·`pending`)를 `PuGovReportInbox` 에 더하고, 화면(`gov-report.html`)이 **단추를 눌렀을 때만** 메일함을 읽어 업체·사업 쌍마다 후보를 모아 보여 준다(페이지를 열 때 메일함을 읽지 않는다). **읽기 전용 — 새 쓰기·규칙·DB 칸 없음.**

**Tech Stack:** 정적 HTML + 바닐라 JS(IIFE 브라우저·Node 겸용), 메일함 거울(`mailbox/*`), `node --test`.

## Global Constraints

- **읽기만**: `gov-report.html` 의 쓰기는 `grSaveCell` 의 `.set(` 한 곳 그대로(새 `.set/.update/.push/.remove/.transaction` 금지), 새 규칙·DB 칸 없음. 목록에서 «연결»·«열어 보기»는 하지 않는다 — 칸 창을 열어 거기서 한다(기존 동작 그대로).
- 본문·첨부 바이트는 읽지 않는다(메일함 거울 머리글만). 개인 자료(`priv`)는 목록에 «개인 자료 · 목록에만» 딱지와 함께 보이되 칸 창으로 가는 단추는 낸다(연결·열기 막기는 칸 창이 기존대로 한다). 메일 주소·업체 연락처는 화면에 그리지 않는다(보낸이는 기존 `who` 표시이름).
- 업체 귀속은 **주소로만**(기존 `addrsFor`): 주소가 하나도 없는 업체는 건너뛴다(그 수를 한 줄로 알린다).
- 기간: 오늘부터 45일 전까지(`GLOBAL_DAYS=45`), 받은 메일만(`out:false`), 이미 서류 줄 `link.key` 로 연결된 메일은 뺀다(어느 업체의 줄이든 같은 열쇠면 연결된 것). 목록은 날짜 내림차순 최대 30건(`GLOBAL_MAX=30`), 넘으면 「30건만 보입니다」.
- 메일함을 못 읽거나 기록(연결 열쇠)을 못 읽었으면(`GR.trackErr`) 목록 대신 안내(연결 여부를 모르는 채 «새로 온 서류»라고 하지 않는다).
- 기존 받은 서류함(칸 창)·`candidates`·`addrsFor` 출력은 **그대로**(기존 검사 통과). 공개 저장소: 합성 이름·`example.com` 만, 검사에 `?v=숫자` 금지, 바뀐 스크립트는 `?v` 올림(훅, `--no-verify` 금지). `gov-report.html` 은 부분 편집·줄바꿈 보존.

## Review Focus

- 한 메일이 두 업체 주소에 걸릴 때 한 번만 나온다(먼저 적힌 업체) — Task 1·2 검사.
- 연결된 메일(어느 줄이든)·45일 밖·보낸 메일·첨부 없는 메일은 안 나온다 — Task 1 검사.
- 단추를 누르기 전에는 메일함을 읽지 않는다(`fbDb` 읽기 0회) — Task 2 검사.
- 업체 수가 많아도(예: 120쌍) 한 번의 메일함 읽기만 한다 — Task 2 검사.

---

### Task 1: 순수 함수 `sinceWindow`·`pending`

**Files:** Modify `js/pu-gov-report-inbox.js`, `tests/gov-report-inbox.test.js`

**Interfaces:**
- Consumes: 기존 `windowOf`·`shift`(`js/pu-gov-report-inbox.js` 안), `candidates(rows,{addrs,win,tech})` 결과 항목 `{slug,uid,out,who,s,d,day,a,key,priv,tech,atts[]}`.
- Produces: `GLOBAL_DAYS=45`, `GLOBAL_MAX=30`(공개), `sinceWindow(today, days) → {from,to}|null` — `today` 는 `YYYY-MM-DD`, `from` = today − days, `to` = today; 꼴이 틀리면 `null`. `pending(list, linked, seen) → {list, more}` — `list` 는 `candidates().list` 항목 배열, `linked` 는 `{열쇠:1}` 객체, `seen` 은 이미 다른 업체에서 나온 열쇠 객체(변경해 채운다 — 같은 메일 중복 제거); `out:false`·`key` 가 있고 `linked`·`seen` 에 없는 것만, 날짜 내림차순(같으면 열쇠 순), 최대 `GLOBAL_MAX`.

- [ ] **Step 1: 실패하는 검사** — `tests/gov-report-inbox.test.js` 끝에(앞의 `I`·`S`·`ROWS`·`DARA`·`F` 이름과 합성 거울을 읽고 같은 틀로):
  1. `sinceWindow('2026-10-12',45)` → `{from:'2026-08-28',to:'2026-10-12'}`, `sinceWindow('x',45)` → `null`, `sinceWindow('2026-01-10',45)` → 해를 넘는 `from`(`'2025-11-26'`), 상수 `GLOBAL_DAYS===45`·`GLOBAL_MAX===30`.
  2. `pending`: 연결된 열쇠·`out:true`·열쇠 없는 항목은 빠진다, 날짜 내림차순, `seen` 이 채워져 같은 열쇠를 두 번째 호출에서 건너뛴다, 31건 이상이면 30건·`more:true`, `list` 가 `null`·`linked` 가 `null` 이어도 오류 없음, 원본 `list` 항목을 바꾸지 않는다.
- [ ] **Step 2: 실패 확인** — `node --test tests/gov-report-inbox.test.js` FAIL.
- [ ] **Step 3: 구현** — `shift(day, n)` 이 이미 있다(`windowOf` 가 쓴다). `sinceWindow` 는 `isDay` 를 확인하고 `{from: shift(today,-days), to: today}`. `pending` 은 복사한 배열을 정렬·자르고, `seen` 에 열쇠를 기록한다. 공개 객체에 `GLOBAL_DAYS, GLOBAL_MAX, sinceWindow, pending` 추가. 파일 머리 주석에 «전역 받은 서류 확인(2026-10-12)» 한 줄.
- [ ] **Step 4: 통과 확인** — `node --test tests/gov-report-*.test.js` PASS(기존 검사 그대로).
- [ ] **Step 5: Commit** — `git add js/pu-gov-report-inbox.js tests/gov-report-inbox.test.js gov-report.html`(`?v` 올림만) · `feat(gov-report): 전역 받은 서류 확인 — 기간·연결 안 된 받은 서류 순수 함수` + Co-Authored-By.

---

### Task 2: 화면 — 오른쪽 패널 「📥 받은 서류 확인」

**Files:** Modify `gov-report.html`, `tests/gov-report-app.test.js`

**Interfaces:** Consumes Task 1 의 `sinceWindow`·`pending`·상수, 기존 `grLoadInbox`/`GR.inbox`(`{st:'ok'|'loading'|'err', rows, cos, clipped}`)·`PuGovReportInbox.candidates/addrsFor/badges`·`PuGovReportDocs.pairs/erpTypeFor/planFor/consFor/NONE`·`PuGovReportTrack.keysFor/ recOf`·`GR.track`·`GR.input`·`GR.docs`·`GR.today`·`grOpenCell`·`grSetBiz`. Produces: `#ginbox` 구역(「⏰ 챙길 것」 아래 새 `<section>`), `GR.gi = {st:'idle'|'ok'|'err', list:[…], noAddr:n, more:bool, clipped:bool}`, `grGlobalInbox()`(단추), `grRenderGlobalInbox()`, `grOpenFromInbox(i)`.

설계:
- 새 `<section><h2>📥 받은 서류 확인</h2><div id="ginbox"></div></section>` 를 `#alerts` 구역 아래에 넣는다. 처음에는 설명 한 줄(「최근 45일 안에 받은 첨부 메일 가운데 아직 서류 줄에 연결하지 않은 것을 찾습니다」)과 「📥 확인」 단추만 있다(메일함을 읽지 않는다).
- `grGlobalInbox()`: 이미 읽는 중이면 무시. `GR.trackErr`·`!GR.track` 이면 `GR.gi={st:'err',…}`(「기록을 못 불러와 연결 여부를 알 수 없습니다」) 로 끝. 그 밖에 `await grLoadInbox()`(이미 읽었으면 재사용 — `GR.inbox.st==='ok'`) → 메일함을 못 읽었으면 `GR.gi.st='err'`(기존 `I.MSG.LOAD_FAIL`). 읽었으면: 모든 «사업장·사업» 쌍을 모은다 — `GR.input.types` 의 사업 종류마다 `D.erpTypeFor(typeId,GR.docs.biz,GR.docs.tmap)` 로 이알피 사업을 찾고 `D.planFor(erp.name)` 이 `D.NONE` 이 아닌 것만, `D.pairs(GR.input,typeId,year)` 의 `year` 는 칸 창과 같은 해(`GR.f.year`). 쌍마다 `cons=D.consFor(…)`, `addrs=I.addrsFor({companies:GR.inbox.cos,cons,name:p.coName,bizNo:…})`; 주소가 없으면 `noAddr++` 하고 건너뛴다. `I.candidates(GR.inbox.rows,{addrs,win:I.sinceWindow(GR.today,I.GLOBAL_DAYS),tech:false})` 의 `list` 를 `I.pending(list, linked, seen)` 으로 거른다 — `linked` 는 `GR.track` 의 모든 줄 `link.key` 를 모은 `{열쇠:1}`, `seen` 은 모든 쌍을 도는 동안 공유(같은 메일이 한 번만). 항목마다 `{coId,coName,typeId,typeName,step,…후보 필드}` 로 합쳐 날짜 내림차순 30건. `step` = 그 사업 서류 틀(`planFor`)에서 `T.keysFor(plan,'sign',n)` 가 있으면 `'sign'`, 아니면 `'submit'`, 아니면 `'attach'`, 없으면 `''`(칸 창으로 못 감 — 단추 없이 업체 이름만).
- `grRenderGlobalInbox()`: 상태별 — idle(설명+단추), 읽는 중(「불러오는 중…」), err(문구+「다시 시도」), ok(목록: «받음 ← 보낸이(표시이름) · 날짜 · 업체 · 사업», 제목, 첨부 이름들(`📎`), 딱지(`I.badges`), 「서류 칸 열기」 단추(`step` 이 있을 때)). 목록이 비면 「연결할 새 받은 서류가 없습니다」, `more` 면 `I.MSG.MORE` 와 같은 꼴 「30건만 보입니다」, `noAddr>0` 이면 「메일 주소가 없는 업체 N곳은 건너뛰었습니다」, `clipped` 면 `I.MSG.CLIPPED`. 모든 글은 `grEsc`; 단추 속성에 데이터를 끼우지 않는다 — 인덱스 `i` 만(`grOpenFromInbox(i)`).
- `grOpenFromInbox(i)`: `GR.gi.list[i]` 에서 `grSetBiz` 로 그 사업을 고르고(필요하면; 이미 고른 사업이면 건드리지 않음) `grOpenCell(coId,typeId,step,'')` 를 부른다. 그 사업을 왼쪽 패널에서 못 고르는 경우(`GR.f.biz` 가 다른 사업)에는 `grSetBiz(erp.code)` 후 `grOpenCell` — 구현자는 `grOpenCell` 이 `GR.f.biz`(`grErp(GR.f.biz)`)를 요구하는 점을 먼저 읽고 맞춘다(목록 항목에 `erpCode` 를 담아 둔다). 열리면 칸 창의 받은 서류 후보 목록이 같은 메일을 보인다(기존 동작).
- 쓰기 없음: `grGlobalInbox`·`grRenderGlobalInbox`·`grOpenFromInbox` 는 `grSaveCell`·`fbDb`·`.set(` 를 부르지 않는다(메일함 읽기는 기존 `grLoadInbox`/`grReadInbox` 만).

- [ ] **Step 1: 실패하는 검사** — `tests/gov-report-app.test.js`(앞선 검사의 `world`/`inboxSeed`/시드/`cellOf` 도우미 재사용, 중복 금지; 합성 자료가 **진짜로 연결**되게 — 침묵 우회 `if(...) return` 금지):
  1. 정적: 인라인 스크립트의 쓰기 명령은 여전히 `['.set(']` 하나뿐, 위 세 함수 본문에 `fbDb`·`.set(`·`fetch(` 없음.
  2. 처음 그릴 때 `#ginbox` 에 「📥 확인」 단추만 있고 메일함 읽기(`mailbox/…` once 호출)는 0회.
  3. 단추 → 합성 거울(받은 첨부 메일 2통: 한 통은 이미 어떤 줄의 `link.key` 로 연결됨, 한 통은 안 됨 + 46일 전 메일 + 보낸 메일 + 첨부 없는 메일 + 두 업체 주소에 걸린 메일 하나) → 목록에 연결 안 된 최근 받은 메일만, 두 업체에 걸린 메일은 한 번만(먼저 적힌 업체), 날짜 내림차순, 첨부 이름·딱지(개인 자료 메일은 「개인 자료 · 목록에만」), 메일함 읽기는 폴더 수만큼 **한 번씩**(여러 번 눌러도 재사용).
  4. 주소 없는 업체 N곳 안내, 31건 이상 → 30건·「30건만 보입니다」, 기록 못 읽음(`GR.trackErr`) → 안내만 나오고 메일함 읽기 0회, 메일함 읽기 실패 → 오류 문구+「다시 시도」.
  5. 「서류 칸 열기」 → 그 업체·사업의 칸 창이 열린다(`GR.cw` 의 `coId`·`typeId`·`step` 이 항목과 같고, 칸 창 «받은 서류 후보»에 그 메일이 보인다); 서류 틀에 sign/submit/attach 가 모두 없는 사업은 단추 없음.
  6. 업체·사업장·메일 제목·첨부 이름에 `<script>`·따옴표가 있어도 이스케이프된다. 쓰기 0(`db.쓴것.length===0`), 기존 칸 창 받은 서류 검사 회귀 없음.
- [ ] **Step 2: 실패 확인** — `node --test tests/gov-report-app.test.js` 새 검사 FAIL.
- [ ] **Step 3: 구현** — 위 설계대로 부분 편집(전체 재작성 금지, 줄바꿈 보존). 새 `<section>`, 새 함수, `grRender`/`grBoot` 가 `grRenderGlobalInbox()` 를 부르게(처음 그릴 때 한 번 + 상태가 바뀔 때).
- [ ] **Step 4: 통과 확인** — `node --test tests/gov-report-*.test.js tests/photos-staff-share.test.js tests/test-pin-guard.test.js tests/pu-hwp-preview.test.js` PASS. 실제 화면(로그인)은 확인할 수 없으므로 «실제 화면 미확인» 으로 적는다.
- [ ] **Step 5: Commit** — `git add gov-report.html tests/gov-report-app.test.js` · `feat(gov-report): 대시보드 전역 받은 서류 확인(최근 45일·미연결)` + Co-Authored-By.

---

### Task 3: 기록

- [ ] `status/2026-10-12-gov-report-global-inbox.md`(만든 것 · 쓰는 곳: **읽기 전용, 새 쓰기·규칙·DB 없음** · 못 한 것: 실제 화면 확인, 자동 알림·배지(눌러야 확인), 본문 확인·첨부 열기(칸 창에서), 이름 기반 후보(주소만), 기술보호 30일 삭제 안내 · 한계: 메일함 거울은 폴더마다 최근 3000통, POP3 지난 메일은 후보 불가) + `STATUS.md` 줄 하나(끝 줄 충돌 잦음 — `git merge origin/main` 뒤 두 줄을 살린다; 줄 하나만 추가하는 방식으로 BOM 보존).
- [ ] 전체 검사 fail 0; `git diff --stat origin/main...HEAD` 가 계획과 같은지.
- [ ] Commit — `docs(gov-report): 전역 받은 서류 확인 구현 기록` + Co-Authored-By.
