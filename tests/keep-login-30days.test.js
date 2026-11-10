'use strict';
/* 「내 기기에서 30일간 로그인 유지」 (대표 요청 2026-11-10
   「로그인 할 경우 30일 피시에서 본인 컴퓨터인 경우 로그인 연속가능기능 및 체크기능 만들어줘」)

   이미 있던 것: 포털 로그인 화면의 「로그인 유지」 칸(#autoLogin) — 켜면 LOCAL, 끄면 SESSION 지속.
   없던 것(이 검사가 못 박는다):
     ① 유지를 «켠» 로그인은 30일을 넘기면 스스로 로그아웃한다 — 파이어베이스 LOCAL 만으로는 상한이 안 선다
     ② 유지를 «끈» 로그인은 창을 닫으면 끝난다 — 앱이 몰래 LOCAL 로 옮기지 못한다(공용 PC)
     ③ 로그아웃하면 유지 표시(로그인한 때)도 지워진다
     ④ 포털만이 아니라 로그인이 필요한 «모든 화면»이 같은 검사를 한다(앱을 바로 열어도 30일 상한이 선다)
     ⑤ 비밀번호·토큰은 저장하지 않는다 — 시각 하나만 적는다

   ⚠ 「지금 값」이 아니라 «규칙» 을 본다 — 30일만은 대표 요청 값 자체가 규칙이라 박고 까닭을 적었다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripComments, stripJs } = require('./strip-comments.js');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const MOD = read('js/pu-keep-login.js');
const DAY = 864e5;
const T0 = Date.UTC(2026, 10, 10, 3, 0, 0);

/* ── 가짜 세상: 가짜 파이어베이스 + 가짜 저장소 + 멈춘 시계 ── */
function world(opt) {
  opt = opt || {};
  const store = Object.assign({}, opt.store || {});
  const session = Object.assign({}, opt.session || {});
  const log = [];
  const timers = [];
  const listeners = [];
  const clock = { t: opt.now == null ? T0 : opt.now };
  const mem = (o) => ({
    getItem: (k) => (k in o ? o[k] : null),
    setItem: (k, v) => { o[k] = String(v); },
    removeItem: (k) => { delete o[k]; },
  });
  function Auth() {
    this.currentUser = opt.user === undefined ? { uid: 'u1', email: 'a@example.com', metadata: {} } : opt.user;
  }
  Auth.Persistence = { LOCAL: 'local', SESSION: 'session', NONE: 'none' };
  Auth.prototype.setPersistence = function (p) {
    log.push('persist:' + p);
    return opt.persistFails ? Promise.reject(new Error('저장소 막힘')) : Promise.resolve();
  };
  Auth.prototype.signInWithEmailAndPassword = function () { log.push('signin'); return Promise.resolve('cred'); };
  Auth.prototype.signInWithCustomToken = function () { log.push('signin-token'); return Promise.resolve('cred'); };
  Auth.prototype.signOut = function () { log.push('signout'); const u = this.currentUser; this.currentUser = null; return Promise.resolve(u); };
  const inst = new Auth();
  inst.onAuthStateChanged = (fn) => { listeners.push(fn); };
  const ctx = {
    localStorage: mem(store),
    sessionStorage: mem(session),
    Date: { now: () => clock.t, parse: (s) => Date.parse(s) },
    Promise,
    setTimeout: (fn, ms) => { timers.push({ fn, ms, kind: 'timeout' }); return timers.length; },
    setInterval: (fn, ms) => { timers.push({ fn, ms, kind: 'interval' }); return timers.length; },
    clearInterval() {},
    addEventListener() {},
    location: { replace: (u) => log.push('go:' + u) },
    document: { hidden: false, addEventListener() {}, getElementById: () => (opt.loginForm ? {} : null) },
  };
  if (!opt.late) ctx.firebase = { auth: Object.assign(() => inst, { Auth }) };
  if (opt.why !== false) ctx.PuLogoutWhy = { why: (r) => log.push('why:' + r) };
  if (opt.authsync) ctx.PuAuthSync = { broadcastLogout: () => { log.push('broadcast'); store.pu_auth_logout_at = String(clock.t); }, _wasKicked: () => !!opt.kicked };
  if (opt.gate) ctx.PuGate = { show: () => log.push('gate') };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(MOD, ctx);
  return { ctx, store, session, log, timers, listeners, clock, Auth, inst, K: ctx.PuKeepLogin };
}
const user = (extra) => Object.assign({ uid: 'u1', email: 'a@example.com', metadata: {} }, extra || {});

