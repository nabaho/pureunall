# 컨설팅보고서 회차 기록 · 기준 점검 (설계 2-B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 대형 사업의 회차 서류(일터혁신 «회차별 수행보고서», 산업일자리 «MD별 수행일지») 칸 창에서 회차 기록(형태·시간·인원·사진/서명지 확보·MD·종류)을 남기고 기준 인정/미달을 보여 준다.

**Architecture:** 회차 기록은 서류 줄 `items/{key}` 의 새 자식 `rd` 로 **같은 `.set`**(`grSaveCell`) 안에 실린다. 기록 모듈(`PuGovReportTrack`)이 `rd` 를 읽고·자르고·이어받고, 새 순수 모듈 `PuGovReportCriteria` 가 인정/미달·합계를 계산한다. 화면은 칸 창에 입력과 «기준» 구역을 더한다. **새 Firebase 규칙이 필요**(`rd` 자식, 늘리기만) — 코드와 규칙 JSON 을 같이 만들고 게시는 합쳐진 뒤 `scripts/rules-deploy.js` 로 한다.

**Tech Stack:** 정적 HTML + 바닐라 JS(IIFE 브라우저·Node 겸용), Firebase RTDB 규칙(생성기 `scripts/make-firebase-rules.js`), `node --test`.

**Spec:** `docs/superpowers/specs/2026-10-12-gov-report-rounds-design.md`.

## Global Constraints

- **쓰기는 `scal_docs/{co}/{rid}/items/{key}` 줄 하나의 `.set`(`grSaveCell`) 한 곳** — `gov-report.html` 에 새 `.set(`·`.update(`·`.push(`·`.remove(`·`.transaction(` 금지. 새 필드는 `rd`(그 아래 `mode·mins·people·photo·sign·md·kind`)뿐.
- `rd` 한계(규칙과 모듈이 같아야 한다): `mode` ∈ `face|remote`(필수) · `mins` 정수 0..600 · `people` 정수 0..99 · `photo`·`sign` boolean · `md` 0..5 이고 0.5 단위 · `kind` ∈ `visit|report|research` · `$other:false`.
- 기준 수치(정리본 기준 초안 **[노무사 확인]**): 일터혁신 — 회의 120분 이상 · 참석 3명 이상 · 사진 ✓ · 서명지 ✓ · 대면 비율 70% 이상. 산업일자리 — 비대면 보고서 MD 4 이하 · 비대면 자료조사 MD 2 이하. 점검은 알림일 뿐 제출을 막지 않는다.
- 파일·이름·서명 이미지를 저장하지 않는다(확보 여부·인원 수만). 개인 자료·AI 없음.
- 간단형·기존 칸 창·`link`·`note`·`ack`·`how` 동작과 기존 검사는 그대로. `rd` 는 `rd` 항목(칸 창에 «회차 기록»이 열린 항목)에서만 DOM 값을 읽고, 그 밖의 저장은 옛 `rd` 를 이어 받는다.
- 값은 `grEsc`. 공개 저장소 — 합성 이름만. 검사에 `?v=숫자` 금지(`\?v=\d+` 정규식), 바뀐 스크립트는 `?v` 올림(훅 `scripts/check-cache-version.js`, `--no-verify` 금지). 새 `<script>` 는 `?v=1`. `gov-report.html` 은 부분 편집·줄바꿈 보존.
- 규칙 게시(`--deploy`)는 이 계획 범위 밖 — 계획 실행자는 **규칙 JSON 만 생성**하고 게시하지 않는다(합친 뒤 컨트롤러가 한다). 규칙을 바꾸면 `tests/photos-staff-share.test.js` 의 `PENDING` 목록에 `'/scal_docs/$co/$rid/items/$key/rd'` 를 더한다(게시 뒤 비운다 — 기존 방식).

## Review Focus

- `rd` 값이 범위 밖·소수·문자열·`__proto__` 키면 버린다/거절한다 — Task 1·3 검사.
- 70% 경계: 대면 7/10 = 인정, 대면 69/100 = 미달 — Task 2 검사.
- 기록이 0건이면 «점검할 기록 없음»(오류·NaN 없음) — Task 2 검사.
- `rd` 입력이 비어 있는데 저장해도 옛 `rd` 가 지워지지 않는다 — Task 4 검사.
- 규칙 JSON 이 모듈 한계(600·99·5·enum)와 같다 — Task 3 검사.

---

## File Structure

| 파일 | 일 |
|---|---|
| `js/pu-gov-report-track.js` (수정) | `normRd`·`nextRd`, `normalize`/`patchFor`/`validate` 에 `rd`, 상수 |
| `js/pu-gov-report-criteria.js` (신설) | `roundCheck`·`summary`·상수 |
| `js/pu-gov-report-docs.js` (수정) | 항목 `rd`·`criteria` 플래그 |
| `scripts/make-firebase-rules.js`, `docs/firebase-rules-전체-적용본.json`, `docs/rules-paste.json` (수정) | `rd` 규칙 |
| `gov-report.html` (수정) | 칸 창 «회차 기록»·«기준» 구역, `grSaveCell` 에 `rd` |
| 대응 `tests/*.test.js`, `STATUS.md`, `status/2026-10-12-gov-report-rounds.md` | 검사·기록 |

