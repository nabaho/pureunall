# 컨설팅보고서 대형 사업 단계 체크표 (설계 2-A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 대형 사업(일터혁신 상생·산업일자리 중진공/KMAC·산업일자리 충남 지원센터)의 서류 틀 항목을 컨설팅보고서 앱 체크표의 «단계 열»로 열고, 단계별 상태·날짜·메모·받은 서류 연결을 기존 칸 창으로 기록하며, 「다음 단계」와 「막힌 단계」를 보이게 한다.

**Architecture:** 기록 모듈 `PuGovReportTrack` 을 단계 종류(`plat`·`report`)·항목 단위 키(`keysForItem`)·단계 칩(`bigCells`)·다음/막힘(`nextStage`·`blockedOf`)으로 넓히고, `PuGovReportDocs.docsTable`·`trackRows` 가 대형 틀이면 단계 열과 막힘 정보를 돌려준다. 화면(`gov-report.html`)은 단계 열 표·칸 창 진입(`itemId`)·체크 글·막힌 단계 알림만 더한다. 저장은 기존 `grSaveCell`(줄 하나 `.set`) 한 곳, **새 DB 칸·새 규칙 없음**.

**Tech Stack:** 정적 HTML + 바닐라 JS(IIFE 브라우저·Node 겸용), Firebase RTDB(기존 `scal_docs`), `node --test`.

