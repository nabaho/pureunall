/* 로그아웃 화면 — 푸른 통합 안의 «모든» 프로그램이 같은 화면을 쓴다
 *   (대표 지시 2026-08-28 「같은 화면으로」 · 2026-09-14 「모두 캡쳐1의 모습으로 변경해달라. 찾아서」)
 *
 * ★ 2026-09-14 무엇이 있었나 — 실측으로 훑어 보니 네 갈래였다
 *     ㉠ 자물쇠 화면(경력관리·푸른이알피·취업규칙)  ← 대표가 «이것»으로 정하셨다
 *     ㉡ 카드 화면(업무관리·기금관리·급여데이터함·홈페이지관리·뉴스레터)
 *     ㉢ 제각각 글귀(정부사업신청·기업정보함·정부사업일정)
 *     ㉣ 아무것도 없거나 포털로 그냥 튕김(사진첩·취업규칙·문서관리·급여관리)
 *   ㉣ 가 특히 나쁘다 — 포털로 튕기면 «로그인 창»이 뜨는데, 대표는 자기가 무엇을
 *   누르다 그리로 갔는지 알 수가 없다. 그래서 그 길을 없애고 모두 ㉠ 으로 맞춘다.
 *
 * ★ 어떤 모양인가 (경력관리가 쓰던 것을 그대로 떴다)
 *     🔒
 *     통합시스템 로그인이 필요합니다
 *     로그아웃되었거나 세션이 만료되었습니다.
 *     푸른 통합시스템에서 로그인한 뒤 이용하세요.
 *     [🏠 통합시스템으로 이동]
 *
 *   ⚠ 프로그램 «이름을 안 쓴다» — 대표가 고르신 화면에 이름이 없다.
 *     옛 카드 화면은 이름을 썼기에 부르는 쪽이 {name,desc} 를 넘겼다. 지금은 안 쓴다
 *     (넘겨도 조용히 무시한다 — 옛 부름이 죽지 않게). 부르는 자리도 함께 지웠다.
 *   ⚠ 통합 포털(enter.html)에는 넣지 않는다 — 거기가 «로그인하는 곳» 이다.
 *   ⚠ 고객·근로자가 여는 화면(전자위임장·이음센터)에도 넣지 않는다 —
 *     그분들에게는 우리 포털 계정이 없다.
 *   ⚠★ «권한이 없다»는 이 화면이 «아니다». 로그인은 돼 있는데 그 화면만 못 보는 것은
 *     다른 말이다. 그 자리에 이것을 씌우면 「로그인하라」는 헛말이 된다 —
 *     시키는 대로 해도 아무것도 안 달라지는 안내가 가장 나쁘다.
 *
 * 쓰는 법:
 *   PuGate.show();   // 세션이 없다
 *   PuGate.hide();   // 로그인이 확인되면
 */
