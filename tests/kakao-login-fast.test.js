/* 카카오 로그인 — 「로그인하는 중…」을 줄인다 (대표 2026-09-29 「창이 너무 오래 떠있다 좀 빨리 넘어가게」)

   ■ 잰 것: 서버 기록에서 로그인 한 번에 함수 «안»에서만 1.9~2.5초. 로그인 간격이 길어
     함수가 매번 새로 뜨고, 카카오 답을 다 받은 «뒤에야» DB 연결을 맺기 시작했다.
   ★ 못 박는 것 (돈 드는 «늘 켜 둔 서버»는 안 쓴다)
     ① 미리 깨우기(GET ?warm=1)는 204 만 돌려주고 아무것도 읽어 주거나 쓰지 않는다
     ② 로그인(POST)은 카카오에 묻기 «전에» DB 연결을 연다(동시에 한다)
     ③ 단계별 시간을 기록에 남기되 카카오 회원번호·사번은 안 적는다
     ④ 화면: 노란 단추(goLogin)가 미리 깨우고, 1분에 한 번만 두드린다
     ⑤ 화면: 서버 답을 기다리는 동안 이 화면의 DB 연결을 먼저 연다

   node --test tests/kakao-login-fast.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const Module = require('module');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const log = [];

function world(seed) {
  const data = JSON.parse(JSON.stringify(seed));
  const get = p => p.split('/').filter(Boolean).reduce((c, k) => (c == null ? null : c[k]), data);
  const set = (p, v) => {
    const ps = p.split('/').filter(Boolean); let c = data;
    for (let i = 0; i < ps.length - 1; i++) c = c[ps[i]] || (c[ps[i]] = {});
    if (v === null) delete c[ps[ps.length - 1]]; else c[ps[ps.length - 1]] = v;
  };
  return {
    data,
    database: {
      ref(p) {
        return {
          once: async () => { log.push('db:' + p); const v = get(p); return { val: () => (v === undefined ? null : v) }; },
          update: async () => { log.push('write:' + p); },
          push: async () => { log.push('write:' + p); },
          set: async () => { log.push('write:' + p); },
          transaction: async fn => {
            const before = get(p); const next = fn(before == null ? null : before);
            if (next === undefined) return { committed: false };
            set(p, next); log.push('write:' + p); return { committed: true };
          },
        };
      },
    },
  };
}
let W;
const issued = [];
function loadKakao() {
  const orig = Module._load;
  Module._load = function (req) {
    if (req === 'firebase-functions/v1') { const c = { region: () => c, runWith: () => c, https: { onRequest: h => h } }; return c; }
    if (req === 'firebase-admin/auth') return { getAuth: () => ({ createCustomToken: async (uid) => { issued.push(uid); return 'CT:' + uid; }, verifyIdToken: async () => { throw new Error('x'); } }) };
    if (req === 'firebase-admin/database') return { getDatabase: () => W.database };
    if (req === './ontology-write-server') return { wrapDatabase: d => d };
    return orig.apply(this, arguments);
  };
  const p = path.join(ROOT, 'functions', 'kakao.js');
  delete require.cache[require.resolve(p)];
  try { return require(p); } finally { Module._load = orig; }
}
global.fetch = async (url, opts) => {
  log.push('fetch:' + String(url).split('?')[0]);
  if (String(url).startsWith('https://kauth.kakao.com/oauth/token')) return { ok: true, json: async () => ({ access_token: 'AT' }) };
  if (String(url).startsWith('https://kapi.kakao.com/v2/user/me')) return { ok: true, json: async () => ({ id: 111 }) };
  throw new Error('예상 밖 주소: ' + url);
};
process.env.KAKAO_REST_KEY = '0123456789abcdef0123456789abcdef';
process.env.KAKAO_CLIENT_SECRET = 'FakeSecretForTests1234567890';

function signedState(mode, at = Date.now()) {
  const payload = mode + '.' + at + '.' + crypto.randomBytes(24).toString('base64url');
  return payload + '.' + crypto.createHmac('sha256', process.env.KAKAO_CLIENT_SECRET)
    .update(payload).digest('base64url');
}
function shapedState(mode = 'login') {
  return mode + '.1700000000000.' + 'A'.repeat(32) + '.' + 'B'.repeat(43);
}

function call(h, method, query, body) {
  return new Promise(resolve => {
    body = Object.assign({}, body || {});
    if (body.code && !body.state) {
      body.state = signedState('login');
    }
    const req = { method, headers: { origin: 'https://nabaho.github.io' }, body: body || {}, query: query || {} };
    const res = { _s: 200, set() {}, status(s) { this._s = s; return this; },
      json(j) { resolve({ status: this._s, body: j }); }, send() { resolve({ status: this._s }); } };
    h(req, res);
  });
}
function fresh() {
  log.length = 0; issued.length = 0;
  W = world({ uid_roles: { staff1: { sid: 'P-101', status: 'active' } }, kakao_links: { '111': { uid: 'staff1', sid: 'P-101' } } });
  return loadKakao();
}

/* ── 서버 ── */

