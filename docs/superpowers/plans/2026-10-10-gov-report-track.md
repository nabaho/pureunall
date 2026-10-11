# 컨설팅보고서 앱 — 서류 진행 기록(③서명본·④별첨·⑤제출) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 서류 체크표의 ③ 업체 서명본 · ④ 산출물 별첨 · ⑤ 기관 제출 칸을 눌러 상태·날짜·메모를 «줄 하나씩» 남기고(`scal_docs/{업체}/{rid}/items/{키}`), 현황판의 숫자 칸 「서명」·「제출」·⏰ 챙길 것·목차 딱지·진행 막대가 그 기록을 모아 보인다. 메일·플랫폼은 대신하지 않는다 — 사람이 한 일을 남기는 «기록»이다.

**Architecture:** 칸 상태 계산·읽기 다듬기·저장 꼴·검사는 새 순수 모듈 `js/pu-gov-report-track.js`(UMD, `window.PuGovReportTrack` / `module.exports`, 의존 없음)에 둔다.
- 서류 틀(`DOC_PLANS`)·ERP 연결·계약 맞추기를 아는 `js/pu-gov-report-docs.js` 가 그 모듈을 불러 체크표 ③④⑤ 칸(`docsTable({…, track, today})`)·목차 딱지(`tocFor({…, rec, today})`)·현황판 줄의 기록(`trackRows(rows, o)` → `r.trk`, ③④ 막대)을 만든다. `track` 을 안 주면(못 읽음) 지금처럼 「—」.
- `gov-report.html` 은 «읽고(`scal_docs` 한 번, 이름 표 `GR_TRACK_NODES`) → 모듈에 넣고 → 그린다» + 칸 창 + **쓰기 한 곳**(`grSaveCell` 의 줄 키 하나 `.set`). 저장 관문(`pu-ontology-write.js`, 이 앱은 강제 모드)은 레코드 모양이 아닌 `.set` 은 통과시키고 «부분 `update`» 는 막으므로 `update` 를 쓰지 않는다.
- 규칙은 생성기(`scripts/make-firebase-rules.js`)에 `scal_docs`(위쪽 칸 관리자 전용 · 줄 키만 직원 쓰기 · 모양 검사)를 넣고 JSON 둘을 다시 만든다. **게시하지 않는다** — 합친 뒤 컨트롤러가 대표 승인을 받는다. 게시 전에는 읽기가 거절되어 화면은 읽기 전용(「기록을 못 불러왔습니다 — 규칙 게시 또는 권한 확인」), 쓰기가 거절되면 「저장하지 못했습니다 — 규칙 게시 또는 권한 확인」.

**Tech Stack:** 빌드 없는 정적 HTML + Firebase RTDB compat 9.23.0 · 브라우저/Node 겸용 UMD js(`js/pu-gov-report-list.js` 꼴) · `node --test` + `vm` · 가짜 RTDB `tests/helpers/fake-rtdb.js`(`쓴것` 쓰기 기록) · 합성 자료 `tests/helpers/gov-report-fixture.js` · 규칙 생성기 `scripts/make-firebase-rules.js`

**Spec:** `docs/superpowers/specs/2026-10-10-gov-report-track-design.md` (상위 `docs/superpowers/specs/2026-10-10-gov-report-docs-design.md`, 앞 계획 `docs/superpowers/plans/2026-10-10-gov-report-docs.md`)

## Global Constraints

- 새 자리 `scal_docs/{업체번호}/{rid}` — rid = `{사업번호}_{연도}`(`scal_reports` 와 같다, 연도 = 사전진단 뺀 첫 회차의 해 — `pairs`/`buildRows` 의 `rid` 를 그대로 쓴다). 줄: `items/{키}` = `{ st:'done'|'doing'|'blocked'|'na'|'none', sentAt?:'YYYY-MM-DD', gotAt?:'YYYY-MM-DD', by?:'이름', at:<epoch ms>, note?:'짧은 메모', how?:'mail'|'platform'|'post'|'other', ack?:true }`.
- 키 = 서류 틀 줄 id, 회차마다인 줄은 `id:회차`(꼴 `^[a-z]+(:[0-9]+)?$`, 20자 이하). 알 수 없는 키·모양 틀린 줄은 읽기에서 버린다.
- 한 번에 **줄 키 하나만** 쓴다: `fbDb.ref('scal_docs/'+co+'/'+rid+'/items/'+key).set(rec)`. `update`·`remove`·`transaction`·`push` 는 쓰지 않는다(저장 관문이 부분 update 를 막는다). `u`(rid 칸 시각)는 쓰지 않는다 — 줄마다 `at` 이 있다.
- 메모 200자 · 이름 40자 · 날짜는 `YYYY-MM-DD` 만. 창에 「메모에 연락처·주민번호 같은 개인정보를 적지 마세요」(검사로 막지는 않는다).
- 칸마다 고를 수 있는 상태: `sign` 없음·진행(발송함)·완료(회신 받음)·막힘 / `attach` 없음·진행·완료·해당없음 / `submit` 없음·진행(제출 준비)·완료(제출함)·막힘. 표시 ○ ◐ ● ✕ —.
- 칸 상태(여러 서류가 한 칸이면 모아서): «막힘 > 완료(해당없음 뺀 전부 완료) > 진행(하나라도 진행·완료) > 없음», 전부 해당없음이면 해당없음.
- ③④⑤ 칸은 ①② 자동이 있는 간단형 셋(`AUTO`: `cci-north`·`cci-seosan`·`techguard`)만 그린다. 틀에 그 step 이 없으면 「—」(기술보호는 ③ 이 없다). 대형·틀 없음은 지금처럼 «서류 목차 보기» 줄만.
- 숫자 칸: 서명 = ③ 이 진행·완료인 줄 수, 제출 = ⑤ 완료 줄 수. ⏰ 새 두 줄: 「서명 회신 기다림 (7일 넘음)」(③ `sentAt` 있고 `gotAt` 없이 7일 «넘게») · 「제출 기한 지남」(⑤ 완료 아님 + 기한(이알피 계약 종료일) < 오늘).
- 규칙: `scal_docs` 루트·`$co`·`$rid`·`items` 쓰기 = 관리자(위에서 뚫지 못하게) · `$key` 쓰기 = `(LOGIN) && (newData.exists() || ADMIN)` · 읽기 = LOGIN. **규칙 게시(`scripts/rules-deploy.js --deploy`)는 이 계획의 어느 단계에서도 하지 않는다.** 생성기 고침 + JSON 두 개(`docs/firebase-rules-전체-적용본.json`·`docs/rules-paste.json`) 다시 만들기까지만.
- 등록부: `govreport.primaryRoots` 에 `scal_docs` · `writeContracts` 에 `{path:'scal_docs/{co}/{rid}/items/{key}',entityType:'Document'}`. `activeWriter/gov_report` 는 그대로 둔다.
- innerHTML 에 넣는 바깥 값은 모두 `grEsc`. vm 으로 떠 오는 함수(`grab`) 글자열 안에 짝 없는 `{`·`}` 금지. 정규식에 «글자 뒤 `\n`» 금지(`\r?\n`).
- 색은 저장소 팔레트만 — `gov-report.html` 이 이미 쓰는 변수(`--blue*`·`--amber*`·`--green*`·`--red*`·`--line`·`--mute`)와 기존 `.st-*` 딱지만. 새 입력칸 CSS 에 `font-size` 를 쓰지 않는다(폰 확대 규칙 `@media (max-width:768px){ input,select,textarea{font-size:16px} }` 을 이기지 않게, `tests/phone-input-zoom.test.js`).
- 공개 저장소 — 업체·사람은 합성 이름만(가나상사·다라정밀·마바산업·사아테크·홍길동·김가나).
- 캐시 번호: 새 `js/pu-gov-report-track.js` 는 `gov-report.html` 에서 `?v=1`(docs 앞에 싣는다). `js/pu-gov-report-docs.js` 를 고치면 `?v=2 → 3`. `js/pu-ontology.js` 를 고치면 부르는 **모든** html(지금 24곳, `?v=61`)을 같은 커밋에서 `?v=62` 로 — 바이트 보존 바꾸기 스크립트로(일부 html 이 CRLF/BOM/섞임), 끝나고 `git grep` 으로 한 값인지 본다. pre-commit 훅 `scripts/check-cache-version.js` · `--no-verify` 금지.
- 작업트리는 CRLF(`core.autocrlf=true`). 기존 파일 줄 끝을 바꾸지 않는다(Edit 도구는 그대로 둔다). 새 파일은 LF 로 써도 된다. PowerShell 5.1 의 `>` 는 UTF-16 으로 쓰므로 파일 만들기에 쓰지 않는다.
- 커밋 메시지는 한국어, 끝에 빈 줄 + `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. 이 방의 Bash 는 따옴표를 씹으므로 커밋은 PowerShell here-string 으로.
- 실행: `node --test tests/<파일>.test.js`. 전체: `node --test "tests/**/*.test.js"`. 통과하는 검사 안의 `✖ 올리지 않았습니다 — 기준이 N일 된 것입니다` 는 날짜 잡음이다.
- push·PR·규칙 게시 승인 요청은 컨트롤러가 한다.

## 파일 구조

| 파일 | 할 일 |
|---|---|
| `js/pu-gov-report-track.js` (새) | 순수 함수: `keyOf` · `keysFor` · `normalize` · `recOf` · `put` · `stateOf` · `label` · `chipOf` · `cellFor` · `itemChip` · `rowTrack` · `kpiHit` · `kpiExtra` · `alertsExtra` · `validate` · `patchFor` + 상수 `STATES`·`ST_KO`·`MARK`·`ALLOWED`·`COL_KO`·`STEPS`·`HOW`·`CHIP`·`NOTE_MAX`·`BY_MAX`·`WAIT_SIGN_DAYS`·`KEY_RE`·`SAVE_FAIL`·`LOAD_FAIL` |
| `tests/gov-report-track.test.js` (새) | 모듈 검사(저장 관문 통과 포함) |
| `js/pu-gov-report-docs.js` (고침) | `docsTable` 이 `track`·`today` 를 받아 ③④⑤ · 줄에 `rid`·`planned` · `tocFor` 가 `rec`·`today` 를 받아 ③④⑤ 딱지 · 새 `trackRows` · 상수 `TRACK_COLS` |
| `tests/gov-report-docs.test.js` (고침) | 새 검사 셋 |
| `tests/helpers/gov-report-fixture.js` (고침) | `seed().scal_docs` + `track()` |
| `scripts/make-firebase-rules.js` (고침) + `docs/firebase-rules-전체-적용본.json`·`docs/rules-paste.json` (다시 만듦) | `scal_docs` 규칙 |
| `tests/gov-report-rules.test.js` (고침) · `tests/perf-rules.test.js` (allowTop) · `tests/photos-staff-share.test.js` (PENDING) | 규칙 검사 · 게시 대기 목록 |
| `js/pu-ontology.js` (고침) + html 24개 `?v` | `govreport` 소유 자리·쓰기 계약 |
| `gov-report.html` (고침) | 싣기(T1) · 읽기·칸 창·쓰기·숫자 칸·챙길 것·목차·거르개(T3) |
| `tests/gov-report-app.test.js` (고침) | 싣기 차례(T1) · 등록부 단언(T2) · 쓰기 좁히기·새 화면 검사(T3) |
| `STATUS.md` (고침) · `status/2026-10-10-gov-report-track.md` (새) | 기록 + 「게시 승인 대기」 |

## 자료 꼴 (모든 작업 공통)

```js
/* DB */
scal_docs = { c2: { t3_2026: { items: { sign: { st:'doing', sentAt:'2026-09-20', by:'홍길동', at:1789… } } } } }
/* normalize 뒤(화면이 들고 있는 GR.track) — items 를 한 층 걷어 낸다 */
track = { c2: { t3_2026: { sign: { st:'doing', sentAt:'2026-09-20', by:'홍길동', at:1789… } } } }
recOf(track, 'c2', 't3_2026') → { sign: {…} }   // 없으면 {}
keysFor(plan, 'attach', 3) → [{ key:'advice:1', id:'advice', name:'법률 자문 일지 1회차', round:1 }, …, { key:'pledge', id:'pledge', name:'보안서약서', round:0 }, …]
chipOf / cellFor → { step:'sign', st:'doing', txt:'◐ 발송함 · 회신 20일째', key:'draft', done:0, total:1, wait:20, keys:['sign'] }
   // key 는 화면 딱지 이름: done→'done' · doing→'draft' · blocked→'todo' · none→'wait' · na→''
rowTrack(plan, rec, n, due, today) → { due:'YYYY-MM-DD'|'', sign:cell|null, attach:cell|null, submit:cell|null, waitDays:number|null, bar3:boolean, bar4:boolean }
현황판 줄(buildRows) + trackRows → r.trk = rowTrack(…)|null, r.st.steps = [①, ②, bar3, bar4]
alertsExtra(rows, today) → { waitSign:[{ row, days }], overdue:[{ row, due }] }
```

합성 기록(오늘 2026-10-10) — `seed().scal_docs`
- c2 다라정밀 · t3_2026(충남북부, 계약 k2 종료 2026-12-31): `sign` 진행, 발송 2026-09-20, 회신 없음 → 회신 20일째(⏰).
- c3 마바산업 · t4_2026(서산, 계약 없음 → 기한 없음): `sign` 완료(발송 05-20·회신 05-25) · `attach` 해당없음 · `submit` 완료(메일·접수 확인).
- c1 가나상사 · t1_2026(기술보호, 계약 k1 종료 2026-09-30): 기록 없음 → ⑤ 없음 + 기한 지남(⏰). 기술보호 틀에는 ③ 이 없다.

---

### Task 1: 순수 모듈 `js/pu-gov-report-track.js` + 서류 모듈이 기록을 받아 ③④⑤·목차 딱지·줄 기록을 만든다

**Files:**
- Create: `js/pu-gov-report-track.js`
- Create: `tests/gov-report-track.test.js`
- Modify: `js/pu-gov-report-docs.js` (머리 주석 · 모듈 불러오기 · `docsTable` · `tocFor` · 새 `trackRows` · `api`)
- Modify: `tests/helpers/gov-report-fixture.js` (`scal_docs` · `track()`)
- Modify: `tests/gov-report-docs.test.js` (새 검사 셋)
- Modify: `gov-report.html` (스크립트 싣기 한 줄 + `pu-gov-report-docs.js?v=2 → 3`)
- Modify: `tests/gov-report-app.test.js` (싣기 차례 검사)

**Interfaces:**
- Consumes: `PuGovReportDocs.DOC_PLANS` 의 줄 모양 `{ id, name, per:'once'|'round'|'month', step:'report'|'sign'|'attach'|'submit'|'plat' }`(이미 있음) · `pairs()` 의 `rid`·`rounds`·`planned`(이미 있음) · `buildRows()` 줄의 `coId`·`typeId`·`typeName`·`rid`·`rounds`·`maxRounds`·`st.steps`(이미 있음)
- Produces (`window.PuGovReportTrack` / `module.exports`):
  - `keyOf(item, round) → 'id'|'id:round'` · `keysFor(plan, step, n) → [{ key, id, name, round }]`(`per:'month'` 는 넣지 않는다)
  - `normalize(raw) → track` · `recOf(track, coId, rid) → { [key]: rec }`(없으면 `{}`) · `put(track, coId, rid, key, rec) → 새 track`(원본 안 바꿈)
  - `stateOf(sts:string[]) → 'none'|'doing'|'done'|'blocked'|'na'` · `label(step, st) → '◐ 발송함'…`
  - `chipOf(step, keys, rec, today) → cell` · `cellFor(plan, rec, step, n, today) → cell|null` · `itemChip(item, rec, n, today) → {txt,key}|null`
  - `rowTrack(plan, rec, n, due, today) → { due, sign, attach, submit, waitDays, bar3, bar4 }`
  - `kpiHit(row, 'signed'|'submitted') → boolean` · `kpiExtra(rows) → { signed, submitted }` · `alertsExtra(rows, today) → { waitSign:[{row,days}], overdue:[{row,due}] }`
  - `validate(entry, step) → ''|'오류 문구'` · `patchFor(entry, who, now) → rec`
  - 상수 `STATES` · `ST_KO` · `MARK` · `ALLOWED` · `COL_KO` · `STEPS` · `HOW` · `CHIP` · `NOTE_MAX`(200) · `BY_MAX`(40) · `WAIT_SIGN_DAYS`(7) · `KEY_RE` · `SAVE_FAIL` · `LOAD_FAIL`
- Produces (`PuGovReportDocs` 추가·변경):
  - `docsTable(o)` — `o.track`(normalize 된 전체)·`o.today` 를 받으면 간단형 줄의 `cells[2..4]` 가 `cell`(`step` 칸 있음) 또는 `{txt:'—',key:''}`. 줄에 `rid`·`planned` 를 더한다. `o.track` 이 없으면 지금과 같다.
  - `tocFor(o)` — `o.rec`(그 업체·rid 의 `recOf` 값)·`o.today` 를 받으면 간단형의 sign/attach/submit 줄 딱지를 `itemChip` 으로.
  - `trackRows(rows, { track, input, biz, tmap, consultings, today }) → rows` — 줄마다 `r.trk`(간단형만, 아니면 `null`)·`r.st.steps[2..3]`(③④ 막대). `track` 이 없으면 `r.trk=null`, 막대 ③④ 는 꺼진다.
  - 상수 `TRACK_COLS = ['sign','attach','submit']`

- [ ] **Step 1: 합성 자료 넓히기** — `tests/helpers/gov-report-fixture.js`

머리 주석 끝 줄(` *   이알피 계약: k1 (주)가나상사 03 … — 마바산업은 계약 없음 */`)을 다음으로 바꾼다.

```js
 *   이알피 계약: k1 (주)가나상사 03 (2026-05-01~09-30, 담당 P-009) · k2 다라정밀 04 (담당 P-404 = 명부에 없음) — 마바산업은 계약 없음
 * 서류 진행 기록(2026-10-10, 설계 2026-10-10-gov-report-track-design.md) — scal_docs
 *   c2 다라정밀 t3_2026 sign 진행(발송 09-20, 회신 없음 → 20일째) · c3 마바산업 t4_2026 sign 완료 · attach 해당없음 · submit 완료
 *   c1 가나상사 t1_2026 은 기록 없음(기한 09-30 지남) */
