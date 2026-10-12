# 대형 사업 장별 AI 초안 (설계 2-C) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 대형 사업(일터혁신 상생·산업일자리 중진공·KMAC·산업일자리 충남 지원센터)의 큰 보고서(착수·중간·최종 보고, 최종결과보고서, 결과·사후관리 보고서)를 **장별**로 AI 초안을 만들어 보여 주고 복사해 쓰게 한다. 초안은 «초안»이며 사람이 읽고 고친다. 저장하지 않는다(새 DB 칸·규칙 없음).

**Architecture:** 새 순수 모듈 `js/pu-gov-report-chapters.js`(`PuGovReportChapters`)가 장 목록(`DOC_PLANS` 항목의 `chapters`), 가려진 요청(`buildRequest` — 기존 `PuGovReportAi.mask` 재사용), 답 읽기(`parseDraft`), 검증(`checkDraft` — 입력에 없던 숫자 표시)을 맡는다. 화면(`gov-report.html` 칸 창)이 `step:'report'` 대형 항목에서 「✨ 장별 AI 초안」을 내고, 기존 보고서 창의 AI 호출(`PuAiCall.ask` → 서버 `readDoc`/Gemini, 로그인·월 한도) 방식과 같은 길로 부른다. 결과는 장마다 편집 가능한 글칸 + 「복사」(화면 메모리에서만).

**Tech Stack:** 정적 HTML + 바닐라 JS(IIFE 브라우저·Node 겸용), `PuAiCall`(`js/pu-ai-call.js`), `node --test`.

## Global Constraints

- **저장하지 않는다**: 새 `.set/.update/.push/.remove/.transaction` 금지(`gov-report.html` 의 쓰기는 `grSaveCell` 의 `.set(` 한 곳 그대로), 새 규칙·DB 칸 없음. 초안은 `GR.cw.chap`(화면 메모리)에만 있고 칸 창을 닫으면 사라진다 — 화면에 그렇게 안내한다.
- **밖으로 나가는 글은 모두 가린다**: 업체·대표자·담당자·계약 업체명·다른 담당자 이름은 자리 표시([해당 기업]·[대표자]·[담당자]·[담당자2]…)로, 전화·메일·주민·계좌·사업자번호는 `[가림]` — 기존 `PuGovReportAi.mask`/`unmask` 를 그대로 쓴다(복제 금지). 급여·명부 같은 개인 자료·첨부 원본·메일 본문은 보내지 않는다(이 기능은 회차 날짜·형태·메모와 서류 줄 메모·회차 기록 요약만). 기술보호 자료 아님(대형 사업 전용).
- **동의**: 기존 보고서 창과 같은 동의 창·같은 `localStorage` 키(`gov_ai_ok`)를 쓴다 — 한 번 동의하면 두 화면 모두 다시 묻지 않는다. 동의하지 않으면 아무것도 보내지 않는다.
- **재료 없으면 부르지 않는다**: 회차 메모와 서류 줄 메모가 모두 비어 있으면 「재료가 부족합니다 — 회차 메모(정부사업일정)나 이 서류의 메모를 먼저 적어 주세요」 로 안내하고 **AI 를 부르지 않는다**.
- 초안 규칙(시스템 글): 입력에 없는 숫자·고유명사·법 조문을 지어내지 않는다 / 모르면 「입력 필요」 / 보고서 문체(~함, ~임) / 장마다 900자 이내 / `JSON {"chapters":{"<키>":"<글>"}}` 만 답한다. 입력에 없던 숫자가 초안에 들어 있으면 그 장에 「확인 필요 — 입력에 없던 숫자: …」 경고.
- 간단형·기존 칸 창·`grSaveCell` 동작·기존 AI 모듈(`PuGovReportAi`) 출력은 **그대로**(기존 검사 통과). `PuGovReportAi` 를 바꾸지 않는다(필요하면 새 모듈이 호출만 한다).
- 값은 `grEsc`(장 제목·경고·글칸 값). 공개 저장소: 합성 이름만, 검사에 `?v=숫자` 금지, 바뀐 스크립트는 `?v` 올림(훅, `--no-verify` 금지). `gov-report.html` 은 부분 편집·줄바꿈 보존.

