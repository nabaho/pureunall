# 정부컨설팅 보고서 2단계(간단형) — 보고서 작성 창 · 양식 서고 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 정부사업일정의 사업장 「크게 보기」 창에서 [📄 보고서 작성]을 누르면 다음이 이어지게 한다.
1. 업체정보·회차·받은 메일·보낸 서류를 모은 검토 화면(A안)이 열린다.
2. 고친 내용을 임시 저장하거나 확정한다.
3. 양식 서고에 등록된 기관 빈 양식으로 채운 한글(HWPX) 파일을 내려받는다.

대상은 간단형 세 양식이다: 충남북부상의 `cci-north`, 서산상의 `cci-seosan`(visit·report), 기술보호 `techguard`.

**Architecture:** 화면 밖에서 시험할 수 있는 일은 공용 js 두 개로 뺀다.
- `js/pu-gov-report-build.js`: 정부사업일정 자료 → 보고서 자료·출처·경고
- `js/pu-gov-report-pack.js`: 빈 양식 HWPX + 자료 → 채운 HWPX 바이트

`gov-consulting.html` 에는 창 두 개만 더한다.
- 「양식 서고」(관리자): 등록·대조
- 「보고서 작성」(A안)

저장은 실시간DB 새 자리 둘이다.
- `scal_rptForms`: 빈 양식(b64, 기금 `tpl_orig` 방식)
- `scal_reports`: 보고서 초안·확정

이 둘은 `FB_NODES` 에 넣지 않고 `_fbDB.ref()` 로 따로 읽고 쓴다. 통째 내려받기와 구독을 막기 위해서다.

**Tech Stack:** 브라우저/Node 겸용 UMD js(기존 `js/pu-gov-report.js` 꼴) · `node --test` + `vm`(gov-consulting 함수 떠서 돌리기) · `vendor/jszip.min.js` · Firebase RTDB compat · 규칙 생성기 `scripts/make-firebase-rules.js`

**Spec:** `docs/superpowers/specs/2026-10-05-정부컨설팅-보고서자동화-design.md` — §5(서고), §6(흐름·자료·검토·저장), §6-2-1(받은 자료), §13(①④⑦), §14(간단형·A안·서고 (가))

## Global Constraints

- 모르는 값은 밑줄(엔진 `BLANK`) — 지어내지 않는다.
- **근로자수는 상시근로자수만**. 이알피에는 그 칸이 없다(`employmentInsuredCount` 는 피보험자수 — 쓰지 않는다). 처음엔 빈칸이고 「확인 필요」 경고를 띄워 사람이 넣는다.
- 보고서에서 추가한 회차는 **정부사업일정(`scal_scheds`)에 쓰지 않는다**.
- 확정 전에는 아무것도 밖으로 나가지 않는다. [확정]은 그 사업장 담당·부담당 또는 관리자(`isAdmin()`)만 누른다.
- 개인 단위 자료(급여대장·근태·4대보험 명부 등)는 목록에만 둔다. 2단계에는 AI 가 없다(3단계).
- 기술보호 사업장 자료에는 «기술보호 자료» 딱지를 단다(§13-①).
- 공개 저장소다 — 검사·문서에 실제 업체·사람 이름·연락처·실제 양식 파일을 넣지 않는다(합성 자료만).
- 새 localStorage 키를 쓰면 `LS_VALID_KEYS`(gov-consulting.html :2274)에 넣는다. 큰 것(양식 b64)은 localStorage 에 두지 않는다.
- 공용 js 를 HTML 에 붙일 때 `?v=N` 필수다. 고친 js 는 그것을 부르는 모든 HTML 의 `?v` 를 함께 올린다(pre-commit 훅).
- 정규식에 «글자 뒤 `\n`» 금지(`\r?\n`). 정규식 안 짝 없는 `{` 금지.
- 남의 함수 이름으로 시작하는 새 함수 이름 금지. 새 함수는 `grp` 접두(gov report)를 쓴다.
- 커밋 끝 줄: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
- 실행: `node --test tests/<파일>.test.js`. CI 는 `node --test tests/*.test.js functions/*.test.js`.

## 파일 구조

