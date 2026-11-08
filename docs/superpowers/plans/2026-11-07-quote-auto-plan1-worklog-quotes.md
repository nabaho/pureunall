# 견적·계약 자동화 — 계획 1: 작업 기록 + 지난 견적 모음 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 계약서등관리에 「작업 기록」(누가·언제·무엇)과 「지난 견적·계약」(업무 종류별, 금액은 정해진 사람만)을 만들고, 보낸메일함의 지난 견적·계약 메일을 한 번 가져와 채운다.

**Architecture:** 브라우저 모듈 3개(저장 층 `pu-worklog.js`·`pu-quotes.js`, 가져오기 `pu-quote-import.js`)와 화면 모듈 2개(`pu-worklog-view.js`·`pu-quotes-view.js`)를 `docs-esign.html`에 새 칸 두 개(`log`·`quotes`)로 붙인다. 금액은 실시간DB의 별도 자리 `pu_quote_amt`에 두고 규칙으로 막는다. 금액이 적힌 원본 파일은 기존 🔒 보관함에 두고 서버 함수 `puDocSecret`이 권한을 본다.

**Tech Stack:** 바닐라 JS(IIFE + `window.Pu*` 전역, `(typeof window !== 'undefined' ? window : this)`), Firebase RTDB/Storage(compat SDK), Cloud Functions(node 22), 테스트 `node:test` + `vm` 샌드박스.

**Spec:** `docs/superpowers/specs/2026-11-07-quote-contract-auto-design.md` (단계 0·1, §7 결정). 계획 2(서류 만들기 창)·3(이알피 자동 등록·확정)·4(이알피 금액 잠금)는 이 계획이 끝난 뒤 따로 쓴다.

## Global Constraints

- 작업 폴더는 `D:\pu-wt-quote`(C 드라이브 파일 시스템 손상 — 2026-11-07). 커밋 전 바꾼 파일에 NUL 바이트가 없는지 본다: `node -e "for(const f of process.argv.slice(1)){if(require('fs').readFileSync(f).includes(0))throw f}" <파일들>`.
- 금액을 보는 사람: `isAdmin`(대표·총괄관리자) · `fin`(재무) · 그 건의 **확정** 담당자(`pu_quote_amt/{qid}/owner === auth.uid`). `isSubAdmin`은 뺀다(spec §7).
- 인원(의뢰처 직원 수)을 이알피·기업정보함에서 채우는 일은 **계획 2**(서류 만들기 창의 회사 맞추기)로 넘긴다. 이 계획에서는 문서에서 읽은 값만 쓰고, 없으면 `—`.
- 작업 기록 읽기는 `isAdmin`만. 기록은 덧붙이기만(고치기·지우기 불가).
- RTDB에 `undefined`를 쓰지 않는다(빈 값은 칸을 빼거나 `''`).
- 규칙은 `scripts/make-firebase-rules.js`에만 고치고 `node scripts/make-firebase-rules.js > docs/firebase-rules-전체-적용본.json`으로 적용본을 다시 낸다. 콘솔 적용은 대표가 한다 — CLI로 규칙을 배포하지 않는다.
- `docs-esign.html`의 `<script src=…?v=N>`는 고친 파일마다 N을 올린다(지금: pu-contract-forms v=68, pu-office-store v=10, pu-doc-read 쓰는 곳 확인).
- 화면 글은 한국어, 이 저장소 말투(쉬운 우리말)를 따른다.
- 테스트: `node --test tests/<파일>.test.js`, 전체 `node --test tests/*.test.js functions/*.test.js`.
- 메일 함수 주소: `https://asia-northeast3-pureun-erp.cloudfunctions.net/` (`readMailAttachment`, `puDocSecret`).

## Review Focus

1. **권한 없는 직원이 금액을 꺼내려 할 때** — `pu_quote_amt` 전체 읽기·남의 qid 읽기는 거절, 화면은 「금액 비공개」. → Task 4 규칙 테스트 + Task 6 화면 테스트.
2. **같은 메일을 두 번 가져올 때** — 가져오기를 다시 눌러도 같은 `srcKey`면 건너뛴다. → Task 7 `alreadyHave` 테스트.
3. **AI 판독 한도(무료 등급)에 걸릴 때** — 그 자리에서 멈추고 남은 건수를 알린다. 이미 넣은 건은 그대로. → Task 7 `runImport` 멈춤 테스트.
4. **금액을 못 읽은 견적** — 기록은 남기되 `review:'check'`, 화면에 「확인 필요」. → Task 7·6 테스트.
5. **기록 쓰기가 실패해도 본래 일(내려받기·메일)은 계속** — `PuWorklog.log`는 절대 reject하지 않는다. → Task 1 테스트.