```

`scal_erpTypeMap: { … },` 줄 바로 다음에 더한다.

```js
    scal_docs: {
      c2: { t3_2026: { items: { sign: { st: 'doing', sentAt: '2026-09-20', by: '홍길동', at: Date.UTC(2026, 8, 20, 3) } } } },
      c3: { t4_2026: { items: {
        sign: { st: 'done', sentAt: '2026-05-20', gotAt: '2026-05-25', by: '김가나', at: Date.UTC(2026, 4, 25, 3) },
        attach: { st: 'na', by: '김가나', at: Date.UTC(2026, 4, 25, 3) },
        submit: { st: 'done', gotAt: '2026-05-28', how: 'mail', ack: true, by: '김가나', at: Date.UTC(2026, 4, 28, 3), note: '접수 메일 받음' },
      } } },
    },
```

`module.exports = { seed, input, docs };` 를 다음으로 바꾼다.

```js
/* 서류 진행 기록(DB 모양 그대로) */
function track() { return seed().scal_docs; }
module.exports = { seed, input, docs, track };
```

- [ ] **Step 2: 실패하는 모듈 검사** — `tests/gov-report-track.test.js` (새)

```js
'use strict';
/* 컨설팅보고서 앱 — 서류 진행 기록(③서명본·④별첨·⑤제출) 순수 함수 (2026-10-10)
 * ★ 지키는 것: 줄 키 꼴 · 모양 틀린 줄은 읽기에서 버림 · «막힘 > 완료 > 진행 > 없음»(해당없음 뺌) ·
 *   칸마다 고를 수 있는 상태 · 날짜 꼴·메모 200자 · 저장 꼴은 저장 관문을 통과하는 .set 한 줄
 * 공개 저장소다 — 합성 자료만. */
const test = require('node:test');
const assert = require('node:assert/strict');
const Tr = require('../js/pu-gov-report-track.js');
const D = require('../js/pu-gov-report-docs.js');
const W = require('../js/pu-ontology-write.js');

const T0 = '2026-10-10';
const NORTH = D.planFor('인사노무컨설팅충남북부상의');
const TG = D.planFor('통합기술보호지원단');

test('상수 — 상태 다섯 · 칸마다 고를 수 있는 상태 · 방식 넷 · 한도', () => {
  assert.deepEqual(Tr.STATES, ['none', 'doing', 'done', 'blocked', 'na']);
  assert.deepEqual(Tr.ALLOWED, { sign: ['none', 'doing', 'done', 'blocked'], attach: ['none', 'doing', 'done', 'na'],
    submit: ['none', 'doing', 'done', 'blocked'] });
  assert.deepEqual(Tr.STEPS, ['sign', 'attach', 'submit']);
  assert.deepEqual(Object.keys(Tr.HOW), ['mail', 'platform', 'post', 'other']);
  assert.equal(Tr.NOTE_MAX, 200);
  assert.equal(Tr.BY_MAX, 40);
  assert.equal(Tr.WAIT_SIGN_DAYS, 7);
  assert.equal(Tr.SAVE_FAIL, '저장하지 못했습니다 — 규칙 게시 또는 권한 확인');
  assert.equal(Tr.LOAD_FAIL, '기록을 못 불러왔습니다 — 규칙 게시 또는 권한 확인');
  assert.equal(Tr.COL_KO.sign, '③ 업체 서명본');
});

test('keyOf · keysFor — 줄 id, 회차마다면 id:회차 · 월별 줄은 넣지 않는다', () => {
  assert.equal(Tr.keyOf({ id: 'sign' }, 0), 'sign');
  assert.equal(Tr.keyOf({ id: 'advice' }, 2), 'advice:2');
  const a = Tr.keysFor(TG, 'attach', 3);
  assert.deepEqual(a.map((k) => k.key), ['advice:1', 'advice:2', 'advice:3', 'pledge', 'travel', 'survey']);
  assert.equal(a[0].name, '법률 자문 일지 1회차');
  assert.equal(a[3].name, '보안서약서');
  assert.deepEqual(Tr.keysFor(TG, 'sign', 3), [], '기술보호에는 서명본 줄이 없다');
  assert.deepEqual(Tr.keysFor(NORTH, 'submit', 3).map((k) => k.key), ['submit']);
  assert.deepEqual(Tr.keysFor(D.planFor('산업일자리전환컨설팅충남'), 'report', 3).map((k) => k.key), ['result', 'after']);
  assert.deepEqual(Tr.keysFor(null, 'sign', 1), []);
});

test('normalize — 모양 틀린 줄·모르는 상태·나쁜 키는 버리고 items 를 걷어 낸다', () => {
  const raw = {
    c1: { t1_2026: { u: 9, items: {
      submit: { st: 'doing', at: 5, note: '  메모  ', how: 'mail', ack: true, sentAt: '2026/09/01', extra: 1 },
      'advice:2': { st: 'done', gotAt: '2026-09-02', by: '홍길동' },
      'BAD KEY': { st: 'done', at: 1 },
      abcdefghijklmnopqrstu: { st: 'done', at: 1 },
      pledge: { st: 'weird', at: 1 },
      survey: 'x',
      travel: { st: 'none', at: 1, how: 'constructor', ack: 'yes' },
    } } },
    c2: 'x',
    c3: { r: null },
  };
  assert.deepEqual(Tr.normalize(raw), { c1: { t1_2026: {
    submit: { st: 'doing', at: 5, note: '메모', how: 'mail', ack: true },
    'advice:2': { st: 'done', at: 0, gotAt: '2026-09-02', by: '홍길동' },
    travel: { st: 'none', at: 1 },
  } } });
  assert.deepEqual(Tr.normalize(null), {});
  assert.deepEqual(Tr.normalize([1, 2]), {});
  const long = Tr.normalize({ c: { r: { items: { k: { st: 'done', at: 1, note: '가'.repeat(250), by: '나'.repeat(50) } } } } }).c.r.k;
  assert.equal(long.note.length, 200);
  assert.equal(long.by.length, 40);
});

test('recOf · put — 없으면 빈 객체, put 은 원본을 바꾸지 않고 나쁜 키는 무시', () => {
  const a = Tr.normalize(null);
  const b = Tr.put(a, 'c1', 't1_2026', 'submit', { st: 'done', at: 3 });
  assert.deepEqual(a, {});
  assert.deepEqual(b, { c1: { t1_2026: { submit: { st: 'done', at: 3 } } } });
  assert.deepEqual(Tr.put(b, 'c1', 't1_2026', 'BAD KEY', { st: 'done', at: 1 }), b);
  assert.equal(Tr.recOf(b, 'c1', 't1_2026').submit.st, 'done');
  assert.deepEqual(Tr.recOf(b, 'cx', 'r'), {});
  assert.deepEqual(Tr.recOf(null, 'a', 'b'), {});
});

test('stateOf — 막힘 > 완료 > 진행 > 없음, 해당없음은 빼고 센다', () => {
  assert.equal(Tr.stateOf([]), 'none');
  assert.equal(Tr.stateOf(['na', 'na']), 'na');
  assert.equal(Tr.stateOf(['done', 'blocked']), 'blocked');
  assert.equal(Tr.stateOf(['done', 'na', 'done']), 'done');
  assert.equal(Tr.stateOf(['none', 'done']), 'doing');
  assert.equal(Tr.stateOf(['doing']), 'doing');
  assert.equal(Tr.stateOf(['none', 'none']), 'none');
  assert.equal(Tr.stateOf(['x']), 'none');
});

test('label — 칸마다 말이 다르다', () => {
  assert.equal(Tr.label('sign', 'doing'), '◐ 발송함');
  assert.equal(Tr.label('sign', 'done'), '● 회신 받음');
  assert.equal(Tr.label('submit', 'doing'), '◐ 제출 준비');
  assert.equal(Tr.label('submit', 'done'), '● 제출함');
  assert.equal(Tr.label('attach', 'done'), '● 완료');
  assert.equal(Tr.label('attach', 'na'), '— 해당없음');
  assert.equal(Tr.label('sign', 'blocked'), '✕ 막힘');
  assert.equal(Tr.label('attach', 'none'), '○ 없음');
});

test('cellFor · itemChip — 칸 상태·딱지 이름·회신 N일째·여러 서류는 완료/전체', () => {
  const rec = { sign: { st: 'doing', sentAt: '2026-09-20', at: 1 } };
  assert.deepEqual(Tr.cellFor(NORTH, rec, 'sign', 3, T0), { step: 'sign', st: 'doing', txt: '◐ 발송함 · 회신 20일째', key: 'draft',
    done: 0, total: 1, wait: 20, keys: ['sign'] });
  assert.equal(Tr.cellFor(NORTH, rec, 'sign', 3, '2026-09-25').txt, '◐ 발송함 · 회신 5일째');
  const tg = { 'advice:1': { st: 'done', at: 1 }, 'advice:2': { st: 'done', at: 1 }, 'advice:3': { st: 'doing', at: 1 },
    pledge: { st: 'na', at: 1 }, travel: { st: 'done', at: 1 }, survey: { st: 'done', at: 1 } };
  const c = Tr.cellFor(TG, tg, 'attach', 3, T0);
  assert.deepEqual([c.st, c.txt, c.key, c.done, c.total], ['doing', '◐ 진행 4/5', 'draft', 4, 5]);
  assert.equal(Tr.cellFor(TG, tg, 'sign', 3, T0), null, '기술보호에는 ③ 이 없다');
  const na = Tr.cellFor(NORTH, { attach: { st: 'na', at: 1 } }, 'attach', 3, T0);
  assert.deepEqual([na.st, na.txt, na.key, na.total], ['na', '— 해당없음', '', 0]);
  const none = Tr.cellFor(NORTH, {}, 'submit', 3, T0);
  assert.deepEqual([none.st, none.txt, none.key], ['none', '○ 없음', 'wait']);
  const got = Tr.cellFor(NORTH, { sign: { st: 'done', sentAt: '2026-09-01', gotAt: '2026-09-03', at: 1 } }, 'sign', 3, T0);
  assert.deepEqual([got.txt, got.key, got.wait], ['● 회신 받음', 'done', null]);
  const advice = TG.items.filter((x) => x.id === 'advice')[0];
  assert.deepEqual(Tr.itemChip(advice, { 'advice:1': { st: 'done', at: 1 }, 'advice:2': { st: 'done', at: 1 } }, 3, T0),
    { txt: '◐ 진행 2/3', key: 'draft' });
});

test('rowTrack · kpiHit · kpiExtra · alertsExtra — 서명은 진행·완료, 제출은 완료 · 회신 7일 «넘게» · 기한 지남', () => {
  const rows = [
    { coName: '가나상사', trk: Tr.rowTrack(TG, {}, 3, '2026-09-30T09:00:00', T0) },
    { coName: '다라정밀', trk: Tr.rowTrack(NORTH, { sign: { st: 'doing', sentAt: '2026-09-20', at: 1 } }, 3, '2026-12-31', T0) },
    { coName: '마바산업', trk: Tr.rowTrack(NORTH, { sign: { st: 'done', sentAt: '2026-05-20', gotAt: '2026-05-25', at: 1 },
      submit: { st: 'done', gotAt: '2026-05-28', at: 1 } }, 3, '2026-06-30', T0) },
    { coName: '사아테크', trk: Tr.rowTrack(NORTH, { sign: { st: 'doing', sentAt: '2026-10-03', at: 1 } }, 3, '', T0) },
    { coName: '없음', trk: null },
  ];
  assert.equal(rows[0].trk.due, '2026-09-30');
  assert.equal(rows[0].trk.sign, null);
  assert.deepEqual([rows[1].trk.waitDays, rows[1].trk.bar3, rows[1].trk.bar4], [20, false, false]);
  assert.deepEqual([rows[2].trk.bar3, rows[2].trk.bar4], [true, true]);
  assert.deepEqual([rows[3].trk.waitDays], [7], '딱 7일은 «넘은» 것이 아니다');
  const tgDone = Tr.rowTrack(TG, { submit: { st: 'done', at: 1 } }, 3, '', T0);
  assert.deepEqual([tgDone.bar3, tgDone.bar4], [true, true], '③ 이 없는 틀은 ⑤ 를 따른다');
  assert.deepEqual(Tr.kpiExtra(rows), { signed: 3, submitted: 1 });
  assert.equal(Tr.kpiHit({ trk: Tr.rowTrack(NORTH, { sign: { st: 'blocked', at: 1 } }, 3, '', T0) }, 'signed'), false, '막힘은 서명에 안 센다');
  assert.equal(Tr.kpiHit(rows[4], 'signed'), false);
  const a = Tr.alertsExtra(rows, T0);
  assert.deepEqual(a.waitSign.map((x) => x.row.coName + ':' + x.days), ['다라정밀:20']);
  assert.deepEqual(a.overdue.map((x) => x.row.coName + ':' + x.due), ['가나상사:2026-09-30']);
  assert.deepEqual(Tr.alertsExtra(null, T0), { waitSign: [], overdue: [] });
});

