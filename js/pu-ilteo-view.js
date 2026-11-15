/* 푸른통합시스템 — 일터혁신 상생컨설팅(일터상생혁신) 자동화 워크스페이스 화면 컨트롤러
 * (ilteo.html 전용 window.PuIlteoView)
 *
 * 맡는 일:
 *   1. 로그인 권한 검증(uid_roles active + sid), 세션 격리(SESSION_EPOCH), PuOntologyWrite 강제 관문(enforce) 연결
 *   2. 정부사업일정(scal_cos·scal_types·scal_scheds) 및 이알피(data/companies·data/consultings)에서
 *      일터혁신 참여 사업장 자동 발견 및 워크스페이스 등록
 *   3. 다음메일 거울(mailbox/folders·mailbox/msgs) 스캔 + Cloud Functions(readMailMessage/readMailAttachment peek:true)
 *      실시간 내용확인·첨부 파싱 + 로컬 드래그앤드롭 파일 이원화 비식별 분석(XLSX/CSV/HWPX/HWP/DOCX/PDF/TXT)
 *   4. 중간보고서 자동 정리 · 수기 고정(Lock) · 선택적 AI 윤문(환각 숫자 검증) · 기준선 스냅샷 확정 · PPTX 다운로드
 *   5. 중간보고 이후 후속 메일 체크 · 변경점(Diff) 대조 · 최종 결과보고서 자동 조립 · 플랫폼 문안 3종 복사 · PPTX 다운로드
 */
