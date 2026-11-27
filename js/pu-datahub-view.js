/* ══════════════════════════════════════════════════════════════════════
   데이터관리(대표 전용) 화면 — js/pu-datahub-view.js (2026-11-21)
   계획서 docs/superpowers/plans/2026-11-18-데이터관리-계획서.md · 목업(제미나이 다시 디자인 판)을 진짜 자료에 이었다.

   ★ 문(앱 안 겹) — 로그인 → uid_roles 재직 확인 → app_owner/uid 가 «내 uid 와 같을 때만» 연다.
     못 읽음·없음·다름은 모두 닫는다(모르면 닫는다). 자료는 이 확인이 끝난 «뒤에만» 불러온다.
     사번·이름·role·isAdmin 으로 열지 않는다(관리자대행도 isAdmin 이다).
   ★ 원본은 읽기만 — 이 파일이 쓰는 자리는 datahub/{uid}/settings 하나뿐이고, 그것도 저장 관문(PuOntologyWrite)으로만 쓴다.
   ★ 숫자는 PuDatahubCalc.build() 결과로만 그린다 — 입금을 여기서 더하지 않는다(두 번 세기·거르개 어긋남 막기).
   ★ 못 읽은 것은 0 으로 그리지 않는다 — «—» 와 까닭을 띄운다. 분모가 0 이면 «—».
   ★ 채팅은 이 컴퓨터 한 대 — 질문마다 꺼낼 수 없는 기기 열쇠로 서명해 데이터관리 전용 서버 함수로만 보낸다.
     보내는 것은 PuDatahubCalc.pseudonymize() 의 가명 숫자뿐 · 되돌림표(back)는 어디에도 보내거나 저장하지 않는다.
   ★ 모든 글자(이름·업체·종류·서버가 준 글)는 esc() 를 거쳐 그린다.
   ══════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  var L3 = global.Pu3DLite, C = global.PuDatahubCalc;
  if (!L3 || !C) return;
  var U = L3.util, ST = L3.state;
  var clamp = U.clamp, hex2rgb = U.hex2rgb, rgba = U.rgba, shade = U.shade, mixRgb = U.mixRgb, haloText = U.haloText;
  var strokeSpline2D = U.strokeSpline2D, smoothPts3D = U.smoothPts3D, sampleSmooth1D = U.sampleSmooth1D;
  var showTip = L3.showTip, hideTip = L3.hideTip;
  var REDUCE = ST.reduce;
  var FN_BASE = 'https://asia-northeast3-pureun-erp.cloudfunctions.net/';
  var IDLE_MS = 15 * 60 * 1000;

  /* ══ 0. 작은 도구 ══ */
  function $(id) { return document.getElementById(id); }
  function str(v) { return v == null ? '' : String(v).trim(); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fin(v) { return typeof v === 'number' && isFinite(v); }
  function n(v) { return fin(v) ? Math.round(v).toLocaleString('ko-KR') : '—'; }
  /* 금액은 «원»으로 받는다(계산 모듈이 원) — 화면에는 억·만원으로 읽기 쉽게 */
  function won(v) {
    if (!fin(v)) return '—';
    var neg = v < 0, a = Math.abs(Math.round(v)), s;
    if (a >= 1e8) { var e = Math.floor(a / 1e8), r = Math.round((a % 1e8) / 1e4); if (r >= 10000) { e++; r = 0; } s = e.toLocaleString('ko-KR') + '억' + (r ? ' ' + r.toLocaleString('ko-KR') + '만' : '') + '원'; }
    else if (a >= 1e4) s = Math.round(a / 1e4).toLocaleString('ko-KR') + '만원';
    else s = a.toLocaleString('ko-KR') + '원';
    return (neg ? '−' : '') + s;
  }
  function man(v) { return fin(v) ? Math.round(v / 1e4).toLocaleString('ko-KR') : '—'; }      /* 축 숫자(만원) */
  function ratio(a, b) { return (fin(a) && fin(b) && b !== 0) ? a / b : null; }               /* 분모 0 → null(«—») */
  function pct1(v) { return fin(v) ? v.toFixed(1) + '%' : '—'; }
  function numOrNull(v) { if (v === '' || v == null) return null; var x = Number(v); return isFinite(x) ? x : null; }
  function why(e) { var c = e && (e.code || e.name); var m = str(e && e.message); if (/permission/i.test(c + ' ' + m)) return '권한 없음'; return (c ? c + ' ' : '') + (m ? m.slice(0, 80) : '알 수 없는 오류'); }
  /* CSV 칸이 = + - @ 로 시작하는 글이면 엑셀이 수식으로 읽는다 — 앞에 ' 를 붙여 글로 둔다(숫자는 그대로) */
  function csvCell(x) { var s = String(x == null ? '' : x); if (typeof x !== 'number' && /^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; }
  function pad2(x) { return (x < 10 ? '0' : '') + x; }
  /* 캔버스 글자를 폭에 맞춰 줄인다 — 넘치면 «…» (표 한 칸 한 줄 규칙과 같은 잣대) */
  function fitText(g, t, maxW) { t = String(t); if (g.measureText(t).width <= maxW) return t; while (t.length > 1 && g.measureText(t + '…').width > maxW) t = t.slice(0, -1); return t + '…'; }
  function ymNow() { var d = new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1); }
  function ymdNow() { var d = new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function fmtAt(at) {
    var d = fin(at) ? new Date(at) : (at ? new Date(String(at)) : null);
    if (!d || !isFinite(d.getTime())) return '';
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }
  function setPressed(el, on) { if (!el) return; el.classList.toggle('on', !!on); el.setAttribute('aria-pressed', on ? 'true' : 'false'); }
  function setSync(id, txt) { var el = $(id); if (el) el.textContent = txt; }
  function smsg(id, txt) { var el = $(id); if (el) el.textContent = txt || ''; }
  var toastTimer = null;
  function showToast(txt) {
    var el = $('toastMsg'); if (!el) return;
    el.textContent = txt; el.classList.add('on');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { el.classList.remove('on'); }, 2900);
  }
  function download(name, text) {
    var blob = new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  }
  function sparkSvg(vals, hiIdx, col) {
    var v = vals.map(function (x) { return fin(x) ? x : 0; });
    if (v.length < 2) return '';
    var mn = Math.min.apply(null, v), mx = Math.max.apply(null, v), span = Math.max(1e-9, mx - mn);
    var pts = v.map(function (x, i) { return [2 + (i / (v.length - 1)) * 64, 19 - ((x - mn) / span) * 15]; });
    var d = 'M' + pts.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' L');
    var dot = (hiIdx >= 0 && hiIdx < pts.length) ? '<circle cx="' + pts[hiIdx][0].toFixed(1) + '" cy="' + pts[hiIdx][1].toFixed(1) + '" r="2.8" fill="' + col + '"/>' : '';
    return '<svg class="spk" viewBox="0 0 68 22" aria-hidden="true"><path d="' + d + '" fill="none" stroke="' + col + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" opacity=".82"/>' + dot + '</svg>';
  }
  function tblHtml(head, rows, cap) {
    return '<thead><tr>' + head.map(function (h, i) { return '<th' + (i === 0 ? ' class="l"' : '') + '>' + esc(h) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      (rows.length ? rows.map(function (r) { return '<tr>' + r.map(function (c, i) { return '<td' + (i === 0 ? ' class="l"' : '') + ' title="' + esc(c) + '">' + esc(c) + '</td>'; }).join('') + '</tr>'; }).join('')
        : '<tr><td class="l" colspan="' + head.length + '">보일 자료가 없습니다</td></tr>') + '</tbody>' +
      (cap ? '<caption style="caption-side:bottom;text-align:left;font-size:11.5px;color:#475569;padding-top:6px">' + esc(cap) + '</caption>' : '');
  }
  /* 칩 줄 — 자료에 따라 다시 그릴 수 있게, 전에 만든 칩만 지우고 새로 단다 */
  function chipRow(id, list, onSel, multi) {
    var box = $(id), btns = [];
    if (!box) return;
    box.querySelectorAll('.chip[data-gen]').forEach(function (x) { x.remove(); });
    list.forEach(function (it) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'chip' + (it.on ? ' on' : '') + (multi && it.off ? ' off' : ''); b.setAttribute('data-gen', '1');
      b.setAttribute('aria-pressed', multi ? (it.off ? 'false' : 'true') : (it.on ? 'true' : 'false'));
      if (it.disabled) { b.disabled = true; }
      if (it.title) b.title = it.title;
      b.innerHTML = (it.color ? '<i style="background:' + esc(it.color) + '"></i>' : '') + esc(it.name);
      b.addEventListener('click', function () {
        if (multi) { b.classList.toggle('off'); var shown = !b.classList.contains('off'); b.setAttribute('aria-pressed', shown ? 'true' : 'false'); onSel(it.k, shown); }
        else { btns.forEach(function (x) { x.classList.remove('on'); x.setAttribute('aria-pressed', 'false'); }); b.classList.add('on'); b.setAttribute('aria-pressed', 'true'); onSel(it.k); }
      });
      box.appendChild(b); btns.push(b);
    });
  }

  /* ══ 1. 상태 ══ */
  var FB = null, DB = null, AUTH = null, EPOCH = 0, LAST_UID = '', OPENED = false;
  var GATE_OK = false;          /* 대표 표지 확인을 통과했는가 — 잠그면 곧바로 false */
  var ME = { uid: '', sid: '', name: '', email: '' };
  var RAW = { incomes: [], userDir: [], companies: [], workItems: [], workLogs: [] };
  var SRC = {};                 /* 자리마다 {ok, why, n} — 못 읽은 자리를 0 으로 그리지 않으려고 */
  var DS = null, END_YM = '', TODAY = '';
  var BASIS = 'cash', NET = false, GLOBAL_VMODE = 'both', CUR = 11;
  var BOARD_RAW = {};
  var SET = emptySettings();
  var LOADED = false;
  var VIEW = 'all';

  function emptySettings() { return { view: 'all', period: '', basis: 'cash', net: false, vmode: 'both', aLines: {}, cLines: {}, thresholds: { board: {} }, baseline: {} }; }
  function finOk() { return !!(SRC.fin && SRC.fin.ok); }
  function logOk() { return !!(SRC.logs && SRC.logs.ok); }
  function finWhy() { return SRC.fin && !SRC.fin.ok ? '입금 자료를 못 읽었습니다(' + SRC.fin.why + ') — 0 으로 그리지 않습니다' : ''; }
  function logWhy() { return SRC.logs && !SRC.logs.ok ? '업무 기록을 못 읽었습니다(' + SRC.logs.why + ')' : ''; }
  function PEOPLE() { return DS ? DS.PEOPLE : []; }
  function MONTHS() { return DS ? DS.MONTHS : []; }
  function MONTH_KO() { return DS ? DS.MONTH_KO : []; }
  function MTOT() { return DS ? DS.MTOT : []; }
  function CATS() { return DS ? DS.CATS : C.CATS; }
  function COMP() { return DS ? DS.COMP : []; }
  function personById(id) { var L = PEOPLE(); for (var i = 0; i < L.length; i++) if (L[i].id === id) return L[i]; return null; }
  function lastIdx() { return 11; }
  function curLabel() { return CUR === 12 ? '최근 12개월' : (CUR === lastIdx() ? '이번 달(' + (MONTHS()[CUR] || '') + ')' : (MONTH_KO()[CUR] || '')); }

  /* 기준값(대표가 정함) — 없으면 null. 정하기 전에는 노랑·빨강을 칠하지 않는다 */
  function cLines() {
    var c = SET.cLines || {}, w = numOrNull(c.warn), o = numOrNull(c.over);
    var L = [];
    if (w != null && w > 0) L.push({ v: w, t: '많음 ' + w + '건', c: '#d97706' });
    if (o != null && o > 0) L.push({ v: o, t: '넘침 ' + o + '건', c: '#dc2626' });
    L.sort(function (a, b) { return a.v - b.v; });
    return L;
  }
  function recWarn() { var v = numOrNull((SET.thresholds || {}).recWarn); return (v != null && v > 0) ? v : null; }
  function aGoal() { var v = numOrNull((SET.aLines || {}).goal); return (v != null && v > 0) ? v : null; }
  function thrBoard(key) {
    var b = ((SET.thresholds || {}).board || {})[key]; if (!b) return null;
    var w = numOrNull(b.w), x = numOrNull(b.b);
    if (w == null && x == null) return null;
    return { w: w, b: x };
  }
  function anyBoardThr() { var b = (SET.thresholds || {}).board || {}; return Object.keys(b).some(function (k) { return !!thrBoard(k); }); }

  /* ══ 2. 문 — 대표 확인 ══ */
  function showBoot(msg) { $('boot').hidden = !msg; if (msg) $('bootMsg').textContent = msg; }
  function locked(reason, hasUser) {
    wipe();
    if (global.PuGate) global.PuGate.hide();
    $('app').hidden = true; showBoot(false);
    $('lock').hidden = false; $('lockWhy').textContent = reason || '';
    $('lockOut').hidden = !hasUser;
  }
  /* 계정이 바뀌거나 잠기면 그려 둔 자료를 지운다 — 남의 화면에 앞사람 숫자가 남지 않게 */
  function wipe() {
    RAW = { incomes: [], userDir: [], companies: [], workItems: [], workLogs: [] };
    GATE_OK = false;
    SRC = {}; DS = null; BOARD_RAW = {}; SET = emptySettings(); LOADED = false;
    ONT = { state: 'idle' }; G.N = []; G.E = []; G.act = []; G.on = [];
    FILES = {}; mState.pick = {}; mState.focusYears = null; mState.selYear = null;
    selected = {};
    DEVICE.server = null; DEVICE.local = null; DEVICE.reqFp = '';
    chatHide(true);
    ['kpis', 'allTbl', 'allCards', 'catBreakList', 'mKpis', 'mReconTbl', 'mReconCards', 'board', 'boardTbl', 'gSide', 'gTbl', 'aTbl', 'bTbl', 'cTbl', 'dTbl', 'eTbl', 'msgsAll', 'auditQ', 'sDash', 'stripSum']
      .forEach(function (id) { var el = $(id); if (el) el.innerHTML = ''; });
    if (OPENED) L3.SCENES.forEach(function (s) { L3.clear(s); s.dirty = true; });
  }
  function boot(firebase) {
    FB = firebase; DB = firebase.database(); AUTH = firebase.auth();
    bindStatic();
    $('lockOut').addEventListener('click', function () { try { AUTH.signOut(); } catch (e) {} });
    AUTH.onAuthStateChanged(function (user) {
      EPOCH++; var my = EPOCH;
      wipe();
      $('lock').hidden = true;
      if (!user) {
        if (LAST_UID) chatForget(LAST_UID);
        LAST_UID = ''; ME = { uid: '', sid: '', name: '', email: '' };
        $('app').hidden = true; showBoot(false);
        if (global.PuGate) global.PuGate.show();
        return;
      }
      if (LAST_UID && LAST_UID !== user.uid) chatForget(LAST_UID);
      LAST_UID = user.uid;
      $('app').hidden = true; showBoot('대표 확인 중…');
      DB.ref('uid_roles/' + user.uid).once('value').then(function (snap) {
        if (my !== EPOCH) return;
        var ur = snap ? snap.val() : null;
        if (!ur || typeof ur !== 'object') return locked('등록된 구성원 권한 정보가 없습니다 — 통합 포털에서 계정 승인을 확인하세요.', true);
        var role = str(ur.role), status = str(ur.status), isAdmin = ur.isAdmin === true || role === 'admin';
        if (role === 'reviewer') return locked('검수 전용 계정으로는 열 수 없습니다.', true);
        if (!(isAdmin || status === 'active') || status === 'resigned' || status === 'inactive' || status === 'pending')
          return locked('재직 중인 계정만 열 수 있습니다.', true);
        ME = { uid: user.uid, sid: str(ur.sid), name: str(ur.name), email: str(user.email) };
        return ownerGate(user, my);
      }).catch(function (e) {
        if (my !== EPOCH) return;
        locked('계정 권한 정보를 확인하지 못했습니다(' + why(e) + ') — 새로 고쳐 주세요.', true);
      });
    });
  }
  /* ★ 앱 안 대표 확인 — app_owner/uid 와 내 uid 가 «같을 때만» 연다.
     못 읽음(오류·권한) · 없음(처음) · 다름 · 글자가 아님 → 모두 닫는다(모르면 닫는다). */
  function ownerGate(user, my) {
    return DB.ref('app_owner/uid').once('value').then(function (snap) {
      if (my !== EPOCH) return;
      var owner = snap ? snap.val() : null;
      if (owner == null || owner === '') return locked('대표 표지가 아직 서버에 없습니다 — 관리자가 이 PC 터미널에서 한 번 넣어야 열립니다(node scripts/datahub-owner.js). 그 전에는 누구에게도 열리지 않습니다.', true);
      if (typeof owner !== 'string' || owner !== user.uid) return locked('이 계정은 대표 표지와 다릅니다.', true);
      openApp(my);
    }, function (e) {
      if (my !== EPOCH) return;
      locked('대표 표지를 읽지 못해 닫았습니다(' + why(e) + ') — 모르면 닫습니다.', true);
    });
  }
  function openApp(my) {
    GATE_OK = true;
    if (global.PuGate) global.PuGate.hide();
    showBoot(false); $('lock').hidden = true; $('app').hidden = false;
    if (!OPENED) {
      OPENED = true;
      if (global.matchMedia && global.matchMedia('(max-width:600px)').matches) { GLOBAL_VMODE = '2d'; bState.warnFirst = true; }   /* 결정 ⑤ — 폰은 2D 기본 + 3D 단추 */
      initScenes();
      L3.start();
    }
    applyGlobalMode(GLOBAL_VMODE, true);
    loadAll(my);
  }

  /* ══ 3. 읽기 — 확인이 끝난 뒤에만 · 읽기만(once) ══ */
  function rd(key, path, take) {
    return DB.ref(path).once('value').then(function (s) {
      var cnt = take(s ? s.val() : null);
      SRC[key] = { ok: true, n: cnt };
    }, function (e) { SRC[key] = { ok: false, why: why(e) }; });
  }
  /* 업무 기록 — 끝 달 기준 최근 53주를 «주마다 따로» 읽고 {d,by} 만 남긴다. 본문(t)은 그리지도 보내지도 않는다 */
  function readLogs(weeks, my) {
    var out = [], fail = 0, last = '';
    return Promise.all(weeks.map(function (wk) {
      return DB.ref('work_erp/logs/' + wk.slice(0, 4) + '/' + wk).once('value').then(function (s) {
        if (my !== EPOCH) return;
        var v = s ? s.val() : null; if (!v || typeof v !== 'object') return;
        Object.keys(v).forEach(function (it) {
          var box = v[it]; if (!box || typeof box !== 'object') return;
          Object.keys(box).forEach(function (lid) { var lg = box[lid]; if (lg && typeof lg === 'object') out.push({ d: str(lg.d), by: str(lg.by) }); });
        });
      }, function (e) { fail++; last = why(e); });
    })).then(function () {
      RAW.workLogs = out;
      SRC.logs = fail >= weeks.length ? { ok: false, why: last } : { ok: true, n: out.length, part: fail ? fail + '주 못 읽음' : '' };
    });
  }
  function loadAll(my) {
    if (!GATE_OK) return;                 /* 대표 확인 전에는 한 줄도 읽지 않는다 */
    var uid = ME.uid;
    END_YM = ymNow(); TODAY = ymdNow();
    $('topAtTx').textContent = ' 불러오는 중';
    renderLoading();
    var weeks = C.weekList(TODAY, 53);
    Promise.all([
      rd('fin', 'data/finance_income', function (v) { RAW.incomes = C.unwrap(v); return RAW.incomes.length; }),
      rd('dir', 'data/user_dir', function (v) { RAW.userDir = C.unwrap(v); return RAW.userDir.length; }),
      rd('co', 'data/companies', function (v) { RAW.companies = C.unwrap(v); return RAW.companies.length; }),
      rd('items', 'work_erp/items', function (v) { RAW.workItems = C.unwrap(v); return RAW.workItems.length; }),
      readLogs(weeks, my),
      rd('set', 'datahub/' + uid + '/settings', function (v) { applySettings(v); return v ? 1 : 0; }),
      rd('board', 'datahub_board', function (v) { BOARD_RAW = (v && typeof v === 'object') ? v : {}; return Object.keys(BOARD_RAW).length; }),
      rd('dev', 'datahub_device/' + uid, function (v) { DEVICE.server = (v && typeof v === 'object') ? v : null; return v ? 1 : 0; })
    ]).then(function () {
      if (my !== EPOCH) return;
      LOADED = true;
      applyGlobalMode(GLOBAL_VMODE, true);   /* 저장해 둔 3D·2D 보기를 화면에도 — 설정은 자료와 함께 늦게 와서 앱을 열 때 한 번 부른 것만으로는 안 보였다 */
      computeDs();
      renderAll(true);
      $('topAtTx').textContent = ' 집계 ' + fmtAt(Date.now());
      $('topAt').title = '이 화면이 원본을 읽어 집계한 시각 — 현황판 숫자는 서버 집계 시각을 따로 적습니다';
      deviceRefresh();
      loadOntology(my);
    });
  }
  function computeDs() {
    DS = C.build(RAW, { endYm: END_YM, basis: BASIS, net: NET, today: TODAY });
    YEAR_MONTHS = {};
    if (CUR > 12 || CUR < 0) CUR = lastIdx();
  }

  /* ══ 4. 보기 설정 — datahub/{uid}/settings 하나만, 저장 관문으로 ══ */
  function applySettings(v) {
    SET = emptySettings();
    if (!v || typeof v !== 'object') return;
    ['view', 'period', 'basis', 'vmode'].forEach(function (k) { if (typeof v[k] === 'string') SET[k] = v[k]; });
    SET.net = v.net === true;
    if (v.aLines && typeof v.aLines === 'object') SET.aLines = { goal: numOrNull(v.aLines.goal) };
    if (v.cLines && typeof v.cLines === 'object') SET.cLines = { warn: numOrNull(v.cLines.warn), over: numOrNull(v.cLines.over) };
    /* 서버 모양(규칙 scripts/make-firebase-rules.js 와 같게 두 겹까지):
       thresholds = { 앱key: {w, b}, _rec: 기록률 주의 %, _recon: {w, b} } — 화면 안에서는 {recWarn, reconWarn, reconBad, board} 로 펼쳐 쓴다 */
    if (v.thresholds && typeof v.thresholds === 'object') {
      var t = v.thresholds, b = {}, rc = (t._recon && typeof t._recon === 'object') ? t._recon : {};
      Object.keys(t).forEach(function (k) { if (k.charAt(0) === '_') return; var x = t[k]; if (x && typeof x === 'object') b[k] = { w: numOrNull(x.w), b: numOrNull(x.b) }; });
      SET.thresholds = { recWarn: numOrNull(t._rec), reconWarn: numOrNull(rc.w), reconBad: numOrNull(rc.b), board: b };
    }
    if (v.baseline && typeof v.baseline === 'object') SET.baseline = { adv: numOrNull(v.baseline.adv), case: numOrNull(v.baseline.case), cost: numOrNull(v.baseline.cost) };
    BASIS = SET.basis === 'accrual' ? 'accrual' : 'cash';
    NET = !!SET.net;
    if (!global.matchMedia || !global.matchMedia('(max-width:600px)').matches) {
      if (SET.vmode === '3d' || SET.vmode === '2d' || SET.vmode === 'both') GLOBAL_VMODE = SET.vmode;
    }
  }
  function prune(o) {
    if (!o || typeof o !== 'object') return o;
    var out = {};
    Object.keys(o).forEach(function (k) {
      var v = o[k];
      if (v == null || v === '') return;
      if (typeof v === 'object') { v = prune(v); if (!Object.keys(v).length) return; }
      out[k] = v;
    });
    return out;
  }
  function thresholdsOut() {
    var t = SET.thresholds || {}, out = {};
    Object.keys(t.board || {}).forEach(function (k) { if (k.charAt(0) !== '_' && k.length <= 32) out[k] = prune({ w: t.board[k].w, b: t.board[k].b }); });
    if (t.recWarn != null) out._rec = t.recWarn;
    out._recon = prune({ w: t.reconWarn, b: t.reconBad });
    return prune(out);
  }
  function settingsRecord() {
    var rec = {
      id: 'settings', entityType: 'ViewState',
      view: VIEW, period: CUR === 12 ? 'last12' : (DS ? DS.months[CUR] : ''), basis: BASIS, net: !!NET, vmode: GLOBAL_VMODE,
      aLines: prune(SET.aLines || {}), cLines: prune(SET.cLines || {}), thresholds: thresholdsOut(), baseline: prune(SET.baseline || {})
    };
    return prune(rec);
  }
  var saveTimer = null;
  function queueSave() { if (!LOADED) return; clearTimeout(saveTimer); saveTimer = setTimeout(function () { saveSettings(); }, 1500); }
  function saveSettings() {
    clearTimeout(saveTimer);
    if (!ME.uid || !DB || !global.PuOntologyWrite) return Promise.reject(new Error('저장 관문이 없습니다'));
    var gw = global.PuOntologyWrite.createGateway({ program: 'datahub', mode: 'enforce', actor: ME.sid || ME.uid });
    var rec = settingsRecord();
    return gw.save(DB.ref('datahub/' + ME.uid + '/settings'), rec, { entityType: 'ViewState' }).catch(function (e) {
      showToast('보기 설정을 저장하지 못했습니다(' + why(e) + ') — 화면은 그대로 씁니다');
      throw e;
    });
  }
  function applyPeriodFromSettings() {
    if (!DS) return;
    if (SET.period === 'last12') CUR = 12;
    else { var i = DS.months.indexOf(SET.period); CUR = i >= 0 ? i : lastIdx(); }
  }

  /* ══ 5. 높이 잣대 ══ */
  var METRIC = {
    inc: { name: '입금액', unit: '만원', fmt: won, axis: man, ok: finOk, why: finWhy },
    task: { name: '수행업무', unit: '건', fmt: function (v) { return n(v) + '건'; }, axis: n, ok: logOk, why: logWhy },
    proc: { name: '입금 처리', unit: '건', fmt: function (v) { return n(v) + '건'; }, axis: n, ok: finOk, why: finWhy }
  };
  function personVal(p, idx) {
    if (idx === 12) { var s = { inc: 0, task: 0, proc: 0 }; p.m.forEach(function (v) { s.inc += v.inc; s.task += v.task; s.proc += v.proc; }); return s; }
    return p.m[idx] || { inc: 0, task: 0, proc: 0 };
  }
  function periodTot(idx) {
    var M = MTOT();
    if (idx === 12) {
      var s = { inc: 0, task: 0, proc: 0, n: 0, cat: {} };
      CATS().forEach(function (c) { s.cat[c.k] = 0; });
      M.forEach(function (t) { s.inc += t.inc; s.task += t.task; s.proc += t.proc; s.n += t.n; CATS().forEach(function (c) { s.cat[c.k] += t.cat[c.k] || 0; }); });
      return s;
    }
    return M[idx] || { inc: 0, task: 0, proc: 0, n: 0, cat: {} };
  }
  function noneVal(idx) {
    if (!DS) return 0;
    if (idx === 12) return DS.NONE.m.reduce(function (s, x) { return s + x.inc; }, 0);
    return (DS.NONE.m[idx] || { inc: 0 }).inc;
  }

  /* ══ 6. 무대 만들기 ══ */
  var SC = {}, CH = {};
  var allState = { metric: 'inc', focus: null, selMonth: 11 }, selected = {};
  var aState = { metric: 'inc', hidden: {}, selMonth: 11 };
  var bMi = 11, bTrail = false, bTimer = null;
  var dHidden = {};
  var eState = { focus: null, misu: false };
  function initScenes() {
    SC.all = new L3.Scene($('cvAll'), { dist: 33.8, target: [0, 0.92, 0], yaw: -0.46, pitch: 0.54 });
    SC.a = new L3.Scene($('cvA'), { dist: 33.4, target: [0, 0.95, 0], yaw: -0.46, pitch: 0.54 });
    SC.b = new L3.Scene($('cvB'), { dist: 30, target: [0, 3.6, 0], yaw: -0.72, pitch: 0.36 });
    SC.c = new L3.Scene($('cvC'), { dist: 28.5, target: [0, 1.5, 0], yaw: -0.42, pitch: 0.58 });
    SC.d = new L3.Scene($('cvD'), { dist: 33.5, target: [0, 1.45, 0], pitch: 0.62, auto: !REDUCE });
    SC.e = new L3.Scene($('cvE'), { dist: 34, target: [0, 0.9, 0], pitch: 0.78, yaw: -0.68 });
    SC.m = new L3.Scene($('cvM'), { dist: 37.5, target: [0, 1.45, 0], yaw: -0.36, pitch: 0.48 });
    var map = { cvAll: SC.all, cvA: SC.a, cvB: SC.b, cvC: SC.c, cvD: SC.d, cvE: SC.e, cvM: SC.m };
    document.querySelectorAll('.ctl[data-for]').forEach(function (box) { var sc = map[box.getAttribute('data-for')]; if (sc && !box.children.length) sc.controls(box); });
    CH.all = new L3.Chart2D($('cvAll2d'), function (c, g) { drawBars2D(c, g, allState); });
    CH.a = new L3.Chart2D($('cvA2d'), function (c, g) { drawBars2D(c, g, aState); });
    CH.b = new L3.Chart2D($('cvB2d'), drawBalls2D);
    CH.c = new L3.Chart2D($('cvC2d'), drawRidges2D);
    CH.d = new L3.Chart2D($('cvD2d'), drawRing2D);
    CH.e = new L3.Chart2D($('cvE2d'), drawCity2D);
    CH.m = new L3.Chart2D($('cvM2d'), drawMulti2D);
    wireSync();
    initGraph();
  }
  function floor(s, x0, z0, x1, z1) { s.under.push({ type: 'quad', floorDeck: true, v: [[x0, 0, z0], [x1, 0, z0], [x1, 0, z1], [x0, 0, z1]], nohit: true }); }

  /* ══ 7-A. 입금 막대 숲 (전체 배치·A안) ══ */
  function buildBars(s, o) {
    var keepPin = s.pin; L3.clear(s); s.pin = keepPin;
    var key = o.metric, M = METRIC[key], mos = MONTHS();
    var ppl = PEOPLE().filter(function (p) { return !(o.hidden && o.hidden[p.id]); });
    var selM = o.selMonth != null ? o.selMonth : 11;
    var ok = M.ok();
    var max = 0; if (ok) ppl.forEach(function (p) { p.m.forEach(function (v) { if (v[key] > max) max = v[key]; }); });
    var nM = Math.max(1, mos.length), nP = Math.max(1, ppl.length);
    var SX = 1.54, SZ = clamp(12.4 / nP, 0.8, 2.06), H = 7.6, x0 = -(nM - 1) / 2 * SX, z0 = -(nP - 1) / 2 * SZ, xe = -x0 + 1.15, ze = -z0 + 1.15;
    floor(s, x0 - 1.2, z0 - 1.2, xe, ze);
    if (selM >= 0 && selM < 12) {
      var sx = x0 + selM * SX;
      s.under.push({ type: 'quad', spotBand: true, v: [[sx - SX * 0.48, 0.008, z0 - 1.15], [sx + SX * 0.48, 0.008, z0 - 1.15], [sx + SX * 0.48, 0.008, ze - 0.05], [sx - SX * 0.48, 0.008, ze - 0.05]], nohit: true });
    }
    for (var m = 0; m < nM; m++) s.under.push({ type: 'line', a: [x0 + m * SX, 0, z0 - 1.15], b: [x0 + m * SX, 0, ze] });
    if (max > 0) [0.5, 1].forEach(function (f) {
      s.under.push({ type: 'line', wall: true, a: [x0 - 1.2, H * f, ze], b: [xe, H * f, ze], dash: [4, 4], grow: true });
      s.under.push({ type: 'line', wall: true, a: [x0 - 1.2, 0, ze], b: [x0 - 1.2, H * f, ze], grow: true });
      s.labels.push({ p: [x0 - 1.45, H * f, ze], t: M.fmt(max * f), al: 'right', c: '#475569', darkC: '#cbd5e1', sz: 10.5, grow: true, pill: true });
    });
    ppl.forEach(function (p, i) {
      var z = z0 + (nP - 1 - i) * SZ;
      if (ok && max > 0) p.m.forEach(function (v, mi) {
        if (!(v[key] > 0)) return;            /* 0 은 막대를 세우지 않는다 — 바닥만 보인다 */
        var id = p.id + '|' + mi, targetH = Math.max(0.04, v[key] / max * H), prevH = s.prevHeights[id];
        s.items.push({
          type: 'box', id: id, pid: p.id, mi: mi, x: x0 + mi * SX, z: z, w: SX * 0.58, d: SZ * 0.50, y0: 0,
          h: targetH, curH: (prevH != null && !REDUCE ? prevH : targetH), color: p.color, spot: (selM === mi),
          fade: !!(o.focus && !o.focus[p.id]),
          tip: '<b>' + esc(p.name) + '</b> · ' + esc(mos[mi]) + '<br>' + ['inc', 'task', 'proc'].map(function (k) { var t = METRIC[k].name + ' ' + (METRIC[k].ok() ? METRIC[k].fmt(v[k]) : '못 읽음'); return k === key ? '<b>' + t + '</b>' : t; }).join(' · ')
        });
      });
      s.labels.push({ p: [x0 - 1.55, 0.12, z], t: '  ' + p.name, short: ' ' + p.name, al: 'right', c: p.color, dotCol: p.color, wt: 750, bg: 'rgba(255,255,255,.90)' });
    });
    mos.forEach(function (lb, mi) {
      var isSel = (selM === mi);
      s.labels.push({ p: [x0 + mi * SX, 0, z0 - 1.82], t: lb, c: isSel ? '#1e40af' : '#475569', darkC: isSel ? '#ffffff' : '#cbd5e1', wt: isSel ? 800 : 600, sz: isSel ? 11 : 10.5, accentPill: isSel, bg: isSel ? '#eff6ff' : null, forceShow: isSel });
    });
    var badgeM = (selM >= 0 && selM < 12) ? selM : 11;
    if (mos.length) s.labels.push({ p: [x0 + badgeM * SX, 0.2, ze + 0.78], t: (selM === 12 ? '12개월 전체' : (badgeM === 11 ? '이번 달(' + mos[11] + ')' : mos[badgeM] + ' 고름')), c: '#1e40af', wt: 800, bg: '#eff6ff', accentPill: true, forceShow: true });
    return !ok ? M.why() : (!ppl.length ? '보일 사람이 없습니다 — 명부(재직자)나 «사람» 칩을 확인하세요' : (max <= 0 ? '이 12개월 ' + M.name + ' 자료가 없습니다' : ''));
  }
  function drawBars2D(c, g, o) {
    var W = c.w, H = c.h, padL = 54, padR = 16, padT = 62, padB = 38;
    var pw = Math.max(40, W - padL - padR), ph = Math.max(40, H - padT - padB);
    var key = o.metric, M = METRIC[key], mos = MONTHS(), mko = MONTH_KO();
    if (!M.ok() || !mos.length) return;
    var ppl = PEOPLE().filter(function (p) { return !(o.hidden && o.hidden[p.id]); });
    var selM = o.selMonth != null ? o.selMonth : 11;
    var mSums = mos.map(function (_, mi) { var s = 0; ppl.forEach(function (p) { s += p.m[mi][key]; }); return s; });
    var goal = (key === 'inc') ? aGoal() : null;
    var maxS = Math.max(1, Math.max.apply(null, mSums.concat(goal ? [goal * 1e4] : [])) * 1.17);
    var gridCol = ST.dark ? 'rgba(148,163,184,.20)' : 'rgba(203,213,225,.70)', txtCol = ST.dark ? '#cbd5e1' : '#475569';
    g.font = '600 11px Pretendard,"Malgun Gothic",sans-serif';
    for (var gi = 0; gi <= 4; gi++) {
      var gy = padT + ph - (gi / 4) * ph, gv = maxS * (gi / 4);
      g.strokeStyle = gridCol; g.lineWidth = 1; g.beginPath(); g.moveTo(padL, gy); g.lineTo(padL + pw, gy); g.stroke();
      g.fillStyle = txtCol; g.textAlign = 'right'; g.textBaseline = 'middle'; g.fillText(M.axis(gv), padL - 7, gy);
    }
    g.fillStyle = txtCol; g.textAlign = 'left'; g.fillText('단위: ' + M.unit, padL, padT - 12);
    var stepX = pw / 12, bw = Math.min(32, stepX * 0.60), maPts = [];
    mos.forEach(function (lb, mi) {
      var cx = padL + stepX * (mi + 0.5), x0 = cx - bw / 2, yCur = padT + ph;
      if (selM === mi) { g.fillStyle = ST.dark ? 'rgba(96,165,250,.14)' : 'rgba(37,99,235,.07)'; g.fillRect(cx - stepX * 0.46, padT, stepX * 0.92, ph); }
      for (var pi = ppl.length - 1; pi >= 0; pi--) {
        var p = ppl[pi], val = p.m[mi][key], bh = (val / maxS) * ph;
        if (bh < 0.6) continue;
        var id = p.id + '|' + mi, isHot = (c.hot === id || c.pin === id), fade = !!(o.focus && !o.focus[p.id]);
        var rgb = hex2rgb(p.color); if (ST.dark) rgb = shade(rgb, 0.18);
        g.fillStyle = rgba(isHot ? shade(rgb, 0.28) : rgb, fade ? 0.20 : 0.94); g.fillRect(x0, yCur - bh, bw, bh);
        g.strokeStyle = isHot ? '#fbbf24' : (ST.dark ? 'rgba(30,41,59,.65)' : '#ffffff'); g.lineWidth = isHot ? 2.2 : 0.8; g.strokeRect(x0, yCur - bh, bw, bh);
        c.hits.push({ id: id, pid: p.id, mi: mi, rect: [x0, yCur - bh, bw, bh], tip: '<b>' + esc(p.name) + '</b> · ' + esc(lb) + ' (2D)<br>' + M.name + ' <b>' + M.fmt(val) + '</b> · 달 합계 ' + M.fmt(mSums[mi]) });
        yCur -= bh;
      }
      if (W > 420 && mSums[mi] > 0) {
        g.font = '700 10.5px Pretendard,"Malgun Gothic",sans-serif'; g.fillStyle = selM === mi ? (ST.dark ? '#bfdbfe' : '#1e40af') : txtCol;
        g.textAlign = 'center'; g.textBaseline = 'bottom'; g.fillText(M.axis(mSums[mi]), cx, yCur - 3);
      }
      g.font = (selM === mi ? '800 ' : '600 ') + (W < 400 ? '10px' : '11px') + ' Pretendard,"Malgun Gothic",sans-serif';
      g.fillStyle = selM === mi ? (ST.dark ? '#ffffff' : '#1e40af') : txtCol; g.textAlign = 'center'; g.textBaseline = 'top';
      g.fillText(W < 400 ? lb.slice(3) : lb, cx, padT + ph + 9);
      c.hits.push({ id: 'm|' + mi, mi: mi, rect: [cx - stepX * 0.45, padT + ph, stepX * 0.9, 28], tip: '<b>' + esc(mko[mi]) + '</b> 고르기<br>합계 ' + M.fmt(mSums[mi]) });
      var cnt = 0, sum3 = 0; for (var k = Math.max(0, mi - 2); k <= mi; k++) { sum3 += mSums[k]; cnt++; }
      maPts.push([cx, padT + ph - (sum3 / cnt / maxS) * ph]);
    });
    if (maPts.length > 1) {
      strokeSpline2D(g, maPts, ST.dark ? '#fde68a' : '#d97706', 2.4, ST.dark ? 'rgba(251,191,36,.26)' : 'rgba(217,119,6,.16)');
      maPts.forEach(function (pt) { g.fillStyle = ST.dark ? '#fbbf24' : '#d97706'; g.beginPath(); g.arc(pt[0], pt[1], 3.5, 0, 6.2832); g.fill(); g.fillStyle = '#ffffff'; g.beginPath(); g.arc(pt[0], pt[1], 1.4, 0, 6.2832); g.fill(); });
      g.font = '700 11px Pretendard,"Malgun Gothic",sans-serif'; g.fillStyle = ST.dark ? '#fde68a' : '#854d0e'; g.textAlign = 'right'; g.textBaseline = 'middle';
      g.fillText('━ 3개월 이동평균', padL + pw - 72, padT - 12);
    }
    /* A안 달 입금 기준선 — 대표가 정했을 때만(기준 정하기) */
    if (goal) {
      var yg = padT + ph - (goal * 1e4 / maxS) * ph;
      g.save(); g.setLineDash([6, 4]); g.strokeStyle = ST.dark ? '#bfdbfe' : '#1e40af'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(padL, yg); g.lineTo(padL + pw, yg); g.stroke(); g.restore();
      g.font = '700 10.5px Pretendard,"Malgun Gothic",sans-serif'; g.fillStyle = ST.dark ? '#bfdbfe' : '#1e40af'; g.textAlign = 'left'; g.textBaseline = 'bottom';
      g.fillText('기준선 ' + n(goal) + '만원', padL + 4, yg - 2);
    }
  }

  /* ══ 7-B. 사람 구슬 ══ */
  var BMAX = { task: 1, inc: 1, proc: 1 };
  function refreshBMax() { BMAX = { task: 1, inc: 1, proc: 1 }; PEOPLE().forEach(function (p) { p.m.forEach(function (v) { for (var k in BMAX) if (v[k] > BMAX[k]) BMAX[k] = v[k]; }); }); }
  function bPos(v) { return [-8 + v.task / BMAX.task * 16, 0.55 + (finOk() ? v.inc / BMAX.inc : 0) * 8.5, -6 + (finOk() ? v.proc / BMAX.proc : 0) * 12]; }
  function bTip(p, mi) {
    var v = p.m[mi];
    return '<b>' + esc(p.name) + '</b> (' + esc(p.kind) + ') · ' + esc(MONTHS()[mi]) + '<br>수행업무 ' + (logOk() ? v.task + '건' : '못 읽음') + ' · 입금 기여 ' + (finOk() ? won(v.inc) : '못 읽음') +
      '<br>입금 처리 ' + (finOk() ? v.proc + '건' : '못 읽음') + ' · 맡은 업체 ' + p.cos + '곳 · 기록률 ' + (p.recRate == null ? '—' : p.recRate + '%');
  }
  function buildBalls(s, mi, trail) {
    var keepPin = s.pin; L3.clear(s); s.pin = keepPin;
    floor(s, -8.8, -6.8, 8.8, 6.8);
    for (var i = -8; i <= 8; i += 4) s.under.push({ type: 'line', a: [i, 0, -6.8], b: [i, 0, 6.8] });
    for (var j = -6; j <= 6; j += 4) s.under.push({ type: 'line', a: [-8.8, 0, j], b: [8.8, 0, j] });
    s.under.push({ type: 'line', wall: true, a: [-8.8, 0, 6.8], b: [-8.8, 9.5, 6.8], lw: 1.5 });
    s.labels.push({ p: [0, 0, -7.8], t: '수행업무 → (많을수록 오른쪽)', c: '#475569', wt: 750, pill: true });
    s.labels.push({ p: [-8.9, 9.8, 6.8], t: '↑ 입금 기여', c: '#166534', darkC: '#4ade80', wt: 800, al: 'left', pill: true });
    s.labels.push({ p: [9.5, 0, 0], t: '입금 처리 →', c: '#475569', wt: 750, al: 'left', pill: true });
    var ppl = PEOPLE();
    if (trail) ppl.forEach(function (p) {
      var crv = smoothPts3D(p.m.map(bPos), 4);
      s.under.push({ type: 'poly', pts: crv, c: rgba(shade(hex2rgb(p.color), ST.dark ? 0.25 : 0), ST.dark ? 0.62 : 0.42), lw: 2.0, grow: true });
    });
    ppl.forEach(function (p) {
      var it = { type: 'ball', id: p.id, pid: p.id, p: bPos(p.m[mi]), r: 0.34 + Math.sqrt(p.cos) * 0.105, color: p.color, tip: bTip(p, mi) };
      s.items.push(it);
      s.labels.push({ p: [it.p[0], it.p[1] + it.r + 0.62, it.p[2]], t: '  ' + p.name, short: ' ' + p.name, c: p.color, dotCol: p.color, wt: 750, sz: 11, grow: true, ball: it, bg: 'rgba(255,255,255,.90)' });
    });
    return ppl.length ? (!finOk() ? finWhy() + ' — 입금 축은 바닥에 둡니다' : '') : '보일 사람이 없습니다';
  }
  function moveBalls(s, mi) {
    var from = {}, to = {};
    s.items.forEach(function (it) { var p = personById(it.id); if (!p) return; from[it.id] = it.p.slice(); to[it.id] = bPos(p.m[mi]); it.tip = bTip(p, mi); });
    var t0 = null, ms = REDUCE ? 1 : 620;
    s.tween = function (t) {
      if (t0 == null) t0 = t; var k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3);
      s.items.forEach(function (it) { var a = from[it.id], b = to[it.id]; if (a && b) it.p = [a[0] + (b[0] - a[0]) * e, a[1] + (b[1] - a[1]) * e, a[2] + (b[2] - a[2]) * e]; });
      s.labels.forEach(function (l) { if (l.ball) l.p = [l.ball.p[0], l.ball.p[1] + l.ball.r + 0.62, l.ball.p[2]]; });
      return k < 1;
    };
  }
  function drawBalls2D(c, g) {
    var ppl = PEOPLE(); if (!ppl.length) return;
    var W = c.w, H = c.h, padL = 58, padR = 24, padT = 62, padB = 40;
    var pw = Math.max(40, W - padL - padR), ph = Math.max(40, H - padT - padB);
    var txtCol = ST.dark ? '#cbd5e1' : '#475569', gridCol = ST.dark ? 'rgba(148,163,184,.20)' : 'rgba(203,213,225,.70)';
    var maxX = Math.max(10, BMAX.task * 1.12), maxY = Math.max(1e5, BMAX.inc * 1.12), FO = finOk();
    for (var i = 0; i <= 4; i++) {
      var gy = padT + ph - (i / 4) * ph, gx = padL + (i / 4) * pw;
      g.strokeStyle = gridCol; g.lineWidth = 1;
      g.beginPath(); g.moveTo(padL, gy); g.lineTo(padL + pw, gy); g.stroke();
      g.beginPath(); g.moveTo(gx, padT); g.lineTo(gx, padT + ph); g.stroke();
      g.font = '600 10.5px Pretendard,"Malgun Gothic",sans-serif'; g.fillStyle = txtCol;
      if (FO) { g.textAlign = 'right'; g.textBaseline = 'middle'; g.fillText(man(maxY * i / 4), padL - 7, gy); }
      g.textAlign = 'center'; g.textBaseline = 'top'; g.fillText(n(maxX * i / 4) + '건', gx, padT + ph + 9);
    }
    var avgT = 0, avgI = 0; ppl.forEach(function (p) { avgT += p.m[bMi].task; avgI += p.m[bMi].inc; });
    avgT /= ppl.length; avgI /= ppl.length;
    var ax = padL + (avgT / maxX) * pw, ay = padT + ph - (FO ? (avgI / maxY) : 0) * ph;
    g.strokeStyle = ST.dark ? 'rgba(96,165,250,.45)' : 'rgba(37,99,235,.40)'; g.setLineDash([5, 4]); g.lineWidth = 1.3;
    g.beginPath(); g.moveTo(ax, padT); g.lineTo(ax, padT + ph); if (FO) { g.moveTo(padL, ay); g.lineTo(padL + pw, ay); } g.stroke(); g.setLineDash([]);
    g.font = '700 11px Pretendard,"Malgun Gothic",sans-serif'; g.fillStyle = txtCol; g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillText((FO ? '↑ 입금 기여(만원)' : '입금 못 읽음 — 세로축 없음') + ' · ' + (MONTHS()[bMi] || ''), padL, padT - 14);
    if (bTrail) ppl.forEach(function (p) {
      var rgb = hex2rgb(p.color); if (ST.dark) rgb = shade(rgb, 0.25);
      g.strokeStyle = rgba(rgb, 0.45); g.lineWidth = 1.6; g.beginPath();
      p.m.forEach(function (v, idx) { var px = padL + (v.task / maxX) * pw, py = padT + ph - (FO ? v.inc / maxY : 0) * ph; if (idx === 0) g.moveTo(px, py); else g.lineTo(px, py); });
      g.stroke();
    });
    /* 원과 이름표를 따로 그린다 (대표 2026-11-22 「2D 가 빡빡하게 붙어 확인이 안 된다」)
       ① 원 둘레(열 방향 × 세 거리)에서 — 원·다른 이름·가로축 숫자·이미 그은 잇는 선과 겹치지 않고, 멀리 둘 때 잇는 선이 다른 원·이름을 가로지르지 않는 자리
       ② 없으면 그림 오른쪽·왼쪽 가장자리 줄(같은 조건)
       ③ 그래도 없으면 이름을 생략한다(원에 올려 보면 이름) — 엉뚱한 원을 가리키는 선보다 생략이 낫다. 좁은 화면에서는 원도 함께 줄인다 */
    var rs = Math.max(0.6, Math.min(1, pw / 420));
    var pts = ppl.map(function (p) {
      var v = p.m[bMi];
      return { p: p, v: v, x: padL + (v.task / maxX) * pw, y: padT + ph - (FO ? v.inc / maxY : 0) * ph, r: (8 + Math.sqrt(p.cos) * 3.2) * rs, hot: (c.hot === p.id || c.pin === p.id) };
    });
    pts.forEach(function (o) {
      var p = o.p, v = o.v, px = o.x, py = o.y, r = o.r, isHot = o.hot;
      var rgb = hex2rgb(p.color); if (ST.dark) rgb = shade(rgb, 0.18);
      if (FO && v.proc > 0) { var ang = (v.proc / Math.max(1, BMAX.proc)) * Math.PI * 2; g.strokeStyle = ST.dark ? '#4ade80' : '#16a34a'; g.lineWidth = 3.2 * rs; g.beginPath(); g.arc(px, py, r + 4 * rs, -Math.PI / 2, -Math.PI / 2 + ang); g.stroke(); }
      g.fillStyle = rgba(rgb, isHot ? 1 : 0.88); g.beginPath(); g.arc(px, py, r, 0, 6.2832); g.fill();
      g.strokeStyle = isHot ? '#fbbf24' : '#ffffff'; g.lineWidth = isHot ? 2.6 : 1.2; g.stroke();
      c.hits.push({ id: p.id, pid: p.id, circle: [px, py, r + 5], tip: '<b>' + esc(p.name) + '</b> (' + esc(MONTHS()[bMi]) + ' · 2D 사분면)<br>업무 ' + v.task + '건 · 입금 ' + (FO ? won(v.inc) : '못 읽음') + ' · 입금처리 ' + (FO ? v.proc + '건' : '—') });
      o.ro = (FO && v.proc > 0) ? r + 4 * rs + 2 * rs : r;   /* 초록 고리를 그렸으면 그 바깥까지 */
      o.box = [px - o.ro - 2, py - o.ro - 2, o.ro * 2 + 4, o.ro * 2 + 4];
    });
    /* 피할 것: 원 상자 · 가로축 숫자(0건·19건 …) · 놓은 이름 · 그은 잇는 선 */
    var ob = { boxes: pts.map(function (o) { return o.box; }), labs: [], lines: [] };
    g.font = '600 10.5px Pretendard,"Malgun Gothic",sans-serif';
    for (var ti = 0; ti <= 4; ti++) { var tt = n(maxX * ti / 4) + '건', tw = g.measureText(tt).width, tb = [padL + (ti / 4) * pw - tw / 2 - 2, padT + ph + 7, tw + 4, 16]; ob.boxes.push(tb); ob.labs.push(tb); }
    g.font = '750 11.5px Pretendard,"Malgun Gothic",sans-serif';
    var lineCol = ST.dark ? 'rgba(203,213,225,.55)' : 'rgba(71,85,105,.45)', nameCol = ST.dark ? '#f8fafc' : '#1e293b';
    function put(o, s) {
      ob.boxes.push(s.box); ob.labs.push(s.box);
      if (s.far) {
        var a = leadFrom(o, s.lx, s.ly); ob.lines.push([a[0], a[1], s.lx, s.ly]);
        g.strokeStyle = lineCol; g.lineWidth = 1; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(s.lx, s.ly); g.stroke();
      }
      g.fillStyle = nameCol; g.textAlign = s.al; g.textBaseline = s.tb; g.fillText(o.p.name, s.tx, s.ty);
    }
    var order = pts.slice().sort(function (a, b) { return (b.hot ? 1 : 0) - (a.hot ? 1 : 0) || b.r - a.r; }), rest = [], hidden = 0;
    order.forEach(function (o) {
      var s = labelSpot(g, o, ob, [padL + 2, padT - 2, W - 2, H - 2], pts);   /* 왼쪽 세로축 숫자 자리로는 내보내지 않는다 */
      if (s) put(o, s); else rest.push(o);
    });
    rest.sort(function (a, b) { return a.y - b.y; }).forEach(function (o) {
      var s = edgeSpot(g, o, ob, padL + 4, W - 6, padT + 8, padT + ph - 2, pts);
      if (s) put(o, s); else hidden++;
    });
    if (hidden) {
      /* 머리 줄 오른쪽 — 왼쪽 머리 글(↑ 입금 기여 …)과 안 겹치는 가장 긴 문구 */
      g.font = '700 11px Pretendard,"Malgun Gothic",sans-serif';
      var headW = g.measureText((FO ? '↑ 입금 기여(만원)' : '입금 못 읽음 — 세로축 없음') + ' · ' + (MONTHS()[bMi] || '')).width;
      g.font = '600 10.5px Pretendard,"Malgun Gothic",sans-serif';
      var notes = ['이름 생략 ' + hidden + '명 — 원에 올려 보면 이름', '이름 생략 ' + hidden + '명', '생략 ' + hidden];
      var note = notes.filter(function (t) { return headW + 12 + g.measureText(t).width <= pw; })[0];
      if (note) { g.fillStyle = txtCol; g.textAlign = 'right'; g.textBaseline = 'middle'; g.fillText(note, padL + pw, padT - 14); }
    }
  }
  /* 잇는 선은 원 테두리에서 시작한다 */
  function leadFrom(o, lx, ly) { var dx = lx - o.x, dy = ly - o.y, d = Math.sqrt(dx * dx + dy * dy) || 1, R = (o.ro || o.r) + 2; return [o.x + dx / d * R, o.y + dy / d * R]; }
  /* 선분이 상자(안쪽 1px)를 지나가나 — 리앙–바스키 자르기로 정확히(모서리만 스치는 것도 잡는다) */
  function segHitsBox(x1, y1, x2, y2, b) {
    var dx = x2 - x1, dy = y2 - y1, t0 = 0, t1 = 1;
    var p = [-dx, dx, -dy, dy], q = [x1 - (b[0] + 1), (b[0] + b[2] - 1) - x1, y1 - (b[1] + 1), (b[1] + b[3] - 1) - y1];
    for (var i = 0; i < 4; i++) {
      if (p[i] === 0) { if (q[i] < 0) return false; continue; }
      var t = q[i] / p[i];
      if (p[i] < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; }
    }
    return t0 <= t1;
  }
  /* 원 o 에서 (lx,ly) 로 잇는 선이 다른 원이나 이름(·축 숫자)을 지나가나 */
  function lineCrosses(o, lx, ly, pts, labs) {
    var a = leadFrom(o, lx, ly), x = a[0], y = a[1], dx = lx - x, dy = ly - y, L = dx * dx + dy * dy || 1;
    for (var i = 0; i < (pts || []).length; i++) {
      var q = pts[i]; if (q === o) continue;
      var t = Math.max(0, Math.min(1, ((q.x - x) * dx + (q.y - y) * dy) / L)), cx = x + t * dx - q.x, cy = y + t * dy - q.y, R = (q.ro || q.r) + 1;
      if (cx * cx + cy * cy < R * R) return true;
    }
    for (var j = 0; j < (labs || []).length; j++) if (segHitsBox(x, y, lx, ly, labs[j])) return true;
    return false;
  }
  /* 이름 상자가 테두리 안이고, 다른 상자·그은 선과 안 겹치나 (own = 제 원 상자는 빼고) */
  function boxFree(box, ob, bound, own) {
    if (box[0] < bound[0] || box[1] < bound[1] || box[0] + box[2] > bound[2] || box[1] + box[3] > bound[3]) return false;
    for (var bi = 0; bi < ob.boxes.length; bi++) {
      var b = ob.boxes[bi];
      if (b === own) continue;
      if (box[0] < b[0] + b[2] && box[0] + box[2] > b[0] && box[1] < b[1] + b[3] && box[1] + box[3] > b[1]) return false;
    }
    for (var li = 0; li < ob.lines.length; li++) { var s = ob.lines[li]; if (segHitsBox(s[0], s[1], s[2], s[3], box)) return false; }
    return true;
  }
  /* 이름표 자리 — 원 둘레 열 방향 × 세 거리 */
  function labelSpot(g, o, ob, bound, pts) {
    var w = g.measureText(o.p.name).width, h = 14;
    var dirs = [[0, -1], [0, 1], [1, 0], [-1, 0], [0.75, -0.75], [-0.75, -0.75], [0.75, 0.75], [-0.75, 0.75], [0.4, -0.92], [-0.4, -0.92]];
    var R0 = o.ro || o.r, dists = [R0 + 5, R0 + 26, R0 + 48];
    for (var di = 0; di < dists.length; di++) {
      for (var k = 0; k < dirs.length; k++) {
        var ux = dirs[k][0], uy = dirs[k][1], lx = o.x + ux * dists[di], ly = o.y + uy * dists[di];
        var al = ux > 0.1 ? 'left' : (ux < -0.1 ? 'right' : 'center'), tb = uy < -0.1 ? 'bottom' : (uy > 0.1 ? 'top' : 'middle');
        var bx = al === 'left' ? lx : (al === 'right' ? lx - w : lx - w / 2), by = tb === 'bottom' ? ly - h : (tb === 'top' ? ly : ly - h / 2);
        var box = [bx - 2, by - 1, w + 4, h + 2];
        if (!boxFree(box, ob, bound, o.box)) continue;
        if (di > 0 && lineCrosses(o, lx, ly, pts, ob.labs)) continue;
        return { tx: lx, ty: ly, al: al, tb: tb, box: box, far: di > 0, lx: lx, ly: ly };
      }
    }
    return null;
  }
  /* 가장자리 줄 — 원과 가까운 쪽 가장자리부터, 원 높이에서 위아래로 16px 씩 비켜 가며 */
  function edgeSpot(g, o, ob, xl, xr, top, bot, pts) {
    var w = g.measureText(o.p.name).width, sides = (o.x > (xl + xr) / 2) ? ['r', 'l'] : ['l', 'r'];
    for (var k = 0; k < 40; k++) {
      var y = o.y + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 16;
      if (y < top || y > bot) continue;
      for (var si = 0; si < 2; si++) {
        var right = sides[si] === 'r', box = right ? [xr - w - 2, y - 8, w + 4, 16] : [xl - 2, y - 8, w + 4, 16];
        if (!boxFree(box, ob, [xl - 3, top - 9, xr + 3, bot + 9], null)) continue;
        var lx = right ? xr - w - 4 : xl + w + 4;
        if (lineCrosses(o, lx, y, pts, ob.labs)) continue;
        return { tx: right ? xr : xl, ty: y, al: right ? 'right' : 'left', tb: 'middle', box: box, far: true, lx: lx, ly: y };
      }
    }
    return null;
  }

  /* ══ 7-C. 업무량 산맥 (업무 기록 건수 — 근태 시간은 근태 자료 연결 전) ══ */
  function loadRgb(v, lines, vmax) {
    var cOk = hex2rgb(ST.dark ? '#4ade80' : '#16a34a');
    /* 기준을 정하지 않았으면 초록 짙고 옅음만 — 노랑·빨강을 칠하지 않는다 */
    if (!lines.length) return mixRgb(shade(cOk, -0.32), cOk, clamp(v / Math.max(1, vmax), 0, 1));
    var cMid = hex2rgb('#fbbf24'), cHi = hex2rgb(ST.dark ? '#f87171' : '#dc2626');
    var top = lines[lines.length - 1], first = lines[0];
    if (lines.length >= 2 && v >= top.v) return cHi;
    if (v >= first.v) {
      if (lines.length === 1) return first.c === '#dc2626' ? cHi : cMid;
      var t = clamp((v - first.v) / Math.max(1, top.v - first.v), 0, 1); return mixRgb(cMid, cHi, t * 0.75);
    }
    return mixRgb(shade(cOk, -0.18), cOk, clamp(v / Math.max(1, first.v), 0, 1));
  }
  function wkMax() { var m = 1; PEOPLE().forEach(function (p) { p.wkN.forEach(function (v) { if (v > m) m = v; }); }); return m; }
  function wkLabel(wi, nW) { return wi === nW - 1 ? '이번 주' : (nW - 1 - wi) + '주 전'; }
  function buildRidges(s) {
    var keepPin = s.pin; L3.clear(s); s.pin = keepPin;
    var ppl = PEOPLE(), lines = cLines(), vmax = wkMax();
    var W = DS ? DS.weeks.length : 26, SUB = 3, STEPS = (W - 1) * SUB, SX = 0.63, nP = Math.max(1, ppl.length), SZ = clamp(10.7 / nP, 0.6, 1.78), H = 6.6, D = Math.min(0.76, SZ * 0.45);
    var x0 = -(W - 1) / 2 * SX, xe = -x0, z0 = -(nP - 1) / 2 * SZ, ze = -z0;
    var cap = Math.max(vmax, lines.length ? lines[lines.length - 1].v * 1.25 : 0, 4);
    var sc = function (v) { return Math.min(v, cap) / cap * H; };
    floor(s, x0 - 1.1, z0 - 1.2, xe + 1.1, ze + 1.2);
    if (!logOk()) return logWhy();
    ppl.forEach(function (p, i) {
      var z = z0 + i * SZ, za = z - D / 2, zb = z + D / 2, arr = p.wkN, crest = [];
      for (var st = 0; st < STEPS; st++) {
        var u0 = st / SUB, u1 = (st + 1) / SUB, wIdx = Math.min(W - 2, Math.floor(u0));
        var v0 = sampleSmooth1D(arr, u0), v1 = sampleSmooth1D(arr, u1);
        var xa = x0 + u0 * SX, xb = x0 + u1 * SX, ya = sc(v0), yb = sc(v1), lv = Math.max(v0, v1);
        var col = loadRgb(lv, lines, vmax);
        var tip = '<b>' + esc(p.name) + '</b> · ' + wkLabel(wIdx, W) + ' → ' + wkLabel(wIdx + 1, W) + '<br>업무 기록 ' + arr[wIdx] + '건 → ' + arr[wIdx + 1] + '건 (기록률 ' + (p.recRate == null ? '—' : p.recRate + '%') + ')';
        var id = p.id + '|' + wIdx;
        s.items.push({ type: 'quad', id: id, pid: p.id, wi: wIdx, v: [[xa, ya, za], [xb, yb, za], [xb, yb, zb], [xa, ya, zb]], fill: rgba(shade(col, 0.16), 0.96), stroke: rgba(shade(col, 0.28), 0.22), lw: 0.4, tip: tip });
        s.items.push({ type: 'quad', id: id, pid: p.id, wi: wIdx, v: [[xa, 0, za], [xb, 0, za], [xb, yb, za], [xa, ya, za]], fill: rgba(shade(col, -0.32), 0.90), tip: tip });
        s.items.push({ type: 'quad', id: id, pid: p.id, wi: wIdx, v: [[xa, 0, zb], [xb, 0, zb], [xb, yb, zb], [xa, ya, zb]], fill: rgba(shade(col, -0.18), 0.92), tip: tip });
        if (st === 0) crest.push([xa, ya + 0.03, z]);
        crest.push([xb, yb + 0.03, z]);
      }
      s.over.push({ type: 'poly', pts: crest, c: 'rgba(255,255,255,.55)', lw: 1.3, grow: true });
      s.labels.push({ p: [x0 - 1.45, 0.12, z], t: '  ' + p.name, short: ' ' + p.name, al: 'right', c: p.color, dotCol: p.color, wt: 750, bg: 'rgba(255,255,255,.90)' });
    });
    lines.forEach(function (L) {
      var y = sc(L.v);
      s.over.push({ type: 'line', a: [x0 - 0.6, y, ze + 0.95], b: [xe + 0.6, y, ze + 0.95], c: L.c, dash: [6, 4], lw: 1.8, grow: true });
      s.over.push({ type: 'line', a: [x0 - 0.6, y, z0 - 0.95], b: [x0 - 0.6, y, ze + 0.95], c: L.c, dash: [6, 4], lw: 1.3, grow: true });
      s.labels.push({ p: [xe + 0.9, y, ze + 0.95], t: L.t, c: (L.c === '#d97706' ? '#854d0e' : '#991b1b'), darkC: (L.c === '#d97706' ? '#fde68a' : '#fecaca'), wt: 800, al: 'left', grow: true, bg: 'rgba(255,255,255,.90)' });
    });
    s.labels.push({ p: [x0, 0, z0 - 1.85], t: (W - 1) + '주 전', c: '#475569', sz: 10.5, pill: true });
    s.labels.push({ p: [xe, 0, z0 - 1.85], t: '이번 주', c: '#1e40af', wt: 800, bg: '#eff6ff', accentPill: true });
    return ppl.length ? '' : '보일 사람이 없습니다';
  }
  function cNoteText() {
    var lines = cLines();
    return '자료: 업무관리 주간기록(work_erp/logs 의 by=사번)을 사람·주별로 센 것 — 업무관리에는 «소요시간» 칸이 없어 시간이 아니라 «기록 건수»입니다. ' +
      (lines.length ? '기준선(' + lines.map(function (l) { return l.t; }).join(' · ') + ')은 대표가 «기준 정하기»에서 정한 값입니다. ' : '«많음·넘침» 기준을 아직 정하지 않아 노랑·빨강을 칠하지 않았습니다(«기준 정하기»에서 정함). ') +
      '업무 기록을 빠뜨린 주는 낮게 보이므로 «기록률»을 함께 봅니다. 근태 기준 근로시간(눈대중)은 근태 자료(data/attendance_records)를 아직 잇지 않아 회색입니다.' +
      (SRC.logs && SRC.logs.part ? ' ⚠ ' + SRC.logs.part + '.' : '');
  }
  function drawRidges2D(c, g) {
    var ppl = PEOPLE(); if (!ppl.length || !logOk() || !DS) return;
    var lines = cLines(), vmax = wkMax(), nW = DS.weeks.length;
    var W = c.w, H = c.h, padL = 76, padR = 16, padT = 62, padB = 38;
    var pw = Math.max(40, W - padL - padR), ph = Math.max(40, H - padT - padB);
    var cw = pw / nW, ch = ph / ppl.length, txtCol = ST.dark ? '#cbd5e1' : '#475569';
    g.font = '700 11px Pretendard,"Malgun Gothic",sans-serif'; g.fillStyle = txtCol; g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillText('업무 기록 건수 ' + nW + '주 히트맵' + (lines.length ? ' (' + lines.map(function (l) { return l.t; }).join(' · ') + ')' : ' (기준 미설정 — 짙을수록 많음)'), padL, padT - 14);
    ppl.forEach(function (p, ri) {
      var y = padT + ri * ch, arr = p.wkN;
      g.font = '700 11.5px Pretendard,"Malgun Gothic",sans-serif'; g.fillStyle = ST.dark ? '#f8fafc' : '#1e293b'; g.textAlign = 'right'; g.textBaseline = 'middle';
      g.fillText(fitText(g, p.name, padL - 12), padL - 8, y + ch * 0.5);
      for (var wi = 0; wi < nW; wi++) {
        var v = arr[wi], x = padL + wi * cw, mapW = Math.min(nW - 2, wi);
        var id = p.id + '|' + mapW, isHot = (c.hot === id || c.pin === id);
        g.fillStyle = rgba(loadRgb(v, lines, vmax), isHot ? 1 : (ST.dark ? 0.84 : 0.82));
        g.fillRect(x + 1, y + 2, Math.max(2, cw - 2), Math.max(4, ch - 4));
        if (isHot) { g.strokeStyle = ST.dark ? '#ffffff' : '#1e293b'; g.lineWidth = 2.2; g.strokeRect(x + 1, y + 2, Math.max(2, cw - 2), Math.max(4, ch - 4)); }
        if (cw >= 20 && ch >= 24) { g.font = '700 10px Pretendard,"Malgun Gothic",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; haloText(g, String(v), x + cw * 0.5, y + ch * 0.5); }
        c.hits.push({ id: id, pid: p.id, wi: mapW, rect: [x, y, cw, ch], tip: '<b>' + esc(p.name) + '</b> · ' + wkLabel(wi, nW) + ' (2D)<br>업무 기록 <b>' + v + '건</b> · 기록률 ' + (p.recRate == null ? '—' : p.recRate + '%') });
      }
    });
    [0, Math.round(nW / 4), Math.round(nW / 2), Math.round(nW * 3 / 4), nW - 1].forEach(function (wi) {
      g.font = '600 10.5px Pretendard,"Malgun Gothic",sans-serif'; g.fillStyle = txtCol; g.textAlign = 'center'; g.textBaseline = 'top';
      g.fillText(wi === nW - 1 ? '이번 주' : '-' + (nW - 1 - wi) + '주', padL + (wi + 0.5) * cw, padT + ph + 8);
    });
  }

  /* ══ 7-D. 한 해 입금 고리 ══ */
  function buildRing(s, hidden) {
    var keepPin = s.pin; L3.clear(s); s.pin = keepPin;
    var RR = 7.5, H = 7.0, B = 1.28, max = 0, maxT = 1, M = MTOT(), mos = MONTHS(), cats = CATS(), FO = finOk();
    M.forEach(function (t) { var v = 0; cats.forEach(function (c) { if (!hidden[c.k]) v += t.cat[c.k] || 0; }); if (v > max) max = v; if (t.task > maxT) maxT = t.task; });
    floor(s, -11.2, -11.2, 11.2, 11.2);
    var fc = []; for (var ci = 0; ci < 48; ci++) { var ca = ci / 48 * Math.PI * 2; fc.push([Math.cos(ca) * RR, 0.01, Math.sin(ca) * RR]); }
    s.under.push({ type: 'poly', pts: fc, closed: true, c: ST.dark ? 'rgba(148,163,184,.25)' : 'rgba(148,163,184,.45)', lw: 1.1 });
    var sum = 0, ring = [];
    M.forEach(function (t, m) {
      var ang = -Math.PI / 2 + m * (Math.PI * 2 / 12), x = Math.cos(ang) * RR, z = Math.sin(ang) * RR, y = 0, vm = 0;
      if (FO && max > 0) cats.forEach(function (c) {
        if (hidden[c.k]) return; var v = t.cat[c.k] || 0; if (!(v > 0)) return; var h = v / max * H;
        var id = 'd' + m + c.k, prevH = s.prevHeights[id];
        s.items.push({ type: 'box', id: id, mi: m, ck: c.k, x: x, z: z, w: B, d: B, y0: y, h: Math.max(0.025, h), curH: (prevH != null && !REDUCE ? prevH : Math.max(0.025, h)), color: c.color, spot: (m === 11),
          tip: '<b>' + esc(mos[m]) + '</b> · ' + esc(c.name) + '<br>' + won(v) + (t.inc > 0 ? ' (그 달 ' + Math.round(v / t.inc * 100) + '%)' : '') });
        y += h; sum += v; vm += v;
      });
      s.labels.push({ p: [Math.cos(ang) * (RR + 2.45), 0.08, Math.sin(ang) * (RR + 2.45)], t: mos[m], c: m === 11 ? '#1e40af' : '#475569', wt: m === 11 ? 800 : 650, accentPill: (m === 11), pill: (m !== 11), bg: m === 11 ? '#eff6ff' : 'rgba(255,255,255,.86)' });
      if (vm > 0) s.labels.push({ p: [x, y + 0.78, z], t: man(vm), c: '#166534', darkC: '#bbf7d0', sz: 10.5, wt: 800, grow: true, pill: true });
      if (logOk()) ring.push([Math.cos(ang) * (RR - 2.85), 0.55 + t.task / maxT * 3.8, Math.sin(ang) * (RR - 2.85)]);
    });
    if (ring.length > 2) s.over.push({ type: 'poly', pts: ring, closed: true, c: ST.dark ? '#60a5fa' : '#2563eb', lw: 2.4, dots: true, glow: true, grow: true });
    s.items.push({ type: 'box', id: 'core', x: 0, z: 0, w: 3.4, d: 3.4, y0: 0, h: 0.45, color: '#2563eb', tip: '<b>12개월 입금 합계(보이는 종류)</b><br>' + (FO ? won(sum) : '못 읽음') });
    s.labels.push({ p: [0, 3.35, 0], t: '12개월 확정 입금', c: '#475569', sz: 11, wt: 750, pill: true });
    s.labels.push({ p: [0, 2.52, 0], t: FO ? won(sum) : '못 읽음', c: '#1e40af', wt: 850, sz: 13.5, bg: '#eff6ff', accentPill: true });
    return !FO ? finWhy() : (max <= 0 ? '이 12개월 확정 입금이 없습니다' : '');
  }
  function drawRing2D(c, g) {
    var M = MTOT(), mos = MONTHS(), cats = CATS(), FO = finOk(), LO = logOk();
    if (!M.length || (!FO && !LO)) return;
    var W = c.w, H = c.h, padL = 54, padR = 44, padT = 62, padB = 38;
    var pw = Math.max(40, W - padL - padR), ph = Math.max(40, H - padT - padB);
    var txtCol = ST.dark ? '#cbd5e1' : '#475569', gridCol = ST.dark ? 'rgba(148,163,184,.20)' : 'rgba(203,213,225,.70)';
    var maxV = 1, maxT = 1;
    M.forEach(function (t) { var v = 0; cats.forEach(function (cat) { if (!dHidden[cat.k]) v += t.cat[cat.k] || 0; }); if (v > maxV) maxV = v; if (t.task > maxT) maxT = t.task; });
    maxV *= 1.14; maxT *= 1.18;
    for (var i = 0; i <= 4; i++) {
      var gy = padT + ph - (i / 4) * ph;
      g.strokeStyle = gridCol; g.lineWidth = 1; g.beginPath(); g.moveTo(padL, gy); g.lineTo(padL + pw, gy); g.stroke();
      g.font = '600 10.5px Pretendard,"Malgun Gothic",sans-serif';
      if (FO) { g.fillStyle = txtCol; g.textAlign = 'right'; g.textBaseline = 'middle'; g.fillText(man(maxV * i / 4), padL - 6, gy); }
      if (LO) { g.fillStyle = ST.dark ? '#bfdbfe' : '#2563eb'; g.textAlign = 'left'; g.fillText(n(maxT * i / 4) + '건', padL + pw + 6, gy); }
    }
    g.font = '700 11px Pretendard,"Malgun Gothic",sans-serif';
    g.fillStyle = txtCol; g.textAlign = 'left'; g.fillText(FO ? '입금(만원)' : '입금 못 읽음', padL, padT - 13);
    g.fillStyle = ST.dark ? '#60a5fa' : '#2563eb'; g.textAlign = 'right'; g.fillText(LO ? '● 수행업무(건)' : '업무 기록 못 읽음', padL + pw, padT - 13);
    var stepX = pw / 12, bw = Math.min(30, stepX * 0.58), linePts = [];
    M.forEach(function (t, m) {
      var cx = padL + stepX * (m + 0.5), x0 = cx - bw / 2, yCur = padT + ph;
      if (FO) cats.forEach(function (cat) {
        if (dHidden[cat.k]) return;
        var v = t.cat[cat.k] || 0, bh = (v / maxV) * ph; if (bh < 0.6) return;
        var id = 'd' + m + cat.k, isHot = (c.hot === id || c.pin === id);
        var rgb = hex2rgb(cat.color); if (ST.dark) rgb = shade(rgb, 0.14);
        g.fillStyle = rgba(isHot ? shade(rgb, 0.28) : rgb, 0.94); g.fillRect(x0, yCur - bh, bw, bh);
        g.strokeStyle = isHot ? '#fbbf24' : (ST.dark ? 'rgba(30,41,59,.6)' : '#ffffff'); g.lineWidth = isHot ? 2.2 : 0.8; g.strokeRect(x0, yCur - bh, bw, bh);
        c.hits.push({ id: id, mi: m, ck: cat.k, rect: [x0, yCur - bh, bw, bh], tip: '<b>' + esc(mos[m]) + '</b> · ' + esc(cat.name) + ' (2D)<br><b>' + won(v) + '</b> · 수행업무 ' + (LO ? t.task + '건' : '—') });
        yCur -= bh;
      });
      g.font = '600 10.5px Pretendard,"Malgun Gothic",sans-serif'; g.fillStyle = txtCol; g.textAlign = 'center'; g.textBaseline = 'top';
      g.fillText(W < 420 ? mos[m].slice(3) : mos[m], cx, padT + ph + 8);
      linePts.push([cx, padT + ph - (t.task / maxT) * ph]);
    });
    if (LO) {
      strokeSpline2D(g, linePts, ST.dark ? '#60a5fa' : '#2563eb', 2.5, ST.dark ? 'rgba(96,165,250,.28)' : 'rgba(37,99,235,.16)');
      linePts.forEach(function (pt) { g.fillStyle = '#2563eb'; g.beginPath(); g.arc(pt[0], pt[1], 3.6, 0, 6.2832); g.fill(); g.fillStyle = '#ffffff'; g.beginPath(); g.arc(pt[0], pt[1], 1.6, 0, 6.2832); g.fill(); });
    }
  }

  /* ══ 7-E. 업체 도시 — 담당자마다 구역, 구역마다 업체 건물(높이 = 12개월 입금) ══ */
  var CITY_MAX_PER = 25;                 /* 한 구역에 세우는 건물 수 — 넘으면 12개월 입금이 큰 차례로, 나머지는 표에서 */
  function coLabel(co) { return co.name ? co.name : '이름 없는 업체'; }
  function coShort(co) { return coLabel(co).replace(/^\s*(\(주\)|㈜|주식회사)\s*/, ''); }
  function cityGroups() {
    var by = {}, order = [];
    COMP().forEach(function (co) {
      if (!(co.inc12 > 0 || co.task > 0 || co.active)) return;
      var k = co.owner || '', p = k ? personById(k) : null;
      if (!by[k]) { by[k] = { key: k, name: p ? p.name : (k ? '명부에 없음' : '담당 없음'), color: p ? p.color : '#64748b', list: [] }; order.push(k); }
      by[k].list.push(co);
    });
    var G2 = order.map(function (k) { var g = by[k]; g.list.sort(function (a, b) { return (b.inc12 - a.inc12) || (b.task - a.task); }); g.more = Math.max(0, g.list.length - CITY_MAX_PER); g.show = g.list.slice(0, CITY_MAX_PER); return g; });
    G2.sort(function (a, b) { return (a.key ? 0 : 1) - (b.key ? 0 : 1) || b.list.length - a.list.length; });
    return G2;
  }
  function buildCity(s, o) {
    var keepPin = s.pin; L3.clear(s); s.pin = keepPin;
    var groups = cityGroups(), FO = finOk();
    var nD = Math.max(1, groups.length), cols = Math.ceil(Math.sqrt(nD)), rows = Math.ceil(nD / cols), cell = 10.4;
    var spanX = cols * cell, spanZ = rows * cell, half = Math.max(spanX, spanZ) / 2 + 0.6;
    floor(s, -half, -half, half, half);
    var max = 1; groups.forEach(function (g) { g.show.forEach(function (co) { if (co.inc12 > max) max = co.inc12; }); });
    var scale = Math.min(1, 22 / Math.max(spanX, spanZ));
    groups.forEach(function (gr, d) {
      var gx = (d % cols - (cols - 1) / 2) * cell * scale, gz = (Math.floor(d / cols) - (rows - 1) / 2) * cell * scale;
      var rgb = hex2rgb(gr.color), dim = o.focus != null && o.focus !== gr.key, hs = 4.4 * scale;
      s.under.push({ type: 'quad', v: [[gx - hs, 0.01, gz - hs], [gx + hs, 0.01, gz - hs], [gx + hs, 0.01, gz + hs], [gx - hs, 0.01, gz + hs]],
        fill: rgba(shade(rgb, ST.dark ? 0.2 : 0), dim ? 0.05 : (ST.dark ? 0.18 : 0.12)), stroke: rgba(shade(rgb, ST.dark ? 0.3 : 0), dim ? 0.18 : 0.65), lw: 1.2, nohit: true });
      s.labels.push({ p: [gx, 0.12, gz - hs - 0.65], t: '  ' + gr.name + ' 구역' + (gr.more ? ' (+' + gr.more + ')' : ''), short: ' ' + gr.name, c: gr.color, dotCol: gr.color, wt: 800, bg: 'rgba(255,255,255,.90)' });
      var k = gr.show.length, sub = Math.max(1, Math.ceil(Math.sqrt(k))), step = (8.4 * scale) / sub;
      gr.show.forEach(function (co, j) {
        var cx = gx + ((j % sub) - (sub - 1) / 2) * step, cz = gz + (Math.floor(j / sub) - (sub - 1) / 2) * step;
        var fw = Math.min(step * 0.78, (0.72 + Math.sqrt(co.task) * 0.15) * scale), h = FO ? Math.max(0.18, co.inc12 / max * 5.4) : 0.18;
        var fade = (o.focus != null && o.focus !== gr.key) || (o.misu && co.misu !== true);
        var tip = '<b>' + esc(coLabel(co)) + '</b> · 담당 ' + esc(gr.name) + '<br>12개월 입금 ' + (FO ? won(co.inc12) : '못 읽음') + ' · 누적 ' + (FO ? won(co.incAll) : '—') + ' · 업무 ' + co.task + '건' + (co.misu === true ? '<br><b>⚠ 자문료 미수 추정 ' + co.misuMonths + '달 · ' + won(co.misuAmt) + '</b>' : '');
        s.items.push({ type: 'box', id: co.id, cid: co.id, x: cx, z: cz, w: fw, d: fw, y0: 0, h: h, color: h > 3.2 ? '#166534' : (h > 1.4 ? '#16a34a' : '#4ade80'), fade: fade, tip: tip });
        if (co.misu === true) s.items.push({ type: 'box', id: co.id + '|r', cid: co.id, x: cx, z: cz, w: fw * 1.08, d: fw * 1.08, y0: h, h: 0.32, color: '#fbbf24', beacon: true, fade: fade && !o.misu, tip: tip });
      });
    });
    return groups.length ? (!FO ? finWhy() + ' — 건물 높이는 그리지 않습니다' : '') : '보일 업체가 없습니다(업체 목록을 못 읽었거나 비어 있음)';
  }
  /* 2D 는 «업체 막대 목록» (대표 2026-11-22 「2D 는 너무 빡빡하게 붙어 내용이 전혀 확인이 안 된다」).
     옛 점 그림(가로=업무 건수·세로=12개월 입금)은 업무 건수가 0~2건에 몰려 업체 백몇십 곳이 세 줄로 겹치고, 미수 업체마다 이름을 달아 글자가 뭉쳤다.
     → 한 줄에 한 업체: 담당 색 점(노란 고리 = 자문료 미수 추정) · 업체 이름 · 12개월 입금 막대 · 업무 건수 · 미수 달 수.
       구역·«미수만»을 고르면 그 업체만 남기고, 한 쪽에 들어가는 만큼씩 ◀ ▶ 로 넘겨 본다. 막대 길이는 «고른 업체 전체» 가운데 가장 큰 값 기준(쪽마다 잣대가 바뀌지 않게). */
  var E2D = { sort: 'inc', off: 0, ps: 0, pg: '', want: null };
  var E2D_SORTS = { inc: '12개월 입금 큰 차례', task: '업무 많은 차례', misu: '미수 큰 차례' };
  function e2dList() {
    var out = [], FO = finOk();
    cityGroups().forEach(function (gr) {
      if (eState.focus != null && eState.focus !== gr.key) return;
      gr.list.forEach(function (co) { if (eState.misu && co.misu !== true) return; out.push({ co: co, gr: gr }); });
    });
    var s = FO ? E2D.sort : 'task';
    out.sort(function (a, b) {
      var A = a.co, B = b.co;
      if (s === 'task') return (B.task - A.task) || (B.inc12 - A.inc12);
      if (s === 'misu') return ((B.misu === true ? 1 : 0) - (A.misu === true ? 1 : 0)) || ((B.misuAmt || 0) - (A.misuAmt || 0)) || (B.inc12 - A.inc12);
      return (B.inc12 - A.inc12) || (B.task - A.task);
    });
    return out;
  }
  /* 3D 에서 고른 업체가 다른 쪽에 있으면 그 쪽으로 넘긴다 — 쪽 크기는 그릴 때 정해지므로(3D 만 볼 때는 아직 모름) 그릴 때 넘긴다 */
  function e2dShow(cid) {
    if (!cid) return;
    E2D.want = cid; CH.e.dirty = true;
  }
  function e2dPager(total) {
    var box = $('e2dPg'); if (!box) return;
    var ps = E2D.ps || 1, key = total + '|' + E2D.off + '|' + ps;
    if (key === E2D.pg) return;
    E2D.pg = key;
    box.hidden = total <= ps;
    $('e2dPgTx').textContent = total ? (E2D.off + 1) + '–' + Math.min(E2D.off + ps, total) + ' / ' + total + '곳' : '';
    $('e2dPrev').disabled = E2D.off <= 0;
    $('e2dNext').disabled = E2D.off + ps >= total;
  }
  function drawCity2D(c, g) {
    var FO = finOk(), list = e2dList(), W = c.w, H = c.h;
    var txtCol = ST.dark ? '#cbd5e1' : '#475569', ink = ST.dark ? '#f8fafc' : '#1e293b', lineCol = ST.dark ? 'rgba(148,163,184,.16)' : 'rgba(226,232,240,1)';
    var narrow = W < 470, padX = narrow ? 10 : 16, padT = 78, padB = 50, rowH = narrow ? 27 : 26;
    var ps = Math.max(3, Math.floor((H - padT - padB) / rowH));
    if (E2D.ps && E2D.ps !== ps) E2D.off = Math.floor(E2D.off / ps) * ps;   /* 폭·높이가 바뀌면 쪽 경계를 새 쪽 크기에 맞춘다(앞뒤 쪽이 겹치지 않게) */
    E2D.ps = ps;
    if (E2D.want) {
      if (SC.e && SC.e.pin) { for (var wi = 0; wi < list.length; wi++) if (list[wi].co.id === E2D.want) { E2D.off = Math.floor(wi / ps) * ps; break; } }   /* 3D 에서 아직 고른 채일 때만(Esc·처음 자리로 단추로 풀었으면 넘기지 않는다) */
      E2D.want = null;
    }
    if (E2D.off >= list.length) E2D.off = Math.max(0, Math.floor((list.length - 1) / ps) * ps);
    e2dPager(list.length);
    /* 머리 한 줄 — 무엇을 어떤 차례로 몇 곳 보이는지 */
    var gname = '';
    if (eState.focus != null) { var fg = cityGroups().filter(function (x) { return x.key === eState.focus; })[0]; gname = fg ? fg.name + ' 구역 · ' : ''; }
    g.font = '700 11.5px Pretendard,"Malgun Gothic",sans-serif'; g.fillStyle = txtCol; g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillText(fitText(g, gname + (eState.misu ? '미수 업체만 · ' : '') + (FO ? E2D_SORTS[E2D.sort] : '업무 많은 차례(입금 못 읽음)') + ' · ' + n(list.length) + '곳', W - padX * 2), padX, 46);
    if (!list.length) {
      g.font = '700 13px Pretendard,"Malgun Gothic",sans-serif'; g.textAlign = 'center'; g.fillStyle = txtCol;
      g.fillText(eState.misu ? '고른 구역에 미수 추정 업체가 없습니다' : '보일 업체가 없습니다', W / 2, H / 2);
      return;
    }
    var maxV = 1; list.forEach(function (x) { var v = FO ? x.co.inc12 : x.co.task; if (v > maxV) maxV = v; });
    var nameX = padX + 18, nameW = narrow ? Math.max(76, Math.min(118, W * 0.33)) : Math.max(120, Math.min(220, W * 0.27));
    var misuW = narrow ? 0 : 66, taskW = narrow ? 42 : 58;
    var taskR = W - padX - misuW, barX0 = nameX + nameW + 10, barX1 = taskR - taskW - 6;
    /* 금액 글자 자리는 «고른 업체 전체에서 가장 긴 금액»을 재서 비운다 — 큰 금액이 업무 칸을 덮지 않고, 쪽을 넘겨도 막대 잣대가 같게(막대 칸의 절반까지) */
    var page = list.slice(E2D.off, E2D.off + ps);
    function amtTxt(co) { var v = FO ? co.inc12 : co.task; return FO ? (v ? won(v) : '0원') : n(v) + '건'; }   /* 음수 입금은 부호 그대로(won 이 − 를 붙임) */
    g.font = '700 11px Pretendard,"Malgun Gothic",sans-serif';
    var amtW = 8; list.forEach(function (o2) { amtW = Math.max(amtW, g.measureText(amtTxt(o2.co)).width + 8); });
    amtW = Math.min(amtW, Math.max(40, (barX1 - barX0) * 0.5));
    var barMax = Math.max(20, barX1 - barX0 - amtW);
    /* 칸 이름 */
    g.font = '700 10.5px Pretendard,"Malgun Gothic",sans-serif'; g.fillStyle = txtCol; g.textBaseline = 'middle';
    g.textAlign = 'left'; g.fillText('업체', nameX, padT - 12); g.fillText(FO ? '12개월 입금' : '업무 건수', barX0, padT - 12);
    g.textAlign = 'right'; g.fillText('업무', taskR, padT - 12); if (misuW) g.fillText('미수 추정', W - padX, padT - 12);
    g.strokeStyle = lineCol; g.lineWidth = 1; g.beginPath(); g.moveTo(padX, padT - 2); g.lineTo(W - padX, padT - 2); g.stroke();
    page.forEach(function (o2, i) {
      var co = o2.co, gr = o2.gr, y = padT + i * rowH, cy = y + rowH / 2;
      var isHot = (c.hot === co.id || c.pin === co.id), rgb = hex2rgb(gr.color); if (ST.dark) rgb = shade(rgb, 0.22);
      if (isHot) { g.fillStyle = ST.dark ? 'rgba(96,165,250,.20)' : 'rgba(37,99,235,.08)'; g.fillRect(padX - 4, y + 1, W - padX * 2 + 8, rowH - 2); }
      g.strokeStyle = lineCol; g.lineWidth = 1; g.beginPath(); g.moveTo(padX, y + rowH - 0.5); g.lineTo(W - padX, y + rowH - 0.5); g.stroke();
      /* 담당 색 점 + 미수면 노란 고리 */
      if (co.misu === true) { g.strokeStyle = '#fbbf24'; g.lineWidth = 2.2; g.beginPath(); g.arc(padX + 6, cy, 7, 0, 6.2832); g.stroke(); }
      g.fillStyle = rgba(rgb, 1); g.beginPath(); g.arc(padX + 6, cy, 4.2, 0, 6.2832); g.fill();
      g.font = (isHot ? '800' : '650') + ' 12px Pretendard,"Malgun Gothic",sans-serif'; g.fillStyle = ink; g.textAlign = 'left';
      g.fillText(fitText(g, coShort(co), nameW), nameX, cy);
      var v = FO ? co.inc12 : co.task, bw = v > 0 ? Math.max(2, v / maxV * barMax) : 0;
      if (bw) { g.fillStyle = rgba(rgb, isHot ? 1 : 0.82); g.fillRect(barX0, cy - 5.5, bw, 11); }
      g.font = '700 11px Pretendard,"Malgun Gothic",sans-serif'; g.fillStyle = v > 0 ? ink : txtCol; g.textAlign = 'left';
      g.fillText(fitText(g, amtTxt(co), Math.max(20, barX1 - barX0 - bw - 6)), barX0 + bw + 6, cy);
      g.fillStyle = txtCol; g.textAlign = 'right'; g.font = '600 11px Pretendard,"Malgun Gothic",sans-serif';
      g.fillText(fitText(g, n(co.task) + '건', taskW - 4), taskR, cy);
      if (misuW && co.misu === true) { g.fillStyle = ST.dark ? '#fde68a' : '#854d0e'; g.font = '700 11px Pretendard,"Malgun Gothic",sans-serif'; g.fillText(co.misuMonths ? co.misuMonths + '달' : '미수', W - padX, cy); }
      c.hits.push({ id: co.id, cid: co.id, rect: [padX - 4, y, W - padX * 2 + 8, rowH], tip: '<b>' + esc(coLabel(co)) + '</b> (2D · 담당 ' + esc(gr.name) + ')<br>12개월 입금 ' + (FO ? won(co.inc12) : '못 읽음') + ' · 누적 ' + (FO ? won(co.incAll) : '—') + ' · 업무 ' + co.task + '건' + (co.misu === true ? '<br><b>⚠ 자문료 미수 추정 ' + (co.misuMonths || '') + '달 · ' + won(co.misuAmt) + '</b>' : '') });
    });
  }

  /* ══ 8. 3D ↔ 2D ↔ 표 양방향 연동 ══ */
  function wireSync() {
    /* (1) 전체 배치 */
    SC.all.onHover = function (it) { CH.all.hot = it ? it.id : null; CH.all.dirty = true; };
    CH.all.onHover = function (h) { SC.all.hot = (h && h.pid) ? h.id : null; SC.all.dirty = true; };
    SC.all.onPick = function (it) { if (!it) { SC.all.pin = null; CH.all.pin = null; CH.all.dirty = true; return; } applyAllPick(it.pid, it.mi, SC.all.pin); };
    CH.all.onPick = function (h) { if (!h) { SC.all.pin = null; CH.all.pin = null; SC.all.dirty = true; return; } applyAllPick(h.pid || null, h.mi, h.pid ? CH.all.pin : null); };
    /* (2) A안 */
    SC.a.onHover = function (it) { CH.a.hot = it ? it.id : null; CH.a.dirty = true; };
    CH.a.onHover = function (h) { SC.a.hot = (h && h.pid) ? h.id : null; SC.a.dirty = true; };
    SC.a.onPick = function (it) {
      CH.a.pin = SC.a.pin; if (it && it.mi != null) { aState.selMonth = it.mi; smsg('smA', buildBars(SC.a, aState)); }
      CH.a.dirty = true; SC.a.dirty = true;
      if (it && it.pid) { var p = personById(it.pid); if (p) setSync('syncTxtA', '🔗 A안 연동됨: ' + MONTHS()[it.mi] + ' · ' + p.name + ' (' + METRIC[aState.metric].fmt(p.m[it.mi][aState.metric]) + ')'); }
    };
    CH.a.onPick = function (h) {
      SC.a.pin = (h && h.pid) ? CH.a.pin : null;
      if (h && h.mi != null) { aState.selMonth = h.mi; smsg('smA', buildBars(SC.a, aState)); SC.a.pin = (h.pid ? h.id : null); }
      SC.a.dirty = true; CH.a.dirty = true;
      if (h && h.pid) { var p = personById(h.pid); if (p) setSync('syncTxtA', '🔗 A안 연동됨: ' + MONTHS()[h.mi] + ' · ' + p.name + ' (' + METRIC[aState.metric].fmt(p.m[h.mi][aState.metric]) + ')'); }
      else if (h && h.mi != null) setSync('syncTxtA', '🔗 A안 연동됨: ' + MONTH_KO()[h.mi] + ' 합계 강조');
    };
    /* (3) B안 */
    SC.b.onHover = function (it) { CH.b.hot = it ? it.id : null; CH.b.dirty = true; };
    CH.b.onHover = function (h) { SC.b.hot = h ? h.id : null; SC.b.dirty = true; };
    function bSync(id) { var p = personById(id); if (!p) return; var v = p.m[bMi]; setSync('syncTxtB', '🔗 B안 연동됨: ' + p.name + ' (' + MONTHS()[bMi] + ' · 업무 ' + v.task + '건 · 입금 ' + (finOk() ? won(v.inc) : '못 읽음') + ')'); }
    SC.b.onPick = function (it) { CH.b.pin = SC.b.pin; CH.b.dirty = true; if (it) bSync(it.id); };
    CH.b.onPick = function (h) { SC.b.pin = CH.b.pin; SC.b.dirty = true; if (h) bSync(h.id); };
    /* (4) C안 */
    SC.c.onHover = function (it) { CH.c.hot = it ? it.id : null; CH.c.dirty = true; };
    CH.c.onHover = function (h) { SC.c.hot = h ? h.id : null; SC.c.dirty = true; };
    function cSync(pid, wi) { var p = personById(pid); if (!p || !DS) return; var nW = DS.weeks.length; setSync('syncTxtC', '🔗 C안 연동됨: ' + p.name + ' · ' + wkLabel(wi, nW) + ' (' + p.wkN[wi] + '건)'); }
    SC.c.onPick = function (it) { CH.c.pin = SC.c.pin; CH.c.dirty = true; if (it && it.pid) cSync(it.pid, it.wi); };
    CH.c.onPick = function (h) { SC.c.pin = CH.c.pin; SC.c.dirty = true; if (h && h.pid) cSync(h.pid, h.wi); };
    /* (5) D안 */
    SC.d.onHover = function (it) { CH.d.hot = it ? it.id : null; CH.d.dirty = true; };
    CH.d.onHover = function (h) { SC.d.hot = h ? h.id : null; SC.d.dirty = true; };
    function dSync(mi, ck) { var cat = CATS().filter(function (x) { return x.k === ck; })[0]; if (cat) setSync('syncTxtD', '🔗 D안 연동됨: ' + MONTHS()[mi] + ' · ' + cat.name + ' (' + won(MTOT()[mi].cat[ck]) + ')'); }
    SC.d.onPick = function (it) { CH.d.pin = SC.d.pin; CH.d.dirty = true; if (it && it.ck) dSync(it.mi, it.ck); };
    CH.d.onPick = function (h) { SC.d.pin = CH.d.pin; SC.d.dirty = true; if (h && h.ck) dSync(h.mi, h.ck); };
    /* (6) E안 */
    SC.e.onHover = function (it) { CH.e.hot = (it && it.cid) ? it.cid : null; CH.e.dirty = true; };
    CH.e.onHover = function (h) { SC.e.hot = h ? h.id : null; SC.e.dirty = true; };
    function eSync(cid) {
      var co = COMP().filter(function (x) { return x.id === cid; })[0]; if (!co) return;
      var p = co.owner ? personById(co.owner) : null;
      setSync('syncTxtE', '🔗 E안 연동됨: ' + coLabel(co) + ' · ' + (p ? p.name : '담당 없음') + ' (12개월 ' + (finOk() ? won(co.inc12) : '못 읽음') + (co.misu === true ? ' · ⚠미수' : '') + ')');
    }
    SC.e.onPick = function (it) { var cid = it ? it.cid : null; CH.e.pin = SC.e.pin ? cid : null; CH.e.dirty = true; if (cid) eSync(cid); if (cid && CH.e.pin) e2dShow(cid); else E2D.want = null; };
    CH.e.onPick = function (h) { SC.e.pin = CH.e.pin; SC.e.dirty = true; if (h && h.cid) eSync(h.cid); };
    /* (7) 다년 */
    SC.m.onHover = function (it) { CH.m.hot = it ? it.id : null; CH.m.dirty = true; };
    CH.m.onHover = function (h) { SC.m.hot = h ? h.id : null; SC.m.dirty = true; };
    SC.m.onPick = function (it) { if (!it || !it.yr) { mState.selYear = null; SC.m.pin = null; CH.m.pin = null; refreshMultiAll(false); return; } applyMultiYearPick(it.yr, SC.m.pin); };
    CH.m.onPick = function (h) { if (!h || !h.yr) { mState.selYear = null; SC.m.pin = null; CH.m.pin = null; refreshMultiAll(false); return; } applyMultiYearPick(h.yr, CH.m.pin); };
  }
  function applyAllPick(pid, mi, pinId) {
    SC.all.pin = pinId; CH.all.pin = pinId;
    if (pid) { selected = {}; selected[pid] = 1; }
    if (mi != null && mi !== CUR) setGlobalPeriod(mi, true);
    else { renderTbl(); SC.all.dirty = true; CH.all.dirty = true; }
    var p = pid ? personById(pid) : null, idx = mi != null ? mi : CUR;
    var mName = (mi != null && mi < 12) ? MONTH_KO()[mi] : curLabel();
    if (p) { var v = personVal(p, idx); setSync('syncTxtAll', '🔗 연동 고름: ' + mName + ' · ' + p.name + ' (입금 ' + (finOk() ? won(v.inc) : '못 읽음') + ' · 업무 ' + v.task + '건)'); $('btnResetSyncAll').style.display = ''; }
    else if (mi != null) { setSync('syncTxtAll', '🔗 연동 고름: ' + mName + ' 전체 (입금 ' + (finOk() ? won(periodTot(mi).inc) : '못 읽음') + ')'); $('btnResetSyncAll').style.display = ''; }
  }

  /* ══ 9. 전체 배치 ══ */
  function rebuildAll(soft) {
    if (!SC.all) return;
    allState.selMonth = CUR;
    var w = buildBars(SC.all, allState);
    smsg('smAll', w); smsg('smAll2d', METRIC[allState.metric].ok() ? '' : METRIC[allState.metric].why());
    if (!soft) SC.all.startGrow(); else SC.all.dirty = true;
    CH.all.dirty = true;
  }
  function renderLoading() {
    $('kpis').innerHTML = ['확정 입금', '입금 건수', '수행업무', '주의·병목 앱'].map(function (k) {
      return '<div class="kpi"><div class="kh"><div class="k">' + k + '</div></div><div class="v nil">불러오는 중</div><div class="d">원본을 읽고 있습니다</div></div>';
    }).join('');
    $('sDash').innerHTML = '<h3>한눈에</h3><div><span>불러오는 중</span><b>…</b></div>';
  }
  function renderPeriodSelect() {
    var sel = $('selPeriod'); if (!sel || !DS) return;
    var h = '';
    for (var i = DS.months.length - 1; i >= 0; i--) h += '<option value="' + i + '">' + esc(DS.MONTH_KO[i]) + '</option>';
    h += '<option value="12">최근 12개월</option>';
    sel.innerHTML = h; sel.value = String(CUR);
  }
  function renderMonthScrub() {
    var box = $('monthScrub'); if (!box) return;
    var h = '<span class="mlb">월별 흐름</span>';
    MONTHS().forEach(function (m, idx) { h += '<button type="button" class="mpill' + (CUR === idx ? ' on' : '') + '" aria-pressed="' + (CUR === idx) + '" data-mi="' + idx + '">' + esc(m) + '</button>'; });
    h += '<button type="button" class="mpill' + (CUR === 12 ? ' on' : '') + '" aria-pressed="' + (CUR === 12) + '" data-mi="12">12개월 합계</button>';
    box.innerHTML = h;
  }
  /* 네 번째 카드 — 결정 ⑭ «주의·병목 앱 수». 기준을 정하지 않았거나 서버 집계 전이면 «—» + 까닭 */
  var useCard4Per = false;
  function bottleneck() {
    if (!SRC.board || !SRC.board.ok) return { v: null, why: '현황판을 못 읽음(' + (SRC.board ? SRC.board.why : '') + ')' };
    var L = boardCards(), have = L.filter(function (c) { return c.st !== 'na'; });
    if (!have.length) return { v: null, why: '서버 집계 전 — 현황판 숫자가 아직 없습니다' };
    if (!anyBoardThr()) return { v: null, why: '기준 미설정 — «기준 정하기»에서 앱별 주의 기준을 정하면 셉니다' };
    var w = 0, b = 0; L.forEach(function (c) { if (c.st === 'warn') w++; if (c.st === 'bad') b++; });
    return { v: w + b, why: '주의 ' + w + ' · 위험 ' + b + ' (기준 정한 앱만)', w: w, b: b };
  }
  function kpiHtml(idx) {
    var t = periodTot(idx), isYear = (idx === 12), M = MTOT();
    var prev = (!isYear && idx > 0) ? M[idx - 1] : null;
    var hi = isYear ? 11 : idx, FO = finOk(), LO = logOk();
    var basisTag = BASIS === 'accrual' ? '귀속월' : '입금일', netTag = NET ? '·순액' : '';
    var cards = [];
    /* ① 확정 입금 */
    var k1 = isYear ? '12개월 입금 (' + basisTag + netTag + ')' : (MONTHS()[idx] + ' 확정 입금 (' + basisTag + netTag + ')');
    if (!FO) cards.push([k1, '못 읽음', '<span class="dn">' + esc(finWhy()) + '</span>', '', true]);
    else if (!t.n) cards.push([k1, '없음', '<span class="na">' + (isYear ? '이 12개월 확정 입금이 없습니다' : '이 달 확정 입금이 없습니다') + '</span>', sparkSvg(M.map(function (x) { return x.inc; }), hi, '#16a34a'), true]);
    else {
      var d = (prev && prev.inc > 0) ? (t.inc - prev.inc) / prev.inc * 100 : null;
      cards.push([k1, won(t.inc), isYear ? '<span class="up">월평균 ' + won(t.inc / 12) + '</span>' : (d == null ? '<span class="na">전월 입금이 없어 견주지 않음</span>' : '<span class="' + (d >= 0 ? 'up' : 'dn') + '">' + (d >= 0 ? '▲' : '▼') + ' ' + Math.abs(d).toFixed(1) + '% (전월 ' + won(prev.inc) + ')</span>'), sparkSvg(M.map(function (x) { return x.inc; }), hi, '#16a34a')]);
    }
    /* ② 입금 건수 */
    cards.push(['입금 건수', FO ? n(t.n) + '건' : '못 읽음', FO ? '<span class="na">확정만 · 되돌림·휴지통 제외</span>' : '<span class="dn">' + esc(finWhy()) + '</span>', FO ? sparkSvg(M.map(function (x) { return x.n; }), hi, '#0e7490') : '', !FO]);
    /* ③ 수행업무 */
    var rr = isYear ? null : DS.REC_RATES[idx];
    if (isYear) { var rs = DS.REC_RATES.filter(fin); rr = rs.length ? Math.round(rs.reduce(function (a, b) { return a + b; }, 0) / rs.length) : null; }
    cards.push(['수행업무', LO ? n(t.task) + '건' : '못 읽음', LO ? '<span class="na">업무관리 기록 · 기록률 ' + (rr == null ? '—' : rr + '%') + '</span>' : '<span class="dn">' + esc(logWhy()) + '</span>', LO ? sparkSvg(M.map(function (x) { return x.task; }), hi, '#2563eb') : '', !LO]);
    /* ④ 주의·병목 앱 수 / 업무 1건당 입금 */
    if (!useCard4Per) {
      var bn = bottleneck();
      cards.push(['주의·병목 앱', bn.v == null ? '—' : bn.v + '곳', '<span class="' + (bn.v ? 'dn' : 'na') + '">' + esc(bn.why) + '</span>', '', bn.v == null]);
    } else {
      var per = (FO && LO) ? ratio(t.inc, t.task) : null;
      cards.push(['업무 1건당 입금', per == null ? '—' : won(per), '<span class="na">입금 ÷ 수행업무 (참고치 · 평가 점수 아님)' + (per == null ? ' — ' + (!FO || !LO ? '자료를 못 읽음' : '업무 0건') : '') + '</span>', '', per == null]);
    }
    return cards.map(function (k) {
      return '<div class="kpi"><div class="kh"><div class="k" title="' + esc(k[0]) + '">' + esc(k[0]) + '</div>' + (k[3] || '') + '</div><div class="v' + (k[4] ? ' nil' : '') + '">' + esc(k[1]) + '</div><div class="d">' + k[2] + '</div></div>';
    }).join('');
  }
  function renderKpis() { if (DS) $('kpis').innerHTML = kpiHtml(CUR); }

  /* 사람별 표 — 맨 왼쪽 ☐ + 번호(지금 보이는 순서). 차례는 계산 모듈 차례(직종·사번) — 순위를 매기지 않는다 */
  var ordered = [];
  function perCell(v) { return (finOk() && logOk() && v.task > 0) ? won(v.inc / v.task) : '—'; }
  function cardsHtml(idx) {
    var FO = finOk(), LO = logOk(), rw = recWarn();
    var h = ordered.map(function (p, i) {
      var v = personVal(p, idx), warn = (rw != null && p.recRate != null && p.recRate < rw);
      return '<div class="card' + (selected[p.id] ? ' sel' : '') + '"><input type="checkbox" data-id="' + esc(p.id) + '" ' + (selected[p.id] ? 'checked ' : '') + 'aria-label="' + esc(p.name) + ' 고르기"><span class="no">' + (i + 1) + '</span><div>' +
        '<div class="l1"><span class="dot" style="background:' + esc(p.color) + '"></span><b title="' + esc(p.name) + '">' + esc(p.name) + '</b><span style="color:#475569;font-size:12px">' + esc(p.kind) + (p.retired ? '·퇴사' : '') + '</span><span style="margin-left:auto;font-weight:800;color:#166534">' + (FO ? won(v.inc) : '—') + '</span></div>' +
        '<div class="l2"><span' + (warn ? ' style="color:#854d0e;font-weight:800"' : '') + '>업무 ' + (LO ? n(v.task) + '건' : '—') + '(' + (p.recRate == null ? '—' : p.recRate + '%') + ')</span><span>처리 ' + (FO ? n(v.proc) + '건' : '—') + '</span><span>1건당 ' + perCell(v) + '</span></div></div></div>';
    }).join('');
    var none = noneVal(idx);
    if (FO && none > 0) h += '<div class="card foot">담당을 정하지 못한 입금(성과 몫·업체 주담당 없음): <b>' + won(none) + '</b></div>';
    return h || '<div class="card foot">보일 사람이 없습니다 — 명부를 못 읽었거나 재직자가 없습니다</div>';
  }
  function renderTbl() {
    if (!DS) return;
    ordered = PEOPLE().slice();
    var FO = finOk(), LO = logOk(), rw = recWarn();
    $('allTblTitle').textContent = '사람별 · ' + (CUR === 12 ? '최근 12개월 합계' : curLabel());
    var h = '<colgroup><col style="width:28px"><col style="width:36px"><col style="width:110px"><col style="width:56px"><col style="width:62px"><col style="width:54px"><col style="width:86px"><col style="width:58px"><col style="width:72px"></colgroup>' +
      '<thead><tr><th class="ck"><input type="checkbox" id="ckAll" aria-label="보이는 줄 모두 고르기"></th><th class="no">№</th><th class="l">이름</th><th class="l">직종</th><th title="수행업무(업무관리 기록 건수)">수행업무</th><th title="최근 26주 가운데 업무 기록이 있는 주의 비율">기록률</th><th title="입금 기여(성과 몫 분배 비율 · 성과 몫 없으면 업체 주담당)">입금 기여</th><th title="입금 처리 건수(확정한 사람)">입금 처리</th><th title="업무 1건당 입금(참고치)">1건당</th></tr></thead><tbody>';
    ordered.forEach(function (p, i) {
      var v = personVal(p, CUR), warn = (rw != null && p.recRate != null && p.recRate < rw);
      h += '<tr class="' + (selected[p.id] ? 'sel' : '') + '"><td class="ck"><input type="checkbox" data-id="' + esc(p.id) + '" ' + (selected[p.id] ? 'checked' : '') + ' aria-label="' + esc(p.name) + ' 고르기"></td><td class="no">' + (i + 1) + '</td>' +
        '<td class="l" title="' + esc(p.name) + '"><span class="dot" style="background:' + esc(p.color) + '"></span>' + esc(p.name) + '</td><td class="l" title="' + esc(p.kind + (p.retired ? ' · 퇴사' : '')) + '">' + esc(p.kind) + (p.retired ? '·퇴사' : '') + '</td>' +
        '<td>' + (LO ? n(v.task) + '건' : '—') + '</td><td' + (warn ? ' style="color:#854d0e;font-weight:800" title="대표가 정한 기록률 주의 기준(' + rw + '%)보다 낮음"' : '') + '>' + (p.recRate == null ? '—' : p.recRate + '%') + '</td>' +
        '<td>' + (FO ? won(v.inc) : '—') + '</td><td>' + (FO ? n(v.proc) + '건' : '—') + '</td><td>' + perCell(v) + '</td></tr>';
    });
    if (!ordered.length) h += '<tr><td colspan="9" class="l">보일 사람이 없습니다 — 명부(data/user_dir)를 ' + (SRC.dir && !SRC.dir.ok ? '못 읽었습니다(' + esc(SRC.dir.why) + ')' : '확인하세요') + '</td></tr>';
    h += '</tbody>';
    var none = noneVal(CUR);
    if (FO && none > 0) h += '<tfoot><tr><td colspan="6" class="l">담당을 정하지 못한 입금(성과 몫·업체 주담당 없음)</td><td>' + won(none) + '</td><td colspan="2"></td></tr></tfoot>';
    $('allTbl').innerHTML = h;
    $('allCards').innerHTML = cardsHtml(CUR);
    var cnt = Object.keys(selected).length;
    $('allSel').classList.toggle('on', cnt > 0);
    $('allSelN').textContent = cnt + '명 선택';
    $('allCnt').textContent = ordered.length + '명';
    var ck = $('ckAll'); if (ck) ck.checked = cnt > 0 && cnt === ordered.length;
  }
  function onPickChange(e) {
    var t = e.target;
    if (t.id === 'ckAll') { selected = {}; if (t.checked) ordered.forEach(function (p) { selected[p.id] = 1; }); }
    else if (t.dataset && t.dataset.id) { if (t.checked) selected[t.dataset.id] = 1; else delete selected[t.dataset.id]; }
    renderTbl();
  }
  function renderCatBreakdown() {
    if (!DS) return;
    var t = periodTot(CUR), prev = (CUR > 0 && CUR < 12) ? MTOT()[CUR - 1] : null;
    $('catPanelTitle').textContent = '입금 종류별 비중 · ' + (CUR === 12 ? '최근 12개월' : MONTHS()[CUR]);
    if (!finOk()) { $('catBreakList').innerHTML = '<div class="cat-row"><div class="cat-top"><b>못 읽음</b></div><p class="na" style="margin:4px 0 0;font-size:12px">' + esc(finWhy()) + '</p></div>'; return; }
    if (!(t.inc > 0)) { $('catBreakList').innerHTML = '<div class="cat-row"><div class="cat-top"><b>' + (CUR === 12 ? '이 12개월' : '이 달') + ' 확정 입금이 없습니다</b></div></div>'; return; }
    $('catBreakList').innerHTML = CATS().map(function (c) {
      var v = t.cat[c.k] || 0, pc = Math.round(v / t.inc * 100), dH = '';
      if (prev && prev.cat[c.k] != null) { var dv = v - prev.cat[c.k]; dH = '<span class="' + (dv >= 0 ? 'up' : 'dn') + '" style="font-size:11px">' + (dv >= 0 ? '▲' : '▼') + won(Math.abs(dv)) + '</span>'; }
      return '<div class="cat-row" data-catk="' + esc(c.k) + '" title="' + esc(c.name) + ' — 누르면 D안(한 해 종류별 3D·2D)에서 봅니다">' +
        '<div class="cat-top"><span class="dot" style="background:' + esc(c.color) + ';margin-right:4px"></span><b>' + esc(c.name) + '</b><span class="pct">' + pc + '%</span>' + dH + '<span class="amt">' + won(v) + '</span></div>' +
        '<div class="cat-bar"><i style="width:' + pc + '%;background:' + esc(c.color) + '"></i></div></div>';
    }).join('');
  }
  function setGlobalPeriod(idx, keepMsg) {
    CUR = idx;
    var sel = $('selPeriod'); if (sel) sel.value = String(idx);
    renderMonthScrub(); renderKpis(); renderTbl(); renderCatBreakdown(); rebuildAll(true);
    if (!keepMsg) setSync('syncTxtAll', '🔗 기간 연동됨: ' + (CUR === 12 ? '최근 12개월 합계' : MONTH_KO()[CUR]));
    sideDash(); queueSave();
  }
  /* 정합성·병목 띠 — 셀 수 있는 것만 세고, 못 세는 것은 «—»·회색 + 까닭 */
  function setPill(btnId, numId, val, cls, title) {
    var b = $(btnId), nEl = $(numId);
    if (nEl) nEl.textContent = val == null ? '—' : String(val);
    if (b) { b.className = 'govpill ' + (val == null ? 'nil' : cls); b.title = title; }
  }
  function boardNum(key, i) { var r = BOARD_RAW[key]; if (!r || r.state === 'na' || !Array.isArray(r.n) || !r.n[i]) return null; var v = r.n[i].v; return fin(v) ? v : (v != null && isFinite(Number(v)) ? Number(v) : null); }
  function renderGovbar() {
    var bOk = SRC.board && SRC.board.ok;
    var hold = bOk ? boardNum('fin', 2) : null;
    setPill('gvHoldBtn', 'gvHold', hold == null ? null : n(hold) + '건', hold > 0 ? 'warn' : 'ok', hold == null ? '재무 보류 거래 수는 서버 현황판(재무관리 카드)이 모읍니다 — ' + (bOk ? '서버 집계 전' : '현황판을 못 읽음') : '재무관리 카드의 «주의 신호» 숫자(서버 집계) — 현황판으로 갑니다');
    var lines = cLines(), overLine = lines.length ? lines[lines.length - 1] : null, ppl = PEOPLE().filter(function (p) { return !p.retired; });
    var over = (logOk() && overLine) ? ppl.filter(function (p) { return p.wkN[p.wkN.length - 1] >= overLine.v; }).length : null;
    var rw = recWarn(), rec = (rw != null) ? ppl.filter(function (p) { return p.recRate != null && p.recRate < rw; }).length : null;
    $('gvOver').textContent = over == null ? '—' : over; $('gvRec').textContent = rec == null ? '—' : rec;
    var ob = $('gvOverBtn');
    ob.className = 'govpill ' + ((over == null && rec == null) ? 'nil' : ((over || rec) ? 'bad' : 'ok'));
    ob.title = (overLine ? '이번 주 업무 기록이 대표가 정한 «' + overLine.t + '» 이상인 사람' : '«넘침» 기준 미설정 — 기준 정하기에서 정하면 셉니다') + ' · ' + (rw != null ? '기록률 ' + rw + '% 아래인 사람' : '기록률 주의 기준 미설정') + ' — C안으로 갑니다';
    var adv = COMP().filter(function (x) { return x.misu !== null; });
    var misu = (finOk() && SRC.co && SRC.co.ok) ? adv.filter(function (x) { return x.misu === true; }).length : null;
    setPill('gvMisuBtn', 'gvMisu', misu, misu > 0 ? 'warn' : 'ok', misu == null ? '입금·업체 자료를 다 읽지 못해 세지 않음' : '매달 자문료를 걷는 업체 ' + adv.length + '곳 가운데 지난달까지 덜 받은 달이 있는 곳(이알피 erpAdvisoryDues 와 같은 규칙) — E안으로 갑니다');
    var exp = bOk ? boardNum('erp', 2) : null;
    setPill('gvExpBtn', 'gvExp', exp == null ? null : n(exp) + '건', exp > 0 ? 'warn' : 'ok', exp == null ? '계약 만료 임박 수는 서버 현황판(푸른이알피 카드)이 모읍니다 — ' + (bOk ? '서버 집계 전' : '현황판을 못 읽음') : '푸른이알피 카드의 «주의 신호» 숫자(서버 집계) — 현황판으로 갑니다');
  }
  function exportCsv() {
    if (!DS) return;
    var title = CUR === 12 ? '최근12개월합계' : DS.months[CUR];
    var tag = (BASIS === 'accrual' ? '귀속월' : '입금일') + (NET ? '_순액' : '_총액');
    var FO = finOk(), LO = logOk();
    var rows = [['구분', '항목', '직종/비중', '수행업무(건)', '기록률(%)', '입금기여(원)', '입금처리(건)', '기준']];
    ordered.forEach(function (p) { var v = personVal(p, CUR); rows.push(['사람별', p.name, p.kind, LO ? v.task : '못 읽음', p.recRate == null ? '' : p.recRate, FO ? v.inc : '못 읽음', FO ? v.proc : '못 읽음', tag]); });
    if (FO) {
      rows.push(['사람별', '담당 없음', '', '', '', noneVal(CUR), '', tag]);
      var t = periodTot(CUR);
      CATS().forEach(function (c) { var cv = t.cat[c.k] || 0; rows.push(['입금종류', c.name, t.inc > 0 ? Math.round(cv / t.inc * 100) + '%' : '', '', '', cv, '', tag]); });
    }
    download('데이터관리_집계_' + title + '.csv', rows.map(function (r) { return r.map(csvCell).join(','); }).join('\n'));
    showToast('지금 기간(' + title + ') 집계 CSV 를 저장했습니다 — 사람 이름이 들어 있으니 이 PC 에만 두세요.');
  }

  /* ══ 10. A~E 화면 ══ */
  var metricList = function (sel) {
    return [{ k: 'inc', name: '입금액', on: sel === 'inc', disabled: !finOk(), title: finOk() ? '' : finWhy() },
      { k: 'task', name: '수행업무', on: sel === 'task', disabled: !logOk(), title: logOk() ? '' : logWhy() },
      { k: 'proc', name: '입금 처리 건수', on: sel === 'proc', disabled: !finOk(), title: finOk() ? '' : finWhy() }];
  };
  function rebuildA(grow) {
    if (!SC.a) return;
    smsg('smA', buildBars(SC.a, aState)); smsg('smA2d', METRIC[aState.metric].ok() ? '' : METRIC[aState.metric].why());
    if (grow) SC.a.startGrow(); else SC.a.dirty = true; CH.a.dirty = true; renderATbl();
  }
  function renderATbl() {
    var M = METRIC[aState.metric], mos = MONTHS();
    if (!M.ok()) { $('aTbl').innerHTML = tblHtml(['알림'], [[M.why()]]); return; }
    var h = '<thead><tr><th class="l">이름</th>' + mos.map(function (m) { return '<th>' + esc(m) + '</th>'; }).join('') + '<th>합계</th></tr></thead><tbody>';
    var shown = 0;
    PEOPLE().forEach(function (p) {
      if (aState.hidden[p.id]) return; shown++; var s = 0;
      h += '<tr><td class="l" title="' + esc(p.name) + '"><span class="dot" style="background:' + esc(p.color) + '"></span>' + esc(p.name) + '</td>' + p.m.map(function (v) { s += v[aState.metric]; return '<td>' + (aState.metric === 'inc' ? man(v.inc) : n(v[aState.metric])) + '</td>'; }).join('') + '<td><b>' + (aState.metric === 'inc' ? man(s) : n(s)) + '</b></td></tr>';
    });
    if (!shown) h += '<tr><td class="l" colspan="' + (mos.length + 2) + '">고른 사람이 없습니다 — 위 «사람» 칩을 하나 이상 켜 주세요.</td></tr>';
    $('aTbl').innerHTML = h + '</tbody><caption style="caption-side:bottom;text-align:left;font-size:11.5px;color:#475569;padding-top:6px">단위: ' + esc(M.unit) + '</caption>';
  }
  function renderBTbl(mi) {
    var FO = finOk(), LO = logOk();
    $('bTbl').innerHTML = tblHtml(['이름', '직종', '수행업무', '기록률', '입금 기여', '입금 처리', '맡은 업체'],
      PEOPLE().map(function (p) { var v = p.m[mi]; return [p.name, p.kind, LO ? v.task + '건' : '—', p.recRate == null ? '—' : p.recRate + '%', FO ? won(v.inc) : '—', FO ? v.proc + '건' : '—', p.cos + '곳']; }), (MONTHS()[mi] || '') + ' 기준');
  }
  function setB(mi) {
    bMi = mi; $('bRange').value = mi; $('bMonth').textContent = MONTHS()[mi] || '—';
    moveBalls(SC.b, mi); CH.b.dirty = true; renderBTbl(mi);
  }
  function renderCTbl() {
    if (!DS) return;
    var nW = DS.weeks.length, head = ['이름'];
    for (var w = 0; w < nW; w++) head.push(w === nW - 1 ? '이번 주' : '-' + (nW - 1 - w) + '주');
    head.push('평균'); head.push('기록률');
    if (!logOk()) { $('cTbl').innerHTML = tblHtml(['알림'], [[logWhy()]]); return; }
    $('cTbl').innerHTML = tblHtml(head, PEOPLE().map(function (p) {
      var a = p.wkN, s = a.reduce(function (x, y) { return x + y; }, 0);
      return [p.name].concat(a.map(String)).concat([a.length ? (s / a.length).toFixed(1) : '—', p.recRate == null ? '—' : p.recRate + '%']);
    }), '단위: 건(업무 기록) · 주 열쇠는 업무관리와 같은 ISO 주');
  }
  function renderDTbl() {
    var cs = CATS().filter(function (c) { return !dHidden[c.k]; });
    if (!finOk()) { $('dTbl').innerHTML = tblHtml(['알림'], [[finWhy()]]); return; }
    $('dTbl').innerHTML = tblHtml(['달'].concat(cs.map(function (c) { return c.name; })).concat(['보이는 종류 합', '수행업무']),
      MTOT().map(function (t, m) { var s = 0; cs.forEach(function (c) { s += t.cat[c.k] || 0; }); return [MONTHS()[m]].concat(cs.map(function (c) { return man(t.cat[c.k] || 0); })).concat([man(s), logOk() ? t.task + '건' : '—']); }),
      '금액 단위: 만원 · ' + (BASIS === 'accrual' ? '귀속월' : '입금일') + ' 기준' + (NET ? ' · 수수료 뺀 순액' : '') + ' · 위 칩으로 끈 종류는 빠짐');
  }
  function renderETbl() {
    var FO = finOk(), rows = [];
    cityGroups().forEach(function (gr) {
      gr.list.forEach(function (co) {
        rows.push({ inc: co.inc12, r: [coLabel(co), gr.name, FO ? won(co.inc12) : '—', FO ? won(co.incAll) : '—', co.task + '건', co.misu === true ? co.misuMonths + '달 · ' + won(co.misuAmt) : (co.misu === false ? '없음' : '—(월정 자문 아님)')] });
      });
    });
    rows.sort(function (a, b) { return b.inc - a.inc; });
    $('eTbl').innerHTML = tblHtml(['업체', '담당', '12개월 입금', '누적 입금', '업무', '자문료 미수 추정'], rows.map(function (x) { return x.r; }),
      '미수는 매달 자문료를 걷는 업체만(이알피 erpAdvisoryDues 와 같은 규칙, 지난달까지) · 구역마다 건물은 12개월 입금이 큰 ' + CITY_MAX_PER + '곳까지만 세움');
  }
  function renderChips() {
    chipRow('allMetric', metricList(allState.metric), function (k) { allState.metric = k; rebuildAll(true); });
    chipRow('aMetric', metricList(aState.metric), function (k) { aState.metric = k; rebuildA(false); });
    chipRow('aPeople', PEOPLE().map(function (p) { return { k: p.id, name: p.name, color: p.color, off: !!aState.hidden[p.id] }; }), function (k, on) { if (on) delete aState.hidden[k]; else aState.hidden[k] = 1; rebuildA(false); }, true);
    chipRow('cMetric', [{ k: 'cnt', name: '업무 기록 건수(건/주)', on: true }, { k: 'hour', name: '근태 기준 근로시간(시간/주) — 근태 자료 연결 전', disabled: true, title: '근태 자료(data/attendance_records)를 아직 잇지 않았습니다 — 잇더라도 근로시간 확정치가 아니라 눈대중입니다' }], function () {});
    chipRow('dCats', CATS().map(function (c) { return { k: c.k, name: c.name, color: c.color, off: !!dHidden[c.k] }; }), function (k, on) { if (on) delete dHidden[k]; else dHidden[k] = 1; smsg('smD', buildRing(SC.d, dHidden)); SC.d.dirty = true; CH.d.dirty = true; renderDTbl(); }, true);
    var groups = cityGroups();
    chipRow('eDist', [{ k: null, name: '모두', on: eState.focus == null }].concat(groups.map(function (g) { return { k: g.key, name: g.name, color: g.color, on: eState.focus === g.key }; })), function (k) { eState.focus = k; E2D.off = 0; smsg('smE', buildCity(SC.e, eState)); SC.e.dirty = true; CH.e.dirty = true; });
    var eFO = finOk();
    chipRow('eSort', Object.keys(E2D_SORTS).map(function (k) { return { k: k, name: E2D_SORTS[k], on: (eFO ? E2D.sort : 'task') === k, disabled: !eFO && k !== 'task', title: !eFO && k !== 'task' ? '입금을 못 읽어 업무 많은 차례로만 봅니다' : '' }; }), function (k) { E2D.sort = k; E2D.off = 0; CH.e.dirty = true; });
  }
  function rebuildScenes(grow) {
    refreshBMax();
    rebuildAll(!grow); rebuildA(grow);
    var mx = Math.max(0, MONTHS().length - 1); if (bMi > mx) bMi = mx;
    $('bRange').max = String(mx); $('bRange').value = String(bMi); $('bMonth').textContent = MONTHS()[bMi] || '—';
    smsg('smB', buildBalls(SC.b, bMi, bTrail)); smsg('smB2d', PEOPLE().length ? '' : '보일 사람이 없습니다'); renderBTbl(bMi);
    smsg('smC', buildRidges(SC.c)); smsg('smC2d', logOk() ? '' : logWhy()); $('cNote').textContent = cNoteText(); renderCTbl();
    smsg('smD', buildRing(SC.d, dHidden)); smsg('smD2d', (finOk() || logOk()) ? '' : finWhy()); renderDTbl();
    smsg('smE', buildCity(SC.e, eState)); smsg('smE2d', cityGroups().length ? '' : '보일 업체가 없습니다'); renderETbl();
    if (grow) [SC.b, SC.c, SC.d, SC.e].forEach(function (s) { s.startGrow(); });
    L3.dirtyAll();
  }
  function syncToggles() {
    var bb = $('btnBasisToggle'); setPressed(bb, BASIS === 'accrual'); bb.textContent = BASIS === 'accrual' ? '📅 기준: 귀속월(업무월)' : '📅 기준: 입금일';
    var nb = $('btnNetToggle'); setPressed(nb, NET); nb.textContent = NET ? '💳 금액: 수수료 차감 순액' : '💳 금액: 수수료 전 총액';
    var kb = $('btnKpiSwap'); setPressed(kb, useCard4Per); kb.textContent = useCard4Per ? '4번 카드: 주의·병목 앱 보기' : '4번 카드: 업무 1건당 입금 보기';
  }
  function renderSrcLine() {
    var parts = [['재무관리 입금(확정분)', SRC.fin], ['업무관리 주간기록', SRC.logs], ['이알피 업체 담당자', SRC.co], ['인사 명부', SRC.dir], ['업무관리 업무건', SRC.items]];
    var bad = parts.filter(function (p) { return p[1] && !p[1].ok; }).map(function (p) { return p[0] + ' 못 읽음(' + p[1].why + ')'; });
    $('srcLine').textContent = '자료: ' + parts.map(function (p) { return p[0]; }).join(' · ') + ' — 집계 ' + fmtAt(Date.now()) + ' · ' + (BASIS === 'accrual' ? '귀속월' : '입금일') + ' 기준 · 원본은 «읽기만» 합니다(고치지도 지우지도 않음)' + (bad.length ? ' · ⚠ ' + bad.join(' · ') : '');
  }
  function renderAuditQ() {
    var q = DS ? DS.quality : null; if (!q) { $('auditQ').innerHTML = '<div>집계 전</div>'; return; }
    var L = [['입금 줄(읽음)', q.incomeRows], ['쓴 줄(12개월)', q.used], ['휴지통', q.deleted], ['되돌림', q.undone], ['성과조정', q.adjust], ['과거기록', q.historical], ['개인수익', q.personal], ['날짜 없음', q.noDate],
      ['12개월 밖', q.outOfRange], ['성과 몫으로 나눔', q.viaShares], ['업체 주담당 몫', q.viaCompany], ['담당 없음', q.noOwner], ['카드 수수료 있는 줄', q.cardFeeRows], ['귀속월≠입금월', q.accrualDiffRows],
      ['업무 기록 줄', q.logRows], ['사번 없는 기록', q.logNoBy], ['기간 밖 기록', q.logOutOfRange]];
    $('auditQ').innerHTML = (finOk() ? '' : '<div style="grid-column:1/-1;color:#991b1b">' + esc(finWhy()) + '</div>') + L.map(function (x) { return '<div title="' + esc(x[0]) + '">' + esc(x[0]) + '<b>' + n(x[1]) + '</b></div>'; }).join('');
  }
  function renderAll(first) {
    if (!DS) return;
    if (first) { applyPeriodFromSettings(); }
    renderPeriodSelect(); renderMonthScrub(); syncToggles();
    renderKpis(); renderTbl(); renderCatBreakdown(); renderChips();
    rebuildScenes(first);
    renderBoard(); renderGovbar(); renderSrcLine(); renderAuditQ();
    $('lkInc').textContent = finOk() ? won(MTOT()[11] ? MTOT()[11].inc : null) : '못 읽음';
    $('lkTask').textContent = logOk() ? n(MTOT()[11] ? MTOT()[11].task : null) + '건' : '못 읽음';
    multiInit(); refreshMultiAll(false);
    sideDash();
    if (first && SET.view && SET.view !== 'all') { var t = document.querySelector('.side button[data-v="' + SET.view + '"]'); if (t) { VIEW = SET.view; t.click(); } }   /* 되살리기만 — 다시 저장하지 않는다 */
  }

  /* ══ 11. 프로그램 현황판 — 서버가 한 시간마다 모은 datahub_board/{앱 key} 만 읽는다 ══
     카드 목록·주소는 공용 앱바의 고정 목록(PuAppBar.APPS)에서 — 집계 자료에서 온 주소로는 열지 않는다. */
  var BST = { ok: { n: '정상', c: 'b-ok' }, warn: { n: '주의', c: 'b-warn' }, bad: { n: '위험', c: 'b-lock' }, nobase: { n: '기준 전', c: 'b-info' }, na: { n: '못 모음', c: 'b-nil' } };
  var BORD = { bad: 0, warn: 1, nobase: 2, ok: 3, na: 4 };
  var ROWNAME = { client: '의뢰인 업무', store: '자료함', sales: '영업관리', inside: '내부관리' };
  var bState = { row: null, warnOnly: false, warnFirst: false, hideNa: false };
  function appList() {
    var A = (global.PuAppBar && Array.isArray(global.PuAppBar.APPS)) ? global.PuAppBar.APPS : [], seen = {}, out = [];
    A.forEach(function (a) { if (!a || !a.key || a.key === 'datahub' || seen[a.key]) return; seen[a.key] = 1; out.push(a); });
    return out;
  }
  function boardVal(v) { if (fin(v)) return n(v); if (v == null || v === '') return '—'; return str(v).slice(0, 24); }
  function boardCards() {
    var bOk = SRC.board && SRC.board.ok;
    return appList().map(function (a) {
      var r = BOARD_RAW[a.key], c = { key: a.key, name: str(a.name), row: a.row, url: a.url, off: !!a.off, n: null, bar: null, at: null };
      if (!bOk) { c.st = 'na'; c.why = SRC.board ? '현황판을 못 읽음(' + SRC.board.why + ')' : '불러오는 중'; return c; }
      if (!r || typeof r !== 'object') { c.st = 'na'; c.why = c.off ? '지금 안 쓰는 앱' : '서버 집계 전 — 서버가 한 시간마다 «건수·비율만» 모읍니다'; return c; }
      c.at = r.at;
      if (r.state === 'na') { c.st = 'na'; c.why = str(r.why) || '서버가 셀 자료가 없는 앱'; return c; }
      c.n = (Array.isArray(r.n) ? r.n : []).slice(0, 3).map(function (x) { return { label: str(x && x.label) || '—', v: x ? x.v : null }; });
      while (c.n.length < 3) c.n.push({ label: '—', v: null });
      var bp = r.bar ? Number(r.bar.pct) : NaN;
      c.bar = (r.bar && isFinite(bp)) ? { name: str(r.bar.name) || '비율', pct: clamp(Math.round(bp), 0, 100) } : null;
      var th = thrBoard(a.key), sig = c.n[2].v; sig = fin(sig) ? sig : (sig != null && sig !== '' && isFinite(Number(sig)) ? Number(sig) : null);
      if (!th || sig == null) c.st = 'nobase';
      else if (th.b != null && sig >= th.b) c.st = 'bad';
      else if (th.w != null && sig >= th.w) c.st = 'warn';
      else c.st = 'ok';
      return c;
    });
  }
  function boardCount(L) { var c = { ok: 0, warn: 0, bad: 0, nobase: 0, na: 0 }; L.forEach(function (p) { c[p.st]++; }); return c; }
  function two(i) { return pad2(i + 1); }
  function pgHtml(p, i) {
    var s = BST[p.st] || BST.ok;
    var body;
    if (p.st === 'na') body = '<div class="pg-na">' + esc(p.why || '숫자를 모을 자료가 없습니다') + '</div>';
    else body = '<div class="pg-k">' + p.n.map(function (x, j) {
      var cls = (j === 2 && p.st === 'warn') ? ' class="w"' : ((j === 2 && p.st === 'bad') ? ' class="x"' : '');
      return '<div' + cls + ' title="' + esc(x.label + ' · ' + boardVal(x.v)) + '"><span>' + esc(x.label) + '</span><b>' + esc(boardVal(x.v)) + '</b></div>';
    }).join('') + '</div>';
    var foot = (p.st !== 'na' && p.bar) ? '<div class="pg-bar" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + p.bar.pct + '" aria-label="' + esc(p.bar.name) + '"><i style="width:' + p.bar.pct + '%"></i></div>' +
      '<div class="pg-f"><span title="' + esc(p.bar.name) + '">' + esc(p.bar.name) + '</span><span class="sp"></span><span>' + p.bar.pct + '%</span></div>' : '';
    var tag = p.at ? '집계 ' + fmtAt(p.at).slice(5) : (ROWNAME[p.row] || '');
    return '<article class="pg st-' + esc(p.st) + '" aria-label="' + esc(p.name + ' — ' + s.n) + '"><div class="pg-h"><span class="no">' + two(i) + '</span><b title="' + esc(p.name) + '">' + esc(p.name) + '</b>' +
      (p.st !== 'ok' ? '<span class="badge ' + s.c + '">' + s.n + '</span>' : '') + '<span class="tag" title="' + esc(tag) + '">' + esc(tag) + '</span>' +
      '<button class="open" type="button" data-open="' + esc(p.key) + '" title="' + esc(p.name) + ' 새 탭으로 열기" aria-label="' + esc(p.name) + ' 새 탭으로 열기">↗</button></div>' + body + foot + '</article>';
  }
  function boardList(all) {
    var L = all.filter(function (p) {
      if (bState.hideNa && p.st === 'na') return false;
      return (!bState.row || p.row === bState.row) && (!bState.warnOnly || p.st === 'warn' || p.st === 'bad');
    });
    if (bState.warnFirst) L = L.slice().sort(function (a, b) { return (BORD[a.st] - BORD[b.st]) || (all.indexOf(a) - all.indexOf(b)); });
    return L;
  }
  function lastBoardAt(all) { var m = 0; all.forEach(function (p) { var t = fin(p.at) ? p.at : Date.parse(p.at || ''); if (isFinite(t) && t > m) m = t; }); return m; }
  function renderBoard() {
    var all = boardCards(), L = boardList(all), c = boardCount(all), at = lastBoardAt(all);
    $('board').innerHTML = L.length ? L.map(pgHtml).join('') : '<div class="empty">고른 조건에 맞는 앱이 없습니다 — «포털 줄»을 «모두»로 바꾸거나 «주의·위험만»을 꺼 주세요.</div>';
    $('bSum').innerHTML = '<b>' + all.length + '개 앱</b><span class="badge b-ok">정상 ' + c.ok + '</span><span class="badge b-warn">주의 ' + c.warn + '</span><span class="badge b-lock">위험 ' + c.bad + '</span>' +
      '<span class="badge b-info" title="숫자는 있으나 대표가 아직 주의 기준을 정하지 않은 앱 — 색을 칠하지 않음">기준 전 ' + c.nobase + '</span><span class="badge b-nil" title="서버 집계 전 · 브라우저 안 저장 · 자기 자료 없음 · 준비 중">못 모음 ' + c.na + '</span>' +
      '<span class="sp"></span><span class="when">' + (at ? '마지막 서버 집계 ' + esc(fmtAt(at)) : '서버 집계 전') + ' · 지금 보이는 ' + L.length + '장</span>';
    $('bHideNa').textContent = '못 모음(회색 ' + c.na + '장) 숨기기';
    $('boardTbl').innerHTML = tblHtml(['№', '프로그램', '상태', '숫자 ①', '숫자 ②', '숫자 ③', '막대', '집계 시각'],
      L.map(function (p, i) { return [two(i), p.name, BST[p.st].n].concat(p.st === 'na' ? ['—', '—', '—'] : p.n.map(function (x) { return x.label + ' ' + boardVal(x.v); })).concat([p.st === 'na' ? (p.why || '—') : (p.bar ? p.bar.name + ' ' + p.bar.pct + '%' : '—'), p.at ? fmtAt(p.at) : '—']); }),
      '숫자는 서버가 모아 둔 건수·비율뿐(이름·금액·본문 없음) · 휴지통·종료·되돌린 건은 각 앱 거르개대로 세지 않음 · 색은 대표가 정한 기준으로만');
    var warnNames = all.filter(function (p) { return p.st === 'warn' || p.st === 'bad'; }).map(function (p) { return p.name; });
    $('stripSum').textContent = '정상 ' + c.ok + ' · 주의 ' + c.warn + ' · 위험 ' + c.bad + ' · 기준 전 ' + c.nobase + ' · 못 모음 ' + c.na + (warnNames.length ? ' — ' + warnNames.join(', ') : '');
  }
  function boardOpen(e) {
    var b = e.target.closest('[data-open]'); if (!b) return;
    var a = appList().filter(function (x) { return x.key === b.getAttribute('data-open'); })[0]; if (!a || !a.url) return;
    try { global.open(a.url, '_blank', 'noopener'); } catch (err) {}
    $('bMsg').textContent = '«' + a.name + '» 를 새 탭으로 열었습니다 — 고치는 일은 그 앱에서 합니다.';
  }

  /* ══ 12. 연결 지도 — ontology/v1 을 읽기만. 이름은 화면 안에서만 붙이고 저장하지 않는다 ══ */
  var GTYPE = { Organization: { n: '업체', c: '#2563eb' }, Contract: { n: '계약', c: '#0e7490' }, Case: { n: '사건', c: '#a21caf' }, Project: { n: '사업', c: '#c2410c' },
    Task: { n: '업무', c: '#64748b' }, Person: { n: '사람', c: '#5b21b6' }, FinancialTransaction: { n: '입금', c: '#16a34a' }, Document: { n: '문서', c: '#4d7c0f' }, ScheduleEvent: { n: '일정', c: '#be185d' } };
  var GPRED = { contractedWith: '계약 상대', concerns: '사건 업체', projectFor: '사업 업체', assignedTo: '주담당', assists: '보조', derivedFrom: '나온 곳',
    paidFor: '입금 대상', attachedTo: '붙은 곳', scheduledFor: '일정 대상', appLink: '자료 연결' };
  var GROWC = { client: '#2563eb', store: '#0e7490', sales: '#c2410c', inside: '#5b21b6' };
  var G_LIMIT = 600;
  var ONT = { state: 'idle' };
  var G = { cv: null, g: null, w: 0, h: 0, N: [], E: [], adj: [], act: [], on: [], cam: { x: 0, y: 0, z: 1 }, hot: -1, sel: -1, focus: -1, depth: 1, alpha: 0,
    kind: 'ent', mode: 'focus', hidden: {}, labels: false, dirty: true, visible: false, drag: null, flowT: 0 };
  function gTypeName(nd) { return nd.type === 'App' ? '앱' : ((GTYPE[nd.type] || {}).n || (global.PuOntology && PuOntology.TERMS && PuOntology.TERMS.entityTypes[nd.type]) || '기타'); }
  function gColor(nd) { return nd.type === 'App' ? (GROWC[nd.row] || '#64748b') : ((GTYPE[nd.type] || {}).c || '#64748b'); }
  function gR(nd) { return nd.type === 'App' ? Math.min(20, 6.5 + Math.sqrt(nd.wsum || 0) / 3.1) : Math.min(13.5, 3.5 + Math.sqrt(nd.deg) * 1.75); }
  function loadOntology(my) {
    ONT = { state: 'loading' }; gMsgSet('관계망을 불러오는 중…');
    DB.ref('ontology/v1/current').once('value').then(function (s) {
      if (my !== EPOCH) return;
      var gen = s ? s.val() : null;
      if (!gen || typeof gen !== 'string' || /[.#$\[\]\/]/.test(gen)) { ONT = { state: 'none' }; afterOnt(); return; }
      var parts = ['internal', 'source', 'personal', 'financial'], miss = [];
      var ent = {}, edg = {};
      var reads = [DB.ref('ontology/v1/gen/' + gen + '/meta').once('value').then(function (x) { ONT.meta = x ? x.val() : null; }, function () {})];
      parts.forEach(function (vis) {
        reads.push(DB.ref('ontology/v1/gen/' + gen + '/' + vis + '/entities').once('value').then(function (x) { var v = x ? x.val() : null; if (v && typeof v === 'object') Object.keys(v).forEach(function (k) { ent[k] = v[k]; }); }, function () { miss.push(vis); }));
        reads.push(DB.ref('ontology/v1/gen/' + gen + '/' + vis + '/edges').once('value').then(function (x) { var v = x ? x.val() : null; if (v && typeof v === 'object') Object.keys(v).forEach(function (k) { edg[k] = v[k]; }); }, function () { if (miss.indexOf(vis) < 0) miss.push(vis); }));
      });
      ONT.gen = gen;
      return Promise.all(reads).then(function () {
        if (my !== EPOCH) return;
        ONT.state = 'ok'; ONT.ent = ent; ONT.edg = edg; ONT.miss = miss;
        afterOnt();
      });
    }, function (e) { if (my !== EPOCH) return; ONT = { state: 'err', why: why(e) }; afterOnt(); });
  }
  /* 이름 붙이기 — 이미 읽은 업체 목록·명부에서 화면 안에서만. 못 찾으면 «종류 + 번호» (사번·내부 id 는 글자로 쓰지 않는다) */
  function ontLabelMaps() {
    var co = {}, pp = {};
    RAW.companies.forEach(function (c) { if (c && c.id) co[c.id] = str(c.name); });
    RAW.userDir.forEach(function (u) { if (u && u.sid) pp[u.sid] = str(u.name); });
    return { co: co, pp: pp };
  }
  function gEntityData() {
    var N = [], E = [], ix = {}, L = ontLabelMaps(), cnt = {};
    Object.keys(ONT.ent || {}).sort().forEach(function (k) {
      var e = ONT.ent[k] || {}, type = str(e.type) || 'Document', id = str(e.id), label = '';
      if (type === 'Organization') label = L.co[id] || '';
      else if (type === 'Person') label = L.pp[id] || '명부에 없음';
      cnt[type] = (cnt[type] || 0) + 1;
      if (!label) label = gTypeName({ type: type }) + ' ' + (e.no ? String(e.no) : '#' + cnt[type]);
      ix[k] = N.length; N.push({ key: k, type: type, label: label, prog: str(e.program) || 'erp' });
    });
    Object.keys(ONT.edg || {}).forEach(function (k) {
      var e = ONT.edg[k] || {}; if (ix[e.subject] == null || ix[e.object] == null) return;
      E.push({ s: ix[e.subject], t: ix[e.object], p: str(e.predicate) });
    });
    return { nodes: N, edges: E, kind: 'ent' };
  }
  function gAppData() {
    var N = [], E = [], ix = {}, pair = {};
    appList().forEach(function (a) { ix[a.key] = N.length; N.push({ key: 'A:' + a.key, type: 'App', label: str(a.name), prog: a.key, row: a.row }); });
    var progOf = {}; Object.keys(ONT.ent || {}).forEach(function (k) { progOf[k] = str((ONT.ent[k] || {}).program) || 'erp'; });
    Object.keys(ONT.edg || {}).forEach(function (k) {
      var e = ONT.edg[k] || {}, a = progOf[e.subject], b = progOf[e.object];
      if (!a || !b || a === b || ix[a] == null || ix[b] == null) return;
      var key = a < b ? a + '|' + b : b + '|' + a; pair[key] = (pair[key] || 0) + 1;
    });
    Object.keys(pair).forEach(function (k) { var ab = k.split('|'); E.push({ s: ix[ab[0]], t: ix[ab[1]], p: 'appLink', w: pair[k], d: '두 앱 자료 사이 확정 연결' }); });
    return { nodes: N, edges: E, kind: 'app' };
  }
  function gMsgSet(t) { var el = $('gMsg'); if (el) el.textContent = t || ''; }
  function afterOnt() {
    if (ONT.state === 'none') { smsg('smG', '관계망이 아직 올라오지 않았습니다 — 이알피 «온톨로지 진단»에서 «관계망 올리기»를 누르면 생깁니다.'); gMsgSet(''); G.N = []; G.E = []; G.act = []; gSideHtml(); gTable(); sideDash(); return; }
    if (ONT.state === 'err') { smsg('smG', '관계망을 읽지 못했습니다(' + ONT.why + ')'); gMsgSet(''); G.N = []; G.E = []; G.act = []; gSideHtml(); gTable(); sideDash(); return; }
    if (ONT.state !== 'ok') return;
    var at = ONT.meta && ONT.meta.generatedAt ? Date.parse(ONT.meta.generatedAt) : NaN;
    var old = isFinite(at) && (Date.now() - at) > 14 * 864e5;
    gMsgSet('관계망 판 ' + ONT.gen + (isFinite(at) ? ' · 올린 시각 ' + fmtAt(at) : '') + (old ? ' · ⚠ 2주가 넘었습니다 — 이알피 «온톨로지 진단»에서 다시 올려 주세요' : '') + (ONT.miss && ONT.miss.length ? ' · 못 읽은 칸: ' + ONT.miss.join('·') + '(권한)' : ''));
    smsg('smG', '');
    gSetMode(G.mode);
  }
  function gSetMode(mode) {
    G.mode = mode;
    $('gTypes').style.display = mode === 'app' ? 'none' : ''; $('gDepth').style.display = mode === 'app' ? 'none' : '';
    if (ONT.state !== 'ok') return;
    if (mode === 'app') { gSet(gAppData()); return; }
    var data = gEntityData();
    G.focus = -1;
    gSet(data, true);
    if (mode === 'focus') {
      /* 기본 — 연결이 가장 많은 업체 하나 중심 1걸음 */
      var best = -1, bd = -1; G.N.forEach(function (nd, i) { if (nd.type === 'Organization' && nd.deg > bd) { bd = nd.deg; best = i; } });
      if (best >= 0) gSetFocus(best);
      else { smsg('smG', '관계망에 업체 점이 없습니다 — «전체» 보기에서 종류를 골라 보세요'); G.act = []; G.on = G.N.map(function () { return false; }); gAfter(); }
    } else {
      gActive(); gLayout(); gAfter();
    }
  }
  function gSet(data, deferLayout) {
    G.kind = data.kind; G.N = data.nodes; G.E = data.edges; G.hot = -1; G.sel = -1; G.focus = -1;
    G.adj = G.N.map(function () { return []; });
    G.N.forEach(function (nd, i) { nd.deg = 0; nd.wsum = 0; var a = i * 2.399963, r = 12 * Math.sqrt(i + 1); nd.x = Math.cos(a) * r; nd.y = Math.sin(a) * r; nd.vx = 0; nd.vy = 0; nd.fx = false; });
    G.E.forEach(function (e, k) { G.adj[e.s].push(k); G.adj[e.t].push(k); G.N[e.s].deg++; G.N[e.t].deg++; G.N[e.s].wsum += (e.w || 1); G.N[e.t].wsum += (e.w || 1); });
    if (!deferLayout) { gActive(); gLayout(); gAfter(); }
  }
  function gActive() {
    var ok = G.N.map(function (nd) { return !G.hidden[nd.type]; });
    if (G.focus >= 0) {
      var dist = G.N.map(function () { return -1; }), q = [G.focus]; dist[G.focus] = 0; ok[G.focus] = true;
      while (q.length) { var i = q.shift(); if (dist[i] >= G.depth) continue;
        G.adj[i].forEach(function (k) { var e = G.E[k], j = e.s === i ? e.t : e.s; if (dist[j] < 0 && ok[j]) { dist[j] = dist[i] + 1; q.push(j); } }); }
      ok = dist.map(function (d) { return d >= 0; });
    }
    G.on = ok; G.act = []; ok.forEach(function (v, i) { if (v) G.act.push(i); });
    G.tooMany = G.act.length > G_LIMIT && G.kind === 'ent';
    if (G.tooMany) { smsg('smG', '보이는 점이 ' + n(G.act.length) + '개라 실타래가 됩니다 — «종류»를 거르거나 «업체 하나 중심»으로 보세요(' + G_LIMIT + '개까지 그림)'); G.on = G.N.map(function () { return false; }); G.act = []; }
    else if (ONT.state === 'ok') smsg('smG', '');
    if (G.sel >= 0 && !G.on[G.sel]) G.sel = -1;
  }
  function gLayout() { G.alpha = 1; gSim(G.act.length > 300 ? 110 : 320); gFit(); }
  function gSim(ticks) {
    var A = G.act, Ln = G.kind === 'app' ? 122 : 54, K = G.kind === 'app' ? 2700 : 720;
    for (var t = 0; t < ticks && G.alpha > 0.01; t++) {
      var al = G.alpha;
      for (var a = 0; a < A.length; a++) { var p = G.N[A[a]], cp = 1 + p.deg / 5;
        for (var b = a + 1; b < A.length; b++) { var q = G.N[A[b]], dx = p.x - q.x, dy = p.y - q.y, d2 = dx * dx + dy * dy + 0.01;
          if (d2 > 160000) continue; var f = K * cp * (1 + q.deg / 5) / d2 * al, d = Math.sqrt(d2); f = Math.min(f, 40); dx /= d; dy /= d; p.vx += dx * f; p.vy += dy * f; q.vx -= dx * f; q.vy -= dy * f; } }
      G.E.forEach(function (e) { if (!G.on[e.s] || !G.on[e.t]) return; var p2 = G.N[e.s], q2 = G.N[e.t], dx2 = q2.x - p2.x, dy2 = q2.y - p2.y, d3 = Math.sqrt(dx2 * dx2 + dy2 * dy2) + 0.01, f2 = (d3 - Ln) * 0.04 * al;
        dx2 /= d3; dy2 /= d3; p2.vx += dx2 * f2; p2.vy += dy2 * f2; q2.vx -= dx2 * f2; q2.vy -= dy2 * f2; });
      A.forEach(function (i) { var nd = G.N[i]; nd.vx -= nd.x * 0.012 * al; nd.vy -= nd.y * 0.012 * al;
        if (nd.fx) { nd.vx = 0; nd.vy = 0; return; } nd.vx *= 0.6; nd.vy *= 0.6; nd.x += clamp(nd.vx, -30, 30); nd.y += clamp(nd.vy, -30, 30); });
      G.alpha *= 0.985;
    }
  }
  function gFit() {
    if (!G.act.length || !G.w) return;
    var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; G.act.forEach(function (i) { var nd = G.N[i]; x0 = Math.min(x0, nd.x); y0 = Math.min(y0, nd.y); x1 = Math.max(x1, nd.x); y1 = Math.max(y1, nd.y); });
    G.cam.x = (x0 + x1) / 2; G.cam.y = (y0 + y1) / 2; G.cam.z = clamp(Math.min((G.w - 64) / Math.max(40, x1 - x0), (G.h - 64) / Math.max(40, y1 - y0)), 0.25, 3); G.dirty = true;
  }
  function gFitCanvas() {
    var r = G.cv.getBoundingClientRect(), dpr = Math.min(2, global.devicePixelRatio || 1); if (r.width < 2 || r.height < 2) return false;
    var W = Math.round(r.width * dpr), H = Math.round(r.height * dpr); if (G.cv.width !== W || G.cv.height !== H) { G.cv.width = W; G.cv.height = H; }
    var first = !G.w; G.w = r.width; G.h = r.height; G.g.setTransform(dpr, 0, 0, dpr, 0, 0); if (first) gFit(); G.dirty = true; return true;
  }
  function gS(nd) { return [(nd.x - G.cam.x) * G.cam.z + G.w / 2, (nd.y - G.cam.y) * G.cam.z + G.h / 2]; }
  function gHL() { var h = G.sel >= 0 ? G.sel : G.hot; if (h < 0) return null; var s = {}; s[h] = 1; G.adj[h].forEach(function (k) { var e = G.E[k]; if (G.on[e.s] && G.on[e.t]) { s[e.s] = 1; s[e.t] = 1; } }); return { i: h, set: s }; }
  function gRender() {
    if (!G.w) return;
    var g = G.g, hl = gHL(), z = G.cam.z;
    if (ST.dark) { g.fillStyle = '#1e293b'; g.fillRect(0, 0, G.w, G.h); var rg = g.createRadialGradient(G.w * 0.5, G.h * 0.5, 10, G.w * 0.5, G.h * 0.5, Math.max(G.w, G.h) * 0.6); rg.addColorStop(0, 'rgba(37,99,235,.18)'); rg.addColorStop(1, 'rgba(30,41,59,0)'); g.fillStyle = rg; g.fillRect(0, 0, G.w, G.h); }
    else { g.fillStyle = '#ffffff'; g.fillRect(0, 0, G.w, G.h); }
    G.E.forEach(function (e, ei) {
      if (!G.on[e.s] || !G.on[e.t]) return;
      var a = gS(G.N[e.s]), b = gS(G.N[e.t]), adj = hl && (e.s === hl.i || e.t === hl.i);
      var dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1, bend = Math.min(22, len * 0.09) * ((ei % 2 === 0) ? 1 : -1);
      var cx = (a[0] + b[0]) * 0.5 - dy / len * bend, cy = (a[1] + b[1]) * 0.5 + dx / len * bend;
      g.globalAlpha = hl ? (adj ? 0.92 : 0.08) : (ST.dark ? 0.42 : 0.48);
      g.strokeStyle = adj ? (ST.dark ? '#60a5fa' : '#2563eb') : '#94a3b8';
      g.lineWidth = (G.kind === 'app' ? 1.2 + Math.log(1 + (e.w || 1)) / Math.LN10 * 1.4 : (adj ? 1.9 : 0.95));
      g.beginPath(); g.moveTo(a[0], a[1]); g.quadraticCurveTo(cx, cy, b[0], b[1]); g.stroke();
      if (adj && !REDUCE) { var u = (G.flowT + (ei * 0.17)) % 1, iu = 1 - u, px = iu * iu * a[0] + 2 * iu * u * cx + u * u * b[0], py = iu * iu * a[1] + 2 * iu * u * cy + u * u * b[1]; g.globalAlpha = 0.95; g.fillStyle = ST.dark ? '#bfdbfe' : '#2563eb'; g.beginPath(); g.arc(px, py, 2.5, 0, 6.2832); g.fill(); }
      if (G.kind === 'app' && (adj || z > 1.35)) {
        g.globalAlpha = hl && !adj ? 0.15 : 1; g.font = '700 11px Pretendard,"Malgun Gothic",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        var mx = 0.25 * a[0] + 0.5 * cx + 0.25 * b[0], my = 0.25 * a[1] + 0.5 * cy + 0.25 * b[1], t = n(e.w || 0);
        g.lineWidth = 3.5; g.strokeStyle = ST.dark ? '#1e293b' : '#ffffff'; g.strokeText(t, mx, my); g.fillStyle = ST.dark ? '#bfdbfe' : '#475569'; g.fillText(t, mx, my);
      }
    });
    g.globalAlpha = 1;
    G.act.forEach(function (i) {
      var nd = G.N[i], s = gS(nd), r = Math.max(2.6, gR(nd) * Math.sqrt(z)), dim = hl && !hl.set[i];
      var rgb = hex2rgb(gColor(nd)); if (ST.dark) rgb = shade(rgb, 0.20);
      g.globalAlpha = dim ? 0.16 : 1;
      if (!dim && (nd.deg >= 6 || G.kind === 'app' || i === G.sel || i === G.hot)) { var halo = g.createRadialGradient(s[0], s[1], r * 0.6, s[0], s[1], r * 2.1); halo.addColorStop(0, rgba(rgb, ST.dark ? 0.36 : 0.20)); halo.addColorStop(1, rgba(rgb, 0)); g.fillStyle = halo; g.beginPath(); g.arc(s[0], s[1], r * 2.1, 0, 6.2832); g.fill(); }
      var ng = g.createRadialGradient(s[0] - r * 0.3, s[1] - r * 0.3, r * 0.1, s[0], s[1], r); ng.addColorStop(0, rgba(shade(rgb, 0.45), 1)); ng.addColorStop(1, rgba(shade(rgb, -0.15), 1));
      g.fillStyle = ng; g.beginPath(); g.arc(s[0], s[1], r, 0, 6.2832); g.fill();
      if (i === G.sel || i === G.focus) { g.lineWidth = 2.8; g.strokeStyle = i === G.sel ? (ST.dark ? '#ffffff' : '#1e293b') : '#fbbf24'; g.stroke(); }
      else if (i === G.hot) { g.lineWidth = 2; g.strokeStyle = ST.dark ? '#ffffff' : '#1e293b'; g.stroke(); }
    });
    g.font = '700 12px Pretendard,"Malgun Gothic",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'top';
    G.act.forEach(function (i) {
      var nd = G.N[i], show = G.labels || G.kind === 'app' || z >= 1.6 || (hl && hl.set[i]) || (nd.deg >= 9 && z >= 0.8);
      if (!show || (hl && !hl.set[i] && !G.labels && G.kind !== 'app')) return;
      var s = gS(nd), r = Math.max(2.6, gR(nd) * Math.sqrt(z)), t = nd.label.length > 14 ? nd.label.slice(0, 13) + '…' : nd.label;
      g.globalAlpha = hl && !hl.set[i] ? 0.25 : 1;
      g.lineWidth = 3.6; g.strokeStyle = ST.dark ? 'rgba(30,41,59,.92)' : '#ffffff'; g.strokeText(t, s[0], s[1] + r + 4);
      g.fillStyle = ST.dark ? '#f8fafc' : '#1e293b'; g.fillText(t, s[0], s[1] + r + 4);
    });
    g.globalAlpha = 1;
  }
  function gPick(x, y) { var best = -1, bd = 1e9; G.act.forEach(function (i) { var s = gS(G.N[i]), r = Math.max(3, gR(G.N[i]) * Math.sqrt(G.cam.z)) + 5, d = Math.hypot(s[0] - x, s[1] - y); if (d <= r && d < bd) { bd = d; best = i; } }); return best; }
  function gPt(e) { var r = G.cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  function gCenter(i) { var nd = G.N[i]; if (!nd) return; G.cam.x = nd.x; G.cam.y = nd.y; if (G.cam.z < 1.2) G.cam.z = 1.4; G.dirty = true; }
  function gSelect(i, center) { G.sel = i; if (center && i >= 0) gCenter(i); G.dirty = true; gSideHtml(); }
  function gSetFocus(i) { G.focus = i; if (i >= 0) G.sel = i; gActive(); G.alpha = 0.9; gSim(160); gFit(); gAfter(); }
  function gAfter() { gSideHtml(); gTable(); gDepthState(); gFindRender(); sideDash(); G.dirty = true; }
  function gFindRender() {
    var inp = $('gFind'), box = $('gFound'); if (!inp || !box) return;
    var q = inp.value.trim().toLowerCase(); if (!q) { box.innerHTML = ''; return; }
    /* 찾기는 보이는 점만이 아니라 관계망 전체에서 — 누르면 그 건 중심으로 옮긴다 */
    var hit = []; for (var i = 0; i < G.N.length && hit.length < 8; i++) if (G.N[i].label.toLowerCase().indexOf(q) >= 0) hit.push(i);
    box.innerHTML = hit.length ? hit.map(function (i) { return gNbBtn(i, gTypeName(G.N[i])).replace('class="nb"', 'class="chip"'); }).join('') : '<span style="font-size:12.5px;color:#475569">찾은 것이 없습니다 — 숨긴 종류가 있으면 «종류»를 켜 보세요.</span>';
  }
  function gNeighborsByPred(i) {
    var groups = {}; G.adj[i].forEach(function (k) { var e = G.E[k]; if (!G.on[e.s] || !G.on[e.t]) return; var j = e.s === i ? e.t : e.s, out = e.s === i;
      var key = G.kind === 'app' ? '이어진 앱' : (GPRED[e.p] || e.p) + (out ? ' →' : ' ←'); (groups[key] = groups[key] || []).push({ j: j, e: e }); });
    return groups;
  }
  function gSideHtml() {
    var box = $('gSide'), h = '';
    if (ONT.state !== 'ok') { box.innerHTML = '<h4><span>🕸</span><span>관계망</span></h4><p>' + esc(ONT.state === 'none' ? '관계망이 아직 올라오지 않았습니다(이알피 온톨로지 진단에서 올림).' : (ONT.state === 'err' ? '관계망을 읽지 못했습니다(' + ONT.why + ').' : '불러오는 중…')) + '</p>'; return; }
    if (!G.act.length) { box.innerHTML = '<h4><span>🕸</span><span>보이는 점이 없습니다</span></h4><p>' + (G.tooMany ? '점이 너무 많습니다 — 종류를 거르세요.' : '«종류»를 모두 껐거나 고른 건에 이어진 곳이 없습니다.') + '</p>'; return; }
    if (G.sel < 0) {
      var cnt = {}, ne = 0; G.act.forEach(function (i) { var t = gTypeName(G.N[i]); cnt[t] = (cnt[t] || 0) + 1; }); G.E.forEach(function (e) { if (G.on[e.s] && G.on[e.t]) ne++; });
      var wk = G.kind === 'app' ? 'wsum' : 'deg', top = G.act.slice().sort(function (a, b) { return G.N[b][wk] - G.N[a][wk]; }).slice(0, 6);
      var lone = G.act.filter(function (i) { return !G.adj[i].some(function (k) { var e = G.E[k]; return G.on[e.s] && G.on[e.t]; }); });
      h += '<h4><span>🕸</span><span>' + (G.kind === 'app' ? '앱 지도' : (G.focus >= 0 ? '한 건 중심' : '전체')) + '</span></h4>';
      h += '<p>보이는 점 <b>' + n(G.act.length) + '</b> · 선 <b>' + n(ne) + '</b> (관계망 전체 점 ' + n(Object.keys(ONT.ent || {}).length) + ' · 선 ' + n(Object.keys(ONT.edg || {}).length) + ')</p>';
      h += '<div class="gl">종류별</div>' + Object.keys(cnt).map(function (t) { return '<p style="margin:1px 0">' + esc(t) + ' ' + n(cnt[t]) + '</p>'; }).join('');
      h += '<div class="gl">가장 많이 이어진 것</div>' + top.map(function (i) { return gNbBtn(i, G.kind === 'app' ? n(G.N[i].wsum) + '건' : G.N[i].deg + '줄'); }).join('');
      if (lone.length) h += '<div class="gl">아무 데도 안 이어진 것 ' + lone.length + '</div>' + lone.slice(0, 8).map(function (i) { return gNbBtn(i, ''); }).join('') + (lone.length > 8 ? '<p>외 ' + (lone.length - 8) + '개</p>' : '');
      h += '<div class="gl">관계망 판</div><p>' + esc(ONT.gen || '') + (ONT.meta && ONT.meta.generatedAt ? ' · ' + esc(fmtAt(Date.parse(ONT.meta.generatedAt))) : '') + ' · 확정된 연결(confidence 1)만 · 선이 없다고 관계가 없는 것은 아닙니다</p>';
    } else {
      var nd = G.N[G.sel], groups = gNeighborsByPred(G.sel), tot = 0; Object.keys(groups).forEach(function (k) { tot += groups[k].length; });
      h += '<h4><span class="tdot" style="background:' + esc(gColor(nd)) + '"></span><span title="' + esc(nd.label) + '">' + esc(nd.label) + '</span></h4>';
      h += '<p>' + esc(gTypeName(nd)) + ' · 연결 ' + tot + '줄' + (G.kind === 'app' ? ' · 이어진 자료 ' + n(nd.wsum) + '건' : '') + '</p>';
      h += '<div class="acts">' + (G.kind === 'ent' ? (G.focus === G.sel ? '<button type="button" data-g="all">전체로 돌아가기</button>' : '<button type="button" data-g="focus">이 건 중심으로 보기</button>') : '') +
        '<button type="button" data-g="open">그 앱에서 열기 ↗</button><button type="button" data-g="clear">고르기 풀기</button></div>';
      Object.keys(groups).sort().forEach(function (k) { h += '<div class="gl">' + esc(k) + ' ' + groups[k].length + '</div>' + groups[k].map(function (o) { return gNbBtn(o.j, G.kind === 'app' ? n(o.e.w) + '건' : ''); }).join(''); });
      if (!tot) h += '<p>이 건은 지금 보이는 범위에서 이어진 곳이 없습니다. 숨긴 종류가 있으면 «종류»를 켜 보세요.</p>';
    }
    box.innerHTML = h;
  }
  function gNbBtn(i, meta) { var nd = G.N[i]; return '<button type="button" class="nb" data-gi="' + i + '"><span class="tdot" style="background:' + esc(gColor(nd)) + '"></span><span title="' + esc(nd.label) + '">' + esc(nd.label) + '</span>' + (meta ? '<em>' + esc(meta) + '</em>' : '') + '</button>'; }
  function gTable() {
    var rows = []; G.E.forEach(function (e) { if (!G.on[e.s] || !G.on[e.t]) return; var a = G.N[e.s], b = G.N[e.t]; rows.push([gTypeName(a) + ' · ' + a.label, G.kind === 'app' ? n(e.w) + '건' : (GPRED[e.p] || e.p), gTypeName(b) + ' · ' + b.label]); });
    var more = rows.length > 300; rows = rows.slice(0, 300);
    $('gTbl').innerHTML = tblHtml(['시작', '관계', '도착'], rows, (more ? '처음 300줄만 · ' : '') + '지금 보이는 선 기준 · 숨긴 종류는 빠짐');
  }
  function gDepthState() { document.querySelectorAll('#gDepth .chip').forEach(function (b) { b.disabled = (G.focus < 0); b.title = G.focus < 0 ? '점을 고르고 «이 건 중심으로 보기»를 누르면 쓸 수 있습니다' : ''; }); }
  function gOpen() {
    if (G.sel < 0) return;
    var nd = G.N[G.sel], key = nd.type === 'App' ? nd.prog : (nd.prog || 'erp');
    var a = appList().filter(function (x) { return x.key === key; })[0] || appList().filter(function (x) { return x.key === 'erp'; })[0];
    if (!a) return;
    try { global.open(a.url, '_blank', 'noopener'); } catch (e) {}
    gMsgSet('«' + a.name + '» 를 새 탭으로 열었습니다 — 그 앱에서 이 건을 찾아 고칩니다(여기서는 읽기만).');
  }
  function initGraph() {
    G.cv = $('cvG'); G.g = G.cv.getContext('2d');
    var cv = G.cv;
    cv.addEventListener('pointerdown', function (e) { var p = gPt(e); G.drag = { i: gPick(p.x, p.y), x: p.x, y: p.y, cx: G.cam.x, cy: G.cam.y, moved: 0 }; try { cv.setPointerCapture(e.pointerId); } catch (_) {} });
    cv.addEventListener('pointermove', function (e) {
      var p = gPt(e), d = G.drag;
      if (d) { d.moved += Math.abs(p.x - d.x) + Math.abs(p.y - d.y); if (d.moved > 4) {
        if (d.i >= 0) { var nd = G.N[d.i]; nd.fx = true; nd.x = G.cam.x + (p.x - G.w / 2) / G.cam.z; nd.y = G.cam.y + (p.y - G.h / 2) / G.cam.z; G.alpha = Math.max(G.alpha, 0.25); }
        else { G.cam.x = d.cx - (p.x - d.x) / G.cam.z; G.cam.y = d.cy - (p.y - d.y) / G.cam.z; }
        G.dirty = true; } return; }
      var h = gPick(p.x, p.y); if (h !== G.hot) { G.hot = h; cv.style.cursor = h >= 0 ? 'pointer' : 'default'; G.dirty = true; }
    });
    function up() { var d = G.drag; if (!d) return; if (d.i >= 0 && G.N[d.i]) G.N[d.i].fx = false; if (d.moved <= 4) gSelect(d.i, false); G.drag = null; }
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', function () { if (G.drag && G.drag.i >= 0 && G.N[G.drag.i]) G.N[G.drag.i].fx = false; G.drag = null; });
    cv.addEventListener('pointerleave', function () { if (!G.drag && G.hot >= 0) { G.hot = -1; G.dirty = true; } });
    cv.addEventListener('wheel', function (e) { if (!e.ctrlKey && document.activeElement !== cv) return; e.preventDefault();
      var p = gPt(e), wx = G.cam.x + (p.x - G.w / 2) / G.cam.z, wy = G.cam.y + (p.y - G.h / 2) / G.cam.z; G.cam.z = clamp(G.cam.z * (e.deltaY > 0 ? 0.9 : 1.11), 0.25, 4);
      G.cam.x = wx - (p.x - G.w / 2) / G.cam.z; G.cam.y = wy - (p.y - G.h / 2) / G.cam.z; G.dirty = true; }, { passive: false });
    cv.addEventListener('keydown', function (e) { var k = e.key, s = 40 / G.cam.z, used = true;
      if (k === 'ArrowLeft') G.cam.x -= s; else if (k === 'ArrowRight') G.cam.x += s; else if (k === 'ArrowUp') G.cam.y -= s; else if (k === 'ArrowDown') G.cam.y += s;
      else if (k === '+' || k === '=') G.cam.z = clamp(G.cam.z * 1.15, 0.25, 4); else if (k === '-') G.cam.z = clamp(G.cam.z / 1.15, 0.25, 4);
      else if (k === 'Escape') gSelect(-1); else used = false;
      if (used) { e.preventDefault(); G.dirty = true; } });
    [['＋', '가까이', function () { G.cam.z = clamp(G.cam.z * 1.2, 0.25, 4); }], ['－', '멀리', function () { G.cam.z = clamp(G.cam.z / 1.2, 0.25, 4); }],
      ['⟲', '전체가 보이게', function () { gFit(); }], ['↻', '다시 펼치기', function () { G.alpha = 1; gSim(200); gFit(); }]].forEach(function (b) {
      var el = document.createElement('button'); el.type = 'button'; el.textContent = b[0]; el.title = b[1]; el.setAttribute('aria-label', b[1]);
      el.addEventListener('click', function () { b[2](); G.dirty = true; }); $('gCtl').appendChild(el); });
    if ('IntersectionObserver' in global) new IntersectionObserver(function (en) { G.visible = en[0].isIntersecting; if (G.visible) gFitCanvas(); }).observe(cv); else G.visible = true;
    if ('ResizeObserver' in global) new ResizeObserver(function () { gFitCanvas(); }).observe(cv);
    L3.onTick(function () {
      if (!G.visible) return;
      if (G.alpha > 0.01 && !REDUCE && G.act.length) { gSim(2); G.dirty = true; }
      if ((G.sel >= 0 || G.hot >= 0) && !REDUCE) { G.flowT = (G.flowT + 0.014) % 1; G.dirty = true; }
      if (G.dirty) { G.dirty = false; gRender(); }
    });
    function onList(e) {
      var b = e.target.closest('[data-gi]');
      if (b) { var gi = +b.getAttribute('data-gi'); if (G.on[gi]) gSelect(gi, true); else if (G.kind === 'ent') { G.hidden[G.N[gi].type] && delete G.hidden[G.N[gi].type]; gSetFocus(gi); } return; }
      var a = e.target.closest('[data-g]'); if (!a) return; var act = a.getAttribute('data-g');
      if (act === 'focus') gSetFocus(G.sel); else if (act === 'all') { G.mode = 'all'; gSetFocus(-1); } else if (act === 'clear') gSelect(-1); else if (act === 'open') gOpen();
    }
    $('gSide').addEventListener('click', onList);
    $('gFound').addEventListener('click', onList);
    $('gFind').addEventListener('input', gFindRender);
    $('gLabels').addEventListener('click', function (e) { G.labels = !G.labels; setPressed(e.currentTarget, G.labels); G.dirty = true; });
    chipRow('gMode', [{ k: 'focus', name: '업체 하나 중심', on: true }, { k: 'all', name: '전체(종류를 거른 뒤)' }, { k: 'app', name: '앱 지도' }], function (k) { $('gFind').value = ''; $('gFound').innerHTML = ''; gSetMode(k); });
    chipRow('gTypes', Object.keys(GTYPE).map(function (t) { return { k: t, name: GTYPE[t].n, color: GTYPE[t].c }; }), function (k, on) {
      if (on) delete G.hidden[k]; else G.hidden[k] = 1; if (!G.N.length) return; gActive(); G.alpha = Math.max(G.alpha, 0.5); gSim(80); gFit(); gAfter(); }, true);
    chipRow('gDepth', [{ k: 1, name: '1', on: true }, { k: 2, name: '2' }], function (k) { G.depth = k; if (G.focus >= 0) gSetFocus(G.focus); });
    gSideHtml();
  }

  /* ══ 13. 왼쪽 대시보드 ══ */
  function sideDash() {
    if (!DS) return;
    var all = boardCards(), c = boardCount(all), t = periodTot(CUR), yr = periodTot(12), FO = finOk(), LO = logOk();
    var ne = 0; G.E.forEach(function (e) { if (G.on[e.s] && G.on[e.t]) ne++; });
    var lines = cLines(), overLine = lines.length ? lines[lines.length - 1] : null;
    var over = (LO && overLine) ? PEOPLE().filter(function (p) { return !p.retired && p.wkN[p.wkN.length - 1] >= overLine.v; }).length : null;
    var misu = (FO && SRC.co && SRC.co.ok) ? COMP().filter(function (x) { return x.misu === true; }).length : null;
    var yrs = (DS.years || []).length;
    var MK = {
      all: (CUR === 12 ? '12개월 ' : (CUR === lastIdx() ? '이달 ' : MONTHS()[CUR] + ' ')) + '입금 ' + (FO ? won(t.inc) : '못 읽음'),
      multi: yrs ? 'ERP ' + yrs + '개 해 · 세무 대조' : 'ERP 연도 자료 없음',
      board: '주의 ' + c.warn + ' · 위험 ' + c.bad + ' · 못 모음 ' + c.na,
      graph: ONT.state === 'ok' ? ((G.kind === 'app' ? '앱 ' : '점 ') + n(G.act.length) + ' · 선 ' + n(ne)) : (ONT.state === 'none' ? '관계망 올라오기 전' : (ONT.state === 'err' ? '관계망 못 읽음' : '불러오는 중')),
      lock: deviceLabel() + (deviceState() === 'ok' ? (CHAT.unlocked ? ' · 열림' : ' · 잠김') : ''),
      a: '3D·2D · 12개월 ' + (FO ? won(yr.inc) : '못 읽음'),
      b: '3D·2D · 사람 ' + PEOPLE().length + '명',
      c: '3D·2D · ' + (over == null ? (LO ? '넘침 기준 전' : '기록 못 읽음') : '넘침 ' + over + '명'),
      d: '3D·2D · 12개월 ' + (FO ? won(yr.inc) : '못 읽음'),
      e: '3D·2D · ' + (misu == null ? '미수 —' : '미수 ' + misu + '곳')
    };
    document.querySelectorAll('[data-mk]').forEach(function (el) {
      var k = el.getAttribute('data-mk'); el.textContent = MK[k] || '';
      var b = el.closest('button'); if (b) b.title = b.querySelector('.nm').textContent + ' — ' + (MK[k] || '');
    });
    var bn = bottleneck();
    $('sDash').innerHTML = '<h3>' + esc(CUR === 12 ? '12개월' : (MONTH_KO()[CUR] || '')) + ' 한눈에</h3>' +
      [['확정 입금', FO ? (t.n ? won(t.inc) : '없음') : '못 읽음'], ['수행업무', LO ? n(t.task) + '건' : '못 읽음'], ['현황판 주의·위험', bn.v == null ? '—' : bn.v + '곳'],
        ['관계망 판', ONT.state === 'ok' && ONT.meta && ONT.meta.generatedAt ? fmtAt(Date.parse(ONT.meta.generatedAt)).slice(5) : '—'], ['기준', (BASIS === 'accrual' ? '귀속월' : '입금일') + (NET ? '·순액' : '')]]
        .map(function (r) { return '<div><span>' + esc(r[0]) + '</span><b>' + esc(r[1]) + '</b></div>'; }).join('');
  }

  /* ══ 14. 보기 방식 · 탭 · 영상 브리핑 · 무대 · 창 ══ */
  var DUALS = ['dualAll', 'dualM', 'dualA', 'dualB', 'dualC', 'dualD', 'dualE'];
  function setDualMode(targetId, mode) {
    var box = $(targetId); if (!box) return;
    box.classList.remove('mode-3d', 'mode-2d');
    if (mode === '3d') box.classList.add('mode-3d'); else if (mode === '2d') box.classList.add('mode-2d');
    document.querySelectorAll('.mseg[data-target="' + targetId + '"] button').forEach(function (b) { setPressed(b, b.getAttribute('data-m') === mode); });
    setTimeout(L3.refit, 20);
  }
  /* 3D·2D 보기 — 어느 화면의 단추를 눌러도 모든 화면에 함께 적용한다(2026-11-22 정리: 위 막대의 전체 단추와 겹쳐 하나로 합침) */
  function applyGlobalMode(mode, silent) {
    GLOBAL_VMODE = mode;
    DUALS.forEach(function (id) { setDualMode(id, mode); });
    if (!silent) queueSave();
  }
  var cineTimer = null;
  function stopCineTour() {
    if (cineTimer) { clearInterval(cineTimer); cineTimer = null; }
    ST.cine = false;
    var btn = $('btnCineTour'); if (btn) { btn.classList.remove('on'); btn.innerHTML = '🎬<span class="tx"> 영상화 브리핑</span>'; }
    var hud = $('hudAll'); if (hud) hud.classList.remove('on');
    if (CH.all) { CH.all.scanX = null; CH.all.dirty = true; }
    if (SC.all) { SC.all.auto = false; SC.all.syncAuto(); }
  }
  function startCineTour() {
    if (!DS) return;
    if (cineTimer) { stopCineTour(); showToast('월별 영상화 브리핑을 멈췄습니다.'); return; }
    var tab = document.querySelector('.side button[data-v="all"]'); if (tab && !tab.classList.contains('on')) tab.click();
    var btn = $('btnCineTour'); btn.classList.add('on'); btn.innerHTML = '⏹<span class="tx"> 브리핑 정지</span>';
    ST.cine = true;
    var hud = $('hudAll'), hTxt = $('hudAllTxt'), hBar = $('hudAllBar'); hud.classList.add('on');
    var step = 0, nM = MONTHS().length;
    SC.all.tYaw = -0.68; SC.all.tPitch = 0.52; SC.all.tDist = 30.2;
    function applyStep(idx) {
      setGlobalPeriod(idx, true);
      var t = MTOT()[idx], FO = finOk();
      /* 사람을 짚지 않는다 — «그 달 1등» 같은 자동 순위는 계획서 7절(표시 원칙)에 어긋난다. 달만 훑는다 */
      SC.all.pin = null; CH.all.pin = null;
      if (CH.all.w > 80) CH.all.scanX = 54 + ((CH.all.w - 70) / 12) * (idx + 0.5);
      SC.all.dirty = true; CH.all.dirty = true;
      hTxt.textContent = MONTH_KO()[idx] + ' · 확정 ' + (FO ? won(t.inc) : '못 읽음') + ' (' + (FO ? n(t.n) + '건' : '—') + ') · 수행업무 ' + (logOk() ? n(t.task) + '건' : '못 읽음');
      hBar.style.width = Math.round(((idx + 1) / nM) * 100) + '%';
      setSync('syncTxtAll', '🎬 브리핑 연동 중: ' + MONTH_KO()[idx]);
      if (!REDUCE) { SC.all.tYaw = -0.68 + (idx / Math.max(1, nM - 1)) * 0.52; SC.all.tPitch = 0.50 + Math.sin(idx / Math.max(1, nM - 1) * Math.PI) * 0.12; }
    }
    applyStep(0);
    cineTimer = setInterval(function () {
      step++;
      if (step >= nM) { stopCineTour(); SC.all.pin = null; CH.all.pin = null; setGlobalPeriod(lastIdx(), false); showToast('12개월 3D·2D 동시 영상화 브리핑을 마쳤습니다.'); return; }
      applyStep(step);
    }, 920);
  }
  function toggleTheme(e) {
    ST.dark = !ST.dark;
    var btn = e.currentTarget; setPressed(btn, ST.dark);
    btn.innerHTML = ST.dark ? '🌌<span class="tx"> 시네마 무대</span>' : '🌤<span class="tx"> 밝은 스튜디오</span>';
    document.querySelectorAll('.stage').forEach(function (st) { st.classList.toggle('dark', ST.dark); });
    if (DS) { rebuildScenes(false); buildMulti3D(); }
    L3.dirtyAll(); G.dirty = true;
  }
  var modalBack = null;
  function openModal(id) { modalBack = document.activeElement; var m = $(id); m.classList.add('on'); var c = m.querySelector('.audit-hd button'); if (c) c.focus(); }
  function closeModal(id) { var m = $(id); if (!m) return; m.classList.remove('on'); if (modalBack && modalBack.focus) modalBack.focus(); modalBack = null; }
  function trapTab(id) {
    var m = $(id);
    m.addEventListener('click', function (e) { if (e.target === m) closeModal(id); });
    m.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;
      var f = [].slice.call(m.querySelectorAll('button,input,select,a[href]')).filter(function (x) { return !x.disabled && x.offsetParent !== null; });
      if (!f.length) return; var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }

  /* ══ 15. 기준 정하기 — 대표가 정한 값만 노랑·빨강 ══ */
  function setVal(id, v) { var el = $(id); if (el) el.value = (v == null ? '' : String(v)); }
  function getNum(id) { var el = $(id); if (!el) return null; var v = numOrNull(el.value); return (v == null || v < -100) ? null : v; }
  function openSettings(focusBoard) {
    var c = SET.cLines || {}, t = SET.thresholds || {}, b = SET.baseline || {};
    setVal('setCWarn', c.warn); setVal('setCOver', c.over); setVal('setRecWarn', t.recWarn);
    setVal('setAGoal', (SET.aLines || {}).goal); setVal('setReconWarn', t.reconWarn); setVal('setReconBad', t.reconBad);
    setVal('setBAdv', b.adv); setVal('setBCase', b.case); setVal('setBCost', b.cost);
    var cards = boardCards().filter(function (x) { return x.st !== 'na'; });
    $('setBoard').innerHTML = cards.length ? cards.map(function (x) {
      var th = thrBoard(x.key) || {};
      return '<div class="setrow" data-bkey="' + esc(x.key) + '"><span title="' + esc(x.name + ' — ' + x.n[2].label) + '">' + esc(x.name) + ' · ' + esc(x.n[2].label) + '</span>' +
        '<input type="number" min="0" step="1" inputmode="numeric" data-b="w" aria-label="' + esc(x.name) + ' 주의 기준" placeholder="주의" value="' + (th.w == null ? '' : esc(th.w)) + '">' +
        '<input type="number" min="0" step="1" inputmode="numeric" data-b="b" aria-label="' + esc(x.name) + ' 위험 기준" placeholder="위험" value="' + (th.b == null ? '' : esc(th.b)) + '"></div>';
    }).join('') : '<p class="na" style="margin:0;font-size:12.5px">서버 현황판 숫자가 아직 없습니다 — 서버 집계가 들어오면 앱마다 기준을 정할 수 있습니다.</p>';
    $('setMsg').textContent = '';
    openModal('setModal');
    if (focusBoard) { var sec = $('setBoardSec'); if (sec && sec.scrollIntoView) sec.scrollIntoView({ block: 'start' }); }
  }
  function collectSettings() {
    var w = getNum('setCWarn'), o = getNum('setCOver');
    SET.cLines = { warn: w != null && w > 0 ? w : null, over: o != null && o > 0 ? o : null };
    var g = getNum('setAGoal'); SET.aLines = { goal: g != null && g > 0 ? g : null };
    var board = {};
    document.querySelectorAll('#setBoard [data-bkey]').forEach(function (row) {
      var k = row.getAttribute('data-bkey'); if (/[.#$\[\]\/]/.test(k)) return;
      var wv = numOrNull(row.querySelector('[data-b="w"]').value), bv = numOrNull(row.querySelector('[data-b="b"]').value);
      if ((wv != null && wv >= 0) || (bv != null && bv >= 0)) board[k] = { w: wv != null && wv >= 0 ? wv : null, b: bv != null && bv >= 0 ? bv : null };
    });
    var rw = getNum('setRecWarn'), rcw = getNum('setReconWarn'), rcb = getNum('setReconBad');
    SET.thresholds = { recWarn: rw != null && rw > 0 && rw <= 100 ? rw : null, reconWarn: rcw != null && rcw >= 0 ? rcw : null, reconBad: rcb != null && rcb >= 0 ? rcb : null, board: board };
    var ba = getNum('setBAdv'), bc = getNum('setBCase'), bo = getNum('setBCost');
    SET.baseline = { adv: ba != null ? clamp(Math.round(ba), -5, 25) : null, case: bc != null ? clamp(Math.round(bc), -10, 25) : null, cost: bo != null ? clamp(Math.round(bo), 40, 95) : null };
  }
  function afterSettingsChange() {
    if (!DS) return;
    renderKpis(); renderTbl(); rebuildScenes(false); renderBoard(); renderGovbar(); sideDash();
    multiInit(true); refreshMultiAll(false);
  }

  /* ══ 16. 한 번만 다는 손잡이 ══ */
  function bindStatic() {
    document.querySelectorAll('.mseg[data-target]').forEach(function (seg) {
      seg.addEventListener('click', function (e) { var b = e.target.closest('button[data-m]'); if (b) applyGlobalMode(b.getAttribute('data-m')); });
    });
    document.querySelectorAll('.mseg button').forEach(function (b) { b.setAttribute('aria-pressed', b.classList.contains('on') ? 'true' : 'false'); });
    $('monthScrub').addEventListener('click', function (e) { var b = e.target.closest('[data-mi]'); if (b && DS) setGlobalPeriod(+b.getAttribute('data-mi'), false); });
    $('selPeriod').addEventListener('change', function (e) { if (DS) setGlobalPeriod(+e.target.value, false); });
    $('btnBasisToggle').addEventListener('click', function () {
      if (!DS) return; BASIS = BASIS === 'cash' ? 'accrual' : 'cash'; computeDs(); renderAll(false); queueSave();
      showToast(BASIS === 'accrual' ? '귀속월(자문료 advisoryYm · 그 밖 perfYM) 기준으로 3D·2D·표 전체를 다시 셌습니다.' : '실제 입금일(date) 기준으로 되돌렸습니다.');
    });
    $('btnNetToggle').addEventListener('click', function () {
      if (!DS) return; NET = !NET; computeDs(); renderAll(false); queueSave();
      showToast(NET ? '카드 수수료(cardFee)를 뺀 순액 기준으로 바꿨습니다.' : '카드 수수료를 빼기 전 총액 기준으로 되돌렸습니다.');
    });
    $('btnKpiSwap').addEventListener('click', function () { useCard4Per = !useCard4Per; syncToggles(); renderKpis(); });
    $('btnFilterInfo').addEventListener('click', function (e) { var box = $('filterInfo'), open = box.hidden; box.hidden = !open; e.currentTarget.setAttribute('aria-expanded', open ? 'true' : 'false'); e.currentTarget.textContent = open ? '확정 입금만 ▴' : '확정 입금만 ▾'; });
    document.querySelector('.govbar').addEventListener('click', function (e) {
      var b = e.target.closest('[data-jump]'); if (!b) return;
      var j = b.getAttribute('data-jump');
      if (j === 'fin-hold' || j === 'expiring') { bState.row = j === 'fin-hold' ? 'inside' : null; bState.warnFirst = true; renderBoard(); document.querySelector('.side button[data-v="board"]').click(); }
      else if (j === 'overload') { document.querySelector('.side button[data-v="c"]').click(); }
      else if (j === 'misu') { document.querySelector('.side button[data-v="e"]').click(); if (!eState.misu) $('eMisu').click(); }
    });
    $('btnExportCsv').addEventListener('click', exportCsv);
    $('allTbl').addEventListener('change', onPickChange);
    $('allCards').addEventListener('change', onPickChange);
    $('allSel').addEventListener('click', function (e) {
      var a = e.target.getAttribute('data-act'); if (!a || !SC.all) return;
      if (a === 'focus') { allState.focus = Object.keys(selected).length ? Object.assign({}, selected) : null; rebuildAll(true); setSync('syncTxtAll', '🔗 고른 ' + Object.keys(selected).length + '명만 3D·2D 에서 진하게 보입니다'); $('btnResetSyncAll').style.display = ''; }
      if (a === 'clear') { selected = {}; allState.focus = null; SC.all.pin = null; CH.all.pin = null; rebuildAll(true); renderTbl(); $('btnResetSyncAll').style.display = 'none'; setSync('syncTxtAll', '🔗 3D·2D 연동 대기 — 양쪽 막대 어디든 누르면 달·사람·표가 함께 맞춰집니다'); }
    });
    $('btnResetSyncAll').addEventListener('click', function (e) {
      selected = {}; allState.focus = null; if (SC.all) { SC.all.pin = null; CH.all.pin = null; }
      e.currentTarget.style.display = 'none'; setSync('syncTxtAll', '🔗 3D·2D 연동 대기 — 양쪽 막대 어디든 누르면 달·사람·표가 함께 맞춰집니다');
      rebuildAll(true); renderTbl();
    });
    $('catBreakList').addEventListener('click', function (e) {
      var row = e.target.closest('[data-catk]'); if (!row || !DS) return;
      var ck = row.getAttribute('data-catk'), tab = document.querySelector('.side button[data-v="d"]'); if (tab) tab.click();
      var mi = CUR === 12 ? lastIdx() : CUR, id = 'd' + mi + ck;
      SC.d.pin = id; CH.d.pin = id; SC.d.dirty = true; CH.d.dirty = true;
      var cat = CATS().filter(function (x) { return x.k === ck; })[0];
      if (cat) setSync('syncTxtD', '🔗 전체 배치에서 이어짐: ' + MONTHS()[mi] + ' · ' + cat.name + ' (' + won(MTOT()[mi].cat[ck]) + ')');
    });
    $('bRange').addEventListener('input', function (e) { if (DS) setB(+e.target.value); });
    $('bTrail').addEventListener('click', function (e) { if (!DS) return; bTrail = !bTrail; setPressed(e.currentTarget, bTrail); buildBalls(SC.b, bMi, bTrail); SC.b.dirty = true; CH.b.dirty = true; });
    $('bPlay').addEventListener('click', function (e) {
      if (!DS) return;
      var btn = e.currentTarget;
      function stop() { clearInterval(bTimer); bTimer = null; btn.textContent = '▶ 12개월 재생'; setPressed(btn, false); }
      if (bTimer) { stop(); return; }
      btn.textContent = '⏸ 멈춤'; setPressed(btn, true); var mi = 0; setB(0);
      bTimer = setInterval(function () { mi++; if (mi > MONTHS().length - 1) { stop(); return; } setB(mi); }, 820);
    });
    $('e2dPrev').addEventListener('click', function () { E2D.off = Math.max(0, E2D.off - (E2D.ps || 1)); CH.e.dirty = true; });
    $('e2dNext').addEventListener('click', function () { E2D.off += (E2D.ps || 1); CH.e.dirty = true; });
    $('eMisu').addEventListener('click', function (e) { if (!DS) return; eState.misu = !eState.misu; E2D.off = 0; setPressed(e.currentTarget, eState.misu); smsg('smE', buildCity(SC.e, eState)); SC.e.dirty = true; CH.e.dirty = true; });
    chipRow('bRow', [{ k: null, name: '모두', on: true }, { k: 'client', name: '의뢰인 업무' }, { k: 'store', name: '자료함' }, { k: 'sales', name: '영업관리' }, { k: 'inside', name: '내부관리' }], function (k) { bState.row = k; renderBoard(); });
    $('bWarnOnly').addEventListener('click', function (e) { bState.warnOnly = !bState.warnOnly; setPressed(e.currentTarget, bState.warnOnly); renderBoard(); });
    $('bSortWarn').addEventListener('click', function (e) { bState.warnFirst = !bState.warnFirst; setPressed(e.currentTarget, bState.warnFirst); renderBoard(); });
    $('bHideNa').addEventListener('click', function (e) { bState.hideNa = !bState.hideNa; setPressed(e.currentTarget, bState.hideNa); renderBoard(); });
    $('board').addEventListener('click', boardOpen);
    $('btnCineTour').addEventListener('click', startCineTour);
    $('btnStageTheme').addEventListener('click', toggleTheme);
    $('btnOpenAudit').addEventListener('click', function () { openModal('auditModal'); });
    $('btnCloseAudit').addEventListener('click', function () { closeModal('auditModal'); });
    $('btnOpenSet').addEventListener('click', function () { openSettings(false); });
    document.querySelectorAll('[data-open-set]').forEach(function (b) { b.addEventListener('click', function () { openSettings(true); }); });
    $('btnCloseSet').addEventListener('click', function () { closeModal('setModal'); });
    $('btnSetClear').addEventListener('click', function () { $('setModal').querySelectorAll('input').forEach(function (i) { i.value = ''; }); $('setMsg').textContent = '모두 비웠습니다 — «저장»을 눌러야 남습니다.'; });
    $('btnSetSave').addEventListener('click', function () {
      collectSettings(); afterSettingsChange();
      $('setMsg').textContent = '저장 중…';
      saveSettings().then(function () { $('setMsg').textContent = '저장했습니다 — 대표 전용 자리(datahub)에만 남습니다.'; }, function (e) { $('setMsg').textContent = '저장하지 못했습니다(' + why(e) + ') — 이 화면에는 바로 적용했습니다.'; });
    });
    trapTab('auditModal'); trapTab('setModal');
    $('btnReload').addEventListener('click', function () { if (GATE_OK && ME.uid) { loadAll(EPOCH); showToast('원본을 다시 읽습니다.'); } });
    document.querySelectorAll('label.drop-lbl[for]').forEach(function (l) {
      l.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); var t = $(l.getAttribute('for')); if (t) t.click(); } });
    });
    bindTabs(); bindMulti(); bindChat();
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      L3.unpinAll();
      if ($('setModal').classList.contains('on')) closeModal('setModal');
      if ($('auditModal').classList.contains('on')) closeModal('auditModal');
      if (cineTimer) stopCineTour();
      if (multiCineTimer) stopMultiCine();
    });
    global.addEventListener('scroll', function () { if (L3.tipShown()) L3.unpinAll(); }, { passive: true });
  }
  function bindTabs() {
    var TABS = [].slice.call(document.querySelectorAll('.side button[data-v]'));
    TABS.forEach(function (b) {
      var v = b.getAttribute('data-v'), panel = $('v-' + v);
      b.id = 'tab-' + v; b.setAttribute('aria-controls', 'v-' + v); b.tabIndex = b.classList.contains('on') ? 0 : -1;
      if (panel) { panel.setAttribute('role', 'tabpanel'); panel.setAttribute('aria-labelledby', 'tab-' + v); }
      b.addEventListener('keydown', function (e) {
        var i = TABS.indexOf(b), j = null;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % TABS.length; else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i - 1 + TABS.length) % TABS.length;
        else if (e.key === 'Home') j = 0; else if (e.key === 'End') j = TABS.length - 1;
        if (j != null) { e.preventDefault(); TABS[j].focus(); TABS[j].click(); }
      });
      b.addEventListener('click', function () {
        var nv = b.getAttribute('data-v'), prev = VIEW;
        TABS.forEach(function (x) { x.tabIndex = (x === b) ? 0 : -1; x.classList.toggle('on', x === b); x.setAttribute('aria-selected', x === b ? 'true' : 'false'); });
        if (b.scrollIntoView && global.matchMedia && global.matchMedia('(max-width:600px)').matches) b.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        document.querySelectorAll('.view').forEach(function (vw) { vw.classList.toggle('on', vw.id === 'v-' + nv); });
        if (bTimer) $('bPlay').click();
        if (cineTimer && nv !== 'all') stopCineTour();
        if (multiCineTimer && nv !== 'multi') stopMultiCine();
        /* 화면을 떠나면 고른 것을 비운다(고르기칸 규칙) */
        if (prev === 'all' && nv !== 'all' && Object.keys(selected).length) { selected = {}; allState.focus = null; rebuildAll(true); renderTbl(); $('btnResetSyncAll').style.display = 'none'; }
        if (nv !== 'multi') mClearPick();
        VIEW = nv; L3.unpinAll(); global.scrollTo(0, 0);
        if (nv === 'graph') { G.dirty = true; setTimeout(gFitCanvas, 30); }
        setTimeout(L3.refit, 20);
        if (prev !== nv) queueSave();
      });
    });
    (function () { var tl = document.querySelector('.side[role=tablist]'); if (!tl || !global.matchMedia) return;
      var mq = global.matchMedia('(max-width:600px)'); function setO() { tl.setAttribute('aria-orientation', mq.matches ? 'horizontal' : 'vertical'); }
      setO(); if (mq.addEventListener) mq.addEventListener('change', setO); else if (mq.addListener) mq.addListener(setO); })();
    document.querySelectorAll('[data-goto]').forEach(function (b) { b.addEventListener('click', function () { var t = document.querySelector('.side button[data-v="' + b.getAttribute('data-goto') + '"]'); if (t) { t.click(); t.focus(); } }); });
  }

  /* ══ 17. 다년 · 시나리오 · 세무 대조 (3단계)
     ERP 숫자 = 계산 모듈의 ds.years(해마다 같은 거르개). 분기는 그 해를 끝 달로 build() 를 한 번 더 돌려 얻는다.
     세금계산서·재무제표는 이 브라우저 메모리(FILES)에만 — 서버에 올리거나 저장하지 않는다. 넣기 전에는 «—». ══ */
  var FILES = {};             /* {해: {tax, fs, cost, ar, head}} — 금액은 원 */
  var FILE_NAMES = { tax: '', fs: '' };
  var YEAR_MONTHS = {};
  var mState = { vatAlign: true, lens: 'recon', scen: 'base', drvAdv: 0, drvCase: 0, drvCost: 70, touched: false, editMode: false, selYear: null, pick: {}, focusYears: null, rows: [], base: null };
  var multiCineTimer = null;
  function endY() { return +String(END_YM || ymNow()).slice(0, 4); }
  function endM() { return +String(END_YM || ymNow()).slice(5, 7); }
  function vat(v) { return v == null ? null : (mState.vatAlign ? Math.round(v / 1.1) : v); }
  function yearMonths(y) {
    if (YEAR_MONTHS[y]) return YEAR_MONTHS[y];
    var ds = C.build(RAW, { endYm: y + '-12', basis: BASIS, net: NET, today: y + '-12-31' });
    YEAR_MONTHS[y] = ds.MTOT.map(function (t) { return t.inc; });
    return YEAR_MONTHS[y];
  }
  function fileCostRatio() {
    var ys = Object.keys(FILES).map(Number).sort(function (a, b) { return b - a; });
    for (var i = 0; i < ys.length; i++) { var f = FILES[ys[i]]; if (f && f.fs > 0 && f.cost != null) return clamp(Math.round(f.cost / f.fs * 100), 40, 95); }
    return null;
  }
  /* 손잡이 시작값 — 대표가 정한 기본(baseline)이 있으면 그것, 없으면 «그대로 0%», 비율은 재무제표에서 셀 수 있으면 그 값 */
  function multiInit(force) {
    if (mState.touched && !force) return;
    var b = SET.baseline || {};
    var cost = b.cost != null ? b.cost : (fileCostRatio() != null ? fileCostRatio() : 70);
    mState.base = { adv: b.adv != null ? b.adv : 0, case: b.case != null ? b.case : 0, cost: cost };
    var sc = mState.scen, d = sc === 'cons' ? -5 : (sc === 'agg' ? 5 : 0);
    mState.drvAdv = clamp(mState.base.adv + d, -5, 25); mState.drvCase = clamp(mState.base.case + d, -10, 25); mState.drvCost = clamp(mState.base.cost - (sc === 'agg' ? 3 : (sc === 'cons' ? -3 : 0)), 40, 95);
    $('rngDrvAdv').value = mState.drvAdv; $('rngDrvCase').value = mState.drvCase; $('rngDrvCost').value = mState.drvCost;
    syncDrvLabels();
  }
  function syncDrvLabels() {
    $('lblDrvAdv').textContent = (mState.drvAdv >= 0 ? '+' : '') + mState.drvAdv + '% / 년';
    $('lblDrvCase').textContent = (mState.drvCase >= 0 ? '+' : '') + mState.drvCase + '% / 년';
    $('lblDrvCost').textContent = mState.drvCost + '% · 영업이익 ' + (100 - mState.drvCost) + '%' + (fileCostRatio() != null && (SET.baseline || {}).cost == null ? '' : ' (가정)');
  }
  function catSum(cat) { if (!cat) return 0; var s = 0; Object.keys(cat).forEach(function (k) { s += cat[k] || 0; }); return s; }
  function computeMultiRows() {
    var out = [], Y = endY(), M = endM(), ys = {};
    (DS ? DS.years : []).forEach(function (r) { if (r.y <= Y) ys[r.y] = r; });
    Object.keys(FILES).forEach(function (k) { if (+k <= Y && !ys[+k]) ys[+k] = null; });
    var th = SET.thresholds || {}, rw = numOrNull(th.reconWarn), rb = numOrNull(th.reconBad), FO = finOk();
    Object.keys(ys).map(Number).sort(function (a, b) { return a - b; }).forEach(function (y) {
      var yr = ys[y], f = FILES[y] || {}, partial = (y === Y && M < 12);
      var erpRaw = (yr && FO) ? (NET ? yr.net : yr.gross) : null, erp = vat(erpRaw);
      /* 입금이 든 달 수 — 이알피에 자료가 들어오기 시작한 해는 몇 달뿐일 수 있다(그 해는 성장률에서 뺀다) */
      var mWith = (yr && FO) ? yearMonths(y).filter(function (v) { return v > 0; }).length : null;
      var thin = !partial && mWith != null && mWith < 12;
      var cat = null; if (yr && FO) { cat = {}; Object.keys(yr.cat).forEach(function (k) { cat[k] = vat(yr.cat[k]); }); }
      var fsV = fin(f.fs) ? f.fs : null, tax = fin(f.tax) ? f.tax : null, cost = fin(f.cost) ? f.cost : null, ar = fin(f.ar) ? f.ar : null, head = fin(f.head) && f.head > 0 ? f.head : null;
      var diff = (erp != null && fsV != null) ? erp - fsV : null, diffPct = (diff != null && fsV > 0) ? diff / fsV * 100 : null;
      var opInc = (fsV != null && cost != null) ? fsV - cost : null, opMargin = (opInc != null && fsV > 0) ? opInc / fsV * 100 : null;
      var status, reason;
      if (partial) { status = 'part'; reason = '진행 중인 해(1~' + M + '월) — 해가 끝난 뒤 대조'; }
      else if (thin && diffPct == null) { status = 'none'; reason = '입금이 든 달이 ' + mWith + '달뿐 — 이 해 ERP 숫자는 일부'; }
      else if (diffPct == null) { status = 'none'; reason = erp == null ? (FO ? '이 해 ERP 입금이 없음' : 'ERP 입금 못 읽음') : '재무제표를 넣으면 대조'; }
      else if (rw == null && rb == null) { status = 'nobase'; reason = '판정 기준 미설정(«기준 정하기»)'; }
      else { var ad = Math.abs(diffPct); status = (rb != null && ad >= rb) ? 'bad' : ((rw != null && ad >= rw) ? 'warn' : 'ok'); reason = status === 'ok' ? '정한 기준 안' : (diff < 0 ? '세금계산서 선발행·미수 이월 점검' : '예수금·실비 대납 혼입 또는 증빙 누락 점검'); }
      if (!mState.vatAlign && diffPct != null) reason += ' · 부가세 미분리';
      var cs = catSum(cat);
      if (thin && diffPct != null) reason += ' · 입금이 든 달 ' + mWith + '달뿐';
      out.push({ y: y, isFc: false, partial: partial, thin: thin, mWith: mWith, erp: erp, erpGross: erpRaw, tax: tax, fs: fsV, diff: diff, diffPct: diffPct, cost: cost, opInc: opInc, opMargin: opMargin, ar: ar, head: head,
        cat: cat, recRatio: cs > 0 ? ((cat.adv || 0) + (cat.fund || 0)) / cs * 100 : null, status: status, reason: reason, val: fsV != null ? fsV : erp, low: null, high: null });
    });
    /* 시나리오 — 마지막 자료 해에서 출발. 진행 중인 해면 연환산(어림) */
    var last = null; for (var i = out.length - 1; i >= 0; i--) if (out[i].val != null) { last = out[i]; break; }
    mState.fcNote = '';
    if (last) {
      var baseVal = last.val, ann = 1;
      if (last.partial && last.fs == null) { ann = 12 / Math.max(1, M); mState.fcNote = last.y + '년은 1~' + M + '월만 있어 12달로 늘려(연환산) 출발했습니다 — 어림입니다'; }
      var catSrc = null; for (var j = out.length - 1; j >= 0; j--) if (out[j].cat && catSum(out[j].cat) > 0) { catSrc = out[j].cat; break; }
      var share = {}, ssum = catSrc ? catSum(catSrc) : 0;
      CATS().forEach(function (c) { share[c.k] = ssum > 0 ? (catSrc[c.k] || 0) / ssum : (c.k === 'etc' ? 1 : 0); });
      var prev = {}; CATS().forEach(function (c) { prev[c.k] = baseVal * ann * share[c.k]; });
      var gA = mState.drvAdv / 100, gC = mState.drvCase / 100, cR = mState.drvCost / 100, head = last.head;
      for (var s = 1; s <= 3; s++) {
        var nx = { adv: prev.adv * (1 + gA), fund: prev.fund * (1 + gA * 0.85), case: prev.case * (1 + gC), cons: prev.cons * (1 + gC * 1.08), etc: prev.etc * (1 + (gA + gC) * 0.4) };
        Object.keys(nx).forEach(function (k) { nx[k] = Math.round(nx[k]); });
        var rev = catSum(nx), band = 0.055 * s + 0.02, cost2 = Math.round(rev * cR), op = rev - cost2;
        out.push({ y: last.y + s, isFc: true, erp: null, tax: null, fs: rev, val: rev, diff: null, diffPct: null, cost: cost2, opInc: op, opMargin: rev > 0 ? op / rev * 100 : null, ar: null, head: head,
          cat: nx, recRatio: rev > 0 ? (nx.adv + nx.fund) / rev * 100 : null, status: 'fc', reason: '시나리오 (폭 ' + won(Math.round(rev * (1 - band))) + ' ~ ' + won(Math.round(rev * (1 + band))) + ')',
          low: Math.round(rev * (1 - band)), high: Math.round(rev * (1 + band)) });
        prev = nx;
      }
    }
    mState.rows = out;
  }
  function mDim(y) { return !!(mState.focusYears && !mState.focusYears[y]); }
  function mHist() { return mState.rows.filter(function (r) { return !r.isFc; }); }
  function buildMulti3D() {
    var s = SC.m; if (!s) return '';
    var keepPin = s.pin; L3.clear(s); s.pin = keepPin;
    var rows = mState.rows;
    if (!rows.length) { floor(s, -10, -3, 10, 3); return (finOk() ? 'ERP 입금이 든 해가 없습니다 — 재무제표 파일을 넣으면 그 해부터 보입니다' : finWhy()); }
    if (mState.lens === 'recon') {
      var maxV = 1; rows.forEach(function (r) { [r.erp, r.tax, r.fs, r.high].forEach(function (v) { if (fin(v) && v > maxV) maxV = v; }); });
      var SX = Math.min(2.65, 21 / Math.max(1, rows.length)), H = 8.0, x0 = -(rows.length - 1) / 2 * SX, xe = -x0 + 1.5;
      floor(s, x0 - 1.6, -2.6, xe, 2.8);
      var fi = rows.findIndex ? rows.findIndex(function (r) { return r.isFc; }) : -1;
      if (fi > 0) {
        var splitX = x0 + (fi - 0.5) * SX;
        s.under.push({ type: 'quad', spotBand: true, v: [[splitX, 0.008, -2.5], [xe - 0.1, 0.008, -2.5], [xe - 0.1, 0.008, 2.7], [splitX, 0.008, 2.7]], nohit: true });
        s.over.push({ type: 'line', a: [splitX, 0, -2.5], b: [splitX, H * 0.92, 2.5], c: ST.dark ? '#60a5fa' : '#2563eb', dash: [5, 4], lw: 1.5, grow: true });
      }
      [0.5, 1.0].forEach(function (f) {
        s.under.push({ type: 'line', wall: true, a: [x0 - 1.5, H * f, 2.7], b: [xe, H * f, 2.7], dash: [4, 4], grow: true });
        s.labels.push({ p: [x0 - 1.7, H * f, 2.7], t: won(maxV * f), al: 'right', c: '#475569', darkC: '#cbd5e1', sz: 10.5, grow: true, pill: true });
      });
      var ribbon = [];
      rows.forEach(function (r, idx) {
        var cx = x0 + idx * SX, isSel = (mState.selYear === r.y), id = 'y|' + r.y;
        if (!r.isFc) {
          var tops = [];
          [{ k: 'erp', dx: -0.62, z: 0.35, val: r.erp, col: '#16a34a' }, { k: 'tax', dx: 0, z: 0, val: r.tax, col: '#2563eb' }, { k: 'fs', dx: 0.62, z: -0.35, val: r.fs, col: '#5b21b6' }].forEach(function (tr) {
            if (!fin(tr.val) || tr.val <= 0) return;
            var th = Math.max(0.08, tr.val / maxV * H); tops.push(th);
            s.items.push({ type: 'box', id: id, yr: r.y, x: cx + tr.dx * Math.min(1, SX / 2.65), z: tr.z, w: 0.54 * Math.min(1, SX / 2.65), d: 1.18, y0: 0, h: th, color: tr.col, spot: isSel, fade: mDim(r.y),
              beacon: (tr.k === 'fs' && (r.status === 'warn' || r.status === 'bad')),
              tip: '<b>' + r.y + '년' + (r.partial ? '(진행 중)' : '') + ' 대조</b><br>① ERP(초록): ' + won(r.erp) + '<br>② 세금계산서(파랑): ' + won(r.tax) + '<br>③ 손익계산서(보라): <b>' + won(r.fs) + '</b><br>차액(①-③): ' + (r.diff == null ? '—' : (r.diff >= 0 ? '+' : '') + won(r.diff) + ' (' + pct1(r.diffPct) + ')') });
          });
          if (tops.length) ribbon.push([cx, Math.max.apply(null, tops) + 0.45, 0]);
        } else {
          var fh = Math.max(0.12, r.fs / maxV * H), hh = Math.max(fh + 0.2, r.high / maxV * H);
          s.items.push({ type: 'box', id: id, yr: r.y, x: cx, z: 0, w: 1.38 * Math.min(1, SX / 2.65), d: 1.45, y0: 0, h: fh, color: '#2563eb', holo: true, spot: isSel, fade: mDim(r.y),
            tip: '<b>' + r.y + '년 시나리오(예측 아님)</b><br>시나리오 매출: <b>' + won(r.fs) + '</b><br>영업이익(가정 비율): ' + won(r.opInc) + ' (' + pct1(r.opMargin) + ')<br>폭: ' + won(r.low) + ' ~ ' + won(r.high) });
          s.over.push({ type: 'line', a: [cx - 0.68, hh, 0], b: [cx + 0.68, hh, 0], c: '#60a5fa', dash: [3, 3], lw: 1.5, grow: true });
          ribbon.push([cx, fh + 0.45, 0]);
        }
        s.labels.push({ p: [cx, 0, -3.15], t: r.y + (r.isFc ? '시나리오' : (r.partial ? '(진행)' : '')), c: r.isFc ? '#2563eb' : (isSel ? '#1e40af' : '#475569'), darkC: r.isFc ? '#bfdbfe' : (isSel ? '#ffffff' : '#cbd5e1'), wt: (isSel || r.isFc) ? 800 : 650, sz: 10.5, accentPill: isSel, pill: r.isFc });
      });
      if (ribbon.length > 1) s.over.push({ type: 'poly', pts: smoothPts3D(ribbon, 4), c: ST.dark ? '#fde68a' : '#d97706', lw: 2.4, glow: true, grow: true });
      s.labels.push({ p: [x0 + 0.7 * SX, H * 0.76, 2.3], t: '  ①ERP(초록) · ②세금계산서(파랑) · ③손익계산서(보라)', c: '#1e293b', wt: 750, bg: 'rgba(255,255,255,.92)' });
      if (fi > 0) s.labels.push({ p: [x0 + (fi + 0.5) * SX, H * 0.78, 1.8], t: '반투명 = 시나리오', c: '#1e40af', wt: 800, bg: '#eff6ff', accentPill: true });
    } else if (mState.lens === 'mix') {
      var mr = rows.filter(function (r) { return r.cat && catSum(r.cat) > 0; });
      if (!mr.length) { floor(s, -10, -4, 10, 4); return 'ERP 입금 종류가 있는 해가 없습니다'; }
      var maxSum = 1; mr.forEach(function (r) { CATS().forEach(function (c) { if ((r.cat[c.k] || 0) > maxSum) maxSum = r.cat[c.k]; }); });
      var SX2 = Math.min(2.35, 20 / Math.max(1, mr.length)), H2 = 8.0, x02 = -(mr.length - 1) / 2 * SX2, xe2 = -x02 + 1.2;
      floor(s, x02 - 1.5, -4.2, xe2, 4.2);
      mr.forEach(function (r, idx) {
        var cx = x02 + idx * SX2;
        CATS().forEach(function (cat, ci) {
          var cv = r.cat[cat.k] || 0; if (!(cv > 0)) return;
          s.items.push({ type: 'box', id: 'y|' + r.y, yr: r.y, x: cx, z: (ci - 2) * 1.55, w: SX2 * 0.52, d: 1.05, y0: 0, h: Math.max(0.08, cv / maxSum * H2), color: cat.color, holo: r.isFc, spot: (mState.selYear === r.y), fade: mDim(r.y),
            tip: '<b>' + r.y + '년 · ' + esc(cat.name) + (r.isFc ? ' (시나리오)' : '') + '</b><br>' + won(cv) + ' (비중 ' + Math.round(cv / Math.max(1, catSum(r.cat)) * 100) + '%)' });
        });
        s.labels.push({ p: [cx, 0, -4.85], t: r.y + (r.isFc ? '*' : ''), c: r.isFc ? '#2563eb' : '#475569', darkC: r.isFc ? '#bfdbfe' : '#cbd5e1', wt: 750, sz: 10.5 });
      });
      CATS().forEach(function (cat, ci) { s.labels.push({ p: [x02 - 1.65, 0.12, (ci - 2) * 1.55], t: ' ' + cat.name, al: 'right', c: cat.color, dotCol: cat.color, wt: 750, bg: 'rgba(255,255,255,.90)' }); });
    } else {
      var hr = mHist().filter(function (r) { return r.erp != null; });
      if (!hr.length) { floor(s, -8, -5, 8, 5); return 'ERP 입금이 든 해가 없습니다'; }
      var maxQ = 1; hr.forEach(function (r) { r.q = yearMonths(r.y).reduce(function (acc, v, i) { acc[Math.floor(i / 3)] += v; return acc; }, [0, 0, 0, 0]).map(vat); r.q.forEach(function (v) { if (v > maxQ) maxQ = v; }); });
      var SX3 = Math.min(2.6, 18 / hr.length), SZ3 = 2.30, H3 = 7.6, x03 = -(hr.length - 1) / 2 * SX3, z03 = -1.5 * SZ3;
      floor(s, x03 - 1.6, z03 - 1.3, -x03 + 1.6, -z03 + 1.3);
      hr.forEach(function (r, yi) {
        var cx = x03 + yi * SX3;
        r.q.forEach(function (qv, qi) {
          if (!(qv > 0)) return;
          var qCol = qi === 2 ? '#166534' : (qi === 1 ? '#16a34a' : (qi === 3 ? '#2563eb' : '#0e7490'));
          s.items.push({ type: 'box', id: 'y|' + r.y, yr: r.y, x: cx, z: z03 + qi * SZ3, w: SX3 * 0.54, d: SZ3 * 0.56, y0: 0, h: Math.max(0.12, qv / maxQ * H3), color: qCol, spot: (mState.selYear === r.y), fade: mDim(r.y),
            tip: '<b>' + r.y + '년 ' + (qi + 1) + '분기</b><br>ERP 확정입금: <b>' + won(qv) + '</b><br>1인당(재무제표 인원): ' + (r.head && r.fs ? won(Math.round(r.fs / r.head)) : '— (인원 칸 없음)') });
        });
        s.labels.push({ p: [cx, 0, z03 - 1.95], t: r.y + '년', c: '#475569', darkC: '#cbd5e1', wt: 750 });
      });
      ['1Q(1~3월)', '2Q(4~6월)', '3Q(7~9월)', '4Q(10~12월)'].forEach(function (ql, qi) { s.labels.push({ p: [x03 - 1.75, 0.12, z03 + qi * SZ3], t: ql, al: 'right', c: '#475569', wt: 750, pill: true }); });
    }
    return '';
  }
  function drawMulti2D(c, g) {
    var rows = mState.rows; if (!rows.length) return;
    var W = c.w, H = c.h, padL = 62, padR = 48, padT = 64, padB = 40;
    var pw = Math.max(50, W - padL - padR), ph = Math.max(50, H - padT - padB);
    var txtCol = ST.dark ? '#cbd5e1' : '#475569', gridCol = ST.dark ? 'rgba(148,163,184,.20)' : 'rgba(203,213,225,.70)';
    if (mState.lens === 'recon') {
      var maxY = 1; rows.forEach(function (r) { [r.erp, r.tax, r.fs, r.high].forEach(function (v) { if (fin(v) && v > maxY) maxY = v; }); }); maxY *= 1.14;
      for (var gi = 0; gi <= 4; gi++) {
        var gy = padT + ph - (gi / 4) * ph;
        g.strokeStyle = gridCol; g.lineWidth = 1; g.beginPath(); g.moveTo(padL, gy); g.lineTo(padL + pw, gy); g.stroke();
        g.font = '600 10.5px Pretendard,"Malgun Gothic",sans-serif'; g.fillStyle = txtCol; g.textAlign = 'right'; g.textBaseline = 'middle'; g.fillText(man(maxY * gi / 4), padL - 7, gy);
        g.fillStyle = ST.dark ? '#fde68a' : '#854d0e'; g.textAlign = 'left'; g.fillText((gi * 10) + '%', padL + pw + 6, gy);
      }
      g.font = '700 11px Pretendard,"Malgun Gothic",sans-serif'; g.fillStyle = txtCol; g.textAlign = 'left';
      g.fillText('단위: 만원 (' + (mState.vatAlign ? 'ERP ÷1.1 어림' : 'ERP 부가세 포함') + ') · 초록=ERP · 파랑=세금계산서 · 보라=손익계산서', padL, padT - 14);
      var stepX = pw / rows.length, fi = -1; rows.some(function (r, i) { if (r.isFc) { fi = i; return true; } return false; });
      if (fi > 0) {
        var fcX = padL + stepX * (fi - 0.5);
        g.fillStyle = ST.dark ? 'rgba(37,99,235,.10)' : 'rgba(191,219,254,.22)'; g.fillRect(fcX, padT, padL + pw - fcX, ph);
        var top = [], bot = [];
        for (var k = fi; k < rows.length; k++) { var fx = padL + stepX * (k + 0.5); top.push([fx, padT + ph - (rows[k].high / maxY) * ph]); bot.unshift([fx, padT + ph - (rows[k].low / maxY) * ph]); }
        var fg = g.createLinearGradient(fcX, padT, padL + pw, padT + ph); fg.addColorStop(0, ST.dark ? 'rgba(96,165,250,.30)' : 'rgba(37,99,235,.20)'); fg.addColorStop(1, ST.dark ? 'rgba(96,165,250,.08)' : 'rgba(37,99,235,.05)');
        g.fillStyle = fg; g.beginPath(); top.concat(bot).forEach(function (pt, i) { if (i === 0) g.moveTo(pt[0], pt[1]); else g.lineTo(pt[0], pt[1]); }); g.closePath(); g.fill();
        strokeSpline2D(g, top, ST.dark ? 'rgba(191,219,254,.65)' : 'rgba(37,99,235,.45)', 1.2, null, [4, 3]);
      }
      var valLine = [], opLine = [];
      rows.forEach(function (r, idx) {
        var cx = padL + stepX * (idx + 0.5), id = 'y|' + r.y, isHot = (c.hot === id || c.pin === id || mState.selYear === r.y);
        g.globalAlpha = mDim(r.y) ? 0.22 : 1;
        if (isHot) { g.fillStyle = ST.dark ? 'rgba(251,191,36,.12)' : 'rgba(37,99,235,.08)'; g.fillRect(cx - stepX * 0.46, padT, stepX * 0.92, ph); }
        if (!r.isFc) {
          var subW = Math.min(13, stepX * 0.23);
          [{ dx: -subW * 1.15, v: r.erp, col: '#16a34a' }, { dx: 0, v: r.tax, col: '#2563eb' }, { dx: subW * 1.15, v: r.fs, col: '#5b21b6' }].forEach(function (b) {
            if (!fin(b.v) || b.v <= 0) return;
            var bh = (b.v / maxY) * ph, bx = cx + b.dx - subW * 0.46, by = padT + ph - bh, rgb = hex2rgb(b.col); if (ST.dark) rgb = shade(rgb, 0.20);
            var bg = g.createLinearGradient(0, by, 0, padT + ph); bg.addColorStop(0, rgba(shade(rgb, 0.25), 0.96)); bg.addColorStop(1, rgba(shade(rgb, -0.15), 0.88));
            g.fillStyle = bg; g.fillRect(bx, by, subW * 0.92, bh); g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(bx, by, subW * 0.92, 1.8);
          });
        } else {
          var fbh = (r.fs / maxY) * ph, fbw = Math.min(26, stepX * 0.48), fbx = cx - fbw / 2, fby = padT + ph - fbh;
          var fbg = g.createLinearGradient(0, fby, 0, padT + ph); fbg.addColorStop(0, ST.dark ? 'rgba(96,165,250,.62)' : 'rgba(37,99,235,.48)'); fbg.addColorStop(1, ST.dark ? 'rgba(37,99,235,.16)' : 'rgba(191,219,254,.24)');
          g.fillStyle = fbg; g.fillRect(fbx, fby, fbw, fbh);
          g.strokeStyle = isHot ? '#fbbf24' : (ST.dark ? '#bfdbfe' : '#2563eb'); g.lineWidth = isHot ? 2.2 : 1.3; g.setLineDash([4, 3]); g.strokeRect(fbx, fby, fbw, fbh); g.setLineDash([]);
        }
        if (fin(r.val)) valLine.push([cx, padT + ph - (r.val / maxY) * ph]);
        if (fin(r.opMargin)) opLine.push([cx, padT + ph - (clamp(r.opMargin, 0, 40) / 40) * ph]);
        g.font = '700 10px Pretendard,"Malgun Gothic",sans-serif'; g.fillStyle = r.isFc ? (ST.dark ? '#bfdbfe' : '#1e40af') : txtCol; g.textAlign = 'center'; g.textBaseline = 'bottom';
        if (W > 440 && fin(r.val)) g.fillText(man(r.val), cx, padT + ph - (r.val / maxY) * ph - 6);
        g.font = (isHot ? '800 ' : '650 ') + (W < 430 ? '10px' : '11px') + ' Pretendard,"Malgun Gothic",sans-serif';
        g.fillStyle = isHot ? (ST.dark ? '#fde68a' : '#1e40af') : (r.isFc ? (ST.dark ? '#60a5fa' : '#2563eb') : txtCol); g.textBaseline = 'top';
        g.fillText(r.y + (r.isFc ? '(시)' : (r.partial ? '(진)' : '')), cx, padT + ph + 9);
        c.hits.push({ id: id, yr: r.y, rect: [cx - stepX * 0.46, padT, stepX * 0.92, ph + 28],
          tip: r.isFc ? ('<b>' + r.y + '년 시나리오 (2D · 예측 아님)</b><br>시나리오 매출: <b>' + won(r.fs) + '</b><br>폭: ' + won(r.low) + ' ~ ' + won(r.high) + '<br>영업이익률(가정): ' + pct1(r.opMargin))
            : ('<b>' + r.y + '년 대조 (2D)</b><br>ERP: ' + won(r.erp) + ' · 세금계산서: ' + won(r.tax) + '<br>손익계산서 매출: <b>' + won(r.fs) + '</b> · 영업이익률 ' + pct1(r.opMargin)) });
      });
      g.globalAlpha = 1;
      strokeSpline2D(g, valLine, ST.dark ? '#bfdbfe' : '#1e40af', 2.4, ST.dark ? 'rgba(96,165,250,.28)' : 'rgba(37,99,235,.15)');
      if (opLine.length > 1) { strokeSpline2D(g, opLine, ST.dark ? '#fde68a' : '#d97706', 2.0, null, [5, 4]); }
      opLine.forEach(function (pt) { g.fillStyle = ST.dark ? '#fbbf24' : '#d97706'; g.beginPath(); g.arc(pt[0], pt[1], 3.2, 0, 6.2832); g.fill(); });
    } else if (mState.lens === 'mix') {
      var mr = rows.filter(function (r) { return r.cat && catSum(r.cat) > 0; }); if (!mr.length) return;
      var maxM = 1; mr.forEach(function (r) { maxM = Math.max(maxM, catSum(r.cat)); }); maxM *= 1.15;
      for (var mgi = 0; mgi <= 4; mgi++) {
        var mgy = padT + ph - (mgi / 4) * ph;
        g.strokeStyle = gridCol; g.lineWidth = 1; g.beginPath(); g.moveTo(padL, mgy); g.lineTo(padL + pw, mgy); g.stroke();
        g.font = '600 10.5px Pretendard,"Malgun Gothic",sans-serif'; g.fillStyle = txtCol; g.textAlign = 'right'; g.textBaseline = 'middle'; g.fillText(man(maxM * mgi / 4), padL - 7, mgy);
        g.fillStyle = ST.dark ? '#4ade80' : '#166534'; g.textAlign = 'left'; g.fillText((mgi * 25) + '%', padL + pw + 6, mgy);
      }
      g.font = '700 11px Pretendard,"Malgun Gothic",sans-serif'; g.fillStyle = txtCol; g.textAlign = 'left'; g.fillText('입금 종류별 누적(만원) · 반복매출(자문+기금) 비중(%)', padL, padT - 14);
      var stX = pw / mr.length, bwM = Math.min(34, stX * 0.58), rec = [];
      mr.forEach(function (r, idx) {
        var cx = padL + stX * (idx + 0.5), x0 = cx - bwM / 2, yCur = padT + ph, id = 'y|' + r.y;
        g.globalAlpha = mDim(r.y) ? 0.22 : 1;
        CATS().forEach(function (cat) { var v = r.cat[cat.k] || 0, bh = (v / maxM) * ph; if (bh < 0.5) return; var rgb = hex2rgb(cat.color); if (ST.dark) rgb = shade(rgb, 0.16); g.fillStyle = rgba(rgb, r.isFc ? 0.62 : 0.94); g.fillRect(x0, yCur - bh, bwM, bh); g.strokeStyle = ST.dark ? 'rgba(30,41,59,.6)' : '#ffffff'; g.lineWidth = 0.8; g.strokeRect(x0, yCur - bh, bwM, bh); yCur -= bh; });
        if (fin(r.recRatio)) rec.push([cx, padT + ph - (r.recRatio / 100) * ph]);
        g.font = '650 10.5px Pretendard,"Malgun Gothic",sans-serif'; g.fillStyle = txtCol; g.textAlign = 'center'; g.textBaseline = 'top'; g.fillText(r.y + (r.isFc ? '*' : ''), cx, padT + ph + 9);
        c.hits.push({ id: id, yr: r.y, rect: [cx - stX * 0.45, padT, stX * 0.9, ph + 26], tip: '<b>' + r.y + '년 수익구조' + (r.isFc ? ' (시나리오)' : '') + '</b><br>합계 ' + won(catSum(r.cat)) + ' · 반복매출 비중 <b>' + pct1(r.recRatio) + '</b>' });
      });
      g.globalAlpha = 1;
      strokeSpline2D(g, rec, ST.dark ? '#4ade80' : '#166534', 2.5, ST.dark ? 'rgba(74,222,128,.25)' : 'rgba(22,163,74,.16)');
      rec.forEach(function (pt) { g.fillStyle = '#16a34a'; g.beginPath(); g.arc(pt[0], pt[1], 3.6, 0, 6.2832); g.fill(); g.fillStyle = '#ffffff'; g.beginPath(); g.arc(pt[0], pt[1], 1.5, 0, 6.2832); g.fill(); });
    } else {
      var hr = mHist().filter(function (r) { return r.erp != null && r.q; }); if (!hr.length) return;
      var cw = pw / hr.length, ch = ph / 4, maxQv = 1, maxPer = 1, prod = [];
      g.font = '700 11px Pretendard,"Malgun Gothic",sans-serif'; g.fillStyle = txtCol; g.textAlign = 'left';
      g.fillText('해마다 분기별 ERP 확정입금(만원) · 1인당 연매출(노란 선 — 재무제표 인원 칸이 있을 때만)', padL, padT - 14);
      hr.forEach(function (r) { r.q.forEach(function (v) { if (v > maxQv) maxQv = v; }); if (r.head && r.fs && r.fs / r.head > maxPer) maxPer = r.fs / r.head; }); maxPer *= 1.18;
      hr.forEach(function (r, yi) {
        var x = padL + yi * cw, id = 'y|' + r.y;
        g.globalAlpha = mDim(r.y) ? 0.22 : 1;
        for (var qi = 0; qi < 4; qi++) {
          var y = padT + (3 - qi) * ch, qv = r.q[qi], rt = qv / maxQv;
          var col = ST.dark ? mixRgb(hex2rgb('#1e3a8a'), hex2rgb('#4ade80'), Math.max(0, (rt - 0.45) / 0.55)) : mixRgb(hex2rgb('#eff6ff'), hex2rgb('#2563eb'), rt);
          g.fillStyle = rgba(col, 0.86); g.fillRect(x + 3, y + 3, cw - 6, ch - 6);
          g.font = '700 11px Pretendard,"Malgun Gothic",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; haloText(g, man(qv), x + cw * 0.5, y + ch * 0.5);
        }
        g.font = '700 11px Pretendard,"Malgun Gothic",sans-serif'; g.fillStyle = txtCol; g.textAlign = 'center'; g.textBaseline = 'top'; g.fillText(r.y + '년' + (r.head ? ' (' + r.head + '명)' : ''), x + cw * 0.5, padT + ph + 9);
        if (r.head && r.fs) prod.push([x + cw * 0.5, padT + ph - ((r.fs / r.head) / maxPer) * ph]);
        c.hits.push({ id: id, yr: r.y, rect: [x, padT, cw, ph + 26], tip: '<b>' + r.y + '년 분기</b><br>ERP ' + won(r.erp) + ' · 1인당 ' + (r.head && r.fs ? '<b>' + won(Math.round(r.fs / r.head)) + '</b> (' + r.head + '명)' : '— (인원 칸 없음)') });
      });
      g.globalAlpha = 1;
      ['4Q', '3Q', '2Q', '1Q'].forEach(function (ql, idx) { g.font = '700 11px Pretendard,"Malgun Gothic",sans-serif'; g.fillStyle = txtCol; g.textAlign = 'right'; g.textBaseline = 'middle'; g.fillText(ql, padL - 8, padT + (idx + 0.5) * ch); });
      if (prod.length > 1) strokeSpline2D(g, prod, ST.dark ? '#fde68a' : '#d97706', 2.6, ST.dark ? 'rgba(251,191,36,.30)' : 'rgba(217,119,6,.18)');
      prod.forEach(function (pt) { g.fillStyle = '#fbbf24'; g.beginPath(); g.arc(pt[0], pt[1], 4, 0, 6.2832); g.fill(); });
    }
  }
  function stBadge(r) {
    if (r.isFc) return '<span class="badge b-info">시나리오</span>';
    return { ok: '<span class="badge b-ok">기준 안</span>', warn: '<span class="badge b-warn">점검</span>', bad: '<span class="badge b-lock">차액주의</span>', nobase: '<span class="badge b-info">기준 전</span>', part: '<span class="badge b-nil">진행 중</span>' }[r.status] || '<span class="badge b-nil">—</span>';
  }
  function renderMultiKpisAndTable(kpiOnly) {
    var rows = mState.rows, hist = mHist(), fc = rows.filter(function (r) { return r.isFc; });
    var full = hist.filter(function (r) { return !r.partial && (!r.thin || r.fs != null) && fin(r.val) && r.val > 0; });
    var cagr = null; if (full.length >= 2) { var a = full[0], b = full[full.length - 1], yrs = b.y - a.y; if (yrs > 0) cagr = (Math.pow(b.val / a.val, 1 / yrs) - 1) * 100; }
    var lastCat = null; for (var i = hist.length - 1; i >= 0; i--) if (fin(hist[i].recRatio)) { lastCat = hist[i]; break; }
    var lastFc = fc.length ? fc[fc.length - 1] : null, fcBase = rows.filter(function (r) { return !r.isFc && fin(r.val); }).slice(-1)[0];
    var fcCagr = (lastFc && fcBase && fcBase.val > 0) ? (Math.pow(lastFc.fs / (fcBase.partial && fcBase.fs == null ? fcBase.val * 12 / Math.max(1, endM()) : fcBase.val), 1 / 3) - 1) * 100 : null;
    var gapSum = 0, fsSum = 0, nDiff = 0; hist.forEach(function (r) { if (r.diff != null && !r.partial) { gapSum += Math.abs(r.diff); fsSum += r.fs; nDiff++; } });
    var match = (nDiff && fsSum > 0) ? Math.max(0, 100 - gapSum / fsSum * 100) : null;
    var th = SET.thresholds || {}, rw = numOrNull(th.reconWarn), rb = numOrNull(th.reconBad);
    var badge = $('mReconStatusBadge');
    if (match == null) { badge.className = 'badge b-nil'; badge.textContent = '대조 파일 넣기 전'; }
    else if (rw == null && rb == null) { badge.className = 'badge b-info'; badge.textContent = 'ERP↔재무제표 정합성 ' + match.toFixed(1) + '% (판정 기준 전)'; }
    else { var gap = 100 - match; badge.className = 'badge ' + ((rb != null && gap >= rb) ? 'b-lock' : ((rw != null && gap >= rw) ? 'b-warn' : 'b-ok')); badge.textContent = 'ERP↔재무제표 정합성 ' + match.toFixed(1) + '%'; }
    $('mVatNotice').textContent = '단위: 원(화면은 억·만원) · ' + (mState.vatAlign ? 'ERP ÷1.1 공급가 어림' : 'ERP 부가세 포함 총액');
    var hy = hist.map(function (r) { return r.y; });
    $('mHorizonBadge').textContent = hist.length ? '실적 ' + hist.length + '개 해(' + hy[0] + '~' + hy[hy.length - 1] + ')' + (fc.length ? ' + 시나리오 3개 해(' + fc[0].y + '~' + fc[fc.length - 1].y + ')' : '') : '연도 자료 없음';
    var k = [
      ['해마다 성장률 (온전한 해)', cagr == null ? '—' : '연평균 ' + (cagr >= 0 ? '+' : '') + cagr.toFixed(1) + '%', cagr == null ? '<span class="na">온전히 끝난 해가 둘 이상 있어야 셉니다</span>' : '<span class="na">' + full[0].y + '→' + full[full.length - 1].y + ' · ' + (full[full.length - 1].fs != null ? '재무제표' : 'ERP') + ' 기준</span>', sparkSvg(full.map(function (x) { return x.val; }), full.length - 1, '#16a34a'), cagr == null],
      ['반복 매출(자문·기금) 비중', lastCat ? pct1(lastCat.recRatio) : '—', lastCat ? '<span class="na">' + lastCat.y + '년 ERP 입금 종류 기준</span>' : '<span class="na">ERP 입금 종류가 있는 해가 없습니다</span>', sparkSvg(hist.map(function (x) { return x.recRatio; }), hist.length - 1, '#0e7490'), !lastCat],
      [(lastFc ? lastFc.y + '년 ' : '') + '시나리오 매출', lastFc ? won(lastFc.fs) : '—', lastFc ? '<span class="na">3년 연평균 ' + (fcCagr == null ? '—' : (fcCagr >= 0 ? '+' : '') + fcCagr.toFixed(1) + '%') + ' · 예측 아님</span>' : '<span class="na">출발할 해가 없습니다</span>', sparkSvg(rows.map(function (x) { return x.val; }), rows.length - 1, '#2563eb'), !lastFc],
      ['ERP·손익 정합성', match == null ? '—' : match.toFixed(1) + '%', match == null ? '<span class="na">재무제표 파일을 넣으면 셉니다</span>' : '<span class="na">' + nDiff + '개 해 차액 합 ' + won(gapSum) + '</span>', '', match == null]
    ];
    $('mKpis').innerHTML = k.map(function (x) { return '<div class="kpi"><div class="kh"><div class="k" title="' + esc(x[0]) + '">' + esc(x[0]) + '</div>' + (x[3] || '') + '</div><div class="v' + (x[4] ? ' nil' : '') + '">' + esc(x[1]) + '</div><div class="d">' + x[2] + '</div></div>'; }).join('');
    if (kpiOnly) return;
    var pickN = Object.keys(mState.pick).length;
    var h = '<thead><tr><th class="ck"><input type="checkbox" id="mCkAll" aria-label="보이는 연도 모두 고르기"' + (pickN && pickN === rows.length ? ' checked' : '') + '></th><th class="no">№</th><th class="l">연도 · 구분</th>' +
      '<th title="ERP 확정입금' + (mState.vatAlign ? ' (÷1.1 공급가 어림)' : ' (통장 입금 총액)') + '">① ERP 확정입금</th><th title="세금계산서·카드·현금영수증 공급가액(넣은 파일)">② 세금계산서·증빙</th><th title="손익계산서 매출액(넣은 파일)">③ 재무제표 매출액</th>' +
      '<th title="① − ③">차액 (①−③)</th><th title="재무상태표 기말 매출채권(넣은 파일)">기말 미수금</th><th title="인건비 + 판매관리비(넣은 파일)">인건비·판관비</th><th title="③ − 인건비·판관비">영업이익(률)</th><th class="l">판정 · 비고</th></tr></thead><tbody>';
    rows.forEach(function (r, idx) {
      var cls = (r.isFc ? 'fc-row ' : '') + ((mState.selYear === r.y || mState.pick[r.y]) ? 'sel' : '');
      var ck = '<td class="ck"><input type="checkbox" data-pick-yr="' + r.y + '"' + (mState.pick[r.y] ? ' checked' : '') + ' aria-label="' + r.y + '년 고르기"></td><td class="no">' + (idx + 1) + '</td>';
      var dTxt = r.isFc ? '±' + won(Math.round((r.high - r.low) / 2)) : (r.diff == null ? '—' : (r.diff >= 0 ? '+' : '') + won(r.diff) + ' (' + pct1(r.diffPct) + ')');
      var dCol = r.isFc ? '#1e40af' : (r.status === 'bad' ? '#991b1b' : (r.status === 'warn' ? '#854d0e' : '#475569'));
      function inp(field, v, lbl) { return '<td><input type="number" class="num-inp" min="0" step="1" inputmode="numeric" data-f="' + field + '" data-yr="' + r.y + '" value="' + (fin(v) ? Math.round(v / 1e4) : '') + '" aria-label="' + r.y + '년 ' + lbl + '(만원)" placeholder="만원"></td>'; }
      if (!r.isFc && mState.editMode) {
        h += '<tr class="' + cls + '" data-yr="' + r.y + '">' + ck + '<td class="l"><b>' + r.y + '년' + (r.partial ? ' (진행 중)' : ' 결산') + '</b></td><td>' + won(r.erp) + '</td>' +
          inp('tax', r.tax, '세금계산서 공급가액') + inp('fs', r.fs, '재무제표 매출액') + '<td style="font-weight:800;color:' + dCol + '">' + dTxt + '</td>' + inp('ar', r.ar, '기말미수금') + inp('cost', r.cost, '인건비·판관비') +
          '<td><b>' + won(r.opInc) + '</b> (' + pct1(r.opMargin) + ')</td><td class="l" title="' + esc(r.reason) + '">' + stBadge(r) + ' ' + esc(r.reason) + '</td></tr>';
      } else {
        h += '<tr class="' + cls + '" data-yr="' + r.y + '" style="cursor:pointer">' + ck + '<td class="l"><b>' + r.y + '년 ' + (r.isFc ? '시나리오' : (r.partial ? '진행 중' : '결산실적')) + '</b></td>' +
          '<td>' + (r.isFc ? '<span class="na">—</span>' : won(r.erp)) + '</td><td>' + won(r.tax) + '</td><td><b>' + won(r.fs) + '</b></td>' +
          '<td style="font-weight:750;color:' + dCol + '">' + dTxt + '</td><td>' + won(r.ar) + '</td><td>' + won(r.cost) + '</td><td><b>' + won(r.opInc) + '</b> (' + pct1(r.opMargin) + ')</td>' +
          '<td class="l" title="' + esc(r.reason) + '">' + stBadge(r) + ' ' + esc(r.reason) + '</td></tr>';
      }
    });
    if (!rows.length) h += '<tr><td colspan="11" class="l">' + esc(finOk() ? 'ERP 입금이 든 해가 없습니다 — 재무제표 파일을 넣으면 그 해부터 보입니다' : finWhy()) + '</td></tr>';
    $('mReconTbl').innerHTML = h + '</tbody>';
    $('mReconCards').innerHTML = rows.map(function (r, idx) {
      var dTxt = r.isFc ? '±' + won(Math.round((r.high - r.low) / 2)) : (r.diff == null ? '차액 —' : (r.diff >= 0 ? '+' : '') + won(r.diff));
      return '<div class="card' + ((mState.selYear === r.y || mState.pick[r.y]) ? ' sel' : '') + '" data-yr="' + r.y + '"><input type="checkbox" data-pick-yr="' + r.y + '"' + (mState.pick[r.y] ? ' checked' : '') + ' aria-label="' + r.y + '년 고르기"><span class="no">' + (idx + 1) + '</span>' +
        '<div><div class="l1"><b>' + r.y + '년 ' + (r.isFc ? '시나리오' : (r.partial ? '진행 중' : '결산')) + '</b><span style="margin-left:auto;font-weight:800;color:#1e293b">' + won(r.val) + '</span></div>' +
        '<div class="l2"><span>' + (r.isFc ? '영업이익 ' + pct1(r.opMargin) : 'ERP ' + won(r.erp)) + '</span><span>' + dTxt + '</span><span title="' + esc(r.reason) + '">' + esc(r.reason) + '</span></div></div></div>';
    }).join('') || '<div class="card foot">연도 자료가 없습니다</div>';
    $('mPanel').classList.toggle('editing', !!mState.editMode);
    $('mSel').classList.toggle('on', pickN > 0);
    $('mSelN').textContent = pickN + '개 해 선택' + (mState.focusYears ? ' · 강조 중' : '');
    $('mSrcLine').textContent = '자료: 해마다 ERP 확정입금(계산 모듈 집계 · ' + (BASIS === 'accrual' ? '귀속월' : '입금일') + (NET ? ' · 순액' : '') + ') · 이 브라우저에 넣은 세금계산서·재무제표(서버에 저장하지 않음)' + (mState.fcNote ? ' · ⚠ ' + mState.fcNote : '');
    var fsum = []; if (FILE_NAMES.tax) fsum.push('세금계산서 «' + FILE_NAMES.tax + '»'); if (FILE_NAMES.fs) fsum.push('재무제표 «' + FILE_NAMES.fs + '»');
    var fe = $('mFileSum'); fe.textContent = fsum.length ? fsum.join(' · ') + ' — 이 화면 안에서만, 새로 고치면 사라집니다' : '없음 — 이 화면 안에서만 보고, 새로 고치면 사라집니다'; fe.className = fsum.length ? '' : 'na';
  }
  function mClearPick() {
    if (!Object.keys(mState.pick).length && !mState.focusYears) return;
    mState.pick = {}; mState.focusYears = null;
    buildMulti3D(); if (SC.m) { SC.m.dirty = true; CH.m.dirty = true; } renderMultiKpisAndTable();
  }
  function refreshMultiAll(grow) {
    if (!DS || !SC.m) return;
    computeMultiRows();
    var w = buildMulti3D(); smsg('smM', w); smsg('smM2d', mState.rows.length ? '' : w);
    if (grow) SC.m.startGrow(); else SC.m.dirty = true;
    CH.m.dirty = true;
    renderMultiKpisAndTable();
    sideDash();
  }
  function applyMultiYearPick(yr, pinId) {
    mState.selYear = yr; SC.m.pin = pinId; CH.m.pin = pinId;
    buildMulti3D(); SC.m.dirty = true; CH.m.dirty = true;
    renderMultiKpisAndTable();
    var r = mState.rows.filter(function (x) { return x.y === yr; })[0];
    if (r) {
      setSync('syncTxtM', r.isFc ? ('🔗 ' + r.y + '년 시나리오: 매출 ' + won(r.fs) + ' · 영업이익(가정) ' + won(r.opInc) + ' — 예측 아님')
        : ('🔗 ' + r.y + '년 대조: ERP ' + won(r.erp) + ' · 세금계산서 ' + won(r.tax) + ' · 손익계산서 ' + won(r.fs) + ' (차액 ' + (r.diff == null ? '—' : (r.diff >= 0 ? '+' : '') + won(r.diff)) + ')'));
      $('btnResetSyncM').style.display = '';
    }
  }
  /* 파일 읽기 — 단위: 고른 값 → 첫 줄(«(만원)»·«(원)») → 짐작(파일 하나에 단위 하나, 짐작했다고 알림). 숫자가 아니거나 음수인 칸은 건너뛴다 */
  var mUnitNote = '';
  function mRaw(v) { if (v == null || v === '') return null; var s = String(v).replace(/[^0-9.\-]/g, ''); if (!/\d/.test(s)) return null; v = +s; if (!isFinite(v) || v < 0) return null; return v; }
  function mNum(v, unit) { v = mRaw(v); if (v == null) return null; return unit === 'man' ? Math.round(v * 10000) : Math.round(v); }
  function mGuessUnit(raws) {
    var big = raws.some(function (v) { v = mRaw(v); return v != null && v > 2000000; });
    mUnitNote = big ? '단위를 적지 않아 파일 전체를 «원»으로 짐작했습니다 — 확인하세요' : '단위를 적지 않아 파일 전체를 «만원»으로 짐작했습니다 — 확인하세요';
    return big ? 'won' : 'man';
  }
  function csvSplit(line) {
    var out = [], cur = '', q = false;
    for (var i = 0; i < line.length; i++) {
      var ch = line.charAt(i);
      if (q) { if (ch === '"') { if (line.charAt(i + 1) === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
      else if (ch === '"') q = true; else if (ch === ',') { out.push(cur.trim()); cur = ''; } else cur += ch;
    }
    out.push(cur.trim()); return out;
  }
  function putFile(y, field, v) { if (v == null || !(y >= 1990 && y <= endY())) return false; (FILES[y] = FILES[y] || {})[field] = v; return true; }
  function parseUploadText(txt, mode, pick) {
    txt = String(txt || '').replace(/^﻿/, '').trim(); mUnitNote = '';
    if (!txt) return 0;
    var hit = {};
    if (txt.charAt(0) === '[' || txt.charAt(0) === '{') {
      var obj = null; try { obj = JSON.parse(txt); } catch (e) { obj = null; }
      if (obj) {
        var arr = Array.isArray(obj) ? obj : (obj.years || obj.rows || obj.data || []); if (!Array.isArray(arr)) arr = [];
        var unit = pick !== 'auto' ? pick : ((obj && !Array.isArray(obj) && /만원/.test(obj.unit || '')) ? 'man' : ((obj && !Array.isArray(obj) && /원/.test(obj.unit || '')) ? 'won' : ''));
        if (!unit) { var jr = []; arr.forEach(function (it) { if (it && typeof it === 'object') ['taxSupply', '세금계산서', 'fsRev', '매출액', 'cost', '판관비', 'ar', '미수금'].forEach(function (k) { jr.push(it[k]); }); }); unit = mGuessUnit(jr); }
        arr.forEach(function (it) {
          if (!it || typeof it !== 'object') return;
          var y = +(it.year || it.yr || it['연도']); if (!y) return;
          function take(field, a, b) { if (putFile(y, field, mNum(it[a] != null ? it[a] : it[b], unit))) hit[y] = 1; }
          take('tax', 'taxSupply', '세금계산서'); take('fs', 'fsRev', '매출액'); take('cost', 'cost', '판관비'); take('ar', 'ar', '미수금');
          var hd = mRaw(it.head != null ? it.head : it['인원']); if (hd != null && hd > 0 && putFile(y, 'head', Math.round(hd))) hit[y] = 1;
        });
        return Object.keys(hit).length;
      }
    }
    var lines = txt.split(/\r?\n/).filter(function (l) { return l.trim().length > 0; });
    if (lines.length < 2) return 0;
    var head = csvSplit(lines[0]);
    var unit2 = pick !== 'auto' ? pick : (/만원/.test(lines[0]) ? 'man' : (/원\)|_원(?=,|\s|$)/.test(lines[0]) ? 'won' : ''));
    var rows = lines.slice(1).map(csvSplit);
    var iY = -1, iT = -1, iF = -1, iC = -1, iA = -1, iH = -1;
    head.forEach(function (col, i) {
      if (/연도|년도|year|귀속/i.test(col)) iY = i;
      else if (/인원|head/i.test(col)) iH = i;
      else if (/erp|입금/i.test(col)) { /* ERP 칸은 읽지 않는다 — ERP 숫자는 계산 모듈 집계만 쓴다 */ }
      else if (/세금계산서|공급가|증빙|tax/i.test(col)) iT = i;
      else if (/재무제표|손익|결산매출|매출액|fs|rev/i.test(col)) iF = i;
      else if (/비용|판관비|인건비|원가|cost/i.test(col)) iC = i;
      else if (/미수|매출채권|ar/i.test(col)) iA = i;
    });
    if (iY < 0) iY = 0;
    if (!unit2) { var cr = []; rows.forEach(function (cols) { cols.forEach(function (v, ci) { if (ci !== iY && ci !== iH) cr.push(v); }); }); unit2 = mGuessUnit(cr); }
    var sum = {};
    rows.forEach(function (cols) {
      var m = String(cols[iY] || '').match(/((?:19|20)\d{2})/); if (!m) return;
      var y = +m[1], b = sum[y] || (sum[y] = {});
      function add(field, ci) { if (ci < 0) return; var v = mNum(cols[ci], unit2); if (v != null) b[field] = (b[field] || 0) + v; }
      add('tax', iT); add('fs', iF); add('cost', iC);
      if (iA >= 0) { var av = mNum(cols[iA], unit2); if (av != null) b.ar = av; }       /* 미수금은 기말 잔액 — 더하지 않고 마지막 값 */
      if (iH >= 0) { var hv = mRaw(cols[iH]); if (hv != null && hv > 0) b.head = Math.round(hv); }
      if (b.tax == null && b.fs == null && iT < 0 && iF < 0 && cols.length >= 2) { var v2 = mNum(cols[1], unit2); if (v2 != null) { if (mode === 'tax') b.tax = (b.tax || 0) + v2; else b.fs = (b.fs || 0) + v2; } }
    });
    Object.keys(sum).forEach(function (yk) { var b = sum[yk], y = +yk, any = false; ['tax', 'fs', 'cost', 'ar', 'head'].forEach(function (f) { if (b[f] != null && putFile(y, f, b[f])) any = true; }); if (any) hit[y] = 1; });
    return Object.keys(hit).length;
  }
  function wireDrop(cardId, inpId, metaId, unitId, mode, labelKo) {
    var card = $(cardId), inp = $(inpId), meta = $(metaId);
    function handle(f) {
      if (!f) return;
      if (f.size > 5 * 1024 * 1024) { showToast('파일이 너무 큽니다(5MB 넘음) — 연도별 합계만 담은 파일을 넣어 주세요.'); return; }
      var rd2 = new FileReader();
      rd2.onload = function () {
        var cnt = parseUploadText(rd2.result, mode, $(unitId).value);
        if (cnt > 0) {
          FILE_NAMES[mode] = f.name; card.classList.add('loaded');
          meta.textContent = '✓ 불러옴: ' + f.name + ' (' + cnt + '개 해 · 서버에 안 보냄 · 새로 고치면 사라짐)' + (mUnitNote ? ' · ⚠ ' + mUnitNote : '');
          multiInit(true); refreshMultiAll(true);
          showToast(mUnitNote ? ('⚠ ' + mUnitNote) : (labelKo + ' 파일(«' + f.name + '»)에서 ' + cnt + '개 해 숫자를 읽어 대조표에 넣었습니다.'));
        } else showToast('파일을 읽었으나 연도 칸이나 숫자를 찾지 못했습니다 — 「표준 업로드 양식 CSV 받기」를 참고해 주세요.');
      };
      rd2.readAsText(f);
    }
    inp.addEventListener('change', function (e) { handle(e.target.files && e.target.files[0]); e.target.value = ''; });
    ['dragenter', 'dragover'].forEach(function (ev) { card.addEventListener(ev, function (e) { e.preventDefault(); card.classList.add('dragover'); }); });
    ['dragleave', 'drop'].forEach(function (ev) { card.addEventListener(ev, function (e) { e.preventDefault(); card.classList.remove('dragover'); }); });
    card.addEventListener('drop', function (e) { handle(e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]); });
  }
  function stopMultiCine() {
    if (multiCineTimer) { clearInterval(multiCineTimer); multiCineTimer = null; }
    ST.cine = !!cineTimer;
    var b = $('btnMultiCine'); if (b) b.textContent = '🎬 다년 시네마 전망 영상';
    var hud = $('hudM'); if (hud) hud.classList.remove('on');
    if (CH.m) { CH.m.scanX = null; CH.m.dirty = true; }
  }
  function bindMulti() {
    chipRow('mLens', [{ k: 'recon', name: '3자 대조 · 시나리오', on: true }, { k: 'mix', name: '수익구조 (반복·변동)' }, { k: 'season', name: '분기 계절성 · 1인당' }], function (k) { mState.lens = k; refreshMultiAll(true); });
    chipRow('mScen', [{ k: 'cons', name: '보수적(−5%p)' }, { k: 'base', name: '기본값', on: true }, { k: 'agg', name: '적극(+5%p)' }], function (k) { mState.scen = k; mState.touched = false; multiInit(true); refreshMultiAll(false); });
    ['rngDrvAdv', 'rngDrvCase', 'rngDrvCost'].forEach(function (id) {
      $(id).addEventListener('input', function () {
        mState.drvAdv = +$('rngDrvAdv').value; mState.drvCase = +$('rngDrvCase').value; mState.drvCost = +$('rngDrvCost').value; mState.touched = true;
        syncDrvLabels(); refreshMultiAll(false);
      });
    });
    $('btnVatAlign').addEventListener('click', function (e) {
      mState.vatAlign = !mState.vatAlign; setPressed(e.currentTarget, mState.vatAlign);
      e.currentTarget.textContent = mState.vatAlign ? '🧾 부가세 ÷1.1 공급가 어림' : '🧾 부가세 포함 통장 입금 총액 그대로';
      refreshMultiAll(false);
      showToast(mState.vatAlign ? 'ERP 입금을 ÷1.1 해 공급가로 어림했습니다 — 입금 줄마다 과세 여부를 본 값이 아닙니다.' : '부가세를 떼지 않은 통장 입금 총액으로 견줍니다.');
    });
    $('btnEditRecon').addEventListener('click', function (e) {
      mState.editMode = !mState.editMode; setPressed(e.currentTarget, mState.editMode);
      e.currentTarget.textContent = mState.editMode ? '✓ 숫자 직접 고치기 끝' : '✏️ 표에서 세금계산서·재무제표 숫자 직접 고치기';
      renderMultiKpisAndTable();
      if (mState.editMode) showToast('표 안 숫자(만원)를 고치면 3D·2D 가 바로 바뀝니다 — 이 화면 안에서만, 저장하지 않습니다.');
    });
    $('btnClearFiles').addEventListener('click', function () {
      FILES = {}; FILE_NAMES = { tax: '', fs: '' };
      ['dropTax', 'dropFs'].forEach(function (id) { $(id).classList.remove('loaded'); });
      $('metaTaxFile').textContent = '아직 넣지 않음 — 표의 세금계산서 칸은 «—»'; $('metaFsFile').textContent = '아직 넣지 않음 — 표의 재무제표 칸은 «—»';
      multiInit(true); refreshMultiAll(false); showToast('넣은 세금계산서·재무제표 숫자를 이 화면에서 비웠습니다.');
    });
    $('mReconTbl').addEventListener('click', function (e) {
      if (mState.editMode || e.target.tagName === 'INPUT') return;
      var tr = e.target.closest('tr[data-yr]'); if (tr) { var yr = +tr.getAttribute('data-yr'); applyMultiYearPick(yr, 'y|' + yr); }
    });
    $('mReconTbl').addEventListener('input', function (e) {
      var inp = e.target; if (!inp.classList.contains('num-inp')) return;
      var y = +inp.getAttribute('data-yr'), f = inp.getAttribute('data-f'), raw = mRaw(inp.value);
      if (!y || !f) return;
      FILES[y] = FILES[y] || {};
      if (raw == null) delete FILES[y][f]; else FILES[y][f] = Math.round(raw * 10000);
      computeMultiRows(); buildMulti3D(); SC.m.dirty = true; CH.m.dirty = true;
      renderMultiKpisAndTable(true);   /* 입력 중에는 표를 다시 그리지 않는다(입력 자리 지키기) */
    });
    function onPick(e) {
      var t = e.target;
      if (t.classList.contains('num-inp')) { renderMultiKpisAndTable(); return; }
      if (t.id === 'mCkAll') { mState.pick = {}; if (t.checked) mState.rows.forEach(function (r) { mState.pick[r.y] = 1; }); renderMultiKpisAndTable(); return; }
      var py = t.getAttribute && t.getAttribute('data-pick-yr');
      if (py) { if (t.checked) mState.pick[py] = 1; else delete mState.pick[py]; renderMultiKpisAndTable(); }
    }
    $('mReconTbl').addEventListener('change', onPick);
    $('mReconCards').addEventListener('change', onPick);
    $('mReconCards').addEventListener('click', function (e) { if (e.target.tagName === 'INPUT') return; var c = e.target.closest('[data-yr]'); if (c) { var yr = +c.getAttribute('data-yr'); applyMultiYearPick(yr, 'y|' + yr); } });
    $('mSel').addEventListener('click', function (e) {
      var a = e.target.getAttribute('data-act'); if (!a) return;
      if (a === 'focus') { mState.focusYears = Object.keys(mState.pick).length ? Object.assign({}, mState.pick) : null; buildMulti3D(); SC.m.dirty = true; CH.m.dirty = true; renderMultiKpisAndTable(); setSync('syncTxtM', '🔗 고른 ' + Object.keys(mState.pick).length + '개 해만 3D·2D 에서 진하게 보입니다'); $('btnResetSyncM').style.display = ''; }
      else if (a === 'clear') { mClearPick(); setSync('syncTxtM', '🔗 연도 기둥이나 2D 곡선 점을 누르면 그 해 대조·수익구조가 함께 잡힙니다'); }
    });
    $('btnResetSyncM').addEventListener('click', function (e) {
      mState.selYear = null; mState.pick = {}; mState.focusYears = null; if (SC.m) { SC.m.pin = null; SC.m.hot = null; CH.m.pin = null; CH.m.hot = null; }
      e.currentTarget.style.display = 'none'; setSync('syncTxtM', '🔗 연도 기둥이나 2D 곡선 점을 누르면 그 해 대조·수익구조가 함께 잡힙니다'); refreshMultiAll(false);
    });
    wireDrop('dropTax', 'inpTaxFile', 'metaTaxFile', 'unitTax', 'tax', '세금계산서');
    wireDrop('dropFs', 'inpFsFile', 'metaFsFile', 'unitFs', 'fs', '재무제표');
    $('btnDlTemplateCsv').addEventListener('click', function () {
      var head = ['연도', 'ERP확정입금총액(원)', '세금계산서공급가액(원)', '재무제표결산매출액(원)', '인건비판관비(원)', '기말미수채권(원)', '인원(명)'];
      var ys = {}; (DS ? DS.years : []).forEach(function (r) { ys[r.y] = r; }); Object.keys(FILES).forEach(function (k) { if (!ys[k]) ys[k] = null; });
      var body = Object.keys(ys).map(Number).sort(function (a, b) { return a - b; }).map(function (y) {
        var r = ys[y], f = FILES[y] || {};
        return [y, r && finOk() ? r.gross : '', fin(f.tax) ? f.tax : '', fin(f.fs) ? f.fs : '', fin(f.cost) ? f.cost : '', fin(f.ar) ? f.ar : '', fin(f.head) ? f.head : ''];
      });
      download('데이터관리_다년_세금계산서_재무제표_양식.csv', [head].concat(body).map(function (r) { return r.map(csvCell).join(','); }).join('\n'));
      showToast('연도별 양식 CSV(원 단위)를 내려받았습니다 — ERP 칸은 참고용이고 다시 넣어도 읽지 않습니다.');
    });
    $('btnMultiCine').addEventListener('click', function () {
      if (multiCineTimer) { stopMultiCine(); showToast('다년 시네마 브리핑을 멈췄습니다.'); return; }
      if (!mState.rows.length) { showToast('보일 해가 없습니다.'); return; }
      var tab = document.querySelector('.side button[data-v="multi"]'); if (tab && !tab.classList.contains('on')) tab.click();
      $('btnMultiCine').textContent = '⏹ 전망 영상 정지'; ST.cine = true;
      var hud = $('hudM'), hTxt = $('hudMTxt'), hBar = $('hudMBar'); hud.classList.add('on');
      var idx = 0, L = mState.rows.length;
      function stepYear(i) {
        var r = mState.rows[i]; if (!r) return;
        applyMultiYearPick(r.y, 'y|' + r.y);
        if (CH.m.w > 100) { CH.m.scanX = 62 + ((CH.m.w - 110) / L) * (i + 0.5); CH.m.dirty = true; }
        hTxt.textContent = r.isFc ? (r.y + '년 시나리오(예측 아님) · 매출 ' + won(r.fs) + ' · 영업이익(가정) ' + won(r.opInc)) : (r.y + '년 대조 · ERP ' + won(r.erp) + ' / 세금계산서 ' + won(r.tax) + ' / 재무제표 ' + won(r.fs));
        hBar.style.width = Math.round(((i + 1) / L) * 100) + '%';
        if (!REDUCE) { SC.m.tYaw = -0.66 + (i / Math.max(1, L - 1)) * 0.56; SC.m.tPitch = 0.44 + Math.sin(i / Math.max(1, L - 1) * Math.PI) * 0.12; SC.m.tDist = r.isFc ? 32.5 : 35.2; }
      }
      stepYear(0);
      multiCineTimer = setInterval(function () {
        idx++;
        if (idx >= L) { stopMultiCine(); mState.selYear = null; SC.m.pin = null; CH.m.pin = null; SC.m.tYaw = -0.52; SC.m.tPitch = 0.50; SC.m.tDist = 35.2; refreshMultiAll(false); showToast('다년 결산·시나리오 브리핑을 마쳤습니다.'); return; }
        stepYear(idx);
      }, 980);
    });
  }

  /* ══ 18. 채팅 기기 — 이 컴퓨터 한 대 (계획서 5절)
     열쇠는 꺼낼 수 없는(extractable:false) ECDSA P-256 — 이 브라우저 IndexedDB 에 그대로 둔다.
     등록 요청은 화면에서, 승인은 이 PC 터미널(firebase 관리자 로그인)에서. datahub_device/{uid} 는 화면이 못 쓴다. ══ */
  var DEVICE = { server: null, local: null, reqFp: '', busy: false };
  var CHAT = { unlocked: false, lastAct: Date.now(), busy: false, msgs: [] };
  var IDB_NAME = 'pu-datahub', IDB_STORE = 'kv';
  function idbOpen() {
    return new Promise(function (res, rej) {
      try {
        if (!global.indexedDB) return rej(new Error('이 브라우저에는 IndexedDB 가 없습니다'));
        var r = global.indexedDB.open(IDB_NAME, 1);
        r.onupgradeneeded = function () { try { r.result.createObjectStore(IDB_STORE); } catch (e) {} };
        r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); };
      } catch (e) { rej(e); }
    });
  }
  function idbDo(mode, fn) {
    return idbOpen().then(function (db) {
      return new Promise(function (res, rej) {
        /* 쓰기·지우기는 «거래가 끝났을 때»(oncomplete) 끝난 것으로 본다 — 요청 성공만 보고 «지웠다»고 하면 아직 안 지워졌을 수 있다(보안 2차 재검증) */
        try {
          var tx = db.transaction(IDB_STORE, mode), st = tx.objectStore(IDB_STORE), q = fn(st), out;
          q.onsuccess = function () { out = q.result; if (mode === 'readonly') res(out); };
          q.onerror = function () { rej(q.error); };
          tx.oncomplete = function () { res(out); };
          tx.onerror = tx.onabort = function () { rej(tx.error || q.error || new Error('IndexedDB 거래 실패')); };
        }
        catch (e) { rej(e); }
      });
    });
  }
  function idbGet(k) { return idbDo('readonly', function (st) { return st.get(k); }).catch(function () { return null; }); }
  function idbPut(k, v) { return idbDo('readwrite', function (st) { return st.put(v, k); }); }
  /* 지우기 실패를 삼키지 않는다 — 부르는 쪽이 «못 지웠다»를 알려야 한다 */
  function idbDel(k) { return idbDo('readwrite', function (st) { return st.delete(k); }); }
  function devMatches(loc, srv) {
    if (!loc || !srv || typeof srv !== 'object') return false;
    if (srv.status && srv.status !== 'active') return false;
    if (srv.fp && loc.fp && String(srv.fp) === String(loc.fp)) return true;
    var sp = srv.pub || {};
    return !!(sp.x && loc.pub && sp.x === loc.pub.x && sp.y === loc.pub.y);
  }
  function deviceState() { if (devMatches(DEVICE.local, DEVICE.server)) return 'ok'; if (DEVICE.local) return 'pending'; return 'none'; }
  function deviceLabel() { var s = deviceState(); return s === 'ok' ? '이 컴퓨터 · 확인됨' : (s === 'pending' ? '승인 대기' : '등록 안 됨'); }
  function devName() {
    var ua = String(global.navigator && navigator.userAgent || ''), os = /Windows/.test(ua) ? 'Windows' : (/Mac OS X/.test(ua) && !/Mobile/.test(ua) ? 'Mac' : (/Android/.test(ua) ? 'Android' : (/iPhone|iPad/.test(ua) ? 'iOS' : 'Linux')));
    var br = /Edg\//.test(ua) ? 'Edge' : (/Chrome\//.test(ua) ? 'Chrome' : (/Firefox\//.test(ua) ? 'Firefox' : (/Safari\//.test(ua) ? 'Safari' : '브라우저')));
    return os + ' · ' + br;
  }
  function deviceRefresh(reread) {
    var uid = ME.uid; if (!uid) return;
    var p1 = idbGet('dev:' + uid).then(function (v) { DEVICE.local = (v && v.priv && v.pub) ? v : null; });
    var p2 = reread ? DB.ref('datahub_device/' + uid).once('value').then(function (s) { var v = s ? s.val() : null; DEVICE.server = (v && typeof v === 'object') ? v : null; SRC.dev = { ok: true }; }, function (e) { SRC.dev = { ok: false, why: why(e) }; }) : Promise.resolve();
    return Promise.all([p1, p2]).then(function () { if (uid === ME.uid) { renderDevice(); chatRefresh(); sideDash(); } });
  }
  function renderDevice() {
    var s = deviceState(), srv = DEVICE.server, loc = DEVICE.local;
    var lab = s === 'ok' ? '이 컴퓨터 · 확인됨' : (s === 'pending' ? '승인 대기 — 채팅 잠김' : '등록 안 됨 — 채팅은 등록된 컴퓨터에서만');
    $('topDevTx').textContent = ' ' + deviceLabel();
    $('topDev').className = 'tpill' + (s === 'ok' ? ' ok' : ' warn'); $('topDev').title = '채팅 기기: ' + lab;
    [$('chatDevBadge')].forEach(function (b) { if (!b) return; b.className = 'badge ' + (s === 'ok' ? 'b-ok' : (s === 'pending' ? 'b-warn' : 'b-nil')); b.textContent = '🖥 ' + deviceLabel(); b.title = lab; });
    $('devIco').textContent = s === 'ok' ? '✅' : (s === 'pending' ? '⏳' : '🖥');
    $('devTitle').textContent = s === 'ok' ? '이 컴퓨터가 채팅 기기로 확인됐습니다' : (s === 'pending' ? '이 PC 터미널 승인을 기다립니다' : '채팅은 등록된 컴퓨터에서만 열립니다');
    var msg;
    if (SRC.dev && !SRC.dev.ok) msg = '등록 상태를 읽지 못했습니다(' + SRC.dev.why + ') — 모르면 잠근 채로 둡니다.';
    else if (s === 'ok') msg = '등록 기기: ' + (str(srv.name) || '이 컴퓨터') + (srv.approvedAt ? ' · 승인 ' + fmtAt(srv.approvedAt) : '');
    else if (s === 'pending') msg = '지문 ' + (loc.fp || '—') + ' — 터미널에서 승인하면 «다시 확인»을 누르세요.' + (srv ? ' 지금 등록된 기기는 다른 기기입니다(승인하면 그 기기는 풀림).' : '');
    else msg = srv ? '지금 기기: 등록 안 됨 · 등록된 기기: ' + (str(srv.name) || '다른 기기') + (srv.approvedAt ? ' (' + fmtAt(srv.approvedAt).slice(0, 10) + ' 승인)' : '') : '지금 기기: 등록 안 됨 · 등록된 기기가 아직 없습니다.';
    $('devMsg').textContent = msg;
    $('btnDevReq').textContent = s === 'none' ? '이 컴퓨터를 채팅 기기로 등록 요청' : '열쇠 새로 만들어 다시 요청';
    var fp = loc ? loc.fp : '';
    $('devFpWrap').hidden = !fp; $('devFp').textContent = fp || '';
    $('devCmd').textContent = 'node scripts/datahub-device.js --approve ' + (fp || '<지문>') + ' --apply';
    $('st2').classList.toggle('done', !!loc); $('st3').classList.toggle('done', s === 'ok'); $('st4').classList.toggle('done', s === 'ok');
  }
  /* 서버 함수 부르기 — 데이터관리 전용 함수만(POST JSON + ID 토큰). 범용 AI 창구는 부르지 않는다 */
  function callFn(name, body) {
    var u = AUTH && AUTH.currentUser;
    if (!u) return Promise.resolve({ status: 401, ok: false, body: {} });
    return u.getIdToken().then(function (tok) {
      return global.fetch(FN_BASE + name, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tok }, body: JSON.stringify(body || {}) });
    }).then(function (r) {
      return r.text().then(function (t) { var j = null; try { j = JSON.parse(t); } catch (e) { j = null; } return { status: r.status, ok: r.ok && !(j && j.ok === false), body: (j && typeof j === 'object') ? j : {} }; });
    }, function (e) { return { status: 0, ok: false, body: {}, why: why(e) }; });
  }
  function fnErrText(res) {
    if (!res || typeof res !== 'object') return '알 수 없는 오류';
    if (res instanceof Error) return why(res);
    var b = res.body || {}, reason = str(b.error || b.reason || b.message).slice(0, 160);
    if (res.status === 0 || res.status === 404) return '채팅 서버 준비 전 — 서버 함수가 아직 올라가지 않았거나 네트워크가 끊겼습니다';
    if (res.status === 401 && b.reauth) return 'REAUTH';
    if (res.status === 401) return '로그인이 만료됐습니다 — 포털에서 다시 로그인하세요';
    if (res.status === 429 && b.overBudget) return '이번 달 AI 한도를 다 썼습니다';
    if (res.status === 429) return '요청이 너무 잦습니다 — 잠시 뒤 다시 하세요';
    if (res.status === 400 || res.status === 403) return '서버가 거절했습니다' + (reason ? ': ' + reason : '');
    return '채팅 서버 오류(' + res.status + ')' + (reason ? ': ' + reason : '');
  }
  function requestDevice() {
    if (DEVICE.busy || !ME.uid) return;
    var subtle = global.crypto && global.crypto.subtle;
    if (!subtle) { showToast('이 브라우저(주소)에서는 기기 열쇠를 만들 수 없습니다 — https 주소로 여세요.'); return; }
    DEVICE.busy = true; $('btnDevReq').disabled = true; $('devMsg').textContent = '이 브라우저 안에 꺼낼 수 없는 기기 열쇠를 만드는 중…';
    var pair = null, pub = null, uid = ME.uid;
    subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']).then(function (kp) {
      pair = kp; return subtle.exportKey('jwk', kp.publicKey);       /* 공개 반쪽만 꺼낸다 — 비밀 반쪽은 꺼낼 수 없게 만들었다 */
    }).then(function (jwk) {
      pub = { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y };
      return callFn('datahubDeviceRequest', { pub: pub, name: devName() });
    }).then(function (res) {
      if (!res.ok) throw res;
      var fp = str(res.body.fp); if (!fp) throw { status: 500, body: { error: '지문을 받지 못했습니다' } };
      return idbPut('dev:' + uid, { priv: pair.privateKey, pub: pub, fp: fp, at: Date.now() }).then(function () { DEVICE.local = { priv: pair.privateKey, pub: pub, fp: fp }; });
    }).then(function () {
      renderDevice(); chatRefresh(); showToast('등록 요청을 보냈습니다 — 이 PC 터미널에서 지문 ' + DEVICE.local.fp + ' 을 승인하세요.');
    }).catch(function (e) {
      var t = fnErrText(e); $('devMsg').textContent = '등록 요청을 못 했습니다 — ' + (t === 'REAUTH' ? '비밀번호를 다시 넣은 뒤 하세요' : t);
    }).then(function () { DEVICE.busy = false; $('btnDevReq').disabled = false; });
  }
  function forgetDevice() {
    if (!ME.uid) return;
    var ok = true; try { ok = global.confirm('이 브라우저에 둔 채팅 기기 열쇠와 채팅 기록을 지울까요?\n서버의 기기 등록은 이 PC 터미널(revoke)로 풉니다.'); } catch (e) { ok = true; }
    if (!ok) return;
    var uid = ME.uid;
    /* 지우는 사이·뒤에 도착하는 «진행 중이던 답»이 기록을 다시 쓰지 않게 차수를 올린다 */
    CHAT.epoch = (CHAT.epoch || 0) + 1; CHAT.msgs = []; CHAT.unlocked = false; $('msgsAll').innerHTML = '';
    Promise.all([idbDel('dev:' + uid), idbDel('chat:' + uid)]).then(function () {
      DEVICE.local = null; renderDevice(); chatRefresh(); sideDash(); showToast('이 브라우저의 기기 열쇠와 채팅 기록을 지웠습니다.');
    }, function (e) {
      chatRefresh(); showToast('지우지 못했습니다 — 브라우저 저장소를 확인해 주세요(' + why(e) + ')');
    });
  }

  /* ══ 19. 채팅 — 질문마다 서명 · 가명 숫자만 · 기록은 이 브라우저에만 ══ */
  function utf8(s) { return new TextEncoder().encode(s); }
  function hex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }
  function sha256hex(s) { return global.crypto.subtle.digest('SHA-256', utf8(s)).then(hex); }
  function b64url(buf) { var s = '', u = new Uint8Array(buf); for (var i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return global.btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function whyLine() {
    if (!DS) return '';
    return '근거: 재무관리 확정 입금·업무관리 주간기록 · ' + DS.months[0] + '~' + DS.months[DS.months.length - 1] + ' · ' + (BASIS === 'accrual' ? '귀속월' : '입금일') + ' 기준' + (NET ? '·순액' : '') + ' · 되돌림·휴지통·성과조정·과거기록·개인수익 제외';
  }
  /* storeText — 이 브라우저 기록에 남길 글. 실명이 든 화면 글(text)은 남기지 않고 가명 글만 남긴다(보안 검토 2026-11-21 «중간»).
     storeText 가 없으면 남기지 않는다 — 실명 글이 실수로 기록되는 길을 막는다 */
  function addMsg(who, text, whyTxt, keep, storeText) {
    var box = $('msgsAll'), d = document.createElement('div');
    d.className = 'msg ' + who; d.textContent = text;
    if (whyTxt) { var w = document.createElement('span'); w.className = 'why'; w.textContent = whyTxt; d.appendChild(w); }
    box.appendChild(d); box.scrollTop = box.scrollHeight;
    if (keep !== false && who !== 'sys' && typeof storeText === 'string') { CHAT.msgs.push({ who: who, text: storeText, why: whyTxt || '', at: Date.now() }); saveChat(); }
  }
  function saveChat() {
    if (!ME.uid) return;
    var cut = Date.now() - 30 * 864e5;
    CHAT.msgs = CHAT.msgs.filter(function (m) { return m.at >= cut; }).slice(-200);
    idbPut('chat:' + ME.uid, CHAT.msgs).catch(function () {});
  }
  function loadChat() {
    var uid = ME.uid; if (!uid) return;
    idbGet('chat:' + uid).then(function (v) {
      if (uid !== ME.uid || !CHAT.unlocked) return;
      var cut = Date.now() - 30 * 864e5;
      CHAT.msgs = (Array.isArray(v) ? v : []).filter(function (m) { return m && m.at >= cut; });
      $('msgsAll').innerHTML = '';
      /* 지난 기록은 가명 그대로 보인다 — 가명 차례는 달마다 바뀔 수 있어 지금 표로 되돌리면 다른 사람 이름이 붙을 수 있다 */
      if (CHAT.msgs.length) addMsg('sys', '지난 대화는 가명(P1·C-01)으로 보입니다 — 이 컴퓨터에는 실명 없이 가명 글만 남깁니다.', '', false);
      CHAT.msgs.forEach(function (m) { addMsg(m.who === 'me' ? 'me' : 'ai', str(m.text), str(m.why), false); });
      if (!CHAT.msgs.length) addMsg('sys', '무엇이든 물어보세요 — 예: «지난달 입금이 왜 줄었어?», «최근 4주 업무 기록이 많은 사람은?» 판단(과부하 여부 등)은 대표 몫입니다.', '', false);
    });
  }
  function chatForget(uid) { CHAT.epoch = (CHAT.epoch || 0) + 1; if (uid) idbDel('chat:' + uid).catch(function () {}); CHAT.msgs = []; CHAT.unlocked = false; var b = $('msgsAll'); if (b) b.innerHTML = ''; }
  function chatHide() { CHAT.unlocked = false; CHAT.busy = false; var b = $('msgsAll'); if (b) b.innerHTML = ''; chatRefresh(); }
  function chatRefresh() {
    var cover = $('chatCover'); if (!cover) return;
    var s = deviceState(), form = $('reauthForm1'), go = $('ccGoLock');
    var inp = $('askAll'), btn = $('sendAll');
    var open = (s === 'ok' && CHAT.unlocked && !!DS);
    cover.hidden = open;
    inp.disabled = !open || CHAT.busy; btn.disabled = !open || CHAT.busy;
    form.hidden = !(s === 'ok' && !CHAT.unlocked); go.hidden = s === 'ok';
    if (s !== 'ok') {
      $('ccIco').textContent = '🖥'; $('ccTitle').textContent = '채팅은 등록된 컴퓨터에서만';
      $('ccMsg').textContent = s === 'pending' ? '이 컴퓨터는 등록 요청을 보냈고 이 PC 터미널 승인을 기다립니다(지문 ' + (DEVICE.local ? DEVICE.local.fp : '—') + ').' : '이 기기는 등록 기기가 아닙니다 — 대표 사무실 PC 에서 «잠금·채팅» 화면의 등록 요청 → 터미널 승인을 한 번 거치면 열립니다.';
    } else if (!CHAT.unlocked) {
      $('ccIco').textContent = '⏸'; $('ccTitle').textContent = '채팅이 잠겨 있습니다';
      $('ccMsg').textContent = '앱을 새로 열었거나 15분 동안 손대지 않아 가렸습니다 — 대표 비밀번호를 다시 넣으면 열립니다(비밀번호는 어디에도 남기지 않습니다).';
    }
    $('idleIco').textContent = s !== 'ok' ? '🖥' : (CHAT.unlocked ? '🔓' : '⏸');
    $('idleTitle').textContent = s !== 'ok' ? '기기 등록 뒤에 엽니다' : (CHAT.unlocked ? '채팅이 열려 있습니다' : '채팅이 잠겨 있습니다');
    $('idleMsg').textContent = s !== 'ok' ? '이 컴퓨터가 채팅 기기로 확인되면 대표 비밀번호를 다시 넣어 채팅을 엽니다.' : (CHAT.unlocked ? '15분 동안 손대지 않으면 다시 가립니다.' : '15분 동안 손대지 않으면 채팅을 가립니다. 앱을 새로 열었을 때도 가린 채로 시작합니다.');
    $('reauthForm2').hidden = CHAT.unlocked || s !== 'ok';
  }
  /* 비밀번호 다시 넣기 — 칸의 값은 읽자마자 비우고, 파이어베이스 재인증에만 넘긴다(어디에도 저장하지 않는다) */
  function reauth(pwId, errId) {
    var el = $(pwId), err = $(errId), pw = el.value;
    el.value = '';
    if (!pw) { err.textContent = '비밀번호를 넣어 주세요'; return; }
    var u = AUTH && AUTH.currentUser;
    if (!u || !u.email) { err.textContent = '로그인 정보를 찾지 못했습니다 — 포털에서 다시 로그인하세요'; return; }
    err.textContent = '확인 중…';
    var cred = FB.auth.EmailAuthProvider.credential(u.email, pw);
    pw = '';
    u.reauthenticateWithCredential(cred).then(function () { return u.getIdToken(true); }).then(function () {
      err.textContent = ''; CHAT.unlocked = true; CHAT.lastAct = Date.now(); chatRefresh(); loadChat(); sideDash();
      showToast('채팅을 열었습니다 — 15분 동안 손대지 않으면 다시 잠깁니다.');
    }).catch(function (e) {
      var c = String(e && e.code || '');
      err.textContent = /wrong-password|invalid-credential|invalid-login/.test(c) ? '비밀번호가 맞지 않습니다' : (/too-many/.test(c) ? '시도가 너무 많습니다 — 잠시 뒤 다시 하세요' : '다시 확인하지 못했습니다(' + why(e) + ')');
    });
  }
  function setBusy(b) { CHAT.busy = b; var btn = $('sendAll'); btn.textContent = b ? '묻는 중…' : '보내기'; if (b) btn.setAttribute('aria-busy', 'true'); else btn.removeAttribute('aria-busy'); chatRefresh(); }
  function sendAsk() {
    var inp = $('askAll'), q = str(inp.value);
    if (!q || CHAT.busy) return;
    if (!DS || deviceState() !== 'ok' || !CHAT.unlocked || !DEVICE.local) { chatRefresh(); return; }
    CHAT.lastAct = Date.now();
    var ps = C.pseudonymize(DS), back = ps.back;
    var ctxJson = JSON.stringify(ps.ctx);                 /* 서버로 가는 것은 가명 숫자뿐 — back(실명표)은 보내지 않는다 */
    /* 질문의 실명·업체명은 «모든» 사람·업체 가명표(fwd)로 바꿔 보낸다. 기록에도 가명 글만 남긴다(보안 검토 2026-11-21) */
    var qSend = C.maskText(q, ps), nonce = '', ts = 0, priv = DEVICE.local.priv;
    /* 질문은 화면에만 먼저 — 서버가 받아 답한 뒤에만 기록한다(거절된 질문은 남기지 않는다, 보안 재검토 2026-11-21) */
    addMsg('me', q, '', false); inp.value = ''; setBusy(true);
    var askedAt = Date.now(), epoch = CHAT.epoch || 0;
    callFn('datahubChallenge', {}).then(function (res) {
      if (!res.ok) throw res;
      nonce = str(res.body.nonce); if (!nonce) throw { status: 500, body: { error: '일회용 문제를 받지 못했습니다' } };
      ts = Date.now();
      return Promise.all([sha256hex(qSend), sha256hex(ctxJson)]);
    }).then(function (h) {
      var text = 'datahub-ask\n' + nonce + '\n' + ts + '\n' + h[0] + '\n' + h[1];
      return global.crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, priv, utf8(text));
    }).then(function (sig) {
      return callFn('datahubAsk', { nonce: nonce, ts: ts, q: qSend, ctxJson: ctxJson, sig: b64url(sig) });
    }).then(function (res) {
      if (!res.ok) throw res;
      /* 서버가 개인정보 검사를 지나 답한 것만 남긴다 — 질문은 가명 글(qSend), 답은 가명 그대로(raw) */
      var raw = str(res.body.answer) || '(빈 답)';
      /* 그 사이 기록을 지웠거나(차수가 바뀜) 채팅이 잠겼으면 이 답은 버린다 — 지운 기록이 되살아나지 않게 */
      if ((CHAT.epoch || 0) !== epoch || !CHAT.unlocked) return;
      CHAT.msgs.push({ who: 'me', text: qSend, why: '', at: askedAt });
      addMsg('ai', C.unalias(raw, back), whyLine(), true, raw);
    }).catch(function (e) {
      var t = fnErrText(e);
      if (t === 'REAUTH') { CHAT.unlocked = false; chatRefresh(); addMsg('sys', '서버가 비밀번호를 다시 확인하라고 합니다 — 위 칸에 넣고 다시 물어 주세요.', '', false); }
      else addMsg('sys', t, '', false);
    }).then(function () { setBusy(false); });
  }
  function bindChat() {
    $('sendAll').addEventListener('click', sendAsk);
    $('askAll').addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); sendAsk(); } });
    $('reauthForm1').addEventListener('submit', function (e) { e.preventDefault(); reauth('reauthPw1', 'reauthErr1'); });
    $('reauthForm2').addEventListener('submit', function (e) { e.preventDefault(); reauth('reauthPw2', 'reauthErr2'); });
    $('btnDevReq').addEventListener('click', requestDevice);
    $('btnDevCheck').addEventListener('click', function () { deviceRefresh(true).then(function () { showToast('기기 등록 상태: ' + deviceLabel()); }); });
    $('btnDevForget').addEventListener('click', forgetDevice);
    ['pointerdown', 'keydown'].forEach(function (ev) { document.addEventListener(ev, function () { CHAT.lastAct = Date.now(); }, { passive: true }); });
    /* 15분 손대지 않으면 채팅을 가린다 — 화면 쪽 잠금(서버도 따로 막는다) */
    setInterval(function () {
      if (CHAT.unlocked && Date.now() - CHAT.lastAct > IDLE_MS) {
        CHAT.unlocked = false; $('msgsAll').innerHTML = ''; chatRefresh(); sideDash();
        showToast('15분 동안 손대지 않아 채팅을 가렸습니다.');
      }
    }, 30000);
  }

  global.PuDatahubView = { boot: boot, closeModal: closeModal };

})(typeof window !== 'undefined' ? window : this);
