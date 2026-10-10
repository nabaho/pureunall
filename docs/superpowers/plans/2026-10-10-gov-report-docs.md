# 컨설팅보고서 앱 — 서류 관리(왼쪽 패널)·목차 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 현황판(`gov-report.html`) 왼쪽에 푸른이알피 «컨설팅 사업»(`data/biz_cons_types`)을 기관별로 묶어 보이고, 사업을 누르면 오른쪽 목록이 그 사업 업체로 걸러지며 «서류 체크표»(간단형은 ①초안 ②확정 자동)와 업체별 «목차 창»(번호 매긴 서류 줄 + 회차 펼침 + 상태 딱지 + 복사)을 보인다. 여전히 아무것도 쓰지 않는다.

**Architecture:** 사업 목록 다듬기·기관 묶기·서류 틀(`DOC_PLANS`)·ERP 연결·업체×사업 쌍·ERP 계약 맞추기·체크표·목차·목차 글은 새 순수 함수 모듈 `js/pu-gov-report-docs.js`(UMD, `window.PuGovReportDocs` / `module.exports`)에 둔다.
- `gov-report.html` 은 «읽고 → 모듈에 넣고 → 그린다» 만 한다. 새 읽기 넷(`data/biz_cons_types`·`data/consultings`·`scal_erpTypeMap`·`data/user_dir`)은 이름 표 `GR_DOC_NODES` 로 부르고(정부사업일정 `FB_NODES` 꼴, 등록부 검사가 글자 그대로의 `ref('scal_…')` 를 주인 없는 자리로 잡지 않게), 실패해도 오른쪽 목록은 그대로 돈다.
- 사업 거르기는 기존 `grFilter()` 의 `type` 에 «ERP 사업 → 정부사업일정 사업 번호»(`scal_erpTypeMap[code]`)를 끼워 넣는 것으로 한다 — 숫자 칸·목록·챙길 것이 함께 걸러진다.
- 새 화면 함수는 `gr` 접두. 화면 검사(`tests/gov-report-app.test.js`)가 이름으로 떠서(vm `grab`) 가짜 DB 로 돌린다.

**Tech Stack:** 빌드 없는 정적 HTML + Firebase RTDB compat 9.23.0 · 브라우저/Node 겸용 UMD js(`js/pu-gov-report-list.js` 꼴) · `node --test` + `vm` · 가짜 RTDB `tests/helpers/fake-rtdb.js`(`쓴것` 쓰기 기록) · 합성 자료 `tests/helpers/gov-report-fixture.js`

**Spec:** `docs/superpowers/specs/2026-10-10-gov-report-docs-design.md` (상위 `docs/superpowers/specs/2026-10-10-gov-report-app-design.md`, 앞 계획 `docs/superpowers/plans/2026-10-10-gov-report-app.md`)

## Global Constraints

- 이 화면은 **아무것도 쓰지 않는다** — 푸른이알피(`data/*`)·`scal_*` 모두. 화면 스크립트에 `.set(`·`.update(`·`.remove(`·`.transaction(`·`ref(…).push(` 가 없어야 하고, 화면 검사는 `db.쓴것.length === 0` 을 확인한다. 규칙 변경·게시 없음.
- 새로 읽는 자리(한 번씩, 통째): `data/biz_cons_types`(모양 `{u, v:[{code,name,short,agency,sortOrder,hidden?,mergedInto?}]}` — `v` 가 목록, 배열·번호 객체 둘 다 받는다) · `data/consultings`(`{u, v:[…]}` 또는 `{u, v:{id:{…}}}`) · `scal_erpTypeMap`(`{ [ERP 코드]: 정부사업일정 사업 번호 }`, gov-consulting.html `getErpTypeMap`) · `data/user_dir`(담당 사번 → 이름).
- 목록에서 **건너뛰는** 사업: `hidden` 이거나 `mergedInto` 가 있는 것. 정렬: `sortOrder` 오름차순(없으면 맨 뒤, 같으면 이름). 기관은 `agency`(빈 값 → `기관 미지정`)로 묶고 묶음 순서는 그 기관의 첫 사업 `sortOrder` 순.
- 연결: `scal_erpTypeMap[code]` 가 있고 그 번호가 `scal_types` 에 있으면 연결. 없으면 맨 끝 `정부사업일정에 사업 없음` 묶음(업체 수 0).
- 서류 틀은 ERP 사업 **이름**(공백 뺀)에 낱말이 들어 있는가로 고른다(코드 `consulting-…` 는 환경마다 다르다). 틀 차례가 뜻이다 — 좁은 낱말 먼저(`산업일자리전환컨설팅충남` → `industry-cn` 이 `산업일자리` → `industry` 보다 앞).
- ①② 자동은 `cci-north`·`cci-seosan`·`techguard` 틀일 때만, `PuGovReportList.buildRows` 줄의 상태(`st.label`: 미작성/작성 전/초안/검토완료 vN)를 그대로 쓴다. ③④⑤ 는 「—」. 다른 틀은 체크표 대신 «서류 목차 보기» 줄.
- `[확인 필요]` 는 지어내지 않고 딱지로 보인다: 틀 `clinic`(`운영지침`)·`rural`(`양식 글자`) 줄마다, ERP 사업 연결 없음 · ERP 계약 못 찾음.
- 목차·체크표에는 업체 이름·담당 이름·날짜·서류 이름·상태만. 연락처(`contacts`)·금액·보고서 본문을 담지도 그리지도 않는다.
- 문구(설계서 §6 그대로): `컨설팅 사업 목록을 불러오지 못했습니다` + `다시 시도` · `환경설정 → 컨설팅관리에 컨설팅 사업이 없습니다` · `[확인 필요] 푸른이알피 계약 못 찾음`.
- innerHTML 에 넣는 바깥 값은 모두 `grEsc` 를 거친다. vm 으로 떠 오는 함수(`grab`)의 글자열 안에 짝 없는 `{`·`}` 를 쓰지 않는다. 정규식에 «글자 뒤 `\n`» 금지(`\r?\n`).
- 색은 저장소 팔레트(`tests/lib-palette.js` 5계열 27색 + `#ffffff`)만 — `gov-report.html` 이 이미 쓰는 CSS 변수(`--blue*`·`--amber*`·`--line` …)와 `#fde68a`(amber) 만 쓴다.
- 공개 저장소다 — 업체·사람은 합성 이름만(가나상사·다라정밀·마바산업·사아테크·홍길동·김가나). ERP 사업 이름·기관 이름(현장클리닉·통합기술보호지원단·비즈니스지원단(중기청) 등)은 공개 사업명이라 그대로 쓴다.
- 캐시 번호: 새 `js/pu-gov-report-docs.js` 는 `gov-report.html` 에서 `?v=1` 로 부른다. 같은 가지에서 이 파일을 다시 고치면 `?v=2`. `js/pu-ontology.js` 를 고치면 부르는 **모든** html(지금 24곳, `?v=60`)을 같은 커밋에서 `?v=61` 로(pre-commit 훅 `scripts/check-cache-version.js`, 검사 `tests/shared-js-cache-version.test.js`). `--no-verify` 금지.
- 작업트리는 CRLF 다(`core.autocrlf=true`). 기존 파일 줄 끝을 바꾸지 않는다(Edit 도구는 그대로 둔다). 새 파일은 LF 로 써도 된다.
- 커밋 메시지는 한국어, 끝에 빈 줄 + `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. 이 방의 Bash 는 따옴표를 씹으므로 커밋은 PowerShell here-string 으로 한다.
- 실행: `node --test tests/<파일>.test.js`. 전체: `node --test "tests/**/*.test.js"`. 통과하는 검사 안의 `✖ 올리지 않았습니다 — 기준이 N일 된 것입니다` 는 날짜 잡음이다.
- push·PR 은 컨트롤러가 한다.

## 파일 구조

| 파일 | 할 일 |
|---|---|
| `js/pu-gov-report-docs.js` (새) | 순수 함수: `rowsOf` · `visibleTypes` · `groupByAgency` · `planFor` · `linkOf` · `pairs` · `sidebarGroups` · `erpTypeFor` · `coKey` · `consCode` · `consFor` · `sidName` · `months` · `docsTable` · `tocFor` · `tocText` + 상수 `DOC_PLANS`·`NONE`·`AUTO`·`KIND_KO`·`COLS`·`NO_AGENCY`·`UNLINKED`·`NO_PLAN` |
| `tests/helpers/gov-report-fixture.js` (고침) | `seed()` 에 `data.biz_cons_types`·`data.consultings`·`scal_erpTypeMap` 더하기 + `docs()` |
| `tests/gov-report-docs.test.js` (새) | 모듈 검사 |
| `gov-report.html` (고침) | T2: 왼쪽 패널 + 읽기 + 사업 거르기 · T3: 서류 체크표 + 목록 「목차」 + 목차 창·복사 |
| `tests/gov-report-app.test.js` (고침) | 화면 검사(이름 목록·ctx 넓히기 + 새 검사) |
| `js/pu-ontology.js` (고침) + html 24개 | `govreport.sharedRoots` 셋 더하기 · `pu-ontology.js?v=60→61` |
| `STATUS.md` (고침), `status/2026-10-10-gov-report-docs.md` (새) | 기록 |

## 자료 꼴 (모든 작업 공통)

```js
data/biz_cons_types = { u, v:[{ code:'consulting-03', name:'통합기술보호지원단', short, agency:'비즈니스지원단(중기청)', sortOrder:3, hidden?, mergedInto? }] }
data/consultings    = { u, v:[…] } 또는 { u, v:{ k1:{…} } }
  행: { id, companyName, company?:{name,bizNo}, bizNo, typeCodes:{consulting:'consulting-03'}, typeCode?, programName, consultingType?,
        startDate:'YYYY-MM-DD', endDate, status, managerMain:'P-009'(사번), contacts:[…](쓰지 않는다) }
scal_erpTypeMap     = { 'consulting-03':'t1', … }
data/user_dir       = [{ sid:'P-009', name:'홍길동', status }] 또는 { v:[…] }
scal_cos 행에 있을 수 있는 것: erpId(이알피 컨설팅 id, gov-consulting findCoForErp), bizNo(있으면)
```

모듈이 만드는 것
```js
visibleTypes(biz) → [{ code, name, short, agency, sortOrder:number|Infinity }]
groupByAgency(types) → [{ agency:'비즈니스지원단(중기청)'|'기관 미지정', types:[…] }]
planFor(name) → { key:'cci-north'|…|'none', words:[…], kind:'간단'|'대형'|'없음', check?:'운영지침', source, items:[{ id, name, per:'once'|'round'|'month', step:'report'|'sign'|'attach'|'submit'|'plat' }] }
pairs(input, typeId, year) → [{ coId, coName, co, typeId, typeName, year, rid, rounds, planned, firstDate, lastDate, attNames:[…] }]   // 이름순
sidebarGroups(biz, tmap, input, year) → [{ agency, unlinked?:true, types:[{ code, name, short, agency, sortOrder, plan, kind, typeId:'t1'|'', count }] }]
docsTable(o) → { plan, auto:boolean, cols:['①초안','②확정','③서명본','④별첨','⑤제출'], lines:[{ coId, coName, typeId, year, rounds, cells:[{txt,key}]×5|null, due:'YYYY-MM-DD'|'' }] }
tocFor(o) → { head:{ coName, bizName, agency, period, manager, rounds, plan, kind, warn:[…] }, items:[{ no, id, name, per, step, subs:['1회차',…], chip:{txt,key}, check:'[확인 필요: …]'|'' }] }
tocText(toc) → 줄바꿈 글
```
(`input` = `PuGovReportList.buildRows` 와 같은 `{ cos, types, scheds, staff, reports, today }`, `key` 는 `todo|wait|draft|done|''` — 화면의 `.st-*` 딱지 이름과 같다)

---

### Task 1: `js/pu-gov-report-docs.js` — 사업 목록 · 기관 묶음 · 서류 틀 · 연결 · 체크표 · 목차

**Files:** Create `js/pu-gov-report-docs.js` · Modify `tests/helpers/gov-report-fixture.js` · Test `tests/gov-report-docs.test.js` (새)

**Interfaces:**
- Consumes: 없음(독립 모듈). 검사는 `require('../js/pu-gov-report-list.js').buildRows(F.input())` 로 줄을 만들어 넘긴다.
- Produces (`window.PuGovReportDocs` / `module.exports`):
  - `rowsOf(v) → object[]` — `{u,v}` 벗기기 + 배열/번호 객체
  - `visibleTypes(biz) → type[]` · `groupByAgency(types) → [{agency, types}]`
  - `planFor(name) → plan` (`DOC_PLANS` 의 한 원소 또는 `NONE`)
  - `linkOf(code, tmap, scalTypes) → 'typeId'|''`
  - `pairs(input, typeId, year) → pair[]`
  - `sidebarGroups(biz, tmap, input, year) → group[]`
  - `erpTypeFor(typeId, biz, tmap) → type|null`
  - `coKey(name) → string` · `consCode(c, biz) → 'code'|''` · `consFor({consultings, co, code, typeId, tmap, biz}) → 행|null` · `sidName(dir, sid) → '이름'|''` · `months(from, to) → ['YYYY-MM']`
  - `docsTable({erp, typeId, input, rows, year, consultings, tmap, biz}) → {plan, auto, cols, lines}`
  - `tocFor({pair, row, erp, cons, dir}) → toc` · `tocText(toc) → string`
  - 상수 `DOC_PLANS` · `NONE` · `AUTO` · `KIND_KO` · `COLS` · `NO_AGENCY`(`'기관 미지정'`) · `UNLINKED`(`'정부사업일정에 사업 없음'`) · `NO_PLAN`(`'서류 틀 없음'`)

- [ ] **Step 1: 합성 자료 넓히기** — `tests/helpers/gov-report-fixture.js`

머리 주석 끝(` *   c5 사아테크 · t1 기술보호 2025 — 검토완료 v2 */`)을 다음으로 바꾼다.

```js
 *   c5 사아테크 · t1 기술보호 2025 — 검토완료 v2
 * 서류 관리(2026-10-10, 설계 2026-10-10-gov-report-docs-design.md) — 사업 이름·기관은 공개 사업명, 업체는 합성
 *   이알피 사업: 01 현장클리닉(→t9, 정부사업일정에 없는 번호) · 02 일터상생혁신컨설팅(→t2) · 03 통합기술보호지원단(→t1)
 *     · 04 인사노무컨설팅충남북부상의(→t3) · 05 인사노무컨설팅서산(→t4) · 06·07 산업일자리 · 09 농촌융복합 · 10 기초컨설팅푸른법인(sortOrder 없음)
 *     · 08 일터혁신상생컨설팅(hidden, 02 로 합침) · 11 혁신바우처컨설팅(mergedInto 만) — 둘은 목록에 안 나온다
 *   이알피 계약: k1 (주)가나상사 03 (2026-05-01~09-30, 담당 P-009) · k2 다라정밀 04 (담당 P-404 = 명부에 없음) — 마바산업은 계약 없음 */
