/* ═══════════════════════════════════════════════════════════════════════
   강의자료 화면 (pu-edulib.html, 11-20 «법정교육자료함»에서 이름 바꿈) — 2026-11-19

   ★ 저장은 모두 공용 관문(gate = PuOntologyWrite.createGateway enforce)으로 한다. 지우기는 _deleted 표식만.
   ★ 원본 파일은 받은 바이트 그대로 창고에 올린다 — 바꾸지도 줄이지도 않는다.
   ★ 화면에 넣는 글자는 모두 esc() 를 거친다(파일 이름·메일 제목·슬라이드 글자가 화면 코드가 되지 않게).
   ★ 문서(PDF·한글·엑셀)는 격리된 칸(pu-viewer-frame.html, sandbox="allow-scripts")에서 그린다 — 푸른 문서뷰어와 같은 길.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var FB_CONFIG = { apiKey: 'AIzaSyDkZz5QlKSoqMOYByp5YGeMNLNDrIghliA', authDomain: 'pureun-erp.firebaseapp.com', databaseURL: 'https://pureun-erp-default-rtdb.asia-southeast1.firebasedatabase.app', projectId: 'pureun-erp', appId: '1:936817166182:web:9bd31f70d0afdf5fca2aa7', messagingSenderId: '936817166182' };
  var BUCKET = 'gs://pureun-erp-hrphotos';
  var MB_FN = 'https://asia-northeast3-pureun-erp.cloudfunctions.net/';
  var MAX_UPLOAD = 1024 * 1024 * 1024;          /* 창고 규칙과 같은 한도 — 규칙이 «1GB 미만»이므로 여기서도 «< MAX_UPLOAD» 만 올린다. 아니면 «목록만, 원본은 PC» */
  var MAX_HASH = 200 * 1024 * 1024;             /* 지문(sha256)은 200MB 까지만 잰다 — 큰 파일은 이름+크기로 같은지 본다 */
  var MAX_CMP = 4;                              /* 나란히 보기 한 화면 최대 칸 */
  var MAX_WIN = 6;                              /* 새 창으로 한 번에 여는 최대 수 */
  var PAGE = 400;                               /* 목록 한 번에 그리는 줄 수 */

  var C = window.PuEduLibClassify, K = window.PuEduLibCore, P = window.PuEduLibPreview;
  var fbDb = null, gate = null, bucket = null;
  var ME = { sid: '', uid: '', admin: false };
  var ITEMS = {}, NAMES = {}, LOADED = false;
  var TAB = 'dash', PICK = {}, SHOWN = PAGE;
  var F = { q: '', cat: '', year: '', kind: '', status: '', store: '', legal: '', trash: false };   /* legal: '' · 'legal' · 'other' */
  var GROUP = 'cat';
  var STAGE = [];                               /* 넣기 — 저장 전 줄들 */
  var MAIL = [], MPICK = {}, MQ = '';
  var VIEW_ID = '';                             /* ?view=<id> 로 연 «한 건 보기» 창 */
  /* 2026-11-21 대표 「이부분도 대시보드로 해달라 … + 추가기능 … 메일로 보낸 강의 자료 … 자동으로 정리」 */
  var VIEW = 'card';                            /* 자료 보기 — card(종류별 카드 대시보드, 기본) · table(표) */
  var CARD_TOP = 6;                             /* 카드 한 장에 먼저 보이는 줄 — 나머지는 «더 보기» */
  var EXPAND = {};                              /* «더 보기»로 펼친 카드(묶음 열쇠) */
  var CATSDB = {};                              /* 사람이 더한 강의 종류(/edulib/cats) */
  var SIMS = {}, SIMBEST = null, SIMRUN = null;  /* 내용 지문(/edulib/sims) · 목록 ↺ 셈(자료·지문이 바뀌면 비운다) · 관리자 일괄 만들기 */
  var ADD_CAT = '';                             /* 새 종류를 막 더하고 «넣기»로 왔을 때 — 짐작 못 한 파일을 그 종류로 */
  var SWEEP = null;                             /* 보낸 메일 자동 정리 상태(/edulib_inbox/state — 서버만 쓰고 관리자만 읽는다) */
  var INBOX = {}, IPICK = {};                   /* 자동 정리함(/edulib_inbox/q) — 서버가 정리해 둔 강의자료 첨부, 관리자가 골라 «넣기» */
  var INBOX_DAYS = 90;                          /* 자동 정리함에 보이는 기간 — 오래된 줄은 접는다(지우지 않는다) */

  /* ───────── 작은 도구 ───────── */
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function lsGet(k) { try { return localStorage.getItem('pu_edulib_' + k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem('pu_edulib_' + k, v); } catch (e) {} }
  function toast(m, ms) { var t = $('toast'); t.textContent = m; t.className = 'on'; clearTimeout(toast._t); toast._t = setTimeout(function () { t.className = ''; }, ms || 4200); }
  function errMsg(e) { return String((e && e.message) || e || '알 수 없는 오류'); }
  /* 사람은 사번→이름, 자동으로 넣은 것(AI-…)은 «자동»으로 — 사번이 아닌 것을 «직원»이라 부르지 않는다 */
  function nameOf(sid) { if (/^AI-/.test(String(sid || ''))) return '자동(' + String(sid).slice(3) + ')'; return NAMES[sid] || (sid ? '직원' : ''); }
  function fmtTime(ms) {
    if (!ms) return '';
    var d = new Date(+ms); if (!isFinite(d.getTime())) return '';
    function p(n) { return n < 10 ? '0' + n : '' + n; }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function ymd(ms) { return fmtTime(ms).slice(0, 10); }
  function catLabel(k) { return C.catByKey(k).label; }
  function list() { return Object.keys(ITEMS).map(function (k) { return ITEMS[k]; }); }
  function itemRef(id) { return fbDb.ref('edulib/items/' + id); }
  function simRef(id) { return fbDb.ref('edulib/sims/' + id); }
  function dateCell(it) {
    if (!it.lectureDate) return '<span class="hint">모름</span>';
    var est = it.dateFrom && it.dateFrom !== 'manual';
    return '<span class="one"><span>' + esc(it.lectureDate) + '</span>' + (est ? '<span class="tag est" title="' + esc(estWhy(it.dateFrom)) + '">추정</span>' : '') + '</span>';
  }
  function estWhy(f) { return f === 'name' ? '파일 이름에서 찾은 날짜' : f === 'folder' ? '폴더 이름에서 찾은 날짜' : f === 'mail' ? '메일 보낸 날 — 강의일과 다를 수 있습니다' : '추정'; }
  function statusTags(it) {
    var s = '<span class="tag ' + esc(it.status) + '">' + esc(K.STATUS[it.status] || it.status) + '</span>';
    s += '<span class="tag ' + esc(it.store) + '">' + esc(K.STORE[it.store] || it.store) + '</span>';
    if (it.pii) s += '<span class="tag pii" title="사람 이름·서명이 들어 있을 수 있습니다">개인정보</span>';
    return s;
  }

  /* ───────── 탭 ───────── */
  function setTab(t) {
    if (t === 'mail' && !ME.admin) t = 'dash';
    if (TAB !== t) { PICK = {}; MPICK = {}; IPICK = {}; if (TAB === 'add') ADD_CAT = ''; }   /* 화면을 떠나면 고른 것을 비운다 */
    TAB = t; lsSet('tab', t);
    [].forEach.call(document.querySelectorAll('#tabs button'), function (b) { b.classList.toggle('on', b.getAttribute('data-tab') === t); });
    [].forEach.call(document.querySelectorAll('.pane'), function (p) { p.classList.toggle('on', p.id === 'pane-' + t); });
    draw();
  }
  function draw() {
    $('nItems').textContent = K.live(list()).length;
    if (TAB === 'dash') drawDash();
    else if (TAB === 'list') drawList();
    else if (TAB === 'add') drawStage();
    else if (TAB === 'mail') { drawMail(); drawSweep(); }
    if (TAB !== 'list') drawSb();               /* 자료 탭은 drawList 가 그린다(두 번 그리지 않게) */
  }

  /* ───────── 왼쪽 메뉴(PC) — 이알피 왼쪽 메뉴와 같은 모양 (대표 지시 2026-11-22 「대시보드 캡쳐처럼 만들어라」) ─────────
     한눈에 · 전체 자료 · ⚖ 법정교육 자료 ▾ · 📘 법정교육 외 자료 ▾ · ＋ 새 강의 종류.
     ★ 나누는 잣대는 한눈에·자료함과 같은 K.splitLegal(종류의 «법정» 표시 하나). 숫자는 지운 것(_deleted)을 세지 않는다(K.dashboard).
     ★ 종류를 누르면 자료함에서 그 종류만, 묶음 이름을 누르면 그 묶음만(F.legal), ▼/▶ 는 접기(이 브라우저에만 기억).
     ★ 지금 보고 있는 자리는 파란 칸(.active) — 한눈에 / 전체 자료 / 그 종류 / 그 묶음(머리줄 .on).
     ★ 메뉴다(사람이 넣고 고치는 자료 목록이 아니다) — ☐·№ 칸은 두지 않는다. 카드에 있던 최근·원본·검토·용량·근거는 줄마다 title 에 */
  var SB_ICON = { sexual: '🚫', disability: '♿', privacy: '🔒', safety: '⛑️', pension: '💰', bullying: '🤝', youth: '🎒', equality: '👥',
    labor_rel: '🏛️', hours: '⏰', wage: '💵', ai: '🤖', esop: '🏦', labor_law: '📖', etc: '📄' };
  var SB_FOLD = (function () { try { return JSON.parse(lsGet('sbFold') || '{}') || {}; } catch (e) { return {}; } })();
  function drawSb() {
    var nav = $('sbNav'); if (!nav) return;
    var d = K.dashboard(list());
    var onList = TAB === 'list' && !F.trash && !F.ids;
    var h = '<div class="sb-menu top">' +
      '<button type="button" class="sb-menu-item' + (TAB === 'dash' ? ' active" aria-current="page' : '') + '" data-sb="dash"><span class="mi-icon">📊</span><span class="mi-text">한눈에</span></button>' +
      '<button type="button" class="sb-menu-item' + (onList && !F.cat && !F.legal ? ' active" aria-current="page' : '') + '" data-sb="all" title="모든 강의자료 ' + d.total + '건"><span class="mi-icon">📚</span><span class="mi-text">전체 자료</span><span class="mi-n">' + d.total + '</span></button>' +
      '</div><div class="sb-sep"></div>';
    K.splitLegal(d.cats).forEach(function (s) {
      var fold = !!SB_FOLD[s.key];
      var gOn = onList && !F.cat && F.legal === s.key;
      h += '<div class="sb-grp ' + s.key + '"><div class="sb-grp-h' + (gOn ? ' on' : '') + '">' +
        '<button type="button" class="arrow" data-sbfold="' + s.key + '" aria-expanded="' + (fold ? 'false' : 'true') + '" aria-label="' + esc(s.label) + (fold ? ' 펼치기' : ' 접기') + '" title="' + (fold ? '펼치기' : '접기') + '">' + (fold ? '▶' : '▼') + '</button>' +
        '<button type="button" class="sb-gname" data-sblegal="' + s.key + '" title="' + esc(s.label + ' ' + s.kinds + '종 ' + s.n + '건 · ' + K.fmtBytes(s.bytes) + (s.review ? ' · 검토 ' + s.review : '') + ' — 자료함에서 이 묶음만') + '"' + (gOn ? ' aria-current="page"' : '') + '>' +
        '<span class="icon">' + (s.key === 'legal' ? '⚖️' : '📘') + '</span><span class="name">' + esc(s.label) + '</span><span class="count">' + s.n + '</span></button></div>';
      if (!fold) {
        h += '<div class="sb-menu">' + s.cats.map(function (c) {
          var on = onList && F.cat === c.key;
          var tip = c.label + ' ' + c.n + '건 · 최근 ' + (c.latest || '—') + ' · 원본 ' + c.cloud + ' · 검토 ' + c.review + ' · ' + K.fmtBytes(c.bytes) + (c.legal && c.law ? ' · ' + c.law : '');
          return '<div class="sb-row' + (c.custom ? ' mine' : '') + '">' +
            '<button type="button" class="sb-menu-item' + (on ? ' active' : '') + (c.n ? '' : ' zero') + '" data-sbcat="' + esc(c.key) + '" title="' + esc(tip) + '" aria-label="' + esc(tip + ' — 이 종류만 보기') + '"' + (on ? ' aria-current="page"' : '') + '>' +
            '<span class="mi-icon">' + (SB_ICON[c.key] || (c.custom ? '🆕' : '📄')) + '</span><span class="mi-text">' + esc(c.label) + '</span><span class="mi-n">' + c.n + '</span></button>' +
            (c.custom ? '<button type="button" class="sb-ed" data-catedit="' + esc(c.key) + '" title="이 종류 고치기" aria-label="' + esc(c.label) + ' 종류 고치기">✎</button>' : '') + '</div>';
        }).join('') + '</div>';
      }
      h += '</div>';
    });
    h += '<div class="sb-sep"></div><div class="sb-menu top"><button type="button" class="sb-menu-item add" data-catnew title="새로 생긴 강의를 종류로 더합니다 — 이름·찾을 낱말·법정 여부"><span class="mi-icon">＋</span><span class="mi-text">새 강의 종류</span></button></div>';
    nav.innerHTML = h;
  }
  /* 왼쪽 메뉴는 재직 직원으로 들어온 뒤에만(PC) — 로그인 전·잠금·로그아웃이면 걷는다 */
  function sbOn(on) { document.body.classList.toggle('has-sb', !!on); }
  /* 메뉴 위 사람 칸 — 이름(명부)과 자격만. 로그인 이메일·사번은 적지 않는다 */
  function sbUser() {
    var nm = who() || '';
    $('sbName').textContent = nm || '—';
    $('sbAv').textContent = nm ? nm.slice(0, 2) : '🎓';
    $('sbRole').textContent = ME.admin ? '관리자' : '재직 직원';
  }

  /* ───────── 한눈에 ───────── */
  function drawDash() {
    var d = K.dashboard(list());
    var pcOnly = K.live(list()).filter(function (it) { return it.store === 'pc'; }).length;
    $('kpis').innerHTML =
      kpi(d.total, '모은 강의자료', '') + kpi(d.cloud, '자료함에 원본 있음', 'cloud') +
      kpi(pcOnly, '원본은 아직 PC에만', 'pc') + kpi(d.review, '검토 대기', 'review');
    /* 종류 카드 — «법정교육 자료» / «법정교육 외 자료» 두 덩어리(자료함과 같은 잣대 K.splitLegal · 대표 지시 2026-11-22).
       카드는 «단추 노릇 칸»(role=button). 사람이 더한 종류의 ✎(고치기)는 카드 «밖»의 형제 단추로 둔다
       (단추 안에 단추를 넣으면 화면 읽기 도구가 안쪽 단추를 못 읽는다) — .catw 로 감싸 카드 오른쪽 아래에 얹는다.
       덩어리 머리줄이 «법정»을 말하므로 카드 안 «법정» 꼬리표는 뺐다(이름 자리를 남긴다) — 근거 조문 줄과 파란 띠는 그대로. */
    function catCard(c) {
      var words = c.custom ? (C.catByKey(c.key).words || []).join(', ') : '';
      return (c.custom ? '<div class="catw">' : '') +
        '<div class="cat' + (c.legal ? ' legal' : '') + (c.n ? '' : ' zero') + (c.custom ? ' mine' : '') + '" role="button" tabindex="0" data-cat="' + esc(c.key) + '" aria-label="' + esc(c.label + ' ' + c.n + '건 — 이 종류만 보기') + '">' +
        '<div class="nm"><span title="' + esc(c.label) + '">' + esc(c.label) + '</span><span class="n">' + c.n + '</span></div>' +
        '<div class="ln"><span>최근 ' + esc(c.latest || '—') + '</span><span>원본 ' + c.cloud + '</span><span>검토 ' + c.review + '</span><span>' + esc(K.fmtBytes(c.bytes)) + '</span></div>' +
        (c.legal && c.law ? '<div class="ln"><span title="' + esc(c.law) + '">' + esc(c.law) + '</span></div>' : (c.custom ? '<div class="ln"><span title="' + esc(words) + '">찾을 낱말 ' + esc(words || c.label) + '</span></div>' : '')) + '</div>' +
        (c.custom ? '<button type="button" class="ced" data-catedit="' + esc(c.key) + '" title="이 종류 고치기" aria-label="' + esc(c.label) + ' 종류 고치기">✎</button></div>' : '');
    }
    var addCard = '<button type="button" class="cat add" data-catnew title="새로 생긴 강의를 종류로 더합니다 — 이름·찾을 낱말·법정 여부">＋ 새 강의 종류<span class="ln"><span>새 강의가 생기면 여기서 종류로 더합니다</span></span></button>';
    $('cats').innerHTML = K.splitLegal(d.cats).map(function (s) {
      var cards = s.cats.map(catCard).join('') + (s.key === 'other' ? addCard : '');
      return '<section class="lgrp ' + s.key + '" aria-label="' + esc(s.label + ' ' + s.n + '건') + '">' +
        '<div class="lgh"><span class="lgt">' + (s.key === 'legal' ? '⚖ ' : '📘 ') + esc(s.label) + '</span><span class="chip">' + s.n + '건</span>' +
        '<span class="lgm">' + s.kinds + '종 · ' + esc(K.fmtBytes(s.bytes)) + (s.review ? ' · 검토 ' + s.review : '') + '</span>' +
        '<button type="button" class="sm" data-legal="' + s.key + '" title="' + esc(s.label) + '만 자료함에서 보기">자료함<span class="wide-only">에서 보기</span> →</button></div>' +
        '<div class="cats">' + (cards || '<div class="empty">아직 없습니다</div>') + '</div></section>';
    }).join('');
    drawMatrix(d);
    drawSimCard();
  }
  /* 종류 × 연도 — 종류를 줄로, 연도를 칸으로(연도 칸은 좁아 옆으로 넘치지 않는다). 최근 12해만 따로, 그 이전은 «~YYYY» 한 칸.
     칸 색이 진할수록 많다(가장 많은 칸 대비). 칸을 누르면 그 종류·연도만 목록으로. */
  function drawMatrix(d) {
    if (!d.total) { $('mx').innerHTML = '<div class="empty">자료가 생기면 연도별로 셉니다.</div>'; return; }
    var narrow = window.matchMedia && window.matchMedia('(max-width:768px)').matches;
    /* 연도 칸 수는 «표가 받은 너비»로 — 왼쪽 종류 대시보드 옆에 설 때는 좁아지므로 칸이 짓눌리지 않게 줄인다(종류 칸·합계 칸을 빼고 한 칸 약 40px) */
    var w = $('mx').clientWidth || 800;
    var yc = K.yearCols(d.years, narrow ? 5 : Math.max(4, Math.min(12, Math.floor((w - 246) / 40) - 2)));
    var cols = yc.cols.concat(yc.none ? ['none'] : []);
    /* 줄은 «법정교육 자료» 먼저, 그다음 «법정교육 외 자료» — 덩어리마다 머리줄 */
    var sides = K.splitLegal(d.cats.filter(function (c) { return c.n > 0; })).filter(function (s) { return s.cats.length; });
    var rowsC = [];
    sides.forEach(function (s) { rowsC = rowsC.concat(s.cats); });
    function cnt(catKey, y) {
      if (y === yc.olderKey) return yc.older.reduce(function (s, yy) { return s + (((d.matrix[yy] || {})[catKey]) || 0); }, 0);
      return ((d.matrix[y] || {})[catKey]) || 0;
    }
    function yName(y) { return y === 'none' ? '강의일 모름' : y === yc.olderKey ? y.slice(1) + '년까지' : y + '년'; }
    function yHead(y) { return y === 'none' ? '모름' : y; }
    var max = 0;
    rowsC.forEach(function (c) { cols.forEach(function (y) { var n = cnt(c.key, y); if (n > max) max = n; }); });
    function heat(n) { var r = max ? n / max : 0; return r > 0.66 ? ' h3' : r > 0.33 ? ' h2' : ' h1'; }
    var colSum = {}, all = 0;
    var h = '<table><colgroup><col class="mk">' + cols.map(function (y) { return y === yc.olderKey ? '<col class="mo">' : '<col>'; }).join('') + '<col class="ms"></colgroup>' +
      '<thead><tr><th class="mk">종류</th>' + cols.map(function (y) { return '<th title="' + esc(yName(y)) + '">' + esc(yHead(y)) + '</th>'; }).join('') + '<th>합계</th></tr></thead><tbody>';
    var rowOf = function (c) {
      var sum = 0;
      h += '<tr><th class="mk" title="' + esc(c.label) + '"><span class="one"><span>' + esc(c.label) + '</span></span></th>';
      cols.forEach(function (y) {
        var n = cnt(c.key, y); sum += n; colSum[y] = (colSum[y] || 0) + n;
        h += n ? '<td class="c' + heat(n) + '" role="button" tabindex="0" aria-label="' + esc(yName(y) + ' ' + c.label + ' ' + n + '건') + '" title="' + esc(yName(y) + ' · ' + c.label + ' ' + n + '건') + '" data-y="' + esc(y) + '" data-cat="' + esc(c.key) + '">' + n + '</td>' : '<td class="z">·</td>';
      });
      all += sum;
      h += '<td class="ms"><b>' + sum + '</b></td></tr>';
    };
    sides.forEach(function (s) {
      h += '<tr class="mg ' + s.key + '"><th colspan="' + (cols.length + 2) + '" title="' + esc(s.label) + '">' + esc(s.label) + '<span class="hint">' + s.kinds + '종 · ' + s.n + '건</span></th></tr>';
      s.cats.forEach(rowOf);
    });
    h += '<tr class="mt"><th class="mk">합계</th>' + cols.map(function (y) { return '<td>' + (colSum[y] || 0) + '</td>'; }).join('') + '<td class="ms"><b>' + all + '</b></td></tr>';
    $('mx').innerHTML = h + '</tbody></table>';
  }
  function kpi(n, label, store) {
    return store ? '<button type="button" class="kpi" data-store="' + esc(store) + '" title="이것만 목록으로"><b>' + n + '</b><span>' + esc(label) + '</span></button>'
      : '<div class="kpi"><b>' + n + '</b><span>' + esc(label) + '</span></div>';
  }

  /* ───────── 자료 목록 ───────── */
  function fillFilters() {
    $('fCat').innerHTML = '<option value="">종류 전체</option>' + C.CATS.map(function (c) { return '<option value="' + esc(c.key) + '">' + esc(c.label) + (c.legal ? ' (법정)' : '') + '</option>'; }).join('');
    var ys = {}; K.live(list()).forEach(function (it) { var y = K.yearOf(it.lectureDate); if (y) ys[y] = 1; });
    $('fYear').innerHTML = '<option value="">연도 전체</option>' + Object.keys(ys).sort().reverse().map(function (y) { return '<option value="' + esc(y) + '">' + esc(y) + '년</option>'; }).join('') + '<option value="none">강의일 모름</option>' +
      (/^~\d{4}$/.test(F.year) ? '<option value="' + esc(F.year) + '">' + esc(F.year.slice(1)) + '년까지</option>' : '');
    /* 새 종류를 더한 뒤 «맞는 자료»만 골라 보여 주는 중 — 무엇을 보고 있는지 말하고, 한 번에 풀 수 있게 */
    var nIds = F.ids ? Object.keys(F.ids).length : 0;
    $('fIds').style.display = nIds ? '' : 'none';
    $('fIds').innerHTML = nIds ? '<span>추천 ' + nIds + '건만 보는 중</span><button type="button" class="sm" id="fIdsX" title="모든 자료 보기">✕</button>' : '';
    $('fQ').value = F.q; $('fCat').value = F.cat; $('fYear').value = F.year; $('fKind').value = F.kind;
    $('fStatus').value = F.status; $('fStore').value = F.store; $('fLegal').value = F.legal || ''; $('fGroup').value = GROUP; $('fTrash').checked = F.trash;
    /* 폰에서 «⋯ 더» 안에 접힌 거르개가 걸려 있으면 펼쳐 둔다 — 걸린 거르개가 안 보이면 «왜 적게 나오나»를 모른다 */
    if (F.kind || F.status || F.store || F.legal || F.trash) { $('fMore').parentNode.classList.add('open'); $('fMore').textContent = '접기'; }
  }
  function visible() {
    var src = F.trash ? list().filter(function (it) { return it && it._deleted; }).map(function (it) { return Object.assign({}, it, { _deleted: false, _wasDeleted: true }); }) : list();
    if (F.ids) src = src.filter(function (it) { return !!F.ids[it.id]; });
    return K.sortByDate(K.filter(src, F));
  }
  var RENDERED = [];
  /* 자료함 덩어리 머리줄 — «법정교육 자료» / «법정교육 외 자료»(종류별로 묶었을 때만) */
  function lsecHead(sec) {
    return '<div class="lsec ' + esc(sec.key) + '" role="heading" aria-level="3"><span>' + (sec.key === 'legal' ? '⚖ ' : '📘 ') + esc(sec.label) + '</span>' +
      '<span class="chip">' + sec.n + '건</span><span class="lgm">' + sec.groups.length + '종</span></div>';
  }
  function drawList() {
    fillFilters();
    drawSb();                                    /* 거르개가 바뀌면 왼쪽 메뉴의 «지금 보는 자리»도 바뀐다 */
    [].forEach.call(document.querySelectorAll('#vSeg [data-view]'), function (b) { var on = b.getAttribute('data-view') === VIEW; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    var rows = visible();
    var groups = K.group(rows, GROUP);
    if (VIEW === 'card') { drawCards(rows, groups); return; }
    var n = 0, h = '';
    RENDERED = [];
    if (!rows.length) h = '<div class="empty">' + (LOADED ? '거르개에 맞는 자료가 없습니다.' : '불러오는 중…') + '</div>';
    var addGroupTable = function (g) {
      if (n >= SHOWN) return;
      if (GROUP) h += '<div class="grp">' + esc(g.label) + ' <span class="chip">' + g.items.length + '</span></div>';
      h += '<table class="lst"><thead><tr><th class="ck"><input type="checkbox" data-allg="' + esc(g.key) + '" title="이 묶음에서 보이는 줄 모두 고르기"></th><th class="no">№</th>' +
        '<th class="dt">강의일</th><th class="ct">종류</th><th class="tt">제목</th><th class="vn">강의처</th><th class="fm">형식·크기</th><th class="st">상태</th><th class="ac"></th></tr></thead><tbody>';
      g.items.forEach(function (it) {
        if (n >= SHOWN) return;
        n++; RENDERED.push(it.id);
        var on = !!PICK[it.id];
        h += '<tr data-id="' + esc(it.id) + '" data-g="' + esc(g.key) + '"' + (on ? ' class="picked"' : '') + '>' +
          '<td class="ck"><input type="checkbox" aria-label="' + esc(it.title || it.fileName) + ' 고르기" data-pick="' + esc(it.id) + '"' + (on ? ' checked' : '') + '></td>' +
          '<td class="no">' + n + '</td>' +
          '<td class="dt">' + dateCell(it) + '</td>' +
          '<td class="ct"><span class="one"><span title="' + esc(catLabel(it.cat)) + '">' + esc(catLabel(it.cat)) + '</span>' + (C.catByKey(it.cat).legal ? '<span class="tag legal">법정</span>' : '') + '</span></td>' +
          '<td class="tt"><span class="one"><button type="button" class="ttl" data-open="' + esc(it.id) + '" title="' + esc(it.title + ' — ' + it.fileName) + '">' + simBadge(it.id) + esc(it.title) + '</button></span></td>' +
          '<td class="vn" title="' + esc(it.venue) + '">' + esc(it.venue) + '</td>' +
          '<td class="fm" title="' + esc(it.fileName + ' · ' + K.fmtBytes(it.size)) + '">' + esc((it.ext || '').toUpperCase() + ' · ' + K.fmtBytes(it.size)) + '</td>' +
          '<td class="st"><span class="one">' + statusTags(it) + '</span></td>' +
          '<td class="ac">' + (it._wasDeleted ? '<span class="hint">' + esc(ymd(it.deletedAt)) + ' 지움</span>' :
            '<button class="sm" data-open="' + esc(it.id) + '" title="자세히·검토">👁</button> <button class="sm" data-win="' + esc(it.id) + '" title="새 창으로 열기">🪟</button>') + '</td>' +
          '<td class="meta"><span class="one"><span>' + esc([it.lectureDate || '강의일 모름', catLabel(it.cat), K.fmtBytes(it.size)].join(' · ')) + '</span>' + statusTags(it) + '</span></td>' +
          '</tr>';
      });
      h += '</tbody></table>';
    };
    /* 종류별로 묶었으면 «법정교육 자료» 먼저, 그다음 «법정교육 외 자료» — 번호(№)는 두 덩어리를 이어 «지금 보이는 순서» */
    var tsecs = GROUP === 'cat' ? K.splitGroups(groups).filter(function (s) { return s.groups.length; }) : [{ key: '', groups: groups }];
    tsecs.forEach(function (sec) {
      if (n >= SHOWN) return;
      if (sec.key) h += lsecHead(sec);
      sec.groups.forEach(addGroupTable);
    });
    if (rows.length > SHOWN) h += '<button class="more" id="moreBtn">더 보기 (' + (rows.length - SHOWN) + '건 남음)</button>';
    /* 폰에서는 표 머리줄(☐)이 숨으므로 «보이는 줄 모두 고르기»를 따로 둔다 */
    if (RENDERED.length) h = '<label class="phone-only hint" style="margin:2px 0 6px"><input type="checkbox" data-allv> 보이는 ' + RENDERED.length + '줄 모두 고르기</label>' + h;
    $('list').innerHTML = h;
    drawSel();
  }
  /* 카드 대시보드 — 묶음(종류·연도)마다 카드 한 장: 건수·최근 강의일·검토 대기 + 늦은 강의일 먼저 CARD_TOP 줄.
     ★ 줄마다 맨 왼쪽 ☐ + 번호(카드 안에서 보이는 순서) — 고르면 표 보기와 같은 «N건 선택» 줄이 뜬다(나란히·새 창·종류 바꾸기).
     ★ 한 줄은 한 줄 — 강의일·제목·형식, 넘치는 제목은 … + title. 표 보기는 «☰ 표»로 그대로 남는다. */
  function drawCards(rows, groups) {
    RENDERED = [];
    var h = '';
    if (!rows.length) h = '<div class="empty">' + (LOADED ? '거르개에 맞는 자료가 없습니다.' : '불러오는 중…') + '</div>';
    else {
      var gs = GROUP ? groups : [{ key: 'all', label: '모든 자료', items: rows }];
      /* 한 묶음만 보일 때(종류 카드·표 칸을 눌러 왔을 때)와 추천만 보는 중엔 처음부터 다 펼친다 — 고른 줄·찾던 줄이 숨지 않게 */
      var forced = !!F.ids || gs.length === 1;
      var addGroupCard = function (g) {
        var open = forced || !!EXPAND[g.key];
        var shown = open ? g.items : g.items.slice(0, CARD_TOP);
        var c = GROUP === 'cat' ? C.catByKey(g.key) : null;
        var rev = 0, latest = '';
        g.items.forEach(function (it) { if (it.status === 'review') rev++; if (String(it.lectureDate || '') > latest) latest = String(it.lectureDate); });
        var allOn = shown.length > 0 && shown.every(function (it) { return !!PICK[it.id]; });
        h += '<section class="gcard' + (open ? ' open' : '') + (c && c.legal ? ' legal' : '') + '" aria-label="' + esc(g.label + ' ' + g.items.length + '건') + '">' +
          '<div class="gh"><input type="checkbox" data-allg="' + esc(g.key) + '" aria-label="' + esc(g.label) + ' — 이 카드에 보이는 줄 모두 고르기" title="이 카드에 보이는 줄 모두 고르기"' + (allOn ? ' checked' : '') + '>' +
          '<span class="gn" title="' + esc(g.label) + '">' + esc(g.label) + '</span>' + (c && c.legal ? '<span class="tag legal" title="' + esc(c.law) + '">법정</span>' : '') +
          '<span class="chip">' + g.items.length + '</span><span class="gm">최근 ' + esc(latest || '—') + (rev ? ' · 검토 ' + rev : '') + '</span></div><div class="gl">';
        shown.forEach(function (it, i) {
          RENDERED.push(it.id);
          var on = !!PICK[it.id];
          var est = !!(it.lectureDate && it.dateFrom && it.dateFrom !== 'manual');
          var tip = it.title + ' — ' + it.fileName + (it.summary ? ' · ' + it.summary.slice(0, 160) : '');
          h += '<div class="gr' + (on ? ' picked' : '') + '" data-id="' + esc(it.id) + '" data-g="' + esc(g.key) + '">' +
            '<input type="checkbox" aria-label="' + esc(it.title || it.fileName) + ' 고르기" data-pick="' + esc(it.id) + '"' + (on ? ' checked' : '') + '>' +
            '<span class="no">' + (i + 1) + '</span>' +
            '<span class="gd' + (est ? ' est' : '') + '" title="' + esc(it.lectureDate ? (est ? estWhy(it.dateFrom) : '강의일(확정)') : '강의일 모름') + '">' + esc(it.lectureDate || '—') + '</span>' +
            '<button type="button" class="ttl" data-open="' + esc(it.id) + '" title="' + esc(tip) + '">' + simBadge(it.id) + esc(it.title) + '</button>' +
            '<span class="ge" title="' + esc(it.fileName + ' · ' + K.fmtBytes(it.size)) + '">' + esc((it.ext || '').toUpperCase()) + '</span>' +
            (it._wasDeleted ? '<span class="hint">지움</span>' : '<span class="dot ' + esc(it.status) + '" title="' + esc((K.STATUS[it.status] || '') + (it.store !== 'cloud' ? ' · ' + (K.STORE[it.store] || '') : '')) + '"></span>') +
            '</div>';
        });
        h += '</div>';
        if (g.items.length > CARD_TOP && !forced) h += '<button type="button" class="sm gmore" data-gx="' + esc(g.key) + '" aria-expanded="' + (open ? 'true' : 'false') + '">' + (open ? '접기 ▴' : '더 보기 (' + (g.items.length - CARD_TOP) + '건) ▾') + '</button>';
        h += '</section>';
      };
      /* 종류별로 묶었으면 «법정교육 자료» / «법정교육 외 자료» 두 덩어리 — 덩어리마다 머리줄(건수·종 수)과 제 카드 칸 */
      var csecs = GROUP === 'cat' ? K.splitGroups(gs).filter(function (s) { return s.groups.length; }) : [{ key: '', groups: gs }];
      csecs.forEach(function (sec, si) {
        if (sec.key) h += lsecHead(sec);
        h += '<div class="cgrid">';
        sec.groups.forEach(addGroupCard);
        if (GROUP === 'cat' && !F.trash && !F.ids && si === csecs.length - 1) h += '<button type="button" class="gcard add" data-catnew title="새로 생긴 강의를 종류로 더합니다">＋ 새 강의 종류</button>';
        h += '</div>';
      });
    }
    if (RENDERED.length) h = '<label class="phone-only hint" style="margin:2px 0 6px"><input type="checkbox" data-allv> 보이는 ' + RENDERED.length + '줄 모두 고르기</label>' + h;
    $('list').innerHTML = h;
    drawSel();
  }
  function picked() { return Object.keys(PICK).filter(function (id) { return PICK[id] && ITEMS[id]; }); }
  function drawSel() {
    var ids = picked();
    $('selbar').classList.toggle('on', ids.length > 0);
    $('selN').textContent = ids.length + '건 선택';
    $('sRestore').style.display = F.trash ? '' : 'none';
    ['sCmp', 'sWin', 'sCat', 'sOk', 'sDel'].forEach(function (b) { $(b).style.display = F.trash ? 'none' : ''; });
    /* 머리줄 ☐ 는 «그 묶음에서 보이는 줄이 다 골라졌을 때만» 켜진다 — 한 줄을 풀면 함께 풀린다 */
    [].forEach.call(document.querySelectorAll('#list [data-allg]'), function (c) {
      var rs = document.querySelectorAll('#list [data-id][data-g="' + CSS.escape(c.getAttribute('data-allg')) + '"]');
      c.checked = rs.length > 0 && [].every.call(rs, function (tr) { return !!PICK[tr.getAttribute('data-id')]; });
    });
    var av = document.querySelector('#list [data-allv]');
    if (av) av.checked = RENDERED.length > 0 && RENDERED.every(function (id) { return !!PICK[id]; });
  }

  /* ───────── 저장(관문) ───────── */
  function savePatch(id, changes) {
    var cur = ITEMS[id]; if (!cur) return Promise.reject(new Error('자료를 찾지 못했습니다'));
    var p = K.patchOf(cur, changes);
    if (!p) return Promise.resolve(false);
    return gate.save(itemRef(id), function (prev) {
      var base = prev || cur;
      var next = Object.assign({}, base);
      Object.keys(p).forEach(function (k) { if (k !== 'revision' && k !== 'updatedAt') next[k] = p[k]; });
      return next;
    }, { entityType: K.ENTITY }).then(function () { return true; });
  }
  function saveRaw(id, fn) {
    return gate.save(itemRef(id), function (prev) { return fn(prev ? Object.assign({}, prev) : (ITEMS[id] ? Object.assign({}, ITEMS[id]) : null)); }, { entityType: K.ENTITY });
  }
  function saveNew(it) {
    return gate.save(itemRef(it.id), it, { entityType: K.ENTITY, expectedRevision: -1 });
  }
  function trashItem(id) {
    var cur = ITEMS[id]; if (!cur) return Promise.resolve();
    return gate.remove(itemRef(id), cur, { entityType: K.ENTITY });
  }
  function restoreItem(id) {
    return saveRaw(id, function (prev) {
      if (!prev) return prev;
      delete prev._deleted; delete prev.deletedAt; delete prev.deletedBy;
      return prev;
    });
  }
  /* 한꺼번에 — 건수를 묻고, 끝까지 한 번에 한다(실패한 것은 따로 알린다) */
  function bulk(ids, label, fn) {
    if (!ids.length) return;
    if (!window.confirm(ids.length + '건을 ' + label + ' 할까요?')) return;
    var ok = 0, bad = 0;
    return ids.reduce(function (p, id) {
      return p.then(function () { return fn(id).then(function () { ok++; }, function () { bad++; }); });
    }, Promise.resolve()).then(function () {
      PICK = {};
      toast(label + ' — ' + ok + '건' + (bad ? ' · 못 한 것 ' + bad + '건' : ''));
      draw();
    });
  }

  /* ───────── 원본 가져오기(미리보기·내려받기) — 열 때마다 «권한 확인» (2026-11-22) ─────────
     ★★ 내려받기 토큰 주소를 만들지 않는다 — 그 주소는 한 번 새면(방문 기록·복사·퇴사한 사람) 누구나 «평생» 연다.
        대신 지금 로그인한 사람의 증표(ID 토큰)를 머리글에 실어 창고에 직접 묻는다 → 창고 규칙 isStaff()(재직 직원)를 «매번» 거친다.
        받은 바이트는 이 창 안의 blob: 주소로만 쓰고, 칸·창을 닫으면 풀어 준다(freeObjUrls) · 받는 중이면 멈춘다(stopFetches).
     ⚠ 창고 CORS 는 이 길(Authorization·Range 머리글)을 이미 받는다 — 2026-11-22 사전 요청(OPTIONS)으로 확인.
     ⚠ 영상은 «다 받은 뒤» 재생한다(머리글을 실은 채 흘려 보기는 브라우저가 못 한다). 큰 것은 눌러야 받는다(MEDIA_AUTO_MAX). */
  var STORE_API = 'https://firebasestorage.googleapis.com/v0/b/';
  var MEDIA_AUTO_MAX = 150 * 1024 * 1024;       /* 이보다 큰 영상·소리는 «받아서 보기»를 눌러야 받는다 — 자세히만 열어도 1GB 가 내려오지 않게 */
  function apiUrlOf(it) {
    return STORE_API + encodeURIComponent(String(BUCKET).replace(/^gs:\/\//, '')) + '/o/' + encodeURIComponent(it.storagePath) + '?alt=media';
  }
  function pctText(got, total) { return total > 0 ? Math.min(99, Math.floor(got * 100 / total)) + '%' : K.fmtBytes(got); }
  /* blob: 주소는 이 앱과 «같은 출처»다 — 창고에 적힌 종류(Content-Type)를 그대로 두면 html·svg 같은 «문서»가 새 탭에서 앱 출처로 열릴 수 있다.
     그래서 보기용 blob 은 확장자 허용 목록의 종류로 «다시 싸고», 목록에 없으면 바이트만(octet-stream — 띄우지 않고 내려받기만 된다). */
  var SAFE_MEDIA_TYPE = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp',
    mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', mkv: 'video/x-matroska', wmv: 'video/x-ms-wmv', avi: 'video/x-msvideo',
    mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav'
  };
  function safeBlob(b, ext) { return new Blob([b], { type: SAFE_MEDIA_TYPE[String(ext || '').toLowerCase()] || 'application/octet-stream' }); }
  /* 받는 만큼 알려 준다 — 바이트는 그대로 흘려 보낸다(모아 두지 않는다) */
  function withProgress(r, total, onProgress) {
    if (!onProgress || !r.body || typeof r.body.getReader !== 'function' || typeof ReadableStream !== 'function') return r;
    var reader = r.body.getReader(), got = 0;
    return new Response(new ReadableStream({
      pull: function (ctl) {
        return reader.read().then(function (x) {
          if (x.done) { ctl.close(); return; }
          got += x.value.byteLength;
          try { onProgress(got, total); } catch (e) {}
          ctl.enqueue(x.value);
        });
      },
      cancel: function (why) { return reader.cancel(why); }
    }), { headers: r.headers });
  }
  var FETCHES = [];                             /* { ac, owner } — 받는 중인 것. owner 칸을 닫으면 멈춘다(내려받기는 owner 없음 → 창을 닫아도 끝까지) */
  function stopFetches(root) {
    FETCHES = FETCHES.filter(function (f) {
      if (root && !(f.owner && root.contains(f.owner))) return true;
      try { f.ac.abort(); } catch (e) {}
      return false;
    });
  }
  function authUid() { var u = firebase.auth().currentUser; return u ? String(u.uid || '') : ''; }
  /* 로그아웃·계정 바꿈 — 받던 것(내려받기 포함)을 모두 멈추고, 열린 칸·blob 주소를 모두 푼다(앞 사람의 원본이 이 탭에 남지 않게) */
  function resetOriginals() {
    stopFetches();
    try { closeCompare(); } catch (e) {}
    try { if ($('modal').style.display !== 'none' && DETAIL) closeDetail(); } catch (e) {}
    freeObjUrls();
    DL_URLS.slice().forEach(freeDl);
    DL_BUSY = {};
  }
  /* as: 'buf'(ArrayBuffer) | 'blob' */
  function fetchOriginal(it, as, onProgress, owner) {
    if (!it || it.store !== 'cloud' || !it.storagePath || !bucket) return Promise.reject(new Error('자료함에 원본이 없습니다'));
    var u = firebase.auth().currentUser;
    if (!u) return Promise.reject(new Error('로그인이 필요합니다'));
    var f = (typeof AbortController === 'function') ? { ac: new AbortController(), owner: owner || null } : null;
    if (f) FETCHES.push(f);
    var done = function () { if (f) FETCHES = FETCHES.filter(function (x) { return x !== f; }); };
    return u.getIdToken().then(function (tok) {
      return fetch(apiUrlOf(it), { headers: { Authorization: 'Firebase ' + tok }, cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer', signal: f ? f.ac.signal : undefined });
    }).then(function (r) {
      if (r.status === 401 || r.status === 403) throw new Error('열 권한이 없습니다 — 재직 직원만 엽니다(다시 로그인해 보세요)');
      if (r.status === 404) throw new Error('창고에 원본이 없습니다');
      if (!r.ok) throw new Error('창고에서 받지 못했습니다(' + r.status + ')');
      var rr = withProgress(r, (+it.size || 0) || (+r.headers.get('Content-Length') || 0), onProgress);
      return as === 'blob' ? rr.blob() : rr.arrayBuffer();
    }).then(function (x) { done(); return x; }, function (e) {
      done();
      if (e && e.name === 'AbortError') throw new Error('닫아서 받기를 멈췄습니다');
      throw e;
    });
  }
  function callFn(fn, body) {
    var u = firebase.auth().currentUser;
    if (!u) return Promise.reject(new Error('로그인이 필요합니다'));
    return u.getIdToken().then(function (tok) {
      return fetch(MB_FN + fn, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: JSON.stringify(body) });
    }).then(function (r) { return r.json().catch(function () { return {}; }); }).then(function (j) {
      if (!j || !j.ok) throw new Error((j && j.error) || '메일 서버에서 받지 못했습니다');
      return j;
    });
  }
  function b64ToBytes(b64) {
    var bin = atob(b64 || ''), n = bin.length, out = new Uint8Array(n);
    for (var i = 0; i < n; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function bytesOf(it, onProgress, owner) {
    if (it.store === 'cloud') {
      if ((+it.size || 0) > PuViewerKind.MAX_BYTES && it.kind === 'doc') return Promise.reject(new Error('파일이 커서(' + K.fmtBytes(it.size) + ') 미리보기를 건너뜁니다 — 원본을 내려받아 여세요'));
      return fetchOriginal(it, 'buf', onProgress, owner);
    }
    return Promise.reject(new Error('자료함에 원본이 없습니다'));
  }
  /* 내려받기 — 권한 확인 길로 받아 이 창에서 파일로 저장한다(새 탭에 창고 주소를 띄우지 않는다 → 방문 기록에도 주소가 안 남는다) */
  var DL_BUSY = {};
  var DL_URLS = [];                             /* { u, a } — 저장을 넘긴 뒤 잠깐 두는 blob 주소 */
  function freeDl(d) {
    DL_URLS = DL_URLS.filter(function (x) { return x !== d; });
    try { d.a.remove(); } catch (e) {}
    try { URL.revokeObjectURL(d.u); } catch (e) {}
  }
  function downloadOriginal(it, btn) {
    if (!it) return;
    if (DL_BUSY[it.id]) { toast('이미 받는 중입니다'); return; }
    DL_BUSY[it.id] = true;
    var label = btn ? btn.textContent : '';
    var show = function (got, total) { if (btn) btn.textContent = '⬇ ' + pctText(got, total); };
    var uid0 = authUid();
    if (btn) btn.disabled = true;
    show(0, +it.size || 0);
    fetchOriginal(it, 'blob', show, null).then(function (blob) {
      if (authUid() !== uid0) throw new Error('로그인한 사람이 바뀌어 저장하지 않았습니다');   /* 받는 사이 로그아웃·계정 바꿈 → 저장하지 않는다 */
      var u = URL.createObjectURL(safeBlob(blob, ''));      /* 내려받기는 늘 바이트만(octet-stream) — 이 주소가 문서로 열리지 않게 */
      var a = document.createElement('a'); a.href = u; a.download = it.fileName || 'file'; a.rel = 'noopener';
      document.body.appendChild(a); a.click();
      var d = { u: u, a: a }; DL_URLS.push(d);             /* 로그아웃하면 기다리지 않고 바로 푼다(resetOriginals) */
      setTimeout(function () { freeDl(d); }, 60000);
      toast('내려받았습니다 — ' + (it.fileName || ''));
    }).catch(function (e) { toast('내려받지 못했습니다 — ' + errMsg(e), 7000); }).then(function () {
      delete DL_BUSY[it.id];
      if (btn) { btn.disabled = false; btn.textContent = label; }
    });
  }

  /* ───────── 보기 칸(나란히 보기·자세히가 함께 쓴다) ───────── */
  var FRAMES = [];                              /* { win, pane, queued, ready } */
  window.addEventListener('message', function (e) {
    for (var i = 0; i < FRAMES.length; i++) {
      var f = FRAMES[i];
      if (!f.iframe.contentWindow || e.source !== f.iframe.contentWindow) continue;   /* 우리 칸이 아닌 곳의 말은 듣지 않는다 */
      var m = e.data; if (!m || typeof m !== 'object') return;
      if (m.t === 'ready') { f.ready = true; if (f.queued) { var q = f.queued; f.queued = null; post(f, q.msg, q.tr); } }
      else if (m.t === 'opened') { f.pages = m.pages | 0; f.cur = 1; pager(f); }
      else if (m.t === 'page') { f.cur = m.n | 0; pager(f); }
      else if (m.t === 'error') { f.body.innerHTML = '<div class="msg">열지 못했습니다 — ' + esc(m.msg || '') + '</div>'; }
      return;
    }
  });
  function post(f, msg, tr) { try { f.iframe.contentWindow.postMessage(msg, '*', tr || []); } catch (e) {} }
  function pager(f) {
    if (!f.pg) return;
    f.pg.innerHTML = f.pages > 1 ? '<button class="sm" data-pg="-1">◀</button> <span class="hint">' + f.cur + '/' + f.pages + '쪽</span> <button class="sm" data-pg="1">▶</button>' : (f.pages ? '<span class="hint">1쪽</span>' : '');
    f.pg.onclick = function (ev) {
      var b = ev.target.closest('[data-pg]'); if (!b) return;
      var n = Math.max(1, Math.min(f.pages, f.cur + (+b.getAttribute('data-pg'))));
      post(f, { t: 'goto', page: n });
    };
  }
  function closeFrames(root) {
    stopFetches(root);
    freeObjUrls(root);
    FRAMES = FRAMES.filter(function (f) {
      if (root && !root.contains(f.iframe)) return true;
      post(f, { t: 'close' }); return false;
    });
  }
  /* PC 파일(올리지 않고 보기)·권한 확인 길로 받은 원본을 연 blob: 주소 — «그 칸»이 주인이다. 칸을 닫으면 그 칸의 것만 풀고,
     주인 칸이 화면에서 빠진 것은 다음에 만들 때 함께 푼다(원본 바이트가 메모리에 남지 않게). */
  var OBJURLS = [];                             /* { u, owner } */
  function objUrl(blob, owner) {
    freeObjUrls(null, true);
    var u = URL.createObjectURL(blob); OBJURLS.push({ u: u, owner: owner || null }); return u;
  }
  function freeObjUrls(root, orphansOnly) {
    OBJURLS = OBJURLS.filter(function (x) {
      var drop = orphansOnly ? !!(x.owner && !x.owner.isConnected) : (!root || !!(x.owner && root.contains(x.owner)));
      if (!drop) return true;
      try { URL.revokeObjectURL(x.u); } catch (e) {}
      return false;
    });
  }
  var _zipP = null;
  function loadZip() {
    if (window.JSZip) return Promise.resolve(window.JSZip);
    if (_zipP) return _zipP;
    _zipP = new Promise(function (res, rej) {
      var s = document.createElement('script'); s.src = 'vendor/jszip.min.js';
      s.onload = function () { window.JSZip ? res(window.JSZip) : rej(new Error('zip 도구를 못 읽었습니다')); };
      s.onerror = function () { _zipP = null; rej(new Error('zip 도구를 못 불러왔습니다')); };
      document.head.appendChild(s);
    });
    return _zipP;
  }

  /* 한 칸을 만든다 — it: 기록, opts.local: PC 에서 고른 File(올리지 않고 보기만) */
  function makePane(host, it, opts) {
    opts = opts || {};
    var pane = document.createElement('div'); pane.className = 'pn';
    var legal = C.catByKey(it.cat).legal;
    pane.innerHTML = '<div class="ph"><span class="t" title="' + esc(it.title + ' — ' + it.fileName) + '">' + esc(it.title) + '</span>' +
      (legal ? '<span class="tag legal">법정</span>' : '') + '<span class="m">' + esc(catLabel(it.cat)) + ' · ' + esc(it.lectureDate || '강의일 모름') + '</span></div>' +
      '<div class="pb"><div class="msg">불러오는 중…</div></div>' +
      '<div class="pf"><span class="pg"></span><span class="sp"></span>' +
      (opts.inDetail ? '' : '<button class="sm" data-act="detail">👁 자세히</button>') +
      (it.store === 'cloud' ? '<button class="sm" data-act="dl">⬇ 원본</button>' : '') +
      '<button class="sm" data-act="win" title="새 창으로">🪟</button>' +
      (opts.closable ? '<button class="sm" data-act="x" title="이 칸 닫기">✕</button>' : '') + '</div>';
    host.appendChild(pane);
    var body = pane.querySelector('.pb');
    pane.querySelector('.pf').addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-act]'); if (!b) return;
      var a = b.getAttribute('data-act');
      if (a === 'dl') downloadOriginal(it, b);
      else if (a === 'win') openWin(it.id);
      else if (a === 'pv') togglePpt(it, body, pane);
      else if (a === 'detail') { if (opts.onDetail) opts.onDetail(); openDetail(it.id); }
      else if (a === 'x') { closeFrames(pane); pane.remove(); if (opts.onClose) opts.onClose(); }
    });
    fillPane(it, body, pane, opts.local || null);
    return pane;
  }
  function fillPane(it, body, pane, localFile) {
    var ext = it.ext || C.extOf(it.fileName), kind = it.kind || C.kindOf(ext);
    /* 이 칸을 다시 채우거나 닫은 뒤에 도착한 결과는 버린다(앞의 받기가 뒤의 화면을 덮지 않게) */
    var seq = body._seq = (body._seq || 0) + 1;
    var live = function () { return body._seq === seq && pane.isConnected; };
    if (!localFile && it.store !== 'cloud') {
      var where = it.store === 'mail' ? '메일함 첨부' : 'PC';
      body.innerHTML = '<div class="msg">원본이 아직 <b>' + esc(where) + '</b>에만 있습니다.' +
        (it.source && it.source.path ? '<br>원래 자리: <code>' + esc(it.source.path) + '</code>' : '') +
        (it.source && it.source.mailSubject ? '<br>메일: ' + esc(it.source.mailSubject) : '') +
        '<br><br><button class="sm" data-local="1">📂 이 PC 의 파일로 보기</button> <span class="hint">올리지 않고 이 창에서만 봅니다 · 올리려면 «자세히»에서</span></div>';
      body.querySelector('[data-local]').onclick = function () { pickLocal(it, body, pane); };
      return;
    }
    if (kind === 'video' || kind === 'audio' || kind === 'image') {
      var showMedia = function (u) {
        body.innerHTML = '';
        var el = document.createElement(kind === 'image' ? 'img' : kind);
        if (kind !== 'image') { el.controls = true; el.preload = 'metadata'; }
        el.src = u; el.style.width = '100%';
        body.appendChild(el);
      };
      if (localFile) { showMedia(objUrl(safeBlob(localFile, ext), pane)); return; }
      var loadMedia = function () {
        body.innerHTML = '<div class="msg">원본을 받는 중… <b data-pr>0%</b><br><span class="hint">다 받은 뒤 재생합니다 · 이 칸을 닫으면 멈춥니다</span></div>';
        var pr = body.querySelector('[data-pr]');
        fetchOriginal(it, 'blob', function (got, total) { if (live()) pr.textContent = pctText(got, total); }, pane)
          .then(function (b) { if (live()) showMedia(objUrl(safeBlob(b, ext), pane)); })
          .catch(function (e) { if (live()) body.innerHTML = '<div class="msg">' + esc(errMsg(e)) + '</div>'; });
      };
      if (kind !== 'image' && (+it.size || 0) > MEDIA_AUTO_MAX) {
        body.innerHTML = '<div class="msg">큰 ' + (kind === 'video' ? '영상' : '소리') + ' 파일(' + esc(K.fmtBytes(it.size)) + ')입니다 — 다 받은 뒤 재생합니다.<br><br><button class="sm" data-load="1">▶ 받아서 보기</button></div>';
        body.querySelector('[data-load]').onclick = loadMedia;
        return;
      }
      loadMedia();
      return;
    }
    if (kind === 'archive') { body.innerHTML = '<div class="msg">압축 파일입니다 — 원본을 내려받아 풀어 보세요. 압축 안의 파일은 바꾸지 않고 그대로 둡니다.</div>'; return; }
    if (ext === 'ppt' || ext === 'doc' || ext === 'pps' || ext === 'show' || ext === 'key' || ext === 'odp') {
      body.innerHTML = '<div class="msg">옛 형식(' + esc(ext.toUpperCase()) + ')이라 이 화면에서는 미리보기를 못 합니다 — 원본을 내려받아 파워포인트·한쇼로 여세요.</div>'; return;
    }
    var bufP = localFile ? localFile.arrayBuffer()
      : bytesOf(it, function (got, total) { if (!live()) return; var m = body.querySelector('.msg'); if (m) m.textContent = '불러오는 중… ' + pctText(got, total); }, pane);
    bufP.then(function (buf) {
      if (!live()) return;
      /* 내용 지문(비슷한 강의) — 자료함 원본을 열었고 아직 없으면 만든다. 바이트가 칸으로 넘어가기 «전»에 사본을 뜬다(ensureSig 안) */
      if (!localFile && it.store === 'cloud') ensureSig(it.id, ext, buf).then(function (ok) { if (ok && live() && DETAIL === it.id) drawSim(); });
      if (ext === 'pptx' || ext === 'ppsx') return showPptx(it, body, pane, buf, live);
      if (ext === 'docx') return showTextParts(body, pane, buf, 'docx', live);
      var chk = PuViewerKind.check(buf, it.fileName);
      if (!chk.ok) { body.innerHTML = '<div class="msg">' + esc(chk.error || '이 형식은 미리보기를 못 합니다') + ' — 원본을 내려받아 여세요.</div>'; return; }
      body.innerHTML = '';
      var ifr = document.createElement('iframe');
      ifr.setAttribute('sandbox', 'allow-scripts');                 /* allow-same-origin 을 주지 않는다 — 문서뷰어와 같은 격리 */
      ifr.setAttribute('title', '문서 미리보기');
      body.appendChild(ifr);
      var f = { iframe: ifr, body: body, pg: pane.querySelector('.pg'), ready: false, queued: { msg: { t: 'open', buf: buf, name: it.fileName, kind: chk.kind }, tr: [buf] }, pages: 0, cur: 1 };
      FRAMES.push(f);
      ifr.src = 'pu-viewer-frame.html?v=1';
    }).catch(function (e) { if (live()) body.innerHTML = '<div class="msg">원본을 불러오지 못했습니다 — ' + esc(errMsg(e)) + '</div>'; });
  }
  /* 글자만 뽑아 보기 — 워드(docx)와 파워포인트의 «≡ 글자» */
  function showTextParts(body, pane, buf, kind, live) {
    return loadZip().then(function (Z) { return P.extract(Z, buf, kind); }).then(function (r) {
      if (!live()) return;
      body.innerHTML = '';
      var wrap = document.createElement('div'); wrap.className = 'slides';
      if (!r.parts.length) wrap.innerHTML = '<div class="msg">글자가 없는 자료입니다(그림만 있는 슬라이드) — 원본을 내려받아 보세요.</div>';
      r.parts.forEach(function (p) {
        var s = document.createElement('div'); s.className = 'slide';
        var n = document.createElement('div'); n.className = 'sn'; n.textContent = (kind === 'docx' ? '본문' : p.no + '쪽');
        var t = document.createElement('div'); t.className = 'st1'; t.textContent = p.title || '(제목 없음)';
        s.appendChild(n); s.appendChild(t);
        p.lines.slice(1).forEach(function (l) { var q = document.createElement('p'); q.textContent = l; s.appendChild(q); });
        wrap.appendChild(s);
      });
      if (r.truncated) { var more = document.createElement('div'); more.className = 'hint'; more.textContent = '앞 300쪽까지만 보였습니다.'; wrap.appendChild(more); }
      var note = document.createElement('div'); note.className = 'hint'; note.style.padding = '0 2px 6px';
      note.textContent = kind === 'docx' ? '글자만 뽑아 보였습니다 — 그림·도형 모양은 원본에서 보세요.' : '글자만 뽑아 보였습니다 — 슬라이드 모양은 아래 «▦ 슬라이드»로 봅니다.';
      body.appendChild(note); body.appendChild(wrap);
      var pg = pane.querySelector('.pg'); if (pg) { pg.innerHTML = '<span class="hint">' + r.parts.length + (kind === 'docx' ? '' : '장') + '</span>'; pg.onclick = null; }
    });
  }
  /* 파워포인트 — «▦ 슬라이드»(작게 늘어놓기 · 대표 「원본을 작게 해 가지고 진열 … 어떻게 강의했는지 비교」) / «≡ 글자»(글자만)를 바꿔 본다.
     고른 보기는 이 브라우저에 기억(pptView). 슬라이드는 격리 칸(pu-slides-frame.html)이 그린다 — 문서뷰어와 같은 격리(allow-same-origin 없음).
     ★ 바꿔 보려고 받은 바이트를 칸(pane)에 둔다 — 격리 칸에는 «사본»을 넘긴다(넘긴 바이트는 이쪽에서 다시 못 쓴다) */
  function showPptx(it, body, pane, buf, live) {
    /* PC 에서 고른 파일(올리지 않고 보기)도 같은 길 — 크기 한도는 문서 미리보기와 같다 */
    if (buf.byteLength > PuViewerKind.MAX_BYTES) { body.innerHTML = '<div class="msg">파일이 커서(' + esc(K.fmtBytes(buf.byteLength)) + ') 미리보기를 건너뜁니다 — 원본을 내려받아 여세요</div>'; return; }
    pane._ppt = buf;
    var mode = lsGet('pptView') === 'text' ? 'text' : 'slides';
    var pf = pane.querySelector('.pf');
    var tg = pf ? pf.querySelector('[data-act="pv"]') : null;
    if (pf && !tg) { tg = document.createElement('button'); tg.type = 'button'; tg.className = 'sm'; tg.setAttribute('data-act', 'pv'); pf.insertBefore(tg, pf.querySelector('.sp').nextSibling); }
    if (tg) { tg.textContent = mode === 'slides' ? '≡ 글자' : '▦ 슬라이드'; tg.title = mode === 'slides' ? '글자만 뽑아 보기' : '슬라이드를 작게 늘어놓아 보기'; }
    if (mode === 'text') return showTextParts(body, pane, buf, 'pptx', live).catch(function (e) { if (live()) body.innerHTML = '<div class="msg">글자를 뽑지 못했습니다 — ' + esc(errMsg(e)) + '</div>'; });
    body.innerHTML = '';
    var ifr = document.createElement('iframe');
    ifr.setAttribute('sandbox', 'allow-scripts');                 /* allow-same-origin 을 주지 않는다 — 문서뷰어와 같은 격리 */
    ifr.setAttribute('title', '슬라이드 미리보기');
    body.appendChild(ifr);
    var copy = buf.slice(0);
    FRAMES.push({ iframe: ifr, body: body, pg: pane.querySelector('.pg'), ready: false, queued: { msg: { t: 'open', buf: copy, name: it.fileName }, tr: [copy] }, pages: 0, cur: 1 });
    ifr.src = 'pu-slides-frame.html?v=1';
  }
  function togglePpt(it, body, pane) {
    if (!pane._ppt) return;
    lsSet('pptView', lsGet('pptView') === 'text' ? 'slides' : 'text');
    closeFrames(pane);
    var s = body._seq = (body._seq || 0) + 1;     /* 앞의 보기에서 늦게 온 결과는 버린다 */
    body.innerHTML = '<div class="msg">불러오는 중…</div>';     /* 앞 보기의 화면·쪽수를 먼저 비운다 */
    var pg = pane.querySelector('.pg'); if (pg) { pg.innerHTML = ''; pg.onclick = null; }
    showPptx(it, body, pane, pane._ppt, function () { return body._seq === s && pane.isConnected; });
  }
  function pickLocal(it, body, pane) {
    var inp = document.createElement('input'); inp.type = 'file';
    inp.onchange = function () {
      var f = inp.files && inp.files[0]; if (!f) return;
      if (f.name !== it.fileName || f.size !== (+it.size || 0)) toast('고른 파일이 목록의 원본과 이름·크기가 다릅니다 — 그래도 보여 드립니다', 6000);
      closeFrames(pane); fillPane(it, body, pane, f);
    };
    inp.click();
  }

  /* ───────── 나란히 보기 ───────── */
  var CMP_ONE_ROW = false;
  function openCompare(ids, title) {
    ids = ids.filter(function (id) { return ITEMS[id]; });
    if (!ids.length) return;
    if (ids.length > MAX_CMP) { toast('나란히 보기는 ' + MAX_CMP + '건까지입니다 — 앞의 ' + MAX_CMP + '건만 엽니다. 더 보려면 «새 창으로 각각»', 7000); ids = ids.slice(0, MAX_CMP); }
    var grid = $('cmpGrid'); closeFrames(grid); grid.innerHTML = '';
    $('cmpT').textContent = title || ('나란히 보기 — ' + ids.length + '건');
    $('cmpH').textContent = ids.length > 1 ? '칸마다 따로 넘겨 보며 비교하세요' : '';
    ids.forEach(function (id) {
      makePane(grid, ITEMS[id], { closable: ids.length > 1, onDetail: closeCompare, onClose: layoutCompare });
    });
    $('cmp').classList.add('on');
    layoutCompare();
  }
  function layoutCompare() {
    var grid = $('cmpGrid'), n = grid.children.length;
    if (!n) { closeCompare(); return; }
    var cols = CMP_ONE_ROW ? n : (n <= 2 ? n : 2);
    grid.style.gridTemplateColumns = 'repeat(' + cols + ',minmax(0,1fr))';
    grid.style.gridTemplateRows = 'repeat(' + Math.ceil(n / cols) + ',minmax(0,1fr))';
  }
  function closeCompare() {
    if (!$('cmp').classList.contains('on')) return;
    closeFrames($('cmpGrid')); $('cmpGrid').innerHTML = ''; $('cmp').classList.remove('on');
    if (VIEW_ID) { VIEW_ID = ''; try { history.replaceState(null, '', location.pathname); } catch (e) {} }
  }
  function openWin(id) {
    var w = null;
    try { w = window.open('pu-edulib.html?view=' + encodeURIComponent(id), '_blank'); } catch (e) {}
    return !!w;
  }

  /* ───────── 비슷한 강의 — 내용 지문 (대표 지시 2026-11-22 「기존 강의를 바꾼 게 있다 그러면 마지막에 언제 강의랑 유사하다 그런 표시」) ─────────
     지문은 슬라이드·문서 글로 만든 숫자(K.simSig) — edulib/sims/{자료 id}. 만드는 때: ① 자료함 원본을 미리보기로 열 때 ② 새로 올릴 때
     ③ 관리자가 한눈에의 «남은 지문 만들기»를 누를 때(원본을 차례로 받는다). 원본은 바꾸지 않는다. 글이 적으면 mh:'' 로 «비교 안 함». */
  var SIG_KINDS = { pptx: 'pptx', ppsx: 'pptx', docx: 'docx', hwpx: 'hwpx' };
  var SIG_BUSY = {};
  function ensureSig(id, ext, buf) {
    var kind = SIG_KINDS[String(ext || '').toLowerCase()];
    if (!kind || !id || !gate || !buf || SIG_BUSY[id]) return Promise.resolve(false);
    var cur = SIMS[id]; if (cur && cur.v === K.SIM_V) return Promise.resolve(false);
    if (buf.byteLength > PuViewerKind.MAX_BYTES) return Promise.resolve(false);
    SIG_BUSY[id] = true;
    var copy = buf.slice(0);                     /* 이 바이트는 곧 칸(iframe)으로 넘어갈 수 있다 — 사본으로 */
    return loadZip().then(function (Z) {
      /* 파일을 못 열면(암호·손상) «열지 못함»(mh:'' · why:'unreadable')을 남긴다 — 일괄 만들기가 같은 파일을 되풀이해 받지 않게 */
      return P.extract(Z, copy, kind).then(function (r) {
        var lines = [];
        r.parts.forEach(function (p) { lines = lines.concat(p.lines); });
        return { sig: K.simSig(lines), why: '' };
      }, function () { return { sig: { mh: '', n: 0 }, why: 'unreadable' }; });
    }).then(function (x) {
      return gate.save(simRef(id), K.makeSim(id, x.sig, ME.sid, Date.now(), x.why), { entityType: K.SIM_ENTITY }).then(function () { return true; });
    }).catch(function () { return false; }).then(function (x) { delete SIG_BUSY[id]; return x; });
  }
  /* 새로 올린 원본 — 받은 파일 그대로 지문(기다리지 않는다 · 실패해도 올리기는 그대로) */
  function sigLater(id, fileName, blob) {
    var ext = C.extOf(fileName || '');
    if (!SIG_KINDS[ext] || !blob || !blob.arrayBuffer || blob.size > PuViewerKind.MAX_BYTES) return;
    blob.arrayBuffer().then(function (b) { return ensureSig(id, ext, b); }).catch(function () {});
  }
  function simBest(id) { if (!SIMBEST) SIMBEST = K.lastSimilarAll(list(), SIMS); return SIMBEST[id] || null; }
  function simPct(sc) { return Math.round(sc * 100) + '%'; }
  function simWord(sc) { return sc >= 0.85 ? '거의 같음' : sc >= 0.65 ? '많이 비슷' : '비슷'; }
  /* 목록 줄의 ↺ — 제목 단추 안 맨 앞(칸을 새로 만들지 않는다). 마우스를 올리면 언제·어느 강의와 몇 % */
  function simBadge(id) {
    var b = simBest(id); if (!b) return '';
    var o = ITEMS[b.id];
    return '<span class="simb" title="' + esc('↺ ' + (b.date || '강의일 모름') + ' 「' + (o ? o.title : '') + '」와 ' + simPct(b.score) + ' 비슷 — 고쳐 쓴 강의로 보입니다') + '">↺</span>';
  }
  /* 자세히의 «비슷한 강의» 칸 */
  function drawSim() {
    var box = $('dSim'), it = ITEMS[DETAIL]; if (!box || !it) return;
    var ext = String(it.ext || C.extOf(it.fileName) || '').toLowerCase();
    var me = SIMS[it.id];
    var h = '<div class="sec" style="font-size:13px">비슷한 강의 <span class="hint">슬라이드·문서 글이 겹치는 정도</span></div>';
    if (!me) h += '<div class="hint">' + (SIG_KINDS[ext] ? (it.store === 'cloud' ? '아직 내용 지문이 없습니다 — 미리보기를 열면 만들어집니다' : '원본이 자료함에 올라오면 지문을 만듭니다') : '이 형식(' + esc(ext.toUpperCase() || '?') + ')은 아직 내용 비교를 못 합니다') + '</div>';
    else if (!K.okMh(me.mh)) h += '<div class="hint">' + (me.why === 'unreadable' ? '파일을 열지 못해 비교하지 않습니다(암호가 걸렸거나 손상된 파일)' : '글이 적어 비교하지 않습니다(그림 위주 자료)') + '</div>';
    else {
      var last = K.lastSimilar(it, list(), SIMS), all = K.similarOf(it.id, list(), SIMS).slice(0, 6);
      if (!all.length) h += '<div class="hint">비슷한 강의가 없습니다 — 새로 만든 강의로 보입니다</div>';
      else {
        var lo = last ? ITEMS[last.id] : null;
        if (lo) h += '<div class="simlast">↺ 마지막으로 비슷했던 강의 <b>' + esc(last.date || '강의일 모름') + '</b> 「' + esc(lo.title) + '」 — ' + simPct(last.score) + ' ' + simWord(last.score) + '</div>';
        else if (it.lectureDate) {
          /* 앞선 것이 없다 — 뒤에 고쳐 쓴 것만 있는지, 강의일을 모르거나 같은 날이라 앞뒤를 못 가리는지 갈라 말한다 */
          var later = all.some(function (x) { return x.date && x.date > it.lectureDate; });
          h += '<div class="hint">' + (later ? '이보다 앞선 비슷한 강의는 없습니다 — 아래는 뒤에 고쳐 쓴 강의입니다' : '강의일을 모르거나 같은 날 강의라 앞뒤를 가리지 못했습니다') + '</div>';
        }
        h += all.map(function (x) {
          var o = ITEMS[x.id]; if (!o) return '';
          return '<div class="simr' + (last && last.id === x.id ? ' on' : '') + '"><span class="sd">' + esc(x.date || '강의일 모름') + '</span>' +
            '<button type="button" class="ttl" data-simopen="' + esc(x.id) + '" title="' + esc(o.title + ' — 자세히') + '">' + esc(o.title) + '</button>' +
            '<span class="sp2">' + simPct(x.score) + '</span><button type="button" class="sm" data-simcmp="' + esc(x.id) + '" title="두 자료를 나란히 보기">⧉</button></div>';
        }).join('');
      }
    }
    box.innerHTML = h;
  }
  /* 관리자 — 지문이 없는 자료함 원본을 차례로 받아 지문을 만든다(멈출 수 있다) */
  function simTargets() {
    return K.live(list()).filter(function (it) {
      var ext = String(it.ext || C.extOf(it.fileName) || '').toLowerCase();
      return it.store === 'cloud' && it.storagePath && SIG_KINDS[ext] && (+it.size || 0) <= PuViewerKind.MAX_BYTES;
    });
  }
  function simDone(it) { var x = SIMS[it.id]; return !!(x && x.v === K.SIM_V); }
  var SIM_FAILED = {};                          /* 이 화면에서 받기에 실패한 자료 — 다시 누르면 건너뛴다(새로고침하면 다시 해 본다) */
  function drawSimCard() {
    var card = $('simCard'); if (!card) return;
    if (!ME.admin) { card.style.display = 'none'; return; }
    var all = simTargets(), done = all.filter(simDone).length, left = all.length - done;
    if (!SIMBEST) SIMBEST = K.lastSimilarAll(list(), SIMS);
    var linked = Object.keys(SIMBEST).length;
    card.style.display = '';
    card.innerHTML = '<div class="bar"><div class="sec" style="margin:0">비슷한 강의 찾기</div><span class="hint">관리자 · 슬라이드·문서 글로 «내용 지문»을 만들어 고쳐 쓴 강의를 이어 줍니다 — 원본은 바꾸지 않습니다</span></div>' +
      '<div class="simrun"><span>지문 ' + done + ' / ' + all.length + '건' + (linked ? ' · 예전 강의와 이어진 자료 ' + linked + '건' : '') + '</span>' +
      (SIMRUN ? '<span class="hint">' + esc(SIMRUN.msg || '') + '</span><button type="button" class="sm" data-simrun>■ 멈추기</button>'
        : (left ? '<button type="button" class="sm pri" data-simrun title="자료함 원본을 차례로 받아 지문을 만듭니다">▶ 남은 ' + left + '건 지문 만들기</button>'
          : '<span class="hint">모두 만들었습니다 — 새로 넣는 자료는 저절로 만들어집니다</span>')) + '</div>';
  }
  function runSimBatch() {
    if (SIMRUN) { SIMRUN.stop = true; SIMRUN.msg = '멈추는 중…'; stopFetches(SIMRUN.owner); drawSimCard(); return; }   /* 받던 것도 끊는다 */
    var todo = simTargets().filter(function (it) { return !simDone(it) && !SIM_FAILED[it.id]; });
    if (!todo.length) return;
    var bytes = todo.reduce(function (a, it) { return a + (+it.size || 0); }, 0);
    if (!window.confirm(todo.length + '건의 원본을 차례로 받아 내용 지문을 만들까요?\n받는 양 약 ' + K.fmtBytes(bytes) + ' · 원본은 바꾸지 않습니다 · 언제든 멈출 수 있습니다')) return;
    SIMRUN = { stop: false, ok: 0, bad: 0, msg: '', owner: document.createElement('span') };   /* owner — 멈추기가 받던 요청을 끊는 표(stopFetches) */
    var i = 0;
    todo.reduce(function (p, it) {
      return p.then(function () {
        if (!SIMRUN || SIMRUN.stop || !ME.admin) return;
        i++; SIMRUN.msg = i + ' / ' + todo.length + ' — ' + (it.title || it.fileName); drawSimCard();
        return fetchOriginal(it, 'buf', null, SIMRUN.owner).then(function (b) { return ensureSig(it.id, it.ext || C.extOf(it.fileName), b); })
          .then(function (ok) { if (!SIMRUN) return; if (ok) SIMRUN.ok++; else { SIMRUN.bad++; SIM_FAILED[it.id] = true; } },
            function () { if (!SIMRUN) return; if (!SIMRUN.stop) { SIMRUN.bad++; SIM_FAILED[it.id] = true; } });
      });
    }, Promise.resolve()).then(function () {
      var r = SIMRUN || { ok: 0, bad: 0 };
      SIMRUN = null;
      toast('지문 ' + r.ok + '건 만들었습니다' + (r.bad ? ' · 못 한 것 ' + r.bad + '건' : ''), 7000);
      drawSimCard();
    });
  }

  /* ───────── 자세히·검토 ───────── */
  var DETAIL = '';
  function openDetail(id) {
    var it = ITEMS[id]; if (!it) return;
    closeFrames($('mbox'));                      /* 앞의 자세히 칸이 받던 것·blob 주소를 먼저 정리 */
    DETAIL = id;
    var catOpts = C.CATS.map(function (c) { return '<option value="' + esc(c.key) + '"' + (c.key === it.cat ? ' selected' : '') + '>' + esc(c.label) + (c.legal ? ' (법정)' : '') + '</option>'; }).join('') +
      (C.CATS.some(function (c) { return c.key === it.cat; }) ? '' : '<option value="' + esc(it.cat) + '" selected>' + esc(it.cat) + ' (종류 목록에 없음)</option>');
    var stOpts = Object.keys(K.STATUS).map(function (k) { return '<option value="' + esc(k) + '"' + (k === it.status ? ' selected' : '') + '>' + esc(K.STATUS[k]) + '</option>'; }).join('');
    var src = it.source || {};
    $('mbox').innerHTML = '<div class="mhead"><h3 title="' + esc(it.title) + '">' + esc(it.title) + '</h3>' + statusTags(it) + '<span class="sp"></span><button class="sm" id="dX">닫기</button></div>' +
      '<div class="mbody"><div class="mview" id="dView"></div><div>' +
      '<div class="form">' +
      '<label for="dTitle">제목</label><input type="text" id="dTitle" value="' + esc(it.title) + '">' +
      '<label for="dCat">강의 종류</label><select id="dCat">' + catOpts + '</select>' +
      '<label for="dDate">강의일</label><input type="text" id="dDate" value="' + esc(it.lectureDate) + '" placeholder="2026-11-19 · 2026-11 · 2026">' +
      '<label for="dVenue">강의처</label><input type="text" id="dVenue" value="' + esc(it.venue) + '" placeholder="강의한 곳(업체·기관)">' +
      '<label for="dStatus">상태</label><select id="dStatus">' + stOpts + '</select>' +
      '<label for="dPii">개인정보</label><label class="hint" style="white-space:normal"><input type="checkbox" id="dPii"' + (it.pii ? ' checked' : '') + '> 사람 이름·서명·연락처가 들어 있음</label>' +
      '<label for="dNote">메모</label><input type="text" id="dNote" value="' + esc(it.note) + '">' +
      '</div>' +
      (it.lectureDate && it.dateFrom && it.dateFrom !== 'manual' ? '<p class="hint" style="margin:6px 0 0">강의일은 ' + esc(estWhy(it.dateFrom)) + '입니다 — 맞으면 그대로, 다르면 고쳐 저장하세요(고치면 «확정»).</p>' : '') +
      '<div style="margin-top:10px">' +
      kv('원본 파일', it.fileName) + kv('크기·형식', K.fmtBytes(it.size) + ' · ' + (it.ext || '').toUpperCase()) +
      kv('원본 위치', K.STORE[it.store] || it.store) +
      (src.path ? kv('원래 자리', src.path) : '') + (src.mailSubject ? kv('메일', src.mailSubject + (src.mailDate ? ' (' + src.mailDate + ')' : '')) : '') +
      (src.mtime ? kv('파일 수정일', src.mtime + ' (강의일 아님)') : '') +
      kv('넣은 사람', nameOf(it.createdBy) + ' · ' + fmtTime(it.createdAt)) + kv('고친 때', fmtTime(it.updatedAt)) +
      (it.sha256 ? kv('지문', it.sha256.slice(0, 16) + '…') : '') +
      '</div>' +
      (it.summary ? '<div class="sumx"><div class="sec" style="font-size:13px">자동 정리 내용 <span class="hint">문서의 목차·첫 글을 그대로 옮긴 것</span></div><p>' + esc(it.summary) + '</p></div>' : '') +
      '<div class="simsec" id="dSim"></div>' +
      '<div class="notes"><div class="sec" style="font-size:13px">검토 메모</div><div id="dNotes" class="hint">불러오는 중…</div>' +
      '<textarea id="dNoteNew" rows="2" placeholder="이 자료를 본 의견 — 예) 2026 개정 반영 필요 · 3쪽 사례 좋음"></textarea>' +
      '<div class="bar" style="margin-top:4px"><span class="sp"></span><button class="sm" id="dNoteAdd">메모 남기기</button></div></div>' +
      '</div></div>' +
      '<div class="mfoot">' +
      /* 휴지통에 있는 자료 — 고치기·휴지통 대신 «되살리기»만(원본 내려받기는 그대로) */
      (it._deleted ? '<span class="tag old">' + esc(ymd(it.deletedAt)) + ' ' + esc(nameOf(it.deletedBy)) + ' 지움</span>' +
        (it.store === 'cloud' ? '<button id="dDl">⬇ 원본 내려받기</button>' : '') + '<span class="sp"></span><button id="dCancel">닫기</button><button class="pri" id="dRestore">↩ 되살리기</button></div>'
      : (it.store !== 'cloud' ? '<button id="dUp" title="이 PC 의 원본 파일을 골라 자료함에 올립니다(바꾸지 않고 그대로)">📤 원본 올리기</button>' : '<button id="dDl">⬇ 원본 내려받기</button>') +
        '<button id="dWin">🪟 새 창으로</button><button class="dng" id="dDel">🗑 휴지통으로</button><span class="sp"></span>' +
        '<button id="dCancel">닫기</button><button class="pri" id="dSave">저장</button></div>');
    openModal('자세히·검토 — ' + it.title, it._deleted ? 'dX' : 'dTitle');
    makePane($('dView'), it, { inDetail: true });
    loadNotes(id);
    drawSim();
  }
  /* 같은 창(#modal)을 여러 일에 쓴다 — 열 때마다 대화상자 이름을 그 일로 바꾸고 첫 칸에 초점을 준다 */
  function openModal(label, focusId) {
    $('modal').setAttribute('aria-label', label);
    $('modal').style.display = 'flex';
    setTimeout(function () { var el = focusId && $(focusId); try { if (el) el.focus(); } catch (e) {} }, 30);
  }
  function kv(k, v) { return '<div class="kv"><span>' + esc(k) + '</span><b title="' + esc(v) + '">' + esc(v) + '</b></div>'; }
  function closeDetail() {
    if ($('modal').style.display === 'none') return;
    closeFrames($('mbox')); $('modal').style.display = 'none'; $('mbox').innerHTML = ''; DETAIL = '';
  }
  function saveDetail() {
    var it = ITEMS[DETAIL]; if (!it) return;
    var date = $('dDate').value.trim();
    if (!K.okDate(date)) { toast('강의일은 2026-11-19 · 2026-11 · 2026 꼴로 적어 주세요'); return; }
    var ch = { title: $('dTitle').value, cat: $('dCat').value, lectureDate: date, venue: $('dVenue').value,
      status: $('dStatus').value, pii: $('dPii').checked, note: $('dNote').value };
    if (date !== (it.lectureDate || '')) ch.dateFrom = date ? 'manual' : '';
    savePatch(DETAIL, ch).then(function (did) { toast(did ? '저장했습니다' : '바뀐 것이 없습니다'); closeDetail(); })
      .catch(function (e) { toast('저장하지 못했습니다 — ' + errMsg(e), 7000); });
  }
  function noteRef(itemId, id) { return fbDb.ref('edulib/notes/' + itemId + (id ? '/' + id : '')); }
  function loadNotes(itemId) {
    noteRef(itemId).once('value').then(function (s) {
      if (DETAIL !== itemId) return;
      var v = s.val() || {};
      var arr = Object.keys(v).map(function (k) { return v[k]; }).filter(function (n) { return n && !n._deleted; })
        .sort(function (a, b) { return (a.createdAt || 0) - (b.createdAt || 0); });
      var box = $('dNotes'); box.className = '';
      box.innerHTML = arr.length ? arr.map(function (n) {
        return '<div class="note"><div class="w">' + esc(nameOf(n.createdBy)) + ' · ' + esc(fmtTime(n.createdAt)) + '</div><p>' + esc(n.text) + '</p></div>';
      }).join('') : '<div class="hint">아직 메모가 없습니다.</div>';
    }).catch(function () { var b = $('dNotes'); if (b) b.textContent = '메모를 읽지 못했습니다.'; });
  }
  function addNote() {
    var t = $('dNoteNew').value.trim(); if (!t) return;
    var itemId = DETAIL, id = K.newId();
    var rec = { id: id, entityType: K.NOTE_ENTITY, schemaVersion: K.SCHEMA, sourceKind: K.ENTITY, sourceId: itemId,
      text: t.slice(0, 2000), createdAt: Date.now(), updatedAt: Date.now(), revision: 1 };
    gate.save(noteRef(itemId, id), rec, { entityType: K.NOTE_ENTITY, expectedRevision: -1 }).then(function () {
      $('dNoteNew').value = ''; loadNotes(itemId); toast('메모를 남겼습니다');
    }).catch(function (e) { toast('메모를 남기지 못했습니다 — ' + errMsg(e), 7000); });
  }

  /* ───────── 원본 올리기 ───────── */
  function sha256(file) {
    if (!window.crypto || !crypto.subtle || file.size > MAX_HASH) return Promise.resolve('');
    return file.arrayBuffer().then(function (b) { return crypto.subtle.digest('SHA-256', b); }).then(function (h) {
      return Array.prototype.map.call(new Uint8Array(h), function (x) { return (x < 16 ? '0' : '') + x.toString(16); }).join('');
    }).catch(function () { return ''; });
  }
  function contentDisposition(name) { return "attachment; filename*=UTF-8''" + encodeURIComponent(name); }
  function uploadBlob(id, blob, fileName, onPct) {
    var path = K.storagePathOf(id, fileName);
    var meta = { contentType: blob.type || 'application/octet-stream', contentDisposition: contentDisposition(fileName), customMetadata: { originalName: fileName.slice(0, 500) } };
    return new Promise(function (res, rej) {
      var task = bucket.ref(path).put(blob, meta);
      task.on('state_changed', function (s) { if (onPct && s.totalBytes) onPct(s.bytesTransferred / s.totalBytes); }, function (err) {
        /* 창고 규칙은 «새로 쓰기만»이다 — 지난번에 원본은 올라가고 기록 저장만 실패했다면 같은 자리에 다시 못 쓴다.
           그 자리에 «같은 크기»의 파일이 이미 있으면 그것을 이어 쓴다(덮어쓰지 않는다). 다르면 원래 오류를 낸다. */
        bucket.ref(path).getMetadata().then(function (m) {
          if (m && +m.size === blob.size) res(path); else rej(err);
        }, function () { rej(err); });
      }, function () { res(path); });
    });
  }
  /* PC 에만 있던 기록에 원본을 붙인다 — 같은 파일인지(이름·크기) 먼저 본다 */
  function attachOriginal(id, file, onPct) {
    var it = ITEMS[id]; if (!it) return Promise.reject(new Error('자료를 찾지 못했습니다'));
    if (file.size >= MAX_UPLOAD) return Promise.reject(new Error('1GB 가 넘어 올리지 않습니다'));
    return sha256(file).then(function (h) {
      /* 같은 파일 찾기는 넣기·메일과 «같은 범위»(지운 것 뺀 전체)에서 한다 — 자기 자신은 뺀다 */
      if (h) { var same = K.findSame(list().filter(function (x) { return x.id !== id; }), { sha256: h }); if (same && same.how === 'sha256') throw new Error('같은 파일이 이미 자료함에 있습니다: ' + same.items[0].title); }
      return uploadBlob(id, file, it.fileName || file.name, onPct).then(function (path) {
        return saveRaw(id, function (prev) {
          if (!prev) return prev;
          prev.store = 'cloud'; prev.storagePath = path; if (h) prev.sha256 = h;
          if (!prev.size) prev.size = file.size;
          return prev;
        }).then(function (x) { sigLater(id, it.fileName || file.name, file); return x; });
      });
    });
  }
  function detailUpload() {
    var it = ITEMS[DETAIL]; if (!it) return;
    var inp = document.createElement('input'); inp.type = 'file';
    inp.onchange = function () {
      var f = inp.files && inp.files[0]; if (!f) return;
      if ((f.name !== it.fileName || f.size !== (+it.size || 0)) &&
          !window.confirm('고른 파일(' + f.name + ', ' + K.fmtBytes(f.size) + ')이 목록의 원본(' + it.fileName + ', ' + K.fmtBytes(it.size) + ')과 다릅니다. 그래도 이 자료의 원본으로 올릴까요?')) return;
      toast('올리는 중… 0%', 60000);
      attachOriginal(DETAIL, f, function (p) { toast('올리는 중… ' + Math.round(p * 100) + '%', 60000); })
        .then(function () { toast('원본을 올렸습니다(바꾸지 않고 그대로)'); closeDetail(); })
        .catch(function (e) { toast('올리지 못했습니다 — ' + errMsg(e), 8000); });
    };
    inp.click();
  }

  /* ───────── 넣기(저장 전 줄) ───────── */
  function stageFiles(files, fromFolder) {
    var arr = [].slice.call(files || []);
    var added = 0, skipped = 0;
    arr.forEach(function (f) {
      var rel = f.webkitRelativePath || f._rel || f.name;          /* _rel — 끌어놓은 폴더에서 경로를 못 붙였을 때의 대신 자리(readDrop) */
      if (/^~\$/.test(f.name) || /^\./.test(f.name)) { skipped++; return; }
      var r = C.classifyPath(rel);
      var g = r.tier ? r : C.guessPath(rel);                       /* 강의 폴더 밖이라도 같은 규칙(깊은 폴더 → 이름)으로 종류·강의일 짐작 */
      var cat = r.tier ? r.cat : g.cat;
      if (ADD_CAT && cat === 'etc' && C.catByKey(ADD_CAT).key === ADD_CAT) cat = ADD_CAT;
      var date = r.tier ? r.date : g.date;
      var row = { key: 'f' + Math.random().toString(36).slice(2), src: 'file', file: f, fileName: f.name, size: f.size, rel: rel,
        title: f.name.replace(/\.[^.]+$/, ''), cat: cat, lectureDate: date || '', dateFrom: date ? (g.dateFrom || 'name') : '',
        venue: '', pii: r.pii, tier: r.tier, why: r.tier ? '' : r.why, pick: true, note: '', state: '' };
      if (fromFolder && !r.tier) row.pick = false;
      if (r.pii) row.pick = false;
      matchStage(row);
      STAGE.push(row); added++;
    });
    toast(added + '건을 넣을 줄에 올렸습니다' + (skipped ? ' · 임시파일 ' + skipped + '건 건너뜀' : '') + ' — 확인하고 «고른 것 저장»');
    drawStage();
  }
  function matchStage(row) {
    var same = K.findSame(list(), { fileName: row.fileName, size: row.size });
    row.match = null;
    if (same) {
      var pc = same.items.filter(function (x) { return x.store !== 'cloud'; })[0];
      if (pc && row.src === 'file') { row.match = pc.id; row.note = 'PC 목록에 있음 → 원본만 붙임'; }
      else { row.dup = true; row.pick = false; row.note = '이미 있음: ' + same.items[0].title; }
    }
    if (row.src === 'file' && row.size >= MAX_UPLOAD) { row.note = (row.note ? row.note + ' · ' : '') + '1GB 넘음 — 목록만(원본 PC)'; }
  }
  function stagePcList(json) {
    var items = json && json.kind === 'edulib-pc-list' && Array.isArray(json.items) ? json.items : null;
    if (!items) { toast('PC 목록 파일이 아닙니다 — scripts/edulib-scan.js 가 만든 JSON 을 고르세요', 7000); return; }
    var n = 0;
    items.forEach(function (x) {
      if (!x || !x.fileName) return;
      var row = { key: 'p' + Math.random().toString(36).slice(2), src: 'pclist', fileName: String(x.fileName), size: +x.size || 0,
        rel: String(x.path || ''), title: String(x.fileName).replace(/\.[^.]+$/, ''), cat: C.catByKey(x.cat).key,
        lectureDate: K.okDate(x.lectureDate) ? String(x.lectureDate || '') : '', dateFrom: String(x.dateFrom || ''),
        venue: '', pii: !!x.pii, tier: x.tier || '', mtime: String(x.mtime || ''), copies: Array.isArray(x.copies) ? x.copies.length : 0,
        pick: x.tier === 'A' && !x.pii, note: '', state: '' };
      if (row.copies) row.note = '같은 파일 ' + (row.copies + 1) + '곳';
      matchStage(row);
      STAGE.push(row); n++;
    });
    toast('PC 목록 ' + n + '건을 올렸습니다 — 강의 폴더 안(A)·개인정보 아닌 것만 미리 골랐습니다', 7000);
    drawStage();
  }
  function stagePickedN() { return STAGE.filter(function (r) { return r.pick && !r.state; }).length; }
  function drawStage() {
    var card = $('stageCard');
    card.style.display = STAGE.length ? '' : 'none';
    if (!STAGE.length) return;
    var nPick = stagePickedN(), nFile = STAGE.filter(function (r) { return r.pick && r.src === 'file' && !r.state; }).length;
    $('stageTitle').textContent = '넣을 자료 ' + STAGE.length + '건';
    $('stageHint').textContent = nPick + '건 고름' + (nFile ? ' · 원본 올리기 ' + nFile + '건' : '') + ' · 종류·강의일은 이름·폴더로 짐작한 값입니다(고칠 수 있습니다)';
    $('stSave').textContent = '고른 ' + nPick + '건 저장';
    var catOpts = function (v) { return C.CATS.map(function (c) { return '<option value="' + esc(c.key) + '"' + (c.key === v ? ' selected' : '') + '>' + esc(c.label) + '</option>'; }).join(''); };
    var show = STAGE.slice(0, 600);
    /* 머리줄 ☐ 는 «보이는(아직 저장 안 한) 줄이 다 골라졌을 때만» 켜진다 — 다시 그려도 상태를 잃지 않고, 한 줄을 풀면 함께 풀린다 */
    var open = show.filter(function (r) { return !r.state; });
    var allOn = open.length > 0 && open.every(function (r) { return r.pick; }) ? ' checked' : '';
    var h = '<label class="phone-only hint" style="margin:2px 0 6px"><input type="checkbox" id="stAllP"' + allOn + '> 보이는 줄 모두 고르기</label>' +
      '<table class="lst stg"><thead><tr><th class="ck"><input type="checkbox" id="stAll"' + allOn + ' title="보이는 줄 모두 고르기" aria-label="보이는 줄 모두 고르기"></th><th class="no">№</th>' +
      '<th class="tt">파일</th><th class="ct">종류</th><th class="dt">강의일</th><th class="vn">강의처</th><th class="fm">크기</th><th class="st">알림</th></tr></thead><tbody>';
    show.forEach(function (r, i) {
      h += '<tr data-sk="' + esc(r.key) + '"' + (r.pick ? ' class="picked"' : '') + '>' +
        '<td class="ck"><input type="checkbox" aria-label="' + esc(r.fileName) + ' 고르기" data-spick="' + esc(r.key) + '"' + (r.pick ? ' checked' : '') + (r.state === 'done' ? ' disabled' : '') + '></td>' +
        '<td class="no">' + (i + 1) + '</td>' +
        '<td class="tt" title="' + esc(r.rel) + '"><span class="one"><span>' + esc(r.fileName) + '</span>' + (r.tier ? '<span class="tag est" title="A: 강의 폴더 안 · B: 이름만 강의">' + esc(r.tier) + '</span>' : '') + '</span></td>' +
        '<td class="ct"><select aria-label="' + esc(r.fileName) + ' 종류" data-scat="' + esc(r.key) + '">' + catOpts(r.cat) + '</select></td>' +
        '<td class="dt"><input type="text" aria-label="' + esc(r.fileName) + ' 강의일" data-sdate="' + esc(r.key) + '" value="' + esc(r.lectureDate) + '" placeholder="모름"></td>' +
        '<td class="vn"><input type="text" aria-label="' + esc(r.fileName) + ' 강의처" data-svenue="' + esc(r.key) + '" value="' + esc(r.venue) + '" placeholder="강의처"></td>' +
        '<td class="fm">' + esc(K.fmtBytes(r.size)) + '</td>' +
        '<td class="st" title="' + esc([r.note, r.why, r.err].filter(Boolean).join(' · ')) + '"><span class="one">' +
          (r.state === 'done' ? '<span class="tag ok">저장함</span>' : r.state === 'err' ? '<span class="tag pii">못 함</span>' : '') +
          (r.pii ? '<span class="tag pii">개인정보?</span>' : '') + (r.dup ? '<span class="tag old">이미 있음</span>' : '') +
          (r.match ? '<span class="tag cloud">원본 붙임</span>' : '') + '<span>' + esc(r.err || r.note || r.why || (r.src === 'pclist' ? 'PC 목록' : '')) + '</span></span></td>' +
        '<td class="meta">' + esc([catLabel(r.cat), r.lectureDate || '강의일 모름', K.fmtBytes(r.size), r.err || r.note || ''].filter(Boolean).join(' · ')) + '</td>' +
        '</tr>';
    });
    h += '</tbody></table>';
    if (STAGE.length > show.length) h += '<div class="hint" style="margin-top:6px">앞 ' + show.length + '줄만 보입니다 — 저장하면 다음 줄이 올라옵니다(고른 표시는 그대로).</div>';
    $('stage').innerHTML = h;
  }
  function stageRow(key) { for (var i = 0; i < STAGE.length; i++) if (STAGE[i].key === key) return STAGE[i]; return null; }
  function saveStage() {
    var rows = STAGE.filter(function (r) { return r.pick && !r.state; });
    if (!rows.length) { toast('고른 줄이 없습니다'); return; }
    var bad = rows.filter(function (r) { return !K.okDate(r.lectureDate); });
    if (bad.length) { toast('강의일 모양이 틀린 줄이 ' + bad.length + '건 있습니다(2026-11-19 · 2026-11 · 2026)', 7000); return; }
    var up = rows.filter(function (r) { return r.src === 'file' && r.size < MAX_UPLOAD; }).length;
    if (!window.confirm(rows.length + '건을 저장할까요?\n· 원본 올리기 ' + up + '건(바꾸지 않고 그대로)\n· 목록만 ' + (rows.length - up) + '건(원본은 PC 에)')) return;
    var done = 0, fail = 0, total = rows.length;
    var bar = $('stProg'); bar.style.display = ''; var fill = bar.firstElementChild;
    $('stSave').disabled = true;
    function step(r, pct) { fill.style.width = Math.round(((done + fail + (pct || 0)) / total) * 100) + '%'; }
    function one(r) {
      return saveStageRow(r, function (x) { step(r, x); }).then(function () { r.state = 'done'; r.pick = false; done++; step(r); },
        function (e) { r.state = 'err'; r.err = errMsg(e); fail++; step(r); });
    }
    /* 목록만 저장하는 줄은 8건씩 함께(한 건마다 관문 트랜잭션), 원본을 올리는 줄은 하나씩 차례로 — 큰 파일이 겹치지 않게 */
    var meta = rows.filter(function (r) { return !(r.src === 'file' && r.size < MAX_UPLOAD); });
    var ups = rows.filter(function (r) { return r.src === 'file' && r.size < MAX_UPLOAD; });
    function pool(list, n) {
      var i = 0;
      function worker() { if (i >= list.length) return Promise.resolve(); var r = list[i++]; return one(r).then(worker); }
      var ws = []; for (var k = 0; k < Math.min(n, list.length); k++) ws.push(worker());
      return Promise.all(ws);
    }
    return pool(meta, 8).then(function () { return pool(ups, 1); }).then(function () {
      $('stSave').disabled = false; bar.style.display = 'none';
      STAGE = STAGE.filter(function (r) { return r.state !== 'done'; });
      toast('저장 ' + done + '건' + (fail ? ' · 못 한 것 ' + fail + '건(줄의 «알림» 칸)' : ''), 8000);
      drawStage();
    });
  }
  function saveStageRow(r, onPct) {
    if (r.match && r.src === 'file') return attachOriginal(r.match, r.file, onPct);
    /* 기록 id 는 줄마다 «한 번만» 정한다 — 원본은 올라가고 기록 저장만 실패해 다시 누르면 같은 창고 자리를 이어 쓴다(새 사본을 또 올리지 않는다) */
    if (!r.itemId) r.itemId = K.newId();
    var it = K.makeItem({ id: r.itemId, fileName: r.fileName, size: r.size, cat: r.cat, lectureDate: r.lectureDate,
      dateFrom: r.lectureDate ? (r.dateFrom || 'name') : '', venue: r.venue, title: r.title, pii: r.pii, status: 'review', store: 'pc',
      source: { kind: r.src === 'pclist' ? 'pc' : 'upload', path: r.rel, mtime: r.mtime || (r.file && r.file.lastModified ? ymd(r.file.lastModified) : '') } },
      { uid: ME.sid });
    if (r.src !== 'file' || r.size >= MAX_UPLOAD) return saveNew(it);
    return sha256(r.file).then(function (h) {
      if (h) {
        var same = K.findSame(list(), { sha256: h, fileName: r.fileName, size: r.size });
        if (same && same.how === 'sha256') throw new Error('같은 파일이 이미 있습니다: ' + same.items[0].title);
        it.sha256 = h;
      }
      return uploadBlob(it.id, r.file, r.fileName, onPct);
    }).then(function (path) {
      it.store = 'cloud'; it.storagePath = path;
      return saveNew(it).then(function (x) { sigLater(it.id, r.fileName, r.file); return x; });
    });
  }

  /* ───────── 메일에서 찾기(관리자) ───────── */
  function scanMail() {
    if (!ME.admin) return;
    $('mScan').disabled = true; $('mScan').textContent = '훑는 중…';
    MAIL = []; MPICK = {};
    var seen = {};
    list().forEach(function (it) { if (it.source && it.source.mailId) seen[it.source.mailId + '|' + it.fileName] = 1; });
    fbDb.ref('mailbox/folders').once('value').then(function (s) {
      var fd = s.val() || {};
      var slugs = Object.keys(fd).filter(function (k) { var f = fd[k] || {}; return !/spam|junk/i.test(String(f.kind || '')) && !/스팸|정크/.test(String(f.name || '')); });
      return Promise.all(slugs.map(function (slug) {
        return fbDb.ref('mailbox/msgs/' + slug).once('value').then(function (ms) {
          var v = ms.val() || {};
          Object.keys(v).forEach(function (u) { addMailRows(v[u], slug, (fd[slug] || {}).name || slug, u, seen); });
        }).catch(function () {});
      })).then(function () {
        return fbDb.ref('mailbox/old/msgs').once('value').then(function (os) {
          var v = os.val() || {};
          Object.keys(v).forEach(function (k) { addMailRows(v[k], '*old', '지난 메일', k, seen); });
        }).catch(function () {});
      });
    }).then(function () {
      MAIL.sort(function (a, b) { return (b.d || 0) - (a.d || 0); });
      $('mCard').style.display = '';
      drawMail();
      toast('강의자료로 보이는 첨부 ' + MAIL.length + '건을 찾았습니다', 6000);
    }).catch(function (e) { toast('메일함을 읽지 못했습니다 — ' + errMsg(e), 8000); })
      .then(function () { $('mScan').disabled = false; $('mScan').textContent = '🔎 다시 훑기'; });
  }
  function addMailRows(m, slug, folderName, key, seen) {
    if (!m || typeof m !== 'object') return;
    var subj = String(m.s || ''), when = +m.d || 0, mailId = slug + '/' + key;
    var names = Array.isArray(m.an) ? m.an : [];
    var base = { slug: slug, uid: String(m.u || key), key: key, mailId: mailId, folder: folderName, s: subj, d: when,
      who: String(m.f || m.tn || m.e || ''), old: slug === '*old' };
    if (names.length) {
      names.forEach(function (nm, i) {
        var c = C.classifyMail(subj, nm, ymd(when));
        if (!c) return;
        MAIL.push(Object.assign({}, base, { id: mailId + '#' + i, att: String(nm), idx: i, cat: c.cat, date: c.date, pii: c.pii, have: !!seen[mailId + '|' + nm] }));
      });
    } else if ((+m.a > 0 || base.old) && C.classifyMail(subj, '', ymd(when))) {
      var c2 = C.classifyMail(subj, '', ymd(when));
      MAIL.push(Object.assign({}, base, { id: mailId + '#?', att: '', idx: -1, cat: c2.cat, date: c2.date, pii: false, have: false }));
    }
  }
  function mailShown() {
    var q = MQ.trim().toLowerCase();
    return MAIL.filter(function (r) { return !q || (r.s + ' ' + r.att + ' ' + r.who + ' ' + r.folder).toLowerCase().indexOf(q) >= 0; });
  }
  function drawMail() {
    if (!MAIL.length) { $('mList').innerHTML = $('mCard').style.display === 'none' ? '' : '<div class="empty">찾은 것이 없습니다.</div>'; return; }
    var rows = mailShown().slice(0, 800);
    var nPick = Object.keys(MPICK).filter(function (k) { return MPICK[k]; }).length;
    $('mN').textContent = '찾은 첨부 ' + MAIL.length + '건 · ' + nPick + '건 고름';
    $('mImp').textContent = '고른 ' + nPick + '건 가져오기';
    var shown = mailShown();
    /* 머리줄 ☐ — 고를 수 있는 줄(이미 가져온 것·개인정보? 뺀 것)이 다 골라졌을 때만 켜진다 */
    var can = rows.filter(function (r) { return !r.have && !r.pii; });
    var mOn = can.length > 0 && can.every(function (r) { return !!MPICK[r.id]; }) ? ' checked' : '';
    var h = (shown.length > rows.length ? '<div class="hint" style="margin-bottom:6px">앞 ' + rows.length + '건만 보입니다(모두 ' + shown.length + '건) — 위 «찾기»로 좁혀 주세요.</div>' : '') +
      '<label class="phone-only hint" style="margin:2px 0 6px"><input type="checkbox" id="mAllP"' + mOn + '> 보이는 줄 모두 고르기(개인정보? 빼고)</label>' +
      '<table class="lst ml"><thead><tr><th class="ck"><input type="checkbox" id="mAll"' + mOn + ' title="보이는 줄 모두 고르기(개인정보? 빼고)" aria-label="보이는 줄 모두 고르기"></th><th class="no">№</th>' +
      '<th class="dt">메일 날짜</th><th class="tt">제목</th><th class="att">첨부</th><th class="ct">추정 종류</th><th class="who">보낸이·받는이</th><th class="st">알림</th></tr></thead><tbody>';
    rows.forEach(function (r, i) {
      var on = !!MPICK[r.id];
      h += '<tr' + (on ? ' class="picked"' : '') + '><td class="ck"><input type="checkbox" aria-label="' + esc(r.att || r.s) + ' 고르기" data-mpick="' + esc(r.id) + '"' + (on ? ' checked' : '') + (r.have ? ' disabled' : '') + '></td>' +
        '<td class="no">' + (i + 1) + '</td><td class="dt">' + esc(ymd(r.d)) + '</td>' +
        '<td class="tt" title="' + esc(r.s) + '">' + esc(r.s) + '</td>' +
        '<td class="att" title="' + esc(r.att || '첨부 이름 모름 — 가져올 때 확인') + '">' + esc(r.att || '(가져올 때 확인)') + '</td>' +
        '<td class="ct">' + esc(catLabel(r.cat)) + '</td>' +
        '<td class="who" title="' + esc(r.who) + '">' + esc(r.who) + '</td>' +
        '<td class="st"><span class="one">' + (r.have ? '<span class="tag ok">이미 가져옴</span>' : '') + (r.pii ? '<span class="tag pii">개인정보?</span>' : '') +
          (r.state === 'done' ? '<span class="tag ok">가져옴</span>' : r.state === 'err' ? '<span class="tag pii" title="' + esc(r.err) + '">못 함</span>' : '') +
          '<span>' + esc(r.folder) + '</span></span></td>' +
        '<td class="meta">' + esc([ymd(r.d), r.att || '첨부 확인', catLabel(r.cat)].join(' · ')) + '</td></tr>';
    });
    $('mList').innerHTML = h + '</tbody></table>';
  }
  function importMail() {
    var rows = MAIL.filter(function (r) { return MPICK[r.id] && !r.have && r.state !== 'done'; });
    importRows(rows, $('mImp'), $('mProg'), MPICK, drawMail);
  }
  /* 고른 줄을 자료함으로 — 메일 찾기(MAIL 줄)와 자동 정리함(INBOX 줄)이 같은 길(importMailRow)을 탄다. 건수를 묻고 끝까지 한 번에 */
  function importRows(rows, btn, bar, pick, redraw) {
    if (!rows.length) { toast('고른 첨부가 없습니다'); return; }
    if (!window.confirm(rows.length + '건을 자료함으로 가져올까요?\n· 메일은 그대로 두고(읽음 표시도 그대로) 첨부만 원본 그대로 복사합니다.\n· 가져온 자료는 재직 직원 모두가 봅니다.')) return;
    bar.style.display = ''; var fill = bar.firstElementChild;
    var done = 0, fail = 0;
    btn.disabled = true;
    return rows.reduce(function (p, r) {
      return p.then(function () {
        return importMailRow(r).then(function (n) { r.state = 'done'; r.have = true; pick[r.id] = false; done += n || 1; },
          function (e) { r.state = 'err'; r.err = errMsg(e); fail++; })
          .then(function () { fill.style.width = Math.round(((rows.indexOf(r) + 1) / rows.length) * 100) + '%'; });
      });
    }, Promise.resolve()).then(function () {
      bar.style.display = 'none'; btn.disabled = false;
      toast('가져온 첨부 ' + done + '건' + (fail ? ' · 못 한 것 ' + fail + '건(줄의 «알림»에 까닭)' : ''), 8000);
      redraw();
    });
  }
  /* 메일 한 통에서 첨부 받기 — 먼저 첨부 목록을 «엿보고»(peek: 읽음 표시 안 바꿈) 이름으로 집는다 */
  function importMailRow(r) {
    var listP = r.old ? callFn('readOldMail', { key: r.key }) : callFn('readMailMessage', { slug: r.slug, uid: r.uid, peek: true });
    return listP.then(function (j) {
      var atts = (j.atts || []).map(function (a, i) { return { i: i, part: String(a.part || ''), name: String(a.name || ''), size: +a.size || 0 }; });
      /* 자동 정리함 줄(qsha 있음)은 «정리한 바로 그 첨부» 한 건만 — 이름이 정확히 같아야 하고, 받은 뒤 지문(sha256)도 같아야 올린다 */
      var want = r.att ? atts.filter(function (a) { return a.name === r.att || (!r.qsha && a.name.slice(0, 60) === r.att); })
        : atts.filter(function (a) { var k = C.kindOf(C.extOf(a.name)); return (k === 'doc' || k === 'video' || k === 'archive') && C.classifyMail(r.s, a.name, ''); });
      if (r.qsha) want = want.slice(0, 1);
      if (!want.length) throw new Error(r.qsha ? '정리할 때의 첨부를 찾지 못했습니다(이름이 다릅니다)' : '강의자료로 보이는 첨부를 못 찾았습니다');
      return want.reduce(function (p, a) {
        return p.then(function (n) {
          if (a.size > 20 * 1024 * 1024) throw new Error(a.name + ' — 20MB 가 넘어 메일 서버에서 직접 내려받아 «＋ 넣기»로 올려 주세요');
          var body = r.old ? { key: r.key, index: a.i } : { slug: r.slug, uid: r.uid, index: a.i, part: a.part };
          return callFn(r.old ? 'readOldMail' : 'readMailAttachment', body).then(function (got) {
            var name = String(got.name || a.name || '첨부');
            var blob = new Blob([b64ToBytes(got.b64)], { type: got.mime || 'application/octet-stream' });
            var date = C.dateFromText(name.replace(/\.[^.]+$/, '')) || C.dateFromText(r.s);
            r.ids = r.ids || {};
            if (!r.ids[a.i]) r.ids[a.i] = K.newId();                /* 다시 가져와도 같은 id·같은 창고 자리 — 중복 사본을 만들지 않는다 */
            var it = K.makeItem({ id: r.ids[a.i], fileName: name, size: blob.size, cat: C.catOfText(name) !== 'etc' ? C.catOfText(name) : r.cat,
              lectureDate: date || ymd(r.d), dateFrom: date ? 'name' : (r.d ? 'mail' : ''), title: name.replace(/\.[^.]+$/, ''), summary: r.summary || '',
              pii: C.classifyMail(r.s, name, '') ? C.classifyMail(r.s, name, '').pii : false, status: 'review', store: 'cloud',
              source: { kind: 'mail', mailId: r.mailId, mailSubject: r.s.slice(0, 300), mailDate: ymd(r.d) } }, { uid: ME.sid });
            var file = new File([blob], name, { type: blob.type });
            return sha256(file).then(function (h) {
              if (r.qsha && h !== r.qsha) throw new Error('정리할 때와 다른 파일입니다 — 올리지 않았습니다(메일에서 직접 확인해 주세요)');
              if (h) {
                var same = K.findSame(list(), { sha256: h, fileName: name, size: blob.size });
                if (same && same.how === 'sha256') return n;          /* 같은 파일이 이미 있다 — 또 올리지 않는다 */
                it.sha256 = h;
              }
              return uploadBlob(it.id, blob, name).then(function (path) { it.storagePath = path; return saveNew(it); }).then(function () { sigLater(it.id, name, blob); return n + 1; });
            });
          });
        });
      }, Promise.resolve(0));
    });
  }

  /* ───────── 사람이 더한 강의 종류 (대표 지시 2026-11-21 「새로운 강의가 생길수 있으니 + 추가기능」) ─────────
     ★ /edulib/cats/{id} 에 EduCategory 기록 — 저장은 관문(gate)으로. 지우기는 _deleted 표식만, 그 종류 자료가 0건일 때만.
     ★ 이미 넣은 자료의 종류는 저절로 바꾸지 않는다 — 낱말이 맞는 자료를 «골라 보여 줄» 뿐, 바꾸는 것은 사람(«종류 바꾸기»). */
  function catRef(id) { return fbDb.ref('edulib/cats/' + id); }
  function applyCats() {
    var arr = Object.keys(CATSDB).map(function (k) { return CATSDB[k]; })
      .filter(function (c) { return c && !c._deleted; })
      .sort(function (a, b) { return (+a.createdAt || 0) - (+b.createdAt || 0); })
      .map(function (c) { return { key: c.id, label: c.label, legal: c.legal, law: c.law, words: c.words }; });
    C.setCustom(arr);
  }
  function openCatEditor(key) {
    var cur = key ? CATSDB[key] : null;
    if (key && !cur) return;
    var nUsed = key ? K.live(list()).filter(function (it) { return it.cat === key; }).length : 0;
    $('mbox').setAttribute('data-catkey', key || '');
    $('mbox').innerHTML = '<div class="mhead"><h3>' + (cur ? '✎ 강의 종류 고치기' : '＋ 새 강의 종류') + '</h3><span class="sp"></span><button class="sm" id="dX">닫기</button></div>' +
      '<div style="padding:14px"><div class="form">' +
      '<label for="cName">이름</label><input type="text" id="cName" maxlength="40" value="' + esc(cur ? cur.label : '') + '" placeholder="예) 중대재해처벌법 · ESG 경영">' +
      '<label for="cWords">찾을 낱말</label><input type="text" id="cWords" maxlength="200" value="' + esc(cur ? (cur.words || []).join(', ') : '') + '" placeholder="쉼표로 — 예) 중대재해, 중처법 (비우면 이름으로 찾음)">' +
      '<label for="cLegal">법정 교육</label><label class="hint" style="white-space:normal"><input type="checkbox" id="cLegal"' + (cur && cur.legal ? ' checked' : '') + '> 법정 의무교육이다</label>' +
      '<label for="cLaw">근거</label><input type="text" id="cLaw" maxlength="60" value="' + esc(cur ? cur.law || '' : '') + '" placeholder="예) ○○법 제○조 (선택 — 현행 원문을 확인한 뒤)">' +
      '</div><p class="hint" style="margin:10px 0 0;white-space:normal">파일 이름·메일 첨부 이름에 이 낱말이 있으면 이 종류로 짐작합니다(기본 종류보다 먼저 봅니다). 두 글자 이상 낱말만 씁니다. ' +
      '이미 넣은 자료의 종류는 저절로 바꾸지 않습니다 — 낱말이 맞는 자료를 골라 드리면 «종류 바꾸기»로 바꾸세요.</p></div>' +
      '<div class="mfoot">' + (cur ? (nUsed ? '<span class="hint">이 종류 자료 ' + nUsed + '건</span>' : '<button class="dng" id="cHide">🗑 이 종류 지우기</button>') : '') +
      '<span class="sp"></span><button id="dCancel">취소</button><button class="pri" id="cSave">저장</button></div>';
    openModal(cur ? '강의 종류 고치기' : '새 강의 종류', 'cName');
  }
  function saveCat() {
    var key = $('mbox').getAttribute('data-catkey') || '';
    var label = $('cName').value.replace(/\s+/g, ' ').trim();
    if (!label) { toast('이름을 적어 주세요'); return; }
    var norm = label.replace(/\s+/g, '');
    if (C.CATS.some(function (c) { return c.key !== key && c.label.replace(/\s+/g, '') === norm; })) { toast('같은 이름의 종류가 이미 있습니다'); return; }
    var o = { label: label, words: $('cWords').value, legal: $('cLegal').checked, law: $('cLaw').value };
    var p;
    if (!key) {
      var rec = K.makeCat(o, { uid: ME.sid });
      p = gate.save(catRef(rec.id), rec, { entityType: K.CAT_ENTITY, expectedRevision: -1 }).then(function () { return rec; });
    } else {
      var cur = CATSDB[key];
      var nx = K.makeCat(Object.assign({ id: key }, o), { uid: cur.createdBy });
      p = gate.save(catRef(key), function (prev) {
        var base = Object.assign({}, prev || cur);
        base.label = nx.label; base.words = nx.words; base.legal = nx.legal; base.law = nx.law;
        return base;
      }, { entityType: K.CAT_ENTITY }).then(function () { return nx; });
    }
    $('cSave').disabled = true;
    p.then(function (rec) {
      closeDetail();
      CATSDB[rec.id] = Object.assign({}, CATSDB[rec.id] || {}, rec); applyCats(); draw();
      toast(key ? '«' + rec.label + '» 종류를 고쳤습니다' : '«' + rec.label + '» 종류를 더했습니다', 6000);
      suggestCatMatches(rec, !key);
    }).catch(function (e) { if ($('cSave')) $('cSave').disabled = false; toast('저장하지 못했습니다 — ' + errMsg(e), 7000); });
  }
  /* 낱말이 맞는 «이미 넣은 자료»를 골라 보여 준다(바꾸지 않는다). 없으면 새 종류로 자료를 넣으러 갈지 묻는다 */
  function suggestCatMatches(rec, isNew) {
    var c = C.catByKey(rec.id);
    var words = (c.words || []).map(function (w) { return w.toLowerCase(); });
    var hits = words.length ? K.live(list()).filter(function (it) {
      if (it.cat === rec.id) return false;
      var hay = [it.title, it.fileName].join(' ').toLowerCase();
      return words.some(function (w) { return hay.indexOf(w) >= 0; });
    }) : [];
    if (hits.length) {
      if (!window.confirm('이미 넣은 자료 중 ' + hits.length + '건이 «' + rec.label + '» 낱말과 맞습니다.\n그 자료만 골라 «자료»에 보여 드릴까요? (종류는 «종류 바꾸기»를 눌러야 바뀝니다)')) return;
      resetFilters(); setTab('list');
      F.ids = {}; hits.forEach(function (it) { F.ids[it.id] = 1; PICK[it.id] = true; });
      drawList();
      return;
    }
    if (isNew && window.confirm('«' + rec.label + '» 자료를 지금 넣을까요? (＋ 넣기로 갑니다 — 종류를 짐작 못 한 파일은 «' + rec.label + '»로 채웁니다)')) { setTab('add'); ADD_CAT = rec.id; }
  }
  function hideCat() {
    var key = $('mbox').getAttribute('data-catkey') || '';
    var cur = CATSDB[key]; if (!cur) return;
    if (K.live(list()).some(function (it) { return it.cat === key; })) { toast('이 종류 자료가 있어 지울 수 없습니다 — 먼저 자료의 종류를 바꾸세요', 7000); return; }
    if (!window.confirm('«' + cur.label + '» 종류를 지울까요? (지운 표시만 남깁니다 — 자료는 건드리지 않습니다)')) return;
    gate.remove(catRef(key), cur, { entityType: K.CAT_ENTITY }).then(function () { closeDetail(); toast('지웠습니다'); },
      function (e) { toast('지우지 못했습니다 — ' + errMsg(e), 7000); });
  }

  /* ───────── 보낸 메일 자동 정리 (대표 지시 2026-11-21 「메일로 보낸 강의 자료 … 자동으로 정리해서 내용 넣을 수 있게」) ─────────
     서버(functions/edulib-mail-sweep.js)가 매일 19:30 에 한다. 여기서는 그 상태를 보여 주고, 관리자가 «지금 정리»로 바로 돌린다. */
  /* 자동 정리함 줄 — 이미 자료함에 있는 것(같은 메일·같은 첨부, 같은 지문 — 휴지통 포함)과 오래된 줄은 안 보인다 */
  var INB_ROWS = [];
  function inboxRows() {
    var have = {}, sha = {};
    list().forEach(function (it) {
      var src = it.source || {};
      if (src.mailId && it.fileName) have[src.mailId + '|' + it.fileName] = 1;
      if (it.sha256) sha[it.sha256] = 1;
    });
    var since = Date.now() - INBOX_DAYS * 864e5;
    return Object.keys(INBOX).map(function (k) { return INBOX[k]; })
      .filter(function (q) { return q && q.key && q.att && (+q.d || 0) >= since && !have[q.mailId + '|' + q.att] && !(q.sha256 && sha[q.sha256]); })
      .sort(function (a, b) { return (+b.d || 0) - (+a.d || 0); }).slice(0, 300)
      .map(function (q) {
        return { id: 'q#' + q.key, qsha: String(q.sha256 || '') || 'none', slug: String(q.slug || ''), uid: String(q.uid || ''), key: String(q.mailKey || ''), mailId: String(q.mailId || ''),
          s: String(q.subject || ''), d: +q.d || 0, att: String(q.att), cat: q.cat, lectureDate: q.lectureDate || '', summary: String(q.summary || ''),
          old: false, have: false, state: '' };
      });
  }
  function drawInbox() {
    INB_ROWS = inboxRows();
    if (!INB_ROWS.length) { $('mAutoList').innerHTML = '<p class="hint" style="margin:6px 0 0">자동 정리함이 비었습니다 — 새로 정리된 강의자료가 생기면 여기에 쌓입니다.</p>'; return; }
    var nPick = INB_ROWS.filter(function (r) { return IPICK[r.id]; }).length;
    var allOn = INB_ROWS.every(function (r) { return !!IPICK[r.id]; }) ? ' checked' : '';
    var h = '<div class="bar" style="margin-top:8px"><b>🗂 자동 정리함 ' + INB_ROWS.length + '건</b><span class="hint">넣을 것을 고르세요 — 넣은 것만 재직 직원 모두가 봅니다</span><span class="sp"></span>' +
      '<button class="pri" id="mInbImp"' + (nPick ? '' : ' disabled') + '>고른 ' + nPick + '건 자료함에 넣기</button></div>' +
      '<div class="prog" id="mInbProg" style="display:none"><i></i></div>' +
      '<label class="phone-only hint" style="margin:6px 0"><input type="checkbox" id="mInbAllP"' + allOn + '> 보이는 줄 모두 고르기</label>' +
      '<table class="lst ml" style="margin-top:6px"><thead><tr><th class="ck"><input type="checkbox" id="mInbAll"' + allOn + ' title="보이는 줄 모두 고르기" aria-label="자동 정리함 보이는 줄 모두 고르기"></th><th class="no">№</th>' +
      '<th class="dt">메일 날짜</th><th class="tt">자동 정리 내용</th><th class="att">첨부</th><th class="ct">추정 종류</th><th class="st">강의일(추정)</th></tr></thead><tbody>';
    INB_ROWS.forEach(function (r, i) {
      var on = !!IPICK[r.id];
      h += '<tr' + (on ? ' class="picked"' : '') + '><td class="ck"><input type="checkbox" aria-label="' + esc(r.att) + ' 고르기" data-ipick="' + esc(r.id) + '"' + (on ? ' checked' : '') + '></td>' +
        '<td class="no">' + (i + 1) + '</td><td class="dt">' + esc(ymd(r.d)) + '</td>' +
        '<td class="tt" title="' + esc(r.summary || '(내용 없음)') + '">' + esc(r.summary || '—') + '</td>' +
        '<td class="att" title="' + esc(r.att + (r.s ? ' — 메일: ' + r.s : '')) + '">' + esc(r.att) + '</td>' +
        '<td class="ct">' + esc(catLabel(r.cat)) + '</td>' +
        '<td class="st"><span class="one">' + (r.state === 'err' ? '<span class="tag pii" title="' + esc(r.err) + '">못 함</span>' : '') + '<span>' + esc(r.lectureDate || '—') + '</span></span></td></tr>';
    });
    $('mAutoList').innerHTML = h + '</tbody></table>';
  }
  function importInbox() {
    var rows = INB_ROWS.filter(function (r) { return IPICK[r.id]; });
    importRows(rows, $('mInbImp'), $('mInbProg'), IPICK, drawSweep);
  }
  function drawSweep() {
    var s = SWEEP || {};
    drawInbox();
    if (!s.lastRunAt) { $('mAutoSt').textContent = '아직 한 번도 돌지 않았습니다'; return; }
    var k = s.skipped || {};
    var bits = ['마지막 ' + fmtTime(s.lastRunAt) + (s.trigger === 'manual' ? '(손으로)' : ''), '새로 정리 ' + (+s.queued || 0) + '건'];
    if (k.same) bits.push('이미 있음 ' + k.same);
    if (k.pii) bits.push('개인정보로 뺌 ' + k.pii);
    if (k.big) bits.push('너무 큼 ' + k.big);
    if (k.human) bits.push('사람 확인 필요 ' + k.human);
    if (k.err) bits.push('못 함 ' + k.err);
    $('mAutoSt').textContent = bits.join(' · ');
    $('mAutoSt').title = '사람 확인 필요 = 옛 형식(ppt·hwp)·압축·글자 없는 PDF — 아래 «메일함 전체 훑기»로 골라 가져오세요';
  }
  function runSweep() {
    var days = +$('mAutoDays').value || 30;
    if (!window.confirm('최근 ' + days + '일 보낸 메일의 강의자료를 지금 정리할까요?\n· 메일은 읽기만 합니다 · 정리한 것은 «자동 정리함»에 쌓이고, 자료함에는 고른 것만 넣습니다 · 몇 분 걸릴 수 있습니다')) return;
    $('mAutoRun').disabled = true; $('mAutoRun').textContent = '정리 중…';
    callFn('runEdulibMailSweep', { days: days }).then(function (j) {
      var r = j.result || {};
      toast('메일 자동 정리 — 새로 정리 ' + (+r.queued || 0) + '건(자동 정리함)' + (r.more ? ' · 남은 것은 다음에 이어서' : ''), 8000);
    }).catch(function (e) { toast('정리하지 못했습니다 — ' + errMsg(e), 8000); })
      .then(function () { $('mAutoRun').disabled = false; $('mAutoRun').textContent = '지금 정리'; });
  }

  /* ───────── 사건 연결 ───────── */
  function wire() {
    $('tabs').addEventListener('click', function (e) { var b = e.target.closest('[data-tab]'); if (b) setTab(b.getAttribute('data-tab')); });
    $('reBtn').addEventListener('click', function () { draw(); toast('최신 자료입니다(바뀌면 저절로 다시 그립니다)'); });
    /* 메뉴 위 이름 — 머리 칸(#who)과 같은 PuWhoami 에서, 이름이 늦게 와도 바뀌면 다시 쓴다 */
    try { if (window.PuWhoami && PuWhoami.onChange) PuWhoami.onChange(function () { sbUser(); }); } catch (e) {}
    $('simCard').addEventListener('click', function (e) { if (e.target.closest('[data-simrun]')) runSimBatch(); });
    $('sb').addEventListener('click', function (e) {
      var ed = e.target.closest('[data-catedit]'); if (ed) { openCatEditor(ed.getAttribute('data-catedit')); return; }
      if (e.target.closest('[data-catnew]')) { openCatEditor(''); return; }
      var fo = e.target.closest('[data-sbfold]');
      if (fo) {
        var fk = fo.getAttribute('data-sbfold');
        SB_FOLD[fk] = !SB_FOLD[fk]; lsSet('sbFold', JSON.stringify(SB_FOLD)); drawSb();
        var again = $('sbNav').querySelector('[data-sbfold="' + fk + '"]'); if (again) again.focus();   /* 다시 그려도 초점은 그 자리 */
        return;
      }
      var b = e.target.closest('[data-sb],[data-sbcat],[data-sblegal]'); if (!b) return;
      if (b.getAttribute('data-sb') === 'dash') { setTab('dash'); return; }
      resetFilters();
      if (b.hasAttribute('data-sbcat')) F.cat = b.getAttribute('data-sbcat');
      else if (b.hasAttribute('data-sblegal')) F.legal = b.getAttribute('data-sblegal');
      setTab('list');
    });
    $('cats').addEventListener('click', function (e) {
      var ed = e.target.closest('[data-catedit]'); if (ed) { e.stopPropagation(); openCatEditor(ed.getAttribute('data-catedit')); return; }
      if (e.target.closest('[data-catnew]')) { openCatEditor(''); return; }
      var lg = e.target.closest('[data-legal]'); if (lg) { resetFilters(); F.legal = lg.getAttribute('data-legal'); setTab('list'); return; }
      var b = e.target.closest('[data-cat]'); if (!b) return;
      resetFilters(); F.cat = b.getAttribute('data-cat'); setTab('list');
    });
    $('vSeg').addEventListener('click', function (e) {
      var b = e.target.closest('[data-view]'); if (!b) return;
      VIEW = b.getAttribute('data-view') === 'table' ? 'table' : 'card'; lsSet('view', VIEW); drawList();
    });
    $('fIds').addEventListener('click', function (e) { if (e.target.id === 'fIdsX') { F.ids = null; PICK = {}; drawList(); } });
    $('mx').addEventListener('click', function (e) {
      var td = e.target.closest('td.c'); if (!td) return;
      resetFilters(); F.cat = td.getAttribute('data-cat'); F.year = td.getAttribute('data-y'); setTab('list');
    });
    $('kpis').addEventListener('click', function (e) {
      var k = e.target.closest('[data-store]'); if (!k) return;
      resetFilters(); var s = k.getAttribute('data-store');
      if (s === 'review') F.status = 'review'; else F.store = s;
      setTab('list');
    });
    var fq = null;
    $('fQ').addEventListener('input', function () { clearTimeout(fq); fq = setTimeout(function () { F.q = $('fQ').value; SHOWN = PAGE; PICK = {}; drawList(); }, 200); });
    [['fCat', 'cat'], ['fYear', 'year'], ['fKind', 'kind'], ['fStatus', 'status'], ['fStore', 'store']].forEach(function (p) {
      $(p[0]).addEventListener('change', function () { F[p[1]] = $(p[0]).value; SHOWN = PAGE; PICK = {}; drawList(); });
    });
    $('fLegal').addEventListener('change', function () { F.legal = $('fLegal').value; SHOWN = PAGE; PICK = {}; drawList(); });
    $('fTrash').addEventListener('change', function () { F.trash = $('fTrash').checked; PICK = {}; drawList(); });
    $('fGroup').addEventListener('change', function () { GROUP = $('fGroup').value; lsSet('group', GROUP); drawList(); });
    $('fClr').addEventListener('click', function () { resetFilters(); drawList(); });
    $('fMore').addEventListener('click', function () { var f = $('fMore').parentNode; f.classList.toggle('open'); $('fMore').textContent = f.classList.contains('open') ? '접기' : '⋯ 더'; });
    $('list').addEventListener('change', function (e) {
      var c = e.target;
      if (c.hasAttribute('data-pick')) { PICK[c.getAttribute('data-pick')] = c.checked; var rw = c.closest('[data-id]'); if (rw) rw.classList.toggle('picked', c.checked); drawSel(); }
      else if (c.hasAttribute('data-allv')) { RENDERED.forEach(function (id) { PICK[id] = c.checked; }); drawList(); }
      else if (c.hasAttribute('data-allg')) {
        var g = c.getAttribute('data-allg');
        [].forEach.call(document.querySelectorAll('#list [data-id][data-g="' + CSS.escape(g) + '"]'), function (tr) {
          PICK[tr.getAttribute('data-id')] = c.checked; tr.classList.toggle('picked', c.checked);
          var cb = tr.querySelector('[data-pick]'); if (cb) cb.checked = c.checked;
        });
        drawSel();
      }
    });
    $('list').addEventListener('click', function (e) {
      var o = e.target.closest('[data-open]'); if (o) { openDetail(o.getAttribute('data-open')); return; }
      var w = e.target.closest('[data-win]'); if (w) { if (!openWin(w.getAttribute('data-win'))) toast('새 창이 막혔습니다 — 브라우저의 팝업 허용을 켜 주세요', 7000); return; }
      if (e.target.id === 'moreBtn') { SHOWN += PAGE; drawList(); return; }
      var gx = e.target.closest('[data-gx]'); if (gx) { var gk = gx.getAttribute('data-gx'); EXPAND[gk] = !EXPAND[gk]; drawList(); return; }
      if (e.target.closest('[data-catnew]')) openCatEditor('');
    });
    $('sClr').addEventListener('click', function () { PICK = {}; drawList(); });
    $('sCmp').addEventListener('click', function () { openCompare(picked()); });
    $('sWin').addEventListener('click', function () {
      var ids = picked();
      if (ids.length > MAX_WIN && !window.confirm(ids.length + '건 중 앞의 ' + MAX_WIN + '건만 새 창으로 엽니다. 계속할까요?')) return;
      var opened = 0; ids.slice(0, MAX_WIN).forEach(function (id) { if (openWin(id)) opened++; });
      if (opened < Math.min(ids.length, MAX_WIN)) toast('일부 창이 막혔습니다 — 브라우저 주소줄의 «팝업 허용»을 눌러 주세요', 8000);
      else toast(opened + '개 창을 열었습니다 — 창을 나란히 옮겨 비교하세요');
    });
    $('sOk').addEventListener('click', function () { bulk(picked(), '«참고 가능»으로', function (id) { return savePatch(id, { status: 'ok' }); }); });
    $('sDel').addEventListener('click', function () { bulk(picked(), '휴지통으로', trashItem); });
    $('sRestore').addEventListener('click', function () { bulk(picked(), '되살리기', restoreItem); });
    $('sCat').addEventListener('click', function () {
      var ids = picked(); if (!ids.length) return;
      $('mbox').innerHTML = '<div class="mhead"><h3>종류 바꾸기 — ' + ids.length + '건</h3><span class="sp"></span><button class="sm" id="dX">닫기</button></div>' +
        '<div style="padding:14px"><select id="bCat" style="width:100%">' + C.CATS.map(function (c) { return '<option value="' + esc(c.key) + '">' + esc(c.label) + '</option>'; }).join('') + '</select></div>' +
        '<div class="mfoot"><span class="sp"></span><button id="dCancel">취소</button><button class="pri" id="bCatGo">바꾸기</button></div>';
      openModal('종류 바꾸기 — ' + ids.length + '건', 'bCat');
      $('bCatGo').onclick = function () { var v = $('bCat').value; closeDetail(); bulk(ids, '«' + catLabel(v) + '»(으)로 종류 바꾸기', function (id) { return savePatch(id, { cat: v }); }); };
    });
    $('modal').addEventListener('click', function (e) {
      if (e.target === $('modal')) { closeDetail(); return; }
      var so = e.target.closest('[data-simopen]'); if (so) { openDetail(so.getAttribute('data-simopen')); return; }
      var scm = e.target.closest('[data-simcmp]');
      if (scm) { var a0 = DETAIL, b0 = scm.getAttribute('data-simcmp'); closeDetail(); openCompare([a0, b0], '나란히 — 비슷한 강의'); return; }
      var id = e.target.id;
      if (id === 'dX' || id === 'dCancel') closeDetail();
      else if (id === 'dSave') saveDetail();
      else if (id === 'cSave') saveCat();
      else if (id === 'cHide') hideCat();
      else if (id === 'dNoteAdd') addNote();
      else if (id === 'dDl') downloadOriginal(ITEMS[DETAIL], e.target);
      else if (id === 'dWin') openWin(DETAIL);
      else if (id === 'dUp') detailUpload();
      else if (id === 'dRestore') { var rd = DETAIL; restoreItem(rd).then(function () { toast('되살렸습니다'); closeDetail(); }, function (er) { toast('되살리지 못했습니다 — ' + errMsg(er), 7000); }); }
      else if (id === 'dDel') { var d = DETAIL; if (window.confirm('휴지통으로 옮길까요? (원본은 지우지 않습니다 · 휴지통에서 되살릴 수 있습니다)')) trashItem(d).then(function () { toast('휴지통으로 옮겼습니다'); closeDetail(); }, function (er) { toast('옮기지 못했습니다 — ' + errMsg(er), 7000); }); }
    });
    $('cmpX').addEventListener('click', closeCompare);
    $('cmpCols').addEventListener('click', function () { CMP_ONE_ROW = !CMP_ONE_ROW; layoutCompare(); });
    /* 키보드 — Esc 로 위의 창을 닫고, 단추 노릇을 하는 칸(role=button)은 Enter·Space 로 누른다 */
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if ($('modal').style.display !== 'none') { closeDetail(); e.preventDefault(); }
        else if ($('cmp').classList.contains('on')) { closeCompare(); e.preventDefault(); }
        return;
      }
      if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.getAttribute && e.target.getAttribute('role') === 'button' && e.target.tagName !== 'BUTTON') {
        e.preventDefault(); e.target.click();
      }
    });
    /* 선택 줄이 머리 바로 아래에 붙도록 머리 높이를 잰다(폰에서 머리가 두 줄이 되면 76px 로는 가려졌다) */
    function headH() { try { document.documentElement.style.setProperty('--headH', $('head').offsetHeight + 'px'); } catch (e) {} }
    headH(); window.addEventListener('resize', headH); setTimeout(headH, 800);
    /* 뒤로 가기는 공용 PuBack 이 «닫기» 단추를 눌러 준다(pu-edulib.html 의 PuBack.guard) — 여기서 따로 history 를 만지지 않는다 */

    /* 넣기 */
    $('pickF').addEventListener('click', function () { $('inF').click(); });
    $('pickD').addEventListener('click', function () { $('inD').click(); });
    $('pickJ').addEventListener('click', function () { $('inJ').click(); });
    $('inF').addEventListener('change', function () { stageFiles($('inF').files, false); $('inF').value = ''; });
    $('inD').addEventListener('change', function () { stageFiles($('inD').files, true); $('inD').value = ''; });
    $('inJ').addEventListener('change', function () {
      var f = $('inJ').files && $('inJ').files[0]; $('inJ').value = ''; if (!f) return;
      f.text().then(function (t) { stagePcList(JSON.parse(t)); }).catch(function () { toast('JSON 을 읽지 못했습니다', 6000); });
    });
    var drop = $('drop');
    drop.addEventListener('dragover', function (e) { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', function () { drop.classList.remove('over'); });
    drop.addEventListener('drop', function (e) {
      e.preventDefault(); drop.classList.remove('over');
      readDrop(e.dataTransfer).then(function (files) { stageFiles(files, files.some(function (f) { return f.webkitRelativePath || f._rel; })); });
    });
    $('stage').addEventListener('change', function (e) {
      var t = e.target, r;
      if (t.id === 'stAll' || t.id === 'stAllP') { [].forEach.call(document.querySelectorAll('#stage [data-spick]'), function (cb) { var x = stageRow(cb.getAttribute('data-spick')); if (x && !x.state) { x.pick = t.checked; } }); drawStage(); return; }
      if (t.hasAttribute('data-spick') && (r = stageRow(t.getAttribute('data-spick')))) { r.pick = t.checked; drawStage(); }
      else if (t.hasAttribute('data-scat') && (r = stageRow(t.getAttribute('data-scat')))) r.cat = t.value;
      else if (t.hasAttribute('data-sdate') && (r = stageRow(t.getAttribute('data-sdate')))) { r.lectureDate = t.value.trim(); r.dateFrom = r.lectureDate ? 'manual' : ''; if (!K.okDate(r.lectureDate)) toast('강의일은 2026-11-19 · 2026-11 · 2026 꼴로'); }
      else if (t.hasAttribute('data-svenue') && (r = stageRow(t.getAttribute('data-svenue')))) r.venue = t.value.trim();
    });
    $('stAllA').addEventListener('click', function () { STAGE.forEach(function (r) { if (!r.state) r.pick = !r.dup && !r.pii && (r.tier === 'A' || r.src === 'file'); }); drawStage(); });
    $('stClr').addEventListener('click', function () { if (!STAGE.length || window.confirm('넣을 줄 ' + STAGE.length + '건을 비울까요? (저장한 것은 그대로)')) { STAGE = []; drawStage(); } });
    $('stSave').addEventListener('click', saveStage);

    /* 메일 */
    $('mScan').addEventListener('click', scanMail);
    $('mAutoRun').addEventListener('click', runSweep);
    $('mAutoList').addEventListener('click', function (e) { if (e.target.id === 'mInbImp') importInbox(); });
    $('mAutoList').addEventListener('change', function (e) {
      var t = e.target;
      if (t.id === 'mInbAll' || t.id === 'mInbAllP') { INB_ROWS.forEach(function (r) { IPICK[r.id] = t.checked; }); drawInbox(); return; }
      if (t.hasAttribute('data-ipick')) { IPICK[t.getAttribute('data-ipick')] = t.checked; drawInbox(); }
    });
    $('mImp').addEventListener('click', importMail);
    var mq = null;
    $('mQ').addEventListener('input', function () { clearTimeout(mq); mq = setTimeout(function () { MQ = $('mQ').value; MPICK = {}; drawMail(); }, 200); });
    $('mList').addEventListener('change', function (e) {
      var t = e.target;
      /* 머리줄 ☐ 는 «개인정보?»(명단·서명지) 첨부는 고르지 않는다 — 그런 줄은 하나씩 보고 고른다 */
      if (t.id === 'mAll' || t.id === 'mAllP') { mailShown().slice(0, 800).forEach(function (r) { if (!r.have && !r.pii) MPICK[r.id] = t.checked; }); drawMail(); return; }
      if (t.hasAttribute('data-mpick')) { MPICK[t.getAttribute('data-mpick')] = t.checked; drawMail(); }
    });
  }
  function resetFilters() { F = { q: '', cat: '', year: '', kind: '', status: '', store: '', legal: '', trash: false, ids: null }; SHOWN = PAGE; PICK = {}; EXPAND = {}; }

  /* 끌어다 놓은 폴더 — 안의 파일을 모두 모은다(경로는 _rel 로 붙여 분류에 쓴다) */
  function readDrop(dt) {
    var items = dt && dt.items ? [].slice.call(dt.items) : [];
    var entries = items.map(function (i) { return i.webkitGetAsEntry ? i.webkitGetAsEntry() : null; }).filter(Boolean);
    if (!entries.length) return Promise.resolve([].slice.call((dt && dt.files) || []));
    var out = [];
    function walk(entry, prefix) {
      /* 폴더 안의 파일에만 경로를 붙인다 — 파일 하나를 끌어놓은 것은 «폴더 넣기»가 아니다(파일 고르기와 같게 다룬다) */
      if (entry.isFile) return new Promise(function (res) { entry.file(function (f) { if (prefix) { try { Object.defineProperty(f, 'webkitRelativePath', { value: prefix + f.name }); } catch (e) { f._rel = prefix + f.name; } } out.push(f); res(); }, function () { res(); }); });
      if (!entry.isDirectory) return Promise.resolve();
      var rd = entry.createReader();
      return new Promise(function (res) {
        var all = [];
        (function more() { rd.readEntries(function (es) { if (!es.length) { res(all); return; } all = all.concat([].slice.call(es)); more(); }, function () { res(all); }); })();
      }).then(function (es) { return es.reduce(function (p, x) { return p.then(function () { return walk(x, prefix + entry.name + '/'); }); }, Promise.resolve()); });
    }
    return entries.reduce(function (p, en) { return p.then(function () { return walk(en, ''); }); }, Promise.resolve()).then(function () { return out; });
  }

  /* ───────── 불러오기 ───────── */
  var drawT = null;
  function listen() {
    fbDb.ref('edulib/items').on('value', function (s) {
      var v = s.val() || {};
      ITEMS = {};
      Object.keys(v).forEach(function (k) { var it = v[k]; if (it && typeof it === 'object' && it.id === k) ITEMS[k] = it; });
      LOADED = true;
      SIMBEST = null;
      clearTimeout(drawT); drawT = setTimeout(function () {
        if (TAB !== 'add') draw(); else $('nItems').textContent = K.live(list()).length;
        if (VIEW_ID && ITEMS[VIEW_ID] && !$('cmp').classList.contains('on')) openCompare([VIEW_ID], ITEMS[VIEW_ID].title);
      }, 60);
    }, function (e) { lock('자료를 읽지 못했습니다 — ' + errMsg(e)); });
    /* 사람이 더한 강의 종류 — 바뀌면 분류 규칙(C.setCustom)을 갈아 끼우고 다시 그린다(넣기 화면은 쓰던 칸을 지우지 않게 그대로) */
    var drawC = null;
    fbDb.ref('edulib/cats').on('value', function (s) {
      var v = s.val() || {};
      CATSDB = {};
      Object.keys(v).forEach(function (k) { var c = v[k]; if (c && typeof c === 'object' && c.id === k) CATSDB[k] = c; });
      applyCats();
      clearTimeout(drawC); drawC = setTimeout(function () { if (TAB !== 'add' && LOADED) draw(); }, 60);
    }, function () {});
    /* 내용 지문(비슷한 강의) — 바뀌면 목록 ↺ 셈을 비우고 다시 그린다(자세히가 열려 있으면 그 칸도) */
    var drawS = null;
    fbDb.ref('edulib/sims').on('value', function (s) {
      var v = s.val() || {};
      SIMS = {};
      Object.keys(v).forEach(function (k) { var x = v[k]; if (x && typeof x === 'object' && x.id === k && x.entityType === K.SIM_ENTITY) SIMS[k] = x; });
      SIMBEST = null;
      clearTimeout(drawS); drawS = setTimeout(function () { if (TAB !== 'add' && LOADED) draw(); if (DETAIL) drawSim(); }, 120);
    }, function () {});
    if (ME.admin) {
      fbDb.ref('edulib_inbox/state').on('value', function (s) { SWEEP = s.val(); if (TAB === 'mail') drawSweep(); }, function () {});
      fbDb.ref('edulib_inbox/q').on('value', function (s) { INBOX = s.val() || {}; if (TAB === 'mail') drawSweep(); }, function () {});
    }
  }
  function loadNames() {
    return fbDb.ref('data/user_dir').once('value').then(function (snap) {
      var v = snap.val(); if (v && v.v !== undefined) v = v.v;
      var arr = Array.isArray(v) ? v : (v && typeof v === 'object' ? Object.keys(v).map(function (k) { return v[k]; }) : []);
      arr.forEach(function (r) { if (r && r.sid && r.name) NAMES[r.sid] = String(r.name); });
    }).catch(function () {});
  }

  /* ═══ 로그인·잠금 — 모르면 잠근다 ═══
     재직 직원(status==='active' + sid)이면 연다. 로그인 안 함·퇴사·못 읽음은 그대로 잠근다.
     메일 찾기 칸은 관리자(isAdmin)만 — 메일함이 관리자 전용이라서. */
  function lock(why) { $('app').style.display = 'none'; $('lock').style.display = 'block'; $('lockWhy').textContent = why || ''; }
  function who() { var w = (window.PuWhoami && PuWhoami.get && PuWhoami.get()) || {}; return w.name || ''; }
  function roleOf(u) {
    return fbDb.ref('uid_roles/' + u.uid).once('value').then(function (s) {
      var v = s.val() || {};
      return { sid: v.status === 'active' && v.sid ? String(v.sid) : '', admin: v.isAdmin === true };
    }).catch(function () { return { sid: '', admin: false }; });
  }
  function boot() {
    var m = location.search.match(/[?&]view=([^&]+)/);
    VIEW_ID = m ? decodeURIComponent(m[1]) : '';
    var t = lsGet('tab'); if (['dash', 'list', 'add', 'mail'].indexOf(t) >= 0) TAB = t;
    var g = lsGet('group'); if (g === 'cat' || g === 'year' || g === '') GROUP = g;
    var vw = lsGet('view'); if (vw === 'card' || vw === 'table') VIEW = vw;
    if (location.protocol === 'file:') { lock('file:// 로 열면 로그인할 수 없습니다 — 주소로 여세요'); return; }
    if (typeof firebase === 'undefined') { lock('인터넷이 필요합니다'); return; }
    if (!firebase.apps || !firebase.apps.length) firebase.initializeApp(FB_CONFIG);
    fbDb = firebase.database();
    try { bucket = firebase.app().storage(BUCKET); } catch (e) { bucket = null; }
    try { firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL); } catch (e) {}
    wire();
    firebase.auth().onAuthStateChanged(function (u) {
      $('outBtn').style.display = u ? '' : 'none';
      if (!u || (ME.uid && u.uid !== ME.uid)) resetOriginals();
      sbOn(false);
      if (!u) { PuEduLibGate.show(); return; }
      PuEduLibGate.hide();
      roleOf(u).then(function (r) {
        /* 이름만 — 로그인 이메일·사번을 잠금 화면에 적지 않는다 */
        if (!r.sid) { lock((who() ? '접속: ' + who() + ' — ' : '') + '재직 중인 직원 계정이 아닙니다'); return; }
        ME.sid = r.sid; ME.uid = u.uid; ME.admin = r.admin;
        sbUser(); sbOn(true);
        gate = PuOntologyWrite.createGateway({ mode: 'enforce', actor: r.sid });
        $('mailTab').style.display = ME.admin ? '' : 'none';
        $('lock').style.display = 'none'; $('app').style.display = '';
        loadNames().then(function () { setTab(VIEW_ID ? 'list' : TAB); listen(); });
      });
    });
  }
  boot();
})();