---

### Task 1: 작업 기록 저장 층 + 규칙

**Files:**
- Create: `js/pu-worklog.js`
- Modify: `scripts/make-firebase-rules.js` (새 `rules.pu_worklog` — `rules.pu_docs` 블록 뒤)
- Modify: `docs/firebase-rules-전체-적용본.json` (재생성)
- Test: `tests/worklog.test.js`, `tests/worklog-rules.test.js`

**Interfaces:**
- Produces:
  - `PuWorklog.KINDS` — `{ form_save:'서식 저장', download:'내려받기', upload:'올리기', mail_send:'메일 발송', sign_request:'서명 요청', review_request:'검토 요청', review_done:'검토 완료', erp_register:'이알피 등록', erp_confirm:'계약확정', auto_detect:'자동 감지', quote_save:'견적 기록', owner_confirm:'담당 확정' }`
  - `PuWorklog.init({ db, uid, name })`
  - `PuWorklog.monthKey(ms: number) -> 'YYYYMM'` (한국 시간 기준)
  - `PuWorklog.entry(kind: string, o: {target?, note?, auto?}, now?: number) -> {kind, at, by, byName, target?, note?, auto?}` — 모르는 kind면 throw. target 120자·note 200자·auto 60자로 자른다. 빈 칸은 뺀다.
  - `PuWorklog.log(kind, o) -> Promise<void>` — `pu_worklog/{monthKey}/{push}`에 쓴다. **어떤 오류도 삼킨다**(console.warn).
  - `PuWorklog.list(month: 'YYYYMM') -> Promise<Array<entry & {id}>>` — at 내림차순.

- [ ] **Step 1: 실패하는 테스트 작성** — `tests/worklog.test.js` (vm 샌드박스 + 가짜 DB는 `tests/office-store.test.js`의 `fakeDb` 방식)

```js
test('entry — 칸 자르기·빈 칸 빼기', () => {
  W.init({ db: null, uid: 'u1', name: '박한별' });
  const e = W.entry('download', { target: 'x'.repeat(130), note: '' }, 1794000000000);
  assert.strictEqual(e.kind, 'download'); assert.strictEqual(e.by, 'u1'); assert.strictEqual(e.byName, '박한별');
  assert.strictEqual(e.target.length, 120); assert.ok(!('note' in e)); assert.ok(!('auto' in e));
});
test('entry — 모르는 종류는 던진다', () => { assert.throws(() => W.entry('hack', {})); });
test('monthKey — 한국 시간', () => { assert.strictEqual(W.monthKey(Date.UTC(2026, 9, 31, 16, 0)), '202611'); });
test('log — 쓰기가 실패해도 reject 하지 않는다', async () => {
  W.init({ db: { ref: () => ({ push: () => Promise.reject(new Error('denied')) }) }, uid: 'u1', name: 'a' });
  await W.log('upload', { target: 'f1' });   // 던지지 않아야 통과
});
test('list — 최근 것이 위', async () => { /* fakeDb 에 at 1,3,2 넣고 [3,2,1] */ });
```

- [ ] **Step 2: 실행해 실패 확인** — `node --test tests/worklog.test.js` → FAIL (`js/pu-worklog.js` 없음)
- [ ] **Step 3: `js/pu-worklog.js` 구현** — 위 Interfaces 그대로. 저장 경로 상수 `ROOT = 'pu_worklog'`.
- [ ] **Step 4: 규칙 테스트 작성** — `tests/worklog-rules.test.js` (`tests/office-rules.test.js` 방식: APPLY와 GEN 비교)

```js
test('적용본이 만들개와 같다(pu_worklog)', () => assert.deepStrictEqual(APPLY.rules.pu_worklog, GEN.rules.pu_worklog));
test('읽기는 총괄관리자만', () => { assert.match(GEN.rules.pu_worklog['.read'], /isAdmin/); assert.doesNotMatch(GEN.rules.pu_worklog['.read'], /isSubAdmin|fin/); });
test('새로 쓰기만 · 내 이름으로만', () => {
  const r = GEN.rules.pu_worklog.$m.$id;
  assert.match(r['.write'], /!data\.exists\(\)/); assert.match(r.by['.validate'], /auth\.uid/);
  assert.strictEqual(r.$other['.validate'], false);
});
test('달 열쇠는 숫자 6자리', () => assert.match(GEN.rules.pu_worklog.$m['.validate'], /\[0-9\]\{6\}/));
```