test('★★★ ① 미리 깨우기는 204 만 — 아무것도 읽어 주거나 쓰지 않고 표도 안 준다', async () => {
  const K = fresh();
  const r = await call(K.kakaoLoginFinish, 'GET', { warm: '1' });
  assert.equal(r.status, 204);
  assert.deepEqual(log.filter(x => x.startsWith('db:')), ['db:uid_roles/_warm'], '★ 깨우기가 «없는 자리» 말고 다른 것을 읽었다');
  assert.ok(!log.some(x => x.startsWith('write:') || x.startsWith('fetch:')), '★ 깨우기가 쓰거나 카카오를 불렀다');
  assert.equal(issued.length, 0, '★★★ 깨우기로 로그인 표가 나갔다');
  assert.equal((await call(K.kakaoLoginFinish, 'GET', {})).status, 405, '★ warm 없는 GET 은 예전처럼 거절');
});

test('★★ ② 로그인은 카카오에 묻기 «전에» DB 연결부터 연다 — 동시에 한다', async () => {
  const K = fresh();
  const r = await call(K.kakaoLoginFinish, 'POST', {}, { code: 'cA' });
  assert.equal(r.body.ok, true); assert.equal(r.body.token, 'CT:staff1');
  const warm = log.indexOf('db:uid_roles/_warm'), kakao = log.indexOf('fetch:https://kauth.kakao.com/oauth/token');
  assert.ok(warm >= 0 && kakao >= 0 && warm < kakao, '★★ DB 연결을 카카오 답을 받은 뒤에야 연다: ' + log.join(' → '));
});

test('★★ ③ 단계별 시간을 남기되 회원번호·사번은 안 적는다', async () => {
  const K = fresh();
  const seen = [];
  const orig = console.log; console.log = (...a) => seen.push(a.join(' '));
  try { await call(K.kakaoLoginFinish, 'POST', {}, { code: 'cA' }); } finally { console.log = orig; }
  const line = seen.find(s => s.startsWith('[kakaoLoginFinish]'));
  assert.ok(line, '★ 단계별 시간이 기록에 안 남는다 — 다음에 또 어디서 느린지 모른다');
  assert.match(line, /카카오 \d+ms · 연결기록 \d+ms · 재직 \d+ms · 표(?:·내정보)? \d+ms/);
  assert.ok(!/111|P-101|staff1/.test(line), '★★ 기록에 사람을 가리키는 값이 들어갔다');
});

/* ── 화면 ── */

function loadClient() {
  const calls = [];
  const ctx = { window: {}, sessionStorage: { setItem() {}, getItem() { return null; }, removeItem() {} },
    location: { href: 'https://nabaho.github.io/pureunall/enter.html' }, Date, JSON, Promise, URL,
    crypto: { getRandomValues: a => a },
    fetch: (url, o) => { calls.push({ url, o }); return String(url).indexOf('kakaoAuthUrl') >= 0
      ? Promise.resolve({ status: 200, text: () => Promise.resolve(JSON.stringify({ ok: true, url: 'https://kauth.kakao.com/oauth/authorize?x', state: shapedState() })) })
      : Promise.resolve({ status: 204 }); } };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'pu-kakao.js'), 'utf8'), ctx);
  return { K: ctx.PuKakao, calls, ctx };
}

