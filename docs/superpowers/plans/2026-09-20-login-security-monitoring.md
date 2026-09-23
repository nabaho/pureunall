# 로그인 무단시도 감지·경보 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 로그인 성공/실패를 전부 서버에서 기록하고, 처음 보는 기기·짧은 시간 내 반복
실패·평소와 다른 국가 세 신호를 판정해 기존 관리자 경보(`systemAlerts`)에 자동으로
띄운다. 로그인 자체의 동작·속도는 절대 바꾸지 않는다.

**Architecture:** `enter.html`이 로그인 성공/실패 직후 결과를 기다리지 않고
새 Cloud Function `logLoginAttempt`(HTTPS, 인증 불필요)를 호출한다. 이 함수가
요청 헤더에서 IP를 뽑고 로컬 GeoIP 라이브러리로 국가만 판별(외부 전송 없음)한 뒤,
판정에 필요한 순수 로직은 새 모듈 `functions/login-security.js`에 분리해 Firebase 없이
단위테스트한다. 의심 판정이 나오면 기존 `systemAlerts/{uid}/{id}` 경로에 한 건 추가해
`js/pu-health.js`가 이미 그리는 관리자 경보 화면에 자동으로 뜨게 한다.

**Tech Stack:** Firebase Functions v1(`firebase-functions/v1`), Firebase Admin SDK
(Auth·RTDB), `geoip-lite`(로컬 GeoIP, 외부 API 호출 없음), Node built-in
`node:test`(`node --test tests/*.test.js`), 순수 바닐라 JS(`enter.html`).

**Spec:** [docs/superpowers/specs/2026-09-20-login-security-monitoring-design.md](../specs/2026-09-20-login-security-monitoring-design.md)

## Global Constraints
- 로그인 성공/실패 응답 속도·동작은 절대 바뀌지 않는다 — 클라이언트는 기록 함수 호출
  결과를 **기다리지 않는다**(fire-and-forget, `.catch(function(){})`로 실패를 삼킴).
- 국가 판별은 **외부 API를 호출하지 않는다** — 함수 안에 내장된 로컬 GeoIP 라이브러리만 쓴다.
- 문턱값: 새 기기/새 국가는 "그 계정에 이미 기록이 하나 이상 있을 때만" 의심으로 본다
  (계정의 첫 기록 자체는 기준선으로만 저장, 알리지 않음). 반복 실패는 **15분 안에 5회**.
- 이번 범위는 **감지·경보까지만** — 로그인 차단, Identity Platform 승격, 2단계 인증
  강제는 넣지 않는다.
- 새 RTDB 경로(`login_events`, `login_devices`, `login_countries`, `login_fail_burst`)는
  클라이언트 쓰기 권한을 아예 안 둔다(Admin SDK만 씀) — 읽기는 관리자·위임관리인(`MGR`)만.
- 판정 로직(새 기기/새 국가/반복실패)은 Firebase를 몰라도 되는 **순수 함수**로 분리해
  단위테스트한다(billing-alert.js/billing-alert.test.js 관례 그대로).
- 규칙 변경은 `scripts/make-firebase-rules.js`에서만 하고
  `node scripts/rules-deploy.js --deploy`로 사람 확인 없이 바로 올린다(CLAUDE.md).
- 계정 존재 여부를 밖으로 흘리지 않는다(2026-09-07 결정 유지) — 이 기능은 화면에 보이는
  로그인 에러 문구를 절대 건드리지 않는다.

---

### Task 1: 로그인 시도 입력 다듬기 — `functions/login-security.js` (parseAttempt/firstIp)

**Files:**
- Create: `functions/login-security.js`
- Test: `tests/login-security.test.js`

**Interfaces:**
- Produces: `LS.firstIp(forwardedForHeader: string) => string`
  (헤더가 없거나 비었으면 `''`)
- Produces: `LS.parseAttempt(body: object) => { valid: true, email, deviceId, ua, ok, code } | { valid: false, why }`

- [ ] **Step 1: Write the failing test**