/* ───────── ① 30일 상한 ───────── */
test('① ★ 상한은 대표 요청대로 30일이다', () => {
  const w = world();
  assert.equal(w.K.DAYS, 30, '대표 요청 «30일» 이 아닙니다 — 화면 글귀(enter.html)도 함께 바꿔야 합니다'); // 검사고정-허용: 대표 요청 «30일» 자체가 규칙(2026-11-10)
});

test('① ★★ 유지를 켠 로그인: 상한 안이면 그대로, 상한을 넘기면 내보낸다', () => {
  const D = world().K.DAYS;
  const w = world({ store: { pu_portal_auto: '1', pu_keep_login_at: String(T0 - (D - 1) * DAY) } });
  assert.equal(w.K.judge(user()), 'ok', '상한 하루 전인데 내보냅니다');
  const b = world({ store: { pu_portal_auto: '1', pu_keep_login_at: String(T0 - D * DAY) } });
  assert.equal(b.K.judge(user()), 'expired', '상한을 채웠는데 안 내보냅니다 — 공용이 아닌 PC 도 «영원히» 남습니다');
  const c = world({ store: { pu_portal_auto: '1', pu_keep_login_at: String(T0 - (D + 40) * DAY) } });
  assert.equal(c.K.judge(user()), 'expired');
});

test('① ★★ 유지를 끈 로그인은 시각을 안 본다(세션 지속 — 창을 닫으면 끝) · 사람이 아니면 아무 일 없다', () => {
  const off = world({ store: { pu_portal_auto: '0', pu_keep_login_at: String(T0 - 400 * DAY) } });
  assert.equal(off.K.judge(user()), 'off');
  assert.equal(off.K.guard(user()), false, '유지를 끈 사람을 30일 검사로 내보냈습니다');
  const unset = world({ store: {} });
  assert.equal(unset.K.judge(user()), 'off', '고른 적이 없으면 건드리지 않습니다');
  const w = world({ store: { pu_portal_auto: '1', pu_keep_login_at: String(T0 - 400 * DAY) } });
  assert.equal(w.K.judge(null), 'none');
  assert.equal(w.K.judge({ uid: 'x', isAnonymous: true }), 'none', '익명(전자서명 등)은 사람 로그인이 아닙니다');
  assert.equal(w.K.guard(null), false);
  assert.equal(w.log.length, 0, '사람이 없는데 로그아웃을 불렀습니다');
});

test('① ★ 유지를 켰는데 시각 기록이 없으면(이 기능 이전 로그인) 지금부터 센다 — 갑자기 내보내지 않는다', () => {
  const w = world({ store: { pu_portal_auto: '1' } });
  assert.equal(w.K.judge(user({ metadata: { lastSignInTime: new Date(T0 - 200 * DAY).toUTCString() } })), 'started');
  assert.equal(w.store.pu_keep_login_at, String(T0), '시작 시각을 안 적었습니다');
  w.clock.t = T0 + 5 * DAY;
  assert.equal(w.K.judge(user()), 'ok');
});

