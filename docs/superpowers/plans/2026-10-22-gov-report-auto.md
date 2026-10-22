# 컨설팅보고서 — 받은 메일 서류 «자동 연결·완료» (서버 자동화) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 대표 지시(2026-10-22) 「자동으로 진행했던 사업 매일 매일 메일 주고 받은 것들 서류들 메일함에서 가지고 올 수 있게 — 이 부분을 완전히 자동화 하고 싶다」. 대표 선택: ① 자동화 수준 = **전부 자동 완료**(서류 상태 «완료»까지) ② 파일 보관 = **메일함에서 열기**(첨부를 복사하지 않고 «어느 메일의 어느 첨부»만 기록).

**Architecture:** (1) 새 순수 모듈 `js/pu-gov-report-auto.js`(`PuGovReportAuto`)가 «업체 주소로 오간 첨부 메일 → 어느 업체·어느 서류 줄에 무슨 상태로 기록할지» 를 결정한다(분류·줄 고르기·안전 규칙). (2) 서버 예약 함수 `functions/gov-report-auto.js`(+`index.js` 한 줄)가 한 시간마다 메일함 거울·업체·일정·서류 기록을 읽어 그 결정을 적용(또는 시범 운행이면 기록만)하고 결과를 `scal_autoRun/...` 에 남긴다. 서버에는 `js/` 가 안 올라가므로 필요한 순수 모듈을 `scripts/sync-gov-report-core.js` 로 `functions/gov-report-core/` 에 «글자 그대로» 옮기고 같음 검사를 둔다(선례: `scripts/sync-mail-fill-core.js`). (3) 화면(`gov-report.html`)의 «오늘 할 일» 에 «🤖 메일 자동 처리» 구역 — 상태(꺼짐·시범·켜짐)·마지막 실행·자동 처리 목록·되돌리기·모드 스위치(관리자). **새 DB 칸 `scal_autoRun`(새 규칙, 추가만), 새 서버 함수 하나.**

**Tech Stack:** Node 22 Cloud Functions(firebase-functions v1 `pubsub.schedule`), 바닐라 JS IIFE 모듈, Firebase RTDB 규칙(생성기), `node --test`.

**Spec:** 별도 설계서 없음 — 대표 지시 문장·선택과 본 계획서 «정한 것».

## 정한 것 (제가 정했다 — 대표 「묻지말고 끝까지」, 선택 «전부 자동 완료»)

### 안전장치 (전부 자동이라 더 엄격하게)
- **세 모드**(`scal_autoRun/cfg/mode`): `off`(아무것도 안 함) · `dry`(**시범 운행** — 읽고 «이렇게 했을 것»만 `scal_autoRun/last` 에 기록, 서류 기록은 **쓰지 않는다**) · `live`(실제로 쓴다). **cfg 가 없으면 `dry`**. `live` 로 바꾸는 일은 관리자만(규칙 MGR) — 처음 배포는 `dry`.
- **한 번에 건드리는 줄 수**: 실행 한 번에 최대 100줄(`MAX_ACTIONS`). 넘으면 오래된 메일부터 100건만 하고 나머지는 다음 실행에서.
- **사람 손이 닿은 줄은 안 건드린다**: 자동은 «기록이 없는 줄» 또는 «`st:'none'` 이고 `by`·`link`·`note` 가 모두 없는 줄»에만 쓴다. 사람이 저장한 줄(어떤 상태든 `by` 가 사람 이름)은 절대 덮지 않는다 → 사람이 자동 처리를 되돌리면(`by`=사람) 다시 자동 처리되지 않는다.
- **개인 자료·기술보호 메일은 자동 처리하지 않는다**: 첨부 이름·제목에 `PuGovReportBuild.PRIV_RE` 가 걸리면, 또는 기술보호 사업(`techguard` 계열)이면 후보에서 뺀다(기존 «받은 서류 확인» 수동 길에 남는다).
- **우리 주소(@pureun.kr)**·**업체관리에 다른 업체가 먼저 적은 주소**는 업체 귀속에 쓰지 않는다(`PuGovReportInbox.addrsFor` 그대로).
- **한 첨부 → 한 줄**: 줄을 «하나»로 정할 수 없으면(후보 줄이 둘 이상이고 점수가 같음) 아무 줄에도 안 쓰고 `unmatched` 로 로그에만 남긴다(수동 길에 그대로 남음).
- **종결 사업·업체 없는 사업·서류 틀 없는 사업은 안 본다**(`closed`·`PuGovReportDocs.NONE`).
- **메일함은 읽기만**(거울 `mailbox/*` 읽기 · 다음메일 원본은 안 건드림). **첨부 파일을 읽거나 복사하지 않는다**(첨부 «이름»만 거울에서 본다 — 연결 열쇠 `i:<폴더>:<uid>` + 첨부 이름만 기록).
- **동시 편집 보호**: 줄 하나를 쓸 때 서버 트랜잭션으로 «읽은 뒤 바뀌지 않았을 때만» 쓴다(그 사이 사람이 저장했으면 건너뜀).

