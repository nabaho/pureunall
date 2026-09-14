/* «전체» 로그아웃 — 잠든 탭도, 이알피 열쇠도 함께 끊긴다 (대표 보고 2026-09-14)

   「로그아웃 했는데 전체로그아웃이 잘 안되고 다시 로그인 되어 있다」

   ── 무슨 일이 있었나 ──
   포털 로그아웃은 auth.signOut() 하나였다. 파이어베이스는 끊기지만
     · 이알피가 따로 들고 있는 자동 로그인 열쇠(pureun_v6_autologin_sid)가 남았고
     · 폰이 «얼려» 둔 뒤의 탭(이알피·기업정보함)은 끊긴 신호(onAuthStateChanged)를 놓쳐, 깨어난 뒤에도
       메모리에 남은 사용자로 그대로 로그인된 채 돌았다 — 토큰도 계속 새로 받는다.

   ── 규칙 ──
   ① 나가는 쪽은 «지금 나갔다» 시각(pu_auth_logout_at)을 적고 앱 열쇠를 지운다 — 포털·이알피 둘 다
   ② 앱은 그 storage 신호를 받으면 즉시, 사람을 본 적 있는 탭이면 파이어베이스도 끊고 나간다
   ③ 잠들었다 깨어날 때(visibilitychange·focus·pageshow) 그 시각이 «마지막으로 사람을 본 때»보다 뒤면 끊는다
   ④ 나간 «뒤에» 새로 로그인한 탭은 끊지 않는다 · 사람을 본 적 없는 탭(공개 화면)도 끊지 않는다
   ⑤ 포털과 authsync 가 «같은 열쇠 이름»을 쓴다 · 앱들이 새 판(?v=)을 싣는다 */

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { cutFn } = require('./cut-fn');   // 함수를 «통째로» 자른다 — 글자 수로 자르면 함수가 길어질 때 못 닿는다

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'js', 'pu-authsync.js'), 'utf8');
const PORTAL = fs.readFileSync(path.join(ROOT, 'enter.html'), 'utf8');
const ERP = fs.readFileSync(path.join(ROOT, 'pu-erp.html'), 'utf8');

function boot(opts) {
  opts = opts || {};
  const store = { local: Object.assign({}, opts.local || {}), session: {} };
  const timers = [];
  const g = {
    PU_AUTHSYNC_GRACE_MS: 0,
    _signedOut: 0,
    firebase: { auth: function () { return {
      currentUser: g._user || null,
      onAuthStateChanged: function (cb) { g._authCb = cb; },
      signOut: function () { g._signedOut++; g._user = null; return Promise.resolve(); }
    }; } },
    localStorage: { getItem: k => (k in store.local ? store.local[k] : null), setItem: (k, v) => { store.local[k] = String(v); }, removeItem: k => { delete store.local[k]; } },
    sessionStorage: { getItem: k => (k in store.session ? store.session[k] : null), setItem: (k, v) => { store.session[k] = String(v); }, removeItem: k => { delete store.session[k]; } },
    document: { hidden: false, createElement: () => ({ style: {}, appendChild() {} }), body: { appendChild() {} },
                addEventListener: (n, fn) => { if (n === 'visibilitychange') g._vis = fn; } },
    location: { replace: (u) => { g._went = u; }, reload: () => { g._went = 'reload'; } },
    addEventListener: (n, fn) => { g['_ev_' + n] = fn; },
    setTimeout: (fn) => { timers.push(fn); return timers.length; }, clearTimeout: () => {},
    setInterval: () => 1, clearInterval: () => {},
    Date, String, Number, Object, Promise, console
  };
  g.window = g;
  vm.createContext(g);
  vm.runInContext(SRC, g);
  g.PuAuthSync.start();
  g._flush = () => { while (timers.length) { const f = timers.shift(); try { f(); } catch (e) {} } };
  g._login = (uid) => { g._user = { uid, isAnonymous: false }; g.PuAuthSync._onAuth(g._user); };
  g._store = store;
  return g;
}
const KEY = 'pu_auth_logout_at';

test('★★ 포털이 «지금 나갔다»고 적으면 — 사람을 보고 있던 탭은 즉시 파이어베이스까지 끊고 나간다', () => {
  const g = boot(); g._login('U1');
  const at = String(Date.now() + 10);
  g._store.local[KEY] = at;
  g._ev_storage({ key: KEY, newValue: at });
  assert.equal(g.PuAuthSync._wasKicked(), true, '★★ 신호를 받았는데 그대로 로그인된 채 돕니다');
  assert.equal(g._signedOut, 1, '★★ 이 탭의 파이어베이스를 안 끊으면 메모리의 사용자가 토큰을 계속 새로 받습니다');
  g._flush();
  assert.match(String(g._went), /enter\.html/, '로그인 화면으로 가야 합니다');
});

test('★★ 얼어 있던 탭이 깨어날 때 — 놓친 신호를 잡아 끊는다', () => {
  const g = boot(); g._login('U1');
  /* 잠든 사이 포털이 나갔다 — storage 신호는 못 받았다(얼어 있었다) */
  g._store.local[KEY] = String(Date.now() + 5);
  g._vis();                                   // 화면이 다시 보인다
  assert.equal(g.PuAuthSync._wasKicked(), true, '★★ 깨어났는데 다시 확인하지 않습니다 — 「다시 로그인 되어 있다」가 이것입니다');
  assert.equal(g._signedOut, 1);
});

