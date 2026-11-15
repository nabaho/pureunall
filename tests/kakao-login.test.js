'use strict';
/* 카카오로 로그인 (대표 지시 2026-09-27 「로그인기능을 카카오톡과 연결시킬수 있나?」 → 「추천대로」)

   ★ 서버 함수(functions/kakao.js)를 «실제로 돌려» 본다 — 카카오 서버·DB·인증은 가짜로 세운다.
     글자로만 보면 조건 하나가 빠져도 이름만 맞으면 통과해 버린다.

   못 박는 것(규칙):
   ① 관리자(위임관리인 포함)도 카카오로 연결·로그인한다(대표 지시 2026-09-27 뒤집음).
   ② 재직자가 아니면(익명 로그인·퇴사) 연결도 로그인도 안 된다.
   ③ 다른 카카오로 «바꿔» 연결하면 옛 카카오 길이 지워진다.
   ④ 사번은 화면이 보낸 값이 아니라 명부(uid_roles)에서 꺼낸다.
   ⑤ 남의 연결은 관리자만 끊는다.
   ⑥ 화면은 자기가 시작하지 않은 복귀(state 불일치)를 서버로 넘기지 않는다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const Module = require('module');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');

/* ── 가짜 세상 ─────────────────────────────────────────────────────── */
function makeWorld(seed) {
  const data = JSON.parse(JSON.stringify(seed || {}));
  function get(p) {
    const parts = p.split('/').filter(Boolean);
    let cur = data;
    for (const k of parts) { if (cur == null || typeof cur !== 'object') return null; cur = cur[k]; }
    return cur === undefined ? null : cur;
  }
  function set(p, v) {
    const parts = p.split('/').filter(Boolean);
    let cur = data;
    for (let i = 0; i < parts.length - 1; i++) { if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {}; cur = cur[parts[i]]; }
    if (v === null) delete cur[parts[parts.length - 1]]; else cur[parts[parts.length - 1]] = JSON.parse(JSON.stringify(v));
  }
  const database = {
    ref(p) {
      p = p || '';
      return {
        once: async () => ({ val: () => { const v = get(p); return v == null ? null : JSON.parse(JSON.stringify(v)); } }),
        update: async (obj) => { for (const k of Object.keys(obj)) set((p ? p + '/' : '') + k, obj[k]); },
        set: async (v) => set(p, v),
        transaction: async (fn) => {
          const before = get(p); const next = fn(before == null ? null : JSON.parse(JSON.stringify(before)));
          if (next === undefined) return { committed: false, snapshot: { val: () => before } };
          set(p, next); return { committed: true, snapshot: { val: () => next } };
        },
        // 로그인 감시 기록(login_events·systemAlerts)용 — world.pushFails 면 일부러 실패한다
        push: async (v) => { if (world && world.pushFails) throw new Error('db down'); set(p + '/' + 'k' + (++pushN), v); },
      };
    },
  };
  return { data, database };
}

let pushN = 0;
/* 가짜 인증 — 증표 글자가 곧 uid 다 */
const issued = [];
const fakeAuth = {
  verifyIdToken: async (tok) => {
    if (!tok || tok === 'bad') throw new Error('bad');
    const bits = String(tok).split(':'); const tag = bits[1] || '';
    return {
      uid: bits[0],
      auth_time: Math.floor(Date.now() / 1000) - (tag === 'old' ? 3600 : 0),
      firebase: { sign_in_provider: tag === 'kakao' ? 'custom' : 'password' },
      kakao: tag === 'kakao',
    };
  },
  createCustomToken: async (uid, claims) => { issued.push({ uid, claims }); return 'CT:' + uid; },
};

let world;
let kakaoIdForCode = {};   // 가짜 카카오: code → 회원번호

function loadKakao() {
  const origLoad = Module._load;
  Module._load = function (req, parent, isMain) {
    if (req === 'firebase-functions/v1') {
      const chain = { region: () => chain, runWith: () => chain, https: { onRequest: (h) => h } };
      return chain;
    }
    if (req === 'firebase-admin/auth') return { getAuth: () => fakeAuth };
    if (req === 'firebase-admin/database') return { getDatabase: () => world.database };
    if (req === './ontology-write-server') return { wrapDatabase: (d) => d };
    return origLoad.apply(this, arguments);
  };
  const p = path.join(ROOT, 'functions', 'kakao.js');
  delete require.cache[require.resolve(p)];
  try { return require(p); } finally { Module._load = origLoad; }
}

global.fetch = async (url, opts) => {
  if (String(url).startsWith('https://kauth.kakao.com/oauth/token')) {
    const code = new URLSearchParams(opts.body).get('code');
    if (!kakaoIdForCode[code]) return { ok: false, json: async () => ({ error: 'invalid_grant' }) };
    return { ok: true, json: async () => ({ access_token: 'AT:' + code }) };
  }
  if (String(url).startsWith('https://kapi.kakao.com/v2/user/me')) {
    const code = String(opts.headers.Authorization).replace('Bearer AT:', '');
    return { ok: true, json: async () => ({ id: kakaoIdForCode[code] }) };
  }
  throw new Error('예상 밖 주소: ' + url);
};
process.env.KAKAO_REST_KEY = '0123456789abcdef0123456789abcdef';   // 가짜 — 모양만 진짜 키와 같다
process.env.KAKAO_CLIENT_SECRET = 'FakeSecretForTests1234567890';

function signedState(mode, at = Date.now()) {
  const payload = mode + '.' + at + '.' + crypto.randomBytes(24).toString('base64url');
  return payload + '.' + crypto.createHmac('sha256', process.env.KAKAO_CLIENT_SECRET)
    .update(payload).digest('base64url');
}
function shapedState(mode = 'login', fill = 'A') {
  return mode + '.1700000000000.' + fill.repeat(32) + '.' + fill.repeat(43);
}

