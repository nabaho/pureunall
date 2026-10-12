# 전광판 심부름꾼 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 이 PC에서 도는 «심부름꾼»(`scripts/signboard-agent`)을 만든다 — 포털이 올린 판(`signboard/published`)을 가져와 灰度 전광판 장비에 보낸다. **시험 모드(기본)는 장비 없이 끝난다**(설계서 M2). 실전 연결(M3)은 대표 준비물이 온 뒤 이 문서 맨 끝의 «런북»으로 사람과 함께 한다.

**Architecture:** 경계마다 한 파일 — 서명(`sign.js`) · 프로그램 만들기(`program.js`, 순수) · 장비 통신(`device.js`, 전송 부분을 갈아 끼울 수 있다) · 포털 읽기·쓰기(`store.js`, firebase CLI) · 설정(`config.js`) · 장비 시계(`clock.js`) · 한 바퀴(`run.js`, 모든 바깥 부품을 주입받는다) · 실행(`main.js`). 광고의 정의는 포털과 **같은 파일**(`js/pu-signboard-core.js`)을 쓴다.

**Tech Stack:** Node 24(표준 라이브러리만 — `crypto`·`http`·`fs`·`child_process`, 새 의존성 없음), firebase CLI(이 PC 에 로그인됨), `node:test`.

**Spec:** `docs/superpowers/specs/2026-10-12-signboard-design.md` §6~§8, §11 (구현 확인으로 보정된 점은 §14 — 앞 절과 다르면 §14 가 이긴다).

**선행:** 포털 계획서(`2026-10-12-signboard-portal.md`)의 **Task 1(규칙 모듈 `js/pu-signboard-core.js`)이 끝나 있어야 한다.** 심부름꾼은 그 모듈을 `require` 한다.

## Global Constraints

- **灰度 열쇠(`sdkKey`·`sdkSecret`)는 저장소·문서·채팅·로그·DB 어디에도 적지 않는다.** 설정 파일은 저장소 밖 `%APPDATA%\pureun-signboard\config.json` 이다. 오류 글은 `scrub()` 를 지난다.
- **시험 모드가 기본.** 실전은 `config.json` 에 `"liveEnabled": true` 가 «정확히 true» 일 때만이고, `--dry-run` 은 설정과 상관없이 이긴다. 시험 모드는 장비에 **한 번도** 연결하지 않는다.
- 포털 데이터베이스에는 `signboard/state` **한 곳만** 쓴다(firebase CLI 쓰기는 관리자 권한이라 보안 규칙을 건너뛴다). 읽기는 `signboard/published`·`signboard/control`.
- 장비 정보(`getDeviceProperty`)에는 **장비 와이파이 비밀번호**가 들어 있다 — 필요한 칸(`PROP_KEEP`)만 골라 돌려주고 나머지는 `device.js` 안에서 버린다.
- 장비에 보내는 길은 `device.js` 하나. 사진·동영상은 우리 창고(`isMediaUrl`) 주소만 내려받고, 기록된 크기와 같아야 한다.
- 광고가 0건인 판은 보내지 않는다. 첫 `replace` 는 `signboard/control.firstReplaceConfirmed` 가 켜진 뒤에만(장비에 이미 있는 광고가 지워진다).
- 같은 판은 3번까지만 다시 해 본다. 상태 쓰기는 `put()` 한 길로(쓸 때마다 «마지막 기록 시각»을 갱신 — 5분 심장박동이 그것을 본다).
- `scripts/` 는 배포본에서 지워지는 폴더다(새 폴더를 만들지 않는다). `.ps1` 은 **ASCII 만** — 윈도 PowerShell 5.1 이 BOM 없는 파일을 ANSI 로 읽는다.
- 검사에는 «지금 값»이 아니라 «규칙»을 못 박는다. 값 자체가 규칙인 곳(HMAC 표준 시험 벡터·灰度 키 이름)은 같은 줄에 `검사고정-허용` + 이유.
- 한국어 주석·메시지. 실제 사람 이름·전화번호·드라이브 경로(`C:\…`·`/home/…`)를 검사 파일에 박지 않는다(`tests-no-local-path` 가 막는다).
- 커밋은 «경로 지정»: `git add <파일들>` → `git commit -m "…" -- <파일들>` → `git show --stat HEAD`. 커밋 메시지 끝에는 이 세션의 공동 저자 줄을 붙인다.
- 푸시·PR 은 Task 8(사람이 보는 방). 실전 연결(런북)은 대표 준비물이 온 뒤 사람과 함께.

## Review Focus

1. **장비가 «HTTP 200 + 본문 ok» 인데 안쪽 `data[].message` 가 실패** — 프로그램이 거절된 것이다. 성공으로 치면 전광판은 그대로인데 포털은 «정상»이라 한다. (Task 3 `처리 실패` 시험)
2. **장비 정보에 섞인 와이파이 비밀번호·SSID** — 로그·DB·화면에 나갈 길이 없어야 한다. (Task 3·6)
3. **사진 주소 만료·삭제(HTTP 403/404), 크기 불일치** — 장비의 기존 광고를 건드리지 않고 «실패»로 알리며 3번 뒤 멈춘다. (Task 5)
4. **같은 판을 매분 다시 보내거나 상태를 매분 쓰는 폭주** — 한 번만 보내고 5분마다만 기록한다. (Task 5)
5. **firebase CLI 로그인이 풀려 포털을 못 읽음** — 죽지 않고 오류로 알리며, 기록도 못 쓰면 로그에만 남는다(포털은 «마지막 응답 N분 전» 으로 알아챈다). (Task 5)

## 파일 구조

| 파일 | 책임 | |
|---|---|---|
| `scripts/signboard-agent/sign.js` | HMAC-MD5 서명(규칙1 일반·규칙2 파일) · 날짜 머리글 두 모양 · 요청 머리글 | 새 |
| `scripts/signboard-agent/program.js` | 올린 판 → 灰度 프로그램 JSON(광고 1건 = 프로그램 1개, 화면 전체 한 칸, 기간 → `playControl`) | 새 |
| `scripts/signboard-agent/device.js` | 장비 통신: `getDeviceProperty`·`getAllPrograms`·`replace`·`uploadFile` (전송을 갈아 끼울 수 있다) | 새 |
| `scripts/signboard-agent/config.js` | 설정 읽기·검증, `scrub`, 기록(`local.json`) | 새 |
| `scripts/signboard-agent/store.js` | 포털 DB 읽기·`signboard/state` 쓰기(firebase CLI) | 새 |
| `scripts/signboard-agent/clock.js` | 장비 시계·시간대 분석과 경고 글 | 새 |
| `scripts/signboard-agent/run.js` | «한 바퀴»: 새 판이면 받기 → 보내기 → 기록. 시험 모드·첫 전송 확인·0건·재시도 | 새 |
| `scripts/signboard-agent/main.js` | 실행(`--once`·`--dry-run`·`--home`), 로그, 반복 | 새 |
| `scripts/signboard-agent/{config.example.json,install-task.ps1,README.md}` | 샘플 설정 · 로그온 자동 시작 등록 · 안내문 | 새 |
| `tests/signboard-{sign,program,device,agent-parts,agent,agent-hygiene}.test.js` | 위 각 부분의 규칙 검사 | 새 |

## 작업 환경

포털 계획서와 같다 — 작업폴더 `C:\Users\fair0\Documents\pu-wt-signboard`(가지 `feat/signboard`), 도구 폴더 `C:\Users\fair0\AppData\Local\Temp\signboard-tools`(저장소 밖), 여러 줄 파일은 **Write 도구**(Bash `cat <<'EOF'` 는 역슬래시를 먹는다), 전체 검사는 `node --test --test-concurrency=4 "tests/*.test.js"`.

---

### Task 1: 서명 (`sign.js`)

**Files:**
- Create: `scripts/signboard-agent/sign.js`
- Test: `tests/signboard-sign.test.js`

**Interfaces:**
- Consumes: 없음(`node:crypto`).
- Produces: `hmacMd5Hex(data, secret)→hex` · `signGeneral(body, sdkKey, date, secret)` · `signFile(sdkKey, date, secret)` · `formatDate(ms, 'rfc1123'|'java')→string` · `buildHeaders({requestId, sdkKey, sdkSecret, body?, file?, now, dateStyle})→{requestId, sdkKey, date, sign}`.

- [ ] **Step 1: 시험을 먼저 쓴다**

```js
/* 전광판 심부름꾼 — 서명(HMAC-MD5) (2026-10-12)
   값 자체가 규칙이다: 아래 시험 값은 HMAC-MD5 표준(RFC 2202)의 공개 시험 벡터라 박는 게 맞다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../scripts/signboard-agent/sign.js');

test('HMAC-MD5 가 표준 시험 벡터와 같다', () => {
  /* 검사고정-허용: RFC 2202 시험 벡터 — 값 자체가 규칙이다 */
  assert.equal(S.hmacMd5Hex('what do ya want for nothing?', 'Jefe'), '750c783e6ab0b503eaa86e310a5db738');
  assert.equal(S.hmacMd5Hex('Hi There', Buffer.alloc(16, 0x0b).toString('latin1')), '9294727a3638bb1c13f48ef8158bfc9d');
});

test('규칙1 은 본문+키+날짜를, 규칙2 는 키+날짜만 서명한다', () => {
  const body = '{"method":"getAll"}', key = 'K', date = 'D', secret = 'S';
  assert.equal(S.signGeneral(body, key, date, secret), S.hmacMd5Hex(body + key + date, secret));
  assert.equal(S.signFile(key, date, secret), S.hmacMd5Hex(key + date, secret));
  assert.notEqual(S.signGeneral(body, key, date, secret), S.signFile(key, date, secret));
});

test('날짜 머리글 두 가지 모양', () => {
  const ms = Date.UTC(2023, 7, 9, 7, 27, 44);
  assert.equal(S.formatDate(ms, 'rfc1123'), 'Wed, 09 Aug 2023 07:27:44 GMT');
  assert.equal(S.formatDate(ms, 'java'), 'Wed Aug 09 07:27:44 GMT 2023');
});

test('머리글 — 서명이 «실제로 보낸 날짜 글자»로 계산되고, 비밀은 어디에도 없다', () => {
  const h = S.buildHeaders({ requestId: 'r1', sdkKey: 'KEY', sdkSecret: 'SECRET-VALUE', body: '{"a":1}', now: Date.UTC(2026, 9, 12), dateStyle: 'rfc1123' });
  assert.equal(h.sign, S.signGeneral('{"a":1}', 'KEY', h.date, 'SECRET-VALUE'));
  assert.equal(JSON.stringify(h).includes('SECRET-VALUE'), false);
  const f = S.buildHeaders({ requestId: 'r2', sdkKey: 'KEY', sdkSecret: 'SECRET-VALUE', file: true, now: Date.UTC(2026, 9, 12) });
  assert.equal(f.sign, S.signFile('KEY', f.date, 'SECRET-VALUE'));
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `cd /c/Users/fair0/Documents/pu-wt-signboard && node --test tests/signboard-sign.test.js`
Expected: FAIL — `Cannot find module '../scripts/signboard-agent/sign.js'`

- [ ] **Step 3: 구현한다**

```js
'use strict';
/* sign.js — 灰度 공식 통로의 서명 (설계서 §7)
   규칙1(일반)  sign = HMACMD5(body + sdkKey + date, sdkSecret)
   규칙2(파일)  sign = HMACMD5(sdkKey + date, sdkSecret)
   ⚠ sdkSecret 은 서명에만 쓰고 어디에도 보내거나 찍지 않는다. */
const crypto = require('node:crypto');

function hmacMd5Hex(data, secret) {
  return crypto.createHmac('md5', String(secret)).update(String(data), 'utf8').digest('hex');
}
function signGeneral(body, sdkKey, date, secret) { return hmacMd5Hex(body + sdkKey + date, secret); }
function signFile(sdkKey, date, secret) { return hmacMd5Hex(sdkKey + date, secret); }

/* date 머리글 모양 — 공식 문서 예시는 RFC 1123("Wed, 09 Aug 2023 07:27:44 GMT"),
   공식 파이썬 SDK 는 자바식("Wed Aug 09 07:27:44 GMT 2023")이다. 장비가 어느 쪽을 받는지는 실제 장비로 확인한다(설계서 §7 [확인 필요]).
   서명은 «보낸 그 글자»로 계산하므로 어느 쪽이든 서명은 맞는다. */
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function formatDate(ms, style) {
  if (style === 'java') {
    const d = new Date(ms), p = (n) => String(n).padStart(2, '0');
    return DAYS[d.getUTCDay()] + ' ' + MONTHS[d.getUTCMonth()] + ' ' + p(d.getUTCDate()) + ' ' + p(d.getUTCHours()) + ':' + p(d.getUTCMinutes()) + ':' + p(d.getUTCSeconds()) + ' GMT ' + d.getUTCFullYear();
  }
  return new Date(ms).toUTCString();
}

/* 요청 머리글을 만든다. body 가 문자열이면 규칙1, file:true 면 규칙2 */
function buildHeaders(o) {
  const date = formatDate(o.now, o.dateStyle);
  const h = { requestId: o.requestId, sdkKey: o.sdkKey, date: date };
  h.sign = o.file ? signFile(o.sdkKey, date, o.sdkSecret) : signGeneral(o.body == null ? '' : o.body, o.sdkKey, date, o.sdkSecret);
  return h;
}