- [ ] **Step 5: 규칙 추가** — `rules.pu_worklog = { '.read': ADMIN, $m: { '.validate': "$m.matches(/^[0-9]{6}$/)", $id: { '.write': \`(${LOGIN}) && !data.exists()\`, '.validate': "newData.hasChildren(['kind','at','by'])", kind: {isString ≤20}, at: {isNumber}, by: {=== auth.uid}, byName: {isString ≤60}, target: {isString ≤120}, note: {isString ≤200}, auto: {isString ≤60}, $other: { '.validate': false } } } }` (validate 문구는 `pu_docs.co_docs`와 같은 꼴). 적용본 재생성.
- [ ] **Step 6: 두 테스트 통과 확인** — `node --test tests/worklog.test.js tests/worklog-rules.test.js tests/office-rules.test.js` → PASS
- [ ] **Step 7: Commit** — `git add js/pu-worklog.js scripts/make-firebase-rules.js docs/firebase-rules-전체-적용본.json tests/worklog*.test.js && git commit -m "작업 기록 저장 층·규칙(총괄관리자만 읽기, 덧붙이기만)"`

### Task 2: 계약서등관리 곳곳에 기록 남기기

**Files:**
- Modify: `docs-esign.html` (`officeInit`·`archiveOriginal`·`downloadOriginal`·`formMailRecord`·`formSignCreate`·`formZip`, `PuContractForms.mount` 호스트에 `log`, `<script src="js/pu-worklog.js?v=1">`)
- Modify: `js/pu-contract-forms.js` (`change(fn, okMsg, undo)` 성공 뒤 `host.log`)
- Test: `tests/worklog-hooks.test.js`

**Interfaces:**
- Consumes: `PuWorklog.init`, `PuWorklog.log` (Task 1)
- Produces: 호스트 `log(kind, o)` — `PuContractForms.mount` 두 번째 인자에 들어간다.

- [ ] **Step 1: 실패하는 테스트 작성** — 소스 글자 검사(`tests/lawyer-cell-oneline.test.js` 방식)

```js
const H = read('docs-esign.html'), F = read('js/pu-contract-forms.js');
test('스크립트가 실린다', () => assert.match(H, /<script src="js\/pu-worklog\.js\?v=\d+"><\/script>/));
test('init 은 보관함과 같이', () => assert.match(cut(H, 'function officeInit'), /PuWorklog\.init\(\{ db: db, uid: curUser\.uid, name: meName\(\) \}\)/));
test('올리기', () => assert.match(cut(H, 'function archiveOriginal'), /PuWorklog\.log\('upload'/));
test('내려받기', () => assert.match(cut(H, 'function downloadOriginal'), /PuWorklog\.log\('download'/));
test('메일·받기', () => assert.match(cut(H, 'function formMailRecord'), /PuWorklog\.log\(o\.how === '받기' \? 'download' : 'mail_send'/));
test('서명 요청', () => assert.match(cut(H, 'function formSignCreate'), /PuWorklog\.log\('sign_request'/));
test('서식 저장', () => assert.match(cut(F, 'function change(fn, okMsg, undo)'), /host\.log && host\.log\('form_save'/));
```

- [ ] **Step 2: 실행해 실패 확인** — `node --test tests/worklog-hooks.test.js` → FAIL
- [ ] **Step 3: 고리 달기** — 각 함수의 성공 경로 끝에 한 줄. target/note 값: upload `{target: fileId, note: file.name}` · download `{target: fileId, note: name}` · mail/받기 `{target: coName, note: (o.names||[]).join(', ')}` · sign_request `{target: req.co, note: req.title}` · formZip `{note: 묶음 이름 + ' 묶음'}` · form_save `{note: okMsg || ''}`. 기록 실패가 본래 일을 막지 않게 `PuWorklog.log`의 promise는 기다리지 않는다. `pu-contract-forms.js` v=69, `pu-worklog.js` v=1.
- [ ] **Step 4: 통과 확인** — `node --test tests/worklog-hooks.test.js tests/office-forms-*.test.js` → PASS
- [ ] **Step 5: Commit** — `"계약서등관리 — 올리기·내려받기·메일·서명 요청·서식 저장을 작업 기록에"`

### Task 3: 작업 기록 화면 (총괄관리자만)

