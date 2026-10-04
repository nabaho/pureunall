/* 구글 캘린더 «늘 연결» — 서버(functions/gcal-link.js) 약속을 실제로 돌려 본다
   대표 지시 2026-10-04 「항상 구글로 로그인되어 있어야 한다 그래야 혼란이 없다」.

   지키는 것
     ① 갱신 열쇠(rt)는 화면에 절대 안 나간다 — 돌려주는 것은 한 시간짜리 표와 메일뿐
     ② 재직자만 연결한다 · 퇴사·휴직하면 표를 안 주고 열쇠를 지운다
     ③ 구글이 열쇠를 버리면(invalid_grant) 지우고 «다시 연결»(need:link) — 성공인 척 안 한다
     ④ «연결 안 됨»은 200+need:link, 진짜 고장은 오류 — 화면이 고장에 연결 창을 띄우지 않게
     ⑤ 연결 요청표(state)는 위조·재사용·남의 것을 못 쓴다
     ⑥ 달력 권한을 끄고 오거나 갱신 열쇠가 없으면 연결하지 않는다
     ⑦ 갱신 열쇠 자리(gcal_tokens)는 보안규칙에 «없어야» 한다(화면이 못 읽게) */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');

function makeWorld(seed) {
  const data = JSON.parse(JSON.stringify(seed || {}));
  function get(p) {
    let cur = data;
    for (const k of p.split('/').filter(Boolean)) { if (cur == null || typeof cur !== 'object') return null; cur = cur[k]; }
    return cur === undefined ? null : cur;
  }
  function set(p, v) {
    const parts = p.split('/').filter(Boolean);
    let cur = data;
    for (let i = 0; i < parts.length - 1; i++) { if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {}; cur = cur[parts[i]]; }
    if (v === null) delete cur[parts[parts.length - 1]]; else cur[parts[parts.length - 1]] = JSON.parse(JSON.stringify(v));
  }
  return { data, database: { ref(p) {
    p = p || '';
    return {
      once: async () => ({ val: () => { const v = get(p); return v == null ? null : JSON.parse(JSON.stringify(v)); } }),
      update: async (o) => { for (const k of Object.keys(o)) set((p ? p + '/' : '') + k, o[k]); },
      set: async (v) => set(p, v),
      remove: async () => set(p, null),
      transaction: async (fn) => {
        const before = get(p); const next = fn(before == null ? null : JSON.parse(JSON.stringify(before)));
        if (next === undefined) return { committed: false };
        set(p, next); return { committed: true };
      },
    };
  } } };
}

let world;
const fakeAuth = { verifyIdToken: async (tok) => { if (!tok || tok === 'bad') throw new Error('bad'); return { uid: tok }; } };

function load() {
  const orig = Module._load;
  Module._load = function (req) {
    if (req === 'firebase-functions/v1') {
      const chain = { region: () => chain, runWith: () => chain, https: { onRequest: (h) => h },
        pubsub: { schedule: () => ({ timeZone: () => ({ onRun: (h) => h }) }) } };
      return chain;
    }
    if (req === 'firebase-admin/auth') return { getAuth: () => fakeAuth };
    if (req === 'firebase-admin/database') return { getDatabase: () => world.database };
    return orig.apply(this, arguments);
  };
  const p = path.join(ROOT, 'functions', 'gcal-link.js');
  delete require.cache[require.resolve(p)];
  try { return require(p); } finally { Module._load = orig; }
}

/* 가짜 구글 — code·열쇠마다 답을 정해 둔다 */
let google, revoked;
const SCOPE = 'https://www.googleapis.com/auth/calendar.events';
global.fetch = async (url, opts) => {
  url = String(url);
  if (url.startsWith('https://oauth2.googleapis.com/token')) {
    const b = new URLSearchParams(opts.body);
    const ans = b.get('grant_type') === 'authorization_code' ? google.codes[b.get('code')] : google.rts[b.get('refresh_token')];
    if (!ans) return { ok: false, status: 400, json: async () => ({ error: 'invalid_grant' }) };
    return { ok: true, status: 200, json: async () => ans };
  }
  if (url.startsWith('https://oauth2.googleapis.com/revoke')) { revoked.push(new URL(url).searchParams.get('token')); return { ok: true }; }
  if (url.startsWith('https://www.googleapis.com/calendar/v3/calendars/primary/events')) {
    return { ok: true, json: async () => ({ summary: 'hong@gmail.com' }) };
  }
  throw new Error('예상 밖 주소: ' + url);
};
const SECRET = 'GOCSPX-FakeSecretForTests12345';

