'use strict';
/* 로그아웃으로 밀려났던 앱 탭은 다시 로그인하면 «하던 앱으로» 돌아간다 (대표 결정 2026-10-09 「4」)
   전에는 로그아웃하면 열린 앱 탭이 모두 포털 로그인 화면으로 밀려나 그대로 쌓였다(앱 다섯 개면 로그인 탭 다섯 개).
   다시 로그인해도 포털로 남았고, 숨어 있다 앞으로 나올 때 로그인 화면이 번쩍였다.

   못 박는 것(규칙):
   ① 밀려날 때(로그아웃) 이 탭의 주소·창 이름·사람을 이 탭(sessionStorage)에 적는다 · 다른 사람으로 바뀐 것은 안 적는다
   ② 포털은 «같은 사람»이 들어오면 그 주소로 돌아가고 창 이름을 되돌린다 — 다른 사람이면 포털에 머문다
   ③ 12시간 넘은 표 · 우리 앱 폴더 밖 주소 · 포털 자신은 버린다 · 표는 한 번 읽으면 지운다
   ④ 숨은 탭은 보일 때 간다(한꺼번에 켜져 자료를 몰아 받지 않게) — 그새 나갔으면 포털을 새로
   ⑤ 포털 진입(enterPortal)이 맨 먼저 이것을 본다 · 두 파일의 열쇠 이름이 같다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const SYNC = fs.readFileSync(path.join(ROOT, 'js', 'pu-authsync.js'), 'utf8');
const enter = fs.readFileSync(path.join(ROOT, 'enter.html'), 'utf8').replace(/\r\n/g, '\n');

/* ── pu-authsync 를 흉내 낸 브라우저에서 돌린다 (tests/authsync.test.js 와 같은 짜임) ── */
function app(opts) {
  opts = opts || {};
  const store = { local: Object.assign({}, opts.local || {}), session: {} };
  const timers = [];
  const g = {
    PU_AUTHSYNC_GRACE_MS: 0,
    name: opts.name || 'pureun-erp',
    firebase: { auth: () => ({ currentUser: g._user || null, onAuthStateChanged() {}, signOut() { g._user = null; } }) },
    localStorage: { getItem: (k) => (k in store.local ? store.local[k] : null), setItem: (k, v) => { store.local[k] = String(v); }, removeItem: (k) => { delete store.local[k]; } },
    sessionStorage: { getItem: (k) => (k in store.session ? store.session[k] : null), setItem: (k, v) => { store.session[k] = String(v); }, removeItem: (k) => { delete store.session[k]; } },
    document: { createElement: () => ({ style: {} }), body: { appendChild() {} }, addEventListener() {} },
    location: { href: opts.href || 'https://nabaho.github.io/pureunall/pu-erp.html?sso=1&v=3#menu=fin/ledger', replace: (u) => { g._went = u; } },
    addEventListener: (n, fn) => { if (n === 'storage') g._storage = fn; },
    setTimeout: (fn) => { timers.push(fn); return timers.length; }, clearTimeout() {}, setInterval: () => 1, clearInterval() {},
    Date, String, Object, JSON, console,
  };
  g.window = g;
  vm.createContext(g);
  vm.runInContext(SYNC, g);
  g.PuAuthSync.start();             // 진짜로는 파이어베이스가 준비되면 스스로 붙는다(setInterval) — 여기선 바로 붙인다
  g._flush = () => { while (timers.length) { try { timers.shift()(); } catch (e) {} } };
  g._fire = (uid) => { g._user = uid ? { uid } : null; g.PuAuthSync._onAuth(g._user); };
  g._store = store;
  return g;
}
const ticket = (g) => JSON.parse(g._store.session.pu_return_app || 'null');

test('①★ 로그아웃으로 밀려날 때 이 탭의 주소·창 이름·사람을 이 탭에 적는다', () => {
  const g = app();
  g._fire('UID-A');                 // 로그인해 있던 화면
  g._fire(null);                    // 로그아웃
  g._flush(); g._flush();
  assert.ok(/enter\.html/.test(g._went || ''), '포털로 안 보냈다');
  const t = ticket(g);
  assert.ok(t, '돌아올 표를 안 적었다');
  assert.equal(t.from, 'https://nabaho.github.io/pureunall/pu-erp.html?sso=1&v=3#menu=fin/ledger');
  assert.equal(t.name, 'pureun-erp');
  assert.equal(t.uid, 'UID-A');
  assert.ok(Math.abs(Date.now() - t.at) < 5000);
  assert.equal(g._store.local.pu_return_app, undefined, '⚠ localStorage 에 적으면 다른 탭·다음 사람과 섞인다');
});

test('① 다른 탭 로그아웃 신호(storage)로 밀려나도 적는다 — 끊기 «전» 사람으로', () => {
  const g = app({ local: { pu_auth_uid: 'UID-A' } });
  g._user = { uid: 'UID-A' };       // 이 탭은 아직 신호를 못 받았지만(얼어 있던 탭) 파이어베이스에는 사람이 있다
  g._storage({ key: 'pu_auth_logout_at', newValue: String(Date.now()) });
  g._flush();
  assert.equal((ticket(g) || {}).uid, 'UID-A', '끊은 «뒤»의 사람(없음)으로 적으면 돌아올 수 없다');
});

test('① 다른 사람으로 바뀐 것은 안 적는다 — 앞사람이 보던 화면으로 데려가면 안 된다', () => {
  const g = app();
  g._fire('UID-A');                 // 이 탭은 A 의 화면이었다
  g._fire('UID-B');                 // 다른 탭에서 B 가 들어왔다
  g._flush();
  assert.equal(g.PuAuthSync._wasKicked(), true);
  assert.equal(ticket(g), null);
});