`tests/login-security.test.js` 새로 만들기:
```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const LS = require('../functions/login-security');

test('firstIp — X-Forwarded-For 맨 앞 것만 쓴다', () => {
  assert.equal(LS.firstIp('203.0.113.9, 10.0.0.1, 10.0.0.2'), '203.0.113.9');
  assert.equal(LS.firstIp('  203.0.113.9  '), '203.0.113.9');
  assert.equal(LS.firstIp(''), '');
  assert.equal(LS.firstIp(undefined), '');
});

test('parseAttempt — 정상 입력', () => {
  const r = LS.parseAttempt({
    email: 'P001@Pureun.kr', deviceId: 'dev-1', ua: 'Mozilla/5.0', ok: true, code: '',
  });
  assert.equal(r.valid, true);
  assert.equal(r.email, 'p001@pureun.kr');   // 소문자로 통일
  assert.equal(r.deviceId, 'dev-1');
  assert.equal(r.ok, true);
});

test('parseAttempt — 이메일이 없거나 이상하면 거절', () => {
  assert.equal(LS.parseAttempt({ deviceId: 'd', email: '' }).valid, false);
  assert.equal(LS.parseAttempt({ deviceId: 'd', email: '이메일아님' }).valid, false);
  assert.equal(LS.parseAttempt(null).valid, false);
});

test('parseAttempt — 기기ID가 없으면 거절', () => {
  assert.equal(LS.parseAttempt({ email: 'a@pureun.kr', deviceId: '' }).valid, false);
});

test('parseAttempt — ua 는 150자로 자른다', () => {
  const long = 'x'.repeat(300);
  const r = LS.parseAttempt({ email: 'a@pureun.kr', deviceId: 'd', ua: long });
  assert.equal(r.ua.length, 150);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/login-security.test.js`
Expected: FAIL — `Cannot find module '../functions/login-security'`

- [ ] **Step 3: Write minimal implementation**

`functions/login-security.js`:
```js
/* 로그인 무단시도 감지 — 값 다루는 부분만(순수 함수, 서버 I/O 없음).
   설계문서: docs/superpowers/specs/2026-09-20-login-security-monitoring-design.md
   ⚠ 여기서는 Firebase·geoip 를 부르지 않는다 — 그래야 실제 값 그대로 단위테스트할 수 있다
     (functions/billing-alert.js 와 같은 이유). 네트워크·DB 는 functions/index.js 가 맡는다. */
'use strict';

function firstIp(forwardedFor) {
  const raw = String(forwardedFor || '').split(',')[0].trim();
  return raw;
}

function parseAttempt(body) {
  const b = (body && typeof body === 'object') ? body : {};
  const email = String(b.email || '').trim().toLowerCase();
  const deviceId = String(b.deviceId || '').trim();
  const ua = String(b.ua || '').slice(0, 150);
  const ok = b.ok === true;
  const code = String(b.code || '').slice(0, 60);

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { valid: false, why: '이메일이 없거나 이상합니다' };
  }
  if (!deviceId) {
    return { valid: false, why: '기기ID가 없습니다' };
  }
  return { valid: true, email, deviceId, ua, ok, code };
}

module.exports = { firstIp, parseAttempt };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/login-security.test.js`
Expected: PASS (5개 테스트 모두 통과)

- [ ] **Step 5: Commit**

```bash
git add functions/login-security.js tests/login-security.test.js
git commit -m "feat(로그인보안): 시도 입력 다듬기(firstIp/parseAttempt) 순수 함수"
```

---

### Task 2: 의심 판정 로직 — `functions/login-security.js` (기기/국가/반복실패)

**Files:**
- Modify: `functions/login-security.js`
- Test: `tests/login-security.test.js`