test('★★ ④ 노란 단추가 서버를 미리 깨우고, 1분에 한 번만 두드린다', async () => {
  const { K, calls } = loadClient();
  await K.goLogin({});
  const warm = calls.filter(c => /kakaoLoginFinish\?warm=1$/.test(c.url));
  assert.equal(warm.length, 1, '★★ 노란 단추가 서버를 안 깨운다');
  assert.equal(warm[0].o.method, 'GET'); assert.equal(warm[0].o.mode, 'no-cors');
  assert.ok(calls.indexOf(warm[0]) < calls.findIndex(c => /kakaoAuthUrl/.test(c.url)), '★ 카카오로 떠나기 «전에» 깨워야 한다');
  K.warm(); K.warm();
  assert.equal(calls.filter(c => /warm=1/.test(c.url)).length, 1, '★ 1분 안에 또 두드린다');
});

test('★★ 로그인 주소 GET 은 본문·JSON 헤더 없이 보내 브라우저의 CORS 사전 요청을 만들지 않는다', async () => {
  const { K, calls } = loadClient();
  await K.goLogin({});
  const auth = calls.find(c => /kakaoAuthUrl/.test(c.url));
  assert.ok(auth, '카카오 로그인 주소 요청이 없다');
  assert.equal(auth.o.method, 'GET');
  assert.equal(auth.o.body, undefined);
  assert.ok(!auth.o.headers || !Object.keys(auth.o.headers).some(k => k.toLowerCase() === 'content-type'),
    '본문 없는 GET 에 JSON Content-Type 을 붙이면 휴대전화가 OPTIONS 를 한 번 더 보낸다');
});

test('★★ 캐시된 옛 화면의 GET 사전 요청도 서버가 허용한다', async () => {
  const K = fresh();
  const headers = {};
  const result = await new Promise(resolve => {
    const res = { set(k, v) { headers[k.toLowerCase()] = v; return this; },
      status(code) { this.code = code; return this; }, send() { resolve(this.code); } };
    K.kakaoAuthUrl({ method: 'OPTIONS', headers: { origin: 'https://nabaho.github.io' }, query: {} }, res);
  });
  assert.equal(result, 204);
  assert.ok(headers['access-control-allow-methods'].split(',').includes('GET'),
    '이전 화면이 GET 전에 보낸 OPTIONS 는 GET 을 허용해야 한다');
});

test('★★ 카카오 단추는 인증 저장소를 먼저 기다리지 않고 곧바로 카카오 주소를 요청한다', () => {
  const enter = fs.readFileSync(path.join(ROOT, 'enter.html'), 'utf8');
  const start = enter.indexOf('function kkLogin(){');
  const end = enter.indexOf('function kkEndReturn()', start);
  assert.ok(start >= 0 && end > start, '카카오 단추 처리 구간을 찾지 못했다');
  const body = enter.slice(start, end);
  assert.match(body, /PuKakao\.goLogin\(\{ ask: !used \}\)/);
  assert.doesNotMatch(body, /auth\.setPersistence|_persistenceReady\.then/,
    '카카오 화면으로 가기 전 저장소 준비를 기다리고 있다');
  assert.match(enter.slice(end, enter.indexOf('var KK_WANT', end)),
    /auth\.setPersistence\(firebase\.auth\.Auth\.Persistence\.SESSION\)/,
    '복귀 뒤 로그인 유지 끄기는 SESSION 으로 적용해야 한다');
});

