/* 푸른통합시스템 — 일터혁신 상생컨설팅(일터상생혁신) 자동화 워크스페이스 화면 컨트롤러
 * (ilteo.html 전용 window.PuIlteoView)
 *
 * 맡는 일:
 *   1. 로그인 권한 검증(uid_roles active + sid), 세션 격리(SESSION_EPOCH), PuOntologyWrite 강제 관문(enforce) 연결
 *   2. 정부사업일정(scal_cos·scal_types·scal_scheds) 및 이알피(data/companies·data/consultings)에서
 *      일터혁신 참여 사업장 자동 발견 및 워크스페이스 등록
 *   3. 다음메일 거울(mailbox/folders·mailbox/msgs) 스캔 + Cloud Functions(readMailMessage/readMailAttachment peek:true)
 *      실시간 내용확인·첨부 파싱 + 로컬 드래그앤드롭 파일 이원화 비식별 분석(XLSX/CSV/HWPX/HWP/DOCX/PDF/TXT)
 *   4. 모든 표·체크리스트·회차·Diff·보고서 섹션·산출물·사후관리 목록 좌측 ☐ 고르기 칸 + 번호(1,2...) + 끌어고르기 + 일괄실행 지원
 *   5. 중간보고서 자동 정리 · 회차 인정기준 관리 · 기준선 스냅샷 확정 · 후속 메일 Diff 대조 · 최종 결과보고서 자동 조립
 *   6. 발표용 PPTX(미리보기 포함) · 취업규칙 DOCX · 근로계약/합의서 DOCX · 모의계산/이행점검 XLSX · 플랫폼 문안 · 통합 ZIP 생성 및 3개월 사후관리
 */