test('★ focus·pageshow 로 깨어나도 같다', () => {
  ['focus', 'pageshow'].forEach(function (ev) {
    const g = boot(); g._login('U1');
    g._store.local[KEY] = String(Date.now() + 5);
    g['_ev_' + ev]();
    assert.equal(g.PuAuthSync._wasKicked(), true, '★ ' + ev + ' 로 깨어났는데 안 끊습니다');
  });
});

test('★★ 나간 «뒤에» 새로 로그인한 탭은 끊지 않는다 — 옛 신호에 걸리면 로그인이 안 된다', () => {
  const g = boot();
  g._store.local[KEY] = String(Date.now() - 60000);   // 1분 전에 누가 나갔다
  g._login('U2');                                     // 그 뒤에 새로 들어왔다
  g._vis(); g._ev_focus();
  assert.equal(g.PuAuthSync._wasKicked(), false, '★★ 옛 로그아웃 신호에 새 로그인이 끊깁니다 — 아무도 못 들어옵니다');
  assert.equal(g._signedOut, 0);
});

test('★ 사람을 본 적 없는 탭(공개 화면·부팅 중)은 끊지 않는다', () => {
  const g = boot();                                   // 로그인 없음
  const at = String(Date.now());
  g._store.local[KEY] = at;
  g._ev_storage({ key: KEY, newValue: at }); g._vis();
  assert.equal(g.PuAuthSync._wasKicked(), false, '★ 로그인도 안 한 화면을 로그인 화면으로 쫓아냅니다');
});

test('★★ broadcastLogout 은 시각을 적고 앱 열쇠(uid·자동로그인)를 지운다', () => {
  const g = boot({ local: { pu_auth_uid: 'U1', pureun_v6_autologin_sid: 'P-001' } });
  g._store.session.pureun_v6_session_sid = 'P-001';
  g.PuAuthSync.broadcastLogout();
  assert.ok(Number(g._store.local[KEY]) > 0, '★★ 시각을 안 적으면 잠든 탭이 알 길이 없습니다');
  assert.ok(!g._store.local.pu_auth_uid, 'uid 가 남습니다');
  assert.ok(!g._store.local.pureun_v6_autologin_sid, '★★ 이알피 자동 로그인 열쇠가 남습니다 — 다음에 열면 그 사람으로 들어갑니다');
  assert.ok(!g._store.session.pureun_v6_session_sid, '이알피 세션이 남습니다');
});

/* ── 적는 쪽 ── */
test('★★ 포털 로그아웃이 «같은 열쇠»에 시각을 적고 이알피 열쇠를 지운다', () => {
  const key = SRC.match(/var LOGOUT_KEY = '([^']+)'/)[1];
  const i = PORTAL.indexOf('function broadcastLogout()');
  assert.ok(i > 0, '★★ 포털에 «지금 나갔다» 적는 자리가 없습니다 — auth.signOut() 하나면 잠든 탭은 모릅니다');
  const fn = PORTAL.slice(i, i + 600);
  assert.ok(fn.indexOf("'" + key + "'") > 0, '★★ 포털과 authsync 의 열쇠 이름이 다릅니다 — 신호가 서로 안 닿습니다');
  assert.match(fn, /pureun_v6_autologin_sid/, '★★ 이알피 자동 로그인 열쇠를 안 지웁니다');
  assert.match(fn, /pu_auth_uid/, 'uid 를 안 지웁니다');
  const btn = PORTAL.slice(PORTAL.indexOf("$('logoutBtn').addEventListener"), PORTAL.indexOf("$('logoutBtn').addEventListener") + 500);
  assert.match(btn, /broadcastLogout\(\)/, '★★ 로그아웃 단추가 신호를 안 냅니다');
});

test('★ 유휴 자동 로그아웃도 «전체»다', () => {
  const i = PORTAL.indexOf('Date.now() - last >= LIMIT');
  assert.ok(i > 0);
  assert.match(PORTAL.slice(i, i + 120), /broadcastLogout\(\)/, '★ 60분 유휴로 나갈 때는 신호를 안 냅니다 — 다른 탭은 그대로 로그인돼 있습니다');
});

test('★ 이알피 로그아웃도 신호를 낸다', () => {
  assert.match(cutFn(ERP, 'function handleLogout('), /broadcastLogout/, '★ 이알피에서 나가면 잠든 기업정보함·포털 탭이 모릅니다');
});

test('★ 앱들이 새 판의 authsync 를 싣는다 — 캐시에 묵은 옛 판은 신호를 모른다', () => {
  const files = fs.readdirSync(ROOT).filter(f => /\.html$/.test(f));
  const vers = new Set();
  files.forEach(f => {
    const m = fs.readFileSync(path.join(ROOT, f), 'utf8').match(/pu-authsync\.js\?v=(\d+)/);
    if (m) vers.add(m[1]);
  });
  assert.ok(vers.size >= 1, '★ authsync 를 싣는 앱을 못 찾았습니다');
  assert.equal(vers.size, 1, '★ 앱마다 다른 판을 싣습니다: ' + Array.from(vers).join(','));
  assert.ok(Number(Array.from(vers)[0]) >= 2, '★ 캐시 번호를 안 올렸습니다 — 폰은 옛 파일을 계속 씁니다');
});