test('★★ ⑤ 서버 답을 기다리는 «동안» 화면의 DB 연결을 먼저 연다 · 로그인 화면은 카카오 쓰는 기기만 깨운다', () => {
  const enter = fs.readFileSync(path.join(ROOT, 'enter.html'), 'utf8');
  const at = enter.indexOf('PuKakao.loginFinish(p.code)');
  assert.ok(at > 0);
  const connectAt = enter.lastIndexOf("db.ref('.info/connected').once('value')", at);
  assert.ok(connectAt > 0 && connectAt < at, '★★ DB 연결을 표를 받은 뒤에야 연다');
  assert.match(enter, /localStorage\.getItem\('pu_kakao_used'\) === '1' && window\.PuKakao && PuKakao\.warm\) PuKakao\.warm\(\)/,
    '★ 로그인 화면이 카카오 쓰는 기기에서 서버를 미리 안 깨운다');
  assert.match(enter, /js\/pu-kakao\.js\?v=\d+/);
});

test('★★ 휴대전화에서 카카오 서버 응답·명부를 끝없이 기다리지 않는다', () => {
  const kakaoJs = fs.readFileSync(path.join(ROOT, 'js', 'pu-kakao.js'), 'utf8');
  const enter = fs.readFileSync(path.join(ROOT, 'enter.html'), 'utf8');
  assert.match(kakaoJs, /AbortController/);
  assert.match(kakaoJs, /10000/);
  assert.doesNotMatch(enter, /카카오 로그인 응답이 늦습니다\. 아래 카카오 버튼을 다시 한 번 눌러 주세요/,
    '진행 중인 인증을 실패로 표시해 재시도를 유도한다');
  assert.match(enter, /명부 읽기 시간 초과/);
  assert.match(enter, /}, 3500\)/);
});

test('★★ 직원명부는 인증 뒤에만 읽는다 — 로그인 전 읽기는 권한 거부로 재시도를 만든다', () => {
  const enter = fs.readFileSync(path.join(ROOT, 'enter.html'), 'utf8');
  const start = enter.indexOf('function kkHandleReturn(){');
  const signIn = enter.indexOf('auth.signInWithCustomToken(ready[0])', start);
  const signed = enter.indexOf('}).then(function(cred){', signIn);
  const roster = enter.indexOf("db.ref('data/user_dir').once('value')", start);
  assert.ok(start >= 0 && signIn > start && signed > signIn && roster > signed,
    '직원명부를 Firebase 로그인 전에 읽으면 권한 거부 뒤 다른 명부를 다시 기다린다');
  assert.match(enter, /Promise\.all\(\[server,\s*persist\]\)/);
  assert.match(enter, /PuKakao\.loginFinish\(p\.code\)/);
  assert.match(enter, /path === 'data\/user_dir' && window\.__puRosterPrefetch/);
});

test('★★ 로그인 전 글꼴 다운로드는 Firebase 인증 스크립트를 막지 않는다', () => {
  const enter = fs.readFileSync(path.join(ROOT, 'enter.html'), 'utf8');
  const fonts = (enter.match(/<link[^>]+fonts\.googleapis\.com[^>]*>/g) || [])
    .filter(tag => /css2\?family=/.test(tag));
  assert.ok(fonts.length > 0, '글꼴 링크가 사라졌는지 확인해야 한다');
  assert.ok(fonts.every(tag => /media="print"/.test(tag) && /onload="this\.media='all'"/.test(tag)),
    '외부 글꼴 CSS를 동기 stylesheet로 두면 느린 휴대전화에서 인증 스크립트까지 기다린다');
});

test('★★ 카카오 인증 성공 결과로 포털을 바로 열고 인증상태 재알림을 기다리지 않는다', () => {
  const enter = fs.readFileSync(path.join(ROOT, 'enter.html'), 'utf8');
  const start = enter.indexOf('Promise.all([server, persist])');
  const end = enter.indexOf("}).catch(function(err){", start);
  assert.ok(start > 0 && end > start);
  assert.match(enter.slice(start, end), /if\(!_handled\)\{ _handled = true; enterPortal\(cred\.user(?:, kkProfile)?\); \}/);
});