test('validate — 칸마다 고를 수 있는 상태 · 날짜 꼴 · 회신일 ≥ 발송일 · 방식 · 메모 200자', () => {
  assert.equal(Tr.validate({ st: 'done' }, 'sign'), '');
  assert.equal(Tr.validate({ st: 'na' }, 'sign'), '이 칸에서 고를 수 없는 상태입니다');
  assert.equal(Tr.validate({ st: 'blocked' }, 'attach'), '이 칸에서 고를 수 없는 상태입니다');
  assert.equal(Tr.validate({ st: 'done' }, 'report'), '이 칸에서 고를 수 없는 상태입니다');
  assert.equal(Tr.validate({ st: 'doing', sentAt: '2026/09/01' }, 'sign'), '날짜는 YYYY-MM-DD 꼴로 적어 주세요');
  assert.equal(Tr.validate({ st: 'done', sentAt: '2026-09-10', gotAt: '2026-09-01' }, 'sign'), '회신일이 발송일보다 앞섭니다');
  assert.equal(Tr.validate({ st: 'done', how: 'fax' }, 'submit'), '제출 방식을 다시 골라 주세요');
  assert.equal(Tr.validate({ st: 'done', note: '가'.repeat(201) }, 'attach'), '메모는 200자까지입니다');
  assert.equal(Tr.validate({ st: 'done', note: '가'.repeat(200) }, 'attach'), '');
  assert.equal(Tr.validate(null, 'sign'), '이 칸에서 고를 수 없는 상태입니다');
});

test('patchFor — 빈 값은 빼고 at·by 를 붙인다 · normalize 를 지나도 같다', () => {
  const p = Tr.patchFor({ st: 'done', sentAt: '2026-09-20', gotAt: '2026-09-25', how: '', ack: false, note: '  스캔 메일 받음 ' }, '홍길동', 1760000000000);
  assert.deepEqual(p, { st: 'done', at: 1760000000000, by: '홍길동', sentAt: '2026-09-20', gotAt: '2026-09-25', note: '스캔 메일 받음' });
  assert.deepEqual(Tr.patchFor({ st: 'done', gotAt: '2026-10-01', how: 'platform', ack: true }, '', 7),
    { st: 'done', at: 7, gotAt: '2026-10-01', how: 'platform', ack: true });
  assert.deepEqual(Tr.normalize({ c: { r: { items: { k: p } } } }).c.r.k, p);
});

test('저장 관문(강제 모드) — 줄 하나 .set 은 통과, 부분 update 는 막힌다(그래서 화면은 .set 을 쓴다)', () => {
  const p = Tr.patchFor({ st: 'doing', sentAt: '2026-09-20' }, '홍길동', 1);
  assert.equal(W.inspectWrite({ kind: 'set', path: 'scal_docs/c2/t3_2026/items/sign', value: p, mode: 'enforce' }).ok, true);
  assert.equal(W.inspectWrite({ kind: 'update', path: 'scal_docs/c2/t3_2026', value: { 'items/sign': p }, mode: 'enforce' }).ok, false);
});
```

- [ ] **Step 3: 실패 확인**

Run: `node --test tests/gov-report-track.test.js`
Expected: FAIL — `Cannot find module '../js/pu-gov-report-track.js'`

- [ ] **Step 4: 구현** — `js/pu-gov-report-track.js` (새)

```js
'use strict';
/* 컨설팅보고서 앱(gov-report.html) — 서류 진행 기록(③서명본·④별첨·⑤제출)의 순수 함수 (브라우저 window.PuGovReportTrack / Node 겸용)
   (대표 지시 2026-10-10 「순서대로 모두」 · 설계 docs/superpowers/specs/2026-10-10-gov-report-track-design.md
    · 계획 docs/superpowers/plans/2026-10-10-gov-report-track.md)
   무엇을 지키나
     · «기록»이다 — 메일·플랫폼을 대신하지 않는다. 사람이 한 일(발송·회신·제출)을 줄 하나씩 남긴다.
     · 자리: scal_docs/{업체}/{rid}/items/{줄 키} — 줄 키 = 서류 틀 줄 id(회차마다면 id:회차). 한 번에 «줄 하나»만 쓴다.
     · 읽을 때 모양 틀린 줄·모르는 상태·나쁜 키는 버린다(normalize). 서류 틀에 없는 키는 칸 계산에서 안 본다.
     · 칸 상태는 «막힘 > 완료 > 진행 > 없음» — 해당없음은 빼고 센다(전부 해당없음이면 해당없음).
     · 저장 꼴(patchFor)은 레코드 모양(id·entityType)이 아니다 — 저장 관문(pu-ontology-write.js, 이 앱은 강제)이
       줄 하나 .set 을 통과시킨다. update 는 관문이 «부분 update» 로 막는다(그래서 쓰지 않는다).
   ⚠ 규칙(scripts/make-firebase-rules.js scal_docs)과 같은 값을 쓴다 — 상태 다섯 · 방식 넷 · 메모 200자 · 이름 40자 · 키 꼴.
     한쪽만 바꾸면 화면이 «된다»고 보인 것을 서버가 거절한다(tests/gov-report-rules.test.js 가 맞춰 본다).
   ⚠ 저장소는 공개다 — 검사는 합성 자료만 쓴다. */
(function (root) {
  var STATES = ['none', 'doing', 'done', 'blocked', 'na'];
  var ST_KO = { none: '없음', doing: '진행', done: '완료', blocked: '막힘', na: '해당없음' };
  var MARK = { none: '○', doing: '◐', done: '●', blocked: '✕', na: '—' };
  var STEP_KO = { sign: { doing: '발송함', done: '회신 받음' }, attach: {}, submit: { doing: '제출 준비', done: '제출함' } };
  var ALLOWED = { sign: ['none', 'doing', 'done', 'blocked'], attach: ['none', 'doing', 'done', 'na'], submit: ['none', 'doing', 'done', 'blocked'] };
  var COL_KO = { sign: '③ 업체 서명본', attach: '④ 산출물 별첨', submit: '⑤ 기관 제출' };
  var STEPS = ['sign', 'attach', 'submit'];
  var HOW = { mail: '메일', platform: '플랫폼', post: '우편', other: '기타' };
  /* 화면 딱지 이름(.st-*) — 완료 초록 · 진행 노랑 · 막힘 빨강 · 없음 회색 · 해당없음 딱지 없음 */
  var CHIP = { done: 'done', doing: 'draft', blocked: 'todo', none: 'wait', na: '' };
  var NOTE_MAX = 200, BY_MAX = 40, KEY_MAX = 20, MAX_ROUNDS = 60;
  var WAIT_SIGN_DAYS = 7;   // 발송하고 이만큼 «넘게» 회신이 없으면 ⏰
  var KEY_RE = /^[a-z]+(:[0-9]+)?$/;
  var SAVE_FAIL = '저장하지 못했습니다 — 규칙 게시 또는 권한 확인';
  var LOAD_FAIL = '기록을 못 불러왔습니다 — 규칙 게시 또는 권한 확인';

  function str(v) { return v == null ? '' : String(v).trim(); }
  function obj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function isDay(d) { return typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d); }
  function dayNum(d) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str(d)); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) / 864e5 : NaN; }
  function daysBetween(a, b) { var n = dayNum(b) - dayNum(a); return isFinite(n) ? n : null; }
  function okKey(k) { return typeof k === 'string' && k.length <= KEY_MAX && KEY_RE.test(k); }

  function keyOf(item, round) { var id = str(item && item.id); return round ? id + ':' + round : id; }
  function keysFor(plan, step, n) {
    var out = [], m = Math.min(Math.max(+n || 0, 0), MAX_ROUNDS);
    ((plan && plan.items) || []).forEach(function (x) {
      if (!x || x.step !== step) return;
      if (x.per === 'round') { for (var i = 1; i <= m; i++) out.push({ key: keyOf(x, i), id: x.id, name: x.name + ' ' + i + '회차', round: i }); }
      else if (x.per === 'once') out.push({ key: keyOf(x, 0), id: x.id, name: x.name, round: 0 });
    });
    return out;
  }

  function normRec(r) {
    if (!obj(r) || STATES.indexOf(r.st) < 0) return null;
    var o = { st: r.st, at: Number(r.at) || 0 };
    if (isDay(r.sentAt)) o.sentAt = r.sentAt;
    if (isDay(r.gotAt)) o.gotAt = r.gotAt;
    if (str(r.by)) o.by = str(r.by).slice(0, BY_MAX);
    if (str(r.note)) o.note = str(r.note).slice(0, NOTE_MAX);
    if (typeof r.how === 'string' && has(HOW, r.how)) o.how = r.how;
    if (r.ack === true) o.ack = true;
    return o;
  }
  /* DB 의 scal_docs 통째 → { 업체: { rid: { 키: 줄 } } } (items 한 층을 걷는다) */
  function normalize(raw) {
    var out = {};
    if (!obj(raw)) return out;
    Object.keys(raw).forEach(function (co) {
      if (!obj(raw[co])) return;
      Object.keys(raw[co]).forEach(function (rid) {
        var items = obj(raw[co][rid]) ? raw[co][rid].items : null;
        if (!obj(items)) return;
        Object.keys(items).forEach(function (k) {
          if (!okKey(k)) return;
          var r = normRec(items[k]);
          if (!r) return;
          out[co] = out[co] || {};
          out[co][rid] = out[co][rid] || {};
          out[co][rid][k] = r;
        });
      });
    });
    return out;
  }
  function recOf(track, coId, rid) {
    return (obj(track) && obj(track[coId]) && obj(track[coId][rid])) ? track[coId][rid] : {};
  }
  /* 저장이 된 뒤 로컬 값 갱신 — 다시 읽지 않는다. 원본은 그대로 */
  function put(track, coId, rid, key, rec) {
    var out = JSON.parse(JSON.stringify(obj(track) ? track : {}));
    var r = normRec(rec);
    if (!r || !okKey(key) || !str(coId) || !str(rid)) return out;
    out[coId] = out[coId] || {};
    out[coId][rid] = out[coId][rid] || {};
    out[coId][rid][key] = r;
    return out;
  }

  function stateOf(sts) {
    var all = (sts || []).filter(function (s) { return STATES.indexOf(s) >= 0; });
    if (!all.length) return 'none';
    var live = all.filter(function (s) { return s !== 'na'; });
    if (!live.length) return 'na';
    if (live.indexOf('blocked') >= 0) return 'blocked';
    if (live.every(function (s) { return s === 'done'; })) return 'done';
    if (live.some(function (s) { return s === 'doing' || s === 'done'; })) return 'doing';
    return 'none';
  }
  function label(step, st) { var s = STEP_KO[step] || {}; return MARK[st] + ' ' + (s[st] || ST_KO[st]); }
  /* 발송했는데 회신이 없는 줄 가운데 가장 이른 발송일부터 오늘까지 */
  function waitOf(keys, rec, today) {
    var first = '';
    keys.forEach(function (k) {
      var r = rec[k.key];
      if (!r || !r.sentAt || r.gotAt || r.st === 'done' || r.st === 'na') return;
      if (!first || r.sentAt < first) first = r.sentAt;
    });
    return first ? daysBetween(first, today) : null;
  }
  function chipOf(step, keys, rec, today) {
    rec = obj(rec) ? rec : {};
    keys = keys || [];
    var sts = keys.map(function (k) { return rec[k.key] ? rec[k.key].st : 'none'; });
    var st = stateOf(sts);
    var live = sts.filter(function (s) { return s !== 'na'; });
    var done = live.filter(function (s) { return s === 'done'; }).length;
    var wait = step === 'sign' ? waitOf(keys, rec, today) : null;
    var txt = label(step, st) + (live.length > 1 ? ' ' + done + '/' + live.length : '')
      + (wait != null && st === 'doing' ? ' · 회신 ' + wait + '일째' : '');
    return { step: step, st: st, txt: txt, key: CHIP[st], done: done, total: live.length, wait: wait,
      keys: keys.map(function (k) { return k.key; }) };
  }
  function cellFor(plan, rec, step, n, today) {
    var keys = keysFor(plan, step, n);
    return keys.length ? chipOf(step, keys, rec, today) : null;
  }
  /* 목차 줄 하나(회차마다면 그 회차들)의 딱지 */
  function itemChip(item, rec, n, today) {
    if (!item) return null;
    var keys = keysFor({ items: [item] }, item.step, n);
    if (!keys.length) return null;
    var c = chipOf(item.step, keys, rec, today);
    return { txt: c.txt, key: c.key };
  }
  /* 현황판 줄 하나의 기록 — 막대 ③ = 서명본 완료(틀에 ③ 이 없으면 ⑤ 를 따른다), ④ = 기관 제출 완료 */
  function rowTrack(plan, rec, n, due, today) {
    var t = { due: str(due).slice(0, 10) };
    STEPS.forEach(function (s) { t[s] = cellFor(plan, rec, s, n, today); });
    t.waitDays = t.sign ? t.sign.wait : null;
    t.bar4 = !!t.submit && t.submit.st === 'done';
    t.bar3 = t.sign ? t.sign.st === 'done' : t.bar4;
    return t;
  }
  function kpiHit(r, k) {
    var t = r && r.trk;
    if (!t) return false;
    if (k === 'signed') return !!t.sign && (t.sign.st === 'doing' || t.sign.st === 'done');
    if (k === 'submitted') return !!t.submit && t.submit.st === 'done';
    return false;
  }
  function kpiExtra(rows) {
    var k = { signed: 0, submitted: 0 };
    (rows || []).forEach(function (r) {
      if (kpiHit(r, 'signed')) k.signed++;
      if (kpiHit(r, 'submitted')) k.submitted++;
    });
    return k;
  }
  function alertsExtra(rows, today) {
    var waitSign = [], overdue = [];
    (rows || []).forEach(function (r) {
      var t = r && r.trk;
      if (!t) return;
      if (t.waitDays != null && t.waitDays > WAIT_SIGN_DAYS) waitSign.push({ row: r, days: t.waitDays });
      if (t.submit && t.submit.st !== 'done' && isDay(t.due) && isDay(today) && t.due < today) overdue.push({ row: r, due: t.due });
    });
    waitSign.sort(function (a, b) { return b.days - a.days; });
    overdue.sort(function (a, b) { return a.due < b.due ? -1 : (a.due > b.due ? 1 : 0); });
    return { waitSign: waitSign, overdue: overdue };
  }

  /* 칸 창에서 받은 값 검사 — 틀리면 문구, 맞으면 '' */
  function validate(entry, step) {
    var e = entry || {}, sent = str(e.sentAt), got = str(e.gotAt);
    if (!has(ALLOWED, String(step)) || ALLOWED[step].indexOf(e.st) < 0) return '이 칸에서 고를 수 없는 상태입니다';
    if ((sent && !isDay(sent)) || (got && !isDay(got))) return '날짜는 YYYY-MM-DD 꼴로 적어 주세요';
    if (sent && got && got < sent) return '회신일이 발송일보다 앞섭니다';
    if (str(e.how) && !has(HOW, str(e.how))) return '제출 방식을 다시 골라 주세요';
    if (str(e.note).length > NOTE_MAX) return '메모는 ' + NOTE_MAX + '자까지입니다';
    return '';
  }
  /* 저장할 줄 하나 — 빈 값은 뺀다(DB 도 빈 값을 저장하지 않는다) */
  function patchFor(entry, who, now) {
    var e = entry || {}, o = { st: e.st, at: Number(now) || 0 };
    if (str(who)) o.by = str(who).slice(0, BY_MAX);
    if (isDay(str(e.sentAt))) o.sentAt = str(e.sentAt);
    if (isDay(str(e.gotAt))) o.gotAt = str(e.gotAt);
    if (has(HOW, str(e.how))) o.how = str(e.how);
    if (e.ack === true) o.ack = true;
    if (str(e.note)) o.note = str(e.note);
    return o;
  }

  var api = { keyOf: keyOf, keysFor: keysFor, normalize: normalize, recOf: recOf, put: put, stateOf: stateOf, label: label,
    chipOf: chipOf, cellFor: cellFor, itemChip: itemChip, rowTrack: rowTrack, kpiHit: kpiHit, kpiExtra: kpiExtra,
    alertsExtra: alertsExtra, validate: validate, patchFor: patchFor,
    STATES: STATES, ST_KO: ST_KO, MARK: MARK, ALLOWED: ALLOWED, COL_KO: COL_KO, STEPS: STEPS, HOW: HOW, CHIP: CHIP,
    NOTE_MAX: NOTE_MAX, BY_MAX: BY_MAX, WAIT_SIGN_DAYS: WAIT_SIGN_DAYS, KEY_RE: KEY_RE, SAVE_FAIL: SAVE_FAIL, LOAD_FAIL: LOAD_FAIL };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PuGovReportTrack = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
