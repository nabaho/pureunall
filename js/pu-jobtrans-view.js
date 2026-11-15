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
      safeVal('scal_jobtrans'),
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

    var jtRoot = res[0] && typeof res[0] === 'object' ? res[0] : {};
    D.projects = jtRoot.projects || {};
    D.intake = jtRoot.intake || {};
    D.mid = jtRoot.mid || {};
    D.final = jtRoot.final || {};
    D.snapshots = jtRoot.snapshots || {};
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

    var cands = [], seenCo = {};
    var typeMap = {};
    rowsOf(D.scalTypes).forEach(function (t) {
      if (t && t.id) typeMap[t.id] = str(t.name || t.title);
    });
    var bizTypeMap = {};
    D.bizTypes.forEach(function (bt) {
      if (bt && bt.id) bizTypeMap[bt.id] = str(bt.name || bt.title);
    });

    D.consultings.forEach(function (cs) {
      var bName = str(cs.bizName || cs.typeName || bizTypeMap[cs.bizTypeId] || cs.memo || '');
      if (!JOBTRANS_BIZ_RE.test(bName)) return;
      var coObj = (cs.company && typeof cs.company === 'object') ? cs.company : {};
      var coId = str(cs.companyId || coObj.id);
      if (!coId || registeredCoIds[coId] || seenCo[coId]) return;
      seenCo[coId] = 1;
      var coRec = findCompanyById(coId) || coObj;
      var inferred = Cat().inferAgencyAndTrack(bName + ' ' + str(coRec.addr || coRec.address || ''));
      cands.push({
        candKey: 'erp_' + safeKey(coId),
        source: '푸른이알피 계약확정',
        bizLabel: bName,
        agency: inferred.agency,
        track: inferred.track,
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
      var hasJtSched = rowsOf(D.scalScheds).some(function (s) {
        return s && s.coId === sc.id && JOBTRANS_BIZ_RE.test(typeMap[s.typeId] || '');
      });
      if (!JOBTRANS_BIZ_RE.test(tName) && !hasJtSched) return;
      var matchedErpCo = matchErpCompanyStrict(sc);
      if (!matchedErpCo) return;
      if (registeredCoIds[matchedErpCo.id] || seenCo[matchedErpCo.id]) return;
      seenCo[matchedErpCo.id] = 1;
      var inferred = Cat().inferAgencyAndTrack(tName + ' ' + str(sc.memo || ''));
      cands.push({
        candKey: 'scal_' + safeKey(matchedErpCo.id),
        source: '정부사업일정',
        bizLabel: tName || '산업·일자리전환',
        agency: inferred.agency,
        track: inferred.track,
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

  function agencyChipHtml(agencyCode) {
    var ag = Cat().getAgency(agencyCode);
    var cls = ag.code === 'cepa' ? 'c-green' : 'c-blue';
    return '<span class="chip ' + cls + '">' + esc(ag.short) + '</span>';
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
    ['projects', 'intake', 'mid', 'final'].forEach(function (t) {
      var pane = $('p-' + t);
      if (pane) pane.classList.toggle('on', t === TAB);
    });

    drawProjectsPane(projs, totalPreUnseen, midDoneCnt, totalPostUnseen, kmacCnt, cepaCnt);
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
    var ag = Cat().getAgency(proj.agency);
    var tr = Cat().getTrack(proj.track, ag.code);
    var tasks = (proj.selectedTasks || []).map(function (c) { var t = Cat().getTask(c); return t ? t.name : c; });
    var curOrder = proj.finalConfirmedAt ? 6 : (proj.midConfirmedAt ? 4 : (activeIntakeCount(proj.id) ? 2 : 1));

    var opts = projs.map(function (p) {
      var pAg = Cat().getAgency(p.agency);
      return '<option value="' + esc(p.id) + '"' + (p.id === proj.id ? ' selected' : '') + '>' +
        esc('[' + (pAg.code === 'cepa' ? '충경진' : '능률협회') + '] ' + p.companyName + ' (' + (p.year || 2026) + ')') + '</option>';
    }).join('');

    return '<div class="card">' +
      '<div class="prof">' +
      '<span><b>대상 사업장</b><select data-proj-sel="1" aria-label="작업 사업장 전환">' + opts + '</select></span>' +
      '<span><b>운영기관</b>' + agencyChipHtml(ag.code) + ' <span class="chip">' + esc(tr.short) + '</span></span>' +
      '<span title="' + esc(tasks.join(', ')) + '"><b>중점과제</b>' + esc(tasks.join(' · ') || '미선택') + '</span>' +
      '<span><b>기준선</b>' + (proj.midConfirmedAt ? '<span class="chip c-green">중간보고 확정 (' + esc(fmtDateTime(proj.midConfirmedAt).slice(0, 10)) + ')</span>' : '<span class="chip c-amber">기초진단 진행중</span>') + '</span>' +
      '<span class="sp"></span>' +
      '<button class="sm" data-act="open-task-modal">🎯 기관·트랙·과제 설정</button>' +
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
  function drawProjectsPane(projs, totalPreUnseen, midDoneCnt, totalPostUnseen, kmacCnt, cepaCnt) {
    if ($('kpiBox')) {
      $('kpiBox').innerHTML =
        '<div class="kpi k-blue"><span>계약 사업장 (능률 ' + kmacCnt + ' · 충경진 ' + cepaCnt + ')</span><b>' + projs.length + '개사</b></div>' +
        '<div class="kpi k-amber"><span>📩 기초자료 메일 미확인</span><b>' + totalPreUnseen + '건</b></div>' +
        '<div class="kpi k-green"><span>📌 중간보고 확정 완료</span><b>' + midDoneCnt + '개사</b></div>' +
        '<div class="kpi k-blue"><span>📬 후속·완료 메일 미확인</span><b>' + totalPostUnseen + '건</b></div>';
    }

    var q = str($('projQ') && $('projQ').value).toLowerCase();
    var agFilter = str($('projAgency') && $('projAgency').value);
    var yr = str($('projYear') && $('projYear').value);
    var stFilter = str($('projStage') && $('projStage').value);

    var filtered = projs.filter(function (p) {
      var pAg = p.agency === 'cepa' ? 'cepa' : 'kmac';
      if (agFilter && pAg !== agFilter) return false;
      if (yr && String(p.year || '') !== yr) return false;
      var sc = SCAN_CACHE[p.id] || { unseenPreCount: 0, unseenPostCount: 0 };
      if (stFilter === 'pre_mid' && p.midConfirmedAt) return false;
      if (stFilter === 'post_mid' && !p.midConfirmedAt) return false;
      if (stFilter === 'unseen' && (sc.unseenPreCount + sc.unseenPostCount) === 0) return false;
      if (q) {
        var taskStr = (p.selectedTasks || []).map(function (c) { var t = Cat().getTask(c); return t ? t.name : ''; }).join(' ');
        var agObj = Cat().getAgency(pAg);
        var trObj = Cat().getTrack(p.track, pAg);
        var hay = (str(p.companyName) + ' ' + str(p.industry) + ' ' + str(p.transGoal) + ' ' + str(p.consultantName) + ' ' + agObj.name + ' ' + trObj.name + ' ' + taskStr).toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });

    var rows = filtered.map(function (p) {
      var sc = SCAN_CACHE[p.id] || { matched: [], unseenPreCount: 0, unseenPostCount: 0, totalInCount: 0 };
      var chkPre = Intake().summarizeChecklistProgress('pre_mid', p.agency, p.track, p.selectedTasks, D.intake[p.id] || {}, sc.matched, manualChecksOf(p, 'pre_mid'));
      var tr = Cat().getTrack(p.track, p.agency);
      var taskNames = (p.selectedTasks || []).map(function (c) { var t = Cat().getTask(c); return t ? t.name : c; }).join(' · ');

      var mailBadges = [];
      if (sc.unseenPreCount > 0) mailBadges.push('<span class="chip c-amber">📩 기초 미확인 ' + sc.unseenPreCount + '</span>');
      if (sc.unseenPostCount > 0) mailBadges.push('<span class="chip c-green">📬 후속 미확인 ' + sc.unseenPostCount + '</span>');
      if (!mailBadges.length) mailBadges.push('<span class="chip">수신 ' + (sc.totalInCount || 0) + '건 확인됨</span>');

      return {
        id: p.id,
        cells: [
          { cls: 'ti', title: p.companyName, html: esc(p.companyName) + ' <span class="chip">' + esc((p.year || 2026) + '년') + '</span>' },
          { k: 'badge', html: agencyChipHtml(p.agency) + ' <span class="chip">' + esc(tr.short) + '</span> ' + stageDotsHtml(p) },
          { cls: 'wide', title: taskNames, html: esc(str(p.transGoal) || taskNames || '과제 선택 필요') },
          { html: '기초자료 <b>' + chkPre.pct + '%</b> (' + chkPre.requiredDone + '/' + chkPre.requiredTotal + ')' },
          { html: mailBadges.join(' ') },
          {
            k: 'act',
            html: '<button class="sm" data-open-proj="' + esc(p.id) + '" data-open-tab="intake">① 기초체크</button>' +
              '<button class="sm" data-open-proj="' + esc(p.id) + '" data-open-tab="mid">② 중간보고</button>' +
              '<button class="sm pri" data-open-proj="' + esc(p.id) + '" data-open-tab="final">③ 최종·HWPX</button>'
          }
        ]
      };
    });

    if ($('projectsBox')) {
      $('projectsBox').innerHTML = renderTable('projects',
        ['사업장명', '운영기관 · 트랙 · 단계', '전환목표 · 중점과제', '기초자료 충족', '푸른메일함 감지', '작업 열기'],
        rows, CUR_PID);
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
            { html: esc(c.source + (c.bizLabel ? ' · ' + c.bizLabel : '')) },
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

      '<div class="card">' +
      '<div class="bar">' +
      '<button class="sm pri" data-act="regen-mid">⚡ 초안 자동정리</button>' +
      '<button class="sm" data-act="preview-mid">👁️ 웹 A4 미리보기</button>' +
      '<button class="sm ok" data-act="dl-mid-hwpx">📥 중간 .hwpx 다운로드</button>' +
      '<button class="sm pri" data-act="open-mid-hangul">📝 푸른한글에서 열기</button>' +
      '<button class="sm" data-act="print-mid">🖨 PDF 인쇄</button>' +
      '<span class="sp"></span>' +
      '<button class="sm ok" data-act="confirm-mid-baseline" title="중간보고 기준선 스냅샷 확정 및 후속메일 감시 시작">📌 중간보고 확정</button>' +
      '</div>' +
      renderSectionList('midSecs', ag.short + ' 중간보고서 7개 장 원고 (좌측 체크로 일괄 저장·고정 가능)', midSchema, secs, locks, 'mid', badgeCls) +
      '</div>';
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

      '<div class="card">' +
      '<div class="bar">' +
      '<button class="sm pri" data-act="regen-final" title="중간보고 기준선 + 후속 메일 Diff → 기관 맞춤 최종결과보고서 자동 조립">⚡ 결과보고 조립</button>' +
      '<button class="sm" data-act="preview-final">👁️ 웹 A4 미리보기</button>' +
      '<button class="sm ok" data-act="dl-final-hwpx">📥 결과 .hwpx 다운로드</button>' +
      '<button class="sm pri" data-act="open-final-hangul">📝 푸른한글에서 열기</button>' +
      '<button class="sm" data-act="print-final">🖨 PDF 인쇄</button>' +
      '<button class="sm warn-btn" data-act="open-sub-modal">📋 완료계·일지 문안</button>' +
      '<span class="sp"></span>' +
      '<button class="sm ok" data-act="confirm-final-snapshot">📌 최종 확정</button>' +
      '</div>' +
      renderSectionList('finalSecs', ag.short + ' (' + tr.short + ') 최종결과보고서 8개 장 원고 (좌측 체크로 일괄 저장·고정 가능)', finSchema, secs, locks, 'final', 'c-green') +
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

  async function markMailCheckedOnly(mailKey, phase) {
    var proj = projectById(CUR_PID);
    if (!proj) return;
    var built = buildCheckedMailCardPayload(proj, mailKey, phase);
    if (!built) {
      toast('⚠ 메일 제목·첨부명에 민감 식별정보 패턴이 남아 있어 저장을 차단했습니다.');
      return;
    }
    await saveIntakeCard(proj, built.record);
    rebuildScanAndDiscover();
    draw();
  }

  /* ══ 5. 온톨로지 강제 관문(gate) 및 다건 원자적 저장 함수들 (scal_jobtrans) ═══ */
  async function atomicMultiRecordUpdate(entries) {
    if (!gate || !fbDb || !entries || !entries.length) return;
    var rootRef = fbDb.ref();
    if (rootRef && typeof rootRef.update === 'function' && global.PuOntologyWrite) {
      var batch = {};
      for (var i = 0; i < entries.length; i++) {
        var e = entries[i];
        var prepared = e.tombstone
          ? global.PuOntologyWrite.tombstone(e.previous, { actor: ME.sid, entityType: e.entityType })
          : gate.prepare(e.record, { previous: e.previous || null, entityType: e.entityType });
        if (!prepared || !prepared.ok) {
          throw new Error((prepared && prepared.issues && prepared.issues[0] && prepared.issues[0].message) || '온톨로지 검증 실패');
        }
        batch[e.path] = stripUndef(prepared.value);
      }
      await rootRef.update(batch);
      return batch;
    }
    var fallbackOut = {};
    for (var j = 0; j < entries.length; j++) {
      var it = entries[j];
      if (it.tombstone) {
        var rmRes = await gate.remove(fbDb.ref(it.path), it.previous, { entityType: it.entityType });
        fallbackOut[it.path] = rmRes && rmRes.snapshot ? rmRes.snapshot.val() : null;
      } else {
        var svRes = await gate.save(fbDb.ref(it.path), it.record, { entityType: it.entityType });
        fallbackOut[it.path] = svRes && svRes.snapshot ? svRes.snapshot.val() : null;
      }
    }
    return fallbackOut;
  }

  async function saveProjectRecord(projInput) {
    if (!gate || !fbDb) throw new Error('저장 관문이 준비되지 않았습니다.');
    var id = str(projInput.id) || ('jt_' + Date.now().toString(36));
    if (!str(projInput.companyId)) {
      throw new Error('거래처(companyId)를 선택해야 등록할 수 있습니다(상호 텍스트 단독 저장 불가).');
    }
    var ag = Cat().getAgency(projInput.agency);
    var tr = Cat().getTrack(projInput.track, ag.code);
    var ref = fbDb.ref('scal_jobtrans/projects/' + id);
    var res = await gate.save(ref, function (prev) {
      return stripUndef(Object.assign({}, prev || {}, projInput, {
        id: id,
        entityType: 'Project',
        agency: ag.code,
        track: tr.code,
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
    var ref = fbDb.ref('scal_jobtrans/mid/' + proj.id);
    var res = await gate.save(ref, function (prev) {
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
    var val = res && res.snapshot ? res.snapshot.val() : null;
    if (val) D.mid[proj.id] = val;
    return val;
  }

  async function saveFinalDoc(proj, sections, locks) {
    var ref = fbDb.ref('scal_jobtrans/final/' + proj.id);
    var res = await gate.save(ref, function (prev) {
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
    var val = res && res.snapshot ? res.snapshot.val() : null;
    if (val) D.final[proj.id] = val;
    return val;
  }

  async function saveImmutableSnapshot(proj, snapObj) {
    var sid = str(snapObj.id) || ('snap_' + Date.now());
    var ref = fbDb.ref('scal_jobtrans/snapshots/' + proj.id + '/' + sid);
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
    var coOpts = '<option value="">-- 기업정보함(data/companies) 거래처 선택 (필수) --</option>' +
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
          if (!co) { toast('반드시 기업정보함 거래처를 선택해 주세요.'); return; }
          try {
            var agCode = str($('npAgency').value) || 'kmac';
            var trCode = str($('npTrack').value) || (agCode === 'cepa' ? 'cepa_coal' : 'kmac_std');
            var emails = str($('npEmail').value).split(/[,;\s]+/).map(str).filter(Boolean);
            var created = await saveProjectRecord({
              id: 'jt_' + safeKey(co.id) + '_' + agCode + '_' + str($('npYear').value || '2026'),
              companyId: co.id,
              companyName: str(co.name),
              bizNo: str(co.bizNo),
              ceoName: str(co.ceo || co.ceoName),
              contactName: contactNameOfCompany(co),
              agency: agCode,
              track: trCode,
              year: Number($('npYear').value) || 2026,
              industry: sanitizeMetaLabel(str($('npIndustry').value) || str(co.bizType), { companyName: co.name }),
              mainProduct: sanitizeMetaLabel(str($('npMainProd').value), { companyName: co.name }),
              transGoal: sanitizeMetaLabel(str($('npTransGoal').value), { companyName: co.name }),
              workerCount: Number($('npWorkers').value) || 0,
              contactEmails: emails,
              consultantName: str($('npCons').value),
              selectedTasks: agCode === 'cepa'
                ? ['jt_impact', 'jt_job_redesign', 'jt_reskill', 'jt_gov_match']
                : ['jt_impact', 'jt_job_redesign', 'jt_reskill', 'jt_emp_stab']
            });
            closeModal(true);
            CUR_PID = created.id;
            TAB = 'intake';
            clearSel();
            rebuildScanAndDiscover();
            draw();
            restoreModalFocus();
            toast(co.name + ' (' + Cat().getAgency(agCode).short + ') 워크스페이스가 개설되었습니다.');
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

    if ($('cfgSaveBtn')) {
      $('cfgSaveBtn').onclick = function () {
        return withBusy($('cfgSaveBtn'), async function () {
          var selected = Array.prototype.slice.call(document.querySelectorAll('#mbox input[name="cfgTask"]:checked')).map(function (el) { return el.value; });
          if (!selected.length) { toast('최소 1개 이상의 중점 과제를 선택해 주세요.'); return; }
          try {
            var emails = str($('cfgEmails').value).split(/[,;\s]+/).map(str).filter(Boolean);
            var co = findCompanyById(proj.companyId);
            var nextAg = str($('cfgAgency').value) || 'kmac';
            var nextTr = str($('cfgTrack').value) || (nextAg === 'cepa' ? 'cepa_coal' : 'kmac_std');
            await saveProjectRecord(Object.assign({}, proj, {
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
            }));
            closeModal(true);
            rebuildScanAndDiscover();
            draw();
            restoreModalFocus();
            toast('운영기관(' + Cat().getAgency(nextAg).short + ') 및 보고서 양식 설정이 갱신되었습니다.');
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

    if ($('rdSaveBtn')) {
      $('rdSaveBtn').onclick = function () {
        return withBusy($('rdSaveBtn'), async function () {
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

    if ($('dfSaveBtn')) {
      $('dfSaveBtn').onclick = function () {
        return withBusy($('dfSaveBtn'), async function () {
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
    var proj = projectById(CUR_PID);
    if (!proj || !global.PuAiCall) return;
    var parts = kindAndKey.split(':');
    var mode = parts[0], secKey = parts[1];
    var ta = $((mode === 'mid' ? 'midSec_' : 'finalSec_') + secKey);
    if (!ta || !str(ta.value)) { toast('다듬을 초안 본문이 비어 있습니다.'); return; }

    var schema = mode === 'mid' ? Cat().getMidSections(proj.agency) : Cat().getFinalSections(proj.agency, proj.track);
    var secMeta = schema.find(function (s) { return s.key === secKey; });
    var req = Report().buildAiPolishPrompt(secMeta ? secMeta.title : secKey, ta.value, proj.agency, projectNamesList(proj));
    if (!req.ok) { toast(req.error); return; }

    toast('개인정보 2중 가림 확인 완료 → AI 문안 윤문 요청 중…');
    try {
      var reply = await global.PuAiCall.ask([{ text: req.prompt }], {
        auth: fb.auth(),
        app: 'jobtrans',
        manual: true
      });
      var rawOut = global.PuAiCall.textOf(reply);
      var unmasked = Intake().unmaskNames(rawOut, req.back);
      var numCheck = Report().checkHallucinatedNumbers(ta.value, unmasked);

      var warnBanner = numCheck.clean
        ? '<div class="ok-banner">✓ 원본 수치 일치 검증 통과 (임의 추가된 숫자 없음)</div>'
        : '<div class="warn">⚠ 원본에 없던 숫자(' + esc(numCheck.hallucinatedNumbers.join(', ')) + ')가 감지되었습니다. 반드시 대조 후 반영하세요.</div>';

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

  async function downloadDeliverablesZip(proj, selectedIds) {
    if (!Hwpx() || !global.JSZip) { toast('패키지 생성 엔진이 로드되지 않았습니다.'); return; }
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
    downloadRawBytes(zipBytes, safeCo + '_' + agTag + '_산출물_' + selectedIds.length + '종패키지.zip', 'application/zip');
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
      ceoName: co ? str(co.ceo || co.ceoName) : '',
      contactName: contactNameOfCompany(co),
      agency: agCode,
      track: trCode,
      industry: c.industry,
      year: c.year || 2026,
      contactEmails: c.contactEmail ? [c.contactEmail] : [],
      scalCoId: c.scalCoId || '',
      scalTypeId: c.scalTypeId || '',
      selectedTasks: agCode === 'cepa'
        ? ['jt_impact', 'jt_job_redesign', 'jt_reskill', 'jt_gov_match']
        : ['jt_impact', 'jt_job_redesign', 'jt_reskill', 'jt_emp_stab'],
      consultantName: ME.name ? ME.name + ' 공인노무사' : '푸른노무법인 전담 공인노무사'
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
        toast('전체 사업장 푸른메일함 수신 현황 재점검 완료');
      };
    }
    if ($('newProjBtn')) $('newProjBtn').onclick = openNewProjectModal;
    ['projQ', 'projAgency', 'projYear', 'projStage'].forEach(function (id) {
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
        await withBusy(toggleFuBtn, async function () {
          var projFu = projectById(CUR_PID);
          if (!projFu) return;
          var fuCode = toggleFuBtn.getAttribute('data-toggle-followup');
          var nextFu = Object.assign({}, projFu.followupChecks || {});
          nextFu[fuCode] = !nextFu[fuCode];
          await saveProjectRecord(Object.assign({}, projFu, { followupChecks: nextFu }));
          draw();
          toast(nextFu[fuCode] ? '이행완료로 체크되었습니다.' : '점검예정 상태로 변경되었습니다.');
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

      if (!e.target.closest('input,button,select,a,label,textarea')) {
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
          path: 'scal_jobtrans/projects/' + rec.id,
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
            path: 'scal_jobtrans/projects/' + rec.id,
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
            path: 'scal_jobtrans/intake/' + CUR_PID + '/' + prevC.id,
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
      await downloadDeliverablesZip(proj, ids);
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
      await downloadDeliverablesZip(proj, ['mid_hwpx', 'final_hwpx', 'comp_hwpx', 'data_xlsx', 'sub_txt']);
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
      toast('수집된 기초자료와 운영기관 양식에 맞춰 중간보고서가 자동 정리되었습니다(수기 고정 섹션 보존).');
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
      toast('중간보고 기준선이 확정되었습니다. 이제 후속 메일 자동 감시 및 최종보고서 단계로 전환됩니다.');
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
      toast('중간보고 기준선과 후속 메일 Diff를 반영해 ' + Cat().getAgency(proj.agency).short + ' 최종결과보고서를 조립했습니다.');
    } else if (act === 'confirm-final-snapshot') {
      var domF2 = readCurrentFinalSectionsFromDom(proj);
      await saveFinalDoc(proj, domF2.sections, domF2.locks);
      var nowF = Date.now();
      await saveImmutableSnapshot(proj, {
        id: 'snap_final_' + nowF,
        kind: 'final_report',
        agency: proj.agency || 'kmac',
        track: proj.track || 'kmac_std',
        title: proj.companyName + ' (' + Cat().getAgency(proj.agency).short + ') 최종결과보고 확정 스냅샷',
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

  global.PuJobtransView = {
    boot: boot,
    reload: reload
  };
})(typeof window !== 'undefined' ? window : globalThis);