function call(handler, { token, body } = {}) {
  return new Promise((resolve) => {
    body = Object.assign({}, body || {});
    /* 대부분의 기능 검사는 OAuth 앞걸음 자체가 대상이 아니다. 실제 서버가 발급한 것과
       같은 1회용 표를 준비하고, 별도 보안 검사에서 발급·재사용·만료를 직접 겨눈다. */
    if (body.code && !body.state) {
      body.state = signedState(token ? 'link' : 'login');
    }
    const req = { method: 'POST', headers: { origin: 'https://nabaho.github.io', authorization: token ? 'Bearer ' + token : '' }, body: body || {}, query: {} };
    const res = {
      _s: 200, set() {}, status(s) { this._s = s; return this; },
      json(j) { resolve({ status: this._s, body: j }); }, send() { resolve({ status: this._s }); },
    };
    handler(req, res);
  });
}

const ROLES = {
  uid_roles: {
    staff1: { sid: 'P-101', status: 'active' },
    staff2: { sid: 'P-102', status: 'active' },
    boss: { sid: 'P-001', status: 'active', isAdmin: true },
    deputy: { sid: 'P-002', status: 'active', isSubAdmin: true },
    gone: { sid: 'P-900', status: 'retired' },
  },
};

function fresh(extra) {
  world = makeWorld(Object.assign(JSON.parse(JSON.stringify(ROLES)), extra || {}));
  issued.length = 0;
  kakaoIdForCode = { cA: '111', cB: '222', cC: '333' };
  return loadKakao();
}

/* ── 서버 ─────────────────────────────────────────────────────────── */
test('★ 연결하면 카카오로 그 직원 계정에 들어온다 (사번은 명부에서)', async () => {
  const K = fresh();
  const r1 = await call(K.kakaoLink, { token: 'staff1', body: { code: 'cA', sid: 'P-999-가짜' } });
  assert.equal(r1.body.ok, true);
  assert.equal(world.data.uid_kakao.staff1.sid, 'P-101', '화면이 보낸 사번을 그대로 적었다');
  assert.equal(world.data.uid_kakao.staff1.linked, true);
  assert.ok(!world.data.uid_kakao.staff1.kakaoId, '화면이 읽는 표에 카카오 회원번호 원문이 남았다');
  assert.equal(world.data.kakao_links[world.data.uid_kakao.staff1.linkKey].uid, 'staff1');
  const r2 = await call(K.kakaoLoginFinish, { body: { code: 'cA' } });
  assert.equal(r2.body.ok, true);
  assert.deepEqual(issued[0], { uid: 'staff1', claims: { kakao: true, sid: 'P-101' } });
});

test('★★★ 카카오 인증 응답에는 자기 포털 정보만 함께 실어 휴대전화 명부 재조회 없이 진입한다', async () => {
  const K = fresh({ data: { user_dir: { v: [
    { sid: 'P-101', name: '이전 이름', role: 'member', status: 'retired', privateMemo: '싣지 말 것' },
    { sid: 'P-101', name: '현 근로자', title: '노무사', role: 'member', status: 'active', privateMemo: '싣지 말 것' },
    { sid: 'P-102', name: '다른 근로자', role: 'member', status: 'active' },
  ] } } });
  await call(K.kakaoLink, { token: 'staff1', body: { code: 'cA' } });
  const r = await call(K.kakaoLoginFinish, { body: { code: 'cA' } });
  assert.equal(r.body.token, 'CT:staff1');
  assert.equal(r.body.profile.acct.name, '현 근로자');
  assert.equal(r.body.profile.all.length, 2, '겹친 사번 경고를 잃지 않아야 한다');
  assert.ok(!JSON.stringify(r.body.profile).includes('다른 근로자'), '남의 명부를 응답에 실었다');
  assert.ok(!JSON.stringify(r.body.profile).includes('privateMemo'), '포털에 불필요한 개인 필드를 실었다');
});

test('★★★ 명부가 없거나 인증 사번·역할과 어긋나면 빠른 진입 정보 없이 기존 경로를 쓴다', async () => {
  const K = fresh({ data: { user_dir: { v: [ { sid: 'P-102', name: '다른 근로자', role: 'member' } ] } } });
  await call(K.kakaoLink, { token: 'staff1', body: { code: 'cA' } });
  assert.equal((await call(K.kakaoLoginFinish, { body: { code: 'cA' } })).body.profile, null);
  world.data.data.user_dir.v = [{ sid: 'P-101', name: '근로자', role: 'admin' }];
  world.data.uid_roles.staff1.role = 'member';
  assert.equal((await call(K.kakaoLoginFinish, { body: { code: 'cA' } })).body.profile, null);
});

test('★★★ 본인 이름표 읽기가 실패해도 카카오 인증표는 정상 발급한다', async () => {
  const K = fresh();
  await call(K.kakaoLink, { token: 'staff1', body: { code: 'cA' } });
  const originalRef = world.database.ref;
  world.database.ref = (p) => {
    if (p === 'data/user_dir') throw new Error('명부 연결 실패');
    return originalRef(p);
  };
  const r = await call(K.kakaoLoginFinish, { body: { code: 'cA' } });
  assert.equal(r.body.token, 'CT:staff1');
  assert.equal(r.body.profile, null);
});

test('★ 로그인 안 한 사람은 연결 못 한다', async () => {
  const K = fresh();
  const r = await call(K.kakaoLink, { body: { code: 'cA' } });
  assert.equal(r.status, 401);
});

/* 대표 지시 2026-09-27 「관리자도 카카오 로그인되게 해라」 — 처음엔 막았으나 뒤집혔다. */
test('★★ 관리자·위임관리인도 연결하고 카카오로 들어온다', async () => {
  const K = fresh();
  const codeOf = { boss: 'cA', deputy: 'cB' };
  for (const uid of ['boss', 'deputy']) {
    const r = await call(K.kakaoLink, { token: uid, body: { code: codeOf[uid] } });
    assert.equal(r.body.ok, true, uid + ' 가 연결을 못 했다');
  }
  for (const uid of ['boss', 'deputy']) {
    const r = await call(K.kakaoLoginFinish, { body: { code: codeOf[uid] } });
    assert.equal(r.body.ok, true, uid + ' 가 카카오로 못 들어왔다');
  }
  assert.deepEqual(issued.map((x) => x.uid), ['boss', 'deputy']);
  assert.equal(issued[0].claims.sid, 'P-001');
});