### 분류·줄 고르기 규칙 (순수 모듈 — `PuGovReportAuto.plan`)
- **후보 메일**: `PuGovReportInbox` 의 거울 줄 중 «받은» 메일(`out:false`), 첨부 있음, 보낸 주소 ∈ 그 업체 주소(`addrsFor`), 최근 `WINDOW_DAYS = 45`일(`sinceWindow`), 아직 어느 줄에도 연결 안 된 것(`linked` — `scal_docs` 전체의 `link.key`), 개인 자료·기술보호 아님.
- **첨부 단계 추정(`stepOf`)**: 첨부 이름·메일 제목에서
  - `sign` ← `/서명|날인|직인|인감|스캔|signed/i` 또는 제목 꼬리표 `[서명요청:rid]`(회신) — 꼬리표가 있으면 `rid` 가 그 쌍을 못 박는다.
  - `attach` ← `/사진|회의록|결과물|산출물|증빙|명단|참석|출석|결과보고|활동일지/` (sign 에 안 걸릴 때만)
  - 그 밖은 `null`(자동 처리 안 함 → 수동 길).
- **줄 고르기(`pickKey`)**: 그 쌍의 서류 틀(`planFor`)에서 그 단계(`keysFor(plan, step, n)`)의 줄 키 중 «자동이 쓸 수 있는 줄(위 사람 손 규칙)»만 대상으로,
  1. 이름에 `N회차`/`N차`(1~60)가 있고 `id:N` 줄이 대상에 있으면 그 줄
  2. 줄 이름(`keys[].name`에서 회차 꼬리표를 뗀 것, 공백·괄호 제거)이 첨부 이름·제목에 들어 있으면 점수 2 — 가장 높은 하나(동점이면 없음)
  3. 대상이 정확히 하나면 그 줄
  4. 그 밖은 `null`(unmatched)
  한 업체가 이 단계에서 **둘 이상의 쌍**(사업)에 후보가 있으면 위 2·꼬리표 일치가 없을 때 `null`(엉뚱한 사업에 쓰지 않는다).
- **쓸 값(`act`)**: `{ st:'done', gotAt:<메일 날짜>, how:'mail', by:'자동', note:'자동 처리 — 메일 «첨부 이름»', link:{src:'mail', key, name, date}, at:<now> }` — 모양은 `PuGovReportTrack.patchFor`/`normRec` 를 거쳐 규칙(scal_docs)이 받아들이는 것만. `sentAt` 은 건드리지 않는다(없으면 없음). `by` 는 항상 `'자동'`(≤ 40자). `note` 는 200자 이내로 자른다.
- 한 메일의 여러 첨부는 각각 따로 줄을 고른다. 같은 줄을 두 번 쓰지 않는다(먼저 고른 것이 이김).