## 장 목록 (정리본 §2-5~2-7 기준 초안 **[노무사 확인]** — `DOC_PLANS` 대형 항목의 `chapters: [{k, t}]`)

```js
// workplace (일터혁신 상생) — 통합진단보고서(PPT) 착수·중간·최종
kickoff: [ {k:'overview',t:'진단 개요(기업 현황·진단 방법)'}, {k:'analysis',t:'진단 결과 요약(인사시스템 수준·노동관계법 준수)'}, {k:'tasks',t:'개선과제 후보와 수행 계획'}, {k:'org',t:'추진 체계(디자인팀)·일정'} ],
mid:     [ {k:'progress',t:'수행 경과(회차별 요약)'}, {k:'results',t:'주요 논의·성과'}, {k:'issues',t:'문제점과 조치'}, {k:'plan',t:'향후 일정'} ],
final:   [ {k:'overview',t:'진단·수행 개요'}, {k:'progress',t:'수행 경과(회차별 요약)'}, {k:'results',t:'개선 성과'}, {k:'effects',t:'기대효과'}, {k:'follow',t:'이행관리 계획'} ],
// industry (산업일자리 중진공·KMAC)
kickoff: [ {k:'background',t:'사업개요 — 추진 배경·필요성'}, {k:'scope',t:'사업 내용·추진 절차'}, {k:'diag',t:'진단결과 요약·컨설팅 영역'}, {k:'roles',t:'역할 분담·필요자료'}, {k:'org',t:'운영 체계·일정'} ],
final:   [ {k:'summary',t:'성과 요약(기업 스토리·KPI)'}, {k:'overview',t:'컨설팅 개요(수행 일수·절차)'}, {k:'status',t:'기업 현황'}, {k:'issues',t:'애로사항 원인 분석과 해결 방안'}, {k:'results',t:'결과 종합(정량·정성)'}, {k:'support',t:'연계 정부지원사업 검토(적합·부적합 사유)'} ],
// industry-cn (충남 지원센터)
result:  [ {k:'overview',t:'컨설팅 개요(배경·목표·기대효과)'}, {k:'status',t:'수진기업 개요'}, {k:'diag',t:'진단 결과 및 전환 과제'}, {k:'kpi',t:'핵심 추진과제·KPI·로드맵'}, {k:'effects',t:'기대효과(기업·근로자·지역)'}, {k:'follow',t:'이행 계획·사후관리 방안'} ],
after:   [ {k:'progress',t:'이행 현황'}, {k:'results',t:'성과'}, {k:'follow',t:'향후 관리'} ],
```
(이 외 대형 항목 — `plan`·`round`·`mdlog`·`monthly` 등 — 에는 `chapters` 가 없다. 키 `k` 는 소문자 글자 `^[a-z]+$`, 항목당 최대 8장.)

---

### Task 1: 순수 모듈 `PuGovReportChapters` + 장 목록 상수

**Files:** Create `js/pu-gov-report-chapters.js`, `tests/gov-report-chapters.test.js`; Modify `js/pu-gov-report-docs.js`(`it()` 의 `extra` 가 `chapters` 도 받게 + 위 장 목록), `tests/gov-report-docs.test.js`