**Interfaces:**
- Consumes: (없음 — Task 1 함수와 독립적으로 동작하는 순수 함수 추가)
- Produces:
  - `LS.FAIL_WINDOW_MS: number`, `LS.FAIL_THRESHOLD: number`
  - `LS.isNewDevice(knownDevices: object, deviceId: string) => boolean`
  - `LS.isNewCountry(knownCountries: object, country: string) => boolean`
  - `LS.nextBurst(prevBurst: {count,windowStartAt}|null, nowMs: number, ok: boolean) => {count, windowStartAt}`
  - `LS.burstIsSuspicious(burst: {count,windowStartAt}) => boolean`
  - `LS.buildAlerts(input: {uid,email,deviceIsNew,countryIsNew,burstSuspicious,country,ip,ua,failCount}) => Array<{uid,email,page,status,kind,message,detail}>`

- [ ] **Step 1: Write the failing test**

`tests/login-security.test.js`에 이어서 추가:
```js
test('isNewDevice — 이미 기록이 있는 계정에서만 "새 기기"로 본다', () => {
  assert.equal(LS.isNewDevice({}, 'dev-1'), false, '처음 로그인은 기준선일 뿐 의심 아님');
  assert.equal(LS.isNewDevice({ 'dev-1': { firstSeenAt: 1 } }, 'dev-1'), false, '아는 기기');
  assert.equal(LS.isNewDevice({ 'dev-1': { firstSeenAt: 1 } }, 'dev-2'), true, '모르는 기기');
});

test('isNewCountry — 국가를 모르면(빈 문자열) 의심하지 않는다', () => {
  assert.equal(LS.isNewCountry({ KR: { firstSeenAt: 1 } }, ''), false);
  assert.equal(LS.isNewCountry({}, 'KR'), false, '기준선');
  assert.equal(LS.isNewCountry({ KR: { firstSeenAt: 1 } }, 'US'), true);
});

test('nextBurst — 성공하면 그 자리에서 리셋', () => {
  const r = LS.nextBurst({ count: 4, windowStartAt: 1000 }, 2000, true);
  assert.equal(r.count, 0);
});

test('nextBurst — 창 안에서는 계속 쌓이고, 창을 벗어나면 새로 센다', () => {
  const t0 = 1_000_000;
  const within = LS.nextBurst({ count: 2, windowStartAt: t0 }, t0 + 60_000, false);
  assert.equal(within.count, 3);
  assert.equal(within.windowStartAt, t0);

  const after = LS.nextBurst({ count: 2, windowStartAt: t0 }, t0 + LS.FAIL_WINDOW_MS + 1, false);
  assert.equal(after.count, 1, '창을 벗어나면 1부터 다시');
});

// 검사고정-허용: 문턱값 자체가 설계문서 §5 의 승인된 규칙(15분/5회)이라 값으로 박는다.
test('burstIsSuspicious — 문턱을 채워야 의심(그 앞은 아직 아님)', () => {
  const justBelow = { count: LS.FAIL_THRESHOLD - 1, windowStartAt: 0 };
  const atThreshold = { count: LS.FAIL_THRESHOLD, windowStartAt: 0 };
  assert.equal(LS.burstIsSuspicious(justBelow), false);
  assert.equal(LS.burstIsSuspicious(atThreshold), true);
  assert.equal(LS.FAIL_THRESHOLD, 5);          // 검사고정-허용: 설계문서 §5 승인값
  assert.equal(LS.FAIL_WINDOW_MS, 15 * 60 * 1000); // 검사고정-허용: 설계문서 §5 승인값(15분)
});

test('buildAlerts — 걸린 것만 담고, 공통 자리(uid/email/page/status)를 채운다', () => {
  const none = LS.buildAlerts({
    uid: 'u1', email: 'a@pureun.kr', deviceIsNew: false, countryIsNew: false,
    burstSuspicious: false, country: '', ip: '1.2.3.4', ua: 'UA', failCount: 0,
  });
  assert.deepEqual(none, []);

  const all = LS.buildAlerts({
    uid: 'u1', email: 'a@pureun.kr', deviceIsNew: true, countryIsNew: true,
    burstSuspicious: true, country: 'US', ip: '1.2.3.4', ua: 'UA', failCount: 5,
  });
  assert.equal(all.length, 3);
  all.forEach((a) => {
    assert.equal(a.uid, 'u1');
    assert.equal(a.email, 'a@pureun.kr');
    assert.equal(a.page, 'enter.html');
    assert.equal(a.status, 'new');
    assert.ok(a.kind.indexOf('security-') === 0);
    assert.ok(a.message.length > 0);
  });
  assert.deepEqual(all.map((a) => a.kind).sort(),
    ['security-burst', 'security-country', 'security-device']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/login-security.test.js`