```

`data: { user_dir: [...] },` 줄을 다음으로 바꾼다(`user_dir` 값은 그대로).

```js
    data: {
      user_dir: [{ sid: 'P-009', name: '홍길동', status: 'active' }, { sid: 'P-010', name: '김가나', status: 'retired' }],
      biz_cons_types: { u: 1, v: [
        { code: 'consulting-01', name: '현장클리닉', short: '클리닉', agency: '비즈니스지원단(중기청)', sortOrder: 1 },
        { code: 'consulting-02', name: '일터상생혁신컨설팅', short: '일터', agency: '', sortOrder: 2 },
        { code: 'consulting-03', name: '통합기술보호지원단', short: '기술보호', agency: '비즈니스지원단(중기청)', sortOrder: 3 },
        { code: 'consulting-04', name: '인사노무컨설팅충남북부상의', short: '충남북부', agency: '충남북부상공회의소', sortOrder: 4 },
        { code: 'consulting-05', name: '인사노무컨설팅서산', short: '서산', agency: '서산상공회의소', sortOrder: 5 },
        { code: 'consulting-06', name: '산업일자리전환컨설팅충남', short: '산일충남', agency: '충남경제진흥원', sortOrder: 6 },
        { code: 'consulting-07', name: '산업일자리전환컨설팅능률', short: '산일능률', agency: '한국능률협회', sortOrder: 7 },
        { code: 'consulting-08', name: '일터혁신상생컨설팅', short: '', agency: '', sortOrder: 8, hidden: true, mergedInto: 'consulting-02' },
        { code: 'consulting-09', name: '농촌융복합6차산업현장코칭', short: '6차', agency: '', sortOrder: 9 },
        { code: 'consulting-10', name: '기초컨설팅푸른법인', short: '기초', agency: '' },
        { code: 'consulting-11', name: '혁신바우처컨설팅', short: '바우처', agency: '', sortOrder: 11, mergedInto: 'consulting-10' },
      ] },
      consultings: { u: 1, v: {
        k1: { id: 'k1', companyName: '(주)가나상사', bizNo: '000-00-00001', typeCodes: { consulting: 'consulting-03' },
          programName: '통합기술보호지원단', startDate: '2026-05-01', endDate: '2026-09-30', status: 'active', managerMain: 'P-009',
          amount: 9900000, contacts: [{ name: '연락담당', phone: '010-0000-0000', isPrimary: true }] },
        k2: { id: 'k2', companyName: '다라정밀', typeCodes: { consulting: 'consulting-04' },
          startDate: '2026-08-01', endDate: '2026-12-31', status: 'active', managerMain: 'P-404' },
      } },
    },
    scal_erpTypeMap: { 'consulting-01': 't9', 'consulting-02': 't2', 'consulting-03': 't1', 'consulting-04': 't3', 'consulting-05': 't4' },
```

`module.exports = { seed, input };` 를 다음으로 바꾼다.

```js
/* 서류 관리 모듈 입력 꼴로 */
function docs() {
  const s = seed();
  return { biz: s.data.biz_cons_types, cons: s.data.consultings, tmap: s.scal_erpTypeMap, dir: s.data.user_dir };
}
module.exports = { seed, input, docs };
```

- [ ] **Step 2: 실패하는 검사 작성** — `tests/gov-report-docs.test.js` (새)

```js
'use strict';
/* 컨설팅보고서 앱 — 서류 관리(왼쪽 패널)·목차 순수 함수 (2026-10-10)
 * ★ 지키는 것: 숨김·합친 사업은 빼고 sortOrder 순 · 기관 묶음(빈 기관 = 기관 미지정) · 이름 낱말로 서류 틀 ·
 *   ①② 자동은 간단형 셋만 · [확인 필요] 를 지어내지 않는다 · 목차에 연락처·금액을 담지 않는다
 * 공개 저장소다 — 합성 자료만(tests/helpers/gov-report-fixture.js). */
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../js/pu-gov-report-docs.js');
const L = require('../js/pu-gov-report-list.js');
const F = require('./helpers/gov-report-fixture.js');

const T = '2026-10-10';
const X = F.docs();
const rows = () => L.buildRows(F.input(T));
const code = (c) => D.visibleTypes(X.biz).filter((t) => t.code === c)[0];
const pairOf = (typeId, coId, year) => D.pairs(F.input(T), typeId, year || '2026').filter((p) => p.coId === coId)[0];

test('rowsOf — {u,v} 를 벗기고 배열·번호 객체를 다 받는다(객체가 아닌 것은 버린다)', () => {
  assert.deepEqual(D.rowsOf({ u: 1, v: [{ a: 1 }, null] }), [{ a: 1 }]);
  assert.deepEqual(D.rowsOf({ u: 1, v: { k: { a: 1 } } }), [{ a: 1 }]);
  assert.deepEqual(D.rowsOf([{ a: 1 }]), [{ a: 1 }]);
  assert.deepEqual(D.rowsOf({ u: 1 }), [], 'DB 가 빈 목록을 버리면 {u} 만 남는다');
  assert.deepEqual(D.rowsOf(null), []);
});

test('visibleTypes — 숨김·합친 사업은 빼고 sortOrder 순(없으면 맨 뒤)', () => {
  assert.deepEqual(D.visibleTypes(X.biz).map((t) => t.code), ['consulting-01', 'consulting-02', 'consulting-03', 'consulting-04',
    'consulting-05', 'consulting-06', 'consulting-07', 'consulting-09', 'consulting-10']);
  assert.deepEqual(D.visibleTypes([{ code: 'b', name: '나' }, { code: 'a', name: '가' }]).map((t) => t.code), ['a', 'b'], '같으면 이름순');
  assert.deepEqual(D.visibleTypes(null), []);
});

test('groupByAgency — 빈 기관은 「기관 미지정」, 묶음 차례는 그 기관 첫 사업의 sortOrder', () => {
  const g = D.groupByAgency(D.visibleTypes(X.biz));
  assert.deepEqual(g.map((x) => [x.agency, x.types.map((t) => t.code)]), [
    ['비즈니스지원단(중기청)', ['consulting-01', 'consulting-03']],
    ['기관 미지정', ['consulting-02', 'consulting-09', 'consulting-10']],
    ['충남북부상공회의소', ['consulting-04']],
    ['서산상공회의소', ['consulting-05']],
    ['충남경제진흥원', ['consulting-06']],
    ['한국능률협회', ['consulting-07']],
  ]);
});

test('planFor — ERP 사업 이름(공백 뺀) 낱말로 틀을 고른다 · 좁은 낱말이 먼저', () => {
  const k = (n) => D.planFor(n).key;
  assert.equal(k('인사노무컨설팅충남북부상의'), 'cci-north');
  assert.equal(k('인사노무컨설팅서산'), 'cci-seosan');
  assert.equal(k('통합기술보호지원단'), 'techguard');
  assert.equal(k('현장클리닉'), 'clinic');
  assert.equal(k(' 현장 클리닉 '), 'clinic', '공백은 빼고 본다');
  assert.equal(k('농촌융복합6차산업현장코칭'), 'rural');
  assert.equal(k('일터상생혁신컨설팅'), 'workplace');
  assert.equal(k('일터혁신상생컨설팅'), 'workplace');
  assert.equal(k('산업일자리전환컨설팅충남'), 'industry-cn');
  assert.equal(k('산업일자리전환컨설팅능률'), 'industry');
  ['기초컨설팅푸른법인', '사회적기업컨설팅', '혁신바우처컨설팅', '노동전환컨설팅', '', null].forEach((n) => assert.equal(k(n), 'none', String(n)));
  assert.deepEqual(D.planFor('인사노무컨설팅충남북부상의').items.map((x) => x.name), ['결과보고서', '업체 서명본', '산출물 별첨', '기관 제출']);
  assert.deepEqual(D.planFor('인사노무컨설팅서산').items.map((x) => x.id + ':' + x.per), ['visit:round', 'report:once', 'sign:once', 'attach:once', 'submit:once']);
  assert.equal(D.planFor('현장클리닉').check, '운영지침');
  assert.equal(D.planFor('농촌융복합6차산업현장코칭').check, '양식 글자');
  assert.equal(D.planFor('산업일자리전환컨설팅충남').items[1].per, 'month');
  assert.equal(D.planFor('없는사업').kind, '없음');
  assert.deepEqual(D.planFor('없는사업').items, []);
});

test('DOC_PLANS — 틀마다 kind·source·줄이 있고, 줄 id 는 겹치지 않으며 per·step 은 정한 값만', () => {
  const PER = ['once', 'round', 'month'], STEP = ['report', 'sign', 'attach', 'submit', 'plat'];
  assert.deepEqual(D.DOC_PLANS.map((p) => p.key), ['industry-cn', 'cci-north', 'cci-seosan', 'techguard', 'clinic', 'rural', 'workplace', 'industry']);
  D.DOC_PLANS.forEach((p) => {
    assert.ok(['간단', '대형'].includes(p.kind), p.key);
    assert.ok(p.source && p.items.length, p.key);
    assert.equal(new Set(p.items.map((x) => x.id)).size, p.items.length, p.key + ' id 겹침');
    p.items.forEach((x) => { assert.ok(PER.includes(x.per), p.key + '/' + x.id); assert.ok(STEP.includes(x.step), p.key + '/' + x.id); });
  });
  assert.deepEqual(Object.keys(D.AUTO).sort(), ['cci-north', 'cci-seosan', 'techguard']);
});

test('linkOf · pairs — 이음표 번호가 정부사업일정에 있어야 연결 · 지운 업체·사전진단·다른 해는 뺀다', () => {
  const tys = F.input(T).types;
  assert.equal(D.linkOf('consulting-03', X.tmap, tys), 't1');
  assert.equal(D.linkOf('consulting-01', X.tmap, tys), '', 't9 는 정부사업일정에 없다');
  assert.equal(D.linkOf('consulting-06', X.tmap, tys), '');
  assert.equal(D.linkOf('consulting-03', null, tys), '');
  const p = D.pairs(F.input(T), 't1', '2026');
  assert.deepEqual(p.map((x) => x.coId), ['c1']);
  assert.deepEqual([p[0].year, p[0].rid, p[0].rounds, p[0].planned, p[0].firstDate, p[0].lastDate], ['2026', 't1_2026', 3, 3, '2026-06-02', '2026-08-04']);
  assert.deepEqual(p[0].attNames, ['홍길동']);
  assert.deepEqual(D.pairs(F.input(T), 't1', '').map((x) => x.coName), ['가나상사', '사아테크'], '해를 안 주면 모두, 이름순');
  assert.equal(D.pairs(F.input(T), 't2', '2026')[0].planned, 8);
  assert.deepEqual(D.pairs(null, 't1', '2026'), []);
});

test('sidebarGroups — 연결된 것은 기관별, 연결 없는 것은 맨 끝 「정부사업일정에 사업 없음」(업체 0)', () => {
  const g = D.sidebarGroups(X.biz, X.tmap, F.input(T), '2026');
  assert.deepEqual(g.map((x) => [x.agency, x.types.map((t) => t.code + ':' + t.plan + ':' + t.typeId + ':' + t.count)]), [
    ['기관 미지정', ['consulting-02:workplace:t2:1']],
    ['비즈니스지원단(중기청)', ['consulting-03:techguard:t1:1']],
    ['충남북부상공회의소', ['consulting-04:cci-north:t3:1']],
    ['서산상공회의소', ['consulting-05:cci-seosan:t4:1']],
    ['정부사업일정에 사업 없음', ['consulting-01:clinic::0', 'consulting-06:industry-cn::0', 'consulting-07:industry::0',
      'consulting-09:rural::0', 'consulting-10:none::0']],
  ]);
  assert.equal(g[4].unlinked, true);
  const y25 = D.sidebarGroups(X.biz, X.tmap, F.input(T), '2025');
  assert.equal(y25[1].types[0].count, 1, '2025 기술보호는 사아테크');
  assert.equal(y25[0].types[0].count, 0);
  assert.deepEqual(D.sidebarGroups(null, X.tmap, F.input(T), '2026'), []);
});

test('erpTypeFor — 정부사업일정 사업 번호 → 그 번호에 이어진 첫 ERP 사업(숨김 뺌)', () => {
  assert.equal(D.erpTypeFor('t1', X.biz, X.tmap).code, 'consulting-03');
  assert.equal(D.erpTypeFor('t2', X.biz, X.tmap).name, '일터상생혁신컨설팅');
  assert.equal(D.erpTypeFor('tx', X.biz, X.tmap), null);
  assert.equal(D.erpTypeFor('', X.biz, X.tmap), null);
});

test('consCode · consFor — 이알피 계약 맞추기: erpId → 사업자번호 → 이름, 사업은 코드 → 이음표', () => {
  assert.equal(D.coKey('(주)가나상사'), '가나상사');
  assert.equal(D.coKey('주식회사 다라 정밀'), '다라정밀');
  assert.equal(D.consCode({ typeCodes: { consulting: 'consulting-04' } }, X.biz), 'consulting-04');
  assert.equal(D.consCode({ programName: '인사노무컨설팅 서산' }, X.biz), 'consulting-05', '코드가 없으면 이름으로');
  assert.equal(D.consCode({ programName: '없는사업' }, X.biz), '');
  const S = F.seed().scal_cos;
  const co = (id) => S.filter((c) => c.id === id)[0];
  const f = (c, cd, ty, cons) => D.consFor({ consultings: cons || X.cons, co: c, code: cd, typeId: ty, tmap: X.tmap, biz: X.biz });
  assert.equal(f(co('c1'), 'consulting-03', 't1').id, 'k1', '(주) 를 떼고 이름으로');
  assert.equal(f(co('c2'), 'consulting-04', 't3').id, 'k2');
  assert.equal(f(co('c3'), 'consulting-05', 't4'), null, '마바산업은 계약이 없다');
  assert.equal(f({ id: 'cz', name: '전혀다른이름', erpId: 'k2' }, 'consulting-04', 't3').id, 'k2', 'erpId 가 먼저');
  assert.equal(f({ id: 'cz', name: '다른이름', bizNo: '0000000001' }, 'consulting-03', 't1').id, 'k1', '사업자번호(숫자만 견줌)');
  assert.equal(f({ id: 'cz', name: '가나상사', bizNo: '999-99-99999' }, 'consulting-03', 't1'), null, '사업자번호가 둘 다 있고 다르면 이름이 같아도 아니다');
  assert.equal(f(co('c1'), 'consulting-01', 't9'), null, '사업이 다르면 아니다');
  const byName = [{ id: 'k9', companyName: '가나상사', programName: '통합기술보호지원단', startDate: '2026-01-01' }];
  assert.equal(f(co('c1'), 'consulting-zz', 't1', byName).id, 'k9', '코드가 달라도 이음표로 같은 사업이면');
});