### 기록 (`scal_autoRun`) — 새 규칙, 추가만
- `scal_autoRun/cfg` = `{ mode:'off'|'dry'|'live', by?, at }` — **쓰기 MGR**(관리자·위임관리인), 읽기 직원.
- `scal_autoRun/last` = `{ at, mode, n, nDone, nUnmatched, items:[…≤100], note? }` — **서버만 쓴다**(규칙은 클라이언트 쓰기 거절 — 읽기 직원).
- `scal_autoRun/log/{YYYY-MM-DD}` = `{ at, mode:'live', items:[{ co, rid, key, step, mail, name, day, act:'done', prev:{…이전 줄}|null }]≤200 }` — 서버만 쓴다(live 일 때만 남김 — 되돌리기용 이전 값 포함). 같은 날 여러 실행은 `items` 에 이어 붙인다(상한 200).
- 읽기는 직원 모두(첨부 이름은 이미 `scal_docs` link 이름으로 직원에게 읽힌다). 키 꼴 `$day` = `^[0-9]{4}-[0-9]{2}-[0-9]{2}$`. `$other:false`.
- 되돌리기(화면, 관리자): 그 줄을 `prev` 로 «다시 저장»(`prev:null` 이면 `{st:'none', by:<사람>, at}` + **link 는 남긴다** — 메일은 «연결됨» 상태로 두어 다시 자동 처리되지 않게). 사람이 저장한 줄은 위 규칙으로 자동이 다시 안 건드린다.

### 서버 함수
- `govReportAuto`(예약, 서울 시간, **한 시간마다 07~20시**: `every 60 minutes` 안에서 서울 시각 07~20시만 일하고 나머지는 즉시 반환), 지역은 기존 메일 함수와 같은 `MAIL_REGION`, `timeoutSeconds:300`, `memory:'512MB'`. 열쇠(비밀) 없음 — 거울과 DB 만 읽는다.
- 읽는 것: `scal_cos`·`scal_types`·`scal_scheds`·`scal_staff`(= 화면 GR_NODES), `data/biz_cons_types`·`data/consultings`·`scal_erpTypeMap`(= GR_DOC_NODES 의 biz·cons·tmap), `data/companies`, `scal_bizState`(종결), `scal_docs`(기록 통째 — 화면과 같다), `mailbox/folders` + 박스 폴더(`PuGovReportInbox.boxesOf`)마다 `mailbox/msgs/{slug}` 의 **최근 400통**(`orderByKey().limitToLast(400)` — 번호가 클수록 새 메일).
- 모드 `off` 면 아무것도 읽지 않고 반환. 오류는 로그에 한 줄 + `scal_autoRun/last.note` 에 «실패: …»(내용 없는 짧은 글).
- 쓰는 것: `live` 일 때만 `scal_docs/{co}/{rid}/items/{key}` 줄 하나씩(트랜잭션) + `scal_autoRun/log/...` + `scal_autoRun/last`. `dry` 는 `last` 만.

### 화면
- «오늘 할 일» 맨 위(받은 서류 묶음 앞)에 «🤖 메일 자동 처리» 구역: 모드 딱지(꺼짐/시범/켜짐) · 마지막 실행 시각 · «최근 실행: 처리 n건 · 미배정 m건» · 관리자에게만 모드 선택 버튼(꺼짐·시범·켜짐 — 켜짐으로 바꿀 때 확인 창) · 최근 자동 처리 목록(최대 10건: 업체 · 서류 줄 · 첨부 이름 · 「메일 열기」(기존 `grOpenAtt` 길) · 「되돌리기」). 시범 운행이면 같은 목록이 «이렇게 처리할 예정» 으로 나온다.
- 서류 체크표·칸 창의 줄에서 `by==='자동'` 이면 작은 딱지 «자동».
- 쓰기는 두 가지만 늘어난다: `scal_autoRun/cfg` 한 칸 `.set`(모드) · 되돌리기 = 기존 `grSaveCell` 길(서류 줄 `.set`) — **`.set(` 합계는 5곳**(서류 줄·종결·되돌림표시·순서·cfg). 정적 검사의 쓰기 목록을 정확히 고친다.

