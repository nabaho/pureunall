# 정부컨설팅 보고서 3단계 — AI 초안 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 보고서 작성 창(A안)의 **✨ AI 초안** 단추를 살린다. 누르면 이미 모은 자료(회차·메일 제목·보낸 서류 이름)를 가려서 기존 Claude 프록시로 보내고, 받은 초안을 **비었거나 전에 AI 가 쓴 칸에만** 넣는다. 사람이 쓴 칸은 덮지 않고, 저장은 사람이 누를 때만 한다.

**Architecture:** 화면 밖에서 시험할 수 있는 일은 새 공용 js 하나(`js/pu-gov-report-ai.js`, 순수 함수·UMD)에 둔다.
- 칸 목록(`fieldsFor`) · 가리기(`mask`/`unmask`) · 요청 만들기(`buildRequest`) · 답 읽기(`parseDraft`) · 칸에 넣기(`applyDraft`/`undoDraft`) · 점검(`checkDraft`)

`gov-consulting.html` 은 그 모듈을 부르는 `grpAi*` 함수만 더한다.
- 프록시 부르기는 업무관리(`work.html` `aiProxyUrl`/`aiFetch`/`aiCall`)와 같은 꼴을 `grpAiProxyUrl`/`grpAiFetch`/`grpAiCall` 로 옮겨 둔다(공용 모듈 정리는 범위 밖).
- 「AI 초안」 표시는 보고서 상태 `_grp.aiSrc`(칸 경로 → `'ai'`)와 `_grp.aiVal`(AI 가 넣은 값)로 한다. 지금 값이 `aiVal` 과 다르면 사람이 고친 것이다.
- 임시 저장·확정 기록에 `aiFields`(아직 AI 가 쓴 그대로인 칸 경로 목록)를 함께 남겨, 다시 열어도 이어 받는다.

**Tech Stack:** 브라우저/Node 겸용 UMD js(기존 `js/pu-gov-report-build.js` 꼴) · `node --test` + `vm`(gov-consulting 함수를 떠서 돌리기, `tests/gov-report-ui.test.js` 의 `grab`/`rptWorld`) · 가짜 프록시 = 바꿔치기한 `fetch` · Firebase RTDB 가짜(`tests/helpers/fake-rtdb.js`)

**Spec:** `docs/superpowers/specs/2026-10-10-gov-report-step3-ai-draft-design.md` (상위 `2026-10-05-정부컨설팅-보고서자동화-design.md` §6-3·§9·§11·§13 ⑦)

## Global Constraints

- 채우는 칸은 회차 `rounds[i].inquiry·diagnosis·advice·result·next` 와 종합 `summary.inquiryDiag·review·action·etc·adviceAll·overall` 뿐이다. 그 양식이 쓰지 않는 칸은 보내지도 받지도 않는다(`PuGovReport.FORMS`/`buildValues` 기준).
- 넣는 칸은 **비었거나, 전에 AI 가 넣고 사람이 손대지 않은** 칸만이다. 사람이 쓴 칸은 덮지 않는다.
- 저장은 하지 않는다. 사람이 「💾 임시 저장」·「✔ 확정」을 누를 때만 저장한다(2단계 그대로).
- 보내지 않는 것
  - `priv:true` 자료(`PRIV_RE` = 급여·근태·명부·4대·원천·주민·통장·연말정산)
  - 첨부파일 원본·사진·도장
- 업체 이름·대표자·담당자 이름은 보내기 전에 자리 표시로 바꾸고, 받은 글에서 되돌린다.
- 보내기 직전 모든 글에서 주민등록번호·전화·팩스·계좌로 보이는 숫자열·메일 주소·사업자등록번호를 `[가림]` 으로 바꾼다(되돌리지 않는다).
- **기술보호**: 기본은 끔이다. 노무사가 「이번 건 AI 사용」을 켜야 쓴다. 켜도 회차 날짜·메모만 보낸다(메일·서류·기술 자료·이미 쓴 칸 값은 보내지 않는다).
- 동의: 처음 쓸 때 「업체 자료가 외부 AI(Anthropic)로 전송됩니다 — 가림 처리 후」 확인 창을 띄운다. 브라우저에 `gov_ai_ok`=`'1'` 로 기억한다(`p_` 접두가 아니라 `LS_VALID_KEYS` 정리 대상이 아니다).
- 모델 순서는 `claude-opus-5` → 실패 시 `claude-sonnet-4-20250514` 다(업무관리와 같다). `max_tokens` 8000, 시간 제한 90초다.
- 기록 없는 회차는 정확히 `기록 없음 — 입력 필요`.
- 답 읽기: 첫 `{` ~ 마지막 `}` 를 JSON 으로 읽는다. 못 읽으면 한 번 더 묻고, 그래도 못 읽으면 오류 안내.
- 오류 문구(설계서 §5 그대로)
  - 프록시 없음: `AI 프록시가 설정되지 않았습니다 — 포털 ⚙ 설정`
  - 시간 초과·네트워크: `AI 응답이 없습니다 — 잠시 뒤 다시`
  - JSON 못 읽음: `AI 답을 읽지 못했습니다`
  - 어느 경우든 칸은 그대로 둔다.
- 기술보호+꺼짐, 확정된 판(잠김)이면 단추를 비활성으로 둔다.
- 공개 저장소다 — 검사·문서에 실제 업체·사람 이름·연락처를 넣지 않는다(가나상사·홍길동·김가나·041-000-0000·example.com 만).
- 새 함수는 `grp` 접두(`grpAi…`)를 쓴다. 남의 함수 이름으로 시작하는 이름은 금지다.
- 정규식에 «글자 뒤 `\n`» 금지(`\r?\n`), 정규식 안 짝 없는 `{` 금지. vm 으로 떠 오는 함수(`grab`)의 글자열 안에 짝 없는 `{`·`}` 를 쓰지 않는다(괄호 세기가 틀어진다).
- 새 js 는 `<script src="js/pu-gov-report-ai.js?v=1">` 로 붙인다. 붙인 뒤에 그 js 를 또 고치면 같은 커밋에서 `?v` 를 올린다(pre-commit 훅 `scripts/check-cache-version.js`). `--no-verify` 금지.
- 커밋 메시지는 한국어로 쓰고, 끝에 빈 줄 + `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. 이 방의 Bash 는 따옴표를 씹으므로 커밋은 PowerShell here-string 으로 한다.
- 실행: `node --test tests/<파일>.test.js`. 전체: `node --test "tests/**/*.test.js"`.
- push·PR 은 컨트롤러가 한다.

## 파일 구조

| 파일 | 할 일 |
|---|---|
| `js/pu-gov-report-ai.js` (새) | `fieldsFor` · `mask`/`unmask` · `buildRequest` · `parseDraft` · `applyDraft`/`undoDraft` · `checkDraft` (순수 함수) |
| `tests/gov-report-ai.test.js` (새) | 모듈 검사 |
| `gov-consulting.html` (고침) | 스크립트 줄 · `GRP_AI_*` 상수 · `GRP_ACTS` 세 줄 · `grpAi*` 함수 · `grpSetup`/`grpRecord`/`grpDelRound` 손질 · 단추·딱지·경고·CSS |
| `tests/gov-report-ui.test.js` (고침) | `rptWorld` 이름 목록·상수 정규식 넓히기 + 가짜 프록시로 단추 흐름·화면 |
| `STATUS.md` (고침), `status/2026-10-10-gov-report-step3-ai.md` (새) | 기록 |

## 자료 꼴 (모든 작업 공통)

칸 경로(path)는 점 경로다: `'rounds.0.inquiry'`, `'summary.overall'`. 화면의 `grpGet`/`grpSetPath` 와 같은 꼴이다.

`fieldsFor(formKey, fileKeys?)` → `{ rounds:['inquiry',…], summary:['inquiryDiag',…] }`
- `cci-north`: 회차 다섯 칸 모두 / 종합 `inquiryDiag·review·action·etc`
- `cci-seosan`: visit = 회차 `inquiry·diagnosis·advice` / report = 종합 `inquiryDiag·adviceAll`
- `techguard`: 회차 `diagnosis·advice·result·next` / 종합 `adviceAll·overall`

`buildRequest(report, feed, formKey, opts)` 의 `opts`
```js
{ techguard: false,          // true 면 회차 날짜·메모만
  src: { 'summary.review': 'ai' },   // 전에 AI 가 쓴 칸(_grp.aiSrc)
  memos: ['취업규칙 개정 요청', ''], // report.rounds 와 같은 차례의 일정 메모
  names: [{ v: '가나상사', as: '[해당 기업]' }],   // 덧붙일 이름(보고서 company 의 이름·대표자·담당자는 저절로 들어간다)
  limits: { inquiry: 200 },  // 칸별 글자 수 한도 덮어쓰기
  fileKeys: undefined }      // 그 양식 파일 전부
```
돌려주는 것: `{ system, messages:[{role:'user',content}], sent /* = content(가린 글) */, back:[{as,v}], fields, want:[path…], limits }`

`parseDraft(text, back?)` → `{ rounds:[{ i, inquiry?, … }], summary:{ overall?, … } }`. 못 읽으면 `e.parse === true` 인 `Error('AI 답을 읽지 못했습니다 — …')` 를 던진다.

`applyDraft(report, src, draft, fields?)` → `{ report /* 새 객체 */, src /* 새 객체 */, undo:{ prev:{path:옛값}, prevSrc:{path:옛표시|null}, put:{path:넣은값} }, filled:[path…] }`

`undoDraft(report, src, undo)` → `{ report, src, restored:[path…], kept:[path… /* 그 뒤 사람이 고친 칸 */] }`

`checkDraft(draft, sentText, limits?)` → `{ path: ['확인 필요 — …', …] }`

---

### Task 1: `js/pu-gov-report-ai.js` — 칸 목록 + 가리기

**Files:** Create `js/pu-gov-report-ai.js` · Test `tests/gov-report-ai.test.js`

**Interfaces:**
- Consumes: `require('./pu-gov-report.js')` (Node) / `window.PuGovReport` (브라우저) — Task 2 가 `FORMS[formKey].name` 을 읽는다.
- Produces:
  - `PuGovReportAi.fieldsFor(formKey, fileKeys?) → {rounds:string[], summary:string[]}` (차례는 `ROUND_KEYS`·`SUMMARY_KEYS` 차례)
  - `PuGovReportAi.mask(text, names:[{v,as}]) → {text, back:[{as,v}]}` — `back` 은 `as` 마다 첫 이름 하나, 입력 차례
  - `PuGovReportAi.unmask(text, back) → string`
  - 상수: `ROUND_KEYS`, `SUMMARY_KEYS`, `USES`, `LIMITS`, `GARIM`(`'[가림]'`), `NO_RECORD`(`'기록 없음 — 입력 필요'`)

- [ ] **Step 1: 실패하는 검사 작성** — `tests/gov-report-ai.test.js` (새)

```js
'use strict';
/* 정부컨설팅 보고서 3단계 — AI 초안 모듈 (2026-10-10)
 * ★ 지키는 것: 양식이 쓰는 칸만 · 밖으로 나가는 글은 가린다 · 사람이 쓴 칸은 덮지 않는다 · 지어낸 숫자는 경고
 * 공개 저장소다 — 합성 자료만(가나상사·홍길동·김가나·041-000-0000·example.com). */
const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../js/pu-gov-report-ai.js');
const R = require('../js/pu-gov-report.js');

const RK = ['inquiry', 'diagnosis', 'advice', 'result', 'next'];
const SK = ['inquiryDiag', 'review', 'action', 'etc', 'adviceAll', 'overall'];

test('fieldsFor — 양식(파일)이 쓰는 칸만', () => {
  assert.deepEqual(A.fieldsFor('cci-north'), { rounds: RK, summary: ['inquiryDiag', 'review', 'action', 'etc'] });
  assert.deepEqual(A.fieldsFor('cci-seosan', ['visit']), { rounds: ['inquiry', 'diagnosis', 'advice'], summary: [] });
  assert.deepEqual(A.fieldsFor('cci-seosan', ['report']), { rounds: [], summary: ['inquiryDiag', 'adviceAll'] });
  assert.deepEqual(A.fieldsFor('cci-seosan'), { rounds: ['inquiry', 'diagnosis', 'advice'], summary: ['inquiryDiag', 'adviceAll'] });
  assert.deepEqual(A.fieldsFor('techguard'), { rounds: ['diagnosis', 'advice', 'result', 'next'], summary: ['adviceAll', 'overall'] });
  assert.deepEqual(A.fieldsFor('모르는양식'), { rounds: [], summary: [] });
});

test('fieldsFor — pu-gov-report buildValues 가 실제로 쓰는 칸과 같다(지도 대조)', () => {
  for (const fk of Object.keys(R.FORMS)) {
    const report = { company: {}, rounds: [{ date: '2025-09-04' }], summary: {} };
    RK.forEach((k) => { report.rounds[0][k] = 'R_' + k; });
    SK.forEach((k) => { report.summary[k] = 'S_' + k; });
    const out = JSON.stringify(R.buildValues(report, fk));
    const f = A.fieldsFor(fk);
    RK.forEach((k) => assert.equal(out.includes('R_' + k), f.rounds.includes(k), fk + ' 회차 ' + k));
    SK.forEach((k) => assert.equal(out.includes('S_' + k), f.summary.includes(k), fk + ' 종합 ' + k));
  }
});