module.exports = { hmacMd5Hex, signGeneral, signFile, formatDate, buildHeaders };
```

- [ ] **Step 4: 통과를 확인한다**

Run: `node --test tests/signboard-sign.test.js`
Expected: PASS — `ℹ pass 4`

- [ ] **Step 5: 커밋**

```bash
git add scripts/signboard-agent/sign.js tests/signboard-sign.test.js
git commit -m "feat(전광판 심부름꾼): 灰度 서명 — HMAC-MD5 규칙1·2, 표준 시험 벡터" -- scripts/signboard-agent/sign.js tests/signboard-sign.test.js
git show --stat HEAD | tail -4
```

---

### Task 2: 프로그램 만들기 (`program.js`)

**Files:**
- Create: `scripts/signboard-agent/program.js`
- Test: `tests/signboard-program.test.js`

**Interfaces:**
- Consumes: `js/pu-signboard-core.js`(`snapshotAd`·`normalizePeriod`·`toArr`).
- Produces: `PLACEHOLDER_SCREEN`(`{width:128,height:64,assumed:true}`) · `OPEN_START`/`OPEN_END` · `toPlayControl(period)→{week?,date?,time?}|null` · `adToProgram(snapshot, screen, uploaded)→program` · `buildReplaceBody(publishedAds, screen|null, deviceId, uploaded)→{method:'replace', data, id}` · `mediaNeeds(publishedAds)→[{adId, kind, url, size, name}]`. `uploaded` 는 `{광고ID:{file, md5, size}}`.

- [ ] **Step 1: 시험을 먼저 쓴다**

```js
/* 전광판 심부름꾼 — 광고 → 灰度 프로그램 JSON (2026-10-12)
   장비가 받는 키 이름·효과 번호·요일 철자는 «값 자체가 규칙»(灰度 공식 문서 3.2)이라 박는 것이 맞다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/pu-signboard-core.js');
const P = require('../scripts/signboard-agent/program.js');

const URL_OK = 'https://firebasestorage.googleapis.com/v0/b/x/o/signboard%2Fa.mp4?alt=media&token=t';
const SCREEN = { width: 192, height: 96 };
function text(over) { const a = C.newAd('text', { id: 'ad_t', order: 1 }); a.title = '상담'; a.text.string = '무료상담'; return Object.assign(a, over || {}); }
function media(kind, id) { const a = C.newAd(kind, { id: id, order: 2 }); a.title = '파일'; a.media = Object.assign(a.media, { url: URL_OK, size: 999, name: 'a.' + kind }); return a; }

test('글자 광고 — 화면 전체 한 칸, 효과·글꼴이 들어간다', () => {
  const a = text(); a.text.holdSec = 7; a.text.effectType = 1; a.text.color = '#ff0000'; a.text.bold = true; a.text.size = 32;
  const prog = P.adToProgram(C.snapshotAd(a), SCREEN, {});
  assert.equal(prog.uuid, 'ad_t'); assert.equal(prog.name, '상담'); assert.equal(prog.type, 'normal');
  const area = prog.area[0];
  assert.deepEqual([area.x, area.y, area.width, area.height], [0, 0, 192, 96]);
  const it = area.item[0];
  assert.equal(it.type, 'text'); assert.equal(it.string, '무료상담');
  assert.deepEqual(it.font, { size: 32, bold: true, color: '#ff0000' });
  assert.deepEqual(it.effect, { type: 1, speed: 5, hold: 7000 }, '머무는 시간은 초 → 밀리초');
  assert.equal(prog.playControl, undefined, '기간이 없으면 playControl 이 없다(늘)');
});

test('줄바꿈이 있는 문구는 multiLine 이다', () => {
  const a = text(); a.text.string = '첫 줄\n둘째 줄';
  assert.equal(P.adToProgram(C.snapshotAd(a), SCREEN, {}).area[0].item[0].multiLine, true);
});

test('사진·동영상 — 장비에 올린 파일 정보를 쓴다', () => {
  const up = { ad_i: { file: 'R-C.png', md5: 'a'.repeat(32), size: 21186 }, ad_v: { file: 'm.mp4', md5: 'b'.repeat(32), size: 777 } };
  const i = P.adToProgram(C.snapshotAd(media('image', 'ad_i')), SCREEN, up).area[0].item[0];
  assert.deepEqual([i.type, i.file, i.fileMd5, i.fileSize, i.fit], ['image', 'R-C.png', 'a'.repeat(32), 21186, 'fill']);
  assert.equal(i.effect.hold, 5000);
  const v = P.adToProgram(C.snapshotAd(media('video', 'ad_v')), SCREEN, up).area[0].item[0];
  assert.deepEqual([v.type, v.file, v.fileSize, v.aspectRatio], ['video', 'm.mp4', 777, true]);
});

test('올린 파일 정보가 없으면 «보내지 않고» 오류 — 빈 칸으로 보내지 않는다', () => {
  assert.throws(() => P.adToProgram(C.snapshotAd(media('image', 'ad_i')), SCREEN, {}), /파일 정보가 없습니다/);
});

test('기간 → playControl: 날짜·요일·시간대', () => {
  const a = text(); a.period = { start: '2026-10-13', end: '2026-10-20', weekdays: ['Mon', 'Thur'], times: [{ start: '09:00', end: '18:00' }, { start: '19:00', end: '21:30' }] };
  const pc = P.adToProgram(C.snapshotAd(a), SCREEN, {}).playControl;
  assert.deepEqual(pc.date, [{ start: '2026-10-13', end: '2026-10-20' }]);
  assert.deepEqual(pc.week, { enable: 'Mon,Thur' });
  assert.deepEqual(pc.time, [{ start: '09:00:00', end: '18:00:00' }, { start: '19:00:00', end: '21:30:00' }]);
});

test('요일을 7개 다 골랐으면 요일 제한을 걸지 않는다', () => {
  const a = text(); a.period = { start: '', end: '', weekdays: C.WEEKDAYS.slice(), times: [] };
  assert.equal(P.adToProgram(C.snapshotAd(a), SCREEN, {}).playControl, undefined);
});

test('한쪽만 적은 기간은 먼 날짜로 닫는다', () => {
  const a = text(); a.period = { start: '2026-11-01', end: '', weekdays: [], times: [] };
  assert.deepEqual(P.toPlayControl(a.period).date, [{ start: '2026-11-01', end: P.OPEN_END }]);
  const b = text(); b.period = { start: '', end: '2026-11-30', weekdays: [], times: [] };
  assert.deepEqual(P.toPlayControl(b.period).date, [{ start: P.OPEN_START, end: '2026-11-30' }]);
});

test('전체 교체 본문 — 순서가 그대로이고 장비 번호가 들어간다', () => {
  const ads = C.publishableAds([text({ id: 'ad_b', order: 2 }), text({ id: 'ad_a', order: 1 })]);
  const body = P.buildReplaceBody(ads, SCREEN, 'C16L-D00-A000F', {});
  assert.equal(body.method, 'replace'); assert.equal(body.id, 'C16L-D00-A000F');
  assert.deepEqual(body.data.map((p) => p.uuid), ['ad_a', 'ad_b']);
});

test('화면 크기를 모르면 자리표시 값을 쓰고, 그 사실을 밝힌다', () => {
  assert.equal(P.PLACEHOLDER_SCREEN.assumed, true);
  const body = P.buildReplaceBody(C.publishableAds([text()]), null, 'X', {});
  assert.equal(body.data[0].area[0].width, P.PLACEHOLDER_SCREEN.width);
});

test('mediaNeeds — 올려야 할 파일만 모은다', () => {
  const ads = C.publishableAds([text(), media('image', 'ad_i'), media('video', 'ad_v')]);
  const n = P.mediaNeeds(ads);
  assert.deepEqual(n.map((x) => x.adId).sort(), ['ad_i', 'ad_v']);
  assert.equal(n[0].url, URL_OK);
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `node --test tests/signboard-program.test.js`
Expected: FAIL — `Cannot find module '../scripts/signboard-agent/program.js'`

- [ ] **Step 3: 구현한다**

```js
'use strict';
/* program.js — «올린 판»의 광고들 → 灰度 장비의 프로그램 JSON (설계서 §7)
   광고 1건 = 프로그램 1개. 자리(area)는 화면 전체 한 칸. 순서 = 배열 순서.
   ⚠ 순수 함수 — 파일·네트워크 없음. 사진·동영상은 «장비에 올린 뒤 받은 파일 정보(uploaded)»를 받아 쓴다. */
const Core = require('../../js/pu-signboard-core.js');

/* 灰度 공식 문서 예시 값 — 장비를 읽기 전(시험 모드)의 «자리표시»일 뿐, 확정값이 아니다(assumed:true) */
const PLACEHOLDER_SCREEN = { width: 128, height: 64, assumed: true };
/* 한쪽만 적은 기간은 «먼 날짜»로 닫는다 — 공식 문서에 열린 범위 표기가 없다(설계서 §7 [확인 필요]) */
const OPEN_START = '2000-01-01';
const OPEN_END = '2099-12-31';

function toPlayControl(period) {
  const p = Core.normalizePeriod(period), pc = {};
  if (p.weekdays.length && p.weekdays.length < 7) pc.week = { enable: p.weekdays.join(',') };
  if (p.start || p.end) pc.date = [{ start: p.start || OPEN_START, end: p.end || OPEN_END }];
  if (p.times.length) pc.time = p.times.map(function (t) { return { start: t.start + ':00', end: t.end + ':00' }; });
  return Object.keys(pc).length ? pc : null;
}

function effectOf(type, speed, holdSec) { return { type: type, speed: speed, hold: Math.round(holdSec * 1000) }; }

function textItem(ad) {
  const t = ad.text;
  return { type: 'text', string: t.string, multiLine: /\n/.test(t.string), alignment: 'center', valignment: 'middle',
    font: { size: t.size, bold: t.bold, color: t.color }, effect: effectOf(t.effectType, t.effectSpeed, t.holdSec) };
}
function imageItem(ad, up) {
  const m = ad.media;
  return { type: 'image', file: up.file, fileMd5: up.md5, fileSize: up.size, fit: m.fit, effect: effectOf(m.effectType, m.effectSpeed, m.holdSec) };
}
function videoItem(ad, up) {
  return { type: 'video', aspectRatio: true, file: up.file, fileMd5: up.md5, fileSize: up.size };
}

/* 장비에 올려야 하는 파일 목록 */
function mediaNeeds(publishedAds) {
  return Core.toArr(publishedAds).map(Core.snapshotAd).filter(function (a) { return a.kind === 'image' || a.kind === 'video'; })
    .map(function (a) { return { adId: a.id, kind: a.kind, url: a.media.url, size: a.media.size, name: a.media.name || a.id }; });
}

function adToProgram(snap, screen, uploaded) {
  const ad = Core.snapshotAd(snap);
  let item;
  if (ad.kind === 'text') item = textItem(ad);
  else if (ad.kind === 'image' || ad.kind === 'video') {
    const up = uploaded && uploaded[ad.id];
    if (!up || !up.file) throw new Error('장비에 올린 파일 정보가 없습니다: ' + ad.id);
    item = ad.kind === 'image' ? imageItem(ad, up) : videoItem(ad, up);
  } else throw new Error('알 수 없는 광고 종류: ' + ad.kind);
  const program = { name: ad.title, type: 'normal', uuid: ad.id,
    area: [{ x: 0, y: 0, width: screen.width, height: screen.height, item: [item] }] };
  const pc = toPlayControl(ad.period);
  if (pc) program.playControl = pc;
  return program;
}

/* 장비 전체 교체 요청 본문 — «올린 판 = 전광판에 있어야 할 전부» */
function buildReplaceBody(publishedAds, screen, deviceId, uploaded) {
  const s = screen || PLACEHOLDER_SCREEN;
  return { method: 'replace', data: Core.toArr(publishedAds).map(function (a) { return adToProgram(a, s, uploaded); }), id: deviceId };
}

module.exports = { PLACEHOLDER_SCREEN, OPEN_START, OPEN_END, toPlayControl, adToProgram, buildReplaceBody, mediaNeeds };
```

- [ ] **Step 4: 통과를 확인한다**

Run: `node --test tests/signboard-program.test.js`
Expected: PASS — `ℹ pass 10`

- [ ] **Step 5: 커밋**

```bash
git add scripts/signboard-agent/program.js tests/signboard-program.test.js
git commit -m "feat(전광판 심부름꾼): 올린 판 → 灰度 프로그램 JSON (광고 1건 = 프로그램 1개, 기간 → playControl)" -- scripts/signboard-agent/program.js tests/signboard-program.test.js
git show --stat HEAD | tail -4
```

---

### Task 3: 장비 통신 (`device.js`)

**Files:**
- Create: `scripts/signboard-agent/device.js`
- Test: `tests/signboard-device.test.js` — **진짜 HTTP 를 내 PC 안의 «가짜 장비»와 주고받는다.** 가짜 장비가 서명을 «다시 계산해» 맞는지 본다. (실제 灰度 장비 앞의 최종 확인은 런북에서만 된다.)

**Interfaces:**
- Consumes: `sign.js`(`buildHeaders`).
- Produces: `createDevice({host, deviceId, sdkKey, sdkSecret, dateStyle?, transport?, now?, uuid?})→{getDeviceProperty(), getAllPrograms(), replace(body), uploadFile(buf, name)}` · `safeFileName(name)` · `PROP_KEEP`. `getDeviceProperty()` 는 `PROP_KEEP` 칸만 담은 객체, `uploadFile` 은 `{file, md5, size}`.

- [ ] **Step 1: 시험을 먼저 쓴다**

```js
/* 전광판 심부름꾼 — 장비 통신 (2026-10-12)
   진짜 HTTP 를 «내 PC 안의 가짜 장비»와 주고받는다 — 서명을 가짜 장비가 «다시 계산해» 맞는지 본다.
   (실제 灰度 장비 앞에서의 최종 확인은 설계서 §7 [확인 필요] — 이 검사가 대신하지 못한다.) */
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const S = require('../scripts/signboard-agent/sign.js');
const D = require('../scripts/signboard-agent/device.js');