---

### Task 1: 기록 모듈 — `rd` 읽기·자르기·이어받기

**Files:** Modify `js/pu-gov-report-track.js`, `tests/gov-report-track.test.js`

**Interfaces:**
- Produces (`PuGovReportTrack`): `normRd(rd) → obj|null`, `nextRd(prev, op) → obj|null`, 상수 `RD_MINS_MAX=600`, `RD_PEOPLE_MAX=99`, `RD_MD_MAX=5`, `RD_MODE=['face','remote']`, `RD_KIND=['visit','report','research']`. `normalize` 결과 줄에 `rd`(올바르면), `patchFor(entry, who, now)` 결과에 `entry.rd`(올바르면), `validate(entry, step)` 가 `entry.rd != null && !normRd(entry.rd)` 이면 `RD_BAD` 글.

- [ ] **Step 1: 실패하는 검사** — `tests/gov-report-track.test.js` 끝에(앞 `require` 이름 확인):

```js
test('rd — 값 자르기·범위·이상한 값', () => {
  assert.deepEqual(T.normRd({ mode: 'face', mins: 120, people: 3, photo: true, sign: true }), { mode: 'face', mins: 120, people: 3, photo: true, sign: true });
  assert.deepEqual(T.normRd({ mode: 'remote' }), { mode: 'remote' });
  assert.deepEqual(T.normRd({ mode: 'face', md: 1.5, kind: 'report' }), { mode: 'face', md: 1.5, kind: 'report' });
  assert.equal(T.normRd(null), null);
  assert.equal(T.normRd({}), null, 'mode 필수');
  assert.equal(T.normRd({ mode: 'zoom' }), null);
  assert.equal(T.normRd([]), null);
  assert.deepEqual(T.normRd({ mode: 'face', mins: 601 }), { mode: 'face' }, '범위 밖 숫자는 버린다');
  assert.deepEqual(T.normRd({ mode: 'face', mins: 90.5, people: -1, md: 0.3, kind: 'x', photo: 'yes' }), { mode: 'face' });
  assert.deepEqual(T.normRd({ mode: 'face', mins: '120', people: '3' }), { mode: 'face' }, '문자열 숫자는 받지 않는다');
  assert.deepEqual(T.normRd({ mode: 'face', mins: 0, people: 0, md: 0 }), { mode: 'face', mins: 0, people: 0, md: 0 }, '0 은 값이다');
  assert.deepEqual(T.normRd({ mode: 'face', photo: false, sign: false }), { mode: 'face', photo: false, sign: false });
  const evil = JSON.parse('{"mode":"face","__proto__":{"x":1},"constructor":2}');
  assert.deepEqual(T.normRd(evil), { mode: 'face' });
  assert.equal(({}).x, undefined);
});

test('nextRd — 올바른 op.rd 는 그것, 아니면 옛 줄 것, 지우기 없음', () => {
  const prev = { st: 'doing', rd: { mode: 'face', mins: 90 } };
  assert.deepEqual(T.nextRd(prev, { rd: { mode: 'remote', mins: 60 } }), { mode: 'remote', mins: 60 });
  assert.deepEqual(T.nextRd(prev, undefined), { mode: 'face', mins: 90 });
  assert.deepEqual(T.nextRd(prev, {}), { mode: 'face', mins: 90 });
  assert.deepEqual(T.nextRd(prev, { rd: null }), { mode: 'face', mins: 90 }, '지우기 없음');
  assert.deepEqual(T.nextRd(prev, { rd: { mode: 'zoom' } }), { mode: 'face', mins: 90 }, '틀린 값은 옛 줄');
  assert.equal(T.nextRd(null, undefined), null);
  assert.equal(T.nextRd({ st: 'none' }, {}), null);
});

test('rd — normalize·patchFor·validate 에 실린다', () => {
  const raw = { cb: { r1: { items: { 'round:1': { st: 'done', at: 1, rd: { mode: 'face', mins: 130, people: 4, photo: true, sign: true, x: 1 } } } } } };
  assert.deepEqual(T.normalize(raw).cb.r1['round:1'].rd, { mode: 'face', mins: 130, people: 4, photo: true, sign: true });
  const base = { st: 'done', note: '', sentAt: '', gotAt: '', how: '', ack: false, link: null };
  const p = T.patchFor(Object.assign({}, base, { rd: { mode: 'face', mins: 130 } }), 'x', 5);
  assert.deepEqual(p.rd, { mode: 'face', mins: 130 });
  assert.equal(T.patchFor(base, 'x', 5).rd, undefined, 'rd 없으면 키도 없다');
  assert.equal(T.validate(Object.assign({}, base, { rd: { mode: 'face', mins: 130 } }), 'plat'), '');
  assert.equal(T.validate(Object.assign({}, base, { rd: { mode: 'zoom' } }), 'plat'), T.RD_BAD);
  assert.equal(T.validate(Object.assign({}, base, { rd: null }), 'plat'), '', 'null 은 «없음»');
  assert.deepEqual([T.RD_MINS_MAX, T.RD_PEOPLE_MAX, T.RD_MD_MAX], [600, 99, 5]);
  assert.deepEqual(T.RD_MODE, ['face', 'remote']);
  assert.deepEqual(T.RD_KIND, ['visit', 'report', 'research']);
});
```