Expected: FAIL — `LS.isNewDevice is not a function` 등

- [ ] **Step 3: Write minimal implementation**

`functions/login-security.js` 맨 아래 `module.exports` 앞에 추가:
```js
// 검사고정-허용: 설계문서 §5 승인 문턱값 — 15분 안에 비밀번호 5회 연속 실패
const FAIL_WINDOW_MS = 15 * 60 * 1000;
const FAIL_THRESHOLD = 5;

function isNewDevice(knownDevices, deviceId) {
  const known = knownDevices || {};
  const hasBaseline = Object.keys(known).length > 0;
  return hasBaseline && !known[deviceId];
}

function isNewCountry(knownCountries, country) {
  if (!country) return false;                 // 모르면 의심하지 않는다
  const known = knownCountries || {};
  const hasBaseline = Object.keys(known).length > 0;
  return hasBaseline && !known[country];
}

function nextBurst(prevBurst, nowMs, ok) {
  if (ok) return { count: 0, windowStartAt: nowMs };
  const prev = (prevBurst && typeof prevBurst === 'object') ? prevBurst : null;
  const withinWindow = !!prev && (nowMs - prev.windowStartAt) < FAIL_WINDOW_MS;
  return {
    count: withinWindow ? prev.count + 1 : 1,
    windowStartAt: withinWindow ? prev.windowStartAt : nowMs,
  };
}

function burstIsSuspicious(burst) {
  return !!burst && burst.count >= FAIL_THRESHOLD;
}

function buildAlerts(input) {
  const alerts = [];
  const detail = 'IP ' + (input.ip || '(모름)')
    + (input.country ? ' · 국가 ' + input.country : '')
    + (input.ua ? ' · ' + input.ua : '');
  if (input.deviceIsNew) {
    alerts.push({ kind: 'security-device', message: '처음 보는 기기에서 로그인 성공 (' + input.email + ')' });
  }
  if (input.countryIsNew) {
    alerts.push({ kind: 'security-country', message: '평소와 다른 국가에서 로그인 성공: ' + input.country + ' (' + input.email + ')' });
  }
  if (input.burstSuspicious) {
    alerts.push({ kind: 'security-burst', message: '짧은 시간에 비밀번호 ' + input.failCount + '회 연속 실패 (' + input.email + ')' });
  }
  return alerts.map((a) => Object.assign(
    { uid: input.uid, email: input.email, page: 'enter.html', status: 'new', detail },
    a,
  ));
}
```

그리고 `module.exports`를 아래로 교체:
```js
module.exports = {
  firstIp, parseAttempt,
  FAIL_WINDOW_MS, FAIL_THRESHOLD,
  isNewDevice, isNewCountry, nextBurst, burstIsSuspicious, buildAlerts,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/login-security.test.js`
Expected: PASS (전체 11개 테스트 통과)

- [ ] **Step 5: Commit**

```bash
git add functions/login-security.js tests/login-security.test.js
git commit -m "feat(로그인보안): 새기기·새국가·반복실패 판정 순수 함수"
```

---

### Task 3: Cloud Function `logLoginAttempt` — `functions/index.js`

**Files:**
- Modify: `functions/package.json` (의존성 추가)
- Modify: `functions/index.js` (require 추가, 함수 추가 — 파일 맨 위 require 구간과 맨 끝에 export 추가)

**Interfaces:**
- Consumes: `LS.parseAttempt`, `LS.firstIp`, `LS.isNewDevice`, `LS.isNewCountry`,
  `LS.nextBurst`, `LS.burstIsSuspicious`, `LS.buildAlerts` (Task 1·2에서 만든 것 그대로)
