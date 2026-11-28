/* 푸른통합시스템 — 노사관계·단체교섭·임금협상 화면 컨트롤러 (pu-union.html 전용 window.PuUnionView)
 *
 * 맡는 일:
 *   1. Firebase 인증 · 재직자 확인(uid_roles) · 세션 격리(SESSION_EPOCH) · PuOntologyWrite 강제 관문(enforce)
 *   2. 푸른 메일함(IMAP mailbox/folders·msgs + POP3 mailbox/old/msgs + searchMailbox) 전수 스캔 · 사업장×연도 자동 분류
 *   3. 5개 대시보드 탭:
 *      - 종합·연도별 대시보드 (5트랙 · KPI · 연도별 분포 · 컬럼 정렬/다중 필터 · 일괄 작업)
 *      - 사업장 절차·진행 (8단계 절차 토글 · 창구단일화/쟁의조정 법정기일 계산기 · 회차 일지 · HWPX 공고문/보고서)
 *      - 이메일 전수 수집 (미등록 사업장×연도 묶음 일괄 편입 · 전체 노사메일 목록 · peek:1 본문/첨부 실시간 열람)
 *      - 서류·검토서류 자료함 (진행/검토/체결/증빙 4대 구분 · 14종 세부역할 · 로컬 교섭폴더 연결)
 *      - 단협·임협 신구대비 검토실 (3단 신구조문대비표 · 임금원가 시뮬레이터 · HWPX/CSV/푸른한글 출력)
 */