- [ ] **Step 2: 실패 확인** — `node --test tests/gov-report-track.test.js` → 새 검사 FAIL.

- [ ] **Step 3: 구현** — `js/pu-gov-report-track.js`:

상수(26행 근처, `LINK_*` 옆): `var RD_MINS_MAX = 600, RD_PEOPLE_MAX = 99, RD_MD_MAX = 5, RD_MODE = ['face', 'remote'], RD_KIND = ['visit', 'report', 'research']; var RD_BAD = '회차 기록 값이 올바르지 않습니다';`

`nextLink` 뒤:

```js
  /* 회차 기록 — 틀리면 null(줄은 남긴다). mode 필수, 나머지는 범위 안 값만 */
  function isInt(v, max) { return typeof v === 'number' && isFinite(v) && Math.floor(v) === v && v >= 0 && v <= max; }
  function normRd(r) {
    if (!obj(r) || RD_MODE.indexOf(r.mode) < 0) return null;
    var o = { mode: r.mode };
    if (isInt(r.mins, RD_MINS_MAX)) o.mins = r.mins;
    if (isInt(r.people, RD_PEOPLE_MAX)) o.people = r.people;
    if (r.photo === true || r.photo === false) o.photo = r.photo;
    if (r.sign === true || r.sign === false) o.sign = r.sign;
    if (typeof r.md === 'number' && isFinite(r.md) && r.md >= 0 && r.md <= RD_MD_MAX && Math.round(r.md * 2) === r.md * 2) o.md = r.md;
    if (typeof r.kind === 'string' && RD_KIND.indexOf(r.kind) >= 0) o.kind = r.kind;
    return o;
  }
  /* 저장할 때 실을 회차 기록 — op.rd 가 올바르면 그것, 그 밖(없음·null·틀림)은 옛 줄의 것(지우는 길은 없다) */
  function nextRd(prev, op) {
    if (obj(op) && has(op, 'rd')) { var n = normRd(op.rd); if (n) return n; }
    return obj(prev) ? normRd(prev.rd) : null;
  }
```
`normRec` 의 `link` 처리 뒤: `var rd = normRd(r.rd); if (rd) o.rd = rd;`. `patchFor` 의 link 처리 뒤: `var rd = normRd(e.rd); if (rd) o.rd = rd;`. `validate` 의 link 검사 뒤: `if (e.rd != null && !normRd(e.rd)) return RD_BAD;`. 공개 객체에 `normRd, nextRd, RD_MINS_MAX, RD_PEOPLE_MAX, RD_MD_MAX, RD_MODE, RD_KIND, RD_BAD`. 파일 머리 주석에 «회차 기록 rd(2026-10-12, 설계 2-B)» 한 줄.

- [ ] **Step 4: 통과 확인** — `node --test tests/gov-report-track.test.js tests/gov-report-app.test.js tests/gov-report-docs.test.js` PASS. `gov-report.html` 의 `pu-gov-report-track.js?v=` 번호를 +1(훅이 요구).
- [ ] **Step 5: Commit** — `git add js/pu-gov-report-track.js tests/gov-report-track.test.js gov-report.html` · 메시지 `feat(gov-report): 회차 기록 rd — 읽기·자르기·이어받기 (기록 모듈)` + Co-Authored-By.

---

### Task 2: 기준 점검 순수 모듈 `PuGovReportCriteria`

**Files:** Create `js/pu-gov-report-criteria.js`, `tests/gov-report-criteria.test.js`

**Interfaces:**
- Produces (`window.PuGovReportCriteria` / `module.exports`): 상수 `WP_MIN_MINS=120`, `WP_MIN_PEOPLE=3`, `WP_FACE_PCT=70`, `IND_REMOTE_REPORT_MD=4`, `IND_REMOTE_RESEARCH_MD=2`, `KEYS=['workplace','industry']`; `roundCheck(planKey, rd) → {state:'none'|'ok'|'miss', miss:string[]}`; `summary(planKey, list, planned) → object|null` — `list` 는 `rd` 배열(없는 회차는 제외).

