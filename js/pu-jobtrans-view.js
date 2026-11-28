/* 푸른통합시스템 — 산업·일자리전환 컨설팅(한국능률협회컨설팅 KMAC · 충남경제진흥원 CEPA) 자동화 화면 컨트롤러
 * (jobtrans.html 전용 window.PuJobtransView)
 *
 * 맡는 일:
 *   1. 로그인 권한 검증(uid_roles active + sid), 세션 격리(SESSION_EPOCH), PuOntologyWrite 강제 관문(enforce) 연결
 *   2. 푸른이알피(data/companies·data/consultings·data/biz_cons_types) 및 정부사업일정(scal_cos·scal_types·scal_scheds)에서
 *      산업·일자리전환(능률협회 구조혁신 / 충남경제진흥원 산업일자리전환) 계약 확정 사업장 자동 발견·기관/트랙 추론·활성화
 *   3. 푸른메일함 거울(mailbox/folders·mailbox/msgs) 스캔 + Cloud Functions(readMailMessage/readMailAttachment peek:true)
 *      실시간 내용확인·첨부 파싱 + 로컬 파일(XLSX/CSV/HWPX/HWP/DOCX/PDF/TXT) 브라우저 내 비식별 정량·본문 분석
 *   4. 모든 표·체크리스트·회차·Diff·보고서 섹션·산출물·사후관리 목록 맨 왼쪽 ☐ 고르기 칸 + 번호(1,2...) + 끌어고르기 + 일괄실행 지원
 *   5. 운영기관별(KMAC 구조혁신 vs 충남경제진흥원 진단/석탄화력/미래차) 완전히 분리된 중간보고서·최종결과보고서·완료계 자동 작성 및 편집
 *   6. 네이티브 한글(.hwpx) 다운로드 · 푸른한글(hangul.html) 새 탭 바로 열기 · 웹 A4 미리보기 / PDF 인쇄 · 별첨 XLSX · 통합 ZIP 제공
 */
