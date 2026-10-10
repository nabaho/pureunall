# 컨설팅보고서 앱(현황판) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 포털 **의뢰인 업무** 줄에 **📑 컨설팅보고서** 타일을 더하고, 새 화면 `gov-report.html` 에서 모든 사업장·사업의 보고서 상태(미작성·작성 전·초안·검토완료)를 한눈에 본다. 쓰는 일은 정부사업일정의 기존 보고서 창으로 건너가서(`#rpt=`) 한다.

**Architecture:** 줄 만들기·상태 가르기·숫자·거르기·챙길 것·양식 서고 현황은 새 순수 함수 모듈 `js/pu-gov-report-list.js`(UMD, Node 와 브라우저 겸용)에 둔다.
- `gov-report.html` 은 «읽고 → 모듈에 넣고 → 그린다» 만 한다. 그리는 함수는 `gr` 접두(`grRenderRows` 등)로 두고, 검사가 이름으로 떠서(vm) 가짜 DB 로 돌린다.
- 공통 머리(Firebase·로그인 문·앱 막대·뒤로가기·누구인지·저장 관문)는 가장 새 앱인 `rehab-ad.html` 꼴을 그대로 따른다(같은 날 들어온, 326줄의 가장 작은 포털 앱).
- `gov-consulting.html` 은 `#rpt=<업체>|<사업>` 과 `#forms` 를 읽는 함수 둘만 더한다(기존 `#sc=` 의 `openFromLink` 와 같은 기다리기 방식).

**Tech Stack:** 빌드 없는 정적 HTML + Firebase RTDB compat 9.23.0 · 브라우저/Node 겸용 UMD js(`js/pu-gov-report-build.js` 꼴) · `node --test` + `vm`(함수 떠서 돌리기, `tests/gov-report-ui.test.js` 의 `grab`) · 가짜 RTDB `tests/helpers/fake-rtdb.js`

**Spec:** `docs/superpowers/specs/2026-10-10-gov-report-app-design.md` (상위 `2026-10-05-정부컨설팅-보고서자동화-design.md` §11 「[F] 현황판」)

## Global Constraints

- 이 화면은 **아무것도 쓰지 않는다**(규칙·DB 변경 없음). 화면 스크립트에 `.set(`·`.update(`·`.remove(`·`.transaction(`·`ref(…).push(` 가 없어야 한다.
- 읽는 자리: `scal_cos`·`scal_types`·`scal_scheds`·`scal_staff`(통째, 한 번) · `scal_reports/{업체}/{사업}_{연도}`(줄마다 한 번 — `_v` 확정본 사본은 안 읽는다) · `scal_rptFormsIndex` · `data/user_dir`(내 담당 찾기).
- 줄이 생기는 조건: 업체(지운 것 빼고)가 그 사업에 걸려 있고(`co.types`), 사전진단(`phase:'pre'`) 뺀 회차가 하나라도 있고, `PuGovReportBuild.resolveFormKey(type,'')` 가 양식을 고르거나(`formKey`) 고르게 하거나(`ask`), 저장본에 `formKey` 가 있다. 대형(일터혁신 등)은 줄이 없다.
- 줄 열쇠는 정부사업일정과 같다 — `rid = 사업번호 + '_' + 연도`, 연도 = 사전진단 뺀 «첫 회차»의 해(`gov-consulting.html grpYearOf`).
- 상태(위에서부터 먼저 맞는 것): `state==='검토완료'` → **검토완료 vN** / 저장본 있음 → **초안**(`aiFields` 가 있으면 「AI 초안」 딱지) / 회차 모두 종료 → **미작성**(종료일부터 지난 날수) / 그 밖 → **작성 전**(단추 비활성, 「회차가 남았습니다」).
- «회차 모두 종료» = `co.endedTypes[사업]` 이 있거나, 회차 수 ≥ `co.customRounds[사업]`(없으면 `type.rounds`) 이고 마지막 회차 날짜 ≤ 오늘. 종료일 = `endedTypes` 날짜, 없으면 마지막 회차 날짜.
- 진행 막대 4칸: ① 초안이 있다 ② 검토완료다 ③ ④ 이번에는 항상 비어 있다.
- 챙길 것(⏰): 종료 후 **14일 넘은**(>14) 미작성 · 초안 **7일 넘음**(>7, 마지막 고친 날부터) · 서명 기다림 0(칸은 그린다).
- 단추: 미작성 → `📄 작성` · 초안 → `이어 쓰기` · 검토완료 → `⬇ HWPX` · 작성 전 → 비활성 `📄 작성`. 누르면 `gov-consulting.html#rpt=<encodeURIComponent(업체)>|<encodeURIComponent(사업)>`.
- 「내 담당만」 = 로그인한 사람이 그 사업장 주담당(`co.defAtt`)·부담당(`getCoAtts(co)` 꼴: `coAttIds`→`defCoAtts`→`coAttId`→`defCoAtt`)인 줄.
- 오류·빈 상태 문구(설계서 §5 그대로)
  - 못 읽음: `불러오지 못했습니다 — 연결을 확인해 주세요` + `다시 시도` 단추
  - 줄 없음: `올해 걸린 보고서가 없습니다 — 사업 걸기는 정부사업일정에서`
  - `#rpt=` 대상이 15초 안에 안 나타남: `그 보고서를 찾지 못했습니다 — 지워졌거나 볼 수 없는 사업장입니다`
- 목록에는 업체 이름·사업 이름·담당 이름·상태·마지막 고친 날·고친 사람만 나온다. 보고서 본문(`report`)은 줄에 담지도 그리지도 않는다(기술보호 줄도 같다).
- 색은 저장소 팔레트(`tests/lib-palette.js` 5계열 27색 + `#ffffff`)만. 파랑은 `.grp-ai` 와 같은 집안 `#eff6ff`·`#bfdbfe`·`#2563eb`·`#1e40af`.
- 공개 저장소다 — 검사·문서에 합성 이름만(가나상사·다라정밀·마바산업·사아테크·홍길동·김가나, `p009@pureun.kr`).
- 새 화면 함수는 `gr` 접두, `gov-consulting.html` 새 함수는 `linkRpt`·`openFromReportLink`·`openFormsFromLink`(기존 `linkSid`·`openFromLink` 이웃). vm 으로 떠 오는 함수(`grab`)의 글자열 안에 짝 없는 `{`·`}` 를 쓰지 않는다.
- 정규식에 «글자 뒤 `\n`» 금지(`\r?\n`).
- 작업트리는 CRLF 다(`core.autocrlf=true`, 기존 html·js 모두 CRLF). 새 파일은 LF 로 써도 커밋 때 LF 로 정규화되므로 그대로 둔다. 기존 파일을 고칠 때는 줄 끝을 바꾸지 않는다(Edit 도구는 그대로 둔다).
- 공용 js 를 고치면 그 js 를 부르는 **모든** html 의 `?v=` 를 같은 커밋에서 올린다(pre-commit 훅 `scripts/check-cache-version.js`, 검사 `tests/shared-js-cache-version.test.js` — 파일마다 번호는 하나). `--no-verify` 금지.
- 커밋 메시지는 한국어, 끝에 빈 줄 + `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. 이 방의 Bash 는 따옴표를 씹으므로 커밋은 PowerShell here-string 으로 한다.
- 실행: `node --test tests/<파일>.test.js`. 전체: `node --test "tests/**/*.test.js"`. 통과하는 검사 안의 `✖ 올리지 않았습니다 — 기준이 N일 된 것입니다` 줄은 날짜에 따른 잡음이라 무시한다.
- push·PR 은 컨트롤러가 한다.

## 파일 구조

| 파일 | 할 일 |
|---|---|
| `js/pu-gov-report-list.js` (새) | 순수 함수: `reportKeys` · `buildRows` · `statusOf` · `kpis` · `filterRows` · `alerts` · `formsStatus` · `reportHref` · `staffIdFor` · `staffNames` · `yearsOf` · `dayOf` · `daysBetween` |
| `tests/helpers/gov-report-fixture.js` (새) | 합성 자료 한 벌(모듈 검사·화면 검사가 함께 쓴다) |
| `tests/gov-report-list.test.js` (새) | 모듈 검사 |
| `gov-report.html` (새) | T2: 공통 머리만 있는 껍데기 → T3: 숫자 칸·거르개·목록·양식 서고 현황·챙길 것 |
| `tests/gov-report-app.test.js` (새) | 화면 검사(정적 + vm) |
| `enter.html`·`js/pu-appbar.js`·`js/pu-ontology.js` (고침) | 타일·앱 막대 줄·등록부 |
| html 23개 (고침) | `pu-ontology.js?v=57→58` · `pu-appbar.js?v=23→24` |
| `tests/color-palette-apps.test.js` (고침) | 새 화면을 `DONE`·`EXCEPT`(빈 집합)에 |
| `gov-consulting.html` (고침) | `linkRpt`·`openFromReportLink`·`openFormsFromLink` + 시작 때 부르기 |
| `tests/gov-report-deeplink.test.js` (새) | 건너오기 검사 |
| `STATUS.md` (고침), `status/2026-10-10-gov-report-app.md` (새) | 기록 |

## 자료 꼴 (모든 작업 공통)

읽은 값(배열 또는 번호 객체 — `list()` 가 둘 다 받는다)
```js
scal_cos    [{ id, name, types:['t1'], defAtt:'a1', defCoAtts:['a2'], endedTypes:{t1:'2026-09-01'}, customRounds:{t1:3}, deleted:false }]
scal_types  [{ id, name, fullName, agency, rounds }]
scal_scheds [{ id, coId, typeId, date:'2026-06-02', round:1, isField:true, phase:'pre'|'main'|undefined, attId, coAttIds }]
scal_staff  [{ id:'a1', name:'홍길동' }]
scal_reports/{coId}/{rid} = { formKey, typeId, state:'초안'|'검토완료', ver, updatedAt(ms), updatedBy, aiFields:[…], report:{…} }
scal_rptFormsIndex = { [formKey]: { [fileKey]: { [YYYY]: { at, size, name, by } } } }
data/user_dir = [{ sid:'P-009', name:'홍길동', status }]  또는 { v:[…] }
```

`buildRows(input)` 의 `input` = `{ cos, types, scheds, staff, reports:{[coId]:{[rid]:기록}}, today:'YYYY-MM-DD' }`

줄(row)
```js
{ coId, coName, typeId, typeName, year:'2026', rid:'t1_2026', formKey:'techguard'|'', askForm:false, techguard:true,
  attIds:['a1','a2'], attNames:['홍길동','김가나'], rounds:3, maxRounds:3, lastDate:'2026-08-04',
  ended:true, endDate:'2026-09-01', state:'초안'|'검토완료'|'', ver:0, updatedAt:0, updatedBy:'', ai:false,
  st: /* statusOf(row, today) */ { key:'todo'|'wait'|'draft'|'done', label, days:number|null, ai:boolean,
        steps:[b,b,false,false], action:{ label, enabled, why } } }
```

`filterRows(rows, f)` 의 `f` = `{ year:'2026', type:'t1', att:'a1', status:'todo', co:'가나', mine:'a1' }` (빈 값은 거르지 않음)

---

### Task 1: `js/pu-gov-report-list.js` — 줄 만들기 · 상태 · 숫자 · 거르기 · 챙길 것 · 서고 현황

**Files:** Create `js/pu-gov-report-list.js` · Create `tests/helpers/gov-report-fixture.js` · Test `tests/gov-report-list.test.js`

**Interfaces:**
- Consumes: `require('./pu-gov-report-build.js').resolveFormKey(type, programName) → {formKey, ask, choices}` (Node) / `window.PuGovReportBuild` (브라우저). 검사는 `require('../js/pu-gov-report.js').FORMS` 를 쓴다.
- Produces (`window.PuGovReportList` / `module.exports`):
  - `reportKeys(input) → [{coId, typeId, year, rid}]` — 저장본을 읽을 자리(T3 `grLoad`)
  - `buildRows(input) → row[]` (차례: 미작성 → 초안 → 작성 전 → 검토완료, 같은 상태는 날수 많은 것 먼저, 그다음 업체 이름)
  - `statusOf(row, today) → st`
  - `kpis(rows) → {all, todo, wait, draft, done, signed:0, submitted:0}`
  - `filterRows(rows, f) → row[]`
  - `alerts(rows, today) → {unwritten:row[], staleDraft:row[], waitSign:[], total}`
  - `formsStatus(index, FORMS) → [{formKey, name, agency, ready, files:[{fileKey, label, years:['2025','2024'], latest}]}]`
  - `reportHref(coId, typeId) → 'gov-consulting.html#rpt=…|…'` · 상수 `FORMS_HREF = 'gov-consulting.html#forms'`
  - `staffIdFor(staff, roster, email) → 'a1'|''` · `staffNames(staff) → {id:name}` · `yearsOf(rows, today) → ['2026','2025']`
  - `dayOf(ms) → 'YYYY-MM-DD'(서울)` · `daysBetween(from, to) → number|null`
  - 상수 `UNWRITTEN_DAYS`(14) · `DRAFT_DAYS`(7) · `STATUS_KO` · `FILE_KO`

- [ ] **Step 1: 합성 자료 한 벌** — `tests/helpers/gov-report-fixture.js` (새)

```js
'use strict';
/* 컨설팅보고서 앱 검사용 합성 자료 (2026-10-10) — 공개 저장소다, 실제 업체·사람 이름을 넣지 않는다.
 * 오늘 = 2026-10-10
 *   c1 가나상사 · t1 기술보호 2026 — 3회 끝, 종료 표시 2026-09-01, 저장본 초안(9/20 고침, AI 칸 있음) → 초안 20일
 *   c1 가나상사 · t2 일터혁신 2026 — 대형이라 줄이 없다
 *   c2 다라정밀 · t3 충남북부 인사노무 2026 — 3회 중 2회 → 작성 전 (부담당 a1)
 *   c3 마바산업 · t4 상공회의소 인사노무 2026 — 3/3 회 끝(종료 표시 없음), 양식 고르기(ask) → 미작성 151일
 *   c4 지운업체 · t1 — 지운 업체라 줄이 없다
 *   c5 사아테크 · t1 기술보호 2025 — 검토완료 v2 */