- [ ] **Step 1: 실패하는 검사** — `tests/gov-report-criteria.test.js`:

```js
'use strict';
/* 컨설팅보고서 — 회차 기준 점검 (설계 2-B). 수치는 정리본 기준 초안 [노무사 확인]. 합성 자료만. */
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/pu-gov-report-criteria.js');

test('상수', () => {
  assert.deepEqual([C.WP_MIN_MINS, C.WP_MIN_PEOPLE, C.WP_FACE_PCT, C.IND_REMOTE_REPORT_MD, C.IND_REMOTE_RESEARCH_MD], [120, 3, 70, 4, 2]);
  assert.deepEqual(C.KEYS, ['workplace', 'industry']);
});

test('roundCheck(workplace) — 인정 · 미달 사유', () => {
  assert.deepEqual(C.roundCheck('workplace', { mode: 'face', mins: 120, people: 3, photo: true, sign: true }), { state: 'ok', miss: [] });
  const m = C.roundCheck('workplace', { mode: 'face', mins: 119, people: 2, photo: false, sign: false });
  assert.equal(m.state, 'miss');
  assert.deepEqual(m.miss, ['회의 2시간 미만(119분)', '참석 3명 미만(2명)', '시작·종료 사진 없음', '서명지 없음']);
  const blank = C.roundCheck('workplace', { mode: 'remote' });
  assert.equal(blank.state, 'miss');
  assert.deepEqual(blank.miss, ['회의 시간 없음', '참석 인원 없음', '시작·종료 사진 없음', '서명지 없음']);
  assert.deepEqual(C.roundCheck('workplace', null), { state: 'none', miss: [] });
  assert.deepEqual(C.roundCheck('workplace', {}), { state: 'none', miss: [] });
});

test('roundCheck(industry) — MD 와 종류가 있어야 인정', () => {
  assert.deepEqual(C.roundCheck('industry', { mode: 'face', md: 1, kind: 'visit' }), { state: 'ok', miss: [] });
  assert.deepEqual(C.roundCheck('industry', { mode: 'remote', kind: 'report' }).miss, ['MD 없음']);
  assert.deepEqual(C.roundCheck('industry', { mode: 'remote', md: 1 }).miss, ['종류 없음']);
  assert.equal(C.roundCheck('other', { mode: 'face' }).state, 'none', '점검 기준이 없는 사업');
  assert.equal(C.roundCheck('__proto__', { mode: 'face' }).state, 'none');
});

test('summary(workplace) — 대면 비율 70% 경계 · 인정 회차 · 계획 대비', () => {
  const ok = { mode: 'face', mins: 130, people: 4, photo: true, sign: true };
  const list7 = [].concat(Array(7).fill(ok), Array(3).fill({ mode: 'remote', mins: 130, people: 4, photo: true, sign: true }));
  const s = C.summary('workplace', list7, 12);
  assert.deepEqual([s.recorded, s.qualified, s.face, s.remote, s.facePct, s.faceOk, s.planned], [10, 10, 7, 3, 70, true, 12]);
  const f69 = [].concat(Array(69).fill(ok), Array(31).fill({ mode: 'remote' }));
  const s69 = C.summary('workplace', f69, 0);
  assert.equal(s69.facePct, 69);
  assert.equal(s69.faceOk, false);
  assert.equal(s69.qualified, 69);
  assert.deepEqual(C.summary('workplace', [], 5), { key: 'workplace', recorded: 0, qualified: 0, face: 0, remote: 0, facePct: null, faceOk: null, planned: 5 });
  assert.equal(C.summary('other', [ok], 1), null);
});

test('summary(industry) — MD 합계 · 비대면 보고서·자료조사 한도', () => {
  const l = [
    { mode: 'face', md: 1, kind: 'visit' }, { mode: 'remote', md: 2, kind: 'report' }, { mode: 'remote', md: 2.5, kind: 'report' },
    { mode: 'remote', md: 2, kind: 'research' }, { mode: 'remote', md: 0.5, kind: 'research' },
  ];
  const s = C.summary('industry', l, 15);
  assert.deepEqual([s.recorded, s.md, s.remoteReportMd, s.remoteResearchMd, s.reportOk, s.researchOk, s.planned], [5, 8, 4.5, 2.5, false, false, 15]);
  const s2 = C.summary('industry', [{ mode: 'remote', md: 4, kind: 'report' }, { mode: 'remote', md: 2, kind: 'research' }], 0);
  assert.deepEqual([s2.reportOk, s2.researchOk], [true, true], '4MD·2MD 는 한도 안');
  assert.deepEqual(C.summary('industry', [], 0), { key: 'industry', recorded: 0, md: 0, remoteReportMd: 0, remoteResearchMd: 0, reportOk: true, researchOk: true, planned: 0 });
});
```

- [ ] **Step 2: 실패 확인** — `node --test tests/gov-report-criteria.test.js` → FAIL (모듈 없음).

