'use strict';
/* 카카오로 로그인 (대표 지시 2026-09-27 「로그인기능을 카카오톡과 연결시킬수 있나?」 → 「추천대로」)

   ★ 서버 함수(functions/kakao.js)를 «실제로 돌려» 본다 — 카카오 서버·DB·인증은 가짜로 세운다.
     글자로만 보면 조건 하나가 빠져도 이름만 맞으면 통과해 버린다.

   못 박는 것(규칙):
   ① 관리자(위임관리인 포함)는 카카오로 로그인도 연결도 못 한다 — 비밀번호로만.
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
      };
    },
  };
  return { data, database };
}

/* 가짜 인증 — 증표 글자가 곧 uid 다 */
const issued = [];
const fakeAuth = {
  verifyIdToken: async (tok) => { if (!tok || tok === 'bad') throw new Error('bad'); return { uid: tok }; },
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

function call(handler, { token, body } = {}) {
  return new Promise((resolve) => {
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
  assert.equal(world.data.kakao_links['111'].uid, 'staff1');
  const r2 = await call(K.kakaoLoginFinish, { body: { code: 'cA' } });
  assert.equal(r2.body.ok, true);
  assert.deepEqual(issued[0], { uid: 'staff1', claims: { kakao: true, sid: 'P-101' } });
});

test('★ 로그인 안 한 사람은 연결 못 한다', async () => {
  const K = fresh();
  const r = await call(K.kakaoLink, { body: { code: 'cA' } });
  assert.equal(r.status, 401);
});

test('★★ 관리자·위임관리인은 연결도 로그인도 못 한다', async () => {
  const K = fresh();
  for (const uid of ['boss', 'deputy']) {
    const r = await call(K.kakaoLink, { token: uid, body: { code: 'cA' } });
    assert.equal(r.status, 403, uid + ' 가 연결됐다');
  }
  /* 연결이 (옛 판에서) 이미 있어도 로그인 표는 안 준다 */
  const K2 = fresh({ kakao_links: { '111': { uid: 'deputy' }, '222': { uid: 'boss' } } });
  for (const code of ['cA', 'cB']) {
    const r = await call(K2.kakaoLoginFinish, { body: { code } });
    assert.equal(r.status, 403, code + ' 로 관리자 표가 나갔다');
  }
  assert.equal(issued.length, 0);
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
  await call(K.kakaoLink, { token: 'staff1', body: { code: 'cB' } });
  assert.equal(world.data.kakao_links['111'], undefined, '옛 카카오 길이 남았다');
  assert.equal((await call(K.kakaoLoginFinish, { body: { code: 'cA' } })).status, 400);
  assert.equal((await call(K.kakaoLoginFinish, { body: { code: 'cB' } })).body.ok, true);
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
    fetch: async () => ({ status: 200, text: async () => JSON.stringify({ ok: true, url: 'https://kauth.kakao.com/x' }) }),
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

test('★ 화면 — 카카오로 보낼 때 state 는 맞히기 어려운 값이다(모드 이름이 아니다)', async () => {
  const c = clientWith('https://nabaho.github.io/pureunall/enter.html');
  let asked = '';
  c.box.fetch = async (u) => { asked = u; return { status: 200, text: async () => JSON.stringify({ ok: true, url: 'https://kauth.kakao.com/x' }) }; };
  await c.K.goLink('P-101');
  const sent = new URL(asked).searchParams.get('state');
  assert.ok(sent && sent.length >= 16 && !/^(link|login)$/.test(sent), 'state 가 뻔한 값이다: ' + sent);
  assert.equal(JSON.parse(c.store.pu_kakao_state).nonce, sent);
});