**Files:**
- Create: `js/pu-worklog-view.js`
- Modify: `docs-esign.html` (`PANES.log = 'paneLog'`, `paneFromHash`에 `#log`, 왼쪽 메뉴 `<button class="nav sub" data-pane="log" id="navLog" hidden>🧾 작업 기록</button>`, `<div id="paneLog" hidden><div id="logRoot"></div></div>`, 로그인 뒤 `uid_roles/{uid}/isAdmin === true`일 때만 `navLog.hidden = false`)
- Test: `tests/worklog-view.test.js`

**Interfaces:**
- Consumes: `PuWorklog.list`, `PuWorklog.KINDS`, `PuWorklog.monthKey`
- Produces: `PuWorklogView.mount(root, { list: (month) => Promise<Array>, kinds: object, now: () => number })`; 순수 함수 `PuWorklogView.shiftMonth('202611', -1) -> '202610'`, `PuWorklogView.filterRows(rows, { by?: string, kind?: string }) -> rows`, `PuWorklogView.people(rows) -> [{name, n}]` (많은 순)

- [ ] **Step 1: 실패하는 테스트** — `shiftMonth('202601', -1) === '202512'`, `shiftMonth('202612', 1) === '202701'`; `filterRows`가 by·kind를 함께 건다; `people`이 많은 순; mount가 빈 달에 「이 달에는 기록이 없습니다」를 그린다(jsdom 없이 `document` 대역은 `tests/office-docs-ui.test.js` 방식).
- [ ] **Step 2: 실패 확인** — `node --test tests/worklog-view.test.js` → FAIL
- [ ] **Step 3: 구현** — 위에 달 이동(‹ 2026년 11월 ›), 사람 칩·종류 칩, 표(시각 `MM.DD HH:mm` · 사람 · 종류 이름 · 대상 · 설명 · 자동이면 「🤖 자동」). docs-esign의 `showPane`에 `if (name === 'log' && !mounted.log) { … PuWorklogView.mount($('logRoot'), { list: PuWorklog.list, kinds: PuWorklog.KINDS, now: Date.now }) }`.
- [ ] **Step 4: 통과 확인** — `node --test tests/worklog-view.test.js` → PASS
- [ ] **Step 5: Commit** — `"작업 기록 화면 — 총괄관리자만, 달·사람·종류로 거르기"`

### Task 4: 견적 기록 저장 층 + 금액 잠금 규칙

**Files:**
- Create: `js/pu-quotes.js`
- Modify: `scripts/make-firebase-rules.js` (`rules.pu_quotes`, `rules.pu_quote_amt`), `docs/firebase-rules-전체-적용본.json`
- Test: `tests/quotes.test.js`, `tests/quotes-rules.test.js`

**Interfaces:**
- Consumes: `PuOfficeStore.coKey`, `PuWorklog.log`
- Produces:
  - `PuQuotes.TYPES` — 순서대로 `[{code:'education',label:'교육·강의'}, {code:'investigation',label:'괴롭힘·성희롱 조사'}, {code:'safety',label:'산업안전 컨설팅'}, {code:'hr_consult',label:'인사노무 컨설팅'}, {code:'bargaining',label:'임금·단체교섭'}, {code:'fund',label:'근로복지기금'}, {code:'opinion',label:'의견서'}, {code:'advice',label:'노무자문'}, {code:'case',label:'사건 대리'}, {code:'other',label:'기타'}]`
  - `PuQuotes.typeOf(text) -> code` (위 순서로 처음 맞는 것)
  - `PuQuotes.init({ db, uid, name })`
  - `PuQuotes.save(rec, amt) -> Promise<qid>` — `pu_quotes/{qid}` 먼저, 그다음 `pu_quote_amt/{qid}`(amt가 있을 때). 기록 `quote_save`.
  - `PuQuotes.list() -> Promise<Array<rec & {id}>>` (date 내림차순)
  - `PuQuotes.amounts(ids: string[]) -> Promise<{[qid]: amt}>` — 전체 읽기를 먼저 해 보고, 거절되면 id마다 읽어 거절은 건너뛴다.
  - `PuQuotes.confirmOwner(qid, uid) -> Promise` — `pu_quote_amt/{qid}/owner`를 쓴다(규칙상 isAdmin만), 기록 `owner_confirm`.
  - `PuQuotes.findBySrc(srcKey) -> Promise<qid|null>` (`orderByChild('srcKey').equalTo`)
  - rec 모양: `{doc:'quote'|'contract', type, co, coKey, date:'YYYY-MM-DD', scope?, period?, staff?:number, fileId?, srcKey?, src:{how:'mail'|'window'|'upload', slug?, key?}, ownerGuess?, review:'ok'|'check', by, at}`
  - amt 모양: `{amount:number, vat:'incl'|'excl'|'', owner:string, by, at}`