- Consumes: 기존 `setCors(req,res)`, `getDatabase()`, `getAuth()` (파일 상단에 이미 있음)
- Produces: `exports.logLoginAttempt` — POST `{email,ok,code,deviceId,ua}` 받는 HTTPS 함수.
  다른 코드가 이 함수를 직접 부르지 않음(클라이언트가 `fetch`로만 호출) — 이후 태스크는
  URL 문자열로만 참조.

- [ ] **Step 1: 의존성 추가**

`functions/package.json`의 `"dependencies"`에 한 줄 추가(알파벳 순서 유지):
```json
    "geoip-lite": "^1.4.10",
```
(firebase-admin과 firebase-functions 사이, resend 앞이 아니라 알파벳 순 — imapflow와 mailparser 사이에 오도록 넣는다: `@firebase/app`, `@simplewebauthn/server`, `firebase-admin`, `firebase-functions`, `geoip-lite`, `imapflow`, `mailparser`, `nodemailer`, `resend`)

Run: `cd functions && npm install --save geoip-lite && cd ..`
Expected: `functions/package-lock.json`이 갱신되고 `functions/node_modules/geoip-lite`가 생김.

- [ ] **Step 2: require 추가**

`functions/index.js` 파일 맨 위, 기존 require들 다음(31번째 줄 `const 지역뉴스부품 = require("./news-region");` 다음)에 추가:
```js
const LS = require("./login-security");
const geoip = require("geoip-lite");
```

- [ ] **Step 3: 함수 본문 작성**

`functions/index.js` 맨 끝(마지막 `exports.hanaMessageBridge` 정의 뒤)에 추가:
```js
// ════════════════════════════════════════════════════════════════════════════
// 로그인 무단시도 감지 — logLoginAttempt
// ════════════════════════════════════════════════════════════════════════════
// 설계문서: docs/superpowers/specs/2026-09-20-login-security-monitoring-design.md
// enter.html 이 로그인 성공/실패 직후 «응답을 기다리지 않고» 부른다.
// 이 함수가 죽거나 늦어도 로그인 자체는 전혀 영향받지 않는다(클라이언트가 안 기다림).
exports.logLoginAttempt = functions
  .region(MAIL_REGION)
  .runWith({ timeoutSeconds: 10, memory: "128MB" })
  .https.onRequest(async (req, res) => {
    setCors(req, res);
    if (req.method === "OPTIONS") { res.status(204).send(""); return; }
    if (req.method !== "POST") { res.status(405).json({ ok: false }); return; }

    const parsed = LS.parseAttempt(req.body);
    if (!parsed.valid) { res.status(400).json({ ok: false, error: parsed.why }); return; }

    const ip = LS.firstIp(req.headers["x-forwarded-for"]) || String(req.ip || "");
    const now = Date.now();
    const country = (() => {
      try {
        const hit = geoip.lookup(ip);
        return (hit && hit.country) ? String(hit.country) : "";
      } catch (e) { return ""; }
    })();

    // 실재 계정인지는 «안으로만» 쓴다 — 화면 에러 문구는 절대 안 바뀐다(2026-09-07 결정 유지).
    let uid = "";
    try { uid = (await getAuth().getUserByEmail(parsed.email)).uid; }
    catch (e) { uid = ""; }

    const db = getDatabase();
    const rawKey = uid || ("unk_" + crypto.createHash("sha1").update(parsed.email).digest("hex").slice(0, 16));

    // 원시 기록은 계정을 찾았든 못 찾았든 항상 남긴다(설계문서 §2 "성공·실패 전부 기록").
    try {
      await db.ref("login_events/" + rawKey).push({
        at: now, ok: parsed.ok, code: parsed.code, email: parsed.email,
        ip, country, deviceId: parsed.deviceId, ua: parsed.ua, page: "enter.html",
      });
    } catch (e) {
      console.warn("logLoginAttempt: 원시 기록 실패", String((e && e.message) || e));
    }

    if (!uid) { res.status(200).json({ ok: true }); return; }   // 비교 기준(uid)이 없다

    try {
      const [devicesSnap, countriesSnap, burstSnap] = await Promise.all([
        db.ref("login_devices/" + uid).once("value"),
        db.ref("login_countries/" + uid).once("value"),
        db.ref("login_fail_burst/" + uid).once("value"),
      ]);
      const knownDevices = devicesSnap.val() || {};
      const knownCountries = countriesSnap.val() || {};
      const deviceIsNew = LS.isNewDevice(knownDevices, parsed.deviceId);
      const countryIsNew = LS.isNewCountry(knownCountries, country);
      const burst = LS.nextBurst(burstSnap.val(), now, parsed.ok);
      const burstSuspicious = LS.burstIsSuspicious(burst);

      const writes = { ["login_fail_burst/" + uid]: burst };
      if (!knownDevices[parsed.deviceId]) {
        writes["login_devices/" + uid + "/" + parsed.deviceId] = { firstSeenAt: now, ua: parsed.ua };
      }
      if (country && !knownCountries[country]) {
        writes["login_countries/" + uid + "/" + country] = { firstSeenAt: now };
      }
      await db.ref().update(writes);

      const alerts = LS.buildAlerts({
        uid, email: parsed.email, deviceIsNew, countryIsNew, burstSuspicious,
        country, ip, ua: parsed.ua, failCount: burst.count,
      });
      for (const a of alerts) {
        await db.ref("systemAlerts/" + uid).push(Object.assign({ createdAt: now }, a));
      }
    } catch (e) {
      console.warn("logLoginAttempt: 판정 실패", String((e && e.message) || e));
    }

    res.status(200).json({ ok: true });
  });
```