## Global Constraints
- 규칙은 **추가만**(`scal_autoRun` 새 자리). 기존 규칙 불변. 생성물(`docs/firebase-rules-전체-적용본.json`·`docs/rules-paste.json`)은 생성기로 다시 만든다(선례: `git show 13031593`, `3a844444`). **게시·함수 배포는 컨트롤러가 한다** — 실행자는 **생성만**(드라이런·`--deploy`·`firebase deploy` 금지). `tests/photos-staff-share.test.js` 의 `PENDING` 에 새 경로를 더한다(게시 뒤 비운다). `tests/perf-rules.test.js` 의 `allowTop`·온톨로지(`js/pu-ontology.js` `govreport` 소유 루트·`writeContracts`)·`tests/gov-report-app.test.js` 의 writeContracts 정확 목록에 `scal_autoRun` 을 등록(선례 `scal_bizOrder` — `git show 3a844444 --stat`).
- 서버 사본(`functions/gov-report-core/`)은 **손으로 고치지 않는다** — `node scripts/sync-gov-report-core.js` 로만, 같음 검사(`tests/gov-report-core-in-sync.test.js`)가 한 글자라도 다르면 걸린다. 옮길 모듈: `pu-gov-report.js`·`pu-gov-report-build.js`·`pu-gov-report-list.js`·`pu-gov-report-track.js`·`pu-gov-report-docs.js`·`pu-gov-report-inbox.js`·`pu-gov-report-send.js`·`pu-gov-report-nav.js`·`pu-gov-report-auto.js`·`pu-co-thread.js`(+ 이들이 `require` 하는 것 — 실제로 `require('./…')` 를 따라가 빠짐없이). 서버 쪽 `require` 는 같은 폴더의 사본을 가리킨다(상대 경로가 똑같아서 그대로 동작해야 한다 — 안 되면 옮기는 쪽이 폴더 구조를 똑같이 만든다).
- 새 모듈은 **순수 함수**(DOM·전역·입출력 없음), 입력 불변, 결과가 입력과 객체를 공유하지 않는다. 합성 이름만(공개 저장소). 검사에 `?v=숫자` 금지(`\?v=\d+`). 바뀐 스크립트는 `?v` 올림(훅, `--no-verify` 금지). `gov-report.html` 은 CRLF — 부분 편집·줄바꿈 보존.
- 서버는 **고객사 메일 내용·첨부 바이트를 읽거나 로그에 남기지 않는다**(거울의 짧은 머리글 칸 + 첨부 «이름»만). 로그·오류 글에 이메일 주소를 넣지 않는다(업체 id·rid·줄 키·메일 열쇠·첨부 이름만).
- 서버 검사는 `functions/*.test.js` 로도 둔다(품질 검사가 `node --test tests/*.test.js functions/*.test.js` 를 돈다 — 선례 `functions/gov-feed-collect.test.js`). 네트워크·실제 DB 없이 가짜 DB 로.

## Review Focus
- **사람 손 규칙**: 사람이 저장한 줄(`by`=이름, 어떤 상태든)·`st:'none'` 이지만 `by` 가 있는 줄은 절대 덮이지 않는다 — Task 1 검사.
- **한 첨부 → 한 줄, 애매하면 없음**: 같은 점수 두 줄·두 쌍(사업)에 후보 — Task 1 검사.
- **dry 는 쓰지 않는다**: dry 실행에서 `scal_docs`·`log` 에 쓰기 0 — Task 2 검사(가짜 DB 쓰기 기록 0).
- **동시 편집**: 트랜잭션 도중 줄이 바뀌면 건너뛴다 — Task 2 검사.
- **개인 자료·기술보호·우리 주소·종결 사업**은 처리 0 — Task 1 검사.
- **100줄 상한·오래된 것부터**·**서울 07~20시 밖 즉시 반환**·**cfg 없음 = dry**·**off 면 읽기 0** — Task 2 검사.
- **되돌리기**가 `prev` 를 복원하고 link 를 남겨 다시 자동 처리되지 않는다 — Task 3 검사.
- **로그에 주소·본문 없음** — Task 2 검사(직렬화한 쓰기 전체에서 `@` 가 없다).

---

## File Structure

| 파일 | 일 |
|---|---|
| `js/pu-gov-report-auto.js` (신설) | 분류·줄 고르기·안전 규칙 — `plan(o)` 순수 결정 |
| `scripts/sync-gov-report-core.js`, `functions/gov-report-core/*` (신설, 생성 사본), `tests/gov-report-core-in-sync.test.js` | 서버용 사본 + 같음 검사 |
| `functions/gov-report-auto.js` (신설), `functions/index.js`(내보내기 한 줄), `functions/gov-report-auto.test.js` | 서버 실행기·예약 함수·가짜 DB 검사 |
| `scripts/make-firebase-rules.js`, 생성물 둘, `js/pu-ontology.js`, 검사들 | `scal_autoRun` 규칙·등록(생성만) |
| `gov-report.html`, `tests/gov-report-app.test.js` | «🤖 메일 자동 처리» 구역·모드 스위치·되돌리기·«자동» 딱지 |
| `STATUS.md`, `status/2026-10-22-gov-report-auto.md` | 기록 |