- [ ] **Step 1: 실패하는 테스트** — `tests/quotes.test.js`

```js
test('typeOf — 실제 제목들', () => {
  const t = Q.typeOf;
  assert.strictEqual(t('직무분석 컨설팅 견적서'), 'hr_consult');
  assert.strictEqual(t('현대제철(주) 직장 내 괴롭힘 및 성희롱 조사 용역 견적서'), 'investigation');
  assert.strictEqual(t('성희롱예방교육 견적서'), 'education');
  assert.strictEqual(t('산업안전 컨설팅 견적서'), 'safety');
  assert.strictEqual(t('인건비 원가산출에 관한 견적서'), 'hr_consult');
  assert.strictEqual(t("'27년 월 자문 견적서"), 'advice');
  assert.strictEqual(t('위임계약서_서산시청'), 'case');
  assert.strictEqual(t('견적서 등'), 'other');
});
test('save — 금액은 따로, undefined 없음', async () => { /* fakeDb: pu_quotes/{id} 에 amount 칸이 없고 pu_quote_amt/{id}.amount===4000000 */ });
test('amounts — 전체가 거절되면 하나씩, 거절은 건너뛴다', async () => { /* 가짜 db: 'pu_quote_amt' 거절, 'pu_quote_amt/q1' 허용, 'pu_quote_amt/q2' 거절 → {q1:{…}} */ });
```

- [ ] **Step 2: 실패 확인** — `node --test tests/quotes.test.js` → FAIL
- [ ] **Step 3: `js/pu-quotes.js` 구현** — `typeOf` 낱말(정규식): education `/교육|강의/`, investigation `/괴롭힘|성희롱/`, safety `/산업안전|중대재해|안전보건/`, hr_consult `/직무분석|규정|진단|인건비|원가|인사노무\s*컨설팅|컨설팅/`, bargaining `/교섭|임금협상/`, fund `/근로복지기금/`, opinion `/의견서/`, advice `/자문/`, case `/위임|대리|사건/`.
- [ ] **Step 4: 규칙 테스트** — `tests/quotes-rules.test.js`

```js
test('견적 기록 읽기는 재직 직원, 지우기는 관리자', () => { const r = GEN.rules.pu_quotes; assert.match(r['.read'], /status/); assert.match(r.$q['.write'], /newData\.exists\(\) \|\| .*isAdmin/); });
test('★★ 금액 전체 읽기는 isAdmin·fin 만', () => { const r = GEN.rules.pu_quote_amt['.read']; assert.match(r, /isAdmin/); assert.match(r, /'fin'/); assert.doesNotMatch(r, /isSubAdmin|status/); });
test('★★ 한 건 읽기는 확정 담당자만 더', () => assert.match(GEN.rules.pu_quote_amt.$q['.read'], /data\.child\('owner'\)\.val\(\) === auth\.uid/));
test('★ 담당자 바꾸기는 isAdmin 만 — 새로 쓸 때는 나 또는 빈칸', () => { const w = GEN.rules.pu_quote_amt.$q['.write']; assert.match(w, /!data\.exists\(\)/); assert.match(w, /isAdmin/); });
test('적용본이 만들개와 같다', () => { assert.deepStrictEqual(APPLY.rules.pu_quotes, GEN.rules.pu_quotes); assert.deepStrictEqual(APPLY.rules.pu_quote_amt, GEN.rules.pu_quote_amt); });
```

- [ ] **Step 5: 규칙 추가** — `pu_quotes: { '.read': LOGIN, '.indexOn': ['srcKey','at'], $q: { '.write': \`(${LOGIN}) && (newData.exists() || ${ADMIN})\`, '.validate': "newData.hasChildren(['doc','type','co','date','src','review','by','at'])", …칸마다 isString·길이(co 80, scope 300, period 60, ownerGuess 60, srcKey 200), staff isNumber, by: "newData.val() === auth.uid || newData.val() === data.val()", $other:false } }` · `pu_quote_amt: { '.read': \`auth != null && (${ADMIN} || ${FIN})\`, $q: { '.read': \`(${LOGIN}) && data.child('owner').val() === auth.uid\`, '.write': \`(${LOGIN}) && ((!data.exists() && (newData.child('owner').val() === auth.uid || newData.child('owner').val() === '')) || ${ADMIN})\`, amount: isNumber ≥0, vat: in ['incl','excl',''], owner: isString ≤40, by·at, $other:false } }`. 적용본 재생성.
- [ ] **Step 6: 통과 확인** — `node --test tests/quotes.test.js tests/quotes-rules.test.js` → PASS
- [ ] **Step 7: Commit** — `"견적 기록 저장 층·금액 잠금 규칙(대표·총괄·재무·확정 담당만)"`

