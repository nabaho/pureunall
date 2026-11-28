/* ══════════════════════════════════════════════════════════════════════════
 * 🔄 푸른통합시스템 — 업무 오케스트레이션 화면 컨트롤러
 *    (pu-orchestrator.html 전용 window.PuOrchestratorView)
 *
 * 맡는 일:
 *   1. 통합 로그인 검증(uid_roles active + sid, 닫는 쪽 실패 원칙, PuGate 연동) 및 권한별 읽기 범위 분리
 *   2. 20여 개 앱의 경량 원장·대기열을 읽기 전용(once)으로 병렬 수집(원본 수정·삭제 0건)
 *   3. 4대 탭 지휘 화면 렌더링 (키보드 탭 이동 · 포커스 보존 · 대용량 페이지 분할):
 *      - ⚡ 실행 바통 대기열 (☐ 고르기 + № 순번 + 단계/긴급도/내 담당 필터 + 일괄 확인·보류 + 원클릭 바통 점프)
 *      - 🏢 사업장 360° 흐름판 (☐ 고르기 + № 순번 + 5단계 신호등 + 우측 상세 연결 서랍)
 *      - 🗺️ 전 프로그램 연결망 · 표준 런북 8선 (단계별 체크리스트 + 즉시 이동)
 *      - 🔗 연결 무결성 진단 (companyId 보류 · 담당 사번 누락 읽기 전용 점검)
 *   4. 앱 이동 시 바통(localStorage + sessionStorage · uidTag 바인딩) 적재 및 PuAppBar.goApp 창 재사용 연동
 * ══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  var Core = function () { return global.PuOrchestratorCore; };

  var fbDb = null;
  var SESSION_EPOCH = 0;
  var LOADING = false;
  var EVENTS_BOUND = false;
  var ME = { uid: '', sid: '', name: '', role: 'staff', isAdmin: false, isSubAdmin: false, perms: {} };

  var RAW = {};
  var COVERAGE = {};
  var REPORT = null;

  var TAB_ORDER = ['batons', 'companies', 'runbooks', 'diag'];
  var TAB = 'batons';
  var PAGE_STEP = 100;
  var PAGE_LIMIT = { batons: 100, companies: 100, diag: 100 };

  var FILTER = {
    stage: '',
    severity: '',
    app: '',
    q: '',
    mineOnly: false,
    showDone: false,
    coQ: '',
    coStage: '',
    coOnlyPending: false,
    coMineOnly: false
  };

  var hasOwn = Object.prototype.hasOwnProperty;
  var SEL = Object.create(null); // 현재 탭 선택된 행 ID 맵 (탭·필터 전환 시 비움)
  var LAST_UID = '';
  var DETAIL_KEY = ''; // 우측 상세 서랍에 열린 바통/사업장 키
  var DRAWER_WAS_OPEN = false;
  var LAST_DRAWER_TRIGGER = null; // { act, id }
  var RUNBOOK_CHECKS = Object.create(null); // 런북 체크 표시(로컬)

  function $(id) { return document.getElementById(id); }
  function str(v) { return v == null ? '' : String(v).trim(); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function syncHeadHeight() {
    try {
      var hd = $('head');
      if (!hd || !document.documentElement) return;
      var h = Math.max(72, Math.ceil(hd.getBoundingClientRect().height || 94));
      document.documentElement.style.setProperty('--head-h', h + 'px');
    } catch (_) {}
  }

  function storageKey() {
    return 'pu_orch_local_' + (ME.uid || 'anon');
  }

  function clearSharedBaton() {
    var k = (Core() && Core().BATON_STORAGE_KEY) || 'pu_orch_baton_v1';
    try { if (global.localStorage) global.localStorage.removeItem(k); } catch (_) {}
    try { if (global.sessionStorage) global.sessionStorage.removeItem(k); } catch (_) {}
  }

  function readLocalState() {
    try {
      var raw = global.localStorage ? global.localStorage.getItem(storageKey()) : null;
      var parsed = raw ? JSON.parse(raw) : {};
      if (!parsed || typeof parsed !== 'object') parsed = {};
      return {
        checked: (parsed.checked && typeof parsed.checked === 'object') ? parsed.checked : {},
        snoozedUntil: (parsed.snoozedUntil && typeof parsed.snoozedUntil === 'object') ? parsed.snoozedUntil : {},
        notes: (parsed.notes && typeof parsed.notes === 'object') ? parsed.notes : {},
        runbooks: (parsed.runbooks && typeof parsed.runbooks === 'object') ? parsed.runbooks : {}
      };
    } catch (_) {
      return { checked: {}, snoozedUntil: {}, notes: {}, runbooks: {} };
    }
  }

  function writeLocalState(st) {
    try {
      if (global.localStorage) global.localStorage.setItem(storageKey(), JSON.stringify(st || {}));
    } catch (_) {}
  }

  function showToast(msg) {
    var el = $('toast');
    if (!el) return;
    el.textContent = str(msg);
    el.style.display = 'block';
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.style.display = 'none'; }, 2600);
  }

  function applyUrlParams() {
    try {
      var sp = new URLSearchParams((global.location && global.location.search) || '');
      var stg = str(sp.get('stage'));
      var tb = str(sp.get('tab'));
      var mine = str(sp.get('mine'));
      if (stg && /^(intake|case_rules|consulting_fund|work_payroll|finance_settle)$/.test(stg)) {
        FILTER.stage = stg;
      }
      if (tb && /^(batons|companies|runbooks|diag)$/.test(tb)) {
        TAB = tb;
      }
      if (mine === '1') FILTER.mineOnly = true;
    } catch (_) {}
  }

  function resetPageLimits() {
    PAGE_LIMIT.batons = PAGE_STEP;
    PAGE_LIMIT.companies = PAGE_STEP;
    PAGE_LIMIT.diag = PAGE_STEP;
  }

  function clearSelection() {
    SEL = Object.create(null);
  }

  function wipeRenderedContainers() {
    RAW = {};
    COVERAGE = {};
    REPORT = null;
    ME = { uid: '', sid: '', name: '', role: 'staff', isAdmin: false, isSubAdmin: false, perms: {} };
    FILTER.q = '';
    FILTER.coQ = '';
    if ($('app')) $('app').style.display = 'none';
    ['nBatons', 'nCompanies', 'nDiag'].forEach(function (id) {
      var el = $(id);
      if (el) el.textContent = '0';
    });
    ['fltQ', 'fltCoQ'].forEach(function (id) {
      var el = $(id);
      if (el) el.value = '';
    });
    ['stagePipeline', 'batonTableBox', 'companyTableBox', 'runbooksBox', 'diagBox', 'detailBody'].forEach(function (id) {
      var el = $(id);
      if (el) el.innerHTML = '';
    });
    ['batonBulkBar', 'coBulkBar', 'loadNote'].forEach(function (id) {
      var el = $(id);
      if (el) { el.hidden = true; el.innerHTML = ''; }
    });
    var dr = $('detailDrawer');
    if (dr) dr.classList.remove('on');
    if (document.body && document.body.classList) document.body.classList.remove('with-drawer');
  }

  function isMobileViewport() {
    try {
      return (global.innerWidth || 1280) <= 768 || /Android|iPhone|iPad|iPod/i.test((global.navigator && global.navigator.userAgent) || '');
    } catch (_) {
      return false;
    }
  }

  /* ── 앱 점프 & 바통 적재 (창 재사용 · _blank 사용 금지) ── */
  function dispatchToApp(appKey, rawTargetUrl, batonInfo) {
    var C = Core();
    if (!C) return;
    var safeUrl = C.safeRelUrl(rawTargetUrl, (C.APP_META[appKey] && C.APP_META[appKey].url) || 'enter.html');
    if (batonInfo) {
      var packed = C.packBaton(Object.assign({}, batonInfo, {
        uid: ME.uid,
        toApp: appKey,
        returnUrl: 'pu-orchestrator.html?tab=' + encodeURIComponent(TAB) + (FILTER.stage ? '&stage=' + encodeURIComponent(FILTER.stage) : '')
      }), Date.now());
      var json = JSON.stringify(packed);
      try { if (global.localStorage) global.localStorage.setItem(C.BATON_STORAGE_KEY, json); } catch (_) {}
      try { if (global.sessionStorage) global.sessionStorage.setItem(C.BATON_STORAGE_KEY, json); } catch (_) {}
    }

    var hashIdx = safeUrl.indexOf('#');
    var hashPart = hashIdx >= 0 ? safeUrl.slice(hashIdx) : '';
    var beforeHash = hashIdx >= 0 ? safeUrl.slice(0, hashIdx) : safeUrl;
    var bucket = Math.floor(Date.now() / 600000);
    var sep = beforeHash.indexOf('?') >= 0 ? '&' : '?';
    var fullUrl = beforeHash + sep + 'sso=1&orchBaton=1&v=' + bucket + hashPart;

    if (isMobileViewport()) {
      global.location.href = fullUrl;
      return;
    }
    if (global.PuAppBar && typeof global.PuAppBar.goApp === 'function') {
      global.PuAppBar.goApp(fullUrl);
      return;
    }
    if (global.PuAppBar && typeof global.PuAppBar.winNameOf === 'function') {
      var winName = global.PuAppBar.winNameOf(fullUrl);
      var w = global.open(fullUrl, winName);
      if (w && typeof w.focus === 'function') {
        try { w.focus(); } catch (_) {}
        return;
      }
    }
    global.location.href = fullUrl;
  }

  function setLoadingUi(busy) {
    LOADING = !!busy;
    var rb = $('refreshBtn');
    if (!rb) return;
    rb.disabled = LOADING;
    rb.textContent = LOADING ? '🔄 조회 중…' : '🔄 새로고침';
  }

  /* ── 읽기 전용 병렬 수집 (각 경로별 권한 분리 격리) ── */
  function readNodeOnce(key, path, allowed, optional) {
    if (!allowed) {
      COVERAGE[key] = 'perm_skip';
      return Promise.resolve(null);
    }
    if (!fbDb) {
      COVERAGE[key] = 'offline';
      return Promise.resolve(null);
    }
    return fbDb.ref(path).once('value').then(function (snap) {
      COVERAGE[key] = 'ready';
      return snap ? snap.val() : null;
    }).catch(function (err) {
      var code = String((err && (err.code || err.message)) || '');
      if (optional && /permission/i.test(code)) {
        COVERAGE[key] = 'perm_skip';
        return null;
      }
      COVERAGE[key] = 'denied';
      return null;
    });
  }

  /* ★ 온톨로지 READ_ADAPTERS 원칙 준수 — in_app 민감 본문(괴롭힘 진술·보고서 원고·재무 원장·서명 열쇠 등)은
     통합 지휘소로 내려받지 않고, 허용된 공용 원장·얇은 거울(ontIdx·erp_sync·counts)만 읽기 전용으로 수집한다. */
  function loadAllSources(epoch) {
    var C = Core();
    if (!C || LOADING) return Promise.resolve();
    setLoadingUi(true);
    COVERAGE = {};
    var canCareer = C.appCanAccess('career', ME);
    var isAdminOnly = ME.role === 'admin' || !!ME.isAdmin;

    var jobs = [
      ['companies',        'data/companies/v',             true],
      ['userDir',          'data/user_dir/v',              true],
      ['contracts',        'data/contracts/v',             true],
      ['contractRequests', 'data/contract_requests',       true],
      ['cases',            'data/cases/v',                 true],
      ['consultings',      'data/consultings/v',           true],
      ['funds',            'data/funds/v',                 true],
      ['workItems',        'work_erp/items',               true],
      ['quotes',           'pu_quotes',                    true],
      ['cardsOntIdx',      'pucards/ontIdx',               true],
      ['paydataArrivals',  'paydata/arrivals',             true],
      ['payrollInbox',     'payroll_os/inbox',             true],
      ['edulibInbox',      'edulib_inbox',                 isAdminOnly, true],
      ['datahubBoard',     'datahub_board',                isAdminOnly, true]
    ];

    if (canCareer && ME.uid) {
      jobs.push(['careerCounts', 'kcareer/' + ME.uid + '/counts', true]);
    }

    return Promise.all(jobs.map(function (j) {
      return readNodeOnce(j[0], j[1], j[2], !!j[3]).then(function (val) {
        return [j[0], val];
      });
    })).then(function (pairs) {
      setLoadingUi(false);
      if (epoch !== SESSION_EPOCH) return;
      var nextRaw = {};
      pairs.forEach(function (p) { nextRaw[p[0]] = p[1]; });
      RAW = nextRaw;
      recomputeAndRender();
    }).catch(function () {
      setLoadingUi(false);
    });
  }

  function recomputeAndRender() {
    var C = Core();
    if (!C) return;
    var loc = readLocalState();
    RUNBOOK_CHECKS = loc.runbooks || {};
    REPORT = C.analyzeWorkspace(RAW, {
      now: Date.now(),
      uid: ME.uid,
      sid: ME.sid,
      role: ME.role,
      isAdmin: ME.isAdmin,
      isSubAdmin: ME.isSubAdmin,
      perms: ME.perms,
      localState: loc
    });
    renderAll();
  }

  /* ── 화면 렌더링 ── */
  function sevChipHtml(sev) {
    if (sev === 'urgent') return '<span class="chip c-red">긴급</span>';
    if (sev === 'warn') return '<span class="chip c-amber">주의</span>';
    return '<span class="chip c-blue">연계</span>';
  }

  function stageDotHtml(level, label) {
    var cls = level === 'urgent' ? 'st-urg'
      : level === 'warn' ? 'st-warn'
      : level === 'done' ? 'st-done'
      : level === 'active' ? 'st-act' : 'st-idle';
    var txt = level === 'urgent' ? '긴급'
      : level === 'warn' ? '대기'
      : level === 'done' ? '완료'
      : level === 'active' ? '진행' : '—';
    return '<span class="stg-pill ' + cls + '" title="' + esc(label + ' · ' + txt) + '">' + esc(txt) + '</span>';
  }

  function renderLoadCoverageNote() {
    var box = $('loadNote');
    if (!box) return;
    var keys = Object.keys(COVERAGE);
    var failed = keys.filter(function (k) { return COVERAGE[k] === 'denied' || COVERAGE[k] === 'offline'; });
    if (!failed.length) {
      box.hidden = true;
      box.textContent = '';
      return;
    }
    box.hidden = false;
    box.textContent = '⚠ 일부 원본 경로(' + failed.length + '곳)를 현재 계정 권한 또는 네트워크 상태로 읽지 못해, 열람 가능한 범위의 흐름만 표시하고 있습니다.';
  }

  function renderTabsHeader() {
    if (!REPORT) return;
    var nB = $('nBatons');
    var nC = $('nCompanies');
    var nD = $('nDiag');
    if (nB) nB.textContent = String(REPORT.totals.activeBatons);
    if (nC) nC.textContent = String(REPORT.totals.companies);
    if (nD) nD.textContent = String(REPORT.totals.diagnostics);

    TAB_ORDER.forEach(function (t) {
      var btn = $('tab-' + t);
      var pane = $('p-' + t);
      var on = (TAB === t);
      if (btn) {
        btn.classList.toggle('on', on);
        btn.setAttribute('aria-selected', on ? 'true' : 'false');
        btn.tabIndex = on ? 0 : -1;
      }
      if (pane) pane.classList.toggle('on', on);
    });
  }

  function renderStagePipelineBar() {
    var box = $('stagePipeline');
    if (!box || !REPORT) return;
    var allActive = REPORT.totals.activeBatons;
    var allUrgent = REPORT.totals.urgentBatons;
    var allOn = !FILTER.stage;
    var cards = [
      '<button type="button" class="pipe-step' + (allOn ? ' on' : '') + '" aria-pressed="' + (allOn ? 'true' : 'false') + '" data-act="set-stage" data-stage="">' +
        '<div class="ps-top"><span class="ps-no">전체</span>' +
          (allUrgent ? '<span class="chip c-red">긴급 ' + allUrgent + '</span>' : '<span class="chip c-green">정상</span>') +
        '</div>' +
        '<b class="ps-cnt">' + allActive + '<span>건</span></b>' +
        '<span class="ps-lb">전 구간 활성 바통</span>' +
      '</button>'
    ];
    REPORT.stageSummary.forEach(function (st) {
      var on = FILTER.stage === st.id;
      cards.push(
        '<button type="button" class="pipe-step' + (on ? ' on' : '') + '" aria-pressed="' + (on ? 'true' : 'false') + '" data-act="set-stage" data-stage="' + esc(st.id) + '" title="' + esc(st.desc) + '">' +
          '<div class="ps-top"><span class="ps-no">' + esc(st.short) + '</span>' +
            (st.urgent ? '<span class="chip c-red">긴급 ' + st.urgent + '</span>'
              : (st.warn ? '<span class="chip c-amber">주의 ' + st.warn + '</span>' : '<span class="chip c-gray">0</span>')) +
          '</div>' +
          '<b class="ps-cnt">' + st.total + '<span>건</span></b>' +
          '<span class="ps-lb">' + esc(st.title.replace(/^[①②③④⑤]\s*/, '')) + '</span>' +
        '</button>'
      );
    });
    box.innerHTML = cards.join('');
  }

  function selectedKeysOf(visibleIds) {
    return visibleIds.filter(function (id) { return hasOwn.call(SEL, id) && !!SEL[id]; });
  }

  function renderBulkBar(hostId, visibleIds, mode) {
    var host = $(hostId);
    if (!host) return;
    var picked = selectedKeysOf(visibleIds);
    if (!picked.length) {
      host.hidden = true;
      host.innerHTML = '';
      return;
    }
    host.hidden = false;
    if (mode === 'batons') {
      host.innerHTML =
        '<b>☑ ' + picked.length + '건 선택됨</b>' +
        '<span class="hint">원본 앱 자료는 건드리지 않고 내 오케스트레이션 상태만 바꿉니다</span>' +
        '<span class="sp"></span>' +
        '<button type="button" class="sm pri" data-act="bulk-check">✓ 확인 완료 표시</button>' +
        '<button type="button" class="sm" data-act="bulk-snooze">⏸ 오늘 하루 보류</button>' +
        '<button type="button" class="sm" data-act="bulk-unmark">↩ 표시 해제</button>' +
        '<button type="button" class="sm" data-act="bulk-copy">📋 선택 바통 복사</button>' +
        '<button type="button" class="sm" data-act="clear-sel">선택 취소</button>';
    } else {
      host.innerHTML =
        '<b>☑ ' + picked.length + '개 사업장 선택됨</b>' +
        '<span class="sp"></span>' +
        '<button type="button" class="sm pri" data-act="bulk-copy-co">📋 사업장 진행요약 복사</button>' +
        '<button type="button" class="sm" data-act="clear-sel">선택 취소</button>';
    }
  }

  function renderBatonTab() {
    var C = Core();
    var box = $('batonTableBox');
    if (!box || !REPORT || !C) return;

    var appSel = $('fltApp');
    if (appSel && appSel.options.length <= 1) {
      Object.keys(C.APP_META).forEach(function (k) {
        var m = C.APP_META[k];
        if (m.off || m.aliasOf) return;
        var opt = document.createElement('option');
        opt.value = m.key;
        opt.textContent = m.icon + ' ' + m.name;
        appSel.appendChild(opt);
      });
    }
    if (appSel) appSel.value = FILTER.app;
    var sevSel = $('fltSev');
    if (sevSel) sevSel.value = FILTER.severity;
    var mineBtn = $('fltMineBtn');
    if (mineBtn) mineBtn.setAttribute('aria-pressed', FILTER.mineOnly ? 'true' : 'false');
    var doneBtn = $('fltDoneBtn');
    if (doneBtn) doneBtn.setAttribute('aria-pressed', FILTER.showDone ? 'true' : 'false');

    var allRows = C.filterBatons(REPORT.batons, FILTER);
    var limit = PAGE_LIMIT.batons || PAGE_STEP;
    var rows = allRows.slice(0, limit);
    var remain = Math.max(0, allRows.length - rows.length);
    var visIds = rows.map(function (r) { return r.id; });
    renderBulkBar('batonBulkBar', visIds, 'batons');

    if (!rows.length) {
      box.innerHTML =
        '<div class="empty">' +
          '<b>현재 조건에 대기 중인 업무 바통이 없습니다.</b>' +
          '<p>앱 간 이관 요청·기한 임박·미연결 건이 생기면 여기에 자동으로 올라옵니다.</p>' +
        '</div>';
      return;
    }

    var allChecked = visIds.length > 0 && visIds.every(function (id) { return !!SEL[id]; });
    var html = [
      '<div class="mob-sel-head">',
      '<label class="ck-hit"><input type="checkbox" aria-label="보이는 바통 전체 선택" data-act="toggle-all-batons"' + (allChecked ? ' checked' : '') + '></label>',
      '<span>전체 선택 (표시 ' + rows.length + '건 / 총 ' + allRows.length + '건)</span>',
      '</div>',
      '<div class="tbl-wrap"><table class="orch-tbl" aria-label="실행 바통 대기열">',
      '<thead><tr>',
      '<th scope="col" class="col-ck"><label class="ck-hit"><input type="checkbox" aria-label="보이는 바통 전체 선택" data-act="toggle-all-batons"' + (allChecked ? ' checked' : '') + '></label></th>',
      '<th scope="col" class="col-no">№</th>',
      '<th scope="col" class="col-sev">상태</th>',
      '<th scope="col" class="col-flow">앱 흐름 (출발 ➔ 도착)</th>',
      '<th scope="col" class="col-co">사업장 · 연결열쇠</th>',
      '<th scope="col" class="col-tt">이어질 업무 내용</th>',
      '<th scope="col" class="col-own">담당</th>',
      '<th scope="col" class="col-due">기한·경과</th>',
      '<th scope="col" class="col-go">실행</th>',
      '</tr></thead><tbody>'
    ];

    rows.forEach(function (b, idx) {
      var no = idx + 1;
      var sel = !!SEL[b.id];
      var isCur = DETAIL_KEY === ('baton:' + b.id);
      var confBadge = b.linkConfidence === 'confirmed'
        ? (b.puLabel ? '<span class="tag-key">' + esc(b.puLabel) + '</span>' : '<span class="tag-key">ID확정</span>')
        : (b.linkConfidence === 'candidate' ? '<span class="tag-guess" title="상호명만 일치하는 추정 후보 — 원본 앱에서 사업자번호 확인 필요">이름추정</span>' : '');
      var timeInfo = b.ddayLabel
        ? '<span class="due-tx' + (b.severity === 'urgent' ? ' urg' : '') + '">' + esc(b.ddayLabel) + '</span>'
        : (b.ageDays != null && b.ageDays > 0 ? '<span class="mute-tx">' + b.ageDays + '일 경과</span>' : '<span class="mute-tx">실시간</span>');
      var doneTag = b.checked ? '<span class="chip c-green">확인됨</span> ' : (b.snoozed ? '<span class="chip c-gray">보류중</span> ' : '');

      html.push(
        '<tr class="orch-row' + (sel ? ' is-sel' : '') + (isCur ? ' is-cur' : '') + '" data-baton-id="' + esc(b.id) + '">',
        '<td class="col-ck"><label class="ck-hit"><input type="checkbox" aria-label="' + no + '번 바통 선택" data-act="sel-row" data-id="' + esc(b.id) + '"' + (sel ? ' checked' : '') + '></label></td>',
        '<td class="col-no">' + no + '</td>',
        '<td class="col-sev">' + sevChipHtml(b.severity) + '</td>',
        '<td class="col-flow" title="' + esc(b.fromName + ' ➔ ' + b.toName) + '">' +
          '<span class="flow-inline"><span>' + esc(b.fromIcon + ' ' + b.fromName) + '</span><span class="f-arr">➔</span><b>' + esc(b.toIcon + ' ' + b.toName) + '</b></span>' +
        '</td>',
        '<td class="col-co" title="' + esc(b.companyLabel + (b.puLabel ? ' (' + b.puLabel + ')' : '')) + '">' +
          '<button type="button" class="lnk-btn" data-act="inspect-baton" data-id="' + esc(b.id) + '">' +
            '<span class="cell-flex"><b>' + esc(b.companyLabel) + '</b>' + confBadge + '</span>' +
          '</button>' +
        '</td>',
        '<td class="col-tt" title="' + esc(b.title + ' — ' + b.reason) + '">' +
          '<button type="button" class="lnk-btn" data-act="inspect-baton" data-id="' + esc(b.id) + '">' +
            '<span class="cell-flex">' + doneTag + '<span>' + esc(b.title) + '</span></span>' +
          '</button>' +
        '</td>',
        '<td class="col-own" title="' + esc(b.ownerName) + '">' + esc(b.ownerName) + '</td>',
        '<td class="col-due">' + timeInfo + '</td>',
        '<td class="col-go">' +
          '<button type="button" class="sm pri go-btn" data-act="jump-baton" data-id="' + esc(b.id) + '" title="' + esc(b.toName + ' 화면으로 바통을 들고 이동합니다') + '">' +
            esc(b.actionLabel) + ' ➔' +
          '</button>' +
        '</td>',
        '</tr>'
      );
    });

    html.push('</tbody></table></div>');
    if (remain > 0) {
      html.push('<div class="more-box"><button type="button" class="sm" data-act="more-rows" data-kind="batons">+ 더 보기 (남은 ' + remain + '건)</button></div>');
    }
    box.innerHTML = html.join('');
  }

  function renderCompaniesTab() {
    var C = Core();
    var box = $('companyTableBox');
    if (!box || !REPORT || !C) return;

    var allFlows = C.filterCompanyFlows(REPORT.companyFlows, {
      q: FILTER.coQ,
      stage: FILTER.coStage,
      onlyPending: FILTER.coOnlyPending,
      mineSid: FILTER.coMineOnly ? ME.sid : ''
    });
    var limit = PAGE_LIMIT.companies || PAGE_STEP;
    var flows = allFlows.slice(0, limit);
    var remain = Math.max(0, allFlows.length - flows.length);

    var visIds = flows.map(function (f) { return f.key; });
    renderBulkBar('coBulkBar', visIds, 'companies');

    var coPendingBtn = $('coPendingBtn');
    if (coPendingBtn) coPendingBtn.setAttribute('aria-pressed', FILTER.coOnlyPending ? 'true' : 'false');
    var coMineBtn = $('coMineBtn');
    if (coMineBtn) coMineBtn.setAttribute('aria-pressed', FILTER.coMineOnly ? 'true' : 'false');

    if (!flows.length) {
      box.innerHTML = '<div class="empty"><b>조건에 맞는 사업장 흐름이 없습니다.</b></div>';
      return;
    }

    var allChecked = visIds.length > 0 && visIds.every(function (id) { return !!SEL[id]; });
    var html = [
      '<div class="mob-sel-head">',
      '<label class="ck-hit"><input type="checkbox" aria-label="보이는 사업장 전체 선택" data-act="toggle-all-cos"' + (allChecked ? ' checked' : '') + '></label>',
      '<span>전체 선택 (표시 ' + flows.length + '곳 / 총 ' + allFlows.length + '곳)</span>',
      '</div>',
      '<div class="tbl-wrap"><table class="orch-tbl" aria-label="사업장 360도 생애주기 흐름판">',
      '<thead><tr>',
      '<th scope="col" class="col-ck"><label class="ck-hit"><input type="checkbox" aria-label="보이는 사업장 전체 선택" data-act="toggle-all-cos"' + (allChecked ? ' checked' : '') + '></label></th>',
      '<th scope="col" class="col-no">№</th>',
      '<th scope="col" class="col-co">사업장 · 고유번호</th>',
      '<th scope="col" class="col-own">주담당</th>',
      '<th scope="col" class="col-stg">① 유입·계약</th>',
      '<th scope="col" class="col-stg">② 사건·규정</th>',
      '<th scope="col" class="col-stg">③ 컨설팅·기금</th>',
      '<th scope="col" class="col-stg">④ 업무·급여</th>',
      '<th scope="col" class="col-stg">⑤ 입금·정산</th>',
      '<th scope="col" class="col-tt">다음 바통</th>',
      '<th scope="col" class="col-go">원장/이동</th>',
      '</tr></thead><tbody>'
    ];

    flows.forEach(function (c, idx) {
      var no = idx + 1;
      var sel = !!SEL[c.key];
      var isCur = DETAIL_KEY === ('co:' + c.key);
      var topText = c.topBaton
        ? (c.topBaton.toIcon + ' ' + c.topBaton.title)
        : '대기 바통 없음 (원장 정상)';

      html.push(
        '<tr class="orch-row' + (sel ? ' is-sel' : '') + (isCur ? ' is-cur' : '') + '" data-co-key="' + esc(c.key) + '">',
        '<td class="col-ck"><label class="ck-hit"><input type="checkbox" aria-label="' + no + '번 사업장 선택" data-act="sel-row" data-id="' + esc(c.key) + '"' + (sel ? ' checked' : '') + '></label></td>',
        '<td class="col-no">' + no + '</td>',
        '<td class="col-co" title="' + esc(c.name + (c.puLabel ? ' · ' + c.puLabel : '')) + '">' +
          '<button type="button" class="lnk-btn" data-act="inspect-co" data-id="' + esc(c.key) + '">' +
            '<span class="cell-flex"><b>' + esc(c.name) + '</b>' + (c.puLabel ? '<span class="tag-key">' + esc(c.puLabel) + '</span>' : '') + '</span>' +
          '</button>' +
        '</td>',
        '<td class="col-own">' + esc(c.managerName) + '</td>',
        '<td class="col-stg">' + stageDotHtml(c.stages.intake, '① 유입·계약') + '</td>',
        '<td class="col-stg">' + stageDotHtml(c.stages.case_rules, '② 사건·규정') + '</td>',
        '<td class="col-stg">' + stageDotHtml(c.stages.consulting_fund, '③ 컨설팅·기금') + '</td>',
        '<td class="col-stg">' + stageDotHtml(c.stages.work_payroll, '④ 업무·급여') + '</td>',
        '<td class="col-stg">' + stageDotHtml(c.stages.finance_settle, '⑤ 입금·정산') + '</td>',
        '<td class="col-tt" title="' + esc(topText) + '">' +
          '<button type="button" class="lnk-btn" data-act="inspect-co" data-id="' + esc(c.key) + '">' +
            '<span class="cell-flex"><span>' + esc(topText) + '</span></span>' +
          '</button>' +
        '</td>',
        '<td class="col-go">' +
          (c.topBaton
            ? '<button type="button" class="sm pri go-btn" data-act="jump-baton" data-id="' + esc(c.topBaton.id) + '">' + esc(c.topBaton.toName) + ' ➔</button>'
            : '<button type="button" class="sm go-btn" data-act="jump-app" data-app="work" data-url="work.html">업무관리 ➔</button>') +
        '</td>',
        '</tr>'
      );
    });

    html.push('</tbody></table></div>');
    if (remain > 0) {
      html.push('<div class="more-box"><button type="button" class="sm" data-act="more-rows" data-kind="companies">+ 더 보기 (남은 ' + remain + '곳)</button></div>');
    }
    box.innerHTML = html.join('');
  }

  function renderRunbooksTab() {
    var C = Core();
    var box = $('runbooksBox');
    if (!box || !C) return;

    var rbCards = C.WORKFLOW_RUNBOOKS.map(function (rb) {
      var stepsHtml = rb.chain.map(function (step, i) {
        var meta = C.APP_META[step.app] || { icon: '📌', name: step.app };
        var ckId = rb.id + ':' + i;
        var done = !!RUNBOOK_CHECKS[ckId];
        var canGo = C.appCanAccess(step.app, ME);
        return (
          '<div class="rb-step' + (done ? ' done' : '') + '">' +
            '<label class="ck-hit"><input type="checkbox" aria-label="' + esc(step.label) + ' 단계 체크" data-act="toggle-rb-step" data-ck="' + esc(ckId) + '"' + (done ? ' checked' : '') + '></label>' +
            '<span class="rb-no">' + (i + 1) + '</span>' +
            '<span class="rb-tx"><b>' + esc(meta.icon + ' ' + meta.name) + '</b><small>' + esc(step.label) + '</small></span>' +
            (canGo
              ? '<button type="button" class="sm" data-act="jump-app" data-app="' + esc(step.app) + '" data-url="' + esc(step.url) + '" data-rb="' + esc(rb.title + ' · ' + step.label) + '">열기 ➔</button>'
              : '<span class="chip c-gray">권한분리</span>') +
          '</div>'
        );
      }).join('');

      return (
        '<article class="card rb-card">' +
          '<div class="rb-hd">' +
            '<b>🧭 ' + esc(rb.title) + '</b>' +
            '<button type="button" class="sm" data-act="reset-rb" data-rb-id="' + esc(rb.id) + '">초기화</button>' +
          '</div>' +
          '<p class="rb-desc">' + esc(rb.summary) + '</p>' +
          '<div class="rb-chain">' + stepsHtml + '</div>' +
        '</article>'
      );
    }).join('');

    var rowGroups = [
      { id: 'client', title: '① 의뢰인 업무' },
      { id: 'store',  title: '② 자료함 (캘린더 포함)' },
      { id: 'sales',  title: '③ 영업관리' },
      { id: 'inside', title: '④ 내부관리' }
    ];
    var matrixHtml = rowGroups.map(function (rg) {
      var apps = Object.keys(C.APP_META).map(function (k) { return C.APP_META[k]; }).filter(function (a) {
        return !a.off && !a.aliasOf && a.row === rg.id;
      });
      var pills = apps.map(function (a) {
        var can = C.appCanAccess(a.key, ME);
        return (
          '<div class="app-node">' +
            '<div class="an-top">' +
              '<b>' + esc(a.icon + ' ' + a.name) + '</b>' +
              (can
                ? '<button type="button" class="sm" data-act="jump-app" data-app="' + esc(a.key) + '" data-url="' + esc(a.url) + '">이동 ↗</button>'
                : '<span class="chip c-gray">' + (a.soon ? '준비중' : '권한분리') + '</span>') +
            '</div>' +
            '<span class="an-role">' + esc(a.role) + '</span>' +
          '</div>'
        );
      }).join('');
      return '<div class="card"><div class="card-hd"><b>' + esc(rg.title) + ' (' + apps.length + '개)</b></div><div class="app-grid">' + pills + '</div></div>';
    }).join('');

    box.innerHTML =
      '<div class="rb-grid">' + rbCards + '</div>' +
      '<h3 class="sec-h">🔌 포털 전체 프로그램 실시간 오케스트레이션 연결망</h3>' +
      matrixHtml;
  }

  function renderDiagnosticsTab() {
    var box = $('diagBox');
    if (!box || !REPORT) return;
    var allItems = REPORT.diagnostics || [];
    if (!allItems.length) {
      box.innerHTML =
        '<div class="empty">' +
          '<b>끊어진 업체 연결이나 누락된 담당자 참조가 발견되지 않았습니다.</b>' +
          '<p>모든 진행 계약이 영구 companyId와 담당 사번으로 안전하게 연결되어 있습니다.</p>' +
        '</div>';
      return;
    }

    var limit = PAGE_LIMIT.diag || PAGE_STEP;
    var items = allItems.slice(0, limit);
    var remain = Math.max(0, allItems.length - items.length);

    var rowsHtml = items.map(function (d, idx) {
      var sev = d.severity === 'high' ? '<span class="chip c-red">높음</span>' : '<span class="chip c-amber">중간</span>';
      return (
        '<tr class="orch-row">' +
          '<td class="col-no">' + (idx + 1) + '</td>' +
          '<td class="col-sev">' + sev + '</td>' +
          '<td class="col-flow">' + esc(d.appName) + '</td>' +
          '<td class="col-co"><b>' + esc(d.companyLabel) + '</b></td>' +
          '<td class="col-tt" title="' + esc(d.detail) + '">' + esc(d.detail) + '</td>' +
          '<td class="col-go"><button type="button" class="sm pri go-btn" data-act="jump-app" data-app="' + esc(d.app) + '" data-url="' + esc(d.targetUrl) + '">원본에서 확인 ➔</button></td>' +
        '</tr>'
      );
    }).join('');

    box.innerHTML =
      '<div class="notice-bar">' +
        '🛡 <b>온톨로지 원본 무변경 원칙(sourceMutation: never)</b> — 오케스트레이션은 이름으로 관계를 자동 병합하거나 덮어쓰지 않습니다. 반드시 원본 프로그램에서 확인 후 연결하세요.' +
      '</div>' +
      '<div class="tbl-wrap"><table class="orch-tbl" aria-label="연결 무결성 진단 목록">' +
        '<thead><tr><th scope="col" class="col-no">№</th><th scope="col" class="col-sev">중요도</th><th scope="col" class="col-flow">원본 앱</th><th scope="col" class="col-co">대상 표시명</th><th scope="col" class="col-tt">진단 내용 · 권장 조치</th><th scope="col" class="col-go">원본 이동</th></tr></thead>' +
        '<tbody>' + rowsHtml + '</tbody>' +
      '</table></div>' +
      (remain > 0 ? '<div class="more-box"><button type="button" class="sm" data-act="more-rows" data-kind="diag">+ 더 보기 (남은 ' + remain + '건)</button></div>' : '');
  }

  function closeDrawer() {
    var hadOpen = !!DETAIL_KEY;
    DETAIL_KEY = '';
    renderSideDrawer();
    if (hadOpen && LAST_DRAWER_TRIGGER) {
      var trig = LAST_DRAWER_TRIGGER;
      LAST_DRAWER_TRIGGER = null;
      restoreFocusDesc(trig);
    }
  }

  function renderSideDrawer() {
    var drawer = $('detailDrawer');
    var body = $('detailBody');
    if (!drawer || !body || !REPORT) return;
    if (!DETAIL_KEY) {
      drawer.classList.remove('on');
      document.body.classList.remove('with-drawer');
      DRAWER_WAS_OPEN = false;
      return;
    }

    var C = Core();
    var openedNow = !DRAWER_WAS_OPEN;
    if (DETAIL_KEY.indexOf('baton:') === 0) {
      var bid = DETAIL_KEY.slice(6);
      var b = REPORT.batons.find(function (x) { return x.id === bid; });
      if (!b) { DETAIL_KEY = ''; drawer.classList.remove('on'); document.body.classList.remove('with-drawer'); DRAWER_WAS_OPEN = false; return; }
      drawer.classList.add('on');
      document.body.classList.add('with-drawer');
      DRAWER_WAS_OPEN = true;
      body.innerHTML =
        '<div class="dr-sec">' +
          '<div class="dr-badges">' + sevChipHtml(b.severity) + ' <span class="chip c-gray">' + esc(b.fromName + ' ➔ ' + b.toName) + '</span></div>' +
          '<h3 class="dr-title">' + esc(b.title) + '</h3>' +
          '<p class="dr-reason">' + esc(b.reason) + '</p>' +
        '</div>' +
        '<div class="dr-kv">' +
          '<div><span>사업장</span><b>' + esc(b.companyLabel) + (b.puLabel ? ' (' + esc(b.puLabel) + ')' : '') + '</b></div>' +
          '<div><span>연결 방식</span><b>' + (b.linkConfidence === 'confirmed' ? '영구 ID / 고유번호 확정' : (b.linkConfidence === 'candidate' ? '상호명 추정 후보 (원본 확인 필요)' : '공통 업무 대기열')) + '</b></div>' +
          '<div><span>담당자</span><b>' + esc(b.ownerName) + '</b></div>' +
          (b.ddayLabel ? '<div><span>기한</span><b>' + esc(b.ddayLabel) + '</b></div>' : '') +
        '</div>' +
        '<div class="dr-memo-box">' +
          '<label for="drMemoInp">내 오케스트레이션 메모 (이 브라우저에만 저장)</label>' +
          '<div class="dr-memo-row">' +
            '<input id="drMemoInp" type="text" maxlength="120" value="' + esc(b.memo || '') + '" placeholder="예: 서명본 수신 확인 후 내일 이알피 반영">' +
            '<button type="button" class="sm" data-act="save-memo" data-id="' + esc(b.id) + '">저장</button>' +
          '</div>' +
        '</div>' +
        '<div class="dr-actions">' +
          '<button type="button" class="pri" data-act="jump-baton" data-id="' + esc(b.id) + '">' + esc(b.toIcon + ' ' + b.toName + '에서 ' + b.actionLabel) + ' ➔</button>' +
          '<button type="button" data-act="jump-app" data-app="' + esc(b.fromApp) + '" data-url="' + esc((C.APP_META[b.fromApp] && C.APP_META[b.fromApp].url) || 'enter.html') + '">출발 앱(' + esc(b.fromName) + ') 열기</button>' +
          '<button type="button" data-act="toggle-one-check" data-id="' + esc(b.id) + '">' + (b.checked ? '↩ 확인 표시 해제' : '✓ 확인 완료 표시') + '</button>' +
        '</div>';
      if (openedNow && $('drCloseBtn')) { try { $('drCloseBtn').focus(); } catch (_) {} }
      return;
    }

    if (DETAIL_KEY.indexOf('co:') === 0) {
      var ckey = DETAIL_KEY.slice(3);
      var co = REPORT.companyFlows.find(function (x) { return x.key === ckey; });
      if (!co) { DETAIL_KEY = ''; drawer.classList.remove('on'); document.body.classList.remove('with-drawer'); DRAWER_WAS_OPEN = false; return; }
      drawer.classList.add('on');
      document.body.classList.add('with-drawer');
      DRAWER_WAS_OPEN = true;

      var bListHtml = co.batons.length
        ? co.batons.map(function (b) {
            return (
              '<div class="dr-bitem">' +
                '<div class="dr-btop">' + sevChipHtml(b.severity) + ' <b>' + esc(b.fromName + ' ➔ ' + b.toName) + '</b></div>' +
                '<div class="dr-btt">' + esc(b.title) + '</div>' +
                '<button type="button" class="sm pri" data-act="jump-baton" data-id="' + esc(b.id) + '">' + esc(b.actionLabel) + ' ➔</button>' +
              '</div>'
            );
          }).join('')
        : '<div class="hint">대기 중인 바통이 없습니다.</div>';

      var quickApps = ['erp', 'work', 'cards', 'mail', 'docs', 'rules', 'govaid', 'consult'].filter(function (k) {
        return C.appCanAccess(k, ME);
      }).map(function (k) {
        var m = C.APP_META[k];
        var url = m.url;
        if (k === 'govaid' && co.companyId) url = 'pu-govaid.html?co=' + encodeURIComponent(co.companyId);
        return '<button type="button" class="sm" data-act="jump-app" data-app="' + esc(k) + '" data-url="' + esc(url) + '" data-co="' + esc(co.name) + '">' + esc(m.icon + ' ' + m.name) + ' ↗</button>';
      }).join('');

      body.innerHTML =
        '<div class="dr-sec">' +
          '<div class="dr-badges">' + (co.puLabel ? '<span class="tag-key">' + esc(co.puLabel) + '</span>' : '<span class="chip c-gray">미연결</span>') + ' <span class="chip c-blue">주담당: ' + esc(co.managerName) + '</span></div>' +
          '<h3 class="dr-title">' + esc(co.name) + '</h3>' +
          '<p class="dr-reason">계약 ' + co.counts.contracts + '건 · 사건 ' + co.counts.cases + '건 · 컨설팅 ' + co.counts.consultings + '건 · 기금 ' + co.counts.funds + '건 · 규정 ' + co.counts.rules + '건 · 할 일 ' + co.counts.works + '건</p>' +
        '</div>' +
        '<div class="dr-sec"><b>⚡ 이 사업장의 실행 바통 (' + co.batons.length + '건)</b>' + bListHtml + '</div>' +
        '<div class="dr-sec"><b>🚀 연결된 프로그램 바로 열기</b><div class="dr-qgrid">' + quickApps + '</div></div>';
      if (openedNow && $('drCloseBtn')) { try { $('drCloseBtn').focus(); } catch (_) {} }
    }
  }

  /* ── 재렌더링 시 포커스 보존 도우미 ── */
  function captureFocusDesc() {
    try {
      var ae = document.activeElement;
      if (!ae || ae === document.body || ae === document.documentElement) return null;
      if (ae.id) {
        return {
          id: ae.id,
          selStart: typeof ae.selectionStart === 'number' ? ae.selectionStart : null,
          selEnd: typeof ae.selectionEnd === 'number' ? ae.selectionEnd : null
        };
      }
      var act = ae.getAttribute && ae.getAttribute('data-act');
      if (act) {
        return {
          act: act,
          dataId: ae.getAttribute('data-id') || '',
          stage: ae.getAttribute('data-stage') || '',
          ck: ae.getAttribute('data-ck') || '',
          rbId: ae.getAttribute('data-rb-id') || ''
        };
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  function restoreFocusDesc(desc) {
    if (!desc) return;
    try {
      var target = null;
      if (desc.id) {
        target = $(desc.id);
      } else if (desc.act) {
        var candidates = document.querySelectorAll('[data-act="' + desc.act.replace(/"/g, '') + '"]');
        for (var i = 0; i < candidates.length; i++) {
          var el = candidates[i];
          if (desc.dataId && el.getAttribute('data-id') !== desc.dataId) continue;
          if (desc.stage !== undefined && desc.act === 'set-stage' && (el.getAttribute('data-stage') || '') !== desc.stage) continue;
          if (desc.ck && el.getAttribute('data-ck') !== desc.ck) continue;
          if (desc.rbId && el.getAttribute('data-rb-id') !== desc.rbId) continue;
          if (el.offsetParent === null && global.getComputedStyle && global.getComputedStyle(el).display === 'none') continue;
          target = el;
          break;
        }
      }
      if (target && typeof target.focus === 'function') {
        target.focus({ preventScroll: true });
        if (desc.selStart != null && typeof target.setSelectionRange === 'function') {
          try { target.setSelectionRange(desc.selStart, desc.selEnd != null ? desc.selEnd : desc.selStart); } catch (_) {}
        }
      }
    } catch (_) {}
  }

  function renderAll() {
    var focusDesc = captureFocusDesc();
    syncHeadHeight();
    renderLoadCoverageNote();
    renderTabsHeader();
    renderStagePipelineBar();
    if (TAB === 'batons') renderBatonTab();
    else if (TAB === 'companies') renderCompaniesTab();
    else if (TAB === 'runbooks') renderRunbooksTab();
    else if (TAB === 'diag') renderDiagnosticsTab();
    renderSideDrawer();
    if (focusDesc && (!document.activeElement || document.activeElement === document.body)) {
      restoreFocusDesc(focusDesc);
    }
  }

  /* ── 사용자 상호작용 핸들러 ── */
  function switchTab(nextTab) {
    if (!nextTab || TAB === nextTab) return;
    TAB = nextTab;
    clearSelection(); // CLAUDE.md 규칙: 화면을 떠나면 고른 것을 비운다
    resetPageLimits();
    renderAll();
  }

  function copyText(text, okMsg) {
    if (global.navigator && global.navigator.clipboard && global.navigator.clipboard.writeText) {
      global.navigator.clipboard.writeText(text).then(function () {
        showToast(okMsg || '클립보드에 복사했습니다');
      }).catch(function () { showToast('복사하지 못했습니다'); });
    } else {
      showToast(okMsg || '준비되었습니다');
    }
  }

  function applyBulkBatonMark(kind) {
    if (!REPORT) return;
    var rows = Core().filterBatons(REPORT.batons, FILTER).slice(0, PAGE_LIMIT.batons || PAGE_STEP);
    var picked = selectedKeysOf(rows.map(function (r) { return r.id; }));
    if (!picked.length) return;
    var label = kind === 'check' ? '확인 완료로 표시' : (kind === 'snooze' ? '오늘 하루 보류로 숨김' : '확인·보류 표시를 해제');
    if (typeof global.confirm === 'function' && !global.confirm('선택한 ' + picked.length + '건을 ' + label + '할까요?\n(원본 프로그램 데이터는 변경되지 않습니다)')) {
      return;
    }
    var st = readLocalState();
    var now = Date.now();
    picked.forEach(function (id) {
      if (kind === 'check') {
        st.checked[id] = now;
        delete st.snoozedUntil[id];
      } else if (kind === 'snooze') {
        st.snoozedUntil[id] = now + 24 * 3600 * 1000;
      } else {
        delete st.checked[id];
        delete st.snoozedUntil[id];
      }
    });
    writeLocalState(st);
    clearSelection();
    recomputeAndRender();
    showToast(picked.length + '건 처리되었습니다');
  }

  function bindEvents() {
    if (EVENTS_BOUND) return;
    EVENTS_BOUND = true;

    if (global.addEventListener) {
      global.addEventListener('resize', syncHeadHeight);
    }

    document.addEventListener('click', function (ev) {
      var btn = ev.target && ev.target.closest ? ev.target.closest('[data-act],[data-tab]') : null;
      if (!btn) return;
      if (btn.tagName === 'INPUT' && btn.type === 'checkbox') return;

      var tabAttr = btn.getAttribute('data-tab');
      if (tabAttr) {
        ev.preventDefault();
        switchTab(tabAttr);
        return;
      }

      var act = btn.getAttribute('data-act');
      if (!act) return;

      if (act === 'refresh') {
        ev.preventDefault();
        if (LOADING) return;
        showToast('전 프로그램 흐름을 다시 점검합니다…');
        loadAllSources(SESSION_EPOCH);
        return;
      }
      if (act === 'more-rows') {
        ev.preventDefault();
        var knd = str(btn.getAttribute('data-kind'));
        if (knd && PAGE_LIMIT[knd]) {
          PAGE_LIMIT[knd] += PAGE_STEP;
          renderAll();
        }
        return;
      }
      if (act === 'set-stage') {
        ev.preventDefault();
        FILTER.stage = str(btn.getAttribute('data-stage'));
        clearSelection();
        resetPageLimits();
        renderAll();
        return;
      }
      if (act === 'toggle-mine') {
        ev.preventDefault();
        FILTER.mineOnly = !FILTER.mineOnly;
        clearSelection();
        resetPageLimits();
        renderAll();
        return;
      }
      if (act === 'toggle-done') {
        ev.preventDefault();
        FILTER.showDone = !FILTER.showDone;
        clearSelection();
        resetPageLimits();
        renderAll();
        return;
      }
      if (act === 'toggle-co-pending') {
        ev.preventDefault();
        FILTER.coOnlyPending = !FILTER.coOnlyPending;
        clearSelection();
        resetPageLimits();
        renderAll();
        return;
      }
      if (act === 'toggle-co-mine') {
        ev.preventDefault();
        FILTER.coMineOnly = !FILTER.coMineOnly;
        clearSelection();
        resetPageLimits();
        renderAll();
        return;
      }
      if (act === 'inspect-baton') {
        ev.preventDefault();
        var ibId = str(btn.getAttribute('data-id'));
        LAST_DRAWER_TRIGGER = { act: 'inspect-baton', dataId: ibId };
        DETAIL_KEY = 'baton:' + ibId;
        renderAll();
        return;
      }
      if (act === 'inspect-co') {
        ev.preventDefault();
        var icId = str(btn.getAttribute('data-id'));
        LAST_DRAWER_TRIGGER = { act: 'inspect-co', dataId: icId };
        DETAIL_KEY = 'co:' + icId;
        renderAll();
        return;
      }
      if (act === 'close-drawer') {
        ev.preventDefault();
        closeDrawer();
        return;
      }
      if (act === 'jump-baton') {
        ev.preventDefault();
        var bid = str(btn.getAttribute('data-id'));
        var b = REPORT && REPORT.batons.find(function (x) { return x.id === bid; });
        if (b) dispatchToApp(b.toApp, b.targetUrl, b);
        return;
      }
      if (act === 'jump-app') {
        ev.preventDefault();
        var appKey = str(btn.getAttribute('data-app'));
        var url = str(btn.getAttribute('data-url'));
        var rbNote = str(btn.getAttribute('data-rb'));
        var coNm = str(btn.getAttribute('data-co'));
        dispatchToApp(appKey, url, {
          id: 'manual:' + appKey,
          fromApp: 'orch',
          toApp: appKey,
          fromName: '오케스트레이션',
          toName: (Core().APP_META[appKey] && Core().APP_META[appKey].name) || appKey,
          companyLabel: coNm || '통합 흐름 연결',
          title: rbNote || ((coNm ? coNm + ' · ' : '') + '오케스트레이션에서 이어서 열기'),
          reason: '작업 완료 후 오른쪽 앱바 또는 복귀 단추로 돌아올 수 있습니다'
        });
        return;
      }
      if (act === 'clear-sel') {
        ev.preventDefault();
        clearSelection();
        renderAll();
        return;
      }
      if (act === 'bulk-check') { ev.preventDefault(); applyBulkBatonMark('check'); return; }
      if (act === 'bulk-snooze') { ev.preventDefault(); applyBulkBatonMark('snooze'); return; }
      if (act === 'bulk-unmark') { ev.preventDefault(); applyBulkBatonMark('unmark'); return; }
      if (act === 'bulk-copy') {
        ev.preventDefault();
        var vis = Core().filterBatons(REPORT ? REPORT.batons : [], FILTER).slice(0, PAGE_LIMIT.batons || PAGE_STEP);
        var pickedIds = selectedKeysOf(vis.map(function (r) { return r.id; }));
        var lines = vis.filter(function (r) { return pickedIds.indexOf(r.id) >= 0; }).map(function (r, i) {
          return (i + 1) + '. [' + r.fromName + ' ➔ ' + r.toName + '] ' + r.companyLabel + ' — ' + r.title + ' (담당: ' + r.ownerName + ')';
        });
        copyText('[푸른 업무 오케스트레이션 바통 요약]\n' + lines.join('\n'), '선택한 ' + lines.length + '건 바통 요약을 복사했습니다');
        return;
      }
      if (act === 'bulk-copy-co') {
        ev.preventDefault();
        var flows = Core().filterCompanyFlows(REPORT ? REPORT.companyFlows : [], {
          q: FILTER.coQ, stage: FILTER.coStage, onlyPending: FILTER.coOnlyPending, mineSid: FILTER.coMineOnly ? ME.sid : ''
        }).slice(0, PAGE_LIMIT.companies || PAGE_STEP);
        var cIds = selectedKeysOf(flows.map(function (c) { return c.key; }));
        var cLines = flows.filter(function (c) { return cIds.indexOf(c.key) >= 0; }).map(function (c, i) {
          return (i + 1) + '. ' + c.name + (c.puLabel ? '(' + c.puLabel + ')' : '') + ' — 대기 바통 ' + c.openBatonCount + '건 · 주담당 ' + c.managerName;
        });
        copyText('[사업장 360° 진행 요약]\n' + cLines.join('\n'), '선택한 ' + cLines.length + '개 사업장 요약을 복사했습니다');
        return;
      }
      if (act === 'save-memo') {
        ev.preventDefault();
        var mid = str(btn.getAttribute('data-id'));
        var inp = $('drMemoInp');
        if (!mid || !inp) return;
        var st0 = readLocalState();
        var val = Core().maskSensitiveText(inp.value).slice(0, 120);
        if (val) st0.notes[mid] = val; else delete st0.notes[mid];
        writeLocalState(st0);
        recomputeAndRender();
        showToast('메모를 저장했습니다');
        return;
      }
      if (act === 'toggle-one-check') {
        ev.preventDefault();
        var tid = str(btn.getAttribute('data-id'));
        if (!tid) return;
        var st1 = readLocalState();
        if (st1.checked[tid]) delete st1.checked[tid];
        else { st1.checked[tid] = Date.now(); delete st1.snoozedUntil[tid]; }
        writeLocalState(st1);
        recomputeAndRender();
        return;
      }
      if (act === 'reset-rb') {
        ev.preventDefault();
        var rbId = str(btn.getAttribute('data-rb-id'));
        var st2 = readLocalState();
        Object.keys(st2.runbooks).forEach(function (k) {
          if (k.indexOf(rbId + ':') === 0) delete st2.runbooks[k];
        });
        writeLocalState(st2);
        RUNBOOK_CHECKS = st2.runbooks;
        renderAll();
        showToast('런북 체크를 초기화했습니다');
      }
    });

    document.addEventListener('change', function (ev) {
      var t = ev.target;
      if (!t) return;
      if (t.id === 'fltSev') { FILTER.severity = str(t.value); clearSelection(); resetPageLimits(); renderAll(); return; }
      if (t.id === 'fltApp') { FILTER.app = str(t.value); clearSelection(); resetPageLimits(); renderAll(); return; }
      if (t.id === 'fltCoStage') { FILTER.coStage = str(t.value); clearSelection(); resetPageLimits(); renderAll(); return; }

      var act = t.getAttribute('data-act');
      if (act === 'sel-row') {
        var id = str(t.getAttribute('data-id'));
        if (t.checked) SEL[id] = true; else delete SEL[id];
        renderAll();
        return;
      }
      if (act === 'toggle-all-batons' && REPORT) {
        var rows = Core().filterBatons(REPORT.batons, FILTER).slice(0, PAGE_LIMIT.batons || PAGE_STEP);
        rows.forEach(function (r) { if (t.checked) SEL[r.id] = true; else delete SEL[r.id]; });
        renderAll();
        return;
      }
      if (act === 'toggle-all-cos' && REPORT) {
        var flows = Core().filterCompanyFlows(REPORT.companyFlows, {
          q: FILTER.coQ, stage: FILTER.coStage, onlyPending: FILTER.coOnlyPending, mineSid: FILTER.coMineOnly ? ME.sid : ''
        }).slice(0, PAGE_LIMIT.companies || PAGE_STEP);
        flows.forEach(function (c) { if (t.checked) SEL[c.key] = true; else delete SEL[c.key]; });
        renderAll();
        return;
      }
      if (act === 'toggle-rb-step') {
        var ck = str(t.getAttribute('data-ck'));
        var st = readLocalState();
        if (t.checked) st.runbooks[ck] = Date.now(); else delete st.runbooks[ck];
        writeLocalState(st);
        RUNBOOK_CHECKS = st.runbooks;
        renderAll();
      }
    });

    document.addEventListener('input', function (ev) {
      var t = ev.target;
      if (!t) return;
      if (t.id === 'fltQ') {
        FILTER.q = str(t.value);
        clearSelection();
        resetPageLimits();
        renderAll();
      } else if (t.id === 'fltCoQ') {
        FILTER.coQ = str(t.value);
        clearSelection();
        resetPageLimits();
        renderAll();
      }
    });

    document.addEventListener('keydown', function (ev) {
      if (ev.isComposing) return;

      // WAI-ARIA 탭 목록 좌우·Home·End 키보드 이동
      var tabEl = ev.target && ev.target.closest ? ev.target.closest('#tabs [role="tab"]') : null;
      if (tabEl && (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft' || ev.key === 'Home' || ev.key === 'End')) {
        ev.preventDefault();
        var curTab = str(tabEl.getAttribute('data-tab')) || TAB;
        var curIdx = TAB_ORDER.indexOf(curTab);
        if (curIdx < 0) curIdx = 0;
        var nextIdx = curIdx;
        if (ev.key === 'ArrowRight') nextIdx = (curIdx + 1) % TAB_ORDER.length;
        else if (ev.key === 'ArrowLeft') nextIdx = (curIdx - 1 + TAB_ORDER.length) % TAB_ORDER.length;
        else if (ev.key === 'Home') nextIdx = 0;
        else if (ev.key === 'End') nextIdx = TAB_ORDER.length - 1;
        var nextKey = TAB_ORDER[nextIdx];
        switchTab(nextKey);
        var nextBtn = $('tab-' + nextKey);
        if (nextBtn && typeof nextBtn.focus === 'function') nextBtn.focus();
        return;
      }

      if (ev.key === 'Escape' && DETAIL_KEY) {
        if (document.activeElement && document.activeElement.id === 'drMemoInp') {
          document.activeElement.blur();
          return;
        }
        ev.preventDefault();
        closeDrawer();
      }
    });
  }

  function showLocked(reason, hasUser) {
    wipeRenderedContainers();
    if (global.PuGate) global.PuGate.hide();
    if ($('app')) $('app').style.display = 'none';
    if ($('outBtn')) $('outBtn').style.display = hasUser ? '' : 'none';
    if ($('lockOutBtn')) $('lockOutBtn').style.display = hasUser ? '' : 'none';
    var lk = $('lock');
    if (lk) lk.style.display = 'block';
    if ($('lockWhy')) $('lockWhy').textContent = reason;
  }

  /* ── 부팅 · 인증 검증 (닫는 쪽 실패 원칙 · 계정 전환 즉시 소거 · reviewer 차단) ── */
  function boot(firebase) {
    applyUrlParams();
    bindEvents();
    syncHeadHeight();
    fbDb = firebase.database();

    firebase.auth().onAuthStateChanged(function (user) {
      SESSION_EPOCH++;
      var myEpoch = SESSION_EPOCH;
      setLoadingUi(false);
      clearSelection();
      DETAIL_KEY = '';
      DRAWER_WAS_OPEN = false;
      LAST_DRAWER_TRIGGER = null;
      wipeRenderedContainers();

      if (!user) {
        LAST_UID = '';
        clearSharedBaton();
        ME = { uid: '', sid: '', name: '', role: 'staff', isAdmin: false, isSubAdmin: false, perms: {} };
        if ($('app')) $('app').style.display = 'none';
        if ($('lock')) $('lock').style.display = 'none';
        if ($('outBtn')) $('outBtn').style.display = 'none';
        if ($('lockOutBtn')) $('lockOutBtn').style.display = 'none';
        if (global.PuGate) global.PuGate.show();
        return;
      }

      if (LAST_UID && LAST_UID !== user.uid) {
        clearSharedBaton();
      }
      LAST_UID = user.uid;

      fbDb.ref('uid_roles/' + user.uid).once('value').then(function (snap) {
        if (myEpoch !== SESSION_EPOCH) return;
        var hasSnap = !!(snap && (typeof snap.exists === 'function' ? snap.exists() : snap.val() != null));
        var ur = (hasSnap && snap.val()) || null;
        if (!ur || typeof ur !== 'object') {
          showLocked('등록된 구성원 권한 정보가 없습니다. 통합 포털에서 관리자에게 계정 승인을 요청해 주세요.', true);
          return;
        }
        var roleStr = str(ur.role);
        var isAdmin = ur.isAdmin === true || roleStr === 'admin';
        var statusStr = str(ur.status);
        var isActive = isAdmin || statusStr === 'active';
        if (roleStr === 'reviewer') {
          showLocked('검수 전용 계정으로는 전사 업무 오케스트레이션을 열람할 수 없습니다.', true);
          return;
        }
        if (!isActive || statusStr === 'resigned' || statusStr === 'inactive' || statusStr === 'pending') {
          showLocked('재직 중인 구성원 계정만 업무 오케스트레이션을 열람할 수 있습니다.', true);
          return;
        }

        if (global.PuGate) global.PuGate.hide();
        if ($('lock')) $('lock').style.display = 'none';
        if ($('lockOutBtn')) $('lockOutBtn').style.display = 'none';
        if ($('app')) $('app').style.display = 'block';
        if ($('outBtn')) $('outBtn').style.display = '';
        syncHeadHeight();

        ME = {
          uid: user.uid,
          sid: str(ur.sid),
          name: str(ur.name) || '구성원',
          role: isAdmin ? 'admin' : (roleStr || 'staff'),
          isAdmin: isAdmin,
          isSubAdmin: !!ur.isSubAdmin,
          perms: {
            hr: !!(ur.hr || isAdmin || ur.isSubAdmin),
            fin: !!(ur.fin || isAdmin || ur.isSubAdmin),
            deungi: !!(ur.deungi || isAdmin || ur.isSubAdmin)
          }
        };
        return loadAllSources(myEpoch);
      }).catch(function () {
        if (myEpoch !== SESSION_EPOCH) return;
        showLocked('계정 권한 정보를 확인하지 못했습니다. 네트워크 연결을 확인한 뒤 새로고침해 주세요.', true);
      });
    });
  }

  global.PuOrchestratorView = {
    boot: boot,
    recompute: recomputeAndRender,
    dispatchToApp: dispatchToApp,
    closeDrawer: closeDrawer
  };
})(typeof window !== 'undefined' ? window : globalThis);