test('★ 재직자가 아니면(익명·퇴사) 연결도 로그인도 안 된다', async () => {
  const K = fresh({ kakao_links: { '333': { uid: 'gone' } } });
  assert.equal((await call(K.kakaoLink, { token: 'anon-xyz', body: { code: 'cA' } })).status, 403);
  assert.equal((await call(K.kakaoLink, { token: 'gone', body: { code: 'cB' } })).status, 403);
  assert.equal((await call(K.kakaoLoginFinish, { body: { code: 'cC' } })).status, 403);
  assert.equal(issued.length, 0);
});

test('★★ 다른 카카오로 바꿔 연결하면 옛 카카오로는 더 못 들어온다', async () => {
  const K = fresh();
  await call(K.kakaoLink, { token: 'staff1', body: { code: 'cA' } });
  const firstKey = world.data.uid_kakao.staff1.linkKey;
  await call(K.kakaoLink, { token: 'staff1', body: { code: 'cB' } });
  assert.equal(world.data.kakao_links[firstKey], undefined, '옛 카카오 길이 남았다');
  assert.equal((await call(K.kakaoLoginFinish, { body: { code: 'cA' } })).status, 400);
  assert.equal((await call(K.kakaoLoginFinish, { body: { code: 'cB' } })).body.ok, true);
});

test('★★ 같은 직원이 두 창에서 다른 카카오를 동시에 연결해도 로그인 길은 하나뿐이다', async () => {
  const K = fresh();
  const results = await Promise.all([
    call(K.kakaoLink, { token: 'staff1', body: { code: 'cA' } }),
    call(K.kakaoLink, { token: 'staff1', body: { code: 'cB' } }),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  const mine = Object.values(world.data.kakao_links || {}).filter((v) => v && v.uid === 'staff1');
  assert.equal(mine.length, 1, '동시 연결 뒤 카카오 로그인 길이 둘 남았다');
});

test('남의 직원에 이미 붙은 카카오는 연결 못 한다', async () => {
  const K = fresh();
  await call(K.kakaoLink, { token: 'staff1', body: { code: 'cA' } });
  const r = await call(K.kakaoLink, { token: 'staff2', body: { code: 'cA' } });
  assert.equal(r.status, 409);
});

test('★ 끊으면 두 자리 다 지워지고, 남의 것은 관리자만 끊는다', async () => {
  const K = fresh();
  await call(K.kakaoLink, { token: 'staff1', body: { code: 'cA' } });
  assert.equal((await call(K.kakaoUnlink, { token: 'staff2', body: { uid: 'staff1' } })).status, 403);
  assert.equal((await call(K.kakaoUnlink, { token: 'deputy', body: { uid: 'staff1' } })).body.ok, true);
  assert.equal(world.data.uid_kakao && world.data.uid_kakao.staff1, undefined);
  assert.equal(world.data.kakao_links && world.data.kakao_links['111'], undefined);
});

test('카카오가 인가코드를 거절하면 성공 처리하지 않는다', async () => {
  const K = fresh();
  const r = await call(K.kakaoLoginFinish, { body: { code: 'nope' } });
  assert.equal(r.status, 400);
  assert.equal(issued.length, 0);
});

test('★★ 서버 비밀값이 깨져 있으면(???+줄바꿈) 카카오로 보내지 않고 까닭을 말한다', async () => {
  const K = fresh();
  const keep = [process.env.KAKAO_REST_KEY, process.env.KAKAO_CLIENT_SECRET];
  try {
    process.env.KAKAO_REST_KEY = '???_????\r\n';
    const r1 = await new Promise((resolve) => {
      const res = { _s: 200, set() {}, status(s) { this._s = s; return this; }, json(j) { resolve({ status: this._s, body: j }); }, send() {} };
      K.kakaoAuthUrl({ method: 'GET', headers: {}, query: { state: 'x' } }, res);
    });
    assert.equal(r1.status, 500);
    assert.ok(!r1.body.url, '깨진 키로 카카오 주소를 내줬다');
    assert.match(r1.body.error, /KAKAO_REST_KEY/);
    process.env.KAKAO_REST_KEY = keep[0];
    process.env.KAKAO_CLIENT_SECRET = '???_????';
    const r2 = await call(K.kakaoLoginFinish, { body: { code: 'cA' } });
    assert.equal(r2.status, 500);
    assert.equal(issued.length, 0);
  } finally { process.env.KAKAO_REST_KEY = keep[0]; process.env.KAKAO_CLIENT_SECRET = keep[1]; }
});

test('앞뒤 줄바꿈만 붙은 진짜 키는 걷어서 쓴다', async () => {
  const K = fresh();
  const keep = process.env.KAKAO_REST_KEY;
  try {
    process.env.KAKAO_REST_KEY = keep + '\r\n';
    const r = await new Promise((resolve) => {
      const res = { _s: 200, set() {}, status(s) { this._s = s; return this; }, json(j) { resolve({ status: this._s, body: j }); }, send() {} };
      K.kakaoAuthUrl({ method: 'GET', headers: {}, query: { state: 'x' } }, res);
    });
    assert.equal(new URL(r.body.url).searchParams.get('client_id'), keep);
  } finally { process.env.KAKAO_REST_KEY = keep; }
});

/* ── 화면 (js/pu-kakao.js) ──────────────────────────────────────────── */
function clientWith(href, stored) {
  const store = Object.assign({}, stored || {});
  const box = {
    URL, JSON, String, Array, Uint8Array, Date, Promise,
    sessionStorage: {
      getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; },
    },
    crypto: { getRandomValues: (a) => { for (let i = 0; i < a.length; i++) a[i] = (i * 37 + 11) & 255; return a; } },
    location: { href }, history: { replaceState() {} },
    fetch: async () => ({ status: 200, text: async () => JSON.stringify({ ok: true, url: 'https://kauth.kakao.com/x', state: shapedState() }) }),
  };
  box.window = box;
  vm.createContext(box);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'pu-kakao.js'), 'utf8'), box);
  return { K: box.PuKakao, store, box };
}