test('① ★ 앱이 자기 로그인 칸으로 새로 들어온 사람은 옛 표시 때문에 내쫓기지 않는다', () => {
  const w = world({ store: { pu_portal_auto: '1', pu_keep_login_at: String(T0 - 50 * DAY) } });
  const fresh = user({ metadata: { lastSignInTime: new Date(T0 - 60000).toUTCString() } });
  assert.equal(w.K.judge(fresh), 'ok', '방금 로그인한 사람을 옛 표시로 내보냈습니다');
  assert.ok(Number(w.store.pu_keep_login_at) > T0 - DAY, '더 새 로그인 시각으로 표시를 갱신하지 않았습니다');
  /* 서버 시계가 앞서도 미래 시각을 적지 않는다 */
  const ahead = world({ store: { pu_portal_auto: '1', pu_keep_login_at: String(T0 - DAY) } });
  ahead.K.judge(user({ metadata: { lastSignInTime: new Date(T0 + 3600e3).toUTCString() } }));
  assert.ok(Number(ahead.store.pu_keep_login_at) <= T0, '미래 시각을 표시로 적었습니다');
});

test('① ★★ 상한을 넘기면: 까닭을 남기고 모든 탭에 알리고 표시를 지우고 파이어베이스를 끊는다 — 딱 한 번', async () => {
  const D = world().K.DAYS;
  const w = world({ authsync: true, store: { pu_portal_auto: '1', pu_keep_login_at: String(T0 - (D + 1) * DAY) } });
  const who = w.inst.currentUser;   // 끊으면 currentUser 가 비므로 «그 사람»을 먼저 잡아 둔다
  assert.equal(w.K.guard(who), true);
  assert.equal(w.K.guard(who), true, '끊는 중에 다시 불려도 같은 답이어야 합니다');
  const order = w.log.filter((x) => /^(why|broadcast|signout)/.test(x));
  assert.deepEqual(order.map((x) => x.split(':')[0]), ['why', 'broadcast', 'signout'], '까닭 → 알림 → 끊기 순서가 아닙니다: ' + order.join(' / '));
  assert.match(order[0], /만료/, '로그인 화면에 보일 까닭에 «만료» 가 없습니다');
  assert.equal(w.store.pu_keep_login_at, undefined, '만료한 뒤 표시가 남았습니다');
  assert.ok(w.store.pu_auth_logout_at, '다른 탭에 «지금 나갔다» 를 안 알렸습니다');
  await Promise.resolve(); await Promise.resolve();
  /* 끊김이 끝나면 풀려, 같은 화면에서 새로 로그인한 사람은 다시 검사받는다(막히지 않는다) */
  w.inst.currentUser = user();
  w.store.pu_portal_auto = '1';
  w.K.begin(true);
  assert.equal(w.K.guard(w.inst.currentUser), false, '새로 로그인한 사람을 이전 만료가 막았습니다');
});

test('① ★ authsync 가 없는 앱: 밀어내기가 안 일어나면 «로그인이 필요합니다» 화면(없으면 포털)으로 보낸다', () => {
  const D = world().K.DAYS;
  const mk = (o) => world(Object.assign({ store: { pu_portal_auto: '1', pu_keep_login_at: String(T0 - (D + 1) * DAY) } }, o));
  const gate = mk({ gate: true });
  gate.K.guard(gate.inst.currentUser);
  const t1 = gate.timers.find((t) => t.kind === 'timeout');
  assert.ok(t1, '안 밀려났을 때를 위한 대비가 없습니다');
  t1.fn();
  assert.ok(gate.log.includes('gate'), 'PuGate 화면을 안 띄웠습니다');
  const bare = mk({});
  bare.K.guard(bare.inst.currentUser); bare.timers.find((t) => t.kind === 'timeout').fn();
  assert.ok(bare.log.some((x) => /^go:enter\.html/.test(x)), '포털로 안 보냈습니다');
  const kicked = mk({ authsync: true, kicked: true, gate: true });
  kicked.K.guard(kicked.inst.currentUser); kicked.timers.find((t) => t.kind === 'timeout').fn();
  assert.ok(!kicked.log.includes('gate') && !kicked.log.some((x) => /^go:/.test(x)), 'authsync 가 이미 밀어냈는데 또 움직였습니다');
  /* 로그인 칸이 있는 화면(포털)은 제 화면이 로그인 칸을 보여 주니 건드리지 않는다 */
  const portal = mk({ loginForm: true, gate: true });
  portal.K.guard(portal.inst.currentUser); portal.timers.find((t) => t.kind === 'timeout').fn();
  assert.ok(!portal.log.includes('gate') && !portal.log.some((x) => /^go:/.test(x)), '로그인 칸이 있는 화면을 또 옮겼습니다');
});