---

### Task 1: 순수 결정 모듈 `PuGovReportAuto`

**Files:** Create `js/pu-gov-report-auto.js`, `tests/gov-report-auto.test.js` (옆 모듈 `js/pu-gov-report-inbox.js`·`js/pu-gov-report-today.js` 의 꼴 — IIFE, Node·브라우저 겸용)

**Interfaces:**
- Consumes (모두 이미 있다 — 이 모듈이 `require`/전역으로 부른다): `PuGovReportDocs`(`visibleTypes`·`linkOf`·`pairs`·`planFor`·`consFor`·`NONE`)·`PuGovReportTrack`(`keysFor`·`recOf`·`normalize`·`patchFor`·`validate`)·`PuGovReportInbox`(`mailRows`·`addrsFor`·`candidates`·`sinceWindow`·`linkKey`·`PRIV_RE`·`OWN_RE` 없음 — `addrsFor` 가 처리)·`PuGovReportNav`(`closedTypeIds`)·`PuGovReportSend`(`TAG_RE` — 내보내는지 확인, 없으면 같은 정규식을 이 모듈 안에 두고 `tests` 로 같음 확인).
- Produces:
  - 상수 `WINDOW_DAYS = 45`, `MAX_ACTIONS = 100`, `AUTO_BY = '자동'`, `SIGN_RE`, `ATTACH_RE`
  - `stepOf(att, subject) → 'sign'|'attach'|null`
  - `usable(rec) → boolean` — «자동이 쓸 수 있는 줄»(위 사람 손 규칙): `!rec`(기록 없음) 또는 `rec.st==='none' && !rec.by && !rec.link && !rec.note`
  - `pickKey(o) → {key, why}|null` — `o = { plan, step, n, recs:{키:줄}, att:{name}, subject, multi:boolean }`
  - `plan(o) → { actions:[…], unmatched:[…], skipped:{…개수}, scanned:number, more:boolean }` — `o = { today, input, docs:{biz,cons,tmap}, companies, state(종결 scal_bizState), track(Track.normalize 결과), folders, msgs(거울 원본 {slug:{uid:행}}), years:[…]? }`. `actions[i] = { coId, rid, typeId, key, step, mailKey, name, day, subject?(자르지 않은 제목은 넣지 않는다), why, next:{…쓸 줄(normRec 통과 모양)}, prev:{…이전 줄}|null }` — 오래된 메일부터 `MAX_ACTIONS` 까지, `more`=남았음. `unmatched[i] = { coId, rid, mailKey, name, day, why }`(최대 100).
- [ ] **Step 1: 실패하는 검사 쓰기** — Review Focus 의 모든 줄(사람 손·한 첨부 한 줄·개인 자료·기술보호·우리 주소·종결 사업·100줄 상한·꼬리표 rid 못 박기·두 쌍 모호·회차 번호·줄 이름 점수·동점 없음·대형 틀 per-round 줄·간단형 once 줄) + `stepOf` 표(서명/날인/스캔/signed → sign, 사진/회의록/… → attach, 둘 다 걸리면 sign, 아무것도 아니면 null) + `usable` 표 + `act.next` 가 `Track.normalize` 통과 모양·`validate` 통과 + 입력 불변(JSON 비교) + 결과 객체 비공유 + 합성 한 업체 전체 시나리오(주소→후보→서명본 줄 완료). 실제 서류 틀 이름은 `PuGovReportDocs` 의 DOC_PLANS(예: 충남북부 상의·일터상생혁신)에서 가져온다(`grep -n "key:" js/pu-gov-report-docs.js`).
- [ ] **Step 2: 실패 확인** — `node --test tests/gov-report-auto.test.js`.
- [ ] **Step 3: 구현** — 순수 함수만. 모호하면 «쓰지 않는 쪽» 으로.
- [ ] **Step 4: 통과 확인** — 같은 명령 + `gov-report-*` 전체.
- [ ] **Step 5: 커밋** — `feat(gov-report): 메일 서류 자동 처리 결정 모듈 PuGovReportAuto`.

---

### Task 2: 서버 — 사본·실행기·예약 함수·규칙(생성만)