function fresh(extra) {
  world = makeWorld(Object.assign({ uid_roles: {
    staff1: { sid: 'P-101', status: 'active' }, gone: { sid: 'P-900', status: 'retired' } } }, extra || {}));
  google = {
    codes: { cOK: { access_token: 'AT1', expires_in: 3599, refresh_token: 'RT1', scope: SCOPE },
             cNoRT: { access_token: 'AT2', expires_in: 3599, scope: SCOPE },
             cNoCal: { access_token: 'AT3', expires_in: 3599, refresh_token: 'RT3', scope: 'openid' } },
    rts: { RT1: { access_token: 'AT-NEW', expires_in: 3599, scope: SCOPE } },
  };
  revoked = [];
  process.env.GCAL_OAUTH_SECRET = SECRET;
  return load();
}
function call(h, { token, body } = {}) {
  return new Promise((resolve) => {
    const req = { method: 'POST', headers: { origin: 'https://nabaho.github.io', authorization: token ? 'Bearer ' + token : '' }, body: body || {}, query: {} };
    const res = { _s: 200, set() {}, status(s) { this._s = s; return this; },
      json(j) { resolve({ status: this._s, body: j }); }, send() { resolve({ status: this._s }); } };
    h(req, res);
  });
}
async function stateFor(G, uid) {
  const r = await call(G.gcalAuthUrl, { token: uid });
  return new URL(r.body.url).searchParams.get('state');
}

test('① 연결하면 열쇠는 서버에만 — 화면에는 한 시간짜리 표와 메일만 간다', async () => {
  const G = fresh();
  const r = await call(G.gcalLink, { token: 'staff1', body: { code: 'cOK', state: await stateFor(G, 'staff1') } });
  assert.equal(r.body.ok, true);
  assert.equal(r.body.access_token, 'AT1');
  assert.equal(r.body.email, 'hong@gmail.com');
  assert.ok(!JSON.stringify(r.body).includes('RT1'), '★ 갱신 열쇠가 화면으로 나갔습니다');
  assert.equal(world.data.gcal_tokens.staff1.rt, 'RT1');
  assert.equal(world.data.gcal_tokens.staff1.sid, 'P-101', '사번은 명부에서');
  /* 다시 열면 서버가 새 표를 준다 — 이것이 «늘 연결» 이다 */
  const t = await call(G.gcalToken, { token: 'staff1' });
  assert.equal(t.body.ok, true);
  assert.equal(t.body.access_token, 'AT-NEW');
  assert.ok(!JSON.stringify(t.body).includes('RT1'), '★ 표 요청에서 갱신 열쇠가 나갔습니다');
  assert.ok(t.body.expires_at > Date.now());
});

test('② 연결 주소는 오래 가는 열쇠를 청한다(offline + consent) · 달력 권한 하나만', async () => {
  const G = fresh();
  const u = new URL((await call(G.gcalAuthUrl, { token: 'staff1' })).body.url);
  assert.equal(u.searchParams.get('access_type'), 'offline', '갱신 열쇠를 안 청합니다 — 한 시간 뒤 풀립니다');
  assert.equal(u.searchParams.get('prompt'), 'consent', '예전에 동의한 사람은 갱신 열쇠를 다시 못 받습니다');
  assert.equal(u.searchParams.get('response_type'), 'code');
  assert.equal(u.searchParams.get('scope'), SCOPE, '★ 달력 일정 말고 다른 권한을 청합니다');
});

test('③ 재직자만 연결 · 퇴사하면 표를 안 주고 열쇠를 지운다', async () => {
  const G = fresh();
  const r = await call(G.gcalLink, { token: 'gone', body: { code: 'cOK', state: await stateFor(G, 'gone') } });
  assert.equal(r.status, 403);
  assert.equal((world.data.gcal_tokens || {}).gone, undefined);
  /* 연결해 둔 뒤 퇴사 */
  await call(G.gcalLink, { token: 'staff1', body: { code: 'cOK', state: await stateFor(G, 'staff1') } });
  world.data.uid_roles.staff1.status = 'retired';
  const t = await call(G.gcalToken, { token: 'staff1' });
  assert.equal(t.body.ok, false);
  assert.equal(t.body.need, 'link');
  assert.equal(world.data.gcal_tokens.staff1, undefined, '★ 퇴사자 열쇠가 남았습니다');
  assert.ok(revoked.includes('RT1'), '구글에도 열쇠를 돌려줘야 합니다');
});

test('③-2 매일 훑기 — 다시 안 여는 퇴사자 열쇠도 지운다', async () => {
  const G = fresh({ gcal_tokens: { staff1: { rt: 'RT1' }, gone: { rt: 'RTX' } } });
  await G.gcalTokenSweep();
  assert.equal(world.data.gcal_tokens.gone, undefined, '★ 퇴사자 열쇠가 남았습니다');
  assert.equal(world.data.gcal_tokens.staff1.rt, 'RT1', '재직자 열쇠를 지웠습니다');
  assert.ok(revoked.includes('RTX'));
});