const KEY = 'KEY-1', SECRET = 'SECRET-1', DEV = 'C16L-D00-A000F';

function fakeDevice() {
  const seen = [];
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks);
      const h = req.headers;
      const isFile = req.url.startsWith('/api/file/');
      const want = isFile ? S.signFile(h.sdkkey, h.date, SECRET) : S.signGeneral(raw.toString('utf8'), h.sdkkey, h.date, SECRET);
      const ok = h.sdkkey === KEY && h.sign === want;
      seen.push({ url: req.url, ok, body: isFile ? null : JSON.parse(raw.toString('utf8') || 'null'), fileBytes: isFile ? raw : null });
      if (!ok) { res.writeHead(401); res.end('{"message":"sign error"}'); return; }
      res.setHeader('Content-Type', 'application/json');
      if (isFile) {
        /* 진짜 장비처럼 «파일 몸통만»의 크기를 돌려준다(multipart 머리·꼬리 제외) */
        const txt = raw.toString('latin1'), start = txt.indexOf('\r\n\r\n') + 4, end = txt.lastIndexOf('\r\n--');
        res.end(JSON.stringify({ message: 'ok', data: [{ message: 'ok', name: 'up.png', md5: 'c'.repeat(32), size: String(end - start) }] })); return;
      }
      const b = JSON.parse(raw.toString('utf8'));
      if (b.method === 'getDeviceProperty') res.end(JSON.stringify({ method: b.method, message: 'ok', data: [{ id: DEV, message: 'ok', data: { name: 'BoxPlayer', 'screen.width': '192', 'screen.height': '96', time: '2026-10-12 12:00:00', 'time.timeZone': 'Asia/Seoul;UTC+09:00;Seoul', 'wifi.ap.passwd': 'hd12345678', 'wifi.ap.ssid': 'MY-SSID', luminance: '80' } }] }));
      else if (b.method === 'getAll') res.end(JSON.stringify({ message: 'ok', data: [{ id: DEV, message: 'ok', data: { item: [{ uuid: 'U1', name: '옛 광고' }] } }] }));
      else if (b.method === 'replace') res.end(JSON.stringify({ method: 'replace', message: 'ok', data: [{ id: DEV, message: 'ok', data: 'kSuccess' }] }));
      else res.end(JSON.stringify({ message: 'unknown method' }));
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, seen, host: '127.0.0.1:' + server.address().port })));
}

test('가짜 장비가 서명을 «다시 계산해» 받아 준다 — 일반·파일 두 규칙', async () => {
  const f = await fakeDevice();
  try {
    const dev = D.createDevice({ host: f.host, deviceId: DEV, sdkKey: KEY, sdkSecret: SECRET });
    await dev.getAllPrograms();
    await dev.uploadFile(Buffer.from('PNGDATA'), '광고 1.png');
    assert.equal(f.seen.length, 2);
    assert.ok(f.seen.every((s) => s.ok), '서명이 어긋났다');
  } finally { f.server.close(); }
});

test('서명 열쇠가 틀리면 장비가 거절하고, 우리는 오류로 안다', async () => {
  const f = await fakeDevice();
  try {
    const dev = D.createDevice({ host: f.host, deviceId: DEV, sdkKey: KEY, sdkSecret: 'WRONG' });
    await assert.rejects(() => dev.getAllPrograms(), /HTTP 401/);
  } finally { f.server.close(); }
});

test('장비 정보는 «필요한 칸만» — 와이파이 비밀번호·SSID 는 이 함수에서 버린다', async () => {
  const f = await fakeDevice();
  try {
    const dev = D.createDevice({ host: f.host, deviceId: DEV, sdkKey: KEY, sdkSecret: SECRET });
    const p = await dev.getDeviceProperty();
    assert.equal(p['screen.width'], '192');
    assert.equal(p['time.timeZone'].includes('UTC+09:00'), true);
    const dump = JSON.stringify(p);
    assert.equal(dump.includes('hd12345678'), false);
    assert.equal(dump.includes('MY-SSID'), false);
    assert.equal(Object.keys(p).some((k) => /wifi/.test(k)), false);
  } finally { f.server.close(); }
});

test('기존 프로그램 목록과 전체 교체', async () => {
  const f = await fakeDevice();
  try {
    const dev = D.createDevice({ host: f.host, deviceId: DEV, sdkKey: KEY, sdkSecret: SECRET });
    assert.deepEqual(await dev.getAllPrograms(), [{ uuid: 'U1', name: '옛 광고' }]);
    assert.equal(await dev.replace({ method: 'replace', data: [], id: DEV }), true);
    assert.equal(f.seen[f.seen.length - 1].body.method, 'replace');
  } finally { f.server.close(); }
});

test('파일 올리기 — 장비가 돌려준 이름·크기를 받고, 한글 파일 이름은 안전한 글자로 바꿔 보낸다', async () => {
  const f = await fakeDevice();
  try {
    const dev = D.createDevice({ host: f.host, deviceId: DEV, sdkKey: KEY, sdkSecret: SECRET });
    const r = await dev.uploadFile(Buffer.from('0123456789'), '광고 사진.png');
    assert.equal(r.file, 'up.png'); assert.equal(r.size, 10); assert.equal(r.md5.length, 32);
    const sent = f.seen[0].fileBytes.toString('latin1');
    assert.match(sent, /filename="[A-Za-z0-9._-]+"/);
    assert.match(sent, /0123456789/);
  } finally { f.server.close(); }
});

test('장비가 «처리 실패»를 돌려주면 성공으로 치지 않는다', async () => {
  const transport = async () => ({ status: 200, body: JSON.stringify({ method: 'replace', message: 'ok', data: [{ id: DEV, message: 'fail: bad program', data: 'kError' }] }) });
  const dev = D.createDevice({ host: '1.2.3.4:30080', deviceId: DEV, sdkKey: KEY, sdkSecret: SECRET, transport });
  await assert.rejects(() => dev.replace({ method: 'replace', data: [], id: DEV }), /처리 실패/);
});