### Task 5: 🔒 견적서 파일 열기 권한(서버)

**Files:**
- Create: `functions/doc-secret-access.js`
- Modify: `functions/index.js` (`exports.puDocSecret`, 지금 `isAdmin !== true`면 403 하는 자리)
- Modify: `docs-esign.html` (`fetchSecretDoc(fileId, qid)` — 본문에 `qid`가 있으면 함께 보낸다)
- Test: `functions/doc-secret-access.test.js`

**Interfaces:**
- Produces: `canOpenSecret({ role: object|null, uid: string, fileId: string, quote: object|null, amt: object|null }) -> boolean` — `role.isAdmin === true` → true; `quote && quote.fileId === fileId && (role.fin === true || (uid && amt && amt.owner === uid))` → true; 그 밖 false.
- `puDocSecret` 요청 본문: `{ fileId, qid? }` — qid는 `/^[-_A-Za-z0-9]{10,40}$/`일 때만 `pu_quotes/{qid}`·`pu_quote_amt/{qid}`를 읽는다. 거절 문구: 「🔒 이 파일은 대표·관리자·재무·담당자만 열 수 있습니다.」 `secret_log`에 `{fileId, by, at, qid?}`.

- [ ] **Step 1: 실패하는 테스트** — 관리자 true; 재무 + 맞는 quote true; 재무 + quote 없음 false; 담당자(owner===uid) true; 추정 담당(owner '') false; fileId 다른 quote false; 부관리자(isSubAdmin만) false.
- [ ] **Step 2: 실패 확인** — `node --test functions/doc-secret-access.test.js` → FAIL
- [ ] **Step 3: 구현 + `puDocSecret`이 `canOpenSecret`을 쓰게** (기존 `rec.secret === true`·경로 검사는 그대로).
- [ ] **Step 4: 통과 확인** — `node --test functions/doc-secret-access.test.js functions/*.test.js` → PASS
- [ ] **Step 5: Commit** — `"🔒 견적서 파일 — 재무·확정 담당자도 열기(puDocSecret)"`. 배포는 기존 `firebase-deploy` 워크플로(함수만) — PR 머지 뒤 대표 확인.

### Task 6: 「지난 견적·계약」 화면

**Files:**
- Create: `js/pu-quotes-view.js`
- Modify: `docs-esign.html` (`PANES.quotes = 'paneQuotes'`, `#quotes`, 메뉴 `💼 지난 견적·계약`(직원 모두), `<div id="paneQuotes" hidden><div id="quotesRoot"></div></div>`, `<script src="js/pu-quotes.js?v=1">`·`pu-quotes-view.js?v=1`, `PuQuotes.init`은 `officeInit`에서)
- Test: `tests/quotes-view.test.js`

**Interfaces:**
- Consumes: `PuQuotes.list/amounts/confirmOwner/TYPES`, `fetchSecretDoc(fileId, qid)`, `PuOfficeStore.saveBlob`
- Produces: `PuQuotesView.mount(root, host)` — host `{ list, amounts, confirmOwner, openFile(rec), role:{isAdmin, fin}, uid, staff: () => Promise<[{uid,name}]>, importer?: { run, count } }` (importer는 Task 7이 채운다, isAdmin일 때만). 순수: `groupByType(rows) -> [{code,label,rows}]`(TYPES 순서, 빈 묶음 뺌), `amountText(rec, amt) -> string`.
  - `amountText`: amt 있음 → `'4,000,000원 (부가세 별도)'`·`'(부가세 포함)'`·vat '' 이면 괄호 없음; amt 없음·rec.review==='check' 이고 볼 권한 있음 → `'확인 필요'`; 볼 권한 없음 → `'금액 비공개'`.
- 한 줄: 날짜 · 의뢰처 · 견적/계약 · 과업 내용 · 기간 · 인원(`n명`, 없으면 `—`) · 금액 · 담당(`담당(추정) 박한별` 또는 확정 이름) · 「열기」. isAdmin이면 추정 담당 옆 「담당 확정」(직원 고르기 → `confirmOwner`).