- [ ] **Step 3: 구현** — `js/pu-gov-report-criteria.js`:

```js
'use strict';
/* 컨설팅보고서 앱 — 회차 기준 점검 (브라우저 window.PuGovReportCriteria / Node 겸용 · 대표 지시 2026-10-12
   · 설계 docs/superpowers/specs/2026-10-12-gov-report-rounds-design.md · 계획 docs/superpowers/plans/2026-10-12-gov-report-rounds.md)
   무엇을 지키나
     · 순수 함수만 — 읽기·쓰기·화면은 몫이 아니다. 점검은 «알림»일 뿐 제출을 막지 않는다.
     · 수치는 정리본(컨설팅보고서_사업별_양식·항목_정리) 기준 초안 [노무사 확인]: 일터혁신 — 회의 120분 이상·참석 3명 이상·
       시작·종료 사진·서명지·대면 70% 이상 / 산업일자리 — 비대면 보고서 4MD·자료조사 2MD 까지.
     · 사진·서명 «파일»은 모른다 — 확보 여부(photo·sign)만 본다.
   ⚠ 저장소는 공개다 — 검사는 합성 자료만 쓴다. */
(function (root) {
  var isNode = typeof module !== 'undefined' && module.exports;
  var WP_MIN_MINS = 120, WP_MIN_PEOPLE = 3, WP_FACE_PCT = 70, IND_REMOTE_REPORT_MD = 4, IND_REMOTE_RESEARCH_MD = 2;
  var KEYS = ['workplace', 'industry'];

  function isKey(k) { return typeof k === 'string' && KEYS.indexOf(k) >= 0; }
  function obj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
  function num(v) { return typeof v === 'number' && isFinite(v) ? v : null; }

  function roundCheck(planKey, rd) {
    if (!isKey(planKey) || !obj(rd) || (rd.mode !== 'face' && rd.mode !== 'remote')) return { state: 'none', miss: [] };
    var miss = [];
    if (planKey === 'workplace') {
      var m = num(rd.mins), p = num(rd.people);
      if (m === null) miss.push('회의 시간 없음'); else if (m < WP_MIN_MINS) miss.push('회의 2시간 미만(' + m + '분)');
      if (p === null) miss.push('참석 인원 없음'); else if (p < WP_MIN_PEOPLE) miss.push('참석 3명 미만(' + p + '명)');
      if (rd.photo !== true) miss.push('시작·종료 사진 없음');
      if (rd.sign !== true) miss.push('서명지 없음');
    } else {
      if (num(rd.md) === null) miss.push('MD 없음');
      if (typeof rd.kind !== 'string') miss.push('종류 없음');
    }
    return { state: miss.length ? 'miss' : 'ok', miss: miss };
  }

  function summary(planKey, list, planned) {
    if (!isKey(planKey)) return null;
    var rds = (Array.isArray(list) ? list : []).filter(function (r) { return obj(r) && (r.mode === 'face' || r.mode === 'remote'); });
    var pl = Math.max(+planned || 0, 0);
    if (planKey === 'workplace') {
      var face = rds.filter(function (r) { return r.mode === 'face'; }).length, remote = rds.length - face;
      var q = rds.filter(function (r) { return roundCheck('workplace', r).state === 'ok'; }).length;
      var pct = rds.length ? Math.floor(face * 100 / rds.length) : null;
      return { key: 'workplace', recorded: rds.length, qualified: q, face: face, remote: remote, facePct: pct, faceOk: pct === null ? null : pct >= WP_FACE_PCT, planned: pl };
    }
    var md = 0, rep = 0, res = 0;
    rds.forEach(function (r) {
      var v = num(r.md) || 0;
      md += v;
      if (r.mode === 'remote' && r.kind === 'report') rep += v;
      if (r.mode === 'remote' && r.kind === 'research') res += v;
    });
    return { key: 'industry', recorded: rds.length, md: md, remoteReportMd: rep, remoteResearchMd: res,
      reportOk: rep <= IND_REMOTE_REPORT_MD, researchOk: res <= IND_REMOTE_RESEARCH_MD, planned: pl };
  }

  var api = { WP_MIN_MINS: WP_MIN_MINS, WP_MIN_PEOPLE: WP_MIN_PEOPLE, WP_FACE_PCT: WP_FACE_PCT, IND_REMOTE_REPORT_MD: IND_REMOTE_REPORT_MD,
    IND_REMOTE_RESEARCH_MD: IND_REMOTE_RESEARCH_MD, KEYS: KEYS, roundCheck: roundCheck, summary: summary };
  if (isNode) module.exports = api;
  else root.PuGovReportCriteria = api;
})(typeof window !== 'undefined' ? window : globalThis);
```
(테스트의 `facePct` 69 경계: 69/100 → floor(69) = 69 → 미달, 7/10 → 70 → 인정. `Math.floor(face*100/n)` 이다.)