**Interfaces:**
- Consumes: `PuGovReportAi.mask(text, names) → {text, back}`·`unmask(text, back)`(기존), `DOC_PLANS`.
- Produces (`window.PuGovReportChapters` / `module.exports`):
  - 상수 `CH_LIMIT=900`, `CH_MAX=8`, `MSG={NO_MATERIAL:'재료가 부족합니다 — 회차 메모(정부사업일정)나 이 서류의 메모를 먼저 적어 주세요', NOT_SAVED:'저장되지 않습니다 — 읽고 고친 뒤 복사해 쓰세요(칸 창을 닫으면 사라집니다)', CHECK:'확인 필요 — 입력에 없던 숫자: '}`.
  - `chaptersOf(item) → [{k,t}]` — `item.chapters` 에서 올바른 것만(`k` 는 `^[a-z]+$`, `t` 비지 않은 글, 중복 `k` 버림, 최대 8장), 아니면 `[]`.
  - `buildRequest(o) → {empty:true} | {system, messages, sent, back, keys}` — `o = {bizName, itemName, chapters, company:{name,bizType,workers}, names:[{v,as}], rounds:[{date,visit,memo,rd}], notes:[{label,text}]}`. 재료 = 비지 않은 `rounds[].memo` 또는 `notes[].text` 가 하나라도 있어야 한다(없으면 `{empty:true}`). 입력은 JSON(`사업`·`서류`·`업체{업종,근로자수}`·`회차[{날짜,방식(방문/사무/모름),메모,기록요약}]`·`메모[{이름,글}]`·`채울_장[{키,제목}]`)으로 묶은 뒤 **통째로** `mask` 한다(업체 이름은 `company.name` + `names`). `rd` 는 `{mode,mins,people,md,kind}` 중 있는 것만 «대면 130분 4명» 꼴 글로 `기록요약`에 넣는다.
  - `parseDraft(text, back, chapters) → {k: text}` — 첫 `{` ~ 마지막 `}` JSON 에서 `chapters` 객체의 **아는 키만**(`chaptersOf` 키), 글자만, `unmask`, 앞뒤 공백 제거, `CH_LIMIT` 자까지 자른다. JSON 이 없거나 아는 키가 하나도 없으면 `e.parse=true` 인 `Error('AI 답을 읽지 못했습니다 — …')`. `__proto__`·`constructor` 키는 버린다.
  - `checkDraft(draft, sentText) → {k: ['숫자',…]}` — 초안에는 있는데 `sentText` 에 없던 숫자(앞 0 뗀 낱말 단위, 기존 `numsOf` 와 같은 규칙: `/\d+/g`)를 장별로. 없으면 그 키는 넣지 않는다.

- [ ] **Step 1: 실패하는 검사** — `tests/gov-report-chapters.test.js`(합성 자료만):
  1. `chaptersOf`: 올바른 목록·빈/이상한 `k`(`Kick`·`__proto__`·`a1`)·중복·9장 초과 자르기·`null`.
  2. `buildRequest`: 재료 없음 → `{empty:true}`; 메모가 있으면 `system`(장 키·제목·900자·JSON 규칙·«입력에 없는 숫자…지어내지 않는다» 포함)과 `messages[0].content` 에 **업체 이름이 없고** `[해당 기업]` 이 있음, 전화·메일·사업자번호·주민번호 꼴이 `[가림]`, 담당자·대표자 이름(names)이 자리 표시, `back` 으로 `unmask` 하면 원래 이름이 돌아옴, `keys` = 장 키 순서, `기록요약` 에 «대면 130분 4명» 꼴, 방식 `visit:true→방문`·`false→사무`·그 밖 `모름`, 회차 날짜는 그대로(날짜 `2026-09-04` 는 가려지지 않음).
  3. `parseDraft`: 정상 JSON(앞뒤 잡글 포함)·아는 키만·모르는 키·`__proto__` 버림·글자 아닌 값 버림·900자 자름·`unmask` 로 `[해당 기업]` → 업체 이름·JSON 없음/아는 키 0개 → `parse` 오류.
  4. `checkDraft`: 입력에 없던 숫자만(예: 보낸 글에 `3` 이 있고 초안에 `3`·`17`) → `['17']`, 앞 0(`07` vs `7`) 같은 수, 없으면 빈 객체.
  `tests/gov-report-docs.test.js`: 위 장 목록이 정확히 이 항목에만(`workplace.kickoff·mid·final`, `industry.kickoff·final`, `industry-cn.result·after`) 있고 모두 `chaptersOf` 를 통과(8장 이하, 소문자 키, 중복 없음), 간단형 계획과 다른 대형 항목에는 없다, 기존 항목 `id·name·per·step·steps·note·rd` 불변.
