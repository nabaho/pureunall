/* 푸른통합시스템 — 12개 컨설팅 전용 앱 공통 통합 워크스페이스 컨트롤러
 * (pu-harass.html 동일 5탭 · 상단 트랙/KPI 스트립 · 1줄 6단계 리본 · 좌우 2단 작업실 규격)
 *
 * 지원 앱:
 *   techprotect, clinic, chamber, hrconsult, evalcomp, pubconsult,
 *   familywork, socialent, sixthind, laboraudit, unionneg, specialcons
 *
 * 5개 탭 (pu-harass.html 동일 구조):
 *   1. projects : 📂 사업 현황 (세부 트랙 알약 + 초소형 KPI + 필터 + ☐·№·6단계 점 목록)
 *   2. inbox    : 📥 미등록 후보 (IMAP+POP3 메일 · 카톡/문자 · ERP 자동감지 후보 묶음 + 1클릭 등록)
 *   3. yearly   : 📅 연도별 자료함 (등록 사업 + 미등록 후보 연도별 통합 조회 + CSV 내보내기)
 *   4. detail   : 📋 진행 · 체크 · 자료 (6단계 리본 · 체크리스트 3종 · 카톡/문자/로컬파일 즉시 수집함)
 *   5. report   : ⚖️ 보고서 · RAG 코치 (좌: 수습 RAG 행동코치·퀴즈 / 우: 보고서 장별 원고·A4미리보기·HWPX)
 */