test('docsTable — 간단형은 ①② 를 buildRows 상태로, ③④⑤ 는 「—」 · 기한은 이알피 계약 종료일', () => {
  const t = D.docsTable({ erp: code('consulting-03'), typeId: 't1', input: F.input(T), rows: rows(), year: '2026',
    consultings: X.cons, tmap: X.tmap, biz: X.biz });
  assert.equal(t.plan.key, 'techguard');
  assert.equal(t.auto, true);
  assert.deepEqual(t.cols, ['①초안', '②확정', '③서명본', '④별첨', '⑤제출']);
  assert.equal(t.lines.length, 1);
  assert.equal(t.lines[0].coName, '가나상사');
  assert.deepEqual(t.lines[0].cells.map((c) => c.txt + '/' + c.key), ['초안/draft', '—/', '—/', '—/', '—/']);
  assert.equal(t.lines[0].due, '2026-09-30');
  const s = D.docsTable({ erp: code('consulting-05'), typeId: 't4', input: F.input(T), rows: rows(), year: '2026',
    consultings: X.cons, tmap: X.tmap, biz: X.biz });
  assert.deepEqual(s.lines[0].cells[0], { txt: '미작성', key: 'todo' });
  assert.equal(s.lines[0].due, '', '계약을 못 찾으면 기한은 비운다');
  const d = D.docsTable({ erp: code('consulting-03'), typeId: 't1', input: F.input(T), rows: rows(), year: '2025',
    consultings: X.cons, tmap: X.tmap, biz: X.biz });
  assert.deepEqual(d.lines[0].cells.slice(0, 2), [{ txt: '✓', key: 'done' }, { txt: '검토완료 v2', key: 'done' }]);
});

test('docsTable — 대형·틀 없음은 체크표 없이 줄만 · 연결 없으면 줄도 없다', () => {
  const w = D.docsTable({ erp: code('consulting-02'), typeId: 't2', input: F.input(T), rows: rows(), year: '2026',
    consultings: X.cons, tmap: X.tmap, biz: X.biz });
  assert.equal(w.plan.key, 'workplace');
  assert.equal(w.auto, false);
  assert.deepEqual(w.lines.map((x) => [x.coName, x.cells]), [['가나상사', null]]);
  const u = D.docsTable({ erp: code('consulting-06'), typeId: '', input: F.input(T), rows: rows(), year: '2026' });
  assert.deepEqual(u.lines, []);
  assert.equal(D.docsTable({}).plan.key, 'none');
});

test('tocFor — 머리말(계약 기간·담당·회차)과 번호 줄, 회차 펼침, ①② 딱지는 report 줄만', () => {
  const r = rows().filter((x) => x.coId === 'c1' && x.typeId === 't1')[0];
  const t = D.tocFor({ pair: pairOf('t1', 'c1'), row: r, erp: code('consulting-03'), cons: X.cons.v.k1, dir: X.dir });
  assert.deepEqual(t.head, { coName: '가나상사', bizName: '통합기술보호지원단', agency: '비즈니스지원단(중기청)',
    period: '2026-05-01 ~ 2026-09-30', manager: '홍길동', rounds: 3, plan: 'techguard', kind: '간단', warn: [] });
  assert.deepEqual(t.items.map((x) => x.no + '.' + x.name), ['1.별지11 완료보고서', '2.법률 자문 일지', '3.보안서약서',
    '4.별지8 여비지급신청서', '5.만족도조사', '6.기관 제출(기술보호울타리)']);
  assert.deepEqual(t.items[0].chip, { txt: '초안', key: 'draft' });
  assert.deepEqual(t.items[1].chip, { txt: '—', key: '' });
  assert.deepEqual(t.items[1].subs, ['1회차', '2회차', '3회차']);
  assert.equal(t.items[0].check, '');
  const s = JSON.stringify(t);
  ['010-0000-0000', '연락담당', '9900000'].forEach((x) => assert.ok(!s.includes(x), '목차에 ' + x + ' 가 들어갔다'));
});

test('tocFor — 계약을 못 찾으면 [확인 필요] + 회차 날짜로 기간, 담당은 정부사업일정 담당', () => {
  const r = rows().filter((x) => x.coId === 'c3')[0];
  const t = D.tocFor({ pair: pairOf('t4', 'c3'), row: r, erp: code('consulting-05'), cons: null, dir: X.dir });
  assert.deepEqual(t.head.warn, ['[확인 필요] 푸른이알피 계약 못 찾음']);
  assert.equal(t.head.period, '2026-03-03 ~ 2026-05-12 (회차 날짜)');
  assert.equal(t.head.manager, '김가나');
  assert.equal(t.items[0].name, '방문확인서');
  assert.deepEqual(t.items[0].subs, ['1회차', '2회차', '3회차']);
  assert.deepEqual(t.items[0].chip, { txt: '미작성', key: 'todo' });
  const n = D.tocFor({ pair: pairOf('t3', 'c2'), row: null, erp: code('consulting-04'), cons: X.cons.v.k2, dir: X.dir });
  assert.equal(n.head.manager, '김가나·홍길동', '명부에 없는 사번이면 정부사업일정 담당');
  assert.equal(n.head.rounds, 3, '회차 수 = 잡힌 회차와 정한 회차 중 큰 것');
});

test('tocFor — 연결 없음 · 틀 없음 · [확인 필요] 틀 · 대형 회차 · 월별', () => {
  const p = pairOf('t1', 'c1');
  const a = D.tocFor({ pair: p, row: null, erp: null, cons: null, dir: X.dir });
  assert.deepEqual(a.head.warn, ['[확인 필요] 푸른이알피 사업 연결 없음', '[확인 필요] 푸른이알피 계약 못 찾음']);
  assert.equal(a.head.bizName, '기술보호 컨설팅', '연결이 없으면 정부사업일정 사업 이름');
  assert.equal(a.head.plan, 'techguard', '틀은 그 이름으로 고른다');
  assert.equal(a.head.agency, '');
  const none = D.tocFor({ pair: p, erp: code('consulting-10'), cons: null });
  assert.deepEqual(none.items, []);
  assert.equal(none.head.kind, '없음');
  const cl = D.tocFor({ pair: p, erp: code('consulting-01'), cons: null });
  assert.ok(cl.items.length && cl.items.every((x) => x.check === '[확인 필요: 운영지침]'));
  assert.equal(cl.items[0].chip.txt, '—', '현장클리닉은 자동 상태가 없다');
  const wp = D.tocFor({ pair: pairOf('t2', 'c1'), erp: code('consulting-02'), cons: null });
  assert.equal(wp.items.filter((x) => x.per === 'round')[0].subs.length, 8, '정한 회차 8');
  const cn = D.tocFor({ pair: p, erp: code('consulting-06'), cons: { startDate: '2026-03-15', endDate: '2026-06-10' } });
  assert.deepEqual(cn.items[1].subs, ['2026-03', '2026-04', '2026-05', '2026-06']);
  assert.deepEqual(D.months('2026-11-01', '2027-02-01'), ['2026-11', '2026-12', '2027-01', '2027-02']);
  assert.deepEqual(D.months('', '2026-01-01'), []);
});

test('tocText — 복사용 글(머리말·[확인 필요]·번호 줄·회차 줄)', () => {
  const r = rows().filter((x) => x.coId === 'c1' && x.typeId === 't1')[0];
  const t = D.tocFor({ pair: pairOf('t1', 'c1'), row: r, erp: code('consulting-03'), cons: X.cons.v.k1, dir: X.dir });
  assert.equal(D.tocText(t), [
    '목차 — 가나상사',
    '사업: 통합기술보호지원단 (비즈니스지원단(중기청)) · 간단형',
    '계약 기간: 2026-05-01 ~ 2026-09-30 · 담당: 홍길동 · 회차 3',
    '1. 별지11 완료보고서 (초안)',
    '2. 법률 자문 일지 (—)',
    '   - 1회차',
    '   - 2회차',
    '   - 3회차',
    '3. 보안서약서 (—)',
    '4. 별지8 여비지급신청서 (—)',
    '5. 만족도조사 (—)',
    '6. 기관 제출(기술보호울타리) (—)',
  ].join('\n'));
  const cl = D.tocText(D.tocFor({ pair: pairOf('t1', 'c1'), erp: code('consulting-01'), cons: null }));
  assert.ok(cl.includes('[확인 필요] 푸른이알피 계약 못 찾음'));
  assert.ok(cl.includes('1. 상담일지 (—) [확인 필요: 운영지침]'));
  const no = D.tocText(D.tocFor({ pair: pairOf('t1', 'c1'), erp: code('consulting-10'), cons: null }));
  assert.ok(no.includes('사업: 기초컨설팅푸른법인 (기관 미지정) · 서류 틀 없음'));
  assert.ok(no.includes('서류 틀 없음 — 목차는 머리말만'));
});
```

- [ ] **Step 3: 실패 확인**

Run: `node --test tests/gov-report-docs.test.js`
Expected: FAIL — `Cannot find module '../js/pu-gov-report-docs.js'`

- [ ] **Step 4: 구현** — `js/pu-gov-report-docs.js` (새)

```js
'use strict';
/* 컨설팅보고서 앱(gov-report.html) — 서류 관리(왼쪽 패널)·목차의 순수 함수 (브라우저 window.PuGovReportDocs / Node 겸용)
   (대표 지시 2026-10-10 「대시보드 왼쪽에 서류(페이퍼) 관리」 · 「환경설정 → 컨설팅관리 → 컨설팅 사업과 연계해 목차」
    · 설계 docs/superpowers/specs/2026-10-10-gov-report-docs-design.md · 계획 docs/superpowers/plans/2026-10-10-gov-report-docs.md)
   무엇을 지키나
     · 읽기만 한다 — 받은 값으로 사업 목록·체크표·목차를 만들 뿐 아무 데도 쓰지 않는다.
     · 서류 틀은 ERP 사업 «이름»(공백 뺀)에 낱말이 들어 있는가로 고른다 — 코드(consulting-…)는 환경마다 다르다.
       DOC_PLANS 차례가 뜻이다: 좁은 낱말이 먼저(산업일자리전환컨설팅충남 → 산업일자리).
     · ①② 자동은 정부사업일정 보고서 창이 채우는 간단형 셋(AUTO)만 — 현황판 줄(buildRows)의 상태를 그대로 쓴다.
     · [확인 필요] 는 지어내지 않고 딱지로 보인다(현장클리닉 운영지침 · 농촌융복합 양식 글자 · 연결·계약 못 찾음).
     · 목차에는 업체 이름·담당 이름·날짜·서류 이름·상태만 — 연락처·금액·보고서 본문은 담지 않는다.
   ⚠ 업체×사업 쌍(pairs)은 pu-gov-report-list.js candidates 와 같은 조건이다(지운 업체 뺌 · 사전진단 뺀 회차 · 해 = 첫 회차).
     한쪽만 바꾸면 체크표와 목록이 다른 업체를 센다.
   ⚠ 저장소는 공개다 — 검사는 합성 자료만 쓴다. */