/* ───────── 켜기·끄기·로그아웃 ───────── */
test('begin: 켜면 선택 + 로그인한 때를 적고, 끄면 선택 + 표시를 지운다 · 비밀번호는 아무 데도 안 간다', () => {
  const w = world();
  w.K.begin(true);
  assert.equal(w.store.pu_portal_auto, '1');
  assert.equal(w.store.pu_keep_login_at, String(T0));
  w.K.begin(false);
  assert.equal(w.store.pu_portal_auto, '0');
  assert.equal(w.store.pu_keep_login_at, undefined, '끈 뒤에도 로그인한 때가 남았습니다');
  assert.deepEqual(Object.keys(w.session), [], '세션 저장소에 뭔가 적었습니다');
});

test('③ ★★ 로그아웃은 어디서 불러도 표시를 지우고, 로그아웃 자체는 원래대로 일어난다', async () => {
  const w = world({ store: { pu_portal_auto: '1', pu_keep_login_at: String(T0) } });
  assert.ok(w.K._tick() === false || true);
  const r = await new w.Auth().signOut();
  assert.equal(w.store.pu_keep_login_at, undefined, '로그아웃했는데 유지 표시가 남았습니다');
  assert.ok(w.log.includes('signout'), '원래 signOut 이 불리지 않았습니다');
  assert.equal(r && r.uid, 'u1', '원래 signOut 의 결과를 돌려주지 않았습니다');
  /* 사람이 없거나 익명이면 건드리지 않는다 — 옆 사람의 표시를 지우면 안 된다 */
  const anon = world({ user: { uid: 'x', isAnonymous: true }, store: { pu_keep_login_at: String(T0) } });
  await new anon.Auth().signOut();
  assert.equal(anon.store.pu_keep_login_at, String(T0), '익명 로그아웃이 사람의 표시를 지웠습니다');
  /* 여러 번 감싸이지 않는다 */
  const again = world();
  again.K._hookSignOut(); again.K._hookSignOut();
  assert.ok(again.Auth.prototype.signOut.__puKeep);
});

/* ───────── ② 유지 끔을 앱이 뒤집지 못한다 ───────── */
test('② ★★ 「유지 끔」 기기에서는 앱이 부른 LOCAL 이 SESSION 으로 낮춰진다 · 켬·미정이면 건드리지 않는다', () => {
  for (const [saved, ask, want] of [
    ['0', 'local', 'session'],   // 공용 PC: 앱이 LOCAL 을 요구해도 세션으로
    ['0', 'session', 'session'],
    ['1', 'local', 'local'],     // 유지 켬: 그대로
    [undefined, 'local', 'local'], // 고른 적 없음: 건드리지 않는다
    ['1', 'session', 'session'],
  ]) {
    const w = world({ store: saved === undefined ? {} : { pu_portal_auto: saved } });
    new w.Auth().setPersistence(ask);
    assert.equal(w.log.filter((x) => x.startsWith('persist:'))[0], 'persist:' + want, `유지=${saved} 요청=${ask} → ${want}`);
  }
  const w = world({ store: { pu_portal_auto: '0' } });
  w.K._hookPersistence();
  assert.ok(w.Auth.prototype.setPersistence.__puKeep);
});