test('주소·번호가 없으면 만들 때 바로 알린다', () => {
  assert.throws(() => D.createDevice({ host: '', deviceId: DEV }), /deviceHost/);
  assert.throws(() => D.createDevice({ host: 'x', deviceId: '' }), /deviceId/);
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `node --test tests/signboard-device.test.js`
Expected: FAIL — `Cannot find module '../scripts/signboard-agent/device.js'`

- [ ] **Step 3: 구현한다**

```js
'use strict';
/* device.js — 灰度 장비(LAN, 포트 30080)와 «말하는» 곳 (설계서 §3·§7)
   ⚠ 장비 정보(getDeviceProperty)에는 장비 와이파이 비밀번호(wifi.ap.passwd)가 들어 있다.
     그래서 «필요한 칸만 골라» 돌려주고 나머지는 이 함수 안에서 버린다 — 로그·DB·화면에 나갈 길이 없다. */
const http = require('node:http');
const crypto = require('node:crypto');
const { buildHeaders } = require('./sign.js');

/* 밖으로 내보내도 되는 장비 정보 칸(PROP_KEEP) — 비밀번호·SSID 는 넣지 않는다 */
const PROP_KEEP = ['name', 'screen.width', 'screen.height', 'screen.rotation', 'version.hardware', 'version.app', 'time', 'time.timeZone', 'luminance', 'luminance.mode'];

function defaultTransport(req) {
  return new Promise(function (resolve, reject) {
    const u = new URL(req.url);
    const r = http.request({ hostname: u.hostname, port: u.port || 80, path: u.pathname + u.search, method: req.method, headers: req.headers, timeout: req.timeout || 60000 },
      function (res) {
        const chunks = [];
        res.on('data', function (c) { chunks.push(c); });
        res.on('end', function () { resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }); });
      });
    r.on('timeout', function () { r.destroy(new Error('장비 응답 시간 초과')); });
    r.on('error', reject);
    if (req.body) r.write(req.body);
    r.end();
  });
}

function safeFileName(name) { return String(name || 'file').replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80) || 'file'; }

function createDevice(opt) {
  const host = String(opt.host || '').replace(/^https?:\/\//, '').replace(/\/+$/, '');
  if (!host) throw new Error('장비 주소(deviceHost)가 없습니다');
  const id = String(opt.deviceId || '');
  if (!id) throw new Error('장비 번호(deviceId)가 없습니다');
  const base = 'http://' + host;
  const transport = opt.transport || defaultTransport;
  const now = opt.now || Date.now;
  const uuid = opt.uuid || function () { return crypto.randomUUID(); };
  const enc = encodeURIComponent(id);

  function signed(body, file) {
    return buildHeaders({ requestId: uuid(), sdkKey: opt.sdkKey, sdkSecret: opt.sdkSecret, body: body, file: !!file, now: now(), dateStyle: opt.dateStyle });
  }
  function parse(res) {
    if (res.status < 200 || res.status >= 300) throw new Error('장비가 오류를 돌려줬습니다 (HTTP ' + res.status + ')');
    let j;
    try { j = JSON.parse(res.body); } catch (e) { throw new Error('장비 응답을 읽을 수 없습니다'); }
    if (j.message && j.message !== 'ok') throw new Error('장비 응답: ' + j.message);
    return j;
  }
  function rowsOk(j) {
    const rows = Array.isArray(j.data) ? j.data : [];
    rows.forEach(function (r) { if (r && r.message && r.message !== 'ok') throw new Error('장비 처리 실패: ' + r.message); });
    return rows;
  }
  async function postJson(pathname, obj, timeout) {
    const body = JSON.stringify(obj);
    const headers = Object.assign({ 'Content-Type': 'application/json', 'Content-Length': String(Buffer.byteLength(body)) }, signed(body, false));
    return parse(await transport({ method: 'POST', url: base + pathname, headers: headers, body: body, timeout: timeout }));
  }

  return {
    async getDeviceProperty() {
      const rows = rowsOk(await postJson('/api/device/' + enc, { method: 'getDeviceProperty', data: [] }, 20000));
      const d = (rows[0] && rows[0].data) || {}, out = {};
      PROP_KEEP.forEach(function (k) { if (d[k] != null) out[k] = String(d[k]); });
      return out;
    },
    async getAllPrograms() {
      const rows = rowsOk(await postJson('/api/program/' + enc, { method: 'getAll', data: [], id: id }, 20000));
      const items = rows[0] && rows[0].data && rows[0].data.item;
      return (Array.isArray(items) ? items : []).map(function (x) { return { uuid: String(x.uuid || ''), name: String(x.name || '') }; });
    },
    async replace(body) {
      rowsOk(await postJson('/api/program/' + enc, body, 60000));
      return true;
    },
    async uploadFile(buf, name) {
      const boundary = '----pureun' + crypto.randomBytes(8).toString('hex');
      const head = Buffer.from('--' + boundary + '\r\nContent-Disposition: form-data; name="file"; filename="' + safeFileName(name) + '"\r\nContent-Type: application/octet-stream\r\n\r\n');
      const tail = Buffer.from('\r\n--' + boundary + '--\r\n');
      const body = Buffer.concat([head, buf, tail]);
      const headers = Object.assign({ 'Content-Type': 'multipart/form-data; boundary=' + boundary, 'Content-Length': String(body.length) }, signed(null, true));
      const j = parse(await transport({ method: 'POST', url: base + '/api/file/' + enc, headers: headers, body: body, timeout: 300000 }));
      const r = rowsOk(j)[0] || {};
      if (!r.name) throw new Error('장비가 파일 이름을 돌려주지 않았습니다');
      return { file: String(r.name), md5: String(r.md5 || ''), size: Number(r.size) || buf.length };
    }
  };
}

module.exports = { createDevice, safeFileName, PROP_KEEP };
```

- [ ] **Step 4: 통과를 확인한다**

Run: `node --test tests/signboard-device.test.js`
Expected: PASS — `ℹ pass 7`

- [ ] **Step 5: 커밋**

```bash
git add scripts/signboard-agent/device.js tests/signboard-device.test.js
git commit -m "feat(전광판 심부름꾼): 장비 통신 — 서명·파일 올리기·전체 교체, 장비 정보는 필요한 칸만" -- scripts/signboard-agent/device.js tests/signboard-device.test.js
git show --stat HEAD | tail -4
```

---

### Task 4: 설정·포털 읽기쓰기·장비 시계 (`config.js` · `store.js` · `clock.js`)

**Files:**
- Create: `scripts/signboard-agent/config.js`, `scripts/signboard-agent/store.js`, `scripts/signboard-agent/clock.js`
- Test: `tests/signboard-agent-parts.test.js`

**Interfaces:**
- Consumes: 없음(`node:fs`·`node:os`·`node:path`·`node:child_process`).
- Produces: `config.js` — `homeDir(env?)` · `loadConfig(dir)→{config|null, errors[]}` · `scrub(text, config)` · `redactConfig(config)` · `readLocal(dir)` / `writeLocal(dir, local)`(`{lastSentVersion,lastDryVersion,waitingVersion,failures,heartbeatAt}`). `store.js` — `createStore({exec?, project?})→{readVersion(), readPublished(), readControl(), writeState(obj)}` · `cliExec(args)`. `clock.js` — `analyzeClock(props, nowMs)→{known, offsetMin?, tzIsKst?, skewSec?}` · `clockWarning(c)→string`.

- [ ] **Step 1: 시험을 먼저 쓴다**

```js
/* 전광판 심부름꾼 — 설정·저장소 길·장비 시계 (2026-10-12) */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Cfg = require('../scripts/signboard-agent/config.js');
const Store = require('../scripts/signboard-agent/store.js');
const Clock = require('../scripts/signboard-agent/clock.js');

function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'sbcfg-')); }

test('설정 — 파일이 없으면 «이유와 함께» 알린다', () => {
  const r = Cfg.loadConfig(tmp());
  assert.equal(r.config, null);
  assert.match(r.errors[0], /설정 파일/);
});

test('설정 — 시험 모드는 열쇠가 없어도 되고, 실전 모드는 필요한 칸을 모두 요구한다', () => {
  const d = tmp();
  fs.writeFileSync(path.join(d, 'config.json'), JSON.stringify({ liveEnabled: false }));
  assert.deepEqual(Cfg.loadConfig(d).errors, []);
  fs.writeFileSync(path.join(d, 'config.json'), JSON.stringify({ liveEnabled: true, deviceHost: '1.2.3.4:30080' }));
  const e = Cfg.loadConfig(d).errors.join('|');
  ['deviceId', 'sdkKey', 'sdkSecret'].forEach((k) => assert.ok(e.includes(k), k));
});

test('설정 — liveEnabled 는 정확히 true 일 때만 실전이다(글자 "true" 는 아니다)', () => {
  const d = tmp();
  fs.writeFileSync(path.join(d, 'config.json'), JSON.stringify({ liveEnabled: 'true' }));
  assert.equal(Cfg.loadConfig(d).config.liveEnabled, false);
});

test('설정 — 조사 간격은 20~600초 안으로 가둔다', () => {
  const d = tmp();
  fs.writeFileSync(path.join(d, 'config.json'), JSON.stringify({ pollSec: 1 }));
  assert.equal(Cfg.loadConfig(d).config.pollSec, 20);
  fs.writeFileSync(path.join(d, 'config.json'), JSON.stringify({ pollSec: 99999 }));
  assert.equal(Cfg.loadConfig(d).config.pollSec, 600);
});

test('열쇠 값은 글에서 지우고, 설정을 보여 줄 때 가린다', () => {
  const c = { sdkKey: 'KEY-123', sdkSecret: 'SECRET-456' };
  assert.equal(Cfg.scrub('x KEY-123 y SECRET-456', c), 'x *** y ***');
  const r = Cfg.redactConfig(c);
  assert.equal(JSON.stringify(r).includes('SECRET-456'), false);
  assert.equal(JSON.stringify(r).includes('KEY-123'), false);
});

test('저장소 위치 — 환경변수로 바꿀 수 있고, 기본은 AppData 아래', () => {
  const mine = path.join('a', 'b');
  assert.equal(Cfg.homeDir({ PUREUN_SIGNBOARD_HOME: mine }), mine);
  assert.match(Cfg.homeDir({ APPDATA: path.join('x', 'AppData', 'Roaming') }), /pureun-signboard$/);
});

test('기록 파일 — 없으면 기본값, 쓰면 읽힌다', () => {
  const d = tmp();
  assert.equal(Cfg.readLocal(d).lastSentVersion, 0);
  Cfg.writeLocal(d, { lastSentVersion: 4, failures: { 5: 2 } });
  assert.equal(Cfg.readLocal(d).lastSentVersion, 4);
  assert.equal(Cfg.readLocal(d).failures[5], 2);
});

test('저장소 길 — 읽기는 database:get, null 은 null, 쓰기는 signboard/state 한 곳만', () => {
  const calls = [];
  const exec = (args) => {
    calls.push(args);
    if (args[1] === '/signboard/published/version') return '7\n';
    if (args[1] === '/signboard/published') return '{"version":7,"ads":[]}';
    if (args[1] === '/signboard/control') return 'null\n';
    return '';
  };
  const s = Store.createStore({ exec });
  assert.equal(s.readVersion(), 7);
  assert.equal(s.readPublished().version, 7);
  assert.deepEqual(s.readControl(), {});
  s.writeState({ a: 1 });
  const w = calls[calls.length - 1];
  assert.equal(w[0], 'database:update'); assert.equal(w[1], '/signboard/state');
  assert.ok(w.includes('--project') && w.includes('pureun-erp'));
  assert.ok(calls.every((c) => c[0] === 'database:get' || (c[0] === 'database:update' && c[1] === '/signboard/state')), '다른 자리에는 쓰지 않는다');
});

test('저장소 길 — 판이 아직 없으면 null', () => {
  const s = Store.createStore({ exec: () => 'null\n' });
  assert.equal(s.readVersion(), null);
});

test('장비 시계 — 한국 시간이고 맞으면 경고 없음', () => {
  const now = Date.UTC(2026, 9, 12, 3, 0, 0);
  const c = Clock.analyzeClock({ time: '2026-10-12 12:00:30', 'time.timeZone': 'Asia/Seoul;UTC+09:00;Seoul' }, now);
  assert.equal(c.known, true); assert.equal(c.tzIsKst, true); assert.equal(c.skewSec, 30);
  assert.equal(Clock.clockWarning(c), '');
});

test('장비 시계 — 중국 시간이면 «기간 예약이 어긋난다»고 알린다', () => {
  const now = Date.UTC(2026, 9, 12, 3, 0, 0);
  const c = Clock.analyzeClock({ time: '2026-10-12 11:00:00', 'time.timeZone': 'Asia/Shanghai;UTC+08:00;Beijing' }, now);
  assert.equal(c.tzIsKst, false); assert.equal(c.skewSec, 0);
  assert.match(Clock.clockWarning(c), /한국\(UTC\+9\)이 아닙니다/);
});

test('장비 시계 — 2분 넘게 틀리면 알리고, 읽지 못하면 «모름»이라 한다(0 으로 치지 않는다)', () => {
  const now = Date.UTC(2026, 9, 12, 3, 0, 0);
  const c = Clock.analyzeClock({ time: '2026-10-12 12:10:00', 'time.timeZone': 'Asia/Seoul;UTC+09:00;Seoul' }, now);
  assert.match(Clock.clockWarning(c), /10분 어긋/);
  const u = Clock.analyzeClock({}, now);
  assert.equal(u.known, false);
  assert.match(Clock.clockWarning(u), /읽지 못했습니다/);
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `node --test tests/signboard-agent-parts.test.js`
Expected: FAIL — `Cannot find module '../scripts/signboard-agent/config.js'`

- [ ] **Step 3: 구현한다 — 세 파일**

`scripts/signboard-agent/config.js`:

```js
'use strict';
/* config.js — 이 PC 의 심부름꾼 설정·기록 (설계서 §6.2)
   ⚠ 설정 파일은 «저장소 밖» %APPDATA%\pureun-signboard\config.json 이다. 灰度 열쇠(sdkKey·sdkSecret)는 여기에만 있다.
   ⚠ 열쇠는 로그·DB·화면·채팅 어디에도 찍지 않는다 — 찍을 글은 scrub() 을 거친다. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const DEFAULTS = { deviceHost: '', deviceId: '', sdkKey: '', sdkSecret: '', liveEnabled: false, dateStyle: 'rfc1123', project: 'pureun-erp', pollSec: 60 };

function homeDir(env) {
  env = env || process.env;
  if (env.PUREUN_SIGNBOARD_HOME) return env.PUREUN_SIGNBOARD_HOME;
  return path.join(env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'pureun-signboard');
}

function loadConfig(dir) {
  const file = path.join(dir, 'config.json');
  let raw;
  try { raw = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return { config: null, errors: ['설정 파일이 없거나 읽을 수 없습니다: ' + file] }; }
  const c = Object.assign({}, DEFAULTS, raw), errors = [];
  c.liveEnabled = c.liveEnabled === true;
  if (c.liveEnabled) ['deviceHost', 'deviceId', 'sdkKey', 'sdkSecret'].forEach(function (k) { if (!String(c[k] || '').trim()) errors.push('실전 모드(liveEnabled)에는 ' + k + ' 가 필요합니다'); });
  if (c.dateStyle !== 'rfc1123' && c.dateStyle !== 'java') errors.push('dateStyle 은 rfc1123 또는 java 입니다');
  const poll = Number(c.pollSec);
  c.pollSec = isFinite(poll) ? Math.min(600, Math.max(20, Math.round(poll))) : 60;
  return { config: c, errors: errors };
}

/* 로그에 찍을 글에서 열쇠 값을 지운다 */
function scrub(text, config) {
  let s = String(text == null ? '' : text);
  if (!config) return s;
  ['sdkKey', 'sdkSecret'].forEach(function (k) {
    const v = String(config[k] || '');
    if (v.length >= 3) s = s.split(v).join('***');
  });
  return s;
}
/* 화면·로그에 «설정을 보여 줄 때» */
function redactConfig(config) {
  const c = Object.assign({}, config);
  ['sdkKey', 'sdkSecret'].forEach(function (k) { if (c[k]) c[k] = '***'; });
  return c;
}

function readLocal(dir) {
  const base = { lastSentVersion: 0, lastDryVersion: 0, waitingVersion: 0, failures: {}, heartbeatAt: 0 };
  try { return Object.assign(base, JSON.parse(fs.readFileSync(path.join(dir, 'local.json'), 'utf8'))); } catch (e) { return base; }
}
function writeLocal(dir, local) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'local.json'), JSON.stringify(local, null, 2));
}

module.exports = { DEFAULTS, homeDir, loadConfig, scrub, redactConfig, readLocal, writeLocal };
```

`scripts/signboard-agent/store.js`:

```js
'use strict';
/* store.js — 포털 데이터베이스(signboard/…)를 이 PC 의 firebase CLI 로 읽고 쓴다 (설계서 §6.4)
   선례: scripts/thebill-pull.js — 이 PC 에 로그인된 CLI 를 쓴다. 서비스 계정 키는 만들지 않는다.
   ⚠ CLI 쓰기는 관리자 권한이라 보안 규칙을 건너뛴다. 그래서 심부름꾼은 signboard/state «하나만» 쓴다. */
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

/* 진짜 CLI 호출. 윈도에서 firebase 는 .cmd 라 shell:true 가 필요하고, MSYS_NO_PATHCONV 는 «/signboard» 가 경로로 바뀌는 것을 막는다 */
function cliExec(args) {
  return execFileSync('firebase', args, { encoding: 'utf8', shell: true, timeout: 90000, stdio: ['ignore', 'pipe', 'pipe'],
    env: Object.assign({}, process.env, { MSYS_NO_PATHCONV: '1' }) });
}

function createStore(o) {
  o = o || {};
  const exec = o.exec || cliExec;
  const proj = ['--project', o.project || 'pureun-erp'];
  function getJson(p) {
    const out = String(exec(['database:get', p].concat(proj)) || '').trim();
    if (!out || out === 'null') return null;
    return JSON.parse(out);
  }
  return {
    readVersion() { const v = getJson('/signboard/published/version'); return v == null ? null : Number(v); },
    readPublished() { return getJson('/signboard/published'); },
    readControl() { return getJson('/signboard/control') || {}; },
    /* state 한 곳만 «고쳐 쓴다»(update). 안 적은 칸은 그대로다 */
    writeState(obj) {
      const f = path.join(os.tmpdir(), 'signboard-state-' + process.pid + '.json');
      fs.writeFileSync(f, JSON.stringify(obj));
      try { exec(['database:update', '/signboard/state', '"' + f + '"', '--force'].concat(proj)); }
      finally { try { fs.unlinkSync(f); } catch (e) { /* 임시 파일 */ } }
    }
  };
}

module.exports = { createStore, cliExec };
```

`scripts/signboard-agent/clock.js`:

```js
'use strict';
/* clock.js — 장비 시계가 한국 시간·실제 시각과 맞는가 (설계서 §7)
   기간 예약(날짜·시간대)은 «장비 시계»로 지켜진다. 중국 시간(UTC+8)으로 맞춰 있으면 1시간 어긋난다 — 알리기만 한다. */