```

- [ ] **Step 5: 모듈 검사 통과 확인**

Run: `node --test tests/gov-report-track.test.js`
Expected: PASS (11 tests)

- [ ] **Step 6: 서류 모듈 검사(실패) 더하기** — `tests/gov-report-docs.test.js`

`const F = require('./helpers/gov-report-fixture.js');` 줄 다음에 한 줄 더한다.

```js
const Tr = require('../js/pu-gov-report-track.js');
```

파일 끝에 더한다.

```js
/* ═══ 서류 진행 기록(③④⑤) — 설계 2026-10-10-gov-report-track-design.md ═══ */

test('docsTable — 기록(track)을 주면 ③④⑤ 를 칸으로 · 안 주면 「—」 그대로 · 줄에 rid·planned', () => {
  const track = Tr.normalize(F.track());
  const o = (c, ty, tr) => ({ erp: code(c), typeId: ty, input: F.input(T), rows: rows(), year: '2026',
    consultings: X.cons, tmap: X.tmap, biz: X.biz, track: tr, today: T });
  const n = D.docsTable(o('consulting-04', 't3', track));
  assert.deepEqual(n.lines[0].cells.slice(2).map((c) => c.txt + '/' + c.key + '/' + c.step),
    ['◐ 발송함 · 회신 20일째/draft/sign', '○ 없음/wait/attach', '○ 없음/wait/submit']);
  assert.deepEqual([n.lines[0].rid, n.lines[0].planned], ['t3_2026', 3]);
  const s = D.docsTable(o('consulting-05', 't4', track));
  assert.deepEqual(s.lines[0].cells.slice(2).map((c) => c.txt + '/' + c.key), ['● 회신 받음/done', '— 해당없음/', '● 제출함/done']);
  const g = D.docsTable(o('consulting-03', 't1', track));
  assert.deepEqual(g.lines[0].cells.slice(1).map((c) => c.txt + '/' + c.key), ['—/', '—/', '○ 없음 0/6/wait', '○ 없음/wait'],
    '기술보호는 ③ 이 없고 ④ 는 여섯 줄(자문 일지 3회차 + 셋)');
  const none = D.docsTable(o('consulting-04', 't3', undefined));
  assert.deepEqual(none.lines[0].cells.slice(2).map((c) => c.txt + '/' + c.key), ['—/', '—/', '—/'], '못 읽었으면 지금처럼');
  const big = D.docsTable(o('consulting-02', 't2', track));
  assert.equal(big.lines[0].cells, null, '대형은 칸이 없다');
});

test('tocFor — rec(그 업체·rid 기록)를 주면 ③④⑤ 줄 딱지 · ①② 는 그대로 · 안 주면 「—」', () => {
  const track = Tr.normalize(F.track());
  const r3 = rows().filter((x) => x.coId === 'c3')[0];
  const t = D.tocFor({ pair: pairOf('t4', 'c3'), row: r3, erp: code('consulting-05'), cons: null, dir: X.dir,
    rec: Tr.recOf(track, 'c3', 't4_2026'), today: T });
  assert.deepEqual(t.items.map((x) => x.name + ':' + x.chip.txt), ['방문확인서:미작성', '상담·자문 결과보고서:미작성',
    '업체 서명본:● 회신 받음', '산출물 별첨:— 해당없음', '기관 제출:● 제출함']);
  assert.ok(D.tocText(t).includes('5. 기관 제출 (● 제출함)'));
  const r1 = rows().filter((x) => x.coId === 'c1' && x.typeId === 't1')[0];
  const g = D.tocFor({ pair: pairOf('t1', 'c1'), row: r1, erp: code('consulting-03'), cons: X.cons.v.k1, dir: X.dir, rec: {}, today: T });
  assert.deepEqual(g.items.map((x) => x.chip.txt), ['초안', '○ 없음 0/3', '○ 없음', '○ 없음', '○ 없음', '○ 없음']);
  const plain = D.tocFor({ pair: pairOf('t1', 'c1'), row: r1, erp: code('consulting-03'), cons: X.cons.v.k1, dir: X.dir });
  assert.deepEqual(plain.items[1].chip, { txt: '—', key: '' });
});

test('trackRows — 현황판 줄에 r.trk(③④⑤·기한·회신 날수)와 ③④ 막대 · 기록이 없으면 null', () => {
  const rs = rows();
  D.trackRows(rs, { track: Tr.normalize(F.track()), input: F.input(T), biz: X.biz, tmap: X.tmap, consultings: X.cons, today: T });
  const by = (id) => rs.filter((x) => x.coId === id && x.year === '2026')[0];
  assert.equal(by('c1').trk.sign, null, '기술보호는 서명본 줄이 없다');
  assert.equal(by('c1').trk.submit.st, 'none');
  assert.equal(by('c1').trk.due, '2026-09-30');
  assert.deepEqual(by('c1').st.steps, [true, false, false, false]);
  assert.deepEqual([by('c2').trk.sign.st, by('c2').trk.waitDays, by('c2').trk.due], ['doing', 20, '2026-12-31']);
  assert.deepEqual(by('c3').st.steps, [false, false, true, true]);
  assert.equal(by('c3').trk.due, '', '계약을 못 찾으면 기한 없음');
  D.trackRows(rs, { track: null });
  assert.equal(by('c3').trk, null);
  assert.deepEqual(by('c3').st.steps, [false, false, false, false], '기록을 못 읽으면 막대는 ①② 만');
  assert.deepEqual(D.TRACK_COLS, ['sign', 'attach', 'submit']);
});
```

- [ ] **Step 7: 실패 확인**

Run: `node --test tests/gov-report-docs.test.js`
Expected: FAIL — 새 셋이 실패(`D.trackRows is not a function` 등). 앞 검사는 PASS.

- [ ] **Step 8: 서류 모듈 고치기** — `js/pu-gov-report-docs.js`

(a) 머리 주석의 `     · 목차에는 업체 이름·담당 이름·날짜·서류 이름·상태만 — 연락처·금액·보고서 본문은 담지 않는다.` 줄 다음에 더한다.

```js
     · ③④⑤ 칸·목차 딱지·현황판 줄 기록(trackRows)은 서류 진행 기록(scal_docs, pu-gov-report-track.js)을
       «받았을 때만» 계산한다 — 못 읽었으면(규칙 게시 전·권한 없음) 지금처럼 「—」. 이 모듈은 여전히 쓰지 않는다.
       (설계 docs/superpowers/specs/2026-10-10-gov-report-track-design.md)