**Files:** Create `scripts/sync-gov-report-core.js`, `functions/gov-report-core/*`(스크립트가 만든다), `tests/gov-report-core-in-sync.test.js`, `functions/gov-report-auto.js`, `functions/gov-report-auto.test.js`; Modify `functions/index.js`(내보내기), `scripts/make-firebase-rules.js`, `docs/firebase-rules-전체-적용본.json`, `docs/rules-paste.json`, `js/pu-ontology.js`(+ `?v` 올림 페이지들), `tests/gov-report-rules.test.js`, `tests/photos-staff-share.test.js`, `tests/perf-rules.test.js`, `tests/gov-report-app.test.js`(writeContracts 목록만)

**Interfaces:**
- Consumes: Task 1 의 `PuGovReportAuto.plan`·`AUTO_BY`·`MAX_ACTIONS`; `functions/index.js` 의 `functions`·`getDatabase()`·`MAIL_REGION` 꼴(`exports.rulesLawWatch` 선례).
- Produces:
  - `functions/gov-report-auto.js` 가 내보내는 `run(deps) → {mode, n, nDone, nUnmatched, wrote:number, note}` — `deps = { db(ref/once/transaction 가진 가짜 가능), now:ms, today:'YYYY-MM-DD', hour:서울 시각 정수, log(msg) }`. 모드 읽기(`scal_autoRun/cfg/mode`, 없으면 `dry`), `off`·서울 07~20시 밖이면 즉시 `{mode, n:0, note:'쉼'}`, 입력 읽기(위 «서버 함수» 목록 — 박스 폴더 최근 400통), `Auto.plan`, `dry` → `last` 만 쓰기, `live` → 줄마다 `db.ref(scal_docs/…/items/key).transaction(cur => (바뀌지 않았으면 next, 바뀌었으면 undefined))` + `log/{today}` 이어 붙이기 + `last`. 모든 쓰기 값에서 `@` 가 없음을 `assert`(방어).
  - `exports.govReportAuto`(index.js) = `functions.region(MAIL_REGION).runWith({timeoutSeconds:300, memory:'512MB'}).pubsub.schedule('every 60 minutes').timeZone('Asia/Seoul').onRun(() => run(실제 deps))`.
  - 규칙 `rules.scal_autoRun`: `.read` LOGIN · `cfg`: `.write` MGR, `.validate` `newData.hasChildren(['mode','at'])`, `mode` `newData.isString() && (newData.val()==='off'||newData.val()==='dry'||newData.val()==='live')`, `by` ≤40자, `at` 숫자, `$other` 거절 · `last`·`log` 에는 `.write` 를 두지 않는다(클라이언트 쓰기 거절 — 서버 admin 만) — `.validate` 도 두지 않는다(서버가 쓴다). 루트 `.write` 없음.
- [ ] **Step 1: 실패하는 검사 쓰기** — (a) 같음: `tests/gov-report-core-in-sync.test.js`(스크립트 `옮길것` 모든 파일이 `js/` 와 한 글자도 다르지 않음, 옮긴 폴더에서 `require('…/pu-gov-report-auto.js')` 가 오류 없이 불러짐). (b) 실행기: 가짜 DB 로 — `off`=읽기 0·쓰기 0 · cfg 없음=`dry`·쓰기는 `last` 한 곳뿐 · `dry` 에서 `scal_docs`·`log` 쓰기 0 · `live` 에서 줄마다 트랜잭션·`log` 이어 붙이기(상한 200)·`last` · 트랜잭션 중 줄이 바뀐 가짜(콜백이 다른 값을 봄) → 건너뜀(`wrote` 에 안 셈) · 서울 시각 06·21시 → 즉시 반환·읽기 0 · 100줄 상한 · 모든 쓰기를 `JSON.stringify` 한 것에 `@` 없음 · 읽기 실패(가짜 DB 가 던짐) → 던지지 않고 `last.note` 에 «실패» 한 줄. (c) 규칙(`tests/gov-report-rules.test.js`): 읽기 LOGIN·루트 쓰기 문 없음·`cfg` 쓰기 MGR(`scal_bizOrder` 검사와 같은 비교 꼴)·`mode` 세 값·`last`·`log` 에 쓰기 문 없음·`$other` 거절. 온톨로지·`allowTop`·`writeContracts` 등록 검사.
- [ ] **Step 2: 실패 확인** — `node --test tests/gov-report-core-in-sync.test.js functions/gov-report-auto.test.js tests/gov-report-rules.test.js`.
- [ ] **Step 3: 구현** — 스크립트 `scripts/sync-gov-report-core.js`(선례를 본뜬다; `require('./…')` 를 따라가 빠짐없이), 그것으로 사본 생성, 실행기, 예약 함수, 규칙·생성물 재생성(바이트 안전: BOM 없음·기존 줄바꿈 유지 — 줄바꿈만 다른 생성물은 `git checkout --`), 온톨로지 등록(`?v` 올림은 훅이 요구하는 대로), `PENDING` 한 줄.
- [ ] **Step 4: 통과 확인** — 위 명령 + `node --test tests/*.test.js functions/*.test.js` 전체(`--test-concurrency=6`; 실패 파일은 하나씩 재실행해 간헐 여부 기록). **게시·배포 명령은 돌리지 않는다.**
- [ ] **Step 5: 커밋** — `feat(gov-report): 메일 서류 자동 처리 서버(예약 함수·시범 운행) + scal_autoRun 규칙(생성만)`.

