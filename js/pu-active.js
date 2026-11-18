/* ══════════════════════════════════════════════════════════════
   푸른 통합시스템 — «지금 쓰고 있다» 를 모든 앱이 함께 적는다
   2026-09-30 (대표 지시 「화면에서 잠시 나갔다 들어오거나 화면이 로그아웃된것처럼
                이 화면이 자꾸 나오고 앱으로 넘어간다. 이유가 뭔지 검토하고 해결해라」)

   ── 왜 그랬나 ────────────────────────────────────────────────
   60분 자동 로그아웃은 모든 앱이 «한 시각» 을 본다 — localStorage 의 pu_last_active.
   그런데 그 시각을 적는 것은 포털·이알피·정부사업일정·기업정보함·취업규칙 다섯뿐이었다.
   캘린더·사진첩·업무관리 등에서 한 시간을 일해도 «아무것도 안 했다» 로 쳐서,
   뒤에 열려 있던 포털·이알피 창이 60분이 되는 순간 «전체 로그아웃» 을 걸었다.
   (그 창의 시계는 뒤에 있는 동안 느리게 돌다가 화면을 돌리는 순간 한꺼번에 돈다 —
    그래서 «돌아오면» 로그인 화면이 뜬다.)

   ── 무엇을 하나 ──────────────────────────────────────────────
   누르기·치기·굴리기·움직이기를 보면 그 시각을 적는다(5초에 한 번만 — 저장이 무겁다).
   로그아웃은 하지 않는다. 판정은 지금처럼 포털·이알피 등의 타이머가 한다.

   ⚠ 이미 60분이 지난 뒤에는 «적지 않는다» — 자리를 비운 사이 누가 와서 마우스를
     건드리면 시계가 되살아나 자동 로그아웃이 영영 안 걸린다(공용 PC).
     예외: 「이 기기에서 로그인 유지」 를 켠 기기(pu_portal_auto=1)는 원래 떠나 있는 동안
     시계가 멈추므로 적는다(포털·이알피의 resumeAutoSession 과 같은 뜻).

   ── 로그인 방식마다 시간이 다르다 (대표 지시 2026-11-18) ──────────
   「아이디·비번으로 로그인하면 1시간 제한, 계속 작업하면 연장. 카카오톡 로그인은 3시간으로,
    계속 작업 중이면 안 끊기게」
     · 아이디·비번(그 밖 모든 방식) → 포털 설정 시간(비우면 60분)
     · 카카오                        → 3시간. 포털 설정이 그보다 길면 설정을 따른다(더 짧게 하지 않는다)
     · 둘 다 «마지막으로 움직인 때»부터 잰다 — 움직이면 다시 처음부터(지금과 같다).
   카카오인지는 서버가 서명한 인증표의 kakao:true 표시로 가린다(functions/kakao.js 가 넣는다).
   그 결과를 pu_login_via 에 {uid, via, at} 로 적어 두고 모든 앱이 같은 값을 읽는다.
   ★ 자동 로그아웃을 거는 다섯 화면(포털·이알피·정부사업일정·기업정보함·규정관리)은
     제 시계의 시간을 PuActive.limitMs(제 기본값) 로 물어 쓴다 — 판정은 이 파일 한 곳뿐이다.
   ⚠ 다른 사람이 남긴 표시(uid 가 다름)는 믿지 않는다. 더 새 로그인의 표시를 옛 것이 덮지 않는다.

   ── 쓰는 법 ─────────────────────────────────────────────────
     <script src="js/pu-active.js?v=2"></script>   (로그인이 필요한 앱에 한 줄)
   ⚠ 공개 화면에는 넣지 않는다 — 거기엔 지킬 로그인이 없다.
     (포털 enter.html 은 로그인 화면이자 자동 로그아웃을 거는 곳이라 싣는다 — 시간을 여기서 묻는다.)
   ══════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  if (global.PuActive) return;                  // 두 번 실려도 한 번만

  var AKEY = 'pu_last_active';
  var AUTO_KEY = 'pu_portal_auto';
  var VIA_KEY = 'pu_login_via';
  var EVERY_MS = 5000;                          // 이보다 자주 적지 않는다
  var DEFAULT_LIMIT = 60 * 60 * 1000;
  var KAKAO_LIMIT = 3 * 60 * 60 * 1000;         // 카카오 로그인 3시간 (대표 지시 2026-11-18)
  var lastMark = 0;
  var checkedKey = '';                          // 인증표를 이미 읽은 로그인 (uid|마지막 로그인 때)
  var RETRY_MS = 60 * 1000;                     // 인증표 읽기가 실패하면 이만큼 쉬었다 다시(시계가 매초 묻는다)
  var retryAt = 0;

  function lsGet(k) { try { return global.localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { global.localStorage.setItem(k, v); return true; } catch (e) { return false; } }

  /* 포털 공용 설정의 자동 로그아웃 시간 — 포털·이알피와 같은 잣대(10~480분만 인정) */
  function baseMs() {
    try {
      var m = parseInt(global.PU_CFG && global.PU_CFG.idleMinutes, 10);
      if (m >= 10 && m <= 480) return m * 60 * 1000;
    } catch (e) { }
    return DEFAULT_LIMIT;
  }

  /* 지금 로그인한 사람 — 파이어베이스가 아직 없거나 앱을 안 열었으면 null */
  function authUser() {
    try {
      var fb = global.firebase;
      if (!fb || !fb.apps || !fb.apps.length || typeof fb.auth !== 'function') return null;
      return fb.auth().currentUser || null;
    } catch (e) { return null; }
  }

  function readVia() {
    try {
      var r = JSON.parse(lsGet(VIA_KEY) || 'null');
      return (r && typeof r === 'object' && r.uid) ? r : null;
    } catch (e) { return null; }
  }

  /* 어떻게 로그인했나를 적는다 — via: 'kakao' | 'password' | 그 밖
     at: 그 로그인이 일어난 때(ms). 같은 사람의 더 새 기록은 옛 기록으로 덮지 않는다.
     ⚠ at 은 «서버 시각» 으로 적는다(인증표 authTime · user.metadata.lastSignInTime) —
       기기 시계(Date.now)와 섞으면 시계가 앞선 PC 에서 새 로그인 기록이 «더 옛 것» 으로 거절된다(검토 지적 2026-11-18). */
  function noteVia(uid, via, at) {
    if (!uid) return false;
    var t = Number(at) || 0;
    var old = readVia();
    // 때를 모르면(0) 막 일어난 로그인으로 보고 적는다 — 옛 표시가 새 로그인을 붙잡지 않게
    if (old && old.uid === String(uid) && t > 0 && Number(old.at) > t) return false;
    return lsSet(VIA_KEY, JSON.stringify({ uid: String(uid), via: String(via || 'other'), at: t }));
  }

  /* 인증표를 한 번 읽어 «카카오인지» 를 바로잡는다 — 로그인이 바뀌면 다시 읽는다.
     ⚠ 인증표의 kakao 표시는 서버가 서명한 것이라 브라우저 값보다 믿을 만하다. */
  function checkVia() {
    var u = authUser();
    if (!u || !u.uid || typeof u.getIdTokenResult !== 'function') return;
    var key = u.uid + '|' + ((u.metadata && u.metadata.lastSignInTime) || '');
    if (key === checkedKey) return;
    if (Date.now() < retryAt) return;            // 방금 실패했다 — 매초 다시 부르지 않는다
    checkedKey = key;
    var fail = function () { checkedKey = ''; retryAt = Date.now() + RETRY_MS; };
    try {
      u.getIdTokenResult().then(function (r) {
        var c = (r && r.claims) || {};
        var at = Date.parse((r && r.authTime) || '') || 0;
        noteVia(u.uid, c.kakao === true ? 'kakao' : ((r && r.signInProvider) || 'other'), at);
      }, fail);
    } catch (e) { fail(); }
  }

  /* 로그인 직후 그 사람의 «서버가 적은 로그인 때»(ms) — 없으면 0 */
  function signInAt(user) {
    try { return Date.parse((user && user.metadata && user.metadata.lastSignInTime) || '') || 0; } catch (e) { return 0; }
  }

  /* 카카오로 들어왔나 — 다른 사람이 남긴 표시는 믿지 않는다.
     파이어베이스가 아직 사람을 못 띄웠으면(새로 연 화면의 첫 1~2초) 적힌 표시를 따른다. */
  function isKakao() {
    var r = readVia();
    if (!r || r.via !== 'kakao') return false;
    var u = authUser();
    if (u && u.uid && r.uid !== String(u.uid)) return false;
    return true;
  }

  /* 자동 로그아웃 시간 — base 를 주면 그 화면의 기본값(포털 설정 반영)을 쓴다 */
  function limitMs(base) {
    var b = (typeof base === 'number' && base > 0) ? base : baseMs();
    checkVia();
    return isKakao() ? Math.max(b, KAKAO_LIMIT) : b;
  }

  /* 적어도 되나 — 이미 시간이 다 된 시계는 되살리지 않는다 */
  function mayMark(now) {
    if (lsGet(AUTO_KEY) === '1') return true;
    var last = parseInt(lsGet(AKEY) || '0', 10);
    if (!(last > 0)) return true;               // 아직 아무도 안 적었다
    return (now - last) < limitMs();
  }

  function mark() {
    var now = Date.now();
    if (now - lastMark < EVERY_MS) return false;
    if (!mayMark(now)) return false;
    lastMark = now;
    return lsSet(AKEY, String(now));
  }

  ['pointerdown', 'keydown', 'wheel', 'touchstart', 'pointermove', 'scroll'].forEach(function (ev) {
    try { global.addEventListener(ev, mark, { passive: true, capture: true }); } catch (e) { }
  });

  global.PuActive = {
    mark: mark,
    limitMs: limitMs,       // 자동 로그아웃 시간 — 다섯 화면의 시계가 묻는다
    noteVia: noteVia,       // 로그인 직후 «어떻게 들어왔나» 를 적는다(포털)
    signInAt: signInAt,     // noteVia 에 넘길 서버 시각
    isKakao: isKakao,
    // 검사용
    _mayMark: mayMark,
    _limitMs: limitMs,
    _reset: function () { lastMark = 0; checkedKey = ''; retryAt = 0; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