| 파일 | 할 일 |
|---|---|
| `js/pu-gov-report-build.js` (새) | `resolveFormKey` · `buildReport` |
| `js/pu-gov-report-pack.js` (새) | `fillHwpx` · `scrubPackage` · `b64` 도우미 |
| `scripts/make-firebase-rules.js` (고침) | `scal_reports`(로그인 쓰기) · `scal_rptForms`·`scal_rptFormsIndex`(관리자 쓰기) |
| `docs/firebase-rules-전체-적용본.json`, `docs/rules-paste.json` (다시 만듦) | 생성기 출력 |
| `gov-consulting.html` (고침) | 스크립트 줄 · 양식 서고 창 · 보고서 작성 창 · 「크게 보기」 단추 |
| `tests/gov-report-build.test.js`, `tests/gov-report-pack.test.js`, `tests/gov-report-ui.test.js` (새) | 검사 |
| `tests/gov-save-permission.test.js` 등 규칙 검사 (필요 시 고침) | 새 자리 반영 |

## 자료 꼴 (모든 작업 공통)

`buildReport` 가 받는 것(`input`):
```js
{
  co:    { id, name, defAtt, defCoAtts:[], erpId },                 // scal_cos 한 줄
  type:  { id, name, fullName, agency },                            // scal_types 한 줄
  scheds:[{ id, date, round, phase, isField, memo, typeId, coId }], // 그 사업장·그 사업 일정
  cons:  { programName, company:{ name, bizNo, ceo, address, phone, fax, email, bizType, bizCategory,
           contacts:[{ name, role, phone, fax, email, isPrimary }] } } | null,   // 이알피 계약(erpConsByCo)
  mail:  [{ d:'2026-09-02', io:'in'|'out', s:'제목', w:'보낸이' , att:['파일명'] }],   // pucards/coMail rows
  sent:  [{ d:'2026-10-02', name:'파일명' }],                        // pucards/sentDocs
  staffName: '노무사 이름', today:'2026-10-09', saved: <scal_reports 초안 또는 null>
}
```
`buildReport` 가 돌려주는 것:
```js
{ formKey, report /* pu-gov-report 의 report 꼴: company·rounds·summary·consultant·writtenAt·field·techField */,
  src: { '업체명':'이알피 계약', '근로자수':'', … },   // 칸 → 출처 이름표
  warnings: ['…'], feed: [{ d, kind:'일정'|'받은 메일'|'보낸 메일'|'보낸 서류', text, att:[], priv:true|false }],
  techguard: true|false }
```

---

### Task 1: `js/pu-gov-report-build.js` — 사업 종류로 양식 고르기 + 보고서 자료 모으기

**Files:** Create `js/pu-gov-report-build.js` · Test `tests/gov-report-build.test.js`

**Interfaces:**
- Produces:
  - `PuGovReportBuild.resolveFormKey(type, programName) → {formKey|null, ask:boolean, choices:[formKey…]}`
  - `PuGovReportBuild.buildReport(input) → (위 꼴)`
  - `PuGovReportBuild.PRIV_RE` — 개인 단위 자료 파일명 정규식

- [ ] **Step 1: 실패하는 검사 작성** (합성 자료 — 가나상사·홍길동)

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('../js/pu-gov-report-build.js');

const base = () => ({
  co: { id: 'c1', name: '가나상사', defAtt: 's1', defCoAtts: [], erpId: 'k1' },
  type: { id: 'bxeyzrxm', name: '인사충남', fullName: '인사노무컨설팅충남북부상의', agency: '충남북부상공회의소' },
  scheds: [
    { id: 'a', date: '2025-10-02', round: 2, phase: '', isField: false, memo: '임금체계 검토', typeId: 'bxeyzrxm', coId: 'c1' },
    { id: 'b', date: '2025-09-04', round: 1, phase: '', isField: true, memo: '취업규칙 개정 요청', typeId: 'bxeyzrxm', coId: 'c1' },
    { id: 'p', date: '2025-08-20', round: 0, phase: 'pre', isField: true, memo: '사전진단', typeId: 'bxeyzrxm', coId: 'c1' },
  ],
  cons: { programName: '인사노무컨설팅충남북부상의', company: { name: '가나상사', bizNo: '123-45-67890', ceo: '김가나',
    address: '충남 천안시 가나로 1', bizType: '제조업', bizCategory: '금속', employmentInsuredCount: 9,
    contacts: [{ name: '홍길동', role: '총무팀/대리', phone: '041-000-0000', email: 'hong@example.com', isPrimary: true }] } },
  mail: [{ d: '2025-09-02', io: 'in', s: '취업규칙 검토 요청', w: '홍길동', att: ['취업규칙.hwp'] },
         { d: '2025-09-20', io: 'in', s: '9월 급여', w: '홍길동', att: ['급여대장_9월.xlsx'] }],
  sent: [{ d: '2025-10-02', name: '임금체계 검토 의견서.hwp' }],
  staffName: '이푸른', today: '2025-11-20', saved: null,
});