test('mask — 개인정보 꼴은 [가림], 이름은 자리 표시로, unmask 는 이름만 되돌린다', () => {
  const names = [{ v: '(주)가나상사', as: '[해당 기업]' }, { v: '김가나', as: '[대표자]' }, { v: '홍길동', as: '[담당자]' }];
  const raw = '가나상사 홍길동 대리(041-000-0000, 010-0000-0000, 02-000-0000, 1588-0000, hong@example.com)'
    + ' · 사업자 123-45-67890 · 주민 900101-1234567 · 계좌 123-456789-01-234 · 김가나 대표 · 2025-09-04 3회 · 12명';
  const m = A.mask(raw, names);
  for (const bad of ['가나상사', '홍길동', '김가나', '041-000-0000', '010-0000-0000', '02-000-0000', '1588-0000',
    'hong@example.com', '123-45-67890', '900101-1234567', '123-456789-01-234']) {
    assert.ok(!m.text.includes(bad), bad + ' 이(가) 남았다: ' + m.text);
  }
  assert.match(m.text, /\[해당 기업\] \[담당자\] 대리/);
  assert.ok(m.text.includes('2025-09-04 3회 · 12명'), '날짜·작은 숫자는 남긴다');
  assert.deepEqual(m.back, [{ as: '[해당 기업]', v: '(주)가나상사' }, { as: '[대표자]', v: '김가나' }, { as: '[담당자]', v: '홍길동' }]);
  assert.equal(A.unmask('[해당 기업] [대표자] [담당자] [가림]', m.back), '(주)가나상사 김가나 홍길동 [가림]');
});

