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

   ── 쓰는 법 ─────────────────────────────────────────────────
     <script src="js/pu-active.js?v=1"></script>   (로그인이 필요한 앱에 한 줄)
   ⚠ 로그인 화면·공개 화면에는 넣지 않는다 — 거기엔 지킬 로그인이 없다.
   ══════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  if (global.PuActive) return;                  // 두 번 실려도 한 번만

  var AKEY = 'pu_last_active';
  var AUTO_KEY = 'pu_portal_auto';
  var EVERY_MS = 5000;                          // 이보다 자주 적지 않는다
  var DEFAULT_LIMIT = 60 * 60 * 1000;
  var lastMark = 0;

  function lsGet(k) { try { return global.localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { global.localStorage.setItem(k, v); return true; } catch (e) { return false; } }

  /* 포털 공용 설정의 자동 로그아웃 시간 — 포털·이알피와 같은 잣대(10~480분만 인정) */
  function limitMs() {
    try {
      var m = parseInt(global.PU_CFG && global.PU_CFG.idleMinutes, 10);
      if (m >= 10 && m <= 480) return m * 60 * 1000;
    } catch (e) { }
    return DEFAULT_LIMIT;
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
    // 검사용
    _mayMark: mayMark,
    _limitMs: limitMs,
    _reset: function () { lastMark = 0; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