(function (w, d) {
  'use strict';
  if (w.PuGate) return;

  var ID = 'pu-gate';
  var PORTAL = 'enter.html';

  /* 포털 주소는 화면마다 깊이가 다를 수 있다 — 이미 정해 둔 값이 있으면 그것을 쓴다 */
  function portalUrl() {
    return (w.PORTAL_URL && String(w.PORTAL_URL)) || PORTAL;
  }

  function css() {
    if (d.getElementById(ID + '-css')) return;
    var st = d.createElement('style');
    st.id = ID + '-css';
    st.textContent =
      '#' + ID + '{position:fixed;inset:0;z-index:2147483600;background:#ffffff;' +
        'display:flex;align-items:center;justify-content:center;text-align:center;padding:24px;' +
        'font-family:"Noto Sans KR","Malgun Gothic",system-ui,-apple-system,sans-serif}' +
      /* ⚠ box-sizing 을 스스로 못 박는다 — 공용 파일이라 «부르는 화면»의 CSS 초기화에
         기댈 수 없다. 안 박으면 초기화가 없는 화면에서 칸이 제 폭보다 커진다. */
      '#' + ID + ',#' + ID + ' *{box-sizing:border-box}' +
      '#' + ID + ' .pg-lock{font-size:52px;margin-bottom:14px;line-height:1}' +
      '#' + ID + ' .pg-title{font-size:18px;font-weight:700;color:#1e293b;margin-bottom:8px;line-height:1.4}' +
      '#' + ID + ' .pg-msg{font-size:13px;color:#64748b;line-height:1.7;margin:0 0 20px}' +
      '#' + ID + ' .pg-btn{display:inline-block;text-decoration:none;background:#166534;color:#ffffff;' +
        'padding:11px 24px;border-radius:8px;font-size:14px;font-weight:600;border:none;cursor:pointer}' +
      '#' + ID + ' .pg-btn:hover{background:#14532d}';
    (d.head || d.documentElement).appendChild(st);
  }

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  var PuGate = {
    /* 인자는 받기만 하고 안 쓴다 — 옛 부름 PuGate.show({name,desc}) 이 죽지 않게 */
    show: function () {
      css();
      var box = d.getElementById(ID);
      if (!box) {
        box = d.createElement('div');
        box.id = ID;
        (d.body || d.documentElement).appendChild(box);
      }
      box.innerHTML =
        '<div>' +
          '<div class="pg-lock">🔒</div>' +
          '<div class="pg-title">통합시스템 로그인이 필요합니다</div>' +
          '<div class="pg-msg">로그아웃되었거나 세션이 만료되었습니다.<br>' +
            '푸른 통합시스템에서 로그인한 뒤 이용하세요.</div>' +
          '<a class="pg-btn" href="' + esc(portalUrl()) + '">🏠 통합시스템으로 이동</a>' +
        '</div>';
      box.style.display = 'flex';
      /* 로그아웃 화면이 떴으면 처음 뜨는 splash 는 치운다 — 겹치면 둘 다 안 보인다 */
      try { var sp = d.getElementById('pu-boot-splash'); if (sp) sp.remove(); } catch (e) {}
      return box;
    },
    /* ══ 「준비중」 — 로그인은 됐는데 «아직 안 열린» 화면 (대표 지시 2026-09-23) ══
       ⚠★ 위의 show() 를 여기에 쓰면 «안 된다». 그 화면은 「로그인하세요」라고 말하는데,
         이 사람은 이미 로그인해 있다 — 시키는 대로 해도 아무것도 안 달라지는 안내가
         가장 나쁘다(이 파일 머리말에 적어 둔 그대로다).
       ★ 그래서 자물쇠(🔒)가 아니라 연장(🔧)이고, 글도 다르다.
       ⚠ 포털의 「준비중」 딱지와 «짝»이다. 포털은 타일을 못 누르게 하고, 여기는
         주소를 직접 친 사람을 막는다. 둘 중 하나만 있으면 뚫린다. */
    soon: function (name) {
      css();
      var box = d.getElementById(ID);
      if (!box) {
        box = d.createElement('div');
        box.id = ID;
        (d.body || d.documentElement).appendChild(box);
      }
      box.innerHTML =
        '<div>' +
          '<div class="pg-lock">🔧</div>' +
          '<div class="pg-title">' + (name ? esc(name) + '은(는) ' : '') + '아직 준비중입니다</div>' +
          '<div class="pg-msg">다 되면 열어 드리겠습니다.<br>' +
            '그때까지는 통합시스템의 다른 프로그램을 이용해 주세요.</div>' +
          '<a class="pg-btn" href="' + esc(portalUrl()) + '">🏠 통합시스템으로 이동</a>' +
        '</div>';
      box.style.display = 'flex';
      try { var sp = d.getElementById('pu-boot-splash'); if (sp) sp.remove(); } catch (e) {}
      return box;
    },
    /* 「대표가 아니면 준비중을 씌운다」 — 잣대를 «한 곳»에 둔다.
       포털(enter.html appIsSoon)도 같은 것을 본다: 명부(user_dir)의 role === 'admin'.
       ⚠★ 모르는 동안에는 «씌우지 않는다». PuWhoami 는 이름을 먼저 주고 역할은 뒤에 준다 —
         모른다고 씌우면 대표님 화면이 한 번 껌뻑이고, 명부를 못 읽는 날에는
         **대표님이 자기 프로그램에서 잠긴다.** 그것이 못 막는 것보다 나쁘다.
         이것은 «비밀을 지키는 문»이 아니라 «반쪽짜리를 안 보이게 하는 가림막»이다 —
         진짜 문은 파이어베이스 규칙이 지킨다.
       ⚠ 사번(P-001)으로 못 박지 않는다 — 사번이 바뀌는 날 대표님이 잠긴다. */
    soonUnlessAdmin: function (name) {
      var self = this;
      function 판단(me) {
        var role = (me && me.role) || '';
        if (!role) return;                 // 아직 모른다 — 씌우지 않는다
        if (role === 'admin') { self.hideSoon(); return; }
        self.soon(name);
      }
      try {
        if (!w.PuWhoami) return false;     // 이 화면은 누구인지 알 길이 없다 — 그냥 둔다
        w.PuWhoami.onChange(판단);
        판단(w.PuWhoami.get());
        return true;
      } catch (e) { return false; }
    },
    /* 준비중만 걷는다 — 로그인 화면까지 함께 걷으면 안 되므로 지금 무엇이 떠 있는지 본다 */
    hideSoon: function () {
      var box = d.getElementById(ID);
      if (box && box.innerHTML.indexOf('준비중') >= 0) box.style.display = 'none';
    },
    hide: function () {
      var box = d.getElementById(ID);
      if (box) box.style.display = 'none';
    },
    isOpen: function () {
      var box = d.getElementById(ID);
      return !!(box && box.style.display !== 'none');
    }
  };

  w.PuGate = PuGate;
})(window, document);