test('mask — 빈 이름·한 글자 이름은 건너뛴다(엉뚱한 글자를 지우지 않는다)', () => {
  const m = A.mask('가 나 다 홍길동', [{ v: '', as: '[담당자]' }, { v: '가', as: '[대표자]' }, { v: '홍길동', as: '[담당자]' }]);
  assert.equal(m.text, '가 나 다 [담당자]');
  assert.deepEqual(m.back, [{ as: '[담당자]', v: '홍길동' }]);
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test tests/gov-report-ai.test.js`
Expected: FAIL — `Cannot find module '../js/pu-gov-report-ai.js'`

- [ ] **Step 3: 구현** — `js/pu-gov-report-ai.js` (새)

```js
'use strict';
/* 정부컨설팅 보고서 3단계 — AI 초안 (브라우저 window.PuGovReportAi / Node 겸용)
   (대표 「추천대로」 2026-10-10 · 설계 docs/superpowers/specs/2026-10-10-gov-report-step3-ai-draft-design.md
    · 계획 docs/superpowers/plans/2026-10-10-gov-report-step3-ai-draft.md)
   무엇을 지키나
     · 밖(Anthropic)으로 나가는 글은 모두 가린다 — 주민·전화·메일·계좌·사업자번호는 [가림](되돌리지 않는다),
       업체·대표자·담당자 이름은 대괄호 자리 표시([해당 기업]·[대표자]·[담당자])로 바꾸고 받은 글에서 되돌린다.
       (맨 낱말 「대표자」로 바꾸면 되돌릴 때 보통 글의 「대표자」까지 사람 이름이 된다 — 그래서 대괄호)
     · 양식이 쓰지 않는 칸은 보내지도 받지도 않는다(USES — pu-gov-report.js buildValues 와 검사가 대조한다).
     · 사람이 쓴 칸은 덮지 않는다 — 비었거나 전에 AI 가 넣고 사람이 손대지 않은 칸만.
   ⚠ 저장소는 공개다 — 검사는 합성 자료만 쓴다. */
(function (root) {
  /* Task 2 의 buildRequest 가 양식 이름(FORMS[formKey].name)을 읽는다 */
  var G = (typeof module !== 'undefined' && module.exports) ? require('./pu-gov-report.js') : root.PuGovReport;

  var GARIM = '[가림]';
  var NO_RECORD = '기록 없음 — 입력 필요';
  var ROUND_KEYS = ['inquiry', 'diagnosis', 'advice', 'result', 'next'];
  var SUMMARY_KEYS = ['inquiryDiag', 'review', 'action', 'etc', 'adviceAll', 'overall'];
  /* 양식 파일마다 쓰는 칸 — buildValues 가 실제로 찍는 칸 */
  var USES = {
    'cci-north': { main: { rounds: ROUND_KEYS, summary: ['inquiryDiag', 'review', 'action', 'etc'] } },
    'cci-seosan': {
      visit: { rounds: ['inquiry', 'diagnosis', 'advice'], summary: [] },
      report: { rounds: [], summary: ['inquiryDiag', 'adviceAll'] },
    },
    techguard: { main: { rounds: ['diagnosis', 'advice', 'result', 'next'], summary: ['adviceAll', 'overall'] } },
  };
  /* 칸별 글자 수 한도 — 기관 공식 한도가 아니라 양식 칸 크기에 맞춘 출발값(노무사 확인 필요) */
  var LIMITS = { inquiry: 300, diagnosis: 300, advice: 300, result: 300, next: 300,
    inquiryDiag: 600, review: 600, action: 600, etc: 300, adviceAll: 1000, overall: 600 };

  function str(v) { return v == null ? '' : String(v).trim(); }

  function fieldsFor(formKey, fileKeys) {
    var u = USES[formKey];
    if (!u) return { rounds: [], summary: [] };
    var ks = (fileKeys && fileKeys.length) ? fileKeys : Object.keys(u), r = {}, s = {};
    ks.forEach(function (k) {
      var f = u[k]; if (!f) return;
      f.rounds.forEach(function (x) { r[x] = 1; });
      f.summary.forEach(function (x) { s[x] = 1; });
    });
    return { rounds: ROUND_KEYS.filter(function (x) { return r[x]; }), summary: SUMMARY_KEYS.filter(function (x) { return s[x]; }) };
  }

  /* 가리기 — 차례가 중요하다: 메일(숫자를 품을 수 있다) → 주민 → 사업자 → 전화 → 대표번호 → 긴 숫자열(계좌) */
  var EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
  var RRN_RE = /(?<!\d)\d{6}\s?-\s?[1-8]\d{6}(?!\d)/g;
  var BIZ_RE = /(?<!\d)\d{3}-\d{2}-\d{5}(?!\d)/g;
  var TEL_RE = /(?<!\d)(?:\+82[-.\s]?)?\(?0\d{1,2}\)?[-.\s]?\d{3,4}[-.\s]\d{4}(?!\d)/g;
  var REP_RE = /(?<!\d)1[5-9]\d{2}-\d{4}(?!\d)/g;
  var LONG_RE = /\d[\d-]{8,}\d/g;          // 숫자가 10개 이상일 때만 가린다(날짜 2025-09-04 는 8개라 남는다)

  /* 이름 목록 — 2자 미만은 버린다. 「(주)가나상사」면 「가나상사」도 같은 자리 표시로 */
  function nameList(names) {
    var out = [];
    (names || []).forEach(function (n) {
      var v = str(n && n.v), as = str(n && n.as);
      if (v.length < 2 || !as) return;
      out.push({ v: v, as: as, orig: v });
      var core = v.replace(/\(주\)|㈜|주식회사|\(유\)|유한회사|\(합\)|합자회사/g, '').trim();
      if (core !== v && core.length >= 2) out.push({ v: core, as: as, orig: v });
    });
    return out;
  }
  function mask(text, names) {
    var t = String(text == null ? '' : text)
      .replace(EMAIL_RE, GARIM).replace(RRN_RE, GARIM).replace(BIZ_RE, GARIM)
      .replace(TEL_RE, GARIM).replace(REP_RE, GARIM)
      .replace(LONG_RE, function (m) { return m.replace(/\D/g, '').length >= 10 ? GARIM : m; });
    var list = nameList(names), back = [], seenAs = {};
    list.forEach(function (n) { if (!seenAs[n.as]) { seenAs[n.as] = 1; back.push({ as: n.as, v: n.orig }); } });
    /* 긴 이름부터 — 「(주)가나상사」를 「가나상사」보다 먼저 */
    list.slice().sort(function (a, b) { return b.v.length - a.v.length; })
      .forEach(function (n) { t = t.split(n.v).join(n.as); });
    return { text: t, back: back };
  }
  function unmask(text, back) {
    var t = String(text == null ? '' : text);
    (back || []).forEach(function (b) { if (b && b.as) t = t.split(b.as).join(String(b.v == null ? '' : b.v)); });
    return t;
  }

  var api = { fieldsFor: fieldsFor, mask: mask, unmask: unmask,
    ROUND_KEYS: ROUND_KEYS, SUMMARY_KEYS: SUMMARY_KEYS, USES: USES, LIMITS: LIMITS, GARIM: GARIM, NO_RECORD: NO_RECORD };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PuGovReportAi = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
```

- [ ] **Step 4: 통과 확인**

Run: `node --test tests/gov-report-ai.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: 커밋** (PowerShell)

```powershell
git add js/pu-gov-report-ai.js tests/gov-report-ai.test.js
git commit -m @'
feat(gov-report): AI 초안 모듈 — 양식 칸 목록·가림·이름 자리 표시

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
'@
```

---

### Task 2: `buildRequest` + `parseDraft` — 보낼 글 만들기 · 받은 글 읽기

**Files:** Modify `js/pu-gov-report-ai.js` · Test `tests/gov-report-ai.test.js` (더함)

**Interfaces:**
- Consumes: Task 1 의 `fieldsFor`, `mask`, `unmask`, `LIMITS`, `GARIM`, `NO_RECORD`, `G.FORMS`; build 의 feed 꼴 `{d, kind:'일정'|'받은 메일'|'보낸 메일'|'보낸 서류', text, att, priv, body?}`
- Produces:
  - `PuGovReportAi.buildRequest(report, feed, formKey, opts) → {system, messages, sent, back, fields, want, limits}` (위 「자료 꼴」)
  - `PuGovReportAi.parseDraft(text, back?) → {rounds, summary}` — 못 읽으면 `e.parse===true` 오류
  - 상수 `BODY_MAX`(1500), `GUIDE`, `COMMON_GUIDE`

- [ ] **Step 1: 실패하는 검사 더하기** — `tests/gov-report-ai.test.js` 끝에

```js
const rep = () => ({
  company: { name: '가나상사', ceo: '김가나', contact: '홍길동' },
  rounds: [
    { date: '2025-09-04', visit: true, inquiry: '', diagnosis: '', advice: '취업규칙 개정 요청 — 홍길동 대리 041-000-0000', result: '', next: '' },
    { date: '2025-10-02', visit: false, inquiry: '', diagnosis: '', advice: '', result: '', next: '' },
  ],
  summary: { inquiryDiag: '', review: '사람이 쓴 검토', action: '', etc: '', adviceAll: '', overall: '', outputs: [] },
});
const feed = () => [
  { d: '2025-09-02', kind: '받은 메일', text: '가나상사 취업규칙 검토 요청(hong@example.com)', att: [], priv: false, body: 'x'.repeat(2000) },
  { d: '2025-09-04', kind: '일정', text: '1회 · 방문 · 취업규칙 개정 요청', att: [], priv: false },
  { d: '2025-09-20', kind: '받은 메일', text: '9월 급여', att: [], priv: true },
  { d: '2025-10-02', kind: '보낸 서류', text: '임금체계 검토 의견서.hwp', att: [], priv: false },
];

test('buildRequest — 보내는 글 전부 가림·이름 바꾸기, 개인 자료·일정 줄은 빼고, 본문은 1,500자까지', () => {
  const q = A.buildRequest(rep(), feed(), 'cci-north',
    { memos: ['취업규칙 개정 요청', ''], names: [{ v: '가나상사', as: '[해당 기업]' }] });
  const all = q.system + '\n' + q.messages.map((m) => m.content).join('\n');
  for (const bad of ['가나상사', '김가나', '홍길동', '041-000-0000', 'hong@example.com', '9월 급여']) {
    assert.ok(!all.includes(bad), bad + ' 이(가) 나간다');
  }
  assert.equal(q.messages.length, 1);
  assert.equal(q.messages[0].role, 'user');
  assert.equal(q.sent, q.messages[0].content);
  assert.ok(all.includes('임금체계 검토 의견서'), '보낸 서류 이름은 보낸다');
  assert.ok(all.includes('x'.repeat(1500)) && !all.includes('x'.repeat(1501)), '본문은 1,500자까지');
  assert.deepEqual(q.back.find((b) => b.as === '[담당자]'), { as: '[담당자]', v: '홍길동' });
  const body = JSON.parse(q.sent);
  assert.equal(body.회차[0].메모, '취업규칙 개정 요청');
  assert.equal(body.회차[0].방식, '방문');
  assert.equal(body.자료.length, 2, '받은 메일 1 + 보낸 서류 1 (priv·일정 제외)');
});

test('buildRequest — 채울 칸은 비었거나 AI 가 쓴 칸만, 사람이 쓴 칸은 맥락으로만', () => {
  const q = A.buildRequest(rep(), feed(), 'cci-north', { src: { 'summary.review': 'ai' } });
  assert.ok(q.want.includes('rounds.0.inquiry'));
  assert.ok(!q.want.includes('rounds.0.advice'), '메모가 든 자문은 사람이 쓴 칸');
  assert.ok(q.want.includes('summary.review'), '전에 AI 가 쓴 칸');
  assert.ok(!q.want.includes('summary.adviceAll'), '충남북부는 adviceAll 을 안 쓴다');
  const q2 = A.buildRequest(rep(), feed(), 'cci-north', {});
  assert.ok(!q2.want.includes('summary.review'));
  assert.equal(JSON.parse(q2.sent).이미_쓴_종합.review, '사람이 쓴 검토');
  assert.ok(JSON.parse(q2.sent).채울_칸.includes('rounds.1.next'));
});

test('buildRequest — 기술보호는 회차 날짜·메모만(메일·서류·이미 쓴 칸·방식 없음)', () => {
  const q = A.buildRequest(rep(), feed(), 'techguard', { techguard: true, memos: ['취업규칙 개정 요청', ''] });
  const body = JSON.parse(q.sent);
  assert.deepEqual(body.자료, []);
  assert.deepEqual(Object.keys(body.회차[0]).sort(), ['i', '날짜', '메모'].sort());
  assert.ok(!('이미_쓴_종합' in body));
  assert.ok(!q.sent.includes('의견서') && !q.sent.includes('취업규칙 검토 요청'));
  assert.ok(q.sent.includes('2025-09-04') && q.sent.includes('취업규칙 개정 요청'));
});

test('buildRequest — system: 지어내지 말 것·기록 없음 문구·칸별 한도·JSON 만', () => {
  const q = A.buildRequest(rep(), feed(), 'cci-north', {});
  assert.match(q.system, /만들지 않는다/);
  assert.ok(q.system.includes('기록 없음 — 입력 필요'));
  assert.match(q.system, /inquiry=문의 300자/);
  assert.match(q.system, /review=검토사항\(기존\) 600자/);
  assert.ok(!/adviceAll/.test(q.system), '안 쓰는 칸은 묻지 않는다');
  assert.match(q.system, /JSON 만/);
  assert.equal(q.limits.inquiry, 300);
  const q2 = A.buildRequest(rep(), feed(), 'cci-north', { limits: { inquiry: 120 } });
  assert.match(q2.system, /inquiry=문의 120자/);
  assert.match(A.buildRequest(rep(), feed(), 'techguard', { techguard: true }).system, /diagnosis=문제점/);
});

test('parseDraft — 앞뒤 군말을 잘라 읽고, 이름을 되돌리고, 모르는 칸·틀린 회차 번호는 버린다', () => {
  const back = [{ as: '[해당 기업]', v: '가나상사' }];
  const raw = '좋습니다.\n```json\n{"rounds":[{"i":0,"inquiry":"[해당 기업] 문의\\r\\n둘째 줄","bogus":"x"},'
    + '{"i":"a","inquiry":"버림"},{"i":-1,"inquiry":"버림"},{"i":1.5,"inquiry":"버림"}],'
    + '"summary":{"overall":" 총평 ","__proto__":{"x":1},"zzz":"버림","etc":3}}\n```';
  const d = A.parseDraft(raw, back);
  assert.deepEqual(d, { rounds: [{ i: 0, inquiry: '가나상사 문의\n둘째 줄' }], summary: { overall: '총평' } });
});

test('parseDraft — 못 읽으면 parse 표시가 있는 오류', () => {
  for (const t of ['', '답할 수 없습니다', '{"rounds": [', '[1,2]', '{"rounds":[],"summary":{}}']) {
    assert.throws(() => A.parseDraft(t), (e) => e.parse === true && /AI 답을 읽지 못했습니다/.test(e.message), JSON.stringify(t));
  }
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test tests/gov-report-ai.test.js`
Expected: FAIL — `A.buildRequest is not a function`

- [ ] **Step 3: 구현** — `js/pu-gov-report-ai.js` 의 `unmask` 함수 바로 아래(`var api = …` 위)에 더한다

```js
  var BODY_MAX = 1500;
  var LABEL = { inquiry: '문의', diagnosis: '진단', advice: '자문', result: '성과', next: '향후',
    inquiryDiag: '문의·진단 종합', review: '검토사항(기존)', action: '조치결과', etc: '기타사항',
    adviceAll: '자문 결과', overall: '총평' };
  var LABEL_FORM = {
    'cci-seosan': { inquiryDiag: '요청 진단', adviceAll: '자문 결과' },
    techguard: { diagnosis: '문제점', adviceAll: '자문 내용' },
  };
  function labelsFor(formKey) {
    var o = {}, x = LABEL_FORM[formKey] || {};
    Object.keys(LABEL).forEach(function (k) { o[k] = x[k] || LABEL[k]; });
    return o;
  }
  /* 기관 작성기준 — FORMS 에는 기준 문구가 없다. 기관 원문 대조 전의 출발 문구(노무사 확인 필요) */
  var COMMON_GUIDE = '회차마다 상담 요청(문의)·현황 진단·자문 내용·성과·향후 계획을 사실 위주로 1~3문장씩 쓴다. '
    + '보고서 문체(~함, ~임)로 쓰고, 법 조문은 입력에 나온 것만 쓴다.';
  var GUIDE = {
    'cci-north': '충남북부상공회의소 인사노무 컨설팅 결과보고서. 회차별 수행내역은 문의·진단·자문·성과·향후가 한 칸에 이어 들어간다. '
      + '문의·진단 종합은 기업의 요청과 진단 결과를 묶고, 결과종합은 검토사항(기존 제도)과 조치결과를 나눠 쓴다. 기타사항이 없으면 「없음」.',
    'cci-seosan': '서산상공회의소 인사노무 경영컨설팅. 업체 방문 확인서는 회차마다 문의·진단·자문을 쓰고, '
      + '상담 및 자문 결과 보고서는 요청 진단과 자문 결과를 전체 회차를 묶어 쓴다.',
    techguard: '통합 기술보호지원반 법률 자문 완료보고서(별지 11). 회차별 법률 자문 일지에 문제점·자문·성과·향후를 쓰고, '
      + '종합에 자문 내용과 총평을 쓴다. 기술 자료의 내용은 쓰지 않는다.',
  };
  function systemText(formKey, fields, lim) {
    var lab = labelsFor(formKey);
    var one = function (k) { return k + '=' + lab[k] + ' ' + lim[k] + '자'; };
    var r0 = fields.rounds[0] || 'inquiry', s0 = fields.summary[0] || 'overall';
    return [
      '당신은 공인노무사가 쓰는 정부 지원 인사노무 컨설팅 보고서의 초안을 쓴다. 노무사가 읽고 고친 뒤 확정한다.',
      '작성기준: ' + (GUIDE[formKey] ? GUIDE[formKey] + ' ' : '') + COMMON_GUIDE,
      '규칙',
      '- 입력에 없는 사실·날짜·숫자·법 조문 번호를 만들지 않는다. 모르면 쓰지 않는다.',
      '- 메모도 자료도 없는 회차의 칸에는 정확히 「' + NO_RECORD + '」 만 쓴다.',
      '- [해당 기업] [대표자] [담당자] 같은 대괄호 표시는 그대로 옮겨 쓴다. ' + GARIM + ' 의 원래 값을 짐작하지 않는다.',
      '- 입력의 「채울_칸」에 있는 칸만 쓴다. 「이미_쓴_칸」·「이미_쓴_종합」은 맥락으로만 읽는다.',
      '- 칸 이름과 글자 수 한도 — 회차: ' + (fields.rounds.map(one).join(', ') || '없음')
        + ' / 종합: ' + (fields.summary.map(one).join(', ') || '없음'),
      '- JSON 만 답한다. 앞뒤에 다른 글을 붙이지 않는다. 꼴: {"rounds":[{"i":0,"' + r0 + '":"…"}],"summary":{"' + s0 + '":"…"}}'
        + ' — i 는 입력 회차의 i 그대로.',
    ].join('\n');
  }
  function baseNames(report) {
    var c = (report && report.company) || {};
    return [{ v: c.name, as: '[해당 기업]' }, { v: c.ceo, as: '[대표자]' }, { v: c.contact, as: '[담당자]' }];
  }

  /* 보낼 글 — 입력을 JSON 으로 묶은 뒤 «통째로» 가린다(빠지는 글이 없게) */
  function buildRequest(report, feed, formKey, opts) {
    opts = opts || {};
    var form = (G && G.FORMS && G.FORMS[formKey]) || {};
    var fields = fieldsFor(formKey, opts.fileKeys);
    var lim = {};
    Object.keys(LIMITS).forEach(function (k) { lim[k] = LIMITS[k]; });
    Object.keys(opts.limits || {}).forEach(function (k) { if (+opts.limits[k] > 0) lim[k] = +opts.limits[k]; });
    var src = opts.src || {}, tg = !!opts.techguard, memos = opts.memos || [], want = [];
    var rs = (report && Array.isArray(report.rounds)) ? report.rounds : [], sm = (report && report.summary) || {};
    var rounds = rs.map(function (r, i) {
      r = r || {};
      var o = { i: i, 날짜: str(r.date) };
      if (!tg) o.방식 = r.visit === true ? '방문' : r.visit === false ? '사무' : '모름';
      o.메모 = str(memos[i]);
      var had = {};
      fields.rounds.forEach(function (k) {
        var v = str(r[k]), p = 'rounds.' + i + '.' + k;
        if (!v || src[p] === 'ai') want.push(p);
        else if (!tg) had[k] = v;
      });
      if (!tg && Object.keys(had).length) o.이미_쓴_칸 = had;
      return o;
    });
    var hadS = {};
    fields.summary.forEach(function (k) {
      var v = str(sm[k]), p = 'summary.' + k;
      if (!v || src[p] === 'ai') want.push(p);
      else if (!tg) hadS[k] = v;
    });
    var data = [];
    if (!tg) (feed || []).forEach(function (x) {
      if (!x || x.priv || x.kind === '일정') return;          // 일정은 회차 메모로 이미 간다
      var o = { 날짜: str(x.d), 종류: str(x.kind) };
      if (x.kind === '보낸 서류') o.서류 = str(x.text);
      else {
        o.제목 = str(x.text);
        if (str(x.body)) o.본문 = str(x.body).slice(0, BODY_MAX);
      }
      data.push(o);
    });
    var input = { 양식: str(form.name), 회차: rounds, 자료: data };
    if (!tg && Object.keys(hadS).length) input.이미_쓴_종합 = hadS;
    input.채울_칸 = want;
    var m = mask(JSON.stringify(input, null, 1), baseNames(report).concat(opts.names || []));
    return { system: systemText(formKey, fields, lim), messages: [{ role: 'user', content: m.text }],
      sent: m.text, back: m.back, fields: fields, want: want, limits: lim };
  }

  /* 받은 글 — 첫 { ~ 마지막 } 를 JSON 으로. 아는 칸의 글자만 옮긴다(모르는 열쇠·__proto__ 는 버린다) */
  function parseDraft(text, back) {
    var bad = function (why) { var e = new Error('AI 답을 읽지 못했습니다 — ' + why); e.parse = true; return e; };
    var s = String(text == null ? '' : text), a = s.indexOf('{'), b = s.lastIndexOf('}');
    if (a < 0 || b < a) throw bad('JSON 이 없습니다');
    var o;
    try { o = JSON.parse(s.slice(a, b + 1)); } catch (e) { throw bad('JSON 이 깨졌습니다'); }
    if (!o || typeof o !== 'object' || Array.isArray(o)) throw bad('꼴이 다릅니다');
    var un = function (v) {
      if (typeof v !== 'string') return '';
      v = v.replace(/\r\n?/g, '\n').trim();
      return back ? unmask(v, back) : v;
    };
    var rounds = [];
    (Array.isArray(o.rounds) ? o.rounds : []).forEach(function (r) {
      if (!r || typeof r !== 'object') return;
      var i = Number(r.i);
      if (!Number.isInteger(i) || i < 0 || typeof r.i === 'string' && !/^\d+$/.test(r.i)) return;
      var x = { i: i };
      ROUND_KEYS.forEach(function (k) { var v = un(r[k]); if (v) x[k] = v; });
      rounds.push(x);
    });
    var so = (o.summary && typeof o.summary === 'object' && !Array.isArray(o.summary)) ? o.summary : {}, summary = {};
    SUMMARY_KEYS.forEach(function (k) { var v = un(so[k]); if (v) summary[k] = v; });
    rounds = rounds.filter(function (x) { return Object.keys(x).length > 1; });
    if (!rounds.length && !Object.keys(summary).length) throw bad('채운 칸이 없습니다');
    return { rounds: rounds, summary: summary };
  }
```

그리고 `var api = …` 줄을 다음으로 바꾼다.

```js
  var api = { fieldsFor: fieldsFor, mask: mask, unmask: unmask, buildRequest: buildRequest, parseDraft: parseDraft,
    ROUND_KEYS: ROUND_KEYS, SUMMARY_KEYS: SUMMARY_KEYS, USES: USES, LIMITS: LIMITS, GARIM: GARIM, NO_RECORD: NO_RECORD,
    BODY_MAX: BODY_MAX, GUIDE: GUIDE, COMMON_GUIDE: COMMON_GUIDE };
```

- [ ] **Step 4: 통과 확인**

Run: `node --test tests/gov-report-ai.test.js`
Expected: PASS (10 tests)

- [ ] **Step 5: 커밋** (PowerShell)

```powershell
git add js/pu-gov-report-ai.js tests/gov-report-ai.test.js
git commit -m @'
feat(gov-report): AI 초안 요청 만들기·답 읽기 — 가린 입력·작성기준·JSON 만

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
'@
```

---

### Task 3: `applyDraft` · `undoDraft` · `checkDraft` — 칸에 넣기 · 되돌리기 · 점검

**Files:** Modify `js/pu-gov-report-ai.js` · Test `tests/gov-report-ai.test.js` (더함)

**Interfaces:**
- Consumes: Task 1·2 의 `ROUND_KEYS`, `SUMMARY_KEYS`, `LIMITS`, `GARIM`, `NO_RECORD`, `parseDraft` 결과 꼴
- Produces:
  - `applyDraft(report, src, draft, fields?) → {report, src, undo:{prev, prevSrc, put}, filled}` — 받은 report·src 는 고치지 않는다(새 객체)
  - `undoDraft(report, src, undo) → {report, src, restored, kept}` — 지금 값이 `undo.put` 과 같은 칸만 되돌린다
  - `checkDraft(draft, sentText, limits?) → {path:[경고…]}`

- [ ] **Step 1: 실패하는 검사 더하기** — `tests/gov-report-ai.test.js` 끝에

```js
test('applyDraft — 빈 칸과 AI 칸만 채우고, 사람이 쓴 칸·양식 밖 칸·없는 회차는 건드리지 않는다', () => {
  const r = rep();
  r.summary.action = '전에 AI 가 쓴 조치';
  const src = { 'summary.action': 'ai' };
  const draft = {
    rounds: [{ i: 0, inquiry: '문의 초안', advice: '덮으면 안 됨' }, { i: 5, inquiry: '없는 회차' }],
    summary: { review: '덮으면 안 됨', action: '새 조치', etc: '없음', overall: '양식이 안 씀' },
  };
  const res = A.applyDraft(r, src, draft, A.fieldsFor('cci-north'));
  assert.equal(res.report.rounds[0].inquiry, '문의 초안');
  assert.equal(res.report.rounds[0].advice, rep().rounds[0].advice);
  assert.equal(res.report.summary.review, '사람이 쓴 검토');
  assert.equal(res.report.summary.action, '새 조치');
  assert.equal(res.report.summary.etc, '없음');
  assert.equal(res.report.summary.overall, '');
  assert.equal(res.report.rounds.length, 2);
  assert.deepEqual(res.filled.slice().sort(), ['rounds.0.inquiry', 'summary.action', 'summary.etc']);
  assert.equal(res.src['rounds.0.inquiry'], 'ai');
  assert.equal(r.rounds[0].inquiry, '', '받은 report 는 그대로(새 객체를 돌려준다)');
  assert.equal(src['rounds.0.inquiry'], undefined, '받은 src 도 그대로');
  assert.equal(res.undo.prev['summary.action'], '전에 AI 가 쓴 조치');
  assert.equal(res.undo.prevSrc['summary.etc'], null);
  assert.equal(res.undo.put['summary.etc'], '없음');
});

test('undoDraft — 직전 넣기를 되돌리되, 그 뒤 사람이 고친 칸은 그대로', () => {
  const a = A.applyDraft(rep(), {}, { rounds: [{ i: 1, inquiry: 'AI 문의', next: 'AI 향후' }], summary: { etc: 'AI 기타' } },
    A.fieldsFor('cci-north'));
  a.report.rounds[1].next = '사람이 고친 향후';
  const u = A.undoDraft(a.report, a.src, a.undo);
  assert.equal(u.report.rounds[1].inquiry, '');
  assert.equal(u.report.summary.etc, '');
  assert.equal(u.report.rounds[1].next, '사람이 고친 향후');
  assert.deepEqual(u.restored.slice().sort(), ['rounds.1.inquiry', 'summary.etc']);
  assert.deepEqual(u.kept, ['rounds.1.next']);
  assert.ok(!('rounds.1.inquiry' in u.src));
  assert.equal(a.report.rounds[1].inquiry, 'AI 문의', '받은 report 는 그대로');
});

test('checkDraft — 입력에 없던 날짜·숫자, 한도 초과, [가림] 남음, 기록 없음', () => {
  const sent = '{"회차":[{"i":0,"날짜":"2025-09-04","메모":"직원 12명 취업규칙 1,000,000원"}]}';
  const d = {
    rounds: [{ i: 0, inquiry: '2025년 9월 4일 직원 12명 문의(1,000,000원)', result: '2026년 3월 시행 예정', next: '기록 없음 — 입력 필요' }],
    summary: { etc: 'x'.repeat(301), overall: '[가림] 으로 연락 요망' },
  };
  const w = A.checkDraft(d, sent, {});
  assert.equal(w['rounds.0.inquiry'], undefined);
  assert.match(w['rounds.0.result'].join(' '), /확인 필요 — 입력에 없던 날짜·숫자: 2026, 3/);
  assert.match(w['rounds.0.next'].join(' '), /직접 입력 필요/);
  assert.match(w['summary.etc'].join(' '), /301자 — 한도 300자 초과/);
  assert.match(w['summary.overall'].join(' '), /\[가림\] 이 남았습니다/);
  assert.equal(A.checkDraft({ rounds: [], summary: { etc: 'x'.repeat(301) } }, sent, { etc: 400 })['summary.etc'], undefined);
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test tests/gov-report-ai.test.js`
Expected: FAIL — `A.applyDraft is not a function`

- [ ] **Step 3: 구현** — `parseDraft` 아래(`var api = …` 위)에 더한다

```js
  /* 칸에 넣기 — 비었거나 src[path]==='ai'(전에 AI 가 넣고 사람이 안 고친) 칸만 */
  function applyDraft(report, src, draft, fields) {
    var rep = JSON.parse(JSON.stringify(report || {}));
    var s = {};
    Object.keys(src || {}).forEach(function (k) { s[k] = src[k]; });
    var f = fields || { rounds: ROUND_KEYS, summary: SUMMARY_KEYS };
    var undo = { prev: {}, prevSrc: {}, put: {} }, filled = [];
    function put(obj, key, path, v) {
      var cur = obj[key] == null ? '' : String(obj[key]);
      if (str(cur) && s[path] !== 'ai') return;          // 사람이 쓴 칸 — 덮지 않는다
      if (cur === v) return;
      undo.prev[path] = cur; undo.prevSrc[path] = s[path] == null ? null : s[path]; undo.put[path] = v;
      obj[key] = v; s[path] = 'ai'; filled.push(path);
    }
    if (!Array.isArray(rep.rounds)) rep.rounds = [];
    ((draft && draft.rounds) || []).forEach(function (r) {
      var o = rep.rounds[r && r.i];
      if (!o || typeof o !== 'object') return;            // AI 는 회차를 만들지 못한다
      f.rounds.forEach(function (k) { var v = str(r[k]); if (v) put(o, k, 'rounds.' + r.i + '.' + k, v); });
    });
    if (!rep.summary || typeof rep.summary !== 'object') rep.summary = {};
    var ds = (draft && draft.summary) || {};
    f.summary.forEach(function (k) { var v = str(ds[k]); if (v) put(rep.summary, k, 'summary.' + k, v); });
    return { report: rep, src: s, undo: undo, filled: filled };
  }

  /* 되돌리기 — 지금 값이 AI 가 넣은 그대로인 칸만 넣기 전 값으로 */
  function undoDraft(report, src, undo) {
    var rep = JSON.parse(JSON.stringify(report || {})), s = {};
    Object.keys(src || {}).forEach(function (k) { s[k] = src[k]; });
    var restored = [], kept = [], u = undo || {};
    Object.keys(u.put || {}).forEach(function (p) {
      var ks = p.split('.'), last = ks.pop();
      var obj = ks.reduce(function (o, k) { return o == null ? o : o[k]; }, rep);
      if (!obj || typeof obj !== 'object') return;
      if (String(obj[last] == null ? '' : obj[last]) !== u.put[p]) { kept.push(p); return; }
      obj[last] = u.prev[p] == null ? '' : u.prev[p];
      if (u.prevSrc[p] == null) delete s[p]; else s[p] = u.prevSrc[p];
      restored.push(p);
    });
    return { report: rep, src: s, restored: restored, kept: kept };
  }

  /* 점검(경고만) — 숫자는 쉼표를 떼고 앞 0 을 떼어 견준다. 줄머리 번호(「1. 」「2) 」)는 세지 않는다 */
  function numsOf(t) {
    var s = String(t || '').replace(/(\d),(?=\d{3}(?!\d))/g, '$1').replace(/^\s*\d{1,2}[.)]\s/gm, ' ');
    return (s.match(/\d+/g) || []).map(function (n) { return n.replace(/^0+(?=\d)/, ''); });
  }
  function checkDraft(draft, sentText, limits) {
    var lim = {}, have = {}, out = {};
    Object.keys(LIMITS).forEach(function (k) { lim[k] = LIMITS[k]; });
    Object.keys(limits || {}).forEach(function (k) { if (+limits[k] > 0) lim[k] = +limits[k]; });
    numsOf(sentText).forEach(function (n) { have[n] = 1; });
    function see(path, key, v) {
      v = str(v); if (!v) return;
      var w = [], seen = {};
      var nu = numsOf(v).filter(function (n) { if (have[n] || seen[n]) return false; seen[n] = 1; return true; });
      if (nu.length) w.push('확인 필요 — 입력에 없던 날짜·숫자: ' + nu.slice(0, 5).join(', '));
      if (lim[key] && v.length > lim[key]) w.push('글자 수 ' + v.length + '자 — 한도 ' + lim[key] + '자 초과');
      if (v.indexOf(GARIM) >= 0) w.push(GARIM + ' 이 남았습니다 — 원래 값을 직접 넣어 주세요');
      if (v === NO_RECORD) w.push('기록 없는 회차 — 직접 입력 필요');
      if (w.length) out[path] = w;
    }
    ((draft && draft.rounds) || []).forEach(function (r) {
      ROUND_KEYS.forEach(function (k) { see('rounds.' + r.i + '.' + k, k, r[k]); });
    });
    var sm = (draft && draft.summary) || {};
    SUMMARY_KEYS.forEach(function (k) { see('summary.' + k, k, sm[k]); });
    return out;
  }
```

그리고 `var api = …` 를 다음으로 바꾼다.

```js
  var api = { fieldsFor: fieldsFor, mask: mask, unmask: unmask, buildRequest: buildRequest, parseDraft: parseDraft,
    applyDraft: applyDraft, undoDraft: undoDraft, checkDraft: checkDraft,
    ROUND_KEYS: ROUND_KEYS, SUMMARY_KEYS: SUMMARY_KEYS, USES: USES, LIMITS: LIMITS, GARIM: GARIM, NO_RECORD: NO_RECORD,
    BODY_MAX: BODY_MAX, GUIDE: GUIDE, COMMON_GUIDE: COMMON_GUIDE };
```

- [ ] **Step 4: 통과 확인**

Run: `node --test tests/gov-report-ai.test.js`
Expected: PASS (13 tests)

- [ ] **Step 5: 커밋** (PowerShell)

```powershell
git add js/pu-gov-report-ai.js tests/gov-report-ai.test.js
git commit -m @'
feat(gov-report): AI 초안 칸에 넣기·되돌리기·점검 — 사람이 쓴 칸은 덮지 않는다

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
'@
```

---

### Task 4: gov-consulting.html — AI 초안 흐름(부르기·동의·기술보호·넣기·되돌리기·저장 표시)

**Files:** Modify `gov-consulting.html` (스크립트 줄 :1330 · `GRP_ACTS` :7603 · `grpSetup` :7723 · `grpRecord` :7846 · `grpDelRound` :7947 · `/* ── 그리기 ── */` :8079 바로 위에 새 묶음) · Test `tests/gov-report-ui.test.js` (고침·더함)

**Interfaces:**
- Consumes: `PuGovReportAi.buildRequest/parseDraft/applyDraft/undoDraft/checkDraft`; 기존 `_grp`, `grpReadForm`, `grpGet`, `grpRender`, `grpRenderTop`, `grpNote`, `grpAsk`, `toast`, `escAttr`, `window.PU_CFG`, `localStorage`, `fetch`
- Produces (전역)
  - 상수: `GRP_AI_MODELS`, `GRP_AI_WAIT_MS`(90000), `GRP_AI_OK`(`'gov_ai_ok'`), `GRP_AI_MSG`, `GRP_AI_PATH` — 모두 **한 줄** `const …;`(검사가 줄 단위로 떠 온다)
  - `grpAiProxyUrl() → string`
  - `grpAiConsent() → boolean`
  - `grpAiFetch(url, opts) → Promise<Response>`
  - `grpAiCall(system, messages) → Promise<string>` — 오류에 `noProxy`/`timeout` 표시
  - `grpAiNames(st) → [{v,as}]`, `grpAiMemos(st) → string[]`
  - `grpAiCan(st) → {ok, why}`
  - `grpAiDraft() → Promise<{ok, filled?, error?, cancelled?}>`
  - `grpAiUndo() → {ok, restored?, kept?}`
  - `grpAiAllow() → boolean`
  - `grpAiSync(st) → path[]` — 사람이 고쳐 AI 표시가 빠진 칸
  - `grpAiFields(st) → path[]`
  - `grpAiDropRound(st, i)`
  - `_grp` 새 자리: `aiSrc`, `aiVal`, `aiWarn`, `aiUndo`, `aiAllow`, `aiBusy`
  - 저장 기록 새 자리 `aiFields:[path…]`

- [ ] **Step 1: 실패하는 검사** — `tests/gov-report-ui.test.js`

(1) `RPT_NAMES` 에 세 이름을 더한다(`grpRecord`·`grpDelRound` 가 이제 부른다).

```js
const RPT_NAMES = ['grpRptRef', 'grpRid', 'grpYearOf', 'grpDay', 'grpShift', 'grpConsCompany', 'grpPickCons',
  'grpReadMail', 'grpReadSent', 'grpReadSaved', 'grpStaffName', 'grpCollect', 'grpHintInput', 'grpSetup',
  'grpReadForm', 'grpCanConfirm', 'grpWho', 'grpCleanReport', 'grpRecord', 'grpWriteFail', 'grpNote',
  'grpSaveDraft', 'grpConfirm', 'grpNewVersion', 'grpAddRound', 'grpDelRound', 'grpAsk', 'grpFieldsFor',
  'grpBlankList', 'grpGet', 'grpSetPath', 'grpParseRoundText', 'grpRoundText', 'grpFileName',
  'grpAiSync', 'grpAiFields', 'grpAiDropRound'];
```

(2) `rptWorld` 안 상수 정규식을 넓힌다.

```js
  const consts = (SRC.match(/^const GRP_(?:DENIED|HINT|RLAB|FILE_KO|AI_MODELS|AI_WAIT_MS|AI_OK|AI_MSG|AI_PATH)=.*;$/gm) || []).join('\n');
```

(3) 파일 끝에 더한다.

```js
/* ══ ✨ AI 초안 (3단계) ══════════════════════════════════════════════════════
 * ★ 지키는 것
 *   ① 밖으로 나가는 글(프록시로 가는 body 전부)에 업체·사람 이름·전화·메일·사업자번호가 없다.
 *   ② 사람이 쓴 칸은 덮지 않는다 — 처음부터 쓴 칸도, AI 칸을 사람이 고친 것도.
 *   ③ 기술보호는 켜기 전엔 아무것도 안 보내고, 켜도 메일·보낸 서류는 안 보낸다.
 *   ④ 확정된 판은 부르지 않는다.
 *   ⑤ 오류 문구는 설계서 §5 그대로, 칸은 그대로.
 * 가짜 프록시(fetch 바꿔치기) — 실제로 밖에 나가지 않는다. 합성 자료만. */
const Ai = require('../js/pu-gov-report-ai.js');
const AI_NAMES = ['grpAiProxyUrl', 'grpAiConsent', 'grpAiFetch', 'grpAiCall', 'grpAiNames', 'grpAiMemos', 'grpAiCan',
  'grpAiDraft', 'grpAiUndo', 'grpAiAllow'];
const aiText = (text) => ({ content: [{ type: 'text', text }] });
const aiReply = (o) => aiText(JSON.stringify(o));
const okReply = () => aiReply({
  rounds: [{ i: 0, inquiry: '[해당 기업] [담당자] 취업규칙 문의', diagnosis: '연장근로 규정 미비', advice: '덮으면 안 됨' }],
  summary: { inquiryDiag: '[해당 기업] 종합', review: '검토 초안', action: 'AI 조치', etc: '없음', overall: '양식이 안 씀' },
});
function aiWorld(opts) {
  const o = opts || {};
  const seed = mailSeed();
  seed.pucards.coMail['1234567891'].rows.push(
    { d: '2025-09-03', at: 3, io: 'in', s: '가나상사 홍길동 대리 연락처 041-000-0000 hong@example.com', w: '홍길동' });
  const w = rptWorld(Object.assign({}, o, { seed }));
  const fetched = [];
  const replies = (o.replies || [okReply()]).slice();
  const store = Object.assign({}, o.ls || { gov_ai_ok: '1' });
  Object.assign(w.ctx, {
    PuGovReportAi: Ai, setTimeout, clearTimeout,
    window: { PU_CFG: { aiProxyUrl: o.noProxy ? '' : 'https://proxy.example.com/ai' } },
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
    fetch: async (url, init) => {
      fetched.push({ url, body: JSON.parse(init.body) });
      const r = replies.shift();
      if (r instanceof Error) throw r;
      return { json: async () => r };
    },
  });
  vm.runInContext(AI_NAMES.map(grab).join('\n'), w.ctx);
  return Object.assign(w, { fetched, store });
}

test('AI ① 밖으로 나가는 글 전부에 가림 — 업체·사람 이름·전화·메일·사업자번호가 안 나간다', async () => {
  const w = aiWorld();
  w.ctx.getScheds()[1].memo = '홍길동 대리 면담(010-0000-0000) — 취업규칙 개정 요청';
  const st = await opened(w);
  const r = await w.ctx.grpAiDraft();
  assert.strictEqual(r.ok, true, JSON.stringify(r));
  assert.strictEqual(w.fetched.length, 1);
  assert.strictEqual(w.fetched[0].url, 'https://proxy.example.com/ai');
  const out = JSON.stringify(w.fetched[0].body);
  for (const bad of ['가나상사', '홍길동', '김가나', '041-000-0000', '010-0000-0000', 'hong@example.com', BIZ, '1234567891']) {
    assert.ok(!out.includes(bad), bad + ' 이(가) 나갔다');
  }
  assert.ok(out.includes('[가림]'), '전화·메일 자리는 [가림]');
  assert.strictEqual(w.fetched[0].body.model, 'claude-opus-5');
  assert.strictEqual(w.fetched[0].body.max_tokens, 8000);
  assert.strictEqual(st.report.rounds[0].inquiry, '가나상사 홍길동 취업규칙 문의', '받은 글에서 이름을 되돌린다');
  assert.strictEqual(st.aiSrc['rounds.0.inquiry'], 'ai');
});

test('AI ② 사람이 쓴 칸은 덮지 않는다 — 처음부터 쓴 칸도, AI 칸을 사람이 고친 것도', async () => {
  const w = aiWorld({ replies: [okReply(),
    aiReply({ rounds: [{ i: 0, diagnosis: '두 번째 진단' }], summary: { review: '두 번째 검토', etc: '두 번째 기타' } })] });
  const st = await opened(w);
  st.report.summary.action = '사람이 쓴 조치';
  const memo = st.report.rounds[0].advice;
  assert.ok(memo, '일정 메모가 자문 칸에 들어 있다(2단계)');
  assert.strictEqual((await w.ctx.grpAiDraft()).ok, true);
  assert.strictEqual(st.report.rounds[0].advice, memo, '메모에서 온 자문(사람 기록)을 덮었다');
  assert.strictEqual(st.report.summary.action, '사람이 쓴 조치');
  assert.strictEqual(st.report.summary.review, '검토 초안');
  assert.strictEqual(st.report.summary.overall, '', '충남북부 양식이 안 쓰는 칸');
  st.report.summary.review = '사람이 고친 검토';          // 화면에서 고친 것과 같다
  assert.strictEqual((await w.ctx.grpAiDraft()).ok, true);
  assert.strictEqual(st.report.summary.review, '사람이 고친 검토');
  assert.ok(!st.aiSrc['summary.review'], '사람이 고친 칸은 AI 표시가 빠진다');
  assert.strictEqual(st.report.summary.etc, '두 번째 기타', '사람이 안 고친 AI 칸은 새 초안으로');
  assert.strictEqual(st.report.rounds[0].diagnosis, '두 번째 진단');
});

test('AI ③ 기술보호 — 켜기 전엔 아무것도 안 보내고, 켜도 메일·보낸 서류는 안 보낸다', async () => {
  const w = aiWorld();
  const input = await w.ctx.grpCollect('c1', 'bxeyzrxm');
  const st = w.ctx.grpSetup(input, 'techguard');
  assert.strictEqual(st.techguard, true);
  assert.strictEqual(st.aiAllow, false, '기본은 끔');
  const r = await w.ctx.grpAiDraft();
  assert.strictEqual(r.ok, false);
  assert.strictEqual(w.fetched.length, 0);
  assert.ok(w.ctx.__toasts.some((t) => /이번 건 AI 사용/.test(t.m)));
  assert.strictEqual(w.ctx.grpAiAllow(), true);
  assert.strictEqual(st.aiAllow, true);
  assert.strictEqual((await w.ctx.grpAiDraft()).ok, true);
  const sent = JSON.stringify(w.fetched[0].body);
  for (const bad of ['취업규칙 검토 요청', '임금체계 검토 의견서', '취업규칙 개정안', '연락처']) {
    assert.ok(!sent.includes(bad), bad + ' 이(가) 나갔다');
  }
  assert.ok(sent.includes('2025-09-04') && sent.includes('취업규칙 개정 요청'), '회차 날짜·메모는 보낸다');
});

test('AI ④ 확정된 판은 부르지 않는다', async () => {
  const w = aiWorld();
  await opened(w);
  assert.strictEqual((await w.ctx.grpConfirm()).ok, true);
  const r = await w.ctx.grpAiDraft();
  assert.strictEqual(r.ok, false);
  assert.strictEqual(w.fetched.length, 0);
  assert.strictEqual(w.ctx.grpAiCan(w.ctx._grp).ok, false);
});

test('AI ⑤ 오류 — 프록시 없음·동의 안 함·응답 없음·JSON 못 읽음(한 번 더 물은 뒤), 칸은 그대로', async () => {
  let w = aiWorld({ noProxy: true });
  await opened(w);
  let r = await w.ctx.grpAiDraft();
  assert.strictEqual(r.ok, false);
  assert.strictEqual(w.fetched.length, 0);
  assert.ok(w.ctx.__toasts.some((t) => t.m === 'AI 프록시가 설정되지 않았습니다 — 포털 ⚙ 설정'));

  w = aiWorld({ ls: {} });
  w.ctx.confirm = () => false;
  await opened(w);
  r = await w.ctx.grpAiDraft();
  assert.strictEqual(r.ok, false);
  assert.strictEqual(w.fetched.length, 0, '동의 안 하면 보내지 않는다');
  assert.ok(!('gov_ai_ok' in w.store));

  w = aiWorld({ ls: {} });
  await opened(w);
  assert.strictEqual((await w.ctx.grpAiDraft()).ok, true);
  assert.strictEqual(w.store.gov_ai_ok, '1', '동의는 브라우저에 기억한다');

  w = aiWorld({ replies: [new TypeError('Failed to fetch'), new TypeError('Failed to fetch')] });
  let st = await opened(w);
  let before = JSON.stringify(st.report);
  r = await w.ctx.grpAiDraft();
  assert.strictEqual(r.ok, false);
  assert.ok(w.ctx.__toasts.some((t) => t.m === 'AI 응답이 없습니다 — 잠시 뒤 다시'));
  assert.strictEqual(JSON.stringify(st.report), before, '칸은 그대로');

  w = aiWorld({ replies: [aiText('죄송합니다'), aiText('여전히 JSON 아님')] });
  st = await opened(w);
  before = JSON.stringify(st.report);
  r = await w.ctx.grpAiDraft();
  assert.strictEqual(r.ok, false);
  assert.strictEqual(w.fetched.length, 2, '못 읽으면 한 번 더 묻는다');
  assert.ok(w.ctx.__toasts.some((t) => t.m === 'AI 답을 읽지 못했습니다'));
  assert.strictEqual(JSON.stringify(st.report), before);

  w = aiWorld({ replies: [aiText('잠시만요'), okReply()] });
  await opened(w);
  assert.strictEqual((await w.ctx.grpAiDraft()).ok, true, '두 번째 답을 읽으면 된다');
  assert.strictEqual(w.fetched.length, 2);
});

test('AI ⑥ 임시 저장에 AI 칸 목록(aiFields)을 남기고, 다시 열면 「AI 초안」으로 이어 받는다', async () => {
  const w = aiWorld();
  await opened(w);
  await w.ctx.grpAiDraft();
  assert.strictEqual((await w.ctx.grpSaveDraft()).ok, true);
  const rec = w.db.읽기('scal_reports/c1/bxeyzrxm_2025');
  assert.ok(Array.from(rec.aiFields).includes('summary.review'));
  assert.ok(Array.from(rec.aiFields).every((p) => !/\.\./.test(p)));
  const again = await w.ctx.grpCollect('c1', 'bxeyzrxm');
  const st2 = w.ctx.grpSetup(again, 'cci-north');
  assert.strictEqual(st2.aiSrc['summary.review'], 'ai');
  assert.strictEqual(st2.aiVal['summary.review'], '검토 초안');
  assert.strictEqual(st2.aiUndo, null, '되돌리기는 창 안에서만');
});

test('AI ⑦ 되돌리기 — 직전 AI 넣기만 되돌리고, 그 뒤 사람이 고친 칸은 그대로', async () => {
  const w = aiWorld();
  const st = await opened(w);
  await w.ctx.grpAiDraft();
  st.report.summary.etc = '사람이 고친 기타';
  const u = w.ctx.grpAiUndo();
  assert.strictEqual(u.ok, true);
  assert.strictEqual(st.report.summary.review, '');
  assert.strictEqual(st.report.rounds[0].inquiry, '');
  assert.strictEqual(st.report.summary.etc, '사람이 고친 기타');
  assert.strictEqual(st.aiUndo, null);
  assert.ok(!st.aiSrc['summary.review']);
});

test('AI ⑦-2 보고서에서 더한 회차를 빼면 AI 칸 표시도 한 칸씩 당겨진다', async () => {
  const w = aiWorld();
  const st = await opened(w);
  w.ctx.grpAddRound(); w.ctx.grpAddRound();             // 2회·3회(0부터 2·3) 추가
  st.aiSrc = { 'rounds.2.inquiry': 'ai', 'rounds.3.inquiry': 'ai', 'summary.etc': 'ai' };
  st.aiVal = { 'rounds.2.inquiry': 'a', 'rounds.3.inquiry': 'b', 'summary.etc': 'c' };
  w.ctx.grpDelRound(2);
  assert.deepStrictEqual(Object.keys(st.aiSrc).sort(), ['rounds.2.inquiry', 'summary.etc']);
  assert.strictEqual(st.aiVal['rounds.2.inquiry'], 'b');
});

test('AI — 스크립트 줄: pu-gov-report-ai.js 는 pu-gov-report.js 뒤에', () => {
  const g = HTML.indexOf('<script src="js/pu-gov-report.js?v=');
  const a = HTML.indexOf('<script src="js/pu-gov-report-ai.js?v=');
  assert.ok(g >= 0 && a > g, 'pu-gov-report-ai.js 줄이 없거나 차례가 틀렸다');
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test tests/gov-report-ui.test.js`
Expected: FAIL — `grpAiSync 을(를) 못 찾았다` (기존 검사들도 함께 빨개진다 — 이 작업이 끝나면 모두 초록이어야 한다)

- [ ] **Step 3: 구현** — `gov-consulting.html`

(1) 스크립트 줄(:1325~1330). 주석 끝에 한 줄을 더하고, pack 줄 아래에 붙인다.

```html
  <!-- 정부컨설팅 보고서 — 기관 빈 양식(HWPX)을 채운다 (2026-10-09). 차례가 중요하다:
       hwpx-fill → gov-report(그것을 쓴다) → build → pack(gov-report 를 쓴다). hwpx-fill 판은 fund.html 과 같게.
       ai(3단계 AI 초안, 2026-10-10)도 gov-report 를 쓴다 — 그 뒤에. -->
  <script src="js/pu-hwpx-fill.js?v=6"></script>
  <script src="js/pu-gov-report.js?v=1"></script>
  <script src="js/pu-gov-report-build.js?v=3"></script>
  <script src="js/pu-gov-report-pack.js?v=1"></script>
  <script src="js/pu-gov-report-ai.js?v=1"></script>
```

(2) `GRP_ACTS`(:7603~7604)를 바꾸고, 바로 아래에 상수 다섯 줄을 둔다(각각 한 줄).

```js
const GRP_ACTS={save:'grpSaveDraft',dl:'grpDownload',confirm:'grpConfirm',addRound:'grpAddRound',delRound:'grpDelRound',
  newVer:'grpNewVersion',choose:'grpChooseForm',close:'grpClose',ai:'grpAiDraft',aiUndo:'grpAiUndo',aiAllow:'grpAiAllow'};
/* ✨ AI 초안(3단계, 2026-10-10) — 업무관리 aiCall 과 같은 프록시·모델 순서. 시간 제한 90초 */
const GRP_AI_MODELS=['claude-opus-5','claude-sonnet-4-20250514'];
const GRP_AI_WAIT_MS=90000;
const GRP_AI_OK='gov_ai_ok';
const GRP_AI_MSG={noProxy:'AI 프록시가 설정되지 않았습니다 — 포털 ⚙ 설정',net:'AI 응답이 없습니다 — 잠시 뒤 다시',parse:'AI 답을 읽지 못했습니다',locked:'확정된 판입니다 — AI 초안은 [새 판으로 고치기] 뒤에 씁니다',tg:'기술보호 사업장입니다 — 「이번 건 AI 사용」을 켜야 AI 초안을 씁니다(켜도 회차 날짜·메모만 보냅니다)',none:'AI 가 채울 빈 칸이 없습니다 — 사람이 쓴 칸은 덮지 않습니다'};
const GRP_AI_PATH=/^(?:rounds\.\d+\.(?:inquiry|diagnosis|advice|result|next)|summary\.(?:inquiryDiag|review|action|etc|adviceAll|overall))$/;
```

(3) `grpSetup` — `if(!rep.techField) rep.techField={};` 바로 아래에 더한다.

```js
  /* 전에 AI 가 넣고 사람이 손대지 않은 채 저장된 칸(aiFields) — 다시 열어도 「AI 초안」으로 이어 받는다 */
  const ai={src:{},val:{}};
  ((saved&&Array.isArray(saved.aiFields))?saved.aiFields:[]).forEach(function(p){
    if(!GRP_AI_PATH.test(String(p))) return;
    const v=grpGet(rep,p);
    if(typeof v==='string'&&v.trim()){ ai.src[p]='ai'; ai.val[p]=v; }
  });
```

그리고 `_grp={…}` 의 마지막 줄을 바꾼다.

```js
    locked:!!(saved&&saved.state==='검토완료'),newVer:false,tpl:{},notes:(input.notes||[]).slice(),
    aiSrc:ai.src,aiVal:ai.val,aiWarn:{},aiUndo:null,aiAllow:false,aiBusy:false};
```

(4) `grpRecord` — `rounds:` 줄 다음에 한 줄을 더한다.

```js
    rounds:st.meta.map(function(m){ return {added:!!(m&&m.added)}; }),ver:st.ver||0,
    aiFields:grpAiFields(st),
```

(5) `grpDelRound` — `st.report.rounds.splice(i,1); st.meta.splice(i,1);` 를 다음으로 바꾼다.

```js
  st.report.rounds.splice(i,1); st.meta.splice(i,1); grpAiDropRound(st,i);
```

(6) `/* ── 그리기 ── */` 줄(:8079) 바로 위에 새 묶음을 넣는다.

```js
/* ── ✨ AI 초안 (3단계, 2026-10-10 대표 「추천대로») ──
   설계 docs/superpowers/specs/2026-10-10-gov-report-step3-ai-draft-design.md
   ★ 보내기 전에 모두 가린다(PuGovReportAi.buildRequest) — 이름은 자리 표시, 전화·메일·주민·계좌·사업자번호는 [가림].
   ★ 비었거나 전에 AI 가 넣고 사람이 손대지 않은 칸만 채운다. 사람이 고쳤는지는 «지금 값 ≠ AI 가 넣은 값(aiVal)» 으로 본다.
   ★ 저장하지 않는다 — 💾·✔ 를 사람이 누를 때만. 기술보호는 「이번 건 AI 사용」을 켤 때만, 켜도 회차 날짜·메모만.
   ⚠ 바깥으로 나가는 부름은 grpAiCall 하나뿐이다(업무관리 aiCall 과 같은 꼴 — 공용 모듈 정리는 범위 밖). */
function grpAiProxyUrl(){
  try{
    const raw=localStorage.getItem('pureun_v6_setting_ai_proxy_url')||localStorage.getItem('pureun_v6_ai_proxy_url')
      ||(window.PU_CFG&&window.PU_CFG.aiProxyUrl)||'';
    if(!raw) return '';
    if(raw.charAt(0)==='"'){ try{ return JSON.parse(raw); }catch(e){ return raw.replace(/^"|"$/g,''); } }
    return raw;
  }catch(e){ return ''; }
}
function grpAiConsent(){
  try{ if(localStorage.getItem(GRP_AI_OK)==='1') return true; }catch(e){}
  const ok=grpAsk('✨ AI 초안\n\n업체 자료가 외부 AI(Anthropic)로 전송됩니다 — 가림 처리 후\n'
    +'(업체·대표자·담당자 이름은 자리 표시로 바꾸고, 전화·메일·주민번호·계좌·사업자번호는 [가림]으로 지웁니다. '
    +'급여·명부 같은 개인 자료와 첨부 원본은 보내지 않습니다.)\n\n계속할까요? (이 브라우저에서 한 번만 묻습니다)');
  if(ok){ try{ localStorage.setItem(GRP_AI_OK,'1'); }catch(e){} }
  return !!ok;
}
function grpAiFetch(url,opts){
  if(typeof AbortController==='undefined') return fetch(url,opts);
  const ac=new AbortController();
  const timer=setTimeout(function(){ ac.abort(); },GRP_AI_WAIT_MS);
  return fetch(url,Object.assign({},opts,{signal:ac.signal})).then(function(r){ clearTimeout(timer); return r; },
    function(e){
      clearTimeout(timer);
      if(e&&e.name==='AbortError'){ const t=new Error(GRP_AI_MSG.net+' ('+Math.round(GRP_AI_WAIT_MS/1000)+'초)'); t.timeout=true; throw t; }
      throw e;
    });
}
function grpAiCall(system,messages){
  const url=grpAiProxyUrl();
  if(!url){ const e=new Error(GRP_AI_MSG.noProxy); e.noProxy=true; return Promise.reject(e); }
  let i=0;
  function attempt(){
    return grpAiFetch(url,{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({model:GRP_AI_MODELS[i],max_tokens:8000,system:system,messages:messages})})
      .then(function(r){ return r.json(); })
      .then(function(d){
        if(d&&d.error) throw new Error(d.error.message||'AI 오류');
        const t=d&&(d.reply||d.text||((d.content||[]).filter(function(b){ return b&&b.type==='text'; }).map(function(b){ return b.text; }).join('')));
        if(!t) throw new Error('AI 응답이 비어 있습니다');
        return t;
      })
      .catch(function(e){
        if(e&&e.timeout) throw e;                                    // 끊긴 것은 모델 탓이 아니다
        if(i<GRP_AI_MODELS.length-1){ i++; return attempt(); }       // 프록시가 모델을 막으면 다음 모델로
        throw e;
      });
  }
  return attempt();
}
/* 자리 표시로 바꿀 이름 — 보고서 company(이름·대표자·담당자)는 모듈이 넣는다. 여기서는 사업장 이름·계약 업체명·다른 담당자 */
function grpAiNames(st){
  const out=[{v:st.coName,as:'[해당 기업]'}];
  const cc=(st.input&&st.input.cons&&st.input.cons.company)||{};
  if(cc.name) out.push({v:cc.name,as:'[해당 기업]'});
  if(cc.ceo) out.push({v:cc.ceo,as:'[대표자]'});
  const prim=String(((st.report&&st.report.company)||{}).contact||'').trim();
  let n=1;
  (cc.contacts||[]).forEach(function(c){
    const nm=String((c&&c.name)||'').trim();
    if(!nm||nm===prim) return;
    n++; out.push({v:nm,as:'[담당자'+n+']'});
  });
  return out;
}
/* 회차마다 그날 일정 메모(사전진단 뺌) — 날짜로 잇는다. 보고서에서 더한 회차는 '' */
function grpAiMemos(st){
  const sc=((st.input&&st.input.scheds)||[]).filter(function(s){ return s&&s.phase!=='pre'; });
  return ((st.report&&st.report.rounds)||[]).map(function(r){
    const d=String((r&&r.date)||'');
    if(!d) return '';
    return sc.filter(function(s){ return String(s.date||'')===d; })
      .map(function(s){ return String(s.memo||'').trim(); }).filter(Boolean).join(' / ');
  });
}
function grpAiCan(st){
  if(!st||!st.formKey||!st.report) return {ok:false,why:''};
  if(st.locked) return {ok:false,why:GRP_AI_MSG.locked};
  if(st.techguard&&!st.aiAllow) return {ok:false,why:GRP_AI_MSG.tg};
  return {ok:true,why:''};
}
/* 사람이 고친 AI 칸을 찾아 표시를 뗀다 — 뗀 경로 목록 */
function grpAiSync(st){
  st=st||_grp;
  const gone=[];
  if(!st||!st.aiSrc||!st.report) return gone;
  st.aiVal=st.aiVal||{}; st.aiWarn=st.aiWarn||{};
  Object.keys(st.aiSrc).forEach(function(p){
    if(st.aiSrc[p]!=='ai') return;
    const v=grpGet(st.report,p);
    if(String(v==null?'':v)!==String(st.aiVal[p]==null?'':st.aiVal[p])){
      delete st.aiSrc[p]; delete st.aiVal[p]; delete st.aiWarn[p]; gone.push(p);
    }
  });
  return gone;
}
/* 저장할 AI 칸 목록 — 사람이 고친 것은 빼고 */
function grpAiFields(st){
  st=st||_grp;
  if(!st||!st.aiSrc) return [];
  grpAiSync(st);
  return Object.keys(st.aiSrc).filter(function(p){ return st.aiSrc[p]==='ai'&&GRP_AI_PATH.test(p); }).sort();
}
/* 보고서에서 더한 회차를 빼면 그 뒤 회차의 AI 표시를 한 칸씩 당긴다. 되돌리기는 번호가 어긋나므로 버린다 */
function grpAiDropRound(st,i){
  if(!st||!st.aiSrc) return;
  const move=function(m){
    const o={};
    Object.keys(m||{}).forEach(function(p){
      const x=/^rounds\.(\d+)\.(.+)$/.exec(p);
      if(!x){ o[p]=m[p]; return; }
      const n=+x[1];
      if(n===i) return;
      o[n>i?'rounds.'+(n-1)+'.'+x[2]:p]=m[p];
    });
    return o;
  };
  st.aiSrc=move(st.aiSrc); st.aiVal=move(st.aiVal); st.aiWarn=move(st.aiWarn); st.aiUndo=null;
}
/* 기술보호 — 「이번 건 AI 사용」 켜기/끄기(이 창에서만, 저장하지 않는다) */
function grpAiAllow(){
  const st=_grp;
  if(!st||!st.techguard||st.locked) return false;
  if(st.aiAllow){ st.aiAllow=false; grpRenderTop(); grpRenderWarn(); return false; }
  if(!grpAsk('🔒 기술보호 사업장입니다.\n이번 건에 AI 초안을 쓸까요?\n\n켜도 회차 날짜·메모만 보냅니다(메일·보낸 서류·기술 자료는 보내지 않습니다).')) return false;
  st.aiAllow=true; grpRenderTop(); grpRenderWarn();
  return true;
}
/* ✨ AI 초안 */
async function grpAiDraft(){
  const st=_grp;
  if(!st||!st.formKey||!st.report||st.ask||st.loading) return {ok:false};
  if(st.aiBusy) return {ok:false,error:'AI 초안을 쓰는 중입니다'};
  const can=grpAiCan(st);
  if(!can.ok){ toast(can.why,'err'); return {ok:false,error:can.why}; }
  grpReadForm(); grpAiSync(st);
  const A=PuGovReportAi;
  const req=A.buildRequest(st.report,st.feed,st.formKey,
    {techguard:!!st.techguard,src:st.aiSrc,names:grpAiNames(st),memos:grpAiMemos(st)});
  if(!req.want.length){ toast(GRP_AI_MSG.none); return {ok:false,error:GRP_AI_MSG.none}; }
  if(!grpAiProxyUrl()){ toast(GRP_AI_MSG.noProxy,'err'); grpNote(escAttr(GRP_AI_MSG.noProxy)); return {ok:false,error:GRP_AI_MSG.noProxy}; }
  if(!grpAiConsent()) return {ok:false,cancelled:true};                 // 동의 안 하면 아무것도 보내지 않는다
  st.aiBusy=true; grpRenderTop();
  let draft=null, err=null;
  try{
    for(let k=0;k<2&&!draft;k++){                                      // 못 읽으면 한 번 더 묻는다
      const text=await grpAiCall(req.system,req.messages);
      try{ draft=A.parseDraft(text,req.back); }catch(e){ if(!e.parse) throw e; err=e; }
    }
  }catch(e){ err=e; }
  st.aiBusy=false;
  if(_grp!==st) return {ok:false,error:'창이 바뀌었습니다'};
  if(!draft){
    const m=(err&&err.noProxy)?GRP_AI_MSG.noProxy:(err&&err.parse)?GRP_AI_MSG.parse:GRP_AI_MSG.net;
    console.warn('[보고서] AI 초안 실패',err);
    toast(m,'err'); grpNote(escAttr(m)); grpRenderTop();
    return {ok:false,error:m};
  }
  if(st.locked){ toast(GRP_AI_MSG.locked,'err'); grpRenderTop(); return {ok:false,error:GRP_AI_MSG.locked}; }
  grpReadForm(); grpAiSync(st);                                        // 기다리는 동안 사람이 고친 칸
  const res=A.applyDraft(st.report,st.aiSrc,draft,req.fields);
  st.report=res.report; st.aiSrc=res.src;
  Object.keys(res.undo.put).forEach(function(p){ st.aiVal[p]=res.undo.put[p]; });
  if(res.filled.length) st.aiUndo=res.undo;
  const warn=A.checkDraft(draft,req.sent,req.limits);
  res.filled.forEach(function(p){ if(warn[p]) st.aiWarn[p]=warn[p]; else delete st.aiWarn[p]; });
  grpNote(''); grpRender();
  const nw=res.filled.filter(function(p){ return warn[p]; }).length;
  toast(res.filled.length
    ?'AI 초안을 '+res.filled.length+'칸에 넣었습니다'+(nw?' — 확인 필요 '+nw+'칸':'')+'. 읽고 고친 뒤 저장하세요'
    :'AI 초안에 새로 넣을 칸이 없었습니다');
  return {ok:true,filled:res.filled};
}
/* ↶ 직전 AI 넣기 되돌리기 — 그 뒤 사람이 고친 칸은 그대로 */
function grpAiUndo(){
  const st=_grp;
  if(!st||!st.report||st.locked||!st.aiUndo) return {ok:false};
  grpReadForm(); grpAiSync(st);
  const u=PuGovReportAi.undoDraft(st.report,st.aiSrc,st.aiUndo);
  st.report=u.report; st.aiSrc=u.src;
  u.restored.forEach(function(p){
    if(st.aiSrc[p]==='ai') st.aiVal[p]=grpGet(st.report,p); else delete st.aiVal[p];
    delete st.aiWarn[p];
  });
  st.aiUndo=null;
  grpRender();
  toast('AI 초안 '+u.restored.length+'칸을 되돌렸습니다'+(u.kept.length?' — 그 뒤 고친 '+u.kept.length+'칸은 그대로 둡니다':''));
  return {ok:true,restored:u.restored,kept:u.kept};
}
```

- [ ] **Step 4: 통과 확인**

Run: `node --test tests/gov-report-ui.test.js tests/gov-report-ai.test.js tests/shared-js-cache-version.test.js`
Expected: PASS — 기존 보고서 검사(①~⑥, ⑤-2~⑤-6 등)와 새 AI ①~⑦-2·스크립트 줄 검사가 모두 초록.

- [ ] **Step 5: 커밋** (PowerShell)

```powershell
git add gov-consulting.html tests/gov-report-ui.test.js
git commit -m @'
feat(gov): ✨ AI 초안 흐름 — 가림 후 프록시·동의·기술보호 켜기·사람 칸 보존·되돌리기

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
'@
```

---

### Task 5: gov-consulting.html — 화면(단추·「AI 초안」 딱지·경고·사람이 고치면 딱지 떼기)

**Files:** Modify `gov-consulting.html` (CSS :498·:530 · `grpBind` change 처리 :8071~8077 · `grpFieldHtml` :8091 · `grpWarnings` :8110 · `grpRenderTop` :8159 · `grpRender` 회차 줄 :8194) · Test `tests/gov-report-ui.test.js` (더함)

**Interfaces:**
- Consumes: Task 4 의 `grpAiCan`, `grpAiSync`, `grpAiAllow`, `_grp.aiSrc/aiWarn/aiUndo/aiAllow/aiBusy`, `GRP_RLAB`
- Produces
  - `grpAiButtons(st) → html` — 기술보호면 `data-grp-act="aiAllow"`(「☐/☑ 이번 건 AI 사용」), ✨ 단추(`data-grp-act="ai"`, 막히면 `disabled`), 되돌리기(`data-grp-act="aiUndo"`). 쓰는 중이면 「✨ AI 초안 쓰는 중…」(비활성)
  - `grpAiFoot(st, paths, key) → html` — `<div class="grp-aiw" data-grp-ai="key"><span class="grp-tag ai">AI 초안</span>…경고</div>`. AI 칸이 없으면 ''

- [ ] **Step 1: 실패하는 검사 더하기** — `tests/gov-report-ui.test.js`

(1) `aiWorld` 의 `vm.runInContext(AI_NAMES…)` 줄 바로 아래에 더한다.

```js
  if (o.screen) vm.runInContext(SCREEN_NAMES.map(grab).join('\n'), w.ctx);
```

그리고 `AI_NAMES` 정의 아래에 더한다.

```js
const SCREEN_NAMES = ['grpRenderTop', 'grpFileLabel', 'grpFieldHtml', 'grpSrcLabel', 'grpWarnings', 'grpAiButtons', 'grpAiFoot'];
const aiBtn = (h) => (h.match(/<button[^>]*data-grp-act="ai"[^>]*>/) || [''])[0];
```

(2) 파일 끝에 더한다.

```js
test('AI ⑧ 화면 — ✨ 단추·되돌리기 단추·「AI 초안」 딱지와 경고, 사람이 고치면 딱지가 빠진다, 확정하면 잠긴다', async () => {
  const w = aiWorld({ screen: true });
  const st = await opened(w);
  w.ctx.grpRenderTop();
  let top = w.els['#grpTop'].innerHTML;
  assert.ok(aiBtn(top) && !/disabled/.test(aiBtn(top)), '열린 초안에서는 눌린다');
  assert.ok(!/data-grp-act="aiAllow"/.test(top), '기술보호가 아니면 켜기 단추가 없다');
  assert.ok(!/data-grp-act="aiUndo"/.test(top));
  assert.ok(!/3단계에서 붙습니다/.test(top), '자리만 잡던 단추가 남았다');
  await w.ctx.grpAiDraft();
  w.ctx.grpRenderTop();
  top = w.els['#grpTop'].innerHTML;
  assert.match(top, /data-grp-act="aiUndo"/);
  const f = w.ctx.grpFieldsFor('cci-north').find((x) => x.path === 'summary.review');
  assert.match(w.ctx.grpFieldHtml(st, f), /data-grp-ai="summary\.review"><span class="grp-tag ai">AI 초안/);
  st.aiWarn['summary.review'] = ['확인 필요 — 입력에 없던 날짜·숫자: 2026'];
  assert.match(w.ctx.grpFieldHtml(st, f), /확인 필요 — 입력에 없던 날짜·숫자: 2026/);
  assert.ok(w.ctx.grpWarnings(st).some((x) => /✨ AI 초안 \d+칸/.test(x.t)));
  st.report.summary.review = '사람이 고침';
  w.ctx.grpAiSync(st);
  assert.ok(!/AI 초안/.test(w.ctx.grpFieldHtml(st, f)), '사람이 고치면 딱지가 없어진다');
  assert.strictEqual((await w.ctx.grpConfirm()).ok, true);
  w.ctx.grpRenderTop();
  top = w.els['#grpTop'].innerHTML;
  assert.match(aiBtn(top), /disabled/, '확정된 판은 잠긴다');
  assert.ok(!/data-grp-act="aiUndo"/.test(top));
});

test('AI ⑨ 화면 — 기술보호는 켜기 전 ✨ 가 잠기고 「이번 건 AI 사용」 단추가 있다', async () => {
  const w = aiWorld({ screen: true });
  const input = await w.ctx.grpCollect('c1', 'bxeyzrxm');
  const st = w.ctx.grpSetup(input, 'techguard');
  w.ctx.grpRenderTop();
  let top = w.els['#grpTop'].innerHTML;
  assert.match(aiBtn(top), /disabled/);
  assert.match(top, /data-grp-act="aiAllow"[^>]*>☐ 이번 건 AI 사용/);
  w.ctx.grpAiAllow();                                   // 다시 그린다
  top = w.els['#grpTop'].innerHTML;
  assert.ok(!/disabled/.test(aiBtn(top)));
  assert.match(top, /☑ 이번 건 AI 사용/);
  assert.ok(w.ctx.grpWarnings(st).some((x) => /이번 건 AI 사용 켬/.test(x.t)));
});

test('AI ⑩ 화면 — 칸을 고치면(change) AI 표시를 맞추고 그 딱지만 다시 그린다', () => {
  const b = grab('grpBind');
  assert.match(b, /grpReadForm\(\);[\s\S]*grpAiSync\(_grp\)[\s\S]*data-grp-ai/);
  assert.match(SRC, /\.grp-tag\.ai\{/);
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test tests/gov-report-ui.test.js`
Expected: FAIL — `grpAiButtons 을(를) 못 찾았다`

- [ ] **Step 3: 구현** — `gov-consulting.html`

(1) CSS — `.grp-ai{…}` 줄(:498)을 바꾼다.

```css
.grp-ai{background:#f5f3ff;color:#6d28d9;border-color:#ddd6fe;}
.grp-ai[disabled]{background:#f8fafc;color:#64748b;border-color:#cbd5e1;}
```

`.grp-tag.add{…}` 줄(:530) 아래에 더한다.

```css
.grp-tag.ai{background:#f5f3ff;color:#6d28d9;}
.grp-aiw{margin-top:3px;font-size:11px;line-height:1.45;color:#854d0e;}
.grp-aiw-w{margin-top:2px;}
```

(2) `grpBind` 의 change 처리 — 다음 세 줄을

```js
    grpReadForm();
    if(el.type!=='checkbox') el.classList.toggle('grp-blank',!String(el.value||'').trim());
    grpRenderWarn();
```

다음으로 바꾼다.

```js
    grpReadForm();
    if(el.type!=='checkbox') el.classList.toggle('grp-blank',!String(el.value||'').trim());
    /* 사람이 고친 AI 칸 — 표시를 떼고 그 칸(회차는 그 회차) 딱지만 다시 그린다 */
    grpAiSync(_grp).forEach(function(p){
      const m=/^rounds\.(\d+)\./.exec(p), key=m?'rounds.'+m[1]:p;
      const box=q('[data-grp-ai="'+key+'"]');
      if(box) box.outerHTML=grpAiFoot(_grp,m?GRP_RLAB.map(function(k){ return key+'.'+k[0]; }):[p],key);
    });
    grpRenderWarn();
```

(3) `/* ── 그리기 ── */` 줄 바로 아래(`grpSrcLabel` 위)에 두 함수를 넣는다.

```js
/* 「AI 초안」 딱지 + 그 칸 경고. paths 가 여럿이면(회차 한 칸) 경고 앞에 이름표를 붙인다 */
function grpAiFoot(st,paths,key){
  const on=(paths||[]).filter(function(p){ return st&&st.aiSrc&&st.aiSrc[p]==='ai'; });
  if(!on.length) return '';
  const ws=[];
  on.forEach(function(p){
    const last=p.slice(p.lastIndexOf('.')+1);
    const lab=(GRP_RLAB.find(function(k){ return k[0]===last; })||[])[1];
    ((st.aiWarn||{})[p]||[]).forEach(function(w){ ws.push((paths.length>1&&lab?lab+' — ':'')+w); });
  });
  return `<div class="grp-aiw" data-grp-ai="${escAttr(key)}"><span class="grp-tag ai">AI 초안</span>${ws.map(function(w){ return `<div class="grp-aiw-w">⚠ ${escAttr(w)}</div>`; }).join('')}</div>`;
}
/* 머리줄 AI 단추들 — 기술보호 켜기 · ✨ · ↶ 되돌리기 */
function grpAiButtons(st){
  if(st.aiBusy) return '<button type="button" class="btn btn-s grp-b grp-ai" disabled>✨ AI 초안 쓰는 중…</button>';
  const can=grpAiCan(st);
  const tip=can.ok?'빈 칸과 전에 AI 가 쓴 칸에만 초안을 넣습니다 — 사람이 쓴 칸은 덮지 않습니다. 저장은 직접 누릅니다':can.why;
  let h='';
  if(st.techguard&&!st.locked) h+=`<button type="button" class="btn btn-s grp-b" data-grp-act="aiAllow" title="기술보호 사업장 — 켜도 회차 날짜·메모만 보냅니다">${st.aiAllow?'☑':'☐'} 이번 건 AI 사용</button>`;
  h+=`<button type="button" class="btn btn-s grp-b grp-ai" data-grp-act="ai"${can.ok?'':' disabled'} title="${escAttr(tip)}">✨ AI 초안</button>`;
  if(st.aiUndo&&!st.locked) h+=`<button type="button" class="btn btn-s grp-b" data-grp-act="aiUndo" title="직전 AI 넣기를 되돌립니다 — 그 뒤 사람이 고친 칸은 그대로">↶ AI 되돌리기</button>`;
  return h;
}
```

(4) `grpFieldHtml` 마지막 줄을 바꾼다.

```js
  return `<label class="grp-lbl">${escAttr(f.label)}</label><div>${ctl}${grpAiFoot(st,[f.path],f.path)}${foot}</div>`;
```

(5) `grpWarnings` — 기술보호 줄(`if(st.techguard) W.push({k:'lock',…});`) 아래에 더한다.

```js
  if(st.techguard&&st.aiAllow&&!st.locked) W.push({k:'lock',t:'🔒 이번 건 AI 사용 켬 — 회차 날짜·메모만 보냅니다(메일·보낸 서류는 보내지 않습니다)'});
  const aiOn=Object.keys(st.aiSrc||{}).filter(function(p){ return st.aiSrc[p]==='ai'; });
  if(aiOn.length){
    const wn=aiOn.filter(function(p){ return (st.aiWarn||{})[p]&&st.aiWarn[p].length; }).length;
    W.push({k:wn?'warn':'',t:'✨ AI 초안 '+aiOn.length+'칸 — 노무사가 읽고 고친 뒤 저장·확정하세요'+(wn?' · 확인 필요 '+wn+'칸':'')});
  }
```

(6) `grpRenderTop` — 자리만 잡던 줄

```js
    <button type="button" class="btn btn-s grp-b grp-ai" disabled title="3단계에서 붙습니다">✨ AI 초안 (3단계)</button>
```

을 다음으로 바꾼다.

```js
    ${grpAiButtons(st)}
```

(7) `grpRender` 회차 줄 — 다음 줄을

```js
        ${added?'<div class="grp-blankmsg">일정에 기록이 없는 회차입니다 — 이 보고서에만 남습니다</div>':'<div class="grp-src">재료 <b>정부사업일정 메모</b></div>'}</td>
```

다음으로 바꾼다.

```js
        ${grpAiFoot(st,GRP_RLAB.map(function(k){ return 'rounds.'+i+'.'+k[0]; }),'rounds.'+i)}
        ${added?'<div class="grp-blankmsg">일정에 기록이 없는 회차입니다 — 이 보고서에만 남습니다</div>':'<div class="grp-src">재료 <b>정부사업일정 메모</b></div>'}</td>
```

- [ ] **Step 4: 통과 확인**

Run: `node --test tests/gov-report-ui.test.js tests/gov-report-ai.test.js tests/shared-js-cache-version.test.js`
Expected: PASS — 「보고서 ⑥ 단추가 부르는 grp* 함수」 검사도 `ai`·`aiUndo`·`aiAllow` 가 `GRP_ACTS` 에 있어 초록.

- [ ] **Step 5: 커밋** (PowerShell)

```powershell
git add gov-consulting.html tests/gov-report-ui.test.js
git commit -m @'
feat(gov): AI 초안 화면 — ✨ 단추·기술보호 켜기·「AI 초안」 딱지·확인 필요 경고·되돌리기

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
'@
```

---

### Task 6: 전체 검사 + 기록

**Files:** Modify `STATUS.md` · Create `status/2026-10-10-gov-report-step3-ai.md`

- [ ] **Step 1: 전체 검사**

Run: `node --test "tests/**/*.test.js"`
Expected: 새로 빨개진 것이 없다(작업 전 `git stash` 없이 main 과 견주려면 `git log` 로 기준 커밋을 적어 두고, 이미 빨갛던 검사는 그대로 적는다).

- [ ] **Step 2: 눈으로 확인(로그인 없이 되는 만큼)**
  - `.claude/launch.json` 의 정적 서버(`static`, 8799)로 `gov-consulting.html` 을 연다.
  - 콘솔에 `pu-gov-report-ai.js` 로딩 오류·`PuGovReportAi is not defined` 가 없는지 본다.
  - 실제 업체 자료로 AI 를 부르지 않는다. 실제 초안 품질은 배포 뒤 대표·노무사 확인 거리로 남긴다.

- [ ] **Step 3: `STATUS.md`** — 정부컨설팅 묶음의 이 줄을

```markdown
- [ ] 다음: 현장클리닉·농촌융복합 양식 → 3단계 AI 초안 → .hwp 필요 기관은 PC 한글 변환(Claude 로컬)
```

다음 세 줄로 바꾼다.

```markdown
- [x] 3단계 AI 초안 — 구현 (PR 예정). 설계 `docs/superpowers/specs/2026-10-10-gov-report-step3-ai-draft-design.md` · 계획 `docs/superpowers/plans/2026-10-10-gov-report-step3-ai-draft.md`. ✨ 단추 → 가림 처리 후 기존 Claude 프록시 → 빈 칸·AI 칸에만(사람이 쓴 칸은 안 덮음, 저장은 사람이). 기술보호는 「이번 건 AI 사용」을 켤 때만, 켜도 회차 날짜·메모만
- [ ] 3단계 확인 필요 — 기관별 작성기준 문구(`PuGovReportAi.GUIDE`)·칸별 글자 수 한도(`LIMITS`)를 노무사가 기관 원문과 대조 · 실제 업체 1곳으로 초안 품질 확인(저장 안 함)
- [ ] 다음: 현장클리닉·농촌융복합 양식 → .hwp 필요 기관은 PC 한글 변환(Claude 로컬)
```

- [ ] **Step 4: `status/2026-10-10-gov-report-step3-ai.md`** (새)

```markdown
# 2026-10-10 · 정부컨설팅 보고서 3단계 — AI 초안

대표 「추천대로」(2026-10-10). 설계 `docs/superpowers/specs/2026-10-10-gov-report-step3-ai-draft-design.md`.

## 한 것
- `js/pu-gov-report-ai.js`(새, 순수 함수): 양식 칸 목록 · 가리기 · 요청 만들기 · 답 읽기 · 칸에 넣기/되돌리기 · 점검.
- 보고서 작성 창의 ✨ AI 초안 단추를 살렸다.
  - 기존 Claude 프록시(`aiProxyUrl`)를 부른다. 모델은 opus → sonnet 차례, 90초 제한이다.
  - 처음 쓸 때 동의를 받는다(`gov_ai_ok`).
- 「AI 초안」 딱지·확인 필요 경고(지어낸 날짜·숫자, 한도 초과, 남은 [가림], 기록 없음)·되돌리기를 붙였다.
- 임시 저장·확정 기록에 `aiFields`(아직 AI 가 쓴 그대로인 칸)를 남긴다. 다시 열면 이어 받는다.

## 왜
- 설계서 §6-3·§9 의 3단계. 2단계(작성 창·서고)가 끝나 칸을 채울 차례였다.

## 남긴 함정
- **이름 자리 표시는 대괄호**(`[해당 기업]`·`[대표자]`·`[담당자]`·`[담당자2]`…)다. 맨 낱말로 바꾸면 되돌릴 때 보통 글의 「대표자」까지 사람 이름이 된다.
- 기업정보함 메일 요약(`coMail`)에는 **본문이 없다** — 지금은 제목만 간다. feed 에 `body` 가 생기면 1,500자까지 저절로 간다.
- 일정 메모는 2단계에서 이미 「자문」 칸에 들어가므로 «사람이 쓴 칸»으로 보고 덮지 않는다. AI 는 문의·진단·성과·향후와 종합을 채운다.
- 기관 작성기준 문구(`GUIDE`)와 글자 수 한도(`LIMITS`)는 출발값이다 — [확인 필요] 노무사가 기관 원문과 대조.
- 기술보호 「이번 건 AI 사용」은 창을 닫으면 꺼진다(저장하지 않는다).
- 사람이 고쳤는지는 «지금 값 ≠ AI 가 넣은 값» 으로 본다. 회차 칸은 한 글상자를 「문의: …」 줄로 나눠 읽으므로, AI 글 안에 「진단:」으로 시작하는 줄이 있으면 사람이 고친 것으로 보일 수 있다(덮지 않는 쪽으로 틀린다).
- 서버 함수로 옮기기(로그인 확인·월 한도)는 사용량이 커지면 할 다음 길이다.

## 다음
- 실제 업체 1곳으로 초안 품질 확인(저장 안 함) → 작성기준 문구 다듬기.
```

- [ ] **Step 5: 커밋** (PowerShell)

```powershell
git add STATUS.md status/2026-10-10-gov-report-step3-ai.md
git commit -m @'
docs(status): 정부컨설팅 보고서 3단계 AI 초안 기록

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
'@
```

- push·PR 은 컨트롤러가 한다.

---

## 자기 점검 — 설계서 대조

| 설계서 | 작업 |
|---|---|
| §1 회차·종합 칸, 양식이 안 쓰는 칸 제외 | T1 `fieldsFor`(buildValues 대조 검사) · T2 `want` · T3 `applyDraft(fields)` |
| §2 보낸다(날짜·방문/사무·메모·사람 칸·메일 제목·본문 1,500자·서류 이름·작성기준·한도) | T2 `buildRequest` · T4 `grpAiMemos` |
| §2 안 보낸다(priv·첨부·이름) · 기술보호 날짜·메모만 · 가리기 | T1 `mask` · T2 · T4 검사 ①③ |
| §2 동의 `gov_ai_ok` | T4 `grpAiConsent` · 검사 ⑤ |
| §3 모델 순서·8000·90초·system 규칙·응답 꼴·재시도 | T2 `systemText`/`parseDraft` · T4 `grpAiCall`/`grpAiDraft` · 검사 ①⑤ |
| §4 넣는 칸·`src='ai'` 딱지·사람이 고치면 떼기·되돌리기·경고 셋·저장 안 함 | T3 · T4 `grpAiSync`/`grpAiUndo` · T5 `grpAiFoot`/`grpWarnings` · 검사 ②⑥⑦⑧ |
| §5 오류 여섯 | T4 `GRP_AI_MSG`·검사 ③④⑤ · T5 검사 ⑧⑨(비활성) |
| §6 만들 것·검사 | T1~T5 |
| §7 범위 밖 | 손대지 않음 |
