/* 푸른통합시스템 부당해고·노동사건관리 화면 컨트롤러 (pu-case.html 전용) */
(function (root) {
  'use strict';

  var Archive = root.PuCaseArchiveCore;
  var Core = root.PuLaborCaseCore;
  var Kit = root.PuCaseArchiveViewKit;

  var STATE = {
    fb: null,
    db: null,
    gw: null,
    me: null,
    userDir: {},
    companies: [],
    erpCases: [],
    harassCases: [],
    casesMap: {},
    dismissedMap: {},
    mails: [],
    bundles: [],
    selectedIds: {},
    curId: '',
    curDocId: '',
    tab: 'board',
    axis: 'list', /* list | year | company | party | ruling */
    trackFilter: 'all', /* all | nlrc | molab */
    yearFilter: 'all',
    fltMode: 'all', /* all | urgent */
    searchQ: '',
    sortCol: 'receiveDate',
    sortDir: 'desc',
    pageLimit: 100,
    secretUnlockedId: '',
    secretData: null
  };

  function el(id) { return document.getElementById(id); }
  function clean(v) { return Kit.clean(v); }
  function esc(v) { return Kit.esc(v); }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function rowsOf(v) {
    var x = v && typeof v === 'object' && !Array.isArray(v) && v.v !== undefined ? v.v : v;
    if (Array.isArray(x)) return x.filter(function (r) { return r && typeof r === 'object'; });
    if (x && typeof x === 'object') {
      return Object.keys(x).map(function (k) {
        return x[k] && typeof x[k] === 'object' ? Object.assign({ id: x[k].id || k }, x[k]) : null;
      }).filter(Boolean);
    }
    return [];
  }

  function purgeSessionState() {
    STATE.me = null;
    STATE.gw = null;
    STATE.casesMap = {};
    STATE.dismissedMap = {};
    STATE.harassCases = [];
    STATE.mails = [];
    STATE.bundles = [];
    STATE.selectedIds = {};
    STATE.curId = '';
    STATE.curDocId = '';
    STATE.pageLimit = 100;
    STATE.secretUnlockedId = '';
    STATE.secretData = null;
  }

  function allCases() {
    return Object.keys(STATE.casesMap).map(function (k) { return STATE.casesMap[k]; })
      .filter(function (c) { return c && !c._deleted; });
  }

  function allCasesRaw() {
    return Object.keys(STATE.casesMap).map(function (k) { return STATE.casesMap[k]; })
      .filter(Boolean);
  }

  function currentCase() {
    return STATE.curId && STATE.casesMap[STATE.curId] && !STATE.casesMap[STATE.curId]._deleted
      ? STATE.casesMap[STATE.curId] : null;
  }

  function filteredCases() {
    var q = clean(STATE.searchQ).toLowerCase();
    var rows = allCases().filter(function (c) {
      if (STATE.trackFilter !== 'all' && (c.track || 'nlrc') !== STATE.trackFilter) return false;
      if (STATE.yearFilter !== 'all' && String(c.year || clean(c.receiveDate).slice(0, 4)) !== STATE.yearFilter) return false;
      if (STATE.fltMode === 'urgent') {
        var al = Core.calcLaborDeadlines(c);
        if (!al.some(function (x) { return x.urgent; })) return false;
      }
      if (q) {
        var hay = [c.title, c.companyName, c.claimantName, c.caseNo, c.jurisdiction, c.subTypeLabel].join(' ').toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
    rows.sort(function (a, b) {
      var k = STATE.sortCol || 'receiveDate';
      var va = clean(a[k]);
      var vb = clean(b[k]);
      var cmp = va < vb ? -1 : (va > vb ? 1 : 0);
      return STATE.sortDir === 'asc' ? cmp : -cmp;
    });
    return rows;
  }

  function renderKpis() {
    var list = allCases();
    var nlrcCnt = 0, molabCnt = 0, urgentCnt = 0, uncounterCnt = 0;
    list.forEach(function (c) {
      if ((c.track || 'nlrc') === 'molab') molabCnt++;
      else nlrcCnt++;
      var al = Core.calcLaborDeadlines(c);
      if (al.some(function (x) { return x.urgent; })) urgentCnt++;
      var mx = Archive.buildCounterMatrix(c.docs, c.ourRole);
      uncounterCnt += mx.summary.pending + mx.summary.overdue;
    });
    var strip = el('kpiStrip');
    if (!strip) return;
    strip.innerHTML =
      '<div class="kpi k-blue" tabindex="0" role="button" data-act="all"><span>전체 사건</span><b>' + list.length + '건</b></div>'
      + '<div class="kpi k-green" tabindex="0" role="button" data-act="nlrc"><span>노동위(해고·징계)</span><b>' + nlrcCnt + '건</b></div>'
      + '<div class="kpi" tabindex="0" role="button" data-act="molab"><span>노동청(진정·체불)</span><b>' + molabCnt + '건</b></div>'
      + '<div class="kpi k-amber" tabindex="0" role="button" data-act="counter"><span>미대응 서면</span><b>' + uncounterCnt + '건</b></div>'
      + '<div class="kpi k-red" tabindex="0" role="button" data-act="urgent"><span>재심10일·소송15일·심문</span><b>' + urgentCnt + '건</b></div>';
  }

  function renderTabsBar() {
    var nav = el('tabNav');
    if (!nav) return;
    var tabs = [
      { key: 'board',   label: '📋 사건현황 (4축)' },
      { key: 'yearly',  label: '📅 연도·시기별 자료함' },
      { key: 'counter', label: '⚔️ 상대방↔당사 대응대조' },
      { key: 'mail',    label: '✉️ 메일 자동수집 (' + STATE.bundles.length + ')' },
      { key: 'detail',  label: '🔍 상세·기한·금고' }
    ];
    nav.innerHTML = tabs.map(function (t) {
      var isOn = STATE.tab === t.key;
      return '<button type="button" class="tab-btn' + (isOn ? ' on' : '') + '" data-tab="' + t.key + '" aria-pressed="' + (isOn ? 'true' : 'false') + '">' + esc(t.label) + '</button>';
    }).join('');
  }

  function buildBoardBodyHtml(rows) {
    if (STATE.axis === 'list') {
      var visibleRows = rows.slice(0, STATE.pageLimit || 100);
      var allChecked = visibleRows.length > 0 && visibleRows.every(function (c) { return !!STATE.selectedIds[c.id]; });
      var trs = visibleRows.map(function (c, i) {
        var st = Core.countDoneSteps(c);
        var mx = Archive.buildCounterMatrix(c.docs, c.ourRole);
        var al = Core.calcLaborDeadlines(c);
        var dueTxt = al.length ? (al[0].dueDate + (al[0].daysLeft != null ? ' (' + (al[0].daysLeft >= 0 ? 'D-' + al[0].daysLeft : 'D+' + Math.abs(al[0].daysLeft)) + ')' : '')) : clean(c.rulingResult || '-');
        var checked = !!STATE.selectedIds[c.id];
        var rowLabel = clean((c.companyName || '') + ' ' + (c.claimantName || '')) || ('사건 ' + (i + 1));
        var caseNoLabel = clean(c.caseNo || (c.track === 'molab' ? '노동청진정' : '구제'));
        var coLabel = clean(c.companyName || '업체 미연결');
        var clLabel = clean(c.claimantName || '-');
        var stLabel = Core.currentStageTitle(c) + ' (' + st.done + '/' + st.total + ')';
        var mgrLabel = Kit.formatStaffList(c, STATE.userDir);
        return '<tr class="' + (STATE.curId === c.id ? 'sel' : '') + '" tabindex="0" role="button" data-cid="' + esc(c.id) + '">'
          + '<td><input type="checkbox" class="row-chk" data-chk="' + esc(c.id) + '" aria-label="' + esc(rowLabel + ' 선택') + '"' + (checked ? ' checked' : '') + '></td>'
          + '<td class="num">' + (i + 1) + '</td>'
          + '<td class="one-line">' + esc(c.year || clean(c.receiveDate).slice(0, 4)) + '</td>'
          + '<td class="one-line" title="' + esc(caseNoLabel) + '">' + esc(caseNoLabel) + '</td>'
          + '<td class="one-line" title="' + esc(coLabel) + '"><b>' + esc(coLabel) + '</b></td>'
          + '<td class="one-line" title="' + esc(clLabel) + '">' + esc(clLabel) + '</td>'
          + '<td class="one-line" title="' + esc(c.subTypeLabel || c.subType) + '">' + esc(c.subTypeLabel || c.subType) + '</td>'
          + '<td class="one-line" title="' + esc(stLabel) + '">' + esc(stLabel) + '</td>'
          + '<td class="one-line"><span class="bd bd-' + (mx.summary.overdue ? 'red' : (mx.summary.pending ? 'amber' : 'ok')) + '">공방 ' + mx.summary.matched + '/' + mx.summary.totalRows + '</span></td>'
          + '<td class="one-line" title="' + esc(dueTxt) + '">' + esc(dueTxt) + '</td>'
          + '<td class="one-line" title="' + esc(mgrLabel) + '">' + esc(mgrLabel) + '</td>'
          + '</tr>';
      }).join('');
      var moreBar = rows.length > visibleRows.length
        ? ('<div class="tbl-more-bar"><span>표시중 <b>' + visibleRows.length + '</b> / 전체 <b>' + rows.length + '</b>건</span>'
          + '<button type="button" class="btn sm" id="btnMoreRows">더 보기 (+100건)</button>'
          + '<button type="button" class="btn sm" id="btnAllRows">전체 보기</button></div>')
        : '';
      return '<div class="card tbl-wrap"><table class="t"><thead><tr>'
        + '<th><input type="checkbox" id="chkAll" aria-label="전체 선택"' + (allChecked ? ' checked' : '') + '></th><th>№</th>'
        + '<th><button type="button" class="th-flt-btn" data-sort="year">연도</button></th>'
        + '<th>사건번호</th>'
        + '<th><button type="button" class="th-flt-btn" data-sort="companyName">기업명</button></th>'
        + '<th><button type="button" class="th-flt-btn" data-sort="claimantName">진정·신청인</button></th>'
        + '<th>유형</th><th>진행 단계</th><th>대응 공방</th><th>판정·기한</th><th>담당 노무사</th>'
        + '</tr></thead><tbody>' + (trs || '<tr><td colspan="11" class="empty-td">조건에 맞는 노동사건이 없습니다.</td></tr>') + '</tbody></table>' + moreBar + '</div>';
    }
    var views = Archive.buildMultiAxisViews(rows);
    if (STATE.axis === 'company') {
      return '<div class="axis-grid">' + views.byCompany.map(function (g) {
        return '<div class="card axis-card"><div class="axis-hd"><b>🏢 ' + esc(g.companyName) + '</b><span class="bd bd-blue">' + g.count + '건 · 서류 ' + g.docCount + '</span></div>'
          + '<ul class="axis-list">' + g.cases.map(function (c) {
            return '<li tabindex="0" role="button" data-cid="' + esc(c.id) + '"><span>' + esc(c.year) + ' · ' + esc(c.claimantName || '-') + ' · ' + esc(c.caseNo || c.subTypeLabel) + '</span><b>' + esc(c.rulingResult || c.status) + '</b></li>';
          }).join('') + '</ul></div>';
      }).join('') + '</div>';
    }
    if (STATE.axis === 'party') {
      return '<div class="axis-grid">' + views.byParty.map(function (g) {
        return '<div class="card axis-card"><div class="axis-hd"><b>👤 ' + esc(g.partyName) + '</b><span class="bd bd-gray">' + esc(g.companyName) + ' · ' + g.count + '건</span></div>'
          + '<ul class="axis-list">' + g.cases.map(function (c) {
            return '<li tabindex="0" role="button" data-cid="' + esc(c.id) + '"><span>' + esc(c.receiveDate || c.year) + ' · ' + esc(c.subTypeLabel) + '</span><b>' + esc(c.rulingResult || c.status) + '</b></li>';
          }).join('') + '</ul></div>';
      }).join('') + '</div>';
    }
    if (STATE.axis === 'year') {
      return '<div class="axis-grid">' + views.byYear.map(function (g) {
        return '<div class="card axis-card"><div class="axis-hd"><b>📆 ' + esc(g.year) + '년</b><span class="bd bd-green">' + g.count + '건 · 진행 ' + g.openCount + '</span></div>'
          + '<ul class="axis-list">' + g.cases.map(function (c) {
            return '<li tabindex="0" role="button" data-cid="' + esc(c.id) + '"><span>' + esc(c.companyName) + ' (' + esc(c.claimantName || '-') + ')</span><b>' + esc(c.caseNo || c.subTypeLabel) + '</b></li>';
          }).join('') + '</ul></div>';
      }).join('') + '</div>';
    }
    return '<div class="axis-grid">' + views.byRuling.map(function (c) {
      var al = Core.calcLaborDeadlines(c);
      return '<div class="card axis-card" tabindex="0" role="button" data-cid="' + esc(c.id) + '"><div class="axis-hd"><b>⚖️ ' + esc(c.companyName) + ' — ' + esc(c.claimantName || '-') + '</b><span class="bd bd-amber">' + esc(c.rulingResult || '심리중') + '</span></div>'
        + '<div class="axis-sub">사건번호: ' + esc(c.caseNo || '-') + ' · 관할: ' + esc(c.jurisdiction || '-') + '</div>'
        + (al.length ? '<div class="axis-due">' + esc(al[0].label + ': ' + al[0].dueDate) + '</div>' : '')
        + '</div>';
    }).join('') + '</div>';
  }

  function renderBoardTab(host) {
    var rows = filteredCases();
    var years = {};
    allCases().forEach(function (c) {
      var y = String(c.year || clean(c.receiveDate).slice(0, 4) || '미상');
      years[y] = (years[y] || 0) + 1;
    });
    var yearPills = '<button type="button" class="scope-btn' + (STATE.yearFilter === 'all' ? ' on' : '') + '" data-yr="all">전체(' + allCases().length + ')</button>'
      + Object.keys(years).sort().reverse().map(function (y) {
        return '<button type="button" class="scope-btn' + (STATE.yearFilter === y ? ' on' : '') + '" data-yr="' + esc(y) + '">' + esc(y) + '년(' + years[y] + ')</button>';
      }).join('');

    var axisHtml = [
      { k: 'list',    l: '목록 표' },
      { k: 'company', l: '🏢 기업 중심' },
      { k: 'party',   l: '👤 진정·신청인 중심' },
      { k: 'year',    l: '📆 연도·시기별' },
      { k: 'ruling',  l: '⚖️ 판정·결과 추적' }
    ].map(function (ax) {
      return '<button type="button" class="scope-btn' + (STATE.axis === ax.k ? ' ok' : '') + '" data-axis="' + ax.k + '">' + ax.l + '</button>';
    }).join('');

    var trackPills = [
      { k: 'all', l: '전체 트랙' },
      { k: 'nlrc', l: '노동위원회(해고·징계·부노)' },
      { k: 'molab', l: '고용노동청(진정·체불·대지급금)' }
    ].map(function (t) {
      return '<button type="button" class="scope-btn' + (STATE.trackFilter === t.k ? ' on' : '') + '" data-trk="' + t.k + '">' + t.l + '</button>';
    }).join('');

    var selCount = rows.filter(function (c) { return !!STATE.selectedIds[c.id]; }).length;
    var toolbar = '<div class="card hi-top-strip code-diff-target" id="secAxisBoard">'
      + '<div class="scope-bar"><span class="scope-lbl">사건 트랙</span>' + trackPills + '</div>'
      + '<div class="scope-bar"><span class="scope-lbl">보기 축</span>' + axisHtml + '</div>'
      + '<div class="scope-bar"><span class="scope-lbl">연도</span>' + yearPills + '</div>'
      + '<div class="flt-bar">'
      + '<input type="search" id="qSearch" aria-label="노동사건 검색" value="' + esc(STATE.searchQ) + '" placeholder="기업명 · 진정/신청인 · 사건번호(2025부해…) · 관할 검색">'
      + (selCount > 0 ? '<span class="bd bd-blue">' + selCount + '건 선택</span><button type="button" class="btn sm" id="btnClearSel">선택 해제</button>' : '')
      + '<button type="button" class="btn pri sm" id="btnNewCase">+ 신규 노동사건</button>'
      + '</div></div>';

    host.innerHTML = toolbar + '<div id="boardResults">' + buildBoardBodyHtml(rows) + '</div>';
  }

  function renderYearlyTab(host) {
    var views = Archive.buildMultiAxisViews(filteredCases());
    var curDoc = null;
    var curCase = currentCase() || allCases()[0];
    if (curCase && STATE.curDocId) {
      curDoc = arr(curCase.docs).find(function (d) { return d.id === STATE.curDocId; });
    }
    var listHtml = views.byYear.map(function (yg) {
      return '<div class="yr-group"><div class="yr-hd">' + esc(yg.year) + '년 (' + yg.count + '건 · 서류 ' + yg.docCount + '개)</div>'
        + yg.cases.map(function (c) {
          var docItems = arr(c.docs).map(function (d) {
            return '<button type="button" class="doc-row' + (STATE.curDocId === d.id ? ' on' : '') + '" data-open-doc="' + esc(c.id) + '|' + esc(d.id) + '">'
              + '<span class="bd bd-' + esc(d.side || 'evidence') + '">' + esc(d.side === 'ours' ? '당사' : d.side === 'opponent' ? '상대방' : d.side === 'agency' ? '판정·기관' : '입증') + '</span> '
              + '<span class="doc-nm">' + esc(d.name || d.title) + '</span>'
              + '<span class="doc-meta">' + esc(d.date || '') + ' ' + (d.exhibitNo ? '[' + esc(d.exhibitNo) + ']' : '') + '</span>'
              + '</button>';
          }).join('');
          return '<div class="card yr-case"><div class="yr-case-hd" tabindex="0" role="button" data-cid="' + esc(c.id) + '"><b>' + esc(c.companyName) + '</b> · ' + esc(c.claimantName || '-') + ' <small>(' + esc(c.caseNo || c.receiveDate || c.year) + ')</small></div>'
            + '<div class="yr-docs">' + (docItems || '<div class="muted">연결된 서류 없음</div>') + '</div></div>';
        }).join('') + '</div>';
    }).join('');

    host.innerHTML = '<div class="split-2 code-diff-target" id="secYearlyArchive">'
      + '<div class="split-left">'
      + '<div class="pv-bar"><button type="button" class="btn sm pri" id="btnMountArchive">📂 보관함 폴더 연결' + (Kit.hasArchiveDir() ? ' (' + esc(Kit.archiveDirName()) + ')' : '') + '</button>'
      + '<label class="btn sm">📎 로컬 파일 바로 미리보기<input type="file" id="inpQuickPreview" hidden></label></div>'
      + (listHtml || '<div class="pv-empty">연도별 정리된 노동사건이 없습니다.</div>')
      + '</div>'
      + '<div class="split-right card" id="inlinePreviewPane"></div>'
      + '</div>';
    Kit.renderFilePreviewInto(el('inlinePreviewPane'), curDoc);
  }

  function renderCounterTab(host) {
    var c = currentCase() || allCases()[0];
    if (!c) {
      host.innerHTML = '<div class="card pv-empty">대조할 노동사건이 먼저 필요합니다.</div>';
      return;
    }
    STATE.curId = c.id;
    var matrix = Archive.buildCounterMatrix(c.docs, c.ourRole);
    var exIdx = Core.buildExhibitIndex(c.docs, c.ourRole);
    var opts = allCases().map(function (x) {
      return '<option value="' + esc(x.id) + '"' + (x.id === c.id ? ' selected' : '') + '>' + esc((x.year || '') + ' · ' + x.companyName + ' (' + (x.claimantName || '-') + ')') + '</option>';
    }).join('');
    var curDoc = arr(c.docs).find(function (d) { return d.id === STATE.curDocId; }) || null;
    var canEdit = Core.canEditCase(c, STATE.me);

    var exHtml = exIdx.total ? ('<div class="exhibit-box"><b>호증 목차 (' + exIdx.total + '건):</b> '
      + '<span>당사 호증: ' + (exIdx.ours.map(function (x) { return esc(x.exhibitLabel + '(' + x.title + ')'); }).join(', ') || '없음') + '</span> · '
      + '<span>상대방 호증: ' + (exIdx.opponent.map(function (x) { return esc(x.exhibitLabel + '(' + x.title + ')'); }).join(', ') || '없음') + '</span></div>') : '';

    host.innerHTML = '<div class="card hi-top-strip"><div class="flt-bar">'
      + '<label>대상 사건: <select id="selCounterCase">' + opts + '</select></label>'
      + '<select id="selOurRole" aria-label="대리 지위"' + (canEdit ? '' : ' disabled') + '><option value="employer"' + (c.ourRole === 'employer' ? ' selected' : '') + '>사업주·기업 대리</option>'
      + '<option value="worker"' + (c.ourRole === 'worker' ? ' selected' : '') + '>근로자·진정인 대리</option></select>'
      + (canEdit ? '<button type="button" class="btn sm pri" id="btnAddDocModal">+ 서류 추가 및 공방 연결</button>' : '')
      + '</div>' + exHtml + '</div>'
      + '<div class="split-2 code-diff-target" id="secCounterMatrix">'
      + '<div class="split-left card">' + Kit.renderCounterMatrixHtml(matrix) + '</div>'
      + '<div class="split-right card" id="counterPreviewPane"></div>'
      + '</div>';
    Kit.renderFilePreviewInto(el('counterPreviewPane'), curDoc);
  }

  function renderMailTab(host) {
    var rows = STATE.bundles.map(function (b, idx) {
      var mailsHtml = arr(b.mails).map(function (m, mi) {
        return '<div class="mail-item">'
          + '<span>' + esc(clean(m.date).slice(0, 10)) + '</span> '
          + '<span class="bd bd-' + (m.box === 'sent' ? 'ours' : 'gray') + '">' + (m.box === 'sent' ? '발신' : '수신') + '</span> '
          + '<button type="button" class="link-btn" data-view-mail="' + idx + '|' + mi + '">' + esc(m.subject) + '</button>'
          + (arr(m.attachmentNames).length ? ' <small>📎 ' + esc(m.attachmentNames.join(', ')) + '</small>' : '')
          + '</div>';
      }).join('');
      return '<div class="card mail-bundle">'
        + '<div class="mb-hd"><div><b>' + esc(b.companyName) + '</b>' + (b.claimantName ? ' (' + esc(b.claimantName) + ')' : '')
        + ' <span class="bd bd-blue">' + esc(b.subTypeLabel) + '</span> <span class="bd bd-gray">' + (b.track === 'molab' ? '노동청' : '노동위') + ' · ' + esc(b.year) + '년 · ' + b.mails.length + '통</span></div>'
        + '<div class="mb-acts"><button type="button" class="btn sm pri" data-import-bundle="' + idx + '">+ 노동사건 등록</button>'
        + ' <button type="button" class="btn sm" data-dismiss-bundle="' + esc(b.bundleKey) + '">제외</button></div></div>'
        + '<div class="mb-list">' + mailsHtml + '</div></div>';
    }).join('');
    host.innerHTML = '<div class="card hi-top-strip"><div class="flt-bar">'
      + '<span>푸른 메일함(' + STATE.mails.length + '통) 자동 분류 — 부당해고·징계·노동위·진정·임금체불·대지급금</span>'
      + '<button type="button" class="btn sm" id="btnReloadMail">🔄 메일함 다시 훑기</button>'
      + '</div></div>'
      + (rows || '<div class="card pv-empty">미등록 노동사건 메일 후보가 없습니다.</div>');
  }

  function renderDetailTab(host) {
    var c = currentCase();
    if (!c) {
      host.innerHTML = '<div class="card pv-empty">상단 목록에서 사건을 클릭하거나 <b>+ 신규 노동사건</b>을 눌러 주세요.</div>';
      return;
    }
    var alerts = Core.calcLaborDeadlines(c);
    var relatedHarass = Core.findRelatedHarassCases(c, STATE.harassCases);
    var canSecret = Core.canAccessSecret(c, STATE.me);
    var canEdit = Core.canEditCase(c, STATE.me);
    var canChangeMgr = !!(STATE.me && (Core.isAdminRole(STATE.me) || clean(c.managerMain) === clean(STATE.me.sid)));
    var disAttr = canEdit ? '' : ' disabled';
    var mgrDisAttr = (canEdit && canChangeMgr) ? '' : ' disabled';
    var steps = Core.getStepsForCase(c);

    var stepsHtml = steps.map(function (st) {
      var done = !!(c.steps && c.steps[st.key] && c.steps[st.key].done);
      var dt = (c.steps && c.steps[st.key] && c.steps[st.key].date) || '';
      return '<label class="step-box' + (done ? ' done' : '') + '" title="' + esc(st.hint) + '">'
        + '<input type="checkbox" data-step="' + st.key + '"' + (done ? ' checked' : '') + (canEdit ? '' : ' disabled') + '> '
        + '<b>' + st.no + '. ' + esc(st.title) + '</b>'
        + (dt ? '<small>' + esc(dt) + '</small>' : '')
        + '</label>';
    }).join('');

    var secretHtml = !canSecret
      ? '<div class="pv-warn">🔒 비밀금고(대응전략 · 합의금 하한선 · 진술 요지)는 <b>대표/위임관리인 및 배정된 주·부담당 노무사</b>만 열람할 수 있습니다.</div>'
      : (STATE.secretUnlockedId === c.id
        ? '<div class="secret-box"><h4>🔓 비밀금고 열람중</h4>'
          + '<textarea id="txtSecretMemo" rows="5" placeholder="심문회의 예상질의, 화해금 하한선, 대질조사 진술 요지, 민감 연락처">' + esc((STATE.secretData && STATE.secretData.strategyMemo) || '') + '</textarea>'
          + '<div class="flt-bar"><button type="button" class="btn sm pri" id="btnSaveSecret">비밀금고 저장</button></div></div>'
        : '<button type="button" class="btn sm amber" id="btnUnlockSecret">🔓 비밀금고 열기 (주·부담당/대표 전용)</button>');

    var harassHtml = relatedHarass.length ? ('<div class="alert-strip">🔗 연관 직장내괴롭힘·성희롱 사건: '
      + relatedHarass.map(function (h) {
        return '<a class="btn sm" href="pu-harass.html?cid=' + esc(encodeURIComponent(h.id)) + '" target="_blank" rel="noopener">🛡️ ' + esc(h.title || h.companyName) + '</a>';
      }).join(' ') + '</div>') : '';

    host.innerHTML = '<div class="card detail-card">'
      + '<div class="detail-hd"><div><h2>' + esc(c.title) + '</h2>'
      + '<small>트랙: ' + esc((c.track === 'molab' ? '고용노동청 진정·체불' : '노동위원회 구제신청')) + ' · 관할: ' + esc(c.jurisdiction || '미지정') + '</small></div>'
      + '<div class="detail-acts">'
      + (canEdit ? '<button type="button" class="btn sm" id="btnSyncErp">🔄 ERP 동기화</button> <button type="button" class="btn sm pri" id="btnSaveDetail">💾 저장</button> <button type="button" class="btn sm red" id="btnDeleteCase">종결·삭제</button>' : '')
      + '</div></div>'
      + harassHtml
      + '<div class="ws-steps">' + stepsHtml + '</div>'
      + '<div class="form-grid">'
      + '<label>사건명<input type="text" id="fTitle" value="' + esc(c.title) + '"' + disAttr + '></label>'
      + '<label>기업명<input type="text" id="fCompany" value="' + esc(c.companyName) + '" list="coDataList"' + disAttr + '></label>'
      + '<label>진정·신청인명<input type="text" id="fClaimant" value="' + esc(c.claimantName) + '"' + disAttr + '></label>'
      + '<label>트랙<select id="fTrack"' + disAttr + '><option value="nlrc"' + (c.track !== 'molab' ? ' selected' : '') + '>노동위원회 구제</option><option value="molab"' + (c.track === 'molab' ? ' selected' : '') + '>고용노동청 진정·체불</option></select></label>'
      + '<label>대리지위<select id="fOurRole"' + disAttr + '><option value="employer"' + (c.ourRole !== 'worker' ? ' selected' : '') + '>사업주·기업 대리</option><option value="worker"' + (c.ourRole === 'worker' ? ' selected' : '') + '>근로자·진정인 대리</option></select></label>'
      + '<label>사건번호<input type="text" id="fCaseNo" value="' + esc(c.caseNo) + '" placeholder="예: 서울2025부해1234"' + disAttr + '></label>'
      + '<label>접수일<input type="date" id="fReceiveDate" value="' + esc(c.receiveDate) + '"' + disAttr + '></label>'
      + '<label>해고·처분일(90일 기산)<input type="date" id="fActionDate" value="' + esc(c.actionDate) + '"' + disAttr + '></label>'
      + '<label>심문·조사기일<input type="date" id="fHearingDate" value="' + esc(c.hearingDate) + '"' + disAttr + '></label>'
      + '<label>초심판정 송달일(+10일)<input type="date" id="fInitServed" value="' + esc(c.initialServedDate) + '"' + disAttr + '></label>'
      + '<label>재심판정 송달일(+15일)<input type="date" id="fReServed" value="' + esc(c.reServedDate) + '"' + disAttr + '></label>'
      + '<label>판정·처리 결과<select id="fRulingResult"' + disAttr + '>' + ['', '진행중', '구제인용', '기각', '각하', '화해성립', '취하·합의', '시정완료', '대지급금지급', '기소의견송치', '불송치·내사종결'].map(function (r) {
        return '<option value="' + r + '"' + (c.rulingResult === r ? ' selected' : '') + '>' + (r || '선택') + '</option>';
      }).join('') + '</select></label>'
      + '<label>주담당 노무사<select id="fMgrMain"' + mgrDisAttr + '>' + buildStaffOptionsHtml(c.managerMain) + '</select></label>'
      + '</div>'
      + (alerts.length ? '<div class="alert-strip">' + alerts.map(function (a) {
        return '<span class="bd bd-' + (a.urgent ? 'red' : 'amber') + '">' + esc(a.label + ': ' + a.dueDate + ' (' + (a.daysLeft >= 0 ? 'D-' + a.daysLeft : 'D+' + Math.abs(a.daysLeft)) + ')') + '</span>';
      }).join(' ') + '</div>' : '')
      + '<div class="secret-wrap">' + secretHtml + '</div>'
      + '</div>'
      + '<datalist id="coDataList">' + STATE.companies.map(function (co) { return '<option value="' + esc(co.name) + '"></option>'; }).join('') + '</datalist>';
  }

  function buildStaffOptionsHtml(selectedSid) {
    return '<option value="">미배정</option>' + Object.keys(STATE.userDir).map(function (sid) {
      return '<option value="' + esc(sid) + '"' + (sid === selectedSid ? ' selected' : '') + '>' + esc(Kit.staffName(sid, STATE.userDir)) + '</option>';
    }).join('');
  }

  function render() {
    renderKpis();
    renderTabsBar();
    var host = el('tabBody');
    if (!host) return;
    if (STATE.tab === 'yearly') renderYearlyTab(host);
    else if (STATE.tab === 'counter') renderCounterTab(host);
    else if (STATE.tab === 'mail') renderMailTab(host);
    else if (STATE.tab === 'detail') renderDetailTab(host);
    else renderBoardTab(host);
  }

  async function saveCaseRecord(caseObj) {
    var cleanRec = Archive.sanitizeForSave(caseObj);
    if (!cleanRec.id) cleanRec.id = 'lc_' + Date.now();
    if (cleanRec.companyName) {
      var targetNorm = Archive.normalizeCompanyName(cleanRec.companyName);
      var found = STATE.companies.find(function (co) {
        return Archive.normalizeCompanyName(co.name) === targetNorm;
      });
      if (found) {
        cleanRec.companyId = found.id;
      } else if (cleanRec.companyId && STATE.companies.some(function (co) { return co.id === cleanRec.companyId && Archive.normalizeCompanyName(co.name) !== targetNorm; })) {
        cleanRec.companyId = '';
      }
    } else {
      cleanRec.companyId = '';
    }
    var ref = STATE.db.ref('labor_cases/cases/' + cleanRec.id);
    var res = await STATE.gw.save(ref, cleanRec, { entityType: 'Case', allowPendingCompany: true });
    var saved = (res && res.snapshot && res.snapshot.val && res.snapshot.val()) || cleanRec;
    STATE.casesMap[saved.id] = saved;
    Kit.toast('저장되었습니다.');
    render();
    return saved;
  }

  var SIDE_ROLE_LABELS = {
    ours: '당사 대응서류',
    opponent: '상대방 서류',
    agency: '위원회·노동청 판정',
    evidence: '입증·근태·임금자료'
  };

  function openAddDocModal(c) {
    var modal = el('modal'), mbox = el('mbox');
    if (!modal || !mbox || !c) return;
    var prevFocus = document.activeElement;
    function closeDocModal() {
      modal.style.display = 'none';
      if (prevFocus && typeof prevFocus.focus === 'function') prevFocus.focus();
    }
    modal.style.display = 'flex';
    mbox.innerHTML = '<div class="mhd"><h3 id="mhdTitle">+ 서류 추가 (호증·상대방↔당사 자동분류)</h3><button type="button" class="btn sm" id="mClose">닫기</button></div>'
      + '<div class="mbd"><div class="form-grid">'
      + '<label>서류 파일명/제목<input type="text" id="dName" placeholder="예: 피신청인 답변서(1차).hwpx / 을 제3호증.pdf"></label>'
      + '<label>서류 역할<select id="dSide"><option value="auto">자동 판별</option><option value="ours">당사 대응서류</option><option value="opponent">상대방 서류</option><option value="agency">위원회·노동청 판정</option><option value="evidence">입증·근태·임금자료</option></select></label>'
      + '<label>제출·수령일<input type="date" id="dDate" value="' + new Date().toISOString().slice(0, 10) + '"></label>'
      + '<label>보관함 상대경로<input type="text" id="dRel" placeholder="예: 2025/기업명/부당해고/01_당사제출/답변서.pdf"></label>'
      + '</div><div class="flt-bar"><button type="button" class="btn pri sm" id="dSave">서류 추가</button></div></div>';
    mbox.focus();
    el('mClose').onclick = closeDocModal;
    el('dSave').onclick = async function () {
      try {
        var nm = clean(el('dName').value);
        if (!nm) return Kit.toast('서류명을 입력하세요.', true);
        var sd = el('dSide').value;
        var autoRole = Archive.classifyDocSideRole({ name: nm, date: el('dDate').value }, c.ourRole);
        var role = sd === 'auto' ? autoRole : Object.assign({}, autoRole, { side: sd, roleLabel: SIDE_ROLE_LABELS[sd] || sd });
        var doc = Archive.sanitizeDocMeta({
          id: 'doc_' + Date.now(),
          name: nm,
          title: nm,
          ext: (nm.split('.').pop() || '').toLowerCase(),
          date: el('dDate').value,
          side: role.side,
          roleLabel: role.roleLabel,
          exhibitNo: role.exhibitNo,
          pairKey: role.pairKey,
          roundLabel: role.roundLabel,
          outcomeSignal: role.outcomeSignal,
          sourceOrigin: 'manual',
          archiveRelPath: el('dRel').value
        });
        var next = Object.assign({}, c, { docs: arr(c.docs).concat([doc]) });
        next.steps = Core.inferStepsFromDocs(next.docs, next.steps, next.track);
        await saveCaseRecord(next);
        closeDocModal();
      } catch (err) {
        Kit.toast('서류 추가 실패: ' + (err && err.message || err), true);
      }
    };
  }

  function bindEvents() {
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        var modal = el('modal');
        if (modal && modal.style.display && modal.style.display !== 'none') {
          modal.style.display = 'none';
          return;
        }
      }
      if (e.key === 'Enter' || e.key === ' ') {
        if (e.target && e.target.matches && e.target.matches('input,select,textarea,button,a')) return;
        var keyHit = e.target && e.target.closest ? e.target.closest('[data-cid][role="button"], [data-act][role="button"]') : null;
        if (keyHit) {
          e.preventDefault();
          keyHit.click();
        }
      }
    });
    document.addEventListener('click', async function (e) {
      try {
      if (e.target.id === 'modal') { e.target.style.display = 'none'; return; }
      if (e.target.id === 'btnClearSel') { STATE.selectedIds = {}; render(); return; }
      if (e.target.id === 'btnMoreRows') {
        STATE.pageLimit = (STATE.pageLimit || 100) + 100;
        var resMore = el('boardResults');
        if (resMore) resMore.innerHTML = buildBoardBodyHtml(filteredCases());
        else render();
        return;
      }
      if (e.target.id === 'btnAllRows') {
        STATE.pageLimit = 100000;
        var resAll = el('boardResults');
        if (resAll) resAll.innerHTML = buildBoardBodyHtml(filteredCases());
        else render();
        return;
      }
      var tabBtn = e.target.closest('[data-tab]');
      if (tabBtn) { STATE.tab = tabBtn.getAttribute('data-tab'); STATE.selectedIds = {}; STATE.pageLimit = 100; render(); return; }

      var kpi = e.target.closest('[data-act]');
      if (kpi) {
        var act = kpi.getAttribute('data-act');
        STATE.pageLimit = 100;
        if (act === 'counter') STATE.tab = 'counter';
        else if (act === 'nlrc' || act === 'molab') { STATE.tab = 'board'; STATE.trackFilter = act; STATE.fltMode = 'all'; }
        else if (act === 'urgent') { STATE.tab = 'board'; STATE.fltMode = STATE.fltMode === 'urgent' ? 'all' : 'urgent'; }
        else { STATE.tab = 'board'; STATE.trackFilter = 'all'; STATE.yearFilter = 'all'; STATE.searchQ = ''; STATE.fltMode = 'all'; }
        render(); return;
      }

      if (e.target.id === 'btnReloadMail') {
        try {
          var mSnap = await STATE.db.ref('mailbox').once('value');
          STATE.mails = Archive.flattenMailbox(mSnap.val() || {});
          STATE.bundles = Core.discoverLaborFromMail(STATE.mails, allCasesRaw()).filter(function (b) {
            return !STATE.dismissedMap[b.bundleKey];
          });
          Kit.toast('메일함 ' + STATE.mails.length + '통 재스캔 완료');
          render();
        } catch (err) {
          Kit.toast('메일함 조회 실패: ' + (err && err.message || err), true);
        }
        return;
      }

      var trk = e.target.closest('[data-trk]');
      if (trk) { STATE.trackFilter = trk.getAttribute('data-trk'); STATE.pageLimit = 100; render(); return; }

      var axBtn = e.target.closest('[data-axis]');
      if (axBtn) { STATE.axis = axBtn.getAttribute('data-axis'); STATE.pageLimit = 100; render(); return; }

      var yrBtn = e.target.closest('[data-yr]');
      if (yrBtn) { STATE.yearFilter = yrBtn.getAttribute('data-yr'); STATE.pageLimit = 100; render(); return; }

      var sortBtn = e.target.closest('[data-sort]');
      if (sortBtn) {
        var col = sortBtn.getAttribute('data-sort');
        STATE.sortDir = (STATE.sortCol === col && STATE.sortDir === 'asc') ? 'desc' : 'asc';
        STATE.sortCol = col;
        STATE.pageLimit = 100;
        render(); return;
      }

      var docBtn = e.target.closest('[data-open-doc]');
      if (docBtn) {
        var sp = docBtn.getAttribute('data-open-doc').split('|');
        STATE.curId = sp[0]; STATE.curDocId = sp[1]; render(); return;
      }

      var pvDoc = e.target.closest('[data-pv-doc]');
      if (pvDoc) { STATE.curDocId = pvDoc.getAttribute('data-pv-doc'); render(); return; }

      var vm = e.target.closest('[data-view-mail]');
      if (vm) {
        var mp = vm.getAttribute('data-view-mail').split('|');
        var b = STATE.bundles[Number(mp[0])];
        var m = b && b.mails[Number(mp[1])];
        if (m) Kit.openMailViewerModal(STATE.fb, m, el('modal'), el('mbox'));
        return;
      }

      var imp = e.target.closest('[data-import-bundle]');
      if (imp) {
        var bd = STATE.bundles[Number(imp.getAttribute('data-import-bundle'))];
        if (bd) {
          var rec = Core.buildCaseFromMailBundle(bd, { managerMain: STATE.me && STATE.me.sid, ourRole: 'employer' });
          var saved = await saveCaseRecord(rec);
          STATE.curId = saved.id;
          STATE.bundles = Core.discoverLaborFromMail(STATE.mails, allCasesRaw()).filter(function (b) {
            return !STATE.dismissedMap[b.bundleKey];
          });
          STATE.tab = 'detail';
          render();
        }
        return;
      }

      var dis = e.target.closest('[data-dismiss-bundle]');
      if (dis) {
        var bkey = dis.getAttribute('data-dismiss-bundle').replace(/[.#$\[\]\/]/g, '_');
        await STATE.gw.save(STATE.db.ref('labor_cases/dismissed/' + bkey), { id: bkey, entityType: 'Task', dismissed: true });
        STATE.dismissedMap[bkey] = true;
        STATE.bundles = STATE.bundles.filter(function (x) { return x.bundleKey !== bkey; });
        render(); return;
      }

      if (e.target.id === 'btnNewCase') {
        var newRec = await saveCaseRecord(Core.buildCaseFromMailBundle({
          companyName: '신규 노동사건 사업장', domain: 'labor_dismissal', track: 'nlrc', year: new Date().getFullYear(), mails: []
        }, { managerMain: STATE.me && STATE.me.sid, ourRole: 'employer' }));
        STATE.curId = newRec.id; STATE.tab = 'detail'; render(); return;
      }

      if (e.target.id === 'btnMountArchive') { await Kit.pickArchiveDirectory(); render(); return; }
      if (e.target.id === 'btnAddDocModal') { openAddDocModal(currentCase()); return; }

      if (e.target.id === 'btnSaveDetail') {
        var c = currentCase(); if (!c) return;
        var nextSteps = Object.assign({}, c.steps || {});
        var cbs = document.querySelectorAll('[data-step]');
        for (var i = 0; i < cbs.length; i++) {
          var k = cbs[i].getAttribute('data-step');
          nextSteps[k] = Object.assign({}, nextSteps[k] || {}, { done: cbs[i].checked });
        }
        var trkVal = el('fTrack').value;
        var trackChanged = trkVal !== (c.track || 'nlrc');
        var finalSteps = trackChanged ? Core.inferStepsFromDocs(c.docs, {}, trkVal) : nextSteps;
        var rcvDate = el('fReceiveDate') ? el('fReceiveDate').value : c.receiveDate;
        var nextYear = /^20\d{2}/.test(clean(rcvDate)) ? Number(clean(rcvDate).slice(0, 4)) : c.year;
        await saveCaseRecord(Object.assign({}, c, {
          title: el('fTitle').value,
          companyName: el('fCompany').value,
          claimantName: el('fClaimant').value,
          track: trkVal,
          domain: trkVal === 'molab' ? 'labor_wage' : 'labor_dismissal',
          ourRole: el('fOurRole').value,
          receiveDate: rcvDate,
          year: nextYear,
          caseNo: el('fCaseNo').value,
          actionDate: el('fActionDate').value,
          hearingDate: el('fHearingDate').value,
          initialServedDate: el('fInitServed').value,
          reServedDate: el('fReServed').value,
          rulingResult: el('fRulingResult').value,
          managerMain: el('fMgrMain').value,
          steps: finalSteps
        }));
        return;
      }

      if (e.target.id === 'btnDeleteCase') {
        var dc = currentCase(); if (!dc) return;
        if (typeof root.confirm === 'function' && !root.confirm('이 사건을 삭제(휴지통 이동)하시겠습니까? 단순히 사건이 끝난 경우에는 판정·처리 결과를 선택해 저장하세요.')) return;
        await STATE.gw.remove(STATE.db.ref('labor_cases/cases/' + dc.id), dc, { entityType: 'Case' });
        delete STATE.casesMap[dc.id]; STATE.curId = ''; STATE.tab = 'board'; render(); return;
      }

      if (e.target.id === 'btnSyncErp') {
        var sc = currentCase(); if (!sc) return;
        var payload = Core.buildErpSyncPayload(sc, STATE.me && STATE.me.sid);
        await STATE.gw.save(STATE.db.ref('labor_cases/erp_sync/' + sc.id), payload, { entityType: 'Task', allowPendingCompany: true });
        Kit.toast('ERP 동기화 요청이 등록되었습니다.'); return;
      }

      if (e.target.id === 'btnUnlockSecret') {
        var uc = currentCase(); if (!uc) return;
        var sSnap = await STATE.db.ref('labor_secret/' + uc.id).once('value');
        STATE.secretData = sSnap.val() || { id: uc.id, entityType: 'Document', strategyMemo: '' };
        STATE.secretUnlockedId = uc.id;
        render(); return;
      }

      if (e.target.id === 'btnSaveSecret') {
        var secC = currentCase(); if (!secC) return;
        var payloadSec = { id: secC.id, entityType: 'Document', strategyMemo: el('txtSecretMemo').value };
        await STATE.gw.save(STATE.db.ref('labor_secret/' + secC.id), payloadSec, { entityType: 'Document' });
        STATE.secretData = payloadSec;
        Kit.toast('비밀금고에 안전하게 저장되었습니다.'); return;
      }

      var rowTr = e.target.closest('tr[data-cid], li[data-cid], .axis-card[data-cid], .yr-case-hd[data-cid]');
      if (rowTr && !e.target.matches('input,button')) {
        STATE.curId = rowTr.getAttribute('data-cid');
        STATE.tab = 'detail';
        render();
      }
      } catch (err) {
        Kit.toast('처리 실패: ' + (err && err.message || err), true);
      }
    });

    document.addEventListener('change', function (e) {
      if (e.target.id === 'selCounterCase') { STATE.curId = e.target.value; STATE.curDocId = ''; render(); }
      if (e.target.id === 'selOurRole') {
        var c = currentCase();
        if (c) {
          if (!Core.canEditCase(c, STATE.me)) return Kit.toast('사건 담당자·대표만 대리 지위를 변경할 수 있습니다.', true);
          var nextRole = e.target.value;
          var nextDocs = arr(c.docs).map(function (d) {
            var oldCls = Archive.classifyDocSideRole(d, c.ourRole);
            var newCls = Archive.classifyDocSideRole(d, nextRole);
            return oldCls.side !== newCls.side ? Object.assign({}, d, { side: newCls.side, roleLabel: newCls.roleLabel }) : d;
          });
          saveCaseRecord(Object.assign({}, c, { ourRole: nextRole, docs: nextDocs })).catch(function (err) {
            Kit.toast('대리 지위 변경 실패: ' + (err && err.message || err), true);
          });
        }
      }
      if (e.target.id === 'inpQuickPreview' && e.target.files && e.target.files[0]) {
        Kit.renderFilePreviewInto(el('inlinePreviewPane'), e.target.files[0]);
      }
      if (e.target.id === 'chkAll') {
        var on = e.target.checked;
        filteredCases().forEach(function (c) { STATE.selectedIds[c.id] = on; });
        render();
      }
      if (e.target.matches('[data-chk]')) {
        STATE.selectedIds[e.target.getAttribute('data-chk')] = e.target.checked;
        render();
      }
    });

    document.addEventListener('input', function (e) {
      if (e.target.id === 'qSearch') {
        STATE.searchQ = e.target.value;
        STATE.pageLimit = 100;
        var resEl = el('boardResults');
        if (resEl) resEl.innerHTML = buildBoardBodyHtml(filteredCases());
        else render();
      }
    });
  }

  async function applyErpDeepLink(erpId) {
    if (!erpId) return;
    var existing = allCases().find(function (c) {
      return clean(c.erpCaseId) === erpId || clean(c.sourceId) === erpId;
    });
    if (existing) {
      STATE.curId = existing.id;
      STATE.tab = 'detail';
      return;
    }
    var src = STATE.erpCases.find(function (ec) { return clean(ec.id) === erpId; });
    if (!src) return;
    var co = STATE.companies.find(function (x) { return clean(x.id) === clean(src.companyId); });
    var isWage = /(체불|진정|대지급금|감독관)/.test([src.typeCode, src.title, src.caseName].join(' '));
    var draft = Core.buildCaseFromMailBundle({
      domain: isWage ? 'labor_wage' : 'labor_dismissal',
      track: isWage ? 'molab' : 'nlrc',
      companyName: clean(src.companyName || (co && co.name) || 'ERP 연동 사업장'),
      claimantName: clean(src.workerName || src.claimantName),
      year: Number(clean(src.receiveDate).slice(0, 4)) || new Date().getFullYear(),
      primaryCaseNo: clean(src.caseNo),
      mails: []
    }, {
      companyId: clean(src.companyId),
      managerMain: clean(src.managerMain || (STATE.me && STATE.me.sid)),
      managerSubs: arr(src.managerSubs),
      sourceKind: 'erp_case',
      sourceId: erpId,
      ourRole: 'employer'
    });
    draft.erpCaseId = erpId;
    if (clean(src.title || src.caseName)) draft.title = clean(src.title || src.caseName);
    if (clean(src.receiveDate)) draft.receiveDate = clean(src.receiveDate).slice(0, 10);
    if (Core.canEditCase(draft, STATE.me)) {
      var saved = await saveCaseRecord(draft);
      STATE.curId = saved.id;
    } else {
      STATE.casesMap[draft.id] = draft;
      STATE.curId = draft.id;
    }
    STATE.tab = 'detail';
  }

  async function loadInitialData() {
    var snaps = await Promise.all([
      STATE.db.ref('labor_cases/cases').once('value'),
      STATE.db.ref('labor_cases/dismissed').once('value'),
      STATE.db.ref('data/user_dir').once('value'),
      STATE.db.ref('data/companies').once('value'),
      STATE.db.ref('harass_invest/cases').once('value').catch(function () { return { val: function () { return {}; } }; }),
      STATE.db.ref('data/cases').once('value').catch(function () { return { val: function () { return null; } }; }),
      STATE.db.ref('mailbox').once('value').catch(function () { return { val: function () { return null; } }; })
    ]);
    STATE.casesMap = snaps[0].val() || {};
    STATE.dismissedMap = snaps[1].val() || {};
    STATE.userDir = snaps[2].val() || {};
    STATE.companies = rowsOf(snaps[3].val());
    STATE.harassCases = snaps[4].val() || {};
    STATE.erpCases = rowsOf(snaps[5].val());
    STATE.mails = Archive.flattenMailbox(snaps[6].val() || {});
    STATE.bundles = Core.discoverLaborFromMail(STATE.mails, allCasesRaw()).filter(function (b) {
      return !STATE.dismissedMap[b.bundleKey];
    });
    var qp = new URLSearchParams(root.location.search || '');
    if (qp.get('tab')) STATE.tab = qp.get('tab');
    if (qp.get('erp')) await applyErpDeepLink(clean(qp.get('erp')));
    else if (qp.get('cid')) { STATE.curId = qp.get('cid'); STATE.tab = 'detail'; }
    render();
    Kit.initRecentDiffBar({
      programKey: 'laborcase',
      versionDate: '2026-11-28',
      changes: [
        { label: '노동위/노동청 2트랙', target: '#secAxisBoard', desc: '부당해고·징계(7단계) 및 진정·체불(6단계) 통합 관리' },
        { label: '연도별·보관함 연결', target: '#secYearlyArchive', desc: 'D/NAS 표준보관함 연결 및 HWP/PDF 실시간 미리보기' },
        { label: '상대방↔당사 공방 대조', target: '#secCounterMatrix', desc: '이유서 vs 답변서 1:1 매칭 및 갑/을호증 목차' }
      ],
      onJump: function (sel) {
        if (sel === '#secYearlyArchive') STATE.tab = 'yearly';
        else if (sel === '#secCounterMatrix') STATE.tab = 'counter';
        else STATE.tab = 'board';
        render();
      }
    });
  }

  function boot(firebaseInstance) {
    STATE.fb = firebaseInstance;
    STATE.db = firebaseInstance.database();
    bindEvents();

    if (root.PuGate && typeof root.PuGate.show === 'function') {
      firebaseInstance.auth().onAuthStateChanged(async function (user) {
        if (!user || user.isAnonymous) {
          purgeSessionState();
          el('app').style.display = 'none';
          el('lock').style.display = 'block';
          root.PuGate.show();
          return;
        }
        try {
          if (root.PuGate && typeof root.PuGate.hide === 'function') root.PuGate.hide();
          var roleSnap = await STATE.db.ref('uid_roles/' + user.uid).once('value');
          var role = roleSnap.val() || {};
          if (role.status !== 'active' || !clean(role.sid)) {
            purgeSessionState();
            el('app').style.display = 'none';
            el('lock').style.display = 'block';
            el('lockWhy').textContent = '재직 직원 계정으로 로그인해야 노동사건을 열람할 수 있습니다.';
            return;
          }
          STATE.me = role;
          STATE.gw = root.PuOntologyWrite.createGateway({ mode: 'enforce', actor: role.sid });
          el('lock').style.display = 'none';
          el('app').style.display = 'block';
          await loadInitialData();
        } catch (err) {
          el('lockWhy').textContent = '권한 확인 오류: ' + (err && err.message || err);
        }
      });
    }
  }

  root.PuLaborCaseView = { boot: boot, state: STATE, render: render };
})(typeof window !== 'undefined' ? window : globalThis);
