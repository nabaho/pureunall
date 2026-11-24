/* P박스 (푸른박스) 통합 화면 컨트롤러 — js/pu-pbox-app.js
 *
 * 구성:
 * - 왼쪽 사이드바: 홈(AI 법률비서) · 개정알림 · 국가법령 전수함(5,773) · 판례/심결/유권해석 · 하급심 수집함 · 워크플로 · 사건 프로젝트 · 최근 작업이력
 * - 가운데 작업창: @원문 첨부 질의창, 기계적 인용 검증 결과, PC 규격 표 & 모바일 2줄 카드, 일괄 작업 막대
 * - 오른쪽 분할 리더창(#pboxReader): 법령 조문 목차 이동·조문 내 검색·판례/유권해석 전문 열람 (law.go.kr 점검 중에도 상시 작동)
 */
(function (global) {
  'use strict';

  var THEME_LS_KEY = 'pu_pbox_theme_v1';
  var ASSIST_HIDE_LS_KEY = 'pu_pbox_hide_assist_v1';

  var state = {
    view: 'home',            // home | workspace | alerts | laws | cases | sites | ingest | recents | workflows | projects | tasks
    authUser: null,
    userName: '노무사',
    theme: 'light',
    sidebarCollapsed: false,
    taskSecCollapsed: false,
    hideHomeEmptyProjects: false,
    hideHomeAssist: false,
    _assistDismissedDraft: '',
    workspaceTab: 'report',  // report | clauses | timeline | editor
    wsAuthTab: 'all',        // all | precedents | laws | interpretations | decisions
    reviewStance: 'neutral', // neutral | worker | employer
    deadlineBaseDate: '',
    promptMode: 'auto',      // auto | search | draft | review
    homePromptDraft: '',
    voiceActive: false,
    voicePhase: 'idle',      // idle | connecting | ready | speaking | recognized
    voiceTarget: 'home',     // home | ws
    voiceBaseText: '',
    voiceCommittedText: '',
    voiceInterim: '',
    voiceNoSpeechCount: 0,
    _voiceConsented: false,
    attached: [],            // [{ id, kind, title, caseNo, lawDir, fileName, body }]
    activeThread: null,
    activeSearchRes: null,
    aiBusy: false,
    reviewFileBusy: false,
    ingestBusy: false,
    lowerPullBusy: false,
    liveCollectBusy: false,
    backupBusy: false,
    syncBusy: false,
    syncProgressText: '',

    /* 하급심(org=400202) 공식 API 핀포인트 수집 조건 */
    lowerCourtFilter: '',
    lowerPreset: 'all',
    lowerCustomQuery: '',
    lowerStatusBanner: null,

    /* 중앙행정심판·특별행정심판·위원회 심판·재결 전체 공식 API 수집 조건 */
    tribunalPullBusy: false,
    tribunalFilter: 'all',
    tribunalLocalOrg: '',
    tribunalPreset: 'all',
    tribunalCustomQuery: '',
    tribunalStatusBanner: null,

    /* 한국공인노무사회(ilabor 전용자료실 · 본회 포털) 통합 수집 조건 */
    kcplaaPullBusy: false,
    kcplaaChannel: 'all',
    kcplaaCustomQuery: '',
    kcplaaStatusBanner: null,

    /* 국가법령 전수함 필터·선택 */
    lawCat: 'priority',
    lawQuery: '',
    lawPageLimit: 80,
    selectedLawDirs: new Set(),

    /* 판례·심결·유권해석 스마트 필터·선택 */
    caseDocType: 'all',
    caseTribunalOrg: 'all',
    caseQuery: '',
    caseSubQuery: '',
    caseDateRange: 'all',    // all | 1y | 3y | 5y
    caseSortBy: 'relevance', // relevance | date_desc | court_tier
    caseOutcomeFilter: 'all',// all | en_banc | favorable | partial | unfavorable | caution
    activeIssueCat: 'dismissal',
    liveCollectBanner: null,
    selectedDocIds: new Set(),

    /* 대한민국 전 법률·공공사이트 직접검색 허브 */
    siteCat: 'all',
    siteSearchQuery: '',

    /* 최근 본 자료 · 작업 관리 선택 */
    selectedRecentIds: new Set(),
    selectedTaskIds: new Set(),

    /* 워크플로·프로젝트 */
    activeWorkflowId: 'wf_unfair_dismissal',
    activeProjectId: '',
    selectedProjectIds: new Set(),

    /* 하급심 수집 미리보기 */
    ingestRawText: '',
    ingestPreview: null,
    ingestShareConfirmed: false,

    /* 오른쪽 원문 리더 */
    readerOpen: false,
    readerKind: '',          // 'law' | 'doc'
    readerLawMode: 'single', // 'single' | '3dan'
    readerLaw: null,
    readerLawFamily: null,
    reader3Dan: null,        // { dir, title, loading, cols: [...] }
    readerHistoryOpen: false,
    readerHistoryBusy: false,
    readerHistoryList: [],
    readerHistoryError: '',
    readerHistoryDate: '',
    lawHistoryLookupDate: '',
    readerArticleFilter: '',
    readerHighlightArt: '',
    readerDoc: null,
    _readerReqSeq: 0,

    /* 모달 접근성 포커스 복원 · 음성인식 · 실시간 백그라운드 수집 타이머 */
    _modalPrevFocus: null,
    _afterProjCb: null,
    _autoSyncTimer: null,
    _speechRec: null,
    _voiceStartSeq: 0,
    _voiceSilenceTimer: null,
    _liveFactTimer: null,
    _eventsBound: false
  };

  var rootEl = null;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function highlightHtml(rawText, rawTerms) {
    var src = String(rawText == null ? '' : rawText);
    if (!src || !Array.isArray(rawTerms) || !rawTerms.length) return esc(src);
    var patTerms = [];
    for (var i = 0; i < rawTerms.length; i++) {
      var t = String(rawTerms[i] || '').trim();
      if (t.length < 2) continue;
      patTerms.push(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    }
    if (!patTerms.length) return esc(src);
    patTerms.sort(function (a, b) { return b.length - a.length; });
    try {
      var re = new RegExp(patTerms.slice(0, 8).join('|'), 'gi');
      var out = '';
      var lastIdx = 0;
      var m;
      while ((m = re.exec(src)) !== null) {
        if (!m[0]) { re.lastIndex++; continue; }
        out += esc(src.slice(lastIdx, m.index));
        out += '<mark class="pbox-hl">' + esc(m[0]) + '</mark>';
        lastIdx = m.index + m[0].length;
      }
      out += esc(src.slice(lastIdx));
      return out;
    } catch (_) {
      return esc(src);
    }
  }

  function sanitizeExternalSearchQuery(rawQ) {
    var rawStr = String(rawQ == null ? '' : rawQ);
    if (!rawStr) return { ok: true, query: '' };
    if (rawStr.length > 100000) {
      return {
        ok: false,
        error: '외부 사이트 검색어는 80자 이하로 입력해 주세요.'
      };
    }
    var E = global.PuPBoxEngine;
    var hasHardPii = false;
    if (E && typeof E.hasResidualHardPiiClient === 'function' && E.hasResidualHardPiiClient(rawStr)) {
      hasHardPii = true;
    } else if (global.PuRrnScrub && typeof global.PuRrnScrub.hasRrn === 'function' && global.PuRrnScrub.hasRrn(rawStr)) {
      hasHardPii = true;
    } else if (/(?:^|[^\d])\d{6}[-\s.]?[1-8]\d{6}(?:[^\d]|$)/.test(rawStr) || /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(rawStr) || /\b\d{10,19}\b/.test(rawStr)) {
      hasHardPii = true;
    }
    if (!hasHardPii && E && typeof E.anonymizeLegalText === 'function') {
      var checkAnon = E.anonymizeLegalText(rawStr, []);
      if (checkAnon && checkAnon.counts && (checkAnon.counts.rrn > 0 || checkAnon.counts.phone > 0 || checkAnon.counts.email > 0 || checkAnon.counts.account > 0)) {
        hasHardPii = true;
      }
    }
    if (hasHardPii) {
      return {
        ok: false,
        error: '검색어에 주민등록번호·연락처·이메일·계좌번호 등 개인정보가 포함되어 제3자 외부 사이트 전송을 차단했습니다.'
      };
    }
    if (rawStr.length > 80) {
      return {
        ok: false,
        error: '외부 사이트 검색어는 80자 이하로 입력해 주세요.'
      };
    }
    var s = rawStr.trim();
    if (!s) return { ok: true, query: '' };
    var partyNames = (E && typeof E.extractPartyNames === 'function') ? E.extractPartyNames(s, '') : [];
    var scrubbed = (E && typeof E.anonymizeLegalText === 'function')
      ? E.anonymizeLegalText(s, partyNames).text
      : s;
    if (global.PuRrnScrub && typeof global.PuRrnScrub.scrub === 'function') {
      scrubbed = global.PuRrnScrub.scrub(scrubbed);
    }
    return { ok: true, query: scrubbed.trim() };
  }

  function openSafeExternalUrl(url) {
    var u = String(url || '').trim();
    if (!/^https:\/\//i.test(u)) {
      toast('보안상 HTTPS 공식·검증 사이트만 열 수 있습니다.', 'err');
      return false;
    }
    if (global && typeof global.open === 'function') {
      var w = global.open(u, '_blank', 'noopener,noreferrer');
      if (w) {
        try { w.opener = null; } catch (_) {}
      }
      return true;
    }
    return false;
  }

  function stopBackgroundAutoSync() {
    if (state._autoSyncTimer) {
      try { clearInterval(state._autoSyncTimer); } catch (_) {}
      state._autoSyncTimer = null;
    }
  }

  function applyTheme(nextTheme) {
    var t = nextTheme === 'dark' ? 'dark' : 'light';
    state.theme = t;
    if (typeof document !== 'undefined' && document.documentElement) {
      if (t === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
      else document.documentElement.removeAttribute('data-theme');
    }
    try { localStorage.setItem(THEME_LS_KEY, t); } catch (e) {}
  }

  function loadInitialTheme() {
    try {
      state.hideHomeAssist = localStorage.getItem(ASSIST_HIDE_LS_KEY) === '1';
    } catch (e0) {}
    try {
      var saved = localStorage.getItem(THEME_LS_KEY);
      if (saved === 'dark' || saved === 'light') {
        applyTheme(saved);
        return;
      }
    } catch (e) {}
    applyTheme('light');
  }

  function docTypeBadgeLabel(dt) {
    var map = {
      prec_sc: '대법원·헌재',
      prec_lower: '하급심판결',
      dec_nlrc: '위원회재결',
      interp_moel: '노동부해석',
      interp_gov: '범부처·조례해석',
      ordinance: '자치조례',
      internal_case: '수집판결문'
    };
    return map[dt] || '법률자료';
  }

  function docTypeBadgeClass(dt) {
    if (dt === 'prec_sc') return 'pbox-badge-blue';
    if (dt === 'prec_lower' || dt === 'ordinance') return 'pbox-badge-green';
    if (dt === 'dec_nlrc') return 'pbox-badge-amber';
    if (dt === 'interp_moel' || dt === 'interp_gov') return 'pbox-badge-gray';
    return 'pbox-badge-blue';
  }

  /* 이미 esc() 및 기본 마크다운 태그 변환이 끝난 HTML에서 태그 밖 텍스트 노드에만 요청 단어 <mark class="pbox-hl"> 적용 */
  function highlightRenderedHtmlText(renderedHtml, terms) {
    var htmlStr = String(renderedHtml || '');
    if (!htmlStr || !Array.isArray(terms) || !terms.length) return htmlStr;
    var cleanTerms = terms
      .map(function (t) { return String(t || '').trim(); })
      .filter(function (t) { return t.length >= 2 && t.length <= 24; })
      .sort(function (a, b) { return b.length - a.length; })
      .slice(0, 12);
    if (!cleanTerms.length) return htmlStr;
    var pattern = cleanTerms.map(function (t) { return t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|');
    if (!pattern) return htmlStr;
    var re = new RegExp('(' + pattern + ')', 'gi');
    var parts = htmlStr.split(/(<[^>]+>)/g);
    var inMark = false;
    var inCode = false;
    for (var i = 0; i < parts.length; i++) {
      var seg = parts[i];
      if (!seg) continue;
      if (seg.charAt(0) === '<') {
        if (/^<mark\b/i.test(seg)) inMark = true;
        else if (/^<\/mark>/i.test(seg)) inMark = false;
        else if (/^<code\b/i.test(seg)) inCode = true;
        else if (/^<\/code>/i.test(seg)) inCode = false;
        continue;
      }
      if (!inMark && !inCode) {
        parts[i] = seg.replace(re, '<mark class="pbox-hl">$1</mark>');
      }
    }
    return parts.join('');
  }

  function formatSimpleMd(md, hlTerms) {
    var lines = String(md || '').split('\n');
    var html = [];
    for (var i = 0; i < lines.length; i++) {
      var ln = esc(lines[i]);
      ln = ln.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      ln = ln.replace(/`([^`]+)`/g, '<code class="pbox-inline-code">$1</code>');
      if (Array.isArray(hlTerms) && hlTerms.length) {
        ln = highlightRenderedHtmlText(ln, hlTerms);
      }
      if (/^####\s+/.test(ln)) {
        html.push('<h4 class="pbox-md-h4">' + ln.replace(/^####\s+/, '') + '</h4>');
      } else if (/^###\s+/.test(ln)) {
        html.push('<h3 class="pbox-md-h3">' + ln.replace(/^###\s+/, '') + '</h3>');
      } else if (/^\s*&gt;\s*/.test(ln)) {
        html.push('<blockquote class="pbox-md-quote">' + ln.replace(/^\s*&gt;\s*/, '') + '</blockquote>');
      } else if (/^\s*-\s+/.test(ln)) {
        html.push('<div class="pbox-md-li">• ' + ln.replace(/^\s*-\s+/, '') + '</div>');
      } else if (/^\s*\d+\.\s+/.test(ln)) {
        html.push('<div class="pbox-md-li">' + ln + '</div>');
      } else if (!ln.trim()) {
        html.push('<div class="pbox-md-gap"></div>');
      } else {
        html.push('<p class="pbox-md-p">' + ln + '</p>');
      }
    }
    return html.join('');
  }

  function toast(msg, kind) {
    var box = document.getElementById('pboxToast');
    if (!box) return;
    box.textContent = msg;
    box.className = 'pbox-toast show ' + (kind === 'err' ? 'err' : 'ok');
    clearTimeout(box._timer);
    box._timer = setTimeout(function () {
      box.className = 'pbox-toast';
    }, 3400);
  }

  function copyTextSafe(txt, okMsg) {
    var payload = String(txt == null ? '' : txt);
    if (!payload.trim()) {
      toast('복사할 내용이 없습니다.', 'err');
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(payload)
        .then(function () { toast(okMsg || '클립보드에 복사되었습니다.'); })
        .catch(function () { toast('클립보드 복사에 실패했습니다. 브라우저 권한을 확인해 주세요.', 'err'); });
    } else {
      toast('클립보드 복사를 지원하지 않는 환경입니다.', 'err');
    }
  }

  /* ── PDF 로컬 텍스트 추출기 (필요할 때만 vendor/pdf.min.js 지연 적재) ── */
  function ensurePdfJs() {
    if (global.pdfjsLib) return Promise.resolve(global.pdfjsLib);
    return new Promise(function (resolve, reject) {
      var sc = document.createElement('script');
      sc.src = 'vendor/pdf.min.js';
      sc.onload = function () {
        if (global.pdfjsLib) {
          global.pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
          resolve(global.pdfjsLib);
        } else {
          reject(new Error('PDF 엔진을 불러오지 못했습니다'));
        }
      };
      sc.onerror = function () { reject(new Error('vendor/pdf.min.js 로드 실패')); };
      document.head.appendChild(sc);
    });
  }

  function extractPdfFileText(file) {
    return file.arrayBuffer().then(function (buf) {
      return ensurePdfJs().then(function (pdfjsLib) {
        return pdfjsLib.getDocument({ data: buf, isEvalSupported: false }).promise;
      });
    }).then(function (pdf) {
      var maxPages = Math.min(pdf.numPages, 60);
      var pages = [];
      function nextPage(p) {
        if (p > maxPages) return Promise.resolve(pages.join('\n\n'));
        return pdf.getPage(p).then(function (page) {
          return page.getTextContent();
        }).then(function (tc) {
          var line = (tc.items || []).map(function (it) { return it.str || ''; }).join(' ');
          pages.push(line);
          return nextPage(p + 1);
        });
      }
      return nextPage(1);
    });
  }

  /* ── 엘박스형 표시 보조 함수 (이니셜 · 상대 일자 · 자료 구분 · 작업 배지) ── */
  function avatarCharsOf(rawName) {
    var s = String(rawName || '').replace(/공인노무사|노무사|\s+/g, '').trim();
    if (!s) return '푸른';
    if (s.length >= 3 && /^[가-힣]+$/.test(s)) return s.slice(-2);
    return s.slice(0, 2);
  }

  function formatRelativeDay(ts) {
    var num = Number(ts) || 0;
    if (!num) return '오늘';
    var kstOffset = 9 * 3600 * 1000;
    var todayIdx = Math.floor((Date.now() + kstOffset) / 86400000);
    var itemIdx = Math.floor((num + kstOffset) / 86400000);
    var diff = Math.max(0, todayIdx - itemIdx);
    if (diff === 0) return '오늘';
    if (diff === 1) return '어제';
    if (diff <= 30) return diff + '일 전';
    var d = new Date(num + kstOffset);
    return d.getUTCFullYear() + '. ' + (d.getUTCMonth() + 1) + '. ' + d.getUTCDate() + '.';
  }

  function recentKindLabel(r) {
    if (!r) return '자료';
    if (r.kind === 'law') return '법령';
    var docId = String(r.id || '').replace(/^doc:/, '');
    var d = global.PuPBoxStore && global.PuPBoxStore.getDocById ? global.PuPBoxStore.getDocById(docId) : null;
    if (d) {
      if (d.docType === 'dec_nlrc') return '결정례';
      if (d.docType === 'ordinance') return '조례·자치법규';
      if (d.docType === 'interp_moel' || d.docType === 'interp_gov') return '유권해석';
    }
    if (/재심판정|결정|처분\s*취소\s*청구/.test(String(r.title || '')) && !/판결/.test(String(r.title || ''))) {
      return '결정례';
    }
    return '판례';
  }

  function threadModeBadge(mode) {
    if (mode === 'review') return { label: '✦ 내용 검토', cls: 'pbox-badge-blue' };
    if (mode === 'draft') return { label: '✎ 문서 작성', cls: 'pbox-badge-green' };
    if (mode === 'search') return { label: '🔍 통합 검색', cls: 'pbox-badge-gray' };
    return { label: '⚖️ 법리 검토', cls: 'pbox-badge-amber' };
  }

  var SAMPLE_REVIEW_DOCS = {
    freelancer: [
      '업무위탁(프리랜서) 용역계약서',
      '제1조 (목적) 갑은 을에게 인사노무 행정지원 및 상시 출퇴근 사무업무를 위탁한다.',
      '제3조 (근무시간 및 지휘감독) 을은 매주 월~금 09:00부터 18:00까지 갑이 지정한 본사 좌석에 출근하여 갑의 팀장 결재와 업무지시에 따라 근무한다.',
      '제5조 (보수 및 퇴직금 부존재) 갑은 매월 25일 고정 기본보수 3,000,000원을 지급하며, 4대보험 및 퇴직금·연차유급휴가는 일체 발생하지 아니한다.',
      '제7조 (위약벌 및 손해배상 예정) 을이 계약기간 중 중도 퇴사할 경우 월 보수의 2배를 위약금으로 배상하며 갑은 미지급 보수에서 이를 우선 공제한다.',
      '제9조 (즉시 해지) 을이 갑의 지시를 1회라도 불이행할 경우 최고 없이 즉시 본 계약을 해지한다.'
    ].join('\n\n'),
    blanket_wage: [
      '연봉 및 포괄임금 근로계약서',
      '제2조 (수습기간) 입사일로부터 3개월간 수습기간을 두며, 수습기간 중 급여는 최저임금의 80%를 지급하고 회사는 수습 중 언제든지 임의로 본채용을 거부할 수 있다.',
      '제4조 (포괄임금 약정) 월 급여액에는 연장·야간·휴일근로수당 및 연차미사용수당 일체가 포괄되어 있으므로 실제 초과근로시간과 관계없이 별도의 가산수당을 청구하지 못한다.',
      '제5조 (정기상여금) 분기별 정기상여금은 지급일 현재 재직 중인 자에 한하여 지급하며 통상임금 산정에서 제외한다.',
      '제8조 (연차휴가 소멸) 당해 연도에 사용하지 못한 연차유급휴가는 별도 촉진 절차 없이도 자동 소멸된 것으로 본다.'
    ].join('\n\n'),
    work_rules: [
      '취업규칙 개정안 (안)',
      '제14조 (당연퇴직 및 징계해고) 무단결근 2일 이상 또는 업무성과 하위 평가 시 소명기회나 서면 통지 없이 즉시 징계해고한다.',
      '제29조 (임금피크제 및 상여금 축소) 만 55세 도래 시부터 기본급을 매년 20%씩 감액하며, 본 취업규칙 불이익 변경은 부서장 회람으로 근로자 과반수 동의를 갈음한다.'
    ].join('\n\n')
  };

  /* ── 화면 이탈 시 체크박스 선택 집합 초기화 (고르기칸-번호 규칙 준수) ── */
  function clearViewSelections() {
    state.selectedLawDirs.clear();
    state.selectedDocIds.clear();
    state.selectedProjectIds.clear();
    state.selectedRecentIds.clear();
    state.selectedTaskIds.clear();
  }

  function clearLiveFactTimer() {
    if (state._liveFactTimer) {
      try { clearTimeout(state._liveFactTimer); } catch (_) {}
      state._liveFactTimer = null;
    }
  }

  /* 실시간 음성 텍스트 비식별화: PuPBoxEngine.anonymizeLegalText(주민번호·연락처·계좌·이메일·동호수·당사자 실명) 단일 방어선 적용 */
  function scrubVoiceTranscript(rawStr, knownNames) {
    var s = String(rawStr || '');
    if (!s) return '';
    var E = global.PuPBoxEngine;
    if (E && typeof E.anonymizeLegalText === 'function') {
      var names = Array.isArray(knownNames)
        ? knownNames
        : (typeof E.extractPartyNames === 'function' ? E.extractPartyNames(s, '') : []);
      s = E.anonymizeLegalText(s, names).text;
    }
    return s;
  }

  function joinVoiceParts(a, b) {
    var left = String(a || '').trim();
    var right = String(b || '').trim();
    if (!left) return right;
    if (!right) return left;
    return (left + ' ' + right).replace(/\s+/g, ' ').trim();
  }

  function voicePhaseMeta(phase) {
    var charCnt = String(joinVoiceParts(
      joinVoiceParts(state.voiceBaseText, state._voiceRawCommitted || state.voiceCommittedText),
      state._voiceRawInterim || state.voiceInterim
    ) || '').trim().length;
    if (phase === 'transcribing') {
      return { cls: 'speaking', text: '✍️ 실시간 받아쓰기 중 (' + charCnt + '자 인식됨)' };
    }
    if (phase === 'speaking') {
      return { cls: 'speaking', text: '🔵 음성 인식됨 · 글자 변환 대기 중…' };
    }
    if (phase === 'stalled') {
      return { cls: 'connecting', text: '⚠️ 음성 감지됨 · 글자 변환 응답 없음 (아래 대안 확인)' };
    }
    if (phase === 'recognized') {
      return { cls: 'recognized', text: '✓ 음성 인식 완료' + (charCnt > 0 ? (' (' + charCnt + '자)') : '') + ' · 이어서 말씀하거나 실행하세요' };
    }
    if (phase === 'ready') {
      return { cls: 'ready', text: '🟢 마이크 켜짐 · 지금 말씀해 주세요' };
    }
    return { cls: 'connecting', text: '⏳ 마이크 연결 중…' };
  }

  function buildVoiceSummaryHtml(fullScrubbed) {
    var E = global.PuPBoxEngine;
    if (!fullScrubbed || !E || typeof E.summarizeSpokenRequest !== 'function') return '';
    var lawIndex = (global.PuPBoxLawIndex && typeof global.PuPBoxLawIndex.list === 'function')
      ? global.PuPBoxLawIndex.list()
      : [];
    var sum = E.summarizeSpokenRequest(fullScrubbed, lawIndex);
    if (!sum || !sum.hasContent) return '';
    var chips = ['<span class="pbox-badge-blue">' + esc(sum.intentLabel) + '</span>'];
    for (var i = 0; i < sum.issues.length; i++) {
      chips.push('<span class="pbox-badge-green">쟁점: ' + esc(sum.issues[i]) + '</span>');
    }
    for (var j = 0; j < sum.facts.length; j++) {
      chips.push('<span class="pbox-badge-gray">' + esc(sum.facts[j]) + '</span>');
    }
    for (var k = 0; k < sum.laws.length; k++) {
      chips.push('<span class="pbox-badge-amber">' + esc(sum.laws[k]) + '</span>');
    }
    return [
      '<div id="pboxVoiceSummaryBox" class="pbox-voice-summary">',
      '  <div class="pbox-voice-summary-hd">',
      '    <strong class="pbox-voice-summary-title">🎙 지금 말씀하신 내용 실시간 정리</strong>',
      '    <button type="button" class="pbox-btn-sm" data-act="apply-voice-organized">✨ 정리문으로 입력창 채우기</button>',
      '  </div>',
      '  <div class="pbox-voice-summary-chips">' + chips.join('') + '</div>',
      '  <div class="pbox-voice-summary-body">' + esc(sum.organizedText) + '</div>',
      '</div>'
    ].join('\n');
  }

  function buildVoiceLiveScreenHtml() {
    var rawCommitted = joinVoiceParts(state.voiceBaseText, state._voiceRawCommitted || state.voiceCommittedText);
    var rawInterim = String(state._voiceRawInterim !== undefined && state._voiceRawInterim !== '' ? state._voiceRawInterim : (state.voiceInterim || '')).trim();
    if (rawCommitted || rawInterim) {
      var rawJoined = joinVoiceParts(rawCommitted, rawInterim);
      var E = global.PuPBoxEngine;
      var fullNames = (E && typeof E.extractPartyNames === 'function') ? E.extractPartyNames(rawJoined, '') : [];
      var fullScrubbed = scrubVoiceTranscript(rawJoined, fullNames);
      var committed = scrubVoiceTranscript(rawCommitted, fullNames);
      var interim = scrubVoiceTranscript(rawInterim, fullNames);
      var textHtml = (joinVoiceParts(committed, interim) !== fullScrubbed)
        ? ('<span class="pbox-voice-committed">' + esc(fullScrubbed) + '</span><span class="pbox-voice-caret" aria-hidden="true">▍</span>')
        : ((committed ? '<span class="pbox-voice-committed">' + esc(committed) + '</span>' : '') +
          (committed && interim ? ' ' : '') +
          (interim ? '<span class="pbox-voice-interim">' + esc(interim) + '</span>' : '') +
          '<span class="pbox-voice-caret" aria-hidden="true">▍</span>');
      return textHtml + buildVoiceSummaryHtml(fullScrubbed);
    }
    if (state.voicePhase === 'stalled') {
      var micDiag = (state._voiceMicProbeActive && (state._voiceMicPeakLevel || 0) < 2)
        ? '마이크 소리 입력이 감지되지 않습니다. 화면 우측 하단 <b>마이크 OFF(F8)</b> 상태나 Windows·크롬 마이크 입력 장치를 확인해 주세요.'
        : '브라우저(Chrome) 음성변환 서버 응답이 지연되고 있습니다. 아래 버튼으로 다시 연결하거나 <b>Windows 음성입력(Win+H)</b>을 바로 사용하세요.';
      return [
        '<div class="pbox-voice-stalled">',
        '  <div>⚠️ ' + micDiag + '</div>',
        '  <div class="pbox-btn-group" style="margin-top:8px;flex-wrap:wrap">',
        '    <button type="button" class="pbox-btn-sm" data-act="retry-voice-input">🔄 마이크 다시 연결</button>',
        '    <button type="button" class="pbox-btn-primary" data-act="use-win-voice-input">⌨️ 윈도우 음성입력(Win+H)으로 바로 말하기</button>',
        '  </div>',
        '</div>'
      ].join('\n');
    }
    if (state.voiceNoSpeechCount > 0) {
      return '<span class="pbox-voice-placeholder">아직 음성이 들리지 않았습니다 — 마이크 가까이 말씀해 주세요 (무음 지속 시 자동 종료)</span>';
    }
    var micBadge = state._voiceMicProbeActive
      ? ((state._voiceMicPeakLevel || 0) >= 2
        ? ' <b class="pbox-voice-mic-ok">[🔊 마이크 소리 감지 중]</b>'
        : ' <b class="pbox-voice-mic-mute">[🔇 소리 입력 없음 — 마이크 음소거·장치 확인]</b>')
      : '';
    return '<span class="pbox-voice-placeholder">지금 말씀하시면 인식되는 글자가 이곳과 아래 입력창에 바로 표시되고 자동 정리됩니다…' + micBadge + '</span>';
  }

  function syncVoiceUiDom() {
    var bannerSlot = document.getElementById('pboxVoiceBannerSlot');
    if (bannerSlot) {
      if (state.voiceActive) {
        var meta = voicePhaseMeta(state.voicePhase);
        var screenHtml = buildVoiceLiveScreenHtml();
        var waveEl = (bannerSlot.querySelector && bannerSlot.querySelector('#pboxVoiceWave')) || document.getElementById('pboxVoiceWave');
        var pillEl = (bannerSlot.querySelector && bannerSlot.querySelector('#pboxVoiceStatePill')) || document.getElementById('pboxVoiceStatePill');
        var scrEl = (bannerSlot.querySelector && bannerSlot.querySelector('#pboxVoiceLiveScreen')) || document.getElementById('pboxVoiceLiveScreen');

        if (!bannerSlot._voiceMounted || !bannerSlot.innerHTML) {
          bannerSlot.innerHTML = [
            '<div class="pbox-voice-live-card" role="region" aria-label="실시간 음성 인식 모니터">',
            '  <div class="pbox-voice-live-hd">',
            '    <div class="pbox-voice-status-wrap">',
            '      <span id="pboxVoiceWave" class="pbox-voice-wave' + (state.voicePhase === 'speaking' ? ' speaking' : '') + '" aria-hidden="true">',
            '        <span class="pbox-vw-bar"></span><span class="pbox-vw-bar"></span><span class="pbox-vw-bar"></span><span class="pbox-vw-bar"></span>',
            '      </span>',
            '      <span id="pboxVoiceStatePill" class="pbox-voice-state-pill ' + meta.cls + '" role="status" aria-live="polite">' + esc(meta.text) + '</span>',
            '    </div>',
            '    <div class="pbox-btn-group">',
            '      <button type="button" class="pbox-btn-primary" data-act="finish-voice-review">🔍 바로 검색·검토</button>',
            '      <button type="button" class="pbox-btn-sm" data-act="keep-voice-text">✓ 입력창에 적용</button>',
            '      <button type="button" class="pbox-btn-sm" data-act="clear-voice-text">지우기</button>',
            '      <button type="button" class="pbox-btn-sm" data-act="cancel-voice-input">취소</button>',
            '    </div>',
            '  </div>',
            '  <div id="pboxVoiceLiveScreen" class="pbox-voice-live-screen" aria-live="polite">' + screenHtml + '</div>',
            '  <div class="pbox-voice-subnote">',
            '    <span>브라우저 음성인식 서비스를 통해 실시간 변환됩니다 · 주민번호·계좌번호·실명은 말하지 마세요 (변환 문장 자동 비식별)</span>',
            '  </div>',
            '</div>'
          ].join('\n');
          bannerSlot._voiceMounted = true;
        } else {
          if (waveEl && waveEl.classList) {
            if (state.voicePhase === 'speaking' || state.voicePhase === 'transcribing') waveEl.classList.add('speaking');
            else waveEl.classList.remove('speaking');
          }
          if (pillEl) {
            pillEl.className = 'pbox-voice-state-pill ' + meta.cls;
            if (pillEl.textContent !== meta.text) pillEl.textContent = meta.text;
          }
          if (scrEl && scrEl.innerHTML !== screenHtml) {
            scrEl.innerHTML = screenHtml;
          }
        }
      } else {
        bannerSlot._voiceMounted = false;
        if (bannerSlot.innerHTML) bannerSlot.innerHTML = '';
      }
    }
    var btns = document.querySelectorAll('[data-act="toggle-voice-input"]');
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i];
      var tgt = b.getAttribute('data-voice-target') || 'home';
      var isRec = state.voiceActive && state.voiceTarget === tgt;
      b.disabled = false;
      b.removeAttribute('aria-busy');
      if (isRec) {
        b.classList.add('recording');
        b.setAttribute('aria-pressed', 'true');
        b.textContent = '⏹ 음성완료·실행';
      } else {
        b.classList.remove('recording');
        b.setAttribute('aria-pressed', 'false');
        b.textContent = '🎤 음성설명';
      }
    }
  }

  function stopMicLevelProbe() {
    state._voiceMicProbeActive = false;
    state._voiceMicPeakLevel = 0;
    if (state._voiceMicTimer) {
      try { clearInterval(state._voiceMicTimer); } catch (_) {}
      state._voiceMicTimer = null;
    }
    if (state._voiceMicStream) {
      try {
        var tracks = state._voiceMicStream.getTracks ? state._voiceMicStream.getTracks() : [];
        for (var t = 0; t < tracks.length; t++) tracks[t].stop();
      } catch (_) {}
      state._voiceMicStream = null;
    }
    if (state._voiceAudioCtx) {
      try { state._voiceAudioCtx.close(); } catch (_) {}
      state._voiceAudioCtx = null;
    }
  }

  function startMicLevelProbe(mySeq) {
    stopMicLevelProbe();
    var nav = global && global.navigator;
    var AudioCtx = global && (global.AudioContext || global.webkitAudioContext);
    if (!nav || !nav.mediaDevices || typeof nav.mediaDevices.getUserMedia !== 'function' || typeof AudioCtx !== 'function') {
      return;
    }
    nav.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      if (!state.voiceActive || state._voiceStartSeq !== mySeq) {
        try { stream.getTracks().forEach(function (tr) { tr.stop(); }); } catch (_) {}
        return;
      }
      try {
        var actx = new AudioCtx();
        var src = actx.createMediaStreamSource(stream);
        var analyser = actx.createAnalyser();
        analyser.fftSize = 256;
        src.connect(analyser);
        var data = new Uint8Array(analyser.frequencyBinCount);
        state._voiceMicStream = stream;
        state._voiceAudioCtx = actx;
        state._voiceMicProbeActive = true;
        state._voiceMicPeakLevel = 0;
        var lastHadSound = false;
        state._voiceMicTimer = setInterval(function () {
          if (!state.voiceActive || state._voiceStartSeq !== mySeq) {
            stopMicLevelProbe();
            return;
          }
          analyser.getByteTimeDomainData(data);
          var sumSq = 0;
          for (var i = 0; i < data.length; i++) {
            var v = (data[i] - 128) / 128;
            sumSq += v * v;
          }
          var rms = Math.round(Math.sqrt(sumSq / data.length) * 100);
          if (rms > (state._voiceMicPeakLevel || 0)) state._voiceMicPeakLevel = rms;
          var hasSoundNow = (state._voiceMicPeakLevel || 0) >= 2;
          if (hasSoundNow !== lastHadSound && !state._voiceHasResult) {
            lastHadSound = hasSoundNow;
            syncVoiceUiDom();
          }
        }, 350);
        syncVoiceUiDom();
      } catch (_) {
        try { stream.getTracks().forEach(function (tr) { tr.stop(); }); } catch (_e) {}
      }
    }).catch(function () {});
  }

  function stopVoiceDictation(opts) {
    opts = opts || {};
    state._voiceStartSeq = (state._voiceStartSeq || 0) + 1;
    stopMicLevelProbe();
    if (state._voiceResultWatchdog) {
      try { clearTimeout(state._voiceResultWatchdog); } catch (_) {}
      state._voiceResultWatchdog = null;
    }
    if (state._voiceSilenceTimer) {
      try { clearTimeout(state._voiceSilenceTimer); } catch (_) {}
      state._voiceSilenceTimer = null;
    }
    if (state._voiceRestartTimer) {
      try { clearTimeout(state._voiceRestartTimer); } catch (_) {}
      state._voiceRestartTimer = null;
    }
    if (state._voicePhaseTimer) {
      try { clearTimeout(state._voicePhaseTimer); } catch (_) {}
      state._voicePhaseTimer = null;
    }
    if (state._voiceMaxTimer) {
      try { clearTimeout(state._voiceMaxTimer); } catch (_) {}
      state._voiceMaxTimer = null;
    }
    var rec = state._speechRec;
    state._speechRec = null;
    state._voiceRestartFn = null;
    state._voiceRawCommitted = '';
    state._voiceRawInterim = '';
    state._voiceHasResult = false;
    state._voiceStallRetries = 0;
    state.voiceActive = false;
    state.voicePhase = 'idle';
    state.voiceInterim = '';
    state.voiceNoSpeechCount = 0;
    if (rec) {
      try {
        rec.onstart = null;
        rec.onaudiostart = null;
        rec.onsoundstart = null;
        rec.onspeechstart = null;
        rec.onspeechend = null;
        rec.onsoundend = null;
        rec.onnomatch = null;
        rec.onresult = null;
        rec.onend = null;
        rec.onerror = null;
      } catch (_) {}
      try {
        if (opts.abort && typeof rec.abort === 'function') rec.abort();
        else if (typeof rec.stop === 'function') rec.stop();
      } catch (_) {}
    }
    if (!opts.skipDom) syncVoiceUiDom();
  }

  function currentCombinedVoiceText() {
    var tgt = state.voiceTarget || 'home';
    var inputEl = document.getElementById(tgt === 'ws' ? 'pboxWsFollowInput' : 'pboxPromptInput');
    var rawJoined = joinVoiceParts(
      joinVoiceParts(state.voiceBaseText, state._voiceRawCommitted || state.voiceCommittedText),
      state._voiceRawInterim !== undefined && state._voiceRawInterim !== '' ? state._voiceRawInterim : state.voiceInterim
    );
    var fallbackDraft = tgt === 'home' ? (state.homePromptDraft || '') : '';
    var raw = rawJoined || (inputEl && inputEl.value ? inputEl.value : '') || fallbackDraft;
    return scrubVoiceTranscript(raw).trim();
  }

  function finishVoiceAndAutoReview() {
    var tgt = state.voiceTarget || 'home';
    var inputEl = document.getElementById(tgt === 'ws' ? 'pboxWsFollowInput' : 'pboxPromptInput');
    var finalTxt = currentCombinedVoiceText();
    stopVoiceDictation({ skipDom: false });
    state.voiceBaseText = '';
    state.voiceCommittedText = '';
    if (!finalTxt) {
      toast('인식된 음성 내용이 없습니다. 마이크에 대고 다시 말씀해 주세요.', 'err');
      return;
    }
    if (inputEl) inputEl.value = finalTxt;
    toast('음성 인식 완료 · 검색 및 검토를 실행합니다.');
    if (tgt === 'ws') {
      syncWorkspaceEditorDraftIfPresent();
      var curTh = state.activeThread;
      var nonDefaultTitle = (curTh && curTh.title && curTh.title !== '새 문서 · 내용 검토' && curTh.title !== '새 문서 검토') ? curTh.title : '';
      runPromptSubmit(finalTxt, null, {
        inWorkspace: true,
        threadId: curTh ? curTh.id : '',
        mode: (curTh && curTh.mode) ? curTh.mode : 'review',
        sourceText: curTh ? (curTh.sourceText || '') : '',
        sourceFileName: curTh ? (curTh.sourceFileName || '') : '',
        customTitle: nonDefaultTitle
      });
    } else {
      state.homePromptDraft = '';
      runPromptSubmit(finalTxt, null, { mode: state.promptMode || 'auto' });
    }
  }

  function applyOrganizedVoiceToInput() {
    var tgt = state.voiceTarget || 'home';
    var inputEl = document.getElementById(tgt === 'ws' ? 'pboxWsFollowInput' : 'pboxPromptInput');
    var rawTxt = currentCombinedVoiceText();
    var E = global.PuPBoxEngine;
    if (!rawTxt) return;
    var lawIndex = (global.PuPBoxLawIndex && typeof global.PuPBoxLawIndex.list === 'function')
      ? global.PuPBoxLawIndex.list()
      : [];
    var organized = (E && typeof E.summarizeSpokenRequest === 'function')
      ? (E.summarizeSpokenRequest(rawTxt, lawIndex).organizedText || rawTxt)
      : rawTxt;
    stopVoiceDictation({ skipDom: false });
    state.voiceBaseText = '';
    state.voiceCommittedText = '';
    if (inputEl) {
      inputEl.value = organized;
      if (typeof inputEl.focus === 'function') inputEl.focus();
    }
    if (tgt === 'home') {
      state.homePromptDraft = organized;
      updateLiveFactReviewDom(organized);
    }
    toast('말씀하신 내용을 핵심 쟁점·사실관계 형식으로 정리해 입력창에 채웠습니다.');
  }

  function switchToWindowsVoiceInput() {
    var tgt = state.voiceTarget || 'home';
    var keepTxt = currentCombinedVoiceText();
    stopVoiceDictation({ abort: true });
    var inputEl = document.getElementById(tgt === 'ws' ? 'pboxWsFollowInput' : 'pboxPromptInput');
    if (inputEl) {
      if (keepTxt) inputEl.value = keepTxt;
      if (typeof inputEl.focus === 'function') inputEl.focus();
    }
    toast('입력창에 커서를 맞췄습니다. 키보드에서 [Win + H]를 누르면 Windows 음성입력이 바로 받아쓰기·자동정리됩니다.');
  }

  function keepVoiceTextAndClose() {
    var tgt = state.voiceTarget || 'home';
    var inputEl = document.getElementById(tgt === 'ws' ? 'pboxWsFollowInput' : 'pboxPromptInput');
    var finalTxt = currentCombinedVoiceText();
    stopVoiceDictation({ skipDom: false });
    state.voiceBaseText = '';
    state.voiceCommittedText = '';
    if (inputEl) {
      inputEl.value = finalTxt;
      if (typeof inputEl.focus === 'function') inputEl.focus();
    }
    if (tgt === 'home') {
      state.homePromptDraft = finalTxt;
      updateLiveFactReviewDom(finalTxt);
    }
    if (finalTxt) toast('음성 인식 내용을 입력창에 반영했습니다.');
  }

  function clearVoiceText() {
    if (!state.voiceActive) return;
    var tgt = state.voiceTarget || 'home';
    var inputEl = document.getElementById(tgt === 'ws' ? 'pboxWsFollowInput' : 'pboxPromptInput');
    state.voiceBaseText = '';
    state.voiceCommittedText = '';
    state.voiceInterim = '';
    state._voiceRawCommitted = '';
    state._voiceRawInterim = '';
    state.voicePhase = 'ready';
    if (inputEl) inputEl.value = '';
    if (tgt === 'home') {
      state.homePromptDraft = '';
      updateLiveFactReviewDom('');
    }
    syncVoiceUiDom();
    if (typeof state._voiceRestartFn === 'function') {
      state._voiceRestartFn(true);
    }
  }

  function cancelVoiceInput() {
    var tgt = state.voiceTarget || 'home';
    var restoreTxt = state.voiceBaseText || '';
    var inputEl = document.getElementById(tgt === 'ws' ? 'pboxWsFollowInput' : 'pboxPromptInput');
    stopVoiceDictation({ abort: true });
    state.voiceBaseText = '';
    state.voiceCommittedText = '';
    if (inputEl) {
      inputEl.value = restoreTxt;
      if (typeof inputEl.focus === 'function') inputEl.focus();
    }
    if (tgt === 'home') {
      state.homePromptDraft = restoreTxt;
      updateLiveFactReviewDom(restoreTxt);
    }
  }

  /* 브라우저 내장 실시간 음성인식(SpeechRecognition ko-KR, interimResults: true)
   * ⚠ 안내: 푸른 자체 서버로는 오디오 파일을 업로드·저장하지 않으나, Chrome·Edge·Safari 등 브라우저 내장 SpeechRecognition은
   *   브라우저 제공사 음성인식 서비스를 거쳐 글자로 변환되므로 세션 최초 시작 시 고지·동의를 받고 주민번호·실명 발화 금지를 안내한다.
   *   변환된 중간·확정·결합 문자열 전체에는 즉시 비식별화(scrubVoiceTranscript)를 적용한다. */
  function startVoiceDictation(targetKind) {
    var tgt = targetKind === 'ws' ? 'ws' : 'home';
    if (state.voiceActive) {
      if (state.voiceTarget === tgt) {
        finishVoiceAndAutoReview();
        return true;
      }
      stopVoiceDictation({ abort: true });
    }
    var SpeechCtor = (global && (global.SpeechRecognition || global.webkitSpeechRecognition)) || null;
    if (typeof SpeechCtor !== 'function') {
      toast('현재 브라우저는 실시간 음성인식을 지원하지 않습니다. 크롬·엣지·사파리를 사용하거나 키보드 음성입력(Win+H)을 이용해 주세요.', 'err');
      return false;
    }

    if (!state._voiceConsented) {
      if (!global || typeof global.confirm !== 'function') {
        toast('음성 입력 안내·동의 확인 창을 열 수 없어 음성 인식을 시작하지 않았습니다.', 'err');
        return false;
      }
      var agreed = global.confirm(
        '🎙 실시간 음성 입력 안내\n\n' +
        '음성 인식은 사용 중인 브라우저(Chrome·Edge·Safari 등)의 음성 인식 서비스를 통해 실시간으로 글자로 변환됩니다 (푸른 자체 서버에는 원본 음성을 저장하지 않습니다).\n' +
        '⚠ 주민등록번호·계좌번호·실명 등 민감 고유식별정보는 말로 부르지 마세요.\n\n' +
        '실시간 음성 입력을 시작할까요?'
      );
      if (!agreed) {
        toast('음성 입력을 취소했습니다.');
        return false;
      }
      state._voiceConsented = true;
    }

    var inputId = tgt === 'ws' ? 'pboxWsFollowInput' : 'pboxPromptInput';
    var startEl = document.getElementById(inputId);
    var initialBase = startEl && startEl.value ? scrubVoiceTranscript(startEl.value).trim() : '';

    var startGen = global.PuPBoxStore.getSessionGen ? global.PuPBoxStore.getSessionGen() : 0;
    var startUid = global.PuPBoxStore.getActiveUid ? global.PuPBoxStore.getActiveUid() : '';
    var mySeq = (state._voiceStartSeq = (state._voiceStartSeq || 0) + 1);
    var startedAtMs = Date.now();
    var restartCount = 0;

    state.voiceTarget = tgt;
    state.voiceBaseText = initialBase;
    state.voiceCommittedText = '';
    state.voiceInterim = '';
    state._voiceRawCommitted = '';
    state._voiceRawInterim = '';
    state.voiceNoSpeechCount = 0;
    state._voiceHasResult = false;
    state._voiceStallRetries = 0;
    state._voiceNonContinuous = false;
    state.voiceActive = true;
    state.voicePhase = 'connecting';
    syncVoiceUiDom();
    startMicLevelProbe(mySeq);

    function armResultWatchdog() {
      if (state._voiceResultWatchdog) {
        try { clearTimeout(state._voiceResultWatchdog); } catch (_) {}
        state._voiceResultWatchdog = null;
      }
      if (state._voiceHasResult || typeof setTimeout !== 'function') return;
      state._voiceResultWatchdog = setTimeout(function () {
        if (!state.voiceActive || state._voiceStartSeq !== mySeq || !isSameSession(startGen, startUid) || state._voiceHasResult) return;
        if ((state._voiceStallRetries || 0) < 1) {
          /* Windows Chrome에서 continuous:true가 글자 변환 없이 멈추는 현상 자동 복구 (단문 연속 모드로 1회 재연결) */
          state._voiceStallRetries = 1;
          state._voiceNonContinuous = true;
          launchSegment(true, true);
        } else {
          /* 2차 무응답 시 기존 인식기의 후속 onerror/onend가 stalled 안내창을 덮어쓰지 않도록 분리 중단 */
          var stalledRec = state._speechRec;
          state._speechRec = null;
          if (stalledRec) {
            try {
              stalledRec.onstart = null;
              stalledRec.onaudiostart = null;
              stalledRec.onsoundstart = null;
              stalledRec.onspeechstart = null;
              stalledRec.onspeechend = null;
              stalledRec.onsoundend = null;
              stalledRec.onnomatch = null;
              stalledRec.onresult = null;
              stalledRec.onend = null;
              stalledRec.onerror = null;
              if (typeof stalledRec.abort === 'function') stalledRec.abort();
            } catch (_) {}
          }
          state.voicePhase = 'stalled';
          syncVoiceUiDom();
        }
      }, 6000);
    }

    if (state._voiceMaxTimer) {
      try { clearTimeout(state._voiceMaxTimer); } catch (_) {}
    }
    if (typeof setTimeout === 'function') {
      state._voiceMaxTimer = setTimeout(function () {
        if (!state.voiceActive || state._voiceStartSeq !== mySeq || !isSameSession(startGen, startUid)) return;
        var hasSpokenMax = Boolean(joinVoiceParts(state.voiceBaseText, joinVoiceParts(state._voiceRawCommitted, state._voiceRawInterim)).trim());
        if (hasSpokenMax) {
          keepVoiceTextAndClose();
        } else {
          stopVoiceDictation({ skipDom: false });
          toast('최대 연속 음성입력 시간(2분)이 경과하여 마이크를 종료했습니다.');
        }
      }, 120000);
    }

    function writeLiveTranscriptToDom() {
      var rawFull = joinVoiceParts(joinVoiceParts(state.voiceBaseText, state._voiceRawCommitted), state._voiceRawInterim);
      var fullTxt = scrubVoiceTranscript(rawFull).trim();
      state.voiceCommittedText = scrubVoiceTranscript(state._voiceRawCommitted || '');
      state.voiceInterim = scrubVoiceTranscript(state._voiceRawInterim || '');
      var liveEl = document.getElementById(inputId);
      if (liveEl) {
        liveEl.value = fullTxt;
        try { liveEl.scrollTop = liveEl.scrollHeight; } catch (_) {}
      }
      if (tgt === 'home') {
        state.homePromptDraft = fullTxt;
        updateLiveFactReviewDom(fullTxt);
      }
      syncVoiceUiDom();
    }

    function launchSegment(forceFresh, nonContinuousFallback) {
      if (!state.voiceActive || state._voiceStartSeq !== mySeq || !isSameSession(startGen, startUid)) return false;
      if (state._voiceRestartTimer) {
        try { clearTimeout(state._voiceRestartTimer); } catch (_) {}
        state._voiceRestartTimer = null;
      }
      if (forceFresh && state._speechRec) {
        var prevRec = state._speechRec;
        state._speechRec = null;
        try {
          prevRec.onstart = null;
          prevRec.onaudiostart = null;
          prevRec.onsoundstart = null;
          prevRec.onspeechstart = null;
          prevRec.onspeechend = null;
          prevRec.onsoundend = null;
          prevRec.onnomatch = null;
          prevRec.onresult = null;
          prevRec.onend = null;
          prevRec.onerror = null;
          if (typeof prevRec.abort === 'function') prevRec.abort();
        } catch (_) {}
      }

      var rec;
      try {
        rec = new SpeechCtor();
      } catch (eInit) {
        stopVoiceDictation({ abort: true });
        toast('마이크 음성인식을 초기화할 수 없습니다: ' + eInit.message, 'err');
        return false;
      }

      rec.lang = 'ko-KR';
      rec.continuous = !nonContinuousFallback;
      rec.interimResults = true;
      try { rec.maxAlternatives = 1; } catch (_) {}

      var segFinal = '';
      var segInterim = '';
      var fatalErr = false;
      var rawCommittedBeforeSeg = state._voiceRawCommitted || '';
      state._speechRec = rec;

      rec.onstart = function () {
        if (!state.voiceActive || state._voiceStartSeq !== mySeq || !isSameSession(startGen, startUid)) return;
        if (state.voicePhase === 'connecting' || state.voicePhase === 'stalled') {
          state.voicePhase = (state._voiceRawCommitted || state.voiceBaseText) ? 'recognized' : 'ready';
          syncVoiceUiDom();
        }
        armResultWatchdog();
      };

      rec.onaudiostart = function () {
        if (!state.voiceActive || state._voiceStartSeq !== mySeq || !isSameSession(startGen, startUid)) return;
        if (state.voicePhase === 'connecting') {
          state.voicePhase = (state._voiceRawCommitted || state.voiceBaseText) ? 'recognized' : 'ready';
          syncVoiceUiDom();
        }
      };

      rec.onsoundstart = function () {
        if (!state.voiceActive || state._voiceStartSeq !== mySeq || !isSameSession(startGen, startUid)) return;
        if (!state._voiceHasResult) {
          state.voicePhase = 'speaking';
          syncVoiceUiDom();
          armResultWatchdog();
        }
      };

      rec.onspeechstart = function () {
        if (!state.voiceActive || state._voiceStartSeq !== mySeq || !isSameSession(startGen, startUid)) return;
        state.voicePhase = state._voiceHasResult ? 'transcribing' : 'speaking';
        syncVoiceUiDom();
        armResultWatchdog();
      };

      rec.onresult = function (ev) {
        if (!state.voiceActive || state._voiceStartSeq !== mySeq || !isSameSession(startGen, startUid)) return;
        var accFin = '';
        var accInt = '';
        var resList = (ev && ev.results) ? ev.results : [];
        for (var i = 0; i < resList.length; i++) {
          var r = resList[i];
          var alt = r && r[0] ? String(r[0].transcript || '').trim() : '';
          if (!alt) continue;
          if (r.isFinal) {
            if (accFin && alt.length > accFin.length && alt.indexOf(accFin) === 0) {
              accFin = alt;
            } else {
              accFin = joinVoiceParts(accFin, alt);
            }
          } else {
            accInt = joinVoiceParts(accInt, alt);
          }
        }
        segFinal = accFin;
        segInterim = accInt;
        if (segFinal || segInterim) {
          state.voiceNoSpeechCount = 0;
          state._voiceHasResult = true;
          if (state._voiceResultWatchdog) {
            try { clearTimeout(state._voiceResultWatchdog); } catch (_) {}
            state._voiceResultWatchdog = null;
          }
        }
        state._voiceRawCommitted = joinVoiceParts(rawCommittedBeforeSeg, segFinal);
        state._voiceRawInterim = segInterim;
        state.voicePhase = (segFinal || segInterim) ? 'transcribing' : 'speaking';
        writeLiveTranscriptToDom();

        if (state._voicePhaseTimer) {
          try { clearTimeout(state._voicePhaseTimer); } catch (_) {}
        }
        if (!segInterim && (state._voiceRawCommitted || state.voiceBaseText) && typeof setTimeout === 'function') {
          state._voicePhaseTimer = setTimeout(function () {
            if (state.voiceActive && state._voiceStartSeq === mySeq && !state._voiceRawInterim) {
              state.voicePhase = 'recognized';
              syncVoiceUiDom();
            }
          }, 900);
        }
      };

      rec.onspeechend = function () {
        if (!state.voiceActive || state._voiceStartSeq !== mySeq || !isSameSession(startGen, startUid)) return;
        if (!state._voiceRawInterim && (state._voiceRawCommitted || state.voiceBaseText)) {
          state.voicePhase = 'recognized';
          syncVoiceUiDom();
        }
      };

      rec.onerror = function (errEv) {
        if (!state.voiceActive || state._voiceStartSeq !== mySeq) return;
        var code = String((errEv && errEv.error) || '');
        if (code === 'aborted') return;
        if (code === 'no-speech') {
          state.voiceNoSpeechCount = (state.voiceNoSpeechCount || 0) + 1;
          if (!state._voiceRawCommitted && !state.voiceBaseText) {
            state.voicePhase = 'ready';
            syncVoiceUiDom();
          }
          return;
        }
        fatalErr = true;
        stopVoiceDictation({ abort: true });
        if (code === 'not-allowed' || code === 'service-not-allowed') {
          toast('마이크 권한이 차단되어 있습니다. 브라우저 주소창 왼쪽 자물쇠/마이크 아이콘에서 권한을 허용해 주세요.', 'err');
        } else if (code === 'audio-capture') {
          toast('연결된 마이크를 찾을 수 없습니다. 마이크 연결 상태와 Windows 소리 입력 장치를 확인해 주세요.', 'err');
        } else if (code === 'network') {
          toast('음성 인식 네트워크 연결이 고르지 않습니다. 잠시 후 다시 시도하거나 키보드 음성입력(Win+H)을 이용해 주세요.', 'err');
        } else {
          toast('음성 인식 안내: ' + (code || '마이크 입력을 확인해 주세요.'), 'err');
        }
      };

      rec.onend = function () {
        if (!state.voiceActive || state._voiceStartSeq !== mySeq || !isSameSession(startGen, startUid)) return;
        if (segFinal || segInterim) {
          state._voiceRawCommitted = joinVoiceParts(rawCommittedBeforeSeg, joinVoiceParts(segFinal, segInterim));
          state._voiceRawInterim = '';
        }
        if (fatalErr) {
          stopVoiceDictation({ skipDom: false });
          return;
        }
        var canContinue = state.voiceNoSpeechCount < 3 && restartCount < 12 && (Date.now() - startedAtMs) < 120000 && typeof setTimeout === 'function';
        if (canContinue) {
          state.voicePhase = (state._voiceRawCommitted || state.voiceBaseText) ? 'recognized' : 'ready';
          writeLiveTranscriptToDom();
          restartCount++;
          state._voiceRestartTimer = setTimeout(function () {
            launchSegment(false, Boolean(state._voiceNonContinuous));
          }, 120);
        } else {
          var hasSpoken = Boolean(joinVoiceParts(state.voiceBaseText, state._voiceRawCommitted).trim());
          if (hasSpoken) {
            keepVoiceTextAndClose();
          } else {
            stopVoiceDictation({ skipDom: false });
            toast('일정 시간 말씀이 없어 마이크를 자동으로 종료했습니다.');
          }
        }
      };

      try {
        rec.start();
      } catch (startErr) {
        stopVoiceDictation({ abort: true });
        toast('마이크 시작 오류: ' + startErr.message, 'err');
        return false;
      }
      return true;
    }

    state._voiceRestartFn = launchSegment;
    return launchSegment(false);
  }

  /* ── [법령 · 판례 · 결정례 · 행정해석/유권해석] 4대 근거 한번에 보기 공통 보드 렌더러 ── */
  function buildUnifiedAuthoritiesHtml(searchRes, rawQuery, opts) {
    opts = opts || {};
    var E = global.PuPBoxEngine;
    if (!searchRes) return '';
    var uni = searchRes.unified || (E && typeof E.groupUnifiedAuthorities === 'function'
      ? E.groupUnifiedAuthorities(searchRes, { ragLimit: 8 })
      : null);
    if (!uni) return '';

    var isTabbed = !!opts.tabbed;
    var activeAuthTab = isTabbed ? (state.wsAuthTab || 'all') : 'all';
    var maxPerCol = isTabbed ? (activeAuthTab === 'all' ? 2 : 8) : (opts.maxPerCol || 4);
    var hlTerms = (E && typeof E.extractHighlightTerms === 'function')
      ? E.extractHighlightTerms(rawQuery || '', '')
      : [];

    var lawArts = (uni.laws && Array.isArray(uni.laws.articles)) ? uni.laws.articles.slice(0, maxPerCol) : [];
    var lawFams = (uni.laws && Array.isArray(uni.laws.families)) ? uni.laws.families.slice(0, Math.max(0, maxPerCol - lawArts.length)) : [];
    var precs = (uni.precedents || []).slice(0, maxPerCol);
    var decs = (uni.decisions || []).slice(0, maxPerCol);
    var interps = (uni.interpretations || []).slice(0, maxPerCol);

    var safeCollectQ = '';
    if (E && typeof E.classifyPromptIntent === 'function') {
      var intentObj = E.classifyPromptIntent(rawQuery || '', global.PuPBoxLawIndex ? global.PuPBoxLawIndex.list() : []);
      safeCollectQ = intentObj.safeOfficialQuery || '';
    }

    function renderDocColItems(arr, emptyText) {
      if (!arr.length) {
        return '<div class="pbox-empty-mini">' + esc(emptyText) + '</div>';
      }
      return arr.map(function (d) {
        var metaParts = [d.court || d.agency || '', d.caseNo || '', d.decisionDate || ''].filter(Boolean);
        return '<div class="pbox-unified-item" role="button" tabindex="0" data-act="open-doc" data-id="' + esc(d.id) + '" title="' + esc(d.title) + '">' +
          '<div class="pbox-unified-item-title">' + highlightHtml(d.title, hlTerms) + '</div>' +
          '<div class="pbox-unified-item-top">' +
            '<span class="pbox-mono">' + highlightHtml(metaParts.join(' · '), hlTerms) + '</span>' +
            '<span class="' + docTypeBadgeClass(d.docType) + '">' + esc(docTypeBadgeLabel(d.docType)) + '</span>' +
          '</div>' +
          (d.summary ? ('<div class="pbox-unified-item-sum">' + highlightHtml(d.summary, hlTerms) + '</div>') : '') +
        '</div>';
      }).join('');
    }

    var lawItemsHtml = '';
    if (lawArts.length || lawFams.length) {
      lawItemsHtml = lawArts.map(function (a) {
        return '<div class="pbox-unified-item" role="button" tabindex="0" data-act="open-law" data-dir="' + esc(a.lawDir) + '" data-file="' + esc(a.fileName) + '" data-art="' + esc(a.articleNo) + '">' +
          '<div class="pbox-unified-item-title">' + highlightHtml(a.lawTitle + ' ' + a.articleNo + (a.heading ? '(' + a.heading + ')' : ''), hlTerms) + '</div>' +
          '<div class="pbox-unified-item-top"><span>' + esc(a.effectiveDate || '시행중') + '</span><span class="pbox-badge-blue">현행 조문</span></div>' +
          (a.snippet ? ('<div class="pbox-unified-item-sum">' + highlightHtml(a.snippet, hlTerms) + '</div>') : '') +
        '</div>';
      }).concat(lawFams.map(function (f) {
        return '<div class="pbox-unified-item" role="button" tabindex="0" data-act="open-law" data-dir="' + esc(f.dir) + '" data-file="' + esc(f.primaryFile) + '">' +
          '<div class="pbox-unified-item-title">' + highlightHtml(f.title, hlTerms) + '</div>' +
          '<div class="pbox-unified-item-top"><span>' + esc(f.dept || '범부처') + '</span><span class="pbox-badge-gray">국가법령</span></div>' +
        '</div>';
      })).join('');
    } else {
      lawItemsHtml = '<div class="pbox-empty-mini">관련 국가법령을 좌측 「국가법령 전수함」에서 열람하면 조문 단위까지 대조됩니다.</div>';
    }

    var liveDisabled = state.liveCollectBusy ? ' disabled aria-busy="true"' : '';
    var gridCls = 'pbox-unified-grid' + (opts.twoCol ? ' two-col' : '');
    var rawConnHtml = buildConnectedLawsBarHtml(searchRes && searchRes.connectedLaws, {
      label: '🔗 노동 연결 · 유사직역 법령 함께 비교',
      openInReader: true
    });
    var isPublicSectorQuery = /(?:공무원|군인|교원|사학|선원|경찰|소방|별정직|지방직|국가직)/.test(String(rawQuery || ''));
    var connLawsHtml = rawConnHtml
      ? (isTabbed && !isPublicSectorQuery
        ? ('<details class="pbox-conn-details"><summary><span>🔗 유사직역(공무원·군인·교원) 법령 비교</span><span>펼쳐보기 ▾</span></summary>' + rawConnHtml + '</details>')
        : rawConnHtml)
      : '';

    var bodyGridHtml = '';
    if (isTabbed) {
      var authTabs = [
        { id: 'all', label: '핵심 요약' },
        { id: 'precedents', label: '판례 (' + uni.counts.precedents + ')' },
        { id: 'laws', label: '법령 (' + uni.counts.laws + ')' },
        { id: 'interpretations', label: '행정해석 (' + uni.counts.interpretations + ')' },
        { id: 'decisions', label: '결정례 (' + uni.counts.decisions + ')' }
      ];
      var tabsHtml = '<div class="pbox-auth-tabs" role="tablist" aria-label="관련 근거 분류 탭">' +
        authTabs.map(function (t) {
          var isAct = activeAuthTab === t.id;
          return '<button type="button" role="tab" aria-selected="' + (isAct ? 'true' : 'false') + '" class="pbox-auth-tab' + (isAct ? ' active' : '') + '" data-act="set-ws-auth-tab" data-tab="' + t.id + '">' + esc(t.label) + '</button>';
        }).join('') +
      '</div>';

      var sections = [];
      if (activeAuthTab === 'all' || activeAuthTab === 'precedents') {
        sections.push(
          '<div class="pbox-auth-sec">' +
            '<div class="pbox-auth-sec-hd"><span>🏛️ 대법원 · 헌재 · 하급심 판례 (' + uni.counts.precedents + '건)</span>' +
              (activeAuthTab === 'all' && uni.counts.precedents > 2 ? '<button type="button" class="pbox-auth-more-btn" data-act="set-ws-auth-tab" data-tab="precedents">더보기 →</button>' : '') +
            '</div>' +
            renderDocColItems(precs, '일치 판례 없음 — 상단 실시간 추가수집으로 조회 가능') +
          '</div>'
        );
      }
      if (activeAuthTab === 'all' || activeAuthTab === 'laws') {
        sections.push(
          '<div class="pbox-auth-sec">' +
            '<div class="pbox-auth-sec-hd"><span>📖 현행 법령 · 조문 (' + uni.counts.laws + '건)</span>' +
              (activeAuthTab === 'all' && uni.counts.laws > 2 ? '<button type="button" class="pbox-auth-more-btn" data-act="set-ws-auth-tab" data-tab="laws">더보기 →</button>' : '') +
            '</div>' +
            lawItemsHtml +
          '</div>'
        );
      }
      if (activeAuthTab === 'all' || activeAuthTab === 'interpretations') {
        sections.push(
          '<div class="pbox-auth-sec">' +
            '<div class="pbox-auth-sec-hd"><span>📜 노동부 · 법제처 행정·유권해석 (' + uni.counts.interpretations + '건)</span>' +
              (activeAuthTab === 'all' && uni.counts.interpretations > 2 ? '<button type="button" class="pbox-auth-more-btn" data-act="set-ws-auth-tab" data-tab="interpretations">더보기 →</button>' : '') +
            '</div>' +
            renderDocColItems(interps, '일치 행정해석 없음 — 실시간 추가수집 가능') +
          '</div>'
        );
      }
      if (activeAuthTab === 'all' || activeAuthTab === 'decisions') {
        sections.push(
          '<div class="pbox-auth-sec">' +
            '<div class="pbox-auth-sec-hd"><span>⚖️ 노동위 · 산재 · 행심 결정례 (' + uni.counts.decisions + '건)</span>' +
              (activeAuthTab === 'all' && uni.counts.decisions > 2 ? '<button type="button" class="pbox-auth-more-btn" data-act="set-ws-auth-tab" data-tab="decisions">더보기 →</button>' : '') +
            '</div>' +
            renderDocColItems(decs, '일치 위원회 재결례 없음 — 실시간 추가수집 가능') +
          '</div>'
        );
      }
      bodyGridHtml = tabsHtml + '<div class="pbox-auth-list">' + sections.join('') + '</div>';
    } else {
      bodyGridHtml = [
        '  <div class="' + gridCls + '">',
        '    <div class="pbox-unified-col">',
        '      <div class="pbox-unified-col-hd"><span>📖 현행 법령 · 조문</span><span class="pbox-muted">' + uni.counts.laws + '건</span></div>',
        lawItemsHtml,
        '    </div>',
        '    <div class="pbox-unified-col">',
        '      <div class="pbox-unified-col-hd"><span>🏛️ 대법원 · 헌재 · 하급심 판례</span><span class="pbox-muted">' + uni.counts.precedents + '건</span></div>',
        renderDocColItems(precs, '일치 판례 없음 — 상단 실시간 추가수집으로 조회 가능'),
        '    </div>',
        '    <div class="pbox-unified-col">',
        '      <div class="pbox-unified-col-hd"><span>⚖️ 노동위 · 산재 · 행심 결정례</span><span class="pbox-muted">' + uni.counts.decisions + '건</span></div>',
        renderDocColItems(decs, '일치 위원회 재결례 없음 — 실시간 추가수집 가능'),
        '    </div>',
        '    <div class="pbox-unified-col">',
        '      <div class="pbox-unified-col-hd"><span>📜 노동부 · 법제처 행정·유권해석</span><span class="pbox-muted">' + uni.counts.interpretations + '건</span></div>',
        renderDocColItems(interps, '일치 행정해석 없음 — 실시간 추가수집 가능'),
        '    </div>',
        '  </div>'
      ].join('\n');
    }

    return [
      '<section class="pbox-unified-board" aria-label="법령 판례 결정례 행정해석 한번에 보기">',
      '  <div class="pbox-unified-hd">',
      '    <div class="pbox-unified-title">',
      '      <span>📚 ' + esc(opts.heading || '법령 · 판례 · 결정례 · 행정해석(유권해석) 한번에 보기') + '</span>',
      (!isTabbed ? (
        '      <span class="pbox-badge-blue">법령 ' + uni.counts.laws + '</span>' +
        '      <span class="pbox-badge-green">판례 ' + uni.counts.precedents + '</span>' +
        '      <span class="pbox-badge-amber">결정례 ' + uni.counts.decisions + '</span>' +
        '      <span class="pbox-badge-gray">행정·유권해석 ' + uni.counts.interpretations + '</span>'
      ) : ''),
      '    </div>',
      '    <div class="pbox-btn-group">',
      (safeCollectQ
        ? ('<button type="button" class="pbox-btn-live" data-act="live-collect-unified" data-q="' + esc(safeCollectQ) + '"' + liveDisabled + '>' +
             (state.liveCollectBusy ? '⏳ 전 기관 수집 중…' : '⚡ 추가수집') +
           '</button>')
        : ''),
      (!opts.inCasesView && safeCollectQ
        ? ('<button type="button" class="pbox-btn-sm" data-act="jump-cases-query" data-q="' + esc(safeCollectQ) + '">🔍 표 전체보기</button>')
        : ''),
      '    </div>',
      '  </div>',
      connLawsHtml,
      bodyGridHtml,
      '</section>'
    ].join('\n');
  }

  function buildConnectedLawsBarHtml(connList, opts) {
    if (!Array.isArray(connList) || !connList.length) return '';
    opts = opts || {};
    var chips = connList.slice(0, opts.max || 8).map(function (cl) {
      var tip = (cl.group ? ('[' + cl.group + '] ') : '') + (cl.note || cl.topic || cl.title);
      if (opts.openInReader !== false) {
        return '<button type="button" class="pbox-conn-chip" data-act="open-law" data-dir="' + esc(cl.dir) + '" data-file="' + esc(cl.fileName || '') + '" title="' + esc(tip) + '">' +
          '<span class="pbox-conn-grp">' + esc(cl.group || '연결') + '</span>' +
          '<span>' + esc(cl.title) + '</span>' +
        '</button>';
      }
      return '<button type="button" class="pbox-conn-chip" data-act="jump-laws-query" data-q="' + esc(cl.title) + '" title="' + esc(tip) + '">' +
        '<span class="pbox-conn-grp">' + esc(cl.group || '연결') + '</span>' +
        '<span>' + esc(cl.title) + '</span>' +
      '</button>';
    }).join('');
    return '<div class="pbox-conn-law-bar" role="region" aria-label="노동 연결 및 유사직역 비교 법령">' +
      '<span class="pbox-conn-kicker">' + esc(opts.label || '🔗 연결 · 유사직역 법령') + '</span>' +
      '<div class="pbox-conn-chips">' + chips + '</div>' +
    '</div>';
  }

  /* ── 홈 입력창 스마트 자동제안 · 준비상태 막대 (엘박스·Westlaw식 단문 자동완성 — 4열 카드벽·우측리더 간섭 제거) ── */
  function buildLiveFactReviewHtml(rawText) {
    var trimmed = String(rawText || '').trim();
    if (trimmed.length < 2) return '';
    if (state._assistDismissedDraft && state._assistDismissedDraft === trimmed) return '';

    var E = global.PuPBoxEngine;
    if (!E || typeof E.analyzeFactPatternInstant !== 'function') return '';

    var analysis = E.analyzeFactPatternInstant(trimmed, {
      docs: global.PuPBoxStore.getDocs(),
      loadedLaws: global.PuPBoxStore.getLoadedLaws(),
      lawIndex: global.PuPBoxLawIndex ? global.PuPBoxLawIndex.list() : []
    });
    if (!analysis || analysis.empty) return '';

    if (state.hideHomeAssist) {
      if (analysis.maskedCount > 0) {
        return '<div class="pbox-calm-assist compact-only" role="status">' +
          '<span class="pbox-badge-green">개인정보 자동 비식별 ' + analysis.maskedCount + '건 적용됨</span>' +
          '<button type="button" class="pbox-link-btn" data-act="toggle-home-assist">자동제안 켜기</button>' +
        '</div>';
      }
      return '';
    }

    var searchRes = analysis.searchRes || {};
    var uni = analysis.unified || searchRes.unified || { counts: { laws: 0, precedents: 0, decisions: 0, interpretations: 0 } };
    var uCounts = uni.counts || { laws: 0, precedents: 0, decisions: 0, interpretations: 0 };
    var smartJump = searchRes.smartLawJump || null;
    var connLaws = Array.isArray(searchRes.connectedLaws) ? searchRes.connectedLaws : [];
    var issues = analysis.matchedIssues || [];
    var cFindings = (analysis.clauseDiag && analysis.clauseDiag.findings) || [];
    var isFact = !!(analysis.intent && analysis.intent.isFactNarrative);
    var safeDisplayQ = String(analysis.safeText || trimmed).replace(/\s+/g, ' ').trim();
    var shortQ = safeDisplayQ.length > 36 ? (safeDisplayQ.slice(0, 36) + '…') : safeDisplayQ;

    var pillarsLineHtml = [
      '<div class="pbox-assist-pillars">',
      '  <span class="pbox-pillar-pill">📖 현행 법령 · 조문 <b>' + uCounts.laws + '</b>건</span>',
      '  <span class="pbox-pillar-pill">🏛️ 대법원 · 헌재 · 하급심 판례 <b>' + uCounts.precedents + '</b>건</span>',
      '  <span class="pbox-pillar-pill">⚖️ 노동위 · 산재 · 행심 결정례 <b>' + uCounts.decisions + '</b>건</span>',
      '  <span class="pbox-pillar-pill">📜 노동부 · 법제처 행정·유권해석 <b>' + uCounts.interpretations + '</b>건</span>',
      '</div>'
    ].join('');

    /* 1) 사실관계 서술 · 계약조항 · 음성설명: 카드 요동 없이 2줄 준비상태 안내만 차분하게 표시 */
    if (isFact) {
      var leadTitle = issues.length
        ? ('✦ 자동 쟁점 포섭: ' + issues[0].title)
        : (cFindings.length
            ? ('✦ 자동 쟁점 포섭: 계약·규정 위험조항 ' + cFindings.length + '건 감지 (' + cFindings[0].title + ')')
            : '✦ 자동 쟁점 포섭: 사실관계 · 법리 종합 검토 준비 완료');
      var extraIssueBadge = issues.length > 1
        ? (' <span class="pbox-badge-blue">외 +' + (issues.length - 1) + '개 쟁점</span>')
        : '';
      var piiBadge = analysis.maskedCount > 0
        ? (' <span class="pbox-badge-green">개인정보 자동 비식별 ' + analysis.maskedCount + '건</span>')
        : '';

      return [
        '<div class="pbox-calm-assist fact-mode" role="region" aria-label="실시간 사실관계 자동 검토 준비상태">',
        '  <div class="pbox-calm-hd">',
        '    <div class="pbox-calm-title">' + esc(leadTitle) + extraIssueBadge + piiBadge + '</div>',
        '    <div class="pbox-btn-group">',
        '      <button type="button" class="pbox-btn-primary" data-act="submit-prompt">✦ 검토 워크스페이스 열기 (Enter)</button>',
        '      <button type="button" class="pbox-link-btn" data-act="toggle-home-assist" title="자동제안 숨기기">자동제안 숨김</button>',
        '    </div>',
        '  </div>',
        '  <div class="pbox-calm-foot">',
        pillarsLineHtml,
        '    <span class="pbox-assist-calm-note">문장을 끝까지 입력한 뒤 Enter를 누르면 전체 화면에서 대조합니다</span>',
        '  </div>',
        '</div>'
      ].join('\n');
    }

    /* 2) 키워드 · 사건번호 · 법령명 입력: 엘박스/Westlaw식 단문 자동완성 목록 (홈 위에 우측 리더 창을 띄우지 않음) */
    var acRows = [];
    acRows.push(
      '<button type="button" role="option" aria-selected="true" class="pbox-ac-row primary" data-act="jump-cases-query" data-q="' + esc(safeDisplayQ) + '">' +
        '<span class="pbox-ac-main"><span class="pbox-ac-ico" aria-hidden="true">🔍</span><strong>&ldquo;' + esc(shortQ) + '&rdquo;</strong> 통합검색 결과 · 4대 근거 화면 열기</span>' +
        '<span class="pbox-ac-kbd">Enter · 검색</span>' +
      '</button>'
    );

    if (smartJump) {
      acRows.push(
        '<button type="button" role="option" aria-selected="false" class="pbox-ac-row" data-act="jump-laws-query" data-q="' + esc(smartJump.displayLaw || smartJump.title || safeDisplayQ) + '">' +
          '<span class="pbox-ac-main"><span class="pbox-ac-ico" aria-hidden="true">📖</span>국가법령 전수함에서 열기: <strong>' + esc(smartJump.label) + '</strong></span>' +
          '<span class="pbox-ac-kbd">법령전수함</span>' +
        '</button>'
      );
    }

    acRows.push(
      '<button type="button" role="option" aria-selected="false" class="pbox-ac-row" data-act="run-home-review" data-q="' + esc(safeDisplayQ) + '">' +
        '<span class="pbox-ac-main"><span class="pbox-ac-ico" aria-hidden="true">✦</span><strong>&ldquo;' + esc(shortQ) + '&rdquo;</strong> AI 법리·내용 검토 의견서 작성</span>' +
        '<span class="pbox-ac-kbd">내용검토</span>' +
      '</button>'
    );

    if (connLaws.length > 0) {
      var connPreviewNames = connLaws.slice(0, 4).map(function (c) { return c.title; }).join(' · ');
      var targetCat = connLaws.some(function (c) { return c.cat === 'public_mil'; }) ? 'public_mil' : 'priority';
      acRows.push(
        '<button type="button" role="option" aria-selected="false" class="pbox-ac-row" data-act="jump-laws-cat" data-cat="' + esc(targetCat) + '">' +
          '<span class="pbox-ac-main"><span class="pbox-ac-ico" aria-hidden="true">🔗</span>연결·유사직역 법령 비교: <strong>' + esc(connPreviewNames) + '</strong></span>' +
          '<span class="pbox-ac-kbd">연결법령 ' + connLaws.length + '편</span>' +
        '</button>'
      );
    }

    return [
      '<div class="pbox-calm-assist" role="region" aria-label="스마트 검색 및 검토 실행 선택">',
      '  <div class="pbox-calm-hd">',
      '    <div class="pbox-calm-title">',
      '      <span>⚡ 실행 선택</span>',
      (issues.length ? (' <span class="pbox-badge-blue">쟁점인식: ' + esc(issues[0].canonicalQuery) + '</span>') : ''),
      (analysis.maskedCount > 0 ? (' <span class="pbox-badge-green">개인정보 자동 비식별 ' + analysis.maskedCount + '건</span>') : ''),
      '    </div>',
      '    <div class="pbox-btn-group">',
      '      <span class="pbox-assist-calm-note">↓↑ 이동 · Esc 닫기</span>',
      '      <button type="button" class="pbox-link-btn" data-act="toggle-home-assist">자동제안 숨김</button>',
      '    </div>',
      '  </div>',
      '  <div class="pbox-ac-list" role="listbox" aria-label="검색 및 검토 실행 항목">',
      acRows.join('\n'),
      '  </div>',
      '  <div class="pbox-calm-foot">' + pillarsLineHtml + '</div>',
      '</div>'
    ].join('\n');
  }

  function updateLiveFactReviewDom(rawText) {
    var slot = document.getElementById('pboxLiveFactReview');
    if (!slot) return;
    var nextHtml = buildLiveFactReviewHtml(rawText);
    if (slot.innerHTML === nextHtml) return;
    slot.innerHTML = nextHtml;
  }

  /* ── 뷰 전환 및 앱바 화면 기억 ── */
  function switchView(nextView) {
    if (state.view !== nextView) {
      stopVoiceDictation({ abort: true, skipDom: true });
      clearLiveFactTimer();
      clearViewSelections();
    }
    state.view = nextView;
    try {
      if (global.PuAppBar && global.PuAppBar.mark) global.PuAppBar.mark(nextView);
    } catch (e) {}
    closeMobileSidebar();
    renderMain();
    renderSidebarNavState();
    renderSidebarRecents();
  }

  /* 모바일(<=768px) 닫힌 오프캔버스 사이드바를 키보드 Tab 순서 및 스크린리더 탐색 트리에서 완전 분리 */
  function syncMobileSidebarA11y() {
    var sb = document.getElementById('pboxSidePanel');
    var openBtn = document.querySelector('[data-act="open-mobile-nav"]');
    if (!sb) return;
    var isMobile = !!(global.innerWidth && global.innerWidth <= 768);
    var isOpen = sb.classList.contains('mobile-open');
    if (openBtn) {
      openBtn.setAttribute('aria-controls', 'pboxSidePanel');
      openBtn.setAttribute('aria-expanded', (isMobile && isOpen) ? 'true' : 'false');
    }
    if (isMobile && !isOpen) {
      sb.setAttribute('aria-hidden', 'true');
      sb.setAttribute('inert', '');
      try { sb.inert = true; } catch (_) {}
    } else {
      sb.removeAttribute('aria-hidden');
      sb.removeAttribute('inert');
      try { sb.inert = false; } catch (_) {}
    }
  }

  function openMobileSidebar() {
    var sb = document.getElementById('pboxSidePanel');
    var bd = document.getElementById('pboxSideBackdrop');
    if (sb) sb.classList.add('mobile-open');
    if (bd) bd.classList.add('show');
    syncMobileSidebarA11y();
    var closeBtn = sb && sb.querySelector('[data-act="close-mobile-nav"]');
    if (closeBtn && typeof closeBtn.focus === 'function') closeBtn.focus();
  }

  function closeMobileSidebar() {
    var sb = document.getElementById('pboxSidePanel');
    var bd = document.getElementById('pboxSideBackdrop');
    var openBtn = document.querySelector('[data-act="open-mobile-nav"]');
    var hadFocusInside = !!(sb && typeof document !== 'undefined' && document.activeElement && sb.contains(document.activeElement));
    if (sb) sb.classList.remove('mobile-open');
    if (bd) bd.classList.remove('show');
    if (hadFocusInside && openBtn && typeof openBtn.focus === 'function') {
      openBtn.focus();
    }
    syncMobileSidebarA11y();
  }

  /* ── 오른쪽 분할 리더 열기/닫기 (법령 열람 시 활성 답변의 미로드 조문 배지도 즉시 재검증) ── */
  function reverifyActiveThreadIfAny() {
    if (!state.activeThread || !state.activeThread.answer) return;
    var E = global.PuPBoxEngine;
    var idxList = global.PuPBoxLawIndex ? global.PuPBoxLawIndex.list() : [];
    var vf = E.verifyCitations(state.activeThread.answer, {
      docs: global.PuPBoxStore.getDocs(),
      loadedLaws: global.PuPBoxStore.getLoadedLaws(),
      lawIndex: idxList
    });
    state.activeThread.verification = vf;
    global.PuPBoxStore.saveThread(state.activeThread);
    if (state.view === 'home' || state.view === 'workspace') renderMain();
  }

  function resolve3DanTargets(fam) {
    if (!fam || !Array.isArray(fam.files)) return [];
    var active = fam.files.filter(function (fn) {
      return !(fam.hasRepealStub && fn === '법률');
    });
    if (active.length < 2) return [];
    var picked = [];
    function pickFirst(label, re) {
      var found = active.find(function (fn) { return re.test(fn); });
      if (found) picked.push({ label: label, fileName: found + '.md' });
    }
    pickFirst('법률', /^법률(?:\(법률\))?$/);
    pickFirst('시행령', /^(?:시행령|대통령령)$/);
    pickFirst('시행규칙', /^(?:시행규칙|부령|총리령)$/);
    if (picked.length < 2) {
      picked = active.slice(0, 3).map(function (fn) {
        return { label: fn === '법률(법률)' ? '법률' : fn.replace(/\(.*\)$/, ''), fileName: fn + '.md' };
      });
    }
    return picked;
  }

  function buildOfficialHistoricalLawUrl(lawName, ymd) {
    var cleanName = String(lawName || '').trim();
    var digits = String(ymd || '').replace(/[^0-9]/g, '');
    if (cleanName && digits.length === 8) {
      return 'https://www.law.go.kr/%EB%B2%95%EB%A0%B9/' + encodeURIComponent(cleanName) + '/(' + digits + ')';
    }
    if (cleanName) {
      return 'https://www.law.go.kr/lsSc.do?menuId=1&subMenuId=15&tabMenuId=81&query=' + encodeURIComponent(cleanName);
    }
    return 'https://www.law.go.kr/lsSc.do?menuId=1&subMenuId=15&tabMenuId=81';
  }

  function loadLawHistoryForCurrent() {
    var law = state.readerLaw;
    if (!law || !law.dir || !global.PuPBoxStore || typeof global.PuPBoxStore.fetchLawHistory !== 'function') return;
    var reqSeq = ++state._readerReqSeq;
    state.readerHistoryBusy = true;
    state.readerHistoryError = '';
    renderReader();
    global.PuPBoxStore.fetchLawHistory(law.dir, law.fileName).then(function (list) {
      if (state._readerReqSeq !== reqSeq) return;
      state.readerHistoryBusy = false;
      state.readerHistoryList = Array.isArray(list) ? list : [];
      if (!state.readerHistoryList.length) {
        state.readerHistoryError = '미러 저장소에 기록된 이전 개정 이력이 없습니다. 아래 법제처 공식 연혁 바로가기를 이용해 주세요.';
      }
      renderReader();
    }).catch(function (err) {
      if (state._readerReqSeq !== reqSeq) return;
      state.readerHistoryBusy = false;
      state.readerHistoryError = String((err && err.message) || err || '과거 구법 이력을 불러오지 못했습니다.');
      renderReader();
    });
  }

  function openLawRevisionInReader(sha) {
    var law = state.readerLaw;
    if (!law || !law.dir || !sha) return;
    if (sha === 'current') {
      openLawInReader(law.dir, law.fileName, state.readerHighlightArt, { openHistory: true });
      return;
    }
    var revMeta = (state.readerHistoryList || []).find(function (x) { return x.sha === sha; }) || null;
    if (revMeta && revMeta.isLatest) {
      openLawInReader(law.dir, law.fileName, state.readerHighlightArt, { openHistory: true });
      return;
    }
    var reqSeq = ++state._readerReqSeq;
    state.readerHistoryBusy = true;
    state.readerHistoryError = '';
    renderReader();
    global.PuPBoxStore.fetchLawRevision(law.dir, law.fileName, sha, revMeta).then(function (parsed) {
      if (state._readerReqSeq !== reqSeq) return;
      state.readerHistoryBusy = false;
      state.readerLaw = parsed;
      toast('과거 구법(' + (parsed.revisionDate || parsed.effectiveDate || '이전 개정본') + ') 원문을 불러왔습니다.');
      renderReader();
    }).catch(function (err) {
      if (state._readerReqSeq !== reqSeq) return;
      state.readerHistoryBusy = false;
      state.readerHistoryError = String((err && err.message) || err || '과거 구법 원문을 불러오지 못했습니다.');
      toast(state.readerHistoryError, 'err');
      renderReader();
    });
  }

  function openLaw3DanInReader(dir) {
    if (!dir) return;
    var idxList = global.PuPBoxLawIndex ? global.PuPBoxLawIndex.list() : [];
    var fam = idxList.find(function (f) { return f.dir === dir; }) || null;
    var targets = resolve3DanTargets(fam);
    if (!targets.length) {
      toast('이 법령은 시행령·시행규칙이 없어 단일 원문으로 엽니다.');
      openLawInReader(dir, '', '');
      return;
    }
    var reqSeq = ++state._readerReqSeq;
    state.readerOpen = true;
    state.readerKind = 'law';
    state.readerLawMode = '3dan';
    state.readerLawFamily = fam;
    state.readerArticleFilter = '';
    state.readerHistoryOpen = false;
    state.reader3Dan = { dir: dir, title: fam ? fam.title : dir, loading: true, cols: [] };
    renderReader();

    Promise.all(targets.map(function (t) {
      return global.PuPBoxStore.fetchLaw(dir, t.fileName).then(function (parsed) {
        return { label: t.label, fileName: t.fileName, law: parsed, error: '' };
      }).catch(function (e) {
        return { label: t.label, fileName: t.fileName, law: null, error: String((e && e.message) || e) };
      });
    })).then(function (cols) {
      if (state._readerReqSeq !== reqSeq) return;
      state.reader3Dan = { dir: dir, title: fam ? fam.title : dir, loading: false, cols: cols };
      if (cols[0] && cols[0].law) state.readerLaw = cols[0].law;
      renderReader();
    });
  }

  function openLawInReader(dir, fileName, highlightArt, opts) {
    if (!dir) return;
    opts = opts || {};
    var idxList = global.PuPBoxLawIndex ? global.PuPBoxLawIndex.list() : [];
    var fam = idxList.find(function (f) { return f.dir === dir; }) || null;
    var targetFile = fileName || (fam ? fam.primaryFile : '법률.md');
    var reqSeq = ++state._readerReqSeq;

    state.readerOpen = true;
    state.readerKind = 'law';
    state.readerLawMode = 'single';
    state.readerLawFamily = fam;
    state.readerLaw = null;
    state.reader3Dan = null;
    state.readerHistoryOpen = !!opts.openHistory;
    state.readerHistoryBusy = false;
    state.readerHistoryList = [];
    state.readerHistoryError = '';
    state.readerHighlightArt = highlightArt || '';
    state.readerArticleFilter = '';
    renderReader();

    global.PuPBoxStore.fetchLaw(dir, targetFile).then(function (parsed) {
      if (state._readerReqSeq !== reqSeq) return;
      state.readerLaw = parsed;
      global.PuPBoxStore.recordRecent({
        id: 'law:' + dir + '/' + targetFile,
        kind: 'law',
        title: parsed.title + ' (' + targetFile.replace(/\.md$/, '') + ')',
        sub: parsed.effectiveState ? parsed.effectiveState.label : '국가법령',
        lawDir: dir,
        fileName: targetFile
      });
      reverifyActiveThreadIfAny();
      renderReader();
      if (opts.openHistory) {
        loadLawHistoryForCurrent();
      }
      if (state.view === 'home' || state.view === 'recents') renderMain();
      renderSidebarRecents();
      if (highlightArt) {
        setTimeout(function () {
          var el = document.getElementById('pboxArt_' + highlightArt.replace(/[^0-9가-힣]/g, ''));
          if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 60);
      }
    }).catch(function (err) {
      if (state._readerReqSeq !== reqSeq) return;
      toast('법령 원문을 불러오지 못했습니다: ' + err.message, 'err');
    });
  }

  function openDocInReader(docId) {
    var doc = global.PuPBoxStore.getDocById(docId);
    if (!doc) {
      toast('해당 문서를 찾을 수 없습니다.', 'err');
      return;
    }
    state.readerOpen = true;
    state.readerKind = 'doc';
    state.readerDoc = doc;
    global.PuPBoxStore.recordRecent({
      id: 'doc:' + doc.id,
      kind: 'doc',
      title: doc.title,
      sub: [doc.court || doc.agency, doc.caseNo].filter(Boolean).join(' · ')
    });
    renderReader();
    if (state.view === 'home' || state.view === 'recents') renderMain();
    renderSidebarRecents();
  }

  function closeReader() {
    state.readerOpen = false;
    renderReader();
  }

  /* ── @원문 첨부 추가/해제 ── */
  function attachItem(item) {
    if (!item || !item.id) return;
    if (state.attached.some(function (x) { return x.id === item.id; })) {
      toast('이미 @첨부된 자료입니다.');
      return;
    }
    if (state.attached.length >= 8) {
      toast('@첨부는 최대 8건까지 담을 수 있습니다.', 'err');
      return;
    }
    state.attached.push(item);
    toast('AI 질의창에 @첨부되었습니다: ' + item.title);
    if (state.view === 'home' || state.view === 'workspace') renderMain();
  }

  function attachLawByDir(dir, fileName) {
    global.PuPBoxStore.fetchLaw(dir, fileName).then(function (law) {
      attachItem({
        id: 'law:' + law.cacheKey,
        kind: 'law',
        title: law.title + ' (' + law.fileName.replace(/\.md$/, '') + ')',
        caseNo: '시행 ' + (law.effectiveDate || '현행'),
        body: law.plainText.slice(0, 6000)
      });
    }).catch(function (e) {
      toast('법령 첨부 실패: ' + e.message, 'err');
    });
  }

  /* ── 파일 내보내기 유틸리티 (.md / .doc / .hwpx) ── */
  function downloadBlob(filename, content, mime) {
    var BlobCtor = (global && global.Blob) || Blob;
    var urlApi = (global && global.URL) || URL;
    var blob = new BlobCtor([content], { type: mime || 'text/plain;charset=utf-8' });
    var url = urlApi.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      document.body.removeChild(a);
      urlApi.revokeObjectURL(url);
    }, 300);
  }

  /* ── 무복사(Zero Copy-Paste) 공식 서면 조립 + 푸른 한글 편집기(hangul.html) 메모리 전용 브리지 ── */
  var _activeHangulBridges = new Set();
  function clearAllHangulBridges() {
    var list = Array.from(_activeHangulBridges);
    for (var i = 0; i < list.length; i++) {
      try { list[i](); } catch (_) {}
    }
    _activeHangulBridges.clear();
  }
  try {
    if (global && typeof global.addEventListener === 'function') {
      global.addEventListener('pagehide', function () {
        clearAllHangulBridges();
        stopVoiceDictation({ abort: true, skipDom: true });
      });
    }
  } catch (_) {}

  function bytesToBase64Chunked(bytes) {
    var b64 = '';
    var chunk = 0x8000;
    for (var i = 0; i < bytes.length; i += chunk) {
      b64 += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + chunk, bytes.length)));
    }
    return (global.btoa || btoa)(b64);
  }

  function buildFormalDocFromThread(th, opts) {
    opts = opts || {};
    var E = global.PuPBoxEngine;
    if (!E || typeof E.buildFormalLegalDocument !== 'function') {
      throw new Error('공식 서면 생성 엔진이 로드되지 않았습니다.');
    }
    var store = global.PuPBoxStore;
    var docs = (store && typeof store.getDocs === 'function') ? store.getDocs() : [];
    var loadedLaws = (store && typeof store.getLoadedLaws === 'function') ? store.getLoadedLaws() : [];
    var lawIndex = (global.PuPBoxLawIndex && typeof global.PuPBoxLawIndex.list === 'function')
      ? global.PuPBoxLawIndex.list()
      : [];
    return E.buildFormalLegalDocument({
      docType: opts.docType || 'opinion',
      includeLetterhead: opts.includeLetterhead !== false,
      title: opts.title !== undefined ? opts.title : (th && th.title ? th.title : '법률·노무 검토 의견서'),
      recipient: opts.recipient || '',
      sender: opts.sender || ((state.userName ? (state.userName + ' 공인노무사') : '푸른노무법인 담당 공인노무사')),
      stance: (th && th.stance) || state.reviewStance || 'neutral',
      query: (th && th.query) || '',
      sourceText: (th && th.sourceText) || '',
      answer: (th && th.answer) || (th && th.sourceText) || '',
      deadlineBaseDate: opts.deadlineBaseDate !== undefined ? opts.deadlineBaseDate : (state.deadlineBaseDate || ''),
      includeTimeline: opts.includeTimeline !== false,
      includeRedline: opts.includeRedline !== false,
      includeDeadlines: opts.includeDeadlines !== false,
      includeCitations: opts.includeCitations !== false,
      docs: docs,
      loadedLaws: loadedLaws,
      lawIndex: lawIndex
    });
  }

  /* 서면·한글 출력 직전 인용된 모든 미로드 법령 원문을 자동 로드해 조문 실존 여부(예: 근로기준법 제9999조 차단)까지 100% 대조 */
  function prepareFormalDocFromThread(th, opts) {
    var store = global.PuPBoxStore;
    var seedText = [
      th && th.answer ? th.answer : '',
      th && th.sourceText ? th.sourceText : '',
      th && th.query ? th.query : ''
    ].filter(Boolean).join('\n');
    var preloadP = (store && typeof store.preloadCitedLaws === 'function' && seedText)
      ? store.preloadCitedLaws(seedText, false).catch(function () {})
      : Promise.resolve();
    return preloadP.then(function () {
      return buildFormalDocFromThread(th, opts);
    });
  }

  function downloadFormalHwpx(formalDoc) {
    var E = global.PuPBoxEngine;
    var bytes = E.buildFormalHwpxBytes(formalDoc, global.PureunHwpx);
    downloadBlob(formalDoc.fileNameBase + '.hwpx', bytes, 'application/hwp+zip');
    return bytes;
  }

  function applyHangulRoundTripSave(savedPayload, boundMeta) {
    if (!savedPayload || typeof savedPayload !== 'object') return Promise.resolve(false);
    boundMeta = boundMeta || {};
    var editedText = String(savedPayload.plainText || '').trim();
    if (!editedText) return Promise.resolve(false);
    var store = global.PuPBoxStore;
    var E = global.PuPBoxEngine;
    if (!store || typeof store.saveThread !== 'function') return Promise.resolve(false);

    var startGen = (typeof store.getSessionGen === 'function') ? store.getSessionGen() : 0;
    var startUid = (typeof store.getActiveUid === 'function') ? store.getActiveUid() : '';
    var boundTid = String(boundMeta.threadId || '');
    var boundPid = String(boundMeta.projectId || '');
    if (!boundTid) return Promise.resolve(false);

    /* 편집기에서 새로 추가된 미로드 법령 조문도 자동 로드해 실존 대조 후 격리 */
    var preloadP = (typeof store.preloadCitedLaws === 'function')
      ? store.preloadCitedLaws(editedText, false).catch(function () {})
      : Promise.resolve();

    return preloadP.then(function () {
      /* 비동기 프리로드 도중 브리지가 닫히거나 로그아웃/계정 전환된 경우 쓰기 즉시 중단 */
      if (typeof boundMeta.isCancelled === 'function' && boundMeta.isCancelled()) return false;
      if (typeof store.getSessionGen === 'function' && store.getSessionGen() !== startGen) return false;
      if (typeof store.getActiveUid === 'function' && store.getActiveUid() !== startUid) return false;

      var scrubField = function (rawVal, partyNames) {
        var s = String(rawVal || '').trim();
        if (!s) return '';
        if (E && typeof E.anonymizeLegalText === 'function') {
          var r = E.anonymizeLegalText(s, partyNames || []);
          s = (r && typeof r === 'object' && typeof r.text === 'string') ? r.text : String(r || '');
        }
        if (global && global.PuRrnScrub && typeof global.PuRrnScrub.scrub === 'function') {
          s = global.PuRrnScrub.scrub(s);
        }
        return s;
      };
      var rawDocName = String(savedPayload.name || '').trim();
      var sharedNames = (E && typeof E.extractPartyNames === 'function')
        ? E.extractPartyNames(editedText + '\n' + rawDocName, '')
        : [];
      var safeEditedText = scrubField(editedText, sharedNames);
      var docs = (typeof store.getDocs === 'function') ? store.getDocs() : [];
      var loadedLaws = (typeof store.getLoadedLaws === 'function') ? store.getLoadedLaws() : [];
      var lawIndex = (global.PuPBoxLawIndex && typeof global.PuPBoxLawIndex.list === 'function')
        ? global.PuPBoxLawIndex.list()
        : [];
      var finalText = safeEditedText;
      var finalVerification = null;
      var blockedCnt = 0;
      if (E && typeof E.enforceZeroHallucinationGuard === 'function') {
        var g = E.enforceZeroHallucinationGuard(safeEditedText, {
          docs: docs,
          loadedLaws: loadedLaws,
          lawIndex: lawIndex
        });
        finalText = g.text;
        finalVerification = g.verification;
        blockedCnt = g.blockedCount || 0;
      }

      /* 브리지 개설 시 고정된 스레드·프로젝트 ID만 허용 (임의 대상 덮어쓰기 차단) */
      var threads = (typeof store.getThreads === 'function') ? store.getThreads() : [];
      var existing = threads.find(function (t) { return t.id === boundTid; });
      if (!existing) return false;
      var docName = scrubField(rawDocName || existing.title || '한글 최종 서면', sharedNames) || '한글 최종 서면';
      var docLabel = String(savedPayload.docTypeLabel || '공식 서면').trim();

      var nextHist = Array.isArray(existing.history) ? existing.history.slice() : [];
      nextHist.push({
        query: '[한글 편집기 최종본 반영] ' + docLabel + ' — ' + docName,
        answer: finalText,
        mode: existing.mode || 'review',
        engineLabel: '푸른 한글 편집기 양방향 반영',
        at: Number(savedPayload.savedAt) || Date.now()
      });
      var updated = store.saveThread({
        id: existing.id,
        title: existing.title || docName,
        mode: existing.mode || 'review',
        stance: existing.stance || state.reviewStance || 'neutral',
        query: existing.query || '',
        answer: finalText,
        sourceText: existing.sourceText || '',
        sourceFileName: existing.sourceFileName || '',
        projectId: existing.projectId || boundPid,
        workflowStyle: existing.workflowStyle || 'lbox',
        engineLabel: '푸른 한글 편집기 양방향 반영',
        verification: finalVerification || existing.verification,
        hallucinationBlockedCount: blockedCnt,
        attachedTitles: existing.attachedTitles || [],
        retrievedDocIds: existing.retrievedDocIds || [],
        history: nextHist
      });
      if (state.activeThread && state.activeThread.id === updated.id) {
        state.activeThread = updated;
      }

      var projSaved = false;
      if (boundPid && typeof store.getProjects === 'function' && typeof store.saveProject === 'function') {
        var proj = store.getProjects().find(function (p) { return p.id === boundPid; });
        if (proj) {
          proj.drafts = [{
            title: '[한글최종본 · ' + docLabel + '] ' + docName,
            answer: finalText,
            savedAt: Number(savedPayload.savedAt) || Date.now()
          }].concat(proj.drafts || []);
          store.saveProject(proj);
          projSaved = true;
        }
      }

      toast(projSaved
        ? ('푸른 한글 편집기 최종본을 P박스 작업 및 사건 프로젝트에 자동 반영했습니다.' + (blockedCnt > 0 ? (' (미검증 인용 ' + blockedCnt + '건 격리)') : ''))
        : ('푸른 한글 편집기 최종본을 P박스 작업에 자동 반영했습니다.' + (blockedCnt > 0 ? (' (미검증 인용 ' + blockedCnt + '건 격리)') : '')));
      renderAll();
      return true;
    });
  }

  function openFormalDocInHangulEditor(formalDoc, meta) {
    meta = meta || {};
    var E = global.PuPBoxEngine;
    var bridgeId = 'pbox_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    var url = 'hangul.html?from=pbox&bid=' + encodeURIComponent(bridgeId);
    var w = (typeof global.open === 'function') ? global.open(url, '_blank') : null;
    if (!w) {
      toast('팝업이 차단되어 푸른 한글 편집기를 열지 못했습니다. 브라우저 팝업을 허용한 뒤 다시 누르거나 [📥 한글(.hwpx)] 버튼으로 직접 저장해 주세요.', 'err');
      return { opened: false, popupBlocked: true, bridgeId: bridgeId };
    }

    var origin = (global.location && /^https?:\/\//i.test(String(global.location.origin || '')))
      ? String(global.location.origin)
      : '';
    if (!origin) {
      try { if (w && typeof w.close === 'function') w.close(); } catch (_) {}
      toast('보안 출처(https/http) 환경에서만 푸른 한글 편집기 직접 전송이 가능합니다. [📥 한글(.hwpx)] 저장을 이용해 주세요.', 'err');
      return { opened: false, invalidOrigin: true, bridgeId: bridgeId };
    }

    var payload = null;
    var childReady = false;
    var acked = false;
    var cleaned = false;
    var timers = [];
    var activeTh = meta.thread || state.activeThread || null;
    var activePid = String(meta.projectId || (activeTh && activeTh.projectId) || state.activeProjectId || '');
    var activeTid = String(meta.threadId || (activeTh && activeTh.id) || '');

    function attachFormalDoc(docObj) {
      if (cleaned || !docObj) return;
      var bytes = E.buildFormalHwpxBytes(docObj, global.PureunHwpx);
      var b64 = bytesToBase64Chunked(bytes);
      payload = {
        bridgeId: bridgeId,
        format: 'hwpx',
        name: docObj.fileNameBase + '.hwpx',
        label: docObj.title,
        docType: docObj.docType,
        docTypeLabel: docObj.docTypeLabel,
        threadId: activeTid,
        projectId: activePid,
        sourceLabel: 'P박스 ' + docObj.docTypeLabel,
        b64: b64,
        sentAt: Date.now()
      };
      if (childReady && !acked) pushToChild();
    }

    function pushToChild() {
      if (cleaned || acked || !payload || !payload.b64) return;
      try {
        if (w && !w.closed) {
          w.postMessage({ type: 'pureun_hangul_open', payload: payload }, origin);
        }
      } catch (_) {}
    }
    function wipeSendPayload() {
      if (payload) payload.b64 = '';
    }
    function cleanup() {
      if (cleaned) return;
      cleaned = true;
      for (var t = 0; t < timers.length; t++) clearTimeout(timers[t]);
      timers = [];
      try {
        if (global && typeof global.removeEventListener === 'function') {
          global.removeEventListener('message', onMsg);
        }
      } catch (_) {}
      wipeSendPayload();
      payload = null;
      _activeHangulBridges.delete(cleanup);
    }
    function onMsg(e) {
      if (cleaned || !e) return;
      if (e.origin !== origin) return;
      if (e.source !== w) return;
      var d = e.data;
      if (!d || typeof d !== 'object') return;
      if (d.type === 'pureun_hangul_ready' && d.bid === bridgeId) {
        childReady = true;
        pushToChild();
      } else if (d.type === 'pureun_hangul_ack' && d.bridgeId === bridgeId) {
        acked = true;
        /* 전송 페이로드는 즉시 메모리 파기하되, 한글 편집기 → P박스 양방향 최종본 반영(pureun_pbox_save)은 창이 닫히거나 로그아웃 전까지 수신 */
        wipeSendPayload();
      } else if (d.type === 'pureun_pbox_save' && d.bridgeId === bridgeId && d.payload) {
        applyHangulRoundTripSave(d.payload, {
          threadId: activeTid,
          projectId: activePid,
          isCancelled: function () { return cleaned; }
        });
      }
    }
    if (global && typeof global.addEventListener === 'function') {
      global.addEventListener('message', onMsg);
    }
    _activeHangulBridges.add(cleanup);
    /* 25초 안에 ack 미수신 시 전송 버퍼 자동 파기 */
    timers.push(setTimeout(function () {
      if (!acked) wipeSendPayload();
      if (w && w.closed) cleanup();
    }, 25000));

    if (formalDoc && typeof formalDoc.then === 'function') {
      formalDoc.then(function (resolvedDoc) {
        attachFormalDoc(resolvedDoc);
        toast('푸른 한글 편집기로 \'' + resolvedDoc.docTypeLabel + '\'을 복사 없이 바로 전송했습니다. (편집기에서 [P박스에 최종본 반영]으로 다시 저장 가능)');
      }).catch(function (err) {
        cleanup();
        try { if (w && typeof w.close === 'function') w.close(); } catch (_) {}
        toast('한글 편집기 전송 준비 오류: ' + (err && err.message ? err.message : String(err)), 'err');
      });
    } else if (formalDoc) {
      attachFormalDoc(formalDoc);
      toast('푸른 한글 편집기로 \'' + formalDoc.docTypeLabel + '\'을 복사 없이 바로 전송했습니다. (편집기에서 [P박스에 최종본 반영]으로 다시 저장 가능)');
    }
    return { opened: true, fallbackDownload: false, bridgeId: bridgeId };
  }

  function renderHandoffGuardBadgeHtml(docObj, isPreloading) {
    if (!docObj) return '';
    if (isPreloading) {
      return '<span class="pbox-badge-blue">⏳ 인용된 국가법령 원문을 자동 로드해 조문 실존 여부를 정밀 대조 중입니다...</span>';
    }
    if (!docObj.clean) {
      return '<span class="pbox-badge-red">⚠️ 미검증 인용 ' + docObj.blockedCount + '건 자동 격리됨 — 서면 내 격리 표시를 원문 확인 후 정리하세요</span>';
    }
    var extra = [];
    if (docObj.unfetchedLawCount > 0) extra.push('미로드 법령 ' + docObj.unfetchedLawCount + '건');
    if (docObj.refOnlyCount > 0) extra.push('참조판례 ' + docObj.refOnlyCount + '건');
    return '<span class="pbox-badge-green">🛡️ 할루시네이션 차단 관문 통과 · 검증 완료 인용 ' + docObj.verifiedCount + '건 / 미검증 차단 0건' +
      (extra.length ? (' (' + extra.join(' · ') + ')') : '') + '</span>';
  }

  function showDocumentHandoffModal() {
    if (!state.activeThread) {
      toast('먼저 내용 검토를 실행하거나 작업을 열어 주세요.', 'err');
      return;
    }
    var th = state.activeThread;
    var previewDoc = null;
    try {
      previewDoc = buildFormalDocFromThread(th, { docType: 'opinion' });
    } catch (e) {
      toast('서면 준비 오류: ' + e.message, 'err');
      return;
    }
    var needPreload = previewDoc.unfetchedLawCount > 0 && global.PuPBoxStore && typeof global.PuPBoxStore.preloadCitedLaws === 'function';
    var guardHtml = renderHandoffGuardBadgeHtml(previewDoc, needPreload);

    var html = [
      '<div class="pbox-modal-hd">',
      '  <strong id="pboxModalTitle">📝 무복사 공식 서면 연결 작성 · 한글 직행</strong>',
      '  <button type="button" class="pbox-icon-btn" data-act="close-modal" aria-label="창 닫기">✕</button>',
      '</div>',
      '<div class="pbox-modal-bd">',
      '  <div class="pbox-muted" style="margin-bottom:10px">Ctrl+C / Ctrl+V 없이 현재 검토 보고서·연표·신구대비표·제척기간·검증 완료 판례를 공식 노무 서면으로 조립해 푸른 한글 편집기로 바로 넘기고, 편집 후 다시 P박스 프로젝트에 최종본을 반영할 수 있습니다.</div>',
      '  <div id="pboxHandoffGuardSlot" style="margin-bottom:12px">' + guardHtml + '</div>',
      '  <div class="pbox-form-stack">',
      '    <label class="pbox-field">',
      '      <span class="pbox-label">서면 양식 선택 (공식 노무 서식 6종)</span>',
      '      <select id="pboxHandoffType" class="pbox-input" style="width:100%;max-width:100%;box-sizing:border-box">',
      '        <option value="opinion">법률·노무 자문의견서 (의뢰인 발송용)</option>',
      '        <option value="nlrc_brief">노동위원회 이유서·답변서 초안</option>',
      '        <option value="notice">내용증명·시정요구서 (통지서)</option>',
      '        <option value="redline_memo">취업규칙·근로계약서 신·구 조항 대비 의견서</option>',
      '        <option value="complaint">고용노동부 진정서·고소장 초안</option>',
      '        <option value="disciplinary">징계위원회 검토·의결서 초안</option>',
      '      </select>',
      '    </label>',
      '    <label class="pbox-field">',
      '      <span class="pbox-label">문서 제목</span>',
      '      <input id="pboxHandoffTitle" type="text" class="pbox-input" value="' + esc(previewDoc.title) + '">',
      '    </label>',
      '    <label class="pbox-field">',
      '      <span class="pbox-label">수신 (예: 의뢰인 귀하 / 관할 지방노동위원회 귀중)</span>',
      '      <input id="pboxHandoffRecipient" type="text" class="pbox-input" value="' + esc(previewDoc.recipient) + '">',
      '    </label>',
      '    <label class="pbox-field">',
      '      <span class="pbox-label">발신·작성자</span>',
      '      <input id="pboxHandoffSender" type="text" class="pbox-input" value="' + esc(previewDoc.sender) + '">',
      '    </label>',
      '    <div class="pbox-field">',
      '      <span class="pbox-label">자동 연계 포함 항목 (개인정보 자동 비식별 + 미검증 인용 차단 적용)</span>',
      '      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:4px">',
      '        <label style="display:inline-flex;align-items:center;gap:6px;white-space:nowrap;min-height:36px;padding:4px 10px;border:1px solid #cbd5e1;border-radius:8px;cursor:pointer;font-size:13px"><input type="checkbox" id="pboxHandoffIncLetterhead" checked> 푸른노무법인 공식 레터헤드·직인란</label>',
      '        <label style="display:inline-flex;align-items:center;gap:6px;white-space:nowrap;min-height:36px;padding:4px 10px;border:1px solid #cbd5e1;border-radius:8px;cursor:pointer;font-size:13px"><input type="checkbox" id="pboxHandoffIncTimeline" checked> 사실관계 일자별 연표</label>',
      '        <label style="display:inline-flex;align-items:center;gap:6px;white-space:nowrap;min-height:36px;padding:4px 10px;border:1px solid #cbd5e1;border-radius:8px;cursor:pointer;font-size:13px"><input type="checkbox" id="pboxHandoffIncRedline" checked> 3단 신·구 조항 대비표</label>',
      '        <label style="display:inline-flex;align-items:center;gap:6px;white-space:nowrap;min-height:36px;padding:4px 10px;border:1px solid #cbd5e1;border-radius:8px;cursor:pointer;font-size:13px"><input type="checkbox" id="pboxHandoffIncDeadlines" checked> 노동법 제척기간·시효표</label>',
      '        <label style="display:inline-flex;align-items:center;gap:6px;white-space:nowrap;min-height:36px;padding:4px 10px;border:1px solid #cbd5e1;border-radius:8px;cursor:pointer;font-size:13px"><input type="checkbox" id="pboxHandoffIncCitations" checked> 검증 완료 근거 (<span id="pboxHandoffCiteCnt">' + previewDoc.verifiedCount + '</span>건)</label>',
      '      </div>',
      '    </div>',
      '  </div>',
      '  <div class="pbox-modal-ft" style="flex-wrap:wrap">',
      '    <button type="button" class="pbox-btn-sm" data-act="handoff-download-doc">📄 Word(.doc) 저장</button>',
      '    <button type="button" class="pbox-btn-sm" data-act="handoff-download-hwpx">📥 한글(.hwpx) 저장</button>',
      '    <button type="button" class="pbox-btn-primary" data-act="handoff-open-hangul">🖋️ 푸른 한글 편집기로 바로 넘기기</button>',
      '  </div>',
      '</div>'
    ].join('\n');
    openModalHtml(html, false, false);

    /* 양식 변경 시 기본 수신처를 양식별 기본값으로 자동 연동 (사용자가 직접 수정한 수신처는 유지) */
    var typeSel = document.getElementById('pboxHandoffType');
    var recInp = document.getElementById('pboxHandoffRecipient');
    var E0 = global.PuPBoxEngine;
    if (typeSel && recInp && E0 && E0.FORMAL_DOC_TEMPLATES && typeof typeSel.addEventListener === 'function') {
      var allDefaultRecs = new Set(Object.keys(E0.FORMAL_DOC_TEMPLATES).map(function (k) {
        return E0.FORMAL_DOC_TEMPLATES[k].defaultRecipient;
      }));
      typeSel.addEventListener('change', function () {
        var nextTpl = E0.FORMAL_DOC_TEMPLATES[typeSel.value];
        if (!nextTpl) return;
        var curVal = String(recInp.value || '').trim();
        if (!curVal || allDefaultRecs.has(curVal)) {
          recInp.value = nextTpl.defaultRecipient;
        }
      });
    }

    if (needPreload) {
      var expectedTid = th.id;
      prepareFormalDocFromThread(th, { docType: 'opinion' }).then(function (rechecked) {
        if (!state.activeThread || state.activeThread.id !== expectedTid) return;
        var slot = document.getElementById('pboxHandoffGuardSlot');
        if (slot) slot.innerHTML = renderHandoffGuardBadgeHtml(rechecked, false);
        var cntEl = document.getElementById('pboxHandoffCiteCnt');
        if (cntEl) cntEl.textContent = String(rechecked.verifiedCount);
      }).catch(function () {});
    }
  }

  function readHandoffModalOptions() {
    var typeEl = document.getElementById('pboxHandoffType');
    var titleEl = document.getElementById('pboxHandoffTitle');
    var recEl = document.getElementById('pboxHandoffRecipient');
    var sndEl = document.getElementById('pboxHandoffSender');
    var lhEl = document.getElementById('pboxHandoffIncLetterhead');
    var tlEl = document.getElementById('pboxHandoffIncTimeline');
    var rlEl = document.getElementById('pboxHandoffIncRedline');
    var dlEl = document.getElementById('pboxHandoffIncDeadlines');
    var ctEl = document.getElementById('pboxHandoffIncCitations');
    return {
      docType: typeEl ? typeEl.value : 'opinion',
      title: titleEl ? titleEl.value.trim() : '',
      recipient: recEl ? recEl.value.trim() : '',
      sender: sndEl ? sndEl.value.trim() : '',
      includeLetterhead: lhEl ? !!lhEl.checked : true,
      includeTimeline: tlEl ? !!tlEl.checked : true,
      includeRedline: rlEl ? !!rlEl.checked : true,
      includeDeadlines: dlEl ? !!dlEl.checked : true,
      includeCitations: ctEl ? !!ctEl.checked : true
    };
  }

  /* ══════════════════════════════════════════════════════════════
   * 전체 골격 마운트 (엘박스형 사이드바 · 순백 워크스페이스 · 우측 원문리더)
   * ══════════════════════════════════════════════════════════════ */
  function mount(container) {
    rootEl = container;
    clearViewSelections();
    loadInitialTheme();

    var last = '';
    try {
      if (global.PuAppBar && global.PuAppBar.lastScreen) last = global.PuAppBar.lastScreen();
    } catch (e) {}
    if (last && ['home', 'workspace', 'alerts', 'laws', 'cases', 'sites', 'ingest', 'recents', 'workflows', 'projects', 'tasks'].indexOf(last) >= 0) {
      state.view = last;
    }

    rootEl.innerHTML = [
      '<div class="pbox-shell">',
      '  <aside id="pboxSidePanel" class="pbox-sidebar" aria-label="P박스 메뉴">',
      '    <div class="pbox-brand-row">',
      '      <div class="pbox-brand-title" role="button" tabindex="0" data-act="go-view" data-view="home" aria-label="P박스 홈으로 이동">',
      '        <span class="pbox-brand-mark" aria-hidden="true">P</span>',
      '        <span class="pbox-brand-main">P박스</span>',
      '      </div>',
      '      <div class="pbox-btn-group">',
      '        <button type="button" class="pbox-icon-btn pbox-pc-only" data-act="toggle-sidebar-collapse" title="사이드바 접기" aria-label="사이드바 접기">◧</button>',
      '        <button type="button" class="pbox-icon-btn pbox-mobile-only" data-act="close-mobile-nav" aria-label="메뉴 닫기">✕</button>',
      '      </div>',
      '    </div>',
      '    <div class="pbox-profile-card">',
      '      <div class="pbox-profile-top">',
      '        <span id="pboxUserAvatar" class="pbox-user-avatar" aria-hidden="true">푸른</span>',
      '        <div class="pbox-profile-meta">',
      '          <div id="who" class="pbox-who-slot">푸른노무법인</div>',
      '        </div>',
      '      </div>',
      '    </div>',
      '    <nav id="pboxNavList" class="pbox-nav-list" aria-label="주요 기능 탐색">',
      '      <button type="button" class="pbox-nav-btn" data-act="go-view" data-view="home"><span>홈</span></button>',
      '      <button type="button" class="pbox-nav-btn" data-act="go-view" data-view="cases"><span>통합 검색</span></button>',
      '      <button type="button" class="pbox-nav-btn" data-act="go-view" data-view="laws"><span>법령 조회</span></button>',
      '      <button type="button" class="pbox-nav-btn" data-act="go-view" data-view="sites"><span>외부 사이트</span></button>',
      '      <button type="button" class="pbox-nav-btn" data-act="go-view" data-view="ingest"><span>자료 수집</span></button>',
      '      <div class="pbox-nav-divider" role="separator"></div>',
      '      <div class="pbox-side-proj-row">',
      '        <button type="button" class="pbox-nav-btn" data-act="go-view" data-view="projects"><span>프로젝트</span></button>',
      '        <button type="button" class="pbox-side-newproj-btn" data-act="create-project-prompt" aria-label="새 프로젝트 만들기">+ 추가</button>',
      '      </div>',
      '      <button type="button" class="pbox-nav-btn" data-act="go-view" data-view="workflows"><span>서면 워크플로</span></button>',
      '      <button type="button" class="pbox-nav-btn" data-act="go-view" data-view="recents"><span>최근 본 자료</span></button>',
      '      <button type="button" class="pbox-nav-btn" data-act="go-view" data-view="alerts"><span>알림</span><span id="pboxAlertCnt" class="pbox-nav-cnt alert" style="display:none">0</span></button>',
      '    </nav>',
      '    <div class="pbox-history-box">',
      '      <div class="pbox-history-hd-row">',
      '        <span class="pbox-history-hd">최근 작업</span>',
      '        <div class="pbox-btn-group">',
      '          <button type="button" class="pbox-link-btn" data-act="go-view" data-view="tasks">관리</button>',
      '          <button type="button" id="pboxTaskSecToggle" class="pbox-icon-btn" data-act="toggle-task-sec" aria-label="작업 목록 접기 또는 펼치기">—</button>',
      '        </div>',
      '      </div>',
      '      <div id="pboxSideHistory" class="pbox-history-list"></div>',
      '    </div>',
      '    <div class="pbox-side-foot">',
      '      <button type="button" class="pbox-foot-btn" data-act="open-cfg-modal">⚙ 동기화 · DB 설정</button>',
      '      <div class="pbox-foot-row">',
      '        <a class="pbox-portal-link" href="enter.html">← 푸른포털</a>',
      '        <div class="pbox-btn-group">',
      '          <button type="button" class="pbox-logout-btn" data-act="toggle-theme" aria-label="밝은 테마 어두운 테마 전환">🌓 테마</button>',
      '          <button type="button" id="outBtn" class="pbox-logout-btn" style="display:none">로그아웃</button>',
      '        </div>',
      '      </div>',
      '    </div>',
      '  </aside>',
      '  <div class="pbox-center-col">',
      '    <header class="pbox-topbar">',
      '      <div class="pbox-topbar-left">',
      '        <button type="button" class="pbox-icon-btn pbox-mobile-only" data-act="open-mobile-nav" aria-label="메뉴 열기">☰</button>',
      '        <button type="button" id="pboxExpandSideBtn" class="pbox-icon-btn pbox-pc-only" data-act="toggle-sidebar-collapse" aria-label="사이드바 펼치기" style="display:none">◧</button>',
      '        <span id="pboxTopTitle" class="pbox-top-title">홈</span>',
      '      </div>',
      '      <div class="pbox-topbar-right">',
      '        <div id="pboxTopSearchBox" class="pbox-top-search-box pbox-pc-only" style="display:none">',
      '          <input type="search" id="pboxTopQuickInput" class="pbox-top-search-input" aria-label="빠른 통합 검색" placeholder="판례 · 법령 · 행정해석 검색">',
      '          <button type="button" class="pbox-top-search-go" data-act="run-top-quick-search">검색</button>',
      '        </div>',
      '        <span id="pboxSyncPill" class="pbox-sync-pill" role="status" aria-live="polite" style="display:none"><span class="pbox-live-dot" aria-hidden="true"></span><span id="pboxSyncStatus">동기화 중…</span></span>',
      '        <button type="button" id="pboxTopSyncBtn" class="pbox-btn-sm" data-act="quick-sync">동기화</button>',
      '      </div>',
      '    </header>',
      '    <main id="pboxMainArea" class="pbox-main-scroll"></main>',
      '  </div>',
      '  <section id="pboxReader" class="pbox-reader" aria-label="법령·판례 원문 리더" style="display:none"></section>',
      '</div>'
    ].join('\n');

    bindDelegatedEvents();
    syncMobileSidebarA11y();

    if (global.PuPBoxStore.getActiveUid && global.PuPBoxStore.getActiveUid()) {
      renderAll();
    } else {
      global.PuPBoxStore.init('guest').then(function () {
        if (global.PuPBoxStore.getActiveUid && global.PuPBoxStore.getActiveUid()) return;
        renderAll();
        var cfg = global.PuPBoxStore.getConfig();
        if (cfg.autoSyncOnBoot) {
          global.PuPBoxStore.runIncrementalSync({ callServer: false }).then(function (r) {
            if (r && (r.treeChanged || r.supabasePulled > 0)) {
              renderSidebarCounts();
            }
          });
        }
      });
    }
  }

  function renderAll() {
    renderSidebarNavState();
    renderSidebarCounts();
    renderSidebarRecents();
    renderMain();
    renderReader();
  }

  function renderSidebarNavState() {
    var titles = {
      home: '홈',
      workspace: '내용 검토 · 문서 작성',
      alerts: '알림 · 동기화 현황',
      laws: '법령 조회',
      cases: '통합 검색',
      sites: '외부 사이트 검색',
      ingest: '자료 수집',
      recents: '최근 본 자료',
      workflows: '서면 워크플로',
      projects: '프로젝트',
      tasks: '작업 관리'
    };
    var topT = document.getElementById('pboxTopTitle');
    if (topT) topT.textContent = titles[state.view] || 'P박스';

    var topSearchBox = document.getElementById('pboxTopSearchBox');
    if (topSearchBox && topSearchBox.style) {
      topSearchBox.style.display = (state.view === 'home' || state.view === 'cases') ? 'none' : '';
    }

    var sb = document.getElementById('pboxSidePanel');
    if (sb) {
      if (state.sidebarCollapsed) sb.classList.add('collapsed');
      else sb.classList.remove('collapsed');
    }
    var expBtn = document.getElementById('pboxExpandSideBtn');
    if (expBtn) expBtn.style.display = state.sidebarCollapsed ? '' : 'none';

    var avEl = document.getElementById('pboxUserAvatar');
    if (avEl) avEl.textContent = avatarCharsOf(state.userName);

    var btns = document.querySelectorAll('#pboxNavList .pbox-nav-btn');
    for (var i = 0; i < btns.length; i++) {
      var v = btns[i].getAttribute('data-view');
      if (v === state.view) {
        btns[i].classList.add('active');
        btns[i].setAttribute('aria-current', 'page');
      } else {
        btns[i].classList.remove('active');
        btns[i].removeAttribute('aria-current');
      }
    }
  }

  function renderSidebarCounts() {
    var sum = global.PuPBoxStore.getStateSummary();
    var elAlert = document.getElementById('pboxAlertCnt');
    var elSyncPill = document.getElementById('pboxSyncPill');
    var elSync = document.getElementById('pboxSyncStatus');
    var topSyncBtn = document.getElementById('pboxTopSyncBtn');

    if (elAlert) {
      elAlert.textContent = String(sum.alertsCount || 0);
      if (elAlert.style) elAlert.style.display = sum.alertsCount > 0 ? '' : 'none';
    }
    if (topSyncBtn) topSyncBtn.disabled = !!state.syncBusy;

    var isBusy = !!(state.syncBusy || state.liveCollectBusy || state.kcplaaPullBusy || state.lowerPullBusy || state.tribunalPullBusy);
    if (elSyncPill && elSyncPill.style) {
      elSyncPill.style.display = isBusy ? '' : 'none';
    }
    if (elSync && isBusy) {
      elSync.textContent = state.syncProgressText || '실시간 동기화 중…';
    }
  }

  function renderSidebarRecents() {
    var box = document.getElementById('pboxSideHistory');
    var toggleBtn = document.getElementById('pboxTaskSecToggle');
    if (toggleBtn) toggleBtn.textContent = state.taskSecCollapsed ? '＋' : '—';
    if (!box) return;
    if (state.taskSecCollapsed) {
      box.innerHTML = '';
      return;
    }
    var threads = global.PuPBoxStore.getThreads().slice(0, 16);
    if (!threads.length) {
      box.innerHTML = '<div class="pbox-empty-mini">최근 작업 없음</div>';
      return;
    }
    var curId = state.activeThread && state.view === 'workspace' ? state.activeThread.id : '';
    box.innerHTML = threads.map(function (th) {
      var isCur = curId && th.id === curId;
      return '<button type="button" class="pbox-hist-item' + (isCur ? ' active' : '') + '" data-act="open-thread" data-id="' + esc(th.id) + '" title="' + esc(th.title || th.query) + '">' +
        esc(th.title || th.query) + '</button>';
    }).join('');
  }

  /* ══════════════════════════════════════════════════════════════
   * 가운데 화면 렌더링 (10개 뷰: 엘박스 홈 · 내용검토 워크스페이스 · 최근본자료 · 작업관리 포함)
   * ══════════════════════════════════════════════════════════════ */
  function renderMain() {
    var area = document.getElementById('pboxMainArea');
    if (!area) return;
    renderSidebarCounts();

    if (state.view === 'home') area.innerHTML = buildHomeHtml();
    else if (state.view === 'workspace') area.innerHTML = buildWorkspaceHtml();
    else if (state.view === 'alerts') area.innerHTML = buildAlertsHtml();
    else if (state.view === 'laws') area.innerHTML = buildLawsHtml();
    else if (state.view === 'cases') area.innerHTML = buildCasesHtml();
    else if (state.view === 'sites') area.innerHTML = buildSitesHtml();
    else if (state.view === 'ingest') area.innerHTML = buildIngestHtml();
    else if (state.view === 'recents') area.innerHTML = buildRecentsHtml();
    else if (state.view === 'workflows') area.innerHTML = buildWorkflowsHtml();
    else if (state.view === 'projects') area.innerHTML = buildProjectsHtml();
    else if (state.view === 'tasks') area.innerHTML = buildTasksHtml();

    if (state.voiceActive) syncVoiceUiDom();
  }

  /* ── 1) 홈 화면 (불필요한 안내문 제거 · 시선이 모이는 중앙 집중형 검색창 · 2열 정돈 대시보드) ── */
  var HOME_QUICK_KEYWORDS = [
    { label: '통상임금', q: '통상임금' },
    { label: '포괄임금', q: '포괄임금' },
    { label: '부당해고 서면통지', q: '서면통지 해고 제27조' },
    { label: '출퇴근 산재', q: '출퇴근재해' },
    { label: '직장내 괴롭힘', q: '직장 내 괴롭힘' },
    { label: '3.3% 근로자성', q: '프리랜서 근로자성' },
    { label: '공무원·군인 징계', q: '공무원 징계 소청' }
  ];

  function buildHomeHtml() {
    var recents = global.PuPBoxStore.getRecents().slice(0, 5);
    var projects = global.PuPBoxStore.getProjects().slice(0, 4);

    var chipsHtml = state.attached.map(function (a, i) {
      return '<span class="pbox-att-chip">' +
        '<span>@ ' + esc(a.title) + '</span>' +
        '<button type="button" class="pbox-att-rm" data-act="rm-att" data-idx="' + i + '" aria-label="' + esc(a.title) + ' 첨부 제거">✕</button>' +
      '</span>';
    }).join('');

    var modes = [
      { id: 'auto', label: '자동' },
      { id: 'search', label: '검색' },
      { id: 'review', label: '내용검토' },
      { id: 'draft', label: '문서작성' }
    ];

    var sendDisabled = (state.aiBusy || state.reviewFileBusy) ? ' disabled aria-busy="true"' : '';
    var submitLabel = state.aiBusy
      ? '처리 중…'
      : (state.promptMode === 'review' ? '검토 ↵' : (state.promptMode === 'draft' ? '작성 ↵' : '검색 ↵'));

    var defaultRecentsHtml = [
      '<div class="pbox-lbox-recent-line" role="button" tabindex="0" data-act="open-doc" data-id="prec-lower-seouladm-2009gudan4596">' +
        '<div class="pbox-lbox-recent-left"><span class="pbox-lbox-recent-title">서울행정법원 2011. 7. 8. 선고 2009구단4596 판결 (최초요양 일부불승인 취소)</span><span class="pbox-lbox-recent-kind">· 판례</span></div>' +
        '<span class="pbox-lbox-recent-age">오늘</span>' +
      '</div>',
      '<div class="pbox-lbox-recent-line" role="button" tabindex="0" data-act="open-doc" data-id="prec-sc-2020da247190">' +
        '<div class="pbox-lbox-recent-left"><span class="pbox-lbox-recent-title">대법원 2024. 12. 19. 선고 2020다247190 전원합의체 판결</span><span class="pbox-lbox-recent-kind">· 판례</span></div>' +
        '<span class="pbox-lbox-recent-age">오늘</span>' +
      '</div>',
      '<div class="pbox-lbox-recent-line" role="button" tabindex="0" data-act="open-doc" data-id="interp-moleg-ordin-327105">' +
        '<div class="pbox-lbox-recent-left"><span class="pbox-lbox-recent-title">법제처 18-0687 법령해석 (지자체 생활임금 조례 적용 범위)</span><span class="pbox-lbox-recent-kind">· 유권해석</span></div>' +
        '<span class="pbox-lbox-recent-age">어제</span>' +
      '</div>',
      '<div class="pbox-lbox-recent-line" role="button" tabindex="0" data-act="open-doc" data-id="ordin-seoul-living-wage">' +
        '<div class="pbox-lbox-recent-left"><span class="pbox-lbox-recent-title">서울특별시 생활임금 조례 (서울특별시조례 제8993호)</span><span class="pbox-lbox-recent-kind">· 조례</span></div>' +
        '<span class="pbox-lbox-recent-age">어제</span>' +
      '</div>',
      '<div class="pbox-lbox-recent-line" role="button" tabindex="0" data-act="open-law" data-dir="근로기준법" data-file="법률(법률).md">' +
        '<div class="pbox-lbox-recent-left"><span class="pbox-lbox-recent-title">근로기준법 (현행 법률 전문)</span><span class="pbox-lbox-recent-kind">· 법령</span></div>' +
        '<span class="pbox-lbox-recent-age">어제</span>' +
      '</div>'
    ].join('');

    var recentLinesHtml = recents.length ? recents.map(function (r) {
      var clickAttr = r.kind === 'law'
        ? ('data-act="open-law" data-dir="' + esc(r.lawDir) + '" data-file="' + esc(r.fileName) + '"')
        : ('data-act="open-doc" data-id="' + esc(String(r.id || '').replace(/^doc:/, '')) + '"');
      return '<div class="pbox-lbox-recent-line" role="button" tabindex="0" ' + clickAttr + '>' +
        '<div class="pbox-lbox-recent-left">' +
          '<span class="pbox-lbox-recent-title">' + esc(r.title) + '</span>' +
          '<span class="pbox-lbox-recent-kind">· ' + esc(recentKindLabel(r)) + '</span>' +
        '</div>' +
        '<span class="pbox-lbox-recent-age">' + esc(formatRelativeDay(r.viewedAt)) + '</span>' +
      '</div>';
    }).join('') : defaultRecentsHtml;

    var projBodyHtml = '';
    if (projects.length) {
      projBodyHtml = '<div class="pbox-lbox-recent-list">' + projects.map(function (p) {
        var totalItems = (p.docIds || []).length + (p.lawKeys || []).length + (p.drafts || []).length;
        return '<div class="pbox-lbox-recent-line" role="button" tabindex="0" data-act="open-project" data-id="' + esc(p.id) + '">' +
          '<div class="pbox-lbox-recent-left">' +
            '<span class="pbox-lbox-recent-title">' + esc(p.name) + (p.clientName ? ' (' + esc(p.clientName) + ')' : '') + '</span>' +
            '<span class="pbox-lbox-recent-kind">· 자료 ' + totalItems + '건</span>' +
          '</div>' +
          '<span class="pbox-lbox-recent-age">' + esc(formatRelativeDay(p.updatedAt)) + '</span>' +
        '</div>';
      }).join('') + '</div>';
    } else if (!state.hideHomeEmptyProjects) {
      projBodyHtml = [
        '<div class="pbox-lbox-empty-proj">',
        '  <div class="pbox-lbox-empty-msg">최근 본 프로젝트가 없습니다.</div>',
        '  <div class="pbox-btn-group" style="justify-content:center">',
        '    <button type="button" class="pbox-btn-sm" data-act="create-project-prompt">+ 새 프로젝트</button>',
        '    <button type="button" class="pbox-btn-sm" data-act="toggle-hide-home-proj">숨기기</button>',
        '  </div>',
        '</div>'
      ].join('\n');
    }

    var quickKwHtml = HOME_QUICK_KEYWORDS.map(function (kw) {
      return '<button type="button" class="pbox-kw-chip" data-act="jump-cases-query" data-q="' + esc(kw.q) + '">' + esc(kw.label) + '</button>';
    }).join('');

    return [
      '<div class="pbox-home-wrap">',
      '  <div class="pbox-home-stage">',
      '    <div class="pbox-hero-bar">',
      '      <h1 class="pbox-hero-greeting">' + esc(state.userName) + '님, 무엇을 찾으시나요?</h1>',
      (state.hideHomeAssist
        ? '      <button type="button" id="pboxRestoreAssistBtn" class="pbox-link-btn" data-act="toggle-home-assist">자동제안 켜기</button>'
        : '      <button type="button" id="pboxRestoreAssistBtn" class="pbox-link-btn" data-act="toggle-home-assist" style="display:none">자동제안 켜기</button>'),
      '    </div>',
      '    <div class="pbox-scope-row" role="navigation" aria-label="빠른 검색 영역 이동">',
      '      <button type="button" class="pbox-scope-tab active" aria-current="true" data-act="home-scope-jump" data-scope="all">통합검색</button>',
      '      <button type="button" class="pbox-scope-tab" data-act="home-scope-jump" data-scope="prec_group">판례 전체</button>',
      '      <button type="button" class="pbox-scope-tab" data-act="home-scope-jump" data-scope="dec_nlrc">심판·재결</button>',
      '      <button type="button" class="pbox-scope-tab" data-act="home-scope-jump" data-scope="interp_group">행정·유권해석</button>',
      '      <button type="button" class="pbox-scope-tab" data-act="home-scope-jump" data-scope="laws">법령·조문</button>',
      '      <button type="button" class="pbox-scope-tab" data-act="home-scope-jump" data-scope="kcplaa">노무사회 자료</button>',
      '      <button type="button" class="pbox-scope-tab" data-act="home-scope-jump" data-scope="sites">외부 사이트</button>',
      '    </div>',
      '    <div class="pbox-composer-card">',
      '      <div id="pboxVoiceBannerSlot"></div>',
      (chipsHtml ? ('      <div class="pbox-att-row">' + chipsHtml + '</div>') : ''),
      '      <textarea id="pboxPromptInput" class="pbox-composer-ta" rows="2" aria-label="검색어 및 사실관계 입력" placeholder="내용 입력 (@ 입력 시 자료 첨부) — 검색어, 사건번호 또는 사실관계 입력">' + esc(state.homePromptDraft || '') + '</textarea>',
      '      <div class="pbox-composer-bar">',
      '        <div class="pbox-composer-left">',
      '          <button type="button" class="pbox-plus-btn" data-act="open-attach-modal" title="원문 첨부 (@)" aria-label="자료 첨부 (@)">＋ 첨부</button>',
      '          <button type="button" class="pbox-voice-btn" data-act="toggle-voice-input" data-voice-target="home" aria-pressed="false">🎤 음성설명</button>',
      '          <button type="button" class="pbox-qa-pill" data-act="start-new-doc"' + sendDisabled + '>새 문서로 시작</button>',
      '          <button type="button" class="pbox-qa-pill" data-act="open-review-file"' + sendDisabled + '>' + (state.reviewFileBusy ? '문서 읽는 중…' : '문서 열기') + '</button>',
      '          <input type="file" id="pboxReviewFileInput" accept=".pdf,.txt,.md,.json" style="display:none" aria-label="내용 검토할 문서 파일 선택">',
      '        </div>',
      '        <div class="pbox-composer-right">',
      '          <div class="pbox-mode-seg" role="group" aria-label="작업 모드 선택">',
      modes.map(function (m) {
        var isAct = state.promptMode === m.id;
        return '<button type="button" class="pbox-mode-btn' + (isAct ? ' active' : '') + '" aria-pressed="' + (isAct ? 'true' : 'false') + '" data-act="set-mode" data-mode="' + esc(m.id) + '">' + esc(m.label) + '</button>';
      }).join(''),
      '          </div>',
      '          <button type="button" id="pboxSendBtn" class="pbox-send-btn" data-act="submit-prompt"' + sendDisabled + ' aria-label="검색 또는 내용 검토 실행">' + esc(submitLabel) + '</button>',
      '        </div>',
      '      </div>',
      '    </div>',
      '    <div id="pboxLiveFactReview">' + buildLiveFactReviewHtml(state.homePromptDraft || '') + '</div>',
      '    <div class="pbox-kw-row">',
      '      <div class="pbox-kw-chips">' + quickKwHtml + '</div>',
      '      <button type="button" class="pbox-link-btn" data-act="go-view" data-view="workflows">워크플로 라이브러리 →</button>',
      '    </div>',
      '    <div class="pbox-home-dash-grid">',
      '      <section class="pbox-lbox-sec" aria-label="최근 본 자료">',
      '        <div class="pbox-lbox-sec-hd"><span>최근 본 자료</span><button type="button" class="pbox-link-btn" data-act="go-view" data-view="recents">전체보기</button></div>',
      '        <div class="pbox-lbox-recent-list">' + recentLinesHtml + '</div>',
      '      </section>',
      '      <section class="pbox-lbox-sec" aria-label="최근 본 프로젝트">',
      '        <div class="pbox-lbox-sec-hd"><span>프로젝트</span>' +
        (state.hideHomeEmptyProjects && !projects.length
          ? '<button type="button" class="pbox-link-btn" data-act="toggle-hide-home-proj">다시 표시</button>'
          : '<button type="button" class="pbox-link-btn" data-act="go-view" data-view="projects">관리</button>') +
      '        </div>',
      projBodyHtml,
      '      </section>',
      '    </div>',
      '  </div>',
      '</div>'
    ].join('\n');
  }

  /* ── 1-B) 엘박스형 내용 검토 · 문서 작성 통합 워크스페이스 (100% 전체화면 2단 분할: 좌측 AI 검토서 · 우측 법령/판례/결정례/행정해석 한번에 보기) ── */
  function buildWorkspaceHtml() {
    if (state.aiBusy && !state.activeThread) {
      return '<div class="pbox-ws-wrap"><div class="pbox-card" role="status" aria-live="polite"><div class="pbox-loading-line">⏳ 문서 조항 및 검증된 법령·판례·결정례·행정해석 원문을 한 번에 대조하여 검토서를 작성하고 있습니다…</div></div></div>';
    }
    var th = state.activeThread;
    if (!th) {
      th = global.PuPBoxStore.saveThread({
        title: '새 문서 · 내용 검토',
        query: '',
        answer: '',
        mode: 'review',
        sourceText: '',
        workflowStyle: 'lbox'
      });
      state.activeThread = th;
      state.workspaceTab = 'editor';
    }

    var E = global.PuPBoxEngine;
    var curStance = (th && th.stance) || state.reviewStance || 'neutral';
    var modeInfo = threadModeBadge(th.mode);
    var combinedWsText = String((th.sourceText || '') + '\n' + (th.query || '')).trim();
    var diag = E.analyzeDocumentClauses(th.sourceText || th.query || '');
    var redlineInfo = (E && typeof E.buildClauseRedlineTable === 'function')
      ? E.buildClauseRedlineTable(diag)
      : { rows: [], markdown: '' };
    var timelineInfo = (E && typeof E.extractFactTimeline === 'function')
      ? E.extractFactTimeline(combinedWsText)
      : { events: [], suggestedBaseDate: '', suggestedBaseLabel: '', markdown: '' };
    var effBaseDate = state.deadlineBaseDate || timelineInfo.suggestedBaseDate || E.todayKstYmd();
    var dlInfo = (E && typeof E.calculateLaborDeadlines === 'function')
      ? E.calculateLaborDeadlines(effBaseDate, E.todayKstYmd())
      : { valid: false, items: [], markdown: '' };
    var vf = th.verification || { items: [], verifiedCount: 0, unverifiedCount: 0 };
    var vfBadges = (vf.items || []).filter(function (it) { return it && typeof it === 'object'; }).map(function (it) {
      if (it.verified) {
        var clickAttrs = it.kind === 'law'
          ? ('data-act="open-law" data-dir="' + esc(it.lawDir) + '" data-file="' + esc(it.fileName || '') + '" data-art="' + esc(it.articleNo || '') + '"')
          : (it.targetId ? ('data-act="open-doc" data-id="' + esc(it.targetId) + '"') : '');
        return '<button type="button" class="pbox-cite-chip ok" ' + clickAttrs + ' title="' + esc(it.matchedTitle) + '">✓ 원문확인: ' + esc(it.raw) + '</button>';
      }
      if (it.status === 'unfetched_law' && it.lawDir) {
        return '<button type="button" class="pbox-cite-chip unfetched" data-act="open-law" data-dir="' + esc(it.lawDir) + '" data-file="' + esc(it.fileName || '') + '" data-art="' + esc(it.articleNo || '') + '" title="' + esc(it.matchedTitle) + '">📖 클릭해 조문검증: ' + esc(it.raw) + '</button>';
      }
      return '<span class="pbox-cite-chip warn" title="' + esc(it.matchedTitle) + '">⚠ 원문미확인: ' + esc(it.raw) + '</span>';
    }).join('');

    var wsSeed = String((th.query || '') + ' ' + (th.sourceText ? th.sourceText.slice(0, 500) : '')).trim() ||
      String(th.title || '').replace(/^새 문서.*$/, '').trim();
    var wsSearchRes = (E && typeof E.searchUnifiedAllInOne === 'function')
      ? E.searchUnifiedAllInOne(wsSeed, {
          docs: global.PuPBoxStore.getDocs(),
          loadedLaws: global.PuPBoxStore.getLoadedLaws(),
          lawIndex: global.PuPBoxLawIndex ? global.PuPBoxLawIndex.list() : [],
          limit: 80,
          ragLimit: 8
        })
      : null;

    var busyAttr = state.aiBusy ? ' disabled aria-busy="true"' : '';
    var tabBodyHtml = '';

    if (state.workspaceTab === 'clauses') {
      var redlineRowsHtml = redlineInfo.rows.map(function (r) {
        var bCls = r.severity === 'high' ? 'pbox-badge-red' : 'pbox-badge-amber';
        return '<tr>' +
          '<td data-label="조항"><span class="' + bCls + '">' + esc(r.badge) + '</span><br><strong>' + esc(r.clauseLabel) + '</strong></td>' +
          '<td data-label="현행 원문">' + esc(r.currentExcerpt) + '</td>' +
          '<td data-label="위반 위험·근거">' + esc(r.riskAndBasis) + '</td>' +
          '<td data-label="적법 수정안">' + esc(r.revisedSuggestion) + '</td>' +
        '</tr>';
      }).join('');

      tabBodyHtml = [
        '<div class="pbox-sec-hd">',
        '  <span>⚖️ 조항별 강행법규 위반 · 위험 진단 (고위험 <b>' + diag.highCount + '</b>건 · 주의 <b>' + diag.warnCount + '</b>건 / 분석 단위 ' + diag.clauseCount + '개)</span>',
        '  <div class="pbox-btn-group">',
        (diag.findings.length ? '    <button type="button" class="pbox-btn-sm" data-act="copy-redline-md">📋 신·구 대비표 복사</button>' : ''),
        (diag.findings.length ? '    <button type="button" class="pbox-btn-sm" data-act="apply-all-clause-fixes">✨ 전체 수정안 일괄 반영</button>' : ''),
        '    <button type="button" class="pbox-btn-sm" data-act="set-ws-tab" data-tab="editor">✎ 원문 편집</button>',
        '  </div>',
        '</div>',
        (diag.findings.length ? [
          '<details class="pbox-slim-drawer" open style="margin-bottom:12px">',
          '  <summary>신·구 조항 대비표 (Redline 자문표 · ' + redlineInfo.rows.length + '건)</summary>',
          '  <div class="pbox-matrix-wrap" style="margin-top:8px">',
          '    <table class="pbox-matrix-table" aria-label="신·구 조항 대비표">',
          '      <thead><tr><th style="width:130px">조항 · 등급</th><th>현행 원문 발췌</th><th>법적 위험 · 근거</th><th>적법 수정 권고안 (Redline)</th></tr></thead>',
          '      <tbody>' + redlineRowsHtml + '</tbody>',
          '    </table>',
          '  </div>',
          '</details>',
          '<div class="pbox-clause-list">' + diag.findings.map(function (f, idx) {
            var sevCls = f.severity === 'high' ? 'high' : 'warn';
            var badgeCls = f.severity === 'high' ? 'pbox-badge-red' : 'pbox-badge-amber';
            return '<div class="pbox-clause-card ' + sevCls + '">' +
              '<div class="pbox-clause-top">' +
                '<div><span class="' + badgeCls + '">' + esc(f.badge) + '</span> <strong>[' + esc(f.clauseLabel) + '] ' + esc(f.title) + '</strong></div>' +
                '<span class="pbox-muted">' + esc(f.basis) + '</span>' +
              '</div>' +
              '<div class="pbox-clause-quote">원문 발췌: ' + esc(f.excerpt) + '</div>' +
              '<div class="pbox-md-p"><strong>위험 요지:</strong> ' + esc(f.issue) + '</div>' +
              '<div class="pbox-clause-suggest">' +
                '<div><strong>권고 수정문안:</strong> ' + esc(f.suggestion) + '</div>' +
                '<div style="margin-top:8px"><button type="button" class="pbox-btn-sm" data-act="apply-clause-fix" data-idx="' + idx + '">✎ 권고 수정문안을 문서 원문에 반영</button></div>' +
              '</div>' +
            '</div>';
          }).join('') + '</div>'
        ].join('\n') : [
          '<div class="pbox-card pbox-empty-box">',
          '  현재 입력된 문서에서 자동 탐지된 강행규정 위반 조항이 없거나 아직 검토할 계약서·취업규칙 본문이 입력되지 않았습니다.<br>',
          '  <div class="pbox-btn-group" style="justify-content:center;margin-top:10px">',
          '    <button type="button" class="pbox-btn-sm" data-act="load-ws-sample" data-sample="freelancer">용역(프리랜서) 계약서 샘플 불러오기</button>',
          '    <button type="button" class="pbox-btn-sm" data-act="load-ws-sample" data-sample="blanket_wage">포괄임금 근로계약서 샘플 불러오기</button>',
          '    <button type="button" class="pbox-btn-primary" data-act="set-ws-tab" data-tab="editor">✎ 원문 직접 입력</button>',
          '  </div>',
          '</div>'
        ].join('\n'))
      ].join('\n');
    } else if (state.workspaceTab === 'timeline') {
      var dlRowsHtml = (dlInfo.items || []).map(function (it) {
        var stBadge = it.status === 'expired'
          ? '<span class="pbox-badge-red">' + esc(it.dDayLabel) + '</span>'
          : (it.status === 'urgent'
              ? '<span class="pbox-badge-amber">' + esc(it.dDayLabel) + '</span>'
              : '<span class="pbox-badge-green">' + esc(it.dDayLabel) + '</span>');
        return '<tr>' +
          '<td data-label="절차·항목"><strong>' + esc(it.title) + '</strong></td>' +
          '<td data-label="법정 기준">' + esc(it.ruleLabel) + '</td>' +
          '<td data-label="만료 예정일"><span class="pbox-mono"><strong>' + esc(it.dueDate) + '</strong></span>' +
            (it.weekendExtended ? ' <span class="pbox-badge-blue" title="' + esc(it.weekendNote) + '">주말연장</span>' : '') + '</td>' +
          '<td data-label="기한 상태">' + stBadge + '</td>' +
          '<td data-label="근거 법령"><span class="pbox-muted">' + esc(it.basis) + '</span></td>' +
        '</tr>';
      }).join('');

      var tlRowsHtml = (timelineInfo.events || []).map(function (evItem) {
        return '<tr>' +
          '<td data-label="일자"><span class="pbox-mono"><strong>' + esc(evItem.date) + '</strong></span></td>' +
          '<td data-label="구분"><span class="pbox-badge-blue">' + esc(evItem.category) + '</span></td>' +
          '<td data-label="사실관계 내용">' + esc(evItem.summary) + '</td>' +
        '</tr>';
      }).join('');

      tabBodyHtml = [
        '<div class="pbox-card pbox-flat-m" style="margin-bottom:12px">',
        '  <div class="pbox-sec-hd">',
        '    <span>⏱️ 노동사건 제척기간 · 불복기한 · 소멸시효 자동 계산 (민법 제157조 초일불산입 · 제161조 주말연장 반영)</span>',
        '    <button type="button" class="pbox-btn-sm" data-act="copy-deadlines-md">📋 기한산정표 복사</button>',
        '  </div>',
        '  <div class="pbox-adv-row" style="margin-top:0;padding-top:0;margin-bottom:10px;border-top:none">',
        '    <label class="pbox-label" for="pboxDeadlineBaseInput">처분·해고·퇴직·판정서 송달일</label>',
        '    <input type="date" id="pboxDeadlineBaseInput" class="pbox-select-sm" aria-label="제척기간 산정 기준일" value="' + esc(effBaseDate) + '">',
        (timelineInfo.suggestedBaseLabel
          ? '    <button type="button" class="pbox-btn-sm" data-act="use-detected-base-date" data-date="' + esc(timelineInfo.suggestedBaseDate) + '">문서 포착일 적용: ' + esc(timelineInfo.suggestedBaseLabel) + '</button>'
          : ''),
        (dlInfo.valid ? '    <span class="pbox-muted">초일불산입 기산일: <b>' + esc(dlInfo.startCountDate) + '</b></span>' : ''),
        '  </div>',
        '  <div class="pbox-matrix-wrap">',
        '    <table class="pbox-matrix-table" aria-label="법정 제척기간 및 소멸시효 산정표">',
        '      <thead><tr><th>절차 · 권리구제 항목</th><th>법정 산정 기준</th><th style="width:140px">만료 예정일</th><th style="width:110px">기한 상태</th><th>근거 법령</th></tr></thead>',
        '      <tbody>' + dlRowsHtml + '</tbody>',
        '    </table>',
        '  </div>',
        '  <div class="pbox-muted" style="margin-top:8px">※ 만료일이 법정공휴일·대체공휴일·근로자의 날인 경우 민법 제161조에 따라 그 익일(다음 평일)로 만료됩니다.</div>',
        '</div>',
        '<div class="pbox-card pbox-flat-m">',
        '  <div class="pbox-sec-hd">',
        '    <span>📅 사실관계 일자별 연표 자동 추출 (' + timelineInfo.events.length + '건)</span>',
        '    <div class="pbox-btn-group">',
        (timelineInfo.events.length ? '      <button type="button" class="pbox-btn-sm" data-act="copy-timeline-md">📋 연표 복사</button>' : ''),
        (timelineInfo.events.length ? '      <button type="button" class="pbox-btn-sm" data-act="insert-timeline-editor">✎ 서면 편집창에 추가</button>' : ''),
        '    </div>',
        '  </div>',
        (timelineInfo.events.length ? [
          '  <div class="pbox-matrix-wrap">',
          '    <table class="pbox-matrix-table" aria-label="사실관계 일자별 연표">',
          '      <thead><tr><th style="width:115px">일자</th><th style="width:120px">구분</th><th>사실관계 내용 (원문 기반 시간순 정렬)</th></tr></thead>',
          '      <tbody>' + tlRowsHtml + '</tbody>',
          '    </table>',
          '  </div>'
        ].join('\n') : '  <div class="pbox-empty-mini">원문 또는 질의에 날짜(예: 2026. 3. 15., 2026년 5월 1일)가 포함되면 시간순 기초사실 연표가 이곳에 자동 생성됩니다.</div>'),
        '</div>'
      ].join('\n');
    } else if (state.workspaceTab === 'editor') {
      tabBodyHtml = [
        '<div class="pbox-card pbox-flat-m">',
        '  <div class="pbox-sec-hd">',
        '    <span>✎ 검토 대상 계약서 · 취업규칙 · 서면 원문 편집' + (th.sourceFileName ? ' <span class="pbox-badge-gray">' + esc(th.sourceFileName) + '</span>' : '') + '</span>',
        '    <div class="pbox-btn-group">',
        '      <button type="button" class="pbox-btn-sm" data-act="load-ws-sample" data-sample="freelancer">샘플: 용역계약서</button>',
        '      <button type="button" class="pbox-btn-sm" data-act="load-ws-sample" data-sample="blanket_wage">샘플: 포괄임금계약서</button>',
        '      <button type="button" class="pbox-btn-sm" data-act="load-ws-sample" data-sample="work_rules">샘플: 취업규칙변경안</button>',
        '    </div>',
        '  </div>',
        '  <textarea id="pboxWsSourceTa" class="pbox-textarea" rows="13" aria-label="검토 대상 문서 원문 입력" placeholder="검토할 근로계약서, 용역(프리랜서)계약서, 취업규칙, 징계·해고 통지서 또는 서면 초안 전문을 붙여넣으세요. (주민등록번호·실명·연락처·계좌번호는 저장 및 AI 검토 전 자동 비식별화됩니다)">' + esc(th.sourceText || '') + '</textarea>',
        '  <div class="pbox-btn-group" style="margin-top:10px">',
        '    <button type="button" class="pbox-btn-sm" data-act="save-ws-source">💾 본문 저장 · 위험진단 갱신</button>',
        '    <button type="button" class="pbox-btn-primary" data-act="run-ws-quick-review" data-q="위 문서의 강행법규 위반 여부, 조항별 위험도, 관련 대법원·하급심 판례 및 행정해석·적법 수정문안을 종합 검토해 주세요."' + busyAttr + '>✦ 이 문서 전체 내용 검토 실행</button>',
        '  </div>',
        '</div>'
      ].join('\n');
    } else {
      var followChips = (E && typeof E.buildFollowUpQuestions === 'function')
        ? E.buildFollowUpQuestions({ query: th.query || '', sourceText: th.sourceText || '', stance: curStance })
        : [];
      var followBtnsHtml = followChips.map(function (fc) {
        return '  <button type="button" class="pbox-btn-sm" data-act="run-ws-quick-review" data-q="' + esc(fc.query) + '"' + busyAttr + '>' + esc(fc.label) + '</button>';
      }).join('\n');

      var wsHlTerms = (E && typeof E.extractHighlightTerms === 'function')
        ? E.extractHighlightTerms((th.query || th.title || ''), '')
        : [];
      var reqKwBarHtml = wsHlTerms.length
        ? ('<div class="pbox-req-kw-bar" aria-label="요청 핵심어 강조 표시"><span>🔍 요청 핵심어:</span>' +
            wsHlTerms.slice(0, 8).map(function (kw) {
              return '<mark class="pbox-hl">' + esc(kw) + '</mark>';
            }).join('') +
          '</div>')
        : '';

      tabBodyHtml = [
        (state.aiBusy ? '<div class="pbox-info-note" role="status" aria-live="polite">⏳ 요청하신 내용 검토·수정 사항을 법령·판례·결정례·행정해석 원문과 대조하여 반영하고 있습니다…</div>' : ''),
        (th.answer ? [
          '<div class="pbox-card pbox-flat-m">',
          '  <details class="pbox-cite-details"' + (vf.unverifiedCount > 0 ? ' open' : '') + '>',
          '    <summary>',
          '      <span class="pbox-cite-summary" style="margin-bottom:0">🛡️ 원문 인용 검증: 확인 <b>' + vf.verifiedCount + '</b>건 · 미확인 <b>' + vf.unverifiedCount + '</b>건 <span class="pbox-muted">(' + esc(th.engineLabel || 'P박스 검토 엔진') + ')</span></span>',
          '      <span class="pbox-cite-toggle">검증 근거 목록 ▾</span>',
          '    </summary>',
          '    <div class="pbox-cite-chips">' + (vfBadges || '<span class="pbox-muted">인용 배지 또는 우측 근거 카드를 누르면 원문 리더가 열립니다.</span>') + '</div>',
          '  </details>',
          reqKwBarHtml,
          '  <div class="pbox-md-body">' + formatSimpleMd(th.answer, wsHlTerms) + '</div>',
          '</div>'
        ].join('\n') : [
          '<div class="pbox-card pbox-empty-box">',
          '  아직 생성된 검토 의견서·서면 초안이 없습니다. [검토 대상 원문 · 편집] 탭에 문서를 넣거나 아래 지시창·음성설명으로 바로 시작하세요.<br>',
          '  <div class="pbox-btn-group" style="justify-content:center;margin-top:10px">',
          '    <button type="button" class="pbox-btn-sm" data-act="set-ws-tab" data-tab="editor">✎ 원문 입력 탭 열기</button>',
          '    <button type="button" class="pbox-btn-primary" data-act="run-ws-quick-review" data-q="입력된 문서의 강행법규 위반 여부와 관련 판례·행정해석 및 적법 수정문안을 검토해 주세요."' + busyAttr + '>✦ AI 내용 검토 실행</button>',
          '  </div>',
          '</div>'
        ].join('\n')),
        '<div class="pbox-btn-group" style="margin-top:12px">',
        followBtnsHtml,
        '</div>',
        '<div class="pbox-ws-follow-bar">',
        '  <input type="text" id="pboxWsFollowInput" class="pbox-input" aria-label="후속 검토 지시 또는 서면 수정 요청" placeholder="추가 사실관계·보완 지시 입력 (Enter 즉시 반영 · 🎤 음성설명 · @ 자료첨부)">',
        '  <button type="button" class="pbox-voice-btn" data-act="toggle-voice-input" data-voice-target="ws" aria-pressed="false" title="마이크로 추가 사실관계를 말하면 자동으로 검토에 반영합니다"' + busyAttr + '>🎤 음성설명</button>',
        '  <button type="button" class="pbox-btn-primary" data-act="submit-ws-followup"' + busyAttr + '>↑ 후속 반영</button>',
        '</div>'
      ].join('\n');
    }

    var stanceItems = [
      { id: 'neutral', label: '중립' },
      { id: 'worker', label: '근로자측' },
      { id: 'employer', label: '사용자측' }
    ];
    var stanceSegHtml = '<div class="pbox-mode-seg" role="group" aria-label="대리 및 검토 관점 선택">' +
      stanceItems.map(function (st) {
        var isActSt = curStance === st.id;
        return '<button type="button" class="pbox-mode-btn' + (isActSt ? ' active' : '') + '" aria-pressed="' + (isActSt ? 'true' : 'false') + '" data-act="set-ws-stance" data-stance="' + esc(st.id) + '">' + esc(st.label) + '</button>';
      }).join('') +
    '</div>';

    var wsRightHtml = '<aside class="pbox-ws-side" aria-label="관련 법령 판례 결정례 행정해석 통합 대조">' +
      buildUnifiedAuthoritiesHtml(wsSearchRes, wsSeed, {
        tabbed: true,
        heading: '관련 법령 · 판례 · 결정례 · 행정해석 한번에 보기'
      }) +
    '</aside>';

    return [
      '<div class="pbox-ws-wrap">',
      '  <div class="pbox-ws-head">',
      '    <div class="pbox-ws-title-row">',
      '      <button type="button" class="pbox-btn-sm" data-act="go-view" data-view="home">← 홈</button>',
      '      <span class="' + modeInfo.cls + '">' + esc(modeInfo.label) + '</span>',
      '      <input type="text" id="pboxWsTitleInput" class="pbox-ws-title-input" aria-label="작업 문서 제목" value="' + esc(th.title || '내용 검토 작업') + '">',
      '      <button type="button" class="pbox-btn-sm" data-act="save-ws-meta">제목 저장</button>',
      '    </div>',
      '    <div class="pbox-btn-group">',
      '      <button type="button" class="pbox-btn-sm" data-act="open-review-file"' + busyAttr + '>📂 문서 열기</button>',
      '      <input type="file" id="pboxReviewFileInput" accept=".pdf,.txt,.md,.json" style="display:none" aria-label="내용 검토할 문서 파일 선택">',
      '      <button type="button" class="pbox-btn-primary" data-act="open-handoff-modal">📝 의견서·서면 연결 작성</button>',
      '      <button type="button" class="pbox-btn-sm" data-act="quick-open-hangul">🖋️ 한글 바로 열기</button>',
      '      <button type="button" class="pbox-btn-sm" data-act="export-thread-hwpx">📥 한글(.hwpx)</button>',
      '      <button type="button" class="pbox-btn-sm" data-act="export-thread-doc">📄 Word(.doc)</button>',
      '      <button type="button" class="pbox-btn-sm" data-act="save-thread-proj">📁 프로젝트 담기</button>',
      '    </div>',
      '  </div>',
      '  <div id="pboxVoiceBannerSlot"></div>',
      '  <div id="pboxWsGrid" class="pbox-ws-grid' + (state.readerOpen ? ' reader-open' : '') + '">',
      '    <div>',
      '      <div class="pbox-ws-tabs-bar">',
      '        <div class="pbox-ws-tabs" role="tablist" aria-label="내용 검토 워크스페이스 탭">',
      '          <button type="button" role="tab" aria-selected="' + (state.workspaceTab === 'report' ? 'true' : 'false') + '" class="pbox-ws-tab' + (state.workspaceTab === 'report' ? ' active' : '') + '" data-act="set-ws-tab" data-tab="report">✦ 검토 의견서</button>',
      '          <button type="button" role="tab" aria-selected="' + (state.workspaceTab === 'clauses' ? 'true' : 'false') + '" class="pbox-ws-tab' + (state.workspaceTab === 'clauses' ? ' active' : '') + '" data-act="set-ws-tab" data-tab="clauses">⚖️ 위험 진단 (' + diag.findings.length + ')</button>',
      '          <button type="button" role="tab" aria-selected="' + (state.workspaceTab === 'timeline' ? 'true' : 'false') + '" class="pbox-ws-tab' + (state.workspaceTab === 'timeline' ? ' active' : '') + '" data-act="set-ws-tab" data-tab="timeline">📅 연표 · 기한 (' + timelineInfo.events.length + ')</button>',
      '          <button type="button" role="tab" aria-selected="' + (state.workspaceTab === 'editor' ? 'true' : 'false') + '" class="pbox-ws-tab' + (state.workspaceTab === 'editor' ? ' active' : '') + '" data-act="set-ws-tab" data-tab="editor">✎ 원문 편집</button>',
      '        </div>',
      '        <div class="pbox-btn-group">' + stanceSegHtml + '<button type="button" class="pbox-btn-sm" data-act="open-attach-modal">@ 첨부 (' + state.attached.length + ')</button></div>',
      '      </div>',
      tabBodyHtml,
      '    </div>',
      wsRightHtml,
      '  </div>',
      '</div>'
    ].join('\n');
  }

  /* ── 1-C) 최근 본 자료 관리 화면 (recents 뷰 — 체크박스·번호 규격 표) ── */
  function buildRecentsHtml() {
    var recents = global.PuPBoxStore.getRecents();
    var selCnt = state.selectedRecentIds.size;
    var allSel = recents.length > 0 && recents.every(function (r) { return state.selectedRecentIds.has(r.id); });

    return [
      '<div class="pbox-page-wrap">',
      (selCnt > 0 ? [
        '  <div class="pbox-bulk-bar">',
        '    <span>선택 <b>' + selCnt + '</b>건</span>',
        '    <div class="pbox-btn-group">',
        '      <button type="button" class="pbox-btn-sm" data-act="bulk-attach-recents">@ AI 검토에 첨부</button>',
        '      <button type="button" class="pbox-btn-sm" data-act="bulk-proj-recents">📁 프로젝트에 담기</button>',
        '      <button type="button" class="pbox-btn-sm" data-act="bulk-del-recents">🗑 열람 기록 삭제</button>',
        '      <button type="button" class="pbox-btn-sm" data-act="clear-recent-sel">선택 해제</button>',
        '    </div>',
        '  </div>'
      ].join('\n') : ''),
      '  <div class="pbox-card pbox-list-card">',
      '    <div class="pbox-sec-hd"><span>🕘 최근 본 자료 <b>' + recents.length + '</b>건</span><span class="pbox-muted">제목을 누르면 오른쪽 원문 리더가 열립니다</span></div>',
      '    <div class="pbox-table-wrap">',
      '      <table class="pbox-table" aria-label="최근 본 자료 목록">',
      '        <thead><tr>',
      '          <th class="col-chk"><label class="pbox-chk-tap"><input type="checkbox" data-act="toggle-all-recents" aria-label="최근 본 자료 전체 선택"' + (allSel ? ' checked' : '') + '></label></th>',
      '          <th class="col-num">번호</th>',
      '          <th style="width:96px">구분</th>',
      '          <th>자료명</th>',
      '          <th style="width:200px">기관 · 사건번호 · 시행정보</th>',
      '          <th style="width:92px">열람시점</th>',
      '          <th style="width:126px">동작</th>',
      '        </tr></thead>',
      '        <tbody>',
      (recents.length ? recents.map(function (r, idx) {
        var chk = state.selectedRecentIds.has(r.id) ? ' checked' : '';
        var kLabel = recentKindLabel(r);
        var openAttrs = r.kind === 'law'
          ? ('data-act="open-law" data-dir="' + esc(r.lawDir) + '" data-file="' + esc(r.fileName) + '"')
          : ('data-act="open-doc" data-id="' + esc(String(r.id || '').replace(/^doc:/, '')) + '"');
        var attAttrs = r.kind === 'law'
          ? ('data-act="attach-law" data-dir="' + esc(r.lawDir) + '" data-file="' + esc(r.fileName) + '"')
          : ('data-act="attach-doc" data-id="' + esc(String(r.id || '').replace(/^doc:/, '')) + '"');
        return '<tr>' +
          '<td class="col-chk"><label class="pbox-chk-tap"><input type="checkbox" data-act="toggle-recent-chk" data-id="' + esc(r.id) + '" aria-label="' + esc(r.title) + ' 선택"' + chk + '></label></td>' +
          '<td class="col-num">' + (idx + 1) + '</td>' +
          '<td class="pbox-cell-hide-m"><span class="pbox-badge-gray">' + esc(kLabel) + '</span></td>' +
          '<td class="pbox-row-click pbox-cell-main" role="button" tabindex="0" ' + openAttrs + ' title="' + esc(r.title) + '"><strong>' + esc(r.title) + '</strong></td>' +
          '<td class="pbox-cell-meta" title="' + esc(r.sub || kLabel) + '">' + esc(r.sub || kLabel) + '</td>' +
          '<td class="col-num pbox-cell-hide-m">' + esc(formatRelativeDay(r.viewedAt)) + '</td>' +
          '<td class="pbox-cell-actions">' +
            '<button type="button" class="pbox-mini-act" ' + openAttrs + '>원문</button> ' +
            '<button type="button" class="pbox-mini-act" ' + attAttrs + '>@첨부</button>' +
          '</td>' +
        '</tr>';
      }).join('') : '<tr class="pbox-empty-row"><td colspan="7" class="pbox-empty-cell">최근 열람한 법령·판례·결정례가 없습니다. 홈 또는 판례·법령 메뉴에서 원문을 열어 보세요.</td></tr>'),
      '        </tbody>',
      '      </table>',
      '    </div>',
      '  </div>',
      '</div>'
    ].join('\n');
  }

  /* ── 1-D) 작업(내용검토·문서작성·검색) 통합 관리 화면 (tasks 뷰 — 체크박스·번호 규격 표) ── */
  function buildTasksHtml() {
    var threads = global.PuPBoxStore.getThreads();
    var selCnt = state.selectedTaskIds.size;
    var allSel = threads.length > 0 && threads.every(function (t) { return state.selectedTaskIds.has(t.id); });

    return [
      '<div class="pbox-page-wrap">',
      '  <div class="pbox-sec-hd" style="margin-bottom:12px">',
      '    <span>✦ 작업 이력 · 내용 검토 문서 관리 (' + threads.length + '건)</span>',
      '    <div class="pbox-btn-group">',
      '      <button type="button" class="pbox-btn-sm" data-act="open-review-file">📂 문서 열어 검토 시작</button>',
      '      <input type="file" id="pboxReviewFileInput" accept=".pdf,.txt,.md,.json" style="display:none" aria-label="내용 검토할 문서 파일 선택">',
      '      <button type="button" class="pbox-btn-primary" data-act="start-new-doc">📄 새 문서로 시작</button>',
      '    </div>',
      '  </div>',
      (selCnt > 0 ? [
        '  <div class="pbox-bulk-bar">',
        '    <span>선택 <b>' + selCnt + '</b>개 작업</span>',
        '    <div class="pbox-btn-group">',
        '      <button type="button" class="pbox-btn-sm" data-act="bulk-proj-tasks">📁 프로젝트에 일괄 보관</button>',
        '      <button type="button" class="pbox-btn-sm" data-act="bulk-del-tasks">🗑 선택 작업 삭제</button>',
        '      <button type="button" class="pbox-btn-sm" data-act="clear-task-sel">선택 해제</button>',
        '    </div>',
        '  </div>'
      ].join('\n') : ''),
      '  <div class="pbox-card pbox-list-card">',
      '    <div class="pbox-table-wrap">',
      '      <table class="pbox-table" aria-label="작업 관리 목록">',
      '        <thead><tr>',
      '          <th class="col-chk"><label class="pbox-chk-tap"><input type="checkbox" data-act="toggle-all-tasks" aria-label="작업 전체 선택"' + (allSel ? ' checked' : '') + '></label></th>',
      '          <th class="col-num">번호</th>',
      '          <th style="width:104px">작업 유형</th>',
      '          <th>작업 제목</th>',
      '          <th style="width:170px">관리체계 · 인용검증</th>',
      '          <th style="width:92px">최근 작업</th>',
      '          <th style="width:124px">동작</th>',
      '        </tr></thead>',
      '        <tbody>',
      (threads.length ? threads.map(function (th, idx) {
        var chk = state.selectedTaskIds.has(th.id) ? ' checked' : '';
        var mb = threadModeBadge(th.mode);
        var vfCnt = (th.verification && th.verification.verifiedCount) || 0;
        var metaTxt = (th.workflowStyle === 'pureun' ? '푸른방식' : '엘박스형') + (th.mode === 'search' ? ' · 검색기록' : (' · 인용확인 ' + vfCnt + '건'));
        return '<tr>' +
          '<td class="col-chk"><label class="pbox-chk-tap"><input type="checkbox" data-act="toggle-task-chk" data-id="' + esc(th.id) + '" aria-label="' + esc(th.title || th.query) + ' 선택"' + chk + '></label></td>' +
          '<td class="col-num">' + (idx + 1) + '</td>' +
          '<td class="pbox-cell-hide-m"><span class="' + mb.cls + '">' + esc(mb.label) + '</span></td>' +
          '<td class="pbox-row-click pbox-cell-main" role="button" tabindex="0" data-act="open-thread" data-id="' + esc(th.id) + '" title="' + esc(th.title || th.query) + '"><strong>' + esc(th.title || th.query) + '</strong></td>' +
          '<td class="pbox-cell-meta" title="' + esc(metaTxt) + '">' + esc(metaTxt) + '</td>' +
          '<td class="col-num pbox-cell-hide-m">' + esc(formatRelativeDay(th.updatedAt || th.createdAt)) + '</td>' +
          '<td class="pbox-cell-actions">' +
            '<button type="button" class="pbox-mini-act" data-act="open-thread" data-id="' + esc(th.id) + '">열기</button> ' +
            '<button type="button" class="pbox-mini-act" data-act="delete-single-task" data-id="' + esc(th.id) + '">삭제</button>' +
          '</td>' +
        '</tr>';
      }).join('') : '<tr class="pbox-empty-row"><td colspan="7" class="pbox-empty-cell">저장된 내용 검토·문서 작성 작업이 없습니다. [새 문서로 시작] 또는 [문서 열기]로 시작해 보세요.</td></tr>'),
      '        </tbody>',
      '      </table>',
      '    </div>',
      '  </div>',
      '</div>'
    ].join('\n');
  }

  /* ── 2) 개정·수집 알림 및 공식 데이터 채널 현황 ── */
  function buildAlertsHtml() {
    var alerts = global.PuPBoxStore.getAlerts();
    var sources = global.PuPBoxCorpus.OFFICIAL_SOURCES || [];
    var syncDisabled = state.syncBusy ? ' disabled aria-busy="true"' : '';
    return [
      '<div class="pbox-page-wrap">',
      '  <div class="pbox-card" style="margin-bottom:14px">',
      '    <div class="pbox-sec-hd">',
      '      <span>🔔 법령·판례 개정 및 자동 동기화 이력</span>',
      '      <div class="pbox-btn-group">',
      '        <button type="button" class="pbox-btn-sm" data-act="sync-core-pack"' + syncDisabled + '>📥 노동·공무원·군인·연결 핵심 40편 내려받기</button>',
      '        <button type="button" class="pbox-btn-primary" data-act="quick-sync"' + syncDisabled + '>🔄 지금 변경분 자동 동기화</button>',
      '      </div>',
      '    </div>',
      alerts.map(function (al) {
        return '<div class="pbox-alert-item">' +
          '<div class="pbox-alert-top"><span class="pbox-badge-blue">' + esc(al.date) + '</span> <strong>' + esc(al.title) + '</strong></div>' +
          '<div class="pbox-alert-desc">' + esc(al.detail) + '</div>' +
        '</div>';
      }).join(''),
      '  </div>',
      '  <div class="pbox-card">',
      '    <div class="pbox-sec-hd"><span>🏛️ 공식 합법 수집·연동 채널 (비공개 상용 DB 무단 복제 없이 100% 공식 원문)</span></div>',
      '    <div class="pbox-table-wrap">',
      '      <table class="pbox-table pbox-channel-table">',
      '        <thead><tr><th class="col-num">번호</th><th>공식 데이터 채널</th><th>제공 기관</th><th>비용·연동 상태</th><th>자동갱신 주기 · 수집 범위</th></tr></thead>',
      '        <tbody>',
      sources.map(function (s, idx) {
        return '<tr>' +
          '<td class="col-num">' + (idx + 1) + '</td>' +
          '<td class="pbox-cell-main" title="' + esc(s.name) + '"><strong>' + esc(s.name) + '</strong></td>' +
          '<td class="pbox-cell-meta" title="' + esc(s.agency + ' · ' + s.scope) + '">' + esc(s.agency) + '</td>' +
          '<td class="pbox-cell-actions" title="' + esc(s.tier) + '"><span class="' + (s.readyByDefault ? 'pbox-badge-green' : 'pbox-badge-amber') + '">' + esc(s.tier) + '</span></td>' +
          '<td class="pbox-cell-hide-m" title="' + esc(s.cycle + ' / ' + s.scope) + '">' + esc(s.scope) + '</td>' +
        '</tr>';
      }).join(''),
      '        </tbody>',
      '      </table>',
      '    </div>',
      '  </div>',
      '</div>'
    ].join('\n');
  }

  /* ── 3) 국가법령 전수함 (5,773편 전수 조회·초성/약칭 점프·일괄 오프라인 캐시) ── */
  function getFilteredLawFamilies() {
    var all = global.PuPBoxLawIndex ? global.PuPBoxLawIndex.list() : [];
    var E = global.PuPBoxEngine;
    var rawQ = state.lawQuery.trim();
    var q = rawQ.toLowerCase();
    var qNorm = q.replace(/\s+/g, '');
    var smartJump = (rawQ && E && typeof E.resolveSmartLawJump === 'function')
      ? E.resolveSmartLawJump(rawQ, all)
      : null;
    var resolvedNorm = smartJump && smartJump.lawTitle
      ? smartJump.lawTitle.toLowerCase().replace(/\s+/g, '')
      : '';
    var qIsChosung = !!(qNorm && E && typeof E.isChosungOnly === 'function' && E.isChosungOnly(qNorm));

    return all.filter(function (f) {
      if (state.lawCat === 'priority' && !f.priority) return false;
      if (state.lawCat !== 'all' && state.lawCat !== 'priority' && f.cat !== state.lawCat) return false;
      if (!q) return true;
      var hay = (f.title + ' ' + f.dir + ' ' + (f.dept || '')).toLowerCase();
      var hayNorm = hay.replace(/\s+/g, '');
      if (hay.indexOf(q) >= 0 || hayNorm.indexOf(qNorm) >= 0) return true;
      if (resolvedNorm && hayNorm.indexOf(resolvedNorm) >= 0) return true;
      if (qIsChosung && E && typeof E.extractChosung === 'function') {
        var cho = E.extractChosung(f.title + f.dir);
        if (cho.indexOf(qNorm) >= 0) return true;
      }
      return false;
    });
  }

  function buildLawsHtml() {
    var cats = global.PuPBoxCorpus.LAW_CATEGORIES || [];
    var E = global.PuPBoxEngine;
    var allIdx = global.PuPBoxLawIndex ? global.PuPBoxLawIndex.list() : [];
    var smartJump = (state.lawQuery.trim() && E && typeof E.resolveSmartLawJump === 'function')
      ? E.resolveSmartLawJump(state.lawQuery.trim(), allIdx)
      : null;
    var lawConnList = (state.lawQuery.trim() && E && typeof E.getConnectedLawsFor === 'function')
      ? E.getConnectedLawsFor((smartJump && smartJump.dir) || state.lawQuery.trim(), allIdx, 8)
      : [];
    var filtered = getFilteredLawFamilies();
    var visible = filtered.slice(0, state.lawPageLimit);
    var selCnt = state.selectedLawDirs.size;
    var allVisSelected = visible.length > 0 && visible.every(function (f) { return state.selectedLawDirs.has(f.dir); });
    var hlTerms = (state.lawQuery.trim() && E && typeof E.extractHighlightTerms === 'function')
      ? E.extractHighlightTerms(state.lawQuery.trim(), '')
      : [];

    var lawQuickExtIds = ['ilabor_portal', 'law_go_kr', 'lawnb', 'assembly_bill', 'lawmaking', 'gwanbo'];
    var allSites = global.PuPBoxCorpus.KOREA_LEGAL_SITES || [];
    var lawExtBtns = lawQuickExtIds.map(function (sid) {
      var st = allSites.find(function (s) { return s.id === sid; });
      if (!st) return '';
      var shortNm = st.shortLabel || String(st.name || '').replace(/\s*\([^)]*\)\s*$/, '');
      return '<button type="button" class="pbox-ext-pill" data-act="open-ext-site" data-site-id="' + esc(st.id) + '" data-q-src="law">' + esc(shortNm) + ' ↗</button>';
    }).filter(Boolean).join('');

    return [
      '<div class="pbox-page-wrap">',
      '  <div class="pbox-filter-card">',
      '    <div class="pbox-search-bar" style="margin-bottom:10px">',
      '      <input type="search" id="pboxLawSearchInput" class="pbox-input" aria-label="국가법령명 검색" value="' + esc(state.lawQuery) + '" placeholder="법령명 · 약칭 · 초성 · 조문 검색 (예: 근기법 23, 국공법, ㄱㄹㄱㅈㅂ)">',
      '      <button type="button" class="pbox-btn-primary" data-act="run-law-filter">검색</button>',
      '      <button type="button" class="pbox-btn-sm" data-act="sync-core-pack"' + (state.syncBusy ? ' disabled' : '') + '>핵심 법령 보관</button>',
      '    </div>',
      '    <div class="pbox-chip-bar" style="margin-bottom:0" role="group" aria-label="법령 분야 필터">',
      cats.map(function (c) {
        var isAct = state.lawCat === c.id;
        var cleanCatLabel = String(c.label || '').replace(/\s*\([0-9,]+\)\s*$/, '');
        return '<button type="button" class="pbox-cat-chip' + (isAct ? ' active' : '') + '" aria-pressed="' + (isAct ? 'true' : 'false') + '" data-act="set-law-cat" data-cat="' + esc(c.id) + '">' + esc(cleanCatLabel) + '</button>';
      }).join(''),
      '    </div>',
      (lawExtBtns ? [
        '    <details class="pbox-slim-drawer">',
        '      <summary>외부 주석서 · 입법연혁 바로가기</summary>',
        '      <div class="pbox-ext-left">' + lawExtBtns + '</div>',
        '    </details>'
      ].join('\n') : ''),
      '    <div class="pbox-law-hist-row">',
      '      <span><strong>📜 과거 구법·연혁 찾기:</strong></span>',
      '      <input type="date" id="pboxLawHistDate" class="pbox-law-hist-date" aria-label="과거 법령 기준 시행일" value="' + esc(state.lawHistoryLookupDate) + '">',
      '      <button type="button" class="pbox-btn-sm" data-act="open-law-date-official">기준일 구법 열기 ↗</button>',
      '      <button type="button" class="pbox-btn-sm" data-act="open-law-repeal-official">법제처 연혁·폐지법 검색 ↗</button>',
      '    </div>',
      '  </div>',
      buildConnectedLawsBarHtml(lawConnList, { label: '🔗 연결 · 유사직역 법령', openInReader: true }),
      (smartJump ? [
        '  <div class="pbox-smart-jump">',
        '    <span><strong>' + esc(smartJump.label) + '</strong></span>',
        '    <div class="pbox-btn-group">',
        '      <button type="button" class="pbox-btn-primary" data-act="open-law" data-dir="' + esc(smartJump.lawDir) + '" data-file="' + esc(smartJump.fileName) + '" data-art="' + esc(smartJump.articleNo || '') + '">' + esc(smartJump.articleNo ? (smartJump.articleNo + ' 열기') : '전문 열기') + '</button>',
        '      <button type="button" class="pbox-btn-sm" data-act="attach-law" data-dir="' + esc(smartJump.lawDir) + '" data-file="' + esc(smartJump.fileName) + '">@ 첨부</button>',
        '    </div>',
        '  </div>'
      ].join('\n') : ''),
      (selCnt > 0 ? [
        '  <div class="pbox-bulk-bar">',
        '    <span>선택 <b>' + selCnt + '</b>개 법령</span>',
        '    <div class="pbox-btn-group">',
        '      <button type="button" class="pbox-btn-sm" data-act="bulk-cache-laws">오프라인 보관</button>',
        '      <button type="button" class="pbox-btn-sm" data-act="bulk-attach-laws">@ 첨부</button>',
        '      <button type="button" class="pbox-btn-sm" data-act="bulk-proj-laws">프로젝트 담기</button>',
        '      <button type="button" class="pbox-btn-sm" data-act="clear-law-sel">선택 해제</button>',
        '    </div>',
        '  </div>'
      ].join('\n') : ''),
      '  <div class="pbox-card pbox-list-card">',
      '    <div class="pbox-sec-hd"><span>법령 목록 <b>' + filtered.length.toLocaleString() + '</b>건</span></div>',
      '    <div class="pbox-table-wrap">',
      '      <table class="pbox-table" aria-label="국가법령 목록">',
      '        <thead><tr>',
      '          <th class="col-chk"><label class="pbox-chk-tap"><input type="checkbox" data-act="toggle-all-laws" aria-label="현재 화면 법령 전체 선택"' + (allVisSelected ? ' checked' : '') + '></label></th>',
      '          <th class="col-num">번호</th>',
      '          <th>법령명</th>',
      '          <th style="width:265px">수록 법령·시행령·시행규칙 · 3단 비교</th>',
      '          <th style="width:120px">소관부처</th>',
      '          <th style="width:105px">보관 상태</th>',
      '          <th style="width:176px">동작</th>',
      '        </tr></thead>',
      '        <tbody>',
      (visible.length ? visible.map(function (f, i) {
        var cached = global.PuPBoxStore.getCachedLaw(f.dir, f.primaryFile);
        var checked = state.selectedLawDirs.has(f.dir) ? ' checked' : '';
        var subBtns = f.files.filter(function (fn) {
          return !(f.hasRepealStub && fn === '법률');
        }).slice(0, 3).map(function (fn) {
          var label = fn === '법률(법률)' ? '법률' : fn.replace(/\(.*\)$/, '');
          return '<button type="button" class="pbox-subfile-btn" data-act="open-law" data-dir="' + esc(f.dir) + '" data-file="' + esc(fn + '.md') + '" aria-label="' + esc(f.title + ' ' + label) + ' 열기">' + esc(label) + '</button>';
        }).join(' ');
        var has3Dan = resolve3DanTargets(f).length >= 2;
        if (has3Dan) {
          subBtns += ' <button type="button" class="pbox-3dan-btn" data-act="open-law-3dan" data-dir="' + esc(f.dir) + '" aria-label="' + esc(f.title) + ' 법률·시행령·시행규칙 3단 비교 열기">3단 비교</button>';
        }
        return '<tr>' +
          '<td class="col-chk"><label class="pbox-chk-tap"><input type="checkbox" data-act="toggle-law-chk" data-dir="' + esc(f.dir) + '" aria-label="' + esc(f.title) + ' 선택"' + checked + '></label></td>' +
          '<td class="col-num">' + (i + 1) + '</td>' +
          '<td class="pbox-row-click pbox-cell-main" role="button" tabindex="0" data-act="open-law" data-dir="' + esc(f.dir) + '" data-file="' + esc(f.primaryFile) + '" title="' + esc(f.title) + '">' +
            (f.priority ? '<span class="pbox-star" aria-label="노무 핵심 법령">★</span> ' : '') + '<strong>' + highlightHtml(f.title, hlTerms) + '</strong>' +
          '</td>' +
          '<td class="pbox-cell-hide-m" title="' + esc(f.files.join(', ')) + '">' + subBtns + '</td>' +
          '<td class="pbox-cell-meta" title="' + esc(f.dept || '범부처') + '">' + esc(f.dept || '범부처') + '</td>' +
          '<td class="pbox-cell-hide-m">' + (cached ? '<span class="pbox-badge-green">오프라인보관</span>' : '<span class="pbox-badge-gray">실시간열람</span>') + '</td>' +
          '<td class="pbox-cell-actions">' +
            '<button type="button" class="pbox-mini-act" data-act="open-law" data-dir="' + esc(f.dir) + '" data-file="' + esc(f.primaryFile) + '">전문</button> ' +
            '<button type="button" class="pbox-mini-act" data-act="open-law-history" data-dir="' + esc(f.dir) + '" data-file="' + esc(f.primaryFile) + '" title="과거 개정본(구법)·연혁 조회">구법</button> ' +
            '<button type="button" class="pbox-mini-act" data-act="attach-law" data-dir="' + esc(f.dir) + '" data-file="' + esc(f.primaryFile) + '">@첨부</button>' +
          '</td>' +
        '</tr>';
      }).join('') : '<tr class="pbox-empty-row"><td colspan="7" class="pbox-empty-cell">검색어와 일치하는 국가법령이 없습니다.</td></tr>'),
      '        </tbody>',
      '      </table>',
      '    </div>',
      (filtered.length > visible.length
        ? '<div class="pbox-more-row"><button type="button" class="pbox-btn-sm" data-act="more-laws">더 보기 (' + visible.length + ' / ' + filtered.length.toLocaleString() + ')</button></div>'
        : ''),
      '  </div>',
      '</div>'
    ].join('\n');
  }

  /* ── 4) 판례 · 위원회 재결례 · 행정해석 초간편 스마트 검색 & 실시간 수집 ── */
  function isKcplaaDoc(d) {
    if (!d) return false;
    if (String(d.id || '').indexOf('kcplaa-') === 0) return true;
    if (/한국공인노무사회|ilabor|kcplaa/i.test(String(d.agency || '') + ' ' + String(d.court || ''))) return true;
    var srcs = Array.isArray(d.sources) ? d.sources : [];
    for (var i = 0; i < srcs.length; i++) {
      if (/한국공인노무사회|ilabor|kcplaa/i.test(String(srcs[i] || ''))) return true;
    }
    var tgs = Array.isArray(d.tags) ? d.tags : [];
    for (var j = 0; j < tgs.length; j++) {
      if (/한국공인노무사회|ilabor|kcplaa/i.test(String(tgs[j] || ''))) return true;
    }
    return false;
  }

  function getFilteredCasesResult() {
    var E = global.PuPBoxEngine;
    var docs = global.PuPBoxStore.getDocs();
    var loadedLaws = global.PuPBoxStore.getLoadedLaws();
    var lawIndex = global.PuPBoxLawIndex ? global.PuPBoxLawIndex.list() : [];
    var isCompositeScope = (state.caseDocType === 'prec_group' || state.caseDocType === 'interp_group' || state.caseDocType === 'kcplaa');
    var trbRe = null;
    if (state.caseDocType === 'dec_nlrc' && state.caseTribunalOrg && state.caseTribunalOrg !== 'all') {
      var trbOrgs = (global.PuPBoxCorpus && global.PuPBoxCorpus.TRIBUNAL_ORGS) || [];
      var curTrb = trbOrgs.find(function (o) { return o.id === state.caseTribunalOrg; });
      if (curTrb && curTrb.matchRe) trbRe = new RegExp(curTrb.matchRe);
    }
    var scopedDocs = (isCompositeScope || trbRe)
      ? docs.filter(function (d) {
          if (state.caseDocType === 'prec_group') return d.docType === 'prec_sc' || d.docType === 'prec_lower';
          if (state.caseDocType === 'interp_group') return (d.docType === 'interp_moel' || d.docType === 'interp_gov') && !isKcplaaDoc(d);
          if (state.caseDocType === 'kcplaa') return isKcplaaDoc(d);
          if (trbRe) return d.docType === 'dec_nlrc' && trbRe.test((d.court || '') + ' ' + (d.agency || '') + ' ' + (d.caseNo || ''));
          return true;
        })
      : docs;
    var searchOpts = {
      docs: scopedDocs,
      loadedLaws: loadedLaws,
      lawIndex: lawIndex,
      docType: isCompositeScope ? 'all' : state.caseDocType,
      subQuery: state.caseSubQuery,
      dateRange: state.caseDateRange,
      sortBy: state.caseSortBy,
      limit: 200,
      ragLimit: 8
    };
    var outRes = (state.caseDocType === 'all' && E && typeof E.searchUnifiedAllInOne === 'function')
      ? E.searchUnifiedAllInOne(state.caseQuery, searchOpts)
      : E.searchCorpus(state.caseQuery, searchOpts);
    var preOutcomeDocs = Array.isArray(outRes.docs) ? outRes.docs : [];
    outRes.trendSummary = (E && typeof E.summarizeOutcomeDistribution === 'function')
      ? E.summarizeOutcomeDistribution(preOutcomeDocs)
      : null;
    if (state.caseOutcomeFilter && state.caseOutcomeFilter !== 'all' && E && typeof E.classifyLegalOutcomeSignal === 'function') {
      outRes.docs = preOutcomeDocs.filter(function (d) {
        var sig = E.classifyLegalOutcomeSignal(d);
        if (state.caseOutcomeFilter === 'caution') return Boolean(sig.caution);
        return sig.code === state.caseOutcomeFilter;
      });
    }
    return outRes;
  }

  function buildCasesHtml() {
    var baseDtypes = global.PuPBoxCorpus.DOC_TYPES || [];
    var dtypes = baseDtypes.slice();
    dtypes.splice(1, 0, { id: 'prec_group', label: '판례 전체' });
    dtypes.splice(5, 0, { id: 'interp_group', label: '행정·유권해석 전체' });
    if (!dtypes.some(function (x) { return x.id === 'kcplaa'; })) {
      dtypes.push({ id: 'kcplaa', label: '한국공인노무사회 자료' });
    }
    var trbOrgs = global.PuPBoxCorpus.TRIBUNAL_ORGS || [];
    var issueTree = global.PuPBoxCorpus.ISSUE_FINDER_TREE || [];
    var allSites = global.PuPBoxCorpus.KOREA_LEGAL_SITES || [];
    var E = global.PuPBoxEngine;
    var res = getFilteredCasesResult();
    var docs = res.docs;
    var arts = res.articles.slice(0, 4);
    var smartJump = res.smartLawJump;
    var selCnt = state.selectedDocIds.size;
    var allDocsSelected = docs.length > 0 && docs.every(function (d) { return state.selectedDocIds.has(d.id); });
    var hlTerms = (E && typeof E.extractHighlightTerms === 'function')
      ? E.extractHighlightTerms(state.caseQuery, state.caseSubQuery)
      : [];

    var curIssueGroup = issueTree.find(function (g) { return g.id === state.activeIssueCat; }) || issueTree[0] || null;
    var quickExtIds = ['ilabor_portal', 'lbox', 'bigcase', 'casenote', 'lawnb', 'scourt_glaw', 'law_go_prec', 'moel', 'nlrc'];
    var extQuickBtns = quickExtIds.map(function (sid) {
      var st = allSites.find(function (s) { return s.id === sid; });
      if (!st) return '';
      var shortNm = st.shortLabel || String(st.name || '').replace(/\s*\([^)]*\)\s*$/, '');
      return '<button type="button" class="pbox-ext-pill" data-act="open-ext-site" data-site-id="' + esc(st.id) + '" data-q-src="case">' + esc(shortNm) + ' ↗</button>';
    }).filter(Boolean).join('');

    var liveBusyAttr = state.liveCollectBusy ? ' disabled aria-busy="true"' : '';
    var lbBanner = state.liveCollectBanner;

    var hasAdvActive = Boolean(
      state.caseSubQuery ||
      state.caseDateRange !== 'all' ||
      state.caseSortBy !== 'relevance' ||
      state.caseOutcomeFilter !== 'all'
    );
    var trend = res.trendSummary || null;
    var trendStripHtml = (trend && trend.total > 0) ? [
      '<span class="pbox-trend-strip">',
      (trend.enBanc > 0 ? '<span class="pbox-badge-red">전원합의체 ' + trend.enBanc + '</span>' : ''),
      (trend.favorable > 0 ? '<span class="pbox-badge-green">인용·인정 ' + trend.favorable + '</span>' : ''),
      (trend.partial > 0 ? '<span class="pbox-badge-amber">일부인용 ' + trend.partial + '</span>' : ''),
      (trend.unfavorable > 0 ? '<span class="pbox-badge-gray">기각·불인정 ' + trend.unfavorable + '</span>' : ''),
      (trend.cautionCount > 0 ? '<span class="pbox-badge-amber">⚠ 판례변경주의 ' + trend.cautionCount + '</span>' : ''),
      '</span>'
    ].filter(Boolean).join(' ') : '';

    return [
      '<div class="pbox-page-wrap">',
      '  <div class="pbox-filter-card">',
      '    <div class="pbox-search-bar" style="margin-bottom:10px">',
      '      <input type="search" id="pboxCaseSearchInput" class="pbox-input" aria-label="판례·재결·행정해석·조례 검색" value="' + esc(state.caseQuery) + '" placeholder="사건번호, 회시번호, 법령 약칭(근기법 23), 쟁점 키워드 입력">',
      '      <button type="button" class="pbox-btn-primary" data-act="run-case-filter">검색</button>',
      '      <button type="button" class="pbox-btn-live" data-act="live-collect-cases"' + liveBusyAttr + ' title="법제처·법원·노동부·노동위·행심위·노무사회 공식 원문을 즉시 실시간 수집합니다">' + (state.liveCollectBusy ? '수집 중…' : '실시간 수집') + '</button>',
      '      <button type="button" class="pbox-btn-sm" data-act="auto-discover-cases"' + liveBusyAttr + ' title="사이트 개편·경로 변경 시 4중 자가복구 탐색으로 원문을 찾습니다">자동탐색</button>',
      ((state.caseQuery || hasAdvActive)
        ? '<button type="button" class="pbox-link-btn" data-act="reset-case-filters">초기화</button>'
        : ''),
      '    </div>',
      '    <div class="pbox-chip-bar" style="margin-bottom:0" role="group" aria-label="문서 종류 필터">',
      dtypes.map(function (dt) {
        var isAct = state.caseDocType === dt.id;
        return '<button type="button" class="pbox-cat-chip' + (isAct ? ' active' : '') + '" aria-pressed="' + (isAct ? 'true' : 'false') + '" data-act="set-case-type" data-dtype="' + esc(dt.id) + '">' + esc(dt.label) + '</button>';
      }).join(''),
      '    </div>',
      (state.caseDocType === 'dec_nlrc' && trbOrgs.length ? [
        '    <div class="pbox-chip-bar" style="margin-top:8px;margin-bottom:0" role="group" aria-label="심판·재결 기관별 필터">',
        trbOrgs.map(function (org) {
          var isTrbAct = state.caseTribunalOrg === org.id;
          return '<button type="button" class="pbox-cat-chip' + (isTrbAct ? ' active' : '') + '" aria-pressed="' + (isTrbAct ? 'true' : 'false') + '" data-act="set-tribunal-org" data-org="' + esc(org.id) + '">' + esc(org.label) + '</button>';
        }).join(''),
        '    </div>'
      ].join('\n') : ''),
      '    <details class="pbox-slim-drawer"' + (hasAdvActive ? ' open' : '') + '>',
      '      <summary>상세 조건 · 쟁점 추천 · 외부 사이트 직행</summary>',
      '      <div class="pbox-adv-row" style="margin-top:4px;padding-top:4px;border-top:none">',
      '        <input type="search" id="pboxCaseSubInput" class="pbox-adv-subinput" aria-label="결과 내 재검색" value="' + esc(state.caseSubQuery) + '" placeholder="결과 내 재검색 (예: 재직조건, 서울행정법원)">',
      '        <select id="pboxCaseDateSel" class="pbox-select-sm" aria-label="선고·회시 기간 필터">',
      '          <option value="all"' + (state.caseDateRange === 'all' ? ' selected' : '') + '>전체 기간</option>',
      '          <option value="1y"' + (state.caseDateRange === '1y' ? ' selected' : '') + '>최근 1년</option>',
      '          <option value="3y"' + (state.caseDateRange === '3y' ? ' selected' : '') + '>최근 3년</option>',
      '          <option value="5y"' + (state.caseDateRange === '5y' ? ' selected' : '') + '>최근 5년</option>',
      '        </select>',
      '        <select id="pboxCaseSortSel" class="pbox-select-sm" aria-label="판례 정렬 순서">',
      '          <option value="relevance"' + (state.caseSortBy === 'relevance' ? ' selected' : '') + '>정확도순</option>',
      '          <option value="date_desc"' + (state.caseSortBy === 'date_desc' ? ' selected' : '') + '>최신일자순</option>',
      '          <option value="court_tier"' + (state.caseSortBy === 'court_tier' ? ' selected' : '') + '>상급심우선</option>',
      '        </select>',
      '        <select id="pboxCaseOutcomeSel" class="pbox-select-sm" aria-label="결론 및 효력 신호 필터">',
      '          <option value="all"' + (state.caseOutcomeFilter === 'all' ? ' selected' : '') + '>전체 결론</option>',
      '          <option value="en_banc"' + (state.caseOutcomeFilter === 'en_banc' ? ' selected' : '') + '>전원합의체·위헌</option>',
      '          <option value="favorable"' + (state.caseOutcomeFilter === 'favorable' ? ' selected' : '') + '>인용·취소·인정</option>',
      '          <option value="partial"' + (state.caseOutcomeFilter === 'partial' ? ' selected' : '') + '>일부인용</option>',
      '          <option value="unfavorable"' + (state.caseOutcomeFilter === 'unfavorable' ? ' selected' : '') + '>기각·불인정</option>',
      '          <option value="caution"' + (state.caseOutcomeFilter === 'caution' ? ' selected' : '') + '>⚠ 판례변경 주의</option>',
      '        </select>',
      '      </div>',
      (issueTree.length ? [
        '      <div class="pbox-issue-box">',
        '        <div class="pbox-issue-top">',
        issueTree.map(function (g) {
          var actCls = curIssueGroup && g.id === curIssueGroup.id ? ' active' : '';
          return '<button type="button" class="pbox-issue-tab' + actCls + '" data-act="set-issue-cat" data-cat="' + esc(g.id) + '">' + esc(g.label) + '</button>';
        }).join(''),
        '        </div>',
        (curIssueGroup ? ('        <div class="pbox-issue-chips">' + (curIssueGroup.chips || []).map(function (ch) {
          return '<button type="button" class="pbox-issue-chip" data-act="pick-issue-chip" data-q="' + esc(ch.query || ch.q || '') + '">' + esc(ch.label) + '</button>';
        }).join('') + '</div>') : ''),
        '      </div>'
      ].join('\n') : ''),
      (extQuickBtns ? [
        '      <div class="pbox-ext-left" style="margin-top:8px">' + extQuickBtns + '</div>'
      ].join('\n') : ''),
      '    </details>',
      (lbBanner ? (
        '    <div id="pboxCaseStatusBanner" class="pbox-status-banner ' + esc(lbBanner.kind) + '" role="' + (lbBanner.kind === 'err' ? 'alert' : 'status') + '">' +
        '<strong>' + esc(lbBanner.title) + '</strong>' +
        (lbBanner.detail ? ('<div style="margin-top:3px">' + esc(lbBanner.detail) + '</div>') : '') +
        (Array.isArray(lbBanner.routes) && lbBanner.routes.length
          ? ('<div class="pbox-chip-bar" style="margin-top:7px;margin-bottom:0">' + lbBanner.routes.map(function (rt) {
              var safeOff = /^https:\/\//i.test(String(rt.officialUrl || '')) ? rt.officialUrl : '';
              var safeGoogle = /^https:\/\//i.test(String(rt.resilientSearchUrl || '')) ? rt.resilientSearchUrl : '';
              var chips = [];
              if (safeOff) {
                chips.push('<a class="pbox-ext-pill" href="' + esc(safeOff) + '" target="_blank" rel="noopener noreferrer" aria-label="' + esc(rt.label || rt.domain || '공식 사이트') + ' 새 창 열기" title="' + esc(rt.domain || '') + ' 공식 사이트로 바로 이동합니다">🏛️ ' + esc(rt.label) + '(새 창) ↗</a>');
              }
              if (safeGoogle) {
                var shortDom = String(rt.domain || 'go.kr').split('/')[0].trim();
                chips.push('<a class="pbox-ext-pill" href="' + esc(safeGoogle) + '" target="_blank" rel="noopener noreferrer" aria-label="' + esc(shortDom) + ' 구글 공공도메인 우회검색 새 창 열기" title="기관 홈페이지 메뉴 개편 시 구글 site:' + esc(shortDom) + ' 색인으로 원문을 찾습니다">🔎 ' + esc(shortDom) + ' 구글 우회탐색(새 창) ↗</a>');
              }
              return chips.join('');
            }).join('') + '</div>')
          : '') +
        '</div>'
      ) : ''),
      '  </div>',
      (smartJump ? [
        '  <div class="pbox-smart-jump">',
        '    <span><strong>' + esc(smartJump.label) + '</strong></span>',
        '    <div class="pbox-btn-group">',
        '      <button type="button" class="pbox-btn-primary" data-act="open-law" data-dir="' + esc(smartJump.lawDir) + '" data-file="' + esc(smartJump.fileName) + '" data-art="' + esc(smartJump.articleNo || '') + '">' + esc(smartJump.articleNo ? (smartJump.articleNo + ' 열기') : '전문 열기') + '</button>',
        '      <button type="button" class="pbox-btn-sm" data-act="attach-law" data-dir="' + esc(smartJump.lawDir) + '" data-file="' + esc(smartJump.fileName) + '">@ 첨부</button>',
        '    </div>',
        '  </div>'
      ].join('\n') : ''),
      (selCnt > 0 ? [
        '  <div class="pbox-bulk-bar">',
        '    <span>선택 <b>' + selCnt + '</b>건</span>',
        '    <div class="pbox-btn-group">',
        '      <button type="button" class="pbox-btn-primary" data-act="open-compare-modal">📊 선택 비교표</button>',
        '      <button type="button" class="pbox-btn-sm" data-act="bulk-attach-docs">@ 첨부</button>',
        '      <button type="button" class="pbox-btn-sm" data-act="bulk-proj-docs">프로젝트 담기</button>',
        '      <button type="button" class="pbox-btn-sm" data-act="bulk-export-docs">내보내기</button>',
        '      <button type="button" class="pbox-btn-sm" data-act="bulk-del-docs">삭제</button>',
        '      <button type="button" class="pbox-btn-sm" data-act="clear-doc-sel">선택 해제</button>',
        '    </div>',
        '  </div>'
      ].join('\n') : ''),
      '  <div class="pbox-card pbox-list-card">',
      '    <div class="pbox-sec-hd"><span>검색 결과 <b>' + docs.length + '</b>건' + (res.totalMatchedDocs > docs.length ? ' (전체 ' + res.totalMatchedDocs + '건)' : '') + '</span>' + trendStripHtml + '</div>',
      '    <div class="pbox-table-wrap">',
      '      <table class="pbox-table" aria-label="판례 및 유권해석 목록">',
      '        <thead><tr>',
      '          <th class="col-chk"><label class="pbox-chk-tap"><input type="checkbox" data-act="toggle-all-docs" aria-label="검색된 문서 전체 선택"' + (allDocsSelected ? ' checked' : '') + '></label></th>',
      '          <th class="col-num">번호</th>',
      '          <th style="width:112px">분류</th>',
      '          <th style="width:125px">선고·회시기관</th>',
      '          <th style="width:145px">사건·문서번호</th>',
      '          <th>제목 · 결론신호 · 핵심 요지</th>',
      '          <th style="width:96px">일자</th>',
      '          <th style="width:176px">동작</th>',
      '        </tr></thead>',
      '        <tbody>',
      (docs.length ? docs.map(function (d, idx) {
        var checked = state.selectedDocIds.has(d.id) ? ' checked' : '';
        var srcCnt = (d.sources || []).length;
        var sig = (E && typeof E.classifyLegalOutcomeSignal === 'function')
          ? E.classifyLegalOutcomeSignal(d)
          : { label: '', badgeCls: 'pbox-badge-gray', caution: '' };
        var sigBadgeHtml = sig.label
          ? ('<span class="' + sig.badgeCls + '">' + esc(sig.label) + '</span> ')
          : '';
        var cautionBadgeHtml = sig.caution
          ? ('<span class="pbox-badge-amber" title="' + esc(sig.caution) + '">⚠ 변경주의</span> ')
          : '';
        return '<tr>' +
          '<td class="col-chk"><label class="pbox-chk-tap"><input type="checkbox" data-act="toggle-doc-chk" data-id="' + esc(d.id) + '" aria-label="' + esc(d.title) + ' 선택"' + checked + '></label></td>' +
          '<td class="col-num">' + (idx + 1) + '</td>' +
          '<td class="pbox-cell-hide-m"><span class="' + docTypeBadgeClass(d.docType) + '">' + esc(docTypeBadgeLabel(d.docType)) + '</span></td>' +
          '<td class="pbox-cell-hide-m" title="' + esc(d.court || d.agency) + '">' + esc(d.court || d.agency) + '</td>' +
          '<td class="pbox-mono pbox-cell-meta" title="' + esc((d.court || d.agency) + ' ' + (d.caseNo || '')) + '">' + highlightHtml(d.caseNo || d.court || d.agency || '-', hlTerms) + '</td>' +
          '<td class="pbox-row-click pbox-cell-main" role="button" tabindex="0" data-act="open-doc" data-id="' + esc(d.id) + '" title="' + esc(d.title + ' — ' + d.summary) + '">' +
            sigBadgeHtml + cautionBadgeHtml + '<strong>' + highlightHtml(d.title, hlTerms) + '</strong> <span class="pbox-muted pbox-cell-sum">— ' + highlightHtml(d.summary, hlTerms) + '</span>' +
          '</td>' +
          '<td class="col-num pbox-cell-hide-m">' + esc(d.decisionDate || '') + '</td>' +
          '<td class="pbox-cell-actions" title="' + esc((d.sources || []).join(', ')) + '">' +
            '<button type="button" class="pbox-mini-act" data-act="open-doc" data-id="' + esc(d.id) + '">원문</button> ' +
            '<button type="button" class="pbox-mini-act pbox-pc-only" data-act="copy-doc-citation" data-id="' + esc(d.id) + '" title="서면 표준 인용문구 복사">인용</button> ' +
            '<button type="button" class="pbox-mini-act" data-act="attach-doc" data-id="' + esc(d.id) + '">@첨부</button>' +
            (srcCnt > 1 ? ' <span class="pbox-badge-green pbox-pc-only" title="중복 병합 출처 ' + srcCnt + '곳">+' + srcCnt + '</span>' : '') +
          '</td>' +
        '</tr>';
      }).join('') : '<tr class="pbox-empty-row"><td colspan="8" class="pbox-empty-cell">일치하는 자료가 없습니다. 상단 <b>[실시간 수집]</b>을 눌러 공식 원문을 즉시 조회해 보세요.</td></tr>'),
      '        </tbody>',
      '      </table>',
      '    </div>',
      '  </div>',
      (state.caseDocType === 'all'
        ? [
            '  <details class="pbox-slim-drawer" style="margin-top:12px">',
            '    <summary>법령 · 판례 · 결정례 · 행정해석 4대 근거 요약 대조 보기</summary>',
            buildUnifiedAuthoritiesHtml(res, state.caseQuery, {
              inCasesView: true,
              maxPerCol: 3,
              heading: state.caseQuery
                ? ('"' + state.caseQuery.slice(0, 32) + '" 요약 대조')
                : '주요 법령 · 판례 · 결정례 · 행정해석'
            }),
            '  </details>'
          ].join('\n')
        : (arts.length ? [
            '  <div class="pbox-matched-arts" style="margin-top:12px">',
            '    <div class="pbox-matched-hd">관련 조문 (' + arts.length + '건)</div>',
            '    <div class="pbox-matched-grid">',
            arts.map(function (a) {
              return '<div class="pbox-art-hit" role="button" tabindex="0" data-act="open-law" data-dir="' + esc(a.lawDir) + '" data-file="' + esc(a.fileName) + '" data-art="' + esc(a.articleNo) + '">' +
                '<strong>' + esc(a.lawTitle + ' ' + a.articleNo + (a.heading ? '(' + a.heading + ')' : '')) + '</strong>' +
                '<span>' + highlightHtml(a.snippet, hlTerms) + '</span>' +
              '</div>';
            }).join(''),
            '    </div>',
            '  </div>'
          ].join('\n') : '')),
      '</div>'
    ].join('\n');
  }

  /* ── 4-B) 대한민국 전 법률·공공사이트 직접검색 허브 & 김앤장·6대 대형로펌 리서치 체계 (sites 뷰) ── */
  function getEffectiveSiteQuery() {
    var q = state.siteSearchQuery.trim() || state.caseQuery.trim() || state.lawQuery.trim();
    return q;
  }

  function buildSitesHtml() {
    var siteCats = global.PuPBoxCorpus.SITE_CATEGORIES || [];
    var allSites = global.PuPBoxCorpus.KOREA_LEGAL_SITES || [];
    var bundles = global.PuPBoxCorpus.SITE_BUNDLE_PRESETS || [];
    var bigLawGuide = global.PuPBoxCorpus.BIGLAW_RESEARCH_GUIDE || [];
    var curQ = getEffectiveSiteQuery();

    var filteredSites = allSites.filter(function (s) {
      if (state.siteCat === 'all') return true;
      return s.cat === state.siteCat;
    });

    return [
      '<div class="pbox-page-wrap">',
      '  <div class="pbox-filter-card">',
      '    <div class="pbox-search-bar">',
      '      <input type="search" id="pboxSiteSearchInput" class="pbox-input" aria-label="전국 법률사이트 통합 검색어" value="' + esc(curQ) + '" placeholder="공통 검색어 입력 (예: 통상임금, 2020다247190, 근로기준법 제23조)">',
      '      <button type="button" class="pbox-btn-primary" data-act="run-site-search">검색어 적용</button>',
      '      <button type="button" class="pbox-btn-live" data-act="site-to-live-collect"' + (state.liveCollectBusy ? ' disabled' : '') + '>실시간 수집</button>',
      '      <button type="button" class="pbox-btn-sm" data-act="site-to-auto-discover"' + (state.liveCollectBusy ? ' disabled' : '') + '>자동탐색</button>',
      '    </div>',
      (bundles.length ? [
        '    <div class="pbox-bundle-row">',
        bundles.map(function (b) {
          return '<button type="button" class="pbox-bundle-btn" data-act="open-site-bundle" data-bundle="' + esc(b.id) + '" title="브라우저 팝업 허용 시 핵심 사이트 검색결과가 동시에 열립니다">' + esc(b.label) + ' ↗</button>';
        }).join(''),
        '    </div>'
      ].join('\n') : ''),
      '    <div class="pbox-chip-bar" style="margin-top:10px;margin-bottom:0" role="group" aria-label="사이트 분야 필터">',
      siteCats.map(function (c) {
        var isAct = state.siteCat === c.id;
        return '<button type="button" class="pbox-cat-chip' + (isAct ? ' active' : '') + '" aria-pressed="' + (isAct ? 'true' : 'false') + '" data-act="set-site-cat" data-cat="' + esc(c.id) + '">' + esc(c.label) + '</button>';
      }).join(''),
      '    </div>',
      '  </div>',
      '  <div class="pbox-site-grid">',
      filteredSites.map(function (s) {
        var tierCls = s.bigLawPick ? 'pbox-badge-blue' : 'pbox-badge-green';
        return '<div class="pbox-site-card">' +
          '<div>' +
            '<div class="pbox-site-top">' +
              '<span class="' + tierCls + '">' + esc(s.tier || '공식 무료') + '</span>' +
              (s.bigLawPick ? '<span class="pbox-badge-amber">★ 대형로펌 필수</span>' : '<span class="pbox-badge-gray">' + esc(s.domain) + '</span>') +
            '</div>' +
            '<div class="pbox-site-name">' + esc(s.name) + '</div>' +
            '<div class="pbox-site-desc">' + esc(s.desc) + '</div>' +
          '</div>' +
          '<div class="pbox-site-acts">' +
            '<button type="button" class="pbox-btn-primary" data-act="open-ext-site" data-site-id="' + esc(s.id) + '" data-q-src="site">직접 검색 ↗</button>' +
            '<button type="button" class="pbox-btn-sm" data-act="open-ext-google" data-site-id="' + esc(s.id) + '" data-q-src="site">기관내 구글 ↗</button>' +
          '</div>' +
        '</div>';
      }).join(''),
      '  </div>',
      '  <div class="pbox-card">',
      '    <details class="pbox-slim-drawer" style="margin-top:0;padding-top:0;border-top:none">',
      '      <summary>대형로펌 5단계 법률리서치 참고 가이드</summary>',
      '      <div class="pbox-biglaw-grid" style="margin-top:8px">',
      bigLawGuide.map(function (g) {
        var stepTitle = g.layer || ((g.step ? (g.step + ' · ') : '') + (g.title || ''));
        var methodBody = g.method || g.practice || '';
        return '<div class="pbox-biglaw-card">' +
          '<div class="pbox-biglaw-hd">' +
            '<span class="pbox-biglaw-title">' + esc(stepTitle) + '</span>' +
            '<span class="pbox-biglaw-tools">' + esc(g.tools || '') + '</span>' +
          '</div>' +
          '<div class="pbox-biglaw-desc">' + esc(methodBody) + '</div>' +
        '</div>';
      }).join(''),
      '      </div>',
      '    </details>',
      '  </div>',
      '</div>'
    ].join('\n');
  }

  /* ── 5) 하급심(1·2심)·내부 판결문 비식별 수집 & 3단계 중복정리 화면 ── */
  var LOWER_COURT_OPTIONS = [
    { value: '', label: '전체 하급심 법원 (org=400202)' },
    { value: '서울행정법원', label: '서울행정법원 (중노위·산재 1심)' },
    { value: '서울중앙지방법원', label: '서울중앙지방법원' },
    { value: '서울남부지방법원', label: '서울남부지방법원' },
    { value: '수원지방법원', label: '수원지방법원' },
    { value: '인천지방법원', label: '인천지방법원' },
    { value: '부산지방법원', label: '부산지방법원' },
    { value: '대구지방법원', label: '대구지방법원' },
    { value: '광주지방법원', label: '광주지방법원' },
    { value: '대전지방법원', label: '대전지방법원' },
    { value: '울산지방법원', label: '울산지방법원' },
    { value: '창원지방법원', label: '창원지방법원' },
    { value: '서울고등법원', label: '서울고등법원 (항소심)' }
  ];

  var LOWER_PRESET_OPTIONS = [
    { value: 'all', label: '전체 노무·산재 핵심쟁점 (8종)' },
    { value: 'dismissal', label: '부당해고·징계·갱신기대권' },
    { value: 'wage', label: '임금·통상임금·퇴직금·포괄임금' },
    { value: 'sanjae', label: '산재·요양불승인·출퇴근재해' },
    { value: 'status', label: '근로자성·직장내괴롭힘·노조' }
  ];

  var TRIBUNAL_OPTIONS = [
    { value: 'all', label: '전체 심판·재결·결정 통합 (23개 공식 채널)' },
    { value: 'decc_acrc', label: '중앙행정심판위원회 (국민권익위 일반행정심판)' },
    { value: 'decc_acr_spc', label: '국민권익위원회 특별행정심판' },
    { value: 'decc_local', label: '전국 시·도 및 교육청 행정심판위원회' },
    { value: 'nlrc', label: '중앙노동위원회 · 지방노동위원회 (판정·재심판정)' },
    { value: 'iaciac', label: '산업재해보상보험재심사위원회 (산재 재결례)' },
    { value: 'eiac', label: '고용보험심사위원회 (구직급여·육아휴직급여 재결례)' },
    { value: 'adap', label: '인사혁신처 소청심사위원회 (국가공무원 소청)' },
    { value: 'local_adap', label: '지방소청심사위원회 (지방공무원 소청)' },
    { value: 'tt', label: '조세심판원 (국세·지방세 특별행정심판)' },
    { value: 'kipo_trb', label: '특허심판원 (직무발명·특허·상표 심결례)' },
    { value: 'kmst', label: '해양안전심판원 (선박사고·해기사 특별행정심판)' },
    { value: 'oclt', label: '중앙토지수용위원회 (토지수용·이의재결례)' },
    { value: 'hira_trb', label: '건강보험분쟁조정위원회 (요양급여 결정례)' },
    { value: 'ftc', label: '공정거래위원회 (하도급·위수탁·부당특약 심결례)' },
    { value: 'ppc', label: '개인정보보호위원회 (인사·CCTV·과징금 심결례)' },
    { value: 'acr', label: '국민권익위원회 (고충민원·부패방지 의결례)' },
    { value: 'nhrck', label: '국가인권위원회 (고용·채용·병역 차별 결정례)' },
    { value: 'fsc', label: '금융위원회 (금융제재·의결례)' },
    { value: 'sfc', label: '증권선물위원회 (자본시장 제재 의결례)' },
    { value: 'kcc', label: '방송미디어통신위원회 (방통위 심결례)' },
    { value: 'ecc', label: '중앙환경분쟁조정위원회 (소음·진동·분진 재정례)' },
    { value: 'baiPvcs', label: '감사원 사전컨설팅 의견서' }
  ];

  var LOCAL_APPEAL_ORG_OPTIONS = [
    { value: '', label: '전국 주요 시·도/교육청 행심위 자동 선택' },
    { value: '서울특별시행정심판위원회', label: '서울특별시행정심판위원회' },
    { value: '경기도행정심판위원회', label: '경기도행정심판위원회' },
    { value: '부산광역시행정심판위원회', label: '부산광역시행정심판위원회' },
    { value: '인천광역시행정심판위원회', label: '인천광역시행정심판위원회' },
    { value: '대구광역시행정심판위원회', label: '대구광역시행정심판위원회' },
    { value: '광주광역시행정심판위원회', label: '광주광역시행정심판위원회' },
    { value: '대전광역시행정심판위원회', label: '대전광역시행정심판위원회' },
    { value: '울산광역시행정심판위원회', label: '울산광역시행정심판위원회' },
    { value: '세종특별자치시행정심판위원회', label: '세종특별자치시행정심판위원회' },
    { value: '강원특별자치도행정심판위원회', label: '강원특별자치도행정심판위원회' },
    { value: '충청남도행정심판위원회', label: '충청남도행정심판위원회' },
    { value: '경상북도행정심판위원회', label: '경상북도행정심판위원회' },
    { value: '경상남도행정심판위원회', label: '경상남도행정심판위원회' },
    { value: '제주특별자치도행정심판위원회', label: '제주특별자치도행정심판위원회' },
    { value: '경기도교육청행정심판위원회', label: '경기도교육청행정심판위원회' },
    { value: '강원특별자치도교육청행정심판위원회', label: '강원특별자치도교육청행정심판위원회' },
    { value: '경상남도교육청행정심판위원회', label: '경상남도교육청행정심판위원회' },
    { value: '경상북도교육청행정심판위원회', label: '경상북도교육청행정심판위원회' },
    { value: '광주광역시교육청행정심판위원회', label: '광주광역시교육청행정심판위원회' },
    { value: '대구광역시교육청행정심판위원회', label: '대구광역시교육청행정심판위원회' },
    { value: '충청북도교육청행정심판위원회', label: '충청북도교육청행정심판위원회' },
    { value: '서울지방교정청행정심판위원회', label: '서울지방교정청행정심판위원회' }
  ];

  var TRIBUNAL_PRESET_OPTIONS = [
    { value: 'all', label: '공통 핵심쟁점 (전체 채널 선택 시 대표어 「처분」 · 개별 기관 선택 시 3종 순차 수집)' },
    { value: 'admin_disp', label: '일반행정심판 (영업정지 · 과징금 · 환수처분)' },
    { value: 'labor_sanjae', label: '노동·산재·고용보험 (부당해고 · 부당노동행위 · 요양불승인)' },
    { value: 'civil_public', label: '공무원·교원 소청 (감봉 · 정직 · 해임)' },
    { value: 'tax_land_marine', label: '특별심판 (취득세 · 법인세 · 퇴직소득 · 수용보상금)' },
    { value: 'fair_rights', label: '독립위원회 (하도급 · 개인정보 · 고용차별)' }
  ];

  var KCPLAA_CHANNEL_OPTIONS = [
    { value: 'all', label: '전체 통합 (오늘의자료·노동부·근복·노동위·해석·지침·재결·뉴스·포커스·서식·본회공지)' },
    { value: 'today', label: 'ilabor 오늘의 자료 · 전월 자료 · 노사정 뉴스' },
    { value: 'moel', label: 'ilabor 고용노동부 자료실 (24개 분과 전체)' },
    { value: 'comwel', label: 'ilabor 근로복지공단 (산재·체당금·퇴직연금·고용보험)' },
    { value: 'nlrc', label: 'ilabor 노동위원회 (심판·조정·차별시정·복수노조)' },
    { value: 'interp', label: 'ilabor 행정자료 — 행정해석(질의회시)' },
    { value: 'guide', label: 'ilabor 행정자료 — 고용노동부 지침·시달문' },
    { value: 'decc', label: 'ilabor 행정자료 — 재결례' },
    { value: 'prec', label: 'ilabor 노동판례 (대법원·헌재·고등·지방·행정법원)' },
    { value: 'forms_rules', label: 'ilabor 노동관계 법정서식 · 예규 · 훈령 · 고시' },
    { value: 'focus', label: 'ilabor 월간 노사 FOCUS (정기간행물)' },
    { value: 'news', label: 'ilabor 노사정 뉴스 (전문 본문)' },
    { value: 'kcplaa_notice', label: '한국공인노무사회 본회 공지사항 · 주간 「알리다」' }
  ];

  function buildIngestHtml() {
    var pv = state.ingestPreview;
    var busyAttr = state.ingestBusy ? ' disabled aria-busy="true"' : '';
    var lowerBusyAttr = state.lowerPullBusy ? ' disabled aria-busy="true"' : '';
    var trbBusyAttr = state.tribunalPullBusy ? ' disabled aria-busy="true"' : '';
    var kcBusyAttr = state.kcplaaPullBusy ? ' disabled aria-busy="true"' : '';
    var cfg = global.PuPBoxStore.getConfig();
    var kb = state.kcplaaStatusBanner;
    var kcBannerHtml = kb
      ? ('    <div class="pbox-status-banner ' + esc(kb.kind) + '" role="' + (kb.kind === 'err' ? 'alert' : 'status') + '">' +
         '<strong>' + esc(kb.title) + '</strong>' +
         (kb.detail ? ('<div style="margin-top:3px">' + esc(kb.detail) + '</div>') : '') +
         '</div>')
      : '';
    var lb = state.lowerStatusBanner;
    var lowerBannerHtml = lb
      ? ('    <div class="pbox-status-banner ' + esc(lb.kind) + '" role="' + (lb.kind === 'err' ? 'alert' : 'status') + '">' +
         '<strong>' + esc(lb.title) + '</strong>' +
         (lb.detail ? ('<div style="margin-top:3px">' + esc(lb.detail) + '</div>') : '') +
         '</div>')
      : '';
    var tb = state.tribunalStatusBanner;
    var trbBannerHtml = tb
      ? ('    <div class="pbox-status-banner ' + esc(tb.kind) + '" role="' + (tb.kind === 'err' ? 'alert' : 'status') + '">' +
         '<strong>' + esc(tb.title) + '</strong>' +
         (tb.detail ? ('<div style="margin-top:3px">' + esc(tb.detail) + '</div>') : '') +
         '</div>')
      : '';
    return [
      '<div class="pbox-page-wrap">',
      '  <div class="pbox-card pbox-flat-m" style="margin-bottom:14px">',
      '    <div class="pbox-sec-hd"><span>한국공인노무사회 자료 당겨오기 (ilabor · 본회)</span></div>',
      '    <div class="pbox-matched-grid" style="margin-bottom:10px">',
      '      <label class="pbox-field"><span class="pbox-label">수집 채널</span>' +
               '<select id="pboxKcplaaChannelSel" class="pbox-input">' +
               KCPLAA_CHANNEL_OPTIONS.map(function (opt) {
                 var selK = state.kcplaaChannel === opt.value ? ' selected' : '';
                 return '<option value="' + esc(opt.value) + '"' + selK + '>' + esc(opt.label) + '</option>';
               }).join('') +
               '</select></label>',
      '      <label class="pbox-field"><span class="pbox-label">검색어 지정 (선택)</span>' +
               '<input type="text" id="pboxKcplaaQueryInput" class="pbox-input" value="' + esc(state.kcplaaCustomQuery) + '" placeholder="예: 포괄임금, 최저임금, 산재보험료율, 알리다"></label>',
      '    </div>',
      '    <div class="pbox-btn-group">',
      '      <button type="button" class="pbox-btn-primary" data-act="pull-kcplaa-docs"' + kcBusyAttr + '>' + (state.kcplaaPullBusy ? '수집 중…' : '자료 당겨오기') + '</button>',
      '      <button type="button" class="pbox-btn-sm" data-act="jump-kcplaa-cases">수집 자료 검색</button>',
      '      <button type="button" class="pbox-btn-sm" data-act="copy-kcplaa-cli">CLI 명령어 복사</button>',
      '      <button type="button" class="pbox-btn-sm" data-act="open-ext-site" data-site-id="ilabor_portal">ilabor 열기 ↗</button>',
      '    </div>',
      kcBannerHtml,
      '  </div>',
      '  <div class="pbox-card pbox-flat-m" style="margin-bottom:14px">',
      '    <div class="pbox-sec-hd"><span>하급심 판례 수집 (지방법원 · 행정법원 · 고등법원)</span></div>',
      '    <div class="pbox-matched-grid" style="margin-bottom:10px">',
      '      <label class="pbox-field"><span class="pbox-label">대상 법원</span>' +
               '<select id="pboxLowerCourtSel" class="pbox-input">' +
               LOWER_COURT_OPTIONS.map(function (opt) {
                 var sel = state.lowerCourtFilter === opt.value ? ' selected' : '';
                 return '<option value="' + esc(opt.value) + '"' + sel + '>' + esc(opt.label) + '</option>';
               }).join('') +
               '</select></label>',
      '      <label class="pbox-field"><span class="pbox-label">쟁점 묶음</span>' +
               '<select id="pboxLowerPresetSel" class="pbox-input">' +
               LOWER_PRESET_OPTIONS.map(function (opt) {
                 var sel = state.lowerPreset === opt.value ? ' selected' : '';
                 return '<option value="' + esc(opt.value) + '"' + sel + '>' + esc(opt.label) + '</option>';
               }).join('') +
               '</select></label>',
      '      <label class="pbox-field"><span class="pbox-label">지정 검색어 (선택)</span>' +
               '<input type="text" id="pboxLowerQueryInput" class="pbox-input" value="' + esc(state.lowerCustomQuery) + '" placeholder="예: 추간판탈출증, 포괄임금"></label>',
      '      <label class="pbox-field"><span class="pbox-label">법제처 OC 아이디 (선택)</span>' +
               '<input type="text" id="pboxLowerLawOcInput" class="pbox-input" value="' + esc(cfg.lawOc || '') + '" placeholder="미입력 시 무인증 수집"></label>',
      '    </div>',
      '    <div class="pbox-btn-group">',
      '      <button type="button" class="pbox-btn-primary" data-act="pull-lower-court"' + lowerBusyAttr + '>' + (state.lowerPullBusy ? '수집 중…' : '하급심 판례 당겨오기') + '</button>',
      '    </div>',
      lowerBannerHtml,
      '  </div>',
      '  <div class="pbox-card pbox-flat-m" style="margin-bottom:14px">',
      '    <div class="pbox-sec-hd"><span>행정심판 · 노동위원회 · 특별심판 재결례 수집</span></div>',
      '    <div class="pbox-matched-grid" style="margin-bottom:10px">',
      '      <label class="pbox-field"><span class="pbox-label">심판·재결 기관</span>' +
               '<select id="pboxTribunalSel" class="pbox-input">' +
               TRIBUNAL_OPTIONS.map(function (opt) {
                 var selT = state.tribunalFilter === opt.value ? ' selected' : '';
                 return '<option value="' + esc(opt.value) + '"' + selT + '>' + esc(opt.label) + '</option>';
               }).join('') +
               '</select></label>',
      (state.tribunalFilter === 'decc_local'
        ? ('      <label class="pbox-field"><span class="pbox-label">시·도 / 교육청 행정심판위원회</span>' +
             '<select id="pboxTribunalLocalOrgSel" class="pbox-input">' +
             LOCAL_APPEAL_ORG_OPTIONS.map(function (opt) {
               var selL = state.tribunalLocalOrg === opt.value ? ' selected' : '';
               return '<option value="' + esc(opt.value) + '"' + selL + '>' + esc(opt.label) + '</option>';
             }).join('') +
             '</select></label>')
        : ''),
      '      <label class="pbox-field"><span class="pbox-label">쟁점 묶음</span>' +
               '<select id="pboxTribunalPresetSel" class="pbox-input">' +
               TRIBUNAL_PRESET_OPTIONS.map(function (opt) {
                 var selP = state.tribunalPreset === opt.value ? ' selected' : '';
                 return '<option value="' + esc(opt.value) + '"' + selP + '>' + esc(opt.label) + '</option>';
               }).join('') +
               '</select></label>',
      '      <label class="pbox-field"><span class="pbox-label">지정 검색어 (선택)</span>' +
               '<input type="text" id="pboxTribunalQueryInput" class="pbox-input" value="' + esc(state.tribunalCustomQuery) + '" placeholder="예: 영업정지, 감봉, 요양불승인"></label>',
      '      <label class="pbox-field"><span class="pbox-label">법제처 OC 아이디 (선택)</span>' +
               '<input type="text" id="pboxTribunalLawOcInput" class="pbox-input" value="' + esc(cfg.lawOc || '') + '" placeholder="미입력 시 무인증 수집"></label>',
      '    </div>',
      '    <div class="pbox-btn-group">',
      '      <button type="button" class="pbox-btn-primary" data-act="pull-tribunal-cases"' + trbBusyAttr + '>' + (state.tribunalPullBusy ? '수집 중…' : '심판·재결 당겨오기') + '</button>',
      '    </div>',
      trbBannerHtml,
      '  </div>',
      '  <div class="pbox-card pbox-flat-m" style="margin-bottom:14px">',
      '    <div class="pbox-sec-hd"><span>판결문 · 결정서 파일 등록</span></div>',
      '    <div id="pboxDropZone" class="pbox-dropzone" role="button" tabindex="0" aria-busy="' + (state.ingestBusy ? 'true' : 'false') + '" data-act="pick-ingest-files" aria-label="판결문·결정서 파일 선택 또는 끌어놓기">',
      '      <div class="pbox-drop-title">' + (state.ingestBusy ? '파일 텍스트 추출 및 비식별 처리 중…' : '판결문·결정서 파일(.pdf · .txt · .md · .json) 선택 또는 끌어놓기') + '</div>',
      '      <div class="pbox-drop-sub">자동 비식별화 및 중복 제거 후 저장됩니다</div>',
      '      <input type="file" id="pboxIngestFileInput" multiple accept=".pdf,.txt,.md,.json" style="display:none" aria-label="수집할 판결문 파일 선택"' + busyAttr + '>',
      '    </div>',
      '  </div>',
      '  <div class="pbox-card pbox-flat-m">',
      '    <div class="pbox-sec-hd"><span>본문 직접 붙여넣기</span></div>',
      '    <textarea id="pboxIngestTa" class="pbox-textarea" rows="5" aria-label="수집할 판결문 본문 입력" placeholder="판결문·결정문·유권해석 본문을 붙여넣으세요">' + esc(state.ingestRawText) + '</textarea>',
      '    <div style="margin-top:8px">',
      '      <div class="pbox-badge-green" style="display:inline-flex;align-items:center;gap:6px">🔒 본인 계정 전용 비공개 보관 — 업로드·수집한 사건·판례는 로그인한 본인만 검색·열람하며 다른 직원에게는 절대 노출되지 않습니다</div>',
      '    </div>',
      '    <div class="pbox-btn-group" style="margin-top:10px">',
      '      <button type="button" class="pbox-btn-sm" data-act="preview-ingest"' + busyAttr + '>미리보기</button>',
      '      <button type="button" class="pbox-btn-primary" data-act="commit-ingest"' + busyAttr + '>DB 저장</button>',
      '    </div>',
      (pv ? [
        '    <div class="pbox-preview-box">',
        '      <div class="pbox-preview-hd">',
        '        <span><strong>추출 결과:</strong> ' + esc(pv.doc.court) + ' | 사건번호: <code>' + esc(pv.doc.caseNo || '미검출') + '</code> | 선고일: ' + esc(pv.doc.decisionDate) + '</span>',
        '        <span class="pbox-badge-green">개인정보 마스킹 ' + pv.anonymization.totalMasked + '건 (주민번호 ' + pv.anonymization.counts.rrn + ' · 성명 ' + (pv.anonymization.counts.name || 0) + ' · 전화 ' + pv.anonymization.counts.phone + ' · 계좌/기타 ' + (pv.anonymization.counts.email + pv.anonymization.counts.account + pv.anonymization.counts.address) + ')</span>',
        '      </div>',
        '      <div class="pbox-preview-title">제목: ' + esc(pv.doc.title) + '</div>',
        '      <pre class="pbox-preview-pre">' + esc(pv.doc.body.slice(0, 900)) + (pv.doc.body.length > 900 ? '\n…(이하 생략)' : '') + '</pre>',
        '    </div>'
      ].join('\n') : ''),
      '  </div>',
      '</div>'
    ].join('\n');
  }

  /* ── 6) 노무 AI 워크플로 라이브러리 (6종 서면 생성기) ── */
  function buildWorkflowsHtml() {
    var wfs = global.PuPBoxCorpus.WORKFLOWS || [];
    var activeWf = wfs.find(function (w) { return w.id === state.activeWorkflowId; }) || wfs[0];
    var runDisabled = state.aiBusy ? ' disabled aria-busy="true"' : '';

    return [
      '<div class="pbox-page-wrap">',
      '  <div class="pbox-wf-grid" role="listbox" aria-label="노무 AI 서면 워크플로 선택">',
      wfs.map(function (w) {
        var isAct = activeWf && w.id === activeWf.id;
        return '<div class="pbox-wf-card' + (isAct ? ' active' : '') + '" role="option" tabindex="0" aria-selected="' + (isAct ? 'true' : 'false') + '" data-act="select-wf" data-id="' + esc(w.id) + '">' +
          '<div class="pbox-wf-top"><span class="pbox-badge-blue">' + esc(w.category) + '</span><span class="pbox-badge-amber">' + esc(w.badge) + '</span></div>' +
          '<div class="pbox-wf-title">' + esc(w.title) + '</div>' +
          '<div class="pbox-wf-desc">' + esc(w.desc) + '</div>' +
        '</div>';
      }).join(''),
      '  </div>',
      (activeWf ? [
        '  <div class="pbox-card pbox-flat-m" style="margin-top:16px">',
        '    <div class="pbox-sec-hd"><span>⚡ ' + esc(activeWf.title) + ' — 사실관계 입력</span><span class="pbox-muted">참조 법령(' + esc((activeWf.autoAttachLaws || []).join(', ')) + ') 자동 연동</span></div>',
        '    <div class="pbox-form-stack">',
        (activeWf.fields || []).map(function (f) {
          if (f.type === 'select') {
            return '<label class="pbox-field"><span class="pbox-label">' + esc(f.label) + '</span>' +
              '<select class="pbox-input wf-field-input" data-fkey="' + esc(f.key) + '" data-flabel="' + esc(f.label) + '">' +
              (f.options || []).map(function (op) { return '<option value="' + esc(op) + '">' + esc(op) + '</option>'; }).join('') +
              '</select></label>';
          }
          if (f.type === 'textarea') {
            return '<label class="pbox-field"><span class="pbox-label">' + esc(f.label) + '</span>' +
              '<textarea class="pbox-textarea wf-field-input" rows="4" data-fkey="' + esc(f.key) + '" data-flabel="' + esc(f.label) + '" placeholder="' + esc(f.placeholder || '') + '"></textarea></label>';
          }
          return '<label class="pbox-field"><span class="pbox-label">' + esc(f.label) + '</span>' +
            '<input type="text" class="pbox-input wf-field-input" data-fkey="' + esc(f.key) + '" data-flabel="' + esc(f.label) + '" placeholder="' + esc(f.placeholder || '') + '"></label>';
        }).join(''),
        '    </div>',
        '    <div class="pbox-btn-group" style="margin-top:12px">',
        '      <button type="button" class="pbox-btn-sm" data-act="open-attach-modal">+ @판례·결정문 추가 첨부 (' + state.attached.length + '건)</button>',
        '      <button type="button" class="pbox-btn-primary" data-act="run-workflow"' + runDisabled + '>⚡ 서면 초안 생성 및 인용 검증 실행</button>',
        '    </div>',
        '  </div>'
      ].join('\n') : ''),
      '</div>'
    ].join('\n');
  }

  /* ── 7) 사건 프로젝트 폴더 관리 ── */
  function buildProjectsHtml() {
    var projects = global.PuPBoxStore.getProjects();
    var active = projects.find(function (p) { return p.id === state.activeProjectId; }) || projects[0] || null;
    if (active) state.activeProjectId = active.id;
    var selProjCnt = state.selectedProjectIds.size;
    var allProjSelected = projects.length > 0 && projects.every(function (p) { return state.selectedProjectIds.has(p.id); });

    return [
      '<div class="pbox-page-wrap">',
      '  <div class="pbox-sec-hd" style="margin-bottom:12px">',
      '    <span>📁 의뢰인 · 사건별 프로젝트 폴더 (' + projects.length + '개)</span>',
      '    <button type="button" class="pbox-btn-primary" data-act="create-project-prompt">+ 새 프로젝트 만들기</button>',
      '  </div>',
      (selProjCnt > 0 ? [
        '  <div class="pbox-bulk-bar">',
        '    <span>선택 <b>' + selProjCnt + '</b>개 프로젝트</span>',
        '    <div class="pbox-btn-group">',
        '      <button type="button" class="pbox-btn-sm" data-act="bulk-del-projs">🗑 선택 폴더 일괄 삭제</button>',
        '      <button type="button" class="pbox-btn-sm" data-act="clear-proj-sel">선택 해제</button>',
        '    </div>',
        '  </div>'
      ].join('\n') : ''),
      (!projects.length ? '<div class="pbox-card pbox-empty-box">사건 프로젝트를 만들면 관련 법령 조문·대법원/하급심 판례·행정해석·작성 서면을 한 폴더에 모아 관리하고 Word/마크다운으로 한 번에 내보낼 수 있습니다.<br><span class="pbox-muted">(개인 프로젝트는 로그인한 본인 계정 작업공간에만 격리 보관됩니다)</span></div>' : [
        '  <div class="pbox-proj-layout">',
        '    <div>',
        '      <div class="pbox-proj-headbar">',
        '        <label class="pbox-chk-line"><input type="checkbox" data-act="toggle-all-projs" aria-label="사건 프로젝트 전체 선택"' + (allProjSelected ? ' checked' : '') + '> <span>전체 선택</span></label>',
        '        <span>번호순</span>',
        '      </div>',
        '      <div class="pbox-proj-list" role="listbox" aria-label="사건 프로젝트 목록">',
        projects.map(function (p, pIdx) {
          var isAct = !!(active && p.id === active.id);
          var chk = state.selectedProjectIds.has(p.id) ? ' checked' : '';
          var cls = isAct ? 'pbox-proj-item active' : 'pbox-proj-item';
          return '<div class="' + cls + '" role="option" tabindex="0" aria-selected="' + (isAct ? 'true' : 'false') + '" data-act="select-project" data-id="' + esc(p.id) + '">' +
            '<label class="pbox-chk-tap"><input type="checkbox" data-act="toggle-proj-chk" data-id="' + esc(p.id) + '" aria-label="' + esc(p.name) + ' 선택"' + chk + '></label>' +
            '<span class="pbox-proj-num">' + (pIdx + 1) + '</span>' +
            '<div class="pbox-proj-body">' +
              '<div class="pbox-proj-name">📁 ' + esc(p.name) + '</div>' +
              '<div class="pbox-proj-meta">' + esc(p.clientName || p.category) + ' · 자료 ' + ((p.docIds || []).length + (p.lawKeys || []).length + (p.drafts || []).length) + '건</div>' +
            '</div>' +
          '</div>';
        }).join(''),
        '      </div>',
        '    </div>',
        (active ? [
          '    <div class="pbox-card pbox-proj-detail pbox-flat-m">',
          '      <div class="pbox-sec-hd">',
          '        <div class="pbox-proj-detail-title"><strong>📁 ' + esc(active.name) + '</strong> ' + (active.clientName ? '<span class="pbox-badge-blue">' + esc(active.clientName) + '</span>' : '') + '</div>',
          '        <div class="pbox-btn-group">',
          '          <button type="button" class="pbox-btn-sm" data-act="export-project" data-id="' + esc(active.id) + '">📥 통합 패킷 내보내기(.md)</button>',
          '          <button type="button" class="pbox-btn-sm" data-act="delete-project" data-id="' + esc(active.id) + '">🗑 폴더 삭제</button>',
          '        </div>',
          '      </div>',
          '      <div class="pbox-proj-subhd">수록 판례 · 유권해석 (' + (active.docIds || []).length + '건)</div>',
          ((active.docIds || []).length ? (active.docIds || []).map(function (did) {
            var d = global.PuPBoxStore.getDocById(did);
            if (!d) return '';
            return '<div class="pbox-recent-row" role="button" tabindex="0" data-act="open-doc" data-id="' + esc(d.id) + '"><div class="pbox-recent-main">' + esc(d.title) + '</div><div class="pbox-recent-sub">' + esc(d.court + ' · ' + d.caseNo) + '</div></div>';
          }).join('') : '<div class="pbox-empty-mini">판례·유권해석 목록에서 체크박스로 골라 담아 보세요.</div>'),
          '      <div class="pbox-proj-subhd" style="margin-top:14px">수록 국가법령 (' + (active.lawKeys || []).length + '건)</div>',
          ((active.lawKeys || []).length ? (active.lawKeys || []).map(function (dir) {
            return '<div class="pbox-recent-row" role="button" tabindex="0" data-act="open-law" data-dir="' + esc(dir) + '"><div class="pbox-recent-main">📖 ' + esc(dir) + '</div><div class="pbox-recent-sub">클릭 시 조문 전체 열람</div></div>';
          }).join('') : '<div class="pbox-empty-mini">국가법령 전수함에서 법령을 담아 보세요.</div>'),
          '      <div class="pbox-proj-subhd" style="margin-top:14px">보관된 AI 검토의견 · 서면 초안 (' + (active.drafts || []).length + '건)</div>',
          ((active.drafts || []).length ? (active.drafts || []).map(function (dr, idx) {
            return '<div class="pbox-draft-box"><div class="pbox-draft-hd"><strong>' + (idx + 1) + '. ' + esc(dr.title) + '</strong></div><div class="pbox-md-body">' + formatSimpleMd(dr.answer) + '</div></div>';
          }).join('') : '<div class="pbox-empty-mini">AI 법률비서 답변 화면에서 [프로젝트 담기]를 누르면 이곳에 보관됩니다.</div>'),
          '    </div>'
        ].join('\n') : ''),
        '  </div>'
      ].join('\n')),
      '</div>'
    ].join('\n');
  }

  /* ══════════════════════════════════════════════════════════════
   * 오른쪽 원문 분할 리더창 렌더링 (#pboxReader)
   * ══════════════════════════════════════════════════════════════ */
  function renderReader() {
    var rEl = document.getElementById('pboxReader');
    var wsGrid = document.getElementById('pboxWsGrid');
    if (wsGrid) {
      if (state.readerOpen) wsGrid.classList.add('reader-open');
      else wsGrid.classList.remove('reader-open');
    }
    if (!rEl) return;
    if (!state.readerOpen) {
      rEl.style.display = 'none';
      if (rEl.classList) rEl.classList.remove('wide-3dan');
      rEl.innerHTML = '';
      return;
    }
    rEl.style.display = 'flex';
    if (rEl.classList) {
      if (state.readerKind === 'law' && state.readerLawMode === '3dan') rEl.classList.add('wide-3dan');
      else rEl.classList.remove('wide-3dan');
    }

    function formatLawArticleTextHtml(rawTxt) {
      return esc(rawTxt).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
    }

    if (state.readerKind === 'law' && state.readerLawMode === '3dan') {
      var td = state.reader3Dan;
      var fam3 = state.readerLawFamily;
      var lawTitle3 = (td && td.title) || (fam3 && fam3.title) || '';
      var lawDir3 = (td && td.dir) || (fam3 && fam3.dir) || '';
      var official3Url = 'https://www.law.go.kr/%EB%B2%95%EB%A0%B9/' + encodeURIComponent(lawTitle3 || lawDir3);
      var q3 = state.readerArticleFilter.trim().toLowerCase();
      var colsHtml = '';
      if (!td || td.loading) {
        colsHtml = '<div class="pbox-loading-line">법률 · 시행령 · 시행규칙 3단 비교 원문을 불러오고 있습니다…</div>';
      } else {
        colsHtml = '<div class="pbox-3dan-grid">' + (td.cols || []).map(function (col) {
          var colLaw = col.law;
          var colArts = (colLaw && Array.isArray(colLaw.articles)) ? colLaw.articles.filter(function (a) {
            if (!q3) return true;
            return (a.no + ' ' + (a.heading || '') + ' ' + (a.text || '')).toLowerCase().indexOf(q3) >= 0;
          }) : [];
          var colBody = col.error
            ? '<div class="pbox-empty-mini">불러오기 실패: ' + esc(col.error) + '</div>'
            : (colArts.length ? colArts.map(function (a) {
                return '<article class="pbox-law-art">' +
                  (a.chapter ? '<div class="pbox-art-chap">' + esc(a.chapter) + '</div>' : '') +
                  '<div class="pbox-art-hd">' +
                    '<strong>' + esc(a.no + (a.heading ? ' (' + a.heading + ')' : '')) + '</strong>' +
                    '<button type="button" class="pbox-mini-act" data-act="copy-art" data-law="' + esc((colLaw ? colLaw.title : lawTitle3) + ' ' + col.label) + '" data-no="' + esc(a.no + (a.heading ? '(' + a.heading + ')' : '')) + '">복사</button>' +
                  '</div>' +
                  '<div class="pbox-art-txt">' + formatLawArticleTextHtml(a.text) + '</div>' +
                '</article>';
              }).join('') : '<div class="pbox-empty-mini">' + (q3 ? '검색어와 일치하는 조문이 없습니다.' : '수록 조문이 없습니다.') + '</div>');
          var effLbl = (colLaw && colLaw.effectiveState) ? colLaw.effectiveState.label : '';
          return '<section class="pbox-3dan-col" aria-label="' + esc(col.label) + ' 조문">' +
            '<div class="pbox-3dan-col-hd">' +
              '<span>' + esc(col.label) + ' (' + colArts.length + '조)</span>' +
              '<button type="button" class="pbox-mini-act" data-act="open-law" data-dir="' + esc(lawDir3) + '" data-file="' + esc(col.fileName) + '" title="' + esc(effLbl) + '">단일열기</button>' +
            '</div>' +
            colBody +
          '</section>';
        }).join('') + '</div>';
      }
      rEl.innerHTML = [
        '<div class="pbox-reader-hd">',
        '  <div class="pbox-reader-titlewrap">',
        '    <div class="pbox-reader-kicker"><span class="pbox-badge-green">📊 3단 비교 (법률 · 시행령 · 시행규칙)</span></div>',
        '    <strong class="pbox-reader-title">' + esc(lawTitle3) + '</strong>',
        '  </div>',
        '  <div class="pbox-btn-group">',
        '    <a class="pbox-btn-sm" href="' + esc(official3Url) + '" target="_blank" rel="noopener noreferrer">🏛️ 법제처 3단비교 ↗</a>',
        '    <button type="button" class="pbox-btn-sm" data-act="open-law" data-dir="' + esc(lawDir3) + '" data-file="' + esc(fam3 ? fam3.primaryFile : '법률.md') + '">단일 보기</button>',
        '    <button type="button" class="pbox-icon-btn" data-act="close-reader" aria-label="리더 닫기">✕</button>',
        '  </div>',
        '</div>',
        '<div class="pbox-reader-tools">',
        '  <input type="search" id="pboxReaderArtInput" class="pbox-input" aria-label="3단 비교 조문 동시 검색" value="' + esc(state.readerArticleFilter) + '" placeholder="법률·시행령·시행규칙 동시 조문 검색 (예: 제23조, 통상임금, 해고…)">',
        '</div>',
        '<div class="pbox-reader-bd">',
        colsHtml,
        '</div>'
      ].join('\n');
      return;
    }

    if (state.readerKind === 'law') {
      var law = state.readerLaw;
      var fam = state.readerLawFamily;
      if (!law) {
        rEl.innerHTML = '<div class="pbox-reader-hd"><strong>📖 법령 원문 불러오는 중…</strong><button type="button" class="pbox-icon-btn" data-act="close-reader" aria-label="리더 닫기">✕</button></div><div class="pbox-reader-bd"><div class="pbox-loading-line">국가법령 미러에서 조문 전체를 가져오고 있습니다…</div></div>';
        return;
      }
      var effClass = law.isHistorical ? 'pbox-badge-amber' : ((law.effectiveState && law.effectiveState.status === 'upcoming') ? 'pbox-badge-amber' : 'pbox-badge-green');
      var effText = law.isHistorical
        ? ('📜 과거 구법 (' + (law.revisionDate || law.effectiveDate || '이전 개정본') + ')')
        : (law.effectiveState ? law.effectiveState.label : '시행법령');
      var qArt = state.readerArticleFilter.trim().toLowerCase();
      var arts = (law.articles || []).filter(function (a) {
        if (!qArt) return true;
        return (a.no + ' ' + (a.heading || '') + ' ' + (a.text || '')).toLowerCase().indexOf(qArt) >= 0;
      });
      var E = global.PuPBoxEngine;
      var rawAttachments = Array.isArray(law.attachments) ? law.attachments : [];
      var filteredAnnexes = rawAttachments.filter(function (att) {
        if (!att || typeof att !== 'object') return false;
        var lbl = (E && typeof E.formatLawAttachmentLabel === 'function') ? E.formatLawAttachmentLabel(att) : '[별표]';
        var ttl = String(att['제목'] || '').trim();
        if (!ttl && lbl === '[별표]') return false;
        if (!qArt) return true;
        return (lbl + ' ' + lbl.replace(/\s+/g, '') + ' ' + ttl).toLowerCase().indexOf(qArt) >= 0;
      });
      var isAnnexHighlight = !!(state.readerHighlightArt && state.readerHighlightArt.charAt(0) === '[');
      var openAnnexAttr = (isAnnexHighlight || (qArt && filteredAnnexes.length > 0 && arts.length === 0)) ? ' open' : '';
      var annexHtml = filteredAnnexes.length ? [
        '<details class="pbox-addenda pbox-annex-details"' + openAnnexAttr + '>',
        '  <summary>📎 별표·서식 목록 (' + filteredAnnexes.length + '건)</summary>',
        '  <div class="pbox-annex-list">',
        filteredAnnexes.map(function (att) {
          var lbl = (E && typeof E.formatLawAttachmentLabel === 'function') ? E.formatLawAttachmentLabel(att) : '[별표]';
          var ttl = String(att['제목'] || '').trim();
          var domId = 'pboxArt_' + lbl.replace(/[^0-9가-힣]/g, '');
          var hi = state.readerHighlightArt === lbl ? ' highlight' : '';
          var pdfLink = String(att['PDF링크'] || '').trim();
          var fileLink = String(att['파일링크'] || '').trim();
          var safeLawGoRe = /^https:\/\/(?:www\.)?law\.go\.kr\//i;
          var linkBtns = [];
          if (safeLawGoRe.test(pdfLink)) {
            linkBtns.push('<a class="pbox-mini-act" href="' + esc(pdfLink) + '" target="_blank" rel="noopener noreferrer">PDF 원문 ↗</a>');
          }
          if (safeLawGoRe.test(fileLink)) {
            linkBtns.push('<a class="pbox-mini-act" href="' + esc(fileLink) + '" target="_blank" rel="noopener noreferrer">HWP·서식 ↗</a>');
          }
          return '<div id="' + domId + '" class="pbox-annex-row' + hi + '">' +
            '<div class="pbox-annex-main"><strong>' + esc(lbl) + '</strong> <span>' + esc(ttl) + '</span></div>' +
            (linkBtns.length ? '<div class="pbox-annex-acts">' + linkBtns.join('') + '</div>' : '') +
          '</div>';
        }).join(''),
        '  </div>',
        '</details>'
      ].join('\n') : '';

      var siblingTabs = (fam && fam.files ? fam.files : []).filter(function (fn) {
        return !(fam.hasRepealStub && fn === '법률');
      }).map(function (fn) {
        var fullFn = fn + '.md';
        var isCur = law.fileName === fullFn;
        return '<button type="button" role="tab" aria-selected="' + (isCur ? 'true' : 'false') + '" class="pbox-tab-pill' + (isCur ? ' active' : '') + '" data-act="open-law" data-dir="' + esc(law.dir) + '" data-file="' + esc(fullFn) + '">' + esc(fn === '법률(법률)' ? '법률(현행)' : fn) + '</button>';
      }).join('');
      var has3DanInReader = resolve3DanTargets(fam).length >= 2;
      if (has3DanInReader) {
        siblingTabs += ' <button type="button" class="pbox-3dan-btn" data-act="open-law-3dan" data-dir="' + esc(law.dir) + '">📊 3단 비교</button>';
      }
      siblingTabs += ' <button type="button" class="pbox-tab-pill' + (state.readerHistoryOpen || law.isHistorical ? ' active' : '') + '" data-act="toggle-law-history">📜 과거 구법·연혁</button>';

      var historyBarHtml = '';
      if (state.readerHistoryOpen || law.isHistorical) {
        var revOptionsHtml = '<option value="current"' + (!law.isHistorical ? ' selected' : '') + '>현재 시행본 (최신)</option>' +
          (state.readerHistoryList || []).filter(function (r) { return !r.isLatest; }).map(function (r) {
            var sel = (law.isHistorical && law.revisionSha === r.sha) ? ' selected' : '';
            return '<option value="' + esc(r.sha) + '"' + sel + '>' + esc(r.label) + '</option>';
          }).join('');
        var officialHistUrl = buildOfficialHistoricalLawUrl(law.title, state.readerHistoryDate);
        var officialAllHistUrl = buildOfficialHistoricalLawUrl(law.title, '');
        historyBarHtml = [
          '<div class="pbox-history-bar" role="region" aria-label="과거 법령(구법) 연혁 선택">',
          '  <div class="pbox-history-row">',
          '    <strong>📜 과거 구법 선택:</strong>',
          (state.readerHistoryBusy
            ? '    <span>개정 이력 불러오는 중…</span>'
            : '    <select id="pboxLawRevSelect" class="pbox-history-sel" aria-label="과거 개정본(구법) 선택">' + revOptionsHtml + '</select>'),
          (law.isHistorical ? '    <button type="button" class="pbox-btn-sm" data-act="return-current-law">현행법으로 돌아가기</button>' : ''),
          '  </div>',
          (state.readerHistoryError ? '  <div>' + esc(state.readerHistoryError) + '</div>' : ''),
          '  <div class="pbox-history-row">',
          '    <span>특정 기준일(법제처 전체 연혁):</span>',
          '    <input type="date" id="pboxReaderHistDate" class="pbox-law-hist-date" aria-label="법제처 기준일 구법 날짜" value="' + esc(state.readerHistoryDate) + '">',
          '    <a class="pbox-mini-act" href="' + esc(officialHistUrl) + '" target="_blank" rel="noopener noreferrer">기준일 법제처 ↗</a>',
          '    <a class="pbox-mini-act" href="' + esc(officialAllHistUrl) + '" target="_blank" rel="noopener noreferrer">전체 연혁·폐지법 ↗</a>',
          '  </div>',
          '</div>'
        ].join('\n');
      }

      var readerConnLaws = (E && typeof E.getConnectedLawsFor === 'function')
        ? E.getConnectedLawsFor(law.dir, global.PuPBoxLawIndex ? global.PuPBoxLawIndex.list() : [], 8)
        : [];
      var readerConnHtml = buildConnectedLawsBarHtml(readerConnLaws, {
        label: '🔗 연결·유사직역 비교 법령',
        openInReader: true
      });
      var artAuthMap = (E && typeof E.indexAuthoritiesByLaw === 'function')
        ? E.indexAuthoritiesByLaw(law.title, global.PuPBoxStore.getDocs())
        : new Map();

      rEl.innerHTML = [
        '<div class="pbox-reader-hd">',
        '  <div class="pbox-reader-titlewrap">',
        '    <div class="pbox-reader-kicker"><span class="' + effClass + '">' + esc(effText) + '</span> <span class="pbox-muted">공포 제' + esc(law.promulgationNo || '-') + '호</span></div>',
        '    <strong class="pbox-reader-title">' + esc(law.title) + '</strong>',
        '  </div>',
        '  <div class="pbox-btn-group">',
        '    <button type="button" class="pbox-btn-sm" data-act="attach-law" data-dir="' + esc(law.dir) + '" data-file="' + esc(law.fileName) + '">@ AI 첨부</button>',
        '    <button type="button" class="pbox-icon-btn" data-act="close-reader" aria-label="리더 닫기">✕</button>',
        '  </div>',
        '</div>',
        (siblingTabs ? '<div class="pbox-reader-tabs" role="tablist" aria-label="관련 하위법령 및 3단비교·구법 탭">' + siblingTabs + '</div>' : ''),
        historyBarHtml,
        readerConnHtml,
        '<div class="pbox-reader-tools">',
        '  <input type="search" id="pboxReaderArtInput" class="pbox-input" aria-label="이 법령 내 조문·별표 찾기" value="' + esc(state.readerArticleFilter) + '" placeholder="이 법령 내 조문·별표 찾기 (예: 제23조, 별표 1, 통상임금…)">',
        '  <span class="pbox-muted">' + arts.length + ' / ' + (law.articles || []).length + '개 조문' + (rawAttachments.length ? (' · 별표 ' + filteredAnnexes.length + '건') : '') + '</span>',
        '</div>',
        '<div class="pbox-reader-bd">',
        (arts.length ? arts.map(function (a) {
          var domId = 'pboxArt_' + a.no.replace(/[^0-9가-힣]/g, '');
          var hi = state.readerHighlightArt === a.no ? ' highlight' : '';
          var linkedDocs = artAuthMap.get(String(a.no || '').replace(/\s+/g, '')) || [];
          var linkedHtml = linkedDocs.length ? (
            '<div class="pbox-art-linked">' +
              '<span>⚖️ 연결 판례·해석 ' + linkedDocs.length + '건:</span>' +
              linkedDocs.slice(0, 5).map(function (ld) {
                var shortOrg = String(ld.court || ld.agency || '').replace(/\s*전원합의체\s*/, ' 전합');
                var pillTxt = (shortOrg ? shortOrg + ' ' : '') + (ld.caseNo || ld.title.slice(0, 18));
                return '<button type="button" class="pbox-subfile-btn" data-act="open-doc" data-id="' + esc(ld.id) + '" title="' + esc(ld.title) + '">' + esc(pillTxt) + '</button>';
              }).join(' ') +
            '</div>'
          ) : '';
          return '<article id="' + domId + '" class="pbox-law-art' + hi + '">' +
            (a.chapter ? '<div class="pbox-art-chap">' + esc(a.chapter) + '</div>' : '') +
            '<div class="pbox-art-hd">' +
              '<strong>' + esc(a.no + (a.heading ? ' (' + a.heading + ')' : '')) + '</strong>' +
              '<button type="button" class="pbox-mini-act" data-act="copy-art" data-law="' + esc(law.title) + '" data-no="' + esc(a.no + (a.heading ? '(' + a.heading + ')' : '')) + '">조문복사</button>' +
            '</div>' +
            '<div class="pbox-art-txt">' + formatLawArticleTextHtml(a.text) + '</div>' +
            linkedHtml +
          '</article>';
        }).join('') : (qArt && filteredAnnexes.length ? '<div class="pbox-empty-mini">해당 검색어와 일치하는 본문 조문은 없으며, 아래 별표·서식 목록에서 일치 항목을 찾았습니다.</div>' : '<div class="pbox-plain-law">' + formatLawArticleTextHtml(law.plainText) + '</div>')),
        annexHtml,
        (law.addenda ? '<details class="pbox-addenda"><summary>부칙 보기</summary><pre class="pbox-preview-pre">' + esc(law.addenda) + '</pre></details>' : ''),
        '</div>'
      ].join('\n');
      return;
    }

    if (state.readerKind === 'doc' && state.readerDoc) {
      var d = state.readerDoc;
      var E = global.PuPBoxEngine;
      var safeOfficialUrl = (E && typeof E.sanitizeOfficialLawUrlClient === 'function')
        ? E.sanitizeOfficialLawUrlClient(d.officialUrl)
        : '';
      var readerSig = (E && typeof E.classifyLegalOutcomeSignal === 'function')
        ? E.classifyLegalOutcomeSignal(d)
        : { label: '', badgeCls: 'pbox-badge-gray', caution: '' };
      rEl.innerHTML = [
        '<div class="pbox-reader-hd">',
        '  <div class="pbox-reader-titlewrap">',
        '    <div class="pbox-reader-kicker">' +
          '<span class="' + docTypeBadgeClass(d.docType) + '">' + esc(docTypeBadgeLabel(d.docType)) + '</span> ' +
          (readerSig.label ? '<span class="' + readerSig.badgeCls + '">' + esc(readerSig.label) + '</span> ' : '') +
          '<span class="pbox-mono">' + esc(d.caseNo || '') + '</span> · ' + esc(d.decisionDate || '') +
        '</div>',
        '    <strong class="pbox-reader-title">' + esc(d.title) + '</strong>',
        '  </div>',
        '  <div class="pbox-btn-group">',
        (safeOfficialUrl ? '    <a class="pbox-btn-sm" href="' + esc(safeOfficialUrl) + '" target="_blank" rel="noopener noreferrer">🏛️ 법제처 공식원문 ↗</a>' : ''),
        '    <button type="button" class="pbox-btn-sm" data-act="copy-doc-citation" data-id="' + esc(d.id) + '">📌 인용문 복사</button>',
        '    <button type="button" class="pbox-btn-sm" data-act="attach-doc" data-id="' + esc(d.id) + '">@ AI 첨부</button>',
        '    <button type="button" class="pbox-btn-sm" data-act="copy-doc-body" data-id="' + esc(d.id) + '">📋 전문복사</button>',
        '    <button type="button" class="pbox-icon-btn" data-act="close-reader" aria-label="리더 닫기">✕</button>',
        '  </div>',
        '</div>',
        '<div class="pbox-reader-bd">',
        (readerSig.caution ? '  <div class="pbox-status-banner warn" role="status" style="margin-top:0;margin-bottom:10px"><strong>⚠ 판례 · 법리 변경 주의</strong><div style="margin-top:3px">' + esc(readerSig.caution) + '</div></div>' : ''),
        '  <div class="pbox-doc-meta-box">',
        '    <div><b>기관/법원:</b> ' + esc(d.court || d.agency) + '</div>',
        '    <div><b>출처 채널:</b> ' + esc((d.sources || []).join(' · ')) + '</div>',
        (safeOfficialUrl ? '    <div><b>공식 검증 원문:</b> <a href="' + esc(safeOfficialUrl) + '" target="_blank" rel="noopener noreferrer">' + esc(safeOfficialUrl) + ' ↗</a></div>' : ''),
        ((d.refLaws && d.refLaws.length) ? '<div><b>참조조문:</b> ' + d.refLaws.map(function (rl) {
          var m = /^([가-힣ㆍ\s]+?(?:법률|법))\s*(제\d+조(?:의\d+)?)?/.exec(rl);
          if (m) {
            return '<button type="button" class="pbox-subfile-btn" data-act="open-law" data-dir="' + esc(m[1].replace(/\s+/g, '')) + '" data-art="' + esc(m[2] || '') + '">' + esc(rl) + '</button>';
          }
          return esc(rl);
        }).join(' ') + '</div>' : ''),
        '  </div>',
        '  <div class="pbox-doc-summary-box"><strong>【핵심 요지】</strong><br>' + esc(d.summary) + '</div>',
        '  <div class="pbox-doc-body-text">' + esc(d.body).replace(/\n/g, '<br>') + '</div>',
        '</div>'
      ].join('\n');
    }
  }

  /* ══════════════════════════════════════════════════════════════
   * 모달 창 (포커스 이동 · Tab 가두기 · Escape 닫기 · 포커스 복귀 완비)
   * ══════════════════════════════════════════════════════════════ */
  function getFocusableIn(container) {
    if (!container) return [];
    var nodes = container.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])');
    return Array.prototype.slice.call(nodes).filter(function (el) {
      return el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement;
    });
  }

  function openModalHtml(html, keepCurrentFocus, wideMode) {
    var back = document.getElementById('pboxModalBackdrop');
    var body = document.getElementById('pboxModalBox');
    if (!back || !body) return;
    if (back.style.display !== 'flex') {
      state._modalPrevFocus = document.activeElement || null;
    }
    if (body.classList) {
      if (wideMode) body.classList.add('wide');
      else body.classList.remove('wide');
    }
    body.innerHTML = html;
    back.style.display = 'flex';
    if (!keepCurrentFocus) {
      var focusables = getFocusableIn(body);
      if (focusables.length && typeof focusables[0].focus === 'function') {
        focusables[0].focus();
      }
    }
  }

  function closeModal() {
    var back = document.getElementById('pboxModalBackdrop');
    var body = document.getElementById('pboxModalBox');
    if (back) back.style.display = 'none';
    if (body && body.classList) body.classList.remove('wide');
    state._cfgAutoProbedInCurrentOpen = false;
    if (state._modalPrevFocus && typeof state._modalPrevFocus.focus === 'function') {
      try { state._modalPrevFocus.focus(); } catch (e) {}
    }
    state._modalPrevFocus = null;
  }

  function showCompareDocsModal() {
    var ids = Array.from(state.selectedDocIds);
    var selectedDocs = ids.map(function (id) { return global.PuPBoxStore.getDocById(id); }).filter(Boolean);
    if (!selectedDocs.length) {
      toast('비교할 판례·재결·행정해석을 1건 이상 선택해 주세요.', 'err');
      return;
    }
    var E = global.PuPBoxEngine;
    var mat = E.buildAuthorityComparisonMatrix(selectedDocs, { query: state.caseQuery });
    var rowsHtml = mat.rows.map(function (r) {
      return '<tr>' +
        '<td data-label="기관·일자"><strong>' + esc(r.orgAndDate) + '</strong></td>' +
        '<td data-label="사건·문서번호"><span class="pbox-mono">' + esc(r.caseNo) + '</span><br><button type="button" class="pbox-link-btn" data-act="open-doc-from-modal" data-id="' + esc(r.id) + '">' + esc(r.title) + '</button></td>' +
        '<td data-label="결론·효력"><span class="' + r.signal.badgeCls + '">' + esc(r.signal.label) + '</span>' +
          (r.caution ? '<br><span class="pbox-badge-amber" title="' + esc(r.caution) + '">⚠ 변경주의</span>' : '') + '</td>' +
        '<td data-label="핵심 법리 발췌">' + esc(r.keyExcerpt) + '</td>' +
        '<td data-label="참조조문"><span class="pbox-muted">' + esc(r.refLawsText) + '</span></td>' +
      '</tr>';
    }).join('');

    openModalHtml([
      '<div class="pbox-modal-hd"><strong id="pboxModalTitle">📊 선택 판례 · 결정례 · 행정해석 한눈에 비교표 (' + mat.rows.length + '건)</strong><button type="button" class="pbox-icon-btn" data-act="close-modal" aria-label="비교표 닫기">✕</button></div>',
      '<div class="pbox-modal-bd">',
      '  <div class="pbox-matrix-wrap">',
      '    <table class="pbox-matrix-table" aria-label="선택 자료 비교 매트릭스">',
      '      <thead><tr><th style="width:135px">기관 · 일자</th><th style="width:190px">사건번호 · 제목</th><th style="width:110px">결론신호</th><th>핵심 법리 · 판단 요지 (원문 발췌)</th><th style="width:150px">참조조문</th></tr></thead>',
      '      <tbody>' + rowsHtml + '</tbody>',
      '    </table>',
      '  </div>',
      '  <div class="pbox-modal-ft">',
      '    <button type="button" class="pbox-btn-sm" data-act="copy-compare-md">📋 비교표 마크다운 복사</button>',
      '    <button type="button" class="pbox-btn-primary" data-act="compare-to-ai-review">✦ 이 자료들로 AI 종합 비교검토 시작</button>',
      '  </div>',
      '</div>'
    ].join('\n'), false, true);
  }

  function showAttachModal(filterQ, keepFocus) {
    var q = String(filterQ || '').trim().toLowerCase();
    var docs = global.PuPBoxStore.getDocs().filter(function (d) {
      if (!q) return true;
      return (d.title + ' ' + d.caseNo + ' ' + d.summary).toLowerCase().indexOf(q) >= 0;
    }).slice(0, 10);

    var laws = (global.PuPBoxLawIndex ? global.PuPBoxLawIndex.list() : []).filter(function (f) {
      if (!q) return f.priority > 0;
      return (f.title + ' ' + f.dir).toLowerCase().indexOf(q) >= 0;
    }).slice(0, 10);

    openModalHtml([
      '<div class="pbox-modal-hd"><strong id="pboxModalTitle">@ 법령 · 판례 · 행정해석 원문 첨부</strong><button type="button" class="pbox-icon-btn" data-act="close-modal" aria-label="첨부 창 닫기">✕</button></div>',
      '<div class="pbox-modal-bd">',
      '  <input type="search" id="pboxAttachFilterInput" class="pbox-input" aria-label="첨부할 법령·판례 검색" value="' + esc(filterQ || '') + '" placeholder="법령명 또는 사건번호·쟁점 검색 (예: 근로기준법, 2020다247190, 산재, 괴롭힘)">',
      '  <div class="pbox-modal-subhd">📖 국가법령 선택 첨부</div>',
      '  <div class="pbox-modal-list">',
      laws.map(function (f) {
        return '<div class="pbox-modal-row"><span><strong>' + esc(f.title) + '</strong> <span class="pbox-muted">(' + esc(f.dept || '국가법령') + ')</span></span><button type="button" class="pbox-btn-sm" data-act="modal-attach-law" data-dir="' + esc(f.dir) + '" data-file="' + esc(f.primaryFile) + '">@ 첨부</button></div>';
      }).join(''),
      '  </div>',
      '  <div class="pbox-modal-subhd">⚖️ 판례 · 심결례 · 행정해석 선택 첨부</div>',
      '  <div class="pbox-modal-list">',
      docs.map(function (d) {
        return '<div class="pbox-modal-row"><span><span class="pbox-mono">' + esc(d.caseNo) + '</span> <strong>' + esc(d.title) + '</strong></span><button type="button" class="pbox-btn-sm" data-act="modal-attach-doc" data-id="' + esc(d.id) + '">@ 첨부</button></div>';
      }).join(''),
      '  </div>',
      '</div>'
    ].join('\n'), !!keepFocus);
  }

  function showCreateProjectModal(afterCreatedCb) {
    state._afterProjCb = afterCreatedCb || null;
    openModalHtml([
      '<div class="pbox-modal-hd"><strong id="pboxModalTitle">📁 새 사건 프로젝트 만들기</strong><button type="button" class="pbox-icon-btn" data-act="close-modal" aria-label="창 닫기">✕</button></div>',
      '<div class="pbox-modal-bd">',
      '  <div class="pbox-form-stack">',
      '    <label class="pbox-field"><span class="pbox-label">프로젝트·사건명</span><input type="text" id="pboxNewProjName" class="pbox-input" placeholder="예: (주)푸른물류 통상임금 개편 자문 / 김OO 산재 요양불승인 취소"></label>',
      '    <label class="pbox-field"><span class="pbox-label">의뢰인·거래처명 (선택)</span><input type="text" id="pboxNewProjClient" class="pbox-input" placeholder="예: (주)푸른물류"></label>',
      '    <label class="pbox-field"><span class="pbox-label">사건 메모</span><textarea id="pboxNewProjNote" class="pbox-textarea" rows="3" placeholder="쟁점 요약 또는 기일 메모"></textarea></label>',
      '  </div>',
      '  <div class="pbox-modal-ft">',
      '    <button type="button" class="pbox-btn-sm" data-act="close-modal">취소</button>',
      '    <button type="button" class="pbox-btn-primary" data-act="confirm-create-proj">프로젝트 생성</button>',
      '  </div>',
      '</div>'
    ].join('\n'));
  }

  function formatKstDateTime(isoStr) {
    if (!isoStr) return '';
    var ms = Date.parse(String(isoStr));
    if (!Number.isFinite(ms)) return String(isoStr).replace('T', ' ').slice(0, 16);
    var kst = new Date(ms + 9 * 3600000).toISOString();
    return kst.slice(0, 10) + ' ' + kst.slice(11, 16) + ' KST';
  }

  function showConfigModal(modalOpts) {
    var mOpts = modalOpts || {};
    var cfg = global.PuPBoxStore.getConfig();
    var draft = mOpts.draft || null;
    var valAutoBoot = draft ? !!draft.autoSyncOnBoot : !!cfg.autoSyncOnBoot;
    var valOfflineAi = draft ? !!draft.preferOfflineAi : !!cfg.preferOfflineAi;
    var valLawOc = draft ? String(draft.lawOc || '') : String(cfg.lawOc || '');
    var valSupaUrl = draft ? String(draft.supabaseUrl || '') : String(cfg.supabaseUrl || '');
    var valSupaKey = draft ? String(draft.supabaseStaffJwt || '') : String(cfg.supabaseStaffJwt || '');
    var sum = global.PuPBoxStore.getStateSummary();
    var isStaffLoggedIn = !!(state.authUser && state.authUser.uid);
    var isSharedVerified = !!sum.sharedServerConnected;
    var lastAutoTxt = sum.lastServerAutoSyncAt
      ? formatKstDateTime(sum.lastServerAutoSyncAt)
      : (sum.lastSyncAt ? formatKstDateTime(sum.lastSyncAt) : '접속 즉시 자동 실행');
    var hasCustomAdv = draft && draft.advOpen !== undefined
      ? !!draft.advOpen
      : Boolean(valLawOc.trim() || valSupaUrl.trim());
    var syncModalBusy = state.syncBusy ? ' disabled aria-busy="true"' : '';
    var bannerKind = isSharedVerified ? 'ok' : 'warn';
    var bannerHeadline = isSharedVerified
      ? '✓ 푸른노무법인 무료 공유 DB · 자동동기화 직결 완료 (비용 ₩0 · 별도 설정 불필요)'
      : (isStaffLoggedIn
          ? '⏳ 푸른노무법인 무료 공유 DB 연결 상태 확인 중… (잠시만 기다리거나 [🔌 공유 DB 연결 확인]을 누르세요)'
          : 'ℹ 포털 직원 로그인 시 푸른 무료 공유 DB가 자동 연결됩니다 (현재 내 브라우저 모드)');
    var backendDesc = sum.supabaseConnected
      ? '외부 Supabase 연동 활성'
      : (isSharedVerified
          ? ('푸른 보안 클라우드 무료 공유함 연결 완료 (공유 원문 ' + (sum.totalSharedActive || sum.syncedDocsCount || 0) + '건 · 외부 익명 차단)')
          : '푸른 보안 클라우드 무료 공유함 (전 직원 자동 공유 · 외부 익명 차단)');

    openModalHtml([
      '<div class="pbox-modal-hd"><strong id="pboxModalTitle">⚙ P박스 자동동기화 · 무료 공유 DB 설정</strong><button type="button" class="pbox-icon-btn" data-act="close-modal" aria-label="설정 닫기">✕</button></div>',
      '<div class="pbox-modal-bd">',
      '  <div class="pbox-status-banner ' + bannerKind + '" role="status" style="margin-top:0;margin-bottom:10px">',
      '    <strong>' + bannerHeadline + '</strong>',
      '    <div style="margin-top:4px">',
      '      • <b>공유 저장소:</b> ' + backendDesc + '<br>',
      '      • <b>현재 수록 자료:</b> 현행 국가법령 <b>' + sum.totalNationalLaws.toLocaleString() + '편</b> · 판례·심판재결·유권해석 <b>' + sum.docsCount + '건</b> (내장 검증원문 ' + sum.seedDocsCount + '건 + 자동동기화·공유 추가 ' + sum.syncedDocsCount + '건)<br>',
      '      • <b>자동 동기화 주기:</b> 앱 열 때 자동 반영 + 매일 새벽 03:20(KST) 서버 자동 수집 (최근 점검: ' + esc(lastAutoTxt) + ')',
      '    </div>',
      '  </div>',
      '  <div class="pbox-info-note" style="margin-bottom:10px">',
      '    <b>🛡️ 무료 사이트 홈페이지 개편·장애 대비 4중 자가복구 탐색 엔진 탑재</b><br>',
      '    무료 공공·법률 사이트의 메뉴·화면(HTML/DOM)이 바뀌어 일반 수집이 막히더라도 <b>① 공식 기본경로 → ② 표준 무파라미터·통합 경로 자동우회 → ③ 자율 DOM·내장 JSON 원문 추출기 → ④ 약칭·핵심어 자동 분해 및 공공도메인(<code>.go.kr</code>) 정밀 우회탐색</b>이 자동으로 작동합니다.',
      '  </div>',
      '  <div class="pbox-form-stack">',
      '    <label class="pbox-chk-line"><input type="checkbox" id="pboxCfgAutoBoot" aria-label="앱을 열 때 법령 개정 및 수집 변경분 자동 점검"' + (valAutoBoot ? ' checked' : '') + '> 앱을 열 때 법령 개정 · 판례 · 심판재결 변경분 자동 동기화 (권장)</label>',
      '    <label class="pbox-chk-line"><input type="checkbox" id="pboxCfgOfflineAi" aria-label="클라우드 AI 호출 없이 내장 무료 합성 모드만 사용"' + (valOfflineAi ? ' checked' : '') + '> 클라우드 AI 호출 없이 100% 내장 무료 합성 모드만 사용</label>',
      '  </div>',
      '  <div class="pbox-btn-group" style="margin-top:12px">',
      '    <button type="button" id="pboxCfgSyncNowBtn" class="pbox-btn-primary" data-act="sync-now-modal"' + syncModalBusy + '>' + (state.syncBusy ? '⏳ 자동동기화 실행 중…' : '🔄 지금 즉시 전체 판례·재결 자동동기화') + '</button>',
      '    <button type="button" id="pboxCfgAutoDiscBtn" class="pbox-btn-sm" data-act="jump-auto-discover">🔎 개편·누락 자료 자동탐색기</button>',
      '    <button type="button" id="pboxCfgTestSupaBtn" class="pbox-btn-sm" data-act="test-supa-cfg">🔌 공유 DB 연결 확인</button>',
      '    <button type="button" class="pbox-btn-sm" data-act="backup-export-json">💾 전체 JSON 백업</button>',
      '    <button type="button" id="pboxBackupImportBtn" class="pbox-btn-sm" data-act="backup-import-json"' + (state.backupBusy ? ' disabled aria-busy="true"' : '') + '>' + (state.backupBusy ? '⏳ 백업 복원 중…' : '📂 JSON 백업 복원') + '</button>',
      '    <input type="file" id="pboxBackupFileInput" accept=".json" style="display:none" aria-label="백업 JSON 파일 선택">',
      '  </div>',
      '  <details id="pboxCfgAdvDetails" class="pbox-addenda" style="margin-top:12px"' + (hasCustomAdv ? ' open' : '') + '>',
      '    <summary>고급 선택 설정 (개인 법제처 OC 아이디 · 외부 Supabase 수동 지정 — 기본 무료 공유 사용 시 비워 두세요)</summary>',
      '    <div class="pbox-form-stack" style="margin-top:10px">',
      '      <label class="pbox-field"><span class="pbox-label">법제처 국가법령정보 공동활용 OC 아이디 (선택 · 비워 두어도 공식 원문 자동 수집 작동)</span><input type="text" id="pboxCfgLawOc" class="pbox-input" value="' + esc(valLawOc) + '" placeholder="open.law.go.kr 신청 이메일 앞자리 ID (선택)"></label>',
      '      <label class="pbox-field"><span class="pbox-label">외부 Supabase HTTPS Project URL (선택 · 기본 푸른 클라우드 공유함 대신 직접 연결할 때만 입력)</span><input type="url" id="pboxCfgSupaUrl" class="pbox-input" value="' + esc(valSupaUrl) + '" placeholder="https://xxxxxxxxxxxx.supabase.co (선택)"></label>',
      '      <label class="pbox-field"><span class="pbox-label">외부 Supabase 직원 인증 JWT (선택 · 현재 세션 메모리에만 보관되며 로그아웃 시 파기)</span><input type="password" id="pboxCfgSupaKey" class="pbox-input" value="' + esc(valSupaKey) + '" placeholder="인증된 직원 세션 JWT (선택)"></label>',
      '    </div>',
      '  </details>',
      '  <div class="pbox-modal-ft">',
      '    <button type="button" class="pbox-btn-sm" data-act="close-modal">닫기</button>',
      '    <button type="button" class="pbox-btn-primary" data-act="save-cfg">설정 저장 및 동기화</button>',
      '  </div>',
      '</div>'
    ].join('\n'), !!mOpts.keepFocus);

    if (isStaffLoggedIn && !isSharedVerified && !state._cfgAutoProbeInFlight && !state._cfgAutoProbedInCurrentOpen) {
      state._cfgAutoProbedInCurrentOpen = true;
      state._cfgAutoProbeInFlight = true;
      global.PuPBoxStore.testSharedServerConnection(getAuthObj())
        .then(function () {
          state._cfgAutoProbeInFlight = false;
          renderSidebarCounts();
          refreshConfigModalInPlace();
        })
        .catch(function () {
          state._cfgAutoProbeInFlight = false;
        });
    }
  }

  function refreshConfigModalInPlace() {
    var back = document.getElementById('pboxModalBackdrop');
    var autoChk = document.getElementById('pboxCfgAutoBoot');
    if (!back || back.style.display !== 'flex' || !autoChk) return;
    var activeEl = document.activeElement;
    var focusId = (activeEl && activeEl.id) ? activeEl.id : '';
    var selStart = (activeEl && typeof activeEl.selectionStart === 'number') ? activeEl.selectionStart : null;
    var selEnd = (activeEl && typeof activeEl.selectionEnd === 'number') ? activeEl.selectionEnd : null;
    var advEl = document.getElementById('pboxCfgAdvDetails');
    showConfigModal({
      keepFocus: true,
      draft: {
        autoSyncOnBoot: !!autoChk.checked,
        preferOfflineAi: !!(document.getElementById('pboxCfgOfflineAi') || {}).checked,
        lawOc: (document.getElementById('pboxCfgLawOc') || {}).value || '',
        supabaseUrl: (document.getElementById('pboxCfgSupaUrl') || {}).value || '',
        supabaseStaffJwt: (document.getElementById('pboxCfgSupaKey') || {}).value || '',
        advOpen: advEl ? !!advEl.open : undefined
      }
    });
    if (focusId) {
      var nextFocusEl = document.getElementById(focusId);
      if (nextFocusEl && !nextFocusEl.disabled && typeof nextFocusEl.focus === 'function') {
        try {
          nextFocusEl.focus();
          if (selStart !== null && typeof nextFocusEl.setSelectionRange === 'function') {
            nextFocusEl.setSelectionRange(selStart, selEnd !== null ? selEnd : selStart);
          }
        } catch (_) {}
      }
    }
  }

  /* ══════════════════════════════════════════════════════════════
   * 이벤트 위임 처리기
   * ══════════════════════════════════════════════════════════════ */
  function getAuthObj() {
    if (global && global.firebase && typeof global.firebase.auth === 'function') return global.firebase.auth();
    if (typeof firebase !== 'undefined' && firebase.auth) return firebase.auth();
    return state.authUser ? { currentUser: state.authUser } : null;
  }

  function isSameSession(expectedGen, expectedUid) {
    return global.PuPBoxStore.getSessionGen() === expectedGen &&
           global.PuPBoxStore.getActiveUid() === expectedUid;
  }

  function snapshotAuthForUid(expectedUid) {
    var liveAuth = getAuthObj();
    var curUser = (liveAuth && liveAuth.currentUser) || state.authUser;
    if (!curUser || !curUser.uid || curUser.uid !== expectedUid) return null;
    return { currentUser: curUser };
  }

  function handleIngestFiles(fileList) {
    var files = Array.prototype.slice.call(fileList || []);
    if (!files.length) return;
    if (state.ingestBusy) {
      toast('이미 파일 비식별 추출이 진행 중입니다. 잠시만 기다려 주세요.', 'err');
      return;
    }

    var startGen = global.PuPBoxStore.getSessionGen();
    var startUid = global.PuPBoxStore.getActiveUid();
    var startAuth = snapshotAuthForUid(startUid);
    var allowShare = false;

    state.ingestBusy = true;
    if (state.view === 'ingest') renderMain();
    toast(files.length + '개 파일 비식별 추출 및 중복검증을 시작합니다…');

    var collected = [];
    var totalPii = 0;
    var failMsgs = [];

    function finishIngest() {
      if (isSameSession(startGen, startUid)) {
        state.ingestBusy = false;
      }
    }

    function next(idx) {
      if (!isSameSession(startGen, startUid)) {
        return;
      }
      if (idx >= files.length) {
        finishIngest();
        if (!collected.length) {
          toast(failMsgs[0] || '적재 가능한 텍스트가 추출되지 않았습니다. 스캔본 PDF는 OCR 변환 후 등록해 주세요.', 'err');
          if (state.view === 'ingest') renderMain();
          return;
        }
        try {
          var st = global.PuPBoxStore.addDocuments(collected, {
            expectedGen: startGen,
            expectedUid: startUid,
            shareConfirmed: allowShare,
            overrideDeleted: true,
            auth: startAuth,
            onSyncError: function (srvErr) {
              toast('로컬 보관됨 · 사무실 공유 서버 적재 실패: ' + srvErr.message, 'err');
            }
          });
          var merged = st.mergedStage1 + st.mergedStage2 + st.mergedStage3;
          global.PuPBoxStore.addAlert({
            kind: 'ingest',
            title: '판결·결정문 ' + collected.length + '건 처리 완료 (신규 ' + st.added + '건 · 중복병합 ' + merged + '건)',
            detail: '개인정보 자동 비식별 가림 총 ' + totalPii + '건 적용 완료' + (allowShare ? ' · 사무실 공유 요청' : ' · 로컬 전용 보관')
          });
          toast('적재 완료: 신규 ' + st.added + '건 · 중복병합 ' + merged + '건 (개인정보 ' + totalPii + '건 마스킹)');
          renderAll();
          if (collected[0] && state.view === 'home') {
            attachItem({
              id: 'doc:' + collected[0].id,
              kind: 'doc',
              title: collected[0].title,
              caseNo: collected[0].caseNo,
              body: collected[0].body.slice(0, 5000)
            });
          }
        } catch (addErr) {
          if (!addErr || !addErr.staleSession) {
            toast('문서 적재 실패: ' + ((addErr && addErr.message) || addErr), 'err');
          }
        }
        return;
      }

      var f = files[idx];
      var lower = f.name.toLowerCase();
      var pText = lower.endsWith('.pdf') ? extractPdfFileText(f) : f.text();

      pText.then(function (txt) {
        if (!isSameSession(startGen, startUid)) return;
        if (lower.endsWith('.json')) {
          var jRes = global.PuPBoxEngine.ingestJsonDataset(txt, f.name);
          collected = collected.concat(jRes.docs);
          totalPii += jRes.totalMasked;
        } else {
          var one = global.PuPBoxEngine.ingestRawDocument(txt, { fileName: f.name, sourceLabel: '파일 수집 (' + f.name + ')' });
          collected.push(one.doc);
          totalPii += one.anonymization.totalMasked;
        }
      }).catch(function (err) {
        if (!isSameSession(startGen, startUid)) return;
        failMsgs.push(f.name + ': ' + err.message);
        toast(f.name + ' 제외됨: ' + err.message, 'err');
      }).then(function () {
        if (!isSameSession(startGen, startUid)) return;
        next(idx + 1);
      });
    }

    next(0);
  }

  function syncWorkspaceEditorDraftIfPresent() {
    if (!state.activeThread) return;
    var srcTa = document.getElementById('pboxWsSourceTa');
    var titleIn = document.getElementById('pboxWsTitleInput');
    var changed = false;
    if (srcTa && typeof srcTa.value === 'string' && srcTa.value !== (state.activeThread.sourceText || '')) {
      state.activeThread.sourceText = global.PuPBoxEngine.anonymizeText(srcTa.value).text;
      changed = true;
    }
    if (titleIn && typeof titleIn.value === 'string' && titleIn.value.trim() && titleIn.value.trim() !== state.activeThread.title) {
      state.activeThread.title = titleIn.value.trim();
      changed = true;
    }
    if (changed) {
      state.activeThread = global.PuPBoxStore.saveThread(state.activeThread);
      renderSidebarRecents();
    }
  }

  function handleReviewFileOpen(fileList) {
    var files = Array.prototype.slice.call(fileList || []);
    if (!files.length) return;
    if (state.reviewFileBusy || state.aiBusy) {
      toast('이미 문서 처리 또는 검토 생성이 진행 중입니다.', 'err');
      return;
    }
    var file = files[0];
    var lower = String(file.name || '').toLowerCase();
    if (!/\.(?:pdf|txt|md|json)$/i.test(lower)) {
      toast('내용 검토는 PDF, TXT, MD, JSON 문서만 지원합니다. 한글(.hwp)·워드(.docx)는 PDF로 저장 후 열어 주세요.', 'err');
      return;
    }
    if (typeof file.size === 'number' && file.size > 25 * 1024 * 1024) {
      toast('25MB를 초과하는 대용량 파일은 열 수 없습니다. 필요한 계약·규정 부분만 분할해 열어 주세요.', 'err');
      return;
    }
    var startGen = global.PuPBoxStore.getSessionGen();
    var startUid = global.PuPBoxStore.getActiveUid();

    state.reviewFileBusy = true;
    renderMain();

    var pText = lower.endsWith('.pdf') ? extractPdfFileText(file) : file.text();
    pText.then(function (rawTxt) {
      if (!isSameSession(startGen, startUid)) return;
      state.reviewFileBusy = false;
      var trimmed = String(rawTxt || '').trim();
      if (trimmed.length < 10) {
        toast('문서 텍스트가 비어 있거나 너무 짧습니다. 스캔 이미지 PDF는 OCR 변환 후 열어 주세요.', 'err');
        renderMain();
        return;
      }
      var docPartyNames = global.PuPBoxEngine.extractPartyNames(trimmed, String(file.name || ''));
      var cleanBody = global.PuPBoxEngine.anonymizeLegalText(trimmed, docPartyNames).text;
      var cleanFn = global.PuPBoxEngine.anonymizeLegalText(String(file.name || '검토문서'), docPartyNames).text;
      var baseTitle = cleanFn.replace(/\.[a-z0-9]+$/i, '').slice(0, 38) || '문서';
      var reuseId = (state.view === 'workspace' && state.activeThread && state.activeThread.id) ? state.activeThread.id : '';

      runPromptSubmit(
        '열람한 문서(' + cleanFn + ')의 강행법규 위반 여부, 조항별 법적 위험도, 관련 대법원·하급심 판례 및 적법 수정문안을 종합 검토해 주세요.',
        null,
        {
          inWorkspace: true,
          threadId: reuseId,
          mode: 'review',
          sourceText: cleanBody,
          sourceFileName: cleanFn,
          customTitle: baseTitle + ' 내용 검토'
        }
      );
    }).catch(function (err) {
      if (!isSameSession(startGen, startUid)) return;
      state.reviewFileBusy = false;
      toast('문서를 열지 못했습니다: ' + ((err && err.message) || err), 'err');
      renderMain();
    });
  }

  function maybeAutoOfficialCollect(safeQuery) {
    var rawQ = String(safeQuery || '').trim();
    if (rawQ.length < 2 || state.liveCollectBusy) return;
    var E = global.PuPBoxEngine;
    var lawIdx = global.PuPBoxLawIndex && typeof global.PuPBoxLawIndex.list === 'function'
      ? global.PuPBoxLawIndex.list()
      : [];
    var q = (E && typeof E.extractSafeLegalOfficialQuery === 'function')
      ? E.extractSafeLegalOfficialQuery(rawQ, lawIdx)
      : '';
    if (q.length < 2) return;
    if (!(global.location && /^https?:$/i.test(global.location.protocol || ''))) return;
    if (!(state.authUser && state.authUser.uid && typeof state.authUser.getIdToken === 'function')) return;
    if (!global.PuPBoxStore || typeof global.PuPBoxStore.liveSearchAndCollect !== 'function') return;

    var startGen = global.PuPBoxStore.getSessionGen();
    var startUid = global.PuPBoxStore.getActiveUid();
    var cfg = global.PuPBoxStore.getConfig();
    state.liveCollectBusy = true;
    renderSidebarCounts();

    global.PuPBoxStore.liveSearchAndCollect({
      query: q,
      autoOnly: true,
      docType: 'all',
      lawOc: (cfg && cfg.lawOc) || '',
      expectedGen: startGen,
      expectedUid: startUid,
      auth: snapshotAuthForUid(startUid)
    }).then(function (res) {
      if (!isSameSession(startGen, startUid)) return;
      state.liveCollectBusy = false;
      renderSidebarCounts();
      if (res && (res.added > 0 || res.merged > 0)) {
        reverifyActiveThreadIfAny();
        if (state.view === 'workspace' || state.view === 'cases') renderMain();
      }
    }).catch(function () {
      if (!isSameSession(startGen, startUid)) return;
      state.liveCollectBusy = false;
      renderSidebarCounts();
    });
  }

  function runPromptSubmit(customQuery, workflowObj, extraOpts) {
    if (state.aiBusy) return;
    var opts = extraOpts || {};
    var ta = document.getElementById('pboxPromptInput');
    var q = typeof customQuery === 'string' ? customQuery : (ta ? ta.value.trim() : '');
    var srcTxt = typeof opts.sourceText === 'string'
      ? opts.sourceText
      : (opts.inWorkspace && state.activeThread ? (state.activeThread.sourceText || '') : '');
    if (!q && !srcTxt) {
      toast('검토할 내용이나 질문을 입력해 주세요.', 'err');
      return;
    }
    if (!q && srcTxt) {
      q = '입력된 문서의 강행법규 위반 여부와 적법 수정문안을 종합 검토해 주세요.';
    }

    stopVoiceDictation({ abort: true, skipDom: true });
    clearLiveFactTimer();
    if (!opts.inWorkspace) {
      state.homePromptDraft = '';
      state._assistDismissedDraft = '';
    }

    var E = global.PuPBoxEngine;
    var lawIdx = global.PuPBoxLawIndex ? global.PuPBoxLawIndex.list() : [];
    var intentInfo = (E && typeof E.classifyPromptIntent === 'function')
      ? E.classifyPromptIntent(q, lawIdx)
      : null;

    var effMode = opts.mode || (workflowObj ? 'draft' : state.promptMode);
    if (effMode === 'auto' && !workflowObj && !opts.inWorkspace) {
      var shouldReview = Boolean((intentInfo && intentInfo.isFactNarrative) || state.attached.length > 0 || srcTxt);
      effMode = shouldReview ? 'review' : 'search';
    }

    if (effMode === 'search' && !workflowObj && !opts.inWorkspace) {
      clearViewSelections();
      global.PuPBoxStore.saveThread({
        title: '"' + q.slice(0, 28) + '" 검색',
        query: q,
        answer: '',
        mode: 'search',
        engineLabel: '통합검색',
        workflowStyle: 'lbox'
      });
      state.caseQuery = q;
      state.caseDocType = 'all';
      switchView('cases');
      if (intentInfo && intentInfo.safeOfficialQuery) {
        maybeAutoOfficialCollect(intentInfo.safeOfficialQuery);
      }
      return;
    }

    var submitGen = global.PuPBoxStore.getSessionGen ? global.PuPBoxStore.getSessionGen() : 0;
    state.aiBusy = true;
    state.workspaceTab = 'report';
    if (!opts.inWorkspace) {
      state.activeThread = null;
    }
    if (state.view !== 'workspace') {
      clearViewSelections();
      state.view = 'workspace';
      renderSidebarNavState();
    }
    renderMain();

    if (intentInfo && intentInfo.safeOfficialQuery) {
      maybeAutoOfficialCollect(intentInfo.safeOfficialQuery);
    }

    var reqStance = opts.stance || (opts.inWorkspace && state.activeThread && state.activeThread.stance) || state.reviewStance || 'neutral';
    global.PuPBoxStore.askLegalAi({
      query: q,
      mode: effMode,
      stance: reqStance,
      workflow: workflowObj || null,
      attached: state.attached,
      sourceText: srcTxt,
      sourceFileName: opts.sourceFileName || (opts.inWorkspace && state.activeThread ? state.activeThread.sourceFileName : ''),
      customTitle: opts.customTitle || '',
      threadId: opts.threadId || '',
      workflowStyle: 'lbox',
      auth: getAuthObj(),
      manual: opts.manual === true
    }).then(function (res) {
      if (global.PuPBoxStore.getSessionGen && global.PuPBoxStore.getSessionGen() !== submitGen) {
        return;
      }
      state.aiBusy = false;
      state.activeThread = res.thread;
      state.activeSearchRes = res.searchRes;
      renderAll();
    }).catch(function (e) {
      if ((e && e.staleSession) || (global.PuPBoxStore.getSessionGen && global.PuPBoxStore.getSessionGen() !== submitGen)) {
        state.aiBusy = false;
        return;
      }
      state.aiBusy = false;
      toast('생성 중 오류: ' + e.message, 'err');
      renderMain();
    });
  }

  function handleActionElement(btn, ev) {
    var act = btn.getAttribute('data-act');
    if (!act) return;

    if (act === 'go-view') {
      if (state.view === 'workspace') syncWorkspaceEditorDraftIfPresent();
      switchView(btn.getAttribute('data-view') || 'home');
    } else if (act === 'toggle-sidebar-collapse') {
      state.sidebarCollapsed = !state.sidebarCollapsed;
      renderSidebarNavState();
    } else if (act === 'toggle-task-sec') {
      state.taskSecCollapsed = !state.taskSecCollapsed;
      renderSidebarRecents();
    } else if (act === 'toggle-hide-home-proj') {
      state.hideHomeEmptyProjects = !state.hideHomeEmptyProjects;
      renderMain();
    } else if (act === 'start-new-doc') {
      var blankTh = global.PuPBoxStore.saveThread({
        title: '새 문서 · 내용 검토',
        query: '',
        answer: '',
        mode: 'review',
        stance: state.reviewStance || 'neutral',
        sourceText: '',
        workflowStyle: 'lbox'
      });
      state.activeThread = blankTh;
      state.deadlineBaseDate = '';
      state.workspaceTab = 'editor';
      switchView('workspace');
    } else if (act === 'open-review-file') {
      var rf = document.getElementById('pboxReviewFileInput');
      if (rf && (!ev || ev.target !== rf)) rf.click();
    } else if (act === 'set-ws-tab') {
      syncWorkspaceEditorDraftIfPresent();
      state.workspaceTab = btn.getAttribute('data-tab') || 'report';
      renderMain();
    } else if (act === 'set-ws-auth-tab') {
      syncWorkspaceEditorDraftIfPresent();
      state.wsAuthTab = btn.getAttribute('data-tab') || 'all';
      renderMain();
    } else if (act === 'set-ws-stance') {
      syncWorkspaceEditorDraftIfPresent();
      var nextStance = btn.getAttribute('data-stance') || 'neutral';
      state.reviewStance = nextStance;
      if (state.activeThread) {
        state.activeThread.stance = nextStance;
        state.activeThread = global.PuPBoxStore.saveThread(state.activeThread);
      }
      var stanceNm = nextStance === 'worker' ? '근로자·신청인측' : (nextStance === 'employer' ? '사용자·회사측' : '객관·중립');
      toast('검토·기안 관점이 [' + stanceNm + '] 기준으로 설정되었습니다.');
      renderMain();
    } else if (act === 'copy-redline-md') {
      if (!state.activeThread) return;
      var rlRes = global.PuPBoxEngine.buildClauseRedlineTable(state.activeThread.sourceText || state.activeThread.query || '');
      copyTextSafe(rlRes.markdown, '신·구 조항 대비표(Redline)가 클립보드에 복사되었습니다.');
    } else if (act === 'apply-all-clause-fixes') {
      if (!state.activeThread) return;
      var allDiag = global.PuPBoxEngine.analyzeDocumentClauses(state.activeThread.sourceText || state.activeThread.query || '');
      if (!allDiag.findings.length) return;
      var curSrc = state.activeThread.sourceText || state.activeThread.query || '';
      var appendedFixes = allDiag.findings.map(function (f) {
        return '[' + f.clauseLabel + ' 적법 수정안 — ' + f.title + ']\n' + f.suggestion;
      }).join('\n\n');
      state.activeThread.sourceText = (curSrc ? (curSrc + '\n\n') : '') + '═══ [적법 수정 권고문안 일괄 반영] ═══\n\n' + appendedFixes;
      state.activeThread = global.PuPBoxStore.saveThread(state.activeThread);
      state.workspaceTab = 'editor';
      toast('탐지된 ' + allDiag.findings.length + '개 위험조항의 권고 수정문안을 일괄 반영했습니다.');
      renderMain();
    } else if (act === 'use-detected-base-date') {
      var detDate = btn.getAttribute('data-date') || '';
      if (detDate) {
        state.deadlineBaseDate = detDate;
        renderMain();
        toast('기산 기준일을 ' + detDate + '(으)로 적용했습니다.');
      }
    } else if (act === 'copy-deadlines-md') {
      var thDl = state.activeThread;
      var tlForDl = global.PuPBoxEngine.extractFactTimeline(thDl ? ((thDl.sourceText || '') + '\n' + (thDl.query || '')) : '');
      var baseForDl = state.deadlineBaseDate || tlForDl.suggestedBaseDate || global.PuPBoxEngine.todayKstYmd();
      var dlRes = global.PuPBoxEngine.calculateLaborDeadlines(baseForDl, global.PuPBoxEngine.todayKstYmd());
      copyTextSafe(dlRes.markdown, '노동사건 법정 기한 산정표가 클립보드에 복사되었습니다.');
    } else if (act === 'copy-timeline-md') {
      if (!state.activeThread) return;
      var tlRes = global.PuPBoxEngine.extractFactTimeline((state.activeThread.sourceText || '') + '\n' + (state.activeThread.query || ''));
      copyTextSafe(tlRes.markdown, '사실관계 일자별 연표가 클립보드에 복사되었습니다.');
    } else if (act === 'insert-timeline-editor') {
      if (!state.activeThread) return;
      var tlIns = global.PuPBoxEngine.extractFactTimeline((state.activeThread.sourceText || '') + '\n' + (state.activeThread.query || ''));
      if (!tlIns.markdown) return;
      var origSrc = state.activeThread.sourceText || '';
      state.activeThread.sourceText = (origSrc ? (origSrc + '\n\n') : '') + '[기초사실 일자별 연표]\n' + tlIns.markdown;
      state.activeThread = global.PuPBoxStore.saveThread(state.activeThread);
      state.workspaceTab = 'editor';
      toast('사실관계 일자별 연표를 원문 편집창에 추가했습니다.');
      renderMain();
    } else if (act === 'load-ws-sample') {
      var sKey = btn.getAttribute('data-sample') || 'freelancer';
      var sampleBody = SAMPLE_REVIEW_DOCS[sKey] || SAMPLE_REVIEW_DOCS.freelancer;
      var sampleTitles = {
        freelancer: '용역계약서 내용 검토',
        blanket_wage: '포괄임금 근로계약서 내용 검토',
        work_rules: '취업규칙 개정안 내용 검토'
      };
      if (!state.activeThread) {
        state.activeThread = global.PuPBoxStore.saveThread({
          title: sampleTitles[sKey] || '샘플 문서 내용 검토',
          mode: 'review',
          sourceText: sampleBody,
          workflowStyle: 'lbox'
        });
      } else {
        state.activeThread.sourceText = sampleBody;
        if (!state.activeThread.title || state.activeThread.title === '새 문서 · 내용 검토') {
          state.activeThread.title = sampleTitles[sKey] || '샘플 문서 내용 검토';
        }
        state.activeThread = global.PuPBoxStore.saveThread(state.activeThread);
      }
      var sDiag = global.PuPBoxEngine.analyzeDocumentClauses(sampleBody);
      toast('샘플 문서 적재 완료 · 위험조항 ' + sDiag.findings.length + '건이 감지되었습니다.');
      renderAll();
    } else if (act === 'save-ws-meta') {
      if (!state.activeThread) return;
      var tIn = document.getElementById('pboxWsTitleInput');
      if (tIn && tIn.value.trim()) {
        state.activeThread.title = tIn.value.trim();
        state.activeThread = global.PuPBoxStore.saveThread(state.activeThread);
        renderSidebarRecents();
        toast('작업 제목이 저장되었습니다.');
      }
    } else if (act === 'save-ws-source') {
      if (!state.activeThread) return;
      syncWorkspaceEditorDraftIfPresent();
      var dRes = global.PuPBoxEngine.analyzeDocumentClauses(state.activeThread.sourceText || '');
      state.workspaceTab = 'clauses';
      toast('원문 비식별 저장 완료 · 조항별 위험진단 ' + dRes.findings.length + '건 갱신됨');
      renderMain();
    } else if (act === 'apply-clause-fix') {
      if (!state.activeThread) return;
      var fIdx = Number(btn.getAttribute('data-idx'));
      var curDiag = global.PuPBoxEngine.analyzeDocumentClauses(state.activeThread.sourceText || state.activeThread.query || '');
      var finding = curDiag.findings[fIdx];
      if (finding) {
        var baseTxt = state.activeThread.sourceText || state.activeThread.query || '';
        state.activeThread.sourceText = (baseTxt ? (baseTxt + '\n\n') : '') +
          '[' + finding.clauseLabel + ' 적법 수정안]\n' + finding.suggestion;
        state.activeThread = global.PuPBoxStore.saveThread(state.activeThread);
        state.workspaceTab = 'editor';
        toast(finding.clauseLabel + ' 권고 수정문안을 원문 편집창에 반영했습니다.');
        renderMain();
      }
    } else if (act === 'run-ws-quick-review') {
      syncWorkspaceEditorDraftIfPresent();
      var quickQ = btn.getAttribute('data-q') || '입력된 문서의 강행법규 위반 여부와 적법 수정문안을 검토해 주세요.';
      var curTh = state.activeThread;
      var nonDefaultTitle = (curTh && curTh.title && curTh.title !== '새 문서 · 내용 검토' && curTh.title !== '새 문서 검토') ? curTh.title : '';
      runPromptSubmit(quickQ, null, {
        inWorkspace: true,
        threadId: curTh ? curTh.id : '',
        mode: (curTh && curTh.mode === 'draft') ? 'draft' : 'review',
        sourceText: curTh ? (curTh.sourceText || '') : '',
        sourceFileName: curTh ? (curTh.sourceFileName || '') : '',
        customTitle: nonDefaultTitle
      });
    } else if (act === 'submit-ws-followup') {
      syncWorkspaceEditorDraftIfPresent();
      var fIn = document.getElementById('pboxWsFollowInput');
      var fq = fIn ? fIn.value.trim() : '';
      if (!fq) {
        toast('추가 검토 지시나 수정 요청을 입력해 주세요.', 'err');
        return;
      }
      var curTh2 = state.activeThread;
      var nonDefaultTitle2 = (curTh2 && curTh2.title && curTh2.title !== '새 문서 · 내용 검토' && curTh2.title !== '새 문서 검토') ? curTh2.title : '';
      runPromptSubmit(fq, null, {
        inWorkspace: true,
        threadId: curTh2 ? curTh2.id : '',
        mode: (curTh2 && curTh2.mode) ? curTh2.mode : 'review',
        sourceText: curTh2 ? (curTh2.sourceText || '') : '',
        sourceFileName: curTh2 ? (curTh2.sourceFileName || '') : '',
        customTitle: nonDefaultTitle2
      });
    } else if (act === 'toggle-theme') {
      applyTheme(state.theme === 'dark' ? 'light' : 'dark');
      toast(state.theme === 'dark' ? '어두운 테마로 전환했습니다.' : '밝은 테마로 전환했습니다.');
    } else if (act === 'open-mobile-nav') {
      openMobileSidebar();
    } else if (act === 'close-mobile-nav') {
      closeMobileSidebar();
    } else if (act === 'set-mode') {
      var modeTa = document.getElementById('pboxPromptInput');
      if (modeTa && typeof modeTa.value === 'string') state.homePromptDraft = modeTa.value;
      state.promptMode = btn.getAttribute('data-mode') || 'auto';
      renderMain();
    } else if (act === 'toggle-voice-input') {
      startVoiceDictation(btn.getAttribute('data-voice-target') || 'home');
    } else if (act === 'finish-voice-review') {
      finishVoiceAndAutoReview();
    } else if (act === 'keep-voice-text') {
      keepVoiceTextAndClose();
    } else if (act === 'clear-voice-text') {
      clearVoiceText();
    } else if (act === 'cancel-voice-input') {
      cancelVoiceInput();
    } else if (act === 'apply-voice-organized') {
      applyOrganizedVoiceToInput();
    } else if (act === 'retry-voice-input') {
      if (typeof state._voiceRestartFn === 'function') {
        state._voiceStallRetries = 0;
        state._voiceNonContinuous = false;
        state.voicePhase = 'connecting';
        syncVoiceUiDom();
        state._voiceRestartFn(true, false);
      } else {
        startVoiceDictation(state.voiceTarget || 'home');
      }
    } else if (act === 'use-win-voice-input') {
      switchToWindowsVoiceInput();
    } else if (act === 'run-home-review') {
      var rhrQ = btn.getAttribute('data-q') || '';
      if (rhrQ) {
        state.homePromptDraft = '';
        runPromptSubmit(rhrQ, null, { mode: 'review' });
      }
    } else if (act === 'toggle-home-assist') {
      var curTa = document.getElementById('pboxPromptInput');
      if (curTa && typeof curTa.value === 'string') state.homePromptDraft = curTa.value;
      state.hideHomeAssist = !state.hideHomeAssist;
      state._assistDismissedDraft = '';
      try { localStorage.setItem(ASSIST_HIDE_LS_KEY, state.hideHomeAssist ? '1' : '0'); } catch (_) {}
      var restoreBtn = document.getElementById('pboxRestoreAssistBtn');
      if (restoreBtn && restoreBtn.style) restoreBtn.style.display = state.hideHomeAssist ? '' : 'none';
      updateLiveFactReviewDom(state.homePromptDraft || '');
      if (curTa && typeof curTa.focus === 'function') curTa.focus();
      toast(state.hideHomeAssist ? '입력 중 자동제안을 숨겼습니다. 입력창 하단에서 언제든 다시 켤 수 있습니다.' : '스마트 자동제안이 켜졌습니다.');
    } else if (act === 'home-scope-jump') {
      var scope = btn.getAttribute('data-scope') || 'all';
      var scopeTa = document.getElementById('pboxPromptInput');
      var draftQ = String((scopeTa && scopeTa.value) || state.homePromptDraft || '').trim();
      if (scope === 'laws') {
        state.lawQuery = draftQ;
        state.lawCat = 'all';
        state.lawPageLimit = 80;
        switchView('laws');
      } else if (scope === 'sites') {
        if (draftQ) {
          var sqRes = sanitizeExternalSearchQuery(draftQ);
          if (!sqRes.ok) {
            state.siteSearchQuery = '';
            toast(sqRes.error, 'err');
          } else {
            state.siteSearchQuery = sqRes.query;
          }
        } else {
          state.siteSearchQuery = '';
        }
        switchView('sites');
      } else if (scope === 'kcplaa' || scope === 'prec_group' || scope === 'dec_nlrc' || scope === 'interp_group') {
        state.caseQuery = draftQ;
        state.caseDocType = scope;
        state.caseSubQuery = '';
        switchView('cases');
      } else {
        if (draftQ) {
          state.caseQuery = draftQ;
          state.caseDocType = 'all';
          state.caseSubQuery = '';
          switchView('cases');
        } else if (scopeTa && typeof scopeTa.focus === 'function') {
          scopeTa.focus();
        }
      }
    } else if (act === 'run-top-quick-search') {
      var topIn = document.getElementById('pboxTopQuickInput');
      var topQ = topIn ? String(topIn.value || '').trim() : '';
      if (!topQ) {
        if (topIn && typeof topIn.focus === 'function') topIn.focus();
        toast('검색어를 입력해 주세요.');
        return;
      }
      state.caseQuery = topQ;
      state.caseDocType = 'all';
      state.caseSubQuery = '';
      if (topIn) topIn.value = '';
      switchView('cases');
    } else if (act === 'jump-cases-query') {
      state.caseQuery = btn.getAttribute('data-q') || '';
      state.caseDocType = 'all';
      state.caseSubQuery = '';
      switchView('cases');
    } else if (act === 'jump-laws-query') {
      state.lawQuery = btn.getAttribute('data-q') || '';
      state.lawCat = 'all';
      state.lawPageLimit = 80;
      switchView('laws');
    } else if (act === 'jump-laws-cat') {
      state.lawCat = btn.getAttribute('data-cat') || 'priority';
      state.lawQuery = btn.getAttribute('data-q') || '';
      state.lawPageLimit = 80;
      switchView('laws');
    } else if (act === 'live-collect-unified') {
      triggerLiveCaseCollection(btn.getAttribute('data-q') || '');
    } else if (act === 'use-sample') {
      var sq = btn.getAttribute('data-q') || '';
      var ta = document.getElementById('pboxPromptInput');
      if (ta) ta.value = sq;
      runPromptSubmit(sq, null);
    } else if (act === 'submit-prompt') {
      runPromptSubmit();
    } else if (act === 'rm-att') {
      var rmTa = document.getElementById('pboxPromptInput');
      if (rmTa && typeof rmTa.value === 'string') state.homePromptDraft = rmTa.value;
      var idx = Number(btn.getAttribute('data-idx'));
      state.attached.splice(idx, 1);
      renderMain();
    } else if (act === 'trigger-quick-file') {
      var qf = document.getElementById('pboxQuickFileInput');
      if (qf) qf.click();
    } else if (act === 'pick-ingest-files') {
      var inf = document.getElementById('pboxIngestFileInput');
      if (inf && (!ev || ev.target !== inf)) inf.click();
    } else if (act === 'open-law') {
      openLawInReader(btn.getAttribute('data-dir'), btn.getAttribute('data-file') || '', btn.getAttribute('data-art') || '');
    } else if (act === 'open-law-3dan') {
      openLaw3DanInReader(btn.getAttribute('data-dir'));
    } else if (act === 'open-law-history') {
      openLawInReader(btn.getAttribute('data-dir'), btn.getAttribute('data-file') || '', '', { openHistory: true });
    } else if (act === 'toggle-law-history') {
      state.readerHistoryOpen = !state.readerHistoryOpen;
      if (state.readerHistoryOpen && (!state.readerHistoryList || !state.readerHistoryList.length)) {
        loadLawHistoryForCurrent();
      } else {
        renderReader();
      }
    } else if (act === 'return-current-law') {
      if (state.readerLaw && state.readerLaw.dir) {
        openLawInReader(state.readerLaw.dir, state.readerLaw.fileName, state.readerHighlightArt, { openHistory: true });
      }
    } else if (act === 'open-law-date-official') {
      var liHist = document.getElementById('pboxLawSearchInput');
      var dtHist = document.getElementById('pboxLawHistDate');
      var qLaw = (liHist ? liHist.value : state.lawQuery || '').trim();
      var dtVal = (dtHist ? dtHist.value : state.lawHistoryLookupDate || '').trim();
      state.lawHistoryLookupDate = dtVal;
      var targetLawName = '';
      if (qLaw && global.PuPBoxEngine && typeof global.PuPBoxEngine.resolveSmartLawJump === 'function') {
        var sj = global.PuPBoxEngine.resolveSmartLawJump(qLaw, global.PuPBoxLawIndex ? global.PuPBoxLawIndex.list() : []);
        if (sj && sj.lawTitle) targetLawName = sj.lawTitle;
      }
      if (!targetLawName && qLaw) {
        var sanHist = sanitizeExternalSearchQuery(qLaw);
        if (!sanHist.ok) {
          toast(sanHist.error, 'err');
          return;
        }
        targetLawName = sanHist.query;
      }
      var histUrl = buildOfficialHistoricalLawUrl(targetLawName, dtVal);
      if (typeof global.open === 'function') global.open(histUrl, '_blank', 'noopener,noreferrer');
    } else if (act === 'open-law-repeal-official') {
      var liRep = document.getElementById('pboxLawSearchInput');
      var qRep = (liRep ? liRep.value : state.lawQuery || '').trim();
      var safeRepName = '';
      if (qRep && global.PuPBoxEngine && typeof global.PuPBoxEngine.resolveSmartLawJump === 'function') {
        var sjRep = global.PuPBoxEngine.resolveSmartLawJump(qRep, global.PuPBoxLawIndex ? global.PuPBoxLawIndex.list() : []);
        if (sjRep && sjRep.lawTitle) safeRepName = sjRep.lawTitle;
      }
      if (!safeRepName && qRep) {
        var sanRep = sanitizeExternalSearchQuery(qRep);
        if (!sanRep.ok) {
          toast(sanRep.error, 'err');
          return;
        }
        safeRepName = sanRep.query;
      }
      var repUrl = buildOfficialHistoricalLawUrl(safeRepName, '');
      if (typeof global.open === 'function') global.open(repUrl, '_blank', 'noopener,noreferrer');
    } else if (act === 'open-doc') {
      openDocInReader(btn.getAttribute('data-id'));
    } else if (act === 'close-reader') {
      closeReader();
    } else if (act === 'attach-law') {
      attachLawByDir(btn.getAttribute('data-dir'), btn.getAttribute('data-file') || '');
    } else if (act === 'attach-doc') {
      var d = global.PuPBoxStore.getDocById(btn.getAttribute('data-id'));
      if (d) attachItem({ id: 'doc:' + d.id, kind: 'doc', title: d.title, caseNo: d.caseNo, body: d.body });
    } else if (act === 'open-attach-modal') {
      showAttachModal('', false);
    } else if (act === 'modal-attach-law') {
      attachLawByDir(btn.getAttribute('data-dir'), btn.getAttribute('data-file') || '');
      closeModal();
    } else if (act === 'modal-attach-doc') {
      var md = global.PuPBoxStore.getDocById(btn.getAttribute('data-id'));
      if (md) attachItem({ id: 'doc:' + md.id, kind: 'doc', title: md.title, caseNo: md.caseNo, body: md.body });
      closeModal();
    } else if (act === 'close-modal') {
      closeModal();
    } else if (act === 'sync-core-pack') {
      if (state.syncBusy) return;
      state.syncBusy = true;
      toast('노동·공무원·군인·연결 핵심 법령 40편(시행령·시행규칙·별표 포함) 전문을 내려받습니다…');
      renderAll();
      global.PuPBoxStore.syncCoreLaborLaws(function (p) {
        state.syncProgressText = '법령 보관 ' + p.done + '/' + p.total;
        renderSidebarCounts();
      }).then(function (r) {
        state.syncBusy = false;
        state.syncProgressText = '';
        if (r && r.ok === false) {
          toast('법령 보관 중 오류 발생 (' + (r.succeeded || 0) + '/' + r.total + '편 성공)', 'err');
        } else {
          toast('핵심 법령 ' + r.loaded + '편 오프라인 전문 보관 완료!');
        }
        renderAll();
      });
    } else if (act === 'quick-sync') {
      if (state.syncBusy) return;
      state.syncBusy = true;
      state.syncProgressText = '변경분 확인 중…';
      renderAll();
      global.PuPBoxStore.runIncrementalSync({ callServer: true, auth: getAuthObj() }).then(function (r) {
        state.syncBusy = false;
        state.syncProgressText = '';
        if (r && r.ok === false) {
          toast('동기화 일부 또는 전체 실패: ' + ((r.errors && r.errors[0]) || '네트워크·서버 연결을 확인해 주세요.'), 'err');
        } else {
          toast(r.treeChanged
            ? ('개정 법령 감지! ' + r.refreshedLaws + '편 자동 갱신 완료')
            : '점검 완료: 현재 최신 법령·판례 상태입니다.');
        }
        renderAll();
      });
    } else if (act === 'set-law-cat') {
      state.lawCat = btn.getAttribute('data-cat') || 'all';
      state.lawPageLimit = 80;
      renderMain();
    } else if (act === 'run-law-filter') {
      var li = document.getElementById('pboxLawSearchInput');
      if (li) state.lawQuery = li.value;
      state.lawPageLimit = 80;
      renderMain();
    } else if (act === 'more-laws') {
      state.lawPageLimit += 120;
      renderMain();
    } else if (act === 'toggle-law-chk') {
      var dir = btn.getAttribute('data-dir');
      if (btn.checked) state.selectedLawDirs.add(dir);
      else state.selectedLawDirs.delete(dir);
      renderMain();
    } else if (act === 'toggle-all-laws') {
      var vis = getFilteredLawFamilies().slice(0, state.lawPageLimit);
      if (btn.checked) vis.forEach(function (f) { state.selectedLawDirs.add(f.dir); });
      else state.selectedLawDirs.clear();
      renderMain();
    } else if (act === 'clear-law-sel') {
      state.selectedLawDirs.clear();
      renderMain();
    } else if (act === 'bulk-cache-laws') {
      var dirs = Array.from(state.selectedLawDirs);
      Promise.all(dirs.map(function (dName) { return global.PuPBoxStore.fetchLaw(dName); })).then(function () {
        toast(dirs.length + '개 법령 오프라인 보관 완료');
        renderAll();
      });
    } else if (act === 'bulk-attach-laws') {
      Array.from(state.selectedLawDirs).slice(0, 6).forEach(function (dName) { attachLawByDir(dName); });
    } else if (act === 'bulk-proj-laws') {
      var lawDirsToAdd = Array.from(state.selectedLawDirs);
      ensureProjectThen(function (projId) {
        global.PuPBoxStore.addItemsToProject(projId, [], lawDirsToAdd);
        var idxAll = (global.PuPBoxLawIndex && typeof global.PuPBoxLawIndex.list === 'function')
          ? global.PuPBoxLawIndex.list()
          : [];
        lawDirsToAdd.forEach(function (dName) {
          var famObj = idxAll.find(function (f) { return f.dir === dName; }) || null;
          var filesToFetch = (famObj && Array.isArray(famObj.files) && famObj.files.length)
            ? famObj.files.filter(function (fn) { return !(famObj.hasRepealStub && fn === '법률'); }).slice(0, 5)
            : [''];
          filesToFetch.forEach(function (fn) {
            try { global.PuPBoxStore.fetchLaw(dName, fn ? (fn + '.md') : '').catch(function () {}); } catch (_) {}
          });
        });
        state.selectedLawDirs.clear();
        toast('선택한 법령을 프로젝트에 담았습니다.');
        renderAll();
      });
    } else if (act === 'set-case-type') {
      var ciType = document.getElementById('pboxCaseSearchInput');
      var subTypeIn = document.getElementById('pboxCaseSubInput');
      if (ciType) state.caseQuery = ciType.value;
      if (subTypeIn) state.caseSubQuery = subTypeIn.value;
      state.caseDocType = btn.getAttribute('data-dtype') || 'all';
      if (state.caseDocType !== 'dec_nlrc') state.caseTribunalOrg = 'all';
      renderMain();
    } else if (act === 'set-tribunal-org') {
      var ciOrg = document.getElementById('pboxCaseSearchInput');
      var subOrgIn = document.getElementById('pboxCaseSubInput');
      if (ciOrg) state.caseQuery = ciOrg.value;
      if (subOrgIn) state.caseSubQuery = subOrgIn.value;
      state.caseTribunalOrg = btn.getAttribute('data-org') || 'all';
      renderMain();
    } else if (act === 'run-case-filter') {
      var ci = document.getElementById('pboxCaseSearchInput');
      var subIn = document.getElementById('pboxCaseSubInput');
      if (ci) state.caseQuery = ci.value;
      if (subIn) state.caseSubQuery = subIn.value;
      renderMain();
    } else if (act === 'reset-case-filters') {
      state.caseQuery = '';
      state.caseSubQuery = '';
      state.caseDateRange = 'all';
      state.caseSortBy = 'relevance';
      state.caseOutcomeFilter = 'all';
      state.liveCollectBanner = null;
      renderMain();
    } else if (act === 'open-compare-modal') {
      showCompareDocsModal();
    } else if (act === 'open-doc-from-modal') {
      closeModal();
      openDocInReader(btn.getAttribute('data-id'));
    } else if (act === 'copy-compare-md') {
      var cmpDocs = Array.from(state.selectedDocIds).map(function (id) { return global.PuPBoxStore.getDocById(id); }).filter(Boolean);
      var cmpMat = global.PuPBoxEngine.buildAuthorityComparisonMatrix(cmpDocs, { query: state.caseQuery });
      copyTextSafe(cmpMat.markdown, '선택 자료 비교표(마크다운)가 클립보드에 복사되었습니다.');
    } else if (act === 'compare-to-ai-review') {
      var cmpDocsForAi = Array.from(state.selectedDocIds).slice(0, 6).map(function (id) { return global.PuPBoxStore.getDocById(id); }).filter(Boolean);
      if (!cmpDocsForAi.length) return;
      closeModal();
      cmpDocsForAi.forEach(function (doc) {
        attachItem({ id: 'doc:' + doc.id, kind: 'doc', title: doc.title, caseNo: doc.caseNo, body: doc.body });
      });
      var cmpQuery = (state.caseQuery ? ('"' + state.caseQuery + '" 쟁점과 관련하여 ') : '') +
        '첨부된 ' + cmpDocsForAi.length + '건의 판례·재결·행정해석 결론과 핵심 판단기준 차이점을 비교 분석해 주세요.';
      runPromptSubmit(cmpQuery, null, { mode: 'review' });
    } else if (act === 'copy-doc-citation') {
      var citeDoc = global.PuPBoxStore.getDocById(btn.getAttribute('data-id'));
      if (citeDoc && global.PuPBoxEngine && typeof global.PuPBoxEngine.formatStandardLegalCitation === 'function') {
        var stdCite = global.PuPBoxEngine.formatStandardLegalCitation(citeDoc, { withSummary: false });
        copyTextSafe(stdCite, '표준 인용문구 복사 완료: ' + stdCite);
      }
    } else if (act === 'set-issue-cat') {
      state.activeIssueCat = btn.getAttribute('data-cat') || 'dismissal';
      renderMain();
    } else if (act === 'pick-issue-chip') {
      state.caseQuery = btn.getAttribute('data-q') || '';
      state.caseSubQuery = '';
      renderMain();
    } else if (act === 'live-collect-cases') {
      var ciLive = document.getElementById('pboxCaseSearchInput');
      var subLive = document.getElementById('pboxCaseSubInput');
      if (ciLive) state.caseQuery = ciLive.value;
      if (subLive) state.caseSubQuery = subLive.value;
      triggerLiveCaseCollection(state.caseQuery);
    } else if (act === 'auto-discover-cases') {
      var ciDisc = document.getElementById('pboxCaseSearchInput');
      var subDisc = document.getElementById('pboxCaseSubInput');
      if (ciDisc) state.caseQuery = ciDisc.value;
      if (subDisc) state.caseSubQuery = subDisc.value;
      triggerAutoDiscoverCollection(state.caseQuery);
    } else if (act === 'set-site-cat') {
      var sInCat = document.getElementById('pboxSiteSearchInput');
      if (sInCat) {
        var catCheck = sanitizeExternalSearchQuery(sInCat.value);
        if (catCheck.ok) state.siteSearchQuery = catCheck.query;
      }
      state.siteCat = btn.getAttribute('data-cat') || 'all';
      renderMain();
    } else if (act === 'run-site-search') {
      var sIn = document.getElementById('pboxSiteSearchInput');
      var rawSq = sIn ? sIn.value.trim() : '';
      var sqCheck = sanitizeExternalSearchQuery(rawSq);
      if (!sqCheck.ok) {
        toast(sqCheck.error, 'err');
        return;
      }
      state.siteSearchQuery = sqCheck.query;
      renderMain();
      toast(state.siteSearchQuery
        ? ('전국 사이트 공통 검색어가 "' + state.siteSearchQuery + '"(으)로 적용되었습니다.')
        : '사이트 기본 열람 모드로 전환되었습니다.');
    } else if (act === 'site-to-live-collect') {
      var sIn2 = document.getElementById('pboxSiteSearchInput');
      var rawNextQ = sIn2 ? sIn2.value.trim() : getEffectiveSiteQuery();
      var nextCheck = sanitizeExternalSearchQuery(rawNextQ);
      if (!nextCheck.ok) {
        toast(nextCheck.error, 'err');
        return;
      }
      var nextQ = nextCheck.query;
      state.siteSearchQuery = nextQ;
      state.caseQuery = nextQ;
      switchView('cases');
      triggerLiveCaseCollection(nextQ);
    } else if (act === 'site-to-auto-discover') {
      var sIn3 = document.getElementById('pboxSiteSearchInput');
      var rawDiscQ = sIn3 ? sIn3.value.trim() : getEffectiveSiteQuery();
      var discCheck = sanitizeExternalSearchQuery(rawDiscQ);
      if (!discCheck.ok) {
        toast(discCheck.error, 'err');
        return;
      }
      var targetQ = discCheck.query;
      state.siteSearchQuery = targetQ;
      if (targetQ) state.caseQuery = targetQ;
      switchView('cases');
      if (targetQ && targetQ.length >= 2) {
        triggerAutoDiscoverCollection(targetQ);
      } else {
        var cInpSite = document.getElementById('pboxCaseSearchInput');
        if (cInpSite && typeof cInpSite.focus === 'function') cInpSite.focus();
        toast('자동탐색할 쟁점어·약칭 또는 사건번호를 2글자 이상 입력해 주세요.', 'err');
      }
    } else if (act === 'open-ext-site' || act === 'open-ext-google') {
      var siteId = btn.getAttribute('data-site-id') || '';
      var qSrc = btn.getAttribute('data-q-src') || 'site';
      var liveInput = qSrc === 'case'
        ? document.getElementById('pboxCaseSearchInput')
        : (qSrc === 'law' ? document.getElementById('pboxLawSearchInput') : document.getElementById('pboxSiteSearchInput'));
      var rawExtQ = (liveInput && typeof liveInput.value === 'string')
        ? liveInput.value.trim()
        : getEffectiveSiteQuery();
      var extCheck = sanitizeExternalSearchQuery(rawExtQ);
      if (!extCheck.ok) {
        toast(extCheck.error, 'err');
        return;
      }
      var extQ = extCheck.query;
      if (qSrc === 'site') state.siteSearchQuery = extQ;
      var siteList = global.PuPBoxCorpus.KOREA_LEGAL_SITES || [];
      var targetSite = siteList.find(function (x) { return x.id === siteId; });
      if (targetSite) {
        var targetUrl = act === 'open-ext-google'
          ? global.PuPBoxCorpus.buildSiteGoogleUrl(targetSite, extQ)
          : global.PuPBoxCorpus.buildSiteSearchUrl(targetSite, extQ);
        openSafeExternalUrl(targetUrl);
      }
    } else if (act === 'open-site-bundle') {
      var bIn = document.getElementById('pboxSiteSearchInput');
      var rawBQ = (bIn && typeof bIn.value === 'string') ? bIn.value.trim() : getEffectiveSiteQuery();
      var bCheck = sanitizeExternalSearchQuery(rawBQ);
      if (!bCheck.ok) {
        toast(bCheck.error, 'err');
        return;
      }
      var bQ = bCheck.query;
      state.siteSearchQuery = bQ;
      var bId = btn.getAttribute('data-bundle') || '';
      var bundlesAll = global.PuPBoxCorpus.SITE_BUNDLE_PRESETS || [];
      var bundle = bundlesAll.find(function (b) { return b.id === bId; });
      var allSitesRef = global.PuPBoxCorpus.KOREA_LEGAL_SITES || [];
      if (bundle && Array.isArray(bundle.siteIds)) {
        var openedCnt = 0;
        bundle.siteIds.forEach(function (sid) {
          var stObj = allSitesRef.find(function (s) { return s.id === sid; });
          if (stObj && openSafeExternalUrl(global.PuPBoxCorpus.buildSiteSearchUrl(stObj, bQ))) {
            openedCnt++;
          }
        });
        toast(openedCnt + '개 핵심 법률 사이트 새 탭 열기를 요청했습니다. (하나만 열리면 주소창 우측 팝업 차단을 허용해 주세요)');
      }
    } else if (act === 'toggle-doc-chk') {
      var did = btn.getAttribute('data-id');
      if (btn.checked) state.selectedDocIds.add(did);
      else state.selectedDocIds.delete(did);
      renderMain();
    } else if (act === 'toggle-all-docs') {
      var curDocs = getFilteredCasesResult().docs;
      if (btn.checked) curDocs.forEach(function (docItem) { state.selectedDocIds.add(docItem.id); });
      else state.selectedDocIds.clear();
      renderMain();
    } else if (act === 'clear-doc-sel') {
      state.selectedDocIds.clear();
      renderMain();
    } else if (act === 'bulk-attach-docs') {
      Array.from(state.selectedDocIds).slice(0, 6).forEach(function (id) {
        var doc = global.PuPBoxStore.getDocById(id);
        if (doc) attachItem({ id: 'doc:' + doc.id, kind: 'doc', title: doc.title, caseNo: doc.caseNo, body: doc.body });
      });
    } else if (act === 'bulk-proj-docs') {
      ensureProjectThen(function (projId) {
        global.PuPBoxStore.addItemsToProject(projId, Array.from(state.selectedDocIds), []);
        state.selectedDocIds.clear();
        toast('선택한 판례·유권해석을 프로젝트에 담았습니다.');
        renderAll();
      });
    } else if (act === 'bulk-export-docs') {
      var lines = Array.from(state.selectedDocIds).map(function (id) {
        var doc = global.PuPBoxStore.getDocById(id);
        return doc ? ('## ' + doc.title + ' (' + doc.caseNo + ')\n\n' + doc.body + '\n') : '';
      }).filter(Boolean);
      downloadBlob('pbox-selected-cases.md', lines.join('\n---\n\n'), 'text/markdown;charset=utf-8');
    } else if (act === 'bulk-del-docs') {
      var idsToDel = Array.from(state.selectedDocIds);
      if (!idsToDel.length) return;
      if (typeof global.confirm === 'function' && !global.confirm('선택한 문서 ' + idsToDel.length + '건을 삭제하시겠습니까? (기본 검증 판례는 자동 보호되며, 삭제된 수집 문서는 동기화 시 다시 나타나지 않습니다)')) {
        return;
      }
      var removed = global.PuPBoxStore.deleteDocuments(idsToDel, {
        auth: snapshotAuthForUid(global.PuPBoxStore.getActiveUid()),
        onSyncError: function (delErr) {
          toast('로컬 삭제됨 · 공유 서버 삭제 반영 실패: ' + delErr.message, 'err');
        }
      });
      state.selectedDocIds.clear();
      toast(removed > 0 ? ('수집 문서 ' + removed + '건을 삭제했습니다.') : '기본 검증 코퍼스는 보호되어 삭제되지 않습니다.');
      renderAll();
    } else if (act === 'pull-lower-court') {
      if (state.lowerPullBusy) return;
      var courtSel = document.getElementById('pboxLowerCourtSel');
      var presetSel = document.getElementById('pboxLowerPresetSel');
      var qInp = document.getElementById('pboxLowerQueryInput');
      var ocInp = document.getElementById('pboxLowerLawOcInput');
      if (courtSel) state.lowerCourtFilter = courtSel.value;
      if (presetSel) state.lowerPreset = presetSel.value || 'all';
      if (qInp) state.lowerCustomQuery = qInp.value.trim();
      var ocVal = ocInp ? ocInp.value.trim() : '';

      var pullStartGen = global.PuPBoxStore.getSessionGen();
      var pullStartUid = global.PuPBoxStore.getActiveUid();
      state.lowerPullBusy = true;
      state.lowerStatusBanner = null;
      renderMain();

      global.PuPBoxStore.pullLowerCourtOfficial({
        expectedGen: pullStartGen,
        expectedUid: pullStartUid,
        auth: snapshotAuthForUid(pullStartUid),
        lawOc: ocVal,
        court: state.lowerCourtFilter,
        preset: state.lowerPreset,
        query: state.lowerCustomQuery
      }).then(function (res) {
        if (!isSameSession(pullStartGen, pullStartUid)) return;
        state.lowerPullBusy = false;
        var warnList = Array.isArray(res.errors) ? res.errors.filter(Boolean) : [];
        if (res.partial || warnList.length) {
          state.lowerStatusBanner = {
            kind: 'warn',
            title: '⚠ 일부 수집 완료: 신규 ' + res.added + '건 · 중복병합 ' + res.merged + '건',
            detail: warnList.length ? ('일부 요청 경고(' + warnList.length + '건): ' + warnList.slice(0, 2).join(' / ')) : ''
          };
          toast('일부 수집 완료: 신규 ' + res.added + '건 · 중복병합 ' + res.merged + '건', 'err');
        } else {
          state.lowerStatusBanner = {
            kind: 'ok',
            title: '✓ 하급심 판례 수집 완료: 신규 ' + res.added + '건 · 중복병합 ' + res.merged + '건',
            detail: '판례·심결·유권해석 통합검색 메뉴와 AI 질의창에서 즉시 활용할 수 있습니다.'
          };
          toast('하급심 판례 수집 완료! 신규 ' + res.added + '건 · 중복병합 ' + res.merged + '건');
        }
        renderAll();
      }).catch(function (err) {
        if (!isSameSession(pullStartGen, pullStartUid)) return;
        state.lowerPullBusy = false;
        if (err && err.staleSession) {
          renderMain();
          return;
        }
        var errMsg = String((err && err.message) || err || '수집 요청에 실패했습니다.');
        state.lowerStatusBanner = {
          kind: 'err',
          title: '✕ 하급심 공식 API 수집 실패',
          detail: errMsg
        };
        renderMain();
        toast('하급심 수집 실패: ' + errMsg, 'err');
      });
    } else if (act === 'pull-tribunal-cases') {
      if (state.tribunalPullBusy) return;
      var trbSel = document.getElementById('pboxTribunalSel');
      var trbPresetSel = document.getElementById('pboxTribunalPresetSel');
      var trbLocalSel = document.getElementById('pboxTribunalLocalOrgSel');
      var trbQInp = document.getElementById('pboxTribunalQueryInput');
      var trbOcInp = document.getElementById('pboxTribunalLawOcInput');
      if (trbSel) state.tribunalFilter = trbSel.value || 'all';
      if (trbLocalSel) state.tribunalLocalOrg = trbLocalSel.value || '';
      if (trbPresetSel) state.tribunalPreset = trbPresetSel.value || 'all';
      if (trbQInp) state.tribunalCustomQuery = trbQInp.value.trim();
      var trbOcVal = trbOcInp ? trbOcInp.value.trim() : '';

      var trbStartGen = global.PuPBoxStore.getSessionGen();
      var trbStartUid = global.PuPBoxStore.getActiveUid();
      state.tribunalPullBusy = true;
      state.tribunalStatusBanner = null;
      renderMain();

      global.PuPBoxStore.pullTribunalOfficial({
        expectedGen: trbStartGen,
        expectedUid: trbStartUid,
        auth: snapshotAuthForUid(trbStartUid),
        lawOc: trbOcVal,
        tribunal: state.tribunalFilter,
        localOrg: state.tribunalFilter === 'decc_local' ? state.tribunalLocalOrg : '',
        preset: state.tribunalPreset,
        query: state.tribunalCustomQuery
      }).then(function (res) {
        if (!isSameSession(trbStartGen, trbStartUid)) return;
        state.tribunalPullBusy = false;
        var trbWarns = Array.isArray(res.errors) ? res.errors.filter(Boolean) : [];
        var hitDetail = (Array.isArray(res.sourcesHit) && res.sourcesHit.length)
          ? res.sourcesHit.join(' · ')
          : '판례·결정·유권해석 메뉴와 AI 질의창에서 즉시 활용할 수 있습니다.';
        if (res.partial || trbWarns.length) {
          state.tribunalStatusBanner = {
            kind: 'warn',
            title: '⚠ 심판·재결 일부 수집 완료: 신규 ' + res.added + '건 · 중복병합 ' + res.merged + '건',
            detail: hitDetail + (trbWarns.length ? (' / 경고: ' + trbWarns.slice(0, 2).join(' / ')) : '')
          };
          toast('심판·재결 수집 완료: 신규 ' + res.added + '건 · 중복병합 ' + res.merged + '건');
        } else {
          state.tribunalStatusBanner = {
            kind: 'ok',
            title: '✓ 심판·재결 공식 수집 완료: 신규 ' + res.added + '건 · 중복병합 ' + res.merged + '건',
            detail: hitDetail
          };
          toast('심판·재결 사건 수집 완료! 신규 ' + res.added + '건 · 중복병합 ' + res.merged + '건');
        }
        renderAll();
      }).catch(function (errT) {
        if (!isSameSession(trbStartGen, trbStartUid)) return;
        state.tribunalPullBusy = false;
        if (errT && errT.staleSession) {
          renderMain();
          return;
        }
        var errMsgT = String((errT && errT.message) || errT || '심판·재결 수집 요청에 실패했습니다.');
        state.tribunalStatusBanner = {
          kind: 'err',
          title: '✕ 심판·재결 공식 API 수집 실패',
          detail: errMsgT
        };
        renderMain();
        toast('심판·재결 수집 실패: ' + errMsgT, 'err');
      });
    } else if (act === 'pull-kcplaa-docs') {
      if (state.kcplaaPullBusy || state.liveCollectBusy) return;
      var kcChSel = document.getElementById('pboxKcplaaChannelSel');
      var kcQInp = document.getElementById('pboxKcplaaQueryInput');
      if (kcChSel) state.kcplaaChannel = kcChSel.value || 'all';
      if (kcQInp) state.kcplaaCustomQuery = kcQInp.value.trim();

      var kcStartGen = global.PuPBoxStore.getSessionGen();
      var kcStartUid = global.PuPBoxStore.getActiveUid();
      state.kcplaaPullBusy = true;
      state.kcplaaStatusBanner = null;
      renderMain();

      global.PuPBoxStore.pullKcplaaOfficial({
        expectedGen: kcStartGen,
        expectedUid: kcStartUid,
        auth: snapshotAuthForUid(kcStartUid),
        channel: state.kcplaaChannel,
        query: state.kcplaaCustomQuery
      }).then(function (resK) {
        if (!isSameSession(kcStartGen, kcStartUid)) return;
        state.kcplaaPullBusy = false;
        var kcWarns = Array.isArray(resK.errors) ? resK.errors.filter(Boolean) : [];
        var kcHitDetail = (Array.isArray(resK.sourcesHit) && resK.sourcesHit.length)
          ? resK.sourcesHit.join(' · ')
          : '판례·결정·유권해석 통합검색 메뉴와 홈 검색창에서 즉시 직접 검색할 수 있습니다.';
        state.kcplaaStatusBanner = {
          kind: (resK.partial || kcWarns.length) ? 'warn' : 'ok',
          title: (resK.partial || kcWarns.length ? '⚠ 한국공인노무사회 일부 수집 완료: ' : '✓ 한국공인노무사회(ilabor·본회) 자료 당겨오기 완료: ') +
            '신규 ' + resK.added + '건 · 중복병합 ' + resK.merged + '건',
          detail: kcHitDetail + (kcWarns.length ? (' / 안내: ' + kcWarns.slice(0, 2).join(' / ')) : '')
        };
        toast('한국공인노무사회 자료 당겨오기 완료! 신규 ' + resK.added + '건 · 중복병합 ' + resK.merged + '건');
        renderAll();
      }).catch(function (errK) {
        if (!isSameSession(kcStartGen, kcStartUid)) return;
        state.kcplaaPullBusy = false;
        if (errK && errK.staleSession) {
          renderMain();
          return;
        }
        var errMsgK = String((errK && errK.message) || errK || '한국공인노무사회 수집 요청에 실패했습니다.');
        state.kcplaaStatusBanner = {
          kind: 'err',
          title: '✕ 한국공인노무사회 자료 당겨오기 실패',
          detail: errMsgK
        };
        renderMain();
        toast('노무사회 수집 실패: ' + errMsgK, 'err');
      });
    } else if (act === 'jump-kcplaa-cases') {
      var jumpKcQ = (document.getElementById('pboxKcplaaQueryInput') || {}).value || state.kcplaaCustomQuery || '';
      state.caseDocType = 'kcplaa';
      state.caseQuery = String(jumpKcQ).trim();
      switchView('cases');
    } else if (act === 'copy-kcplaa-cli') {
      var cliQ = ((document.getElementById('pboxKcplaaQueryInput') || {}).value || state.kcplaaCustomQuery || '통상임금').trim();
      var safeCliQ = cliQ.replace(/[^가-힣A-Za-z0-9 .,_()·-]/g, '').replace(/^-+/, '').trim().slice(0, 50);
      var cliCmd = 'kcplaa-pbox search "' + (safeCliQ || '통상임금') + '"';
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        navigator.clipboard.writeText(cliCmd).then(function () {
          toast('✓ CLI 명령어가 복사되었습니다: ' + cliCmd);
        });
      } else {
        toast('CLI 명령어: ' + cliCmd);
      }
    } else if (act === 'preview-ingest') {
      var ita = document.getElementById('pboxIngestTa');
      var schk = document.getElementById('pboxShareConfirmChk');
      var raw = ita ? ita.value : '';
      if (schk) state.ingestShareConfirmed = !!schk.checked;
      if (!raw.trim()) { toast('본문을 먼저 붙여넣어 주세요.', 'err'); return; }
      try {
        state.ingestRawText = raw;
        state.ingestPreview = global.PuPBoxEngine.ingestRawDocument(raw, { sourceLabel: '직접 입력 수집' });
        renderMain();
      } catch (err) {
        toast(err.message, 'err');
      }
    } else if (act === 'commit-ingest') {
      var ita2 = document.getElementById('pboxIngestTa');
      var raw2 = ita2 ? ita2.value : state.ingestRawText;
      var allowShare2 = false;
      if (!raw2.trim()) { toast('적재할 본문을 입력해 주세요.', 'err'); return; }
      try {
        var ing = global.PuPBoxEngine.ingestRawDocument(raw2, { sourceLabel: '직접 입력 수집' });
        var st2 = global.PuPBoxStore.addDocuments([ing.doc], {
          shareConfirmed: allowShare2,
          overrideDeleted: true,
          auth: snapshotAuthForUid(global.PuPBoxStore.getActiveUid()),
          onSyncError: function (srvErr2) {
            toast('로컬 보관됨 · 사무실 공유 서버 적재 실패: ' + srvErr2.message, 'err');
          }
        });
        var m2 = st2.mergedStage1 + st2.mergedStage2 + st2.mergedStage3;
        state.ingestRawText = '';
        state.ingestPreview = null;
        state.ingestShareConfirmed = false;
        toast(m2 > 0
          ? ('기존 문서와 중복 감지되어 출처를 병합했습니다 (개인정보 ' + ing.anonymization.totalMasked + '건 마스킹)')
          : ('새 판결·결정문 적재 완료! (개인정보 ' + ing.anonymization.totalMasked + '건 마스킹)'));
        renderAll();
      } catch (err2) {
        toast(err2.message, 'err');
      }
    } else if (act === 'select-wf') {
      state.activeWorkflowId = btn.getAttribute('data-id');
      renderMain();
    } else if (act === 'run-workflow') {
      var wfs = global.PuPBoxCorpus.WORKFLOWS || [];
      var wf = wfs.find(function (w) { return w.id === state.activeWorkflowId; });
      if (!wf) return;
      var inputs = document.querySelectorAll('.wf-field-input');
      var parts = ['[' + wf.title + ' 작성 요청]'];
      for (var k = 0; k < inputs.length; k++) {
        var val = inputs[k].value.trim();
        if (val) parts.push('- ' + inputs[k].getAttribute('data-flabel') + ': ' + val);
      }
      if (parts.length <= 1) {
        toast('사실관계 항목을 한 칸 이상 입력해 주세요.', 'err');
        return;
      }
      runPromptSubmit(parts.join('\n'), wf);
    } else if (act === 'open-thread') {
      var thId = btn.getAttribute('data-id');
      var found = global.PuPBoxStore.getThreads().find(function (t) { return t.id === thId; });
      if (found) {
        if (found.mode === 'search') {
          state.caseQuery = found.query || '';
          switchView('cases');
        } else {
          state.activeThread = found;
          state.reviewStance = found.stance || 'neutral';
          state.deadlineBaseDate = '';
          state.wsAuthTab = 'all';
          state.workspaceTab = found.answer ? 'report' : 'editor';
          switchView('workspace');
        }
      }
    } else if (act === 'toggle-recent-chk') {
      var rid = btn.getAttribute('data-id');
      if (btn.checked) state.selectedRecentIds.add(rid);
      else state.selectedRecentIds.delete(rid);
      renderMain();
    } else if (act === 'toggle-all-recents') {
      var allRecs = global.PuPBoxStore.getRecents();
      if (btn.checked) allRecs.forEach(function (r) { state.selectedRecentIds.add(r.id); });
      else state.selectedRecentIds.clear();
      renderMain();
    } else if (act === 'clear-recent-sel') {
      state.selectedRecentIds.clear();
      renderMain();
    } else if (act === 'bulk-attach-recents') {
      var recMap = global.PuPBoxStore.getRecents();
      Array.from(state.selectedRecentIds).slice(0, 6).forEach(function (rid2) {
        var rItem = recMap.find(function (x) { return x.id === rid2; });
        if (!rItem) return;
        if (rItem.kind === 'law') attachLawByDir(rItem.lawDir, rItem.fileName || '');
        else {
          var dcObj = global.PuPBoxStore.getDocById(String(rItem.id).replace(/^doc:/, ''));
          if (dcObj) attachItem({ id: 'doc:' + dcObj.id, kind: 'doc', title: dcObj.title, caseNo: dcObj.caseNo, body: dcObj.body });
        }
      });
    } else if (act === 'bulk-proj-recents') {
      var recList = global.PuPBoxStore.getRecents();
      var chosenRecs = Array.from(state.selectedRecentIds).map(function (rid3) {
        return recList.find(function (x) { return x.id === rid3; });
      }).filter(Boolean);
      if (!chosenRecs.length) return;
      ensureProjectThen(function (projId) {
        var docIdsAdd = [];
        var lawDirsAdd = [];
        chosenRecs.forEach(function (rItem) {
          if (rItem.kind === 'law' && rItem.lawDir) lawDirsAdd.push(rItem.lawDir);
          else if (rItem.kind === 'doc') docIdsAdd.push(String(rItem.id).replace(/^doc:/, ''));
        });
        global.PuPBoxStore.addItemsToProject(projId, docIdsAdd, lawDirsAdd);
        state.selectedRecentIds.clear();
        toast('선택한 열람 자료를 프로젝트에 담았습니다.');
        renderAll();
      });
    } else if (act === 'bulk-del-recents') {
      var rIdsToDel = Array.from(state.selectedRecentIds);
      if (!rIdsToDel.length) return;
      if (typeof global.confirm === 'function' && !global.confirm('선택한 최근 본 자료 기록 ' + rIdsToDel.length + '건을 삭제하시겠습니까?')) {
        return;
      }
      global.PuPBoxStore.deleteRecents(rIdsToDel);
      state.selectedRecentIds.clear();
      toast('열람 기록 ' + rIdsToDel.length + '건을 삭제했습니다.');
      renderAll();
    } else if (act === 'toggle-task-chk') {
      var tid = btn.getAttribute('data-id');
      if (btn.checked) state.selectedTaskIds.add(tid);
      else state.selectedTaskIds.delete(tid);
      renderMain();
    } else if (act === 'toggle-all-tasks') {
      var allThs = global.PuPBoxStore.getThreads();
      if (btn.checked) allThs.forEach(function (t) { state.selectedTaskIds.add(t.id); });
      else state.selectedTaskIds.clear();
      renderMain();
    } else if (act === 'clear-task-sel') {
      state.selectedTaskIds.clear();
      renderMain();
    } else if (act === 'bulk-proj-tasks') {
      var allThList = global.PuPBoxStore.getThreads();
      var chosenTasks = Array.from(state.selectedTaskIds).map(function (tid2) {
        return allThList.find(function (x) { return x.id === tid2; });
      }).filter(function (x) { return x && (x.answer || x.sourceText); });
      if (!chosenTasks.length) {
        toast('프로젝트에 보관할 본문이 있는 작업을 선택해 주세요.', 'err');
        return;
      }
      ensureProjectThen(function (projId) {
        var prObj = global.PuPBoxStore.getProjects().find(function (x) { return x.id === projId; });
        if (prObj) {
          var newDrafts = chosenTasks.map(function (t) {
            return { title: t.title || t.query, answer: t.answer || t.sourceText || '', savedAt: Date.now() };
          });
          prObj.drafts = newDrafts.concat(prObj.drafts || []);
          global.PuPBoxStore.saveProject(prObj);
          state.selectedTaskIds.clear();
          toast('선택한 작업 ' + newDrafts.length + '건을 프로젝트에 보관했습니다.');
          renderAll();
        }
      });
    } else if (act === 'bulk-del-tasks') {
      var tIdsToDel = Array.from(state.selectedTaskIds);
      if (!tIdsToDel.length) return;
      if (typeof global.confirm === 'function' && !global.confirm('선택한 작업 ' + tIdsToDel.length + '건을 삭제하시겠습니까?')) {
        return;
      }
      global.PuPBoxStore.deleteThreads(tIdsToDel);
      if (state.activeThread && state.selectedTaskIds.has(state.activeThread.id)) {
        state.activeThread = null;
      }
      state.selectedTaskIds.clear();
      toast('작업 ' + tIdsToDel.length + '건을 삭제했습니다.');
      renderAll();
    } else if (act === 'delete-single-task') {
      var oneTid = btn.getAttribute('data-id');
      if (!oneTid) return;
      if (typeof global.confirm === 'function' && !global.confirm('이 작업 기록을 삭제하시겠습니까?')) {
        return;
      }
      global.PuPBoxStore.deleteThreads([oneTid]);
      state.selectedTaskIds.delete(oneTid);
      if (state.activeThread && state.activeThread.id === oneTid) {
        state.activeThread = null;
      }
      toast('작업을 삭제했습니다.');
      renderAll();
    } else if (act === 'copy-thread') {
      if (state.activeThread && navigator.clipboard) {
        var copyBody = state.activeThread.answer || state.activeThread.sourceText || '';
        navigator.clipboard.writeText(copyBody).then(function () { toast('문서·의견서 전문이 클립보드에 복사되었습니다.'); });
      }
    } else if (act === 'export-thread-md') {
      if (state.activeThread) {
        downloadBlob('pbox-opinion.md', state.activeThread.answer || state.activeThread.sourceText || '', 'text/markdown;charset=utf-8');
      }
    } else if (act === 'export-thread-doc') {
      if (state.activeThread) {
        prepareFormalDocFromThread(state.activeThread, { docType: 'opinion' }).then(function (formalForDoc) {
          downloadBlob(formalForDoc.fileNameBase + '.doc', formalForDoc.html, 'application/msword;charset=utf-8');
          toast('법령 조문 대조·할루시네이션 차단 검증을 거친 Word(.doc) 의견서를 저장했습니다.');
        }).catch(function (errDoc) {
          toast('Word(.doc) 생성 오류: ' + (errDoc && errDoc.message ? errDoc.message : String(errDoc)), 'err');
        });
      }
    } else if (act === 'open-handoff-modal') {
      showDocumentHandoffModal();
    } else if (act === 'quick-open-hangul') {
      if (state.activeThread) {
        try {
          var thQuick = state.activeThread;
          openFormalDocInHangulEditor(prepareFormalDocFromThread(thQuick, { docType: 'opinion' }), { thread: thQuick });
        } catch (errQuick) {
          toast('한글 편집기 연결 오류: ' + errQuick.message, 'err');
        }
      }
    } else if (act === 'export-thread-hwpx') {
      if (state.activeThread) {
        prepareFormalDocFromThread(state.activeThread, { docType: 'opinion' }).then(function (quickHwpxDoc) {
          downloadFormalHwpx(quickHwpxDoc);
          toast('표준 한글(.hwpx) 공식 의견서를 저장했습니다.');
        }).catch(function (errHwpx) {
          toast('한글(.hwpx) 생성 오류: ' + (errHwpx && errHwpx.message ? errHwpx.message : String(errHwpx)), 'err');
        });
      }
    } else if (act === 'handoff-open-hangul') {
      if (state.activeThread) {
        try {
          var thHandoff = state.activeThread;
          var hOpts = readHandoffModalOptions();
          closeModal();
          openFormalDocInHangulEditor(prepareFormalDocFromThread(thHandoff, hOpts), { thread: thHandoff });
        } catch (errH1) {
          toast('한글 편집기 연결 오류: ' + errH1.message, 'err');
        }
      }
    } else if (act === 'handoff-download-hwpx') {
      if (state.activeThread) {
        var hOpts2 = readHandoffModalOptions();
        closeModal();
        prepareFormalDocFromThread(state.activeThread, hOpts2).then(function (hDoc2) {
          downloadFormalHwpx(hDoc2);
          toast(hDoc2.docTypeLabel + ' 한글(.hwpx) 파일을 저장했습니다.');
        }).catch(function (errH2) {
          toast('한글(.hwpx) 생성 오류: ' + (errH2 && errH2.message ? errH2.message : String(errH2)), 'err');
        });
      }
    } else if (act === 'handoff-download-doc') {
      if (state.activeThread) {
        var hOpts3 = readHandoffModalOptions();
        closeModal();
        prepareFormalDocFromThread(state.activeThread, hOpts3).then(function (hDoc3) {
          downloadBlob(hDoc3.fileNameBase + '.doc', hDoc3.html, 'application/msword;charset=utf-8');
          toast(hDoc3.docTypeLabel + ' Word(.doc) 파일을 저장했습니다.');
        }).catch(function (errH3) {
          toast('Word(.doc) 생성 오류: ' + (errH3 && errH3.message ? errH3.message : String(errH3)), 'err');
        });
      }
    } else if (act === 'save-thread-proj') {
      if (!state.activeThread) return;
      ensureProjectThen(function (projId) {
        var p = global.PuPBoxStore.getProjects().find(function (x) { return x.id === projId; });
        if (p) {
          p.drafts = [{ title: state.activeThread.title, answer: state.activeThread.answer || state.activeThread.sourceText || '', savedAt: Date.now() }].concat(p.drafts || []);
          global.PuPBoxStore.saveProject(p);
          toast('프로젝트 폴더에 검토의견·초안을 보관했습니다.');
          renderSidebarCounts();
        }
      });
    } else if (act === 'create-project-prompt') {
      showCreateProjectModal(null);
    } else if (act === 'confirm-create-proj') {
      var nEl = document.getElementById('pboxNewProjName');
      var cEl = document.getElementById('pboxNewProjClient');
      var mEl = document.getElementById('pboxNewProjNote');
      var name = nEl && nEl.value.trim() ? nEl.value.trim() : '새 노무 사건 프로젝트';
      var created = global.PuPBoxStore.saveProject({
        name: name,
        clientName: cEl ? cEl.value.trim() : '',
        note: mEl ? mEl.value.trim() : ''
      });
      state.activeProjectId = created.id;
      closeModal();
      if (typeof state._afterProjCb === 'function') {
        var cb = state._afterProjCb;
        state._afterProjCb = null;
        cb(created.id);
      } else {
        toast('프로젝트 폴더가 생성되었습니다: ' + created.name);
        renderAll();
      }
    } else if (act === 'toggle-proj-chk') {
      if (ev && ev.stopPropagation) ev.stopPropagation();
      var pid = btn.getAttribute('data-id');
      if (btn.checked) state.selectedProjectIds.add(pid);
      else state.selectedProjectIds.delete(pid);
      renderMain();
    } else if (act === 'toggle-all-projs') {
      var allProjs = global.PuPBoxStore.getProjects();
      if (btn.checked) allProjs.forEach(function (prItem) { state.selectedProjectIds.add(prItem.id); });
      else state.selectedProjectIds.clear();
      renderMain();
    } else if (act === 'clear-proj-sel') {
      state.selectedProjectIds.clear();
      renderMain();
    } else if (act === 'bulk-del-projs') {
      var pIds = Array.from(state.selectedProjectIds);
      if (!pIds.length) return;
      if (typeof global.confirm === 'function' && !global.confirm('선택한 사건 프로젝트 폴더 ' + pIds.length + '개를 삭제하시겠습니까?')) {
        return;
      }
      pIds.forEach(function (id) { global.PuPBoxStore.deleteProject(id); });
      state.selectedProjectIds.clear();
      var remProjs = global.PuPBoxStore.getProjects();
      state.activeProjectId = remProjs[0] ? remProjs[0].id : '';
      toast('사건 프로젝트 ' + pIds.length + '개를 삭제했습니다.');
      renderAll();
    } else if (act === 'select-project' || act === 'open-project') {
      state.activeProjectId = btn.getAttribute('data-id');
      switchView('projects');
    } else if (act === 'delete-project') {
      if (typeof global.confirm === 'function' && !global.confirm('이 사건 프로젝트 폴더를 삭제하시겠습니까?')) {
        return;
      }
      var delId = btn.getAttribute('data-id');
      state.selectedProjectIds.delete(delId);
      global.PuPBoxStore.deleteProject(delId);
      var rest = global.PuPBoxStore.getProjects();
      state.activeProjectId = rest[0] ? rest[0].id : '';
      toast('프로젝트 폴더를 삭제했습니다.');
      renderAll();
    } else if (act === 'export-project') {
      var pr = global.PuPBoxStore.getProjects().find(function (x) { return x.id === btn.getAttribute('data-id'); });
      if (pr) {
        var packetMd = buildProjectExportMarkdown(pr);
        downloadBlob('pbox-project-' + String(pr.name || 'project').replace(/[^\w가-힣-]/g, '_') + '.md', packetMd, 'text/markdown;charset=utf-8');
      }
    } else if (act === 'copy-art') {
      var artCard = btn.closest('.pbox-law-art');
      var txtEl = artCard && artCard.querySelector('.pbox-art-txt');
      if (txtEl && navigator.clipboard) {
        var header = btn.getAttribute('data-law') + ' ' + btn.getAttribute('data-no') + '\n';
        navigator.clipboard.writeText(header + txtEl.innerText).then(function () { toast('조문을 복사했습니다.'); });
      }
    } else if (act === 'copy-doc-body') {
      var cd = global.PuPBoxStore.getDocById(btn.getAttribute('data-id'));
      if (cd && navigator.clipboard) {
        navigator.clipboard.writeText(cd.title + '\n' + cd.body).then(function () { toast('문서 전문을 복사했습니다.'); });
      }
    } else if (act === 'open-cfg-modal') {
      showConfigModal();
    } else if (act === 'sync-now-modal') {
      if (state.syncBusy) return;
      state.syncBusy = true;
      state.syncProgressText = '판례·재결·해석 전체 자동동기화 중…';
      refreshConfigModalInPlace();
      renderSidebarCounts();
      global.PuPBoxStore.runIncrementalSync({ callServer: true, auth: getAuthObj() }).then(function (r) {
        state.syncBusy = false;
        state.syncProgressText = '';
        if (r && r.ok === false) {
          toast('자동동기화 일부 지연: ' + ((r.errors && r.errors[0]) || '잠시 후 다시 시도해 주세요.'), 'err');
        } else {
          var pulledTotal = ((r && r.serverPulled) || 0) + ((r && r.supabasePulled) || 0);
          toast('✓ 전체 자동동기화 완료! (신규 반영 ' + pulledTotal + '건 · 전 직원 무료 공유함 동기화됨)');
        }
        renderAll();
        refreshConfigModalInPlace();
      });
    } else if (act === 'jump-auto-discover') {
      var jumpQ = state.caseQuery.trim();
      closeModal();
      switchView('cases');
      if (jumpQ.length >= 2) {
        triggerAutoDiscoverCollection(jumpQ);
      } else {
        var jumpInp = document.getElementById('pboxCaseSearchInput');
        if (jumpInp && typeof jumpInp.focus === 'function') jumpInp.focus();
        toast('자동탐색할 쟁점어·약칭 또는 사건번호를 입력한 뒤 [🔎 개편·누락 자동탐색]을 눌러 주세요.');
      }
    } else if (act === 'test-supa-cfg') {
      var uVal = ((document.getElementById('pboxCfgSupaUrl') || {}).value || '').trim();
      var kVal = ((document.getElementById('pboxCfgSupaKey') || {}).value || '').trim();
      if (uVal) {
        global.PuPBoxStore.testSupabaseConnection({ supabaseUrl: uVal, supabaseStaffJwt: kVal })
          .then(function () { toast('✓ 외부 Supabase 직원 인증 연결 성공!'); })
          .catch(function (e) { toast(e.message, 'err'); });
      } else {
        global.PuPBoxStore.testSharedServerConnection(getAuthObj())
          .then(function (info) {
            renderSidebarCounts();
            refreshConfigModalInPlace();
            toast('✓ 푸른 사무실 무료 공유 DB 정상 연결 확인! (공유 수록 ' + (info.totalSharedActive || 0) + '건)');
          })
          .catch(function (e2) { toast(e2.message, 'err'); });
      }
    } else if (act === 'save-cfg') {
      global.PuPBoxStore.saveConfig({
        supabaseUrl: (document.getElementById('pboxCfgSupaUrl') || {}).value || '',
        supabaseStaffJwt: (document.getElementById('pboxCfgSupaKey') || {}).value || '',
        lawOc: (document.getElementById('pboxCfgLawOc') || {}).value || '',
        autoSyncOnBoot: !!(document.getElementById('pboxCfgAutoBoot') || {}).checked,
        preferOfflineAi: !!(document.getElementById('pboxCfgOfflineAi') || {}).checked
      });
      closeModal();
      toast('설정이 저장되었으며 무료 공유 DB와 동기화합니다.');
      global.PuPBoxStore.runIncrementalSync({ callServer: false, pullSharedOnly: true, autoBootstrapIfStale: true, auth: getAuthObj() }).then(function () { renderAll(); });
    } else if (act === 'backup-export-json') {
      var dump = {
        exportedAt: new Date().toISOString(),
        docs: global.PuPBoxStore.getDocs(),
        projects: global.PuPBoxStore.getProjects(),
        threads: global.PuPBoxStore.getThreads()
      };
      downloadBlob('pbox-backup-' + global.PuPBoxEngine.todayKstYmd() + '.json', JSON.stringify(dump, null, 2), 'application/json');
    } else if (act === 'backup-import-json') {
      if (state.backupBusy) {
        toast('이미 백업 복원이 진행 중입니다. 잠시만 기다려 주세요.', 'err');
        return;
      }
      var bf = document.getElementById('pboxBackupFileInput');
      if (bf) bf.click();
    }
  }

  function triggerLiveCaseCollection(rawQuery) {
    if (state.liveCollectBusy || (state.caseDocType === 'kcplaa' && state.kcplaaPullBusy)) return;
    var q = String(rawQuery == null ? state.caseQuery : rawQuery).trim();
    var startGen = global.PuPBoxStore.getSessionGen();
    var startUid = global.PuPBoxStore.getActiveUid();
    var startAuth = snapshotAuthForUid(startUid) || getAuthObj();
    var cfg = global.PuPBoxStore.getConfig();

    state.liveCollectBusy = true;
    if (state.caseDocType === 'kcplaa') state.kcplaaPullBusy = true;
    state.syncProgressText = q ? ('"' + q.slice(0, 14) + '" 실시간 수집 중…') : '전 기관 최신본 수집 중…';
    state.liveCollectBanner = null;
    renderAll();

    if (state.caseDocType === 'kcplaa') {
      var kcSan = sanitizeExternalSearchQuery(q);
      if (q && !kcSan.ok) {
        state.liveCollectBusy = false;
        state.kcplaaPullBusy = false;
        state.syncProgressText = '';
        toast(kcSan.error, 'err');
        renderAll();
        return;
      }
      global.PuPBoxStore.pullKcplaaOfficial({
        expectedGen: startGen,
        expectedUid: startUid,
        auth: startAuth,
        channel: 'all',
        query: kcSan.ok ? kcSan.query : ''
      }).then(function (rk) {
        if (!isSameSession(startGen, startUid)) return;
        state.liveCollectBusy = false;
        state.kcplaaPullBusy = false;
        state.syncProgressText = '';
        state.liveCollectBanner = {
          kind: (rk.partial || (rk.errors && rk.errors.length)) ? 'warn' : 'ok',
          title: '✓ 한국공인노무사회 실시간 수집 완료: 신규 ' + rk.added + '건 · 중복병합 ' + rk.merged + '건',
          detail: (Array.isArray(rk.sourcesHit) && rk.sourcesHit.length) ? rk.sourcesHit.join(' · ') : ''
        };
        toast('노무사회 자료 수집 완료! 신규 ' + rk.added + '건 · 중복병합 ' + rk.merged + '건');
        renderAll();
      }).catch(function (ek) {
        if (!isSameSession(startGen, startUid)) return;
        state.liveCollectBusy = false;
        state.kcplaaPullBusy = false;
        state.syncProgressText = '';
        var em = String((ek && ek.message) || ek || '노무사회 자료 수집 실패');
        state.liveCollectBanner = { kind: 'err', title: '✕ 한국공인노무사회 수집 오류', detail: em };
        toast('노무사회 수집 안내: ' + em, 'err');
        renderAll();
      });
      return;
    }

    if (q.length < 2) {
      global.PuPBoxStore.runIncrementalSync({ callServer: true, auth: startAuth }).then(function (r) {
        if (!isSameSession(startGen, startUid)) return;
        state.liveCollectBusy = false;
        state.syncProgressText = '';
        var pulledCnt = (r && r.supabasePulled) || 0;
        state.liveCollectBanner = {
          kind: (r && r.ok === false) ? 'warn' : 'ok',
          title: (r && r.ok === false)
            ? '⚠ 전 기관 실시간 동기화 일부 제한'
            : ('✓ 전 기관 최신 판례·결정례·유권해석 실시간 점검 완료 (동기화 ' + pulledCnt + '건)'),
          detail: (r && r.errors && r.errors[0]) || '검색어를 2글자 이상 입력하고 누르면 해당 쟁점의 대법원·하급심·헌재·중노위·노동부·법제처·산재 문서를 핀포인트 수집합니다.'
        };
        renderAll();
      }).catch(function (errInc) {
        if (!isSameSession(startGen, startUid)) return;
        state.liveCollectBusy = false;
        state.syncProgressText = '';
        toast('실시간 점검 오류: ' + String((errInc && errInc.message) || errInc), 'err');
        renderAll();
      });
      return;
    }

    var customTargets = [];
    if (state.caseDocType === 'dec_nlrc' && state.caseTribunalOrg && state.caseTribunalOrg !== 'all') {
      var orgList = (global.PuPBoxCorpus && global.PuPBoxCorpus.TRIBUNAL_ORGS) || [];
      var selOrgObj = orgList.find(function (o) { return o.id === state.caseTribunalOrg; });
      if (selOrgObj && Array.isArray(selOrgObj.targets)) customTargets = selOrgObj.targets.slice();
    }
    var apiDocType = (state.caseDocType === 'prec_group' || state.caseDocType === 'interp_group')
      ? 'all'
      : state.caseDocType;

    global.PuPBoxStore.liveSearchAndCollect({
      query: q,
      docType: apiDocType,
      targets: customTargets,
      lawOc: cfg.lawOc || '',
      expectedGen: startGen,
      expectedUid: startUid,
      auth: startAuth
    }).then(function (res) {
      if (!isSameSession(startGen, startUid)) return;
      state.liveCollectBusy = false;
      state.syncProgressText = '';
      var warnCnt = Array.isArray(res.errors) ? res.errors.filter(Boolean).length : 0;
      var fetchedTotal = Number(res.fetchedCount !== undefined ? res.fetchedCount : (res.fetchedTotal || 0));
      var recNotes = Array.isArray(res.recoveryNotes) ? res.recoveryNotes.filter(Boolean) : [];
      state.liveCollectBanner = {
        kind: (res.partial || warnCnt > 0 || fetchedTotal === 0) ? 'warn' : 'ok',
        title: (res.autoRecovered ? '🔎 "' + q + '" 4중 자가복구 탐색 완료: ' : '⚡ "' + q + '" 전 기관 실시간 수집 완료: ') +
          '신규 ' + res.added + '건 · 중복병합 ' + res.merged + '건 (총 수신 ' + fetchedTotal + '건)',
        detail: recNotes.length
          ? ('자동 복구 작동: ' + recNotes.slice(0, 3).join(' · '))
          : (warnCnt > 0
              ? ('일부 기관 지연/경고(' + warnCnt + '건): ' + res.errors.slice(0, 2).join(' / '))
              : '대법원·하급심·헌재·중노위·행심위·법제처·고용노동부·개보위·인권위·산재 공식 원문이 비식별·중복제거 후 P박스 무료 공유 DB에 즉시 반영되었습니다.'),
        routes: Array.isArray(res.alternatePortalRoutes) ? res.alternatePortalRoutes : []
      };
      toast('실시간 수집 완료! 신규 ' + res.added + '건 · 중복병합 ' + res.merged + '건');
      reverifyActiveThreadIfAny();
      renderAll();
    }).catch(function (err) {
      if (!isSameSession(startGen, startUid)) return;
      state.liveCollectBusy = false;
      state.syncProgressText = '';
      if (err && err.staleSession) {
        renderMain();
        return;
      }
      var msg = String((err && err.message) || err || '실시간 수집 요청에 실패했습니다.');
      state.liveCollectBanner = {
        kind: 'err',
        title: '✕ 전 기관 실시간 수집 오류',
        detail: msg + ' (위 외부 DB 직행 버튼으로는 지금 바로 각 사이트 원문을 열람할 수 있습니다.)'
      };
      toast('실시간 수집 안내: ' + msg, 'err');
      renderAll();
    });
  }

  function triggerAutoDiscoverCollection(rawQuery) {
    if (state.liveCollectBusy) return;
    var q = String(rawQuery == null ? state.caseQuery : rawQuery).trim();
    if (q.length < 2) {
      toast('자동 복구 탐색할 쟁점어 또는 사건번호를 2글자 이상 입력해 주세요.', 'err');
      var inp = document.getElementById('pboxCaseSearchInput');
      if (inp && typeof inp.focus === 'function') inp.focus();
      return;
    }
    var startGen = global.PuPBoxStore.getSessionGen();
    var startUid = global.PuPBoxStore.getActiveUid();
    var startAuth = snapshotAuthForUid(startUid) || getAuthObj();
    var cfg = global.PuPBoxStore.getConfig();

    state.liveCollectBusy = true;
    state.syncProgressText = '"' + q.slice(0, 14) + '" 4중 자가복구 탐색 중…';
    state.liveCollectBanner = null;
    renderAll();

    global.PuPBoxStore.autoDiscoverOfficial({
      query: q,
      lawOc: cfg.lawOc || '',
      expectedGen: startGen,
      expectedUid: startUid,
      auth: startAuth
    }).then(function (res) {
      if (!isSameSession(startGen, startUid)) return;
      state.liveCollectBusy = false;
      state.syncProgressText = '';
      var fetchedTotal = Number(res.fetchedCount || 0);
      var recNotes = Array.isArray(res.recoveryNotes) ? res.recoveryNotes.filter(Boolean) : [];
      var expStr = (Array.isArray(res.expandedQueries) && res.expandedQueries.length > 1)
        ? ('확장 질의 [' + res.expandedQueries.join(' → ') + '] · ')
        : '';
      state.liveCollectBanner = {
        kind: fetchedTotal > 0 ? 'ok' : 'warn',
        title: '🔎 "' + q + '" 홈페이지 개편·누락 대비 4중 자동탐색 완료: 신규 ' + res.added + '건 · 중복병합 ' + res.merged + '건',
        detail: expStr + (recNotes.length
          ? recNotes.slice(0, 3).join(' · ')
          : (fetchedTotal > 0
              ? '다중 공식 경로·자율 DOM 파서로 실존 공식 원문을 확보하여 무료 공유 DB에 반영했습니다. 외부 기관 사이트 직접 열람은 아래 도메인 우회 버튼을 누르세요.'
              : '일치하는 원문이 없거나 외부 기관 홈페이지가 점검 중입니다. 아래 공공도메인(.go.kr) 개편 무관 우회 경로로 바로 찾을 수 있습니다.')),
        routes: Array.isArray(res.alternatePortalRoutes) ? res.alternatePortalRoutes : []
      };
      toast('자동 복구 탐색 완료! 신규 ' + res.added + '건 · 중복병합 ' + res.merged + '건');
      reverifyActiveThreadIfAny();
      renderAll();
      scrollCaseStatusBannerIntoView();
    }).catch(function (err) {
      if (!isSameSession(startGen, startUid)) return;
      state.liveCollectBusy = false;
      state.syncProgressText = '';
      if (err && err.staleSession) {
        renderMain();
        return;
      }
      var msg = String((err && err.message) || err || '자동 복구 탐색에 실패했습니다.');
      state.liveCollectBanner = {
        kind: 'err',
        title: '✕ 자동 복구 탐색 오류',
        detail: msg
      };
      toast('자동 탐색 안내: ' + msg, 'err');
      renderAll();
      scrollCaseStatusBannerIntoView();
    });
  }

  function scrollCaseStatusBannerIntoView() {
    var bn = document.getElementById('pboxCaseStatusBanner');
    if (bn && typeof bn.scrollIntoView === 'function') {
      try { bn.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (_) {}
    }
  }

  function bindDelegatedEvents() {
    if (state._eventsBound) return;
    state._eventsBound = true;

    document.addEventListener('click', function (ev) {
      var back = document.getElementById('pboxModalBackdrop');
      if (ev.target === back) {
        closeModal();
        return;
      }
      var tapLbl = ev.target && ev.target.closest ? ev.target.closest('.pbox-chk-tap') : null;
      if (tapLbl && ev.target === tapLbl) {
        return;
      }
      var btn = ev.target && ev.target.closest ? ev.target.closest('[data-act]') : null;
      if (!btn || btn.disabled) return;
      handleActionElement(btn, ev);
    });

    /* 키보드 접근성: Escape 닫기 · 모달 Tab 포커스 가두기 · 비버튼 [data-act] 요소 Enter/Space 실행 */
    document.addEventListener('keydown', function (ev) {
      var back = document.getElementById('pboxModalBackdrop');
      var modalOpen = !!(back && back.style.display === 'flex');

      if (ev.key === 'Escape') {
        if (closeTopLayerForBack()) {
          ev.preventDefault();
        }
        return;
      }

      if (modalOpen && ev.key === 'Tab') {
        var box = document.getElementById('pboxModalBox');
        var focusables = getFocusableIn(box);
        if (focusables.length) {
          var first = focusables[0];
          var last = focusables[focusables.length - 1];
          if (ev.shiftKey && document.activeElement === first) {
            ev.preventDefault();
            last.focus();
          } else if (!ev.shiftKey && document.activeElement === last) {
            ev.preventDefault();
            first.focus();
          }
        }
        return;
      }

      if ((ev.key === 'ArrowDown' || ev.key === 'ArrowUp' || ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') &&
          ev.target && ev.target.getAttribute && ev.target.getAttribute('role') === 'option') {
        var listbox = ev.target.closest('[role="listbox"]');
        if (listbox) {
          var opts = Array.prototype.slice.call(listbox.querySelectorAll('[role="option"]'));
          var curIdx = opts.indexOf(ev.target);
          if (curIdx === 0 && ev.key === 'ArrowUp' && listbox.closest && listbox.closest('#pboxLiveFactReview')) {
            var homeTaBack = document.getElementById('pboxPromptInput');
            if (homeTaBack && typeof homeTaBack.focus === 'function') {
              ev.preventDefault();
              opts.forEach(function (o, oi) { o.setAttribute('aria-selected', oi === 0 ? 'true' : 'false'); });
              homeTaBack.focus();
              return;
            }
          }
          if (curIdx >= 0 && opts.length > 1) {
            ev.preventDefault();
            var step = (ev.key === 'ArrowDown' || ev.key === 'ArrowRight') ? 1 : -1;
            var nextOpt = opts[(curIdx + step + opts.length) % opts.length];
            opts.forEach(function (o) { o.setAttribute('aria-selected', o === nextOpt ? 'true' : 'false'); });
            if (nextOpt) nextOpt.focus();
            return;
          }
        }
      }

      if ((ev.key === 'Enter' || ev.key === ' ') && ev.target && ev.target.hasAttribute && ev.target.hasAttribute('data-act')) {
        var tag = (ev.target.tagName || '').toUpperCase();
        if (tag !== 'BUTTON' && tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT' && tag !== 'A') {
          ev.preventDefault();
          handleActionElement(ev.target, ev);
          return;
        }
      }

      var isIme = !!(ev.isComposing || ev.keyCode === 229);
      if (ev.key === 'ArrowDown' && !isIme && ev.target && ev.target.id === 'pboxPromptInput' && String(ev.target.value || '').indexOf('\n') < 0) {
        var liveSlot = document.getElementById('pboxLiveFactReview');
        var allAcOpts = (liveSlot && liveSlot.querySelectorAll) ? Array.prototype.slice.call(liveSlot.querySelectorAll('[role="option"]')) : [];
        var firstAcOpt = allAcOpts[0] || (liveSlot && liveSlot.querySelector ? liveSlot.querySelector('[role="option"]') : null);
        if (firstAcOpt && typeof firstAcOpt.focus === 'function') {
          ev.preventDefault();
          allAcOpts.forEach(function (o, oi) { o.setAttribute('aria-selected', oi === 0 ? 'true' : 'false'); });
          firstAcOpt.focus();
          return;
        }
      }
      if (ev.key === 'Enter' && !ev.shiftKey && !isIme && ev.target && ev.target.id === 'pboxPromptInput') {
        ev.preventDefault();
        runPromptSubmit();
      } else if (ev.key === 'Enter' && !isIme && ev.target && ev.target.id === 'pboxWsFollowInput') {
        ev.preventDefault();
        syncWorkspaceEditorDraftIfPresent();
        var fqEnter = ev.target.value.trim();
        if (fqEnter) {
          var thEnter = state.activeThread;
          var nonDefaultEnterTitle = (thEnter && thEnter.title && thEnter.title !== '새 문서 · 내용 검토' && thEnter.title !== '새 문서 검토') ? thEnter.title : '';
          runPromptSubmit(fqEnter, null, {
            inWorkspace: true,
            threadId: thEnter ? thEnter.id : '',
            mode: (thEnter && thEnter.mode) ? thEnter.mode : 'review',
            sourceText: thEnter ? (thEnter.sourceText || '') : '',
            sourceFileName: thEnter ? (thEnter.sourceFileName || '') : '',
            customTitle: nonDefaultEnterTitle
          });
        }
      } else if (ev.key === 'Enter' && !isIme && ev.target && ev.target.id === 'pboxLawSearchInput') {
        state.lawQuery = ev.target.value;
        state.lawPageLimit = 80;
        renderMain();
      } else if (ev.key === 'Enter' && !isIme && ev.target && ev.target.id === 'pboxCaseSearchInput') {
        state.caseQuery = ev.target.value;
        var subBox = document.getElementById('pboxCaseSubInput');
        if (subBox) state.caseSubQuery = subBox.value;
        renderMain();
      } else if (ev.key === 'Enter' && !isIme && ev.target && ev.target.id === 'pboxCaseSubInput') {
        state.caseSubQuery = ev.target.value;
        var mainBox = document.getElementById('pboxCaseSearchInput');
        if (mainBox) state.caseQuery = mainBox.value;
        renderMain();
      } else if (ev.key === 'Enter' && !isIme && ev.target && ev.target.id === 'pboxTopQuickInput') {
        ev.preventDefault();
        var topQuickQ = String(ev.target.value || '').trim();
        if (!topQuickQ) {
          toast('검색어를 입력해 주세요.');
          return;
        }
        state.caseQuery = topQuickQ;
        state.caseDocType = 'all';
        state.caseSubQuery = '';
        ev.target.value = '';
        switchView('cases');
      } else if (ev.key === 'Enter' && !isIme && ev.target && ev.target.id === 'pboxSiteSearchInput') {
        var enterSqCheck = sanitizeExternalSearchQuery(ev.target.value.trim());
        if (!enterSqCheck.ok) {
          toast(enterSqCheck.error, 'err');
          return;
        }
        state.siteSearchQuery = enterSqCheck.query;
        renderMain();
      }
    });

    document.addEventListener('input', function (ev) {
      if (!ev.target) return;
      if (ev.target.id === 'pboxReaderArtInput') {
        state.readerArticleFilter = ev.target.value;
        var pos = ev.target.selectionStart;
        renderReader();
        var nextIn = document.getElementById('pboxReaderArtInput');
        if (nextIn) { nextIn.focus(); try { nextIn.setSelectionRange(pos, pos); } catch (e) {} }
      } else if (ev.target.id === 'pboxAttachFilterInput') {
        var val = ev.target.value;
        showAttachModal(val, true);
        var attIn = document.getElementById('pboxAttachFilterInput');
        if (attIn) { attIn.focus(); try { attIn.setSelectionRange(val.length, val.length); } catch (e) {} }
      } else if (ev.target.id === 'pboxPromptInput' || ev.target.id === 'pboxWsFollowInput') {
        if (/@$/.test(ev.target.value)) {
          ev.target.value = ev.target.value.slice(0, -1);
          if (ev.target.id === 'pboxPromptInput') {
            state.homePromptDraft = ev.target.value;
            updateLiveFactReviewDom(ev.target.value);
          }
          showAttachModal('', false);
          return;
        }
        if (ev.target.id === 'pboxPromptInput') {
          state.homePromptDraft = ev.target.value;
          state._assistDismissedDraft = '';
          clearLiveFactTimer();
          if (!ev.isComposing) {
            updateLiveFactReviewDom(ev.target.value);
          }
        }
      }
    });

    document.addEventListener('compositionend', function (ev) {
      if (ev && ev.target && ev.target.id === 'pboxPromptInput') {
        state.homePromptDraft = ev.target.value;
        state._assistDismissedDraft = '';
        updateLiveFactReviewDom(ev.target.value);
      }
    });

    document.addEventListener('change', function (ev) {
      if (!ev.target) return;
      if (ev.target.id === 'pboxCaseDateSel') {
        var ciD = document.getElementById('pboxCaseSearchInput');
        var subD = document.getElementById('pboxCaseSubInput');
        if (ciD) state.caseQuery = ciD.value;
        if (subD) state.caseSubQuery = subD.value;
        state.caseDateRange = ev.target.value || 'all';
        renderMain();
      } else if (ev.target.id === 'pboxCaseSortSel') {
        var ciS = document.getElementById('pboxCaseSearchInput');
        var subS = document.getElementById('pboxCaseSubInput');
        if (ciS) state.caseQuery = ciS.value;
        if (subS) state.caseSubQuery = subS.value;
        state.caseSortBy = ev.target.value || 'relevance';
        renderMain();
      } else if (ev.target.id === 'pboxCaseOutcomeSel') {
        var ciO = document.getElementById('pboxCaseSearchInput');
        var subO = document.getElementById('pboxCaseSubInput');
        if (ciO) state.caseQuery = ciO.value;
        if (subO) state.caseSubQuery = subO.value;
        state.caseOutcomeFilter = ev.target.value || 'all';
        renderMain();
      } else if (ev.target.id === 'pboxDeadlineBaseInput') {
        state.deadlineBaseDate = String(ev.target.value || '').trim();
        renderMain();
      } else if (ev.target.id === 'pboxLawRevSelect') {
        openLawRevisionInReader(String(ev.target.value || ''));
      } else if (ev.target.id === 'pboxLawHistDate') {
        state.lawHistoryLookupDate = String(ev.target.value || '').trim();
      } else if (ev.target.id === 'pboxReaderHistDate') {
        state.readerHistoryDate = String(ev.target.value || '').trim();
        renderReader();
      } else if (ev.target.id === 'pboxReviewFileInput') {
        handleReviewFileOpen(ev.target.files);
        ev.target.value = '';
      } else if (ev.target.id === 'pboxQuickFileInput' || ev.target.id === 'pboxIngestFileInput') {
        handleIngestFiles(ev.target.files);
        ev.target.value = '';
      } else if (ev.target.id === 'pboxShareConfirmChk') {
        state.ingestShareConfirmed = !!ev.target.checked;
      } else if (ev.target.id === 'pboxTribunalSel') {
        var curTrbQ = document.getElementById('pboxTribunalQueryInput');
        var curTrbPreset = document.getElementById('pboxTribunalPresetSel');
        if (curTrbQ) state.tribunalCustomQuery = curTrbQ.value;
        if (curTrbPreset) state.tribunalPreset = curTrbPreset.value || 'all';
        state.tribunalFilter = ev.target.value || 'all';
        renderMain();
      } else if (ev.target.id === 'pboxTribunalLocalOrgSel') {
        state.tribunalLocalOrg = ev.target.value || '';
      } else if (ev.target.id === 'pboxBackupFileInput' && ev.target.files && ev.target.files[0]) {
        if (state.backupBusy) {
          ev.target.value = '';
          toast('이미 백업 복원이 진행 중입니다.', 'err');
          return;
        }
        var backupStartGen = global.PuPBoxStore.getSessionGen();
        var backupStartUid = global.PuPBoxStore.getActiveUid();
        var backupFile = ev.target.files[0];
        ev.target.value = '';
        state.backupBusy = true;
        var impBtn = document.getElementById('pboxBackupImportBtn');
        if (impBtn) {
          impBtn.disabled = true;
          impBtn.setAttribute('aria-busy', 'true');
        }
        backupFile.text().then(function (txt) {
          if (!isSameSession(backupStartGen, backupStartUid)) return;
          var j = JSON.parse(txt);
          var restored = global.PuPBoxStore.importBackupData(j, {
            expectedGen: backupStartGen,
            expectedUid: backupStartUid
          });
          state.backupBusy = false;
          var projectsAfter = global.PuPBoxStore.getProjects();
          if (!state.activeProjectId && projectsAfter.length) {
            state.activeProjectId = projectsAfter[0].id;
          }
          closeModal();
          toast('백업 복원 완료 (문서 ' + restored.docsAdded + '건 · 프로젝트 ' + restored.projectsRestored + '개 · 작업이력 ' + restored.threadsRestored + '건)');
          renderAll();
        }).catch(function (e) {
          if (isSameSession(backupStartGen, backupStartUid)) {
            state.backupBusy = false;
            var btnAfter = document.getElementById('pboxBackupImportBtn');
            if (btnAfter) {
              btnAfter.disabled = false;
              btnAfter.removeAttribute('aria-busy');
            }
          }
          if (e && e.staleSession) return;
          toast('복원 오류: ' + e.message, 'err');
        });
      }
    });

    /* 드래그 앤 드롭 판결문 수집 */
    document.addEventListener('dragover', function (ev) {
      if (ev.target && ev.target.closest && ev.target.closest('#pboxDropZone')) {
        ev.preventDefault();
      }
    });
    document.addEventListener('drop', function (ev) {
      if (ev.target && ev.target.closest && ev.target.closest('#pboxDropZone')) {
        ev.preventDefault();
        if (ev.dataTransfer && ev.dataTransfer.files) {
          handleIngestFiles(ev.dataTransfer.files);
        }
      }
    });
    /* 다른 탭에서 포털 전체 로그아웃 신호가 도착하면 현재 열린 화면의 민감 데이터도 즉시 초기화 */
    if (typeof global.addEventListener === 'function') {
      global.addEventListener('resize', function () {
        syncMobileSidebarA11y();
      });
      global.addEventListener('pagehide', function () {
        stopVoiceDictation({ abort: true, skipDom: true });
        clearLiveFactTimer();
        stopBackgroundAutoSync();
        clearViewSelections();
        renderMain();
      });
      global.addEventListener('storage', function (ev) {
        if (ev && ev.key === 'pu_auth_logout_at' && ev.newValue) {
          stopBackgroundAutoSync();
          state.authUser = null;
          state.userName = '노무사';
          state.aiBusy = false;
          resetSensitiveUiState();
          closeModal();
          closeReader();
          renderAll();
        }
      });
    }
  }

  function buildProjectExportMarkdown(pr) {
    if (!pr) return '';
    var out = [
      '# 사건 프로젝트: ' + (pr.name || '사건 프로젝트'),
      '- 의뢰인: ' + (pr.clientName || '-'),
      '- 메모: ' + (pr.note || '-'),
      ''
    ];
    (pr.drafts || []).forEach(function (dr) {
      out.push('## ' + (dr.title || '서면 초안') + '\n\n' + (dr.answer || dr.content || '') + '\n');
    });
    (pr.docIds || []).forEach(function (id) {
      var dc = global.PuPBoxStore.getDocById(id);
      if (dc) {
        var metaLine = [dc.court || dc.agency || '', dc.caseNo || '', dc.decisionDate || ''].filter(Boolean).join(' · ');
        out.push('## [첨부판례·해석] ' + dc.title + (metaLine ? '\n- 출처: ' + metaLine : '') + '\n\n' + (dc.body || dc.summary || '') + '\n');
      }
    });
    var idxList = (global.PuPBoxLawIndex && typeof global.PuPBoxLawIndex.list === 'function')
      ? global.PuPBoxLawIndex.list()
      : [];
    var loadedLaws = (global.PuPBoxStore && typeof global.PuPBoxStore.getLoadedLaws === 'function')
      ? global.PuPBoxStore.getLoadedLaws()
      : [];
    (pr.lawKeys || []).forEach(function (rawKey) {
      var keyStr = String(rawKey || '').trim();
      if (!keyStr) return;
      var slashIdx = keyStr.indexOf('/');
      var dirName = slashIdx >= 0 ? keyStr.slice(0, slashIdx) : keyStr;
      var fam = idxList.find(function (f) { return f.dir === dirName || f.title === dirName; }) || null;
      var activeFamFiles = (fam && Array.isArray(fam.files))
        ? fam.files.filter(function (fn) { return !(fam.hasRepealStub && fn === '법률'); })
        : [];
      var matchedCached = loadedLaws.filter(function (lw) {
        if (!lw) return false;
        if (slashIdx >= 0) return lw.cacheKey === keyStr;
        return lw.dir === dirName || lw.title === dirName;
      });
      var nonStubCached = matchedCached.filter(function (lw) { return !lw.isRepealStub; });
      if (nonStubCached.length) matchedCached = nonStubCached;

      if (matchedCached.length) {
        matchedCached.forEach(function (lw) {
          var lawMeta = [];
          if (lw.effectiveState && lw.effectiveState.label) lawMeta.push(lw.effectiveState.label);
          else if (lw.effectiveDate) lawMeta.push('시행 ' + lw.effectiveDate);
          if (lw.promulgationNo) lawMeta.push('공포 제' + lw.promulgationNo + '호');
          if (lw.dept || (fam && fam.dept)) lawMeta.push('소관: ' + (lw.dept || fam.dept));
          var fileLabel = lw.fileName ? String(lw.fileName).replace(/\.md$/, '') : '';
          var headingTitle = (lw.title || (fam && fam.title) || dirName) +
            (fileLabel && fileLabel !== '법률' && fileLabel !== '법률(법률)' && !(lw.title && lw.title.indexOf(fileLabel) >= 0) ? ' (' + fileLabel + ')' : '');
          var artBody = (Array.isArray(lw.articles) && lw.articles.length)
            ? lw.articles.map(function (a) {
                var hd = a.no + (a.heading ? ' (' + a.heading + ')' : '');
                return '### ' + hd + '\n' + (a.text || '');
              }).join('\n\n')
            : String(lw.plainText || '').trim();
          var addendaTxt = String(lw.addenda || '').trim();
          if (addendaTxt && (Array.isArray(lw.articles) && lw.articles.length || artBody.indexOf(addendaTxt) < 0)) {
            artBody = (artBody ? (artBody + '\n\n') : '') + '### 부칙\n' + addendaTxt;
          }
          var headerLines = ['## [수록법령] ' + headingTitle];
          headerLines.push('- 법령군: ' + dirName);
          if (lawMeta.length) headerLines.push('- 법령정보: ' + lawMeta.join(' · '));
          if (activeFamFiles.length) headerLines.push('- 구성 법령: ' + activeFamFiles.join(', '));
          out.push(
            headerLines.join('\n') +
            (artBody ? '\n\n' + artBody : '') + '\n'
          );
        });
        if (slashIdx < 0 && activeFamFiles.length) {
          var cachedFileNames = new Set(matchedCached.map(function (lw) {
            return String(lw.fileName || '').replace(/\.md$/, '');
          }));
          var uncachedSiblings = activeFamFiles.filter(function (fn) {
            return !cachedFileNames.has(fn);
          });
          if (uncachedSiblings.length) {
            var sibLines = [
              '### [미보관 하위·관련 법령 (' + dirName + ')]',
              '- 미보관 구성 법령: ' + uncachedSiblings.join(', ')
            ];
            if (fam && fam.dept) sibLines.push('- 소관부처: ' + fam.dept);
            sibLines.push('- 안내: 국가법령 전수함에서 해당 하위법령을 열람·보관하면 조문 전문이 함께 수록됩니다.');
            out.push(sibLines.join('\n') + '\n');
          }
        }
      } else {
        var famLines = ['## [수록법령] ' + ((fam && fam.title) || dirName)];
        famLines.push('- 법령군: ' + dirName);
        if (fam && fam.dept) famLines.push('- 소관부처: ' + fam.dept);
        if (activeFamFiles.length) {
          famLines.push('- 구성 법령: ' + activeFamFiles.join(', '));
        }
        out.push(famLines.join('\n') + '\n');
      }
    });
    return out.join('\n');
  }

  function ensureProjectThen(cb) {
    var projects = global.PuPBoxStore.getProjects();
    if (projects.length) {
      cb(state.activeProjectId || projects[0].id);
    } else {
      showCreateProjectModal(cb);
    }
  }

  function resetSensitiveUiState() {
    stopVoiceDictation({ abort: true, skipDom: true });
    clearLiveFactTimer();
    state.homePromptDraft = '';
    state._assistDismissedDraft = '';
    state.voiceBaseText = '';
    state.voiceCommittedText = '';
    state.voiceInterim = '';
    state._voiceRawCommitted = '';
    state._voiceRawInterim = '';
    state.voiceNoSpeechCount = 0;
    state._voiceConsented = false;
    state.aiBusy = false;
    state.reviewFileBusy = false;
    state.ingestBusy = false;
    state.lowerPullBusy = false;
    state.tribunalPullBusy = false;
    state.kcplaaPullBusy = false;
    state.liveCollectBusy = false;
    state.backupBusy = false;
    state.workspaceTab = 'report';
    state.wsAuthTab = 'all';
    state.reviewStance = 'neutral';
    state.deadlineBaseDate = '';
    state.hideHomeEmptyProjects = false;
    state.activeThread = null;
    state.activeSearchRes = null;
    state.attached = [];
    state.activeProjectId = '';
    state.lowerCourtFilter = '';
    state.lowerPreset = 'all';
    state.lowerCustomQuery = '';
    state.lowerStatusBanner = null;
    state.tribunalFilter = 'all';
    state.tribunalLocalOrg = '';
    state.tribunalPreset = 'all';
    state.tribunalCustomQuery = '';
    state.tribunalStatusBanner = null;
    state.kcplaaChannel = 'all';
    state.kcplaaCustomQuery = '';
    state.kcplaaStatusBanner = null;
    state.caseQuery = '';
    state.caseSubQuery = '';
    state.caseDateRange = 'all';
    state.caseSortBy = 'relevance';
    state.caseOutcomeFilter = 'all';
    state.liveCollectBanner = null;
    state.siteSearchQuery = '';
    state.lawQuery = '';
    state.lawHistoryLookupDate = '';
    state.readerLawMode = 'single';
    state.reader3Dan = null;
    state.readerHistoryOpen = false;
    state.readerHistoryBusy = false;
    state.readerHistoryList = [];
    state.readerHistoryError = '';
    state.readerHistoryDate = '';
    state.ingestRawText = '';
    state.ingestPreview = null;
    state.ingestShareConfirmed = false;
    state.selectedDocIds.clear();
    state.selectedLawDirs.clear();
    state.selectedProjectIds.clear();
    state.selectedRecentIds.clear();
    state.selectedTaskIds.clear();
  }

  function startBackgroundAutoSync(expectedUid) {
    stopBackgroundAutoSync();
    if (!expectedUid) return;
    var cfg = global.PuPBoxStore.getConfig();
    if (cfg && cfg.autoSyncOnBoot === false) return;

    function runSilentSync() {
      if (!state.authUser || state.authUser.uid !== expectedUid) {
        stopBackgroundAutoSync();
        return;
      }
      if (state.syncBusy || state.liveCollectBusy) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      global.PuPBoxStore.runIncrementalSync({
        callServer: false,
        pullSharedOnly: true,
        autoBootstrapIfStale: true,
        auth: snapshotAuthForUid(expectedUid)
      }).then(function (r) {
        if (!state.authUser || state.authUser.uid !== expectedUid) return;
        renderSidebarCounts();
        if (r && (r.treeChanged || r.supabasePulled > 0 || r.serverPulled > 0 || r.autoBootstrapped)) {
          if (state.view === 'cases' || state.view === 'alerts' || state.view === 'laws') {
            renderMain();
          }
        }
      }).catch(function () {});
    }

    runSilentSync();
    if (typeof setInterval === 'function') {
      state._autoSyncTimer = setInterval(runSilentSync, 10 * 60 * 1000);
      if (state._autoSyncTimer && typeof state._autoSyncTimer.unref === 'function') {
        state._autoSyncTimer.unref();
      }
    }
  }

  function setAuthUser(u) {
    var prevUid = state.authUser && state.authUser.uid ? state.authUser.uid : '';
    var nextUid = u && u.uid ? u.uid : '';
    state.authUser = u || null;

    if (prevUid !== nextUid) {
      stopBackgroundAutoSync();
      clearAllHangulBridges();
      resetSensitiveUiState();
      closeReader();
    }

    if (u && u.uid) {
      var me = (global.PuWhoami && global.PuWhoami.get && global.PuWhoami.get()) || null;
      state.userName = (me && me.name) || u.displayName || '노무사';
      var expectedUid = u.uid;
      global.PuPBoxStore.init(expectedUid).then(function () {
        if (!state.authUser || state.authUser.uid !== expectedUid) return;
        var projects = global.PuPBoxStore.getProjects();
        state.activeProjectId = projects[0] ? projects[0].id : '';
        renderAll();
        if (typeof u.getIdToken === 'function' && global.location && /^https?:$/i.test(global.location.protocol || '')) {
          startBackgroundAutoSync(expectedUid);
        }
      });
    } else {
      stopBackgroundAutoSync();
      clearAllHangulBridges();
      state.userName = '노무사';
      global.PuPBoxStore.clearMemoryOnSignOut();
      renderAll();
    }
  }

  function closeTopLayerForBack() {
    var modal = document.getElementById('pboxModalBackdrop');
    if (modal && modal.style.display === 'flex') {
      closeModal();
      return true;
    }
    if (state.readerOpen) {
      closeReader();
      return true;
    }
    var sb = document.getElementById('pboxSidePanel');
    if (sb && sb.classList.contains('mobile-open')) {
      closeMobileSidebar();
      return true;
    }
    if (state.voiceActive) {
      keepVoiceTextAndClose();
      return true;
    }
    var liveSlot = document.getElementById('pboxLiveFactReview');
    if (state.view === 'home' && liveSlot && liveSlot.innerHTML) {
      state._assistDismissedDraft = String(state.homePromptDraft || '').trim();
      liveSlot.innerHTML = '';
      var homeTa = document.getElementById('pboxPromptInput');
      if (homeTa && typeof homeTa.focus === 'function') homeTa.focus();
      return true;
    }
    return false;
  }

  global.PuPBoxApp = {
    mount: mount,
    setAuthUser: setAuthUser,
    closeTopLayerForBack: closeTopLayerForBack,
    switchView: switchView,
    applyTheme: applyTheme,
    buildProjectExportMarkdown: buildProjectExportMarkdown
  };
})(typeof window !== 'undefined' ? window : globalThis);