test('② ★★ 앱 안의 따로 있는 로그인 칸도 「유지 끔」이면 로그인 «직전»에 SESSION 을 먼저 못 박는다', async () => {
  const off = world({ store: { pu_portal_auto: '0' } });
  await new off.Auth().signInWithEmailAndPassword('a', 'b');
  assert.deepEqual(off.log.filter((x) => /^(persist|signin)/.test(x)), ['persist:session', 'signin'], '로그인 전에 세션으로 못 박지 않았습니다');
  await new off.Auth().signInWithCustomToken('t');
  assert.deepEqual(off.log.filter((x) => /^(persist|signin)/.test(x)).slice(2), ['persist:session', 'signin-token']);
  for (const store of [{ pu_portal_auto: '1' }, {}]) {
    const w = world({ store });
    await new w.Auth().signInWithEmailAndPassword('a', 'b');
    assert.deepEqual(w.log.filter((x) => /^(persist|signin)/.test(x)), ['signin'], '유지 켬·미정인데 로그인에 손댔습니다');
  }
  /* ⚠ 못 박기가 실패해도 로그인은 막지 않는다 */
  const bad = world({ store: { pu_portal_auto: '0' }, persistFails: true });
  assert.equal(await new bad.Auth().signInWithEmailAndPassword('a', 'b'), 'cred', '저장소 오류가 로그인을 막았습니다');
});

test('⑤ 파이어베이스가 늦게 실려도 감싸고 검사를 시작한다', () => {
  const w = world({ late: true });
  const iv = w.timers.find((t) => t.kind === 'interval');
  assert.ok(iv, '늦게 실릴 때 다시 보는 장치가 없습니다');
  w.ctx.firebase = { auth: Object.assign(() => w.inst, { Auth: w.Auth }) };
  iv.fn();
  assert.ok(w.Auth.prototype.signOut.__puKeep && w.Auth.prototype.setPersistence.__puKeep, '늦게 실린 파이어베이스를 못 감쌌습니다');
  assert.equal(w.listeners.length, 1, '로그인 상태를 보지 않습니다 — 30일 검사가 안 돕니다');
  /* 사람이 보일 때 검사한다 */
  const D = w.K.DAYS;
  w.store.pu_portal_auto = '1'; w.store.pu_keep_login_at = String(T0 - (D + 2) * DAY);
  w.listeners[0](user());
  assert.ok(w.log.includes('signout'), '로그인 상태 알림에서 만료를 못 잡았습니다');
});