- [ ] **Step 4: 통과 확인** — `node --test tests/gov-report-criteria.test.js` PASS.
- [ ] **Step 5: Commit** — `git add js/pu-gov-report-criteria.js tests/gov-report-criteria.test.js` · `feat(gov-report): 회차 기준 점검 순수 모듈 (일터혁신·산업일자리)` + Co-Authored-By.

---

### Task 3: 규칙(`rd`)·서류 틀 플래그

**Files:** Modify `scripts/make-firebase-rules.js`, `docs/firebase-rules-전체-적용본.json`, `docs/rules-paste.json`(생성기로 다시 만든다), `tests/gov-report-rules.test.js`, `tests/photos-staff-share.test.js`(`PENDING`), `js/pu-gov-report-docs.js`, `tests/gov-report-docs.test.js`, `gov-report.html`(docs 스크립트 `?v` 올림)

**Interfaces:** Consumes Task 1 의 한계 상수. Produces: 규칙 `items/$key/rd`, `DOC_PLANS` 항목 플래그 `rd: true` + 계획 최상위 `criteria: 'workplace'|'industry'`(대형 두 계획만).

- [ ] **Step 1: 실패하는 검사** — `tests/gov-report-rules.test.js` 끝(앞의 `link` 규칙 검사를 읽어 같은 방식으로 규칙 객체·생성기 접근 코드를 쓴다):
  1. 규칙 JSON `scal_docs/$co/$rid/items/$key/rd` 가 있고 `.validate` 에 `hasChildren(['mode'])`.
  2. `mode`/`kind` 정규식 열거가 `Tr.RD_MODE`·`Tr.RD_KIND` 와 같고, `mins`·`people`·`md` 상한이 `Tr.RD_MINS_MAX`(600)·`Tr.RD_PEOPLE_MAX`(99)·`Tr.RD_MD_MAX`(5) 와 같다(규칙 문자열에서 숫자를 읽어 비교).
  3. `photo`·`sign` 은 boolean, `rd` 아래 `$other` 는 `false`.
  4. 두 규칙 JSON(`전체-적용본`·`rules-paste`)이 같은 `rd` 를 가진다.
  `tests/gov-report-docs.test.js` 끝: `DOC_PLANS` 에서 `rd:true` 항목은 `workplace.round`·`industry.mdlog` 둘뿐, 그 계획의 `criteria` 가 각각 `'workplace'`·`'industry'`, 나머지 계획에는 `criteria` 가 없다.
- [ ] **Step 2: 실패 확인** — `node --test tests/gov-report-rules.test.js tests/gov-report-docs.test.js` FAIL.
- [ ] **Step 3: 구현**
  - `scripts/make-firebase-rules.js` 의 `scal_docs` 줄 `link` 자식 옆(줄 `$other:false` 앞)에 추가:

```js
          /* 회차 기록 (2026-10-12, 설계 docs/superpowers/specs/2026-10-12-gov-report-rounds-design.md §4)
             일터혁신 회차별 수행보고서·산업일자리 MD별 수행일지의 형태·시간·인원·증빙 확보 여부·MD. 파일·이름은 담지 않는다.
             ★ 화면 모듈 RD_*(js/pu-gov-report-track.js)와 같은 값 — tests/gov-report-rules.test.js.
             ⚠ 게시는 합쳐진 뒤. 게시 전에는 줄의 $other:false 때문에 rd 가 든 저장이 통째로 거절된다(rd 없는 저장은 그대로). */
          rd: {
            '.validate': "newData.hasChildren(['mode'])",
            mode:   { '.validate': "newData.isString() && newData.val().matches(/^(face|remote)$/)" },
            mins:   { '.validate': 'newData.isNumber() && newData.val() >= 0 && newData.val() <= 600 && newData.val() % 1 === 0' },
            people: { '.validate': 'newData.isNumber() && newData.val() >= 0 && newData.val() <= 99 && newData.val() % 1 === 0' },
            photo:  { '.validate': 'newData.isBoolean()' },
            sign:   { '.validate': 'newData.isBoolean()' },
            md:     { '.validate': 'newData.isNumber() && newData.val() >= 0 && newData.val() <= 5 && (newData.val() * 2) % 1 === 0' },
            kind:   { '.validate': "newData.isString() && newData.val().matches(/^(visit|report|research)$/)" },
            $other: { '.validate': false }
          },
```
  - 생성기를 돌려 두 JSON 을 다시 만든다(저장소 방식 — 인자 없이 `node scripts/make-firebase-rules.js` 또는 기존 npm 스크립트; 기존 PR(`chore/gov-report-inbox…` 등)이 했던 방식을 `git log -p -- docs/rules-paste.json` 으로 확인). **`--deploy` 는 하지 않는다.** `tests/photos-staff-share.test.js` 의 `const PENDING = [];` 를 `['/scal_docs/$co/$rid/items/$key/rd']` 로(주석에 «2026-10-12 게시 전» 한 줄).
  - `js/pu-gov-report-docs.js`: 대형 `workplace`·`industry` 계획 객체에 `criteria: 'workplace'`·`'industry'`, `it('round', …, { …기존, rd: true })` 와 `it('mdlog', …, { …기존, rd: true })` — `it()` 의 `extra` 가 `rd` 를 받게(`if (extra.rd) o.rd = true;`). 기존 `id·name·per·step·steps·note` 는 그대로.
  - `gov-report.html` 의 docs 스크립트 `?v` +1.
