/* 푸른통합시스템 — 안전보건체계구축 통합 워크스페이스 컨트롤러 (safety.html 전용 window.PuSafetyView)
 *
 * 맡는 일:
 *   1. 직원 권한(uid_roles status=active + sid) · 세션 격리(SESSION_EPOCH) · PuOntologyWrite 강제 관문(enforce) 연결
 *   2. 과거 안전보건체계구축 수행 사업장(scal_safety/projects) 아카이브 조회 및
 *      푸른이알피(data/companies·data/consultings)·정부사업일정(scal_cos)·푸른메일함(mailbox/msgs)·로컬폴더 자동 감지
 *   3. 신규 사업장 착수 체크(12항목) · 규모별 법적의무 · 7대 핵심요소(25문항) · 8대 다업종 특화 · 24종 고위험 기인물 · 표준 16대 서류 진단
 *   4. 위험성평가 매트릭스 · 회차별(2인1조/CEO 2회+면담/14일 간격) 2026 공단 수행기준 실시간 감사
 *   5. 종합보고서(7장) · 핵심 개선사항 1P 요약보고서 · 업종 체크리스트(.hwpx/.xlsx/.zip) 및 푸른한글(hangul.html) 연동
 */
(function (global) {
  'use strict';

  var Cat = function () { return global.PuSafetyCatalog; };
  var Docs = function () { return global.PuSafetyDocs; };
  var Intake = function () { return global.PuSafetyIntake; };
  var Report = function () { return global.PuSafetyReport; };
  var Hwpx = function () { return global.PuSafetyHwpx; };

  var MAIL_FN_BASE = 'https://asia-northeast3-pureun-erp.cloudfunctions.net/';
  var CHECK_ROOT_ID = 'main';

  var fb = null;
  var fbDb = null;
  var gate = null;
  var ME = { uid: '', sid: '', name: '', email: '', isAdmin: false, isSubAdmin: false };
  var SESSION_EPOCH = 0;
  var SNAP_ONLY = false;

  var D = {
    projects: {},
    checks: {},
    intake: {},
    reports: {},
    snapshots: {},
    companies: [],
    consultings: [],
    contracts: [],
    bizTypes: [],
    scalCos: {},
    scalTypes: {},
    mailFolders: {},
    mailMsgs: {},
    flatMails: []
  };

  var SCAN_CACHE = {};
  var DISCOVER_LIST = [];
  var MAIL_VIEW_CACHE = Object.create(null);
  var FOLDER_STATE = {
    rootName: '',
    handle: null,
    needsPerm: false,
    rawEntries: [],
    groups: [],
    guideFileCount: 0,
    totalAcceptedFiles: 0,
    skippedNonSafety: 0,
    skippedPersonal: 0
  };

  var TAB = 'projects';
  var TRACK_SCOPE = '';
  var CHECK_LAYER = 'all';
  var PREVIEW_KIND = 'summary1p';
  var DOC_CAT_SCOPE = '';
  var DOC_KPI_FILTER = '';
  var DOC_SEARCH_Q = '';
  var CUR_DOC_CODE = '';
  var DOC_DRAFT_CACHE = null;
  var SELECTED_SAMPLE_ID = '';
  var CUR_PID = '';
  var UPLOAD_DOC_KIND = '';
  var SEL = {};
  var DRAG_SEL = { active: false, listName: '', targetVal: false, startKey: '', moved: false };
  var IDB_NAME = 'pu_safety_folder_v1';
  var IDB_STORE = 'handles';

  function $(id) { return document.getElementById(id); }
  function str(v) { return v == null ? '' : String(v).trim(); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }
  function num(v, d) {
    if (v == null || v === '' || typeof v === 'boolean') return d === undefined ? 0 : d;
    var n = Number(v);
    return isFinite(n) ? n : (d === undefined ? 0 : d);
  }
  function stripUndef(v) {
    if (Array.isArray(v)) return v.filter(function (x) { return x !== undefined; }).map(stripUndef);
    if (v && typeof v === 'object') {
      var o = {};
      Object.keys(v).forEach(function (k) { if (v[k] !== undefined) o[k] = stripUndef(v[k]); });
      return o;
    }
    return v;
  }
  function rowsOf(v) {
    var x = v && typeof v === 'object' && !Array.isArray(v) && v.v !== undefined ? v.v : v;
    if (Array.isArray(x)) return x.filter(function (r) { return r && typeof r === 'object'; });
    if (x && typeof x === 'object') return Object.keys(x).map(function (k) { return x[k]; }).filter(function (r) { return r && typeof r === 'object'; });
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
  function setSyncStateText(txt) {
    var el = $('syncStateChip');
    if (!el) return;
    if (!txt) { el.style.display = 'none'; el.textContent = ''; }
    else { el.textContent = txt; el.style.display = ''; }
  }
  function currentAuthUid() {
    try { return (fb && fb.auth && fb.auth().currentUser && fb.auth().currentUser.uid) ? String(fb.auth().currentUser.uid) : ''; } catch (e) { return ''; }
  }
  function isSessionCurrent(epoch, uid) {
    return !!uid && epoch === SESSION_EPOCH && !!ME && ME.uid === uid && currentAuthUid() === uid;
  }
  function resolveWriteSession(optEpoch, optUid) {
    var ep = optEpoch != null ? optEpoch : SESSION_EPOCH;
    var uid = optUid != null ? String(optUid) : (ME && ME.uid ? String(ME.uid) : '');
    if (!gate || !fbDb || !ME.sid || !isSessionCurrent(ep, uid)) return null;
    return { epoch: ep, uid: uid, gate: gate, sid: ME.sid };
  }
  function wrapSnapGuard(rawGate) {
    if (!rawGate || typeof rawGate.save !== 'function') return rawGate;
    return Object.assign({}, rawGate, {
      save: function () {
        if (SNAP_ONLY) {
          toast('최신 원장 동기화 중입니다. 잠시 후 다시 저장해 주세요.');
          return Promise.reject(new Error('SNAP_ONLY'));
        }
        return rawGate.save.apply(rawGate, arguments);
      }
    });
  }

  function isUiBusyForBgRedraw() {
    var m = $('modal');
    if (m && m.style && m.style.display && m.style.display !== 'none') return true;
    var ae = typeof document !== 'undefined' ? document.activeElement : null;
    if (!ae || !ae.tagName) return false;
    var tag = String(ae.tagName).toUpperCase();
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  }

  function hashKey(prefix, raw) {
    return (prefix || 'id_') + Intake().sha256Hex(str(raw)).slice(0, 16);
  }

  /* ══ 1. IndexedDB 폴더 핸들 · Lazy 라이브러리 ═══════════════════════════ */
  function openIdb() {
    if (typeof indexedDB === 'undefined') return Promise.resolve(null);
    return new Promise(function (resolve) {
      try {
        var req = indexedDB.open(IDB_NAME, 1);
        req.onupgradeneeded = function () {
          try { if (!req.result.objectStoreNames.contains(IDB_STORE)) req.result.createObjectStore(IDB_STORE); } catch (e) {}
        };
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { resolve(null); };
      } catch (e) { resolve(null); }
    });
  }
  async function saveDirHandle(handle, uid) {
    var db = await openIdb();
    if (!db || !uid) return;
    try {
      var tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(handle, 'dir_' + uid);
    } catch (e) {}
  }
  async function loadDirHandle(uid) {
    var db = await openIdb();
    if (!db || !uid) return null;
    return new Promise(function (resolve) {
      try {
        var tx = db.transaction(IDB_STORE, 'readonly');
        var req = tx.objectStore(IDB_STORE).get('dir_' + uid);
        req.onsuccess = function () { resolve(req.result || null); };
        req.onerror = function () { resolve(null); };
      } catch (e) { resolve(null); }
    });
  }
  async function clearDirHandles() {
    var db = await openIdb();
    if (!db) return;
    try { db.transaction(IDB_STORE, 'readwrite').objectStore(IDB_STORE).clear(); } catch (e) {}
  }

  async function ensureLibs(opts) {
    var o = opts || {};
    var fbBoot = global.PuFastBoot;
    if (!fbBoot) return;
    if (o.zip && !global.JSZip && typeof fbBoot.ensureJsZip === 'function') await fbBoot.ensureJsZip();
    if (o.xlsx && !global.XLSX && typeof fbBoot.ensureXlsx === 'function') await fbBoot.ensureXlsx();
    if (o.pdf && !global.pdfjsLib && typeof fbBoot.ensurePdfJs === 'function') await fbBoot.ensurePdfJs();
    if (o.hwp && !global.PureunHwp && typeof fbBoot.ensureHwpLibs === 'function') await fbBoot.ensureHwpLibs();
  }

  /* ══ 2. 데이터 적재 · FastBoot · 자동 발견 ══════════════════════════════ */
  async function safeVal(path) {
    try {
      var snap = await fbDb.ref(path).once('value');
      return snap ? snap.val() : null;
    } catch (e) { return null; }
  }

  function buildFastSnapshot() {
    var slimProjs = {};
    Object.keys(D.projects || {}).forEach(function (pid) {
      var p = D.projects[pid];
      if (!p || typeof p !== 'object') return;
      slimProjs[pid] = {
        id: str(p.id || pid), companyId: str(p.companyId), companyName: str(p.companyName),
        bizNo: str(p.bizNo), year: num(p.year, 2026), track: str(p.track),
        industryCode: str(p.industryCode), extraIndustries: Array.isArray(p.extraIndustries) ? p.extraIndustries : [],
        selectedHazards: Array.isArray(p.selectedHazards) ? p.selectedHazards : [],
        workerCount: num(p.workerCount, 0), consultantName: str(p.consultantName),
        status: str(p.status), summaryNote: str(p.summaryNote), roundCount: num(p.roundCount, 0),
        source: str(p.source), updatedAt: num(p.updatedAt, 0), _deleted: !!p._deleted
      };
    });
    var slimChecks = {};
    Object.keys(D.checks || {}).forEach(function (pid) {
      var b = D.checks[pid];
      if (!b || typeof b !== 'object') return;
      var out = {};
      if (b[CHECK_ROOT_ID]) out[CHECK_ROOT_ID] = b[CHECK_ROOT_ID];
      Object.keys(b).forEach(function (k) {
        if (k.indexOf('doc_') === 0 && b[k] && typeof b[k] === 'object') {
          var dRec = b[k];
          out[k] = {
            id: str(dRec.id || k), recordKind: 'safety_doc', docCode: str(dRec.docCode),
            docKind: str(dRec.docKind), title: str(dRec.title), status: str(dRec.status),
            applicable: str(dRec.applicable), docDate: str(dRec.docDate), updatedAt: num(dRec.updatedAt, 0),
            _deleted: !!dRec._deleted
          };
        }
      });
      slimChecks[pid] = out;
    });
    return {
      projects: slimProjs,
      checks: slimChecks,
      reports: {},
      snapshots: {},
      companies: D.companies.slice(0, 2000).map(function (c) {
        return { id: str(c.id), name: str(c.name), bizNo: str(c.bizNo), bizType: str(c.bizType), bizItem: str(c.bizItem), managerMain: str(c.managerMain) };
      }),
      consultings: D.consultings.slice(0, 1000),
      contracts: D.contracts.slice(0, 1000),
      bizTypes: D.bizTypes,
      scalCos: D.scalCos,
      scalTypes: D.scalTypes
    };
  }

  function applyFastSnapshot(snap) {
    if (!snap || typeof snap !== 'object') return false;
    SNAP_ONLY = true;
    D.projects = snap.projects || {};
    D.checks = snap.checks || {};
    D.companies = Array.isArray(snap.companies) ? snap.companies : [];
    D.consultings = Array.isArray(snap.consultings) ? snap.consultings : [];
    D.contracts = Array.isArray(snap.contracts) ? snap.contracts : [];
    D.bizTypes = Array.isArray(snap.bizTypes) ? snap.bizTypes : [];
    D.scalCos = snap.scalCos || {};
    D.scalTypes = snap.scalTypes || {};
    return true;
  }

  function purgeSessionState() {
    gate = null;
    SNAP_ONLY = false;
    ME = { uid: '', sid: '', name: '', email: '', isAdmin: false, isSubAdmin: false };
    TAB = 'projects';
    TRACK_SCOPE = '';
    DOC_CAT_SCOPE = '';
    DOC_KPI_FILTER = '';
    DOC_SEARCH_Q = '';
    CUR_DOC_CODE = '';
    DOC_DRAFT_CACHE = null;
    SELECTED_SAMPLE_ID = '';
    CUR_PID = '';
    SEL = {};
    DRAG_SEL = { active: false, listName: '', targetVal: false, startKey: '', moved: false };
    SCAN_CACHE = {};
    DISCOVER_LIST = [];
    MAIL_VIEW_CACHE = Object.create(null);
    FOLDER_STATE = { rootName: '', handle: null, needsPerm: false, rawEntries: [], groups: [], guideFileCount: 0, totalAcceptedFiles: 0, skippedNonSafety: 0, skippedPersonal: 0 };
    D = { projects: {}, checks: {}, intake: {}, reports: {}, snapshots: {}, companies: [], consultings: [], contracts: [], bizTypes: [], scalCos: {}, scalTypes: {}, mailFolders: {}, mailMsgs: {}, flatMails: [] };
    setSyncStateText('');
    if (global.PuFastBoot && typeof global.PuFastBoot.clearAll === 'function') {
      try { global.PuFastBoot.clearAll(); } catch (e) {}
    }
    closeModal();
    ['scopeBar', 'kpiBox', 'projectsBox', 'checkBox', 'docsBox', 'intakeBox', 'reportBox', 'guideBox', 'folderSyncBox', 'discoverBox'].forEach(function (id) {
      if ($(id)) $(id).innerHTML = '';
    });
    if ($('folderSyncCard')) $('folderSyncCard').style.display = 'none';
    if ($('app')) $('app').style.display = 'none';
  }

  async function reload(optEpoch, optUid) {
    var reqEpoch = optEpoch || SESSION_EPOCH;
    var reqUid = optUid || (ME && ME.uid ? String(ME.uid) : '');
    if (!isSessionCurrent(reqEpoch, reqUid)) return;
    setSyncStateText('⟳ 이력·메일 동기화 중…');

    var pCore = Promise.all([
      safeVal('scal_safety'),
      safeVal('data/companies'),
      safeVal('data/consultings'),
      safeVal('data/biz_cons_types'),
      safeVal('scal_cos'),
      safeVal('scal_types'),
      safeVal('data/contracts')
    ]);
    var pMail = Promise.all([
      safeVal('mailbox/folders'),
      safeVal('mailbox/msgs')
    ]);
    var pFolder = tryRestoreSavedFolderHandle(reqEpoch, reqUid).catch(function () {});
    var allDone = false;

    pCore.then(function (cRes) {
      if (allDone || !isSessionCurrent(reqEpoch, reqUid)) return;
      SNAP_ONLY = false;
      if (DOC_DRAFT_CACHE && DOC_DRAFT_CACHE.fromSnapOnly) DOC_DRAFT_CACHE = null;
      var root0 = cRes[0] && typeof cRes[0] === 'object' ? cRes[0] : {};
      D.projects = root0.projects || {};
      D.checks = root0.checks || {};
      D.intake = root0.intake || {};
      D.reports = root0.reports || {};
      D.snapshots = root0.snapshots || {};
      D.companies = rowsOf(cRes[1]);
      D.consultings = rowsOf(cRes[2]);
      D.bizTypes = rowsOf(cRes[3]);
      D.scalCos = cRes[4] || {};
      D.scalTypes = cRes[5] || {};
      D.contracts = rowsOf(cRes[6]);
      rebuildScanAndDiscover();
      applyHashTarget();
      if (!isUiBusyForBgRedraw()) draw();
    });

    var both = await Promise.all([pCore, pMail, pFolder]);
    allDone = true;
    SNAP_ONLY = false;
    if (DOC_DRAFT_CACHE && DOC_DRAFT_CACHE.fromSnapOnly) DOC_DRAFT_CACHE = null;
    if (!isSessionCurrent(reqEpoch, reqUid)) return;

    var cFinal = both[0], mFinal = both[1];
    var sRoot = cFinal[0] && typeof cFinal[0] === 'object' ? cFinal[0] : {};
    D.projects = sRoot.projects || {};
    D.checks = sRoot.checks || {};
    D.intake = sRoot.intake || {};
    D.reports = sRoot.reports || {};
    D.snapshots = sRoot.snapshots || {};
    D.companies = rowsOf(cFinal[1]);
    D.consultings = rowsOf(cFinal[2]);
    D.bizTypes = rowsOf(cFinal[3]);
    D.scalCos = cFinal[4] || {};
    D.scalTypes = cFinal[5] || {};
    D.contracts = rowsOf(cFinal[6]);
    D.mailFolders = mFinal[0] || {};
    D.mailMsgs = mFinal[1] || {};
    D.flatMails = Intake().flattenMailboxRows(D.mailFolders, D.mailMsgs);
    setSyncStateText('');

    rebuildScanAndDiscover();
    applyHashTarget();
    if (!isUiBusyForBgRedraw()) draw();

    if (global.PuFastBoot && typeof global.PuFastBoot.writeSnap === 'function') {
      try { global.PuFastBoot.writeSnap('safety', reqUid, buildFastSnapshot()); } catch (e) {}
    }
  }

  function activeProjects() {
    return Object.keys(D.projects || {}).map(function (k) { return D.projects[k]; })
      .filter(function (p) { return p && typeof p === 'object' && !p._deleted && p.id; })
      .sort(function (a, b) {
        return (num(b.year, 0) - num(a.year, 0)) || (num(b.updatedAt, 0) - num(a.updatedAt, 0));
      });
  }
  function projectById(pid) {
    var p = D.projects && D.projects[pid];
    return p && !p._deleted ? p : null;
  }
  function findCompanyById(coId) {
    var id = str(coId);
    for (var i = 0; i < D.companies.length; i++) {
      if (str(D.companies[i].id) === id) return D.companies[i];
    }
    return null;
  }
  function checkDocOf(pid) {
    var b = D.checks && D.checks[pid];
    if (!b || typeof b !== 'object') return {};
    if (b[CHECK_ROOT_ID] && typeof b[CHECK_ROOT_ID] === 'object' && !b[CHECK_ROOT_ID]._deleted) return b[CHECK_ROOT_ID];
    if (!b._deleted && (b.pre || b.core7 || b.industry || b.hazards || b.docs || b.riskItems)) return b;
    return {};
  }
  function projectDocsMap(pid) {
    var b = D.checks && D.checks[pid];
    var out = {};
    if (!b || typeof b !== 'object') return out;
    Object.keys(b).forEach(function (k) {
      var rec = b[k];
      if (!rec || typeof rec !== 'object' || rec._deleted) return;
      if (rec.recordKind === 'safety_doc' || k.indexOf('doc_') === 0) {
        var code = str(rec.docCode || k.replace(/^doc_/, ''));
        if (code) out[code] = rec;
      }
    });
    return out;
  }
  function projectDocOf(pid, docCode) {
    var m = projectDocsMap(pid);
    return m[docCode] || null;
  }
  function reportDocOf(pid) {
    var r = D.reports && D.reports[pid];
    return r && !r._deleted ? r : null;
  }

  function rebuildScanAndDiscover() {
    SCAN_CACHE = {};
    var projs = activeProjects();
    projs.forEach(function (p) {
      SCAN_CACHE[p.id] = Intake().scanProjectMails(p, D.flatMails, null, D.companies, D.consultings, D.intake[p.id] || {}, D.contracts);
    });

    DISCOVER_LIST = Intake().discoverSafetyCandidates({
      companies: D.companies,
      consultings: D.consultings,
      contracts: D.contracts,
      bizTypes: D.bizTypes,
      scalCos: D.scalCos,
      scalTypes: D.scalTypes,
      registeredProjects: projs
    });

    /* 푸른메일함 안전보건컨설팅 송수신 메일 중 미등록 사업장 후보도 보강 탐지 */
    var regNorm = {};
    projs.forEach(function (p) {
      var n = Intake().normCorpName(p.companyName);
      if (n) regNorm[n] = 1;
    });
    DISCOVER_LIST.forEach(function (c) {
      var n = Intake().normCorpName(c.companyName);
      if (n) regNorm[n] = 1;
    });
    D.flatMails.forEach(function (m) {
      if (!Intake().isSafetyConsultingMail(m.subject, m.attNames)) return;
      var matchedCorp = '';
      D.companies.some(function (co) {
        var nn = Intake().normCorpName(co.name);
        if (nn.length >= 2 && Intake().normCorpName(m.subject).indexOf(nn) >= 0) {
          if (!regNorm[nn]) {
            matchedCorp = co;
          }
          return true;
        }
        return false;
      });
      if (matchedCorp) {
        var nn2 = Intake().normCorpName(matchedCorp.name);
        regNorm[nn2] = 1;
        var yr = num((m.date || '').slice(0, 4), 2026);
        var ind = Intake().inferIndustryCode(matchedCorp.name, matchedCorp.bizType, matchedCorp.bizItem, m.subject);
        DISCOVER_LIST.push({
          candKey: 'mailco_' + Intake().safeIdPart(matchedCorp.id) + '_' + yr,
          source: '푸른메일함 감지',
          companyId: str(matchedCorp.id),
          companyName: str(matchedCorp.name),
          bizNo: Intake().formatBizNo(matchedCorp.bizNo),
          industryCode: ind,
          track: Intake().inferTrackCode(m.subject, ind),
          year: yr,
          bizLabel: str(m.subject).slice(0, 40)
        });
      }
    });
  }

  function applyHashTarget() {
    if (typeof location === 'undefined' || !location.hash) return;
    var h = location.hash.replace(/^#/, '');
    var mProj = /(?:^|&)proj=([^&]+)/.exec(h);
    var mCo = /(?:^|&)co=([^&]+)/.exec(h);
    if (mProj) {
      var pid = decodeURIComponent(mProj[1]);
      if (projectById(pid)) { CUR_PID = pid; TAB = 'check'; }
    } else if (mCo) {
      var cid = decodeURIComponent(mCo[1]);
      var found = activeProjects().find(function (p) { return p.companyId === cid || p.scalCoId === cid; });
      if (found) { CUR_PID = found.id; TAB = 'check'; }
    }
  }

  /* ══ 3. PuOntologyWrite 강제 관문 저장 함수 ════════════════════════════ */
  async function saveProjectRecord(projInput, optEpoch, optUid) {
    var ws = resolveWriteSession(optEpoch, optUid);
    if (!ws) return null;
    var rawName = str(projInput.companyName);
    if (!rawName || Intake().hasResidualPii(rawName)) {
      throw new Error('사업장명에 민감 식별정보 패턴이 포함되어 있어 저장을 차단했습니다.');
    }
    if (Intake().hasResidualPii(str(projInput.summaryNote))) {
      throw new Error('요약 메모에 민감 식별정보 패턴이 포함되어 있어 저장을 차단했습니다.');
    }
    var ind = Cat().getIndustry(projInput.industryCode);
    var tr = Cat().getTrack(projInput.track);
    var id = str(projInput.id) || ('sf_' + Intake().safeIdPart(projInput.companyId || rawName) + '_' + (projInput.year || 2026));
    var compId = str(projInput.companyId) || ('sfco_' + Intake().safeIdPart(rawName));
    var ref = fbDb.ref('scal_safety/projects/' + id);
    var res = await ws.gate.save(ref, function (prev) {
      return stripUndef(Object.assign({}, prev || {}, projInput, {
        id: id,
        entityType: 'Project',
        companyId: compId,
        companyName: rawName,
        industryCode: ind.code,
        track: tr.code
      }));
    }, { entityType: 'Project' });
    if (!isSessionCurrent(ws.epoch, ws.uid)) return null;
    var val = res && res.snapshot ? res.snapshot.val() : null;
    if (val) D.projects[id] = val;
    return val;
  }

  async function softDeleteProject(pid) {
    var ws = resolveWriteSession();
    var p = projectById(pid);
    if (!ws || !p) return false;
    await ws.gate.save(fbDb.ref('scal_safety/projects/' + pid), function (prev) {
      return Object.assign({}, prev || p, { id: pid, entityType: 'Project', _deleted: true });
    }, { entityType: 'Project' });
    if (D.projects[pid]) D.projects[pid]._deleted = true;
    return true;
  }

  async function saveCheckDoc(proj, patchOrFn) {
    var ws = resolveWriteSession();
    if (!ws || !proj) return null;
    var cur = checkDocOf(proj.id);
    var nextObj = typeof patchOrFn === 'function' ? patchOrFn(Object.assign({}, cur)) : Object.assign({}, cur, patchOrFn);
    if (Intake().hasResidualPii(JSON.stringify(nextObj))) {
      throw new Error('체크리스트 메모에 민감 식별정보 패턴이 감지되어 저장을 차단했습니다.');
    }
    var ref = fbDb.ref('scal_safety/checks/' + proj.id + '/' + CHECK_ROOT_ID);
    var res = await ws.gate.save(ref, function (prev) {
      return stripUndef(Object.assign({}, prev || {}, nextObj, {
        id: CHECK_ROOT_ID,
        projectId: proj.id,
        entityType: 'Document',
        companyId: str(proj.companyId),
        companyName: str(proj.companyName)
      }));
    }, { entityType: 'Document' });
    if (!isSessionCurrent(ws.epoch, ws.uid)) return null;
    var val = res && res.snapshot ? res.snapshot.val() : null;
    if (!D.checks[proj.id]) D.checks[proj.id] = {};
    if (val) D.checks[proj.id][CHECK_ROOT_ID] = val;
    return val;
  }

  async function saveSafetyDoc(proj, docCode, docInput) {
    var ws = resolveWriteSession();
    if (!ws || !proj || !docCode) return null;
    var tpl = Docs() && Docs().getTemplate(docCode);
    if (Docs() && !tpl) throw new Error('유효하지 않은 서류 코드입니다.');
    var sourceGuard = docInput && docInput.sourceGuard ? docInput.sourceGuard : null;
    if (sourceGuard && sourceGuard.unverifiedOrigin) {
      throw new Error('원본 상호를 비워 둔 PC 샘플입니다. 타 사업장 정보 확인 또는 「원본 상호」 치환 후 저장하세요.');
    }
    if (sourceGuard && Docs() && typeof Docs().findCrossCompanyResidue === 'function') {
      var resGuard = Docs().findCrossCompanyResidue(str(docInput.title) + '\n' + String(docInput.body || ''), sourceGuard);
      if (resGuard.found.length > 0) {
        throw new Error('타 사업장 원본 정보(' + resGuard.found.join(', ') + ')가 남아 있어 저장을 차단했습니다. 치환·수정 후 저장하세요.');
      }
    }
    var rawBiz = str(docInput && docInput.bizNo);
    var bizPiiCheck = (/^\d{3}-\d{2}-\d{5}$/.test(rawBiz) || /^[1-9]\d{9}$/.test(rawBiz)) ? '' : rawBiz;
    var checkStr = JSON.stringify({
      title: docInput && docInput.title,
      body: docInput && docInput.body,
      docDate: docInput && docInput.docDate,
      ceoName: docInput && docInput.ceoName,
      bizNo: bizPiiCheck,
      address: docInput && docInput.address,
      consultantName: docInput && docInput.consultantName
    });
    if (Intake().hasResidualPii(checkStr)) {
      throw new Error('서류 정보에 주민번호·휴대폰·계좌 등 개인정보 패턴이 감지되었습니다. 「개인정보 비식별 정리」 후 저장하세요.');
    }
    var payload = Object.assign({}, docInput || {});
    delete payload.sourceGuard;
    var key = 'doc_' + docCode;
    var ref = fbDb.ref('scal_safety/checks/' + proj.id + '/' + key);
    var res = await ws.gate.save(ref, function (prev) {
      return stripUndef(Object.assign({}, prev || {}, payload, {
        id: key,
        recordKind: 'safety_doc',
        docCode: docCode,
        docKind: (payload && payload.docKind) || (tpl && tpl.docKind) || '',
        projectId: proj.id,
        entityType: 'Document',
        companyId: str(proj.companyId),
        companyName: str(proj.companyName)
      }));
    }, { entityType: 'Document' });
    if (!isSessionCurrent(ws.epoch, ws.uid)) return null;
    var val = res && res.snapshot ? res.snapshot.val() : null;
    if (!D.checks[proj.id]) D.checks[proj.id] = {};
    if (val) D.checks[proj.id][key] = val;

    /* 5계층 표준 16대 서류 체크리스트와 작성 상태 자동 연동 */
    var dKind = (val && val.docKind) || (tpl && tpl.docKind);
    if (dKind && val && !val._deleted) {
      var allDocs = projectDocsMap(proj.id);
      var sameKindDocs = Docs() ? Docs().DOC_TEMPLATES.filter(function (t) { return t.docKind === dKind; }) : [];
      var anyDone = sameKindDocs.some(function (t) {
        return allDocs[t.code] && allDocs[t.code].status === 'done' && allDocs[t.code].applicable !== 'na';
      });
      var anyDraft = sameKindDocs.some(function (t) {
        var r = allDocs[t.code];
        return r && r.applicable !== 'na' && (r.status === 'draft' || r.status === 'review');
      });
      var allNa = sameKindDocs.length > 0 && sameKindDocs.every(function (t) {
        return allDocs[t.code] && (allDocs[t.code].status === 'na' || allDocs[t.code].applicable === 'na');
      });
      var mapped = anyDone ? 'ok' : (allNa ? 'na' : (anyDraft ? 'fix' : ''));
      var curCd = checkDocOf(proj.id);
      var curRecObj = curCd.docs && typeof curCd.docs[dKind] === 'object' ? curCd.docs[dKind] : null;
      var curDocSt = str(curCd.docs && curCd.docs[dKind] && (curCd.docs[dKind].status || curCd.docs[dKind]));
      var isAutoSynced = !!(curRecObj && curRecObj.autoFromDocs);
      var rank = { '': 0, 'na': 1, 'fix': 2, 'ok': 3 };
      var allowSync = mapped !== curDocSt && (
        isAutoSynced ||
        !curDocSt ||
        rank[mapped] > rank[curDocSt]
      );
      if (allowSync) {
        await saveCheckDoc(proj, function (cd) {
          cd.docs = Object.assign({}, cd.docs || {});
          cd.docs[dKind] = Object.assign({}, typeof cd.docs[dKind] === 'object' ? cd.docs[dKind] : {}, {
            status: mapped,
            autoFromDocs: true
          });
          return cd;
        });
      }
    }
    return val;
  }

  async function saveIntakeCard(proj, cardInput, optEpoch, optUid) {
    var ws = resolveWriteSession(optEpoch, optUid);
    if (!ws || !proj) return null;
    var checkBlob = JSON.stringify({
      title: cardInput && cardInput.title,
      maskedExcerpt: cardInput && cardInput.maskedExcerpt,
      summaryLines: cardInput && cardInput.summaryLines
    });
    if (Intake().hasResidualPii(checkBlob)) {
      throw new Error('수집 카드에 개인정보 패턴이 남아있어 저장을 차단했습니다.');
    }
    var cid = str(cardInput.id) || ('sfin_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6));
    var ref = fbDb.ref('scal_safety/intake/' + proj.id + '/' + cid);
    var res = await ws.gate.save(ref, function (prev) {
      return stripUndef(Object.assign({}, prev || {}, cardInput, {
        id: cid,
        projectId: proj.id,
        entityType: 'Document',
        companyId: str(proj.companyId),
        companyName: str(proj.companyName)
      }));
    }, { entityType: 'Document' });
    if (!isSessionCurrent(ws.epoch, ws.uid)) return null;
    var val = res && res.snapshot ? res.snapshot.val() : null;
    if (!D.intake[proj.id]) D.intake[proj.id] = {};
    if (val) D.intake[proj.id][cid] = val;
    return val;
  }

  async function saveReportDoc(proj, sections, locks) {
    var ws = resolveWriteSession();
    if (!ws || !proj) return null;
    if (Intake().hasResidualPii(JSON.stringify(sections || {}))) {
      throw new Error('보고서 본문에 민감 식별정보 패턴이 감지되어 저장을 차단했습니다.');
    }
    var ref = fbDb.ref('scal_safety/reports/' + proj.id);
    var res = await ws.gate.save(ref, function (prev) {
      return stripUndef(Object.assign({}, prev || {}, {
        id: proj.id,
        projectId: proj.id,
        entityType: 'Document',
        track: proj.track || 'kosha_mfg',
        industryCode: proj.industryCode || 'mfg_general',
        companyId: str(proj.companyId),
        companyName: str(proj.companyName),
        sections: sections,
        locks: locks || {}
      }));
    }, { entityType: 'Document' });
    if (!isSessionCurrent(ws.epoch, ws.uid)) return null;
    var val = res && res.snapshot ? res.snapshot.val() : null;
    if (val) D.reports[proj.id] = val;
    return val;
  }

  async function saveImmutableSnapshot(proj, snapObj) {
    var ws = resolveWriteSession();
    if (!ws || !proj) return null;
    var sid = str(snapObj.id) || ('sfsnap_' + Date.now());
    var ref = fbDb.ref('scal_safety/snapshots/' + proj.id + '/' + sid);
    var res = await ws.gate.save(ref, stripUndef(Object.assign({}, snapObj, {
      id: sid,
      projectId: proj.id,
      entityType: 'Document',
      companyId: str(proj.companyId),
      companyName: str(proj.companyName)
    })), { entityType: 'Document' });
    if (!isSessionCurrent(ws.epoch, ws.uid)) return null;
    var val = res && res.snapshot ? res.snapshot.val() : null;
    if (!D.snapshots[proj.id]) D.snapshots[proj.id] = {};
    if (val) D.snapshots[proj.id][sid] = val;
    return val;
  }

  /* ══ 4. 공통 표 · ☐ + № + 끌어고르기 + 일괄실행 렌더러 ═══════════════ */
  function renderTable(name, heads, rows, curId) {
    if (!rows.length) return '<div class="empty">표시할 내역이 없습니다.</div>';
    var allOn = rows.every(function (r) { return !!SEL[name + '|' + r.id]; });
    var html = '<div class="bulk" data-bulk="' + esc(name) + '"></div><div class="scroll"><table class="t" data-name="' + esc(name) + '"><thead><tr>' +
      '<th class="c"><input type="checkbox" data-all="' + esc(name) + '"' + (allOn ? ' checked' : '') + ' aria-label="전체 선택"></th>' +
      '<th class="n">번호</th>' +
      heads.map(function (h) {
        if (h && typeof h === 'object') return '<th' + (h.cls ? ' class="' + esc(h.cls) + '"' : '') + '>' + esc(h.text) + '</th>';
        return '<th>' + esc(h) + '</th>';
      }).join('') +
      '</tr></thead><tbody>';

    rows.forEach(function (r, idx) {
      var ckKey = name + '|' + r.id;
      var clsParts = [];
      if (curId && r.id === curId) clsParts.push('cur');
      if (r.rowCls) clsParts.push(r.rowCls);
      var trCls = clsParts.length ? (' class="' + esc(clsParts.join(' ')) + '"') : '';
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
    return html + '</tbody></table></div>';
  }

  function renderSectionList(listName, headLabel, sectionsMeta, secsObj, locksObj, badgeCls) {
    var allOn = sectionsMeta.length > 0 && sectionsMeta.every(function (s) { return !!SEL[listName + '|' + s.key]; });
    var cards = sectionsMeta.map(function (s, idx) {
      var ckKey = listName + '|' + s.key;
      var isSel = !!SEL[ckKey];
      var locked = !!(locksObj && locksObj[s.key]);
      var val = str(secsObj && secsObj[s.key]);
      return '<div class="rpt-sec-card' + (isSel ? ' sel' : '') + '" data-sec-row="' + esc(s.key) + '">' +
        '<div class="rpt-sec-hd">' +
        '<input type="checkbox" data-ck="' + esc(ckKey) + '"' + (isSel ? ' checked' : '') + ' aria-label="' + (idx + 1) + '번 장 선택">' +
        '<span class="sec-no">' + (idx + 1) + '</span>' +
        '<span class="chip ' + esc(badgeCls) + '">' + esc(s.part) + '</span>' +
        '<b>' + esc(s.title) + '</b>' +
        '<span class="sp"></span>' +
        '<label class="hint" style="display:inline-flex;align-items:center;gap:4px;cursor:pointer">' +
        '<input type="checkbox" data-rpt-lock="' + esc(s.key) + '"' + (locked ? ' checked' : '') + '> 🔒 고정</label>' +
        '<button class="sm" data-ai-polish="' + esc(s.key) + '">✨ AI 윤문</button>' +
        '<button class="sm ok" data-save-sec="' + esc(s.key) + '">💾 저장</button>' +
        '</div>' +
        '<div class="rpt-sec-body">' +
        '<textarea id="rptSec_' + esc(s.key) + '" aria-label="' + esc(s.title) + '">' + esc(val) + '</textarea>' +
        '</div></div>';
    }).join('');
    return '<div class="bulk" data-bulk="' + esc(listName) + '"></div>' +
      '<div class="sec-list-hd">' +
      '<input type="checkbox" data-all="' + esc(listName) + '"' + (allOn ? ' checked' : '') + ' aria-label="전체 장 선택">' +
      '<span class="sec-no">번호</span>' +
      '<span>' + esc(headLabel) + '</span>' +
      '</div><div class="rpt-sec-list" data-sec-name="' + esc(listName) + '">' + cards + '</div>';
  }

  function listCheckboxesInDom(name) {
    if (typeof document === 'undefined') return [];
    return Array.prototype.slice.call(document.querySelectorAll('table.t[data-name="' + name + '"] input[data-ck], [data-sec-name="' + name + '"] input[data-ck]'));
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
      document.querySelectorAll('input[data-ck], input[data-all]').forEach(function (cb) { cb.checked = false; });
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
        btns = '<button class="sm pri" data-bulkact="discover:activate">⚡ 선택 사업장 일괄 등록</button>';
      } else if (nm === 'folderSync') {
        btns = '<button class="sm pri" data-bulkact="folderSync:import">📥 선택 폴더 자료 반영</button>';
      } else if (nm === 'preChecks' || nm === 'core7Checks' || nm === 'industryChecks' || nm === 'hazardItems' || nm === 'docChecklist') {
        btns = '<button class="sm ok" data-bulkact="' + nm + ':ok">✓ 일괄 적정</button>' +
          '<button class="sm warn-btn" data-bulkact="' + nm + ':fix">⚠ 일괄 보완</button>' +
          '<button class="sm danger" data-bulkact="' + nm + ':no">✕ 일괄 미이행</button>' +
          '<button class="sm" data-bulkact="' + nm + ':na">해당없음</button>';
      } else if (nm === 'projMails' || nm === 'candMails') {
        btns = '<button class="sm pri" data-bulkact="' + nm + ':analyze">🔍 내용확인·분석</button>';
      } else if (nm === 'intakeCards') {
        btns = '<button class="sm danger" data-bulkact="intakeCards:del">선택 카드 삭제</button>';
      } else if (nm === 'riskItems') {
        btns = '<button class="sm ok" data-bulkact="riskItems:done">✓ 개선 완료</button>' +
          '<button class="sm danger" data-bulkact="riskItems:del">선택 삭제</button>';
      } else if (nm === 'rounds') {
        btns = '<button class="sm ok" data-bulkact="rounds:ceo">✓ CEO면담 체크</button>' +
          '<button class="sm pri" data-bulkact="rounds:pair">✓ 2인1조 체크</button>' +
          '<button class="sm danger" data-bulkact="rounds:del">선택 회차 삭제</button>';
      } else if (nm === 'safetyDocs') {
        btns = '<button class="sm pri" data-bulkact="safetyDocs:draft">⚡ 선택 서식 일괄 초안생성</button>' +
          '<button class="sm" data-bulkact="safetyDocs:na">🚫 해당없음</button>' +
          '<button class="sm" data-bulkact="safetyDocs:todo">↺ 대상 복구</button>';
      } else if (nm === 'reportSecs') {
        btns = '<button class="sm ok" data-bulkact="reportSecs:save">💾 선택 저장</button>' +
          '<button class="sm pri" data-bulkact="reportSecs:lock">🔒 수기 고정</button>' +
          '<button class="sm" data-bulkact="reportSecs:unlock">🔓 고정 해제</button>';
      }
      el.innerHTML = '<b>' + n + '개 선택됨</b>' + btns + '<span class="sp"></span><button class="sm" data-clear="' + esc(nm) + '">선택 해제</button>';
    });
  }

  /* ══ 5. 메일 본문 읽기 · 첨부 파싱 ══════════════════════════════════ */
  async function callMailFn(fnName, payload, optEpoch, optUid) {
    var user = fb && fb.auth && fb.auth().currentUser;
    if (!user) throw new Error('로그인이 필요합니다.');
    var tok = await user.getIdToken();
    if (optEpoch != null && !isSessionCurrent(optEpoch, optUid)) throw new Error('SESSION_CHANGED');
    var res = await fetch(MAIL_FN_BASE + fnName, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok },
      body: JSON.stringify(payload || {})
    });
    var j = await res.json().catch(function () { return null; });
    if (optEpoch != null && !isSessionCurrent(optEpoch, optUid)) throw new Error('SESSION_CHANGED');
    if (!res.ok || !j || j.ok !== true) throw new Error((j && j.error) || ('메일 서버 응답 오류 (' + res.status + ')'));
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

  async function extractTextFromBytes(fileName, bytes) {
    var ext = str(fileName).toLowerCase().split('.').pop();
    if (ext === 'txt' || ext === 'csv') return new TextDecoder('utf-8').decode(bytes);
    if (ext === 'xlsx' || ext === 'xls' || ext === 'xlsm') {
      await ensureLibs({ xlsx: true });
      if (!global.XLSX) return '';
      var wb = global.XLSX.read(bytes, { type: 'array' });
      var sheetMap = {};
      var textLines = [];
      (wb.SheetNames || []).forEach(function (sn) {
        var rows = global.XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: '' });
        sheetMap[sn] = rows;
        rows.slice(0, 60).forEach(function (r) {
          var line = (r || []).map(str).filter(Boolean).join(' | ');
          if (line) textLines.push(line);
        });
      });
      return { text: textLines.join('\n'), sheetMap: sheetMap };
    }
    if ((ext === 'hwpx' || ext === 'hwp' || ext === 'docx') && global.PuKordocText) {
      if (ext === 'hwp') await ensureLibs({ hwp: true });
      else await ensureLibs({ zip: true });
      if (typeof global.PuKordocText.read === 'function') {
        var r = await global.PuKordocText.read(bytes);
        return typeof r === 'string' ? r : str(r && r.text);
      }
    }
    if (ext === 'pdf') {
      await ensureLibs({ pdf: true });
      if (global.pdfjsLib) {
        var pdf = await global.pdfjsLib.getDocument({ data: bytes, isEvalSupported: false, disableFontFace: true }).promise;
        var out = [];
        for (var i = 1; i <= Math.min(pdf.numPages, 12); i++) {
          var page = await pdf.getPage(i);
          var tc = await page.getTextContent();
          out.push((tc.items || []).map(function (it) { return it.str || ''; }).join(' '));
        }
        return out.join('\n');
      }
    }
    return '';
  }

  async function analyzeAndStoreBytes(proj, fileName, bytes, docKindOverride) {
    var extracted = await extractTextFromBytes(fileName, bytes);
    var rawText = typeof extracted === 'string' ? extracted : str(extracted && extracted.text);
    var hazards = (extracted && extracted.sheetMap) ? Intake().analyzeHazardTableRows(extracted.sheetMap) : [];
    var res = Intake().sanitizeAndAnalyzeText(rawText, {
      companyName: proj.companyName,
      subject: fileName,
      attNames: [fileName],
      docKind: docKindOverride || ''
    });
    if (!res.ok) {
      toast('⚠ [' + fileName + '] 개인정보 잔존 패턴이 감지되어 원문 저장을 차단했습니다.');
      return null;
    }
    var cardId = hashKey('sfdoc_', proj.id + ':' + fileName);
    var card = await saveIntakeCard(proj, {
      id: cardId,
      title: Intake().cleanCategoryLabel(fileName, '안전보건자료', 60),
      docKind: res.docKind,
      docKindName: res.docKindName,
      source: 'local',
      piiStripped: true,
      maskedExcerpt: res.maskedExcerpt,
      summaryLines: res.summaryLines.concat(hazards.length ? ['위험요인 ' + hazards.length + '건 자동 추출'] : []),
      analyzedAt: Date.now()
    });

    if (hazards.length) {
      await saveCheckDoc(proj, function (cd) {
        var prevList = Array.isArray(cd.riskItems) ? cd.riskItems : [];
        var byId = {};
        prevList.forEach(function (it) { if (it && it.id) byId[it.id] = 1; });
        var merged = prevList.slice();
        hazards.forEach(function (hz) { if (!byId[hz.id]) merged.push(hz); });
        cd.riskItems = merged;
        return cd;
      });
    }
    return { card: card, hazardsCount: hazards.length };
  }

  async function inspectProjectMail(proj, mailKey) {
    var sc = SCAN_CACHE[proj.id];
    var m = sc && (sc.matched.find(function (x) { return x.key === mailKey; }) || sc.nameCandidates.find(function (x) { return x.key === mailKey; }));
    if (!m) { toast('메일 항목을 찾지 못했습니다.'); return; }
    var reqEpoch = SESSION_EPOCH, reqUid = ME.uid;
    toast('메일 본문 확인 중 (읽음상태 변경 없음 · 비식별)…');
    try {
      var ck = m.slug + ':' + m.uid;
      var msg = MAIL_VIEW_CACHE[ck] || await callMailFn('readMailMessage', { slug: m.slug, uid: m.uid, peek: 1 }, reqEpoch, reqUid);
      MAIL_VIEW_CACHE[ck] = msg;
      if (!isSessionCurrent(reqEpoch, reqUid)) return;
      var rawBody = str(msg.text) || htmlToPlainText(msg.html);
      var res = Intake().sanitizeAndAnalyzeText(rawBody, {
        companyName: proj.companyName,
        subject: m.subject,
        attNames: m.attNames
      });
      if (!res.ok) {
        toast('메일 본문에 민감 식별정보가 남아있어 요약 저장을 차단했습니다.');
        return;
      }
      var cardId = hashKey('sfm_', m.key);
      await saveIntakeCard(proj, {
        id: cardId,
        title: Intake().cleanCategoryLabel(res.safeSubject || m.subject, '메일 자료', 65),
        mailKey: m.key,
        docKind: res.docKind,
        docKindName: res.docKindName,
        source: 'mail',
        date: m.date,
        piiStripped: true,
        maskedExcerpt: res.maskedExcerpt,
        summaryLines: res.summaryLines,
        checkedAt: Date.now(),
        analyzedAt: Date.now()
      }, reqEpoch, reqUid);
      rebuildScanAndDiscover();
      draw();
      showModal('📩 메일 비식별 요약 · 분류 결과',
        '<div class="note"><b>분류:</b> ' + esc(res.docKindName) + '  |  <b>수발신일:</b> ' + esc(m.date) + '</div>' +
        '<div class="mail-body">' + esc(res.maskedExcerpt || '(본문 요약 없음 — 첨부파일 ' + m.attNames.join(', ') + ')') + '</div>',
        '<button class="pri" data-close-modal="1">확인</button>');
    } catch (e) {
      toast('메일 조회 실패: ' + (e.message || e));
    }
  }

  /* ══ 6. 로컬 컨설팅 폴더 연결 (안전보건 하위폴더만 선별) ═══════════════ */
  function refreshFolderGroups() {
    var res = Intake().groupSafetyFolderEntries(FOLDER_STATE.rawEntries, { rootDirName: FOLDER_STATE.rootName });
    FOLDER_STATE.groups = res.groups;
    FOLDER_STATE.guideFileCount = res.guideFileCount;
    FOLDER_STATE.totalAcceptedFiles = res.totalAcceptedFiles;
    FOLDER_STATE.skippedNonSafety = res.skippedNonSafety;
    FOLDER_STATE.skippedPersonal = res.skippedPersonal;
  }

  async function walkDirectory(dirHandle) {
    var rawEntries = [];
    var startStep = Intake().inspectSafetySubdir(dirHandle.name, false);
    async function walk(h, prefix, inside) {
      for await (var entry of h.values()) {
        if (!entry) continue;
        var next = prefix ? (prefix + '/' + entry.name) : entry.name;
        if (entry.kind === 'directory') {
          var step = Intake().inspectSafetySubdir(entry.name, inside);
          if (step.enter) await walk(entry, next, step.nextInside);
        } else if (entry.kind === 'file' && inside) {
          rawEntries.push({ relPath: dirHandle.name + '/' + next, name: entry.name, handle: entry });
        }
      }
    }
    await walk(dirHandle, '', !!startStep.nextInside);
    return rawEntries;
  }

  async function scanDirHandle(handle, silent, optEpoch, optUid) {
    var ep = optEpoch || SESSION_EPOCH, uid = optUid || ME.uid;
    if (!handle || !isSessionCurrent(ep, uid)) return;
    FOLDER_STATE.handle = handle;
    FOLDER_STATE.rootName = str(handle.name);
    FOLDER_STATE.needsPerm = false;
    FOLDER_STATE.rawEntries = await walkDirectory(handle);
    if (!isSessionCurrent(ep, uid)) return;
    refreshFolderGroups();
    draw();
    if (!silent) toast('컨설팅 폴더 연결 완료: 안전보건 사업장 ' + FOLDER_STATE.groups.length + '곳 · 매뉴얼/양식 ' + FOLDER_STATE.guideFileCount + '건 선별');
  }

  async function tryRestoreSavedFolderHandle(reqEpoch, reqUid) {
    var saved = await loadDirHandle(reqUid);
    if (!saved || !isSessionCurrent(reqEpoch, reqUid)) return;
    try {
      var perm = typeof saved.queryPermission === 'function' ? await saved.queryPermission({ mode: 'read' }) : 'prompt';
      if (!isSessionCurrent(reqEpoch, reqUid)) return;
      if (perm === 'granted') await scanDirHandle(saved, true, reqEpoch, reqUid);
      else { FOLDER_STATE.handle = saved; FOLDER_STATE.rootName = str(saved.name); FOLDER_STATE.needsPerm = true; }
    } catch (e) {}
  }

  async function connectFolder() {
    if (typeof global.showDirectoryPicker === 'function') {
      try {
        var h = await global.showDirectoryPicker({ mode: 'read' });
        await saveDirHandle(h, ME.uid);
        await scanDirHandle(h, false, SESSION_EPOCH, ME.uid);
      } catch (e) { if (e && e.name !== 'AbortError') toast('폴더 연결 실패: ' + (e.message || e)); }
      return;
    }
    if ($('folderFallbackInput')) { $('folderFallbackInput').value = ''; $('folderFallbackInput').click(); }
  }

  async function importFolderGroup(groupKey) {
    var grp = FOLDER_STATE.groups.find(function (g) { return g.groupKey === groupKey; });
    if (!grp) return;
    var proj = await saveProjectRecord({
      id: 'sf_' + Intake().safeIdPart(grp.companyName) + '_' + grp.year,
      companyName: grp.companyName,
      industryCode: grp.industryCode,
      track: grp.track,
      year: grp.year,
      status: grp.year < 2026 ? 'archive' : 'active',
      source: '로컬 컨설팅 폴더',
      consultantName: ME.name ? ME.name + ' 공인노무사' : '푸른노무법인 전담 공인노무사'
    });
    if (!proj) return;
    CUR_PID = proj.id;
    var count = 0;
    for (var i = 0; i < Math.min(grp.files.length, 15); i++) {
      var f = grp.files[i];
      try {
        var fileObj = f.file || (f.handle && typeof f.handle.getFile === 'function' ? await f.handle.getFile() : null);
        if (fileObj && fileObj.size <= 15 * 1024 * 1024 && !/\.(jpg|jpeg|png)$/i.test(f.fileName)) {
          var bytes = new Uint8Array(await fileObj.arrayBuffer());
          var r = await analyzeAndStoreBytes(proj, f.fileName, bytes, f.docKind);
          if (r) count++;
        }
      } catch (e) {}
    }
    rebuildScanAndDiscover();
    draw();
    toast(proj.companyName + ' 로컬 자료 ' + count + '건 비식별 반영 완료');
  }

  /* ══ 7. 화면 렌더링 (5개 탭 + 모달) ════════════════════════════════════ */
  function fillIndustryFilterSelect() {
    var sel = $('projIndustry');
    if (!sel || sel.options.length > 1) return;
    Object.keys(Cat().INDUSTRIES).forEach(function (k) {
      var ind = Cat().INDUSTRIES[k];
      var opt = document.createElement('option');
      opt.value = ind.code;
      opt.textContent = ind.name;
      sel.appendChild(opt);
    });
  }

  function renderProjectHeaderBar(proj) {
    var projs = activeProjects();
    var cd = checkDocOf(proj.id);
    var sum = Report().computeCheckSummary(proj, cd);
    var workerCnt = num(proj.workerCount, 0);
    var scales = Cat().getScaleObligations(workerCnt || 25, sum.industry.code);
    var tr = Cat().getTrack(proj.track);
    var opts = projs.map(function (p) {
      var ind = Cat().getIndustry(p.industryCode);
      return '<option value="' + esc(p.id) + '"' + (p.id === proj.id ? ' selected' : '') + '>' +
        esc('[' + (p.year || 2026) + ' · ' + ind.short + '] ' + p.companyName) + '</option>';
    }).join('');
    var isArch = proj.status === 'archive' || num(proj.year, 2026) < 2026;
    var statusBadge = isArch
      ? '<span class="chip c-direct">수행완료</span>'
      : '<span class="chip c-direct-ing">진행중</span>';

    return '<div class="card">' +
      '<div class="bar">' +
      '<select data-proj-sel="1" aria-label="작업 사업장 전환" style="min-width:210px;max-width:360px;font-weight:600">' + opts + '</select>' +
      statusBadge +
      ' <span class="chip ' + esc(tr.badgeCls) + '">' + esc(tr.short) + '</span>' +
      ' <span class="chip c-blue">' + esc(sum.allIndustryCodes.map(function (c) { return Cat().getIndustry(c).short; }).join(' + ')) + '</span>' +
      ' <span class="chip">' + (workerCnt > 0 ? workerCnt + '명 · ' + esc(scales.scaleBand) : '규모 미입력') + '</span>' +
      ' <span class="chip c-green">' + esc(sum.grade) + ' ' + sum.overallPct + '%</span>' +
      '<span class="sp"></span>' +
      '<a class="act-link" href="pu-erp.html?sso=1" target="_blank" rel="noopener">🏢 ERP</a>' +
      '<a class="act-link" href="pu-cards.html?sso=1&q=' + encodeURIComponent(proj.companyName || '') + '" target="_blank" rel="noopener">📇 기업정보함</a>' +
      '<button class="sm pri" data-act="open-config-modal">🏭 업종·규모 설정</button>' +
      '</div>' +
      '<div class="ws-steps">' +
      Cat().STAGES.map(function (st, idx) {
        var curOrder = isArch ? 7 : (sum.overallPct >= 80 ? 6 : (sum.core7Pct >= 30 ? 3 : (sum.prePct >= 50 ? 2 : 1)));
        var cls = st.order < curOrder ? ' done' : (st.order === curOrder ? ' cur' : '');
        var toTab = idx < 2 ? 'check' : (idx === 2 ? 'docs' : (idx === 3 ? 'intake' : 'report'));
        return '<button type="button" class="ws-step' + cls + '" data-goto-tab="' + toTab + '" title="' + esc(st.desc) + '">' +
          '<b>' + st.order + '. ' + esc(st.short) + '</b></button>';
      }).join('') +
      '</div>' +
      '<details class="sub-fold">' +
      '<summary>⚖️ 규모별 핵심 법적의무 (' + esc(scales.scaleBand) + ' · ' + scales.items.length + '건)</summary>' +
      '<div class="sub-fold-bd">' + scales.items.map(function (it) { return '「' + esc(it.title) + '」'; }).join(' · ') + '</div>' +
      '</details></div>';
  }

  function syncTabDom() {
    if (typeof document === 'undefined') return;
    document.querySelectorAll('.tabs button[data-tab]').forEach(function (b) {
      var on = b.getAttribute('data-tab') === TAB;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      b.setAttribute('tabindex', on ? '0' : '-1');
    });
    document.querySelectorAll('main .pane').forEach(function (p) {
      p.classList.toggle('on', p.id === 'p-' + TAB);
    });
  }

  function draw() {
    syncTabDom();
    fillIndustryFilterSelect();
    var projs = activeProjects();
    if (!CUR_PID || !projectById(CUR_PID)) CUR_PID = projs[0] ? projs[0].id : '';
    if (DOC_DRAFT_CACHE && DOC_DRAFT_CACHE.pid !== CUR_PID) {
      DOC_DRAFT_CACHE = null;
      SELECTED_SAMPLE_ID = '';
    }

    var archiveCount = projs.filter(function (p) { return p.status === 'archive' || num(p.year, 2026) < 2026; }).length;
    var activeCount = projs.length - archiveCount;
    var preAlertCount = 0;
    var totalMailHits = 0;
    projs.forEach(function (p) {
      var sc = SCAN_CACHE[p.id];
      if (sc) {
        totalMailHits += sc.matched.length + (sc.nameCandidates ? sc.nameCandidates.length : 0);
        preAlertCount += sc.unseenCount;
      }
    });
    var curProj = projectById(CUR_PID);
    if ($('nDocsReady') && Docs()) {
      var dSum = curProj ? Docs().computeDocsSummary(curProj, projectDocsMap(curProj.id)) : { doneCount: 0, applicableTotal: Docs().DOC_TEMPLATES.length };
      $('nDocsReady').textContent = dSum.doneCount + '/' + dSum.applicableTotal;
    }
    if ($('nProjects')) $('nProjects').textContent = String(projs.length);
    if ($('nChkAlerts')) $('nChkAlerts').textContent = String(projs.length ? activeCount : 0);
    if ($('nPreMail')) $('nPreMail').textContent = String(totalMailHits || preAlertCount);
    if ($('nDiscover')) $('nDiscover').textContent = String(DISCOVER_LIST.length);
    if ($('nFolderGroups')) $('nFolderGroups').textContent = String(FOLDER_STATE.groups.length);

    drawScopeBar(projs);
    drawProjectsPane(projs, archiveCount, activeCount);
    drawCheckPane();
    drawDocsPane();
    drawIntakePane();
    drawReportPane();
    drawGuidePane();
    drawBulks();
  }

  function drawScopeBar(projs) {
    var counts = { '': projs.length };
    Object.keys(Cat().TRACKS).forEach(function (k) { counts[k] = 0; });
    projs.forEach(function (p) { counts[p.track] = (counts[p.track] || 0) + 1; });

    var koshaAllCnt = projs.filter(function (p) { return /^kosha_/.test(str(p.track)); }).length;
    var trSel = $('projTrack');
    if (trSel) {
      trSel.innerHTML = '<option value="">트랙 전체 (' + projs.length + ')</option>' +
        '<option value="__kosha__">공단 트랙 전체 (' + koshaAllCnt + ')</option>' +
        Object.keys(Cat().TRACKS).map(function (k) {
          var tr = Cat().TRACKS[k];
          return '<option value="' + esc(k) + '">' + esc(tr.short) + ' (' + (counts[k] || 0) + ')</option>';
        }).join('');
      trSel.value = TRACK_SCOPE || '';
    }

    var box = $('scopeBar');
    if (!box) return;
    box.innerHTML = '<span class="scope-lbl">수행 트랙:</span>' +
      '<button class="scope-btn' + (TRACK_SCOPE === '' ? ' on' : '') + '" aria-pressed="' + (TRACK_SCOPE === '' ? 'true' : 'false') + '" data-scope="">전체 (' + projs.length + ')</button>' +
      Object.keys(Cat().TRACKS).map(function (k) {
        var tr = Cat().TRACKS[k];
        var isOn = TRACK_SCOPE === k;
        return '<button class="scope-btn' + (tr.code === 'kosha_etc' || tr.code === 'welfare_pub' ? ' ok' : '') + (isOn ? ' on' : '') + '" aria-pressed="' + (isOn ? 'true' : 'false') + '" data-scope="' + esc(k) + '">' +
          esc(tr.short) + ' (' + (counts[k] || 0) + ')</button>';
      }).join('');
  }

  function safetyStepDots(proj, sum) {
    var isArch = proj.status === 'archive' || num(proj.year, 2026) < 2026;
    var curOrder = isArch ? 7 : (sum.overallPct >= 80 ? 6 : (sum.core7Pct >= 30 ? 3 : (sum.prePct >= 50 ? 2 : 1)));
    return '<span class="pbar">' + Cat().STAGES.map(function (st) {
      var done = st.order < curOrder;
      var cur = !done && st.order === curOrder;
      return '<span class="pdot' + (done ? ' done' : cur ? ' cur' : '') + '" title="' + esc(st.short) + '"></span>';
    }).join('') + '</span>';
  }

  function drawProjectsPane(projs, archiveCount, activeCount) {
    var activeProjs = projs.filter(function (p) { return !(p.status === 'archive' || num(p.year, 2026) < 2026); });
    var activeAvgPct = activeProjs.length
      ? Math.round(activeProjs.reduce(function (acc, p) { return acc + Report().computeCheckSummary(p, checkDocOf(p.id)).overallPct; }, 0) / activeProjs.length)
      : 0;
    var indCoverage = Object.keys(projs.reduce(function (m, p) { m[p.industryCode || 'mfg_general'] = 1; return m; }, {})).length;
    var totalIntakeCards = projs.reduce(function (acc, p) {
      var box = D.intake[p.id] || {};
      return acc + Object.keys(box).filter(function (k) { return box[k] && !box[k]._deleted; }).length;
    }, 0);

    var q = str($('projQ') && $('projQ').value).toLowerCase();
    var stFilter = $('projStatus') ? $('projStatus').value : '';
    var indFilter = $('projIndustry') ? $('projIndustry').value : '';
    var yrSelEl = $('projYear');
    var yrFilter = yrSelEl ? yrSelEl.value : '';
    if (yrSelEl) {
      var yrCntMap = Object.create(null);
      ['2026', '2025', '2024', '2023', '2022'].forEach(function (yy) { yrCntMap[yy] = yrCntMap[yy] || 0; });
      projs.forEach(function (p) {
        var yy = String(num(p.year, 2026));
        yrCntMap[yy] = (yrCntMap[yy] || 0) + 1;
      });
      var sortedYrs = Object.keys(yrCntMap).sort(function (a, b) { return Number(b) - Number(a); });
      yrSelEl.innerHTML = '<option value="">연도 전체</option>' + sortedYrs.map(function (yy) {
        return '<option value="' + esc(yy) + '">' + esc(yy) + '년 (' + yrCntMap[yy] + ')</option>';
      }).join('');
      yrSelEl.value = yrFilter;
      if (yrSelEl.value !== yrFilter) yrSelEl.value = '';
      yrFilter = yrSelEl.value || '';
    }

    var koshaCnt = projs.filter(function (p) { return /^kosha_/.test(str(p.track)); }).length;
    var isAllSafetyOn = !stFilter && !TRACK_SCOPE;
    $('kpiBox').innerHTML =
      '<div class="kpi k-blue' + (isAllSafetyOn ? ' k-on' : '') + '" data-kpi-status="" role="button" tabindex="0" aria-pressed="' + (isAllSafetyOn ? 'true' : 'false') + '" title="전체 수행 사업장 보기"><span>전체 사업장</span><b>' + projs.length + '곳</b></div>' +
      '<div class="kpi k-green k-direct' + (stFilter === 'archive' ? ' k-on' : '') + '" data-kpi-status="archive" role="button" tabindex="0" aria-pressed="' + (stFilter === 'archive' ? 'true' : 'false') + '" title="과거 수행완료 사업장만 보기"><span>과거 완료</span><b>' + archiveCount + '곳</b></div>' +
      '<div class="kpi k-amber' + (stFilter === 'active' ? ' k-on' : '') + '" data-kpi-status="active" role="button" tabindex="0" aria-pressed="' + (stFilter === 'active' ? 'true' : 'false') + '" title="진행·신규 사업장만 보기"><span>진행 사업장</span><b>' + activeCount + '곳</b></div>' +
      '<div class="kpi k-green' + (TRACK_SCOPE === '__kosha__' ? ' k-on' : '') + '" data-kpi-kosha="1" role="button" tabindex="0" aria-pressed="' + (TRACK_SCOPE === '__kosha__' ? 'true' : 'false') + '" title="클릭하여 안전보건공단 수행 트랙 사업장만 보기"><span>공단 트랙</span><b>' + koshaCnt + '곳</b></div>' +
      '<div class="kpi" title="등록된 8대 업종 스펙트럼"><span>업종 범위</span><b>' + indCoverage + '/8</b></div>' +
      '<div class="kpi k-blue" title="진행 중 사업장 평균 체계구축 충족률"><span>진행 충족률</span><b>' + activeAvgPct + '%</b></div>' +
      '<div class="kpi" title="수집·분석 안전보건 자료 ' + totalIntakeCards + '건 · 자동감지 후보 ' + DISCOVER_LIST.length + '건"><span>자료 · 후보</span><b>' + (totalIntakeCards + DISCOVER_LIST.length) + '건</b></div>';

    if ($('projResetBtn')) {
      $('projResetBtn').style.display = (TRACK_SCOPE || q || stFilter || indFilter || yrFilter) ? '' : 'none';
    }

    var filtered = projs.filter(function (p) {
      if (TRACK_SCOPE) {
        if (TRACK_SCOPE === '__kosha__') { if (!/^kosha_/.test(str(p.track))) return false; }
        else if (p.track !== TRACK_SCOPE) return false;
      }
      var isArch = p.status === 'archive' || num(p.year, 2026) < 2026;
      if (stFilter === 'archive' && !isArch) return false;
      if (stFilter === 'active' && isArch) return false;
      if (indFilter && p.industryCode !== indFilter && (!Array.isArray(p.extraIndustries) || p.extraIndustries.indexOf(indFilter) < 0)) return false;
      if (yrFilter && String(num(p.year, 2026)) !== yrFilter) return false;
      if (q) {
        var ind = Cat().getIndustry(p.industryCode);
        var hay = [p.companyName, ind.name, p.summaryNote, p.source, p.consultantName].join(' ').toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });

    var rows = filtered.map(function (p) {
      var ind = Cat().getIndustry(p.industryCode);
      var tr = Cat().getTrack(p.track);
      var cd = checkDocOf(p.id);
      var sum = Report().computeCheckSummary(p, cd);
      var sc = SCAN_CACHE[p.id] || { matched: [] };
      var mailCnt = sc.matched.length + (sc.nameCandidates ? sc.nameCandidates.length : 0);
      var intakeCnt = Object.keys(D.intake[p.id] || {}).filter(function (k) { return D.intake[p.id][k] && !D.intake[p.id][k]._deleted; }).length;
      var isArch = p.status === 'archive' || num(p.year, 2026) < 2026;
      var yrVal = p.year || 2026;
      var statusBadge = isArch
        ? '<span class="chip c-direct">수행완료</span>'
        : '<span class="chip c-direct-ing">진행중</span>';
      var roundCnt = num(p.roundCount, 0);
      var progressHtml = safetyStepDots(p, sum) + (
        (isArch && sum.overallPct === 0 && sum.preDone === 0)
          ? '<b>완료</b>' + (roundCnt > 0 ? ' <span class="hint">(' + roundCnt + '회)</span>' : '')
          : '<b>' + sum.overallPct + '%</b> <span class="hint">사전 ' + sum.preDone + '/' + sum.preTotal + '</span>'
      );
      var mailIntakeHtml = '<span class="chip c-blue" title="감지 메일 ' + mailCnt + '건">📧 ' + mailCnt + '</span> ' +
        '<span class="chip c-green" title="수집·분석 자료 ' + intakeCnt + '건">🗂️ ' + intakeCnt + '</span>';

      return {
        id: p.id,
        rowCls: isArch ? 'perf-direct' : '',
        cells: [
          { cls: 'yr', html: '<span class="chip">' + esc(yrVal) + '</span>' },
          { cls: 'ti', title: p.companyName, html: esc(p.companyName) },
          { cls: 'st', html: statusBadge },
          { k: 'pc-only', html: '<span class="chip ' + esc(ind.badgeCls) + '">' + esc(ind.short) + '</span> <span class="chip ' + esc(tr.badgeCls) + '">' + esc(tr.short) + '</span>' },
          { k: 'pc-only', html: progressHtml },
          { k: 'pc-only', html: mailIntakeHtml },
          { cls: 'wide', title: p.summaryNote || ind.approach, html: esc(p.summaryNote || ind.approach) },
          {
            k: 'act',
            html: '<button class="sm pri" data-open-proj="' + esc(p.id) + '" data-go="check" data-pm-act="1">☑️ 체크</button>' +
              '<button class="sm" data-open-proj="' + esc(p.id) + '" data-go="intake">📩 자료·위평</button>' +
              '<button class="sm ok" data-open-proj="' + esc(p.id) + '" data-go="report">📑 보고서</button>'
          }
        ]
      };
    });

    $('projectsBox').innerHTML = '<div class="card">' +
      renderTable('projects', [
        { text: '연도', cls: 'yr' },
        '사업장명',
        { text: '진행상태', cls: 'st' },
        '업종 · 트랙',
        '진행현황',
        '메일·자료',
        { text: '주요 수행 이력', cls: 'wide' },
        '열기'
      ], rows, CUR_PID) +
      '</div>';

    /* 로컬 폴더 카드 */
    if ($('folderSyncCard')) {
      var showFolder = !!(FOLDER_STATE.rootName || FOLDER_STATE.groups.length);
      $('folderSyncCard').style.display = showFolder ? '' : 'none';
      if ($('reconnectFolderBtn')) $('reconnectFolderBtn').style.display = FOLDER_STATE.needsPerm ? '' : 'none';
      if (showFolder) {
        var fRows = FOLDER_STATE.groups.map(function (g) {
          var ind = Cat().getIndustry(g.industryCode);
          return {
            id: g.groupKey,
            cells: [
              { cls: 'ti', html: esc(g.companyName) + ' <span class="chip">' + g.year + '</span>' },
              { k: 'badge', html: '<span class="chip ' + esc(ind.badgeCls) + '">' + esc(ind.short) + '</span>' },
              { cls: 'wide', html: g.fileCount + '개 파일' },
              { k: 'act', html: '<button class="sm pri" data-import-folder="' + esc(g.groupKey) + '" data-pm-act="1">📥 비식별 반영</button>' }
            ]
          };
        });
        $('folderSyncBox').innerHTML = FOLDER_STATE.needsPerm
          ? '<div class="warn" style="margin:10px 12px">저장된 폴더(' + esc(FOLDER_STATE.rootName) + ') 읽기 권한 재확인이 필요합니다.</div>'
          : renderTable('folderSync', ['폴더 사업장명', '추론 업종', '감지 파일', '반영'], fRows, '');
      }
    }

    /* 자동 발견 후보 카드 */
    if ($('discoverCard')) $('discoverCard').style.display = DISCOVER_LIST.length ? '' : 'none';
    var dRows = DISCOVER_LIST.slice(0, 60).map(function (c) {
      var ind = Cat().getIndustry(c.industryCode);
      var tr = Cat().getTrack(c.track);
      return {
        id: c.candKey,
        cells: [
          { cls: 'ti', title: c.companyName, html: esc(c.companyName) + ' <span class="chip">' + esc(c.year) + '</span>' },
          { k: 'badge', html: '<span class="chip c-blue">' + esc(c.source) + '</span> <span class="chip ' + esc(ind.badgeCls) + '">' + esc(ind.short) + '</span>' },
          { k: 'pc-only', html: '<span class="chip ' + esc(tr.badgeCls) + '">' + esc(tr.short) + '</span>' },
          { cls: 'wide', title: c.bizLabel, html: esc(c.bizLabel) },
          { k: 'act', html: '<button class="sm pri" data-activate-cand="' + esc(c.candKey) + '" data-pm-act="1">⚡ 활성화</button>' }
        ]
      };
    });
    $('discoverBox').innerHTML = renderTable('discover', ['후보 사업장', '감지 출처 · 추론 업종', '권장 트랙', '감지 내용·사유', '등록'], dRows, '');
  }

  /* ── 탭 2: 착수 사전 체크 · 7대 핵심요소 · 다업종 특화 · 고위험 기인물 · 표준 16대 서류 ── */
  function statusPillsHtml(layer, itemId, curStatus) {
    var nv = Report().normalizeCheckVal(curStatus);
    var btns = [
      { k: 'ok', lbl: '적정', cls: nv === 'ok' ? 'ok' : '' },
      { k: 'fix', lbl: '보완', cls: nv === 'fix' ? 'warn-btn' : '' },
      { k: 'no', lbl: '미이행', cls: nv === 'no' ? 'danger' : '' },
      { k: 'na', lbl: '제외', cls: nv === 'na' ? 'pri' : '' }
    ];
    return btns.map(function (b) {
      return '<button class="sm ' + b.cls + '" data-set-chk="' + esc(layer + ':' + itemId + ':' + b.k) + '">' + b.lbl + '</button>';
    }).join('') + ' <button class="sm" data-chk-note="' + esc(layer + ':' + itemId) + '" title="비고 메모">📝</button>';
  }

  function drawCheckPane() {
    var box = $('checkBox');
    var proj = projectById(CUR_PID);
    if (!proj) {
      box.innerHTML = '<div class="empty card">먼저 [과거·진행 사업장] 탭에서 사업장을 선택하거나 + 신규 사업장을 등록하세요.</div>';
      return;
    }
    var cd = checkDocOf(proj.id);
    var sum = Report().computeCheckSummary(proj, cd);

    var layerTabs = [
      { k: 'all', lbl: '전체 5계층 보기' },
      { k: 'pre', lbl: '1. 착수 사전체크 (' + sum.preDone + '/' + sum.preTotal + ')' },
      { k: 'core7', lbl: '2. 7대 핵심요소 (' + sum.core7Pct + '%)' },
      { k: 'ind', lbl: '3. 다업종 특화 (' + sum.indPct + '%)' },
      { k: 'haz', lbl: '4. 고위험 기인물 (' + sum.hazardCodes.length + '종)' },
      { k: 'doc', lbl: '5. 표준 16대 서류 (' + sum.docReady + '/' + sum.docTotal + ')' }
    ];

    var html = renderProjectHeaderBar(proj) +
      '<div class="card"><div class="pill-row uniform-row" style="border-bottom:1px solid var(--line)">' +
      layerTabs.map(function (lt) {
        var isLayerOn = CHECK_LAYER === lt.k;
        return '<button class="scope-btn' + (isLayerOn ? ' on' : '') + '" aria-pressed="' + (isLayerOn ? 'true' : 'false') + '" data-chk-layer="' + lt.k + '">' + esc(lt.lbl) + '</button>';
      }).join('') +
      '</div><div class="bar">' +
      '<span class="hint">선택한 계층의 점검 항목을 즉시 판정·내보내기합니다</span><span class="sp"></span>' +
      '<button class="sm pri" data-hwpx-dl="checklist">📥 업종 체크리스트 (.hwpx)</button>' +
      '<button class="sm" data-hangul-open="checklist">📝 푸른한글 편집</button>' +
      '<button class="sm" data-pdf-print="checklist">🖨️ 인쇄/PDF</button>' +
      '<button class="sm ok" data-xlsx-dl="1">📊 통합엑셀 (.xlsx)</button>' +
      '</div></div>';

    /* (1) 착수 사전 체크 12항목 */
    if (CHECK_LAYER === 'all' || CHECK_LAYER === 'pre') {
      var preRows = Cat().PRE_CHECKS.map(function (c) {
        var rec = (cd.pre && cd.pre[c.id]) || {};
        var st = Report().normalizeCheckVal(rec.status || rec);
        return {
          id: c.id,
          cells: [
            { cls: 'ti', html: esc(c.cat) + (c.required ? ' <span class="chip c-blue">필수</span>' : ' <span class="chip">권장</span>') },
            { cls: 'wide', title: c.text, html: esc(c.text) + (rec.note ? ' <span class="chip c-amber">' + esc(rec.note) + '</span>' : '') },
            { k: 'badge', html: '<span class="chip">' + esc(Report().statusLabel(st)) + '</span>' },
            { k: 'act', html: statusPillsHtml('pre', c.id, st) }
          ]
        };
      });
      html += '<div class="card"><div class="sec"><span>1계층 · 신규 사업장 착수 사전 체크 (공단 적격·기초현황 12항목)</span><b>' + sum.prePct + '%</b></div>' +
        renderTable('preChecks', ['분류', '사전 확인 항목', '판정', '상태 선택'], preRows, '') + '</div>';
    }

    /* (2) 공식 7대 핵심요소 25문항 + 요소별 막대 그래프 */
    if (CHECK_LAYER === 'all' || CHECK_LAYER === 'core7') {
      var barsHtml = '<div class="eos-bars">' + sum.elementBars.map(function (b) {
        return '<div class="eos-row"><span class="eos-lbl">' + b.no + '. ' + esc(b.name) + '</span>' +
          '<div class="eos-track"><div class="eos-fill' + (b.pct < 60 ? ' low' : '') + '" style="width:' + b.pct + '%"></div></div>' +
          '<span class="eos-num"><b>' + b.pct + '%</b> (' + b.okCount + '/' + b.total + ')</span></div>';
      }).join('') + '</div>';

      var c7Rows = Cat().CORE7_CHECKS.map(function (c) {
        var el = Cat().CORE7_ELEMENTS.filter(function (e) { return e.id === c.elementId; })[0];
        var rec = (cd.core7 && cd.core7[c.id]) || {};
        var st = Report().normalizeCheckVal(rec.status || rec);
        return {
          id: c.id,
          cells: [
            { cls: 'ti', html: esc(c.code) + ' <span class="chip">' + esc(el ? el.short : '') + '</span>' },
            { cls: 'wide', title: c.text, html: esc(c.text) + (rec.note ? ' <span class="chip c-amber">' + esc(rec.note) + '</span>' : '') },
            { k: 'badge', html: '<span class="chip">' + esc(Report().statusLabel(st)) + '</span>' },
            { k: 'act', html: statusPillsHtml('core7', c.id, st) }
          ]
        };
      });
      html += '<div class="card"><div class="sec"><span>2계층 · 안전보건관리체계 공식 7대 핵심요소 진단 (25문항)</span><b>' + sum.core7Pct + '% (' + sum.core7Ok + '/' + sum.core7Total + ')</b></div>' +
        barsHtml + renderTable('core7Checks', ['요소', '공식 7대 핵심요소 진단 문항', '판정', '상태 선택'], c7Rows, '') + '</div>';
    }

    /* (3) 다업종 맞춤형 특화 체크리스트 (겸영 복합업종 실시간 토글 지원!) */
    if (CHECK_LAYER === 'all' || CHECK_LAYER === 'ind') {
      var indPickHtml = '<div class="pill-row"><span class="scope-lbl">복합 업종 겸영 선택:</span>' +
        Object.keys(Cat().INDUSTRIES).map(function (ic) {
          var indObj = Cat().INDUSTRIES[ic];
          var isPrimary = sum.industry.code === ic;
          var isOn = sum.allIndustryCodes.indexOf(ic) >= 0;
          return '<button class="scope-btn' + (isOn ? ' on' : '') + '" aria-pressed="' + (isOn ? 'true' : 'false') + '" data-toggle-extra-ind="' + esc(ic) + '"' + (isPrimary ? ' disabled title="주업종(업종 설정에서 변경)"' : '') + '>' +
            esc(indObj.short) + (isPrimary ? ' ★주' : '') + '</button>';
        }).join('') + '</div>';

      var indItems = Cat().getIndustryChecks(sum.allIndustryCodes);
      var indRows = indItems.map(function (c) {
        var rec = (cd.industry && cd.industry[c.id]) || {};
        var st = Report().normalizeCheckVal(rec.status || rec);
        return {
          id: c.id,
          cells: [
            { cls: 'ti', html: '<span class="chip c-blue">' + esc(c.industryName) + '</span> ' + esc(c.cat) },
            { cls: 'wide', title: c.text, html: esc(c.text) + (rec.note ? ' <span class="chip c-amber">' + esc(rec.note) + '</span>' : '') },
            { html: esc(c.lawRef || '-') },
            { k: 'badge', html: '<span class="chip">' + esc(Report().statusLabel(st)) + '</span>' },
            { k: 'act', html: statusPillsHtml('industry', c.id, st) }
          ]
        };
      });
      html += '<div class="card"><div class="sec"><span>3계층 · 다업종 맞춤형 특화 체크리스트 (주업종 + 복합겸영 ' + indItems.length + '항목)</span><b>' + sum.indPct + '%</b></div>' +
        indPickHtml + renderTable('industryChecks', ['업종·영역', '업종 특화 중점 점검 항목', '근거 법령', '판정', '상태 선택'], indRows, '') + '</div>';
    }

    /* (4) 고위험 기인물 24종 (제조 12 + 건설 12) */
    if (CHECK_LAYER === 'all' || CHECK_LAYER === 'haz') {
      var hazPickHtml = '<div class="pill-row"><span class="scope-lbl">보유·작업 고위험 기인물 선택:</span>' +
        Object.keys(Cat().HAZARD_AGENTS).map(function (hc) {
          var ha = Cat().HAZARD_AGENTS[hc];
          var isOn = sum.hazardCodes.indexOf(hc) >= 0;
          return '<button class="scope-btn' + (ha.group === 'const' ? ' ok' : '') + (isOn ? ' on' : '') + '" aria-pressed="' + (isOn ? 'true' : 'false') + '" data-toggle-hazard="' + esc(hc) + '" title="' + esc(ha.deathsStat) + '">' +
            esc(ha.short) + '</button>';
        }).join('') + '</div>';

      var hazRows = [];
      sum.hazardCodes.forEach(function (hc) {
        var ha = Cat().getHazardAgent(hc);
        if (!ha) return;
        ha.items.forEach(function (txt, idx) {
          var key = hc + '_' + (idx + 1);
          var rec = (cd.hazards && cd.hazards[key]) || {};
          var st = Report().normalizeCheckVal(rec.status || rec);
          hazRows.push({
            id: key,
            cells: [
              { cls: 'ti', html: '<span class="chip c-red">' + esc(ha.short) + '</span> ' + (idx + 1) },
              { cls: 'wide', title: txt, html: esc(txt) + (rec.note ? ' <span class="chip c-amber">' + esc(rec.note) + '</span>' : '') },
              { k: 'badge', html: '<span class="chip">' + esc(Report().statusLabel(st)) + '</span>' },
              { k: 'act', html: statusPillsHtml('hazards', key, st) }
            ]
          });
        });
      });
      html += '<div class="card"><div class="sec"><span>4계층 · 공단 공식 고위험 기인물 자율점검표 (선택 기인물 ' + sum.hazardCodes.length + '종)</span><b>' + sum.hazPct + '%</b></div>' +
        hazPickHtml + renderTable('hazardItems', ['기인물', '점검 항목', '판정', '상태 선택'], hazRows, '') + '</div>';
    }

    /* (5) 중대재해처벌법 표준 16대 서류 */
    if (CHECK_LAYER === 'all' || CHECK_LAYER === 'doc') {
      var docRows = Cat().DOC_KINDS.map(function (dk) {
        var rec = (cd.docs && cd.docs[dk.code]) || {};
        var st = Report().normalizeCheckVal(rec.status || rec);
        return {
          id: dk.code,
          cells: [
            { cls: 'ti', html: esc(dk.name) + (dk.essential ? ' <span class="chip c-blue">필수</span>' : ' <span class="chip">해당시</span>') },
            { cls: 'wide', title: dk.refExample, html: esc(dk.refExample) + (rec.note ? ' <span class="chip c-amber">' + esc(rec.note) + '</span>' : '') },
            { k: 'badge', html: '<span class="chip">' + esc(Report().statusLabel(st)) + '</span>' },
            { k: 'act', html: statusPillsHtml('docs', dk.code, st) + ' <button class="sm pri" data-open-doc-by-kind="' + esc(dk.code) + '">✍️ 서식작성</button>' }
          ]
        };
      });
      html += '<div class="card"><div class="sec"><span>5계층 · 중처법 체계구축 표준 16대 서류(26종 기반) 보유 점검</span><b>' + sum.docReady + '/' + sum.docTotal + ' (' + sum.docPct + '%)</b></div>' +
        renderTable('docChecklist', ['문서 체계 분류', '참고 서식·세부 구성', '보유', '상태 선택'], docRows, '') + '</div>';
    }

    box.innerHTML = html;
  }

  /* ── 탭 3: 최초 착수 로드맵 · 업종별 필수서류 22종 체크 · 개별작성 · 샘플 자동치환 ── */
  function makeDocDraftObj(proj, docCode) {
    var tpl = Docs().getTemplate(docCode);
    if (!tpl || !proj) return null;
    var saved = projectDocOf(proj.id, docCode);
    var req = Docs().evalDocRequirement(tpl, proj);
    var coRec = findCompanyById(proj.companyId) || {};
    var defDate = str(saved && saved.docDate) || new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
    var initDraft = Docs().buildTemplateDraft(docCode, proj, {
      docDate: defDate,
      ceoName: str((saved && saved.ceoName) || proj.ceoName || coRec.ceo || coRec.ceoName),
      bizNo: str((saved && saved.bizNo) || proj.bizNo || coRec.bizNo),
      address: str((saved && saved.address) || proj.address || coRec.address || coRec.addr)
    });
    return {
      pid: proj.id,
      code: docCode,
      no: tpl.no,
      short: tpl.short,
      name: tpl.name,
      docKind: tpl.docKind,
      categoryLabel: tpl.categoryLabel,
      legalRef: tpl.legalRef,
      reqLevel: req.level,
      reqLabel: req.label,
      reqReason: req.reason,
      title: str(saved && saved.title) || initDraft.title,
      body: (saved && saved.body != null) ? str(saved.body) : initDraft.body,
      status: str(saved && saved.status) || 'draft',
      docDate: defDate,
      companyName: str((saved && saved.companyName) || proj.companyName),
      ceoName: str((saved && saved.ceoName) || proj.ceoName || coRec.ceo || coRec.ceoName),
      bizNo: str((saved && saved.bizNo) || proj.bizNo || coRec.bizNo),
      address: str((saved && saved.address) || proj.address || coRec.address || coRec.addr),
      workerCount: num(saved && saved.workerCount != null ? saved.workerCount : proj.workerCount, 0),
      consultantName: str((saved && saved.consultantName) || proj.consultantName || '푸른노무법인 전담 공인노무사'),
      diffNote: '',
      sourceGuard: null,
      fromSnapOnly: !!(SNAP_ONLY && !(saved && saved.body != null))
    };
  }

  function buildDocDraftState(proj, docCode, forceReset) {
    var tpl = Docs().getTemplate(docCode);
    if (!tpl || !proj) return null;
    if (!forceReset && DOC_DRAFT_CACHE && DOC_DRAFT_CACHE.pid === proj.id && DOC_DRAFT_CACHE.code === docCode) {
      var reqNow = Docs().evalDocRequirement(tpl, proj);
      DOC_DRAFT_CACHE.reqLevel = reqNow.level;
      DOC_DRAFT_CACHE.reqLabel = reqNow.label;
      DOC_DRAFT_CACHE.reqReason = reqNow.reason;
      return DOC_DRAFT_CACHE;
    }
    DOC_DRAFT_CACHE = makeDocDraftObj(proj, docCode);
    return DOC_DRAFT_CACHE;
  }

  function syncDraftInputsFromDom() {
    if (!DOC_DRAFT_CACHE || typeof document === 'undefined') return DOC_DRAFT_CACHE;
    [
      ['docTitleInp', 'title'],
      ['docBodyTa', 'body'],
      ['docStateSel', 'status'],
      ['docDate', 'docDate'],
      ['docCoName', 'companyName'],
      ['docCeoName', 'ceoName'],
      ['docBizNo', 'bizNo'],
      ['docAddr', 'address'],
      ['docConsName', 'consultantName']
    ].forEach(function (pair) {
      var el = $(pair[0]);
      if (el) DOC_DRAFT_CACHE[pair[1]] = pair[1] === 'body' ? el.value : str(el.value);
    });
    if ($('docWorkers')) DOC_DRAFT_CACHE.workerCount = num($('docWorkers').value, 0);
    return DOC_DRAFT_CACHE;
  }

  function confirmSwitchSafetyDoc(proj, nextCode) {
    if (!proj || !DOC_DRAFT_CACHE || DOC_DRAFT_CACHE.pid !== proj.id || !DOC_DRAFT_CACHE.code || DOC_DRAFT_CACHE.code === nextCode) {
      return true;
    }
    syncDraftInputsFromDom();
    var baseline = makeDocDraftObj(proj, DOC_DRAFT_CACHE.code);
    var dirty = !!DOC_DRAFT_CACHE.diffNote || (baseline && (
      str(DOC_DRAFT_CACHE.title) !== str(baseline.title) ||
      String(DOC_DRAFT_CACHE.body || '') !== String(baseline.body || '')
    ));
    if (!dirty) return true;
    return typeof global.confirm !== 'function' || global.confirm('저장하지 않은 서류 편집 내용이 있습니다. 저장하지 않고 다른 서류로 전환하시겠습니까?');
  }

  function refreshDocPreviewDom(proj) {
    var pvEl = $('docPreviewPane');
    if (!pvEl || !DOC_DRAFT_CACHE || !proj) return;
    var d = syncDraftInputsFromDom();
    var targetProj = Object.assign({}, proj, {
      companyName: d.companyName || proj.companyName,
      ceoName: d.ceoName,
      bizNo: d.bizNo,
      address: d.address,
      workerCount: d.workerCount,
      consultantName: d.consultantName
    });
    pvEl.innerHTML = Hwpx().buildSingleDocPreviewHtml(d, targetProj);
  }

  function renderSafetyDocsTableHtml(proj, dMap) {
    var allTpls = Docs().DOC_TEMPLATES;
    var dq = DOC_SEARCH_Q.toLowerCase();
    var filteredDocs = allTpls.filter(function (tpl) {
      if (DOC_CAT_SCOPE && tpl.category !== DOC_CAT_SCOPE) return false;
      var rec = dMap[tpl.code] || null;
      var st = rec ? str(rec.status) : 'todo';
      var isNa = !!(rec && (rec.applicable === 'na' || st === 'na'));
      var req = Docs().evalDocRequirement(tpl, proj);
      var isReqLevel = req.level === 'urgent' || req.level === 'required' || req.level === 'industry_req';

      if (DOC_KPI_FILTER === 'req' && (!isReqLevel || isNa)) return false;
      if (DOC_KPI_FILTER === 'done' && (isNa || st !== 'done')) return false;
      if (DOC_KPI_FILTER === 'draft' && (isNa || (st !== 'draft' && st !== 'review'))) return false;
      if (DOC_KPI_FILTER === 'todo' && (isNa || st === 'done' || st === 'draft' || st === 'review')) return false;
      if (DOC_KPI_FILTER === 'na' && !isNa) return false;

      if (dq) {
        var hay = [tpl.name, tpl.short, tpl.summary, tpl.legalRef, tpl.categoryLabel, req.label, req.reason].join(' ').toLowerCase();
        if (hay.indexOf(dq) < 0) return false;
      }
      return true;
    });

    var docTableRows = filteredDocs.map(function (tpl) {
      var rec = dMap[tpl.code] || null;
      var req = Docs().evalDocRequirement(tpl, proj);
      var st = rec ? str(rec.status) : 'todo';
      var isNa = !!(rec && (rec.applicable === 'na' || st === 'na'));
      var isDone = !isNa && st === 'done';
      var isDraft = !isNa && (st === 'draft' || st === 'review');

      var reqChip = '<span class="chip ' + esc(req.cls) + '" title="' + esc(req.reason) + '">' + esc(req.label) + '</span>';
      var stateChip = isNa
        ? '<span class="chip">해당없음</span>'
        : (isDone
            ? '<span class="chip c-direct">작성완료</span>'
            : (isDraft ? '<span class="chip c-amber">' + (st === 'review' ? '검토중' : '초안작성') + '</span>' : '<span class="chip">미작성</span>'));

      return {
        id: tpl.code,
        rowCls: isDone ? 'perf-direct' : '',
        cells: [
          { cls: 'yr', html: '<span class="chip">' + esc(tpl.step.replace('step', '') + '단계') + '</span>' },
          { cls: 'ti', title: tpl.name + ' — ' + tpl.summary, html: esc(tpl.name) },
          { cls: 'st', title: req.reason, html: reqChip },
          { cls: 'st', html: stateChip },
          { cls: 'wide', k: 'badge', title: tpl.legalRef + ' | ' + tpl.frequency, html: '<span class="chip">' + esc(tpl.categoryLabel) + '</span> <span class="hint">' + esc(tpl.legalRef) + '</span>' },
          {
            k: 'act',
            html: '<button class="sm ' + (isDone || isDraft ? '' : 'pri') + '" data-doc-open="' + esc(tpl.code) + '">' + (isDone || isDraft ? '✏️ 편집' : '✍️ 작성') + '</button>' +
              '<button class="sm" data-doc-sample="' + esc(tpl.code) + '" title="이미 만든 타 사업장/표준/PC 샘플을 불러와 자동 치환">🔁 샘플</button>' +
              '<button class="sm ok" data-doc-hwpx="' + esc(tpl.code) + '" title="한컴오피스/푸른한글 호환 .hwpx 즉시 내려받기">📥 HWPX</button>' +
              '<button class="sm" data-doc-toggle-na="' + esc(tpl.code) + '">' + (isNa ? '복귀' : '제외') + '</button>'
          }
        ]
      };
    });

    return renderTable('safetyDocs', [
      { text: '단계', cls: 'yr' },
      '서류 · 서식명',
      { text: '적용판정', cls: 'st' },
      { text: '작성상태', cls: 'st' },
      { text: '분류 · 관계법령', cls: 'wide' },
      '작성 · 샘플 · 출력'
    ], docTableRows, CUR_DOC_CODE);
  }

  function drawDocsPane() {
    var box = $('docsBox');
    if (!box || !Docs()) return;
    var proj = projectById(CUR_PID);
    if (!proj) {
      box.innerHTML = '<div class="empty card">먼저 [과거·진행 사업장] 탭에서 사업장을 선택하거나 + 신규 사업장을 등록하세요.</div>';
      return;
    }
    if (DOC_DRAFT_CACHE && DOC_DRAFT_CACHE.pid === proj.id && DOC_DRAFT_CACHE.code === CUR_DOC_CODE && $('docStudioCard')) {
      syncDraftInputsFromDom();
    }
    var ind = Cat().getIndustry(proj.industryCode);
    var dMap = projectDocsMap(proj.id);
    var dSum = Docs().computeDocsSummary(proj, dMap);
    var allTpls = Docs().DOC_TEMPLATES;
    var isWorkstop = Docs().hasWorkstopContext(proj);

    /* (1) 최초 착수 6단계 로드맵 + 업종 차이 요약(기본 접힘) */
    var roadmapHtml = '<div class="card"><details class="sub-fold">' +
      '<summary>🧭 최초 안전보건체계구축 착수 6단계 순서 · <b>' + esc(ind.short) + '</b> 업종 핵심 포인트' +
      (isWorkstop ? ' <span class="chip c-urgent">작업중지·감독 대응 감지</span>' : '') +
      '</summary>' +
      '<div class="sub-fold-bd">' +
        '<div class="' + (isWorkstop ? 'warn' : 'note') + '" style="margin-bottom:8px">' +
        '<b>[' + esc(proj.companyName) + ' · ' + esc(ind.name) + ']</b> 계약 직후 <b>1단계 착수·기초파악 → 2단계 방침·조직·규정·예산 → 3단계 노사협의체·의견청취·TBM → 4단계 위험성평가·점검표 → 5단계 교육·물질·업종특화 → 6단계 비상·도급·작업중지</b> 순으로 구축합니다.<br>' +
        '<span><b>업종 초점:</b> ' + esc(ind.approach) + '</span>' +
        '</div>' +
        '<div class="onboard-steps">' +
        Docs().ONBOARDING_STEPS.map(function (st) {
          return '<div class="onboard-step"><b>' + esc(st.title) + ' (' + esc(st.timing) + ')</b><span>' + esc(st.desc) + '</span></div>';
        }).join('') +
        '</div>' +
      '</div></details></div>';

    /* (2) 2단 통합 상단 스트립: 분류 칩 + 클릭 KPI 칩 */
    var catCounts = { '': allTpls.length };
    Docs().DOC_CATEGORIES.forEach(function (c) { catCounts[c.code] = 0; });
    allTpls.forEach(function (t) { catCounts[t.category] = (catCounts[t.category] || 0) + 1; });

    var stripHtml = '<div class="card sf-top-strip">' +
      '<div class="scope-bar" role="region" aria-label="서류 분류 필터">' +
        '<span class="scope-lbl">서류 분류:</span>' +
        '<button class="scope-btn' + (DOC_CAT_SCOPE === '' ? ' on' : '') + '" aria-pressed="' + (DOC_CAT_SCOPE === '' ? 'true' : 'false') + '" data-doc-cat="">전체 (' + allTpls.length + ')</button>' +
        Docs().DOC_CATEGORIES.map(function (c) {
          var isCatOn = DOC_CAT_SCOPE === c.code;
          return '<button class="scope-btn' + (isCatOn ? ' on' : '') + '" aria-pressed="' + (isCatOn ? 'true' : 'false') + '" data-doc-cat="' + esc(c.code) + '">' +
            esc(c.name) + ' (' + (catCounts[c.code] || 0) + ')</button>';
        }).join('') +
      '</div>' +
      '<div class="kpis">' +
        '<div class="kpi k-blue' + (DOC_KPI_FILTER === '' ? ' k-on' : '') + '" data-doc-kpi="" role="button" tabindex="0" aria-pressed="' + (DOC_KPI_FILTER === '' ? 'true' : 'false') + '" title="전체 적용 대상 서류 보기"><span>전체 대상</span><b>' + dSum.applicableTotal + '종</b></div>' +
        '<div class="kpi k-green' + (DOC_KPI_FILTER === 'req' ? ' k-on' : '') + '" data-doc-kpi="req" role="button" tabindex="0" aria-pressed="' + (DOC_KPI_FILTER === 'req' ? 'true' : 'false') + '" title="법정필수·업종필수·긴급 서류만 보기"><span>필수·업종</span><b>' + dSum.requiredTotal + '종</b></div>' +
        '<div class="kpi k-green' + (DOC_KPI_FILTER === 'done' ? ' k-on' : '') + '" data-doc-kpi="done" role="button" tabindex="0" aria-pressed="' + (DOC_KPI_FILTER === 'done' ? 'true' : 'false') + '" title="작성 완료 서류 보기"><span>작성 완료</span><b>' + dSum.doneCount + '건</b></div>' +
        '<div class="kpi k-amber' + (DOC_KPI_FILTER === 'draft' ? ' k-on' : '') + '" data-doc-kpi="draft" role="button" tabindex="0" aria-pressed="' + (DOC_KPI_FILTER === 'draft' ? 'true' : 'false') + '" title="초안·검토 중 서류 보기"><span>초안·검토</span><b>' + dSum.draftCount + '건</b></div>' +
        '<div class="kpi' + (DOC_KPI_FILTER === 'todo' ? ' k-on' : '') + '" data-doc-kpi="todo" role="button" tabindex="0" aria-pressed="' + (DOC_KPI_FILTER === 'todo' ? 'true' : 'false') + '" title="미작성 서류 보기"><span>미작성</span><b>' + dSum.todoCount + '건</b></div>' +
        '<div class="kpi' + (DOC_KPI_FILTER === 'na' ? ' k-on' : '') + '" data-doc-kpi="na" role="button" tabindex="0" aria-pressed="' + (DOC_KPI_FILTER === 'na' ? 'true' : 'false') + '" title="해당없음 제외 서류 보기"><span>해당없음</span><b>' + dSum.naCount + '건</b></div>' +
        '<div class="kpi k-blue" title="대상 서류 완성률"><span>완성률</span><b>' + dSum.pct + '%</b></div>' +
      '</div></div>';

    /* (3) 필터 · 일괄 실행 바 */
    var filterBarHtml = '<div class="card"><div class="bar">' +
      '<input id="docSearchQ" type="search" value="' + esc(DOC_SEARCH_Q) + '" aria-label="서류·법령·내용 검색" placeholder="서류명 · 규정 · 회의록 · 법령 검색" style="flex:1;min-width:150px">' +
      '<select id="docStatusSel" aria-label="작성 상태 필터">' +
        '<option value=""' + (DOC_KPI_FILTER === '' ? ' selected' : '') + '>전체 상태</option>' +
        '<option value="req"' + (DOC_KPI_FILTER === 'req' ? ' selected' : '') + '>필수 · 업종필수만</option>' +
        '<option value="todo"' + (DOC_KPI_FILTER === 'todo' ? ' selected' : '') + '>미작성만</option>' +
        '<option value="draft"' + (DOC_KPI_FILTER === 'draft' ? ' selected' : '') + '>초안 · 검토중</option>' +
        '<option value="done"' + (DOC_KPI_FILTER === 'done' ? ' selected' : '') + '>작성 완료만</option>' +
        '<option value="na"' + (DOC_KPI_FILTER === 'na' ? ' selected' : '') + '>해당없음 제외분</option>' +
      '</select>' +
      '<button class="sm" id="docResetBtn" style="' + ((DOC_CAT_SCOPE || DOC_KPI_FILTER || DOC_SEARCH_Q) ? '' : 'display:none') + '" title="서류 검색·필터 초기화">↺ 초기화</button>' +
      '<span class="sp"></span>' +
      '<button class="sm pri" data-act="batch-draft-docs" title="현재 사업장 업종·규모 기준 필수 서류 미작성분을 한 번에 초안 생성합니다">⚡ 필수서류 일괄 초안생성</button>' +
      '<button class="sm ok" data-act="batch-zip-docs" title="작성된 전체 서류를 한글(.hwpx) + 목차 HTML 묶음 .zip 으로 내려받습니다">📦 작성서류 일괄 .zip</button>' +
      '</div></div>';

    /* (4) 업종·규모 기준 수직 정렬 서류 목록표 */
    var tableHtml = '<div class="card" id="docsTableCard">' +
      renderSafetyDocsTableHtml(proj, dMap) +
      '</div>';

    /* (5) 개별 서류 작성 · 샘플 자동치환 스튜디오 */
    var studioHtml = '';
    if (CUR_DOC_CODE && Docs().getTemplate(CUR_DOC_CODE)) {
      var d = buildDocDraftState(proj, CUR_DOC_CODE, false);
      var samples = Docs().collectSamplePool(CUR_DOC_CODE, proj.id, D.projects, D.checks, D.intake);
      var projSamples = samples.filter(function (s) { return s.group === 'project' || s.group === 'intake'; });
      var builtinSamples = samples.filter(function (s) { return s.group === 'builtin'; });
      var activeSampleId = (SELECTED_SAMPLE_ID && samples.some(function (s) { return s.id === SELECTED_SAMPLE_ID; }))
        ? SELECTED_SAMPLE_ID
        : ((samples[0] && samples[0].id) || '');
      SELECTED_SAMPLE_ID = activeSampleId;
      var defSample = samples.find(function (s) { return s.id === activeSampleId; }) || samples[0] || { sourceCompany: '', sourceYear: 2025 };

      var sampleOpts = '' +
        (projSamples.length
          ? '<optgroup label="이미 만들어둔 타 사업장 작성본 · 수집자료">' +
            projSamples.map(function (s) { return '<option value="' + esc(s.id) + '"' + (s.id === activeSampleId ? ' selected' : '') + '>' + esc(s.label) + '</option>'; }).join('') +
            '</optgroup>'
          : '') +
        '<optgroup label="업종별 내장 표준 샘플 (즉시 변환)">' +
        builtinSamples.map(function (s) { return '<option value="' + esc(s.id) + '"' + (s.id === activeSampleId ? ' selected' : '') + '>' + esc(s.label) + '</option>'; }).join('') +
        '</optgroup>';

      var targetProjPrev = Object.assign({}, proj, {
        companyName: d.companyName || proj.companyName,
        ceoName: d.ceoName,
        bizNo: d.bizNo,
        address: d.address,
        workerCount: d.workerCount,
        consultantName: d.consultantName
      });

      studioHtml = '<div class="card" id="docStudioCard">' +
        '<div class="sec">' +
          '<span>✍️ [' + d.no + '번] ' + esc(d.name) + '</span>' +
          '<span class="chip ' + esc(Docs().evalDocRequirement(CUR_DOC_CODE, proj).cls) + '">' + esc(d.reqLabel) + '</span>' +
          '<span class="hint">' + esc(d.reqReason) + '</span>' +
          '<span class="sp"></span>' +
          '<button class="sm" data-act="close-doc-studio">✕ 스튜디오 닫기</button>' +
        '</div>' +
        '<div class="doc-studio-grid">' +
          '<div>' +
            '<div class="bar" style="padding:0 0 8px">' +
              '<label class="hint" for="docCoName">사업장명</label><input id="docCoName" type="text" value="' + esc(d.companyName) + '" style="flex:1 1 130px;min-width:0;max-width:100%">' +
              '<label class="hint" for="docCeoName">대표자</label><input id="docCeoName" type="text" value="' + esc(d.ceoName) + '" placeholder="대표자 성명" style="width:110px;max-width:100%">' +
              '<label class="hint" for="docBizNo">사업자번호</label><input id="docBizNo" type="text" value="' + esc(d.bizNo) + '" placeholder="000-00-00000" style="width:120px;max-width:100%">' +
              '<label class="hint" for="docWorkers">근로자</label><input id="docWorkers" type="number" value="' + num(d.workerCount, 0) + '" min="0" max="5000" style="width:74px;max-width:100%">' +
              '<label class="hint" for="docDate">작성일</label><input id="docDate" type="date" value="' + esc(d.docDate) + '" style="width:136px;max-width:100%">' +
              '<button class="sm" id="docResetDraftBtn" title="위 사업장·업종 정보 기준으로 표준 초안을 다시 채웁니다">🔄 표준초안 새로채우기</button>' +
            '</div>' +
            '<div class="bar" style="padding:0 0 8px">' +
              '<label class="hint" for="docAddr">소재지</label><input id="docAddr" type="text" value="' + esc(d.address) + '" placeholder="사업장 주소 입력" style="flex:1 1 160px;min-width:0;max-width:100%">' +
              '<label class="hint" for="docConsName">담당/자문</label><input id="docConsName" type="text" value="' + esc(d.consultantName) + '" style="width:170px;max-width:100%">' +
            '</div>' +
            '<div class="sample-box" id="docSampleBox">' +
              '<div class="bar" style="padding:0 0 6px">' +
                '<b>🔁 기존 샘플 불러와 현재 사업장으로 자동 치환</b>' +
                '<span class="sp"></span>' +
                '<button class="sm" id="docSampleFileBtn" type="button">📎 PC 파일(.hwp·.hwpx·.docx·.txt·.pdf) 샘플 열기</button>' +
                '<input type="file" id="docSampleFileInp" accept=".hwp,.hwpx,.docx,.txt,.csv,.pdf,.xlsx" style="display:none">' +
              '</div>' +
              '<div class="bar" style="padding:0 0 6px">' +
                '<select id="docSampleSel" aria-label="샘플 서류 선택" style="flex:1 1 200px;min-width:0;max-width:100%">' + sampleOpts + '</select>' +
                '<label class="hint" for="smpSrcCo">원본 상호</label><input id="smpSrcCo" type="text" value="' + esc(defSample.sourceCompany || '') + '" placeholder="샘플 속 기존 회사명" style="width:130px;max-width:100%">' +
                '<label class="hint" for="smpSrcYr">원본연도</label><input id="smpSrcYr" type="number" value="' + num(defSample.sourceYear, 2025) + '" min="2015" max="2035" style="width:74px;max-width:100%">' +
                '<label class="hint" style="display:inline-flex;align-items:center;gap:4px"><input type="checkbox" id="smpReplYr" checked> 연도치환</label>' +
              '</div>' +
              '<div class="bar" style="padding:0">' +
                '<input id="smpCustomPairs" type="text" aria-label="추가 치환 규칙" placeholder="추가 치환 (예: 아산공장 -> 서산창고, 프레스 -> 지게차)" style="flex:1 1 160px;min-width:0;max-width:100%">' +
                '<button class="sm pri" id="docApplySampleBtn" type="button">🔁 샘플 불러와 자동 치환</button>' +
                '<button class="sm" id="docMaskPiiBtn" type="button">🛡️ 개인정보 비식별 정리</button>' +
                (d.diffNote ? '<span class="chip c-green" id="smpDiffNote">' + esc(d.diffNote) + '</span>' : '<span class="chip" id="smpDiffNote" style="display:none"></span>') +
              '</div>' +
            '</div>' +
            '<div class="bar" style="padding:0 0 6px">' +
              '<label class="hint" for="docTitleInp">문서 제목</label><input id="docTitleInp" type="text" value="' + esc(d.title) + '" style="flex:1 1 160px;min-width:0;max-width:100%;font-weight:600">' +
              '<label class="hint" for="docStateSel">상태</label>' +
              '<select id="docStateSel">' +
                '<option value="draft"' + (d.status === 'draft' ? ' selected' : '') + '>초안 작성중</option>' +
                '<option value="review"' + (d.status === 'review' ? ' selected' : '') + '>검토 · 확인중</option>' +
                '<option value="done"' + (d.status === 'done' ? ' selected' : '') + '>작성 완료</option>' +
                '<option value="na"' + (d.status === 'na' ? ' selected' : '') + '>해당없음</option>' +
              '</select>' +
            '</div>' +
            '<textarea id="docBodyTa" class="doc-editor-ta" aria-label="서류 본문 편집">' + esc(d.body) + '</textarea>' +
            '<div class="bar" style="padding:8px 0 0">' +
              '<button class="sm" id="docSaveDraftBtn" type="button">💾 초안 저장</button>' +
              '<button class="sm ok" id="docSaveDoneBtn" type="button">✅ 작성 완료 저장</button>' +
              '<button class="sm" id="docSaveNaBtn" type="button">🚫 해당없음 처리</button>' +
            '</div>' +
          '</div>' +
          '<div class="doc-preview-sticky">' +
            '<div class="bar" style="padding:0 0 8px">' +
              '<b>📄 A4 실시간 미리보기</b><span class="sp"></span>' +
              '<button class="sm pri" id="docPrevHwpxBtn" type="button">📥 한글(.hwpx)</button>' +
              '<button class="sm" id="docPrevHangulBtn" type="button">📝 푸른한글 열기</button>' +
              '<button class="sm" id="docPrevPrintBtn" type="button">🖨️ 인쇄/PDF</button>' +
            '</div>' +
            '<div id="docPreviewPane">' + Hwpx().buildSingleDocPreviewHtml(d, targetProjPrev) + '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    }

    box.innerHTML = renderProjectHeaderBar(proj) + roadmapHtml + stripHtml + filterBarHtml + tableHtml + studioHtml;
  }

  /* ── 탭 3: 메일 감지 · 로컬 파일 분석 · 위험성평가 매트릭스 · 회차·면담 준수 감사 ── */
  function drawIntakePane() {
    var box = $('intakeBox');
    var proj = projectById(CUR_PID);
    if (!proj) {
      box.innerHTML = '<div class="empty card">사업장을 먼저 선택하세요.</div>';
      return;
    }
    var cd = checkDocOf(proj.id);
    var sc = SCAN_CACHE[proj.id] || { matched: [], nameCandidates: [] };
    var rdInfo = Report().normalizeRounds(proj);
    var comp = rdInfo.compliance;
    var risk = Report().computeRiskMatrix(cd.riskItems || []);

    var compHtml = comp.ok
      ? '<div class="ok-banner">✅ <b>2026 공단 수행 준수 기준 충족:</b> CEO 면담 ' + comp.ceoCount + '회(기준 ' + comp.minCeoMeetings + '회+), 매 회차 근로자 면담·현장순회 및 2인1조 기준을 충족했습니다.</div>'
      : '<div class="warn">⚠️ <b>2026 공단 수행 준수 점검 알림:</b> ' + esc(comp.issues.join('  |  ')) + '</div>';

    var mailRows = sc.matched.concat(sc.nameCandidates || []).map(function (m) {
      var stChip = m.analyzed ? '<span class="chip c-green">분석완료</span>' : '<span class="chip c-amber">미확인</span>';
      return {
        id: m.key,
        cells: [
          { cls: 'ti', title: m.subject, html: esc(m.subject || '(제목 없음)') + (m.attCount ? ' <span class="chip">📎' + m.attCount + '</span>' : '') },
          { k: 'badge', html: '<span class="chip c-blue">' + esc(m.docKindName) + '</span> ' + stChip },
          { html: esc(m.date || '-') },
          { html: esc(m.dir === 'out' ? ('발신 → ' + m.toLabel) : m.fromLabel) },
          { k: 'act', html: '<button class="sm pri" data-mail-inspect="' + esc(m.key) + '">🔍 내용확인·요약저장</button>' }
        ]
      };
    });

    var cards = Object.keys(D.intake[proj.id] || {}).map(function (k) { return D.intake[proj.id][k]; })
      .filter(function (c) { return c && !c._deleted; })
      .sort(function (a, b) { return num(b.updatedAt, 0) - num(a.updatedAt, 0); });
    var cardRows = cards.map(function (c) {
      var sumTxt = (Array.isArray(c.summaryLines) && c.summaryLines.length) ? c.summaryLines.join(' / ') : str(c.maskedExcerpt).slice(0, 90);
      return {
        id: c.id,
        cells: [
          { cls: 'ti', title: c.title, html: esc(c.title) },
          { k: 'badge', html: '<span class="chip c-green">' + esc(c.docKindName || c.docKind) + '</span>' },
          { cls: 'wide', title: sumTxt, html: esc(sumTxt) },
          { html: esc(fmtDateTime(c.analyzedAt || c.updatedAt)) },
          { k: 'act', html: '<button class="sm" data-view-card="' + esc(c.id) + '">상세</button>' }
        ]
      };
    });

    var riskRows = risk.list.map(function (r) {
      var lvCls = r.level === '상' ? 'c-red' : (r.level === '하' ? 'c-green' : 'c-amber');
      var stCls = r.status === '개선완료' ? 'c-green' : 'c-blue';
      return {
        id: r.id,
        cells: [
          { cls: 'ti', html: esc(r.process) },
          { cls: 'wide', title: r.factor, html: esc(r.factor) },
          { k: 'badge', html: '<span class="chip ' + lvCls + '">' + esc(r.level) + '</span>' },
          { title: r.measure, html: esc(r.measure) },
          { html: '<span class="chip ' + stCls + '">' + esc(r.status) + '</span>' },
          { k: 'act', html: '<button class="sm ok" data-risk-toggle="' + esc(r.id) + '">' + (r.status === '개선완료' ? '재진행' : '✓ 완료') + '</button>' }
        ]
      };
    });

    var rdRows = rdInfo.rounds.map(function (r) {
      return {
        id: String(r.roundNo),
        cells: [
          { cls: 'ti', html: r.roundNo + '회차 (' + esc(r.date) + ')' },
          { k: 'badge', html: (r.twoPersonTeam ? '<span class="chip c-blue">2인1조</span> ' : '<span class="chip">1인</span> ') + (r.ceoMet ? '<span class="chip c-green">CEO면담✓</span> ' : '') + (r.summary1PProvided ? '<span class="chip c-amber">1P제공</span>' : '') },
          { html: (r.workerMet ? '근로자면담✓ ' : '면담× ') + (r.siteTour ? '순회✓' : '순회×') },
          { cls: 'wide', title: r.topic, html: esc(r.topic) },
          { k: 'act', html: '<button class="sm" data-edit-round="' + r.roundNo + '">편집</button>' }
        ]
      };
    });

    var dkOpts = '<option value="">자동 분류 (파일명·본문 기준)</option>' +
      Cat().DOC_KINDS.map(function (d) {
        return '<option value="' + esc(d.code) + '"' + (UPLOAD_DOC_KIND === d.code ? ' selected' : '') + '>' + esc(d.name) + '</option>';
      }).join('');

    box.innerHTML =
      renderProjectHeaderBar(proj) +
      compHtml +
      '<div class="card">' +
        '<div class="sec"><span>📤 로컬 안전보건 자료 비식별 분석 · 위험성평가 표 자동 추출</span>' +
          '<select id="uploadDocKindSel" aria-label="문서 종류 지정">' + dkOpts + '</select>' +
          '<button class="sm pri" id="pickFilesBtn">📎 파일 선택</button>' +
          '<input type="file" id="fileUploadInput" multiple accept=".xlsx,.xls,.csv,.hwpx,.hwp,.docx,.pdf,.txt" style="display:none">' +
        '</div>' +
        '<div class="drop-zone" id="dropZone" role="button" tabindex="0" aria-label="안전보건 자료 파일 업로드 영역"><b>여기에 위험성평가표(.xlsx)·안전보건규정·계획서·점검표(.hwpx/.pdf)를 끌어다 놓으세요</b><span>모든 개인정보는 브라우저에서 즉시 비식별 가림 처리되며 위험요인은 위험성평가 매트릭스에 자동 추가됩니다</span></div>' +
        renderTable('intakeCards', ['비식별 분석 자료명', '서류 분류', '추출 요약', '분석일시', '보기'], cardRows, '') +
      '</div>' +

      '<div class="card">' +
        '<div class="sec"><span>📩 푸른메일함 안전보건 송수신 내역</span><span class="chip c-blue">' + mailRows.length + '건</span></div>' +
        renderTable('projMails', ['메일 제목 · 첨부', '분류 · 상태', '일자', '수발신처', '내용확인'], mailRows, '') +
      '</div>' +

      '<div class="card">' +
        '<div class="sec"><span>⚠️ 위험성평가 유해·위험요인 매트릭스 (총 ' + risk.total + '건 · 상 ' + risk.highCount + ' · 개선율 ' + risk.donePct + '%)</span>' +
          '<span class="sp"></span>' +
          '<button class="sm pri" data-act="add-risk-modal">+ 유해위험요인 추가</button>' +
        '</div>' +
        renderTable('riskItems', ['공정·작업', '유해·위험요인', '등급', '감소대책', '상태', '처리'], riskRows, '') +
      '</div>' +

      '<div class="card">' +
        '<div class="sec"><span>🗓️ 회차별 현장 수행 · CEO/근로자 면담 관리</span>' +
          '<span class="sp"></span>' +
          '<button class="sm pri" data-act="add-round">+ 회차 추가</button>' +
        '</div>' +
        renderTable('rounds', ['회차 · 일자', '투입·면담·1P', '현장활동', '주요 수행 내용', '관리'], rdRows, '') +
      '</div>';
  }

  /* ── 탭 4: 종합보고서(7장) · 핵심 개선사항 1P 요약보고서 · HWPX / 푸른한글 / PDF / XLSX / ZIP ── */
  function readCurrentReportSectionsFromDom() {
    var secs = {};
    var locks = {};
    Cat().REPORT_SECTIONS.forEach(function (s) {
      var ta = $('rptSec_' + s.key);
      if (ta) secs[s.key] = ta.value;
      var lk = document.querySelector('input[data-rpt-lock="' + s.key + '"]');
      if (lk) locks[s.key] = !!lk.checked;
    });
    return { sections: secs, locks: locks };
  }

  function drawReportPane() {
    var box = $('reportBox');
    var proj = projectById(CUR_PID);
    if (!proj) {
      box.innerHTML = '<div class="empty card">사업장을 먼저 선택하세요.</div>';
      return;
    }
    var cd = checkDocOf(proj.id);
    var savedRep = reportDocOf(proj.id);
    var rep = Report().buildComprehensiveReport(proj, cd, D.intake[proj.id] || {}, savedRep);
    var snaps = Object.keys(D.snapshots[proj.id] || {}).map(function (k) { return D.snapshots[proj.id][k]; })
      .filter(function (s) { return s && !s._deleted; })
      .sort(function (a, b) { return num(b.confirmedAt, 0) - num(a.confirmedAt, 0); });

    var barHtml = renderProjectHeaderBar(proj) +
      '<div class="card"><div class="bar">' +
      '<button class="sm" data-act="regen-report">🔄 체크리스트·위평 기준 재조립</button>' +
      '<button class="sm ok" data-act="save-all-report">💾 전체 장 저장</button>' +
      '<span class="sp"></span>' +
      '<button class="sm pri" data-hwpx-dl="comprehensive">📥 종합보고서 (.hwpx)</button>' +
      '<button class="sm pri" data-hwpx-dl="summary1p">📄 핵심개선 1P요약 (.hwpx)</button>' +
      '<button class="sm pri" data-hwpx-dl="checklist">📋 업종체크리스트 (.hwpx)</button>' +
      '<button class="sm" data-hangul-open="' + esc(PREVIEW_KIND) + '">📝 푸른한글 열기</button>' +
      '<button class="sm" data-pdf-print="' + esc(PREVIEW_KIND) + '">🖨️ PDF 인쇄</button>' +
      '<button class="sm ok" data-xlsx-dl="1">📊 통합엑셀</button>' +
      '<button class="sm ok" data-zip-dl="1">📦 전체 .zip</button>' +
      '<button class="sm warn-btn" data-act="save-snapshot">📌 확정 스냅샷</button>' +
      '</div></div>';

    var leftHtml = '<div class="card">' +
      renderSectionList('reportSecs', '종합보고서 7장 본문 편집 (🔒 고정 체크 시 재조립 때도 수기 내용 유지)', rep.schema, rep.sections, rep.locks, 'c-blue') +
      '</div>';

    var snapHtml = snaps.length
      ? '<div class="sec">📌 확정 스냅샷 (' + snaps.length + '건)</div><div class="bar">' +
        snaps.slice(0, 5).map(function (s) { return '<span class="chip c-green">' + esc(s.title) + ' (' + fmtDateTime(s.confirmedAt).slice(0, 10) + ')</span>'; }).join(' ') +
        '</div>'
      : '';

    var rightHtml = '<div class="card report-side-sticky">' +
      '<div class="pill-row">' +
      '<span class="scope-lbl">미리보기 양식:</span>' +
      '<button class="scope-btn' + (PREVIEW_KIND === 'summary1p' ? ' on' : '') + '" aria-pressed="' + (PREVIEW_KIND === 'summary1p' ? 'true' : 'false') + '" data-pv-kind="summary1p">핵심 개선사항 1P 요약</button>' +
      '<button class="scope-btn' + (PREVIEW_KIND === 'comprehensive' ? ' on' : '') + '" aria-pressed="' + (PREVIEW_KIND === 'comprehensive' ? 'true' : 'false') + '" data-pv-kind="comprehensive">종합보고서 (7장)</button>' +
      '<button class="scope-btn' + (PREVIEW_KIND === 'checklist' ? ' on' : '') + '" aria-pressed="' + (PREVIEW_KIND === 'checklist' ? 'true' : 'false') + '" data-pv-kind="checklist">업종 체크리스트</button>' +
      '</div>' +
      '<div style="padding:10px">' + Hwpx().buildPreviewHtml(PREVIEW_KIND, proj, cd, D.intake[proj.id] || {}, rep) + '</div>' +
      snapHtml +
      '</div>';

    box.innerHTML = barHtml + '<div class="report-workbench">' + leftHtml + rightHtml + '</div>';
  }

  /* ── 탭 5: 8대 업종별 비교표 · 2026 공단 수행기준 · 정부 재정지원 연계 매트릭스 ── */
  function drawGuidePane() {
    var box = $('guideBox');
    var indCards = Object.keys(Cat().INDUSTRIES).map(function (ic) {
      var ind = Cat().INDUSTRIES[ic];
      var tr = Cat().getTrack(ind.defaultTrack);
      return '<div class="ind-card">' +
        '<div class="ind-hd">' +
        '<span class="chip ' + esc(ind.badgeCls) + '">' + esc(ind.short) + '</span>' +
        '<b>' + esc(ind.name) + '</b>' +
        '<span class="sp"></span>' +
        '<span class="chip">' + esc(tr.short) + '</span>' +
        '</div>' +
        '<div class="hint"><b>특화 항목:</b> ' + ind.checks.length + '문항 · <b>추천 기인물:</b> ' + ind.recommendedHazards.map(function (h) { var x = Cat().getHazardAgent(h); return x ? x.short : h; }).join(', ') + '</div>' +
        '<ul class="ind-ul">' + ind.mainHazards.slice(0, 3).map(function (hz) { return '<li>' + esc(hz) + '</li>'; }).join('') + '</ul>' +
        '<div class="hint"><b>컨설팅 초점:</b> ' + esc(ind.approach) + '</div>' +
        '<div class="bar" style="padding:4px 0 0">' +
        '<button class="sm" data-quick-ind-dl="' + esc(ic) + '">📥 빈 체크리스트(.hwpx)</button>' +
        '<button class="sm pri" data-start-ind-proj="' + esc(ic) + '">🚀 이 업종으로 신규 등록</button>' +
        '</div></div>';
    }).join('');

    var trHtml = '<div class="card"><div class="sec"><span>⚖️ 수행 사업 트랙별 2026 공단 · 민간 수행기준</span></div><div class="scroll"><table class="t"><thead><tr>' +
      '<th>트랙명</th><th>주관</th><th>방문 회차</th><th>2인 1조</th><th>CEO 면담</th><th>기간</th><th>적용 대상</th>' +
      '</tr></thead><tbody>' +
      Object.keys(Cat().TRACKS).map(function (k) {
        var t = Cat().TRACKS[k];
        return '<tr><td class="ti"><span class="chip ' + esc(t.badgeCls) + '">' + esc(t.name) + '</span></td>' +
          '<td>' + esc(t.agencyName) + '</td>' +
          '<td>' + t.defaultRounds + '회 (조기 ' + t.earlyCloseRound + '회)</td>' +
          '<td>' + t.pairRounds.join(',') + '회차</td>' +
          '<td>최소 ' + t.minCeoMeetings + '회</td>' +
          '<td>' + esc(t.monthsRange) + '</td>' +
          '<td class="wide">' + esc(t.targetScale) + '</td></tr>';
      }).join('') +
      '</tbody></table></div></div>';

    var aidHtml = '<div class="card"><div class="sec"><span>💰 컨설팅 이후 연계 가능한 정부 재정지원사업 (7종)</span></div><div class="scroll"><table class="t"><thead><tr>' +
      '<th>지원사업명</th><th>지원 대상</th><th>주요 지원 내용</th>' +
      '</tr></thead><tbody>' +
      Cat().GOV_AID_PROGRAMS.map(function (a) {
        return '<tr><td class="ti">' + esc(a.name) + '</td><td>' + esc(a.target) + '</td><td class="wide">' + esc(a.support) + '</td></tr>';
      }).join('') +
      '</tbody></table></div></div>';

    box.innerHTML =
      '<div class="note"><b>다업종 맞춤 가이드:</b> 안전보건컨설팅은 제조업(일반·고위험 특화)뿐만 아니라 도소매·물류, 시설관리·서비스, 의료·사회복지, 숙박·외식, 교육·사무, 건설·도급 등 업종마다 핵심 사망·질병 원인과 법령 초점이 다릅니다. 아래 카드에서 업종별 빈 체크리스트를 즉시 내려받거나 복합업종 체크를 시작하세요.</div>' +
      '<div class="guide-grid">' + indCards + '</div>' +
      trHtml + aidHtml;
  }

  /* ══ 8. 모달 창 (신규등록 · 업종/기인물 설정 · 메모 · 위험요인 · 회차편집) ══ */
  var LAST_MODAL_FOCUS = null;
  function showModal(title, bodyHtml, footHtml, wide) {
    var m = $('modal'), mb = $('mbox');
    if (!m || !mb) return;
    LAST_MODAL_FOCUS = (typeof document !== 'undefined' && document.activeElement) ? document.activeElement : null;
    mb.className = 'mbox' + (wide ? ' wide' : '');
    mb.innerHTML = '<div class="mhd"><span id="mhdTitle">' + esc(title) + '</span><span class="sp"></span><button class="sm" data-close-modal="1">✕ 닫기</button></div>' +
      '<div class="mbd">' + bodyHtml + '</div>' +
      (footHtml ? '<div class="mft">' + footHtml + '</div>' : '');
    m.style.display = 'flex';
    setTimeout(function () { try { mb.focus(); } catch (e) {} }, 0);
  }
  function closeModal() {
    if ($('modal')) $('modal').style.display = 'none';
    if (LAST_MODAL_FOCUS && typeof LAST_MODAL_FOCUS.focus === 'function') {
      try { LAST_MODAL_FOCUS.focus(); } catch (e) {}
    }
    LAST_MODAL_FOCUS = null;
  }

  function openNewProjectModal(presetIndCode) {
    var indSel = Object.keys(Cat().INDUSTRIES).map(function (ic) {
      var ind = Cat().INDUSTRIES[ic];
      return '<option value="' + esc(ic) + '"' + (ic === (presetIndCode || 'mfg_general') ? ' selected' : '') + '>' + esc(ind.name) + '</option>';
    }).join('');
    var trSel = Object.keys(Cat().TRACKS).map(function (tc) {
      var tr = Cat().TRACKS[tc];
      var defTr = presetIndCode ? Cat().getIndustry(presetIndCode).defaultTrack : 'kosha_mfg';
      return '<option value="' + esc(tc) + '"' + (tc === defTr ? ' selected' : '') + '>' + esc(tr.name) + '</option>';
    }).join('');

    var body = '<div class="fr"><label for="npCompanySel">푸른이알피 거래처</label><div class="fv"><select id="npCompanySel"><option value="">(직접 상호 입력 또는 기존 거래처 선택)</option>' +
      D.companies.slice(0, 400).map(function (c) {
        return '<option value="' + esc(c.id) + '">' + esc(c.name) + (c.bizNo ? ' (' + esc(c.bizNo) + ')' : '') + '</option>';
      }).join('') + '</select></div></div>' +
      '<div class="fr"><label for="npName">사업장명 *</label><div class="fv"><input type="text" id="npName" placeholder="예: ㈜푸른정밀 또는 ○○종합사회복지관"></div></div>' +
      '<div class="fr"><label for="npInd">주업종 *</label><div class="fv"><select id="npInd">' + indSel + '</select></div></div>' +
      '<div class="fr"><label for="npTrack">수행 트랙 *</label><div class="fv"><select id="npTrack">' + trSel + '</select></div></div>' +
      '<div class="fr"><label for="npWorkers">상시근로자수</label><div class="fv"><input type="number" id="npWorkers" value="25" min="1" max="5000"></div></div>' +
      '<div class="fr"><label for="npYear">수행 연도 · 구분</label><div class="fv"><input type="number" id="npYear" value="2026" min="2022" max="2030">' +
      '<select id="npStatus" aria-label="수행 구분"><option value="active">🚀 진행·신규 예정</option><option value="archive">📚 과거 수행이력 (아카이브)</option></select></div></div>' +
      '<div class="fr"><label for="npNote">수행 · 특이사항 메모</label><div class="fv"><input type="text" id="npNote" placeholder="보유설비·사전파악 사항(개인정보 제외)"></div></div>';

    showModal('🦺 신규 사업장 등록 / 과거 이력 추가', body,
      '<button data-close-modal="1">취소</button><button class="pri" id="saveNewProjBtn">저장 후 체크리스트 시작</button>');

    if ($('npCompanySel')) {
      $('npCompanySel').onchange = function () {
        var co = findCompanyById(this.value);
        if (co && $('npName')) {
          $('npName').value = str(co.name);
          var inf = Intake().inferIndustryCode(co.name, co.bizType, co.bizItem, '');
          if ($('npInd')) $('npInd').value = inf;
          if ($('npTrack')) $('npTrack').value = Cat().getIndustry(inf).defaultTrack;
        }
      };
    }
    if ($('npInd')) {
      $('npInd').onchange = function () {
        if ($('npTrack')) $('npTrack').value = Cat().getIndustry(this.value).defaultTrack;
      };
    }
    if ($('saveNewProjBtn')) {
      $('saveNewProjBtn').onclick = async function () {
        var btn = this;
        var nm = str($('npName').value);
        if (!nm) { toast('사업장명을 입력하세요.'); return; }
        btn.disabled = true;
        try {
          var coSelId = str($('npCompanySel').value);
          var indCode = $('npInd').value;
          var indObj = Cat().getIndustry(indCode);
          var yr = num($('npYear').value, 2026);
          var p = await saveProjectRecord({
            id: 'sf_' + Intake().safeIdPart(coSelId || nm) + '_' + yr,
            companyId: coSelId || ('sfco_' + Intake().safeIdPart(nm)),
            companyName: nm,
            industryCode: indCode,
            track: $('npTrack').value,
            workerCount: num($('npWorkers').value, 0),
            year: yr,
            status: $('npStatus').value,
            selectedHazards: indObj.recommendedHazards.slice(),
            summaryNote: Intake().cleanCategoryLabel($('npNote').value, '', 160),
            consultantName: ME.name ? ME.name + ' 공인노무사' : '푸른노무법인 전담 공인노무사'
          });
          if (!p) return;
          CUR_PID = p.id;
          TAB = 'check';
          closeModal();
          rebuildScanAndDiscover();
          draw();
          toast(p.companyName + ' 등록 완료 — 착수 사전 체크를 진행하세요.');
        } catch (err) {
          toast('등록 실패: ' + ((err && err.message) || err));
        } finally {
          btn.disabled = false;
        }
      };
    }
  }

  function openConfigModal(proj) {
    var indOpts = Object.keys(Cat().INDUSTRIES).map(function (ic) {
      return '<option value="' + esc(ic) + '"' + (proj.industryCode === ic ? ' selected' : '') + '>' + esc(Cat().INDUSTRIES[ic].name) + '</option>';
    }).join('');
    var trOpts = Object.keys(Cat().TRACKS).map(function (tc) {
      return '<option value="' + esc(tc) + '"' + (proj.track === tc ? ' selected' : '') + '>' + esc(Cat().TRACKS[tc].name) + '</option>';
    }).join('');
    var curHaz = Array.isArray(proj.selectedHazards) && proj.selectedHazards.length ? proj.selectedHazards : Cat().getIndustry(proj.industryCode).recommendedHazards;
    var hazGrid = '<div class="task-pick-grid">' + Object.keys(Cat().HAZARD_AGENTS).map(function (hc) {
      var ha = Cat().HAZARD_AGENTS[hc];
      var on = curHaz.indexOf(hc) >= 0;
      return '<label class="task-opt' + (on ? ' on' : '') + '"><input type="checkbox" data-cfg-haz="' + esc(hc) + '"' + (on ? ' checked' : '') + '>' +
        '<div><b>' + esc(ha.name) + '</b><span>' + esc(ha.deathsStat) + '</span></div></label>';
    }).join('') + '</div>';

    var body = '<div class="fr"><label for="cfgInd">주업종</label><div class="fv"><select id="cfgInd">' + indOpts + '</select></div></div>' +
      '<div class="fr"><label for="cfgTrack">수행 트랙</label><div class="fv"><select id="cfgTrack">' + trOpts + '</select></div></div>' +
      '<div class="fr"><label for="cfgWorkers">상시근로자수</label><div class="fv"><input type="number" id="cfgWorkers" value="' + num(proj.workerCount, 25) + '" min="1" max="5000">' +
      '<select id="cfgStatus" aria-label="진행 구분"><option value="active"' + (proj.status !== 'archive' ? ' selected' : '') + '>진행중</option><option value="archive"' + (proj.status === 'archive' ? ' selected' : '') + '>과거 수행이력(완료)</option></select></div></div>' +
      '<div class="fr"><label for="cfgNote">비고·이력 메모</label><div class="fv"><input type="text" id="cfgNote" value="' + esc(proj.summaryNote || '') + '"></div></div>' +
      '<div class="sec" style="margin:8px 0">보유 고위험 기인물 24종 다중 선택</div>' + hazGrid;

    showModal('🏭 [' + proj.companyName + '] 업종 · 트랙 · 고위험 기인물 설정', body,
      '<button data-close-modal="1">취소</button><button class="pri" id="saveCfgBtn">설정 저장</button>', true);

    if ($('saveCfgBtn')) {
      $('saveCfgBtn').onclick = async function () {
        var pickedHaz = [];
        document.querySelectorAll('input[data-cfg-haz]:checked').forEach(function (cb) { pickedHaz.push(cb.getAttribute('data-cfg-haz')); });
        try {
          await saveProjectRecord(Object.assign({}, proj, {
            industryCode: $('cfgInd').value,
            track: $('cfgTrack').value,
            workerCount: num($('cfgWorkers').value, 0),
            status: $('cfgStatus').value,
            summaryNote: Intake().cleanCategoryLabel($('cfgNote').value, '', 180),
            selectedHazards: pickedHaz
          }));
          DOC_DRAFT_CACHE = null;
          SELECTED_SAMPLE_ID = '';
          closeModal();
          draw();
          toast('사업장 업종·규모·기인물 설정을 저장했습니다.');
        } catch (err) {
          toast('설정 저장 실패: ' + ((err && err.message) || err));
        }
      };
    }
  }

  function openAddRiskModal(proj) {
    var body = '<div class="fr"><label for="rkProc">공정·작업명</label><div class="fv"><input type="text" id="rkProc" placeholder="예: 프레스 성형 / 지게차 상하차 / 환자 이승"></div></div>' +
      '<div class="fr"><label for="rkFact">유해·위험요인 *</label><div class="fv"><input type="text" id="rkFact" placeholder="예: 금형 사이 협착 / 전도·부딪힘 / 요통"></div></div>' +
      '<div class="fr"><label for="rkLevel">위험성 등급</label><div class="fv"><select id="rkLevel"><option value="상">상 (즉시 개선)</option><option value="중" selected>중 (기한 내 감소)</option><option value="하">하 (유지·관리)</option></select></div></div>' +
      '<div class="fr"><label for="rkMeas">감소대책</label><div class="fv"><input type="text" id="rkMeas" placeholder="예: 광전자식 방호장치 설치 및 LOTO 잠금 실시"></div></div>';
    showModal('⚠️ 유해·위험요인 추가 (위험성평가 매트릭스)', body,
      '<button data-close-modal="1">취소</button><button class="pri" id="saveRiskBtn">추가 저장</button>');
    if ($('saveRiskBtn')) {
      $('saveRiskBtn').onclick = async function () {
        var fact = Intake().cleanCategoryLabel($('rkFact').value, '', 140);
        if (!fact) { toast('유해·위험요인을 입력하세요.'); return; }
        var hz = {
          id: 'hz_' + Date.now().toString(36),
          process: Intake().cleanCategoryLabel($('rkProc').value, '공통공정', 40),
          factor: fact,
          level: $('rkLevel').value,
          measure: Intake().cleanCategoryLabel($('rkMeas').value, '방호장치·작업표준 준수', 140),
          status: '진행중'
        };
        try {
          await saveCheckDoc(proj, function (cd) {
            var list = Array.isArray(cd.riskItems) ? cd.riskItems.slice() : [];
            list.push(hz);
            cd.riskItems = list;
            return cd;
          });
          closeModal();
          draw();
          toast('위험성평가 항목을 추가했습니다.');
        } catch (err) {
          toast('저장 실패: ' + ((err && err.message) || err));
        }
      };
    }
  }

  function openEditRoundModal(proj, roundNo) {
    var rdInfo = Report().normalizeRounds(proj);
    var r = rdInfo.rounds.find(function (x) { return x.roundNo === roundNo; }) || {
      roundNo: rdInfo.rounds.length + 1, date: '', twoPersonTeam: false, ceoMet: false, workerMet: true, siteTour: true, summary1PProvided: false, topic: ''
    };
    var body = '<div class="fr"><label for="rdDate">방문 일자</label><div class="fv"><input type="date" id="rdDate" value="' + esc(/^\d{4}-\d{2}-\d{2}$/.test(r.date) ? r.date : '') + '"></div></div>' +
      '<div class="fr"><label>수행 편성·면담</label><div class="fv">' +
      '<label><input type="checkbox" id="rdPair"' + (r.twoPersonTeam ? ' checked' : '') + '> 2인1조</label>' +
      '<label><input type="checkbox" id="rdCeo"' + (r.ceoMet ? ' checked' : '') + '> 사업주(CEO) 면담</label>' +
      '<label><input type="checkbox" id="rdWorker"' + (r.workerMet ? ' checked' : '') + '> 현장근로자 면담</label>' +
      '<label><input type="checkbox" id="rdTour"' + (r.siteTour ? ' checked' : '') + '> 현장 순회점검</label>' +
      '<label><input type="checkbox" id="rd1P"' + (r.summary1PProvided ? ' checked' : '') + '> 핵심개선 1P 요약 제공</label>' +
      '</div></div>' +
      '<div class="fr"><label for="rdTopic">수행 내용 요약</label><div class="fv"><input type="text" id="rdTopic" value="' + esc(r.topic) + '"></div></div>';
    showModal('🗓️ ' + r.roundNo + '회차 컨설팅 수행 실적 편집', body,
      '<button data-close-modal="1">취소</button><button class="pri" id="saveRdBtn">저장</button>');
    if ($('saveRdBtn')) {
      $('saveRdBtn').onclick = async function () {
        var nextRounds = rdInfo.rounds.slice();
        var updated = {
          roundNo: r.roundNo,
          date: $('rdDate').value || '일정 조율',
          twoPersonTeam: !!$('rdPair').checked,
          ceoMet: !!$('rdCeo').checked,
          workerMet: !!$('rdWorker').checked,
          siteTour: !!$('rdTour').checked,
          summary1PProvided: !!$('rd1P').checked,
          topic: Intake().cleanCategoryLabel($('rdTopic').value, r.roundNo + '회차 수행', 180)
        };
        var idx = nextRounds.findIndex(function (x) { return x.roundNo === r.roundNo; });
        if (idx >= 0) nextRounds[idx] = updated;
        else nextRounds.push(updated);
        try {
          await saveProjectRecord(Object.assign({}, proj, { rounds: nextRounds, roundCount: nextRounds.length }));
          closeModal();
          draw();
          toast(r.roundNo + '회차 수행 이력을 저장했습니다.');
        } catch (err) {
          toast('저장 실패: ' + ((err && err.message) || err));
        }
      };
    }
  }

  /* ══ 9. 이벤트 바인딩 (탭 · 버튼 · ☐ 끌어고르기 · 일괄실행) ═══════════════ */
  async function handleBulkAction(listName, op) {
    var ids = pickedIds(listName);
    if (!ids.length) return;
    var proj = projectById(CUR_PID);

    if (listName === 'projects' && op === 'del') {
      for (var i = 0; i < ids.length; i++) await softDeleteProject(ids[i]);
      clearSel('projects');
      rebuildScanAndDiscover();
      draw();
      toast(ids.length + '개 사업장을 숨김(소프트 삭제) 처리했습니다.');
    } else if (listName === 'discover' && op === 'activate') {
      for (var d = 0; d < ids.length; d++) {
        var cand = DISCOVER_LIST.find(function (c) { return c.candKey === ids[d]; });
        if (!cand) continue;
        await saveProjectRecord({
          id: 'sf_' + Intake().safeIdPart(cand.companyId || cand.companyName) + '_' + cand.year,
          companyId: cand.companyId,
          companyName: cand.companyName,
          bizNo: cand.bizNo,
          industryCode: cand.industryCode,
          track: cand.track,
          year: cand.year,
          status: cand.year < 2026 ? 'archive' : 'active',
          source: cand.source,
          summaryNote: cand.bizLabel
        });
      }
      clearSel('discover');
      rebuildScanAndDiscover();
      draw();
      toast(ids.length + '개 후보 사업장을 활성화했습니다.');
    } else if (listName === 'folderSync' && op === 'import') {
      for (var f = 0; f < ids.length; f++) await importFolderGroup(ids[f]);
      clearSel('folderSync');
    } else if (proj && (listName === 'preChecks' || listName === 'core7Checks' || listName === 'industryChecks' || listName === 'hazardItems' || listName === 'docChecklist')) {
      var bucket = { preChecks: 'pre', core7Checks: 'core7', industryChecks: 'industry', hazardItems: 'hazards', docChecklist: 'docs' }[listName];
      await saveCheckDoc(proj, function (cd) {
        cd[bucket] = Object.assign({}, cd[bucket] || {});
        ids.forEach(function (id) {
          cd[bucket][id] = Object.assign({}, typeof cd[bucket][id] === 'object' ? cd[bucket][id] : {}, { status: op, autoFromDocs: false });
        });
        return cd;
      });
      clearSel(listName);
      draw();
      toast(ids.length + '건 상태를 일괄 반영했습니다.');
    } else if (proj && listName === 'intakeCards' && op === 'del') {
      for (var k = 0; k < ids.length; k++) {
        var card = D.intake[proj.id] && D.intake[proj.id][ids[k]];
        if (card) await saveIntakeCard(proj, Object.assign({}, card, { _deleted: true }));
      }
      clearSel('intakeCards');
      draw();
      toast(ids.length + '개 자료 카드를 삭제 처리했습니다.');
    } else if (proj && (listName === 'projMails' || listName === 'candMails') && op === 'analyze') {
      for (var m = 0; m < Math.min(ids.length, 5); m++) await inspectProjectMail(proj, ids[m]);
      clearSel(listName);
    } else if (proj && listName === 'riskItems') {
      await saveCheckDoc(proj, function (cd) {
        cd.riskItems = (Array.isArray(cd.riskItems) ? cd.riskItems : []).map(function (it) {
          if (ids.indexOf(it.id) < 0) return it;
          return op === 'del' ? Object.assign({}, it, { _deleted: true }) : Object.assign({}, it, { status: '개선완료' });
        });
        return cd;
      });
      clearSel('riskItems');
      draw();
    } else if (proj && listName === 'rounds') {
      var rdInfo = Report().normalizeRounds(proj);
      var nextRds = rdInfo.rounds.filter(function (r) {
        return !(op === 'del' && ids.indexOf(String(r.roundNo)) >= 0);
      }).map(function (r) {
        if (ids.indexOf(String(r.roundNo)) < 0) return r;
        if (op === 'ceo') return Object.assign({}, r, { ceoMet: true });
        if (op === 'pair') return Object.assign({}, r, { twoPersonTeam: true });
        return r;
      });
      await saveProjectRecord(Object.assign({}, proj, { rounds: nextRds, roundCount: nextRds.length }));
      clearSel('rounds');
      draw();
    } else if (proj && listName === 'safetyDocs' && Docs()) {
      var cntChanged = 0;
      var skippedDocs = 0;
      for (var sd = 0; sd < ids.length; sd++) {
        var dCode = ids[sd];
        var tplB = Docs().getTemplate(dCode);
        if (!tplB) continue;
        if (op === 'draft') {
          var prevDraftChk = projectDocOf(proj.id, dCode);
          if (prevDraftChk && (prevDraftChk.status === 'done' || prevDraftChk.status === 'draft' || prevDraftChk.status === 'review' || prevDraftChk.status === 'na' || prevDraftChk.applicable === 'na' || str(prevDraftChk.body))) {
            skippedDocs++;
            continue;
          }
          var genB = Docs().buildTemplateDraft(dCode, proj, {});
          await saveSafetyDoc(proj, dCode, {
            title: genB.title, body: genB.body, docDate: new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10),
            status: 'draft', applicable: 'yes'
          });
          cntChanged++;
        } else if (op === 'na') {
          var prevNa = projectDocOf(proj.id, dCode) || {};
          await saveSafetyDoc(proj, dCode, {
            title: str(prevNa.title) || tplB.short, body: str(prevNa.body), status: 'na', applicable: 'na'
          });
          cntChanged++;
        } else if (op === 'todo') {
          var prevTd = projectDocOf(proj.id, dCode);
          if (prevTd) {
            await saveSafetyDoc(proj, dCode, Object.assign({}, prevTd, { status: prevTd.body ? 'draft' : 'todo', applicable: 'yes' }));
            cntChanged++;
          }
        }
      }
      clearSel('safetyDocs');
      draw();
      toast(cntChanged > 0
        ? ('선택 서류 ' + cntChanged + '종을 일괄 처리했습니다.' + (skippedDocs > 0 ? ' (기존·제외 ' + skippedDocs + '종 보호됨)' : ''))
        : '이미 작성·제외된 서류를 보호하기 위해 건너뛰었습니다.');
    } else if (proj && listName === 'reportSecs') {
      var dom = readCurrentReportSectionsFromDom();
      ids.forEach(function (k) {
        if (op === 'lock') dom.locks[k] = true;
        else if (op === 'unlock') dom.locks[k] = false;
      });
      await saveReportDoc(proj, dom.sections, dom.locks);
      clearSel('reportSecs');
      draw();
      toast('선택 장 상태를 저장했습니다.');
    }
  }

  function mountReleaseShaChip() {
    var el = $('releaseShaChip');
    if (!el || typeof document === 'undefined') return;
    var m = document.querySelector('meta[name="pu-release"]');
    var raw = m ? str(m.getAttribute('content')) : '';
    if (raw && raw !== 'local') {
      el.textContent = '🔖 #' + raw.slice(0, 7);
      el.title = '반영 커밋: ' + raw;
      el.style.display = '';
      return;
    }
    var host = (global.location && global.location.hostname) || '';
    if (host === '127.0.0.1' || host === 'localhost') {
      el.textContent = '🔖 local';
      el.title = '로컬 미리보기(배포 전)';
      el.style.display = '';
    }
  }

  function bindEvents() {
    mountReleaseShaChip();
    document.addEventListener('click', async function (e) {
      var t = e.target;
      if (!t) return;

      /* 탭 전환 */
      var tabBtn = t.closest('[data-tab]');
      if (tabBtn) {
        TAB = tabBtn.getAttribute('data-tab');
        draw();
        return;
      }

      if (t.closest('[data-close-modal]')) { closeModal(); return; }
      if (t.id === 'modal') { closeModal(); return; }

      var clearBtn = t.closest('[data-clear]');
      if (clearBtn) { clearSel(clearBtn.getAttribute('data-clear')); drawBulks(); return; }

      var bulkBtn = t.closest('[data-bulkact]');
      if (bulkBtn) {
        var parts = bulkBtn.getAttribute('data-bulkact').split(':');
        try {
          await handleBulkAction(parts[0], parts[1]);
        } catch (err) {
          toast('일괄 처리 실패: ' + ((err && err.message) || err));
        }
        return;
      }

      var scopeBtn = t.closest('[data-scope]');
      if (scopeBtn) { TRACK_SCOPE = scopeBtn.getAttribute('data-scope'); draw(); return; }

      var koshaKpiBtn = t.closest('[data-kpi-kosha]');
      if (koshaKpiBtn) {
        TRACK_SCOPE = TRACK_SCOPE === '__kosha__' ? '' : '__kosha__';
        if ($('projTrack')) $('projTrack').value = TRACK_SCOPE;
        draw();
        return;
      }

      var kpiBtn = t.closest('[data-kpi-status]');
      if (kpiBtn && $('projStatus')) {
        var nextSt = kpiBtn.getAttribute('data-kpi-status') || '';
        if (!nextSt) {
          TRACK_SCOPE = '';
          if ($('projTrack')) $('projTrack').value = '';
          $('projStatus').value = '';
        } else {
          $('projStatus').value = $('projStatus').value === nextSt ? '' : nextSt;
        }
        draw();
        return;
      }

      var openBtn = t.closest('[data-open-proj]');
      if (openBtn) {
        CUR_PID = openBtn.getAttribute('data-open-proj');
        var goTab = openBtn.getAttribute('data-go') || 'check';
        var tabEl = document.querySelector('[data-tab="' + goTab + '"]');
        if (tabEl) tabEl.click();
        return;
      }

      var gotoBtn = t.closest('[data-goto-tab]');
      if (gotoBtn) {
        var te = document.querySelector('[data-tab="' + gotoBtn.getAttribute('data-goto-tab') + '"]');
        if (te) te.click();
        return;
      }

      var candBtn = t.closest('[data-activate-cand]');
      if (candBtn) {
        var cKey = candBtn.getAttribute('data-activate-cand');
        var cand = DISCOVER_LIST.find(function (c) { return c.candKey === cKey; });
        if (cand) {
          var saved = await saveProjectRecord({
            id: 'sf_' + Intake().safeIdPart(cand.companyId || cand.companyName) + '_' + cand.year,
            companyId: cand.companyId, companyName: cand.companyName, bizNo: cand.bizNo,
            industryCode: cand.industryCode, track: cand.track, year: cand.year,
            status: cand.year < 2026 ? 'archive' : 'active', source: cand.source, summaryNote: cand.bizLabel
          });
          if (saved) { CUR_PID = saved.id; TAB = 'check'; rebuildScanAndDiscover(); draw(); toast(saved.companyName + ' 워크스페이스 개설 완료'); }
        }
        return;
      }

      var impBtn = t.closest('[data-import-folder]');
      if (impBtn) { await importFolderGroup(impBtn.getAttribute('data-import-folder')); return; }

      var layerBtn = t.closest('[data-chk-layer]');
      if (layerBtn) { CHECK_LAYER = layerBtn.getAttribute('data-chk-layer'); drawCheckPane(); return; }

      var pvBtn = t.closest('[data-pv-kind]');
      if (pvBtn) { PREVIEW_KIND = pvBtn.getAttribute('data-pv-kind'); drawReportPane(); return; }

      /* 탭 3(필수서류·서식) 분류 칩 · 클릭 KPI · 초기화 · 개별 열기 · 샘플 치환 · 출력 */
      var dCatBtn = t.closest('[data-doc-cat]');
      if (dCatBtn) { DOC_CAT_SCOPE = dCatBtn.getAttribute('data-doc-cat') || ''; drawDocsPane(); return; }

      var dKpiBtn = t.closest('[data-doc-kpi]');
      if (dKpiBtn) {
        var nk = dKpiBtn.getAttribute('data-doc-kpi') || '';
        DOC_KPI_FILTER = (!nk || DOC_KPI_FILTER === nk) ? '' : nk;
        drawDocsPane();
        return;
      }

      if (t.id === 'docResetBtn') {
        DOC_CAT_SCOPE = ''; DOC_KPI_FILTER = ''; DOC_SEARCH_Q = '';
        drawDocsPane();
        return;
      }

      var proj = projectById(CUR_PID);

      var openByKindBtn = t.closest('[data-open-doc-by-kind]');
      if (openByKindBtn && proj && Docs()) {
        var dkCode = openByKindBtn.getAttribute('data-open-doc-by-kind');
        var foundTpl = Docs().DOC_TEMPLATES.find(function (x) { return x.docKind === dkCode; });
        if (foundTpl) {
          if (foundTpl.code !== CUR_DOC_CODE) {
            if (!confirmSwitchSafetyDoc(proj, foundTpl.code)) return;
            CUR_DOC_CODE = foundTpl.code;
            DOC_DRAFT_CACHE = null;
            SELECTED_SAMPLE_ID = '';
          } else {
            syncDraftInputsFromDom();
          }
          TAB = 'docs';
          draw();
          if ($('docStudioCard') && $('docStudioCard').scrollIntoView) $('docStudioCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        return;
      }

      var docOpenBtn = t.closest('[data-doc-open], [data-doc-sample]');
      if (docOpenBtn && proj && Docs()) {
        var dc = docOpenBtn.getAttribute('data-doc-open') || docOpenBtn.getAttribute('data-doc-sample');
        if (dc !== CUR_DOC_CODE) {
          if (!confirmSwitchSafetyDoc(proj, dc)) return;
          CUR_DOC_CODE = dc;
          DOC_DRAFT_CACHE = null;
          SELECTED_SAMPLE_ID = '';
        } else {
          syncDraftInputsFromDom();
        }
        drawDocsPane();
        if (docOpenBtn.hasAttribute('data-doc-sample') && $('docSampleBox') && $('docSampleBox').scrollIntoView) {
          $('docSampleBox').scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else if ($('docStudioCard') && $('docStudioCard').scrollIntoView) {
          $('docStudioCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        return;
      }

      var docHwpxBtn = t.closest('[data-doc-hwpx]');
      if (docHwpxBtn && proj && Docs()) {
        var hc2 = docHwpxBtn.getAttribute('data-doc-hwpx');
        var draftObj = (hc2 === CUR_DOC_CODE && DOC_DRAFT_CACHE && DOC_DRAFT_CACHE.pid === proj.id)
          ? syncDraftInputsFromDom()
          : makeDocDraftObj(proj, hc2);
        if (draftObj) {
          Hwpx().downloadSingleDocHwpx(draftObj, Object.assign({}, proj, {
            companyName: draftObj.companyName || proj.companyName,
            ceoName: draftObj.ceoName,
            workerCount: draftObj.workerCount,
            consultantName: draftObj.consultantName
          }));
          toast('한글(.hwpx) 서식을 내려받았습니다.');
        }
        return;
      }

      var docNaBtn = t.closest('[data-doc-toggle-na]');
      if (docNaBtn && proj && Docs()) {
        var nc2 = docNaBtn.getAttribute('data-doc-toggle-na');
        var curRec = projectDocOf(proj.id, nc2);
        var tplNa = Docs().getTemplate(nc2);
        var isCurNa = !!(curRec && (curRec.applicable === 'na' || curRec.status === 'na'));
        try {
          await saveSafetyDoc(proj, nc2, {
            title: (curRec && curRec.title) || (tplNa && tplNa.short) || nc2,
            body: (curRec && curRec.body) || '',
            status: isCurNa ? ((curRec && curRec.body) ? 'draft' : 'todo') : 'na',
            applicable: isCurNa ? 'yes' : 'na'
          });
          draw();
          toast(isCurNa ? '적용 대상으로 복구했습니다.' : '해당없음으로 제외했습니다.');
        } catch (err) {
          toast('상태 변경 실패: ' + ((err && err.message) || err));
        }
        return;
      }

      if (t.id === 'docResetDraftBtn' && proj && CUR_DOC_CODE && Docs()) {
        syncDraftInputsFromDom();
        var rebuilt = Docs().buildTemplateDraft(CUR_DOC_CODE, proj, {
          companyName: DOC_DRAFT_CACHE.companyName,
          ceoName: DOC_DRAFT_CACHE.ceoName,
          bizNo: DOC_DRAFT_CACHE.bizNo,
          address: DOC_DRAFT_CACHE.address,
          workerCount: DOC_DRAFT_CACHE.workerCount,
          docDate: DOC_DRAFT_CACHE.docDate,
          consultantName: DOC_DRAFT_CACHE.consultantName
        });
        DOC_DRAFT_CACHE.title = rebuilt.title;
        DOC_DRAFT_CACHE.body = rebuilt.body;
        DOC_DRAFT_CACHE.sourceGuard = null;
        DOC_DRAFT_CACHE.diffNote = '현재 사업장 업종(' + rebuilt.industryName + ') 기준으로 새로 채웠습니다';
        drawDocsPane();
        return;
      }

      if (t.id === 'docSampleFileBtn' && $('docSampleFileInp')) {
        $('docSampleFileInp').value = '';
        $('docSampleFileInp').click();
        return;
      }

      if (t.id === 'docApplySampleBtn' && proj && CUR_DOC_CODE && Docs()) {
        syncDraftInputsFromDom();
        var smpId = $('docSampleSel') ? $('docSampleSel').value : '';
        var pool = Docs().collectSamplePool(CUR_DOC_CODE, proj.id, D.projects, D.checks, D.intake);
        var picked = pool.find(function (s) { return s.id === smpId; }) || pool[0];
        if (!picked) { toast('불러올 샘플이 없습니다.'); return; }
        SELECTED_SAMPLE_ID = picked.id;
        var isCross = picked.group === 'project' || picked.group === 'intake';
        var customSrcCo = str($('smpSrcCo') && $('smpSrcCo').value);
        var srcCompanies = (picked.sourceCompanies || []).concat(customSrcCo ? [customSrcCo] : (picked.sourceCompany ? [picked.sourceCompany] : []));
        var adapted = Docs().adaptSampleText(picked.body, {
          sourceCompany: customSrcCo || picked.sourceCompany,
          sourceCompanies: srcCompanies,
          targetCompany: DOC_DRAFT_CACHE.companyName || proj.companyName,
          sourceCeo: picked.sourceCeo,
          sourceCeos: picked.sourceCeos,
          targetCeo: DOC_DRAFT_CACHE.ceoName,
          sourceBizNo: picked.sourceBizNo,
          sourceBizNos: picked.sourceBizNos,
          targetBizNo: DOC_DRAFT_CACHE.bizNo,
          sourceAddress: picked.sourceAddress,
          sourceAddresses: picked.sourceAddresses,
          targetAddress: DOC_DRAFT_CACHE.address,
          sourceConsultant: picked.sourceConsultant,
          sourceConsultants: picked.sourceConsultants,
          targetConsultant: DOC_DRAFT_CACHE.consultantName,
          sourceYear: ($('smpSrcYr') && $('smpSrcYr').value) || picked.sourceYear,
          targetYear: num(proj.year, 2026),
          replaceYear: !!($('smpReplYr') && $('smpReplYr').checked),
          customPairs: $('smpCustomPairs') ? $('smpCustomPairs').value : '',
          maskMissingTargetMeta: isCross
        });
        var maskedSample = isCross ? Intake().maskPiiStrict(adapted.text, []) : { text: adapted.text };
        var piiChanged = isCross && maskedSample.text !== adapted.text;
        DOC_DRAFT_CACHE.body = maskedSample.text;
        DOC_DRAFT_CACHE.title = (DOC_DRAFT_CACHE.companyName || proj.companyName) + '_' + DOC_DRAFT_CACHE.short + '(' + (proj.year || 2026) + ')';
        DOC_DRAFT_CACHE.sourceGuard = isCross ? {
          sourceCompanies: srcCompanies,
          sourceCeos: (picked.sourceCeos || []).concat(picked.sourceCeo ? [picked.sourceCeo] : []),
          targetCompany: DOC_DRAFT_CACHE.companyName || proj.companyName,
          targetCeo: DOC_DRAFT_CACHE.ceoName
        } : null;
        var residue = (isCross && typeof Docs().findCrossCompanyResidue === 'function')
          ? Docs().findCrossCompanyResidue(DOC_DRAFT_CACHE.title + '\n' + DOC_DRAFT_CACHE.body, DOC_DRAFT_CACHE.sourceGuard)
          : { found: [] };
        var noteParts = [];
        noteParts.push(adapted.totalReplacements > 0 ? ('자동 치환 ' + adapted.totalReplacements + '건 반영') : '샘플 본문 반영');
        if (residue.found.length > 0) noteParts.push('⚠️ 잔존 원본(' + residue.found.join(', ') + ') 직접 수정 필요');
        else if (isCross) noteParts.push('타 사업장 담당자·특이이력 검토 필요');
        if (piiChanged) noteParts.push('비식별 추가 정리됨');
        DOC_DRAFT_CACHE.diffNote = noteParts.join(' · ');
        drawDocsPane();
        toast(DOC_DRAFT_CACHE.diffNote);
        return;
      }

      if (t.id === 'docMaskPiiBtn' && DOC_DRAFT_CACHE) {
        syncDraftInputsFromDom();
        var beforeBody = String(DOC_DRAFT_CACHE.body || '');
        var mRes = Intake().maskPiiStrict(beforeBody, []);
        var changedMask = mRes.text !== beforeBody;
        DOC_DRAFT_CACHE.body = mRes.text;
        DOC_DRAFT_CACHE.diffNote = changedMask ? '개인정보·로컬경로 비식별 정리 완료' : '개인정보 잔존 패턴 없음';
        drawDocsPane();
        toast(DOC_DRAFT_CACHE.diffNote);
        return;
      }

      if ((t.id === 'docSaveDraftBtn' || t.id === 'docSaveDoneBtn' || t.id === 'docSaveNaBtn') && proj && CUR_DOC_CODE) {
        syncDraftInputsFromDom();
        var nextSt = t.id === 'docSaveDoneBtn' ? 'done' : (t.id === 'docSaveNaBtn' ? 'na' : (DOC_DRAFT_CACHE.status === 'review' ? 'review' : 'draft'));
        if (DOC_DRAFT_CACHE.sourceGuard) {
          DOC_DRAFT_CACHE.sourceGuard.targetCompany = DOC_DRAFT_CACHE.companyName || proj.companyName;
          DOC_DRAFT_CACHE.sourceGuard.targetCeo = DOC_DRAFT_CACHE.ceoName;
          if (DOC_DRAFT_CACHE.sourceGuard.unverifiedOrigin) {
            var okOrigin = typeof global.confirm === 'function' && global.confirm(
              '원본 상호를 비워 두고 불러온 PC 샘플입니다.\n본문 속 타 사업장 상호·담당자명이 모두 ' + (DOC_DRAFT_CACHE.companyName || proj.companyName) + ' 기준으로 정리되었습니까?'
            );
            if (!okOrigin) {
              toast('「원본 상호」 입력 후 재치환하거나 본문 확인 뒤 저장하세요.');
              return;
            }
            DOC_DRAFT_CACHE.sourceGuard = Object.assign({}, DOC_DRAFT_CACHE.sourceGuard, { unverifiedOrigin: false });
          }
        }
        try {
          await saveSafetyDoc(proj, CUR_DOC_CODE, {
            title: DOC_DRAFT_CACHE.title,
            body: DOC_DRAFT_CACHE.body,
            status: nextSt,
            applicable: nextSt === 'na' ? 'na' : 'yes',
            docDate: DOC_DRAFT_CACHE.docDate,
            companyName: DOC_DRAFT_CACHE.companyName,
            ceoName: DOC_DRAFT_CACHE.ceoName,
            bizNo: DOC_DRAFT_CACHE.bizNo,
            address: DOC_DRAFT_CACHE.address,
            workerCount: DOC_DRAFT_CACHE.workerCount,
            consultantName: DOC_DRAFT_CACHE.consultantName,
            sourceGuard: DOC_DRAFT_CACHE.sourceGuard
          });
          DOC_DRAFT_CACHE.status = nextSt;
          DOC_DRAFT_CACHE.sourceGuard = null;
          DOC_DRAFT_CACHE.diffNote = '';
          draw();
          toast(nextSt === 'done' ? '✅ 서류를 작성 완료로 저장했습니다.' : (nextSt === 'na' ? '해당없음으로 저장했습니다.' : '💾 초안을 저장했습니다.'));
        } catch (err) {
          toast('저장 실패: ' + ((err && err.message) || err));
        }
        return;
      }

      if (t.id === 'docPrevHwpxBtn' && proj && DOC_DRAFT_CACHE) {
        var dOut1 = syncDraftInputsFromDom();
        Hwpx().downloadSingleDocHwpx(dOut1, Object.assign({}, proj, { companyName: dOut1.companyName || proj.companyName, ceoName: dOut1.ceoName, workerCount: dOut1.workerCount, consultantName: dOut1.consultantName }));
        toast('한글(.hwpx) 문서를 내려받았습니다.');
        return;
      }
      if (t.id === 'docPrevHangulBtn' && proj && DOC_DRAFT_CACHE) {
        var dOut2 = syncDraftInputsFromDom();
        Hwpx().openSingleDocInHangul(dOut2, Object.assign({}, proj, { companyName: dOut2.companyName || proj.companyName, ceoName: dOut2.ceoName, workerCount: dOut2.workerCount, consultantName: dOut2.consultantName }));
        toast('푸른한글 편집기에서 서류를 엽니다.');
        return;
      }
      if (t.id === 'docPrevPrintBtn' && proj && DOC_DRAFT_CACHE) {
        var dOut3 = syncDraftInputsFromDom();
        Hwpx().openSingleDocPrintWindow(dOut3, Object.assign({}, proj, { companyName: dOut3.companyName || proj.companyName, ceoName: dOut3.ceoName, workerCount: dOut3.workerCount, consultantName: dOut3.consultantName }));
        return;
      }

      /* 체크리스트 상태 토글 */
      var chkBtn = t.closest('[data-set-chk]');
      if (chkBtn && proj) {
        var cp = chkBtn.getAttribute('data-set-chk').split(':');
        var bucket = cp[0], cid = cp[1], val = cp[2];
        await saveCheckDoc(proj, function (cd) {
          cd[bucket] = Object.assign({}, cd[bucket] || {});
          var prevRec = typeof cd[bucket][cid] === 'object' ? cd[bucket][cid] : {};
          cd[bucket][cid] = Object.assign({}, prevRec, { status: prevRec.status === val ? '' : val, autoFromDocs: false });
          return cd;
        });
        draw();
        return;
      }

      var noteBtn = t.closest('[data-chk-note]');
      if (noteBtn && proj) {
        var np = noteBtn.getAttribute('data-chk-note').split(':');
        var curNote = (checkDocOf(proj.id)[np[0]] && checkDocOf(proj.id)[np[0]][np[1]] && checkDocOf(proj.id)[np[0]][np[1]].note) || '';
        showModal('📝 점검 항목 비고 메모', '<div class="fr"><label for="chkNoteInput">메모 (개인정보 제외)</label><div class="fv"><input type="text" id="chkNoteInput" value="' + esc(curNote) + '"></div></div>',
          '<button data-close-modal="1">취소</button><button class="pri" id="saveChkNoteBtn">저장</button>');
        if ($('saveChkNoteBtn')) {
          $('saveChkNoteBtn').onclick = async function () {
            var safe = Intake().cleanCategoryLabel($('chkNoteInput').value, '', 140);
            try {
              await saveCheckDoc(proj, function (cd) {
                cd[np[0]] = Object.assign({}, cd[np[0]] || {});
                var pr = typeof cd[np[0]][np[1]] === 'object' ? cd[np[0]][np[1]] : {};
                cd[np[0]][np[1]] = Object.assign({}, pr, { note: safe });
                return cd;
              });
              closeModal();
              draw();
            } catch (err) {
              toast('메모 저장 실패: ' + ((err && err.message) || err));
            }
          };
        }
        return;
      }

      /* 복합업종 겸영 / 고위험 기인물 토글 */
      var exIndBtn = t.closest('[data-toggle-extra-ind]');
      if (exIndBtn && proj) {
        var ic = exIndBtn.getAttribute('data-toggle-extra-ind');
        var curEx = Array.isArray(proj.extraIndustries) ? proj.extraIndustries.slice() : [];
        var ix = curEx.indexOf(ic);
        if (ix >= 0) curEx.splice(ix, 1); else curEx.push(ic);
        await saveProjectRecord(Object.assign({}, proj, { extraIndustries: curEx }));
        draw();
        return;
      }

      var hzBtn = t.closest('[data-toggle-hazard]');
      if (hzBtn && proj) {
        var hc = hzBtn.getAttribute('data-toggle-hazard');
        var indDef = Cat().getIndustry(proj.industryCode).recommendedHazards || [];
        var curHz = Array.isArray(proj.selectedHazards) && proj.selectedHazards.length ? proj.selectedHazards.slice() : indDef.slice();
        var hi = curHz.indexOf(hc);
        if (hi >= 0) curHz.splice(hi, 1); else curHz.push(hc);
        await saveProjectRecord(Object.assign({}, proj, { selectedHazards: curHz }));
        draw();
        return;
      }

      var mailInspectBtn = t.closest('[data-mail-inspect]');
      if (mailInspectBtn && proj) { await inspectProjectMail(proj, mailInspectBtn.getAttribute('data-mail-inspect')); return; }

      var viewCardBtn = t.closest('[data-view-card]');
      if (viewCardBtn && proj) {
        var card = D.intake[proj.id] && D.intake[proj.id][viewCardBtn.getAttribute('data-view-card')];
        if (card) {
          showModal('📄 비식별 수집 자료 상세', '<div class="note">' + esc((card.summaryLines || []).join(' · ')) + '</div><div class="mail-body">' + esc(card.maskedExcerpt || '(내용 없음)') + '</div>',
            '<button class="pri" data-close-modal="1">닫기</button>');
        }
        return;
      }

      var riskTogBtn = t.closest('[data-risk-toggle]');
      if (riskTogBtn && proj) {
        var rid = riskTogBtn.getAttribute('data-risk-toggle');
        await saveCheckDoc(proj, function (cd) {
          cd.riskItems = (Array.isArray(cd.riskItems) ? cd.riskItems : []).map(function (r) {
            return r.id === rid ? Object.assign({}, r, { status: r.status === '개선완료' ? '진행중' : '개선완료' }) : r;
          });
          return cd;
        });
        draw();
        return;
      }

      var editRdBtn = t.closest('[data-edit-round]');
      if (editRdBtn && proj) { openEditRoundModal(proj, Number(editRdBtn.getAttribute('data-edit-round'))); return; }

      /* 보고서 / HWPX / 한글 / PDF / XLSX / ZIP 액션 */
      var actBtn = t.closest('[data-act]');
      if (actBtn && proj) {
        var act = actBtn.getAttribute('data-act');
        if (act === 'open-config-modal') openConfigModal(proj);
        else if (act === 'add-risk-modal') openAddRiskModal(proj);
        else if (act === 'add-round') openEditRoundModal(proj, Report().normalizeRounds(proj).rounds.length + 1);
        else if (act === 'regen-report') {
          try {
            var dom0 = readCurrentReportSectionsFromDom();
            var prevSaved = reportDocOf(proj.id) || {};
            var built = Report().buildComprehensiveReport(proj, checkDocOf(proj.id), D.intake[proj.id] || {}, { sections: dom0.sections, locks: dom0.locks });
            await saveReportDoc(proj, built.sections, built.locks || prevSaved.locks);
            drawReportPane();
            toast('최신 체크리스트·위험성평가를 반영해 종합보고서·1P 요약을 재조립했습니다.');
          } catch (err) {
            toast('보고서 재조립 실패: ' + ((err && err.message) || err));
          }
        } else if (act === 'save-all-report') {
          try {
            var dom1 = readCurrentReportSectionsFromDom();
            await saveReportDoc(proj, dom1.sections, dom1.locks);
            drawReportPane();
            toast('종합보고서 7장을 저장했습니다.');
          } catch (err) {
            toast('보고서 저장 실패: ' + ((err && err.message) || err));
          }
        } else if (act === 'save-snapshot') {
          try {
            var dom2 = readCurrentReportSectionsFromDom();
            await saveReportDoc(proj, dom2.sections, dom2.locks);
            await saveImmutableSnapshot(proj, {
              id: 'sfsnap_' + Date.now(),
              title: proj.companyName + ' 종합·1P 보고서 확정',
              sections: dom2.sections,
              confirmedBy: ME.sid,
              confirmedAt: Date.now()
            });
            drawReportPane();
            toast('확정 스냅샷을 저장했습니다.');
          } catch (err) {
            toast('스냅샷 저장 실패: ' + ((err && err.message) || err));
          }
        } else if (act === 'close-doc-studio') {
          if (!confirmSwitchSafetyDoc(proj, '')) return;
          CUR_DOC_CODE = ''; DOC_DRAFT_CACHE = null; SELECTED_SAMPLE_ID = ''; drawDocsPane();
        } else if (act === 'batch-draft-docs' && Docs()) {
          var reqTargets = Docs().DOC_TEMPLATES.filter(function (tpl) {
            var rec = projectDocOf(proj.id, tpl.code);
            if (rec && (rec.status === 'done' || rec.status === 'draft' || rec.status === 'review' || rec.status === 'na' || rec.applicable === 'na')) return false;
            var rq = Docs().evalDocRequirement(tpl, proj);
            return rq.level === 'urgent' || rq.level === 'required' || rq.level === 'industry_req';
          });
          if (!reqTargets.length) { toast('생성할 미작성 필수 서류가 없습니다.'); return; }
          if (typeof global.confirm === 'function' && !global.confirm(proj.companyName + ' 기준 미작성 필수·업종필수 서류 ' + reqTargets.length + '종의 맞춤 초안을 일괄 생성하시겠습니까?')) return;
          actBtn.disabled = true;
          try {
            for (var bt = 0; bt < reqTargets.length; bt++) {
              var genD = Docs().buildTemplateDraft(reqTargets[bt].code, proj, {});
              await saveSafetyDoc(proj, reqTargets[bt].code, {
                title: genD.title, body: genD.body,
                docDate: new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10),
                status: 'draft', applicable: 'yes'
              });
            }
            draw();
            toast('⚡ 필수·업종필수 서류 ' + reqTargets.length + '종의 맞춤 초안을 생성했습니다.');
          } catch (err) {
            toast('일괄 초안생성 실패: ' + ((err && err.message) || err));
          } finally {
            actBtn.disabled = false;
          }
        } else if (act === 'batch-zip-docs' && Docs()) {
          await ensureLibs({ zip: true });
          var dMapZ = projectDocsMap(proj.id);
          var listZ = Docs().DOC_TEMPLATES.map(function (tpl) {
            var rec = dMapZ[tpl.code];
            if (!rec || !str(rec.body) || rec.status === 'na' || rec.applicable === 'na') return null;
            return Object.assign({}, tpl, rec);
          }).filter(Boolean);
          if (!listZ.length) { toast('먼저 서류를 1건 이상 작성·생성한 뒤 내려받으세요.'); return; }
          await Hwpx().downloadDocsBundleZip(listZ, proj);
          toast('📦 작성 서류 ' + listZ.length + '종을 .zip으로 내려받았습니다.');
        }
        return;
      }

      var saveSecBtn = t.closest('[data-save-sec]');
      if (saveSecBtn && proj) {
        try {
          var domS = readCurrentReportSectionsFromDom();
          await saveReportDoc(proj, domS.sections, domS.locks);
          toast('해당 장을 저장했습니다.');
        } catch (err) {
          toast('저장 실패: ' + ((err && err.message) || err));
        }
        return;
      }

      var aiBtn = t.closest('[data-ai-polish]');
      if (aiBtn && proj) {
        var sKey = aiBtn.getAttribute('data-ai-polish');
        var ta = $('rptSec_' + sKey);
        if (!ta || !global.PuAiCall || typeof global.PuAiCall.ask !== 'function') {
          toast('AI 윤문 모듈을 불러오지 못했습니다.');
          return;
        }
        var piiAliases = [{ v: proj.companyName, as: '[사업장]' }];
        if (proj.ceoName) piiAliases.push({ v: proj.ceoName, as: '[대표자]' });
        if (proj.contactName) piiAliases.push({ v: proj.contactName, as: '[담당자]' });
        var maskedIn = Intake().maskPiiStrict(ta.value, piiAliases).text;
        if (Intake().hasResidualPii(maskedIn)) {
          toast('개인정보 잔존 패턴이 감지되어 AI 전송을 차단했습니다.');
          return;
        }
        aiBtn.disabled = true;
        toast('비식별 문장 AI 다듬기 중…');
        try {
          var promptTxt = '다음 안전보건체계구축 보고서 문단을 공단 컨설팅 결과보고서 문체로 간결하고 전문적으로 다듬어 주세요(개인정보·기업명 추정 금지):\n\n' + maskedIn;
          var reply = await global.PuAiCall.ask([{ text: promptTxt }], { auth: fb.auth(), app: 'safety' });
          var ans = global.PuAiCall.textOf(reply);
          if (ans && !Intake().hasResidualPii(ans)) { ta.value = ans; toast('AI 윤문 초안을 반영했습니다. 확인 후 저장하세요.'); }
        } catch (err) { toast('AI 윤문 실패: ' + (err.message || err)); }
        finally { aiBtn.disabled = false; }
        return;
      }

      var hwpxDlBtn = t.closest('[data-hwpx-dl]');
      if (hwpxDlBtn && proj) {
        var kind = hwpxDlBtn.getAttribute('data-hwpx-dl');
        var cdH = checkDocOf(proj.id);
        var repH = Report().buildComprehensiveReport(proj, cdH, D.intake[proj.id] || {}, reportDocOf(proj.id));
        var bytes = Hwpx().generateHwpxBytes(kind, proj, cdH, D.intake[proj.id] || {}, repH);
        Hwpx().downloadHwpxBytes(bytes, Hwpx().suggestedFileName(kind, proj));
        toast('한글(.hwpx) 문서를 내려받았습니다.');
        return;
      }

      var hglBtn = t.closest('[data-hangul-open]');
      if (hglBtn && proj) {
        var kind2 = hglBtn.getAttribute('data-hangul-open');
        var cd2 = checkDocOf(proj.id);
        var rep2 = Report().buildComprehensiveReport(proj, cd2, D.intake[proj.id] || {}, reportDocOf(proj.id));
        Hwpx().openInHangulEditor(kind2, proj, cd2, D.intake[proj.id] || {}, rep2);
        toast('푸른한글 편집기에서 보고서를 엽니다.');
        return;
      }

      var pdfBtn = t.closest('[data-pdf-print]');
      if (pdfBtn && proj) {
        var kind3 = pdfBtn.getAttribute('data-pdf-print');
        var cd3 = checkDocOf(proj.id);
        var rep3 = Report().buildComprehensiveReport(proj, cd3, D.intake[proj.id] || {}, reportDocOf(proj.id));
        Hwpx().openPrintWindow(kind3, proj, cd3, D.intake[proj.id] || {}, rep3);
        return;
      }

      var xlsxBtn = t.closest('[data-xlsx-dl]');
      if (xlsxBtn && proj) {
        await ensureLibs({ xlsx: true });
        var cdX = checkDocOf(proj.id);
        var repX = Report().buildComprehensiveReport(proj, cdX, D.intake[proj.id] || {}, reportDocOf(proj.id));
        Hwpx().downloadWorkbookXlsx(proj, cdX, D.intake[proj.id] || {}, repX);
        toast('통합점검표(.xlsx)를 내려받았습니다.');
        return;
      }

      var zipBtn = t.closest('[data-zip-dl]');
      if (zipBtn && proj) {
        await ensureLibs({ zip: true, xlsx: true });
        var cdZ = checkDocOf(proj.id);
        var repZ = Report().buildComprehensiveReport(proj, cdZ, D.intake[proj.id] || {}, reportDocOf(proj.id));
        await Hwpx().downloadBundleZip(proj, cdZ, D.intake[proj.id] || {}, repZ);
        toast('안전보건체계구축 전체 산출물(.zip)을 내려받았습니다.');
        return;
      }

      var qIndBtn = t.closest('[data-quick-ind-dl]');
      if (qIndBtn) {
        var ic2 = qIndBtn.getAttribute('data-quick-ind-dl');
        var stubProj = { companyName: '표준업종점검표', industryCode: ic2, track: Cat().getIndustry(ic2).defaultTrack, year: 2026 };
        var bQuick = Hwpx().generateHwpxBytes('checklist', stubProj, {}, {}, null);
        Hwpx().downloadHwpxBytes(bQuick, Hwpx().suggestedFileName('checklist', stubProj));
        return;
      }

      var stIndBtn = t.closest('[data-start-ind-proj]');
      if (stIndBtn) { openNewProjectModal(stIndBtn.getAttribute('data-start-ind-proj')); return; }

      if (t.id === 'pickFilesBtn' && $('fileUploadInput')) { $('fileUploadInput').value = ''; $('fileUploadInput').click(); return; }

      if (typeof global.innerWidth === 'number' && global.innerWidth <= 768 && !t.closest('input,button,select,a,label,textarea,td.c,th.c')) {
        var trRow = t.closest('tr[data-row][data-tname="projects"]');
        if (trRow) {
          CUR_PID = trRow.getAttribute('data-row');
          TAB = 'check';
          clearSel('projects');
          draw();
        }
      }
    });

    document.addEventListener('change', async function (e) {
      var t = e.target;
      if (!t) return;
      if (t.matches('input[data-all]')) {
        var nm = t.getAttribute('data-all');
        listCheckboxesInDom(nm).forEach(function (cb) {
          cb.checked = t.checked;
          SEL[cb.getAttribute('data-ck')] = t.checked;
        });
        syncHeaderCheckbox(nm);
        drawBulks();
      } else if (t.matches('input[data-ck]')) {
        var k = t.getAttribute('data-ck');
        SEL[k] = t.checked;
        syncHeaderCheckbox(k.split('|')[0]);
        drawBulks();
      } else if (t.matches('[data-proj-sel]')) {
        CUR_PID = t.value;
        draw();
      } else if (t.id === 'uploadDocKindSel') {
        UPLOAD_DOC_KIND = t.value;
      } else if (t.id === 'fileUploadInput' && t.files && t.files.length) {
        var proj = projectById(CUR_PID);
        if (!proj) return;
        for (var i = 0; i < t.files.length; i++) {
          if (t.files[i].size > 15 * 1024 * 1024) { toast('15MB를 초과한 파일은 건너뜁니다: ' + t.files[i].name); continue; }
          var bytes = new Uint8Array(await t.files[i].arrayBuffer());
          await analyzeAndStoreBytes(proj, t.files[i].name, bytes, UPLOAD_DOC_KIND);
        }
        draw();
        toast('로컬 파일 비식별 분석을 완료했습니다.');
      } else if (t.id === 'docStatusSel') {
        DOC_KPI_FILTER = t.value;
        drawDocsPane();
      } else if (t.id === 'docStateSel') {
        refreshDocPreviewDom(projectById(CUR_PID));
      } else if (t.id === 'docSampleSel' && CUR_DOC_CODE && Docs()) {
        SELECTED_SAMPLE_ID = t.value;
        var curP = projectById(CUR_PID);
        if (curP) {
          var poolSel = Docs().collectSamplePool(CUR_DOC_CODE, curP.id, D.projects, D.checks, D.intake);
          var pickedS = poolSel.find(function (s) { return s.id === t.value; });
          if (pickedS) {
            if ($('smpSrcCo')) $('smpSrcCo').value = pickedS.sourceCompany || '';
            if ($('smpSrcYr') && pickedS.sourceYear) $('smpSrcYr').value = String(pickedS.sourceYear);
          }
        }
      } else if (t.id === 'docSampleFileInp' && t.files && t.files[0]) {
        try {
          var fSmp = t.files[0];
          if (fSmp.size > 15 * 1024 * 1024) { toast('15MB를 초과한 파일은 읽을 수 없습니다.'); return; }
          var bytesSmp = new Uint8Array(await fSmp.arrayBuffer());
          var exSmp = await extractTextFromBytes(fSmp.name, bytesSmp);
          var txtSmp = typeof exSmp === 'string' ? exSmp : str(exSmp && exSmp.text);
          if (!str(txtSmp)) { toast('파일에서 본문을 추출하지 못했습니다(.hwp·.hwpx·.docx·.txt·텍스트형 .pdf 지원).'); return; }
          var curP2 = projectById(CUR_PID);
          if (curP2 && DOC_DRAFT_CACHE && Docs()) {
            syncDraftInputsFromDom();
            var srcCoGuess = ($('smpSrcCo') && $('smpSrcCo').value) || '';
            var srcYrGuess = ($('smpSrcYr') && $('smpSrcYr').value) || 2025;
            var adaptedFile = Docs().adaptSampleText(txtSmp, {
              sourceCompany: srcCoGuess,
              targetCompany: DOC_DRAFT_CACHE.companyName || curP2.companyName,
              targetCeo: DOC_DRAFT_CACHE.ceoName,
              targetBizNo: DOC_DRAFT_CACHE.bizNo,
              targetAddress: DOC_DRAFT_CACHE.address,
              targetConsultant: DOC_DRAFT_CACHE.consultantName,
              sourceYear: srcYrGuess,
              targetYear: num(curP2.year, 2026),
              replaceYear: !!($('smpReplYr') && $('smpReplYr').checked),
              customPairs: $('smpCustomPairs') ? $('smpCustomPairs').value : '',
              maskMissingTargetMeta: !!srcCoGuess
            });
            var maskedFile = Intake().maskPiiStrict(adaptedFile.text, []);
            var fileMaskChanged = maskedFile.text !== adaptedFile.text;
            DOC_DRAFT_CACHE.body = maskedFile.text;
            var detectedCos = srcCoGuess ? [srcCoGuess] : [];
            var mCos = txtSmp.match(/(?:주식회사|㈜|\(주\)|유한회사)\s*[가-힣A-Za-z0-9]{2,20}/g) || [];
            mCos.forEach(function (mc) {
              var cleanMc = str(mc);
              if (cleanMc && detectedCos.indexOf(cleanMc) < 0) detectedCos.push(cleanMc);
            });
            DOC_DRAFT_CACHE.sourceGuard = {
              sourceCompanies: detectedCos,
              sourceCeos: [],
              unverifiedOrigin: !srcCoGuess,
              targetCompany: DOC_DRAFT_CACHE.companyName || curP2.companyName,
              targetCeo: DOC_DRAFT_CACHE.ceoName
            };
            DOC_DRAFT_CACHE.diffNote = fSmp.name + ' 반영 (' + adaptedFile.totalReplacements + '건 자동 치환' +
              (fileMaskChanged ? ', 비식별 정리됨' : '') +
              (!srcCoGuess ? ' · ⚠️ 원본 상호 미입력 — 저장 전 확인 필요' : '') + ')';
            drawDocsPane();
            toast(!srcCoGuess ? '📎 PC 샘플 반영 완료(원본 상호 미입력 — 타 사업장명 확인 필요)' : '📎 PC 샘플을 불러와 반영했습니다.');
          }
        } catch (err) {
          toast('PC 샘플 불러오기 실패: ' + ((err && err.message) || err));
        }
      } else if (t.id === 'folderFallbackInput' && t.files && t.files.length) {
        FOLDER_STATE.rootName = '선택폴더';
        FOLDER_STATE.rawEntries = Array.prototype.slice.call(t.files).map(function (f) {
          return { relPath: f.webkitRelativePath || f.name, name: f.name, file: f };
        });
        refreshFolderGroups();
        draw();
        toast('폴더 파일 선별 완료: 안전보건 사업장 ' + FOLDER_STATE.groups.length + '곳');
      }
    });

    document.addEventListener('input', function (e) {
      var t = e.target;
      if (!t) return;
      if (t.id === 'docSearchQ') {
        DOC_SEARCH_Q = t.value || '';
        var pNow = projectById(CUR_PID);
        if (pNow && $('docsTableCard')) {
          $('docsTableCard').innerHTML = renderSafetyDocsTableHtml(pNow, projectDocsMap(pNow.id));
          if ($('docResetBtn')) $('docResetBtn').style.display = (DOC_CAT_SCOPE || DOC_KPI_FILTER || DOC_SEARCH_Q) ? '' : 'none';
          drawBulks();
        } else {
          drawDocsPane();
        }
        return;
      }
      if (t.id === 'docBodyTa' || t.id === 'docTitleInp' || t.id === 'docCoName' || t.id === 'docCeoName' || t.id === 'docBizNo' || t.id === 'docAddr' || t.id === 'docWorkers' || t.id === 'docDate' || t.id === 'docConsName') {
        refreshDocPreviewDom(projectById(CUR_PID));
      }
    });

    /* 표 행 · 카드 끌어고르기 (Shift 없이 왼쪽 체크열/행 드래그 다중 선택) */
    document.addEventListener('mousedown', function (e) {
      var cb = e.target && e.target.closest ? e.target.closest('input[data-ck]') : null;
      if (!cb) return;
      var k = cb.getAttribute('data-ck') || '';
      DRAG_SEL = { active: true, listName: k.split('|')[0], targetVal: !cb.checked, startKey: k, moved: false };
    });
    document.addEventListener('mousemove', function (e) {
      if (!DRAG_SEL.active || !DRAG_SEL.listName) return;
      var row = e.target && e.target.closest ? (e.target.closest('tr[data-tname="' + DRAG_SEL.listName + '"]') || e.target.closest('[data-sec-name="' + DRAG_SEL.listName + '"] .rpt-sec-card')) : null;
      if (!row) return;
      var cb = row.querySelector('input[data-ck]');
      if (!cb) return;
      var k = cb.getAttribute('data-ck');
      if (k === DRAG_SEL.startKey && !DRAG_SEL.moved) return;
      if (!DRAG_SEL.moved) {
        DRAG_SEL.moved = true;
        var sCb = document.querySelector('input[data-ck="' + DRAG_SEL.startKey.replace(/"/g, '\\"') + '"]');
        if (sCb) { sCb.checked = DRAG_SEL.targetVal; SEL[DRAG_SEL.startKey] = DRAG_SEL.targetVal; }
      }
      if (cb.checked !== DRAG_SEL.targetVal) {
        cb.checked = DRAG_SEL.targetVal;
        SEL[k] = DRAG_SEL.targetVal;
        syncHeaderCheckbox(DRAG_SEL.listName);
        drawBulks();
      }
    });
    document.addEventListener('mouseup', function () {
      DRAG_SEL.active = false;
    });

    /* 파일 드롭존 · 키보드 접근성(Escape 닫기 · 탭 화살표 · 드롭존 Enter) */
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && $('modal') && $('modal').style.display !== 'none') {
        closeModal();
        return;
      }
      if (e.target && e.target.closest && e.target.closest('#dropZone') && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        if ($('fileUploadInput')) { $('fileUploadInput').value = ''; $('fileUploadInput').click(); }
        return;
      }
      var kpiKeyEl = e.target && e.target.closest ? e.target.closest('[data-kpi-status], [data-kpi-kosha], [data-doc-kpi]') : null;
      if (kpiKeyEl && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        kpiKeyEl.click();
        return;
      }
      if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && e.target && e.target.matches && e.target.matches('.tabs button[role="tab"]')) {
        var tabBtns = Array.prototype.slice.call(document.querySelectorAll('.tabs button[role="tab"]'));
        var idx = tabBtns.indexOf(e.target);
        if (idx >= 0 && tabBtns.length) {
          var nextBtn = tabBtns[(idx + (e.key === 'ArrowRight' ? 1 : tabBtns.length - 1)) % tabBtns.length];
          if (nextBtn) { nextBtn.focus(); nextBtn.click(); }
        }
      }
    });
    document.addEventListener('dragover', function (e) { if (e.target && e.target.closest && e.target.closest('#dropZone')) e.preventDefault(); });
    document.addEventListener('drop', async function (e) {
      var dz = e.target && e.target.closest ? e.target.closest('#dropZone') : null;
      if (!dz) return;
      e.preventDefault();
      var proj = projectById(CUR_PID);
      if (!proj || !e.dataTransfer || !e.dataTransfer.files) return;
      for (var i = 0; i < e.dataTransfer.files.length; i++) {
        var f = e.dataTransfer.files[i];
        if (f.size > 15 * 1024 * 1024) { toast('15MB를 초과한 파일은 건너뜁니다: ' + f.name); continue; }
        var bytes = new Uint8Array(await f.arrayBuffer());
        await analyzeAndStoreBytes(proj, f.name, bytes, UPLOAD_DOC_KIND);
      }
      draw();
      toast('드롭 파일 비식별 분석 완료');
    });

    /* 상단 헤더 버튼 & 필터 */
    if ($('projQ')) $('projQ').oninput = function () { draw(); };
    if ($('projTrack')) $('projTrack').onchange = function () { TRACK_SCOPE = $('projTrack').value || ''; draw(); };
    if ($('projStatus')) $('projStatus').onchange = function () { draw(); };
    if ($('projIndustry')) $('projIndustry').onchange = function () { draw(); };
    if ($('projYear')) $('projYear').onchange = function () { draw(); };
    if ($('projResetBtn')) $('projResetBtn').onclick = function () {
      TRACK_SCOPE = '';
      ['projQ', 'projTrack', 'projStatus', 'projIndustry', 'projYear'].forEach(function (id) { if ($(id)) $(id).value = ''; });
      clearSel('projects');
      draw();
    };
    if ($('newProjBtn')) $('newProjBtn').onclick = function () { openNewProjectModal(''); };
    if ($('quickIndChecklistBtn')) $('quickIndChecklistBtn').onclick = function () {
      var ic = ($('projIndustry') && $('projIndustry').value) || 'mfg_general';
      var stub = { companyName: Cat().getIndustry(ic).short + '_사전체크', industryCode: ic, track: Cat().getIndustry(ic).defaultTrack, year: 2026 };
      Hwpx().openPrintWindow('checklist', stub, {}, {}, null);
    };
    if ($('linkFolderBtn')) $('linkFolderBtn').onclick = connectFolder;
    if ($('changeFolderBtn')) $('changeFolderBtn').onclick = connectFolder;
    if ($('reconnectFolderBtn')) $('reconnectFolderBtn').onclick = async function () {
      if (FOLDER_STATE.handle && typeof FOLDER_STATE.handle.requestPermission === 'function') {
        var r = await FOLDER_STATE.handle.requestPermission({ mode: 'read' });
        if (r === 'granted') await scanDirHandle(FOLDER_STATE.handle, false, SESSION_EPOCH, ME.uid);
      }
    };
    if ($('scanAllBtn')) $('scanAllBtn').onclick = function () { rebuildScanAndDiscover(); draw(); toast('메일함 안전보건컨설팅 감지를 재실행했습니다.'); };
    if ($('reloadBtn')) $('reloadBtn').onclick = function () { reload(SESSION_EPOCH, ME.uid); };
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
        await clearDirHandles();
        purgeSessionState();
        if ($('lock')) $('lock').style.display = 'none';
        if (global.PuGate) global.PuGate.show();
        return;
      }
      if (ME && ME.uid && ME.uid !== authUid) {
        await clearDirHandles();
        purgeSessionState();
      }
      var authEpoch = ++SESSION_EPOCH;
      if (global.PuGate) global.PuGate.hide();

      var snapPromise = (global.PuFastBoot && typeof global.PuFastBoot.readSnap === 'function')
        ? global.PuFastBoot.readSnap('safety', authUid).catch(function () { return null; })
        : Promise.resolve(null);
      var roleVal = {};
      try { roleVal = (await fbDb.ref('uid_roles/' + authUid).once('value')).val() || {}; } catch (e) {}
      if (authEpoch !== SESSION_EPOCH || currentAuthUid() !== authUid) return;
      if (roleVal.status !== 'active' || !roleVal.sid) {
        await clearDirHandles();
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
      gate = wrapSnapGuard(global.PuOntologyWrite.createGateway({ mode: 'enforce', actor: ME.sid }));
      if ($('lock')) $('lock').style.display = 'none';
      if ($('app')) $('app').style.display = '';

      var cachedSnap = await snapPromise;
      if (!isSessionCurrent(authEpoch, authUid)) return;
      if (cachedSnap && applyFastSnapshot(cachedSnap)) {
        rebuildScanAndDiscover();
        applyHashTarget();
        draw();
      } else if ($('projectsBox')) {
        $('projectsBox').innerHTML = '<div class="empty">과거 수행이력 및 신규 안전보건 사업장을 불러오고 있습니다…</div>';
      }

      await reload(authEpoch, authUid);
    });
  }

  global.PuSafetyView = {
    boot: boot,
    reload: reload
  };
})(typeof window !== 'undefined' ? window : globalThis);