function seed() {
  return {
    scal_staff: [{ id: 'a1', name: '홍길동' }, { id: 'a2', name: '김가나' }],
    scal_types: [
      { id: 't1', name: '기술보호', fullName: '기술보호 컨설팅', agency: '', rounds: 3 },
      { id: 't2', name: '일터혁신', fullName: '일터혁신 컨설팅', agency: '', rounds: 8 },
      { id: 't3', name: '인사노무', fullName: '충남북부 인사노무 컨설팅', agency: '', rounds: 3 },
      { id: 't4', name: '상공회의소 인사노무', fullName: '', agency: '상공회의소', rounds: 3 },
    ],
    scal_cos: [
      { id: 'c1', name: '가나상사', types: ['t1', 't2'], defAtt: 'a1', endedTypes: { t1: '2026-09-01' } },
      { id: 'c2', name: '다라정밀', types: ['t3'], defAtt: 'a2', defCoAtts: ['a1'] },
      { id: 'c3', name: '마바산업', types: ['t4'], defAtt: 'a2' },
      { id: 'c4', name: '지운업체', types: ['t1'], defAtt: 'a1', deleted: true },
      { id: 'c5', name: '사아테크', types: ['t1'], defAtt: 'a1', endedTypes: { t1: '2025-06-30' } },
    ],
    scal_scheds: [
      { id: 's0', coId: 'c1', typeId: 't1', date: '2026-05-20', round: 1, phase: 'pre', isField: true },
      { id: 's1', coId: 'c1', typeId: 't1', date: '2026-06-02', round: 1, isField: true },
      { id: 's2', coId: 'c1', typeId: 't1', date: '2026-07-07', round: 2, isField: false },
      { id: 's3', coId: 'c1', typeId: 't1', date: '2026-08-04', round: 3, isField: true },
      { id: 's4', coId: 'c1', typeId: 't2', date: '2026-05-01', round: 1, isField: true },
      { id: 's5', coId: 'c2', typeId: 't3', date: '2026-08-10', round: 1, isField: true },
      { id: 's6', coId: 'c2', typeId: 't3', date: '2026-09-14', round: 2, isField: true },
      { id: 's7', coId: 'c3', typeId: 't4', date: '2026-03-03', round: 1, isField: true },
      { id: 's8', coId: 'c3', typeId: 't4', date: '2026-04-07', round: 2, isField: false },
      { id: 's9', coId: 'c3', typeId: 't4', date: '2026-05-12', round: 3, isField: true },
      { id: 's10', coId: 'c4', typeId: 't1', date: '2026-04-01', round: 1, isField: true },
      { id: 's11', coId: 'c5', typeId: 't1', date: '2025-04-01', round: 1, isField: true },
      { id: 's12', coId: 'c5', typeId: 't1', date: '2025-05-06', round: 2, isField: true },
      { id: 's13', coId: 'c5', typeId: 't1', date: '2025-06-03', round: 3, isField: true },
    ],
    scal_reports: {
      c1: {
        t1_2026: { formKey: 'techguard', typeId: 't1', state: '초안', ver: 0, updatedAt: Date.UTC(2026, 8, 20, 3),
          updatedBy: '홍길동', aiFields: ['summary.overall'], report: { summary: { overall: '본문은 목록에 나오면 안 된다' } } },
      },
      c5: {
        t1_2025: { formKey: 'techguard', typeId: 't1', state: '검토완료', ver: 2, updatedAt: Date.UTC(2025, 6, 10, 3),
          updatedBy: '홍길동', report: {} },
        t1_2025_v2: { formKey: 'techguard', state: '검토완료', ver: 2, report: {} },
      },
    },
    scal_rptFormsIndex: {
      techguard: { main: { 2024: { at: 1, size: 3, name: 'a.hwpx' } } },
      'cci-seosan': { visit: { 2024: { at: 1, size: 3, name: 'v.hwpx' } } },
    },
    data: { user_dir: [{ sid: 'P-009', name: '홍길동', status: 'active' }, { sid: 'P-010', name: '김가나', status: 'retired' }] },
  };
}
/* 모듈 입력 꼴로 */
function input(today) {
  const s = seed();
  return { cos: s.scal_cos, types: s.scal_types, scheds: s.scal_scheds, staff: s.scal_staff,
    reports: s.scal_reports, today: today || '2026-10-10' };
}
module.exports = { seed, input };
```

- [ ] **Step 2: 실패하는 검사 작성** — `tests/gov-report-list.test.js` (새)

```js
'use strict';
/* 컨설팅보고서 앱 — 현황판 순수 함수 (2026-10-10)
 * ★ 지키는 것: 줄 열쇠는 정부사업일정과 같다(rid=사업_첫회차해) · 간단형만 · 상태 차례 · 본문은 줄에 안 담는다
 * 공개 저장소다 — 합성 자료만(tests/helpers/gov-report-fixture.js). */
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../js/pu-gov-report-list.js');
const Rpt = require('../js/pu-gov-report.js');
const F = require('./helpers/gov-report-fixture.js');

const T = '2026-10-10';
const rowsAll = () => L.buildRows(F.input(T));
const key = (r) => r.coId + '/' + r.typeId;

test('reportKeys — 간단형 후보만, 열쇠는 사업_첫회차해(사전진단 뺌)', () => {
  assert.deepEqual(L.reportKeys(F.input(T)).map((x) => x.coId + '/' + x.rid),
    ['c1/t1_2026', 'c2/t3_2026', 'c3/t4_2026', 'c5/t1_2025']);
});

test('buildRows — 대형·지운 업체는 줄이 없고, 차례는 미작성 → 초안 → 작성 전 → 검토완료', () => {
  const rows = rowsAll();
  assert.deepEqual(rows.map(key), ['c3/t4', 'c1/t1', 'c2/t3', 'c5/t1']);
  assert.deepEqual(rows.map((r) => r.st.key), ['todo', 'draft', 'wait', 'done']);
});

test('buildRows — 줄에는 이름·상태만, 보고서 본문은 없다', () => {
  const all = JSON.stringify(rowsAll());
  assert.ok(!all.includes('본문은 목록에 나오면 안 된다'));
  const c1 = rowsAll().find((r) => r.coId === 'c1');
  assert.equal(c1.rid, 't1_2026');
  assert.equal(c1.formKey, 'techguard');
  assert.equal(c1.techguard, true);
  assert.deepEqual(c1.attNames, ['홍길동']);
  assert.equal(c1.rounds, 3);
  assert.equal(c1.ai, true);
});

test('buildRows — 담당은 주담당+부담당, 양식이 애매하면 askForm', () => {
  const rows = rowsAll();
  const c2 = rows.find((r) => r.coId === 'c2');
  assert.deepEqual(c2.attIds, ['a2', 'a1']);
  assert.deepEqual(c2.attNames, ['김가나', '홍길동']);
  assert.equal(c2.formKey, 'cci-north');
  const c3 = rows.find((r) => r.coId === 'c3');
  assert.equal(c3.formKey, '');
  assert.equal(c3.askForm, true);
});

test('statusOf — 넷 갈래와 단추', () => {
  const by = Object.fromEntries(rowsAll().map((r) => [r.coId, r.st]));
  assert.equal(by.c3.label, '미작성');
  assert.equal(by.c3.days, 151, '마지막 회차 2026-05-12 부터');
  assert.deepEqual(by.c3.action, { label: '📄 작성', enabled: true, why: '' });
  assert.equal(by.c1.label, '초안');
  assert.equal(by.c1.days, 20, '9/20 에 고침');
  assert.equal(by.c1.ai, true);
  assert.deepEqual(by.c1.steps, [true, false, false, false]);
  assert.equal(by.c1.action.label, '이어 쓰기');
  assert.equal(by.c2.label, '작성 전');
  assert.deepEqual(by.c2.action, { label: '📄 작성', enabled: false, why: '회차가 남았습니다' });
  assert.equal(by.c5.label, '검토완료 v2');
  assert.deepEqual(by.c5.steps, [true, true, false, false]);
  assert.equal(by.c5.action.label, '⬇ HWPX');
});

test('statusOf — 종료 표시가 있으면 회차 수와 상관없이 미작성, 날수는 종료일부터', () => {
  const st = L.statusOf({ state: '', ended: true, endDate: '2026-10-01' }, T);
  assert.equal(st.key, 'todo');
  assert.equal(st.days, 9);
  assert.equal(L.statusOf({ state: '검토완료', ver: 3 }, T).label, '검토완료 v3');
  assert.equal(L.statusOf({ state: '초안', updatedAt: 0 }, T).days, null, '고친 날을 모르면 세지 않는다');
});

test('kpis — 서명·제출은 이번에는 0', () => {
  assert.deepEqual(L.kpis(rowsAll()), { all: 4, todo: 1, wait: 1, draft: 1, done: 1, signed: 0, submitted: 0 });
  assert.deepEqual(L.kpis([]), { all: 0, todo: 0, wait: 0, draft: 0, done: 0, signed: 0, submitted: 0 });
});

test('filterRows — 연도·사업·담당·상태·업체·내 담당', () => {
  const rows = rowsAll();
  const ks = (f) => L.filterRows(rows, f).map(key);
  assert.deepEqual(ks({ year: '2026' }), ['c3/t4', 'c1/t1', 'c2/t3']);
  assert.deepEqual(ks({ year: '2025' }), ['c5/t1']);
  assert.deepEqual(ks({ year: '2026', mine: 'a1' }), ['c1/t1', 'c2/t3'], '부담당도 내 담당');
  assert.deepEqual(ks({ att: 'a2' }), ['c3/t4', 'c2/t3']);
  assert.deepEqual(ks({ status: 'todo' }), ['c3/t4']);
  assert.deepEqual(ks({ co: '다라' }), ['c2/t3']);
  assert.deepEqual(ks({ type: 't1' }), ['c1/t1', 'c5/t1']);
  assert.deepEqual(ks({}), rows.map(key));
});

test('alerts — 종료 14일 넘은 미작성 · 7일 넘은 초안 · 서명 기다림은 0', () => {
  const a = L.alerts(L.filterRows(rowsAll(), { year: '2026' }), T);
  assert.deepEqual(a.unwritten.map(key), ['c3/t4']);
  assert.deepEqual(a.staleDraft.map(key), ['c1/t1']);
  assert.deepEqual(a.waitSign, []);
  assert.equal(a.total, 2);
  /* 경계 — 「넘은」이므로 딱 14일·7일은 아니다 */
  const edge = [{ coId: 'x', typeId: 'y', coName: '가', state: '', ended: true, endDate: '2026-09-26' },
    { coId: 'x', typeId: 'z', coName: '가', state: '초안', updatedAt: Date.UTC(2026, 9, 3, 3) }];
  assert.equal(L.alerts(edge, T).total, 0);
});

test('formsStatus — 양식·파일·연도별 등록 상태(읽기)', () => {
  const s = F.seed();
  const fs = L.formsStatus(s.scal_rptFormsIndex, Rpt.FORMS);
  assert.deepEqual(fs.map((x) => x.formKey), Object.keys(Rpt.FORMS));
  const tg = fs.find((x) => x.formKey === 'techguard');
  assert.equal(tg.name, Rpt.FORMS.techguard.name);
  assert.deepEqual(tg.files.map((f) => [f.fileKey, f.label, f.years, f.latest]), [['main', '본문', ['2024'], '2024']]);
  assert.equal(tg.ready, true);
  const ss = fs.find((x) => x.formKey === 'cci-seosan');
  assert.equal(ss.ready, false, '결과보고서 양식이 없다');
  assert.ok(ss.files.some((f) => f.fileKey === 'visit' && f.latest === '2024'));
  assert.ok(L.formsStatus(null, Rpt.FORMS).every((x) => x.files.every((f) => f.years.length === 0)));
});

test('reportHref · FORMS_HREF — 정부사업일정 보고서 창으로', () => {
  assert.equal(L.reportHref('c1', 't1'), 'gov-consulting.html#rpt=c1|t1');
  assert.equal(L.reportHref('a b', 't/1'), 'gov-consulting.html#rpt=a%20b|t%2F1');
  assert.equal(L.FORMS_HREF, 'gov-consulting.html#forms');
});

test('staffIdFor — 로그인 메일 → 명부(사번) → 담당자 번호(정부사업일정과 같은 길)', () => {
  const s = F.seed();
  assert.equal(L.staffIdFor(s.scal_staff, s.data.user_dir, 'P009@pureun.kr'), 'a1');
  assert.equal(L.staffIdFor(s.scal_staff, { v: s.data.user_dir }, 'p009@pureun.kr'), 'a1', '명부가 {v:[…]} 꼴이어도');
  assert.equal(L.staffIdFor(s.scal_staff, s.data.user_dir, 'p010@pureun.kr'), '', '퇴직자는 아니다');
  assert.equal(L.staffIdFor(s.scal_staff, s.data.user_dir, 'nobody@example.com'), '');
  assert.equal(L.staffIdFor(s.scal_staff, null, ''), '');
});

