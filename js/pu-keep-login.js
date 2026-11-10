/* ══════════════════════════════════════════════════════════════
   푸른 통합시스템 — 「내 기기에서 30일간 로그인 유지」 (대표 요청 2026-11-10
   「로그인 할 경우 30일 피시에서 본인 컴퓨터인 경우 로그인 연속가능기능 및 체크기능 만들어줘」)

   ── 이미 있던 것 ─────────────────────────────────────────────
   · 포털 로그인 화면의 「이 기기에서 로그인 유지」 칸(#autoLogin) → 켜면 파이어베이스 LOCAL 지속,
     끄면 SESSION 지속(창을 닫으면 로그아웃). 고른 것은 pu_portal_auto 에 '1'/'0' 으로 남는다.
   · 포털 로그아웃 단추·유휴 로그아웃·다른 창 로그아웃 신호(pu-authsync).

   ── 없던 것(이 파일이 채운다) ────────────────────────────────
   ① 30일 «상한» — 파이어베이스 LOCAL 지속은 로그아웃하기 전까지 «영원히» 남는다.
      그래서 로그인한 때(pu_keep_login_at)를 적어 두고, 30일이 넘으면 스스로 로그아웃한다.
      ★ 포털뿐 아니라 «앱을 바로 연 때»(바탕화면 아이콘·폰 앱)에도 같은 검사가 돌아야 상한이 선다 —
        그래서 로그인이 필요한 모든 화면이 이 파일을 싣는다(tests/keep-login-30days.test.js).
   ② 「유지 끔」 을 앱이 몰래 뒤집지 못하게 — 경력관리·정부사업·홈페이지관리 등 여러 앱이 시작할 때
      setPersistence(LOCAL) 을 «무조건» 부른다. 파이어베이스는 그때 지금 로그인을 LOCAL 로 «옮긴다» —
      공용 PC 에서 유지를 끈 사람이 앱을 한 번 열면 «영원히 남는» 로그인이 돼 버린다.
      그래서 이 기기가 「유지 끔」(pu_portal_auto='0')이면 LOCAL 요청을 SESSION 으로 낮춘다.
      (고른 적이 없으면 건드리지 않는다. 앱이 자기 로그인 칸에서 «유지»를 고른 경우는 begin(true) 로 먼저 말한다.)
   ③ 로그아웃하면 표시(pu_keep_login_at)도 지운다 — 로그아웃은 «어디서 불러도» 파이어베이스 signOut 을
      지나므로 한 곳에서 감싼다(pu-logout-why.js 와 같은 방식).

   ── 안 하는 것 ───────────────────────────────────────────────
   ⚠ 비밀번호·토큰을 저장하지 않는다 — 시각 하나(숫자)만 적는다. 로그인 지속은 파이어베이스 몫이다.
   ⚠ 「유지 켬」 이 «기록 없이» 켜져 있던 기기(이 기능 이전에 로그인한 기기)는 지금부터 30일을 센다.
   ⚠ 로그인 시각의 기준은 «진짜 로그인» 이다. 토큰이 새로 고쳐지거나 앱을 여는 것은 시각을 미루지 않는다.
   ⚠ 급여·관리자 화면을 더 강하게 지키는 일(2중 로그인·자리비움 잠금)은 여기서 하지 않는다 — 별개 결정이다.
   ══════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  var KEEP_KEY = 'pu_portal_auto';        // 포털 「로그인 유지」 칸의 선택 '1'/'0' (기존 열쇠 — 다른 파일이 같이 본다)
  var AT_KEY = 'pu_keep_login_at';        // 로그인한 때(ms) — 이 기기에서 «유지»로 로그인한 때만 있다
  var LOGOUT_KEY = 'pu_auth_logout_at';   // pu-authsync.js 의 LOGOUT_KEY 와 «같아야» 한다
  var KEEP_DAYS = 30;                     // 대표 요청 «30일» — 바꾸려면 화면 글귀(enter.html)도 함께
  var DAY = 864e5;
  var CHECK_MS = 10 * 60 * 1000;          // 켜 둔 채 30일을 넘기는 화면을 위해 가끔 다시 본다
  var FALLBACK_MS = 4000;                 // authsync 가 밀어내기를 기다리는 시간(그 파일의 GRACE 2.5초 + 여유)

  function lsGet(k) { try { return global.localStorage.getItem(k) || ''; } catch (e) { return ''; } }
  function lsSet(k, v) { try { global.localStorage.setItem(k, String(v)); } catch (e) { } }
  function lsDel(k) { try { global.localStorage.removeItem(k); } catch (e) { } }
  function now() { return Date.now(); }

  function isKeep() { return lsGet(KEEP_KEY) === '1'; }

  /* 로그인한 때를 적는다(켰을 때만) — 끄면 지운다. 로그인 «직전»에 부른다:
     로그인이 끝나는 순간 파이어베이스가 곧바로 상태를 알리므로, 뒤에 적으면 옛 표시로 «방금 로그인한 사람»을
     내보낼 수 있다. */
  function stamp(keep, at) {
    if (keep) lsSet(AT_KEY, at == null ? now() : at);
    else lsDel(AT_KEY);
  }
  /* 로그인을 시작한다 — 고른 것(유지 여부)과 시각을 함께 적는다. setPersistence 보다 «먼저» 부른다. */
  function begin(keep, at) {
    lsSet(KEEP_KEY, keep ? '1' : '0');
    stamp(keep, at);
    return !!keep;
  }
  function clear() { lsDel(AT_KEY); }

  /* 파이어베이스가 알려 주는 «진짜 마지막 로그인» — 없으면 0 */
  function lastLoginAt(user) {
    try {
      var m = user && user.metadata;
      if (!m) return 0;
      var t = Date.parse(m.lastSignInTime);
      if (!isFinite(t)) t = Number(m.lastLoginAt);
      return (isFinite(t) && t > 0) ? t : 0;
    } catch (e) { return 0; }
  }

  /* 지금 이 사람의 유지가 어떤 상태인가
       'none'    사람이 아니다(로그인 없음·익명)
       'off'     유지를 껐다 — 창을 닫으면 끝나는 로그인(세션 지속)이라 시각을 안 본다
       'started' 유지를 켰는데 시각 기록이 없다(이 기능 이전 로그인) — 지금부터 센다
       'ok'      30일 안이다
       'expired' 30일이 지났다 */
  function judge(user, at) {
    var t = at == null ? now() : at;
    if (!user || user.isAnonymous) return 'none';
    if (!isKeep()) return 'off';
    var mark = Number(lsGet(AT_KEY)) || 0;
    if (!mark) { lsSet(AT_KEY, t); return 'started'; }
    /* 표시보다 «더 새 로그인»이 있으면 그것이 기준이다 — 앱이 자기 로그인 칸으로 새로 들어온 경우
       (표시를 못 적은 길)에 옛 표시 때문에 방금 로그인한 사람을 내보내지 않게. 서버 시계가 앞서도 미래 시각은 안 적는다. */
    var since = Math.min(Math.max(mark, lastLoginAt(user)), t);
    if (since > mark) lsSet(AT_KEY, since);
    return (t - since >= KEEP_DAYS * DAY) ? 'expired' : 'ok';
  }

  function authOrNull() {
    try { return (global.firebase && global.firebase.auth && global.firebase.auth()) || null; } catch (e) { return null; }
  }

  /* 다른 탭·앱에 «지금 나갔다» 를 알린다 — authsync 가 있으면 그쪽 길(같은 열쇠)을 그대로 쓴다 */
  function broadcast() {
    try {
      if (global.PuAuthSync && typeof global.PuAuthSync.broadcastLogout === 'function') { global.PuAuthSync.broadcastLogout(); return; }
    } catch (e) { }
    lsSet(LOGOUT_KEY, now());
    lsDel('pu_auth_uid');
    lsDel('pureun_v6_autologin_sid');
    try { global.sessionStorage.removeItem('pureun_v6_session_sid'); } catch (e) { }
  }

  var expiring = false;
  /* 30일이 지났다 — 이 기기의 로그인을 끊는다(모든 탭·앱까지). 두 번 부르지 않는다. */
  function expire() {
    if (expiring) return false;
    expiring = true;
    try { if (global.PuLogoutWhy) global.PuLogoutWhy.why('로그인 유지 ' + KEEP_DAYS + '일 만료'); } catch (e) { }
    broadcast();
    clear();
    var a = authOrNull();
    /* 끊기가 끝나면(사람이 없어지면) 다시 «다음 로그인»을 받을 수 있게 푼다 — 안 풀면 같은 화면에서 새로 로그인한 사람을 막는다 */
    var done = function () { expiring = false; };
    try {
      var r = (a && typeof a.signOut === 'function') ? a.signOut() : null;
      if (r && typeof r.then === 'function') r.then(done, done); else done();
    } catch (e) { done(); }
    /* 로그인 화면으로 보내는 일은 앱마다 다르다 — authsync 를 싣는 앱은 스스로 밀어낸다.
       그것이 안 일어난 화면(authsync 없는 앱)만 «로그인이 필요합니다» 화면을 씌우거나 포털로 보낸다.
       ⚠ 로그인 칸이 있는 화면(포털·정부사업일정)은 제 화면이 로그인 칸을 보여 주니 건드리지 않는다. */
    try {
      global.setTimeout(function () {
        try {
          var d = global.document;
          if (d && d.getElementById && d.getElementById('loginPw')) return;
          if (global.PuAuthSync && global.PuAuthSync._wasKicked && global.PuAuthSync._wasKicked()) return;
          if (global.PuGate && typeof global.PuGate.show === 'function') { global.PuGate.show(); return; }
          global.location.replace('enter.html?v=' + now());
        } catch (e) { }
      }, FALLBACK_MS);
    } catch (e) { }
    return true;
  }

  /* 사람이 보일 때마다 부른다 — 30일이 지났으면 내보내고 true */
  function guard(user, at) {
    /* 끊는 중이다 — 이 사람은 이미 내보내는 중이므로 시각을 다시 적지 않는다(표시를 지운 뒤라 «처음 본 사람»으로 오해해 30일을 새로 주게 된다) */
    if (expiring) return !!(user && !user.isAnonymous);
    if (judge(user, at) === 'expired') { expire(); return true; }
    return false;
  }

  /* ② 앱이 부르는 setPersistence(LOCAL) 을, 이 기기가 「유지 끔」일 때는 SESSION 으로 낮춘다 */
  function pickPersistence(p) {
    try {
      var P = global.firebase.auth.Auth.Persistence;
      if (p === P.LOCAL && lsGet(KEEP_KEY) === '0') return P.SESSION;
    } catch (e) { }
    return p;
  }
  function hookPersistence() {
    var A = global.firebase && global.firebase.auth && global.firebase.auth.Auth;
    var P = A && A.prototype;
    if (!P || typeof P.setPersistence !== 'function') return false;
    if (P.setPersistence.__puKeep) return true;
    var orig = P.setPersistence;
    var wrapped = function () {
      var args = Array.prototype.slice.call(arguments);
      args[0] = pickPersistence(args[0]);
      return orig.apply(this, args);
    };
    wrapped.__puKeep = true;
    P.setPersistence = wrapped;
    return true;
  }
  /* ②-2 앱 «안에» 따로 있는 로그인 칸(푸른이알피·급여아웃소싱·정부사업·경력관리)은 setPersistence 를 안 부르거나
     부르기 전에 로그인한다 — 파이어베이스 기본은 LOCAL(영원히 남음)이라, 「유지 끔」 기기에서 그 칸으로 들어오면 공용 PC 에 남는다.
     그래서 이 기기가 「유지 끔」이면 로그인 «직전»에 SESSION 을 먼저 못 박는다.
     ⚠ 못 박기가 실패해도 로그인은 막지 않는다 — 이 파일 때문에 아무도 못 들어오면 안 된다(저장소가 막혔으면 파이어베이스가 알아서 알린다). */
  function hookSignIn(name) {
    var A = global.firebase && global.firebase.auth && global.firebase.auth.Auth;
    var P = A && A.prototype;
    if (!P || typeof P[name] !== 'function') return false;
    if (P[name].__puKeep) return true;
    var orig = P[name];
    var wrapped = function () {
      var self = this, args = arguments;
      var go = function () { return orig.apply(self, args); };
      try {
        if (lsGet(KEEP_KEY) === '0' && typeof P.setPersistence === 'function') {
          var r = P.setPersistence.call(self, global.firebase.auth.Auth.Persistence.SESSION);
          if (r && typeof r.then === 'function') return r.then(go, go);
        }
      } catch (e) { }
      return go();
    };
    wrapped.__puKeep = true;
    P[name] = wrapped;
    return true;
  }
  /* ③ 어디서 로그아웃하든 표시를 지운다 */
  function hookSignOut() {
    var A = global.firebase && global.firebase.auth && global.firebase.auth.Auth;
    var P = A && A.prototype;
    if (!P || typeof P.signOut !== 'function') return false;
    if (P.signOut.__puKeep) return true;
    var orig = P.signOut;
    var wrapped = function () {
      try { if (this && this.currentUser && !this.currentUser.isAnonymous) clear(); } catch (e) { }
      return orig.apply(this, arguments);
    };
    wrapped.__puKeep = true;
    P.signOut = wrapped;
    return true;
  }

  var started = false;
  function recheck() {
    var a = authOrNull();
    if (a && a.currentUser) guard(a.currentUser);
  }
  /* ① 사람이 보일 때·깨어날 때·가끔 — 30일 검사 */
  function start() {
    if (started) return true;
    var a = authOrNull();
    if (!a || typeof a.onAuthStateChanged !== 'function') return false;
    started = true;
    try { a.onAuthStateChanged(function (u) { guard(u); }); } catch (e) { }
    try { global.addEventListener('focus', recheck); } catch (e) { }
    try { global.addEventListener('pageshow', recheck); } catch (e) { }
    try {
      var d = global.document;
      if (d && d.addEventListener) d.addEventListener('visibilitychange', function () { if (!d.hidden) recheck(); });
    } catch (e) { }
    try { global.setInterval(recheck, CHECK_MS); } catch (e) { }
    return true;
  }

  function tick() {
    var h = hookPersistence();
    h = hookSignIn('signInWithEmailAndPassword') && h;
    h = hookSignIn('signInWithCustomToken') && h;
    h = hookSignOut() && h;
    return start() && h;
  }

  global.PuKeepLogin = {
    DAYS: KEEP_DAYS,
    begin: begin, stamp: stamp, clear: clear,
    judge: judge, guard: guard, expire: expire,
    isKeep: isKeep, lastLoginAt: lastLoginAt,
    // 검사용
    _tick: tick, _pick: pickPersistence, _hookPersistence: hookPersistence, _hookSignOut: hookSignOut, _hookSignIn: hookSignIn,
    _key: AT_KEY, _keepKey: KEEP_KEY, _logoutKey: LOGOUT_KEY
  };

  /* 파이어베이스는 화면마다 늦게 준비된다 — 준비될 때까지 몇 번 다시 본다(pu-logout-why.js 와 같은 방식).
     setPersistence 를 앱이 부르기 «전에» 감싸야 하므로 처음 한 번은 곧바로 시도한다. */
  if (!tick()) {
    var n = 0;
    var t = global.setInterval(function () {
      if (tick() || ++n > 120) global.clearInterval(t);   // 250ms × 120 = 30초까지만(파이어베이스를 안 쓰는 화면)
    }, 250);
  }
})(typeof window !== 'undefined' ? window : this);
