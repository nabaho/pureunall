# 전광판 포털 앱 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 포털 «영업관리» 줄에 «전광판» 앱(`pu-signboard.html`)을 넣는다 — 광고(글자·사진·동영상)를 만들고 기간을 정해 «전광판에 올리기», 올린 기록·되돌리기·심부름꾼 상태 보기. (설계서 M1 — **장비 없이 끝난다**)

**Architecture:** ① 광고의 «규칙»을 순수 함수 모듈로(`js/pu-signboard-core.js`, 포털과 심부름꾼이 함께 쓴다) ② 화면을 «글자로 만드는» 순수 함수(`js/pu-signboard-view.js`) ③ 얇은 HTML 연결(`pu-signboard.html`) ④ 온톨로지·포털 타일·실시간DB 규칙·창고 규칙. 저장은 전부 공용 관문(`PuOntologyWrite` 강제 모드)을 지난다. 이 화면은 장비와 직접 말하지 않는다 — 올린 판(`signboard/published`)을 이 PC의 심부름꾼이 가져간다(별도 계획서 `2026-10-12-signboard-agent.md`).

**Tech Stack:** 정적 HTML + 바닐라 JS(빌드 없음), Firebase compat 9.23(RTDB·Storage), `node:test`.

**Spec:** `docs/superpowers/specs/2026-10-12-signboard-design.md` — 구현을 실제로 돌려 보며 달라진 점은 §14 에 모아 두었다. **앞 절과 §14 가 다르면 §14 가 이긴다**(본문도 함께 고쳤다).

## Global Constraints (설계서·CLAUDE.md 에서 그대로)

- 읽기·쓰기 = `MGR`(관리자 `isAdmin` 또는 위임관리인 `isSubAdmin`). 일반 직원 열림 없음. 포털 타일은 `perm:'signboard'` 방식이다 — `adminOnly` 는 `role==='admin'` 만 통과시켜 위임관리인이 빠지므로 **쓰지 않는다**.
- 포털 줄은 «영업관리»(`row:'sales'`). 키 `signboard`, 이름 «전광판», 아이콘 📺, 파일 `pu-signboard.html`.
- 저장 자리는 `signboard/ads/{id}` · `signboard/published` · `signboard/history/{version}` · `signboard/control` **넷뿐**. `signboard/state` 는 심부름꾼이 쓴다 — 화면은 **읽기만**.
- 새 앱은 `PuOntologyWrite.createGateway({mode:'enforce'})` 로만 저장한다. `gate.remove` 금지 — 지우기는 `softDeleted` 레코드를 `gate.save`. 직접 `ref.set/update/push/remove/transaction` 금지.
- 거래 함수는 **찬 자리에서 먼저 `null` 로 불린다** — `null` 에서도 `id` 를 가진 레코드를 돌려줘야 한다(접히면 서버에 묻지도 않고 끝난다). 일부러 접을 때(`undefined`)는 «진짜 값이 있을 때만».
- 표의 한 칸은 «한 줄»(`white-space:nowrap` + `…` + `title`). 목록 맨 왼쪽은 ☐ + 번호. 폰 입력칸 16px 이상. 색은 27색 팔레트 안(`var(--…)`)만 — 화면에 새 `#rrggbb` 를 쓰지 않는다(LED 글자색은 «장비에 보낼 자료»라 `js/pu-signboard-core.js` 에 둔다).
- 앱끼리 창은 `PuAppBar.goApp` 만(새 탭 `_blank` 금지).
- 사람이 적은 글은 `esc()` 를 지난다. 검사에는 «지금 값»이 아니라 «규칙»을 못 박는다(값 자체가 규칙이면 같은 줄에 `검사고정-허용` + 이유).
- 한국어 주석, 노무 용어. 예시·검사·문서에 실제 사람 이름·전화번호를 쓰지 않는다(예시 번호는 `02-000-0000`).
- **공용 js(`pu-ontology.js`·`pu-appbar.js`)를 고치면 그것을 싣는 모든 html 의 `?v=` 를 올린다**(pre-commit 훅은 «막기만» 한다). 같은 번호를 두 번 올리지 않는다.
- 커밋은 «경로 지정»: `git add <파일들>` → `git commit -m "…" -- <파일들>` → `git show --stat HEAD` 로 내 파일만 들어갔는지 확인. 커밋 메시지 끝에는 이 세션의 공동 저자 줄을 붙인다.
- **푸시·규칙 올리기·창고 규칙 올리기는 Task 8(사람이 보는 방)에서만.** 이어하기 예약은 하지 않는다.

## Review Focus (설계서가 말하지만 기본 시험이 안 건드리는 «사람이 밟을 곳» — 각 줄의 시험은 아래 Task 에 들어 있다)

1. **두 사람이 동시에 «올리기»** — 늦게 누른 쪽은 접히고, 남이 올린 판·남의 기록은 그대로여야 한다. 오류 문구는 «영구 ID가 없습니다» 같은 관문 말이 아니라 «다른 사용자가 먼저 올렸습니다». (Task 5 `signboard-html` · Task 6 항목 12·13)
2. **광고 문구에 이모지·그림 글자** — 전광판 글꼴에 없어 네모로 나온다. 막지는 않고 편집 상자와 올리기 확인 창에서 알린다. (Task 1 `warnAd` · Task 5)
3. **시간대끼리 겹치거나 자정을 넘김** — 장비가 거절하거나 한쪽이 무시된다. 겹치면 오류, 맞닿는 것(12:00 끝·12:00 시작)은 허용, 자정을 넘기면 «둘로 나눠 적으세요». (Task 1 `validateAd`)
4. **광고를 전부 끄고 올리기(0건 판)** — 전광판을 통째로 비우는 사고. 화면이 막는다(심부름꾼도 0건 판은 안 보낸다). (Task 5 · Task 6 항목 26)
5. **올린 판은 올라갔는데 «기록» 쓰기만 실패** — 판 번호만 앞서고 기록이 비는 경우. 지금 판은 올린 판에서 직접 그려 주고, 토스트가 사실대로 말한다. (Task 5 `drawHist` 시험)

## 파일 구조

| 파일 | 책임 | |
|---|---|---|
| `js/pu-signboard-core.js` | 광고 한 건의 규칙: 검증·경고·기간 글·올릴 판 만들기·되돌리기·레코드 만들기 (순수) | 새 |
| `js/pu-signboard-view.js` | 광고 표·미리보기·편집 상자·상태 카드·올린 기록 표를 «글자(HTML)»로 (순수) | 새 |
| `pu-signboard.html` | 화면 연결: 로그인 잠금·읽기·저장(관문)·올리기·되돌리기·사진 올리기·이벤트 | 새 |
| `js/pu-ontology.js` | 개체 종류 셋·`PROGRAMS.signboard`·`READ_ADAPTERS.signboard_core` | 수정 |
| `enter.html` · `js/pu-appbar.js` | 포털 타일 / 앱 막대 항목(`perm:'signboard'`, «영업관리») | 수정 |
| `scripts/make-firebase-rules.js` | `rules.signboard`(MGR) | 수정 |
| `docs/firebase-rules-전체-적용본.json` · `docs/rules-paste.json` | 만들개가 낸 규칙 사본 둘 | 재생성 |
| `docs/firebase-storage-전체(붙여넣기용).txt` · `scripts/storage-rules-deploy.js` | 창고 `signboard/{file}` 칸 · `okSignVideo()` · «쓰는 자리» 목록 | 수정 |
| `tests/perf-rules.test.js` · `tests/color-palette-apps.test.js` | 새 최상위 자리·새 앱 등록부 | 수정 |
| `tests/signboard-{core,view,rules,storage-rule,html,ontology}.test.js` | 위 각 부분의 규칙 검사 | 새 |

## 작업 환경 (한 번만)

- **작업폴더:** `C:\Users\fair0\Documents\pu-wt-signboard` (Git Bash: `/c/Users/fair0/Documents/pu-wt-signboard`, 가지 `feat/signboard`). 이 계획만 쓰는 전용 폴더다. 공용 폴더(`Documents\pureunall`)는 옛 판이라 **거기서 일하지 않는다.**
- 시작할 때: `git fetch origin main && git rebase origin/main` (지금 이 가지에는 설계서·계획서 문서 커밋뿐이라 충돌이 없다).
- **도구 폴더(저장소 밖):** `C:\Users\fair0\AppData\Local\Temp\signboard-tools` (Git Bash: `/c/Users/fair0/AppData/Local/Temp/signboard-tools`). 아래 «도우미 스크립트»를 **Write 도구로** 이 폴더에 만든다. 저장소에 넣지 않는다.
- ⚠ 여러 줄 스크립트를 Bash 의 `cat <<'EOF'` 로 만들지 말 것 — 이 환경은 역슬래시(`\`)를 먹어 정규식·`\n` 이 깨진다. 파일은 Write 도구, 한 줄 수정은 Edit 도구.
- 줄끝: 새 파일은 LF 로 저장된다. `warning: LF will be replaced by CRLF` 는 무시한다(`git ls-files --eol <파일>` 이 `i/lf` 면 정상).
- 전체 검사는 따옴표 glob 으로: `node --test --test-concurrency=4 "tests/*.test.js"` (윈도에서 `tests/*.test.js` 를 셸이 펼치면 «Argument list too long» 으로 죽는다).

---

### Task 1: 광고 규칙 모듈 (`pu-signboard-core.js`)

**Files:**
- Create: `js/pu-signboard-core.js`
- Test: `tests/signboard-core.test.js`

**Interfaces:**
- Consumes: 없음(순수 — 브라우저에서는 `window.SignboardCore`, node 에서는 `require`).
- Produces (`SignboardCore`): 상수 `KINDS`·`FIT`·`WEEKDAYS`·`WEEKDAY_KO`·`EFFECTS`·`TEXT_ONLY_EFFECTS`·`LED_COLORS`·`MAX_IMAGE_BYTES`(10MB)·`MAX_VIDEO_BYTES`(50MB 가안)·`STATUS_KO`. 함수 `toArr(v)→Array` · `kstYmd(ms)→'YYYY-MM-DD'` · `isMediaUrl(url)→bool` · `normalizePeriod(p)` · `normalizeAd(a)`(빈 칸을 기본값으로 «채우기만») · `validateAd(a)→{ok,errors:[{field,message}]}` · `warnAd(a, nowMs?)→string[]` · `snapshotAd(a)` · `publishableAds(ads)→snapshot[]`(지운 것·꺼진 것 빼고 `order` 순) · `diffPublished(adsNow, publishedAds)→{added,removed,changed,reordered,total}` · `adStatus(a, nowMs)→'on'|'wait'|'ended'|'off'` · `periodSummary(period)→string` · `newAdId(nowMs, rnd)` · `newAd(kind,{id?,now?,rnd?,order?})` · `patchedAd(prev, known, patch)` · `softDeleted(prev, known, actor, now)` · `publishedRecord(prev, adsNow, actor, now, note)` · `rollbackRecord(prev, historyRec, actor, now)` · `historyRecord(published)`.

- [ ] **Step 1: 시험을 먼저 쓴다**

```js
/* 전광판 규칙 모듈(pu-signboard-core.js) — 광고 검증·기간·올릴 판·되돌리기 (2026-10-12)
   ★ «지금 값»이 아니라 «규칙»을 본다. 값 자체가 규칙인 곳(요일 표기 Thur 등)은 같은 줄에 이유를 적는다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/pu-signboard-core.js');

const URL_OK = 'https://firebasestorage.googleapis.com/v0/b/x/o/signboard%2Fa.jpg?alt=media&token=t';
function textAd(over) {
  return Object.assign(C.newAd('text', { id: 'ad_t1', order: 1 }), { title: '무료상담', text: Object.assign(C.newAd('text').text, { string: '부당해고 무료상담' }) }, over || {});
}
function imageAd(over) {
  const a = C.newAd('image', { id: 'ad_i1', order: 2 });
  a.title = '로고'; a.media = Object.assign(a.media, { url: URL_OK, size: 1234, name: 'a.jpg', contentType: 'image/jpeg' });
  return Object.assign(a, over || {});
}

test('정상 광고는 통과하고, 빈 제목·문구는 막는다', () => {
  assert.equal(C.validateAd(textAd()).ok, true);
  const r = C.validateAd(textAd({ title: ' ' }));
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.field === 'title'));
  const r2 = C.validateAd(Object.assign(textAd(), { text: Object.assign(textAd().text, { string: '' }) }));
  assert.ok(r2.errors.some((e) => e.field === 'text.string'));
});

test('범위 밖 값을 «조용히 깎지 않고» 오류로 말한다', () => {
  const t = textAd(); t.text.size = 500; t.text.effectSpeed = 9; t.text.holdSec = 0; t.text.color = 'red';
  const f = C.validateAd(t).errors.map((e) => e.field);
  ['text.size', 'text.effectSpeed', 'text.holdSec', 'text.color'].forEach((k) => assert.ok(f.includes(k), k));
  assert.equal(C.normalizeAd(t).text.size, 500, 'normalize 는 값을 바꾸지 않는다');
});

test('사진·동영상은 우리 창고 주소와 크기가 있어야 한다', () => {
  assert.equal(C.validateAd(imageAd()).ok, true);
  const noUrl = imageAd(); noUrl.media.url = 'http://evil.example/a.jpg';
  assert.ok(C.validateAd(noUrl).errors.some((e) => e.field === 'media.url'));
  const noSize = imageAd(); noSize.media.size = 0;
  assert.ok(C.validateAd(noSize).errors.some((e) => e.field === 'media.size'));
  const big = imageAd(); big.media.size = C.MAX_IMAGE_BYTES + 1;
  assert.ok(C.validateAd(big).errors.some((e) => e.field === 'media.size'));
});

test('사진에는 글자 전용 효과를 못 쓴다', () => {
  const a = imageAd(); a.media.effectType = 26;
  assert.ok(C.validateAd(a).errors.some((e) => e.field === 'media.effectType'));
});

test('기간 — 날짜·요일·시간대 규칙', () => {
  const a = textAd(); a.period = { start: '2026-10-20', end: '2026-10-13', weekdays: ['Mon'], times: [] };
  assert.ok(C.validateAd(a).errors.some((e) => e.field === 'period.end'), '끝이 시작보다 빠르면 막는다');
  const b = textAd(); b.period = { start: '2026-13-40', end: '', weekdays: [], times: [] };
  assert.ok(C.validateAd(b).errors.some((e) => e.field === 'period.start'), '없는 날짜');
  const c = textAd(); c.period = { start: '', end: '', weekdays: [], times: [{ start: '22:00', end: '06:00' }] };
  assert.ok(C.validateAd(c).errors.some((e) => e.field === 'period.times'), '자정을 넘기는 시간대는 둘로 나눠야 한다');
  const d = textAd(); d.period = { start: '2026-10-13', end: '2026-10-20', weekdays: ['Mon', 'Thur'], times: [{ start: '09:00', end: '18:00' }] };
  assert.equal(C.validateAd(d).ok, true);
});

test('요일 표기는 灰度 공식 문서의 철자(목요일 Thur)를 그대로 쓴다', () => {
  /* 검사고정-허용: 장비가 받는 값 자체가 규칙이다 — 灰度 공식 문서 3.2.1 playControl.week.enable 의 철자 */
  assert.deepEqual(C.WEEKDAYS, ['Mon', 'Tue', 'Wed', 'Thur', 'Fri', 'Sat', 'Sun']);
});

test('normalizeAd — 빈 배열·빈 칸이 사라진 «파이어베이스에서 읽은 모양»도 안전하다', () => {
  const n = C.normalizeAd({ id: 'a', kind: 'text', period: { weekdays: { 0: 'Fri', 1: 'Mon' }, times: { 0: { start: '09:00', end: '10:00' } } } });
  assert.deepEqual(n.period.weekdays, ['Mon', 'Fri'], '객체로 읽혀도 배열로, 월요일부터 정렬');
  assert.equal(n.period.times.length, 1);
  assert.equal(C.normalizeAd(null).period.weekdays.length, 0);
});

test('periodSummary — 비우면 «늘», 요일 7개 다 고르면 요일 말은 안 한다', () => {
  assert.equal(C.periodSummary(null), '늘');
  assert.equal(C.periodSummary({ weekdays: C.WEEKDAYS }), '늘');
  const s = C.periodSummary({ start: '2026-10-13', end: '2026-10-20', weekdays: ['Mon', 'Wed'], times: [{ start: '09:00', end: '18:00' }] });
  assert.match(s, /10\/13~10\/20/);
  assert.match(s, /월수/);
  assert.match(s, /09:00~18:00/);
});

test('adStatus — 꺼짐·시작 전·끝남·기간 안 (한국 날짜 기준)', () => {
  const noon = Date.UTC(2026, 9, 15, 3, 0, 0); // 한국 2026-10-15 12:00
  const mk = (p, en) => Object.assign(textAd(), { enabled: en !== false, period: Object.assign({ start: '', end: '', weekdays: [], times: [] }, p) });
  assert.equal(C.adStatus(mk({}, false), noon), 'off');
  assert.equal(C.adStatus(mk({ start: '2026-10-16' }), noon), 'wait');
  assert.equal(C.adStatus(mk({ end: '2026-10-14' }), noon), 'ended');
  assert.equal(C.adStatus(mk({ start: '2026-10-15', end: '2026-10-15' }), noon), 'on');
  const lateUtc = Date.UTC(2026, 9, 15, 16, 0, 0); // 한국은 10-16 01:00 — 날짜가 한국 기준으로 넘어간다
  assert.equal(C.adStatus(mk({ end: '2026-10-15' }), lateUtc), 'ended');
});

test('publishableAds — 지운 것·꺼진 것은 빼고 order 순서로, 한 가지 모양으로 만든다', () => {
  const a = textAd({ id: 'ad_a', order: 3 }), b = textAd({ id: 'ad_b', order: 1 }), c = textAd({ id: 'ad_c', order: 2, enabled: false }), d = textAd({ id: 'ad_d', order: 0, _deleted: true });
  const out = C.publishableAds({ ad_a: a, ad_b: b, ad_c: c, ad_d: d });
  assert.deepEqual(out.map((x) => x.id), ['ad_b', 'ad_a']);
  assert.ok(out[0].text && !out[0].media, '글자 광고는 text 만');
  const img = C.publishableAds([imageAd()])[0];
  assert.ok(img.media && !img.text, '사진 광고는 media 만');
});

test('diffPublished — 추가·삭제·내용 변경·순서 변경을 센다', () => {
  const a = textAd({ id: 'ad_a', order: 1 }), b = textAd({ id: 'ad_b', order: 2 });
  const pub = C.publishableAds([a, b]);
  assert.equal(C.diffPublished([a, b], pub).total, 0, '똑같으면 0');
  const a2 = textAd({ id: 'ad_a', order: 1 }); a2.text.string = '바뀐 문구';
  assert.equal(C.diffPublished([a2, b], pub).changed, 1);
  const cNew = textAd({ id: 'ad_c', order: 3 });
  assert.equal(C.diffPublished([a, b, cNew], pub).added, 1);
  assert.equal(C.diffPublished([a], pub).removed, 1);
  const swapped = [Object.assign({}, a, { order: 5 }), b];
  assert.equal(C.diffPublished(swapped, pub).reordered, 1);
  assert.equal(C.diffPublished([Object.assign({}, a, { enabled: false }), b], pub).removed, 1, '끄면 올린 판에서는 빠진 것');
});

test('찬 자리 거래(prev=null)에서도 id 를 가진 레코드를 돌려준다 — 접히지 않게', () => {
  const known = textAd({ id: 'ad_k' });
  const p = C.patchedAd(null, known, { title: '새 제목' });
  assert.equal(p.id, 'ad_k'); assert.equal(p.title, '새 제목');
  const del = C.softDeleted(null, known, 'A-001', 111);
  assert.equal(del.id, 'ad_k'); assert.equal(del._deleted, true); assert.equal(del.deletedBy, 'A-001');
  const pub = C.publishedRecord(null, [known], 'A-001', 5, '첫 판');
  assert.equal(pub.id, 'published'); assert.equal(pub.version, 1); assert.equal(pub.entityType, 'SignboardPublish');
});