**Spec:** `docs/superpowers/specs/2026-10-11-gov-report-big-stages-design.md` (PR #2536, 합쳐짐).

## Global Constraints

- **쓰기는 `scal_docs/{co}/{rid}/items/{key}` 줄 하나의 `.set`(`grSaveCell`) 한 곳** — `gov-report.html` 에 새 `.set(`·`.update(`·`.push(`·`.remove(`·`.transaction(` 금지. 새 필드·새 Firebase 규칙·게시 없음. 줄 키는 규칙 식 `^[a-z]+(:[0-9]+)?$` 이고 20자 이하(`KEY_RE`·`KEY_MAX`).
- 간단형(충남북부·서산·기술보호·현장클리닉·농촌융복합) 체크표·칸 창·알림·막대·`docsTable` 출력은 **그대로**(스냅숏 동일). 대형 틀(`plan.kind === '대형'`)에서만 새 동작.
- 「다음 단계」는 표시일 뿐 — 순서를 강제하지 않는다. 기한을 만들지 않는다. 월별 서류 키는 계약 기간(없으면 회차 날짜)의 «달 수», 상한 `MAX_ROUNDS`(60).
- AI 호출 없음, 메일 자동 발송 없음, 플랫폼 자동 입력 없음(체크 글만). 설계 1 의 서명 요청 메일은 `step:'sign'` 단계에서 **그대로** 나온다.
- 값은 `grEsc` 로 이스케이프해 HTML 에 넣는다(체크 글·메모 포함). 공유 상수 배열(`item.steps`)을 바꾸지 않는다.
- **공개 저장소**: 코드·검사·문서·상수 글에 고객사·사람 이름·연락처·실제 주소를 쓰지 않는다(합성 `다라정밀`·`가나상사`·`example.com`).
- 검사에 스크립트 캐시 번호(`?v=숫자`)를 박지 않는다(`tests/test-pin-guard.test.js` 가 잡는다) — `\?v=\d+` 정규식으로 «붙어 있는지»만 본다. 바뀐 스크립트는 `?v` 를 올린다(커밋 훅 `scripts/check-cache-version.js` 가 강제, `--no-verify` 금지).
- `gov-report.html` 은 부분 편집만(전체 재작성 금지), 줄바꿈 보존.

## Review Focus

- `per:'month'` 항목인데 계약 기간도 회차 날짜도 없다 → 키 0개, 칸은 «—»(오류 없음) — Task 1·2 검사.
- 항목 `id` 가 이상하다(`__proto__`·대문자·21자 이상) → 키를 만들지 않는다 — Task 1 검사.
- 대형 틀 대형 3종의 모든 키(`id`, `id:회차`, `id:월`)가 규칙 식·20자 한도를 통과 — Task 1 검사.
- 간단형 `docsTable`·`trackRows` 결과가 바뀌지 않는다 — Task 2 검사(기존 검사 그대로 통과 + 대형 아닌 틀에 `big` 가 없음).
- 기록을 못 읽었을 때(`GR.trackErr`) 대형 단계 칸은 칩 대신 「?」이고 칸 창이 열리지 않는다 — Task 3 검사.
- 체크 글·메모·사업장 이름에 `<script>`·따옴표가 들어와도 이스케이프된다 — Task 3 검사.

---

## File Structure

| 파일 | 일 |
|---|---|
| `js/pu-gov-report-track.js` (수정) | `plat`/`report` 단계 종류, `keysForItem`, `bigCells`, `nextStage`, `blockedOf`, `alertsExtra.blocked` |
| `js/pu-gov-report-docs.js` (수정) | 대형 항목 `steps`/`note` 상수, `monthsFor`, `docsTable` 대형 분기, `trackRows` 대형 분기 |
| `gov-report.html` (수정) | 대형 단계 열 표, `data-item` 클릭, `grOpenCell(...,itemId)`, 칸 창 완료일·체크 글, 「막힌 단계」 알림 |
| `tests/gov-report-track.test.js`, `tests/gov-report-docs.test.js`, `tests/gov-report-app.test.js`, `tests/gov-report-rules.test.js` (수정) | 위 검사 |
| `STATUS.md`, `status/2026-10-11-gov-report-big-stages.md` | 기록 |

---

### Task 1: 기록 모듈 — 단계 종류·항목 키·단계 칩·다음/막힘

**Files:**
- Modify: `js/pu-gov-report-track.js` (상수 19~26행, `keysFor` 49행 뒤, `chipOf` 147행 근처, `alertsExtra` 196행, 공개 객체 233행)
- Modify: `tests/gov-report-track.test.js`, `tests/gov-report-rules.test.js`

**Interfaces:**
- Consumes: 기존 `keyOf(item, round)`, `okKey`, `chipOf(step, keys, rec, today)`, `stateOf(sts)`, `recOf`, `normalize`, `MAX_ROUNDS`, 계획 항목 `{id,name,per,step}`.
- Produces (`PuGovReportTrack`):
  - `ALLOWED.plat`·`ALLOWED.report` = `['none','doing','done','blocked','na']`, `COL_KO.plat='플랫폼 입력'`·`COL_KO.report='보고서'`, `label('plat','doing')==='◐ 입력 중'` 등.
  - `keysForItem(plan, itemId, n, months) → [{key, id, name, round, month?}]` — `n` = 회차 수, `months` = `['YYYY-MM',…]`.
  - `bigCells(plan, rec, n, months, today) → [{id, name, step, chip:{txt,key}|null, st}]` (`chip` 가 `null` = 키 없음).
  - `nextStage(plan, rec, n, months) → {id, name} | null`.
  - `blockedOf(plan, rec, n, months) → [{id, key, name, note}]`.
  - `alertsExtra(rows, today) → {waitSign, overdue, blocked}` — `blocked` 는 `[{row, items:[{name,note}]}]`(`row.trk.blocked` 가 비지 않은 줄만).

- [ ] **Step 1: 실패하는 검사 쓰기** — `tests/gov-report-track.test.js` 맨 끝에 덧붙인다(파일 앞의 `require` 이름을 먼저 읽어 같은 이름을 쓴다 — 기록 모듈은 `T` 또는 `Tr` 일 수 있다. 아래는 `T` 로 적었으니 맞춘다).

```js
const BIGPLAN = { key: 'big', kind: '대형', items: [
  { id: 'guide', name: '참여 안내서', per: 'once', step: 'sign' },
  { id: 'plan', name: '수행계획서', per: 'once', step: 'plat' },
  { id: 'round', name: '회차별 수행보고서', per: 'round', step: 'plat' },
  { id: 'monthly', name: '월별 수행실적보고서', per: 'month', step: 'report' },
  { id: 'final', name: '최종보고', per: 'once', step: 'report' },
] };

test('단계 종류 plat·report — 허용 상태·열 이름·글', () => {
  assert.deepEqual(T.ALLOWED.plat, ['none', 'doing', 'done', 'blocked', 'na']);
  assert.deepEqual(T.ALLOWED.report, ['none', 'doing', 'done', 'blocked', 'na']);
  assert.equal(T.COL_KO.plat, '플랫폼 입력');
  assert.equal(T.COL_KO.report, '보고서');
  assert.equal(T.label('plat', 'doing'), '◐ 입력 중');
  assert.equal(T.label('plat', 'done'), '● 등록함');
  assert.equal(T.label('report', 'doing'), '◐ 작성 중');
  assert.equal(T.label('report', 'done'), '● 작성 완료');
  const base = { st: 'none', note: '', sentAt: '', gotAt: '', how: '', ack: false, link: null };
  assert.equal(T.validate(Object.assign({}, base, { st: 'doing' }), 'plat'), '');
  assert.equal(T.validate(Object.assign({}, base, { st: 'na' }), 'report'), '');
  assert.notEqual(T.validate(Object.assign({}, base, { st: 'bad' }), 'plat'), '');
  assert.deepEqual(T.STEPS, ['sign', 'attach', 'submit'], '간단형 열은 그대로');
});

test('keysForItem — once · round · month · 이상한 id 거부 · 상한', () => {
  assert.deepEqual(T.keysForItem(BIGPLAN, 'plan', 3, []).map((k) => k.key), ['plan']);
  assert.deepEqual(T.keysForItem(BIGPLAN, 'round', 3, []).map((k) => [k.key, k.name, k.round]),
    [['round:1', '회차별 수행보고서 1회차', 1], ['round:2', '회차별 수행보고서 2회차', 2], ['round:3', '회차별 수행보고서 3회차', 3]]);
  assert.deepEqual(T.keysForItem(BIGPLAN, 'monthly', 0, ['2026-03', '2026-04']).map((k) => [k.key, k.name, k.month]),
    [['monthly:1', '2026-03 월별 수행실적보고서', '2026-03'], ['monthly:2', '2026-04 월별 수행실적보고서', '2026-04']]);
  assert.deepEqual(T.keysForItem(BIGPLAN, 'monthly', 5, []), [], '기간도 달도 없으면 키 없음');
  assert.deepEqual(T.keysForItem(BIGPLAN, 'round', 0, []), []);
  assert.deepEqual(T.keysForItem(BIGPLAN, 'none-such', 3, []), []);
  assert.equal(T.keysForItem(BIGPLAN, 'round', 999, []).length, 60, '상한 60');
  const evil = { items: [{ id: '__proto__', name: 'x', per: 'once', step: 'plat' }, { id: 'Plan', name: 'x', per: 'once', step: 'plat' },
    { id: 'abcdefghijklmnopqrstu', name: 'x', per: 'once', step: 'plat' }] };
  ['__proto__', 'Plan', 'abcdefghijklmnopqrstu'].forEach((id) => assert.deepEqual(T.keysForItem(evil, id, 3, []), [], id));
  assert.deepEqual(T.keysForItem(null, 'plan', 3, []), []);
});

test('bigCells · nextStage · blockedOf — 합성 기록', () => {
  const rec = {
    guide: { st: 'done', at: 1 }, plan: { st: 'done', at: 1 },
    'round:1': { st: 'done', at: 1 }, 'round:2': { st: 'blocked', note: '서명지 못 받음', at: 1 }, 'round:3': { st: 'none', at: 1 },
    'monthly:1': { st: 'na', at: 1 },
  };
  const cells = T.bigCells(BIGPLAN, rec, 3, ['2026-03'], '2026-10-11');
  assert.deepEqual(cells.map((c) => c.id), ['guide', 'plan', 'round', 'monthly', 'final']);
  assert.deepEqual(cells.map((c) => c.step), ['sign', 'plat', 'plat', 'report', 'report']);
  assert.equal(cells[0].chip.txt, '● 회신 받음');
  assert.equal(cells[1].chip.txt, '● 등록함');
  assert.equal(cells[2].st, 'blocked');
  assert.ok(/1\/3|막힘|✕/.test(cells[2].chip.txt) && cells[2].chip.key === 'todo', cells[2].chip.txt);
  assert.equal(cells[3].st, 'na');
  assert.equal(cells[4].st, 'none');
  assert.equal(T.bigCells(BIGPLAN, rec, 0, [], '2026-10-11')[2].chip, null, '회차 0 이면 키 없음 → chip null');
  assert.deepEqual(T.nextStage(BIGPLAN, rec, 3, ['2026-03']), { id: 'round', name: '회차별 수행보고서' }, '막힘도 «미완» — 첫 미완 단계');
  assert.deepEqual(T.blockedOf(BIGPLAN, rec, 3, ['2026-03']), [{ id: 'round', key: 'round:2', name: '회차별 수행보고서 2회차', note: '서명지 못 받음' }]);
  const all = { guide: { st: 'done', at: 1 }, plan: { st: 'done', at: 1 }, 'round:1': { st: 'na', at: 1 }, 'round:2': { st: 'na', at: 1 }, 'round:3': { st: 'na', at: 1 },
    'monthly:1': { st: 'done', at: 1 }, final: { st: 'done', at: 1 } };
  assert.equal(T.nextStage(BIGPLAN, all, 3, ['2026-03']), null, '전부 끝');
  assert.equal(T.nextStage(BIGPLAN, {}, 3, []).id, 'guide');
  assert.deepEqual(T.blockedOf(BIGPLAN, {}, 3, []), []);
  assert.equal(T.nextStage(null, {}, 3, []), null);
});

test('alertsExtra — blocked 묶음(기존 waitSign·overdue 는 그대로)', () => {
  const rows = [
    { coName: 'A', trk: { due: '', waitDays: null, submit: null, blocked: [{ name: '수행계획서', note: '메모' }] } },
    { coName: 'B', trk: { due: '', waitDays: null, submit: null, blocked: [] } },
    { coName: 'C', trk: null },
    { coName: 'D' },
  ];
  const x = T.alertsExtra(rows, '2026-10-11');
  assert.deepEqual(x.blocked.map((e) => e.row.coName), ['A']);
  assert.deepEqual(x.blocked[0].items, [{ name: '수행계획서', note: '메모' }]);
  assert.deepEqual(x.waitSign, []);
  assert.deepEqual(x.overdue, []);
});
```

그리고 `tests/gov-report-rules.test.js` 맨 끝에(파일 앞의 `require` 이름을 읽어 같은 이름을 쓴다 — 아래는 `D`=docs 모듈, `T`=기록 모듈 가정):

```js
test('대형 3종의 모든 단계 키가 줄 키 규칙(소문자[:숫자] · 20자 이하)을 통과한다 — 새 규칙이 필요 없다', () => {
  const RULE = /^[a-z]+(:[0-9]+)?$/;
  const bigs = D.DOC_PLANS.filter((p) => p.kind === '대형');
  assert.ok(bigs.length >= 3);
  bigs.forEach((p) => p.items.forEach((x) => {
    const keys = T.keysForItem(p, x.id, 60, Array.from({ length: 36 }, (_, i) => '2026-' + String((i % 12) + 1).padStart(2, '0')));
    assert.ok(keys.length > 0, p.key + '.' + x.id);
    keys.forEach((k) => assert.ok(RULE.test(k.key) && k.key.length <= 20, p.key + ' ' + k.key));
  }));
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test tests/gov-report-track.test.js tests/gov-report-rules.test.js`
Expected: 새 검사 FAIL (`T.keysForItem is not a function`, `COL_KO.plat` undefined 등), 기존 검사는 PASS.

- [ ] **Step 3: 구현** — `js/pu-gov-report-track.js`:

(a) 상수(19~26행 근처)를 넓힌다:

```js
  var STEP_KO = { sign: { doing: '발송함', done: '회신 받음' }, attach: {}, submit: { doing: '제출 준비', done: '제출함' },
    plat: { doing: '입력 중', done: '등록함' }, report: { doing: '작성 중', done: '작성 완료' } };
  var ALLOWED = { sign: ['none', 'doing', 'done', 'blocked'], attach: ['none', 'doing', 'done', 'na'], submit: ['none', 'doing', 'done', 'blocked'],
    plat: ['none', 'doing', 'done', 'blocked', 'na'], report: ['none', 'doing', 'done', 'blocked', 'na'] };
  var COL_KO = { sign: '③ 업체 서명본', attach: '④ 산출물 별첨', submit: '⑤ 기관 제출', plat: '플랫폼 입력', report: '보고서' };
```
(`STEPS = ['sign','attach','submit']` 는 **그대로** — 간단형 열.)

(b) `keysFor` 바로 뒤에:

```js
  /* 대형 단계 — 항목(id) 하나의 줄 키들. once → [id] · round → id:1..n · month → id:1..m(달 이름 앞에). 이상한 id 는 키를 만들지 않는다 */
  function keysForItem(plan, itemId, n, months) {
    var out = [], x = null;
    ((plan && plan.items) || []).forEach(function (it) { if (it && it.id === itemId) x = it; });
    if (!x || !okKey(keyOf(x, 0))) return out;
    var c = Math.min(Math.max(+n || 0, 0), MAX_ROUNDS);
    if (x.per === 'once') out.push({ key: keyOf(x, 0), id: x.id, name: x.name, round: 0 });
    else if (x.per === 'round') { for (var i = 1; i <= c; i++) out.push({ key: keyOf(x, i), id: x.id, name: x.name + ' ' + i + '회차', round: i }); }
    else if (x.per === 'month') {
      (Array.isArray(months) ? months : []).slice(0, MAX_ROUNDS).forEach(function (m, i) {
        out.push({ key: keyOf(x, i + 1), id: x.id, name: str(m) + ' ' + x.name, round: i + 1, month: str(m) });
      });
    }
    return out;
  }
```

(c) `itemChip` 뒤에:

```js
  /* 대형 틀 — 단계(항목)마다 칩. 키가 없으면(회차·달 0) chip 은 null */
  function bigCells(plan, rec, n, months, today) {
    rec = obj(rec) ? rec : {};
    return ((plan && plan.items) || []).map(function (x) {
      var keys = keysForItem(plan, x.id, n, months);
      if (!keys.length) return { id: x.id, name: x.name, step: x.step, chip: null, st: 'none' };
      var c = chipOf(x.step, keys, rec, today);
      return { id: x.id, name: x.name, step: x.step, chip: { txt: c.txt, key: c.key }, st: c.st };
    });
  }
  /* 「다음 단계」 — 키가 있는 단계 가운데 done·na 가 아닌 첫 번째(표시일 뿐, 순서를 강제하지 않는다) */
  function nextStage(plan, rec, n, months) {
    rec = obj(rec) ? rec : {};
    var items = (plan && plan.items) || [];
    for (var i = 0; i < items.length; i++) {
      var keys = keysForItem(plan, items[i].id, n, months);
      if (!keys.length) continue;
      var st = stateOf(keys.map(function (k) { return has(rec, k.key) && rec[k.key] ? rec[k.key].st : 'none'; }));
      if (st !== 'done' && st !== 'na') return { id: items[i].id, name: items[i].name };
    }
    return null;
  }
  function blockedOf(plan, rec, n, months) {
    rec = obj(rec) ? rec : {};
    var out = [];
    ((plan && plan.items) || []).forEach(function (x) {
      keysForItem(plan, x.id, n, months).forEach(function (k) {
        var r = has(rec, k.key) ? rec[k.key] : null;
        if (r && r.st === 'blocked') out.push({ id: x.id, key: k.key, name: k.name, note: str(r.note) });
      });
    });
    return out;
  }
```

(d) `alertsExtra` 에 `blocked` 를 더한다:

```js
  function alertsExtra(rows, today) {
    var waitSign = [], overdue = [], blocked = [];
    (rows || []).forEach(function (r) {
      var t = r && r.trk;
      if (!t) return;
      if (t.waitDays != null && t.waitDays > WAIT_SIGN_DAYS) waitSign.push({ row: r, days: t.waitDays });
      if (t.submit && t.submit.st !== 'done' && isDay(t.due) && isDay(today) && t.due < today) overdue.push({ row: r, due: t.due });
      if (Array.isArray(t.blocked) && t.blocked.length) blocked.push({ row: r, items: t.blocked.map(function (b) { return { name: str(b.name), note: str(b.note) }; }) });
    });
    waitSign.sort(function (a, b) { return b.days - a.days; });
    overdue.sort(function (a, b) { return a.due < b.due ? -1 : (a.due > b.due ? 1 : 0); });
    return { waitSign: waitSign, overdue: overdue, blocked: blocked };
  }
```
(기존 본문을 읽어 **같은 동작을 유지**하고 `blocked` 만 더한다 — 위는 기존 본문 그대로에 한 가지를 더한 꼴이다.)

(e) 공개 객체에 `keysForItem, bigCells, nextStage, blockedOf` 를 더한다. 파일 머리 주석에 «대형 단계 종류 plat·report(2026-10-11, 설계 2-A)» 한 줄.

- [ ] **Step 4: 통과 확인**

Run: `node --test tests/gov-report-track.test.js tests/gov-report-rules.test.js tests/gov-report-docs.test.js tests/gov-report-app.test.js`
Expected: 새 검사 PASS. 기존 검사 중 `alertsExtra` 결과를 통째로 `deepEqual({waitSign,overdue})` 하는 것이 있으면 `blocked: []` 를 기대값에 더한다(뜻은 같음 — 보고서에 적는다). 규칙 검사(`tests/gov-report-rules.test.js`)는 `docs` 모듈에서 `DOC_PLANS` 를 읽는다 — 이름이 다르면 맞춘다.

- [ ] **Step 5: Commit**

```bash
git add js/pu-gov-report-track.js tests/gov-report-track.test.js tests/gov-report-rules.test.js tests/gov-report-app.test.js
git commit -m "feat(gov-report): 대형 단계 종류·항목 키·단계 칩·다음 단계·막힌 단계 (기록 모듈)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: 서류 틀 모듈 — 대형 체크 글·`monthsFor`·`docsTable`·`trackRows`

**Files:**
- Modify: `js/pu-gov-report-docs.js` (`it()` 34행, 대형 `DOC_PLANS` 37~41·70~87행, `docsTable` 263행, `trackRows` 307행, 공개 객체 328행)
- Modify: `tests/gov-report-docs.test.js`
- Modify: `gov-report.html` — `pu-gov-report-docs.js` / `pu-gov-report-track.js` 의 `?v` 번호를 올린다(두 스크립트 줄만)

**Interfaces:**
- Consumes: Task 1 의 `Track.bigCells(plan, rec, n, months, today)`·`Track.nextStage`·`Track.blockedOf`·`Track.keysForItem`, 기존 `months(from,to)`·`consFor`·`pairs`·`planFor`·`chips`·`DASH`.
- Produces:
  - `it(id, name, per, step, extra)` 의 `extra` 가 `{how, steps, note}` 를 받는다(`note` 새로).
  - `DOC_PLANS` 대형 항목에 선택 필드 `steps`(배열)·`note`(글).
  - `monthsFor(cons, pair) → ['YYYY-MM',…]` — 계약 기간(`startDate`·`endDate`)이 있으면 그 달들, 없으면 `pair.firstDate`·`pair.lastDate`, 둘 다 없으면 `[]`.
  - `docsTable(o)` — 대형 틀이면 `{ plan, auto:false, big:true, cols:[단계 이름…], lines:[{…기존, cells:[{id,name,step,chip}], next:{id,name}|null}] }`. 간단형·틀 없음은 **지금과 같은 출력**(`big` 속성 없음).
  - `trackRows` — 대형 틀 줄에 `r.trk = { due, sign:null, submit:null, waitDays:null, bar3:false, bar4:false, big:true, next, blocked:[…] }` (`r.st.steps` ③④ 는 `false`).

- [ ] **Step 1: 실패하는 검사 쓰기** — `tests/gov-report-docs.test.js` 맨 끝(앞의 `require` 이름을 읽어 맞춘다 — 아래 `D`=docs, `Tr`=기록; 파일에 `F`(fixture) 가 있으면 합성 자료를 그것으로, 없으면 아래처럼 직접):

```js
test('대형 항목 체크 글 — steps 는 배열·note 는 글, 주소·전화 꼴 없음, 간단형에는 없다', () => {
  const bigs = D.DOC_PLANS.filter((p) => p.kind === '대형');
  assert.ok(bigs.length >= 3);
  let withText = 0;
  bigs.forEach((p) => p.items.forEach((x) => {
    if (x.steps !== undefined) { assert.ok(Array.isArray(x.steps) && x.steps.length >= 3 && x.steps.every((s) => typeof s === 'string' && s.trim()), p.key + '.' + x.id); withText++; }
    if (x.note !== undefined) { assert.ok(typeof x.note === 'string' && x.note.trim(), p.key + '.' + x.id); withText++; }
  }));
  assert.ok(withText >= 8, '대형 항목에 체크 글·안내가 충분히 있다');
  D.DOC_PLANS.filter((p) => p.kind !== '대형').forEach((p) => p.items.forEach((x) => {
    assert.equal(x.note, undefined, p.key + '.' + x.id + ' 간단형에는 note 가 없다');
  }));
  const all = JSON.stringify(D.DOC_PLANS);
  assert.ok(!/@[a-z0-9-]+\.[a-z]{2,}|\d{2,3}-\d{3,4}-\d{4}/i.test(all));
});

test('monthsFor — 계약 기간 → 회차 날짜 → 없음', () => {
  assert.deepEqual(D.monthsFor({ startDate: '2026-03-02', endDate: '2026-05-30' }, { firstDate: '2026-01-01', lastDate: '2026-01-31' }), ['2026-03', '2026-04', '2026-05']);
  assert.deepEqual(D.monthsFor(null, { firstDate: '2026-06-10', lastDate: '2026-07-20' }), ['2026-06', '2026-07']);
  assert.deepEqual(D.monthsFor({}, {}), []);
  assert.deepEqual(D.monthsFor(null, null), []);
});

const BIGSEED = (() => {
  const types = [{ id: 'tb', name: '산업일자리(충남)' }];
  const cos = [{ id: 'cb', name: '다라정밀' }];
  const scheds = [
    { id: 's1', coId: 'cb', typeId: 'tb', date: '2026-03-05', round: 1, isField: true },
    { id: 's2', coId: 'cb', typeId: 'tb', date: '2026-04-09', round: 2, isField: true },
  ];
  return { cos, types, scheds };
})();

test('docsTable — 대형 틀이면 단계 열·칩·다음 단계, 간단형은 big 없이 그대로', () => {
  const erp = { code: 'E1', name: '산업일자리전환컨설팅충남', agency: '충남경제진흥원' };
  const input = { cos: BIGSEED.cos, types: BIGSEED.types, scheds: BIGSEED.scheds };
  const track = { cb: { 'tb_2026': { items: { log: { st: 'done', at: 1 } } } } };
  const t = D.docsTable({ erp, typeId: 'tb', input, rows: [], year: '2026', consultings: [], tmap: {}, biz: [], track, today: '2026-10-11' });
  if (!t.lines.length) return;   // pairs 가 이 합성 입력을 못 읽으면 아래 단언은 의미 없다 — 아래 «pairs 입력» 단언이 먼저 잡는다
  assert.equal(t.big, true);
  assert.equal(t.auto, false);
  assert.deepEqual(t.cols, ['수행일지', '월별 수행실적보고서', '결과보고서', '사후관리 결과보고서']);
  const line = t.lines[0];
  assert.equal(line.cells.length, 4);
  assert.deepEqual(line.cells.map((c) => c.id), ['log', 'monthly', 'result', 'after']);
  assert.equal(line.cells[0].chip.key, 'done');
  assert.equal(line.next.id, 'monthly', '첫 미완 단계(수행일지는 완료)');
  const simple = D.docsTable({ erp: { code: 'E2', name: '인사노무컨설팅충남북부상의' }, typeId: 'tb', input, rows: [], year: '2026', consultings: [], tmap: {}, biz: [] });
  assert.equal(simple.big, undefined, '간단형 출력에는 big 이 없다');
  assert.deepEqual(simple.cols, D.COLS);
});

test('trackRows — 대형 틀 줄에 막힌 단계·다음 단계가 실리고 간단형 줄은 그대로', () => {
  const rows = [{ coId: 'cb', typeId: 'tb', typeName: '산업일자리전환컨설팅충남', year: '2026', rid: 'tb_2026', rounds: 2, maxRounds: 0, coName: '다라정밀', st: { steps: [true, true, true, true] } }];
  const track = { cb: { tb_2026: { items: { log: { st: 'blocked', note: '메모', at: 1 } } } } };
  const biz = [{ code: 'E1', name: '산업일자리전환컨설팅충남', agency: 'x' }];
  const tmap = { E1: 'tb' };
  D.trackRows(rows, { input: { cos: BIGSEED.cos }, track, biz, tmap, consultings: [], today: '2026-10-11' });
  const r = rows[0];
  if (!r.trk) return;   // 합성 입력이 연결되지 않으면 의미 없음 — 아래 연결 단언을 먼저 확인
  assert.equal(r.trk.big, true);
  assert.deepEqual(r.st.steps, [true, true, false, false], '③④ 막대는 대형에서 끈다');
  assert.equal(r.trk.sign, null);
  assert.equal(r.trk.submit, null);
  assert.deepEqual(r.trk.blocked, [{ id: 'log', key: 'log', name: '수행일지', note: '메모' }]);
  assert.equal(r.trk.next.id, 'log');
});
```

(위 두 «합성 입력» 검사는 `pairs()`·`erpTypeFor()` 가 합성 자료를 연결하도록 **입력을 실제 모듈 동작에 맞게 고쳐서** `if (!…) return;` 우회가 일어나지 않게 만든다 — 우회가 일어나면 검사는 아무것도 확인하지 않는다. 구현자는 기존 `tests/gov-report-docs.test.js` 의 `docsTable`·`trackRows` 검사가 쓰는 합성 입력 모양을 그대로 따라 한다. 우회 줄은 최종 코드에서 **없앤다**.)

- [ ] **Step 2: 실패 확인**

Run: `node --test tests/gov-report-docs.test.js`
Expected: 새 검사 FAIL (`D.monthsFor` 없음 등).

- [ ] **Step 3: 구현** — `js/pu-gov-report-docs.js`:

(a) `it()` 를 `note` 도 받게:

```js
  function it(id, name, per, step, extra) {
    var o = { id: id, name: name, per: per, step: step };
    if (extra) { if (extra.how) o.how = extra.how; if (extra.steps) o.steps = extra.steps; if (extra.note) o.note = extra.note; }
    return o;
  }
```
(Task 2 이전 작업에서 이미 `extra` 가 있다 — 있으면 `note` 한 줄만 더한다.)

(b) 대형 `DOC_PLANS` 항목에 글을 더한다. 아래는 «정리본 기준 초안» **[노무사 확인]** 이다(화면이 바뀌면 고친다). 상수 `PLAT_LOGIN = '플랫폼에 로그인 — 사람이 합니다(공동인증서·OTP 는 자동으로 다루지 않습니다)'`, `PLAT_SUBMIT = '저장·제출 단추 — 사람이 누릅니다'` 를 만들어 쓴다.

```js
    { key: 'industry-cn', words: ['산업일자리전환컨설팅충남'], kind: '대형', source: SOURCE, items: [
      it('log', '수행일지', 'once', 'plat', { note: '컨설팅 수행일지 — 기본정보(사업명·수행기관·컨설턴트·기업)와 회차별 수행 내용' }),
      it('monthly', '월별 수행실적보고서', 'month', 'report', { note: '달마다 한 부' }),
      it('result', '결과보고서', 'once', 'report', { note: '컨설팅 개요 · 진단 결과·전환 과제 · 핵심 과제·KPI · 로드맵 · 기대효과 · 이행 계획 · 사후관리 방안' }),
      it('after', '사후관리 결과보고서', 'once', 'report')] },
```
`workplace`(일터혁신):
```js
      it('guide', '참여 안내서(서명)', 'once', 'sign', { note: '담당자 서명 후 플랫폼에 업로드' }),
      it('plan', '수행계획서', 'once', 'plat', { steps: [PLAT_LOGIN, '진단 결과 문제점·개선 필요사항 입력', '개선과제 최대 5개와 우선순위(공식 «개선과제명» 사용) · 선택 과제 2개(특화는 3개)', '과제별 수행목표·적용대상·수행내용·기대효과 · 노사참여(디자인팀 성명·부서·직급) · 연계 정부지원사업', PLAT_SUBMIT] }),
      it('round', '회차별 수행보고서+사진2장+서명지', 'round', 'plat', { steps: [PLAT_LOGIN, '회차 수행보고서 입력: 진단기간·참여인력·수행일시·회차·회의형태·참석자(성명·부서·직급)', '회의안건·주요 논의사항·기타(다음 안건 등) — «○회차 디자인팀 회의» 같은 형식적 문구는 쓰지 않습니다', '시작·종료 사진(타임스탬프 앱) 2장과 참석자 전원 서명지 스캔 첨부', PLAT_SUBMIT], note: '회의 2시간 이상 · 기업 참여 3명 이상 · 대면 70% 이상(비대면은 ZOOM 등 공식 프로그램만 — 전화·메일은 인정 안 됨)' }),
      it('kickoff', '착수보고', 'once', 'report', { note: '통합진단보고서(PPT) — 디자인팀 전원 참석' }),
      it('mid', '중간보고', 'once', 'report', { note: '통합진단보고서(PPT) — 디자인팀 전원 참석' }),
      it('final', '최종보고', 'once', 'report', { note: '통합진단보고서(PPT) — 디자인팀 전원 참석' }),
      it('follow', '이행관리 등록', 'once', 'plat', { steps: [PLAT_LOGIN, '이행관리 수행내용 등록', PLAT_SUBMIT] }),
      it('outcome', '이행결과표', 'once', 'report'),
```
`industry`(중진공·KMAC):
```js
      it('kickoff', '착수보고서(PPT)', 'once', 'report', { note: '표준 PPT — 사업개요·컨설팅 추진 계획·운영 체계. 업로드하면 1MD 로 인정' }),
      it('plan', '수행계획서', 'once', 'report', { note: '운영기관 승인이 나야 수행을 시작합니다' }),
      it('mdlog', 'MD별 수행일지', 'round', 'report', { note: '비대면은 보고서 4MD·자료조사 2MD 까지(연속 불가)' }),
      it('final', '최종결과보고서', 'once', 'report', { note: '표준 HWP + 체크리스트: KPI 4개 이상(필수 2·선택 2) · 정부지원사업 2개 이상 연계(산업일자리전환지원금 필수) · 기업 현황 최신 연도 · 다른 보고서와 중복 금지' }),
      it('meeting', '최종보고회', 'once', 'report', { note: '최종 MD 대면 결과보고회' }),
      it('link', '연계지원사업 등록', 'once', 'plat', { steps: [PLAT_LOGIN, '수행일지·최종결과보고서 등록 확인', '연계지원사업 등록(산업일자리전환지원금 포함 2개 이상 — 적합·부적합 사유)', PLAT_SUBMIT] }),
      it('done', '완료보고서(요약)', 'once', 'report', { note: '운영기관·중진공 승인으로 완료' }),
```
(기존 항목 `id`·`name`·`per`·`step` 은 **바꾸지 않는다** — 글만 더한다. 항목 순서도 그대로.)

(c) `monthsFor`·`docsTable`·`trackRows`:

```js
  /* 월별 서류의 달 — 계약 기간(startDate~endDate) → 없으면 회차 날짜(첫~마지막) → 없으면 [] */
  function monthsFor(cons, pair) {
    var s = str(cons && cons.startDate).slice(0, 10), e = str(cons && cons.endDate).slice(0, 10);
    var p = pair || {};
    return months(s || p.firstDate, e || p.lastDate);
  }
```
`docsTable` 의 줄 만들기에서(기존 `var cells = auto ? chips(r) : null;` 근처):

```js
      var big = plan.kind === '대형', n = Math.max(+p.rounds || 0, +p.planned || 0), ms = big ? monthsFor(cons, p) : [], bigRec = (big && o.track) ? Track.recOf(o.track, p.coId, p.rid) : null;
      var bcells = big ? Track.bigCells(plan, bigRec || {}, n, ms, o.today).map(function (c) { return (bigRec || !c.chip) ? c : { id: c.id, name: c.name, step: c.step, chip: { txt: '—', key: '' }, st: 'none' }; }) : null;
```
그리고 반환 줄 객체에 `cells: big ? bcells : cells`, `next: big && bigRec ? Track.nextStage(plan, bigRec, n, ms) : undefined`(대형 아니면 `next` 속성을 **넣지 않는다**), 최종 반환 `{ plan: plan, auto: auto, cols: big ? plan.items.map(function (x) { return x.name; }) : COLS.slice(), lines: lines }` 에 대형일 때만 `big: true` 를 붙인다(`var isBig = plan.kind === '대형'` 를 함수 앞에서 한 번 계산). 간단형 객체에는 `big` 키가 **없어야** 한다.

`trackRows`: 현재 `if (!AUTO[plan.key]) return;` 를 다음처럼 가른다.

```js
      if (plan.kind === '대형') {
        var bcons = consFor({ consultings: o.consultings, co: cos[r.coId] || { id: r.coId, name: r.coName }, code: erp ? erp.code : '', typeId: r.typeId, tmap: o.tmap, biz: o.biz });
        var bn = Math.max(+r.rounds || 0, +r.maxRounds || 0), bms = monthsFor(bcons, { firstDate: r.firstDate, lastDate: r.lastDate }), brec = Track.recOf(o.track, r.coId, r.rid);
        r.trk = { due: bcons ? str(bcons.endDate).slice(0, 10) : '', sign: null, submit: null, waitDays: null, bar3: false, bar4: false, big: true,
          next: Track.nextStage(plan, brec, bn, bms), blocked: Track.blockedOf(plan, brec, bn, bms) };
        r.st.steps = [!!s[0], !!s[1], false, false];
        return;
      }
      if (!AUTO[plan.key]) return;
```
(`r.firstDate`·`r.lastDate` 가 현황판 줄에 없으면 `pairs` 의 값에서 읽는 방식을 기존 `trackRows`/`buildRows` 코드를 읽고 맞춘다 — 없으면 `monthsFor(bcons, null)` 만 쓰고 보고서에 적는다.)

공개 객체에 `monthsFor` 를 더한다.

(d) `gov-report.html` 의 `<script src="js/pu-gov-report-docs.js?v=N">`·`<script src="js/pu-gov-report-track.js?v=N">` 번호를 각각 +1.

- [ ] **Step 4: 통과 확인**

Run: `node --test tests/gov-report-docs.test.js tests/gov-report-track.test.js tests/gov-report-app.test.js tests/gov-report-rules.test.js`
Expected: PASS 전부(간단형 기존 검사 그대로 통과). 우회(`if (!…) return`) 줄이 남아 있지 않은지 확인.

- [ ] **Step 5: Commit**

```bash
git add js/pu-gov-report-docs.js tests/gov-report-docs.test.js gov-report.html
git commit -m "feat(gov-report): 대형 서류 틀 체크 글·monthsFor·docsTable 단계 열·trackRows 막힘

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: 화면 — 단계 열 표·칸 창 진입·체크 글·막힌 단계 알림

**Files:**
- Modify: `gov-report.html` — `grRenderDocs`(333행 근처), 체크표 클릭 처리(`['rows','docs'].forEach…` 976행 근처), `grOpenCell`(404행), `grRenderCell`(427행 근처 — 날짜 칸·`#cwSend` 조건), `grSendCtx`·`grRenderSend`(설계 1 이 만든 구역), `grRenderAlerts`(860행)
- Modify: `tests/gov-report-app.test.js`

**Interfaces:**
- Consumes: Task 1·2 의 `docsTable` 대형 결과(`t.big`, `t.cols`, `lines[].cells[{id,name,step,chip}]`, `lines[].next`), `PuGovReportTrack.keysForItem`·`COL_KO.plat/report`·`alertsExtra().blocked`, `PuGovReportDocs.monthsFor`, 항목 `steps`/`note`, 기존 `grSaveCell`·`grSendCtx`·`grRenderSend`·`grEsc`.
- Produces: `grOpenCell(coId, typeId, step, itemId)`(네 번째 인자 선택), 칸 단추 속성 `data-item`, 칸 창 `GR.cw.item`, `#cwSend` 안 «입력 순서»·«안내», 알림 「막힌 단계」.

설계 요약(코드는 아래):
- `grRenderDocs`: `t.big` 이면 표(업체 | 단계 열들 | 다음 단계 | 기한 | 목차). 단계 칸은 `c.chip` 이 있을 때만 단추(`data-cell data-step data-item`), 없으면 «—». 기록을 못 읽었으면(`GR.trackErr`) 단추 대신 「?」.
- 클릭 처리: `grOpenCell(co,ty,step,item)`.
- `grOpenCell`: `itemId` 가 있으면 `T.keysForItem(plan, itemId, n, D.monthsFor(cons,p))`; 없으면 지금과 같다. 칸 창 객체에 `item:itemId||''`. (`cons` 계산을 키 계산보다 앞으로 옮긴다.)
- `grRenderCell`: `plat`·`report` 단계는 «완료일»(`#cwGot`) 한 칸. `#cwSend` 는 `sign|submit|plat|report` 단계에서 나온다(`attach` 는 지금처럼 없음).
- `grRenderSend`: `plat` 이면 체크 글 `<ol>`(`item.steps`)과 안내(`item.note`), `report`·`sign` 이면 안내(`item.note`)만. 모두 `grEsc`. `grSendCtx` 가 `x.plan`(항목)을 이미 돌려준다.
- `grRenderAlerts`: 「막힌 단계 N」 묶음(`<li>업체 · 사업 — 단계 이름들 (메모)</li>`).

- [ ] **Step 1: 실패하는 검사 쓰기** — `tests/gov-report-app.test.js` 를 먼저 읽어 설계 1 검사들(`signSeed`·`cellOf`·`world`·`showRec`)과 `docsTable` 렌더 검사(`grRenderDocs`) 틀을 파악하고 **같은 틀**로 맨 끝에 더한다(세계 만들기 중복 금지 — 공용 도우미를 확장). 합성 자료는 `tests/helpers/gov-report-fixture.js`(필요하면 대형 사업 한 줄(예: `산업일자리전환컨설팅충남` 사업·합성 업체 `다라정밀`·회차 2개)을 **검사 안 로컬 시드**로 더한다 — 공용 fixture 를 바꿔 다른 검사를 깨지 않는다). 단언 목록:
  1. **정적**: 인라인 스크립트의 쓰기 명령은 여전히 `['.set(']` 하나뿐 · `data-item` 이 클릭 처리에서 `grOpenCell` 네 번째 인자로 넘어간다.
  2. 대형 사업을 고르면 `#docs` 에 단계 열 머리(`수행일지`·`월별 수행실적보고서`…)와 「다음 단계」 열이 있고, 칩 단추는 `data-item` 을 가진다. **간단형 사업을 고르면 지금과 같은 5열**(기존 검사 그대로 통과) 이고 `data-item` 이 없다.
  3. `GR.trackErr` 일 때 대형 단계 칸은 단추 없이 「?」.
  4. `grOpenCell(co, ty, 'plat', 'plan')`(일터혁신 시드) → `GR.cw.keys` = `[{key:'plan'…}]`, `GR.cw.item==='plan'`, 칸 창에 「완료일」 칸(`#cwGot`)이 있고 발송일 칸·제출 방식 칸은 없다 · `#cwSend` 에 체크 글 `<li>` 가 `steps.length` 개 · 안내 글.
  5. 회차 서류(`round`): `grOpenCell(…,'plat','round')` → `keys` 가 `round:1..n`(합성 회차 수), «서류» 고르기 `<select>` 가 나온다.
  6. 월별(`monthly`, 충남 시드·계약 기간 있음): 키가 `monthly:1..m`, 이름에 `YYYY-MM`.
  7. 저장: 대형 단계 칸에서 상태 「완료」·완료일·메모를 저장하면 `scal_docs/<co>/<rid>/items/plan` 한 줄만 쓰이고 `{st:'done', gotAt, note, by, at}`(기존 `link` 보존), 규칙 밖 필드 없음.
  8. 서명 단계(`guide`): 설계 1 의 「✉ 서명 요청 메일 쓰기」가 나온다(`#cwSend`), `grWriteMail` 이 `[서명요청:<rid>]` 꼬리표로 `puMailComposeTo` 를 부른다.
  9. 체크 글·메모에 `<script>alert(1)</script>`·`"'` 가 있어도 `#cwSend`·알림 HTML 에서 이스케이프된다(`DOC_PLANS` 사본에 합성 값을 넣어 렌더).
  10. 알림: 막힘 기록이 있는 대형 줄이 있으면 `#alerts` 에 「막힌 단계 1」과 단계 이름·메모가 나온다. 없으면 `0`.
  11. 회귀: `attach` 칸 창에는 `#cwSend` 가 없다 · 간단형 ⑤ 제출 칸·③ 서명 칸 동작은 설계 1 검사가 그대로 통과한다.

- [ ] **Step 2: 실패 확인**

Run: `node --test tests/gov-report-app.test.js`
Expected: 새 검사 FAIL, 기존 검사 PASS.

- [ ] **Step 3: 구현** — `gov-report.html` 부분 편집.

(a) `grRenderDocs` — `else if(t.auto)` 앞에 대형 분기:

```js
  else if(t.big){
    var bcell=function(x,c){
      if(GR.trackErr) return '?';
      if(!c.chip) return '—';
      return '<button type="button" class="cellb" data-cell="1" data-co="'+grEsc(x.coId)+'" data-ty="'+grEsc(x.typeId)+'" data-step="'+grEsc(c.step)+'" data-item="'+grEsc(c.id)+'" title="눌러서 기록">'+chip(c.chip)+'</button>';
    };
    body='<div class="dc-wide"><table><thead><tr><th>업체</th>'+t.cols.map(function(c){ return '<th>'+grEsc(c)+'</th>'; }).join('')+'<th>다음 단계</th><th>기한</th><th></th></tr></thead><tbody>'
      +t.lines.map(function(x){
        return '<tr><td class="co" title="'+grEsc(x.coName)+'">'+grEsc(x.coName)+'</td>'+x.cells.map(function(c){ return '<td>'+bcell(x,c)+'</td>'; }).join('')
          +'<td>'+(GR.trackErr?'?':(x.next?grEsc(x.next.name):'모두 끝'))+'</td><td>'+grEsc(x.due||'—')+'</td><td>'+btn(x,'목차')+'</td></tr>';
      }).join('')+'</tbody></table></div>';
  }
```
(`chip` 도우미는 기존 `var chip=function(c){ return c.key?'<span class="st st-'+c.key+'">'+grEsc(c.txt)+'</span>':grEsc(c.txt); }` — `{txt,key}` 를 받으므로 `c.chip` 을 넘긴다.) CSS: `.dc-wide{overflow-x:auto}` 한 줄을 `<style>` 에 더한다(기존 `.dc-h` 근처). 머리 `head` 의 `t.auto&&GR.trackErr` 오류 표시는 `(t.auto||t.big)&&GR.trackErr` 로.

(b) 클릭 처리: `grOpenCell(c.getAttribute('data-co'),c.getAttribute('data-ty'),c.getAttribute('data-step'),c.getAttribute('data-item')||'')`.

(c) `grOpenCell(coId,typeId,step,itemId)`:

```js
function grOpenCell(coId,typeId,step,itemId){
  var D=PuGovReportDocs, T=PuGovReportTrack, d=GR.docs||{};
  if(!GR.track||GR.trackErr) return;
  var p=D.pairs(GR.input,typeId,GR.f.year).filter(function(x){ return x.coId===coId; })[0];
  var erp=grErp(GR.f.biz);
  if(!p||!erp) return;
  var cons=D.consFor({consultings:d.cons,co:p.co,code:erp.code,typeId:typeId,tmap:d.tmap,biz:d.biz});
  var plan=D.planFor(erp.name), n=Math.max(+p.rounds||0,+p.planned||0);
  var keys=itemId?T.keysForItem(plan,itemId,n,D.monthsFor(cons,p)):T.keysFor(plan,step,n);
  if(!keys.length) return;
  GR.cw={coId:coId,coName:p.coName,bizNo:String((p.co&&p.co.bizNo)||''),typeId:typeId,rid:p.rid,step:step,item:itemId||'',keys:keys,key:keys[0].key,draft:null,msg:'',err:false,busy:false,
    win:PuGovReportInbox.windowOf(p.firstDate,p.lastDate),cons:cons,biz:erp.name,tech:plan.key==='techguard',cands:[]};
  GR.avMsg=''; GR.avErr=false;
  grRenderCell();
  grLoadInbox();
}
```
(기존 본문을 읽고 **같은 동작을 유지**하면서 `itemId`·`cons` 순서만 바꾼다. 위는 기존 코드의 변형이다 — 실제 코드의 다른 필드가 있으면 그대로 보존.)

(d) `grRenderCell`: 날짜 칸 — `if(c.step==='sign'){…}`·`if(c.step==='submit'){…}` 옆에 `if(c.step==='plat'||c.step==='report') h+=field('완료일',date('cwGot',v.gotAt));`. `#cwSend` 조건을 `c.step==='sign'||c.step==='submit'||c.step==='plat'||c.step==='report'` 로. 제목 줄 `T.COL_KO[c.step]` 은 `plat`·`report` 도 읽는다(Task 1 에서 추가됨). 대형 항목이면 제목에 항목 이름도(`item.name` — «서류:» 줄이 이미 있다).

(e) `grRenderSend`: 시작부의 단계 필터를 `sign|submit|plat|report` 로 넓히고, 서명·제출 분기 **뒤**, 메시지 div 앞에 공통 안내를 더한다:

```js
  if(c.step==='plat'&&Array.isArray(x.plan.steps)&&x.plan.steps.length){
    h+='<div class="days">입력 순서</div><ol class="days">'+x.plan.steps.map(function(s){ return '<li>'+grEsc(s)+'</li>'; }).join('')+'</ol>'
      +'<div class="days">로그인과 최종 제출은 사람이 합니다 — 접수 화면을 캡처해 두세요</div>';
  }
  if((c.step==='plat'||c.step==='report'||c.step==='sign')&&typeof x.plan.note==='string'&&x.plan.note) h+='<div class="days">안내: '+grEsc(x.plan.note)+'</div>';
```
(`x.plan` 은 `grSendCtx` 가 항목 `id` 로 찾은 계획 항목이다. `c.step==='sign'` 분기 안의 기존 메일 단추 코드와 겹치지 않게 한다. 헤더 글자 `✉ …` 는 `sign`→«서명 요청», `submit`→«제출 메일», 그 밖(`plat`·`report`)→«📝 단계 안내» 로.)

(f) `grRenderAlerts`: `x.blocked` 묶음을 «제출 기한 지남» 뒤에 더한다:

```js
    +'<div class="al-h">막힌 단계 <b>'+x.blocked.length+'</b></div><ul>'
    +x.blocked.map(function(e){ return line(e.row,e.items.map(function(b){ return b.name+(b.note?' ('+b.note+')':''); }).join(' · ')); }).join('')+'</ul>'
```

- [ ] **Step 4: 통과 확인**

Run: `node --test tests/gov-report-*.test.js tests/test-pin-guard.test.js tests/photos-staff-share.test.js`
Expected: PASS 전부(우회 없음). 실제 화면(로그인)은 확인할 수 없으므로 보고서에 «실제 화면 미확인» 으로 적는다.

- [ ] **Step 5: Commit**

```bash
git add gov-report.html tests/gov-report-app.test.js
git commit -m "feat(gov-report): 대형 사업 단계 열 표·칸 창 단계 기록·체크 글·막힌 단계 알림

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: 기록·전체 검사

**Files:**
- Create: `status/2026-10-11-gov-report-big-stages.md`
- Modify: `STATUS.md`(설계 2-A 줄을 «구현»으로 — 줄 단위, 줄바꿈 보존), 설계서가 구현과 달라진 점이 있으면 `docs/superpowers/specs/2026-10-11-gov-report-big-stages-design.md` 맞춤

- [ ] **Step 1: 설계서 맞춤** — 구현이 설계서와 다르게 정한 것(예: `docsTable` 반환 모양, 알림 묶음 모양)이 있으면 설계서 §3·§4 를 그에 맞춰 고친다. 없으면 «설계서와 일치»만 노트에 적는다.
- [ ] **Step 2: 기록** — `status/2026-10-11-gov-report-big-stages.md`: 만든 것(단계 열·칸 창·막힌 단계·체크 글) · 쓰는 곳(변함없음, 새 규칙 없음) · 못 한 것(실제 로그인 화면 확인 안 함 · 회차 기록·기준 점검(2-B)·장별 AI(2-C)·기한·플랫폼 자동 입력 미구현 · 체크 글은 정리본 기준 초안 **[노무사 확인]**) · 대표 확인 필요. `STATUS.md` 의 설계 2-A 줄을 `- [x] … 구현 (PR 예정)` 꼴로 바꾸고 계획·노트 경로를 단다.
- [ ] **Step 3: 전체 검사**

Run: `node --test tests/gov-report-*.test.js tests/test-pin-guard.test.js tests/photos-staff-share.test.js tests/pu-hwp-preview.test.js`
Expected: fail 0.
Run: `git diff --stat origin/main...HEAD` — 바뀐 파일이 File Structure 와 같은지(규칙·ontology·`pu-erp.html` 등이 없어야 한다). 이 갈래는 설계 1 구현(PR #2534)을 포함할 수 있다 — 그 PR 이 먼저 합쳐지면 차이가 줄어든다.
- [ ] **Step 4: 비밀·이름 점검** — 추가된 줄에 실제 고객사·사람 이름·전화·주소(합성 `example.com/org`·`pureun.kr` 제외)가 없는지 `rg` 로 확인.
- [ ] **Step 5: Commit**

```bash
git add status/2026-10-11-gov-report-big-stages.md STATUS.md docs/superpowers/specs/2026-10-11-gov-report-big-stages-design.md
git commit -m "docs(gov-report): 대형 단계 체크표 구현 기록

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```