- [ ] **Step 1: 실패하는 테스트** — `groupByType` 순서·빈 묶음 제거; `amountText` 네 가지; 권한 없는 사람 mount 결과에 숫자 금액이 없다(`/\d{1,3}(,\d{3})+원/` 불일치).
- [ ] **Step 2: 실패 확인** — `node --test tests/quotes-view.test.js` → FAIL
- [ ] **Step 3: 구현** — 직원 목록은 기존 `uid_roles`가 아니라 화면에 이미 있는 담당자 목록 길(`PuWhoami`·이알피 담당자 목록 중 docs-esign에서 쓰는 것)을 쓴다; 없으면 「담당 확정」 단추를 숨긴다.
- [ ] **Step 4: 통과 확인** — `node --test tests/quotes-view.test.js` → PASS
- [ ] **Step 5: Commit** — `"지난 견적·계약 화면 — 업무 종류별, 금액은 권한자만"`

### Task 7: 보낸메일에서 지난 견적·계약 가져오기 (한 번 채우기)

**Files:**
- Create: `js/pu-quote-import.js`
- Modify: `js/pu-doc-read.js` (새 `readTextWithPrompt(prompt, text, opts)` — `runRawParts([{text: prompt}, {text: text}], opts)`; 내보내기에 추가)
- Modify: `docs-esign.html` (importer 연결: 보낸메일함 슬러그 찾기 `mailbox/folders` 키 중 `/^Sent Messages-/`, 첨부 받기 `readMailAttachment` POST `{slug, uid, index}` + Bearer, 🔒 저장 `PuOfficeStore.putOriginal({name, size, type, bytes}, 'quote', {secret:true})`, 한글 글자 뽑기는 `extractTemplateText`가 쓰는 `window.extractDocText(buf)`)
- Test: `tests/quote-import.test.js`

**Interfaces:**
- Consumes: `PuQuotes.save/findBySrc/typeOf`, `PuWorklog.log('auto_detect', {target, note, auto:'보낸메일 가져오기'})`, `PuDocRead.readWithPrompt`·`readTextWithPrompt`
- Produces:
  - `PuQuoteImport.isOurQuote(subject, attNames) -> boolean` — 제목 또는 첨부 이름에 `/견적/`; 제외 `/비교\s*견적서?\s*(요청|작성|회신)|견적\s*(의뢰|요청)|상품\s*견적|루나랩/`(제목 기준).
  - `PuQuoteImport.isOurContract(subject, attNames) -> boolean` — `/(자문|위임|용역|컨설팅|교육|위탁|대행)\s*계약서/`, 제외 `/근로계약서/`.
  - `PuQuoteImport.pickAtt(attNames, doc) -> index|-1` — pdf·hwp·hwpx 중 doc이 quote면 `/견적/`, contract면 `/계약서/` 이름; `푸른` 들어간 것 먼저.
  - `PuQuoteImport.candidates(msgs: {[key]: msg}, slug) -> [{slug, key, uid, subject, date, to, toName, doc, attIndex, attName, srcKey}]` — msg 칸: `s, d, t, tn, an(JSON 문자열), u`. srcKey = `slug + '|' + key`.
  - `PuQuoteImport.QUOTE_PROMPT` — 아래 글 그대로.
  - `PuQuoteImport.toRecord(c, fields, fileId, now) -> {rec, amt|null}` — fields(AI 답) → rec·amt. 금액이 숫자가 아니면 amt null·review 'check'. type은 `fields.업무종류`를 `typeOf`에 넣고, 안 맞으면 `typeOf(subject + ' ' + attName)`. date는 메일 `d`. src `{how:'mail', slug, key}`, ownerGuess = 메일 앱 「누가 보냈나」 값이 있으면(없으면 칸 뺌), owner ''.
  - `PuQuoteImport.runImport(list, host, onStep) -> Promise<{done, skipped, failed, left, stopped?: string}>` — 하나씩: `findBySrc`로 있으면 skipped; 첨부 받기 → 🔒 저장 → AI → save → 기록. AI가 한도 오류(`/한도|quota|429/`)면 멈추고 `stopped`에 이유, `left`에 남은 수.

```text
QUOTE_PROMPT =
이 문서는 푸른노무법인이 보낸 견적서 또는 계약서입니다. 아래 칸만 JSON 으로 답하세요. 문서에 없으면 빈 문자열.
{"의뢰처":"", "업무종류":"", "금액":"", "부가세":"포함|별도|", "기간":"", "과업내용":"", "직원수":""}
- 금액: 총액을 원 단위 숫자만(쉼표·원 빼고). 여러 안이면 첫 안.
- 과업내용: 150자 안으로 요약.
- 직원수: 의뢰처(고객사) 직원 수 숫자만.
```