```

(b) `(function (root) {` 바로 다음 줄에 더한다(`pu-gov-report-list.js` 가 build 를 부르는 꼴).

```js
  var Track = (typeof module !== 'undefined' && module.exports) ? require('./pu-gov-report-track.js') : root.PuGovReportTrack;
```

(c) `var COLS = ['①초안', '②확정', '③서명본', '④별첨', '⑤제출'];` 줄 다음에 더한다.

```js
  var TRACK_COLS = ['sign', 'attach', 'submit'];   // 체크표 ③④⑤ 칸 = 서류 틀 줄의 step
```

(d) `function docsTable(o) { … }` 전체를 다음으로 바꾼다.

```js
  function docsTable(o) {
    o = o || {};
    var erp = o.erp || null, plan = planFor(erp ? erp.name : ''), auto = !!AUTO[plan.key];
    var byCo = {};
    (o.rows || []).forEach(function (r) { if (r && r.typeId === o.typeId) byCo[r.coId + '|' + r.year] = r; });
    var lines = o.typeId ? pairs(o.input, o.typeId, o.year).map(function (p) {
      var r = byCo[p.coId + '|' + p.year] || null;
      var cons = consFor({ consultings: o.consultings, co: p.co, code: erp ? erp.code : '', typeId: o.typeId, tmap: o.tmap, biz: o.biz });
      var cells = auto ? chips(r) : null;
      /* 기록을 받았을 때만 ③④⑤ — 틀에 그 step 이 없으면 「—」(기술보호의 ③) */
      if (cells && o.track) {
        var rec = Track.recOf(o.track, p.coId, p.rid), n = Math.max(+p.rounds || 0, +p.planned || 0);
        TRACK_COLS.forEach(function (s, i) { cells[2 + i] = Track.cellFor(plan, rec, s, n, o.today) || DASH; });
      }
      return { coId: p.coId, coName: p.coName, typeId: p.typeId, year: p.year, rid: p.rid, rounds: p.rounds, planned: p.planned,
        cells: cells, due: cons ? str(cons.endDate).slice(0, 10) : '' };
    }) : [];
    return { plan: plan, auto: auto, cols: COLS.slice(), lines: lines };
  }
```

(e) `tocFor` 안의 `var chip = (auto && x.step === 'report' && r && r.st) ? { txt: r.st.label, key: r.st.key } : { txt: '—', key: '' };` 줄 다음에 더한다.

```js
      if (auto && o.rec && x.step !== 'report' && x.step !== 'plat') chip = Track.itemChip(x, o.rec, n, o.today) || chip;
```

(f) `function tocText(toc) {` 바로 «앞»에 더한다.

```js
  /* 현황판 줄(buildRows)에 서류 진행 기록을 붙인다 — r.trk(③④⑤ 칸·기한·회신 날수)와 r.st.steps 의 ③④ 막대.
     간단형 셋(AUTO)만. 기록이 없으면(못 읽음) r.trk = null, 막대 ③④ 는 끈다. 여러 번 불러도 같다 */
  function trackRows(rows, o) {
    o = o || {};
    var cos = {};
    list((o.input || {}).cos).forEach(function (c) { cos[c.id] = c; });
    (rows || []).forEach(function (r) {
      if (!r) return;
      var s = (r.st && r.st.steps) || [false, false, false, false];
      r.trk = null;
      if (r.st) r.st.steps = [!!s[0], !!s[1], false, false];
      if (!o.track || !r.st) return;
      var erp = erpTypeFor(r.typeId, o.biz, o.tmap), plan = planFor(erp ? erp.name : r.typeName);
      if (!AUTO[plan.key]) return;
      var cons = consFor({ consultings: o.consultings, co: cos[r.coId] || { id: r.coId, name: r.coName }, code: erp ? erp.code : '',
        typeId: r.typeId, tmap: o.tmap, biz: o.biz });
      r.trk = Track.rowTrack(plan, Track.recOf(o.track, r.coId, r.rid), Math.max(+r.rounds || 0, +r.maxRounds || 0),
        cons ? str(cons.endDate).slice(0, 10) : '', o.today);
      r.st.steps = [!!s[0], !!s[1], r.trk.bar3, r.trk.bar4];
    });
    return rows;
  }
```

(g) `var api = { … }` 의 `sidName: sidName, months: months, docsTable: docsTable, tocFor: tocFor, tocText: tocText,` 줄을 다음으로 바꾸고, `NO_AGENCY: NO_AGENCY, UNLINKED: UNLINKED, NO_PLAN: NO_PLAN };` 줄을 그 다음 것으로 바꾼다.

```js
    sidName: sidName, months: months, docsTable: docsTable, tocFor: tocFor, tocText: tocText, trackRows: trackRows,
```

```js
    NO_AGENCY: NO_AGENCY, UNLINKED: UNLINKED, NO_PLAN: NO_PLAN, TRACK_COLS: TRACK_COLS };
```

- [ ] **Step 9: 화면에 싣기** — `gov-report.html` 의 `<script src="js/pu-gov-report-docs.js?v=2"></script>` 한 줄을 다음 둘로 바꾼다(docs 가 track 을 쓰므로 먼저 싣는다 · docs 를 고쳤으니 `?v=3`).

```html
<script src="js/pu-gov-report-track.js?v=1"></script>
<script src="js/pu-gov-report-docs.js?v=3"></script>
```

그리고 그 위 주석 `<!-- 서류 관리(왼쪽 패널)·목차 — … -->` 를 다음으로 바꾼다.

```html
<!-- 서류 관리(왼쪽 패널)·목차 — 이알피 컨설팅 사업 · 서류 틀 · 체크표 · 목차(순수 함수)
     서류 진행 기록(③서명본·④별첨·⑤제출) — 칸 상태·저장 꼴(순수 함수). docs 가 불러 쓰므로 먼저 싣는다 -->
```

`tests/gov-report-app.test.js` 의 첫 정적 검사(`'정적 — 공통 머리와 새 모듈을 차례대로 싣는다'`)에서 파일 목록 첫 줄을 바꾸고 차례 단언을 하나 더한다.

```js
  ['js/pu-gov-report.js', 'js/pu-gov-report-build.js', 'js/pu-gov-report-list.js', 'js/pu-gov-report-track.js', 'js/pu-gov-report-docs.js', 'js/pu-appbar.js', 'js/pu-back.js',
```

```js
  assert.ok(SRC.indexOf('pu-gov-report-track.js') < SRC.indexOf('pu-gov-report-docs.js'), '기록 모듈을 서류 모듈보다 먼저 싣는다');
```
(두 번째 줄은 `assert.ok(SRC.indexOf('pu-gov-report-list.js') < SRC.indexOf('pu-gov-report-docs.js'), …);` 다음에 둔다.)

- [ ] **Step 10: 통과 확인**

Run: `node --test tests/gov-report-track.test.js tests/gov-report-docs.test.js tests/gov-report-list.test.js tests/gov-report-app.test.js tests/html-inline-script-syntax.test.js`
그리고: `node tests/shared-js-cache-version.test.js` · `node scripts/check-cache-version.js --all`
Expected: 모두 PASS. `gov-report-app` 은 아직 `scal_docs` 를 읽지 않으므로 앞 검사가 그대로 통과한다. `check-cache-version --all` 은 아무것도 안 찍고 끝난다.

- [ ] **Step 11: 커밋** (PowerShell)

```powershell
git add js/pu-gov-report-track.js tests/gov-report-track.test.js js/pu-gov-report-docs.js tests/gov-report-docs.test.js tests/helpers/gov-report-fixture.js gov-report.html tests/gov-report-app.test.js
git commit -m @'
feat(gov-report): 서류 진행 기록 순수 모듈 — ③서명본·④별첨·⑤제출 칸 상태·저장 꼴

- js/pu-gov-report-track.js(새): 줄 키(id·id:회차) · 읽기 다듬기(모양 틀린 줄 버림) · «막힘 > 완료 > 진행 > 없음» ·
  칸 말(발송함·회신 받음·제출 준비·제출함) · 회신 N일째 · 숫자 칸(서명·제출) · ⏰(회신 7일 넘음·제출 기한 지남) · 검사 · 저장 꼴
- pu-gov-report-docs: 기록을 받으면 체크표 ③④⑤·목차 딱지·현황판 줄 기록(trackRows, ③④ 막대). 안 받으면 「—」 그대로
- gov-report.html 싣기(track ?v=1 · docs ?v=3). 아직 읽고 쓰지 않는다

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
'@
```

---

### Task 2: 규칙 `scal_docs`(생성만 — 게시하지 않는다) · 등록부 소유·쓰기 계약 · 검사 목록

**Files:**
- Modify: `scripts/make-firebase-rules.js` (`rules.scal_rptFormsIndex = …;` 줄 다음)
- Regenerate: `docs/firebase-rules-전체-적용본.json` · `docs/rules-paste.json`
- Modify: `tests/gov-report-rules.test.js` (새 검사 셋)
- Modify: `tests/perf-rules.test.js` (`allowTop` 에 `scal_docs`)
- Modify: `tests/photos-staff-share.test.js` (`PENDING = ['/scal_docs']`)
- Modify: `js/pu-ontology.js` (`govreport` 주석·`primaryRoots`·`writeContracts`, `govreport_view.gives`)
- Modify: html 24개 (`js/pu-ontology.js?v=61 → 62`, 바이트 보존)
- Modify: `tests/gov-report-app.test.js` (등록부 단언 한 줄)

**Interfaces:**
- Consumes (T1): `PuGovReportTrack.STATES` · `HOW` · `NOTE_MAX` · `BY_MAX` · `KEY_RE`(규칙과 같은 값인지 맞춰 본다)
- Produces: 규칙 `rules.scal_docs`(생성기 출력·JSON 두 개) · 등록부 `PROGRAMS.govreport.primaryRoots` 에 `'scal_docs'` · `writeContracts` 에 `{path:'scal_docs/{co}/{rid}/items/{key}',entityType:'Document'}` · `pu-ontology.js?v=62`
- ⚠ **게시 금지**: `scripts/rules-deploy.js` 를 어떤 인자로도 돌리지 않는다(인자 없이 돌려도 콘솔을 읽고 JSON 을 다시 쓴다). JSON 은 아래 Step 4 의 스크립트로만 만든다.

- [ ] **Step 1: 실패하는 규칙 검사** — `tests/gov-report-rules.test.js`

`const rules = JSON.parse(out).rules;` 줄 다음에 더한다.

```js
const Tr = require('../js/pu-gov-report-track.js');
```

파일 끝에 더한다.

```js
/* ═══ 서류 진행 기록 (2026-10-10, 설계 2026-10-10-gov-report-track-design.md §2-1) ═══ */

test('scal_docs — 위쪽 칸(루트·$co·$rid·items)은 관리자 전용 · 줄($key)만 직원 쓰기, 지우기는 관리자', () => {
  const r = rules.scal_docs;
  const login = rules.scal_scheds['.read'];            /* LOGIN 식 그대로 */
  const admin = rules.serverBackups['.read'];          /* ADMIN 식 그대로 */
  assert.ok(r, 'scal_docs 자리가 없습니다');
  assert.equal(r['.read'], login, '읽기는 로그인(재직 직원)');
  /* 위쪽 칸이 열려 있으면 아래 줄 단위 잠금·모양 검사를 «위에서 뚫는다» */
  assert.equal(r['.write'], admin, '루트 쓰기는 관리자 전용');
  assert.equal(r.$co['.write'], admin, '$co 쓰기는 관리자 전용');
  assert.equal(r.$co.$rid['.write'], admin, '$rid 쓰기는 관리자 전용');
  assert.equal(r.$co.$rid.items['.write'], admin, 'items 쓰기는 관리자 전용');
  assert.equal(r.$co.$rid.items.$key['.write'], '(' + login + ') && (newData.exists() || ' + admin + ')',
    '줄 하나는 직원이 만들고 고치고, 지우기는 관리자');
  assert.deepEqual(Object.keys(r).sort(), ['$co', '.read', '.write']);
  assert.deepEqual(Object.keys(r.$co).sort(), ['$rid', '.write']);
  assert.deepEqual(Object.keys(r.$co.$rid).sort(), ['$other', '.write', 'items']);
  assert.equal(r.$co.$rid.$other['.validate'], false, 'rid 아래에는 items 말고 아무것도 못 쓴다');
});

test('scal_docs 줄 모양 — 키 꼴 · 상태 다섯 · 시각 숫자 · 날짜 꼴 · 이름 40자 · 메모 200자 · 방식 넷 · 접수 참거짓 · 다른 칸 거절', () => {
  const k = rules.scal_docs.$co.$rid.items.$key;
  assert.ok(k['.validate'].includes('$key.matches(/^[a-z]+(:[0-9]+)?$/)'));
  assert.ok(k['.validate'].includes('$key.length <= 20'));
  assert.ok(k['.validate'].includes("newData.hasChildren(['st','at'])"));
  assert.ok(k.st['.validate'].includes('(none|doing|done|blocked|na)'));
  assert.equal(k.at['.validate'], 'newData.isNumber()');
  ['sentAt', 'gotAt'].forEach((f) => assert.ok(k[f]['.validate'].includes('/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/'), f));
  assert.equal(k.by['.validate'], 'newData.isString() && newData.val().length <= 40');
  assert.equal(k.note['.validate'], 'newData.isString() && newData.val().length <= 200');
  assert.ok(k.how['.validate'].includes('(mail|platform|post|other)'));
  assert.equal(k.ack['.validate'], 'newData.isBoolean()');
  assert.equal(k.$other['.validate'], false);
  assert.deepEqual(Object.keys(k).sort(), ['$other', '.validate', '.write', 'ack', 'at', 'by', 'gotAt', 'how', 'note', 'sentAt', 'st']);
});

test('규칙과 화면 모듈(js/pu-gov-report-track.js)이 같은 값을 쓴다', () => {
  const k = rules.scal_docs.$co.$rid.items.$key;
  assert.ok(k.st['.validate'].includes('(' + Tr.STATES.join('|') + ')'), '상태');
  assert.ok(k.how['.validate'].includes('(' + Object.keys(Tr.HOW).join('|') + ')'), '제출 방식');
  assert.ok(k.note['.validate'].endsWith('<= ' + Tr.NOTE_MAX), '메모 길이');
  assert.ok(k.by['.validate'].endsWith('<= ' + Tr.BY_MAX), '이름 길이');
  assert.ok(k['.validate'].includes(Tr.KEY_RE.source), '줄 키 꼴');
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test tests/gov-report-rules.test.js`
Expected: FAIL — `scal_docs 자리가 없습니다` (앞 세 검사는 PASS)

- [ ] **Step 3: 생성기에 규칙** — `scripts/make-firebase-rules.js` 의 `rules.scal_rptFormsIndex = { '.read': LOGIN, '.write': ADMIN };` 줄 바로 다음에 더한다.

```js
/* 서류 진행 기록 (2026-10-10, 설계 docs/superpowers/specs/2026-10-10-gov-report-track-design.md §2-1)
   scal_docs/{업체}/{rid}/items/{줄 키} — 컨설팅보고서 앱(gov-report.html)이 ③서명본·④별첨·⑤제출을 «줄 하나씩» 남긴다.
   ★ 직원은 줄 하나를 만들고 고친다(상태를 「없음」으로 되돌리는 것도 «고침»이다). 진짜 지우기는 관리자만.
   ★ 위쪽 칸(루트·$co·$rid·items)은 관리자 전용 — 위에서 열면 아래 «줄 단위» 잠금과 모양 검사를 위에서 뚫는다
     (scal_reports 와 같은 까닭: 규칙은 위에서 아래로 내려가며 한 군데라도 허락하면 통과한다).
   ★ 줄 모양은 화면 모듈(js/pu-gov-report-track.js)과 같은 값 — 상태 다섯 · 방식 넷 · 메모 200자 · 이름 40자 · 키 꼴
     (tests/gov-report-rules.test.js 가 둘을 맞춰 본다). rid 아래에는 items 말고 아무것도 못 쓴다.
   ⚠ 게시는 대표 승인 뒤에만(scripts/rules-deploy.js). 게시 전에는 읽기·쓰기가 거절되고 화면은 읽기 전용으로 돈다. */
const SCAL_DOCS_DAY = "newData.isString() && newData.val().matches(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/)";
rules.scal_docs = {
  '.read': LOGIN,
  '.write': ADMIN,
  $co: {
    '.write': ADMIN,
    $rid: {
      '.write': ADMIN,
      items: {
        '.write': ADMIN,
        $key: {
          '.write': `(${LOGIN}) && (newData.exists() || ${ADMIN})`,
          '.validate': "$key.matches(/^[a-z]+(:[0-9]+)?$/) && $key.length <= 20 && newData.hasChildren(['st','at'])",
          st:     { '.validate': "newData.isString() && newData.val().matches(/^(none|doing|done|blocked|na)$/)" },
          at:     { '.validate': 'newData.isNumber()' },
          sentAt: { '.validate': SCAL_DOCS_DAY },
          gotAt:  { '.validate': SCAL_DOCS_DAY },
          by:     { '.validate': 'newData.isString() && newData.val().length <= 40' },
          note:   { '.validate': 'newData.isString() && newData.val().length <= 200' },
          how:    { '.validate': "newData.isString() && newData.val().matches(/^(mail|platform|post|other)$/)" },
          ack:    { '.validate': 'newData.isBoolean()' },
          $other: { '.validate': false }
        }
      },
      $other: { '.validate': false }
    }
  }
};
```

- [ ] **Step 4: JSON 두 개 다시 만들기(게시 아님)** — 생성기 출력을 CRLF 로 두 파일에 똑같이 쓴다(작업트리가 CRLF 라 줄 끝 차이 없이 새 줄만 늘어난다). 스크립트는 저장소 «밖»에, 글자는 ASCII 만(파일 이름의 한글은 `\u` 로).

```powershell
@'
const fs = require('fs'), path = require('path'), cp = require('child_process');
const root = process.argv[2];
const out = cp.execFileSync('node', [path.join(root, 'scripts', 'make-firebase-rules.js')], { encoding: 'utf8' }).replace(/\r?\n/g, '\r\n');
const alt = 'firebase-rules-전체-적용본.json';
for (const f of [alt, 'rules-paste.json']) { fs.writeFileSync(path.join(root, 'docs', f), out); console.log('wrote', f); }
'@ | Out-File -Encoding ascii "$env:TEMP\gr-track-rules.js"
node "$env:TEMP\gr-track-rules.js" (Get-Location).Path
git diff --stat -- docs/rules-paste.json docs/firebase-rules-*.json
```

Expected: `wrote firebase-rules-전체-적용본.json` · `wrote rules-paste.json`, 그리고 `git diff --stat` 에 두 파일만, 각각 **늘어난 줄만**(약 40줄, 지운 줄 0). 지운 줄이 보이면 멈추고 까닭(줄 끝·다른 변경)을 찾는다.

- [ ] **Step 5: 검사 목록 — 게시 대기**

(a) `tests/perf-rules.test.js` 의 `'scal_reports', 'scal_rptForms', 'scal_rptFormsIndex',` 줄 다음에 더한다.

```js
  /* 2026-10-10 서류 진행 기록(③서명본·④별첨·⑤제출) — 컨설팅보고서 앱이 줄 하나씩 쓴다.
     읽기 로그인 · 위쪽 칸 관리자 · 줄만 직원 쓰기(지우기는 관리자). 설계 2026-10-10-gov-report-track-design.md */
  'scal_docs',
```

(b) `tests/photos-staff-share.test.js` 의 `  const PENDING = [];` 한 줄을 다음으로 바꾼다.

```js
  /* ★ 2026-10-10 — 서류 진행 기록 자리(scal_docs)를 만들개에 넣었다(설계 2026-10-10-gov-report-track-design.md §2-1).
       규칙 게시 대기 — 대표 승인 뒤 rules-deploy.js 로 게시하고, 콘솔 원문을 새 판으로 갱신한 뒤 이 줄을 지울 것.
       게시 전에는 컨설팅보고서 앱이 「기록을 못 불러왔습니다 — 규칙 게시 또는 권한 확인」으로 읽기 전용으로 돈다. */
  const PENDING = ['/scal_docs'];
```

- [ ] **Step 6: 등록부** — `js/pu-ontology.js`

(a) `govreport` 머리 주석의 `       ★ 읽기만 한다 — 보고서(scal_reports)·양식 서고(scal_rptForms*)·일정(scal_*)의 주인은 정부사업일정(consult)이다.` 줄을 다음으로 바꾼다.

```js
       ★ 보고서(scal_reports)·양식 서고(scal_rptForms*)·일정(scal_*)은 읽기만 한다 — 주인은 정부사업일정(consult)이다.
```

(b) 같은 주석 끝 줄 `         컨설팅(data/consultings, 목차 머리말만)·ERP 연결(scal_erpTypeMap)을 빌려 읽는다. 쓰지 않는다(주인은 erp·consult). */` 를 다음으로 바꾼다.

```js
         컨설팅(data/consultings, 목차 머리말만)·ERP 연결(scal_erpTypeMap)을 빌려 읽는다. 쓰지 않는다(주인은 erp·consult).
       ★ 서류 진행 기록(2026-10-10, 설계 2026-10-10-gov-report-track-design.md) — 이 앱이 처음으로 «쓴다»:
         scal_docs/{업체}/{rid}/items/{줄 키}(③서명본·④별첨·⑤제출의 상태·날짜·메모, 줄 하나씩 .set). 주인은 이 앱이다.
         이름 표 GR_TRACK_NODES 로 부른다. 규칙 scal_docs(scripts/make-firebase-rules.js)는 대표 승인 뒤 게시 —
         게시 전에는 읽기·쓰기가 거절되고 화면은 읽기 전용으로 돈다. */
```

(c) `govreport:{ name:'컨설팅보고서', file:'gov-report.html', primaryRoots:['activeWriter/gov_report'],` 줄을 다음으로 바꾼다.

```js
    govreport:{ name:'컨설팅보고서', file:'gov-report.html', primaryRoots:['activeWriter/gov_report','scal_docs'],
```

(d) `      writeContracts:[{path:'activeWriter/gov_report',entityType:'Document'}],` 줄(govreport 안의 것)을 다음으로 바꾼다.

```js
      writeContracts:[{path:'activeWriter/gov_report',entityType:'Document'},{path:'scal_docs/{co}/{rid}/items/{key}',entityType:'Document'}],
```

(e) `govreport_view` 의 `gives:'이름 자리(예약 — 이번 판은 쓰지 않는다). 보고서 상태는 정부사업일정(consult)의 자리다'},` 를 다음으로 바꾼다.

```js
      gives:'이름 자리(예약) · 서류 진행 기록(scal_docs, 앱 안에서만 본다). 보고서 상태는 정부사업일정(consult)의 자리다'},
```

- [ ] **Step 7: 화면 검사의 등록부 단언** — `tests/gov-report-app.test.js` 의 다음 줄

```js
  assert.deepEqual(g.writeContracts.map((w) => w.path), ['activeWriter/gov_report'], '쓰는 자리는 늘지 않는다');
```

을 다음 둘로 바꾼다.

```js
  assert.deepEqual(g.writeContracts.map((w) => w.path), ['activeWriter/gov_report', 'scal_docs/{co}/{rid}/items/{key}'],
    '쓰는 자리는 서류 진행 기록 줄 하나뿐');
  assert.ok(g.primaryRoots.includes('scal_docs'), '서류 진행 기록의 주인은 이 앱');
```

- [ ] **Step 8: 공용 js 번호 올리기(바이트 보존)** — 지금 번호부터 본다(main 이 움직였으면 아래 61/62 를 그 번호로).

Run: `git grep -h -o "pu-ontology.js?v=[0-9]*" -- "*.html" | Group-Object | Select-Object Count,Name`
Expected: `24 pu-ontology.js?v=61` 한 줄

latin1 로 읽고 써서 BOM·CRLF·섞인 줄 끝을 바이트 그대로 둔다. 스크립트는 저장소 «밖».

```powershell
@'
const fs = require('fs'), path = require('path');
const root = process.argv[2];
for (const f of fs.readdirSync(root).filter((x) => x.endsWith('.html'))) {
  const p = path.join(root, f); const s = fs.readFileSync(p, 'latin1');
  const t = s.split('js/pu-ontology.js?v=61"').join('js/pu-ontology.js?v=62"');
  if (t !== s) { fs.writeFileSync(p, t, 'latin1'); console.log('bumped', f); }
}
'@ | Out-File -Encoding ascii "$env:TEMP\gr-track-bump.js"
node "$env:TEMP\gr-track-bump.js" (Get-Location).Path
git grep -h -o "pu-ontology.js?v=[0-9]*" -- "*.html" | Group-Object | Select-Object Count,Name
git diff --stat -- "*.html"
```

Expected: `bumped …` 24줄 · `git grep` 결과 `24 pu-ontology.js?v=62` 한 줄 · `git diff --stat` 의 html 마다 `1 +-`(줄 끝이 바뀌었다면 수가 커진다 — 그러면 멈춘다).

- [ ] **Step 9: 통과 확인**

Run: `node --test tests/gov-report-rules.test.js tests/rules-paste-copy.test.js tests/photos-staff-share.test.js tests/rules-deploy-guards.test.js tests/gov-report-app.test.js tests/gov-report-track.test.js tests/ontology-registry.test.js tests/ontology-contract.test.js tests/ontology-write-gate.test.js`
그리고: `node tests/perf-rules.test.js` · `node tests/shared-js-cache-version.test.js` · `node scripts/check-cache-version.js --all`
Expected: 모두 PASS(`perf-rules` 는 `=== N 통과 / 0 실패 ===`). `photos-staff-share` 의 「콘솔과 한 곳도 다르지 않다」는 차이가 `/scal_docs` 하나뿐이라 통과한다.

- [ ] **Step 10: 커밋** (PowerShell) — 고친 html 이 많으므로 `git status --short` 로 고친 것만 보이는지 먼저 본다.

```powershell
git status --short
git add scripts/make-firebase-rules.js docs/rules-paste.json docs/firebase-rules-*.json tests/gov-report-rules.test.js tests/perf-rules.test.js tests/photos-staff-share.test.js js/pu-ontology.js tests/gov-report-app.test.js
git add -u -- "*.html"
git commit -m @'
feat(rules): 서류 진행 기록 자리 scal_docs — 줄 하나만 직원 쓰기(게시 대기)

- scal_docs/{업체}/{rid}/items/{줄 키}: 읽기 로그인 · 루트·$co·$rid·items 쓰기 관리자(위에서 뚫지 못하게) ·
  줄은 직원 만들기·고치기, 지우기 관리자 · 모양 검사(상태 다섯·날짜 꼴·메모 200자·이름 40자·방식 넷·접수)
- 규칙 JSON 두 개 다시 만듦. ★ 게시하지 않았다 — 대표 승인 뒤 rules-deploy.js (perf-rules allowTop · photos-staff-share PENDING 에 올림)
- 등록부 govreport: 소유 자리 scal_docs · 쓰기 계약 scal_docs/{co}/{rid}/items/{key} · pu-ontology.js ?v=62 (부르는 화면 모두)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
'@
```

---

### Task 3: 화면 — 기록 읽기 · ③④⑤ 칸 누르기 · 칸 창 · 줄 하나 쓰기 · 「서명」「제출」 숫자 칸 · ⏰ 두 줄 · 목차 딱지

**Files:**
- Modify: `gov-report.html` (머리 주석 · CSS · 몸통 두 곳 · 관문 주석 · 맨 아래 `<script>`)
- Modify: `tests/gov-report-app.test.js` (머리 주석 · 불러오기 · `NAMES` · `world()` · 쓰기 정적 검사 좁히기 · ②⑤⑭ 고침 · 새 검사 ⑳~㉕)

**Interfaces:**
- Consumes (T1): `PuGovReportTrack.normalize` · `recOf` · `put` · `keysFor` · `label` · `kpiHit` · `kpiExtra` · `alertsExtra` · `validate` · `patchFor` · `ALLOWED` · `COL_KO` · `HOW` · `WAIT_SIGN_DAYS` · `SAVE_FAIL` · `LOAD_FAIL` · `PuGovReportDocs.docsTable({…, track, today})` · `tocFor({…, rec, today})` · `trackRows(rows, o)` · `planFor` · `pairs`
- Consumes (T2): 등록부 쓰기 계약(검사만) — 화면은 규칙이 게시되지 않아도 돈다
- Produces: `GR_TRACK_NODES={docs:'scal_docs'}` · `GR.track`·`GR.trackErr`·`GR.cw` · `grLoadTrack()` · `grApplyTrack()` · `grView()` · `grOpenCell(coId, typeId, step)` · `grPickCell(key)` · `grRenderCell()` · `grSaveCell() → Promise` · `grCloseCell()` · 화면 칸 `#cellw` · 체크표 단추 `data-cell="1" data-co data-ty data-step` · 칸 창 입력 `#cwKey`·`#cwSt`·`#cwSent`·`#cwGot`·`#cwHow`·`#cwAck`·`#cwNote`
- ⚠ 이 작업은 `js/*.js` 를 고치지 않는다. 고쳐야 하면 그 파일의 `?v` 를 같은 커밋에서 올린다.

- [ ] **Step 1: 화면 검사 고치기·더하기(실패)** — `tests/gov-report-app.test.js`

(a) 머리 주석의 ` * ★ 지키는 것: 읽기만 한다 · …` 줄을 다음으로 바꾼다.

```js
 * ★ 지키는 것: 쓰기는 서류 진행 기록 줄 하나(scal_docs/{업체}/{rid}/items/{키} .set)뿐 · 숫자 칸을 누르면 거르고 다시 누르면 풀린다 · 내 담당만 · 서고는 읽기만 ·
```

(b) `const D = require('../js/pu-gov-report-docs.js');` 줄 다음에 더한다.

```js
const Tr = require('../js/pu-gov-report-track.js');
```

(c) `NAMES` 를 다음으로 바꾼다.

```js
const NAMES = ['grEsc', 'grToday', 'grFilter', 'grRenderFilters', 'grRenderKpis', 'grSetStatus', 'grRenderRows',
  'grRenderForms', 'grRenderAlerts', 'grRender', 'grReset', 'grLoad',
  'grBizType', 'grErp', 'grSetBiz', 'grLoadDocs', 'grRetryDocs', 'grRenderBiz',
  'grRenderDocs', 'grOpenToc', 'grRenderToc', 'grCopyToc', 'grCloseToc',
  'grView', 'grLoadTrack', 'grApplyTrack', 'grOpenCell', 'grPickCell', 'grRenderCell', 'grSaveCell', 'grCloseCell'];
```

(d) `world()` 의 `encodeURIComponent, PuGovReportList: L, PuGovReport: { FORMS: Rpt.FORMS }, PuGovReportDocs: D,` 줄을 다음으로 바꾸고, `vm.runInContext([varLine('GR_NODES'), …` 줄을 그 다음 것으로 바꾼다.

```js
    encodeURIComponent, PuGovReportList: L, PuGovReport: { FORMS: Rpt.FORMS }, PuGovReportDocs: D, PuGovReportTrack: Tr,
```

```js
  vm.runInContext([varLine('GR_NODES'), varLine('GR_FIELDS'), varLine('GR_DOC_NODES'), varLine('GR_TRACK_NODES'), varLine('GR')].join('\n') + '\n' + NAMES.map(grab).join('\n')
```

(e) `world()` 함수 «다음»에 더한다.

```js
/* 쓰기는 서류 진행 기록 줄 하나뿐 — 자리 꼴 scal_docs/{업체}/{rid}/items/{키}, set 만 */
const TRACK_PATH = /^scal_docs\/[^/]+\/[^/]+\/items\/[a-z]+(:[0-9]+)?$/;
function onlyTrackWrites(db) {
  db.쓴것.forEach((x) => assert.ok(TRACK_PATH.test(x.자리) && !x.update && !x.transaction, '허락 밖 쓰기: ' + x.자리));
}
```

(f) 정적 검사 `'정적 — 아무것도 쓰지 않는다 · 일정 자리는 GR_NODES 로만 부른다'` 전체를 다음으로 바꾼다.

```js
test('정적 — 쓰기는 한 곳뿐(서류 진행 기록 줄 하나 .set) · 일정 자리는 GR_NODES 로만 부른다', () => {
  assert.deepEqual(INLINE.match(/\.(set|update|remove|transaction)\s*\(/g) || [], ['.set('], '쓰기 명령은 grSaveCell 의 .set 하나뿐');
  assert.doesNotMatch(INLINE, /ref\([^)]*\)\.push\(/, '쓰기 명령이 있다');
  assert.match(grab('grSaveCell'), /fbDb\.ref\(GR_TRACK_NODES\.docs\+'\/'\+c\.coId\+'\/'\+c\.rid\+'\/items\/'\+c\.key\)\.set\(rec\)/);
  assert.match(SRC, /var GR_TRACK_NODES=\{docs:'scal_docs'\};/);
  assert.doesNotMatch(INLINE, /ref\(\s*['"]scal_docs/, 'GR_TRACK_NODES 를 거치지 않았다');
  assert.doesNotMatch(INLINE, /ref\(\s*['"]scal_(cos|types|scheds|staff)/, 'GR_NODES 를 거치지 않았다');
  assert.match(SRC, /불러오지 못했습니다 — 연결을 확인해 주세요/);
  assert.match(SRC, /올해 걸린 보고서가 없습니다 — 사업 걸기는 정부사업일정에서/);
  assert.match(SRC, /<div id="cellw" class="toc" style="display:none"><\/div>/);
  assert.match(SRC, /<option value="signed">서명 진행<\/option><option value="submitted">제출 완료<\/option>/);
});
```

(g) 검사 `'② 숫자 칸 — …'` 전체를 다음으로 바꾼다.

```js
test('② 숫자 칸 — 올해 기준, 누르면 거르고 다시 누르면 풀린다 · 서명·제출은 서류 진행 기록으로 센다', async () => {
  const w = world();
  await w.ctx.grLoad();
  const k = w.els.kpis.innerHTML;
  assert.match(k, /data-st=""[^>]*><b>3<\/b><span>전체/);
  assert.match(k, /data-st="todo"[^>]*><b>1<\/b><span>미작성/);
  assert.match(k, /data-st="signed"[^>]*><b>2<\/b><span>서명/);
  assert.match(k, /data-st="submitted"[^>]*><b>1<\/b><span>제출/);
  assert.ok(!k.includes('disabled'), '서명·제출 칸도 누를 수 있다');
  w.ctx.grSetStatus('todo');
  assert.ok(w.els.rows.innerHTML.includes('마바산업'));
  assert.ok(!w.els.rows.innerHTML.includes('가나상사'));
  assert.equal(w.els.fStatus.value, 'todo');
  assert.match(w.els.kpis.innerHTML, /class="kpi on" data-st="todo"/);
  w.ctx.grSetStatus('todo');
  assert.ok(w.els.rows.innerHTML.includes('가나상사'), '다시 누르면 풀린다');
  w.ctx.grSetStatus('signed');
  let h = w.els.rows.innerHTML;
  assert.ok(h.includes('다라정밀') && h.includes('마바산업') && !h.includes('가나상사'), '서명 = ③ 진행·완료');
  assert.match(w.els.kpis.innerHTML, /class="kpi on" data-st="signed"/);
  w.ctx.grSetStatus('submitted');
  h = w.els.rows.innerHTML;
  assert.ok(h.includes('마바산업') && !h.includes('다라정밀'), '제출 = ⑤ 완료');
  w.ctx.grSetStatus('submitted');
  assert.equal(w.ctx.GR.f.status, '', '다시 누르면 풀린다');
});
```

(h) 검사 `'⑤ 챙길 것 — …'` 전체를 다음으로 바꾼다.

```js
test('⑤ 챙길 것 — 14일 넘은 미작성 · 7일 넘은 초안 · 서명 회신 7일 넘게 기다림 · 제출 기한 지남', async () => {
  const w = world();
  await w.ctx.grLoad();
  const h = w.els.alerts.innerHTML;
  assert.match(h, /종료 후 14일 넘은 미작성 <b>1<\/b>/);
  assert.ok(h.includes('마바산업') && h.includes('종료 151일'));
  assert.match(h, /초안 7일 넘음 <b>1<\/b>/);
  assert.ok(h.includes('20일 전 고침'));
  assert.match(h, /서명 회신 기다림 \(7일 넘음\) <b>1<\/b>/);
  assert.ok(h.includes('다라정밀') && h.includes('회신 20일째'));
  assert.match(h, /제출 기한 지남 <b>1<\/b>/);
  assert.ok(h.includes('기한 2026-09-30'));
  assert.ok(!h.includes('서명 단계가 생기면 셉니다'));
});
```

(i) 검사 `'⑭ 서류 체크표 — …'` 의 이름과 「—」 단언을 바꾼다 — 이름 줄은

```js
test('⑭ 서류 체크표 — 간단형은 ①~⑤ 열(①② 자동, ③④⑤ 기록 칸)·기한·목차 단추', async () => {
```

`assert.equal((h.match(/<td>—<\/td>/g) || []).length, 4, '② ③ ④ ⑤ 는 「—」');` 줄은 다음 셋으로.

```js
  assert.equal((h.match(/<td>—<\/td>/g) || []).length, 2, '② 와 ③ 은 「—」 — 기술보호에는 ③ 서명본 줄이 없다');
  assert.ok(h.includes('data-cell="1" data-co="c1" data-ty="t1" data-step="attach"'));
  assert.ok(h.includes('<span class="st st-wait">○ 없음 0/6</span>'));
```

(j) 파일 끝에 더한다.

```js
/* ═══ 서류 진행 기록(③서명본·④별첨·⑤제출) — 설계 2026-10-10-gov-report-track-design.md ═══ */

test('⑳ 체크표 ③④⑤ — 기록을 읽어 칸으로, 누르면 칸 창 · 기술보호는 ③ 이 없다 · 여는 것만으로는 안 쓴다', async () => {
  const w = world();
  await w.ctx.grLoad();
  w.ctx.grSetBiz('consulting-04');
  const h = w.els.docs.innerHTML;
  assert.ok(h.includes('data-cell="1" data-co="c2" data-ty="t3" data-step="sign"'));
  assert.ok(h.includes('<span class="st st-draft">◐ 발송함 · 회신 20일째</span>'));
  w.ctx.grOpenCell('c2', 't3', 'sign');
  const c = w.els.cellw.innerHTML;
  assert.equal(w.els.cellw.style.display, '');
  ['③ 업체 서명본 — 다라정밀', '서류: 업체 서명본', '발송일', '회신(스캔 받음)일', 'value="2026-09-20"',
    '개인정보를 적지 마세요', '고친 사람 홍길동 · 2026-09-20', 'data-close', 'onclick="grSaveCell()"'].forEach((s) => assert.ok(c.includes(s), s));
  assert.match(c, /<option value="doing" selected>◐ 발송함<\/option>/);
  assert.ok(!c.includes('value="na"'), '서명본에는 해당없음이 없다');
  w.ctx.grCloseCell();
  assert.equal(w.els.cellw.style.display, 'none');
  w.ctx.grSetBiz('consulting-03');
  const g = w.els.docs.innerHTML;
  assert.ok(!g.includes('data-step="sign"'));
  assert.ok(g.includes('data-step="attach"') && g.includes('data-step="submit"'));
  assert.equal(w.db.쓴것.length, 0, '여는 것만으로는 쓰지 않는다');
});

test('㉑ 저장 — 줄 키 하나만 .set · 다시 읽지 않고 표·숫자 칸·챙길 것·목차가 바뀐다', async () => {
  const w = world({ email: 'p009@pureun.kr' });
  await w.ctx.grLoad();
  w.ctx.grSetBiz('consulting-04');
  w.ctx.grOpenCell('c2', 't3', 'sign');
  w.els.cwSt.value = 'done'; w.els.cwSent.value = '2026-09-20'; w.els.cwGot.value = '2026-10-08'; w.els.cwNote.value = ' 스캔 회신 ';
  await w.ctx.grSaveCell();
  onlyTrackWrites(w.db);
  assert.deepEqual(w.db.쓴것.map((x) => x.자리), ['scal_docs/c2/t3_2026/items/sign']);
  const v = w.db.쓴것[0].값;
  assert.deepEqual([v.st, v.sentAt, v.gotAt, v.note, v.by, typeof v.at], ['done', '2026-09-20', '2026-10-08', '스캔 회신', '홍길동', 'number']);
  assert.equal(w.db.읽기('scal_docs/c2/t3_2026/items/sign').st, 'done');
  assert.ok(w.els.cellw.innerHTML.includes('저장했습니다'));
  assert.ok(w.els.docs.innerHTML.includes('<span class="st st-done">● 회신 받음</span>'));
  assert.match(w.els.alerts.innerHTML, /서명 회신 기다림 \(7일 넘음\) <b>0<\/b>/);
  assert.match(w.els.kpis.innerHTML, /data-st="submitted"[^>]*><b>0<\/b>/);
  w.ctx.grOpenCell('c2', 't3', 'submit');
  const c = w.els.cellw.innerHTML;
  ['제출일', '제출 방식', '접수 확인', '<option value="platform">플랫폼</option>'].forEach((s) => assert.ok(c.includes(s), s));
  w.els.cwSt.value = 'done'; w.els.cwGot.value = '2026-10-09'; w.els.cwHow.value = 'platform'; w.els.cwAck.checked = true; w.els.cwNote.value = '';
  await w.ctx.grSaveCell();
  onlyTrackWrites(w.db);
  const s = w.db.쓴것[1];
  assert.equal(s.자리, 'scal_docs/c2/t3_2026/items/submit');
  assert.deepEqual(s.값, { st: 'done', at: s.값.at, by: '홍길동', gotAt: '2026-10-09', how: 'platform', ack: true });
  assert.match(w.els.kpis.innerHTML, /data-st="submitted"[^>]*><b>1<\/b>/, '사업 거르개 안(다라정밀 하나)에서 제출 1');
  w.ctx.grOpenToc('c2', 't3');
  assert.ok(w.els.toc.innerHTML.includes('<span class="st st-done">● 제출함</span>'));
});

test('㉒ 규칙 게시 전 — 읽기 거절: 칸은 「—」·누를 수 없고 안내 · 쓰기 거절: 창에 「저장하지 못했습니다 — 규칙 게시 또는 권한 확인」, 값은 그대로', async () => {
  const denied = { once: async () => { throw new Error('permission_denied'); }, set: async () => { throw new Error('PERMISSION_DENIED'); } };
  const r = world({ db: (db) => ({ ref: (p) => (p === 'scal_docs' ? denied : db.ref(p)) }) });
  await r.ctx.grLoad();
  r.ctx.grSetBiz('consulting-04');
  assert.ok(r.els.docs.innerHTML.includes('기록을 못 불러왔습니다 — 규칙 게시 또는 권한 확인'));
  assert.ok(!r.els.docs.innerHTML.includes('data-cell'), '못 읽었으면 누를 수 없다(남의 기록을 모르고 덮지 않게)');
  assert.ok(r.els.rows.innerHTML.includes('다라정밀'), '목록은 그대로');
  assert.match(r.els.kpis.innerHTML, /data-st="signed"[^>]*><b>0<\/b>/);
  assert.ok(r.els.alerts.innerHTML.includes('기록을 못 불러왔습니다'));
  r.ctx.grOpenCell('c2', 't3', 'sign');
  assert.equal(r.ctx.GR.cw, null);
  const w = world({ db: (db) => ({ ref: (p) => (p.indexOf('scal_docs/') === 0 ? denied : db.ref(p)) }) });
  await w.ctx.grLoad();
  w.ctx.grSetBiz('consulting-04');
  w.ctx.grOpenCell('c2', 't3', 'sign');
  w.els.cwSt.value = 'done';
  await w.ctx.grSaveCell();
  const c = w.els.cellw.innerHTML;
  assert.ok(c.includes('저장하지 못했습니다 — 규칙 게시 또는 권한 확인'));
  assert.match(c, /<option value="done" selected>● 회신 받음<\/option>/, '고르던 값은 창에 남는다');
  assert.ok(w.els.docs.innerHTML.includes('◐ 발송함'), '표 값은 그대로');
  assert.equal(w.ctx.GR.track.c2.t3_2026.sign.st, 'doing');
  assert.equal(w.db.쓴것.length, 0);
});

test('㉓ 잘못 적으면 쓰지 않는다 — 회신일 < 발송일 · 적던 값은 창에 남는다', async () => {
  const w = world();
  await w.ctx.grLoad();
  w.ctx.grSetBiz('consulting-04');
  w.ctx.grOpenCell('c2', 't3', 'sign');
  w.els.cwSt.value = 'done'; w.els.cwSent.value = '2026-09-20'; w.els.cwGot.value = '2026-09-01'; w.els.cwNote.value = '메모';
  await w.ctx.grSaveCell();
  assert.equal(w.db.쓴것.length, 0);
  assert.ok(w.els.cellw.innerHTML.includes('회신일이 발송일보다 앞섭니다'));
  assert.ok(w.els.cellw.innerHTML.includes('value="2026-09-01"'), '적던 값이 남는다');
});

test('㉔ 여러 서류가 한 칸이면(기술보호 ④) 서류를 골라 그 줄만 저장 · 해당없음은 세지 않는다', async () => {
  const w = world();
  await w.ctx.grLoad();
  w.ctx.grSetBiz('consulting-03');
  w.ctx.grOpenCell('c1', 't1', 'attach');
  const c = w.els.cellw.innerHTML;
  assert.ok(c.includes('<select id="cwKey" onchange="grPickCell(this.value)">'));
  ['법률 자문 일지 1회차', '법률 자문 일지 3회차', '보안서약서', '별지8 여비지급신청서', '만족도조사', 'value="na"'].forEach((s) => assert.ok(c.includes(s), s));
  w.ctx.grPickCell('pledge');
  assert.equal(w.ctx.GR.cw.key, 'pledge');
  w.els.cwSt.value = 'na';
  await w.ctx.grSaveCell();
  onlyTrackWrites(w.db);
  assert.deepEqual(w.db.쓴것.map((x) => x.자리), ['scal_docs/c1/t1_2026/items/pledge']);
  assert.ok(w.els.docs.innerHTML.includes('<span class="st st-wait">○ 없음 0/5</span>'));
});

test('㉕ 진행 막대 ③④ · 목차 딱지도 기록을 따른다 · 칸 창의 바깥 값은 이스케이프', async () => {
  const w = world();
  await w.ctx.grLoad();
  const row = w.els.rows.innerHTML.split('<tr>').filter((x) => x.includes('마바산업'))[0];
  assert.ok(row.includes('<span class="stp on" title="③ 서명"></span>') && row.includes('<span class="stp on" title="④ 제출"></span>'));
  w.ctx.grOpenToc('c3', 't4');
  assert.ok(w.els.toc.innerHTML.includes('<span class="st st-done">● 제출함</span>'));
  assert.ok(w.els.toc.innerHTML.includes('<span class="days">— 해당없음</span>'));
  const s = F.seed();
  s.scal_docs.c2.t3_2026.items.sign.note = '<img src=x>';
  s.scal_docs.c2.t3_2026.items.sign.by = '<b>홍</b>';
  s.scal_cos[1].name = '다라<정밀>';
  const v = world({ seed: s });
  await v.ctx.grLoad();
  v.ctx.grSetBiz('consulting-04');
  v.ctx.grOpenCell('c2', 't3', 'sign');
  const c = v.els.cellw.innerHTML;
  assert.ok(!c.includes('<img') && !c.includes('<b>홍') && !c.includes('<정밀>'), '이스케이프 안 됨');
  assert.ok(c.includes('&#60;img src=x&#62;') && c.includes('다라&#60;정밀&#62;'));
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test tests/gov-report-app.test.js`
Expected: FAIL — `grView 을(를) 못 찾았다` (또는 `GR_TRACK_NODES 한 줄을 못 찾았다`)

- [ ] **Step 3: 머리 주석·CSS·몸통** — `gov-report.html`

(a) 머리 주석의 두 줄

```html
     ★ 이 화면은 «읽기만» 한다 — 모든 사업장·사업의 보고서 상태를 보고, 쓰는 일은
       정부사업일정의 보고서 창(gov-consulting.html#rpt=업체|사업)으로 건너가서 한다.
```

을 다음으로 바꾼다.

```html
     ★ 보고서는 «읽기만» 한다 — 모든 사업장·사업의 보고서 상태를 보고, 쓰는 일은
       정부사업일정의 보고서 창(gov-consulting.html#rpt=업체|사업)으로 건너가서 한다.
     ★ 이 화면이 쓰는 곳은 «하나»다 — 서류 진행 기록(③서명본·④별첨·⑤제출) 줄 하나씩:
       scal_docs/{업체}/{rid}/items/{줄 키} 를 .set (grSaveCell). 설계 docs/superpowers/specs/2026-10-10-gov-report-track-design.md
       규칙 게시 전에는 읽기·쓰기가 거절되어 읽기 전용으로 돈다(「기록을 못 불러왔습니다 — 규칙 게시 또는 권한 확인」).
```

(b) CSS — `.toc-t{…}` 줄 다음에 더한다(새 색 없음 · 입력칸 `font-size` 없음 — 폰 확대 규칙이 이기게).

```css
.cellb{border:0;background:none;padding:0;cursor:pointer}
.cw-f{display:flex;flex-direction:column;gap:4px;margin:8px 0;font-size:13px}
.cw-f input,.cw-f select,.cw-f textarea{font-family:inherit;border:1px solid var(--line);border-radius:8px;padding:6px 8px;background:var(--card)}
.cw-c{display:flex;align-items:center;gap:6px;font-size:13px;margin:8px 0}
.cw-b{display:flex;justify-content:flex-end;margin-top:10px}
```

(c) 상태 거르개 — `<option value="draft">초안</option><option value="done">검토완료</option>` 줄 다음에 한 줄 더한다.

```html
          <option value="signed">서명 진행</option><option value="submitted">제출 완료</option>
```

(d) `<div id="toc" class="toc" style="display:none"></div>` 줄 다음에 더한다.

```html
<div id="cellw" class="toc" style="display:none"></div>
```

(e) 저장 관문 주석의 끝 문장 `없으므로 관문이 «강제»(enforce)로 돈다. 이 화면은 아무것도 쓰지 않는다. -->` 를 다음으로 바꾼다.

```html
     없으므로 관문이 «강제»(enforce)로 돈다. 이 화면의 쓰기는 서류 진행 기록 줄 하나 .set 뿐이다
     (레코드 모양이 아니라 관문을 지난다 — 부분 update 는 관문이 막으므로 쓰지 않는다). -->
```

- [ ] **Step 4: 스크립트** — 맨 아래 `<script>`

(a) `var GR_DOC_NODES={…};` 줄 다음에 더하고, `var GR={…};` 한 줄을 그 다음 것으로 바꾼다.

```js
/* 서류 진행 기록(③서명본·④별첨·⑤제출) — 이 앱의 자리. 읽기는 통째 한 번, 쓰기는 줄 하나(grSaveCell)
   ⚠ 이름 표로 부른다 — 글자 그대로 ref('scal_docs…') 를 쓰지 않는다(화면 검사가 막는다) */
var GR_TRACK_NODES={docs:'scal_docs'};
```

```js
var GR={seq:0,dseq:0,rows:[],input:null,staffMap:{},index:null,indexErr:false,err:'',loaded:false,me:'',email:'',today:'',docs:{loaded:false,err:false},toc:null,tocMsg:'',tocFail:false,track:null,trackErr:false,cw:null,f:{year:'',type:'',att:'',status:'',co:'',mine:false,biz:''}};
```

(b) `function grRenderKpis(){ … }` 전체와 그 뒤 주석·`function grSetStatus(st){ … }` 전체를 다음으로 바꾼다.

```js
function grRenderKpis(){
  var L=PuGovReportList, T=PuGovReportTrack, base=grFilter(); base.status='';
  var view=L.filterRows(GR.rows,base), k=L.kpis(view), x=T.kpiExtra(view);
  var cells=[['','전체',k.all],['todo','미작성',k.todo],['draft','초안',k.draft],['done','검토완료',k.done],['signed','서명',x.signed],['submitted','제출',x.submitted]];
  var tip={signed:' title="③ 업체 서명본이 진행(발송)·완료인 줄"',submitted:' title="⑤ 기관 제출을 마친 줄"'};
  $('kpis').innerHTML=cells.map(function(c){
    return '<button type="button" class="kpi'+(c[0]&&GR.f.status===c[0]?' on':'')+'" data-st="'+c[0]+'"'+(tip[c[0]]||'')+'><b>'+c[2]+'</b><span>'+c[1]+'</span></button>';
  }).join('');
}
/* 숫자 칸 — 누르면 그 상태로, 같은 칸을 다시 누르면 풀린다. 「전체」는 풀기. 「서명」「제출」은 서류 진행 기록으로 거른다(grView) */
function grSetStatus(st){
  GR.f.status=(st&&GR.f.status!==st)?st:'';
  grRender();
}
/* 목록에 보일 줄 — 「서명」「제출」은 현황판 상태가 아니라 기록(r.trk)으로 거른다 */
function grView(){
  var L=PuGovReportList, f=grFilter(), k=f.status;
  if(k!=='signed'&&k!=='submitted') return L.filterRows(GR.rows,f);
  f.status='';
  return L.filterRows(GR.rows,f).filter(function(r){ return PuGovReportTrack.kpiHit(r,k); });
}
```

(`var tip={…}` 의 중괄호는 짝이 맞으므로 `grab` 에 걸리지 않는다.)

(c) `grRenderRows` 첫 줄 `var L=PuGovReportList, view=L.filterRows(GR.rows,grFilter());` 를 다음으로 바꾼다.

```js
  var L=PuGovReportList, view=grView();
```

(d) `function grRenderDocs(){ … }` 와 그 위 주석 전체를 다음으로 바꾼다.

```js
/* 서류 체크표 — 고른 사업의 업체들. 간단형 셋(충남북부·서산·기술보호)만 ①② 를 현황판 상태로 채우고
   ③④⑤ 는 서류 진행 기록(scal_docs) — 칸을 누르면 칸 창(grOpenCell). 기록을 못 읽었으면 「—」이고 누를 수 없다
   (남의 기록을 모른 채 덮지 않게). 다른 틀은 근거 자료가 아직 없어 «서류 목차 보기» 줄만 둔다(설계서 §4) */
function grRenderDocs(){
  var D=PuGovReportDocs, T=PuGovReportTrack, el=$('docs');
  if(!GR.f.biz||!GR.docs.loaded||GR.docs.err){ el.style.display='none'; el.innerHTML=''; return; }
  var erp=grErp(GR.f.biz), tid=grBizType();
  var t=D.docsTable({erp:erp,typeId:tid,input:GR.input,rows:GR.rows,year:GR.f.year,consultings:GR.docs.cons,tmap:GR.docs.tmap,biz:GR.docs.biz,
    track:GR.track||undefined,today:GR.today});
  var btn=function(x,label){ return '<button type="button" class="act tocb" data-toc="1" data-co="'+grEsc(x.coId)+'" data-ty="'+grEsc(x.typeId)+'">'+label+'</button>'; };
  var chip=function(c){ return c.key?'<span class="st st-'+c.key+'">'+grEsc(c.txt)+'</span>':grEsc(c.txt); };
  var cell=function(x,c){
    return c.step?'<button type="button" class="cellb" data-cell="1" data-co="'+grEsc(x.coId)+'" data-ty="'+grEsc(x.typeId)+'" data-step="'+grEsc(c.step)+'" title="눌러서 기록">'+chip(c)+'</button>':chip(c);
  };
  var head='<div class="dc-h"><b>📋 서류 — '+grEsc(erp?erp.name:'')+'</b><span class="tag">'+grEsc(D.KIND_KO[t.plan.kind])+'</span>'
    +(t.plan.check?'<span class="tag-chk">[확인 필요: '+grEsc(t.plan.check)+']</span>':'')
    +(t.auto&&GR.trackErr?'<span class="err-s">'+grEsc(T.LOAD_FAIL)+'</span>':'')+'</div>';
  var body;
  if(!tid) body='<div class="empty">'+grEsc(D.UNLINKED)+' — 사업 잇기는 정부사업일정의 ERP 연결에서</div>';
  else if(!t.lines.length) body='<div class="empty">'+grEsc(GR.f.year)+'년에 이 사업 업체가 없습니다</div>';
  else if(t.auto) body='<table><thead><tr><th>업체</th>'+t.cols.map(function(c){ return '<th>'+grEsc(c)+'</th>'; }).join('')+'<th>기한</th><th></th></tr></thead><tbody>'
    +t.lines.map(function(x){
      return '<tr><td class="co" title="'+grEsc(x.coName)+'">'+grEsc(x.coName)+'</td>'+x.cells.map(function(c){ return '<td>'+cell(x,c)+'</td>'; }).join('')
        +'<td>'+grEsc(x.due||'—')+'</td><td>'+btn(x,'목차')+'</td></tr>';
    }).join('')+'</tbody></table>';
  else body=t.lines.map(function(x){ return '<div class="dc-l"><span>'+grEsc(x.coName)+'</span>'+btn(x,'서류 목차 보기')+'</div>'; }).join('');
  el.innerHTML=head+body; el.style.display='';
}
```

(e) `grOpenToc` 의 `GR.toc=D.tocFor({pair:p,row:row,erp:erp,cons:cons,dir:d.dir}); GR.tocMsg=''; GR.tocFail=false;` 줄을 다음으로 바꾼다.

```js
  GR.toc=D.tocFor({pair:p,row:row,erp:erp,cons:cons,dir:d.dir,rec:GR.track?PuGovReportTrack.recOf(GR.track,coId,p.rid):undefined,today:GR.today});
  GR.tocMsg=''; GR.tocFail=false;
```

(f) `grRenderToc` 의 `+(x.chip.key?'<span class="st st-'+x.chip.key+'">'+grEsc(x.chip.txt)+'</span>':'<span class="days">—</span>')` 줄을 다음으로 바꾼다(「— 해당없음」처럼 딱지 없는 글도 보이게 — 예전 「—」 는 그대로 나온다).

```js
        +(x.chip.key?'<span class="st st-'+x.chip.key+'">'+grEsc(x.chip.txt)+'</span>':'<span class="days">'+grEsc(x.chip.txt)+'</span>')
```

(g) `function grCloseToc(){ … }` 줄 다음에 더한다.

```js
/* 칸 창 — 체크표 ③④⑤ 칸 하나. 그 칸의 서류가 여럿이면(기술보호 ④ = 자문 일지 회차 + 서약서·여비·만족도) 서류를 고른다.
   저장은 고른 줄 키 하나만. 기록을 못 읽었으면 열지 않는다 */
function grOpenCell(coId,typeId,step){
  var D=PuGovReportDocs, T=PuGovReportTrack;
  if(!GR.track) return;
  var p=D.pairs(GR.input,typeId,GR.f.year).filter(function(x){ return x.coId===coId; })[0];
  var erp=grErp(GR.f.biz);
  if(!p||!erp) return;
  var keys=T.keysFor(D.planFor(erp.name),step,Math.max(+p.rounds||0,+p.planned||0));
  if(!keys.length) return;
  GR.cw={coId:coId,coName:p.coName,typeId:typeId,rid:p.rid,step:step,keys:keys,key:keys[0].key,draft:null,msg:'',err:false,busy:false};
  grRenderCell();
}
function grPickCell(key){
  if(!GR.cw) return;
  GR.cw.key=key; GR.cw.draft=null; GR.cw.msg=''; GR.cw.err=false;
  grRenderCell();
}
function grCloseCell(){ GR.cw=null; grRenderCell(); }
function grRenderCell(){
  var T=PuGovReportTrack, L=PuGovReportList, c=GR.cw, el=$('cellw');
  if(!c){ el.style.display='none'; el.innerHTML=''; return; }
  var rec=T.recOf(GR.track,c.coId,c.rid)[c.key]||null, v=c.draft||rec||{st:'none'};
  var item=c.keys.filter(function(k){ return k.key===c.key; })[0]||c.keys[0];
  var opt=function(val,txt,cur){ return '<option value="'+grEsc(val)+'"'+(val===cur?' selected':'')+'>'+grEsc(txt)+'</option>'; };
  var field=function(name,inner){ return '<label class="cw-f"><span>'+name+'</span>'+inner+'</label>'; };
  var date=function(id,val){ return '<input type="date" id="'+id+'" value="'+grEsc(val||'')+'">'; };
  var h='<div class="toc-box" role="dialog" aria-label="서류 진행 기록">'
    +'<div class="toc-top"><b>'+grEsc(T.COL_KO[c.step])+' — '+grEsc(c.coName)+'</b><span class="sp"></span>'
    +'<button type="button" data-close onclick="grCloseCell()">닫기</button></div>';
  if(c.keys.length>1) h+=field('서류','<select id="cwKey" onchange="grPickCell(this.value)">'+c.keys.map(function(k){ return opt(k.key,k.name,c.key); }).join('')+'</select>');
  else h+='<div class="toc-h">서류: '+grEsc(item.name)+'</div>';
  h+=field('상태','<select id="cwSt">'+T.ALLOWED[c.step].map(function(s){ return opt(s,T.label(c.step,s),v.st); }).join('')+'</select>');
  if(c.step==='sign') h+=field('발송일',date('cwSent',v.sentAt))+field('회신(스캔 받음)일',date('cwGot',v.gotAt));
  if(c.step==='submit') h+=field('제출일',date('cwGot',v.gotAt))
    +field('제출 방식','<select id="cwHow">'+opt('','고르기',v.how||'')+Object.keys(T.HOW).map(function(k){ return opt(k,T.HOW[k],v.how||''); }).join('')+'</select>')
    +'<label class="cw-c"><input type="checkbox" id="cwAck"'+(v.ack?' checked':'')+'> 접수 확인</label>';
  h+=field('메모(200자)','<textarea id="cwNote" maxlength="200" rows="3">'+grEsc(v.note||'')+'</textarea>')
    +'<div class="days">메모에 연락처·주민번호 같은 개인정보를 적지 마세요</div>'
    +(rec&&rec.at?'<div class="days">고친 사람 '+grEsc(rec.by||'—')+' · '+grEsc(L.dayOf(rec.at))+'</div>':'')
    +(c.msg?'<div class="'+(c.err?'err-s':'days')+'">'+grEsc(c.msg)+'</div>':'')
    +'<div class="cw-b"><button type="button" onclick="grSaveCell()"'+(c.busy?' disabled':'')+'>저장</button></div></div>';
  el.innerHTML=h; el.style.display='';
}
/* 저장 — 그 줄 키 하나만 .set(scal_docs/{업체}/{rid}/items/{키}). update 는 저장 관문이 «부분 update» 로 막는다.
   거절되면(규칙 게시 전·권한 없음) 창에 알리고 값은 그대로 둔다. 되면 다시 읽지 않고 로컬 값으로 다시 그린다 */
async function grSaveCell(){
  var T=PuGovReportTrack, c=GR.cw;
  if(!c||c.busy) return;
  var entry={st:$('cwSt').value,note:$('cwNote').value,
    sentAt:c.step==='sign'?$('cwSent').value:'',gotAt:c.step==='attach'?'':$('cwGot').value,
    how:c.step==='submit'?$('cwHow').value:'',ack:c.step==='submit'&&!!$('cwAck').checked};
  c.draft=entry;
  var bad=T.validate(entry,c.step);
  if(bad){ c.msg=bad; c.err=true; grRenderCell(); return; }
  var rec=T.patchFor(entry,GR.staffMap[GR.me]||'',Date.now());
  c.busy=true; c.msg='저장하는 중…'; c.err=false; grRenderCell();
  try{ await fbDb.ref(GR_TRACK_NODES.docs+'/'+c.coId+'/'+c.rid+'/items/'+c.key).set(rec); }
  catch(e){
    console.warn('[컨설팅보고서] 저장 못 함',e);
    c.busy=false; c.msg=T.SAVE_FAIL; c.err=true;
    if(GR.cw===c) grRenderCell();
    return;
  }
  GR.track=T.put(GR.track,c.coId,c.rid,c.key,rec);
  c.busy=false; c.draft=null; c.msg='저장했습니다'; c.err=false;
  grApplyTrack(); grRender();
  if(GR.cw===c) grRenderCell();
}
```

(h) `function grRenderAlerts(){ … }` 전체를 다음으로 바꾼다.

```js
function grRenderAlerts(){
  var L=PuGovReportList, T=PuGovReportTrack, rows=L.filterRows(GR.rows,{year:GR.f.year});
  var a=L.alerts(rows,GR.today), x=T.alertsExtra(rows,GR.today);
  var line=function(r,txt){ return '<li><a href="'+grEsc(L.reportHref(r.coId,r.typeId))+'">'+grEsc(r.coName)+' · '+grEsc(r.typeName)+'</a> <span class="days">'+grEsc(txt)+'</span></li>'; };
  $('alerts').innerHTML='<div class="al-h">종료 후 '+L.UNWRITTEN_DAYS+'일 넘은 미작성 <b>'+a.unwritten.length+'</b></div><ul>'
    +a.unwritten.map(function(r){ return line(r,'종료 '+r.st.days+'일'); }).join('')+'</ul>'
    +'<div class="al-h">초안 '+L.DRAFT_DAYS+'일 넘음 <b>'+a.staleDraft.length+'</b></div><ul>'
    +a.staleDraft.map(function(r){ return line(r,r.st.days+'일 전 고침'); }).join('')+'</ul>'
    +'<div class="al-h">서명 회신 기다림 ('+T.WAIT_SIGN_DAYS+'일 넘음) <b>'+x.waitSign.length+'</b></div><ul>'
    +x.waitSign.map(function(e){ return line(e.row,'회신 '+e.days+'일째'); }).join('')+'</ul>'
    +'<div class="al-h">제출 기한 지남 <b>'+x.overdue.length+'</b></div><ul>'
    +x.overdue.map(function(e){ return line(e.row,'기한 '+e.due); }).join('')+'</ul>'
    +(GR.trackErr?'<div class="err-s">'+grEsc(T.LOAD_FAIL)+'</div>':'');
}
```

(i) `grLoad` 끝의

```js
  await grLoadDocs();
  if(seq!==GR.seq) return;
  GR.loaded=true;
```

을 다음으로 바꾼다.

```js
  await grLoadDocs();
  if(seq!==GR.seq) return;
  await grLoadTrack();
  if(seq!==GR.seq) return;
  grApplyTrack();
  GR.loaded=true;
```

(j) `async function grRetryDocs(){ … }` 전체를 다음으로 바꾸고, 그 뒤에 두 함수를 더한다.

```js
async function grRetryDocs(){
  GR.docs={loaded:false,err:false}; grRenderBiz();
  await grLoadDocs();
  grApplyTrack();
  grRender();
}
/* 서류 진행 기록 — 통째로 한 번(once). 못 읽으면(규칙 게시 전·권한 없음) 체크표 ③④⑤ 만 읽기 전용 「—」, 나머지는 그대로 돈다 */
async function grLoadTrack(){
  try{ GR.track=PuGovReportTrack.normalize((await fbDb.ref(GR_TRACK_NODES.docs).once('value')).val()); GR.trackErr=false; }
  catch(e){ console.warn('[컨설팅보고서] 못 읽음 '+GR_TRACK_NODES.docs,e); GR.track=null; GR.trackErr=true; }
}
/* 현황판 줄에 기록을 붙인다(r.trk · ③④ 막대) — 읽은 뒤 · 저장한 뒤 · 왼쪽 자료를 다시 읽은 뒤 */
function grApplyTrack(){
  var d=GR.docs||{};
  PuGovReportDocs.trackRows(GR.rows,{track:GR.track,input:GR.input,biz:d.biz,tmap:d.tmap,consultings:d.cons,today:GR.today});
}
```

(k) `grBoot` — `['rows','docs'].forEach(…)` 덩어리와 `$('toc').addEventListener(…)` 줄을 다음으로 바꾼다.

```js
  ['rows','docs'].forEach(function(id){ $(id).addEventListener('click',function(e){
    var c=e.target&&e.target.closest?e.target.closest('[data-cell]'):null;
    if(c){ grOpenCell(c.getAttribute('data-co'),c.getAttribute('data-ty'),c.getAttribute('data-step')); return; }
    var b=e.target&&e.target.closest?e.target.closest('[data-toc]'):null;
    if(b) grOpenToc(b.getAttribute('data-co'),b.getAttribute('data-ty'));
  }); });
  $('toc').addEventListener('click',function(e){ if(e.target===this) grCloseToc(); });
  $('cellw').addEventListener('click',function(e){ if(e.target===this) grCloseCell(); });
```

- [ ] **Step 5: 통과 확인**

Run: `node --test tests/gov-report-app.test.js tests/gov-report-track.test.js tests/gov-report-docs.test.js tests/gov-report-list.test.js tests/color-palette-apps.test.js tests/html-inline-script-syntax.test.js tests/back-button.test.js tests/phone-input-zoom.test.js tests/ontology-registry.test.js tests/ontology-write-gate.test.js`
그리고: `node tests/shared-js-cache-version.test.js` · `node scripts/check-cache-version.js --all`
Expected: 모두 PASS. `check-cache-version --all` 은 아무것도 안 찍는다(이 작업은 js 를 고치지 않았다).

- [ ] **Step 6: 눈으로 확인(로그인 없이 되는 만큼)** — `gov-report.html` 을 file:// 로 열면 「file:// 로 열면 로그인할 수 없습니다」 잠금이 스크립트 오류 없이 보여야 한다. 콘솔에서 `PuGovReportTrack.STATES` 가 다섯 개로 보인다. 실제 자료·쓰기는 규칙 게시 뒤 로그인해서 본다(기록 「다음」).

- [ ] **Step 7: 커밋** (PowerShell)

```powershell
git add gov-report.html tests/gov-report-app.test.js
git commit -m @'
feat(gov-report): 서류 체크표 ③④⑤ 기록 — 칸 창·줄 하나 저장·서명/제출 숫자 칸·⏰ 두 줄

- scal_docs 를 한 번 읽어(GR_TRACK_NODES) ③서명본 ④별첨 ⑤제출 칸을 그리고, 누르면 칸 창(상태·날짜·방식·접수·메모)
- 저장은 그 줄 키 하나만 .set(scal_docs/{업체}/{rid}/items/{키}) — 다시 읽지 않고 표·숫자 칸·챙길 것·목차·막대를 다시 계산
- 숫자 칸 「서명」(③ 진행·완료)·「제출」(⑤ 완료) 켜기 · ⏰ 서명 회신 7일 넘게 기다림 · 제출 기한 지남
- 규칙 게시 전: 읽기 거절이면 칸 「—」(누를 수 없음)+「기록을 못 불러왔습니다 — 규칙 게시 또는 권한 확인」,
  쓰기 거절이면 「저장하지 못했습니다 — 규칙 게시 또는 권한 확인」(값은 그대로)
- 화면 검사: 쓰기는 이 자리 하나뿐으로 좁힘 + 새 검사

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
'@
```

---
