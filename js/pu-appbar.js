/* ══════════════════════════════════════════════════════════════
   푸른 통합시스템 — 프로그램 사이 이동 (공용 앱바)
   2026-08-07

   무엇: 어느 프로그램에서든 오른쪽 가장자리 「즐겨찾기」 손잡이를 눌러 다른 프로그램으로 바로 간다.
        종전에는 포털(enter.html)로 돌아갔다가 타일을 눌러야 해서 두 번 거쳤다.

   ★★ 새 프로그램을 만들 때 반드시 지킬 것 (대표님 지시, 2026-08-07) ★★
     ① <script src="js/pu-appbar.js"></script> 한 줄을 넣는다  ← 이것만으로 저절로 붙는다
     ② 아래 APPS 배열에 그 프로그램 한 줄을 더한다
     둘 중 하나라도 빠뜨리면 그 프로그램만 오갈 수 없는 섬이 된다.

   왜 부품으로 빼나: 프로그램이 8개다. 각 앱에 따로 만들면 하나가 늘 때마다 8곳을 고쳐야 한다.
        여기 목록 한 곳만 고치면 전부 반영된다. (pu-photo-store.js 와 같은 뜻)

   로그인: 8개가 같은 파이어베이스 세션을 쓴다 — 옮겨도 다시 로그인하지 않는다.
        그래서 이 부품은 인증을 전혀 건드리지 않는다. 그냥 주소를 옮길 뿐이다.

   쓰는 법 (앱에 두 줄):
     <script src="js/pu-appbar.js"></script>
     PuAppBar.mount('#어디에넣을지', { current:'erp' });
   보던 화면으로 돌아오게 하려면 화면이 바뀔 때마다:
     PuAppBar.mark('biz/contract');       // 그 앱이 알아보는 아무 글자
   그리고 앱이 뜰 때:
     var back = PuAppBar.lastScreen();    // 없으면 ''
   ══════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  /* 프로그램 목록 — 포털(enter.html)의 타일과 같은 차례·같은 이름으로 둔다.
     새 프로그램이 생기면 여기 한 줄만 더한다.
     ⚠ 실제로 두 개(문서관리·급여관리)가 빠져 있어 그 앱들만 즐겨찾기가 안 떴다
       (대표 보고 2026-08-13: "문서관리에는 왜 즐겨찾기 안 나오나"). 목록에 없으면
       손잡이가 붙어도 그 앱이 목록에 안 보이고, script 를 안 실으면 손잡이 자체가
       없다 — 이번엔 둘 다였다. 이름도 포털 개명(2026-08-11)을 따라잡았다. */
  var APPS = [
    { key: 'erp',     row: 'client', name: '푸른이알피',   icon: '🏢', url: 'pu-erp.html',         desc: '계약·업체·사건' },
    /* 직원 인사 · 재무 — 이알피와 같은 파일이고 주소 꼬리(?app=hr·fin)만 다르다(대표 지시 2026-10-09, 메일과 같은 방식).
       perm — 관리자이거나 그 권한이 있을 때만 보인다. 잣대는 포털과 같은 서버 권한표(uid_roles)이고,
       포털이 마지막으로 읽은 값(pu_app_perm_<uid>)을 빌려 본다. */
    { key: 'hr',      row: 'inside', name: '인사관리',    icon: '👥', url: 'pu-erp.html?app=hr',  desc: '명부·급여·근태', perm: 'hr' },
    { key: 'fin',     row: 'inside', name: '재무관리',     icon: '📒', url: 'pu-erp.html?app=fin', desc: '입출금·마감', perm: 'fin' },
    { key: 'cal',     row: 'client', name: '푸른 캘린더',  icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="15" y="24" width="70" height="62" rx="9" fill="#ffffff" stroke="#cbd5e1" stroke-width="3"/><path d="M15 33a9 9 0 0 1 9-9h52a9 9 0 0 1 9 9v11H15z" fill="#dc2626"/><circle cx="31" cy="58" r="5" fill="#bfdbfe"/><circle cx="50" cy="58" r="5" fill="#bfdbfe"/><circle cx="69" cy="58" r="5" fill="#bfdbfe"/><circle cx="31" cy="72" r="5" fill="#bfdbfe"/><circle cx="50" cy="72" r="5" fill="#bfdbfe"/></svg>', url: 'pu-cal.html',         desc: '일정·근태·이음센터' },
    { key: 'consult', row: 'client', name: '정부사업일정', icon: '📅', url: 'gov-consulting.html', desc: '보고서 일정및사진관리' },
    /* 컨설팅보고서(2026-10-10) — 포털 타일과 짝. 쓰는 일은 정부사업일정의 보고서 창이 한다 */
    { key: 'govreport', row: 'client', name: '컨설팅보고서', icon: '📑', url: 'gov-report.html',     desc: '보고서 현황·작성' },
    { key: 'govaid',  row: 'client', name: '정부지원금',   icon: '🎯', url: 'pu-govaid.html',      desc: '지원사업 찾기·검토' },
    { key: 'work',    row: 'store', name: '업무관리',     icon: '📋', url: 'work.html',           desc: '주간 업무기록' },
    { key: 'career',  row: 'inside', name: '경력관리',     icon: '🗂', url: 'kcareer.html',        desc: '개인 이력서', adminOnly: true },
    { key: 'govbid',  row: 'sales', name: '정부사업신청', icon: '🏛', url: 'gov.html',            desc: '공고 모아보기', adminOnly: true },
    { key: 'rehabad', row: 'sales', name: '회생광고',     icon: '⚖️', url: 'rehab-ad.html',       desc: '회생기업 안내 발송', adminOnly: true },
    { key: 'signboard', row: 'sales', name: '전광판',   icon: '📺', url: 'pu-signboard.html', desc: '외부 전광판 광고 바꾸기', perm: 'signboard' },
    { key: 'cards',   row: 'store', name: '기업정보함',    icon: '📇', url: 'pu-cards.html',       desc: '사업자·명함·계약서' },
    /* ⚠ 메일은 기업정보함과 같은 파일이고 주소(?view=mail)만 다르다.
       whoAmI() 는 주소 꼬리까지 보고 메일을 먼저 가른다 · go() 는 «&» 로 잇는다(2026-10-04).
       tests/appbar-every-link.test.js 가 모든 줄이 «제 앱»으로 가는지 돌려 본다. */
    { key: 'mail',    row: 'store', name: '메일',        icon: '✉️', url: 'pu-cards.html?view=mail', desc: '자료 붙여 보내기·예약' },
    { key: 'photos',  row: 'store', name: '사진첩',       icon: '🖼️', url: 'pu-photos.html',      desc: '사진·서류' },
    { key: 'paydata', row: 'store', name: '급여데이터함',  icon: '💼', url: 'pu-paydata.html',     desc: '급여자료 사업장별' },
    { key: 'fund',    row: 'client', name: '기금관리',     icon: '🏦', url: 'fund.html',           desc: '근로복지기금 운영' },
    /* 취업규칙은 한 줄 — 조별 문안·모은 자료(rules-v2.html)는 앱 머리줄의 세 갈래 단추로 간다
       (두 앱 합치기 2026-10-04). 포털 타일과 짝이다. 첫 화면은 🏢 사업장(2026-10-04 대표 「추천」). */
    { key: 'rules',   row: 'client', name: '취업규칙',      icon: '📋', url: 'rules-v2.html',       desc: '작성·검토·개정·신고' },
    { key: 'docs',    row: 'store', name: '계약서등관리',  icon: '📄', url: 'docs-esign.html',  /* 옛 이름 문서관리 — 대표 2026-10-05 «업무계약 발생 시 진행하는 서류» */     desc: '사건 위임장 · 계약서 양식' },
    { key: 'payroll', row: 'client', name: '급여관리',     icon: '💰', url: 'payroll-os.html',     desc: '급여 아웃소싱' },
    { key: 'home',    row: 'sales', name: '홈페이지', icon: '🌐', url: 'pu-home.html',        desc: '구성원·주요업무 글', adminOnly: true },
    /* 뉴스레터 — 경력관리·홈페이지 관리와 «같이» 총괄관리자 전용이다.
       포털 타일(enter.html)과 잣대를 맞춘다 — 한쪽만 보이면 눌러도 막히는 문이 된다. */
    { key: 'news',    row: 'sales', name: '뉴스레터', icon: '📰', url: 'pu-news.html',        desc: '주간뉴스레터 짓기·보내기', adminOnly: true }
  ];

  /* 단추에 적는 말 — 한 곳에서만 정한다. 바꾸려면 여기 한 줄. */
  var ICON = '⊞';
  var LABEL = '즐겨찾기';

  var FAV_KEY  = 'pu_appbar_favs';        // 대표님이 별표로 고른 것 (["cards","work"])
  var LAST_KEY = 'pu_appbar_last_';       // + appKey  →  그 앱에서 마지막에 보던 화면

  /* ── 작은 도구 ── */
  function lsGet(k, dflt) {
    try { var v = localStorage.getItem(k); return v === null ? dflt : JSON.parse(v); }
    catch (e) { return dflt; }
  }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  /* ══ 목록에는 «의뢰인 업무·자료함»만 (대표 지시 2026-10-11) ══
     「즐겨찾기에 의뢰인 업무와 자료함만 즐겨찾기가 되게 해라 … 중간에 구분해서」 → 「영업 내부관리 빼는 것으로 진행」.
     줄 이름·차례는 포털(enter.html)의 줄(row)과 같다 — tests/appbar-fav-rows.test.js 가 포털과 견준다.
     ⚠ 영업관리·내부관리 앱도 APPS 에서 «지우지 않는다» — 그 앱 안에서 «지금 어느 앱인지»(whoAmI)·보던 화면 기억에 쓴다.
       목록에서만 거른다. */
  var ROWS = [{ id: 'client', label: '의뢰인 업무' }, { id: 'store', label: '자료함' }];
  function rowShown(row) { return ROWS.some(function (r) { return r.id === row; }); }
  function appOf(key) { for (var i = 0; i < APPS.length; i++) if (APPS[i].key === key) return APPS[i]; return null; }
  function favable(key) { var a = appOf(key); return !!(a && rowShown(a.row)); }
  /* 저장된 별표 중 «목록에 있는 줄»의 것만 즐겨찾기로 친다 — 예전에 단 영업·내부관리 별표는 저절로 빠진다(지우지는 않는다) */
  function favs() { var a = lsGet(FAV_KEY, []); return (Array.isArray(a) ? a : []).filter(favable); }
  function isFav(key) { return favs().indexOf(key) >= 0; }
  function toggleFav(key) {
    if (!favable(key)) return favs();
    var a = favs(), i = a.indexOf(key);
    if (i >= 0) a.splice(i, 1); else a.push(key);
    lsSet(FAV_KEY, a);
    return a;
  }
  /* 별표를 단 것이 위로. 같은 무리 안에서는 정해 둔 차례 그대로 —
     사람마다 순서가 달라져도 무리 안 차례는 같아서 서로 안내하기 쉽다. */
  /* 총괄관리자만 보는 것 — 대표 지시 2026-08-17.
     「흐리게도 보이지 않게」 하라 하셨으므로 목록에서 아예 뺀다.
     ★ 모를 때는 «감춘다»(닫는 쪽으로 실패). 아닌 사람에게 잠깐이라도 보이는 것보다,
       관리자에게 잠깐 늦게 보이는 편이 낫다 — 알아내는 즉시 다시 그린다.
     근거는 포털 타일과 같은 잣대(명부의 role)다. 근거가 둘이면 언젠가 어긋난다. */
  function isAdminNow() {
    try {
      var me = global.PuWhoami && global.PuWhoami.get && global.PuWhoami.get();
      return !!(me && me.role === 'admin');
    } catch (e) { return false; }
  }

  /* 직원 인사·재무 줄을 볼 수 있나 — 포털이 서버 권한표(uid_roles)에서 읽어 둔 값을 빌린다.
     ★ 모를 때는 «감춘다»(닫는 쪽으로 실패) — 관리자는 위 잣대로 늘 보인다. */
  function permOk(perm) {
    try {
      var u = global.firebase && global.firebase.auth && global.firebase.auth().currentUser;
      if (!u || !u.uid) return false;
      var p = lsGet('pu_app_perm_' + u.uid, null);
      return !!(p && (p.isAdmin === true || p.isSubAdmin === true || p[perm] === true));
    } catch (e) { return false; }
  }

  function ordered() {
    var f = favs();
    var admin = isAdminNow();
    var rowIx = function (a) { for (var i = 0; i < ROWS.length; i++) if (ROWS[i].id === a.row) return i; return ROWS.length; };
    return APPS.filter(function (a) { return rowShown(a.row) && (!a.adminOnly || admin) && (!a.perm || admin || permOk(a.perm)); })
      .map(function (a, i) { return { a: a, i: i }; })
      .sort(function (x, y) {
        var fx = f.indexOf(x.a.key) >= 0 ? 0 : 1, fy = f.indexOf(y.a.key) >= 0 ? 0 : 1;
        if (fx !== fy) return fx - fy;                       // 즐겨찾기가 맨 위
        if (!fx) return x.i - y.i;                           // 즐겨찾기끼리는 원래 차례
        return (rowIx(x.a) - rowIx(y.a)) || (x.i - y.i);     // 그다음 의뢰인 업무 → 자료함, 줄 안에서는 원래 차례
      })
      .map(function (x) { return x.a; });
  }

  /* ── 보던 화면 기억 ──
     앱이 스스로 알려 준 글자를 그대로 보관했다가, 그 앱으로 돌아올 때 되돌려 준다.
     이 부품은 그 글자가 무슨 뜻인지 모른다 — 해석은 앱이 한다. */
  var _me = '';                                  // 지금 앱 key
  function mark(screen) {
    if (!_me) return;
    if (screen === undefined || screen === null || screen === '') return;
    lsSet(LAST_KEY + _me, String(screen));
  }
  function lastScreen(appKey) { return lsGet(LAST_KEY + (appKey || _me), '') || ''; }

  /* 캐시 우회 — 다른 앱들이 이미 쓰는 방식(10분 버킷)과 같게 맞춘다.
     매번 다른 값을 붙이면 브라우저가 아무것도 못 재사용해 느려진다. */
  function bust() { return 'v=' + Math.floor(Date.now() / 600000); }

  /* 실제로 옮기는 곳. 한 군데로 모아 둔 이유 —
     저장 안 한 내용이 있는 앱은 여기를 가로채 「저장하고 갈까요?」 를 물을 수 있다.
       PuAppBar.onNavigate = function(url, app){ if(dirty && !confirm(...)) return; location.href = url; };
     안 건드리면 그냥 옮긴다. */
  function navTo(url, app) {
    if (typeof global.PuAppBar !== 'undefined' && typeof global.PuAppBar.onNavigate === 'function') {
      global.PuAppBar.onNavigate(url, app);
      return;
    }
    global.location.href = url;
  }
  /* ══ 같은 프로그램은 «한 창»만 (대표 지시 2026-09-08) ═══════════════════════
     「기업정보함에서 보기 클릭하면 새롭게 기업정보함 창이 열린다.
       항상 푸른통합시스템의 모든 창은 2개가 열리지 않고 하나만 열리게 해라」

     ★★ 까닭 — `window.open(주소, '_blank')` 는 «누를 때마다 새 탭»이다. 서류를 댓 개만
       훑어도 기업정보함 탭이 그만큼 쌓이고, 나중에 어느 것이 무엇인지도 모르고
       하나씩 닫아야 한다. 대표님이 2026-08-27 에 사진첩 하나만 그렇게 고쳐 달라
       하셨고(pu-cards 의 CO_DOC_WIN), 2026-09-08 에 «모든 창»으로 넓히셨다.

     ★ 방법은 «창에 이름을 붙이는 것» 하나다. 이름이 같으면 브라우저가 그 창을 다시
       쓴다 — 처음엔 새 창이 열리고, 그다음부터는 그 창이 새 내용으로 바뀐다.
     ⚠ 열려 있던 창은 «뒤에 가려 있다» — focus() 로 앞으로 끌어오지 않으면
       「아무 일도 안 일어난」 것처럼 보인다.
     ⚠ 팝업이 막히면 «이 창»에서 간다(앱바가 옮기는 방식과 같다). 막혔다고 아무 일도
       안 하면 눌러도 반응이 없는 화면이 된다 — 이 저장소가 여러 번 밟은 자리다.

     ⚠⚠ 이름은 «주소의 화면 이름»에서 뽑는다. 부르는 곳마다 손으로 적게 하면
       한 곳은 반드시 다르게 적고, 그 앱만 탭이 쌓인다.
     ★ purpose 를 주면 «그 일 전용 창»이 된다 — 메일 쓰기가 그렇다(쓰던 편지가 딴
       화면으로 바뀌면 안 된다). 「하나만」은 «같은 것이 둘로 안 열린다»는 뜻이고,
       하는 일이 다른 창을 억지로 하나로 합치라는 뜻이 아니다. */
  function winNameOf(url) {
    var m = /(?:^|\/)([A-Za-z0-9_-]+)\.html/.exec(String(url || ''));
    return 'pu_' + (m ? m[1].replace(/-/g, '_') : 'app');
  }
  function goApp(url, purpose) {
    var u = String(url || '');
    if (!u) return null;
    var name = purpose ? ('pu_' + String(purpose)) : winNameOf(u);
    var w = null;
    try { w = global.open(u, name); } catch (_) { w = null; }
    if (w) {
      try { w.focus(); } catch (_) { /* 브라우저가 막을 수 있다 — 옮긴 것은 됐다 */ }
      return w;
    }
    navTo(u);          // 팝업이 막혔다 — 이 창에서 간다
    return null;
  }

  function go(app) {
    if (!app) return;
    var back = lastScreen(app.key);
    /* ⚠ 주소에 이미 물음표가 있으면(메일 = pu-cards.html?view=mail) «&» 로 잇는다.
       물음표를 하나 더 붙이면 view=mail?v=… 가 되어 메일 대신 기업정보함이 열렸다
       (대표 보고 2026-10-04 「메일을 눌렀는데 기업정보함으로 간다」). 포털 타일은 원래 이렇게 했다. */
    var sep = app.url.indexOf('?') >= 0 ? '&' : '?';
    var url = app.url + sep + bust() + (back ? '&back=' + encodeURIComponent(back) : '');
    navTo(url, app);
  }

  /* ── 화면 ── */
  var _pop = null;
  function closePop() {
    if (_pop && _pop.parentNode) _pop.parentNode.removeChild(_pop);
    _pop = null;
    document.removeEventListener('mousedown', onDocDown, true);
    document.removeEventListener('keydown', onKey, true);
  }
  function onDocDown(e) {
    // ★ 팝업 안을 눌렀을 때는 닫지 않는다 (깔때기에서 같은 실수를 한 적이 있다 —
    //   mousedown 이면 무조건 닫으면 안쪽 클릭도 닫혀 아무것도 못 고른다)
    if (e.target && e.target.closest && e.target.closest('[data-pu-appbar-pop]')) return;
    if (e.target && e.target.closest && e.target.closest('[data-pu-appbar-btn]')) return;
    closePop();
  }
  function onKey(e) { if (e.key === 'Escape') closePop(); }

  /* 목록을 걸 높이 — 단추 밑이 아니라 **머리줄 밑**이다.
     단추는 머리줄보다 작아서(위아래 여백) 단추 밑에 걸면 머리줄을 몇 px 덮는다(실측). */
  function barBottom(btn) {
    var r = btn.getBoundingClientRect();
    var y = r.bottom, p = btn.parentElement, n = 0;
    while (p && n++ < 4) {
      var pb = p.getBoundingClientRect();
      // 단추를 품은 '줄' 로 보이는 것만: 훨씬 넓고, 아래로 조금만 더 내려간 것
      if (pb.bottom > y && (pb.bottom - r.bottom) <= 40 && pb.width > r.width * 2) y = pb.bottom;
      p = p.parentElement;
    }
    return y;
  }

  /* ══ 폰: 떠 있는 것은 «손잡이 하나»만 (대표 지시 2026-10-18 「폰화면관리」) ══════════
     폰 전수점검(tools/phone-audit)에서 재 보니 거의 모든 앱에서 «떠 있는 단추 셋»이 목록을 덮었다 —
       · 「즐겨찾기」 손잡이(오른쪽 가운데, 25×78) — 줄 끝의 금액·기한·남은 날을 덮는다
       · 「최신」(오른쪽 아래, 62×29) · 「백업·복구」(왼쪽 아래, 78×32, 관리자) — 목록 아래쪽 줄과 ＋단추 옆을 덮는다
     하루에 한 번도 안 누르는 둘이 화면을 늘 차지하고 있었다.
     ★ 그래서 폰에서는 «최신·백업·복구»를 손잡이 목록 맨 아래 두 줄로 옮기고, 손잡이는 가늘게 한다.
       포털이 같은 둘을 ⋯ 안으로 넣은 것(enter.html moreDock)·정부사업일정 ⋯ 메뉴와 같은 길이다.
     ⚠ 새 버전이 «있을 때»(data-state="has")와 확인 중·결과를 알리는 동안은 「최신」을 그대로 띄운다 —
       눌러야 할 일이 생기면 눈에 띄어야 한다(pu-version.js 가 state 를 적는다).
     ⚠ PC 는 그대로다 — 자리가 넉넉하다.
     ⚠ 단추를 지우지 않고 «숨기기만» 한다 — 목록의 줄이 그 단추를 눌러 준다(같은 일을 두 벌 만들지 않는다).
     ⚠ 이 규칙은 앱바를 싣는 앱에만 걸린다. 포털(enter.html)은 앱바를 안 싣고 제 ⋯ 를 쓴다. */
  var PHONE_MQ = '(max-width:640px)';
  function isPhone() {
    try { return !!(global.matchMedia && global.matchMedia(PHONE_MQ).matches); } catch (e) { return false; }
  }
  function phoneCss() {
    try { phoneCssNow(); } catch (e) { /* 꾸밈 한 벌이 안 붙어도 손잡이·이동은 그대로 돈다 */ }
  }
  function phoneCssNow() {
    if (!document.head || document.getElementById('pu-appbar-phone-css')) return;
    var st = document.createElement('style');
    st.id = 'pu-appbar-phone-css';
    st.textContent = '@media ' + PHONE_MQ + '{' +
      /* 손잡이를 가늘게 — 글자는 그대로 «즐겨찾기»(어느 앱에서나 같은 자리·같은 말).
         2026-10-18 「양옆 빈공백 … 모두 채워서」로 본문이 화면 끝 8~14px 까지 오게 되어, 손잡이도 그 옆 여백 안에 들게 더 가늘게(약 13px) */
      '[data-pu-appbar-tab]{padding:8px 1px!important;font-size:9.5px!important;letter-spacing:0!important;opacity:.6!important}' +
      'body>#pu-version-fab[data-state="ok"]{display:none!important}' +
      /* 「새 버전 있음 · 누르기」는 바닥 가까이 — 높이는 아래 fabLift 가 잰다(바닥 막대가 있으면 그 위) */
      'body>#pu-version-fab{bottom:calc(var(--pu-fab-bottom,' + FAB_LOW + 'px) + env(safe-area-inset-bottom,0px))!important}' +
      'body>#pu-backup-admin-button{display:none!important}' +
      '}';
    document.head.appendChild(st);
  }
  /* 「새 버전 있음 · 누르기」를 폰에서 바닥 가까이 (대표 지시 2026-10-18 「너무 위에 있다 … 위치를 조금 낮게」)
     공용 pu-version.js 의 bottom:96px 는 PC 와 앱바 없는 화면(카메라 셔터·포털 📷)을 비키는 높이라 그대로 두고,
     앱바 앱의 폰에서만 바닥 FAB_LOW 로 내린다(위 phoneCss 의 --pu-fab-bottom).
     ★ 그 자리에 «화면에 박힌 것»이 있으면 그 위로 올린다 — 단추가 그 누를 것을 늘 덮으면 안 된다.
       2026-10-18 폰 전수(23앱 · 360·411px)에서 바닥 가까이에 박힌 것:
         업무관리 빠른 입력줄(fixed, 바닥 14px) · 경력관리 바닥 탭(fixed) · 명함첩 ＋·선택 막대(fixed) ·
         메일 ✏️ 쓰기(fixed 몸통 안의 absolute) · 취업규칙 쪽 막대(sticky bottom — 사업장 50곳 넘을 때). 쪽 막대는 폰에서 두세 줄로 접혀 높이가 화면마다 달라
       숫자로 박지 않고 그때그때 잰다.
     ⚠ 평소(「최신」)에는 폰에서 단추가 숨어 있어 재지 않는다 — 새 버전·확인 중·결과일 때만 돈다.
     ⚠ 앱에서 이 단추 자리를 따로 박지 말 것 — 두 곳이 정하면 한쪽만 고쳐진다. */
  var FAB_LOW = 24, FAB_GAP = 8;
  function fabLift() {
    var fab = document.getElementById('pu-version-fab');
    if (!fab || !isPhone() || !document.elementFromPoint) return;
    if (global.getComputedStyle(fab).display === 'none') return;
    var W = global.innerWidth, H = global.innerHeight, r = fab.getBoundingClientRect(), top = H;
    var vis = fab.style.visibility;
    fab.style.visibility = 'hidden';                 // 단추 «밑»을 본다
    // 다섯 × 세 점 — 둥근 ＋ 단추(명함첩)는 모서리가 비어 성긴 점으로는 빠진다(360px 실측)
    [0.02, 0.25, 0.5, 0.75, 0.98].forEach(function (fx) {
      var x = r.left + r.width * fx;
      [3, r.height / 2, r.height - 3].forEach(function (dy) {
        var y = H - FAB_LOW - dy;
        // 위로 올라가며 «화면에 박힌 것»을 찾는다 — 스크롤해도 그 자리에 그대로 있어 단추가 늘 덮게 되는 것
        for (var e = document.elementFromPoint(x, y), abs = null; e && e !== document.body && e !== document.documentElement; e = e.parentElement) {
          var cs = global.getComputedStyle(e), p = cs.position;
          if (/(auto|scroll)/.test(cs.overflowY) && e.scrollHeight > e.clientHeight) abs = null;   // 스크롤 상자 안의 것은 같이 움직인다
          else if (p === 'absolute' && !abs) abs = e;
          if (p !== 'fixed' && p !== 'sticky') continue;
          // sticky 는 «바닥에» 붙는 것만 막대다 — 옆으로만 붙는 이름칸(업무관리 타임라인)은 위아래로 흘러가니
          // 그때마다 비키면 스크롤할 때 단추가 오르내린다
          if (p === 'sticky' && cs.bottom === 'auto') continue;
          var b = e.getBoundingClientRect();
          // 작은 fixed/sticky 는 그 자체가 막대(쪽 막대·빠른 입력줄·바닥 탭). 화면 거의 전부인 fixed(메일처럼 앱 몸통)는
          // 막대가 아니고, 그 «안에 박힌» absolute(메일 ✏️ 쓰기)만 비킨다
          var hit = b.width * b.height < W * H * 0.5 ? e : abs;
          var ht = hit ? (hit === e ? b.top : hit.getBoundingClientRect().top) : H;
          // 막대는 화면 아래쪽 절반에 있다 — 위까지 닿는 판(메일 서랍처럼 몸통 안의 absolute)은 막대가 아니다.
          // 그것까지 비키면 단추가 화면 밖으로 나간다(2026-10-18 실측: 메일 서랍에서 808px)
          if (ht >= H / 2) top = Math.min(top, ht);
          break;
        }
      });
    });
    fab.style.visibility = vis;
    var want = top < H ? Math.ceil(H - top + FAB_GAP) : FAB_LOW;
    document.documentElement.style.setProperty('--pu-fab-bottom', want + 'px');
  }
  var fabWatching = false, fabTimer = 0;
  function fabSoon() {
    if (fabTimer) return;
    fabTimer = setTimeout(function () { fabTimer = 0; try { fabLift(); } catch (e) { /* 못 재면 바닥 FAB_LOW 그대로 */ } }, 120);
  }
  /* 단추 상태가 바뀔 때(새 버전을 찾았을 때)·스크롤·폭 바뀜·누름(쪽 넘김으로 막대가 생기고 없어진다) 뒤에 다시 잰다 */
  function fabWatch() {
    if (fabWatching || !global.MutationObserver || !global.addEventListener) return;
    var fab = document.getElementById('pu-version-fab');
    if (!fab) return;                                // 아직 안 붙었다 — auto() 가 1.2초 뒤 한 번 더 부른다
    fabWatching = true;
    new global.MutationObserver(fabSoon).observe(fab, { attributes: true, attributeFilter: ['data-state'] });
    global.addEventListener('scroll', fabSoon, { capture: true, passive: true });
    global.addEventListener('resize', fabSoon);
    global.addEventListener('click', fabSoon, true);
    fabSoon();
  }
  /* 폰에서만 목록 맨 아래에 붙는 두 줄 — 숨긴 단추를 대신 눌러 준다 */
  function phoneRows(pop) {
    if (!isPhone()) return;
    var acts = [
      { id: 'pu-version-fab', label: '🔄 새 버전 확인', key: 'version' },
      { id: 'pu-backup-admin-button', label: '🗄 백업·복구', key: 'backup' }
    ];
    var box = null;
    acts.forEach(function (a) {
      var target = document.getElementById(a.id);
      if (!target) return;                       // 백업·복구는 관리자에게만 생긴다
      if (!box) {
        box = document.createElement('div');
        box.style.cssText = 'display:flex;gap:6px;padding:6px 10px;border-top:1px solid #eef2f6;background:#fff';
        pop.appendChild(box);
      }
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('data-pu-phone-act', a.key);
      b.textContent = a.label;
      b.style.cssText = 'flex:1;min-width:0;white-space:nowrap;border:1px solid #cbd5e1;background:#f8fafc;color:#334155;' +
        'border-radius:7px;padding:8px 6px;font:700 12px/1.2 -apple-system,"Malgun Gothic",sans-serif;cursor:pointer';
      b.addEventListener('click', function () { closePop(); try { target.click(); } catch (e) {} });
      box.appendChild(b);
    });
  }

  function openPop(btn) {
    if (_pop) { closePop(); return; }
    var r = btn.getBoundingClientRect();
    var anchorY = barBottom(btn);
    var W = 236;
    var pop = document.createElement('div');
    pop.setAttribute('data-pu-appbar-pop', '1');
    pop.style.cssText =
      'position:fixed;z-index:99999;width:' + W + 'px;background:#fff;border:1px solid #cbd5e1;' +
      'border-radius:9px;box-shadow:0 12px 30px rgba(0,0,0,.20);overflow:hidden;' +
      'font-family:-apple-system,"Malgun Gothic",sans-serif;' +
      'left:' + Math.max(8, Math.min(r.left, global.innerWidth - W - 10)) + 'px;' +
      'top:' + (anchorY + 5) + 'px;';
    var isTab = btn.hasAttribute('data-pu-appbar-tab');

    var head = document.createElement('div');
    head.style.cssText = 'padding:6px 11px;font-size:10.5px;color:#94a3b8;background:#f8fafc;border-bottom:1px solid #eef2f6';
    head.textContent = '프로그램 이동 · ☆ 를 누르면 즐겨찾기로 올라갑니다';
    pop.appendChild(head);

    var list = document.createElement('div');
    list.style.cssText = 'max-height:min(62vh,420px);overflow-y:auto';
    pop.appendChild(list);

    function draw() {
      list.innerHTML = '';
      var arr = ordered(), sec = '';
      /* 칸 머리 — ⭐ 즐겨찾기 · 의뢰인 업무 · 자료함 (대표 지시 2026-10-11 「중간에 구분해서」). 빈 칸은 머리도 안 그린다 */
      function secHead(id, text) {
        if (sec === id) return;
        sec = id;
        var h = document.createElement('div');
        h.setAttribute('data-pu-sec', id);
        h.style.cssText = 'padding:5px 11px 3px;font-size:10.5px;font-weight:700;color:#64748b;background:#f8fafc;' +
          'border-top:1px solid #e2e8f0;border-bottom:1px solid #eef2f6';
        h.textContent = text;
        list.appendChild(h);
      }

      arr.forEach(function (a, i) {
        if (isFav(a.key)) secHead('fav', '⭐ 즐겨찾기');
        else ROWS.forEach(function (r) { if (r.id === a.row) secHead(r.id, r.label); });
        var now = (a.key === _me);
        var row = document.createElement('div');
        row.setAttribute('data-pu-app', a.key);   // 자동 시험·자동화가 줄을 정확히 집을 수 있게
        row.style.cssText =
          'display:flex;align-items:center;gap:8px;padding:7px 10px;font-size:12.5px;' +
          'border-bottom:1px solid #f8fafc;' + (now ? 'background:#eff6ff;' : 'cursor:pointer;');

        var star = document.createElement('span');
        star.textContent = isFav(a.key) ? '★' : '☆';
        star.title = isFav(a.key) ? '즐겨찾기에서 빼기' : '즐겨찾기에 넣기 (위로 올라갑니다)';
        star.style.cssText = 'cursor:pointer;font-size:13px;flex-shrink:0;color:' + (isFav(a.key) ? '#f59e0b' : '#cbd5e1');
        star.addEventListener('click', function (e) { e.stopPropagation(); toggleFav(a.key); draw(); });
        row.appendChild(star);

        var ic = document.createElement('span');
        /* ⚠ SVG 로 그린 아이콘은 «문자열이 HTML»이다 — textContent 로 넣으면
           글자 그대로(<svg...) 찍힌다. 그림글자만 textContent 로 넣는다. */
        if(typeof a.icon === 'string' && a.icon.indexOf('<svg') === 0){
          ic.innerHTML = a.icon;
          ic.style.cssText = 'width:15px;height:15px;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center';
          var svgEl = ic.querySelector('svg');
          if(svgEl){ svgEl.style.width = '100%'; svgEl.style.height = '100%'; }
        } else {
          ic.textContent = a.icon;
          ic.style.cssText = 'font-size:15px;flex-shrink:0';
        }
        row.appendChild(ic);

        var nm = document.createElement('span');
        nm.textContent = a.name;
        nm.style.cssText = 'flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;' +
          (now ? 'font-weight:800;color:#1d4ed8' : 'color:#1e293b');
        row.appendChild(nm);

        var tail = document.createElement('span');
        tail.style.cssText = 'font-size:10px;color:#94a3b8;flex-shrink:0';
        tail.textContent = now ? '지금' : (lastScreen(a.key) ? '↩' : '');
        if (!now && lastScreen(a.key)) tail.title = '보던 화면으로 돌아갑니다';
        row.appendChild(tail);

        if (!now) {
          row.addEventListener('click', function () { closePop(); go(a); });
          row.addEventListener('mouseenter', function () { row.style.background = '#f8fafc'; });
          row.addEventListener('mouseleave', function () { row.style.background = ''; });
        }
        list.appendChild(row);
      });
    }
    draw();
    /* 신원은 파이어베이스가 늦게 알려 준다. 관리자 전용 줄이 처음엔 감춰져 있으므로,
       알아내는 즉시 다시 그린다 — 안 그리면 관리자에게 영영 안 보인다. */
    try {
      if (global.PuWhoami && global.PuWhoami.onChange) global.PuWhoami.onChange(function () { draw(); });
    } catch (e) { }

    var foot = document.createElement('div');
    foot.style.cssText = 'padding:7px 10px;border-top:1px solid #eef2f6;background:#f8fafc';
    var home = document.createElement('span');
    home.textContent = '🏠 시작화면(포털)';
    home.style.cssText = 'font-size:11.5px;color:#475569;cursor:pointer';
    home.addEventListener('click', function () { closePop(); navTo('enter.html?' + bust(), null); });
    foot.appendChild(home);
    pop.appendChild(foot);
    phoneRows(pop);

    document.body.appendChild(pop);
    _pop = pop;
    /* 아래가 좁고 **위가 더 넓을 때만** 위로 펼친다.
       종전처럼 「아래로 넘치면 무조건 위」로 하면, 머리줄이 화면 맨 위에 있는 앱에서
       목록이 머리줄을 덮어 버린다(창이 짧을 때 특히). */
    var pr = pop.getBoundingClientRect();
    if (isTab) {
      /* 오른쪽 가장자리 손잡이 — 목록은 **왼쪽으로** 펼치고 손잡이와 세로 가운데를 맞춘다.
         화면 위아래로 넘치지 않게 가둔다(짧은 창에서도 다 보이게). */
      pop.style.left = Math.max(8, r.left - W - 8) + 'px';
      pop.style.top = Math.max(8, Math.min(r.top + r.height / 2 - pr.height / 2,
        global.innerHeight - pr.height - 8)) + 'px';
    } else {
      var below = global.innerHeight - anchorY;
      var above = r.top;
      if (pr.height > below - 8 && above > below) {
        pop.style.top = 'auto';
        pop.style.bottom = (global.innerHeight - r.top + 5) + 'px';
      }
    }
    /* ★ 닫기 감시는 **어느 모양이든 반드시** 건다.
       손잡이 자리잡기에서 return 으로 빠져나가 이 두 줄을 건너뛰는 바람에
       바깥을 눌러도 Esc 를 눌러도 안 닫히는 일이 있었다. */
    document.addEventListener('mousedown', onDocDown, true);
    document.addEventListener('keydown', onKey, true);
  }

  /* ── 붙이기 ── */
  function mount(host, opts) {
    opts = opts || {};
    _me = opts.current || '';
    var el = (typeof host === 'string') ? document.querySelector(host) : host;
    if (!el) return null;
    if (el.querySelector('[data-pu-appbar-btn]')) return null;   // 두 번 붙지 않게

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('data-pu-appbar-btn', '1');
    btn.title = '다른 프로그램으로 이동 (로그인은 그대로 이어집니다)';
    btn.textContent = ICON + ' ' + LABEL;
    btn.style.cssText =
      'display:inline-flex;align-items:center;gap:4px;background:#eff6ff;color:#1d4ed8;' +
      'border:1px solid #93c5fd;border-radius:6px;padding:4px 10px;font-size:11.5px;' +
      'font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap;flex-shrink:0;';
    btn.addEventListener('click', function (e) { e.stopPropagation(); openPop(btn); });
    el.appendChild(btn);
    return btn;
  }

  /* 앱이 뜰 때 주소에 실려 온 「보던 화면」을 꺼낸다.
     주소에 없으면 저장해 둔 것을 쓴다(주소를 직접 친 경우에도 이어지게). */
  function backTarget(searchStr) {
    try {
      var s = (searchStr !== undefined && searchStr !== null) ? String(searchStr) : (global.location.search || '');
      var m = /[?&]back=([^&]*)/.exec(s);
      if (m) return decodeURIComponent(m[1]);
    } catch (e) {}
    return lastScreen();
  }

  // ⚠ enter.html 의 PORTAL_SAME_APP_FILES 와 «같은 식구»를 말한다 — 늘릴 땐 같이 고친다.
  var SAME_APP_FILES = { 'rules.html': 'rules' };

  /* 주소로 지금 어느 프로그램인지 알아낸다 — 앱이 따로 알려 주지 않아도 되게 */
  function whoAmI() {
    var f = '', q = '';
    try { f = (global.location.pathname || '').split('/').pop().toLowerCase(); } catch (e) {}
    try { q = String(global.location.search || ''); } catch (e) {}
    /* 같은 파일이라도 주소 꼬리로 갈리는 프로그램(메일 = pu-cards.html?view=mail)을 «먼저» 본다.
       예전에는 파일 이름만 봐서 메일 창의 「지금」이 기업정보함에 붙었고, 그래서 메일에서
       기업정보함 줄을 누를 수가 없었다(2026-10-04). 주소 꼬리의 조각이 «전부» 있어야 그 앱이다. */
    for (var j = 0; j < APPS.length; j++) {
      var u = APPS[j].url, qi = u.indexOf('?');
      if (qi < 0 || u.slice(0, qi).toLowerCase() !== f) continue;
      var pairs = u.slice(qi + 1).split('&'), all = true;
      for (var k = 0; k < pairs.length && all; k++) {
        var esc = pairs[k].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        all = new RegExp('(^|[?&])' + esc + '(&|$)').test(q);
      }
      if (all) return APPS[j].key;
    }
    for (var i = 0; i < APPS.length; i++) {
      if (APPS[i].url.toLowerCase() === f) return APPS[i].key;
    }
    /* 같은 앱의 다른 화면 파일 — 타일 주소(rules-v2.html)와 다른 쪽(rules.html ✏️ 검토·개정)에서도
       「지금 앱」이 취업규칙으로 잡혀야 한다(안 그러면 보던 화면 기록·켜짐 표시가 빠진다). */
    if (Object.prototype.hasOwnProperty.call(SAME_APP_FILES, f)) return SAME_APP_FILES[f];
    return '';
  }

  /* 스스로 붙기 — 앱은 <script src="js/pu-appbar.js"></script> 한 줄이면 된다.
     ① 앱이 자리를 정해 뒀으면(<span data-pu-appbar></span>) 거기에 붙인다.
     ② 안 정해 뒀으면 오른쪽 위에 떠 있는 단추로 붙인다.
        자리를 정하는 것이 보기 좋지만, 안 해도 일단 쓸 수 있어야 8개를 한꺼번에 살릴 수 있다. */
  /* ── 손잡이를 어디에 둘 것인가 ──
     대표님 요구: **모든 프로그램에서 똑같은 자리**, 그리고 아무것과도 안 겹칠 것.
     8개 앱의 화면고정(fixed) 요소를 전부 뽑아 비교한 결과 —
       · 위 왼/오른  : 머리줄·로그아웃·상태표시가 5개 앱에서 쓴다
       · 아래 왼/오른: 접속자판·＋단추·저장표시가 4~5개 앱에서 쓴다
       · 아래 가운데 : **토스트 알림 자리**다(컨설팅·기업정보함·사진첩·경력관리 모두 left:50%)
                       업무관리는 빠른기록 바까지 깔려 있다
       · 세로 가운데 : **8개 앱 모두 0건 — 완전히 비어 있다**
     그래서 «오른쪽 가장자리 · 세로 한가운데» 에 세로 손잡이로 고정한다.
     머리줄·바닥줄·토스트·＋단추 어느 것과도 만나지 않는 유일한 자리다. */
  function makeTab() {
    var tab = document.createElement('button');
    tab.type = 'button';
    tab.setAttribute('data-pu-appbar-btn', '1');
    tab.setAttribute('data-pu-appbar-tab', '1');
    tab.title = '다른 프로그램으로 이동 (로그인은 그대로 이어집니다)';
    tab.style.cssText =
      'position:fixed;right:0;top:50%;transform:translateY(-50%);z-index:9998;' +
      'writing-mode:vertical-rl;text-orientation:upright;' +
      'padding:14px 5px;border:none;border-radius:9px 0 0 9px;' +
      'background:#1e40af;color:#fff;font-size:11.5px;font-weight:700;letter-spacing:1px;' +
      'font-family:-apple-system,"Malgun Gothic",sans-serif;cursor:pointer;' +
      'box-shadow:-2px 0 10px rgba(0,0,0,.20);opacity:.72;transition:opacity .15s,padding .15s;';
    tab.textContent = LABEL;
    tab.addEventListener('mouseenter', function () { tab.style.opacity = '1'; tab.style.paddingRight = '8px'; });
    tab.addEventListener('mouseleave', function () { tab.style.opacity = '.72'; tab.style.paddingRight = '5px'; });
    tab.addEventListener('click', function (e) { e.stopPropagation(); openPop(tab); });
    return tab;
  }

  function auto() {
    /* 주소로 알아낸 값이 있을 때만 덮어쓴다.
       앱이 mount({current}) 로 알려 준 것을 빈 값으로 지워 버리면
       「보던 화면」이 어느 앱 것인지 몰라 기록이 안 남는다. */
    _me = whoAmI() || _me;
    phoneCss();
    try { fabWatch(); } catch (e) { /* 자리 재기가 안 돌아도 단추는 바닥 FAB_LOW 에 그대로 있다 */ }
    if (document.querySelector('[data-pu-appbar-btn]')) return;   // 두 번 붙지 않게
    if (!document.body) return;
    document.body.appendChild(makeTab());
  }
  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else setTimeout(fn, 0);
  }
  // 앱 화면이 늦게 그려지는 경우(리액트·프리액트)가 있어 한 번 더 살핀다
  ready(function () { auto(); setTimeout(auto, 1200); });

  /* 앱이 스스로 단추를 그리고 이 함수만 부르는 길.
     리액트·프리액트로 머리줄을 그리는 앱(푸른이알피)은 남의 DOM 을 끼워 넣으면
     다시 그릴 때 지워질 수 있다. 그래서 단추는 앱이 그리고, 목록만 여기서 연다. */
  function open(btnEl) {
    if (!_me) _me = whoAmI();
    if (!btnEl) return;
    openPop(btnEl);
  }

  global.PuAppBar = {
    APPS: APPS,
    // 검사용 — 관리자 전용 줄이 실제로 빠지는지 본다
    _ordered: ordered,
    _isAdminNow: isAdminNow,
    // 검사용 — 목록에서 한 줄을 «누른 것»과 같다(tests/appbar-every-link.test.js)
    _go: go,
    mount: mount,
    auto: auto,
    open: open,
    /* 같은 프로그램은 «한 창»만 (대표 지시 2026-09-08) — 앱끼리 창을 열 때는
       window.open(…, '_blank') 대신 «반드시» 이것을 쓴다.
       ⚠ tests/one-window-per-app.test.js 가 _blank 가 되살아나는 것을 막는다. */
    goApp: goApp, winNameOf: winNameOf,
    whoAmI: whoAmI,
    mark: mark,
    lastScreen: lastScreen,
    backTarget: backTarget,
    favs: favs,
    ROWS: ROWS,
    toggleFav: toggleFav,
    ordered: ordered,
    _close: closePop,
    // 검사용 — 「새 버전」 단추 자리 재기(tests/version-fab-phone-low.test.js)
    _fabLift: fabLift,
    FAB_LOW: FAB_LOW
  };
})(window);