(function (root) {
  var NO_AGENCY = '기관 미지정';
  var UNLINKED = '정부사업일정에 사업 없음';
  var NO_PLAN = '서류 틀 없음';
  var SOURCE = '컨설팅보고서_사업별_양식·항목_정리_2026-10-09.md §2';
  var AUTO = { 'cci-north': true, 'cci-seosan': true, techguard: true };
  var KIND_KO = { '간단': '간단형', '대형': '대형', '없음': NO_PLAN };
  var COLS = ['①초안', '②확정', '③서명본', '④별첨', '⑤제출'];
  /* gov-consulting.html CO_CORP_RE 의 줄인 꼴 — 이름 견주기에서 법인 표기를 뗀다 */
  var CORP_RE = /(주식회사|유한회사|유한책임회사|합자회사|합명회사|사단법인|재단법인|농업회사법인|영농조합법인|㈜|\(주\)|\(유\)|\(사\)|\(재\))/g;

  function str(v) { return v == null ? '' : String(v).trim(); }
  function squash(v) { return str(v).replace(/\s+/g, ''); }
  function digits(v) { return str(v).replace(/\D/g, ''); }
  function it(id, name, per, step) { return { id: id, name: name, per: per, step: step }; }

  var DOC_PLANS = [
    { key: 'industry-cn', words: ['산업일자리전환컨설팅충남'], kind: '대형', source: SOURCE, items: [
      it('log', '수행일지', 'once', 'plat'),
      it('monthly', '월별 수행실적보고서', 'month', 'report'),
      it('result', '결과보고서', 'once', 'report'),
      it('after', '사후관리 결과보고서', 'once', 'report')] },
    { key: 'cci-north', words: ['충남북부'], kind: '간단', source: SOURCE, items: [
      it('report', '결과보고서', 'once', 'report'),
      it('sign', '업체 서명본', 'once', 'sign'),
      it('attach', '산출물 별첨', 'once', 'attach'),
      it('submit', '기관 제출', 'once', 'submit')] },
    { key: 'cci-seosan', words: ['서산'], kind: '간단', source: SOURCE, items: [
      it('visit', '방문확인서', 'round', 'report'),
      it('report', '상담·자문 결과보고서', 'once', 'report'),
      it('sign', '업체 서명본', 'once', 'sign'),
      it('attach', '산출물 별첨', 'once', 'attach'),
      it('submit', '기관 제출', 'once', 'submit')] },
    { key: 'techguard', words: ['기술보호'], kind: '간단', source: SOURCE, items: [
      it('report', '별지11 완료보고서', 'once', 'report'),
      it('advice', '법률 자문 일지', 'round', 'attach'),
      it('pledge', '보안서약서', 'once', 'attach'),
      it('travel', '별지8 여비지급신청서', 'once', 'attach'),
      it('survey', '만족도조사', 'once', 'attach'),
      it('submit', '기관 제출(기술보호울타리)', 'once', 'submit')] },
    { key: 'clinic', words: ['현장클리닉'], kind: '간단', check: '운영지침', source: SOURCE, items: [
      it('log', '상담일지', 'round', 'report'),
      it('track', '별지24 성과추적관리결과서', 'once', 'report'),
      it('submit', '기관 제출', 'once', 'submit')] },
    { key: 'rural', words: ['농촌융복합'], kind: '간단', check: '양식 글자', source: SOURCE, items: [
      it('plan', '사업계획서', 'once', 'report'),
      it('result', '결과보고서', 'round', 'report'),
      it('receipt', '수당 영수증·청렴서약서', 'once', 'attach'),
      it('photo', '현장 사진', 'once', 'attach')] },
    /* 이알피 이름이 「일터상생혁신컨설팅」이다(옛 「일터혁신상생컨설팅」은 숨김·합침) — 낱말 둘 다 본다 */
    { key: 'workplace', words: ['일터혁신', '일터상생혁신'], kind: '대형', source: SOURCE, items: [
      it('guide', '참여 안내서(서명)', 'once', 'sign'),
      it('plan', '수행계획서', 'once', 'plat'),
      it('round', '회차별 수행보고서+사진2장+서명지', 'round', 'plat'),
      it('kickoff', '착수보고', 'once', 'report'),
      it('mid', '중간보고', 'once', 'report'),
      it('final', '최종보고', 'once', 'report'),
      it('follow', '이행관리 등록', 'once', 'plat'),
      it('outcome', '이행결과표', 'once', 'report')] },
    { key: 'industry', words: ['산업일자리'], kind: '대형', source: SOURCE, items: [
      it('kickoff', '착수보고서(PPT)', 'once', 'report'),
      it('plan', '수행계획서', 'once', 'report'),
      it('mdlog', 'MD별 수행일지', 'round', 'report'),
      it('final', '최종결과보고서', 'once', 'report'),
      it('meeting', '최종보고회', 'once', 'report'),
      it('link', '연계지원사업 등록', 'once', 'plat'),
      it('done', '완료보고서(요약)', 'once', 'report')] },
  ];
  var NONE = { key: 'none', words: [], kind: '없음', source: '', items: [] };

  /* {u, v} 를 벗기고 배열·번호 객체를 다 받는다 — 객체가 아닌 것은 버린다 */
  function rowsOf(v) {
    if (v && typeof v === 'object' && !Array.isArray(v) && v.v !== undefined) v = v.v;
    var a = Array.isArray(v) ? v : (v && typeof v === 'object' ? Object.keys(v).map(function (k) { return v[k]; }) : []);
    return a.filter(function (x) { return x && typeof x === 'object'; });
  }
  /* pu-gov-report-list.js list 와 같다 — id 가 있는 것만 */
  function list(v) {
    var a = Array.isArray(v) ? v : (v && typeof v === 'object' ? Object.keys(v).map(function (k) { return v[k]; }) : []);
    return a.filter(function (x) { return x && x.id; });
  }
  function isDay(d) { return /^\d{4}-\d{2}-\d{2}$/.test(str(d)); }
  /* pu-gov-report-list.js coAtts 와 같은 차례(gov-consulting getCoAtts) */
  function coAtts(o) {
    if (!o) return [];
    if (Array.isArray(o.coAttIds)) return o.coAttIds.filter(Boolean);
    if (Array.isArray(o.defCoAtts)) return o.defCoAtts.filter(Boolean);
    if (o.coAttId) return [o.coAttId];
    if (o.defCoAtt) return [o.defCoAtt];
    return [];
  }
  function uniq(a) { var seen = {}; return a.filter(function (x) { if (!x || seen[x]) return false; seen[x] = 1; return true; }); }
  function order(t) { return (t.sortOrder != null && t.sortOrder !== '' && isFinite(+t.sortOrder)) ? +t.sortOrder : Infinity; }
  function byOrder(a, b) {
    var x = order(a), y = order(b);
    if (x !== y) return x < y ? -1 : 1;
    return str(a.name).localeCompare(str(b.name), 'ko');
  }

  function visibleTypes(biz) {
    return rowsOf(biz).filter(function (t) { return str(t.code) && str(t.name) && !t.hidden && !str(t.mergedInto); })
      .map(function (t) { return { code: str(t.code), name: str(t.name), short: str(t.short), agency: str(t.agency), sortOrder: order(t) }; })
      .sort(byOrder);
  }
  function groupByAgency(types) {
    var out = [], at = {};
    (types || []).slice().sort(byOrder).forEach(function (t) {
      var a = str(t.agency) || NO_AGENCY;
      if (!(a in at)) { at[a] = out.length; out.push({ agency: a, types: [] }); }
      out[at[a]].types.push(t);
    });
    return out;
  }
  function planFor(name) {
    var n = squash(name);
    if (!n) return NONE;
    for (var i = 0; i < DOC_PLANS.length; i++) {
      var p = DOC_PLANS[i];
      if (p.words.some(function (w) { return n.indexOf(w) >= 0; })) return p;
    }
    return NONE;
  }
  function linkOf(code, tmap, scalTypes) {
    var id = str(tmap && typeof tmap === 'object' ? tmap[code] : '');
    if (!id) return '';
    return list(scalTypes).some(function (t) { return t.id === id; }) ? id : '';
  }

  function pairs(input, typeId, year) {
    input = input || {};
    var t = list(input.types).filter(function (x) { return x.id === typeId; })[0];
    if (!t) return [];
    var names = {};
    list(input.staff).forEach(function (s) { names[s.id] = str(s.name); });
    var sc = list(input.scheds).filter(function (s) { return s.typeId === typeId && s.phase !== 'pre' && isDay(s.date); });
    var out = [];
    list(input.cos).forEach(function (co) {
      if (co.deleted || !(Array.isArray(co.types) && co.types.indexOf(typeId) >= 0)) return;
      var ds = sc.filter(function (s) { return s.coId === co.id; }).map(function (s) { return str(s.date); }).sort();
      if (!ds.length) return;
      var y = ds[0].slice(0, 4);
      if (year && y !== String(year)) return;
      var cr = co.customRounds && co.customRounds[typeId];
      var planned = (cr !== undefined && cr !== null && cr !== '') ? (+cr || 0) : (+t.rounds || 0);
      var attIds = uniq([str(co.defAtt)].concat(coAtts(co)));
      out.push({ coId: co.id, coName: str(co.name), co: co, typeId: typeId, typeName: str(t.fullName) || str(t.name),
        year: y, rid: String(typeId) + '_' + y, rounds: ds.length, planned: planned, firstDate: ds[0], lastDate: ds[ds.length - 1],
        attNames: attIds.map(function (id) { return names[id] || ''; }).filter(Boolean) });
    });
    return out.sort(function (a, b) { return a.coName.localeCompare(b.coName, 'ko'); });
  }

  function sidebarGroups(biz, tmap, input, year) {
    var linked = [], unlinked = [];
    visibleTypes(biz).forEach(function (t) {
      var p = planFor(t.name), id = linkOf(t.code, tmap, (input || {}).types);
      var item = { code: t.code, name: t.name, short: t.short, agency: t.agency, sortOrder: t.sortOrder,
        plan: p.key, kind: p.kind, typeId: id, count: id ? pairs(input, id, year).length : 0 };
      (id ? linked : unlinked).push(item);
    });
    var g = groupByAgency(linked);
    if (unlinked.length) g.push({ agency: UNLINKED, unlinked: true, types: unlinked });
    return g;
  }
  function erpTypeFor(typeId, biz, tmap) {
    if (!typeId || !tmap || typeof tmap !== 'object') return null;
    return visibleTypes(biz).filter(function (t) { return str(tmap[t.code]) === typeId; })[0] || null;
  }

  function coKey(s) { return str(s).replace(CORP_RE, '').replace(/[\s·,.\-_'"()（）]/g, '').toLowerCase(); }
  /* gov-consulting.html erpConsCode 와 같은 차례 — 코드 칸 → 사업 이름(이름·줄인 이름) */
  function consCode(c, biz) {
    c = c || {};
    var tc = c.typeCodes || {};
    var code = str(tc.consulting || tc.consult || c.typeCode);
    if (code) return code;
    var nm = squash(c.consultingType || c.programName || c.type);
    if (!nm) return '';
    var t = rowsOf(biz).filter(function (x) { return squash(x.name) === nm || (str(x.short) && squash(x.short) === nm); })[0];
    return t ? str(t.code) : '';
  }
  /* 이 업체·이 사업의 이알피 계약 — 업체는 erpId → 사업자번호 → 이름, 사업은 코드 → 이음표. 여럿이면 늦게 시작한 것 */
  function consFor(o) {
    o = o || {};
    var co = o.co || {}, bn = digits(co.bizNo), ck = coKey(co.name), tm = o.tmap || {};
    var mine = rowsOf(o.consultings).filter(function (c) {
      if (str(co.erpId) && str(c.id) === str(co.erpId)) return true;
      var cc = (c.company && typeof c.company === 'object') ? c.company : {};
      var cb = digits(cc.bizNo || c.bizNo);
      if (bn && cb) return bn === cb;
      return !!ck && coKey(cc.name || c.companyName) === ck;
    });
    var hit = mine.filter(function (c) { return !!o.code && consCode(c, o.biz) === o.code; });
    if (!hit.length) hit = mine.filter(function (c) { var k = consCode(c, o.biz); return !!k && !!o.typeId && str(tm[k]) === str(o.typeId); });
    hit.sort(function (a, b) { return str(b.startDate).localeCompare(str(a.startDate)); });
    return hit[0] || null;
  }
  function sidName(dir, sid) {
    var k = str(sid);
    if (!k) return '';
    var u = rowsOf(dir).filter(function (x) { return str(x.sid) === k || str(x.id) === k || str(x.empNo) === k; })[0];
    return u ? str(u.name || u.userName) : '';
  }
  function months(from, to) {
    var a = /^(\d{4})-(\d{2})/.exec(str(from)), b = /^(\d{4})-(\d{2})/.exec(str(to));
    if (!a || !b) return [];
    var y = +a[1], m = +a[2], end = (+b[1]) * 12 + (+b[2]), out = [];
    while (y * 12 + m <= end && out.length < 36) {
      out.push(y + '-' + (m < 10 ? '0' : '') + m);
      m++; if (m > 12) { m = 1; y++; }
    }
    return out;
  }
  function range(n) { var a = []; for (var i = 1; i <= n; i++) a.push(i + '회차'); return a; }

  var DASH = { txt: '—', key: '' };
  function chips(r) {
    var out = [DASH, DASH, DASH, DASH, DASH];
    if (!r || !r.st) return out;
    if (r.st.key === 'done') { out[0] = { txt: '✓', key: 'done' }; out[1] = { txt: r.st.label, key: 'done' }; }
    else out[0] = { txt: r.st.label, key: r.st.key };
    return out;
  }
  function docsTable(o) {
    o = o || {};
    var erp = o.erp || null, plan = planFor(erp ? erp.name : ''), auto = !!AUTO[plan.key];
    var byCo = {};
    (o.rows || []).forEach(function (r) { if (r && r.typeId === o.typeId) byCo[r.coId + '|' + r.year] = r; });
    var lines = o.typeId ? pairs(o.input, o.typeId, o.year).map(function (p) {
      var r = byCo[p.coId + '|' + p.year] || null;
      var cons = consFor({ consultings: o.consultings, co: p.co, code: erp ? erp.code : '', typeId: o.typeId, tmap: o.tmap, biz: o.biz });
      return { coId: p.coId, coName: p.coName, typeId: p.typeId, year: p.year, rounds: p.rounds,
        cells: auto ? chips(r) : null, due: cons ? str(cons.endDate).slice(0, 10) : '' };
    }) : [];
    return { plan: plan, auto: auto, cols: COLS.slice(), lines: lines };
  }

  function tocFor(o) {
    o = o || {};
    var p = o.pair || {}, erp = o.erp || null, cons = o.cons || null, r = o.row || null;
    var plan = planFor(erp ? erp.name : p.typeName), auto = !!AUTO[plan.key];
    var warn = [];
    if (!erp) warn.push('[확인 필요] 푸른이알피 사업 연결 없음');
    if (!cons) warn.push('[확인 필요] 푸른이알피 계약 못 찾음');
    var s = str(cons && cons.startDate).slice(0, 10), e = str(cons && cons.endDate).slice(0, 10);
    var period = (s || e) ? (s || '?') + ' ~ ' + (e || '?')
      : (p.firstDate ? p.firstDate + ' ~ ' + p.lastDate + ' (회차 날짜)' : '');
    var n = Math.max(+p.rounds || 0, +p.planned || 0);
    var check = plan.check ? '[확인 필요: ' + plan.check + ']' : '';
    var items = plan.items.map(function (x, i) {
      var subs = x.per === 'round' ? range(n) : (x.per === 'month' ? months(s || p.firstDate, e || p.lastDate) : []);
      var chip = (auto && x.step === 'report' && r && r.st) ? { txt: r.st.label, key: r.st.key } : { txt: '—', key: '' };
      return { no: i + 1, id: x.id, name: x.name, per: x.per, step: x.step, subs: subs, chip: chip, check: check };
    });
    return { head: { coName: str(p.coName), bizName: erp ? erp.name : str(p.typeName), agency: erp ? (erp.agency || NO_AGENCY) : '',
        period: period, manager: sidName(o.dir, cons && cons.managerMain) || (p.attNames || []).join('·'), rounds: n,
        plan: plan.key, kind: plan.kind, warn: warn },
      items: items };
  }
  function tocText(toc) {
    toc = toc || {};
    var h = toc.head || {}, items = toc.items || [];
    var out = ['목차 — ' + str(h.coName),
      '사업: ' + str(h.bizName) + (h.agency ? ' (' + h.agency + ')' : '') + ' · ' + (KIND_KO[h.kind] || NO_PLAN),
      '계약 기간: ' + (h.period || '—') + ' · 담당: ' + (h.manager || '—') + ' · 회차 ' + (h.rounds || 0)];
    (h.warn || []).forEach(function (w) { out.push(w); });
    if (!items.length) out.push(NO_PLAN + ' — 목차는 머리말만');
    items.forEach(function (x) {
      out.push(x.no + '. ' + x.name + ' (' + x.chip.txt + ')' + (x.check ? ' ' + x.check : ''));
      x.subs.forEach(function (s) { out.push('   - ' + s); });
    });
    return out.join('\n');
  }

  var api = { rowsOf: rowsOf, visibleTypes: visibleTypes, groupByAgency: groupByAgency, planFor: planFor, linkOf: linkOf,
    pairs: pairs, sidebarGroups: sidebarGroups, erpTypeFor: erpTypeFor, coKey: coKey, consCode: consCode, consFor: consFor,
    sidName: sidName, months: months, docsTable: docsTable, tocFor: tocFor, tocText: tocText,
    DOC_PLANS: DOC_PLANS, NONE: NONE, AUTO: AUTO, KIND_KO: KIND_KO, COLS: COLS,
    NO_AGENCY: NO_AGENCY, UNLINKED: UNLINKED, NO_PLAN: NO_PLAN };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PuGovReportDocs = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
```

- [ ] **Step 5: 통과 확인 (+ 기존 검사가 넓힌 합성 자료에 안 깨지는지)**

Run: `node --test tests/gov-report-docs.test.js tests/gov-report-list.test.js tests/gov-report-app.test.js`
Expected: 모두 PASS. (`gov-report-app` 은 아직 화면을 안 고쳤으므로 늘어난 `data.*`·`scal_erpTypeMap` 을 안 읽는다 — 그대로 통과해야 한다.)

- [ ] **Step 6: 커밋** (PowerShell)

```powershell
git add js/pu-gov-report-docs.js tests/gov-report-docs.test.js tests/helpers/gov-report-fixture.js
git commit -m @'
feat(gov-report): 서류 관리 순수 모듈 — 사업 목록·기관 묶음·서류 틀·체크표·목차

- js/pu-gov-report-docs.js(새): 숨김·합친 사업 빼기, 기관 묶음(기관 미지정), 이름 낱말로 서류 틀(DOC_PLANS),
  ERP 연결(scal_erpTypeMap), 업체×사업 쌍, 이알피 계약 맞추기, 체크표(①② 자동은 간단형 셋), 목차·복사 글.
- [확인 필요] 는 지어내지 않고 딱지로(현장클리닉·농촌융복합, 연결·계약 못 찾음). 연락처·금액은 목차에 안 담는다.
- 합성 자료에 이알피 사업·계약·이음표를 더함(업체는 합성).

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
'@
```

---

### Task 2: `gov-report.html` 왼쪽 패널 — 읽기 넷 · 기관별 사업 목록 · 사업 거르기 · 오류/빈 상태 + 등록부

**Files:** Modify `gov-report.html` · Modify `tests/gov-report-app.test.js` · Modify `js/pu-ontology.js:154-165`(govreport) · Modify html 24개(`pu-ontology.js?v=60→61`)

**Interfaces:**
- Consumes (T1): `PuGovReportDocs.sidebarGroups(biz, tmap, input, year)` · `linkOf(code, tmap, scalTypes)` · `visibleTypes(biz)` · `KIND_KO`
- Produces (T3 가 쓴다):
  - `GR_DOC_NODES = {biz:'data/biz_cons_types', cons:'data/consultings', tmap:'scal_erpTypeMap', dir:'data/user_dir'}`
  - `GR.input` — `grLoad` 가 만든 `{cos, types, scheds, staff, reports, today}`(못 읽으면 `null`)
  - `GR.docs = {loaded, err, biz, cons, tmap, dir}` · `GR.f.biz`(고른 ERP 코드, `''` = 안 고름) · `GR.dseq`
  - `grBizType() → 'typeId'|''` · `grErp(code) → visible type|null` · `grSetBiz(code)` · `grLoadDocs()` · `grRetryDocs()` · `grRenderBiz()`
  - 화면 칸 `#biz`

- [ ] **Step 1: 실패하는 검사 작성** — `tests/gov-report-app.test.js`

맨 위 `require` 들 뒤(`const Rpt = require('../js/pu-gov-report.js');` 다음 줄)에 더한다.

```js
const D = require('../js/pu-gov-report-docs.js');
const O = require('../js/pu-ontology.js');
```

`const NAMES = [...]` 두 줄을 다음으로 바꾼다.

```js
const NAMES = ['grEsc', 'grToday', 'grFilter', 'grRenderFilters', 'grRenderKpis', 'grSetStatus', 'grRenderRows',
  'grRenderForms', 'grRenderAlerts', 'grRender', 'grReset', 'grLoad',
  'grBizType', 'grErp', 'grSetBiz', 'grLoadDocs', 'grRetryDocs', 'grRenderBiz'];
```

`world()` 안의 `const ctx = { … };` 와 `vm.runInContext([varLine('GR_NODES'), …` 를 다음으로 바꾼다.

```js
  const ctx = { console: { warn() {} }, Promise, Object, Array, JSON, String, Number, Math, Date, RegExp, Error, isFinite,
    encodeURIComponent, PuGovReportList: L, PuGovReport: { FORMS: Rpt.FORMS }, PuGovReportDocs: D,
    $: (id) => (els[id] = els[id] || fakeEl()),
    fbDb: o.db ? o.db(db) : db };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext([varLine('GR_NODES'), varLine('GR_FIELDS'), varLine('GR_DOC_NODES'), varLine('GR')].join('\n') + '\n'
    + NAMES.map(grab).join('\n') + "\ngrToday=function(){ return '2026-10-10'; };", ctx);
```

정적 검사 「공통 머리와 새 모듈을 차례대로 싣는다」의 파일 배열에 `'js/pu-gov-report-docs.js'` 를 더하고, 그 검사 끝에 한 줄을 더한다.

```js
  assert.ok(SRC.indexOf('pu-gov-report-list.js') < SRC.indexOf('pu-gov-report-docs.js'), '목록 모듈 다음에 싣는다');
```

파일 끝에 더한다.

```js
/* ═══ 서류 관리(왼쪽 패널) — 설계 2026-10-10-gov-report-docs-design.md ═══ */

test('정적 — 새 읽기 넷은 GR_DOC_NODES 로만 · 등록부가 빌려 읽기로 적는다', () => {
  assert.match(SRC, /var GR_DOC_NODES=\{biz:'data\/biz_cons_types',cons:'data\/consultings',tmap:'scal_erpTypeMap',dir:'data\/user_dir'\};/);
  /* data/user_dir 은 앞 기능의 「내 담당」 읽기가 글자 그대로 부른다 — 새 셋만 본다 */
  assert.doesNotMatch(INLINE, /ref\(\s*['"](data\/biz_cons_types|data\/consultings|scal_erpTypeMap)/, 'GR_DOC_NODES 를 거치지 않았다');
  assert.match(SRC, /\$\('biz'\)\.addEventListener\('click'/);
  const g = O.PROGRAMS.govreport;
  ['data/biz_cons_types', 'data/consultings', 'scal_erpTypeMap'].forEach((r) => assert.ok(g.sharedRoots.includes(r), r));
  assert.deepEqual(g.writeContracts.map((w) => w.path), ['activeWriter/gov_report'], '쓰는 자리는 늘지 않는다');
  assert.match(SRC, /컨설팅 사업 목록을 불러오지 못했습니다/);
  assert.match(SRC, /환경설정 → 컨설팅관리에 컨설팅 사업이 없습니다/);
});

test('⑩ 왼쪽 패널 — 기관별 묶음(첫 sortOrder 순) · 숨김·합친 사업 없음 · 연결 없는 것은 맨 끝 · 읽기만', async () => {
  const w = world();
  await w.ctx.grLoad();
  const h = w.els.biz.innerHTML;
  const at = (s) => { const i = h.indexOf(s); assert.ok(i >= 0, s); return i; };
  assert.ok(at('기관 미지정') < at('비즈니스지원단(중기청)'));
  assert.ok(at('비즈니스지원단(중기청)') < at('충남북부상공회의소'));
  assert.ok(at('충남북부상공회의소') < at('서산상공회의소'));
  assert.ok(at('서산상공회의소') < at('정부사업일정에 사업 없음'));
  assert.ok(!h.includes('일터혁신상생컨설팅'), '숨긴 사업');
  assert.ok(!h.includes('혁신바우처컨설팅'), '합친 사업');
  assert.match(h, /data-biz="consulting-03"[^>]*>.*?통합기술보호지원단.*?간단형.*?<b>1<\/b>/);
  assert.match(h, /data-biz="consulting-01"[^>]*>.*?현장클리닉.*?<b>0<\/b>/);
  assert.equal(w.db.쓴것.length, 0, '읽기만 해야 한다');
});

test('⑪ 사업을 누르면 그 사업 업체로 거르고, 다시 누르면 풀린다 · 연결 없는 사업은 빈 목록 · 거르개 풀기', async () => {
  const w = world();
  await w.ctx.grLoad();
  w.ctx.grSetBiz('consulting-03');
  let h = w.els.rows.innerHTML;
  assert.ok(h.includes('가나상사') && !h.includes('다라정밀') && !h.includes('마바산업'));
  assert.match(w.els.biz.innerHTML, /class="bz on" data-biz="consulting-03"/);
  assert.equal(w.els.fType.disabled, true, '사업 거르개는 왼쪽이 맡는다');
  assert.match(w.els.kpis.innerHTML, /data-st=""[^>]*><b>1<\/b>/, '숫자 칸도 함께 걸러진다');
  w.ctx.grSetBiz('consulting-03');
  h = w.els.rows.innerHTML;
  assert.ok(h.includes('가나상사') && h.includes('다라정밀') && h.includes('마바산업'), '다시 누르면 풀린다');
  assert.equal(w.els.fType.disabled, false);
  w.ctx.grSetBiz('consulting-06');
  assert.equal(w.els.rows.innerHTML, '');
  assert.equal(w.els.empty.textContent, '조건에 맞는 보고서가 없습니다.');
  w.ctx.grReset();
  assert.equal(w.ctx.GR.f.biz, '');
  assert.equal(w.db.쓴것.length, 0);
});

test('⑫ 컨설팅 사업을 못 읽으면 왼쪽만 오류 + 다시 시도 — 오른쪽 목록은 그대로', async () => {
  let n = 0;
  const w = world({ db: (db) => ({ ref: (p) => (p === 'data/biz_cons_types' && ++n === 1
    ? { once: async () => { throw new Error('permission_denied'); } } : db.ref(p)) }) });
  await w.ctx.grLoad();
  assert.ok(w.els.biz.innerHTML.includes('컨설팅 사업 목록을 불러오지 못했습니다'));
  assert.ok(w.els.biz.innerHTML.includes('onclick="grRetryDocs()"'));
  assert.notEqual(w.els.board.style.display, 'none');
  assert.ok(w.els.rows.innerHTML.includes('마바산업'), '오른쪽은 왼쪽 없이도 쓴다');
  await w.ctx.grRetryDocs();
  assert.ok(w.els.biz.innerHTML.includes('통합기술보호지원단'));
});

test('⑬ 사업 목록이 비면 「환경설정 → 컨설팅관리에 컨설팅 사업이 없습니다」 · 이름은 이스케이프', async () => {
  const s = F.seed(); s.data.biz_cons_types = { u: 1, v: [] };
  const w = world({ seed: s });
  await w.ctx.grLoad();
  assert.ok(w.els.biz.innerHTML.includes('환경설정 → 컨설팅관리에 컨설팅 사업이 없습니다'));
  const x = F.seed();
  x.data.biz_cons_types.v.push({ code: 'consulting-x', name: '<img src=x>', agency: '<b>', sortOrder: 20 });
  x.scal_erpTypeMap['consulting-x'] = 't1';   // 이어 둬야 기관 묶음 머리에 나온다
  const v = world({ seed: x });
  await v.ctx.grLoad();
  assert.ok(!v.els.biz.innerHTML.includes('<img'), '이스케이프 안 됨');
  assert.ok(v.els.biz.innerHTML.includes('&#60;img src=x&#62;'));
  assert.ok(v.els.biz.innerHTML.includes('<div class="bz-h">&#60;b&#62;</div>'), '기관 이름도 이스케이프');
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test tests/gov-report-app.test.js`
Expected: FAIL — `grBizType 을(를) 못 찾았다` (그리고 `GR_DOC_NODES 한 줄을 못 찾았다`)

- [ ] **Step 3: 스타일** — `gov-report.html` `<style>`

`.grid{…}` 줄을 다음으로 바꾼다.

```css
.grid{display:grid;grid-template-columns:240px minmax(0,1fr) 300px;gap:14px;align-items:start}
```

`.side section{…}` · `.side h2{…}` 두 줄을 다음으로 바꾼다.

```css
.side section,.bizp section{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px;margin-bottom:12px}
.side h2,.bizp h2{font-size:14px;margin:0 0 8px}
.bz-g{margin-bottom:10px}
.bz-g.off .bz-n{color:var(--mute)}
.bz-h{font-size:12px;color:var(--mute);font-weight:600;margin:6px 0 4px}
.bz{display:flex;align-items:center;gap:6px;width:100%;text-align:left;border:1px solid transparent;background:var(--card);padding:5px 8px;margin-bottom:2px}
.bz:hover{background:var(--bg)}
.bz.on{background:var(--blue-bg);border-color:var(--blue);color:var(--blue-ink)}
.bz-n{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px}
.bz-k{font-size:11px;color:var(--mute)}
.bz b{font-size:12px;font-variant-numeric:tabular-nums}
```

`@media (max-width:900px){ … }` 줄 «앞»에 한 줄을 더한다.

```css
@media (max-width:1100px){ .grid{grid-template-columns:220px minmax(0,1fr)} .side{grid-column:1 / -1} }
```

- [ ] **Step 4: 몸통** — `<div class="grid" id="board" style="display:none">` 바로 다음 줄에 더한다.

```html
    <aside class="bizp"><section><h2>📂 컨설팅 사업</h2><div id="biz"></div></section></aside>
```

- [ ] **Step 5: 모듈 싣기** — `<script src="js/pu-gov-report-list.js?v=2"></script>` 바로 다음 줄에 더한다.

```html
<!-- 서류 관리(왼쪽 패널)·목차 — 이알피 컨설팅 사업 · 서류 틀 · 체크표 · 목차(순수 함수) -->
<script src="js/pu-gov-report-docs.js?v=1"></script>
```

- [ ] **Step 6: 스크립트** — 맨 아래 `<script>`

(a) `var GR_FIELDS=…;` 줄 다음에 더하고, `var GR=…;` 줄을 바꾼다(한 줄 그대로 — 검사가 한 줄로 떠 간다).

```js
/* 서류 관리(왼쪽 패널)가 빌려 읽는 자리 — 이알피 컨설팅 사업 · 이알피 컨설팅 · ERP 연결(정부사업일정이 FB_NODES 로 부르는 그 자리) · 명부
   ⚠ 이름 표로 부른다 — 글자 그대로 ref('scal_…') 를 쓰면 등록부 검사가 주인 없는 자리로 잡는다. 읽기만, 한 번씩 */
var GR_DOC_NODES={biz:'data/biz_cons_types',cons:'data/consultings',tmap:'scal_erpTypeMap',dir:'data/user_dir'};
var GR={seq:0,dseq:0,rows:[],input:null,staffMap:{},index:null,indexErr:false,err:'',loaded:false,me:'',email:'',today:'',docs:{loaded:false,err:false},f:{year:'',type:'',att:'',status:'',co:'',mine:false,biz:''}};
```

(b) `function grFilter(){ … }` 한 줄을 다음으로 바꾼다.

```js
/* 왼쪽에서 고른 이알피 사업 → 정부사업일정 사업 번호(없으면 '') */
function grBizType(){ return GR.f.biz?PuGovReportDocs.linkOf(GR.f.biz,GR.docs.tmap,GR.input&&GR.input.types):''; }
function grErp(code){ return PuGovReportDocs.visibleTypes(GR.docs.biz).filter(function(t){ return t.code===code; })[0]||null; }
/* 사업을 고르면 위 「사업」 거르개 대신 그 번호로 거른다 — 연결이 없으면 아무 줄도 안 맞는 '-' */
function grFilter(){ var f=GR.f; return {year:f.year,type:f.biz?(grBizType()||'-'):f.type,att:f.att,status:f.status,co:f.co,mine:f.mine?GR.me:''}; }
```

(c) `grRenderFilters` 안 `$('fType').innerHTML=opts('모든 사업',seenT,GR.f.type);` 줄 다음에 더한다.

```js
  $('fType').disabled=!!GR.f.biz; $('fType').title=GR.f.biz?'왼쪽 컨설팅 사업으로 거르는 중입니다':'';
```

(d) `/* 양식 서고 — 읽기만. …` 주석 줄 «앞»에 더한다.

```js
/* 왼쪽 패널 — 이알피 「환경설정 → 컨설팅관리 → 컨설팅 사업」을 기관별로. 숫자는 고른 해의 업체 수 */
function grRenderBiz(){
  var D=PuGovReportDocs, d=GR.docs, el=$('biz');
  if(d.err){ el.innerHTML='<div class="err-s">컨설팅 사업 목록을 불러오지 못했습니다</div><button type="button" onclick="grRetryDocs()">다시 시도</button>'; return; }
  if(!d.loaded){ el.innerHTML='<div class="days">불러오는 중…</div>'; return; }
  var groups=D.sidebarGroups(d.biz,d.tmap,GR.input,GR.f.year);
  if(!groups.length){ el.innerHTML='<div class="days">환경설정 → 컨설팅관리에 컨설팅 사업이 없습니다</div>'; return; }
  el.innerHTML=groups.map(function(g){
    return '<div class="bz-g'+(g.unlinked?' off':'')+'"><div class="bz-h">'+grEsc(g.agency)+'</div>'+g.types.map(function(t){
      return '<button type="button" class="bz'+(t.code===GR.f.biz?' on':'')+'" data-biz="'+grEsc(t.code)+'"'
        +(g.unlinked?' title="정부사업일정의 ERP 연결에 이 사업이 없습니다"':'')+'>'
        +'<span class="bz-n" title="'+grEsc(t.name)+'">'+grEsc(t.name)+'</span><span class="bz-k">'+grEsc(D.KIND_KO[t.kind])+'</span><b>'+t.count+'</b></button>';
    }).join('')+'</div>';
  }).join('');
}
/* 같은 사업을 다시 누르면 풀린다 */
function grSetBiz(code){
  GR.f.biz=(code&&GR.f.biz!==code)?code:'';
  GR.f.type='';
  grRender();
}
```

(e) `grRender` 의 `grRenderFilters(); grRenderKpis(); …` 줄을 다음으로 바꾼다.

```js
  grRenderBiz(); grRenderFilters(); grRenderKpis(); grRenderRows(); grRenderForms(); grRenderAlerts();
```

(f) `grReset` 의 `GR.f.year=…; … GR.f.mine=false;` 줄 끝에 ` GR.f.biz='';` 를 더한다.

```js
  GR.f.year=GR.today.slice(0,4); GR.f.type=''; GR.f.att=''; GR.f.status=''; GR.f.co=''; GR.f.mine=false; GR.f.biz='';
```

(g) `grLoad` — `GR.rows=L.buildRows(input);` 다음 줄에 `GR.input=input;` 를, `catch(e){ … GR.rows=[]; }` 의 `GR.rows=[];` 뒤에 ` GR.input=null;` 를 더한다. 그리고 끝의

```js
  GR.loaded=true;
  grRender();
}
```

를 다음으로 바꾼다.

```js
  await grLoadDocs();
  if(seq!==GR.seq) return;
  GR.loaded=true;
  grRender();
}
/* 왼쪽 패널 자료 — 하나라도 못 읽어도 오른쪽 목록은 돈다. 사업 목록을 못 읽은 것만 «오류»로 친다 */
async function grLoadDocs(){
  var seq=++GR.dseq, keys=Object.keys(GR_DOC_NODES);
  var got=await Promise.all(keys.map(function(k){
    return fbDb.ref(GR_DOC_NODES[k]).once('value').then(function(s){ return {ok:true,v:s.val()}; },
      function(e){ console.warn('[컨설팅보고서] 못 읽음 '+GR_DOC_NODES[k],e); return {ok:false,v:null}; });
  }));
  if(seq!==GR.dseq) return;
  var d={loaded:true,err:!got[keys.indexOf('biz')].ok};
  keys.forEach(function(k,i){ d[k]=got[i].v; });
  GR.docs=d;
}
async function grRetryDocs(){
  GR.docs={loaded:false,err:false}; grRenderBiz();
  await grLoadDocs();
  grRender();
}
```

(h) `grBoot` 의 `$('fReset').addEventListener('click',grReset);` 다음 줄에 더한다.

```js
  $('biz').addEventListener('click',function(e){
    var b=e.target&&e.target.closest?e.target.closest('[data-biz]'):null;
    if(b) grSetBiz(b.getAttribute('data-biz'));
  });
```

- [ ] **Step 7: 등록부** — `js/pu-ontology.js` `govreport` 의 주석 끝(`… 주인 정리는 정부사업일정 몫이다(이번 범위 밖). */`) 바로 앞에 두 줄을 넣고, `sharedRoots` 줄을 바꾼다.

```js
       ★ 서류 관리(2026-10-10, 설계 2026-10-10-gov-report-docs-design.md) — 왼쪽 패널·목차가 이알피 컨설팅 사업(data/biz_cons_types)·
         컨설팅(data/consultings, 목차 머리말만)·ERP 연결(scal_erpTypeMap)을 빌려 읽는다. 쓰지 않는다(주인은 erp·consult).
```

```js
      sharedRoots:['scal_cos','scal_types','scal_scheds','scal_staff','scal_reports','scal_rptFormsIndex','data/user_dir',
                   'data/biz_cons_types','data/consultings','scal_erpTypeMap'],
```

- [ ] **Step 8: 공용 js 번호 올리기** — 지금 번호를 먼저 확인한다(main 이 움직였으면 아래 60/61 을 그 번호로).

Run: `node -e "const fs=require('fs');const c={};fs.readdirSync('.').filter(f=>f.endsWith('.html')).forEach(f=>{const s=fs.readFileSync(f,'utf8');(s.match(/js\/pu-ontology\.js\?v=\d+/g)||[]).forEach(m=>c[m]=(c[m]||0)+1)});console.log(c)"`
Expected: `{ 'js/pu-ontology.js?v=60': 24 }`

번호 올리는 일회용 스크립트를 저장소 «밖»(PowerShell `$env:TEMP`)에 만든다 — CRLF 는 그대로 둔다.

```powershell
@'
const fs = require('fs'), path = require('path');
const root = process.argv[2];
for (const f of fs.readdirSync(root).filter((x) => x.endsWith('.html'))) {
  const p = path.join(root, f); const s = fs.readFileSync(p, 'utf8');
  const t = s.split('js/pu-ontology.js?v=60"').join('js/pu-ontology.js?v=61"');
  if (t !== s) { fs.writeFileSync(p, t); console.log('bumped', f); }
}
'@ | Out-File -Encoding ascii "$env:TEMP\gr-docs-bump.js"
node "$env:TEMP\gr-docs-bump.js" (Get-Location).Path
```

Expected: `bumped …` 24줄. 위 `node -e` 를 다시 돌리면 `{ 'js/pu-ontology.js?v=61': 24 }`.

- [ ] **Step 9: 통과 확인**

Run: `node --test tests/gov-report-app.test.js tests/gov-report-docs.test.js tests/gov-report-list.test.js tests/ontology-registry.test.js tests/ontology-contract.test.js tests/ontology-write-gate.test.js tests/color-palette-apps.test.js tests/html-inline-script-syntax.test.js tests/back-button.test.js tests/phone-input-zoom.test.js`
그리고: `node tests/shared-js-cache-version.test.js`
Expected: 모두 PASS(`shared-js-cache-version` 은 `=== N 통과 / 0 실패 ===`).

- [ ] **Step 10: 커밋** (PowerShell) — 고친 html 이 많으므로 `git status --short` 로 고친 것만 보이는지 먼저 본다.

```powershell
git status --short
git add gov-report.html js/pu-ontology.js tests/gov-report-app.test.js
git add -u -- "*.html"
git commit -m @'
feat(gov-report): 왼쪽 패널 — 이알피 컨설팅 사업을 기관별로, 누르면 그 사업 업체로 거르기

- 읽기 넷(data/biz_cons_types·data/consultings·scal_erpTypeMap·data/user_dir)은 GR_DOC_NODES 로, 한 번씩. 쓰지 않는다.
- 숨김·합친 사업 빼고 sortOrder 순, 기관 묶음(기관 미지정), ERP 연결 없는 사업은 맨 끝 묶음(업체 0).
- 사업 목록을 못 읽으면 왼쪽만 오류 + 다시 시도, 비면 「환경설정 → 컨설팅관리에 컨설팅 사업이 없습니다」.
- 등록부 govreport 빌려 읽기 셋 추가 · pu-ontology.js ?v=61 (부르는 화면 모두).

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
'@
```

---

### Task 3: 서류 체크표 ①~⑤ · 목록 「목차」 단추 · 목차 창(복사)

**Files:** Modify `gov-report.html` · Modify `tests/gov-report-app.test.js`

**Interfaces:**
- Consumes (T1): `PuGovReportDocs.docsTable(o)` · `pairs(input, typeId, year)` · `erpTypeFor(typeId, biz, tmap)` · `consFor(o)` · `tocFor(o)` · `tocText(toc)` · `KIND_KO` · `UNLINKED` · `NO_PLAN`
- Consumes (T2): `GR.input` · `GR.docs` · `GR.f.biz` · `grBizType()` · `grErp(code)` · `grRender()`
- Produces: `grRenderDocs()` · `grOpenToc(coId, typeId)` · `grRenderToc()` · `grCopyToc() → Promise` · `grCloseToc()` · `GR.toc`·`GR.tocMsg`·`GR.tocFail` · 화면 칸 `#docs`·`#toc` · 목록·체크표 단추 `data-toc="1" data-co=… data-ty=…`
- ⚠ 이 작업은 `js/pu-gov-report-docs.js` 를 고치지 않는다. 고쳐야 하면 `gov-report.html` 의 `pu-gov-report-docs.js?v=1` 을 `?v=2` 로 같은 커밋에서 올린다.

- [ ] **Step 1: 실패하는 검사 작성** — `tests/gov-report-app.test.js`

`NAMES` 를 다음으로 바꾼다.

```js
const NAMES = ['grEsc', 'grToday', 'grFilter', 'grRenderFilters', 'grRenderKpis', 'grSetStatus', 'grRenderRows',
  'grRenderForms', 'grRenderAlerts', 'grRender', 'grReset', 'grLoad',
  'grBizType', 'grErp', 'grSetBiz', 'grLoadDocs', 'grRetryDocs', 'grRenderBiz',
  'grRenderDocs', 'grOpenToc', 'grRenderToc', 'grCopyToc', 'grCloseToc'];
```

`world()` 의 `ctx.window = ctx;` 줄 다음에 더한다(클립보드 흉내 — 복사한 글은 `ctx.copied`).

```js
  ctx.navigator = o.nav || { clipboard: { writeText: async (t) => { ctx.copied = t; } } };
```

파일 끝에 더한다.

```js
test('정적 — 목록·체크표의 「목차」 단추와 창 닫기 · 창은 PuBack 이 닫을 수 있게 data-close', () => {
  assert.match(SRC, /\['rows','docs'\]\.forEach\(function\(id\)\{ \$\(id\)\.addEventListener\('click'/);
  assert.match(SRC, /<div id="toc" class="toc" style="display:none"><\/div>/);
  assert.match(SRC, /data-close onclick="grCloseToc\(\)">닫기<\/button>/);
});

test('⑭ 서류 체크표 — 간단형은 ①~⑤ 열(①② 자동, ③④⑤ 「—」)·기한·목차 단추', async () => {
  const w = world();
  await w.ctx.grLoad();
  assert.equal(w.els.docs.style.display, 'none', '사업을 안 고르면 체크표가 없다');
  w.ctx.grSetBiz('consulting-03');
  const h = w.els.docs.innerHTML;
  assert.equal(w.els.docs.style.display, '');
  ['①초안', '②확정', '③서명본', '④별첨', '⑤제출', '기한', '통합기술보호지원단', '간단형', '가나상사', '2026-09-30'].forEach((s) => assert.ok(h.includes(s), s));
  assert.ok(h.includes('<span class="st st-draft">초안</span>'));
  assert.equal((h.match(/<td>—<\/td>/g) || []).length, 4, '② ③ ④ ⑤ 는 「—」');
  assert.ok(h.includes('data-toc="1" data-co="c1" data-ty="t1"'));
  w.ctx.grSetBiz('consulting-05');
  assert.ok(w.els.docs.innerHTML.includes('<span class="st st-todo">미작성</span>'));
  assert.equal(w.db.쓴것.length, 0);
});

test('⑮ 대형·틀 없음은 «서류 목차 보기» 줄만 · 연결 없는 사업은 안내 · [확인 필요] 틀 딱지', async () => {
  const w = world();
  await w.ctx.grLoad();
  w.ctx.grSetBiz('consulting-02');
  let h = w.els.docs.innerHTML;
  assert.ok(h.includes('대형') && h.includes('서류 목차 보기') && h.includes('가나상사'));
  assert.ok(!h.includes('①초안'), '대형은 체크표를 그리지 않는다');
  w.ctx.grSetBiz('consulting-01');
  h = w.els.docs.innerHTML;
  assert.ok(h.includes('정부사업일정에 사업 없음'));
  assert.ok(h.includes('[확인 필요: 운영지침]'));
  w.ctx.grSetBiz('consulting-01');
  assert.equal(w.els.docs.style.display, 'none', '다시 누르면 체크표도 닫힌다');
});

test('⑯ 목록 줄마다 「목차」 — 목차 창: 머리말·번호 줄·회차 펼침·상태 딱지, 연락처·금액은 없다 · 닫기', async () => {
  const w = world();
  await w.ctx.grLoad();
  assert.ok(w.els.rows.innerHTML.includes('class="act tocb" data-toc="1" data-co="c1" data-ty="t1">목차</button>'));
  w.ctx.grOpenToc('c1', 't1');
  const h = w.els.toc.innerHTML;
  assert.equal(w.els.toc.style.display, '');
  ['목차 — 가나상사', '통합기술보호지원단', '(비즈니스지원단(중기청))', '2026-05-01 ~ 2026-09-30', '담당: 홍길동', '회차 3',
    '별지11 완료보고서', '<li>1회차</li>', '<li>3회차</li>', '<span class="st st-draft">초안</span>', '복사'].forEach((s) => assert.ok(h.includes(s), s));
  assert.ok(h.indexOf('별지11 완료보고서') < h.indexOf('법률 자문 일지'), '틀 차례대로');
  ['010-0000-0000', '연락담당', '9900000'].forEach((s) => assert.ok(!h.includes(s), s + ' 가 목차에 나왔다'));
  w.ctx.grCloseToc();
  assert.equal(w.els.toc.style.display, 'none');
  assert.equal(w.db.쓴것.length, 0);
});

test('⑰ 이알피 계약을 못 맞추면 머리말에 [확인 필요] — 목차는 그대로 만든다', async () => {
  const w = world();
  await w.ctx.grLoad();
  w.ctx.grOpenToc('c3', 't4');
  const h = w.els.toc.innerHTML;
  assert.ok(h.includes('[확인 필요] 푸른이알피 계약 못 찾음'));
  assert.ok(h.includes('2026-03-03 ~ 2026-05-12 (회차 날짜)'));
  assert.ok(h.includes('방문확인서') && h.includes('<span class="st st-todo">미작성</span>'));
});

test('⑱ 「복사」 — 목차 글(tocText)을 그대로 · 못 하면 안내 + 고를 수 있는 글 상자', async () => {
  const w = world();
  await w.ctx.grLoad();
  w.ctx.grOpenToc('c1', 't1');
  await w.ctx.grCopyToc();
  assert.equal(w.ctx.copied, D.tocText(w.ctx.GR.toc));
  assert.ok(w.ctx.copied.startsWith('목차 — 가나상사'));
  assert.ok(w.els.toc.innerHTML.includes('복사했습니다'));
  const f = world({ nav: { clipboard: { writeText: async () => { throw new Error('denied'); } } } });
  await f.ctx.grLoad();
  f.ctx.grOpenToc('c1', 't1');
  await f.ctx.grCopyToc();
  assert.ok(f.els.toc.innerHTML.includes('복사하지 못했습니다'));
  assert.ok(f.els.toc.innerHTML.includes('<textarea class="toc-t" readonly>목차 — 가나상사'));
});

test('⑲ 목차 창의 바깥 값은 이스케이프', async () => {
  const s = F.seed(); s.scal_cos[0].name = '가나<상사>';
  const w = world({ seed: s });
  await w.ctx.grLoad();
  w.ctx.grOpenToc('c1', 't1');
  assert.ok(!w.els.toc.innerHTML.includes('<상사>'));
  assert.ok(w.els.toc.innerHTML.includes('가나&#60;상사&#62;'));
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test tests/gov-report-app.test.js`
Expected: FAIL — `grRenderDocs 을(를) 못 찾았다`

- [ ] **Step 3: 스타일** — T2 에서 넣은 `.bz b{…}` 줄 다음에 더한다(팔레트 안 색만 — `#fde68a` 는 amber).

```css
.docs{background:var(--card);border:1px solid var(--blue-line);border-radius:10px;padding:10px;margin-bottom:10px;overflow:auto}
.dc-h{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:8px}
.dc-l{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--line)}
.tag-chk{display:inline-block;border-radius:6px;padding:1px 6px;font-size:11px;background:var(--amber-bg);color:var(--amber);border:1px solid #fde68a}
.tocb{margin-left:4px}
.toc{position:fixed;inset:0;z-index:30;background:rgba(15,23,42,.4);display:flex;align-items:flex-start;justify-content:center;padding:40px 16px;overflow:auto}
.toc-box{background:var(--card);border-radius:12px;max-width:560px;width:100%;padding:16px}
.toc-top{display:flex;align-items:center;gap:6px;margin-bottom:8px}
.toc-top .sp{flex:1}
.toc-h{font-size:13px;color:var(--mute);margin-bottom:8px;line-height:1.6}
.toc-box>.tag-chk{display:block;margin-bottom:4px}
.toc-l{margin:8px 0 0;padding-left:22px}
.toc-l>li{padding:4px 0;border-bottom:1px solid var(--line)}
.toc-l ul{margin:2px 0 0;padding-left:16px;font-size:12px;color:var(--mute)}
.toc-t{width:100%;min-height:160px;margin-top:8px;font:inherit;font-size:12px}
```

- [ ] **Step 4: 몸통** — `<div class="tbl">` 바로 «앞» 줄에 `<div id="docs" class="docs" style="display:none"></div>` 를, `</main>` 바로 다음 줄에 목차 창 칸을 더한다.

```html
      <div id="docs" class="docs" style="display:none"></div>
```

```html
<div id="toc" class="toc" style="display:none"></div>
```

- [ ] **Step 5: 스크립트** — 맨 아래 `<script>`

(a) `var GR=…;` 한 줄을 다음으로 바꾼다.

```js
var GR={seq:0,dseq:0,rows:[],input:null,staffMap:{},index:null,indexErr:false,err:'',loaded:false,me:'',email:'',today:'',docs:{loaded:false,err:false},toc:null,tocMsg:'',tocFail:false,f:{year:'',type:'',att:'',status:'',co:'',mine:false,biz:''}};
```

(b) `grRenderRows` 의 `+'<td>'+grEsc(r.updatedBy?…)+'</td><td>'+act+'</td></tr>';` 줄을 다음으로 바꾼다.

```js
      +'<td>'+grEsc(r.updatedBy?(L.dayOf(r.updatedAt)+' '+r.updatedBy):'')+'</td><td>'+act
      +'<button type="button" class="act tocb" data-toc="1" data-co="'+grEsc(r.coId)+'" data-ty="'+grEsc(r.typeId)+'">목차</button></td></tr>';
```

(c) T2 의 `function grSetBiz(code){ … }` 다음에 더한다.

```js
/* 서류 체크표 — 고른 사업의 업체들. 간단형 셋(충남북부·서산·기술보호)만 ①② 를 현황판 상태로 채우고 ③④⑤ 는 「—」.
   다른 틀은 근거 자료가 아직 없어 «서류 목차 보기» 줄만 둔다(설계서 §4) */
function grRenderDocs(){
  var D=PuGovReportDocs, el=$('docs');
  if(!GR.f.biz||!GR.docs.loaded||GR.docs.err){ el.style.display='none'; el.innerHTML=''; return; }
  var erp=grErp(GR.f.biz), tid=grBizType();
  var t=D.docsTable({erp:erp,typeId:tid,input:GR.input,rows:GR.rows,year:GR.f.year,consultings:GR.docs.cons,tmap:GR.docs.tmap,biz:GR.docs.biz});
  var btn=function(x,label){ return '<button type="button" class="act tocb" data-toc="1" data-co="'+grEsc(x.coId)+'" data-ty="'+grEsc(x.typeId)+'">'+label+'</button>'; };
  var head='<div class="dc-h"><b>📋 서류 — '+grEsc(erp?erp.name:'')+'</b><span class="tag">'+grEsc(D.KIND_KO[t.plan.kind])+'</span>'
    +(t.plan.check?'<span class="tag-chk">[확인 필요: '+grEsc(t.plan.check)+']</span>':'')+'</div>';
  var body;
  if(!tid) body='<div class="empty">'+grEsc(D.UNLINKED)+' — 사업 잇기는 정부사업일정의 ERP 연결에서</div>';
  else if(!t.lines.length) body='<div class="empty">'+grEsc(GR.f.year)+'년에 이 사업 업체가 없습니다</div>';
  else if(t.auto) body='<table><thead><tr><th>업체</th>'+t.cols.map(function(c){ return '<th>'+grEsc(c)+'</th>'; }).join('')+'<th>기한</th><th></th></tr></thead><tbody>'
    +t.lines.map(function(x){
      return '<tr><td class="co" title="'+grEsc(x.coName)+'">'+grEsc(x.coName)+'</td>'+x.cells.map(function(c){
        return '<td>'+(c.key?'<span class="st st-'+c.key+'">'+grEsc(c.txt)+'</span>':grEsc(c.txt))+'</td>';
      }).join('')+'<td>'+grEsc(x.due||'—')+'</td><td>'+btn(x,'목차')+'</td></tr>';
    }).join('')+'</tbody></table>';
  else body=t.lines.map(function(x){ return '<div class="dc-l"><span>'+grEsc(x.coName)+'</span>'+btn(x,'서류 목차 보기')+'</div>'; }).join('');
  el.innerHTML=head+body; el.style.display='';
}
/* 목차 창 — 업체 한 곳·사업 하나. 이알피 사업은 왼쪽에서 고른 것, 안 골랐으면 이음표를 거꾸로 찾는다 */
function grOpenToc(coId,typeId){
  var D=PuGovReportDocs, d=GR.docs||{};
  var p=D.pairs(GR.input,typeId,GR.f.year).filter(function(x){ return x.coId===coId; })[0];
  if(!p) return;
  var erp=(GR.f.biz&&grBizType()===typeId)?grErp(GR.f.biz):D.erpTypeFor(typeId,d.biz,d.tmap);
  var row=GR.rows.filter(function(r){ return r.coId===coId&&r.typeId===typeId&&r.year===p.year; })[0]||null;
  var cons=D.consFor({consultings:d.cons,co:p.co,code:erp?erp.code:'',typeId:typeId,tmap:d.tmap,biz:d.biz});
  GR.toc=D.tocFor({pair:p,row:row,erp:erp,cons:cons,dir:d.dir}); GR.tocMsg=''; GR.tocFail=false;
  grRenderToc();
}
function grRenderToc(){
  var D=PuGovReportDocs, t=GR.toc, el=$('toc');
  if(!t){ el.style.display='none'; el.innerHTML=''; return; }
  var h=t.head;
  var list=t.items.length?'<ol class="toc-l">'+t.items.map(function(x){
      return '<li><span>'+grEsc(x.name)+'</span> '
        +(x.chip.key?'<span class="st st-'+x.chip.key+'">'+grEsc(x.chip.txt)+'</span>':'<span class="days">—</span>')
        +(x.check?' <span class="tag-chk">'+grEsc(x.check)+'</span>':'')
        +(x.subs.length?'<ul>'+x.subs.map(function(s){ return '<li>'+grEsc(s)+'</li>'; }).join('')+'</ul>':'')+'</li>';
    }).join('')+'</ol>':'<div class="empty">'+grEsc(D.NO_PLAN)+' — 목차는 머리말만</div>';
  el.innerHTML='<div class="toc-box" role="dialog" aria-label="서류 목차">'
    +'<div class="toc-top"><b>목차 — '+grEsc(h.coName)+'</b><span class="sp"></span>'
    +'<button type="button" onclick="grCopyToc()">복사</button><button type="button" data-close onclick="grCloseToc()">닫기</button></div>'
    +'<div class="toc-h">사업: '+grEsc(h.bizName)+(h.agency?' ('+grEsc(h.agency)+')':'')+' · '+grEsc(D.KIND_KO[h.kind])
    +'<br>계약 기간: '+grEsc(h.period||'—')+' · 담당: '+grEsc(h.manager||'—')+' · 회차 '+grEsc(h.rounds)+'</div>'
    +h.warn.map(function(w){ return '<div class="tag-chk">'+grEsc(w)+'</div>'; }).join('')
    +list
    +(GR.tocMsg?'<div class="days">'+grEsc(GR.tocMsg)+'</div>':'')
    +(GR.tocFail?'<textarea class="toc-t" readonly>'+grEsc(D.tocText(t))+'</textarea>':'')
    +'</div>';
  el.style.display='';
}
/* 「복사」 — 보고서 별첨 목록·메일에 붙이기용 글. 못 하면 글 상자를 띄워 직접 고르게 한다 */
function grCopyToc(){
  if(!GR.toc) return Promise.resolve();
  var txt=PuGovReportDocs.tocText(GR.toc);
  var done=function(ok){ GR.tocMsg=ok?'복사했습니다 — 붙여 넣으세요':'복사하지 못했습니다 — 아래 글을 골라 복사해 주세요'; GR.tocFail=!ok; grRenderToc(); };
  try{ return navigator.clipboard.writeText(txt).then(function(){ done(true); },function(){ done(false); }); }
  catch(e){ done(false); return Promise.resolve(); }
}
function grCloseToc(){ GR.toc=null; GR.tocMsg=''; GR.tocFail=false; grRenderToc(); }
```

(d) `grRender` 의 그리기 줄을 다음으로 바꾼다.

```js
  grRenderBiz(); grRenderFilters(); grRenderKpis(); grRenderDocs(); grRenderRows(); grRenderForms(); grRenderAlerts();
```

(e) `grBoot` — T2 의 `$('biz').addEventListener(…);` 다음에 더한다.

```js
  ['rows','docs'].forEach(function(id){ $(id).addEventListener('click',function(e){
    var b=e.target&&e.target.closest?e.target.closest('[data-toc]'):null;
    if(b) grOpenToc(b.getAttribute('data-co'),b.getAttribute('data-ty'));
  }); });
  $('toc').addEventListener('click',function(e){ if(e.target===this) grCloseToc(); });
```

- [ ] **Step 6: 통과 확인**

Run: `node --test tests/gov-report-app.test.js tests/gov-report-docs.test.js tests/gov-report-list.test.js tests/color-palette-apps.test.js tests/html-inline-script-syntax.test.js tests/back-button.test.js`
그리고: `node tests/shared-js-cache-version.test.js`
Expected: 모두 PASS.

- [ ] **Step 7: 눈으로 확인(로그인 없이 되는 만큼)** — `gov-report.html` 을 file:// 로 열면 「file:// 로 열면 로그인할 수 없습니다」 잠금이 보여야 한다(스크립트 오류 없이). 콘솔에 `PuGovReportDocs` 가 객체로 보인다. 실제 자료 화면은 배포 뒤 로그인해서 본다(기록 「다음」).

- [ ] **Step 8: 커밋** (PowerShell)

```powershell
git add gov-report.html tests/gov-report-app.test.js
git commit -m @'
feat(gov-report): 서류 체크표 ①~⑤ · 목록 「목차」 · 목차 창(복사)

- 사업을 고르면 서류 체크표: 간단형(충남북부·서산·기술보호)은 ①초안 ②확정 을 현황판 상태로, ③④⑤ 는 「—」,
  기한은 이알피 계약 종료일. 다른 틀은 «서류 목차 보기» 줄만.
- 목차 창: 계약 기간·담당·회차 머리말 + 번호 줄 + 회차 펼침 + 상태 딱지 + [확인 필요]. 「복사」는 줄바꿈 글.
- 연락처·금액·본문은 담지 않는다. 아무것도 쓰지 않는다.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
'@
```

---

### Task 4: 전체 검사 + 기록

**Files:** Modify `STATUS.md` · Create `status/2026-10-10-gov-report-docs.md`

**Interfaces:**
- Consumes: T1~T3 결과(검사 수·통과 수는 실제로 돌린 값을 적는다)
- Produces: 기록 두 파일

- [ ] **Step 1: 이 기능이 지켜야 하는 검사 묶음**

Run: `node --test tests/gov-report-docs.test.js tests/gov-report-list.test.js tests/gov-report-app.test.js tests/gov-report-deeplink.test.js tests/gov-report-ui.test.js tests/gov-report-build.test.js tests/color-palette-apps.test.js tests/html-inline-script-syntax.test.js tests/back-button.test.js tests/ontology-contract.test.js tests/ontology-registry.test.js tests/ontology-write-gate.test.js tests/appbar-coverage.test.js tests/ls-guard.test.js tests/logout-gate.test.js tests/whoami-no-overlap.test.js`
그리고: `node tests/shared-js-cache-version.test.js` · `node scripts/check-cache-version.js --all`
Expected: 모두 PASS, `check-cache-version --all` 은 아무것도 안 찍고 끝난다(종료 0).

- [ ] **Step 2: 전체 검사**

Run: `node --test "tests/**/*.test.js"`
Expected: 새로 빨개진 것이 없다. 작업 전 기준 커밋(`git merge-base HEAD origin/main`)에서 이미 빨갛던 검사가 있으면 그 이름을 Step 4 기록에 적는다. `✖ 올리지 않았습니다 — 기준이 N일 된 것입니다` 는 날짜 잡음이다.

- [ ] **Step 3: `STATUS.md`** — 「컨설팅보고서 앱 확인 필요 — …」 줄(`- [ ] 컨설팅보고서 앱 확인 필요`) 바로 «다음»에 두 줄을 넣는다.

```markdown
- [x] 컨설팅보고서 앱 서류 관리(왼쪽 패널)·목차 — 구현 (PR 예정). 설계 `docs/superpowers/specs/2026-10-10-gov-report-docs-design.md` · 계획 `docs/superpowers/plans/2026-10-10-gov-report-docs.md`. 왼쪽 = 이알피 「환경설정 → 컨설팅관리 → 컨설팅 사업」을 기관별로(숨김·합친 것 뺌), 누르면 그 사업 업체로 거르기 + 서류 체크표(간단형 셋만 ①② 자동, ③④⑤ 「—」) · 줄마다 「목차」 창(머리말·번호 줄·회차 펼침·[확인 필요]·복사). 서류 틀은 `js/pu-gov-report-docs.js` `DOC_PLANS`(코드 상수 — 바꾸려면 PR). 읽기만
- [ ] 서류 관리 확인 필요 — 배포 뒤 실제 이알피 사업 이름이 틀에 맞게 붙는지(특히 산업일자리 둘·일터상생혁신) · 이음표(ERP 연결)가 없는 사업이 「정부사업일정에 사업 없음」에 모이는지 · 현장클리닉 운영지침·농촌융복합 양식 글자 [확인 필요] 풀기 · ③서명본 ④별첨 ⑤제출 저장 자리·규칙은 서명·제출 단계에서
```

- [ ] **Step 4: `status/2026-10-10-gov-report-docs.md`** (새) — `[ ]` 안의 수는 Step 1·2 에서 실제로 나온 값으로 채운다(지어내지 않는다).

```markdown
# 2026-10-10 · 컨설팅보고서 앱 — 서류 관리(왼쪽 패널)·목차

대표 지시 「대시보드 왼쪽에 서류(페이퍼) 관리를 만들고」 · 「푸른이알피 환경설정 → 컨설팅관리 → 컨설팅 사업과 연계해 목차를 만든다」 · 「진행」.
설계 `docs/superpowers/specs/2026-10-10-gov-report-docs-design.md` · 계획 `docs/superpowers/plans/2026-10-10-gov-report-docs.md`.

## 한 것
- `js/pu-gov-report-docs.js`(새, 순수 함수): 사업 목록 다듬기(숨김·합친 것 뺌, sortOrder 순) · 기관 묶음(빈 기관 = 기관 미지정) · 서류 틀 `DOC_PLANS`(이름 낱말) · ERP 연결 · 업체×사업 쌍 · 이알피 계약 맞추기 · 체크표 · 목차 · 복사 글.
- `gov-report.html`: 왼쪽 「📂 컨설팅 사업」 패널(누르면 거르기, 다시 누르면 풀기) · 서류 체크표 · 목록 줄 「목차」 · 목차 창(복사). 아무것도 쓰지 않는다.
- 등록부 `govreport` 빌려 읽기 셋(`data/biz_cons_types`·`data/consultings`·`scal_erpTypeMap`) · `pu-ontology.js ?v=61`.
- 검사: `tests/gov-report-docs.test.js`(새) · `tests/gov-report-app.test.js`(늘림) · 합성 자료 넓힘.

## 검증
- 묶음 검사(계획 Task 4 Step 1): [통과 수] 통과 / [실패 수] 실패. `node tests/shared-js-cache-version.test.js` 통과.
- 전체 `node --test "tests/**/*.test.js"`: [전체 수] 중 [통과 수] 통과 · [실패 수] 실패 · [건너뜀 수] 건너뜀.
- 배포하지 않았다. 파이어베이스 규칙 변경 없음(새로 읽는 자리는 모두 기존 로그인 규칙).

## 남긴 함정
- **서류 틀은 이름 낱말로 고른다** — 차례가 뜻이다(`산업일자리전환컨설팅충남` 이 `산업일자리` 보다 먼저). 이알피에서 사업 이름을 바꾸면 틀이 「서류 틀 없음」으로 떨어질 수 있다. 일터혁신은 이알피 이름이 「일터상생혁신컨설팅」이라 낱말을 둘 둔다.
- 업체×사업 쌍(`pairs`)은 현황판 `candidates` 와 같은 조건(지운 업체 뺌 · 사전진단 뺀 회차 · 해 = 첫 회차)이다 — 한쪽만 바꾸면 체크표와 목록이 다른 업체를 센다.
- 이알피 계약 맞추기: 업체는 `erpId` → 사업자번호(둘 다 있으면 그것만) → 이름(법인 표기 뗌), 사업은 코드 → 이음표. 못 맞추면 머리말 「[확인 필요] 푸른이알피 계약 못 찾음」, 목차는 그대로 만든다.
- 기한 = 이알피 계약 종료일(`endDate`) — 기관 제출 기한이 따로 생기면 바꾼다.
- 회차 수 = 잡힌 회차(사전진단 뺌)와 정한 회차(`customRounds`→`type.rounds`) 중 큰 것.
- `data/consultings` 를 통째로 읽는다(금액 포함) — 화면·목차·복사 글에는 날짜·담당 이름만 쓴다. 연락처·금액을 그리지 않는 검사가 있다.
- ③서명본 ④별첨 ⑤제출은 칸만 있다(「—」). 저장 자리·규칙은 서명·제출 단계에서 정한다.

## 다음
- 배포 뒤 실제 이알피 사업으로 틀 붙음·연결 확인 → [확인 필요] 둘(현장클리닉 운영지침·농촌융복합 양식 글자) 풀기 → ③④⑤ 저장(서명·제출 단계) → 대형형 단계 상태(§14).
```

- [ ] **Step 5: 커밋** (PowerShell)

```powershell
git add STATUS.md status/2026-10-10-gov-report-docs.md
git commit -m @'
docs(status): 컨설팅보고서 앱 서류 관리(왼쪽 패널)·목차 기록

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
'@
```

- push·PR 은 컨트롤러가 한다.

---

## 자기 점검 — 설계서 대조

| 설계서 | 작업 |
|---|---|
| §1 왼쪽 패널: `data/biz_cons_types` 를 기관별로, 누르면 거르기·다시 누르면 풀기 | T1 `visibleTypes`·`groupByAgency`·`sidebarGroups` · T2 `grRenderBiz`·`grSetBiz`·`grFilter` · 검사 ⑩⑪ |
| §1 사업마다 서류 틀, 간단형·대형 표시 | T1 `DOC_PLANS`·`planFor`·`KIND_KO` · T2 `.bz-k` · T3 체크표 머리 |
| §1 목차 창(머리말 + 번호 줄 + 회차 펼침 + 상태 딱지) + 「복사」 | T1 `tocFor`·`tocText` · T3 `grOpenToc`·`grRenderToc`·`grCopyToc` · 검사 ⑯⑰⑱ |
| §1 체크표 ①② 자동(`scal_reports` → 현황판 상태) | T1 `docsTable`(`chips`) · T3 `grRenderDocs` · 검사 ⑭ |
| §1 「하지 않는다」(③④⑤ 저장 · 받은 서류함 · AI · 파일 생성 · 쓰기) | ③④⑤ 는 「—」 · 쓰기 명령 없음 검사 + `쓴것` 0 검사(⑩⑪⑭⑯) · 등록부 `writeContracts` 그대로 검사 |
| §2 읽는 자리 셋 + 이미 읽는 것 | T2 `GR_DOC_NODES`(+`data/user_dir` 담당 이름) · `grLoadDocs` |
| §2 숨김·`mergedInto` 건너뛰기 · sortOrder·이름 정렬 · 기관 미지정 · 묶음 차례 | T1 검사 「visibleTypes」·「groupByAgency」 |
| §2 연결 없으면 「정부사업일정에 사업 없음」(업체 0) | T1 `linkOf`·`sidebarGroups` · 검사 「sidebarGroups」·⑩ |
| §2 업체 찾기는 `scal_cos` 기준, ERP 행은 사업자번호(없으면 이름) · 못 맞추면 [확인 필요] | T1 `pairs`·`consFor`(앞에 `erpId` 하나 더) · 검사 「consFor」·⑰ |
| §3 `DOC_PLANS` 이름 낱말 · 틀 모양 `{key, kind, items:[{id,name,per,step,note?}], source}` · 표의 틀 아홉 | T1 `DOC_PLANS`/`NONE` · 검사 「planFor」·「DOC_PLANS」 |
| §3 대형은 목차만 · 코드 상수(PR 필요) · [확인 필요] 그대로 딱지 | T1 `auto` 는 간단형 셋만 · `check` → 줄마다 `[확인 필요: …]` · 검사 ⑮ |
| §4 열 ①~⑤ + 기한 · 간단형 셋만 ①② · 다른 틀은 «서류 목차 보기» | T1 `COLS`·`AUTO`·`docsTable` · T3 · 검사 ⑭⑮ |
| §5 머리말(이름·사업·기관·기간·담당·회차) · `per:'round'` 펼침 · 딱지 · 복사 · 개인정보 | T1 `tocFor`(`period` 대체·`manager` 대체·`months`) · 연락처·금액 없음 검사 |
| §6 오류·빈 상태 문구 · ERP 못 맞추면 [확인 필요] | T2 `grRenderBiz`·`grRetryDocs` · 검사 ⑫⑬ · ⑰ |
| §7 만들 것 · 등록부 sharedRoots · 기록 | T1~T4 · T2 Step 7·8 |

**설계서에서 열려 있던 것 — 이 계획이 정한 것**
- 「일터혁신」 낱말: 이알피의 보이는 이름은 `일터상생혁신컨설팅`(옛 `일터혁신상생컨설팅` 은 숨김·합침)이라 낱말 `['일터혁신','일터상생혁신']` 둘로 맞춘다.
- 틀 줄의 `step`: 표에 괄호가 없는 줄은 성격대로 정했다(서약서·여비·만족도·사진·영수증 = `attach`, 등록·계획서(대형) = `plat`, 보고서류 = `report`). ①② 딱지는 간단형 셋의 `report` 줄에만 붙는다(서산은 방문확인서·결과보고서 둘 — 서고의 `visit`·`report` 파일과 같다).
- `[확인 필요: 운영지침]`·`[확인 필요: 양식 글자]` 는 표의 행 끝 표기라 틀 전체(`plan.check`)로 두고 줄마다 딱지를 단다. `note` 칸은 쓰지 않는다(지어내지 않는다).
- 「착수·중간·최종보고」는 세 줄로 나눴다. `industry-cn` 의 수행일지는 표에 회차 표시가 없어 `once`.
- 기한 = 이알피 계약 종료일(`endDate`), 없으면 「—」. 회차 수 = 잡힌 회차와 정한 회차 중 큰 것. `per:'month'` 는 계약 기간(없으면 회차 첫·끝)의 달로 펼친다.
- ERP 사업 연결이 없는 목차(사업을 안 고르고 목록에서 연 경우 등)는 정부사업일정 사업 이름으로 틀을 고르고 「[확인 필요] 푸른이알피 사업 연결 없음」을 단다.
- 업체 맞추기에 `scal_cos.erpId`(정부사업일정이 가져오기 때 적는 이알피 컨설팅 id)를 사업자번호 앞에 둔다 — `findCoForErp` 와 같은 차례.
- 담당 = 이알피 `managerMain`(사번 → `data/user_dir` 이름), 못 찾으면 정부사업일정 담당(주·부).
- 연결 없는 사업도 누를 수 있다 — 목록은 비고, 체크표 자리에 「정부사업일정에 사업 없음 — 사업 잇기는 정부사업일정의 ERP 연결에서」.