function analyzeClock(props, nowMs) {
  props = props || {};
  const tz = /UTC([+-])(\d{2}):(\d{2})/.exec(String(props['time.timeZone'] || ''));
  const t = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(String(props.time || ''));
  if (!tz || !t) return { known: false };
  const offsetMin = (tz[1] === '-' ? -1 : 1) * (Number(tz[2]) * 60 + Number(tz[3]));
  const deviceUtc = Date.UTC(+t[1], +t[2] - 1, +t[3], +t[4], +t[5], +t[6]) - offsetMin * 60000;
  return { known: true, offsetMin: offsetMin, tzIsKst: offsetMin === 540, skewSec: Math.round((deviceUtc - nowMs) / 1000) };
}
/* 화면에 띄울 경고 글(없으면 빈 문자열) */
function clockWarning(c) {
  if (!c || !c.known) return '장비 시계를 읽지 못했습니다';
  const w = [];
  if (!c.tzIsKst) w.push('장비 시간대가 한국(UTC+9)이 아닙니다 — 기간 예약이 어긋납니다');
  if (Math.abs(c.skewSec) > 120) w.push('장비 시계가 실제와 ' + Math.round(Math.abs(c.skewSec) / 60) + '분 어긋나 있습니다');
  return w.join(' / ');
}
module.exports = { analyzeClock, clockWarning };
```

- [ ] **Step 4: 통과를 확인한다**

Run: `node --test tests/signboard-agent-parts.test.js`
Expected: PASS — `ℹ pass 12`

- [ ] **Step 5: 커밋**

```bash
git add scripts/signboard-agent/config.js scripts/signboard-agent/store.js scripts/signboard-agent/clock.js tests/signboard-agent-parts.test.js
git commit -m "feat(전광판 심부름꾼): 설정·포털 읽기쓰기(CLI, state 한 곳만)·장비 시계 분석" -- scripts/signboard-agent/config.js scripts/signboard-agent/store.js scripts/signboard-agent/clock.js tests/signboard-agent-parts.test.js
git show --stat HEAD | tail -6
```

---

### Task 5: 한 바퀴 (`run.js`) — 새 판 받기 → 보내기 → 기록

**Files:**
- Create: `scripts/signboard-agent/run.js`
- Test: `tests/signboard-agent.test.js` — 가짜 장비·가짜 DB·가짜 내려받기로 한 바퀴를 돌린다. 가짜가 **현실의 불편한 동작**을 한다(장비 꺼짐·파일이 잘려 옴·비밀이 오류 글에 섞임·CLI 로그인 풀림).

**Interfaces:**
- Consumes: Task 1~4 의 모듈 + `js/pu-signboard-core.js`. `ctx` = `{store, local, dir, dryRun, config, now(), log(), makeDevice(), download(url)}`.
- Produces: `runRound(ctx)→{action, …}`(`action`: `no-published`·`idle`·`gave-up`·`waiting`·`skip-empty`·`dry-run`·`wait-confirm`·`sent`·`error`) · `runOnce(ctx)` · `MAX_ATTEMPTS`(3) · `HEARTBEAT_MS`(5분) · `md5hex(buf)` · `deviceInfo(props)`. 시험 모드는 `outbox/v판번호.json` 에 보낼 JSON 을 적는다.

- [ ] **Step 1: 시험을 먼저 쓴다**

```js
/* 전광판 심부름꾼 — 한 바퀴(run.js)를 «가짜 장비·가짜 DB·가짜 내려받기»로 돌려 본다 (2026-10-12)
   ★ 가짜가 «현실의 불편한 동작»을 한다: 장비가 응답이 없고, 파일이 잘려 오고, 비밀이 오류 글에 섞인다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const C = require('../js/pu-signboard-core.js');
const R = require('../scripts/signboard-agent/run.js');

const URL_OK = 'https://firebasestorage.googleapis.com/v0/b/x/o/signboard%2Fa.jpg?alt=media&token=t';
const NOW = Date.UTC(2026, 9, 12, 3, 0, 0);

function ad(id, over) { const a = C.newAd('text', { id, order: 1 }); a.title = id; a.text.string = '문구 ' + id; return Object.assign(a, over || {}); }
function imageAd(id, size) { const a = C.newAd('image', { id, order: 2 }); a.title = id; a.media = Object.assign(a.media, { url: URL_OK, size, name: 'a.jpg' }); return a; }

function make(opt) {
  opt = opt || {};
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sbtest-'));
  const calls = [], states = [];
  const world = { version: opt.version === undefined ? 1 : opt.version, ads: opt.ads || [ad('ad_a')], control: opt.control || {}, clock: NOW };
  const store = {
    readVersion: () => world.version,
    readPublished: () => (world.version == null ? null : { version: world.version, ads: C.publishableAds(world.ads) }),
    readControl: () => world.control,
    writeState: (o) => { states.push(o); }
  };
  const device = {
    getDeviceProperty: async () => { calls.push('prop'); if (opt.deviceDown) throw new Error('connect ECONNREFUSED 192.168.0.9:30080'); return { name: 'Box', 'screen.width': '192', 'screen.height': '96', time: '2026-10-12 12:00:00', 'time.timeZone': 'Asia/Seoul;UTC+09:00;Seoul', luminance: '80', 'version.app': '7.10' }; },
    getAllPrograms: async () => { calls.push('getAll'); return [{ uuid: 'U1', name: '옛 광고' }, { uuid: 'U2', name: '옛 광고2' }]; },
    uploadFile: async (buf, name) => { calls.push('upload:' + name); return { file: 'dev_' + name, md5: '', size: buf.length }; },
    replace: async (body) => { calls.push('replace:' + body.data.length); world.lastBody = body; return true; }
  };
  const local = { lastSentVersion: 0, lastDryVersion: 0, waitingVersion: 0, failures: {}, heartbeatAt: 0 };
  let downloads = 0;
  const ctx = {
    store, local, dir, dryRun: !!opt.dryRun, config: { deviceId: 'C16L-D00-A000F', sdkKey: 'KEY-123', sdkSecret: 'SECRET-456' },
    now: () => world.clock, log: () => { },
    makeDevice: () => { if (opt.noDevice) throw new Error('시험 모드에서 장비를 만들었다'); return device; },
    download: async () => { downloads++; return Buffer.alloc(opt.dlSize == null ? 1234 : opt.dlSize, 7); }
  };
  return { ctx, calls, states, world, local, dir, downloads: () => downloads };
}

test('올린 판이 없으면 아무것도 보내지 않고 «판 없음»만 알린다', async () => {
  const m = make({ version: null, noDevice: true, dryRun: true });
  const r = await R.runRound(m.ctx);
  assert.equal(r.action, 'no-published');
  assert.equal(m.calls.length, 0);
});

test('시험 모드 — 장비에 한 번도 연결하지 않고 outbox 에 보낼 내용을 적는다. 같은 판은 다시 하지 않는다', async () => {
  const m = make({ dryRun: true, noDevice: true, ads: [ad('ad_a'), imageAd('ad_i', 1234)] });
  const r = await R.runRound(m.ctx);
  assert.equal(r.action, 'dry-run');
  const body = JSON.parse(fs.readFileSync(r.file, 'utf8'));
  assert.equal(body.method, 'replace'); assert.equal(body.data.length, 2);
  assert.equal(m.states[m.states.length - 1].result, 'dry-run');
  assert.equal(m.states[m.states.length - 1].screenAssumed, true);
  const n = m.downloads();
  m.world.clock += 60000;
  const r2 = await R.runRound(m.ctx);
  assert.equal(r2.action, 'idle');
  assert.equal(m.downloads(), n, '같은 판이면 다시 내려받지 않는다');
});

test('실전 첫 전송 — 대표 확인 전에는 «기존 광고 목록만» 읽고 아무것도 지우지 않는다', async () => {
  const m = make({});
  const r = await R.runRound(m.ctx);
  assert.equal(r.action, 'wait-confirm');
  assert.equal(m.calls.some((c) => c.startsWith('replace') || c.startsWith('upload')), false);
  const st = m.states[m.states.length - 1];
  assert.equal(st.result, 'wait-confirm'); assert.equal(st.existingPrograms.length, 2);
  m.world.clock += 60000;
  const r2 = await R.runRound(m.ctx);
  assert.equal(r2.action, 'waiting', '확인 전에는 장비를 다시 두드리지 않는다');
  assert.equal(m.calls.filter((c) => c === 'getAll').length, 1);
});

test('실전 — 확인이 나면 파일을 올리고 전체 교체를 보내며, 결과와 장비 정보를 기록한다', async () => {
  const m = make({ control: { firstReplaceConfirmed: true }, ads: [ad('ad_a'), imageAd('ad_i', 1234)] });
  const r = await R.runRound(m.ctx);
  assert.equal(r.action, 'sent');
  const order = m.calls.filter((c) => c !== 'prop');
  assert.match(order[0], /^upload:ad_i_1234\.jpg$/, '파일 이름은 안전한 글자');
  assert.equal(order[1], 'replace:2');
  const img = m.world.lastBody.data.find((p) => p.uuid === 'ad_i').area[0].item[0];
  assert.equal(img.file, 'dev_ad_i_1234.jpg', '장비가 돌려준 이름을 쓴다');
  const st = m.states[m.states.length - 1];
  assert.equal(st.result, 'ok'); assert.equal(st.sentVersion, 1); assert.equal(st.device.width, 192); assert.equal(st.clock.tzIsKst, true);
  assert.equal(m.local.lastSentVersion, 1);
  assert.equal(JSON.stringify(st).includes('SECRET-456'), false);
});

test('같은 판은 다시 보내지 않고, 새 판이면 다시 보낸다', async () => {
  const m = make({ control: { firstReplaceConfirmed: true } });
  await R.runRound(m.ctx);
  const sent = () => m.calls.filter((c) => c.startsWith('replace')).length;
  assert.equal(sent(), 1);
  m.world.clock += 10 * 60000;
  assert.equal((await R.runRound(m.ctx)).action, 'idle');
  assert.equal(sent(), 1);
  m.world.version = 2; m.world.ads = [ad('ad_a'), ad('ad_b')];
  assert.equal((await R.runRound(m.ctx)).action, 'sent');
  assert.equal(sent(), 2);
});

test('광고 0건인 판은 보내지 않는다 — 전광판을 통째로 비우지 않는다', async () => {
  const m = make({ control: { firstReplaceConfirmed: true }, ads: [] });
  const r = await R.runRound(m.ctx);
  assert.equal(r.action, 'skip-empty');
  assert.equal(m.calls.some((c) => c.startsWith('replace')), false);
});

test('받은 파일이 기록과 크기가 다르면 전송을 중단한다 — 장비는 건드리지 않는다', async () => {
  const m = make({ control: { firstReplaceConfirmed: true }, ads: [imageAd('ad_i', 1234)], dlSize: 999 });
  const r = await R.runRound(m.ctx);
  assert.equal(r.action, 'error');
  assert.match(r.message, /크기가 기록과 다릅니다/);
  assert.equal(m.calls.length, 0);
  assert.equal(m.states[m.states.length - 1].result, 'fail');
});

test('같은 판은 3번까지만 다시 해 보고 멈춘다 — 새 판이 오면 다시 시작한다', async () => {
  const m = make({ control: { firstReplaceConfirmed: true }, ads: [imageAd('ad_i', 1234)], dlSize: 5 });
  for (let i = 0; i < 3; i++) { assert.equal((await R.runRound(m.ctx)).action, 'error'); }
  const n = m.downloads();
  assert.equal((await R.runRound(m.ctx)).action, 'gave-up');
  assert.equal(m.downloads(), n, '포기한 판은 더 받지 않는다');
  m.world.version = 2; m.world.ads = [ad('ad_ok')];
  assert.equal((await R.runRound(m.ctx)).action, 'sent');
});

test('파일 내려받기가 실패(창고 주소 만료·삭제)해도 장비는 건드리지 않고 «실패»로 알린다', async () => {
  const m = make({ control: { firstReplaceConfirmed: true }, ads: [imageAd('ad_i', 1234)] });
  m.ctx.download = async () => { throw new Error('파일 내려받기 실패 (HTTP 403)'); };
  const r = await R.runRound(m.ctx);
  assert.equal(r.action, 'error'); assert.match(r.message, /HTTP 403/);
  assert.equal(m.calls.some((c) => c.startsWith('replace') || c.startsWith('upload')), false);
  assert.equal(m.states[m.states.length - 1].result, 'fail');
});

test('포털을 못 읽어도(firebase CLI 로그인 풀림) 멈추지 않고 «오류로 알릴 뿐»이다 — 기록도 못 쓰면 로그만', async () => {
  const m = make({ control: { firstReplaceConfirmed: true } });
  const logs = [];
  m.ctx.log = (x) => logs.push(x);
  m.ctx.store.readVersion = () => { throw new Error('Error: Failed to authenticate, have you run firebase login?'); };
  m.ctx.store.writeState = () => { throw new Error('Error: Failed to authenticate, have you run firebase login?'); };
  const r = await R.runRound(m.ctx);
  assert.equal(r.action, 'error');
  assert.equal(m.calls.length, 0, '장비는 건드리지 않는다');
  assert.ok(logs.some((x) => /상태를 기록하지 못했습니다/.test(x)), '기록 실패는 로그에 남는다');
  assert.equal(r.version, null, '판을 알기 전의 오류는 «판별 실패 횟수»에 세지 않는다');
  assert.deepEqual(m.local.failures, {});
});

test('오류 글에서 열쇠 값이 지워진다', async () => {
  const m = make({ control: { firstReplaceConfirmed: true } });
  m.ctx.makeDevice = () => ({ getDeviceProperty: async () => { throw new Error('인증 실패 sdkKey=KEY-123 secret=SECRET-456'); } });
  const r = await R.runRound(m.ctx);
  assert.equal(r.message.includes('KEY-123'), false);
  assert.equal(r.message.includes('SECRET-456'), false);
  assert.equal(JSON.stringify(m.states).includes('SECRET-456'), false);
});

test('허용되지 않은 파일 주소는 내려받지 않는다', async () => {
  const bad = imageAd('ad_i', 1234); bad.media.url = 'https://evil.example/a.jpg';
  const m = make({ control: { firstReplaceConfirmed: true }, ads: [] });
  m.world.version = 1;
  m.ctx.store.readPublished = () => ({ version: 1, ads: [C.snapshotAd(bad)] });
  const r = await R.runRound(m.ctx);
  assert.equal(r.action, 'error'); assert.match(r.message, /허용되지 않은 파일 주소/);
  assert.equal(m.downloads(), 0);
});

test('장비가 꺼져 있어도 «멈춤 없이» 알린다(실전 심장박동)', async () => {
  const m = make({ control: { firstReplaceConfirmed: true }, deviceDown: true });
  m.local.lastSentVersion = 1;
  const r = await R.runRound(m.ctx);
  assert.equal(r.action, 'idle');
  const st = m.states[m.states.length - 1];
  assert.equal(st.deviceReachable, false);
  assert.match(st.deviceError, /ECONNREFUSED/);
});

test('심장박동은 5분에 한 번만 쓴다', async () => {
  const m = make({ dryRun: true, noDevice: true });
  await R.runRound(m.ctx);                      // dry-run 기록 1건
  const n = m.states.length;
  m.world.clock += 60000;  await R.runRound(m.ctx);
  assert.equal(m.states.length, n, '1분 뒤에는 쓰지 않는다');
  m.world.clock += 6 * 60000; await R.runRound(m.ctx);
  assert.equal(m.states.length, n + 1, '5분이 지나면 쓴다');
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `node --test tests/signboard-agent.test.js`
Expected: FAIL — `Cannot find module '../scripts/signboard-agent/run.js'`

- [ ] **Step 3: 구현한다**

```js
'use strict';
/* run.js — 심부름꾼의 «한 바퀴» (설계서 §6.3·§8)
   새 판이 있으면: 파일 받기 → (실전) 장비에 파일 올리기 → 프로그램 전체 교체 → 결과를 signboard/state 에 기록.
   ⚠ 시험 모드(dryRun)는 장비에 «한 번도» 연결하지 않는다 — 보낼 내용만 outbox 에 적는다.
   ⚠ 실전의 첫 전체 교체는 대표가 포털에서 «지워도 된다»를 누른 뒤에만(control.firstReplaceConfirmed) — 장비에 이미 있는 광고가 지워진다.
   ⚠ 광고가 0건인 판은 보내지 않는다 — 전광판을 통째로 비우는 사고를 막는다. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const Core = require('../../js/pu-signboard-core.js');
const Program = require('./program.js');
const { analyzeClock, clockWarning } = require('./clock.js');
const { scrub } = require('./config.js');

const MAX_ATTEMPTS = 3;
const HEARTBEAT_MS = 5 * 60 * 1000;
const MAX_DOWNLOAD = 200 * 1024 * 1024;

function md5hex(buf) { return crypto.createHash('md5').update(buf).digest('hex'); }
function extOf(name) { const m = /\.[A-Za-z0-9]{1,5}$/.exec(String(name || '')); return m ? m[0] : ''; }
function deviceInfo(props) {
  return { name: props.name || '', width: Number(props['screen.width']) || 0, height: Number(props['screen.height']) || 0, time: props.time || '',
    timeZone: props['time.timeZone'] || '', luminance: props.luminance || '', fwVersion: props['version.app'] || '' };
}

/* 상태를 쓰는 «한 길» — 쓸 때마다 마지막 기록 시각을 갱신한다(5분 심장박동이 이것을 본다) */
async function put(ctx, state) {
  await ctx.store.writeState(state);
  ctx.local.heartbeatAt = ctx.now();
}