/* ── 포털 쪽 _returnToApp 을 떼어 가짜 문서로 돌린다 ── */
const RET = (() => {
  const a = enter.indexOf("var RETURN_KEY = 'pu_return_app'");
  assert.ok(a > 0, '포털의 돌아가기 표 읽기를 못 찾음');
  const b = enter.indexOf('\n  // ── 포털 진입', a);
  assert.ok(b > a);
  return enter.slice(a, b);
})();
function portal(t, opt) {
  opt = opt || {};
  const session = {};
  if (t !== undefined) session.pu_return_app = typeof t === 'string' ? t : JSON.stringify(t);
  const vis = [];
  const c = {
    URL, JSON, Date, Number, String,
    sessionStorage: { getItem: (k) => (k in session ? session[k] : null), removeItem: (k) => { delete session[k]; } },
    location: { href: 'https://nabaho.github.io/pureunall/enter.html?v=1', origin: 'https://nabaho.github.io', pathname: '/pureunall/enter.html',
      replace: (u) => { c._went = u; } },
    document: { hidden: !!opt.hidden, addEventListener: (n, fn) => { if (n === 'visibilitychange') vis.push(fn); }, removeEventListener: (n, fn) => { const i = vis.indexOf(fn); if (i >= 0) vis.splice(i, 1); } },
    window: { name: 'pureun-portal' },
    auth: { currentUser: opt.current === undefined ? { uid: 'UID-A' } : opt.current },
    _loginGuard: { cover() { c._covered = true; } },
  };
  vm.createContext(c);
  vm.runInContext(RET, c);
  c._session = session;
  c._show = () => { c.document.hidden = false; vis.slice().forEach((fn) => fn()); };
  return c;
}
const T = (over) => Object.assign({ from: 'https://nabaho.github.io/pureunall/pu-erp.html?sso=1#menu=fin/ledger', name: 'pureun-erp', uid: 'UID-A', at: Date.now() - 60000 }, over || {});

test('②★ 같은 사람이 들어오면 하던 앱으로 돌아가고 창 이름을 되돌린다 · 표는 지운다', () => {
  const c = portal(T());
  assert.equal(c._returnToApp({ uid: 'UID-A' }), true);
  assert.equal(c._went, 'https://nabaho.github.io/pureunall/pu-erp.html?sso=1#menu=fin/ledger');
  assert.equal(c.window.name, 'pureun-erp', '창 이름을 안 되돌리면 포털 타일이 같은 앱을 두 창으로 연다');
  assert.equal(c._covered, true, '떠나는 동안 로그인 화면이 비친다');
  assert.equal(c._session.pu_return_app, undefined, '표를 안 지우면 다음 로그인 때 또 끌려간다');
});

test('②★ 다른 사람이면 포털에 머문다 — 앞사람 화면 주소로 안 보낸다', () => {
  const c = portal(T());
  assert.equal(c._returnToApp({ uid: 'UID-B' }), false);
  assert.equal(c._went, undefined);
  assert.equal(c._session.pu_return_app, undefined, '다른 사람이어도 표는 지운다');
});

test('③ 낡은 표 · 바깥 주소 · 포털 자신 · 깨진 표 · 표 없음은 버린다', () => {
  const no = (t) => { const c = portal(t); assert.equal(c._returnToApp({ uid: 'UID-A' }), false, JSON.stringify(t)); assert.equal(c._went, undefined); };
  no(T({ at: Date.now() - 13 * 60 * 60 * 1000 }));
  no(T({ from: 'https://evil.example/pureunall/pu-erp.html' }));
  no(T({ from: 'https://nabaho.github.io/other/pu-erp.html' }));
  no(T({ from: 'https://nabaho.github.io/pureunall/enter.html?v=2' }));
  no(T({ from: 'javascript:alert(1)' }));
  no(T({ uid: '' }));
  no('{깨짐');
  no(undefined);
});

test('③ 창 이름이 이상하면 이름만 안 고친다(주소로는 간다)', () => {
  const c = portal(T({ name: 'x"><script>' }));
  assert.equal(c._returnToApp({ uid: 'UID-A' }), true);
  assert.equal(c.window.name, 'pureun-portal');
  assert.ok(c._went);
});

test('④★ 숨은 탭은 보일 때 간다 · 그새 나갔으면 포털을 새로', () => {
  const c = portal(T(), { hidden: true });
  assert.equal(c._returnToApp({ uid: 'UID-A' }), true);
  assert.equal(c._went, undefined, '★ 숨은 탭이 곧바로 앱을 켜면 다시 로그인할 때 앱들이 한꺼번에 자료를 받는다');
  c._show();
  assert.ok(/pu-erp\.html/.test(c._went));
  const gone = portal(T(), { hidden: true, current: null });
  gone._returnToApp({ uid: 'UID-A' });
  gone._show();
  assert.ok(/enter\.html\?v=/.test(gone._went), '나간 뒤에 앱으로 보내면 앱에서 또 튕긴다');
});

test('⑤ 포털 진입이 맨 먼저 이것을 본다 · 두 파일의 열쇠 이름이 같다', () => {
  assert.match(enter, /function enterPortal\(user(?:, verifiedProfile)?\)\{\n\s*if\(_returnToApp\(user\)\) return;/);
  assert.match(SYNC, /var RETURN_KEY = 'pu_return_app';/);
  assert.match(enter, /var RETURN_KEY = 'pu_return_app'/);
});
