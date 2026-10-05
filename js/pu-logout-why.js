/* ══════════════════════════════════════════════════════════════
   푸른 통합시스템 — «왜 로그아웃됐나» 를 그 기기에 적어 둔다 (대표 지시 2026-10-05)

   대표 보고: 「폰에서 🏠 를 누르면 로그인 화면이 계속 나온다 — 안 나오게 할 수 없나?」

   ── 무엇을 알았나 ────────────────────────────────────────────
   · 폰은 9/30 저녁부터 10/5 저녁까지 다시 로그인한 적이 없다 — 평소엔 유지가 된다.
   · 그날 로그인 화면에 「지문·간편 로그인 (P-001)」 단추가 떠 있었다 = localStorage 는 살아 있었다.
     크롬이 사이트 저장소를 통째로 비웠다면 그것도 사라졌어야 한다.
   · 그러니 «어딘가에서» 로그아웃이 불렸을 가능성이 크다. 그런데 어디서·왜인지 기록이 없었다.

   ── 무엇을 하나 ──────────────────────────────────────────────
   ① 파이어베이스 signOut 을 «한 곳에서» 감싸, 부르는 순간 { 언제·어느 화면·까닭·쉰 분·
      화면이 뒤에 있었나·로그인 유지 켰나 } 를 localStorage(pu_logout_why)에 적는다.
      ★ 앱마다 signOut 을 따로 부르므로(열세 곳) 하나씩 고치면 반드시 빠진다 — 그래서 감싼다.
      까닭을 아는 자리는 부르기 직전에 PuLogoutWhy.why('…') 로 말을 붙인다(없으면 화면 이름만).
   ② 로그인한 사람을 볼 때마다 PuLogoutWhy.seen() — «마지막으로 로그인돼 있던 때».
   ③ 로그인 화면은 PuLogoutWhy.last() 로 «지난번에 왜 풀렸나»를 한 줄 보여 준다.
      기록 없이 풀렸으면(로그아웃이 불리지 않았는데 로그인이 사라짐) 그렇다고 말한다 —
      그것이 «브라우저가 로그인 정보를 지웠다»의 증거다.
   ④ PuLogoutWhy.persist() — 로그인 유지를 켠 기기는 크롬에 «이 사이트 저장소는 비우지 말라»
      (navigator.storage.persist)를 청한다. 크롬은 묻지 않고 허락·거절만 한다.

   ⚠ 서버로 보내지 않는다 — 이 기기 안에만 둔다(어느 화면을 썼는지는 남에게 보일 것이 아니다).
   ⚠ 감싸기만 한다 — 로그아웃은 원래대로 일어난다. 기록이 실패해도 로그아웃은 막지 않는다.
   ══════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  var WHY_KEY = 'pu_logout_why', SEEN_KEY = 'pu_login_seen_at', ACT_KEY = 'pu_last_active', AUTO_KEY = 'pu_portal_auto';
  var KEEP_DAYS = 7;   // 이보다 오래된 기록은 «지난번»이라 하지 않는다

  function lsGet(k) { try { return global.localStorage.getItem(k) || ''; } catch (e) { return ''; } }
  function lsSet(k, v) { try { global.localStorage.setItem(k, v); } catch (e) { } }
  function now() { return Date.now(); }
  function pageName() {
    try { return String(global.location.pathname || '').split('/').pop() || 'enter.html'; } catch (e) { return ''; }
  }
  var pending = '';
  /* 까닭을 아는 자리 — signOut 을 부르기 «직전»에 */
  function why(reason) { pending = String(reason || ''); }
  function note(reason) {
    var last = Number(lsGet(ACT_KEY) || 0);
    var rec = {
      at: now(), page: pageName(), why: String(reason || '로그아웃'),
      idleMin: last ? Math.max(0, Math.round((now() - last) / 60000)) : null,
      hidden: !!(global.document && global.document.hidden),
      keep: lsGet(AUTO_KEY) === '1'
    };
    lsSet(WHY_KEY, JSON.stringify(rec));
    return rec;
  }
  function seen() { lsSet(SEEN_KEY, String(now())); }
  /* 지난번에 왜 풀렸나 — {kind:'why', rec} · {kind:'silent', seenAt} · null(말할 것 없음) */
  function last(at) {
    var t = (typeof at === 'number') ? at : now();
    var rec = null; try { rec = JSON.parse(lsGet(WHY_KEY) || 'null'); } catch (e) { rec = null; }
    var seenAt = Number(lsGet(SEEN_KEY) || 0);
    var fresh = function (x) { return x && (t - x) <= KEEP_DAYS * 864e5; };
    if (rec && rec.at && rec.at >= seenAt && fresh(rec.at)) return { kind: 'why', rec: rec };
    if (seenAt && fresh(seenAt) && !(rec && rec.at >= seenAt)) return { kind: 'silent', seenAt: seenAt };
    return null;
  }
  function fmt(ms) {
    var d = new Date(ms), p = function (n) { return (n < 10 ? '0' : '') + n; };
    return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  /* 로그인 화면에 붙일 한 줄 */
  function text(at) {
    var L = last(at); if (!L) return '';
    if (L.kind === 'why') {
      var r = L.rec;
      return '지난번 로그아웃 — ' + fmt(r.at) + ' · ' + (r.page || '?') + ' · ' + r.why
        + (r.idleMin != null ? ' · ' + r.idleMin + '분 쉼' : '') + (r.hidden ? ' · 화면이 뒤에 있음' : '')
        + (r.keep ? ' · 로그인 유지 켬' : ' · 로그인 유지 꺼짐');
    }
    return '지난번 로그인(' + fmt(L.seenAt) + ' 이후)이 로그아웃 단추·자동 로그아웃 없이 풀렸습니다 — 브라우저가 로그인 정보를 지웠거나 서버가 끊은 것으로 보입니다';
  }
  /* 로그인 유지를 켠 기기 — 저장소를 비우지 말라고 청한다(이미 허락됐으면 다시 안 묻는다) */
  function persist() {
    try {
      var s = global.navigator && global.navigator.storage;
      if (!s || !s.persist || lsGet(AUTO_KEY) !== '1') return Promise.resolve(false);
      return (s.persisted ? s.persisted() : Promise.resolve(false)).then(function (on) {
        return on ? true : s.persist();
      }).catch(function () { return false; });
    } catch (e) { return Promise.resolve(false); }
  }
  /* ① signOut 감싸기 — 파이어베이스가 늦게 실릴 수 있어 몇 번 다시 본다 */
  function hook() {
    var A = global.firebase && global.firebase.auth && global.firebase.auth.Auth;
    var P = A && A.prototype;
    if (!P || typeof P.signOut !== 'function') return false;
    if (P.signOut.__puWhy) return true;
    var orig = P.signOut;
    var wrapped = function () {
      var r = pending; pending = '';
      try { if (this && this.currentUser && !this.currentUser.isAnonymous) note(r || '로그아웃'); } catch (e) { }
      return orig.apply(this, arguments);
    };
    wrapped.__puWhy = true;
    P.signOut = wrapped;
    return true;
  }
  if (!hook()) {
    var n = 0, t = global.setInterval(function () { if (hook() || ++n > 40) global.clearInterval(t); }, 250);
  }
  global.PuLogoutWhy = { why: why, note: note, seen: seen, last: last, text: text, persist: persist, _hook: hook };
})(typeof window !== 'undefined' ? window : this);