async function heartbeat(ctx, base, extra) {
  const t = ctx.now();
  if (t - ctx.local.heartbeatAt < HEARTBEAT_MS) return false;
  const st = Object.assign({}, base, extra);
  if (!ctx.dryRun) {
    try {
      const props = await ctx.makeDevice().getDeviceProperty();
      st.deviceReachable = true; st.deviceError = ''; st.device = deviceInfo(props);
      st.clock = analyzeClock(props, t); st.clockWarning = clockWarning(st.clock);
    } catch (e) { st.deviceReachable = false; st.deviceError = scrub(e.message, ctx.config); }
  }
  await put(ctx, st);
  return true;
}

async function runOnce(ctx) {
  const t = ctx.now(), local = ctx.local;
  const base = { agentSeenAt: t, mode: ctx.dryRun ? 'dry-run' : 'live' };
  const version = await ctx.store.readVersion();
  if (version == null) { await heartbeat(ctx, base, { message: '올린 판이 아직 없습니다' }); return { action: 'no-published' }; }
  ctx.stage.version = version;

  const done = ctx.dryRun ? local.lastDryVersion === version : local.lastSentVersion === version;
  if (done) { await heartbeat(ctx, base, {}); return { action: 'idle', version: version }; }
  if ((local.failures[version] || 0) >= MAX_ATTEMPTS) return { action: 'gave-up', version: version };

  /* 첫 전송 확인을 기다리는 중이면 «확인이 났는지»만 본다 — 장비를 매분 두드리지 않는다 */
  if (!ctx.dryRun && local.waitingVersion === version && (await ctx.store.readControl()).firstReplaceConfirmed !== true) {
    await heartbeat(ctx, base, { message: '첫 전송 확인을 기다립니다' });
    return { action: 'waiting', version: version };
  }

  const published = await ctx.store.readPublished();
  const ads = Core.toArr(published && published.ads).map(Core.snapshotAd);
  if (!ads.length) {
    await put(ctx, Object.assign({}, base, { result: 'skip', message: '올린 판(' + version + '번)에 광고가 0건이라 보내지 않았습니다 — 전광판을 비우지 않습니다', sentVersion: local.lastSentVersion || 0 }));
    if (ctx.dryRun) local.lastDryVersion = version; else local.lastSentVersion = version;
    return { action: 'skip-empty', version: version };
  }

  /* 사진·동영상 받기 — 우리 창고 주소만, 기록된 크기와 같아야 한다 */
  const files = {};
  for (const n of Program.mediaNeeds(ads)) {
    if (!Core.isMediaUrl(n.url)) throw new Error('허용되지 않은 파일 주소입니다 (' + n.adId + ')');
    if (!(n.size > 0) || n.size > MAX_DOWNLOAD) throw new Error('파일 크기가 올바르지 않습니다 (' + n.adId + ')');
    const buf = await ctx.download(n.url);
    if (buf.length !== n.size) throw new Error('받은 파일 크기가 기록과 다릅니다 (' + n.adId + ': 기록 ' + n.size + ' · 받음 ' + buf.length + ')');
    files[n.adId] = { buf: buf, md5: md5hex(buf), name: n.adId + '_' + n.size + extOf(n.name) };
  }

  if (ctx.dryRun) {
    const uploaded = {};
    Object.keys(files).forEach(function (id) { uploaded[id] = { file: '(장비에 올린 뒤 받는 이름)', md5: files[id].md5, size: files[id].buf.length }; });
    const body = Program.buildReplaceBody(ads, null, (ctx.config && ctx.config.deviceId) || 'DEVICE-ID', uploaded);
    const out = path.join(ctx.dir, 'outbox');
    fs.mkdirSync(out, { recursive: true });
    const file = path.join(out, 'v' + version + '.json');
    fs.writeFileSync(file, JSON.stringify(body, null, 2));
    local.lastDryVersion = version;
    await put(ctx, Object.assign({}, base, { result: 'dry-run', message: '시험 모드 — 보낼 내용을 outbox/v' + version + '.json 에 적었습니다 (장비에는 연결하지 않았습니다)', dryRunVersion: version, dryRunAt: t, screenAssumed: true }));
    return { action: 'dry-run', version: version, file: file };
  }

  const dev = ctx.makeDevice();
  const props = await dev.getDeviceProperty();
  const screen = { width: Number(props['screen.width']), height: Number(props['screen.height']) };
  if (!(screen.width > 0 && screen.height > 0)) throw new Error('장비 화면 크기를 읽지 못했습니다');
  const info = deviceInfo(props), clock = analyzeClock(props, t), warn = clockWarning(clock);

  if ((await ctx.store.readControl()).firstReplaceConfirmed !== true) {
    const existing = await dev.getAllPrograms();
    local.waitingVersion = version;
    await put(ctx, Object.assign({}, base, { result: 'wait-confirm', pendingVersion: version, existingPrograms: existing, device: info, clock: clock, clockWarning: warn, deviceReachable: true,
      message: '첫 전송 전 확인이 필요합니다 — 장비에 이미 있는 광고 ' + existing.length + '건이 지워집니다' }));
    return { action: 'wait-confirm', version: version, existing: existing };
  }

  const uploaded = {};
  for (const id of Object.keys(files)) {
    const r = await dev.uploadFile(files[id].buf, files[id].name);
    if (r.md5 && r.md5 !== files[id].md5) throw new Error('장비가 받은 파일이 보낸 것과 다릅니다 (' + id + ')');
    uploaded[id] = { file: r.file, md5: files[id].md5, size: r.size };
  }
  await dev.replace(Program.buildReplaceBody(ads, screen, ctx.config.deviceId, uploaded));
  local.lastSentVersion = version; local.waitingVersion = 0; delete local.failures[version];
  await put(ctx, Object.assign({}, base, { result: 'ok', message: '', sentVersion: version, sentAt: t, adCount: ads.length, device: info, clock: clock, clockWarning: warn, deviceReachable: true, deviceError: '', screenAssumed: false }));
  return { action: 'sent', version: version, count: ads.length };
}

/* 오류를 먹지 않는다 — 기록하고(열쇠는 지운 글로), 같은 판은 3번까지만 다시 해 본다 */
async function runRound(ctx) {
  ctx.stage = { version: null };
  try { return await runOnce(ctx); }
  catch (e) {
    const msg = scrub(String((e && e.message) || e), ctx.config);
    ctx.log('오류: ' + msg);
    const v = ctx.stage.version, local = ctx.local;
    if (v != null) local.failures[v] = (local.failures[v] || 0) + 1;
    try {
      await put(ctx, { agentSeenAt: ctx.now(), mode: ctx.dryRun ? 'dry-run' : 'live', result: 'fail', message: msg, failVersion: v == null ? 0 : v, attempts: v == null ? 0 : local.failures[v] });
    } catch (e2) { ctx.log('상태를 기록하지 못했습니다: ' + scrub(String((e2 && e2.message) || e2), ctx.config)); }
    return { action: 'error', message: msg, version: v };
  }
}

module.exports = { runOnce, runRound, MAX_ATTEMPTS, HEARTBEAT_MS, md5hex, deviceInfo };
```

- [ ] **Step 4: 통과를 확인한다**

Run: `node --test tests/signboard-agent.test.js`
Expected: PASS — `ℹ pass 14`

- [ ] **Step 5: 커밋**

```bash
git add scripts/signboard-agent/run.js tests/signboard-agent.test.js
git commit -m "feat(전광판 심부름꾼): 한 바퀴 — 시험 모드·첫 전송 확인·0건 차단·3번 재시도·5분 심장박동" -- scripts/signboard-agent/run.js tests/signboard-agent.test.js
git show --stat HEAD | tail -4
```

---

### Task 6: 실행 파일·안내·자동 시작 + 진짜로 한 번 돌려 보기

**Files:**
- Create: `scripts/signboard-agent/main.js`, `scripts/signboard-agent/config.example.json`, `scripts/signboard-agent/install-task.ps1`, `scripts/signboard-agent/README.md`
- Test: `tests/signboard-agent-hygiene.test.js`
- 도구(저장소 밖): `signboard-tools/e2e/` (가짜 firebase CLI)

**Interfaces:**
- Consumes: Task 1~5 의 모듈.
- Produces: 명령줄 `node scripts/signboard-agent/main.js [--once] [--dry-run] [--home DIR]` · `parseArgs(argv)`. 자동 시작은 `install-task.ps1 -RepoDir … [-Remove]`(작업 이름 `PureunSignboardAgent`).

- [ ] **Step 1: 위생 시험을 먼저 쓴다**

```js
/* 전광판 심부름꾼 — 열쇠·쓰기 범위·시험 모드 기본값의 «위생» (2026-10-12)
   코드를 «글자로» 보는 검사라 주석은 걷고 본다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const DIR = path.join(__dirname, '..', 'scripts', 'signboard-agent');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1');
const codeFiles = fs.readdirSync(DIR).filter((f) => f.endsWith('.js'));
const src = (f) => strip(fs.readFileSync(path.join(DIR, f), 'utf8'));

test('샘플 설정에는 열쇠가 비어 있고 실전이 꺼져 있다', () => {
  const c = JSON.parse(fs.readFileSync(path.join(DIR, 'config.example.json'), 'utf8'));
  assert.equal(c.sdkKey, ''); assert.equal(c.sdkSecret, '');
  assert.equal(c.liveEnabled, false);
});

test('코드에 열쇠 값을 글자로 박지 않았다', () => {
  codeFiles.forEach((f) => {
    const s = src(f);
    assert.doesNotMatch(s, /sdkSecret\s*[:=]\s*['"][^'"]{3,}['"]/, f + ': sdkSecret 글자 값');
    assert.doesNotMatch(s, /sdkKey\s*[:=]\s*['"][^'"]{3,}['"]/, f + ': sdkKey 글자 값');
  });
});

test('설정·열쇠를 통째로 찍지 않는다', () => {
  codeFiles.forEach((f) => {
    const s = src(f);
    assert.doesNotMatch(s, /console\.(log|error|warn)\([^)]*\bconfig\b/, f + ': 설정을 찍는다');
    assert.doesNotMatch(s, /JSON\.stringify\((ctx\.)?config\b/, f + ': 설정을 글자로 만든다');
  });
});

test('포털 데이터베이스에는 signboard/state «한 곳만» 쓴다(CLI 는 규칙을 건너뛰므로)', () => {
  const store = src('store.js');
  const updates = [...store.matchAll(/'database:(\w+)'/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(updates)].sort(), ['get', 'update']);
  assert.equal((store.match(/'database:update',\s*'([^']+)'/g) || []).length, 1);
  assert.match(store, /'database:update',\s*'\/signboard\/state'/);
  codeFiles.filter((f) => f !== 'store.js').forEach((f) => assert.doesNotMatch(src(f), /database:(set|update|remove|push)/, f));
});

test('시험 모드가 기본이다 — 실전은 liveEnabled 가 정확히 true 일 때뿐이고, --dry-run 이 이긴다', () => {
  const main = src('main.js');
  assert.match(main, /const dryRun = args\.dry \|\| config\.liveEnabled !== true;/);
});

test('장비에 보내는 길은 device.js 하나뿐이다', () => {
  codeFiles.filter((f) => f !== 'device.js').forEach((f) => assert.doesNotMatch(src(f), /require\(['"]node:http['"]\)|require\(['"]http['"]\)/, f + ': 장비 통신이 다른 곳에도 있다'));
});

test('.ps1 은 ASCII 만 쓴다 — 윈도 PowerShell 5.1 이 BOM 없는 파일을 ANSI 로 읽는다', () => {
  const b = fs.readFileSync(path.join(DIR, 'install-task.ps1'));
  for (const x of b) assert.ok(x < 128, '한글·특수문자가 들어 있다');
});

test('안내문이 시험 모드·대표 확인·열쇠 비공개를 말한다', () => {
  const r = fs.readFileSync(path.join(DIR, 'README.md'), 'utf8');
  assert.match(r, /시험 모드/); assert.match(r, /지워도 됩니다/); assert.match(r, /저장소·채팅·화면 어디에도 적지 않습니다/);
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `node --test tests/signboard-agent-hygiene.test.js`
Expected: FAIL — `ENOENT … config.example.json` 등

- [ ] **Step 3: 파일들을 만든다**

`scripts/signboard-agent/main.js`:

```js
#!/usr/bin/env node
'use strict';
/* main.js — 전광판 심부름꾼 (이 PC 에서 늘 켜 둔다) (설계서 §6)
   쓰는 법
     node scripts/signboard-agent/main.js --once --dry-run   한 바퀴만, 시험 모드(장비에 연결하지 않음)
     node scripts/signboard-agent/main.js                    계속 돈다. config.json 의 liveEnabled 가 true 일 때만 실전
   ⚠ 실전은 «config.json 에 liveEnabled:true» 일 때만이다. --dry-run 은 그것을 «이긴다»(항상 시험).
   ⚠ 열쇠는 로그에 찍지 않는다. */