(function (global) {
  'use strict';

  var Cat = function () { return global.PuIlteoCatalog; };
  var Intake = function () { return global.PuIlteoIntake; };
  var Report = function () { return global.PuIlteoReport; };
  var Pptx = function () { return global.PuIlteoPptx; };

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
    flatMails: []
  };

  var SCAN_CACHE = {};
  var DISCOVER_LIST = [];
  var TAB = 'projects';
  var CUR_PID = '';
  var SEL = {};
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
    SCAN_CACHE = {};
    DISCOVER_LIST = [];
    D = {
      projects: {}, intake: {}, mid: {}, final: {}, snapshots: {},
      companies: [], consultings: [], bizTypes: [],
      scalCos: {}, scalTypes: {}, scalScheds: {}, scalDocs: {},
      mailFolders: {}, mailMsgs: {}, flatMails: []
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
      safeVal('mailbox/msgs')
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
    D.flatMails = Intake().flattenMailboxRows(D.mailFolders, D.mailMsgs);

    rebuildScanAndDiscover();
    applyHashTarget();
    draw();
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

  function rebuildScanAndDiscover() {
    SCAN_CACHE = {};
    var projs = activeProjects();
    var registeredCoIds = {};
    projs.forEach(function (p) {
      if (p.companyId) registeredCoIds[p.companyId] = p.id;
      if (p.scalCoId) registeredCoIds['scal:' + p.scalCoId] = p.id;
      SCAN_CACHE[p.id] = Intake().scanProjectMails(
        p, D.flatMails, null, D.companies, D.consultings, D.intake[p.id] || {}
      );
    });

    if (!CUR_PID && projs.length) CUR_PID = projs[0].id;
    if (CUR_PID && !projectById(CUR_PID)) CUR_PID = projs[0] ? projs[0].id : '';

    /* 정부사업일정 및 이알피에서 일터혁신(상생컨설팅) 참여기업 자동 발견 */
    var cands = [], seenCo = {};
    var ilteoRe = /일터\s*혁신|일터\s*상생|상생\s*컨설팅/;
    var typeMap = {};
    rowsOf(D.scalTypes).forEach(function (t) {
      if (t && t.id) typeMap[t.id] = str(t.name || t.title);
    });
    var bizTypeMap = {};
    D.bizTypes.forEach(function (bt) {
      if (bt && bt.id) bizTypeMap[bt.id] = str(bt.name || bt.title);
    });

    D.consultings.forEach(function (cs) {
      var bName = str(cs.bizName || cs.typeName || bizTypeMap[cs.bizTypeId] || '');
      if (!ilteoRe.test(bName)) return;
      var coObj = (cs.company && typeof cs.company === 'object') ? cs.company : {};
      var coId = str(cs.companyId || coObj.id);
      if (!coId || registeredCoIds[coId] || seenCo[coId]) return;
      seenCo[coId] = 1;
      var coRec = findCompanyById(coId) || coObj;
      cands.push({
        candKey: 'erp_' + safeKey(coId),
        source: '이알피 컨설팅',
        companyId: coId,
        companyName: str(coRec.name || cs.companyName || '사업장'),
        bizNo: str(coRec.bizNo || cs.bizNo),
        industry: str(coRec.bizType || coRec.bizCategory),
        contactEmail: firstEmailOf(coRec) || firstEmailOf(cs),
        year: Number(String(cs.year || cs.contractDate || '2026').slice(0, 4)) || 2026,
        scalCoId: '',
        scalTypeId: ''
      });
    });

    rowsOf(D.scalCos).forEach(function (sc) {
      if (!sc || !sc.id) return;
      var tName = typeMap[sc.typeId] || str(sc.bizName || '');
      var hasIlteoSched = rowsOf(D.scalScheds).some(function (s) {
        return s && s.coId === sc.id && ilteoRe.test(typeMap[s.typeId] || '');
      });
      if (!ilteoRe.test(tName) && !hasIlteoSched) return;
      var matchedErpCo = matchErpCompanyStrict(sc);
      if (!matchedErpCo) return; // companyId 확정 매칭된 사업장만 원클릭 후보로 올림
      if (registeredCoIds[matchedErpCo.id] || seenCo[matchedErpCo.id]) return;
      seenCo[matchedErpCo.id] = 1;
      cands.push({
        candKey: 'scal_' + safeKey(matchedErpCo.id),
        source: '정부사업일정',
        companyId: matchedErpCo.id,
        companyName: str(matchedErpCo.name || sc.name),
        bizNo: str(matchedErpCo.bizNo || sc.bizNo),
        industry: str(matchedErpCo.bizType || matchedErpCo.bizCategory),
        contactEmail: firstEmailOf(matchedErpCo),
        year: Number(sc.year) || 2026,
        scalCoId: str(sc.id),
        scalTypeId: str(sc.typeId)
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

  /* ══ 2. 공통 표 렌더러 (좌측 ☐ 체크박스 + № 번호 + 일괄 실행 바) ═══════ */
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

  function pickedIds(name) {
    var prefix = name + '|';
    return Object.keys(SEL).filter(function (k) { return k.indexOf(prefix) === 0 && SEL[k]; }).map(function (k) { return k.slice(prefix.length); });
  }
  function clearSel(name) {
    if (!name) { SEL = {}; return; }
    pickedIds(name).forEach(function (id) { delete SEL[name + '|' + id]; });
  }

  function drawBulks() {
    document.querySelectorAll('[data-bulk]').forEach(function (el) {
      var nm = el.getAttribute('data-bulk');
      var n = pickedIds(nm).length;
      el.className = 'bulk' + (n ? ' on' : '');
      if (!n) { el.innerHTML = ''; return; }
      var btns = '';
      if (nm === 'projects') {
        btns = '<button class="sm danger" data-bulkact="projects:del">선택 사업장 숨김(삭제)</button>';
      } else if (nm === 'discover') {
        btns = '<button class="sm pri" data-bulkact="discover:activate">⚡ 선택 후보 일괄 워크스페이스 활성화</button>';
      } else if (nm === 'preMails' || nm === 'postMails') {
        btns = '<button class="sm pri" data-bulkact="' + nm + ':analyze">🔍 선택 메일 일괄 내용확인·자동분석</button>' +
          '<button class="sm ok" data-bulkact="' + nm + ':check">✓ 선택 메일 확인완료 표시</button>';
      } else if (nm === 'preCards' || nm === 'postCards') {
        btns = '<button class="sm danger" data-bulkact="' + nm + ':del">선택 분석카드 삭제</button>';
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

  function projectHeaderBarHtml(proj) {
    var projs = activeProjects();
    var lv = Cat().getLevel(proj.level);
    var tasks = (proj.selectedTasks || []).map(function (c) { var t = Cat().getTask(c); return t ? t.name : c; });
    var curOrder = proj.finalConfirmedAt ? 6 : (proj.midConfirmedAt ? 4 : (activeIntakeCount(proj.id) ? 2 : 1));

    var opts = projs.map(function (p) {
      return '<option value="' + esc(p.id) + '"' + (p.id === proj.id ? ' selected' : '') + '>' + esc(p.companyName + ' (' + (p.year || 2026) + ')') + '</option>';
    }).join('');

    return '<div class="card">' +
      '<div class="prof">' +
      '<span><b>대상 사업장</b><select data-proj-sel="1" aria-label="작업 사업장 전환">' + opts + '</select></span>' +
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
        '<div class="kpi k-blue"><span>일터상생 진행 사업장</span><b>' + projs.length + '개사</b></div>' +
        '<div class="kpi k-amber"><span>📩 기초자료 메일 미확인</span><b>' + totalPreUnseen + '건</b></div>' +
        '<div class="kpi k-green"><span>📌 중간보고 확정 완료</span><b>' + midDoneCnt + '개사</b></div>' +
        '<div class="kpi k-blue"><span>📬 후속·결과 메일 미확인</span><b>' + totalPostUnseen + '건</b></div>';
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
        var taskStr = (p.selectedTasks || []).map(function (c) { var t = Cat().getTask(c); return t ? t.name : ''; }).join(' ');
        var hay = (str(p.companyName) + ' ' + str(p.industry) + ' ' + str(p.consultantName) + ' ' + taskStr).toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });

    var rows = filtered.map(function (p) {
      var sc = SCAN_CACHE[p.id] || { matched: [], unseenPreCount: 0, unseenPostCount: 0 };
      var chkPre = Intake().summarizeChecklistProgress('pre_mid', p.selectedTasks, D.intake[p.id] || {}, sc.matched);
      var lv = Cat().getLevel(p.level);
      var taskNames = (p.selectedTasks || []).map(function (c) { var t = Cat().getTask(c); return t ? t.name : c; }).join(' · ');

      var mailBadges = [];
      if (sc.unseenPreCount > 0) mailBadges.push('<span class="chip c-amber">📩 기초 미확인 ' + sc.unseenPreCount + '</span>');
      if (sc.unseenPostCount > 0) mailBadges.push('<span class="chip c-green">📬 후속 미확인 ' + sc.unseenPostCount + '</span>');
      if (!mailBadges.length) mailBadges.push('<span class="chip">수신 ' + sc.totalInCount + '건 확인됨</span>');

      return {
        id: p.id,
        cells: [
          { cls: 'ti', title: p.companyName, html: esc(p.companyName) + ' <span class="chip">' + esc((p.year || 2026) + '년') + '</span>' },
          { k: 'badge', html: '<span class="chip c-blue">' + esc(lv.short) + '</span> ' + stageDotsHtml(p) },
          { cls: 'wide', title: taskNames, html: esc(taskNames || '과제 선택 필요') },
          { html: '기초자료 <b>' + chkPre.pct + '%</b> (' + chkPre.requiredDone + '/' + chkPre.requiredTotal + ')' },
          { html: mailBadges.join(' ') },
          {
            k: 'act',
            html: '<button class="sm" data-open-proj="' + esc(p.id) + '" data-open-tab="intake">① 기초체크</button>' +
              '<button class="sm" data-open-proj="' + esc(p.id) + '" data-open-tab="mid">② 중간보고</button>' +
              '<button class="sm pri" data-open-proj="' + esc(p.id) + '" data-open-tab="final">③ 결과·PPT</button>'
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
            { k: 'act', html: '<button class="sm pri" data-activate-cand="' + esc(c.candKey) + '">⚡ 워크스페이스 활성화</button>' }
          ]
        };
      });
      $('discoverBox').innerHTML = renderTable('discover', ['사업장명', '출처', '사업자번호', '등록 이메일', '활성화'], dRows, '');
    }
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
    var chk = Intake().summarizeChecklistProgress('pre_mid', proj.selectedTasks, D.intake[proj.id] || {}, sc.matched);

    var chkHtml = chk.items.map(function (it) {
      var stCls = it.status === 'analyzed' ? ' done' : (it.status === 'received' ? ' recv' : '');
      var badge = it.status === 'analyzed'
        ? '<span class="chip c-green">분석완료 ✓ (' + it.analyzedCount + ')</span>'
        : (it.status === 'received' ? '<span class="chip c-blue">메일수신 📩 (' + it.mailCount + ')</span>' : '<span class="chip c-amber">' + (it.required ? '필수 미수신' : '선택') + '</span>');
      return '<div class="chk-item' + stCls + '" title="' + esc(it.reason) + '">' +
        '<b>' + esc(it.short) + ' ' + badge + '</b>' +
        '<span>' + esc(it.reason) + '</span>' +
        '</div>';
    }).join('');

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

    var candNotice = '';
    if (sc.nameCandidates && sc.nameCandidates.length) {
      candNotice = '<div class="warn"><b>🔎 상호 일치 미확정 메일 후보 ' + sc.nameCandidates.length + '건</b> — 발신 주소가 거래처 정보에 아직 등록되지 않아 자동 귀속하지 않았습니다. 내용을 직접 확인한 뒤 맞으면 연결하세요.<div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">' +
        sc.nameCandidates.slice(0, 5).map(function (cm) {
          return '<button class="sm" data-mail-inspect="' + esc(cm.key) + '" data-phase="pre_mid">📧 ' + esc((cm.date ? cm.date + ' ' : '') + cm.subject.slice(0, 32)) + '</button>';
        }).join('') + '</div></div>';
    }

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
      candNotice +
      '<div class="card">' +
      '<div class="sec">' +
      '<span>📋 착수 기초자료 필수 체크리스트</span>' +
      '<div class="prog-wrap"><div class="prog-fill" style="width:' + chk.pct + '%"></div></div>' +
      '<b>' + chk.pct + '% (' + chk.requiredDone + '/' + chk.requiredTotal + ')</b>' +
      '<span class="sp"></span>' +
      '<button class="sm warn-btn" data-act="req-mail-pre">✉️ 미수신 기초자료 요청 문안</button>' +
      '<button class="sm pri" data-goto-tab="mid">② 중간보고서 정리로 이동 →</button>' +
      '</div>' +
      '<div class="chk-grid">' + chkHtml + '</div>' +
      '</div>' +

      '<div class="card">' +
      '<div class="sec">' +
      '<span>📩 공용 메일함(370-6@daum.net) 기초자료 자동 감지 내역</span>' +
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
      '<b>📂 여기에 취업규칙·임금대장·근태기록·인력현황·EOS설문 파일을 끌어다 놓거나 클릭하세요</b>' +
      '<span>지원 형식: .xlsx · .xls · .csv (브라우저 내 비식별 통계만 집계, 원본 성명·주민번호 폐기) / .hwpx · .hwp · .docx · .pdf · .txt (2중 가림 분석)</span>' +
      '<input type="file" id="preFileInput" multiple accept=".xlsx,.xls,.csv,.hwpx,.hwp,.docx,.pdf,.txt" style="display:none">' +
      '</div>' +
      '</div>' +

      '<div class="card">' +
      '<div class="sec"><span>✅ 확인 · 비식별 분석 완료 기초자료 카드 (' + preCards.length + '건)</span></div>' +
      renderTable('preCards', ['자료 제목', '분류 · 처리방식', '비식별 핵심 분석 요약', '분석시각', '보기'], cardRows, '') +
      '</div>';

    wireDropZone('preDropZone', 'preFileInput', 'preUploadKind', 'pre_mid');
  }

  /* ── 탭 3: ② 진단·중간보고서 자동화 ── */
  function drawMidPane() {
    var box = $('midBox');
    if (!box) return;
    var proj = projectById(CUR_PID);
    if (!proj) {
      box.innerHTML = '<div class="card"><div class="empty">먼저 사업장을 선택해 주세요.</div></div>';
      return;
    }

    var savedMid = D.mid[proj.id] || null;
    var computedMid = Report().buildMidReport(proj, D.intake[proj.id] || {}, schedRoundsForProject(proj), savedMid);
    var secs = (savedMid && savedMid.sections) ? Object.assign({}, computedMid.sections, savedMid.sections) : computedMid.sections;
    var locks = (savedMid && savedMid.locks) || {};
    var iv = proj.interviews || {};
    var eosBars = (computedMid.structured && computedMid.structured.eosAreaBars) || [];

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

    var secCardsHtml = Cat().MID_SECTIONS.map(function (s) {
      var locked = !!locks[s.key];
      var val = str(secs[s.key]);
      return '<div class="rpt-sec-card">' +
        '<div class="rpt-sec-hd">' +
        '<span class="chip c-blue">' + esc(s.part) + '</span>' +
        '<b>' + esc(s.title) + '</b>' +
        '<span class="sp"></span>' +
        '<label class="hint" style="display:inline-flex;align-items:center;gap:4px;cursor:pointer">' +
        '<input type="checkbox" data-mid-lock="' + esc(s.key) + '"' + (locked ? ' checked' : '') + '> 🔒 수기 고정</label>' +
        '<button class="sm" data-ai-polish="mid:' + esc(s.key) + '" title="개인정보 2중 가림 후 문체만 다듬습니다">✨ AI 윤문</button>' +
        '<button class="sm ok" data-save-mid-sec="' + esc(s.key) + '">💾 저장</button>' +
        '</div>' +
        '<div class="rpt-sec-body">' +
        '<textarea id="midSec_' + esc(s.key) + '" aria-label="' + esc(s.title) + '">' + esc(val) + '</textarea>' +
        '</div></div>';
    }).join('');

    box.innerHTML =
      projectHeaderBarHtml(proj) +
      (proj.midConfirmedAt
        ? '<div class="ok-banner">📌 <b>중간보고 기준선이 확정되었습니다</b> (' + esc(fmtDateTime(proj.midConfirmedAt)) + '). 이후 수신되는 메일은 자동으로 [③ 후속메일·결과보고] 단계로 분류됩니다.</div>'
        : '<div class="note">수집된 기초자료 비식별 통계·규정 이슈·인터뷰 메모를 바탕으로 <b>사업장 중간보고서 7개 표준 섹션과 발표용 PPTX</b>를 자동 생성합니다.</div>') +

      '<div class="card">' +
      '<div class="sec">' +
      '<span>🗣️ 계층별 심층 인터뷰 핵심 메모 (중간보고서 5절 & PPT 자동 반영)</span>' +
      '<span class="sp"></span>' +
      '<button class="sm ok" data-act="save-interviews">💾 인터뷰 메모 저장</button>' +
      '</div>' +
      '<div class="iv-grid">' +
      '<div class="iv-col"><label for="ivExec">경영진 (사용자 대표) 핵심 의견</label><textarea id="ivExec" rows="3" placeholder="예: 업무집중도 향상 전제로 격주 금요일 단축 긍정 검토, 통상임금 법적 리스크 정비 희망">' + esc(iv.exec || '') + '</textarea></div>' +
      '<div class="iv-col"><label for="ivHr">인사·노무 실무담당 핵심 의견</label><textarea id="ivHr" rows="3" placeholder="예: 연장근로 사전승인 기준 부재로 관리 애로, 취업규칙·근로계약서 일괄 현행화 요청">' + esc(iv.hr || '') + '</textarea></div>' +
      '<div class="iv-col"><label for="ivWorker">근로자대표·현장근로자 핵심 의견</label><textarea id="ivWorker" rows="3" placeholder="예: 임금 감소 없는 근로시간 단축 희망, 자유로운 연차 사용 문화 및 투명한 수당 산정 요청">' + esc(iv.worker || '') + '</textarea></div>' +
      '</div></div>' +

      '<div class="card">' +
      '<div class="sec"><span>📊 전직원 조직진단(EOS) 5대 영역 점수 대 업종 준거집단 미리보기</span></div>' +
      '<div class="eos-bars">' + eosHtml + '</div>' +
      '</div>' +

      '<div class="card">' +
      '<div class="bar">' +
      '<button class="sm pri" data-act="regen-mid">⚡ 중간보고서 자동 정리</button>' +
      '<button class="sm ok" data-act="dl-mid-pptx">📊 중간보고 PPTX 다운로드</button>' +
      '<button class="sm warn-btn" data-act="open-platform-modal">📋 플랫폼 문안 복사</button>' +
      '<span class="sp"></span>' +
      '<button class="sm pri" data-act="confirm-mid-baseline" title="중간보고 기준선 확정 및 후속메일 감시 시작">📌 중간보고 기준선 확정</button>' +
      '</div>' +
      '<div class="rpt-sec-list">' + secCardsHtml + '</div>' +
      '</div>';
  }

  /* ── 탭 4: ③ 후속 메일 확인 · 결과보고서 자동 조립 · PPTX ── */
  function drawFinalPane() {
    var box = $('finalBox');
    if (!box) return;
    var proj = projectById(CUR_PID);
    if (!proj) {
      box.innerHTML = '<div class="card"><div class="empty">먼저 사업장을 선택해 주세요.</div></div>';
      return;
    }

    var sc = SCAN_CACHE[proj.id] || { matched: [], unseenPostCount: 0 };
    var postMails = sc.matched.filter(function (m) { return m.phase === 'post_mid'; });
    var chkPost = Intake().summarizeChecklistProgress('post_mid', proj.selectedTasks, D.intake[proj.id] || {}, sc.matched);
    var savedMid = D.mid[proj.id] || null;
    var computedMid = Report().buildMidReport(proj, D.intake[proj.id] || {}, schedRoundsForProject(proj), savedMid);
    var savedFinal = D.final[proj.id] || null;
    var computedFinal = Report().buildFinalReport(proj, computedMid, D.intake[proj.id] || {}, schedRoundsForProject(proj), savedFinal);
    var secs = (savedFinal && savedFinal.sections) ? Object.assign({}, computedFinal.sections, savedFinal.sections) : computedFinal.sections;
    var locks = (savedFinal && savedFinal.locks) || {};

    var chkHtml = chkPost.items.map(function (it) {
      var stCls = it.status === 'analyzed' ? ' done' : (it.status === 'received' ? ' recv' : '');
      var badge = it.status === 'analyzed'
        ? '<span class="chip c-green">반영완료 ✓</span>'
        : (it.status === 'received' ? '<span class="chip c-blue">메일수신 📩</span>' : '<span class="chip c-amber">수신대기</span>');
      return '<div class="chk-item' + stCls + '">' +
        '<b>' + esc(it.short) + ' ' + badge + '</b>' +
        '<span>' + esc(it.reason) + '</span>' +
        '</div>';
    }).join('');

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
            html: '<button class="sm pri" data-mail-inspect="' + esc(m.key) + '" data-phase="post_mid">🔍 내용확인·Diff추출</button>' +
              (!m.checked ? '<button class="sm" data-mail-check="' + esc(m.key) + '" data-phase="post_mid">✓ 확인표시</button>' : '')
          }
        ]
      };
    });

    var diffRows = (computedFinal.structured && computedFinal.structured.diffSummaryRows) || [];
    var diffTableHtml = '<div class="scroll"><table class="t diff-t"><thead><tr><th>협의 영역</th><th>중간보고 기준선(초안)</th><th>후속 메일 협의 · 최종 확정안</th><th>상태</th></tr></thead><tbody>' +
      diffRows.map(function (r) {
        return '<tr><td class="ti">' + esc(r[0]) + '</td><td data-diff="base" title="' + esc(r[1]) + '">' + esc(r[1]) + '</td><td class="wide" data-diff="fin" title="' + esc(r[2]) + '"><b>' + esc(r[2]) + '</b></td><td data-diff="st"><span class="chip c-green">' + esc(r[3]) + '</span></td></tr>';
      }).join('') + '</tbody></table></div>';

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

    var secCardsHtml = Cat().FINAL_SECTIONS.map(function (s) {
      var locked = !!locks[s.key];
      var val = str(secs[s.key]);
      return '<div class="rpt-sec-card">' +
        '<div class="rpt-sec-hd">' +
        '<span class="chip c-green">' + esc(s.part) + '</span>' +
        '<b>' + esc(s.title) + '</b>' +
        '<span class="sp"></span>' +
        '<label class="hint" style="display:inline-flex;align-items:center;gap:4px;cursor:pointer">' +
        '<input type="checkbox" data-final-lock="' + esc(s.key) + '"' + (locked ? ' checked' : '') + '> 🔒 수기 고정</label>' +
        '<button class="sm" data-ai-polish="final:' + esc(s.key) + '">✨ AI 윤문</button>' +
        '<button class="sm ok" data-save-final-sec="' + esc(s.key) + '">💾 저장</button>' +
        '</div>' +
        '<div class="rpt-sec-body">' +
        '<textarea id="finalSec_' + esc(s.key) + '" aria-label="' + esc(s.title) + '">' + esc(val) + '</textarea>' +
        '</div></div>';
    }).join('');

    box.innerHTML =
      projectHeaderBarHtml(proj) +
      '<div class="card">' +
      '<div class="sec">' +
      '<span>📬 중간보고 이후 후속 자료 체크리스트</span>' +
      '<div class="prog-wrap"><div class="prog-fill" style="width:' + chkPost.pct + '%"></div></div>' +
      '<b>' + chkPost.pct + '% (' + chkPost.requiredDone + '/' + chkPost.requiredTotal + ')</b>' +
      '<span class="sp"></span>' +
      '<button class="sm warn-btn" data-act="req-mail-post">✉️ 후속·보완자료 요청 문안</button>' +
      '</div>' +
      '<div class="chk-grid">' + chkHtml + '</div>' +
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
      '<b>📂 중간보고 이후 받은 디자인팀 피드백·보완 시뮬레이션·찬반투표 집계표·서명지를 끌어다 놓으세요</b>' +
      '<span>채택 모델 · 임금보전 합의 · 시행일 · 찬성률(%) · 수정요청사항을 자동 추출하여 최종 결과보고서에 반영합니다</span>' +
      '<input type="file" id="postFileInput" multiple accept=".xlsx,.xls,.csv,.hwpx,.hwp,.docx,.pdf,.txt,.jpg,.jpeg,.png" style="display:none">' +
      '</div>' +
      (postCards.length ? renderTable('postCards', ['후속자료 제목', '분류', '추출된 합의·변경점 요약', '분석시각', '보기'], postCardRows, '') : '') +
      '</div>' +

      '<div class="card">' +
      '<div class="sec"><span>🔄 중간보고 기준선 대비 후속 메일 합의·변경 내역 (Diff 자동 대조표)</span></div>' +
      diffTableHtml +
      '</div>' +

      '<div class="card">' +
      '<div class="bar">' +
      '<button class="sm pri" data-act="regen-final" title="기준선 + 후속 메일 Diff → 최종 결과보고서 자동 조립">⚡ 최종 결과보고서 자동 조립</button>' +
      '<button class="sm ok" data-act="dl-final-pptx">📊 결과보고 PPTX 다운로드</button>' +
      '<button class="sm warn-btn" data-act="open-platform-modal">📋 플랫폼 문안 3종 복사</button>' +
      '<span class="sp"></span>' +
      '<button class="sm pri" data-act="confirm-final-snapshot">📌 최종보고 확정 스냅샷</button>' +
      '</div>' +
      '<div class="rpt-sec-list">' + secCardsHtml + '</div>' +
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

  function sanitizeMetaLabel(rawVal, proj) {
    var s = str(rawVal);
    if (!s) return '';
    var masked = Intake().maskPiiStrict(s, projectNamesList(proj));
    var txt = masked.text;
    if (Intake().hasResidualPii(txt)) txt = Intake().maskPiiStrict(txt, []).text;
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
      var safeTitle = sanitizeMetaLabel(f.name, proj);
      try {
        if (Intake().hasResidualPii(safeTitle)) {
          throw new Error('파일명에 해제되지 않은 민감 식별정보 패턴이 포함되어 차단했습니다.');
        }
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
        toast('파일 분석 오류 (' + safeTitle + '): ' + (e.message || e));
      }
    }
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

    /* 사진 증빙(.jpg/.png/.webp) — 원본 미전송, 회차 사진 증빙 메타만 추출 */
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
    /* 엑셀 / CSV — 시트 헤더로 정량 4종 및 민감 인사·급여 열 여부를 먼저 판별하며, 민감 열 시트는 절대 평문 발췌로 넘기지 않는다 */
    if (/\.(xlsx|xls|csv)$/.test(lower) && global.XLSX) {
      var wb = global.XLSX.read(bytes, { type: 'array' });
      var sheetMap = {};
      (wb.SheetNames || []).forEach(function (sn) {
        sheetMap[sn] = global.XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: '' });
      });
      var hasSensCols = Intake().hasSensitiveTableHeaders(sheetMap);
      var isExplicitNonQuant = !!(explicitDk && explicitDk.track !== 'quant');

      if (isExplicitNonQuant && hasSensCols) {
        throw new Error('성명·주민번호·임금 등 민감 인사·급여 열이 포함된 엑셀은 비정량 텍스트 서류로 업로드할 수 없습니다. 정량 서류 종류를 선택해 주세요.');
      }

      if (!isExplicitNonQuant) {
        var tabRes = Intake().analyzeTabularRows(sheetMap, explicitDk ? explicitDk.code : '', {
          level: proj.level,
          totalWorkers: proj.workerCount,
          baseYear: proj.year || 2026,
          fileName: safeFileName
        });
        if (tabRes && tabRes.ok) {
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

      /* 민감 인사·급여 열이 전혀 없는 순수 비정량 집계표(예: 찬반투표 집계표, 협의회 의견서 등)만 셀 텍스트로 추출 */
      excelTextFallback = Object.keys(sheetMap).map(function (sn) {
        var rows = (sheetMap[sn] || []).slice(0, 200).map(function (r) {
          return (Array.isArray(r) ? r : []).map(str).filter(Boolean).join(' ');
        }).filter(Boolean).join('\n');
        return '[' + sn + ']\n' + rows;
      }).join('\n');
    }

    /* 한글(.hwp/.hwpx) · 워드(.docx) · PDF · TXT · 비정량 엑셀 본문 추출 후 2중 가림 분석 */
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
    if (/\.hwpx$/.test(lower) && global.PuHwpx && typeof global.PuHwpx.extractText === 'function') {
      try { return await global.PuHwpx.extractText(bytes); } catch (e) {}
    }
    if (/\.hwp$/.test(lower) && global.PuHwp && typeof global.PuHwp.extractText === 'function') {
      try { return await global.PuHwp.extractText(bytes); } catch (e) {}
    }
    if (/\.pdf$/.test(lower) && global.pdfjsLib) {
      try {
        var pdf = await global.pdfjsLib.getDocument({ data: bytes }).promise;
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
    var attErrors = [];
    var mergedStats = null, mergedIssues = [], mergedDiff = null, finalDocKind = m.docKind;
    var attLeakBlocked = false;

    try {
      var msg = await callMailFn('readMailMessage', { slug: m.slug, uid: m.uid, peek: 1 });
      bodyPlain = str(msg.text) || htmlToPlainText(msg.html);
      var atts = Array.isArray(msg.atts) ? msg.atts : [];

      for (var i = 0; i < Math.min(atts.length, 6); i++) {
        var a = atts[i];
        var aName = str(a && a.name);
        if (!aName || Number(a.size || 0) > 15 * 1024 * 1024) continue;
        try {
          var got = await callMailFn('readMailAttachment', {
            slug: m.slug,
            uid: m.uid,
            index: a.i == null ? i : a.i,
            part: a.part || ''
          });
          if (got && got.b64 && global.PuRulesMailOrig) {
            var bytes = global.PuRulesMailOrig.b64ToBytes(got.b64);
            var attRes = await analyzeAttachmentBytes(aName, bytes, proj, '', phase);
            if (attRes) {
              finalDocKind = attRes.docKind || finalDocKind;
              if (attRes.stats) mergedStats = attRes.stats;
              if (attRes.policyIssues && attRes.policyIssues.length) mergedIssues = mergedIssues.concat(attRes.policyIssues);
              if (attRes.postDiff) mergedDiff = attRes.postDiff;
              attSummaries = attSummaries.concat(attRes.summaryLines || []);
            }
          }
        } catch (attErr) {
          var errMsg = String((attErr && attErr.message) || attErr || '');
          if (/잔존 패턴/.test(errMsg)) attLeakBlocked = true;
          attErrors.push(sanitizeMetaLabel(aName, proj) + ': ' + errMsg);
        }
      }
    } catch (mailErr) {
      /* 오프라인/시드 환경에서는 제목·첨부명 메타만으로 안전하게 폴백 분석 */
      bodyPlain = m.subject + '\n' + (m.attNames || []).join('\n');
    }

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

    /* 상호 후보였던 메일을 사람이 확인해 저장하면 해당 발신 이메일을 사업장 연락 이메일에 추가 */
    if (m.matchKind === 'name_candidate' && m.from && m.dir === 'in') {
      var nextEmails = Array.isArray(proj.contactEmails) ? proj.contactEmails.slice() : [];
      if (nextEmails.indexOf(m.from) < 0) {
        nextEmails.push(m.from);
        await saveProjectRecord(Object.assign({}, proj, { contactEmails: nextEmails }));
      }
    }

    var savedCard = await saveIntakeCard(proj, cardPayload);
    rebuildScanAndDiscover();
    draw();
    if (!silent && savedCard) openCardDetailModal(savedCard);
  }

  async function markMailCheckedOnly(mailKey, phase) {
    var proj = projectById(CUR_PID);
    if (!proj) return;
    var m = findMailRowByKey(proj.id, mailKey);
    if (!m) return;
    var cardId = 'mail_' + safeKey(m.key);
    var prev = (D.intake[proj.id] && D.intake[proj.id][cardId]) || null;
    var safeSubjTitle = sanitizeMetaLabel(m.subject || m.docKindName, proj);
    var safeAttList = (m.attNames || []).map(function (n) { return sanitizeMetaLabel(n, proj); });
    if (Intake().hasResidualPii(safeSubjTitle) || safeAttList.some(Intake().hasResidualPii)) {
      toast('⚠ 메일 제목·첨부명에 민감 식별정보 패턴이 남아 있어 저장을 차단했습니다.');
      return;
    }
    await saveIntakeCard(proj, Object.assign({}, prev || {}, {
      id: cardId,
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
    }));
    rebuildScanAndDiscover();
    draw();
  }

  /* ══ 5. 온톨로지 강제 관문(gate) 저장 함수들 ════════════════════════════ */
  async function saveProjectRecord(projInput) {
    if (!gate || !fbDb) throw new Error('저장 관문이 준비되지 않았습니다.');
    var id = str(projInput.id) || ('ilt_' + Date.now().toString(36));
    if (!str(projInput.companyId)) {
      throw new Error('거래처(companyId)를 선택해야 등록할 수 있습니다(상호 텍스트 단독 저장 불가).');
    }
    var ref = fbDb.ref('scal_ilteo/projects/' + id);
    var res = await gate.save(ref, function (prev) {
      return stripUndef(Object.assign({}, prev || {}, projInput, {
        id: id,
        entityType: 'Project',
        companyId: str(projInput.companyId),
        companyName: str(projInput.companyName)
      }));
    }, { entityType: 'Project' });
    var val = res && res.snapshot ? res.snapshot.val() : null;
    if (val) D.projects[id] = val;
    return val;
  }

  async function saveIntakeCard(proj, cardInput) {
    if (!gate || !fbDb || !proj) return null;
    var cid = str(cardInput.id) || ('in_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6));
    var ref = fbDb.ref('scal_ilteo/intake/' + proj.id + '/' + cid);
    var res = await gate.save(ref, function (prev) {
      return stripUndef(Object.assign({}, prev || {}, cardInput, {
        id: cid,
        projectId: proj.id,
        entityType: 'Document',
        companyId: str(proj.companyId),
        companyName: str(proj.companyName)
      }));
    }, { entityType: 'Document' });
    var val = res && res.snapshot ? res.snapshot.val() : null;
    if (!D.intake[proj.id]) D.intake[proj.id] = {};
    if (val) D.intake[proj.id][cid] = val;
    return val;
  }

  async function saveMidDoc(proj, sections, locks) {
    var ref = fbDb.ref('scal_ilteo/mid/' + proj.id);
    var res = await gate.save(ref, function (prev) {
      return stripUndef(Object.assign({}, prev || {}, {
        id: proj.id,
        projectId: proj.id,
        entityType: 'Document',
        companyId: str(proj.companyId),
        companyName: str(proj.companyName),
        sections: sections,
        locks: locks || {}
      }));
    }, { entityType: 'Document' });
    var val = res && res.snapshot ? res.snapshot.val() : null;
    if (val) D.mid[proj.id] = val;
    return val;
  }

  async function saveFinalDoc(proj, sections, locks) {
    var ref = fbDb.ref('scal_ilteo/final/' + proj.id);
    var res = await gate.save(ref, function (prev) {
      return stripUndef(Object.assign({}, prev || {}, {
        id: proj.id,
        projectId: proj.id,
        entityType: 'Document',
        companyId: str(proj.companyId),
        companyName: str(proj.companyName),
        sections: sections,
        locks: locks || {}
      }));
    }, { entityType: 'Document' });
    var val = res && res.snapshot ? res.snapshot.val() : null;
    if (val) D.final[proj.id] = val;
    return val;
  }

  async function saveImmutableSnapshot(proj, snapObj) {
    var sid = str(snapObj.id) || ('snap_' + Date.now());
    var ref = fbDb.ref('scal_ilteo/snapshots/' + proj.id + '/' + sid);
    var res = await gate.save(ref, stripUndef(Object.assign({}, snapObj, {
      id: sid,
      projectId: proj.id,
      entityType: 'Document',
      companyId: str(proj.companyId),
      companyName: str(proj.companyName)
    })), { entityType: 'Document' });
    if (!D.snapshots[proj.id]) D.snapshots[proj.id] = {};
    if (res && res.snapshot) D.snapshots[proj.id][sid] = res.snapshot.val();
  }

  /* ══ 6. 모달 창 (사업장 등록 · 19개 과제 선택 · 카드 상세 · 플랫폼 문안 · AI 윤문) ═ */
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
    var attrs = ['data-act', 'data-mail-inspect', 'data-view-card', 'data-ai-polish', 'data-proj-sel', 'data-tab'];
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

    var body =
      '<div class="fr"><label for="npCo">대상 거래처*</label><div class="fv"><select id="npCo">' + coOpts + '</select></div></div>' +
      '<div class="fr"><label for="npYear">사업 연도</label><div class="fv"><select id="npYear"><option value="2026" selected>2026년</option><option value="2025">2025년</option></select></div></div>' +
      '<div class="fr"><label for="npLevel">컨설팅 수준</label><div class="fv"><select id="npLevel">' + lvOpts + '</select></div></div>' +
      '<div class="fr"><label for="npIndustry">업종 / 근로자수</label><div class="fv"><input type="text" id="npIndustry" placeholder="예: 정밀기계 제조업"><input type="number" id="npWorkers" placeholder="상시근로자 수" style="max-width:140px"></div></div>' +
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
    (proj.selectedTasks || []).forEach(function (c) { picked[c] = 1; });

    var taskHtml = Cat().TASKS.map(function (t) {
      var dom = Cat().getDomain(t.domain) || { icon: '•', name: '' };
      var on = !!picked[t.code];
      return '<label class="task-opt' + (on ? ' on' : '') + '">' +
        '<input type="checkbox" name="cfgTask" value="' + esc(t.code) + '"' + (on ? ' checked' : '') + '>' +
        '<div><b>' + esc(dom.icon + ' [' + dom.name + '] ' + t.name) + '</b><span>' + esc(t.summary) + '</span></div>' +
        '</label>';
    }).join('');

    var lvOpts = Object.keys(Cat().LEVELS).map(function (k) {
      var lv = Cat().LEVELS[k];
      return '<option value="' + esc(lv.code) + '"' + (proj.level === lv.code ? ' selected' : '') + '>' + esc(lv.name) + '</option>';
    }).join('');

    var body =
      '<div class="fr"><label for="cfgLevel">컨설팅 수준</label><div class="fv"><select id="cfgLevel">' + lvOpts + '</select>' +
      '<input type="text" id="cfgIndustry" value="' + esc(proj.industry || '') + '" placeholder="업종">' +
      '<input type="number" id="cfgWorkers" value="' + esc(proj.workerCount || '') + '" placeholder="상시근로자수" style="max-width:130px"></div></div>' +
      '<div class="fr"><label for="cfgEmails">수신감지 이메일</label><div class="fv"><input type="text" id="cfgEmails" value="' + esc((proj.contactEmails || []).join(', ')) + '" placeholder="기업 담당자 이메일 (쉼표 구분)"></div></div>' +
      '<div style="padding:8px 4px;font-weight:700">🎯 노사발전재단 공식 9대 분야 · 19개 개선과제 선택 (복수 선택)</div>' +
      '<div class="task-pick-grid">' + taskHtml + '</div>';

    openModal('🎯 ' + proj.companyName + ' — 개선과제 및 사업장 기준 설정', body,
      '<button class="sm" data-close-modal="1">취소</button><button class="sm pri" id="cfgSaveBtn">설정 저장 (체크리스트 즉시 갱신)</button>', 'wide');

    document.querySelectorAll('#mbox input[name="cfgTask"]').forEach(function (cb) {
      cb.onchange = function () {
        var lbl = cb.closest('.task-opt');
        if (lbl) lbl.classList.toggle('on', cb.checked);
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

  function openDocRequestMailModal(proj, phase) {
    var sc = SCAN_CACHE[proj.id] || { matched: [] };
    var chk = Intake().summarizeChecklistProgress(phase, proj.selectedTasks, D.intake[proj.id] || {}, sc.matched);
    var mailDraft = Cat().buildDocRequestMailText(proj, chk.missingRequired, phase);
    var body =
      '<div class="note">⚠ 메일 자동 발송은 하지 않습니다. 아래 요청 문안을 복사하여 메일함 작성창에 붙여넣고 담당자가 직접 확인 후 발송하세요.</div>' +
      '<div class="fr"><label for="reqSubj">메일 제목</label><div class="fv"><input type="text" id="reqSubj" value="' + esc(mailDraft.subject) + '" readonly></div></div>' +
      '<textarea id="reqBody" aria-label="미수신 자료 요청 메일 본문" rows="13">' + esc(mailDraft.body) + '</textarea>';
    var foot =
      '<a class="act-link" href="pu-cards.html?view=mail" target="_blank" rel="noopener">✉️ 푸른 메일함 열기</a>' +
      '<button class="sm pri" id="copyReqMailBtn">📋 제목+본문 클립보드 복사</button>' +
      '<button class="sm" data-close-modal="1">닫기</button>';
    openModal('✉️ 미수신 자료 요청 메일 문안', body, foot, 'wide');
    if ($('copyReqMailBtn')) {
      $('copyReqMailBtn').onclick = function () {
        copyTextToClipboard($('reqSubj').value + '\n\n' + $('reqBody').value);
        toast('요청 메일 제목과 본문을 복사했습니다.');
      };
    }
  }

  function openPlatformTextsModal(proj) {
    var savedMid = D.mid[proj.id] || null;
    var mid = Report().buildMidReport(proj, D.intake[proj.id] || {}, schedRoundsForProject(proj), savedMid);
    var savedFin = D.final[proj.id] || null;
    var fin = Report().buildFinalReport(proj, mid, D.intake[proj.id] || {}, schedRoundsForProject(proj), savedFin);
    var pt = Report().buildPlatformTexts(proj, mid, fin, D.intake[proj.id] || {}, schedRoundsForProject(proj));
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
      '<div><div style="display:flex;align-items:center;gap:8px;margin-bottom:4px"><b>① 수행계획서 플랫폼 입력 문안</b><span class="sp"></span><button class="sm pri" data-copy-target="pfPlanTxt">📋 수행계획서 복사</button></div>' +
      '<textarea id="pfPlanTxt" aria-label="수행계획서 플랫폼 입력 문안" rows="7">' + esc(pt.planText) + '</textarea></div>' +
      '<div><div style="display:flex;align-items:center;gap:8px;margin-bottom:4px"><b>② 회차별 수행보고서 입력 문안 (형식적 제목 자동 배제됨)</b><span class="sp"></span><button class="sm pri" data-copy-target="pfRoundTxt">📋 전 회차 수행보고 복사</button></div>' +
      '<textarea id="pfRoundTxt" aria-label="회차별 수행보고서 플랫폼 입력 문안" rows="8">' + esc(roundTextAll) + '</textarea></div>' +
      '<div><div style="display:flex;align-items:center;gap:8px;margin-bottom:4px"><b>③ 종료 후 3개월 이행관리 · 이행결과표 입력 문안</b><span class="sp"></span><button class="sm pri" data-copy-target="pfFollowTxt">📋 이행관리 문안 복사</button></div>' +
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
    var req = Report().buildAiPolishPrompt(secMeta ? secMeta.title : secKey, ta.value, names);
    if (!req.ok) { toast(req.error); return; }

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
        '<button class="sm" data-close-modal="1">취소</button><button class="sm pri" id="applyAiPolishBtn">본문에 반영 (수기 고정 자동 켬)</button>', 'wide');

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

  /* ══ 7. 이벤트 바인딩 및 부팅 ══════════════════════════════════════════ */
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

  async function activateDiscoverCandidate(candKey) {
    var c = DISCOVER_LIST.find(function (x) { return x.candKey === candKey; });
    if (!c) return null;
    var co = findCompanyById(c.companyId);
    var created = await saveProjectRecord({
      id: 'ilt_' + safeKey(c.companyId) + '_' + (c.year || 2026),
      companyId: c.companyId,
      companyName: c.companyName,
      bizNo: c.bizNo,
      ceoName: co ? str(co.ceo || co.ceoName) : '',
      contactName: contactNameOfCompany(co),
      industry: c.industry,
      year: c.year || 2026,
      level: 'deep',
      contactEmails: c.contactEmail ? [c.contactEmail] : [],
      scalCoId: c.scalCoId || '',
      scalTypeId: c.scalTypeId || '',
      selectedTasks: ['wt_45day', 'wg_redesign'],
      consultantName: ME.name ? ME.name + ' 공인노무사' : '푸른노무법인 전담 노무사',
      designTeamCount: 4
    });
    return created;
  }

  function bindEvents() {
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
      el.addEventListener(id === 'projQ' ? 'input' : 'change', function () { draw(); });
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
        document.querySelectorAll('table.t[data-name="' + nm + '"] input[data-ck]').forEach(function (cb) {
          cb.checked = allCb.checked;
          SEL[cb.getAttribute('data-ck')] = allCb.checked;
        });
        drawBulks();
        return;
      }
      var rowCb = e.target.closest('input[data-ck]');
      if (rowCb) {
        SEL[rowCb.getAttribute('data-ck')] = rowCb.checked;
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
            rebuildScanAndDiscover();
            draw();
            toast(created.companyName + ' 워크스페이스 활성화 완료');
          }
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

      if (!e.target.closest('input,button,select,a,label')) {
        var tr = e.target.closest('tr[data-row][data-tname="projects"]');
        if (tr) {
          CUR_PID = tr.getAttribute('data-row');
          TAB = 'intake';
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

    if (nm === 'discover' && op === 'activate') {
      for (var i = 0; i < ids.length; i++) await activateDiscoverCandidate(ids[i]);
      clearSel(nm);
      rebuildScanAndDiscover();
      draw();
      toast(ids.length + '개 사업장 워크스페이스 활성화 완료');
    } else if (nm === 'projects' && op === 'del') {
      if (typeof global.confirm === 'function' && !global.confirm('선택한 사업장 ' + ids.length + '건을 목록에서 숨김(삭제) 처리하시겠습니까?')) return;
      for (var p = 0; p < ids.length; p++) {
        var rec = D.projects[ids[p]];
        if (rec) {
          await gate.remove(fbDb.ref('scal_ilteo/projects/' + rec.id), rec, { entityType: 'Project' });
          D.projects[rec.id]._deleted = true;
        }
      }
      clearSel(nm);
      rebuildScanAndDiscover();
      draw();
      toast('선택 사업장을 목록에서 숨겼습니다(소프트 삭제).');
    } else if ((nm === 'preMails' || nm === 'postMails') && (op === 'analyze' || op === 'check')) {
      var ph = nm === 'postMails' ? 'post_mid' : 'pre_mid';
      for (var m = 0; m < ids.length; m++) {
        if (op === 'analyze') await inspectAndAnalyzeMail(ids[m], ph, true);
        else await markMailCheckedOnly(ids[m], ph);
      }
      clearSel(nm);
      rebuildScanAndDiscover();
      draw();
      toast(ids.length + '건 메일 일괄 처리 완료');
    } else if ((nm === 'preCards' || nm === 'postCards') && op === 'del' && CUR_PID) {
      if (typeof global.confirm === 'function' && !global.confirm('선택한 분석카드 ' + ids.length + '건을 삭제하시겠습니까?')) return;
      for (var c = 0; c < ids.length; c++) {
        var prevC = D.intake[CUR_PID] && D.intake[CUR_PID][ids[c]];
        if (prevC) {
          await gate.remove(fbDb.ref('scal_ilteo/intake/' + CUR_PID + '/' + prevC.id), prevC, { entityType: 'Document' });
          D.intake[CUR_PID][prevC.id]._deleted = true;
        }
      }
      clearSel(nm);
      rebuildScanAndDiscover();
      draw();
      toast('선택 분석카드를 삭제했습니다.');
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
    } else if (act === 'save-interviews') {
      var iv = {
        exec: str($('ivExec') && $('ivExec').value),
        hr: str($('ivHr') && $('ivHr').value),
        worker: str($('ivWorker') && $('ivWorker').value)
      };
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
      var domM = readCurrentMidSectionsFromDom(proj);
      var midForPpt = Report().buildMidReport(proj, D.intake[proj.id] || {}, schedRoundsForProject(proj), null);
      midForPpt.sections = Object.assign({}, midForPpt.sections, domM.sections);
      var midBytes = await Pptx().generateMidPptxBytes(proj, midForPpt);
      var safeCo = proj.companyName.replace(/[\\/:*?"<>|]/g, '_');
      Pptx().downloadPptxBytes(midBytes, safeCo + '_일터혁신_중간보고서.pptx');
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
      rebuildScanAndDiscover();
      TAB = 'final';
      draw();
      toast('중간보고 기준선이 확정되었습니다. 이제 후속 메일 자동 감시 단계로 전환됩니다.');
    } else if (act === 'regen-final') {
      var curFin = readCurrentFinalSectionsFromDom(proj);
      var baseMid = Report().buildMidReport(proj, D.intake[proj.id] || {}, schedRoundsForProject(proj), D.mid[proj.id] || null);
      var builtF = Report().buildFinalReport(proj, baseMid, D.intake[proj.id] || {}, schedRoundsForProject(proj), {
        sections: curFin.sections,
        locks: curFin.locks
      });
      await saveFinalDoc(proj, builtF.sections, builtF.locks);
      draw();
      toast('중간보고 기준선과 후속 메일 Diff를 반영해 최종 결과보고서를 조립했습니다.');
    } else if (act === 'dl-final-pptx') {
      var domF = readCurrentFinalSectionsFromDom(proj);
      var baseM = Report().buildMidReport(proj, D.intake[proj.id] || {}, schedRoundsForProject(proj), D.mid[proj.id] || null);
      var finForPpt = Report().buildFinalReport(proj, baseM, D.intake[proj.id] || {}, schedRoundsForProject(proj), null);
      finForPpt.sections = Object.assign({}, finForPpt.sections, domF.sections);
      var finBytes = await Pptx().generateFinalPptxBytes(proj, baseM, finForPpt);
      var safeCo2 = proj.companyName.replace(/[\\/:*?"<>|]/g, '_');
      Pptx().downloadPptxBytes(finBytes, safeCo2 + '_일터혁신_최종결과보고서.pptx');
      toast('최종 결과보고서 PPTX 파일을 생성했습니다.');
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