test('resolveFormKey — 사업 종류 이름·정식명·이알피 사업명으로 고른다, 애매하면 묻는다', () => {
  assert.equal(B.resolveFormKey({ name: '인사충남' }, '').formKey, 'cci-north');
  assert.equal(B.resolveFormKey({ name: '인사서산' }, '').formKey, 'cci-seosan');
  assert.equal(B.resolveFormKey({ name: '기술보호', fullName: '기술보호울타리' }, '').formKey, 'techguard');
  assert.equal(B.resolveFormKey({ name: '인사노무', agency: '상공회의소' }, '인사노무컨설팅서산').formKey, 'cci-seosan');
  const amb = B.resolveFormKey({ name: '인사노무', agency: '상공회의소' }, '');
  assert.equal(amb.formKey, null); assert.equal(amb.ask, true); assert.deepEqual(amb.choices, ['cci-north', 'cci-seosan']);
  assert.equal(B.resolveFormKey({ name: '일터혁신' }, '').formKey, null);       // 대형 — 2단계 대상 아님
});
test('buildReport — 기업정보는 이알피 계약에서, 근로자수는 비우고 경고(피보험자수 안 씀)', () => {
  const r = B.buildReport(base());
  assert.equal(r.formKey, 'cci-north');
  assert.equal(r.report.company.name, '가나상사');
  assert.equal(r.report.company.bizType, '제조업');
  assert.equal(r.report.company.contact, '홍길동');
  assert.equal(r.report.company.contactTitle, '총무팀/대리');
  assert.equal(r.report.company.workers, '');
  assert.equal(r.src['업체명'], '이알피 계약');
  assert.ok(r.warnings.some((w) => /근로자수/.test(w)));
});
test('buildReport — 회차는 사전진단 빼고 날짜순, 방문 여부·메모를 옮긴다', () => {
  const r = B.buildReport(base());
  assert.deepEqual(r.report.rounds.map((x) => x.date), ['2025-09-04', '2025-10-02']);
  assert.equal(r.report.rounds[0].visit, true);
  assert.equal(r.report.rounds[1].visit, false);
  assert.equal(r.report.rounds[0].advice, '취업규칙 개정 요청');
  assert.equal(r.report.consultant, '이푸른');
  assert.equal(r.report.writtenAt, '2025-11-20');
});
test('buildReport — 회차가 기관 기준보다 적으면 경고(충남북부 3회)', () => {
  assert.ok(B.buildReport(base()).warnings.some((w) => /3회/.test(w)));
});
test('buildReport — 출처 목록: 일정·받은 메일·보낸 서류가 날짜순, 개인 단위 첨부는 priv', () => {
  const f = B.buildReport(base()).feed;
  assert.deepEqual(f.map((x) => x.d + ' ' + x.kind),
    ['2025-09-02 받은 메일', '2025-09-04 일정', '2025-09-20 받은 메일', '2025-10-02 일정', '2025-10-02 보낸 서류']);
  assert.ok(f.find((x) => /급여/.test(x.text)).priv);
  assert.ok(!f.find((x) => /취업규칙 검토/.test(x.text)).priv);
  for (let i = 1; i < f.length; i++) assert.ok(f[i - 1].d <= f[i].d, '날짜순');
});
test('buildReport — 산출물은 보낸 서류로 채운다', () => {
  assert.deepEqual(B.buildReport(base()).report.summary.outputs, ['임금체계 검토 의견서']);
});
test('buildReport — 저장된 초안이 있으면 그 값이 이긴다(사람이 고친 것)', () => {
  const i = base(); i.saved = { report: { company: { workers: '12' }, summary: { etc: '없음' } } };
  const r = B.buildReport(i);
  assert.equal(r.report.company.workers, '12');
  assert.equal(r.report.summary.etc, '없음');
  assert.ok(!r.warnings.some((w) => /근로자수/.test(w)));
});
test('buildReport — 기술보호는 딱지를 단다', () => {
  const i = base(); i.type = { id: 't4', name: '기술보호', fullName: '기술보호울타리' };
  assert.equal(B.buildReport(i).techguard, true);
});
```
(같은 날짜면 일정 → 메일 → 보낸 서류 차례. 사전진단 일정은 feed 에서도 뺀다.)

- [ ] **Step 2: 실패 확인** — `node --test tests/gov-report-build.test.js` → `Cannot find module`.
- [ ] **Step 3: 구현** — `js/pu-gov-report-build.js` (UMD, `root.PuGovReportBuild`).
  - `resolveFormKey`
    - `type.name`·`fullName`·`programName` 을 한 줄로 이어 본다.
    - 「서산」 → `cci-seosan`, 「충남북부」 또는 `name==='인사충남'` → `cci-north`, 「기술보호」 → `techguard`.
    - 「상공회의소」·「인사노무」만 있으면 `{formKey:null, ask:true, choices:['cci-north','cci-seosan']}`.
    - 그 밖은 `{formKey:null, ask:false, choices:[]}`.
  - `buildReport`
    - company 매핑: `name, bizNo, ceo, address`, `bizType` ← `bizType`(업태, 없으면 `bizCategory`).
    - 연락처는 `contacts` 의 `isPrimary`(없으면 첫째)를 쓴다: `contact`·`contactTitle(role)`·`tel(phone)`·`fax`·`email`. `contactDept` 는 비운다.
    - `workers` 는 '' 로 두고 경고 「근로자수(상시근로자수)는 이알피에 없습니다 — 직접 넣어 주세요」.
    - rounds: `phase!=='pre'` 를 날짜순으로, `{date, visit:isField===true?true:isField===false?false:null, advice:memo}`.
    - 모자람 경고는 `PuGovReport.FORMS[formKey].rounds.min` 이 있으면 쓰고, Node 에서는 `require('./pu-gov-report.js')` 로 같은 값을 읽는다.
    - `summary.outputs` ← `sent` 파일명에서 확장자를 뗀 것.
    - `consultant` ← `staffName`, `writtenAt` ← `today`.
    - `saved.report` 가 있으면 깊게 덮는다(빈 문자열도 «사람이 비운 값»으로 존중).
    - feed: 일정(「n회 · 방문|사무 · 메모」)·mail(io 로 받은/보낸)·sent 를 합쳐 날짜순. 첨부 파일명이 `PRIV_RE`(`/급여|근태|명부|4대|원천|주민|통장|연말정산/`)에 걸리면 `priv:true`.
    - `src`: 이알피에서 온 칸은 「이알피 계약」, 일정에서 온 칸은 「정부사업일정」, 비어 있으면 ''.
    - `techguard`: formKey 가 `techguard` 이면 true.
- [ ] **Step 4: 통과 확인** → PASS.
- [ ] **Step 5: 커밋** `feat(gov-report): 정부사업일정 자료로 보고서 자료 모으기(build)`

---

### Task 2: `js/pu-gov-report-pack.js` — 빈 양식 HWPX + 자료 → 채운 HWPX

**Files:** Create `js/pu-gov-report-pack.js` · Test `tests/gov-report-pack.test.js`

**Interfaces:**
- Consumes: `PuGovReport.fillForm(xml, formKey, fileKey, report)`, JSZip(인자로 받는다 — Node 검사는 `require('../vendor/jszip.min.js')`)
- Produces:
  - `PuGovReportPack.fillHwpx(bytes:Uint8Array, formKey, fileKey, report, JSZip) → Promise<{bytes:Uint8Array, result}>`
    - result 는 fillForm 결과(left·unknown·short·over·missing)
  - `PuGovReportPack.checkTemplate(bytes, formKey, fileKey, JSZip) → Promise<{missing:[…], sections:n}>` — 빈 자료로 fillForm 을 돌려 `missing` 만 본다(서고 등록 대조)
  - `PuGovReportPack.b64ToBytes(s)`, `bytesToB64(u8)`

- [ ] **Step 1: 실패하는 검사**
  - 합성 HWPX 를 검사 안에서 만든다: JSZip 에 `mimetype`(`application/hwp+zip`), `Contents/section0.xml`(= `tests/gov-report-fill.test.js` 의 `northXml()` 과 같은 꼴, 그 파일에서 함수를 **복사해 오지 말고** 검사 파일 안에 최소 꼴만 새로 쓴다), `Preview/PrvText.txt`('지난 글'), `Preview/PrvImage.png`, `Contents/content.hpf`(`<opf:title>지난 제목</opf:title>`).
  - 검사할 것
    - ① 결과 zip 첫 항목이 `mimetype` 이고 무압축(STORE)이다.
    - ② section0 에 값이 들고 `{{` 가 없다.
    - ③ `Preview/PrvImage.*` 가 없다.
    - ④ PrvText 가 비었다.
    - ⑤ content.hpf 의 title 이 비었다.
    - ⑥ `checkTemplate` 가 칸 하나 없는 양식에서 `missing` 을 돌려준다.
    - ⑦ b64 왕복이 바이트를 보존한다.
- [ ] **Step 2: 실패 확인**
- [ ] **Step 3: 구현**
  - 포장: section*.xml 을 모두 돌며 `Contents/section0.xml` 만 fillForm(지도는 section0 기준)한다. 나머지 항목은 그대로 둔다.
  - 다시 묶을 때 `mimetype` 을 먼저 `{compression:'STORE'}` 로, 나머지는 DEFLATE 로 넣는다.
  - `Preview/PrvImage*` 를 지우고, PrvText 를 '' 로 두고, content.hpf 의 `<opf:title>`·`<opf:meta …>값</opf:meta>` 값을 비운다.
  - 지운 그림이 쓰던 `BinData/*` 는 section·header 어디에서도 참조하지 않으면 지우고, `content.hpf` 의 해당 `opf:item` 도 지운다.
  - 정규식에 짝 없는 `{` 를 쓰지 않는다.
- [ ] **Step 4: 통과 확인**
- [ ] **Step 5: 커밋** `feat(gov-report): 빈 양식 HWPX 채워 다시 묶기(pack)`

---

### Task 3: 실시간DB 규칙 — `scal_reports` · `scal_rptForms` · `scal_rptFormsIndex`

**Files:** Modify `scripts/make-firebase-rules.js` (:612~630 일정관리 자리) · 다시 만들기 `docs/firebase-rules-전체-적용본.json`, `docs/rules-paste.json` · Test: 기존 `tests/firebase-rules-apply.test.js`·`tests/gov-save-permission.test.js`·`tests/gov-rules.test.js`(필요하면 새 자리 반영) + `tests/gov-report-rules.test.js`(새)

**Interfaces:**
- Produces:
  - `scal_reports`: `scal()` 과 같다(읽기 LOGIN, `$k/$k2` 쓰기 LOGIN, 부모 지우기 ADMIN).
  - `scal_rptForms`·`scal_rptFormsIndex`: `{'.read': LOGIN, '.write': ADMIN}`. 양식 등록은 관리자만.

- [ ] **Step 1: 실패하는 검사** `tests/gov-report-rules.test.js`
  - 생성기를 돌려(`require` 또는 `child_process` 로 기존 검사들이 하는 방식 그대로) 세 자리가 있는지 본다.
  - `scal_rptForms` 의 쓰기가 ADMIN 식과 같은지 본다.
  - `scal_reports` 가 다른 `scal_*` 과 같은 꼴인지 본다.
- [ ] **Step 2: 실패 확인**
- [ ] **Step 3: 구현**
  - 생성기 목록에 `'scal_reports'` 를 더한다.
  - `rules.scal_rptForms`·`rules.scal_rptFormsIndex` 를 따로 정한다.
  - `node scripts/make-firebase-rules.js > docs/firebase-rules-전체-적용본.json` 로 다시 만들고, `docs/rules-paste.json` 도 기존 절차(같은 검사가 요구하는 것)대로 맞춘다.
- [ ] **Step 4: 통과 확인** — 새 검사 + `tests/firebase-rules-apply.test.js tests/gov-save-permission.test.js tests/gov-rules.test.js tests/rules-paste-copy.test.js`
- [ ] **Step 5: 커밋** `feat(rules): 정부컨설팅 보고서 자리 — scal_reports·scal_rptForms(관리자 쓰기)`
- ⚠ **게시(`scripts/rules-deploy.js --deploy`)는 하지 않는다.** 대표 승인 뒤 컨트롤러가 따로 묻는다. 게시 전에는 화면이 «저장 권한 없음» 을 그대로 알린다(Task 5 가 그 경우를 다룬다).

---

### Task 4: gov-consulting.html — 스크립트 줄 + 「양식 서고」 창(관리자)

**Files:** Modify `gov-consulting.html` · Test `tests/gov-report-ui.test.js` (새, 함수 떠서 vm)

**Interfaces:**
- Consumes: `PuGovReportPack.checkTemplate`, `PuGovReport.FORMS`, `_fbDB`, `isAdmin()`, `toast`, `closeModal`, `.mb` 창 꼴
- Produces (전역 함수):
  - `grpFormsRef(formKey, fileKey, year)` → `_fbDB.ref('scal_rptForms/'+formKey+'/'+fileKey+'/'+year)`
  - `grpFormsIndexRef()`
  - `grpLoadTemplate(formKey, fileKey, year) → Promise<Uint8Array|null>` — 해당 연도가 없으면 그 이전 가장 최근 연도
  - `grpSaveTemplate(formKey, fileKey, year, file:File) → Promise<{missing}>` — `.hwpx` 만 받는다. `checkTemplate` 의 `missing` 이 있으면 저장하지 않고 목록을 보인다(「올해 양식이 바뀌었습니다 — 이 방에 지도를 고쳐 달라고 하세요」). 없으면 본문을 먼저, 색인을 나중에 쓴다(기금 `tplCloudPut` 차례).
  - `grpOpenForms()` — 「양식 서고」 창. 관리자만 열린다. 양식별·파일별·연도별 등록 상태를 보이고, [등록] 파일 고르기 → 대조 → 저장.

- [ ] **Step 1: 실패하는 검사** — vm 으로 `grpSaveTemplate` 를 떠서 가짜 `_fbDB`(`tests/helpers/fake-rtdb.js`)·가짜 `PuGovReportPack.checkTemplate` 로 돌린다.
  - ① missing 이 있으면 쓰지 않는다.
  - ② 없으면 본문 → 색인 차례로 쓴다.
  - ③ `.hwp` 는 거절한다(「한글에서 HWPX 로 바꿔 올려 주세요」).
  - ④ `isAdmin()` 이 false 면 `grpOpenForms` 가 창을 열지 않는다.
- [ ] **Step 2: 실패 확인**
- [ ] **Step 3: 구현**
  - `<head>` 의 js 줄(:1246~1271) 끝에 `js/pu-hwpx-fill.js?v=6`(fund 와 같은 판)·`js/pu-gov-report.js?v=1`·`js/pu-gov-report-build.js?v=1`·`js/pu-gov-report-pack.js?v=1` 을 그 차례로 넣는다.
  - JSZip 은 fund 처럼 `vendor/jszip.min.js` 를 지연 로드한다(`grpLoadJsZip`).
  - 서고 창 마크업은 다른 `.mb` 창 옆에 둔다. 진입은 관리자에게만 보이는 작은 단추 하나 — 「크게 보기」 창 머리 오른쪽 「⚙ 양식 서고」.
- [ ] **Step 4: 통과 확인** + `tests/shared-js-cache-version.test.js` + gov 관련 기존 검사 전부 (`node --test tests/gov-*.test.js`)
- [ ] **Step 5: 커밋** `feat(gov): 정부컨설팅 보고서 양식 서고(관리자 등록·지도 대조)`

---

### Task 5: gov-consulting.html — 「📄 보고서 작성」 창 (A안)

**Files:** Modify `gov-consulting.html` · Test `tests/gov-report-ui.test.js` (더함)

**Interfaces:**
- Consumes:
  - `PuGovReportBuild.resolveFormKey/buildReport`, `grpLoadTemplate`, `PuGovReportPack.fillHwpx`
  - `getCos/getTypes/getScheds`, `erpConsByCo`
  - `_fbDB`(`pucards/coMail/{열쇠}`·`pucards/sentDocs/{열쇠}` 읽기 — 열쇠는 `js/pu-cokey.js` 의 `PuCoKey` 로 사업자번호에서 만든다. 못 만들면 메일·서류 목록은 비우고 「사업자번호가 없어 메일을 못 찾았습니다」라고 적는다)
  - `isAdmin()`, `myId()`, `getCoAtts(co)`
- Produces:
  - `grpOpenReport(coId, typeId)` — 창을 연다. formKey 가 애매하면 먼저 고르게 한다.
  - `grpCollect(coId, typeId) → Promise<input>` — buildReport 입력을 모은다.
  - `grpRender(state)` — 화면을 그린다.
    - 위: 경고 띠(회차 미달·빈 칸 수·근로자수·서고 대조·기술보호 딱지)
    - 왼쪽: ①기업정보 ②회차별 수행(표, [+ 회차 추가] — 「보고서에서 추가」 딱지) ③종합 ④서명·작성일 — 칸마다 아래 출처 이름표
    - 오른쪽: 출처 목록(feed, 개인 자료 딱지)
  - `grpSaveDraft()` → `scal_reports/{coId}/{rid}` 에 `{formKey, typeId, state:'초안', report, rounds, updatedAt, updatedBy}`. `rid` 는 `typeId+'_'+연도`.
  - `grpDownload(fileKey)` → 서고 양식을 채워 `PureunHwp.download` 없이 Blob + `a.download` 로 내려받는다(사람이 누른 클릭이라 막히지 않는다). 파일 이름은 `「기관」_「양식」_「사업장」_초안|확정.hwpx`. 서산은 visit·report 단추 둘.
  - `grpConfirm()` → 담당·부담당·관리자만. `state:'검토완료'`, `ver+1`, `confirmedBy/At`. 확정 뒤에는 칸을 잠그고 [새 판으로 고치기]만 둔다(§13-⑧).
  - 「크게 보기」 창 `#tzSum` 의 `📋 날짜 복사` 옆에 [📄 보고서 작성] 단추. formKey 를 못 고르는 사업(대형 등)에서는 단추를 숨긴다.
- 실패의 꼴
  - 규칙 미게시로 쓰기가 거절되면 「아직 저장 자리가 열리지 않았습니다(관리자 규칙 게시 필요) — 내려받기는 됩니다」 를 띄우고, 화면 값은 그대로 둔다.
  - 서고에 양식이 없으면 내려받기 단추 자리에 「양식 서고에 ○○ 양식이 없습니다」.

- [ ] **Step 1: 실패하는 검사** (vm, 가짜 자료)
  - ① `grpCollect` 가 사전진단 일정을 빼고 그 사업 일정만 모은다.
  - ② [+ 회차 추가] 가 `scal_scheds` 를 건드리지 않는다(fbPush·lsSet 호출 0).
  - ③ `grpConfirm` 은 담당이 아닌 사람에게 거절한다.
  - ④ `grpSaveDraft` 가 쓰는 경로·꼴.
  - ⑤ 확정 뒤 `grpSaveDraft` 가 확정본을 덮지 않는다(새 판으로만).
  - ⑥ 단추가 부르는 `grp*` 함수가 모두 이 파일에 있다(onclick 문자열 → 함수 정의 대조).
- [ ] **Step 2: 실패 확인**
- [ ] **Step 3: 구현** — 시안 A안의 배치를 따른다(정부사업일정의 기존 `.mb` 창 꼴·글꼴·색 변수 사용). 모바일 폭(≤860px)에서는 오른쪽 출처가 아래로 내려간다.
- [ ] **Step 4: 통과 확인** + `node --test tests/gov-*.test.js tests/shared-js-cache-version.test.js`
- [ ] **Step 5: 커밋** `feat(gov): 📄 보고서 작성 창(A안) — 임시 저장·HWPX 내려받기·확정`

---

### Task 6: 눈으로 확인 + 기록

- [ ] 로컬 정적 서버(`.claude/launch.json` 의 `static` = 8799)로 `gov-consulting.html` 을 띄운다.
  - 로그인 없이 볼 수 있는 것만 본다(창 마크업·배치·모바일 폭). 콘솔 오류가 0개인지 확인한다.
  - 실제 자료·저장은 배포 뒤 대표 확인 거리로 남긴다.
  - ⚠ 실제 업체 자료로 화면을 찍어 저장소에 넣지 않는다.
- [ ] `status/2026-10-09-gov-report-step2-ui.md` 를 쓴다(무엇·왜·남긴 함정: 규칙 게시 전엔 저장 불가, 근로자수 수동, 서고 등록은 관리자·HWPX 만).
- [ ] STATUS.md 정부컨설팅 줄에 「2단계 구현 · 규칙 게시 대기」 체크상자를 더한다.
- [ ] 전체 `node --test tests/*.test.js` — 새로 빨개진 것이 없는지 본다.
- [ ] 커밋. push·PR 은 컨트롤러가 한다. 규칙 게시는 대표 승인 뒤에 한다.