test('yearsOf · staffNames · dayOf', () => {
  assert.deepEqual(L.yearsOf(rowsAll(), T), ['2026', '2025']);
  assert.deepEqual(L.yearsOf([], T), ['2026'], '줄이 없어도 올해는 있다');
  assert.deepEqual(L.staffNames(F.seed().scal_staff), { a1: '홍길동', a2: '김가나' });
  assert.equal(L.dayOf(Date.UTC(2026, 8, 19, 16)), '2026-09-20', '서울 날짜');
  assert.equal(L.dayOf(0), '');
});
```

- [ ] **Step 3: 실패 확인**

Run: `node --test tests/gov-report-list.test.js`
Expected: FAIL — `Cannot find module '../js/pu-gov-report-list.js'`

- [ ] **Step 4: 구현** — `js/pu-gov-report-list.js` (새)

```js
'use strict';
/* 컨설팅보고서 앱(gov-report.html) — 보고서 현황판의 순수 함수 (브라우저 window.PuGovReportList / Node 겸용)
   (대표 지시 2026-10-10 「포털 의뢰인 업무에 별도 앱을 만들어 진행」 · 설계 docs/superpowers/specs/2026-10-10-gov-report-app-design.md
    · 계획 docs/superpowers/plans/2026-10-10-gov-report-app.md)
   무엇을 지키나
     · 읽기만 한다 — 받은 값으로 줄을 만들 뿐 아무 데도 쓰지 않는다.
     · 줄 열쇠는 정부사업일정과 같다 — rid = 사업번호_연도, 연도 = 사전진단 뺀 첫 회차의 해(gov-consulting grpYearOf).
       어긋나면 이 화면의 「초안」과 보고서 창의 초안이 서로 다른 자리를 본다.
     · 간단형 양식만 줄이 생긴다 — resolveFormKey 가 양식을 고르거나(ask 포함) 저장본에 formKey 가 있을 때.
       이알피 사업명(programName)은 넘기지 않는다 — 이알피 계약을 읽지 않는 화면이다(종류 이름만으로 가린다).
     · 목록에는 이름·상태만 — 보고서 본문(report)은 줄에 담지 않는다.
   ⚠ 저장소는 공개다 — 검사는 합성 자료만 쓴다. */