const fs = require('node:fs');
const path = require('node:path');
const { homeDir, loadConfig, readLocal, writeLocal, scrub } = require('./config.js');
const { createStore } = require('./store.js');
const { createDevice } = require('./device.js');
const { runRound } = require('./run.js');

const MAX_LOG_BYTES = 1024 * 1024;

function parseArgs(argv) {
  const i = argv.indexOf('--home');
  return { once: argv.includes('--once'), dry: argv.includes('--dry-run'), home: i >= 0 ? argv[i + 1] : '' };
}
function makeLogger(dir, config) {
  const file = path.join(dir, 'agent.log');
  return function (msg) {
    const line = new Date().toISOString() + ' ' + scrub(msg, config);
    console.log(line);
    try {
      fs.mkdirSync(dir, { recursive: true });
      if (fs.existsSync(file) && fs.statSync(file).size > MAX_LOG_BYTES) fs.renameSync(file, file + '.old');
      fs.appendFileSync(file, line + '\n');
    } catch (e) { /* 로그를 못 쓴다고 일을 멈추지 않는다 */ }
  };
}
async function download(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error('파일 내려받기 실패 (HTTP ' + r.status + ')');
  return Buffer.from(await r.arrayBuffer());
}
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dir = args.home || homeDir();
  const loaded = loadConfig(dir);
  if (!loaded.config || loaded.errors.length) { console.error(loaded.errors.join('\n')); process.exit(2); }
  const config = loaded.config;
  const dryRun = args.dry || config.liveEnabled !== true;
  const log = makeLogger(dir, config);
  const store = createStore({ project: config.project });
  const ctx = {
    store, dir, config, dryRun, log, download, now: Date.now, local: readLocal(dir),
    makeDevice: () => createDevice({ host: config.deviceHost, deviceId: config.deviceId, sdkKey: config.sdkKey, sdkSecret: config.sdkSecret, dateStyle: config.dateStyle })
  };
  log('심부름꾼 시작 — ' + (dryRun ? '시험 모드(장비에 연결하지 않음)' : '실전 모드'));
  do {
    const r = await runRound(ctx);
    writeLocal(dir, ctx.local);
    if (r.action !== 'idle') log('한 바퀴: ' + r.action + (r.version ? ' (판 ' + r.version + ')' : ''));
    if (args.once) break;
    await sleep(config.pollSec * 1000);
  } while (true); // eslint-disable-line no-constant-condition
}

if (require.main === module) main().catch((e) => { console.error(String((e && e.stack) || e)); process.exit(1); });
module.exports = { parseArgs };
```

`scripts/signboard-agent/config.example.json`:

```json
{
  "deviceHost": "",
  "deviceId": "",
  "sdkKey": "",
  "sdkSecret": "",
  "liveEnabled": false,
  "dateStyle": "rfc1123",
  "project": "pureun-erp",
  "pollSec": 60
}
```

`scripts/signboard-agent/install-task.ps1` (ASCII 만):

```powershell
# Registers the signboard agent as a "run at logon" scheduled task (design doc section 6.5).
#
# NOTE: this file is ASCII only on purpose. Windows PowerShell 5.1 reads a .ps1 without a BOM as the
# ANSI code page, so Korean text in here would turn into garbage.
#
# Usage (normal PowerShell window, no admin needed):
#   .\install-task.ps1 -RepoDir C:\path\to\a\STABLE\checkout\of\pureunall
#   .\install-task.ps1 -Remove
#
# Use a checkout that stays put (not a throw-away worktree) and keep it up to date with git pull.
# This script changes the PC's scheduled tasks - run it only after the representative approved it.
param(
  [string]$RepoDir = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path,
  [switch]$Remove
)

$name = 'PureunSignboardAgent'

if ($Remove) {
  Unregister-ScheduledTask -TaskName $name -Confirm:$false -ErrorAction SilentlyContinue
  Write-Host "Removed task $name"
  exit 0
}

$node = (Get-Command node -ErrorAction Stop).Source
$script = Join-Path $RepoDir 'scripts\signboard-agent\main.js'
if (-not (Test-Path $script)) { throw "Not found: $script" }

$action = New-ScheduledTaskAction -Execute $node -Argument ('"' + $script + '"') -WorkingDirectory $RepoDir
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit ([TimeSpan]::Zero) `
  -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Settings $settings `
  -Description 'Pureun signboard agent (sends published ads to the LED signboard)' | Out-Null
Write-Host "Registered task $name -> $node $script"
Write-Host "It starts at the next logon. To start now: Start-ScheduledTask -TaskName $name"
```

`scripts/signboard-agent/README.md`:

```markdown
# 전광판 심부름꾼 (scripts/signboard-agent)

포털 «전광판» 앱에서 **«전광판에 올리기»** 를 누르면, 이 프로그램이 올린 판을 가져다 사무실 안의 LED 전광판 장비에 보냅니다.
설계: `docs/superpowers/specs/2026-10-12-signboard-design.md` §6~§8. 이 폴더(`scripts/`)는 배포본에서 지워집니다 — 인터넷에 공개되지 않습니다.

## 한눈에
| 모드 | 하는 일 |
|---|---|
| **시험 모드** (기본) | 장비에 **한 번도 연결하지 않습니다.** 보낼 내용을 `outbox/v판번호.json` 에 적기만 합니다. 열쇠 없이도 돕니다. |
| **실전 모드** | `config.json` 에 `"liveEnabled": true` 가 있을 때만. 장비에 파일을 올리고 프로그램을 «전체 교체»합니다. |

`--dry-run` 을 붙이면 설정과 상관없이 **항상 시험 모드**입니다.

## 처음 한 번
1. Node 와 firebase CLI 가 이 PC 에 있고, `firebase login` 이 되어 있어야 합니다(포털 데이터를 읽고 `signboard/state` 를 쓰는 데 씁니다).
2. 설정 파일을 **저장소 밖**에 만듭니다: `%APPDATA%\pureun-signboard\config.json` (`config.example.json` 을 복사).
   - 시험 모드는 `deviceHost`·`sdkKey`·`sdkSecret` 이 비어 있어도 됩니다.
3. 한 바퀴만 시험: `node scripts/signboard-agent/main.js --once --dry-run`
4. 계속 돌리기: `node scripts/signboard-agent/main.js`

## 실전으로 넘어가기 전에 (설계서 §11)
- [ ] 장비 번호 가운데에 `D`(공정 카드)가 있다 — 없으면 공식 통로가 열리지 않습니다.
- [ ] 灰度 기술지원에서 받은 `sdkKey`·`sdkSecret` 을 `config.json` 에 넣었다. **이 값은 저장소·채팅·화면 어디에도 적지 않습니다.**
- [ ] 장비 시계와 시간대가 한국(UTC+9)이다 — 포털 «전광판 상태» 탭에 경고가 없다.
- [ ] 전광판에 지금 들어 있는 광고가 지워져도 된다 — 포털 «전광판 상태» 탭에서 대표가 «지워도 됩니다»를 눌러야 첫 전송이 나갑니다.
- [ ] HDPlayer 의 «정해진 시각 켜고 끄기» 설정을 쓰고 있었다면, 공식 통로를 켠 뒤 안 먹을 수 있다 — 확인.
- [ ] `config.json` 에 `"liveEnabled": true` 를 쓰고 시험 광고 한 건으로 먼저 확인.

## 안전장치
- 광고가 0건인 판은 보내지 않습니다(전광판을 통째로 비우지 않습니다).
- 받은 파일 크기가 기록과 다르면 그 판 전송을 중단하고, 장비의 기존 광고는 건드리지 않습니다.
- 같은 판은 3번까지만 다시 해 보고 멈춥니다. 새 판이 올라오면 다시 시작합니다.
- 장비 와이파이 비밀번호 등 장비 정보는 «필요한 칸만» 골라 올리고 나머지는 버립니다.
- 오류 글에서 `sdkKey`·`sdkSecret` 값은 `***` 로 지워집니다.
- 이 프로그램은 포털 데이터베이스에서 `signboard/state` **한 곳만** 씁니다.

## 자동 시작 (PC 설정을 바꾸므로 대표 확인 뒤에)
`powershell -ExecutionPolicy Bypass -File scripts\signboard-agent\install-task.ps1 -RepoDir <오래 두는 저장소 폴더>`
- 오래 두는 폴더에서 `git pull` 로 최신을 유지하세요(임시 작업 폴더는 지워질 수 있습니다).
- 되돌리기: `...install-task.ps1 -Remove`

## 문제 해결
| 증상 | 확인 |
|---|---|
| 포털에 «마지막 응답 N분 전» 경고 | PC 가 꺼졌나? `firebase login` 이 풀렸나? 로그: `%APPDATA%\pureun-signboard\agent.log` |
| 상태가 «실패» | 포털 «전광판 상태»의 메시지. 같은 판은 3번 뒤 멈춥니다 — 새 판을 올리거나 `local.json` 의 `failures` 를 지우세요 |
| 장비에 연결 안 됨 | `deviceHost`(예: `192.168.0.50:30080`)가 맞나, 전광판과 이 PC 가 같은 망인가 |
| 기간 예약이 한 시간 어긋남 | 장비 시간대가 중국(UTC+8)인지 — 포털 상태 탭의 경고 |
```

- [ ] **Step 4: 위생 시험 통과**

Run: `node --test tests/signboard-agent-hygiene.test.js`
Expected: PASS — `ℹ pass 8`

- [ ] **Step 5: 진짜 `main.js` 를 «가짜 firebase CLI» 와 한 번 돌려 본다 (운영 DB 에는 아무것도 하지 않는다)**

도구 폴더 `C:\Users\fair0\AppData\Local\Temp\signboard-tools\e2e\` 에 아래 세 파일을 **Write 도구로** 만든다 — 가짜 `firebase` 명령이 `PATH` 맨 앞에서 진짜 CLI 대신 불린다.

`e2e\fake-firebase.js`:

```js
/* 가짜 firebase CLI — 심부름꾼 main.js 를 «진짜로» 돌려 보려는 시험용. 운영 데이터베이스에는 아무것도 하지 않는다.
   database:get 은 FIXTURE 를 돌려주고, database:update 는 받은 파일 내용을 calls.log 에 적는다. */