test('★★ 화면 — 내가 보낸 state 와 다르면 code 를 서버로 넘기지 않는다', () => {
  const st = JSON.stringify({ mode: 'link', sid: 'P-101', nonce: 'abc123' });
  const good = clientWith('https://nabaho.github.io/pureunall/enter.html?code=C1&state=abc123', { pu_kakao_state: st });
  assert.deepEqual(JSON.parse(JSON.stringify(good.K.pending())), { code: 'C1', mode: 'link', sid: 'P-101' });
  const bad = clientWith('https://nabaho.github.io/pureunall/enter.html?code=C1&state=link', { pu_kakao_state: st });
  const p = bad.K.pending();
  assert.ok(p.error && !p.code, '남이 만든 복귀 주소를 받아들였다');
});

test('★ 화면 — 서버가 준 state 를 그대로 보관하고 mode 만 서버에 부탁한다', async () => {
  const c = clientWith('https://nabaho.github.io/pureunall/enter.html');
  let asked = '';
  const state = shapedState('link', 'S');
  c.box.fetch = async (u) => { asked = u; return { status: 200, text: async () => JSON.stringify({ ok: true, url: 'https://kauth.kakao.com/x', state }) }; };
  await c.K.goLink('P-101');
  assert.equal(new URL(asked).searchParams.get('mode'), 'link');
  assert.equal(new URL(asked).searchParams.get('state'), null, '화면이 state 를 만들어 서버에 강요한다');
  assert.equal(JSON.parse(c.store.pu_kakao_state).nonce, state);
});

test('★★ 서버 — state 는 서버가 발급하고 한 번만 쓸 수 있으며 용도가 바뀌지 않는다', async () => {
  const K = fresh();
  const issuedState = await authUrl(K, { mode: 'login' });
  const state = issuedState.body.state;
  /* 셋째 조각 = 출처 번호(o0·o1) + 무작위 32자 — 출처를 안 밝힌 요청은 옛 출처(o0) (2026-11-15 ERP 주소 이사) */
  assert.match(state, /^login\.\d{13}\.o0[A-Za-z0-9_-]{32}\.[A-Za-z0-9_-]{43}$/);
  assert.equal(new URL(issuedState.body.url).searchParams.get('state'), state);
  const first = await call(K.kakaoLoginFinish, { body: { code: 'cA', state } });
  assert.equal(first.body.needLink, true, '처음 요청이 state 문턱을 못 넘었다');
  const replay = await call(K.kakaoLoginFinish, { body: { code: 'cA', state } });
  assert.match(replay.body.error, /이미 사용|만료/, '한 번 쓴 state 를 다시 받았다');

  const loginState = (await authUrl(K, { mode: 'login' })).body.state;
  const wrongMode = await call(K.kakaoLink, { token: 'staff1', body: { code: 'cA', state: loginState } });
  assert.match(wrongMode.body.error, /이미 사용|만료/, '로그인용 state 로 계정 연결을 했다');
});

test('★★ 서버 — 만료된 state 와 오래된 세션·카카오 세션으로는 계정을 연결하지 않는다', async () => {
  const K = fresh();
  const state = signedState('link', Date.now() - 11 * 60 * 1000);
  const expired = await call(K.kakaoLink, { token: 'staff1', body: { code: 'cA', state } });
  assert.match(expired.body.error, /이미 사용|만료/);
  assert.equal((await call(K.kakaoLink, { token: 'staff1:old', body: { code: 'cA' } })).status, 401);
  assert.equal((await call(K.kakaoLink, { token: 'staff1:kakao', body: { code: 'cA' } })).status, 401);
});

test('★★ 화면 — 복귀 state 를 code 와 함께 서버에 보내고 한 번 보낸 뒤 지운다', async () => {
  const state = shapedState('login', 'R');
  const c = clientWith('https://nabaho.github.io/pureunall/enter.html?code=C1&state=' + state,
    { pu_kakao_state: JSON.stringify({ mode: 'login', sid: '', nonce: state }) });
  const bodies = [];
  c.box.fetch = async (u, o) => { bodies.push(JSON.parse(o.body)); return { status: 200, text: async () => '{"ok":true,"token":"T"}' }; };
  assert.equal(c.K.pending().code, 'C1');
  await c.K.loginFinish('C1');
  assert.deepEqual(JSON.parse(JSON.stringify(bodies[0])), { code: 'C1', state });
  await c.K.loginFinish('C1');
  assert.equal(bodies[1].state, '', '같은 state 를 화면이 다시 보냈다');
});

/* ── 노란 단추가 «아직 연결 안 됨» 이면 → 비밀번호로 들어오자마자 연결을 권한다 ──
   2026-09-27 대표님이 노란 단추만 거듭 누르고 「내 정보 › 카카오 연결」 은 끝내 못 찾았다.
   따로 찾아가야 하는 길은 없는 길과 같다 — 그래서 이어 준다. */
test('★ 서버 — 연결 안 된 카카오면 needLink 표시만 주고 회원번호는 싣지 않는다', async () => {
  const K = fresh();
  const r = await call(K.kakaoLoginFinish, { body: { code: 'cA' } });
  assert.equal(r.status, 400);
  assert.equal(r.body.needLink, true);
  /* 글자만 본다 — 응답에 시각 같은 숫자가 들어와도 «111» 에 우연히 걸리지 않게(아래 기록속글자들 설명 참고) */
  assert.deepEqual(기록속글자들(r.body).filter((s) => s.includes('111')), [], '카카오 회원번호가 화면으로 나갔다');
  assert.equal(issued.length, 0);
});