- [ ] **Step 4: 통과 확인** — `node --test tests/gov-report-*.test.js tests/photos-staff-share.test.js tests/test-pin-guard.test.js` PASS (규칙 JSON 일치 검사 포함).
- [ ] **Step 5: Commit** — `git add scripts/make-firebase-rules.js docs/firebase-rules-전체-적용본.json docs/rules-paste.json tests/gov-report-rules.test.js tests/photos-staff-share.test.js js/pu-gov-report-docs.js tests/gov-report-docs.test.js gov-report.html` · `feat(gov-report): 회차 기록 rd 규칙(생성만, 게시 전)·서류 틀 플래그` + Co-Authored-By.

---

### Task 4: 화면 — «회차 기록»·«기준» 구역과 저장

**Files:** Modify `gov-report.html`, `tests/gov-report-app.test.js`

**Interfaces:** Consumes `PuGovReportTrack.nextRd/normRd/RD_*`, `PuGovReportCriteria.roundCheck/summary`, 항목 플래그 `item.rd`·계획 `criteria`(Task 3), 기존 `grOpenCell`·`GR.cw`·`grRenderCell`·`grRenderSend`·`grSaveCell`·`grEsc`. Produces: `GR.cw.rd`(그 칸 창이 `rd` 항목인지), 칸 창 «회차 기록» 입력(`#cwRdMode #cwRdMins #cwRdPeople #cwRdPhoto #cwRdSign` + 산업일자리 `#cwRdMd #cwRdKind`), «기준» 구역 `#cwCrit`, `grRenderCrit()`, `grReadRd()`.

설계(코드는 구현자가 기존 칸 창 코드를 읽고 맞춘다 — 값·동작은 아래가 정한다):
- `grOpenCell`: 항목 플래그 `rd`·`criteria` 를 `GR.cw.rd`(boolean)·`GR.cw.crit`(계획 `criteria` 글)로 담는다(`plan` 은 `D.planFor(erp.name)`, 항목은 `itemId` 로 찾기).
- `grRenderCell`: `c.rd` 이면 «회차 기록» 필드(형태 `<select>` 없음/대면/비대면, 시간(분) 숫자, 참석 인원 숫자, 사진 ✓ 체크, 서명지 ✓ 체크; `c.crit==='industry'` 이면 MD(0.5 단위 숫자)·종류 `<select>`)를 «메모» 칸 앞에 그린다. 값은 그 회차 줄의 저장된 `rd`(없으면 빈 값)이고, 입력 중 값은 `c.draft` 로 보존(기존 방식 따름). 그 밑에 `<div id="cwCrit"></div>`. 끝에서 `grRenderCrit()`.
- `grReadRd()`: `#cwRdMode` 가 비었으면 `null`; 아니면 `{mode, mins?, people?, photo, sign, md?, kind?}` — 숫자 칸이 빈 글이면 그 키를 뺀다(숫자로 바꾼 값), 체크는 boolean.
- `grSaveCell`: 기존 entry 만들기 뒤 `entry.rd = T.nextRd(T.recOf(GR.track||{},c.coId,c.rid)[c.key]||null, c.rd ? {rd: grReadRd()} : undefined)` — `rd` 항목에서 입력이 비어 있으면(`null`) 옛 `rd` 이어받기. `validate`(`RD_BAD`)로 범위 밖 숫자는 저장 전에 안내(`c.msg`).
- `grRenderCrit`: `c.crit` 가 있을 때만. 그 업체·rid 의 이 항목 모든 회차 키의 저장된 `rd` 를 모아(`T.recOf(...)[k.key].rd`), 지금 입력 중 회차 값은 `grReadRd()` 로 바꿔 넣어 `C.summary(c.crit, list, planned)` 와 현재 회차 `C.roundCheck(c.crit, rd)` 를 보인다. 글: 「기준 점검 — 알림일 뿐입니다」 · 현재 회차 «인정»/«미달: 사유…» · 일터혁신 «기록 N회차 · 인정 N · 대면 N%(기준 70%) · 계획 N회차», 산업일자리 «MD 합계 N · 비대면 보고서 N MD(한도 4) · 자료조사 N MD(한도 2)» — 기준을 못 맞추면 `class="err-s"`. 기록 0건이면 「점검할 기록이 없습니다」. 모든 글은 `grEsc`. 입력이 바뀔 때(`oninput`/`onchange`)는 `#cwCrit` 만 다시 그린다(`grRenderCrit()`), 칸 창 전체를 다시 그리지 않는다.
- `grRenderCell`·`grRenderCrit` 어느 것도 `rd` 가 아닌 항목(`plat` 일반·`report`·`sign`·간단형)에는 아무것도 더하지 않는다.