- [ ] **Step 4: 문법 확인(테스트 프레임워크로 함수를 직접 부르지 않음 — Admin SDK 라이브 연결 필요)**

Run: `node -c functions/index.js`
Expected: 출력 없음(문법 오류 없음). 이 함수는 Admin SDK·실제 프로젝트 연결이 필요해
로컬 단위테스트 대상이 아니다(billing-alert 계열과 동일한 관례 — 순수 로직만
Task 1·2에서 이미 검증됨).

- [ ] **Step 5: 배포**

Run: `firebase deploy --only functions:logLoginAttempt --project pureun-erp`
Expected: `Deploy complete!` — 실패하면(열쇠·권한 문제) 그 오류 그대로 사람에게 보고.

- [ ] **Step 6: Commit**

```bash
git add functions/package.json functions/package-lock.json functions/index.js
git commit -m "feat(로그인보안): 로그인 시도 기록·판정 함수 logLoginAttempt"
```

---

### Task 4: Firebase 규칙 추가 — `scripts/make-firebase-rules.js`

**Files:**
- Modify: `scripts/make-firebase-rules.js`
- Modify: `tests/firebase-access-matrix.test.js`
- Modify(생성물): `docs/firebase-rules-전체-적용본.json`

**Interfaces:**
- Consumes: 파일에 이미 있는 `MGR` 상수(관리자 또는 위임관리인)
- Produces: `rules.login_events`, `rules.login_devices`, `rules.login_countries`,
  `rules.login_fail_burst` — 전부 `{ '.read': MGR }`뿐, `.write` 없음(클라이언트 쓰기 전면 금지)

- [ ] **Step 1: Write the failing test**

`tests/firebase-access-matrix.test.js` 끝에 추가(파일 마지막 `});` 다음):
```js
test('역할표: 로그인 감지 기록은 관리자·위임관리인만 읽고, 클라이언트는 아무도 못 쓴다', () => {
  const paths = ['login_events', 'login_devices', 'login_countries', 'login_fail_burst'];
  for (const p of paths) {
    assert.ok(rules[p], p + ' 규칙이 없습니다');
    assert.equal(evaluate(rules[p]['.read'], { auth: auth('adminUid') }), true, p + ' 관리자 읽기');
    assert.equal(evaluate(rules[p]['.read'], { auth: auth('subUid') }), true, p + ' 위임관리인 읽기');
    assert.equal(evaluate(rules[p]['.read'], { auth: auth('staffUid') }), false, p + ' 일반 직원은 못 읽음');
    assert.equal(rules[p]['.write'], undefined, p + ' 클라이언트 쓰기 규칙이 있으면 안 됨(서버 전용)');
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/firebase-access-matrix.test.js`
Expected: FAIL — `login_events 규칙이 없습니다`