(function (global) {
  'use strict';

  var Cat = function () { return global.PuJobtransCatalog; };
  var Intake = function () { return global.PuJobtransIntake; };
  var Report = function () { return global.PuJobtransReport; };
  var Hwpx = function () { return global.PuJobtransHwpx; };

  var MAIL_FN_BASE = 'https://asia-northeast3-pureun-erp.cloudfunctions.net/';
  var JOBTRANS_BIZ_RE = /산업\s*일자리|일자리\s*전환|노동\s*전환|구조\s*혁신|능률\s*협회|kmac|충남\s*경제\s*진흥원|충경진|석탄\s*화력|정의로운\s*전환/i;

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
    flatMails: [],
    oldMails: []
  };

  var SCAN_CACHE = {};
  /* 최종보고서 «메일 근거» — { 사업장 id: Intake().findFinalReportEvidence 결과 } · 화면 계산만, 저장하지 않는다 */
  var FINAL_EV = {};
  var DISCOVER_LIST = [];
  var FOLDER_STATE = {
    rootName: '',
    rawRootName: '',
    handle: null,
    needsPerm: false,
    rawEntries: [],
    groups: [],
    formFileCount: 0,
    totalAcceptedFiles: 0,
    walkedSkippedDirs: 0,
    skippedNonJobtrans: 0,
    skippedPersonal: 0
  };
  var TAB = 'projects';
  var AGENCY_SCOPE = '';
  var YEAR_FILTER = '';
  var CUR_PID = '';
  var SEL = {};
  var DRAG_SEL = { active: false, listName: '', targetVal: false, startKey: '', moved: false };
  var UPLOAD_DOC_KIND = '';
  var POST_UPLOAD_DOC_KIND = '';
  var MAIL_VIEW_CACHE = Object.create(null);

  function setSyncStateText(txt) {
    var el = $('syncStateChip');
    if (!el) return;
    if (!txt) { el.style.display = 'none'; el.textContent = ''; }
    else { el.textContent = txt; el.style.display = ''; }
  }

  function isUiBusyForBgRedraw() {
    var m = $('modal');
    if (m && m.style && m.style.display && m.style.display !== 'none') return true;
    var ae = typeof document !== 'undefined' ? document.activeElement : null;
    if (!ae || !ae.tagName) return false;
    var tag = String(ae.tagName).toUpperCase();
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  }

  async function ensureJobtransLibs(opts) {
    var o = opts || {};
    var fbBoot = global.PuFastBoot;
    if (!fbBoot) return;
    if (o.zip && !global.JSZip && typeof fbBoot.ensureJsZip === 'function') await fbBoot.ensureJsZip();
    if (o.xlsx && !global.XLSX && typeof fbBoot.ensureXlsx === 'function') await fbBoot.ensureXlsx();
    if (o.pdf && !global.pdfjsLib && typeof fbBoot.ensurePdfJs === 'function') await fbBoot.ensurePdfJs();
    if (o.hwp && !global.PureunHwp && typeof fbBoot.ensureHwpLibs === 'function') await fbBoot.ensureHwpLibs();
  }

  function $(id) { return document.getElementById(id); }
  function str(v) { return v == null ? '' : String(v).trim(); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }
  function safeKey(v) {
    var raw = str(v);
    if (!raw) return 'id_' + Date.now();
    if (!/[.#$/\[\]\s]/.test(raw) && raw.length <= 120) return raw;
    var cleaned = raw.replace(/[.#$/\[\]\s]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
    var dig = (Intake() && typeof Intake().sha256Hex === 'function') ? Intake().sha256Hex(raw) : Date.now().toString(36);
    return (cleaned ? cleaned + '_' : 'id_') + dig;
  }
  function hashKey(prefix, raw) {
    var s = str(raw);
    if (Intake() && typeof Intake().sha256Hex === 'function') {
      return (prefix || 'id_') + Intake().sha256Hex(s);
    }
    return (prefix || 'id_') + safeKey(s);
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

  var SNAP_ONLY = false;

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

  function purgeSessionState() {
    gate = null;
    SNAP_ONLY = false;
    ME = { uid: '', sid: '', name: '', email: '', isAdmin: false, isSubAdmin: false };
    TAB = 'projects';
    AGENCY_SCOPE = '';
    YEAR_FILTER = '';
    CUR_PID = '';
    SEL = {};
    DRAG_SEL = { active: false, listName: '', targetVal: false, startKey: '', moved: false };
    SCAN_CACHE = {};
    FINAL_EV = {};
    DISCOVER_LIST = [];
    MAIL_VIEW_CACHE = Object.create(null);
    setSyncStateText('');
    if (global.PuFastBoot && typeof global.PuFastBoot.clearAll === 'function') {
      try { global.PuFastBoot.clearAll(); } catch (e) {}
    }
    FOLDER_STATE = {
      rootName: '', rawRootName: '', handle: null, needsPerm: false, rawEntries: [], groups: [],
      formFileCount: 0, totalAcceptedFiles: 0, walkedSkippedDirs: 0, skippedNonJobtrans: 0, skippedPersonal: 0
    };
    D = {
      projects: {}, intake: {}, mid: {}, final: {}, snapshots: {},
      companies: [], consultings: [], bizTypes: [],
      scalCos: {}, scalTypes: {}, scalScheds: {}, scalDocs: {},
      mailFolders: {}, mailMsgs: {}, flatMails: [], oldMails: []
    };
    closeModal();
    ['agencyScopeBar', 'kpiBox', 'projectsBox', 'folderSyncBox', 'discoverBox', 'intakeBox', 'midBox', 'finalBox', 'formsBox'].forEach(function (id) {
      var el = $(id);
      if (el) el.innerHTML = '';
    });
    if ($('folderSyncMeta')) $('folderSyncMeta').textContent = '';
    if ($('nFolderGroups')) $('nFolderGroups').textContent = '0';
    if ($('folderSyncCard')) $('folderSyncCard').style.display = 'none';
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

  function buildJobtransFastSnapshot() {
    var slimProjects = {};
    Object.keys(D.projects || {}).forEach(function (pid) {
      var p = D.projects[pid];
      if (!p || typeof p !== 'object') return;
      slimProjects[pid] = {
        id: str(p.id || pid),
        companyId: str(p.companyId),
        scalCoId: str(p.scalCoId),
        companyName: str(p.companyName),
        bizNo: str(p.bizNo),
        year: Number(p.year) || 0,
        agency: str(p.agency),
        track: str(p.track),
        programName: str(p.programName),
        selectedTasks: Array.isArray(p.selectedTasks) ? p.selectedTasks.slice(0, 12).map(str) : [],
        industry: str(p.industry),
        transGoal: str(p.transGoal),
        consultantSid: str(p.consultantSid),
        consultantName: str(p.consultantName),
        midConfirmedAt: Number(p.midConfirmedAt) || 0,
        finalConfirmedAt: Number(p.finalConfirmedAt) || 0,
        finalMail: p.finalMail && typeof p.finalMail === 'object' ? { date: str(p.finalMail.date), kind: str(p.finalMail.kind), label: str(p.finalMail.label) } : null,
        status: str(p.status),
        revision: Number(p.revision) || 0,
        createdAt: Number(p.createdAt) || 0,
        updatedAt: Number(p.updatedAt) || 0,
        _deleted: !!p._deleted
      };
    });
    var slimIntake = {};
    Object.keys(D.intake || {}).forEach(function (pid) {
      var bucket = D.intake[pid];
      if (!bucket || typeof bucket !== 'object') return;
      var sub = {};
      Object.keys(bucket).forEach(function (cid) {
        var c = bucket[cid];
        if (c && typeof c === 'object') sub[cid] = { id: str(c.id || cid), revision: Number(c.revision) || 0, _deleted: !!c._deleted };
      });
      slimIntake[pid] = sub;
    });
    var slimMid = {}, slimFinal = {};
    Object.keys(D.mid || {}).forEach(function (pid) {
      var m = D.mid[pid];
      if (m && typeof m === 'object') slimMid[pid] = { _deleted: !!m._deleted, revision: Number(m.revision) || 0, sections: null, _hasSections: !!m.sections };
    });
    Object.keys(D.final || {}).forEach(function (pid) {
      var f = D.final[pid];
      if (f && typeof f === 'object') slimFinal[pid] = { _deleted: !!f._deleted, revision: Number(f.revision) || 0, sections: null, _hasSections: !!f.sections };
    });
    var slimConsultings = D.consultings.slice(0, 1200).map(function (ct) {
      return {
        id: str(ct.id), companyId: str(ct.companyId), companyName: str(ct.companyName), bizNo: str(ct.bizNo),
        no: str(ct.no), contractNo: str(ct.contractNo), typeCode: str(ct.typeCode), bizTypeId: str(ct.bizTypeId),
        bizName: str(ct.bizName), bizCaseType: str(ct.bizCaseType), type: str(ct.type), bizType: str(ct.bizType),
        status: str(ct.status), year: ct.year || '', startDate: str(ct.startDate), endDate: str(ct.endDate),
        managerMain: str(ct.managerMain), _deleted: !!ct._deleted
      };
    });
    var slimScalCos = {};
    Object.keys(D.scalCos || {}).forEach(function (k) {
      var sc = D.scalCos[k];
      if (sc && typeof sc === 'object') {
        slimScalCos[k] = {
          id: str(sc.id || k), name: str(sc.name), bizNo: str(sc.bizNo), year: sc.year || '',
          typeId: str(sc.typeId), types: Array.isArray(sc.types) ? sc.types.slice(0, 10) : [], _deleted: !!sc._deleted
        };
      }
    });
    return {
      projects: slimProjects,
      intake: slimIntake,
      mid: slimMid,
      final: slimFinal,
      snapshots: {},
      companies: D.companies.slice(0, 2500).map(function (c) {
        return { id: str(c.id), name: str(c.name), bizNo: str(c.bizNo), managerMain: str(c.managerMain) };
      }),
      consultings: slimConsultings,
      bizTypes: D.bizTypes,
      scalCos: slimScalCos,
      scalTypes: D.scalTypes,
      scalScheds: {},
      flatMails: []
    };
  }

  function applyJobtransFastSnapshot(snap) {
    if (!snap || typeof snap !== 'object') return false;
    SNAP_ONLY = true;
    D.projects = snap.projects || {};
    D.intake = snap.intake || {};
    D.mid = snap.mid || {};
    D.final = snap.final || {};
    D.snapshots = snap.snapshots || {};
    D.companies = Array.isArray(snap.companies) ? snap.companies : [];
    D.consultings = Array.isArray(snap.consultings) ? snap.consultings : [];
    D.bizTypes = Array.isArray(snap.bizTypes) ? snap.bizTypes : [];
    D.scalCos = snap.scalCos || {};
    D.scalTypes = snap.scalTypes || {};
    D.scalScheds = snap.scalScheds || {};
    D.flatMails = Array.isArray(snap.flatMails) ? snap.flatMails : [];
    return true;
  }

  /* 2단계 점진적 즉시 적재: 사업장·계약·일정 원장(~0.2초) 선표시 → 대용량 메일함 백그라운드 동기화 */
  async function reload(optEpoch, optUid) {
    var reqEpoch = optEpoch || SESSION_EPOCH;
    var reqUid = optUid || (ME && ME.uid ? String(ME.uid) : '');
    if (!isSessionCurrent(reqEpoch, reqUid)) return;

    setSyncStateText('⟳ 메일·자료 동기화 중…');

    var pCore = Promise.all([
      safeVal('scal_jobtrans'),
      safeVal('data/companies'),
      safeVal('data/consultings'),
      safeVal('data/biz_cons_types'),
      safeVal('scal_cos'),
      safeVal('scal_types'),
      safeVal('scal_scheds')
    ]);
    var pMail = Promise.all([
      safeVal('scal_docs'),
      safeVal('mailbox/folders'),
      safeVal('mailbox/msgs'),
      /* POP3 지난 메일(받은 메일·머리글만) — 2024·2025년 최종보고서 승인·회신 메일을 찾는 데 쓴다(일터혁신·컨설팅 화면과 같은 자리) */
      safeVal('mailbox/old/msgs')
    ]);
    var pFolder = tryRestoreSavedFolderHandle(reqEpoch, reqUid).catch(function () {});
    var allDone = false;

    pCore.then(function (cRes) {
      if (allDone || !isSessionCurrent(reqEpoch, reqUid)) return;
      SNAP_ONLY = false;
      var jtRoot0 = cRes[0] && typeof cRes[0] === 'object' ? cRes[0] : {};
      D.projects = jtRoot0.projects || {};
      D.intake = jtRoot0.intake || {};
      D.mid = jtRoot0.mid || {};
      D.final = jtRoot0.final || {};
      D.snapshots = jtRoot0.snapshots || {};
      D.companies = rowsOf(cRes[1]);
      D.consultings = rowsOf(cRes[2]);
      D.bizTypes = rowsOf(cRes[3]);
      D.scalCos = cRes[4] || {};
      D.scalTypes = cRes[5] || {};
      D.scalScheds = cRes[6] || {};
      rebuildScanAndDiscover();
      applyHashTarget();
      if (!isUiBusyForBgRedraw()) draw();
    });

    var both = await Promise.all([pCore, pMail, pFolder]);
    allDone = true;
    SNAP_ONLY = false;
    if (!isSessionCurrent(reqEpoch, reqUid)) return;

    var cResFinal = both[0];
    var mResFinal = both[1];
    var jtRoot = cResFinal[0] && typeof cResFinal[0] === 'object' ? cResFinal[0] : {};
    D.projects = jtRoot.projects || {};
    D.intake = jtRoot.intake || {};
    D.mid = jtRoot.mid || {};
    D.final = jtRoot.final || {};
    D.snapshots = jtRoot.snapshots || {};
    D.companies = rowsOf(cResFinal[1]);
    D.consultings = rowsOf(cResFinal[2]);
    D.bizTypes = rowsOf(cResFinal[3]);
    D.scalCos = cResFinal[4] || {};
    D.scalTypes = cResFinal[5] || {};
    D.scalScheds = cResFinal[6] || {};
    D.scalDocs = mResFinal[0] || {};
    D.mailFolders = mResFinal[1] || {};
    D.mailMsgs = mResFinal[2] || {};
    D.flatMails = Intake().flattenMailboxRows(D.mailFolders, D.mailMsgs);
    D.oldMails = Intake().flattenOldMailRows(mResFinal[3] || {});
    setSyncStateText('');

    rebuildScanAndDiscover();
    applyHashTarget();
    if (!isUiBusyForBgRedraw()) draw();

    if (global.PuFastBoot && typeof global.PuFastBoot.writeSnap === 'function') {
      try { global.PuFastBoot.writeSnap('jobtrans', reqUid, buildJobtransFastSnapshot()); } catch (e) {}
    }
  }

  function activeProjects() {
    return Object.keys(D.projects || {}).map(function (k) { return D.projects[k]; })
      .filter(function (p) { return p && typeof p === 'object' && !p._deleted && p.id; })
      .sort(function (a, b) { return (Number(b.updatedAt || 0) - Number(a.updatedAt || 0)); });
  }

  function projectById(pid) {
    var p = D.projects && D.projects[pid];
    return (p && !p._deleted) ? p : null;
  }

  function schedRoundsForProject(proj) {
    if (!proj) return [];
    var all = rowsOf(D.scalScheds);
    var typeMap = {};
    rowsOf(D.scalTypes).forEach(function (t) {
      if (t && t.id) typeMap[str(t.id)] = str(t.name || t.title);
    });
    var hits = all.filter(function (s) {
      if (!s || s._deleted || s.deleted || s.phase === 'pre' || s.phase === 'post') return false;
      var sCo = str(s.coId || s.co_id);
      var sTid = str(s.typeId || s.type);
      var sameCo = (proj.scalCoId && sCo === str(proj.scalCoId)) || (proj.companyId && sCo === str(proj.companyId));
      if (!sameCo) return false;
      if (proj.scalTypeId && sTid && sTid !== str(proj.scalTypeId)) return false;
      if (sTid && typeMap[sTid] && !JOBTRANS_BIZ_RE.test(typeMap[sTid])) return false;
      return /^\d{4}-\d{2}-\d{2}$/.test(str(s.date));
    }).sort(function (a, b) { return str(a.date) < str(b.date) ? -1 : 1; });

    var tr = Cat().getTrack(proj.track, proj.agency);
    return hits.map(function (s, idx) {
      return {
        roundNo: idx + 1,
        date: str(s.date),
        mode: s.isField === false ? 'remote' : 'face',
        mins: tr.minRoundMins || 120,
        companyPeople: Math.max(tr.minPeople || 2, 2),
        topic: str(s.memo)
      };
    });
  }

  function manualChecksOf(proj, phase) {
    if (!proj || !proj.manualChecks || typeof proj.manualChecks !== 'object') return {};
    var sub = proj.manualChecks[phase];
    return (sub && typeof sub === 'object') ? sub : {};
  }

  function rebuildScanAndDiscover() {
    SCAN_CACHE = {};
    var projs = activeProjects();
    projs.forEach(function (p) {
      SCAN_CACHE[p.id] = Intake().scanProjectMails(
        p, D.flatMails, null, D.companies, D.consultings, D.intake[p.id] || {}
      );
    });

    FINAL_EV = Intake().findFinalReportEvidence(projs, D.flatMails.concat(D.oldMails || []), D.companies, D.consultings);

    if (!CUR_PID && projs.length) CUR_PID = projs[0].id;
    if (CUR_PID && !projectById(CUR_PID)) CUR_PID = projs[0] ? projs[0].id : '';

    DISCOVER_LIST = Intake().discoverJobtransCandidates({
      companies: D.companies,
      consultings: D.consultings,
      bizTypes: D.bizTypes,
      scalCos: D.scalCos,
      scalTypes: D.scalTypes,
      scalScheds: D.scalScheds,
      registeredProjects: projs
    });

    refreshFolderGroups();
  }

  /* ── 로컬 컨설팅업체 폴더(산업·일자리전환 전용 하위폴더 선별) 연결 · IndexedDB UID 격리 핸들 보관 · 일괄 반영 ── */
  var IDB_FS_NAME = 'pu_jobtrans_fs';
  var IDB_FS_STORE = 'handles';
  var IDB_FS_KEY_PREFIX = 'consulting_dir:';

  function openFsIdb() {
    return new Promise(function (resolve) {
      if (typeof indexedDB === 'undefined') { resolve(null); return; }
      try {
        var req = indexedDB.open(IDB_FS_NAME, 1);
        req.onupgradeneeded = function () {
          var db = req.result;
          if (!db.objectStoreNames.contains(IDB_FS_STORE)) db.createObjectStore(IDB_FS_STORE);
        };
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { resolve(null); };
      } catch (e) { resolve(null); }
    });
  }

  async function saveDirHandleToIdb(handle, uid) {
    var u = str(uid);
    if (!u || !handle) return;
    var db = await openFsIdb();
    if (!db) return;
    return new Promise(function (resolve) {
      try {
        var tx = db.transaction(IDB_FS_STORE, 'readwrite');
        tx.objectStore(IDB_FS_STORE).put(handle, IDB_FS_KEY_PREFIX + u);
        tx.oncomplete = function () { db.close(); resolve(); };
        tx.onerror = function () { db.close(); resolve(); };
      } catch (e) { try { db.close(); } catch (err) {} resolve(); }
    });
  }

  async function loadDirHandleFromIdb(uid) {
    var u = str(uid);
    if (!u) return null;
    var db = await openFsIdb();
    if (!db) return null;
    return new Promise(function (resolve) {
      try {
        var tx = db.transaction(IDB_FS_STORE, 'readonly');
        var g = tx.objectStore(IDB_FS_STORE).get(IDB_FS_KEY_PREFIX + u);
        g.onsuccess = function () { var res = g.result || null; db.close(); resolve(res); };
        g.onerror = function () { db.close(); resolve(null); };
      } catch (e) { try { db.close(); } catch (err) {} resolve(null); }
    });
  }

  async function clearDirHandlesFromIdb() {
    var db = await openFsIdb();
    if (!db) return;
    return new Promise(function (resolve) {
      try {
        var tx = db.transaction(IDB_FS_STORE, 'readwrite');
        tx.objectStore(IDB_FS_STORE).clear();
        tx.oncomplete = function () { db.close(); resolve(); };
        tx.onerror = function () { db.close(); resolve(); };
      } catch (e) { try { db.close(); } catch (err) {} resolve(); }
    });
  }

  function safeFolderDisplayLabel(rawLabel, fallback) {
    var fbTxt = str(fallback) || '선택폴더';
    var raw = str(rawLabel);
    if (!raw || !Intake()) return fbTxt;
    var masked = Intake().maskPiiStrict(raw, []).text.split(Intake().GARIM).join('')
      .replace(/[\s_\-]{2,}/g, ' ')
      .replace(/^[\s_\-,·]+|[\s_\-,·]+$/g, '')
      .trim();
    if (!masked || Intake().hasResidualPii(masked)) return fbTxt;
    return masked;
  }

  function refreshFolderGroups() {
    if (!FOLDER_STATE.rawEntries || !FOLDER_STATE.rawEntries.length) {
      FOLDER_STATE.groups = [];
      FOLDER_STATE.formFileCount = 0;
      FOLDER_STATE.totalAcceptedFiles = 0;
      FOLDER_STATE.skippedNonJobtrans = FOLDER_STATE.walkedSkippedDirs || 0;
      FOLDER_STATE.skippedPersonal = 0;
      return;
    }
    var grouped = Intake().groupJobtransFolderEntries(FOLDER_STATE.rawEntries, {
      rootDirName: FOLDER_STATE.rawRootName || FOLDER_STATE.rootName,
      companies: D.companies,
      projects: activeProjects(),
      discoverCandidates: DISCOVER_LIST
    });
    FOLDER_STATE.groups = grouped.groups;
    FOLDER_STATE.formFileCount = grouped.formFileCount;
    FOLDER_STATE.totalAcceptedFiles = grouped.totalAcceptedFiles;
    FOLDER_STATE.skippedNonJobtrans = grouped.skippedNonJobtrans + (FOLDER_STATE.walkedSkippedDirs || 0);
    FOLDER_STATE.skippedPersonal = grouped.skippedPersonal;
  }

  async function walkJobtransDirectoryHandle(rootHandle) {
    var rawEntries = [];
    var skippedDirs = 0;
    var startStep = Intake().inspectConsultingSubdir(rootHandle.name, false);
    var startInside = !!startStep.nextInside;

    async function walk(dirHandle, relPrefix, insideJobtrans) {
      if (!dirHandle || typeof dirHandle.values !== 'function') return;
      for await (var entry of dirHandle.values()) {
        if (!entry) continue;
        var nextPath = relPrefix ? (relPrefix + '/' + entry.name) : entry.name;
        if (entry.kind === 'directory') {
          var step = Intake().inspectConsultingSubdir(entry.name, insideJobtrans);
          if (!step.enter) {
            skippedDirs++;
            continue;
          }
          await walk(entry, nextPath, step.nextInside);
        } else if (entry.kind === 'file') {
          if (!insideJobtrans) {
            skippedDirs++;
            continue;
          }
          rawEntries.push({
            relPath: rootHandle.name + '/' + nextPath,
            name: entry.name,
            handle: entry
          });
        }
      }
    }

    await walk(rootHandle, '', startInside);
    return { rawEntries: rawEntries, skippedDirs: skippedDirs };
  }

  async function scanConnectedHandle(handle, silent, optEpoch, optUid) {
    var reqEpoch = optEpoch || SESSION_EPOCH;
    var reqUid = optUid || (ME && ME.uid ? String(ME.uid) : '');
    if (!handle || !isSessionCurrent(reqEpoch, reqUid)) return;
    var walked = await walkJobtransDirectoryHandle(handle);
    if (!isSessionCurrent(reqEpoch, reqUid)) return;
    FOLDER_STATE.handle = handle;
    FOLDER_STATE.rawRootName = str(handle.name);
    FOLDER_STATE.rootName = safeFolderDisplayLabel(handle.name, '선택폴더');
    FOLDER_STATE.needsPerm = false;
    FOLDER_STATE.rawEntries = walked.rawEntries;
    FOLDER_STATE.walkedSkippedDirs = walked.skippedDirs || 0;
    refreshFolderGroups();
    clearSel('folderSync');
    draw();
    if (!silent) {
      if (!FOLDER_STATE.groups.length && !FOLDER_STATE.formFileCount) {
        toast('선택한 폴더 안에 산업·일자리전환 하위 폴더(예: 4. 산업일자리전환컨설팅)가 없습니다. 타 컨설팅 폴더는 가져오지 않습니다.');
      } else {
        toast('컨설팅폴더 연결 완료: 산업일자리 사업장 ' + FOLDER_STATE.groups.length + '곳 (' + FOLDER_STATE.totalAcceptedFiles + '개 파일 선별 · 타 컨설팅 자동 제외)');
      }
    }
  }

  async function tryRestoreSavedFolderHandle(reqEpoch, reqUid) {
    if (!isSessionCurrent(reqEpoch, reqUid)) return;
    if (FOLDER_STATE.rawEntries.length || FOLDER_STATE.handle) return;
    var saved = await loadDirHandleFromIdb(reqUid);
    if (!saved || !isSessionCurrent(reqEpoch, reqUid)) return;
    try {
      var perm = typeof saved.queryPermission === 'function' ? await saved.queryPermission({ mode: 'read' }) : 'prompt';
      if (!isSessionCurrent(reqEpoch, reqUid)) return;
      if (perm === 'granted') {
        await scanConnectedHandle(saved, true, reqEpoch, reqUid);
      } else {
        FOLDER_STATE.handle = saved;
        FOLDER_STATE.rawRootName = str(saved.name);
        FOLDER_STATE.rootName = safeFolderDisplayLabel(saved.name, '선택폴더');
        FOLDER_STATE.needsPerm = true;
        draw();
      }
    } catch (e) {}
  }

  async function connectConsultingFolder() {
    var reqEpoch = SESSION_EPOCH;
    var reqUid = ME && ME.uid ? String(ME.uid) : '';
    if (!isSessionCurrent(reqEpoch, reqUid)) return;
    if (typeof global.showDirectoryPicker === 'function') {
      try {
        var dirHandle = await global.showDirectoryPicker({ mode: 'read' });
        if (!isSessionCurrent(reqEpoch, reqUid)) return;
        await saveDirHandleToIdb(dirHandle, reqUid);
        if (!isSessionCurrent(reqEpoch, reqUid)) return;
        await scanConnectedHandle(dirHandle, false, reqEpoch, reqUid);
      } catch (e) {
        if (e && e.name === 'AbortError') return;
        toast('폴더 열기 실패: ' + (e.message || e));
      }
      return;
    }
    if ($('folderFallbackInput')) {
      $('folderFallbackInput').value = '';
      $('folderFallbackInput').click();
    }
  }

  async function reconnectSavedFolder() {
    var reqEpoch = SESSION_EPOCH;
    var reqUid = ME && ME.uid ? String(ME.uid) : '';
    if (!isSessionCurrent(reqEpoch, reqUid)) return;
    if (!FOLDER_STATE.handle) {
      await connectConsultingFolder();
      return;
    }
    try {
      var perm = typeof FOLDER_STATE.handle.requestPermission === 'function'
        ? await FOLDER_STATE.handle.requestPermission({ mode: 'read' })
        : 'granted';
      if (!isSessionCurrent(reqEpoch, reqUid)) return;
      if (perm === 'granted') {
        await scanConnectedHandle(FOLDER_STATE.handle, false, reqEpoch, reqUid);
      } else {
        toast('폴더 읽기 권한이 허용되지 않았습니다.');
      }
    } catch (e) {
      if (!isSessionCurrent(reqEpoch, reqUid)) return;
      await connectConsultingFolder();
    }
  }

  function handleFallbackFolderFiles(fileList) {
    var reqEpoch = SESSION_EPOCH;
    var reqUid = ME && ME.uid ? String(ME.uid) : '';
    if (!isSessionCurrent(reqEpoch, reqUid)) return;
    var files = Array.prototype.slice.call(fileList || []);
    if (!files.length) return;
    var firstRel = str(files[0].webkitRelativePath || files[0].name).replace(/\\/g, '/');
    var rootName = firstRel.indexOf('/') > 0 ? firstRel.split('/')[0] : '';
    FOLDER_STATE.handle = null;
    FOLDER_STATE.needsPerm = false;
    FOLDER_STATE.rawRootName = rootName || '선택폴더';
    FOLDER_STATE.rootName = safeFolderDisplayLabel(rootName, '선택폴더');
    FOLDER_STATE.walkedSkippedDirs = 0;
    FOLDER_STATE.rawEntries = files.map(function (f) {
      return {
        relPath: str(f.webkitRelativePath || f.name),
        name: f.name,
        size: f.size,
        lastModified: f.lastModified,
        file: f
      };
    });
    refreshFolderGroups();
    clearSel('folderSync');
    draw();
    if (!FOLDER_STATE.groups.length && !FOLDER_STATE.formFileCount) {
      toast('선택한 폴더에 산업·일자리전환 하위 폴더가 없습니다. 타 컨설팅 자료는 가져오지 않습니다.');
    } else {
      toast('컨설팅폴더 연결 완료: 산업일자리 사업장 ' + FOLDER_STATE.groups.length + '곳 (' + FOLDER_STATE.totalAcceptedFiles + '개 파일 선별 · 타 컨설팅 자동 제외)');
    }
  }

  async function importFolderWorkplaceGroup(groupKey, silent, optEpoch, optUid, optBoundaryHash) {
    var reqEpoch = optEpoch != null ? optEpoch : SESSION_EPOCH;
    var reqUid = optUid != null ? String(optUid) : (ME && ME.uid ? String(ME.uid) : '');
    if (!isSessionCurrent(reqEpoch, reqUid)) return null;

    var grp = FOLDER_STATE.groups.find(function (g) {
      if (g.groupKey !== groupKey) return false;
      if (optBoundaryHash && g.boundaryHash && g.boundaryHash !== optBoundaryHash) return false;
      return true;
    });
    if (!grp) return null;

    /* ★ 사업자번호로 검증된 프로젝트만 자동 연결하고, 상호만 유사한 후보는 단건 실행 시에만 명시적 확인 후 연결한다 */
    var proj = grp.matchedProjectId ? projectById(grp.matchedProjectId) : null;
    if (!proj && !silent && !grp.bizNoConflict && grp.suggestedProjectId) {
      var sugProj = projectById(grp.suggestedProjectId);
      if (sugProj && askConfirm(
        '폴더 사업장 [' + grp.companyName + ']에는 사업자번호 표기가 없습니다.\n' +
        '동일 연도·동일 운영기관의 기존 워크스페이스 [' + sugProj.companyName + ']에 귀속하시겠습니까?\n' +
        '(취소 시 별도 격리 워크스페이스로 안전하게 개설됩니다)'
      )) {
        proj = sugProj;
      }
      if (!isSessionCurrent(reqEpoch, reqUid)) return null;
    }

    if (!proj) {
      var targetCompanyId = grp.companyId;
      if (!silent && !grp.bizNo && !grp.bizNoConflict && grp.suggestedCompanyId) {
        var sugCo = findCompanyById(grp.suggestedCompanyId);
        if (sugCo && askConfirm(
          '폴더 사업장 [' + grp.companyName + ']에는 사업자번호 표기가 없습니다.\n' +
          '기업정보함의 동일 상호 거래처 [' + str(sugCo.name) + (sugCo.bizNo ? ' · ' + sugCo.bizNo : '') + ']와 연결하시겠습니까?\n' +
          '(취소 시 격리 열쇠로 별도 개설됩니다)'
        )) {
          targetCompanyId = str(sugCo.id);
        }
        if (!isSessionCurrent(reqEpoch, reqUid)) return null;
      }
      var co = findCompanyById(targetCompanyId);
      var agCode = grp.agency === 'cepa' ? 'cepa' : 'kmac';
      var trCode = Cat().getTrack(grp.track, agCode).code;
      var targetProjId = 'jt_' + safeKey(targetCompanyId) + '_' + agCode + '_' + (grp.year || 2026);
      var boundFolderHash = (targetCompanyId === grp.companyId && grp.boundaryHash) ? str(grp.boundaryHash) : '';
      var existingAtTarget = D.projects[targetProjId];
      if (boundFolderHash && existingAtTarget && !existingAtTarget._deleted && existingAtTarget.folderBoundaryHash && existingAtTarget.folderBoundaryHash !== boundFolderHash) {
        throw new Error('폴더 경계 지문 불일치 감지: 서로 다른 폴더 경계를 동일 프로젝트에 병합할 수 없습니다.');
      }
      var safeGrpCoName = co ? str(co.name) : sanitizeMetaLabel(grp.companyName, { companyName: '' });
      if (!safeGrpCoName || Intake().hasResidualPii(safeGrpCoName)) safeGrpCoName = '산업일자리전환_참여사업장';
      proj = await saveProjectRecord({
        id: targetProjId,
        companyId: targetCompanyId,
        companyName: safeGrpCoName,
        bizNo: grp.bizNo || (co ? str(co.bizNo) : ''),
        folderBoundaryHash: boundFolderHash || undefined,
        ceoName: co ? str(co.ceo || co.ceoName) : '',
        contactName: contactNameOfCompany(co),
        agency: agCode,
        track: trCode,
        year: grp.year || 2026,
        industry: co ? str(co.bizType || co.bizCategory) : '',
        contactEmails: co && firstEmailOf(co) ? [firstEmailOf(co)] : [],
        scalCoId: grp.scalCoId || '',
        scalTypeId: grp.scalTypeId || '',
        selectedTasks: agCode === 'cepa'
          ? ['jt_impact', 'jt_job_redesign', 'jt_reskill', 'jt_gov_match']
          : ['jt_impact', 'jt_job_redesign', 'jt_reskill', 'jt_emp_stab'],
        consultantName: ME.name ? ME.name + ' 공인노무사' : '푸른노무법인 전담 공인노무사'
      }, reqEpoch, reqUid);
    }
    if (!proj || !isSessionCurrent(reqEpoch, reqUid)) return null;

    var photoFiles = [];
    var docFiles = [];
    var metaOnlyFiles = [];
    (grp.files || []).forEach(function (f) {
      var low = str(f.fileName).toLowerCase();
      if (/\.(jpg|jpeg|png|webp)$/.test(low)) photoFiles.push(f);
      else if (/\.(xlsx|xls|csv|hwpx|hwp|docx|pdf|txt)$/.test(low)) docFiles.push(f);
      else metaOnlyFiles.push(f);
    });

    var mc = Object.assign({}, proj.manualChecks || {});
    function markCheck(phase, dkCode) {
      var ph = phase === 'post_mid' ? 'post_mid' : 'pre_mid';
      var sub = Object.assign({}, mc[ph] || {});
      sub[dkCode] = true;
      mc[ph] = sub;
    }

    var savedCount = 0;
    var docSlice = docFiles.slice(0, 24);
    if (docFiles.length > 24) {
      metaOnlyFiles = metaOnlyFiles.concat(docFiles.slice(24));
    }
    for (var i = 0; i < docSlice.length; i++) {
      if (!isSessionCurrent(reqEpoch, reqUid)) return null;
      var df = docSlice[i];
      var safeTitle = sanitizeMetaLabel(df.fileName, proj);
      if (Intake().hasResidualPii(safeTitle)) safeTitle = (df.docKindName || '수집문서') + '_자료';
      var cardId = hashKey('fdir_', df.relPath);
      try {
        var fileObj = df.file || (df.handle && typeof df.handle.getFile === 'function' ? await df.handle.getFile() : null);
        if (!isSessionCurrent(reqEpoch, reqUid)) return null;
        if (fileObj && fileObj.size > 0 && fileObj.size <= 20 * 1024 * 1024) {
          var bytes = new Uint8Array(await fileObj.arrayBuffer());
          if (!isSessionCurrent(reqEpoch, reqUid)) return null;
          var analyzed = await analyzeAttachmentBytes(df.fileName, bytes, proj, '', df.phase);
          if (!isSessionCurrent(reqEpoch, reqUid)) return null;
          if (analyzed) {
            var savedDocCard = await saveIntakeCard(proj, Object.assign({
              id: cardId,
              source: 'folder',
              title: safeTitle,
              attNames: [safeTitle],
              phase: df.phase,
              checkedAt: Date.now(),
              analyzedAt: Date.now()
            }, analyzed), reqEpoch, reqUid);
            if (!savedDocCard || !isSessionCurrent(reqEpoch, reqUid)) return null;
            markCheck(df.phase, analyzed.docKind || df.docKind);
            savedCount++;
            continue;
          }
        }
      } catch (err) {
        /* 민감 열 불완전 시트나 비정형 바이너리는 원문 노출 없이 비식별 수령 메타 카드로만 기록 */
      }
      if (!isSessionCurrent(reqEpoch, reqUid)) return null;
      var savedMetaCard = await saveIntakeCard(proj, {
        id: cardId,
        source: 'folder',
        title: safeTitle,
        attNames: [safeTitle],
        phase: df.phase,
        docKind: df.docKind,
        track: 'meta',
        piiStripped: true,
        maskedExcerpt: '',
        stats: null,
        policyIssues: [],
        postDiff: null,
        summaryLines: ['컨설팅업체 폴더 원본 연결 확인 (' + (df.docKindName || df.docKind) + ') — 개인정보 비저장 보호 적용'],
        checkedAt: Date.now(),
        analyzedAt: Date.now()
      }, reqEpoch, reqUid);
      if (!savedMetaCard || !isSessionCurrent(reqEpoch, reqUid)) return null;
      markCheck(df.phase, df.docKind);
      savedCount++;
    }

    if (photoFiles.length) {
      if (!isSessionCurrent(reqEpoch, reqUid)) return null;
      var savedPhotoCard = await saveIntakeCard(proj, {
        id: 'fdir_photos_' + safeKey(grp.groupKey),
        source: 'folder',
        title: '현장 수행사진 모음 (' + photoFiles.length + '매)',
        attNames: ['현장사진_' + photoFiles.length + '매'],
        phase: 'post_mid',
        docKind: 'round_log',
        track: 'meta',
        piiStripped: true,
        maskedExcerpt: '',
        stats: null,
        policyIssues: [],
        postDiff: { hasPhoto: true, hasSign: false, requests: [] },
        summaryLines: ['컨설팅업체 폴더 내 현장 수행사진 증빙 ' + photoFiles.length + '매 연결 확인'],
        checkedAt: Date.now(),
        analyzedAt: Date.now()
      }, reqEpoch, reqUid);
      if (!savedPhotoCard || !isSessionCurrent(reqEpoch, reqUid)) return null;
      markCheck('post_mid', 'round_log');
      savedCount++;
    }

    if (metaOnlyFiles.length) {
      var byKind = {};
      metaOnlyFiles.forEach(function (mf) {
        if (!byKind[mf.docKind]) byKind[mf.docKind] = { count: 0, phase: mf.phase, short: mf.docKindName };
        byKind[mf.docKind].count++;
        markCheck(mf.phase, mf.docKind);
      });
      var mkKeys = Object.keys(byKind);
      for (var k = 0; k < mkKeys.length; k++) {
        if (!isSessionCurrent(reqEpoch, reqUid)) return null;
        var dkc = mkKeys[k];
        var info = byKind[dkc];
        var savedArchCard = await saveIntakeCard(proj, {
          id: 'fdir_arch_' + safeKey(grp.groupKey + '_' + dkc),
          source: 'folder',
          title: (info.short || dkc) + ' 관련 참고·압축자료 (' + info.count + '건)',
          attNames: [(info.short || dkc) + '_' + info.count + '건'],
          phase: info.phase,
          docKind: dkc,
          track: 'meta',
          piiStripped: true,
          maskedExcerpt: '',
          stats: null,
          policyIssues: [],
          postDiff: null,
          summaryLines: ['컨설팅업체 폴더 관련 자료 ' + info.count + '건 수령 확인 (' + (info.short || dkc) + ')'],
          checkedAt: Date.now(),
          analyzedAt: Date.now()
        }, reqEpoch, reqUid);
        if (!savedArchCard || !isSessionCurrent(reqEpoch, reqUid)) return null;
        savedCount++;
      }
    }

    if (!isSessionCurrent(reqEpoch, reqUid)) return null;
    var updatedProj = await saveProjectRecord(Object.assign({}, proj, { manualChecks: mc }), reqEpoch, reqUid);
    if (!updatedProj || !isSessionCurrent(reqEpoch, reqUid)) return null;
    if (!silent) {
      CUR_PID = updatedProj.id;
      TAB = 'intake';
      clearSel();
      rebuildScanAndDiscover();
      draw();
      toast(updatedProj.companyName + ' 폴더 자료 ' + savedCount + '건 비식별 반영 완료');
    }
    return updatedProj;
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
    if (scalCo.erpCompanyId) {
      var byId = findCompanyById(scalCo.erpCompanyId);
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
      var trClsList = [];
      if (curId && r.id === curId) trClsList.push('cur');
      if (r.cls) trClsList.push(r.cls);
      var trCls = trClsList.length ? ' class="' + esc(trClsList.join(' ')) + '"' : '';
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
        '<button class="sm" data-ai-polish="' + modePrefix + ':' + esc(s.key) + '" title="개인정보 2중 가림 후 기관 양식 문체로 다듬습니다">✨ AI 윤문</button>' +
        '<button class="sm ok" data-save-' + modePrefix + '-sec="' + esc(s.key) + '">💾 저장</button>' +
        '</div>' +
        '<div class="rpt-sec-body">' +
        (s.guide ? '<div class="hint" style="margin-bottom:5px">작성 초점: ' + esc(s.guide) + '</div>' : '') +
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
      if (nm === 'projects' || nm === 'projectsKmac' || nm === 'projectsCepa') {
        btns = '<button class="sm ok" data-bulkact="' + nm + ':finalok" title="고른 사업장 중 메일 근거가 있고 아직 완료가 아닌 곳만 «최종 완료»로 적습니다">✅ 메일 근거로 완료 확정</button>' +
          '<button class="sm danger" data-bulkact="' + nm + ':del">선택 숨김(삭제)</button>';
      } else if (nm === 'projMails') {
        btns = '<button class="sm pri" data-bulkact="projMails:copy">📋 선택 기록 복사</button>';
      } else if (nm === 'formReviewKmac' || nm === 'formReviewCepa') {
        btns = '<button class="sm ok" data-bulkact="' + nm + ':hwpx">📥 선택 사업장 최종 .hwpx 다운로드</button>';
      } else if (nm === 'midReview' || nm === 'finalReview') {
        btns = '<button class="sm pri" data-bulkact="' + nm + ':copy">📋 선택 검수기준 복사</button>';
      } else if (nm === 'folderSync') {
        btns = '<button class="sm pri" data-bulkact="folderSync:import">📥 선택 사업장 자료 반영</button>';
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

  /* ══ 연도별 정리 · 최종보고서 진행 상태 (대표 지시 2026-11-28 「연도별로 정리 · 메일로 들어간 최종보고서 찾아 완료 표시 · 눌러서 진행 확인」) ══ */
  function yearOf(p) { var y = Number(p && p.year); return isFinite(y) && y > 0 ? y : 0; }
  /* 같은 기관 안에서 연도 내림차순 → 사업장명 가나다 */
  function sortByYearName(list) {
    return list.slice().sort(function (a, b) {
      return (yearOf(b) - yearOf(a)) || str(a.companyName).localeCompare(str(b.companyName), 'ko');
    });
  }
  function yearsOfProjects(projs) {
    var seen = {};
    projs.forEach(function (p) { var y = yearOf(p); if (y) seen[y] = 1; });
    return Object.keys(seen).map(Number).sort(function (a, b) { return b - a; });
  }
  function dayOfMs(ms) { var s = fmtDateTime(ms); return s === '-' ? '' : s.slice(0, 10); }
  function finalEvOf(p) {
    return (p && FINAL_EV[p.id]) || { status: 'none', done: false, label: '', doneAt: 0, doneDate: '', doneKey: '', lastDate: '', mails: [] };
  }
  /* 목록 한 칸(한 줄)에 보일 진행 상태 — 사람이 확정한 기록이 먼저, 그다음 메일 근거 */
  function progressStateOf(p) {
    var ev = finalEvOf(p);
    var saved = p && p.finalMail && typeof p.finalMail === 'object' ? p.finalMail : null;
    if (p && p.finalConfirmedAt) {
      var how = saved ? str(saved.label) : (ev.done ? ev.label : '');
      return {
        code: 'done', cls: 'c-green', icon: '✅',
        text: '완료' + (how ? ' · ' + how : ''),
        date: (saved && str(saved.date)) || ev.doneDate || dayOfMs(p.finalConfirmedAt),
        title: how ? '최종 완료 — 메일 근거: ' + how : '최종 완료로 기록돼 있으나 메일함 거울에서 근거 메일을 찾지 못했습니다(오래전에 보낸 메일일 수 있습니다)'
      };
    }
    if (ev.done) {
      return { code: 'wait', cls: 'c-amber', icon: '📤', text: ev.label + ' · 완료 확정 대기', date: ev.doneDate, title: '메일 근거가 있습니다 — 사업장을 눌러 메일을 확인한 뒤 «완료로 확정»을 누르세요' };
    }
    if (ev.mails.length) {
      return { code: 'review', cls: 'c-blue', icon: '📝', text: ev.status === 'review' ? '최종보고 검토·수정 중' : '최종보고 메일 오감', date: ev.lastDate, title: '최종보고서 메일이 오가고 있습니다(완료 근거는 아직 없음)' };
    }
    if (p && p.midConfirmedAt) return { code: 'mid', cls: 'c-blue', icon: '📌', text: '중간 확정 · 최종 준비', date: dayOfMs(p.midConfirmedAt), title: '중간보고 기준선이 확정됐습니다' };
    return { code: 'pre', cls: '', icon: '⏳', text: '착수 · 기초자료', date: '', title: '중간보고 전 단계입니다' };
  }
  function progressChipHtml(st) {
    return '<span class="chip ' + st.cls + '" title="' + esc(st.title || '') + '">' + st.icon + ' ' + esc(st.text) + '</span>' +
      (st.date ? ' <span class="hint">' + esc(st.date) + '</span>' : '');
  }

  function agencyChipHtml(agencyCode) {
    var ag = Cat().getAgency(agencyCode);
    var cls = ag.code === 'cepa' ? 'c-green' : 'c-blue';
    return '<span class="chip ' + cls + '">' + esc(ag.short) + '</span>';
  }

  function projectParallelMeta(proj) {
    if (!Intake() || typeof Intake().detectParallelConsultings !== 'function') {
      return { contractNo: str(proj && proj.contractNo), hasIlteoSangsaeng: false, ilteoLabels: [], otherLabels: [] };
    }
    return Intake().detectParallelConsultings(proj, D.consultings, D.bizTypes);
  }

  function drawAgencyScopeBar(projs, kmacCnt, cepaCnt) {
    var bar = $('agencyScopeBar');
    if (!bar) return;
    if ($('projAgency') && $('projAgency').value !== AGENCY_SCOPE) {
      $('projAgency').value = AGENCY_SCOPE;
    }
    bar.innerHTML =
      '<span class="agency-scope-lbl">🏛️ 소속기관 구분 보기:</span>' +
      '<button type="button" class="agency-scope-btn' + (AGENCY_SCOPE === '' ? ' on' : '') + '" data-set-agency-scope="" aria-pressed="' + (AGENCY_SCOPE === '' ? 'true' : 'false') + '">' +
      '⚖️ 기관별 좌우 분리 (' + projs.length + ')</button>' +
      '<button type="button" class="agency-scope-btn wide-only' + (AGENCY_SCOPE === 'stack' ? ' on' : '') + '" data-set-agency-scope="stack" aria-pressed="' + (AGENCY_SCOPE === 'stack' ? 'true' : 'false') + '">' +
      '▤ 전체폭 상하 분리 (' + projs.length + ')</button>' +
      '<button type="button" class="agency-scope-btn' + (AGENCY_SCOPE === 'kmac' ? ' on' : '') + '" data-set-agency-scope="kmac" aria-pressed="' + (AGENCY_SCOPE === 'kmac' ? 'true' : 'false') + '">' +
      '🔵 능률협회(KMAC · 산일능률) (' + kmacCnt + ')</button>' +
      '<button type="button" class="agency-scope-btn cepa' + (AGENCY_SCOPE === 'cepa' ? ' on' : '') + '" data-set-agency-scope="cepa" aria-pressed="' + (AGENCY_SCOPE === 'cepa' ? 'true' : 'false') + '">' +
      '🟢 충남경제진흥원(CEPA · 산일충남) (' + cepaCnt + ')</button>' +
      '<button type="button" class="agency-scope-btn" data-goto-tab="forms" title="능률협회(KMAC)와 충남경제진흥원(CEPA)의 서로 다른 보고서 양식·목차·검수기준을 나란히 검토합니다 (일터상생·석유화학노동전환 자동분리)">⚖️ 양식·검토기준 비교</button>';
  }

  /* ══ 3. 화면 전체 그리기 ════════════════════════════════════════════════ */
  function draw() {
    var projs = activeProjects();
    var totalPreUnseen = 0, totalPostUnseen = 0, midDoneCnt = 0, kmacCnt = 0, cepaCnt = 0;
    projs.forEach(function (p) {
      var sc = SCAN_CACHE[p.id] || { unseenPreCount: 0, unseenPostCount: 0 };
      totalPreUnseen += sc.unseenPreCount;
      totalPostUnseen += sc.unseenPostCount;
      if (p.midConfirmedAt) midDoneCnt++;
      if (p.agency === 'cepa') cepaCnt++; else kmacCnt++;
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
    ['projects', 'intake', 'mid', 'final', 'forms'].forEach(function (t) {
      var pane = $('p-' + t);
      if (pane) pane.classList.toggle('on', t === TAB);
    });

    drawAgencyScopeBar(projs, kmacCnt, cepaCnt);
    if ($('agencyScopeBar') && $('agencyScopeBar').style) $('agencyScopeBar').style.display = (TAB === 'projects' || TAB === 'forms') ? '' : 'none';
    drawProjectsPane(projs, totalPreUnseen, midDoneCnt, totalPostUnseen, kmacCnt, cepaCnt);
    drawIntakePane();
    drawMidPane();
    drawFinalPane();
    drawFormsPane(projs);
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

  function projectHeaderBarHtml(proj) {
    var projs = activeProjects();
    var ag = Cat().getAgency(proj.agency);
    var tr = Cat().getTrack(proj.track, ag.code);
    var spec = Cat().getAgencyFormSpec ? Cat().getAgencyFormSpec(ag.code) : null;
    var pMeta = projectParallelMeta(proj);
    var tasks = (proj.selectedTasks || []).map(function (c) { var t = Cat().getTask(c); return t ? t.name : c; });
    var curOrder = proj.finalConfirmedAt ? 6 : (proj.midConfirmedAt ? 4 : (activeIntakeCount(proj.id) ? 2 : 1));

    /* 사업장 고르기 — 기관은 묶음 이름(optgroup)이 말해 주므로 줄에는 «연도 · 사업장명»만. 위 기관 보기와 상관없이 늘 두 기관 다 */
    function buildOptItems(list) {
      return sortByYearName(list).map(function (p) {
        return '<option value="' + esc(p.id) + '"' + (p.id === proj.id ? ' selected' : '') + '>' +
          esc((yearOf(p) || '연도?') + ' · ' + p.companyName) + '</option>';
      }).join('');
    }
    var kmacProjs = projs.filter(function (p) { return p.agency !== 'cepa'; });
    var cepaProjs = projs.filter(function (p) { return p.agency === 'cepa'; });
    var opts = '';
    if (kmacProjs.length) opts += '<optgroup label="🔵 능률협회 (KMAC · 산일능률)">' + buildOptItems(kmacProjs) + '</optgroup>';
    if (cepaProjs.length) opts += '<optgroup label="🟢 충남경제진흥원 (CEPA · 산일충남)">' + buildOptItems(cepaProjs) + '</optgroup>';

    var ilteoGuardChip = pMeta.hasIlteoSangsaeng
      ? ' <span class="chip c-amber" title="동일 사업장의 일터혁신 상생컨설팅(' + esc(pMeta.ilteoLabels.join(', ')) + ') 계약·서류·메일은 본 화면에서 자동 분리·배제됩니다">일터상생 별도수행(자동분리)</span>'
      : '';
    var formChipLabel = spec ? (TAB === 'mid' ? spec.midFormTitle : spec.finalFormTitle) : (ag.short + ' 전용 양식');
    var aboutTitle = '적용 양식: ' + formChipLabel + (tasks.length ? ' · 중점과제: ' + tasks.join(', ') : ' · 중점과제 미선택');
    var st = progressStateOf(proj);
    var baseChip = proj.midConfirmedAt
      ? '<span class="chip c-green">중간확정 ' + esc(dayOfMs(proj.midConfirmedAt)) + '</span>'
      : '<span class="chip c-amber">기초진단중</span>';

    return '<div class="card">' +
      '<div class="prof">' +
      '<span><b>사업장</b><select data-proj-sel="1" aria-label="작업 사업장 전환">' + opts + '</select></span>' +
      '<span title="' + esc(aboutTitle) + '">' + agencyChipHtml(ag.code) +
      (pMeta.contractNo ? ' <span class="chip">' + esc(pMeta.contractNo) + '</span>' : '') +
      ' <span class="chip">' + esc(tr.short) + '</span>' + ilteoGuardChip + '</span>' +
      '<span>' + baseChip + (st.code === 'done' || st.code === 'wait' || st.code === 'review' ? ' ' + progressChipHtml(st) : '') + '</span>' +
      '<span class="sp"></span>' +
      '<button class="sm" data-open-detail="' + esc(proj.id) + '" title="메일로 오간 최종보고서·완료 근거와 진행 단계를 한 화면에서 봅니다">📁 진행 기록·완료보고서</button>' +
      '<button class="sm" data-act="open-task-modal" title="' + esc(aboutTitle) + '">🎯 기관·트랙·과제 설정</button>' +
      '</div>' +
      '<div class="ws-steps">' +
      Cat().STAGES.map(function (stg) {
        var cls = stg.order < curOrder ? ' done' : (stg.order === curOrder ? ' cur' : '');
        var targetTab = stg.phase === 'post_mid' ? 'final' : (stg.code === 'mid_rpt' ? 'mid' : 'intake');
        return '<button type="button" class="ws-step' + cls + '" data-goto-tab="' + targetTab + '" title="' + esc(stg.desc) + '">' +
          '<b>' + stg.order + '. ' + esc(stg.short) + '</b>' +
          '</button>';
      }).join('') +
      '</div></div>';
  }

  var PROJECT_TABLE_HEADS = ['연도', '사업장명', '트랙 · 단계', '진행 상태 (최종보고)', '기초 · 검수 · 메일', '바로가기'];

  function buildProjectRowForAgencyTable(p, idx, list) {
    var sc = SCAN_CACHE[p.id] || { matched: [], unseenPreCount: 0, unseenPostCount: 0, totalInCount: 0 };
    var chkPre = Intake().summarizeChecklistProgress('pre_mid', p.agency, p.track, p.selectedTasks, D.intake[p.id] || {}, sc.matched, manualChecksOf(p, 'pre_mid'));
    var tr = Cat().getTrack(p.track, p.agency);
    var pMeta = projectParallelMeta(p);
    var taskNames = (p.selectedTasks || []).map(function (c) { var t = Cat().getTask(c); return t ? t.name : c; }).join(' · ');

    var schedRds = schedRoundsForProject(p);
    var midObj = Report().buildMidReport(p, D.intake[p.id] || {}, schedRds, D.mid[p.id] || null);
    var finObj = Report().buildFinalReport(p, midObj, D.intake[p.id] || {}, schedRds, D.final[p.id] || null);
    var rev = Report().evaluateReportFormReview(p, p.midConfirmedAt ? 'final' : 'mid', p.midConfirmedAt ? finObj : midObj, D.intake[p.id] || {}, schedRds);

    var mailBadges = [];
    if (sc.unseenPreCount > 0) mailBadges.push('<span class="chip c-amber" title="기초자료 미확인 메일 ' + sc.unseenPreCount + '건">📩' + sc.unseenPreCount + '</span>');
    if (sc.unseenPostCount > 0) mailBadges.push('<span class="chip c-green" title="후속 미확인 메일 ' + sc.unseenPostCount + '건">📬' + sc.unseenPostCount + '</span>');
    if (!mailBadges.length && sc.totalInCount > 0) mailBadges.push('<span class="chip" title="수신 확인된 메일 ' + sc.totalInCount + '건">✓' + sc.totalInCount + '</span>');

    var ilteoChip = pMeta.hasIlteoSangsaeng
      ? ' <span class="chip c-amber" title="일터혁신 상생컨설팅(' + esc(pMeta.ilteoLabels.join(', ')) + ') 별도 계약은 본 워크스페이스에서 자동 분리됨">일터별도</span>'
      : '';
    var revChipCls = rev.allPassed ? 'c-green' : 'c-amber';
    var compactTrackLabel = str(tr.short).replace(/^(?:KMAC|CEPA)\s+/i, '');
    var st = progressStateOf(p);
    var y = yearOf(p);
    var prevY = (Array.isArray(list) && idx > 0) ? yearOf(list[idx - 1]) : y;
    /* 계약번호·전환목표·중점과제는 줄마다 되풀이하지 않고 풀이(title)와 «진행 기록» 창으로 */
    var nameTitle = [p.companyName, pMeta.contractNo, str(p.transGoal) || taskNames].filter(Boolean).join(' · ');

    return {
      id: p.id,
      cls: (Array.isArray(list) && idx > 0 && prevY !== y) ? 'yr-break' : '',
      cells: [
        { k: 'yr', cls: 'yr', title: y ? y + '년 사업' : '연도 미입력', html: '<b>' + esc(y ? String(y) : '-') + '</b>' },
        { cls: 'ti', title: nameTitle, html: esc(p.companyName) + ilteoChip },
        { k: 'badge', title: tr.name, html: '<span class="chip ' + (p.agency === 'cepa' ? 'c-green' : 'c-blue') + '">' + esc(compactTrackLabel) + '</span> ' + stageDotsHtml(p) },
        { cls: 'wide', k: 'prog', title: st.title, html: progressChipHtml(st) },
        { html: '<b>' + chkPre.pct + '%</b> <span class="chip ' + revChipCls + '" title="기관 전용 양식 검수 통과 항목">검수 ' + rev.passCount + '/' + rev.totalCount + '</span>' + (mailBadges.length ? ' ' + mailBadges.join(' ') : '') },
        {
          k: 'act',
          html: '<button class="sm" data-open-proj="' + esc(p.id) + '" data-open-tab="intake">①기초</button>' +
            '<button class="sm" data-open-proj="' + esc(p.id) + '" data-open-tab="mid">②중간</button>' +
            '<button class="sm pri" data-open-proj="' + esc(p.id) + '" data-open-tab="final" title="' + esc(p.agency === 'cepa' ? '충남경제진흥원 결과보고서·완료계 검토' : '능률협회 최종보고서·정책매니저 검토') + '">③' + (p.agency === 'cepa' ? '완료계' : '최종') + '</button>'
        }
      ]
    };
  }

  /* ── 탭 1: 사업장 현황 · 소속기관별(KMAC vs CEPA) 완전 분리 보기 ── */
  function drawProjectsPane(projs, totalPreUnseen, midDoneCnt, totalPostUnseen, kmacCnt, cepaCnt) {
    var q = str($('projQ') && $('projQ').value).toLowerCase();
    var rawScope = AGENCY_SCOPE;
    var agFilter = (rawScope === 'kmac' || rawScope === 'cepa') ? rawScope : '';
    var yrs = yearsOfProjects(projs);
    if (YEAR_FILTER && yrs.indexOf(Number(YEAR_FILTER)) < 0) YEAR_FILTER = '';
    var yr = YEAR_FILTER;
    var stFilter = str($('projStage') && $('projStage').value);

    if ($('kpiBox')) {
      var scopeList = projs.filter(function (p) { return !agFilter || (p.agency === 'cepa' ? 'cepa' : 'kmac') === agFilter; });
      var doneCnt = 0, waitCnt = 0;
      scopeList.forEach(function (p) {
        var c = progressStateOf(p).code;
        if (c === 'done') doneCnt++;
        else if (c === 'wait') waitCnt++;
      });
      var yrTiles = yrs.map(function (y) {
        var inY = scopeList.filter(function (p) { return yearOf(p) === y; });
        if (!inY.length) return '';
        var dn = inY.filter(function (p) { return progressStateOf(p).code === 'done'; }).length;
        var on = yr === String(y);
        return '<button type="button" class="kpi kpi-yr' + (on ? ' on' : '') + '" data-set-year="' + y + '" aria-pressed="' + (on ? 'true' : 'false') + '" title="' + y + '년 사업만 보기">' +
          '<span>' + y + '년 · 완료 ' + dn + (inY.length - dn ? ' · 진행 ' + (inY.length - dn) : '') + '</span><b>' + inY.length + '개사</b></button>';
      }).join('');
      $('kpiBox').innerHTML =
        '<button type="button" class="kpi kpi-yr' + (!yr ? ' on' : '') + '" data-set-year="" aria-pressed="' + (!yr ? 'true' : 'false') + '" title="모든 연도 보기"><span>전체 연도</span><b>' + scopeList.length + '개사</b></button>' +
        yrTiles +
        '<div class="kpi k-green" title="최종 완료로 기록된 사업장(메일 근거가 있으면 줄에 함께 보입니다)"><span>✅ 최종 완료</span><b>' + doneCnt + '개사</b></div>' +
        '<div class="kpi k-amber" title="메일에 최종 승인·완료계·결과보고서 송부 근거가 있으나 아직 완료로 확정하지 않은 사업장"><span>📤 완료 확정 대기</span><b>' + waitCnt + '개사</b></div>' +
        '<div class="kpi k-amber"><span>📩 미확인 메일 (기초 ' + totalPreUnseen + ' · 후속 ' + totalPostUnseen + ')</span><b>' + (totalPreUnseen + totalPostUnseen) + '건</b></div>';
    }

    var filtered = projs.filter(function (p) {
      var pAg = p.agency === 'cepa' ? 'cepa' : 'kmac';
      if (agFilter && pAg !== agFilter) return false;
      if (yr && String(yearOf(p)) !== yr) return false;
      var sc = SCAN_CACHE[p.id] || { unseenPreCount: 0, unseenPostCount: 0 };
      var pcode = progressStateOf(p).code;
      if (stFilter === 'pre_mid' && p.midConfirmedAt) return false;
      if (stFilter === 'post_mid' && (!p.midConfirmedAt || pcode === 'done')) return false;
      if (stFilter === 'final_wait' && pcode !== 'wait') return false;
      if (stFilter === 'final_done' && pcode !== 'done') return false;
      if (stFilter === 'unseen' && (sc.unseenPreCount + sc.unseenPostCount) === 0) return false;
      if (q) {
        var taskStr = (p.selectedTasks || []).map(function (c) { var t = Cat().getTask(c); return t ? t.name : ''; }).join(' ');
        var agObj = Cat().getAgency(pAg);
        var trObj = Cat().getTrack(p.track, pAg);
        var pm = projectParallelMeta(p);
        var hay = (str(p.companyName) + ' ' + str(pm.contractNo) + ' ' + str(p.industry) + ' ' + str(p.transGoal) + ' ' + str(p.consultantName) + ' ' + agObj.name + ' ' + trObj.name + ' ' + taskStr + ' ' + yearOf(p)).toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });

    var kmacRows = sortByYearName(filtered.filter(function (p) { return p.agency !== 'cepa'; })).map(buildProjectRowForAgencyTable);
    var cepaRows = sortByYearName(filtered.filter(function (p) { return p.agency === 'cepa'; })).map(buildProjectRowForAgencyTable);

    var kmacCardHtml =
      '<div class="agency-col-card kmac">' +
      '<div class="agency-col-hd">' +
      '<span>🔵 한국능률협회컨설팅(KMAC) — 구조혁신(산업·일자리전환)</span>' +
      '<span class="chip c-blue">' + kmacRows.length + '개사</span>' +
      '<span class="sp"></span>' +
      '<button type="button" class="sm" data-goto-tab="forms" data-set-agency-scope="kmac" title="ERP 계약구분 산일능률 · 전용 양식: 착수PPT(1MD) → 중간 7장 → 2026년형 결과보고서 8장(KPI 4+·지원사업 2+) → 완료보고서·정책매니저">📋 KMAC 양식·검수기준</button>' +
      '</div>' +
      renderTable('projectsKmac', PROJECT_TABLE_HEADS, kmacRows, CUR_PID) +
      '</div>';

    var cepaCardHtml =
      '<div class="agency-col-card cepa">' +
      '<div class="agency-col-hd">' +
      '<span>🟢 충남경제진흥원(CEPA) — 충남 산업일자리전환지원센터</span>' +
      '<span class="chip c-green">' + cepaRows.length + '개사</span>' +
      '<span class="sp"></span>' +
      '<button type="button" class="sm" data-goto-tab="forms" data-set-agency-scope="cepa" title="ERP 계약구분 산일충남 · 전용 양식: 지원신청서 → [진단 3회 / 전문 6회·월별실적] → 결과보고서 8장 → 완료계(갑지 대표자 날인) · 충남장려금">📋 CEPA 양식·검수기준</button>' +
      '</div>' +
      renderTable('projectsCepa', PROJECT_TABLE_HEADS, cepaRows, CUR_PID) +
      '</div>';

    if ($('projectsBox')) {
      if (agFilter === 'kmac') {
        $('projectsBox').innerHTML = '<div class="agency-split-grid">' + kmacCardHtml + '</div>';
      } else if (agFilter === 'cepa') {
        $('projectsBox').innerHTML = '<div class="agency-split-grid">' + cepaCardHtml + '</div>';
      } else if (rawScope === 'stack') {
        $('projectsBox').innerHTML = '<div class="agency-split-grid">' + kmacCardHtml + cepaCardHtml + '</div>';
      } else {
        $('projectsBox').innerHTML = '<div class="agency-split-grid dual">' + kmacCardHtml + cepaCardHtml + '</div>';
      }
    }

    if ($('folderSyncCard')) {
      var showFolderCard = !!(FOLDER_STATE.needsPerm || FOLDER_STATE.groups.length || FOLDER_STATE.rootName);
      $('folderSyncCard').style.display = showFolderCard ? '' : 'none';
      if ($('nFolderGroups')) $('nFolderGroups').textContent = String(FOLDER_STATE.groups.length);
      if ($('reconnectFolderBtn')) $('reconnectFolderBtn').style.display = FOLDER_STATE.needsPerm ? '' : 'none';
      if ($('folderSyncMeta')) {
        var dispRoot = safeFolderDisplayLabel(FOLDER_STATE.rootName, '선택폴더');
        if (FOLDER_STATE.needsPerm) {
          $('folderSyncMeta').textContent = '이전 연결 폴더(' + dispRoot + ') — [🔓 폴더 권한 재연결]을 누르면 산업일자리 자료만 다시 불러옵니다';
        } else if (FOLDER_STATE.rootName) {
          $('folderSyncMeta').textContent = '[' + dispRoot + '] 산업일자리 파일 ' + FOLDER_STATE.totalAcceptedFiles + '개 선별 (공통양식 ' + FOLDER_STATE.formFileCount + ' · 타 컨설팅/정산 제외 ' + (FOLDER_STATE.skippedNonJobtrans + FOLDER_STATE.skippedPersonal) + ')';
        }
      }
      if ($('folderSyncBox')) {
        if (FOLDER_STATE.needsPerm) {
          $('folderSyncBox').innerHTML = '<div class="empty">브라우저 보안 정책상 새로고침 후 폴더 읽기 권한 재승인이 필요합니다. 상단의 [🔓 폴더 권한 재연결]을 눌러 주세요.</div>';
        } else {
          var fRows = FOLDER_STATE.groups.map(function (g) {
            var tr = Cat().getTrack(g.track, g.agency);
            var safeDispCo = safeFolderDisplayLabel(g.companyName, '산업일자리전환 사업장');
            var kindTags = Object.keys(g.docKindCounts || {}).slice(0, 4).map(function (dkCode) {
              var dk = Cat().getDocKind(dkCode);
              return (dk ? dk.short : dkCode) + ' ' + g.docKindCounts[dkCode];
            }).join(' · ');
            var linkedBadge = g.bizNoConflict
              ? '<span class="chip c-red">사업자번호 충돌·격리개설</span>'
              : (g.matchedProjectId
                ? '<span class="chip c-green">사업자번호 검증 연결됨</span>'
                : ((g.suggestedProjectId || g.suggestedCompanyId)
                  ? '<span class="chip c-amber">동일상호 후보 확인필요</span>'
                  : '<span class="chip c-blue">격리 워크스페이스 개설</span>'));
            return {
              id: g.groupKey,
              cells: [
                { cls: 'ti', title: safeDispCo, html: esc(safeDispCo) + ' <span class="chip">' + esc(g.year + '년') + '</span>' },
                { k: 'badge', html: agencyChipHtml(g.agency) + ' <span class="chip">' + esc(tr.short) + '</span> ' + linkedBadge },
                { cls: 'wide', title: kindTags, html: '파일 <b>' + g.fileCount + '건</b>' + (kindTags ? ' (' + esc(kindTags) + ')' : '') },
                { k: 'act', html: '<button class="sm pri" data-import-fgrp="' + esc(g.groupKey) + '" data-boundary-hash="' + esc(g.boundaryHash || '') + '">📥 자료 반영</button>' }
              ]
            };
          });
          $('folderSyncBox').innerHTML = renderTable('folderSync', ['폴더 사업장명', '기관 · 트랙 · 상태', '선별된 산업일자리 자료', '반영'], fRows, '');
        }
      }
    }

    if ($('discoverCard')) {
      $('discoverCard').style.display = DISCOVER_LIST.length ? '' : 'none';
    }
    if ($('discoverBox') && DISCOVER_LIST.length) {
      var dRows = DISCOVER_LIST.map(function (c) {
        var tr = Cat().getTrack(c.track, c.agency);
        return {
          id: c.candKey,
          cells: [
            { cls: 'ti', title: c.companyName, html: esc(c.companyName) + ' <span class="chip">' + esc(c.year + '년') + '</span>' },
            { k: 'badge', html: agencyChipHtml(c.agency) + ' <span class="chip">' + esc(tr.short) + '</span>' },
            { cls: 'wide', title: c.source + (c.bizLabel ? ' · ' + c.bizLabel : ''), html: esc(c.source + (c.bizLabel ? ' · ' + c.bizLabel : '')) },
            { html: esc(c.contactEmail || '이메일 미등록') },
            { k: 'act', html: '<button class="sm pri" data-activate-cand="' + esc(c.candKey) + '">⚡ 활성화</button>' }
          ]
        };
      });
      $('discoverBox').innerHTML = renderTable('discover', ['사업장명', '추론 기관 · 트랙', '연동 출처 · 사업명', '등록 이메일', '활성화'], dRows, '');
    }
  }

  function statusBadgeForChecklist(it) {
    if (it.status === 'analyzed') return '<span class="chip c-green">분석완료 ✓ (' + it.analyzedCount + ')</span>';
    if (it.status === 'manual') return '<span class="chip c-green">수령체크 ✓</span>';
    if (it.status === 'received') return '<span class="chip c-blue">메일수신 📩 (' + it.mailCount + ')</span>';
    return '<span class="chip c-amber">' + (it.required ? '필수 미수신' : '권장 미수신') + '</span>';
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

    var ag = Cat().getAgency(proj.agency);
    var tr = Cat().getTrack(proj.track, ag.code);
    var sc = SCAN_CACHE[proj.id] || { matched: [], nameCandidates: [], unseenPreCount: 0 };
    var preMails = sc.matched.filter(function (m) { return m.phase === 'pre_mid'; });
    var chk = Intake().summarizeChecklistProgress('pre_mid', ag.code, tr.code, proj.selectedTasks, D.intake[proj.id] || {}, sc.matched, manualChecksOf(proj, 'pre_mid'));

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
        var candChip = cm.matchKind === 'addr_ambiguous'
          ? '<span class="chip c-amber">발신일치·내용확인필요</span>'
          : '<span class="chip c-amber">상호 후보</span>';
        return {
          id: cm.key,
          cells: [
            { cls: 'ti', title: cm.subject, html: esc(cm.subject || '(제목 없음)') },
            { k: 'badge', html: candChip },
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
        '<span class="hint">발신 이메일 미등록 후보 — 확인하면 담당자 이메일로 자동 연결됩니다</span>' +
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

    var dkOptions = '<option value="">자동 분류 (파일명·시트 헤더 기준)</option>' +
      Cat().DOC_KINDS.filter(function (d) { return d.defaultPhase === 'pre_mid'; }).map(function (d) {
        return '<option value="' + esc(d.code) + '"' + (UPLOAD_DOC_KIND === d.code ? ' selected' : '') + '>' + esc(d.name) + '</option>';
      }).join('');

    box.innerHTML =
      projectHeaderBarHtml(proj) +
      candCardHtml +
      '<div class="card">' +
      '<div class="sec">' +
      '<span>📋 ' + esc(ag.short) + ' 착수 기초자료 체크리스트</span>' +
      '<div class="prog-wrap"><div class="prog-fill" style="width:' + chk.pct + '%"></div></div>' +
      '<b>' + chk.pct + '% (' + chk.requiredDone + '/' + chk.requiredTotal + ')</b>' +
      '<span class="sp"></span>' +
      '<button class="sm warn-btn" data-act="req-mail-pre">✉️ 미수신 요청문안</button>' +
      '<button class="sm pri" data-goto-tab="mid">② 중간보고서 작성 →</button>' +
      '</div>' +
      renderTable('preChk', ['필수·권장 서류 (' + ag.short + ' 기준)', '수집 상태', '요구 사유 · 보고서 반영 위치', '수령 체크'], chkRows, '') +
      '</div>' +

      '<div class="card">' +
      '<div class="sec">' +
      '<span>📩 푸른메일함 사업장 기초자료 감지 내역</span>' +
      '<span class="chip c-amber">미확인 ' + sc.unseenPreCount + '건</span>' +
      '<span class="sp"></span>' +
      '<span class="hint">열람 시 peek 모드로 메일함의 읽음 표시를 건드리지 않습니다</span>' +
      '</div>' +
      renderTable('preMails', ['메일 제목 · 첨부', '분류 · 상태', '일자', '송수신처', '내용확인'], mailRows, '') +
      '</div>' +

      '<div class="card">' +
      '<div class="sec">' +
      '<span>📎 개인메일 수신분 · 로컬 파일 직접 첨부 (이원화 무유출 비식별 분석)</span>' +
      '<select id="preUploadKind" aria-label="기초자료 서류 종류">' + dkOptions + '</select>' +
      '</div>' +
      '<div class="drop-zone" id="preDropZone" tabindex="0" role="button" aria-label="기초자료 파일 선택 또는 끌어놓기">' +
      '<b>📂 3개년 재무제표 · 인력명부 · 취업규칙 · 임금대장 · 노동전환 설문 파일을 끌어다 놓거나 클릭하세요</b>' +
      '<span>.xlsx · .xls · .csv 정량 자료는 브라우저 메모리에서만 비식별 통계로 집계 후 원본 성명·주민번호를 즉시 폐기합니다 / .hwpx · .hwp · .docx · .pdf · .txt (2중 가림)</span>' +
      '<input type="file" id="preFileInput" multiple accept=".xlsx,.xls,.csv,.hwpx,.hwp,.docx,.pdf,.txt" style="display:none">' +
      '</div>' +
      '</div>' +

      '<div class="card">' +
      '<div class="sec"><span>✅ 확인 · 비식별 분석 완료 기초자료 카드 (' + preCards.length + '건)</span></div>' +
      renderTable('preCards', ['자료 제목', '분류 · 처리방식', '비식별 핵심 분석 요약', '분석시각', '보기'], cardRows, '') +
      '</div>';

    wireDropZone('preDropZone', 'preFileInput', 'preUploadKind', 'pre_mid');
  }

  /* ── 탭 3: ② 기관 맞춤 중간보고서 자동 작성 & HWPX / 푸른한글 / PDF ── */
  function drawMidPane() {
    var box = $('midBox');
    if (!box) return;
    var proj = projectById(CUR_PID);
    if (!proj) {
      box.innerHTML = '<div class="card"><div class="empty">먼저 사업장을 선택해 주세요.</div></div>';
      return;
    }

    var ag = Cat().getAgency(proj.agency);
    var tr = Cat().getTrack(proj.track, ag.code);
    var schedRds = schedRoundsForProject(proj);
    var savedMid = D.mid[proj.id] || null;
    var computedMid = Report().buildMidReport(proj, D.intake[proj.id] || {}, schedRds, savedMid);
    var secs = (savedMid && savedMid.sections) ? Object.assign({}, computedMid.sections, savedMid.sections) : computedMid.sections;
    var locks = (savedMid && savedMid.locks) || {};
    var iv = proj.interviews || {};
    var svBars = (computedMid.structured && computedMid.structured.surveyAreaBars) || [];
    var rc = (computedMid.structured && computedMid.structured.roundCheck) || Report().normalizeRounds(proj, schedRds, {});
    var midSchema = Cat().getMidSections(ag.code);
    var badgeCls = ag.code === 'cepa' ? 'c-green' : 'c-blue';

    var svHtml = svBars.map(function (b) {
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
        ? '<span class="chip c-green">사진·일지 완료 ✓</span>'
        : '<span class="chip c-amber">' + (!r.hasPhoto && !r.hasSign ? '사진·일지 대기' : (!r.hasPhoto ? '사진 대기' : '서명 대기')) + '</span>';
      var ruleWarn = (r.mins < rc.minRoundMins || r.companyPeople < rc.minPeople)
        ? ' <span class="chip c-red">기준 미달⚠</span>'
        : '';
      return {
        id: String(r.roundNo),
        cells: [
          { cls: 'ti wide', title: r.topic, html: r.roundNo + '회차 · ' + esc(r.topic) },
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

    var bannerGuide = proj.midConfirmedAt
      ? '<div class="ok-banner">📌 <b>중간보고 기준선이 확정되었습니다</b> (' + esc(fmtDateTime(proj.midConfirmedAt)) + '). 이후 푸른메일함에 도착하는 피드백·상생협약·완료계 자료는 [③ 최종보고·완료계·HWPX] 단계로 자동 연결됩니다.</div>'
      : '<div class="' + (ag.code === 'cepa' ? 'ok-banner' : 'note') + '"><b>[' + esc(ag.name) + ' · ' + esc(tr.name) + ' 전용 양식]</b> 수집된 3개년 재무·인력 통계, 규정 진단, 인터뷰·설문을 조합하여 <b>' + esc(ag.short) + ' 표준 중간보고서(.hwpx · 푸른한글 · PDF)</b>를 즉시 생성합니다.</div>';

    box.innerHTML =
      projectHeaderBarHtml(proj) +
      bannerGuide +

      '<div class="card">' +
      '<div class="sec">' +
      '<span>🗓️ 회차별 수행 실적 · ' + esc(ag.short) + ' 인정기준 점검 (권장 ' + rc.targetRounds + '회 · 대면 ' + rc.minFacePct + '%+)</span>' +
      '<span class="chip ' + (rc.faceMet ? 'c-green' : 'c-amber') + '">대면 ' + rc.facePct + '% (' + rc.faceCount + '/' + rc.totalCount + ')</span>' +
      '<span class="chip ' + (rc.allTimeAndPeopleMet ? 'c-green' : 'c-amber') + '">' + (rc.allTimeAndPeopleMet ? (rc.minRoundMins + '분·' + rc.minPeople + '인+ 충족✓') : '시간·인원 점검⚠') + '</span>' +
      '<span class="chip c-blue">증빙 ' + rc.proofReadyCount + '/' + rc.totalCount + '</span>' +
      '<span class="sp"></span>' +
      '<button class="sm pri" data-act="add-round">+ 회차 추가</button>' +
      '</div>' +
      renderTable('rounds', ['회차 · 자문 수행 주제', '방식 · 증빙 상태', '수행일 · 시간 · 참석', '관리'], roundRows, '') +
      '</div>' +

      '<div class="card">' +
      '<div class="sec">' +
      '<span>🗣️ 계층별 심층 인터뷰 핵심 메모 (중간보고서 진단 장 자동 반영)</span>' +
      '<span class="sp"></span>' +
      '<button class="sm ok" data-act="save-interviews">💾 인터뷰 저장</button>' +
      '</div>' +
      '<div class="iv-grid">' +
      '<div class="iv-col"><label for="ivExec">경영진 · 사업총괄 핵심 의견</label><textarea id="ivExec" rows="3" placeholder="예: 전방산업 변화에 맞춰 전환 신품목 공정을 확대하되 기존 숙련 인력은 재교육 후 전원 유지 희망">' + esc(iv.exec || '') + '</textarea></div>' +
      '<div class="iv-col"><label for="ivHr">인사 · 노무 실무담당 핵심 의견</label><textarea id="ivHr" rows="3" placeholder="예: 전환 직무기술서(JD) 부재로 배치 기준 수립이 시급하며 정부 훈련·장려금 연계 희망">' + esc(iv.hr || '') + '</textarea></div>' +
      '<div class="iv-col"><label for="ivWorker">근로자대표 · 현장근로자 핵심 의견</label><textarea id="ivWorker" rows="3" placeholder="예: 직무전환 시 고용불안 해소 및 교육기간 중 임금 보전, 현장 실습(OJT) 지원 요청">' + esc(iv.worker || '') + '</textarea></div>' +
      '</div></div>' +

      '<div class="card">' +
      '<div class="sec"><span>📊 ' + esc(ag.surveyName) + ' (5대 영역 진단점수 대 준거치)</span></div>' +
      '<div class="eos-bars">' + svHtml + '</div>' +
      '</div>' +

      '<div class="report-workbench">' +
      '<div class="card" style="margin-bottom:0">' +
      '<div class="bar">' +
      '<button class="sm pri" data-act="regen-mid">⚡ 초안 자동정리</button>' +
      '<button class="sm" data-act="preview-mid">👁️ 큰창 미리보기</button>' +
      '<button class="sm ok" data-act="dl-mid-hwpx">📥 중간 .hwpx 다운로드</button>' +
      '<button class="sm pri" data-act="open-mid-hangul">📝 푸른한글에서 열기</button>' +
      '<button class="sm" data-act="print-mid">🖨 PDF 인쇄</button>' +
      '<span class="sp"></span>' +
      '<button class="sm ok" data-act="confirm-mid-baseline" title="중간보고 기준선 스냅샷 확정 및 후속메일 감시 시작">📌 중간보고 확정</button>' +
      '</div>' +
      renderSectionList('midSecs', ag.short + ' 전용 중간보고서 7개 장 원고 (우측에서 ' + ag.short + ' 공식 양식·검수표 실시간 대조)', midSchema, secs, locks, 'mid', badgeCls) +
      '</div>' +
      '<div class="report-side-sticky" id="midSideWorkbench">' +
      renderReportSideWorkbenchHtml(proj, 'mid', Object.assign({}, computedMid, { sections: secs }), Object.assign({}, computedMid, { sections: secs }), null, schedRds) +
      '</div>' +
      '</div>';
  }

  function renderReportSideWorkbenchHtml(proj, kind, targetReport, midForPv, finForPv, schedRds) {
    var ag = Cat().getAgency(proj.agency);
    var isCepa = ag.code === 'cepa';
    var rev = Report().evaluateReportFormReview(proj, kind, targetReport, D.intake[proj.id] || {}, schedRds);
    var tblName = kind === 'final' ? 'finalReview' : 'midReview';
    var revRows = rev.checks.map(function (c) {
      return {
        id: c.code,
        cells: [
          { cls: 'ti', title: c.label, html: esc(c.label) },
          { k: 'badge', html: '<span class="chip ' + (c.ok ? 'c-green' : 'c-amber') + '">' + esc(c.statusLabel) + '</span>' },
          { cls: 'wide', title: c.detail, html: esc(c.detail) }
        ]
      };
    });
    var pvHtml = '';
    if (Hwpx() && typeof Hwpx().buildPreviewHtml === 'function') {
      var safeMid = midForPv || Report().buildMidReport(proj, D.intake[proj.id] || {}, schedRds, D.mid[proj.id] || null);
      var safeFin = finForPv || Report().buildFinalReport(proj, safeMid, D.intake[proj.id] || {}, schedRds, D.final[proj.id] || null);
      pvHtml = Hwpx().buildPreviewHtml(kind, proj, safeMid, safeFin);
    }

    return '<div class="agency-col-card ' + (isCepa ? 'cepa' : 'kmac') + '">' +
      '<div class="agency-col-hd">' +
      '<span>🛡️ ' + esc(ag.short) + ' 전용 양식 적합성 검수표</span>' +
      '<span class="chip ' + (rev.allPassed ? 'c-green' : 'c-amber') + '">' + rev.passCount + '/' + rev.totalCount + ' 통과 (' + rev.passPct + '%)</span>' +
      '<span class="sp"></span>' +
      '<button type="button" class="sm" data-goto-tab="forms">⚖️ 타기관 양식비교</button>' +
      '</div>' +
      '<div class="agency-col-sub">' +
      '<span><b>검토 양식:</b> ' + esc(rev.formTitle) + '</span>' +
      '</div>' +
      renderTable(tblName, ['기관 전용 검수항목', '판정', '세부 기준 · 현재 상태'], revRows, '') +
      '</div>' +
      (pvHtml ? (
        '<div class="agency-col-card ' + (isCepa ? 'cepa' : 'kmac') + '">' +
        '<div class="agency-col-hd">' +
        '<span>📄 ' + esc(ag.short) + ' 공식 양식 실시간 대조 미리보기</span>' +
        '<span class="sp"></span>' +
        '<button type="button" class="sm" data-act="preview-' + (kind === 'final' ? 'final' : 'mid') + '">🔍 전체창 확대</button>' +
        '</div>' +
        '<div style="padding:10px">' + pvHtml + '</div>' +
        '</div>'
      ) : '');
  }

  /* ── 탭 4: ③ 후속메일 · 최종결과보고서 · 완료계/완료보고서 · HWPX/푸른한글/PDF ── */
  function drawFinalPane() {
    var box = $('finalBox');
    if (!box) return;
    var proj = projectById(CUR_PID);
    if (!proj) {
      box.innerHTML = '<div class="card"><div class="empty">먼저 사업장을 선택해 주세요.</div></div>';
      return;
    }

    var ag = Cat().getAgency(proj.agency);
    var tr = Cat().getTrack(proj.track, ag.code);
    var schedRds = schedRoundsForProject(proj);
    var sc = SCAN_CACHE[proj.id] || { matched: [], unseenPostCount: 0 };
    var postMails = sc.matched.filter(function (m) { return m.phase === 'post_mid'; });
    var chkPost = Intake().summarizeChecklistProgress('post_mid', ag.code, tr.code, proj.selectedTasks, D.intake[proj.id] || {}, sc.matched, manualChecksOf(proj, 'post_mid'));
    var savedMid = D.mid[proj.id] || null;
    var computedMid = Report().buildMidReport(proj, D.intake[proj.id] || {}, schedRds, savedMid);
    var savedFinal = D.final[proj.id] || null;
    var computedFinal = Report().buildFinalReport(proj, computedMid, D.intake[proj.id] || {}, schedRds, savedFinal);
    var secs = (savedFinal && savedFinal.sections) ? Object.assign({}, computedFinal.sections, savedFinal.sections) : computedFinal.sections;
    var locks = (savedFinal && savedFinal.locks) || {};
    var finSchema = Cat().getFinalSections(ag.code, tr.code);

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
          { cls: 'ti', title: d.item, html: esc(d.item) + (d.custom ? ' <span class="chip">수기</span>' : '') },
          { k: 'badge', html: stChip },
          { title: d.midVal, html: esc(d.midVal) },
          { cls: 'wide', title: d.finVal, html: '<b>' + esc(d.finVal) + '</b>' },
          { k: 'act', html: '<button class="sm" data-edit-diff="' + esc(d.id) + '">편집</button>' }
        ]
      };
    });

    var postDkOptions = '<option value="">자동 분류 (후속피드백·상생협약·완료계·회차증빙)</option>' +
      Cat().DOC_KINDS.filter(function (d) { return d.defaultPhase === 'post_mid' || d.code === 'wage_time'; }).map(function (d) {
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

    var midFn = Hwpx() ? Hwpx().suggestedFileName('mid', proj) : '중간보고서.hwpx';
    var finFn = Hwpx() ? Hwpx().suggestedFileName('final', proj) : '최종결과보고서.hwpx';
    var cmpFn = Hwpx() ? Hwpx().suggestedFileName('completion', proj) : '완료보고서.hwpx';
    var safeCo = Hwpx() ? Hwpx().safeFilePart(proj.companyName) : safeKey(proj.companyName);
    var agTag = ag.code === 'cepa' ? '충남경제진흥원' : 'KMAC구조혁신';

    var deliverableSpecs = [
      {
        id: 'mid_hwpx',
        title: '01_' + midFn,
        fmt: 'HWPX · 한글',
        desc: ag.short + ' 맞춤 중간보고서 갑지 · 3개년 재무/인력표 · 설문 격차 · 7개 장 본문',
        actHtml: '<button class="sm" data-act="preview-mid">👁️ 미리보기</button>' +
          '<button class="sm pri" data-act="open-mid-hangul">📝 푸른한글</button>' +
          '<button class="sm" data-act="print-mid">🖨 PDF</button>' +
          '<button class="sm ok" data-act="dl-mid-hwpx">📥 .hwpx</button>'
      },
      {
        id: 'final_hwpx',
        title: '02_' + finFn,
        fmt: 'HWPX · 한글',
        desc: ag.short + ' ' + tr.short + ' 최종본 — 직무전환 매트릭스 · 신구대조표 · 로드맵 · 지원사업 매칭표 포함',
        actHtml: '<button class="sm" data-act="preview-final">👁️ 미리보기</button>' +
          '<button class="sm pri" data-act="open-final-hangul">📝 푸른한글</button>' +
          '<button class="sm" data-act="print-final">🖨 PDF</button>' +
          '<button class="sm ok" data-act="dl-final-hwpx">📥 .hwpx</button>'
      },
      {
        id: 'comp_hwpx',
        title: '03_' + cmpFn,
        fmt: 'HWPX · 한글',
        desc: ag.completionDocName + ' (전 회차 수행내역 · 사후관리 계획 · 참여기업/수행기관 서명란)',
        actHtml: '<button class="sm" data-act="preview-comp">👁️ 미리보기</button>' +
          '<button class="sm pri" data-act="open-comp-hangul">📝 푸른한글</button>' +
          '<button class="sm" data-act="print-comp">🖨 PDF</button>' +
          '<button class="sm ok" data-act="dl-comp-hwpx">📥 .hwpx</button>'
      },
      {
        id: 'data_xlsx',
        title: '04_' + safeCo + '_' + agTag + '_직무매트릭스_신구대조_점검표.xlsx',
        fmt: 'XLSX · 엑셀',
        desc: '회차실적 · 3개년재무/인력 · 직무전환매트릭스 · 후속Diff · 취업규칙신구대조 · 지원사업매칭 6개 시트',
        actHtml: '<button class="sm ok" data-act="dl-data-xlsx">📥 .xlsx 다운로드</button>'
      },
      {
        id: 'sub_txt',
        title: '05_' + safeCo + '_' + agTag + '_수행계획_완료계_일지문안.txt',
        fmt: 'TXT · 문안',
        desc: ag.short + ' 제출용 수행계획서 요약 · ' + ag.completionDocName + ' · 전 회차 수행일지 텍스트',
        actHtml: '<button class="sm" data-act="open-sub-modal">👁️ 문안보기</button>' +
          '<button class="sm ok" data-act="dl-sub-txt">📥 .txt 다운로드</button>'
      }
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
    var fuList = Cat().getFollowupItems(ag.code);
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
      '<span>📬 중간보고 이후 후속·완료 자료 체크리스트 (' + esc(ag.short) + ')</span>' +
      '<div class="prog-wrap"><div class="prog-fill" style="width:' + chkPost.pct + '%"></div></div>' +
      '<b>' + chkPost.pct + '% (' + chkPost.requiredDone + '/' + chkPost.requiredTotal + ')</b>' +
      '<span class="sp"></span>' +
      '<button class="sm warn-btn" data-act="req-mail-post">✉️ 보완요청 문안</button>' +
      '</div>' +
      renderTable('postChk', ['후속 필수·권장 서류', '수집 상태', '요구 사유 · 최종보고 반영처', '수령 체크'], chkPostRows, '') +
      '</div>' +

      '<div class="card">' +
      '<div class="sec">' +
      '<span>📬 푸른메일함 후속 수신 내역 (전환직무 피드백 · 상생협약 · 완료계 · 회차서명지)</span>' +
      '<span class="chip c-green">미확인 ' + sc.unseenPostCount + '건</span>' +
      '</div>' +
      renderTable('postMails', ['메일 제목 · 첨부', '분류 · 상태', '일자', '송수신처', '내용확인·Diff'], postMailRows, '') +
      '<div class="sec">' +
      '<span>📎 후속 협의록 · 노사 상생협약서 · 완료계 증빙 직접 첨부 분석</span>' +
      '<select id="postUploadKind" aria-label="후속자료 서류 종류">' + postDkOptions + '</select>' +
      '</div>' +
      '<div class="drop-zone" id="postDropZone" tabindex="0" role="button" aria-label="후속자료 파일 선택 또는 끌어놓기">' +
      '<b>📂 전환 대상 직무·인원 피드백, 교육훈련 계획, 노사 상생협약서, 완료계/회차 서명지를 끌어다 놓으세요</b>' +
      '<span>전환직무 · 목표인원 · 훈련과정 · 상생합의 골자 · 연계지원금을 자동 추출하여 최종 결과보고서 및 완료계(.hwpx)에 반영합니다</span>' +
      '<input type="file" id="postFileInput" multiple accept=".xlsx,.xls,.csv,.hwpx,.hwp,.docx,.pdf,.txt,.jpg,.jpeg,.png" style="display:none">' +
      '</div>' +
      (postCards.length ? renderTable('postCards', ['후속자료 제목', '분류', '추출된 합의·전환 계획 요약', '분석시각', '보기'], postCardRows, '') : '') +
      '</div>' +

      '<div class="card">' +
      '<div class="sec">' +
      '<span>🔄 중간보고 기준선 대비 후속 협의·확정 내역 (Diff 대조표)</span>' +
      '<span class="sp"></span>' +
      '<button class="sm pri" data-act="add-diff">+ 합의사항 추가</button>' +
      '</div>' +
      renderTable('diffRows', ['협의 항목', '상태', '중간보고 기준선', '최종 확정 설계안', '편집'], diffTableRows, '') +
      '</div>' +

      '<div class="card">' +
      '<div class="sec">' +
      '<span>📦 ' + esc(ag.short) + ' 제출 산출물 5종 허브 (한글 .hwpx · 푸른한글 직접편집 · PDF 인쇄 · 별첨 XLSX)</span>' +
      '<span class="sp"></span>' +
      '<button class="sm pri" data-act="dl-full-zip">📦 5종 통합 ZIP 다운로드</button>' +
      '</div>' +
      renderTable('deliverables', ['산출물 파일명', '형식', '기관 맞춤 수록 내용', '미리보기 · 푸른한글 · 다운로드'], delivRows, '') +
      '</div>' +

      '<div class="report-workbench" style="margin-bottom:12px">' +
      '<div class="card" style="margin-bottom:0">' +
      '<div class="bar">' +
      '<button class="sm pri" data-act="regen-final" title="중간보고 기준선 + 후속 메일 Diff → 기관 맞춤 최종결과보고서 자동 조립">⚡ 결과보고 조립</button>' +
      '<button class="sm" data-act="preview-final">👁️ 큰창 미리보기</button>' +
      '<button class="sm ok" data-act="dl-final-hwpx">📥 결과 .hwpx 다운로드</button>' +
      '<button class="sm pri" data-act="open-final-hangul">📝 푸른한글에서 열기</button>' +
      '<button class="sm" data-act="print-final">🖨 PDF 인쇄</button>' +
      '<button class="sm warn-btn" data-act="open-sub-modal">📋 완료계·일지 문안</button>' +
      '<span class="sp"></span>' +
      '<button class="sm ok" data-act="confirm-final-snapshot">📌 최종 확정</button>' +
      '</div>' +
      renderSectionList('finalSecs', ag.short + ' (' + tr.short + ') 전용 8개 장 원고 (우측에서 ' + ag.short + ' 공식 양식·검수표 실시간 대조)', finSchema, secs, locks, 'final', ag.code === 'cepa' ? 'c-green' : 'c-blue') +
      '</div>' +
      '<div class="report-side-sticky" id="finalSideWorkbench">' +
      renderReportSideWorkbenchHtml(proj, 'final', Object.assign({}, computedFinal, { sections: secs }), computedMid, Object.assign({}, computedFinal, { sections: secs }), schedRds) +
      '</div>' +
      '</div>' +

      '<div class="card">' +
      '<div class="sec">' +
      '<span>🛡️ ' + esc(ag.code === 'cepa' ? '충남경제진흥원 완료계 제출 및 장려금·사후관리 점검표' : 'KMAC 완료보고 및 구조혁신 정책매니저 사후관리 점검표') + '</span>' +
      '<div class="prog-wrap"><div class="prog-fill" style="width:' + fuPct + '%"></div></div>' +
      '<b>' + fuPct + '% (' + fuDoneCnt + '/' + fuList.length + ')</b>' +
      '<span class="sp"></span>' +
      '<button class="sm ok" data-act="dl-comp-hwpx">📥 ' + esc(ag.code === 'cepa' ? '완료계 .hwpx' : '완료보고서 .hwpx') + '</button>' +
      '</div>' +
      renderTable('followups', ['단계 · 사후 이행 점검 항목', '상태', '필수 구비 증빙', '체크'], fuRows, '') +
      '</div>';

    wireDropZone('postDropZone', 'postFileInput', 'postUploadKind', 'post_mid');
  }

  /* ── 탭 5: ⚖️ 소속기관별(KMAC vs CEPA) 보고서 양식 분리 검토 & 일터상생 구분 대조 ── */
  function buildAgencyFormSpecCardHtml(agencyCode, agencyProjs) {
    var isCepa = agencyCode === 'cepa';
    var spec = Cat().getAgencyFormSpec ? Cat().getAgencyFormSpec(agencyCode) : null;
    if (!spec) return '';
    var midToc = Cat().getMidSections(agencyCode).map(function (s) { return s.part + ' ' + s.title; }).join(' / ');
    var finToc = Cat().getFinalSections(agencyCode, isCepa ? 'cepa_coal' : 'kmac_std').map(function (s) { return s.part; }).join(' · ');

    var projRows = agencyProjs.map(function (p) {
      var tr = Cat().getTrack(p.track, p.agency);
      var pm = projectParallelMeta(p);
      var schedRds = schedRoundsForProject(p);
      var midObj = Report().buildMidReport(p, D.intake[p.id] || {}, schedRds, D.mid[p.id] || null);
      var finObj = Report().buildFinalReport(p, midObj, D.intake[p.id] || {}, schedRds, D.final[p.id] || null);
      var midRev = Report().evaluateReportFormReview(p, 'mid', midObj, D.intake[p.id] || {}, schedRds);
      var finRev = Report().evaluateReportFormReview(p, 'final', finObj, D.intake[p.id] || {}, schedRds);
      var cChip = pm.contractNo ? (' <span class="chip ' + (isCepa ? 'c-green' : 'c-blue') + '">' + esc(pm.contractNo) + '</span>') : '';
      return {
        id: p.id,
        cells: [
          { cls: 'ti wide', title: p.companyName, html: esc(p.companyName) + ' <span class="chip">' + esc((p.year || 2026) + '년') + '</span>' + cChip },
          { k: 'badge', html: '<span class="chip ' + (isCepa ? 'c-green' : 'c-blue') + '">' + esc(tr.short) + '</span>' },
          { html: '<span class="chip ' + (midRev.allPassed ? 'c-green' : 'c-amber') + '">중간 ' + midRev.passCount + '/' + midRev.totalCount + '</span> <span class="chip ' + (finRev.allPassed ? 'c-green' : 'c-amber') + '">최종 ' + finRev.passCount + '/' + finRev.totalCount + '</span>' },
          {
            k: 'act',
            html: '<button class="sm" data-open-proj="' + esc(p.id) + '" data-open-tab="mid">② 중간양식 검토</button>' +
              '<button class="sm pri" data-open-proj="' + esc(p.id) + '" data-open-tab="final">③ ' + (isCepa ? '결과·완료계 검토' : '최종·정책매니저 검토') + '</button>'
          }
        ]
      };
    });

    return '<div class="agency-col-card ' + (isCepa ? 'cepa' : 'kmac') + '">' +
      '<div class="agency-col-hd">' +
      '<span>' + (isCepa ? '🟢 ' : '🔵 ') + esc(spec.agencyName) + ' — ' + esc(spec.programTitle) + '</span>' +
      '<span class="chip ' + (isCepa ? 'c-green' : 'c-blue') + '">' + esc(spec.erpTypeCode) + ' · ' + agencyProjs.length + '개사</span>' +
      '</div>' +
      '<div class="agency-col-sub">' +
      '<span><b>주관·운영:</b> ' + esc(spec.supervisingBody) + '</span>' +
      '<span>|</span>' +
      '<span><b>제출 경로:</b> ' + esc(spec.platformName) + '</span>' +
      '</div>' +
      '<div class="sec"><span>📑 ' + esc(spec.agencyName) + ' 전용 제출 서식 체계 (타 기관 양식과 혼용 불가)</span></div>' +
      '<ol class="form-step-list">' +
      spec.deliverableSteps.map(function (st) { return '<li>' + esc(st) + '</li>'; }).join('') +
      '</ol>' +
      '<div class="sec"><span>📐 전용 목차 구조</span><span class="hint" title="' + esc(midToc) + '">최종 8장: ' + esc(finToc) + '</span></div>' +
      '<div class="sec"><span>✅ ' + esc(spec.agencyName) + ' 소속 사업장별 양식 검수 현황 (' + agencyProjs.length + '개사)</span></div>' +
      renderTable(isCepa ? 'formReviewCepa' : 'formReviewKmac',
        ['사업장명 · 계약코드', '세부트랙', '중간·최종 검수', '분리 양식 검토 열기'],
        projRows, CUR_PID) +
      '</div>';
  }

  function drawFormsPane(projs) {
    var box = $('formsBox');
    if (!box) return;
    var list = Array.isArray(projs) ? projs : activeProjects();
    var kmacList = list.filter(function (p) { return p.agency !== 'cepa'; });
    var cepaList = list.filter(function (p) { return p.agency === 'cepa'; });

    var gridHtml = '';
    if (AGENCY_SCOPE === 'kmac') {
      gridHtml = '<div class="form-compare-grid" style="grid-template-columns:minmax(0,1fr)">' + buildAgencyFormSpecCardHtml('kmac', kmacList) + '</div>';
    } else if (AGENCY_SCOPE === 'cepa') {
      gridHtml = '<div class="form-compare-grid" style="grid-template-columns:minmax(0,1fr)">' + buildAgencyFormSpecCardHtml('cepa', cepaList) + '</div>';
    } else {
      gridHtml = '<div class="form-compare-grid">' +
        buildAgencyFormSpecCardHtml('kmac', kmacList) +
        buildAgencyFormSpecCardHtml('cepa', cepaList) +
        '</div>';
    }

    var sepTableHtml =
      '<div class="card">' +
      '<div class="sec"><span>🚫 산업·일자리전환(KMAC vs CEPA) 및 타 컨설팅(일터혁신 상생컨설팅) 엄격 구분 기준표</span></div>' +
      '<div class="scroll" style="padding:10px 12px">' +
      '<table class="pv-tbl">' +
      '<thead><tr><th>구분 기준</th><th>🔵 한국능률협회컨설팅 (KMAC)</th><th>🟢 충남경제진흥원 (CEPA)</th><th>🚫 일터혁신 상생컨설팅 (원천 제외)</th></tr></thead>' +
      '<tbody>' +
      '<tr><td><b>공식 사업명</b></td><td>구조혁신지원사업 (산업·일자리전환 컨설팅)</td><td>충남 산업일자리전환지원센터 진단·전문컨설팅</td><td>일터혁신 상생컨설팅 (일터상생혁신)</td></tr>' +
      '<tr><td><b>주관 · 운영기관</b></td><td>중진공 · 한국능률협회컨설팅(KMAC)</td><td>충청남도 · 고용노동부 · 충남경제진흥원</td><td>노사발전재단 · 에프엠어소시에이션</td></tr>' +
      '<tr><td><b>ERP 계약코드</b></td><td><b>산일능률-YYYY-NNN</b></td><td><b>산일충남-YYYY-NNN</b></td><td>일터상생-YYYY-NNN (본 화면 배제)</td></tr>' +
      '<tr><td><b>핵심 보고서 양식</b></td><td>착수PPT(1MD) → 중간 7장 → 2026년형 결과보고서 8장</td><td>지원신청서 → 월별실적 → 중간 7장 → 지원센터 결과보고서 8장</td><td>참여안내서 → 디자인팀 회의 → 통합진단보고서 PPT</td></tr>' +
      '<tr><td><b>완료 · 사후관리 서식</b></td><td>완료보고서(요약) · 수행실적증명서 · <b>정책매니저 보고서</b></td><td><b>산업일자리 전환 완료계(갑지 대표자 날인)</b> · 사후관리 결과보고서</td><td>이행관리 등록 · 이행결과표</td></tr>' +
      '<tr><td><b>필수 인정·검수 기준</b></td><td>KPI 4개+(필수2·선택2) · 지원사업 2개+(전환지원금 필수) · 대면 75%+</td><td>석탄화력 폐지/미래차 공급망 진단 · 대면 80%+ · 충남 장려금 연계</td><td>본 화면 수집·메일·양식에서 100% 자동 차단</td></tr>' +
      '</tbody></table></div></div>';

    box.innerHTML =
      '<div class="note"><b>소속기관별 양식 완전 분리 원칙:</b> 한국능률협회컨설팅(KMAC · 구조혁신 산일능률)과 충남경제진흥원(CEPA · 충남산일지원센터 산일충남)은 보고서 목차·검수기준·완료서식(정책매니저 vs 완료계)이 완전히 다르므로 별도 양식으로 분리 검토하며, 일터혁신 상생컨설팅(일터상생) 및 석유화학 노동전환 자료는 중복되지 않도록 원천 배제합니다.</div>' +
      gridHtml +
      sepTableHtml;
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
    if (proj && proj.companyName) list.push({ v: proj.companyName, as: '[참여기업]' });
    if (proj && proj.ceoName) list.push({ v: proj.ceoName, as: '[대표자]' });
    if (proj && proj.contactName) list.push({ v: proj.contactName, as: '[담당자]' });
    return list;
  }

  function sanitizeMetaLabel(rawVal, proj) {
    var s = str(rawVal);
    if (!s) return '';
    var masked = Intake().maskPiiStrict(s, projectNamesList(proj));
    var txt = masked.text;
    if (Intake().hasResidualPii(txt)) txt = Intake().maskPiiStrict(txt, []).text;
    var corpBack = (proj && proj.companyName) ? [{ as: '[참여기업]', v: str(proj.companyName) }] : [];
    return Intake().unmaskNames(txt, corpBack);
  }

  function contactNameOfCompany(co) {
    if (!co || typeof co !== 'object') return '';
    if (str(co.contactName || co.manager || co.managerName)) return str(co.contactName || co.manager || co.managerName);
    if (Array.isArray(co.contacts) && co.contacts.length && co.contacts[0]) return str(co.contacts[0].name);
    return '';
  }

  async function handleLocalFiles(fileList, forcedDocKind, phase) {
    var reqEpoch = SESSION_EPOCH;
    var reqUid = ME && ME.uid ? String(ME.uid) : '';
    if (!isSessionCurrent(reqEpoch, reqUid)) return;
    var proj = projectById(CUR_PID);
    if (!proj) return;
    var files = Array.prototype.slice.call(fileList || []);
    var okCnt = 0;
    toast('파일 ' + files.length + '건 로컬 비식별 분석 중…');

    for (var i = 0; i < files.length; i++) {
      if (!isSessionCurrent(reqEpoch, reqUid)) return;
      var f = files[i];
      var safeTitle = sanitizeMetaLabel(f.name, proj);
      try {
        if (Intake().hasResidualPii(safeTitle)) {
          throw new Error('파일명에 해제되지 않은 민감 식별정보 패턴이 포함되어 차단했습니다.');
        }
        var buf = await f.arrayBuffer();
        if (!isSessionCurrent(reqEpoch, reqUid)) return;
        var bytes = new Uint8Array(buf);
        var analyzed = await analyzeAttachmentBytes(f.name, bytes, proj, forcedDocKind, phase);
        if (!isSessionCurrent(reqEpoch, reqUid)) return;
        if (analyzed) {
          var savedUp = await saveIntakeCard(proj, Object.assign({
            source: 'upload',
            title: safeTitle,
            attNames: [safeTitle],
            phase: phase,
            checkedAt: Date.now(),
            analyzedAt: Date.now()
          }, analyzed), reqEpoch, reqUid);
          if (!isSessionCurrent(reqEpoch, reqUid)) return;
          if (savedUp) okCnt++;
        }
      } catch (e) {
        if (!isSessionCurrent(reqEpoch, reqUid)) return;
        toast('파일 분석 오류 (' + safeTitle + '): ' + (e.message || e));
      }
    }
    if (!isSessionCurrent(reqEpoch, reqUid)) return;
    rebuildScanAndDiscover();
    draw();
    if (okCnt > 0) toast(okCnt + '건 비식별 분석 및 카드 반영 완료');
  }

  async function analyzeAttachmentBytes(fileName, bytes, proj, forcedDocKind, phase) {
    var lower = str(fileName).toLowerCase();
    var explicitDk = forcedDocKind ? Cat().getDocKind(forcedDocKind) : null;
    var safeFileName = sanitizeMetaLabel(fileName, proj);
    if (Intake().hasResidualPii(safeFileName)) {
      throw new Error('파일명에 민감 고유식별정보 잔존 패턴이 감지되어 차단했습니다.');
    }

    if (/\.(jpg|jpeg|png|webp)$/.test(lower)) {
      var diffMeta = Intake().extractPostMidDiff('현장 사진 및 회의 증빙 확인', safeFileName, [safeFileName]);
      return {
        docKind: forcedDocKind || 'round_log',
        track: 'meta',
        piiStripped: true,
        maskedExcerpt: '',
        stats: null,
        policyIssues: [],
        postDiff: phase === 'post_mid' ? diffMeta : null,
        summaryLines: ['회차 수행 현장사진 증빙 확인 (' + safeFileName + ')']
      };
    }

    var excelTextFallback = '';
    var resolvedNonQuantKind = explicitDk ? explicitDk.code : '';
    if (/\.(xlsx|xls|csv)$/.test(lower)) {
      await ensureJobtransLibs({ xlsx: true });
    }
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
        var tabRes = Intake().analyzeTabularRows(sheetMap, explicitDk ? explicitDk.code : '', {
          workerCount: proj.workerCount,
          baseYear: proj.year || 2026,
          fileName: safeFileName
        });
        if (tabRes && tabRes.ok) {
          if (Intake().hasResidualPii(JSON.stringify({ stats: tabRes.stats, summaryLines: tabRes.summaryLines }))) {
            throw new Error('정량 통계 결과에 해제되지 않은 개인정보 패턴이 감지되어 차단했습니다.');
          }
          return {
            docKind: tabRes.docKind,
            track: 'quant',
            piiStripped: true,
            maskedExcerpt: '',
            stats: tabRes.stats,
            policyIssues: [],
            postDiff: null,
            summaryLines: tabRes.summaryLines || []
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
    var txtRes = Intake().sanitizeAndAnalyzeText(rawText, {
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
    if (global.PuKordocText && typeof global.PuKordocText.read === 'function' && /\.(hwpx|hwp|docx)$/.test(lower)) {
      try {
        var kr = await global.PuKordocText.read(bytes);
        if (kr && kr.text) return kr.text;
      } catch (e) {}
    }
    if (/\.hwpx$/.test(lower) && global.PureunHwpx && typeof global.PureunHwpx.readHwpx === 'function') {
      try {
        var parsed = global.PureunHwpx.readHwpx(bytes);
        if (parsed && Array.isArray(parsed.blocks)) {
          return parsed.blocks.map(function (b) {
            if (b.type === 'p') return (b.runs || []).map(function (r) { return r.text || ''; }).join('');
            if (b.type === 'table') {
              return (b.grid || []).map(function (row) {
                return (row || []).map(function (c) {
                  return c && c.paras ? c.paras.map(function (p) {
                    return (p.runs || []).map(function (r) { return r.text || ''; }).join('');
                  }).join(' ') : '';
                }).join(' ');
              }).join('\n');
            }
            return '';
          }).filter(Boolean).join('\n');
        }
      } catch (e) {}
    }
    if (/\.hwp$/.test(lower)) {
      await ensureJobtransLibs({ hwp: true });
    }
    if (/\.pdf$/.test(lower)) {
      await ensureJobtransLibs({ pdf: true });
    }
    if (/\.hwp$/.test(lower) && global.PureunHwp && typeof global.PureunHwp.extractText === 'function') {
      try { return await global.PureunHwp.extractText(bytes); } catch (e) {}
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
  async function callMailFn(fnName, payload, optEpoch, optUid) {
    if (optEpoch != null && !isSessionCurrent(optEpoch, optUid)) throw new Error('SESSION_CHANGED');
    var u = fb && fb.auth && fb.auth().currentUser;
    if (!u || (optUid && String(u.uid) !== String(optUid))) throw new Error('로그인이 필요합니다.');
    var tok = await u.getIdToken();
    if (optEpoch != null && !isSessionCurrent(optEpoch, optUid)) throw new Error('SESSION_CHANGED');
    var res = await fetch(MAIL_FN_BASE + fnName, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok },
      body: JSON.stringify(payload || {})
    });
    var j = await res.json().catch(function () { return null; });
    if (optEpoch != null && !isSessionCurrent(optEpoch, optUid)) throw new Error('SESSION_CHANGED');
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

  async function inspectAndAnalyzeMail(mailKey, phase, silent, optEpoch, optUid) {
    var reqEpoch = optEpoch != null ? optEpoch : SESSION_EPOCH;
    var reqUid = optUid != null ? String(optUid) : (ME && ME.uid ? String(ME.uid) : '');
    if (!isSessionCurrent(reqEpoch, reqUid)) return;
    var proj = projectById(CUR_PID);
    if (!proj) return;
    var m = findMailRowByKey(proj.id, mailKey);
    if (!m) { toast('메일 정보를 찾을 수 없습니다.'); return; }

    if (!silent) toast('메일 본문·첨부 내용 확인 중 (peek 모드)…');
    var bodyPlain = '';
    var attSummaries = [];
    var attErrors = [];
    var mergedStats = null, mergedIssues = [], mergedDiff = null, finalDocKind = m.docKind;
    var attLeakBlocked = false;

    try {
      var mCacheKey = 'imap:' + String(m.slug) + ':' + String(m.uid);
      var msg = MAIL_VIEW_CACHE[mCacheKey];
      if (!msg) {
        msg = await callMailFn('readMailMessage', { slug: m.slug, uid: m.uid, peek: 1 }, reqEpoch, reqUid);
        if (msg && isSessionCurrent(reqEpoch, reqUid)) MAIL_VIEW_CACHE[mCacheKey] = msg;
      }
      if (!isSessionCurrent(reqEpoch, reqUid)) return;
      bodyPlain = str(msg.text) || htmlToPlainText(msg.html);
      var atts = Array.isArray(msg.atts) ? msg.atts : [];

      for (var i = 0; i < Math.min(atts.length, 6); i++) {
        if (!isSessionCurrent(reqEpoch, reqUid)) return;
        var a = atts[i];
        var aName = str(a && a.name);
        if (!aName || Number(a.size || 0) > 15 * 1024 * 1024) continue;
        try {
          var got = await callMailFn('readMailAttachment', {
            slug: m.slug,
            uid: m.uid,
            index: a.i == null ? i : a.i,
            part: a.part || ''
          }, reqEpoch, reqUid);
          if (!isSessionCurrent(reqEpoch, reqUid)) return;
          if (got && got.b64 && global.PuRulesMailOrig) {
            var bytes = global.PuRulesMailOrig.b64ToBytes(got.b64);
            var attRes = await analyzeAttachmentBytes(aName, bytes, proj, '', phase);
            if (!isSessionCurrent(reqEpoch, reqUid)) return;
            if (attRes) {
              finalDocKind = attRes.docKind || finalDocKind;
              if (attRes.stats) mergedStats = attRes.stats;
              if (attRes.policyIssues && attRes.policyIssues.length) mergedIssues = mergedIssues.concat(attRes.policyIssues);
              if (attRes.postDiff) mergedDiff = attRes.postDiff;
              attSummaries = attSummaries.concat(attRes.summaryLines || []);
            }
          }
        } catch (attErr) {
          if (!isSessionCurrent(reqEpoch, reqUid)) return;
          var errMsg = String((attErr && attErr.message) || attErr || '');
          if (/잔존 패턴/.test(errMsg)) attLeakBlocked = true;
          attErrors.push(sanitizeMetaLabel(aName, proj) + ': ' + errMsg);
        }
      }
    } catch (mailErr) {
      if (!isSessionCurrent(reqEpoch, reqUid)) return;
      bodyPlain = m.subject + '\n' + (m.attNames || []).join('\n');
    }

    if (!isSessionCurrent(reqEpoch, reqUid)) return;
    var safeSubjTitle = sanitizeMetaLabel(m.subject || m.docKindName, proj);
    var safeAttList = (m.attNames || []).map(function (n) { return sanitizeMetaLabel(n, proj); });

    var bodyRes = Intake().sanitizeAndAnalyzeText(bodyPlain, {
      companyName: proj.companyName,
      ceoName: proj.ceoName,
      contactName: proj.contactName,
      docKind: finalDocKind,
      phase: phase,
      midConfirmedAt: proj.midConfirmedAt,
      subject: safeSubjTitle,
      attNames: safeAttList
    });

    if (bodyRes.leakBlocked || attLeakBlocked || Intake().hasResidualPii(safeSubjTitle) || safeAttList.some(Intake().hasResidualPii)) {
      toast('⚠ 민감 고유식별정보 잔존 패턴이 감지되어 자동 저장을 차단했습니다.');
      return;
    }

    if (attErrors.length && !attSummaries.length && !mergedStats) {
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
      phase: phase,
      docKind: finalDocKind || bodyRes.docKind,
      track: mergedStats ? 'quant' : bodyRes.track,
      piiStripped: true,
      maskedExcerpt: bodyRes.maskedExcerpt,
      stats: mergedStats || null,
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
        var updatedMailProj = await saveProjectRecord(Object.assign({}, proj, { contactEmails: nextEmails }), reqEpoch, reqUid);
        if (!updatedMailProj || !isSessionCurrent(reqEpoch, reqUid)) return;
      }
    }

    if (!isSessionCurrent(reqEpoch, reqUid)) return;
    var savedCard = await saveIntakeCard(proj, cardPayload, reqEpoch, reqUid);
    if (!savedCard || !isSessionCurrent(reqEpoch, reqUid)) return;
    rebuildScanAndDiscover();
    draw();
    if (!silent && savedCard) openCardDetailModal(savedCard);
  }

  function buildCheckedMailCardPayload(proj, mailKey, phase) {
    var m = findMailRowByKey(proj.id, mailKey);
    if (!m) return null;
    var cardId = 'mail_' + safeKey(m.key);
    var prev = (D.intake[proj.id] && D.intake[proj.id][cardId]) || null;
    var safeSubjTitle = sanitizeMetaLabel(m.subject || m.docKindName, proj);
    var safeAttList = (m.attNames || []).map(function (n) { return sanitizeMetaLabel(n, proj); });
    if (Intake().hasResidualPii(safeSubjTitle) || safeAttList.some(Intake().hasResidualPii)) {
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

  async function markMailCheckedOnly(mailKey, phase, optEpoch, optUid) {
    var reqEpoch = optEpoch != null ? optEpoch : SESSION_EPOCH;
    var reqUid = optUid != null ? String(optUid) : (ME && ME.uid ? String(ME.uid) : '');
    if (!isSessionCurrent(reqEpoch, reqUid)) return null;
    var proj = projectById(CUR_PID);
    if (!proj) return null;
    var built = buildCheckedMailCardPayload(proj, mailKey, phase);
    if (!built) {
      toast('⚠ 메일 제목·첨부명에 민감 식별정보 패턴이 남아 있어 저장을 차단했습니다.');
      return null;
    }
    var saved = await saveIntakeCard(proj, built.record, reqEpoch, reqUid);
    if (!saved || !isSessionCurrent(reqEpoch, reqUid)) return null;
    rebuildScanAndDiscover();
    draw();
    return saved;
  }

  /* ══ 5. 온톨로지 강제 관문(gate) 및 세션 바인딩 원자적 저장 함수들 (scal_jobtrans) ═══ */
  function captureCurrentSession() {
    var ep = SESSION_EPOCH;
    var uid = ME && ME.uid ? String(ME.uid) : '';
    var sid = ME && ME.sid ? String(ME.sid) : '';
    if (!ep || !uid || !sid || !isSessionCurrent(ep, uid)) return null;
    return { epoch: ep, uid: uid, sid: sid };
  }

  function resolveWriteSession(reqEpoch, reqUid) {
    if (!reqEpoch || !reqUid) return null;
    var ep = reqEpoch;
    var uid = String(reqUid);
    var g = gate;
    var sid = ME && ME.sid ? String(ME.sid) : '';
    if (!g || !fbDb || !sid || !isSessionCurrent(ep, uid)) return null;
    return { epoch: ep, uid: uid, gate: g, sid: sid };
  }

  async function atomicMultiRecordUpdate(entries, optEpoch, optUid) {
    if (!entries || !entries.length) return null;
    var ws = resolveWriteSession(optEpoch, optUid);
    if (!ws) return null;
    var rootRef = fbDb.ref();
    if (rootRef && typeof rootRef.update === 'function' && global.PuOntologyWrite) {
      var batch = {};
      for (var i = 0; i < entries.length; i++) {
        var e = entries[i];
        var prepared = e.tombstone
          ? global.PuOntologyWrite.tombstone(e.previous, { actor: ws.sid, entityType: e.entityType })
          : ws.gate.prepare(e.record, { previous: e.previous || null, entityType: e.entityType });
        if (!prepared || !prepared.ok) {
          throw new Error((prepared && prepared.issues && prepared.issues[0] && prepared.issues[0].message) || '온톨로지 검증 실패');
        }
        batch[e.path] = stripUndef(prepared.value);
      }
      if (!isSessionCurrent(ws.epoch, ws.uid)) return null;
      await rootRef.update(batch);
      if (!isSessionCurrent(ws.epoch, ws.uid)) return null;
      return batch;
    }
    var fallbackOut = {};
    for (var j = 0; j < entries.length; j++) {
      if (!isSessionCurrent(ws.epoch, ws.uid)) return null;
      var it = entries[j];
      if (it.tombstone) {
        var rmRes = await ws.gate.remove(fbDb.ref(it.path), it.previous, { entityType: it.entityType });
        if (!isSessionCurrent(ws.epoch, ws.uid)) return null;
        fallbackOut[it.path] = rmRes && rmRes.snapshot ? rmRes.snapshot.val() : null;
      } else {
        var svRes = await ws.gate.save(fbDb.ref(it.path), it.record, { entityType: it.entityType });
        if (!isSessionCurrent(ws.epoch, ws.uid)) return null;
        fallbackOut[it.path] = svRes && svRes.snapshot ? svRes.snapshot.val() : null;
      }
    }
    return fallbackOut;
  }

  async function saveProjectRecord(projInput, optEpoch, optUid) {
    var ws = resolveWriteSession(optEpoch, optUid);
    if (!ws) return null;
    var id = str(projInput.id) || ('jt_' + Date.now().toString(36));
    if (!str(projInput.companyId)) {
      throw new Error('거래처(companyId)를 선택해야 등록할 수 있습니다(상호 텍스트 단독 저장 불가).');
    }
    var piiCheckFields = [
      projInput.companyName,
      projInput.industry,
      projInput.mainProduct,
      projInput.transGoal,
      projInput.consultantName,
      projInput.folderBoundaryHash,
      projInput.interviews ? JSON.stringify(projInput.interviews) : ''
    ];
    if (piiCheckFields.some(function (f) { return f && Intake().hasResidualPii(String(f)); })) {
      throw new Error('프로젝트 메타데이터에 해제되지 않은 민감 식별정보 패턴이 감지되어 저장을 차단했습니다.');
    }
    var ag = Cat().getAgency(projInput.agency);
    var tr = Cat().getTrack(projInput.track, ag.code);
    var ref = fbDb.ref('scal_jobtrans/projects/' + id);
    var res = await ws.gate.save(ref, function (prev) {
      var merged = Object.assign({}, prev || {}, projInput, {
        id: id,
        entityType: 'Project',
        agency: ag.code,
        track: tr.code,
        companyId: str(projInput.companyId),
        companyName: str(projInput.companyName)
      });
      delete merged.folderBoundaryId;
      return stripUndef(merged);
    }, { entityType: 'Project' });
    if (!isSessionCurrent(ws.epoch, ws.uid)) return null;
    var val = res && res.snapshot ? res.snapshot.val() : null;
    if (val) D.projects[id] = val;
    return val;
  }

  async function saveIntakeCard(proj, cardInput, optEpoch, optUid) {
    if (!proj) return null;
    var ws = resolveWriteSession(optEpoch, optUid);
    if (!ws) return null;
    var checkBlob = JSON.stringify({
      title: cardInput && cardInput.title,
      maskedExcerpt: cardInput && cardInput.maskedExcerpt,
      stats: cardInput && cardInput.stats,
      policyIssues: cardInput && cardInput.policyIssues,
      postDiff: cardInput && cardInput.postDiff,
      summaryLines: cardInput && cardInput.summaryLines
    });
    if (Intake().hasResidualPii(checkBlob)) {
      throw new Error('분석카드 저장 직전 개인정보 잔존 패턴이 감지되어 저장을 차단했습니다.');
    }
    var cid = str(cardInput.id) || ('in_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6));
    var ref = fbDb.ref('scal_jobtrans/intake/' + proj.id + '/' + cid);
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

  async function saveMidDoc(proj, sections, locks, optEpoch, optUid) {
    var ws = resolveWriteSession(optEpoch, optUid);
    if (!ws) return null;
    var ref = fbDb.ref('scal_jobtrans/mid/' + proj.id);
    var res = await ws.gate.save(ref, function (prev) {
      return stripUndef(Object.assign({}, prev || {}, {
        id: proj.id,
        projectId: proj.id,
        entityType: 'Document',
        agency: proj.agency || 'kmac',
        track: proj.track || 'kmac_std',
        companyId: str(proj.companyId),
        companyName: str(proj.companyName),
        sections: sections,
        locks: locks || {}
      }));
    }, { entityType: 'Document' });
    if (!isSessionCurrent(ws.epoch, ws.uid)) return null;
    var val = res && res.snapshot ? res.snapshot.val() : null;
    if (val) D.mid[proj.id] = val;
    return val;
  }

  async function saveFinalDoc(proj, sections, locks, optEpoch, optUid) {
    var ws = resolveWriteSession(optEpoch, optUid);
    if (!ws) return null;
    var ref = fbDb.ref('scal_jobtrans/final/' + proj.id);
    var res = await ws.gate.save(ref, function (prev) {
      return stripUndef(Object.assign({}, prev || {}, {
        id: proj.id,
        projectId: proj.id,
        entityType: 'Document',
        agency: proj.agency || 'kmac',
        track: proj.track || 'kmac_std',
        companyId: str(proj.companyId),
        companyName: str(proj.companyName),
        sections: sections,
        locks: locks || {}
      }));
    }, { entityType: 'Document' });
    if (!isSessionCurrent(ws.epoch, ws.uid)) return null;
    var val = res && res.snapshot ? res.snapshot.val() : null;
    if (val) D.final[proj.id] = val;
    return val;
  }

  async function saveImmutableSnapshot(proj, snapObj, optEpoch, optUid) {
    var ws = resolveWriteSession(optEpoch, optUid);
    if (!ws) return null;
    var sid = str(snapObj.id) || ('snap_' + Date.now());
    var ref = fbDb.ref('scal_jobtrans/snapshots/' + proj.id + '/' + sid);
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

  /* ══ 6. 모달 창 (사업장 등록 · 기관/트랙/과제 설정 · 회차 편집 · Diff 편집 · 웹 A4 미리보기 · 제출문안 · AI 윤문) ═ */
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

  function buildTrackOptionsHtml(agencyCode, selectedTrack) {
    return Cat().tracksForAgency(agencyCode).map(function (t) {
      return '<option value="' + esc(t.code) + '"' + (t.code === selectedTrack ? ' selected' : '') + '>' + esc(t.name) + '</option>';
    }).join('');
  }

  function openNewProjectModal() {
    var coOpts = '<option value="">-- 기업정보함(data/companies) 거래처 선택 --</option>' +
      '<option value="__biz__">➕ 기업정보함 미등록 컨설팅 전용 사업장 (사업자등록번호 10자리 기준)</option>' +
      D.companies.slice().sort(function (a, b) { return str(a.name).localeCompare(str(b.name), 'ko'); })
        .map(function (c) {
          return '<option value="' + esc(c.id) + '">' + esc(str(c.name) + (c.bizNo ? ' (' + c.bizNo + ')' : '')) + '</option>';
        }).join('');

    var agOpts = Object.keys(Cat().AGENCIES).map(function (k) {
      var ag = Cat().AGENCIES[k];
      return '<option value="' + esc(ag.code) + '">' + esc(ag.name + ' (' + ag.organizer + ')') + '</option>';
    }).join('');

    var body =
      '<div class="fr"><label for="npCo">대상 거래처*</label><div class="fv"><select id="npCo">' + coOpts + '</select></div></div>' +
      '<div class="fr" id="npDirectRow" style="display:none"><label for="npDirectName">상호 / 사업자번호*</label><div class="fv">' +
      '<input type="text" id="npDirectName" placeholder="컨설팅 사업장 정식 상호 (필수)">' +
      '<input type="text" id="npDirectBiz" placeholder="사업자등록번호 10자리 (예: 123-81-20007)">' +
      '</div></div>' +
      '<div class="fr"><label for="npAgency">운영기관 / 트랙*</label><div class="fv">' +
      '<select id="npAgency">' + agOpts + '</select>' +
      '<select id="npTrack">' + buildTrackOptionsHtml('kmac', 'kmac_std') + '</select>' +
      '</div></div>' +
      '<div class="fr"><label for="npYear">사업연도 / 근로자수</label><div class="fv">' +
      '<select id="npYear"><option value="2026" selected>2026년</option><option value="2025">2025년</option><option value="2024">2024년</option></select>' +
      '<input type="text" id="npIndustry" placeholder="업종 (예: 자동차부품 제조업)">' +
      '<input type="number" id="npWorkers" placeholder="상시근로자 수" style="max-width:130px">' +
      '</div></div>' +
      '<div class="fr"><label for="npMainProd">주력품목 / 전환목표</label><div class="fv">' +
      '<input type="text" id="npMainProd" placeholder="현 주력품목 (예: 내연기관 엔진부품)">' +
      '<input type="text" id="npTransGoal" placeholder="전환 목표 (예: 친환경 미래차 전동화 부품)">' +
      '</div></div>' +
      '<div class="fr"><label for="npEmail">담당자 이메일</label><div class="fv"><input type="email" id="npEmail" placeholder="푸른메일함 수신 자동 감지용 이메일 (쉼표로 복수 입력 가능)"></div></div>' +
      '<div class="fr"><label for="npCons">전담 컨설턴트</label><div class="fv"><input type="text" id="npCons" value="' + esc(ME.name ? ME.name + ' 공인노무사' : '푸른노무법인 전담 공인노무사') + '"></div></div>';

    var foot = '<button class="sm" data-close-modal="1">취소</button><button class="sm pri" id="npSaveBtn">워크스페이스 개설</button>';
    openModal('➕ 산업·일자리전환 컨설팅 사업장 등록', body, foot, 'wide');

    if ($('npAgency')) {
      $('npAgency').onchange = function () {
        var agCode = $('npAgency').value;
        if ($('npTrack')) $('npTrack').innerHTML = buildTrackOptionsHtml(agCode, agCode === 'cepa' ? 'cepa_coal' : 'kmac_std');
      };
    }
    if ($('npCo')) {
      $('npCo').onchange = function () {
        var v = $('npCo').value;
        if ($('npDirectRow')) $('npDirectRow').style.display = v === '__biz__' ? '' : 'none';
        var co = findCompanyById(v);
        if (!co) return;
        if ($('npIndustry') && !str($('npIndustry').value)) $('npIndustry').value = str(co.bizType || co.bizCategory);
        if ($('npEmail') && !str($('npEmail').value)) $('npEmail').value = firstEmailOf(co);
      };
    }
    var modalSess = captureCurrentSession();
    if ($('npSaveBtn')) {
      $('npSaveBtn').onclick = function () {
        return withBusy($('npSaveBtn'), async function () {
          if (!modalSess || !isSessionCurrent(modalSess.epoch, modalSess.uid)) return;
          var selVal = str($('npCo') && $('npCo').value);
          var co = null, resolvedCoId = '', resolvedName = '', resolvedBiz = '';
          if (selVal === '__biz__') {
            resolvedName = str($('npDirectName') && $('npDirectName').value);
            var bizDigits = str($('npDirectBiz') && $('npDirectBiz').value).replace(/\D/g, '');
            if (!resolvedName || bizDigits.length !== 10) {
              toast('컨설팅 전용 사업장은 상호와 10자리 사업자등록번호를 모두 입력해야 합니다.');
              return;
            }
            var dupByBiz = D.companies.find(function (c) { return str(c.bizNo).replace(/\D/g, '') === bizDigits; });
            if (dupByBiz) {
              co = dupByBiz;
              resolvedCoId = str(dupByBiz.id);
              resolvedName = str(dupByBiz.name);
              resolvedBiz = str(dupByBiz.bizNo);
            } else {
              resolvedCoId = 'biz:' + bizDigits;
              resolvedBiz = bizDigits.slice(0, 3) + '-' + bizDigits.slice(3, 5) + '-' + bizDigits.slice(5);
            }
          } else {
            co = findCompanyById(selVal);
            if (!co) { toast('대상 거래처를 선택하거나 컨설팅 전용 사업장(사업자번호 10자리)을 선택해 주세요.'); return; }
            resolvedCoId = str(co.id);
            resolvedName = str(co.name);
            resolvedBiz = str(co.bizNo);
          }
          try {
            var agCode = str($('npAgency').value) || 'kmac';
            var trCode = str($('npTrack').value) || (agCode === 'cepa' ? 'cepa_coal' : 'kmac_std');
            var emails = str($('npEmail').value).split(/[,;\s]+/).map(str).filter(Boolean);
            var created = await saveProjectRecord({
              id: 'jt_' + safeKey(resolvedCoId) + '_' + agCode + '_' + str($('npYear').value || '2026'),
              companyId: resolvedCoId,
              companyName: resolvedName,
              bizNo: resolvedBiz,
              ceoName: co ? str(co.ceo || co.ceoName) : '',
              contactName: contactNameOfCompany(co),
              agency: agCode,
              track: trCode,
              year: Number($('npYear').value) || 2026,
              industry: sanitizeMetaLabel(str($('npIndustry').value) || (co ? str(co.bizType) : ''), { companyName: resolvedName }),
              mainProduct: sanitizeMetaLabel(str($('npMainProd').value), { companyName: resolvedName }),
              transGoal: sanitizeMetaLabel(str($('npTransGoal').value), { companyName: resolvedName }),
              workerCount: Number($('npWorkers').value) || 0,
              contactEmails: emails,
              consultantName: str($('npCons').value),
              selectedTasks: agCode === 'cepa'
                ? ['jt_impact', 'jt_job_redesign', 'jt_reskill', 'jt_gov_match']
                : ['jt_impact', 'jt_job_redesign', 'jt_reskill', 'jt_emp_stab']
            }, modalSess.epoch, modalSess.uid);
            if (!created || !isSessionCurrent(modalSess.epoch, modalSess.uid)) return;
            closeModal(true);
            CUR_PID = created.id;
            TAB = 'intake';
            clearSel();
            rebuildScanAndDiscover();
            draw();
            restoreModalFocus();
            toast(resolvedName + ' (' + Cat().getAgency(agCode).short + ') 워크스페이스가 개설되었습니다.');
          } catch (e) {
            if (!isSessionCurrent(modalSess.epoch, modalSess.uid)) return;
            toast('등록 실패: ' + (e.message || e));
          }
        });
      };
    }
  }

  function openTaskConfigModal(proj) {
    var picked = {};
    (proj.selectedTasks || []).forEach(function (c) { picked[c] = 1; });
    var allTasksOn = Cat().TASKS.every(function (t) { return !!picked[t.code]; });

    var taskHtml = Cat().TASKS.map(function (t, idx) {
      var on = !!picked[t.code];
      return '<label class="task-opt' + (on ? ' on' : '') + '">' +
        '<input type="checkbox" name="cfgTask" value="' + esc(t.code) + '"' + (on ? ' checked' : '') + '>' +
        '<span class="task-no">' + (idx + 1) + '</span>' +
        '<div><b>' + esc(t.name) + '</b><span>' + esc(t.summary) + '</span></div>' +
        '</label>';
    }).join('');

    var curAg = proj.agency === 'cepa' ? 'cepa' : 'kmac';
    var curTr = Cat().getTrack(proj.track, curAg).code;
    var agOpts = Object.keys(Cat().AGENCIES).map(function (k) {
      var ag = Cat().AGENCIES[k];
      return '<option value="' + esc(ag.code) + '"' + (curAg === ag.code ? ' selected' : '') + '>' + esc(ag.name) + '</option>';
    }).join('');

    var body =
      '<div class="note">운영기관(<b>능률협회 KMAC</b> vs <b>충남경제진흥원 CEPA</b>)을 바꾸면 중간보고서·최종결과보고서·완료계의 목차, 표 구성, 갑지 양식이 해당 기관 표준으로 즉시 전환됩니다.</div>' +
      '<div class="fr"><label for="cfgAgency">운영기관 · 트랙</label><div class="fv">' +
      '<select id="cfgAgency">' + agOpts + '</select>' +
      '<select id="cfgTrack">' + buildTrackOptionsHtml(curAg, curTr) + '</select>' +
      '</div></div>' +
      '<div class="fr"><label for="cfgIndustry">업종 / 근로자수</label><div class="fv">' +
      '<input type="text" id="cfgIndustry" value="' + esc(proj.industry || '') + '" placeholder="업종">' +
      '<input type="number" id="cfgWorkers" value="' + esc(proj.workerCount || '') + '" placeholder="상시근로자수" style="max-width:130px">' +
      '</div></div>' +
      '<div class="fr"><label for="cfgMainProd">주력품목 / 전환목표</label><div class="fv">' +
      '<input type="text" id="cfgMainProd" value="' + esc(proj.mainProduct || '') + '" placeholder="현 주력품목·공정">' +
      '<input type="text" id="cfgTransGoal" value="' + esc(proj.transGoal || '') + '" placeholder="산업·사업전환 목표 분야">' +
      '</div></div>' +
      '<div class="fr"><label for="cfgEmails">수신감지 이메일</label><div class="fv">' +
      '<input type="text" id="cfgEmails" value="' + esc((proj.contactEmails || []).join(', ')) + '" placeholder="기업 담당자 이메일 (쉼표 구분)">' +
      '<input type="text" id="cfgCons" value="' + esc(proj.consultantName || '') + '" placeholder="전담 노무사" style="max-width:210px">' +
      '</div></div>' +
      '<div class="task-pick-hd">' +
      '<input type="checkbox" id="cfgTaskAll"' + (allTasksOn ? ' checked' : '') + ' aria-label="8대 중점 전환과제 전체 선택">' +
      '<span class="task-no" style="padding-top:0">번호</span>' +
      '<span>🎯 산업·일자리전환 8대 중점 설계 과제 선택 (복수 선택)</span>' +
      '</div>' +
      '<div class="task-pick-grid">' + taskHtml + '</div>';

    openModal('🎯 ' + proj.companyName + ' — 운영기관 · 트랙 · 중점과제 설정', body,
      '<button class="sm" data-close-modal="1">취소</button><button class="sm pri" id="cfgSaveBtn">설정 저장</button>', 'wide');

    if ($('cfgAgency')) {
      $('cfgAgency').onchange = function () {
        var nextAg = $('cfgAgency').value;
        if ($('cfgTrack')) $('cfgTrack').innerHTML = buildTrackOptionsHtml(nextAg, nextAg === 'cepa' ? 'cepa_coal' : 'kmac_std');
      };
    }

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

    var cfgSess = captureCurrentSession();
    if ($('cfgSaveBtn')) {
      $('cfgSaveBtn').onclick = function () {
        return withBusy($('cfgSaveBtn'), async function () {
          if (!cfgSess || !isSessionCurrent(cfgSess.epoch, cfgSess.uid)) return;
          var selected = Array.prototype.slice.call(document.querySelectorAll('#mbox input[name="cfgTask"]:checked')).map(function (el) { return el.value; });
          if (!selected.length) { toast('최소 1개 이상의 중점 과제를 선택해 주세요.'); return; }
          try {
            var emails = str($('cfgEmails').value).split(/[,;\s]+/).map(str).filter(Boolean);
            var co = findCompanyById(proj.companyId);
            var nextAg = str($('cfgAgency').value) || 'kmac';
            var nextTr = str($('cfgTrack').value) || (nextAg === 'cepa' ? 'cepa_coal' : 'kmac_std');
            var savedCfg = await saveProjectRecord(Object.assign({}, proj, {
              ceoName: str(proj.ceoName || (co && (co.ceo || co.ceoName))),
              contactName: str(proj.contactName || contactNameOfCompany(co)),
              agency: nextAg,
              track: nextTr,
              industry: sanitizeMetaLabel(str($('cfgIndustry').value), proj),
              mainProduct: sanitizeMetaLabel(str($('cfgMainProd').value), proj),
              transGoal: sanitizeMetaLabel(str($('cfgTransGoal').value), proj),
              workerCount: Number($('cfgWorkers').value) || 0,
              contactEmails: emails,
              consultantName: sanitizeMetaLabel(str($('cfgCons').value), proj) || proj.consultantName,
              selectedTasks: selected
            }), cfgSess.epoch, cfgSess.uid);
            if (!savedCfg || !isSessionCurrent(cfgSess.epoch, cfgSess.uid)) return;
            closeModal(true);
            rebuildScanAndDiscover();
            draw();
            restoreModalFocus();
            toast('운영기관(' + Cat().getAgency(nextAg).short + ') 및 보고서 양식 설정이 갱신되었습니다.');
          } catch (e) {
            if (!isSessionCurrent(cfgSess.epoch, cfgSess.uid)) return;
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
    var ag = Cat().getAgency(proj.agency);
    var tr = Cat().getTrack(proj.track, ag.code);
    var rounds = currentNormalizedRounds(proj);
    var existing = roundNo ? rounds.find(function (r) { return Number(r.roundNo) === Number(roundNo); }) : null;
    var targetNo = existing ? existing.roundNo : (rounds.length + 1);
    var initDate = existing ? existing.date : '';
    var initMode = existing ? existing.mode : 'face';
    var minMins = tr.minRoundMins || 120;
    var minPpl = tr.minPeople || 2;
    var minFace = tr.minFacePct || ag.minFacePct || 75;
    var initMins = existing ? existing.mins : minMins;
    var initPeople = existing ? existing.companyPeople : Math.max(minPpl, 2);
    var initTopic = existing ? existing.topic : '';
    var initPhoto = existing ? existing.hasPhoto : false;
    var initSign = existing ? existing.hasSign : false;

    var body =
      '<div class="note"><b>' + esc(ag.short) + ' 회차 인정 기준:</b> 대면 비율 <b>' + minFace + '% 이상</b>, 회당 <b>' + minMins + '분 이상</b>, 기업 참석 <b>' + minPpl + '인 이상</b>, 현장 사진 및 수행일지(서명부) 구비</div>' +
      '<div class="fr"><label for="rdDate">수행 일자 / 방식</label><div class="fv">' +
      '<input type="text" id="rdDate" value="' + esc(initDate) + '" placeholder="YYYY-MM-DD" style="max-width:160px">' +
      '<select id="rdMode"><option value="face"' + (initMode === 'face' ? ' selected' : '') + '>대면(현장 방문)</option><option value="remote"' + (initMode === 'remote' ? ' selected' : '') + '>비대면(화상 자문)</option></select>' +
      '</div></div>' +
      '<div class="fr"><label for="rdMins">시간(분) / 기업참석</label><div class="fv">' +
      '<input type="number" id="rdMins" value="' + esc(initMins) + '" min="30" max="480" style="max-width:130px"><span>분</span>' +
      '<input type="number" id="rdPeople" value="' + esc(initPeople) + '" min="1" max="50" style="max-width:130px"><span>명 참석</span>' +
      '</div></div>' +
      '<div class="fr"><label for="rdTopic">자문 수행 주제*</label><div class="fv"><input type="text" id="rdTopic" value="' + esc(initTopic) + '" placeholder="예: 전환 대상 직무 매트릭스 설계 및 직무기술서(JD) 검토"></div></div>' +
      '<div class="fr"><label>필수 증빙 확인</label><div class="fv">' +
      '<label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" id="rdPhoto"' + (initPhoto ? ' checked' : '') + '> 현장 수행 사진</label>' +
      '<label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" id="rdSign"' + (initSign ? ' checked' : '') + '> 수행일지 · 참석 서명부</label>' +
      '</div></div>';

    openModal((existing ? '✏️ ' + targetNo + '회차 수행·증빙 편집' : '➕ 신규 컨설팅 회차 추가'), body,
      '<button class="sm" data-close-modal="1">취소</button><button class="sm pri" id="rdSaveBtn">회차 저장</button>', 'wide');

    var rdSess = captureCurrentSession();
    if ($('rdSaveBtn')) {
      $('rdSaveBtn').onclick = function () {
        return withBusy($('rdSaveBtn'), async function () {
          if (!rdSess || !isSessionCurrent(rdSess.epoch, rdSess.uid)) return;
          var topic = sanitizeMetaLabel(str($('rdTopic').value), proj);
          if (!topic) { toast('자문 수행 주제를 입력해 주세요.'); return; }
          if (Intake().hasResidualPii(topic)) { toast('수행 주제에 민감 식별정보 패턴이 포함되어 저장할 수 없습니다.'); return; }
          var entry = {
            roundNo: targetNo,
            date: str($('rdDate').value),
            mode: str($('rdMode').value) === 'remote' ? 'remote' : 'face',
            mins: Math.max(30, Number($('rdMins').value) || minMins),
            companyPeople: Math.max(1, Number($('rdPeople').value) || minPpl),
            topic: topic,
            hasPhoto: !!($('rdPhoto') && $('rdPhoto').checked),
            hasSign: !!($('rdSign') && $('rdSign').checked)
          };
          var nextRounds = rounds.slice();
          var idx = nextRounds.findIndex(function (r) { return Number(r.roundNo) === Number(targetNo); });
          if (idx >= 0) nextRounds[idx] = entry;
          else nextRounds.push(entry);
          nextRounds = nextRounds.map(function (r, i) { return Object.assign({}, r, { roundNo: i + 1 }); });

          var savedRd = await saveProjectRecord(Object.assign({}, proj, { rounds: nextRounds }), rdSess.epoch, rdSess.uid);
          if (!savedRd || !isSessionCurrent(rdSess.epoch, rdSess.uid)) return;
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

    var initItem = existing ? existing.item : '';
    var initMid = existing ? existing.midVal : '중간보고 진단 기준선';
    var initFin = existing ? existing.finVal : '';
    var initSt = existing ? existing.status : '합의 확정 ✓';

    var body =
      '<div class="note">중간보고 이후 확정된 전환 대상 직무·인원, 직무재교육 과정, 상생협약 합의사항을 수정하면 최종 결과보고서(.hwpx)와 별첨 점검표(.xlsx)에 즉시 반영됩니다.</div>' +
      '<div class="fr"><label for="dfItem">협의 항목*</label><div class="fv"><input type="text" id="dfItem" value="' + esc(initItem) + '"' + (existing && !existing.custom ? ' readonly' : '') + ' placeholder="예: 전환배치 적응기간 임금보전 원칙"></div></div>' +
      '<div class="fr"><label for="dfMid">중간보고 기준선</label><div class="fv"><input type="text" id="dfMid" value="' + esc(initMid) + '"></div></div>' +
      '<div class="fr"><label for="dfFin">최종 확정 설계안*</label><div class="fv"><textarea id="dfFin" rows="3" placeholder="예: 전동화 조립·검사 직무 8명 단계적 전환배치 및 S-OJT 40시간 유급 인정 확정">' + esc(initFin) + '</textarea></div></div>' +
      '<div class="fr"><label for="dfStatus">합의 상태</label><div class="fv"><select id="dfStatus">' +
      ['합의 확정 ✓', '후속 메일 확정', '노사협약 체결 ✓', '추가 협의중', '검토 보류'].map(function (s) {
        return '<option value="' + esc(s) + '"' + (initSt === s ? ' selected' : '') + '>' + esc(s) + '</option>';
      }).join('') +
      '</select></div></div>';

    openModal((existing ? '✏️ 후속 협의 Diff 항목 편집' : '➕ 후속 협의 합의사항 추가'), body,
      '<button class="sm" data-close-modal="1">취소</button><button class="sm pri" id="dfSaveBtn">합의사항 저장</button>', 'wide');

    var dfSess = captureCurrentSession();
    if ($('dfSaveBtn')) {
      $('dfSaveBtn').onclick = function () {
        return withBusy($('dfSaveBtn'), async function () {
          if (!dfSess || !isSessionCurrent(dfSess.epoch, dfSess.uid)) return;
          var item = sanitizeMetaLabel(str($('dfItem').value), proj);
          var midVal = sanitizeMetaLabel(str($('dfMid').value), proj);
          var finVal = sanitizeMetaLabel(str($('dfFin').value), proj);
          var status = str($('dfStatus').value) || '합의 확정 ✓';
          if (!item || !finVal) { toast('협의 항목과 최종 확정 설계안을 입력해 주세요.'); return; }
          if (Intake().hasResidualPii(item) || Intake().hasResidualPii(midVal) || Intake().hasResidualPii(finVal)) {
            toast('민감 고유식별정보 패턴이 감지되어 저장할 수 없습니다.');
            return;
          }

          var nextStatusMap = Object.assign({}, proj.diffStatusMap || {});
          var nextOverrides = Object.assign({}, proj.diffOverrides || {});
          var nextCustom = Array.isArray(proj.customDiffRows) ? proj.customDiffRows.slice() : [];

          if (!existing) {
            var newId = 'df_custom_' + Date.now().toString(36);
            nextCustom.push({ id: newId, item: item, midVal: midVal, finVal: finVal, status: status, custom: true });
            nextStatusMap[newId] = status;
          } else if (existing.custom) {
            nextCustom = nextCustom.map(function (r) {
              return r && r.id === existing.id ? Object.assign({}, r, { item: item, midVal: midVal, finVal: finVal, status: status, custom: true }) : r;
            });
            nextStatusMap[existing.id] = status;
          } else {
            nextOverrides[existing.id] = { item: item, midVal: midVal, finVal: finVal, status: status };
            nextStatusMap[existing.id] = status;
          }

          var savedDf = await saveProjectRecord(Object.assign({}, proj, {
            diffStatusMap: nextStatusMap,
            diffOverrides: nextOverrides,
            customDiffRows: nextCustom
          }), dfSess.epoch, dfSess.uid);
          if (!savedDf || !isSessionCurrent(dfSess.epoch, dfSess.uid)) return;
          closeModal(true);
          draw();
          restoreModalFocus();
          toast('후속 협의 합의사항이 반영되었습니다.');
        });
      };
    }
  }

  /* ══ 사업장 진행 기록 · 완료보고서 보기 (대표 지시 2026-11-28 「사업장 클릭하면 완료보고서까지 보고, 어떻게 진행됐는지 확인」) ══
   * 읽기만 한다 — 메일 본문·첨부는 서버에서 «미리 보기(peek)»로 받아 이 탭 메모리에서만 연다(읽음 표시·저장 없음).
   * «완료로 확정»만 쓰기다: 사람이 근거 메일을 보고 누르면 프로젝트에 finalConfirmedAt·finalMail(열쇠·날짜·종류)을 적는다. */
  var DETAIL_PID = '';
  var PD_ATT_STATE = null;

  function firstIntakeDateOf(pid) {
    var map = D.intake[pid] || {};
    var min = 0;
    Object.keys(map).forEach(function (k) {
      var c = map[k];
      if (!c || c._deleted) return;
      var t = Number(c.checkedAt || c.createdAt || c.analyzedAt) || 0;
      if (t > 0 && (!min || t < min)) min = t;
    });
    return min ? dayOfMs(min) : '';
  }

  /* 보낸메일 거울이 담고 있는 가장 이른 날 — «이보다 전에 보낸 메일은 안 보인다»를 밝히는 데 쓴다 */
  function sentMirrorFromDate() {
    var min = 0;
    (D.flatMails || []).forEach(function (m) {
      if (m && m.folderKind === 'sent' && m.ts > 0 && (!min || m.ts < min)) min = m.ts;
    });
    return min ? dayOfMs(min) : '';
  }

  /* 창의 메일 기록 줄 — 최종보고 근거(지난 메일 포함) + 이 사업장으로 확정 귀속된 메일(최근 거울·지난 메일) */
  function detailTimelineRows(p) {
    if (!p) return [];
    var ev = finalEvOf(p);
    var seen = {}, rows = [];
    function add(m, kindLabel, kindCls, isFinal) {
      if (!m || !m.key || seen[m.key]) return;
      seen[m.key] = 1;
      rows.push({ id: m.key, m: m, kindLabel: kindLabel, kindCls: kindCls, isFinal: isFinal });
    }
    ev.mails.forEach(function (e) { add(e, e.kindLabel, e.done ? 'c-green' : 'c-blue', true); });
    var sc = SCAN_CACHE[p.id] || { matched: [] };
    (sc.matched || []).forEach(function (m) { add(m, m.docKindName || '메일', '', false); });
    if ((D.oldMails || []).length) {
      var oldScan = Intake().scanProjectMails(p, D.oldMails, null, D.companies, D.consultings, D.intake[p.id] || {});
      (oldScan.matched || []).forEach(function (m) { add(m, m.docKindName || '메일', '', false); });
    }
    rows.sort(function (a, b) { return ((Number(b.m.ts) || 0) - (Number(a.m.ts) || 0)) || (a.id < b.id ? -1 : 1); });
    return rows;
  }

  function openProjectDetailModal(pid) {
    var p = projectById(pid);
    if (!p) { toast('사업장을 찾을 수 없습니다.'); return; }
    CUR_PID = p.id;
    DETAIL_PID = p.id;
    PD_ATT_STATE = null;
    clearSel('projMails');
    var ag = Cat().getAgency(p.agency);
    var tr = Cat().getTrack(p.track, ag.code);
    var pMeta = projectParallelMeta(p);
    var ev = finalEvOf(p);
    var st = progressStateOf(p);
    var saved = p.finalMail && typeof p.finalMail === 'object' ? p.finalMail : null;
    var tasks = (p.selectedTasks || []).map(function (c) { var t = Cat().getTask(c); return t ? t.name : c; });
    var y = yearOf(p);

    var steps = [
      { name: '사업 등록', date: dayOfMs(p.createdAt), done: true },
      { name: '기초자료 수령', date: firstIntakeDateOf(p.id), done: activeIntakeCount(p.id) > 0 },
      { name: '중간보고 확정', date: dayOfMs(p.midConfirmedAt), done: !!p.midConfirmedAt },
      { name: '최종보고 메일', date: ev.done ? ev.doneDate : ev.lastDate, done: ev.done, sub: ev.label },
      { name: '최종 완료', date: p.finalConfirmedAt ? ((saved && str(saved.date)) || dayOfMs(p.finalConfirmedAt)) : '', done: !!p.finalConfirmedAt }
    ];
    var stepsHtml = '<div class="ws-steps pd-steps">' + steps.map(function (sp, i) {
      var cls = sp.done ? ' done' : '';
      var tip = sp.name + (sp.sub ? ' — ' + sp.sub : '') + (sp.date ? ' (' + sp.date + ')' : '');
      return '<div class="ws-step' + cls + '" title="' + esc(tip) + '"><b>' + (i + 1) + '. ' + esc(sp.name) + (sp.date ? ' · ' + esc(sp.date.slice(2)) : '') + '</b></div>';
    }).join('') + '</div>';

    var profHtml = '<div class="prof">' +
      '<span><b>연도</b>' + esc(y ? y + '년' : '미입력') + '</span>' +
      '<span><b>기관</b>' + agencyChipHtml(ag.code) + ' <span class="chip">' + esc(tr.short) + '</span></span>' +
      (pMeta.contractNo ? '<span><b>계약</b>' + esc(pMeta.contractNo) + '</span>' : '') +
      (str(p.consultantName) ? '<span><b>담당</b>' + esc(p.consultantName) + '</span>' : '') +
      (str(p.transGoal) ? '<span title="' + esc(p.transGoal) + '"><b>전환목표</b>' + esc(p.transGoal) + '</span>' : '') +
      '<span title="' + esc(tasks.join(', ')) + '"><b>중점과제</b>' + esc(tasks.join(' · ') || '미선택') + '</span>' +
      '</div>';

    var finalBar = '<div class="bar">' + progressChipHtml(st) +
      '<span class="hint">최종보고 메일 근거 ' + ev.mails.length + '통</span>' +
      (st.code === 'wait'
        ? '<span class="sp"></span><button class="sm ok" data-final-ok="' + esc(p.id) + '" title="근거 메일(' + esc(ev.doneDate) + ' · ' + esc(ev.label) + ')을 확인했으면 누르세요 — 이 사업장을 최종 완료로 적습니다">✅ 완료로 확정 (' + esc(ev.doneDate || '날짜 미상') + ' 근거)</button>'
        : '') +
      '</div>';
    var gapNote = '';
    if (!ev.mails.length) {
      var sentFrom = sentMirrorFromDate();
      gapNote = '<div class="hint pd-gap">메일함 거울에서 이 사업장의 최종보고서 메일을 찾지 못했습니다 — 보낸메일 거울은 최근 메일' +
        (sentFrom ? '(' + esc(sentFrom) + ' 이후)' : '') + '만 담고, 지난 메일은 «받은 메일»만 있어 오래전에 보낸 보고서는 상대 기관의 회신·승인 메일이 없으면 보이지 않습니다. 원본은 다음메일 보낸편지함·컨설팅 폴더에서 확인해 주세요.</div>';
    }

    var tl = detailTimelineRows(p);
    var shown = tl.slice(0, 80);
    var tRows = shown.map(function (r) {
      var m = r.m;
      var isOld = m.src === 'pop3' || !!m.old;
      var atts = Array.isArray(m.attNames) ? m.attNames : [];
      var repAtts = Array.isArray(m.reportAtts) ? m.reportAtts : [];
      var subjTitle = str(m.subject) + (atts.length ? ' · 첨부: ' + atts.join(', ') : '');
      return {
        id: r.id,
        cells: [
          { k: 'yr', html: esc(m.date || dayOfMs(m.ts) || '-') },
          { html: (m.dir === 'out' ? '📤 보냄' : '📥 받음') + (isOld ? ' <span class="chip" title="POP3 지난 메일 보관분 — 첨부 이름은 열어야 보입니다">지난메일</span>' : '') },
          { k: 'badge', html: '<span class="chip ' + r.kindCls + '">' + esc(r.kindLabel) + '</span>' },
          { cls: 'wide', title: subjTitle, html: esc(m.subject || '(제목 없음)') + (repAtts.length ? ' <span class="chip c-green" title="' + esc(repAtts.join(', ')) + '">📎 보고서 ' + repAtts.length + '</span>' : (atts.length ? ' <span class="hint">📎' + atts.length + '</span>' : '')) },
          { k: 'act', html: '<button class="sm" data-pd-att="' + esc(r.id) + '" title="이 메일의 첨부 목록을 불러옵니다(읽음 표시 안 바뀜)">📎 첨부 보기</button>' }
        ]
      };
    });

    var body = stepsHtml + profHtml +
      '<div class="sec"><span>📄 최종보고서 · 완료 근거</span></div>' + finalBar + gapNote +
      '<div class="sec"><span>✉️ 메일로 본 진행 기록 (최신순)</span><span class="chip">' + tl.length + '통</span>' +
      (tl.length > shown.length ? '<span class="hint">최근 ' + shown.length + '통만 보입니다</span>' : '') + '</div>' +
      renderTable('projMails', ['날짜', '구분', '종류', '제목 · 첨부', '열기'], tRows, '') +
      '<div id="pdAttBox" class="pd-att-box" aria-live="polite"></div>';
    var foot = '<button class="sm" data-open-proj="' + esc(p.id) + '" data-open-tab="intake">① 기초자료</button>' +
      '<button class="sm" data-open-proj="' + esc(p.id) + '" data-open-tab="mid">② 중간보고</button>' +
      '<button class="sm pri" data-open-proj="' + esc(p.id) + '" data-open-tab="final">③ 최종·완료계</button>' +
      '<button class="sm" data-close-modal="1">닫기</button>';
    openModal('📁 ' + (y ? y + '년 · ' : '') + p.companyName + ' — 진행 기록·완료보고서', body, foot, 'xwide');
    drawBulks();
  }

  function attExtOf(name) {
    var m = /\.([A-Za-z0-9]{1,6})$/.exec(str(name));
    return m ? m[1].toLowerCase() : '';
  }
  var ATT_VIEW_EXT = { pdf: 1, hwp: 1, hwpx: 1, png: 1, jpg: 1, jpeg: 1, gif: 1, webp: 1 };

  async function showDetailMailAtts(mailKey) {
    var reqEpoch = SESSION_EPOCH;
    var reqUid = ME && ME.uid ? String(ME.uid) : '';
    var p = projectById(DETAIL_PID);
    if (!p) return;
    var row = detailTimelineRows(p).find(function (r) { return r.id === mailKey; });
    if (!row) { toast('메일 정보를 찾을 수 없습니다.'); return; }
    var m = row.m;
    var box = $('pdAttBox');
    if (box) box.innerHTML = '<div class="hint">첨부 목록을 불러오는 중… (읽음 표시는 바뀌지 않습니다)</div>';
    try {
      var isOld = m.src === 'pop3' || !!m.old || String(m.key).indexOf('o:') === 0;
      var cacheKey = isOld ? ('old:' + str(m.popKey)) : ('imap:' + str(m.slug) + ':' + str(m.uid));
      var msg = MAIL_VIEW_CACHE[cacheKey];
      if (!msg) {
        msg = isOld
          ? await callMailFn('readOldMail', { key: str(m.popKey), full: 1 }, reqEpoch, reqUid)
          : await callMailFn('readMailMessage', { slug: str(m.slug), uid: str(m.uid), peek: 1 }, reqEpoch, reqUid);
        if (!isSessionCurrent(reqEpoch, reqUid)) return;
        if (msg) MAIL_VIEW_CACHE[cacheKey] = msg;
      }
      if (DETAIL_PID !== p.id || !$('pdAttBox')) return;
      var atts = Array.isArray(msg && msg.atts) ? msg.atts : [];
      PD_ATT_STATE = { key: mailKey, m: m, isOld: isOld, atts: atts };
      var head = '<div class="sec"><span>📎 ' + esc(m.date || '') + ' · ' + esc(str(m.subject).slice(0, 80)) + '</span><span class="chip">' + atts.length + '개</span></div>';
      if (!atts.length) {
        $('pdAttBox').innerHTML = head + '<div class="empty">이 메일에는 첨부가 없습니다' + (isOld ? ' (회신 메일은 보통 원래 첨부를 다시 싣지 않습니다)' : '') + '.</div>';
        return;
      }
      $('pdAttBox').innerHTML = head + '<div class="pd-att-list">' + atts.map(function (a, i) {
        var nm = str(a && a.name) || ('첨부 ' + (i + 1));
        var ext = attExtOf(nm);
        var kb = Number(a && a.size) > 0 ? Math.max(1, Math.round(Number(a.size) / 1024)) : 0;
        var isRep = /결과\s*보고|최종\s*보고|완료\s*보고|완료계|최종\s*본|정책\s*매니저|사후\s*관리/.test(nm);
        return '<div class="pd-att' + (isRep ? ' rep' : '') + '">' +
          '<span class="pd-att-no">' + (i + 1) + '</span>' +
          '<span class="pd-att-nm" title="' + esc(nm) + '">' + (isRep ? '📄 ' : '') + esc(nm) + '</span>' +
          (kb ? '<span class="hint">' + kb.toLocaleString() + 'KB</span>' : '') +
          (ATT_VIEW_EXT[ext] ? '<button class="sm pri" data-pd-open="view:' + i + '" title="' + (ext === 'pdf' ? '새 탭에서 PDF로 봅니다' : (ext === 'hwp' || ext === 'hwpx' ? '푸른한글 새 탭에서 엽니다' : '새 탭에서 봅니다')) + '">보기</button>' : '') +
          '<button class="sm" data-pd-open="save:' + i + '">받기</button>' +
          '</div>';
      }).join('') + '</div>';
    } catch (err) {
      if (!isSessionCurrent(reqEpoch, reqUid)) return;
      if ($('pdAttBox')) $('pdAttBox').innerHTML = '<div class="warn">첨부를 불러오지 못했습니다 — ' + esc((err && err.message) || err) + '</div>';
    }
  }

  /* 보기: 누른 순간 빈 창을 먼저 연다(받는 동안 기다리면 팝업 차단) — pdf·그림은 그 창에, 한글은 푸른한글로 */
  async function openDetailAtt(spec, preWin) {
    var reqEpoch = SESSION_EPOCH;
    var reqUid = ME && ME.uid ? String(ME.uid) : '';
    var st = PD_ATT_STATE;
    var parts = String(spec || '').split(':');
    var mode = parts[0], idx = Number(parts[1]);
    var a = st && st.atts[idx];
    function closePre() { try { if (preWin && !preWin.closed) preWin.close(); } catch (e) {} }
    if (!st || !a) { closePre(); return; }
    var nm = str(a.name) || ('첨부_' + (idx + 1));
    if (Number(a.size) > 20 * 1024 * 1024) { closePre(); toast('20MB가 넘어 앱에서 열 수 없습니다 — 메일함에서 받아 주세요.'); return; }
    try {
      var got = st.isOld
        ? await callMailFn('readOldMail', { key: str(st.m.popKey), index: a.i == null ? idx : a.i }, reqEpoch, reqUid)
        : await callMailFn('readMailAttachment', { slug: str(st.m.slug), uid: str(st.m.uid), index: a.i == null ? idx : a.i, part: a.part || '' }, reqEpoch, reqUid);
      if (!isSessionCurrent(reqEpoch, reqUid)) { closePre(); return; }
      if (!got || !got.b64 || !global.PuRulesMailOrig) throw new Error('첨부 내용을 받지 못했습니다');
      var bytes = global.PuRulesMailOrig.b64ToBytes(got.b64);
      var ext = attExtOf(nm);
      if (mode === 'view' && (ext === 'hwp' || ext === 'hwpx') && Hwpx() && typeof Hwpx().openBytesInHangulEditor === 'function') {
        Hwpx().openBytesInHangulEditor(bytes, nm, ext, preWin);
        return;
      }
      if (mode === 'view' && ATT_VIEW_EXT[ext]) {
        var mime = ext === 'pdf' ? 'application/pdf' : ('image/' + (ext === 'jpg' ? 'jpeg' : ext));
        var url = URL.createObjectURL(new Blob([bytes], { type: mime }));
        if (preWin && !preWin.closed) preWin.location.href = url;
        else global.open(url, '_blank');
        setTimeout(function () { URL.revokeObjectURL(url); }, 120000);
        return;
      }
      closePre();
      downloadRawBytes(bytes, nm);
    } catch (err) {
      closePre();
      if (isSessionCurrent(reqEpoch, reqUid)) toast('첨부를 열지 못했습니다 — ' + ((err && err.message) || err));
    }
  }

  function finalMailRecordOf(p) {
    var ev = finalEvOf(p);
    if (!ev.done) return null;
    var e = ev.mails.find(function (x) { return x.key === ev.doneKey; }) || null;
    return {
      key: str(ev.doneKey).slice(0, 120),
      date: str(ev.doneDate),
      kind: str(ev.status),
      label: str(ev.label),
      subject: e ? sanitizeMetaLabel(str(e.subject).slice(0, 120), p) : '',
      confirmedBy: str(ME && ME.sid),
      confirmedAt: Date.now()
    };
  }

  /* 완료 확정 — 사람이 근거를 보고 누를 때만. 이미 완료로 적힌 사업장은 건드리지 않는다(종료 건 불변) */
  async function confirmFinalFromMail(pids) {
    var reqEpoch = SESSION_EPOCH;
    var reqUid = ME && ME.uid ? String(ME.uid) : '';
    var targets = pids.map(projectById).filter(function (p) { return p && !p.finalConfirmedAt && finalEvOf(p).done; });
    var skipped = pids.length - targets.length;
    if (!targets.length) { toast('완료로 확정할 수 있는 사업장이 없습니다 (이미 완료이거나 메일 근거가 없습니다).'); return false; }
    var lines = targets.slice(0, 8).map(function (p) { var ev = finalEvOf(p); return '· ' + (yearOf(p) || '') + ' ' + p.companyName + ' — ' + ev.label + ' ' + (ev.doneDate || ''); }).join('\n');
    if (!askConfirm('메일 근거로 ' + targets.length + '개 사업장을 «최종 완료»로 적습니다.' + (skipped ? ' (이미 완료이거나 근거가 없는 ' + skipped + '곳은 건너뜀)' : '') + '\n\n' + lines + (targets.length > 8 ? '\n…' : '') + '\n\n계속할까요?')) return false;
    var entries = targets.map(function (p) {
      var fm = finalMailRecordOf(p);
      return {
        path: 'scal_jobtrans/projects/' + p.id,
        previous: p,
        record: Object.assign({}, p, { finalConfirmedAt: Number(finalEvOf(p).doneAt) || Date.now(), stage: 'followup', finalMail: fm }),
        entityType: 'Project'
      };
    });
    var saved = await atomicMultiRecordUpdate(entries, reqEpoch, reqUid);
    if (!saved || !isSessionCurrent(reqEpoch, reqUid)) return false;
    Object.keys(saved).forEach(function (pathKey) {
      var val = saved[pathKey];
      if (val && val.id) D.projects[val.id] = val;
    });
    rebuildScanAndDiscover();
    toast(targets.length + '개 사업장을 메일 근거로 최종 완료 확정했습니다.');
    return true;
  }

  function openReportPreviewModal(proj, kind) {
    if (!Hwpx()) { toast('보고서 출력 엔진이 준비되지 않았습니다.'); return; }
    var live = buildLiveReportsForExport(proj);
    var htmlBody = Hwpx().buildPreviewHtml(kind, proj, live.mid, live.fin);
    var fn = Hwpx().suggestedFileName(kind, proj);
    var foot =
      '<button class="sm" data-close-modal="1">닫기</button>' +
      '<button class="sm" id="pvPrintBtn">🖨 A4 PDF 인쇄</button>' +
      '<button class="sm pri" id="pvHangulBtn">📝 푸른한글(hangul.html)에서 편집</button>' +
      '<button class="sm ok" id="pvDlHwpxBtn">📥 한글(.hwpx) 다운로드</button>';

    openModal('👁️ A4 보고서 미리보기 — ' + fn, htmlBody, foot, 'xwide');

    if ($('pvPrintBtn')) {
      $('pvPrintBtn').onclick = function () {
        var ok = Hwpx().openPrintWindow(kind, proj, live.mid, live.fin);
        if (!ok) toast('팝업 차단을 해제한 뒤 다시 인쇄를 눌러 주세요.');
      };
    }
    if ($('pvHangulBtn')) {
      $('pvHangulBtn').onclick = function () {
        Hwpx().openInHangulEditor(kind, proj, live.mid, live.fin);
        toast('새 탭에서 푸른한글 편집기를 열었습니다.');
      };
    }
    if ($('pvDlHwpxBtn')) {
      $('pvDlHwpxBtn').onclick = function () {
        var bytes = Hwpx().generateHwpxBytes(kind, proj, live.mid, live.fin);
        Hwpx().downloadHwpxBytes(bytes, fn);
        toast(fn + ' 파일을 다운로드했습니다.');
      };
    }
  }

  function openCardDetailModal(card) {
    var dk = Cat().getDocKind(card.docKind) || { name: card.docKind };
    var lines = (card.summaryLines || []).map(function (l) { return '• ' + l; }).join('\n');
    var statsJson = card.stats ? JSON.stringify(card.stats, null, 2) : '';
    var body =
      '<div class="note"><b>서류 분류:</b> ' + esc(dk.name) + '  |  <b>처리 방식:</b> ' + (card.track === 'quant' ? '브라우저 로컬 비식별 통계 (원본 성명·주민번호 미저장)' : '개인정보 2중 가림 요약') + '</div>' +
      '<div style="font-weight:700;margin-bottom:6px">■ 핵심 비식별 분석 결과</div>' +
      '<div class="mail-body">' + esc(lines || '요약 없음') +
      (card.maskedExcerpt ? '\n\n[비식별 본문 발췌]\n' + esc(card.maskedExcerpt) : '') +
      (statsJson ? '\n\n[비식별 집계 데이터]\n' + esc(statsJson) : '') +
      '</div>';
    openModal('🔍 분석 카드 상세 — ' + (card.title || dk.name), body, '<button class="sm pri" data-close-modal="1">확인</button>', 'wide');
  }

  function openDocRequestMailModal(proj, phase, onlyCodes) {
    var sc = SCAN_CACHE[proj.id] || { matched: [] };
    var chk = Intake().summarizeChecklistProgress(phase, proj.agency, proj.track, proj.selectedTasks, D.intake[proj.id] || {}, sc.matched, manualChecksOf(proj, phase));
    var targetDocs = chk.missingRequired;
    if (Array.isArray(onlyCodes) && onlyCodes.length) {
      var codeSet = {};
      onlyCodes.forEach(function (c) { codeSet[c] = 1; });
      targetDocs = chk.items.filter(function (it) { return !!codeSet[it.code]; });
    }
    var mailDraft = Cat().buildDocRequestMail({
      companyName: proj.companyName,
      phase: phase,
      agency: proj.agency,
      track: proj.track,
      missingDocs: targetDocs,
      consultantName: proj.consultantName
    });
    var body =
      '<div class="note">⚠ 메일 자동 발송은 하지 않습니다. 아래 요청 문안을 복사하여 메일함 작성창에 붙여넣고 담당자가 확인 후 발송하세요.</div>' +
      '<div class="fr"><label for="reqSubj">메일 제목</label><div class="fv"><input type="text" id="reqSubj" value="' + esc(mailDraft.subject) + '" readonly></div></div>' +
      '<textarea id="reqBody" aria-label="미수신 자료 요청 메일 본문" rows="13">' + esc(mailDraft.body) + '</textarea>';
    var foot =
      '<a class="act-link" href="pu-cards.html?view=mail" target="_blank" rel="noopener">✉️ 푸른메일함 열기</a>' +
      '<button class="sm pri" id="copyReqMailBtn">📋 제목+본문 복사</button>' +
      '<button class="sm" data-close-modal="1">닫기</button>';
    openModal('✉️ 미수신 자료 요청 메일 문안 (' + Cat().getAgency(proj.agency).short + ')', body, foot, 'wide');
    if ($('copyReqMailBtn')) {
      $('copyReqMailBtn').onclick = function () {
        copyTextToClipboard($('reqSubj').value + '\n\n' + $('reqBody').value);
        toast('요청 메일 제목과 본문을 복사했습니다.');
      };
    }
  }

  function buildCombinedSubmissionTextFile(proj, sub) {
    var ag = Cat().getAgency(proj.agency);
    return [
      '══════════════════════════════════════════════════════════════════════',
      '  ' + (proj.companyName || '참여기업') + ' — ' + ag.name + ' 제출용 문안 3종 통합본',
      '══════════════════════════════════════════════════════════════════════',
      '',
      sub.planText,
      '',
      '──────────────────────────────────────────────────────────────────────',
      '',
      sub.completionText,
      '',
      '──────────────────────────────────────────────────────────────────────',
      '【전 회차 컨설팅 수행일지 요약 문안】',
      '──────────────────────────────────────────────────────────────────────',
      '',
      sub.roundLogsText
    ].join('\n');
  }

  function openSubmissionTextsModal(proj) {
    var live = buildLiveReportsForExport(proj);
    var sub = Report().buildSubmissionTexts(proj, live.mid, live.fin, D.intake[proj.id] || {}, live.schedRds);
    var ag = Cat().getAgency(proj.agency);
    var rc = live.fin.structured.roundCheck;

    var roundStatusHtml =
      '<div class="' + (rc.faceMet && rc.allTimeAndPeopleMet ? 'ok-banner' : 'warn') + '">' +
      '<b>' + esc(ag.short) + ' 회차 인정기준 신호등:</b> 총 ' + rc.totalCount + '회차 중 대면 ' + rc.faceCount + '회(' + rc.facePct + '% — 기준 ' + rc.minFacePct + '%+ ' + (rc.faceMet ? '충족✓' : '미달⚠') + ') · ' +
      rc.minRoundMins + '분+ 및 기업 ' + rc.minPeople + '인+ (' + (rc.allTimeAndPeopleMet ? '전 회차 충족✓' : '점검 필요⚠') + ') · 사진·서명 확인 ' + rc.proofReadyCount + '/' + rc.totalCount + '회' +
      '</div>';

    var body =
      roundStatusHtml +
      '<div style="display:flex;flex-direction:column;gap:12px">' +
      '<div><div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap"><b>① 수행계획서 요약 문안</b><span class="sp"></span><button class="sm pri" data-copy-target="subPlanTxt">📋 수행계획서 복사</button></div>' +
      '<textarea id="subPlanTxt" aria-label="수행계획서 요약 문안" rows="6">' + esc(sub.planText) + '</textarea></div>' +
      '<div><div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap"><b>② ' + esc(ag.completionDocName) + ' 문안</b><span class="sp"></span><button class="sm pri" data-copy-target="subCompTxt">📋 완료문안 복사</button></div>' +
      '<textarea id="subCompTxt" aria-label="완료계 및 완료보고서 문안" rows="7">' + esc(sub.completionText) + '</textarea></div>' +
      '<div><div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap"><b>③ 회차별 수행일지 요약 문안</b><span class="sp"></span><button class="sm pri" data-copy-target="subRoundTxt">📋 수행일지 복사</button></div>' +
      '<textarea id="subRoundTxt" aria-label="회차별 수행일지 요약 문안" rows="7">' + esc(sub.roundLogsText) + '</textarea></div>' +
      '</div>';

    openModal('📋 ' + ag.short + ' 제출 문안 3종 — ' + proj.companyName, body,
      '<button class="sm ok" id="subModalCompHwpxBtn">📥 ' + esc(ag.code === 'cepa' ? '완료계 .hwpx 다운로드' : '완료보고서 .hwpx 다운로드') + '</button>' +
      '<button class="sm" data-close-modal="1">닫기</button>', 'xwide');

    if ($('subModalCompHwpxBtn')) {
      $('subModalCompHwpxBtn').onclick = function () {
        var bytes = Hwpx().generateHwpxBytes('completion', proj, live.mid, live.fin);
        Hwpx().downloadHwpxBytes(bytes, Hwpx().suggestedFileName('completion', proj));
        toast(ag.completionDocName + ' 한글(.hwpx) 파일을 다운로드했습니다.');
      };
    }
  }

  async function runAiPolishForSection(kindAndKey) {
    var aiSess = captureCurrentSession();
    if (!aiSess) return;
    var proj = projectById(CUR_PID);
    if (!proj || !global.PuAiCall) return;
    var reqPid = proj.id;
    var parts = kindAndKey.split(':');
    var mode = parts[0], secKey = parts[1];
    var ta = $((mode === 'mid' ? 'midSec_' : 'finalSec_') + secKey);
    if (!ta || !str(ta.value)) { toast('다듬을 초안 본문이 비어 있습니다.'); return; }
    var origDraft = ta.value;

    var schema = mode === 'mid' ? Cat().getMidSections(proj.agency) : Cat().getFinalSections(proj.agency, proj.track);
    var secMeta = schema.find(function (s) { return s.key === secKey; });
    var req = Report().buildAiPolishPrompt(secMeta ? secMeta.title : secKey, origDraft, proj.agency, projectNamesList(proj));
    if (!req.ok) { toast(req.error); return; }

    toast('개인정보 2중 가림 확인 완료 → AI 문안 윤문 요청 중…');
    try {
      var reply = await global.PuAiCall.ask([{ text: req.prompt }], {
        auth: fb.auth(),
        app: 'jobtrans',
        manual: true
      });
      if (!isSessionCurrent(aiSess.epoch, aiSess.uid) || CUR_PID !== reqPid) return;
      var rawOut = global.PuAiCall.textOf(reply);
      var unmasked = Intake().unmaskNames(rawOut, req.back);
      var numCheck = Report().checkHallucinatedNumbers(origDraft, unmasked);

      var warnBanner = numCheck.clean
        ? '<div class="ok-banner">✓ 원본 수치 일치 검증 통과 (임의 추가된 숫자 없음)</div>'
        : '<div class="warn">⚠ 원본에 없던 숫자(' + esc(numCheck.hallucinatedNumbers.join(', ')) + ')가 감지되었습니다. 반드시 대조 후 반영하세요.</div>';

      openModal('✨ AI 윤문 결과 비교 확인', warnBanner + '<textarea id="aiPolishedTxt" aria-label="AI 윤문 결과 본문" rows="12">' + esc(unmasked) + '</textarea>',
        '<button class="sm" data-close-modal="1">취소</button><button class="sm pri" id="applyAiPolishBtn">본문에 반영 (고정 켬)</button>', 'wide');

      if ($('applyAiPolishBtn')) {
        $('applyAiPolishBtn').onclick = function () {
          if (!isSessionCurrent(aiSess.epoch, aiSess.uid) || CUR_PID !== reqPid) return;
          var curTa = $((mode === 'mid' ? 'midSec_' : 'finalSec_') + secKey);
          if (curTa) curTa.value = $('aiPolishedTxt').value;
          var lockCb = document.querySelector('input[data-' + mode + '-lock="' + secKey + '"]');
          if (lockCb) lockCb.checked = true;
          closeModal();
          toast('윤문 문안이 입력칸에 반영되었습니다. [💾 저장]을 눌러 확정하세요.');
        };
      }
    } catch (e) {
      if (!isSessionCurrent(aiSess.epoch, aiSess.uid)) return;
      toast('AI 윤문 호출 실패: ' + (e.message || e));
    }
  }

  function copyTextToClipboard(text) {
    if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(function () {});
    }
  }

  /* ══ 7. 산출물 생성 도우미 (HWPX · 푸른한글 · XLSX · TXT · 통합 ZIP) ═════ */
  function downloadRawBytes(bytes, fileName, mimeType) {
    if (typeof document === 'undefined') return;
    var blob = new Blob([bytes], { type: mimeType || 'application/octet-stream' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
  }

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

  function generateWorkbookXlsxBytes(proj, mid, fin) {
    if (!global.XLSX) throw new Error('엑셀 생성 엔진(XLSX)이 로드되지 않았습니다.');
    var wb = global.XLSX.utils.book_new();
    var ag = Cat().getAgency(proj.agency);

    var s1 = [['회차', '수행일자', '수행방식', '자문 주제', '시간·참석', '사진·일지 증빙']].concat(
      (fin.structured.roundCheck.rounds || []).map(function (r) {
        return [r.roundNo + '회차', r.date, r.modeLabel, r.topic, r.mins + '분 / 기업 ' + r.companyPeople + '인', (r.hasPhoto && r.hasSign) ? '완료' : '확인필요'];
      })
    );
    global.XLSX.utils.book_append_sheet(wb, global.XLSX.utils.aoa_to_sheet(s1), '01_회차수행점검');

    var s2 = [
      ['[' + ag.short + '] 최근 3개년 재무 추이 (비식별 집계)'],
      ['회계연도', '매출액', '영업이익', '당기순이익']
    ].concat(mid.structured.finRows || []).concat([
      [],
      ['[부서·직군별 인력 분포]'],
      ['부서·직군', '재직인원', '비중']
    ]).concat(mid.structured.deptRows || []);
    global.XLSX.utils.book_append_sheet(wb, global.XLSX.utils.aoa_to_sheet(s2), '02_재무인력통계');

    var s3 = [['직무군 구분', '대상 공정·업무', '전환 방향', '재설계 · 재배치 실행조치']].concat(fin.structured.jobMatrixRows || []);
    global.XLSX.utils.book_append_sheet(wb, global.XLSX.utils.aoa_to_sheet(s3), '03_직무전환매트릭스');

    var s4 = [['협의 항목', '중간보고 기준선', '최종 확정 설계안', '상태']].concat(fin.structured.diffSummaryRows || []);
    global.XLSX.utils.book_append_sheet(wb, global.XLSX.utils.aoa_to_sheet(s4), '04_후속협의Diff');

    var s5 = [['개정 대상 조항', '현행 규정', '개정(신설)안', '정비 근거']].concat(fin.structured.sinGuRows || []);
    global.XLSX.utils.book_append_sheet(wb, global.XLSX.utils.aoa_to_sheet(s5), '05_취업규칙신구대조');

    var fuMap = (proj.followupChecks && typeof proj.followupChecks === 'object') ? proj.followupChecks : {};
    var fuRows = Cat().getFollowupItems(ag.code).map(function (f) {
      return [f.month, f.title, f.proof, fuMap[f.code] ? '이행완료' : '점검예정'];
    });
    var s6 = [['연계 지원사업명', '주관기관', '핵심 지원내용 및 요건', '연계 순위']]
      .concat(fin.structured.govMatchRows || [])
      .concat([[], ['[사후관리·정책매니저·장려금 점검표]'], ['단계', '점검 항목', '구비 증빙', '상태']])
      .concat(fuRows);
    global.XLSX.utils.book_append_sheet(wb, global.XLSX.utils.aoa_to_sheet(s6), '06_지원사업_사후관리');

    var out = global.XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    return new Uint8Array(out);
  }

  async function downloadDeliverablesZip(proj, selectedIds, optEpoch, optUid) {
    await ensureJobtransLibs({ zip: true, xlsx: selectedIds.indexOf('data_xlsx') >= 0 });
    if (!Hwpx() || !global.JSZip) { toast('패키지 생성 엔진이 로드되지 않았습니다.'); return false; }
    var live = buildLiveReportsForExport(proj);
    var safeCo = Hwpx().safeFilePart(proj.companyName);
    var agTag = proj.agency === 'cepa' ? '충남경제진흥원' : 'KMAC구조혁신';
    var idSet = {};
    selectedIds.forEach(function (id) { idSet[id] = 1; });

    var zip = new global.JSZip();
    if (idSet.mid_hwpx) {
      zip.file('01_' + Hwpx().suggestedFileName('mid', proj), Hwpx().generateHwpxBytes('mid', proj, live.mid, live.fin));
    }
    if (idSet.final_hwpx) {
      zip.file('02_' + Hwpx().suggestedFileName('final', proj), Hwpx().generateHwpxBytes('final', proj, live.mid, live.fin));
    }
    if (idSet.comp_hwpx) {
      zip.file('03_' + Hwpx().suggestedFileName('completion', proj), Hwpx().generateHwpxBytes('completion', proj, live.mid, live.fin));
    }
    if (idSet.data_xlsx && global.XLSX) {
      zip.file('04_' + safeCo + '_' + agTag + '_직무매트릭스_신구대조_점검표.xlsx', generateWorkbookXlsxBytes(proj, live.mid, live.fin));
    }
    if (idSet.sub_txt) {
      var sub = Report().buildSubmissionTexts(proj, live.mid, live.fin, D.intake[proj.id] || {}, live.schedRds);
      zip.file('05_' + safeCo + '_' + agTag + '_수행계획_완료계_일지문안.txt', buildCombinedSubmissionTextFile(proj, sub));
    }
    var zipBytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
    if (optEpoch != null && !isSessionCurrent(optEpoch, optUid)) return false;
    downloadRawBytes(zipBytes, safeCo + '_' + agTag + '_산출물_' + selectedIds.length + '종패키지.zip', 'application/zip');
    return true;
  }

  /* ══ 8. 이벤트 바인딩 (끌어고르기 포함) 및 일괄 실행 ═════════════════════ */
  function readCurrentMidSectionsFromDom(proj) {
    var saved = D.mid[proj.id] || {};
    var secs = Object.assign({}, saved.sections || {});
    var locks = Object.assign({}, saved.locks || {});
    Cat().getMidSections(proj.agency).forEach(function (s) {
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
    Cat().getFinalSections(proj.agency, proj.track).forEach(function (s) {
      var ta = $('finalSec_' + s.key);
      if (ta) secs[s.key] = ta.value;
      var cb = document.querySelector('input[data-final-lock="' + s.key + '"]');
      if (cb) locks[s.key] = !!cb.checked;
    });
    return { sections: secs, locks: locks };
  }

  function buildDiscoverProjectPayload(c) {
    var co = findCompanyById(c.companyId);
    var agCode = c.agency === 'cepa' ? 'cepa' : 'kmac';
    var trCode = Cat().getTrack(c.track, agCode).code;
    var id = 'jt_' + safeKey(c.companyId) + '_' + agCode + '_' + (c.year || 2026);
    return {
      id: id,
      entityType: 'Project',
      companyId: c.companyId,
      companyName: c.companyName,
      bizNo: c.bizNo,
      contractNo: str(c.contractNo || ''),
      ceoName: co ? str(co.ceo || co.ceoName) : '',
      contactName: contactNameOfCompany(co),
      agency: agCode,
      track: trCode,
      industry: c.industry,
      year: c.year || 2026,
      contactEmails: c.contactEmail ? [c.contactEmail] : [],
      consultingId: c.consultingId || '',
      scalCoId: c.scalCoId || '',
      scalTypeId: c.scalTypeId || '',
      selectedTasks: agCode === 'cepa'
        ? ['jt_impact', 'jt_job_redesign', 'jt_reskill', 'jt_gov_match']
        : ['jt_impact', 'jt_job_redesign', 'jt_reskill', 'jt_emp_stab'],
      consultantName: ME.name ? ME.name + ' 공인노무사' : '푸른노무법인 전담 공인노무사'
    };
  }

  function applyAgencyScope(nextScope) {
    var norm = nextScope === 'kmac' ? 'kmac' : (nextScope === 'cepa' ? 'cepa' : (nextScope === 'stack' ? 'stack' : ''));
    AGENCY_SCOPE = norm;
    if ($('projAgency')) $('projAgency').value = norm;
    if (norm === 'kmac' || norm === 'cepa') {
      var cur = projectById(CUR_PID);
      var curAg = cur && cur.agency === 'cepa' ? 'cepa' : (cur ? 'kmac' : '');
      if (!cur || curAg !== norm) {
        var matchProj = activeProjects().find(function (p) {
          return (p.agency === 'cepa' ? 'cepa' : 'kmac') === norm;
        });
        if (matchProj) CUR_PID = matchProj.id;
      }
    }
    clearSel('projects');
    clearSel('projectsKmac');
    clearSel('projectsCepa');
  }

  var _wbTimer = null;
  function scheduleSideWorkbenchRefresh(mode) {
    clearTimeout(_wbTimer);
    _wbTimer = setTimeout(function () {
      var proj = projectById(CUR_PID);
      if (!proj) return;
      var schedRds = schedRoundsForProject(proj);
      if (mode === 'mid' && $('midSideWorkbench')) {
        var domM = readCurrentMidSectionsFromDom(proj);
        var midObj = Report().buildMidReport(proj, D.intake[proj.id] || {}, schedRds, D.mid[proj.id] || null);
        midObj.sections = Object.assign({}, midObj.sections, domM.sections);
        $('midSideWorkbench').innerHTML = renderReportSideWorkbenchHtml(proj, 'mid', midObj, midObj, null, schedRds);
        drawBulks();
      } else if (mode === 'final' && $('finalSideWorkbench')) {
        var domF = readCurrentFinalSectionsFromDom(proj);
        var midBase = Report().buildMidReport(proj, D.intake[proj.id] || {}, schedRds, D.mid[proj.id] || null);
        var finObj = Report().buildFinalReport(proj, midBase, D.intake[proj.id] || {}, schedRds, D.final[proj.id] || null);
        finObj.sections = Object.assign({}, finObj.sections, domF.sections);
        $('finalSideWorkbench').innerHTML = renderReportSideWorkbenchHtml(proj, 'final', finObj, midBase, finObj, schedRds);
        drawBulks();
      }
    }, 220);
  }

  async function activateDiscoverCandidate(candKey, reqEpoch, reqUid) {
    var c = DISCOVER_LIST.find(function (x) { return x.candKey === candKey; });
    if (!c) return null;
    return saveProjectRecord(buildDiscoverProjectPayload(c), reqEpoch, reqUid);
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
    if ($('linkFolderBtn')) {
      $('linkFolderBtn').onclick = function () {
        return withBusy($('linkFolderBtn'), function () { return connectConsultingFolder(); });
      };
    }
    if ($('changeFolderBtn')) {
      $('changeFolderBtn').onclick = function () {
        return withBusy($('changeFolderBtn'), function () { return connectConsultingFolder(); });
      };
    }
    if ($('reconnectFolderBtn')) {
      $('reconnectFolderBtn').onclick = function () {
        return withBusy($('reconnectFolderBtn'), function () { return reconnectSavedFolder(); });
      };
    }
    if ($('folderFallbackInput')) {
      $('folderFallbackInput').addEventListener('change', function () {
        handleFallbackFolderFiles($('folderFallbackInput').files);
      });
    }
    if ($('scanAllBtn')) {
      $('scanAllBtn').onclick = function () {
        rebuildScanAndDiscover();
        draw();
        toast('전체 사업장 푸른메일함 수신 현황 재점검 완료');
      };
    }
    if ($('newProjBtn')) $('newProjBtn').onclick = openNewProjectModal;
    ['projQ', 'projAgency', 'projYear', 'projStage'].forEach(function (id) {
      var el = $(id);
      if (!el) return;
      el.addEventListener(id === 'projQ' ? 'input' : 'change', function () {
        if (id === 'projAgency') applyAgencyScope(el.value);
        clearSel('projects');
        clearSel('projectsKmac');
        clearSel('projectsCepa');
        draw();
      });
    });

    document.addEventListener('input', function (e) {
      var tid = (e.target && e.target.id) ? String(e.target.id) : '';
      if (tid.indexOf('midSec_') === 0) scheduleSideWorkbenchRefresh('mid');
      else if (tid.indexOf('finalSec_') === 0) scheduleSideWorkbenchRefresh('final');
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
      var yearBtn = e.target.closest('[data-set-year]');
      if (yearBtn) {
        YEAR_FILTER = yearBtn.getAttribute('data-set-year') || '';
        clearSel();
        draw();
        return;
      }

      var detailBtn = e.target.closest('[data-open-detail]');
      if (detailBtn) {
        openProjectDetailModal(detailBtn.getAttribute('data-open-detail'));
        return;
      }

      var pdAttBtn = e.target.closest('[data-pd-att]');
      if (pdAttBtn) {
        await withBusy(pdAttBtn, function () { return showDetailMailAtts(pdAttBtn.getAttribute('data-pd-att')); });
        return;
      }

      var pdOpenBtn = e.target.closest('[data-pd-open]');
      if (pdOpenBtn) {
        var pdSpec = pdOpenBtn.getAttribute('data-pd-open') || '';
        /* «보기»는 누른 그 순간 빈 창을 연다 — 첨부를 받은 뒤에 열면 팝업 차단에 걸린다 */
        var preWin = null;
        if (pdSpec.indexOf('view:') === 0) {
          try { preWin = global.open('about:blank', '_blank'); } catch (eWin) { preWin = null; }
        }
        await withBusy(pdOpenBtn, function () { return openDetailAtt(pdSpec, preWin); });
        return;
      }

      var finalOkBtn = e.target.closest('[data-final-ok]');
      if (finalOkBtn) {
        var okPid = finalOkBtn.getAttribute('data-final-ok');
        await withBusy(finalOkBtn, async function () {
          var okDone = await confirmFinalFromMail([okPid]);
          if (okDone) { closeModal(true); draw(); openProjectDetailModal(okPid); }
        });
        return;
      }

      var scopeBtn = e.target.closest('[data-set-agency-scope]');
      if (scopeBtn) {
        applyAgencyScope(scopeBtn.getAttribute('data-set-agency-scope') || '');
        var nextTabAttr = scopeBtn.getAttribute('data-goto-tab');
        if (nextTabAttr) TAB = nextTabAttr;
        clearSel();
        draw();
        return;
      }

      var gotoBtn = e.target.closest('[data-goto-tab]');
      if (gotoBtn) {
        TAB = gotoBtn.getAttribute('data-goto-tab');
        clearSel();
        draw();
        return;
      }

      var openProjBtn = e.target.closest('[data-open-proj]');
      if (openProjBtn) {
        if ($('modal') && $('modal').style && $('modal').style.display !== 'none') closeModal(true);
        CUR_PID = openProjBtn.getAttribute('data-open-proj');
        TAB = openProjBtn.getAttribute('data-open-tab') || 'intake';
        clearSel();
        draw();
        return;
      }

      var importFgrpBtn = e.target.closest('[data-import-fgrp]');
      if (importFgrpBtn) {
        var fgrpSess = captureCurrentSession();
        if (!fgrpSess) return;
        await withBusy(importFgrpBtn, async function () {
          await importFolderWorkplaceGroup(
            importFgrpBtn.getAttribute('data-import-fgrp'),
            false,
            fgrpSess.epoch,
            fgrpSess.uid,
            importFgrpBtn.getAttribute('data-boundary-hash') || ''
          );
        });
        return;
      }

      var actCand = e.target.closest('[data-activate-cand]');
      if (actCand) {
        var candSess = captureCurrentSession();
        if (!candSess) return;
        await withBusy(actCand, async function () {
          var created = await activateDiscoverCandidate(actCand.getAttribute('data-activate-cand'), candSess.epoch, candSess.uid);
          if (created && isSessionCurrent(candSess.epoch, candSess.uid)) {
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
        var chkSess = captureCurrentSession();
        if (!chkSess) return;
        await withBusy(toggleChkBtn, async function () {
          var projC = projectById(CUR_PID);
          if (!projC) return;
          var dkCode = toggleChkBtn.getAttribute('data-toggle-chk');
          var ph = toggleChkBtn.getAttribute('data-phase') || 'pre_mid';
          var mc = Object.assign({}, projC.manualChecks || {});
          var sub = Object.assign({}, mc[ph] || {});
          sub[dkCode] = !sub[dkCode];
          mc[ph] = sub;
          var savedC = await saveProjectRecord(Object.assign({}, projC, { manualChecks: mc }), chkSess.epoch, chkSess.uid);
          if (!savedC || !isSessionCurrent(chkSess.epoch, chkSess.uid)) return;
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
        var rpSess = captureCurrentSession();
        if (!rpSess) return;
        await withBusy(toggleRdProofBtn, async function () {
          var projRP = projectById(CUR_PID);
          if (!projRP) return;
          var rno = Number(toggleRdProofBtn.getAttribute('data-toggle-round-proof'));
          var rds = currentNormalizedRounds(projRP).map(function (r) {
            if (Number(r.roundNo) !== rno) return r;
            var nextOk = !(r.hasPhoto && r.hasSign);
            return Object.assign({}, r, { hasPhoto: nextOk, hasSign: nextOk });
          });
          var savedRP = await saveProjectRecord(Object.assign({}, projRP, { rounds: rds }), rpSess.epoch, rpSess.uid);
          if (!savedRP || !isSessionCurrent(rpSess.epoch, rpSess.uid)) return;
          draw();
          toast(rno + '회차 사진·수행일지 증빙 상태가 변경되었습니다.');
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
        var fuSess = captureCurrentSession();
        if (!fuSess) return;
        await withBusy(toggleFuBtn, async function () {
          var projFu = projectById(CUR_PID);
          if (!projFu) return;
          var fuCode = toggleFuBtn.getAttribute('data-toggle-followup');
          var nextFu = Object.assign({}, projFu.followupChecks || {});
          nextFu[fuCode] = !nextFu[fuCode];
          var savedFu = await saveProjectRecord(Object.assign({}, projFu, { followupChecks: nextFu }), fuSess.epoch, fuSess.uid);
          if (!savedFu || !isSessionCurrent(fuSess.epoch, fuSess.uid)) return;
          draw();
          toast(nextFu[fuCode] ? '이행완료로 체크되었습니다.' : '점검예정 상태로 변경되었습니다.');
        });
        return;
      }

      var mailIns = e.target.closest('[data-mail-inspect]');
      if (mailIns) {
        var miSess = captureCurrentSession();
        if (!miSess) return;
        await withBusy(mailIns, function () {
          return inspectAndAnalyzeMail(mailIns.getAttribute('data-mail-inspect'), mailIns.getAttribute('data-phase') || 'pre_mid', false, miSess.epoch, miSess.uid);
        });
        return;
      }

      var mailChk = e.target.closest('[data-mail-check]');
      if (mailChk) {
        var mcSess = captureCurrentSession();
        if (!mcSess) return;
        await withBusy(mailChk, async function () {
          var checkedCard = await markMailCheckedOnly(mailChk.getAttribute('data-mail-check'), mailChk.getAttribute('data-phase') || 'pre_mid', mcSess.epoch, mcSess.uid);
          if (!checkedCard || !isSessionCurrent(mcSess.epoch, mcSess.uid)) return;
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
        var msSess = captureCurrentSession();
        if (!msSess) return;
        await withBusy(saveMidSec, async function () {
          var projM = projectById(CUR_PID);
          if (!projM) return;
          var domMid = readCurrentMidSectionsFromDom(projM);
          var savedM = await saveMidDoc(projM, domMid.sections, domMid.locks, msSess.epoch, msSess.uid);
          if (!savedM || !isSessionCurrent(msSess.epoch, msSess.uid)) return;
          toast('중간보고서 섹션이 저장되었습니다.');
        });
        return;
      }

      var saveFinSec = e.target.closest('[data-save-final-sec]');
      if (saveFinSec && CUR_PID) {
        var fsSess = captureCurrentSession();
        if (!fsSess) return;
        await withBusy(saveFinSec, async function () {
          var projF = projectById(CUR_PID);
          if (!projF) return;
          var domFin = readCurrentFinalSectionsFromDom(projF);
          var savedF = await saveFinalDoc(projF, domFin.sections, domFin.locks, fsSess.epoch, fsSess.uid);
          if (!savedF || !isSessionCurrent(fsSess.epoch, fsSess.uid)) return;
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

      if (!e.target.closest('input,button,select,a,label,textarea')) {
        var tr = e.target.closest('tr[data-row][data-tname="projects"], tr[data-row][data-tname="projectsKmac"], tr[data-row][data-tname="projectsCepa"]');
        if (tr) {
          /* 줄을 누르면 진행 기록·완료보고서 창 — 단계 탭으로는 줄 끝 ①②③ 단추로 간다 */
          openProjectDetailModal(tr.getAttribute('data-row'));
        }
      }
    });
  }

  async function handleBulkAction(spec) {
    var reqEpoch = SESSION_EPOCH;
    var reqUid = ME && ME.uid ? String(ME.uid) : '';
    if (!isSessionCurrent(reqEpoch, reqUid)) return;
    var parts = spec.split(':');
    var nm = parts[0], op = parts[1];
    if (op === 'clear') { clearSel(nm); drawBulks(); return; }
    var ids = pickedIds(nm);
    if (!ids.length) return;
    var proj = projectById(CUR_PID);

    if (nm === 'folderSync' && op === 'import') {
      if (!askConfirm('선택한 폴더 사업장 ' + ids.length + '곳의 산업·일자리전환 자료를 일괄 비식별 반영하시겠습니까?')) return;
      var lastImported = null;
      for (var fg = 0; fg < ids.length; fg++) {
        if (!isSessionCurrent(reqEpoch, reqUid)) return;
        var imp = await importFolderWorkplaceGroup(ids[fg], true, reqEpoch, reqUid);
        if (imp) lastImported = imp;
      }
      if (!isSessionCurrent(reqEpoch, reqUid)) return;
      if (lastImported && !CUR_PID) CUR_PID = lastImported.id;
      clearSel(nm);
      rebuildScanAndDiscover();
      draw();
      toast('컨설팅폴더 사업장 ' + ids.length + '곳 자료 일괄 반영 완료');
    } else if (nm === 'discover' && op === 'activate') {
      if (!askConfirm('선택한 자동 발견 후보 ' + ids.length + '건을 일괄 워크스페이스 활성화하시겠습니까?')) return;
      var actEntries = [];
      ids.forEach(function (ck) {
        var cand = DISCOVER_LIST.find(function (x) { return x.candKey === ck; });
        if (!cand) return;
        var rec = buildDiscoverProjectPayload(cand);
        actEntries.push({
          path: 'scal_jobtrans/projects/' + rec.id,
          previous: D.projects[rec.id] || null,
          record: rec,
          entityType: 'Project'
        });
      });
      var savedAct = await atomicMultiRecordUpdate(actEntries, reqEpoch, reqUid);
      if (!savedAct || !isSessionCurrent(reqEpoch, reqUid)) return;
      Object.keys(savedAct).forEach(function (pathKey) {
        var val = savedAct[pathKey];
        if (val && val.id) D.projects[val.id] = val;
      });
      clearSel(nm);
      rebuildScanAndDiscover();
      draw();
      toast(actEntries.length + '개 사업장 워크스페이스 활성화 완료');
    } else if ((nm === 'projects' || nm === 'projectsKmac' || nm === 'projectsCepa') && op === 'finalok') {
      var finOk = await confirmFinalFromMail(ids);
      if (!finOk || !isSessionCurrent(reqEpoch, reqUid)) return;
      clearSel(nm);
      draw();
    } else if (nm === 'projMails' && op === 'copy') {
      var pdProj = projectById(DETAIL_PID);
      var pickSet = {};
      ids.forEach(function (k) { pickSet[k] = 1; });
      var copyLines = detailTimelineRows(pdProj).filter(function (r) { return pickSet[r.id]; }).map(function (r) {
        return [r.m.date || '', r.m.dir === 'out' ? '보냄' : '받음', r.kindLabel, str(r.m.subject)].join('	');
      });
      copyTextToClipboard(copyLines.join('\n'));
      toast('진행 기록 ' + copyLines.length + '줄을 복사했습니다.');
      clearSel(nm);
      drawBulks();
    } else if ((nm === 'projects' || nm === 'projectsKmac' || nm === 'projectsCepa') && op === 'del') {
      if (typeof global.confirm === 'function' && !global.confirm('선택한 사업장 ' + ids.length + '건을 목록에서 숨김(소프트 삭제) 처리하시겠습니까?')) return;
      var delProjEntries = [];
      ids.forEach(function (pid) {
        var rec = D.projects[pid];
        if (rec) {
          delProjEntries.push({
            path: 'scal_jobtrans/projects/' + rec.id,
            previous: rec,
            tombstone: true,
            entityType: 'Project'
          });
        }
      });
      var delRes = await atomicMultiRecordUpdate(delProjEntries, reqEpoch, reqUid);
      if (!delRes || !isSessionCurrent(reqEpoch, reqUid)) return;
      ids.forEach(function (pid) { if (D.projects[pid]) D.projects[pid]._deleted = true; });
      clearSel(nm);
      rebuildScanAndDiscover();
      draw();
      toast('선택 사업장 ' + delProjEntries.length + '건을 목록에서 숨겼습니다(소프트 삭제).');
    } else if ((nm === 'formReviewKmac' || nm === 'formReviewCepa') && op === 'hwpx') {
      if (!Hwpx()) { toast('한글(.hwpx) 생성 엔진이 준비되지 않았습니다.'); return; }
      if (!askConfirm('선택한 사업장 ' + ids.length + '곳의 소속기관 맞춤 최종결과보고서(.hwpx)를 일괄 생성·다운로드하시겠습니까?')) return;
      ids.forEach(function (pid) {
        var pItem = projectById(pid);
        if (!pItem) return;
        var sRds = schedRoundsForProject(pItem);
        var mItem = Report().buildMidReport(pItem, D.intake[pItem.id] || {}, sRds, D.mid[pItem.id] || null);
        var fItem = Report().buildFinalReport(pItem, mItem, D.intake[pItem.id] || {}, sRds, D.final[pItem.id] || null);
        var fnOut = Hwpx().suggestedFileName('final', pItem);
        Hwpx().downloadHwpxBytes(Hwpx().generateHwpxBytes('final', pItem, mItem, fItem), fnOut);
      });
      clearSel(nm);
      drawBulks();
      toast(ids.length + '곳 소속기관 맞춤 최종결과보고서(.hwpx) 생성 완료');
    } else if ((nm === 'midReview' || nm === 'finalReview') && op === 'copy' && proj) {
      var sRdsRev = schedRoundsForProject(proj);
      var mRev = Report().buildMidReport(proj, D.intake[proj.id] || {}, sRdsRev, D.mid[proj.id] || null);
      var fRev = Report().buildFinalReport(proj, mRev, D.intake[proj.id] || {}, sRdsRev, D.final[proj.id] || null);
      var revEval = Report().evaluateReportFormReview(proj, nm === 'finalReview' ? 'final' : 'mid', nm === 'finalReview' ? fRev : mRev, D.intake[proj.id] || {}, sRdsRev);
      var idMapRev = {};
      ids.forEach(function (c) { idMapRev[c] = 1; });
      var linesRev = revEval.checks.filter(function (c) { return !!idMapRev[c.code]; }).map(function (c) {
        return '[' + c.statusLabel + '] ' + c.label + ' — ' + c.detail;
      });
      copyTextToClipboard(linesRev.join('\n'));
      clearSel(nm);
      drawBulks();
      toast('선택 검수항목 ' + linesRev.length + '건을 복사했습니다.');
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
      var savedChkProj = await saveProjectRecord(Object.assign({}, proj, { manualChecks: mcAll }), reqEpoch, reqUid);
      if (!savedChkProj || !isSessionCurrent(reqEpoch, reqUid)) return;
      clearSel(nm);
      draw();
      toast(ids.length + '건 체크리스트 상태가 한 번에 저장되었습니다.');
    } else if ((nm === 'preMails' || nm === 'postMails' || nm === 'candMails') && (op === 'analyze' || op === 'check') && proj) {
      var phMail = nm === 'postMails' ? 'post_mid' : 'pre_mid';
      if (!askConfirm('선택한 메일 ' + ids.length + '건을 일괄 ' + (op === 'analyze' ? '내용확인·분석' : '확인완료 표시') + ' 처리하시겠습니까?')) return;
      if (op === 'check') {
        var mailEntries = [];
        ids.forEach(function (mk) {
          var built = buildCheckedMailCardPayload(proj, mk, phMail);
          if (built) {
            mailEntries.push({
              path: 'scal_jobtrans/intake/' + proj.id + '/' + built.record.id,
              previous: built.prev,
              record: built.record,
              entityType: 'Document'
            });
          }
        });
        var savedMails = await atomicMultiRecordUpdate(mailEntries, reqEpoch, reqUid);
        if (!savedMails || !isSessionCurrent(reqEpoch, reqUid)) return;
        if (!D.intake[proj.id]) D.intake[proj.id] = {};
        Object.keys(savedMails).forEach(function (pk) {
          var v = savedMails[pk];
          if (v && v.id) D.intake[proj.id][v.id] = v;
        });
      } else {
        for (var m = 0; m < ids.length; m++) {
          if (!isSessionCurrent(reqEpoch, reqUid)) return;
          await inspectAndAnalyzeMail(ids[m], phMail, true, reqEpoch, reqUid);
        }
        if (!isSessionCurrent(reqEpoch, reqUid)) return;
      }
      clearSel(nm);
      rebuildScanAndDiscover();
      draw();
      toast(ids.length + '건 메일 일괄 처리 완료');
    } else if ((nm === 'preCards' || nm === 'postCards') && op === 'del' && CUR_PID) {
      if (typeof global.confirm === 'function' && !global.confirm('선택한 분석카드 ' + ids.length + '건을 삭제하시겠습니까?')) return;
      var cardDelPid = CUR_PID;
      var cardDelEntries = [];
      ids.forEach(function (cid) {
        var prevC = D.intake[cardDelPid] && D.intake[cardDelPid][cid];
        if (prevC) {
          cardDelEntries.push({
            path: 'scal_jobtrans/intake/' + cardDelPid + '/' + prevC.id,
            previous: prevC,
            tombstone: true,
            entityType: 'Document'
          });
        }
      });
      var cardDelRes = await atomicMultiRecordUpdate(cardDelEntries, reqEpoch, reqUid);
      if (!cardDelRes || !isSessionCurrent(reqEpoch, reqUid)) return;
      ids.forEach(function (cid) { if (D.intake[cardDelPid] && D.intake[cardDelPid][cid]) D.intake[cardDelPid][cid]._deleted = true; });
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
      var savedRds = await saveProjectRecord(Object.assign({}, proj, { rounds: nextRds }), reqEpoch, reqUid);
      if (!savedRds || !isSessionCurrent(reqEpoch, reqUid)) return;
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
      var savedSecs = isMid
        ? await saveMidDoc(proj, nextSecs, nextLocks, reqEpoch, reqUid)
        : await saveFinalDoc(proj, nextSecs, nextLocks, reqEpoch, reqUid);
      if (!savedSecs || !isSessionCurrent(reqEpoch, reqUid)) return;
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
      var savedDiffBulk = await saveProjectRecord(Object.assign({}, proj, { diffStatusMap: nextStMap, customDiffRows: nextCust }), reqEpoch, reqUid);
      if (!savedDiffBulk || !isSessionCurrent(reqEpoch, reqUid)) return;
      clearSel(nm);
      draw();
      toast('선택 Diff 항목 ' + ids.length + '건이 반영되었습니다.');
    } else if (nm === 'deliverables' && op === 'zip' && proj) {
      var zipDone = await downloadDeliverablesZip(proj, ids, reqEpoch, reqUid);
      if (!zipDone || !isSessionCurrent(reqEpoch, reqUid)) return;
      clearSel(nm);
      drawBulks();
      toast('선택 산출물 ' + ids.length + '종 통합 ZIP 파일을 생성했습니다.');
    } else if (nm === 'followups' && proj) {
      var doneFlag = op === 'done';
      if (!askConfirm('선택한 사후 이행점검 ' + ids.length + '건을 일괄 ' + (doneFlag ? '이행완료' : '점검예정') + ' 처리하시겠습니까?')) return;
      var nextFuMap = Object.assign({}, proj.followupChecks || {});
      ids.forEach(function (code) { nextFuMap[code] = doneFlag; });
      var savedFuBulk = await saveProjectRecord(Object.assign({}, proj, { followupChecks: nextFuMap }), reqEpoch, reqUid);
      if (!savedFuBulk || !isSessionCurrent(reqEpoch, reqUid)) return;
      clearSel(nm);
      draw();
      toast('사후 이행관리 ' + ids.length + '건 상태가 한 번에 저장되었습니다.');
    }
  }

  async function handleNamedAction(act) {
    var s = captureCurrentSession();
    if (!s) return;
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
    } else if (act === 'preview-mid') {
      openReportPreviewModal(proj, 'mid');
    } else if (act === 'preview-final') {
      openReportPreviewModal(proj, 'final');
    } else if (act === 'preview-comp') {
      openReportPreviewModal(proj, 'completion');
    } else if (act === 'dl-mid-hwpx' && Hwpx()) {
      var liveM = buildLiveReportsForExport(proj);
      var fnM = Hwpx().suggestedFileName('mid', proj);
      Hwpx().downloadHwpxBytes(Hwpx().generateHwpxBytes('mid', proj, liveM.mid, liveM.fin), fnM);
      toast(fnM + ' 한글 파일을 다운로드했습니다.');
    } else if (act === 'dl-final-hwpx' && Hwpx()) {
      var liveF = buildLiveReportsForExport(proj);
      var fnF = Hwpx().suggestedFileName('final', proj);
      Hwpx().downloadHwpxBytes(Hwpx().generateHwpxBytes('final', proj, liveF.mid, liveF.fin), fnF);
      toast(fnF + ' 한글 파일을 다운로드했습니다.');
    } else if (act === 'dl-comp-hwpx' && Hwpx()) {
      var liveC = buildLiveReportsForExport(proj);
      var fnC = Hwpx().suggestedFileName('completion', proj);
      Hwpx().downloadHwpxBytes(Hwpx().generateHwpxBytes('completion', proj, liveC.mid, liveC.fin), fnC);
      toast(fnC + ' 한글 파일을 다운로드했습니다.');
    } else if (act === 'open-mid-hangul' && Hwpx()) {
      var liveHM = buildLiveReportsForExport(proj);
      Hwpx().openInHangulEditor('mid', proj, liveHM.mid, liveHM.fin);
      toast('새 탭에서 푸른한글 편집기로 중간보고서를 열었습니다.');
    } else if (act === 'open-final-hangul' && Hwpx()) {
      var liveHF = buildLiveReportsForExport(proj);
      Hwpx().openInHangulEditor('final', proj, liveHF.mid, liveHF.fin);
      toast('새 탭에서 푸른한글 편집기로 최종결과보고서를 열었습니다.');
    } else if (act === 'open-comp-hangul' && Hwpx()) {
      var liveHC = buildLiveReportsForExport(proj);
      Hwpx().openInHangulEditor('completion', proj, liveHC.mid, liveHC.fin);
      toast('새 탭에서 푸른한글 편집기로 완료계·완료보고서를 열었습니다.');
    } else if (act === 'print-mid' && Hwpx()) {
      var livePM = buildLiveReportsForExport(proj);
      if (!Hwpx().openPrintWindow('mid', proj, livePM.mid, livePM.fin)) toast('팝업 차단을 해제해 주세요.');
    } else if (act === 'print-final' && Hwpx()) {
      var livePF = buildLiveReportsForExport(proj);
      if (!Hwpx().openPrintWindow('final', proj, livePF.mid, livePF.fin)) toast('팝업 차단을 해제해 주세요.');
    } else if (act === 'print-comp' && Hwpx()) {
      var livePC = buildLiveReportsForExport(proj);
      if (!Hwpx().openPrintWindow('completion', proj, livePC.mid, livePC.fin)) toast('팝업 차단을 해제해 주세요.');
    } else if (act === 'dl-data-xlsx') {
      await ensureJobtransLibs({ xlsx: true });
      var liveX = buildLiveReportsForExport(proj);
      var safeCo = Hwpx() ? Hwpx().safeFilePart(proj.companyName) : safeKey(proj.companyName);
      var agTag = proj.agency === 'cepa' ? '충남경제진흥원' : 'KMAC구조혁신';
      var xlsxBytes = generateWorkbookXlsxBytes(proj, liveX.mid, liveX.fin);
      downloadRawBytes(xlsxBytes, safeCo + '_' + agTag + '_직무매트릭스_신구대조_점검표.xlsx',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      toast('별첨 비식별 데이터·매트릭스·점검표(.xlsx, 6개 시트)를 다운로드했습니다.');
    } else if (act === 'dl-sub-txt') {
      var liveT = buildLiveReportsForExport(proj);
      var subTxt = Report().buildSubmissionTexts(proj, liveT.mid, liveT.fin, D.intake[proj.id] || {}, liveT.schedRds);
      var safeCoT = Hwpx() ? Hwpx().safeFilePart(proj.companyName) : safeKey(proj.companyName);
      var agTagT = proj.agency === 'cepa' ? '충남경제진흥원' : 'KMAC구조혁신';
      downloadRawBytes(new TextEncoder().encode(buildCombinedSubmissionTextFile(proj, subTxt)),
        safeCoT + '_' + agTagT + '_수행계획_완료계_일지문안.txt', 'text/plain;charset=utf-8');
      toast('제출용 수행계획·완료계·수행일지 문안(.txt)을 다운로드했습니다.');
    } else if (act === 'dl-full-zip') {
      var fullZipOk = await downloadDeliverablesZip(proj, ['mid_hwpx', 'final_hwpx', 'comp_hwpx', 'data_xlsx', 'sub_txt'], s.epoch, s.uid);
      if (!fullZipOk || !isSessionCurrent(s.epoch, s.uid)) return;
      toast('제출 산출물 5종 통합 ZIP 패키지를 다운로드했습니다.');
    } else if (act === 'open-sub-modal') {
      openSubmissionTextsModal(proj);
    } else if (act === 'save-interviews') {
      var iv = {
        exec: sanitizeMetaLabel(str($('ivExec') && $('ivExec').value), proj),
        hr: sanitizeMetaLabel(str($('ivHr') && $('ivHr').value), proj),
        worker: sanitizeMetaLabel(str($('ivWorker') && $('ivWorker').value), proj)
      };
      if (Intake().hasResidualPii(iv.exec) || Intake().hasResidualPii(iv.hr) || Intake().hasResidualPii(iv.worker)) {
        toast('인터뷰 메모에 민감 고유식별정보 패턴이 감지되어 차단했습니다.');
        return;
      }
      var savedIv = await saveProjectRecord(Object.assign({}, proj, { interviews: iv }), s.epoch, s.uid);
      if (!savedIv || !isSessionCurrent(s.epoch, s.uid)) return;
      toast('계층별 인터뷰 메모가 저장되었습니다.');
      draw();
    } else if (act === 'regen-mid') {
      var curMid = readCurrentMidSectionsFromDom(proj);
      var builtM = Report().buildMidReport(proj, D.intake[proj.id] || {}, schedRoundsForProject(proj), {
        sections: curMid.sections,
        locks: curMid.locks
      });
      var savedRegenM = await saveMidDoc(proj, builtM.sections, builtM.locks, s.epoch, s.uid);
      if (!savedRegenM || !isSessionCurrent(s.epoch, s.uid)) return;
      draw();
      toast('수집된 기초자료와 운영기관 양식에 맞춰 중간보고서가 자동 정리되었습니다(수기 고정 섹션 보존).');
    } else if (act === 'confirm-mid-baseline') {
      var domM2 = readCurrentMidSectionsFromDom(proj);
      var savedMidBase = await saveMidDoc(proj, domM2.sections, domM2.locks, s.epoch, s.uid);
      if (!savedMidBase || !isSessionCurrent(s.epoch, s.uid)) return;
      var midObj = Report().buildMidReport(proj, D.intake[proj.id] || {}, schedRoundsForProject(proj), {
        sections: domM2.sections, locks: domM2.locks
      });
      var now = Date.now();
      var snap = Report().buildMidSnapshot(proj, midObj, s.sid, now);
      var savedMidSnap = await saveImmutableSnapshot(proj, snap, s.epoch, s.uid);
      if (!savedMidSnap || !isSessionCurrent(s.epoch, s.uid)) return;
      var savedMidProj = await saveProjectRecord(Object.assign({}, proj, { midConfirmedAt: now, stage: 'design' }), s.epoch, s.uid);
      if (!savedMidProj || !isSessionCurrent(s.epoch, s.uid)) return;
      clearSel();
      rebuildScanAndDiscover();
      TAB = 'final';
      draw();
      toast('중간보고 기준선이 확정되었습니다. 이제 후속 메일 자동 감시 및 최종보고서 단계로 전환됩니다.');
    } else if (act === 'regen-final') {
      var curFin = readCurrentFinalSectionsFromDom(proj);
      var schedRdsF = schedRoundsForProject(proj);
      var baseMid = Report().buildMidReport(proj, D.intake[proj.id] || {}, schedRdsF, D.mid[proj.id] || null);
      var builtF = Report().buildFinalReport(proj, baseMid, D.intake[proj.id] || {}, schedRdsF, {
        sections: curFin.sections,
        locks: curFin.locks
      });
      var savedRegenF = await saveFinalDoc(proj, builtF.sections, builtF.locks, s.epoch, s.uid);
      if (!savedRegenF || !isSessionCurrent(s.epoch, s.uid)) return;
      draw();
      toast('중간보고 기준선과 후속 메일 Diff를 반영해 ' + Cat().getAgency(proj.agency).short + ' 최종결과보고서를 조립했습니다.');
    } else if (act === 'confirm-final-snapshot') {
      var domF2 = readCurrentFinalSectionsFromDom(proj);
      var savedFinBase = await saveFinalDoc(proj, domF2.sections, domF2.locks, s.epoch, s.uid);
      if (!savedFinBase || !isSessionCurrent(s.epoch, s.uid)) return;
      var nowF = Date.now();
      var savedFinSnap = await saveImmutableSnapshot(proj, {
        id: 'snap_final_' + nowF,
        kind: 'final_report',
        agency: proj.agency || 'kmac',
        track: proj.track || 'kmac_std',
        title: proj.companyName + ' (' + Cat().getAgency(proj.agency).short + ') 최종결과보고 확정 스냅샷',
        sections: domF2.sections,
        confirmedBy: s.sid,
        confirmedAt: nowF
      }, s.epoch, s.uid);
      if (!savedFinSnap || !isSessionCurrent(s.epoch, s.uid)) return;
      var savedFinProj = await saveProjectRecord(Object.assign({}, proj, { finalConfirmedAt: nowF, stage: 'followup' }), s.epoch, s.uid);
      if (!savedFinProj || !isSessionCurrent(s.epoch, s.uid)) return;
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
        clearDirHandlesFromIdb();
        purgeSessionState();
        if ($('lock')) $('lock').style.display = 'none';
        if (global.PuGate) global.PuGate.show();
        return;
      }
      if (ME && ME.uid && ME.uid !== authUid) {
        clearDirHandlesFromIdb();
        purgeSessionState();
      }
      var authEpoch = ++SESSION_EPOCH;
      if (global.PuGate) global.PuGate.hide();

      var snapPromise = (global.PuFastBoot && typeof global.PuFastBoot.readSnap === 'function')
        ? global.PuFastBoot.readSnap('jobtrans', authUid).catch(function () { return null; })
        : Promise.resolve(null);
      var roleVal = {};
      try { roleVal = (await fbDb.ref('uid_roles/' + authUid).once('value')).val() || {}; } catch (e) {}
      if (authEpoch !== SESSION_EPOCH || currentAuthUid() !== authUid) return;
      if (roleVal.status !== 'active' || !roleVal.sid) {
        clearDirHandlesFromIdb();
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
      if (cachedSnap && applyJobtransFastSnapshot(cachedSnap)) {
        rebuildScanAndDiscover();
        applyHashTarget();
        draw();
      } else if ($('projectsBox') && !$('projectsBox').innerHTML) {
        $('projectsBox').innerHTML = '<div class="empty">산업일자리전환 사업장 현황을 빠르게 불러오고 있습니다…</div>';
      }

      await reload(authEpoch, authUid);
    });
  }

  global.PuJobtransView = {
    boot: boot,
    reload: reload
  };
})(typeof window !== 'undefined' ? window : globalThis);