(function (global) {
  'use strict';

  var C = function () { return global.PuUnionCore; };
  var H = function () { return global.PuUnionHwpx; };
  var MB_FN = 'https://asia-northeast3-pureun-erp.cloudfunctions.net/';

  var RECENT_CODE_CHANGES = [
    { key: 'dashboard', tab: 'dashboard', target: '#sec-dashboard-strip', label: '종합·연도별 대시보드', desc: '5대 트랙 · 연도별 분포 · 컬럼 정렬/다중 필터' },
    { key: 'workspace', tab: 'workspace', target: '#wsHeaderBox',         label: '교섭 절차·법정기일',   desc: '8단계 절차 · 창구단일화/조정 D-Day · 교섭회차 일지' },
    { key: 'mails',     tab: 'mails',     target: '#mailStatsCard',       label: '이메일 전수 수집',     desc: 'IMAP+POP3 전수 스캔 · 사업장×연도 묶음 · 본문 열람' },
    { key: 'docs',      tab: 'docs',      target: '#docsHeaderCard',      label: '진행·검토 서류함',     desc: '진행/검토/체결/증빙 4대 구분 · 로컬 교섭폴더 연결' },
    { key: 'review',    tab: 'review',    target: '#reviewTopCard',       label: '신구대비·원가검토실',  desc: '3단 신구조문대비표 · 임금원가 시뮬레이터 · HWPX/CSV' }
  ];

  var fb = null;
  var fbDb = null;
  var gate = null;
  var ME = { uid: '', sid: '', name: '', email: '', isAdmin: false, isSubAdmin: false };
  var SESSION_EPOCH = 0;
  var SNAP_ONLY = false;
  var RELOAD_IN_FLIGHT = false;
  var MODAL_SEQ = 0;

  var D = {
    cases: {},
    docs: {},
    clauses: {},
    mails: {},
    dismissed: {},
    companies: [],
    erpCases: [],
    userDir: {},
    mailFolders: {},
    mailMsgs: {},
    oldMailMsgs: {},
    extraMailRows: [],
    imapHitKeys: {}
  };

  var STAFF = [];
  var NAMES = Object.create(null);
  var MERGED_CASES = [];
  var ALL_DOCS = [];
  var SCAN_RES = { unionMails: [], matchedByCaseId: {}, bundles: [], stats: { totalScanned: 0, unionMailCount: 0, bundleCount: 0, matchedMailCount: 0, byYear: {}, byTrack: {}, byDocGroup: {} } };
  var MAIL_VIEW_CACHE = Object.create(null);
  var LOCAL_FOLDER = { name: '', files: [], handle: null };

  var TAB = 'dashboard';
  var CUR_ID = '';
  var TRACK_FILTER = '';
  var YEAR_FILTER = '';
  var DOC_GROUP_FILTER = '';
  var COL_STATE = { sortCol: '', sortDir: '', tracks: null, years: null, statuses: null, mgrs: null };
  var SEL = { cases: {}, bundles: {}, docs: {}, clauses: {} };
  var SHOW_DIFF_HIGHLIGHT = true;

  function $(id) { return document.getElementById(id); }
  function str(v) { return v == null ? '' : String(v).trim(); }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
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
  function rowsOf(v) { return C().rowsOf(v); }
  function toast(msg) {
    var el = $('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('on');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.classList.remove('on'); }, 3500);
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

  /* ── 1. 권한 · 직원명 · 강제 저장 관문 ────────────────────────────────── */
  function loadStaffDir(dirObj) {
    var src = (dirObj && dirObj.v) ? dirObj.v : (dirObj || {});
    STAFF = [];
    NAMES = Object.create(null);
    Object.keys(src).forEach(function (k) {
      var r = src[k];
      if (!r || typeof r !== 'object') return;
      var sid = str(r.sid || k);
      var nm = str(r.name || r.displayName || sid);
      if (!sid) return;
      NAMES[sid] = nm;
      if (r.status !== 'retired') STAFF.push({ sid: sid, name: nm });
    });
    STAFF.sort(function (a, b) { return a.name.localeCompare(b.name, 'ko'); });
    fillMgrFilter();
  }
  function nameOf(sid) {
    var s = str(sid);
    if (!s) return '미배정';
    return NAMES[s] || s;
  }
  function fillMgrFilter() {
    var sel = $('dashMgr');
    if (!sel) return;
    var cur = sel.value;
    sel.innerHTML = '<option value="">담당자 전체</option>' + STAFF.map(function (st) {
      return '<option value="' + esc(st.sid) + '">' + esc(st.name) + '</option>';
    }).join('');
    sel.value = cur;
  }

  function scrubField(v) {
    var t = str(v);
    if (!t) return '';
    return C().maskPiiStrict(t, [], { keepBizNo: true, keepCaseNo: true })
      .replace(/(?:[A-Za-z]:\\|\/Users\/|\/home\/|Desktop[\\/])/gi, '[로컬경로가림]')
      .trim();
  }

  function askConfirm(msg) {
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      return window.confirm(msg);
    }
    return true;
  }

  async function saveEntity(dbPath, recordOrPatch, entityType, previous, opts) {
    if (SNAP_ONLY) throw new Error('오프라인 스냅샷 보기 상태입니다. 새로고침 후 저장하세요.');
    if (!gate || !fbDb) throw new Error('저장 관문이 초기화되지 않았습니다.');
    var o = opts || {};
    var cleanRec = stripUndef(Object.assign({}, recordOrPatch));
    delete cleanRec.revision;
    var cidCheck = own(cleanRec, 'companyId') ? cleanRec.companyId : (previous && previous.companyId);
    var allowPending = !str(cidCheck);
    var ref = fbDb.ref(dbPath);
    var gwOpts = {
      entityType: entityType,
      allowPendingCompany: allowPending
    };
    if (previous && previous.revision != null && isFinite(Number(previous.revision))) {
      gwOpts.expectedRevision = Number(previous.revision);
    }
    var res = await gate.save(ref, function (prev) {
      var cur = prev || previous || {};
      var base = o.patch
        ? stripUndef(Object.assign({}, cur, cleanRec))
        : stripUndef(Object.assign({}, cur, cleanRec));
      if (o.stepPatch && o.stepPatch.code) {
        base.steps = Object.assign({}, (cur && cur.steps) || {});
        base.steps[o.stepPatch.code] = o.stepPatch.val;
      }
      if (o.appendRound) {
        base.rounds = arr(cur && cur.rounds).slice().concat([o.appendRound]);
      }
      if (!prev) delete base.revision;
      return base;
    }, gwOpts);
    var val = (res && res.snapshot && typeof res.snapshot.val === 'function') ? res.snapshot.val() : null;
    return stripUndef(val || Object.assign({}, previous || {}, cleanRec));
  }

  async function softDeleteEntity(dbPath, previous, entityType) {
    if (SNAP_ONLY) throw new Error('오프라인 스냅샷 보기 상태입니다. 새로고침 후 삭제하세요.');
    if (!gate || !fbDb || !previous) return null;
    var now = Date.now();
    var ref = fbDb.ref(dbPath);
    var gwOpts = {
      entityType: entityType || previous.entityType,
      allowPendingCompany: !str(previous.companyId)
    };
    if (previous.revision != null && isFinite(Number(previous.revision))) {
      gwOpts.expectedRevision = Number(previous.revision);
    }
    var res = await gate.save(ref, function (prev) {
      var base = stripUndef(Object.assign({}, prev || previous, {
        _deleted: true,
        deletedAt: now,
        deletedBy: ME.sid
      }));
      if (!prev) delete base.revision;
      return base;
    }, gwOpts);
    return (res && res.snapshot && typeof res.snapshot.val === 'function') ? res.snapshot.val() : null;
  }

  /* ── 2. 파생 데이터 재조립 (사업장×연도 · 메일 · 서류 · 로컬폴더) ──── */
  function buildLocalDocs() {
    return LOCAL_FOLDER.files.map(function (f) {
      var roleObj = C().inferDocRole(f.fileName, f.folderHint, '');
      return {
        id: 'loc_' + C().sha256Hex(f.sig).slice(0, 14),
        caseId: f.matchedCaseId || '',
        companyId: f.companyId || '',
        companyName: f.companyName || '미분류 사업장',
        year: f.year || '',
        group: roleObj.group,
        role: roleObj.code,
        roleLabel: roleObj.label,
        stepCode: roleObj.stepCode,
        title: f.fileName,
        fileName: f.fileName,
        source: '로컬 교섭폴더',
        reviewState: 'pending',
        docDate: f.date || '',
        isLocal: true,
        fileObj: f.fileObj || null
      };
    });
  }

  function rebuildDerived() {
    var core = C();
    var flatMails = core.flattenMailbox(D.mailFolders, D.mailMsgs, D.oldMailMsgs);
    if (D.extraMailRows.length) {
      var seen = Object.create(null);
      flatMails.forEach(function (m) { seen[m.key] = 1; });
      D.extraMailRows.forEach(function (em) {
        if (em && !seen[em.key]) { seen[em.key] = 1; flatMails.push(em); }
      });
    }

    var rawCases = rowsOf(D.cases);
    SCAN_RES = core.scanAndGroupUnionMails(flatMails, {
      companies: D.companies,
      erpCases: D.erpCases,
      existingCases: rawCases,
      linkedMailsByCaseId: D.mails,
      dismissed: D.dismissed
    });

    var activeCaseMap = Object.create(null);
    rawCases.forEach(function (c) {
      if (c && c.id) activeCaseMap[c.id] = c;
    });

    var docsByCid = Object.create(null);
    var docRows = [];
    var seenDocSig = Object.create(null);

    /* DB 저장 서류 (휴지통 _deleted 사건의 서류는 제외) */
    Object.keys(D.docs || {}).forEach(function (cid) {
      if (!activeCaseMap[cid]) return;
      var bucket = D.docs[cid];
      rowsOf(bucket).forEach(function (d) {
        var rowCid = d.caseId || cid;
        if (!activeCaseMap[rowCid]) return;
        var row = Object.assign({}, d, { caseId: rowCid, isDb: true });
        if (!docsByCid[row.caseId]) docsByCid[row.caseId] = [];
        docsByCid[row.caseId].push(row);
        docRows.push(row);
        seenDocSig[row.caseId + '|' + str(row.fileName || row.title).toLowerCase()] = 1;
      });
    });

    /* DB 저장 메일 연결 + 실시간 스캔 연결 메일 합산 */
    var caseMap = Object.create(null);
    MERGED_CASES = rawCases.map(function (c) {
      var cid = c.id;
      var dbMails = rowsOf(D.mails && D.mails[cid]);
      var scanMails = SCAN_RES.matchedByCaseId[cid] || [];
      var mSeen = Object.create(null);
      var allMails = [];
      dbMails.concat(scanMails).forEach(function (m) {
        var mk = m.mailKey || m.key || m.id;
        if (mk && !mSeen[mk]) { mSeen[mk] = 1; allMails.push(m); }
      });
      allMails.sort(function (a, b) { return str(b.date).localeCompare(str(a.date)); });

      var cDocs = (docsByCid[cid] || []).slice();
      /* 연결 메일의 첨부 중 아직 DB 서류함에 없는 것은 자동 파생 서류로 표시 */
      allMails.forEach(function (m) {
        arr(m.docItems).forEach(function (di) {
          if (!di || !di.fileName) return;
          var sig = cid + '|' + str(di.fileName).toLowerCase();
          if (seenDocSig[sig]) return;
          seenDocSig[sig] = 1;
          var derivedDoc = {
            id: 'md_' + core.sha256Hex(m.key + '|' + di.fileName).slice(0, 14),
            caseId: cid,
            companyId: c.companyId || '',
            companyName: c.companyName || '',
            year: core.caseYearOf(c) || m.year || '',
            group: di.group,
            role: di.role,
            roleLabel: di.roleLabel,
            stepCode: di.stepCode,
            title: di.fileName,
            fileName: di.fileName,
            source: '메일 첨부',
            reviewState: di.group === 'signed' ? 'final' : 'pending',
            docDate: m.date || '',
            mailRef: m,
            isDerived: true
          };
          cDocs.push(derivedDoc);
          docRows.push(derivedDoc);
        });
      });

      var steps = core.reconstructStepsFromMails(c.steps, allMails, cDocs);
      var progress = core.computeProgress(steps);
      var progCnt = 0, revCnt = 0, sigCnt = 0, evCnt = 0;
      cDocs.forEach(function (d) {
        if (d.group === 'progress') progCnt++;
        else if (d.group === 'review') revCnt++;
        else if (d.group === 'signed') sigCnt++;
        else evCnt++;
      });
      var clCount = rowsOf(D.clauses && D.clauses[cid]).length;
      var latestDate = str(c.latestDate || c.agreedDate || c.demandDate || c.receiveDate);
      if (allMails[0] && str(allMails[0].date) > latestDate) latestDate = str(allMails[0].date);

      var merged = Object.assign({}, c, {
        year: core.caseYearOf(c),
        steps: steps,
        progress: progress,
        linkedMails: allMails,
        linkedDocs: cDocs,
        mailCount: allMails.length,
        progressDocCount: progCnt,
        reviewDocCount: revCnt,
        signedDocCount: sigCnt,
        evidenceDocCount: evCnt,
        clauseCount: clCount,
        latestDate: latestDate
      });
      caseMap[cid] = merged;
      return merged;
    });

    /* 미등록 노사메일의 첨부서류도 자료함에서 바로 열람 가능하도록 파생 목록에 포함 */
    SCAN_RES.unionMails.forEach(function (m) {
      if (m.linkedCaseId) return;
      arr(m.docItems).forEach(function (di) {
        if (!di || !di.fileName) return;
        var sig = 'unlinked|' + m.key + '|' + di.fileName.toLowerCase();
        if (seenDocSig[sig]) return;
        seenDocSig[sig] = 1;
        docRows.push({
          id: 'um_' + core.sha256Hex(sig).slice(0, 14),
          caseId: '',
          companyId: m.companyId || '',
          companyName: m.companyName || '미분류 사업장',
          year: m.year || '',
          group: di.group,
          role: di.role,
          roleLabel: di.roleLabel,
          stepCode: di.stepCode,
          title: di.fileName,
          fileName: di.fileName,
          source: '미등록 메일',
          reviewState: 'pending',
          docDate: m.date || '',
          mailRef: m,
          isDerived: true
        });
      });
    });

    /* 로컬 연결 폴더 파일 병합 */
    var localDocs = buildLocalDocs();
    localDocs.forEach(function (ld) {
      /* 사업장×연도 일치하는 등록 건 자동 연결 */
      var matchC = MERGED_CASES.find(function (c) {
        return c.year === ld.year && core.normCorpName(c.companyName) && core.normCorpName(c.companyName) === core.normCorpName(ld.companyName);
      });
      if (matchC) {
        ld.caseId = matchC.id;
        ld.companyId = matchC.companyId;
        matchC.linkedDocs.push(ld);
        if (ld.group === 'progress') matchC.progressDocCount++;
        else if (ld.group === 'review') matchC.reviewDocCount++;
        else if (ld.group === 'signed') matchC.signedDocCount++;
        else matchC.evidenceDocCount++;
      }
      docRows.push(ld);
    });

    MERGED_CASES.sort(function (a, b) {
      return (str(b.year).localeCompare(str(a.year))) || (str(b.latestDate).localeCompare(str(a.latestDate)));
    });
    docRows.sort(function (a, b) {
      return (str(b.year).localeCompare(str(a.year))) || (str(b.docDate).localeCompare(str(a.docDate)));
    });
    ALL_DOCS = docRows;

    if (!CUR_ID || !caseMap[CUR_ID]) {
      CUR_ID = MERGED_CASES[0] ? MERGED_CASES[0].id : '';
    }

    if ($('nCases')) $('nCases').textContent = String(MERGED_CASES.length);
    if ($('nMails')) $('nMails').textContent = String(SCAN_RES.unionMails.length);
    if ($('nDocs')) $('nDocs').textContent = String(ALL_DOCS.length);
  }

  function caseById(id) {
    return MERGED_CASES.find(function (c) { return c.id === id; }) || null;
  }

  /* ── 3. 최근 변경 안내 바 (#recent-diff-bar) ──────────────────────────── */
  function renderRecentDiffBar() {
    var host = $('recent-diff-bar');
    if (!host) return;
    try { SHOW_DIFF_HIGHLIGHT = localStorage.getItem('pu_diff_bar_unionrel') !== 'off'; } catch (_) {}
    var pills = RECENT_CODE_CHANGES.map(function (ch) {
      return '<button type="button" class="diff-pill" data-diff-go="' + esc(ch.key) + '" title="' + esc(ch.desc) + '">' +
        '<span class="diff-badge">변경됨</span> ' + esc(ch.label) + '</button>';
    }).join('');
    host.innerHTML = '<div class="diff-row">' +
      '<span class="diff-title">🆕 노사관계·단체교섭 신규 구축 (2026-11-28)</span>' +
      '<div class="diff-pills">' + pills + '</div>' +
      '<button type="button" class="diff-toggle" id="diffToggleBtn">' + (SHOW_DIFF_HIGHLIGHT ? '변경 강조 ON' : '변경 강조 OFF') + '</button>' +
      '</div>';
    var boxes = document.querySelectorAll('.code-diff-target');
    for (var i = 0; i < boxes.length; i++) boxes[i].classList.toggle('code-diff-box', SHOW_DIFF_HIGHLIGHT);
  }

  /* ── 4. 공용 표 · 컬럼 필터 팝오버 ───────────────────────────────────── */
  function closeThPop() {
    var old = document.getElementById('urThPop');
    if (old) old.remove();
  }

  function hasColFilterOrSort() {
    return !!(COL_STATE.sortCol || COL_STATE.tracks || COL_STATE.years || COL_STATE.statuses || COL_STATE.mgrs);
  }

  function openColFilterPop(colKey, anchorEl) {
    closeThPop();
    var pop = document.createElement('div');
    pop.id = 'urThPop';
    pop.className = 'th-pop';

    var valsMap = Object.create(null);
    MERGED_CASES.forEach(function (c) {
      var v = '', lbl = '';
      if (colKey === 'year') { v = c.year || '미상'; lbl = v === '미상' ? '연도 미상' : v + '년'; }
      else if (colKey === 'track') { v = c.track || 'bargain'; lbl = (C().TRACKS[v] && C().TRACKS[v].short) || v; }
      else if (colKey === 'status') { v = c.status || 'active'; lbl = (C().STATUSES[v] && C().STATUSES[v].label) || v; }
      else if (colKey === 'mgr') { v = str(c.managerMain) || '__none__'; lbl = v === '__none__' ? '미배정' : nameOf(v); }
      if (!v) return;
      if (!valsMap[v]) valsMap[v] = { val: v, lbl: lbl, cnt: 0 };
      valsMap[v].cnt++;
    });

    var stateKey = colKey === 'year' ? 'years' : (colKey === 'track' ? 'tracks' : (colKey === 'status' ? 'statuses' : (colKey === 'mgr' ? 'mgrs' : '')));
    var curMap = stateKey ? COL_STATE[stateKey] : null;
    var items = Object.keys(valsMap).map(function (k) { return valsMap[k]; });
    items.sort(function (a, b) { return b.cnt - a.cnt || a.lbl.localeCompare(b.lbl, 'ko'); });

    var listHtml = stateKey ? ('<div class="th-pop-list">' + items.map(function (it) {
      var chk = !curMap || !!curMap[it.val];
      return '<label class="th-pop-item"><input type="checkbox" data-th-val="' + esc(it.val) + '"' + (chk ? ' checked' : '') + '>' +
        '<span class="lbl">' + esc(it.lbl) + '</span><span class="cnt">' + it.cnt + '</span></label>';
    }).join('') + '</div>') : '';

    pop.innerHTML =
      '<div class="th-pop-hd"><span>정렬 · 필터</span><span class="sp"></span><button type="button" class="sm" id="thPopCloseBtn">닫기</button></div>' +
      '<div class="th-pop-bd">' +
        '<div class="th-pop-sorts">' +
          '<button type="button" data-th-sort="asc"' + (COL_STATE.sortCol === colKey && COL_STATE.sortDir === 'asc' ? ' class="on"' : '') + '>▲ 오름차순</button>' +
          '<button type="button" data-th-sort="desc"' + (COL_STATE.sortCol === colKey && COL_STATE.sortDir === 'desc' ? ' class="on"' : '') + '>▼ 내림차순</button>' +
          '<button type="button" data-th-sort="">해제</button>' +
        '</div>' +
        listHtml +
      '</div>' +
      '<div class="th-pop-ft">' +
        '<button type="button" class="sm" id="thPopAllBtn">전체선택</button>' +
        '<button type="button" class="sm pri" id="thPopApplyBtn">적용</button>' +
      '</div>';

    document.body.appendChild(pop);
    var rect = anchorEl.getBoundingClientRect();
    pop.style.top = Math.min(window.innerHeight - 320, Math.max(8, rect.bottom + 4)) + 'px';
    pop.style.left = Math.min(window.innerWidth - 280, Math.max(8, rect.left)) + 'px';

    pop.addEventListener('click', function (ev) {
      var sBtn = ev.target.closest('[data-th-sort]');
      if (sBtn) {
        var dir = sBtn.getAttribute('data-th-sort');
        if (!dir) { COL_STATE.sortCol = ''; COL_STATE.sortDir = ''; }
        else { COL_STATE.sortCol = colKey; COL_STATE.sortDir = dir; }
        closeThPop();
        draw();
        return;
      }
      if (ev.target.id === 'thPopCloseBtn') { closeThPop(); return; }
      if (ev.target.id === 'thPopAllBtn') {
        pop.querySelectorAll('[data-th-val]').forEach(function (cb) { cb.checked = true; });
        return;
      }
      if (ev.target.id === 'thPopApplyBtn') {
        if (stateKey) {
          var boxes = pop.querySelectorAll('[data-th-val]');
          var next = Object.create(null);
          var checkedCnt = 0;
          boxes.forEach(function (cb) { if (cb.checked) { next[cb.getAttribute('data-th-val')] = true; checkedCnt++; } });
          COL_STATE[stateKey] = (checkedCnt === boxes.length) ? null : next;
        }
        closeThPop();
        draw();
      }
    });
  }

  function renderTable(tableName, headers, rows, curId, opts) {
    var o = opts || {};
    var selMap = SEL[tableName] || {};
    var allChecked = rows.length > 0 && rows.every(function (r) { return !!selMap[r.id]; });

    var ths = '<th class="c"><input type="checkbox" data-sel-all="' + esc(tableName) + '"' + (allChecked ? ' checked' : '') + ' aria-label="전체 선택"></th>' +
      '<th class="n">№</th>' +
      headers.map(function (h, idx) {
        var spec = o.colHeaders && o.colHeaders[idx];
        if (spec && spec.colKey) {
          var isOn = (COL_STATE.sortCol === spec.colKey) ||
            (spec.colKey === 'year' && !!COL_STATE.years) ||
            (spec.colKey === 'track' && !!COL_STATE.tracks) ||
            (spec.colKey === 'status' && !!COL_STATE.statuses) ||
            (spec.colKey === 'mgr' && !!COL_STATE.mgrs);
          return '<th><button type="button" class="th-flt-btn' + (isOn ? ' on' : '') + '" data-th-col="' + esc(spec.colKey) + '">' + esc(h) + ' ▾</button></th>';
        }
        return '<th>' + esc(h) + '</th>';
      }).join('');

    if (!rows.length) {
      return '<div class="scroll"><table class="t" data-name="' + esc(tableName) + '"><thead><tr>' + ths + '</tr></thead></table></div>' +
        (o.emptyHtml || '<div class="empty">표시할 자료가 없습니다.</div>');
    }

    var bodyHtml = rows.map(function (r, idx) {
      var cls = [r.rowCls || '', curId && r.id === curId ? 'cur' : ''].filter(Boolean).join(' ');
      var tds = '<td class="c"><input type="checkbox" data-sel-tbl="' + esc(tableName) + '" data-sel-id="' + esc(r.id) + '"' + (selMap[r.id] ? ' checked' : '') + ' aria-label="행 선택"></td>' +
        '<td class="n">' + (idx + 1) + '</td>' +
        r.cells.map(function (cell) {
          var cCls = cell.cls ? ' class="' + esc(cell.cls) + '"' : '';
          var cK = cell.k ? ' data-k="' + esc(cell.k) + '"' : '';
          var cTit = cell.title ? ' title="' + esc(cell.title) + '"' : '';
          return '<td' + cCls + cK + cTit + '>' + cell.html + '</td>';
        }).join('');
      return '<tr data-row="' + esc(tableName) + '" data-id="' + esc(r.id) + '"' + (cls ? ' class="' + esc(cls) + '"' : '') + '>' + tds + '</tr>';
    }).join('');

    return '<div class="scroll"><table class="t" data-name="' + esc(tableName) + '"><thead><tr>' + ths + '</tr></thead><tbody>' + bodyHtml + '</tbody></table></div>';
  }

  function stepDotsHtml(steps) {
    var s = steps || {};
    return '<span class="pbar">' + C().STEPS.map(function (st) {
      var done = s[st.code] && s[st.code].done;
      return '<span class="pdot' + (done ? ' done' : '') + '" title="' + esc(st.name) + '"></span>';
    }).join('') + '</span>';
  }

  /* ── 5. 탭 1: 종합·연도별 대시보드 ─────────────────────────────────── */
  function getFilteredCases() {
    var q = str($('dashQ') && $('dashQ').value).toLowerCase();
    var yrSel = str($('dashYear') && $('dashYear').value);
    var trSel = str($('dashTrack') && $('dashTrack').value);
    var stSel = str($('dashStatus') && $('dashStatus').value);
    var pfSel = str($('dashPerf') && $('dashPerf').value);
    var mgSel = str($('dashMgr') && $('dashMgr').value);

    var out = MERGED_CASES.filter(function (c) {
      var yr = c.year || '미상';
      var tr = c.track || 'bargain';
      var st = c.status || 'active';
      var mg = str(c.managerMain) || '__none__';

      if (TRACK_FILTER && tr !== TRACK_FILTER) return false;
      if (YEAR_FILTER) {
        if (YEAR_FILTER === 'older') { if (/^20(2[1-9]|3\d)$/.test(yr)) return false; }
        else if (yr !== YEAR_FILTER) return false;
      }
      if (yrSel && yr !== yrSel) return false;
      if (trSel && tr !== trSel) return false;
      if (stSel && st !== stSel) return false;
      if (pfSel && (c.performMode || 'review_advisory') !== pfSel) return false;
      if (mgSel && c.managerMain !== mgSel && arr(c.managerSubs).indexOf(mgSel) < 0) return false;

      if (COL_STATE.years && !COL_STATE.years[yr]) return false;
      if (COL_STATE.tracks && !COL_STATE.tracks[tr]) return false;
      if (COL_STATE.statuses && !COL_STATE.statuses[st]) return false;
      if (COL_STATE.mgrs && !COL_STATE.mgrs[mg]) return false;

      if (q) {
        var hay = [c.year, c.companyName, c.unionName, c.federation, c.title, c.summaryNote, nameOf(c.managerMain)].join(' ').toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });

    if (COL_STATE.sortCol && COL_STATE.sortDir) {
      var mul = COL_STATE.sortDir === 'asc' ? 1 : -1;
      var sc = COL_STATE.sortCol;
      out = out.slice().sort(function (a, b) {
        if (sc === 'year') return str(a.year).localeCompare(str(b.year), 'ko') * mul;
        if (sc === 'company') return str(a.companyName).localeCompare(str(b.companyName), 'ko') * mul;
        if (sc === 'track') return str(a.track).localeCompare(str(b.track), 'ko') * mul;
        if (sc === 'mgr') return nameOf(a.managerMain).localeCompare(nameOf(b.managerMain), 'ko') * mul;
        if (sc === 'status') return str(a.status).localeCompare(str(b.status), 'ko') * mul;
        return 0;
      });
    }
    return out;
  }

  function drawDashboard() {
    var core = C();
    /* 트랙 바 & KPI */
    var trCnt = Object.create(null);
    var yrCnt = Object.create(null);
    var activeCnt = 0, medCnt = 0, agreedCnt = 0, progDocs = 0, revDocs = 0;

    MERGED_CASES.forEach(function (c) {
      trCnt[c.track || 'bargain'] = (trCnt[c.track || 'bargain'] || 0) + 1;
      var y = c.year || '미상';
      yrCnt[y] = (yrCnt[y] || 0) + 1;
      if (c.status === 'mediating') medCnt++;
      else if (c.status === 'agreed' || c.status === 'closed') agreedCnt++;
      else activeCnt++;
      progDocs += c.progressDocCount || 0;
      revDocs += c.reviewDocCount || 0;
    });

    var trHtml = '<span class="scope-lbl">교섭 트랙</span>' +
      '<button type="button" class="scope-btn' + (!TRACK_FILTER ? ' on' : '') + '" data-track="">전체 (' + MERGED_CASES.length + ')</button>' +
      core.TRACK_ORDER.map(function (tk) {
        var t = core.TRACKS[tk];
        return '<button type="button" class="scope-btn' + (TRACK_FILTER === tk ? ' on' : '') + '" data-track="' + esc(tk) + '">' +
          t.icon + ' ' + esc(t.short) + ' (' + (trCnt[tk] || 0) + ')</button>';
      }).join('');
    if ($('trackBar')) $('trackBar').innerHTML = trHtml;

    if ($('kpiBox')) {
      $('kpiBox').innerHTML =
        '<div class="kpi k-blue" role="button" tabindex="0" data-act="kpiTrack" data-id=""><span>전체 사업장건</span><b>' + MERGED_CASES.length + '건</b></div>' +
        '<div class="kpi k-blue" role="button" tabindex="0" data-act="kpiStatus" data-id="active"><span>진행중</span><b>' + activeCnt + '건</b></div>' +
        '<div class="kpi k-amber" role="button" tabindex="0" data-act="kpiStatus" data-id="mediating"><span>조정·분쟁</span><b>' + medCnt + '건</b></div>' +
        '<div class="kpi k-green" role="button" tabindex="0" data-act="kpiStatus" data-id="agreed"><span>타결·종결</span><b>' + agreedCnt + '건</b></div>' +
        '<div class="kpi k-blue" role="button" tabindex="0" data-act="goTab" data-id="mails"><span>수집 노사메일</span><b>' + SCAN_RES.unionMails.length + '통</b></div>' +
        '<div class="kpi k-blue" role="button" tabindex="0" data-act="goDocGroup" data-id="progress"><span>진행서류</span><b>' + progDocs + '건</b></div>' +
        '<div class="kpi k-amber" role="button" tabindex="0" data-act="goDocGroup" data-id="review"><span>검토서류</span><b>' + revDocs + '건</b></div>' +
        '<div class="kpi k-red" role="button" tabindex="0" data-act="goTab" data-id="mails"><span>미등록 묶음</span><b>' + SCAN_RES.bundles.length + '묶음</b></div>';
    }

    /* 연도별 알약 & 분포 */
    var yrs = Object.keys(yrCnt);
    Object.keys(SCAN_RES.stats.byYear || {}).forEach(function (y) { if (yrs.indexOf(y) < 0) yrs.push(y); });
    yrs = yrs.filter(function (y) { return /^20\d{2}$/.test(y); }).sort().reverse();
    if ($('dashYear')) {
      var curY = $('dashYear').value;
      $('dashYear').innerHTML = '<option value="">연도 전체</option>' + yrs.map(function (y) {
        return '<option value="' + esc(y) + '">' + esc(y) + '년</option>';
      }).join('');
      $('dashYear').value = curY;
    }
    if ($('dashTrack')) {
      var curT = $('dashTrack').value;
      $('dashTrack').innerHTML = '<option value="">트랙 전체</option>' + core.TRACK_ORDER.map(function (tk) {
        return '<option value="' + esc(tk) + '">' + esc(core.TRACKS[tk].name) + '</option>';
      }).join('');
      $('dashTrack').value = curT;
    }
    if ($('yearPillsBar')) {
      $('yearPillsBar').innerHTML = '<span style="font-size:11.5px;font-weight:700;color:var(--ink2);margin-right:4px">연도별 구분</span>' +
        '<button type="button" class="' + (!YEAR_FILTER ? 'on' : '') + '" data-yr="">전체</button>' +
        yrs.map(function (y) {
          var cnt = yrCnt[y] || 0;
          var mCnt = (SCAN_RES.stats.byYear && SCAN_RES.stats.byYear[y]) || 0;
          return '<button type="button" class="' + (YEAR_FILTER === y ? 'on' : '') + '" data-yr="' + esc(y) + '">' +
            esc(y) + '년 (' + cnt + (mCnt ? ' · 📧' + mCnt : '') + ')</button>';
        }).join('');
    }
    if ($('yearDistBar')) {
      $('yearDistBar').innerHTML = yrs.slice(0, 8).map(function (y) {
        var cCnt = yrCnt[y] || 0;
        var mCnt = (SCAN_RES.stats.byYear && SCAN_RES.stats.byYear[y]) || 0;
        return '<div class="yr-dist-item' + (YEAR_FILTER === y ? ' on' : '') + '" role="button" tabindex="0" data-yr="' + esc(y) + '">' +
          '<b>' + esc(y) + '년</b><span>건 ' + cCnt + ' · 메일 ' + mCnt + '</span></div>';
      }).join('');
    }

    var hasFlt = !!(TRACK_FILTER || YEAR_FILTER || hasColFilterOrSort() || str($('dashQ') && $('dashQ').value) ||
      str($('dashYear') && $('dashYear').value) || str($('dashTrack') && $('dashTrack').value) ||
      str($('dashStatus') && $('dashStatus').value) || str($('dashPerf') && $('dashPerf').value) || str($('dashMgr') && $('dashMgr').value));
    if ($('dashResetBtn')) $('dashResetBtn').style.display = hasFlt ? '' : 'none';

    /* 일괄 작업 바 */
    var selIds = Object.keys(SEL.cases).filter(function (k) { return SEL.cases[k] && caseById(k); });
    var bulkBar = $('casesBulkBar');
    if (bulkBar) {
      if (selIds.length) {
        bulkBar.classList.add('on');
        bulkBar.innerHTML = '<b>' + selIds.length + '건 선택</b>' +
          '<button type="button" class="sm" data-bulk-st="active">진행중</button>' +
          '<button type="button" class="sm" data-bulk-st="mediating">조정·분쟁</button>' +
          '<button type="button" class="sm ok" data-bulk-st="agreed">타결·체결</button>' +
          '<button type="button" class="sm" data-bulk-st="closed">종결</button>' +
          '<button type="button" class="sm" id="bulkCsvBtn">📥 선택 CSV</button>' +
          '<button type="button" class="sm danger" id="bulkDelBtn">🗑️ 선택 삭제</button>' +
          '<button type="button" class="sm" id="bulkClearBtn">선택해제</button>';
      } else {
        bulkBar.classList.remove('on');
        bulkBar.innerHTML = '';
      }
    }

    var filtered = getFilteredCases();
    var rows = filtered.map(function (c) {
      var tr = core.TRACKS[c.track] || core.TRACKS.bargain;
      var st = core.STATUSES[c.status] || core.STATUSES.active;
      var p = c.progress;
      var docChip = '<span class="chip c-blue">진행 ' + (c.progressDocCount || 0) + '</span> ' +
        '<span class="chip c-amber">검토 ' + (c.reviewDocCount || 0) + '</span>' +
        (c.signedDocCount ? ' <span class="chip c-green">체결 ' + c.signedDocCount + '</span>' : '');
      return {
        id: c.id,
        cells: [
          { html: '<span class="chip">' + esc(c.year || '미상') + '</span>' },
          { cls: 'ti', title: c.companyName + ' — ' + c.title, html: esc(c.companyName) + (c.title ? ' · <span style="font-weight:400;color:var(--mute)">' + esc(c.title) + '</span>' : '') },
          { title: c.unionName || '-', html: esc(c.unionName || '-') },
          { k: 'badge', html: '<span class="chip">' + tr.icon + ' ' + esc(tr.short) + '</span>' },
          { title: nameOf(c.managerMain), html: esc(nameOf(c.managerMain)) },
          { html: stepDotsHtml(c.steps) + '<b>' + p.doneCount + '/' + p.totalCount + '</b> ' + esc(p.currentStepShort) },
          { html: docChip },
          { html: '<span class="chip c-blue">📧 ' + (c.mailCount || 0) + '</span>' },
          { html: esc(c.latestDate || c.receiveDate || '-') },
          { html: '<span class="chip ' + esc(st.chipCls) + '">' + esc(st.label) + '</span>' },
          { k: 'act', html:
            '<button type="button" class="sm pri" data-act="openWs" data-id="' + esc(c.id) + '">절차·진행</button> ' +
            '<button type="button" class="sm" data-act="openRev" data-id="' + esc(c.id) + '">검토실</button>' }
        ]
      };
    });

    if ($('casesBox')) {
      $('casesBox').innerHTML = renderTable(
        'cases',
        ['연도', '사업장 · 교섭건명', '노조·상급단체', '트랙', '담당', '8단계 진행', '진행·검토서류', '메일', '최근일자', '상태', '열기'],
        rows,
        CUR_ID,
        {
          colHeaders: [
            { colKey: 'year' }, { colKey: 'company' }, null, { colKey: 'track' }, { colKey: 'mgr' },
            null, null, null, null, { colKey: 'status' }, null
          ],
          emptyHtml: '<div class="empty">조건에 맞는 노사관계·단체교섭 건이 없습니다. <b>[📧 이메일 전수 수집]</b>에서 과거 메일 묶음을 바로 등록하거나 <b>[+ 신규 교섭·노사 등록]</b>을 눌러 시작하세요.</div>'
        }
      );
    }
  }

  /* ── 6. 탭 2: 사업장 절차·진행 워크스페이스 ────────────────────────── */
  function drawWorkspace() {
    var c = caseById(CUR_ID);
    if (!c) {
      if ($('wsHeaderBox')) $('wsHeaderBox').innerHTML = '<div class="card"><div class="empty">선택된 사업장·연도 건이 없습니다. 대시보드에서 건을 선택하거나 신규 등록하세요.</div></div>';
      if ($('wsStepsBox')) $('wsStepsBox').innerHTML = '';
      if ($('wsTimelineBox')) $('wsTimelineBox').innerHTML = '';
      if ($('wsRoundsBox')) $('wsRoundsBox').innerHTML = '';
      if ($('wsLinkedBox')) $('wsLinkedBox').innerHTML = '';
      return;
    }
    var core = C();
    var tr = core.TRACKS[c.track] || core.TRACKS.bargain;
    var st = core.STATUSES[c.status] || core.STATUSES.active;
    var sameCoCases = MERGED_CASES.filter(function (x) {
      return core.normCorpName(x.companyName) && core.normCorpName(x.companyName) === core.normCorpName(c.companyName);
    }).sort(function (a, b) { return str(b.year).localeCompare(str(a.year)); });

    var yrPills = sameCoCases.map(function (sc) {
      return '<button type="button" class="' + (sc.id === c.id ? 'on' : '') + '" data-act="openWs" data-id="' + esc(sc.id) + '">' +
        esc(sc.year || '미상') + '년 · ' + esc((core.TRACKS[sc.track] && core.TRACKS[sc.track].short) || '') + '</button>';
    }).join('');

    if ($('wsHeaderBox')) {
      $('wsHeaderBox').innerHTML = '<div class="card">' +
        '<div class="sec">' +
          '<select id="wsCaseSwitch" aria-label="사업장 건 전환">' + MERGED_CASES.map(function (mc) {
            var lblTi = mc.title || (core.TRACKS[mc.track] && core.TRACKS[mc.track].short) || '노사건';
            return '<option value="' + esc(mc.id) + '"' + (mc.id === c.id ? ' selected' : '') + '>' + esc((mc.year || '-') + '년 | ' + (mc.companyName || '미분류') + ' — ' + lblTi) + '</option>';
          }).join('') + '</select>' +
          '<span class="chip ' + esc(st.chipCls) + '">' + esc(st.label) + '</span>' +
          '<span class="chip">' + tr.icon + ' ' + esc(tr.name) + '</span>' +
          '<span class="sp"></span>' +
          '<button type="button" class="sm" data-act="editCase" data-id="' + esc(c.id) + '">✏️ 기본정보 수정</button>' +
          '<button type="button" class="sm ok" data-act="dlSummaryHwpx" data-id="' + esc(c.id) + '">📄 종합현황 HWPX</button>' +
          '<button type="button" class="sm" data-act="openHangulSum" data-id="' + esc(c.id) + '">📝 푸른한글 열기</button>' +
          '<button type="button" class="sm" data-act="printSum" data-id="' + esc(c.id) + '">🖨️ 인쇄</button>' +
        '</div>' +
        (sameCoCases.length > 1 ? '<div class="yr-pills"><span style="font-size:11.5px;font-weight:700;color:var(--ink2)">같은 사업장 연도별 이력:</span>' + yrPills + '</div>' : '') +
        '<div class="bar">' +
          '<span><b>사업장:</b> ' + esc(c.companyName) + '</span>' +
          '<span><b>노조·상급단체:</b> ' + esc(c.unionName || '-') + (c.federation ? ' (' + esc(c.federation) + ')' : '') + '</span>' +
          '<span><b>담당:</b> ' + esc(nameOf(c.managerMain)) + '</span>' +
          '<span><b>교섭요구일:</b> ' + esc(c.demandDate || '-') + '</span>' +
          '<span><b>합의·체결일:</b> ' + esc(c.agreedDate || '-') + '</span>' +
        '</div>' +
      '</div>';
    }

    /* 8단계 절차 바 */
    if ($('wsStepsBox')) {
      $('wsStepsBox').innerHTML = '<div class="card">' +
        '<div class="sec"><span>🧭 8단계 표준 교섭·노사관계 절차 (클릭 시 완료/해제 수기 전환)</span><span class="chip c-blue">' + c.progress.doneCount + '/' + c.progress.totalCount + ' (' + c.progress.pct + '%)</span></div>' +
        '<div class="ws-steps">' + core.STEPS.map(function (stItem) {
          var sr = (c.steps && c.steps[stItem.code]) || {};
          var cls = sr.done ? 'done' : (stItem.code === c.progress.currentStepCode ? 'cur' : '');
          var tag = sr.manual ? '수기' : (sr.autoDone ? '자동' : '');
          return '<button type="button" class="ws-step ' + cls + '" data-toggle-step="' + esc(stItem.code) + '" title="' + esc(stItem.desc + (sr.date ? ' (' + sr.date + ')' : '')) + '">' +
            '<b>' + esc(stItem.short) + '</b>' + (tag ? ' <span class="chip">' + tag + '</span>' : '') + '</button>';
        }).join('') + '</div>' +
      '</div>';
    }

    /* 창구단일화 · 쟁의조정 법정기일 계산기 */
    var chTl = c.demandDate ? core.calcChannelTimeline(c.demandDate) : { ok: false, milestones: [] };
    var dispTl = c.disputeApplyDate ? core.calcDisputeTimeline(c.disputeApplyDate, !!c.isPublicService) : { ok: false, milestones: [] };
    if ($('wsTimelineBox')) {
      $('wsTimelineBox').innerHTML = '<div class="card">' +
        '<div class="sec">' +
          '<span>⏰ 창구단일화 · 쟁의조정 법정기일 자동계산기</span>' +
          '<span class="sp"></span>' +
          '<label style="font-size:12px">교섭요구일 <input type="date" id="wsDemandDateInput" value="' + esc(c.demandDate || '') + '"></label>' +
          '<button type="button" class="sm pri" id="wsSaveDemandDateBtn">기일계산 저장</button>' +
          '<button type="button" class="sm ok" data-act="dlNoticeDemand" data-id="' + esc(c.id) + '">📄 요구사실 공고문</button>' +
          '<button type="button" class="sm ok" data-act="dlNoticeConfirm" data-id="' + esc(c.id) + '">📄 확정공고문</button>' +
          '<label style="font-size:12px">조정신청일 <input type="date" id="wsDisputeDateInput" value="' + esc(c.disputeApplyDate || '') + '"></label>' +
          '<label style="font-size:12px"><input type="checkbox" id="wsPublicSvcChk"' + (c.isPublicService ? ' checked' : '') + '> 공익(15일)</label>' +
          '<button type="button" class="sm" id="wsSaveDisputeDateBtn">조정기일 저장</button>' +
        '</div>' +
        (chTl.ok ? '<div class="tl-grid">' + chTl.milestones.map(function (m) {
          return '<div class="tl-card ' + esc(m.state) + '" title="' + esc(m.legalBasis) + '"><b>' + esc(m.label) + '</b><span>' + esc(m.date) + ' · <b>' + esc(m.dDayLabel) + '</b></span></div>';
        }).join('') + '</div>' : '<div class="hint" style="padding:8px 12px">교섭요구 접수일을 입력하면 노조법 시행령상 7일·5일·14일 창구단일화 법정기일이 자동 계산되고 공고문 2종 HWPX가 생성됩니다.</div>') +
        (dispTl.ok ? '<div class="tl-grid" style="border-top:1px solid var(--line)">' + dispTl.milestones.map(function (m) {
          return '<div class="tl-card ' + esc(m.state) + '" title="' + esc(m.legalBasis) + '"><b>' + esc(m.label) + '</b><span>' + esc(m.date) + ' · <b>' + esc(m.dDayLabel) + '</b></span></div>';
        }).join('') + '</div>' : '') +
      '</div>';
    }

    /* 좌: 교섭 회차 일지 / 우: 연결 메일 & 서류 */
    var rounds = arr(c.rounds);
    if ($('wsRoundsBox')) {
      var rRows = rounds.map(function (r, idx) {
        return {
          id: String(idx),
          cells: [
            { html: '<b>' + esc((r.roundNo || (idx + 1)) + '차') + '</b>' },
            { html: esc(r.date || '-') },
            { html: '<span class="chip">' + esc(r.kind || '교섭') + '</span>' },
            { cls: 'wide', title: r.agenda || '', html: esc(r.agenda || '-') },
            { html: esc(r.result || '-') },
            { k: 'act', html: '<button type="button" class="sm danger" data-del-round="' + idx + '">삭제</button>' }
          ]
        };
      });
      $('wsRoundsBox').innerHTML = '<div class="card">' +
        '<div class="sec"><span>🗣️ 교섭 회차 진행 일지 (' + rounds.length + '회)</span><span class="sp"></span><button type="button" class="sm pri" id="wsAddRoundBtn">+ 회차 추가</button></div>' +
        renderTable('rounds', ['회차', '일자', '구분', '주요 안건', '결과', '작업'], rRows, '', { emptyHtml: '<div class="empty">등록된 교섭 회차가 없습니다.</div>' }) +
      '</div>';
    }

    var cDocs = arr(c.linkedDocs);
    var cMails = arr(c.linkedMails);
    if ($('wsLinkedBox')) {
      $('wsLinkedBox').innerHTML = '<div class="card">' +
        '<div class="sec"><span>📁 연결 진행/검토 서류 (' + cDocs.length + '건) · 📧 메일 (' + cMails.length + '통)</span><span class="sp"></span><button type="button" class="sm" data-act="goAddDoc" data-id="' + esc(c.id) + '">+ 서류 추가</button></div>' +
        '<div class="bar" style="flex-direction:column;align-items:stretch;gap:6px">' +
          (cDocs.length ? cDocs.slice(0, 10).map(function (d) {
            var grp = (core.DOC_GROUPS[d.group] && core.DOC_GROUPS[d.group].short) || d.group;
            return '<div style="display:flex;align-items:center;gap:6px;border-bottom:1px solid var(--line);padding-bottom:4px">' +
              '<span class="chip">' + esc(grp) + '</span><span class="chip">' + esc(d.roleLabel || '') + '</span>' +
              '<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + esc(d.title || d.fileName) + '">' + esc(d.title || d.fileName) + '</span>' +
              '<span class="hint">' + esc(d.docDate || '') + '</span></div>';
          }).join('') : '<div class="hint">연결된 서류가 없습니다.</div>') +
          (cMails.length ? '<div style="font-weight:700;font-size:12px;margin-top:6px">최근 연결 메일</div>' + cMails.slice(0, 8).map(function (m) {
            return '<div style="display:flex;align-items:center;gap:6px">' +
              '<span class="chip">' + (m.dir === 'out' ? '발신' : '수신') + '</span>' +
              '<button type="button" class="sm" style="flex:1;text-align:left;overflow:hidden;text-overflow:ellipsis" data-open-mail="' + esc(m.key) + '">' + esc(m.subject) + '</button>' +
              '<span class="hint">' + esc(m.date || '') + '</span></div>';
          }).join('') : '') +
        '</div>' +
      '</div>';
    }
  }

  /* ── 7. 탭 3: 이메일 전수 수집 ─────────────────────────────────────── */
  function drawMails() {
    var core = C();
    var st = SCAN_RES.stats || {};
    if ($('mailStatsCard')) {
      $('mailStatsCard').innerHTML = '<div class="sec">' +
        '<span>📧 푸른 메일함(IMAP + POP3 지난메일) 전수 스캔 현황</span>' +
        '<span class="chip">전체 스캔 ' + Number(st.totalScanned || 0).toLocaleString() + '통</span>' +
        '<span class="chip c-blue">노사·교섭 메일 ' + Number(st.unionMailCount || 0).toLocaleString() + '통</span>' +
        '<span class="chip c-green">기존 건 연결 ' + Number(st.matchedMailCount || 0) + '통</span>' +
        '<span class="chip c-amber">미등록 후보 ' + Number(st.bundleCount || 0) + '묶음</span>' +
        '<span class="sp"></span>' +
        '<button type="button" class="sm pri" id="importAllBundlesBtn">+ 미등록 묶음 일괄 편입</button>' +
      '</div>';
    }

    /* 미등록 사업장×연도 후보 묶음 */
    var bRows = SCAN_RES.bundles.map(function (b) {
      var tr = core.TRACKS[b.track] || core.TRACKS.bargain;
      return {
        id: b.id,
        cells: [
          { html: '<span class="chip">' + esc(b.year) + '</span>' },
          { cls: 'ti', title: b.companyName, html: esc(b.companyName) },
          { html: '<span class="chip">' + tr.icon + ' ' + esc(tr.short) + '</span>' },
          { html: '<span class="chip c-blue">' + b.mailCount + '통</span>' },
          { html: '<span class="chip">진행 ' + b.progressDocCount + ' · 검토 ' + b.reviewDocCount + '</span>' },
          { html: stepDotsHtml(b.steps) + esc(b.progress.currentStepShort) },
          { cls: 'wide', title: (b.mails[0] && b.mails[0].subject) || '', html: esc((b.mails[0] && b.mails[0].subject) || '-') },
          { html: esc(b.latestDate || '-') },
          { k: 'act', html:
            '<button type="button" class="sm pri" data-reg-bundle="' + esc(b.id) + '">+ 등록</button> ' +
            '<button type="button" class="sm" data-dis-bundle="' + esc(b.id) + '">제외</button>' }
        ]
      };
    });

    if ($('bundlesCard')) {
      $('bundlesCard').innerHTML =
        '<div class="sec"><span>📥 미등록 사업장 × 연도별 후보 묶음 (' + SCAN_RES.bundles.length + '묶음)</span></div>' +
        renderTable('bundles', ['연도', '추정 사업장', '추정 트랙', '메일', '서류', '추정단계', '대표 메일 제목', '최근일자', '작업'], bRows, '', {
          emptyHtml: '<div class="empty">미등록 노사관계 메일 후보 묶음이 없습니다.</div>'
        });
    }

    /* 전체 노사관계 이메일 목록 */
    var rawMq = ($('mailQInput') && $('mailQInput').value) || '';
    var mq = str(rawMq).toLowerCase();
    var mYr = str($('mailYrSel') && $('mailYrSel').value);
    var mGrp = str($('mailGrpSel') && $('mailGrpSel').value);
    var mFiltered = SCAN_RES.unionMails.filter(function (m) {
      if (mYr && m.year !== mYr) return false;
      if (mGrp && m.docGroup !== mGrp) return false;
      if (mq) {
        var hay = [m.year, m.companyName, m.subject, m.fromAddr, m.toAddr, arr(m.attNames).join(' ')].join(' ').toLowerCase();
        if (hay.indexOf(mq) < 0) return false;
      }
      return true;
    });

    var mailYrs = Object.keys(st.byYear || {}).sort().reverse();
    var mRows = mFiltered.slice(0, 300).map(function (m) {
      var tr = core.TRACKS[m.track] || core.TRACKS.bargain;
      var dg = core.DOC_GROUPS[m.docGroup] || core.DOC_GROUPS.progress;
      return {
        id: m.key,
        cells: [
          { html: '<span class="chip">' + esc(m.year) + '</span>' },
          { html: '<span class="chip">' + (m.dir === 'out' ? '발신' : '수신') + (m.old ? '·구' : '') + '</span>' },
          { cls: 'ti', title: m.companyName, html: esc(m.companyName) },
          { html: '<span class="chip">' + tr.icon + ' ' + esc(tr.short) + '</span>' },
          { html: '<span class="chip ' + esc(dg.chipCls) + '">' + esc(dg.short) + '</span>' },
          { cls: 'wide', title: m.subject, html: esc(m.subject) },
          { title: arr(m.attNames).join(', '), html: arr(m.attNames).length ? ('📎 ' + arr(m.attNames).length + '개') : '-' },
          { html: esc(m.date || '-') },
          { k: 'act', html: '<button type="button" class="sm pri" data-open-mail="' + esc(m.key) + '">본문·첨부</button>' }
        ]
      };
    });

    var mailTitleTxt = '📨 수집된 전체 노사관계·단체교섭 이메일 (' + mFiltered.length + '통' + (mFiltered.length > 300 ? ' · 최신 300통 표시' : '') + ')';
    var mailTblHtml = renderTable('mails', ['연도', '구분', '사업장', '트랙', '서류분류', '메일 제목', '첨부', '일자', '열람'], mRows, '', {
      emptyHtml: '<div class="empty">수집된 노사관계 메일이 없습니다.</div>'
    });

    if ($('mailsListCard')) {
      if (!$('mailQInput') || !$('mailsTableBox')) {
        $('mailsListCard').innerHTML =
          '<div class="sec"><span id="mailsListTitle">' + esc(mailTitleTxt) + '</span></div>' +
          '<div class="bar">' +
            '<input id="mailQInput" type="search" value="' + esc(rawMq) + '" aria-label="메일 검색" placeholder="사업장·제목·첨부파일 검색" style="flex:1;min-width:160px">' +
            '<select id="mailYrSel" aria-label="메일 연도 필터"><option value="">연도 전체</option>' + mailYrs.map(function (y) {
              return '<option value="' + esc(y) + '"' + (mYr === y ? ' selected' : '') + '>' + esc(y) + '년</option>';
            }).join('') + '</select>' +
            '<select id="mailGrpSel" aria-label="메일 서류구분 필터"><option value="">서류구분 전체</option>' +
              '<option value="progress"' + (mGrp === 'progress' ? ' selected' : '') + '>📄 진행서류</option>' +
              '<option value="review"' + (mGrp === 'review' ? ' selected' : '') + '>🔎 검토서류</option>' +
              '<option value="signed"' + (mGrp === 'signed' ? ' selected' : '') + '>✍️ 체결서류</option>' +
              '<option value="evidence"' + (mGrp === 'evidence' ? ' selected' : '') + '>📎 증빙자료</option>' +
            '</select>' +
          '</div>' +
          '<div id="mailsTableBox">' + mailTblHtml + '</div>';
      } else {
        if ($('mailsListTitle')) $('mailsListTitle').textContent = mailTitleTxt;
        if ($('mailYrSel')) {
          $('mailYrSel').innerHTML = '<option value="">연도 전체</option>' + mailYrs.map(function (y) {
            return '<option value="' + esc(y) + '"' + (mYr === y ? ' selected' : '') + '>' + esc(y) + '년</option>';
          }).join('');
          $('mailYrSel').value = mYr;
        }
        $('mailsTableBox').innerHTML = mailTblHtml;
      }
    }
  }

  /* ── 8. 탭 4: 서류·검토서류 자료함 ──────────────────────────────────── */
  function drawDocs() {
    var core = C();
    var grpCnt = Object.create(null);
    ALL_DOCS.forEach(function (d) { grpCnt[d.group] = (grpCnt[d.group] || 0) + 1; });

    var rawDq = ($('docQInput') && $('docQInput').value) || '';
    var dq = str(rawDq).toLowerCase();
    var dYr = str($('docYrSel') && $('docYrSel').value);
    var dRole = str($('docRoleSel') && $('docRoleSel').value);
    var dState = str($('docStateSel') && $('docStateSel').value);

    var docYrs = [];
    ALL_DOCS.forEach(function (d) { if (d.year && docYrs.indexOf(d.year) < 0) docYrs.push(d.year); });
    docYrs.sort().reverse();

    var pillsHtml =
      '<button type="button" class="' + (!DOC_GROUP_FILTER ? 'on' : '') + '" data-doc-grp="">전체 (' + ALL_DOCS.length + ')</button>' +
      Object.keys(core.DOC_GROUPS).map(function (gk) {
        var g = core.DOC_GROUPS[gk];
        return '<button type="button" class="' + (DOC_GROUP_FILTER === gk ? 'on' : '') + '" data-doc-grp="' + esc(gk) + '">' + esc(g.name) + ' (' + (grpCnt[gk] || 0) + ')</button>';
      }).join('');

    if ($('docsHeaderCard')) {
      if (!$('docQInput') || !$('docsGrpPills')) {
        $('docsHeaderCard').innerHTML =
          '<div class="sec">' +
            '<span>📁 교섭 진행 서류 · 검토 서류 · 체결 서류 자료함</span>' +
            '<span class="sp"></span>' +
            '<button type="button" class="sm pri" id="newDocBtn">+ 서류·검토서 직접 등록</button>' +
          '</div>' +
          '<div class="yr-pills" id="docsGrpPills">' + pillsHtml + '</div>' +
          '<div class="bar">' +
            '<input id="docQInput" type="search" value="' + esc(rawDq) + '" aria-label="서류 검색" placeholder="사업장·파일명·문서명 검색" style="flex:1;min-width:160px">' +
            '<select id="docYrSel" aria-label="서류 연도 필터"><option value="">연도 전체</option>' + docYrs.map(function (y) {
              return '<option value="' + esc(y) + '"' + (dYr === y ? ' selected' : '') + '>' + esc(y) + '년</option>';
            }).join('') + '</select>' +
            '<select id="docRoleSel" aria-label="세부 서류역할 필터"><option value="">세부유형 전체</option>' + Object.keys(core.DOC_ROLES).map(function (rk) {
              return '<option value="' + esc(rk) + '"' + (dRole === rk ? ' selected' : '') + '>' + esc(core.DOC_ROLES[rk].label) + '</option>';
            }).join('') + '</select>' +
            '<select id="docStateSel" aria-label="검토상태 필터"><option value="">검토상태 전체</option>' + Object.keys(core.REVIEW_STATES).map(function (sk) {
              return '<option value="' + esc(sk) + '"' + (dState === sk ? ' selected' : '') + '>' + esc(core.REVIEW_STATES[sk].label) + '</option>';
            }).join('') + '</select>' +
          '</div>';
      } else {
        $('docsGrpPills').innerHTML = pillsHtml;
        if ($('docYrSel')) {
          $('docYrSel').innerHTML = '<option value="">연도 전체</option>' + docYrs.map(function (y) {
            return '<option value="' + esc(y) + '"' + (dYr === y ? ' selected' : '') + '>' + esc(y) + '년</option>';
          }).join('');
          $('docYrSel').value = dYr;
        }
      }
    }

    if ($('folderLocalCard')) {
      if (LOCAL_FOLDER.files.length) {
        $('folderLocalCard').style.display = '';
        $('folderLocalCard').innerHTML = '<div class="sec"><span>📂 연결된 로컬 교섭폴더: ' + esc(LOCAL_FOLDER.name) + ' (' + LOCAL_FOLDER.files.length + '건 스캔)</span><span class="hint">로컬 경로는 저장되지 않고 브라우저 내에서만 분류됩니다</span></div>';
      } else {
        $('folderLocalCard').style.display = 'none';
      }
    }

    var filtered = ALL_DOCS.filter(function (d) {
      if (DOC_GROUP_FILTER && d.group !== DOC_GROUP_FILTER) return false;
      if (dYr && d.year !== dYr) return false;
      if (dRole && d.role !== dRole) return false;
      if (dState && d.reviewState !== dState) return false;
      if (dq) {
        var hay = [d.year, d.companyName, d.title, d.fileName, d.roleLabel, d.source].join(' ').toLowerCase();
        if (hay.indexOf(dq) < 0) return false;
      }
      return true;
    });

    var dRows = filtered.slice(0, 300).map(function (d) {
      var grp = core.DOC_GROUPS[d.group] || core.DOC_GROUPS.progress;
      var rs = core.REVIEW_STATES[d.reviewState] || core.REVIEW_STATES.pending;
      var actHtml = d.mailRef
        ? '<button type="button" class="sm pri" data-open-mail="' + esc(d.mailRef.key) + '">메일열람</button>' +
          (d.caseId ? ' <button type="button" class="sm" data-edit-doc="' + esc(d.id) + '" data-cid="' + esc(d.caseId) + '">검토·수정</button>' : '')
        : (d.isLocal && d.fileObj
          ? '<button type="button" class="sm ok" data-open-local-doc="' + esc(d.id) + '">내용추출</button>'
          : '<button type="button" class="sm" data-edit-doc="' + esc(d.id) + '" data-cid="' + esc(d.caseId || '') + '">검토·수정</button>');
      return {
        id: d.id,
        cells: [
          { html: '<span class="chip">' + esc(d.year || '-') + '</span>' },
          { html: esc(d.companyName || '-') },
          { html: '<span class="chip ' + esc(grp.chipCls) + '">' + esc(grp.short) + '</span>' },
          { html: esc(d.roleLabel || '-') },
          { cls: 'ti wide', title: d.title || d.fileName, html: esc(d.title || d.fileName) },
          { html: '<span class="chip">' + esc(d.source || '직접') + '</span>' },
          { html: '<span class="chip ' + esc(rs.chipCls) + '">' + esc(rs.label) + '</span>' },
          { html: esc(d.docDate || '-') },
          { k: 'act', html: actHtml }
        ]
      };
    });

    if ($('docsTableCard')) {
      $('docsTableCard').innerHTML = renderTable('docs', ['연도', '사업장', '서류구분', '세부유형', '문서·파일명', '출처', '검토상태', '일자', '작업'], dRows, '', {
        emptyHtml: '<div class="empty">조건에 맞는 진행·검토 서류가 없습니다.</div>'
      });
    }
  }

  /* ── 9. 탭 5: 단협·임협 신구대비 검토실 ──────────────────────────── */
  function drawReview() {
    var core = C();
    var c = caseById(CUR_ID);
    if (!c) {
      if ($('reviewTopCard')) $('reviewTopCard').innerHTML = '<div class="empty">검토할 사업장·연도 건을 먼저 등록하거나 선택하세요.</div>';
      if ($('wageSimCard')) $('wageSimCard').innerHTML = '';
      if ($('clausesCard')) $('clausesCard').innerHTML = '';
      return;
    }

    var clauses = rowsOf(D.clauses && D.clauses[c.id]);
    var simIn = c.wageSim || { headcount: 30, monthlyBaseTotal: 90000000, demandRate: 6.5, offerRate: 2.5, agreedRate: 3.8, indirectRatio: 19.5 };
    var simRes = core.simulateWageImpact(simIn);

    if ($('reviewTopCard')) {
      $('reviewTopCard').innerHTML = '<div class="sec">' +
        '<span>📝 단협·임협 신구대비 검토실</span>' +
        '<select id="revCaseSwitch" aria-label="검토 대상 사업장 선택">' + MERGED_CASES.map(function (mc) {
          var lblTi = mc.title || (core.TRACKS[mc.track] && core.TRACKS[mc.track].short) || '노사건';
          return '<option value="' + esc(mc.id) + '"' + (mc.id === c.id ? ' selected' : '') + '>' + esc((mc.year || '-') + '년 | ' + (mc.companyName || '미분류') + ' — ' + lblTi) + '</option>';
        }).join('') + '</select>' +
        '<span class="sp"></span>' +
        '<button type="button" class="sm ok" id="revDlHwpxBtn">📄 신구대비 검토서 HWPX</button>' +
        '<button type="button" class="sm" id="revDlCsvBtn">📊 CSV 내려받기</button>' +
        '<button type="button" class="sm" id="revHangulBtn">📝 푸른한글 열기</button>' +
        '<button type="button" class="sm" id="revPrintBtn">🖨️ 인쇄</button>' +
      '</div>';
    }

    var fmtW = function (n) { return Number(n || 0).toLocaleString('ko-KR') + '원'; };
    if ($('wageSimCard')) {
      $('wageSimCard').innerHTML =
        '<div class="sec"><span>💰 임금협상 원가 · 인상률 시뮬레이터</span><span class="sp"></span><button type="button" class="sm pri" id="saveWageSimBtn">시뮬레이션 저장</button></div>' +
        '<div class="sim-grid">' +
          '<div class="sim-cell"><label for="simHeadcount">대상 인원(명)</label><input type="number" id="simHeadcount" value="' + esc(simIn.headcount) + '"></div>' +
          '<div class="sim-cell"><label for="simMonthlyBase">월 기본급 총액(원)</label><input type="number" id="simMonthlyBase" value="' + esc(simIn.monthlyBaseTotal) + '"></div>' +
          '<div class="sim-cell"><label for="simDemandRate">노조 요구 인상률(%)</label><input type="number" step="0.1" id="simDemandRate" value="' + esc(simIn.demandRate) + '"></div>' +
          '<div class="sim-cell"><label for="simOfferRate">사측 제시 인상률(%)</label><input type="number" step="0.1" id="simOfferRate" value="' + esc(simIn.offerRate) + '"></div>' +
          '<div class="sim-cell"><label for="simAgreedRate">예상·타결률(%)</label><input type="number" step="0.1" id="simAgreedRate" value="' + esc(simIn.agreedRate) + '"></div>' +
          '<div class="sim-cell"><label for="simIndirect">간접인건비 비율(%)</label><input type="number" step="0.1" id="simIndirect" value="' + esc(simIn.indirectRatio) + '"></div>' +
        '</div>' +
        '<div class="sim-res" id="simResultGrid">' +
          '<div class="kpi k-red"><span>노조안 연 총소요</span><b>' + fmtW(simRes.demand.annualTotalWithIndirect) + '</b></div>' +
          '<div class="kpi k-blue"><span>사측안 연 총소요</span><b>' + fmtW(simRes.offer.annualTotalWithIndirect) + '</b></div>' +
          '<div class="kpi k-green"><span>타결안 연 총소요</span><b>' + fmtW(simRes.agreed.annualTotalWithIndirect) + '</b></div>' +
          '<div class="kpi k-amber"><span>노사 격차(연)</span><b>' + fmtW(simRes.annualGap) + ' (' + simRes.rateGapPct + '%p)</b></div>' +
        '</div>';
    }

    var clRows = clauses.map(function (cl) {
      var catLbl = (core.CLAUSE_CATEGORIES[cl.category] && core.CLAUSE_CATEGORIES[cl.category].label) || cl.category || '-';
      var stObj = core.CLAUSE_STATES[cl.state] || core.CLAUSE_STATES.pending;
      return {
        id: cl.id,
        cells: [
          { html: '<b>' + esc(cl.articleNo || '-') + '</b>' },
          { html: '<span class="chip">' + esc(catLbl) + '</span>' },
          { cls: 'ti', title: cl.topic, html: esc(cl.topic || '-') },
          { title: cl.currentText, html: esc(cl.currentText || '-') },
          { title: cl.unionDemand, html: esc(cl.unionDemand || '-') },
          { title: cl.companyOffer, html: esc(cl.companyOffer || '-') },
          { cls: 'wide', title: cl.opinion, html: esc(cl.opinion || '-') },
          { html: '<span class="chip ' + esc(stObj.chipCls) + '">' + esc(stObj.label) + '</span>' },
          { k: 'act', html:
            '<button type="button" class="sm" data-edit-clause="' + esc(cl.id) + '">수정</button> ' +
            '<button type="button" class="sm danger" data-del-clause="' + esc(cl.id) + '">삭제</button>' }
        ]
      };
    });

    if ($('clausesCard')) {
      $('clausesCard').innerHTML =
        '<div class="sec"><span>⚖️ 조문별 3단 신구조문대비표 (' + clauses.length + '건)</span><span class="sp"></span><button type="button" class="sm pri" id="newClauseBtn">+ 조문·쟁점 추가</button></div>' +
        renderTable('clauses', ['조문', '분야', '핵심쟁점', '현행(단협·규정)', '노조 요구안', '사측 수정안', '검토의견', '상태', '작업'], clRows, '', {
          emptyHtml: '<div class="empty">등록된 신구조문 비교 항목이 없습니다. <b>[+ 조문·쟁점 추가]</b>를 눌러 단협·임협 쟁점을 정리하세요.</div>'
        });
    }
  }

  function draw() {
    document.querySelectorAll('#tabs button[data-tab]').forEach(function (b) {
      var on = b.getAttribute('data-tab') === TAB;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      b.setAttribute('tabindex', on ? '0' : '-1');
    });
    document.querySelectorAll('main .pane').forEach(function (p) {
      p.classList.toggle('on', p.id === 'p-' + TAB);
    });
    if (TAB === 'dashboard') drawDashboard();
    else if (TAB === 'workspace') drawWorkspace();
    else if (TAB === 'mails') drawMails();
    else if (TAB === 'docs') drawDocs();
    else if (TAB === 'review') drawReview();
  }

  /* ── 10. 모달 폼 · 메일 실시간 열람(peek:1) · 서버 심층검색 ────────── */
  var LAST_MODAL_FOCUS = null;
  function openModal(html, isWide) {
    MODAL_SEQ++;
    var m = $('modal'), box = $('mbox');
    if (!m || !box) return;
    LAST_MODAL_FOCUS = typeof document !== 'undefined' ? document.activeElement : null;
    box.className = 'mbox' + (isWide ? ' wide' : '');
    box.innerHTML = html;
    m.style.display = 'flex';
    var firstInput = box.querySelector('input:not([type="hidden"]):not([type="file"]), select, textarea');
    if (firstInput && typeof firstInput.focus === 'function') firstInput.focus();
    else if (typeof box.focus === 'function') box.focus();
  }
  function closeModal() {
    MODAL_SEQ++;
    if ($('modal')) $('modal').style.display = 'none';
    if (LAST_MODAL_FOCUS && typeof LAST_MODAL_FOCUS.focus === 'function') {
      try { LAST_MODAL_FOCUS.focus(); } catch (_) {}
    }
    LAST_MODAL_FOCUS = null;
  }

  async function callMailFn(fnName, body) {
    var u = fb && fb.auth && fb.auth().currentUser;
    if (!u) throw new Error('로그인이 필요합니다.');
    var tok = await u.getIdToken();
    var r = await fetch(MB_FN + fnName, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok },
      body: JSON.stringify(body)
    });
    var j = await r.json().catch(function () { return {}; });
    if (!j || !j.ok) throw new Error((j && j.error) || '메일 서버 요청 실패');
    return j;
  }

  async function runImapDeepScan() {
    var reqEpoch = SESSION_EPOCH, reqUid = ME.uid;
    var queries = ['단체교섭', '임금협상', '창구단일화', '노사협의회'];
    toast('🔍 다음메일 서버 전체 폴더에서 노사·교섭 메일을 심층 검색 중입니다…');
    var added = 0;
    for (var qi = 0; qi < queries.length; qi++) {
      try {
        var j = await callMailFn('searchMailbox', { q: queries[qi] });
        if (!isSessionCurrent(reqEpoch, reqUid)) return;
        var hit = j.hit || {};
        var slugs = Object.keys(hit);
        for (var si = 0; si < slugs.length; si++) {
          var slug = slugs[si];
          var fInfo = D.mailFolders[slug] || {};
          var uids = arr(hit[slug]).slice(0, 15);
          for (var ui = 0; ui < uids.length; ui++) {
            var uid = String(uids[ui]);
            var key = 'i:' + slug + ':' + uid;
            if (D.mailMsgs[slug] && D.mailMsgs[slug][uid]) continue;
            if (D.imapHitKeys[key]) continue;
            D.imapHitKeys[key] = 1;
            try {
              var msg = await callMailFn('readMailMessage', { slug: slug, uid: uid, peek: 1 });
              if (!isSessionCurrent(reqEpoch, reqUid)) return;
              var attNames = arr(msg.atts).map(function (a) { return str(a.name); }).filter(Boolean);
              var rawTs = Number(msg.d || msg.ts || 0) || (msg.date ? Date.parse(msg.date) : 0) || 0;
              var rawYmd = rawTs ? C().ymdOf(rawTs) : str(msg.date).slice(0, 10);
              D.extraMailRows.push({
                key: key, slug: slug, folderName: str(fInfo.name || slug), uid: uid,
                dir: fInfo.kind === 'sent' ? 'out' : 'in', ts: rawTs, date: rawYmd, fromName: '', fromAddr: '', toAddr: '', toName: '',
                extAddrs: [], subject: str(msg.subject) || ('[' + queries[qi] + ' #' + uid + ']'),
                preview: str(msg.text).slice(0, 200), attCount: attNames.length, attNames: attNames
              });
              added++;
            } catch (_) {}
          }
        }
      } catch (err) {
        toast('서버 심층검색 오류: ' + ((err && err.message) || err));
        return;
      }
    }
    rebuildDerived();
    draw();
    toast('✅ 서버 심층검색 완료: 미러 밖 과거 메일 ' + added + '건 추가 확인');
  }

  async function openMailViewerModal(mailKey) {
    var ml = SCAN_RES.unionMails.find(function (m) { return m.key === mailKey; });
    if (!ml) return;
    var reqSeq = MODAL_SEQ + 1;
    var isOld = !!ml.old || ml.slug === '*old' || str(ml.key).indexOf('p:') === 0;
    openModal(
      '<div class="mhd"><span id="mhdTitle">📧 메일 본문 · 첨부 열람' + (isOld ? ' <span class="chip">지난메일(POP3)</span>' : '') + '</span><span class="sp"></span><button type="button" class="sm" data-mclose="1">닫기</button></div>' +
      '<div class="mbd"><p><b>' + esc(ml.subject) + '</b></p><p class="hint">' + esc(ml.date || '-') + ' · ' + esc(ml.companyName || '') + ' · ' + esc(ml.fromAddr || ml.fromName || '') + '</p>' +
      '<div id="mMailAtts" class="att-list"></div><div id="mMailBody" class="mail-body">메일 본문을 읽음 표시 변경 없이 불러오는 중입니다…</div></div>' +
      '<div class="mft">' + (CUR_ID ? '<button type="button" class="sm pri" id="mLinkMailCaseBtn">현재 선택 건(' + esc((caseById(CUR_ID) || {}).companyName || '') + ')에 연결</button>' : '') +
      '<button type="button" data-mclose="1">닫기</button></div>',
      true
    );

    if ($('mLinkMailCaseBtn')) {
      $('mLinkMailCaseBtn').onclick = async function () {
        var c = caseById(CUR_ID);
        if (!c) return;
        var mid = 'ml_' + C().sha256Hex(ml.key).slice(0, 14);
        var rec = {
          id: mid, caseId: c.id, companyId: c.companyId || '', companyName: scrubField(c.companyName),
          mailKey: ml.key, key: ml.key, slug: ml.slug, uid: ml.uid, old: !!ml.old,
          dir: ml.dir, date: ml.date || '', subject: scrubField(ml.subject),
          track: ml.track, docGroup: ml.docGroup, docRole: ml.docRole, stepCode: ml.stepCode,
          attNames: arr(ml.attNames).map(scrubField).filter(Boolean)
        };
        try {
          var saved = await saveEntity('union_rel/mails/' + c.id + '/' + mid, rec, 'Message', null);
          if (!D.mails[c.id]) D.mails[c.id] = {};
          D.mails[c.id][mid] = saved;
          rebuildDerived();
          closeModal();
          draw();
          toast('메일을 선택 사업장 건에 연결했습니다.');
        } catch (e) { toast('연결 실패: ' + ((e && e.message) || e)); }
      };
    }

    try {
      var cacheKey = isOld ? ('old:' + ml.uid) : ('imap:' + ml.slug + ':' + ml.uid);
      var msg = MAIL_VIEW_CACHE[cacheKey];
      if (!msg) {
        msg = isOld
          ? await callMailFn('readOldMail', { key: String(ml.uid) })
          : await callMailFn('readMailMessage', { slug: ml.slug, uid: String(ml.uid), peek: 1 });
        MAIL_VIEW_CACHE[cacheKey] = msg;
      }
      if (MODAL_SEQ !== reqSeq) return;
      var bodyText = str(msg.text) || str(ml.preview) || '(본문 글자가 없습니다)';
      if ($('mMailBody')) $('mMailBody').textContent = bodyText;
      var atts = arr(msg.atts);
      if ($('mMailAtts')) {
        $('mMailAtts').innerHTML = atts.map(function (a, i) {
          return '<button type="button" class="sm" data-dl-att="' + i + '" data-part="' + esc(a.part || '') + '" data-aname="' + esc(a.name || '첨부') + '">📎 ' + esc(a.name || ('첨부 ' + (i + 1))) + ' 받기</button>';
        }).join('');
        $('mMailAtts').querySelectorAll('[data-dl-att]').forEach(function (btn) {
          btn.onclick = async function () {
            try {
              var idx = Number(this.getAttribute('data-dl-att'));
              var part = this.getAttribute('data-part') || '';
              var nm = this.getAttribute('data-aname') || '첨부';
              var aj = isOld
                ? await callMailFn('readOldMail', { key: String(ml.uid), index: idx })
                : await callMailFn('readMailAttachment', { slug: ml.slug, uid: String(ml.uid), index: idx, part: part });
              var bin = atob(aj.b64 || '');
              var u8 = new Uint8Array(bin.length);
              for (var k = 0; k < bin.length; k++) u8[k] = bin.charCodeAt(k);
              var blob = new Blob([u8], { type: aj.mime || 'application/octet-stream' });
              var url = URL.createObjectURL(blob);
              var a = document.createElement('a');
              a.href = url; a.download = aj.name || nm;
              document.body.appendChild(a); a.click(); a.remove();
              setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
            } catch (err) { toast('첨부 다운로드 실패: ' + ((err && err.message) || err)); }
          };
        });
      }
    } catch (e) {
      if ($('mMailBody')) $('mMailBody').textContent = (ml.preview ? ('[요약 미리보기]\n' + ml.preview + '\n\n') : '') + '서버 원문 열람 안내: ' + ((e && e.message) || e);
    }
  }

  function openCaseModal(existing, fromBundle) {
    var core = C();
    var c = existing || {};
    var b = fromBundle || null;
    var initCo = b ? b.companyName : (c.companyName || '');
    var initCid = b ? b.companyId : (c.companyId || '');
    var initYr = b ? b.year : (c.year || String(new Date().getFullYear()));
    var initTr = b ? b.track : (c.track || 'bargain');
    var initPm = b ? b.performMode : (c.performMode || 'review_advisory');
    var initTi = b ? b.suggestedTitle : (c.title || (initYr + '년 단체교섭'));

    var coOpts = D.companies.map(function (co) {
      return '<option value="' + esc(co.name) + '"></option>';
    }).join('');

    openModal(
      '<div class="mhd"><span id="mhdTitle">' + (existing ? '✏️ 교섭·노사관계 건 수정' : '➕ 신규 노사관계·단체교섭 등록') + '</span><span class="sp"></span><button type="button" class="sm" data-mclose="1">닫기</button></div>' +
      '<div class="mbd">' +
        '<datalist id="urCoList">' + coOpts + '</datalist>' +
        '<div class="fr"><label for="mCoName">사업장명*</label><div class="fv"><input type="text" id="mCoName" list="urCoList" value="' + esc(initCo) + '" placeholder="사업장명 입력 또는 선택"></div></div>' +
        '<div class="fr"><label for="mYear">대상 연도*</label><div class="fv"><input type="text" id="mYear" value="' + esc(initYr) + '" placeholder="2026"></div></div>' +
        '<div class="fr"><label for="mTitle">교섭 건명*</label><div class="fv"><input type="text" id="mTitle" value="' + esc(initTi) + '"></div></div>' +
        '<div class="fr"><label for="mUnion">노조·상급단체</label><div class="fv"><input type="text" id="mUnion" value="' + esc(c.unionName || '') + '" placeholder="예: 전국금속노조 OO지회"></div></div>' +
        '<div class="fr"><label for="mTrack">유형 트랙</label><div class="fv"><select id="mTrack">' + core.TRACK_ORDER.map(function (tk) {
          return '<option value="' + esc(tk) + '"' + (initTr === tk ? ' selected' : '') + '>' + esc(core.TRACKS[tk].name) + '</option>';
        }).join('') + '</select></div></div>' +
        '<div class="fr"><label for="mPerf">수행 유형</label><div class="fv"><select id="mPerf">' + Object.keys(core.PERFORM_MODES).map(function (pk) {
          return '<option value="' + esc(pk) + '"' + (initPm === pk ? ' selected' : '') + '>' + esc(core.PERFORM_MODES[pk].label) + '</option>';
        }).join('') + '</select></div></div>' +
        '<div class="fr"><label for="mStatus">진행 상태</label><div class="fv"><select id="mStatus">' + Object.keys(core.STATUSES).map(function (sk) {
          return '<option value="' + esc(sk) + '"' + ((c.status || 'active') === sk ? ' selected' : '') + '>' + esc(core.STATUSES[sk].label) + '</option>';
        }).join('') + '</select></div></div>' +
        '<div class="fr"><label for="mMgr">담당 노무사</label><div class="fv"><select id="mMgr"><option value="">미배정</option>' + STAFF.map(function (s) {
          return '<option value="' + esc(s.sid) + '"' + ((c.managerMain || ME.sid) === s.sid ? ' selected' : '') + '>' + esc(s.name) + '</option>';
        }).join('') + '</select></div></div>' +
        '<div class="fr"><label for="mDemandDate">교섭요구일</label><div class="fv"><input type="date" id="mDemandDate" value="' + esc(c.demandDate || (b ? b.earliestDate : '')) + '"></div></div>' +
        '<div class="fr"><label for="mAgreedDate">합의·체결일</label><div class="fv"><input type="date" id="mAgreedDate" value="' + esc(c.agreedDate || '') + '"></div></div>' +
        '<div class="fr"><label for="mNote">핵심 메모</label><div class="fv"><textarea id="mNote" rows="3">' + esc(c.summaryNote || '') + '</textarea></div></div>' +
      '</div>' +
      '<div class="mft"><button type="button" data-mclose="1">취소</button><button type="button" class="pri" id="mSaveCaseBtn">저장</button></div>'
    );

    $('mSaveCaseBtn').onclick = async function () {
      var coNm = scrubField($('mCoName').value);
      var yrMatch = /(20\d{2})/.exec(str($('mYear').value));
      var yr = yrMatch ? yrMatch[1] : String(new Date().getFullYear());
      var ti = scrubField($('mTitle').value) || (yr + '년 단체교섭');
      if (!coNm) { toast('사업장명을 입력하세요.'); return; }
      var matchedCo = D.companies.find(function (co) { return core.normCorpName(co.name) === core.normCorpName(coNm); });
      var cid = existing ? existing.id : ('ur_' + core.sha256Hex(coNm + '|' + yr + '|' + Date.now()).slice(0, 14));
      var sameOldCo = existing && core.normCorpName(existing.companyName) === core.normCorpName(coNm);
      var nextCompanyId = matchedCo ? matchedCo.id : (b ? (initCid || '') : (sameOldCo ? (existing.companyId || '') : ''));
      var bundleMailLinks = b ? arr(b.mails).map(function (m) {
        return { key: m.key, date: str(m.date), subject: scrubField(m.subject).slice(0, 80) };
      }) : (existing && Array.isArray(existing.mailLinks) ? existing.mailLinks : undefined);
      var rec = {
        id: cid,
        companyId: nextCompanyId,
        companyName: scrubField(matchedCo ? matchedCo.name : coNm),
        year: yr,
        title: ti,
        unionName: scrubField($('mUnion').value),
        track: $('mTrack').value,
        performMode: $('mPerf').value,
        status: $('mStatus').value,
        managerMain: $('mMgr').value,
        demandDate: $('mDemandDate').value,
        agreedDate: $('mAgreedDate').value,
        receiveDate: $('mDemandDate').value || (b ? b.earliestDate : core.ymdOf(Date.now())),
        summaryNote: scrubField($('mNote').value),
        steps: existing ? existing.steps : (b ? b.steps : core.buildCaseStepsDefault()),
        mailLinks: bundleMailLinks
      };
      try {
        var saved = await saveEntity('union_rel/cases/' + cid, rec, 'Case', existing || null, { patch: !!existing });
        D.cases[cid] = saved;
        if (b && b.docs && b.docs.length) {
          for (var di = 0; di < b.docs.length; di++) {
            var bd = b.docs[di];
            var cleanFn = scrubField(bd.fileName) || ('서류_' + (di + 1));
            var did = 'ud_' + core.sha256Hex(cid + '|' + bd.fileName + '|' + di).slice(0, 14);
            var dRec = {
              id: did, caseId: cid, companyId: saved.companyId, companyName: saved.companyName, year: yr,
              group: bd.group, role: bd.role, roleLabel: bd.roleLabel, stepCode: bd.stepCode,
              title: cleanFn, fileName: cleanFn, source: '메일 자동수집',
              reviewState: bd.group === 'signed' ? 'final' : 'pending', docDate: bd.docDate || '', mailKey: bd.mailKey || ''
            };
            var savedD = await saveEntity('union_rel/docs/' + cid + '/' + did, dRec, 'Document', null);
            if (!D.docs[cid]) D.docs[cid] = {};
            D.docs[cid][did] = savedD;
          }
        }
        CUR_ID = cid;
        rebuildDerived();
        closeModal();
        draw();
        toast('✅ 노사관계·단체교섭 건을 저장했습니다.');
      } catch (e) { toast('저장 실패: ' + ((e && e.message) || e)); }
    };
  }

  function openDocModal(existingDoc, targetCaseId) {
    var core = C();
    var c = caseById(targetCaseId || (existingDoc && existingDoc.caseId) || CUR_ID);
    if (existingDoc && existingDoc.isDb && (!existingDoc.caseId || !caseById(existingDoc.caseId))) {
      toast('삭제(휴지통)되었거나 존재하지 않는 사업장 사건의 서류입니다.');
      return;
    }
    var d = existingDoc || {};
    var initRole = d.role || 'legal_opinion';
    openModal(
      '<div class="mhd"><span id="mhdTitle">' + (existingDoc ? '✏️ 서류·검토 메모 수정' : '📁 교섭 진행·검토 서류 등록') + '</span><span class="sp"></span><button type="button" class="sm" data-mclose="1">닫기</button></div>' +
      '<div class="mbd">' +
        '<div class="fr"><label for="mDocCase">대상 사업장</label><div class="fv"><select id="mDocCase">' + MERGED_CASES.map(function (mc) {
          var lblTi = mc.title || (core.TRACKS[mc.track] && core.TRACKS[mc.track].short) || '노사건';
          return '<option value="' + esc(mc.id) + '"' + ((c && c.id === mc.id) ? ' selected' : '') + '>' + esc((mc.year || '-') + '년 | ' + (mc.companyName || '미분류') + ' — ' + lblTi) + '</option>';
        }).join('') + '</select></div></div>' +
        '<div class="fr"><label for="mDocRole">세부 서류유형</label><div class="fv"><select id="mDocRole">' + Object.keys(core.DOC_ROLES).map(function (rk) {
          var ro = core.DOC_ROLES[rk];
          return '<option value="' + esc(rk) + '"' + (initRole === rk ? ' selected' : '') + '>' + esc(core.DOC_GROUPS[ro.group].short + ' · ' + ro.label) + '</option>';
        }).join('') + '</select></div></div>' +
        '<div class="fr"><label for="mDocRevState">검토 상태</label><div class="fv"><select id="mDocRevState">' + Object.keys(core.REVIEW_STATES).map(function (sk) {
          return '<option value="' + esc(sk) + '"' + ((d.reviewState || 'pending') === sk ? ' selected' : '') + '>' + esc(core.REVIEW_STATES[sk].label) + '</option>';
        }).join('') + '</select></div></div>' +
        '<div class="fr"><label for="mDocTitle">문서·파일명*</label><div class="fv"><input type="text" id="mDocTitle" value="' + esc(d.title || d.fileName || '') + '" placeholder="예: 2026 단협 노조요구안 법률검토 의견서"></div></div>' +
        '<div class="fr"><label for="mDocDate">문서 일자</label><div class="fv"><input type="date" id="mDocDate" value="' + esc(d.docDate || core.ymdOf(Date.now())) + '"></div></div>' +
        '<div class="fr"><label for="mDocFilePick">파일 내용 추출</label><div class="fv"><input type="file" id="mDocFilePick" accept=".hwpx,.docx,.txt,.md,.csv"></div></div>' +
        '<div class="fr"><label for="mDocMemo">검토 요지·메모</label><div class="fv"><textarea id="mDocMemo" rows="4">' + esc(d.memo || '') + '</textarea></div></div>' +
      '</div>' +
      '<div class="mft">' +
        (existingDoc && existingDoc.isDb ? '<button type="button" class="danger" id="mDelDocBtn" style="margin-right:auto">삭제</button>' : '') +
        '<button type="button" data-mclose="1">취소</button><button type="button" class="pri" id="mSaveDocBtn">저장</button></div>'
    );

    if ($('mDelDocBtn') && existingDoc && existingDoc.isDb) {
      $('mDelDocBtn').onclick = async function () {
        try {
          await softDeleteEntity('union_rel/docs/' + existingDoc.caseId + '/' + existingDoc.id, existingDoc, 'Document');
          if (D.docs[existingDoc.caseId]) delete D.docs[existingDoc.caseId][existingDoc.id];
          rebuildDerived();
          closeModal();
          draw();
          toast('서류를 삭제(휴지통) 처리했습니다.');
        } catch (e) { toast('서류 삭제 실패: ' + ((e && e.message) || e)); }
      };
    }

    if ($('mDocFilePick')) {
      $('mDocFilePick').onchange = async function () {
        var f = this.files && this.files[0];
        if (!f) return;
        if (!$('mDocTitle').value) $('mDocTitle').value = f.name;
        var buf = new Uint8Array(await f.arrayBuffer());
        var ex = await H().extractDocumentText(buf, f.name);
        if (ex && ex.ok && ex.text) {
          $('mDocMemo').value = ex.text.slice(0, 1200);
          toast('문서 텍스트를 비식별 가림 후 요약했습니다.');
        }
      };
    }

    $('mSaveDocBtn').onclick = async function () {
      var cid = $('mDocCase').value;
      var targetC = caseById(cid);
      if (!targetC) { toast('대상 사업장을 선택하세요.'); return; }
      var title = scrubField($('mDocTitle').value);
      if (!title) { toast('문서·파일명을 입력하세요.'); return; }
      var rk = $('mDocRole').value;
      var ro = core.DOC_ROLES[rk] || core.DOC_ROLES.legal_opinion;
      var isSameCase = !!(existingDoc && existingDoc.isDb && existingDoc.caseId === cid);
      var did = (existingDoc && existingDoc.isDb) ? existingDoc.id : ('ud_' + core.sha256Hex(cid + '|' + title + '|' + Date.now()).slice(0, 14));
      var rec = {
        id: did, caseId: cid, companyId: targetC.companyId || '', companyName: scrubField(targetC.companyName), year: targetC.year,
        group: ro.group, role: ro.code, roleLabel: ro.label, stepCode: ro.stepCode,
        title: title, fileName: title, source: d.source || '직접 등록',
        reviewState: $('mDocRevState').value, docDate: $('mDocDate').value,
        memo: scrubField($('mDocMemo').value)
      };
      try {
        var saved = await saveEntity('union_rel/docs/' + cid + '/' + did, rec, 'Document', isSameCase ? existingDoc : null, { patch: isSameCase });
        if (existingDoc && existingDoc.isDb && existingDoc.caseId && existingDoc.caseId !== cid) {
          await softDeleteEntity('union_rel/docs/' + existingDoc.caseId + '/' + existingDoc.id, existingDoc, 'Document');
          if (D.docs[existingDoc.caseId]) delete D.docs[existingDoc.caseId][existingDoc.id];
        }
        if (!D.docs[cid]) D.docs[cid] = {};
        D.docs[cid][did] = saved;
        rebuildDerived();
        closeModal();
        draw();
        toast('✅ 서류·검토 기록을 저장했습니다.');
      } catch (e) { toast('서류 저장 실패: ' + ((e && e.message) || e)); }
    };
  }

  function openClauseModal(existing) {
    var core = C();
    var c = caseById(CUR_ID);
    if (!c) return;
    var cl = existing || {};
    openModal(
      '<div class="mhd"><span id="mhdTitle">' + (existing ? '✏️ 조문 신구대비 수정' : '➕ 신구조문대비 항목 추가') + '</span><span class="sp"></span><button type="button" class="sm" data-mclose="1">닫기</button></div>' +
      '<div class="mbd">' +
        '<div class="fr"><label for="mClArt">조문 번호*</label><div class="fv"><input type="text" id="mClArt" value="' + esc(cl.articleNo || '') + '" placeholder="예: 제32조"></div></div>' +
        '<div class="fr"><label for="mClCat">쟁점 분야</label><div class="fv"><select id="mClCat">' + Object.keys(core.CLAUSE_CATEGORIES).map(function (k) {
          return '<option value="' + esc(k) + '"' + ((cl.category || 'wage') === k ? ' selected' : '') + '>' + esc(core.CLAUSE_CATEGORIES[k].label) + '</option>';
        }).join('') + '</select></div></div>' +
        '<div class="fr"><label for="mClTopic">핵심 쟁점*</label><div class="fv"><input type="text" id="mClTopic" value="' + esc(cl.topic || '') + '" placeholder="예: 근로시간면제 한도 및 유급조합활동"></div></div>' +
        '<div class="fr"><label for="mClCur">현행(단협·규정)</label><div class="fv"><textarea id="mClCur" rows="2">' + esc(cl.currentText || '') + '</textarea></div></div>' +
        '<div class="fr"><label for="mClUnion">노조 요구안</label><div class="fv"><textarea id="mClUnion" rows="2">' + esc(cl.unionDemand || '') + '</textarea></div></div>' +
        '<div class="fr"><label for="mClComp">사측 수정안</label><div class="fv"><textarea id="mClComp" rows="2">' + esc(cl.companyOffer || '') + '</textarea></div></div>' +
        '<div class="fr"><label for="mClOp">법리·원가 의견</label><div class="fv"><textarea id="mClOp" rows="3">' + esc(cl.opinion || '') + '</textarea></div></div>' +
        '<div class="fr"><label for="mClSt">타결 상태</label><div class="fv"><select id="mClSt">' + Object.keys(core.CLAUSE_STATES).map(function (k) {
          return '<option value="' + esc(k) + '"' + ((cl.state || 'discussed') === k ? ' selected' : '') + '>' + esc(core.CLAUSE_STATES[k].label) + '</option>';
        }).join('') + '</select></div></div>' +
      '</div>' +
      '<div class="mft"><button type="button" data-mclose="1">취소</button><button type="button" class="pri" id="mSaveClBtn">저장</button></div>'
    );
    $('mSaveClBtn').onclick = async function () {
      var art = scrubField($('mClArt').value), topic = scrubField($('mClTopic').value);
      if (!art || !topic) { toast('조문 번호와 핵심 쟁점을 입력하세요.'); return; }
      var id = existing ? existing.id : ('cl_' + core.sha256Hex(c.id + '|' + art + '|' + Date.now()).slice(0, 14));
      var rec = {
        id: id, caseId: c.id, companyId: c.companyId || '', companyName: scrubField(c.companyName), year: c.year,
        articleNo: art, category: $('mClCat').value, topic: topic,
        currentText: scrubField($('mClCur').value),
        unionDemand: scrubField($('mClUnion').value),
        companyOffer: scrubField($('mClComp').value),
        opinion: scrubField($('mClOp').value),
        state: $('mClSt').value
      };
      try {
        var saved = await saveEntity('union_rel/clauses/' + c.id + '/' + id, rec, 'Document', existing || null, { patch: !!existing });
        if (!D.clauses[c.id]) D.clauses[c.id] = {};
        D.clauses[c.id][id] = saved;
        rebuildDerived();
        closeModal();
        draw();
        toast('✅ 조문 비교 항목을 저장했습니다.');
      } catch (e) { toast('저장 실패: ' + ((e && e.message) || e)); }
    };
  }

  function openRoundModal() {
    var c = caseById(CUR_ID);
    if (!c) return;
    var nextNo = arr(c.rounds).length + 1;
    openModal(
      '<div class="mhd"><span id="mhdTitle">🗣️ 교섭 회차 진행 일지 추가</span><span class="sp"></span><button type="button" class="sm" data-mclose="1">닫기</button></div>' +
      '<div class="mbd">' +
        '<div class="fr"><label for="mRndNo">회차 번호</label><div class="fv"><input type="number" id="mRndNo" value="' + nextNo + '"></div></div>' +
        '<div class="fr"><label for="mRndDate">일자</label><div class="fv"><input type="date" id="mRndDate" value="' + esc(C().ymdOf(Date.now())) + '"></div></div>' +
        '<div class="fr"><label for="mRndKind">교섭 구분</label><div class="fv"><select id="mRndKind"><option>상견례</option><option selected>본교섭</option><option>실무교섭</option><option>조정회의</option><option>노사협의회</option></select></div></div>' +
        '<div class="fr"><label for="mRndAgenda">주요 안건*</label><div class="fv"><input type="text" id="mRndAgenda" placeholder="예: 기본급 인상률 및 정년 연장 논의"></div></div>' +
        '<div class="fr"><label for="mRndResult">결과·합의사항</label><div class="fv"><input type="text" id="mRndResult" placeholder="예: 차기 교섭 시 사측 수정안 제시"></div></div>' +
        '<div class="fr"><label for="mRndMemo">상세 메모</label><div class="fv"><textarea id="mRndMemo" rows="3"></textarea></div></div>' +
      '</div>' +
      '<div class="mft"><button type="button" data-mclose="1">취소</button><button type="button" class="pri" id="mSaveRndBtn">저장</button></div>'
    );
    $('mSaveRndBtn').onclick = async function () {
      var agenda = scrubField($('mRndAgenda').value);
      if (!agenda) { toast('주요 안건을 입력하세요.'); return; }
      var raw = D.cases[c.id] || c;
      var newRound = {
        roundNo: Number($('mRndNo').value) || (arr(raw.rounds).length + 1),
        date: $('mRndDate').value,
        kind: $('mRndKind').value,
        agenda: agenda,
        result: scrubField($('mRndResult').value),
        memo: scrubField($('mRndMemo').value)
      };
      try {
        var saved = await saveEntity('union_rel/cases/' + c.id, {}, 'Case', raw, { patch: true, appendRound: newRound });
        D.cases[c.id] = saved;
        rebuildDerived();
        closeModal();
        draw();
        toast('✅ 교섭 회차 일지를 추가했습니다.');
      } catch (e) { toast('저장 실패: ' + ((e && e.message) || e)); }
    };
  }

  /* ── 11. 로컬 폴더 스캔 (File System Access API / webkitdirectory) ── */
  async function ingestLocalFileList(filePairs, rootName) {
    var core = C();
    var out = [];
    filePairs.forEach(function (pair) {
      var rel = str(pair.relPath || pair.name);
      var fn = str(pair.name);
      if (!fn || /^~\$|\.lnk$|\.tmp$/i.test(fn)) return;
      var yr = core.extractYear(rel, [fn], '');
      /* 하위 폴더명에서 사업장 추정 */
      var segs = rel.split('/').filter(Boolean);
      var coHint = '';
      for (var i = segs.length - 2; i >= 0; i--) {
        var sg = segs[i];
        if (!/^(?:7\.?교섭관련|20\d{2}(?:\.\s*단체교섭)?|0\.\s*단협강의자료|1\.\s*노동조합설립자료|노동쟁의조정신청서|단협프로세스ppt|집단관계)$/i.test(sg)) {
          coHint = sg.replace(/20\d{2}/g, '').replace(/(?:단체교섭|임단협|요구안|송부|노사관계대응시나리오|교섭|창구단일화|관련\s*자료)/g, '').trim();
          if (coHint.length >= 2) break;
        }
      }
      if (!coHint && /강의|교재|모범안|조정절차|프로세스/.test(rel)) coHint = '공통 참고자료';
      out.push({
        sig: rel + '|' + (pair.fileObj ? pair.fileObj.size : 0),
        fileName: fn,
        folderHint: segs.slice(0, -1).join(' '),
        year: yr,
        companyName: coHint || '미분류 사업장',
        fileObj: pair.fileObj || null
      });
    });
    LOCAL_FOLDER = { name: rootName || '선택 폴더', files: out, handle: LOCAL_FOLDER.handle };
    rebuildDerived();
    TAB = 'docs';
    draw();
    toast('📂 로컬 교섭폴더(' + LOCAL_FOLDER.name + ')에서 ' + out.length + '건의 서류를 분류했습니다.');
  }

  /* ── 12. 전역 이벤트 위임 ─────────────────────────────────────────── */
  function bindEvents() {
    document.addEventListener('click', async function (ev) {
      var t = ev.target;

      /* 컬럼 필터 팝업 바깥 클릭 닫기 */
      var pop = document.getElementById('urThPop');
      if (pop && !pop.contains(t) && !t.closest('[data-th-col]')) closeThPop();

      /* 모달 닫기 */
      if (t.closest('[data-mclose]')) { closeModal(); return; }
      if (t === $('modal')) { closeModal(); return; }

      /* 최근 변경 안내 바 점프 / 토글 */
      if (t.id === 'diffToggleBtn') {
        SHOW_DIFF_HIGHLIGHT = !SHOW_DIFF_HIGHLIGHT;
        try { localStorage.setItem('pu_diff_bar_unionrel', SHOW_DIFF_HIGHLIGHT ? 'on' : 'off'); } catch (_) {}
        renderRecentDiffBar();
        return;
      }
      var diffGo = t.closest('[data-diff-go]');
      if (diffGo) {
        var chKey = diffGo.getAttribute('data-diff-go');
        var ch = RECENT_CODE_CHANGES.find(function (x) { return x.key === chKey; });
        if (ch) {
          TAB = ch.tab;
          draw();
          var targetEl = document.querySelector(ch.target);
          if (targetEl && targetEl.scrollIntoView) targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        return;
      }

      /* 탭 전환 */
      var tabBtn = t.closest('#tabs button[data-tab]');
      if (tabBtn) {
        TAB = tabBtn.getAttribute('data-tab');
        draw();
        return;
      }

      /* 컬럼 머리글 정렬/필터 */
      var thCol = t.closest('[data-th-col]');
      if (thCol) {
        openColFilterPop(thCol.getAttribute('data-th-col'), thCol);
        return;
      }

      /* 트랙 · 연도 알약 · 서류구분 클릭 */
      var trBtn = t.closest('#trackBar button[data-track]');
      if (trBtn) { TRACK_FILTER = trBtn.getAttribute('data-track') || ''; draw(); return; }
      var yrBtn = t.closest('[data-yr]');
      if (yrBtn) { YEAR_FILTER = yrBtn.getAttribute('data-yr') || ''; draw(); return; }
      var dgBtn = t.closest('[data-doc-grp]');
      if (dgBtn) { DOC_GROUP_FILTER = dgBtn.getAttribute('data-doc-grp') || ''; draw(); return; }

      /* KPI 카드 액션 */
      var kpiBtn = t.closest('.kpi[data-act]');
      if (kpiBtn) {
        var actK = kpiBtn.getAttribute('data-act'), idK = kpiBtn.getAttribute('data-id') || '';
        if (actK === 'kpiTrack') {
          TRACK_FILTER = idK;
          if (!idK) {
            YEAR_FILTER = '';
            COL_STATE.statuses = null;
            if ($('dashStatus')) $('dashStatus').value = '';
          }
          draw();
        } else if (actK === 'kpiStatus') {
          if (idK === 'agreed') {
            if ($('dashStatus')) $('dashStatus').value = '';
            COL_STATE.statuses = { agreed: true, closed: true };
          } else {
            COL_STATE.statuses = null;
            if ($('dashStatus')) $('dashStatus').value = idK;
          }
          draw();
        } else if (actK === 'goTab') { TAB = idK; draw(); }
        else if (actK === 'goDocGroup') { DOC_GROUP_FILTER = idK; TAB = 'docs'; draw(); }
        return;
      }

      /* 행 내부 액션 버튼 */
      var actBtn = t.closest('[data-act]');
      if (actBtn) {
        var act = actBtn.getAttribute('data-act');
        var id = actBtn.getAttribute('data-id') || '';
        if (act === 'openWs') { CUR_ID = id; TAB = 'workspace'; draw(); }
        else if (act === 'openRev') { CUR_ID = id; TAB = 'review'; draw(); }
        else if (act === 'editCase') { openCaseModal(D.cases[id] || caseById(id), null); }
        else if (act === 'goAddDoc') { openDocModal(null, id); }
        else if (act === 'dlSummaryHwpx') {
          var c1 = caseById(id);
          if (c1) H().downloadHwpxBytes(H().generateHwpxBytes('yearly_summary', c1, { docs: c1.linkedDocs, mails: c1.linkedMails }), H().suggestedFileName('yearly_summary', c1));
        } else if (act === 'openHangulSum') {
          var c2 = caseById(id);
          if (c2) H().openInHangulEditor('yearly_summary', c2, { docs: c2.linkedDocs, mails: c2.linkedMails });
        } else if (act === 'printSum') {
          var c3 = caseById(id);
          if (c3) H().openPrintWindow('yearly_summary', c3, { docs: c3.linkedDocs, mails: c3.linkedMails });
        } else if (act === 'dlNoticeDemand') {
          var c4 = caseById(id);
          if (c4) H().downloadHwpxBytes(H().generateHwpxBytes('channel_demand', c4), H().suggestedFileName('channel_demand', c4));
        } else if (act === 'dlNoticeConfirm') {
          var c5 = caseById(id);
          if (c5) H().downloadHwpxBytes(H().generateHwpxBytes('channel_confirm', c5), H().suggestedFileName('channel_confirm', c5));
        }
        return;
      }

      /* 메일 열람 */
      var mailBtn = t.closest('[data-open-mail]');
      if (mailBtn) { openMailViewerModal(mailBtn.getAttribute('data-open-mail')); return; }

      /* 로컬 서류 본문 추출 미리보기 */
      var locBtn = t.closest('[data-open-local-doc]');
      if (locBtn) {
        var ld = ALL_DOCS.find(function (x) { return x.id === locBtn.getAttribute('data-open-local-doc'); });
        if (ld && ld.fileObj) {
          var buf = new Uint8Array(await ld.fileObj.arrayBuffer());
          var ex = await H().extractDocumentText(buf, ld.fileName);
          openModal(
            '<div class="mhd" id="mhdTitle">📄 로컬 서류 비식별 미리보기<span class="sp"></span><button type="button" class="sm" data-mclose="1">닫기</button></div>' +
            '<div class="mbd"><p><b>' + esc(ld.fileName) + '</b></p><div class="mail-body">' + esc((ex && ex.text) || ex.error || '미리보기를 생성할 수 없는 형식입니다.') + '</div></div>' +
            '<div class="mft"><button type="button" data-mclose="1">닫기</button></div>',
            true
          );
        }
        return;
      }

      /* 서류 수정 · 조문 수정/삭제 */
      var editDoc = t.closest('[data-edit-doc]');
      if (editDoc) {
        var dObj = ALL_DOCS.find(function (x) { return x.id === editDoc.getAttribute('data-edit-doc'); });
        if (dObj) openDocModal(dObj, dObj.caseId);
        return;
      }
      var editCl = t.closest('[data-edit-clause]');
      if (editCl) {
        var cCur = caseById(CUR_ID);
        var clObj = cCur && D.clauses[cCur.id] && D.clauses[cCur.id][editCl.getAttribute('data-edit-clause')];
        if (clObj) openClauseModal(clObj);
        return;
      }
      var delCl = t.closest('[data-del-clause]');
      if (delCl) {
        var cCl = caseById(CUR_ID);
        var clId = delCl.getAttribute('data-del-clause');
        var prevCl = cCl && D.clauses[cCl.id] && D.clauses[cCl.id][clId];
        if (prevCl && askConfirm('선택한 신구대비 조문 항목(' + (prevCl.articleNo || '') + ')을 삭제(휴지통)하시겠습니까?')) {
          try {
            await softDeleteEntity('union_rel/clauses/' + cCl.id + '/' + clId, prevCl, 'Document');
            delete D.clauses[cCl.id][clId];
            rebuildDerived();
            draw();
            toast('조문을 삭제(휴지통) 처리했습니다.');
          } catch (e) { toast('조문 삭제 실패: ' + ((e && e.message) || e)); }
        }
        return;
      }

      /* 8단계 절차 수기 토글 (단일 단계만 서버 최신 값 위에 반영) */
      var stepBtn = t.closest('[data-toggle-step]');
      if (stepBtn) {
        var sc = stepBtn.getAttribute('data-toggle-step');
        var cw = caseById(CUR_ID);
        if (!cw) return;
        var raw = D.cases[cw.id];
        if (!raw) { toast('원본 사건 정보를 찾을 수 없습니다.'); return; }
        var curViewStep = (cw.steps && cw.steps[sc]) || {};
        var prevDbStep = (raw.steps && raw.steps[sc]) || curViewStep;
        var nextDone = !curViewStep.done;
        var nextStepVal = Object.assign({}, prevDbStep, {
          done: nextDone,
          manual: true,
          date: nextDone ? (prevDbStep.date || curViewStep.date || C().ymdOf(Date.now())) : (prevDbStep.date || '')
        });
        try {
          var savedStep = await saveEntity('union_rel/cases/' + cw.id, {}, 'Case', raw, {
            patch: true,
            stepPatch: { code: sc, val: nextStepVal }
          });
          D.cases[cw.id] = savedStep;
          rebuildDerived();
          draw();
        } catch (e) { toast('단계 저장 실패: ' + ((e && e.message) || e)); }
        return;
      }

      /* 미등록 묶음 등록 / 제외 */
      var regB = t.closest('[data-reg-bundle]');
      if (regB) {
        var bun = SCAN_RES.bundles.find(function (x) { return x.id === regB.getAttribute('data-reg-bundle'); });
        if (bun) openCaseModal(null, bun);
        return;
      }
      var disB = t.closest('[data-dis-bundle]');
      if (disB) {
        var b2 = SCAN_RES.bundles.find(function (x) { return x.id === disB.getAttribute('data-dis-bundle'); });
        if (b2) {
          var dRec = { id: b2.dismissId, companyId: b2.companyId || '', companyName: scrubField(b2.companyName), year: b2.year, bundleKey: scrubField(b2.bundleKey) };
          try {
            var savedDis = await saveEntity('union_rel/dismissed/' + b2.dismissId, dRec, 'Task', null);
            D.dismissed[b2.dismissId] = savedDis;
            rebuildDerived();
            draw();
            toast('해당 후보 묶음을 제외했습니다.');
          } catch (e) { toast('묶음 제외 실패: ' + ((e && e.message) || e)); }
        }
        return;
      }

      /* 회차 삭제 */
      var delR = t.closest('[data-del-round]');
      if (delR) {
        var cR = caseById(CUR_ID);
        if (!cR) return;
        var rawR = D.cases[cR.id];
        if (!rawR) return;
        var delIdx = Number(delR.getAttribute('data-del-round'));
        var nextR = arr(rawR.rounds).slice();
        if (delIdx < 0 || delIdx >= nextR.length) return;
        if (!askConfirm('선택한 ' + ((nextR[delIdx] && nextR[delIdx].roundNo) || (delIdx + 1)) + '차 교섭 회차 일지를 삭제하시겠습니까?')) return;
        nextR.splice(delIdx, 1);
        try {
          D.cases[cR.id] = await saveEntity('union_rel/cases/' + cR.id, { rounds: nextR }, 'Case', rawR, { patch: true });
          rebuildDerived();
          draw();
          toast('교섭 회차 일지를 삭제했습니다.');
        } catch (e) { toast('회차 삭제 실패: ' + ((e && e.message) || e)); }
        return;
      }

      /* 일괄 작업 */
      var bulkSt = t.closest('[data-bulk-st]');
      if (bulkSt) {
        var stVal = bulkSt.getAttribute('data-bulk-st');
        var stLbl = (C().STATUSES[stVal] && C().STATUSES[stVal].label) || stVal;
        var ids = Object.keys(SEL.cases).filter(function (k) { return SEL.cases[k] && D.cases[k]; });
        if (!ids.length) return;
        if (!askConfirm('선택한 ' + ids.length + '건의 진행 상태를 "' + stLbl + '"(으)로 일괄 변경하시겠습니까?')) return;
        bulkSt.disabled = true;
        var okSt = 0, failSt = 0;
        try {
          for (var bi = 0; bi < ids.length; bi++) {
            var rawB = D.cases[ids[bi]];
            if (!rawB) continue;
            try {
              D.cases[ids[bi]] = await saveEntity('union_rel/cases/' + rawB.id, { status: stVal }, 'Case', rawB, { patch: true });
              okSt++;
            } catch (_) { failSt++; }
          }
          if (failSt === 0) SEL.cases = {};
          rebuildDerived();
          draw();
          toast(failSt ? (okSt + '건 변경, ' + failSt + '건 실패(충돌·권한 확인)') : (okSt + '건 상태를 변경했습니다.'));
        } finally {
          bulkSt.disabled = false;
        }
        return;
      }

      /* 행 클릭 시 워크스페이스 열기 */
      var trRow = t.closest('table.t tr[data-row]');
      if (trRow && !t.closest('button, input, a')) {
        var tbl = trRow.getAttribute('data-row');
        var rId = trRow.getAttribute('data-id');
        if (tbl === 'cases') { CUR_ID = rId; TAB = 'workspace'; draw(); }
        else if (tbl === 'mails') { openMailViewerModal(rId); }
        return;
      }

      /* 주요 버튼 ID 핸들러 */
      if (t.id === 'newCaseBtn') { openCaseModal(null, null); return; }
      if (t.id === 'newDocBtn') { openDocModal(null, CUR_ID); return; }
      if (t.id === 'newClauseBtn') { openClauseModal(null); return; }
      if (t.id === 'wsAddRoundBtn') { openRoundModal(); return; }
      if (t.id === 'dashResetBtn') {
        TRACK_FILTER = ''; YEAR_FILTER = '';
        COL_STATE = { sortCol: '', sortDir: '', tracks: null, years: null, statuses: null, mgrs: null };
        ['dashQ', 'dashYear', 'dashTrack', 'dashStatus', 'dashPerf', 'dashMgr'].forEach(function (fid) { if ($(fid)) $(fid).value = ''; });
        draw();
        return;
      }
      if (t.id === 'dashCsvBtn') { H().downloadCsv(H().buildCasesCsv(getFilteredCases()), '노사관계_단체교섭_현황.csv'); return; }
      if (t.id === 'bulkCsvBtn') {
        var selList = getFilteredCases().filter(function (x) { return SEL.cases[x.id]; });
        H().downloadCsv(H().buildCasesCsv(selList), '노사관계_선택목록.csv');
        return;
      }
      if (t.id === 'bulkDelBtn') {
        var dIds = Object.keys(SEL.cases).filter(function (k) { return SEL.cases[k] && D.cases[k]; });
        if (!dIds.length) return;
        if (!askConfirm('선택한 ' + dIds.length + '건을 삭제(휴지통) 처리하시겠습니까?')) return;
        t.disabled = true;
        var okDel = 0, failDel = 0;
        try {
          for (var di = 0; di < dIds.length; di++) {
            var prevD = D.cases[dIds[di]];
            if (!prevD) continue;
            try {
              await softDeleteEntity('union_rel/cases/' + dIds[di], prevD, 'Case');
              delete D.cases[dIds[di]];
              okDel++;
            } catch (_) { failDel++; }
          }
          if (failDel === 0) SEL.cases = {};
          rebuildDerived();
          draw();
          toast(failDel ? (okDel + '건 삭제, ' + failDel + '건 실패(충돌·권한 확인)') : (okDel + '건을 삭제(휴지통) 처리했습니다.'));
        } finally {
          t.disabled = false;
        }
        return;
      }
      if (t.id === 'bulkClearBtn') { SEL.cases = {}; draw(); return; }
      if (t.id === 'importAllBundlesBtn') {
        var listB = SCAN_RES.bundles.slice(0, 50).filter(function (bu) {
          return !D.cases['ur_' + C().sha256Hex(bu.bundleKey).slice(0, 14)];
        });
        if (!listB.length) { toast('신규로 편입할 후보 묶음이 없습니다.'); return; }
        if (!askConfirm('미등록 후보 묶음 ' + listB.length + '건을 사건·서류로 일괄 편입하시겠습니까?')) return;
        t.disabled = true;
        var addedCnt = 0, failCnt = 0;
        try {
          for (var k = 0; k < listB.length; k++) {
            var bu = listB[k];
            var cid = 'ur_' + C().sha256Hex(bu.bundleKey).slice(0, 14);
            if (D.cases[cid]) continue;
            var cleanCo = scrubField(bu.companyName) || '미분류 사업장';
            var cleanTi = scrubField(bu.suggestedTitle);
            var cRec = {
              id: cid, companyId: bu.companyId || '', companyName: cleanCo, year: bu.year,
              title: cleanTi, track: bu.track, performMode: bu.performMode,
              status: 'active', managerMain: ME.sid, receiveDate: bu.earliestDate || C().ymdOf(Date.now()),
              latestDate: bu.latestDate || '', steps: bu.steps,
              mailLinks: arr(bu.mails).map(function (m) {
                return { key: m.key, date: str(m.date), subject: scrubField(m.subject).slice(0, 80) };
              })
            };
            try {
              D.cases[cid] = await saveEntity('union_rel/cases/' + cid, cRec, 'Case', null);
              for (var j = 0; j < bu.docs.length; j++) {
                var bd = bu.docs[j];
                var cleanFn = scrubField(bd.fileName) || ('서류_' + (j + 1));
                var did = 'ud_' + C().sha256Hex(cid + '|' + bd.fileName + '|' + j).slice(0, 14);
                var dRec = {
                  id: did, caseId: cid, companyId: cRec.companyId, companyName: cleanCo, year: bu.year,
                  group: bd.group, role: bd.role, roleLabel: bd.roleLabel, stepCode: bd.stepCode,
                  title: cleanFn, fileName: cleanFn, source: '메일 일괄편입',
                  reviewState: bd.group === 'signed' ? 'final' : 'pending', docDate: bd.docDate || '', mailKey: bd.mailKey || ''
                };
                if (!D.docs[cid]) D.docs[cid] = {};
                D.docs[cid][did] = await saveEntity('union_rel/docs/' + cid + '/' + did, dRec, 'Document', null);
              }
              addedCnt++;
            } catch (_) { failCnt++; }
          }
          rebuildDerived();
          draw();
          toast(failCnt ? ('⚠️ ' + addedCnt + '건 편입 완료, ' + failCnt + '건 저장 실패') : ('✅ 미등록 후보 묶음 ' + addedCnt + '건을 일괄 편입했습니다.'));
        } finally {
          t.disabled = false;
        }
        return;
      }
      if (t.id === 'wsSaveDemandDateBtn' || t.id === 'wsSaveDisputeDateBtn') {
        var cc = caseById(CUR_ID);
        if (!cc) return;
        var rawC = D.cases[cc.id];
        if (!rawC) { toast('원본 사건 정보를 찾을 수 없습니다.'); return; }
        try {
          D.cases[cc.id] = await saveEntity('union_rel/cases/' + cc.id, {
            demandDate: ($('wsDemandDateInput') && $('wsDemandDateInput').value) || '',
            disputeApplyDate: ($('wsDisputeDateInput') && $('wsDisputeDateInput').value) || '',
            isPublicService: !!($('wsPublicSvcChk') && $('wsPublicSvcChk').checked)
          }, 'Case', rawC, { patch: true });
          rebuildDerived();
          draw();
          toast('법정기일 기준일을 저장했습니다.');
        } catch (e) { toast('기일 저장 실패: ' + ((e && e.message) || e)); }
        return;
      }
      if (t.id === 'saveWageSimBtn') {
        var cs = caseById(CUR_ID);
        if (!cs) return;
        var rawS = D.cases[cs.id];
        if (!rawS) { toast('원본 사건 정보를 찾을 수 없습니다.'); return; }
        var indRaw = $('simIndirect') ? str($('simIndirect').value) : '';
        var simObj = {
          headcount: Number($('simHeadcount').value) || 0,
          monthlyBaseTotal: Number($('simMonthlyBase').value) || 0,
          demandRate: Number($('simDemandRate').value) || 0,
          offerRate: Number($('simOfferRate').value) || 0,
          agreedRate: Number($('simAgreedRate').value) || 0,
          indirectRatio: (indRaw !== '' && isFinite(Number(indRaw))) ? Math.max(0, Number(indRaw)) : 19.5
        };
        try {
          D.cases[cs.id] = await saveEntity('union_rel/cases/' + cs.id, { wageSim: simObj }, 'Case', rawS, { patch: true });
          rebuildDerived();
          draw();
          toast('임금협상 원가 시뮬레이션을 저장했습니다.');
        } catch (e) { toast('시뮬레이션 저장 실패: ' + ((e && e.message) || e)); }
        return;
      }
      if (t.id === 'revDlHwpxBtn' || t.id === 'revDlCsvBtn' || t.id === 'revHangulBtn' || t.id === 'revPrintBtn') {
        var cr = caseById(CUR_ID);
        if (!cr) return;
        var cls = rowsOf(D.clauses && D.clauses[cr.id]);
        var simSrc = cr.wageSim || null;
        if ($('simMonthlyBase')) {
          var indVal = $('simIndirect') ? str($('simIndirect').value) : '';
          simSrc = {
            headcount: Number($('simHeadcount') && $('simHeadcount').value) || 0,
            monthlyBaseTotal: Number($('simMonthlyBase').value) || 0,
            demandRate: Number($('simDemandRate') && $('simDemandRate').value) || 0,
            offerRate: Number($('simOfferRate') && $('simOfferRate').value) || 0,
            agreedRate: Number($('simAgreedRate') && $('simAgreedRate').value) || 0,
            indirectRatio: (indVal !== '' && isFinite(Number(indVal))) ? Math.max(0, Number(indVal)) : 19.5
          };
        }
        var sim = simSrc ? C().simulateWageImpact(simSrc) : null;
        if (t.id === 'revDlHwpxBtn') H().downloadHwpxBytes(H().generateHwpxBytes('review_report', cr, { clauses: cls, docs: cr.linkedDocs, wageSim: sim }), H().suggestedFileName('review_report', cr));
        else if (t.id === 'revDlCsvBtn') H().downloadCsv(H().buildClausesCsv(cr, cls), cr.companyName + '_' + cr.year + '_신구대비.csv');
        else if (t.id === 'revHangulBtn') H().openInHangulEditor('review_report', cr, { clauses: cls, docs: cr.linkedDocs, wageSim: sim });
        else if (t.id === 'revPrintBtn') H().openPrintWindow('review_report', cr, { clauses: cls, docs: cr.linkedDocs, wageSim: sim });
        return;
      }
      if (t.id === 'scanAllBtn') {
        try { await reload(SESSION_EPOCH, ME.uid); toast('이메일 전수 스캔을 다시 완료했습니다.'); }
        catch (e) { toast('새로고침 실패: ' + ((e && e.message) || e)); }
        return;
      }
      if (t.id === 'imapDeepBtn') {
        t.disabled = true;
        try { await runImapDeepScan(); } finally { t.disabled = false; }
        return;
      }
      if (t.id === 'reloadBtn') {
        try { await reload(SESSION_EPOCH, ME.uid); }
        catch (e) { toast('새로고침 실패: ' + ((e && e.message) || e)); }
        return;
      }
      if (t.id === 'linkFolderBtn') {
        if (typeof window.showDirectoryPicker === 'function') {
          try {
            var dirHandle = await window.showDirectoryPicker({ mode: 'read' });
            LOCAL_FOLDER.handle = dirHandle;
            var collected = [];
            async function walkDir(h, rel) {
              for await (var entry of h.values()) {
                var nextRel = rel ? (rel + '/' + entry.name) : entry.name;
                if (entry.kind === 'directory') await walkDir(entry, nextRel);
                else if (entry.kind === 'file') {
                  var fObj = await entry.getFile();
                  collected.push({ relPath: nextRel, name: entry.name, fileObj: fObj });
                }
              }
            }
            await walkDir(dirHandle, dirHandle.name);
            await ingestLocalFileList(collected, dirHandle.name);
          } catch (err) {
            if (err && err.name !== 'AbortError' && $('folderFallbackInput')) $('folderFallbackInput').click();
          }
        } else if ($('folderFallbackInput')) {
          $('folderFallbackInput').click();
        }
      }
    });

    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') {
        if (document.getElementById('urThPop')) { closeThPop(); ev.preventDefault(); return; }
        var m = $('modal');
        if (m && m.style.display && m.style.display !== 'none') { closeModal(); ev.preventDefault(); return; }
      }
      var t = ev.target;
      if (!t) return;
      if ((ev.key === 'Enter' || ev.key === ' ') && t.matches('[role="button"][data-act], [role="button"][data-yr]')) {
        ev.preventDefault();
        t.click();
        return;
      }
      if ((ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') && t.matches('#tabs button[role="tab"]')) {
        var tabs = Array.prototype.slice.call(document.querySelectorAll('#tabs button[role="tab"]'));
        var idx = tabs.indexOf(t);
        if (idx >= 0 && tabs.length > 1) {
          ev.preventDefault();
          var nextIdx = (idx + (ev.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length;
          tabs[nextIdx].click();
          tabs[nextIdx].focus();
        }
      }
    });

    document.addEventListener('change', function (ev) {
      var t = ev.target;
      if (t.matches('[data-sel-all]')) {
        var tbl = t.getAttribute('data-sel-all');
        var checked = t.checked;
        if (!SEL[tbl]) SEL[tbl] = {};
        document.querySelectorAll('table.t[data-name="' + tbl + '"] [data-sel-id]').forEach(function (cb) {
          SEL[tbl][cb.getAttribute('data-sel-id')] = checked;
        });
        draw();
        return;
      }
      if (t.matches('[data-sel-tbl]')) {
        var tn = t.getAttribute('data-sel-tbl'), id = t.getAttribute('data-sel-id');
        if (!SEL[tn]) SEL[tn] = {};
        SEL[tn][id] = t.checked;
        if (tn === 'cases') {
          drawDashboard();
        } else {
          var allCb = document.querySelector('table.t[data-name="' + tn + '"] [data-sel-all]');
          if (allCb) {
            var rowCbs = document.querySelectorAll('table.t[data-name="' + tn + '"] [data-sel-id]');
            allCb.checked = rowCbs.length > 0 && Array.prototype.every.call(rowCbs, function (cb) { return cb.checked; });
          }
        }
        return;
      }
      if (t.id === 'wsCaseSwitch' || t.id === 'revCaseSwitch') {
        CUR_ID = t.value;
        draw();
        return;
      }
      if (t.id === 'folderFallbackInput') {
        var list = Array.prototype.slice.call(t.files || []).map(function (f) {
          return { relPath: f.webkitRelativePath || f.name, name: f.name, fileObj: f };
        });
        if (list.length) ingestLocalFileList(list, (list[0].relPath.split('/')[0] || '선택 폴더'));
        return;
      }
      if (/^(dashYear|dashTrack|dashStatus|dashPerf|dashMgr|mailYrSel|mailGrpSel|docYrSel|docRoleSel|docStateSel)$/.test(t.id)) {
        draw();
      }
    });

    document.addEventListener('input', function (ev) {
      var t = ev.target;
      if (t.id === 'dashQ' || t.id === 'mailQInput' || t.id === 'docQInput') {
        draw();
        return;
      }
      if (/^(simHeadcount|simMonthlyBase|simDemandRate|simOfferRate|simAgreedRate|simIndirect)$/.test(t.id)) {
        var indStr = $('simIndirect') ? str($('simIndirect').value) : '';
        var simRes = C().simulateWageImpact({
          headcount: Number($('simHeadcount').value) || 0,
          monthlyBaseTotal: Number($('simMonthlyBase').value) || 0,
          demandRate: Number($('simDemandRate').value) || 0,
          offerRate: Number($('simOfferRate').value) || 0,
          agreedRate: Number($('simAgreedRate').value) || 0,
          indirectRatio: (indStr !== '' && isFinite(Number(indStr))) ? Math.max(0, Number(indStr)) : 19.5
        });
        var fmtW = function (n) { return Number(n || 0).toLocaleString('ko-KR') + '원'; };
        if ($('simResultGrid')) {
          $('simResultGrid').innerHTML =
            '<div class="kpi k-red"><span>노조안 연 총소요</span><b>' + fmtW(simRes.demand.annualTotalWithIndirect) + '</b></div>' +
            '<div class="kpi k-blue"><span>사측안 연 총소요</span><b>' + fmtW(simRes.offer.annualTotalWithIndirect) + '</b></div>' +
            '<div class="kpi k-green"><span>타결안 연 총소요</span><b>' + fmtW(simRes.agreed.annualTotalWithIndirect) + '</b></div>' +
            '<div class="kpi k-amber"><span>노사 격차(연)</span><b>' + fmtW(simRes.annualGap) + ' (' + simRes.rateGapPct + '%p)</b></div>';
        }
      }
    });
  }

  /* ── 13. 초기 부팅 · 3단계 로딩 · 세션 정화 ─────────────────────────── */
  function purgeSessionState() {
    D = { cases: {}, docs: {}, clauses: {}, mails: {}, dismissed: {}, companies: [], erpCases: [], userDir: {}, mailFolders: {}, mailMsgs: {}, oldMailMsgs: {}, extraMailRows: [], imapHitKeys: {} };
    MERGED_CASES = [];
    ALL_DOCS = [];
    MAIL_VIEW_CACHE = Object.create(null);
    LOCAL_FOLDER = { name: '', files: [], handle: null };
    SEL = { cases: {}, bundles: {}, docs: {}, clauses: {} };
    CUR_ID = '';
  }

  async function reload(optEpoch, optUid) {
    var reqEpoch = optEpoch || SESSION_EPOCH;
    var reqUid = optUid || (ME && ME.uid ? String(ME.uid) : '');
    if (!isSessionCurrent(reqEpoch, reqUid)) return;
    RELOAD_IN_FLIGHT = true;
    setSyncStateText('⟳ 노사·이메일 전수 동기화 중…');

    var pCore = Promise.allSettled([
      fbDb.ref('union_rel/cases').once('value'),
      fbDb.ref('union_rel/docs').once('value'),
      fbDb.ref('union_rel/clauses').once('value'),
      fbDb.ref('union_rel/mails').once('value'),
      fbDb.ref('union_rel/dismissed').once('value'),
      fbDb.ref('data/companies/v').once('value'),
      fbDb.ref('data/cases/v').once('value'),
      fbDb.ref('data/user_dir/v').once('value')
    ]);
    var pMail = Promise.allSettled([
      fbDb.ref('mailbox/folders').once('value'),
      fbDb.ref('mailbox/msgs').once('value'),
      fbDb.ref('mailbox/old/msgs').once('value')
    ]);

    function pick(res, i, fbVal) {
      return (res[i] && res[i].status === 'fulfilled' && res[i].value && res[i].value.val() != null) ? res[i].value.val() : fbVal;
    }

    pCore.then(function (cRes) {
      if (!RELOAD_IN_FLIGHT || !isSessionCurrent(reqEpoch, reqUid)) return;
      SNAP_ONLY = false;
      D.cases = pick(cRes, 0, {});
      D.docs = pick(cRes, 1, {});
      D.clauses = pick(cRes, 2, {});
      D.mails = pick(cRes, 3, {});
      D.dismissed = pick(cRes, 4, {});
      D.companies = rowsOf(pick(cRes, 5, []));
      D.erpCases = rowsOf(pick(cRes, 6, []));
      loadStaffDir(pick(cRes, 7, {}));
      rebuildDerived();
      draw();
    }).catch(function () {});

    var settled = await Promise.all([pCore, pMail]);
    RELOAD_IN_FLIGHT = false;
    SNAP_ONLY = false;
    if (!isSessionCurrent(reqEpoch, reqUid)) return;

    var cFinal = settled[0], mFinal = settled[1];
    D.cases = pick(cFinal, 0, {});
    D.docs = pick(cFinal, 1, {});
    D.clauses = pick(cFinal, 2, {});
    D.mails = pick(cFinal, 3, {});
    D.dismissed = pick(cFinal, 4, {});
    D.companies = rowsOf(pick(cFinal, 5, []));
    D.erpCases = rowsOf(pick(cFinal, 6, []));
    loadStaffDir(pick(cFinal, 7, {}));

    D.mailFolders = pick(mFinal, 0, {});
    D.mailMsgs = pick(mFinal, 1, {});
    D.oldMailMsgs = pick(mFinal, 2, {});

    setSyncStateText('');
    rebuildDerived();
    draw();

    if (global.PuFastBoot && typeof global.PuFastBoot.writeSnap === 'function') {
      try {
        global.PuFastBoot.writeSnap('unionrel', reqUid, {
          cases: D.cases, docs: D.docs, clauses: D.clauses, dismissed: D.dismissed, companies: D.companies
        });
      } catch (_) {}
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
    renderRecentDiffBar();
    try { fb.auth().setPersistence(fb.auth.Auth.Persistence.LOCAL); } catch (_) {}
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
      try { roleVal = (await fbDb.ref('uid_roles/' + authUid).once('value')).val() || {}; } catch (_) {}
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
      gate = wrapSnapGuard(global.PuOntologyWrite.createGateway({ mode: 'enforce', actor: ME.sid }));
      if ($('lock')) $('lock').style.display = 'none';
      if ($('app')) $('app').style.display = '';

      if (global.PuFastBoot && typeof global.PuFastBoot.readSnap === 'function') {
        try {
          var snap = await global.PuFastBoot.readSnap('unionrel', authUid);
          if (snap && isSessionCurrent(authEpoch, authUid)) {
            SNAP_ONLY = true;
            D.cases = snap.cases || {};
            D.docs = snap.docs || {};
            D.clauses = snap.clauses || {};
            D.dismissed = snap.dismissed || {};
            D.companies = arr(snap.companies);
            rebuildDerived();
            draw();
          }
        } catch (_) {}
      }

      await reload(authEpoch, authUid);
    });
  }

  global.PuUnionView = {
    boot: boot,
    reload: reload,
    RECENT_CODE_CHANGES: RECENT_CODE_CHANGES,
    getState: function () { return { tab: TAB, curId: CUR_ID, cases: MERGED_CASES, docs: ALL_DOCS, scan: SCAN_RES }; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
