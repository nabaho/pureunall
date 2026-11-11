/* 푸른통합시스템 — 괴롭힘·성희롱 조사 화면 제어기 (pu-harass.html 전용)
 *
 * 맡는 일:
 *   1. Firebase 인증 · 재직자 확인(uid_roles) · 온톨로지 강제 저장 관문(PuOntologyWrite enforce) 초기화
 *   2. 푸른이알피 사건(data/cases) + 조사 전용 원장(harass_invest/cases) + 푸른 메일함(mailbox) 통합 적재
 *   3. 사건별 공문·서류 메일 자동 수집, 미등록 사건 묶음(Bundle) 원클릭 등록, 푸른이알피 진행과정 동기화(erp_sync)
 *   4. 메일 본문(peek:1)·첨부파일 메모리 열람 및 다음메일 전체 폴더 과거 공문 심층검색(searchMailbox)
 *   5. 비밀유지 금고(harass_secret) — 담당 노무사·대표만 면담 진술·3요건 검토·조사결과보고서 열람·편집·인쇄
 */
(function (global) {
  'use strict';

  var C = global.PuHarassCore;
  var MB_FN = 'https://asia-northeast3-pureun-erp.cloudfunctions.net/';

  var fb = null;
  var fbDb = null;
  var gate = null;
  var ME = { uid: '', sid: '', name: '', isAdmin: false, isSubAdmin: false };

  var D = {
    cases: {},
    erpSync: {},
    erpAck: {},
    dismissed: {},
    companies: [],
    erpCases: [],
    caseTypes: [],
    mailFolders: {},
    mailMsgs: {},
    extraMailRows: [],
    imapHitKeys: {},
    secretCache: {},
    secretDenied: {}
  };

  var NAMES = {};
  var STAFF = [];
  var CO_DIR = null;
  var MAIL_ROWS = [];
  var MERGED_CASES = [];
  var BUNDLES = [];

  var TAB = 'cases';
  var CUR_ID = '';
  var SEL = {};
  var ACK_WATCHED = false;
  var SECRET_LOADING = {};
  var DIRTY_RPT = {};
  var LAST_FOCUS = null;
  var SESSION_EPOCH = 0;
  var MODAL_SEQ = 0;

  function currentAuthUid() {
    try {
      return (fb && fb.auth && fb.auth().currentUser && fb.auth().currentUser.uid) ? String(fb.auth().currentUser.uid) : '';
    } catch (e) { return ''; }
  }
  function isSessionCurrent(epoch, uid) {
    return !!uid && epoch === SESSION_EPOCH && !!ME && ME.uid === uid && currentAuthUid() === uid;
  }

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }
  function toast(msg) {
    var el = $('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('on');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.classList.remove('on'); }, 3500);
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
  function sidKey(v) { return String(v == null ? '' : v).toUpperCase().replace(/[^A-Z0-9]/g, ''); }
  function nameOf(sid) {
    var s = C.str(sid);
    if (!s) return '-';
    return NAMES[sidKey(s)] || (/^[A-Za-z]-?\d{3,4}$/.test(s) ? '담당자' : s);
  }
  function mgrText(rec) {
    if (!rec) return '-';
    var main = C.str(rec.managerMain) ? nameOf(rec.managerMain) : '';
    var subs = (Array.isArray(rec.managerSubs) ? rec.managerSubs : []).map(nameOf).filter(function (n) { return n && n !== '-'; });
    if (!main && !subs.length) return '미지정';
    return main + (subs.length ? ' (부: ' + subs.join('·') + ')' : '');
  }
  function canEditCase(rec) {
    if (!ME || !C.str(ME.sid)) return false;
    if (ME.isAdmin) return true;
    return C.canAccessSecret(rec, ME);
  }
  function canChangeManagers(rec) {
    if (!ME || !C.str(ME.sid)) return false;
    if (ME.isAdmin) return true;
    if (!rec || !rec.id || (!D.cases[rec.id] && !rec._virtualFromErp)) return true;
    return C.str(rec.managerMain) === C.str(ME.sid);
  }
  function catChip(code) {
    var c = C.CATEGORIES[code] || C.CATEGORIES.harass;
    var cls = code === 'sexual' ? 'c-red' : code === 'both' ? 'c-amber' : 'c-blue';
    return '<span class="chip ' + cls + '">' + esc(c.short) + '</span>';
  }
  function stepDots(steps) {
    var st = steps || {};
    var highest = -1;
    C.STEPS.forEach(function (d, idx) { if (st[d.code] && st[d.code].done) highest = idx; });
    return '<span class="pbar">' + C.STEPS.map(function (d, idx) {
      var done = !!(st[d.code] && st[d.code].done);
      var cur = !done && idx === highest + 1;
      return '<span class="pdot' + (done ? ' done' : cur ? ' cur' : '') + '" title="' + esc(d.name) + '"></span>';
    }).join('') + '</span>';
  }
  function trustedAckErpId(caseId, ack) {
    if (!ack || !ack.erpCaseId) return '';
    var det = 'c-hi-' + C.safeKey(caseId);
    return String(ack.erpCaseId) === det ? det : '';
  }
  function erpLinkChip(c) {
    var ack = D.erpAck[c.id];
    var sync = D.erpSync[c.id];
    var eid = C.str(c.erpCaseId) || trustedAckErpId(c.id, ack);
    var no = C.str(c.erpCaseNo) || (eid && ack && ack.erpCaseId === eid ? C.str(ack.erpCaseNo) : '');
    if (eid && (!sync || (ack && ack.erpCaseId === eid && Number(ack.syncedRevision || 0) === Number(sync.revision || 0)))) {
      return '<span class="chip c-green" title="푸른이알피 사건 및 업무메모와 동기화됨">✓ ' + esc(no || '이알피 연결') + '</span>';
    }
    if (sync) {
      return '<span class="chip c-amber" title="푸른이알피를 열면 즉시 반영됩니다">⏳ ' + esc(no || '이알피 반영 대기') + '</span>';
    }
    if (eid) {
      return '<span class="chip c-blue">🏢 ' + esc(no || '이알피 사건') + '</span>';
    }
    return '<span class="chip">미연결</span>';
  }

  /* ═══ HTML 메일 안전 평문 추출기 (DOMParser 비활성 문서 — img onerror 등 XSS 원천 차단) ═══ */
  function htmlToSafePlainText(rawHtml) {
    var s = String(rawHtml == null ? '' : rawHtml);
    if (!s) return '';
    if (typeof DOMParser !== 'undefined') {
      var doc = new DOMParser().parseFromString(s, 'text/html');
      doc.querySelectorAll('script,style,noscript,template,iframe,object,embed').forEach(function (el) {
        if (el && el.parentNode) el.parentNode.removeChild(el);
      });
      return C.str((doc.body && doc.body.textContent) || '');
    }
    return C.str(s.replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' '));
  }

  /* ═══ 로그아웃·계정 전환 시 기밀 상태 및 DOM 즉시 폐기 ═══ */
  function purgeSessionState() {
    SESSION_EPOCH++;
    if (ACK_WATCHED && fbDb) {
      try { fbDb.ref('harass_invest/erp_ack').off(); } catch (e) {}
    }
    ACK_WATCHED = false;
    gate = null;
    ME = { uid: '', sid: '', name: '', isAdmin: false, isSubAdmin: false };
    TAB = 'cases';
    CUR_ID = '';
    SEL = {};
    SECRET_LOADING = {};
    DIRTY_RPT = {};
    D.cases = {};
    D.erpSync = {};
    D.erpAck = {};
    D.dismissed = {};
    D.companies = [];
    D.erpCases = [];
    D.caseTypes = [];
    D.mailFolders = {};
    D.mailMsgs = {};
    D.extraMailRows = [];
    D.imapHitKeys = {};
    D.secretCache = {};
    D.secretDenied = {};
    MERGED_CASES = [];
    BUNDLES = [];
    MAIL_ROWS = [];
    closeModal();
    ['kpiBox', 'casesBox', 'inboxBox', 'detailBox', 'reportBox', 'printArea'].forEach(function (id) {
      var el = $(id);
      if (el) el.innerHTML = '';
    });
    if ($('app')) $('app').style.display = 'none';
  }

  /* ═══ 공통 표(맨 왼쪽 ☐ + 순서 번호 + 일괄 실행 바) ═══ */
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
          return '<td' + cls + dk + '>' + cell.html + '</td>';
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
  function clearSel(names) {
    if (!names) { SEL = {}; return; }
    names.forEach(function (nm) {
      pickedIds(nm).forEach(function (id) { delete SEL[nm + '|' + id]; });
    });
  }
  function drawBulks() {
    var curCase = caseById(CUR_ID);
    var curEditable = curCase ? canEditCase(curCase) : false;
    document.querySelectorAll('[data-bulk]').forEach(function (el) {
      var nm = el.getAttribute('data-bulk');
      var n = pickedIds(nm).length;
      el.className = 'bulk' + (n ? ' on' : '');
      if (!n) { el.innerHTML = ''; return; }
      var btns = '';
      if (nm === 'cases') {
        btns = '<button class="sm pri" data-bulkact="cases:sync">🔄 선택 사건 메일수집 + 이알피 동기화</button>' +
          '<button class="sm danger" data-bulkact="cases:del">선택 사건 삭제</button>';
      } else if (nm === 'bundles') {
        btns = '<button class="sm pri" data-bulkact="bundles:reg">➕ 선택 후보 일괄 사건등록 + 이알피 반영</button>' +
          '<button class="sm" data-bulkact="bundles:hide">🙈 목록에서 제외</button>';
      } else if (nm === 'steps') {
        btns = curEditable
          ? ('<button class="sm ok" data-bulkact="steps:done">✓ 선택 단계 완료 처리 + 이알피 반영</button>' +
             '<button class="sm" data-bulkact="steps:undo">미완료로 되돌리기</button>')
          : '<span class="hint">담당 노무사·대표만 단계 일괄 변경 가능</span>';
      } else if (nm === 'mails') {
        btns = curEditable
          ? '<button class="sm danger" data-bulkact="mails:unlink">연결 해제</button>'
          : '<span class="hint">담당 노무사·대표만 연결 해제 가능</span>';
      } else if (nm === 'interviews') {
        btns = '<button class="sm danger" data-bulkact="interviews:del">선택 진술 삭제</button>';
      } else if (nm === 'issues') {
        btns = '<button class="sm danger" data-bulkact="issues:del">선택 쟁점 삭제</button>';
      }
      el.innerHTML = '선택 <b>' + n + '</b>건 ' + btns + ' <button class="sm" data-bulkclr="' + esc(nm) + '">선택 해제</button>';
    });
  }

  /* ═══ 데이터 정규화 및 통합 병합 ═══ */
  function rowsOf(raw) {
    var x = raw && typeof raw === 'object' && !Array.isArray(raw) && raw.v !== undefined ? raw.v : raw;
    if (Array.isArray(x)) return x.filter(function (r) { return r && typeof r === 'object' && !r._deleted; });
    if (x && typeof x === 'object') return Object.keys(x).map(function (k) { return x[k]; }).filter(function (r) { return r && typeof r === 'object' && !r._deleted; });
    return [];
  }

  function rebuildDerived() {
    CO_DIR = C.buildCompanyDirectory(D.companies);
    var baseRows = C.flattenMailbox(D.mailFolders, D.mailMsgs);
    var seenKeys = {};
    MAIL_ROWS = [];
    baseRows.concat(D.extraMailRows).forEach(function (r) {
      if (!r || !r.key || seenKeys[r.key]) return;
      seenKeys[r.key] = 1;
      if (D.imapHitKeys[r.key]) r = Object.assign({}, r, { imapHit: true });
      MAIL_ROWS.push(r);
    });
    MAIL_ROWS.sort(function (a, b) { return (b.ts - a.ts); });

    /* 1) harass_invest/cases 에 저장된 사건 */
    var byId = {};
    var byErpId = {};
    var erpMap = {};
    D.erpCases.forEach(function (ec) { if (ec && ec.id && !ec._deleted) erpMap[String(ec.id)] = ec; });

    Object.keys(D.cases || {}).forEach(function (k) {
      var rec = D.cases[k];
      if (!rec || typeof rec !== 'object' || rec._deleted) return;
      var copy = Object.assign({}, rec);
      var ack = D.erpAck[copy.id];
      var safeAckEid = trustedAckErpId(copy.id, ack);
      if (!copy.erpCaseId && safeAckEid) copy.erpCaseId = safeAckEid;
      if (!copy.erpCaseNo && copy.erpCaseId && ack && ack.erpCaseId === copy.erpCaseId && ack.erpCaseNo) copy.erpCaseNo = ack.erpCaseNo;
      if (copy.erpCaseId && erpMap[copy.erpCaseId]) {
        var ec = erpMap[copy.erpCaseId];
        copy.erpCaseNo = copy.erpCaseNo || C.str(ec.caseNo);
        copy.companyId = copy.companyId || C.str(ec.companyId);
        copy.companyName = copy.companyName || C.str(ec.companyName);
        copy.managerMain = copy.managerMain || C.str(ec.managerMain);
        if ((!copy.managerSubs || !copy.managerSubs.length) && Array.isArray(ec.managerSubs)) copy.managerSubs = ec.managerSubs.slice(0, 5);
        copy.receiveDate = copy.receiveDate || C.str(ec.receiveDate);
        copy.dueDate = copy.dueDate || C.str(ec.dueDate);
        copy.closeDate = copy.closeDate || C.str(ec.closeDate);
      }
      byId[copy.id] = copy;
      if (copy.erpCaseId) byErpId[copy.erpCaseId] = copy;
    });

    /* 2) 푸른이알피(data/cases)에 이미 등록된 조사 사건 중 harass_invest 에 아직 없는 건도 자동 통합 */
    D.erpCases.forEach(function (ec) {
      if (!C.isErpInvestigateCase(ec, D.caseTypes)) return;
      var eid = C.str(ec.id);
      if (!eid || byErpId[eid]) return;
      var hid = 'hi_' + C.safeKey(eid);
      if (byId[hid]) return;
      byId[hid] = {
        id: hid,
        erpCaseId: eid,
        erpCaseNo: C.str(ec.caseNo),
        companyId: C.str(ec.companyId),
        companyLinkStatus: C.str(ec.companyId) ? 'linked' : 'pending',
        companyName: C.str(ec.companyName),
        bizNo: C.str(ec.bizNo),
        email: (ec.jurisdiction && C.str(ec.jurisdiction.email)) || '',
        contacts: Array.isArray(ec.contacts) ? ec.contacts : [],
        category: C.inferCategory(C.str(ec.title) + ' ' + C.str(ec.brief) + ' ' + C.str(ec.note)),
        title: C.str(ec.title) || (C.str(ec.companyName) + ' 조사 사건'),
        managerMain: C.str(ec.managerMain),
        managerSubs: Array.isArray(ec.managerSubs) ? ec.managerSubs.slice(0, 5) : [],
        receiveDate: C.str(ec.receiveDate),
        dueDate: C.str(ec.dueDate),
        closeDate: C.str(ec.closeDate),
        verdictSummary: '',
        mailLinks: [],
        steps: {},
        _virtualFromErp: true
      };
    });

    /* 3) 동일 사업장 동시 사건 충돌 방지를 위해 전체 peer 목록을 함께 전달하여 메일·모호건·한도초과 계산 */
    var rawPeers = Object.keys(byId).map(function (id) { return byId[id]; });
    rawPeers.forEach(function (c) {
      var scan = C.scanMailsForCaseInternal(c, MAIL_ROWS, CO_DIR, rawPeers);
      if (c._virtualFromErp) {
        c.mailLinks = scan.items;
        c.steps = C.deriveStepsFromMails({}, c.mailLinks, c.receiveDate, c.closeDate);
      }
      c._ambiguousMails = scan.ambiguous || [];
      c._truncatedMails = scan.truncated || 0;
    });

    MERGED_CASES = rawPeers.map(function (c) {
      c.progress = C.summarizeProgress(c.steps, c.closeDate);
      return c;
    }).sort(function (a, b) {
      var da = C.str(a.receiveDate) || '0000-00-00';
      var db = C.str(b.receiveDate) || '0000-00-00';
      if (da !== db) return db.localeCompare(da);
      return Number(b.updatedAt || 0) - Number(a.updatedAt || 0);
    });

    if (CUR_ID && !byId[CUR_ID]) CUR_ID = '';
    if (!CUR_ID && MERGED_CASES.length) CUR_ID = MERGED_CASES[0].id;

    BUNDLES = C.discoverUnregisteredBundles(MAIL_ROWS, MERGED_CASES, CO_DIR, D.dismissed);
  }

  function caseById(id) {
    for (var i = 0; i < MERGED_CASES.length; i++) {
      if (MERGED_CASES[i].id === id) return MERGED_CASES[i];
    }
    return null;
  }

  /* ═══ 저장 헬퍼 (온톨로지 강제 관문 통과 + 이알피 동기화 큐 발행) ═══ */
  function normalizeSubs(subs, mainSid) {
    var out = [];
    var m = C.str(mainSid);
    (Array.isArray(subs) ? subs : []).forEach(function (s) {
      var v = C.str(s);
      if (!v || v === m || out.indexOf(v) >= 0) return;
      if (!/^[A-Za-z0-9_-]{1,20}$/.test(v)) return;
      if (out.length < 5) out.push(v);
    });
    return out;
  }

  function trimCaseMails(mailLinks) {
    var raw = Array.isArray(mailLinks) ? mailLinks : [];
    var seen = {};
    var man = [];
    var auto = [];
    raw.forEach(function (m) {
      if (!m || !m.key || seen[m.key]) return;
      seen[m.key] = 1;
      if (m.manual === true) man.push(m);
      else auto.push(m);
    });
    var cap = C.MAX_CASE_MAILS || 300;
    var keptAuto = auto.slice(0, Math.max(0, cap - man.length));
    return man.concat(keptAuto).sort(function (a, b) { return (Number(b.ts) || 0) - (Number(a.ts) || 0); });
  }

  function cleanCaseForSave(rec) {
    var eid = C.str(rec.erpCaseId);
    var mainSid = C.str(rec.managerMain);
    var out = {
      id: C.str(rec.id),
      companyId: C.str(rec.companyId),
      companyLinkStatus: C.str(rec.companyId) ? 'linked' : 'pending',
      companyName: C.str(rec.companyName),
      bizNo: C.str(rec.bizNo),
      email: C.str(rec.email),
      category: C.str(rec.category || 'harass'),
      title: C.str(rec.title),
      managerMain: mainSid,
      managerSubs: normalizeSubs(rec.managerSubs, mainSid),
      receiveDate: C.str(rec.receiveDate),
      dueDate: C.str(rec.dueDate),
      closeDate: C.str(rec.closeDate),
      verdictSummary: C.str(rec.verdictSummary),
      erpCaseId: eid,
      erpCaseNo: C.str(rec.erpCaseNo),
      steps: rec.steps || {},
      mailLinks: trimCaseMails(rec.mailLinks)
    };
    if (eid) {
      out.sourceKind = 'case';
      out.sourceId = eid;
    }
    return stripUndef(out);
  }

  /* 서버 최신 사건 스냅샷(prev) 위에 실제 변경된 필드·단계·메일만 병합하여 공동담당 간 덮어쓰기를 방지 */
  function applyCaseMutation(prev, seedClean, mutation) {
    var hasPrev = !!(prev && typeof prev === 'object' && !prev._deleted);
    var src = hasPrev ? cleanCaseForSave(prev) : seedClean;
    var m = mutation || null;
    if (!m) {
      var direct = Object.assign({}, prev || {}, seedClean);
      if (!seedClean.erpCaseId) { delete direct.sourceKind; delete direct.sourceId; }
      return direct;
    }

    var next = Object.assign({}, prev || {}, src);
    if (m.fields && typeof m.fields === 'object') {
      Object.keys(m.fields).forEach(function (k) {
        if (m.fields[k] !== undefined) next[k] = m.fields[k];
      });
    }
    next.companyLinkStatus = C.str(next.companyId) ? 'linked' : 'pending';
    next.managerMain = C.str(next.managerMain);
    next.managerSubs = normalizeSubs(next.managerSubs, next.managerMain);

    var curLinks = Array.isArray(src.mailLinks) ? src.mailLinks.slice() : [];
    var deriveMails = false;
    if (m.upsertMail && m.upsertMail.key) {
      var uk = m.upsertMail.key;
      var existed = false;
      curLinks = curLinks.map(function (x) {
        if (x && x.key === uk) { existed = true; return Object.assign({}, x, m.upsertMail); }
        return x;
      });
      if (!existed) curLinks.unshift(m.upsertMail);
      deriveMails = true;
    }
    if (m.addedMails && Array.isArray(m.addedMails)) {
      var seenAdd = {};
      curLinks.forEach(function (x) { if (x && x.key) seenAdd[x.key] = 1; });
      m.addedMails.forEach(function (x) {
        if (x && x.key && !seenAdd[x.key]) { seenAdd[x.key] = 1; curLinks.push(x); }
      });
      deriveMails = true;
    }
    if (m.syncedAutoMails && Array.isArray(m.syncedAutoMails)) {
      var manOnly = curLinks.filter(function (x) { return x && x.manual === true; });
      var seenMan = {};
      manOnly.forEach(function (x) { seenMan[x.key] = 1; });
      curLinks = manOnly.concat(m.syncedAutoMails.filter(function (x) { return x && x.key && !seenMan[x.key]; }));
      deriveMails = true;
    }
    if (m.removeMailKeys && typeof m.removeMailKeys === 'object') {
      curLinks = curLinks.filter(function (x) { return x && !m.removeMailKeys[x.key]; });
    }
    next.mailLinks = trimCaseMails(curLinks);

    var nextSteps = Object.assign({}, src.steps || {});
    if (deriveMails || m.rederiveSteps) {
      nextSteps = C.deriveStepsFromMails(nextSteps, next.mailLinks, next.receiveDate, next.closeDate);
    }
    if (m.autoStepPatches && typeof m.autoStepPatches === 'object') {
      Object.keys(m.autoStepPatches).forEach(function (sc) {
        var curS = nextSteps[sc];
        if (!curS || (!curS.done && !curS.manual)) {
          nextSteps[sc] = m.autoStepPatches[sc];
        }
      });
    }
    if (m.stepPatches && typeof m.stepPatches === 'object') {
      Object.keys(m.stepPatches).forEach(function (sc) {
        nextSteps[sc] = m.stepPatches[sc];
      });
    }
    next.steps = nextSteps;

    if (m.closeDate !== undefined) {
      next.closeDate = C.str(m.closeDate);
    }
    if (C.str(next.erpCaseId)) {
      next.sourceKind = 'case';
      next.sourceId = C.str(next.erpCaseId);
    } else {
      delete next.sourceKind;
      delete next.sourceId;
    }
    return stripUndef(next);
  }

  async function saveCaseAndSync(rec, skipSync, mutation, optEpoch, optUid) {
    var reqEpoch = optEpoch || SESSION_EPOCH;
    var reqUid = optUid || (ME && ME.uid ? String(ME.uid) : '');
    if (!isSessionCurrent(reqEpoch, reqUid)) return null;
    var clean = cleanCaseForSave(rec);
    var cRef = fbDb.ref('harass_invest').child('cases').child(clean.id);
    var computedAllowPending = !clean.companyId;
    var savedRes = await gate.save(cRef, function (prev) {
      var merged = applyCaseMutation(prev, clean, mutation);
      computedAllowPending = !C.str(merged.companyId);
      return merged;
    }, { entityType: 'Case', allowPendingCompany: true });
    if (!isSessionCurrent(reqEpoch, reqUid)) return null;
    var savedVal = savedRes && savedRes.snapshot ? savedRes.snapshot.val() : applyCaseMutation(null, clean, mutation);
    D.cases[clean.id] = savedVal;

    if (!skipSync && isSessionCurrent(reqEpoch, reqUid)) {
      var syncPayload = C.buildErpSyncPayload(savedVal);
      if (syncPayload) {
        if (savedVal.erpCaseId) {
          syncPayload.sourceKind = 'case';
          syncPayload.sourceId = savedVal.erpCaseId;
        }
        var sClean = stripUndef(syncPayload);
        var sRef = fbDb.ref('harass_invest').child('erp_sync').child(clean.id);
        var sRes = await gate.save(sRef, function (prev) {
          var base = Object.assign({}, prev || {}, sClean);
          if (!sClean.erpCaseId) { delete base.sourceKind; delete base.sourceId; }
          return base;
        }, { entityType: 'Task', allowPendingCompany: computedAllowPending || !sClean.companyId });
        if (sRes && sRes.snapshot && isSessionCurrent(reqEpoch, reqUid)) {
          D.erpSync[clean.id] = sRes.snapshot.val();
        }
      }
    }
    if (isSessionCurrent(reqEpoch, reqUid)) rebuildDerived();
    return savedVal;
  }

  async function ensureSecretLoaded(cid) {
    var reqEpoch = SESSION_EPOCH;
    var reqUid = ME && ME.uid ? String(ME.uid) : '';
    if (!isSessionCurrent(reqEpoch, reqUid)) return null;
    var c = caseById(cid);
    if (!c || !C.canAccessSecret(c, ME)) return null;
    if (D.secretCache[cid]) return D.secretCache[cid];
    if (SECRET_LOADING[cid] && SECRET_LOADING[cid].epoch === reqEpoch) return SECRET_LOADING[cid].promise;
    var p = (async function () {
      try {
        var snap = await fbDb.ref('harass_secret').child(cid).once('value');
        if (!isSessionCurrent(reqEpoch, reqUid)) return null;
        var latestCase = caseById(cid) || c;
        if (!C.canAccessSecret(latestCase, ME)) return null;
        var val = snap.val();
        delete D.secretDenied[cid];
        D.secretCache[cid] = (val && !val._deleted) ? val : {
          id: cid,
          companyId: C.str(latestCase.companyId),
          overview: '',
          conclusion: '',
          recommendations: '',
          interviews: [],
          issues: [],
          reportBody: ''
        };
        return D.secretCache[cid];
      } catch (e) {
        if (isSessionCurrent(reqEpoch, reqUid)) {
          D.secretDenied[cid] = String((e && e.message) || e || '비밀유지 자료 읽기 실패');
        }
        return null;
      } finally {
        if (SECRET_LOADING[cid] && SECRET_LOADING[cid].promise === p) {
          delete SECRET_LOADING[cid];
        }
      }
    })();
    SECRET_LOADING[cid] = { epoch: reqEpoch, promise: p };
    return p;
  }

  function upsertListById(list, item) {
    var arr = Array.isArray(list) ? list.slice() : [];
    var idx = arr.findIndex(function (x) { return x && x.id === item.id; });
    if (idx >= 0) arr[idx] = item; else arr.push(item);
    return arr;
  }

  function markDeletedByIds(list, rmMap) {
    return (Array.isArray(list) ? list : []).map(function (x) {
      return (x && rmMap[x.id]) ? Object.assign({}, x, { _deleted: true }) : x;
    });
  }

  /* 서버 최신 스냅샷(prev) 위에서 항목 단위로 병합하여 두 담당자의 동시 수정을 안전하게 보존 */
  async function saveSecretRecord(cid, op, optEpoch, optUid) {
    var reqEpoch = optEpoch || SESSION_EPOCH;
    var reqUid = optUid || (ME && ME.uid ? String(ME.uid) : '');
    if (!isSessionCurrent(reqEpoch, reqUid)) return null;
    var c = caseById(cid);
    if (!c) throw new Error('사건을 찾지 못했습니다.');
    if (!C.canAccessSecret(c, ME)) throw new Error('담당 노무사 또는 대표만 저장할 수 있습니다.');
    if (c._virtualFromErp) {
      await saveCaseAndSync(c, false, null, reqEpoch, reqUid);
      if (!isSessionCurrent(reqEpoch, reqUid)) return null;
    }
    var fallback = D.secretCache[cid] || { id: cid, interviews: [], issues: [] };
    var spec = op || {};
    var coId = C.str(c.companyId);
    var erpId = C.str(c.erpCaseId);
    var ref = fbDb.ref('harass_secret').child(cid);

    var res = await gate.save(ref, function (prev) {
      var src = (prev && typeof prev === 'object') ? prev : fallback;
      var ivs = Array.isArray(spec.interviews)
        ? spec.interviews
        : (Array.isArray(src.interviews) ? src.interviews : (fallback.interviews || []));
      if (spec.upsertInterview) ivs = upsertListById(ivs, spec.upsertInterview);
      if (spec.deleteInterviewIds) ivs = markDeletedByIds(ivs, spec.deleteInterviewIds);

      var isss = Array.isArray(spec.issues)
        ? spec.issues
        : (Array.isArray(src.issues) ? src.issues : (fallback.issues || []));
      if (spec.upsertIssue) isss = upsertListById(isss, spec.upsertIssue);
      if (spec.deleteIssueIds) isss = markDeletedByIds(isss, spec.deleteIssueIds);

      var base = Object.assign({}, src, stripUndef({
        id: cid,
        companyId: coId,
        overview: C.maskRrnText(spec.overview !== undefined ? spec.overview : (src.overview !== undefined ? src.overview : fallback.overview)),
        conclusion: C.maskRrnText(spec.conclusion !== undefined ? spec.conclusion : (src.conclusion !== undefined ? src.conclusion : fallback.conclusion)),
        recommendations: C.maskRrnText(spec.recommendations !== undefined ? spec.recommendations : (src.recommendations !== undefined ? src.recommendations : fallback.recommendations)),
        interviews: ivs,
        issues: isss,
        reportBody: C.maskRrnText(spec.reportBody !== undefined ? spec.reportBody : (src.reportBody !== undefined ? src.reportBody : fallback.reportBody))
      }));
      if (erpId) {
        base.sourceKind = 'case';
        base.sourceId = erpId;
      } else {
        delete base.sourceKind;
        delete base.sourceId;
      }
      return base;
    }, { entityType: 'Document', allowPendingCompany: !coId });

    if (!isSessionCurrent(reqEpoch, reqUid)) return null;
    var saved = res && res.snapshot ? res.snapshot.val() : null;
    if (saved) D.secretCache[cid] = saved;
    if (spec.overview !== undefined || spec.conclusion !== undefined || spec.recommendations !== undefined || spec.reportBody !== undefined) {
      DIRTY_RPT = {};
    }
    return saved;
  }

  /* ═══ 전체 데이터 적재 ═══ */
  async function reload(optEpoch, optUid) {
    var reqEpoch = optEpoch || SESSION_EPOCH;
    var reqUid = optUid || (ME && ME.uid ? String(ME.uid) : '');
    if (!isSessionCurrent(reqEpoch, reqUid)) return;
    var tasks = [
      fbDb.ref('harass_invest/cases').once('value'),
      fbDb.ref('harass_invest/erp_sync').once('value'),
      fbDb.ref('harass_invest/erp_ack').once('value'),
      fbDb.ref('harass_invest/dismissed').once('value'),
      fbDb.ref('data/companies/v').once('value'),
      fbDb.ref('data/cases/v').once('value'),
      fbDb.ref('data/biz_case_types/v').once('value'),
      fbDb.ref('mailbox/folders').once('value'),
      fbDb.ref('mailbox/msgs').once('value')
    ];
    var labels = ['조사사건', '동기화큐', '동기화응답', '제외목록', '업체원장', '이알피사건', '사건유형', '메일폴더', '메일목록'];
    var res = await Promise.allSettled(tasks);
    if (!isSessionCurrent(reqEpoch, reqUid)) return;
    var fails = [];
    function valAt(i, fallback) {
      if (res[i].status === 'fulfilled') return res[i].value.val() || fallback;
      fails.push(labels[i]);
      return fallback;
    }
    D.cases = valAt(0, {});
    D.erpSync = valAt(1, {});
    D.erpAck = valAt(2, {});
    D.dismissed = valAt(3, {});
    D.companies = rowsOf(valAt(4, []));
    D.erpCases = rowsOf(valAt(5, []));
    D.caseTypes = rowsOf(valAt(6, []));
    D.mailFolders = valAt(7, {});
    D.mailMsgs = valAt(8, {});

    var noteEl = $('loadNote');
    if (noteEl) {
      noteEl.style.display = fails.length ? '' : 'none';
      noteEl.textContent = fails.length ? ('일부 자료를 아직 읽지 못했습니다(' + fails.join('·') + '). 권한 또는 연결 상태를 확인하세요.') : '';
    }

    if (!ACK_WATCHED) {
      ACK_WATCHED = true;
      try {
        fbDb.ref('harass_invest/erp_ack').on('value', function (snap) {
          if (!isSessionCurrent(SESSION_EPOCH, ME && ME.uid)) return;
          D.erpAck = snap.val() || {};
          rebuildDerived();
          draw();
        });
      } catch (e) {}
    }

    rebuildDerived();
    applyUrlDeepLink();
    if (TAB === 'report' && CUR_ID) {
      await ensureSecretLoaded(CUR_ID);
      if (!isSessionCurrent(reqEpoch, reqUid)) return;
    }
    draw();
  }

  function applyUrlDeepLink() {
    try {
      var sp = new URLSearchParams(location.search);
      var hp = new URLSearchParams(String(location.hash || '').replace(/^#/, ''));
      var wantErp = sp.get('erp') || hp.get('erp') || '';
      var wantCase = sp.get('case') || hp.get('case') || '';
      if (wantErp) {
        var found = MERGED_CASES.find(function (c) { return C.str(c.erpCaseId) === wantErp || c.id === 'hi_' + C.safeKey(wantErp); });
        if (found) { CUR_ID = found.id; TAB = 'detail'; }
      } else if (wantCase && caseById(wantCase)) {
        CUR_ID = wantCase;
        TAB = 'detail';
      }
      if ((wantErp || wantCase) && history && history.replaceState) {
        history.replaceState(null, '', location.pathname);
      }
    } catch (e) {}
  }

  /* ═══ 화면 그리기 ═══ */
  function fillMgrFilter() {
    var sel = $('caseMgr');
    if (!sel) return;
    var cur = sel.value;
    sel.innerHTML = '<option value="">담당 노무사 전체</option>' + STAFF.map(function (s) {
      return '<option value="' + esc(s.sid) + '">' + esc(s.name) + '</option>';
    }).join('');
    sel.value = cur;
  }

  function draw() {
    document.querySelectorAll('#tabs button[data-tab]').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-tab') === TAB);
    });
    ['cases', 'inbox', 'detail', 'report'].forEach(function (t) {
      var p = $('p-' + t);
      if (p) p.classList.toggle('on', t === TAB);
    });
    $('nCases').textContent = String(MERGED_CASES.length);
    $('nInbox').textContent = String(BUNDLES.length);
    if ($('mailStat')) {
      $('mailStat').textContent = '스캔 메일 ' + MAIL_ROWS.length.toLocaleString() + '통 · 미등록 후보 ' + BUNDLES.length + '묶음';
    }

    if (TAB === 'cases') drawCasesPane();
    else if (TAB === 'inbox') drawInboxPane();
    else if (TAB === 'detail') drawDetailPane();
    else if (TAB === 'report') drawReportPane();
    drawBulks();
  }

  function drawCasesPane() {
    var openCnt = 0, closedCnt = 0, totalMails = 0;
    MERGED_CASES.forEach(function (c) {
      if (c.progress.erpStatus === 'closed') closedCnt++; else openCnt++;
      totalMails += (c.mailLinks || []).length;
    });
    $('kpiBox').innerHTML =
      '<div class="kpi k-blue"><span>전체 조사 사건</span><b>' + MERGED_CASES.length + '건</b></div>' +
      '<div class="kpi k-green"><span>진행·법리검토 중</span><b>' + openCnt + '건 (종결 ' + closedCnt + ')</b></div>' +
      '<div class="kpi"><span>사건별 수집 공문·메일</span><b>' + totalMails + '건</b></div>' +
      '<div class="kpi k-amber"><span>미등록 메일 후보 묶음</span><b>' + BUNDLES.length + '묶음</b></div>';

    var q = C.str($('caseQ') && $('caseQ').value).toLowerCase();
    var cat = C.str($('caseCat') && $('caseCat').value);
    var st = C.str($('caseSt') && $('caseSt').value);
    var mgr = C.str($('caseMgr') && $('caseMgr').value);

    var filtered = MERGED_CASES.filter(function (c) {
      if (cat && c.category !== cat) return false;
      if (st === 'open' && c.progress.erpStatus === 'closed') return false;
      if (st === 'closed' && c.progress.erpStatus !== 'closed') return false;
      if (mgr && c.managerMain !== mgr && (c.managerSubs || []).indexOf(mgr) < 0) return false;
      if (q) {
        var hay = [c.companyName, c.title, c.erpCaseNo, nameOf(c.managerMain)].join(' ').toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });

    var rows = filtered.map(function (c) {
      var p = c.progress;
      var vLbl = c.verdictSummary && C.VERDICTS[c.verdictSummary] ? ' · ' + C.VERDICTS[c.verdictSummary].label : '';
      return {
        id: c.id,
        cells: [
          { cls: 'ti', html: esc(c.companyName || '(사업장 미입력)') + ' — ' + esc(c.title || '조사 사건') },
          { k: 'badge', html: catChip(c.category) },
          { html: esc(mgrText(c)) },
          { html: stepDots(c.steps) + '<b>' + p.doneCount + '/' + p.totalCount + '</b> ' + esc(p.currentStepShort + vLbl) },
          { html: '<span class="chip c-blue">📧 ' + (c.mailLinks || []).length + '건</span>' },
          { html: erpLinkChip(c) },
          { k: 'act', html:
            '<button class="sm pri" data-act="openDetail" data-id="' + esc(c.id) + '">진행·공문</button> ' +
            '<button class="sm" data-act="openReport" data-id="' + esc(c.id) + '">🔒 보고서</button>'
          }
        ]
      };
    });
    $('casesBox').innerHTML = renderTable('cases', ['사업장 · 사건명', '구분', '담당 노무사', '8단계 진행현황', '수집 공문', '푸른이알피 연동', '열기'], rows, CUR_ID);
  }

  function drawInboxPane() {
    var q = C.str($('inQ') && $('inQ').value).toLowerCase();
    var list = BUNDLES.filter(function (b) {
      if (!q) return true;
      var hay = (b.companyName + ' ' + b.suggestedTitle + ' ' + b.mails.map(function (m) { return m.subject + ' ' + (m.attNames || []).join(' '); }).join(' ')).toLowerCase();
      return hay.indexOf(q) >= 0;
    });
    if (!list.length) {
      $('inboxBox').innerHTML = '<div class="empty">현재 메일함에서 새로 발견된 미등록 조사 메일 묶음이 없습니다. 과거 메일은 위 <b>🔍 키워드 지정 메일함 심층검색</b>으로 찾을 수 있습니다.</div>';
      return;
    }
    var rows = list.map(function (b) {
      var attSum = b.mails.reduce(function (s, m) { return s + (Number(m.attCount) || 0); }, 0);
      var coBadge = b.companyId ? '<span class="chip c-green">업체원장 일치</span> ' : '<span class="chip c-amber">신규·미연결</span> ';
      return {
        id: b.bundleKey,
        cells: [
          { cls: 'ti', html: coBadge + esc(b.suggestedTitle) },
          { k: 'badge', html: catChip(b.category) },
          { html: '메일 <b>' + b.mails.length + '</b>통 · 첨부 ' + attSum + '개' },
          { html: stepDots(b.steps) + esc(b.summary.doneCount + '/8단계 추정 (' + b.summary.currentStepShort + ')') },
          { html: esc((b.firstDate || '-') + ' ~ ' + (b.lastDate || '-')) },
          { k: 'act', html:
            '<button class="sm pri" data-act="regBundle" data-id="' + esc(b.bundleKey) + '">➕ 사건 등록 + 이알피 반영</button> ' +
            '<button class="sm" data-act="previewBundle" data-id="' + esc(b.bundleKey) + '">메일 목록</button> ' +
            '<button class="sm" data-act="hideBundle" data-id="' + esc(b.bundleKey) + '">제외</button>'
          }
        ]
      };
    });
    $('inboxBox').innerHTML = renderTable('bundles', ['추정 의뢰처 · 사건명', '구분', '수집 서류', '복원된 진행단계', '메일 기간', '작업'], rows, '');
  }

  function casePickerBar(c) {
    var opts = MERGED_CASES.map(function (x) {
      var no = x.erpCaseNo ? '[' + x.erpCaseNo + '] ' : '';
      return '<option value="' + esc(x.id) + '"' + (x.id === c.id ? ' selected' : '') + '>' + esc(no + (x.companyName || '미입력') + ' — ' + (x.title || '조사')) + '</option>';
    }).join('');
    var erpBtn = c.erpCaseId
      ? '<a class="chip c-green" href="pu-erp.html?open=case:' + encodeURIComponent(c.erpCaseId) + '#menu=biz/case" title="푸른이알피 사건 상세 창으로 바로 이동합니다">🏢 푸른이알피 사건 열기 (' + esc(c.erpCaseNo || '연결됨') + ') ›</a>'
      : '';
    var editable = canEditCase(c);
    var actBtns = editable
      ? ('<button class="sm" data-act="syncOne" data-id="' + esc(c.id) + '">🔄 메일 재수집 · 이알피 반영</button>' +
         '<button class="sm" data-act="editCase" data-id="' + esc(c.id) + '">✏️ 기본정보 수정</button>')
      : '<span class="chip" title="사건 수정·동기화는 배정된 주·부담당 노무사 및 대표만 수행할 수 있습니다">👁 열람 전용 (담당 노무사·대표 편집)</span>';
    return '<div class="bar">' +
      '<label class="hint" for="curCaseSel">사건 선택</label>' +
      '<select id="curCaseSel" data-casesel="1" style="min-width:220px;max-width:440px;font-weight:600">' + opts + '</select>' +
      catChip(c.category) + ' ' + erpLinkChip(c) + ' ' + erpBtn +
      '<span class="sp"></span>' +
      actBtns +
      '</div>';
  }

  function drawDetailPane() {
    var box = $('detailBox');
    var c = caseById(CUR_ID);
    if (!c) {
      box.innerHTML = '<div class="card"><div class="empty">선택된 조사 사건이 없습니다. <b>📂 조사 사건 현황</b> 또는 <b>📥 메일 자동수집</b> 탭에서 사건을 선택하거나 등록하세요.</div></div>';
      return;
    }
    var editable = canEditCase(c);
    var p = c.progress;
    var vLabel = (C.VERDICTS[c.verdictSummary] || C.VERDICTS['']).label;
    var stepRows = C.STEPS.map(function (def) {
      var st = (c.steps && c.steps[def.code]) || {};
      var badge = st.done
        ? '<span class="chip c-green">✓ 완료' + (st.manual ? ' (수기확정)' : ' (자동)') + '</span>'
        : '<span class="chip">대기</span>';
      var ctrl = editable
        ? ('<button class="sm ' + (st.done ? '' : 'ok') + '" data-act="toggleStep" data-id="' + esc(def.code) + '">' + (st.done ? '미완료로' : '✓ 완료') + '</button> ' +
           '<button class="sm" data-act="editStep" data-id="' + esc(def.code) + '">일자·메모</button>')
        : '<span class="hint">-</span>';
      return {
        id: def.code,
        cells: [
          { cls: 'ti', html: esc(def.name) },
          { k: 'badge', html: badge },
          { html: esc(st.date || '-') },
          { cls: 'wide', html: esc(st.note || def.desc) },
          { k: 'act', html: ctrl }
        ]
      };
    });

    var mails = Array.isArray(c.mailLinks) ? c.mailLinks : [];
    var mailRows = mails.map(function (ml) {
      var rInfo = C.DOC_ROLES[ml.docRole] || C.DOC_ROLES.general;
      var sDef = C.STEPS.find(function (s) { return s.code === ml.stepCode; });
      var dirChip = ml.dir === 'out' ? '<span class="chip c-blue">발신</span>' : ml.dir === 'note' ? '<span class="chip">수기</span>' : '<span class="chip c-green">수신</span>';
      var privChip = ml.isPrivacySensitive ? ' <span class="chip c-red" title="임금·개인정보 민감 서류 가능성">⚠민감주의</span>' : '';
      var attBadge = (Number(ml.attCount) || (ml.attNames || []).length)
        ? ' <span class="chip c-amber">📎 ' + esc((ml.attNames && ml.attNames.length) ? ml.attNames.join(', ') : (ml.attCount + '개')) + '</span>'
        : '';
      var openBtn = (ml.slug && ml.uid)
        ? '<button class="sm pri" data-act="viewMail" data-id="' + esc(ml.key) + '">👁 본문·첨부</button> '
        : '';
      var editBtn = editable ? '<button class="sm" data-act="editMailRole" data-id="' + esc(ml.key) + '">분류변경</button>' : '';
      return {
        id: ml.key,
        cells: [
          { html: dirChip + ' ' + esc(ml.date || '-') },
          { k: 'badge', html: '<span class="chip c-blue">' + esc(rInfo.label) + '</span>' + privChip },
          { html: esc(sDef ? sDef.short : '-') },
          { cls: 'ti wide', html: esc(ml.subject || '(제목 없음)') + attBadge },
          { k: 'act', html: (openBtn + editBtn) || '<span class="hint">-</span>' }
        ]
      };
    });

    var ambig = Array.isArray(c._ambiguousMails) ? c._ambiguousMails : [];
    var ambigHtml = '';
    if (ambig.length > 0) {
      ambigHtml = '<div class="note" style="margin:8px 12px">' +
        '<b>⚠ 동일 사업장 동시 진행 사건이 있어 자동 귀속을 보류한 메일 ' + ambig.length + '건</b> — 아래 메일이 이 사건 서류가 맞으면 직접 연결하세요:' +
        '<div style="margin-top:6px">' +
        ambig.slice(0, 8).map(function (am) {
          var btn = editable ? (' <button class="sm pri" data-act="linkAmbigMail" data-id="' + esc(am.key) + '">+ 이 사건에 연결</button>') : '';
          return '<div style="padding:3px 0">· [' + esc(am.date || '-') + '] ' + esc(am.subject) + btn + '</div>';
        }).join('') +
        (ambig.length > 8 ? '<div class="hint">외 ' + (ambig.length - 8) + '건은 [+ 메일함에서 찾아 연결]에서 확인하실 수 있습니다.</div>' : '') +
        '</div></div>';
    }
    var truncHtml = (c._truncatedMails > 0)
      ? '<div class="note" style="margin:8px 12px">자동 수집 상한(' + (C.MAX_CASE_MAILS || 300) + '건)을 초과한 이전 메일 ' + c._truncatedMails + '건이 생략되었습니다. 필요한 과거 공문은 [+ 메일함에서 찾아 연결]로 추가하면 상한과 무관하게 보존됩니다.</div>'
      : '';

    var docBtns = editable
      ? ('<button class="sm" data-act="openMailFinder">+ 메일함에서 찾아 연결</button>' +
         '<button class="sm" data-act="addOfflineDoc">✍️ 오프라인 서류 기록</button>')
      : '';

    box.innerHTML =
      '<div class="card">' +
      casePickerBar(c) +
      '<div class="prof">' +
      '<span><b>의뢰 사업장</b>' + esc(c.companyName || '-') + (c.bizNo ? ' (' + esc(c.bizNo) + ')' : '') + '</span>' +
      '<span><b>담당 노무사</b>' + esc(mgrText(c)) + '</span>' +
      '<span><b>수임·착수일</b>' + esc(c.receiveDate || '-') + '</span>' +
      '<span><b>보고 기한</b>' + esc(c.dueDate || '-') + '</span>' +
      '<span><b>종결일</b>' + esc(c.closeDate || '-') + '</span>' +
      '<span><b>현재 진행률</b>' + p.doneCount + '/' + p.totalCount + '단계 (' + p.progressPct + '%)</span>' +
      '<span><b>종합 판단</b>' + esc(vLabel) + '</span>' +
      '</div>' +
      '</div>' +
      '<div class="card">' +
      '<div class="sec">① 8단계 표준 조사 진행 과정 <span class="hint">체크·수정한 모든 단계는 푸른이알피 사건 상태·요약·업무메모에 자동 기록됩니다</span></div>' +
      renderTable('steps', ['조사 단계', '상태', '진행일', '진행 근거 · 메모', '관리'], stepRows, '') +
      '</div>' +
      '<div class="card">' +
      '<div class="sec">② 사건별 수집 공문·서류 메일함 (' + mails.length + '건) <span class="sp"></span>' + docBtns + '</div>' +
      ambigHtml + truncHtml +
      renderTable('mails', ['수발신 · 일자', '문서 분류', '연결 단계', '제목 · 첨부파일', '열람 · 관리'], mailRows, '') +
      '</div>';
  }

  function drawReportPane() {
    var box = $('reportBox');
    var c = caseById(CUR_ID);
    if (!c) {
      box.innerHTML = '<div class="card"><div class="empty">선택된 조사 사건이 없습니다. 먼저 사건을 선택하세요.</div></div>';
      return;
    }
    if (!C.canAccessSecret(c, ME)) {
      box.innerHTML =
        '<div class="card">' + casePickerBar(c) + '</div>' +
        '<div class="secret-lock">' +
        '<b>🔒 비밀유지 보호 구역 (근로기준법 제76조의3 제7항 · 남녀고용평등법 제14조)</b><br>' +
        '당사자·참고인 면담 진술, 쟁점별 사실인정 및 조사결과보고서 본문은 <b>이 사건의 주·부담당 노무사(' + esc(mgrText(c)) + ')와 대표</b>만 열람·작성할 수 있습니다.<br>' +
        '담당자 배정이 필요한 경우 주담당 노무사 또는 대표에게 배정을 요청해 주세요.' +
        '</div>';
      return;
    }

    if (D.secretDenied[c.id]) {
      box.innerHTML =
        '<div class="card">' + casePickerBar(c) + '</div>' +
        '<div class="secret-lock">' +
        '<b>⚠ 비밀유지 조사자료를 불러오지 못했습니다</b><br>' +
        esc(D.secretDenied[c.id]) + '<br><br>' +
        '<button class="sm pri" data-act="retrySecret" data-id="' + esc(c.id) + '">🔄 다시 불러오기</button>' +
        '</div>';
      return;
    }

    var sec = D.secretCache[c.id];
    if (!sec) {
      box.innerHTML = '<div class="card">' + casePickerBar(c) + '<div class="empty">비밀유지 조사자료를 불러오는 중입니다…</div></div>';
      if (!SECRET_LOADING[c.id]) {
        ensureSecretLoaded(c.id).then(function () { drawReportPane(); drawBulks(); });
      }
      return;
    }

    var interviews = (Array.isArray(sec.interviews) ? sec.interviews : []).filter(function (x) { return x && !x._deleted; });
    var issues = (Array.isArray(sec.issues) ? sec.issues : []).filter(function (x) { return x && !x._deleted; });

    var ivRows = interviews.map(function (iv) {
      var roleChip = iv.role === 'accused'
        ? '<span class="chip c-red">피신고인(행위자)</span>'
        : iv.role === 'witness' ? '<span class="chip c-amber">참고인</span>' : '<span class="chip c-blue">신고인(피해자)</span>';
      return {
        id: iv.id,
        cells: [
          { k: 'badge', html: roleChip },
          { cls: 'ti', html: esc(iv.alias || '익명') + (iv.dept ? ' · ' + esc(iv.dept) : '') },
          { html: esc((iv.date || '-') + ' · ' + (iv.method || '대면')) },
          { html: iv.pledgeSigned ? '<span class="chip c-green">서약징구 완료</span>' : '<span class="chip">미징구</span>' },
          { cls: 'wide', html: esc(iv.summary || '-') },
          { k: 'act', html: '<button class="sm" data-act="editIv" data-id="' + esc(iv.id) + '">수정</button>' }
        ]
      };
    });

    var factLbl = { recognized: '사실 인정', partial: '일부 인정', unrecognized: '불인정' };
    var ynLbl = { yes: '충족', no: '미충족', hold: '검토중' };
    var issRows = issues.map(function (iss) {
      var resCode = C.str(iss.verdict) || C.judgeIssue(iss);
      var resBadge = resCode === 'yes'
        ? '<span class="chip c-red">해당(인정)</span>'
        : resCode === 'no' ? '<span class="chip c-green">비해당</span>' : '<span class="chip c-amber">검토중</span>';
      return {
        id: iss.id,
        cells: [
          { cls: 'ti', html: esc(iss.title || '쟁점 행위') + (iss.whenWhere ? ' (' + esc(iss.whenWhere) + ')' : '') },
          { html: esc(factLbl[iss.factStatus] || '검토중') },
          { html: '우위:' + esc(ynLbl[iss.elemSuperiority] || '?') + ' · 범위초과:' + esc(ynLbl[iss.elemBeyondScope] || '?') + ' · 악화:' + esc(ynLbl[iss.elemHarm] || '?') },
          { k: 'badge', html: resBadge },
          { k: 'act', html: '<button class="sm" data-act="editIssue" data-id="' + esc(iss.id) + '">수정</button>' }
        ]
      };
    });

    var verdictOpts = Object.keys(C.VERDICTS).map(function (k) {
      return '<option value="' + esc(k) + '"' + (C.str(c.verdictSummary) === k ? ' selected' : '') + '>' + esc(C.VERDICTS[k].label) + '</option>';
    }).join('');

    DIRTY_RPT = {};
    box.innerHTML =
      '<div class="card">' + casePickerBar(c) + '</div>' +
      '<div class="card">' +
      '<div class="sec">① 신고 요지 및 종합 판단 요약 <span class="hint">주민등록번호 형식은 저장 시 자동으로 마스킹됩니다</span><span class="sp"></span>' +
      '<button class="sm pri" data-act="saveReportAll">💾 진술·검토·보고서 전체 저장</button></div>' +
      '<div class="rpt-grid">' +
      '<div class="full"><label class="rpt-lbl" for="rOverview">신고 및 조사 착수 요지</label><textarea id="rOverview" data-rptfld="overview" rows="2" placeholder="신고 접수 경위, 당사자 관계, 핵심 조사 범위를 요약하세요">' + esc(sec.overview || '') + '</textarea></div>' +
      '<div><label class="rpt-lbl" for="rVerdict">종합 판단 결과 (이알피 요약 동기화)</label><select id="rVerdict" style="width:100%">' + verdictOpts + '</select></div>' +
      '<div><label class="rpt-lbl" for="rRec">사업장 맞춤 후속조치 권고</label><input id="rRec" data-rptfld="recommendations" type="text" style="width:100%" placeholder="예: 부서 분리배치 유지, 조직문화 특별교육 실시 권고" value="' + esc(sec.recommendations || '') + '"></div>' +
      '<div class="full"><label class="rpt-lbl" for="rConclusion">종합 결론 요지</label><textarea id="rConclusion" data-rptfld="conclusion" rows="2" placeholder="쟁점별 사실인정 및 법리 검토에 따른 최종 판단 의견">' + esc(sec.conclusion || '') + '</textarea></div>' +
      '</div></div>' +

      '<div class="card">' +
      '<div class="sec">② 당사자 · 참고인 면담 진술 기록부 (' + interviews.length + '건) <span class="sp"></span><button class="sm pri" data-act="addIv">+ 면담 진술 추가</button></div>' +
      renderTable('interviews', ['구분', '대상자(호칭·부서)', '면담일 · 방식', '비밀유지서약', '진술 핵심 요지', '편집'], ivRows, '') +
      '</div>' +

      '<div class="card">' +
      '<div class="sec">③ 쟁점 행위별 사실인정 및 법정 3요건 검토표 (' + issues.length + '건) <span class="sp"></span><button class="sm pri" data-act="addIssue">+ 쟁점 행위 추가</button></div>' +
      renderTable('issues', ['쟁점 행위 · 일시', '사실인정', '3요건(①우위 · ②적정범위초과 · ③고통·악화)', '판단 결과', '편집'], issRows, '') +
      '</div>' +

      '<div class="card">' +
      '<div class="sec">④ 조사결과보고서 초안 자동 조립 · 출력 <span class="sp"></span>' +
      '<button class="sm ok" data-act="assembleRpt">✨ 조사내용으로 표준 보고서 자동 조립</button>' +
      '<button class="sm pri" data-act="saveReportAll">💾 보고서 저장</button>' +
      '<button class="sm" data-act="printRpt">🖨️ 인쇄 / PDF</button>' +
      '<button class="sm" data-act="downloadDoc">📄 한글·워드(.doc) 받기</button>' +
      '<button class="sm" data-act="copyRpt">📋 전문 복사</button></div>' +
      '<div class="rpt-paper"><textarea id="rBody" data-rptfld="reportBody" aria-label="조사결과보고서 본문" placeholder="위 [✨ 조사내용으로 표준 보고서 자동 조립] 단추를 누르면 사건 개요·8단계 진행경위·면담진술·수집공문 목록·쟁점별 3요건 검토·법정 조치권고안이 표준 양식으로 조립됩니다.">' + esc(sec.reportBody || '') + '</textarea></div>' +
      '</div>';
  }

  /* ═══ 모달 창 도구 (초점 가두기 · Escape 닫기 · 초점 복귀) ═══ */
  function modalFocusables(box) {
    if (!box) return [];
    return Array.prototype.slice.call(
      box.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]')
    );
  }
  function openModal(html, wide) {
    MODAL_SEQ++;
    LAST_FOCUS = document.activeElement;
    var box = $('mbox');
    box.className = wide ? 'mbox wide' : 'mbox';
    box.innerHTML = html;
    var hd = box.querySelector('.mhd');
    if (hd && !hd.id) hd.id = 'mhdTitle';
    $('modal').style.display = 'flex';
    var bodyFirst = box.querySelector('.mbd input:not([disabled]), .mbd select:not([disabled]), .mbd textarea:not([disabled])');
    var first = bodyFirst || modalFocusables(box)[0] || box;
    try { first.focus(); } catch (e) {}
  }
  function closeModal() {
    MODAL_SEQ++;
    var m = $('modal');
    if (!m || m.style.display === 'none') return;
    m.style.display = 'none';
    if ($('mbox')) {
      $('mbox').innerHTML = '';
      $('mbox').className = 'mbox';
    }
    var prev = LAST_FOCUS;
    LAST_FOCUS = null;
    if (prev && typeof prev.focus === 'function' && document.contains(prev)) {
      try { prev.focus(); } catch (e) {}
    }
  }

  function staffSelectOpts(selectedSid, emptyLabel) {
    var html = '<option value="">' + esc(emptyLabel || '담당 노무사 선택') + '</option>';
    STAFF.forEach(function (s) {
      html += '<option value="' + esc(s.sid) + '"' + (s.sid === selectedSid ? ' selected' : '') + '>' + esc(s.name) + '</option>';
    });
    return html;
  }

  function diffCaseModalFields(initialFields, nextFields) {
    if (!initialFields) return Object.assign({}, nextFields || {});
    var out = {};
    Object.keys(nextFields || {}).forEach(function (k) {
      var a = initialFields[k];
      var b = nextFields[k];
      var same = (Array.isArray(a) || Array.isArray(b))
        ? JSON.stringify(a || []) === JSON.stringify(b || [])
        : a === b;
      if (!same) out[k] = b;
    });
    return out;
  }

  function openCaseModal(existing, presetBundle) {
    if (existing && !canEditCase(existing)) {
      toast('배정된 담당 노무사 또는 대표만 사건 정보를 수정할 수 있습니다.');
      return;
    }
    var c = existing || {};
    var b = presetBundle || null;
    var mgrEditable = canChangeManagers(existing);
    var coOpts = '<option value="">(업체원장 미연결 — 아래 사업장명 직접 사용)</option>' +
      D.companies.slice().sort(function (x, y) { return C.str(x.name).localeCompare(C.str(y.name), 'ko'); }).map(function (co) {
        var cid = C.str(co.id);
        var sel = (cid && cid === (c.companyId || (b && b.companyId))) ? ' selected' : '';
        return '<option value="' + esc(cid) + '"' + sel + '>' + esc(co.name) + (co.bizNo ? ' (' + esc(co.bizNo) + ')' : '') + '</option>';
      }).join('');
    var catVal = c.category || (b && b.category) || 'harass';
    var mainMgr = c.managerMain || (b && b.managerMain) || ME.sid;
    var curSubs = Array.isArray(c.managerSubs) ? c.managerSubs.slice() : [];
    if (!existing && !ME.isAdmin && mainMgr !== ME.sid && curSubs.indexOf(ME.sid) < 0) {
      curSubs.unshift(ME.sid);
    }
    var sub0 = curSubs[0] || '';
    var sub1 = curSubs[1] || '';
    var extraSubs = curSubs.slice(2);
    var disAttr = mgrEditable ? '' : ' disabled';
    var mgrHint = !mgrEditable
      ? '<span class="hint">담당자 변경은 주담당 노무사 또는 대표만 가능합니다</span>'
      : (!existing && !ME.isAdmin ? '<span class="hint">신규 등록 시 등록자 본인이 주·부담당에 포함되어야 합니다</span>' : '');

    openModal(
      '<div class="mhd" id="mhdTitle">' + (existing ? '✏️ 조사 사건 기본정보 수정' : '➕ 새 괴롭힘·성희롱 조사 사건 등록') + '<span class="sp"></span><button class="sm" data-mclose="1">닫기</button></div>' +
      '<div class="mbd">' +
      '<div class="fr"><label for="mCoId">업체관리 연결</label><div class="fv"><select id="mCoId">' + coOpts + '</select></div></div>' +
      '<div class="fr"><label for="mCoName">의뢰 사업장명</label><div class="fv"><input id="mCoName" type="text" value="' + esc(c.companyName || (b && b.companyName) || '') + '" placeholder="예: (주)가나테크"></div></div>' +
      '<div class="fr"><label for="mTitle">사건명</label><div class="fv"><input id="mTitle" type="text" value="' + esc(c.title || (b && b.suggestedTitle) || '') + '" placeholder="예: 직장 내 괴롭힘 외부전문가 조사"></div></div>' +
      '<div class="fr"><label for="mCat">조사 구분</label><div class="fv"><select id="mCat">' +
      '<option value="harass"' + (catVal === 'harass' ? ' selected' : '') + '>직장 내 괴롭힘</option>' +
      '<option value="sexual"' + (catVal === 'sexual' ? ' selected' : '') + '>직장 내 성희롱</option>' +
      '<option value="both"' + (catVal === 'both' ? ' selected' : '') + '>괴롭힘·성희롱 복합</option>' +
      '</select></div></div>' +
      '<div class="fr"><label for="mEmail">담당자 이메일</label><div class="fv"><input id="mEmail" type="email" value="' + esc(c.email || (b && b.mails && b.mails[0] && b.mails[0].extAddrs && b.mails[0].extAddrs[0]) || '') + '" placeholder="공문 자동수집 기준 이메일 (여러 개는 쉼표 구분)"></div></div>' +
      '<div class="fr"><label for="mMgr">주담당 노무사</label><div class="fv"><select id="mMgr"' + disAttr + '>' + staffSelectOpts(mainMgr, '주담당 선택') + '</select>' + mgrHint + '</div></div>' +
      '<div class="fr"><label for="mSub1">부담당 노무사</label><div class="fv">' +
      '<select id="mSub1" aria-label="부담당 노무사 1"' + disAttr + '>' + staffSelectOpts(sub0, '부담당 1 없음') + '</select>' +
      '<select id="mSub2" aria-label="부담당 노무사 2"' + disAttr + '>' + staffSelectOpts(sub1, '부담당 2 없음') + '</select>' +
      (extraSubs.length ? '<span class="hint">외 공동담당 ' + esc(extraSubs.map(nameOf).join('·')) + ' 유지</span>' : '') +
      '</div></div>' +
      '<div class="fr"><label for="mRecv">수임·착수일</label><div class="fv"><input id="mRecv" type="date" value="' + esc(c.receiveDate || (b && b.firstDate) || C.ymdOf(Date.now())) + '">' +
      '<label class="hint" for="mDue">보고기한</label><input id="mDue" type="date" value="' + esc(c.dueDate || '') + '">' +
      '<label class="hint" for="mClose">종결일</label><input id="mClose" type="date" value="' + esc(c.closeDate || '') + '"></div></div>' +
      '</div>' +
      '<div class="mft"><button data-mclose="1">취소</button><button class="pri" id="mSaveCaseBtn">💾 저장 + 푸른이알피 자동동기화</button></div>'
    );

    function readModalFields() {
      var coId = C.str($('mCoId').value);
      var coObj = coId && CO_DIR && CO_DIR.byId[coId] ? CO_DIR.byId[coId].rec : null;
      var coName = C.str($('mCoName').value) || (coObj ? C.str(coObj.name) : '');
      var catCode = C.str($('mCat').value) || 'harass';
      var pickedMain = mgrEditable ? (C.str($('mMgr').value) || ME.sid) : C.str(c.managerMain);
      var nextSubs = mgrEditable
        ? normalizeSubs([C.str($('mSub1').value), C.str($('mSub2').value)].concat(extraSubs), pickedMain)
        : (Array.isArray(c.managerSubs) ? c.managerSubs.slice(0, 5) : []);
      if (!existing && !ME.isAdmin && pickedMain !== ME.sid && nextSubs.indexOf(ME.sid) < 0) {
        nextSubs = normalizeSubs([ME.sid].concat(nextSubs), pickedMain);
      }
      return {
        companyId: coId,
        companyName: coName,
        bizNo: coObj ? C.str(coObj.bizNo) : C.str(c.bizNo || (b && b.bizNo)),
        email: C.str($('mEmail').value),
        category: catCode,
        title: C.str($('mTitle').value) || (coName ? (coName + ' ' + (C.CATEGORIES[catCode] || C.CATEGORIES.harass).label + ' 조사') : ''),
        managerMain: pickedMain,
        managerSubs: nextSubs,
        receiveDate: C.str($('mRecv').value),
        dueDate: C.str($('mDue').value),
        closeDate: C.str($('mClose').value)
      };
    }

    var initialFields = existing ? readModalFields() : null;

    $('mCoId').addEventListener('change', function () {
      var picked = CO_DIR && CO_DIR.byId[this.value];
      if (picked) {
        $('mCoName').value = picked.name;
        if (!$('mEmail').value && picked.addrs.length) $('mEmail').value = picked.addrs.join(', ');
      }
    });

    $('mSaveCaseBtn').addEventListener('click', async function () {
      var reqEpoch = SESSION_EPOCH;
      var reqUid = ME && ME.uid ? String(ME.uid) : '';
      var reqModalSeq = MODAL_SEQ;
      if (!isSessionCurrent(reqEpoch, reqUid)) return;
      var allModalFields = readModalFields();
      if (!allModalFields.companyName) { toast('의뢰 사업장명을 입력해 주세요'); return; }
      var id = existing ? existing.id : ('hi_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6));

      var baseRec = Object.assign({}, existing || {}, allModalFields, {
        id: id,
        mailLinks: existing ? (existing.mailLinks || []) : (b ? b.mails.slice() : [])
      });

      var changedFields = (existing && !existing._virtualFromErp)
        ? diffCaseModalFields(initialFields, allModalFields)
        : allModalFields;
      var needMailRescan = !existing || !!existing._virtualFromErp ||
        changedFields.companyId !== undefined || changedFields.companyName !== undefined ||
        changedFields.bizNo !== undefined || changedFields.email !== undefined ||
        changedFields.receiveDate !== undefined || changedFields.closeDate !== undefined;

      var collected = [];
      if (needMailRescan) {
        collected = C.collectMailsForCase(baseRec, MAIL_ROWS, CO_DIR, MERGED_CASES);
        var seen = {};
        var mergedMails = [];
        (baseRec.mailLinks || []).concat(collected).forEach(function (m) {
          if (m && m.key && !seen[m.key]) { seen[m.key] = 1; mergedMails.push(m); }
        });
        baseRec.mailLinks = mergedMails;
        baseRec.steps = C.deriveStepsFromMails(baseRec.steps, mergedMails, baseRec.receiveDate, baseRec.closeDate);
      }

      try {
        $('mSaveCaseBtn').disabled = true;
        var mut = (existing && !existing._virtualFromErp)
          ? (needMailRescan
            ? { fields: changedFields, addedMails: collected, rederiveSteps: true }
            : { fields: changedFields })
          : null;
        var saved = await saveCaseAndSync(baseRec, false, mut, reqEpoch, reqUid);
        if (!saved || !isSessionCurrent(reqEpoch, reqUid)) return;
        CUR_ID = id;
        TAB = 'detail';
        if (MODAL_SEQ === reqModalSeq) closeModal();
        draw();
        toast('✅ 사건 저장 및 푸른이알피 동기화 요청 완료');
      } catch (e) {
        if (!isSessionCurrent(reqEpoch, reqUid)) return;
        if ($('mSaveCaseBtn')) $('mSaveCaseBtn').disabled = false;
        toast('저장 실패: ' + ((e && e.message) || e));
      }
    });
  }

  /* ═══ 자동수집 · 일괄 동기화 · 미등록 후보 등록 ═══ */
  async function syncCaseMails(c) {
    var mails = C.collectMailsForCase(c, MAIL_ROWS, CO_DIR, MERGED_CASES);
    var steps = C.deriveStepsFromMails(c.steps, mails, c.receiveDate, c.closeDate);
    var next = Object.assign({}, c, { mailLinks: mails, steps: steps });
    return saveCaseAndSync(next, false, c._virtualFromErp ? null : { syncedAutoMails: mails, rederiveSteps: true });
  }

  async function syncAllCases(targetIds) {
    var baseList = targetIds
      ? MERGED_CASES.filter(function (c) { return targetIds.indexOf(c.id) >= 0; })
      : MERGED_CASES.slice();
    var targets = baseList.filter(canEditCase);
    var skippedPerm = baseList.length - targets.length;
    if (!targets.length) {
      if (skippedPerm > 0) {
        toast('배정된 담당 사건만 동기화할 수 있습니다 (타 담당 사건 ' + skippedPerm + '건 제외).');
        return;
      }
      toast('동기화할 사건이 없습니다. 미등록 후보 탭에서 메일 묶음을 먼저 확인하세요.');
      if (BUNDLES.length) { TAB = 'inbox'; draw(); }
      return;
    }
    var btn = $('syncAllBtn');
    if (btn) btn.disabled = true;
    var ok = 0, fail = 0;
    try {
      for (var i = 0; i < targets.length; i++) {
        try { await syncCaseMails(targets[i]); ok++; } catch (e) { fail++; }
      }
    } finally {
      if (btn) btn.disabled = false;
    }
    draw();
    var tail = skippedPerm > 0 ? (' (타 담당 ' + skippedPerm + '건 제외)') : '';
    toast(fail ? ('동기화 ' + ok + '건 완료 · ' + fail + '건 실패' + tail) : ('✅ ' + ok + '개 사건 메일 자동수집 및 푸른이알피 진행과정 동기화 완료' + tail));
  }

  async function registerBundleNow(bundle) {
    var id = 'hi_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
    var firstAddr = (bundle.mails[0] && bundle.mails[0].extAddrs && bundle.mails[0].extAddrs[0]) || '';
    var mainSid = C.str(bundle.managerMain) || ME.sid;
    var subs = (!ME.isAdmin && mainSid !== ME.sid) ? [ME.sid] : [];
    var rec = {
      id: id,
      companyId: C.str(bundle.companyId),
      companyName: C.str(bundle.companyName),
      bizNo: C.str(bundle.bizNo),
      email: firstAddr,
      category: bundle.category || 'harass',
      title: bundle.suggestedTitle,
      managerMain: mainSid,
      managerSubs: subs,
      receiveDate: C.str(bundle.firstDate) || C.ymdOf(Date.now()),
      dueDate: '',
      closeDate: (bundle.steps && bundle.steps.report && bundle.steps.report.done) ? C.str(bundle.steps.report.date) : '',
      mailLinks: bundle.mails.slice(),
      steps: bundle.steps
    };
    await saveCaseAndSync(rec, false);
    return id;
  }

  async function hideBundle(bundleKey) {
    var ref = fbDb.ref('harass_invest').child('dismissed').child(bundleKey);
    var res = await gate.save(ref, { id: bundleKey, reason: '후보 제외' }, { entityType: 'Task', allowPendingCompany: true });
    if (res && res.snapshot) D.dismissed[bundleKey] = res.snapshot.val();
    rebuildDerived();
    draw();
  }

  function previewBundleModal(b) {
    var listHtml = b.mails.map(function (m, idx) {
      var r = C.DOC_ROLES[m.docRole] || C.DOC_ROLES.general;
      var atts = (m.attNames && m.attNames.length) ? ' · 📎 ' + esc(m.attNames.join(', ')) : '';
      return '<div style="padding:7px 4px;border-bottom:1px solid var(--line);font-size:12.5px">' +
        '<b>' + (idx + 1) + '.</b> [' + esc(m.date || '-') + '] <span class="chip c-blue">' + esc(r.label) + '</span> ' +
        esc(m.subject) + '<span class="hint">' + atts + '</span></div>';
    }).join('');
    openModal(
      '<div class="mhd" id="mhdTitle">📥 수집된 조사 메일 묶음 미리보기 — ' + esc(b.companyName) + '<span class="sp"></span><button class="sm" data-mclose="1">닫기</button></div>' +
      '<div class="mbd"><p class="hint">총 ' + b.mails.length + '통 · 자동 복원 단계: ' + b.summary.doneCount + '/8단계 (' + esc(b.summary.currentStepName) + ')</p>' + listHtml + '</div>' +
      '<div class="mft"><button data-mclose="1">닫기</button><button class="pri" id="mRegBundleEditBtn">검토 후 사건 등록 · 이알피 반영</button></div>',
      true
    );
    $('mRegBundleEditBtn').addEventListener('click', function () {
      closeModal();
      openCaseModal(null, b);
    });
  }

  /* ═══ 다음메일 전체 폴더 심층검색(searchMailbox) 및 본문·첨부 메모리 열람 ═══ */
  async function callMailFn(fnName, body, optEpoch, optUid) {
    var reqEpoch = optEpoch || SESSION_EPOCH;
    var reqUid = optUid || (ME && ME.uid ? String(ME.uid) : '');
    if (!isSessionCurrent(reqEpoch, reqUid)) throw new Error('세션이 종료되었습니다.');
    var u = fb.auth().currentUser;
    if (!u || String(u.uid || '') !== reqUid) throw new Error('로그인이 필요합니다.');
    var tok = await u.getIdToken();
    if (!isSessionCurrent(reqEpoch, reqUid)) throw new Error('세션이 종료되었습니다.');
    var r = await fetch(MB_FN + fnName, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok },
      body: JSON.stringify(body)
    });
    var j = await r.json().catch(function () { return {}; });
    if (!isSessionCurrent(reqEpoch, reqUid)) throw new Error('세션이 종료되었습니다.');
    if (!j || !j.ok) throw new Error((j && j.error) || '메일 서버 요청에 실패했습니다.');
    return j;
  }

  async function runImapDeepScan(customQuery) {
    var scanEpoch = SESSION_EPOCH;
    var scanUid = ME && ME.uid ? String(ME.uid) : '';
    if (!isSessionCurrent(scanEpoch, scanUid)) return;
    var queries = customQuery ? [customQuery] : ['괴롭힘', '성희롱', '조사결과보고서'];
    var OLD_FETCH_LIMIT = 30;
    toast('🔍 다음메일 전체 폴더에서 조사 공문·서류를 검색하고 있습니다…');
    var newHits = 0, fetchedOld = 0, skippedOld = 0;
    for (var qi = 0; qi < queries.length; qi++) {
      try {
        var j = await callMailFn('searchMailbox', { q: queries[qi] }, scanEpoch, scanUid);
        if (!isSessionCurrent(scanEpoch, scanUid)) return;
        var hit = j.hit || {};
        var slugs = Object.keys(hit);
        for (var si = 0; si < slugs.length; si++) {
          var slug = slugs[si];
          var fInfo = D.mailFolders[slug] || {};
          var isSent = fInfo.kind === 'sent';
          var uids = Array.isArray(hit[slug]) ? hit[slug] : [];
          for (var ui = 0; ui < uids.length; ui++) {
            var uid = String(uids[ui]);
            var key = 'i:' + slug + ':' + uid;
            if (!D.imapHitKeys[key]) { D.imapHitKeys[key] = 1; newHits++; }
            var inMirror = D.mailMsgs[slug] && D.mailMsgs[slug][uid];
            if (!inMirror) {
              if (fetchedOld >= OLD_FETCH_LIMIT) {
                skippedOld++;
                continue;
              }
              fetchedOld++;
              try {
                var msg = await callMailFn('readMailMessage', { slug: slug, uid: uid, peek: 1 }, scanEpoch, scanUid);
                if (!isSessionCurrent(scanEpoch, scanUid)) return;
                var attNames = (msg.atts || []).map(function (a) { return C.str(a.name); }).filter(Boolean);
                var plain = (C.str(msg.text) || htmlToSafePlainText(msg.html)).replace(/\s+/g, ' ');
                D.extraMailRows.push({
                  key: key,
                  slug: slug,
                  uid: uid,
                  folderKind: C.str(fInfo.kind || 'inbox'),
                  dir: isSent ? 'out' : 'in',
                  ts: 0,
                  date: '',
                  fromName: '',
                  fromAddr: '',
                  toAddr: '',
                  toName: '',
                  extAddrs: C.parseAddrs(plain.slice(0, 400)),
                  subject: plain.slice(0, 70) || ('[' + queries[qi] + ' 검색 메일 #' + uid + ']'),
                  preview: plain.slice(0, 180),
                  attCount: attNames.length,
                  attNames: attNames,
                  imapHit: true
                });
              } catch (ignoreErr) {}
            }
          }
        }
      } catch (e) {
        if (isSessionCurrent(scanEpoch, scanUid)) toast('메일 심층검색 오류: ' + ((e && e.message) || e));
        return;
      }
    }
    if (!isSessionCurrent(scanEpoch, scanUid)) return;
    rebuildDerived();
    draw();
    if (skippedOld > 0) {
      toast('✅ 심층검색 완료: 미러 밖 과거 메일 상위 ' + fetchedOld + '건 본문 확인 (추가 ' + skippedOld + '건은 키워드를 좁혀 조회 가능)');
    } else {
      toast('✅ 심층검색 완료: 관련 메일 신호 ' + newHits + '건 확인 · 미등록 후보 ' + BUNDLES.length + '묶음');
    }
  }

  async function openMailViewerModal(ml) {
    var reqEpoch = SESSION_EPOCH;
    var reqUid = ME && ME.uid ? String(ME.uid) : '';
    if (!isSessionCurrent(reqEpoch, reqUid)) return;
    openModal(
      '<div class="mhd" id="mhdTitle">📧 메일 본문 · 첨부 열람 <span class="sp"></span><button class="sm" data-mclose="1">닫기</button></div>' +
      '<div class="mbd"><p><b>' + esc(ml.subject) + '</b></p><p class="hint">' + esc(ml.date || '') + ' · ' + esc(ml.from || '') + ' → ' + esc(ml.to || '') + '</p>' +
      '<div id="mMailAtts" class="att-list"></div><div id="mMailBody" class="mail-body">메일 본문을 안전하게 불러오고 있습니다(읽음 표시 변경 없음)…</div></div>' +
      '<div class="mft"><button data-mclose="1">닫기</button></div>',
      true
    );
    var reqModalSeq = MODAL_SEQ;
    try {
      var msg = await callMailFn('readMailMessage', { slug: ml.slug, uid: String(ml.uid), peek: 1 }, reqEpoch, reqUid);
      if (!isSessionCurrent(reqEpoch, reqUid) || MODAL_SEQ !== reqModalSeq) return;
      var bodyEl = $('mMailBody');
      var attEl = $('mMailAtts');
      if (!bodyEl) return;
      var text = C.str(msg.text) || htmlToSafePlainText(msg.html);
      bodyEl.textContent = text || '(본문 글자가 없습니다)';
      var atts = Array.isArray(msg.atts) ? msg.atts : [];
      if (atts.length && attEl) {
        attEl.innerHTML = atts.map(function (a, i) {
          return '<button class="sm" data-attdl="' + i + '" data-part="' + esc(a.part || '') + '" data-aname="' + esc(a.name || '첨부') + '">📎 ' + esc(a.name || ('첨부 ' + (i + 1))) + ' 받기</button>';
        }).join('');
        attEl.querySelectorAll('[data-attdl]').forEach(function (btn) {
          btn.addEventListener('click', async function () {
            var dlEpoch = SESSION_EPOCH;
            var dlUid = ME && ME.uid ? String(ME.uid) : '';
            var dlModalSeq = MODAL_SEQ;
            if (!isSessionCurrent(dlEpoch, dlUid) || dlEpoch !== reqEpoch || dlUid !== reqUid || dlModalSeq !== reqModalSeq) return;
            var idx = Number(this.getAttribute('data-attdl'));
            var part = this.getAttribute('data-part') || '';
            var nm = this.getAttribute('data-aname') || '첨부파일';
            toast('첨부파일을 메모리로 가져오는 중입니다…');
            try {
              var aj = await callMailFn('readMailAttachment', { slug: ml.slug, uid: String(ml.uid), index: idx, part: part }, dlEpoch, dlUid);
              if (!isSessionCurrent(dlEpoch, dlUid) || MODAL_SEQ !== dlModalSeq) return;
              var bin = atob(aj.b64 || '');
              var buf = new Uint8Array(bin.length);
              for (var k = 0; k < bin.length; k++) buf[k] = bin.charCodeAt(k);
              var url = URL.createObjectURL(new Blob([buf], { type: aj.mime || 'application/octet-stream' }));
              var aTag = document.createElement('a');
              aTag.href = url;
              aTag.download = aj.name || nm;
              document.body.appendChild(aTag);
              aTag.click();
              setTimeout(function () { URL.revokeObjectURL(url); aTag.remove(); }, 1500);
              toast('📥 ' + (aj.name || nm) + ' 내려받기 완료');
            } catch (err) {
              if (!isSessionCurrent(dlEpoch, dlUid) || MODAL_SEQ !== dlModalSeq) return;
              toast('첨부 받기 실패: ' + ((err && err.message) || err));
            }
          });
        });
      }
    } catch (e) {
      if (!isSessionCurrent(reqEpoch, reqUid) || MODAL_SEQ !== reqModalSeq) return;
      if ($('mMailBody')) $('mMailBody').textContent = '본문을 열지 못했습니다: ' + ((e && e.message) || e);
    }
  }

  /* ═══ 단계 수정 · 수동 메일 연결 · 면담 · 쟁점 모달 ═══ */
  function openStepEditModal(stepCode) {
    var c = caseById(CUR_ID);
    if (!c || !canEditCase(c)) return;
    var def = C.STEPS.find(function (s) { return s.code === stepCode; });
    if (!def) return;
    var st = (c.steps && c.steps[stepCode]) || {};
    openModal(
      '<div class="mhd" id="mhdTitle">📋 ' + esc(def.name) + ' 기록 수정<span class="sp"></span><button class="sm" data-mclose="1">닫기</button></div>' +
      '<div class="mbd">' +
      '<div class="fr"><label for="sDone">진행 상태</label><div class="fv"><select id="sDone"><option value="1"' + (st.done ? ' selected' : '') + '>✓ 완료</option><option value="0"' + (!st.done ? ' selected' : '') + '>대기</option></select></div></div>' +
      '<div class="fr"><label for="sDate">진행 일자</label><div class="fv"><input id="sDate" type="date" value="' + esc(st.date || C.ymdOf(Date.now())) + '"></div></div>' +
      '<div class="fr"><label for="sNote">진행 메모</label><div class="fv"><input id="sNote" type="text" value="' + esc(st.note || '') + '" placeholder="예: 조사계획서 송부 및 출석요구 공문 발송 완료"></div></div>' +
      '</div>' +
      '<div class="mft"><button data-mclose="1">취소</button><button class="pri" id="sSaveBtn">저장 + 이알피 반영</button></div>'
    );
    $('sSaveBtn').addEventListener('click', async function () {
      var btn = $('sSaveBtn');
      try {
        btn.disabled = true;
        var nextDone = $('sDone').value === '1';
        var stepObj = {
          done: nextDone,
          date: nextDone ? C.str($('sDate').value) : '',
          note: C.str($('sNote').value),
          srcMail: C.str(st.srcMail),
          manual: true
        };
        var mut = { stepPatches: {} };
        mut.stepPatches[stepCode] = stepObj;
        var closeDate = c.closeDate;
        if (stepCode === 'report') {
          closeDate = nextDone ? (c.closeDate || stepObj.date || C.ymdOf(Date.now())) : '';
          mut.closeDate = closeDate;
        }
        var nextSteps = Object.assign({}, c.steps || {}, mut.stepPatches);
        await saveCaseAndSync(Object.assign({}, c, { steps: nextSteps, closeDate: closeDate }), false, c._virtualFromErp ? null : mut);
        closeModal();
        draw();
        toast('✅ 단계 기록 및 푸른이알피 반영 완료');
      } catch (err) {
        if (btn) btn.disabled = false;
        toast('저장 실패: ' + ((err && err.message) || err));
      }
    });
  }

  function openMailRoleModal(mailKey) {
    var c = caseById(CUR_ID);
    if (!c || !canEditCase(c)) return;
    var ml = (c.mailLinks || []).find(function (x) { return x.key === mailKey; });
    if (!ml) return;
    var rOpts = Object.keys(C.DOC_ROLES).map(function (k) {
      var r = C.DOC_ROLES[k];
      return '<option value="' + esc(k) + '"' + (ml.docRole === k ? ' selected' : '') + '>' + esc(r.label) + '</option>';
    }).join('');
    var sOpts = '<option value="">(연결 단계 없음)</option>' + C.STEPS.map(function (s) {
      return '<option value="' + esc(s.code) + '"' + (ml.stepCode === s.code ? ' selected' : '') + '>' + esc(s.name) + '</option>';
    }).join('');
    openModal(
      '<div class="mhd" id="mhdTitle">🏷️ 수집 서류 분류 변경<span class="sp"></span><button class="sm" data-mclose="1">닫기</button></div>' +
      '<div class="mbd"><p><b>' + esc(ml.subject) + '</b></p>' +
      '<div class="fr"><label for="mrRole">문서 분류</label><div class="fv"><select id="mrRole">' + rOpts + '</select></div></div>' +
      '<div class="fr"><label for="mrStep">연결 단계</label><div class="fv"><select id="mrStep">' + sOpts + '</select></div></div></div>' +
      '<div class="mft"><button data-mclose="1">취소</button><button class="pri" id="mrSaveBtn">변경 저장</button></div>'
    );
    $('mrRole').addEventListener('change', function () {
      var r = C.DOC_ROLES[this.value];
      if (r && r.stepCode) $('mrStep').value = r.stepCode;
    });
    $('mrSaveBtn').addEventListener('click', async function () {
      var btn = $('mrSaveBtn');
      try {
        btn.disabled = true;
        var r = C.DOC_ROLES[$('mrRole').value] || C.DOC_ROLES.general;
        var updatedMail = Object.assign({}, ml, { docRole: r.code, docRoleLabel: r.label, stepCode: C.str($('mrStep').value), manual: true });
        var nextLinks = (c.mailLinks || []).map(function (x) {
          return x.key === mailKey ? updatedMail : x;
        });
        var nextSteps = C.deriveStepsFromMails(c.steps, nextLinks, c.receiveDate, c.closeDate);
        await saveCaseAndSync(Object.assign({}, c, { mailLinks: nextLinks, steps: nextSteps }), false, c._virtualFromErp ? null : { upsertMail: updatedMail });
        closeModal();
        draw();
        toast('서류 분류가 갱신되었습니다.');
      } catch (err) {
        if (btn) btn.disabled = false;
        toast('저장 실패: ' + ((err && err.message) || err));
      }
    });
  }

  async function linkSingleMailRowToCurrentCase(key) {
    var c = caseById(CUR_ID);
    if (!c || !canEditCase(c)) return;
    var row = MAIL_ROWS.find(function (x) { return x.key === key; });
    if (!row) return;
    var role = C.classifyDocRole(row.subject, row.attNames, row.preview, row.dir === 'out');
    var item = {
      key: row.key, slug: row.slug, uid: row.uid, dir: row.dir, date: row.date, ts: row.ts,
      from: row.fromAddr, to: row.toAddr, extAddrs: row.extAddrs || [], subject: row.subject,
      attCount: row.attCount, attNames: (row.attNames || []).slice(0, 5),
      docRole: role.code, docRoleLabel: role.label, stepCode: role.stepCode, manual: true
    };
    var nextLinks = [item].concat((c.mailLinks || []).filter(function (x) { return x.key !== key; }));
    var nextSteps = C.deriveStepsFromMails(c.steps, nextLinks, c.receiveDate, c.closeDate);
    await saveCaseAndSync(Object.assign({}, c, { mailLinks: nextLinks, steps: nextSteps }), false, c._virtualFromErp ? null : { upsertMail: item });
    draw();
    toast('✅ 메일이 사건 공문함에 연결되었습니다');
  }

  function openMailFinderModal() {
    var c = caseById(CUR_ID);
    if (!c || !canEditCase(c)) return;
    openModal(
      '<div class="mhd" id="mhdTitle">🔍 푸른 메일함에서 서류 찾아 연결 — ' + esc(c.companyName) + '<span class="sp"></span><button class="sm" data-mclose="1">닫기</button></div>' +
      '<div class="mbd">' +
      '<div class="bar" style="padding:0 0 8px"><input id="mfQ" type="search" aria-label="메일 검색어" placeholder="회사명·제목·이메일·첨부파일명 입력" value="' + esc(c.companyName || '') + '" style="flex:1"><button class="sm pri" id="mfBtn">찾기</button></div>' +
      '<div id="mfRes"></div></div>' +
      '<div class="mft"><button data-mclose="1">닫기</button></div>',
      true
    );
    function renderSearch() {
      var q = C.str($('mfQ').value).toLowerCase();
      var existing = {};
      (c.mailLinks || []).forEach(function (x) { existing[x.key] = 1; });
      var hits = MAIL_ROWS.filter(function (r) {
        if (existing[r.key]) return false;
        if (!q) return true;
        var hay = (r.subject + ' ' + r.fromName + ' ' + r.fromAddr + ' ' + r.toAddr + ' ' + (r.attNames || []).join(' ')).toLowerCase();
        return hay.indexOf(q) >= 0;
      }).slice(0, 40);
      if (!hits.length) { $('mfRes').innerHTML = '<div class="empty">일치하는 메일이 없습니다.</div>'; return; }
      $('mfRes').innerHTML = hits.map(function (r) {
        var atts = (r.attNames && r.attNames.length) ? ' · 📎 ' + esc(r.attNames.join(', ')) : '';
        return '<div style="display:flex;gap:8px;align-items:center;padding:6px 4px;border-bottom:1px solid var(--line);font-size:12.5px">' +
          '<div style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><b>[' + esc(r.date || '-') + ']</b> ' + esc(r.subject) + '<span class="hint">' + atts + '</span></div>' +
          '<button class="sm pri" data-linkmail="' + esc(r.key) + '">+ 연결</button></div>';
      }).join('');
      $('mfRes').querySelectorAll('[data-linkmail]').forEach(function (b) {
        b.addEventListener('click', async function () {
          var btn = this;
          try {
            btn.disabled = true;
            await linkSingleMailRowToCurrentCase(btn.getAttribute('data-linkmail'));
            closeModal();
          } catch (err) {
            btn.disabled = false;
            toast('연결 실패: ' + ((err && err.message) || err));
          }
        });
      });
    }
    $('mfBtn').addEventListener('click', renderSearch);
    $('mfQ').addEventListener('keydown', function (e) { if (e.key === 'Enter') renderSearch(); });
    renderSearch();
  }

  function openOfflineDocModal() {
    var c = caseById(CUR_ID);
    if (!c || !canEditCase(c)) return;
    var rOpts = Object.keys(C.DOC_ROLES).map(function (k) {
      return '<option value="' + esc(k) + '">' + esc(C.DOC_ROLES[k].label) + '</option>';
    }).join('');
    openModal(
      '<div class="mhd" id="mhdTitle">✍️ 오프라인·방문 수령 서류 기록<span class="sp"></span><button class="sm" data-mclose="1">닫기</button></div>' +
      '<div class="mbd">' +
      '<div class="fr"><label for="odDate">수령·발송일</label><div class="fv"><input id="odDate" type="date" value="' + esc(C.ymdOf(Date.now())) + '"></div></div>' +
      '<div class="fr"><label for="odRole">문서 분류</label><div class="fv"><select id="odRole">' + rOpts + '</select></div></div>' +
      '<div class="fr"><label for="odSubj">서류명 · 내용</label><div class="fv"><input id="odSubj" type="text" placeholder="예: 현장 면담 시 비밀유지서약서 원본 3부 징구"></div></div>' +
      '</div>' +
      '<div class="mft"><button data-mclose="1">취소</button><button class="pri" id="odSaveBtn">추가 + 이알피 반영</button></div>'
    );
    $('odSaveBtn').addEventListener('click', async function () {
      var subj = C.str($('odSubj').value);
      if (!subj) { toast('서류명·내용을 입력하세요'); return; }
      var btn = $('odSaveBtn');
      try {
        btn.disabled = true;
        var role = C.DOC_ROLES[$('odRole').value] || C.DOC_ROLES.general;
        var ymd = C.str($('odDate').value) || C.ymdOf(Date.now());
        var item = {
          key: 'm:' + Date.now().toString(36), slug: '', uid: '', dir: 'note', date: ymd, ts: Date.now(),
          from: '', to: '', extAddrs: [], subject: subj, attCount: 0, attNames: [],
          docRole: role.code, docRoleLabel: role.label, stepCode: role.stepCode, manual: true
        };
        var nextLinks = [item].concat(c.mailLinks || []);
        var nextSteps = C.deriveStepsFromMails(c.steps, nextLinks, c.receiveDate, c.closeDate);
        await saveCaseAndSync(Object.assign({}, c, { mailLinks: nextLinks, steps: nextSteps }), false, c._virtualFromErp ? null : { upsertMail: item });
        closeModal();
        draw();
        toast('✅ 서류 기록 및 푸른이알피 반영 완료');
      } catch (err) {
        if (btn) btn.disabled = false;
        toast('저장 실패: ' + ((err && err.message) || err));
      }
    });
  }

  function openInterviewModal(existingIv) {
    var iv = existingIv || {};
    openModal(
      '<div class="mhd" id="mhdTitle">🔒 당사자 · 참고인 면담 진술 기록<span class="sp"></span><button class="sm" data-mclose="1">닫기</button></div>' +
      '<div class="mbd">' +
      '<div class="fr"><label for="ivRole">대상자 구분</label><div class="fv"><select id="ivRole">' +
      '<option value="victim"' + (iv.role === 'victim' ? ' selected' : '') + '>신고인(피해근로자)</option>' +
      '<option value="accused"' + (iv.role === 'accused' ? ' selected' : '') + '>피신고인(행위자)</option>' +
      '<option value="witness"' + (iv.role === 'witness' ? ' selected' : '') + '>참고인</option>' +
      '</select></div></div>' +
      '<div class="fr"><label for="ivAlias">성명·호칭</label><div class="fv"><input id="ivAlias" type="text" value="' + esc(iv.alias || '') + '" placeholder="예: 신고인 A (또는 성명·직책)"><input id="ivDept" type="text" aria-label="소속 부서·직위" value="' + esc(iv.dept || '') + '" placeholder="소속 부서·직위"></div></div>' +
      '<div class="fr"><label for="ivDate">면담 일자</label><div class="fv"><input id="ivDate" type="date" value="' + esc(iv.date || C.ymdOf(Date.now())) + '">' +
      '<select id="ivMethod" aria-label="면담 방식"><option value="대면면담"' + (iv.method === '대면면담' ? ' selected' : '') + '>대면면담</option><option value="화상·유선"' + (iv.method === '화상·유선' ? ' selected' : '') + '>화상·유선</option><option value="서면진술"' + (iv.method === '서면진술' ? ' selected' : '') + '>서면진술</option></select>' +
      '<label style="display:inline-flex;gap:4px;align-items:center;font-size:12.5px"><input id="ivPledge" type="checkbox"' + (iv.pledgeSigned !== false ? ' checked' : '') + '> 비밀유지서약 징구</label></div></div>' +
      '<div style="padding:6px 14px"><label class="rpt-lbl" for="ivSum">진술 핵심 요지 (주민등록번호 자동 가림)</label><textarea id="ivSum" rows="5" placeholder="질문·답변 핵심 진술 요지 및 제출 증거 관련 진술을 기록하세요">' + esc(iv.summary || '') + '</textarea></div>' +
      '</div>' +
      '<div class="mft"><button data-mclose="1">취소</button><button class="pri" id="ivSaveBtn">저장</button></div>',
      true
    );
    $('ivSaveBtn').addEventListener('click', async function () {
      var reqEpoch = SESSION_EPOCH;
      var reqUid = ME && ME.uid ? String(ME.uid) : '';
      var reqModalSeq = MODAL_SEQ;
      var reqCid = CUR_ID;
      if (!isSessionCurrent(reqEpoch, reqUid) || !reqCid) return;
      var btn = $('ivSaveBtn');
      try {
        btn.disabled = true;
        var sec = await ensureSecretLoaded(reqCid, reqEpoch, reqUid);
        if (!isSessionCurrent(reqEpoch, reqUid)) return;
        if (!sec) throw new Error('비밀유지 자료를 열지 못했습니다.');
        var item = {
          id: iv.id || ('iv_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 5)),
          role: C.str($('ivRole').value) || 'victim',
          alias: C.maskRrnText(C.str($('ivAlias').value) || '익명'),
          dept: C.maskRrnText(C.str($('ivDept').value)),
          date: C.str($('ivDate').value),
          method: C.str($('ivMethod').value),
          pledgeSigned: !!$('ivPledge').checked,
          summary: C.maskRrnText(C.str($('ivSum').value))
        };
        var savedSec = await saveSecretRecord(reqCid, collectDirtyReportInputs({ upsertInterview: item }), reqEpoch, reqUid);
        if (!savedSec || !isSessionCurrent(reqEpoch, reqUid)) return;
        /* 면담 기록 시 해당 진행단계(신고인/행위자/참고인·비밀서약)도 자동 완료 보조 */
        var c = caseById(reqCid);
        if (c) {
          var autoSteps = {};
          var ns = Object.assign({}, c.steps || {});
          var sKey = item.role === 'accused' ? 'accused' : item.role === 'witness' ? 'witness' : 'victim';
          autoSteps[sKey] = { done: true, date: item.date || C.ymdOf(Date.now()), note: item.alias + ' 면담 실시', srcMail: '', manual: false };
          if (!ns[sKey] || (!ns[sKey].done && !ns[sKey].manual)) ns[sKey] = autoSteps[sKey];
          if (item.pledgeSigned) {
            autoSteps.pledge = { done: true, date: item.date || C.ymdOf(Date.now()), note: '면담 참여자 비밀유지서약 징구', srcMail: '', manual: false };
            if (!ns.pledge || (!ns.pledge.done && !ns.pledge.manual)) ns.pledge = autoSteps.pledge;
          }
          await saveCaseAndSync(Object.assign({}, c, { steps: ns }), false, c._virtualFromErp ? null : { autoStepPatches: autoSteps }, reqEpoch, reqUid);
          if (!isSessionCurrent(reqEpoch, reqUid)) return;
        }
        if (MODAL_SEQ === reqModalSeq) closeModal();
        draw();
        toast('✅ 면담 진술 저장 및 진행단계 동기화 완료');
      } catch (err) {
        if (!isSessionCurrent(reqEpoch, reqUid)) return;
        if (btn) btn.disabled = false;
        toast('저장 실패: ' + ((err && err.message) || err));
      }
    });
  }

  function openIssueModal(existingIss) {
    var iss = existingIss || {};
    function ynSel(id, val, lbl) {
      var v = val || 'hold';
      return '<select id="' + id + '" aria-label="' + esc(lbl) + '"><option value="yes"' + (v === 'yes' ? ' selected' : '') + '>충족 (예)</option><option value="no"' + (v === 'no' ? ' selected' : '') + '>미충족 (아니오)</option><option value="hold"' + (v === 'hold' ? ' selected' : '') + '>검토중</option></select>';
    }
    openModal(
      '<div class="mhd" id="mhdTitle">⚖️ 쟁점 행위 사실인정 및 3요건 검토<span class="sp"></span><button class="sm" data-mclose="1">닫기</button></div>' +
      '<div class="mbd">' +
      '<div class="fr"><label for="isTitle">쟁점 행위명</label><div class="fv"><input id="isTitle" type="text" value="' + esc(iss.title || '') + '" placeholder="예: 회의 중 반복적 폭언 및 모욕적 언동"></div></div>' +
      '<div class="fr"><label for="isWhen">일시 · 장소</label><div class="fv"><input id="isWhen" type="text" value="' + esc(iss.whenWhere || '') + '" placeholder="예: 2026-03~05월 주간회의실 및 사내 메신저"></div></div>' +
      '<div style="padding:4px 14px"><label class="rpt-lbl" for="isVic">신고인 주장 요지</label><textarea id="isVic" rows="2">' + esc(iss.claimVictim || '') + '</textarea></div>' +
      '<div style="padding:4px 14px"><label class="rpt-lbl" for="isAcc">피신고인 소명 요지</label><textarea id="isAcc" rows="2">' + esc(iss.claimAccused || '') + '</textarea></div>' +
      '<div style="padding:4px 14px"><label class="rpt-lbl" for="isEvid">객관적 증거 · 사실인정 근거</label><textarea id="isEvid" rows="2" placeholder="참고인 진술 일치 여부, 녹취록, 메신저 대화, 이메일 공문 등">' + esc(iss.evidenceNote || '') + '</textarea></div>' +
      '<div class="fr"><label for="isFact">사실인정 결과</label><div class="fv"><select id="isFact">' +
      '<option value="recognized"' + (iss.factStatus === 'recognized' ? ' selected' : '') + '>사실 인정</option>' +
      '<option value="partial"' + (iss.factStatus === 'partial' ? ' selected' : '') + '>일부 사실 인정</option>' +
      '<option value="unrecognized"' + (iss.factStatus === 'unrecognized' ? ' selected' : '') + '>불인정 (증거 부족·사실 없음)</option>' +
      '</select></div></div>' +
      '<div class="fr"><label>법정 3요건</label><div class="fv">' +
      '<span class="hint">①우위</span>' + ynSel('isE1', iss.elemSuperiority, '지위 또는 관계 우위') +
      '<span class="hint">②적정범위초과</span>' + ynSel('isE2', iss.elemBeyondScope, '업무상 적정범위 초과') +
      '<span class="hint">③고통·환경악화</span>' + ynSel('isE3', iss.elemHarm, '고통 또는 근무환경 악화') +
      '</div></div>' +
      '</div>' +
      '<div class="mft"><button data-mclose="1">취소</button><button class="pri" id="isSaveBtn">저장</button></div>',
      true
    );
    $('isSaveBtn').addEventListener('click', async function () {
      var reqEpoch = SESSION_EPOCH;
      var reqUid = ME && ME.uid ? String(ME.uid) : '';
      var reqModalSeq = MODAL_SEQ;
      var reqCid = CUR_ID;
      if (!isSessionCurrent(reqEpoch, reqUid) || !reqCid) return;
      var btn = $('isSaveBtn');
      try {
        btn.disabled = true;
        var sec = await ensureSecretLoaded(reqCid, reqEpoch, reqUid);
        if (!isSessionCurrent(reqEpoch, reqUid)) return;
        if (!sec) throw new Error('비밀유지 자료를 열지 못했습니다.');
        var item = {
          id: iss.id || ('iss_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 5)),
          title: C.maskRrnText(C.str($('isTitle').value) || '쟁점 행위'),
          whenWhere: C.maskRrnText(C.str($('isWhen').value)),
          claimVictim: C.maskRrnText(C.str($('isVic').value)),
          claimAccused: C.maskRrnText(C.str($('isAcc').value)),
          evidenceNote: C.maskRrnText(C.str($('isEvid').value)),
          factStatus: C.str($('isFact').value),
          elemSuperiority: C.str($('isE1').value),
          elemBeyondScope: C.str($('isE2').value),
          elemHarm: C.str($('isE3').value)
        };
        item.verdict = C.judgeIssue(item);
        var savedSec = await saveSecretRecord(reqCid, collectDirtyReportInputs({ upsertIssue: item }), reqEpoch, reqUid);
        if (!savedSec || !isSessionCurrent(reqEpoch, reqUid)) return;
        var c = caseById(reqCid);
        if (c && (!c.steps || !c.steps.review || (!c.steps.review.done && !c.steps.review.manual))) {
          var revStep = { done: true, date: C.ymdOf(Date.now()), note: '쟁점별 사실인정 및 3요건 법리검토 작성', srcMail: '', manual: false };
          var ns = Object.assign({}, c.steps || {}, { review: revStep });
          await saveCaseAndSync(Object.assign({}, c, { steps: ns }), false, c._virtualFromErp ? null : { autoStepPatches: { review: revStep } }, reqEpoch, reqUid);
          if (!isSessionCurrent(reqEpoch, reqUid)) return;
        }
        if (MODAL_SEQ === reqModalSeq) closeModal();
        draw();
        toast('✅ 쟁점 검토 저장 완료');
      } catch (err) {
        if (!isSessionCurrent(reqEpoch, reqUid)) return;
        if (btn) btn.disabled = false;
        toast('저장 실패: ' + ((err && err.message) || err));
      }
    });
  }

  /* 모달에서 항목만 저장할 때는 실제로 사용자가 고친 텍스트 칸만 반영하여 동시 작업 덮어쓰기를 막음 */
  function collectDirtyReportInputs(extra) {
    var base = {};
    if (DIRTY_RPT.overview && $('rOverview')) base.overview = $('rOverview').value;
    if (DIRTY_RPT.conclusion && $('rConclusion')) base.conclusion = $('rConclusion').value;
    if (DIRTY_RPT.recommendations && $('rRec')) base.recommendations = $('rRec').value;
    if (DIRTY_RPT.reportBody && $('rBody')) base.reportBody = $('rBody').value;
    return Object.assign(base, extra || {});
  }

  function getMaskedReportBodyForExport() {
    var raw = C.str($('rBody') && $('rBody').value);
    if (!raw) return '';
    var masked = C.maskRrnText(raw);
    if (masked !== raw && $('rBody')) {
      $('rBody').value = masked;
      DIRTY_RPT.reportBody = 1;
    }
    return masked;
  }

  function mergeCurrentReportInputs(extra) {
    var base = {};
    if ($('rOverview')) base.overview = $('rOverview').value;
    if ($('rConclusion')) base.conclusion = $('rConclusion').value;
    if ($('rRec')) base.recommendations = $('rRec').value;
    if ($('rBody')) base.reportBody = $('rBody').value;
    return Object.assign(base, extra || {});
  }

  async function saveAllReportTab() {
    var reqEpoch = SESSION_EPOCH;
    var reqUid = ME && ME.uid ? String(ME.uid) : '';
    if (!isSessionCurrent(reqEpoch, reqUid)) return;
    var c = caseById(CUR_ID);
    if (!c) return;
    /* interviews / issues 는 넘기지 않아 서버 최신 배열을 그대로 유지 */
    var patch = mergeCurrentReportInputs({});
    var vVal = $('rVerdict') ? C.str($('rVerdict').value) : C.str(c.verdictSummary);
    var savedSec = await saveSecretRecord(c.id, patch, reqEpoch, reqUid);
    if (!savedSec || !isSessionCurrent(reqEpoch, reqUid)) return;
    if (vVal !== C.str(c.verdictSummary)) {
      await saveCaseAndSync(Object.assign({}, c, { verdictSummary: vVal }), false, c._virtualFromErp ? null : { fields: { verdictSummary: vVal } }, reqEpoch, reqUid);
      if (!isSessionCurrent(reqEpoch, reqUid)) return;
    }
    draw();
    toast('💾 진술 · 3요건 검토 · 조사결과보고서가 안전하게 저장되었습니다.');
  }

  /* ═══ 일괄 작업(Bulk Actions) 실행기 ═══ */
  async function handleBulkAction(spec) {
    var parts = String(spec || '').split(':');
    var nm = parts[0], act = parts[1];
    var ids = pickedIds(nm);
    if (!ids.length) return;

    if (nm === 'cases' && act === 'sync') {
      clearSel(['cases']);
      await syncAllCases(ids);
      return;
    }
    if (nm === 'cases' && act === 'del') {
      var delTargets = ids.filter(function (id) { return D.cases[id] && canChangeManagers(D.cases[id]); });
      if (!delTargets.length) {
        toast('저장된 사건 삭제는 해당 사건 주담당 노무사 또는 대표만 가능합니다.');
        return;
      }
      if (!confirm('선택한 ' + delTargets.length + '건의 조사 현황 기록을 삭제하시겠습니까?\n(푸른이알피 사건 원장은 유지됩니다)')) return;
      for (var i = 0; i < delTargets.length; i++) {
        var prev = D.cases[delTargets[i]];
        if (prev) {
          await gate.remove(fbDb.ref('harass_invest').child('cases').child(delTargets[i]), prev, { entityType: 'Case', allowPendingCompany: !prev.companyId });
          delete D.cases[delTargets[i]];
        }
      }
      clearSel(['cases']);
      rebuildDerived();
      draw();
      toast('삭제 처리되었습니다.');
      return;
    }
    if (nm === 'bundles' && act === 'reg') {
      if (!confirm('선택한 ' + ids.length + '개 메일 묶음을 조사 사건으로 등록하고 푸른이알피에 자동 반영할까요?')) return;
      var ok = 0;
      for (var bi = 0; bi < ids.length; bi++) {
        var b = BUNDLES.find(function (x) { return x.bundleKey === ids[bi]; });
        if (b) { await registerBundleNow(b); ok++; }
      }
      clearSel(['bundles']);
      TAB = 'cases';
      draw();
      toast('✅ ' + ok + '개 조사 사건 등록 및 푸른이알피 반영 완료');
      return;
    }
    if (nm === 'bundles' && act === 'hide') {
      for (var hi = 0; hi < ids.length; hi++) await hideBundle(ids[hi]);
      clearSel(['bundles']);
      toast('선택 후보를 제외했습니다.');
      return;
    }
    if (nm === 'steps') {
      var c = caseById(CUR_ID);
      if (!c || !canEditCase(c)) return;
      var markDone = (act === 'done');
      var ns = Object.assign({}, c.steps || {});
      var stepPatches = {};
      ids.forEach(function (sc) {
        var prevS = ns[sc] || {};
        var updatedS = {
          done: markDone,
          date: markDone ? (prevS.date || C.ymdOf(Date.now())) : '',
          note: prevS.note || (markDone ? '일괄 완료 처리' : ''),
          srcMail: C.str(prevS.srcMail),
          manual: true
        };
        ns[sc] = updatedS;
        stepPatches[sc] = updatedS;
      });
      var bulkMut = { stepPatches: stepPatches };
      var nextClose = c.closeDate;
      if (ids.indexOf('report') >= 0) {
        nextClose = markDone ? (c.closeDate || ns.report.date || C.ymdOf(Date.now())) : '';
        bulkMut.closeDate = nextClose;
      }
      clearSel(['steps']);
      await saveCaseAndSync(Object.assign({}, c, { steps: ns, closeDate: nextClose }), false, c._virtualFromErp ? null : bulkMut);
      draw();
      toast('✅ 선택 단계가 업데이트되고 푸른이알피에 동기화되었습니다.');
      return;
    }
    if (nm === 'mails' && act === 'unlink') {
      var cm = caseById(CUR_ID);
      if (!cm || !canEditCase(cm)) return;
      var dropSet = {};
      ids.forEach(function (k) { dropSet[k] = 1; });
      var kept = (cm.mailLinks || []).filter(function (m) { return !dropSet[m.key]; });
      clearSel(['mails']);
      await saveCaseAndSync(Object.assign({}, cm, { mailLinks: kept }), false, cm._virtualFromErp ? null : { removeMailKeys: dropSet });
      draw();
      toast('선택 메일 연결을 해제했습니다.');
      return;
    }
    if ((nm === 'interviews' || nm === 'issues') && act === 'del') {
      var reqEpoch = SESSION_EPOCH;
      var reqUid = ME && ME.uid ? String(ME.uid) : '';
      var reqCid = CUR_ID;
      if (!isSessionCurrent(reqEpoch, reqUid) || !reqCid) return;
      var sec = await ensureSecretLoaded(reqCid, reqEpoch, reqUid);
      if (!sec || !isSessionCurrent(reqEpoch, reqUid)) return;
      var rm = {};
      ids.forEach(function (k) { rm[k] = 1; });
      var savedDel = null;
      if (nm === 'interviews') {
        savedDel = await saveSecretRecord(reqCid, collectDirtyReportInputs({ deleteInterviewIds: rm }), reqEpoch, reqUid);
      } else {
        savedDel = await saveSecretRecord(reqCid, collectDirtyReportInputs({ deleteIssueIds: rm }), reqEpoch, reqUid);
      }
      if (!savedDel || !isSessionCurrent(reqEpoch, reqUid)) return;
      clearSel([nm]);
      draw();
      toast('선택 항목을 삭제했습니다.');
    }
  }

  /* ═══ 이벤트 위임 및 부팅 ═══ */
  function bindEvents() {
    $('tabs').addEventListener('click', async function (e) {
      var btn = e.target.closest('button[data-tab]');
      if (!btn) return;
      var nextTab = btn.getAttribute('data-tab');
      if (nextTab === TAB) return;
      var evEpoch = SESSION_EPOCH;
      var evUid = ME && ME.uid ? String(ME.uid) : '';
      TAB = nextTab;
      clearSel();
      try {
        if (TAB === 'report' && CUR_ID) await ensureSecretLoaded(CUR_ID, evEpoch, evUid);
      } catch (err) {}
      if (!isSessionCurrent(evEpoch, evUid)) return;
      draw();
    });

    $('reloadBtn').addEventListener('click', function () { reload().catch(function (err) { toast('새로고침 오류: ' + ((err && err.message) || err)); }); });
    $('syncAllBtn').addEventListener('click', function () { syncAllCases(null).catch(function (err) { toast('동기화 오류: ' + ((err && err.message) || err)); }); });
    $('newCaseBtn').addEventListener('click', function () { openCaseModal(null, null); });
    $('imapScanBtn').addEventListener('click', function () { runImapDeepScan(''); });
    $('imapInboxBtn').addEventListener('click', function () {
      var kw = prompt('다음메일 서버 전체 폴더에서 찾을 조사 관련 키워드를 입력하세요:', C.str($('inQ').value) || '괴롭힘');
      if (kw && C.str(kw).length >= 2) runImapDeepScan(C.str(kw));
    });

    ['caseQ', 'inQ'].forEach(function (id) { $(id).addEventListener('input', draw); });
    ['caseCat', 'caseSt', 'caseMgr'].forEach(function (id) { $(id).addEventListener('change', draw); });

    document.addEventListener('input', function (e) {
      var fld = e.target && e.target.getAttribute && e.target.getAttribute('data-rptfld');
      if (fld) DIRTY_RPT[fld] = 1;
    });

    document.addEventListener('keydown', function (e) {
      var modal = $('modal');
      if (!modal || modal.style.display === 'none') return;
      if (e.key === 'Escape') {
        e.preventDefault();
        closeModal();
        return;
      }
      if (e.key === 'Tab') {
        var list = modalFocusables($('mbox'));
        if (!list.length) return;
        var first = list[0], last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });

    document.addEventListener('change', async function (e) {
      try {
        var t = e.target;
        if (t.matches('[data-all]')) {
          var nm = t.getAttribute('data-all');
          var tbl = document.querySelector('table.t[data-name="' + nm + '"]');
          if (tbl) {
            tbl.querySelectorAll('tbody tr[data-row]').forEach(function (tr) {
              var rid = tr.getAttribute('data-row');
              if (t.checked) SEL[nm + '|' + rid] = 1; else delete SEL[nm + '|' + rid];
            });
          }
          draw();
          return;
        }
        if (t.matches('[data-ck]')) {
          var k = t.getAttribute('data-ck');
          if (t.checked) SEL[k] = 1; else delete SEL[k];
          drawBulks();
          return;
        }
        if (t.matches('[data-casesel]')) {
          var evEpoch = SESSION_EPOCH;
          var evUid = ME && ME.uid ? String(ME.uid) : '';
          CUR_ID = t.value;
          clearSel();
          if (TAB === 'report' && CUR_ID) await ensureSecretLoaded(CUR_ID, evEpoch, evUid);
          if (!isSessionCurrent(evEpoch, evUid)) return;
          draw();
        }
      } catch (err) {
        toast('처리 오류: ' + ((err && err.message) || err));
      }
    });

    document.addEventListener('click', async function (e) {
      if (e.target === $('modal') || e.target.closest('[data-mclose]')) {
        closeModal();
        return;
      }
      var bulkClr = e.target.closest('[data-bulkclr]');
      if (bulkClr) {
        clearSel([bulkClr.getAttribute('data-bulkclr')]);
        draw();
        return;
      }
      var bulkAct = e.target.closest('[data-bulkact]');
      if (bulkAct) {
        try {
          bulkAct.disabled = true;
          await handleBulkAction(bulkAct.getAttribute('data-bulkact'));
        } catch (err) {
          toast('일괄 작업 오류: ' + ((err && err.message) || err));
        } finally {
          bulkAct.disabled = false;
        }
        return;
      }
      var actBtn = e.target.closest('[data-act]');
      if (actBtn) {
        e.stopPropagation();
        var act = actBtn.getAttribute('data-act');
        var id = actBtn.getAttribute('data-id') || '';
        var evEpoch = SESSION_EPOCH;
        var evUid = ME && ME.uid ? String(ME.uid) : '';
        try {
          if (act === 'openDetail') { CUR_ID = id; TAB = 'detail'; clearSel(); draw(); }
          else if (act === 'openReport') {
            CUR_ID = id; TAB = 'report'; clearSel();
            await ensureSecretLoaded(id, evEpoch, evUid);
            if (!isSessionCurrent(evEpoch, evUid)) return;
            draw();
          }
          else if (act === 'retrySecret') {
            delete D.secretDenied[id];
            await ensureSecretLoaded(id, evEpoch, evUid);
            if (!isSessionCurrent(evEpoch, evUid)) return;
            draw();
          }
          else if (act === 'regBundle') {
            var b = BUNDLES.find(function (x) { return x.bundleKey === id; });
            if (b) openCaseModal(null, b);
          }
          else if (act === 'previewBundle') {
            var bp = BUNDLES.find(function (x) { return x.bundleKey === id; });
            if (bp) previewBundleModal(bp);
          }
          else if (act === 'hideBundle') { await hideBundle(id); toast('후보 목록에서 제외했습니다.'); }
          else if (act === 'syncOne') {
            var cs = caseById(id);
            if (cs && canEditCase(cs)) {
              actBtn.disabled = true;
              try { await syncCaseMails(cs); draw(); toast('✅ 메일 재수집 및 푸른이알피 동기화 완료'); }
              finally { actBtn.disabled = false; }
            }
          }
          else if (act === 'editCase') {
            var ce = caseById(id);
            if (ce) openCaseModal(ce, null);
          }
          else if (act === 'toggleStep') {
            var ct = caseById(CUR_ID);
            if (!ct || !canEditCase(ct)) return;
            var curS = (ct.steps && ct.steps[id]) || {};
            var nextDone = !curS.done;
            var ns = Object.assign({}, ct.steps || {});
            var toggledStep = {
              done: nextDone,
              date: nextDone ? (curS.date || C.ymdOf(Date.now())) : '',
              note: curS.note || (nextDone ? '단계 완료 확인' : ''),
              srcMail: C.str(curS.srcMail),
              manual: true
            };
            ns[id] = toggledStep;
            var toggleMut = { stepPatches: {} };
            toggleMut.stepPatches[id] = toggledStep;
            var cDate = ct.closeDate;
            if (id === 'report') {
              cDate = nextDone ? (ct.closeDate || ns.report.date || C.ymdOf(Date.now())) : '';
              toggleMut.closeDate = cDate;
            }
            actBtn.disabled = true;
            try {
              await saveCaseAndSync(Object.assign({}, ct, { steps: ns, closeDate: cDate }), false, ct._virtualFromErp ? null : toggleMut);
              draw();
              toast(nextDone ? '✓ 완료 처리 및 푸른이알피 반영 완료' : '대기 상태로 되돌렸습니다');
            } finally { actBtn.disabled = false; }
          }
          else if (act === 'editStep') openStepEditModal(id);
          else if (act === 'linkAmbigMail') {
            actBtn.disabled = true;
            try { await linkSingleMailRowToCurrentCase(id); }
            finally { actBtn.disabled = false; }
          }
          else if (act === 'viewMail') {
            var cv = caseById(CUR_ID);
            var ml = cv && (cv.mailLinks || []).find(function (x) { return x.key === id; });
            if (ml) await openMailViewerModal(ml);
          }
          else if (act === 'editMailRole') openMailRoleModal(id);
          else if (act === 'openMailFinder') openMailFinderModal();
          else if (act === 'addOfflineDoc') openOfflineDocModal();
          else if (act === 'addIv') openInterviewModal(null);
          else if (act === 'editIv') {
            var sec1 = D.secretCache[CUR_ID];
            var iv = sec1 && (sec1.interviews || []).find(function (x) { return x && x.id === id; });
            if (iv) openInterviewModal(iv);
          }
          else if (act === 'addIssue') openIssueModal(null);
          else if (act === 'editIssue') {
            var sec2 = D.secretCache[CUR_ID];
            var iss = sec2 && (sec2.issues || []).find(function (x) { return x && x.id === id; });
            if (iss) openIssueModal(iss);
          }
          else if (act === 'assembleRpt') {
            var ca = caseById(CUR_ID);
            if (!ca) return;
            var vSel = $('rVerdict') ? C.str($('rVerdict').value) : C.str(ca.verdictSummary);
            var tempCase = Object.assign({}, ca, { verdictSummary: vSel });
            var tempSec = Object.assign({}, D.secretCache[CUR_ID] || {}, mergeCurrentReportInputs({}));
            var draft = C.assembleReportDraft(tempCase, tempSec);
            if ($('rBody')) {
              $('rBody').value = draft;
              DIRTY_RPT.reportBody = 1;
            }
            toast('✨ 표준 조사결과보고서 초안이 조립되었습니다. 검토 후 [💾 보고서 저장]을 누르세요.');
          }
          else if (act === 'saveReportAll') {
            actBtn.disabled = true;
            try { await saveAllReportTab(); }
            finally { actBtn.disabled = false; }
          }
          else if (act === 'printRpt') {
            var txt = getMaskedReportBodyForExport();
            if (!txt) { toast('먼저 보고서 초안을 조립하거나 작성하세요'); return; }
            $('printArea').textContent = txt;
            window.print();
          }
          else if (act === 'downloadDoc') {
            var bodyTxt = getMaskedReportBodyForExport();
            if (!bodyTxt) { toast('먼저 보고서 초안을 조립하거나 작성하세요'); return; }
            var cd = caseById(CUR_ID);
            var docHtml = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>조사결과보고서</title></head><body style="font-family:Malgun Gothic,serif;line-height:1.75;font-size:11pt;white-space:pre-wrap">' +
              esc(bodyTxt) + '</body></html>';
            var blob = new Blob(['\ufeff', docHtml], { type: 'application/msword;charset=utf-8' });
            var u = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = u;
            a.download = C.maskRrnText((cd && cd.companyName) || '사건') + '_조사결과보고서_' + C.ymdOf(Date.now()) + '.doc';
            document.body.appendChild(a);
            a.click();
            setTimeout(function () { URL.revokeObjectURL(u); a.remove(); }, 1500);
            toast('📄 문서(.doc) 내려받기 완료');
          }
          else if (act === 'copyRpt') {
            var cpTxt = getMaskedReportBodyForExport();
            if (!cpTxt) { toast('복사할 보고서 본문이 없습니다'); return; }
            if (navigator.clipboard && navigator.clipboard.writeText) {
              await navigator.clipboard.writeText(cpTxt);
              toast('📋 조사결과보고서 전문이 복사되었습니다');
            }
          }
        } catch (err) {
          toast('작업 실패: ' + ((err && err.message) || err));
        }
        return;
      }

      /* 행 클릭 시 사건 열기 (체크박스·링크·입력칸 제외) */
      if (e.target.closest('input,button,select,a,label')) return;
      var tr = e.target.closest('tr[data-row]');
      if (!tr) return;
      var tname = tr.getAttribute('data-tname');
      var rid = tr.getAttribute('data-row');
      if (tname === 'cases') {
        CUR_ID = rid;
        TAB = 'detail';
        clearSel();
        draw();
      } else if (tname === 'bundles') {
        var bRow = BUNDLES.find(function (x) { return x.bundleKey === rid; });
        if (bRow) previewBundleModal(bRow);
      }
    });
  }

  async function loadStaffDir(optEpoch, optUid) {
    var reqEpoch = optEpoch || SESSION_EPOCH;
    var reqUid = optUid || (ME && ME.uid ? String(ME.uid) : '');
    try {
      var raw = (await fbDb.ref('data/user_dir').once('value')).val();
      if (!isSessionCurrent(reqEpoch, reqUid)) return;
      var list = rowsOf(raw);
      NAMES = {};
      var seen = {};
      STAFF = [];
      list.forEach(function (x) {
        if (!x || !x.sid || !x.name) return;
        NAMES[sidKey(x.sid)] = String(x.name);
        if ((!x.status || x.status === 'active') && !seen[x.sid]) {
          seen[x.sid] = 1;
          STAFF.push({ sid: String(x.sid), name: String(x.name), ord: typeof x.sortOrder === 'number' ? x.sortOrder : 9999 });
        }
      });
      STAFF.sort(function (a, b) { return (a.ord - b.ord) || a.name.localeCompare(b.name, 'ko'); });
      fillMgrFilter();
    } catch (e) {}
  }

  function lockScreen(why) {
    $('app').style.display = 'none';
    $('lock').style.display = 'block';
    $('lockWhy').textContent = why || '';
  }

  function boot(firebaseInstance) {
    fb = firebaseInstance;
    fbDb = fb.database();
    bindEvents();
    try { fb.auth().setPersistence(fb.auth.Auth.Persistence.LOCAL); } catch (e) {}
    fb.auth().onAuthStateChanged(async function (u) {
      var authUid = (u && u.uid) ? String(u.uid) : '';
      $('outBtn').style.display = authUid ? '' : 'none';
      if (!authUid) {
        purgeSessionState();
        if ($('lock')) $('lock').style.display = 'none';
        if (global.puHarassGateShow) global.puHarassGateShow();
        else if (global.PuGate) global.PuGate.show();
        return;
      }
      if (ME && ME.uid && ME.uid !== authUid) {
        purgeSessionState();
      }
      var authEpoch = ++SESSION_EPOCH;
      if (global.PuGate) global.PuGate.hide();
      var roleVal = {};
      try { roleVal = (await fbDb.ref('uid_roles/' + authUid).once('value')).val() || {}; } catch (e) {}
      if (authEpoch !== SESSION_EPOCH || currentAuthUid() !== authUid) return;
      if (roleVal.status !== 'active' || !roleVal.sid) {
        purgeSessionState();
        var nm = (global.PuWhoami && global.PuWhoami.get && global.PuWhoami.get() && global.PuWhoami.get().name) || '';
        lockScreen((nm ? '접속: ' + nm + ' — ' : '') + '재직 중인 직원 계정이 아닙니다.');
        return;
      }
      ME = {
        uid: authUid,
        sid: String(roleVal.sid),
        name: String(roleVal.name || ''),
        isAdmin: roleVal.isAdmin == true,
        isSubAdmin: roleVal.isSubAdmin == true
      };
      gate = global.PuOntologyWrite.createGateway({ mode: 'enforce', actor: ME.sid });
      $('lock').style.display = 'none';
      $('app').style.display = '';
      await loadStaffDir(authEpoch, authUid);
      if (!isSessionCurrent(authEpoch, authUid)) return;
      await reload(authEpoch, authUid);
    });
  }

  global.PuHarassView = {
    boot: boot,
    reload: reload,
    htmlToSafePlainText: htmlToSafePlainText,
    _applyCaseMutation: applyCaseMutation,
    _diffCaseModalFields: diffCaseModalFields
  };
})(typeof window !== 'undefined' ? window : globalThis);