- [ ] **Step 2: 실패 확인** — `node --test tests/gov-report-chapters.test.js tests/gov-report-docs.test.js` FAIL.
- [ ] **Step 3: 구현** — 모듈(헤더 주석 한국어, `'use strict'`, 브라우저·Node 겸용 IIFE, 옆 `js/pu-gov-report-ai.js` 와 같은 결 — `isNode` 이면 `require('./pu-gov-report-ai.js')`)과 `DOC_PLANS` 상수(`it()` 의 `extra` 에 `chapters` 한 줄 추가). 시스템 글은 모듈 안 상수(한국어, 정리본 기준 «작성기준 초안 — 노무사 확인» 주석). `gov-report.html` 에는 아직 스크립트 태그를 더하지 않는다(Task 2). 바뀐 `pu-gov-report-docs.js` 의 `?v` 를 `gov-report.html` 에서 올린다(훅이 요구).
- [ ] **Step 4: 통과 확인** — `node --test tests/gov-report-*.test.js tests/test-pin-guard.test.js tests/photos-staff-share.test.js` PASS.
- [ ] **Step 5: Commit** — `git add js/pu-gov-report-chapters.js tests/gov-report-chapters.test.js js/pu-gov-report-docs.js tests/gov-report-docs.test.js gov-report.html` · `feat(gov-report): 대형 장별 AI 초안 — 순수 모듈·장 목록` + Co-Authored-By.

---

### Task 2: 화면 — 칸 창 「✨ 장별 AI 초안」

**Files:** Modify `gov-report.html`, `tests/gov-report-app.test.js`

**Interfaces:** Consumes Task 1 의 `PuGovReportChapters`, 항목 `chapters`, 기존 `PuGovReportAi`(`mask` 는 Chapters 가 호출), `PuAiCall`(`js/pu-ai-call.js`), `firebase.auth()`, 기존 `grOpenCell`/`GR.cw`/`grRenderCell`/`grEsc`/`T.recOf`/`GR.input.scheds`. Produces: 칸 창 안 `#cwChap` 구역, `GR.cw.chap = {busy, msg, err, draft:{k:글}, warn:{k:[…]}, sent:''}`, `grChapAi()`, `grChapCopy(k)`·`grChapCopyAll()`, `grRenderChap()`.