const fs = require('fs');
const path = require('path');
const dir = __dirname;
const args = process.argv.slice(2);
const cmd = args[0], p = args[1];
const fixture = JSON.parse(fs.readFileSync(path.join(dir, 'fixture.json'), 'utf8'));
function get(pth) { let c = fixture; for (const k of String(pth).split('/').filter(Boolean)) c = c && typeof c === 'object' ? c[k] : undefined; return c === undefined ? null : c; }
if (cmd === 'database:get') { process.stdout.write(JSON.stringify(get(p)) + '\n'); }
else if (cmd === 'database:update') {
  const file = String(args[2]).replace(/^"|"$/g, '');
  fs.appendFileSync(path.join(dir, 'calls.log'), JSON.stringify({ cmd, path: p, body: JSON.parse(fs.readFileSync(file, 'utf8')) }) + '\n');
} else { process.stderr.write('모르는 명령 ' + cmd + '\n'); process.exit(1); }
```

`e2e\firebase.cmd`:

```bat
@echo off
node "%~dp0fake-firebase.js" %*
```

`e2e\fixture.json`:

```json
{
  "signboard": {
    "published": {
      "id": "published", "version": 1, "publishedBy": "A-001", "publishedAt": 1791780000000,
      "ads": [
        { "id": "ad_t1", "title": "무료상담", "kind": "text",
          "period": { "start": "2026-10-13", "end": "2026-10-31", "weekdays": ["Mon", "Wed"], "times": [{ "start": "09:00", "end": "18:00" }] },
          "text": { "string": "부당해고 무료상담", "size": 24, "color": "#ffff00", "bold": true, "effectType": 26, "effectSpeed": 5, "holdSec": 5 } }
      ]
    }
  }
}
```

Run (PowerShell):
```powershell
$tools = 'C:\Users\fair0\AppData\Local\Temp\signboard-tools'
$home2 = Join-Path $tools 'e2e\home'
Remove-Item $home2 -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item (Join-Path $tools 'e2e\calls.log') -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force $home2 | Out-Null
Set-Content -Path (Join-Path $home2 'config.json') -Value '{ "liveEnabled": false }' -Encoding ascii
$env:PATH = (Join-Path $tools 'e2e') + ';' + $env:PATH
Set-Location C:\Users\fair0\Documents\pu-wt-signboard
node scripts/signboard-agent/main.js --once --home $home2          # 첫 바퀴
Get-ChildItem (Join-Path $home2 'outbox') | Select-Object -ExpandProperty Name
Get-Content (Join-Path $tools 'e2e\calls.log')
node scripts/signboard-agent/main.js --once --home $home2          # 같은 판 — 다시 안 보내야 한다
(Get-Content (Join-Path $tools 'e2e\calls.log') | Measure-Object -Line).Lines
```
Expected:
- 첫 바퀴: `심부름꾼 시작 — 시험 모드(장비에 연결하지 않음)` · `한 바퀴: dry-run (판 1)`. (`DEP0190` 경고는 무해 — 선례 `thebill-pull.js` 와 같은 `shell:true`.)
- `outbox` 에 `v1.json`. 열어 보면 `method:"replace"` · 프로그램 1개(`uuid:"ad_t1"`) · `playControl.week.enable:"Mon,Wed"` · `date:[{start:"2026-10-13",end:"2026-10-31"}]` · `time:[{start:"09:00:00",end:"18:00:00"}]` · `effect.hold:5000`.
- `calls.log` 에 `database:update` **한 줄**(`/signboard/state`, `mode:"dry-run"`, `result:"dry-run"`). (PowerShell 이 한글을 `?쒗뿕` 처럼 보여 주는 것은 **표시** 문제일 뿐 파일은 UTF-8 이다.)
- 두 번째 바퀴 뒤 줄 수가 **그대로 1** — 같은 판은 다시 보내지 않고 기록도 안 쓴다.

- [ ] **Step 6: 커밋**

```bash
git add scripts/signboard-agent/main.js scripts/signboard-agent/config.example.json scripts/signboard-agent/install-task.ps1 scripts/signboard-agent/README.md tests/signboard-agent-hygiene.test.js
git commit -m "feat(전광판 심부름꾼): main.js·샘플 설정·로그온 자동 시작 등록·안내문 + 위생 검사" -- scripts/signboard-agent/main.js scripts/signboard-agent/config.example.json scripts/signboard-agent/install-task.ps1 scripts/signboard-agent/README.md tests/signboard-agent-hygiene.test.js
git show --stat HEAD | tail -8
```

---

### Task 7: 이빨 확인 · 전체 검사 · 기록

**Files:** 도구 폴더 `mutate.js`(포털 계획서 Task 7 의 것을 그대로 쓴다 — 이제 심부름꾼 파일이 있어 모든 건이 돈다). 저장소에서는 `status/2026-10-12-feat-signboard.md` 만 고친다.

- [ ] **Step 1: 뮤테이션을 돌린다**

`mutate.js` 가 도구 폴더에 없으면 포털 계획서 Task 7 Step 1 대로 만든다.

Run: `node /c/Users/fair0/AppData/Local/Temp/signboard-tools/mutate.js "$(pwd)" 2>&1 | grep -E "이빨|앵커|건너뜀|약한|모두 잡혔다"`
Expected: `모두 잡혔다 — 되돌림 완료`, `건너뜀` 없음(이제 모든 파일이 있다). 그리고 `git status --short` 가 돌리기 전과 같다.

- [ ] **Step 2: 전체 검사**

Run: `node --test --test-concurrency=4 "tests/*.test.js" > /tmp/full.log 2>&1; grep -E "^ℹ (tests|pass|fail)" /tmp/full.log; grep -E "^✖" /tmp/full.log | sort -u`
Expected: 포털 계획서 Task 8 까지 끝났다면 `ℹ fail 0`. 아직이라면 `★ 콘솔과 «한 곳도» 다르지 않다` **한 건만** 빨갛다(규칙을 올리면 풀린다). 다른 것이 빨가면 고친다(특히 `tests-no-local-path` — 검사 파일에 `C:\…`·`/home/…` 를 박지 않았는지).

- [ ] **Step 3: 기록을 고친다**

`status/2026-10-12-feat-signboard.md` 의 «끝낸 것»·«남은 일»·«건드린 파일»을 고친다: 심부름꾼 M2(시험 모드) 코드 끝, 남은 일 = PR + 대표 준비물(장비 번호·灰度 열쇠·네트워크·기존 프로그램 확인) 뒤 런북(M3).

```bash
git add status/2026-10-12-feat-signboard.md
git commit -m "docs(status): 전광판 심부름꾼 시험 모드 구현 끝 — 실전 연결(M3)은 대표 준비물 뒤" -- status/2026-10-12-feat-signboard.md
```

---

### Task 8: 푸시·PR (**사람이 보는 방에서만**)

- [ ] **Step 1:** `git fetch origin main && git rebase origin/main` (충돌이 나면 `git rebase --abort` 하고 사람에게 알린다) → 전체 검사 다시.
- [ ] **Step 2:** 포털 계획서의 PR 과 «같은 가지»라면 그 PR 에 함께 올라간다. 따로 올린다면 `git push -u origin feat/signboard` → `gh pr create`(제목 «전광판 심부름꾼 — 시험 모드(M2)», 본문 끝에 `🤖 Generated with [Claude Code](https://claude.com/claude-code)`). 자동 병합은 켜지 않는다. 이 PR 은 **규칙을 바꾸지 않는다**(`scripts/` 만 — 배포본에서 지워지는 폴더).
- [ ] **Step 3: 대표에게 보고(쉬운 한국어)** — 심부름꾼은 «시험 모드까지» 끝났다. 실전을 켜려면 대표 준비물 셋이 필요하다(장비 번호·灰度 열쇠·전광판이 사무실 인터넷에 붙어 있는지). 준비물이 오면 아래 런북을 사람과 함께 한다.

---

## 런북 M3 — 실전 연결 (대표 준비물이 온 뒤, **사람과 함께** — 자동으로 돌리지 않는다)

이 단계는 코드를 더 쓰지 않는다. 설정과 확인뿐이며, **장비에 실제로 보내는 첫 순간**이 있어 사람이 곁에서 본다.

**준비물 (대표님만 구할 수 있다):**
1. 전광판 **모델명·장비 번호** — 번호 가운데에 `D` 가 있어야 한다(`C16L-D00-A000F` 꼴). 없으면 공식 통로가 열리지 않는다.
2. **灰度 기술지원에서 받은 `sdkKey`·`sdkSecret`** — 장비 번호를 알려 주면 요청 문구는 이 쪽에서 쓴다. 장비 첫 사용 때 웹(`http://장비IP:30080/login/`)에서 등록하며 **한 번 등록하면 다시 못 한다.**
3. 전광판이 **사무실 인터넷(공유기)에 붙어 있는지**, 자체 와이파이만 쓰는지. 지금 이 PC 망(`192.168.0.x`)에서는 전광판이 보이지 않았다(2026-10-12). 자체 와이파이만 쓰면 심부름꾼을 둘 PC 를 다시 정해야 한다.
4. 전광판에 **지금 들어 있는 광고**가 있는지(첫 전체 교체 때 지워진다), HDPlayer 의 «정해진 시각 켜고 끄기» 설정이 있는지(공식 통로를 켜면 안 먹을 수 있다).

**절차:**
- [ ] `%APPDATA%\pureun-signboard\config.json` 을 만든다(`config.example.json` 복사): `deviceHost`(예: `192.168.0.50:30080`)·`deviceId`·`sdkKey`·`sdkSecret` 을 넣고 `"liveEnabled": false` 로 둔다. **이 값을 채팅·문서에 적지 않는다.**
- [ ] 연결만 확인 — `getDeviceProperty` 만 불러 본다(보내는 것이 아니라 **읽기**). 화면 크기·시계·시간대가 읽히면 서명이 맞는 것이다(출력에는 `PROP_KEEP` 칸만 나온다 — 와이파이 비밀번호는 없다):
  ```bash
  cd /c/Users/fair0/Documents/pu-wt-signboard
  node -e "const D=require('./scripts/signboard-agent/device.js'),C=require('./scripts/signboard-agent/config.js');const {config}=C.loadConfig(C.homeDir());D.createDevice({host:config.deviceHost,deviceId:config.deviceId,sdkKey:config.sdkKey,sdkSecret:config.sdkSecret,dateStyle:config.dateStyle}).getDeviceProperty().then(p=>console.log(p),e=>console.error('실패:',C.scrub(e.message,config)))"
  ```
  **403/서명 오류가 나면** `config.json` 의 `dateStyle` 을 `"java"` 로 바꿔 다시(설계서 §7 — 공식 문서 예시는 RFC 1123, 공식 파이썬 SDK 는 자바식). 연결 자체가 안 되면(`ECONNREFUSED`·시간 초과) 주소·같은 망인지부터 본다.
- [ ] 포털 «전광판 상태» 탭에서 장비 시계 경고를 본다(중국 시간대면 기간 예약이 한 시간 어긋난다 — 장비 시간대를 한국으로 고친다).
- [ ] 포털에서 **시험 광고 한 건**(글자, 기간 없음, 짧은 문구)을 만들어 «전광판에 올리기».
- [ ] `config.json` 에 `"liveEnabled": true` → `node scripts/signboard-agent/main.js --once`. **첫 바퀴는 보내지 않고** «첫 전송 확인 기다림» 으로 멈춘다(상태 `wait-confirm`, 장비에 있는 기존 광고 목록이 포털에 뜬다).
- [ ] 대표가 포털 «전광판 상태» 탭에서 기존 광고 목록을 보고 **«지워도 됩니다»** 를 누른다 → 한 바퀴 더 → 전광판에 시험 광고가 나온다. 사진 한 장·동영상 하나·기간(요일·시간대) 광고로 차례로 확인한다.
- [ ] 확인되면 `install-task.ps1` 로 로그온 자동 시작을 등록한다(PC 설정을 바꾸므로 대표 확인 뒤). 포털 상태 탭의 «마지막 응답»이 5분 안으로 갱신되는지 본다.
- [ ] 이상이 있으면 `config.json` 의 `liveEnabled` 를 `false` 로 되돌린다 — 심부름꾼이 다시 «시험 모드»가 되어 장비를 건드리지 않는다.

**확인 필요로 남은 것(설계서 §7, 이 런북에서 장비로 확인):** 灰度 서명이 우리 계산과 맞는지 · `date` 머리글 모양 · 기간이 «늘»인 광고(기간 필드 없음)가 늘 나오는지 · 한쪽만 적은 기간(먼 날짜로 닫음)이 맞게 도는지 · `uuid` 가 `ad_…` 문자열이어도 되는지 · 장비 가용 저장공간(동영상 상한 확정).

## Self-Review

- **설계서 대응:** §6.1 위치·모양 → Task 1~6 · §6.2 설정·비밀 → Task 4·6 · §6.3 한 바퀴 → Task 5 · §6.4 CLI → Task 4·6 · §6.5 자동 시작 → Task 6 · §7 灰度 통로 → Task 1~3 + 런북 · §8 안전장치 → Task 5·6 · §9 검사 → 각 Task 시험 + Task 7 · §11 대표 준비물·§10 M3 → 런북.
- **자리표시 점검:** 계획서에 «나중에 채움» 이 없다. 장비 앞에서만 확인되는 것은 «확인 필요»로 런북에 모았다.
- **이름 일치:** `ctx` 의 `store`·`makeDevice`·`download`·`local`·`now`·`log` 는 Task 5 Interfaces 와 `main.js`(Task 6)의 구성이 같다. `PROP_KEEP`(Task 3)·`deviceInfo`(Task 5)·`clockWarning`(Task 4)이 상태 기록의 칸 이름과 포털 화면(`stateCards`)의 읽는 칸과 같다.