- [ ] **Step 1: 실패하는 테스트** — 실제 제목으로:

```js
test('우리 견적만', () => {
  const f = I.isOurQuote;
  assert.ok(f('[푸른노무법인] 직무분석 컨설팅 견적서 송부의 건', ['견적서_인사노무컨설팅_충남어린이인성학습원_261106.pdf']));
  assert.ok(f('[푸른노무법인] 산업안전 컨설팅 견적서 송부의 건 (비교견적서 2부 추가)', []));
  assert.ok(!f('[푸른노무법인] 비교견적서 요청의 건', []));
  assert.ok(!f('RE: 비교견적서 작성 요청', ['견적서_직장 내 괴롭힘 조사 용역_푸른노무법인_261002.pdf']));
  assert.ok(!f('RE: RE: 견적의뢰를 요청합니다. (제이더블유인테크)', []));
  assert.ok(!f('RE: RE: RE: [푸른노무법인] 루나랩 모션 데스크 상품 견적 요청드립니다.', []));
});
test('우리 계약서만', () => { assert.ok(I.isOurContract('[푸른노무법인] 2026년 자문계약서 송부의 건', [])); assert.ok(!I.isOurContract('[푸른노무법인] 메디움천안요양병원 근로계약서 송부드립니다.', [])); });
test('pickAtt — 푸른 것 먼저', () => assert.strictEqual(I.pickAtt(['열린노무법인_비교견적서.pdf', '푸른노무법인_견적서_산업안전.pdf'], 'quote'), 1));
test('toRecord — 금액 못 읽으면 확인 필요', () => { const r = I.toRecord(cand, { 금액: '' }, 'f1', 1); assert.strictEqual(r.amt, null); assert.strictEqual(r.rec.review, 'check'); });
test('toRecord — 4,000,000', () => { const r = I.toRecord(cand, { 금액: '4000000', 부가세: '별도', 직원수: '30' }, 'f1', 1); assert.strictEqual(r.amt.amount, 4000000); assert.strictEqual(r.amt.vat, 'excl'); assert.strictEqual(r.rec.staff, 30); assert.strictEqual(r.amt.owner, ''); });
test('runImport — 이미 있으면 건너뛰고, 한도면 멈춘다', async () => { /* host.findBySrc: c1→'q1'; c2 AI → reject('하루 한도') → {done:0, skipped:1, left:2, stopped:/한도/} (c2·c3 남음) */ });
```

- [ ] **Step 2: 실패 확인** — `node --test tests/quote-import.test.js` → FAIL
- [ ] **Step 3: 구현** — `pu-quote-import.js`, `pu-doc-read.js`에 `readTextWithPrompt`(내보내기 추가, 버전 올리기), docs-esign 연결: 「지난 견적·계약」 위에 isAdmin만 보이는 「📥 보낸메일에서 가져오기 (n건)」 → 진행 줄(`3/63 · 직무분석 컨설팅 견적서…`) → 끝나면 결과 문장과 목록 새로 그림.
- [ ] **Step 4: 통과 확인** — `node --test tests/quote-import.test.js` → PASS
- [ ] **Step 5: 전체 테스트** — `node --test tests/*.test.js functions/*.test.js` → 새 실패 없음(기존 실패가 있으면 이 브랜치 전에도 있었는지 `git stash` 없이 `origin/main` 깨끗한 폴더에서 같은 테스트로 확인)
- [ ] **Step 6: Commit** — `"보낸메일에서 지난 견적·계약 가져오기(한 번 채우기, 한도면 멈춤)"`

### Task 8: 마무리 — 규칙 안내·PR

- [ ] **Step 1:** `docs/superpowers/specs/2026-11-07-quote-contract-auto-design.md` 끝 「8. 열린 질문」 아래에 「계획 1 반영」 한 줄(바뀐 자리 이름: `pu_worklog`, `pu_quotes`, `pu_quote_amt`).
- [ ] **Step 2:** 콘솔에 붙일 규칙 조각 안내(새 최상위 3개)를 PR 본문에 적는다 — 대표가 콘솔에 적용(CLI 배포 금지).
- [ ] **Step 3:** NUL 바이트 검사(Global Constraints 명령)로 바뀐 파일 전부 확인.
- [ ] **Step 4:** PR 전 제미나이 교차검증(사용자 CLAUDE.md — cross-check 스킬 「PR 전 자동 검증」), 결과 한 줄을 PR 본문에.
- [ ] **Step 5:** push · PR 생성(본문 끝 `🤖 Generated with [Claude Code](https://claude.com/claude-code)`).