설계(코드는 구현자가 기존 보고서 창 AI 코드 `gov-consulting.html` 의 `grpAiConsent`·`grpAiCall`·`grpAiErrMsg`·`GRP_AI_MSG` 를 읽고 **같은 동작·같은 문구·같은 키**로 옮긴다 — 복사하되 화면 함수 이름은 `gr…` 로):
- `<script>` 3개를 `gov-report.html` 에 더한다: `js/pu-gov-report-ai.js`(기존 모듈 — 가리기 재사용), `js/pu-ai-call.js`, `js/pu-gov-report-chapters.js`(`?v=1`) — 순서는 ai → chapters, `pu-ai-call.js` 는 `gov-consulting.html` 이 싣는 번호를 따른다.
- `grOpenCell`: 항목에 `chapters` 가 있으면(`PuGovReportChapters.chaptersOf(item).length`) `GR.cw.chaps = chaptersOf(item)`·`GR.cw.chap = {busy:false,msg:'',err:false,draft:{},warn:{},sent:''}`. 아니면 `chaps:[]`.
- `grRenderCell`: `c.chaps.length` 이면 «메모» 앞에 `<div id="cwChap"></div>`, 끝에서 `grRenderChap()`.
- `grRenderChap()`: 제목 「✨ 장별 AI 초안」 + 안내(`MSG.NOT_SAVED`, 「업체 자료가 가려진 뒤 외부 AI 로 전송됩니다」) + 단추 「AI 초안 만들기」(`c.chap.busy` 면 「쓰는 중…」+잠김) + 메시지 줄 + 초안이 있으면 **장마다** 제목(`t`)·`<textarea id="cwChapK_<k>" oninput="grChapEdit('<k>')">`(값은 `grEsc`)·경고(`warn[k]` → `MSG.CHECK+숫자들`, `err-s`)·「이 장 복사」 단추, 그리고 「전체 복사」. 단추 속성에 데이터를 끼우지 않는다 — 키는 `^[a-z]+$` 만 인라인에 넣는다(`grOkChapKey` 로 검증).
- `grChapAi()`: 이미 `busy` 면 무시 → 재료 모으기: `rounds` = 그 업체·사업·해의 일정(`GR.input.scheds` 중 `coId`·`typeId`·연도 맞는 것, 날짜순; 일정 이름·메모 필드는 기존 코드에서 쓰는 이름 — `date`, `isField`, `memo`), 각 회차의 `rd` 는 이 `rid` 의 `round:N`·`mdlog:N` 줄 `rd` 를 순서대로(없으면 생략), `notes` = [`{label: 항목 이름, text: 이 칸 창의 저장된 메모(rec.note)}`], `company` = {이름 `c.coName`, `bizType`·`workers`: 있으면 `GR.docs.cons` 의 업체 정보에서(없으면 생략)}, `names` = 기존 `grpAiNames` 와 같은 규칙(`c.cons.company` 의 대표자·계약 업체명·다른 담당자). → `PuGovReportChapters.buildRequest` → `{empty:true}` 면 `MSG.NO_MATERIAL` 안내하고 끝(부르지 않음) → 동의(`gov_ai_ok`) → `grChapCall(system, messages)`(= `grpAiCall` 과 같은 90초 제한·로그인 확인·`PuAiCall.ask`) → `parseDraft`(못 읽으면 한 번 더 — 보고서 창과 같다) → `checkDraft(draft, sent)` → `c.chap` 채움 → `grRenderChap()`. 호출 중 칸 창이 닫히거나 다른 칸으로 바뀌면(`GR.cw !== c`) 결과를 버린다. 실패 문구는 `grpAiErrMsg` 와 같다.
- `grChapEdit(k)`: 글칸 값을 `c.chap.draft[k]` 에 옮기고 그 장의 경고를 다시 계산(`checkDraft`)하며 **글칸을 다시 그리지 않는다**(입력 보존) — 경고 줄만 갱신.
- 복사: `navigator.clipboard.writeText`(실패하면 안내) — 「이 장 복사」는 그 장 글, 「전체 복사」는 `제목\n글` 을 장 순서대로 빈 줄로 이은 것.
- 쓰기는 없다(`grSaveCell` 불변) — 초안 단추는 `grSaveCell` 을 부르지 않는다.