(function (global) {
  'use strict';

  var SESSION_EPOCH = 0;
  var CUR_YEAR = new Date().getFullYear();
  var APP_KEY = 'sixthind';
  var fb = null;
  var fbDb = null;
  var ME = null;
  var gate = null;
  var PREVIEW_MODE = false;
  var DIFF_HIGHLIGHT = true;
  var CUR_TAB = 'projects';
  var CUR_PID = '';
  var YEAR_FILTER = '';
  var TRACK_FILTER = '';
  var SHOW_ALL_ROWS = false;
  var ST_FILTER = ''; // '' | 'active' | 'done' — 진행상태 거르기. 위쪽 KPI 알약이 눌러 바꾼다(드롭다운이 없는 화면에서도 동작)
  var WS_FOCUS = ''; // '' | 'coach' | 'doc'
  var CUR_REPORT_KIND = 'comprehensive';
  var CUR_COACH_ANSWER = null;
  var LAST_COACH_QUERY = '';
  var UNSAVED_REPORT_DRAFT = Object.create(null);

  function captureReportUiState() {
    var qEl = $('coachQueryInput');
    if (qEl) LAST_COACH_QUERY = String(qEl.value || '');
    var rBox = $('reportBox');
    if (rBox && CUR_PID) {
      var tas = rBox.querySelectorAll('textarea[data-sec-key]');
      if (tas && tas.length) {
        var bucket = UNSAVED_REPORT_DRAFT[CUR_PID] || Object.create(null);
        var dirty = Object.keys(bucket).length > 0;
        tas.forEach(function (ta) {
          var k = ta.getAttribute('data-sec-key');
          if (!k) return;
          if (ta.value !== ta.defaultValue || Object.prototype.hasOwnProperty.call(bucket, k)) {
            bucket[k] = cleanText(ta.value);
            dirty = true;
          }
        });
        if (dirty) UNSAVED_REPORT_DRAFT[CUR_PID] = bucket;
      }
    }
  }

  var D = {
    projects: {},
    checks: {},
    comms: {},
    reports: {},
    msgIntake: {},
    companies: [],
    consultings: [],
    consTypes: [],
    regions: {},
    mailboxFolders: {},
    mailboxMsgs: {},
    mailboxOldMsgs: {},
    ragNotes: {},
    govCos: null,    // 정부사업일정 사업장(scal_cos) — 회차 표시용, 읽기만 한다(roundUnit 이 있는 앱만 읽음)
    govScheds: null, // 정부사업일정 일정(scal_scheds)
    govTypes: null,  // 정부사업일정 종류(scal_types)
    discover: { bundles: [], matchedCommsByPid: {}, stats: { mailHits: 0, msgHits: 0, erpHits: 0 } },
    ragIndex: null
  };

  var SEL = Object.create(null);
  var LAST_FOCUS_EL = null;

  function $(id) { return document.getElementById(id); }
  function str(v) { return v == null ? '' : String(v).trim(); }
  function num(v, d) { var n = Number(v); return isFinite(n) ? n : (d || 0); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function cssEsc(v) {
    var s = String(v == null ? '' : v);
    if (global.CSS && typeof global.CSS.escape === 'function') return global.CSS.escape(s);
    return s.replace(/["\\\]\[]/g, '\\$&');
  }
  function Cat() { return global.PuConsultCatalogs; }
  function Intake() { return global.PuConsultIntake; }
  function Rag() { return global.PuConsultRag; }
  function Hwpx() { return global.PuConsultHwpx; }
  function getAppCat() {
    var c = Cat();
    return (c && c.get(APP_KEY)) || { key: APP_KEY, rtdbRoot: 'scal_' + APP_KEY, name: '컨설팅', shortName: '컨설팅', icon: '📋', agency: '푸른노무법인', tracks: [], stages: [], preChecks: [], domainChecks: [], requiredDocs: [], reportSchema: [], ragPlaybook: { stageActions: [], commonMistakes: [], legalRefs: [] } };
  }
  function getCustomRegionsList() {
    var regMap = D.regions || {};
    return Object.keys(regMap).map(function (k) {
      return Object.assign({ id: k }, regMap[k]);
    }).filter(function (r) {
      return r && !r._deleted && str(r.id) && str(r.name);
    }).sort(function (a, b) {
      return (num(a.sortOrder, 999) - num(b.sortOrder, 999)) || (num(a.createdAt, 0) - num(b.createdAt, 0));
    });
  }
  function getEffectiveTracks() {
    var base = (getAppCat().tracks || []).slice();
    var seen = Object.create(null);
    base.forEach(function (t) { if (t && t.id) seen[t.id] = 1; });
    getCustomRegionsList().forEach(function (r) {
      if (seen[r.id]) return;
      seen[r.id] = 1;
      base.push({
        id: r.id,
        name: r.name,
        shortName: r.shortName || r.name,
        badge: r.shortName || r.name,
        agency: r.agency || '',
        icon: '📍',
        keywords: r.keywords || '',
        custom: true
      });
    });
    return base;
  }
  function trackShortLabel(t) {
    if (!t) return '';
    return str(t.shortName || t.badge || t.name);
  }
  function activeTrackObj() {
    if (!TRACK_FILTER) return null;
    return getEffectiveTracks().find(function (t) { return t.id === TRACK_FILTER; }) || null;
  }
  function rootPath(sub) {
    var r = getAppCat().rtdbRoot || ('scal_' + APP_KEY);
    return sub ? (r + '/' + sub) : r;
  }
  function toast(msg) {
    var el = $('toast');
    if (!el) return;
    el.textContent = str(msg);
    el.classList.add('on');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.classList.remove('on'); }, 2800);
  }
  function isLocalPreviewAllowed() {
    if (typeof location === 'undefined') return false;
    var h = str(location.hostname).toLowerCase();
    var isLocal = h === 'localhost' || h === '127.0.0.1' || h.endsWith('.localhost');
    if (!isLocal) return false;
    var sp = new URLSearchParams(location.search || '');
    return sp.get('preview') === '1' || sp.get('demo') === '1';
  }
  function cleanText(raw) {
    var I = Intake();
    return I ? I.sanitizeText(str(raw)) : str(raw);
  }
  function safeDate(v) {
    if (!v) return '-';
    var n = Number(v);
    if (isFinite(n) && n > 1e11) return new Date(n + 9 * 3600e3).toISOString().slice(0, 10);
    return str(v).slice(0, 10) || '-';
  }

  function projectsList() {
    // 이 프로그램에 담지 않는 트랙(excludeTrackIds)의 사업은 목록·집계에서 뺀다 — 자료는 지우지 않는다.
    var excl = getAppCat().excludeTrackIds || [];
    var splitCols = getAppCat().listCols === 'split';
    var trackOrder = Object.create(null);
    (getAppCat().tracks || []).forEach(function (t, i) { trackOrder[t.id] = i; });
    return Object.keys(D.projects || {}).map(function (k) {
      return Object.assign({ id: k }, D.projects[k]);
    }).filter(function (p) { return p && !p._deleted && excl.indexOf(str(p.trackId)) < 0; })
      .sort(function (a, b) {
        var byYear = num(b.year, 0) - num(a.year, 0);
        if (byYear) return byYear;
        if (splitCols) { // 같은 연도 안에서는 지역(충남·세종·충북) → 사업장명 순으로 세로줄이 가지런하게
          var ta = trackOrder[str(a.trackId)], tb = trackOrder[str(b.trackId)];
          var byReg = (ta == null ? 99 : ta) - (tb == null ? 99 : tb);
          if (byReg) return byReg;
          return str(a.companyName).localeCompare(str(b.companyName), 'ko') || (num(b.updatedAt, 0) - num(a.updatedAt, 0));
        }
        return (num(b.updatedAt, 0) - num(a.updatedAt, 0)) || str(a.companyName).localeCompare(str(b.companyName), 'ko');
      });
  }
  function projectById(pid) {
    if (!pid || !D.projects || !D.projects[pid] || D.projects[pid]._deleted) return null;
    return Object.assign({ id: pid }, D.projects[pid]);
  }
  function getCheckDoc(pid) {
    var cd = (D.checks && D.checks[pid]) || {};
    return cd.main || cd || { pre: {}, domain: {}, docs: {} };
  }
  function getProjectComms(pid) {
    var stored = (D.comms && D.comms[pid]) ? Object.keys(D.comms[pid]).map(function (k) { return Object.assign({ id: k }, D.comms[pid][k]); }).filter(function (c) { return c && !c._deleted; }) : [];
    var autoMatched = (D.discover && D.discover.matchedCommsByPid && D.discover.matchedCommsByPid[pid]) || [];
    var seen = Object.create(null);
    var merged = [];
    stored.concat(autoMatched).forEach(function (c) {
      var sig = str(c.id || c.subject || c.title) + '|' + str(c.date);
      if (seen[sig]) return;
      seen[sig] = 1;
      merged.push(c);
    });
    merged.sort(function (a, b) { return str(b.date).localeCompare(str(a.date)); });
    return merged;
  }

  /* ══ 회차 — 이알피 계약의 일수(현장클리닉 3일 = 3회차 · 기술보호 3회 = 3회차)와 정부사업일정의 방문 일정을
       «읽기만» 해서 사업장 줄마다 보여 준다 (대표 지시 2026-11-28 「3회차도 2회차도 있다 — 다시 다 표시」).
     ⚠ 새로 저장하지 않는다(파생 표시). 이어 붙이기는 «번호»로만 — 사건번호(caseNo = 이알피 컨설팅 번호) → 이알피 컨설팅 →
       정부사업일정 사업장(scal_cos.erpId · co_id). 상호 이름으로는 잇지 않는다(온톨로지 규칙).
     ⚠ 계획 회차는 이알피 계약에 «사람이 적은» 일수가 기준이다. 정부사업일정의 방문 일정은 «참고»일 뿐 셈에 넣지 않는다
       (일정·사진을 안 넣고 진행하는 일이 많다 — status/2026-10-04-gisul-round-count.md).
     ⚠ 성과추적관리(perfTrack)는 연간 수행일수에서 빠지는 건이라 합계에서 따로 센다. */
  function isSlim() { return !!getAppCat().slimUi; }
  function roundUnit() { return str(getAppCat().roundUnit); }
  function govRows(v) {
    if (!v) return [];
    if (Array.isArray(v)) return v.filter(Boolean);
    return Object.keys(v).map(function (k) { return v[k]; }).filter(Boolean);
  }
  function erpConsultingOf(p) {
    var no = str(p && p.caseNo);
    if (!no) return null;
    var list = D.consultings || [];
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if (!c || c._deleted || str(c.no) !== no) continue;
      if (/^(?:cancelled|canceled|취소|해지)$/i.test(str(c.status))) continue; // 취소·해지 건의 일수는 회차로 세지 않는다
      return c;
    }
    return null;
  }
  function erpRoundDays(c) {
    if (!c) return 0;
    var d = parseInt(c.consultDays, 10) || 0;
    return d || (parseInt(c.dayCalc && c.dayCalc.days, 10) || 0);
  }
  var _roundCache = { key: '', map: null };
  function roundsOf(p) {
    if (!roundUnit()) return null;
    // 같은 자료로 줄마다 되풀이해서 훑지 않게 한 번 만든 표를 돌려 쓴다(자료가 바뀌면 열쇠가 바뀐다).
    var ck = [(D.consultings || []).length, (D.govCos && Object.keys(D.govCos).length) || 0, (D.govScheds && Object.keys(D.govScheds).length) || 0, APP_KEY].join('|');
    if (_roundCache.key !== ck || !_roundCache.map) {
      var kw = getAppCat().govTypeKeywords || [];
      var typeIds = Object.create(null);
      govRows(D.govTypes).forEach(function (t) {
        var nm = str(t.name) + ' ' + str(t.fullName);
        if (t.id != null && kw.some(function (k) { return nm.indexOf(k) >= 0; })) typeIds[str(t.id)] = t;
      });
      var cosByErp = Object.create(null), cosByCo = Object.create(null);
      govRows(D.govCos).forEach(function (c) {
        if (!c || c._deleted || !str(c.id)) return;
        if (str(c.erpId)) (cosByErp[str(c.erpId)] = cosByErp[str(c.erpId)] || []).push(c);
        if (str(c.co_id)) (cosByCo[str(c.co_id)] = cosByCo[str(c.co_id)] || []).push(c);
      });
      var schedsByCo = Object.create(null);
      govRows(D.govScheds).forEach(function (s) {
        if (!s || !s.date || !str(s.coId) || !typeIds[str(s.typeId)]) return;
        (schedsByCo[str(s.coId)] = schedsByCo[str(s.coId)] || []).push(s);
      });
      _roundCache = { key: ck, map: { cosByErp: cosByErp, cosByCo: cosByCo, schedsByCo: schedsByCo } };
    }
    var m = _roundCache.map;
    var erp = erpConsultingOf(p);
    var planned = erpRoundDays(erp);
    var coList = [];
    var seenCo = Object.create(null);
    function addCos(arr) { (arr || []).forEach(function (c) { if (!seenCo[c.id]) { seenCo[c.id] = 1; coList.push(c); } }); }
    if (erp && str(erp.id)) addCos(m.cosByErp[str(erp.id)]);
    if (!coList.length && str(p.companyId)) addCos(m.cosByCo[str(p.companyId)]);
    var yr = String(num(p.year, CUR_YEAR));
    var today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
    var items = [];
    coList.forEach(function (c) {
      (m.schedsByCo[str(c.id)] || []).forEach(function (s) {
        if (String(s.date).slice(0, 4) !== yr) return; // 사업장·연도 한 건 = 그 해 일정만
        items.push({ round: num(s.round, 0), date: String(s.date).slice(0, 10), field: s.isField !== false });
      });
    });
    items.sort(function (a, b) { return a.date.localeCompare(b.date) || (a.round - b.round); });
    var seenDate = Object.create(null), uniq = [];
    items.forEach(function (it) { var k = it.date + '|' + it.round; if (!seenDate[k]) { seenDate[k] = 1; uniq.push(it); } });
    var past = uniq.filter(function (it) { return it.date <= today; });
    return {
      planned: planned,                 // 이알피 계약의 일수/회수 (0 = 적혀 있지 않음)
      erpNo: erp ? str(erp.no) : '',
      perf: !!(erp && erp.perfTrack),   // 📈 성과추적관리 — 연간 셈 제외
      items: uniq,                      // 정부사업일정의 그 해 방문 일정(참고)
      visited: past.length,
      upcoming: uniq.length - past.length,
      linked: !!erp
    };
  }
  function roundChipsHtml(p) {
    var r = roundsOf(p);
    if (!r) return '';
    if (!r.planned && !r.items.length) {
      return '<span class="hint" title="이알피 계약에 일수가 적혀 있지 않고 정부사업일정에도 이 해 일정이 이어져 있지 않습니다">-</span>';
    }
    var u = roundUnit();
    var tip = [];
    if (r.planned) tip.push('이알피 계약 ' + r.planned + u + ' = ' + r.planned + '회차');
    r.items.forEach(function (it) { tip.push((it.round ? it.round + '회차 ' : '') + it.date + (it.date > new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10) ? ' (예정)' : '')); });
    if (r.perf) tip.push('📈 성과추적관리 — 연간 수행일수 셈에서 제외');
    var main = r.planned
      ? '<span class="chip c-blue">' + r.planned + '회차</span>'
      : '<span class="chip">일정 ' + r.items.length + '건</span>';
    var sub = (r.planned && r.items.length)
      ? ' <span class="chip" title="정부사업일정에 잡힌 방문 — 참고">방문 ' + r.visited + (r.upcoming ? '+' + r.upcoming : '') + '</span>'
      : '';
    return '<span class="rd-cell" title="' + esc(tip.join('\n')) + '">' + main + sub + (r.perf ? ' <span class="chip c-amber">📈 성과추적</span>' : '') + '</span>';
  }
  // 위쪽 KPI 줄의 «계획 회차» 합계 — 성과추적관리는 연간 수행일수에서 빠지는 건이라 따로 센다
  function roundKpiHtml(list) {
    if (!roundUnit()) return '';
    var sum = 0, perfN = 0, noInfo = 0;
    (list || []).forEach(function (p) {
      var r = roundsOf(p);
      if (!r || !r.planned) { noInfo++; return; }
      if (r.perf) perfN++; else sum += r.planned;
    });
    return '<div class="kpi k-blue" title="이알피 계약의 일수(현장클리닉 3일 = 3회차)·회수 합계 — 성과추적관리 건은 연간 셈에서 빠지므로 제외"><span>계획 회차</span><b>' + sum + '회차</b></div>' +
      (perfN ? '<div class="kpi k-amber" title="성과추적관리 — 연간 수행일수 셈에서 제외"><span>📈 성과추적</span><b>' + perfN + '건</b></div>' : '') +
      (noInfo ? '<div class="kpi" title="이알피 계약에 일수가 적혀 있지 않거나 번호로 이어지지 않아 회차를 알 수 없는 건 — 합계에서 빠짐"><span>회차 미확인</span><b>' + noInfo + '건</b></div>' : '');
  }
  // 한 사업장의 회차별 줄(진행·체크 탭 머리에 붙인다): 1회차·2회차·3회차 … 날짜가 있으면 날짜, 없으면 «미정»
  function roundsPanelHtml(p) {
    var r = roundsOf(p);
    if (!r) return '';
    var u = roundUnit();
    var n = Math.max(r.planned, r.items.length);
    var head = '<div class="sec"><span>🗓 회차 현황</span>' +
      (r.planned ? '<span class="chip c-blue">이알피 계약 ' + r.planned + u + ' = ' + r.planned + '회차</span>' : '<span class="chip c-amber">이알피 계약에 일수가 적혀 있지 않음</span>') +
      (r.perf ? '<span class="chip c-amber">📈 성과추적관리 · 연간 수행일수 제외</span>' : '') +
      '<span class="sp"></span><a class="act-link" href="gov-consulting.html" target="_blank" rel="noopener">정부사업일정 ↗</a></div>';
    if (!n) {
      return '<div class="card">' + head + '<div class="empty">이어진 회차 자료가 없습니다 — 이알피 계약의 일수 또는 정부사업일정 방문 일정이 이 사업장(번호 기준)에 이어지면 여기에 나옵니다.</div></div>';
    }
    var today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
    var rows = '';
    for (var i = 0; i < n; i++) {
      var it = r.items[i];
      var st = !it ? '<span class="chip">일정 미정</span>' : (it.date > today ? '<span class="chip c-amber">예정</span>' : '<span class="chip c-green">방문 완료</span>');
      rows += '<tr><td class="n">' + (i + 1) + '</td><td class="ti">' + (i + 1) + '회차</td><td>' + esc(it ? it.date : '-') + '</td><td>' + st + '</td></tr>';
    }
    return '<div class="card">' + head +
      '<div class="scroll"><table class="t" data-name="rounds"><thead><tr><th class="n">№</th><th>회차</th><th>방문일</th><th>상태</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<div class="hint" style="padding:4px 12px 8px">방문일은 정부사업일정에 잡힌 일정을 날짜 순으로 놓은 «참고» 표시입니다(저장 안 함). 계획 회차는 이알피 계약의 일수가 기준입니다.</div>' +
    '</div>';
  }

  function stepDotsHtml(stageId, status) {
    var stages = getAppCat().stages || [];
    var isDone = status === 'done';
    var rawIdx = stages.findIndex(function (s) { return s.id === (stageId || 'intake'); });
    var idx = isDone ? Math.max(0, stages.length - 1) : Math.max(0, rawIdx);
    var dots = stages.map(function (s, i) {
      var cls = (isDone || i < idx) ? 'done' : (i === idx ? 'cur' : '');
      return '<span class="pdot ' + cls + '" title="' + esc(s.name) + '"></span>';
    }).join('');
    var curStage = stages[idx] || { no: idx + 1, name: '진행' };
    return '<span class="pbar">' + dots + '</span><b>' + (idx + 1) + '/' + (stages.length || 6) + '</b> ' + esc(curStage.name);
  }

  function wrapSnapGuard(rawGate) {
    if (!rawGate || typeof rawGate.save !== 'function') return rawGate;
    return {
      mode: rawGate.mode,
      save: function (ref, rec, ctx) {
        return rawGate.save(ref, rec, Object.assign({ allowPendingCompany: true }, ctx || {}));
      },
      remove: function (ref, prev, ctx) {
        return rawGate.remove(ref, prev, ctx || {});
      }
    };
  }

  async function saveRecord(subPath, id, record, entityType, opts) {
    opts = opts || {};
    var rec = Object.assign({ id: id, entityType: entityType || 'Document', schemaVersion: 1, contractVersion: 1 }, record);
    if (!str(rec.createdBy)) rec.createdBy = str((ME && ME.uid) || 'preview');
    var curRev = num(rec.revision, 0);
    var clears = Array.isArray(opts.clearKeys) ? opts.clearKeys : [];
    if (PREVIEW_MODE || !fbDb || !gate) {
      rec.updatedAt = Date.now();
      rec.createdAt = rec.createdAt || rec.updatedAt;
      rec.createdBy = rec.createdBy || str((ME && ME.uid) || 'preview');
      rec.updatedBy = str((ME && ME.uid) || 'preview');
      rec.revision = curRev + 1;
      clears.forEach(function (k) { delete rec[k]; });
      return rec;
    }
    var ref = fbDb.ref(rootPath(subPath));
    var conflictErr = '';
    try {
      var res = await gate.save(ref, function (serverPrev) {
        // RTDB transaction 은 차가운 자리에서 1회 serverPrev === null 로 호출된 뒤 실제 서버값으로 재호출된다.
        if (serverPrev && curRev > 0 && num(serverPrev.revision, 0) !== curRev) {
          conflictErr = '다른 사용자가 먼저 수정했습니다. 최신 자료를 다시 연 뒤 저장하세요.';
          return undefined;
        }
        if (serverPrev && serverPrev._deleted && !rec._deleted) {
          conflictErr = '이미 삭제된 자료입니다. 목록을 새로 고침하세요.';
          return undefined;
        }
        var patch = opts.patch
          ? Object.assign({}, opts.patch, { id: rec.id, entityType: rec.entityType, schemaVersion: rec.schemaVersion, contractVersion: rec.contractVersion, revision: rec.revision })
          : rec;
        var merged = serverPrev ? Object.assign({}, serverPrev, patch) : Object.assign({}, rec);
        clears.forEach(function (k) { merged[k] = null; });
        return merged;
      }, {
        entityType: entityType || 'Document',
        expectedRevision: curRev > 0 ? undefined : -1,
        allowPendingCompany: true
      });
      var val = (res && res.snapshot && typeof res.snapshot.val === 'function') ? res.snapshot.val() : rec;
      if (val && typeof val === 'object') clears.forEach(function (k) { delete val[k]; });
      return val;
    } catch (e) {
      if (conflictErr) throw new Error(conflictErr);
      throw e;
    }
  }

  async function softDeleteRecord(subPath, prev, entityType) {
    if (!prev || typeof prev !== 'object') throw new Error('삭제할 원본을 찾지 못했습니다.');
    var curRev = num(prev.revision, 0);
    var delActor = str((ME && ME.uid) || '');
    if (PREVIEW_MODE || !fbDb || !gate) {
      return Object.assign({}, prev, { _deleted: true, deletedAt: Date.now(), deletedBy: delActor || 'preview' });
    }
    var ref = fbDb.ref(rootPath(subPath));
    var conflictErr = '';
    try {
      var res = await gate.save(ref, function (serverPrev) {
        if (serverPrev && curRev > 0 && num(serverPrev.revision, 0) !== curRev) {
          conflictErr = '다른 사용자가 먼저 수정했습니다. 최신 자료를 다시 연 뒤 삭제하세요.';
          return undefined;
        }
        var base = serverPrev ? Object.assign({}, serverPrev) : Object.assign({}, prev);
        return Object.assign(base, { _deleted: true, deletedAt: Date.now(), deletedBy: delActor });
      }, { entityType: entityType || 'Document', expectedRevision: undefined, allowPendingCompany: true });
      return (res && res.snapshot && typeof res.snapshot.val === 'function')
        ? res.snapshot.val()
        : Object.assign({}, prev, { _deleted: true, deletedAt: Date.now(), deletedBy: delActor });
    } catch (e) {
      if (conflictErr) throw new Error(conflictErr);
      throw e;
    }
  }

  /* ══ 1. 합성 프리뷰 데이터 (?preview=1 & localhost 전용) ═══════════════ */
  function buildPreviewData() {
    var cat = getAppCat();
    var tracks = cat.tracks || [];
    var t0 = tracks[0] || { id: 'default', name: cat.name };
    var t1 = tracks[1] || t0;
    var now = Date.now();
    var p1Id = 'pv_' + APP_KEY + '_1';
    var p2Id = 'pv_' + APP_KEY + '_2';

    var preSample = {};
    (cat.preChecks || []).slice(0, 3).forEach(function (c) { preSample[c.id] = { status: 'ok', note: '확인 완료' }; });
    var domSample = {};
    (cat.domainChecks || []).slice(0, 4).forEach(function (c, i) {
      domSample[c.id] = { status: i < 2 ? 'ok' : (i === 2 ? 'fix' : 'no'), note: i >= 2 ? '보완 안내 초안 작성 필요' : '적정' };
    });
    var docSample = {};
    (cat.requiredDocs || []).slice(0, 2).forEach(function (d) { docSample[d.id] = { status: 'ok', note: '확보' }; });

    D.projects = {};
    if (APP_KEY === 'chamber') {
      var trC = tracks[0] || { id: 'ch_chungnam', name: '충남북부상공회의소 인사노무컨설팅' };
      var trS = tracks[1] || { id: 'ch_seosan', name: '서산상공회의소 인사노무컨설팅' };
      D.projects[p1Id] = {
        id: p1Id, entityType: 'Project', schemaVersion: 1, contractVersion: 1, revision: 2,
        createdAt: now - 864e5 * 14, updatedAt: now - 3600e3,
        companyId: 'co_pv_1', companyName: '(주)가나북부샘플', bizNo: '123-81-51001', caseNo: '인사충남-2026-001',
        year: 2026, trackId: trC.id, trackName: trC.name, stage: 'visit',
        workerCount: 28, consultantName: '점검노무사', status: 'active',
        summaryNote: '충남북부상의 회원사 방문진단·취업규칙 정비 (미리보기 합성)'
      };
      D.projects[p2Id] = {
        id: p2Id, entityType: 'Project', schemaVersion: 1, contractVersion: 1, revision: 1,
        createdAt: now - 864e5 * 40, updatedAt: now - 864e5 * 10,
        companyId: 'co_pv_2', companyName: '(주)다라서산샘플', bizNo: '123-81-51002', caseNo: '인사서산-2026-001',
        year: 2026, trackId: trS.id, trackName: trS.name, stage: 'design',
        workerCount: 35, consultantName: '점검노무사', status: 'active',
        summaryNote: '서산상의 회원사 교대제·임금설계 컨설팅 (미리보기 합성)'
      };
      D.projects['pv_chamber_3'] = {
        id: 'pv_chamber_3', entityType: 'Project', schemaVersion: 1, contractVersion: 1, revision: 1,
        createdAt: now - 864e5 * 390, updatedAt: now - 864e5 * 365,
        companyId: 'co_pv_3', companyName: '(주)마바북부이력', bizNo: '123-81-51003',
        year: 2025, trackId: trC.id, trackName: trC.name, stage: 'followup',
        workerCount: 42, consultantName: '점검노무사', status: 'done',
        summaryNote: '2025 충남북부상의 최종보고·결과물 인도 완료 (과거 수행사례)'
      };
      D.projects['pv_chamber_4'] = {
        id: 'pv_chamber_4', entityType: 'Project', schemaVersion: 1, contractVersion: 1, revision: 1,
        createdAt: now - 864e5 * 410, updatedAt: now - 864e5 * 370,
        companyId: 'co_pv_4', companyName: '(주)사아서산이력', bizNo: '123-81-51004',
        year: 2025, trackId: trS.id, trackName: trS.name, stage: 'followup',
        workerCount: 22, consultantName: '점검노무사', status: 'done',
        summaryNote: '2025 서산상의 최종결과보고·방문확인서 완료 (과거 수행사례)'
      };
      D.projects['pv_chamber_5'] = {
        id: 'pv_chamber_5', entityType: 'Project', schemaVersion: 1, contractVersion: 1, revision: 1,
        createdAt: now - 864e5 * 740, updatedAt: now - 864e5 * 700,
        companyId: 'co_pv_5', companyName: '(주)자차북부정밀', bizNo: '123-81-51005',
        year: 2024, trackId: trC.id, trackName: trC.name, stage: 'followup',
        workerCount: 60, consultantName: '점검노무사', status: 'done',
        summaryNote: '2024 충남북부상의 수행 완료 (과거 이력 아카이브)'
      };
      D.regions = {};
    } else if (APP_KEY === 'laboraudit') {
      var trReg = tracks[0] || t0;
      var trSp = tracks[1] || t1;
      var trRem = tracks[2] || t1;
      D.projects[p1Id] = {
        id: p1Id, entityType: 'Project', schemaVersion: 1, contractVersion: 1, revision: 2,
        createdAt: now - 864e5 * 14, updatedAt: now - 3600e3,
        companyId: 'co_pv_1', companyName: '(주)가나정밀', bizNo: '123-81-51001',
        year: 2026, trackId: trReg.id, trackName: trReg.name, stage: 'visit',
        workerCount: 42, consultantName: '점검노무사', status: 'active',
        inspPeriod: '2026-11-18 ~ 2026-11-29', inspOffice: '대전청 천안지청 근로개선지도과',
        inspIssues: '연장·야간·휴일수당 산정 및 근로계약서 교부 점검', inspDue: '2026-12-15',
        inspResult: '시정지시 대응중',
        summaryNote: '정기 근로감독 수검 · 지적사항 시정안 작성'
      };
      D.projects[p2Id] = {
        id: p2Id, entityType: 'Project', schemaVersion: 1, contractVersion: 1, revision: 1,
        createdAt: now - 864e5 * 380, updatedAt: now - 864e5 * 340,
        companyId: 'co_pv_2', companyName: '(주)다라산업', bizNo: '123-81-51002',
        year: 2025, trackId: trRem.id, trackName: trRem.name, stage: 'followup',
        workerCount: 68, consultantName: '점검노무사', status: 'done',
        inspPeriod: '2025-05-12 ~ 2025-05-23', inspOffice: '대전청 서산지청',
        inspIssues: '임금명세서 기재누락, 연차휴가 미사용수당 시정', inspDue: '2025-06-20',
        inspResult: '시정완료·종결',
        summaryNote: '시정완료 보고서 제출 및 종결'
      };
      D.projects['pv_' + APP_KEY + '_3'] = {
        id: 'pv_' + APP_KEY + '_3', entityType: 'Project', schemaVersion: 1, contractVersion: 1, revision: 1,
        createdAt: now - 864e5 * 740, updatedAt: now - 864e5 * 700,
        companyId: 'co_pv_3', companyName: '(주)마바물류', bizNo: '123-81-51003',
        year: 2024, trackId: trSp.id, trackName: trSp.name, stage: 'followup',
        workerCount: 55, consultantName: '점검노무사', status: 'done',
        inspPeriod: '2024-09-02 ~ 2024-09-13', inspOffice: '중부지방고용노동청',
        inspIssues: '근로시간 한도(52시간) 초과 및 휴게시간 부여 개선', inspDue: '2024-10-10',
        inspResult: '시정완료·종결',
        summaryNote: '특별감독 시정지시 2건 완료 · 취업규칙 정비'
      };
      D.regions = {};
    } else {
      D.projects[p1Id] = {
        id: p1Id, entityType: 'Project', schemaVersion: 1, contractVersion: 1, revision: 2,
        createdAt: now - 864e5 * 14, updatedAt: now - 3600e3,
        companyId: 'co_pv_1', companyName: '(주)가나' + cat.shortName + '샘플', bizNo: '123-81-51001',
        year: 2026, trackId: t0.id, trackName: t0.name, stage: 'visit',
        workerCount: 28, consultantName: '점검노무사', status: 'active',
        summaryNote: cat.name + ' 현장 방문·핵심 진단 진행 중 (미리보기 합성 데이터)'
      };
      D.projects[p2Id] = {
        id: p2Id, entityType: 'Project', schemaVersion: 1, contractVersion: 1, revision: 1,
        createdAt: now - 864e5 * 380, updatedAt: now - 864e5 * 340,
        companyId: 'co_pv_2', companyName: '(주)다라산업', bizNo: '123-81-51002',
        year: 2025, trackId: t1.id, trackName: t1.name, stage: 'followup',
        workerCount: 45, consultantName: '점검노무사', status: 'done',
        summaryNote: cat.name + ' 최종 결과보고·산출물 인도 완료 (과거 수행사례)'
      };
      D.projects['pv_' + APP_KEY + '_3'] = {
        id: 'pv_' + APP_KEY + '_3', entityType: 'Project', schemaVersion: 1, contractVersion: 1, revision: 1,
        createdAt: now - 864e5 * 740, updatedAt: now - 864e5 * 700,
        companyId: 'co_pv_3', companyName: '(주)마바제조', bizNo: '123-81-51003',
        year: 2024, trackId: t0.id, trackName: t0.name, stage: 'followup',
        workerCount: 32, consultantName: '점검노무사', status: 'done',
        summaryNote: '2024년 ' + cat.shortName + ' 과거 수행이력 (미리보기 합성)'
      };
      D.regions = {};
    }
    // 회차 표시(현장클리닉·기술보호) 미리보기용 합성 자료 — 번호로 이어진 이알피 계약 일수와 정부사업일정 방문
    if (roundUnit() && D.projects[p1Id] && D.projects[p2Id]) {
      D.projects[p1Id].caseNo = '미리보기-001';
      D.projects[p2Id].caseNo = '미리보기-002';
      D.consultings = [
        { id: 'pvc1', no: '미리보기-001', consultDays: 3, perfTrack: false, status: 'progress' },
        { id: 'pvc2', no: '미리보기-002', consultDays: 2, perfTrack: true, status: 'closed' }
      ];
      D.govTypes = { t1: { id: 't1', name: cat.shortName, rounds: 3 } };
      D.govCos = { c1: { id: 'c1', erpId: 'pvc1', name: '(합성)' } };
      D.govScheds = {
        s1: { id: 's1', coId: 'c1', typeId: 't1', round: 1, date: '2026-03-10', isField: true },
        s2: { id: 's2', coId: 'c1', typeId: 't1', round: 2, date: '2026-04-14', isField: true },
        s3: { id: 's3', coId: 'c1', typeId: 't1', round: 3, date: '2026-12-15', isField: true }
      };
    }
    D.checks = {};
    D.checks[p1Id] = { main: { id: 'main', projectId: p1Id, entityType: 'Document', schemaVersion: 1, contractVersion: 1, revision: 1, pre: preSample, domain: domSample, docs: docSample } };
    D.comms = {};
    D.comms[p1Id] = {
      cm_1: {
        id: 'cm_1', projectId: p1Id, entityType: 'Document', schemaVersion: 1, contractVersion: 1, revision: 1,
        source: 'imap', date: safeDate(now - 864e5 * 3),
        subject: '[' + cat.name + '] (주)가나' + cat.shortName + '샘플 사전진단서 및 질의자료 회신',
        maskedPreview: cat.shortName + ' 관련 현장 확인 요청 및 첨부 서식 송부드립니다.',
        atts: ['사전질의표.xlsx', '현행서식.hwpx'], matchedReasons: ['제목/본문 키워드']
      },
      cm_2: {
        id: 'cm_2', projectId: p1Id, entityType: 'Document', schemaVersion: 1, contractVersion: 1, revision: 1,
        source: 'kakao_export', date: safeDate(now - 864e5),
        subject: '[카톡] 담당자 일정 협의 및 추가 자료 전송 안내',
        maskedPreview: '노무사님 다음 주 현장 방문 일정 확인과 ' + cat.shortName + ' 체크사항 문의드립니다. 010-0000-[가림]',
        atts: ['현장안내_메모.txt'], matchedReasons: ['카톡·문자 자동분류']
      }
    };
    D.discover = {
      bundles: [{
        key: 'cand_pv_1',
        companyName: '(주)한빛' + cat.shortName + '후보',
        companyId: '',
        year: 2026,
        latestDate: safeDate(now),
        mailCount: 2,
        msgCount: 1,
        erpCount: 0,
        totalCount: 3,
        reasonsList: ['메일 키워드 일치', '카톡 수집함 후보'],
        sampleSubjects: ['[' + cat.agency + '] 신규 배정 및 ' + cat.name + ' 안내'],
        comms: [{ source: 'imap', id: 'm_cand_1', date: safeDate(now), subject: '[' + cat.agency + '] 신규 배정 공문 안내', maskedPreview: '신규 배정 기업 확인 요청드립니다.', atts: ['배정통지.pdf'] }]
      }],
      matchedCommsByPid: {},
      stats: { mailHits: 3, msgHits: 2, erpHits: 0 }
    };
    CUR_PID = p1Id;
  }

  /* ══ 2. 실시간 데이터 로드 · 자동 감지 · RAG 색인 ═══════════════════ */
  function safeVal(path) {
    if (!fbDb) return Promise.resolve(null);
    return fbDb.ref(path).once('value').then(function (s) { return s ? s.val() : null; }).catch(function () { return null; });
  }
  function unwrapRows(raw) {
    var v = (raw && typeof raw === 'object' && !Array.isArray(raw) && raw.v !== undefined) ? raw.v : raw;
    return Array.isArray(v) ? v : (v && typeof v === 'object' ? Object.values(v) : []);
  }

  function rebuildDiscoverAndRag() {
    var I = Intake();
    var R = Rag();
    var C = Cat();
    var projs = projectsList();
    if (I && !PREVIEW_MODE) {
      D.discover = I.discoverForApp(APP_KEY, {
        companies: D.companies,
        consultings: D.consultings,
        consTypes: D.consTypes,
        regions: getCustomRegionsList(),
        projects: projs,
        mailboxFolders: D.mailboxFolders,
        mailboxMsgs: D.mailboxMsgs,
        mailboxOldMsgs: D.mailboxOldMsgs,
        msgIntake: D.msgIntake
      });
    }
    if (R && C) {
      var flat = I && !PREVIEW_MODE ? I.flattenMailbox(D.mailboxFolders, D.mailboxMsgs, D.mailboxOldMsgs) : [];
      var byApp = {};
      byApp[APP_KEY] = projs;
      D.ragIndex = R.buildKnowledgeIndex(C, {
        mailRecords: flat.slice(0, 600),
        msgIntake: D.msgIntake,
        projectsByApp: byApp,
        coachNotes: D.ragNotes
      });
    }
    if (!CUR_PID || !projectById(CUR_PID)) {
      CUR_PID = projs.length ? projs[0].id : '';
    }
  }

  async function reload(epoch, uid) {
    if (PREVIEW_MODE) {
      buildPreviewData();
      rebuildDiscoverAndRag();
      draw();
      return;
    }
    if (!fbDb) return;
    if ($('syncStateChip')) { $('syncStateChip').style.display = ''; $('syncStateChip').textContent = '동기화 중…'; }
    var basePath = rootPath('');
    var res = await Promise.all([
      safeVal(basePath + '/projects'),
      safeVal(basePath + '/checks'),
      safeVal(basePath + '/comms'),
      safeVal(basePath + '/reports'),
      safeVal('msg_intake/items'),
      safeVal('coach_rag/notes'),
      safeVal('data/companies'),
      safeVal('data/consultings'),
      safeVal('data/biz_cons_types'),
      safeVal('mailbox/folders'),
      safeVal('mailbox/msgs'),
      safeVal('mailbox/old/msgs'),
      safeVal(basePath + '/regions'),
      // 회차 표시용 정부사업일정 — 읽기만. roundUnit 이 있는 앱(현장클리닉·기술보호)만 읽는다.
      roundUnit() ? safeVal('scal_cos') : Promise.resolve(null),
      roundUnit() ? safeVal('scal_scheds') : Promise.resolve(null),
      roundUnit() ? safeVal('scal_types') : Promise.resolve(null)
    ]);
    if (epoch !== SESSION_EPOCH || (ME && ME.uid !== uid)) return;
    D.projects = res[0] || {};
    D.checks = res[1] || {};
    D.comms = res[2] || {};
    D.reports = res[3] || {};
    D.msgIntake = res[4] || {};
    D.ragNotes = res[5] || {};
    D.companies = unwrapRows(res[6]);
    D.consultings = unwrapRows(res[7]);
    D.consTypes = unwrapRows(res[8]);
    D.mailboxFolders = res[9] || {};
    D.mailboxMsgs = res[10] || {};
    D.mailboxOldMsgs = res[11] || {};
    D.regions = res[12] || {};
    D.govCos = res[13] || null;
    D.govScheds = res[14] || null;
    D.govTypes = res[15] || null;

    rebuildDiscoverAndRag();
    if ($('syncStateChip')) $('syncStateChip').textContent = '최신 동기화 완료';
    draw();
  }

  /* ══ 3. 상단 변경점 바(#recent-diff-bar) · 왼쪽 대시보드 · 공통 헬퍼 ════ */
  function renderRecentDiffBar() {
    var el = $('recentDiffBarWrap');
    if (!el) return;
    var cat = getAppCat();
    // 가벼운 화면은 이 띠를 그리지 않는다 — 탭과 똑같은 이동 단추(사업 현황·미등록 후보·보고서)를 한 번 더 늘어놓던 자리였다.
    if (cat.slimUi) { el.innerHTML = ''; return; }
    var isLeft = !!$('leftDash');
    var isInsp = (APP_KEY === 'laboraudit');
    var badge = isInsp
      ? '변경됨 · 자율점검·노무진단 완전 분리'
      : (cat.diffBadge || (isLeft ? '변경됨 · 좌측 대시보드 분리 + 전수 적재' : '변경됨 · 전수 이력 적재 + 연도별 관리'));
    var msg = isInsp
      ? '순수 고용노동부 근로감독(정기/수시·특별·시정지시·모의수검)만 관리 · 감독기간·관할지청·지적사항·결과 표시'
      : (cat.diffMsg || (isLeft
        ? '북부상의 · 서산상의 · 당진상의 왼쪽 대시보드 분리 + 새 지역 상공회의소 추가 + 연도별 관리'
        : '사업장·사건별 과거이력 일괄 적재 + 상단 연도별 빠른 필터 적용'));
    el.innerHTML = '<div id="recent-diff-bar" class="note ' + (DIFF_HIGHLIGHT ? 'code-diff-box' : '') + '" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">' +
      '<span class="chip c-blue">' + esc(badge) + '</span>' +
      '<b>' + esc(cat.icon + ' ' + cat.name) + ':</b>' +
      '<span class="hint">' + esc(msg) + '</span>' +
      '<span class="sp"></span>' +
      '<button type="button" class="sm" data-diff-tab="projects">사업 현황</button>' +
      '<button type="button" class="sm" data-diff-tab="yearly">연도별 자료함</button>' +
      '<button type="button" class="sm" data-diff-tab="inbox">미등록 후보</button>' +
      '<button type="button" class="sm pri" data-diff-tab="report">보고서·RAG</button>' +
      '<button type="button" class="sm" id="toggleDiffBtn">' + (DIFF_HIGHLIGHT ? '표시 끄기' : '표시 켜기') + '</button>' +
      '</div>';
    el.querySelectorAll('[data-diff-tab]').forEach(function (b) {
      b.onclick = function () { switchTab(b.getAttribute('data-diff-tab')); };
    });
    if ($('toggleDiffBtn')) {
      $('toggleDiffBtn').onclick = function () { DIFF_HIGHLIGHT = !DIFF_HIGHLIGHT; draw(); };
    }
  }

  function renderLeftDash() {
    var aside = $('leftDash');
    if (!aside) return;
    var cat = getAppCat();
    var tracks = getEffectiveTracks();
    var allProjs = projectsList();
    var cands = (D.discover && D.discover.bundles) || [];

    aside.className = 'left-dash' + (DIFF_HIGHLIGHT ? ' code-diff-box' : '');
    var LD = cat.leftDash || {};

    var statsMap = Object.create(null);
    tracks.forEach(function (t) {
      statsMap[t.id] = { total: 0, active: 0, done: 0, cand: 0, yrs: Object.create(null) };
    });
    var unmappedIds = [];
    allProjs.forEach(function (p) {
      var tid = str(p.trackId);
      var st = statsMap[tid];
      if (!st) {
        st = { total: 0, active: 0, done: 0, cand: 0, yrs: Object.create(null) };
        statsMap[tid] = st;
        unmappedIds.push(tid);
      }
      st.total++;
      if (p.status === 'done') st.done++;
      else st.active++;
      var y = String(num(p.year, CUR_YEAR));
      st.yrs[y] = (st.yrs[y] || 0) + 1;
    });
    cands.forEach(function (b) {
      var tid = str(b.suggestedTrackId);
      if (tid && statsMap[tid]) statsMap[tid].cand++;
    });

    var allDone = allProjs.filter(function (p) { return p.status === 'done'; }).length;
    var allActive = allProjs.length - allDone;

    var cardsHtml = '<div class="ld-item' + (!TRACK_FILTER ? ' on' : '') + '">' +
      '<button type="button" class="ld-item-btn" data-ld-track="" aria-pressed="' + (!TRACK_FILTER ? 'true' : 'false') + '">' +
        '<span class="ld-item-name">' + esc(LD.allLabel || '🏬 전체 상공회의소') + '</span>' +
        '<span class="chip c-blue">' + allProjs.length + '건</span>' +
      '</button>' +
      '<div class="ld-sub"><span>진행 ' + allActive + '</span><span>완료 ' + allDone + '</span>' +
        (cands.length ? ('<span>후보 ' + cands.length + '</span>') : '') +
      '</div>' +
    '</div>';

    var renderTracks = tracks.slice();
    unmappedIds.forEach(function (uid) {
      if (uid && !renderTracks.some(function (t) { return t.id === uid; })) {
        renderTracks.push({ id: uid, name: uid + ' (기타)', shortName: uid, icon: '🧩' });
      }
    });

    renderTracks.forEach(function (t) {
      var st = statsMap[t.id] || { total: 0, active: 0, done: 0, cand: 0, yrs: {} };
      var yrs = Object.keys(st.yrs).sort(function (a, b) { return Number(b) - Number(a); });
      var yrsHtml = yrs.length
        ? ('<div class="ld-yrs">' + yrs.slice(0, 6).map(function (yr) {
            var on = TRACK_FILTER === t.id && YEAR_FILTER === yr;
            return '<button type="button" class="ld-yr-btn' + (on ? ' on' : '') + '" data-ld-track="' + esc(t.id) + '" data-ld-year="' + esc(yr) + '" aria-pressed="' + (on ? 'true' : 'false') + '">' + esc(yr) + '(' + st.yrs[yr] + ')</button>';
          }).join('') + '</div>')
        : '<div class="ld-sub"><span>' + esc(LD.emptyLabel || '등록 대기 (신규 지역 준비)') + '</span></div>';

      cardsHtml += '<div class="ld-item' + (TRACK_FILTER === t.id ? ' on' : '') + '">' +
        '<button type="button" class="ld-item-btn" data-ld-track="' + esc(t.id) + '" title="' + esc(t.name) + '" aria-pressed="' + (TRACK_FILTER === t.id ? 'true' : 'false') + '">' +
          '<span class="ld-item-name">' + esc((t.icon || '🏛️') + ' ' + trackShortLabel(t)) + '</span>' +
          '<span class="chip ' + (st.total > 0 ? 'c-blue' : '') + '">' + st.total + '건</span>' +
        '</button>' +
        '<div class="ld-sub"><span>진행 ' + st.active + '</span><span>완료 ' + st.done + '</span>' +
          (st.cand ? ('<span class="chip c-amber">후보 ' + st.cand + '</span>') : '') +
        '</div>' +
        yrsHtml +
      '</div>';
    });

    var scopeProjs = TRACK_FILTER ? allProjs.filter(function (p) { return p.trackId === TRACK_FILTER; }) : allProjs;
    var scopeYrsMap = Object.create(null);
    scopeProjs.forEach(function (p) {
      var y = String(num(p.year, CUR_YEAR));
      scopeYrsMap[y] = (scopeYrsMap[y] || 0) + 1;
    });
    var scopeYrs = Object.keys(scopeYrsMap).sort(function (a, b) { return Number(b) - Number(a); });
    var actObj = activeTrackObj();
    var scopeTitle = actObj ? trackShortLabel(actObj) : (LD.scopeAll || '전체 상의');

    aside.innerHTML =
      '<div class="ld-hd"><span>' + esc(LD.headLabel || '🏬 지역별 대시보드') + '</span>' + (DIFF_HIGHLIGHT ? '<span class="chip c-blue">분리됨</span>' : '<span class="chip">' + tracks.length + '곳</span>') + '</div>' +
      '<div class="ld-list">' + cardsHtml + '</div>' +
      (cat.regionManageable === false ? '' : '<button type="button" class="sm ld-add-btn" id="ldAddRegionBtn">+ 새 지역 상공회의소 추가</button>') +
      '<div class="ld-year-box">' +
        '<div class="ld-year-hd">📅 연도별 관리 · ' + esc(scopeTitle) + ' (' + scopeProjs.length + '건)</div>' +
        '<div class="ld-yrs">' +
          '<button type="button" class="ld-yr-btn' + (!YEAR_FILTER ? ' on' : '') + '" data-ld-yronly="" aria-pressed="' + (!YEAR_FILTER ? 'true' : 'false') + '">전체(' + scopeProjs.length + ')</button>' +
          scopeYrs.map(function (yr) {
            var yOn = YEAR_FILTER === yr;
            return '<button type="button" class="ld-yr-btn' + (yOn ? ' on' : '') + '" data-ld-yronly="' + esc(yr) + '" aria-pressed="' + (yOn ? 'true' : 'false') + '">' + esc(yr) + '(' + scopeYrsMap[yr] + ')</button>';
          }).join('') +
        '</div>' +
      '</div>';

    aside.querySelectorAll('[data-ld-track]').forEach(function (btn) {
      btn.onclick = function () {
        var tid = btn.getAttribute('data-ld-track') || '';
        var yrAttr = btn.getAttribute('data-ld-year');
        if (yrAttr !== null) YEAR_FILTER = yrAttr;
        else if (!tid || TRACK_FILTER === tid) YEAR_FILTER = '';
        TRACK_FILTER = tid;
        SHOW_ALL_ROWS = false;
        if ($('projTrackSel')) $('projTrackSel').value = TRACK_FILTER;
        if ($('yrTrackSel')) $('yrTrackSel').value = TRACK_FILTER;
        if ($('projYrSel')) $('projYrSel').value = YEAR_FILTER;
        if (CUR_TAB === 'detail' || CUR_TAB === 'report') switchTab('projects');
        else draw();
      };
    });
    aside.querySelectorAll('[data-ld-yronly]').forEach(function (btn) {
      btn.onclick = function () {
        YEAR_FILTER = btn.getAttribute('data-ld-yronly') || '';
        SHOW_ALL_ROWS = false;
        if ($('projYrSel')) $('projYrSel').value = YEAR_FILTER;
        if (CUR_TAB === 'detail' || CUR_TAB === 'report') switchTab('projects');
        else draw();
      };
    });
    if ($('ldAddRegionBtn')) $('ldAddRegionBtn').onclick = openAddRegionModal;
    void cat;
  }
  function diffCls(on) { return (DIFF_HIGHLIGHT && on) ? ' code-diff-box' : ''; }
  function diffBadge(label) { return DIFF_HIGHLIGHT ? ' <span class="chip c-blue">' + esc(label || '변경됨') + '</span>' : ''; }

  function updateTabCounts() {
    var pList = projectsList();
    var cands = (D.discover && D.discover.bundles) || [];
    if ($('nProjects')) $('nProjects').textContent = String(pList.length);
    if ($('nInbox')) $('nInbox').textContent = String(cands.length);
    if ($('nYearly')) $('nYearly').textContent = String(pList.length + cands.length);
  }

  function fillSelectKeepingValue(el, optionsHtml, val) {
    if (!el) return;
    el.innerHTML = optionsHtml;
    el.value = str(val);
    if (el.value !== str(val)) el.value = '';
  }

  function renderYearButtonsBar(elId, mode, items) {
    var bar = $(elId);
    if (!bar) return;
    var map = Object.create(null);
    items.forEach(function (x) {
      var yr = String(num(x.year, 2026));
      map[yr] = (map[yr] || 0) + 1;
    });
    if (YEAR_FILTER && !map[YEAR_FILTER]) map[YEAR_FILTER] = 0;
    var yrs = Object.keys(map).sort(function (a, b) { return Number(b) - Number(a); });
    var lbl = mode === 'inbox' ? '수신 연도:' : '연도별 필터:';
    var allOn = YEAR_FILTER === '';
    bar.innerHTML = '<span class="scope-lbl">' + lbl + '</span>' +
      '<button type="button" class="scope-btn' + (allOn ? ' on' : '') + '" aria-pressed="' + (allOn ? 'true' : 'false') + '" data-yr-set="">전체 (' + items.length + ')</button>' +
      yrs.map(function (yr) {
        var on = YEAR_FILTER === yr;
        return '<button type="button" class="scope-btn' + (on ? ' on' : '') + '" aria-pressed="' + (on ? 'true' : 'false') + '" data-yr-set="' + esc(yr) + '">' + esc(yr) + '년 (' + map[yr] + ')</button>';
      }).join('');
    bar.querySelectorAll('[data-yr-set]').forEach(function (b) {
      b.onclick = function () {
        YEAR_FILTER = b.getAttribute('data-yr-set') || '';
        SHOW_ALL_ROWS = false;
        if ($('projYrSel')) $('projYrSel').value = YEAR_FILTER;
        draw();
      };
    });
    // 폰 화면 연도 드롭다운 통일: 같은 .pane > .card .bar 에 #projYrSel 이 없으면 동적 연도 드롭다운을 동기화
    var pane = bar.closest ? bar.closest('.pane') : null;
    var toolBar = pane && pane.querySelector('.card:not(.hi-top-strip) .bar');
    if (toolBar && !toolBar.querySelector('#projYrSel') && typeof document !== 'undefined') {
      var phoneSel = toolBar.querySelector('.pu-phone-yr-sel[data-phone-yr-for="' + elId + '"]');
      if (!phoneSel) {
        phoneSel = document.createElement('select');
        phoneSel.className = 'pu-phone-yr-sel';
        phoneSel.setAttribute('data-phone-yr-for', elId);
        phoneSel.setAttribute('aria-label', lbl.replace(/[:：\s]+$/, ''));
        var qInp = toolBar.querySelector('input[type="search"], input[type="text"]');
        if (qInp && qInp.nextSibling) toolBar.insertBefore(phoneSel, qInp.nextSibling);
        else toolBar.insertBefore(phoneSel, toolBar.firstChild);
      }
      var selOpts = '<option value="">연도 전체</option>' + yrs.map(function (yr) {
        return '<option value="' + esc(yr) + '">' + esc(yr) + '년 (' + map[yr] + ')</option>';
      }).join('');
      fillSelectKeepingValue(phoneSel, selOpts, YEAR_FILTER);
      phoneSel.onchange = function () {
        YEAR_FILTER = phoneSel.value || '';
        SHOW_ALL_ROWS = false;
        if ($('projYrSel')) $('projYrSel').value = YEAR_FILTER;
        draw();
      };
    }
  }

  function stepsRibbonHtml(proj) {
    var stages = getAppCat().stages || [];
    var curIdx = Math.max(0, stages.findIndex(function (s) { return s.id === (proj.stage || 'intake'); }));
    return '<div class="ws-steps">' + stages.map(function (s, idx) {
      var done = idx < curIdx || proj.status === 'done';
      var cur = !done && idx === curIdx;
      var cls = 'ws-step' + (done ? ' done' : cur ? ' cur' : '');
      var prefix = done ? '✓ ' : (cur ? '● ' : '');
      return '<button type="button" class="' + cls + '" data-stage-set="' + esc(s.id) + '" title="' + esc(s.desc || s.name) + ' — 클릭해 단계 변경"><b>' + prefix + s.no + '. ' + esc(s.name) + '</b></button>';
    }).join('') + '</div>';
  }

  function projectPickerBarHtml(proj, mode) {
    var list = projectsList();
    var opts = list.map(function (p) {
      return '<option value="' + esc(p.id) + '"' + (p.id === proj.id ? ' selected' : '') + '>' + esc('[' + (p.year || 2026) + '] ' + p.companyName + ' — ' + (p.trackName || getAppCat().shortName)) + '</option>';
    }).join('');
    var switchBtn = mode === 'report'
      ? '<button type="button" class="sm" data-ws-nav="detail">📋 진행·체크·자료 (' + getProjectComms(proj.id).length + ')</button>'
      : '<button type="button" class="sm pri" data-ws-nav="report">⚖️ 보고서 · RAG 코치</button>';
    // 가벼운 화면은 일반 보고서 원고를 접어 두므로 «좌우 2단 · 코치 집중 · 보고서 집중» 전환 단추도 두지 않는다
    var focusBtns = (mode === 'report' && !isSlim())
      ? ('<button type="button" class="sm' + (!WS_FOCUS ? ' pri' : '') + '" data-focus="" title="RAG 코치(왼쪽)와 보고서(오른쪽)를 나란히 봅니다">좌우 2단</button>' +
         '<button type="button" class="sm' + (WS_FOCUS === 'coach' ? ' pri' : '') + '" data-focus="coach" title="RAG 코치·플레이북만 크게 봅니다">🧠 코치 집중</button>' +
         '<button type="button" class="sm' + (WS_FOCUS === 'doc' ? ' pri' : '') + '" data-focus="doc" title="보고서 편집·A4 미리보기만 크게 봅니다">📄 보고서 집중</button>')
      : '';
    var toggleDoneLbl = proj.status === 'done' ? '🔄 진행 중으로 되돌리기' : '✅ 수행 완료로 표시';
    return '<div class="bar">' +
      '<select id="wsProjPick" aria-label="작업 사업장 선택" style="min-width:210px;max-width:340px">' + opts + '</select>' +
      switchBtn +
      focusBtns +
      '<span class="sp"></span>' +
      '<details class="act-menu"><summary>⋯ 도구</summary><div class="act-pop">' +
        '<button type="button" data-ws-act="editProj">✏️ 사업 정보(연도·지역·사건번호) 수정</button>' +
        '<button type="button" data-ws-act="newProj">+ 새 사업 등록</button>' +
        '<button type="button" data-ws-act="rescan">🔄 메일·카톡 재스캔</button>' +
        '<button type="button" data-ws-act="toggleStatus">' + toggleDoneLbl + '</button>' +
        '<button type="button" data-ws-act="deleteProj">🗑 사업 보관삭제</button>' +
      '</div></details>' +
    '</div>' +
    stepsRibbonHtml(proj);
  }

  function bindProjectPickerBar(container, proj) {
    if (!container || !proj) return;
    var sel = $('wsProjPick');
    if (sel) sel.onchange = function () { CUR_PID = sel.value; draw(); };
    container.querySelectorAll('[data-ws-nav]').forEach(function (b) {
      b.onclick = function () { switchTab(b.getAttribute('data-ws-nav')); };
    });
    container.querySelectorAll('[data-focus]').forEach(function (b) {
      b.onclick = function () {
        captureReportUiState();
        WS_FOCUS = b.getAttribute('data-focus') || '';
        renderReportPane();
      };
    });
    container.querySelectorAll('[data-stage-set]').forEach(function (b) {
      b.onclick = function () { setProjectStage(proj.id, b.getAttribute('data-stage-set')); };
    });
    container.querySelectorAll('[data-ws-act]').forEach(function (b) {
      b.onclick = function () {
        var act = b.getAttribute('data-ws-act');
        if (act === 'editProj') openEditProjectModal(proj);
        else if (act === 'newProj') openNewProjectModal();
        else if (act === 'rescan') { rebuildDiscoverAndRag(); draw(); toast('메일·카톡 자동분류를 재실행했습니다.'); }
        else if (act === 'toggleStatus') toggleProjectDone(proj.id);
        else if (act === 'deleteProj') handleDeleteProject(proj.id);
      };
    });
  }

  /* ══ 4. 탭 1: 📂 사업 현황 (pu-harass drawCasesPane 규격) ══════════════ */
  // 진행상태 거르기 — 드롭다운이 있으면 그 값, 없으면(가벼운 화면) KPI 알약이 정한 값
  function stFilter() { var el = $('projSt'); return el ? str(el.value) : ST_FILTER; }
  function setStFilter(v) { ST_FILTER = str(v); var el = $('projSt'); if (el) el.value = ST_FILTER; }
  // 자동으로 만들어진 메모(「[ERP] ERP 수임(번호)」·「[메일] 메일 N통 자동분류」)는 번호 칩·자료 칸과 같은 말이라 비워 보인다
  function memoShown(p) {
    var s = str(p && p.summaryNote);
    if (isSlim() && /^\[(ERP|메일|카톡)\]\s*(ERP 수임|(메일|카톡)\s*\d+\s*(통|건)\s*(자동분류|연결))/.test(s)) return '';
    return s;
  }

  function getFilteredProjects() {
    var q = str($('projQ') && $('projQ').value).toLowerCase();
    var st = stFilter();
    var mgr = str($('projMgr') && $('projMgr').value);
    return projectsList().filter(function (p) {
      if (TRACK_FILTER && p.trackId !== TRACK_FILTER) return false;
      if (YEAR_FILTER && String(num(p.year, 2026)) !== YEAR_FILTER) return false;
      if (st === 'done' && p.status !== 'done') return false;
      if (st === 'active' && p.status === 'done') return false;
      if (mgr && str(p.consultantName) !== mgr) return false;
      if (q) {
        var hay = [p.year, p.companyName, p.caseNo, p.trackName, p.consultantName, p.summaryNote, p.inspPeriod, p.inspOffice, p.inspIssues, p.inspDue, p.inspResult].join(' ').toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
  }

  function hasProjFilterActive() {
    return !!(TRACK_FILTER || YEAR_FILTER ||
      str($('projQ') && $('projQ').value) ||
      stFilter() ||
      str($('projMgr') && $('projMgr').value));
  }

  function renderProjectsPane() {
    var cat = getAppCat();
    var tracks = getEffectiveTracks();
    var allProjs = projectsList();
    var cands = (D.discover && D.discover.bundles) || [];
    var hwpx = Hwpx();
    var splitCols = cat.listCols === 'split';
    // 가벼운 화면 + 사업이 한 트랙에만 있으면: 트랙 알약·줄마다 같은 트랙 칩은 되풀이라 걷는다
    var trackIdsAll = Object.create(null);
    allProjs.forEach(function (p) { trackIdsAll[p.trackId || ''] = 1; });
    var oneTrackSlim = isSlim() && Object.keys(trackIdsAll).length <= 1;
    var showRounds = !!roundUnit();

    // 트랙 바 (#projTrackBar)
    var trackBar = $('projTrackBar');
    if (trackBar) {
      var tCounts = Object.create(null);
      var tTotalInYear = 0;
      allProjs.forEach(function (p) {
        if (YEAR_FILTER && String(num(p.year, 2026)) !== YEAR_FILTER) return;
        tTotalInYear++;
        tCounts[p.trackId || ''] = (tCounts[p.trackId || ''] || 0) + 1;
      });
      var btns = ['<span class="scope-lbl">' + esc(cat.regionLabel || '세부 트랙') + ':</span>',
        '<button type="button" class="scope-btn' + (!TRACK_FILTER ? ' on' : '') + '" aria-pressed="' + (!TRACK_FILTER ? 'true' : 'false') + '" data-track-set="">전체 (' + tTotalInYear + ')</button>'
      ];
      tracks.forEach(function (t) {
        var cnt = tCounts[t.id] || 0;
        var on = TRACK_FILTER === t.id;
        btns.push('<button type="button" class="scope-btn' + (on ? ' on' : (cnt > 0 ? ' ok' : '')) + '" aria-pressed="' + (on ? 'true' : 'false') + '" data-track-set="' + esc(t.id) + '" title="' + esc(t.name) + '">' + esc(trackShortLabel(t)) + ' (' + cnt + ')</button>');
      });
      trackBar.innerHTML = btns.join('');
      // 가벼운 화면: 사업이 한 트랙에만 있으면 «전체(108) · 그 트랙(108) · 빈 트랙(0)…» 알약은 같은 말의 되풀이라 감춘다.
      // (트랙은 [+ 새 사업 등록] 창에서 그대로 고를 수 있다)
      trackBar.style.display = (oneTrackSlim && !TRACK_FILTER) ? 'none' : '';
      trackBar.querySelectorAll('[data-track-set]').forEach(function (b) {
        b.onclick = function () {
          TRACK_FILTER = b.getAttribute('data-track-set') || '';
          SHOW_ALL_ROWS = false;
          if ($('projTrackSel')) $('projTrackSel').value = TRACK_FILTER;
          if ($('yrTrackSel')) $('yrTrackSel').value = TRACK_FILTER;
          draw();
        };
      });
    }

    // 연도별 빠른 필터 바 (#projYrBar — 전 12개 앱 연도별 관리)
    var trackScopedProjs = TRACK_FILTER ? allProjs.filter(function (p) { return p.trackId === TRACK_FILTER; }) : allProjs;
    renderYearButtonsBar('projYrBar', 'all', trackScopedProjs);

    // 초소형 1줄 KPI 배지 (#kpiBox — 선택된 지역/연도 범위 기준)
    var kpiBox = $('kpiBox');
    if (kpiBox) {
      var kpiScope = trackScopedProjs.filter(function (p) {
        return !YEAR_FILTER || String(num(p.year, 2026)) === YEAR_FILTER;
      });
      var doneCnt = kpiScope.filter(function (x) { return x.status === 'done'; }).length;
      var activeCnt = kpiScope.length - doneCnt;
      var totalComms = kpiScope.reduce(function (s, p) { return s + getProjectComms(p.id).length; }, 0);
      var scopedCands = TRACK_FILTER && $('leftDash')
        ? cands.filter(function (b) { return str(b.suggestedTrackId) === TRACK_FILTER; })
        : cands;
      var stVal = stFilter();
      var allOn = !stVal;
      var doneOn = stVal === 'done';
      var activeOn = stVal === 'active';
      var actTrack = activeTrackObj();
      var scopeTag = (actTrack || YEAR_FILTER)
        ? ('<span class="chip c-blue">' + esc((actTrack ? trackShortLabel(actTrack) : '전체') + (YEAR_FILTER ? (' · ' + YEAR_FILTER + '년') : '')) + '</span>')
        : '';
      kpiBox.innerHTML = scopeTag +
        '<div class="kpi k-blue' + (allOn ? ' k-on' : '') + '" data-act="kpiSt" data-id="" role="button" tabindex="0" aria-pressed="' + (allOn ? 'true' : 'false') + '"><span>총 사업</span><b>' + kpiScope.length + '건</b></div>' +
        '<div class="kpi k-green' + (doneOn ? ' k-on' : '') + '" data-act="kpiSt" data-id="done" role="button" tabindex="0" aria-pressed="' + (doneOn ? 'true' : 'false') + '"><span>완료</span><b>' + doneCnt + '건</b></div>' +
        '<div class="kpi k-amber' + (activeOn ? ' k-on' : '') + '" data-act="kpiSt" data-id="active" role="button" tabindex="0" aria-pressed="' + (activeOn ? 'true' : 'false') + '"><span>진행중</span><b>' + activeCnt + '건</b></div>' +
        '<div class="kpi k-blue"><span>수집자료</span><b>' + totalComms + '건</b></div>' +
        roundKpiHtml(kpiScope) +
        // 미등록 후보는 «📥 미등록 후보» 탭 이름표에 이미 건수가 있다 — 가벼운 화면은 되풀이하지 않는다
        ((!isSlim() && scopedCands.length > 0) ? '<div class="kpi k-amber" data-act="goInbox" role="button" tabindex="0" title="미등록 후보 탭으로 이동"><span>미등록후보</span><b>' + scopedCands.length + '곳</b></div>' : '');
      kpiBox.querySelectorAll('[data-act="kpiSt"]').forEach(function (k) {
        k.onclick = function () {
          setStFilter(k.getAttribute('data-id') || '');
          renderProjectsPane();
        };
        k.onkeydown = function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); k.click(); }
        };
      });
      kpiBox.querySelectorAll('[data-act="goInbox"]').forEach(function (k) {
        k.onclick = function () { switchTab('inbox'); };
        k.onkeydown = function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); k.click(); }
        };
      });
    }

    // 필터 셀렉트 동기화
    fillSelectKeepingValue($('projTrackSel'),
      '<option value="">' + esc(cat.listCols === 'split' ? ((cat.regionLabel || '트랙') + ' 전체') : '트랙 전체') + '</option>' + tracks.map(function (t) { return '<option value="' + esc(t.id) + '">' + esc(trackShortLabel(t)) + '</option>'; }).join(''),
      TRACK_FILTER);
    var yrsCount = Object.create(null);
    allProjs.forEach(function (p) {
      var yk = String(num(p.year, 2026));
      yrsCount[yk] = (yrsCount[yk] || 0) + 1;
    });
    if (YEAR_FILTER && !yrsCount[YEAR_FILTER]) yrsCount[YEAR_FILTER] = 0;
    fillSelectKeepingValue($('projYrSel'),
      '<option value="">연도 전체</option>' + Object.keys(yrsCount).sort(function (a, b) { return Number(b) - Number(a); }).map(function (y) { return '<option value="' + esc(y) + '">' + esc(y) + '년 (' + yrsCount[y] + ')</option>'; }).join(''),
      YEAR_FILTER);
    var mgrs = Object.create(null);
    allProjs.forEach(function (p) { if (p.consultantName) mgrs[p.consultantName] = 1; });
    fillSelectKeepingValue($('projMgr'),
      '<option value="">담당 노무사 전체</option>' + Object.keys(mgrs).sort().map(function (m) { return '<option value="' + esc(m) + '">' + esc(m) + '</option>'; }).join(''),
      $('projMgr') && $('projMgr').value);
    if ($('projResetBtn')) $('projResetBtn').style.display = hasProjFilterActive() ? '' : 'none';

    var box = $('projectsBox');
    if (!box) return;
    var filtered = getFilteredProjects();
    if (!filtered.length) {
      box.innerHTML = '<div class="empty">조건에 맞는 ' + esc(cat.name) + ' 사업장이 없습니다. ' +
        (cands.length ? ('<b>📥 미등록 후보(' + cands.length + '곳)</b>에서 1클릭 등록하거나 ') : '') +
        '<b>[+ 새 사업 등록]</b>을 눌러 추가하세요.</div>';
      return;
    }

    var rowCap = SHOW_ALL_ROWS ? filtered.length : 120;
    var shown = filtered.slice(0, rowCap);
    var selPids = shown.filter(function (p) { return SEL['p:' + p.id]; });
    var allProjChecked = shown.length > 0 && selPids.length === shown.length;
    var bulkHtml = '<div class="bulk' + (selPids.length ? ' on' : '') + '" id="projBulkBar">' +
      '<b id="projBulkCount">' + selPids.length + '건 선택</b>' +
      '<button type="button" class="sm ok" id="bulkDoneProjBtn">✅ 완료 처리</button>' +
      '<button type="button" class="sm danger" id="bulkDelProjBtn">🗑 선택 보관삭제</button>' +
      '<button type="button" class="sm" id="bulkClearProjBtn">해제</button>' +
      '</div>';

    var isInsp = (APP_KEY === 'laboraudit');
    var trs = shown.map(function (p, i) {
      var ckKey = 'p:' + p.id;
      var clsList = [];
      if (splitCols) clsList.push('split-row');
      if (p.id === CUR_PID) clsList.push('cur');
      if (p.status === 'done') clsList.push('perf-direct');
      var trAttr = clsList.length ? (' class="' + clsList.join(' ') + '"') : '';
      var commCnt = getProjectComms(p.id).length;
      var sum = hwpx ? hwpx.buildSummary(APP_KEY, p, getCheckDoc(p.id), []) : { overallPct: 0 };
      var stChip = p.status === 'done' ? '<span class="chip c-green pm-st">완료</span>' : '<span class="chip c-amber pm-st">진행중</span>';
      var trObj = tracks.find(function (t) { return t.id === p.trackId; });
      var trLbl = trObj ? trackShortLabel(trObj) : (p.trackName || cat.shortName);
      var caseTag = p.caseNo ? (' <span class="chip">' + esc(p.caseNo) + '</span>') : '';
      if (splitCols) {
        // 연도 · 사업장명 · 지역 · 진행상태를 각각 독립 열로 — 세로줄이 일직선 (서류-목록-표준형태 ②)
        return '<tr data-row="' + esc(p.id) + '"' + trAttr + '>' +
          '<td class="c"><input type="checkbox" data-ck="' + esc(ckKey) + '" data-list="proj"' + (SEL[ckKey] ? ' checked' : '') + ' aria-label="' + esc(p.companyName) + ' 선택"></td>' +
          '<td class="n">' + (i + 1) + '</td>' +
          '<td class="yr" title="' + esc(String(p.year || 2026)) + '년">' + esc(String(p.year || 2026)) + '</td>' +
          '<td class="ti" title="' + esc(p.companyName) + '">' + esc(p.companyName) + caseTag + '</td>' +
          '<td data-k="badge" title="' + esc(p.trackName || trLbl) + '"><span class="chip c-blue">' + esc(trLbl) + '</span></td>' +
          '<td data-k="st">' + stChip + '</td>' +
          '<td data-k="pc-only" title="' + esc(p.consultantName || '-') + '">' + esc(p.consultantName || '-') + '</td>' +
          '<td data-k="pc-only" title="6단계 진행현황">' + stepDotsHtml(p.stage, p.status) + '</td>' +
          '<td data-k="pc-only" title="수집자료 ' + commCnt + '건 · 체크 준비도 ' + sum.overallPct + '%"><span class="chip c-blue">📧 ' + commCnt + '</span> <span class="chip">' + sum.overallPct + '%</span></td>' +
          '<td class="wide" title="' + esc(p.summaryNote || '-') + '">' + esc(p.summaryNote || '-') + '</td>' +
          '<td data-k="act"><button type="button" class="sm pri" data-pick="' + esc(p.id) + '" data-pm-act="1">진행·체크</button> <button type="button" class="sm" data-open-report="' + esc(p.id) + '">📄 보고서</button></td>' +
        '</tr>';
      }
      var rowBodyCols;
      if (isInsp) {
        var resChip = p.inspResult ? (' <span class="chip ' + (p.inspResult.indexOf('완료') >= 0 || p.inspResult.indexOf('없음') >= 0 ? 'c-green' : 'c-amber') + '">' + esc(p.inspResult) + '</span>') : '';
        var periodHtml = p.inspPeriod ? esc(p.inspPeriod) : '<span class="hint">기간 미입력</span>';
        var officeHtml = p.inspOffice ? (' <span class="hint">· ' + esc(p.inspOffice) + '</span>') : '';
        var issuesTxt = p.inspIssues || p.summaryNote || '-';
        var dueHtml = p.inspDue ? (' <span class="hint">· 기한 ' + esc(p.inspDue) + '</span>') : '';
        var issuesTitle = p.inspDue ? (issuesTxt + ' (시정기한: ' + p.inspDue + ')') : issuesTxt;
        rowBodyCols =
          '<td data-k="badge" title="' + esc(p.trackName || trLbl) + '"><span class="chip c-blue pm-tr">' + esc(trLbl) + '</span> ' + stChip + resChip + '</td>' +
          '<td data-k="pc-only" title="' + esc([p.inspPeriod, p.inspOffice].filter(Boolean).join(' · ')) + '">' + periodHtml + officeHtml + '</td>' +
          '<td class="wide" title="' + esc(issuesTitle) + '">' + esc(issuesTxt) + dueHtml + '</td>' +
          '<td data-k="pc-only" title="6단계 진행현황">' + stepDotsHtml(p.stage, p.status) + '</td>' +
          '<td data-k="pc-only" title="수집자료 ' + commCnt + '건 · 체크 준비도 ' + sum.overallPct + '%"><span class="chip c-blue">📧 ' + commCnt + '</span> <span class="chip">' + sum.overallPct + '%</span></td>';
      } else {
        rowBodyCols =
          '<td data-k="badge" title="' + esc(p.trackName || trLbl) + '">' + (oneTrackSlim ? '' : '<span class="chip c-blue pm-tr">' + esc(trLbl) + '</span> ') + stChip + '</td>' +
          (showRounds ? '<td data-k="rd">' + roundChipsHtml(p) + '</td>' : '') +
          '<td data-k="pc-only" title="' + esc(p.consultantName || '-') + '">' + esc(p.consultantName || '-') + '</td>' +
          '<td data-k="pc-only" title="6단계 진행현황">' + stepDotsHtml(p.stage, p.status) + '</td>' +
          '<td data-k="pc-only" title="수집자료 ' + commCnt + '건 · 체크 준비도 ' + sum.overallPct + '%"><span class="chip c-blue">📧 ' + commCnt + '</span> <span class="chip">' + sum.overallPct + '%</span></td>' +
          '<td class="wide" title="' + esc(memoShown(p) || '-') + '">' + esc(memoShown(p) || '-') + '</td>';
      }
      return '<tr data-row="' + esc(p.id) + '"' + trAttr + '>' +
        '<td class="c"><input type="checkbox" data-ck="' + esc(ckKey) + '" data-list="proj"' + (SEL[ckKey] ? ' checked' : '') + ' aria-label="' + esc(p.companyName) + ' 선택"></td>' +
        '<td class="n">' + (i + 1) + '</td>' +
        '<td class="ti" title="' + esc(p.companyName) + '"><span class="chip">' + esc(String(p.year || 2026)) + '</span> ' + esc(p.companyName) + caseTag + '</td>' +
        rowBodyCols +
        '<td data-k="act"><button type="button" class="sm pri" data-pick="' + esc(p.id) + '" data-pm-act="1">진행·체크</button> <button type="button" class="sm" data-open-report="' + esc(p.id) + '">📄 보고서</button></td>' +
      '</tr>';
    }).join('');

    var moreHtml = filtered.length > shown.length
      ? ('<div class="bar"><span class="hint">총 ' + filtered.length + '건 중 ' + shown.length + '건 표시</span><button type="button" class="sm pri" id="showAllProjBtn">전체 ' + filtered.length + '건 모두 보기 (+' + (filtered.length - shown.length) + ')</button></div>')
      : '';

    var diffMark = (isInsp && DIFF_HIGHLIGHT) ? (' ' + diffBadge('개편')) : '';
    var headCols = splitCols
      ? '<th class="yr">연도</th><th>사업장명</th><th data-k="badge">' + esc(cat.regionLabel || '세부 트랙') + '</th><th data-k="st">진행상태</th><th>담당 노무사</th><th>6단계 진행현황</th><th>자료 · 점검</th><th class="wide">요약 메모</th><th data-k="act">열기</th>'
      : (isInsp
        ? ('<th>사업장 · 연도</th><th>감독 유형 · 결과' + diffMark + '</th><th>감독 기간 · 관할지청' + diffMark + '</th><th class="wide">지적 · 시정지시 사항' + diffMark + '</th><th>6단계 진행현황</th><th>자료 · 점검</th><th data-k="act">열기</th>')
        : ('<th>사업장 · 연도</th><th>' + (oneTrackSlim ? '상태' : '트랙 · 상태') + '</th>' + (showRounds ? '<th data-k="rd">회차</th>' : '') + '<th>담당 노무사</th><th>6단계 진행현황</th><th>자료 · 점검</th><th class="wide">요약 메모</th><th data-k="act">열기</th>'));
    box.innerHTML = bulkHtml + '<div class="scroll' + (isInsp ? diffCls(true) : '') + '"><table class="t" data-name="cases">' +
      '<thead><tr><th class="c"><input type="checkbox" data-ckall="proj"' + (allProjChecked ? ' checked' : '') + ' aria-label="전체 선택"></th><th class="n">№</th>' + headCols + '</tr></thead>' +
      '<tbody>' + trs + '</tbody></table></div>' + moreHtml;

    refreshProjBulkUi();
    if ($('showAllProjBtn')) $('showAllProjBtn').onclick = function () { SHOW_ALL_ROWS = true; renderProjectsPane(); };

    box.querySelectorAll('[data-pick]').forEach(function (b) {
      b.onclick = function (e) { e.stopPropagation(); CUR_PID = b.getAttribute('data-pick'); switchTab('detail'); };
    });
    box.querySelectorAll('[data-open-report]').forEach(function (b) {
      b.onclick = function (e) { e.stopPropagation(); CUR_PID = b.getAttribute('data-open-report'); switchTab('report'); };
    });
    box.querySelectorAll('tr[data-row]').forEach(function (tr) {
      tr.onclick = function (e) {
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON' || e.target.tagName === 'A' || (e.target.closest && e.target.closest('input,button,select,a,label,textarea,td.c,th.c')))) return;
        CUR_PID = tr.getAttribute('data-row');
        if (typeof window !== 'undefined' && window.innerWidth <= 768) { switchTab('detail'); return; }
        renderProjectsPane();
      };
    });
    if ($('bulkDoneProjBtn')) $('bulkDoneProjBtn').onclick = function () {
      var curSel = getFilteredProjects().filter(function (p) { return SEL['p:' + p.id]; });
      bulkUpdateProjectsDone(curSel);
    };
    if ($('bulkDelProjBtn')) $('bulkDelProjBtn').onclick = function () {
      var curSel = getFilteredProjects().filter(function (p) { return SEL['p:' + p.id]; });
      bulkDeleteProjects(curSel);
    };
    if ($('bulkClearProjBtn')) $('bulkClearProjBtn').onclick = function () {
      SEL = Object.create(null);
      box.querySelectorAll('input[type="checkbox"][data-list="proj"]').forEach(function (cb) { cb.checked = false; });
      refreshProjBulkUi();
    };
  }

  function refreshProjBulkUi() {
    var box = $('projectsBox');
    if (!box) return;
    var list = box.querySelectorAll('input[type="checkbox"][data-list="proj"]');
    var checkedCount = 0;
    list.forEach(function (cb) { if (cb.checked) checkedCount++; });
    var bar = $('projBulkBar');
    var cntEl = $('projBulkCount');
    if (bar) bar.classList.toggle('on', checkedCount > 0);
    if (cntEl) cntEl.textContent = checkedCount + '건 선택';
    var hdr = box.querySelector('input[type="checkbox"][data-ckall="proj"]');
    if (hdr) {
      hdr.checked = list.length > 0 && checkedCount === list.length;
      hdr.indeterminate = checkedCount > 0 && checkedCount < list.length;
    }
  }

  /* ══ 5. 탭 2: 📥 미등록 후보 (pu-harass drawInboxPane 규격) ══════════════ */
  function getFilteredInboxBundles() {
    var allCands = (D.discover && D.discover.bundles) || [];
    var hasLeft = !!$('leftDash');
    var trackCands = (hasLeft && TRACK_FILTER)
      ? allCands.filter(function (b) { return str(b.suggestedTrackId) === TRACK_FILTER; })
      : allCands;
    var q = str($('inQ') && $('inQ').value).toLowerCase();
    var list = trackCands.filter(function (b) {
      if (YEAR_FILTER && String(num(b.year, 2026)) !== YEAR_FILTER) return false;
      if (!q) return true;
      var hay = [b.year, b.companyName, b.suggestedTrackName, b.caseNo].concat(b.sampleSubjects || []).concat(b.reasonsList || []).join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
    return { trackCands: trackCands, list: list, q: q, hasLeft: hasLeft };
  }

  function refreshCandBulkUi() {
    var box = $('inboxBox');
    if (!box) return;
    var list = box.querySelectorAll('input[type="checkbox"][data-list="cand"]');
    var checkedCount = 0;
    list.forEach(function (cb) { if (cb.checked) checkedCount++; });
    var hdr = box.querySelector('input[type="checkbox"][data-ckall="cand"]');
    if (hdr) {
      hdr.checked = list.length > 0 && checkedCount === list.length;
      hdr.indeterminate = checkedCount > 0 && checkedCount < list.length;
    }
  }

  function renderInboxPane() {
    var tracks = getEffectiveTracks();
    var stats = (D.discover && D.discover.stats) || { mailHits: 0, msgHits: 0, erpHits: 0 };
    var f = getFilteredInboxBundles();
    var trackCands = f.trackCands;
    var list = f.list;
    var q = f.q;
    var hasLeft = f.hasLeft;
    renderYearButtonsBar('inboxYrBar', 'inbox', trackCands);
    if ($('inResetBtn')) $('inResetBtn').style.display = (YEAR_FILTER || q || (hasLeft && TRACK_FILTER)) ? '' : 'none';

    if ($('inboxKpiBox')) {
      var actObj = activeTrackObj();
      var trTag = (hasLeft && actObj) ? ('<span class="chip c-blue">' + esc(trackShortLabel(actObj)) + '</span>') : '';
      $('inboxKpiBox').innerHTML = trTag +
        '<div class="kpi k-amber"><span>미등록 후보</span><b>' + trackCands.length + '묶음</b></div>' +
        ((YEAR_FILTER || q) ? '<div class="kpi k-blue"><span>필터 결과</span><b>' + list.length + '묶음</b></div>' : '') +
        '<div class="kpi"><span>감지 메일</span><b>' + num(stats.mailHits, 0).toLocaleString() + '통</b></div>' +
        '<div class="kpi k-blue"><span>카톡·문자</span><b>' + num(stats.msgHits, 0).toLocaleString() + '건</b></div>';
    }

    var box = $('inboxBox');
    if (!box) return;
    if (!list.length) {
      box.innerHTML = '<div class="empty">조건에 맞는 미등록 후보 묶음이 없습니다. 상단 [🔄 자동수집 · 동기화] 또는 [🔍 메일·카톡 재스캔]을 눌러 최신 자료를 스캔할 수 있습니다.</div>';
      return;
    }

    var shown = list.slice(0, 120);
    var trs = shown.map(function (b, i) {
      var ckKey = 'd:' + b.key;
      var coBadge = b.companyId ? '<span class="chip c-green">업체원장 일치</span> ' : (b.suggestedCompanyId ? '<span class="chip c-amber">업체명 후보</span> ' : (b.isAgencyNotice ? '<span class="chip">기관공지</span> ' : '<span class="chip c-amber">신규·키워드</span> '));
      var trObj = tracks.find(function (t) { return t.id === b.suggestedTrackId; });
      var trTag = trObj ? ('<span class="chip c-blue">' + esc(trackShortLabel(trObj)) + '</span> ') : '';
      var badgeTxt = '메일 ' + b.mailCount + ' · 톡 ' + b.msgCount + (b.erpCount ? (' · ERP ' + b.erpCount) : '');
      var sampleTxt = (b.sampleSubjects || [])[0] || '-';
      return '<tr data-cand="' + esc(b.key) + '">' +
        '<td class="c"><input type="checkbox" data-ck="' + esc(ckKey) + '" data-list="cand"' + (SEL[ckKey] ? ' checked' : '') + ' aria-label="' + esc(b.companyName) + ' 선택"></td>' +
        '<td class="n">' + (i + 1) + '</td>' +
        '<td class="ti" title="' + esc(b.companyName) + '"><span class="chip">' + esc(String(b.year || 2026)) + '</span> ' + coBadge + esc(b.companyName) + '</td>' +
        '<td data-k="badge" title="' + esc(badgeTxt) + '">' + trTag + '<span class="chip c-blue">' + esc(badgeTxt) + '</span></td>' +
        '<td data-k="pc-only" title="' + esc(b.latestDate || '-') + '">' + esc(b.latestDate || '-') + '</td>' +
        '<td class="wide" title="' + esc(sampleTxt) + '">' + esc(sampleTxt) + '</td>' +
        '<td data-k="act"><button type="button" class="sm pri" data-import-cand="' + esc(b.key) + '" data-pm-act="1">📥 1클릭 등록</button> <button type="button" class="sm" data-preview-cand="' + esc(b.key) + '">👁 미리보기</button></td>' +
      '</tr>';
    }).join('');

    box.innerHTML = '<div class="scroll"><table class="t" data-name="bundles">' +
      '<thead><tr><th class="c"><input type="checkbox" data-ckall="cand" aria-label="후보 전체 선택"></th><th class="n">№</th><th>추정 기업 · 연도</th><th>지역 · 감지 출처</th><th>최근 일자</th><th class="wide">대표 수신 제목</th><th data-k="act">작업</th></tr></thead>' +
      '<tbody>' + trs + '</tbody></table></div>';

    refreshCandBulkUi();
    box.querySelectorAll('[data-import-cand]').forEach(function (b) {
      b.onclick = function () { importCandidateByKey(b.getAttribute('data-import-cand')); };
    });
    box.querySelectorAll('[data-preview-cand]').forEach(function (b) {
      b.onclick = function () { openBundlePreviewModal(b.getAttribute('data-preview-cand')); };
    });
    box.querySelectorAll('tr[data-cand]').forEach(function (tr) {
      tr.onclick = function (e) {
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON' || e.target.tagName === 'A' || (e.target.closest && e.target.closest('input,button,select,a,label,textarea,td.c,th.c')))) return;
        if (typeof window !== 'undefined' && window.innerWidth <= 768) openBundlePreviewModal(tr.getAttribute('data-cand'));
      };
    });
  }

  /* ══ 6. 탭 3: 📅 연도별 자료함 (pu-harass drawYearlyPane 규격) ═════════ */
  function renderYearlyPane() {
    var cat = getAppCat();
    var tracks = getEffectiveTracks();
    var allProjs = projectsList();
    var allCands = (D.discover && D.discover.bundles) || [];
    var yrTrack = TRACK_FILTER;
    var combinedAll = allProjs.map(function (p) { return { kind: 'project', year: num(p.year, 2026), item: p }; })
      .concat(allCands.map(function (b) { return { kind: 'bundle', year: num(b.year, 2026), item: b }; }));
    var combinedScoped = yrTrack
      ? combinedAll.filter(function (ent) {
          return ent.kind === 'project' ? (ent.item.trackId === yrTrack) : (str(ent.item.suggestedTrackId) === yrTrack);
        })
      : combinedAll;

    renderYearButtonsBar('yrPillsBar', 'all', combinedScoped);

    var yrQ = str($('yrQ') && $('yrQ').value).toLowerCase();
    var yrKind = str($('yrKind') && $('yrKind').value);

    fillSelectKeepingValue($('yrTrackSel'),
      '<option value="">트랙 전체</option>' + tracks.map(function (t) { return '<option value="' + esc(t.id) + '">' + esc(trackShortLabel(t)) + '</option>'; }).join(''),
      yrTrack);
    if ($('yrResetBtn')) $('yrResetBtn').style.display = (YEAR_FILTER || yrQ || yrTrack || yrKind) ? '' : 'none';

    var scopedProjs = combinedScoped.filter(function (x) { return x.kind === 'project'; }).map(function (x) { return x.item; });
    var scopedCands = combinedScoped.filter(function (x) { return x.kind === 'bundle'; }).map(function (x) { return x.item; });
    var doneCnt = scopedProjs.filter(function (p) { return p.status === 'done'; }).length;
    var commTotal = scopedProjs.reduce(function (s, p) { return s + getProjectComms(p.id).length; }, 0) +
      scopedCands.reduce(function (s, b) { return s + num(b.totalCount, 0); }, 0);
    if ($('yrKpiBox')) {
      var actObj = activeTrackObj();
      var trTag = (yrTrack && actObj) ? ('<span class="chip c-blue">' + esc(trackShortLabel(actObj)) + '</span>') : '';
      $('yrKpiBox').innerHTML = trTag +
        '<div class="kpi k-blue"><span>총 자료</span><b>' + combinedScoped.length + '건</b></div>' +
        '<div class="kpi"><span>등록 사업장</span><b>' + scopedProjs.length + '건</b></div>' +
        '<div class="kpi k-green"><span>수행 완료</span><b>' + doneCnt + '건</b></div>' +
        '<div class="kpi k-amber"><span>미등록 후보</span><b>' + scopedCands.length + '묶음</b></div>' +
        '<div class="kpi k-blue"><span>연계 메일·톡</span><b>' + commTotal.toLocaleString() + '건</b></div>';
    }

    var filtered = combinedScoped.filter(function (ent) {
      if (YEAR_FILTER && String(ent.year) !== YEAR_FILTER) return false;
      if (yrKind && ent.kind !== yrKind) return false;
      if (ent.kind === 'project') {
        var p = ent.item;
        if (yrQ) {
          var hayP = [ent.year, p.companyName, p.trackName, p.caseNo, p.summaryNote, p.inspPeriod, p.inspOffice, p.inspIssues, p.inspDue, p.inspResult].join(' ').toLowerCase();
          if (hayP.indexOf(yrQ) < 0) return false;
        }
      } else {
        var b = ent.item;
        if (yrQ) {
          var hayB = [ent.year, b.companyName, b.suggestedTrackName].concat(b.sampleSubjects || []).join(' ').toLowerCase();
          if (hayB.indexOf(yrQ) < 0) return false;
        }
      }
      return true;
    });

    var box = $('yearlyBox');
    if (!box) return;
    if (!filtered.length) {
      box.innerHTML = '<div class="card"><div class="empty">조건에 맞는 연도별 자료가 없습니다.</div></div>';
      return;
    }

    var byYr = Object.create(null);
    filtered.forEach(function (ent) {
      var y = String(ent.year);
      if (!byYr[y]) byYr[y] = [];
      byYr[y].push(ent);
    });
    var yrs = Object.keys(byYr).sort(function (a, b) { return Number(b) - Number(a); });

    box.innerHTML = yrs.map(function (yr) {
      var grp = byYr[yr];
      var regCnt = grp.filter(function (x) { return x.kind === 'project'; }).length;
      var candCnt = grp.length - regCnt;
      var rowsHtml = grp.slice(0, 200).map(function (ent, idx) {
        if (ent.kind === 'project') {
          var p = ent.item;
          var cls = p.status === 'done' ? ' class="perf-direct"' : '';
          var trObj = tracks.find(function (t) { return t.id === p.trackId; });
          var trLbl = trObj ? trackShortLabel(trObj) : (p.trackName || cat.shortName);
          var yrNote = p.summaryNote || p.inspIssues || '-';
          return '<tr' + cls + '>' +
            '<td class="c"><input type="checkbox" data-ck="yrp:' + esc(p.id) + '" data-list="yr_' + esc(yr) + '" aria-label="선택"></td>' +
            '<td class="n">' + (idx + 1) + '</td>' +
            '<td class="ti" title="' + esc(p.companyName) + '">' + esc(p.companyName) + (p.caseNo ? (' <span class="chip">' + esc(p.caseNo) + '</span>') : '') + '</td>' +
            '<td data-k="badge"><span class="chip c-green">등록 사업</span> <span class="chip c-blue">' + esc(trLbl) + '</span></td>' +
            '<td data-k="pc-only">' + stepDotsHtml(p.stage, p.status) + '</td>' +
            '<td data-k="pc-only">' + esc(safeDate(p.updatedAt)) + '</td>' +
            '<td class="wide" title="' + esc(yrNote) + '">' + esc(yrNote) + '</td>' +
            '<td data-k="act"><button type="button" class="sm pri" data-yr-pick="' + esc(p.id) + '" data-pm-act="1">진행·체크</button> <button type="button" class="sm" data-yr-rpt="' + esc(p.id) + '">보고서</button></td>' +
          '</tr>';
        }
        var b = ent.item;
        var sample = (b.sampleSubjects || [])[0] || '-';
        return '<tr>' +
          '<td class="c"><input type="checkbox" data-ck="yrd:' + esc(b.key) + '" data-list="yr_' + esc(yr) + '" aria-label="선택"></td>' +
          '<td class="n">' + (idx + 1) + '</td>' +
          '<td class="ti" title="' + esc(b.companyName) + '">' + esc(b.companyName) + '</td>' +
          '<td data-k="badge"><span class="chip c-amber">미등록 후보</span>' + (b.suggestedTrackName ? (' <span class="chip">' + esc(b.suggestedTrackName) + '</span>') : '') + '</td>' +
          '<td data-k="pc-only">메일 ' + b.mailCount + ' · 톡 ' + b.msgCount + '</td>' +
          '<td data-k="pc-only">' + esc(b.latestDate || '-') + '</td>' +
          '<td class="wide" title="' + esc(sample) + '">' + esc(sample) + '</td>' +
          '<td data-k="act"><button type="button" class="sm ok" data-yr-import="' + esc(b.key) + '" data-pm-act="1">1클릭 등록</button></td>' +
        '</tr>';
      }).join('');
      return '<div class="card">' +
        '<div class="sec"><span>📅 ' + esc(yr) + '년 (' + grp.length + '건 · 등록 ' + regCnt + ' · 미등록 ' + candCnt + ')</span></div>' +
        '<div class="scroll"><table class="t" data-name="yr_' + esc(yr) + '">' +
          '<thead><tr><th class="c"><input type="checkbox" data-ckall="yr_' + esc(yr) + '" aria-label="전체 선택"></th><th class="n">№</th><th>사업장명</th><th>구분 · 트랙</th><th>진행 · 출처</th><th>최근 일자</th><th class="wide">요약 · 대표 제목</th><th data-k="act">열기</th></tr></thead>' +
          '<tbody>' + rowsHtml + '</tbody></table></div></div>';
    }).join('');

    box.querySelectorAll('[data-yr-pick]').forEach(function (b) {
      b.onclick = function () { CUR_PID = b.getAttribute('data-yr-pick'); switchTab('detail'); };
    });
    box.querySelectorAll('[data-yr-rpt]').forEach(function (b) {
      b.onclick = function () { CUR_PID = b.getAttribute('data-yr-rpt'); switchTab('report'); };
    });
    box.querySelectorAll('[data-yr-import]').forEach(function (b) {
      b.onclick = function () { importCandidateByKey(b.getAttribute('data-yr-import')); };
    });
  }

  /* ══ 7. 탭 4: 📋 진행 · 체크 · 자료 (6단계 리본 + 체크리스트 + 메일/카톡/로컬수집) ══ */
  function renderDetailPane() {
    var box = $('detailBox');
    if (!box) return;
    var proj = projectById(CUR_PID);
    if (!proj) {
      box.innerHTML = '<div class="card"><div class="empty">선택된 사업장이 없습니다. <b>📂 사업 현황</b> 또는 <b>📥 미등록 후보</b>에서 사업장을 선택·등록해 주세요.</div></div>';
      return;
    }
    var cat = getAppCat();
    var cd = getCheckDoc(proj.id);
    var comms = getProjectComms(proj.id);
    var hwpx = Hwpx();
    var sum = hwpx ? hwpx.buildSummary(APP_KEY, proj, cd, comms) : { overallPct: 0 };

    function renderGroupTable(title, items, kindKey, showLaw) {
      var map = cd[kindKey] || {};
      var trs = (items || []).map(function (it, idx) {
        var rec = map[it.id] || {};
        var st = str(rec.status || '');
        var noteVal = str(rec.note || '');
        var catLbl = it.cat || it.stage || (it.critical ? '필수' : '권장');
        var ckKey = 'ck:' + kindKey + ':' + it.id;
        return '<tr>' +
          '<td class="c"><input type="checkbox" data-ck="' + esc(ckKey) + '" data-list="chk_' + kindKey + '"' + (st === 'ok' ? ' checked' : '') + ' data-quick-ok="' + kindKey + ':' + esc(it.id) + '" aria-label="완료 표시"></td>' +
          '<td class="n">' + (idx + 1) + '</td>' +
          '<td class="ti" title="' + esc(it.title || it.name) + '">' + esc(it.title || it.name) + '</td>' +
          '<td data-k="badge" title="' + esc(catLbl) + '"><span class="chip">' + esc(catLbl) + '</span></td>' +
          (showLaw ? '<td title="' + esc(it.law || '-') + '">' + esc(it.law || '-') + '</td>' : '') +
          '<td class="wide" title="' + esc(noteVal || '-') + '"><input type="text" data-chk-note="' + kindKey + ':' + esc(it.id) + '" value="' + esc(noteVal) + '" placeholder="점검 메모(비식별)" style="width:100%;min-width:120px"></td>' +
          '<td data-k="act"><select data-chk-st="' + kindKey + ':' + esc(it.id) + '" aria-label="상태 선택">' +
            '<option value="">미점검</option>' +
            '<option value="ok"' + (st === 'ok' ? ' selected' : '') + '>적정·완료</option>' +
            '<option value="fix"' + (st === 'fix' ? ' selected' : '') + '>보완필요</option>' +
            '<option value="no"' + (st === 'no' ? ' selected' : '') + '>미이행</option>' +
            '<option value="na"' + (st === 'na' ? ' selected' : '') + '>해당없음</option>' +
          '</select></td>' +
        '</tr>';
      }).join('');
      return '<div class="sub-fold-wrap">' +
        '<div class="sec"><span>' + esc(title) + '</span><span class="chip c-blue">' + (items || []).length + '항목</span></div>' +
        '<div class="scroll"><table class="t" data-name="chk_' + kindKey + '"><thead><tr><th class="c"><input type="checkbox" data-ckall="chk_' + kindKey + '" aria-label="전체 선택"></th><th class="n">№</th><th>점검 항목</th><th>구분</th>' + (showLaw ? '<th>법령·지침</th>' : '') + '<th class="wide">메모</th><th data-k="act">판정</th></tr></thead><tbody>' + trs + '</tbody></table></div>' +
      '</div>';
    }

    var commRows = comms.map(function (c, i) {
      var ckKey = 'cm:' + str(c.id || i);
      var atts = Array.isArray(c.atts) && c.atts.length ? c.atts.join(', ') : '-';
      return '<tr data-comm-idx="' + i + '">' +
        '<td class="c"><input type="checkbox" data-ck="' + esc(ckKey) + '" data-list="comm" aria-label="자료 선택"></td>' +
        '<td class="n">' + (i + 1) + '</td>' +
        '<td class="ti" title="' + esc(c.subject || c.title) + '">' + esc(c.subject || c.title || '수신 자료') + '</td>' +
        '<td data-k="badge" title="' + esc(c.source || 'mail') + '"><span class="chip c-blue">' + esc(c.source || 'mail') + '</span></td>' +
        '<td title="' + esc(c.date || '-') + '">' + esc(c.date || '-') + '</td>' +
        '<td class="wide" title="' + esc(c.maskedPreview || '') + ' / 첨부: ' + esc(atts) + '">' + esc(c.maskedPreview || atts) + '</td>' +
        '<td data-k="act"><button type="button" class="sm" data-open-comm="' + i + '">열람</button></td>' +
      '</tr>';
    }).join('');

    box.innerHTML =
      '<div class="card">' +
        projectPickerBarHtml(proj, 'detail') +
        '<div class="prof">' +
          '<span><b>사업장</b>' + esc(proj.companyName) + (proj.bizNo ? ' (' + esc(proj.bizNo) + ')' : '') + '</span>' +
          (proj.caseNo ? '<span><b>사건번호</b><span class="chip">' + esc(proj.caseNo) + '</span></span>' : '') +
          '<span><b>트랙</b><span class="chip c-blue">' + esc(proj.trackName || cat.shortName) + '</span></span>' +
          '<span><b>수행연도</b>' + esc(String(proj.year || 2026)) + '년</span>' +          '<span><b>근로자</b>' + num(proj.workerCount, 0) + '명</span>' +
          '<span><b>담당</b>' + esc(proj.consultantName || '전담 노무사') + '</span>' +
          '<span><b>점검 준비도</b>' + sum.overallPct + '%</span>' +
          '<span><b>수집자료</b>' + comms.length + '건</span>' +
          (APP_KEY === 'laboraudit'
            ? ('<span><b>감독 기간</b>' + esc(proj.inspPeriod || '미입력') + '</span>' +
               '<span><b>관할 지청</b>' + esc(proj.inspOffice || '미입력') + '</span>' +
               '<span><b>시정 기한</b>' + esc(proj.inspDue || '-') + '</span>' +
               '<span><b>처리 결과</b><span class="chip ' + ((str(proj.inspResult).indexOf('완료') >= 0 || str(proj.inspResult).indexOf('없음') >= 0) ? 'c-green' : 'c-amber') + '">' + esc(proj.inspResult || '미정') + '</span></span>' +
               '<span style="flex-basis:100%"><b>지적·시정지시</b>' + esc(proj.inspIssues || '상단 수정 버튼을 눌러 지적사항을 입력하세요') + '</span>')
            : '') +
        '</div>' +
      '</div>' +
      roundsPanelHtml(proj) +
      '<div class="card">' +
        '<div class="sec"><span>① ' + esc(cat.shortName) + ' 체크리스트 (착수 사전 · 실무 핵심 · 필수 산출서류)</span>' + diffBadge('6단계 연동') +
          '<span class="sp"></span>' +
          '<button type="button" class="sm pri" id="saveCheckBtn">💾 체크 결과 저장</button>' +
          '<button type="button" class="sm" id="toCoachFromCheckBtn">🧠 RAG 행동코치</button>' +
        '</div>' +
        renderGroupTable('1-1. 착수 사전 체크', cat.preChecks, 'pre', false) +
        renderGroupTable('1-2. ' + cat.shortName + ' 실무 핵심 점검', cat.domainChecks, 'domain', true) +
        renderGroupTable('1-3. 단계별 필수 산출서류', cat.requiredDocs, 'docs', false) +
      '</div>' +
      '<div class="card' + diffCls(true) + '">' +
        '<div class="sec"><span>② 수집 메일 · 카톡 · 문자 · 로컬문서 자료함 (' + comms.length + '건)</span>' +
          '<span class="sp"></span>' +
          '<a class="act-link" href="pu-msg-intake.html" target="_blank" rel="noopener">💬 카톡·문자 허브 ↗</a>' +
        '</div>' +
        '<details class="sub-fold" open><summary>📥 카톡 · 문자 붙여넣기 / 로컬 파일(.txt · .hwpx · .docx · .csv) 즉시 비식별 수집</summary>' +
          '<div class="sub-fold-bd">' +
            '<div class="drop-zone" id="dropZone" role="button" tabindex="0" aria-label="로컬 파일 업로드 드롭존"><b>로컬 파일(.txt · .hwpx · .docx · .csv) 드래그 또는 클릭</b> · <span>주민번호·전화번호·계좌·PC경로는 브라우저에서 [가림] 처리 후 저장됩니다.</span><input type="file" id="fileUploadInput" multiple aria-label="로컬 파일 선택" style="display:none"></div>' +
            '<textarea id="quickMsgPaste" rows="3" style="margin-top:6px" aria-label="카톡 대화 또는 문자 붙여넣기" placeholder="카카오톡 대화 내용이나 문자(SMS)를 여기에 붙여넣고 [비식별 정리·저장]을 누르세요. (OTP·인증번호 자동 차단)"></textarea>' +
            '<div class="bar" style="padding:6px 0 0">' +
              '<select id="quickMsgChannel" aria-label="메시지 채널 선택"><option value="kakao_export">카카오톡 대화</option><option value="sms_paste">문자(SMS/LMS)</option></select>' +
              '<button type="button" class="sm pri" id="quickMsgSaveBtn">비식별 정리·저장</button>' +
              '<span class="hint">OTP·인증번호·주민번호·계좌·연락처는 자동 차단/가림됩니다.</span>' +
            '</div>' +
          '</div>' +
        '</details>' +
        (comms.length
          ? '<div class="scroll"><table class="t" data-name="comm"><thead><tr><th class="c"><input type="checkbox" data-ckall="comm" aria-label="전체"></th><th class="n">№</th><th>제목 · 요지</th><th>채널</th><th>일자</th><th class="wide">비식별 요약 · 첨부</th><th data-k="act">상세</th></tr></thead><tbody>' + commRows + '</tbody></table></div>'
          : '<div class="empty">아직 연결된 메일·카톡 자료가 없습니다. 위 입력창에 붙여넣거나 [🔄 자동수집 · 동기화]를 누르세요.</div>') +
      '</div>';

    function syncSectionHeaderCheckbox(kindKey) {
      var listName = 'chk_' + kindKey;
      var cbs = box.querySelectorAll('input[type="checkbox"][data-list="' + cssEsc(listName) + '"]');
      var hdr = box.querySelector('input[type="checkbox"][data-ckall="' + cssEsc(listName) + '"]');
      if (!hdr) return;
      var checked = 0;
      cbs.forEach(function (el) { if (el.checked) checked++; });
      hdr.checked = cbs.length > 0 && checked === cbs.length;
      hdr.indeterminate = checked > 0 && checked < cbs.length;
    }
    ['pre', 'domain', 'docs'].forEach(syncSectionHeaderCheckbox);

    bindProjectPickerBar(box, proj);
    box.querySelectorAll('[data-quick-ok]').forEach(function (cb) {
      cb.onchange = function () {
        var parts = cb.getAttribute('data-quick-ok').split(':');
        var sel = box.querySelector('[data-chk-st="' + cssEsc(parts[0] + ':' + parts[1]) + '"]');
        if (sel) sel.value = cb.checked ? 'ok' : '';
        syncSectionHeaderCheckbox(parts[0]);
      };
    });
    box.querySelectorAll('[data-chk-st]').forEach(function (sel) {
      sel.onchange = function () {
        var key = sel.getAttribute('data-chk-st') || '';
        var cb = box.querySelector('[data-quick-ok="' + cssEsc(key) + '"]');
        if (cb) {
          cb.checked = sel.value === 'ok';
          var kindKey = key.split(':')[0];
          syncSectionHeaderCheckbox(kindKey);
        }
      };
    });
    if ($('saveCheckBtn')) $('saveCheckBtn').onclick = function () { saveCurrentChecks(proj.id); };
    if ($('toCoachFromCheckBtn')) $('toCoachFromCheckBtn').onclick = function () { switchTab('report'); };
    bindDropAndPaste(box, proj);
    box.querySelectorAll('[data-open-comm]').forEach(function (b) {
      b.onclick = function () { openCommModal(comms[Number(b.getAttribute('data-open-comm'))]); };
    });
  }

  /* ══ 8. 탭 5: ⚖️ 보고서 · RAG 코치 (pu-harass drawReportPane 좌우 2단) ══ */
  function renderReportPane() {
    var box = $('reportBox');
    if (!box) return;
    var cat = getAppCat();
    var rag = Rag();
    var proj = projectById(CUR_PID);
    var cd = proj ? getCheckDoc(proj.id) : {};
    var comms = proj ? getProjectComms(proj.id) : [];
    var plan = rag ? rag.recommendNextActions(APP_KEY, proj || { stage: 'intake' }, cd, comms) : null;
    var pb = cat.ragPlaybook || {};

    var nextActionsHtml = '';
    if (plan) {
      var actRows = plan.actions.map(function (a, i) {
        return '<tr>' +
          '<td class="c"><input type="checkbox" data-ck="act:' + i + '" data-list="coach_act" aria-label="행동 확인"></td>' +
          '<td class="n">' + (i + 1) + '</td>' +
          '<td class="ti" title="' + esc(a.step) + '">' + esc(a.step) + '</td>' +
          '<td data-k="badge" title="' + esc(a.priority) + '"><span class="chip ' + (a.priority === '긴급' ? 'c-red' : 'c-blue') + '">' + esc(a.priority) + '</span></td>' +
          '<td class="wide" title="' + esc(a.detail) + '">' + esc(a.detail) + '</td>' +
          '<td data-k="act"><button type="button" class="sm pri" data-go-tab="' + esc(a.targetTab || 'detail') + '">이동</button></td>' +
        '</tr>';
      }).join('');
      nextActionsHtml =
        '<div class="card' + diffCls(true) + '">' +
          '<div class="sec"><span>① 지금 해야 할 행동 (' + esc(plan.stageName) + ' · 준비도 ' + plan.readinessPct + '%)</span>' + diffBadge('수습 코치') +
            '<span class="sp"></span><a class="act-link" href="pu-coach.html?app=' + encodeURIComponent(APP_KEY) + '" target="_blank" rel="noopener">전 사업 RAG 허브 ↗</a>' +
          '</div>' +
          '<div class="scroll"><table class="t" data-name="coach_act"><thead><tr><th class="c"><input type="checkbox" data-ckall="coach_act" aria-label="전체"></th><th class="n">№</th><th>실행 단계</th><th>우선</th><th class="wide">행동 지침</th><th data-k="act">이동</th></tr></thead><tbody>' + actRows + '</tbody></table></div>' +
          '<div class="bar"><span class="chip c-amber wrap-chip">자주 하는 실수: ' + esc((plan.mistakes || [])[0] || '-') + '</span><span class="chip wrap-chip">법령근거: ' + esc((plan.legalRefs || []).join(' · ')) + '</span></div>' +
        '</div>';
    }

    var hitsHtml = '';
    if (CUR_COACH_ANSWER) {
      var citList = (CUR_COACH_ANSWER.hits || []).map(function (h, i) {
        return '<div class="ind-card" style="margin-bottom:6px"><div class="ind-hd"><b>[근거 #' + (i + 1) + '] ' + esc(h.chunk.title) + '</b><span class="chip c-blue">점수 ' + h.score + '</span></div>' +
          '<div style="font-size:12px;color:var(--ink2);white-space:pre-wrap">' + esc(h.chunk.chunk_text.slice(0, 380)) + '</div></div>';
      }).join('');
      hitsHtml = '<div class="ok-banner" style="white-space:pre-wrap">' + esc(CUR_COACH_ANSWER.answer) + '</div>' + citList;
    }

    var quizHtml = (pb.quizzes || []).map(function (qz, idx) {
      var choices = qz.choices || qz.opts || [];
      return '<div class="ind-card" style="margin-bottom:6px"><div class="ind-hd"><b>Q' + (idx + 1) + '. ' + esc(qz.q) + '</b></div>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap">' +
          choices.map(function (ch, ci) {
            return '<button type="button" class="sm" data-quiz="' + idx + ':' + ci + '">' + (ci + 1) + ') ' + esc(ch) + '</button>';
          }).join('') +
        '</div><div class="hint" id="quizRes_' + idx + '"></div></div>';
    }).join('');

    var leftColHtml =
      '<div class="ws-col-left">' +
        nextActionsHtml +
        '<div class="card">' +
          '<div class="sec"><span>② 하이브리드 RAG 검색 · 근거 기반 행동 코치</span></div>' +
          '<div class="bar">' +
            '<input type="text" id="coachQueryInput" aria-label="RAG 실무 검색 질문" value="' + esc(LAST_COACH_QUERY) + '" placeholder="예: ' + esc(cat.shortName) + ' 필수서류, 주의사항, 법령 기준..." style="flex:1;min-width:190px">' +
            '<button type="button" class="sm pri" id="coachSearchLocalBtn">RAG 근거 검색</button>' +
            '<button type="button" class="sm ok" id="coachAskAiBtn">AI 코칭</button>' +
          '</div>' +
          '<div id="coachResultWrap" style="padding:0 12px 10px">' + hitsHtml + '</div>' +
          '<details class="sub-fold"><summary>③ 핵심 플레이북 · 자주 하는 실수 · 수습 셀프 퀴즈</summary>' +
            '<div class="sub-fold-bd">' +
              '<div class="ind-card" style="margin-bottom:8px"><div class="ind-hd"><b>📚 사업 핵심 플레이북</b></div>' +
                '<div style="font-size:12.5px;line-height:1.55">' + esc(pb.overview || cat.desc) + '</div>' +
                '<ul class="ind-ul">' + (pb.commonMistakes || []).map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul>' +
              '</div>' +
              quizHtml +
            '</div>' +
          '</details>' +
        '</div>' +
      '</div>';

    var rightColHtml = '';
    if (!proj) {
      rightColHtml =
        '<div class="ws-col-right">' +
          '<div class="card"><div class="sec"><span>④ 보고서 작성 · HWPX 출력</span></div>' +
          '<div class="empty"><b>📂 사업 현황</b> 또는 <b>📥 미등록 후보</b>에서 사업장을 선택하면 보고서 원고 편집기와 A4 미리보기가 열립니다.</div></div>' +
        '</div>';
    } else {
      var storedSec = (D.reports && D.reports[proj.id] && D.reports[proj.id].sections) || {};
      var draftSec = UNSAVED_REPORT_DRAFT[proj.id] || {};
      var savedSec = Object.assign({}, storedSec, draftSec);
      var hwpxApi = Hwpx();
      var res = hwpxApi ? hwpxApi.resolveSections(APP_KEY, proj, cd, comms, savedSec) : { sections: [] };
      var previewHtml = hwpxApi ? hwpxApi.buildPreviewHtml(CUR_REPORT_KIND, APP_KEY, proj, cd, comms, savedSec) : '';
      var secCards = res.sections.map(function (s) {
        return '<div class="rpt-sec-card"><div class="rpt-sec-hd"><b>제' + s.no + '장 · ' + esc(s.title) + '</b><span class="sp"></span><span class="hint">' + esc(s.hint) + '</span></div>' +
          '<div class="rpt-sec-body"><textarea data-sec-key="' + esc(s.key) + '" rows="4">' + esc(s.text) + '</textarea></div></div>';
      }).join('');
      rightColHtml =
        '<div class="ws-col-right">' +
          '<div class="card">' +
            '<div class="sec"><span>④ 보고서 작성 · 출력</span>' +
              '<select id="reportKindSel" aria-label="보고서 양식">' +
                '<option value="comprehensive"' + (CUR_REPORT_KIND === 'comprehensive' ? ' selected' : '') + '>최종 결과보고서</option>' +
                '<option value="summary1p"' + (CUR_REPORT_KIND === 'summary1p' ? ' selected' : '') + '>핵심 개선 1P 요약</option>' +
                '<option value="checklist"' + (CUR_REPORT_KIND === 'checklist' ? ' selected' : '') + '>맞춤형 체크리스트</option>' +
              '</select>' +
              '<span class="sp"></span>' +
              '<button type="button" class="sm" id="saveReportSecBtn">💾 저장</button>' +
              '<button type="button" class="sm pri" id="dlHwpxBtn">📄 .hwpx</button>' +
              '<details class="act-menu"><summary>편집·내보내기 ▾</summary><div class="act-pop">' +
                '<button type="button" id="openHangulBtn">🖋️ 푸른한글 웹편집기 열기</button>' +
                '<button type="button" id="printPdfBtn">🖨️ 인쇄 / PDF</button>' +
                '<button type="button" id="dlCsvBtn">📥 CSV 점검표 내려받기</button>' +
              '</div></details>' +
            '</div>' +
            '<div class="rpt-sec-list">' + secCards + '</div>' +
            '<details class="sub-fold" open><summary>👁 A4 보고서 실시간 미리보기</summary>' +
              '<div class="sub-fold-bd">' + previewHtml + '</div>' +
            '</details>' +
          '</div>' +
        '</div>';
    }

    var topCardHtml = proj
      ? ('<div class="card">' + projectPickerBarHtml(proj, 'report') + '</div>')
      : ('<div class="note"><b>' + esc(cat.name) + '</b> 실무 RAG 코치 — 왼쪽에서 플레이북·법령 근거를 바로 검색할 수 있으며, 사업장을 선택하면 오른쪽 보고서 작업실도 함께 활성화됩니다.</div>');

    // 가벼운 화면: 기관에 내는 서식은 «컨설팅보고서»가 실제 서식(별지)에 채워 출력한다.
    // 여기의 일반 보고서 원고(최종결과보고서·1P·체크리스트)는 기관 서식이 아닌 내부 참고용이라 «접어 둔다»(지우지 않음).
    if (isSlim()) {
      topCardHtml += '<div class="note" id="govReportNote">📑 <b>기관 제출용 서식</b>(' + esc(cat.shortName) + ' 기관 양식)은 <a class="act-link" href="gov-report.html" target="_blank" rel="noopener">컨설팅보고서 ↗</a>에서 실제 서식에 채워 출력합니다. ' +
        '이 탭의 일반 보고서 원고는 내부 참고용이라 오른쪽에 접어 두었습니다.</div>';
      rightColHtml = '<div class="ws-col-right"><details class="sub-fold" id="genRptFold"><summary>📄 일반 보고서 원고 · HWPX (내부 참고용 — 기관 서식 아님)</summary><div class="sub-fold-bd">' +
        rightColHtml.replace(/^<div class="ws-col-right">/, '').replace(/<\/div>$/, '') +
        '</div></details></div>';
    }

    box.innerHTML = topCardHtml +
      '<div class="ws-split' + (WS_FOCUS ? (' focus-' + WS_FOCUS) : '') + '">' + leftColHtml + rightColHtml + '</div>';

    if (proj) bindProjectPickerBar(box, proj);
    box.querySelectorAll('[data-go-tab]').forEach(function (b) {
      b.onclick = function () { switchTab(b.getAttribute('data-go-tab')); };
    });
    if ($('coachSearchLocalBtn')) $('coachSearchLocalBtn').onclick = function () { runCoachSearch(false); };
    if ($('coachAskAiBtn')) $('coachAskAiBtn').onclick = function () { runCoachSearch(true); };
    if ($('coachQueryInput')) {
      $('coachQueryInput').oninput = function () { LAST_COACH_QUERY = String($('coachQueryInput').value || ''); };
      $('coachQueryInput').onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); runCoachSearch(false); } };
    }
    box.querySelectorAll('[data-quiz]').forEach(function (b) {
      b.onclick = function () {
        var ps = b.getAttribute('data-quiz').split(':');
        var qz = (pb.quizzes || [])[Number(ps[0])];
        if (!qz) return;
        var ansIdx = qz.answerIndex != null ? qz.answerIndex : qz.ans;
        var expTxt = qz.explain || qz.exp || '';
        var ok = Number(ps[1]) === Number(ansIdx);
        var out = $('quizRes_' + ps[0]);
        if (out) out.textContent = (ok ? '✅ 정답! ' : '❌ 다시 확인: ') + str(expTxt);
      };
    });

    if (proj) {
      var hwpx = Hwpx();
      box.querySelectorAll('textarea[data-sec-key]').forEach(function (ta) {
        ta.oninput = function () {
          var k = ta.getAttribute('data-sec-key');
          if (!k) return;
          if (!UNSAVED_REPORT_DRAFT[proj.id]) UNSAVED_REPORT_DRAFT[proj.id] = Object.create(null);
          UNSAVED_REPORT_DRAFT[proj.id][k] = cleanText(ta.value);
        };
      });
      var gatherSections = function () {
        var out = {};
        box.querySelectorAll('[data-sec-key]').forEach(function (ta) {
          out[ta.getAttribute('data-sec-key')] = cleanText(ta.value);
        });
        return out;
      };
      if ($('reportKindSel')) {
        $('reportKindSel').onchange = function () {
          captureReportUiState();
          CUR_REPORT_KIND = $('reportKindSel').value;
          renderReportPane();
        };
      }
      if ($('saveReportSecBtn')) {
        $('saveReportSecBtn').onclick = function () { saveReportSections(proj.id, gatherSections()); };
      }
      if ($('dlHwpxBtn') && hwpx) {
        $('dlHwpxBtn').onclick = function () {
          try {
            var secs = gatherSections();
            var bytes = hwpx.generateHwpxBytes(CUR_REPORT_KIND, APP_KEY, proj, cd, comms, secs);
            var fname = hwpx.suggestedFileName(CUR_REPORT_KIND, APP_KEY, proj);
            hwpx.downloadHwpxBytes(bytes, fname);
            toast('한글(.hwpx) 생성 완료: ' + fname);
          } catch (err) { toast('HWPX 생성 오류: ' + (err && err.message || err)); }
        };
      }
      if ($('openHangulBtn') && hwpx) {
        $('openHangulBtn').onclick = function () {
          try {
            hwpx.openInHangulEditor(CUR_REPORT_KIND, APP_KEY, proj, cd, comms, gatherSections());
            toast('푸른한글 편집기로 문서를 전송했습니다.');
          } catch (err) { toast('푸른한글 열기 오류: ' + (err && err.message || err)); }
        };
      }
      if ($('printPdfBtn') && hwpx) {
        $('printPdfBtn').onclick = function () {
          hwpx.openPrintWindow(CUR_REPORT_KIND, APP_KEY, proj, cd, comms, gatherSections());
        };
      }
      if ($('dlCsvBtn') && hwpx) {
        $('dlCsvBtn').onclick = function () {
          var name = hwpx.downloadCsv(APP_KEY, proj, cd);
          toast('CSV 내려받기 완료: ' + name);
        };
      }
    }
  }

  /* ══ 9. 상호작용 액션 (저장 · 감지등록 · 일괄작업 · CSV · 모달) ══════════ */
  function bindDropAndPaste(box, proj) {
    if ($('fileUploadInput')) {
      $('fileUploadInput').onchange = async function (ev) {
        var files = ev.target && ev.target.files ? ev.target.files : [];
        for (var i = 0; i < files.length; i++) await ingestLocalFile(proj, files[i]);
        draw();
      };
    }
    if ($('dropZone')) {
      var dz = $('dropZone');
      dz.onclick = function () { if ($('fileUploadInput')) $('fileUploadInput').click(); };
      dz.onkeydown = function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if ($('fileUploadInput')) $('fileUploadInput').click();
        }
      };
      dz.ondragover = function (e) { e.preventDefault(); dz.classList.add('drag'); };
      dz.ondragleave = function () { dz.classList.remove('drag'); };
      dz.ondrop = async function (e) {
        e.preventDefault();
        dz.classList.remove('drag');
        var files = (e.dataTransfer && e.dataTransfer.files) || [];
        for (var i = 0; i < files.length; i++) await ingestLocalFile(proj, files[i]);
        if (files.length) draw();
      };
    }
    if ($('quickMsgSaveBtn')) {
      $('quickMsgSaveBtn').onclick = function () { ingestQuickPaste(proj); };
    }
  }

  async function setProjectStage(pid, stageId) {
    var proj = projectById(pid);
    if (!proj) return;
    var patch = { stage: stageId, status: stageId === 'followup' ? 'done' : proj.status };
    var next = Object.assign({}, proj, patch);
    try {
      D.projects[pid] = await saveRecord('projects/' + pid, pid, next, 'Project', { patch: patch });
      draw();
      toast('진행 단계를 변경했습니다.');
    } catch (e) { toast('단계 저장 오류: ' + e.message); }
  }

  async function toggleProjectDone(pid) {
    var proj = projectById(pid);
    if (!proj) return;
    var nextSt = proj.status === 'done' ? 'active' : 'done';
    var patch = { status: nextSt };
    var next = Object.assign({}, proj, patch);
    try {
      D.projects[pid] = await saveRecord('projects/' + pid, pid, next, 'Project', { patch: patch });
      draw();
      toast(nextSt === 'done' ? '수행 완료 상태로 변경했습니다.' : '진행 중 상태로 되돌렸습니다.');
    } catch (e) { toast('상태 변경 오류: ' + e.message); }
  }

  async function saveCurrentChecks(pid) {
    var box = $('checkBox') || $('detailBox');
    if (!box) return;
    var cur = getCheckDoc(pid);
    var next = {
      id: 'main', projectId: pid, entityType: 'Document', schemaVersion: 1, contractVersion: 1,
      revision: num(cur.revision, 0),
      pre: Object.assign({}, cur.pre),
      domain: Object.assign({}, cur.domain),
      docs: Object.assign({}, cur.docs)
    };
    if (cur && cur.createdBy) next.createdBy = cur.createdBy;
    box.querySelectorAll('[data-chk-st]').forEach(function (sel) {
      var ps = sel.getAttribute('data-chk-st').split(':');
      var k = ps[0], itemId = ps[1];
      var noteEl = box.querySelector('[data-chk-note="' + cssEsc(k + ':' + itemId) + '"]');
      next[k][itemId] = { status: sel.value || '', note: cleanText(noteEl ? noteEl.value : '') };
    });
    try {
      var saved = await saveRecord('checks/' + pid + '/main', 'main', next, 'Document');
      D.checks[pid] = { main: saved };
      draw();
      toast('체크리스트가 저장되었습니다.');
    } catch (e) { toast('체크 저장 오류: ' + e.message); }
  }

  async function saveReportSections(pid, secs) {
    var prev = (D.reports && D.reports[pid]) || {};
    var rec = { id: pid, projectId: pid, entityType: 'Document', schemaVersion: 1, contractVersion: 1, revision: num(prev.revision, 0), sections: secs };
    if (prev && prev.createdBy) rec.createdBy = prev.createdBy;
    try {
      D.reports[pid] = await saveRecord('reports/' + pid, pid, rec, 'Document');
      delete UNSAVED_REPORT_DRAFT[pid];
      renderReportPane();
      toast('보고서 원고가 저장되었습니다.');
    } catch (e) { toast('원고 저장 오류: ' + e.message); }
  }

  async function handleDeleteProject(pid) {
    var proj = projectById(pid);
    if (!proj) return;
    try {
      var deleted = await softDeleteRecord('projects/' + pid, proj, 'Project');
      D.projects[pid] = (deleted && typeof deleted === 'object') ? deleted : Object.assign({}, proj, { _deleted: true });
      if (CUR_PID === pid) CUR_PID = '';
      rebuildDiscoverAndRag();
      draw();
      toast('사업장을 보관삭제(_deleted) 처리했습니다.');
    } catch (e) { toast('삭제 오류: ' + e.message); }
  }

  async function bulkUpdateProjectsDone(list) {
    if (!list.length) return;
    try {
      for (var i = 0; i < list.length; i++) {
        var p = list[i];
        if (p.status === 'done') continue;
        D.projects[p.id] = await saveRecord('projects/' + p.id, p.id, Object.assign({}, p, { status: 'done' }), 'Project');
      }
      SEL = Object.create(null);
      draw();
      toast(list.length + '건 완료 처리했습니다.');
    } catch (e) {
      toast('일괄 완료 처리 오류: ' + (e && e.message || e));
    }
  }

  async function bulkDeleteProjects(list) {
    if (!list.length) return;
    try {
      for (var i = 0; i < list.length; i++) {
        var p = list[i];
        await softDeleteRecord('projects/' + p.id, p, 'Project');
        D.projects[p.id] = Object.assign({}, p, { _deleted: true });
      }
      SEL = Object.create(null);
      rebuildDiscoverAndRag();
      draw();
      toast(list.length + '건 보관삭제(_deleted) 처리했습니다.');
    } catch (e) {
      toast('일괄 삭제 오류: ' + (e && e.message || e));
    }
  }

  async function importCandidate(bundle) {
    if (!bundle) return;
    var cat = getAppCat();
    var tracks = getEffectiveTracks();
    var tr = (bundle.suggestedTrackId && tracks.find(function (t) { return t.id === bundle.suggestedTrackId; })) || tracks[0] || { id: 'default', name: cat.name };
    var yr = num(bundle.year, CUR_YEAR);
    var pid = 'pr_' + APP_KEY + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
    var rec = {
      id: pid, entityType: 'Project', schemaVersion: 1, contractVersion: 1, revision: 0,
      companyId: str(bundle.companyId),
      companyName: cleanText(bundle.companyName) || '수진기업',
      year: yr,
      trackId: tr.id,
      trackName: tr.name,
      stage: yr < CUR_YEAR ? 'followup' : 'collect',
      workerCount: 0,
      consultantName: (ME && ME.name) || '전담 노무사',
      consultantUid: str(ME && ME.uid),
      status: yr < CUR_YEAR ? 'done' : 'active',
      summaryNote: '자동 감지 등록 (메일 ' + bundle.mailCount + ' / 톡 ' + bundle.msgCount + ')'
    };
    if (str(bundle.caseNo)) rec.caseNo = cleanText(bundle.caseNo).slice(0, 60);
    if (APP_KEY === 'laboraudit' && bundle.inspMeta) {
      if (str(bundle.inspMeta.inspPeriod)) rec.inspPeriod = cleanText(bundle.inspMeta.inspPeriod).slice(0, 80);
      if (str(bundle.inspMeta.inspOffice)) rec.inspOffice = cleanText(bundle.inspMeta.inspOffice).slice(0, 60);
      if (str(bundle.inspMeta.inspIssues)) rec.inspIssues = cleanText(bundle.inspMeta.inspIssues).slice(0, 480);
      if (str(bundle.inspMeta.inspDue)) rec.inspDue = cleanText(bundle.inspMeta.inspDue).slice(0, 32);
      if (str(bundle.inspMeta.inspResult)) rec.inspResult = cleanText(bundle.inspMeta.inspResult).slice(0, 40);
    }
    D.projects[pid] = await saveRecord('projects/' + pid, pid, rec, 'Project');
    if (Array.isArray(bundle.comms)) {
      D.comms[pid] = D.comms[pid] || {};
      for (var i = 0; i < Math.min(20, bundle.comms.length); i++) {
        var cm = bundle.comms[i];
        var cid = 'cm_' + Date.now().toString(36) + '_' + i;
        var cRec = {
          id: cid, projectId: pid, entityType: 'Document', schemaVersion: 1, contractVersion: 1, revision: 0,
          source: str(cm.source || 'mail'), date: /^\d{4}-\d{2}-\d{2}$/.test(str(cm.date)) ? str(cm.date) : '',
          subject: cleanText(cm.subject).slice(0, 280),
          maskedPreview: cleanText(cm.maskedPreview).slice(0, 3800)
        };
        if (Array.isArray(cm.atts) && cm.atts.length) cRec.atts = cm.atts.slice(0, 12);
        D.comms[pid][cid] = await saveRecord('comms/' + pid + '/' + cid, cid, cRec, 'Document');
      }
    }
    CUR_PID = pid;
    return pid;
  }

  async function importCandidateByKey(key) {
    var b = (D.discover.bundles || []).find(function (x) { return x.key === key; });
    if (!b) return;
    try {
      await importCandidate(b);
      rebuildDiscoverAndRag();
      draw();
      toast('[' + b.companyName + '] 등록 완료');
    } catch (e) { toast('등록 오류: ' + e.message); }
  }

  async function importCandidatesList(picks, btnEl, origTxt) {
    if (!picks.length) { toast('등록할 후보가 없습니다.'); return; }
    if (btnEl) { btnEl.disabled = true; btnEl.textContent = '등록 중…'; }
    try {
      var cap = Math.min(30, picks.length);
      for (var i = 0; i < cap; i++) await importCandidate(picks[i]);
      SEL = Object.create(null);
      rebuildDiscoverAndRag();
      draw();
      toast(cap + '개 후보를 사업 현황으로 편입했습니다.');
    } catch (e) {
      toast('일괄 등록 오류: ' + e.message);
    } finally {
      if (btnEl) { btnEl.disabled = false; btnEl.textContent = origTxt; }
    }
  }

  async function ingestQuickPaste(proj) {
    var ta = $('quickMsgPaste');
    var chEl = $('quickMsgChannel');
    var raw = ta ? ta.value : '';
    if (!str(raw)) { toast('카톡이나 문자 내용을 붙여넣어 주세요.'); return; }
    var I = Intake();
    if (!I) return;
    var ch = chEl ? chEl.value : 'kakao_export';
    var parsed = ch === 'kakao_export' ? I.parseKakaoExport(raw, { roomName: proj.companyName }) : I.parseSmsPaste(raw, {});
    if (parsed.blockedCount > 0 && !parsed.items.length) {
      toast('보안 정책상 인증번호·OTP·비밀번호 메시지는 저장하지 않습니다.');
      return;
    }
    D.comms[proj.id] = D.comms[proj.id] || {};
    try {
      for (var i = 0; i < parsed.items.length; i++) {
        var it = parsed.items[i];
        var cid = 'cm_' + it.id;
        var cRec = {
          id: cid, projectId: proj.id, entityType: 'Document', schemaVersion: 1, contractVersion: 1, revision: 0,
          source: ch, date: /^\d{4}-\d{2}-\d{2}$/.test(str(it.msgDate)) ? str(it.msgDate) : '',
          subject: cleanText(it.title).slice(0, 280),
          maskedPreview: cleanText(it.maskedBody).slice(0, 3800)
        };
        if (Array.isArray(it.attNames) && it.attNames.length) cRec.atts = it.attNames.slice(0, 12);
        D.comms[proj.id][cid] = await saveRecord('comms/' + proj.id + '/' + cid, cid, cRec, 'Document');
      }
      if (ta) ta.value = '';
      rebuildDiscoverAndRag();
      draw();
      toast(parsed.items.length + '건 비식별 정리 후 자료함에 저장했습니다.');
    } catch (e) {
      toast('카톡·문자 저장 오류: ' + (e && e.message || e));
    }
  }

  async function ingestLocalFile(proj, file) {
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) { toast('15MB를 초과한 파일은 업로드할 수 없습니다: ' + file.name); return; }
    var txt = '';
    try {
      if (/\.(txt|csv|md|json|log)$/i.test(file.name)) {
        txt = await file.text();
      } else if (/\.(hwpx|docx)$/i.test(file.name) && global.PureunZip && typeof global.PureunZip.unzipSync === 'function') {
        var bytes = new Uint8Array(await file.arrayBuffer());
        var entries = global.PureunZip.unzipSync(bytes);
        var xmlKeys = Object.keys(entries).filter(function (k) { return /(section\d+|document)\.xml$/i.test(k); }).slice(0, 200);
        var totalDecoded = 0;
        txt = xmlKeys.map(function (k) {
          var ent = entries[k];
          if (!ent || ent.length > 2 * 1024 * 1024 || totalDecoded > 100000) return '';
          totalDecoded += ent.length;
          var s = new TextDecoder('utf-8').decode(ent);
          return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        }).filter(Boolean).join('\n').slice(0, 50000);
      }
      if (!str(txt)) txt = '[' + file.name + '] (' + Math.round((file.size || 0) / 1024) + 'KB) 로컬 파일 등록';
    } catch (e) { txt = '[' + file.name + '] 로컬 파일 등록'; }
    var cid = 'cm_f_' + Date.now().toString(36);
    var cRec = {
      id: cid, projectId: proj.id, entityType: 'Document', schemaVersion: 1, contractVersion: 1, revision: 0,
      source: 'local_file', date: safeDate(Date.now()), subject: '[파일] ' + cleanText(file.name),
      maskedPreview: cleanText(txt).slice(0, 600), atts: [cleanText(file.name)]
    };
    D.comms[proj.id] = D.comms[proj.id] || {};
    try {
      D.comms[proj.id][cid] = await saveRecord('comms/' + proj.id + '/' + cid, cid, cRec, 'Document');
      toast('파일 비식별 저장 완료: ' + file.name);
    } catch (e) {
      toast('파일 저장 오류: ' + (e && e.message || e));
    }
  }

  function downloadStatusCsv(includeBundles) {
    var cat = getAppCat();
    var hwpx = Hwpx();
    var csvCell = (hwpx && hwpx.safeCsvCell) ? hwpx.safeCsvCell : function (v) {
      var s = String(v == null ? '' : v).replace(/([\r\n]+)([=+\-@\t])/g, "$1'$2");
      if (/^[=+\-@\t\r\n]/.test(s)) s = "'" + s;
      return '"' + s.replace(/"/g, '""') + '"';
    };
    var rows = [['구분', '연도', '사업장명', '트랙', '단계/출처', '담당/최근일', '요약·제목']];
    if (!includeBundles) {
      getFilteredProjects().forEach(function (p) {
        rows.push(['등록사업', p.year || 2026, p.companyName, p.trackName || cat.shortName, p.stage || 'intake', p.consultantName || '-', p.summaryNote || p.inspIssues || '-']);
      });
    } else {
      var yrQ = str($('yrQ') && $('yrQ').value).toLowerCase();
      var yrKind = str($('yrKind') && $('yrKind').value);
      if (yrKind !== 'bundle') {
        projectsList().forEach(function (p) {
          var yr = num(p.year, 2026);
          if (TRACK_FILTER && p.trackId !== TRACK_FILTER) return;
          if (YEAR_FILTER && String(yr) !== YEAR_FILTER) return;
          if (yrQ && ([yr, p.companyName, p.trackName, p.caseNo, p.summaryNote, p.inspPeriod, p.inspOffice, p.inspIssues, p.inspDue, p.inspResult].join(' ').toLowerCase()).indexOf(yrQ) < 0) return;
          rows.push(['등록사업', yr, p.companyName, p.trackName || cat.shortName, p.stage || 'intake', p.consultantName || '-', p.summaryNote || p.inspIssues || '-']);
        });
      }
      if (yrKind !== 'project') {
        ((D.discover && D.discover.bundles) || []).forEach(function (b) {
          var yr = num(b.year, 2026);
          if (TRACK_FILTER && str(b.suggestedTrackId) !== TRACK_FILTER) return;
          if (YEAR_FILTER && String(yr) !== YEAR_FILTER) return;
          if (yrQ && ([yr, b.companyName, b.suggestedTrackName].concat(b.sampleSubjects || []).join(' ').toLowerCase()).indexOf(yrQ) < 0) return;
          rows.push(['미등록후보', yr, b.companyName, b.suggestedTrackName || cat.shortName, '메일 ' + b.mailCount + '/톡 ' + b.msgCount, b.latestDate || '-', (b.sampleSubjects || [])[0] || '-']);
        });
      }
    }
    var csv = '\ufeff' + rows.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    var url = URL.createObjectURL(blob);
    a.href = url;
    a.download = cat.shortName + '_' + (includeBundles ? '연도별전체' : '사업현황') + '.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
    toast('CSV 내려받기 완료');
  }

  function runCoachSearch(useAi) {
    captureReportUiState();
    var qEl = $('coachQueryInput');
    var q = str(qEl && qEl.value);
    LAST_COACH_QUERY = q;
    if (!q) { toast('검색할 질문을 입력해 주세요.'); return; }
    var R = Rag();
    if (!R || !D.ragIndex) return;
    var aiBtn = $('coachAskAiBtn');
    if (useAi && aiBtn) { aiBtn.disabled = true; aiBtn.textContent = '조회 중…'; }
    var redactions = [];
    var curProj = projectById(CUR_PID);
    if (curProj && curProj.companyName) redactions.push(curProj.companyName);
    projectsList().forEach(function (p) { if (p && p.companyName) redactions.push(p.companyName); });
    (D.companies || []).forEach(function (c) { if (c && c.name) redactions.push(c.name); });
    R.askGroundedCoach(D.ragIndex, q, {
      appKey: APP_KEY,
      useAi: !!useAi && !PREVIEW_MODE,
      auth: fb ? fb.auth() : null,
      manual: true,
      redactTerms: redactions
    }).then(function (res) {
      CUR_COACH_ANSWER = res;
      renderReportPane();
    }).catch(function () {
      if (aiBtn) { aiBtn.disabled = false; aiBtn.textContent = 'AI 코칭'; }
    });
  }

  var INSP_RESULT_OPTS = ['미정/수검중', '시정지시 대응중', '시정완료·종결', '위반없음·종결', '과태료 부과 후 시정', '과태료·사법조치 병행'];
  function inspFormRowsHtml(prefix, src) {
    if (APP_KEY !== 'laboraudit') return '';
    var p = src || {};
    var curRes = str(p.inspResult);
    var optsList = INSP_RESULT_OPTS.slice();
    if (curRes && optsList.slice(1).indexOf(curRes) < 0) optsList.push(curRes);
    var resOpts = optsList.map(function (label, idx) {
      var val = idx === 0 ? '' : label;
      return '<option value="' + esc(val) + '"' + (curRes === val ? ' selected' : '') + '>' + esc(label) + '</option>';
    }).join('');
    return '<div class="fr"><label for="' + prefix + 'InspPeriod">감독 일시·기간</label><div class="fv"><input type="text" id="' + prefix + 'InspPeriod" value="' + esc(p.inspPeriod || '') + '" placeholder="예: 2026-11-10 ~ 2026-11-21"></div></div>' +
      '<div class="fr"><label for="' + prefix + 'InspOffice">관할 노동지청</label><div class="fv"><input type="text" id="' + prefix + 'InspOffice" value="' + esc(p.inspOffice || '') + '" placeholder="예: 대전청 천안지청 근로개선지도과"></div></div>' +
      '<div class="fr"><label for="' + prefix + 'InspIssues">지적·시정지시 사항</label><div class="fv"><input type="text" id="' + prefix + 'InspIssues" value="' + esc(p.inspIssues || '') + '" placeholder="예: 연장수당 산정 누락, 근로계약서 미교부"></div></div>' +
      '<div class="fr"><label for="' + prefix + 'InspDue">시정기한</label><div class="fv"><input type="text" id="' + prefix + 'InspDue" value="' + esc(p.inspDue || '') + '" placeholder="예: 2026-12-15"></div></div>' +
      '<div class="fr"><label for="' + prefix + 'InspResult">처리 결과</label><div class="fv"><select id="' + prefix + 'InspResult">' + resOpts + '</select></div></div>';
  }
  function readInspFormValues(prefix, origProj) {
    if (APP_KEY !== 'laboraudit') return { values: {}, clearKeys: [] };
    var defs = [
      ['inspPeriod', prefix + 'InspPeriod', 80],
      ['inspOffice', prefix + 'InspOffice', 60],
      ['inspIssues', prefix + 'InspIssues', 480],
      ['inspDue', prefix + 'InspDue', 32],
      ['inspResult', prefix + 'InspResult', 40]
    ];
    var values = {};
    var clearKeys = [];
    defs.forEach(function (d) {
      var el = $(d[1]);
      var rawVal = el ? str(el.value) : '';
      if (origProj && rawVal === str(origProj[d[0]])) return;
      var v = el ? cleanText(rawVal).slice(0, d[2]) : '';
      if (v) values[d[0]] = v;
      else clearKeys.push(d[0]);
    });
    return { values: values, clearKeys: clearKeys };
  }

  function openNewProjectModal() {
    var m = $('modal'), box = $('mbox');
    if (!m || !box) return;
    LAST_FOCUS_EL = document.activeElement;
    var cat = getAppCat();
    var tracks = getEffectiveTracks();
    var opts = tracks.map(function (t) {
      return '<option value="' + esc(t.id) + '"' + (TRACK_FILTER === t.id ? ' selected' : '') + '>' + esc(t.name) + '</option>';
    }).join('');
    var defYr = num(YEAR_FILTER, CUR_YEAR) || CUR_YEAR;
    box.innerHTML =
      '<div class="mhd"><b id="mhdTitle">+ ' + esc(cat.name) + ' 신규 사업장 등록</b><span class="sp"></span><button type="button" class="sm" id="mCloseBtn">닫기</button></div>' +
      '<div class="mbd">' +
        '<div class="fr"><label for="npCoName">수진기업명</label><div class="fv"><input type="text" id="npCoName" placeholder="예: (주)푸른샘식품"></div></div>' +
        '<div class="fr"><label for="npTrack">' + esc(cat.regionLabel || '세부 트랙') + '</label><div class="fv"><select id="npTrack">' + opts + '</select></div></div>' +
        '<div class="fr"><label for="npYear">수행연도</label><div class="fv"><input type="number" id="npYear" value="' + esc(String(defYr)) + '"></div></div>' +
        '<div class="fr"><label for="npCaseNo">사건번호(선택)</label><div class="fv"><input type="text" id="npCaseNo" placeholder="예: 인사서산-2026-001"></div></div>' +
        inspFormRowsHtml('np', {}) +
        '<div class="fr"><label for="npWorkers">상시근로자수</label><div class="fv"><input type="number" id="npWorkers" value="20"></div></div>' +
        '<div class="fr"><label for="npNote">핵심 과업 메모</label><div class="fv"><input type="text" id="npNote" placeholder="현장 방문 일정·주력 과제(비식별)"></div></div>' +
      '</div>' +
      '<div class="mft"><button type="button" class="sm" id="mCancelBtn">취소</button><button type="button" class="pri" id="mSaveBtn">등록 저장</button></div>';
    m.style.display = 'flex';
    if ($('mCloseBtn')) $('mCloseBtn').onclick = closeModal;
    if ($('mCancelBtn')) $('mCancelBtn').onclick = closeModal;
    if ($('npCoName')) $('npCoName').focus();
    if ($('mSaveBtn')) $('mSaveBtn').onclick = async function () {
      var co = cleanText($('npCoName').value);
      if (!co) { toast('수진기업명을 입력하세요.'); return; }
      var saveBtn = $('mSaveBtn');
      if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '저장 중…'; }
      var trId = $('npTrack').value;
      var trObj = tracks.find(function (t) { return t.id === trId; }) || { id: trId, name: cat.shortName };
      var yrVal = num($('npYear').value, CUR_YEAR);
      var pid = 'pr_' + APP_KEY + '_' + Date.now().toString(36);
      var rec = {
        id: pid, entityType: 'Project', schemaVersion: 1, contractVersion: 1, revision: 0,
        companyName: co, year: yrVal,
        trackId: trObj.id, trackName: trObj.name, stage: yrVal < CUR_YEAR ? 'followup' : 'intake',
        workerCount: num($('npWorkers').value, 0),
        consultantName: (ME && ME.name) || '전담 노무사',
        consultantUid: str(ME && ME.uid),
        status: yrVal < CUR_YEAR ? 'done' : 'active',
        summaryNote: cleanText($('npNote').value)
      };
      var cno = cleanText($('npCaseNo') && $('npCaseNo').value).slice(0, 60);
      if (cno) rec.caseNo = cno;
      var inspData = readInspFormValues('np');
      Object.assign(rec, inspData.values);
      try {
        D.projects[pid] = await saveRecord('projects/' + pid, pid, rec, 'Project');
        CUR_PID = pid;
        closeModal();
        rebuildDiscoverAndRag();
        draw();
        toast('신규 사업장을 등록했습니다.');
      } catch (e) {
        if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '등록 저장'; }
        toast('등록 실패: ' + e.message);
      }
    };
  }

  function openEditProjectModal(proj) {
    if (!proj) return;
    var m = $('modal'), box = $('mbox');
    if (!m || !box) return;
    LAST_FOCUS_EL = document.activeElement;
    var cat = getAppCat();
    var tracks = getEffectiveTracks();
    var opts = tracks.map(function (t) {
      return '<option value="' + esc(t.id) + '"' + (proj.trackId === t.id ? ' selected' : '') + '>' + esc(t.name) + '</option>';
    }).join('');
    box.innerHTML =
      '<div class="mhd"><b id="mhdTitle">✏️ 사업 정보 수정 · ' + esc(proj.companyName) + '</b><span class="sp"></span><button type="button" class="sm" id="mCloseBtn">닫기</button></div>' +
      '<div class="mbd">' +
        '<div class="fr"><label for="epCoName">수진기업명</label><div class="fv"><input type="text" id="epCoName" value="' + esc(proj.companyName) + '"></div></div>' +
        '<div class="fr"><label for="epTrack">' + esc(cat.regionLabel || '세부 트랙') + '</label><div class="fv"><select id="epTrack">' + opts + '</select></div></div>' +
        '<div class="fr"><label for="epYear">수행연도</label><div class="fv"><input type="number" id="epYear" value="' + esc(String(num(proj.year, CUR_YEAR))) + '"></div></div>' +
        '<div class="fr"><label for="epCaseNo">사건번호</label><div class="fv"><input type="text" id="epCaseNo" value="' + esc(proj.caseNo || '') + '" placeholder="예: 인사서산-2026-001"></div></div>' +
        inspFormRowsHtml('ep', proj) +
        '<div class="fr"><label for="epMgr">담당 노무사</label><div class="fv"><input type="text" id="epMgr" value="' + esc(proj.consultantName || '') + '"></div></div>' +
        (function () { var st = String(proj.status || 'active').trim(); var safeSt = st.slice(0, 40).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); var std = st === 'active' || st === 'done'; var extra = !std && safeSt ? '<option value="' + safeSt + '" selected>기존 상태 유지 (' + safeSt + ')</option>' : ''; return '<div class="fr"><label for="epStatus">진행상태</label><div class="fv"><select id="epStatus">' + extra + '<option value="active"' + (st === 'active' || (!std && !safeSt) ? ' selected' : '') + '>진행 중</option><option value="done"' + (st === 'done' ? ' selected' : '') + '>수행 완료</option></select></div></div>'; })() +
        '<div class="fr"><label for="epNote">요약 메모</label><div class="fv"><input type="text" id="epNote" value="' + esc(proj.summaryNote || '') + '"></div></div>' +
      '</div>' +
      '<div class="mft"><button type="button" class="sm" id="mCancelBtn">취소</button><button type="button" class="pri" id="mEditSaveBtn">수정 저장</button></div>';
    m.style.display = 'flex';
    if ($('mCloseBtn')) $('mCloseBtn').onclick = closeModal;
    if ($('mCancelBtn')) $('mCancelBtn').onclick = closeModal;
    if ($('epCoName')) $('epCoName').focus();
    if ($('mEditSaveBtn')) $('mEditSaveBtn').onclick = async function () {
      var co = cleanText($('epCoName').value);
      if (!co) { toast('수진기업명을 입력하세요.'); return; }
      var saveBtn = $('mEditSaveBtn');
      if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '저장 중…'; }
      var trId = $('epTrack').value;
      var trObj = tracks.find(function (t) { return t.id === trId; }) || { id: trId, name: cat.shortName };
      var origSt = String(proj.status || 'active').trim();
      var selSt = String($('epStatus').value || 'active').trim();
      var patch = {
        companyName: co.slice(0, 190),
        trackId: trObj.id,
        trackName: trObj.name,
        year: num($('epYear').value, CUR_YEAR),
        consultantName: cleanText($('epMgr').value).slice(0, 70) || proj.consultantName || '전담 노무사',
        summaryNote: cleanText($('epNote').value).slice(0, 1900)
      };
      if (selSt !== origSt || !proj.status) patch.status = selSt === 'done' ? 'done' : 'active';
      var cno = cleanText($('epCaseNo').value).slice(0, 60);
      if (cno) patch.caseNo = cno;
      var inspData = readInspFormValues('ep', proj);
      Object.assign(patch, inspData.values);
      var nextRec = Object.assign({}, proj, patch);
      if (!cno) delete nextRec.caseNo;
      var clearKeys = (cno ? [] : (Object.prototype.hasOwnProperty.call(proj, 'caseNo') ? ['caseNo'] : []))
        .concat(inspData.clearKeys.filter(function (k) {
          delete nextRec[k];
          return Object.prototype.hasOwnProperty.call(proj, k);
        }));
      try {
        D.projects[proj.id] = await saveRecord('projects/' + proj.id, proj.id, nextRec, 'Project', {
          patch: patch,
          clearKeys: clearKeys
        });
        closeModal();
        rebuildDiscoverAndRag();
        draw();
        toast('사업 정보를 수정 저장했습니다.');
      } catch (e) {
        if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '수정 저장'; }
        toast('수정 실패: ' + e.message);
      }
    };
  }

  function openAddRegionModal() {
    var m = $('modal'), box = $('mbox');
    if (!m || !box) return;
    LAST_FOCUS_EL = document.activeElement;
    var cat = getAppCat();
    box.innerHTML =
      '<div class="mhd"><b id="mhdTitle">+ 새 지역 상공회의소 추가</b><span class="sp"></span><button type="button" class="sm" id="mCloseBtn">닫기</button></div>' +
      '<div class="mbd">' +
        '<div class="note">추후 당진·천안·아산·태안·예산·홍성 등 새로운 지역 상공회의소 컨설팅이 들어올 때 왼쪽 대시보드에 바로 분리 항목을 추가합니다.</div>' +
        '<div class="fr"><label for="rgName">정식 명칭</label><div class="fv"><input type="text" id="rgName" placeholder="예: 천안아산상공회의소 인사노무컨설팅"></div></div>' +
        '<div class="fr"><label for="rgShort">대시보드 약칭</label><div class="fv"><input type="text" id="rgShort" placeholder="예: 천안상의 (미입력 시 정식 명칭 사용)"></div></div>' +
        '<div class="fr"><label for="rgKw">자동분류 키워드</label><div class="fv"><input type="text" id="rgKw" placeholder="쉼표 구분 (예: 천안상의,천안상공회의소)"></div></div>' +
      '</div>' +
      '<div class="mft"><button type="button" class="sm" id="mCancelBtn">취소</button><button type="button" class="pri" id="mRegSaveBtn">지역 추가 저장</button></div>';
    m.style.display = 'flex';
    if ($('mCloseBtn')) $('mCloseBtn').onclick = closeModal;
    if ($('mCancelBtn')) $('mCancelBtn').onclick = closeModal;
    if ($('rgName')) $('rgName').focus();
    if ($('mRegSaveBtn')) $('mRegSaveBtn').onclick = async function () {
      var nm = cleanText($('rgName').value).slice(0, 76);
      if (!nm) { toast('지역 상공회의소 명칭을 입력하세요.'); return; }
      var sn = cleanText($('rgShort').value).slice(0, 36) || nm.slice(0, 36);
      var dup = getEffectiveTracks().find(function (t) {
        return str(t.name) === nm || trackShortLabel(t) === sn;
      });
      if (dup) { toast('이미 등록된 지역 상공회의소입니다: ' + trackShortLabel(dup)); return; }
      var saveBtn = $('mRegSaveBtn');
      if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '추가 중…'; }
      var rid = 'ch_reg_' + Date.now().toString(36);
      var kw = cleanText($('rgKw').value).slice(0, 280) || sn;
      var rec = {
        id: rid,
        entityType: 'Document',
        schemaVersion: 1,
        contractVersion: 1,
        revision: 0,
        name: nm,
        shortName: sn,
        agency: str(cat.shortName),
        keywords: kw,
        sortOrder: 100 + getCustomRegionsList().length
      };
      try {
        D.regions = D.regions || {};
        D.regions[rid] = await saveRecord('regions/' + rid, rid, rec, 'Document');
        TRACK_FILTER = rid;
        YEAR_FILTER = '';
        closeModal();
        rebuildDiscoverAndRag();
        draw();
        toast('[' + sn + '] 지역 대시보드에 추가되었습니다.');
      } catch (e) {
        if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '지역 추가 저장'; }
        toast('지역 추가 실패: ' + e.message);
      }
    };
  }

  function openBundlePreviewModal(key) {
    var b = (D.discover.bundles || []).find(function (x) { return x.key === key; });
    var m = $('modal'), box = $('mbox');
    if (!m || !box || !b) return;
    LAST_FOCUS_EL = document.activeElement;
    var itemsHtml = (b.items || b.comms || []).slice(0, 15).map(function (c, i) {
      return '<div class="ind-card" style="margin-bottom:6px"><div class="ind-hd"><b>' + (i + 1) + '. ' + esc(c.subject || c.title || '자료') + '</b><span class="chip">' + esc(c.source || '-') + '</span><span class="hint">' + esc(c.date || '-') + '</span></div>' +
        '<div style="font-size:12px;color:var(--ink2);white-space:pre-wrap">' + esc(c.maskedPreview || '') + '</div></div>';
    }).join('');
    box.innerHTML =
      '<div class="mhd"><b id="mhdTitle">📥 후보 미리보기 · ' + esc(b.companyName) + '</b><span class="sp"></span><button type="button" class="sm" id="mCloseBtn">닫기</button></div>' +
      '<div class="mbd"><div class="note">감지 사유: ' + esc((b.reasonsList || []).join(' · ') || '자동분류') + ' (메일 ' + b.mailCount + ' / 톡 ' + b.msgCount + ')</div>' + (itemsHtml || '<div class="empty">세부 항목 없음</div>') + '</div>' +
      '<div class="mft"><button type="button" class="sm" id="mCancelBtn">닫기</button><button type="button" class="pri" id="mImportBtn">📥 이 후보 1클릭 등록</button></div>';
    m.style.display = 'flex';
    if ($('mCloseBtn')) $('mCloseBtn').onclick = closeModal;
    if ($('mCancelBtn')) $('mCancelBtn').onclick = closeModal;
    if ($('mImportBtn')) {
      $('mImportBtn').onclick = async function () {
        closeModal();
        await importCandidateByKey(b.key);
        switchTab('detail');
      };
      $('mImportBtn').focus();
    }
  }

  function openCommModal(comm) {
    var m = $('modal'), box = $('mbox');
    if (!m || !box || !comm) return;
    LAST_FOCUS_EL = document.activeElement;
    box.innerHTML =
      '<div class="mhd"><b id="mhdTitle">' + esc(comm.subject || comm.title || '수신 자료') + '</b><span class="sp"></span><button type="button" class="sm" id="mCloseBtn">닫기</button></div>' +
      '<div class="mbd"><div class="note">채널: ' + esc(comm.source || '-') + ' | 일자: ' + esc(comm.date || '-') + '</div>' +
        '<div class="mail-body">' + esc(comm.maskedPreview || '(본문 요약 없음)') + '</div></div>' +
      '<div class="mft"><button type="button" class="pri" id="mOkBtn">확인</button></div>';
    m.style.display = 'flex';
    if ($('mCloseBtn')) $('mCloseBtn').onclick = closeModal;
    if ($('mOkBtn')) { $('mOkBtn').onclick = closeModal; $('mOkBtn').focus(); }
  }

  function closeModal() {
    if ($('modal')) $('modal').style.display = 'none';
    if (LAST_FOCUS_EL && typeof LAST_FOCUS_EL.focus === 'function') {
      try { LAST_FOCUS_EL.focus(); } catch (e) {}
    }
    LAST_FOCUS_EL = null;
  }

  function normalizeTabName(tab) {
    var t = str(tab) || 'projects';
    if (t === 'check' || t === 'intake') return 'detail';
    if (t === 'coach') return 'report';
    // 연도별 자료함 탭이 없는 화면(가벼운 화면)에서 옛 주소(?tab=yearly)·옛 단추가 오면 사업 현황으로 — 연도 알약이 거기 있다
    if (t === 'yearly' && !$('p-yearly')) return 'projects';
    return t;
  }

  function switchTab(tab) {
    if (CUR_TAB === 'report') captureReportUiState();
    CUR_TAB = normalizeTabName(tab);
    document.querySelectorAll('.tabs button[data-tab], .tabs button[data-t]').forEach(function (b) {
      var bt = b.getAttribute('data-tab') || b.getAttribute('data-t');
      var on = bt === CUR_TAB;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    document.querySelectorAll('main section.pane').forEach(function (sec) {
      sec.classList.toggle('on', sec.id === 'p-' + CUR_TAB);
    });
    draw();
  }

  function draw() {
    renderRecentDiffBar();
    renderLeftDash();
    updateTabCounts();
    if (CUR_TAB === 'projects') renderProjectsPane();
    else if (CUR_TAB === 'inbox') renderInboxPane();
    else if (CUR_TAB === 'yearly') renderYearlyPane();
    else if (CUR_TAB === 'detail') renderDetailPane();
    else if (CUR_TAB === 'report') renderReportPane();
  }

  function bindEvents() {
    document.querySelectorAll('.tabs button[data-tab], .tabs button[data-t]').forEach(function (b) {
      b.onclick = function () { switchTab(b.getAttribute('data-tab') || b.getAttribute('data-t')); };
    });
    if ($('projQ')) $('projQ').oninput = function () { if (CUR_TAB === 'projects') renderProjectsPane(); };
    if ($('projTrackSel')) $('projTrackSel').onchange = function () {
      TRACK_FILTER = $('projTrackSel').value;
      SHOW_ALL_ROWS = false;
      draw();
    };
    if ($('projSt')) $('projSt').onchange = function () { SHOW_ALL_ROWS = false; renderProjectsPane(); };
    if ($('projYrSel')) $('projYrSel').onchange = function () {
      YEAR_FILTER = $('projYrSel').value;
      SHOW_ALL_ROWS = false;
      draw();
    };
    if ($('projMgr')) $('projMgr').onchange = function () { SHOW_ALL_ROWS = false; renderProjectsPane(); };
    if ($('projResetBtn')) $('projResetBtn').onclick = function () {
      TRACK_FILTER = ''; YEAR_FILTER = ''; SHOW_ALL_ROWS = false;
      if ($('projQ')) $('projQ').value = '';
      setStFilter('');
      if ($('projMgr')) $('projMgr').value = '';
      draw();
    };
    if ($('openCoachQuickBtn')) $('openCoachQuickBtn').onclick = function () { WS_FOCUS = 'coach'; switchTab('report'); };
    if ($('newProjBtn')) $('newProjBtn').onclick = openNewProjectModal;
    if ($('scanAllBtn')) $('scanAllBtn').onclick = function () { rebuildDiscoverAndRag(); draw(); toast('메일·카톡 자동분류를 재실행했습니다.'); };
    if ($('syncAllBtn')) $('syncAllBtn').onclick = function () {
      if (PREVIEW_MODE) { toast('미리보기 데이터 재동기화 완료'); return; }
      reload(SESSION_EPOCH, ME && ME.uid);
    };
    if ($('reloadBtn')) $('reloadBtn').onclick = function () { reload(SESSION_EPOCH, ME && ME.uid); };
    if ($('projCsvBtn')) $('projCsvBtn').onclick = function () { downloadStatusCsv(false); };
    if ($('allCsvBtn')) $('allCsvBtn').onclick = function () { downloadStatusCsv(true); }; // 미등록 후보까지 연도별 전체(옛 «연도별 자료함» CSV)
    if ($('outBtn')) $('outBtn').onclick = function () { if (fb && fb.auth) fb.auth().signOut(); };

    // 탭 2 (미등록 후보)
    if ($('inQ')) $('inQ').oninput = function () { if (CUR_TAB === 'inbox') renderInboxPane(); };
    if ($('inResetBtn')) $('inResetBtn').onclick = function () {
      YEAR_FILTER = '';
      if ($('leftDash')) TRACK_FILTER = '';
      if ($('inQ')) $('inQ').value = '';
      draw();
    };
    if ($('inboxRescanBtn')) $('inboxRescanBtn').onclick = function () { rebuildDiscoverAndRag(); draw(); toast('후보를 다시 스캔했습니다.'); };
    if ($('bulkImportCandBtn')) $('bulkImportCandBtn').onclick = function () {
      var picks = getFilteredInboxBundles().list.filter(function (b) { return SEL['d:' + b.key]; });
      if (!picks.length) { toast('체크박스로 후보를 먼저 선택하세요.'); return; }
      importCandidatesList(picks, $('bulkImportCandBtn'), '☑ 선택 후보 등록');
    };
    if ($('importAllCandBtn')) $('importAllCandBtn').onclick = function () {
      var picks = getFilteredInboxBundles().list;
      importCandidatesList(picks, $('importAllCandBtn'), '+ 전체 편입');
    };

    // 탭 3 (연도별 자료함)
    if ($('yrQ')) $('yrQ').oninput = function () { if (CUR_TAB === 'yearly') renderYearlyPane(); };
    if ($('yrTrackSel')) $('yrTrackSel').onchange = function () {
      TRACK_FILTER = $('yrTrackSel').value;
      if ($('projTrackSel')) $('projTrackSel').value = TRACK_FILTER;
      draw();
    };
    if ($('yrKind')) $('yrKind').onchange = function () { if (CUR_TAB === 'yearly') renderYearlyPane(); };
    if ($('yrResetBtn')) $('yrResetBtn').onclick = function () {
      YEAR_FILTER = '';
      TRACK_FILTER = '';
      if ($('yrQ')) $('yrQ').value = '';
      if ($('yrTrackSel')) $('yrTrackSel').value = '';
      if ($('projTrackSel')) $('projTrackSel').value = '';
      if ($('yrKind')) $('yrKind').value = '';
      draw();
    };
    if ($('yrCsvBtn')) $('yrCsvBtn').onclick = function () { downloadStatusCsv(true); };

    document.addEventListener('change', function (e) {
      var t = e.target;
      if (!t || t.type !== 'checkbox') return;
      var allList = t.getAttribute('data-ckall');
      if (allList) {
        var wantChecked = !!t.checked;
        document.querySelectorAll('input[type="checkbox"][data-list="' + cssEsc(allList) + '"]').forEach(function (cb) {
          cb.checked = wantChecked;
          var k = cb.getAttribute('data-ck');
          if (k) SEL[k] = wantChecked;
          if (cb.hasAttribute('data-quick-ok') && typeof cb.onchange === 'function') cb.onchange();
        });
        if (allList === 'proj') refreshProjBulkUi();
        else if (allList === 'cand') refreshCandBulkUi();
        return;
      }
      var k = t.getAttribute('data-ck');
      if (k) {
        SEL[k] = t.checked;
        var listKind = t.getAttribute('data-list');
        if (listKind === 'proj') refreshProjBulkUi();
        else if (listKind === 'cand') refreshCandBulkUi();
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeModal();
    });
  }

  function lockScreen(why) {
    if ($('app')) $('app').style.display = 'none';
    if ($('lock')) $('lock').style.display = 'block';
    if ($('lockWhy')) $('lockWhy').textContent = why || '';
  }

  function boot(firebaseInstance, appKey) {
    APP_KEY = str(appKey) || 'sixthind';
    // 가벼운 화면(slimUi)은 «변경됨» 표시·강조 상자를 쓰지 않는다 — 탭과 같은 단추를 되풀이하던 띠도 함께 걷는다.
    DIFF_HIGHLIGHT = !isSlim();
    fb = firebaseInstance;
    fbDb = fb && fb.database ? fb.database() : null;
    bindEvents();

    if (isLocalPreviewAllowed()) {
      PREVIEW_MODE = true;
      ME = { uid: 'preview', sid: 'P000', name: '점검미리보기', isAdmin: false };
      if (global.PuGate) try { global.PuGate.hide(); } catch (e) {}
      if ($('lock')) $('lock').style.display = 'none';
      if ($('app')) $('app').style.display = '';
      if ($('who')) $('who').textContent = '미리보기 모드(읽기전용)';
      reload(++SESSION_EPOCH, 'preview');
      return;
    }

    if (!fb || !fb.auth) {
      lockScreen('Firebase 인증을 초기화할 수 없습니다.');
      return;
    }
    try { fb.auth().setPersistence(fb.auth.Auth.Persistence.LOCAL); } catch (e) {}
    fb.auth().onAuthStateChanged(async function (u) {
      var epoch = ++SESSION_EPOCH;
      var authUid = (u && u.uid) ? String(u.uid) : '';
      if ($('outBtn')) $('outBtn').style.display = authUid ? '' : 'none';
      if (!authUid) {
        ME = null;
        gate = null;
        D = { companies: [], consultings: [], consTypes: [], regions: {}, projects: {}, checks: {}, comms: {}, reports: {}, mailboxFolders: {}, mailboxMsgs: {}, mailboxOldMsgs: {}, msgIntake: {}, ragNotes: {}, discover: null, ragIndex: null };
        if ($('lock')) $('lock').style.display = 'none';
        if ($('app')) $('app').style.display = 'none';
        if (global.PuGate) global.PuGate.show();
        return;
      }
      if (global.PuGate) global.PuGate.hide();
      var roleVal = {};
      try { roleVal = (await fbDb.ref('uid_roles/' + authUid).once('value')).val() || {}; } catch (e) {}
      if (epoch !== SESSION_EPOCH) return;
      if (roleVal.status !== 'active' || !roleVal.sid) {
        lockScreen('재직 중인 직원 계정이 아닙니다.');
        return;
      }
      ME = { uid: authUid, sid: String(roleVal.sid), name: String(roleVal.name || ''), email: String(u.email || ''), isAdmin: roleVal.isAdmin == true };
      gate = wrapSnapGuard(global.PuOntologyWrite.createGateway({ mode: 'enforce', actor: ME.sid }));
      if ($('lock')) $('lock').style.display = 'none';
      if ($('app')) $('app').style.display = '';
      await reload(epoch, authUid);
    });
  }

  global.PuConsultView = {
    boot: boot,
    reload: reload,
    switchTab: switchTab,
    // 검사 전용 — 화면 없이 회차 셈·메모 거르기만 돌려 본다(자료를 받아 읽기만 하고 아무것도 저장하지 않는다)
    __test: {
      use: function (appKey, data) {
        APP_KEY = appKey;
        D.consultings = (data && data.consultings) || [];
        D.govCos = (data && data.govCos) || null;
        D.govScheds = (data && data.govScheds) || null;
        D.govTypes = (data && data.govTypes) || null;
        _roundCache = { key: '', map: null };
      },
      roundsOf: function (p) { return roundsOf(p); },
      roundChipsHtml: function (p) { return roundChipsHtml(p); },
      roundsPanelHtml: function (p) { return roundsPanelHtml(p); },
      roundKpiHtml: function (list) { return roundKpiHtml(list); },
      memoShown: function (p) { return memoShown(p); }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