- [ ] **Step 3: 규칙 추가**

`scripts/make-firebase-rules.js` 맨 끝, `process.stdout.write(...)` 바로 앞에 추가:
```js
/* ══ 로그인 무단시도 감지 ══════════════════════════════════════════════
   설계문서: docs/superpowers/specs/2026-09-20-login-security-monitoring-design.md
   ⚠ '.write' 를 아예 안 둔다 — 이 네 자리는 오직 functions/index.js 의
     logLoginAttempt(관리자 SDK)만 쓴다. 브라우저가 직접 쓸 수 있으면
     누구든 「새 기기 아님」으로 자기 기록을 조작해 경보를 피할 수 있다. */
rules.login_events    = { '.read': MGR };
rules.login_devices   = { '.read': MGR };
rules.login_countries = { '.read': MGR };
rules.login_fail_burst= { '.read': MGR };
```

- [ ] **Step 4: 규칙 JSON 다시 만들고 테스트 통과 확인**

Run: `node scripts/make-firebase-rules.js > docs/firebase-rules-전체-적용본.json`
Run: `node --test tests/firebase-access-matrix.test.js`
Expected: PASS

- [ ] **Step 5: 콘솔에 바로 올리기 (CLAUDE.md 지시 — 사람 확인 없이)**

Run: `node scripts/rules-deploy.js --deploy`
Expected: `login_events`·`login_devices`·`login_countries`·`login_fail_burst` 네 자리가
새로 생겼다는 것 외에는 **사라지는 규칙이 없어야** 한다. 안전장치가 "사라질 규칙이
있다"며 멈추면(종료코드 2) 무엇이 사라지려 했는지 그대로 사람에게 보고하고 멈춘다 —
`--force` 같은 우회를 만들지 않는다.

- [ ] **Step 6: Commit**

```bash
git add scripts/make-firebase-rules.js docs/firebase-rules-전체-적용본.json tests/firebase-access-matrix.test.js
git commit -m "feat(로그인보안): 로그인 감지 기록 4자리 — 관리자만 읽기, 콘솔에 적용"
```

---

### Task 5: `enter.html` — 로그인 시도를 실제로 서버에 보고

**Files:**
- Modify: `enter.html:1641` 바로 앞(기존 `function doLogin(){` 정의 앞)에 헬퍼 추가
- Modify: `enter.html:1679-1734` (`doLogin` 안의 성공·실패 처리)

**Interfaces:**
- Consumes: Task 3에서 배포한 `https://asia-northeast3-pureun-erp.cloudfunctions.net/logLoginAttempt`
- Produces: (없음 — 화면 동작·에러 문구는 그대로, 뒤에서 기록만 추가됨)

- [ ] **Step 1: 헬퍼 함수 추가**

`enter.html`에서 `function doLogin(){` 바로 앞(1641번째 줄)에 삽입:
```js
  // ── 로그인 시도 기록(무단 로그인 감지용, 2026-09-20) ──────────────────
  // ⚠ 응답을 절대 기다리지 않는다 — 이 기록이 실패해도 로그인 자체는 그대로 되어야 한다.
  var LOGIN_LOG_URL = 'https://asia-northeast3-pureun-erp.cloudfunctions.net/logLoginAttempt';
  function loginDeviceId(){
    var KEY = 'pu_device_id';
    try {
      var v = localStorage.getItem(KEY);
      if(!v){ v = Date.now().toString(36) + Math.random().toString(36).slice(2); localStorage.setItem(KEY, v); }
      return v;
    } catch(e){ return 'no-storage-' + Date.now().toString(36); }
  }
  function reportLogin(email, ok, code){
    try {
      fetch(LOGIN_LOG_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, ok: !!ok, code: code || '', deviceId: loginDeviceId(), ua: navigator.userAgent })
      }).catch(function(){});
    } catch(e){}
  }
```

- [ ] **Step 2: 성공 시 호출**