test('★ 화면 — 서버의 needLink 표시가 오류에 실려 온다', async () => {
  const c = clientWith('https://nabaho.github.io/pureunall/enter.html');
  c.box.fetch = async () => ({ status: 400, text: async () => JSON.stringify({ ok: false, needLink: true, error: 'x' }) });
  await assert.rejects(() => c.K.loginFinish('C1'), (e) => e.needLink === true);
  c.box.fetch = async () => ({ status: 400, text: async () => JSON.stringify({ ok: false, error: 'y' }) });
  await assert.rejects(() => c.K.loginFinish('C1'), (e) => e.needLink === false);
});

function enterFn(name) {
  const src = fs.readFileSync(path.join(ROOT, 'enter.html'), 'utf8');
  const at = src.indexOf('function ' + name + '(');
  assert.ok(at > 0, name + ' 를 못 찾았다');
  let i = src.indexOf('{', at), depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) break; }
  }
  return src.slice(at, i + 1);
}
function memStore(seed) {
  const store = Object.assign({}, seed || {});
  return { store, api: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } } };
}
function afterLoginBox({ want, linked }) {
  const m = memStore(want != null ? { pu_kakao_want_link: String(want) } : {});
  const box = {
    Date, Number, String, Promise,
    KK_WANT: 'pu_kakao_want_link',
    sessionStorage: m.api,
    auth: { currentUser: { uid: 'u1' } },
    db: { ref: () => ({ once: () => Promise.resolve({ val: () => (linked ? { kakaoId: '111' } : null) }) }) },
    started: 0,
  };
  box.kkToast = () => {};
  box.kkStartLink = () => { box.started++; };
  vm.createContext(box);
  vm.runInContext(enterFn('kkAfterLogin'), box);
  return { box, store: m.store };
}
const tick = () => new Promise((r) => setTimeout(r, 0));

test('★★ 화면 — 노란 단추가 «연결 안 됨» 이었으면 비밀번호 확인 뒤 자동으로 연결을 시작한다', async () => {
  const a = afterLoginBox({ want: Date.now(), linked: false });
  a.box.kkAfterLogin(); await tick();
  assert.equal(a.box.started, 1, '연결을 시작하지 않았다');
  assert.equal(a.store.pu_kakao_want_link, undefined, '표시가 남아 다음 로그인에 또 묻는다');
  a.box.kkAfterLogin(); await tick();
  assert.equal(a.box.started, 1, '한 번 시작한 뒤 또 시작했다');
});