test('④ 구글이 열쇠를 버리면 지우고 «다시 연결» — 성공인 척 안 한다', async () => {
  const G = fresh({ gcal_tokens: { staff1: { rt: 'RT-DEAD' } } });
  const t = await call(G.gcalToken, { token: 'staff1' });
  assert.equal(t.status, 200);
  assert.equal(t.body.ok, false);
  assert.equal(t.body.need, 'link');
  assert.equal(world.data.gcal_tokens.staff1, undefined);
});

test('④-2 «연결 안 됨»(need:link) 과 «고장»을 가른다', async () => {
  const G = fresh();
  const none = await call(G.gcalToken, { token: 'staff1' });
  assert.equal(none.status, 200);
  assert.equal(none.body.need, 'link');
  process.env.GCAL_OAUTH_SECRET = '';
  const broke = await call(G.gcalToken, { token: 'staff1' });
  assert.equal(broke.status, 500);
  assert.notEqual(broke.body.need, 'link', '★ 서버 고장에 «연결하세요» 창이 뜹니다');
  const anon = await call(G.gcalToken, {});
  assert.equal(anon.status, 401);
});

test('⑤ 연결 요청표 — 위조·재사용·남의 것은 안 된다', async () => {
  const G = fresh({ uid_roles: { staff1: { sid: 'P-101', status: 'active' }, staff2: { sid: 'P-102', status: 'active' } } });
  const s = await stateFor(G, 'staff1');
  /* 남의 요청표 */
  const other = await call(G.gcalLink, { token: 'staff2', body: { code: 'cOK', state: s } });
  assert.equal(other.status, 400, '★ 남이 받은 요청표로 내 계정에 붙었습니다');
  /* 위조 — 서명만 바꿈 */
  const bits = s.split('.'); bits[4] = crypto.randomBytes(32).toString('base64url');
  const forged = await call(G.gcalLink, { token: 'staff1', body: { code: 'cOK', state: bits.join('.') } });
  assert.equal(forged.status, 400);
  /* 재사용 */
  const ok = await call(G.gcalLink, { token: 'staff1', body: { code: 'cOK', state: s } });
  assert.equal(ok.body.ok, true);
  const again = await call(G.gcalLink, { token: 'staff1', body: { code: 'cOK', state: s } });
  assert.equal(again.status, 400, '★ 같은 요청표를 두 번 썼습니다');
});

test('⑥ 달력 권한을 끄고 왔거나 갱신 열쇠가 없으면 연결하지 않는다', async () => {
  const G = fresh();
  const noCal = await call(G.gcalLink, { token: 'staff1', body: { code: 'cNoCal', state: await stateFor(G, 'staff1') } });
  assert.equal(noCal.status, 400);
  const noRt = await call(G.gcalLink, { token: 'staff1', body: { code: 'cNoRT', state: await stateFor(G, 'staff1') } });
  assert.equal(noRt.status, 400, '★ 갱신 열쇠 없이 «연결됨»이라 했습니다 — 한 시간 뒤 풀립니다');
  assert.equal((world.data.gcal_tokens || {}).staff1, undefined);
});

test('⑥-2 끊기 — 지우고 구글에도 돌려준다', async () => {
  const G = fresh({ gcal_tokens: { staff1: { rt: 'RT1' } } });
  const r = await call(G.gcalUnlink, { token: 'staff1' });
  assert.equal(r.body.ok, true);
  assert.equal(world.data.gcal_tokens.staff1, undefined);
  assert.ok(revoked.includes('RT1'));
});

test('⑦ 갱신 열쇠 자리는 보안규칙에 «없다» — 화면(관리자 포함)이 못 읽는다', () => {
  const r = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', 'rules-paste.json'), 'utf8')).rules;
  assert.equal(r.gcal_tokens, undefined, '★ gcal_tokens 에 규칙이 생겼습니다 — 누군가 갱신 열쇠를 읽을 수 있게 됩니다');
  assert.equal(r.gcal_states, undefined);
  assert.equal(r['.read'], undefined, '뿌리에 읽기가 열리면 서버 전용 자리가 모두 드러납니다');
  assert.ok(!Object.keys(r).some((k) => k.startsWith('$')), '뿌리에 $자리가 생기면 서버 전용 자리가 드러날 수 있습니다');
});

test('⑧ 배포 목록(index.js)에 다섯 함수가 다 있다', () => {
  const idx = fs.readFileSync(path.join(ROOT, 'functions', 'index.js'), 'utf8');
  ['gcalAuthUrl', 'gcalLink', 'gcalToken', 'gcalUnlink', 'gcalTokenSweep'].forEach((n) => {
    assert.match(idx, new RegExp('exports\\.' + n + '\\s*=\\s*_gcalLink\\.' + n), n + ' 가 배포 목록에 없습니다');
  });
});