`enter.html:1680` 부근, `.then(function(cred){` 바로 다음 줄에 추가:
```js
    }).then(function(cred){
      _settled = true; clearTimeout(_watchdog);
      reportLogin(email, true, '');
```
(그 아래 기존 코드는 그대로 둔다)

- [ ] **Step 3: 실패 시 호출**

`enter.html:1709` 부근, `var code = (err && err.code) || '';` 다음 줄에 추가:
```js
      var code = (err && err.code) || '';
      reportLogin(email, false, code || (err && err.puPersistence ? 'persistence' : 'unknown'));
```

- [ ] **Step 4: 문법 확인**

Run: `node --test tests/html-inline-script-syntax.test.js`
Expected: PASS (enter.html 인라인 스크립트가 전체 파일 기준으로 구문 오류 없음)

- [ ] **Step 5: 브라우저로 실제 확인**

로컬에서 `enter.html`을 열어(또는 배포본으로) 정상 계정으로 로그인 성공 1회,
일부러 틀린 비밀번호로 실패 1회 시도 → 브라우저 개발자도구 네트워크 탭에서
`logLoginAttempt` 요청이 각각 나가는지 확인. 관리자 계정으로 `pu-erp.html`(또는
`systemAlerts`를 보여주는 화면)을 열어 새로 뜬 경보가 없는지(정상 기기이므로 없어야 함)
확인.

- [ ] **Step 6: Commit**

```bash
git add enter.html
git commit -m "feat(로그인보안): 로그인 성공·실패를 서버에 보고(응답은 기다리지 않음)"
```

---

### Task 6: 전체 검증 및 최종 보고

**Files:** (수정 없음 — 검증만)

- [ ] **Step 1: 전체 테스트 실행**

Run: `node --test tests/*.test.js`
Expected: 전부 PASS (특히 `login-security.test.js`, `firebase-access-matrix.test.js`,
`html-inline-script-syntax.test.js`, `test-pin-guard.test.js`, `agents-md.test.js`)

- [ ] **Step 2: 롤아웃 소음 확인 시나리오(수동)**

관리자 계정으로 실제 직원 계정 하나를 골라, 평소 안 쓰던 브라우저(또는 시크릿 창)로
로그인 성공 → `systemAlerts`에 `security-device` 경보가 뜨는지 확인. 이는 설계문서
§11에서 예고한 "정상" 동작이며 고장이 아니다.

- [ ] **Step 3: STATUS 기록 (CLAUDE.md 지시 — 새 파일 하나로)**

`status/2026-09-20-payroll-staff-hub.md`(현재 브랜치 이름 기준 새 파일)에 이번 작업
요약을 적는다 — 무엇을 만들었는지, 새로 열린 RTDB 읽기 권한(관리자만) 요약, 배포한
함수 이름(`logLoginAttempt`). **`STATUS.md`의 표에는 덧붙이지 않는다**(2026-09-07 이후
그 표에서 부딪힘이 반복됨).

- [ ] **Step 4: 대표에게 보고할 내용 정리**

다음 셋을 대표에게 보고한다(파이어베이스 콘솔 규칙 자동 배포 시 CLAUDE.md가 요구하는
"무엇이 새로 생기고 바뀌었는지"):
1. 새로 생긴 읽기 권한 4자리(`login_events`/`login_devices`/`login_countries`/
   `login_fail_burst`) — 전부 관리자·위임관리인만 읽음, 그 밖 아무도 못 읽고 못 씀.
2. 새로 배포된 함수 `logLoginAttempt` — 로그인마다 자동으로 불림.
3. 앞으로 관리자 경보 화면에 `security-device`/`security-country`/`security-burst`
   종류가 새로 뜰 수 있음 — 켜는 초기에는 직원들의 두 번째 기기 로그인이 한 번씩 뜰 수
   있다는 점(설계문서 §11)을 함께 안내.

- [ ] **Step 5: Commit (필요한 경우)**

```bash
git add status/2026-09-20-payroll-staff-hub.md
git commit -m "docs: 로그인 보안 감지 작업 기록"
```