(function (global) {
  'use strict';

  var Cat = function () { return global.PuIlteoCatalog; };
  var Intake = function () { return global.PuIlteoIntake; };
  var Report = function () { return global.PuIlteoReport; };
  var Pptx = function () { return global.PuIlteoPptx; };
  var Pack = function () { return global.PuIlteoPack; };

  var MAIL_FN_BASE = 'https://asia-northeast3-pureun-erp.cloudfunctions.net/';

  var fb = null;
  var fbDb = null;
  var gate = null;
  var ME = { uid: '', sid: '', name: '', email: '', isAdmin: false, isSubAdmin: false };
  var SESSION_EPOCH = 0;

  var D = {
    projects: {},
    intake: {},
    mid: {},
    final: {},
    snapshots: {},
    companies: [],
    consultings: [],
    bizTypes: [],
    scalCos: {},
    scalTypes: {},
    scalScheds: {},
    scalDocs: {},
    mailFolders: {},
    mailMsgs: {},
    mailOldMsgs: {},
    flatMails: []
  };

  var SCAN_CACHE = {};
  var DISCOVER_LIST = [];
  var TAB = 'projects';
  var CUR_PID = '';
  var SEL = {};
  var DRAG_SEL = { active: false, listName: '', targetVal: false, startKey: '', moved: false };
  var UPLOAD_DOC_KIND = '';
  var POST_UPLOAD_DOC_KIND = '';

  function $(id) { return document.getElementById(id); }
  function str(v) { return v == null ? '' : String(v).trim(); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }
  function safeKey(v) {
    return str(v).replace(/[.#$/\[\]\s]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 72) || ('id_' + Date.now());
  }
  function stripUndef(v) {
    if (Array.isArray(v)) return v.filter(function (x) { return x !== undefined; }).map(stripUndef);
    if (v && typeof v === 'object') {
      var o = {};
      Object.keys(v).forEach(function (k) {
        if (v[k] !== undefined) o[k] = stripUndef(v[k]);
      });
      return o;
    }
    return v;
  }
  function rowsOf(v) {
    var x = v && typeof v === 'object' && !Array.isArray(v) && v.v !== undefined ? v.v : v;
    if (Array.isArray(x)) return x.filter(function (r) { return r && typeof r === 'object'; });
    if (x && typeof x === 'object') {
      return Object.keys(x).map(function (k) { return x[k]; }).filter(function (r) { return r && typeof r === 'object'; });
    }
    return [];
  }
  function fmtDateTime(ms) {
    var n = Number(ms);
    if (!isFinite(n) || n <= 0) return '-';
    var s = new Date(n + 9 * 3600e3).toISOString();
    return s.slice(0, 10) + ' ' + s.slice(11, 16);
  }
  function toast(msg) {
    var el = $('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('on');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.classList.remove('on'); }, 3600);
  }
  function askConfirm(msg) {
    if (typeof global.confirm === 'function') return global.confirm(msg);
    return true;
  }

  function currentAuthUid() {
    try {
      return (fb && fb.auth && fb.auth().currentUser && fb.auth().currentUser.uid) ? String(fb.auth().currentUser.uid) : '';
    } catch (e) { return ''; }
  }
  function isSessionCurrent(epoch, uid) {
    return !!uid && epoch === SESSION_EPOCH && !!ME && ME.uid === uid && currentAuthUid() === uid;
  }

  function purgeSessionState() {
    gate = null;
    ME = { uid: '', sid: '', name: '', email: '', isAdmin: false, isSubAdmin: false };
    TAB = 'projects';
    CUR_PID = '';
    SEL = {};
    DRAG_SEL = { active: false, listName: '', targetVal: false, startKey: '', moved: false };
    SCAN_CACHE = {};
    DISCOVER_LIST = [];
    D = {
      projects: {}, intake: {}, mid: {}, final: {}, snapshots: {},
      companies: [], consultings: [], bizTypes: [],
      scalCos: {}, scalTypes: {}, scalScheds: {}, scalDocs: {},
      mailFolders: {}, mailMsgs: {}, mailOldMsgs: {}, flatMails: []
    };
    closeModal();
    ['kpiBox', 'projectsBox', 'discoverBox', 'intakeBox', 'midBox', 'finalBox'].forEach(function (id) {
      var el = $(id);
      if (el) el.innerHTML = '';
    });
    if ($('app')) $('app').style.display = 'none';
  }

  /* ══ 1. 데이터 로드 · 자동 발견 · 메일 스캔 ═════════════════════════════ */
  async function safeVal(path) {
    try {
      var snap = await fbDb.ref(path).once('value');
      return snap ? snap.val() : null;
    } catch (e) {
      return null;
    }
  }

  async function reload(optEpoch, optUid) {
    var reqEpoch = optEpoch || SESSION_EPOCH;
    var reqUid = optUid || (ME && ME.uid ? String(ME.uid) : '');
    if (!isSessionCurrent(reqEpoch, reqUid)) return;

    var res = await Promise.all([
      safeVal('scal_ilteo'),
      safeVal('data/companies'),
      safeVal('data/consultings'),
      safeVal('data/biz_cons_types'),
      safeVal('scal_cos'),
      safeVal('scal_types'),
      safeVal('scal_scheds'),
      safeVal('scal_docs'),
      safeVal('mailbox/folders'),
      safeVal('mailbox/msgs'),
      safeVal('mailbox/old/msgs')
    ]);
    if (!isSessionCurrent(reqEpoch, reqUid)) return;

    var ilteoRoot = res[0] && typeof res[0] === 'object' ? res[0] : {};
    D.projects = ilteoRoot.projects || {};
    D.intake = ilteoRoot.intake || {};
    D.mid = ilteoRoot.mid || {};
    D.final = ilteoRoot.final || {};
    D.snapshots = ilteoRoot.snapshots || {};
    D.companies = rowsOf(res[1]);
    D.consultings = rowsOf(res[2]);
    D.bizTypes = rowsOf(res[3]);
    D.scalCos = res[4] || {};
    D.scalTypes = res[5] || {};
    D.scalScheds = res[6] || {};
    D.scalDocs = res[7] || {};
    D.mailFolders = res[8] || {};
    D.mailMsgs = res[9] || {};
    D.mailOldMsgs = res[10] || {};
    D.flatMails = Intake().flattenMailboxRows(D.mailFolders, D.mailMsgs, D.mailOldMsgs);

    rebuildScanAndDiscover();
    applyHashTarget();
    draw();
  }

  function activeProjects() {
    return Object.keys(D.projects || {}).map(function (k) { return D.projects[k]; })
      .filter(function (p) { return p && typeof p === 'object' && !p._deleted && p.id && isIlteoProject(p); })
      .sort(function (a, b) { return (Number(b.updatedAt || 0) - Number(a.updatedAt || 0)); });
  }

  function projectById(pid) {
    var p = D.projects && D.projects[pid];
    return (p && !p._deleted && isIlteoProject(p)) ? p : null;
  }

  function schedRoundsForProject(proj) {
    if (!proj) return [];
    var all = rowsOf(D.scalScheds);
    var hits = all.filter(function (s) {
      if (!s || s.phase === 'pre' || s.phase === 'post') return false;
      var sameCo = (proj.scalCoId && s.coId === proj.scalCoId) || (proj.companyId && s.coId === proj.companyId);
      if (!sameCo) return false;
      if (proj.scalTypeId && s.typeId && s.typeId !== proj.scalTypeId) return false;
      return /^\d{4}-\d{2}-\d{2}$/.test(str(s.date));
    }).sort(function (a, b) { return str(a.date) < str(b.date) ? -1 : 1; });

    return hits.map(function (s, idx) {
      return {
        roundNo: idx + 1,
        date: str(s.date),
        mode: s.isField === false ? 'remote' : 'face',
        mins: 120,
        companyPeople: Math.max(3, Number(proj.designTeamCount || 4) - 1),
        topic: str(s.memo)
      };
    });
  }

  function manualChecksOf(proj, phase) {
    if (!proj || !proj.manualChecks || typeof proj.manualChecks !== 'object') return {};
    var sub = proj.manualChecks[phase];
    return (sub && typeof sub === 'object') ? sub : {};
  }

  function isIlteoProject(proj) {
    if (!proj) return false;
    if (proj.isIlteo === false) return false;
    var prog = str(proj.programName);
    if (prog && Intake().isNonIlteoText && Intake().isNonIlteoText(prog)) return false;
    if (typeof proj.isIlteo === 'boolean') return proj.isIlteo;
    if (!prog) return true;
    return /일터\s*혁신|일터\s*상생|상생\s*컨설팅/.test(prog);
  }

  function rebuildScanAndDiscover() {
    SCAN_CACHE = {};
    var projs = activeProjects();
    var registeredKeys = {};
    projs.forEach(function (p) {
      var yr = Number(p.year) || 2026;
      if (p.companyId) registeredKeys['co:' + p.companyId + ':' + yr] = p.id;
      if (p.consultingId) registeredKeys['cons:' + p.consultingId] = p.id;
      if (p.scalCoId) registeredKeys['scal:' + p.scalCoId + ':' + yr] = p.id;
      var pNorm = Intake().normalizeCorpName ? Intake().normalizeCorpName(p.companyName) : '';
      if (pNorm) registeredKeys['norm:' + pNorm + ':' + yr] = p.id;
      SCAN_CACHE[p.id] = Intake().scanProjectMails(
        p, D.flatMails, null, D.companies, D.consultings, D.intake[p.id] || {}
      );
    });

    if (!CUR_PID && projs.length) CUR_PID = projs[0].id;
    if (CUR_PID && !projectById(CUR_PID)) CUR_PID = projs[0] ? projs[0].id : '';

    var cands = [], seenCoYear = {};
    var ilteoRe = /일터\s*혁신|일터\s*상생|상생\s*컨설팅/;
    var typeMap = {};
    Object.keys(D.scalTypes || {}).forEach(function (k) {
      var t = D.scalTypes[k];
      if (!t || typeof t !== 'object') return;
      var tid = str(t.id || k);
      if (tid) typeMap[tid] = str(t.name || t.title);
    });
    var bizTypeMap = {};
    D.bizTypes.forEach(function (bt) {
      if (!bt || typeof bt !== 'object') return;
      var bid = str(bt.id || bt.code);
      if (bid) bizTypeMap[bid] = str(bt.name || bt.title);
    });

    D.consultings.forEach(function (cs) {
      if (!cs || cs._deleted) return;
      var bCode = str(cs.typeCode || cs.bizTypeId || cs.consultingTypeCode);
      var bName = str(cs.bizName || cs.typeName || cs.consultingType || bizTypeMap[bCode] || '');
      var csNo = str(cs.no);
      var isPureIlteoCons = (
        bCode === 'consulting-mozfisq7' ||
        bCode === 'consulting-mp0wphau' ||
        /^(?:일터상생|일터혁신|일터)-/.test(csNo) ||
        (ilteoRe.test(bName) && !(Intake().isNonIlteoText && Intake().isNonIlteoText(bName)))
      );
      if (!isPureIlteoCons) return;
      var yr = Number(String(cs.year || cs.contractDate || cs.startDate || '2026').slice(0, 4)) || 2026;
      var coObj = (cs.company && typeof cs.company === 'object') ? cs.company : {};
      var coId = str(cs.companyId || coObj.id) || (cs.id ? ('cons_' + safeKey(cs.id)) : '');
      var coRec = findCompanyById(coId) || coObj;
      var coNameStr = str(coRec.name || cs.companyName || cs.name || '사업장');
      var cNorm = Intake().normalizeCorpName ? Intake().normalizeCorpName(coNameStr) : '';
      var cyKey = coId + ':' + yr;
      var normYrKey = cNorm ? ('norm:' + cNorm + ':' + yr) : '';
      if (!coId || registeredKeys['co:' + cyKey] || (cs.id && registeredKeys['cons:' + cs.id]) || (normYrKey && registeredKeys[normYrKey]) || seenCoYear[cyKey] || (normYrKey && seenCoYear[normYrKey])) return;
      seenCoYear[cyKey] = 1;
      if (normYrKey) seenCoYear[normYrKey] = 1;
      cands.push({
        candKey: 'erp_' + safeKey(coId) + '_' + yr,
        source: '이알피 컨설팅',
        companyId: coId,
        consultingId: str(cs.id),
        companyName: coNameStr,
        bizNo: str(coRec.bizNo || cs.bizNo),
        industry: str(coRec.bizType || coRec.bizCategory || cs.industry),
        contactEmail: firstEmailOf(coRec) || firstEmailOf(cs),
        year: yr,
        programName: '일터혁신 상생컨설팅',
        isIlteo: true,
        scalCoId: '',
        scalTypeId: ''
      });
    });

    Object.keys(D.scalCos || {}).forEach(function (sk) {
      var sc = D.scalCos[sk];
      if (!sc || typeof sc !== 'object' || sc._deleted || sc.deleted || sc.mergedInto || sc.active === false) return;
      var scId = str(sc.id || sk);
      if (!scId) return;
      var rawTypes = Array.isArray(sc.types)
        ? sc.types.map(str)
        : (sc.types && typeof sc.types === 'object' ? Object.keys(sc.types).map(function (tk) { return str(sc.types[tk]); }) : []);
      if (sc.typeId) rawTypes.push(str(sc.typeId));
      var hasT1 = rawTypes.indexOf('t1') >= 0;
      var tNames = rawTypes.map(function (tid) { return typeMap[str(tid)] || ''; }).filter(Boolean);
      var joinedTypeNames = tNames.join(' ') + ' ' + str(sc.bizName || '');
      var hasIlteoSched = rowsOf(D.scalScheds).some(function (s) {
        return s && s.coId === scId && (s.typeId === 't1' || ilteoRe.test(typeMap[s.typeId] || ''));
      });
      if (!hasT1 && !ilteoRe.test(joinedTypeNames) && !hasIlteoSched) return;
      var yr = Number(sc.year) || 2026;
      var matchedErpCo = matchErpCompanyStrict(sc);
      var targetCoId = matchedErpCo ? str(matchedErpCo.id) : ('scal_' + safeKey(scId));
      var scNameStr = str((matchedErpCo && matchedErpCo.name) || sc.name);
      var sNorm = Intake().normalizeCorpName ? Intake().normalizeCorpName(scNameStr) : '';
      var cyKey = targetCoId + ':' + yr;
      var normYrKey = sNorm ? ('norm:' + sNorm + ':' + yr) : '';
      if (registeredKeys['co:' + cyKey] || registeredKeys['scal:' + scId + ':' + yr] || (normYrKey && registeredKeys[normYrKey]) || seenCoYear[cyKey] || (normYrKey && seenCoYear[normYrKey])) return;
      seenCoYear[cyKey] = 1;
      if (normYrKey) seenCoYear[normYrKey] = 1;
      cands.push({
        candKey: 'scal_' + safeKey(targetCoId) + '_' + yr,
        source: '정부사업일정',
        companyId: targetCoId,
        companyName: scNameStr,
        bizNo: str((matchedErpCo && matchedErpCo.bizNo) || sc.bizNo),
        industry: str((matchedErpCo && (matchedErpCo.bizType || matchedErpCo.bizCategory)) || sc.industry),
        contactEmail: firstEmailOf(matchedErpCo) || firstEmailOf(sc),
        year: yr,
        programName: '일터혁신 상생컨설팅',
        isIlteo: true,
        scalCoId: scId,
        scalTypeId: hasT1 ? 't1' : str(rawTypes[0] || sc.typeId || 't1')
      });
    });

    DISCOVER_LIST = cands;
  }

  function findCompanyById(coId) {
    var id = str(coId);
    if (!id) return null;
    for (var i = 0; i < D.companies.length; i++) {
      if (str(D.companies[i].id) === id) return D.companies[i];
    }
    return null;
  }

  function matchErpCompanyStrict(scalCo) {
    if (!scalCo) return null;
    var explicitId = str(scalCo.erpCompanyId || scalCo.co_id || scalCo.companyId);
    if (explicitId) {
      var byId = findCompanyById(explicitId);
      if (byId) return byId;
    }
    var biz = str(scalCo.bizNo).replace(/\D/g, '');
    if (biz.length === 10) {
      for (var i = 0; i < D.companies.length; i++) {
        if (str(D.companies[i].bizNo).replace(/\D/g, '') === biz) return D.companies[i];
      }
    }
    return null;
  }

  function firstEmailOf(obj) {
    if (!obj || typeof obj !== 'object') return '';
    var list = [obj.email, obj.primaryContactEmail, obj.contactEmail, obj.taxEmail];
    if (Array.isArray(obj.contacts)) {
      obj.contacts.forEach(function (c) { if (c && c.email) list.push(c.email); });
    }
    for (var i = 0; i < list.length; i++) {
      var m = String(list[i] || '').match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
      if (m) return m[0].toLowerCase();
    }
    return '';
  }

  function applyHashTarget() {
    if (typeof location === 'undefined' || !location.hash) return;
    var h = location.hash.replace(/^#/, '');
    var mProj = /(?:^|&)proj=([^&]+)/.exec(h);
    var mCo = /(?:^|&)co=([^&]+)/.exec(h);
    if (mProj) {
      var pid = decodeURIComponent(mProj[1]);
      if (projectById(pid)) {
        CUR_PID = pid;
        TAB = 'intake';
      }
    } else if (mCo) {
      var cid = decodeURIComponent(mCo[1]);
      var found = activeProjects().find(function (p) { return p.companyId === cid || p.scalCoId === cid; });
      if (found) {
        CUR_PID = found.id;
        TAB = found.midConfirmedAt ? 'final' : 'intake';
      }
    }
  }

  /* ══ 2. 공통 표 & 섹션 렌더러 (좌측 ☐ 체크박스 + № 번호 + 끌어고르기 + 일괄 실행 바) ═ */
  function renderTable(name, heads, rows, curId) {
    if (!rows.length) return '<div class="empty">표시할 내역이 없습니다.</div>';
    var allOn = rows.every(function (r) { return !!SEL[name + '|' + r.id]; });
    var html = '<div class="bulk" data-bulk="' + esc(name) + '"></div><div class="scroll"><table class="t" data-name="' + esc(name) + '"><thead><tr>' +
      '<th class="c"><input type="checkbox" data-all="' + esc(name) + '"' + (allOn ? ' checked' : '') + ' aria-label="전체 선택"></th>' +
      '<th class="n">번호</th>' +
      heads.map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('') +
      '</tr></thead><tbody>';

    rows.forEach(function (r, idx) {
      var ckKey = name + '|' + r.id;
      var trCls = (curId && r.id === curId) ? ' class="cur"' : '';
      html += '<tr data-row="' + esc(r.id) + '" data-tname="' + esc(name) + '"' + trCls + '>' +
        '<td class="c"><input type="checkbox" data-ck="' + esc(ckKey) + '"' + (SEL[ckKey] ? ' checked' : '') + ' aria-label="' + (idx + 1) + '번 선택"></td>' +
        '<td class="n">' + (idx + 1) + '</td>' +
        r.cells.map(function (cell) {
          var cls = cell.cls ? ' class="' + esc(cell.cls) + '"' : '';
          var dk = cell.k ? ' data-k="' + esc(cell.k) + '"' : '';
          var ti = cell.title ? ' title="' + esc(cell.title) + '"' : '';
          return '<td' + cls + dk + ti + '>' + cell.html + '</td>';
        }).join('') +
        '</tr>';
    });
    html += '</tbody></table></div>';
    return html;
  }

  function renderSectionList(listName, headLabel, sectionsMeta, secsObj, locksObj, modePrefix, badgeCls) {
    var allOn = sectionsMeta.length > 0 && sectionsMeta.every(function (s) { return !!SEL[listName + '|' + s.key]; });
    var cards = sectionsMeta.map(function (s, idx) {
      var ckKey = listName + '|' + s.key;
      var isSel = !!SEL[ckKey];
      var locked = !!(locksObj && locksObj[s.key]);
      var val = str(secsObj && secsObj[s.key]);
      return '<div class="rpt-sec-card' + (isSel ? ' sel' : '') + '" data-sec-row="' + esc(s.key) + '">' +
        '<div class="rpt-sec-hd">' +
        '<input type="checkbox" data-ck="' + esc(ckKey) + '"' + (isSel ? ' checked' : '') + ' aria-label="' + (idx + 1) + '번 섹션 선택">' +
        '<span class="sec-no">' + (idx + 1) + '</span>' +
        '<span class="chip ' + esc(badgeCls) + '">' + esc(s.part) + '</span>' +
        '<b>' + esc(s.title) + '</b>' +
        '<span class="sp"></span>' +
        '<label class="hint" style="display:inline-flex;align-items:center;gap:4px;cursor:pointer">' +
        '<input type="checkbox" data-' + modePrefix + '-lock="' + esc(s.key) + '"' + (locked ? ' checked' : '') + '> 🔒 고정</label>' +
        '<button class="sm" data-ai-polish="' + modePrefix + ':' + esc(s.key) + '" title="개인정보 2중 가림 후 문체만 다듬습니다">✨ AI 윤문</button>' +
        '<button class="sm ok" data-save-' + modePrefix + '-sec="' + esc(s.key) + '">💾 저장</button>' +
        '</div>' +
        '<div class="rpt-sec-body">' +
        '<textarea id="' + modePrefix + 'Sec_' + esc(s.key) + '" aria-label="' + esc(s.title) + '">' + esc(val) + '</textarea>' +
        '</div></div>';
    }).join('');

    return '<div class="bulk" data-bulk="' + esc(listName) + '"></div>' +
      '<div class="sec-list-hd">' +
      '<input type="checkbox" data-all="' + esc(listName) + '"' + (allOn ? ' checked' : '') + ' aria-label="' + esc(headLabel) + ' 전체 선택">' +
      '<span class="sec-no">번호</span>' +
      '<span>' + esc(headLabel) + '</span>' +
      '</div>' +
      '<div class="rpt-sec-list" data-sec-name="' + esc(listName) + '">' + cards + '</div>';
  }

  function listCheckboxesInDom(name) {
    if (typeof document === 'undefined') return [];
    var sel = 'table.t[data-name="' + name + '"] input[data-ck], [data-sec-name="' + name + '"] input[data-ck]';
    return Array.prototype.slice.call(document.querySelectorAll(sel));
  }

  function syncHeaderCheckbox(name) {
    if (typeof document === 'undefined' || !name) return;
    var hd = document.querySelector('input[data-all="' + name + '"]');
    if (!hd) return;
    var cbs = listCheckboxesInDom(name);
    hd.checked = cbs.length > 0 && cbs.every(function (cb) { return cb.checked; });
    cbs.forEach(function (cb) {
      var card = cb.closest ? cb.closest('.rpt-sec-card') : null;
      if (card) card.classList.toggle('sel', cb.checked);
    });
  }

  function pickedIds(name) {
    var prefix = name + '|';
    return Object.keys(SEL).filter(function (k) { return k.indexOf(prefix) === 0 && SEL[k]; }).map(function (k) { return k.slice(prefix.length); });
  }
  function clearSel(name) {
    if (!name) {
      SEL = {};
      if (typeof document !== 'undefined') {
        document.querySelectorAll('input[data-ck], input[data-all]').forEach(function (cb) { cb.checked = false; });
        document.querySelectorAll('.rpt-sec-card.sel').forEach(function (c) { c.classList.remove('sel'); });
      }
      return;
    }
    pickedIds(name).forEach(function (id) { delete SEL[name + '|' + id]; });
    listCheckboxesInDom(name).forEach(function (cb) { cb.checked = false; });
    syncHeaderCheckbox(name);
  }

  function drawBulks() {
    document.querySelectorAll('[data-bulk]').forEach(function (el) {
      var nm = el.getAttribute('data-bulk');
      var n = pickedIds(nm).length;
      el.className = 'bulk' + (n ? ' on' : '');
      if (!n) { el.innerHTML = ''; return; }
      var btns = '';
      if (nm === 'projects') {
        btns = '<button class="sm danger" data-bulkact="projects:del">선택 숨김(삭제)</button>';
      } else if (nm === 'discover') {
        btns = '<button class="sm pri" data-bulkact="discover:activate">⚡ 선택 활성화</button>';
      } else if (nm === 'preChk' || nm === 'postChk') {
        btns = '<button class="sm ok" data-bulkact="' + nm + ':check">✓ 수령확인</button>' +
          '<button class="sm" data-bulkact="' + nm + ':uncheck">확인 해제</button>' +
          '<button class="sm warn-btn" data-bulkact="' + nm + ':reqmail">✉️ 요청문안</button>';
      } else if (nm === 'candMails') {
        btns = '<button class="sm pri" data-bulkact="candMails:analyze">🔍 내용확인·연결</button>';
      } else if (nm === 'preMails' || nm === 'postMails') {
        btns = '<button class="sm pri" data-bulkact="' + nm + ':analyze">🔍 내용확인·분석</button>' +
          '<button class="sm ok" data-bulkact="' + nm + ':check">✓ 확인표시</button>';
      } else if (nm === 'preCards' || nm === 'postCards') {
        btns = '<button class="sm danger" data-bulkact="' + nm + ':del">선택 카드 삭제</button>';
      } else if (nm === 'rounds') {
        btns = '<button class="sm ok" data-bulkact="rounds:proofOn">✓ 증빙완료</button>' +
          '<button class="sm" data-bulkact="rounds:proofOff">증빙 해제</button>' +
          '<button class="sm" data-bulkact="rounds:face">대면 전환</button>' +
          '<button class="sm" data-bulkact="rounds:remote">비대면 전환</button>' +
          '<button class="sm danger" data-bulkact="rounds:del">회차 삭제</button>';
      } else if (nm === 'midSecs' || nm === 'finalSecs') {
        btns = '<button class="sm ok" data-bulkact="' + nm + ':save">💾 선택 저장</button>' +
          '<button class="sm pri" data-bulkact="' + nm + ':lock">🔒 수기 고정</button>' +
          '<button class="sm" data-bulkact="' + nm + ':unlock">🔓 고정 해제</button>';
      } else if (nm === 'diffRows') {
        btns = '<button class="sm ok" data-bulkact="diffRows:confirm">✓ 합의 확정</button>' +
          '<button class="sm warn-btn" data-bulkact="diffRows:hold">보류 표시</button>' +
          '<button class="sm danger" data-bulkact="diffRows:del">수기행 삭제</button>';
      } else if (nm === 'deliverables') {
        btns = '<button class="sm pri" data-bulkact="deliverables:zip">📦 선택 산출물 ZIP</button>';
      } else if (nm === 'followups') {
        btns = '<button class="sm ok" data-bulkact="followups:done">✓ 이행완료</button>' +
          '<button class="sm" data-bulkact="followups:todo">점검예정 복원</button>';
      }
      el.innerHTML = '<b>' + n + '건 선택됨</b>' + btns + '<button class="sm" data-bulkact="' + nm + ':clear">선택 해제</button>';
    });
  }

  /* ══ 3. 화면 전체 그리기 ════════════════════════════════════════════════ */
  function draw() {
    var projs = activeProjects();
    var totalPreUnseen = 0, totalPostUnseen = 0, midDoneCnt = 0;
    projs.forEach(function (p) {
      var sc = SCAN_CACHE[p.id] || { unseenPreCount: 0, unseenPostCount: 0 };
      totalPreUnseen += sc.unseenPreCount;
      totalPostUnseen += sc.unseenPostCount;
      if (p.midConfirmedAt) midDoneCnt++;
    });

    if ($('nProjects')) $('nProjects').textContent = String(projs.length);
    var curScan = CUR_PID && SCAN_CACHE[CUR_PID] ? SCAN_CACHE[CUR_PID] : null;
    if ($('nPreMail')) $('nPreMail').textContent = String(curScan ? curScan.unseenPreCount : totalPreUnseen);
    if ($('nPostMail')) $('nPostMail').textContent = String(curScan ? curScan.unseenPostCount : totalPostUnseen);
    if ($('nDiscover')) $('nDiscover').textContent = String(DISCOVER_LIST.length);

    document.querySelectorAll('#tabs button[data-tab]').forEach(function (b) {
      var isOn = b.getAttribute('data-tab') === TAB;
      b.classList.toggle('on', isOn);
      b.setAttribute('aria-selected', isOn ? 'true' : 'false');
      b.setAttribute('tabindex', isOn ? '0' : '-1');
    });
    ['projects', 'intake', 'mid', 'final'].forEach(function (t) {
      var pane = $('p-' + t);
      if (pane) pane.classList.toggle('on', t === TAB);
    });

    drawProjectsPane(projs, totalPreUnseen, midDoneCnt, totalPostUnseen);
    drawIntakePane();
    drawMidPane();
    drawFinalPane();
    drawBulks();
  }

  function activeIntakeCount(projId) {
    var map = D.intake[projId] || {};
    return Object.keys(map).filter(function (k) { return map[k] && !map[k]._deleted; }).length;
  }

  function stageDotsHtml(proj) {
    var curOrder = proj.finalConfirmedAt ? 6 : (proj.midConfirmedAt ? 4 : (activeIntakeCount(proj.id) ? 2 : 1));
    return '<span class="pbar">' + Cat().STAGES.map(function (st) {
      var cls = st.order < curOrder ? ' done' : (st.order === curOrder ? ' cur' : '');
      return '<span class="pdot' + cls + '" title="' + esc(st.name) + '"></span>';
    }).join('') + '</span>';
  }

  function resolveTaskNames(codes) {
    var seen = {}, out = [];
    (Array.isArray(codes) ? codes : []).forEach(function (c) {
      var t = Cat().getTask(c);
      if (t && !seen[t.code]) {
        seen[t.code] = 1;
        out.push(t.name);
      }
    });
    return out;
  }

  function projectHeaderBarHtml(proj) {
    var projs = activeProjects();
    var lv = Cat().getLevel(proj.level);
    var tasks = resolveTaskNames(proj.selectedTasks);
    var curOrder = proj.finalConfirmedAt ? 6 : (proj.midConfirmedAt ? 4 : (activeIntakeCount(proj.id) ? 2 : 1));

    var opts = projs.map(function (p) {
      return '<option value="' + esc(p.id) + '"' + (p.id === proj.id ? ' selected' : '') + '>' + esc(p.companyName + ' (' + (p.year || 2026) + ')') + '</option>';
    }).join('');

    var progTag = str(proj.programName);
    return '<div class="card">' +
      '<div class="prof">' +
      '<span><b>대상 사업장</b><select data-proj-sel="1" aria-label="작업 사업장 전환">' + opts + '</select></span>' +
      (progTag ? '<span><b>사업구분</b><span class="chip ' + (isIlteoProject(proj) ? 'c-blue' : '') + '">' + esc(progTag) + '</span></span>' : '') +
      '<span><b>수준</b><span class="chip c-blue">' + esc(lv.name) + '</span></span>' +
      '<span title="' + esc(tasks.join(', ')) + '"><b>개선과제</b>' + esc(tasks.join(' · ') || '미선택') + '</span>' +
      '<span><b>기준선</b>' + (proj.midConfirmedAt ? '<span class="chip c-green">중간보고 확정 (' + esc(fmtDateTime(proj.midConfirmedAt).slice(0, 10)) + ')</span>' : '<span class="chip c-amber">기초진단 진행중</span>') + '</span>' +
      '<span class="sp"></span>' +
      '<button class="sm" data-act="open-task-modal">🎯 과제·정보 설정</button>' +
      '</div>' +
      '<div class="ws-steps">' +
      Cat().STAGES.map(function (st) {
        var cls = st.order < curOrder ? ' done' : (st.order === curOrder ? ' cur' : '');
        var targetTab = st.phase === 'post_mid' ? 'final' : (st.code === 'mid_rpt' ? 'mid' : 'intake');
        return '<button type="button" class="ws-step' + cls + '" data-goto-tab="' + targetTab + '">' +
          '<b>' + st.order + '. ' + esc(st.short) + '</b>' +
          '<span>' + esc(st.desc) + '</span>' +
          '</button>';
      }).join('') +
      '</div></div>';
  }

  /* ── 탭 1: 사업장 현황 · 메일 감지 ── */
  function drawProjectsPane(projs, totalPreUnseen, midDoneCnt, totalPostUnseen) {
    if ($('kpiBox')) {
      $('kpiBox').innerHTML =
        '<div class="kpi k-blue"><span>일터혁신 컨설팅 사업장</span><b>' + projs.length + '건</b></div>' +
        '<div class="kpi k-amber"><span>📩 기초자료 메일 미확인</span><b>' + totalPreUnseen + '건</b></div>' +
        '<div class="kpi k-green"><span>📌 중간·결과보고 수록 완료</span><b>' + midDoneCnt + '건</b></div>' +
        '<div class="kpi k-blue"><span>📬 후속·결과 메일 미확인</span><b>' + totalPostUnseen + '건</b></div>';
    }

    var yrSel = $('projYear');
    if (yrSel) {
      var curYrVal = str(yrSel.value);
      var yrMap = {};
      for (var y = 2026; y >= 2015; y--) yrMap[String(y)] = 1;
      projs.forEach(function (p) { if (p.year) yrMap[String(p.year)] = 1; });
      var sortedYrs = Object.keys(yrMap).sort(function (a, b) { return Number(b) - Number(a); });
      if (yrSel.options.length !== sortedYrs.length + 1) {
        yrSel.innerHTML = '<option value="">연도 전체</option>' + sortedYrs.map(function (yv) {
          return '<option value="' + esc(yv) + '"' + (yv === curYrVal ? ' selected' : '') + '>' + esc(yv) + '년</option>';
        }).join('');
      }
    }

    var q = str($('projQ') && $('projQ').value).toLowerCase();
    var yr = str($('projYear') && $('projYear').value);
    var stFilter = str($('projStage') && $('projStage').value);

    var filtered = projs.filter(function (p) {
      if (yr && String(p.year || '') !== yr) return false;
      var sc = SCAN_CACHE[p.id] || { unseenPreCount: 0, unseenPostCount: 0 };
      if (stFilter === 'pre_mid' && p.midConfirmedAt) return false;
      if (stFilter === 'post_mid' && !p.midConfirmedAt) return false;
      if (stFilter === 'unseen' && (sc.unseenPreCount + sc.unseenPostCount) === 0) return false;
      if (q) {
        var taskStr = resolveTaskNames(p.selectedTasks).join(' ');
        var hay = (str(p.companyName) + ' ' + str(p.industry) + ' ' + str(p.consultantName) + ' ' + taskStr).toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });

    var rows = filtered.map(function (p) {
      var sc = SCAN_CACHE[p.id] || { matched: [], unseenPreCount: 0, unseenPostCount: 0, totalInCount: 0 };
      var chkPre = Intake().summarizeChecklistProgress('pre_mid', p.selectedTasks, D.intake[p.id] || {}, sc.matched, manualChecksOf(p, 'pre_mid'));
      var lv = Cat().getLevel(p.level);
      var taskNames = resolveTaskNames(p.selectedTasks).join(' · ');
      var cardCnt = activeIntakeCount(p.id);
      var hasMid = !!(D.mid[p.id] && D.mid[p.id].sections);
      var hasFin = !!(D.final[p.id] && D.final[p.id].sections);

      var mailBadges = [];
      if (sc.unseenPreCount > 0) mailBadges.push('<span class="chip c-amber">📩 기초 미확인 ' + sc.unseenPreCount + '</span>');
      if (sc.unseenPostCount > 0) mailBadges.push('<span class="chip c-green">📬 후속 미확인 ' + sc.unseenPostCount + '</span>');
      if (cardCnt > 0) mailBadges.push('<span class="chip c-blue">자료 ' + cardCnt + '건</span>');
      if (hasMid || hasFin) mailBadges.push('<span class="chip c-green">' + (hasMid && hasFin ? '중간·최종✓' : (hasFin ? '최종✓' : '중간✓')) + '</span>');
      if (!mailBadges.length) mailBadges.push('<span class="chip">수신 ' + (sc.totalInCount || 0) + '건</span>');

      var progShort = '<span class="chip c-blue">일터혁신</span>';

      return {
        id: p.id,
        cells: [
          { cls: 'ti', title: p.companyName + ' (' + (p.year || 2026) + '년 일터혁신 상생컨설팅)', html: esc(p.companyName) + ' <span class="chip">' + esc((p.year || 2026) + '년') + '</span> ' + progShort },
          { k: 'badge', html: '<span class="chip c-blue">' + esc(lv.short) + '</span> ' + stageDotsHtml(p) },
          { cls: 'wide', title: taskNames, html: esc(taskNames || '과제 선택 필요') },
          { html: '기초자료 <b>' + chkPre.pct + '%</b> (' + chkPre.requiredDone + '/' + chkPre.requiredTotal + ')' },
          { html: mailBadges.join(' ') },
          {
            k: 'act',
            html: '<button class="sm" data-open-proj="' + esc(p.id) + '" data-open-tab="intake">① 기초체크</button>' +
              '<button class="sm" data-open-proj="' + esc(p.id) + '" data-open-tab="mid">② 중간보고</button>' +
              '<button class="sm pri" data-open-proj="' + esc(p.id) + '" data-open-tab="final">③ 결과·산출물</button>'
          }
        ]
      };
    });

    if ($('projectsBox')) {
      $('projectsBox').innerHTML = renderTable('projects',
        ['사업장명', '단계', '선택 개선과제', '기초자료 충족', '메일 체크 상태', '작업 열기'],
        rows, CUR_PID);
    }

    if ($('discoverCard')) {
      $('discoverCard').style.display = DISCOVER_LIST.length ? '' : 'none';
    }
    if ($('discoverBox') && DISCOVER_LIST.length) {
      var dRows = DISCOVER_LIST.map(function (c) {
        return {
          id: c.candKey,
          cells: [
            { cls: 'ti', title: c.companyName, html: esc(c.companyName) },
            { k: 'badge', html: '<span class="chip c-blue">' + esc(c.source) + '</span>' },
            { html: esc(c.bizNo || '-') },
            { html: esc(c.contactEmail || '이메일 미등록') },
            { k: 'act', html: '<button class="sm pri" data-activate-cand="' + esc(c.candKey) + '">⚡ 활성화</button>' }
          ]
        };
      });
      $('discoverBox').innerHTML = renderTable('discover', ['사업장명', '출처', '사업자번호', '등록 이메일', '활성화'], dRows, '');
    }
  }

  function statusBadgeForChecklist(it) {
    if (it.status === 'analyzed') return '<span class="chip c-green">분석완료 ✓ (' + it.analyzedCount + ')</span>';
    if (it.status === 'manual') return '<span class="chip c-green">수령체크 ✓</span>';
    if (it.status === 'received') return '<span class="chip c-blue">메일수신 📩 (' + it.mailCount + ')</span>';
    return '<span class="chip c-amber">' + (it.required ? '필수 미수신' : '선택 미수신') + '</span>';
  }

  /* ── 탭 2: ① 메일·기초자료 체크 및 비식별 분석 ── */
  function drawIntakePane() {
    var box = $('intakeBox');
    if (!box) return;
    var proj = projectById(CUR_PID);
    if (!proj) {
      box.innerHTML = '<div class="card"><div class="empty">먼저 [📂 사업장 · 메일 감지] 탭에서 사업장을 선택하거나 등록해 주세요.</div></div>';
      return;
    }

    var sc = SCAN_CACHE[proj.id] || { matched: [], nameCandidates: [], unseenPreCount: 0 };
    var preMails = sc.matched.filter(function (m) { return m.phase === 'pre_mid'; });
    var chk = Intake().summarizeChecklistProgress('pre_mid', proj.selectedTasks, D.intake[proj.id] || {}, sc.matched, manualChecksOf(proj, 'pre_mid'));

    var chkRows = chk.items.map(function (it) {
      var toggleLabel = it.manualChecked ? '확인 해제' : '✓ 수령체크';
      var toggleCls = it.manualChecked ? 'sm' : 'sm ok';
      return {
        id: it.code,
        cells: [
          { cls: 'ti', title: it.name, html: esc(it.short) + (it.required ? ' <span class="chip c-blue">필수</span>' : ' <span class="chip">선택</span>') },
          { k: 'badge', html: statusBadgeForChecklist(it) },
          { cls: 'wide', title: it.reason, html: esc(it.reason) },
          { k: 'act', html: '<button class="' + toggleCls + '" data-toggle-chk="' + esc(it.code) + '" data-phase="pre_mid">' + toggleLabel + '</button>' }
        ]
      };
    });

    var candCardHtml = '';
    if (sc.nameCandidates && sc.nameCandidates.length) {
      var candRows = sc.nameCandidates.map(function (cm) {
        return {
          id: cm.key,
          cells: [
            { cls: 'ti', title: cm.subject, html: esc(cm.subject || '(제목 없음)') },
            { k: 'badge', html: '<span class="chip c-amber">상호 후보</span>' },
            { html: esc(cm.fromLabel || cm.from || '-') },
            { html: esc(cm.date || '-') },
            { k: 'act', html: '<button class="sm pri" data-mail-inspect="' + esc(cm.key) + '" data-phase="pre_mid">🔍 확인·연결</button>' }
          ]
        };
      });
      candCardHtml = '<div class="card"><div class="sec">' +
        '<span>🔎 상호 일치 미확정 메일 후보</span>' +
        '<span class="chip c-amber">' + sc.nameCandidates.length + '건</span>' +
        '<span class="sp"></span>' +
        '<span class="hint">발신 주소 미등록 후보 — 확인 후 연결하세요</span>' +
        '</div>' +
        renderTable('candMails', ['후보 메일 제목', '구분', '발신처', '일자', '확인·귀속'], candRows, '') +
        '</div>';
    }

    var mailRows = preMails.map(function (m) {
      var stChip = m.analyzed
        ? '<span class="chip c-green">내용분석 완료</span>'
        : (m.checked ? '<span class="chip c-blue">확인완료</span>' : '<span class="chip c-amber">미확인</span>');
      var attTxt = m.attNames.length ? (' 📎' + m.attNames.join(', ')) : '';
      return {
        id: m.key,
        cells: [
          { cls: 'ti', title: m.subject + attTxt, html: esc(m.subject || '(제목 없음)') + (m.attCount ? ' <span class="chip">📎' + m.attCount + '</span>' : '') },
          { k: 'badge', html: '<span class="chip c-blue">' + esc(m.docKindName) + '</span> ' + stChip },
          { html: esc(m.date || '-') },
          { title: m.fromLabel, html: esc(m.dir === 'out' ? ('발신 → ' + m.toLabel) : m.fromLabel) },
          {
            k: 'act',
            html: '<button class="sm pri" data-mail-inspect="' + esc(m.key) + '" data-phase="pre_mid">🔍 내용확인·분석</button>' +
              (!m.checked ? '<button class="sm" data-mail-check="' + esc(m.key) + '" data-phase="pre_mid">✓ 확인표시</button>' : '')
          }
        ]
      };
    });

    var preCards = Object.keys(D.intake[proj.id] || {}).map(function (k) { return D.intake[proj.id][k]; })
      .filter(function (c) { return c && !c._deleted && (c.phase || 'pre_mid') === 'pre_mid'; })
      .sort(function (a, b) { return (Number(b.updatedAt || 0) - Number(a.updatedAt || 0)); });

    var cardRows = preCards.map(function (c) {
      var dk = Cat().getDocKind(c.docKind) || { short: c.docKind };
      var sumTxt = (Array.isArray(c.summaryLines) && c.summaryLines.length) ? c.summaryLines.join(' / ') : str(c.maskedExcerpt).slice(0, 90);
      return {
        id: c.id,
        cells: [
          { cls: 'ti', title: c.title || dk.short, html: esc(c.title || dk.short) },
          { k: 'badge', html: '<span class="chip c-blue">' + esc(dk.short) + '</span> <span class="chip c-green">' + (c.track === 'quant' ? '로컬통계' : '비식별본문') + '</span>' },
          { cls: 'wide', title: sumTxt, html: esc(sumTxt || '확인 완료') },
          { html: esc(fmtDateTime(c.analyzedAt || c.updatedAt)) },
          { k: 'act', html: '<button class="sm" data-view-card="' + esc(c.id) + '">상세보기</button>' }
        ]
      };
    });

    var dkOptions = '<option value="">자동 분류 (파일명·헤더 기준)</option>' +
      Cat().DOC_KINDS.filter(function (d) { return d.defaultPhase === 'pre_mid'; }).map(function (d) {
        return '<option value="' + esc(d.code) + '"' + (UPLOAD_DOC_KIND === d.code ? ' selected' : '') + '>' + esc(d.name) + '</option>';
      }).join('');

    box.innerHTML =
      projectHeaderBarHtml(proj) +
      candCardHtml +
      '<div class="card">' +
      '<div class="sec">' +
      '<span>📋 착수 기초자료 필수 체크리스트</span>' +
      '<div class="prog-wrap"><div class="prog-fill" style="width:' + chk.pct + '%"></div></div>' +
      '<b>' + chk.pct + '% (' + chk.requiredDone + '/' + chk.requiredTotal + ')</b>' +
      '<span class="sp"></span>' +
      '<button class="sm warn-btn" data-act="req-mail-pre">✉️ 미수신 요청문안</button>' +
      '<button class="sm pri" data-goto-tab="mid">② 중간보고 정리 →</button>' +
      '</div>' +
      renderTable('preChk', ['필수·권장 서류', '수집 상태', '요구 사유 · 연동 기준', '수령 체크'], chkRows, '') +
      '</div>' +

      '<div class="card">' +
      '<div class="sec">' +
      '<span>📩 공용 메일함(370-6@daum.net) 기초자료 감지 내역</span>' +
      '<span class="chip c-amber">미확인 ' + sc.unseenPreCount + '건</span>' +
      '<span class="sp"></span>' +
      '<span class="hint">열람 시 peek 모드로 고객 메일의 읽음 상태를 변경하지 않습니다</span>' +
      '</div>' +
      renderTable('preMails', ['메일 제목 · 첨부', '분류 · 상태', '일자', '송수신처', '내용확인'], mailRows, '') +
      '</div>' +

      '<div class="card">' +
      '<div class="sec">' +
      '<span>📎 개인메일 수신분 · 로컬 파일 직접 첨부 (이원화 무유출 분석)</span>' +
      '<select id="preUploadKind" aria-label="기초자료 서류 종류">' + dkOptions + '</select>' +
      '</div>' +
      '<div class="drop-zone" id="preDropZone" tabindex="0" role="button" aria-label="기초자료 파일 선택 또는 끌어놓기">' +
      '<b>📂 여기에 취업규칙·임금대장·근태기록·인력현황·EOS설문·중간보고서 파일을 끌어다 놓거나 클릭하세요</b>' +
      '<span>지원 형식: .xlsx · .xls · .csv (브라우저 내 비식별 통계만 집계, 원본 성명·주민번호 폐기) / .pptx · .pptm · .ppsx · .hwpx · .hwp · .docx · .pdf · .txt (2중 가림 분석)</span>' +
      '<input type="file" id="preFileInput" multiple accept=".xlsx,.xls,.csv,.pptx,.pptm,.ppsx,.hwpx,.hwp,.docx,.pdf,.txt" style="display:none">' +
      '</div>' +
      '</div>' +

      '<div class="card">' +
      '<div class="sec"><span>✅ 확인 · 비식별 분석 완료 기초자료 카드 (' + preCards.length + '건)</span></div>' +
      renderTable('preCards', ['자료 제목', '분류 · 처리방식', '비식별 핵심 분석 요약', '분석시각', '보기'], cardRows, '') +
      '</div>';

    wireDropZone('preDropZone', 'preFileInput', 'preUploadKind', 'pre_mid');
  }

  /* ── 탭 3: ② 진단·중간보고서 자동화 + 회차 인정기준 관리 ── */
  function drawMidPane() {
    var box = $('midBox');
    if (!box) return;
    var proj = projectById(CUR_PID);
    if (!proj) {
      box.innerHTML = '<div class="card"><div class="empty">먼저 사업장을 선택해 주세요.</div></div>';
      return;
    }

    var schedRds = schedRoundsForProject(proj);
    var savedMid = D.mid[proj.id] || null;
    var computedMid = Report().buildMidReport(proj, D.intake[proj.id] || {}, schedRds, savedMid);
    var secs = (savedMid && savedMid.sections) ? Object.assign({}, computedMid.sections, savedMid.sections) : computedMid.sections;
    var locks = (savedMid && savedMid.locks) || {};
    var iv = proj.interviews || {};
    var eosBars = (computedMid.structured && computedMid.structured.eosAreaBars) || [];
    var rc = (computedMid.structured && computedMid.structured.roundCheck) || Report().normalizeRounds(proj, schedRds, {});

    var eosHtml = eosBars.map(function (b) {
      var pct = Math.max(4, Math.min(100, Math.round((Number(b.score || 0) / 5) * 100)));
      var benchPct = Math.max(4, Math.min(100, Math.round((Number(b.bench || 3.5) / 5) * 100)));
      var isLow = Number(b.gap || 0) < -0.1;
      return '<div class="eos-row">' +
        '<div class="eos-lbl" title="' + esc(b.label) + '">' + esc(b.label) + '</div>' +
        '<div class="eos-track"><div class="eos-fill' + (isLow ? ' low' : '') + '" style="width:' + pct + '%"></div>' +
        '<div class="eos-bench" style="left:' + benchPct + '%" title="업종 준거 ' + b.bench + '점"></div></div>' +
        '<div class="eos-num">' + Number(b.score || 0).toFixed(2) + ' / 준거 ' + Number(b.bench || 0).toFixed(2) + '</div>' +
        '</div>';
    }).join('');

    var roundRows = rc.rounds.map(function (r) {
      var modeChip = r.mode === 'remote'
        ? '<span class="chip">비대면(화상)</span>'
        : '<span class="chip c-blue">대면(현장)</span>';
      var proofOk = r.hasPhoto && r.hasSign;
      var proofChip = proofOk
        ? '<span class="chip c-green">사진·서명 완료 ✓</span>'
        : '<span class="chip c-amber">' + (!r.hasPhoto && !r.hasSign ? '사진·서명 대기' : (!r.hasPhoto ? '사진 대기' : '서명 대기')) + '</span>';
      var ruleWarn = (r.mins < 120 || r.companyPeople < 3)
        ? ' <span class="chip c-red">기준 미달⚠</span>'
        : '';
      return {
        id: String(r.roundNo),
        cells: [
          { cls: 'ti', title: r.topic, html: r.roundNo + '회차 · ' + esc(r.topic) },
          { k: 'badge', html: modeChip + ' ' + proofChip + ruleWarn },
          { html: esc(r.date) + ' · ' + r.mins + '분 · 기업 ' + r.companyPeople + '명' },
          {
            k: 'act',
            html: '<button class="sm" data-edit-round="' + r.roundNo + '">편집</button>' +
              '<button class="sm ' + (proofOk ? '' : 'ok') + '" data-toggle-round-proof="' + r.roundNo + '">' + (proofOk ? '증빙해제' : '✓ 증빙완료') + '</button>'
          }
        ]
      };
    });

    box.innerHTML =
      projectHeaderBarHtml(proj) +
      (proj.midConfirmedAt
        ? '<div class="ok-banner">📌 <b>중간보고 기준선이 확정되었습니다</b> (' + esc(fmtDateTime(proj.midConfirmedAt)) + '). 이후 수신되는 메일은 자동으로 [③ 후속메일·결과보고] 단계로 분류됩니다.</div>'
        : '<div class="note">수집된 기초자료 비식별 통계·규정 이슈·인터뷰 메모·회차 기록을 바탕으로 <b>사업장 중간보고서 7개 표준 섹션과 발표용 PPTX</b>를 자동 생성합니다.</div>') +

      '<div class="card">' +
      '<div class="sec">' +
      '<span>🗓️ 컨설팅 회차별 수행 · 재단 인정기준 점검</span>' +
      '<span class="chip ' + (rc.faceMet ? 'c-green' : 'c-amber') + '">대면 ' + rc.facePct + '% (' + rc.faceCount + '/' + rc.totalCount + ')</span>' +
      '<span class="chip ' + (rc.allTimeAndPeopleMet ? 'c-green' : 'c-amber') + '">' + (rc.allTimeAndPeopleMet ? '120분·3인+ 충족✓' : '시간·인원 점검⚠') + '</span>' +
      '<span class="chip c-blue">증빙 ' + rc.proofReadyCount + '/' + rc.totalCount + '</span>' +
      '<span class="sp"></span>' +
      '<button class="sm pri" data-act="add-round">+ 회차 추가</button>' +
      '</div>' +
      renderTable('rounds', ['회차 · 핵심 수행주제', '방식 · 증빙 상태', '수행일 · 시간 · 참석', '관리'], roundRows, '') +
      '</div>' +

      '<div class="card">' +
      '<div class="sec">' +
      '<span>🗣️ 계층별 심층 인터뷰 핵심 메모 (중간보고서 5절 & PPT 자동 반영)</span>' +
      '<span class="sp"></span>' +
      '<button class="sm ok" data-act="save-interviews">💾 인터뷰 저장</button>' +
      '</div>' +
      '<div class="iv-grid">' +
      '<div class="iv-col"><label for="ivExec">경영진 (사용자 대표) 핵심 의견</label><textarea id="ivExec" rows="3" placeholder="예: 업무집중도 향상 전제로 격주 금요일 단축 긍정 검토, 통상임금 법적 리스크 정비 희망">' + esc(iv.exec || '') + '</textarea></div>' +
      '<div class="iv-col"><label for="ivHr">인사·노무 실무담당 핵심 의견</label><textarea id="ivHr" rows="3" placeholder="예: 연장근로 사전승인 기준 부재로 관리 애로, 취업규칙·근로계약서 일괄 현행화 요청">' + esc(iv.hr || '') + '</textarea></div>' +
      '<div class="iv-col"><label for="ivWorker">근로자대표·현장근로자 핵심 의견</label><textarea id="ivWorker" rows="3" placeholder="예: 임금 감소 없는 근로시간 단축 희망, 자유로운 연차 사용 문화 및 투명한 수당 산정 요청">' + esc(iv.worker || '') + '</textarea></div>' +
      '</div></div>' +

      '<div class="card">' +
      '<div class="sec"><span>📊 전 근로자 조직진단(EOS) 5대 영역 점수 대 업종 준거집단 미리보기</span></div>' +
      '<div class="eos-bars">' + eosHtml + '</div>' +
      '</div>' +

      '<div class="card">' +
      '<div class="bar">' +
      '<button class="sm pri" data-act="regen-mid">⚡ 자동정리</button>' +
      '<button class="sm" data-act="preview-mid-pptx">👁️ PPT 미리보기</button>' +
      '<button class="sm ok" data-act="dl-mid-pptx">📊 중간 PPTX</button>' +
      '<button class="sm warn-btn" data-act="open-platform-modal">📋 플랫폼 문안</button>' +
      '<span class="sp"></span>' +
      '<button class="sm pri" data-act="confirm-mid-baseline" title="중간보고 기준선 확정 및 후속메일 감시 시작">📌 기준선 확정</button>' +
      '</div>' +
      renderSectionList('midSecs', '중간보고서 7개 표준 섹션 원고 (체크하여 일괄 저장·고정 가능)', Cat().MID_SECTIONS, secs, locks, 'mid', 'c-blue') +
      '</div>';
  }

  /* ── 탭 4: ③ 후속 메일 확인 · 결과보고서 · 별첨 6종 패키지 · 3개월 사후관리 ── */
  function drawFinalPane() {
    var box = $('finalBox');
    if (!box) return;
    var proj = projectById(CUR_PID);
    if (!proj) {
      box.innerHTML = '<div class="card"><div class="empty">먼저 사업장을 선택해 주세요.</div></div>';
      return;
    }

    var schedRds = schedRoundsForProject(proj);
    var sc = SCAN_CACHE[proj.id] || { matched: [], unseenPostCount: 0 };
    var postMails = sc.matched.filter(function (m) { return m.phase === 'post_mid'; });
    var chkPost = Intake().summarizeChecklistProgress('post_mid', proj.selectedTasks, D.intake[proj.id] || {}, sc.matched, manualChecksOf(proj, 'post_mid'));
    var savedMid = D.mid[proj.id] || null;
    var computedMid = Report().buildMidReport(proj, D.intake[proj.id] || {}, schedRds, savedMid);
    var savedFinal = D.final[proj.id] || null;
    var computedFinal = Report().buildFinalReport(proj, computedMid, D.intake[proj.id] || {}, schedRds, savedFinal);
    var secs = (savedFinal && savedFinal.sections) ? Object.assign({}, computedFinal.sections, savedFinal.sections) : computedFinal.sections;
    var locks = (savedFinal && savedFinal.locks) || {};

    var chkPostRows = chkPost.items.map(function (it) {
      var toggleLabel = it.manualChecked ? '확인 해제' : '✓ 수령체크';
      var toggleCls = it.manualChecked ? 'sm' : 'sm ok';
      return {
        id: it.code,
        cells: [
          { cls: 'ti', title: it.name, html: esc(it.short) + (it.required ? ' <span class="chip c-green">필수</span>' : ' <span class="chip">선택</span>') },
          { k: 'badge', html: statusBadgeForChecklist(it) },
          { cls: 'wide', title: it.reason, html: esc(it.reason) },
          { k: 'act', html: '<button class="' + toggleCls + '" data-toggle-chk="' + esc(it.code) + '" data-phase="post_mid">' + toggleLabel + '</button>' }
        ]
      };
    });

    var postMailRows = postMails.map(function (m) {
      var stChip = m.analyzed
        ? '<span class="chip c-green">Diff 분석완료</span>'
        : (m.checked ? '<span class="chip c-blue">확인완료</span>' : '<span class="chip c-amber">미확인</span>');
      return {
        id: m.key,
        cells: [
          { cls: 'ti', title: m.subject, html: esc(m.subject || '(제목 없음)') + (m.attCount ? ' <span class="chip">📎' + m.attCount + '</span>' : '') },
          { k: 'badge', html: '<span class="chip c-green">' + esc(m.docKindName) + '</span> ' + stChip },
          { html: esc(m.date || '-') },
          { html: esc(m.dir === 'out' ? ('발신 → ' + m.toLabel) : m.fromLabel) },
          {
            k: 'act',
            html: '<button class="sm pri" data-mail-inspect="' + esc(m.key) + '" data-phase="post_mid">🔍 내용확인·Diff</button>' +
              (!m.checked ? '<button class="sm" data-mail-check="' + esc(m.key) + '" data-phase="post_mid">✓ 확인표시</button>' : '')
          }
        ]
      };
    });

    var diffObjs = (computedFinal.structured && computedFinal.structured.diffObjects) || [];
    var diffTableRows = diffObjs.map(function (d) {
      var isHold = /보류|협의중/.test(str(d.status));
      var stChip = '<span class="chip ' + (isHold ? 'c-amber' : 'c-green') + '">' + esc(d.status) + '</span>';
      return {
        id: d.id,
        cells: [
          { cls: 'ti', title: d.area, html: esc(d.area) + (d.custom ? ' <span class="chip">수기</span>' : '') },
          { k: 'badge', html: stChip },
          { title: d.baseVal, html: esc(d.baseVal) },
          { cls: 'wide', title: d.finalVal, html: '<b>' + esc(d.finalVal) + '</b>' },
          { k: 'act', html: '<button class="sm" data-edit-diff="' + esc(d.id) + '">편집</button>' }
        ]
      };
    });

    var postDkOptions = '<option value="">자동 분류 (피드백·투표·서명지·보완시뮬레이션)</option>' +
      Cat().DOC_KINDS.filter(function (d) { return d.defaultPhase === 'post_mid' || d.code === 'wage_ledger'; }).map(function (d) {
        return '<option value="' + esc(d.code) + '"' + (POST_UPLOAD_DOC_KIND === d.code ? ' selected' : '') + '>' + esc(d.name) + '</option>';
      }).join('');

    var postCards = Object.keys(D.intake[proj.id] || {}).map(function (k) { return D.intake[proj.id][k]; })
      .filter(function (c) { return c && !c._deleted && c.phase === 'post_mid'; })
      .sort(function (a, b) { return (Number(b.updatedAt || 0) - Number(a.updatedAt || 0)); });

    var postCardRows = postCards.map(function (c) {
      var dk = Cat().getDocKind(c.docKind) || { short: c.docKind };
      var sumTxt = (Array.isArray(c.summaryLines) && c.summaryLines.length) ? c.summaryLines.join(' / ') : str(c.maskedExcerpt).slice(0, 90);
      return {
        id: c.id,
        cells: [
          { cls: 'ti', title: c.title || dk.short, html: esc(c.title || dk.short) },
          { k: 'badge', html: '<span class="chip c-green">' + esc(dk.short) + '</span>' },
          { cls: 'wide', title: sumTxt, html: esc(sumTxt || '후속 확인 완료') },
          { html: esc(fmtDateTime(c.analyzedAt || c.updatedAt)) },
          { k: 'act', html: '<button class="sm" data-view-card="' + esc(c.id) + '">상세보기</button>' }
        ]
      };
    });

    var safeCo = Pack() ? Pack().safeFilePart(proj.companyName) : safeKey(proj.companyName);
    var deliverableSpecs = [
      { id: 'mid_pptx', title: '01_' + safeCo + '_일터혁신_중간보고서.pptx', fmt: 'PPTX', desc: '7개 표준 섹션 + EOS 5대·16개 세부영역 격차 발표 슬라이드', actHtml: '<button class="sm" data-act="preview-mid-pptx">👁️ 미리보기</button><button class="sm ok" data-act="dl-mid-pptx">다운로드</button>' },
      { id: 'final_pptx', title: '02_' + safeCo + '_일터혁신_최종결과보고서.pptx', fmt: 'PPTX', desc: '중간보고 기준선 Diff + 개선설계 + 모의계산 + 이행로드맵 발표 슬라이드', actHtml: '<button class="sm" data-act="preview-final-pptx">👁️ 미리보기</button><button class="sm ok" data-act="dl-final-pptx">다운로드</button>' },
      { id: 'rules_docx', title: '03_' + safeCo + '_취업규칙개정안_신구대조표.docx', fmt: 'DOCX', desc: '선택 과제·합의사항 반영 조문별 현행/개정안 신구대조표 + 제94조 동의서', actHtml: '<button class="sm ok" data-act="dl-rules-docx">다운로드</button>' },
      { id: 'contract_docx', title: '04_' + safeCo + '_표준근로계약서_서면합의동의서.docx', fmt: 'DOCX', desc: '확정 근무시간·임금항목 반영 표준 근로계약서 + 근로자대표 서면합의서', actHtml: '<button class="sm ok" data-act="dl-contract-docx">다운로드</button>' },
      { id: 'sim_xlsx', title: '05_' + safeCo + '_통상시급모의계산_신구대조_이행점검표.xlsx', fmt: 'XLSX', desc: '회차점검·비식별 모의계산·EOS 16문항·후속 Diff·신구대조·3개월 사후점검 6개 시트', actHtml: '<button class="sm ok" data-act="dl-sim-xlsx">다운로드</button>' },
      { id: 'platform_txt', title: '06_' + safeCo + '_노사발전재단_플랫폼입력문안_3종.txt', fmt: 'TXT', desc: '수행계획서 · 전 회차 수행보고서 · 종료 후 3개월 이행결과표 입력 문안', actHtml: '<button class="sm" data-act="open-platform-modal">👁️ 문안보기</button><button class="sm ok" data-act="dl-platform-txt">다운로드</button>' }
    ];
    var delivRows = deliverableSpecs.map(function (sp) {
      return {
        id: sp.id,
        cells: [
          { cls: 'ti', title: sp.title, html: esc(sp.title) },
          { k: 'badge', html: '<span class="chip c-blue">' + esc(sp.fmt) + '</span>' },
          { cls: 'wide', title: sp.desc, html: esc(sp.desc) },
          { k: 'act', html: sp.actHtml }
        ]
      };
    });

    var fuMap = (proj.followupChecks && typeof proj.followupChecks === 'object') ? proj.followupChecks : {};
    var fuList = Cat().FOLLOWUP_ITEMS || [];
    var fuDoneCnt = fuList.filter(function (f) { return !!fuMap[f.code]; }).length;
    var fuPct = fuList.length ? Math.round((fuDoneCnt / fuList.length) * 100) : 0;
    var fuRows = fuList.map(function (f) {
      var done = !!fuMap[f.code];
      return {
        id: f.code,
        cells: [
          { cls: 'ti', title: f.title, html: '[' + esc(f.month) + '] ' + esc(f.title) },
          { k: 'badge', html: done ? '<span class="chip c-green">이행완료 ✓</span>' : '<span class="chip c-amber">점검예정</span>' },
          { cls: 'wide', title: f.proof, html: '증빙: ' + esc(f.proof) },
          { k: 'act', html: '<button class="sm ' + (done ? '' : 'ok') + '" data-toggle-followup="' + esc(f.code) + '">' + (done ? '예정으로' : '✓ 이행완료') + '</button>' }
        ]
      };
    });

    box.innerHTML =
      projectHeaderBarHtml(proj) +
      '<div class="card">' +
      '<div class="sec">' +
      '<span>📬 중간보고 이후 후속 자료 체크리스트</span>' +
      '<div class="prog-wrap"><div class="prog-fill" style="width:' + chkPost.pct + '%"></div></div>' +
      '<b>' + chkPost.pct + '% (' + chkPost.requiredDone + '/' + chkPost.requiredTotal + ')</b>' +
      '<span class="sp"></span>' +
      '<button class="sm warn-btn" data-act="req-mail-post">✉️ 보완요청 문안</button>' +
      '</div>' +
      renderTable('postChk', ['후속 필수·권장 서류', '수집 상태', '요구 사유 · 반영처', '수령 체크'], chkPostRows, '') +
      '</div>' +

      '<div class="card">' +
      '<div class="sec">' +
      '<span>📬 후속 수신 메일함 (피드백 · 협의록 · 회차사진/서명지 · 찬반투표)</span>' +
      '<span class="chip c-green">미확인 ' + sc.unseenPostCount + '건</span>' +
      '</div>' +
      renderTable('postMails', ['메일 제목 · 첨부', '분류 · 상태', '일자', '송수신처', '내용확인·Diff'], postMailRows, '') +
      '<div class="sec">' +
      '<span>📎 후속 협의록 · 찬반투표 · 회차서명지 직접 첨부 분석</span>' +
      '<select id="postUploadKind" aria-label="후속자료 서류 종류">' + postDkOptions + '</select>' +
      '</div>' +
      '<div class="drop-zone" id="postDropZone" tabindex="0" role="button" aria-label="후속자료 파일 선택 또는 끌어놓기">' +
      '<b>📂 중간보고 이후 받은 디자인팀 피드백·보완 시뮬레이션·찬반투표 집계표·서명지·최종보고서를 끌어다 놓으세요</b>' +
      '<span>채택 모델 · 임금보전 합의 · 시행일 · 찬성률(%) · 수정요청사항을 자동 추출하여 최종 결과보고서 및 규정·계약서에 반영합니다</span>' +
      '<input type="file" id="postFileInput" multiple accept=".xlsx,.xls,.csv,.pptx,.pptm,.ppsx,.hwpx,.hwp,.docx,.pdf,.txt,.jpg,.jpeg,.png" style="display:none">' +
      '</div>' +
      (postCards.length ? renderTable('postCards', ['후속자료 제목', '분류', '추출된 합의·변경점 요약', '분석시각', '보기'], postCardRows, '') : '') +
      '</div>' +

      '<div class="card">' +
      '<div class="sec">' +
      '<span>🔄 중간보고 기준선 대비 후속 합의·변경 내역 (Diff 대조표)</span>' +
      '<span class="sp"></span>' +
      '<button class="sm pri" data-act="add-diff">+ 합의사항 추가</button>' +
      '</div>' +
      renderTable('diffRows', ['협의 영역', '상태', '중간보고 기준선', '후속 협의 · 최종 확정안', '편집'], diffTableRows, '') +
      '</div>' +

      '<div class="card">' +
      '<div class="sec">' +
      '<span>📦 별첨 최종산출물 패키지 6종 (PPTX · 취업규칙 DOCX · 계약서 DOCX · 모의계산 XLSX · 플랫폼 문안)</span>' +
      '<span class="sp"></span>' +
      '<button class="sm pri" data-act="dl-full-zip">📦 6종 통합 ZIP</button>' +
      '</div>' +
      renderTable('deliverables', ['산출물 파일명', '형식', '수록 내용', '미리보기 · 다운로드'], delivRows, '') +
      '</div>' +

      '<div class="card">' +
      '<div class="bar">' +
      '<button class="sm pri" data-act="regen-final" title="기준선 + 후속 메일 Diff → 최종 결과보고서 자동 조립">⚡ 결과보고 조립</button>' +
      '<button class="sm" data-act="preview-final-pptx">👁️ PPT 미리보기</button>' +
      '<button class="sm ok" data-act="dl-final-pptx">📊 결과 PPTX</button>' +
      '<button class="sm warn-btn" data-act="open-platform-modal">📋 플랫폼 문안</button>' +
      '<span class="sp"></span>' +
      '<button class="sm pri" data-act="confirm-final-snapshot">📌 최종 확정</button>' +
      '</div>' +
      renderSectionList('finalSecs', '최종 결과보고서 7개 표준 섹션 원고 (체크하여 일괄 저장·고정 가능)', Cat().FINAL_SECTIONS, secs, locks, 'final', 'c-green') +
      '</div>' +

      '<div class="card">' +
      '<div class="sec">' +
      '<span>🛡️ 컨설팅 종료 후 3개월 사후 이행관리 · 증빙 점검표</span>' +
      '<div class="prog-wrap"><div class="prog-fill" style="width:' + fuPct + '%"></div></div>' +
      '<b>' + fuPct + '% (' + fuDoneCnt + '/' + fuList.length + ')</b>' +
      '<span class="sp"></span>' +
      '<button class="sm warn-btn" data-act="open-platform-modal">📋 이행결과표 문안</button>' +
      '</div>' +
      renderTable('followups', ['차수 · 사후 이행 점검 항목', '상태', '필수 구비 증빙', '체크'], fuRows, '') +
      '</div>';

    wireDropZone('postDropZone', 'postFileInput', 'postUploadKind', 'post_mid');
  }

  /* ══ 4. 로컬 파일(XLSX/CSV/HWPX/HWP/DOCX/PDF/TXT) 및 메일 실시간 열람·분석 ═ */
  function wireDropZone(zoneId, inputId, selectId, phase) {
    var dz = $(zoneId), inp = $(inputId), sel = $(selectId);
    if (!dz || !inp) return;
    if (sel) {
      sel.onchange = function () {
        if (phase === 'post_mid') POST_UPLOAD_DOC_KIND = sel.value;
        else UPLOAD_DOC_KIND = sel.value;
      };
    }
    dz.onclick = function () { inp.click(); };
    dz.onkeydown = function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inp.click(); }
    };
    dz.ondragover = function (e) { e.preventDefault(); dz.classList.add('drag'); };
    dz.ondragleave = function () { dz.classList.remove('drag'); };
    dz.ondrop = function (e) {
      e.preventDefault();
      dz.classList.remove('drag');
      var files = e.dataTransfer && e.dataTransfer.files;
      if (files && files.length) handleLocalFiles(files, sel ? sel.value : '', phase);
    };
    inp.onchange = function () {
      if (inp.files && inp.files.length) handleLocalFiles(inp.files, sel ? sel.value : '', phase);
      inp.value = '';
    };
  }

  function projectNamesList(proj) {
    var list = [];
    if (proj && proj.companyName) list.push({ v: proj.companyName, as: '[해당 기업]' });
    if (proj && proj.ceoName) list.push({ v: proj.ceoName, as: '[대표자]' });
    if (proj && proj.contactName) list.push({ v: proj.contactName, as: '[담당자]' });
    return list;
  }

  function formatSafeErrorLabel(rawVal, proj) {
    var s = str(rawVal);
    if (!s) return '';
    var txt = Intake().maskPiiStrict(s, projectNamesList(proj)).text;
    if (typeof Intake().maskStandaloneNamesInLabel === 'function') {
      txt = Intake().maskStandaloneNamesInLabel(txt);
    }
    for (var i = 0; i < 3 && Intake().hasResidualPii(txt); i++) {
      txt = Intake().maskPiiStrict(txt, []).text;
    }
    var corpBack = (proj && proj.companyName) ? [{ as: '[해당 기업]', v: str(proj.companyName) }] : [];
    return Intake().unmaskNames(txt, corpBack);
  }

  async function redactWithKordocFailClosed(rawStr) {
    var s = str(rawStr);
    if (!s) return '';
    if (!global.PuKordocText || typeof global.PuKordocText.redactFile !== 'function') {
      throw new Error('개인정보 1차 가림 모듈(kordoc)이 준비되지 않아 저장을 차단했습니다.');
    }
    var kr = await global.PuKordocText.redactFile(null, s, ['rrn', 'money', 'phone', 'email', 'id', 'person']);
    if (!kr || typeof kr.text !== 'string') {
      throw new Error('개인정보 1차 가림(kordoc) 실행에 실패하여 저장을 차단했습니다.');
    }
    return kr.text;
  }

  async function sanitizeMetaLabelAsync(rawVal, proj, opts) {
    var s = str(rawVal);
    if (!s) return '';
    var isSentence = !!(opts && opts.sentence);
    var pre = Intake().maskPiiStrict(s, projectNamesList(proj)).text;
    var kd = await redactWithKordocFailClosed(pre);
    var txt = Intake().maskPiiStrict(kd, []).text;
    if (!isSentence && typeof Intake().maskStandaloneNamesInLabel === 'function') {
      txt = Intake().maskStandaloneNamesInLabel(txt);
    }
    for (var i = 0; i < 3 && (Intake().hasResidualPii(txt) || (!isSentence && typeof Intake().hasStandaloneNameInLabel === 'function' && Intake().hasStandaloneNameInLabel(txt))); i++) {
      txt = Intake().maskPiiStrict(txt, []).text;
      if (!isSentence && typeof Intake().maskStandaloneNamesInLabel === 'function') {
        txt = Intake().maskStandaloneNamesInLabel(txt);
      }
    }
    var indepLeak = typeof Intake().hasIndependentPersonAuditLeak === 'function' && Intake().hasIndependentPersonAuditLeak(txt);
    var standaloneLeak = !isSentence && typeof Intake().hasStandaloneNameInLabel === 'function' && Intake().hasStandaloneNameInLabel(txt);
    if (Intake().hasResidualPii(txt) || indepLeak || standaloneLeak) {
      throw new Error('입력 내용·제목·파일명에 해제되지 않은 민감 식별정보 패턴이 포함되어 저장을 차단했습니다.');
    }
    var corpBack = (proj && proj.companyName) ? [{ as: '[해당 기업]', v: str(proj.companyName) }] : [];
    return Intake().unmaskNames(txt, corpBack);
  }

  function contactNameOfCompany(co) {
    if (!co || typeof co !== 'object') return '';
    if (str(co.contactName || co.manager || co.managerName)) return str(co.contactName || co.manager || co.managerName);
    if (Array.isArray(co.contacts) && co.contacts.length && co.contacts[0]) return str(co.contacts[0].name);
    return '';
  }

  async function handleLocalFiles(fileList, forcedDocKind, phase) {
    var proj = projectById(CUR_PID);
    if (!proj) return;
    var files = Array.prototype.slice.call(fileList || []);
    var okCnt = 0;
    toast('파일 ' + files.length + '건 로컬 비식별 분석 중…');

    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      var errLabel = formatSafeErrorLabel(f.name, proj);
      try {
        var isSlideDeck = /\.(pptx|pptm|ppsx)$/i.test(str(f.name));
        var maxBytes = isSlideDeck ? (40 * 1024 * 1024) : (15 * 1024 * 1024);
        if (Number(f.size || 0) > maxBytes) {
          throw new Error('파일 크기가 ' + (isSlideDeck ? '40MB' : '15MB') + '를 초과하여 브라우저 분석을 생략했습니다.');
        }
        var safeTitle = await sanitizeMetaLabelAsync(f.name, proj);
        var buf = await f.arrayBuffer();
        var bytes = new Uint8Array(buf);
        var analyzed = await analyzeAttachmentBytes(f.name, bytes, proj, forcedDocKind, phase);
        if (analyzed) {
          await saveIntakeCard(proj, Object.assign({
            source: 'upload',
            title: safeTitle,
            attNames: [safeTitle],
            phase: phase,
            checkedAt: Date.now(),
            analyzedAt: Date.now()
          }, analyzed));
          okCnt++;
        }
      } catch (e) {
        toast('파일 분석 오류 (' + errLabel + '): ' + (e.message || e));
      }
    }
    rebuildScanAndDiscover();
    draw();
    if (okCnt > 0) toast(okCnt + '건 비식별 분석 및 카드 반영 완료');
  }

  async function analyzeAttachmentBytes(fileName, bytes, proj, forcedDocKind, phase) {
    var lower = str(fileName).toLowerCase();
    var explicitDk = forcedDocKind ? Cat().getDocKind(forcedDocKind) : null;
    var safeFileName = await sanitizeMetaLabelAsync(fileName, proj);

    if (/\.(jpg|jpeg|png|webp)$/.test(lower)) {
      var diffMeta = Intake().extractPostMidDiff('타임스탬프 회의 사진 첨부 확인', safeFileName, [safeFileName]);
      return {
        docKind: forcedDocKind || 'round_proof',
        track: 'meta',
        piiStripped: true,
        maskedExcerpt: '',
        stats: null,
        policyIssues: [],
        postDiff: phase === 'post_mid' ? diffMeta : null,
        summaryLines: ['회차 수행 사진 증빙 확인 (' + safeFileName + ')']
      };
    }

    var excelTextFallback = '';
    var resolvedNonQuantKind = explicitDk ? explicitDk.code : '';
    if (/\.(xlsx|xls|csv)$/.test(lower) && global.XLSX) {
      var wb = global.XLSX.read(bytes, { type: 'array' });
      var sheetMap = {};
      (wb.SheetNames || []).forEach(function (sn) {
        sheetMap[sn] = global.XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: '' });
      });
      var hasSensCols = Intake().hasSensitiveTableHeaders(sheetMap);
      var isExplicitNonQuant = !!(explicitDk && explicitDk.track !== 'quant');

      if (isExplicitNonQuant && hasSensCols) {
        throw new Error('성명·주민번호·임금 등 민감 인사·임금 열이 포함된 엑셀은 비정량 텍스트 서류로 업로드할 수 없습니다. 정량 서류 종류를 선택해 주세요.');
      }

      if (!isExplicitNonQuant) {
        var projNames = projectNamesList(proj);
        var tabRes = Intake().analyzeTabularRows(sheetMap, explicitDk ? explicitDk.code : '', {
          level: proj.level,
          totalWorkers: proj.workerCount,
          baseYear: proj.year || 2026,
          fileName: safeFileName,
          names: projNames
        });
        if (tabRes && tabRes.ok) {
          var auditedQuant = await Intake().auditQuantResultAsync(tabRes, {
            names: projNames,
            redactFn: redactWithKordocFailClosed,
            auditFn: function (txt) {
              var indep = typeof Intake().hasIndependentPersonAuditLeak === 'function' && Intake().hasIndependentPersonAuditLeak(txt);
              return !Intake().hasResidualPii(txt) && !indep;
            }
          });
          if (!auditedQuant || !auditedQuant.ok) {
            throw new Error((auditedQuant && auditedQuant.error) || '정량 통계의 자유문자 항목에 민감 식별정보 패턴이 감지되어 저장을 차단했습니다.');
          }
          var corpBackQuant = (proj && proj.companyName) ? [{ as: '[해당 기업]', v: str(proj.companyName) }] : [];
          return {
            docKind: auditedQuant.docKind,
            track: 'quant',
            piiStripped: true,
            maskedExcerpt: '',
            stats: auditedQuant.stats,
            policyIssues: [],
            postDiff: null,
            summaryLines: (auditedQuant.summaryLines || []).map(function (ln) {
              return Intake().unmaskNames(ln, corpBackQuant);
            })
          };
        }
        if (hasSensCols || (tabRes && !tabRes.nonQuant)) {
          throw new Error((tabRes && tabRes.error) || '정량 엑셀의 필수 열 구성을 확인해 주세요.');
        }
        if (tabRes && tabRes.docKind) resolvedNonQuantKind = tabRes.docKind;
      }

      excelTextFallback = Object.keys(sheetMap).map(function (sn) {
        var rows = (sheetMap[sn] || []).slice(0, 200).map(function (r) {
          return (Array.isArray(r) ? r : []).map(str).filter(Boolean).join(' ');
        }).filter(Boolean).join('\n');
        return '[' + sn + ']\n' + rows;
      }).join('\n');
    }

    var rawText = excelTextFallback || (await extractDocumentPlainText(fileName, bytes));
    if (!rawText.trim()) {
      rawText = '첨부파일명 확인: ' + safeFileName;
    }
    var stage1Doc = await redactWithKordocFailClosed(rawText);
    var txtRes = Intake().sanitizeAndAnalyzeText(stage1Doc, {
      companyName: proj.companyName,
      ceoName: proj.ceoName,
      contactName: proj.contactName,
      docKind: resolvedNonQuantKind,
      phase: phase,
      midConfirmedAt: proj.midConfirmedAt,
      subject: safeFileName,
      attNames: [safeFileName]
    });
    if (txtRes.leakBlocked) {
      throw new Error('민감 고유식별정보 잔존 패턴이 감지되어 저장을 차단했습니다.');
    }
    return {
      docKind: txtRes.docKind,
      track: txtRes.track,
      piiStripped: true,
      maskedExcerpt: txtRes.maskedExcerpt,
      stats: null,
      policyIssues: txtRes.policyIssues || [],
      postDiff: txtRes.postDiff || null,
      summaryLines: txtRes.summaryLines || []
    };
  }

  async function extractDocumentPlainText(fileName, bytes) {
    var lower = str(fileName).toLowerCase();
    if (/\.(txt|md|log)$/.test(lower)) {
      return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    }
    if (/\.(pptx|pptm|ppsx)$/.test(lower) && Intake().extractPptxText) {
      try {
        var pptTxt = await Intake().extractPptxText(bytes, global.JSZip);
        if (pptTxt) return pptTxt;
      } catch (e) {}
    }
    if (global.PuKordocText && typeof global.PuKordocText.read === 'function' && /\.(hwpx|hwp|docx)$/.test(lower)) {
      try {
        var kr = await global.PuKordocText.read(bytes);
        if (kr && kr.text) return kr.text;
      } catch (e) {}
    }
    if (/\.hwpx$/.test(lower) && global.PuHwpx && typeof global.PuHwpx.extractText === 'function') {
      try { return await global.PuHwpx.extractText(bytes); } catch (e) {}
    }
    if (/\.hwp$/.test(lower) && global.PuHwp && typeof global.PuHwp.extractText === 'function') {
      try { return await global.PuHwp.extractText(bytes); } catch (e) {}
    }
    if (/\.pdf$/.test(lower) && global.pdfjsLib) {
      try {
        /* ★ CVE-2024-4367 방지: PDF 글꼴 렌더링 시 eval 실행 차단 필수 */
        var pdf = await global.pdfjsLib.getDocument({ data: bytes, isEvalSupported: false }).promise;
        var pages = [];
        var lim = Math.min(pdf.numPages, 25);
        for (var p = 1; p <= lim; p++) {
          var page = await pdf.getPage(p);
          var tc = await page.getTextContent();
          pages.push((tc.items || []).map(function (it) { return it.str || ''; }).join(' '));
        }
        return pages.join('\n');
      } catch (e) {}
    }
    return '';
  }

  /* ── 메일 서버 peek 열람 및 첨부 자동 분석 ── */
  async function callMailFn(fnName, payload) {
    var u = fb && fb.auth && fb.auth().currentUser;
    if (!u) throw new Error('로그인이 필요합니다.');
    var tok = await u.getIdToken();
    var res = await fetch(MAIL_FN_BASE + fnName, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok },
      body: JSON.stringify(payload || {})
    });
    var j = await res.json().catch(function () { return null; });
    if (!res.ok || !j || j.ok !== true) {
      throw new Error((j && j.error) || ('메일 서버 응답 오류 (' + res.status + ')'));
    }
    return j;
  }

  function htmlToPlainText(rawHtml) {
    var s = String(rawHtml == null ? '' : rawHtml);
    if (!s) return '';
    if (typeof DOMParser !== 'undefined') {
      var doc = new DOMParser().parseFromString(s, 'text/html');
      doc.querySelectorAll('script,style,noscript,template,iframe,object,embed').forEach(function (el) {
        if (el && el.parentNode) el.parentNode.removeChild(el);
      });
      return str((doc.body && doc.body.textContent) || '');
    }
    return str(s.replace(/<[^>]+>/g, ' '));
  }

  function findMailRowByKey(projId, mailKey) {
    var sc = SCAN_CACHE[projId];
    if (sc) {
      var hit = sc.matched.find(function (m) { return m.key === mailKey; })
        || (sc.nameCandidates || []).find(function (m) { return m.key === mailKey; });
      if (hit) return hit;
    }
    return D.flatMails.find(function (m) { return m.key === mailKey; }) || null;
  }

  async function inspectAndAnalyzeMail(mailKey, phase, silent) {
    var proj = projectById(CUR_PID);
    if (!proj) return;
    var m = findMailRowByKey(proj.id, mailKey);
    if (!m) { toast('메일 정보를 찾을 수 없습니다.'); return; }

    if (!silent) toast('메일 본문·첨부 내용 확인 중 (peek 모드)…');
    var bodyPlain = '';
    var attSummaries = [];
    var attExcerpts = [];
    var parsedAtts = [];
    var attErrors = [];
    var mergedStats = null, mergedIssues = [], mergedDiff = null, finalDocKind = m.docKind;
    var attLeakBlocked = false;

    try {
      var isPop3 = m.src === 'pop3' && !!m.popKey;
      var msg = isPop3
        ? await callMailFn('readOldMail', { key: m.popKey, full: 1 })
        : await callMailFn('readMailMessage', { slug: m.slug, uid: m.uid, peek: 1 });
      bodyPlain = str(msg.text) || htmlToPlainText(msg.html) || str(m.preview);
      var atts = Array.isArray(msg.atts) ? msg.atts : [];

      for (var i = 0; i < Math.min(atts.length, 6); i++) {
        var a = atts[i];
        var aName = str(a && a.name);
        var maxAttBytes = /\.(pptx|pptm|ppsx)$/i.test(aName) ? (40 * 1024 * 1024) : (15 * 1024 * 1024);
        if (!aName || Number(a.size || 0) > maxAttBytes) continue;
        try {
          var got = isPop3
            ? await callMailFn('readOldMail', { key: m.popKey, index: a.i == null ? i : a.i })
            : await callMailFn('readMailAttachment', {
              slug: m.slug,
              uid: m.uid,
              index: a.i == null ? i : a.i,
              part: a.part || ''
            });
          if (got && got.b64 && global.PuRulesMailOrig) {
            var bytes = global.PuRulesMailOrig.b64ToBytes(got.b64);
            var attRes = await analyzeAttachmentBytes(aName, bytes, proj, '', phase);
            if (attRes) {
              var safeAttNm = await sanitizeMetaLabelAsync(aName, proj);
              parsedAtts.push({ idx: i, safeName: safeAttNm, res: attRes });
              if (!finalDocKind || parsedAtts.length === 1) finalDocKind = attRes.docKind || finalDocKind;
              if (attRes.stats && !mergedStats) mergedStats = attRes.stats;
              if (attRes.policyIssues && attRes.policyIssues.length) mergedIssues = mergedIssues.concat(attRes.policyIssues);
              if (attRes.postDiff) mergedDiff = attRes.postDiff;
              if (attRes.maskedExcerpt) attExcerpts.push(attRes.maskedExcerpt);
              attSummaries = attSummaries.concat(attRes.summaryLines || []);
            }
          }
        } catch (attErr) {
          var errMsg = String((attErr && attErr.message) || attErr || '');
          if (/잔존 패턴|차단했습니다/.test(errMsg)) attLeakBlocked = true;
          attErrors.push(formatSafeErrorLabel(aName, proj) + ': ' + errMsg);
        }
      }
    } catch (mailErr) {
      bodyPlain = [str(m.subject), str(m.preview), (m.attNames || []).join('\n')].filter(Boolean).join('\n');
    }

    var safeSubjTitle = '';
    var safeAttList = [];
    try {
      safeSubjTitle = await sanitizeMetaLabelAsync(m.subject || m.docKindName, proj);
      var rawAttNames = Array.isArray(m.attNames) ? m.attNames : [];
      for (var anIdx = 0; anIdx < rawAttNames.length; anIdx++) {
        safeAttList.push(await sanitizeMetaLabelAsync(rawAttNames[anIdx], proj));
      }
    } catch (metaErr) {
      toast('⚠ ' + (metaErr.message || metaErr));
      return;
    }

    var resolvedKindObj = Cat().getDocKind(finalDocKind);
    var effectivePhase = Intake().resolvePhase(m.ts || Date.now(), proj.midConfirmedAt, resolvedKindObj, safeSubjTitle, safeAttList) || phase;

    var stage1BodyPlain = '';
    try {
      stage1BodyPlain = await redactWithKordocFailClosed(bodyPlain);
    } catch (kdBodyErr) {
      toast('⚠ ' + (kdBodyErr.message || kdBodyErr));
      return;
    }
    var combinedTextForBody = [attExcerpts.join('\n\n'), stage1BodyPlain].filter(Boolean).join('\n\n');
    var bodyRes = Intake().sanitizeAndAnalyzeText(combinedTextForBody, {
      companyName: proj.companyName,
      ceoName: proj.ceoName,
      contactName: proj.contactName,
      docKind: finalDocKind,
      phase: effectivePhase,
      midConfirmedAt: proj.midConfirmedAt,
      subject: safeSubjTitle,
      attNames: safeAttList
    });

    if (bodyRes.leakBlocked || attLeakBlocked || Intake().hasResidualPii(safeSubjTitle) || safeAttList.some(Intake().hasResidualPii)) {
      toast('⚠ 민감 고유식별정보 잔존 패턴이 감지되어 자동 저장을 차단했습니다.');
      return;
    }

    if (attErrors.length && !attSummaries.length && !mergedStats && !attExcerpts.length) {
      toast('⚠ 첨부파일 분석 오류: ' + attErrors[0]);
      return;
    }

    var combinedLines = attSummaries.concat(bodyRes.summaryLines || []);
    if (attErrors.length) {
      combinedLines.push('일부 첨부 확인 필요 — ' + attErrors[0]);
    }
    if (!combinedLines.length) combinedLines.push('메일 내용 확인 완료 (' + safeSubjTitle + ')');

    var cardPayload = {
      id: 'mail_' + safeKey(m.key),
      mailKey: m.key,
      source: 'mail',
      title: safeSubjTitle,
      subject: safeSubjTitle,
      attNames: safeAttList,
      phase: bodyRes.phase || effectivePhase,
      docKind: finalDocKind || bodyRes.docKind,
      track: (parsedAtts.length === 1 && mergedStats) ? 'quant' : bodyRes.track,
      piiStripped: true,
      maskedExcerpt: bodyRes.maskedExcerpt,
      stats: (parsedAtts.length === 1 && mergedStats) ? mergedStats : null,
      policyIssues: mergedIssues.length ? mergedIssues : (bodyRes.policyIssues || []),
      postDiff: mergedDiff || bodyRes.postDiff || null,
      summaryLines: combinedLines.slice(0, 6),
      checkedAt: Date.now(),
      analyzedAt: Date.now()
    };

    if (m.matchKind === 'name_candidate' && m.from && m.dir === 'in') {
      var nextEmails = Array.isArray(proj.contactEmails) ? proj.contactEmails.slice() : [];
      if (nextEmails.indexOf(m.from) < 0) {
        nextEmails.push(m.from);
        await saveProjectRecord(Object.assign({}, proj, { contactEmails: nextEmails }));
      }
    }

    var savedCard = await saveIntakeCard(proj, cardPayload);
    /* 다중 첨부 메일에서 정량 통계(인력·임금·근태·설문)나 보고서 원문이 덮어써지지 않도록 개별 첨부 카드를 분리 저장 */
    if (parsedAtts.length >= 2) {
      for (var ai = 0; ai < parsedAtts.length; ai++) {
        var pa = parsedAtts[ai];
        if (!pa || !pa.res || Intake().hasResidualPii(pa.safeName)) continue;
        var attDk = Cat().getDocKind(pa.res.docKind);
        var attPh = Intake().resolvePhase(m.ts || Date.now(), proj.midConfirmedAt, attDk, safeSubjTitle, [pa.safeName]) || effectivePhase;
        await saveIntakeCard(proj, {
          id: 'mail_' + safeKey(m.key) + '_att_' + pa.idx,
          mailKey: m.key,
          source: 'mail_att',
          title: pa.safeName || safeSubjTitle,
          subject: safeSubjTitle,
          attNames: pa.safeName ? [pa.safeName] : [],
          phase: attPh,
          docKind: pa.res.docKind || bodyRes.docKind,
          track: pa.res.track || (pa.res.stats ? 'quant' : 'text'),
          piiStripped: true,
          maskedExcerpt: str(pa.res.maskedExcerpt),
          stats: pa.res.stats || null,
          policyIssues: pa.res.policyIssues || [],
          postDiff: pa.res.postDiff || null,
          summaryLines: (pa.res.summaryLines && pa.res.summaryLines.length) ? pa.res.summaryLines.slice(0, 6) : [pa.safeName + ' 분석 완료'],
          checkedAt: Date.now(),
          analyzedAt: Date.now()
        });
      }
    }
    rebuildScanAndDiscover();
    draw();
    if (!silent && savedCard) openCardDetailModal(savedCard);
  }

  async function buildCheckedMailCardPayload(proj, mailKey, phase) {
    var m = findMailRowByKey(proj.id, mailKey);
    if (!m) return null;
    var cardId = 'mail_' + safeKey(m.key);
    var prev = (D.intake[proj.id] && D.intake[proj.id][cardId]) || null;
    var safeSubjTitle = '';
    var safeAttList = [];
    try {
      safeSubjTitle = await sanitizeMetaLabelAsync(m.subject || m.docKindName, proj);
      var rawAtts = Array.isArray(m.attNames) ? m.attNames : [];
      for (var i = 0; i < rawAtts.length; i++) {
        safeAttList.push(await sanitizeMetaLabelAsync(rawAtts[i], proj));
      }
    } catch (_) {
      return null;
    }
    return {
      prev: prev,
      record: stripUndef(Object.assign({}, prev || {}, {
        id: cardId,
        projectId: proj.id,
        entityType: 'Document',
        companyId: str(proj.companyId),
        companyName: str(proj.companyName),
        mailKey: m.key,
        source: 'mail',
        title: safeSubjTitle,
        subject: safeSubjTitle,
        attNames: safeAttList,
        phase: phase,
        docKind: (prev && prev.docKind) || m.docKind,
        track: (prev && prev.track) || m.track,
        piiStripped: true,
        summaryLines: (prev && prev.summaryLines) || ['수신 확인 완료 (' + (m.date || '') + ')'],
        checkedAt: Date.now()
      }))
    };
  }

  async function markMailCheckedOnly(mailKey, phase) {
    var proj = projectById(CUR_PID);
    if (!proj) return;
    var built = await buildCheckedMailCardPayload(proj, mailKey, phase);
    if (!built) {
      toast('⚠ 메일 제목·첨부명에 민감 식별정보 패턴이 남아 있어 저장을 차단했습니다.');
      return;
    }
    await saveIntakeCard(proj, built.record);
    rebuildScanAndDiscover();
    draw();
  }

  /* ══ 5. 온톨로지 강제 관문(gate) 및 트랜잭션 기반 동시성 안전 저장 함수들 ══════════════ */
  /* expectedRevision 계약 준수: 신규는 -1(생성 경쟁 차단), revision 없는 기존 자료는 0, 그 외는 현재 revision */
  function expectedRevOf(localPrev) {
    return localPrev ? Number(localPrev.revision || 0) : -1;
  }

  async function atomicMultiRecordUpdate(entries) {
    if (!gate || !fbDb || !entries || !entries.length) return {};
    var out = {};
    for (var j = 0; j < entries.length; j++) {
      var it = entries[j];
      if (!it || !it.path) continue;
      if (it.tombstone) {
        if (!it.previous) continue;
        var rmRes = await gate.remove(fbDb.ref(it.path), it.previous, {
          entityType: it.entityType,
          expectedRevision: expectedRevOf(it.previous)
        });
        out[it.path] = rmRes && rmRes.snapshot ? rmRes.snapshot.val() : null;
      } else {
        var svOpts = {
          entityType: it.entityType,
          expectedRevision: expectedRevOf(it.previous)
        };
        var recSnapshot = it.record;
        var svRes = await gate.save(fbDb.ref(it.path), function (serverPrev) {
          if (serverPrev && serverPrev._deleted === true && !(recSnapshot && recSnapshot._deleted === true)) {
            return undefined;
          }
          return stripUndef(Object.assign({}, serverPrev || {}, recSnapshot));
        }, svOpts);
        out[it.path] = svRes && svRes.snapshot ? svRes.snapshot.val() : null;
      }
    }
    return out;
  }

  async function saveProjectRecord(projInput) {
    if (!gate || !fbDb) throw new Error('저장 관문이 준비되지 않았습니다.');
    var id = str(projInput.id) || ('ilt_' + Date.now().toString(36));
    if (!str(projInput.companyId)) {
      throw new Error('거래처(companyId)를 선택해야 등록할 수 있습니다(상호 텍스트 단독 저장 불가).');
    }
    var localPrev = D.projects[id] || null;
    var svOpts = { entityType: 'Project', expectedRevision: expectedRevOf(localPrev) };
    var ref = fbDb.ref('scal_ilteo/projects/' + id);
    var res = await gate.save(ref, function (prev) {
      if (prev && prev._deleted === true && !projInput._deleted) return undefined;
      return stripUndef(Object.assign({}, prev || {}, projInput, {
        id: id,
        entityType: 'Project',
        companyId: str(projInput.companyId),
        companyName: str(projInput.companyName)
      }));
    }, svOpts);
    var val = res && res.snapshot ? res.snapshot.val() : null;
    if (val) D.projects[id] = val;
    return val;
  }

  async function saveIntakeCard(proj, cardInput) {
    if (!gate || !fbDb || !proj) return null;
    var cid = str(cardInput.id) || ('in_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6));
    var localPrev = (D.intake[proj.id] && D.intake[proj.id][cid]) || null;
    var svOpts = { entityType: 'Document', expectedRevision: expectedRevOf(localPrev) };
    var ref = fbDb.ref('scal_ilteo/intake/' + proj.id + '/' + cid);
    var res = await gate.save(ref, function (prev) {
      if (prev && prev._deleted === true && !cardInput._deleted) return undefined;
      return stripUndef(Object.assign({}, prev || {}, cardInput, {
        id: cid,
        projectId: proj.id,
        entityType: 'Document',
        companyId: str(proj.companyId),
        companyName: str(proj.companyName)
      }));
    }, svOpts);
    var val = res && res.snapshot ? res.snapshot.val() : null;
    if (!D.intake[proj.id]) D.intake[proj.id] = {};
    if (val) D.intake[proj.id][cid] = val;
    return val;
  }

  async function saveMidDoc(proj, sections, locks) {
    var localPrev = D.mid[proj.id] || null;
    var svOpts = { entityType: 'Document', expectedRevision: expectedRevOf(localPrev) };
    var ref = fbDb.ref('scal_ilteo/mid/' + proj.id);
    var res = await gate.save(ref, function (prev) {
      if (prev && prev._deleted === true) return undefined;
      return stripUndef(Object.assign({}, prev || {}, {
        id: proj.id,
        projectId: proj.id,
        entityType: 'Document',
        companyId: str(proj.companyId),
        companyName: str(proj.companyName),
        sections: sections,
        locks: locks || {}
      }));
    }, svOpts);
    var val = res && res.snapshot ? res.snapshot.val() : null;
    if (val) D.mid[proj.id] = val;
    return val;
  }

  async function saveFinalDoc(proj, sections, locks) {
    var localPrev = D.final[proj.id] || null;
    var svOpts = { entityType: 'Document', expectedRevision: expectedRevOf(localPrev) };
    var ref = fbDb.ref('scal_ilteo/final/' + proj.id);
    var res = await gate.save(ref, function (prev) {
      if (prev && prev._deleted === true) return undefined;
      return stripUndef(Object.assign({}, prev || {}, {
        id: proj.id,
        projectId: proj.id,
        entityType: 'Document',
        companyId: str(proj.companyId),
        companyName: str(proj.companyName),
        sections: sections,
        locks: locks || {}
      }));
    }, svOpts);
    var val = res && res.snapshot ? res.snapshot.val() : null;
    if (val) D.final[proj.id] = val;
    return val;
  }

  async function saveImmutableSnapshot(proj, snapObj) {
    var sid = str(snapObj.id) || ('snap_' + Date.now());
    var localPrev = (D.snapshots[proj.id] && D.snapshots[proj.id][sid]) || null;
    var ref = fbDb.ref('scal_ilteo/snapshots/' + proj.id + '/' + sid);
    var res = await gate.save(ref, stripUndef(Object.assign({}, snapObj, {
      id: sid,
      projectId: proj.id,
      entityType: 'Document',
      companyId: str(proj.companyId),
      companyName: str(proj.companyName)
    })), { entityType: 'Document', expectedRevision: expectedRevOf(localPrev) });
    if (!D.snapshots[proj.id]) D.snapshots[proj.id] = {};
    if (res && res.snapshot) D.snapshots[proj.id][sid] = res.snapshot.val();
  }

  /* ══ 6. 모달 창 (사업장 등록 · 과제 설정 · 회차 편집 · Diff 편집 · PPT 미리보기 · 플랫폼 문안 · AI 윤문) ═ */
  var LAST_MODAL_FOCUS = null;
  var LAST_MODAL_FOCUS_SEL = '';

  function isVisibleEl(el) {
    if (!el || !el.isConnected) return false;
    if (typeof el.getClientRects === 'function') return el.getClientRects().length > 0;
    return el.offsetParent !== null;
  }

  function buildFocusSelector(el) {
    if (!el || !el.tagName || el.tagName === 'BODY' || el.tagName === 'HTML') return '';
    if (el.id) return '#' + el.id;
    var attrs = ['data-act', 'data-mail-inspect', 'data-view-card', 'data-ai-polish', 'data-proj-sel', 'data-tab', 'data-edit-round', 'data-edit-diff'];
    for (var i = 0; i < attrs.length; i++) {
      var v = el.getAttribute && el.getAttribute(attrs[i]);
      if (v) return '[' + attrs[i] + '="' + v.replace(/"/g, '\\"') + '"]';
    }
    return '#tabs button.on';
  }

  function restoreModalFocus() {
    if (isVisibleEl(LAST_MODAL_FOCUS) && typeof LAST_MODAL_FOCUS.focus === 'function') {
      try { LAST_MODAL_FOCUS.focus(); LAST_MODAL_FOCUS = null; LAST_MODAL_FOCUS_SEL = ''; return; } catch (e) {}
    }
    if (typeof document !== 'undefined') {
      var fallback = null;
      if (LAST_MODAL_FOCUS_SEL) {
        fallback = document.querySelector('.pane.on ' + LAST_MODAL_FOCUS_SEL);
        if (!isVisibleEl(fallback)) {
          var cand = document.querySelector(LAST_MODAL_FOCUS_SEL);
          fallback = isVisibleEl(cand) ? cand : null;
        }
      }
      if (!isVisibleEl(fallback)) {
        fallback = document.querySelector('.pane.on select[data-proj-sel], .pane.on button:not([disabled]), .pane.on input:not([disabled])');
      }
      if (!isVisibleEl(fallback)) {
        fallback = document.querySelector('#tabs button.on');
      }
      if (fallback && typeof fallback.focus === 'function') {
        try { fallback.focus(); } catch (e) {}
      }
    }
    LAST_MODAL_FOCUS = null;
    LAST_MODAL_FOCUS_SEL = '';
  }

  async function withBusy(btn, fn) {
    if (btn && btn.disabled) return;
    if (btn) btn.disabled = true;
    try {
      return await fn();
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function openModal(title, bodyHtml, footHtml, sizeCls) {
    var modal = $('modal'), mbox = $('mbox');
    if (!modal || !mbox) return;
    LAST_MODAL_FOCUS = (typeof document !== 'undefined' && document.activeElement) ? document.activeElement : null;
    LAST_MODAL_FOCUS_SEL = buildFocusSelector(LAST_MODAL_FOCUS);
    mbox.className = 'mbox' + (sizeCls ? ' ' + sizeCls : '');
    mbox.innerHTML =
      '<div class="mhd"><span id="mhdTitle">' + esc(title) + '</span><span class="sp"></span><button class="sm" data-close-modal="1">닫기</button></div>' +
      '<div class="mbd">' + bodyHtml + '</div>' +
      (footHtml ? '<div class="mft">' + footHtml + '</div>' : '');
    modal.style.display = 'flex';
    try { mbox.focus(); } catch (e) {}
  }
  function closeModal(deferFocus) {
    var modal = $('modal');
    if (modal) modal.style.display = 'none';
    if (!deferFocus) restoreModalFocus();
  }

  function openNewProjectModal() {
    var coOpts = '<option value="">-- 기업정보함(data/companies) 거래처 선택 (필수) --</option>' +
      D.companies.slice().sort(function (a, b) { return str(a.name).localeCompare(str(b.name), 'ko'); })
        .map(function (c) {
          return '<option value="' + esc(c.id) + '">' + esc(str(c.name) + (c.bizNo ? ' (' + c.bizNo + ')' : '')) + '</option>';
        }).join('');

    var lvOpts = Object.keys(Cat().LEVELS).map(function (k) {
      var lv = Cat().LEVELS[k];
      return '<option value="' + esc(lv.code) + '"' + (lv.code === 'deep' ? ' selected' : '') + '>' + esc(lv.name + ' (최소 EOS ' + lv.eosMinPct + '%+)') + '</option>';
    }).join('');

    var npYearOpts = [];
    for (var ny = 2026; ny >= 2015; ny--) {
      npYearOpts.push('<option value="' + ny + '"' + (ny === 2026 ? ' selected' : '') + '>' + ny + '년</option>');
    }

    var body =
      '<div class="fr"><label for="npCo">대상 거래처*</label><div class="fv"><select id="npCo">' + coOpts + '</select></div></div>' +
      '<div class="fr"><label for="npYear">사업 연도</label><div class="fv"><select id="npYear">' + npYearOpts.join('') + '</select></div></div>' +
      '<div class="fr"><label for="npLevel">컨설팅 수준</label><div class="fv"><select id="npLevel">' + lvOpts + '</select></div></div>' +
      '<div class="fr"><label for="npIndustry">업종 / 근로자수</label><div class="fv"><input type="text" id="npIndustry" aria-label="업종" placeholder="예: 정밀기계 제조업"><input type="number" id="npWorkers" aria-label="상시근로자 수" placeholder="상시근로자 수" style="max-width:140px"></div></div>' +
      '<div class="fr"><label for="npEmail">담당자 이메일</label><div class="fv"><input type="email" id="npEmail" placeholder="수신 메일 자동 감지용 이메일 (여러 개는 쉼표 구분)"></div></div>' +
      '<div class="fr"><label for="npCons">전담 노무사</label><div class="fv"><input type="text" id="npCons" value="' + esc(ME.name ? ME.name + ' 공인노무사' : '푸른노무법인 전담 노무사') + '"></div></div>';

    var foot = '<button class="sm" data-close-modal="1">취소</button><button class="sm pri" id="npSaveBtn">워크스페이스 생성</button>';
    openModal('➕ 일터상생혁신 사업장 워크스페이스 등록', body, foot, '');

    if ($('npCo')) {
      $('npCo').onchange = function () {
        var co = findCompanyById($('npCo').value);
        if (!co) return;
        if ($('npIndustry') && !str($('npIndustry').value)) $('npIndustry').value = str(co.bizType || co.bizCategory);
        if ($('npEmail') && !str($('npEmail').value)) $('npEmail').value = firstEmailOf(co);
      };
    }
    if ($('npSaveBtn')) {
      $('npSaveBtn').onclick = function () {
        return withBusy($('npSaveBtn'), async function () {
          var coId = str($('npCo') && $('npCo').value);
          var co = findCompanyById(coId);
          if (!co) { toast('반드시 등록된 거래처를 선택해 주세요.'); return; }
          try {
            var emails = str($('npEmail').value).split(/[,;\s]+/).map(str).filter(Boolean);
            var created = await saveProjectRecord({
              id: 'ilt_' + safeKey(co.id) + '_' + str($('npYear').value || '2026'),
              companyId: co.id,
              companyName: str(co.name),
              bizNo: str(co.bizNo),
              ceoName: str(co.ceo || co.ceoName),
              contactName: contactNameOfCompany(co),
              year: Number($('npYear').value) || 2026,
              programName: '일터혁신 상생컨설팅',
              isIlteo: true,
              level: str($('npLevel').value) || 'deep',
              industry: str($('npIndustry').value) || str(co.bizType),
              workerCount: Number($('npWorkers').value) || 0,
              contactEmails: emails,
              consultantName: str($('npCons').value),
              selectedTasks: ['wt_45day', 'wg_redesign'],
              designTeamCount: 4
            });
            closeModal(true);
            CUR_PID = created.id;
            TAB = 'intake';
            clearSel();
            rebuildScanAndDiscover();
            draw();
            restoreModalFocus();
            toast(co.name + ' 일터상생혁신 워크스페이스가 개설되었습니다.');
          } catch (e) {
            toast('등록 실패: ' + (e.message || e));
          }
        });
      };
    }
  }

  function openTaskConfigModal(proj) {
    var picked = {};
    (proj.selectedTasks || []).forEach(function (c) {
      var nc = Cat().normalizeTaskCode ? Cat().normalizeTaskCode(c) : c;
      picked[nc] = 1;
    });
    var allTasksOn = Cat().TASKS.every(function (t) { return !!picked[t.code]; });

    var taskHtml = Cat().TASKS.map(function (t, idx) {
      var dom = Cat().getDomain(t.domain) || { icon: '•', name: '' };
      var on = !!picked[t.code];
      return '<label class="task-opt' + (on ? ' on' : '') + '">' +
        '<input type="checkbox" name="cfgTask" value="' + esc(t.code) + '"' + (on ? ' checked' : '') + '>' +
        '<span class="task-no">' + (idx + 1) + '</span>' +
        '<div><b>' + esc(dom.icon + ' [' + dom.name + '] ' + t.name) + '</b><span>' + esc(t.summary) + '</span></div>' +
        '</label>';
    }).join('');

    var lvOpts = Object.keys(Cat().LEVELS).map(function (k) {
      var lv = Cat().LEVELS[k];
      return '<option value="' + esc(lv.code) + '"' + (proj.level === lv.code ? ' selected' : '') + '>' + esc(lv.name) + '</option>';
    }).join('');

    var body =
      '<div class="fr"><label for="cfgLevel">컨설팅 수준</label><div class="fv"><select id="cfgLevel">' + lvOpts + '</select>' +
      '<input type="text" id="cfgIndustry" aria-label="업종" value="' + esc(proj.industry || '') + '" placeholder="업종">' +
      '<input type="number" id="cfgWorkers" aria-label="상시근로자 수" value="' + esc(proj.workerCount || '') + '" placeholder="상시근로자수" style="max-width:130px"></div></div>' +
      '<div class="fr"><label for="cfgEmails">수신감지 이메일</label><div class="fv"><input type="text" id="cfgEmails" value="' + esc((proj.contactEmails || []).join(', ')) + '" placeholder="기업 담당자 이메일 (쉼표 구분)"></div></div>' +
      '<div class="task-pick-hd">' +
      '<input type="checkbox" id="cfgTaskAll"' + (allTasksOn ? ' checked' : '') + ' aria-label="19개 개선과제 전체 선택">' +
      '<span class="task-no" style="padding-top:0">번호</span>' +
      '<span>🎯 노사발전재단 공식 9대 분야 · 19개 개선과제 선택 (복수 선택)</span>' +
      '</div>' +
      '<div class="task-pick-grid">' + taskHtml + '</div>';

    openModal('🎯 ' + proj.companyName + ' — 개선과제 및 사업장 기준 설정', body,
      '<button class="sm" data-close-modal="1">취소</button><button class="sm pri" id="cfgSaveBtn">설정 저장</button>', 'wide');

    var syncTaskAll = function () {
      var cbs = Array.prototype.slice.call(document.querySelectorAll('#mbox input[name="cfgTask"]'));
      if ($('cfgTaskAll')) $('cfgTaskAll').checked = cbs.length > 0 && cbs.every(function (x) { return x.checked; });
    };
    if ($('cfgTaskAll')) {
      $('cfgTaskAll').onchange = function () {
        var next = $('cfgTaskAll').checked;
        document.querySelectorAll('#mbox input[name="cfgTask"]').forEach(function (cb) {
          cb.checked = next;
          var lbl = cb.closest('.task-opt');
          if (lbl) lbl.classList.toggle('on', next);
        });
      };
    }
    document.querySelectorAll('#mbox input[name="cfgTask"]').forEach(function (cb) {
      cb.onchange = function () {
        var lbl = cb.closest('.task-opt');
        if (lbl) lbl.classList.toggle('on', cb.checked);
        syncTaskAll();
      };
    });

    if ($('cfgSaveBtn')) {
      $('cfgSaveBtn').onclick = function () {
        return withBusy($('cfgSaveBtn'), async function () {
          var selected = Array.prototype.slice.call(document.querySelectorAll('#mbox input[name="cfgTask"]:checked')).map(function (el) { return el.value; });
          if (!selected.length) { toast('최소 1개 이상의 개선과제를 선택해 주세요.'); return; }
          try {
            var emails = str($('cfgEmails').value).split(/[,;\s]+/).map(str).filter(Boolean);
            var co = findCompanyById(proj.companyId);
            await saveProjectRecord(Object.assign({}, proj, {
              ceoName: str(proj.ceoName || (co && (co.ceo || co.ceoName))),
              contactName: str(proj.contactName || contactNameOfCompany(co)),
              level: str($('cfgLevel').value) || proj.level,
              industry: str($('cfgIndustry').value),
              workerCount: Number($('cfgWorkers').value) || 0,
              contactEmails: emails,
              selectedTasks: selected
            }));
            closeModal(true);
            rebuildScanAndDiscover();
            draw();
            restoreModalFocus();
            toast('개선과제 및 필수 체크리스트가 갱신되었습니다.');
          } catch (e) {
            toast('설정 저장 실패: ' + (e.message || e));
          }
        });
      };
    }
  }

  function currentNormalizedRounds(proj) {
    var schedRds = schedRoundsForProject(proj);
    var mid = Report().buildMidReport(proj, D.intake[proj.id] || {}, schedRds, D.mid[proj.id] || null);
    var rc = mid && mid.structured && mid.structured.roundCheck;
    return rc ? rc.rounds.map(function (r) {
      return {
        roundNo: r.roundNo,
        date: r.date === '일정 조율' ? '' : r.date,
        mode: r.mode,
        mins: r.mins,
        companyPeople: r.companyPeople,
        topic: r.topic,
        hasPhoto: !!r.hasPhoto,
        hasSign: !!r.hasSign
      };
    }) : [];
  }

  function openRoundEditModal(proj, roundNo) {
    var rounds = currentNormalizedRounds(proj);
    var existing = roundNo ? rounds.find(function (r) { return Number(r.roundNo) === Number(roundNo); }) : null;
    var targetNo = existing ? existing.roundNo : (rounds.length + 1);
    var initDate = existing ? existing.date : '';
    var initMode = existing ? existing.mode : 'face';
    var initMins = existing ? existing.mins : 120;
    var initPeople = existing ? existing.companyPeople : Math.max(3, Number(proj.designTeamCount || 4));
    var initTopic = existing ? existing.topic : '';
    var initPhoto = existing ? existing.hasPhoto : false;
    var initSign = existing ? existing.hasSign : false;

    var body =
      '<div class="note">노사발전재단 회차 인정 기준: 전체 회차 대비 <b>대면 70% 이상</b>, 회당 <b>120분 이상</b>, 기업 측 <b>3인 이상 참석</b>, 시작·종료 타임스탬프 사진 2장 및 참석자 전원 자필 서명지 구비 필수</div>' +
      '<div class="fr"><label for="rdDate">수행 일자 / 방식</label><div class="fv">' +
      '<input type="text" id="rdDate" aria-label="수행 일자" value="' + esc(initDate) + '" placeholder="YYYY-MM-DD" style="max-width:160px">' +
      '<select id="rdMode" aria-label="수행 방식"><option value="face"' + (initMode === 'face' ? ' selected' : '') + '>대면(현장 회의)</option><option value="remote"' + (initMode === 'remote' ? ' selected' : '') + '>비대면(화상 회의)</option></select>' +
      '</div></div>' +
      '<div class="fr"><label for="rdMins">시간(분) / 기업참석</label><div class="fv">' +
      '<input type="number" id="rdMins" aria-label="수행 시간(분)" value="' + esc(initMins) + '" min="30" max="480" style="max-width:130px"><span>분</span>' +
      '<input type="number" id="rdPeople" aria-label="기업 측 참석 인원" value="' + esc(initPeople) + '" min="1" max="50" style="max-width:130px"><span>명 참석</span>' +
      '</div></div>' +
      '<div class="fr"><label for="rdTopic">핵심 수행 주제*</label><div class="fv"><input type="text" id="rdTopic" value="' + esc(initTopic) + '" placeholder="예: 주4.5일제 부서별 교대 편성안 및 통상시급 모의계산 검토"></div></div>' +
      '<div class="fr"><label>필수 증빙 확인</label><div class="fv">' +
      '<label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" id="rdPhoto"' + (initPhoto ? ' checked' : '') + '> 시작·종료 타임스탬프 사진 2장</label>' +
      '<label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" id="rdSign"' + (initSign ? ' checked' : '') + '> 참석자 전원 자필 서명지</label>' +
      '</div></div>';

    openModal((existing ? '✏️ ' + targetNo + '회차 수행·증빙 편집' : '➕ 신규 컨설팅 회차 추가'), body,
      '<button class="sm" data-close-modal="1">취소</button><button class="sm pri" id="rdSaveBtn">회차 저장</button>', 'wide');

    if ($('rdSaveBtn')) {
      $('rdSaveBtn').onclick = function () {
        return withBusy($('rdSaveBtn'), async function () {
          var rawTopic = str($('rdTopic').value);
          if (!rawTopic) { toast('핵심 수행 주제를 입력해 주세요.'); return; }
          var topic = '';
          try {
            topic = await sanitizeMetaLabelAsync(rawTopic, proj, { sentence: true });
          } catch (rdErr) {
            toast((rdErr && rdErr.message) || '수행 주제에 민감 식별정보 패턴이 포함되어 저장할 수 없습니다.');
            return;
          }
          if (!topic) { toast('핵심 수행 주제를 입력해 주세요.'); return; }
          var entry = {
            roundNo: targetNo,
            date: str($('rdDate').value),
            mode: str($('rdMode').value) === 'remote' ? 'remote' : 'face',
            mins: Math.max(30, Number($('rdMins').value) || 120),
            companyPeople: Math.max(1, Number($('rdPeople').value) || 3),
            topic: topic,
            hasPhoto: !!($('rdPhoto') && $('rdPhoto').checked),
            hasSign: !!($('rdSign') && $('rdSign').checked)
          };
          var nextRounds = rounds.slice();
          var idx = nextRounds.findIndex(function (r) { return Number(r.roundNo) === Number(targetNo); });
          if (idx >= 0) nextRounds[idx] = entry;
          else nextRounds.push(entry);
          nextRounds = nextRounds.map(function (r, i) { return Object.assign({}, r, { roundNo: i + 1 }); });

          await saveProjectRecord(Object.assign({}, proj, { rounds: nextRounds }));
          closeModal(true);
          draw();
          restoreModalFocus();
          toast(targetNo + '회차 수행 내역이 반영되었습니다.');
        });
      };
    }
  }

  function openDiffEditModal(proj, diffId) {
    var schedRds = schedRoundsForProject(proj);
    var mid = Report().buildMidReport(proj, D.intake[proj.id] || {}, schedRds, D.mid[proj.id] || null);
    var fin = Report().buildFinalReport(proj, mid, D.intake[proj.id] || {}, schedRds, D.final[proj.id] || null);
    var diffObjs = (fin.structured && fin.structured.diffObjects) || [];
    var existing = diffId ? diffObjs.find(function (d) { return d.id === diffId; }) : null;

    var initArea = existing ? existing.area : '';
    var initBase = existing ? existing.baseVal : '중간보고 초안 기준';
    var initFinal = existing ? existing.finalVal : '';
    var initSt = existing ? existing.status : '합의 확정 ✓';

    var body =
      '<div class="note">후속 협의 합의·변경 내역을 수정하면 최종 결과보고서, 발표용 PPTX, 취업규칙 신구대조표(.docx), 표준 근로계약서(.docx), 모의계산(.xlsx)에 즉시 연동됩니다.</div>' +
      '<div class="fr"><label for="dfArea">협의 영역*</label><div class="fv"><input type="text" id="dfArea" value="' + esc(initArea) + '"' + (existing && !existing.custom ? ' readonly' : '') + ' placeholder="예: 생산본부 교대조 단축근무 특례"></div></div>' +
      '<div class="fr"><label for="dfBase">중간보고 기준선</label><div class="fv"><input type="text" id="dfBase" value="' + esc(initBase) + '"></div></div>' +
      '<div class="fr"><label for="dfFinal">최종 합의·확정안*</label><div class="fv"><textarea id="dfFinal" rows="3" placeholder="예: 격주 금요일 오후 4시간 단축근무 및 월 단위 사전 교대 편성 확정">' + esc(initFinal) + '</textarea></div></div>' +
      '<div class="fr"><label for="dfStatus">합의 상태</label><div class="fv"><select id="dfStatus">' +
      ['합의 확정 ✓', '후속 메일 확정', '과반수 찬성 완료', '추가 협의중', '검토 보류'].map(function (s) {
        return '<option value="' + esc(s) + '"' + (initSt === s ? ' selected' : '') + '>' + esc(s) + '</option>';
      }).join('') +
      '</select></div></div>';

    openModal((existing ? '✏️ 후속 협의 Diff 항목 편집' : '➕ 후속 협의 합의사항 추가'), body,
      '<button class="sm" data-close-modal="1">취소</button><button class="sm pri" id="dfSaveBtn">합의사항 저장</button>', 'wide');

    if ($('dfSaveBtn')) {
      $('dfSaveBtn').onclick = function () {
        return withBusy($('dfSaveBtn'), async function () {
          var rawArea = str($('dfArea').value);
          var rawBase = str($('dfBase').value);
          var rawFinal = str($('dfFinal').value);
          var status = str($('dfStatus').value) || '합의 확정 ✓';
          if (!rawArea || !rawFinal) { toast('협의 영역과 최종 확정안을 입력해 주세요.'); return; }
          var area = '', baseVal = '', finalVal = '';
          try {
            area = await sanitizeMetaLabelAsync(rawArea, proj, { sentence: true });
            baseVal = await sanitizeMetaLabelAsync(rawBase, proj, { sentence: true });
            finalVal = await sanitizeMetaLabelAsync(rawFinal, proj, { sentence: true });
          } catch (dfErr) {
            toast((dfErr && dfErr.message) || '민감 고유식별정보 패턴이 감지되어 저장할 수 없습니다.');
            return;
          }

          var nextStatusMap = Object.assign({}, proj.diffStatusMap || {});
          var nextOverrides = Object.assign({}, proj.diffOverrides || {});
          var nextCustom = Array.isArray(proj.customDiffRows) ? proj.customDiffRows.slice() : [];

          if (!existing) {
            var newId = 'df_custom_' + Date.now().toString(36);
            nextCustom.push({ id: newId, area: area, baseVal: baseVal, finalVal: finalVal, status: status });
            nextStatusMap[newId] = status;
          } else if (existing.custom) {
            nextCustom = nextCustom.map(function (r) {
              return r && r.id === existing.id ? Object.assign({}, r, { area: area, baseVal: baseVal, finalVal: finalVal, status: status }) : r;
            });
            nextStatusMap[existing.id] = status;
          } else {
            nextOverrides[existing.id] = { area: area, baseVal: baseVal, finalVal: finalVal, status: status };
            nextStatusMap[existing.id] = status;
          }

          await saveProjectRecord(Object.assign({}, proj, {
            diffStatusMap: nextStatusMap,
            diffOverrides: nextOverrides,
            customDiffRows: nextCustom
          }));
          closeModal(true);
          draw();
          restoreModalFocus();
          toast('후속 협의 합의사항이 반영되었습니다.');
        });
      };
    }
  }

  function openSlidePreviewModal(proj, mode) {
    var schedRds = schedRoundsForProject(proj);
    var domM = readCurrentMidSectionsFromDom(proj);
    var mid = Report().buildMidReport(proj, D.intake[proj.id] || {}, schedRds, D.mid[proj.id] || null);
    mid.sections = Object.assign({}, mid.sections, domM.sections);

    var slides = [];
    var deckTitle = '';
    if (mode === 'mid') {
      slides = Pptx().buildMidSlideDeck(proj, mid);
      deckTitle = '👁️ 중간보고서 발표용 PPT 슬라이드 미리보기 (총 ' + slides.length + '장)';
    } else {
      var domF = readCurrentFinalSectionsFromDom(proj);
      var fin = Report().buildFinalReport(proj, mid, D.intake[proj.id] || {}, schedRds, D.final[proj.id] || null);
      fin.sections = Object.assign({}, fin.sections, domF.sections);
      slides = Pptx().buildFinalSlideDeck(proj, mid, fin);
      deckTitle = '👁️ 최종 결과보고서 발표용 PPT 슬라이드 미리보기 (총 ' + slides.length + '장)';
    }

    var listHtml = '<div class="slide-pv-list">' + slides.map(function (s, idx) {
      var lines = Array.isArray(s.previewLines) ? s.previewLines.slice(0, 6).join('\n') : '';
      return '<div class="slide-pv-card">' +
        '<div class="slide-pv-hd"><span class="chip c-blue">Slide ' + (idx + 1) + '</span>' +
        (s.part ? '<span class="chip">' + esc(s.part) + '</span>' : '') +
        '<span>' + esc(s.title || ('슬라이드 ' + (idx + 1))) + '</span></div>' +
        '<div class="slide-pv-bd">' + esc(lines || '표지 · 목차 구성 슬라이드') + '</div>' +
        '</div>';
    }).join('') + '</div>';

    var dlAct = mode === 'mid' ? 'dl-mid-pptx' : 'dl-final-pptx';
    openModal(deckTitle, listHtml,
      '<button class="sm" data-close-modal="1">닫기</button>' +
      '<button class="sm ok" id="pvDlPptxBtn">📊 PPTX 파일 다운로드</button>', 'xwide');

    if ($('pvDlPptxBtn')) {
      $('pvDlPptxBtn').onclick = function () {
        return withBusy($('pvDlPptxBtn'), function () {
          return handleNamedAction(dlAct);
        });
      };
    }
  }

  function openCardDetailModal(card) {
    var dk = Cat().getDocKind(card.docKind) || { name: card.docKind };
    var lines = (card.summaryLines || []).map(function (l) { return '• ' + l; }).join('\n');
    var statsJson = card.stats ? JSON.stringify(card.stats, null, 2) : '';
    var body =
      '<div class="note"><b>서류 분류:</b> ' + esc(dk.name) + '  |  <b>처리 트랙:</b> ' + (card.track === 'quant' ? '브라우저 로컬 비식별 통계 (원본 미저장)' : '개인정보 2중 가림 요약') + '</div>' +
      '<div style="font-weight:700;margin-bottom:6px">■ 핵심 분석 결과</div>' +
      '<div class="mail-body">' + esc(lines || '요약 없음') +
      (card.maskedExcerpt ? '\n\n[비식별 본문 발췌]\n' + esc(card.maskedExcerpt) : '') +
      (statsJson ? '\n\n[비식별 집계 구조체]\n' + esc(statsJson) : '') +
      '</div>';
    openModal('🔍 분석 카드 상세 — ' + (card.title || dk.name), body, '<button class="sm pri" data-close-modal="1">확인</button>', 'wide');
  }

  function openDocRequestMailModal(proj, phase, onlyCodes) {
    var sc = SCAN_CACHE[proj.id] || { matched: [] };
    var chk = Intake().summarizeChecklistProgress(phase, proj.selectedTasks, D.intake[proj.id] || {}, sc.matched, manualChecksOf(proj, phase));
    var targetDocs = chk.missingRequired;
    if (Array.isArray(onlyCodes) && onlyCodes.length) {
      var codeSet = {};
      onlyCodes.forEach(function (c) { codeSet[c] = 1; });
      targetDocs = chk.items.filter(function (it) { return !!codeSet[it.code]; });
    }
    var mailDraft = Cat().buildDocRequestMailText(proj, targetDocs, phase);
    var body =
      '<div class="note">⚠ 메일 자동 발송은 하지 않습니다. 아래 요청 문안을 복사하여 메일함 작성창에 붙여넣고 담당자가 직접 확인 후 발송하세요.</div>' +
      '<div class="fr"><label for="reqSubj">메일 제목</label><div class="fv"><input type="text" id="reqSubj" value="' + esc(mailDraft.subject) + '" readonly></div></div>' +
      '<textarea id="reqBody" aria-label="미수신 자료 요청 메일 본문" rows="13">' + esc(mailDraft.body) + '</textarea>';
    var foot =
      '<a class="act-link" href="pu-cards.html?view=mail" target="_blank" rel="noopener">✉️ 푸른 메일함 열기</a>' +
      '<button class="sm pri" id="copyReqMailBtn">📋 제목+본문 복사</button>' +
      '<button class="sm" data-close-modal="1">닫기</button>';
    openModal('✉️ 자료 요청 메일 문안', body, foot, 'wide');
    if ($('copyReqMailBtn')) {
      $('copyReqMailBtn').onclick = function () {
        copyTextToClipboard($('reqSubj').value + '\n\n' + $('reqBody').value);
        toast('요청 메일 제목과 본문을 복사했습니다.');
      };
    }
  }

  function buildCombinedPlatformTextFile(proj, pt) {
    return [
      '══════════════════════════════════════════════════════════════════════',
      '  ' + (proj.companyName || '참여기업') + ' — 노사발전재단 플랫폼 등록 입력 문안 3종 통합본',
      '══════════════════════════════════════════════════════════════════════',
      '',
      pt.planText,
      '',
      '──────────────────────────────────────────────────────────────────────',
      '【노사발전재단 회차별 수행보고서 입력 문안】',
      '──────────────────────────────────────────────────────────────────────',
      '',
      pt.roundReports.map(function (r) { return r.reportText; }).join('\n\n'),
      '',
      '──────────────────────────────────────────────────────────────────────',
      pt.followUpText
    ].join('\n');
  }

  function openPlatformTextsModal(proj) {
    var schedRds = schedRoundsForProject(proj);
    var savedMid = D.mid[proj.id] || null;
    var mid = Report().buildMidReport(proj, D.intake[proj.id] || {}, schedRds, savedMid);
    var savedFin = D.final[proj.id] || null;
    var fin = Report().buildFinalReport(proj, mid, D.intake[proj.id] || {}, schedRds, savedFin);
    var pt = Report().buildPlatformTexts(proj, mid, fin, D.intake[proj.id] || {}, schedRds);
    var rc = pt.roundCheck;

    var roundTextAll = pt.roundReports.map(function (r) { return r.reportText; }).join('\n\n────────────────────────────────────────\n\n');
    var roundStatusHtml =
      '<div class="' + (rc.faceMet && rc.allTimeAndPeopleMet ? 'ok-banner' : 'warn') + '">' +
      '<b>회차 인정 기준 신호등:</b> 총 ' + rc.totalCount + '회차 중 대면 ' + rc.faceCount + '회(' + rc.facePct + '% — 기준 70%+ ' + (rc.faceMet ? '충족✓' : '미달⚠') + ') · ' +
      '120분+ 및 기업 3인+ (' + (rc.allTimeAndPeopleMet ? '전 회차 충족✓' : '점검 필요⚠') + ') · 사진·서명지 확인 ' + rc.proofReadyCount + '/' + rc.totalCount + '회' +
      '</div>';

    var body =
      roundStatusHtml +
      '<div style="display:flex;flex-direction:column;gap:12px">' +
      '<div><div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap"><b>① 수행계획서 플랫폼 입력 문안</b><span class="sp"></span><button class="sm pri" data-copy-target="pfPlanTxt">📋 수행계획서 복사</button></div>' +
      '<textarea id="pfPlanTxt" aria-label="수행계획서 플랫폼 입력 문안" rows="7">' + esc(pt.planText) + '</textarea></div>' +
      '<div><div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap"><b>② 회차별 수행보고서 입력 문안 (형식적 제목 자동 배제됨)</b><span class="sp"></span><button class="sm pri" data-copy-target="pfRoundTxt">📋 수행보고 복사</button></div>' +
      '<textarea id="pfRoundTxt" aria-label="회차별 수행보고서 플랫폼 입력 문안" rows="8">' + esc(roundTextAll) + '</textarea></div>' +
      '<div><div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap"><b>③ 종료 후 3개월 이행관리 · 이행결과표 입력 문안</b><span class="sp"></span><button class="sm pri" data-copy-target="pfFollowTxt">📋 이행관리 복사</button></div>' +
      '<textarea id="pfFollowTxt" aria-label="종료 후 3개월 이행관리 플랫폼 입력 문안" rows="6">' + esc(pt.followUpText) + '</textarea></div>' +
      '</div>';

    openModal('📋 노사발전재단 플랫폼 입력 문안 3종 — ' + proj.companyName, body,
      '<button class="sm" data-close-modal="1">닫기</button>', 'xwide');
  }

  async function runAiPolishForSection(kindAndKey) {
    var proj = projectById(CUR_PID);
    if (!proj || !global.PuAiCall) return;
    var parts = kindAndKey.split(':');
    var mode = parts[0], secKey = parts[1];
    var ta = $((mode === 'mid' ? 'midSec_' : 'finalSec_') + secKey);
    if (!ta || !str(ta.value)) { toast('다듬을 초안 본문이 비어 있습니다.'); return; }

    var secMeta = (mode === 'mid' ? Cat().MID_SECTIONS : Cat().FINAL_SECTIONS).find(function (s) { return s.key === secKey; });
    var names = [
      { v: proj.companyName, as: '[해당 기업]' },
      { v: proj.ceoName, as: '[대표자]' },
      { v: proj.contactName, as: '[담당자]' }
    ];
    var draftSrc = ta.value;
    if (!global.PuKordocText || typeof global.PuKordocText.redactFile !== 'function') {
      toast('개인정보 1차 가림 모듈(kordoc)이 준비되지 않아 외부 AI 전송을 차단했습니다.');
      return;
    }
    var r1 = null;
    try {
      r1 = await global.PuKordocText.redactFile(null, draftSrc, ['rrn', 'money', 'phone', 'email', 'id', 'person']);
    } catch (e) {
      toast('개인정보 1차 가림(kordoc) 중 오류가 발생하여 외부 AI 전송을 차단했습니다.');
      return;
    }
    if (!r1 || typeof r1.text !== 'string') {
      toast('개인정보 1차 가림 결과를 확인할 수 없어 외부 AI 전송을 차단했습니다.');
      return;
    }
    draftSrc = r1.text;
    var req = Report().buildAiPolishPrompt(secMeta ? secMeta.title : secKey, draftSrc, names);
    if (!req.ok || Intake().hasResidualPii(req.maskedText)) {
      toast((req && req.error) || '개인정보 잔존 패턴이 감지되어 외부 AI 전송을 차단했습니다.');
      return;
    }

    toast('개인정보 가림 확인 완료 → AI 문안 윤문 요청 중…');
    try {
      var reply = await global.PuAiCall.ask([{ text: req.prompt }], {
        auth: fb.auth(),
        app: 'ilteo',
        manual: true
      });
      var rawOut = global.PuAiCall.textOf(reply);
      var unmasked = Intake().unmaskNames(rawOut, req.back);
      var numCheck = Report().checkHallucinatedNumbers(ta.value, unmasked);

      var warnBanner = numCheck.clean
        ? '<div class="ok-banner">✓ 원본 수치 일치 검증 통과 (임의 추가된 숫자 없음)</div>'
        : '<div class="warn">⚠ 원본에 없던 숫자(' + esc(numCheck.hallucinatedNumbers.join(', ')) + ')가 감지되었습니다. 반드시 확인 후 반영하세요.</div>';

      openModal('✨ AI 윤문 결과 비교 확인', warnBanner + '<textarea id="aiPolishedTxt" aria-label="AI 윤문 결과 본문" rows="12">' + esc(unmasked) + '</textarea>',
        '<button class="sm" data-close-modal="1">취소</button><button class="sm pri" id="applyAiPolishBtn">본문에 반영 (고정 켬)</button>', 'wide');

      if ($('applyAiPolishBtn')) {
        $('applyAiPolishBtn').onclick = function () {
          ta.value = $('aiPolishedTxt').value;
          var lockCb = document.querySelector('input[data-' + mode + '-lock="' + secKey + '"]');
          if (lockCb) lockCb.checked = true;
          closeModal();
          toast('윤문 문안이 입력칸에 반영되었습니다. [💾 저장]을 눌러 확정하세요.');
        };
      }
    } catch (e) {
      toast('AI 윤문 호출 실패: ' + (e.message || e));
    }
  }

  function copyTextToClipboard(text) {
    if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(function () {});
    }
  }

  /* ══ 7. 산출물 생성 도우미 (현재 화면 수정분 즉시 반영) ══════════════════ */
  function buildLiveReportsForExport(proj) {
    var schedRds = schedRoundsForProject(proj);
    var domM = readCurrentMidSectionsFromDom(proj);
    var midSaved = Object.assign({}, D.mid[proj.id] || {}, { sections: domM.sections, locks: domM.locks });
    var mid = Report().buildMidReport(proj, D.intake[proj.id] || {}, schedRds, null);
    mid.sections = Object.assign({}, mid.sections, domM.sections);
    mid.locks = domM.locks;

    var domF = readCurrentFinalSectionsFromDom(proj);
    var finSaved = Object.assign({}, D.final[proj.id] || {}, { sections: domF.sections, locks: domF.locks });
    var fin = Report().buildFinalReport(proj, mid, D.intake[proj.id] || {}, schedRds, null);
    fin.sections = Object.assign({}, fin.sections, domF.sections);
    fin.locks = domF.locks;

    return { schedRds: schedRds, midSaved: midSaved, finSaved: finSaved, mid: mid, fin: fin };
  }

  async function downloadSelectedDeliverablesZip(proj, selectedIds) {
    if (!Pack() || !global.JSZip) { toast('패키지 생성 엔진이 로드되지 않았습니다.'); return; }
    var live = buildLiveReportsForExport(proj);
    var safeCo = Pack().safeFilePart(proj.companyName);
    var idSet = {};
    selectedIds.forEach(function (id) { idSet[id] = 1; });

    var zip = new global.JSZip();
    if (idSet.mid_pptx) {
      var b1 = await Pptx().generateMidPptxBytes(proj, live.mid);
      zip.file('01_' + safeCo + '_일터혁신_중간보고서.pptx', b1);
    }
    if (idSet.final_pptx) {
      var b2 = await Pptx().generateFinalPptxBytes(proj, live.mid, live.fin);
      zip.file('02_' + safeCo + '_일터혁신_최종결과보고서.pptx', b2);
    }
    if (idSet.rules_docx) {
      var b3 = await Pack().generateWorkRulesDocxBytes(proj, live.mid, live.fin);
      zip.file('03_' + safeCo + '_취업규칙개정안_신구대조표.docx', b3);
    }
    if (idSet.contract_docx) {
      var b4 = await Pack().generateLaborContractDocxBytes(proj, live.mid, live.fin);
      zip.file('04_' + safeCo + '_표준근로계약서_서면합의동의서.docx', b4);
    }
    if (idSet.sim_xlsx) {
      var b5 = Pack().generateSimulationXlsxBytes(proj, live.mid, live.fin, D.intake[proj.id] || {}, live.schedRds);
      zip.file('05_' + safeCo + '_통상시급모의계산_신구대조_이행점검표.xlsx', b5);
    }
    if (idSet.platform_txt) {
      var pt = Report().buildPlatformTexts(proj, live.mid, live.fin, D.intake[proj.id] || {}, live.schedRds);
      zip.file('06_' + safeCo + '_노사발전재단_플랫폼입력문안_3종.txt', buildCombinedPlatformTextFile(proj, pt));
    }
    var zipBytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
    Pack().downloadBytes(zipBytes, safeCo + '_일터혁신_선택산출물_' + selectedIds.length + '종.zip', 'application/zip');
  }

  /* ══ 8. 이벤트 바인딩 (끌어고르기 포함) 및 일괄 실행 ═════════════════════ */
  function readCurrentMidSectionsFromDom(proj) {
    var saved = D.mid[proj.id] || {};
    var secs = Object.assign({}, saved.sections || {});
    var locks = Object.assign({}, saved.locks || {});
    Cat().MID_SECTIONS.forEach(function (s) {
      var ta = $('midSec_' + s.key);
      if (ta) secs[s.key] = ta.value;
      var cb = document.querySelector('input[data-mid-lock="' + s.key + '"]');
      if (cb) locks[s.key] = !!cb.checked;
    });
    return { sections: secs, locks: locks };
  }

  function readCurrentFinalSectionsFromDom(proj) {
    var saved = D.final[proj.id] || {};
    var secs = Object.assign({}, saved.sections || {});
    var locks = Object.assign({}, saved.locks || {});
    Cat().FINAL_SECTIONS.forEach(function (s) {
      var ta = $('finalSec_' + s.key);
      if (ta) secs[s.key] = ta.value;
      var cb = document.querySelector('input[data-final-lock="' + s.key + '"]');
      if (cb) locks[s.key] = !!cb.checked;
    });
    return { sections: secs, locks: locks };
  }

  function buildDiscoverProjectPayload(c) {
    var co = findCompanyById(c.companyId);
    var id = 'ilt_' + safeKey(c.companyId) + '_' + (c.year || 2026);
    return {
      id: id,
      entityType: 'Project',
      companyId: c.companyId,
      consultingId: c.consultingId || '',
      companyName: c.companyName,
      bizNo: c.bizNo,
      ceoName: co ? str(co.ceo || co.ceoName) : '',
      contactName: contactNameOfCompany(co),
      industry: c.industry,
      year: c.year || 2026,
      programName: c.programName || '일터혁신 상생컨설팅',
      isIlteo: c.isIlteo !== false,
      level: 'deep',
      contactEmails: c.contactEmail ? [c.contactEmail] : [],
      scalCoId: c.scalCoId || '',
      scalTypeId: c.scalTypeId || '',
      selectedTasks: ['wt_45day', 'wg_redesign'],
      consultantName: ME.name ? ME.name + ' 공인노무사' : '푸른노무법인 전담 노무사',
      designTeamCount: 4
    };
  }

  async function activateDiscoverCandidate(candKey) {
    var c = DISCOVER_LIST.find(function (x) { return x.candKey === candKey; });
    if (!c) return null;
    return saveProjectRecord(buildDiscoverProjectPayload(c));
  }

  function bindDragSel() {
    document.addEventListener('mousedown', function (e) {
      if (e.button !== 0) return;
      var directCb = e.target.closest ? e.target.closest('input[data-ck]') : null;
      var cellC = !directCb && e.target.closest ? e.target.closest('td.c') : null;
      var cb = directCb || (cellC ? cellC.querySelector('input[data-ck]') : null);
      if (!cb) return;
      var ckKey = cb.getAttribute('data-ck') || '';
      var listName = ckKey.split('|')[0];
      if (!listName) return;

      var targetVal = !cb.checked;
      DRAG_SEL = { active: true, listName: listName, targetVal: targetVal, startKey: ckKey, moved: false };
      if (cellC && !directCb) {
        e.preventDefault();
        cb.checked = targetVal;
        SEL[ckKey] = targetVal;
        syncHeaderCheckbox(listName);
        drawBulks();
      }
    });

    document.addEventListener('mouseover', function (e) {
      if (!DRAG_SEL.active || !DRAG_SEL.listName) return;
      var rowEl = e.target.closest
        ? (e.target.closest('tr[data-tname="' + DRAG_SEL.listName + '"]')
          || e.target.closest('[data-sec-name="' + DRAG_SEL.listName + '"] .rpt-sec-card'))
        : null;
      if (!rowEl) return;
      var cb = rowEl.querySelector('input[data-ck]');
      if (!cb) return;
      var ckKey = cb.getAttribute('data-ck');
      if (ckKey === DRAG_SEL.startKey && !DRAG_SEL.moved) return;

      if (!DRAG_SEL.moved) {
        DRAG_SEL.moved = true;
        var startCb = document.querySelector('input[data-ck="' + DRAG_SEL.startKey.replace(/"/g, '\\"') + '"]');
        if (startCb) {
          startCb.checked = DRAG_SEL.targetVal;
          SEL[DRAG_SEL.startKey] = DRAG_SEL.targetVal;
        }
      }
      if (cb.checked !== DRAG_SEL.targetVal) {
        cb.checked = DRAG_SEL.targetVal;
        SEL[ckKey] = DRAG_SEL.targetVal;
        syncHeaderCheckbox(DRAG_SEL.listName);
        drawBulks();
      }
    });

    global.addEventListener('mouseup', function () {
      DRAG_SEL.active = false;
    });
  }

  function bindEvents() {
    bindDragSel();

    if ($('tabs')) {
      $('tabs').addEventListener('click', function (e) {
        var btn = e.target.closest('button[data-tab]');
        if (!btn) return;
        TAB = btn.getAttribute('data-tab');
        clearSel();
        draw();
      });
      $('tabs').addEventListener('keydown', function (e) {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End') return;
        var btns = Array.prototype.slice.call($('tabs').querySelectorAll('button[data-tab]'));
        if (!btns.length) return;
        var curBtn = e.target && e.target.closest ? e.target.closest('button[data-tab]') : null;
        var curIdx = curBtn ? btns.indexOf(curBtn) : -1;
        if (curIdx < 0) curIdx = btns.findIndex(function (b) { return b.getAttribute('data-tab') === TAB; });
        if (curIdx < 0) curIdx = 0;
        var nextIdx = curIdx;
        if (e.key === 'ArrowRight') nextIdx = (curIdx + 1) % btns.length;
        else if (e.key === 'ArrowLeft') nextIdx = (curIdx - 1 + btns.length) % btns.length;
        else if (e.key === 'Home') nextIdx = 0;
        else if (e.key === 'End') nextIdx = btns.length - 1;
        e.preventDefault();
        var nextBtn = btns[nextIdx];
        TAB = nextBtn.getAttribute('data-tab');
        clearSel();
        draw();
        try { nextBtn.focus(); } catch (err) {}
      });
    }
    if ($('reloadBtn')) {
      $('reloadBtn').onclick = function () {
        return withBusy($('reloadBtn'), function () { return reload(); });
      };
    }
    if ($('scanAllBtn')) {
      $('scanAllBtn').onclick = function () {
        rebuildScanAndDiscover();
        draw();
        toast('전체 사업장 메일 수신 현황 재점검 완료');
      };
    }
    if ($('newProjBtn')) $('newProjBtn').onclick = openNewProjectModal;
    ['projQ', 'projYear', 'projStage'].forEach(function (id) {
      var el = $(id);
      if (!el) return;
      el.addEventListener(id === 'projQ' ? 'input' : 'change', function () {
        clearSel('projects');
        draw();
      });
    });

    if ($('modal')) {
      $('modal').addEventListener('click', function (e) {
        if (e.target === $('modal') || e.target.closest('[data-close-modal]')) { closeModal(); return; }
        var cpBtn = e.target.closest('[data-copy-target]');
        if (cpBtn) {
          var tid = cpBtn.getAttribute('data-copy-target');
          var el = $(tid);
          if (el) { copyTextToClipboard(el.value); toast('클립보드에 복사되었습니다.'); }
        }
      });
    }

    document.addEventListener('change', function (e) {
      var allCb = e.target.closest('input[data-all]');
      if (allCb) {
        var nm = allCb.getAttribute('data-all');
        /* 먼저 같은 목록의 이전 선택을 비우고 지금 보이는(걸러진) 항목만 토글 */
        pickedIds(nm).forEach(function (id) { delete SEL[nm + '|' + id]; });
        listCheckboxesInDom(nm).forEach(function (cb) {
          cb.checked = allCb.checked;
          SEL[cb.getAttribute('data-ck')] = allCb.checked;
        });
        syncHeaderCheckbox(nm);
        drawBulks();
        return;
      }
      var rowCb = e.target.closest('input[data-ck]');
      if (rowCb) {
        var ck = rowCb.getAttribute('data-ck') || '';
        SEL[ck] = rowCb.checked;
        syncHeaderCheckbox(ck.split('|')[0]);
        drawBulks();
        return;
      }
      if (e.target && e.target.matches && e.target.matches('select[data-proj-sel]')) {
        CUR_PID = e.target.value;
        clearSel();
        draw();
      }
    });

    document.addEventListener('keydown', function (e) {
      var modal = $('modal'), mbox = $('mbox');
      if (!modal || modal.style.display === 'none') return;
      if (e.key === 'Escape') {
        e.preventDefault();
        closeModal();
        return;
      }
      if (e.key === 'Tab' && mbox) {
        var focusables = Array.prototype.slice.call(
          mbox.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')
        );
        if (!focusables.length) return;
        var first = focusables[0], last = focusables[focusables.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === mbox)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });

    document.addEventListener('click', async function (e) {
      var gotoBtn = e.target.closest('[data-goto-tab]');
      if (gotoBtn) {
        TAB = gotoBtn.getAttribute('data-goto-tab');
        clearSel();
        draw();
        return;
      }

      var openProjBtn = e.target.closest('[data-open-proj]');
      if (openProjBtn) {
        CUR_PID = openProjBtn.getAttribute('data-open-proj');
        TAB = openProjBtn.getAttribute('data-open-tab') || 'intake';
        clearSel();
        draw();
        return;
      }

      var actCand = e.target.closest('[data-activate-cand]');
      if (actCand) {
        await withBusy(actCand, async function () {
          var created = await activateDiscoverCandidate(actCand.getAttribute('data-activate-cand'));
          if (created) {
            CUR_PID = created.id;
            TAB = 'intake';
            clearSel();
            rebuildScanAndDiscover();
            draw();
            toast(created.companyName + ' 워크스페이스 활성화 완료');
          }
        });
        return;
      }

      var toggleChkBtn = e.target.closest('[data-toggle-chk]');
      if (toggleChkBtn && CUR_PID) {
        await withBusy(toggleChkBtn, async function () {
          var projC = projectById(CUR_PID);
          if (!projC) return;
          var dkCode = toggleChkBtn.getAttribute('data-toggle-chk');
          var ph = toggleChkBtn.getAttribute('data-phase') || 'pre_mid';
          var mc = Object.assign({}, projC.manualChecks || {});
          var sub = Object.assign({}, mc[ph] || {});
          sub[dkCode] = !sub[dkCode];
          mc[ph] = sub;
          await saveProjectRecord(Object.assign({}, projC, { manualChecks: mc }));
          draw();
          toast(sub[dkCode] ? '오프라인·직접 수령 확인 표시됨' : '수기 수령 확인 해제됨');
        });
        return;
      }

      var editRdBtn = e.target.closest('[data-edit-round]');
      if (editRdBtn && CUR_PID) {
        var projR = projectById(CUR_PID);
        if (projR) openRoundEditModal(projR, Number(editRdBtn.getAttribute('data-edit-round')));
        return;
      }

      var toggleRdProofBtn = e.target.closest('[data-toggle-round-proof]');
      if (toggleRdProofBtn && CUR_PID) {
        await withBusy(toggleRdProofBtn, async function () {
          var projRP = projectById(CUR_PID);
          if (!projRP) return;
          var rno = Number(toggleRdProofBtn.getAttribute('data-toggle-round-proof'));
          var rds = currentNormalizedRounds(projRP).map(function (r) {
            if (Number(r.roundNo) !== rno) return r;
            var nextOk = !(r.hasPhoto && r.hasSign);
            return Object.assign({}, r, { hasPhoto: nextOk, hasSign: nextOk });
          });
          await saveProjectRecord(Object.assign({}, projRP, { rounds: rds }));
          draw();
          toast(rno + '회차 사진·서명지 증빙 상태가 변경되었습니다.');
        });
        return;
      }

      var editDfBtn = e.target.closest('[data-edit-diff]');
      if (editDfBtn && CUR_PID) {
        var projD = projectById(CUR_PID);
        if (projD) openDiffEditModal(projD, editDfBtn.getAttribute('data-edit-diff'));
        return;
      }

      var toggleFuBtn = e.target.closest('[data-toggle-followup]');
      if (toggleFuBtn && CUR_PID) {
        await withBusy(toggleFuBtn, async function () {
          var projFu = projectById(CUR_PID);
          if (!projFu) return;
          var fuCode = toggleFuBtn.getAttribute('data-toggle-followup');
          var nextFu = Object.assign({}, projFu.followupChecks || {});
          nextFu[fuCode] = !nextFu[fuCode];
          await saveProjectRecord(Object.assign({}, projFu, { followupChecks: nextFu }));
          draw();
          toast(nextFu[fuCode] ? '사후 이행완료로 체크되었습니다.' : '점검예정 상태로 변경되었습니다.');
        });
        return;
      }

      var mailIns = e.target.closest('[data-mail-inspect]');
      if (mailIns) {
        await withBusy(mailIns, function () {
          return inspectAndAnalyzeMail(mailIns.getAttribute('data-mail-inspect'), mailIns.getAttribute('data-phase') || 'pre_mid', false);
        });
        return;
      }

      var mailChk = e.target.closest('[data-mail-check]');
      if (mailChk) {
        await withBusy(mailChk, async function () {
          await markMailCheckedOnly(mailChk.getAttribute('data-mail-check'), mailChk.getAttribute('data-phase') || 'pre_mid');
          toast('메일 확인완료 표시됨');
        });
        return;
      }

      var viewCardBtn = e.target.closest('[data-view-card]');
      if (viewCardBtn && CUR_PID) {
        var cid = viewCardBtn.getAttribute('data-view-card');
        var card = D.intake[CUR_PID] && D.intake[CUR_PID][cid];
        if (card) openCardDetailModal(card);
        return;
      }

      var saveMidSec = e.target.closest('[data-save-mid-sec]');
      if (saveMidSec && CUR_PID) {
        await withBusy(saveMidSec, async function () {
          var projM = projectById(CUR_PID);
          if (!projM) return;
          var domMid = readCurrentMidSectionsFromDom(projM);
          await saveMidDoc(projM, domMid.sections, domMid.locks);
          toast('중간보고서 섹션이 저장되었습니다.');
        });
        return;
      }

      var saveFinSec = e.target.closest('[data-save-final-sec]');
      if (saveFinSec && CUR_PID) {
        await withBusy(saveFinSec, async function () {
          var projF = projectById(CUR_PID);
          if (!projF) return;
          var domFin = readCurrentFinalSectionsFromDom(projF);
          await saveFinalDoc(projF, domFin.sections, domFin.locks);
          toast('최종 결과보고서 섹션이 저장되었습니다.');
        });
        return;
      }

      var aiBtn = e.target.closest('[data-ai-polish]');
      if (aiBtn) {
        await withBusy(aiBtn, function () {
          return runAiPolishForSection(aiBtn.getAttribute('data-ai-polish'));
        });
        return;
      }

      var bulkBtn = e.target.closest('[data-bulkact]');
      if (bulkBtn) {
        await withBusy(bulkBtn, function () {
          return handleBulkAction(bulkBtn.getAttribute('data-bulkact'));
        });
        return;
      }

      var actBtn = e.target.closest('[data-act]');
      if (actBtn) {
        await withBusy(actBtn, function () {
          return handleNamedAction(actBtn.getAttribute('data-act'));
        });
        return;
      }

      if (!e.target.closest('input,button,select,a,label,textarea,td.c,th.c')) {
        var tr = e.target.closest('tr[data-row][data-tname="projects"]');
        if (tr) {
          CUR_PID = tr.getAttribute('data-row');
          TAB = 'intake';
          clearSel();
          draw();
        }
      }
    });
  }

  async function handleBulkAction(spec) {
    var parts = spec.split(':');
    var nm = parts[0], op = parts[1];
    if (op === 'clear') { clearSel(nm); drawBulks(); return; }
    var ids = pickedIds(nm);
    if (!ids.length) return;
    var proj = projectById(CUR_PID);

    if (nm === 'discover' && op === 'activate') {
      if (!askConfirm('선택한 자동 발견 후보 ' + ids.length + '건을 일괄 워크스페이스 활성화하시겠습니까?')) return;
      var actEntries = [];
      ids.forEach(function (ck) {
        var cand = DISCOVER_LIST.find(function (x) { return x.candKey === ck; });
        if (!cand) return;
        var rec = buildDiscoverProjectPayload(cand);
        actEntries.push({
          path: 'scal_ilteo/projects/' + rec.id,
          previous: D.projects[rec.id] || null,
          record: rec,
          entityType: 'Project'
        });
      });
      var savedAct = await atomicMultiRecordUpdate(actEntries);
      if (savedAct) {
        Object.keys(savedAct).forEach(function (pathKey) {
          var val = savedAct[pathKey];
          if (val && val.id) D.projects[val.id] = val;
        });
      }
      clearSel(nm);
      rebuildScanAndDiscover();
      draw();
      toast(actEntries.length + '개 사업장 워크스페이스 활성화 완료');
    } else if (nm === 'projects' && op === 'del') {
      if (typeof global.confirm === 'function' && !global.confirm('선택한 사업장 ' + ids.length + '건을 목록에서 숨김(소프트 삭제) 처리하시겠습니까?')) return;
      var delProjEntries = [];
      ids.forEach(function (pid) {
        var rec = D.projects[pid];
        if (rec) {
          delProjEntries.push({
            path: 'scal_ilteo/projects/' + rec.id,
            previous: rec,
            tombstone: true,
            entityType: 'Project'
          });
        }
      });
      await atomicMultiRecordUpdate(delProjEntries);
      ids.forEach(function (pid) { if (D.projects[pid]) D.projects[pid]._deleted = true; });
      clearSel(nm);
      rebuildScanAndDiscover();
      draw();
      toast('선택 사업장 ' + delProjEntries.length + '건을 목록에서 숨겼습니다(소프트 삭제).');
    } else if ((nm === 'preChk' || nm === 'postChk') && proj) {
      var phChk = nm === 'postChk' ? 'post_mid' : 'pre_mid';
      if (op === 'reqmail') {
        openDocRequestMailModal(proj, phChk, ids);
        return;
      }
      var markVal = op === 'check';
      if (!askConfirm('선택한 체크리스트 ' + ids.length + '건을 일괄 ' + (markVal ? '수령확인 완료' : '수령확인 해제') + ' 처리하시겠습니까?')) return;
      var mcAll = Object.assign({}, proj.manualChecks || {});
      var subChk = Object.assign({}, mcAll[phChk] || {});
      ids.forEach(function (code) { subChk[code] = markVal; });
      mcAll[phChk] = subChk;
      await saveProjectRecord(Object.assign({}, proj, { manualChecks: mcAll }));
      clearSel(nm);
      draw();
      toast(ids.length + '건 체크리스트 상태가 한 번에 저장되었습니다.');
    } else if ((nm === 'preMails' || nm === 'postMails' || nm === 'candMails') && (op === 'analyze' || op === 'check') && proj) {
      var phMail = nm === 'postMails' ? 'post_mid' : 'pre_mid';
      if (!askConfirm('선택한 메일 ' + ids.length + '건을 일괄 ' + (op === 'analyze' ? '내용확인·분석' : '확인완료 표시') + ' 처리하시겠습니까?')) return;
      if (op === 'check') {
        var mailEntries = [];
        for (var mki = 0; mki < ids.length; mki++) {
          var built = await buildCheckedMailCardPayload(proj, ids[mki], phMail);
          if (built) {
            mailEntries.push({
              path: 'scal_ilteo/intake/' + proj.id + '/' + built.record.id,
              previous: built.prev,
              record: built.record,
              entityType: 'Document'
            });
          }
        }
        var savedMails = await atomicMultiRecordUpdate(mailEntries);
        if (!D.intake[proj.id]) D.intake[proj.id] = {};
        if (savedMails) {
          Object.keys(savedMails).forEach(function (pk) {
            var v = savedMails[pk];
            if (v && v.id) D.intake[proj.id][v.id] = v;
          });
        }
      } else {
        for (var m = 0; m < ids.length; m++) {
          await inspectAndAnalyzeMail(ids[m], phMail, true);
        }
      }
      clearSel(nm);
      rebuildScanAndDiscover();
      draw();
      toast(ids.length + '건 메일 일괄 처리 완료');
    } else if ((nm === 'preCards' || nm === 'postCards') && op === 'del' && CUR_PID) {
      if (typeof global.confirm === 'function' && !global.confirm('선택한 분석카드 ' + ids.length + '건을 삭제하시겠습니까?')) return;
      var cardDelEntries = [];
      ids.forEach(function (cid) {
        var prevC = D.intake[CUR_PID] && D.intake[CUR_PID][cid];
        if (prevC) {
          cardDelEntries.push({
            path: 'scal_ilteo/intake/' + CUR_PID + '/' + prevC.id,
            previous: prevC,
            tombstone: true,
            entityType: 'Document'
          });
        }
      });
      await atomicMultiRecordUpdate(cardDelEntries);
      ids.forEach(function (cid) { if (D.intake[CUR_PID] && D.intake[CUR_PID][cid]) D.intake[CUR_PID][cid]._deleted = true; });
      clearSel(nm);
      rebuildScanAndDiscover();
      draw();
      toast('선택 분석카드 ' + cardDelEntries.length + '건을 삭제했습니다.');
    } else if (nm === 'rounds' && proj) {
      if (!askConfirm('선택한 회차 ' + ids.length + '건에 일괄 작업을 적용하시겠습니까?')) return;
      var selNoSet = {};
      ids.forEach(function (id) { selNoSet[Number(id)] = 1; });
      var curRds = currentNormalizedRounds(proj);
      var nextRds = [];
      if (op === 'del') {
        nextRds = curRds.filter(function (r) { return !selNoSet[Number(r.roundNo)]; })
          .map(function (r, idx) { return Object.assign({}, r, { roundNo: idx + 1 }); });
      } else {
        nextRds = curRds.map(function (r) {
          if (!selNoSet[Number(r.roundNo)]) return r;
          if (op === 'proofOn') return Object.assign({}, r, { hasPhoto: true, hasSign: true });
          if (op === 'proofOff') return Object.assign({}, r, { hasPhoto: false, hasSign: false });
          if (op === 'face') return Object.assign({}, r, { mode: 'face' });
          if (op === 'remote') return Object.assign({}, r, { mode: 'remote' });
          return r;
        });
      }
      await saveProjectRecord(Object.assign({}, proj, { rounds: nextRds }));
      clearSel(nm);
      draw();
      toast('선택 회차 ' + ids.length + '건 일괄 반영 완료');
    } else if ((nm === 'midSecs' || nm === 'finalSecs') && proj) {
      var isMid = nm === 'midSecs';
      if (!askConfirm('선택한 보고서 섹션 ' + ids.length + '건을 일괄 ' + (op === 'save' ? '저장' : (op === 'lock' ? '수기 고정' : '고정 해제')) + '하시겠습니까?')) return;
      var domState = isMid ? readCurrentMidSectionsFromDom(proj) : readCurrentFinalSectionsFromDom(proj);
      var savedBase = (isMid ? D.mid[proj.id] : D.final[proj.id]) || {};
      var nextSecs = Object.assign({}, savedBase.sections || {});
      var nextLocks = Object.assign({}, domState.locks || {});
      ids.forEach(function (secKey) {
        nextSecs[secKey] = domState.sections[secKey];
        if (op === 'lock') nextLocks[secKey] = true;
        else if (op === 'unlock') nextLocks[secKey] = false;
      });
      if (isMid) await saveMidDoc(proj, nextSecs, nextLocks);
      else await saveFinalDoc(proj, nextSecs, nextLocks);
      clearSel(nm);
      draw();
      toast('선택 섹션 ' + ids.length + '건이 한 번에 저장되었습니다.');
    } else if (nm === 'diffRows' && proj) {
      if (!askConfirm('선택한 협의 Diff ' + ids.length + '건에 일괄 변경을 적용하시겠습니까?')) return;
      var idSetDf = {};
      ids.forEach(function (id) { idSetDf[id] = 1; });
      var nextStMap = Object.assign({}, proj.diffStatusMap || {});
      var nextCust = Array.isArray(proj.customDiffRows) ? proj.customDiffRows.slice() : [];
      if (op === 'del') {
        nextCust = nextCust.map(function (r) {
          return (r && idSetDf[r.id]) ? Object.assign({}, r, { _deleted: true }) : r;
        });
      } else {
        var label = op === 'confirm' ? '합의 확정 ✓' : '추가 협의중';
        ids.forEach(function (id) { nextStMap[id] = label; });
      }
      await saveProjectRecord(Object.assign({}, proj, { diffStatusMap: nextStMap, customDiffRows: nextCust }));
      clearSel(nm);
      draw();
      toast('선택 Diff 항목 ' + ids.length + '건이 반영되었습니다.');
    } else if (nm === 'deliverables' && op === 'zip' && proj) {
      await downloadSelectedDeliverablesZip(proj, ids);
      clearSel(nm);
      drawBulks();
      toast('선택 산출물 ' + ids.length + '종 통합 ZIP 파일을 생성했습니다.');
    } else if (nm === 'followups' && proj) {
      var doneFlag = op === 'done';
      if (!askConfirm('선택한 사후 이행점검 ' + ids.length + '건을 일괄 ' + (doneFlag ? '이행완료' : '점검예정') + ' 처리하시겠습니까?')) return;
      var nextFuMap = Object.assign({}, proj.followupChecks || {});
      ids.forEach(function (code) { nextFuMap[code] = doneFlag; });
      await saveProjectRecord(Object.assign({}, proj, { followupChecks: nextFuMap }));
      clearSel(nm);
      draw();
      toast('사후 이행관리 ' + ids.length + '건 상태가 한 번에 저장되었습니다.');
    }
  }

  async function handleNamedAction(act) {
    var proj = projectById(CUR_PID);
    if (!proj) return;

    if (act === 'open-task-modal') {
      openTaskConfigModal(proj);
    } else if (act === 'req-mail-pre') {
      openDocRequestMailModal(proj, 'pre_mid');
    } else if (act === 'req-mail-post') {
      openDocRequestMailModal(proj, 'post_mid');
    } else if (act === 'add-round') {
      openRoundEditModal(proj, null);
    } else if (act === 'add-diff') {
      openDiffEditModal(proj, null);
    } else if (act === 'preview-mid-pptx') {
      openSlidePreviewModal(proj, 'mid');
    } else if (act === 'preview-final-pptx') {
      openSlidePreviewModal(proj, 'final');
    } else if (act === 'save-interviews') {
      var iv = null;
      try {
        iv = {
          exec: await sanitizeMetaLabelAsync(str($('ivExec') && $('ivExec').value), proj, { sentence: true }),
          hr: await sanitizeMetaLabelAsync(str($('ivHr') && $('ivHr').value), proj, { sentence: true }),
          worker: await sanitizeMetaLabelAsync(str($('ivWorker') && $('ivWorker').value), proj, { sentence: true })
        };
      } catch (ivErr) {
        toast((ivErr && ivErr.message) || '인터뷰 메모에 민감 고유식별정보 패턴이 감지되어 차단했습니다.');
        return;
      }
      await saveProjectRecord(Object.assign({}, proj, { interviews: iv }));
      toast('계층별 인터뷰 메모가 저장되었습니다.');
      draw();
    } else if (act === 'regen-mid') {
      var curMid = readCurrentMidSectionsFromDom(proj);
      var builtM = Report().buildMidReport(proj, D.intake[proj.id] || {}, schedRoundsForProject(proj), {
        sections: curMid.sections,
        locks: curMid.locks
      });
      await saveMidDoc(proj, builtM.sections, builtM.locks);
      draw();
      toast('수집된 기초자료 기준으로 중간보고서가 자동 정리되었습니다(수기 고정 섹션 보존).');
    } else if (act === 'dl-mid-pptx') {
      var liveM = buildLiveReportsForExport(proj);
      var midBytes = await Pptx().generateMidPptxBytes(proj, liveM.mid);
      var safeCoM = Pack() ? Pack().safeFilePart(proj.companyName) : proj.companyName.replace(/[\\/:*?"<>|]/g, '_');
      Pptx().downloadPptxBytes(midBytes, safeCoM + '_일터혁신_중간보고서.pptx');
      toast('중간보고서 PPTX 파일을 생성했습니다.');
    } else if (act === 'confirm-mid-baseline') {
      var domM2 = readCurrentMidSectionsFromDom(proj);
      await saveMidDoc(proj, domM2.sections, domM2.locks);
      var midObj = Report().buildMidReport(proj, D.intake[proj.id] || {}, schedRoundsForProject(proj), {
        sections: domM2.sections, locks: domM2.locks
      });
      var now = Date.now();
      var snap = Report().buildMidSnapshot(proj, midObj, ME.sid, now);
      await saveImmutableSnapshot(proj, snap);
      await saveProjectRecord(Object.assign({}, proj, { midConfirmedAt: now, stage: 'design' }));
      clearSel();
      rebuildScanAndDiscover();
      TAB = 'final';
      draw();
      toast('중간보고 기준선이 확정되었습니다. 이제 후속 메일 자동 감시 단계로 전환됩니다.');
    } else if (act === 'regen-final') {
      var curFin = readCurrentFinalSectionsFromDom(proj);
      var schedRdsF = schedRoundsForProject(proj);
      var baseMid = Report().buildMidReport(proj, D.intake[proj.id] || {}, schedRdsF, D.mid[proj.id] || null);
      var builtF = Report().buildFinalReport(proj, baseMid, D.intake[proj.id] || {}, schedRdsF, {
        sections: curFin.sections,
        locks: curFin.locks
      });
      await saveFinalDoc(proj, builtF.sections, builtF.locks);
      draw();
      toast('중간보고 기준선과 후속 메일 Diff를 반영해 최종 결과보고서를 조립했습니다.');
    } else if (act === 'dl-final-pptx') {
      var liveF = buildLiveReportsForExport(proj);
      var finBytes = await Pptx().generateFinalPptxBytes(proj, liveF.mid, liveF.fin);
      var safeCoF = Pack() ? Pack().safeFilePart(proj.companyName) : proj.companyName.replace(/[\\/:*?"<>|]/g, '_');
      Pptx().downloadPptxBytes(finBytes, safeCoF + '_일터혁신_최종결과보고서.pptx');
      toast('최종 결과보고서 PPTX 파일을 생성했습니다.');
    } else if (act === 'dl-rules-docx' && Pack()) {
      var liveR = buildLiveReportsForExport(proj);
      var rulesBytes = await Pack().generateWorkRulesDocxBytes(proj, liveR.mid, liveR.fin);
      Pack().downloadBytes(rulesBytes, Pack().safeFilePart(proj.companyName) + '_취업규칙개정안_신구대조표.docx',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      toast('취업규칙 개정안 및 신구대조표(.docx)를 생성했습니다.');
    } else if (act === 'dl-contract-docx' && Pack()) {
      var liveC = buildLiveReportsForExport(proj);
      var contBytes = await Pack().generateLaborContractDocxBytes(proj, liveC.mid, liveC.fin);
      Pack().downloadBytes(contBytes, Pack().safeFilePart(proj.companyName) + '_표준근로계약서_서면합의동의서.docx',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      toast('표준 근로계약서 및 서면합의서(.docx)를 생성했습니다.');
    } else if (act === 'dl-sim-xlsx' && Pack()) {
      var liveX = buildLiveReportsForExport(proj);
      var xlsxBytes = Pack().generateSimulationXlsxBytes(proj, liveX.mid, liveX.fin, D.intake[proj.id] || {}, liveX.schedRds);
      Pack().downloadBytes(xlsxBytes, Pack().safeFilePart(proj.companyName) + '_통상시급모의계산_신구대조_이행점검표.xlsx',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      toast('비식별 모의계산 및 사후 이행점검표(.xlsx, 6개 시트)를 생성했습니다.');
    } else if (act === 'dl-platform-txt' && Pack()) {
      var liveT = buildLiveReportsForExport(proj);
      var ptTxt = Report().buildPlatformTexts(proj, liveT.mid, liveT.fin, D.intake[proj.id] || {}, liveT.schedRds);
      var txtBytes = new TextEncoder().encode(buildCombinedPlatformTextFile(proj, ptTxt));
      Pack().downloadBytes(txtBytes, Pack().safeFilePart(proj.companyName) + '_노사발전재단_플랫폼입력문안_3종.txt', 'text/plain;charset=utf-8');
      toast('노사발전재단 플랫폼 입력문안 3종(.txt)을 생성했습니다.');
    } else if (act === 'dl-full-zip' && Pack()) {
      var liveZ = buildLiveReportsForExport(proj);
      toast('최종산출물 6종 통합 ZIP 패키지 생성 중…');
      var zipBytes = await Pack().generateFullPackageZipBytes(proj, D.intake[proj.id] || {}, liveZ.schedRds, liveZ.midSaved, liveZ.finSaved);
      Pack().downloadBytes(zipBytes, Pack().safeFilePart(proj.companyName) + '_일터혁신_최종산출물_6종패키지.zip', 'application/zip');
      toast('최종산출물 6종 통합 ZIP 패키지를 다운로드했습니다.');
    } else if (act === 'open-platform-modal') {
      openPlatformTextsModal(proj);
    } else if (act === 'confirm-final-snapshot') {
      var domF2 = readCurrentFinalSectionsFromDom(proj);
      await saveFinalDoc(proj, domF2.sections, domF2.locks);
      var nowF = Date.now();
      await saveImmutableSnapshot(proj, {
        id: 'snap_final_' + nowF,
        kind: 'final_report',
        title: proj.companyName + ' 최종 결과보고 확정 스냅샷',
        sections: domF2.sections,
        confirmedBy: ME.sid,
        confirmedAt: nowF
      });
      await saveProjectRecord(Object.assign({}, proj, { finalConfirmedAt: nowF, stage: 'followup' }));
      draw();
      toast('최종 결과보고 스냅샷이 불변 저장되었습니다.');
    }
  }

  function lockScreen(why) {
    if ($('app')) $('app').style.display = 'none';
    if ($('lock')) $('lock').style.display = 'block';
    if ($('lockWhy')) $('lockWhy').textContent = why || '';
  }

  function boot(firebaseInstance) {
    fb = firebaseInstance;
    fbDb = fb.database();
    bindEvents();
    try { fb.auth().setPersistence(fb.auth.Auth.Persistence.LOCAL); } catch (e) {}
    fb.auth().onAuthStateChanged(async function (u) {
      var authUid = (u && u.uid) ? String(u.uid) : '';
      if ($('outBtn')) $('outBtn').style.display = authUid ? '' : 'none';
      if (!authUid) {
        purgeSessionState();
        if ($('lock')) $('lock').style.display = 'none';
        if (global.PuGate) global.PuGate.show();
        return;
      }
      if (ME && ME.uid && ME.uid !== authUid) purgeSessionState();
      var authEpoch = ++SESSION_EPOCH;
      if (global.PuGate) global.PuGate.hide();

      var roleVal = {};
      try { roleVal = (await fbDb.ref('uid_roles/' + authUid).once('value')).val() || {}; } catch (e) {}
      if (authEpoch !== SESSION_EPOCH || currentAuthUid() !== authUid) return;
      if (roleVal.status !== 'active' || !roleVal.sid) {
        purgeSessionState();
        lockScreen('재직 중인 직원 계정이 아닙니다.');
        return;
      }

      ME = {
        uid: authUid,
        sid: String(roleVal.sid),
        name: String(roleVal.name || ''),
        email: String(u.email || '').toLowerCase(),
        isAdmin: roleVal.isAdmin == true,
        isSubAdmin: roleVal.isSubAdmin == true
      };
      gate = global.PuOntologyWrite.createGateway({ mode: 'enforce', actor: ME.sid });
      if ($('lock')) $('lock').style.display = 'none';
      if ($('app')) $('app').style.display = '';
      await reload(authEpoch, authUid);
    });
  }

  global.PuIlteoView = {
    boot: boot,
    reload: reload
  };
})(typeof window !== 'undefined' ? window : globalThis);
