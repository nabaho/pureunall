/* ══════════════════════════════════════════════════════════════════════════
   푸른통합시스템 — 공공기관 노동조합·단체협약 비교분석 (ALIO)
   파일: js/pu-alio-union.js
   - 포털(enter.html)에서는 화면 중앙 대형 레이어 팝업창(PuAlioUnion.openModal)으로 뜨고,
   - [↗ 새 창으로 크게 열기] 또는 즐겨찾기 앱바에서는 독립 화면(pu-alio-union.html)으로 열린다.
   - 표 한 칸 한 줄(white-space:nowrap + text-overflow:ellipsis + title),
     맨 왼쪽 ☐ 고르기 칸(28px) + 번호(36px, tabular-nums), 폰 화면 16px 입력칸 규칙을 지킨다.
   ══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  var DATA_SCRIPT_URL = 'js/pu-alio-data.js?v=1';
  var STYLE_ID = 'pu-alio-union-css';

  var METRIC_DEFS = [
    { key: 'union_shop', label: '조합원 자격 (유니온숍/가입범위)' },
    { key: 'timeoff_activity', label: '근로시간면제(타임오프)·조합활동' },
    { key: 'check_off', label: '조합비 일괄공제·사무실 제공' },
    { key: 'personnel_participation', label: '인사원칙 노조 관여 (합의/협의)' },
    { key: 'discipline_committee', label: '징계위원회 구성·소명·재심' },
    { key: 'work_hours_overtime', label: '근로시간·연장근로·유연근무' },
    { key: 'paid_holidays_leave', label: '유급휴일·특별휴가·경조휴가' },
    { key: 'sick_leave_accident', label: '병가(유급병가)·산재보상' },
    { key: 'maternity_childcare', label: '모성보호·육아휴직·가족돌봄' },
    { key: 'wage_bonus_allowance', label: '임금·상여금·수당·퇴직금' },
    { key: 'welfare_education_housing', label: '복리후생·학자금·건강검진' },
    { key: 'retirement_age_peak', label: '정년·명예퇴직·고용안정' },
    { key: 'validity_auto_extension', label: '유효기간·효력 자동연장' }
  ];

  var TAXONOMY_LIST = [
    ['ALL', '전체 쟁점 분류'],
    ['UNION_SHOP', '총칙·조합원자격·유니온숍'],
    ['TIMEOFF', '노조전임·근로시간면제·홍보'],
    ['CHECKOFF', '조합비일괄공제·편의제공'],
    ['PERSONNEL', '인사원칙·승진·전보·채용'],
    ['DISCIPLINE', '징계·해고·신분보장'],
    ['WORK_HOURS', '근로시간·연장근로·유연근무'],
    ['LEAVE', '휴일·연차·특별휴가·경조휴가'],
    ['SICK_SAFETY', '병가·산업재해·안전보건'],
    ['MATERNITY', '모성보호·육아휴직·일가정양립'],
    ['WAGE', '임금·상여금·수당·퇴직금'],
    ['WELFARE', '복리후생·학자금·복지기금'],
    ['RETIREMENT', '정년·임금피크·고용안정'],
    ['BARGAINING', '단체교섭·노사협의·유효기간'],
    ['ETC', '기타/일반조항']
  ];

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function worth(v) {
    if (v == null) return false;
    var s = String(v).trim();
    if (!s || s === '0' || s === '0.0' || s === '-' || s === '--' || s === '—' || s === '·' || s === '미가입' || s === '없음' || s === '해당없음') return false;
    return true;
  }

  function fmtNum(n) {
    var v = Number(n || 0);
    if (!v) return '—';
    return v.toLocaleString('ko-KR');
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var st = document.createElement('style');
    st.id = STYLE_ID;
    st.textContent = [
      '.pau-modal-back{position:fixed;inset:0;z-index:2147483000;background:rgba(15,23,42,0.58);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:18px;}',
      '.pau-modal-box{width:min(1380px,96vw);height:min(880px,92vh);background:#f8fafc;border:1px solid #cbd5e1;border-radius:18px;box-shadow:0 28px 70px -16px rgba(15,23,42,0.45);display:flex;flex-direction:column;overflow:hidden;color:#1e293b;font-family:"Inter","Noto Sans KR",system-ui,sans-serif;}',
      '.pau-root{display:flex;flex-direction:column;height:100%;min-height:0;background:#f8fafc;color:#1e293b;font-family:"Inter","Noto Sans KR",system-ui,sans-serif;font-size:13px;}',
      '.pau-hdr{display:flex;align-items:center;gap:10px;padding:12px 18px;background:#ffffff;border-bottom:1px solid #e2e8f0;flex-wrap:wrap;}',
      '.pau-hdr-ico{width:32px;height:32px;border-radius:9px;background:linear-gradient(135deg,#1e40af,#2563eb);color:#fff;display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0;}',
      '.pau-hdr-tit{font-size:15.5px;font-weight:800;color:#0f172a;white-space:nowrap;}',
      '.pau-hdr-badges{display:flex;align-items:center;gap:6px;flex-wrap:wrap;}',
      '.pau-badge{display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:999px;background:#eff6ff;border:1px solid #bfdbfe;color:#1e40af;font-size:11.5px;font-weight:600;white-space:nowrap;font-variant-numeric:tabular-nums;}',
      '.pau-hdr-r{margin-left:auto;display:flex;align-items:center;gap:7px;}',
      '.pau-btn{height:32px;padding:0 12px;border-radius:9px;border:1px solid #cbd5e1;background:#ffffff;color:#1e293b;font-size:12.5px;font-weight:600;display:inline-flex;align-items:center;gap:5px;cursor:pointer;white-space:nowrap;text-decoration:none;}',
      '.pau-btn:hover{border-color:#1e40af;color:#1e40af;background:#f8fafc;}',
      '.pau-btn.pri{background:#1e40af;border-color:#1e40af;color:#ffffff;}',
      '.pau-btn.pri:hover{background:#1d4ed8;color:#ffffff;}',
      '.pau-tabs{display:flex;align-items:center;gap:4px;padding:8px 18px 0;background:#ffffff;border-bottom:1px solid #e2e8f0;overflow-x:auto;}',
      '.pau-tab{padding:8px 14px;border:0;border-bottom:2.5px solid transparent;background:transparent;color:#475569;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap;}',
      '.pau-tab.on{color:#1e40af;border-bottom-color:#1e40af;font-weight:700;}',
      '.pau-body{flex:1;min-height:0;overflow:auto;padding:14px 18px 24px;}',
      '.pau-flt{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 12px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:10px;}',
      '.pau-flt select,.pau-flt input[type=search],.pau-flt input[type=text]{height:32px;border:1px solid #cbd5e1;border-radius:8px;padding:0 10px;background:#ffffff;color:#1e293b;font-size:12.5px;}',
      '.pau-flt input[type=search],.pau-flt input[type=text]{min-width:210px;flex:1;max-width:320px;}',
      '.pau-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-bottom:10px;}',
      '.pau-kpi{background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;padding:9px 12px;display:flex;align-items:baseline;justify-content:space-between;gap:8px;white-space:nowrap;}',
      '.pau-kpi span{font-size:12px;color:#64748b;}',
      '.pau-kpi b{font-size:16px;font-weight:800;color:#0f172a;font-variant-numeric:tabular-nums;}',
      '.pau-bulk{display:none;align-items:center;gap:8px;padding:8px 12px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;margin-bottom:10px;color:#1e40af;font-size:12.5px;font-weight:600;flex-wrap:wrap;}',
      '.pau-bulk.on{display:flex;}',
      '.pau-tbl-wrap{background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:auto;max-height:calc(100vh - 300px);}',
      '.pau-tbl{width:100%;border-collapse:collapse;table-layout:fixed;}',
      '.pau-tbl th,.pau-tbl td{padding:7px 9px;border-bottom:1px solid #e2e8f0;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;vertical-align:middle;font-size:12.5px;}',
      '.pau-tbl th{position:sticky;top:0;z-index:2;background:#f1f5f9;color:#475569;font-weight:700;font-size:12px;}',
      '.pau-tbl tr:hover td{background:#f8fafc;}',
      '.pau-tbl th.c-ck,.pau-tbl td.c-ck{width:28px;text-align:center;padding:0 4px;}',
      '.pau-tbl th.c-no,.pau-tbl td.c-no{width:36px;text-align:right;padding:0 6px;color:#64748b;font-variant-numeric:tabular-nums;}',
      '.pau-tbl td.c-num{text-align:right;font-variant-numeric:tabular-nums;}',
      '.pau-line{display:flex;align-items:center;gap:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.pau-line > span{overflow:hidden;text-overflow:ellipsis;}',
      '.pau-pill{display:inline-block;padding:1px 7px;border-radius:999px;font-size:11px;font-weight:600;border:1px solid #cbd5e1;background:#f8fafc;color:#475569;flex-shrink:0;}',
      '.pau-pill.fktu{background:#eff6ff;border-color:#bfdbfe;color:#1e40af;}',
      '.pau-pill.kctu{background:#fef2f2;border-color:#fecaca;color:#991b1b;}',
      '.pau-pill.multi{background:#fffbeb;border-color:#fde68a;color:#92400e;}',
      '.pau-chips{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:10px;}',
      '.pau-chip{padding:4px 10px;border-radius:999px;border:1px solid #cbd5e1;background:#ffffff;color:#475569;font-size:12px;cursor:pointer;white-space:nowrap;}',
      '.pau-chip.on{background:#1e40af;border-color:#1e40af;color:#ffffff;font-weight:700;}',
      '.pau-sbs{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:10px;margin-top:12px;}',
      '.pau-card{background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:6px;}',
      '.pau-card-hd{display:flex;align-items:center;justify-content:space-between;gap:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:700;color:#0f172a;}',
      '.pau-card-pre{margin:0;padding:9px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;line-height:1.55;white-space:pre-wrap;max-height:220px;overflow:auto;color:#334155;font-family:inherit;}',
      '@media (max-width:768px){',
      '  .pau-modal-back{padding:0;}',
      '  .pau-modal-box{width:100vw;height:100vh;border-radius:0;border:0;}',
      '  .pau-flt select,.pau-flt input[type=search],.pau-flt input[type=text],.pau-root input,.pau-root select,.pau-root textarea{font-size:16px!important;height:38px;}',
      '  .pau-kpis{grid-template-columns:repeat(2,minmax(0,1fr));}',
      '  .pau-hdr{padding:10px 12px;}',
      '  .pau-body{padding:10px 10px 24px;}',
      '}'
    ].join('\n');
    document.head.appendChild(st);
  }

  function ensureDataLoaded(cb) {
    if (global.PU_ALIO_DATA) {
      cb(global.PU_ALIO_DATA);
      return;
    }
    var existing = document.querySelector('script[data-pu-alio-data="1"]');
    if (existing) {
      existing.addEventListener('load', function () { cb(global.PU_ALIO_DATA); });
      return;
    }
    var s = document.createElement('script');
    s.src = DATA_SCRIPT_URL;
    s.dataset.puAlioData = '1';
    s.onload = function () { cb(global.PU_ALIO_DATA); };
    s.onerror = function () { cb(null); };
    document.head.appendChild(s);
  }

  function downloadCsv(filename, headers, rows) {
    var lines = [headers.map(function (h) { return '"' + String(h).replace(/"/g, '""') + '"'; }).join(',')];
    rows.forEach(function (r) {
      lines.push(r.map(function (c) { return '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"'; }).join(','));
    });
    var blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 300);
  }

  function mount(container, opts) {
    opts = opts || {};
    injectStyles();
    container.innerHTML = '<div class="pau-root"><div style="padding:48px;text-align:center;color:#64748b;font-weight:600;">⏳ 알리오 공공기관 노동조합·단체협약 데이터를 불러오는 중입니다...</div></div>';

    ensureDataLoaded(function (data) {
      if (!data) {
        container.innerHTML = '<div class="pau-root"><div style="padding:48px;text-align:center;color:#dc2626;font-weight:700;">데이터 파일(js/pu-alio-data.js)을 불러오지 못했습니다.</div></div>';
        return;
      }
      renderApp(container, data, opts);
    });
  }

  function renderApp(container, data, opts) {
    var insts = data.institutions || [];
    var unions = data.unions || [];
    var discs = data.disclosures || [];
    var metrics = data.metrics || [];
    var articles = data.articles || [];

    var metricsByOrgan = {};
    var metricOrganList = [];
    var seenMetricOrgans = {};
    metrics.forEach(function (m) {
      if (!metricsByOrgan[m.apba_id]) metricsByOrgan[m.apba_id] = {};
      metricsByOrgan[m.apba_id][m.metric_key] = m;
      if (!seenMetricOrgans[m.apba_id]) {
        seenMetricOrgans[m.apba_id] = true;
        metricOrganList.push({ apba_id: m.apba_id, name: m.inst_name, inst_type: m.inst_type });
      }
    });

    var state = {
      tab: 'unions',
      // Tab 1 filters & selection
      uType: 'ALL',
      uConfed: 'ALL',
      uStruct: 'ALL',
      uQuery: '',
      uSelected: {},
      uVisibleRows: [],
      // Tab 2 comparison state
      compOrgans: metricOrganList.slice(0, 6).map(function (o) { return o.apba_id; }),
      compMetricKey: 'personnel_participation',
      mSelected: {},
      // Tab 3 article search state
      aTax: 'ALL',
      aOrgan: 'ALL',
      aQuery: '',
      aSelected: {},
      aVisibleRows: [],
      // Tab 4 organ detail state
      dOrgan: metricOrganList[0] ? metricOrganList[0].apba_id : (insts[0] ? insts[0].apba_id : 'C0247'),
      dCat: 'ALL'
    };

    var activeUnionCount = unions.filter(function (u) { return u.union_structure !== '노조없음'; }).length;

    var root = document.createElement('div');
    root.className = 'pau-root';
    root.innerHTML = [
      '<div class="pau-hdr">',
      '  <div class="pau-hdr-ico">🤝</div>',
      '  <div class="pau-hdr-tit">공공기관 노동조합·단체협약 비교분석 (ALIO)</div>',
      '  <div class="pau-hdr-badges">',
      '    <span class="pau-badge">기관 ' + fmtNum(insts.length) + '곳</span>',
      '    <span class="pau-badge">단위노조 ' + fmtNum(activeUnionCount) + '개</span>',
      '    <span class="pau-badge">수시공시 ' + fmtNum(discs.length) + '건</span>',
      '    <span class="pau-badge">쟁점조문 ' + fmtNum(articles.length) + '개</span>',
      '  </div>',
      '  <div class="pau-hdr-r">',
      '    <button type="button" class="pau-btn pri" data-act="csv">📥 현재 표 엑셀(CSV) 받기</button>',
      (opts.isModal
        ? '<button type="button" class="pau-btn" data-act="newwin" title="독립 창으로 크게 열기">↗ 새 창으로 크게 열기</button>' +
          '<button type="button" class="pau-btn" data-act="close" title="닫기 (ESC)">✕ 닫기</button>'
        : '<a href="enter.html" class="pau-btn">🏠 포털 홈</a>'),
      '  </div>',
      '</div>',
      '<div class="pau-tabs" role="tablist">',
      '  <button type="button" class="pau-tab on" data-tab="unions">📊 1. 전 기관 노조·타임오프 현황</button>',
      '  <button type="button" class="pau-tab" data-tab="matrix">⚖️ 2. 13대 핵심 쟁점 기관간 비교·원문 대조</button>',
      '  <button type="button" class="pau-tab" data-tab="articles">🔍 3. 단체협약 조문 통합 검색</button>',
      '  <button type="button" class="pau-tab" data-tab="detail">📂 4. 기관별 공시·별도합의·첨부원문</button>',
      '</div>',
      '<div class="pau-body" id="pauBody"></div>'
    ].join('');

    container.innerHTML = '';
    container.appendChild(root);

    var bodyEl = root.querySelector('#pauBody');

    root.querySelector('.pau-hdr').addEventListener('click', function (ev) {
      var btn = ev.target.closest('button[data-act]');
      if (!btn) return;
      var act = btn.dataset.act;
      if (act === 'close' && opts.onClose) opts.onClose();
      else if (act === 'newwin') {
        window.open('pu-alio-union.html?sso=1', 'pureun-aliounion');
      } else if (act === 'csv') {
        exportCurrentTabCsv();
      }
    });

    root.querySelector('.pau-tabs').addEventListener('click', function (ev) {
      var tabBtn = ev.target.closest('button[data-tab]');
      if (!tabBtn) return;
      switchTab(tabBtn.dataset.tab);
    });

    function switchTab(t) {
      state.tab = t;
      state.uSelected = {};
      state.mSelected = {};
      state.aSelected = {};
      root.querySelectorAll('.pau-tab').forEach(function (b) {
        b.classList.toggle('on', b.dataset.tab === t);
      });
      renderCurrentTab();
    }

    function exportCurrentTabCsv() {
      if (state.tab === 'unions') {
        var rows = state.uVisibleRows.map(function (u, i) {
          return [
            i + 1, u.apba_id, u.inst_name, u.inst_type, u.ministry,
            u.union_structure, u.union_name, u.confederation, u.federation,
            u.bargaining_right, u.eligible_count || 0, u.member_total || 0,
            u.timeoff_hours || 0, u.timeoff_fulltime || 0, u.timeoff_parttime || 0,
            u.established_date || '', u.chair_term || '', u.scope || ''
          ];
        });
        downloadCsv('ALIO_공공기관_노조가입_타임오프현황.csv',
          ['번호', '기관코드', '기관명', '기관유형', '주무부처', '노조형태', '노동조합명', '총연합단체', '연합단체', '교섭권', '가입대상인원', '총조합원수', '타임오프(시간)', '풀타임(명)', '파트타임(명)', '설립일', '위원장임기', '가입범위'],
          rows);
      } else if (state.tab === 'matrix') {
        var headers = ['번호', '핵심 쟁점 항목'].concat(state.compOrgans.map(function (aid) {
          var found = metricOrganList.find(function (o) { return o.apba_id === aid; });
          return found ? found.name : aid;
        }));
        var mrows = METRIC_DEFS.map(function (mdef, idx) {
          var r = [idx + 1, mdef.label];
          state.compOrgans.forEach(function (aid) {
            var cell = (metricsByOrgan[aid] || {})[mdef.key];
            r.push(cell ? (cell.metric_value + ' [' + cell.evidence_article + ']') : '—');
          });
          return r;
        });
        downloadCsv('ALIO_공공기관_13대쟁점_비교매트릭스.csv', headers, mrows);
      } else if (state.tab === 'articles') {
        var arows = state.aVisibleRows.map(function (a, idx) {
          return [idx + 1, a.inst_name, a.taxonomy_name, a.chapter || '', a.article_no, a.article_title || '', a.text || ''];
        });
        downloadCsv('ALIO_단체협약_조문검색결과.csv', ['번호', '기관명', '쟁점분류', '장', '조문번호', '조문제목', '조문내용'], arows);
      } else {
        var drows = discs.filter(function (d) { return state.dOrgan === 'ALL' || d.aid === state.dOrgan; }).map(function (d, idx) {
          return [idx + 1, d.iname, d.cname, d.title, d.edate || '', d.rdate || '', (d.files || []).map(function (f) { return f.name; }).join(' / ')];
        });
        downloadCsv('ALIO_기관별_노사공시목록.csv', ['번호', '기관명', '공시항목', '제목', '체결/기준일', '등록일', '첨부파일'], drows);
      }
    }

    function renderCurrentTab() {
      if (state.tab === 'unions') renderUnionsTab();
      else if (state.tab === 'matrix') renderMatrixTab();
      else if (state.tab === 'articles') renderArticlesTab();
      else if (state.tab === 'detail') renderDetailTab();
    }

    // -------------------------------------------------------------------------
    // TAB 1: 전 기관 노조·타임오프 현황
    // -------------------------------------------------------------------------
    function renderUnionsTab() {
      var types = ['ALL'];
      var confeds = ['ALL'];
      unions.forEach(function (u) {
        if (u.inst_type && types.indexOf(u.inst_type) < 0) types.push(u.inst_type);
        if (u.confederation && confeds.indexOf(u.confederation) < 0) confeds.push(u.confederation);
      });

      bodyEl.innerHTML = [
        '<div class="pau-flt">',
        '  <select id="pauUType">' + types.map(function (t) { return '<option value="' + esc(t) + '"' + (state.uType === t ? ' selected' : '') + '>' + (t === 'ALL' ? '기관유형 전체' : esc(t)) + '</option>'; }).join('') + '</select>',
        '  <select id="pauUConfed">' + confeds.map(function (c) { return '<option value="' + esc(c) + '"' + (state.uConfed === c ? ' selected' : '') + '>' + (c === 'ALL' ? '상급단체 전체' : esc(c)) + '</option>'; }).join('') + '</select>',
        '  <select id="pauUStruct">',
        '    <option value="ALL"' + (state.uStruct === 'ALL' ? ' selected' : '') + '>노조형태 전체</option>',
        '    <option value="단일노조"' + (state.uStruct === '단일노조' ? ' selected' : '') + '>단일노조</option>',
        '    <option value="복수노조"' + (state.uStruct === '복수노조' ? ' selected' : '') + '>복수노조</option>',
        '    <option value="노조없음"' + (state.uStruct === '노조없음' ? ' selected' : '') + '>노조없음</option>',
        '  </select>',
        '  <input type="search" id="pauUQuery" placeholder="기관명·노동조합명·주무부처·연맹 검색…" value="' + esc(state.uQuery) + '">',
        '</div>',
        '<div class="pau-kpis" id="pauUKpis"></div>',
        '<div class="pau-bulk" id="pauUBulk"></div>',
        '<div class="pau-tbl-wrap">',
        '  <table class="pau-tbl">',
        '    <thead>',
        '      <tr>',
        '        <th class="c-ck"><input type="checkbox" id="pauUAllCk" title="현재 목록 전체 선택"></th>',
        '        <th class="c-no">№</th>',
        '        <th style="width:165px">기관명 · 주무부처</th>',
        '        <th style="width:125px">기관유형 · 형태</th>',
        '        <th style="width:190px">노동조합명 · 교섭권</th>',
        '        <th style="width:165px">상급단체 (총연합 · 연맹)</th>',
        '        <th style="width:82px" class="c-num">가입대상</th>',
        '        <th style="width:82px" class="c-num">총조합원</th>',
        '        <th style="width:130px" class="c-num">타임오프 (시간·명)</th>',
        '        <th style="width:145px">설립일 · 위원장임기</th>',
        '        <th>가입범위</th>',
        '      </tr>',
        '    </thead>',
        '    <tbody id="pauUTbody"></tbody>',
        '  </table>',
        '</div>'
      ].join('');

      function filterAndPaint() {
        var q = state.uQuery.trim().toLowerCase();
        state.uVisibleRows = unions.filter(function (u) {
          if (state.uType !== 'ALL' && u.inst_type !== state.uType) return false;
          if (state.uConfed !== 'ALL' && u.confederation !== state.uConfed) return false;
          if (state.uStruct !== 'ALL' && u.union_structure !== state.uStruct) return false;
          if (q) {
            var hay = [u.inst_name, u.union_name, u.ministry, u.federation, u.confederation].join(' ').toLowerCase();
            if (hay.indexOf(q) < 0) return false;
          }
          return true;
        });

        var orgSet = {};
        var totalMembers = 0;
        var toSum = 0, toCnt = 0;
        state.uVisibleRows.forEach(function (u) {
          orgSet[u.apba_id] = true;
          totalMembers += Number(u.member_total || 0);
          if (Number(u.timeoff_hours || 0) > 0) {
            toSum += Number(u.timeoff_hours);
            toCnt++;
          }
        });

        bodyEl.querySelector('#pauUKpis').innerHTML = [
          '<div class="pau-kpi"><span>조회 기관 수</span><b>' + fmtNum(Object.keys(orgSet).length) + '곳</b></div>',
          '<div class="pau-kpi"><span>조회 단위노조</span><b>' + fmtNum(state.uVisibleRows.length) + '개</b></div>',
          '<div class="pau-kpi"><span>총 조합원 합계</span><b>' + fmtNum(totalMembers) + '명</b></div>',
          '<div class="pau-kpi"><span>평균 타임오프</span><b>' + (toCnt ? fmtNum(Math.round(toSum / toCnt)) + '시간' : '—') + '</b></div>'
        ].join('');

        var tbody = bodyEl.querySelector('#pauUTbody');
        tbody.innerHTML = state.uVisibleRows.map(function (u, idx) {
          var rowKey = u.apba_id + '|' + u.union_name;
          var checked = !!state.uSelected[rowKey];
          var confPillClass = u.confederation === '한국노총' ? 'fktu' : (u.confederation === '민주노총' ? 'kctu' : '');
          var structPill = u.union_structure === '복수노조' ? '<span class="pau-pill multi">복수</span>' : '';
          var bargainBadge = worth(u.bargaining_right) && u.bargaining_right.indexOf('교섭대표') >= 0
            ? '<span class="pau-pill fktu">대표</span>' : '';
          var toParts = [];
          if (Number(u.timeoff_hours || 0) > 0) toParts.push(fmtNum(u.timeoff_hours) + 'h');
          if (Number(u.timeoff_fulltime || 0) > 0) toParts.push('풀' + u.timeoff_fulltime);
          if (Number(u.timeoff_parttime || 0) > 0) toParts.push('파트' + u.timeoff_parttime);
          var toStr = toParts.length ? toParts.join(' · ') : '—';

          var dateParts = [];
          if (worth(u.established_date)) dateParts.push(u.established_date);
          if (worth(u.chair_term)) dateParts.push(u.chair_term);
          var dateStr = dateParts.join(' · ') || '—';

          var fedParts = [];
          if (worth(u.confederation)) fedParts.push(u.confederation);
          if (worth(u.federation)) fedParts.push(u.federation);

          return [
            '<tr data-rk="' + esc(rowKey) + '" data-aid="' + esc(u.apba_id) + '">',
            '  <td class="c-ck"><input type="checkbox" class="pau-row-ck" data-rk="' + esc(rowKey) + '"' + (checked ? ' checked' : '') + '></td>',
            '  <td class="c-no">' + (idx + 1) + '</td>',
            '  <td title="' + esc(u.inst_name + (worth(u.ministry) ? ' · ' + u.ministry : '')) + '"><div class="pau-line"><a href="#" class="pau-org-lnk" data-aid="' + esc(u.apba_id) + '" style="font-weight:700;color:#1e40af;text-decoration:none">' + esc(u.inst_name) + '</a>' + (worth(u.ministry) ? '<span style="color:#64748b;font-size:11.5px">' + esc(u.ministry) + '</span>' : '') + '</div></td>',
            '  <td title="' + esc(u.inst_type + ' · ' + u.union_structure) + '"><div class="pau-line">' + structPill + '<span>' + esc(u.inst_type) + '</span></div></td>',
            '  <td title="' + esc(u.union_name + (worth(u.bargaining_right) ? ' (' + u.bargaining_right + ')' : '')) + '"><div class="pau-line">' + bargainBadge + '<span style="font-weight:600">' + esc(u.union_name) + '</span></div></td>',
            '  <td title="' + esc(fedParts.join(' · ')) + '"><div class="pau-line">' + (worth(u.confederation) ? '<span class="pau-pill ' + confPillClass + '">' + esc(u.confederation) + '</span>' : '') + (worth(u.federation) ? '<span>' + esc(u.federation) + '</span>' : '<span style="color:#94a3b8">—</span>') + '</div></td>',
            '  <td class="c-num">' + fmtNum(u.eligible_count) + '</td>',
            '  <td class="c-num" style="font-weight:700">' + fmtNum(u.member_total) + '</td>',
            '  <td class="c-num" title="' + esc(toStr) + '">' + esc(toStr) + '</td>',
            '  <td title="' + esc(dateStr) + '">' + esc(dateStr) + '</td>',
            '  <td title="' + esc(u.scope || '') + '">' + (worth(u.scope) ? esc(u.scope) : '—') + '</td>',
            '</tr>'
          ].join('');
        }).join('');

        paintBulkBar();
      }

      function paintBulkBar() {
        var keys = Object.keys(state.uSelected).filter(function (k) { return state.uSelected[k]; });
        var bulkEl = bodyEl.querySelector('#pauUBulk');
        if (!keys.length) {
          bulkEl.classList.remove('on');
          bulkEl.innerHTML = '';
          return;
        }
        bulkEl.classList.add('on');
        bulkEl.innerHTML = [
          '<span>☑ ' + keys.length + '건 선택됨</span>',
          '<button type="button" class="pau-btn pri" data-bact="compare">⚖️ 선택 기관 13대 쟁점 비교</button>',
          '<button type="button" class="pau-btn" data-bact="csv">📥 선택 항목 CSV 받기</button>',
          '<button type="button" class="pau-btn" data-bact="clear">선택 해제</button>'
        ].join('');
      }

      bodyEl.querySelector('#pauUType').addEventListener('change', function (e) { state.uType = e.target.value; filterAndPaint(); });
      bodyEl.querySelector('#pauUConfed').addEventListener('change', function (e) { state.uConfed = e.target.value; filterAndPaint(); });
      bodyEl.querySelector('#pauUStruct').addEventListener('change', function (e) { state.uStruct = e.target.value; filterAndPaint(); });
      bodyEl.querySelector('#pauUQuery').addEventListener('input', function (e) { state.uQuery = e.target.value; filterAndPaint(); });

      bodyEl.querySelector('#pauUAllCk').addEventListener('change', function (e) {
        var on = e.target.checked;
        state.uVisibleRows.forEach(function (u) {
          var rk = u.apba_id + '|' + u.union_name;
          if (on) state.uSelected[rk] = true;
          else delete state.uSelected[rk];
        });
        filterAndPaint();
      });

      bodyEl.querySelector('#pauUTbody').addEventListener('change', function (e) {
        if (!e.target.classList.contains('pau-row-ck')) return;
        var rk = e.target.dataset.rk;
        if (e.target.checked) state.uSelected[rk] = true;
        else delete state.uSelected[rk];
        paintBulkBar();
      });

      bodyEl.querySelector('#pauUTbody').addEventListener('click', function (e) {
        var lnk = e.target.closest('.pau-org-lnk');
        if (!lnk) return;
        e.preventDefault();
        state.dOrgan = lnk.dataset.aid;
        switchTab('detail');
      });

      bodyEl.querySelector('#pauUBulk').addEventListener('click', function (e) {
        var b = e.target.closest('button[data-bact]');
        if (!b) return;
        var act = b.dataset.bact;
        if (act === 'clear') {
          state.uSelected = {};
          filterAndPaint();
        } else if (act === 'compare') {
          var aids = [];
          Object.keys(state.uSelected).forEach(function (rk) {
            var aid = rk.split('|')[0];
            if (aids.indexOf(aid) < 0 && metricsByOrgan[aid]) aids.push(aid);
          });
          if (aids.length) state.compOrgans = aids;
          switchTab('matrix');
        } else if (act === 'csv') {
          var picked = state.uVisibleRows.filter(function (u) { return state.uSelected[u.apba_id + '|' + u.union_name]; });
          var rows = picked.map(function (u, i) {
            return [i + 1, u.apba_id, u.inst_name, u.inst_type, u.ministry, u.union_structure, u.union_name, u.confederation, u.member_total || 0, u.timeoff_hours || 0];
          });
          downloadCsv('ALIO_선택기관_노조현황.csv', ['번호', '기관코드', '기관명', '기관유형', '주무부처', '노조형태', '노동조합명', '상급단체', '총조합원수', '타임오프(시간)'], rows);
        }
      });

      filterAndPaint();
    }

    // -------------------------------------------------------------------------
    // TAB 2: 13대 핵심 쟁점 기관간 비교 매트릭스 & 조문 원문 Side-by-Side
    // -------------------------------------------------------------------------
    function renderMatrixTab() {
      bodyEl.innerHTML = [
        '<div class="pau-flt" style="flex-direction:column;align-items:stretch;">',
        '  <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">',
        '    <b style="font-size:12.5px;color:#0f172a;">📌 비교 대상 공공기관 선택 (클릭하여 추가·제거, 원문 파싱 완료 기관)</b>',
        '    <div style="display:flex;gap:6px;">',
        '      <button type="button" class="pau-btn" id="pauMSelectAll">전체 기관 선택</button>',
        '      <button type="button" class="pau-btn" id="pauMSelectTop6">주요 6개 기관만</button>',
        '    </div>',
        '  </div>',
        '  <div class="pau-chips" id="pauMChips" style="margin:6px 0 0;"></div>',
        '</div>',
        '<div class="pau-tbl-wrap" style="max-height:400px;">',
        '  <table class="pau-tbl" id="pauMTbl"></table>',
        '</div>',
        '<div style="margin-top:14px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:12px;">',
        '  <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">',
        '    <b style="font-size:13.5px;color:#0f172a;">🔍 쟁점별 실제 단체협약 조문 원문 나란히 비교 (Side-by-Side)</b>',
        '    <select id="pauMMetricSel" style="height:32px;border:1px solid #cbd5e1;border-radius:8px;padding:0 10px;font-weight:700;color:#1e40af;">',
        METRIC_DEFS.map(function (m) {
          return '<option value="' + esc(m.key) + '"' + (state.compMetricKey === m.key ? ' selected' : '') + '>' + esc(m.label) + '</option>';
        }).join(''),
        '    </select>',
        '  </div>',
        '  <div class="pau-sbs" id="pauMSbs"></div>',
        '</div>'
      ].join('');

      function paintMatrix() {
        var chipsEl = bodyEl.querySelector('#pauMChips');
        chipsEl.innerHTML = metricOrganList.map(function (o) {
          var on = state.compOrgans.indexOf(o.apba_id) >= 0;
          return '<button type="button" class="pau-chip' + (on ? ' on' : '') + '" data-aid="' + esc(o.apba_id) + '">' + esc(o.name) + '</button>';
        }).join('');

        var tbl = bodyEl.querySelector('#pauMTbl');
        var selOrgans = metricOrganList.filter(function (o) { return state.compOrgans.indexOf(o.apba_id) >= 0; });

        var thead = [
          '<thead><tr>',
          '  <th class="c-ck"><input type="checkbox" id="pauMAllCk"></th>',
          '  <th class="c-no">№</th>',
          '  <th style="width:210px">13대 핵심 노무·단협 쟁점</th>',
          selOrgans.map(function (o) { return '<th style="width:210px">' + esc(o.name) + '</th>'; }).join(''),
          '</tr></thead>'
        ].join('');

        var tbody = '<tbody>' + METRIC_DEFS.map(function (mdef, idx) {
          var isFocused = state.compMetricKey === mdef.key;
          var ck = !!state.mSelected[mdef.key];
          return [
            '<tr data-mkey="' + esc(mdef.key) + '" style="cursor:pointer;' + (isFocused ? 'background:#eff6ff;' : '') + '">',
            '  <td class="c-ck"><input type="checkbox" class="pau-m-ck" data-mkey="' + esc(mdef.key) + '"' + (ck ? ' checked' : '') + '></td>',
            '  <td class="c-no">' + (idx + 1) + '</td>',
            '  <td title="' + esc(mdef.label) + '" style="font-weight:700;color:#1e40af">' + esc(mdef.label) + '</td>',
            selOrgans.map(function (o) {
              var cell = (metricsByOrgan[o.apba_id] || {})[mdef.key];
              if (!cell) return '<td style="color:#94a3b8">—</td>';
              var fullTxt = cell.metric_value + ' (' + cell.evidence_article + ')';
              return '<td title="' + esc(fullTxt + '\n\n' + (cell.snippet || '')) + '"><div class="pau-line"><span class="pau-pill fktu">' + esc(cell.evidence_article.split(',')[0]) + '</span><span>' + esc(cell.metric_value) + '</span></div></td>';
            }).join(''),
            '</tr>'
          ].join('');
        }).join('') + '</tbody>';

        tbl.innerHTML = thead + tbody;
        paintSideBySide(selOrgans);
      }

      function paintSideBySide(selOrgans) {
        var sbsEl = bodyEl.querySelector('#pauMSbs');
        sbsEl.innerHTML = selOrgans.map(function (o) {
          var cell = (metricsByOrgan[o.apba_id] || {})[state.compMetricKey];
          if (!cell) {
            return '<div class="pau-card"><div class="pau-card-hd"><span>🏢 ' + esc(o.name) + '</span></div><div style="color:#94a3b8;font-size:12px;">해당 쟁점 조문 없음</div></div>';
          }
          return [
            '<div class="pau-card">',
            '  <div class="pau-card-hd"><span>🏢 ' + esc(o.name) + '</span><span class="pau-pill fktu">' + esc(cell.evidence_article) + '</span></div>',
            '  <div style="font-size:12px;font-weight:700;color:#1e40af;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="' + esc(cell.metric_value) + '">요약: ' + esc(cell.metric_value) + '</div>',
            '  <pre class="pau-card-pre">' + esc(cell.snippet || '') + '</pre>',
            '</div>'
          ].join('');
        }).join('');
      }

      bodyEl.querySelector('#pauMChips').addEventListener('click', function (e) {
        var chip = e.target.closest('button[data-aid]');
        if (!chip) return;
        var aid = chip.dataset.aid;
        var i = state.compOrgans.indexOf(aid);
        if (i >= 0) {
          if (state.compOrgans.length > 1) state.compOrgans.splice(i, 1);
        } else {
          state.compOrgans.push(aid);
        }
        paintMatrix();
      });

      bodyEl.querySelector('#pauMSelectAll').addEventListener('click', function () {
        state.compOrgans = metricOrganList.map(function (o) { return o.apba_id; });
        paintMatrix();
      });

      bodyEl.querySelector('#pauMSelectTop6').addEventListener('click', function () {
        state.compOrgans = metricOrganList.slice(0, 6).map(function (o) { return o.apba_id; });
        paintMatrix();
      });

      bodyEl.querySelector('#pauMMetricSel').addEventListener('change', function (e) {
        state.compMetricKey = e.target.value;
        paintMatrix();
      });

      bodyEl.querySelector('#pauMTbl').addEventListener('click', function (e) {
        if (e.target.tagName === 'INPUT') return;
        var tr = e.target.closest('tr[data-mkey]');
        if (!tr) return;
        state.compMetricKey = tr.dataset.mkey;
        bodyEl.querySelector('#pauMMetricSel').value = state.compMetricKey;
        paintMatrix();
      });

      paintMatrix();
    }

    // -------------------------------------------------------------------------
    // TAB 3: 단체협약 조문 통합 검색
    // -------------------------------------------------------------------------
    function renderArticlesTab() {
      bodyEl.innerHTML = [
        '<div class="pau-flt">',
        '  <select id="pauATax">' + TAXONOMY_LIST.map(function (t) { return '<option value="' + esc(t[0]) + '"' + (state.aTax === t[0] ? ' selected' : '') + '>' + esc(t[1]) + '</option>'; }).join('') + '</select>',
        '  <select id="pauAOrgan"><option value="ALL">파싱 기관 전체</option>' + metricOrganList.map(function (o) { return '<option value="' + esc(o.apba_id) + '"' + (state.aOrgan === o.apba_id ? ' selected' : '') + '>' + esc(o.name) + '</option>'; }).join('') + '</select>',
        '  <input type="search" id="pauAQuery" placeholder="조문 제목·본문 검색 (예: 징계위원회, 유급병가, 합의, 정년, 타임오프)…" value="' + esc(state.aQuery) + '">',
        '</div>',
        '<div class="pau-tbl-wrap">',
        '  <table class="pau-tbl">',
        '    <thead>',
        '      <tr>',
        '        <th class="c-ck"><input type="checkbox" id="pauAAllCk"></th>',
        '        <th class="c-no">№</th>',
        '        <th style="width:150px">기관명</th>',
        '        <th style="width:175px">표준 쟁점 분류</th>',
        '        <th style="width:130px">장 · 조문번호</th>',
        '        <th style="width:180px">조문제목</th>',
        '        <th>조문 원문 내용 (마우스를 올리면 전문 표시)</th>',
        '      </tr>',
        '    </thead>',
        '    <tbody id="pauATbody"></tbody>',
        '  </table>',
        '</div>'
      ].join('');

      function filterArticles() {
        var q = state.aQuery.trim().toLowerCase();
        state.aVisibleRows = articles.filter(function (a) {
          if (state.aTax !== 'ALL' && a.taxonomy_code !== state.aTax) return false;
          if (state.aOrgan !== 'ALL' && a.apba_id !== state.aOrgan) return false;
          if (q) {
            var hay = [a.inst_name, a.article_no, a.article_title, a.text, a.taxonomy_name].join(' ').toLowerCase();
            if (hay.indexOf(q) < 0) return false;
          }
          return true;
        });

        var tbody = bodyEl.querySelector('#pauATbody');
        tbody.innerHTML = state.aVisibleRows.slice(0, 300).map(function (a, idx) {
          var oneLineText = String(a.text || '').replace(/\s+/g, ' ').trim();
          return [
            '<tr>',
            '  <td class="c-ck"><input type="checkbox" class="pau-a-ck" data-idx="' + idx + '"></td>',
            '  <td class="c-no">' + (idx + 1) + '</td>',
            '  <td title="' + esc(a.inst_name) + '" style="font-weight:700">' + esc(a.inst_name) + '</td>',
            '  <td title="' + esc(a.taxonomy_name) + '"><span class="pau-pill fktu">' + esc(a.taxonomy_name) + '</span></td>',
            '  <td title="' + esc((a.chapter ? a.chapter + ' ' : '') + a.article_no) + '"><div class="pau-line"><span style="font-weight:700;color:#1e40af">' + esc(a.article_no) + '</span>' + (worth(a.chapter) ? '<span style="color:#64748b;font-size:11.5px">' + esc(a.chapter) + '</span>' : '') + '</div></td>',
            '  <td title="' + esc(a.article_title || '') + '" style="font-weight:600">' + (worth(a.article_title) ? esc(a.article_title) : '—') + '</td>',
            '  <td title="' + esc(a.text || '') + '">' + esc(oneLineText) + '</td>',
            '</tr>'
          ].join('');
        }).join('');
      }

      bodyEl.querySelector('#pauATax').addEventListener('change', function (e) { state.aTax = e.target.value; filterArticles(); });
      bodyEl.querySelector('#pauAOrgan').addEventListener('change', function (e) { state.aOrgan = e.target.value; filterArticles(); });
      bodyEl.querySelector('#pauAQuery').addEventListener('input', function (e) { state.aQuery = e.target.value; filterArticles(); });

      filterArticles();
    }

    // -------------------------------------------------------------------------
    // TAB 4: 기관별 상세 공시·별도합의·첨부파일 원문 내려받기
    // -------------------------------------------------------------------------
    function renderDetailTab() {
      bodyEl.innerHTML = [
        '<div class="pau-flt">',
        '  <select id="pauDOrgan" style="min-width:260px;font-weight:700;">',
        '    <option value="ALL"' + (state.dOrgan === 'ALL' ? ' selected' : '') + '>공시 수집 기관 전체 보기</option>',
        insts.map(function (i) {
          return '<option value="' + esc(i.apba_id) + '"' + (state.dOrgan === i.apba_id ? ' selected' : '') + '>' + esc(i.name + ' (' + i.inst_type + ' · ' + i.ministry + ')') + '</option>';
        }).join(''),
        '  </select>',
        '  <select id="pauDCat">',
        '    <option value="ALL">공시항목 전체 (단협·임협·별도합의·내부규정)</option>',
        '    <option value="21026">단체협약 정보 (21026)</option>',
        '    <option value="21027">임금협약 정보 (21027)</option>',
        '    <option value="63787">제도운영 상황 / 타임오프 (63787)</option>',
        '    <option value="63795">단체협약상 별도 합의사항 (63795)</option>',
        '    <option value="63796">단체협약 외의 별도 합의사항 (63796)</option>',
        '    <option value="21028">노사협의회 의결사항 (21028)</option>',
        '    <option value="21025">복수노조 교섭창구 단일화 (21025)</option>',
        '    <option value="21110">내부규정 - 취업·인사·보수 (21110)</option>',
        '  </select>',
        '</div>',
        '<div class="pau-tbl-wrap">',
        '  <table class="pau-tbl">',
        '    <thead>',
        '      <tr>',
        '        <th class="c-ck"><input type="checkbox" id="pauDAllCk"></th>',
        '        <th class="c-no">№</th>',
        '        <th style="width:150px">기관명</th>',
        '        <th style="width:175px">공시항목</th>',
        '        <th style="width:230px">공시 제목</th>',
        '        <th style="width:115px">체결일/기준일</th>',
        '        <th style="width:240px">핵심 요약 (노조명·유효기간 등)</th>',
        '        <th>첨부파일 원문 내려받기 (PDF·HWP)</th>',
        '      </tr>',
        '    </thead>',
        '    <tbody id="pauDTbody"></tbody>',
        '  </table>',
        '</div>'
      ].join('');

      function paintDisclosures() {
        var rows = discs.filter(function (d) {
          if (state.dOrgan !== 'ALL' && d.aid !== state.dOrgan) return false;
          if (state.dCat !== 'ALL' && d.ccode !== state.dCat) return false;
          return true;
        });

        var tbody = bodyEl.querySelector('#pauDTbody');
        if (!rows.length) {
          tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;color:#64748b;">조회된 수시공시 내역이 없습니다. (전체 보기 또는 공기업을 선택해 보세요)</td></tr>';
          return;
        }

        tbody.innerHTML = rows.slice(0, 300).map(function (d, idx) {
          var kvParts = [];
          Object.keys(d.kv || {}).forEach(function (k) {
            if (k !== '기준일' && k !== '제출일' && worth(d.kv[k])) {
              kvParts.push(k + ': ' + d.kv[k]);
            }
          });
          var kvSummary = kvParts.join(' · ') || '—';

          var fileLinks = (d.files || []).map(function (f) {
            return '<a href="' + esc(f.url) + '" target="_blank" rel="noopener" class="pau-pill fktu" style="text-decoration:none;margin-right:4px;" title="' + esc(f.name) + ' 내려받기">⬇ ' + esc(f.name) + '</a>';
          }).join('');

          return [
            '<tr>',
            '  <td class="c-ck"><input type="checkbox"></td>',
            '  <td class="c-no">' + (idx + 1) + '</td>',
            '  <td title="' + esc(d.iname) + '" style="font-weight:700">' + esc(d.iname) + '</td>',
            '  <td title="' + esc(d.cname) + '"><span class="pau-pill">' + esc(d.cname) + '</span></td>',
            '  <td title="' + esc(d.title) + '" style="font-weight:600">' + esc(d.title) + '</td>',
            '  <td title="' + esc(d.edate || d.rdate || '') + '">' + esc(d.edate || d.rdate || '—') + '</td>',
            '  <td title="' + esc(kvSummary) + '">' + esc(kvSummary) + '</td>',
            '  <td><div class="pau-line">' + (fileLinks || '<span style="color:#94a3b8">첨부 없음</span>') + '</div></td>',
            '</tr>'
          ].join('');
        }).join('');
      }

      bodyEl.querySelector('#pauDOrgan').addEventListener('change', function (e) { state.dOrgan = e.target.value; paintDisclosures(); });
      bodyEl.querySelector('#pauDCat').addEventListener('change', function (e) { state.dCat = e.target.value; paintDisclosures(); });

      paintDisclosures();
    }

    renderCurrentTab();
  }

  // ── 포털 화면 중앙 레이어 팝업창 열기/닫기 ──
  var modalEl = null;

  function closeModal() {
    if (!modalEl) return;
    modalEl.remove();
    modalEl = null;
    if (global.PuBack && global.PuBack.close) {
      try { global.PuBack.close('pu-alio-modal'); } catch (e) {}
    }
  }

  function openModal() {
    injectStyles();
    if (modalEl) {
      modalEl.style.display = 'flex';
      return;
    }
    modalEl = document.createElement('div');
    modalEl.className = 'pau-modal-back';
    modalEl.id = 'puAlioModalBack';
    modalEl.innerHTML = '<div class="pau-modal-box" id="puAlioModalBox" role="dialog" aria-modal="true" aria-label="공공기관 노동조합·단체협약 비교분석"></div>';
    document.body.appendChild(modalEl);

    modalEl.addEventListener('click', function (ev) {
      if (ev.target === modalEl) closeModal();
    });

    var box = modalEl.querySelector('#puAlioModalBox');
    mount(box, { isModal: true, onClose: closeModal });

    if (global.PuBack && global.PuBack.open) {
      try { global.PuBack.open('pu-alio-modal', closeModal); } catch (e) {}
    }
  }

  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' && modalEl) {
      closeModal();
    }
  });

  global.PuAlioUnion = {
    openModal: openModal,
    closeModal: closeModal,
    mount: mount
  };
})(typeof window !== 'undefined' ? window : this);