(function (root) {
  var B = (typeof module !== 'undefined' && module.exports) ? require('./pu-gov-report-build.js') : root.PuGovReportBuild;

  var UNWRITTEN_DAYS = 14;   // 종료 뒤 이만큼 «넘게» 미작성이면 ⏰
  var DRAFT_DAYS = 7;        // 초안이 이만큼 «넘게» 묵으면 ⏰
  var ORDER = { todo: 0, draft: 1, wait: 2, done: 3 };
  var STATUS_KO = { todo: '미작성', wait: '작성 전', draft: '초안', done: '검토완료' };
  /* gov-consulting.html GRP_FILE_KO 와 같은 이름 — 서고 창과 이 화면이 같은 말을 쓴다 */
  var FILE_KO = { main: '본문', visit: '업체 방문 확인서', report: '결과보고서' };
  var REPORT_PAGE = 'gov-consulting.html';
  var FORMS_HREF = REPORT_PAGE + '#forms';

  function str(v) { return v == null ? '' : String(v).trim(); }
  /* 정부사업일정은 배열로 쓰지만 DB 가 번호 객체로 돌려줄 때도 있다 — 둘 다 받는다 */
  function list(v) {
    var a = Array.isArray(v) ? v : (v && typeof v === 'object' ? Object.keys(v).map(function (k) { return v[k]; }) : []);
    return a.filter(function (x) { return x && x.id; });
  }
  function isDay(d) { return /^\d{4}-\d{2}-\d{2}$/.test(str(d)); }
  function dayNum(d) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str(d));
    return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) / 864e5 : NaN;
  }
  function daysBetween(from, to) { var n = dayNum(to) - dayNum(from); return isFinite(n) ? n : null; }
  /* 저장 시각(ms) → 서울 날짜 */
  function dayOf(ms) { var n = Number(ms || 0); if (!n) return ''; return new Date(n + 9 * 3600e3).toISOString().slice(0, 10); }
  /* gov-consulting getCoAtts 와 같은 차례 */
  function coAtts(o) {
    if (!o) return [];
    if (Array.isArray(o.coAttIds)) return o.coAttIds.filter(Boolean);
    if (Array.isArray(o.defCoAtts)) return o.defCoAtts.filter(Boolean);
    if (o.coAttId) return [o.coAttId];
    if (o.defCoAtt) return [o.defCoAtt];
    return [];
  }
  function uniq(a) { var seen = {}; return a.filter(function (x) { if (!x || seen[x]) return false; seen[x] = 1; return true; }); }
  /* gov-consulting getCoMaxRounds 와 같다 — 사업장 값이 먼저 */
  function maxRounds(co, t) {
    var v = co.customRounds && co.customRounds[t.id];
    if (v !== undefined && v !== null && v !== '') return +v || 0;
    return +t.rounds || 0;
  }

  /* 업체×사업 후보 — 회차(사전진단 뺀)가 하나라도 있는 것 */
  function candidates(input) {
    input = input || {};
    var types = {};
    list(input.types).forEach(function (t) { types[t.id] = t; });
    var scheds = list(input.scheds).filter(function (s) { return s.phase !== 'pre' && isDay(s.date); });
    var out = [];
    list(input.cos).forEach(function (co) {
      if (co.deleted) return;
      (Array.isArray(co.types) ? co.types : []).forEach(function (tid) {
        var t = types[tid]; if (!t) return;
        var sc = scheds.filter(function (s) { return s.coId === co.id && s.typeId === tid; });
        if (!sc.length) return;
        var ds = sc.map(function (s) { return str(s.date); }).sort();
        var year = ds[0].slice(0, 4);
        out.push({ co: co, type: t, scheds: sc, dates: ds, year: year, rid: String(tid) + '_' + year,
          fk: B.resolveFormKey(t, '') });
      });
    });
    return out;
  }
  function reportKeys(input) {
    return candidates(input).filter(function (c) { return c.fk.formKey || c.fk.ask; })
      .map(function (c) { return { coId: c.co.id, typeId: c.type.id, year: c.year, rid: c.rid }; });
  }

  function statusOf(row, today) {
    row = row || {};
    var s;
    if (row.state === '검토완료') {
      s = { key: 'done', label: '검토완료 v' + (Number(row.ver) || 0), days: null, steps: [true, true, false, false],
        action: { label: '⬇ HWPX', enabled: true, why: '보고서 창을 열어 내려받습니다' } };
    } else if (row.state) {
      s = { key: 'draft', label: '초안', days: daysBetween(dayOf(row.updatedAt), today), steps: [true, false, false, false],
        action: { label: '이어 쓰기', enabled: true, why: '' } };
    } else if (row.ended) {
      s = { key: 'todo', label: '미작성', days: daysBetween(row.endDate, today), steps: [false, false, false, false],
        action: { label: '📄 작성', enabled: true, why: '' } };
    } else {
      s = { key: 'wait', label: '작성 전', days: null, steps: [false, false, false, false],
        action: { label: '📄 작성', enabled: false, why: '회차가 남았습니다' } };
    }
    s.ai = s.key === 'draft' && !!row.ai;
    return s;
  }

  function buildRows(input) {
    input = input || {};
    var today = str(input.today);
    var names = staffNames(input.staff);
    var reps = input.reports || {};
    var rows = [];
    candidates(input).forEach(function (c) {
      var saved = (reps[c.co.id] && reps[c.co.id][c.rid]) || null;
      var formKey = str(saved && saved.formKey) || str(c.fk.formKey);
      if (!formKey && !c.fk.ask) return;
      var maxR = maxRounds(c.co, c.type);
      var last = c.dates[c.dates.length - 1];
      var endedAt = str(c.co.endedTypes && c.co.endedTypes[c.type.id]);
      var ended = !!endedAt || (maxR > 0 && c.scheds.length >= maxR && !!today && last <= today);
      var attIds = uniq([str(c.co.defAtt)].concat(coAtts(c.co)));
      rows.push({
        coId: c.co.id, coName: str(c.co.name), typeId: c.type.id, typeName: str(c.type.fullName) || str(c.type.name),
        year: c.year, rid: c.rid, formKey: formKey, askForm: !formKey, techguard: formKey === 'techguard',
        attIds: attIds, attNames: attIds.map(function (id) { return names[id] || ''; }).filter(Boolean),
        rounds: c.scheds.length, maxRounds: maxR, lastDate: last, ended: ended, endDate: ended ? (endedAt || last) : '',
        state: saved ? (str(saved.state) || '초안') : '', ver: Number(saved && saved.ver) || 0,
        updatedAt: Number(saved && saved.updatedAt) || 0, updatedBy: str(saved && saved.updatedBy),
        ai: !!(saved && Array.isArray(saved.aiFields) && saved.aiFields.length)
      });
    });
    rows.forEach(function (r) { r.st = statusOf(r, today); });
    rows.sort(function (a, b) {
      return (ORDER[a.st.key] - ORDER[b.st.key]) || ((b.st.days || 0) - (a.st.days || 0))
        || a.coName.localeCompare(b.coName, 'ko') || a.typeName.localeCompare(b.typeName, 'ko');
    });
    return rows;
  }

  function kpis(rows) {
    var k = { all: 0, todo: 0, wait: 0, draft: 0, done: 0, signed: 0, submitted: 0 };
    (rows || []).forEach(function (r) {
      k.all++;
      var key = (r.st || statusOf(r, '')).key;
      if (k[key] != null) k[key]++;
    });
    return k;   // ③ 서명 ④ 제출은 이번 범위 밖 — 늘 0
  }

  function filterRows(rows, f) {
    f = f || {};
    var q = str(f.co).toLowerCase();
    return (rows || []).filter(function (r) {
      if (f.year && r.year !== String(f.year)) return false;
      if (f.type && r.typeId !== f.type) return false;
      if (f.att && (r.attIds || []).indexOf(f.att) < 0) return false;
      if (f.mine && (r.attIds || []).indexOf(f.mine) < 0) return false;
      if (f.status && (r.st || statusOf(r, '')).key !== f.status) return false;
      if (q && str(r.coName).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
  }

  function alerts(rows, today) {
    var unwritten = [], staleDraft = [];
    (rows || []).forEach(function (r) {
      var s = statusOf(r, today);
      if (s.key === 'todo' && s.days != null && s.days > UNWRITTEN_DAYS) unwritten.push(r);
      if (s.key === 'draft' && s.days != null && s.days > DRAFT_DAYS) staleDraft.push(r);
    });
    var by = function (a, b) { return statusOf(b, today).days - statusOf(a, today).days; };
    unwritten.sort(by); staleDraft.sort(by);
    return { unwritten: unwritten, staleDraft: staleDraft, waitSign: [], total: unwritten.length + staleDraft.length };
  }

  function formsStatus(index, FORMS) {
    var idx = (index && typeof index === 'object') ? index : {};
    return Object.keys(FORMS || {}).map(function (fk) {
      var f = FORMS[fk] || {};
      var files = Object.keys(f.files || {}).map(function (fl) {
        var got = (idx[fk] || {})[fl] || {};
        var years = Object.keys(got).filter(function (y) { return got[y] && /^\d{4}$/.test(y); }).sort().reverse();
        return { fileKey: fl, label: FILE_KO[fl] || fl, years: years, latest: years[0] || '' };
      });
      return { formKey: fk, name: str(f.name), agency: str(f.agency), files: files,
        ready: files.length > 0 && files.every(function (x) { return x.years.length > 0; }) };
    });
  }

  function reportHref(coId, typeId) {
    return REPORT_PAGE + '#rpt=' + encodeURIComponent(str(coId)) + '|' + encodeURIComponent(str(typeId));
  }

  function staffNames(staff) {
    var o = {};
    list(staff).forEach(function (s) { o[s.id] = str(s.name); });
    return o;
  }
  /* gov-consulting 포털 연동 로그인과 같은 길 — 메일 = 사번(하이픈 뺀 소문자)@pureun.kr → 명부 이름 → 담당자 번호 */
  function staffIdFor(staff, roster, email) {
    var em = str(email).toLowerCase();
    if (!em) return '';
    var r = (roster && !Array.isArray(roster) && roster.v !== undefined) ? roster.v : roster;
    var accts = Array.isArray(r) ? r : (r && typeof r === 'object' ? Object.keys(r).map(function (k) { return r[k]; }) : []);
    var acct = accts.filter(function (a) {
      return a && (str(a.sid).toLowerCase().replace(/-/g, '') + '@pureun.kr') === em;
    })[0];
    if (!acct || acct.status === 'retired') return '';
    var st = list(staff).filter(function (s) { return str(s.name) === str(acct.name); })[0];
    return st ? st.id : '';
  }
  function yearsOf(rows, today) {
    var seen = {};
    (rows || []).forEach(function (r) { if (r && r.year) seen[r.year] = 1; });
    if (str(today).length >= 4) seen[str(today).slice(0, 4)] = 1;
    return Object.keys(seen).sort().reverse();
  }

  var api = { reportKeys: reportKeys, buildRows: buildRows, statusOf: statusOf, kpis: kpis, filterRows: filterRows,
    alerts: alerts, formsStatus: formsStatus, reportHref: reportHref, staffIdFor: staffIdFor, staffNames: staffNames,
    yearsOf: yearsOf, dayOf: dayOf, daysBetween: daysBetween,
    FORMS_HREF: FORMS_HREF, STATUS_KO: STATUS_KO, FILE_KO: FILE_KO, UNWRITTEN_DAYS: UNWRITTEN_DAYS, DRAFT_DAYS: DRAFT_DAYS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PuGovReportList = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
```

- [ ] **Step 5: 통과 확인**

Run: `node --test tests/gov-report-list.test.js`
Expected: PASS (13 tests). 날수가 틀리면 고정 날짜(`T`)·`Date.UTC` 달(0부터) 을 먼저 의심한다.

- [ ] **Step 6: 커밋** (PowerShell)

```powershell
git add js/pu-gov-report-list.js tests/gov-report-list.test.js tests/helpers/gov-report-fixture.js
git commit -m @'
feat(gov-report): 컨설팅보고서 현황판 모듈 — 줄·상태·숫자·거르기·챙길 것·서고 현황

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
'@
```

---

### Task 2: 포털 연결 — 타일 · 앱 막대 · 등록부 · 캐시 번호 + 껍데기 `gov-report.html`

**Files:**
- Create `gov-report.html` (공통 머리 + 잠금 + 「불러오는 중」 자리 — T3 가 몸통을 채운다)
- Modify `enter.html` (`var APPS` 의 `consult` 줄 바로 뒤, ~1525)
- Modify `js/pu-appbar.js` (`var APPS` 의 `consult` 줄 바로 뒤, ~44)
- Modify `js/pu-ontology.js` (`PROGRAMS.consult` 바로 뒤 ~154 · `READ_ADAPTERS.consult_core` 바로 뒤 ~442)
- Modify html 23개 — `js/pu-ontology.js?v=57` → `58`, html 17개 — `js/pu-appbar.js?v=23` → `24`
- Modify `tests/color-palette-apps.test.js` (`DONE`·`EXCEPT`)

**Interfaces:**
- Consumes: 없음(T1 모듈은 T3 에서 싣는다)
- Produces: 포털 키 `govreport`, 파일 `gov-report.html`, 등록부 `PROGRAMS.govreport`. 화면 안 자리(T3 가 쓴다): `#who`·`#outBtn`·`#lock`/`#lockWhy`·`#app`, 전역 `fbDb`·`grBoot()`.

새 앱이 지켜야 하는 검사와 이 작업이 하는 일

| 검사 | 새 화면·타일에 필요한 것 |
|---|---|
| `appbar-coverage` | 포털 `url` 과 앱 막대 `url` 이 짝 · 화면이 `pu-appbar.js` 를 싣는다 |
| `appbar-every-link` | 앱 막대 줄을 누르면 `gov-report.html` 이 열리고 `whoAmI()==='govreport'`(파일 이름으로 가린다 — 줄만 맞으면 된다) |
| `back-button` | `src="js/pu-back.js?v=2"` + `PuBack.guard(` (popstate 를 안 쓰므로 깃발 필요 없음) |
| `ls-guard` | `pu-ontology-write.js` 를 싣는 화면이라 `<script src="js/pu-ls-guard.js?v=4"></script>` |
| `logout-why` | `.signOut()` 이 있으니 `<script src="js/pu-logout-why.js?v=1"></script>` |
| `logout-gate` | `js/pu-gate.js` 싣기 + `PuGate.show(` |
| `whoami-no-overlap` | `pu-whoami.js` 를 실으면 `PuWhoami.mount(` |
| `authsync-global-logout` | 해당 없음 — `pu-authsync.js` 를 안 싣는다(`rehab-ad.html` 과 같음) |
| `app-soon-gate`·`portal-soon-locked` | 해당 없음 — `soon` 딱지를 달지 않는다(설계서에 준비중 지시 없음). 단 `pu-gate.js?v=3` 번호를 다른 화면과 같게 |
| `shared-js-cache-version` | 모든 `js/` 를 `?v=` 로, 번호는 파일마다 하나(ontology 58·appbar 24 를 23·17 화면과 새 화면이 같이) |
| `portal-admin-tiles` | 해당 없음 — `adminOnly` 가 아니다(직원 모두 본다) |
| `portal-rows-inout` | `row:'client'`(있는 줄) |
| `app-icons` | 📑 가 다른 타일 그림과 안 겹친다(지금 안 쓰임). manifest 검사 목록(`APPS`)에는 안 든다 — 탭 그림글자만 단다 |
| `color-palette-apps` | `DONE` 에 `['gov-report.html','컨설팅보고서']`, `EXCEPT` 에 빈 집합. 예외 개수 72 그대로 |
| `html-inline-script-syntax` | 모든 인라인 `<script>` 가 문법으로 읽힌다 |
| `ontology-contract`·`ontology-registry`·`ontology-write-gate` | 등록부 `govreport`(소유 자리·개체어·쓰기 선언·읽기 어댑터) · 화면이 `pu-ontology.js?v=` → `pu-ontology-write.js?v=… data-mode="observe"` 를 `firebase.initializeApp` 앞에 · 화면이 `ref('글자')` 로 부르는 뿌리는 모두 주인이 있다 |
| `read-fence-apps`·`rrn-seal`·`pair-guards`·`appcheck-off`·`erp-big-store`·`one-line-cells` | 해당 없음 — 판독(`pu-doc-read`)·백업(`pu-backup`)·사진 저장층·App Check·이알피 표 빌려 읽기·`h('td'` 를 안 쓴다. 전체 검사에서 초록인지만 본다 |
| `show-my-name` | 해당 없음(파일을 못 박아 둔 검사) — `#who` 에 `PuWhoami.mount('#who')` 로 이름이 뜬다 |

- [ ] **Step 1: 검사가 새 타일을 기다리게 만든다** — `tests/color-palette-apps.test.js`

`DONE` 의 `['rehab-ad.html', '회생광고'],` 다음 줄에

```js
  ['gov-report.html', '컨설팅보고서'],
```

`EXCEPT` 의 `'install.html': new Set([]),` 다음 줄에

```js
  /* 컨설팅보고서(2026-10-10) — 처음부터 팔레트만 쓴다. 예외를 채워 넣지 말 것 */
  'gov-report.html': new Set([]),
```

- [ ] **Step 2: 실패 확인**

Run: `node --test tests/color-palette-apps.test.js`
Expected: FAIL — `ENOENT … gov-report.html`

- [ ] **Step 3: 포털 타일** — `enter.html`, 이 줄 바로 뒤에

```js
    { key:'consult', name:'정부사업일정',  desc:'보고서 일정및사진관리',    icon:'📅', url:'gov-consulting.html', roles:null, row:'client' },
```

다음을 넣는다.

```js
    /* 컨설팅보고서 — 모든 사업장·사업의 보고서 상태를 한눈에(대표 지시 2026-10-10 「포털 의뢰인 업무에 별도 앱을 만들어 진행」).
       ⚠ 이 앱은 «보고 건너가는 곳»이다 — 초안·AI·HWPX·확정은 정부사업일정의 보고서 창이 한다(#rpt= 로 건너감).
       직원 모두 본다(adminOnly 아님). 앱 막대(js/pu-appbar.js)와 짝이다. */
    { key:'govreport', name:'컨설팅보고서', desc:'보고서 현황·작성', icon:'📑', url:'gov-report.html',     roles:null, row:'client' },
```

- [ ] **Step 4: 앱 막대 줄** — `js/pu-appbar.js`, `{ key: 'consult', … }` 줄 바로 뒤에

```js
    /* 컨설팅보고서(2026-10-10) — 포털 타일과 짝. 쓰는 일은 정부사업일정의 보고서 창이 한다 */
    { key: 'govreport', name: '컨설팅보고서', icon: '📑', url: 'gov-report.html',     desc: '보고서 현황·작성' },
```

- [ ] **Step 5: 등록부** — `js/pu-ontology.js`

(1) `PROGRAMS.consult` 두 줄(`consult:{ … sharedRoots:['data/consultings', …], entityTypes:[…] },`) 바로 뒤에

```js
    /* 컨설팅보고서 — 모든 사업장·사업의 보고서 상태를 한눈에(대표 지시 2026-10-10 「포털 의뢰인 업무에 별도 앱」).
       ★ 읽기만 한다 — 보고서(scal_reports)·양식 서고(scal_rptForms*)·일정(scal_*)의 주인은 정부사업일정(consult)이다.
         쓰는 일(초안·AI·HWPX·확정)은 정부사업일정의 보고서 창으로 건너가서 한다(gov-consulting.html#rpt=).
       ⚠ 소유 자리 data/gov_report_view 는 «보던 자리»(거르개) 예약이다 — 등록부 계약(소유 자리·쓰기 선언 필수,
         tests/ontology-contract·ontology-write-gate)을 맞추려고 둔다. 이번 판은 쓰지 않는다(설계 §2 「아무것도 쓰지 않는다」).
         쓰게 되면 규칙(cal_view 꼴 — uid 로 가름)을 먼저 낸다.
       ⚠ scal_cos·scal_types·scal_scheds·scal_staff 는 정부사업일정이 FB_NODES 로 부르는 자리라 등록부에 주인이 아직 안 적혀 있다.
         이 화면도 같은 꼴(GR_NODES)로 부른다 — 주인 정리는 정부사업일정 몫이다(이번 범위 밖). */
    govreport:{ name:'컨설팅보고서', file:'gov-report.html', primaryRoots:['data/gov_report_view'],
      sharedRoots:['scal_cos','scal_types','scal_scheds','scal_staff','scal_reports','scal_rptFormsIndex','data/user_dir'],
      writeContracts:[{path:'data/gov_report_view/{uid}',entityType:'ViewState'}],
      entityTypes:['Organization','Project','Document','ViewState'] },
```

(2) `READ_ADAPTERS` 의 `consult_core:{…},` 줄 바로 뒤에

```js
    /* 컨설팅보고서 — 제 업무 자료가 없다(보고서는 consult 의 자리). 소유 자리는 «보던 자리» 예약뿐이라 in_app */
    govreport_view:{program:'govreport',strategy:'in_app',path:'data/gov_report_view',parser:'coverage',
      gives:'보던 거르개 자리(예약 — 이번 판은 쓰지 않는다). 보고서 상태는 정부사업일정(consult)의 자리다'},
```

- [ ] **Step 6: 껍데기 화면** — `gov-report.html` (새). 공통 머리는 `rehab-ad.html` 과 같은 차례·같은 번호다(ontology·appbar 만 새 번호).

```html
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>푸른노무법인 컨설팅보고서</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='80' font-size='80'>📑</text></svg>">
<!-- ══════════════════════════════════════════════════════════════
     푸른노무법인 컨설팅보고서 (gov-report.html) — 2026-10-10
     대표 지시 「포털 의뢰인 업무에 별도 앱을 만들어 진행」 · 시안 확인 후 「진행」.
     설계 docs/superpowers/specs/2026-10-10-gov-report-app-design.md · 계획 docs/superpowers/plans/2026-10-10-gov-report-app.md

     ★ 이 화면은 «읽기만» 한다 — 모든 사업장·사업의 보고서 상태를 보고, 쓰는 일은
       정부사업일정의 보고서 창(gov-consulting.html#rpt=업체|사업)으로 건너가서 한다.
     ★ 계산은 js/pu-gov-report-list.js(순수 함수)가 한다. 이 파일은 읽고 그린다.
     ⚠ 목록에는 업체·사업·담당 이름과 상태만 — 보고서 본문을 그리지 않는다(기술보호도 같다).
     ⚠ scal_cos 등은 GR_NODES 로 부른다(정부사업일정 FB_NODES 꼴) — 등록부 js/pu-ontology.js govreport 주석.
     ══════════════════════════════════════════════════════════════ -->
<style>
:root{
  --navy:#1e293b; --mute:#64748b; --line:#e2e8f0; --bg:#f8fafc; --card:#ffffff;
  --blue:#2563eb; --blue-bg:#eff6ff; --blue-line:#bfdbfe; --blue-ink:#1e40af;
  --green:#166534; --green-bg:#f0fdf4; --amber:#854d0e; --amber-bg:#fffbeb; --red:#991b1b; --red-bg:#fef2f2;
}
*{box-sizing:border-box}
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Malgun Gothic',sans-serif;background:var(--bg);color:var(--navy);font-size:14px}
#head{position:sticky;top:0;z-index:20;background:var(--card);box-shadow:0 1px 3px rgba(15,23,42,.06)}
.top{display:flex;align-items:center;gap:10px;padding:10px 16px;flex-wrap:wrap}
.top h1{font-size:17px;margin:0}
.top .sp{flex:1}
#who{font-size:13px;color:var(--mute)}
button{font:inherit;cursor:pointer;border:1px solid var(--line);background:var(--card);color:var(--navy);border-radius:8px;padding:6px 12px}
button:disabled{opacity:.5;cursor:default}
main{max-width:1280px;margin:0 auto;padding:14px 16px 60px}
#lock{display:none;max-width:460px;margin:60px auto;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:24px;text-align:center}
#lock p{color:var(--mute);font-size:13px}
.loading{padding:30px;text-align:center;color:var(--mute)}
</style>
</head>
<body>
<div id="head">
  <div class="top">
    <h1>📑 컨설팅보고서</h1>
    <span id="who"></span>
    <span class="sp"></span>
    <button id="outBtn" style="display:none" onclick="firebase.auth().signOut()">로그아웃</button>
  </div>
</div>

<div id="lock"><h3>열 수 없습니다</h3><p id="lockWhy"></p></div>

<main id="app" style="display:none">
  <div class="loading" id="loading">불러오는 중…</div>
</main>

<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js"></script>
<script src="js/pu-ontology.js?v=58"></script>
<script src="js/pu-ls-guard.js?v=4"></script>
<!-- ⚠ data-mode="observe" 는 «관문을 실었다»는 표시일 뿐이다 — 이 앱은 유예 목록(LEGACY_OBSERVE_PROGRAMS)에
     없으므로 관문이 «강제»(enforce)로 돈다. 이 화면은 아무것도 쓰지 않는다. -->
<script src="js/pu-ontology-write.js?v=5" data-mode="observe"></script>
<script src="js/pu-gate.js?v=3"></script>
<script src="js/pu-appbar.js?v=24"></script>
<script src="js/pu-active.js?v=1"></script><script src="js/pu-logout-why.js?v=1"></script>
<script src="js/pu-whoami.js?v=3"></script>
<script>
(function(){ function go(){ try{ if(window.PuWhoami && document.getElementById('who')){ PuWhoami.mount('#who'); return true; } }catch(e){} return false; }
  try{ if(!go()){ var n=0, iv=setInterval(function(){ if(go()||++n>40) clearInterval(iv); }, 250); } }catch(e){} })();
</script>
<script src="js/pu-back.js?v=2"></script>
<script>try{ PuBack.guard(function(){ return PuBack.closeTopVisible(); }); }catch(e){}</script>
<script>
var FB_CONFIG={apiKey:'AIzaSyDkZz5QlKSoqMOYByp5YGeMNLNDrIghliA',authDomain:'pureun-erp.firebaseapp.com',databaseURL:'https://pureun-erp-default-rtdb.asia-southeast1.firebasedatabase.app',projectId:'pureun-erp',appId:'1:936817166182:web:9bd31f70d0afdf5fca2aa7',messagingSenderId:'936817166182'};
var fbDb=null;
function $(id){ return document.getElementById(id); }
function lock(why){ $('app').style.display='none'; $('lock').style.display='block'; $('lockWhy').textContent=why||''; }
function grBoot(){
  if(location.protocol==='file:'){ lock('file:// 로 열면 로그인할 수 없습니다 — 주소로 여세요'); return; }
  if(typeof firebase==='undefined'){ lock('인터넷이 필요합니다'); return; }
  if(!firebase.apps||!firebase.apps.length) firebase.initializeApp(FB_CONFIG);
  fbDb=firebase.database();
  try{ firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL); }catch(e){}
  firebase.auth().onAuthStateChanged(function(u){
    $('outBtn').style.display=u?'':'none';
    if(!u||u.isAnonymous){ PuGate.show(); return; }
    PuGate.hide();
    $('lock').style.display='none'; $('app').style.display='';
  });
}
grBoot();
</script>
</body>
</html>
```

- [ ] **Step 7: 공용 js 번호 올리기** — 지금 번호를 먼저 확인한다(main 이 움직였으면 아래 57/23 을 그 번호로 바꾼다).

Run: `node -e "const fs=require('fs');const c={};fs.readdirSync('.').filter(f=>f.endsWith('.html')).forEach(f=>{const s=fs.readFileSync(f,'utf8');(s.match(/js\/pu-(ontology|appbar)\.js\?v=\d+/g)||[]).forEach(m=>c[m]=(c[m]||0)+1)});console.log(c)"`
Expected: `js/pu-ontology.js?v=57` 23곳 · `js/pu-appbar.js?v=23` 17곳 (새 `gov-report.html` 의 58·24 각 1곳)

번호 올리는 일회용 스크립트를 저장소 «밖»(PowerShell `$env:TEMP`)에 만든다 — CRLF 는 그대로 둔다.

```powershell
@'
const fs = require('fs'), path = require('path');
const root = process.argv[2];
const bumps = [['pu-ontology.js', 57, 58], ['pu-appbar.js', 23, 24]];
for (const f of fs.readdirSync(root).filter((x) => x.endsWith('.html'))) {
  const p = path.join(root, f); let s = fs.readFileSync(p, 'utf8'); const o = s;
  for (const [n, a, b] of bumps) s = s.split('js/' + n + '?v=' + a + '"').join('js/' + n + '?v=' + b + '"');
  if (s !== o) { fs.writeFileSync(p, s); console.log('bumped', f); }
}
'@ | Out-File -Encoding ascii "$env:TEMP\gr-bump.js"
node "$env:TEMP\gr-bump.js" (Get-Location).Path
```

Expected: `bumped …` 23줄 안팎(두 번호를 다 가진 화면은 한 줄).

- [ ] **Step 8: 통과 확인**

Run: `node --test tests/color-palette-apps.test.js tests/appbar-coverage.test.js tests/appbar-every-link.test.js tests/back-button.test.js tests/ls-guard.test.js tests/logout-why.test.js tests/logout-gate.test.js tests/whoami-no-overlap.test.js tests/app-soon-gate.test.js tests/portal-soon-locked.test.js tests/portal-admin-tiles.test.js tests/portal-rows-inout.test.js tests/app-icons.test.js tests/html-inline-script-syntax.test.js tests/ontology-contract.test.js tests/ontology-registry.test.js tests/ontology-write-gate.test.js tests/authsync-global-logout.test.js tests/enter-security.test.js tests/erp-three-apps.test.js`
그리고: `node tests/shared-js-cache-version.test.js`
Expected: 모두 PASS(`shared-js-cache-version` 은 `=== N 통과 / 0 실패 ===`).

- [ ] **Step 9: 커밋** (PowerShell) — 고친 html 이 많으므로 `git status` 로 고친 것만 보이는지 먼저 본다.

```powershell
git status --short
git add gov-report.html enter.html js/pu-appbar.js js/pu-ontology.js tests/color-palette-apps.test.js
git add -u -- "*.html"
git commit -m @'
feat(gov-report): 포털 「컨설팅보고서」 타일·앱 막대·등록부 + 화면 껍데기

- 의뢰인 업무 줄, 정부사업일정 바로 뒤(📑). 직원 모두 본다.
- 등록부 govreport — 읽기만(보고서·서고·일정은 consult 소유), 소유 자리는 보던 자리 예약.
- pu-ontology.js ?v=58 · pu-appbar.js ?v=24 (부르는 화면 모두).

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
'@
```

---

### Task 3: `gov-report.html` 화면 — 읽기 · 숫자 칸 · 거르개 · 목록 · 양식 서고 현황 · 챙길 것 · 오류/빈 상태

**Files:** Modify `gov-report.html` · Test `tests/gov-report-app.test.js` (새)

**Interfaces:**
- Consumes: T1 `PuGovReportList.{reportKeys, buildRows, kpis, filterRows, alerts, formsStatus, reportHref, staffIdFor, staffNames, yearsOf, dayOf, FORMS_HREF, UNWRITTEN_DAYS, DRAFT_DAYS}` · `PuGovReport.FORMS` · `PuGovReportBuild.resolveFormKey` · T2 의 껍데기(`$`, `lock`, `fbDb`, `grBoot`)
- Produces(검사가 떠서 돌리는 이름): 전역 한 줄 `var GR_NODES={…};` · `var GR_FIELDS={…};` · `var GR={…};` · 함수 `grEsc` `grToday` `grFilter` `grRenderFilters` `grRenderKpis` `grSetStatus` `grRenderRows` `grRenderForms` `grRenderAlerts` `grRender` `grReset` `grLoad`
- 자리 id: `#board` `#err` `#kpis` `#fYear` `#fType` `#fAtt` `#fStatus` `#fCo` `#fMine` `#mineWrap` `#fReset` `#rows` `#empty` `#forms` `#alerts`

- [ ] **Step 1: 실패하는 검사 작성** — `tests/gov-report-app.test.js` (새)

```js
'use strict';
/* 컨설팅보고서 앱(gov-report.html) — 화면 검사 (2026-10-10)
 * ★ 지키는 것: 읽기만 한다 · 숫자 칸을 누르면 거르고 다시 누르면 풀린다 · 내 담당만 · 서고는 읽기만 ·
 *   오류·빈 상태 문구(설계서 §5) · 본문은 그리지 않는다
 * 공개 저장소다 — 합성 자료만(tests/helpers/gov-report-fixture.js). */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const test = require('node:test');
const assert = require('node:assert/strict');
const FakeDb = require('./helpers/fake-rtdb.js');
const F = require('./helpers/gov-report-fixture.js');
const L = require('../js/pu-gov-report-list.js');
const Rpt = require('../js/pu-gov-report.js');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'gov-report.html'), 'utf8');
const INLINE = [...SRC.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n')
  .replace(/\/\*[\s\S]*?\*\//g, ' ');

function grab(n) {
  const i = SRC.search(new RegExp('(?:async\\s+)?function ' + n + '\\('));
  assert.ok(i >= 0, n + ' 을(를) 못 찾았다');
  let d = 0, st = false;
  for (let j = i; j < SRC.length; j++) {
    if (SRC[j] === '{') { d++; st = true; }
    else if (SRC[j] === '}') { d--; if (st && !d) return SRC.slice(i, j + 1); }
  }
}
function varLine(n) {
  const m = SRC.match(new RegExp('var ' + n + '=\\{[^\\r\\n]*\\};'));
  assert.ok(m, n + ' 한 줄을 못 찾았다');
  return m[0];
}
const NAMES = ['grEsc', 'grToday', 'grFilter', 'grRenderFilters', 'grRenderKpis', 'grSetStatus', 'grRenderRows',
  'grRenderForms', 'grRenderAlerts', 'grRender', 'grReset', 'grLoad'];

function fakeEl() { return { innerHTML: '', textContent: '', value: '', checked: false, disabled: false, style: {} }; }
function world(o) {
  o = o || {};
  const db = FakeDb.만들기(o.seed || F.seed());
  const els = {};
  const ctx = { console: { warn() {} }, Promise, Object, Array, JSON, String, Number, Math, Date, RegExp, Error, isFinite,
    encodeURIComponent, PuGovReportList: L, PuGovReport: { FORMS: Rpt.FORMS },
    $: (id) => (els[id] = els[id] || fakeEl()),
    fbDb: o.db ? o.db(db) : db };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext([varLine('GR_NODES'), varLine('GR_FIELDS'), varLine('GR')].join('\n') + '\n' + NAMES.map(grab).join('\n')
    + "\ngrToday=function(){ return '2026-10-10'; };", ctx);
  if (o.email) vm.runInContext('GR.email=' + JSON.stringify(o.email) + ';', ctx);
  return { ctx, db, els };
}

test('정적 — 공통 머리와 새 모듈을 차례대로 싣는다', () => {
  ['js/pu-gov-report.js', 'js/pu-gov-report-build.js', 'js/pu-gov-report-list.js', 'js/pu-appbar.js', 'js/pu-back.js',
    'js/pu-gate.js', 'js/pu-whoami.js', 'js/pu-ls-guard.js', 'js/pu-logout-why.js', 'js/pu-ontology.js']
    .forEach((f) => assert.match(SRC, new RegExp('src="' + f.replace(/\./g, '\\.') + '\\?v=\\d+"'), f));
  assert.ok(SRC.indexOf('pu-gov-report-build.js') < SRC.indexOf('pu-gov-report-list.js'), 'build 를 먼저 싣는다');
  assert.match(SRC, /pu-ontology-write\.js\?v=\d+" data-mode="observe"/);
  assert.match(SRC, /PuGate\.show\(/);
  assert.match(SRC, /PuBack\.guard\(/);
  assert.match(SRC, /PuWhoami\.mount\('#who'\)/);
});

test('정적 — 아무것도 쓰지 않는다 · 일정 자리는 GR_NODES 로만 부른다', () => {
  assert.doesNotMatch(INLINE, /\.(set|update|remove|transaction)\s*\(/, '쓰기 명령이 있다');
  assert.doesNotMatch(INLINE, /ref\([^)]*\)\.push\(/, '쓰기 명령이 있다');
  assert.doesNotMatch(INLINE, /ref\(\s*['"]scal_(cos|types|scheds|staff)/, 'GR_NODES 를 거치지 않았다');
  assert.match(SRC, /불러오지 못했습니다 — 연결을 확인해 주세요/);
  assert.match(SRC, /올해 걸린 보고서가 없습니다 — 사업 걸기는 정부사업일정에서/);
});

test('① 불러오면 올해 줄 셋 — 단추는 정부사업일정 보고서 창으로, 작성 전은 비활성', async () => {
  const w = world();
  await w.ctx.grLoad();
  const h = w.els.rows.innerHTML;
  ['마바산업', '가나상사', '다라정밀'].forEach((n) => assert.ok(h.includes(n), n));
  assert.ok(!h.includes('사아테크'), '2025 줄은 올해 목록에 없다');
  assert.ok(!h.includes('본문은 목록에 나오면 안 된다'), '본문을 그렸다');
  assert.ok(h.includes('href="gov-consulting.html#rpt=c3|t4"'));
  assert.ok(h.includes('href="gov-consulting.html#rpt=c1|t1"'));
  assert.match(h, /<button type="button" class="act" disabled title="회차가 남았습니다">📄 작성<\/button>/);
  assert.ok(h.includes('AI 초안'));
  assert.ok(h.includes('양식 고르기'));
  assert.equal(w.db.쓴것.length, 0, '읽기만 해야 한다');
  assert.equal(w.els.empty.style.display, 'none');
});

test('② 숫자 칸 — 올해 기준, 누르면 거르고 다시 누르면 풀린다 · 서명·제출은 비활성', async () => {
  const w = world();
  await w.ctx.grLoad();
  const k = w.els.kpis.innerHTML;
  assert.match(k, /data-st=""[^>]*><b>3<\/b><span>전체/);
  assert.match(k, /data-st="todo"[^>]*><b>1<\/b><span>미작성/);
  assert.match(k, /data-st="signed" disabled/);
  w.ctx.grSetStatus('todo');
  assert.ok(w.els.rows.innerHTML.includes('마바산업'));
  assert.ok(!w.els.rows.innerHTML.includes('가나상사'));
  assert.equal(w.els.fStatus.value, 'todo');
  assert.match(w.els.kpis.innerHTML, /class="kpi on" data-st="todo"/);
  w.ctx.grSetStatus('todo');
  assert.ok(w.els.rows.innerHTML.includes('가나상사'), '다시 누르면 풀린다');
  w.ctx.grSetStatus('signed');
  assert.equal(w.ctx.GR.f.status, '', '서명 칸은 누를 수 없다');
});

test('③ 내 담당만 — 로그인 메일 → 담당자 번호, 주담당·부담당 줄만', async () => {
  const w = world({ email: 'p009@pureun.kr' });
  await w.ctx.grLoad();
  assert.equal(w.ctx.GR.me, 'a1');
  assert.equal(w.els.mineWrap.style.display, '');
  w.ctx.GR.f.mine = true;
  w.ctx.grRender();
  const h = w.els.rows.innerHTML;
  assert.ok(h.includes('가나상사') && h.includes('다라정밀'));
  assert.ok(!h.includes('마바산업'));
  const n = world();
  await n.ctx.grLoad();
  assert.equal(n.els.mineWrap.style.display, 'none', '담당자가 아니면 숨긴다');
});

test('④ 양식 서고 현황 — 읽기만, 등록·바꾸기는 정부사업일정으로', async () => {
  const w = world();
  await w.ctx.grLoad();
  const h = w.els.forms.innerHTML;
  Object.keys(Rpt.FORMS).forEach((fk) => assert.ok(h.includes(Rpt.FORMS[fk].name), fk));
  assert.ok(h.includes('2024'));
  assert.ok(h.includes('등록된 양식 없음'));
  assert.ok(h.includes('href="gov-consulting.html#forms"'));
});

test('⑤ 챙길 것 — 14일 넘은 미작성 · 7일 넘은 초안 · 서명 기다림 0', async () => {
  const w = world();
  await w.ctx.grLoad();
  const h = w.els.alerts.innerHTML;
  assert.match(h, /종료 후 14일 넘은 미작성 <b>1<\/b>/);
  assert.ok(h.includes('마바산업') && h.includes('종료 151일'));
  assert.match(h, /초안 7일 넘음 <b>1<\/b>/);
  assert.ok(h.includes('20일 전 고침'));
  assert.match(h, /서명 기다림 <b>0<\/b>/);
});

test('⑥ 못 읽으면 문구와 다시 시도 단추 — 목록은 숨긴다', async () => {
  const w = world({ db: (db) => ({ ref: (p) => (p === 'scal_cos'
    ? { once: async () => { throw new Error('permission_denied'); } } : db.ref(p)) }) });
  await w.ctx.grLoad();
  assert.ok(w.els.err.innerHTML.includes('불러오지 못했습니다 — 연결을 확인해 주세요'));
  assert.ok(w.els.err.innerHTML.includes('onclick="grLoad()"'));
  assert.equal(w.els.err.style.display, '');
  assert.equal(w.els.board.style.display, 'none');
});

test('⑦ 줄이 없으면 「올해 걸린 보고서가 없습니다」 · 거르개로 비면 다른 말', async () => {
  const s = F.seed(); s.scal_scheds = [];
  const w = world({ seed: s });
  await w.ctx.grLoad();
  assert.equal(w.els.empty.style.display, '');
  assert.equal(w.els.empty.textContent, '올해 걸린 보고서가 없습니다 — 사업 걸기는 정부사업일정에서');
  const v = world();
  await v.ctx.grLoad();
  v.ctx.GR.f.co = '없는업체';
  v.ctx.grRender();
  assert.equal(v.els.empty.textContent, '조건에 맞는 보고서가 없습니다.');
});

test('⑧ 연도를 바꾸면 그 해 줄 — 검토완료는 ⬇ HWPX', async () => {
  const w = world();
  await w.ctx.grLoad();
  assert.ok(w.els.fYear.innerHTML.includes('value="2025"'));
  w.ctx.GR.f.year = '2025';
  w.ctx.grRender();
  const h = w.els.rows.innerHTML;
  assert.ok(h.includes('사아테크') && h.includes('검토완료 v2') && h.includes('⬇ HWPX'));
  w.ctx.grReset();
  assert.equal(w.ctx.GR.f.year, '2026');
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test tests/gov-report-app.test.js`
Expected: FAIL — `pu-gov-report-list.js` 싣기 없음 · `GR_NODES 한 줄을 못 찾았다`

- [ ] **Step 3: 스타일 더하기** — `gov-report.html` `<style>` 의 `.loading{…}` 줄 다음에(팔레트 안 색만)

```css
.grid{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:14px;align-items:start}
.kpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px;margin-bottom:12px}
.kpi{text-align:left;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:8px 10px}
.kpi b{display:block;font-size:20px;font-variant-numeric:tabular-nums}
.kpi span{font-size:12px;color:var(--mute)}
.kpi.on{background:var(--blue-bg);border-color:var(--blue);color:var(--blue-ink)}
.filters{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px}
.filters select,.filters input[type=search]{font:inherit;border:1px solid var(--line);border-radius:8px;padding:6px 8px;background:var(--card)}
.filters label{font-size:13px;display:flex;align-items:center;gap:4px}
.tbl{background:var(--card);border:1px solid var(--line);border-radius:10px;overflow:auto}
table{border-collapse:collapse;width:100%}
th,td{padding:8px;border-bottom:1px solid var(--line);text-align:left;white-space:nowrap;vertical-align:middle}
th{background:var(--bg);font-size:12px;color:var(--mute);font-weight:600}
td.co{font-weight:600;max-width:200px;overflow:hidden;text-overflow:ellipsis}
td.ty{max-width:220px;overflow:hidden;text-overflow:ellipsis}
td.num{text-align:right;font-variant-numeric:tabular-nums}
.st{display:inline-block;border-radius:999px;padding:2px 9px;font-size:12px}
.st-todo{background:var(--red-bg);color:var(--red)}
.st-wait{background:var(--line);color:#475569}
.st-draft{background:var(--amber-bg);color:var(--amber)}
.st-done{background:var(--green-bg);color:var(--green)}
.tag,.tag-ai{display:inline-block;border-radius:6px;padding:1px 6px;font-size:11px;border:1px solid var(--line);color:var(--mute)}
.tag-ai{background:var(--blue-bg);color:var(--blue-ink);border-color:var(--blue-line)}
.days{font-size:12px;color:var(--mute)}
.steps{display:inline-flex;gap:3px}
.stp{width:14px;height:6px;border-radius:3px;background:var(--line)}
.stp.on{background:var(--blue)}
.act{display:inline-block;font-size:12px;border:1px solid var(--blue-line);background:var(--blue-bg);color:var(--blue-ink);border-radius:8px;padding:4px 10px;text-decoration:none}
button.act{border-color:var(--line);background:var(--card);color:var(--mute)}
.empty{padding:30px;text-align:center;color:var(--mute)}
#err{background:var(--red-bg);border:1px solid #fecaca;color:var(--red);border-radius:10px;padding:16px;text-align:center}
#err button{margin-top:8px}
.side section{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px;margin-bottom:12px}
.side h2{font-size:14px;margin:0 0 8px}
.fm{padding:6px 0;border-bottom:1px solid var(--line)}
.fm-n{font-size:13px;font-weight:600}
.fm-f{display:flex;justify-content:space-between;gap:8px;font-size:12px;padding:2px 0}
.yr.none{color:var(--mute)}
.more{display:block;margin-top:8px;font-size:12px;color:var(--blue-ink)}
.err-s{font-size:12px;color:var(--red)}
.al-h{font-size:13px;margin:8px 0 4px}
#alerts ul{margin:0;padding-left:18px;font-size:12px}
#alerts a{color:var(--blue-ink)}
@media (max-width:900px){ .grid{grid-template-columns:1fr} .kpis{grid-template-columns:repeat(3,minmax(0,1fr))} }
@media (max-width:640px){ input,select{font-size:16px} }
```

- [ ] **Step 4: 몸통** — `<main id="app" …>` 안의 `<div class="loading" id="loading">불러오는 중…</div>` 를 다음으로 바꾼다.

```html
  <div class="loading" id="loading">불러오는 중…</div>
  <div id="err" style="display:none"></div>
  <div class="grid" id="board" style="display:none">
    <div>
      <div class="kpis" id="kpis"></div>
      <div class="filters">
        <select id="fYear" aria-label="연도"></select>
        <select id="fType" aria-label="사업"></select>
        <select id="fAtt" aria-label="담당"></select>
        <select id="fStatus" aria-label="상태">
          <option value="">모든 상태</option><option value="todo">미작성</option><option value="wait">작성 전</option>
          <option value="draft">초안</option><option value="done">검토완료</option>
        </select>
        <input id="fCo" type="search" placeholder="업체 찾기">
        <label id="mineWrap" style="display:none"><input type="checkbox" id="fMine"> 내 담당만</label>
        <button type="button" id="fReset">거르개 풀기</button>
      </div>
      <div class="tbl">
        <table>
          <thead><tr><th>업체</th><th>사업</th><th>연도</th><th>담당</th><th>회차</th><th>상태</th><th>진행</th><th>마지막 고침</th><th></th></tr></thead>
          <tbody id="rows"></tbody>
        </table>
        <div class="empty" id="empty" style="display:none"></div>
      </div>
    </div>
    <div class="side">
      <section><h2>⚙ 양식 서고 현황</h2><div id="forms"></div></section>
      <section><h2>⏰ 챙길 것</h2><div id="alerts"></div></section>
    </div>
  </div>
```

- [ ] **Step 5: 모듈 싣기** — `<script src="js/pu-back.js?v=2"></script>` 줄 «앞»에

```html
<!-- 보고서 양식 표(FORMS) · 양식 고르기(resolveFormKey) · 현황판 계산 — 정부사업일정과 같은 번호 -->
<script src="js/pu-gov-report.js?v=1"></script>
<script src="js/pu-gov-report-build.js?v=3"></script>
<script src="js/pu-gov-report-list.js?v=1"></script>
```

- [ ] **Step 6: 스크립트 몸통** — 맨 아래 `<script>` 를 통째로 다음으로 바꾼다(`FB_CONFIG`·`$`·`lock` 은 그대로, `grBoot` 는 거르개·로드를 붙인다).

```html
<script>
var FB_CONFIG={apiKey:'AIzaSyDkZz5QlKSoqMOYByp5YGeMNLNDrIghliA',authDomain:'pureun-erp.firebaseapp.com',databaseURL:'https://pureun-erp-default-rtdb.asia-southeast1.firebasedatabase.app',projectId:'pureun-erp',appId:'1:936817166182:web:9bd31f70d0afdf5fca2aa7',messagingSenderId:'936817166182'};
var fbDb=null;
/* 정부사업일정이 FB_NODES 로 부르는 그 자리 — 읽기만, 한 번씩 */
var GR_NODES={cos:'scal_cos',types:'scal_types',scheds:'scal_scheds',staff:'scal_staff'};
var GR_FIELDS={fYear:'year',fType:'type',fAtt:'att',fStatus:'status'};
var GR={rows:[],staffMap:{},index:null,indexErr:false,err:'',loaded:false,me:'',email:'',today:'',f:{year:'',type:'',att:'',status:'',co:'',mine:false}};

function $(id){ return document.getElementById(id); }
function lock(why){ $('app').style.display='none'; $('lock').style.display='block'; $('lockWhy').textContent=why||''; }
function grEsc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return '&#'+c.charCodeAt(0)+';'; }); }
function grToday(){ return new Date(Date.now()+9*3600e3).toISOString().slice(0,10); }
function grFilter(){ var f=GR.f; return {year:f.year,type:f.type,att:f.att,status:f.status,co:f.co,mine:f.mine?GR.me:''}; }

/* ═══ 그리기 ═══ */
function grRenderFilters(){
  var L=PuGovReportList, seenT={}, seenA={};
  $('fYear').innerHTML=L.yearsOf(GR.rows,GR.today).map(function(y){ return '<option value="'+y+'"'+(y===GR.f.year?' selected':'')+'>'+y+'년</option>'; }).join('');
  GR.rows.forEach(function(r){ seenT[r.typeId]=r.typeName; r.attIds.forEach(function(id){ if(GR.staffMap[id]) seenA[id]=GR.staffMap[id]; }); });
  var opts=function(all,seen,cur){ return '<option value="">'+all+'</option>'+Object.keys(seen).sort(function(a,b){ return seen[a].localeCompare(seen[b],'ko'); })
    .map(function(id){ return '<option value="'+grEsc(id)+'"'+(id===cur?' selected':'')+'>'+grEsc(seen[id])+'</option>'; }).join(''); };
  $('fType').innerHTML=opts('모든 사업',seenT,GR.f.type);
  $('fAtt').innerHTML=opts('모든 담당',seenA,GR.f.att);
  $('fStatus').value=GR.f.status;
  $('mineWrap').style.display=GR.me?'':'none';
}
function grRenderKpis(){
  var L=PuGovReportList, base=grFilter(); base.status='';
  var k=L.kpis(L.filterRows(GR.rows,base));
  var cells=[['','전체',k.all],['todo','미작성',k.todo],['draft','초안',k.draft],['done','검토완료',k.done],['signed','서명',k.signed],['submitted','제출',k.submitted]];
  $('kpis').innerHTML=cells.map(function(c){
    var off=c[0]==='signed'||c[0]==='submitted';
    return '<button type="button" class="kpi'+(c[0]&&GR.f.status===c[0]?' on':'')+'" data-st="'+c[0]+'"'
      +(off?' disabled title="서명·제출은 다음 단계에서 셉니다"':'')+'><b>'+c[2]+'</b><span>'+c[1]+'</span></button>';
  }).join('');
}
/* 숫자 칸 — 누르면 그 상태로, 같은 칸을 다시 누르면 풀린다. 「전체」는 풀기 */
function grSetStatus(st){
  if(st==='signed'||st==='submitted') return;
  GR.f.status=(st&&GR.f.status!==st)?st:'';
  grRender();
}
function grRenderRows(){
  var L=PuGovReportList, view=L.filterRows(GR.rows,grFilter());
  var STEP=['① 초안','② 검토완료','③ 서명','④ 제출'];
  $('rows').innerHTML=view.map(function(r){
    var s=r.st;
    var steps=s.steps.map(function(on,i){ return '<span class="stp'+(on?' on':'')+'" title="'+STEP[i]+'"></span>'; }).join('');
    var act=s.action.enabled
      ? '<a class="act" href="'+grEsc(L.reportHref(r.coId,r.typeId))+'" title="'+grEsc(s.action.why||'정부사업일정의 보고서 창으로 갑니다')+'">'+grEsc(s.action.label)+'</a>'
      : '<button type="button" class="act" disabled title="'+grEsc(s.action.why)+'">'+grEsc(s.action.label)+'</button>';
    var badge='<span class="st st-'+s.key+'">'+grEsc(s.label)+'</span>'
      +(s.ai?' <span class="tag-ai">AI 초안</span>':'')+(r.askForm?' <span class="tag">양식 고르기</span>':'')
      +(s.days!=null&&s.key!=='done'?' <span class="days">'+(s.key==='todo'?'종료 '+s.days+'일':s.days+'일 전')+'</span>':'');
    return '<tr><td class="co" title="'+grEsc(r.coName)+'">'+grEsc(r.coName)+'</td>'
      +'<td class="ty" title="'+grEsc(r.typeName)+'">'+grEsc(r.typeName)+'</td>'
      +'<td>'+grEsc(r.year)+'</td><td>'+grEsc(r.attNames.join('·'))+'</td>'
      +'<td class="num">'+r.rounds+(r.maxRounds?'/'+r.maxRounds:'')+'</td>'
      +'<td>'+badge+'</td><td><span class="steps">'+steps+'</span></td>'
      +'<td>'+grEsc(r.updatedBy?(L.dayOf(r.updatedAt)+' '+r.updatedBy):'')+'</td><td>'+act+'</td></tr>';
  }).join('');
  var yearRows=L.filterRows(GR.rows,{year:GR.f.year}).length;
  $('empty').textContent=yearRows?'조건에 맞는 보고서가 없습니다.':'올해 걸린 보고서가 없습니다 — 사업 걸기는 정부사업일정에서';
  $('empty').style.display=(GR.loaded&&!view.length)?'':'none';
}
/* 양식 서고 — 읽기만. 등록·바꾸기는 정부사업일정의 ⚙ 양식 서고(#forms, 관리자) */
function grRenderForms(){
  var L=PuGovReportList, FORMS=(window.PuGovReport&&window.PuGovReport.FORMS)||{};
  var head=GR.indexErr?'<div class="err-s">서고 색인을 못 읽었습니다 — 연결을 확인해 주세요</div>':'';
  $('forms').innerHTML=head+L.formsStatus(GR.index,FORMS).map(function(f){
    return '<div class="fm"><div class="fm-n">'+(f.ready?'✅ ':'⚠ ')+grEsc(f.name)+'</div>'+f.files.map(function(x){
      return '<div class="fm-f"><span>'+grEsc(x.label)+'</span><span class="yr'+(x.latest?'':' none')+'">'+(x.latest?grEsc(x.years.join(' · ')):'등록된 양식 없음')+'</span></div>';
    }).join('')+'</div>';
  }).join('')+'<a class="more" href="'+L.FORMS_HREF+'">⚙ 등록·바꾸기 — 정부사업일정 양식 서고</a>';
}
function grRenderAlerts(){
  var L=PuGovReportList, a=L.alerts(L.filterRows(GR.rows,{year:GR.f.year}),GR.today);
  var line=function(r,txt){ return '<li><a href="'+grEsc(L.reportHref(r.coId,r.typeId))+'">'+grEsc(r.coName)+' · '+grEsc(r.typeName)+'</a> <span class="days">'+txt+'</span></li>'; };
  $('alerts').innerHTML='<div class="al-h">종료 후 '+L.UNWRITTEN_DAYS+'일 넘은 미작성 <b>'+a.unwritten.length+'</b></div><ul>'
    +a.unwritten.map(function(r){ return line(r,'종료 '+r.st.days+'일'); }).join('')+'</ul>'
    +'<div class="al-h">초안 '+L.DRAFT_DAYS+'일 넘음 <b>'+a.staleDraft.length+'</b></div><ul>'
    +a.staleDraft.map(function(r){ return line(r,r.st.days+'일 전 고침'); }).join('')+'</ul>'
    +'<div class="al-h">서명 기다림 <b>0</b> <span class="days">서명 단계가 생기면 셉니다</span></div>';
}
function grRender(){
  $('loading').style.display=GR.loaded?'none':'';
  if(GR.err){
    $('err').innerHTML='<div>불러오지 못했습니다 — 연결을 확인해 주세요</div><button type="button" onclick="grLoad()">다시 시도</button>';
    $('err').style.display=''; $('board').style.display='none'; return;
  }
  $('err').style.display='none'; $('board').style.display=GR.loaded?'':'none';
  grRenderFilters(); grRenderKpis(); grRenderRows(); grRenderForms(); grRenderAlerts();
}
function grReset(){
  GR.f.year=GR.today.slice(0,4); GR.f.type=''; GR.f.att=''; GR.f.status=''; GR.f.co=''; GR.f.mine=false;
  $('fCo').value=''; $('fMine').checked=false;
  grRender();
}

/* ═══ 읽기 — 일정 넷을 한 번씩, 보고서는 줄마다 한 자리씩(확정본 사본 _v 는 안 읽는다) ═══ */
async function grLoad(){
  var L=PuGovReportList, input={}, keys=Object.keys(GR_NODES);
  GR.err=''; GR.today=grToday();
  try{
    var vals=await Promise.all(keys.map(function(k){ return fbDb.ref(GR_NODES[k]).once('value').then(function(s){ return s.val(); }); }));
    keys.forEach(function(k,i){ input[k]=vals[i]; });
    input.today=GR.today;
    var reps={};
    await Promise.all(L.reportKeys(input).map(function(x){
      return fbDb.ref('scal_reports/'+x.coId+'/'+x.rid).once('value').then(function(s){
        var v=s.val(); if(v){ reps[x.coId]=reps[x.coId]||{}; reps[x.coId][x.rid]=v; }
      });
    }));
    input.reports=reps;
    GR.rows=L.buildRows(input);
    GR.staffMap=L.staffNames(input.staff);
    if(!GR.f.year) GR.f.year=GR.today.slice(0,4);
  }catch(e){ console.warn('[컨설팅보고서] 못 읽음',e); GR.err=String((e&&e.message)||e); GR.rows=[]; }
  try{ GR.index=(await fbDb.ref('scal_rptFormsIndex').once('value')).val()||{}; GR.indexErr=false; }
  catch(e){ GR.index=null; GR.indexErr=true; }
  GR.me='';
  if(!GR.err&&GR.email){
    try{ GR.me=L.staffIdFor(input.staff,(await fbDb.ref('data/user_dir').once('value')).val(),GR.email); }catch(e){ GR.me=''; }
  }
  GR.loaded=true;
  grRender();
}

/* ═══ 로그인 — 포털 앱과 같은 문 ═══ */
function grBoot(){
  $('kpis').addEventListener('click',function(e){
    var b=e.target&&e.target.closest?e.target.closest('[data-st]'):null;
    if(!b||b.disabled) return;
    grSetStatus(b.getAttribute('data-st'));
  });
  Object.keys(GR_FIELDS).forEach(function(id){ $(id).addEventListener('change',function(){ GR.f[GR_FIELDS[id]]=this.value; grRender(); }); });
  $('fCo').addEventListener('input',function(){ GR.f.co=this.value; grRender(); });
  $('fMine').addEventListener('change',function(){ GR.f.mine=this.checked; grRender(); });
  $('fReset').addEventListener('click',grReset);
  if(location.protocol==='file:'){ lock('file:// 로 열면 로그인할 수 없습니다 — 주소로 여세요'); return; }
  if(typeof firebase==='undefined'){ lock('인터넷이 필요합니다'); return; }
  if(!firebase.apps||!firebase.apps.length) firebase.initializeApp(FB_CONFIG);
  fbDb=firebase.database();
  try{ firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL); }catch(e){}
  firebase.auth().onAuthStateChanged(function(u){
    $('outBtn').style.display=u?'':'none';
    if(!u||u.isAnonymous){ PuGate.show(); return; }
    PuGate.hide();
    GR.email=String(u.email||'').toLowerCase();
    $('lock').style.display='none'; $('app').style.display='';
    grLoad();
  });
}
grBoot();
</script>
```

주의: 이 스크립트의 글자열 안에는 짝 없는 `{`·`}` 가 없다(검사의 `grab` 이 괄호를 센다). `grEsc` 는 `&#숫자;` 로 바꾼다 — 검사는 `href="gov-consulting.html#rpt=c3|t4"` 를 그대로 찾으므로 `|` 는 바꾸지 않는다(`[&<>"']` 만).

- [ ] **Step 7: 통과 확인**

Run: `node --test tests/gov-report-app.test.js tests/gov-report-list.test.js tests/color-palette-apps.test.js tests/html-inline-script-syntax.test.js tests/ontology-registry.test.js tests/ontology-write-gate.test.js`
그리고: `node tests/shared-js-cache-version.test.js`
Expected: 모두 PASS. 팔레트 검사가 빨갛면 그 색을 위 `:root` 변수(27색)로 바꾼다 — `EXCEPT` 에 채우지 않는다.

- [ ] **Step 8: 눈으로 확인(로그인 없이 되는 만큼)**
  - `.claude/launch.json` 의 정적 서버(`static`)로 `gov-report.html` 을 연다. 콘솔에 `PuGovReportList is not defined`·구문 오류가 없고, 로그인 문(PuGate)이 뜨는지 본다.
  - 실제 자료 확인은 배포 뒤 대표·노무사 확인 거리로 남긴다(로그인 필요).

- [ ] **Step 9: 커밋** (PowerShell)

```powershell
git add gov-report.html tests/gov-report-app.test.js
git commit -m @'
feat(gov-report): 컨설팅보고서 화면 — 숫자 칸·거르개·목록·양식 서고 현황·챙길 것

읽기만 한다. 단추는 정부사업일정 보고서 창(#rpt=)으로 건너간다.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
'@
```

---

### Task 4: `gov-consulting.html` — `#rpt=` 로 보고서 창 · `#forms` 로 양식 서고

**Files:** Modify `gov-consulting.html` (`openFromLink` 다음 ~5977 · 시작 때 부르는 줄 ~5947) · Test `tests/gov-report-deeplink.test.js` (새)

**Interfaces:**
- Consumes: 기존 `LINK_TRIES`(30)·`LINK_WAIT`(500)·`linkClear()`·`getCos()`·`getTypes()`·`getSession()`·`FB_READY`·`grpOpenReport(coId,typeId)`·`grpOpenForms()`·`toast(m,'err')` · T1 `reportHref` 의 주소 꼴(`#rpt=<인코딩 업체>|<인코딩 사업>`)
- Produces: `linkRpt() → {coId,typeId}|null` · `openFromReportLink()` · `openFormsFromLink()`

- [ ] **Step 1: 실패하는 검사 작성** — `tests/gov-report-deeplink.test.js` (새)

```js
'use strict';
/* 정부사업일정 — 컨설팅보고서 앱에서 건너오기 (#rpt=업체|사업 · #forms) (2026-10-10)
 * ★ 지키는 것: 자료가 늦게 와도 기다렸다 연다(#sc= 와 같은 15초) · 클라우드가 붙기 전에는 열지 않는다
 *   (저장본을 못 읽은 채 열면 빈 초안으로 덮을 수 있다) · 못 찾으면 그렇게 말한다 · 한 번 열면 주소에서 지운다 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'gov-consulting.html'), 'utf8');
function grab(n) {
  const i = SRC.search(new RegExp('(?:async\\s+)?function ' + n + '\\('));
  assert.ok(i >= 0, n + ' 을(를) 못 찾았다');
  let d = 0, st = false;
  for (let j = i; j < SRC.length; j++) {
    if (SRC[j] === '{') { d++; st = true; }
    else if (SRC[j] === '}') { d--; if (st && !d) return SRC.slice(i, j + 1); }
  }
}

function world(o) {
  o = o || {};
  let calls = 0;
  const ctx = {
    console, String, RegExp, decodeURIComponent,
    location: { hash: o.hash || '', pathname: '/pureunall/gov-consulting.html', search: '' },
    history: { replaceState: () => { ctx.__cleared++; } }, __cleared: 0,
    FB_READY: o.ready !== false,
    getCos: () => { calls++; return calls > (o.lateBy || 0) ? [{ id: 'c1', name: '가나상사' }] : []; },
    getTypes: () => [{ id: 't1', name: '기술보호' }],
    getSession: () => (o.noSession ? null : { id: 'a1', name: '홍길동', isAdmin: true }),
    grpOpenReport: (co, t) => { ctx.__opened.push(co + '|' + t); return Promise.resolve(true); }, __opened: [],
    grpOpenForms: () => { ctx.__forms++; return Promise.resolve(true); }, __forms: 0,
    toast: (m, k) => { ctx.__toasts.push(String(m) + '#' + (k || '')); }, __toasts: [],
    setTimeout: (fn) => fn()
  };
  vm.createContext(ctx);
  const consts = SRC.match(/const LINK_TRIES=\d+, LINK_WAIT=\d+;/)[0];
  vm.runInContext(consts + '\n' + ['linkClear', 'linkRpt', 'openFromReportLink', 'openFormsFromLink'].map(grab).join('\n'), ctx);
  return ctx;
}

test('linkRpt — 업체|사업을 읽는다(인코딩·%7C 도), 꼴이 틀리면 null', () => {
  assert.deepEqual({ ...world({ hash: '#rpt=c1|t1' }).linkRpt() }, { coId: 'c1', typeId: 't1' });
  assert.deepEqual({ ...world({ hash: '#rpt=a%20b%7Ct%2F1' }).linkRpt() }, { coId: 'a b', typeId: 't/1' });
  assert.equal(world({ hash: '#rpt=c1' }).linkRpt(), null);
  assert.equal(world({ hash: '#sc=s1' }).linkRpt(), null);
});

test('openFromReportLink — 자료가 늦게 와도 기다렸다 그 보고서 창을 열고 주소를 지운다', () => {
  const w = world({ hash: '#rpt=c1|t1', lateBy: 3 });
  w.openFromReportLink();
  assert.deepEqual(w.__opened, ['c1|t1']);
  assert.equal(w.__cleared, 1);
  assert.equal(w.__toasts.length, 0);
});

test('openFromReportLink — 클라우드가 붙기 전에는 열지 않는다, 15초 지나면 「찾지 못했습니다」', () => {
  const w = world({ hash: '#rpt=c1|t1', ready: false });
  w.openFromReportLink();
  assert.deepEqual(w.__opened, []);
  assert.ok(w.__toasts.some((t) => t.startsWith('그 보고서를 찾지 못했습니다') && t.endsWith('#err')));
  const g = world({ hash: '#rpt=c9|t1' });
  g.openFromReportLink();
  assert.deepEqual(g.__opened, []);
  assert.equal(g.__cleared, 1);
});

test('openFormsFromLink — #forms 면 로그인을 기다렸다 양식 서고를 연다', () => {
  const w = world({ hash: '#forms' });
  w.openFormsFromLink();
  assert.equal(w.__forms, 1);
  assert.equal(w.__cleared, 1);
  const n = world({ hash: '#forms', noSession: true });
  n.openFormsFromLink();
  assert.equal(n.__forms, 0);
  assert.ok(n.__toasts.some((t) => t.includes('양식 서고')));
  const x = world({ hash: '#formsx' });
  x.openFormsFromLink();
  assert.equal(x.__forms, 0);
});

test('시작할 때 #sc= 와 나란히 부른다', () => {
  assert.match(SRC, /setTimeout\(openFromLink,300\);\r?\n\s*setTimeout\(openFromReportLink,300\);\r?\n\s*setTimeout\(openFormsFromLink,300\);/);
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test tests/gov-report-deeplink.test.js`
Expected: FAIL — `linkRpt 을(를) 못 찾았다`

- [ ] **Step 3: 구현** — `gov-consulting.html`

(1) `openFromLink` 함수가 끝나는 `}` 바로 뒤(빈 줄 다음, `// isOwner: 이 일정이 내 것인지` 앞)에

```js
/* 컨설팅보고서 앱(gov-report.html)에서 건너온 자리 — #rpt=<업체>|<사업> 이면 그 보고서 창, #forms 면 ⚙ 양식 서고
   (대표 지시 2026-10-10 「포털 의뢰인 업무에 별도 앱」 · 설계 docs/superpowers/specs/2026-10-10-gov-report-app-design.md §1·§5).
   ★ #sc= 와 같은 기다리기 — 자료가 늦게 오므로 나타날 때까지 15초 기다린다.
   ⚠ 클라우드가 붙기(FB_READY) 전에는 열지 않는다 — 저장본을 못 읽은 채 열면 빈 초안이 보이고, 그대로 저장하면 덮는다.
   ⚠ 권한(확정은 담당·부담당·관리자, 서고는 관리자)은 열린 창의 규칙 그대로다. */
function linkRpt(){
  const m=/[#&]rpt=([^&]+)/.exec(location.hash||'');
  if(!m)return null;
  let raw=m[1];
  try{ raw=decodeURIComponent(m[1]); }catch(e){}
  const p=raw.split('|');
  return (p.length===2&&p[0]&&p[1])?{coId:p[0],typeId:p[1]}:null;
}
function openFromReportLink(){
  const t=linkRpt();
  if(!t)return;
  let tries=0;
  (function look(){
    const ok=FB_READY&&getCos().some(c=>c&&c.id===t.coId)&&getTypes().some(x=>x&&x.id===t.typeId);
    if(ok){ linkClear(); grpOpenReport(t.coId,t.typeId); return; }
    if(++tries>LINK_TRIES){
      linkClear();
      toast('그 보고서를 찾지 못했습니다 — 지워졌거나 볼 수 없는 사업장입니다','err');
      return;
    }
    setTimeout(look,LINK_WAIT);
  })();
}
function openFormsFromLink(){
  if(!/[#&]forms(?:&|$)/.test(location.hash||''))return;
  let tries=0;
  (function look(){
    if(getSession()){ linkClear(); grpOpenForms(); return; }
    if(++tries>LINK_TRIES){
      linkClear();
      toast('로그인한 뒤 ⚙ 양식 서고를 다시 열어 주세요','err');
      return;
    }
    setTimeout(look,LINK_WAIT);
  })();
}
```

(2) 시작 자리 — 이 줄을

```js
  setTimeout(openFromLink,300);
```

다음 세 줄로 바꾼다(들여쓰기 두 칸 그대로).

```js
  setTimeout(openFromLink,300);
  setTimeout(openFromReportLink,300);
  setTimeout(openFormsFromLink,300);
```

`grpOpenForms` 는 관리자가 아니면 스스로 「양식 서고는 관리자만 엽니다」 알림을 띄운다 — 여기서 따로 막지 않는다.

- [ ] **Step 4: 통과 확인**

Run: `node --test tests/gov-report-deeplink.test.js tests/gov-report-ui.test.js tests/html-inline-script-syntax.test.js`
Expected: PASS

- [ ] **Step 5: 커밋** (PowerShell)

```powershell
git add gov-consulting.html tests/gov-report-deeplink.test.js
git commit -m @'
feat(gov): 컨설팅보고서 앱에서 건너오기 — #rpt= 보고서 창 · #forms 양식 서고

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
'@
```

---

### Task 5: 전체 검사 + 기록

**Files:** Modify `STATUS.md` · Create `status/2026-10-10-gov-report-app.md`

- [ ] **Step 1: 새 앱이 지켜야 하는 검사 묶음**

Run: `node --test tests/gov-report-list.test.js tests/gov-report-app.test.js tests/gov-report-deeplink.test.js tests/gov-report-ui.test.js tests/appbar-coverage.test.js tests/appbar-every-link.test.js tests/back-button.test.js tests/ls-guard.test.js tests/logout-why.test.js tests/logout-gate.test.js tests/authsync-global-logout.test.js tests/app-soon-gate.test.js tests/portal-soon-locked.test.js tests/portal-admin-tiles.test.js tests/portal-rows-inout.test.js tests/app-icons.test.js tests/color-palette-apps.test.js tests/html-inline-script-syntax.test.js tests/read-fence-apps.test.js tests/rrn-seal.test.js tests/show-my-name.test.js tests/appcheck-off.test.js tests/pair-guards.test.js tests/erp-big-store.test.js tests/one-line-cells.test.js tests/whoami-no-overlap.test.js tests/ontology-contract.test.js tests/ontology-registry.test.js tests/ontology-write-gate.test.js`
그리고: `node tests/shared-js-cache-version.test.js`
Expected: 모두 PASS.

- [ ] **Step 2: 전체 검사**

Run: `node --test "tests/**/*.test.js"`
Expected: 새로 빨개진 것이 없다. 작업 전 기준 커밋(`git merge-base HEAD origin/main`)에서 이미 빨갛던 검사가 있으면 그 이름을 기록(Step 4)에 적는다. `✖ 올리지 않았습니다 — 기준이 N일 된 것입니다` 는 날짜 잡음이다.

- [ ] **Step 3: `STATUS.md`** — 「✅ 결정됨 — 정부컨설팅 보고서 자동화」 묶음의 이 줄

```markdown
- [ ] 다음: 현장클리닉·농촌융복합 양식 → .hwp 필요 기관은 PC 한글 변환(Claude 로컬)
```

바로 «앞»에 두 줄을 넣는다.

```markdown
- [x] 컨설팅보고서 앱(현황판, 설계서 §11 [F] 앞당김) — 구현 (PR 예정). 설계 `docs/superpowers/specs/2026-10-10-gov-report-app-design.md` · 계획 `docs/superpowers/plans/2026-10-10-gov-report-app.md`. 포털 의뢰인 업무 📑 타일 → `gov-report.html`(읽기만): 숫자 칸·거르개·목록·양식 서고 현황·⏰ 챙길 것. 단추는 `gov-consulting.html#rpt=업체|사업` 으로 건너가 기존 보고서 창을 연다(`#forms` 는 양식 서고)
- [ ] 컨설팅보고서 앱 확인 필요 — 배포 뒤 실제 자료로 줄 수·상태가 정부사업일정 보고서 창과 맞는지(대표·노무사) · 서명③·제출④ 칸은 [D]·[E] 에서 채움 · 등록부 `govreport` 의 «보던 자리» 예약(`data/gov_report_view`)을 쓰게 되면 규칙 먼저
```

- [ ] **Step 4: `status/2026-10-10-gov-report-app.md`** (새)

```markdown
# 2026-10-10 · 컨설팅보고서 앱(현황판)

대표 지시 「포털 의뢰인 업무에 별도 앱을 만들어 진행」 · 시안 확인 후 「진행」.
설계 `docs/superpowers/specs/2026-10-10-gov-report-app-design.md` · 계획 `docs/superpowers/plans/2026-10-10-gov-report-app.md`.

## 한 것
- `js/pu-gov-report-list.js`(새, 순수 함수): 줄 만들기·상태 가르기·숫자·거르기·챙길 것·양식 서고 현황·건너가는 주소.
- `gov-report.html`(새): 숫자 칸(전체·미작성·초안·검토완료·서명·제출) · 연도·사업·담당·상태·업체·내 담당만 · 목록 · ⚙ 양식 서고 현황(읽기) · ⏰ 챙길 것. 아무것도 쓰지 않는다.
- 포털 타일(의뢰인 업무, 정부사업일정 바로 뒤 📑) · 앱 막대 · 등록부 `govreport`.
- `gov-consulting.html`: `#rpt=업체|사업` → 그 보고서 창 · `#forms` → ⚙ 양식 서고(관리자).

## 왜
- 보고서가 사업장 «크게 보기» 안에만 있어, 어느 업체 보고서가 밀렸는지 한눈에 볼 곳이 없었다(설계서 §11 [F]).

## 남긴 함정
- **줄 열쇠는 정부사업일정과 같아야 한다** — `rid = 사업_첫회차해`(사전진단 뺌). 한쪽만 바꾸면 이 화면의 「초안」이 보고서 창과 다른 자리를 본다.
- 양식은 **사업 종류 이름만으로** 가린다(이알피 사업명 안 읽음). 종류 이름으로 못 가리고 저장본도 없는 사업은 줄이 안 생긴다.
- «회차 모두 종료» = 종료 표시(`endedTypes`)가 있거나, 회차 수 ≥ 정한 회차이고 마지막 회차가 지났을 때.
- `scal_cos`·`scal_types`·`scal_scheds`·`scal_staff` 는 정부사업일정처럼 이름 표(`GR_NODES`)로 부른다 — 등록부에 이 넷의 주인이 아직 안 적혀 있다(정부사업일정 몫).
- 등록부 계약상 소유 자리·쓰기 선언이 꼭 있어야 해서 `data/gov_report_view`(보던 자리)를 «예약»만 했다. 쓰려면 규칙(`cal_view` 꼴)을 먼저 낸다.
- `#rpt=` 는 클라우드가 붙은(`FB_READY`) 뒤에만 연다 — 저장본을 못 읽은 채 열면 빈 초안을 덮어쓸 수 있다.
- 보고서는 줄마다 `scal_reports/{업체}/{rid}` 한 자리씩 읽는다(확정본 사본 `_v` 는 안 읽는다).

## 다음
- 배포 뒤 실제 자료 대조 → 서명③·제출④([D]·[E]).
```

- [ ] **Step 5: 커밋** (PowerShell)

```powershell
git add STATUS.md status/2026-10-10-gov-report-app.md
git commit -m @'
docs(status): 컨설팅보고서 앱(현황판) 기록

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
'@
```

- push·PR 은 컨트롤러가 한다.

---

## 자기 점검 — 설계서 대조

| 설계서 | 작업 |
|---|---|
| §1 포털 타일 + 앱 막대 + 등록부, «모든 앱이 갖춰야 하는 것» 검사 통과 | T2(검사 표) · T5 Step 1 |
| §1 숫자 칸·찾기 조건·목록·서고 현황·챙길 것 | T1 `kpis`/`filterRows`/`buildRows`/`formsStatus`/`alerts` · T3 |
| §1 단추 → `gov-consulting.html#rpt=업체|사업` | T1 `reportHref` · T3 `grRenderRows` · T4 |
| §1 정부사업일정이 `#rpt=` 를 `#sc=` 같은 기다리기로 | T4 `openFromReportLink` |
| §1 「하지 않는다」(창 옮기기·서명/제출 기능·양식 등록·대형) | 손대지 않음 · ③④ 는 빈 칸·0 · 서고는 읽기+`#forms` · 대형은 `resolveFormKey` 로 뺌 |
| §2 읽기만 · 읽는 자리 · 줄 조건 · 상태 넷 · 진행 4칸 · 챙길 것 | Global Constraints · T1 · T3 검사 「아무것도 쓰지 않는다」 |
| §3 숫자 칸 토글 · 내 담당만 · 단추 넷 · 팔레트 · 좁으면 쌓기 | T3 `grSetStatus`·`staffIdFor`·`statusOf.action`·CSS(`@media`) · T2 팔레트 검사 |
| §4 로그인 직원만 · 이름·상태만(기술보호도) · 건너간 뒤 권한은 그대로 | T2 `PuGate` · T1/T3 본문 안 담는 검사 · T4 주석 |
| §5 오류·빈 상태·15초 못 찾음 문구 | T3 ⑥⑦ · T4 |
| §6 만들 것·기록 | T1~T5 |