test('올리기 — 판 번호가 1씩 늘고, 되돌리기도 «새 판 번호»로 올린다', () => {
  const a = textAd({ id: 'ad_a' });
  const v1 = C.publishedRecord(null, [a], 'A-001', 10, '');
  const v2 = C.publishedRecord(v1, [a, textAd({ id: 'ad_b', order: 2 })], 'A-001', 20, '');
  assert.equal(v2.version, 2); assert.equal(v2.ads.length, 2);
  const hist1 = C.historyRecord(Object.assign({}, v1, { revision: 9, createdAt: 1, updatedAt: 2 }));
  assert.equal(hist1.id, '1');
  ['revision', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy'].forEach((k) => assert.equal(k in hist1, false, '옛 수정 정보를 물려받지 않는다: ' + k));
  const back = C.rollbackRecord(v2, hist1, 'A-002', 30);
  assert.equal(back.version, 3, '되돌려도 번호는 앞으로 간다');
  assert.equal(back.ads.length, 1);
  assert.match(back.note, /1번 판/);
});

test('newAd — 제목은 비어 있고(검증이 막는다), id 는 파이어베이스 금지 글자가 없다', () => {
  const a = C.newAd('video');
  assert.equal(a.entityType, 'SignboardAd');
  assert.equal(C.validateAd(a).ok, false);
  assert.doesNotMatch(a.id, /[.#$/\[\]]/);
});

test('창고 주소만 받는다', () => {
  assert.equal(C.isMediaUrl(URL_OK), true);
  assert.equal(C.isMediaUrl('https://pureun-erp.firebasestorage.app/v0/b/x/o/a'), true);
  assert.equal(C.isMediaUrl('https://evil.example/a.jpg'), false);
  assert.equal(C.isMediaUrl('http://firebasestorage.googleapis.com/x'), false, 'http 는 안 된다');
});

test('시간대가 서로 겹치면 막고, 맞닿는 것(12:00 끝 · 12:00 시작)은 순서가 뒤바뀌어도 허용한다', () => {
  const a = textAd(); a.period = { start: '', end: '', weekdays: [], times: [{ start: '09:00', end: '12:00' }, { start: '11:00', end: '14:00' }] };
  assert.ok(C.validateAd(a).errors.some((e) => e.field === 'period.times' && /겹칩니다/.test(e.message)));
  a.period.times = [{ start: '12:00', end: '14:00' }, { start: '09:00', end: '12:00' }];
  assert.equal(C.validateAd(a).ok, true);
});

test('warnAd — 이모지와 이미 끝난 기간은 «막지 않고» 알린다', () => {
  const now = Date.UTC(2026, 9, 15, 3, 0, 0);
  const a = textAd(); a.text.string = '상담 😀';
  assert.equal(C.validateAd(a).ok, true, '막지는 않는다');
  assert.ok(C.warnAd(a).some((m) => m.includes('이모지')));
  const b = textAd(); b.period = { start: '', end: '2026-10-01', weekdays: [], times: [] };
  assert.ok(C.warnAd(b, now).some((m) => m.includes('종료일이 이미 지났습니다')));
  assert.deepEqual(C.warnAd(textAd(), now), []);
  assert.deepEqual(C.warnAd(b), [], '지금 시각을 모르면 기간 경고는 하지 않는다');
});

test('newAd — 종류에 맞는 덩어리만 만든다(글자 광고에 사진 칸을 저장해 두지 않는다)', () => {
  const t = C.newAd('text'), i = C.newAd('image'), v = C.newAd('video');
  assert.ok(t.text && !t.media);
  assert.ok(i.media && !i.text);
  assert.ok(v.media && !v.text);
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `cd /c/Users/fair0/Documents/pu-wt-signboard && node --test tests/signboard-core.test.js`
Expected: FAIL — `Cannot find module '../js/pu-signboard-core.js'`

- [ ] **Step 3: 규칙 모듈을 만든다**

```js
/* pu-signboard-core.js — 전광판: 광고 한 건의 «규칙» (2026-10-12)
   설계 docs/superpowers/specs/2026-10-12-signboard-design.md §4~§6
   ■ 순수 함수 — 화면·저장·네트워크 없음. 브라우저(pu-signboard.html)와 이 PC의 심부름꾼
     (scripts/signboard-agent)이 «같은 파일»을 쓴다 — 광고가 무엇인지의 정의가 두 벌이 되면 한쪽만 고쳐진다.
   ⚠ normalizeAd 는 빈 칸을 «기본값으로 채우기만» 한다. 범위 밖 값을 조용히 깎지 않는다 — 그건 validateAd 가 말한다.
   ⚠ 파이어베이스는 빈 배열·빈 칸을 저장하지 않는다. 읽을 때 늘 normalizeAd 를 거친다(toArr 포함). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SignboardCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var KINDS = { text: '글자', image: '사진', video: '동영상' };
  var FIT = { fill: '꽉 채움(가장자리 잘림)', center: '가운데(여백 생김)', stretch: '늘림(비율 깨짐)', tile: '타일' };
  /* 灰度 공식 문서의 요일 표기 그대로(목요일만 Thur) — 장비에 그대로 보낸다 */
  var WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thur', 'Fri', 'Sat', 'Sun'];
  var WEEKDAY_KO = { Mon: '월', Tue: '화', Wed: '수', Thur: '목', Fri: '금', Sat: '토', Sun: '일' };
  /* 灰度 효과 번호(공식 문서 3.2). 대표가 고르기 쉽게 자주 쓰는 것만 둔다. 26·30 은 «글자 전용»이다. */
  var EFFECTS = { 0: '바로 나타남', 1: '왼쪽으로 밀기', 2: '오른쪽으로 밀기', 3: '위로 밀기', 4: '아래로 밀기', 17: '서서히 바뀜', 26: '왼쪽으로 계속 흐름', 30: '깜빡임' };
  var TEXT_ONLY_EFFECTS = { 26: 1, 30: 1 };
  /* LED 에 잘 보이는 색 — 화면(html)의 색 팔레트 검사 밖에 두려고 여기 둔다(장비에 보낼 «자료»이지 화면 색이 아니다) */
  var LED_COLORS = [
    { name: '노랑', hex: '#ffff00' }, { name: '흰색', hex: '#ffffff' }, { name: '빨강', hex: '#ff0000' },
    { name: '초록', hex: '#00ff00' }, { name: '하늘', hex: '#00ffff' }, { name: '주황', hex: '#ff8000' },
    { name: '분홍', hex: '#ff00ff' }, { name: '파랑', hex: '#0000ff' }
  ];
  /* 가안 — 장비 저장공간을 읽은 뒤 확정한다(설계서 §5 [확인 필요]) */
  var MAX_IMAGE_BYTES = 10 * 1024 * 1024;
  var MAX_VIDEO_BYTES = 50 * 1024 * 1024;

  function str(v) { return v == null ? '' : String(v); }
  function num(v, dflt) { var n = Number(v); return v === '' || v == null || !isFinite(n) ? dflt : n; }
  function toArr(v) {
    if (Array.isArray(v)) return v.slice();
    if (v && typeof v === 'object') return Object.keys(v).sort(function (a, b) { return Number(a) - Number(b); }).map(function (k) { return v[k]; });
    return [];
  }
  function isYmd(s) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    var d = new Date(s + 'T00:00:00Z');
    return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }
  function isHm(s) { return /^([01]\d|2[0-3]):[0-5]\d$/.test(s); }
  function kstYmd(ms) { return new Date(ms + 9 * 3600e3).toISOString().slice(0, 10); }

  /* 사진·동영상은 우리 창고(firebase storage) 주소만 받는다 — 심부름꾼이 이 주소를 내려받는다 */
  function isMediaUrl(u) {
    return /^https:\/\/(firebasestorage\.googleapis\.com|storage\.googleapis\.com|[a-z0-9-]+\.firebasestorage\.app)\//.test(str(u));
  }

  function normalizePeriod(p) {
    p = p || {};
    var seen = {};
    var weekdays = toArr(p.weekdays).filter(function (w) { if (WEEKDAYS.indexOf(w) < 0 || seen[w]) return false; seen[w] = 1; return true; })
      .sort(function (a, b) { return WEEKDAYS.indexOf(a) - WEEKDAYS.indexOf(b); });
    var times = toArr(p.times).map(function (t) { return { start: str(t && t.start), end: str(t && t.end) }; });
    return { start: str(p.start), end: str(p.end), weekdays: weekdays, times: times };
  }

  function normalizeAd(a) {
    a = a || {};
    var t = a.text || {}, m = a.media || {};
    return {
      id: str(a.id), title: str(a.title), kind: str(a.kind), enabled: a.enabled !== false,
      order: num(a.order, 0),
      text: { string: str(t.string), size: num(t.size, 24), color: str(t.color) || '#ffff00', bold: t.bold === true,
        effectType: num(t.effectType, 0), effectSpeed: num(t.effectSpeed, 5), holdSec: num(t.holdSec, 5) },
      media: { path: str(m.path), url: str(m.url), name: str(m.name), contentType: str(m.contentType), size: num(m.size, 0),
        fit: str(m.fit) || 'fill', holdSec: num(m.holdSec, 5), effectType: num(m.effectType, 0), effectSpeed: num(m.effectSpeed, 5) },
      period: normalizePeriod(a.period)
    };
  }

  function validateAd(raw) {
    var a = normalizeAd(raw), errs = [];
    function bad(field, message) { errs.push({ field: field, message: message }); }
    function intIn(v, lo, hi) { return Number.isInteger(v) && v >= lo && v <= hi; }
    if (!a.title.trim()) bad('title', '제목을 적어 주세요 (목록에서 알아보는 이름입니다)');
    else if (a.title.length > 40) bad('title', '제목은 40자까지입니다');
    if (!KINDS[a.kind]) bad('kind', '종류(글자·사진·동영상)를 고르세요');
    if (a.kind === 'text') {
      var t = a.text;
      if (!t.string.trim()) bad('text.string', '전광판에 나갈 문구를 적어 주세요');
      else if (t.string.length > 200) bad('text.string', '문구는 200자까지입니다');
      if (!intIn(t.size, 8, 200)) bad('text.size', '글자 크기는 8~200 사이 정수입니다');
      if (!/^#[0-9a-fA-F]{6}$/.test(t.color)) bad('text.color', '글자 색이 올바르지 않습니다');
      if (!EFFECTS[t.effectType]) bad('text.effectType', '효과를 목록에서 고르세요');
      if (!intIn(t.effectSpeed, 0, 8)) bad('text.effectSpeed', '속도는 0(빠름)~8(느림)입니다');
      if (!intIn(t.holdSec, 1, 3600)) bad('text.holdSec', '머무는 시간은 1~3600초입니다');
    } else if (a.kind === 'image' || a.kind === 'video') {
      var m = a.media;
      if (!isMediaUrl(m.url)) bad('media.url', '파일을 올려 주세요');
      if (!(m.size > 0)) bad('media.size', '파일 크기를 알 수 없습니다 — 다시 올려 주세요');
      if (a.kind === 'image') {
        if (m.size > MAX_IMAGE_BYTES) bad('media.size', '사진은 10MB 까지입니다');
        if (!FIT[m.fit]) bad('media.fit', '맞춤 방식을 고르세요');
        if (!intIn(m.holdSec, 1, 3600)) bad('media.holdSec', '머무는 시간은 1~3600초입니다');
        if (!EFFECTS[m.effectType] || TEXT_ONLY_EFFECTS[m.effectType]) bad('media.effectType', '사진에 쓸 수 없는 효과입니다');
        if (!intIn(m.effectSpeed, 0, 8)) bad('media.effectSpeed', '속도는 0(빠름)~8(느림)입니다');
      } else if (m.size > MAX_VIDEO_BYTES) bad('media.size', '동영상은 ' + Math.round(MAX_VIDEO_BYTES / 1048576) + 'MB 까지입니다');
    }
    var p = a.period;
    if (p.start && !isYmd(p.start)) bad('period.start', '시작일 형식이 올바르지 않습니다');
    if (p.end && !isYmd(p.end)) bad('period.end', '종료일 형식이 올바르지 않습니다');
    if (isYmd(p.start) && isYmd(p.end) && p.start > p.end) bad('period.end', '종료일이 시작일보다 빠릅니다');
    p.times.forEach(function (t, i) {
      if (!isHm(t.start) || !isHm(t.end)) bad('period.times', (i + 1) + '번째 시간대 형식이 올바르지 않습니다 (예: 09:00)');
      else if (t.start >= t.end) bad('period.times', (i + 1) + '번째 시간대의 끝이 시작보다 늦어야 합니다 — 자정을 넘기면 둘로 나눠 적으세요');
    });
    /* 시간대끼리 겹치면 장비가 거절하거나 한쪽이 무시될 수 있다 — 맞닿는 것(12:00 끝 · 12:00 시작)은 괜찮다 */
    var okTimes = p.times.filter(function (t) { return isHm(t.start) && isHm(t.end) && t.start < t.end; }).sort(function (x, y) { return x.start < y.start ? -1 : 1; });
    for (var k = 1; k < okTimes.length; k++) { if (okTimes[k].start < okTimes[k - 1].end) { bad('period.times', '시간대가 서로 겹칩니다'); break; } }
    return { ok: errs.length === 0, errors: errs };
  }

  /* 올려도 «막지는 않지만» 알려 줄 것 — 전광판에서 이상하게 보이거나 아예 안 나오는 경우 */
  function warnAd(raw, nowMs) {
    var a = normalizeAd(raw), w = [];
    if (a.kind === 'text' && /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u.test(a.text.string)) w.push('이모지·그림 글자는 전광판 글꼴에 없어 네모(□)로 나올 수 있습니다');
    if (nowMs != null && a.period.end && a.period.end < kstYmd(nowMs)) w.push('종료일이 이미 지났습니다 — 올려도 전광판에 나오지 않습니다');
    return w;
  }

  /* 전광판에 «올라갈 수 있는 모양»만 남긴다 — 비교·보관·전송에 쓰는 한 가지 모양 */
  function snapshotAd(raw) {
    var a = normalizeAd(raw);
    var out = { id: a.id, title: a.title, kind: a.kind, period: a.period };
    if (a.kind === 'text') out.text = a.text; else out.media = a.media;
    return out;
  }
  function stable(v) {
    if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
    if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(function (k) { return JSON.stringify(k) + ':' + stable(v[k]); }).join(',') + '}';
    return JSON.stringify(v === undefined ? null : v);
  }
  /* 광고 목록(배열 또는 {id: 광고}) → 지금 올리면 나갈 광고들(지운 것·꺼진 것 빼고, 순서대로) */
  function publishableAds(ads) {
    return toArr(ads).filter(function (a) { return a && !a._deleted && a.enabled !== false; })
      .sort(function (x, y) { return (num(x.order, 0) - num(y.order, 0)) || (str(x.id) < str(y.id) ? -1 : 1); })
      .map(snapshotAd);
  }
  /* 올린 판과 지금 편집본이 얼마나 다른가 — «올리지 않은 변경 N건» */
  function diffPublished(adsNow, publishedAds) {
    var now = publishableAds(adsNow), old = toArr(publishedAds).map(snapshotAd), oldBy = {}, nowBy = {};
    old.forEach(function (a) { oldBy[a.id] = a; });
    now.forEach(function (a) { nowBy[a.id] = a; });
    var added = now.filter(function (a) { return !oldBy[a.id]; }).length;
    var removed = old.filter(function (a) { return !nowBy[a.id]; }).length;
    var changed = now.filter(function (a) { return oldBy[a.id] && stable(oldBy[a.id]) !== stable(a); }).length;
    var a1 = now.filter(function (a) { return oldBy[a.id]; }).map(function (a) { return a.id; }).join('|');
    var a2 = old.filter(function (a) { return nowBy[a.id]; }).map(function (a) { return a.id; }).join('|');
    var reordered = a1 !== a2 ? 1 : 0;
    return { added: added, removed: removed, changed: changed, reordered: reordered, total: added + removed + changed + reordered };
  }

  var STATUS_KO = { on: '기간 안', wait: '시작 전', ended: '끝남', off: '꺼짐' };
  function adStatus(raw, nowMs) {
    var a = normalizeAd(raw);
    if (!a.enabled) return 'off';
    var today = kstYmd(nowMs);
    if (a.period.start && today < a.period.start) return 'wait';
    if (a.period.end && today > a.period.end) return 'ended';
    return 'on';
  }
  function md(s) { var m = /^\d{4}-(\d{2})-(\d{2})$/.exec(s); return m ? Number(m[1]) + '/' + Number(m[2]) : ''; }
  function periodSummary(period) {
    var p = normalizePeriod(period), parts = [];
    if (p.start || p.end) parts.push((md(p.start) || '처음') + '~' + (md(p.end) || '계속'));
    if (p.weekdays.length && p.weekdays.length < 7) parts.push(p.weekdays.map(function (w) { return WEEKDAY_KO[w]; }).join(''));
    if (p.times.length) parts.push(p.times.map(function (t) { return t.start + '~' + t.end; }).join(', '));
    return parts.length ? parts.join(' · ') : '늘';
  }

  /* ── 저장할 레코드 만들기 ──
     ⚠★ 실제 RTDB 거래는 «찬 자리»에서 먼저 null 로 불린다. prev 가 null 이어도 id 를 가진 레코드를 돌려줘야 한다
        (메모리 rtdb-transaction-cold-abort — 그러지 않으면 서버에 묻지도 않고 접힌다). 그래서 «화면이 알던 레코드(known)»를 바탕으로 둔다.
     ⚠ 공용 gate.remove 를 쓰지 않는다 — 지우기는 softDeleted 로 만든 레코드를 gate.save 로 저장한다. */
  function newAdId(nowMs, rnd) { return 'ad_' + Number(nowMs).toString(36) + Math.floor(rnd * 1679616).toString(36).padStart(4, '0'); }
  function newAd(kind, o) {
    o = o || {};
    var base = { id: o.id || newAdId(o.now || Date.now(), o.rnd == null ? Math.random() : o.rnd), entityType: 'SignboardAd', title: '', kind: kind, enabled: true,
      order: num(o.order, 0), period: { start: '', end: '', weekdays: [], times: [] } };
    /* 종류에 맞는 덩어리만 — 글자 광고에 사진 칸을, 사진 광고에 글자 칸을 저장해 두지 않는다 */
    if (kind === 'text') base.text = normalizeAd({}).text; else base.media = normalizeAd({}).media;
    return base;
  }
  function patchedAd(prev, known, patch) { return Object.assign({}, prev || known || {}, patch || {}); }
  function softDeleted(prev, known, actor, now) {
    var b = Object.assign({}, prev || known || {});
    return Object.assign(b, { id: b.id, _deleted: true, deletedAt: now, deletedBy: actor });
  }
  function publishedRecord(prev, adsNow, actor, now, note) {
    var version = (prev && Number(prev.version) || 0) + 1;
    return Object.assign({}, prev || {}, { id: 'published', entityType: 'SignboardPublish', version: version, publishedAt: now, publishedBy: actor, note: str(note), ads: publishableAds(adsNow) });
  }
  function rollbackRecord(prev, historyRec, actor, now) {
    var version = (prev && Number(prev.version) || 0) + 1;
    return Object.assign({}, prev || {}, { id: 'published', entityType: 'SignboardPublish', version: version, publishedAt: now, publishedBy: actor,
      note: '되돌림: ' + historyRec.version + '번 판', ads: toArr(historyRec.ads).map(snapshotAd) });
  }
  /* 올린 기록 한 건 — 옛 수정 정보(revision·createdAt 등)를 물려받지 않게 «필요한 칸만» 골라 새로 만든다 */
  function historyRecord(p) {
    return { id: String(p.version), entityType: 'SignboardPublish', version: p.version, publishedAt: p.publishedAt, publishedBy: p.publishedBy, note: str(p.note), ads: toArr(p.ads).map(snapshotAd) };
  }

  return {
    KINDS: KINDS, FIT: FIT, WEEKDAYS: WEEKDAYS, WEEKDAY_KO: WEEKDAY_KO, EFFECTS: EFFECTS, TEXT_ONLY_EFFECTS: TEXT_ONLY_EFFECTS, LED_COLORS: LED_COLORS,
    MAX_IMAGE_BYTES: MAX_IMAGE_BYTES, MAX_VIDEO_BYTES: MAX_VIDEO_BYTES, STATUS_KO: STATUS_KO,
    toArr: toArr, kstYmd: kstYmd, isMediaUrl: isMediaUrl,
    normalizePeriod: normalizePeriod, normalizeAd: normalizeAd, validateAd: validateAd, warnAd: warnAd, snapshotAd: snapshotAd,
    publishableAds: publishableAds, diffPublished: diffPublished, adStatus: adStatus, periodSummary: periodSummary,
    newAdId: newAdId, newAd: newAd, patchedAd: patchedAd, softDeleted: softDeleted,
    publishedRecord: publishedRecord, rollbackRecord: rollbackRecord, historyRecord: historyRecord
  };
});
```

- [ ] **Step 4: 통과를 확인한다**

Run: `node --test tests/signboard-core.test.js`
Expected: PASS — `ℹ pass 18` · `ℹ fail 0`

- [ ] **Step 5: 커밋**

```bash
cd /c/Users/fair0/Documents/pu-wt-signboard
git add js/pu-signboard-core.js tests/signboard-core.test.js
git commit -m "feat(전광판): 광고 규칙 모듈 — 검증·경고·올릴 판·되돌리기 (순수 함수)" -- js/pu-signboard-core.js tests/signboard-core.test.js
git show --stat HEAD | tail -4
```
Expected: 파일 둘만 들어갔다.

---

### Task 2: 화면 부품 (`pu-signboard-view.js`)

**Files:**
- Create: `js/pu-signboard-view.js`
- Test: `tests/signboard-view.test.js`

**Interfaces:**
- Consumes: `SignboardCore`(Task 1) — 브라우저에서는 `window.SignboardCore`, node 에서는 `require('./pu-signboard-core.js')`.
- Produces (`SignboardView`): `esc(s)` · `ago(ms, now)` · `publishState(ad, pubById)` · `adsTable(ads,{sel,now,publishedAds})` · `bulkBar(n)` · `previewBox(ad, screen)` · `warnBox(list)` · `editorForm(ad, errors, isNew, now?)` · `adFromForm(base, values)→ad` · `stateCards(state, control, now)` · `historyTable(list, currentVersion)`. 화면 단추의 `data-*` 이름은 Task 5 의 이벤트가 듣는다: `data-edit` · `data-mv="up|down:ID"` · `data-en` · `data-all`/`data-ck` · `data-bulk-do` · `data-confirm-first` · `data-rollback`.

- [ ] **Step 1: 시험을 먼저 쓴다**

```js
/* 전광판 화면 부품(pu-signboard-view.js) — 표·미리보기·편집 상자·상태 카드 (2026-10-12)
   ★ 한 칸은 한 줄 · 맨 왼쪽 ☐ + 번호 · 사람이 적은 글은 esc · «모름»을 0 으로 그리지 않는다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/pu-signboard-core.js');
const V = require('../js/pu-signboard-view.js');

const URL_OK = 'https://firebasestorage.googleapis.com/v0/b/x/o/signboard%2Fa.jpg?alt=media&token=t';
const NOW = Date.UTC(2026, 9, 15, 3, 0, 0);
function ad(id, order, over) { const a = C.newAd('text', { id, order }); a.title = '광고 ' + id; a.text.string = '문구'; return Object.assign(a, over || {}); }

test('광고 표 — 맨 왼쪽 ☐ + 번호, 머리줄 ☐, 한 줄에 table 태그와 data-all·번호가 함께 있다', () => {
  const h = V.adsTable([ad('ad_a', 1), ad('ad_b', 2)], { now: NOW });
  const line = h.split('\n').find((l) => l.indexOf('<table') >= 0);
  assert.match(line, /data-all="ads"/); assert.match(line, /번호/);
  assert.match(h, /data-ck="ad_a"/); assert.match(h, /data-ck="ad_b"/);
  const first = h.indexOf('<td class="c">'), num = h.indexOf('<td class="n">');
  assert.ok(first > 0 && num > first, '☐ 칸이 번호 칸보다 앞');
});

test('광고 표 — 번호는 «보이는 순서»로 1부터 매기고, 지운 광고는 안 그린다', () => {
  const h = V.adsTable([ad('ad_b', 2), ad('ad_a', 1), ad('ad_x', 3, { _deleted: true })], { now: NOW });
  assert.deepEqual([...h.matchAll(/<td class="n">(\d+)<\/td>/g)].map((m) => m[1]), ['1', '2']);
  assert.ok(h.indexOf('ad_a') < h.indexOf('ad_b'), 'order 순서');
  assert.equal(h.includes('ad_x'), false);
});

test('광고 표 — 칸 안에서 줄을 바꾸거나 쌓지 않는다(한 칸은 한 줄)', () => {
  const h = V.adsTable([ad('ad_a', 1)], { now: NOW });
  assert.doesNotMatch(h, /<br/); assert.doesNotMatch(h, /<td[^>]*>\s*<div/);
  assert.match(h, /class="nw"/);
});

test('광고 표 — 사람이 적은 제목의 태그는 글자로 나온다(XSS)', () => {
  const h = V.adsTable([ad('ad_a', 1, { title: '<img src=x onerror=alert(1)>' })], { now: NOW });
  assert.equal(h.includes('<img src=x'), false);
  assert.match(h, /&lt;img/);
});

test('광고 표 — 전광판에 올라간 상태를 말해 준다(올라감·고침·새 광고·내림)', () => {
  const a = ad('ad_a', 1), b = ad('ad_b', 2), c = ad('ad_c', 3);
  const pub = C.publishableAds([a, b]);
  const b2 = Object.assign({}, b, { title: '바뀐 제목' });
  const h = V.adsTable([a, b2, c], { now: NOW, publishedAds: pub });
  assert.match(h, /✓ 올라감/); assert.match(h, /✎ 고침\(미반영\)/); assert.match(h, /＋ 새 광고\(미반영\)/);
  const down = V.adsTable([Object.assign({}, a, { enabled: false })], { now: NOW, publishedAds: pub });
  assert.match(down, /− 내림\(미반영\)/);
});

test('광고 표 — 첫 줄은 ▲ 못 누르고 끝 줄은 ▼ 못 누른다. 고른 줄은 checked', () => {
  const h = V.adsTable([ad('ad_a', 1), ad('ad_b', 2)], { now: NOW, sel: { ad_a: 1 } });
  assert.match(h, /data-mv="up:ad_a" disabled/); assert.match(h, /data-mv="down:ad_b" disabled/);
  assert.match(h, /data-ck="ad_a" checked/);
  assert.doesNotMatch(h, /data-ck="ad_b" checked/);
});

test('광고가 없으면 안내를 보여 준다', () => { assert.match(V.adsTable([], {}), /아직 광고가 없습니다/); });

test('일괄 처리 띠 — 고른 건수가 0 이면 비운다', () => {
  assert.equal(V.bulkBar(0), '');
  assert.match(V.bulkBar(3), /3건 선택/);
});

test('미리보기 — 장비 비율을 따르고, 모르면 자리표시임을 밝힌다', () => {
  const a = ad('ad_a', 1); a.text.string = '무료상담';
  const h = V.previewBox(a, { width: 192, height: 96 });
  assert.match(h, /aspect-ratio:192 \/ 96/); assert.match(h, /무료상담/);
  assert.match(V.previewBox(a, { width: 128, height: 64, assumed: true }), /자리표시/);
  assert.match(V.previewBox(a, null), /128×64/);
});

test('미리보기 — 사진·동영상은 우리 창고 주소만 그린다', () => {
  const img = C.newAd('image', { id: 'i' }); img.media.url = URL_OK;
  assert.match(V.previewBox(img), /<img /);
  const bad = C.newAd('image', { id: 'i' }); bad.media.url = 'https://evil.example/x.jpg';
  assert.doesNotMatch(V.previewBox(bad), /<img /);
  const vid = C.newAd('video', { id: 'v' }); vid.media.url = URL_OK;
  assert.match(V.previewBox(vid), /<video /);
});

test('미리보기 — 문구의 태그는 글자로 나온다', () => {
  const a = ad('ad_a', 1); a.text.string = '<script>alert(1)</script>';
  assert.equal(V.previewBox(a).includes('<script>'), false);
});

test('편집 상자 — 새 광고는 종류를 고르고, 있던 광고는 종류를 못 바꾼다', () => {
  assert.match(V.editorForm(C.newAd('text', { id: 'n' }), [], true), /name="f_kind"/);
  const h = V.editorForm(ad('ad_a', 1), [], false);
  assert.doesNotMatch(h, /name="f_kind"/); assert.match(h, /종류는 바꿀 수 없습니다/);
});

test('편집 상자 — 사진에는 글자 전용 효과가 목록에 없다', () => {
  const img = C.newAd('image', { id: 'i' });
  const h = V.editorForm(img, [], false);
  const sel = h.slice(h.indexOf('id="f_meffect"'), h.indexOf('</select>', h.indexOf('id="f_meffect"')));
  assert.equal(sel.includes('value="26"'), false); assert.equal(sel.includes('value="30"'), false);
  const t = V.editorForm(ad('ad_a', 1), [], false);
  assert.ok(t.includes('value="26"'), '글자에는 있다');
});

test('편집 상자 — 검증 오류를 그 칸 밑에 보여 준다', () => {
  const a = ad('ad_a', 1, { title: '' });
  const r = C.validateAd(a);
  assert.match(V.editorForm(a, r.errors, false), /class="ferr">제목을 적어 주세요/);
});

test('adFromForm — 화면 값이 광고가 된다(요일·시간대 포함, 빈 시간대는 버린다)', () => {
  const base = ad('ad_a', 1);
  const out = V.adFromForm(base, { title: ' 새 제목 ', kind: 'text', enabled: true, text: '문구\n둘째', size: '30', color: '#ff0000', bold: true, effect: '1', speed: '3', hold: '8',
    pstart: '2026-10-13', pend: '2026-10-20', wd: ['Mon', 'Fri'], times: [['09:00', '18:00'], ['', ''], ['', '']] });
  assert.equal(out.title, '새 제목'); assert.equal(out.id, 'ad_a');
  assert.deepEqual(out.text, { string: '문구\n둘째', size: 30, color: '#ff0000', bold: true, effectType: 1, effectSpeed: 3, holdSec: 8 });
  assert.deepEqual(out.period, { start: '2026-10-13', end: '2026-10-20', weekdays: ['Mon', 'Fri'], times: [{ start: '09:00', end: '18:00' }] });
  assert.equal(C.validateAd(out).ok, true);
});

test('adFromForm — 사진은 «이미 올려 둔 파일 정보»를 지우지 않는다', () => {
  const base = C.newAd('image', { id: 'i' }); base.media = Object.assign(base.media, { url: URL_OK, size: 55, name: 'a.jpg', path: 'signboard/i_1.jpg' });
  const out = V.adFromForm(base, { title: '로고', kind: 'image', enabled: true, fit: 'center', meffect: '17', mspeed: '2', mhold: '9', pstart: '', pend: '', wd: [], times: [] });
  assert.equal(out.media.url, URL_OK); assert.equal(out.media.size, 55); assert.equal(out.media.fit, 'center'); assert.equal(out.media.holdSec, 9);
  assert.equal(C.validateAd(out).ok, true);
});

test('상태 카드 — 심부름꾼이 20분 넘게 조용하면 경고, 기록이 없으면 «기록 없음»(0분이 아니다)', () => {
  const none = V.stateCards({}, {}, NOW);
  assert.match(none, /기록 없음/); assert.match(none, /20분 넘게 응답이 없습니다/);
  const ok = V.stateCards({ agentSeenAt: NOW - 3 * 60000, mode: 'live', result: 'ok', sentVersion: 4, sentAt: NOW - 60000, device: { width: 192, height: 96, time: 't', timeZone: 'z', luminance: '80' } }, {}, NOW);
  assert.match(ok, /3분 전/); assert.doesNotMatch(ok, /20분 넘게/); assert.match(ok, /192×96/);
});

test('상태 카드 — 장비 시계 경고와 연결 실패 사유가 나온다', () => {
  const h = V.stateCards({ agentSeenAt: NOW, deviceReachable: false, deviceError: 'ECONNREFUSED', clockWarning: '시간대가 한국이 아닙니다' }, {}, NOW);
  assert.match(h, /ECONNREFUSED/); assert.match(h, /시간대가 한국이 아닙니다/);
});

test('첫 전송 확인 — 기다리는 중에만 단추가 나오고, 허락하면 누가 했는지 나온다', () => {
  const st = { agentSeenAt: NOW, result: 'wait-confirm', existingPrograms: [{ uuid: 'u1', name: '옛 광고' }] };
  const wait = V.stateCards(st, {}, NOW);
  assert.match(wait, /data-confirm-first/); assert.match(wait, /1건/); assert.match(wait, /옛 광고/);
  const done = V.stateCards(st, { firstReplaceConfirmed: true, confirmedBy: 'A-001', confirmedAt: NOW }, NOW);
  assert.doesNotMatch(done, /data-confirm-first/); assert.match(done, /A-001/);
});

test('올린 기록 — 보기 전용 표, 지금 판에는 되돌리기 단추가 없다, 최신이 위', () => {
  const rows = [{ version: 1, publishedBy: 'A-001', publishedAt: NOW, ads: [1], note: '' }, { version: 2, publishedBy: 'A-002', publishedAt: NOW, ads: [1, 2], note: '되돌림: 1번 판' }];
  const h = V.historyTable(rows, 2);
  assert.match(h, /data-viewonly/);
  assert.ok(h.indexOf('2번') < h.indexOf('1번'));
  assert.match(h, /data-rollback="1"/); assert.doesNotMatch(h, /data-rollback="2"/);
  assert.match(V.historyTable([], 0), /올린 기록이 없습니다/);
});

test('편집 상자 — 경고(이모지·끝난 기간)는 맨 위에 보여 주고, 없으면 빈 칸이다', () => {
  const a = ad('ad_a', 1); a.text.string = '😀';
  assert.match(V.editorForm(a, [], false, NOW), /id="fWarn"><div class="warn">⚠ 이모지/);
  assert.match(V.editorForm(ad('ad_b', 1), [], false, NOW), /id="fWarn"><[/]div>/);
  assert.equal(V.warnBox([]), '');
  assert.match(V.warnBox(['<b>x</b>']), /&lt;b&gt;/, '경고 글도 글자로 나온다');
});

test('ago — 방금·분·시간·일', () => {
  assert.equal(V.ago(0, NOW), '기록 없음');
  assert.equal(V.ago(NOW - 10000, NOW), '방금');
  assert.equal(V.ago(NOW - 5 * 60000, NOW), '5분 전');
  assert.equal(V.ago(NOW - 3 * 3600000, NOW), '3시간 전');
  assert.equal(V.ago(NOW - 2 * 86400000, NOW), '2일 전');
});

test('편집 상자 — 올려 둔 파일 크기는 1MB 미만이면 KB 로 보여 준다', () => {
  const img = C.newAd('image', { id: 'i' }); img.media = Object.assign(img.media, { url: URL_OK, size: 1234, name: 'a.jpg' });
  assert.match(V.editorForm(img, [], false), /a\.jpg 1KB/);
  img.media.size = 3 * 1048576;
  assert.match(V.editorForm(img, [], false), /3\.0MB/);
});

test('광고 표 — 켜기 칸은 ☐ 하나이고, 켜진 광고는 checked', () => {
  const h = V.adsTable([ad('ad_a', 1), ad('ad_b', 2, { enabled: false })], { now: NOW });
  assert.match(h, /data-en="ad_a" checked/); assert.doesNotMatch(h, /data-en="ad_b" checked/);
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `node --test tests/signboard-view.test.js`
Expected: FAIL — `Cannot find module '../js/pu-signboard-view.js'`

- [ ] **Step 3: 화면 부품을 만든다**

```js
/* pu-signboard-view.js — 전광판 화면을 «글자(HTML)로 만드는» 순수 함수 (2026-10-12)
   설계 docs/superpowers/specs/2026-10-12-signboard-design.md §4.2
   ■ 읽기·쓰기·DOM 없음 — 화면(pu-signboard.html)은 이 글자를 innerHTML 로 꽂고 단추를 듣기만 한다. 그래서 node 로 검사할 수 있다.
   ⚠ 표의 한 칸은 «한 줄»이다 — 칸 안에 div 를 형제로 쌓지 않는다. 넘치면 … 와 title(전문).
   ⚠ 사람이 적은 글(제목·문구·메모·이름)은 반드시 esc() 를 지난다. */
(function (root, factory) {
  var core = root && root.SignboardCore;
  if (typeof module === 'object' && module.exports) core = require('./pu-signboard-core.js');
  var api = factory(core);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SignboardView = api;
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function ago(ms, now) {
    if (!ms) return '기록 없음';
    var m = Math.max(0, Math.round((now - ms) / 60000));
    if (m < 1) return '방금';
    if (m < 60) return m + '분 전';
    if (m < 1440) return Math.floor(m / 60) + '시간 전';
    return Math.floor(m / 1440) + '일 전';
  }
  function hm(ms) { return new Date(ms + 9 * 3600e3).toISOString().slice(5, 16).replace('T', ' '); }

  /* ── ① 광고 표 ── */
  /* 이 광고가 «올린 판»에 어떻게 올라가 있나 */
  function publishState(ad, pubById) {
    var snap = C.snapshotAd(ad), was = pubById[ad.id], enabled = ad.enabled !== false;
    if (!enabled) return was ? { k: 'down', t: '− 내림(미반영)' } : { k: 'none', t: '—' };
    if (!was) return { k: 'new', t: '＋ 새 광고(미반영)' };
    var same = JSON.stringify(C.snapshotAd(was)) === JSON.stringify(snap);
    return same ? { k: 'ok', t: '✓ 올라감' } : { k: 'chg', t: '✎ 고침(미반영)' };
  }
  function adsTable(ads, opt) {
    opt = opt || {};
    var sel = opt.sel || {}, now = opt.now || Date.now(), pub = {};
    C.toArr(opt.publishedAds).forEach(function (a) { if (a && a.id) pub[a.id] = a; });
    var list = C.toArr(ads).filter(function (a) { return a && !a._deleted; }).sort(function (x, y) { return (Number(x.order) || 0) - (Number(y.order) || 0) || (x.id < y.id ? -1 : 1); });
    if (!list.length) return '<div class="empty">아직 광고가 없습니다. 오른쪽 위 «+ 새 광고»로 만들어 보세요.</div>';
    var allOn = list.every(function (a) { return sel[a.id]; });
    var h = '<div class="bulk" data-bulk="ads"></div><div class="scroll"><table class="t" data-name="ads"><thead><tr><th class="c"><input type="checkbox" data-all="ads"' + (allOn ? ' checked' : '') + '></th><th class="n">번호</th><th>제목</th><th>종류</th><th>기간</th><th>상태</th><th>전광판</th><th>순서</th><th>켜기</th></tr></thead><tbody>';
    list.forEach(function (a, i) {
      var st = C.adStatus(a, now), ps = publishState(a, pub), period = C.periodSummary(a.period);
      h += '<tr data-id="' + esc(a.id) + '"><td class="c"><input type="checkbox" data-ck="' + esc(a.id) + '"' + (sel[a.id] ? ' checked' : '') + '></td>'
        + '<td class="n">' + (i + 1) + '</td>'
        + '<td class="ti"><a href="#" data-edit="' + esc(a.id) + '" title="' + esc(a.title) + '">' + esc(a.title || '(제목 없음)') + '</a></td>'
        + '<td class="nw">' + esc(C.KINDS[a.kind] || '?') + '</td>'
        + '<td class="nw" title="' + esc(period) + '">' + esc(period) + '</td>'
        + '<td class="nw"><span class="pill st-' + st + '">' + esc(C.STATUS_KO[st]) + '</span></td>'
        + '<td class="nw"><span class="pill ps-' + ps.k + '">' + esc(ps.t) + '</span></td>'
        + '<td class="nw"><button class="sm" data-mv="up:' + esc(a.id) + '"' + (i === 0 ? ' disabled' : '') + '>▲</button> <button class="sm" data-mv="down:' + esc(a.id) + '"' + (i === list.length - 1 ? ' disabled' : '') + '>▼</button></td>'
        + '<td class="nw"><label class="ck" title="켜면 전광판에 낸다 · 끄면 내린다"><input type="checkbox" data-en="' + esc(a.id) + '"' + (a.enabled !== false ? ' checked' : '') + '></label></td></tr>';
    });
    return h + '</tbody></table></div>';
  }
  /* 선택한 줄이 있을 때 표 위에 뜨는 일괄 처리 띠 */
  function bulkBar(n) {
    if (!n) return '';
    return '<b>' + n + '건 선택</b> <button class="sm" data-bulk-do="on">켜기</button> <button class="sm" data-bulk-do="off">끄기</button> <button class="sm" data-bulk-do="del">지우기</button> <button class="sm" data-bulk-do="clear">선택 풀기</button>';
  }

  /* ── 미리보기 (전광판 비율의 검은 상자) ──
     ⚠ 효과(밀기·깜빡임)는 미리보기에 나오지 않는다. 장비 크기를 모르면 자리표시 비율을 쓴다. */
  function previewBox(raw, screen) {
    var a = C.normalizeAd(raw), W = (screen && screen.width) || 128, H = (screen && screen.height) || 64, inner;
    if (a.kind === 'text') {
      var t = a.text;
      inner = '<div class="pvt" style="color:' + esc(t.color) + ';font-weight:' + (t.bold ? 700 : 400) + ';font-size:calc(' + Number(t.size) + ' / ' + H + ' * 100cqh)">' + esc(t.string || '문구가 여기에 보입니다').replace(/\n/g, '<br>') + '</div>';
    } else if (a.kind === 'image' && C.isMediaUrl(a.media.url)) {
      var fit = { fill: 'cover', center: 'contain', stretch: 'fill', tile: 'none' }[a.media.fit] || 'cover';
      inner = '<img class="pvm" src="' + esc(a.media.url) + '" style="object-fit:' + fit + '" alt="">';
    } else if (a.kind === 'video' && C.isMediaUrl(a.media.url)) {
      inner = '<video class="pvm" src="' + esc(a.media.url) + '" muted controls style="object-fit:contain"></video>';
    } else inner = '<div class="pvt pvhint">파일을 올리면 여기에 보입니다</div>';
    return '<div class="pv" style="aspect-ratio:' + W + ' / ' + H + '">' + inner + '</div><div class="hint">전광판 ' + W + '×' + H + (screen && screen.assumed ? ' (장비를 읽기 전 자리표시)' : '') + ' · 효과는 미리보기에 나오지 않습니다</div>';
  }

  /* ── 편집 상자 ── */
  function opts(map, cur) { return Object.keys(map).map(function (k) { return '<option value="' + esc(k) + '"' + (String(cur) === String(k) ? ' selected' : '') + '>' + esc(map[k]) + '</option>'; }).join(''); }
  function speedOpts(cur) { var m = {}; for (var i = 0; i <= 8; i++) m[i] = i === 0 ? '0 (가장 빠름)' : (i === 8 ? '8 (가장 느림)' : String(i)); return opts(m, cur); }
  function colorOpts(cur) { return C.LED_COLORS.map(function (c) { return '<option value="' + c.hex + '"' + (String(cur).toLowerCase() === c.hex ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join(''); }
  function effectsFor(kind) { var m = {}; Object.keys(C.EFFECTS).forEach(function (k) { if (kind === 'text' || !C.TEXT_ONLY_EFFECTS[k]) m[k] = C.EFFECTS[k]; }); return m; }
  /* 막지는 않지만 알려 줄 것(이모지·이미 끝난 기간) — 편집 상자 맨 위 */
  function warnBox(list) {
    return (list && list.length) ? '<div class="warn">' + list.map(function (m) { return '⚠ ' + esc(m); }).join('<br>') + '</div>' : '';
  }
  function editorForm(raw, errors, isNew, now) {
    var a = C.normalizeAd(raw), p = a.period, h = '<div id="fWarn">' + warnBox(C.warnAd(a, now)) + '</div>';
    var errBy = {}; (errors || []).forEach(function (e) { errBy[e.field] = e.message; });
    function row(label, field, html) { return '<div class="fr"><label>' + esc(label) + '</label><div class="fv">' + html + (errBy[field] ? '<div class="ferr">' + esc(errBy[field]) + '</div>' : '') + '</div></div>'; }
    h += row('제목', 'title', '<input id="f_title" type="text" maxlength="40" value="' + esc(a.title) + '" placeholder="목록에서 알아보는 이름">');
    h += row('종류', 'kind', isNew ? Object.keys(C.KINDS).map(function (k) { return '<label class="ck"><input type="radio" name="f_kind" value="' + k + '"' + (a.kind === k ? ' checked' : '') + '>' + esc(C.KINDS[k]) + '</label>'; }).join('')
      : '<b>' + esc(C.KINDS[a.kind] || '?') + '</b> <span class="hint">(종류는 바꿀 수 없습니다 — 새 광고로 만드세요)</span>');
    if (a.kind === 'text') {
      var t = a.text;
      h += row('문구', 'text.string', '<textarea id="f_text" rows="3" maxlength="200">' + esc(t.string) + '</textarea>');
      h += row('글자', 'text.size', '크기 <input id="f_size" type="number" min="8" max="200" value="' + esc(t.size) + '"> 색 <select id="f_color">' + colorOpts(t.color) + '</select> <label class="ck"><input id="f_bold" type="checkbox"' + (t.bold ? ' checked' : '') + '>굵게</label>');
      h += row('효과', 'text.effectType', '<select id="f_effect">' + opts(effectsFor('text'), t.effectType) + '</select> 속도 <select id="f_speed">' + speedOpts(t.effectSpeed) + '</select>');
      h += row('머무는 시간', 'text.holdSec', '<input id="f_hold" type="number" min="1" max="3600" value="' + esc(t.holdSec) + '"> 초');
    } else if (a.kind === 'image' || a.kind === 'video') {
      var m = a.media, mb = !m.size ? '' : (m.size < 1048576 ? Math.max(1, Math.round(m.size / 1024)) + 'KB' : (m.size / 1048576).toFixed(1) + 'MB');
      h += row(a.kind === 'image' ? '사진 파일' : '동영상 파일', 'media.url', '<input id="f_file" type="file" accept="' + (a.kind === 'image' ? 'image/*' : 'video/*') + '"> <span id="f_fileinfo" class="hint">' + (m.url ? esc(m.name || '올려 둔 파일') + ' ' + mb : '아직 올리지 않음') + '</span>' + (errBy['media.size'] ? '<div class="ferr">' + esc(errBy['media.size']) + '</div>' : ''));
      if (a.kind === 'image') {
        h += row('맞춤', 'media.fit', '<select id="f_fit">' + opts(C.FIT, m.fit) + '</select>');
        h += row('효과', 'media.effectType', '<select id="f_meffect">' + opts(effectsFor('image'), m.effectType) + '</select> 속도 <select id="f_mspeed">' + speedOpts(m.effectSpeed) + '</select>');
        h += row('머무는 시간', 'media.holdSec', '<input id="f_mhold" type="number" min="1" max="3600" value="' + esc(m.holdSec) + '"> 초');
      }
    }
    var wd = C.WEEKDAYS.map(function (w) { return '<label class="ck"><input type="checkbox" data-wd="' + w + '"' + (p.weekdays.indexOf(w) >= 0 ? ' checked' : '') + '>' + C.WEEKDAY_KO[w] + '</label>'; }).join('');
    var tr = ''; for (var i = 0; i < 3; i++) { var tt = p.times[i] || { start: '', end: '' }; tr += '<div class="tr"><input type="time" data-ts="' + i + '" value="' + esc(tt.start) + '"> ~ <input type="time" data-te="' + i + '" value="' + esc(tt.end) + '"></div>'; }
    h += '<div class="sec">언제 나가나 — 비우면 «늘» 나갑니다</div>';
    h += row('기간', 'period.end', '<input id="f_pstart" type="date" value="' + esc(p.start) + '"> ~ <input id="f_pend" type="date" value="' + esc(p.end) + '">' + (errBy['period.start'] ? '<div class="ferr">' + esc(errBy['period.start']) + '</div>' : ''));
    h += row('요일', 'period.weekdays', wd);
    h += row('시간대', 'period.times', '<div class="trs">' + tr + '</div><div class="hint">하루 안에서만 적습니다 — 자정을 넘기면 둘로 나눠 적으세요</div>');
    h += row('켜기', 'enabled', '<label class="ck"><input id="f_enabled" type="checkbox"' + (a.enabled ? ' checked' : '') + '>이 광고를 전광판에 낸다</label>');
    return h;
  }
  /* 편집 상자가 읽어 온 값(v) → 광고. 파일 정보(media)는 «이미 올려 둔 것»을 바탕으로 둔다 */
  function adFromForm(base, v) {
    var a = C.normalizeAd(base);
    var out = JSON.parse(JSON.stringify(Object.assign({}, base || {}, { title: String(v.title || '').trim(), kind: v.kind || a.kind, enabled: v.enabled !== false })));
    if (out.kind === 'text') {
      out.text = { string: String(v.text == null ? '' : v.text), size: Number(v.size), color: String(v.color || a.text.color), bold: v.bold === true, effectType: Number(v.effect), effectSpeed: Number(v.speed), holdSec: Number(v.hold) };
    } else if (out.kind === 'image' || out.kind === 'video') {
      var m = Object.assign({}, a.media, (base && base.media) || {});
      if (out.kind === 'image') { m.fit = String(v.fit || m.fit); m.effectType = Number(v.meffect); m.effectSpeed = Number(v.mspeed); m.holdSec = Number(v.mhold); }
      out.media = m;
    }
    out.period = { start: String(v.pstart || ''), end: String(v.pend || ''), weekdays: (v.wd || []).slice(),
      times: (v.times || []).filter(function (t) { return t && (t[0] || t[1]); }).map(function (t) { return { start: String(t[0] || ''), end: String(t[1] || '') }; }) };
    return out;
  }

  /* ── ③ 전광판 상태 ── */
  var RESULT_KO = { ok: '정상', fail: '실패', 'dry-run': '시험 모드(장비에 연결 안 함)', 'wait-confirm': '첫 전송 확인 기다림', skip: '보내지 않음' };
  function stateCards(state, control, now) {
    state = state || {}; control = control || {};
    var stale = !state.agentSeenAt || now - state.agentSeenAt > 20 * 60000, d = state.device || {}, h = '';
    h += '<div class="card cardp"><h3>심부름꾼(이 PC)</h3><div class="kv"><span>마지막 응답</span><b class="' + (stale ? 'bad' : 'good') + '">' + esc(ago(state.agentSeenAt, now)) + '</b></div>'
      + (stale ? '<div class="warn">심부름꾼이 20분 넘게 응답이 없습니다 — PC가 꺼졌거나 로그인이 풀렸을 수 있습니다. 이미 보낸 광고는 전광판 안에서 계속 돕니다.</div>' : '')
      + '<div class="kv"><span>모드</span><b>' + (state.mode === 'live' ? '실전' : (state.mode === 'dry-run' ? '시험 모드' : '모름')) + '</b></div></div>';
    h += '<div class="card cardp"><h3>마지막 전송</h3><div class="kv"><span>결과</span><b class="' + (state.result === 'fail' ? 'bad' : (state.result === 'ok' ? 'good' : '')) + '">' + esc(RESULT_KO[state.result] || '기록 없음') + '</b></div>'
      + (state.sentVersion ? '<div class="kv"><span>보낸 판</span><b>' + esc(state.sentVersion) + '번 · ' + esc(ago(state.sentAt, now)) + '</b></div>' : '')
      + (state.dryRunVersion ? '<div class="kv"><span>시험 기록</span><b>' + esc(state.dryRunVersion) + '번 판</b></div>' : '')
      + (state.message ? '<div class="note">' + esc(state.message) + '</div>' : '') + '</div>';
    h += '<div class="card cardp"><h3>전광판 장비</h3>'
      + (state.deviceReachable === false ? '<div class="warn">장비에 연결되지 않습니다: ' + esc(state.deviceError || '') + '</div>' : '')
      + (d.width ? '<div class="kv"><span>화면</span><b>' + esc(d.width) + '×' + esc(d.height) + '</b></div><div class="kv"><span>장비 시계</span><b>' + esc(d.time) + '</b></div><div class="kv"><span>시간대</span><b>' + esc(d.timeZone) + '</b></div><div class="kv"><span>밝기</span><b>' + esc(d.luminance) + '</b></div>' : '<div class="note">아직 장비 정보를 읽지 못했습니다(시험 모드이거나 연결 전).</div>')
      + (state.clockWarning ? '<div class="warn">' + esc(state.clockWarning) + '</div>' : '') + '</div>';
    if (state.result === 'wait-confirm' && control.firstReplaceConfirmed !== true) {
      var ex = C.toArr(state.existingPrograms);
      h += '<div class="card cardp confirm"><h3>⚠ 첫 전송 전 확인</h3><div class="note">전광판에 지금 들어 있는 광고 <b>' + ex.length + '건</b>이 첫 전송 때 <b>지워집니다</b>.</div>'
        + (ex.length ? '<div class="note">' + ex.map(function (x) { return esc(x.name || x.uuid); }).join(' · ') + '</div>' : '')
        + '<button class="pri" data-confirm-first>지워도 됩니다 — 전송을 허락합니다</button></div>';
    } else if (control.firstReplaceConfirmed === true) {
      h += '<div class="card cardp"><h3>첫 전송 확인</h3><div class="note">' + esc(control.confirmedBy || '') + ' 님이 ' + esc(ago(control.confirmedAt, now)) + ' 허락했습니다.</div></div>';
    }
    return h;
  }

  /* ── ④ 올린 기록 (보기 전용 표 — 되돌리기 단추만) ── */
  function historyTable(list, currentVersion) {
    var rows = C.toArr(list).filter(Boolean).sort(function (a, b) { return Number(b.version) - Number(a.version); });
    if (!rows.length) return '<div class="empty">아직 올린 기록이 없습니다.</div>';
    var h = '<div class="scroll"><table class="t" data-viewonly="1"><thead><tr><th>판</th><th>올린 사람</th><th>올린 때</th><th>광고 수</th><th>메모</th><th></th></tr></thead><tbody>';
    rows.forEach(function (r) {
      var cur = Number(r.version) === Number(currentVersion);
      h += '<tr><td class="nw">' + esc(r.version) + '번' + (cur ? ' <span class="pill ps-ok">지금</span>' : '') + '</td><td class="nw">' + esc(r.publishedBy || '') + '</td><td class="nw">' + esc(hm(r.publishedAt)) + '</td>'
        + '<td class="nw">' + C.toArr(r.ads).length + '</td><td class="nw" title="' + esc(r.note || '') + '">' + esc(r.note || '') + '</td>'
        + '<td class="nw">' + (cur ? '' : '<button class="sm" data-rollback="' + esc(r.version) + '">이 판으로 되돌리기</button>') + '</td></tr>';
    });
    return h + '</tbody></table></div>';
  }

  return { esc: esc, ago: ago, publishState: publishState, adsTable: adsTable, bulkBar: bulkBar, previewBox: previewBox, warnBox: warnBox, editorForm: editorForm, adFromForm: adFromForm, stateCards: stateCards, historyTable: historyTable };
});
```

- [ ] **Step 4: 통과를 확인한다**

Run: `node --test tests/signboard-view.test.js tests/signboard-core.test.js`
Expected: PASS — 두 파일 합쳐 `ℹ pass 42` · `ℹ fail 0`

- [ ] **Step 5: 커밋**

```bash
cd /c/Users/fair0/Documents/pu-wt-signboard
git add js/pu-signboard-view.js tests/signboard-view.test.js
git commit -m "feat(전광판): 화면 부품 — 광고 표·미리보기·편집 상자·상태 카드 (순수 함수)" -- js/pu-signboard-view.js tests/signboard-view.test.js
git show --stat HEAD | tail -4
```

---

### Task 3: 실시간DB 규칙 `signboard` (만들개에서만)

**Files:**
- Modify: `scripts/make-firebase-rules.js`(govaid 블록 바로 뒤), `tests/perf-rules.test.js`(`allowTop`)
- Regenerate: `docs/firebase-rules-전체-적용본.json`, `docs/rules-paste.json`
- Create: `tests/signboard-rules.test.js`
- 도구(저장소 밖): `signboard-tools/integrate.js`

**Interfaces:**
- Consumes: 만들개의 `MGR`(`auth != null && (isAdmin || isSubAdmin)`).
- Produces: `rules.signboard = { '.read': MGR, ads:{$id}, published, history:{$v}, control, state:{'.write':false} }`. Task 5 의 온톨로지 `writeContracts` 가 이 모양과 짝이다.

- [ ] **Step 1: 규칙 시험을 먼저 쓴다**

```js
/* 전광판 규칙 — 관리자·위임관리인만 · 지우기 금지 · 열쇠와 id 일치 · state 는 화면에서 아무도 못 씀 (2026-10-12)
   읽는 것은 만들개의 출력(docs/firebase-rules-전체-적용본.json)이다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rules = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'docs', 'firebase-rules-전체-적용본.json'), 'utf8')).rules;

class Snap {
  constructor(v) { this.v = v; }
  child(p) { let c = this.v; for (const k of String(p).split('/')) c = c && typeof c === 'object' ? c[k] : undefined; return new Snap(c); }
  val() { return this.v === undefined ? null : this.v; }
  exists() { return this.v !== undefined && this.v !== null; }
}
const root = new Snap({ uid_roles: {
  adminUid: { status: 'active', sid: 'A-001', isAdmin: true },
  subUid: { status: 'active', sid: 'A-002', isSubAdmin: true },
  staffUid: { status: 'active', sid: 'A-003' },
  retiredUid: { status: 'retired', sid: 'P-004' },
} });
function auth(uid) { return { uid, token: { firebase: { sign_in_provider: 'password' }, email: uid + '@pureun.kr' } }; }
function ev(expr, o) {
  o = o || {};
  const names = ['auth', 'root', 'data', 'newData', '$id', '$v'];
  const vals = [o.auth || null, root, new Snap(o.data), new Snap(o.newData), o.$id || '', o.$v || ''];
  return Function(...names, '"use strict"; return Boolean(' + expr + ');')(...vals);
}
const S = rules.signboard;

test('규칙에 signboard 자리가 있다', () => { assert.ok(S, '만들개에 rules.signboard 가 없다'); });

test('읽기 — 관리자와 위임관리인만. 일반 직원·퇴직자·남은 못 읽는다', () => {
  assert.equal(ev(S['.read'], { auth: auth('adminUid') }), true);
  assert.equal(ev(S['.read'], { auth: auth('subUid') }), true);
  assert.equal(ev(S['.read'], { auth: auth('staffUid') }), false);
  assert.equal(ev(S['.read'], { auth: auth('retiredUid') }), false);
  assert.equal(ev(S['.read'], { auth: auth('outsider') }), false);
  assert.equal(ev(S['.read'], {}), false);
});

test('쓰기 — 관리자·위임관리인만, 빈 값(지우기)은 아무도', () => {
  const w = S.ads.$id['.write'];
  assert.equal(ev(w, { auth: auth('adminUid'), newData: { id: 'ad_1' } }), true);
  assert.equal(ev(w, { auth: auth('subUid'), newData: { id: 'ad_1' } }), true);
  assert.equal(ev(w, { auth: auth('staffUid'), newData: { id: 'ad_1' } }), false, '일반 직원은 못 쓴다');
  assert.equal(ev(w, { auth: auth('adminUid'), newData: null }), false, '지우기 금지');
  ['published', 'control'].forEach((k) => {
    assert.equal(ev(S[k]['.write'], { auth: auth('staffUid'), newData: { id: k } }), false, k);
    assert.equal(ev(S[k]['.write'], { auth: auth('adminUid'), newData: { id: k } }), true, k);
    assert.equal(ev(S[k]['.write'], { auth: auth('adminUid'), newData: null }), false, k + ' 지우기 금지');
  });
  assert.equal(ev(S.history.$v['.write'], { auth: auth('staffUid'), newData: { id: '3' } }), false);
});

test('열쇠와 레코드 id 가 어긋나면 막는다', () => {
  assert.equal(ev(S.ads.$id['.validate'], { newData: { id: 'ad_1' }, $id: 'ad_1' }), true);
  assert.equal(ev(S.ads.$id['.validate'], { newData: { id: 'ad_2' }, $id: 'ad_1' }), false);
  assert.equal(ev(S.history.$v['.validate'], { newData: { id: '3' }, $v: '3' }), true);
  assert.equal(ev(S.history.$v['.validate'], { newData: { id: '4' }, $v: '3' }), false);
  assert.equal(ev(S.published['.validate'], { newData: { id: 'published' } }), true);
  assert.equal(ev(S.published['.validate'], { newData: { id: 'other' } }), false);
  assert.equal(ev(S.control['.validate'], { newData: { id: 'control' } }), true);
});

test('state 는 화면에서 아무도 못 쓴다 — 심부름꾼(관리자 권한 CLI)만', () => {
  assert.equal(S.state['.write'], false);
  assert.equal(S.state['.read'], undefined, '읽기는 위(signboard)에서 MGR 로 내려온다');
});

test('알려지지 않은 하위 칸에는 쓰기 규칙이 없다 — 기본은 막힘', () => {
  assert.deepEqual(Object.keys(S).sort(), ['.read', 'ads', 'control', 'history', 'published', 'state']);
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `node --test tests/signboard-rules.test.js`
Expected: FAIL — `만들개에 rules.signboard 가 없다`

- [ ] **Step 3: 도우미 스크립트 `integrate.js` 를 도구 폴더에 만든다 (Write 도구, 저장소 밖)**

`C:\Users\fair0\AppData\Local\Temp\signboard-tools\integrate.js` — 구역 `app`(Task 5) · `rules`(이 Task) · `storage`(Task 4)를 나눠 돌린다. 앵커가 «정확히 한 번» 나오지 않으면 그 파일은 쓰지 않고 멈추고, 이미 넣었으면 건너뛴다.

```js
/* 전광판 앱을 포털·온톨로지·규칙·검사 등록부에 «한 번에» 넣는다 (설계서 §4.1·§5)
   쓰는 법: node integrate.js <저장소 뿌리>
   ⚠ 앵커가 «정확히 한 번» 나오지 않으면 그 파일은 쓰지 않고 멈춘다. 이미 넣었으면 건너뛴다(여러 번 돌려도 안전). */
const fs = require('fs');
const path = require('path');
const root = process.argv[2] || process.cwd();
/* 구역: app(온톨로지·포털 타일·팔레트 등록부) · rules(실시간DB 규칙·짝 검사) · storage(창고 규칙).  구역을 안 적으면 전부.
   쓰는 법: node integrate.js <뿌리> [app|rules|storage] */
const only = process.argv[3] || '';
const SECTION = {
  'js/pu-ontology.js': 'app', 'enter.html': 'app', 'js/pu-appbar.js': 'app', 'tests/color-palette-apps.test.js': 'app',
  'scripts/make-firebase-rules.js': 'rules', 'tests/perf-rules.test.js': 'rules',
  'docs/firebase-storage-전체(붙여넣기용).txt': 'storage', 'scripts/storage-rules-deploy.js': 'storage'
};
const on = (name) => !only || only === name;

/* 파일 하나를 고친다 — 줄끝(CRLF/LF)은 그대로 지킨다. steps: [{ skipIf, after, insert }] «after 바로 뒤»에 insert 를 넣는다 */
function edit(file, steps) {
  if (!on(SECTION[file])) return;
  const p = path.join(root, file);
  const raw = fs.readFileSync(p, 'utf8');
  const crlf = raw.indexOf('\r\n') >= 0;
  let s = raw.replace(/\r\n/g, '\n');
  steps.forEach(function (st) {
    if (s.indexOf(st.skipIf) >= 0) { console.log('  건너뜀(이미 있음):', file, '·', st.skipIf.slice(0, 32)); return; }
    const n = s.split(st.after).length - 1;
    if (n !== 1) throw new Error(file + ' 앵커가 ' + n + '번 나옵니다(1번이어야 함): ' + st.after.slice(0, 70));
    s = s.replace(st.after, function () { return st.after + st.insert; });
    console.log('  넣음:', file, '·', st.skipIf.slice(0, 32));
  });
  fs.writeFileSync(p, crlf ? s.replace(/\n/g, '\r\n') : s);
}

/* 1) 온톨로지 — 개체 종류 셋 · 프로그램 등록(쓰는 자리 넷) · 읽기 어댑터(앱 안에서만) */
edit('js/pu-ontology.js', [
  { skipIf: 'SignboardAd:', after: "      SupportProgram:'정부 지원사업', EligibilityReview:'지원 검토',\n",
    insert: "      /* 전광판(2026-10-12) — 광고 한 건 · 전광판에 «올린 판» 한 벌(기록 포함) · 첫 전송 허락 같은 제어값 */\n"
      + "      SignboardAd:'전광판 광고', SignboardPublish:'전광판 올린 판', SignboardControl:'전광판 제어',\n" },
  { skipIf: "signboard:{ name:'전광판'", after: "      entityTypes:['Organization','SupportProgram','EligibilityReview'] },\n",
    insert: "    /* 전광판 — 외부 전광판에 나갈 광고를 만들고 «올리기». 실제 전송은 이 PC 의 심부름꾼(scripts/signboard-agent)이 한다(대표 지시 2026-10-12).\n"
      + "       설계 docs/superpowers/specs/2026-10-12-signboard-design.md.\n"
      + "       ★ 쓰는 것: ads(SignboardAd) · published(올린 판) · history(올린 기록) · control(첫 전송 허락). state 는 심부름꾼이 쓴다 — 화면은 읽기만.\n"
      + "       ⚠ 길거리에 그대로 보이는 것이라 읽기·쓰기 모두 관리자·위임관리인만(규칙 signboard). */\n"
      + "    signboard:{ name:'전광판', file:'pu-signboard.html', primaryRoots:['signboard'], sharedRoots:['uid_roles'],\n"
      + "      writeContracts:[{path:'signboard/ads/{id}',entityType:'SignboardAd'},\n"
      + "                      {path:'signboard/published',entityType:'SignboardPublish'},\n"
      + "                      {path:'signboard/history/{version}',entityType:'SignboardPublish'},\n"
      + "                      {path:'signboard/control',entityType:'SignboardControl'}],\n"
      + "      entityTypes:['SignboardAd','SignboardPublish','SignboardControl'] },\n" },
  { skipIf: 'signboard_core:', after: "      gives:'지원사업 사전·예비 고객·보충값·검토 (앱 안에서만 — 통합 진단에서 읽지 않는다)'},\n",
    insert: "    /* 전광판 — 광고 문구·올린 판이 든 자리라 통합 진단에서 읽지 않는다(앱 안에서만 본다). */\n"
      + "    signboard_core:{program:'signboard',strategy:'in_app',path:'signboard',parser:'coverage',\n"
      + "      gives:'전광판 광고·올린 판·올린 기록·심부름꾼 상태 (앱 안에서만 — 통합 진단에서 읽지 않는다)'},\n" }
]);

/* 2) 포털 타일 + 앱 막대 — «한 커밋»에(ontology-registry 가 «타일 없는 등록 프로그램»을 막는다).
      perm 방식: 관리자·위임관리인은 알아서 통과, 다른 직원은 uid_roles/{uid}/signboard 가 true 일 때만 보인다 */
edit('enter.html', [
  { skipIf: "key:'signboard'", after: "    { key:'govaid',  name:'정부지원금',   desc:'지원사업 찾기·검토', icon:'🎯', url:'pu-govaid.html',      roles:null, row:'sales' },\n",
    insert: "    /* 전광판 — 외부 전광판 광고 바꾸기(대표 지시 2026-10-12 「영업관리 줄에 전광판 컨트롤 앱」). 관리자·위임관리인만(규칙 signboard).\n"
      + "       adminOnly 가 아니라 perm 이다 — adminOnly 는 role==='admin' 만 통과시켜 위임관리인이 빠진다. */\n"
      + "    { key:'signboard', name:'전광판',   desc:'외부 전광판 광고 바꾸기', icon:'📺', url:'pu-signboard.html', roles:null, perm:'signboard', row:'sales' },\n" }
]);
edit('js/pu-appbar.js', [
  { skipIf: "key: 'signboard'", after: "    { key: 'govaid',  row: 'sales', name: '정부지원금',   icon: '🎯', url: 'pu-govaid.html',      desc: '지원사업 찾기·검토' },\n",
    insert: "    { key: 'signboard', row: 'sales', name: '전광판',   icon: '📺', url: 'pu-signboard.html', desc: '외부 전광판 광고 바꾸기', perm: 'signboard' },\n" }
]);

/* 3) 실시간DB 규칙 — 만들개에서만(JSON 을 손으로 고치지 않는다) */
edit('scripts/make-firebase-rules.js', [
  { skipIf: 'rules.signboard', after: "  reviews:   { $k:  { $p: { '.write': GOVAID_W, '.validate': \"newData.child('id').val() === $k + '__' + $p\" } } } };\n",
    insert: "\n/* ══ 📺 전광판(pu-signboard.html + 이 PC 의 심부름꾼) — 외부 전광판 광고 (2026-10-12) ══\n"
      + "   설계 docs/superpowers/specs/2026-10-12-signboard-design.md §5 · 대표 「대표 + 관리직원」.\n"
      + "   ⚠ 읽기·쓰기 = MGR(관리자 또는 위임관리인) — 길거리에 그대로 보이는 문구라 일반 직원 열림 없음.\n"
      + "   ⚠ 지우기(빈 값 쓰기)는 막는다 — 지우는 것은 _deleted 표식(공용 관문 tombstone)으로만.\n"
      + "   ⚠ 열쇠와 레코드 id 가 어긋나면 막는다(ads/$id · history/$v). published·control 은 id 가 이름 그대로다.\n"
      + "   ⚠ state = 심부름꾼이 «관리자 권한 CLI»로 쓴다(규칙을 건너뛴다) — 화면에서는 아무도 못 쓴다. */\n"
      + "const SIGNBOARD_W = `(${MGR}) && newData.exists()`;\n"
      + "rules.signboard = { '.read': MGR,\n"
      + "  ads:       { $id: { '.write': SIGNBOARD_W, '.validate': \"newData.child('id').val() === $id\" } },\n"
      + "  published: { '.write': SIGNBOARD_W, '.validate': \"newData.child('id').val() === 'published'\" },\n"
      + "  history:   { $v:  { '.write': SIGNBOARD_W, '.validate': \"newData.child('id').val() === $v\" } },\n"
      + "  control:   { '.write': SIGNBOARD_W, '.validate': \"newData.child('id').val() === 'control'\" },\n"
      + "  state:     { '.write': false } };\n" }
]);

/* 4) 짝 검사 등록부 — 새 최상위 자리는 «일부러 넣었다»고 적어야 한다 */
edit('tests/perf-rules.test.js', [
  { skipIf: "'signboard'", after: 'const allowTop = [',
    insert: "'signboard' /* 전광판 — 관리자·위임관리인 읽기·쓰기(지우기 금지), state 는 서버 CLI 전용 2026-10-12 */," }
]);
edit('tests/color-palette-apps.test.js', [
  { skipIf: "['pu-signboard.html'", after: "  ['pu-govaid.html', '정부지원금'],\n", insert: "  ['pu-signboard.html', '전광판'],\n" },
  { skipIf: "'pu-signboard.html': new Set", after: "  'pu-govaid.html': new Set([]),\n",
    insert: "  /* 전광판(2026-10-12) — 처음부터 팔레트만 쓴다. LED 글자색은 화면 색이 아니라 «장비에 보낼 자료»라 js/pu-signboard-core.js 에 둔다 */\n  'pu-signboard.html': new Set([]),\n" }
]);

/* 5) 창고(Storage) 규칙 — 사진·동영상. 한 벌을 세 창고에 올리지만 쓰는 곳은 pureun-erp-hrphotos.
      «위에 없는 자리는 전부 막는다» 칸 «앞»에 넣는다(규칙은 순서에 뜻이 없지만 안내와 가깝게 둔다) */
if (on('storage')) (function () {
  const f = 'docs/firebase-storage-전체(붙여넣기용).txt', p = path.join(root, f);
  const raw = fs.readFileSync(p, 'utf8'), crlf = raw.indexOf('\r\n') >= 0;
  let s = raw.replace(/\r\n/g, '\n');
  if (s.indexOf('match /signboard/{file}') >= 0) { console.log('  건너뜀(이미 있음):', f); return; }
  const anchor = '    // 위에 없는 자리는 전부 막는다\n';
  if (s.split(anchor).length !== 2) throw new Error('창고 규칙 앵커 오류');
  const block = [
    '    // ── 전광판 광고 사진·동영상 (2026-10-12 추가) · 창고 pureun-erp-hrphotos ──',
    '    //    포털 «전광판» 앱이 올리고, 이 PC 의 심부름꾼이 토큰 주소로 받아 전광판 장비에 넣습니다.',
    '    //    ⚠ 쓰기가 «직원이면 누구나»입니다 — 창고 규칙은 실시간DB 의 권한표를 못 읽어 「관리자인가」를 여기서 볼 수 없습니다.',
    '    //      그래도 새지 않습니다: 올린 파일은 실시간DB signboard/published(관리자·위임관리인만 씀)에 주소가 적혀야 비로소 전광판에 나갑니다.',
    '    //    ⚠ 지우기는 막습니다 — 올린 기록에서 이전 판으로 되돌릴 수 있어야 해서, 그 판이 쓰던 파일이 남아 있어야 합니다.',
    '    //    ⚠ 사진은 okImage()(10MB, 사진만)를 그대로 씁니다 — 같은 보조 함수를 쓰므로 그것을 조이면 이 칸도 함께 조여져, 배포 검사가 잡습니다.',
    '    //      동영상은 아래 okSignVideo()(50MB 가안 — 장비 저장공간을 읽은 뒤 확정합니다. js/pu-signboard-core.js 의 MAX_VIDEO_BYTES 와 같은 값).',
    '    //    ⚠ 이 칸이 없으면 «사진·동영상 올리기»만 막힙니다 — 글자 광고는 그대로 됩니다.',
    '    match /signboard/{file} {',
    '      allow read:   if isStaff();',
    '      allow write:  if isStaff() && (okImage() || okSignVideo());',
    '      allow delete: if false;',
    '    }',
    '', ''].join('\n');
  s = s.replace(anchor, function () { return block + anchor; });
  fs.writeFileSync(p, crlf ? s.replace(/\n/g, '\r\n') : s);
  console.log('  넣음:', f);
})();
/* 전광판 동영상용 보조 함수 — okImage() 바로 뒤에 둔다 */
edit('docs/firebase-storage-전체(붙여넣기용).txt', [
  { skipIf: 'function okSignVideo',
    after: [
      '    function okImage() {',
      '      return request.resource != null',
      '          && request.resource.size < 10 * 1024 * 1024',
      "          && request.resource.contentType.matches('image/.*');",
      '    }', ''].join('\n'),
    insert: [
      '    // 전광판 광고 동영상(2026-10-12) — 50MB 가안. okImage() 와 «같은 모양»이다.',
      '    function okSignVideo() {',
      '      return request.resource != null',
      '          && request.resource.size < 50 * 1024 * 1024',
      "          && request.resource.contentType.matches('video/.*');",
      '    }', ''].join('\n') }
]);
/* 창고 규칙 검사가 «앱이 실제로 쓰는 길»을 이 목록에서 본다 — 새 자리를 쓰는 기능을 붙이면 여기도 적는다 */
edit('scripts/storage-rules-deploy.js', [
  { skipIf: "'signboard/", after: "(pu-erp.html erpImgCloudPath)']",
    insert: ",\n  ['signboard/ad_lq3k9x2a4f0001_m1a2b3.jpg', '전광판 광고 사진·동영상 (pu-signboard.html onFile)']" }
]);
console.log('끝');
```

- [ ] **Step 4: `rules` 구역을 돌린다**

Run:
```bash
cd /c/Users/fair0/Documents/pu-wt-signboard
node /c/Users/fair0/AppData/Local/Temp/signboard-tools/integrate.js "$(pwd)" rules
```
Expected: `넣음: scripts/make-firebase-rules.js · rules.signboard` 와 `넣음: tests/perf-rules.test.js · 'signboard'`.

- [ ] **Step 5: 규칙 JSON 두 벌을 «만들개에서» 다시 만든다**

Run:
```bash
node scripts/make-firebase-rules.js > docs/firebase-rules-전체-적용본.json
cp docs/firebase-rules-전체-적용본.json docs/rules-paste.json
git diff --numstat -- docs/rules-paste.json "docs/firebase-rules-전체-적용본.json"
```
Expected: 두 파일 모두 `26  0` — **줄을 더하기만 했고 지운 줄이 0**(다른 규칙은 그대로다). 지운 줄이 있으면 멈추고 만들개 앵커를 다시 본다.

- [ ] **Step 6: 통과를 확인한다**

Run: `node --test tests/signboard-rules.test.js tests/perf-rules.test.js tests/rules-paste-copy.test.js tests/firebase-rules-apply.test.js tests/firebase-access-matrix.test.js`
Expected: PASS(`signboard-rules` 는 `ℹ pass 6`).

> ⚠ 이 시점에 전체 검사를 돌리면 `★ 콘솔과 «한 곳도» 다르지 않다`(`tests/photos-staff-share.test.js`) **한 건이 빨갛다.** 정상이다 — 새 규칙이 아직 콘솔에 없어서다. `PENDING` 에 적지 말 것. Task 8 에서 규칙을 올리면 콘솔 사본 파일이 갱신되며 저절로 풀린다.

- [ ] **Step 7: 커밋**

```bash
git add scripts/make-firebase-rules.js tests/perf-rules.test.js tests/signboard-rules.test.js docs/rules-paste.json "docs/firebase-rules-전체-적용본.json"
git commit -m "feat(전광판): 실시간DB 규칙 signboard — 관리자·위임관리인만, 지우기 금지, state 는 서버 CLI 전용" -- scripts/make-firebase-rules.js tests/perf-rules.test.js tests/signboard-rules.test.js docs/rules-paste.json "docs/firebase-rules-전체-적용본.json"
git show --stat HEAD | tail -8
```

---

### Task 4: 창고(Storage) 규칙 `signboard/{file}`

**Files:**
- Modify: `docs/firebase-storage-전체(붙여넣기용).txt`, `scripts/storage-rules-deploy.js`(«쓰는자리» 목록)
- Create: `tests/signboard-storage-rule.test.js`

**Interfaces:**
- Consumes: 창고 규칙의 기존 보조 함수 `isStaff()` · `okImage()`.
- Produces: `match /signboard/{file}`(직원 읽기·쓰기, 지우기 금지) · 새 보조 함수 `okSignVideo()`(video/, 50MB 가안). Task 5 의 `onFile` 이 `signboard/{광고ID}_{시각}.{확장자}` 로 올린다.

- [ ] **Step 1: 시험을 먼저 쓴다**

```js
/* 전광판 창고(Storage) 규칙 — 직원만 읽고 쓰고, 지우기 금지, 사진은 okImage() 재사용 (2026-10-12)
   ★ 사진 한도를 새로 적지 않는다 — 배포 검사(storage-rules-deploy.test)가 «첫 번째로 나오는 같은 글자»를 조여 보는데,
     같은 글자가 이 칸에 먼저 나오면 엉뚱한 칸을 조여 검사가 이빨을 잃는다(2026-10-12 실제로 걸렸다). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const TXT = fs.readFileSync(path.join(ROOT, 'docs', 'firebase-storage-전체(붙여넣기용).txt'), 'utf8').replace(/\r\n/g, '\n');
const at = TXT.indexOf('match /signboard/{file}');
const BLOCK = at < 0 ? '' : TXT.slice(at, TXT.indexOf('\n    }\n', at) + 7);

test('signboard 칸이 있다', () => { assert.ok(at > 0, '창고 규칙에 match /signboard/{file} 이 없다'); });

test('직원(@pureun.kr)만 읽고 쓴다 — 읽기·쓰기 모두 isStaff()', () => {
  assert.match(BLOCK, /allow read:\s+if isStaff\(\);/);
  assert.match(BLOCK, /allow write:\s+if isStaff\(\)/);
});

test('지우기는 막는다 — 올린 기록으로 되돌릴 때 그 판의 파일이 남아 있어야 한다', () => {
  assert.match(BLOCK, /allow delete:\s+if false;/);
});

test('사진은 okImage() 를 그대로 쓴다 — 같은 숫자를 이 칸에 새로 적지 않는다', () => {
  assert.match(BLOCK, /okImage\(\)/);
  assert.equal(BLOCK.indexOf('10 * 1024 * 1024'), -1, '10MB 를 이 칸에 새로 적었다');
  /* 배포 검사는 파일에서 «첫 번째로 나오는» 10MB 한도를 1KB 로 바꿔 본다 — 그것이 okImage() 안이어야 한다 */
  const first = TXT.indexOf('request.resource.size < 10 * 1024 * 1024'), fn = TXT.indexOf('function okImage()');
  assert.ok(fn > 0 && first > fn && first < fn + 200, '첫 번째 10MB 한도가 okImage() 안에 있지 않다');
});

test('동영상 보조 함수 okSignVideo() 가 있고 video/ 만 받으며 50MB 미만이다', () => {
  const f = TXT.slice(TXT.indexOf('function okSignVideo()'));
  assert.ok(f.length > 0 && TXT.indexOf('function okSignVideo()') > 0);
  const body = f.slice(0, f.indexOf('}') + 1);
  assert.match(body, /request\.resource\.size < 50 \* 1024 \* 1024/);
  assert.match(body, /contentType\.matches\('video\/\.\*'\)/);
  assert.match(BLOCK, /okSignVideo\(\)/);
});

test('규칙 한도가 규칙 모듈(js/pu-signboard-core.js)의 한도와 같다', () => {
  const C = require('../js/pu-signboard-core.js');
  assert.equal(C.MAX_IMAGE_BYTES, 10 * 1024 * 1024);
  assert.equal(C.MAX_VIDEO_BYTES, 50 * 1024 * 1024);
});

test('앱이 실제로 쓰는 자리 목록(storage-rules-deploy)에 signboard 길이 적혀 있다', () => {
  const s = fs.readFileSync(path.join(ROOT, 'scripts', 'storage-rules-deploy.js'), 'utf8');
  assert.match(s, /\['signboard\/[^']+', '[^']*pu-signboard\.html[^']*'\]/);
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `node --test tests/signboard-storage-rule.test.js`
Expected: FAIL — `창고 규칙에 match /signboard/{file} 이 없다`

- [ ] **Step 3: `storage` 구역을 돌린다**

Run: `node /c/Users/fair0/AppData/Local/Temp/signboard-tools/integrate.js "$(pwd)" storage`
Expected: `넣음` 세 줄(창고 규칙 칸 · `okSignVideo` · «쓰는 자리» 목록).

> ⚠ 사진 한도(`10 * 1024 * 1024`)를 `signboard` 칸에 **새로 적지 않는다** — `okImage()` 를 그대로 부른다. `tests/storage-rules-deploy.test.js` 는 파일에서 «첫 번째로 나오는» 같은 글자를 1KB 로 조여 «멈추는지» 보는데, 같은 글자가 먼저 나오면 엉뚱한 칸을 조여 그 검사가 이빨을 잃는다(2026-10-12 실제로 걸렸다).

- [ ] **Step 4: 통과를 확인한다**

Run: `node --test tests/signboard-storage-rule.test.js tests/storage-rules-deploy.test.js tests/storage-rules-stale-base.test.js tests/storage-rules-deploy-approval.test.js`
Expected: PASS — `signboard-storage-rule` `ℹ pass 7`, 나머지 기존 검사도 전부 통과(특히 `★★★ 보조 함수를 «조여도» 멈춘다`).

- [ ] **Step 5: 올리지 않고 «미리보기만» 본다 (읽기 전용)**

Run: `node scripts/storage-rules-deploy.js`
Expected: `새로 생기는 칸` 에 `/signboard/{file}` 가 있고, `사라지는 것 0개`, `앱이 쓰는 자리 … 안 덮인 것 0곳`. (`/erp_img/{imgId}` 가 «새로»로 함께 나올 수 있다 — 다른 방이 이미 규칙 파일에 넣은 것이 콘솔 사본보다 새롭기 때문이다. 올릴 때 함께 나간다고 Task 8 보고서에 밝힌다.) **`--deploy` 는 여기서 하지 않는다.**

- [ ] **Step 6: 커밋**

```bash
git add "docs/firebase-storage-전체(붙여넣기용).txt" scripts/storage-rules-deploy.js tests/signboard-storage-rule.test.js
git commit -m "feat(전광판): 창고 규칙 signboard/{file} — 직원만, 지우기 금지, 사진은 okImage() 재사용 + okSignVideo()" -- "docs/firebase-storage-전체(붙여넣기용).txt" scripts/storage-rules-deploy.js tests/signboard-storage-rule.test.js
git show --stat HEAD | tail -6
```

---

### Task 5: 화면 `pu-signboard.html` + 포털 등록 (한 커밋)

**Files:**
- Create: `pu-signboard.html`, `tests/signboard-html.test.js`, `tests/signboard-ontology.test.js`
- Modify: `js/pu-ontology.js`, `enter.html`, `js/pu-appbar.js`, `tests/color-palette-apps.test.js`, 그리고 `pu-ontology.js`·`pu-appbar.js` 를 싣는 모든 html(`?v=` 올림)
- 도구(저장소 밖): `signboard-tools/prep-page.js`, `signboard-tools/bump-cache.js`

**Interfaces:**
- Consumes: `SignboardCore`(Task 1) · `SignboardView`(Task 2) · 공용 `PuOntologyWrite`·`PuGate`·`PuAppBar`·`PuWhoami`·`PuBack`.
- Produces: 화면 `pu-signboard.html`. 온톨로지 `PROGRAMS.signboard`(쓰기 계약 넷) · 개체 종류 `SignboardAd`·`SignboardPublish`·`SignboardControl` · `READ_ADAPTERS.signboard_core`(`in_app`) · 타일 `{key:'signboard', row:'sales', perm:'signboard'}`.

- [ ] **Step 1: 시험 둘을 먼저 쓴다**

`tests/signboard-ontology.test.js`:

```js
/* 전광판 — 온톨로지 등록부·사전·저장 계약·포털 타일 (2026-10-12)
   ★ 새 앱은 관문이 강제(enforce)다. 등록이 빠지면 화면의 저장이 전부 거절된다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const O = require('../js/pu-ontology.js');
const W = require('../js/pu-ontology-write.js');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

test('전광판이 등록부에 있고 쓰는 자리 넷을 선언한다', () => {
  const g = O.PROGRAMS.signboard;
  assert.ok(g, 'PROGRAMS.signboard 가 없다');
  assert.equal(g.file, 'pu-signboard.html');
  assert.deepEqual(g.primaryRoots, ['signboard']);
  const paths = g.writeContracts.map((w) => w.path);
  ['ads/', 'published', 'history/', 'control'].forEach((k) =>
    assert.ok(paths.some((p) => p.indexOf('signboard/' + k) === 0), k + ' 쓰기 계약이 없다'));
  assert.equal(paths.some((p) => /state/.test(p)), false, 'state 는 심부름꾼이 쓴다 — 화면의 쓰기 계약에 없다');
  g.writeContracts.forEach((w) => assert.ok(g.entityTypes.indexOf(w.entityType) >= 0, w.path));
});

test('개체 종류 셋이 사전에 있다', () => {
  ['SignboardAd', 'SignboardPublish', 'SignboardControl'].forEach((k) => assert.ok(O.TERMS.entityTypes[k], k));
});

test('통합 진단은 이 자리를 읽지 않는다 — 앱 안에서만(in_app)', () => {
  const a = Object.values(O.READ_ADAPTERS).find((x) => x.program === 'signboard');
  assert.ok(a, 'READ_ADAPTERS 에 signboard 가 없다');
  assert.equal(a.strategy, 'in_app');
});

test('모든 새 프로그램의 저장 계약이 갖춰져 있다', () => {
  assert.equal(W.auditProgramContracts(O.PROGRAMS).ok, true);
});

test('광고·올린 판·제어 레코드가 강제 관문을 통과한다', () => {
  const ad = W.prepareRecord({ id: 'ad_t1', title: '시험' }, { entityType: 'SignboardAd', now: 1, actor: 'A-001' });
  assert.equal(ad.ok, true, JSON.stringify(ad.issues));
  const pub = W.prepareRecord({ id: 'published', version: 1, ads: [] }, { entityType: 'SignboardPublish', now: 1, actor: 'A-001' });
  assert.equal(pub.ok, true, JSON.stringify(pub.issues));
  const hist = W.prepareRecord({ id: '3', version: 3, ads: [] }, { entityType: 'SignboardPublish', now: 1, actor: 'A-001' });
  assert.equal(hist.ok, true, JSON.stringify(hist.issues));
  const ctl = W.prepareRecord({ id: 'control', firstReplaceConfirmed: true }, { entityType: 'SignboardControl', now: 1, actor: 'A-001' });
  assert.equal(ctl.ok, true, JSON.stringify(ctl.issues));
});

test('포털 타일과 앱 막대가 짝이다 — «영업관리» 줄, perm 방식(adminOnly 는 위임관리인이 빠진다)', () => {
  const tile = read('enter.html').split('\n').find((l) => /key:'signboard'/.test(l));
  assert.ok(tile, 'enter.html 에 타일이 없다');
  assert.match(tile, /row:'sales'/); assert.match(tile, /url:'pu-signboard\.html'/); assert.match(tile, /perm:'signboard'/);
  assert.doesNotMatch(tile, /adminOnly/);
  const bar = read('js/pu-appbar.js').split('\n').find((l) => /key: 'signboard'/.test(l));
  assert.ok(bar, 'pu-appbar.js 에 항목이 없다');
  assert.match(bar, /row: 'sales'/); assert.match(bar, /perm: 'signboard'/); assert.doesNotMatch(bar, /adminOnly/);
});
```

`tests/signboard-html.test.js`:

```js
/* 전광판 화면(pu-signboard.html) — 문법·싣는 순서·쓰는 자리·올리는 순서 (2026-10-12)
   ★ 주석은 걷고 본다 — 주석에 적힌 글자로 통과하지 않게. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'pu-signboard.html'), 'utf8');
const NOC = SRC.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

function fnBody(head) {
  const i = NOC.indexOf(head);
  assert.ok(i >= 0, '못 찾음: ' + head);
  let d = 0;
  for (let k = NOC.indexOf('{', i); k < NOC.length; k++) {
    if (NOC[k] === '{') d++;
    else if (NOC[k] === '}') { d--; if (d === 0) return NOC.slice(i, k + 1); }
  }
  throw new Error('닫는 괄호 없음: ' + head);
}

test('인라인 스크립트가 문법에 맞다', () => {
  const blocks = [...NOC.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  assert.ok(blocks.length >= 1);
  blocks.forEach((b, i) => assert.doesNotThrow(() => new vm.Script(b), 'inline script #' + i));
});

test('FB_CONFIG 줄이 들어 있다 — 표식이 남아 있지 않다', () => {
  assert.doesNotMatch(SRC, /@@FB_CONFIG@@/);
  assert.match(NOC, /^var FB_CONFIG=/m);
});

test('규칙 모듈·화면 모듈을 캐시 번호와 함께 싣고, 화면 모듈보다 규칙 모듈이 먼저다', () => {
  ['pu-signboard-core', 'pu-signboard-view'].forEach((n) => assert.match(NOC, new RegExp('src="js/' + n + '\\.js\\?v=\\d+"'), n));
  assert.ok(NOC.indexOf('js/pu-signboard-core.js') < NOC.indexOf('js/pu-signboard-view.js'));
});

test('저장 관문을 Firebase 초기화 전에 싣고, 강제 모드 관문으로만 쓴다', () => {
  const gw = NOC.indexOf('js/pu-ontology-write.js'), init = NOC.indexOf('initializeApp(');
  assert.ok(gw > 0 && init > gw, '관문이 초기화보다 먼저여야 한다');
  assert.match(NOC, /createGateway\(\{\s*mode:'enforce'/);
  assert.doesNotMatch(NOC, /fbDb\.ref\([^)]*\)\s*\.(set|update|push|remove|transaction)\(/, '관문을 건너뛴 쓰기');
});

test('쓰는 자리는 signboard 아래 네 곳뿐이고 state 는 쓰지 않는다', () => {
  /* 광고는 adRef(id) 한 길 — 그 정의가 signboard/ads/ 를 가리킨다 */
  assert.match(fnBody('function adRef('), /fbDb\.ref\('signboard\/ads\/'\+id\)/);
  assert.ok((NOC.match(/gate\.save\(adRef\(/g) || []).length >= 3, '광고 저장 호출');
  /* 나머지는 글자로 적힌 자리 — published · control · history/판번호 셋뿐 */
  const refs = [...NOC.matchAll(/gate\.save\(\s*fbDb\.ref\('([^']+)'/g)].map((m) => m[1]);
  assert.ok(refs.length >= 3, '저장 호출을 못 찾았다: ' + refs.join(','));
  refs.forEach((r) => assert.match(r, /^signboard\/(published|control|history\/)$/, r));
  /* 화면은 state 를 «읽기만» 한다 — 이름이 적힌 곳마다 같은 줄에 once('value') 가 있어야 한다 */
  [...NOC.matchAll(/signboard\/state[^;]*/g)].forEach((m) => assert.match(m[0], /once\('value'\)/, m[0].slice(0, 80)));
});

test('찬 자리 거래에서 접히는 공용 gate.remove 를 쓰지 않고, 지우기는 softDeleted 로 만든다', () => {
  assert.doesNotMatch(NOC, /gate\.remove\(/);
  assert.match(NOC, /C\.softDeleted\(/);
});

test('앱끼리 창은 새 탭(_blank)으로 열지 않는다', () => {
  assert.doesNotMatch(NOC, /window\.open\([^)]*_blank/);
});

test('관리자·위임관리인이 아니면 잠근다 — 사번·재직·권한을 모두 본다', () => {
  const fn = fnBody('async function managerSid(');
  assert.match(fn, /status==='active'/); assert.match(fn, /isAdmin===true/); assert.match(fn, /isSubAdmin===true/);
  assert.match(NOC, /if\(!sid\)\{ lock\(/);
});

test('올리기 — 올린 판을 «먼저» 쓰고 기록은 «뒤에» 쓴다(동시에 눌러도 남의 기록을 덮지 않게). 찬 자리(null)에서는 접지 않는다', () => {
  const fn = fnBody('async function writePublished(');
  assert.ok(fn.indexOf("signboard/published") < fn.indexOf('signboard/history/'), '판이 먼저');
  assert.match(fn, /if\(prev && /, '진짜 값이 있을 때만 판 번호를 비교한다');
  assert.match(fn, /return undefined/);
  assert.match(fn, /build\(prev\|\|D\.pub\)/, '찬 자리 null 에서도 레코드를 돌려준다');
  assert.match(fn, /catch\(e\)\{ return false; \}/, '기록 쓰기가 실패해도 올린 판은 그대로다');
  assert.match(fn, /다른 사용자가 먼저 올렸습니다/, '일부러 접은 것은 «영구 ID 없음» 이 아니라 제대로 말한다');
});

test('기록이 비어 있어도 «지금 판»은 기록 표에 직접 그려 준다', () => {
  assert.match(fnBody('function drawHist('), /C\.historyRecord\(D\.pub\)/);
});

test('올리기 전에 검증하고, 길거리에 보인다는 확인 창을 거친다', () => {
  const fn = fnBody('async function publish(');
  assert.match(fn, /badAds\(\)/);
  assert.match(fn, /길거리 전광판에 그대로 보입니다/);
  assert.ok(fn.indexOf('confirm(') < fn.indexOf('writePublished('), '확인 뒤에 쓴다');
});

test('광고가 0건인 판은 올리지 않는다 — 전광판을 통째로 비우는 사고를 화면에서도 막는다', () => {
  const fn = fnBody('async function publish(');
  assert.match(fn, /if\(!ads\.length\)\{ alert\(/);
  assert.ok(fn.indexOf('!ads.length') < fn.indexOf('confirm('), '확인 창보다 먼저');
});

test('경고(이모지·끝난 기간)를 편집 상자와 올리기 확인 창에 보여 준다', () => {
  assert.match(fnBody('function refreshPreview('), /C\.warnAd\(/);
  assert.match(fnBody('async function publish('), /C\.warnAd\(/);
  assert.match(NOC, /V\.editorForm\([^)]*Date\.now\(\)\)/, '편집 상자를 처음 그릴 때도 지금 시각을 넘긴다');
});

test('첫 전송 허락은 control 에 «누가·언제»를 남긴다', () => {
  const fn = fnBody('async function confirmFirst(');
  assert.match(fn, /confirmedBy:ME\.sid/); assert.match(fn, /confirmedAt:Date\.now\(\)/);
  assert.match(fn, /SignboardControl/);
});

test('사진·동영상 — 종류·크기를 올리기 전에 거르고, 창고 signboard/ 아래에만 둔다', () => {
  const fn = fnBody('async function onFile(');
  assert.match(fn, /indexOf\(kind\+'\/'\)/); assert.match(fn, /MAX_IMAGE_BYTES/); assert.match(fn, /MAX_VIDEO_BYTES/);
  assert.match(fn, /'signboard\/'\+/);
  assert.match(NOC, /storage\('gs:\/\/pureun-erp-hrphotos'\)/);
});

test('편집은 서버 최신 판(revision)을 다시 비교한다 — 새 광고는 -1', () => {
  const fn = fnBody('async function saveEdit(');
  assert.match(fn, /expectedRevision:-1/); assert.match(fn, /expectedRevision:rev/);
});

test('심부름꾼이 20분 넘게 조용하면 알리도록 상태 탭이 30초마다 다시 읽는다', () => {
  assert.match(NOC, /setInterval\(reloadState,\s*30000\)/);
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `node --test tests/signboard-ontology.test.js tests/signboard-html.test.js`
Expected: FAIL — `PROGRAMS.signboard 가 없다` / `ENOENT … pu-signboard.html`

- [ ] **Step 3: 화면 파일을 만든다**

`pu-signboard.html` — 맨 앞 `<script>` 안의 `//@@FB_CONFIG@@` 한 줄은 Step 4 의 도우미가 `pu-govaid.html` 의 `var FB_CONFIG=…` 줄을 **그대로 가져와** 채운다(열쇠를 이 문서·채팅에 옮겨 적지 않으려고).

```html
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>푸른노무법인 전광판</title>
<!-- ═══════════════════════════════════════════════════════
     푸른노무법인 전광판 (pu-signboard.html) — 2026-10-12
     대표 지시 「외부 전광판 영업 광고 자유롭게 바꾸는 기능 … 푸른통합시스템안에 심어달라」 · 「영업관리 줄에 전광판 컨트롤 앱」
     설계: docs/superpowers/specs/2026-10-12-signboard-design.md · 계획: docs/superpowers/plans/2026-10-12-signboard-portal.md

     ★ 하는 일: 외부 전광판에 나갈 광고(글자·사진·동영상)를 만들고 기간을 정해 «전광판에 올리기». 실제 전송은 이 PC 의 심부름꾼
       (scripts/signboard-agent)이 «올린 판»을 가져다 한다. 이 화면은 장비와 직접 말하지 않는다.
     ★ 쓰는 자리(관문 강제 모드, PROGRAMS.signboard.writeContracts): signboard/ads · published · history · control
     ★ 읽기만: signboard/state(심부름꾼이 쓴다) · uid_roles(권한·사번)
     ⚠ 길거리에 그대로 보이는 것이라 «관리자·위임관리인»만 연다(규칙 signboard = MGR). 타일 감춤은 화면일 뿐, 진짜 잠금은 규칙이다.
     ⚠ 고치는 즉시 전광판에 나가지 않는다 — «전광판에 올리기»를 눌러야 한다. 올린 기록(history)에서 이전 판으로 되돌린다.
     ═══════════════════════════════════════════════════════ -->
<style>
:root{
  --ink:#1e293b; --ink2:#475569; --mute:#64748b; --line:#e2e8f0; --line2:#cbd5e1; --bg:#f8fafc; --card:#ffffff;
  --blue:#2563eb; --blue-d:#1e40af; --blue-bg:#eff6ff; --blue-line:#bfdbfe;
  --green:#166534; --green-m:#16a34a; --green-bg:#f0fdf4; --green-line:#bbf7d0;
  --amber:#854d0e; --amber-m:#d97706; --amber-bg:#fffbeb; --amber-line:#fde68a;
  --red:#991b1b; --red-bg:#fef2f2; --red-line:#fecaca;
}
*{box-sizing:border-box}
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Malgun Gothic',sans-serif;background:var(--bg);color:var(--ink);font-size:13.5px}
button{font:inherit;cursor:pointer;border:1px solid var(--line2);background:var(--card);color:var(--ink);border-radius:8px;padding:5px 11px;line-height:1.3;white-space:nowrap}
button:hover{border-color:var(--mute)}
button:disabled{opacity:.45;cursor:default}
button.pri{background:var(--blue);border-color:var(--blue);color:#ffffff}
button.sm{padding:3px 9px;font-size:12px}
input,select,textarea{font:inherit;font-size:13px;padding:5px 8px;border:1px solid var(--line2);border-radius:7px;background:var(--card);color:var(--ink)}
textarea{width:100%;resize:vertical}
@media (max-width:768px){ input,select,textarea{font-size:16px} }
a{color:var(--blue-d);text-decoration:none}
#head{position:sticky;top:0;z-index:20;background:var(--card);border-bottom:1px solid var(--line)}
.top{display:flex;align-items:center;gap:10px;padding:9px 16px;flex-wrap:wrap}
.top h1{font-size:17px;margin:0}
.top .sub{font-size:12px;color:var(--mute)}
.sp{flex:1}
#who{font-size:13px;color:var(--mute)}
.tabs{display:flex;gap:4px;padding:0 16px;flex-wrap:wrap}
.tabs button{border:none;border-bottom:2px solid transparent;border-radius:0;background:none;color:var(--mute);padding:8px 12px}
.tabs button.on{color:var(--ink);font-weight:700;border-bottom-color:var(--blue)}
.chip{display:inline-block;min-width:18px;text-align:center;border-radius:9px;padding:0 6px;font-size:11px;background:var(--blue-bg);color:var(--blue-d);border:1px solid var(--blue-line)}
.chip.c-amber{background:var(--amber-bg);color:var(--amber);border-color:var(--amber-line)}
main{padding:12px 16px 40px}
.pane{display:none}
.pane.on{display:block}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px}
.bar{display:flex;gap:7px;align-items:center;flex-wrap:wrap;padding:8px 10px}
#pendBar{display:none;align-items:center;gap:10px;flex-wrap:wrap;padding:8px 16px;background:var(--amber-bg);border-bottom:1px solid var(--amber-line);color:var(--amber)}
#pendBar.on{display:flex}
.scroll{overflow:auto}
.t{border-collapse:collapse;width:100%}
.t th,.t td{padding:6px 9px;border-bottom:1px solid var(--line);text-align:left;white-space:nowrap}
.t th{background:var(--bg);color:var(--ink2);font-size:12px;position:sticky;top:0}
.t td.ti{max-width:320px;overflow:hidden;text-overflow:ellipsis}
.t td.nw{max-width:260px;overflow:hidden;text-overflow:ellipsis}
.t .c{width:34px;text-align:center}
.t .n{width:44px;color:var(--mute);text-align:right}
.pill{display:inline-block;border-radius:10px;padding:1px 8px;font-size:11.5px;border:1px solid var(--line2);background:var(--bg);color:var(--ink2)}
.st-on,.ps-ok{background:var(--green-bg);border-color:var(--green-line);color:var(--green)}
.st-wait,.ps-new,.ps-chg,.ps-down{background:var(--amber-bg);border-color:var(--amber-line);color:var(--amber)}
.ck{display:inline-flex;gap:3px;align-items:center;font-size:12px;margin-right:8px;white-space:nowrap}
.bulk{display:none;gap:6px;align-items:center;padding:6px 12px;background:var(--blue-bg);border-bottom:1px solid var(--blue-line);font-size:12.5px}
.bulk.on{display:flex}
.empty{padding:28px;text-align:center;color:var(--mute)}
.hint{font-size:12px;color:var(--mute)}
#fWarn .warn{margin:10px 14px 0}
.fr{display:flex;gap:10px;padding:7px 14px;align-items:flex-start}
.fr>label{width:84px;flex:none;color:var(--ink2);padding-top:6px;font-size:12.5px}
.fv{flex:1;min-width:0;display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.fv input[type=text]{width:100%}
.ferr{width:100%;color:var(--red);font-size:12px}
.sec{padding:10px 14px 2px;font-weight:700;color:var(--ink2)}
.trs{display:flex;flex-direction:column;gap:4px}
.pv{background:#000000;border:1px solid var(--line2);border-radius:6px;width:100%;max-width:480px;container-type:size;display:flex;align-items:center;justify-content:center;overflow:hidden}
.pvt{color:#ffffff;text-align:center;line-height:1.15;padding:2%;white-space:normal}
.pvhint{font-size:13px}
.pvm{width:100%;height:100%}
.pvwrap{padding:8px 14px 14px}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px}
.cardp{padding:12px 14px}
.cardp h3{margin:0 0 8px;font-size:14px}
.kv{display:flex;gap:8px;justify-content:space-between;padding:3px 0;border-bottom:1px dashed var(--line)}
.kv span{color:var(--mute)}
.warn{margin:8px 0;padding:8px 10px;border-radius:8px;background:var(--amber-bg);border:1px solid var(--amber-line);color:var(--amber);font-size:12.5px}
.note{margin:6px 0;color:var(--ink2);font-size:12.5px}
.good{color:var(--green)}
.bad{color:var(--red)}
.confirm{border-color:var(--amber-line);background:var(--amber-bg)}
.modal{position:fixed;inset:0;background:rgba(15,23,42,.35);z-index:50;display:flex;align-items:flex-start;justify-content:center;padding:30px 12px;overflow:auto}
.mbox{background:var(--card);border-radius:12px;max-width:760px;width:100%}
.mhead{display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid var(--line)}
.mhead h3{margin:0;font-size:15px}
.mfoot{display:flex;gap:8px;align-items:center;justify-content:flex-end;padding:10px 14px;border-top:1px solid var(--line)}
#lock{display:none;max-width:460px;margin:60px auto;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:24px;text-align:center}
#lock p{color:var(--mute);font-size:13px}
#toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:var(--ink);color:#ffffff;border-radius:10px;padding:10px 16px;opacity:0;transition:opacity .2s;pointer-events:none;z-index:60;max-width:90vw}
#toast.on{opacity:1}
</style>
</head>
<body>
<div id="head">
  <div class="top">
    <h1>📺 전광판</h1>
    <span class="sub">외부 전광판 광고 — 만들고, 기간을 정하고, 올립니다</span>
    <span id="who"></span>
    <span class="sp"></span>
    <button class="sm" onclick="reload()">새로고침</button>
    <button class="sm" id="outBtn" style="display:none" onclick="firebase.auth().signOut()">로그아웃</button>
  </div>
  <div id="pendBar"><b id="pendTxt"></b><span class="sp"></span><button class="pri" id="pubBtn">전광판에 올리기</button></div>
  <div class="tabs" id="tabs">
    <button data-tab="ads">📋 광고 <span class="chip" id="nAds">0</span></button>
    <button data-tab="state">📡 전광판 상태</button>
    <button data-tab="hist">🕘 올린 기록</button>
  </div>
</div>
<div id="lock"><h2>📺 전광판</h2><div id="lockWhy"></div><p>대표·관리직원만 열 수 있습니다.</p></div>
<main id="app">
  <section class="pane" id="pane-ads">
    <div class="card">
      <div class="bar"><button class="pri" id="newBtn">+ 새 광고</button><span class="hint">고치는 즉시 전광판에 나가지 않습니다 — 위의 «전광판에 올리기»를 눌러야 합니다.</span></div>
      <div id="adsBox"></div>
    </div>
  </section>
  <section class="pane" id="pane-state"><div class="cards" id="stateBox"></div></section>
  <section class="pane" id="pane-hist"><div class="card" id="histBox"></div></section>
</main>
<div class="modal" id="modal" style="display:none"><div class="mbox" id="mbox"></div></div>
<div id="toast"></div>

<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-storage-compat.js"></script>
<script src="js/pu-ontology.js?v=67"></script>
<script src="js/pu-ls-guard.js?v=4"></script>
<!-- ⚠ data-mode="observe" 는 «관문을 실었다»는 표시일 뿐이다(tests/ontology-write-gate 가 이 꼴을 본다). 이 앱은 유예 목록
     (LEGACY_OBSERVE_PROGRAMS)에 없으므로 관문이 «강제»(enforce)로 돈다(runtimeMode). 화면 저장은 아래 gate(createGateway enforce)로만 한다. -->
<script src="js/pu-ontology-write.js?v=6" data-mode="observe"></script>
<script src="js/pu-gate.js?v=3"></script>
<script src="js/pu-appbar.js?v=28"></script>
<script src="js/pu-active.js?v=1"></script><script src="js/pu-logout-why.js?v=1"></script>
<script src="js/pu-whoami.js?v=3"></script>
<script>
(function(){ function go(){ try{ if(window.PuWhoami && document.getElementById('who')){ PuWhoami.mount('#who'); return true; } }catch(e){} return false; }
  if(!go()) document.addEventListener('DOMContentLoaded', go); })();
</script>
<script src="js/pu-back.js?v=2"></script>
<script>try{ PuBack.guard(function(){ return PuBack.closeTopVisible('#modal'); }); }catch(e){}</script>
<script src="js/pu-signboard-core.js?v=1"></script>
<script src="js/pu-signboard-view.js?v=1"></script>
<script>
//@@FB_CONFIG@@
var fbDb=null, gate=null, bucket=null, ME={sid:''};
var C=SignboardCore, V=SignboardView;
var D={ ads:{}, pub:null, ctl:{}, state:null, hist:{} };
var TAB='ads', SEL={}, EDIT=null, SCREEN={ width:128, height:64, assumed:true }, TIMER=null;

function $(id){ return document.getElementById(id); }
function lsGet(k){ try{ return localStorage.getItem('pu_signboard_'+k); }catch(e){ return null; } }
function lsSet(k,v){ try{ localStorage.setItem('pu_signboard_'+k, v); }catch(e){} }
function toast(m){ var t=$('toast'); t.textContent=m; t.className='on'; clearTimeout(toast._t); toast._t=setTimeout(function(){ t.className=''; }, 4200); }
function errMsg(e){ return String((e&&e.message)||e); }

/* ═══ 읽기 ═══ */
async function reload(){
  try{
    var r=await Promise.all(['ads','published','control','history','state'].map(function(k){ return fbDb.ref('signboard/'+k).once('value'); }));
    D.ads=r[0].val()||{}; D.pub=r[1].val(); D.ctl=r[2].val()||{}; D.hist=r[3].val()||{}; D.state=r[4].val();
    var dv=D.state&&D.state.device; if(dv&&dv.width>0&&dv.height>0) SCREEN={ width:Number(dv.width), height:Number(dv.height), assumed:false };
    draw();
  }catch(e){ toast('불러오지 못했습니다: '+errMsg(e)); }
}
async function reloadState(){
  try{
    var r=await Promise.all([fbDb.ref('signboard/state').once('value'), fbDb.ref('signboard/control').once('value')]);
    D.state=r[0].val(); D.ctl=r[1].val()||{}; drawState();
  }catch(e){}
}

/* ═══ 그리기 ═══ */
function liveAds(){ return Object.keys(D.ads).map(function(k){ return D.ads[k]; }).filter(function(a){ return a && !a._deleted; }); }
function nextOrder(){ var m=0; liveAds().forEach(function(a){ m=Math.max(m, Number(a.order)||0); }); return m+1; }
function draw(){ drawTabs(); drawAds(); drawPend(); drawState(); drawHist(); }
function drawTabs(){
  [].forEach.call(document.querySelectorAll('#tabs button'), function(b){ b.className=b.getAttribute('data-tab')===TAB?'on':''; });
  ['ads','state','hist'].forEach(function(t){ $('pane-'+t).className='pane'+(t===TAB?' on':''); });
  $('nAds').textContent=liveAds().length;
}
function drawAds(){ $('adsBox').innerHTML=V.adsTable(D.ads, { sel:SEL, now:Date.now(), publishedAds:D.pub&&D.pub.ads }); drawBulk(); }
function drawBulk(){
  var n=Object.keys(SEL).length, b=document.querySelector('[data-bulk="ads"]'); if(!b) return;
  b.className='bulk'+(n?' on':''); b.innerHTML=V.bulkBar(n);
}
function drawPend(){
  var df=C.diffPublished(D.ads, D.pub&&D.pub.ads), bar=$('pendBar');
  bar.className=df.total?'on':'';
  var parts=[]; if(df.added) parts.push('새 광고 '+df.added); if(df.changed) parts.push('고침 '+df.changed); if(df.removed) parts.push('내림·지움 '+df.removed); if(df.reordered) parts.push('순서 바뀜');
  $('pendTxt').textContent='올리지 않은 변경 '+df.total+'건 ('+parts.join(' · ')+')';
}
function drawState(){ $('stateBox').innerHTML=V.stateCards(D.state, D.ctl, Date.now()); }
function drawHist(){
  var cur=D.pub&&Number(D.pub.version)||0;
  var list=Object.keys(D.hist).map(function(k){ return D.hist[k]; }).filter(function(h){ return h && Number(h.version)<=cur; });
  /* 올린 판은 올라갔는데 기록 쓰기가 실패한 경우 — 지금 판은 올린 판에서 직접 그려 준다 */
  if(D.pub && !D.hist[cur]) list.push(C.historyRecord(D.pub));
  $('histBox').innerHTML=V.historyTable(list, cur);
}
function setTab(t){
  TAB=t; lsSet('tab', t); drawTabs();
  clearInterval(TIMER); TIMER=null;
  if(t==='state'){ reloadState(); TIMER=setInterval(reloadState, 30000); }
}

/* ═══ 저장 — 모두 관문(gate)으로. 지우기는 gate.remove 가 아니라 softDeleted 레코드를 gate.save 한다 ═══ */
function adRef(id){ return fbDb.ref('signboard/ads/'+id); }
function saveAdPatch(id, patch){
  var known=D.ads[id]||{ id:id };
  return gate.save(adRef(id), function(prev){ return C.patchedAd(prev, known, Object.assign({ id:id }, patch)); }, { entityType:'SignboardAd' });
}
function deleteAd(id){
  var known=D.ads[id]||{ id:id };
  return gate.save(adRef(id), function(prev){ return C.softDeleted(prev, known, ME.sid, Date.now()); }, { entityType:'SignboardAd' });
}
async function moveAd(id, dir){
  var list=liveAds().sort(function(x,y){ return (Number(x.order)||0)-(Number(y.order)||0) || (x.id<y.id?-1:1); });
  var i=list.map(function(a){ return a.id; }).indexOf(id), j=dir==='up'?i-1:i+1;
  if(i<0||j<0||j>=list.length) return;
  var t=list[i]; list[i]=list[j]; list[j]=t;
  var jobs=[]; list.forEach(function(a,k){ if((Number(a.order)||0)!==k+1) jobs.push(saveAdPatch(a.id, { order:k+1 })); });
  await Promise.all(jobs); await reload();
}

/* ═══ 편집 상자 ═══ */
function readValues(){
  var g=function(id){ var e=$(id); return e?e.value:undefined; }, c=function(id){ var e=$(id); return e?e.checked:false; };
  var k=document.querySelector('input[name=f_kind]:checked');
  var wd=[].slice.call(document.querySelectorAll('[data-wd]')).filter(function(x){ return x.checked; }).map(function(x){ return x.getAttribute('data-wd'); });
  var times=[0,1,2].map(function(i){ var s=document.querySelector('[data-ts="'+i+'"]'), e=document.querySelector('[data-te="'+i+'"]'); return [s?s.value:'', e?e.value:'']; });
  return { title:g('f_title'), kind:k?k.value:EDIT.base.kind, enabled:c('f_enabled'), text:g('f_text'), size:g('f_size'), color:g('f_color'), bold:c('f_bold'), effect:g('f_effect'), speed:g('f_speed'), hold:g('f_hold'),
    fit:g('f_fit'), meffect:g('f_meffect'), mspeed:g('f_mspeed'), mhold:g('f_mhold'), pstart:g('f_pstart'), pend:g('f_pend'), wd:wd, times:times };
}
function renderEditor(ad, errors){
  EDIT.base=ad; EDIT.errors=errors||[];
  $('mbox').innerHTML='<div class="mhead"><h3>'+(EDIT.isNew?'새 광고':'광고 고치기')+'</h3><span class="sp"></span><button class="sm" id="mClose">닫기</button></div>'
    +'<div id="mBody">'+V.editorForm(ad, EDIT.errors, EDIT.isNew, Date.now())+'</div><div class="pvwrap"><div id="pvBox">'+V.previewBox(ad, SCREEN)+'</div></div>'
    +'<div class="mfoot"><span class="hint" id="upMsg"></span><span class="sp"></span><button id="mCancel">취소</button><button class="pri" id="mSave">저장</button></div>';
}
function openEditor(id){
  var raw=id?D.ads[id]:null;
  EDIT={ isNew:!raw, errors:[] };
  renderEditor(raw?Object.assign({}, raw):C.newAd('text', { order:nextOrder() }), []);
  $('modal').style.display='flex';
}
function closeEditor(){ $('modal').style.display='none'; EDIT=null; }
function refreshPreview(){ if(!EDIT) return; var ad=V.adFromForm(EDIT.base, readValues()); $('pvBox').innerHTML=V.previewBox(ad, SCREEN); $('fWarn').innerHTML=V.warnBox(C.warnAd(ad, Date.now())); }
async function saveEdit(){
  var ad=V.adFromForm(EDIT.base, readValues()), r=C.validateAd(ad);
  if(!r.ok){ renderEditor(ad, r.errors); return; }
  var isNew=EDIT.isNew, rev=Number(EDIT.base.revision||0);
  try{
    await gate.save(adRef(ad.id), function(prev){ return C.patchedAd(prev, ad, ad); }, isNew?{ entityType:'SignboardAd', expectedRevision:-1 }:{ entityType:'SignboardAd', expectedRevision:rev });
  }catch(e){ toast('저장하지 못했습니다: '+errMsg(e)); return; }
  closeEditor(); await reload();
  toast('저장했습니다 — «전광판에 올리기»를 눌러야 전광판에 나갑니다');
}
/* 사진·동영상 올리기 — 우리 창고(signboard/). 심부름꾼이 이 주소를 내려받는다 */
async function onFile(inp){
  var f=inp.files&&inp.files[0]; if(!f||!EDIT) return;
  var kind=EDIT.base.kind, max=kind==='image'?C.MAX_IMAGE_BYTES:C.MAX_VIDEO_BYTES;
  if((f.type||'').indexOf(kind+'/')!==0){ toast((kind==='image'?'사진':'동영상')+' 파일만 올릴 수 있습니다'); inp.value=''; return; }
  if(f.size>max){ toast((kind==='image'?'사진은 ':'동영상은 ')+Math.round(max/1048576)+'MB 까지입니다'); inp.value=''; return; }
  if(!bucket){ toast('파일 창고에 연결되지 않았습니다'); return; }
  var ext=(String(f.name).match(/\.[A-Za-z0-9]{1,5}$/)||[''])[0].toLowerCase();
  var path='signboard/'+EDIT.base.id+'_'+Date.now().toString(36)+ext, ref=bucket.ref(path);
  var msg=$('upMsg'), btn=$('mSave'); btn.disabled=true; msg.textContent='올리는 중…';
  try{
    var task=ref.put(f, { contentType:f.type });
    task.on('state_changed', function(s){ msg.textContent='올리는 중 '+Math.round(100*s.bytesTransferred/Math.max(1,s.totalBytes))+'%'; });
    await task;
    var url=await ref.getDownloadURL();
    var cur=V.adFromForm(EDIT.base, readValues());
    cur.media=Object.assign({}, cur.media, { path:path, url:url, name:f.name, contentType:f.type, size:f.size });
    renderEditor(cur, []);
    $('upMsg').textContent='올렸습니다';
  }catch(e){ msg.textContent=''; toast('올리지 못했습니다: '+errMsg(e)); }
  finally{ var b=$('mSave'); if(b) b.disabled=false; }
}

/* ═══ 올리기·되돌리기·첫 전송 확인 ═══ */
function badAds(){
  return liveAds().filter(function(a){ return a.enabled!==false && !C.validateAd(a).ok; }).map(function(a){ return a.title||a.id; });
}
async function writePublished(build, version){
  /* 올린 판을 «먼저» 쓴다 — 남이 먼저 올렸으면 여기서 접힌다(진짜 값이 있을 때만 판 번호를 비교하고, 찬 자리 null 은 접지 않는다).
     올린 기록은 «그 뒤에» 쓴다 — 기록을 먼저 쓰면 동시에 누른 두 사람 가운데 늦은 쪽이 남의 기록을 덮어쓴다. */
  var rec=null, lost=false;
  try{
    await gate.save(fbDb.ref('signboard/published'), function(prev){
      if(prev && (Number(prev.version)||0)!==version-1){ lost=true; return undefined; }
      lost=false; rec=build(prev||D.pub); return rec;
    }, { entityType:'SignboardPublish' });
  }catch(e){
    /* 관문은 «레코드를 안 돌려준 것»을 «영구 ID 없음»으로 말한다 — 우리가 일부러 접은 것이면 제대로 말해 준다 */
    if(lost) throw new Error('다른 사용자가 먼저 올렸습니다 — 화면을 새로 불러왔으니 다시 확인하세요');
    throw e;
  }
  try{
    await gate.save(fbDb.ref('signboard/history/'+version), C.historyRecord(rec), { entityType:'SignboardPublish' });
    return true;
  }catch(e){ return false; }   /* 판은 올라갔다 — 기록만 못 남겼다(현재 판은 기록 표에서 직접 그려 준다) */
}
async function publish(){
  var df=C.diffPublished(D.ads, D.pub&&D.pub.ads); if(!df.total){ toast('올릴 변경이 없습니다'); return; }
  var bad=badAds(); if(bad.length){ alert('고쳐야 올릴 수 있는 광고가 있습니다:\n- '+bad.join('\n- ')); return; }
  var ads=C.publishableAds(D.ads), now=Date.now(), sid=ME.sid;
  if(!ads.length){ alert('올라갈 광고가 0건입니다.\n전광판을 통째로 비우는 일은 이 화면에서 하지 않습니다(심부름꾼도 0건 판은 보내지 않습니다).\n광고를 하나 이상 켠 뒤 올려 주세요.'); return; }
  var lines=ads.map(function(a,i){ return (i+1)+'. '+a.title+' — '+C.periodSummary(a.period); }).join('\n');
  var warns=[]; ads.forEach(function(a){ C.warnAd(a, now).forEach(function(m){ warns.push('- '+a.title+': '+m); }); });
  if(!confirm('길거리 전광판에 그대로 보입니다.\n\n올라갈 광고 '+ads.length+'건:\n'+lines+(warns.length?'\n\n⚠ 확인하세요:\n'+warns.join('\n'):'')+'\n\n올릴까요?')) return;
  var version=((D.pub&&Number(D.pub.version))||0)+1;
  var histOk;
  try{
    histOk=await writePublished(function(prev){ return C.publishedRecord(prev, D.ads, sid, now, ''); }, version);
  }catch(e){ toast('올리지 못했습니다: '+errMsg(e)); await reload(); return; }
  await reload(); toast(version+'번 판으로 올렸습니다 — 심부름꾼이 곧 전광판에 보냅니다'+(histOk?'':' (올린 기록은 남기지 못했습니다)'));
}
async function rollback(ver){
  var h=D.hist[ver]; if(!h){ toast('그 판의 기록이 없습니다'); return; }
  if(!confirm(ver+'번 판으로 되돌릴까요?\n(새 판 번호로 올라가며, 지금 고쳐 둔 광고 목록은 그대로 남습니다)')) return;
  var now=Date.now(), sid=ME.sid, version=((D.pub&&Number(D.pub.version))||0)+1;
  var histOk;
  try{
    histOk=await writePublished(function(prev){ return C.rollbackRecord(prev, h, sid, now); }, version);
  }catch(e){ toast('되돌리지 못했습니다: '+errMsg(e)); await reload(); return; }
  await reload(); toast(ver+'번 판으로 되돌렸습니다'+(histOk?'':' (올린 기록은 남기지 못했습니다)'));
}
async function confirmFirst(){
  if(!confirm('전광판에 지금 들어 있는 광고가 지워지고, 이 화면의 광고로 바뀝니다.\n허락할까요?')) return;
  try{
    await gate.save(fbDb.ref('signboard/control'), function(prev){ return Object.assign({}, prev||{}, { id:'control', firstReplaceConfirmed:true, confirmedBy:ME.sid, confirmedAt:Date.now() }); }, { entityType:'SignboardControl' });
  }catch(e){ toast('허락을 저장하지 못했습니다: '+errMsg(e)); return; }
  await reloadState(); toast('허락했습니다 — 심부름꾼이 다음 점검 때 보냅니다');
}

/* ═══ 일괄 처리 ═══ */
async function bulkDo(kind){
  var ids=Object.keys(SEL); if(kind==='clear'){ SEL={}; drawAds(); return; }
  if(!ids.length) return;
  if(kind==='del' && !confirm(ids.length+'건을 지울까요? (지워도 올린 기록에는 남습니다)')) return;
  var res=await Promise.allSettled(ids.map(function(id){ return kind==='del'?deleteAd(id):saveAdPatch(id, { enabled:kind==='on' }); }));
  var fail=res.filter(function(x){ return x.status==='rejected'; });
  SEL={}; await reload();
  toast(fail.length?(ids.length-fail.length)+'건 완료 · '+fail.length+'건 실패: '+errMsg(fail[0].reason):ids.length+'건 완료');
}

/* ═══ 이벤트 ═══ */
document.addEventListener('click', function(ev){
  var t=ev.target, el;
  if((el=t.closest('#tabs button'))){ setTab(el.getAttribute('data-tab')); return; }
  if(t.closest('#newBtn')){ openEditor(null); return; }
  if(t.closest('#pubBtn')){ publish(); return; }
  if((el=t.closest('[data-edit]'))){ ev.preventDefault(); openEditor(el.getAttribute('data-edit')); return; }
  if((el=t.closest('[data-mv]'))){ var p=el.getAttribute('data-mv').split(':'); moveAd(p[1], p[0]); return; }
  if((el=t.closest('[data-bulk-do]'))){ bulkDo(el.getAttribute('data-bulk-do')); return; }
  if(t.closest('[data-confirm-first]')){ confirmFirst(); return; }
  if((el=t.closest('[data-rollback]'))){ rollback(el.getAttribute('data-rollback')); return; }
  if(t.closest('#mClose')||t.closest('#mCancel')){ closeEditor(); return; }
  if(t.closest('#mSave')){ saveEdit(); return; }
});
document.addEventListener('change', function(ev){
  var t=ev.target;
  if(t.matches('input[data-all]')){ [].forEach.call(t.closest('table').querySelectorAll('input[data-ck]'), function(c){ c.checked=t.checked; var k=c.getAttribute('data-ck'); if(t.checked) SEL[k]=1; else delete SEL[k]; }); drawBulk(); return; }
  if(t.matches('input[data-ck]')){ var k=t.getAttribute('data-ck'); if(t.checked) SEL[k]=1; else delete SEL[k]; drawBulk(); return; }
  if(t.matches('input[data-en]')){ saveAdPatch(t.getAttribute('data-en'), { enabled:t.checked }).then(reload).catch(function(e){ toast('바꾸지 못했습니다: '+errMsg(e)); reload(); }); return; }
  if(EDIT && t.matches('input[name=f_kind]')){ var cur=V.adFromForm(EDIT.base, readValues()), nk=C.newAd(t.value, { id:EDIT.base.id, order:EDIT.base.order }); nk.title=cur.title; nk.period=cur.period; nk.enabled=cur.enabled; renderEditor(nk, []); return; }
  if(EDIT && t.id==='f_file'){ onFile(t); return; }
  if(EDIT && $('modal').contains(t)) refreshPreview();
});
document.addEventListener('input', function(ev){ if(EDIT && $('modal').contains(ev.target)) refreshPreview(); });

/* ═══ 로그인·잠금 — 모르면 잠근다 ═══ */
function lock(why){ $('app').style.display='none'; $('lock').style.display='block'; $('lockWhy').textContent=why||''; }
async function managerSid(u){
  try{ var v=(await fbDb.ref('uid_roles/'+u.uid).once('value')).val()||{};
    return v.status==='active' && v.sid && (v.isAdmin===true||v.isSubAdmin===true) ? String(v.sid) : '';
  }catch(e){ return ''; }
}
function boot(){
  var t=lsGet('tab'); if(['ads','state','hist'].indexOf(t)>=0) TAB=t;
  if(location.protocol==='file:'){ lock('file:// 로 열면 로그인할 수 없습니다 — 주소로 여세요'); return; }
  if(typeof firebase==='undefined'){ lock('인터넷이 필요합니다'); return; }
  if(!firebase.apps||!firebase.apps.length) firebase.initializeApp(FB_CONFIG);
  fbDb=firebase.database();
  try{ bucket=firebase.app().storage('gs://pureun-erp-hrphotos'); }catch(e){ bucket=null; }
  try{ firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL); }catch(e){}
  firebase.auth().onAuthStateChanged(async function(u){
    $('outBtn').style.display=u?'':'none';
    if(!u){ PuGate.show(); return; }
    PuGate.hide();
    var sid=await managerSid(u);
    if(!sid){ lock('접속: '+(u.email||'-')+' — 관리자·위임관리인이 아니거나 재직 중이 아닙니다'); return; }
    ME.sid=sid; gate=PuOntologyWrite.createGateway({ mode:'enforce', actor:sid });
    $('lock').style.display='none'; $('app').style.display='';
    await reload(); setTab(TAB);
  });
}
boot();
</script>
</body>
</html>
```

- [ ] **Step 4: 도우미 `prep-page.js`·`bump-cache.js` 를 도구 폴더에 만들고, 화면을 준비한다**

`C:\Users\fair0\AppData\Local\Temp\signboard-tools\prep-page.js`:

```js
/* pu-signboard.html 준비 — ① FB_CONFIG 줄을 pu-govaid.html 에서 그대로 가져온다 ② 공용 스크립트 ?v= 를 pu-govaid.html 현재 값에 맞춘다
   쓰는 법: node prep-page.js <저장소 뿌리> */
const fs = require('fs');
const path = require('path');
const root = process.argv[2] || process.cwd();
const gov = fs.readFileSync(path.join(root, 'pu-govaid.html'), 'utf8');
const line = gov.split(/\r?\n/).find((l) => /^var FB_CONFIG=/.test(l));
if (!line) throw new Error('pu-govaid.html 에서 FB_CONFIG 줄을 못 찾았습니다');
const file = path.join(root, 'pu-signboard.html');
let s = fs.readFileSync(file, 'utf8');
if (s.indexOf('//@@FB_CONFIG@@') >= 0) s = s.replace('//@@FB_CONFIG@@', () => line);
['pu-ontology', 'pu-ls-guard', 'pu-ontology-write', 'pu-gate', 'pu-appbar', 'pu-active', 'pu-logout-why', 'pu-whoami', 'pu-back'].forEach((n) => {
  const m = new RegExp('src="js/' + n + '\\.js\\?v=(\\d+)"').exec(gov);
  if (!m) throw new Error(n + ' 의 ?v= 번호를 pu-govaid.html 에서 못 찾았습니다');
  s = s.replace(new RegExp('(src="js/' + n + '\\.js\\?v=)\\d+(")'), '$1' + m[1] + '$2');
});
fs.writeFileSync(file, s);
console.log('준비 완료 — FB_CONFIG 줄:', /^var FB_CONFIG=/m.test(s) ? '있음' : '없음', '· 표식:', s.indexOf('@@FB_CONFIG@@') >= 0 ? '남음(오류)' : '없음');
```

`C:\Users\fair0\AppData\Local\Temp\signboard-tools\bump-cache.js`:

```js
/* 고친 공용 js 를 부르는 모든 html 의 ?v= 를 1씩 올린다 (캐시 번호 규칙 — scripts/check-cache-version.js 가 «안 올렸으면 막기만» 한다)
   쓰는 법: node bump-cache.js <저장소 뿌리> js/pu-ontology.js js/pu-appbar.js
   ⚠ 같은 번호를 두 번 올리지 않는다 — 이 스크립트는 «한 번만» 돌린다(이미 올렸는지는 git diff 로 본다). */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const root = process.argv[2];
const files = process.argv.slice(3);
if (!root || !files.length) throw new Error('쓰는 법: node bump-cache.js <뿌리> <js 경로>...');
const pages = execSync('git ls-files "*.html"', { cwd: root, encoding: 'utf8' }).split('\n').map((s) => s.trim()).filter(Boolean);
pages.concat(['pu-signboard.html']).filter((v, i, a) => a.indexOf(v) === i).forEach((pg) => {
  const p = path.join(root, pg);
  if (!fs.existsSync(p)) return;
  const raw = fs.readFileSync(p, 'utf8');
  let s = raw, hit = 0;
  files.forEach((f) => {
    const name = f.replace(/^.*\//, '');                                   // pu-ontology.js
    const re = new RegExp('((?:src|href)="(?:[./\\w-]*/)?' + name.replace(/[.]/g, '[.]') + '\\?v=)(\\d+)(")', 'g');
    s = s.replace(re, (m, a, v, c) => { hit++; return a + (Number(v) + 1) + c; });
  });
  if (hit) { fs.writeFileSync(p, s); console.log('올림:', pg, hit + '곳'); }
});
```

Run:
```bash
cd /c/Users/fair0/Documents/pu-wt-signboard
node /c/Users/fair0/AppData/Local/Temp/signboard-tools/prep-page.js "$(pwd)"
```
Expected: `준비 완료 — FB_CONFIG 줄: 있음 · 표식: 없음`. (공용 스크립트 `?v=` 도 `pu-govaid.html` 의 현재 값에 맞춰진다.)

- [ ] **Step 5: `app` 구역을 돌려 온톨로지·타일·앱 막대·팔레트 등록부에 넣는다**

Run: `node /c/Users/fair0/AppData/Local/Temp/signboard-tools/integrate.js "$(pwd)" app`
Expected: `넣음` 일곱 줄(온톨로지 셋 `SignboardAd:` · `signboard:{ name:'전광판'` · `signboard_core:` / `key:'signboard'`(enter.html) / `key: 'signboard'`(pu-appbar.js) / 팔레트 등록부 둘).

- [ ] **Step 6: 고친 공용 js 를 싣는 모든 html 의 캐시 번호를 «한 번만» 올린다**

Run:
```bash
node /c/Users/fair0/AppData/Local/Temp/signboard-tools/bump-cache.js "$(pwd)" js/pu-ontology.js js/pu-appbar.js | tail -4
node scripts/check-cache-version.js --all && echo "캐시 번호 점검 통과"
```
Expected: `올림: …html N곳` 줄들(여러 파일) 뒤에 `캐시 번호 점검 통과`. ⚠ 이 스크립트를 **두 번 돌리지 않는다**(번호가 두 번 올라간다 — 올라가도 해롭지는 않지만 불필요한 변경이 크다).

- [ ] **Step 7: 통과를 확인한다**

Run:
```bash
node --test tests/signboard-ontology.test.js tests/signboard-html.test.js tests/ontology-registry.test.js tests/color-palette-apps.test.js tests/one-window-per-app.test.js tests/ontology-contract.test.js
```
Expected: PASS — `signboard-ontology` `ℹ pass 6`, `signboard-html` `ℹ pass 17`, 나머지 기존 검사 통과(특히 `ontology-registry` 의 «타일 없는 등록 프로그램»·«등록부에 없는 화면»·«주인 없는 저장 자리»).

- [ ] **Step 8: 커밋 전에 «무엇이 바뀌었는지»를 확인한다**

Run: `git status --short | grep -v "^ M .*\.html$"`
Expected(이것만 — 다른 것이 있으면 멈추고 이유를 본다):
```
 M js/pu-appbar.js
 M js/pu-ontology.js
 M tests/color-palette-apps.test.js
?? pu-signboard.html
?? tests/signboard-html.test.js
?? tests/signboard-ontology.test.js
```
(`enter.html` 과 캐시 번호만 바뀐 html 들은 `.html` 줄이라 위 필터에서 빠진다. 그 줄들의 `git diff` 는 `?v=` 숫자 한 줄씩뿐이어야 한다: `git diff --numstat -- '*.html' | awk '$1>4'` 가 `enter.html`(타일 3줄 + `?v=`) 말고 비어야 한다.)

- [ ] **Step 9: 커밋 (이 작업폴더는 이 계획만 쓰므로 index 에 남의 것이 없다 — 그래도 직후 확인)**

```bash
git add pu-signboard.html tests/signboard-html.test.js tests/signboard-ontology.test.js js/pu-ontology.js js/pu-appbar.js enter.html tests/color-palette-apps.test.js
git add -u -- '*.html'
git commit -m "feat(전광판): 포털 «영업관리» 줄에 전광판 앱 — 화면·온톨로지·타일 한 커밋 (perm 방식)"
git show --stat HEAD | tail -3
```
Expected: 파일 수가 «html 수십 개(캐시 번호만) + 위 파일들» 이다. `git show --stat HEAD | grep -v html` 로 html 이 아닌 것이 위 목록과 같은지 본다.

---

### Task 6: 브라우저에서 «실제로 돌려» 확인 (가짜 파이어베이스, 커밋 없음)

운영 데이터는 건드리지 않는다. 가짜 데이터베이스가 **거래를 진짜처럼 «찬 자리 null 먼저»로 부르고**, 사진 올리기·로그인을 흉내 낸다. 하네스 파일(`_harness-signboard.html`)은 확인이 끝나면 **반드시 지운다**(`ontology-registry` 가 «등록부에 없는 화면»으로 전체 검사를 깬다).

**Files:** 도구 폴더에 `harness.js`·`harness-check.js` (저장소 밖). 저장소에는 아무것도 남기지 않는다.

- [ ] **Step 1: 하네스 서버 스크립트를 도구 폴더에 만든다**

`C:\Users\fair0\AppData\Local\Temp\signboard-tools\harness.js`:

```js
/* 전광판 화면 확인용 «가짜 파이어베이스» 하네스 — 저장소에 남기지 않는다(확인이 끝나면 지운다)
   쓰는 법: node harness.js <저장소 뿌리> [포트]   →  http://localhost:<포트>/_harness-signboard.html
   ★ 거래(transaction)는 진짜처럼 «찬 자리에서 먼저 null 로» 불러 본다 — 접히는 버그를 잡으려고(메모리 rtdb-transaction-cold-abort). */
const fs = require('fs');
const path = require('path');
const http = require('http');
const root = process.argv[2] ? path.resolve(process.argv[2]) : '';
const port = Number(process.argv[3] || 5179);
if (!root) throw new Error('쓰는 법: node harness.js <저장소 뿌리> [포트]');

const FAKE = `
(function(){
  var NOW = Date.now();
  var tree = {
    uid_roles: { adminUid: { status:'active', sid:'A-001', isAdmin:true } },
    signboard: {
      ads: {
        ad_t1: { id:'ad_t1', entityType:'SignboardAd', title:'부당해고 무료상담', kind:'text', enabled:true, order:1, revision:1,
          text:{ string:'부당해고·임금체불 무료상담 02-000-0000', size:24, color:'#ffff00', bold:true, effectType:26, effectSpeed:5, holdSec:5 },
          period:{ start:'', end:'' } },
        ad_t2: { id:'ad_t2', entityType:'SignboardAd', title:'추석 인사', kind:'text', enabled:true, order:2, revision:1,
          text:{ string:'즐거운 한가위 되세요', size:28, color:'#ff0000', bold:false, effectType:0, effectSpeed:5, holdSec:6 },
          period:{ start:'2026-09-20', end:'2026-09-30', weekdays:['Mon','Tue'] } }
      },
      published: { id:'published', entityType:'SignboardPublish', version:1, publishedAt: NOW-3600000, publishedBy:'A-001', note:'', revision:1,
        ads:[ { id:'ad_t1', title:'부당해고 무료상담', kind:'text', period:{ start:'', end:'', weekdays:[], times:[] },
          text:{ string:'부당해고·임금체불 무료상담 02-000-0000', size:24, color:'#ffff00', bold:true, effectType:26, effectSpeed:5, holdSec:5 } } ] },
      history: { 1: { id:'1', entityType:'SignboardPublish', version:1, publishedAt: NOW-3600000, publishedBy:'A-001', note:'', revision:1, ads:[ { id:'ad_t1', title:'부당해고 무료상담', kind:'text', period:{ start:'', end:'', weekdays:[], times:[] }, text:{ string:'x', size:24, color:'#ffff00', bold:true, effectType:26, effectSpeed:5, holdSec:5 } } ] } },
      control: {},
      state: { agentSeenAt: NOW-120000, mode:'dry-run', result:'dry-run', dryRunVersion:1, message:'시험 모드 — 보낼 내용을 outbox/v1.json 에 적었습니다', screenAssumed:true }
    }
  };
  window.__tree = tree; window.__log = [];
  function get(p){ var c=tree; String(p).split('/').filter(Boolean).forEach(function(k){ c = c && typeof c==='object' ? c[k] : undefined; }); return c; }
  function put(p, v){ var ks=String(p).split('/').filter(Boolean), c=tree; for(var i=0;i<ks.length-1;i++){ if(!c[ks[i]]||typeof c[ks[i]]!=='object') c[ks[i]]={}; c=c[ks[i]]; } if(v===null||v===undefined) delete c[ks[ks.length-1]]; else c[ks[ks.length-1]]=JSON.parse(JSON.stringify(v)); }
  function snap(v){ var x = v===undefined ? null : JSON.parse(JSON.stringify(v)); return { val:function(){ return x; }, exists:function(){ return x!==null; } }; }
  function mkref(path){
    return { path:path,
      child:function(p){ return mkref(path+'/'+p); },
      once:function(){ return Promise.resolve(snap(get(path))); },
      transaction:function(fn){
        /* 진짜처럼: 찬 자리에서 먼저 null 로 부른다. undefined 를 돌려주면 서버에 묻지도 않고 접는다 */
        var guess = fn(null);
        if(guess === undefined){ window.__log.push({ path:path, committed:false, why:'cold-null abort' }); return Promise.resolve({ committed:false, snapshot:snap(get(path)) }); }
        var server = get(path), out = guess;
        if(server !== undefined && server !== null){ out = fn(JSON.parse(JSON.stringify(server))); if(out === undefined){ window.__log.push({ path:path, committed:false, why:'real abort' }); return Promise.resolve({ committed:false, snapshot:snap(server) }); } }
        put(path, out); window.__log.push({ path:path, committed:true });
        return Promise.resolve({ committed:true, snapshot:snap(out) });
      },
      set:function(v){ put(path, v); return Promise.resolve(); }, update:function(v){ Object.keys(v).forEach(function(k){ put(path+'/'+k, v[k]); }); return Promise.resolve(); }, remove:function(){ put(path,null); return Promise.resolve(); }
    };
  }
  var db = { ref:function(p){ return mkref(p||''); } };
  var user = { uid:'adminUid', email:'admin@pureun.kr' };
  var authObj = { currentUser:user, onAuthStateChanged:function(cb){ setTimeout(function(){ cb(user); }, 0); return function(){}; }, setPersistence:function(){ return Promise.resolve(); }, signOut:function(){ return Promise.resolve(); } };
  var storageObj = { ref:function(p){ return { put:function(file){ window.__log.push({ upload:p, size:file.size, type:file.type }); var t = Promise.resolve({}); t.on = function(ev, cb){ cb({ bytesTransferred:5, totalBytes:10 }); }; return t; },
    getDownloadURL:function(){ return Promise.resolve('https://firebasestorage.googleapis.com/v0/b/pureun-erp-hrphotos/o/'+encodeURIComponent(p)+'?alt=media&token=t'); } }; } };
  var firebase = { apps:[], initializeApp:function(){ firebase.apps=[{}]; },
    database:function(){ return db; }, auth:function(){ return authObj; }, app:function(){ return { storage:function(){ return storageObj; } }; } };
  firebase.auth.Auth = { Persistence:{ LOCAL:'local' } };
  window.firebase = firebase;
  window.confirm = function(m){ window.__lastConfirm = m; return true; };
  window.alert = function(m){ window.__lastAlert = m; };
})();
`;

let html = fs.readFileSync(path.join(root, 'pu-signboard.html'), 'utf8');
html = html.replace(/<script src="https:\/\/www\.gstatic\.com\/firebasejs\/[^"]+"><\/script>\s*/g, '');
html = html.replace('<script src="js/pu-ontology.js', '<script>' + FAKE + '</script>\n<script src="js/pu-ontology.js');
fs.writeFileSync(path.join(root, '_harness-signboard.html'), html);

const types = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
http.createServer((req, res) => {
  const f = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('없음'); return; }
  res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(f).pipe(res);
}).listen(port, '127.0.0.1', () => console.log('하네스: http://localhost:' + port + '/_harness-signboard.html'));
```

- [ ] **Step 2: 서버를 띄운다 (백그라운드)**

Run:
```bash
cd /c/Users/fair0/Documents/pu-wt-signboard
node /c/Users/fair0/AppData/Local/Temp/signboard-tools/harness.js "$(pwd)" 5179 &
sleep 2; curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5179/_harness-signboard.html
```
Expected: `200`

- [ ] **Step 3: 브라우저로 연다**

`http://localhost:5179/_harness-signboard.html` 을 연다(Claude 브라우저 창이면 `navigate`). 가짜 관리자(`isAdmin`)로 로그인된 상태이고 광고 둘이 보여야 한다. 콘솔에 빨간 오류가 없어야 한다(`read_console_messages onlyErrors`).

- [ ] **Step 4: 확인 스크립트 27항목을 한 번에 돌린다**

`C:\Users\fair0\AppData\Local\Temp\signboard-tools\harness-check.js` 를 만들고, 그 내용 전체를 하네스 페이지의 브라우저 콘솔(또는 `javascript_tool`)에서 실행한다.

```js
/* 하네스 화면에서 «붙여넣어 실행»하는 확인 스크립트 — 결과 객체의 값이 전부 true 여야 한다. (저장소에 넣지 않는다)
   브라우저 콘솔(또는 javascript_tool)에서 http://localhost:5179/_harness-signboard.html 를 연 상태로 실행. */
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const T = () => window.__tree.signboard;
  const $ = (id) => document.getElementById(id);
  const r = {};
  const ok = (name, cond) => { r[name] = !!cond; };
  const fire = (e, ev) => e.dispatchEvent(new Event(ev, { bubbles: true }));
  const set = (id, v) => { const e = $(id); e.value = v; fire(e, 'input'); fire(e, 'change'); };

  await sleep(800);
  ok('01 목록에 광고 2건·올리지 않은 변경 띠', document.querySelectorAll('#adsBox tbody tr').length === 2 && $('pendBar').className.indexOf('on') >= 0);

  /* 새 글자 광고 — 이모지 경고, 요일·시간대, 저장 */
  $('newBtn').click(); await sleep(200);
  set('f_title', '수요일 시간대 광고'); set('f_text', '임금체불 상담 😀'); set('f_size', '16');
  ok('02 이모지 경고가 편집 상자 맨 위에 뜬다', $('fWarn').innerText.indexOf('이모지') >= 0);
  set('f_text', '임금체불 상담');
  ok('03 경고는 문구를 고치면 사라진다', $('fWarn').innerText.indexOf('이모지') < 0);
  const wd = document.querySelector('[data-wd="Wed"]'); wd.checked = true; fire(wd, 'change');
  set('f_pstart', '2026-10-13'); set('f_pend', '2026-10-31');
  document.querySelector('[data-ts="0"]').value = '09:00'; document.querySelector('[data-te="0"]').value = '18:00';
  document.querySelector('[data-ts="1"]').value = '17:00'; document.querySelector('[data-te="1"]').value = '20:00';
  $('mSave').click(); await sleep(400);
  ok('04 겹치는 시간대는 저장되지 않고 오류가 보인다', $('modal').style.display !== 'none' && $('mBody').innerText.indexOf('겹칩니다') >= 0);
  document.querySelector('[data-te="0"]').value = '12:00'; document.querySelector('[data-ts="1"]').value = '12:00';
  $('mSave').click(); await sleep(600);
  const mine = Object.values(T().ads).find((a) => a.title === '수요일 시간대 광고');
  ok('05 저장됨 — 관문이 id·판·시각을 채웠고, 글자 광고에 사진 칸이 없다', mine && mine.revision === 1 && mine.schemaVersion >= 1 && mine.createdBy && !('media' in mine));
  ok('06 기간·요일·시간대가 그대로 저장됐다', mine && mine.period.weekdays.join() === 'Wed' && mine.period.times.length === 2);

  /* 올리기 — 판 먼저, 기록 뒤 */
  $('pubBtn').click(); await sleep(900);
  const order = window.__log.map((l) => l.path).filter(Boolean).slice(-2);
  ok('07 올린 판 → 올린 기록 순서로 썼다', order[0] === 'signboard/published' && /^signboard\/history\/\d+$/.test(order[1]));
  ok('08 확인 창에 «길거리»와 광고 목록이 나왔다', /길거리 전광판에 그대로 보입니다/.test(window.__lastConfirm) && /수요일 시간대 광고/.test(window.__lastConfirm));
  const v1 = T().published.version;
  ok('09 판 번호가 늘고 기록이 생겼다', v1 >= 2 && !!T().history[v1]);
  ok('10 올린 뒤에는 변경 띠가 사라진다', $('pendBar').className.indexOf('on') < 0);

  /* 순서 바꾸기 */
  document.querySelector('[data-mv="up:' + mine.id + '"]').click(); await sleep(700);
  ok('11 순서가 바뀌고 «순서 바뀜» 띠가 뜬다', /순서 바뀜/.test($('pendTxt').textContent));

  /* 동시에 올리기 — 남이 먼저 올렸다 */
  const rival = JSON.parse(JSON.stringify(T().published)); rival.version = v1 + 1; rival.publishedBy = 'B-002'; rival.revision += 1;
  T().published = rival; T().history[rival.version] = Object.assign({}, rival, { id: String(rival.version) });
  const rivalHist = JSON.stringify(T().history[rival.version]);
  window.D.pub = Object.assign({}, rival, { version: v1, publishedBy: 'A-001' });   /* 내 화면은 옛 판을 안다 */
  $('pubBtn').click(); await sleep(900);
  ok('12 늦게 누른 쪽은 접히고, 제대로 된 문구로 알린다', /다른 사용자가 먼저 올렸습니다/.test($('toast').textContent));
  ok('13 남이 올린 판과 남의 기록은 그대로다', T().published.publishedBy === 'B-002' && JSON.stringify(T().history[rival.version]) === rivalHist);

  /* 되돌리기 */
  await reload();
  document.querySelector('[data-tab="hist"]').click(); await sleep(200);
  const histBtn = document.querySelector('[data-rollback]');
  ok('14 올린 기록 표에 되돌리기 단추가 있다(지금 판은 없다)', !!histBtn && !document.querySelector('[data-rollback="' + T().published.version + '"]'));
  const before = T().published.version; const target = histBtn.getAttribute('data-rollback');
  histBtn.click(); await sleep(900);
  ok('15 되돌려도 판 번호는 앞으로 간다 + 메모에 어느 판인지 남는다', T().published.version === before + 1 && T().published.note.indexOf(target + '번 판') >= 0);

  /* 상태 탭 — 첫 전송 확인 */
  T().state = { agentSeenAt: Date.now() - 60000, mode: 'live', result: 'wait-confirm', existingPrograms: [{ uuid: 'U1', name: '옛 광고' }], device: { width: 192, height: 96, time: 't', timeZone: 'z', luminance: '80' }, deviceReachable: true, clockWarning: '' };
  document.querySelector('[data-tab="state"]').click(); await sleep(500);
  ok('16 첫 전송 확인 단추와 «지워집니다» 안내가 있다', !!document.querySelector('[data-confirm-first]') && /지워집니다/.test($('stateBox').innerText));
  document.querySelector('[data-confirm-first]').click(); await sleep(800);
  ok('17 허락이 control 에 «누가·언제»와 함께 남는다', T().control.firstReplaceConfirmed === true && !!T().control.confirmedBy && !!T().control.confirmedAt);
  T().state = { agentSeenAt: Date.now() - 30 * 60000, mode: 'live' }; await reloadState();
  ok('18 심부름꾼이 30분 조용하면 경고가 뜬다', /20분 넘게 응답이 없습니다/.test($('stateBox').innerText));

  /* 사진 올리기 */
  document.querySelector('[data-tab="ads"]').click(); await sleep(200);
  $('newBtn').click(); await sleep(200);
  const k = document.querySelector('input[name=f_kind][value=image]'); k.checked = true; fire(k, 'change'); await sleep(200);
  set('f_title', '로고 사진');
  const up = async (file) => { const dt = new DataTransfer(); dt.items.add(file); const inp = $('f_file'); inp.files = dt.files; fire(inp, 'change'); await sleep(400); };
  await up(new File([new Uint8Array(11 * 1024 * 1024)], '큰.jpg', { type: 'image/jpeg' }));
  ok('19 11MB 사진은 올리기 전에 막힌다', /10MB/.test($('toast').textContent) && !window.__log.some((l) => l.upload));
  await up(new File(['abc'], 'a.txt', { type: 'text/plain' }));
  ok('20 사진 칸에 글자 파일은 막힌다', /사진 파일만/.test($('toast').textContent));
  await up(new File([new Uint8Array(1234)], '로고.JPG', { type: 'image/jpeg' }));
  ok('21 사진이 signboard/ 아래로 올라가고 제목은 그대로, 미리보기가 그려진다', window.__log.some((l) => /^signboard\/ad_.*\.jpg$/.test(l.upload || '')) && $('f_title').value === '로고 사진' && !!document.querySelector('#pvBox img'));
  $('mSave').click(); await sleep(700);
  const img = Object.values(T().ads).find((a) => a.title === '로고 사진');
  ok('22 사진 광고는 창고 주소·크기를 담고 글자 칸은 없다', img && /^https:[/][/]firebasestorage[.]googleapis[.]com/.test(img.media.url) && img.media.size === 1234 && !('text' in img));

  /* 일괄 처리·지우기 */
  const all = document.querySelector('input[data-all]'); all.checked = true; fire(all, 'change');
  ok('23 모두 고르면 건수가 뜬다', /건 선택/.test(document.querySelector('[data-bulk="ads"]').innerText));
  document.querySelector('[data-bulk-do="off"]').click(); await sleep(1000);
  ok('24 일괄 끄기', Object.values(T().ads).every((a) => a.enabled === false));
  const first = document.querySelector('input[data-ck]'); first.checked = true; fire(first, 'change');
  document.querySelector('[data-bulk-do="del"]').click(); await sleep(900);
  ok('25 지우기는 표식만 남긴다(물리 삭제 아님)', Object.values(T().ads).some((a) => a._deleted === true && a.deletedBy));
  $('pubBtn').click(); await sleep(500);
  ok('26 광고를 전부 끄고 올리려 하면 막힌다(0건 판)', /0건/.test(window.__lastAlert || ''));

  ok('27 접힌 거래가 «진짜 접힘» 한 번뿐이다(찬 자리 null 로 접힌 것이 없다)', window.__log.filter((l) => l.committed === false && l.why === 'cold-null abort').length === 0);
  return JSON.stringify({ allTrue: Object.values(r).every(Boolean), failed: Object.keys(r).filter((k) => !r[k]), r }, null, 1);
})()
```

Expected: `{"allTrue":true,"failed":[]}`. 하나라도 `failed` 에 나오면 그 번호의 항목을 보고 `pu-signboard.html`(또는 모듈)을 고친 뒤 **Step 4 를 처음부터 다시**(하네스를 새로고침해야 가짜 데이터가 처음으로 돌아간다).

- [ ] **Step 5: 눈으로 한 번 본다 (폰 크기 포함)**

표가 한 줄씩 보이는지, 편집 상자 미리보기가 검은 상자에 글자·사진으로 그려지는지, «전광판 상태» 카드가 읽히는지, 폭 375px(`resize_window` preset `mobile`)에서 페이지가 옆으로 밀리지 않고 표만 상자 안에서 가로로 스크롤되는지 본다. 끝나면 `resize_window` preset `desktop` 으로 되돌린다.

- [ ] **Step 6: 정리한다 — 서버를 끄고 하네스 파일을 지운다**

Run:
```bash
powershell.exe -NoProfile -Command "Get-NetTCPConnection -LocalPort 5179 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id \$_.OwningProcess -Force -ErrorAction SilentlyContinue }"
rm -f _harness-signboard.html
git status --short | grep -c harness
```
Expected: `0`

---

### Task 7: 검사가 «이빨이 있는지» 확인하고, 전체 검사·기록

**Files:** 도구 폴더 `mutate.js`(저장소 밖). 저장소에서는 `status/2026-10-12-feat-signboard.md` 만 고친다.

- [ ] **Step 1: 뮤테이션 스크립트를 도구 폴더에 만든다**

`C:\Users\fair0\AppData\Local\Temp\signboard-tools\mutate.js` — 파일을 일부러 망가뜨리고 → 그 검사를 돌리고 → **반드시 되돌린다.** 앵커가 «정확히 한 번»이 아니면 «앵커 오류»로 알린다(조용히 건너뛰지 않는다).

```js
/* 뮤테이션 확인 — 검사가 «이빨이 있는지» 일부러 망가뜨려 본다. 끝나면 «반드시» 원래대로 되돌린다.
   쓰는 법: node mutate.js <저장소 뿌리>  (아래 CASES 를 하나씩: 파일을 고치고 → 그 검사를 돌리고 → 되돌린다)
   ⚠ 앵커가 «정확히 한 번»이 아니면 그 건은 시험하지 않고 «앵커 오류»로 알린다 — 조용히 건너뛰지 않는다. */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const root = path.resolve(process.argv[2] || '.');

const CASES = [
  { name: '글자 크기 상한을 풀면', file: 'js/pu-signboard-core.js', from: 'intIn(t.size, 8, 200)', to: 'intIn(t.size, 8, 20000)', test: 'tests/signboard-core.test.js' },
  { name: '기간 끝이 시작보다 빨라도 통과시키면', file: 'js/pu-signboard-core.js', from: 'p.start > p.end', to: 'false', test: 'tests/signboard-core.test.js' },
  { name: '창고 밖 주소를 받으면', file: 'js/pu-signboard-core.js', from: 'firebasestorage\\.googleapis\\.com|storage\\.googleapis\\.com|', to: '', test: 'tests/signboard-core.test.js', note: 'firebasestorage.googleapis.com 만 빼도 잡혀야 한다' },
  { name: '요일 철자(목요일)를 바꾸면', file: 'js/pu-signboard-core.js', from: "'Thur'", to: "'Thu'", test: 'tests/signboard-core.test.js' },
  { name: '기간을 장비 JSON 으로 옮길 때 초(:00)를 빼면', file: 'scripts/signboard-agent/program.js', from: "t.start + ':00'", to: 't.start', test: 'tests/signboard-program.test.js' },
  { name: '머무는 시간을 ms 로 안 바꾸면', file: 'scripts/signboard-agent/program.js', from: 'Math.round(holdSec * 1000)', to: 'Math.round(holdSec)', test: 'tests/signboard-program.test.js' },
  { name: '파일 서명에 본문을 섞으면', file: 'scripts/signboard-agent/sign.js', from: 'function signFile(sdkKey, date, secret) { return hmacMd5Hex(sdkKey + date, secret); }', to: 'function signFile(sdkKey, date, secret) { return hmacMd5Hex("x" + sdkKey + date, secret); }', test: 'tests/signboard-sign.test.js' },
  { name: '장비 정보에서 와이파이 비밀번호를 거르지 않으면', file: 'scripts/signboard-agent/device.js', from: "'luminance', 'luminance.mode']", to: "'luminance', 'luminance.mode', 'wifi.ap.passwd']", test: 'tests/signboard-device.test.js' },
  { name: '첫 전송 확인 없이 보내면', file: 'scripts/signboard-agent/run.js', from: "if ((await ctx.store.readControl()).firstReplaceConfirmed !== true) {\n    const existing", to: "if (false) {\n    const existing", test: 'tests/signboard-agent.test.js' },
  { name: '광고 0건 판도 보내면', file: 'scripts/signboard-agent/run.js', from: 'if (!ads.length) {', to: 'if (false) {', test: 'tests/signboard-agent.test.js' },
  { name: '받은 파일 크기를 안 견주면', file: 'scripts/signboard-agent/run.js', from: 'if (buf.length !== n.size)', to: 'if (false)', test: 'tests/signboard-agent.test.js' },
  { name: '시험 모드에서도 장비를 부르면', file: 'scripts/signboard-agent/run.js', from: 'if (ctx.dryRun) {\n    const uploaded', to: 'if (false) {\n    const uploaded', test: 'tests/signboard-agent.test.js' },
  { name: '오류 글에서 열쇠를 안 지우면', file: 'scripts/signboard-agent/config.js', from: "if (v.length >= 3) s = s.split(v).join('***');", to: '', test: 'tests/signboard-agent.test.js' },
  { name: '올린 기록을 올린 판보다 먼저 쓰면(동시에 누르면 남의 기록을 덮는다)', file: 'pu-signboard.html', from: "  var rec=null, lost=false;\n  try{", to: "  var rec=null, lost=false;\n  await gate.save(fbDb.ref('signboard/history/'+version), {id:String(version)}, {});\n  try{", test: 'tests/signboard-html.test.js' },
  { name: '남이 먼저 올렸는지 비교하지 않으면', file: 'pu-signboard.html', from: 'if(prev && (Number(prev.version)||0)!==version-1){ lost=true; return undefined; }', to: '', test: 'tests/signboard-html.test.js' },
  { name: '창고 규칙의 사진 한도를 새로 적으면(배포 검사가 엉뚱한 칸을 조인다)', file: 'docs/firebase-storage-전체(붙여넣기용).txt', from: 'allow write:  if isStaff() && (okImage() || okSignVideo());', to: 'allow write:  if isStaff() && request.resource.size < 10 * 1024 * 1024;', test: 'tests/signboard-storage-rule.test.js' },
  { name: '창고 규칙에서 지우기를 열면', file: 'docs/firebase-storage-전체(붙여넣기용).txt', from: '      allow delete: if false;\n    }\n\n    // 위에 없는 자리는 전부 막는다', to: '      allow delete: if isStaff();\n    }\n\n    // 위에 없는 자리는 전부 막는다', test: 'tests/signboard-storage-rule.test.js' },
  { name: '관리자 검사를 풀면', file: 'pu-signboard.html', from: 'v.isAdmin===true||v.isSubAdmin===true', to: 'true', test: 'tests/signboard-html.test.js' },
  { name: '규칙의 읽기 권한을 직원 전원으로 넓히면', file: 'scripts/make-firebase-rules.js', from: "rules.signboard = { '.read': MGR,", to: "rules.signboard = { '.read': LOGIN,", test: 'tests/signboard-rules.test.js', regen: true },
  { name: 'state 에 화면 쓰기를 열면', file: 'scripts/make-firebase-rules.js', from: "state:     { '.write': false } };", to: "state:     { '.write': MGR } };", test: 'tests/signboard-rules.test.js', regen: true },
  { name: '시간대 겹침 검사를 빼면', file: 'js/pu-signboard-core.js', from: 'if (okTimes[k].start < okTimes[k - 1].end)', to: 'if (false)', test: 'tests/signboard-core.test.js' },
  { name: '이모지 경고를 빼면', file: 'js/pu-signboard-core.js', from: "if (a.kind === 'text' && /[", to: "if (false && /[", test: 'tests/signboard-core.test.js' },
  { name: '올리기 확인 창에 경고를 안 넣으면', file: 'pu-signboard.html', from: 'C.warnAd(a, now).forEach', to: '[].forEach', test: 'tests/signboard-html.test.js' },
  { name: '내려받기 실패를 오류로 안 다루면(조용히 넘어가면)', file: 'scripts/signboard-agent/run.js', from: 'const buf = await ctx.download(n.url);', to: 'const buf = await ctx.download(n.url).catch(function () { return Buffer.alloc(n.size); });', test: 'tests/signboard-agent.test.js' },
  { name: '포털 타일을 adminOnly 로 바꾸면(위임관리인이 빠짐)', file: 'enter.html', from: "perm:'signboard', row:'sales' }", to: "adminOnly:true, perm:'signboard', row:'sales' }", test: 'tests/signboard-ontology.test.js' }
];

function run(testFile) {
  const r = spawnSync(process.execPath, ['--test', testFile], { cwd: root, encoding: 'utf8', timeout: 180000 });
  return r.status;
}
let weak = 0;
for (const c of CASES) {
  const p = path.join(root, c.file);
  if (!fs.existsSync(p)) { console.log('… 건너뜀(그 파일이 아직 없다):', c.name, '·', c.file); continue; }
  const orig = fs.readFileSync(p, 'utf8');
  const crlf = orig.indexOf('\r\n') >= 0, base = orig.replace(/\r\n/g, '\n');
  const n = base.split(c.from).length - 1;
  if (n !== 1) { console.log('⚠ 앵커 오류(' + n + '번):', c.name); weak++; continue; }
  const rulesJson = path.join(root, 'docs', 'firebase-rules-전체-적용본.json');
  const rulesOrig = c.regen ? fs.readFileSync(rulesJson) : null;
  try {
    const mut = base.replace(c.from, () => c.to);
    fs.writeFileSync(p, crlf ? mut.replace(/\n/g, '\r\n') : mut);
    if (c.regen) {
      const g = spawnSync(process.execPath, ['scripts/make-firebase-rules.js'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
      fs.writeFileSync(rulesJson, g.stdout);
    }
    const code = run(c.test);
    if (code === 0) { console.log('✖ 이빨 없음 — 망가뜨려도 통과:', c.name); weak++; } else console.log('✔ 잡힘:', c.name);
  } finally {
    fs.writeFileSync(p, orig);
    if (c.regen) fs.writeFileSync(rulesJson, rulesOrig);
  }
}
console.log(weak ? '⚠ 약한 검사 ' + weak + '건' : '모두 잡혔다 — 되돌림 완료');
process.exit(weak ? 1 : 0);
```

- [ ] **Step 2: 돌린다**

Run: `node /c/Users/fair0/AppData/Local/Temp/signboard-tools/mutate.js "$(pwd)" 2>&1 | grep -E "이빨|앵커|약한|모두 잡혔다"`
Expected: `모두 잡혔다 — 되돌림 완료`. «심부름꾼»(`scripts/signboard-agent/…`) 쪽 건은 **심부름꾼 계획서를 끝낸 뒤에야** 파일이 생기므로 `… 건너뜀(그 파일이 아직 없다)` 로 나온다 — 정상이다(그 건들은 심부름꾼 계획서에서 다시 돌린다). 포털 쪽 건에 `이빨 없음` 이나 `앵커 오류` 가 나오면 그 검사(또는 앵커)를 고친다.
그리고 `git status --short` 가 mutate 전과 같아야 한다(되돌림 확인).

- [ ] **Step 3: 전체 검사**

Run: `node --test --test-concurrency=4 "tests/*.test.js" > /tmp/full.log 2>&1; grep -E "^ℹ (tests|pass|fail)" /tmp/full.log; grep -E "^✖" /tmp/full.log | sort -u`
Expected: `ℹ fail 1` 이고 그 하나는 `★ 콘솔과 «한 곳도» 다르지 않다` 뿐(규칙을 올리면 풀리는 예상된 것). **다른 것이 빨가면 고친다.**

- [ ] **Step 4: 기록을 고친다**

`status/2026-10-12-feat-signboard.md`(이 가지에 이미 있다)의 «끝낸 것»·«남은 일»·«건드린 파일»을 이 계획에 맞게 고친다: 포털 앱 M1 코드 끝, 남은 일 = Task 8(규칙 올리기·PR)과 심부름꾼 계획서. `STATUS.md` 표에는 덧붙이지 않는다(새 파일 하나가 규칙).

```bash
git add status/2026-10-12-feat-signboard.md
git commit -m "docs(status): 전광판 포털 앱 구현 끝 — 규칙 올리기·PR 남음" -- status/2026-10-12-feat-signboard.md
```

---

### Task 8: 규칙 올리기 → PR (**사람이 보는 방에서만 — 이어하기 예약은 하지 않는다**)

⚠ 순서가 안전이다: **규칙(실시간DB·창고)을 먼저 올리고 → 그 뒤에 PR 을 합친다.** 합쳐지면 사이트가 스스로 배포되어 타일이 보이는데, 규칙이 아직 없으면 저장이 «권한 없음»으로 막힌다. CLAUDE.md 의 지시대로 규칙은 묻지 않고 올리되 **무엇이 바뀌었는지·누구에게 보이게 됐는지는 반드시 보고**한다.

- [ ] **Step 1: 최신 main 위에 얹는다**

Run: `cd /c/Users/fair0/Documents/pu-wt-signboard && git fetch origin main && git rebase origin/main`
충돌이 나면 `git rebase --abort` 하고 사람에게 알린다. main 이 `pu-ontology.js`·`pu-appbar.js` 의 `?v=` 를 같은 번호로 올렸는지 본다(`node scripts/check-cache-version.js --all`) — 겹쳤다면 한 번 더 올린다.

- [ ] **Step 2: 실시간DB 규칙 — 미리보기**

Run: `node scripts/rules-deploy.js`
Expected: `기준: 살아 있는 콘솔` · `새로 생기는 규칙 1개 + /signboard` · `값이 바뀌는 규칙 0개` · `사라지는 규칙 0개`. **사라질 규칙이 하나라도 있으면 올리지 않고 멈춘다**(종료코드 2) — 사람에게 무엇이 사라지려 했는지 그대로 알리고, 만들개에 그 규칙을 넣은 뒤 다시 돌린다. `--force` 같은 우회로는 없다.

- [ ] **Step 3: 실시간DB 규칙 — 올린다**

Run: `node scripts/rules-deploy.js --deploy`
Expected: 올림 성공 + 새 기준 파일 `docs/firebase-rules-콘솔원문-YYYY-MM-DD.json` 이 생긴다(`git status`). 이것을 같은 PR 에 커밋한다:
```bash
git add docs/firebase-rules-콘솔원문-*.json docs/rules-paste.json "docs/firebase-rules-전체-적용본.json"
git commit -m "chore(규칙): 콘솔 사본 갱신 — signboard 규칙을 올림" -- docs/firebase-rules-콘솔원문-*.json docs/rules-paste.json "docs/firebase-rules-전체-적용본.json"
```
그리고 `node --test tests/photos-staff-share.test.js` 가 통과하는지 본다(`콘솔과 «한 곳도» 다르지 않다`).

- [ ] **Step 4: 창고 규칙 — 미리보기 → 올린다**

Run: `node scripts/storage-rules-deploy.js` — Task 4 Step 5 와 같은 모양이어야 한다(`/signboard/{file}` 새로, 사라지는 것 0, 안 덮인 것 0곳). 이상 없으면 `node scripts/storage-rules-deploy.js --deploy`. 창고는 **CLI 로 «지금 콘솔»을 읽을 수 없어** 기준이 «대표님이 옮겨 주신 사본»뿐인 약한 안전장치다 — 보고서에서 숨기지 않는다. 한 벌이 **세 창고**에 나간다. 스크립트가 새 기준 파일을 만들면 커밋한다.

- [ ] **Step 6: 전체 검사 다시 + 푸시 + PR**

Run: `node --test --test-concurrency=4 "tests/*.test.js" > /tmp/full.log 2>&1; grep -E "^ℹ (tests|pass|fail)" /tmp/full.log` → `ℹ fail 0`.
```bash
git push -u origin feat/signboard
gh pr create --title "전광판 컨트롤 앱 — 영업관리 줄 (포털 앱·규칙)" --body "<본문: 무엇을 만들었나 · 규칙 올림 보고(새 칸·누구에게 보이나) · 심부름꾼은 별도 PR · 남은 일>"
```
PR 본문 끝에 `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. 올린 뒤 `get_status` 로 PR 을 묶고 CI 를 읽는다. **자동 병합을 켜지 않는다**(대표가 말하지 않았다). CI 를 직접 반복 조회하지 않는다.

- [ ] **Step 7: 대표에게 보고한다 (쉬운 한국어, 표)**

넣을 것: ① 규칙이 «무엇이 새로 생겼고 누구에게 보이게 됐는지»(실시간DB `signboard` = 관리자·위임관리인만 / 창고 `signboard/` = 직원 읽기·쓰기, 지우기 금지) ② 창고에 `erp_img` 가 함께 나갔다면 그 사실 ③ 합친 뒤 «영업관리 줄에 📺 전광판 타일이 관리자·위임관리인에게만 보인다» ④ 장비 연결은 아직 — 심부름꾼 계획서와 «대표님 준비물»(장비 번호·灰度 열쇠·네트워크).

## Self-Review (계획서를 쓴 사람이 점검한 것)

- **설계서 대응:** §4.1 타일·perm → Task 5 · §4.2 화면 → Task 2·5 · §5 데이터·규칙·창고 → Task 3·4·5 · §8 안전장치(0건·접힘·되돌리기) → Task 5·6 · §9 검사 → 각 Task 의 시험 + Task 7 뮤테이션 · §10 M1 → 전체. **M2(심부름꾼)·M3(실전)는 다른 계획서**(`2026-10-12-signboard-agent.md`)이고 M3 는 대표 준비물이 필요하다.
- **자리표시 점검:** 계획서에 «나중에 채움» 이 없다. 열쇠 줄(`FB_CONFIG`)은 «복사하는 도우미 스크립트»가 채운다.
- **이름 일치:** `SignboardCore`/`SignboardView` 의 함수 이름은 Task 1·2 의 Interfaces 와 `pu-signboard.html` 의 호출이 같다(화면 시험이 `C.softDeleted(`·`C.warnAd(`·`C.historyRecord(` 등의 호출을 직접 확인한다).