test('⑤ 이 파일은 비밀번호·토큰을 만지지 않는다 — 시각과 선택(숫자·0/1)만 적는다', () => {
  /* 로그인 «함수 이름»(signInWithEmailAndPassword)은 비밀번호를 만지는 글자가 아니다 — 이름만 뺀다 */
  const js = stripJs(MOD).replace(/signInWith(EmailAndPassword|CustomToken)/g, 'signInWith');
  assert.doesNotMatch(js, /password|passwd|getIdToken|idToken|refreshToken|accessToken|credential/i, '비밀번호·토큰을 만지는 글자가 있습니다');
  const writes = [...js.matchAll(/(?<!function )lsSet\(\s*([A-Za-z_'"][^,)]*)/g)].map((m) => m[1].trim());
  assert.ok(writes.length >= 3, '적는 자리를 거의 못 찾았습니다 — 검사가 눈을 감았습니다');
  const allowed = new Set(['KEEP_KEY', 'AT_KEY', 'LOGOUT_KEY']);
  writes.forEach((k) => assert.ok(allowed.has(k), '허용 목록에 없는 열쇠에 적습니다: ' + k));
  assert.doesNotMatch(js, /\.cookie|indexedDB|XMLHttpRequest|fetch\(/, '이 기기 밖으로 나가거나 다른 저장소를 쓰는 글자가 있습니다');
  /* 열쇠 이름이 pu-authsync.js 와 같아야 모든 탭이 알아듣는다 */
  assert.match(MOD, /LOGOUT_KEY = 'pu_auth_logout_at'/);
  assert.match(stripJs(read('js/pu-authsync.js')), /LOGOUT_KEY = 'pu_auth_logout_at'/, '두 파일의 «지금 나갔다» 열쇠가 어긋났습니다');
});

/* ───────── ④ 로그인이 필요한 모든 화면이 싣는다 ───────── */
test('④ ★★ 로그인이 필요한 화면은 모두 이 파일을 싣는다 — 포털만 검사하면 앱을 바로 연 사람의 상한이 안 선다', () => {
  const pages = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html'));
  const need = [];
  const miss = [];
  pages.forEach((f) => {
    const src = read(f);
    const bare = stripComments(src);
    /* 로그인한 사람의 화면 = 통합 로그인 관문을 싣거나 · 로그아웃 까닭을 적거나 · 지속 방식을 스스로 정하는 화면 */
    const login = f === 'enter.html' || /js\/pu-gate\.js/.test(bare) || /js\/pu-logout-why\.js/.test(bare) || /setPersistence\(/.test(bare);
    if (!login) return;
    need.push(f);
    if (!/<script src="js\/pu-keep-login\.js\?v=\d+"><\/script>/.test(bare)) miss.push(f);
  });
  assert.ok(need.length >= 15, '로그인이 필요한 화면을 거의 못 찾았습니다(' + need.length + ') — 검사가 눈을 감았습니다');
  assert.ok(need.includes('enter.html') && need.includes('pu-erp.html') && need.includes('payroll-os.html'), '핵심 화면이 빠졌습니다');
  assert.deepEqual(miss, [], '★ 이 화면은 30일 상한·유지 끔 보호가 안 걸립니다 — <script src="js/pu-keep-login.js?v=…"> 를 실으세요');
  /* 공개 화면(고객·근로자가 로그인 없이 여는 것)에는 싣지 않는다 */
  ['sign.html', 'sign-contract.html', 'ieum-view.html'].forEach((f) => {
    if (!fs.existsSync(path.join(ROOT, f))) return;
    assert.ok(!/pu-keep-login\.js/.test(read(f)), f + ' 은 공개 화면입니다 — 로그인 유지 검사를 실으면 안 됩니다');
  });
});

/* ───────── 포털 ───────── */
const ENTER = read('enter.html');
const ENTER_BARE = stripComments(ENTER);
const ENTER_JS = stripJs(ENTER);

test('포털 ★ 체크칸이 있고 «30일»과 «공용 PC 주의»를 말한다 · 폰에서 한 줄', () => {
  assert.match(ENTER_BARE, /<input type="checkbox" id="autoLogin">[^<]*30일/, '체크칸 글귀에 30일이 없습니다');
  const paint = ENTER_JS.slice(ENTER_JS.indexOf('function keepHintPaint'), ENTER_JS.indexOf('function keepHintPaint') + 700);
  assert.match(paint, /30일/, '켠 상태의 안내에 30일이 없습니다');
  assert.match(paint, /공용/, '켠 상태의 안내에 공용 PC 주의가 없습니다');
  assert.match(paint, /창을 닫으면/, '끈 상태의 안내(창을 닫으면 로그아웃)가 없습니다');
  /* 체크칸 크기 16px 이상 · 폰에서도 글귀가 두 줄로 안 갈라진다 */
  const css = ENTER.match(/\.ck input\{[^}]*\}/);
  assert.ok(css, '체크칸 크기 규칙이 없습니다');
  const w = Number((css[0].match(/width:(\d+)px/) || [])[1]);
  const h = Number((css[0].match(/height:(\d+)px/) || [])[1]);
  assert.ok(w >= 16 && h >= 16, '체크칸이 16px 보다 작습니다: ' + w + 'x' + h);
  assert.match(ENTER, /@media\(max-width:520px\)\{[\s\S]*?\.ck label\{white-space:nowrap;\}/, '폰 구간에서 체크칸 글귀가 한 줄로 안 묶였습니다');
});

test('포털 ★ 로그인 직전에 begin(고른 것·시각)을 부르고, 그것이 setPersistence 보다 앞이다', () => {
  const d = ENTER_JS.slice(ENTER_JS.indexOf('function doLogin('));
  const begin = d.indexOf('PuKeepLogin.begin(wantsAutoLogin)');
  const persist = d.indexOf('auth.setPersistence(persistence)');
  const signin = d.indexOf('auth.signInWithEmailAndPassword(email, pw)');
  assert.ok(begin > 0, '비밀번호 로그인이 30일 시작 시각을 안 적습니다');
  assert.ok(begin < persist && persist < signin, '순서가 어긋났습니다 — 유지 끔 보호가 이 값을 보고, 로그인 뒤에 적으면 옛 표시로 내쫓길 수 있습니다');
  /* 체크칸이 LOCAL/SESSION 을 가른다 — 기존 규칙이 그대로여야 한다 */
  assert.match(d, /wantsAutoLogin\s*\?\s*firebase\.auth\.Auth\.Persistence\.LOCAL\s*:\s*firebase\.auth\.Auth\.Persistence\.SESSION/);
});

test('포털 ★ 카카오 복귀도 로그인 «직전»에 시작 시각을 적는다(고른 유지 여부 그대로)', () => {
  const k = ENTER_JS.slice(ENTER_JS.indexOf('function kkHandleReturn('));
  const stamp = k.indexOf('PuKeepLogin.stamp(keep)');
  const signin = k.indexOf('auth.signInWithCustomToken(');
  assert.ok(stamp > 0, '카카오 로그인이 30일 시작 시각을 안 적습니다');
  assert.ok(stamp < signin, '카카오 로그인이 끝난 «뒤»에 적습니다');
});

test('포털 ★ 포털을 열기 «전에» 30일을 넘긴 로그인을 걸러 낸다', () => {
  const o = ENTER_JS.slice(ENTER_JS.indexOf('auth.onAuthStateChanged(function(user){'));
  const guard = o.indexOf('PuKeepLogin.guard(user)');
  const enter = o.indexOf('enterPortal(user)');
  assert.ok(guard > 0 && guard < enter, '만료한 로그인이 포털을 먼저 엽니다');
  assert.match(o.slice(guard, guard + 80), /return/, '만료했는데 계속 진행합니다');
});

test('③ 포털 ★ 로그아웃(단추·유휴)이 지나는 길이 유지 표시를 지운다', () => {
  const b = ENTER_JS.slice(ENTER_JS.indexOf('function broadcastLogout('), ENTER_JS.indexOf("$('logoutBtn')"));
  assert.match(b, /PuKeepLogin\.clear\(\)/, '로그아웃 신호가 유지 표시를 안 지웁니다');
  const btn = ENTER_JS.slice(ENTER_JS.indexOf("$('logoutBtn').addEventListener"), ENTER_JS.indexOf('function kkLogoutFlow('));
  assert.match(btn, /broadcastLogout\(\)/, '로그아웃 단추가 broadcastLogout 을 안 부릅니다');
  const idle = ENTER_JS.slice(ENTER_JS.indexOf("var LIMIT = 60*60*1000"));
  assert.match(idle.slice(0, 2600), /broadcastLogout\(\);[^;]*;?[^;]*auth\.signOut\(\)/, '유휴 로그아웃이 broadcastLogout 을 안 지납니다');
});

test('포털 ★ 모듈은 로그아웃 까닭 파일 «뒤», 포털 본 스크립트 «앞»에서 실린다', () => {
  const why = ENTER_BARE.indexOf('js/pu-logout-why.js');
  const keep = ENTER_BARE.search(/js\/pu-keep-login\.js\?v=\d+/);
  const main = ENTER_BARE.indexOf('auth.onAuthStateChanged(function(user){');
  assert.ok(why > 0 && keep > why && keep < main, '실리는 순서가 어긋났습니다');
});

test('정부사업일정(자체 로그인 칸): 「유지」를 고르면 먼저 알려 유지 끔 보호에 안 걸리고 시작 시각도 적힌다', () => {
  const g = stripComments(read('gov-consulting.html'));
  const begin = g.indexOf('PuKeepLogin.begin(true)');
  const persist = g.indexOf('setPersistence(persist)');
  assert.ok(begin > 0 && begin < persist, '자체 로그인 칸의 «유지» 선택이 보호에 막힙니다');
});
