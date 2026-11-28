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
 *
 * 카탈로그 옵션(앱마다 선택):
 *   lean      — 중복 걷어내기: 변경점 바·연도별 자료함 탭·중복 필터·RAG 코치·수집자료 합계를 빼고 보고서만 남긴다
 *   kindSplit — «컨설팅 수행» 과 «안내·기타(신청 안내 발송·회신 기록)» 를 두 탭으로 가른다
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
  var ERP_FILTER = ''; // '' | 'unlinked' — ERP 사건번호가 비어 있는 줄만 보기(KPI «ERP 미연결» 단추)
  var ST_FILTER = ''; // '' | 'active' | 'done' — 진행상태 거르기. 위쪽 KPI 알약이 눌러 바꾼다(드롭다운이 없는 화면에서도 동작)
  var WS_FOCUS = ''; // '' | 'coach' | 'doc'
  var CUR_REPORT_KIND = 'comprehensive';
  var CUR_COACH_ANSWER = null;
  var LAST_COACH_QUERY = '';
  var UNSAVED_REPORT_DRAFT = Object.create(null);
  var GUIDE_STATE_FILTER = '';

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
    var audit = trackAuditMap();
    if (audit) {
      var used = Object.create(null);
      Object.keys(audit).forEach(function (k) { used[audit[k].to] = 1; });
      Object.keys(VIRTUAL_TRACKS).forEach(function (id) { if (used[id]) base.push(VIRTUAL_TRACKS[id]); });
    }
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

  /* ══ 분류 다시 보기 (카탈로그 trackAudit — 출산육아·유연근무, 대표 지시 2026-11-28 「사업별로 나누고 정확하게 다시 분류」) ══
     ★ «읽을 때만» 근거로 권장 갈래를 정해 «사본»에 얹는다(_storedTrackId 에 원래 값). 서버 자료는 «🔎 분류 점검» 창에서 사람이 누를 때만 바뀐다.
     ★ saveRecord 가 _storedTrackId 를 보면 원래 갈래로 되돌려 저장한다 — 다른 저장 길로 보정값이 새지 않게.
     ★ 근거 글: 사업장명 · 요약 · 사건번호 · 지금 갈래 이름 · 붙은 메일·카톡 제목. 비기면 «분류 확인», 다른 사업이면 «관련 없음». */
  var _auditCache = { key: '', map: null };
  function trackAuditMap() {
    var cat = getAppCat();
    var I = Intake();
    if (!cat.trackAudit || !I || typeof I.classifyFamilywork !== 'function') return null;
    var ids = Object.keys(D.projects || {});
    var ck = APP_KEY + '|' + ids.length + '|' + Object.keys(D.comms || {}).length + '|' + ((D.discover && D.discover.matchedCommsByPid) ? Object.keys(D.discover.matchedCommsByPid).length : 0) + '|' + ids.reduce(function (s, k) { var p = D.projects[k]; return s + num(p && p.revision, 0); }, 0);
    if (_auditCache.key === ck && _auditCache.map) return _auditCache.map;
    var known = Object.create(null);
    (cat.tracks || []).forEach(function (t) { known[t.id] = t; });
    var legacy = cat.legacyTrackIds || [];
    var map = Object.create(null);
    ids.forEach(function (k) {
      var p = D.projects[k];
      if (!p || p._deleted) return;
      var stored = str(p.trackId);
      var subjects = getProjectComms(k).slice(0, 12).map(function (c) { return str(c.subject || c.title); }).join(' ');
      var text = [p.companyName, p.summaryNote, p.caseNo, p.trackName, subjects].join(' ');
      var r = I.classifyFamilywork(text);
      var to = stored;
      if (r && r.id === 'fw_offtopic') to = 'fw_offtopic';
      else if (r && r.level === 'tie') to = (known[stored] && r.counts[stored]) ? stored : 'fw_check';
      else if (r) to = r.id;
      else if (!known[stored] || legacy.indexOf(stored) >= 0) to = 'fw_check';
      var ev = r ? Object.keys(r.evidence || {}).map(function (id) { return (r.evidence[id] || []).join('·'); }).filter(Boolean).join(' / ') : '';
      map[k] = { from: stored, to: to, level: r ? r.level : 'none', evidence: ev, changed: to !== stored };
    });
    _auditCache = { key: ck, map: map };
    return map;
  }
  var VIRTUAL_TRACKS = {
    fw_check: { id: 'fw_check', name: '분류 확인 — 근거가 비기거나 없어 사람이 정할 건', shortName: '분류 확인', icon: '🔎', virtual: true },
    fw_offtopic: { id: 'fw_offtopic', name: '관련 없음 — 다른 사업(산업일자리전환 등) 글만 있는 건', shortName: '관련 없음', icon: '🚫', virtual: true }
  };

  function projectsList() {
    // 이 프로그램에 담지 않는 트랙(excludeTrackIds)의 사업은 목록·집계에서 뺀다 — 자료는 지우지 않는다.
    var excl = getAppCat().excludeTrackIds || [];
    var splitCols = getAppCat().listCols !== 'merged'; // 12개 앱 공통 독립 열 — 같은 연도 안에서 트랙 → 사업장명
    var trackOrder = Object.create(null);
    (getAppCat().tracks || []).forEach(function (t, i) { trackOrder[t.id] = i; });
    var audit = trackAuditMap();
    var trackNames = Object.create(null);
    (getAppCat().tracks || []).forEach(function (t) { trackNames[t.id] = t.name; });
    Object.keys(VIRTUAL_TRACKS).forEach(function (id) { trackNames[id] = VIRTUAL_TRACKS[id].name; });
    return Object.keys(D.projects || {}).map(function (k) {
      var p = Object.assign({ id: k }, D.projects[k]);
      var a = audit && audit[k];
      if (a && a.changed) { p._storedTrackId = a.from; p._storedTrackName = str(p.trackName); p._audit = a; p.trackId = a.to; p.trackName = trackNames[a.to] || p.trackName; }
      return p;
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

  /* ── 사업장 단위 묶어 보기 (카탈로그 groupByCompany — 기초인사노무, 대표 지시 2026-11-28 「연도가 중복돼서 업무가 중복된다 — 정확하게 다시 정리」) ──
   * 푸른노무법인이 직접 계약한 사업은 같은 사업장이 해마다 한 건씩 쌓인다. 연도별 건·자료·보고서는 그대로 두고,
   * 목록·집계만 «사업장 한 줄 + 연도 칩» 으로 묶는다. 저장된 자료는 바꾸지 않는다(보기 전용 묶음).
   * 묶는 열쇠: companyId → 없으면 정규화한 상호(저장하지 않는 화면 전용 묶음이라 온톨로지 «이름으로 관계 저장 금지»와 부딪히지 않는다). */
  function isGrouped() { return !!getAppCat().groupByCompany; }
  function companyKeyOf(p) {
    var cid = str(p.companyId);
    if (cid) return 'c:' + cid;
    var I = Intake();
    var nn = (I && I.normCorpName) ? I.normCorpName(p.companyName) : str(p.companyName).toLowerCase();
    return 'n:' + (nn || str(p.id));
  }
  // list 순서를 지키며 사업장별로 묶는다. 대표(head)는 지금 열어 둔 건, 없으면 가장 최근 연도 건.
  function groupProjects(list) {
    var order = [];
    var map = Object.create(null);
    list.forEach(function (p) {
      var k = companyKeyOf(p);
      var g = map[k];
      if (!g) { g = map[k] = { key: k, rows: [] }; order.push(g); }
      g.rows.push(p);
    });
    order.forEach(function (g) {
      g.rows.sort(function (a, b) { return num(b.year, 0) - num(a.year, 0); });
      g.head = g.rows.filter(function (p) { return p.id === CUR_PID; })[0] || g.rows[0];
      g.active = g.rows.some(function (p) { return p.status !== 'done'; });
    });
    return order;
  }
  /* ══ 컨설팅 «수행» 과 «안내·기타» 구분 (카탈로그 kindSplit 앱 전용 · 대표 지시 2026-11-28) ═════
   * 수행 = ERP 수임·로컬 산출물·사건번호가 있는 건.  안내·기타 = 메일·카톡만 있거나 신청 안내를 보낸 건.
   * p.kind 가 있으면 사람이 정한 값이 이긴다. 없으면 summaryNote 맨 앞 [출처] 꼬리표로 «읽을 때만» 추정한다 —
   * 저장된 자료는 이 추정 때문에 바뀌지 않는다(종료·삭제·되돌림 불변 규칙). */
  // lean(중복·RAG 코치 걷기)은 기술보호에서 시작해 12개 앱 공통 기본이 됐다(대표 지시 2026-11-28 «기술보호 고친 걸 기준으로 전체 일치»).
  // RAG 는 «실무코치·RAG»(pu-coach.html) 앱 한 곳에만 둔다. 끌 앱만 카탈로그에 lean:false.
  function isLean() { return getAppCat().lean !== false; }
  function isSplit() { return !!getAppCat().kindSplit; }
  var GUIDE_STATE = {
    pre:       { label: '발송 전',        cls: '',        kpi: '' },
    wait:      { label: '회신 대기',      cls: 'c-amber', kpi: 'k-amber' },
    apply:     { label: '신청 의사',      cls: 'c-green', kpi: 'k-green' },
    othercons: { label: '타 컨설팅 진행', cls: 'c-blue',  kpi: 'k-blue' },
    hold:      { label: '보류·재안내',    cls: 'c-amber', kpi: 'k-amber' },
    decline:   { label: '거절·불필요',    cls: 'c-red',   kpi: '' },
    noreply:   { label: '무응답 확정',    cls: '',        kpi: '' },
    etc:       { label: '기타 자료',      cls: '',        kpi: '' }
  };
  var GUIDE_STATE_ORDER = ['pre', 'wait', 'apply', 'othercons', 'hold', 'decline', 'noreply', 'etc'];
  var GUIDE_RESP_IDS = ['apply', 'othercons', 'hold', 'decline', 'noreply'];
  function sourceTags(p) {
    var m = /^\[([^\]]+)\]/.exec(str(p && p.summaryNote));
    return m ? m[1].split('+').map(function (s) { return str(s); }).filter(Boolean) : [];
  }
  function noteWithoutTag(p) { return str(p && p.summaryNote).replace(/^\[[^\]]+\]\s*/, ''); }
  function sourceChipsHtml(p) {
    return sourceTags(p).map(function (t) {
      return '<span class="chip' + (t === 'ERP' ? ' c-green' : (t === '로컬' ? ' c-blue' : '')) + '">' + esc(t) + '</span>';
    }).join(' ');
  }
  function projectKind(p) {
    if (!p) return 'perf';
    var k = str(p.kind);
    if (k === 'perf' || k === 'guide' || k === 'other') return k;
    if (str(p.caseNo)) return 'perf';
    var tags = sourceTags(p);
    if (tags.indexOf('ERP') >= 0 || tags.indexOf('로컬') >= 0) return 'perf';
    if (tags.length) return 'guide';
    return /^자동 감지 등록/.test(str(p.summaryNote)) ? 'guide' : 'perf';
  }
  function laneProjects(lane) {
    var all = projectsList();
    if (!isSplit()) return lane === 'perf' ? all : [];
    return all.filter(function (p) { return (projectKind(p) === 'perf') === (lane === 'perf'); });
  }
  function mainProjects() { return laneProjects('perf'); }
  function guideState(p) {
    if (projectKind(p) === 'other') return 'etc';
    var r = str(p && p.guideResponse);
    if (GUIDE_RESP_IDS.indexOf(r) >= 0) return r;
    return str(p && p.guideSentAt) ? 'wait' : 'pre';
  }
  function todayYmd() { return new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10); }
  function ymdUtc(v) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str(v));
    return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
  }
  function daysSince(v) {
    var a = ymdUtc(v), b = ymdUtc(todayYmd());
    return (a == null || b == null) ? null : Math.floor((b - a) / 864e5);
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
  /* 기술보호컨설팅을 고친 «가벼운 화면»이 12개 앱 공통 기본이다 (대표 지시 2026-11-28 「기술보호 고친 걸 기준으로 전체 일치」).
     처음엔 기술보호·현장클리닉만 켰다(slimUi:true). 이제 꺼야 할 앱만 카탈로그에 slimUi:false 를 적는다. */
  function isSlim() { return getAppCat().slimUi !== false; }
  // 보고서 탭의 일반 원고를 접는 것은 «기관 제출 서식이 컨설팅보고서(gov-report)에 있는 앱»만이다 —
  // 기초인사·평가보상처럼 기관 서식이 없는 앱은 이 탭의 원고가 곧 산출물이라 접지 않는다.
  function reportFolded() { return isSlim() && !!getAppCat().govReportForm; }
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
    // 분류 다시 보기(trackAudit)가 사본에 얹은 권장 갈래는 화면 전용 — 원래 갈래로 되돌려 저장한다(사람이 «분류 바꾸기»로 고른 patch 만 예외)
    if (Object.prototype.hasOwnProperty.call(rec, '_storedTrackId')) {
      var pt = opts.patch || {};
      if (!Object.prototype.hasOwnProperty.call(pt, 'trackId')) { rec.trackId = rec._storedTrackId; rec.trackName = rec._storedTrackName; }
      delete rec._storedTrackId; delete rec._storedTrackName; delete rec._audit;
    }
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
    if (R && C && !isLean()) {
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
    if (isLean()) { el.innerHTML = ''; return; }
    var cat = getAppCat();
    // 가벼운 화면은 이 띠를 그리지 않는다 — 탭과 똑같은 이동 단추(사업 현황·미등록 후보·보고서)를 한 번 더 늘어놓던 자리였다.
    if (isSlim()) { el.innerHTML = ''; return; }
    var isLeft = leftDashOn();
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

  /* ══ 왼쪽 대시보드 — 12개 앱 공통 (대표 지시 2026-11-28) ═══════════════════
     「상공회의소처럼 기관이 여러 개로 나뉘거나 비슷한 컨설팅을 몇 회 나눠 한 경우는 왼쪽 대시보드로 정리하고 나머지는 다 일치하게」.
     ★ 켜는 잣대는 «자료»다 — 사업이 실제로 들어 있는 세부 트랙(기관·지역·갈래)이 둘 이상일 때만 켠다.
       하나뿐이면(기술보호처럼) 왼쪽 칸을 접고 한 단 화면으로 둔다. 카탈로그 hasLeftDashboard 는 «늘 켬»(상공회의소·6차산업),
       leftDash:false 는 «늘 끔».
     ★ 켜지면 위쪽 트랙 알약줄·연도 알약줄을 숨긴다 — 같은 고르기를 두 군데서 보이지 않는다(가벼운 화면 원칙).
     ★ 목록 화면(사업 현황·미등록 후보)에서만 보인다. 진행·체크·보고서 작업실은 넓게 쓴다. */
  function usedTrackIds() {
    var used = Object.create(null);
    mainProjects().forEach(function (p) { var t = str(p.trackId); if (t) used[t] = 1; });
    return used;
  }
  // 자료로 보아 왼쪽 대시보드가 «필요한가» (화면 틀과 상관없이 — 검사도 이것을 본다)
  function leftDashWanted() {
    var cat = getAppCat();
    if (cat.leftDash === false) return false;
    if (cat.hasLeftDashboard) return true;
    return Object.keys(usedTrackIds()).length >= 2 || !!TRACK_FILTER;
  }
  function leftDashOn() { return !!$('leftDash') && leftDashWanted(); }
  function leftDashShown() { return leftDashOn() && (CUR_TAB === 'projects' || CUR_TAB === 'inbox'); }
  function leftDashLabels() {
    var cat = getAppCat();
    var LD = cat.leftDash || {};
    var icon = cat.icon || '📂';
    var by = str(LD.by) || '세부 트랙';
    return {
      head: LD.headLabel || (icon + ' ' + by + '별 현황'),
      all: LD.allLabel || (icon + ' 전체 ' + by),
      scopeAll: LD.scopeAll || ('전체 ' + by),
      add: LD.addLabel || ('+ 새 ' + (cat.regionLabel || by) + ' 추가')
    };
  }

  function renderLeftDash() {
    var aside = $('leftDash');
    if (!aside) return;
    var shell = aside.parentNode;
    var shown = leftDashShown();
    aside.style.display = shown ? '' : 'none';
    if (shell && shell.classList) shell.classList.toggle('no-left', !shown);
    if (!shown) { aside.innerHTML = ''; return; }

    /* 왼쪽에는 «이름만» 둔다 (대표 지시 2026-11-28 상공회의소 「왼쪽 대시보드에는 지역 상공회의소 이름만 있으면 된다.
       클릭하면 지역별로 사업장들 나오고 체크를 하면 된다」). 연도 단추·진행/완료/후보 숫자·연도 상자는 두지 않는다 —
       연도는 위쪽 연도 알약 한 곳, 숫자는 KPI 한 줄. 건수는 이름에 마우스를 올리면(title) 보인다. */
    var cat = getAppCat();
    var tracks = getEffectiveTracks();
    var allProjs = mainProjects(); // kindSplit 앱은 «수행»만 센다(안내·기타는 따로 탭)
    var cands = (D.discover && D.discover.bundles) || [];
    var L = leftDashLabels();
    aside.className = 'left-dash' + (DIFF_HIGHLIGHT ? ' code-diff-box' : '');

    var cnt = Object.create(null), yrsOf = Object.create(null), candCnt = Object.create(null);
    var unmapped = [];
    allProjs.forEach(function (p) {
      var tid = str(p.trackId);
      cnt[tid] = (cnt[tid] || 0) + 1;
      (yrsOf[tid] = yrsOf[tid] || Object.create(null))[String(num(p.year, CUR_YEAR))] = 1;
      if (tid && !tracks.some(function (t) { return t.id === tid; }) && unmapped.indexOf(tid) < 0) unmapped.push(tid);
    });
    cands.forEach(function (b) { var tid = str(b.suggestedTrackId); if (tid) candCnt[tid] = (candCnt[tid] || 0) + 1; });
    var renderTracks = tracks.slice();
    unmapped.forEach(function (uid) { renderTracks.push({ id: uid, name: uid + ' (기타)', shortName: uid, icon: '🧩' }); });
    // 자료로 켜진 앱은 사업도 후보도 없는 트랙을 올리지 않는다(«0건» 이름 되풀이 금지).
    // 늘 켜는 앱(상공회의소·6차산업 — 정해진 지역 목록)은 지역 이름을 다 보인다. 사람이 추가한 지역·지금 고른 트랙은 늘 남긴다.
    if (!cat.hasLeftDashboard) {
      renderTracks = renderTracks.filter(function (t) { return cnt[t.id] || candCnt[t.id] || t.custom || TRACK_FILTER === t.id; });
    }
    function itemHtml(tid, label, title, on) {
      return '<div class="ld-item' + (on ? ' on' : '') + '">' +
        '<button type="button" class="ld-item-btn" data-ld-track="' + esc(tid) + '" title="' + esc(title) + '" aria-pressed="' + (on ? 'true' : 'false') + '">' +
          '<span class="ld-item-name">' + esc(label) + '</span>' +
        '</button>' +
      '</div>';
    }
    var cardsHtml = itemHtml('', L.all, L.all + ' · ' + allProjs.length + '건' + (cands.length ? (' · 후보 ' + cands.length) : ''), !TRACK_FILTER);
    renderTracks.forEach(function (t) {
      var tip = str(t.name) + ' · ' + (cnt[t.id] || 0) + '건' + (candCnt[t.id] ? (' · 후보 ' + candCnt[t.id]) : '');
      cardsHtml += itemHtml(t.id, (t.icon || '🏛️') + ' ' + trackShortLabel(t), tip, TRACK_FILTER === t.id);
    });

    aside.innerHTML =
      '<div class="ld-hd"><span>' + esc(L.head) + '</span></div>' +
      '<div class="ld-list">' + cardsHtml + '</div>' +
      // 새 지역 추가는 카탈로그가 «사람이 지역을 더하는 앱»이라고 한 곳(regionManageable:true — 상공회의소)만
      (cat.regionManageable === true ? '<button type="button" class="sm ld-add-btn" id="ldAddRegionBtn">' + esc(L.add) + '</button>' : '');

    aside.querySelectorAll('[data-ld-track]').forEach(function (btn) {
      btn.onclick = function () {
        var tid = btn.getAttribute('data-ld-track') || '';
        // «전체»를 누르거나, 고른 연도에 사업이 없는 트랙으로 바꾸면 연도 거르기를 비운다(0건 빈 화면 방지)
        if (!tid || (YEAR_FILTER && !(yrsOf[tid] && yrsOf[tid][YEAR_FILTER]))) YEAR_FILTER = '';
        TRACK_FILTER = tid;
        SHOW_ALL_ROWS = false;
        if (CUR_TAB === 'detail' || CUR_TAB === 'report') switchTab('projects');
        else draw();
      };
    });
    if ($('ldAddRegionBtn')) $('ldAddRegionBtn').onclick = openAddRegionModal;
  }
  function diffCls(on) { return (DIFF_HIGHLIGHT && on) ? ' code-diff-box' : ''; }
  function diffBadge(label) { return DIFF_HIGHLIGHT ? ' <span class="chip c-blue">' + esc(label || '변경됨') + '</span>' : ''; }

  function updateTabCounts() {
    var pList = mainProjects();
    var cands = (D.discover && D.discover.bundles) || [];
    if ($('nGuide')) $('nGuide').textContent = String(laneProjects('guide').length);
    if ($('nProjects')) $('nProjects').textContent = String(isGrouped() ? groupProjects(pList).length : pList.length);
    if ($('nInbox')) $('nInbox').textContent = String(cands.length);
    if ($('nYearly')) $('nYearly').textContent = String(pList.length + cands.length);
  }

  function fillSelectKeepingValue(el, optionsHtml, val) {
    if (!el) return;
    el.innerHTML = optionsHtml;
    el.value = str(val);
    if (el.value !== str(val)) el.value = '';
  }

  // allCount: 사업장 단위 묶음이면 «전체» 칸에 건수 대신 사업장 수를 적는다
  function renderYearButtonsBar(elId, mode, items, allCount) {
    var bar = $(elId);
    if (!bar) return;
    var map = Object.create(null);
    items.forEach(function (x) {
      var yrList = (Array.isArray(x.yearsList) && x.yearsList.length) ? x.yearsList : [x.year]; // 사업장 단위 후보는 여러 연도를 가진다
      yrList.forEach(function (y) { var yr = String(num(y, 2026)); map[yr] = (map[yr] || 0) + 1; });
    });
    if (YEAR_FILTER && !map[YEAR_FILTER]) map[YEAR_FILTER] = 0;
    var yrs = Object.keys(map).sort(function (a, b) { return Number(b) - Number(a); });
    var lbl = mode === 'inbox' ? '수신 연도:' : '연도별 필터:';
    var allOn = YEAR_FILTER === '';
    bar.innerHTML = '<span class="scope-lbl">' + lbl + '</span>' +
      '<button type="button" class="scope-btn' + (allOn ? ' on' : '') + '" aria-pressed="' + (allOn ? 'true' : 'false') + '" data-yr-set="">전체 (' + (allCount == null ? items.length : allCount) + ')</button>' +
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
    var list = mainProjects();
    if (isSplit() && !list.some(function (p) { return p.id === proj.id; })) list = list.concat([proj]);
    var opts = list.map(function (p) {
      return '<option value="' + esc(p.id) + '"' + (p.id === proj.id ? ' selected' : '') + '>' + esc('[' + (p.year || 2026) + '] ' + p.companyName + ' — ' + (p.trackName || getAppCat().shortName)) + '</option>';
    }).join('');
    var switchBtn = mode === 'report'
      ? '<button type="button" class="sm" data-ws-nav="detail">📋 진행·체크·자료 (' + getProjectComms(proj.id).length + ')</button>'
      : '<button type="button" class="sm pri" data-ws-nav="report">⚖️ 보고서 · RAG 코치</button>';
    // lean(12개 앱 공통)은 RAG 코치를 빼고 보고서만 남겨 «좌우 2단 · 코치 집중 · 보고서 집중» 전환 단추가 필요 없다
    var focusBtns = (mode === 'report' && !isLean())
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
        (isLean() ? '' : '<button type="button" data-ws-act="rescan">🔄 메일·카톡 재스캔</button>') +
        (isSplit() ? '<button type="button" data-ws-act="toGuide">📨 안내·기타로 옮기기</button>' : '') +
        '<button type="button" data-ws-act="toggleStatus">' + toggleDoneLbl + '</button>' +
        '<button type="button" data-ws-act="deleteProj">🗑 사업 보관삭제</button>' +
      '</div></details>' +
    '</div>' +
    ((isLean() && mode === 'report') ? '' : stepsRibbonHtml(proj));
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
        else if (act === 'toGuide') moveProjectToGuide(proj.id);
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

  // skipStatus: 사업장 단위 묶음은 «진행중/완료» 를 묶은 뒤(사업장 단위)로 거르므로 건 단위 상태 거름을 건너뛴다.
  function getFilteredProjects(skipStatus) {
    var q = str($('projQ') && $('projQ').value).toLowerCase();
    var st = skipStatus ? '' : stFilter();
    var mgr = str($('projMgr') && $('projMgr').value);
    var erpAud = ERP_FILTER ? erpAudit() : null;
    return mainProjects().filter(function (p) {
      if (TRACK_FILTER && p.trackId !== TRACK_FILTER) return false;
      if (erpAud) { var ea = erpAud.byPid[p.id]; if (!ea || ea.state !== 'unlinked') return false; }
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

  // 사업장 단위 목록: 진행 중인 연도가 하나라도 있으면 «진행중», 전부 끝났으면 «완료»
  function getFilteredGroups() {
    var st = stFilter();
    var groups = groupProjects(getFilteredProjects(true));
    if (st === 'done') groups = groups.filter(function (g) { return !g.active; });
    else if (st === 'active') groups = groups.filter(function (g) { return g.active; });
    return groups;
  }
  // 목록에서 체크한 건(사업장 단위 묶음이면 체크한 사업장의 보이는 연도 건 전부)
  function selectedProjects() {
    if (isGrouped()) {
      var out = [];
      getFilteredGroups().forEach(function (g) { if (SEL['g:' + g.key]) out = out.concat(g.rows); });
      return out;
    }
    return getFilteredProjects().filter(function (p) { return SEL['p:' + p.id]; });
  }

  function hasProjFilterActive() {
    return !!(TRACK_FILTER || YEAR_FILTER || ERP_FILTER ||
      str($('projQ') && $('projQ').value) ||
      stFilter() ||
      str($('projMgr') && $('projMgr').value));
  }

  /* ── ERP 사건번호 연결 점검(읽기만) · 번호 칸 · [연결] 한 건 (대표 지시 2026-11-28 상공회의소 「ERP 번호가 왜 안 붙었는지 체크하고 연결」) ──
     ⚠ 이름이 닮았다고 번호를 자동으로 붙이지 않는다(온톨로지 규칙) — 후보가 정확히 하나일 때 사람이 [연결]을 눌러야만 저장한다.
     ⚠ 한 번호는 한 사업장에만 — 이미 다른 줄에 붙은 번호는 막는다. 저장은 caseNo 한 칸만(patch). */
  function erpAudit() {
    var I = Intake();
    if (!I || typeof I.auditErpLinks !== 'function') {
      return { byPid: Object.create(null), counts: { linked: 0, manual: 0, unlinked: 0, na: 0 }, ledger: { count: 0, minYear: 0, maxYear: 0 } };
    }
    return I.auditErpLinks(APP_KEY, projectsList(), { consultings: D.consultings, consTypes: D.consTypes });
  }
  var ERP_SHORT = { candidate: '후보 1건', ambiguous: '후보 여럿', twin: '중복', agency: '기관명', noyear: '원장에 없음', none: '못 찾음' };
  function erpCellHtml(p, audit) {
    var a = audit && audit.byPid && audit.byPid[p.id];
    var no = str(p.caseNo);
    if (no) {
      return '<span class="chip c-blue" title="ERP 수임 사건번호">' + esc(no) + '</span>' +
        ((a && a.state === 'manual') ? ' <span class="chip c-amber" title="ERP 수임 원장에서 이 번호를 찾지 못했습니다 — 번호를 확인하세요">원장 확인</span>' : '');
    }
    if (!a || a.state !== 'unlinked') return '<span class="hint" title="이 프로그램은 ERP 수임 원장에 같은 유형이 없어 번호를 쓰지 않습니다">-</span>';
    var btn = (a.reason === 'candidate' && a.cands && a.cands[0])
      ? ' <button type="button" class="sm ok" data-erp-link="' + esc(p.id) + '" data-erp-no="' + esc(a.cands[0].no) + '" title="' + esc(a.text) + '">연결 ' + esc(a.cands[0].no) + '</button>'
      : '';
    return '<span class="chip c-amber" title="' + esc(a.text) + '">미연결 · ' + esc(ERP_SHORT[a.reason] || '확인') + '</span>' + btn;
  }
  async function connectErpNo(pid, no) {
    var p = projectById(pid);
    no = cleanText(no).slice(0, 60);
    if (!p || !no) return;
    if (str(p.caseNo)) { toast('이미 사건번호가 있습니다: ' + p.caseNo); return; }
    var dup = projectsList().find(function (q) { return q.id !== pid && str(q.caseNo) === no; });
    if (dup) { toast('이 번호는 이미 다른 사업장(' + dup.companyName + ')에 연결돼 있습니다.'); return; }
    if (PREVIEW_MODE) { toast('미리보기 모드에서는 저장하지 않습니다.'); return; }
    if (!global.confirm(p.companyName + ' 에 ERP 사건번호 ' + no + ' 를 연결할까요?')) return;
    if (await saveProjectPatch(pid, { caseNo: no })) {
      rebuildDiscoverAndRag();
      draw();
      toast('ERP 사건번호 ' + no + ' 를 연결했습니다.');
    }
  }

  function renderProjectsPane() {
    var cat = getAppCat();
    var tracks = getEffectiveTracks();
    var allProjs = mainProjects();
    var lean = isLean();
    var cands = (D.discover && D.discover.bundles) || [];
    var hwpx = Hwpx();
    var audit = erpAudit();
    // 가벼운 화면 + 사업이 한 트랙에만 있으면: 트랙 알약·줄마다 같은 트랙 칩은 되풀이라 걷는다
    var oneTrackSlim = isSlim() && Object.keys(usedTrackIds()).length <= 1;
    // 왼쪽 대시보드가 켜지면 트랙·연도 고르기는 왼쪽 한 곳 — 위쪽 알약줄은 숨기고, 한 트랙을 고른 동안은 줄마다 같은 트랙 칩도 걷는다
    var ldOn = leftDashOn();
    var ldSlim = ldOn && isSlim();
    var hideTrackChip = oneTrackSlim || (ldSlim && !!TRACK_FILTER);
    var showRounds = !!roundUnit();
    var visTrackCount = tracks.length;

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
      // lean: 자료가 없는 트랙 알약은 그리지 않는다(눌러도 빈 목록) — 둘 미만이면 줄 전체를 감춘다
      var barTracks = lean ? tracks.filter(function (t) { return (tCounts[t.id] || 0) > 0 || TRACK_FILTER === t.id; }) : tracks;
      visTrackCount = barTracks.length;
      barTracks.forEach(function (t) {
        var cnt = tCounts[t.id] || 0;
        var on = TRACK_FILTER === t.id;
        btns.push('<button type="button" class="scope-btn' + (on ? ' on' : (cnt > 0 ? ' ok' : '')) + '" aria-pressed="' + (on ? 'true' : 'false') + '" data-track-set="' + esc(t.id) + '" title="' + esc(t.name) + '">' + esc(trackShortLabel(t)) + ' (' + cnt + ')</button>');
      });
      trackBar.innerHTML = btns.join('');
      // 가벼운 화면: 사업이 한 트랙뿐이거나 왼쪽 대시보드가 켜졌으면 «전체·그 트랙·빈 트랙…» 알약은 되풀이라 감춘다
      trackBar.style.display = ((oneTrackSlim && !TRACK_FILTER) || ldSlim || (lean && barTracks.length < 2 && !TRACK_FILTER)) ? 'none' : '';
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
    var grouped = isGrouped();
    renderYearButtonsBar('projYrBar', 'all', trackScopedProjs, grouped ? groupProjects(trackScopedProjs).length : null);

    // 초소형 1줄 KPI 배지 (#kpiBox — 선택된 지역/연도 범위 기준)
    var kpiBox = $('kpiBox');
    if (kpiBox) {
      var kpiScope = trackScopedProjs.filter(function (p) {
        return !YEAR_FILTER || String(num(p.year, 2026)) === YEAR_FILTER;
      });
      // 사업장 단위 묶음: 사업장 수로 세고(진행 중 연도가 하나라도 있으면 «진행중»), 연도별 건 수는 따로 보인다
      var kpiGroups = grouped ? groupProjects(kpiScope) : null;
      var kpiCount = grouped ? kpiGroups.length : kpiScope.length;
      var doneCnt = grouped ? kpiGroups.filter(function (g) { return !g.active; }).length : kpiScope.filter(function (x) { return x.status === 'done'; }).length;
      var activeCnt = kpiCount - doneCnt;
      var unitLbl = grouped ? '곳' : '건';
      var totalComms = kpiScope.reduce(function (s, p) { return s + getProjectComms(p.id).length; }, 0);
      var scopedCands = TRACK_FILTER && ldOn
        ? cands.filter(function (b) { return str(b.suggestedTrackId) === TRACK_FILTER; })
        : cands;
      var stVal = stFilter();
      var allOn = !stVal;
      var doneOn = stVal === 'done';
      var activeOn = stVal === 'active';
      var actTrack = activeTrackObj();
      // 가벼운 화면: 바로 위(또는 왼쪽)에서 이미 «고른 것»으로 보이는 트랙·연도를 KPI 앞에 또 적지 않는다
      var scopeTag = (!isSlim() && (actTrack || YEAR_FILTER))
        ? ('<span class="chip c-blue">' + esc((actTrack ? trackShortLabel(actTrack) : '전체') + (YEAR_FILTER ? (' · ' + YEAR_FILTER + '년') : '')) + '</span>')
        : '';
      kpiBox.innerHTML = scopeTag +
        '<div class="kpi k-blue' + (allOn ? ' k-on' : '') + '" data-act="kpiSt" data-id="" role="button" tabindex="0" aria-pressed="' + (allOn ? 'true' : 'false') + '"><span>' + (isSplit() ? '수행 컨설팅' : (grouped ? '총 사업장' : '총 사업')) + '</span><b>' + kpiCount + unitLbl + '</b></div>' +
        (grouped ? '<div class="kpi" title="같은 사업장의 연도별 건을 모두 센 수 — 사업장 한 줄에 연도 칩으로 묶여 보입니다"><span>연도별 건</span><b>' + kpiScope.length + '건</b></div>' : '') +
        '<div class="kpi k-green' + (doneOn ? ' k-on' : '') + '" data-act="kpiSt" data-id="done" role="button" tabindex="0" aria-pressed="' + (doneOn ? 'true' : 'false') + '"><span>완료</span><b>' + doneCnt + unitLbl + '</b></div>' +
        '<div class="kpi k-amber' + (activeOn ? ' k-on' : '') + '" data-act="kpiSt" data-id="active" role="button" tabindex="0" aria-pressed="' + (activeOn ? 'true' : 'false') + '"><span>진행중</span><b>' + activeCnt + unitLbl + '</b></div>' +
        (lean ? '' : '<div class="kpi k-blue"><span>수집자료</span><b>' + totalComms + '건</b></div>') +
        roundKpiHtml(kpiScope) +
        (function () {
          var au = trackAuditMap();
          if (!au) return '';
          var n = Object.keys(au).filter(function (k) { return au[k].changed; }).length;
          return n ? ('<div class="kpi k-amber" data-act="trackAudit" role="button" tabindex="0" title="근거로 다시 본 사업 갈래가 저장된 갈래와 다른 건 — 눌러서 확인하고 바꿉니다(사람이 누를 때만 저장)"><span>🔎 분류 점검</span><b>' + n + '건</b></div>') : '';
        })() +
        (function () {
          var erpUnl = kpiScope.filter(function (p) { var ea = audit.byPid[p.id]; return ea && ea.state === 'unlinked'; }).length;
          return (erpUnl || ERP_FILTER) ? ('<div class="kpi k-amber' + (ERP_FILTER === 'unlinked' ? ' k-on' : '') + '" data-act="kpiErp" role="button" tabindex="0" aria-pressed="' + (ERP_FILTER === 'unlinked' ? 'true' : 'false') + '" title="ERP 사건번호가 비어 있는 줄만 봅니다 — 이유는 표의 ERP 번호 칸에 있습니다"><span>ERP 미연결</span><b>' + erpUnl + '건</b></div>') : '';
        })() +
        // 미등록 후보는 «📥 미등록 후보» 탭 이름표에 이미 건수가 있다 — 되풀이하지 않는다
        ((!lean && !isSlim() && scopedCands.length > 0) ? '<div class="kpi k-amber" data-act="goInbox" role="button" tabindex="0" title="미등록 후보 탭으로 이동"><span>미등록후보</span><b>' + scopedCands.length + '곳</b></div>' : '');
      kpiBox.querySelectorAll('[data-act="kpiSt"]').forEach(function (k) {
        k.onclick = function () {
          setStFilter(k.getAttribute('data-id') || '');
          renderProjectsPane();
        };
        k.onkeydown = function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); k.click(); }
        };
      });
      kpiBox.querySelectorAll('[data-act="trackAudit"]').forEach(function (k) {
        k.onclick = openTrackAuditModal;
        k.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); k.click(); } };
      });
      kpiBox.querySelectorAll('[data-act="kpiErp"]').forEach(function (k) {
        k.onclick = function () { ERP_FILTER = ERP_FILTER === 'unlinked' ? '' : 'unlinked'; SHOW_ALL_ROWS = false; renderProjectsPane(); };
        k.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); k.click(); } };
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
    if (lean && $('projMgr')) $('projMgr').style.display = Object.keys(mgrs).length > 1 ? '' : 'none'; // 담당자가 한 명뿐이면 거르개가 필요 없다

    var box = $('projectsBox');
    if (!box) return;
    var filtered = grouped ? getFilteredGroups() : getFilteredProjects();
    var allByCo = Object.create(null); // 사업장별 «모든 연도» 건 — 연도 칩은 거름과 상관없이 전 이력을 보인다
    if (grouped) groupProjects(allProjs).forEach(function (g) { allByCo[g.key] = g; });
    if (!filtered.length) {
      box.innerHTML = '<div class="empty">' + (ERP_FILTER ? 'ERP 사건번호가 비어 있는 사업장이 없습니다. ' : ('조건에 맞는 ' + esc(cat.name) + ' 사업장이 없습니다. ')) +
        (cands.length ? ('<b>📥 미등록 후보(' + cands.length + '곳)</b>에서 1클릭 등록하거나 ') : '') +
        '<b>[+ 새 사업 등록]</b>을 눌러 추가하세요.</div>';
      return;
    }

    var rowCap = SHOW_ALL_ROWS ? filtered.length : 120;
    var shown = filtered.slice(0, rowCap);
    var selKeyOf = function (x) { return grouped ? ('g:' + x.key) : ('p:' + x.id); };
    var unitTxt = grouped ? '곳' : '건';
    var selPids = shown.filter(function (p) { return SEL[selKeyOf(p)]; });
    var allProjChecked = shown.length > 0 && selPids.length === shown.length;
    var bulkHtml = '<div class="bulk' + (selPids.length ? ' on' : '') + '" id="projBulkBar">' +
      '<b id="projBulkCount">' + selPids.length + unitTxt + ' 선택</b>' +
      '<button type="button" class="sm ok" id="bulkDoneProjBtn">✅ 완료 처리</button>' +
      (isSplit() ? '<button type="button" class="sm" id="bulkGuideProjBtn" title="고른 건을 안내·기타 목록으로 옮깁니다">📨 안내·기타로 이동</button>' : '') +
      '<button type="button" class="sm danger" id="bulkDelProjBtn">🗑 선택 보관삭제</button>' +
      '<button type="button" class="sm" id="bulkClearProjBtn">해제</button>' +
      '</div>';

    var isInsp = (APP_KEY === 'laboraudit');
    /* ══ 표 줄 — 12개 앱 공통 «독립 열» (대표 지시 2026-11-28 상공회의소 「사업장과 연도, ERP 번호」 · 6차산업 「연도/사업장명/진행상태 열 분리」)
       ☐ · № · 연도 · 사업장명 · [세부 트랙] · ERP 번호 · 진행상태 · [회차] · [감독 기간·지적사항] · 담당 · 6단계 · 자료·점검 · [요약 메모] · 열기
       · 세부 트랙 열은 사업이 한 트랙뿐이거나 왼쪽 대시보드에서 한 트랙을 고른 동안 «같은 값 되풀이»라 열째 뺀다.
       · ERP 번호 칸은 비어 있으면 «미연결 · 사유»(PuConsultIntake.auditErpLinks)와, 후보가 정확히 하나일 때만 [연결] 단추.
       · 폰 카드 표식(split-row·pc-only·pm-st·pm-tr·data-pm-act)은 css/pu-consult-phone.css 와 짝이다. */
    var showTrackCol = !hideTrackChip;
    // 사업장 한 줄(묶음 전용): «연도» 칸에 연도 칩(누르면 그 해 건), 대표 연도 건의 번호·단계·담당·체크율, 자료 수는 보이는 연도를 더한다
    function groupRowHtml(g, i) {
      var p = g.head;
      var ckKey = 'g:' + g.key;
      var allRows = (allByCo[g.key] && allByCo[g.key].rows) || g.rows;
      var inView = Object.create(null);
      g.rows.forEach(function (r) { inView[r.id] = 1; });
      var clsList = ['split-row'];
      if (g.rows.some(function (r) { return r.id === CUR_PID; })) clsList.push('cur');
      if (!g.active) clsList.push('perf-direct');
      var commCnt = g.rows.reduce(function (sAcc, r) { return sAcc + getProjectComms(r.id).length; }, 0);
      var sum = hwpx ? hwpx.buildSummary(APP_KEY, p, getCheckDoc(p.id), []) : { overallPct: 0 };
      var hasCk = !!(D.checks && D.checks[p.id]);
      var ckChip = (lean && !hasCk) ? '' : (' <span class="chip">' + sum.overallPct + '%</span>');
      var stChip = g.active ? '<span class="chip c-amber pm-st">진행중</span>' : '<span class="chip c-green pm-st">완료</span>';
      var trObj = tracks.find(function (t) { return t.id === p.trackId; });
      var trLbl = trObj ? trackShortLabel(trObj) : (p.trackName || cat.shortName);
      var MAX_CHIPS = 4; // 칸 한 줄을 넘지 않게 — 나머지 연도는 «+N» 칩(title 에 연도 목록)
      var yrChips = allRows.slice(0, MAX_CHIPS).map(function (r) {
        var tip = String(r.year || 2026) + '년 · ' + (r.trackName || cat.shortName) + ' · ' + (r.status === 'done' ? '완료' : '진행중') + (r.caseNo ? (' · ' + r.caseNo) : '') + ' — 눌러서 이 연도 건 열기';
        return '<button type="button" class="yrchip' + (r.id === p.id ? ' on' : '') + (r.status === 'done' ? ' done' : '') + (inView[r.id] ? '' : ' dim') + '" data-pick-yr="' + esc(r.id) + '" title="' + esc(tip) + '">' + esc(String(r.year || 2026)) + '</button>';
      }).join('');
      var moreChip = allRows.length > MAX_CHIPS ? ('<span class="chip" title="' + esc(allRows.slice(MAX_CHIPS).map(function (r) { return r.year || 2026; }).join(', ') + '년') + '">+' + (allRows.length - MAX_CHIPS) + '</span>') : '';
      var yrsTxt = allRows.map(function (r) { return r.year || 2026; }).join(' · ');
      var memoTxt = memoShown(p);
      var memoHtml = (lean ? (sourceChipsHtml(p) + ' ' + esc(memoTxt ? noteWithoutTag({ summaryNote: memoTxt }) : '')) : esc(memoTxt || '-')) + (allRows.length > 1 ? (' <span class="hint">· 연도 ' + allRows.length + '건</span>') : '');
      return '<tr data-row="' + esc(p.id) + '" class="' + clsList.join(' ') + '">' +
        '<td class="c"><input type="checkbox" data-ck="' + esc(ckKey) + '" data-list="proj"' + (SEL[ckKey] ? ' checked' : '') + ' aria-label="' + esc(p.companyName) + ' 선택"></td>' +
        '<td class="n">' + (i + 1) + '</td>' +
        '<td class="yr g" title="' + esc(yrsTxt + '년') + '"><span class="gco-yrs">' + yrChips + moreChip + '</span></td>' +
        '<td class="ti" title="' + esc(p.companyName) + '">' + esc(p.companyName) + '</td>' +
        (showTrackCol ? '<td data-k="badge" title="' + esc(p.trackName || trLbl) + '"><span class="chip c-blue pm-tr">' + esc(trLbl) + '</span></td>' : '') +
        '<td data-k="erp">' + erpCellHtml(p, audit) + '</td>' +
        '<td data-k="st">' + stChip + '</td>' +
        (showRounds ? '<td data-k="rd">' + roundChipsHtml(p) + '</td>' : '') +
        '<td data-k="pc-only" title="' + esc(p.consultantName || '-') + '">' + esc(p.consultantName || '-') + '</td>' +
        '<td data-k="pc-only" title="6단계 진행현황 (' + esc(String(p.year || 2026)) + '년 건)">' + stepDotsHtml(p.stage, p.status) + '</td>' +
        '<td data-k="pc-only" title="수집자료 ' + commCnt + '건 · 체크 준비도 ' + sum.overallPct + '%"><span class="chip c-blue">📧 ' + commCnt + '</span>' + ckChip + '</td>' +
        '<td class="wide" title="' + esc(memoTxt || '-') + '">' + memoHtml + '</td>' +
        '<td data-k="act"><button type="button" class="sm pri" data-pick="' + esc(p.id) + '" data-pm-act="1">진행·체크</button> <button type="button" class="sm" data-open-report="' + esc(p.id) + '">📄 보고서</button></td>' +
      '</tr>';
    }
    var trs = shown.map(function (p, i) {
      if (grouped) return groupRowHtml(p, i);
      var ckKey = 'p:' + p.id;
      var clsList = ['split-row'];
      if (p.id === CUR_PID) clsList.push('cur');
      if (p.status === 'done') clsList.push('perf-direct');
      var trAttr = ' class="' + clsList.join(' ') + '"';
      var commCnt = getProjectComms(p.id).length;
      var sum = hwpx ? hwpx.buildSummary(APP_KEY, p, getCheckDoc(p.id), []) : { overallPct: 0 };
      var stChip = p.status === 'done' ? '<span class="chip c-green pm-st">완료</span>' : '<span class="chip c-amber pm-st">진행중</span>';
      var trObj = tracks.find(function (t) { return t.id === p.trackId; });
      var trLbl = trObj ? trackShortLabel(trObj) : (p.trackName || cat.shortName);
      var hasCk = !!(D.checks && D.checks[p.id]);
      var ckChip = (lean && !hasCk) ? '' : (' <span class="chip">' + sum.overallPct + '%</span>'); // 점검을 안 한 건에 0% 를 찍지 않는다
      var memoTxt = memoShown(p);
      var memoHtml = lean ? (sourceChipsHtml(p) + ' ' + esc(memoTxt ? noteWithoutTag({ summaryNote: memoTxt }) : '')) : esc(memoTxt || '-');
      var yr = String(p.year || 2026);
      var cells =
        '<td class="c"><input type="checkbox" data-ck="' + esc(ckKey) + '" data-list="proj"' + (SEL[ckKey] ? ' checked' : '') + ' aria-label="' + esc(p.companyName) + ' 선택"></td>' +
        '<td class="n">' + (i + 1) + '</td>' +
        '<td class="yr" title="' + esc(yr) + '년">' + esc(yr) + '</td>' +
        '<td class="ti" title="' + esc(p.companyName) + '">' + esc(p.companyName) + '</td>' +
        (showTrackCol ? '<td data-k="badge" title="' + esc(p.trackName || trLbl) + '"><span class="chip c-blue pm-tr">' + esc(trLbl) + '</span></td>' : '') +
        '<td data-k="erp">' + erpCellHtml(p, audit) + '</td>';
      if (isInsp) {
        // 감독 결과가 진행상태 칩과 같은 말(진행중·완료)이면 두 번 적지 않는다
        var stLbl = p.status === 'done' ? '완료' : '진행중';
        var resChip = (p.inspResult && str(p.inspResult) !== stLbl) ? (' <span class="chip ' + (p.inspResult.indexOf('완료') >= 0 || p.inspResult.indexOf('없음') >= 0 ? 'c-green' : 'c-amber') + '">' + esc(p.inspResult) + '</span>') : '';
        var periodHtml = p.inspPeriod ? esc(p.inspPeriod) : '<span class="hint">기간 미입력</span>';
        var officeHtml = p.inspOffice ? (' <span class="hint">· ' + esc(p.inspOffice) + '</span>') : '';
        var issuesTxt = p.inspIssues || p.summaryNote || '-';
        var dueHtml = p.inspDue ? (' <span class="hint">· 기한 ' + esc(p.inspDue) + '</span>') : '';
        var issuesTitle = p.inspDue ? (issuesTxt + ' (시정기한: ' + p.inspDue + ')') : issuesTxt;
        cells +=
          '<td data-k="st">' + stChip + resChip + '</td>' +
          '<td data-k="pc-only" title="' + esc([p.inspPeriod, p.inspOffice].filter(Boolean).join(' · ')) + '">' + periodHtml + officeHtml + '</td>' +
          '<td class="wide" title="' + esc(issuesTitle) + '">' + esc(issuesTxt) + dueHtml + '</td>' +
          '<td data-k="pc-only" title="6단계 진행현황">' + stepDotsHtml(p.stage, p.status) + '</td>' +
          '<td data-k="pc-only" title="수집자료 ' + commCnt + '건 · 체크 준비도 ' + sum.overallPct + '%"><span class="chip c-blue">📧 ' + commCnt + '</span>' + ckChip + '</td>';
      } else {
        cells +=
          '<td data-k="st">' + stChip + '</td>' +
          (showRounds ? '<td data-k="rd">' + roundChipsHtml(p) + '</td>' : '') +
          '<td data-k="pc-only" title="' + esc(p.consultantName || '-') + '">' + esc(p.consultantName || '-') + '</td>' +
          '<td data-k="pc-only" title="6단계 진행현황">' + stepDotsHtml(p.stage, p.status) + '</td>' +
          '<td data-k="pc-only" title="수집자료 ' + commCnt + '건 · 체크 준비도 ' + sum.overallPct + '%"><span class="chip c-blue">📧 ' + commCnt + '</span>' + ckChip + '</td>' +
          '<td class="wide" title="' + esc(memoTxt || '-') + '">' + memoHtml + '</td>';
      }
      return '<tr data-row="' + esc(p.id) + '"' + trAttr + '>' + cells +
        '<td data-k="act"><button type="button" class="sm pri" data-pick="' + esc(p.id) + '" data-pm-act="1">진행·체크</button> <button type="button" class="sm" data-open-report="' + esc(p.id) + '">📄 보고서</button></td>' +
      '</tr>';
    }).join('');

    var moreHtml = filtered.length > shown.length
      ? ('<div class="bar"><span class="hint">총 ' + filtered.length + unitTxt + ' 중 ' + shown.length + unitTxt + ' 표시</span><button type="button" class="sm pri" id="showAllProjBtn">전체 ' + filtered.length + unitTxt + ' 모두 보기 (+' + (filtered.length - shown.length) + ')</button></div>')
      : '';

    var diffMark = (isInsp && DIFF_HIGHLIGHT) ? (' ' + diffBadge('개편')) : '';
    var headCols = '<th class="yr' + (grouped ? ' g' : '') + '">연도</th><th>사업장명</th>' +
      (showTrackCol ? '<th data-k="badge">' + esc(cat.regionLabel || '세부 트랙') + '</th>' : '') +
      '<th data-k="erp">ERP 번호</th>' +
      (isInsp
        ? ('<th data-k="st">진행 · 감독 결과' + diffMark + '</th><th>감독 기간 · 관할지청' + diffMark + '</th><th class="wide">지적 · 시정지시 사항' + diffMark + '</th><th>6단계 진행현황</th><th>자료 · 점검</th>')
        : ('<th data-k="st">진행상태</th>' + (showRounds ? '<th data-k="rd">회차</th>' : '') + '<th>담당 노무사</th><th>6단계 진행현황</th><th>자료 · 점검</th><th class="wide">요약 메모</th>')) +
      '<th data-k="act">열기</th>';
    box.innerHTML = bulkHtml + '<div class="scroll' + (isInsp ? diffCls(true) : '') + '"><table class="t" data-name="cases">' +
      '<thead><tr><th class="c"><input type="checkbox" data-ckall="proj"' + (allProjChecked ? ' checked' : '') + ' aria-label="전체 선택"></th><th class="n">№</th>' + headCols + '</tr></thead>' +
      '<tbody>' + trs + '</tbody></table></div>' + moreHtml;

    refreshProjBulkUi();
    if ($('showAllProjBtn')) $('showAllProjBtn').onclick = function () { SHOW_ALL_ROWS = true; renderProjectsPane(); };

    box.querySelectorAll('[data-pick-yr]').forEach(function (b) {
      b.onclick = function (e) { e.stopPropagation(); CUR_PID = b.getAttribute('data-pick-yr'); switchTab('detail'); };
    });
    box.querySelectorAll('[data-erp-link]').forEach(function (b) {
      b.onclick = function (e) { e.stopPropagation(); connectErpNo(b.getAttribute('data-erp-link'), b.getAttribute('data-erp-no')); };
    });
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
      bulkUpdateProjectsDone(selectedProjects());
    };
    if ($('bulkDelProjBtn')) $('bulkDelProjBtn').onclick = function () {
      bulkDeleteProjects(selectedProjects());
    };
    if ($('bulkGuideProjBtn')) $('bulkGuideProjBtn').onclick = function () {
      var curSel = selectedProjects();
      if (!curSel.length) { toast('먼저 줄을 골라 주세요.'); return; }
      bulkSaveGuide(curSel, function () { return { kind: 'guide' }; }, '구분 «안내·기타»');
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
    if (cntEl) cntEl.textContent = checkedCount + (isGrouped() ? '곳' : '건') + ' 선택';
    var hdr = box.querySelector('input[type="checkbox"][data-ckall="proj"]');
    if (hdr) {
      hdr.checked = list.length > 0 && checkedCount === list.length;
      hdr.indeterminate = checkedCount > 0 && checkedCount < list.length;
    }
  }

  /* ══ 탭: 📨 안내·기타 — 신청 안내 발송 · 회신(피드백) 기록 (kindSplit 앱 · 대표 지시 2026-11-28) ═════
   * 기술보호컨설팅 신청 안내를 보낸 기업의 «발송일 → 회신(신청 의사·타 컨설팅·거절·무응답…)» 을 한 줄로 남긴다.
   * 저장 칸은 사업(project) 레코드의 kind · guideSentAt · guideRespondedAt · guideResponse · guideNote 다. */
  function getFilteredGuides() {
    var q = str($('gQ') && $('gQ').value).toLowerCase();
    return laneProjects('guide').filter(function (p) {
      if (YEAR_FILTER && String(num(p.year, 2026)) !== YEAR_FILTER) return false;
      if (GUIDE_STATE_FILTER && guideState(p) !== GUIDE_STATE_FILTER) return false;
      if (q) {
        var hay = [p.year, p.companyName, p.caseNo, p.guideNote, noteWithoutTag(p)].join(' ').toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
  }

  function refreshGuideBulkUi() {
    var box = $('guideBox');
    if (!box) return;
    var list = box.querySelectorAll('input[type="checkbox"][data-list="guide"]');
    var checkedCount = 0;
    list.forEach(function (cb) { if (cb.checked) checkedCount++; });
    var bar = $('guideBulkBar');
    var cntEl = $('guideBulkCount');
    if (bar) bar.classList.toggle('on', checkedCount > 0);
    if (cntEl) cntEl.textContent = checkedCount + '건 선택';
    var hdr = box.querySelector('input[type="checkbox"][data-ckall="guide"]');
    if (hdr) {
      hdr.checked = list.length > 0 && checkedCount === list.length;
      hdr.indeterminate = checkedCount > 0 && checkedCount < list.length;
    }
  }

  function renderGuidePane() {
    var all = laneProjects('guide');
    renderYearButtonsBar('guideYrBar', 'all', all);
    var q = str($('gQ') && $('gQ').value);
    if ($('gResetBtn')) $('gResetBtn').style.display = (YEAR_FILTER || q || GUIDE_STATE_FILTER) ? '' : 'none';

    var scope = all.filter(function (p) { return !YEAR_FILTER || String(num(p.year, 2026)) === YEAR_FILTER; });
    var cnt = Object.create(null);
    scope.forEach(function (p) { var s = guideState(p); cnt[s] = (cnt[s] || 0) + 1; });
    var kpiBox = $('guideKpiBox');
    if (kpiBox) {
      var allOn = !GUIDE_STATE_FILTER;
      var kp = '<div class="kpi k-blue' + (allOn ? ' k-on' : '') + '" data-act="gst" data-gst="" role="button" tabindex="0" aria-pressed="' + (allOn ? 'true' : 'false') + '"><span>안내·기타</span><b>' + scope.length + '건</b></div>';
      GUIDE_STATE_ORDER.forEach(function (sid) {
        var on = GUIDE_STATE_FILTER === sid;
        if (!cnt[sid] && !on) return;
        kp += '<div class="kpi ' + GUIDE_STATE[sid].kpi + (on ? ' k-on' : '') + '" data-act="gst" data-gst="' + sid + '" role="button" tabindex="0" aria-pressed="' + (on ? 'true' : 'false') + '"><span>' + esc(GUIDE_STATE[sid].label) + '</span><b>' + (cnt[sid] || 0) + '건</b></div>';
      });
      kpiBox.innerHTML = kp;
      kpiBox.querySelectorAll('[data-gst]').forEach(function (k) {
        k.onclick = function () { GUIDE_STATE_FILTER = k.getAttribute('data-gst') || ''; renderGuidePane(); };
        k.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); k.click(); } };
      });
    }

    var box = $('guideBox');
    if (!box) return;
    var list = getFilteredGuides();
    if (!list.length) {
      box.innerHTML = '<div class="empty">' + (all.length
        ? '조건에 맞는 안내·기타 기록이 없습니다.'
        : '아직 안내·기타로 나뉜 건이 없습니다. <b>[+ 안내 기록 추가]</b>로 신청 안내를 보낸 기업을 남기세요. 📥 미등록 후보에서 «안내로 등록»해도 여기에 모입니다.') + '</div>';
      return;
    }

    var cap = 300;
    var shown = list.slice(0, cap);
    var selCnt = shown.filter(function (p) { return SEL['g:' + p.id]; }).length;
    var respOpts = '<option value="">회신 상태 선택…</option>' +
      GUIDE_RESP_IDS.map(function (id) { return '<option value="' + id + '">' + esc(GUIDE_STATE[id].label) + '</option>'; }).join('') +
      '<option value="__clear">회신 전으로 되돌리기</option>';
    var kindOpts = '<option value="">구분 변경…</option><option value="guide">안내</option><option value="other">기타 자료</option><option value="perf">컨설팅 수행으로</option>';
    var bulkHtml = '<div class="bulk' + (selCnt ? ' on' : '') + '" id="guideBulkBar">' +
      '<b id="guideBulkCount">' + selCnt + '건 선택</b>' +
      '<button type="button" class="sm ok" id="gBulkSentBtn" title="발송일이 비어 있는 안내 건에 오늘 날짜를 기록합니다">📤 발송일 오늘로</button>' +
      '<select id="gBulkResp" aria-label="회신 상태 일괄 선택">' + respOpts + '</select><button type="button" class="sm" id="gBulkRespBtn">적용</button>' +
      '<select id="gBulkKind" aria-label="구분 일괄 변경">' + kindOpts + '</select><button type="button" class="sm" id="gBulkKindBtn">적용</button>' +
      '<button type="button" class="sm" id="gBulkClearBtn">해제</button>' +
      '</div>';

    var allChecked = shown.length > 0 && selCnt === shown.length;
    var trs = shown.map(function (p, i) {
      var st = guideState(p);
      var meta = GUIDE_STATE[st];
      var isEtc = st === 'etc';
      var sent = str(p.guideSentAt);
      var dd = (st === 'wait' && sent) ? daysSince(sent) : null;
      var sentCell = (!isEtc && sent) ? (esc(sent) + (dd != null && dd >= 0 ? ' <span class="hint">D+' + dd + '</span>' : '')) : '';
      var respAt = str(p.guideRespondedAt);
      var memo = str(p.guideNote) || noteWithoutTag(p);
      var commCnt = getProjectComms(p.id).length;
      var ckKey = 'g:' + p.id;
      return '<tr data-row="' + esc(p.id) + '"' + (p.id === CUR_PID ? ' class="cur"' : '') + '>' +
        '<td class="c"><input type="checkbox" data-ck="' + esc(ckKey) + '" data-list="guide"' + (SEL[ckKey] ? ' checked' : '') + ' aria-label="' + esc(p.companyName) + ' 선택"></td>' +
        '<td class="n">' + (i + 1) + '</td>' +
        '<td class="ti" title="' + esc(p.companyName) + '"><span class="chip">' + esc(String(p.year || 2026)) + '</span> ' + esc(p.companyName) + '</td>' +
        '<td data-k="badge" title="' + esc(meta.label + (respAt ? ' · 회신 ' + respAt : '')) + '"><span class="chip ' + meta.cls + '">' + esc(meta.label) + '</span></td>' +
        '<td title="구분">' + (isEtc ? '<span class="chip">기타</span>' : '<span class="chip c-blue">안내</span>') + '</td>' +
        '<td title="안내 발송일">' + sentCell + '</td>' +
        '<td title="회신일">' + esc(respAt) + '</td>' +
        '<td class="wide" title="' + esc(memo) + '">' + esc(memo) + '</td>' +
        '<td title="수집 메일·카톡 ' + commCnt + '건">' + (commCnt ? '<span class="chip c-blue">📧 ' + commCnt + '</span>' : '') + '</td>' +
        '<td data-k="act"><button type="button" class="sm pri" data-g-edit="' + esc(p.id) + '">기록</button> <button type="button" class="sm" data-g-perf="' + esc(p.id) + '" title="신청이 확정돼 컨설팅을 수행하는 건이면 📂 컨설팅 수행 목록으로 옮깁니다">수행으로</button></td>' +
      '</tr>';
    }).join('');

    box.innerHTML = bulkHtml + '<div class="scroll"><table class="t" data-name="guide">' +
      '<thead><tr><th class="c"><input type="checkbox" data-ckall="guide"' + (allChecked ? ' checked' : '') + ' aria-label="전체 선택"></th><th class="n">№</th>' +
      '<th>사업장 · 연도</th><th data-k="badge">회신 상태</th><th>구분</th><th>안내 발송</th><th>회신일</th><th class="wide">회신 내용 · 메모</th><th>자료</th><th data-k="act">작업</th></tr></thead>' +
      '<tbody>' + trs + '</tbody></table></div>' +
      (list.length > shown.length ? '<div class="bar"><span class="hint">총 ' + list.length + '건 중 ' + shown.length + '건 표시 — 연도·상태로 좁혀 보세요.</span></div>' : '');

    refreshGuideBulkUi();
    box.querySelectorAll('[data-g-edit]').forEach(function (b) {
      b.onclick = function (e) { e.stopPropagation(); openGuideModal(projectById(b.getAttribute('data-g-edit'))); };
    });
    box.querySelectorAll('[data-g-perf]').forEach(function (b) {
      b.onclick = function (e) { e.stopPropagation(); setProjectKind(b.getAttribute('data-g-perf'), 'perf'); };
    });
    box.querySelectorAll('tr[data-row]').forEach(function (tr) {
      tr.onclick = function (e) {
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON' || e.target.tagName === 'A' || e.target.tagName === 'SELECT')) return;
        CUR_PID = tr.getAttribute('data-row');
        box.querySelectorAll('tr[data-row]').forEach(function (r) { r.classList.toggle('cur', r === tr); });
      };
    });
    function picked() { return getFilteredGuides().filter(function (p) { return SEL['g:' + p.id]; }); }
    if ($('gBulkSentBtn')) $('gBulkSentBtn').onclick = function () {
      var all2 = picked();
      var targets = all2.filter(function (p) { return projectKind(p) === 'guide' && !str(p.guideSentAt); });
      if (!all2.length) { toast('먼저 줄을 골라 주세요.'); return; }
      if (!targets.length) { toast('고른 건에는 발송일을 새로 기록할 곳이 없습니다(이미 기록됐거나 기타 자료).'); return; }
      bulkSaveGuide(targets, function () { return { guideSentAt: todayYmd() }; }, '안내 발송일 ' + todayYmd());
    };
    if ($('gBulkRespBtn')) $('gBulkRespBtn').onclick = function () {
      var v = str($('gBulkResp') && $('gBulkResp').value);
      var targets = picked().filter(function (p) { return projectKind(p) === 'guide'; });
      if (!v) { toast('적용할 회신 상태를 고르세요.'); return; }
      if (!targets.length) { toast('먼저 안내 건을 골라 주세요(기타 자료에는 회신 상태를 적지 않습니다).'); return; }
      var clear = v === '__clear';
      bulkSaveGuide(targets, function () { return clear ? { guideResponse: '', guideRespondedAt: '' } : { guideResponse: v }; }, '회신 상태 «' + (clear ? '회신 전' : GUIDE_STATE[v].label) + '»');
    };
    if ($('gBulkKindBtn')) $('gBulkKindBtn').onclick = function () {
      var v = str($('gBulkKind') && $('gBulkKind').value);
      var targets = picked();
      if (!v) { toast('바꿀 구분을 고르세요.'); return; }
      if (!targets.length) { toast('먼저 줄을 골라 주세요.'); return; }
      bulkSaveGuide(targets, function () { return { kind: v }; }, '구분 «' + (v === 'perf' ? '컨설팅 수행' : (v === 'other' ? '기타 자료' : '안내')) + '»');
    };
    if ($('gBulkClearBtn')) $('gBulkClearBtn').onclick = function () {
      SEL = Object.create(null);
      box.querySelectorAll('input[type="checkbox"][data-list="guide"]').forEach(function (cb) { cb.checked = false; });
      refreshGuideBulkUi();
    };
  }

  /* 사업 레코드에 «바꾼 칸만» 저장 — 실패하면 false(안내는 호출한 쪽이 한다) */
  async function saveProjectPatch(pid, patch) {
    var proj = projectById(pid);
    if (!proj) { toast('대상을 찾지 못했습니다. 새로고침 후 다시 시도하세요.'); return false; }
    try {
      D.projects[pid] = await saveRecord('projects/' + pid, pid, Object.assign({}, proj, patch), 'Project', { patch: patch });
      return true;
    } catch (e) {
      toast('저장 오류: ' + (e && e.message || e));
      return false;
    }
  }

  async function setProjectKind(pid, kind) {
    var proj = projectById(pid);
    if (!proj) return;
    if (await saveProjectPatch(pid, { kind: kind })) {
      if (kind === 'perf') CUR_PID = pid;
      draw();
      toast(kind === 'perf' ? '📂 컨설팅 수행 목록으로 옮겼습니다.' : '📨 안내·기타 목록으로 옮겼습니다.');
    }
  }

  async function moveProjectToGuide(pid) {
    var proj = projectById(pid);
    if (!proj) return;
    if (!(await saveProjectPatch(pid, { kind: 'guide' }))) return;
    CUR_PID = '';
    rebuildDiscoverAndRag();
    switchTab('projects');
    toast('📨 안내·기타 목록으로 옮겼습니다. (되돌리려면 안내·기타 탭의 «수행으로»)');
  }

  /* 고른 줄 일괄 저장 — 건수를 묻고, 한 건이라도 실패하면 거기서 멈춘다 */
  async function bulkSaveGuide(list, patchFn, label) {
    if (!list.length) return;
    if (!global.confirm(list.length + '건에 ' + label + '을(를) 기록합니다. 계속할까요?')) return;
    var ok = 0;
    for (var i = 0; i < list.length; i++) {
      if (!(await saveProjectPatch(list[i].id, patchFn(list[i])))) break;
      ok++;
    }
    SEL = Object.create(null);
    draw();
    toast(ok + '건 기록했습니다.' + (ok < list.length ? ' ' + (list.length - ok) + '건은 저장하지 못했습니다.' : ''));
  }

  function openGuideModal(proj) {
    var m = $('modal'), box = $('mbox');
    if (!m || !box) return;
    LAST_FOCUS_EL = document.activeElement;
    var isNew = !proj;
    var p = proj || { year: num(YEAR_FILTER, CUR_YEAR) || CUR_YEAR };
    var kindNow = projectKind(p) === 'other' ? 'other' : 'guide';
    var respNow = str(p.guideResponse);
    var respOpts = '<option value=""' + (!respNow ? ' selected' : '') + '>회신 전 (아직 답이 없음)</option>' +
      GUIDE_RESP_IDS.map(function (id) {
        return '<option value="' + id + '"' + (respNow === id ? ' selected' : '') + '>' + esc(GUIDE_STATE[id].label) + '</option>';
      }).join('');
    box.innerHTML =
      '<div class="mhd"><b id="mhdTitle">' + (isNew ? '+ 안내 기록 추가' : '📨 안내·회신 기록 · ' + esc(p.companyName)) + '</b><span class="sp"></span><button type="button" class="sm" id="mCloseBtn">닫기</button></div>' +
      '<div class="mbd">' +
        '<div class="fr"><label for="gmCo">기업명</label><div class="fv">' + (isNew
          ? '<input type="text" id="gmCo" placeholder="예: (주)푸른샘식품">'
          : '<input type="text" id="gmCo" value="' + esc(p.companyName) + '" readonly>') + '</div></div>' +
        '<div class="fr"><label for="gmYear">안내 연도</label><div class="fv"><input type="number" id="gmYear" value="' + esc(String(num(p.year, CUR_YEAR))) + '"></div></div>' +
        '<div class="fr"><label for="gmKind">구분</label><div class="fv"><select id="gmKind">' +
          '<option value="guide"' + (kindNow === 'guide' ? ' selected' : '') + '>안내 (신청 안내를 보낸 기업)</option>' +
          '<option value="other"' + (kindNow === 'other' ? ' selected' : '') + '>기타 자료 (안내와 무관한 자료)</option>' +
        '</select></div></div>' +
        '<div class="fr"><label for="gmSent">안내 발송일</label><div class="fv"><input type="date" id="gmSent" value="' + esc(str(p.guideSentAt)) + '"></div></div>' +
        '<div class="fr"><label for="gmResp">회신 상태</label><div class="fv"><select id="gmResp">' + respOpts + '</select></div></div>' +
        '<div class="fr"><label for="gmRespAt">회신일</label><div class="fv"><input type="date" id="gmRespAt" value="' + esc(str(p.guideRespondedAt)) + '"></div></div>' +
        '<div class="fr"><label for="gmNote">회신 내용 · 메모</label><div class="fv"><input type="text" id="gmNote" maxlength="500" value="' + esc(str(p.guideNote)) + '" placeholder="예: 담당자 통화 — 올해는 어렵다고 함 (연락처·주민번호는 적지 않습니다)"></div></div>' +
      '</div>' +
      '<div class="mft"><button type="button" class="sm" id="mCancelBtn">취소</button><button type="button" class="pri" id="gmSaveBtn">' + (isNew ? '기록 추가' : '저장') + '</button></div>';
    m.style.display = 'flex';
    if ($('mCloseBtn')) $('mCloseBtn').onclick = closeModal;
    if ($('mCancelBtn')) $('mCancelBtn').onclick = closeModal;
    if ($(isNew ? 'gmCo' : 'gmResp')) $(isNew ? 'gmCo' : 'gmResp').focus();
    if ($('gmSaveBtn')) $('gmSaveBtn').onclick = async function () {
      var kind = $('gmKind').value === 'other' ? 'other' : 'guide';
      var yr = num($('gmYear').value, 0);
      if (yr < 2000 || yr > 2100) { toast('안내 연도를 확인하세요.'); return; }
      var sent = str($('gmSent').value);
      var resp = str($('gmResp').value);
      var respAt = resp ? str($('gmRespAt').value) : '';
      if (sent && respAt && respAt < sent) { toast('회신일이 안내 발송일보다 빠릅니다. 날짜를 확인하세요.'); return; }
      var note = cleanText($('gmNote').value).slice(0, 500);
      var fields = kind === 'other'
        ? { kind: kind, guideSentAt: '', guideRespondedAt: '', guideResponse: '', guideNote: note }
        : { kind: kind, guideSentAt: sent, guideRespondedAt: respAt, guideResponse: resp, guideNote: note };
      var btn = $('gmSaveBtn');
      if (btn) { btn.disabled = true; btn.textContent = '저장 중…'; }
      try {
        if (isNew) {
          var co = cleanText($('gmCo').value).slice(0, 190);
          if (!co) { toast('기업명을 입력하세요.'); if (btn) { btn.disabled = false; btn.textContent = '기록 추가'; } return; }
          var I = Intake();
          var norm = (I && typeof I.normCorpName === 'function') ? I.normCorpName : function (s) { return str(s).replace(/\s|\(주\)|주식회사/g, ''); };
          var dup = projectsList().find(function (x) { return norm(x.companyName) === norm(co) && num(x.year, 0) === yr; });
          if (dup) {
            toast(yr + '년에 이미 올라 있는 기업입니다(' + (projectKind(dup) === 'perf' ? '컨설팅 수행' : '안내·기타') + '). 기존 줄에서 고쳐 주세요.');
            if (btn) { btn.disabled = false; btn.textContent = '기록 추가'; }
            return;
          }
          var tr0 = getEffectiveTracks()[0] || { id: 'default', name: getAppCat().shortName };
          var pid = 'pr_' + APP_KEY + '_' + Date.now().toString(36);
          var rec = Object.assign({
            id: pid, entityType: 'Project', schemaVersion: 1, contractVersion: 1, revision: 0,
            companyName: co, year: yr, trackId: tr0.id, trackName: tr0.name,
            stage: 'intake', status: 'active',
            consultantName: (ME && ME.name) || '전담 노무사', consultantUid: str(ME && ME.uid),
            summaryNote: ''
          }, fields);
          D.projects[pid] = await saveRecord('projects/' + pid, pid, rec, 'Project');
          CUR_PID = pid;
        } else {
          fields.year = yr;
          D.projects[p.id] = await saveRecord('projects/' + p.id, p.id, Object.assign({}, p, fields), 'Project', { patch: fields });
        }
        closeModal();
        rebuildDiscoverAndRag();
        draw();
        toast(isNew ? '안내 기록을 추가했습니다.' : '안내·회신 기록을 저장했습니다.');
      } catch (e) {
        if (btn) { btn.disabled = false; btn.textContent = isNew ? '기록 추가' : '저장'; }
        toast('저장 실패: ' + (e && e.message || e));
      }
    };
  }

  function downloadGuideCsv() {
    var rows = [['연도', '사업장명', '구분', '안내 발송일', '회신 상태', '회신일', '회신 내용·메모', '수집자료(건)']];
    getFilteredGuides().forEach(function (p) {
      var st = guideState(p);
      rows.push([p.year || '', p.companyName, projectKind(p) === 'other' ? '기타' : '안내',
        str(p.guideSentAt), GUIDE_STATE[st].label, str(p.guideRespondedAt), str(p.guideNote) || noteWithoutTag(p), getProjectComms(p.id).length]);
    });
    downloadRowsCsv(getAppCat().shortName + '_안내·회신기록.csv', rows);
  }

  function csvCellFn() {
    var hwpx = Hwpx();
    return (hwpx && hwpx.safeCsvCell) ? hwpx.safeCsvCell : function (v) {
      var s = String(v == null ? '' : v).replace(/([\r\n]+)([=+\-@\t])/g, "$1'$2");
      if (/^[=+\-@\t\r\n]/.test(s)) s = "'" + s;
      return '"' + s.replace(/"/g, '""') + '"';
    };
  }

  function downloadRowsCsv(fileName, rows) {
    var csvCell = csvCellFn();
    var csv = '﻿' + rows.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    var url = URL.createObjectURL(blob);
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
    toast('CSV 내려받기 완료');
  }

  /* ══ 5. 탭 2: 📥 미등록 후보 (pu-harass drawInboxPane 규격) ══════════════ */
  function getFilteredInboxBundles() {
    var allCands = (D.discover && D.discover.bundles) || [];
    var hasLeft = leftDashOn();
    var trackCands = (hasLeft && TRACK_FILTER)
      ? allCands.filter(function (b) { return str(b.suggestedTrackId) === TRACK_FILTER; })
      : allCands;
    var q = str($('inQ') && $('inQ').value).toLowerCase();
    var list = trackCands.filter(function (b) {
      if (YEAR_FILTER) {
        // 사업장 단위 후보는 여러 연도를 가진다 — 그중 하나라도 맞으면 보인다
        if (Array.isArray(b.yearsList) && b.yearsList.length) { if (b.yearsList.indexOf(Number(YEAR_FILTER)) < 0) return false; }
        else if (String(num(b.year, 2026)) !== YEAR_FILTER) return false;
      }
      if (!q) return true;
      var hay = [b.year, b.companyName, b.suggestedTrackName, b.caseNo].concat(b.sampleSubjects || []).concat(b.reasonsList || []).join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
    return { trackCands: trackCands, list: list, q: q, hasLeft: hasLeft };
  }

  // 후보 한 줄의 연도 표시: 사업장 단위 후보는 «최근 연도 외 N개 연도», 아니면 연도 칩 하나
  function candYearHtml(b) {
    var ys = Array.isArray(b.yearsList) ? b.yearsList : [];
    if (ys.length <= 1) return esc(String(b.year || 2026));
    return candYearChipsHtml(b);
  }
  function candYearChipsHtml(b) {
    var ys = Array.isArray(b.yearsList) ? b.yearsList : [];
    if (ys.length <= 1) return '<span class="chip">' + esc(String(b.year || 2026)) + '</span>';
    return '<span class="chip" title="' + esc(ys.join(', ') + '년의 자료를 한 사업장으로 묶었습니다') + '">' + esc(String(ys[0])) + ' 외 ' + (ys.length - 1) + '개 연도</span>';
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
      var trTag = (hasLeft && actObj && !isSlim()) ? ('<span class="chip c-blue">' + esc(trackShortLabel(actObj)) + '</span>') : '';
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
        '<td class="yr' + ((Array.isArray(b.yearsList) && b.yearsList.length > 1) ? ' g' : '') + '">' + candYearHtml(b) + '</td>' +
        '<td class="ti" title="' + esc(b.companyName) + '">' + coBadge + esc(b.companyName) + '</td>' +
        '<td data-k="badge" title="' + esc(badgeTxt) + '">' + trTag + '<span class="chip c-blue">' + esc(badgeTxt) + '</span></td>' +
        '<td data-k="pc-only" title="' + esc(b.latestDate || '-') + '">' + esc(b.latestDate || '-') + '</td>' +
        '<td class="wide" title="' + esc(sampleTxt) + '">' + esc(sampleTxt) + '</td>' +
        '<td data-k="act"><button type="button" class="sm pri" data-import-cand="' + esc(b.key) + '" data-pm-act="1">' + (isSplit() ? (num(b.erpCount, 0) > 0 ? '📥 수행으로 등록' : '📥 안내로 등록') : '📥 1클릭 등록') + '</button> <button type="button" class="sm" data-preview-cand="' + esc(b.key) + '">👁 미리보기</button></td>' +
      '</tr>';
    }).join('');

    box.innerHTML = '<div class="scroll"><table class="t" data-name="bundles">' +
      '<thead><tr><th class="c"><input type="checkbox" data-ckall="cand" aria-label="후보 전체 선택"></th><th class="n">№</th><th class="yr">연도</th><th>추정 기업</th><th>세부 트랙 · 감지 출처</th><th>최근 일자</th><th class="wide">대표 수신 제목</th><th data-k="act">작업</th></tr></thead>' +
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
          (isLean() ? '' : '<button type="button" class="sm" id="toCoachFromCheckBtn">🧠 RAG 행동코치</button>') +
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
    var lean = isLean(); // lean: RAG 코치(좌측)를 빼고 보고서 작성만 남긴다
    var plan = (rag && !lean) ? rag.recommendNextActions(APP_KEY, proj || { stage: 'intake' }, cd, comms) : null;
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

    if (lean) leftColHtml = '';
    var rightColHtml = '';
    if (!proj) {
      rightColHtml =
        '<div class="ws-col-right">' +
          '<div class="card"><div class="sec"><span>' + (lean ? '' : '④ ') + '보고서 작성 · HWPX 출력</span></div>' +
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
            '<div class="sec"><span>' + (lean ? '' : '④ ') + '보고서 작성 · 출력</span>' +
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
            '<details class="sub-fold"' + (lean ? '' : ' open') + '><summary>👁 A4 보고서 실시간 미리보기</summary>' +
              '<div class="sub-fold-bd">' + previewHtml + '</div>' +
            '</details>' +
          '</div>' +
        '</div>';
    }

    var topCardHtml = proj
      ? ('<div class="card">' + projectPickerBarHtml(proj, 'report') + '</div>')
      : (lean ? '<div class="note">보고서를 쓸 사업장을 먼저 고르세요. 📂 컨설팅 수행 탭에서 사업장 줄을 누르면 됩니다.</div>' : '<div class="note"><b>' + esc(cat.name) + '</b> 실무 RAG 코치 — 왼쪽에서 플레이북·법령 근거를 바로 검색할 수 있으며, 사업장을 선택하면 오른쪽 보고서 작업실도 함께 활성화됩니다.</div>');

    // 기관 서식이 컨설팅보고서에 있는 앱(govReportForm — 기술보호·현장클리닉·상공회의소): 기관에 내는 서식은 «컨설팅보고서»가 실제 서식(별지)에 채워 출력한다.
    // 여기의 일반 보고서 원고(최종결과보고서·1P·체크리스트)는 기관 서식이 아닌 내부 참고용이라 «접어 둔다»(지우지 않음).
    if (reportFolded()) {
      topCardHtml += '<div class="note" id="govReportNote">📑 <b>기관 제출용 서식</b>(' + esc(cat.shortName) + ' 기관 양식)은 <a class="act-link" href="gov-report.html" target="_blank" rel="noopener">컨설팅보고서 ↗</a>에서 실제 서식에 채워 출력합니다. ' +
        '이 탭의 일반 보고서 원고는 내부 참고용이라 오른쪽에 접어 두었습니다.</div>';
      rightColHtml = '<div class="ws-col-right"><details class="sub-fold" id="genRptFold"><summary>📄 일반 보고서 원고 · HWPX (내부 참고용 — 기관 서식 아님)</summary><div class="sub-fold-bd">' +
        rightColHtml.replace(/^<div class="ws-col-right">/, '').replace(/<\/div>$/, '') +
        '</div></details></div>';
    }

    box.innerHTML = topCardHtml +
      '<div class="ws-split' + (lean ? ' focus-doc' : (WS_FOCUS ? (' focus-' + WS_FOCUS) : '')) + '">' + leftColHtml + rightColHtml + '</div>';

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

  // 사업장 단위 묶음에서 한 사업장의 여러 연도 건이 한꺼번에 처리될 때는 한 번 더 확인한다(건수를 말해 준다)
  function confirmGroupedBulk(list, verb) {
    if (!isGrouped()) return true;
    var gc = groupProjects(list).length;
    if (list.length <= gc) return true;
    if (typeof global.confirm !== 'function') return true;
    return global.confirm('선택한 ' + gc + '곳의 연도별 건 ' + list.length + '건을 모두 ' + verb + '합니다. 계속할까요?');
  }

  async function bulkUpdateProjectsDone(list) {
    if (!list.length) return;
    if (!confirmGroupedBulk(list, '완료 처리')) return;
    try {
      for (var i = 0; i < list.length; i++) {
        var p = list[i];
        if (p.status === 'done') continue;
        var rawDone = projectById(p.id) || p; // 목록 사본(화면 보정 갈래가 얹힘)이 아니라 원본에 «바꾼 칸만»
        D.projects[p.id] = await saveRecord('projects/' + p.id, p.id, Object.assign({}, rawDone, { status: 'done' }), 'Project', { patch: { status: 'done' } });
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
    if (!confirmGroupedBulk(list, '보관삭제')) return;
    try {
      for (var i = 0; i < list.length; i++) {
        var p = list[i];
        var rawDel = projectById(p.id) || p;
        await softDeleteRecord('projects/' + p.id, rawDel, 'Project');
        D.projects[p.id] = Object.assign({}, rawDel, { _deleted: true });
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
      summaryNote: '자동 감지 등록 (메일 ' + bundle.mailCount + ' / 톡 ' + bundle.msgCount + ')' +
        ((Array.isArray(bundle.yearsList) && bundle.yearsList.length > 1) ? (' · ' + bundle.yearsList[bundle.yearsList.length - 1] + '~' + bundle.yearsList[0] + '년 자료 통합') : '')
    };
    if (str(bundle.caseNo)) rec.caseNo = cleanText(bundle.caseNo).slice(0, 60);
    if (APP_KEY === 'laboraudit' && bundle.inspMeta) {
      if (str(bundle.inspMeta.inspPeriod)) rec.inspPeriod = cleanText(bundle.inspMeta.inspPeriod).slice(0, 80);
      if (str(bundle.inspMeta.inspOffice)) rec.inspOffice = cleanText(bundle.inspMeta.inspOffice).slice(0, 60);
      if (str(bundle.inspMeta.inspIssues)) rec.inspIssues = cleanText(bundle.inspMeta.inspIssues).slice(0, 480);
      if (str(bundle.inspMeta.inspDue)) rec.inspDue = cleanText(bundle.inspMeta.inspDue).slice(0, 32);
      if (str(bundle.inspMeta.inspResult)) rec.inspResult = cleanText(bundle.inspMeta.inspResult).slice(0, 40);
    }
    if (isSplit()) rec.kind = num(bundle.erpCount, 0) > 0 ? 'perf' : 'guide'; // ERP 수임이 확인된 후보만 «수행», 메일·카톡뿐이면 «안내·기타»
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
      if (isSplit()) rec.kind = 'perf'; // 여기서 직접 등록하는 건은 컨설팅 수행
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

  /* «🔎 분류 점검» 창 — 지금(저장) → 권장, 근거, ☐ + №. 확실한 것만 미리 고른다. «분류 바꾸기»는 건수를 묻고 trackId·trackName 만 patch.
     «관련 없음»은 휴지통(보관삭제 _deleted — 되살릴 수 있음)으로만. 아무것도 자동으로 바꾸지 않는다. */
  function openTrackAuditModal() {
    var m = $('modal'), box = $('mbox');
    var au = trackAuditMap();
    if (!m || !box || !au) return;
    LAST_FOCUS_EL = document.activeElement;
    var cat = getAppCat();
    var names = Object.create(null);
    (cat.tracks || []).forEach(function (t) { names[t.id] = t.shortName || t.name; });
    Object.keys(VIRTUAL_TRACKS).forEach(function (id) { names[id] = VIRTUAL_TRACKS[id].shortName; });
    Object.keys(cat.legacyTrackNames || {}).forEach(function (id) { names[id] = cat.legacyTrackNames[id]; });
    var LV = { sure: '확실', likely: '유력', tie: '비김', none: '근거 없음' };
    var rows = Object.keys(au).filter(function (k) { return au[k].changed; }).map(function (k) { return Object.assign({ pid: k, p: projectById(k) }, au[k]); })
      .filter(function (r) { return r.p; })
      .sort(function (a, b) { return num(b.p.year, 0) - num(a.p.year, 0) || str(a.p.companyName).localeCompare(str(b.p.companyName), 'ko'); });
    var pick = Object.create(null);
    rows.forEach(function (r) { if (r.level === 'sure' && !VIRTUAL_TRACKS[r.to]) pick[r.pid] = 1; });
    function body() {
      var nPick = Object.keys(pick).length;
      return '<div class="note">근거(제목·사업장명·요약·사건번호·메일 제목)로 다시 본 갈래입니다. <b>확실</b>한 것만 미리 골랐습니다. «분류 바꾸기»는 고른 줄의 <b>갈래 한 칸</b>만 저장합니다. «관련 없음»은 휴지통(되살릴 수 있음)으로만 옮깁니다.</div>' +
        '<div class="bulk on"><b>' + nPick + '건 선택</b>' +
          '<button type="button" class="sm ok" id="taApplyBtn"' + (nPick ? '' : ' disabled') + '>선택한 ' + nPick + '건 분류 바꾸기</button>' +
          '<button type="button" class="sm danger" id="taTrashBtn">«관련 없음» 고른 줄 휴지통으로</button></div>' +
        '<div class="scroll"><table class="t" data-name="trackAudit"><thead><tr><th class="c"><input type="checkbox" id="taAll" aria-label="전체 선택"></th><th class="n">№</th><th class="yr">연도</th><th>사업장명</th><th>지금(저장)</th><th>권장</th><th>확실도</th><th class="wide">근거</th></tr></thead><tbody>' +
        rows.map(function (r, i) {
          return '<tr><td class="c"><input type="checkbox" data-ta="' + esc(r.pid) + '"' + (pick[r.pid] ? ' checked' : '') + ' aria-label="' + esc(r.p.companyName) + ' 선택"></td>' +
            '<td class="n">' + (i + 1) + '</td><td class="yr">' + esc(String(r.p.year || '')) + '</td>' +
            '<td class="ti" title="' + esc(r.p.companyName) + '">' + esc(r.p.companyName) + '</td>' +
            '<td><span class="chip">' + esc(names[r.from] || r.from || '-') + '</span></td>' +
            '<td><span class="chip ' + (VIRTUAL_TRACKS[r.to] ? 'c-amber' : 'c-blue') + '">' + esc(names[r.to] || r.to) + '</span></td>' +
            '<td>' + esc(LV[r.level] || r.level) + '</td>' +
            '<td class="wide" title="' + esc(r.evidence || '-') + '">' + esc(r.evidence || '-') + '</td></tr>';
        }).join('') +
        (rows.length ? '' : '<tr><td colspan="8" class="empty">다시 볼 건이 없습니다.</td></tr>') +
        '</tbody></table></div>';
    }
    function bind() {
      box.querySelectorAll('[data-ta]').forEach(function (cb) {
        cb.onchange = function () { var id = cb.getAttribute('data-ta'); if (cb.checked) pick[id] = 1; else delete pick[id]; redraw(); };
      });
      if ($('taAll')) $('taAll').onchange = function () { var on = $('taAll').checked; rows.forEach(function (r) { if (on) pick[r.pid] = 1; else delete pick[r.pid]; }); redraw(); };
      if ($('taApplyBtn')) $('taApplyBtn').onclick = async function () {
        var list = rows.filter(function (r) { return pick[r.pid] && !VIRTUAL_TRACKS[r.to]; });
        var skipped = Object.keys(pick).length - list.length;
        if (!list.length) { toast('바꿀 수 있는 줄(분류 확인·관련 없음이 아닌 줄)을 골라 주세요.'); return; }
        if (!global.confirm(list.length + '건의 사업 갈래를 권장 갈래로 바꿀까요?' + (skipped ? (' («분류 확인»·«관련 없음» ' + skipped + '건은 갈래가 정해지지 않아 건너뜁니다)') : ''))) return;
        var ok = 0;
        for (var i = 0; i < list.length; i++) {
          var r = list[i];
          var tObj = (cat.tracks || []).find(function (t) { return t.id === r.to; });
          if (await saveProjectPatch(r.pid, { trackId: r.to, trackName: tObj ? tObj.name : r.to })) ok++;
        }
        closeModal(); rebuildDiscoverAndRag(); draw();
        toast(ok + '건의 갈래를 바꿨습니다.');
      };
      if ($('taTrashBtn')) $('taTrashBtn').onclick = async function () {
        var list = rows.filter(function (r) { return pick[r.pid] && r.to === 'fw_offtopic'; }).map(function (r) { return r.p; });
        if (!list.length) { toast('«관련 없음» 줄을 골라 주세요.'); return; }
        if (!global.confirm(list.length + '건을 휴지통(보관삭제)으로 옮길까요? 자료는 지워지지 않고 되살릴 수 있습니다.')) return;
        closeModal();
        await bulkDeleteProjects(list);
      };
      if ($('mCloseBtn')) $('mCloseBtn').onclick = closeModal;
    }
    function redraw() { if ($('taBody')) { $('taBody').innerHTML = body(); bind(); } }
    box.innerHTML = '<div class="mhd"><b id="mhdTitle">🔎 분류 점검 — ' + esc(cat.name) + '</b><span class="sp"></span><button type="button" class="sm" id="mCloseBtn">닫기</button></div>' +
      '<div class="mbd" id="taBody">' + body() + '</div>';
    box.classList.add('wide');
    m.style.display = 'flex';
    bind();
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
        var impProj = projectById(CUR_PID);
        switchTab((isSplit() && impProj && projectKind(impProj) !== 'perf') ? 'guide' : 'detail');
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
    // 이 앱 화면에 없는 탭(빼 버린 연도별 자료함·kindSplit 이 아닌 앱의 안내 탭 등)이 옛 주소·옛 단추로 오면 사업 현황으로
    if (!document.getElementById('p-' + t)) return 'projects';
    if (t === 'guide' && !isSplit()) return 'projects'; // 안내·기타 창은 모든 틀에 있지만 kindSplit 앱만 쓴다
    return t;
  }

  function switchTab(tab) {
    if (CUR_TAB === 'report') captureReportUiState();
    var prevTab = CUR_TAB;
    CUR_TAB = normalizeTabName(tab);
    if (isSplit() && prevTab !== CUR_TAB) SEL = Object.create(null); // 화면을 떠나면 고른 것을 비운다(고르기칸 규칙)
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
    else if (CUR_TAB === 'guide') renderGuidePane();
    else if (CUR_TAB === 'detail') renderDetailPane();
    else if (CUR_TAB === 'report') renderReportPane();
  }

  /* kindSplit 앱(기술보호)만: 틀에 숨겨 둔 «📨 안내·기타» 탭·후보 안내글을 켜고, 사업 현황 탭 이름을 «컨설팅 수행»으로 */
  function applyKindSplitUi() {
    if (typeof document === 'undefined' || !document.querySelector) return;
    var split = isSplit();
    var gTab = document.querySelector('.tabs button[data-tab="guide"]');
    if (gTab) gTab.hidden = !split;
    if ($('inSplitHint')) $('inSplitHint').hidden = !split;
    var pTab = document.querySelector('.tabs button[data-tab="projects"]');
    if (pTab && pTab.firstChild && pTab.firstChild.nodeType === 3) pTab.firstChild.nodeValue = split ? '📂 컨설팅 수행 ' : '📂 사업 현황 ';
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
      TRACK_FILTER = ''; YEAR_FILTER = ''; ERP_FILTER = ''; SHOW_ALL_ROWS = false;
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
      if (leftDashOn()) TRACK_FILTER = '';
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

    // 탭: 안내·기타
    if ($('gQ')) $('gQ').oninput = function () { if (CUR_TAB === 'guide') renderGuidePane(); };
    if ($('gResetBtn')) $('gResetBtn').onclick = function () {
      YEAR_FILTER = ''; GUIDE_STATE_FILTER = '';
      if ($('gQ')) $('gQ').value = '';
      draw();
    };
    if ($('gAddBtn')) $('gAddBtn').onclick = function () { openGuideModal(null); };
    if ($('gCsvBtn')) $('gCsvBtn').onclick = downloadGuideCsv;

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
        else if (allList === 'guide') refreshGuideBulkUi();
        return;
      }
      var k = t.getAttribute('data-ck');
      if (k) {
        SEL[k] = t.checked;
        var listKind = t.getAttribute('data-list');
        if (listKind === 'proj') refreshProjBulkUi();
        else if (listKind === 'cand') refreshCandBulkUi();
        else if (listKind === 'guide') refreshGuideBulkUi();
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
    // lean·가벼운 화면(12개 앱 공통 기본)은 «변경됨» 파란 테두리·배지·안내 띠를 쓰지 않는다
    if (isLean()) DIFF_HIGHLIGHT = false;
    else DIFF_HIGHLIGHT = !isSlim();
    fb = firebaseInstance;
    fbDb = fb && fb.database ? fb.database() : null;
    bindEvents();
    applyKindSplitUi();

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
      memoShown: function (p) { return memoShown(p); },
      setProjects: function (obj) { D.projects = obj || {}; TRACK_FILTER = ''; },
      leftDashWanted: function () { return leftDashWanted(); },
      leftDashLabels: function () { return leftDashLabels(); },
      isSlim: function () { return isSlim(); },
      reportFolded: function () { return reportFolded(); },
      groupProjects: function (list) { return groupProjects(list); },
      isGrouped: function () { return isGrouped(); },
      trackAuditMap: function () { _auditCache = { key: '', map: null }; return trackAuditMap(); },
      setComms: function (obj) { D.comms = obj || {}; }
    },
    projectKind: projectKind,
    guideState: guideState
  };
})(typeof window !== 'undefined' ? window : globalThis);