- [ ] **Step 1: 실패하는 검사** — `tests/gov-report-app.test.js`(앞선 2-A/2-B/설계 1 검사의 `world`/시드/`cellOf` 도우미 재사용 — 중복 금지; **`PuAiCall`·`firebase.auth`·`navigator.clipboard`·`localStorage` 는 검사 안에서 가짜로**; 합성 일터혁신·산업일자리 시드가 **진짜로 연결**되게, 침묵 우회 `if(...) return` 금지):
  1. 정적: 인라인 스크립트의 쓰기 명령은 여전히 `['.set(']` 하나뿐, 새 `fetch(`·`XMLHttpRequest` 없음(AI 는 `PuAiCall` 로만), `grChapAi` 안에서 `grSaveCell`·`fbDb` 를 부르지 않는다.
  2. `chapters` 가 있는 항목 칸 창(`workplace.kickoff`·`industry.final`·`industry-cn.result`)에는 `#cwChap` 와 「AI 초안 만들기」, 없는 항목(`plan`·`round`·`mdlog`·`monthly`)·간단형·서명·제출 칸 창에는 없다.
  3. 재료 없음(메모 모두 빈)이면 `MSG.NO_MATERIAL` 안내만, **`PuAiCall.ask` 호출 0회**·동의 창 0회.
  4. 재료가 있고 동의 안 함 → 호출 0회. 동의함 → `PuAiCall.ask` **한 번**, 보낸 글(`parts`)에 **업체 이름·전화·메일이 없고** `[해당 기업]`·`[가림]` 이 있으며 회차 날짜·메모는 있음.
  5. 가짜 답(JSON, 일부 장만·한 장은 입력에 없던 숫자 포함)이면 장별 글칸이 그려지고 값이 `unmask` 된 업체 이름, 숫자 경고가 그 장에만 `err-s`, 글칸을 고치면(`grChapEdit`) 경고가 다시 계산되고 글칸이 다시 그려지지 않음(값·초점 보존), 「이 장 복사」·「전체 복사」가 기대 글로 `clipboard.writeText` 호출.
  6. 못 읽는 답(JSON 없음)이면 한 번 더 묻고 둘 다 실패면 오류 문구, 로그인 없음(`firebase.auth().currentUser` 없음) 안내, 시간 초과·한도 초과 문구(기존 `GRP_AI_MSG` 와 같은 글).
  7. 호출 중 칸 창을 닫거나 다른 칸을 열면 결과가 버려지고 새 칸 창이 오염되지 않는다.
  8. 쓰기 0(`db.쓴것.length === 0`), 간단형 체크표·기존 칸 창(서명 요청·회차 기록·기준 점검) 회귀 없음.
  9. 사업장 이름·메모·AI 답에 `<script>`·따옴표가 있어도 장 제목·글칸·경고 HTML 에서 이스케이프된다.
- [ ] **Step 2: 실패 확인** — `node --test tests/gov-report-app.test.js` 새 검사 FAIL.
- [ ] **Step 3: 구현** — 위 설계대로 부분 편집. 새 `<script>` 태그, `grOpenCell` 의 `GR.cw` 리터럴에 `chaps`·`chap`.
- [ ] **Step 4: 통과 확인** — `node --test tests/gov-report-*.test.js tests/photos-staff-share.test.js tests/test-pin-guard.test.js` PASS. 실제 AI 호출·로그인 화면은 확인할 수 없으므로 «실제 화면 미확인»으로 적는다.
- [ ] **Step 5: Commit** — `git add gov-report.html tests/gov-report-app.test.js` · `feat(gov-report): 칸 창 장별 AI 초안(대형 보고서)` + Co-Authored-By.

---

### Task 3: 기록

- [ ] `status/2026-10-12-gov-report-chapters.md`(만든 것 · 쓰는 곳: **새 DB·규칙 없음, 초안은 저장하지 않음** · 못 한 것: 실제 AI 호출·화면 확인, 초안 저장·이어쓰기, 한글/PPT 양식 채우기(양식 없음), 월별 수행실적보고서 장 · 확인 필요: 장 목록·시스템 글(노무사), 회차 메모가 비어 있으면 안내만 나옴, 월 AI 한도) + `STATUS.md` 줄 하나(끝 줄 충돌 잦음 — `git merge origin/main` 뒤 두 줄을 살리고 옛 줄을 지운다).
- [ ] 전체 검사 `node --test tests/gov-report-*.test.js tests/test-pin-guard.test.js tests/photos-staff-share.test.js tests/pu-hwp-preview.test.js` fail 0; `git diff --stat origin/main...HEAD` 가 File Structure 와 같은지(규칙·ontology·`pu-erp.html` 없음).
- [ ] Commit — `docs(gov-report): 장별 AI 초안 구현 기록` + Co-Authored-By.