- [ ] **Step 1: 실패하는 검사** — `tests/gov-report-app.test.js` 끝(설계 1·2-A 검사의 `world`/시드/`cellOf` 도우미 재사용, 중복 금지; 합성 일터혁신 시드 — 합성 업체 `다라정밀`, 회차 2~3개; 실제로 연결되는 입력으로, 침묵 우회 `if(...) return` 금지):
  1. 정적: 인라인 스크립트의 쓰기 명령은 여전히 `['.set(']` 하나뿐.
  2. 일터혁신 `round` 칸 창에 «회차 기록» 입력과 `#cwCrit` 가 있고, `plan`·`kickoff` 등 다른 항목 칸 창·간단형 칸 창에는 없다. 산업일자리 `mdlog` 칸 창에는 MD·종류 입력도 있다.
  3. 저장: 형태 «대면»·시간 130·인원 4·사진·서명지를 입력해 저장하면 `scal_docs/<co>/<rid>/items/round:1` 한 줄에 `rd:{mode:'face',mins:130,people:4,photo:true,sign:true}` 가 실리고, 미리 넣어 둔 `note`·`link` 가 보존된다.
  4. 입력이 비어 있는 채로 저장해도 기존 `rd` 가 지워지지 않는다(옛 `rd` 이어받기). `rd` 가 아닌 항목(`plan`) 저장은 `rd` 키를 만들지 않는다.
  5. 범위 밖(시간 601·인원 100)이면 쓰기 없이 `RD_BAD` 안내.
  6. «기준» 구역: 3개 회차 중 2개 기록(둘 다 대면·인정) → 「인정 2」 · 「대면 100%」; 미달 회차(시간 90)는 사유 「회의 2시간 미만(90분)」; 70% 경계(대면 7/비대면 3 → 인정, 6/4 → 「대면 60%」 `err-s`); 기록 0건이면 「점검할 기록이 없습니다」; 산업일자리 비대면 보고서 MD 4.5 → 한도 초과 `err-s`.
  7. 사업장 이름·메모에 `<script>` 가 있어도 «기준» 구역에서 이스케이프된다.
  8. 기록을 못 읽으면(`GR.trackErr`) 칸 창이 열리지 않는다(기존 동작 그대로).
- [ ] **Step 2: 실패 확인** — `node --test tests/gov-report-app.test.js` 새 검사 FAIL.
- [ ] **Step 3: 구현** — 위 «설계» 대로 `gov-report.html` 부분 편집(전체 재작성 금지, 줄바꿈 보존). 새 `<script src="js/pu-gov-report-criteria.js?v=1"></script>` 를 `pu-gov-report-send.js` 다음 줄에. `grOpenCell` 의 `GR.cw` 리터럴에 `rd`·`crit` 필드.
- [ ] **Step 4: 통과 확인** — `node --test tests/gov-report-*.test.js tests/photos-staff-share.test.js tests/test-pin-guard.test.js` PASS. 로그인 필요한 실제 화면은 확인할 수 없으므로 «실제 화면 미확인» 으로 적는다.
- [ ] **Step 5: Commit** — `git add gov-report.html tests/gov-report-app.test.js` · `feat(gov-report): 칸 창 회차 기록 입력·기준 점검 구역` + Co-Authored-By.

---

### Task 5: 기록

**Files:** Create `status/2026-10-12-gov-report-rounds.md`; Modify `STATUS.md`(줄 하나 추가 — 끝 줄 충돌이 잦으니 `git merge origin/main` 뒤 두 줄을 살린다), `docs/superpowers/specs/2026-10-12-gov-report-rounds-design.md`(구현과 다른 점이 있으면)

- [ ] 노트: 만든 것 · 쓰는 곳(`rd` 새 규칙 — **게시 대기**, 게시 전 `rd` 가 든 저장만 거절) · 못 한 것(실제 로그인 화면 확인 · 유형별 방문 인정 회수 목표 · 충남 지원센터·간단형 점검 · 사진/서명 파일 보관 · 제출 막기) · 수치는 정리본 기준 초안 [노무사 확인].
- [ ] 전체 검사: `node --test tests/gov-report-*.test.js tests/photos-staff-share.test.js tests/test-pin-guard.test.js tests/pu-hwp-preview.test.js` fail 0; `git diff --stat origin/main...HEAD` 가 File Structure 와 같은지.
- [ ] Commit — `docs(gov-report): 회차 기록·기준 점검 구현 기록` + Co-Authored-By.