test('★★ 화면 — 자동 연결 중에는 다시 묻는 확인창이 없다', () => {
  const src = enterFn('kkAfterLogin');
  assert.doesNotMatch(src, /confirm\s*\(/);
  assert.match(src, /kkStartLink\(\)/);
});

test('★ 화면 — 자동으로 잇지 않을 때: 표시 없음 · 15분 넘음 · 이미 연결됨', async () => {
  const cases = [
    ['표시 없음', { want: null, linked: false }],
    ['15분 넘음', { want: Date.now() - 16 * 60 * 1000, linked: false }],
    ['이미 연결됨', { want: Date.now(), linked: true }],
  ];
  for (const [why, o] of cases) {
    const a = afterLoginBox(o);
    a.box.kkAfterLogin(); await tick();
    assert.equal(a.box.started, 0, why + ' 인데 연결을 시작했다');
  }
});

test('★ 화면 — needLink 로 실패했을 때만 표시를 남기고, 포털이 뜰 때 kkAfterLogin 을 부른다', async () => {
  for (const need of [true, false]) {
    const m = memStore();
    const box = {
      Promise, String, Date, setTimeout, clearTimeout,
      KK_WANT: 'pu_kakao_want_link', _freshLogin: false,
      _persistenceReady: Promise.resolve(), _persistenceBootError: null,
      sessionStorage: m.api,
      PuKakao: {
        pending: () => ({ code: 'C1', mode: 'login' }),
        loginFinish: () => { const e = new Error('x'); e.needLink = need; return Promise.reject(e); },
      },
      firebase: { auth: { Auth: { Persistence: { LOCAL: 'local', SESSION: 'session' } } } },
      localStorage: { getItem: () => null },
      db: { ref: () => ({ once: () => Promise.resolve(null) }) },
      auth: { setPersistence: () => Promise.resolve() }, reportLogin() {}, shown: '',
      // 실패하면 접힌 비밀번호 칸을 편다(카카오 먼저, 2026-09-27) — 그 자체는 kakao-first-login.test.js 가 본다
      kkUnfoldPw() {}, kkMarkUsed() {}, kkEndReturn() {},
    };
    box.window = box;
    box.showErr = (msg) => { box.shown = msg; };
    vm.createContext(box);
    vm.runInContext(enterFn('kkHandleReturn'), box);
    box.kkHandleReturn(); await tick(); await tick();
    assert.equal('pu_kakao_want_link' in m.store, need, 'needLink=' + need + ' 인데 표시가 어긋났다');
    assert.equal(box.shown, 'x');
  }
  const portal = enterFn('renderPortal').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  assert.match(portal, /kkAfterLogin\(\)/, '포털이 떠도 연결을 권하지 않는다');
});

/* ── 공용 PC — 앞 사람의 카카오로 들어가지 않는다 (대표 「추천대로」 2026-09-28) ──────────
   ① 처음 쓰는 기기에서는 카카오가 «다시 묻게» 한다(prompt=login).
   ② 로그아웃은 «이 브라우저의 카카오» 도 끊는다(카카오 로그아웃 주소). */
function authUrl(K, query) {
  return new Promise((resolve) => {
    const res = { _s: 200, set() {}, status(s) { this._s = s; return this; }, json(j) { resolve({ status: this._s, body: j }); }, send() {} };
    K.kakaoAuthUrl({ method: 'GET', headers: {}, query }, res);
  });
}

test('★★ 서버 — prompt=login 을 달라면 카카오 주소에 싣고, 안 달라면 안 싣는다', async () => {
  const K = fresh();
  const ask = await authUrl(K, { state: 'x', prompt: 'login' });
  assert.equal(new URL(ask.body.url).searchParams.get('prompt'), 'login',
    '★★ 처음 쓰는 기기인데 카카오가 안 묻는다 — 공용 PC 에 남은 앞 사람 카카오로 들어간다');
  const plain = await authUrl(K, { state: 'x' });
  assert.equal(new URL(plain.body.url).searchParams.get('prompt'), null, '내 기기에서까지 매번 묻는다');
  /* 'login' 밖의 값(none·consent 등)은 버린다 — 화면이 보낸 것을 그대로 카카오에 넘기지 않는다 */
  const odd = await authUrl(K, { state: 'x', prompt: 'none' });
  assert.equal(new URL(odd.body.url).searchParams.get('prompt'), null, '모르는 prompt 값을 그대로 넘겼다');
});

test('★★ 서버 — 로그아웃 주소는 카카오 로그아웃으로 가서 포털로 돌아온다', async () => {
  const K = fresh();
  const r = await authUrl(K, { kind: 'logout' });
  const u = new URL(r.body.url);
  assert.equal(u.origin + u.pathname, 'https://kauth.kakao.com/oauth/logout', '카카오 로그아웃 주소가 아니다');
  assert.equal(u.searchParams.get('client_id'), process.env.KAKAO_REST_KEY);
  assert.equal(u.searchParams.get('logout_redirect_uri'), 'https://nabaho.github.io/pureunall/enter.html',
    '돌아올 곳이 로그인 복귀 주소와 다르다 — 카카오 콘솔에 등록한 곳과 어긋난다');
});

test('★ 화면 부품 — goLogin({ask}) 은 prompt=login 을 서버에 부탁하고, logoutUrl 은 로그아웃 주소를 묻는다', async () => {
  const c = clientWith('https://nabaho.github.io/pureunall/enter.html');
  const asked = [];
  /* ⚠ 2026-09-29: 노란 단추가 로그인 서버를 «미리 깨운다»(?warm=1) — 그 부름은 빼고 센다 */
  c.box.fetch = async (u) => { if (!/warm=1/.test(u)) asked.push(u); return { status: 200, text: async () => JSON.stringify({ ok: true, url: 'https://kauth.kakao.com/x', state: shapedState('login', 'T') }) }; };
  await c.K.goLogin({ ask: true });
  await c.K.goLogin();
  await c.K.logoutUrl();
  assert.equal(new URL(asked[0]).searchParams.get('prompt'), 'login', '「다시 묻기」를 서버에 안 부탁한다');
  assert.equal(new URL(asked[1]).searchParams.get('prompt'), null);
  assert.equal(new URL(asked[2]).searchParams.get('kind'), 'logout');
});

/* ── 실패한 카카오 로그인도 «로그인 감시» 에 남는다 (대표 「추천대로」 2026-09-29) ──────────
   카카오 실패는 서버가 카카오에 직접 물어 안 것이라 믿을 수 있다 — 서버가 바로 적는다. */
const 기록들 = (key) => Object.values((world.data.login_events || {})[key] || {});
const 모든기록키 = () => Object.keys(world.data.login_events || {});

/* 기록에 실린 «글자»만 모은다 — 열쇠와 글자값, 숫자는 뺀다.
   ⚠ 2026-10-04: 여기서 JSON.stringify(기록).includes('111') 로 보다가 CI 가 통째로 멎었다.
     기록에는 시각(Date.now())이 숫자로 들어 있는데, 2026-10-04 10:33~13:20(UTC) 동안
     그 숫자가 1791110… 이라 «111» 을 품는다. 회원번호와 아무 상관없는 우연이다.
     이 창은 되풀이해서 돌아온다(시각 숫자에 111 이 드는 동안마다) — 그때마다 모든
     PR 이 막힌다. 그래서 «숫자»가 아니라 «글자»만 본다: 회원번호가 샌다면 반드시
     글자값이나 열쇠로 샌다. */
function 기록속글자들(값, 모은것) {
  모은것 = 모은것 || [];
  if (값 === null || 값 === undefined) return 모은것;
  if (typeof 값 === 'string') { 모은것.push(값); return 모은것; }
  if (typeof 값 !== 'object') return 모은것;          // 숫자·참거짓은 안 본다
  Object.keys(값).forEach((k) => { 모은것.push(k); 기록속글자들(값[k], 모은것); });
  return 모은것;
}

test('★★ 연결 안 된 카카오로 들어오려 하면 기록이 남는다 — 회원번호 원문은 안 남는다', async () => {
  const K = fresh();
  const r = await call(K.kakaoLoginFinish, { body: { code: 'cA' } });
  assert.equal(r.body.needLink, true);
  const keys = 모든기록키();
  assert.equal(keys.length, 1, '★★ 모르는 카카오로 들어오려 한 흔적이 안 남습니다');
  assert.match(keys[0], /^kakao_[0-9a-f]{16}$/);
  const ev = 기록들(keys[0])[0];
  assert.equal(ev.ok, false);
  assert.equal(ev.code, 'kakao-unlinked');
  const 샌곳 = 기록속글자들(world.data.login_events).filter((s) => s.includes('111'));
  assert.deepEqual(샌곳, [], '★ 카카오 회원번호 원문이 기록에 남았습니다');
  assert.equal(world.data.systemAlerts, undefined, '연결 전 새 직원도 이 길을 지난다 — 알림까지 울리면 잔소리가 된다');
});

test('★★ 퇴사·휴직 계정이 카카오로 들어오려 하면 기록 + 알림', async () => {
  const K = fresh({ kakao_links: { '333': { uid: 'gone', sid: 'P-900' } },
    data: { user_dir: { v: [ { sid: 'P-900', name: '나간사람', role: 'member', status: 'retired' } ] } } });
  const r = await call(K.kakaoLoginFinish, { body: { code: 'cC' } });
  assert.equal(r.status, 403);
  const ev = 기록들('gone')[0];
  assert.ok(ev, '★★ 나간 사람이 들어오려 한 흔적이 안 남습니다');
  assert.equal(ev.code, 'kakao-inactive');
  const al = Object.values((world.data.systemAlerts || {}).gone || {})[0];
  assert.ok(al, '★★ 나간 사람이 들어오려 했는데 알림이 없습니다');
  assert.equal(al.kind, 'security-kakao-inactive');
  /* 누구인지는 «이름»으로 — 사번은 로그인 아이디가 되므로 알림 글에 적지 않는다 (대표 결정 2026-10-25) */
  assert.match(al.message, /나간사람/, '누구인지(이름) 알림에 없습니다');
  assert.doesNotMatch(al.message, /P-?900/i, '알림 글에 사번이 새고 있습니다');
  assert.equal(issued.length, 0, '표를 내줬습니다');
});

test('★ 성공한 카카오 로그인은 서버가 실패로 적지 않는다(성공 보고는 화면이 증표와 함께 한다)', async () => {
  const K = fresh({ kakao_links: { '111': { uid: 'staff1', sid: 'P-101' } } });
  const r = await call(K.kakaoLoginFinish, { body: { code: 'cA' } });
  assert.equal(r.body.ok, true);
  assert.equal(모든기록키().length, 0, '성공했는데 실패 기록이 남았습니다');
});

test('★★ 기록이 실패해도 로그인 응답은 그대로 간다', async () => {
  const K = fresh();
  world.pushFails = true;
  const r = await call(K.kakaoLoginFinish, { body: { code: 'cA' } });
  assert.equal(r.status, 400);
  assert.equal(r.body.needLink, true, '★★ 감시 기록이 막혀 로그인 안내가 안 갑니다');
});


/* ══════ 2026-11-15 ERP 주소 이사 — 옛(nabaho.github.io/pureunall)·새(erp.pureunlabor.co.kr) 두 출처 ══════
   GitHub 에서 도메인을 켜는 순간 옛 주소는 301 로 바뀐다. 그 순간 앞뒤로 카카오 로그인이 끊기지 않으려면
   ① 두 출처 모두 받아 주고 ② 돌아올 주소는 «시작한 출처»의 것이고 ③ code 교환은 인가 때와 «같은» 주소를 써야 한다
   (카카오는 둘이 다르면 거절한다). 전환 순간 교환 요청이 다른 출처에서 와도 state 에 서명된 번호를 따른다. */
const NEW_ORIGIN = 'https://erp.pureunlabor.co.kr';
const OLD_ORIGIN = 'https://nabaho.github.io';

function reqFrom(handler, { origin, method = 'GET', query = {}, body, token } = {}) {
  return new Promise((resolve) => {
    const headers = {};
    const req = { method, headers: Object.assign(origin ? { origin } : {}, token ? { authorization: 'Bearer ' + token } : {}), body: body || {}, query };
    const res = {
      _s: 200, set(k, v) { headers[k] = v; }, status(s) { this._s = s; return this; },
      json(j) { resolve({ status: this._s, body: j, headers }); }, send() { resolve({ status: this._s, headers }); },
    };
    handler(req, res);
  });
}
async function exchangedRedirects(run) {
  const seen = []; const orig = global.fetch;
  global.fetch = async (url, opts) => {
    if (String(url).startsWith('https://kauth.kakao.com/oauth/token')) seen.push(new URLSearchParams(opts.body).get('redirect_uri'));
    return orig(url, opts);
  };
  try { await run(); } finally { global.fetch = orig; }
  return seen;
}

test('★★ 새 출처에서 시작하면 돌아올 주소도 새 출처 — code 교환도 «같은» 주소다(교환이 옛 출처에서 와도)', async () => {
  const K = fresh();
  const a = await reqFrom(K.kakaoAuthUrl, { origin: NEW_ORIGIN, query: { mode: 'login' } });
  assert.equal(new URL(a.body.url).searchParams.get('redirect_uri'), NEW_ORIGIN + '/enter.html',
    '★★ 새 출처에서 눌렀는데 옛 주소로 돌아간다');
  const seen = await exchangedRedirects(() => reqFrom(K.kakaoLoginFinish, { origin: OLD_ORIGIN, method: 'POST', body: { code: 'cA', state: a.body.state } }));
  assert.deepEqual(seen, [NEW_ORIGIN + '/enter.html'],
    '★★ 교환 때 돌아올 주소가 인가 때와 다르다 — 카카오가 거절해 로그인이 막힌다');
});

test('★ 옛 출처에서 시작하면 전과 같은 주소(/pureunall/enter.html) — 교환도 같은 주소', async () => {
  const K = fresh();
  const a = await reqFrom(K.kakaoAuthUrl, { origin: OLD_ORIGIN, query: { mode: 'login' } });
  assert.equal(new URL(a.body.url).searchParams.get('redirect_uri'), OLD_ORIGIN + '/pureunall/enter.html');
  const seen = await exchangedRedirects(() => reqFrom(K.kakaoLoginFinish, { origin: NEW_ORIGIN, method: 'POST', body: { code: 'cA', state: a.body.state } }));
  assert.deepEqual(seen, [OLD_ORIGIN + '/pureunall/enter.html']);
});

test('★ 이 배포 전에 받은 옛 꼴 state(출처 번호 없음)도 그대로 받는다 — 옛 출처 주소로 교환', async () => {
  const K = fresh();
  const seen = await exchangedRedirects(() => reqFrom(K.kakaoLoginFinish, { origin: NEW_ORIGIN, method: 'POST', body: { code: 'cA', state: signedState('login') } }));
  assert.deepEqual(seen, [OLD_ORIGIN + '/pureunall/enter.html'], '배포하는 순간 진행 중이던 로그인이 끊긴다');
});

test('★★ 출처 번호는 서명 안에 든다 — o1 을 o0 으로 바꿔 치면 받지 않는다', async () => {
  const K = fresh();
  const a = await reqFrom(K.kakaoAuthUrl, { origin: NEW_ORIGIN, query: { mode: 'login' } });
  const parts = a.body.state.split('.');
  assert.equal(parts[2].slice(0, 2), 'o1', '새 출처 번호가 state 에 안 실렸다');
  parts[2] = 'o0' + parts[2].slice(2);
  const r = await reqFrom(K.kakaoLoginFinish, { origin: NEW_ORIGIN, method: 'POST', body: { code: 'cA', state: parts.join('.') } });
  assert.match(String(r.body.error), /이미 사용|만료/, '★★ 서명 밖에서 출처를 바꿔 치기 할 수 있다');
});

test('★★ 서버가 주는 state 는 «두 출처 모두» 화면(js/pu-kakao.js)의 모양 검사를 통과한다', async () => {
  /* 화면은 state 모양이 이상하면 「요청번호를 받지 못했습니다」로 카카오 로그인을 통째로 막는다 —
     서버가 모양을 바꾸면 화면 정규식이 그대로인지 «돌려서» 본다. */
  const src = fs.readFileSync(path.join(ROOT, 'js', 'pu-kakao.js'), 'utf8');
  const m = /if \(!j\.state \|\| !(\/\^\(login\|link\)[^\n]*?\$\/)\.test\(/.exec(src);
  assert.ok(m, '화면의 state 모양 검사를 못 찾았다');
  const re = vm.runInNewContext(m[1]);
  const K = fresh();
  for (const origin of [OLD_ORIGIN, NEW_ORIGIN, '']) {
    for (const mode of ['login', 'link']) {
      const a = await reqFrom(K.kakaoAuthUrl, { origin, query: { mode } });
      assert.ok(re.test(a.body.state), '★★ ' + (origin || '출처 없음') + ' ' + mode + ' state 를 화면이 거절한다: ' + a.body.state);
    }
  }
});

test('★ 로그아웃 돌아올 주소도 요청 출처를 따른다', async () => {
  const K = fresh();
  const n = await reqFrom(K.kakaoAuthUrl, { origin: NEW_ORIGIN, query: { kind: 'logout' } });
  assert.equal(new URL(n.body.url).searchParams.get('logout_redirect_uri'), NEW_ORIGIN + '/enter.html');
  const o = await reqFrom(K.kakaoAuthUrl, { origin: OLD_ORIGIN, query: { kind: 'logout' } });
  assert.equal(new URL(o.body.url).searchParams.get('logout_redirect_uri'), OLD_ORIGIN + '/pureunall/enter.html');
});

test('★★ CORS — 두 출처는 그 값 그대로 열고(Vary), 목록 밖은 안 연다', async () => {
  const K = fresh();
  for (const origin of [OLD_ORIGIN, NEW_ORIGIN]) {
    const r = await reqFrom(K.kakaoAuthUrl, { origin, method: 'OPTIONS' });
    assert.equal(r.headers['Access-Control-Allow-Origin'], origin);
    assert.equal(r.headers['Vary'], 'Origin');
  }
  for (const origin of ['https://evil.example', 'http://nabaho.github.io', 'https://erp.pureunlabor.co.kr.evil.example', 'null']) {
    const r = await reqFrom(K.kakaoAuthUrl, { origin, method: 'OPTIONS' });
    assert.equal(r.headers['Access-Control-Allow-Origin'], undefined, '★★ 남의 출처(' + origin + ')에 문을 열었다');
  }
});

test('★★ 계정 «연결»도 — 새 출처에서 시작하면 교환이 새 출처 주소를 쓴다', async () => {
  const K = fresh();
  const a = await reqFrom(K.kakaoAuthUrl, { origin: NEW_ORIGIN, query: { mode: 'link' } });
  assert.equal(new URL(a.body.url).searchParams.get('redirect_uri'), NEW_ORIGIN + '/enter.html');
  const seen = await exchangedRedirects(() => reqFrom(K.kakaoLink, { origin: NEW_ORIGIN, method: 'POST', token: 'staff1', body: { code: 'cA', state: a.body.state } }));
  assert.deepEqual(seen, [NEW_ORIGIN + '/enter.html'], '★★ 연결 교환 주소가 인가 때와 다르다 — 카카오가 거절해 연결이 막힌다');
});

/* 서명 마지막 글자의 «쓰지 않는 비트»만 바꾼 다른 글자 — 풀면 같은 바이트가 된다 */
function 같은바이트다른글자(sig) {
  const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const last = sig.charAt(sig.length - 1);
  const other = ABC.charAt(ABC.indexOf(last) ^ 1);
  return sig.slice(0, -1) + other;
}

test('★★ 서명 «다른 글자 같은 바이트»로 한 번 쓴 state 를 다시 쓰지 못한다 (2026-11-15 보안 검토 중간 1)', async () => {
  const K = fresh();
  const a = await reqFrom(K.kakaoAuthUrl, { origin: NEW_ORIGIN, query: { mode: 'login' } });
  const parts = a.body.state.split('.');
  const 변형 = parts.slice(0, 3).concat([같은바이트다른글자(parts[3])]).join('.');
  assert.notEqual(변형, a.body.state);
  assert.deepEqual(Buffer.from(변형.split('.')[3], 'base64url'), Buffer.from(parts[3], 'base64url'), '시험 밑감이 «같은 바이트»가 아니다');
  const first = await reqFrom(K.kakaoLoginFinish, { origin: NEW_ORIGIN, method: 'POST', body: { code: 'cA', state: a.body.state } });
  assert.equal(first.body.needLink, true, '처음 요청이 state 문턱을 못 넘었다');
  const replay = await reqFrom(K.kakaoLoginFinish, { origin: NEW_ORIGIN, method: 'POST', body: { code: 'cA', state: 변형 } });
  assert.match(String(replay.body.error), /이미 사용|만료/, '★★ 서명 글자만 비틀어 같은 state 를 한 번 더 썼다');
});