---

### Task 3: 화면 — «🤖 메일 자동 처리» 구역

**Files:** Modify `gov-report.html`, `tests/gov-report-app.test.js`

**Interfaces:**
- Consumes: `scal_autoRun`(읽기 `cfg`·`last`·`log/{오늘}`), 기존 `grOpenAtt`(메일 열기)·`grSaveCell`(줄 저장)·`PuGovReportTrack`·`PuGovReportAuto.AUTO_BY`·`GR_BIZ` 꼴의 이름 표(글자 그대로 `ref('scal_autoRun…')` 금지 — 상수 표 `GR_AUTO`).
- Produces: `GR.auto`(읽은 값) · `grLoadAuto()`(한 번 읽기 — `grLoad` 끝에서; 실패는 «자동 처리 상태를 못 읽음» 한 줄) · `grRenderAuto()` — «오늘 할 일» 구역 `.td-auto`(모드 딱지·마지막 실행·처리/미배정 수·목록 ≤10줄) · `grSetAutoMode(mode)`(관리자; `live` 는 `confirm`) — 유일한 새 `.set` · `grUndoAuto(i)` — `prev` 로 `grSaveCell` 길 저장(`prev:null` 이면 `{st:'none', by:<사람>}`; link 는 남김) · 줄 딱지 «자동»(`rec.by==='자동'`).
- [ ] **Step 1: 실패하는 검사 쓰기**(정적 + vm world) — `.set(` 합계 다섯(정확한 목록) · `ref('scal_autoRun` 글자 없음(상수 표로만) · 구역에 모드 딱지·목록·「메일 열기」·「되돌리기」 · 직원 계정에는 모드 버튼 없음(또는 눌러 거절 시 안내, 값 불변) · 읽기 실패 안내 · 되돌리기가 `prev` 로 저장하고 link 유지 · 되돌린 줄은 `by` 가 사람 이름 · 목록 값 `grEsc`(업체명·첨부 이름 `<b>` 이스케이프) · 서류 체크표 `by==='자동'` 딱지 · 기존 오늘 할 일·대시보드·끌기 검사 불변.
- [ ] **Step 2: 실패 확인** — `node --test tests/gov-report-app.test.js`.
- [ ] **Step 3: 구현** — 위. 색 직접 지정 금지(기존 변수). CRLF 보존.
- [ ] **Step 4: 통과 확인** — `gov-report-*`·`photos-staff-share`·`perf-rules`·`test-pin-guard`·훅.
- [ ] **Step 5: 커밋** — `feat(gov-report): «🤖 메일 자동 처리» — 상태·시범 목록·모드 스위치·되돌리기`.

---

### Task 4: 기록
**Files:** Modify `STATUS.md`(맨 끝 한 줄, BOM 보존·byte-safe), Create `status/2026-10-22-gov-report-auto.md`
- [ ] 상태 노트(무엇을·안전장치·모드·한계·배포 순서: 규칙 게시 → 함수 배포 → 시범 운행 관찰 → 대표가 켜짐으로) + STATUS.md 한 줄 + 커밋 `docs(status): 메일 서류 자동 처리 기록`.
