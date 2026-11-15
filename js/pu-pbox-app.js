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

  var state = {
    view: 'home',            // home | workspace | alerts | laws | cases | ingest | recents | workflows | projects | tasks
    authUser: null,
    userName: '노무사',
    theme: 'light',
    sidebarCollapsed: false,
    taskSecCollapsed: false,
    hideHomeEmptyProjects: false,
    workspaceTab: 'report',  // report | clauses | editor
    promptMode: 'auto',      // auto | search | draft | review
    attached: [],            // [{ id, kind, title, caseNo, lawDir, fileName, body }]
    activeThread: null,
    activeSearchRes: null,
    aiBusy: false,
    reviewFileBusy: false,
    ingestBusy: false,
    lowerPullBusy: false,
    backupBusy: false,
    syncBusy: false,
    syncProgressText: '',

    /* 하급심(org=400202) 공식 API 핀포인트 수집 조건 */
    lowerCourtFilter: '',
    lowerPreset: 'all',
    lowerCustomQuery: '',
    lowerStatusBanner: null,

    /* 국가법령 전수함 필터·선택 */
    lawCat: 'priority',
    lawQuery: '',
    lawPageLimit: 80,
    selectedLawDirs: new Set(),

    /* 판례·심결·유권해석 필터·선택 */
    caseDocType: 'all',
    caseQuery: '',
    selectedDocIds: new Set(),

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
    readerLaw: null,
    readerLawFamily: null,
    readerArticleFilter: '',
    readerHighlightArt: '',
    readerDoc: null,

    /* 모달 접근성 포커스 복원용 */
    _modalPrevFocus: null,
    _afterProjCb: null,
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
      interp_gov: '범부처해석',
      internal_case: '수집판결문'
    };
    return map[dt] || '법률자료';
  }

  function docTypeBadgeClass(dt) {
    if (dt === 'prec_sc') return 'pbox-badge-blue';
    if (dt === 'prec_lower') return 'pbox-badge-green';
    if (dt === 'dec_nlrc') return 'pbox-badge-amber';
    if (dt === 'interp_moel' || dt === 'interp_gov') return 'pbox-badge-gray';
    return 'pbox-badge-blue';
  }

  function formatSimpleMd(md) {
    var lines = String(md || '').split('\n');
    var html = [];
    for (var i = 0; i < lines.length; i++) {
      var ln = esc(lines[i]);
      ln = ln.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      ln = ln.replace(/`([^`]+)`/g, '<code class="pbox-inline-code">$1</code>');
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

  /* ── 뷰 전환 및 앱바 화면 기억 ── */
  function switchView(nextView) {
    if (state.view !== nextView) {
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

  function openLawInReader(dir, fileName, highlightArt) {
    if (!dir) return;
    var idxList = global.PuPBoxLawIndex ? global.PuPBoxLawIndex.list() : [];
    var fam = idxList.find(function (f) { return f.dir === dir; }) || null;
    var targetFile = fileName || (fam ? fam.primaryFile : '법률.md');

    state.readerOpen = true;
    state.readerKind = 'law';
    state.readerLawFamily = fam;
    state.readerLaw = null;
    state.readerHighlightArt = highlightArt || '';
    state.readerArticleFilter = '';
    renderReader();

    global.PuPBoxStore.fetchLaw(dir, targetFile).then(function (parsed) {
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
      if (state.view === 'home' || state.view === 'recents') renderMain();
      renderSidebarRecents();
      if (highlightArt) {
        setTimeout(function () {
          var el = document.getElementById('pboxArt_' + highlightArt.replace(/[^0-9가-힣]/g, ''));
          if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 60);
      }
    }).catch(function (err) {
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

  /* ── 파일 내보내기 유틸리티 (.md / .doc) ── */
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
    if (last && ['home', 'workspace', 'alerts', 'laws', 'cases', 'ingest', 'recents', 'workflows', 'projects', 'tasks'].indexOf(last) >= 0) {
      state.view = last;
    }

    rootEl.innerHTML = [
      '<div class="pbox-shell">',
      '  <aside id="pboxSidePanel" class="pbox-sidebar" aria-label="P박스 메뉴">',
      '    <div class="pbox-brand-row">',
      '      <div class="pbox-brand-title" role="button" tabindex="0" data-act="go-view" data-view="home" aria-label="P박스 홈으로 이동">',
      '        <span class="pbox-brand-mark" aria-hidden="true">P</span>',
      '        <span class="pbox-brand-main">P박스 <span class="pbox-brand-subbadge">무료 통합</span></span>',
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
      '          <div id="pboxStorageBadge" class="pbox-plan-sub">스탠다드 · ₩0 무제한</div>',
      '        </div>',
      '        <span class="pbox-cert-pill">✓ 공인노무사</span>',
      '      </div>',
      '    </div>',
      '    <nav id="pboxNavList" class="pbox-nav-list" aria-label="주요 기능 탐색">',
      '      <button type="button" class="pbox-nav-btn" data-act="go-view" data-view="home"><span aria-hidden="true">🏠</span><span>홈</span></button>',
      '      <button type="button" class="pbox-nav-btn" data-act="go-view" data-view="alerts"><span aria-hidden="true">🔔</span><span>알림</span><span id="pboxAlertCnt" class="pbox-nav-cnt alert">0</span></button>',
      '      <div class="pbox-nav-divider" role="separator"></div>',
      '      <div class="pbox-nav-sep">주석 · 법령 · 판례 DB</div>',
      '      <button type="button" class="pbox-nav-btn" data-act="go-view" data-view="laws"><span aria-hidden="true">📖</span><span>주석·법령전수함</span><span id="pboxLawCnt" class="pbox-nav-cnt">5,773</span></button>',
      '      <button type="button" class="pbox-nav-btn" data-act="go-view" data-view="cases"><span aria-hidden="true">⚖️</span><span>판례·결정·유권해석</span><span id="pboxCaseCnt" class="pbox-nav-cnt">0</span></button>',
      '      <button type="button" class="pbox-nav-btn" data-act="go-view" data-view="ingest"><span aria-hidden="true">📥</span><span>하급심·판결 수집</span></button>',
      '      <div class="pbox-nav-divider" role="separator"></div>',
      '      <button type="button" class="pbox-nav-btn" data-act="go-view" data-view="recents"><span aria-hidden="true">🕘</span><span>최근 본 자료</span></button>',
      '      <button type="button" class="pbox-nav-btn" data-act="go-view" data-view="workflows"><span aria-hidden="true">▷</span><span>워크플로</span></button>',
      '      <div class="pbox-side-proj-row">',
      '        <button type="button" class="pbox-nav-btn" data-act="go-view" data-view="projects"><span aria-hidden="true">📁</span><span>프로젝트</span><span id="pboxProjCnt" class="pbox-nav-cnt">0</span></button>',
      '        <button type="button" class="pbox-side-newproj-btn" data-act="create-project-prompt" aria-label="새 프로젝트 만들기">+ 새 프로젝트</button>',
      '      </div>',
      '    </nav>',
      '    <div class="pbox-history-box">',
      '      <div class="pbox-history-hd-row">',
      '        <span class="pbox-history-hd"><span aria-hidden="true">✦</span> 작업</span>',
      '        <div class="pbox-btn-group">',
      '          <button type="button" class="pbox-link-btn" data-act="go-view" data-view="tasks">관리</button>',
      '          <button type="button" id="pboxTaskSecToggle" class="pbox-icon-btn" data-act="toggle-task-sec" aria-label="작업 목록 접기 또는 펼치기">—</button>',
      '        </div>',
      '      </div>',
      '      <div id="pboxSideHistory" class="pbox-history-list"></div>',
      '    </div>',
      '    <div class="pbox-side-foot">',
      '      <button type="button" class="pbox-foot-btn" data-act="open-cfg-modal">⚙ 자동동기화 · 무료 DB 설정</button>',
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
      '        <span id="pboxTopTitle" class="pbox-top-title">ⓘ [안내] 새로워진 내용 검토 · 문서 작성 모드 — 전 법령 5,773편 · 판례 원문 대조 활성</span>',
      '      </div>',
      '      <div class="pbox-topbar-right">',
      '        <span id="pboxSyncStatus" class="pbox-sync-pill">국가법령 상시연결</span>',
      '        <button type="button" id="pboxTopSyncBtn" class="pbox-btn-sm" data-act="quick-sync">🔄 자동점검</button>',
      '        <button type="button" class="pbox-btn-sm" data-act="open-attach-modal">@ 원문첨부</button>',
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
      home: 'ⓘ [안내] 새로워진 내용 검토 · 문서 작성 모드 — 국가 전 법령 5,773편 · 판례 원문 대조 활성',
      workspace: '✦ 내용 검토 · 문서 작성 워크스페이스 (우측 원문 대조)',
      alerts: '법령·판례 개정 및 자동수집 알림',
      laws: '주석 · 대한민국 국가법령 전수함 (법률·시행령·시행규칙)',
      cases: '판례 · 위원회 결정례 · 부처 유권해석 통합검색',
      ingest: '지방법원·행정법원 하급심 판례 및 결정서 비식별 수집함',
      recents: '최근 본 법령 · 판례 · 결정례 · 유권해석 관리',
      workflows: '공인노무사 워크플로 라이브러리',
      projects: '의뢰인 · 사건별 프로젝트 보관함',
      tasks: '✦ 작업 이력 및 내용 검토 문서 관리'
    };
    var topT = document.getElementById('pboxTopTitle');
    if (topT) topT.textContent = titles[state.view] || 'P박스';

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
    var elLaw = document.getElementById('pboxLawCnt');
    var elCase = document.getElementById('pboxCaseCnt');
    var elProj = document.getElementById('pboxProjCnt');
    var elBadge = document.getElementById('pboxStorageBadge');
    var elSync = document.getElementById('pboxSyncStatus');
    var topSyncBtn = document.getElementById('pboxTopSyncBtn');

    if (elAlert) elAlert.textContent = String(sum.alertsCount);
    if (elLaw) elLaw.textContent = sum.totalNationalLaws.toLocaleString();
    if (elCase) elCase.textContent = String(sum.docsCount);
    if (elProj) elProj.textContent = String(sum.projectsCount);
    if (topSyncBtn) topSyncBtn.disabled = !!state.syncBusy;

    if (elBadge) {
      elBadge.textContent = sum.supabaseConnected
        ? ('공유플랜 · 보관법령 ' + sum.cachedLawsCount + '편')
        : ('스탠다드 · ₩0 무제한');
    }
    if (elSync) {
      elSync.textContent = state.syncBusy
        ? (state.syncProgressText || '동기화 진행 중…')
        : ('전 법령 ' + sum.totalNationalLaws.toLocaleString() + '편 연결됨');
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
      box.innerHTML = '<div class="pbox-empty-mini">내용 검토 · 문서 작성 · 검색 작업이 이곳에 기록됩니다.</div>';
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
    else if (state.view === 'ingest') area.innerHTML = buildIngestHtml();
    else if (state.view === 'recents') area.innerHTML = buildRecentsHtml();
    else if (state.view === 'workflows') area.innerHTML = buildWorkflowsHtml();
    else if (state.view === 'projects') area.innerHTML = buildProjectsHtml();
    else if (state.view === 'tasks') area.innerHTML = buildTasksHtml();
  }

  /* ── 1) 홈 화면 (엘박스 동일 레이아웃: 중앙 인사말 · 라운드 컴포저 · 3종 시작 단추 · 최근 본 자료 · 최근 본 프로젝트) ── */
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
      { id: 'search', label: '🔍 검색' },
      { id: 'review', label: '✦ 내용검토' },
      { id: 'draft', label: '✎ 문서작성' }
    ];

    var sendDisabled = (state.aiBusy || state.reviewFileBusy) ? ' disabled aria-busy="true"' : '';

    var defaultRecentsHtml = [
      '<div class="pbox-lbox-recent-line" role="button" tabindex="0" data-act="open-doc" data-id="prec-lower-seouladm-sanjae-lumbar">' +
        '<div class="pbox-lbox-recent-left"><span class="pbox-lbox-recent-title">서울행정법원 2019구단62415 판결 (추간판탈출증 산재)</span><span class="pbox-lbox-recent-kind">· 판례</span></div>' +
        '<span class="pbox-lbox-recent-age">오늘</span>' +
      '</div>',
      '<div class="pbox-lbox-recent-line" role="button" tabindex="0" data-act="open-doc" data-id="prec-sc-2020da247190">' +
        '<div class="pbox-lbox-recent-left"><span class="pbox-lbox-recent-title">대법원 2024. 12. 19. 선고 2020다247190 전원합의체 판결</span><span class="pbox-lbox-recent-kind">· 판례</span></div>' +
        '<span class="pbox-lbox-recent-age">오늘</span>' +
      '</div>',
      '<div class="pbox-lbox-recent-line" role="button" tabindex="0" data-act="open-doc" data-id="dec-nlrc-probation-2024">' +
        '<div class="pbox-lbox-recent-left"><span class="pbox-lbox-recent-title">중앙노동위원회 수습근로자 본채용 거부 부당해고 구제 재심판정</span><span class="pbox-lbox-recent-kind">· 결정례</span></div>' +
        '<span class="pbox-lbox-recent-age">어제</span>' +
      '</div>',
      '<div class="pbox-lbox-recent-line" role="button" tabindex="0" data-act="open-doc" data-id="interp-moel-2025-ordinary">' +
        '<div class="pbox-lbox-recent-left"><span class="pbox-lbox-recent-title">고용노동부 임금근로시간과-2271 통상임금 판단 지침</span><span class="pbox-lbox-recent-kind">· 유권해석</span></div>' +
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
            '<span class="pbox-lbox-recent-title">📁 ' + esc(p.name) + (p.clientName ? ' (' + esc(p.clientName) + ')' : '') + '</span>' +
            '<span class="pbox-lbox-recent-kind">· 자료 ' + totalItems + '건</span>' +
          '</div>' +
          '<span class="pbox-lbox-recent-age">' + esc(formatRelativeDay(p.updatedAt)) + '</span>' +
        '</div>';
      }).join('') + '</div>';
    } else if (!state.hideHomeEmptyProjects) {
      projBodyHtml = [
        '<div class="pbox-lbox-empty-proj">',
        '  <div aria-hidden="true" style="font-size:22px">📁</div>',
        '  <div class="pbox-lbox-empty-msg">최근 본 프로젝트가 없습니다.</div>',
        '  <div class="pbox-btn-group" style="justify-content:center">',
        '    <button type="button" class="pbox-btn-sm" data-act="toggle-hide-home-proj">숨기기</button>',
        '    <button type="button" class="pbox-btn-sm" data-act="go-view" data-view="projects">프로젝트로 이동</button>',
        '  </div>',
        '</div>'
      ].join('\n');
    }

    return [
      '<div class="pbox-home-wrap">',
      '  <h1 class="pbox-hero-greeting">' + esc(state.userName) + '님, 어떤 업무를 시작할까요?</h1>',
      '  <div class="pbox-composer-card">',
      (chipsHtml ? ('    <div class="pbox-att-row">' + chipsHtml + '</div>') : ''),
      '    <textarea id="pboxPromptInput" class="pbox-composer-ta" rows="3" aria-label="법률 질문 및 검토 내용 입력" placeholder="내용 입력 (@ 입력 시 자료 첨부)"></textarea>',
      '    <div class="pbox-composer-bar">',
      '      <div class="pbox-composer-left">',
      '        <button type="button" class="pbox-plus-btn" data-act="open-attach-modal" title="법령·판례·결정례 원문 첨부 (@)" aria-label="자료 첨부 (@)">＋</button>',
      '      </div>',
      '      <div class="pbox-composer-right">',
      '        <div class="pbox-mode-seg" role="group" aria-label="작업 모드 선택">',
      modes.map(function (m) {
        var isAct = state.promptMode === m.id;
        return '<button type="button" class="pbox-mode-btn' + (isAct ? ' active' : '') + '" aria-pressed="' + (isAct ? 'true' : 'false') + '" data-act="set-mode" data-mode="' + m.id + '">' + esc(m.label) + '</button>';
      }).join(''),
      '        </div>',
      '        <button type="button" id="pboxSendBtn" class="pbox-send-btn" data-act="submit-prompt"' + sendDisabled + ' aria-label="질의 또는 내용 검토 실행" title="실행">' + (state.aiBusy ? '…' : '↑') + '</button>',
      '      </div>',
      '    </div>',
      '  </div>',
      '  <div class="pbox-composer-subbar">',
      '    <span>ⓘ AI 내용 검토 · 조항별 위험진단 · 원문 인용검증을 무료 무제한 사용할 수 있습니다.</span>',
      '    <button type="button" class="pbox-link-btn" data-act="open-pureun-roadmap">관리방식 · 사용 확인</button>',
      '  </div>',
      '  <div class="pbox-quick-actions">',
      '    <button type="button" class="pbox-qa-pill" data-act="start-new-doc"' + sendDisabled + '>📄 새 문서로 시작</button>',
      '    <button type="button" class="pbox-qa-pill" data-act="open-review-file"' + sendDisabled + '>' + (state.reviewFileBusy ? '⏳ 문서 읽는 중…' : '📂 문서 열기') + '</button>',
      '    <input type="file" id="pboxReviewFileInput" accept=".pdf,.txt,.md,.json" style="display:none" aria-label="내용 검토할 문서 파일 선택">',
      '    <button type="button" class="pbox-qa-pill" data-act="go-view" data-view="workflows">🗂 워크플로 라이브러리</button>',
      '  </div>',
      '  <section class="pbox-lbox-sec" aria-label="최근 본 자료">',
      '    <div class="pbox-lbox-sec-hd"><span>🕘 최근 본 자료</span><button type="button" class="pbox-link-btn" data-act="go-view" data-view="recents">전체보기</button></div>',
      '    <div class="pbox-lbox-recent-list">' + recentLinesHtml + '</div>',
      '  </section>',
      '  <section class="pbox-lbox-sec" aria-label="최근 본 프로젝트">',
      '    <div class="pbox-lbox-sec-hd"><span>📁 최근 본 프로젝트</span>' +
        (state.hideHomeEmptyProjects && !projects.length
          ? '<button type="button" class="pbox-link-btn" data-act="toggle-hide-home-proj">다시 표시</button>'
          : '<button type="button" class="pbox-link-btn" data-act="go-view" data-view="projects">프로젝트 관리</button>') +
      '    </div>',
      projBodyHtml,
      '  </section>',
      '</div>'
    ].join('\n');
  }

  /* ── 1-B) 엘박스형 내용 검토 · 문서 작성 통합 워크스페이스 (workspace 뷰) ── */
  function buildWorkspaceHtml() {
    if (state.aiBusy && !state.activeThread) {
      return '<div class="pbox-ws-wrap"><div class="pbox-card" role="status" aria-live="polite"><div class="pbox-loading-line">⏳ 문서 조항 및 검증된 법령·판례·행정해석 원문을 대조하여 검토서를 작성하고 있습니다…</div></div></div>';
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

    var modeInfo = threadModeBadge(th.mode);
    var diag = global.PuPBoxEngine.analyzeDocumentClauses(th.sourceText || th.query || '');
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

    var busyAttr = state.aiBusy ? ' disabled aria-busy="true"' : '';
    var tabBodyHtml = '';

    if (state.workspaceTab === 'clauses') {
      tabBodyHtml = [
        '<div class="pbox-sec-hd">',
        '  <span>⚖️ 조항별 강행법규 위반 · 위험 진단 (고위험 <b>' + diag.highCount + '</b>건 · 주의 <b>' + diag.warnCount + '</b>건 / 분석 단위 ' + diag.clauseCount + '개)</span>',
        '  <button type="button" class="pbox-btn-sm" data-act="set-ws-tab" data-tab="editor">✎ 원문 수정하러 가기</button>',
        '</div>',
        (diag.findings.length ? '<div class="pbox-clause-list">' + diag.findings.map(function (f, idx) {
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
        }).join('') + '</div>' : [
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
        '    <button type="button" class="pbox-btn-primary" data-act="run-ws-quick-review" data-q="위 문서의 강행법규 위반 여부, 조항별 위험도, 관련 대법원·하급심 판례 및 적법 수정문안을 종합 검토해 주세요."' + busyAttr + '>✦ 이 문서 전체 내용 검토 실행</button>',
        '  </div>',
        '</div>'
      ].join('\n');
    } else {
      tabBodyHtml = [
        (state.aiBusy ? '<div class="pbox-info-note" role="status" aria-live="polite">⏳ 요청하신 내용 검토·수정 사항을 법령·판례 원문과 대조하여 반영하고 있습니다…</div>' : ''),
        (th.answer ? [
          '<div class="pbox-card pbox-flat-m">',
          '  <div class="pbox-cite-bar">',
          '    <span class="pbox-cite-summary">기계적 원문 인용 검증: 원문확인 <b>' + vf.verifiedCount + '</b>건 · 미확인/미보유 <b>' + vf.unverifiedCount + '</b>건 <span class="pbox-muted">(' + esc(th.engineLabel || 'P박스 검토 엔진') + ')</span></span>',
          '    <div class="pbox-cite-chips">' + (vfBadges || '<span class="pbox-muted">인용 배지를 누르면 오른쪽 분할창에 해당 법령 조문·판례 전문이 즉시 열립니다.</span>') + '</div>',
          '  </div>',
          '  <div class="pbox-md-body">' + formatSimpleMd(th.answer) + '</div>',
          '</div>'
        ].join('\n') : [
          '<div class="pbox-card pbox-empty-box">',
          '  아직 생성된 검토 의견서·서면 초안이 없습니다. [검토 대상 원문 · 편집] 탭에 문서를 넣거나 아래 지시창으로 바로 시작하세요.<br>',
          '  <div class="pbox-btn-group" style="justify-content:center;margin-top:10px">',
          '    <button type="button" class="pbox-btn-sm" data-act="set-ws-tab" data-tab="editor">✎ 원문 입력 탭 열기</button>',
          '    <button type="button" class="pbox-btn-primary" data-act="run-ws-quick-review" data-q="입력된 문서의 강행법규 위반 여부와 적법 수정문안을 검토해 주세요."' + busyAttr + '>✦ AI 내용 검토 실행</button>',
          '  </div>',
          '</div>'
        ].join('\n')),
        '<div class="pbox-btn-group" style="margin-top:12px">',
        '  <button type="button" class="pbox-btn-sm" data-act="run-ws-quick-review" data-q="강행법규 위반 및 근로감독 지적 위험조항을 빠짐없이 다시 점검해 줘"' + busyAttr + '>⚖️ 강행규정·위험조항 점검</button>',
        '  <button type="button" class="pbox-btn-sm" data-act="run-ws-quick-review" data-q="관련 대법원 전원합의체 및 행정·지방법원 하급심 유사 판례 법리를 보강해 줘"' + busyAttr + '>🏛️ 유사 판례·해석 보강</button>',
        '  <button type="button" class="pbox-btn-sm" data-act="run-ws-quick-review" data-q="문제가 된 조항들을 적법한 표준 대체 조항 문안으로 다시 작성해 줘"' + busyAttr + '>✏️ 적법 수정조항 작성</button>',
        '  <button type="button" class="pbox-btn-sm" data-act="run-ws-quick-review" data-q="의뢰인(사업주 또는 근로자)에게 바로 보낼 수 있도록 핵심 결론 중심으로 요약해 줘"' + busyAttr + '>📋 의뢰인 보고용 요약</button>',
        '</div>',
        '<div class="pbox-ws-follow-bar">',
        '  <input type="text" id="pboxWsFollowInput" class="pbox-input" aria-label="후속 검토 지시 또는 서면 수정 요청" placeholder="이 작업에서 이어서 검토·보완할 지시를 입력하세요 (@ 입력 시 법령·판례 추가 첨부)">',
        '  <button type="button" class="pbox-btn-primary" data-act="submit-ws-followup"' + busyAttr + '>↑ 후속 반영</button>',
        '</div>'
      ].join('\n');
    }

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
      '      <button type="button" class="pbox-btn-sm" data-act="copy-thread">📋 복사</button>',
      '      <button type="button" class="pbox-btn-sm" data-act="export-thread-md">📝 MD 저장</button>',
      '      <button type="button" class="pbox-btn-sm" data-act="export-thread-doc">📄 Word(.doc)</button>',
      '      <button type="button" class="pbox-btn-primary" data-act="save-thread-proj">📁 프로젝트 담기</button>',
      '    </div>',
      '  </div>',
      '  <div class="pbox-pureun-bridge">',
      '    <span>관리방식: <b>엘박스형 내용검토 · 작업관리</b> · 추후 <b>푸른노무법인 사건·자문 방식</b>(수임단계·임금/산재 계산기·노무사 결재라인) 자동 전환 호환</span>',
      '    <button type="button" class="pbox-link-btn" data-act="open-pureun-roadmap">푸른 방식 로드맵 보기</button>',
      '  </div>',
      '  <div class="pbox-ws-tabs-bar">',
      '    <div class="pbox-ws-tabs" role="tablist" aria-label="내용 검토 워크스페이스 탭">',
      '      <button type="button" role="tab" aria-selected="' + (state.workspaceTab === 'report' ? 'true' : 'false') + '" class="pbox-ws-tab' + (state.workspaceTab === 'report' ? ' active' : '') + '" data-act="set-ws-tab" data-tab="report">✦ 검토 의견서 · 초안</button>',
      '      <button type="button" role="tab" aria-selected="' + (state.workspaceTab === 'clauses' ? 'true' : 'false') + '" class="pbox-ws-tab' + (state.workspaceTab === 'clauses' ? ' active' : '') + '" data-act="set-ws-tab" data-tab="clauses">⚖️ 조항별 위험 진단 (' + diag.findings.length + ')</button>',
      '      <button type="button" role="tab" aria-selected="' + (state.workspaceTab === 'editor' ? 'true' : 'false') + '" class="pbox-ws-tab' + (state.workspaceTab === 'editor' ? ' active' : '') + '" data-act="set-ws-tab" data-tab="editor">✎ 검토 대상 원문 · 편집</button>',
      '    </div>',
      '    <button type="button" class="pbox-btn-sm" data-act="open-attach-modal">@ 참고 법령·판례 첨부 (' + state.attached.length + '건)</button>',
      '  </div>',
      tabBodyHtml,
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
      '          <th class="col-chk"><input type="checkbox" data-act="toggle-all-recents" aria-label="최근 본 자료 전체 선택"' + (allSel ? ' checked' : '') + '></th>',
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
          '<td class="col-chk"><input type="checkbox" data-act="toggle-recent-chk" data-id="' + esc(r.id) + '" aria-label="' + esc(r.title) + ' 선택"' + chk + '></td>' +
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
      '          <th class="col-chk"><input type="checkbox" data-act="toggle-all-tasks" aria-label="작업 전체 선택"' + (allSel ? ' checked' : '') + '></th>',
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
          '<td class="col-chk"><input type="checkbox" data-act="toggle-task-chk" data-id="' + esc(th.id) + '" aria-label="' + esc(th.title || th.query) + ' 선택"' + chk + '></td>' +
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
      '        <button type="button" class="pbox-btn-sm" data-act="sync-core-pack"' + syncDisabled + '>📥 핵심 노동법 20편 내려받기</button>',
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
      '      <table class="pbox-table">',
      '        <thead><tr><th class="col-num">번호</th><th>공식 데이터 채널</th><th>제공 기관</th><th>비용·연동 상태</th><th>자동갱신 주기 · 수집 범위</th></tr></thead>',
      '        <tbody>',
      sources.map(function (s, idx) {
        return '<tr>' +
          '<td class="col-num">' + (idx + 1) + '</td>' +
          '<td class="pbox-cell-main" title="' + esc(s.name) + '"><strong>' + esc(s.name) + '</strong></td>' +
          '<td title="' + esc(s.agency) + '">' + esc(s.agency) + '</td>' +
          '<td title="' + esc(s.tier) + '"><span class="' + (s.readyByDefault ? 'pbox-badge-green' : 'pbox-badge-amber') + '">' + esc(s.tier) + '</span></td>' +
          '<td title="' + esc(s.cycle + ' / ' + s.scope) + '">' + esc(s.scope) + '</td>' +
        '</tr>';
      }).join(''),
      '        </tbody>',
      '      </table>',
      '    </div>',
      '  </div>',
      '</div>'
    ].join('\n');
  }

  /* ── 3) 국가법령 전수함 (5,773편 전수 조회·필터·일괄 오프라인 캐시) ── */
  function getFilteredLawFamilies() {
    var all = global.PuPBoxLawIndex ? global.PuPBoxLawIndex.list() : [];
    var q = state.lawQuery.trim().toLowerCase();
    var qNorm = q.replace(/\s+/g, '');
    return all.filter(function (f) {
      if (state.lawCat === 'priority' && !f.priority) return false;
      if (state.lawCat !== 'all' && state.lawCat !== 'priority' && f.cat !== state.lawCat) return false;
      if (!q) return true;
      var hay = (f.title + ' ' + f.dir + ' ' + (f.dept || '')).toLowerCase();
      return hay.indexOf(q) >= 0 || hay.replace(/\s+/g, '').indexOf(qNorm) >= 0;
    });
  }

  function buildLawsHtml() {
    var cats = global.PuPBoxCorpus.LAW_CATEGORIES || [];
    var filtered = getFilteredLawFamilies();
    var visible = filtered.slice(0, state.lawPageLimit);
    var selCnt = state.selectedLawDirs.size;
    var allVisSelected = visible.length > 0 && visible.every(function (f) { return state.selectedLawDirs.has(f.dir); });

    return [
      '<div class="pbox-page-wrap">',
      '  <div class="pbox-filter-card">',
      '    <div class="pbox-chip-bar" role="group" aria-label="법령 분야 필터">',
      cats.map(function (c) {
        var isAct = state.lawCat === c.id;
        return '<button type="button" class="pbox-cat-chip' + (isAct ? ' active' : '') + '" aria-pressed="' + (isAct ? 'true' : 'false') + '" data-act="set-law-cat" data-cat="' + c.id + '">' + esc(c.label) + '</button>';
      }).join(''),
      '    </div>',
      '    <div class="pbox-search-bar">',
      '      <input type="search" id="pboxLawSearchInput" class="pbox-input" aria-label="국가법령명 검색" value="' + esc(state.lawQuery) + '" placeholder="법령명 검색 (예: 근로기준법, 산업재해보상보험법, 중대재해, 파견, 개인정보, 세법… 5,773편 전체)">',
      '      <button type="button" class="pbox-btn-primary" data-act="run-law-filter">검색</button>',
      '      <button type="button" class="pbox-btn-sm" data-act="sync-core-pack"' + (state.syncBusy ? ' disabled' : '') + '>📥 노무 핵심 20편 일괄 보관</button>',
      '    </div>',
      '  </div>',
      (selCnt > 0 ? [
        '  <div class="pbox-bulk-bar">',
        '    <span>선택 <b>' + selCnt + '</b>개 법령군</span>',
        '    <div class="pbox-btn-group">',
        '      <button type="button" class="pbox-btn-sm" data-act="bulk-cache-laws">📥 선택 법령 오프라인 보관</button>',
        '      <button type="button" class="pbox-btn-sm" data-act="bulk-attach-laws">@ AI 질의에 첨부</button>',
        '      <button type="button" class="pbox-btn-sm" data-act="bulk-proj-laws">📁 프로젝트에 담기</button>',
        '      <button type="button" class="pbox-btn-sm" data-act="clear-law-sel">선택 해제</button>',
        '    </div>',
        '  </div>'
      ].join('\n') : ''),
      '  <div class="pbox-card pbox-list-card">',
      '    <div class="pbox-sec-hd"><span>검색 결과 <b>' + filtered.length.toLocaleString() + '</b>개 법령군 (법률·시행령·시행규칙 묶음)</span><span class="pbox-muted">법령명을 누르면 오른쪽 분할창에서 조문 전체가 열립니다</span></div>',
      '    <div class="pbox-table-wrap">',
      '      <table class="pbox-table" aria-label="국가법령 목록">',
      '        <thead><tr>',
      '          <th class="col-chk"><input type="checkbox" data-act="toggle-all-laws" aria-label="현재 화면 법령 전체 선택"' + (allVisSelected ? ' checked' : '') + '></th>',
      '          <th class="col-num">번호</th>',
      '          <th>법령명</th>',
      '          <th style="width:215px">수록 법령·시행령·시행규칙</th>',
      '          <th style="width:120px">소관부처</th>',
      '          <th style="width:105px">보관 상태</th>',
      '          <th style="width:136px">동작</th>',
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
        return '<tr>' +
          '<td class="col-chk"><input type="checkbox" data-act="toggle-law-chk" data-dir="' + esc(f.dir) + '" aria-label="' + esc(f.title) + ' 선택"' + checked + '></td>' +
          '<td class="col-num">' + (i + 1) + '</td>' +
          '<td class="pbox-row-click pbox-cell-main" role="button" tabindex="0" data-act="open-law" data-dir="' + esc(f.dir) + '" data-file="' + esc(f.primaryFile) + '" title="' + esc(f.title) + '">' +
            (f.priority ? '<span class="pbox-star" aria-label="노무 핵심 법령">★</span> ' : '') + '<strong>' + esc(f.title) + '</strong>' +
          '</td>' +
          '<td class="pbox-cell-hide-m" title="' + esc(f.files.join(', ')) + '">' + subBtns + '</td>' +
          '<td class="pbox-cell-meta" title="' + esc(f.dept || '범부처') + '">' + esc(f.dept || '범부처') + '</td>' +
          '<td class="pbox-cell-hide-m">' + (cached ? '<span class="pbox-badge-green">오프라인보관</span>' : '<span class="pbox-badge-gray">실시간열람</span>') + '</td>' +
          '<td class="pbox-cell-actions">' +
            '<button type="button" class="pbox-mini-act" data-act="open-law" data-dir="' + esc(f.dir) + '" data-file="' + esc(f.primaryFile) + '">전문</button> ' +
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

  /* ── 4) 판례 · 위원회 재결례 · 행정해석 통합 검색 ── */
  function getFilteredCasesResult() {
    var E = global.PuPBoxEngine;
    var docs = global.PuPBoxStore.getDocs();
    var loadedLaws = global.PuPBoxStore.getLoadedLaws();
    var lawIndex = global.PuPBoxLawIndex ? global.PuPBoxLawIndex.list() : [];
    return E.searchCorpus(state.caseQuery, {
      docs: docs,
      loadedLaws: loadedLaws,
      lawIndex: lawIndex,
      docType: state.caseDocType,
      limit: 200
    });
  }

  function buildCasesHtml() {
    var dtypes = global.PuPBoxCorpus.DOC_TYPES || [];
    var res = getFilteredCasesResult();
    var docs = res.docs;
    var arts = res.articles.slice(0, 4);
    var selCnt = state.selectedDocIds.size;
    var allDocsSelected = docs.length > 0 && docs.every(function (d) { return state.selectedDocIds.has(d.id); });

    return [
      '<div class="pbox-page-wrap">',
      '  <div class="pbox-filter-card">',
      '    <div class="pbox-chip-bar" role="group" aria-label="문서 종류 필터">',
      dtypes.map(function (dt) {
        var isAct = state.caseDocType === dt.id;
        return '<button type="button" class="pbox-cat-chip' + (isAct ? ' active' : '') + '" aria-pressed="' + (isAct ? 'true' : 'false') + '" data-act="set-case-type" data-dtype="' + dt.id + '">' + esc(dt.label) + '</button>';
      }).join(''),
      '    </div>',
      '    <div class="pbox-search-bar">',
      '      <input type="search" id="pboxCaseSearchInput" class="pbox-input" aria-label="판례·재결·행정해석 검색" value="' + esc(state.caseQuery) + '" placeholder="사건번호(2020다247190), 문서번호(임금근로시간과-2271), 쟁점어(통상임금, 허리디스크, 수습, DB형 중간정산, 5인미만…)">',
      '      <button type="button" class="pbox-btn-primary" data-act="run-case-filter">통합 검색</button>',
      '      <button type="button" class="pbox-btn-sm" data-act="go-view" data-view="ingest">+ 하급심·판결 추가</button>',
      '    </div>',
      '  </div>',
      (arts.length ? [
        '  <div class="pbox-matched-arts">',
        '    <div class="pbox-matched-hd">📖 함께 검색된 현행 법령 조문 (' + arts.length + '건)</div>',
        '    <div class="pbox-matched-grid">',
        arts.map(function (a) {
          return '<div class="pbox-art-hit" role="button" tabindex="0" data-act="open-law" data-dir="' + esc(a.lawDir) + '" data-file="' + esc(a.fileName) + '" data-art="' + esc(a.articleNo) + '">' +
            '<strong>' + esc(a.lawTitle + ' ' + a.articleNo + (a.heading ? '(' + a.heading + ')' : '')) + '</strong>' +
            '<span>' + esc(a.snippet) + '</span>' +
          '</div>';
        }).join(''),
        '    </div>',
        '  </div>'
      ].join('\n') : ''),
      (selCnt > 0 ? [
        '  <div class="pbox-bulk-bar">',
        '    <span>선택 <b>' + selCnt + '</b>건</span>',
        '    <div class="pbox-btn-group">',
        '      <button type="button" class="pbox-btn-sm" data-act="bulk-attach-docs">@ AI 질의에 첨부</button>',
        '      <button type="button" class="pbox-btn-sm" data-act="bulk-proj-docs">📁 프로젝트에 담기</button>',
        '      <button type="button" class="pbox-btn-sm" data-act="bulk-export-docs">📥 마크다운 내보내기</button>',
        '      <button type="button" class="pbox-btn-sm" data-act="bulk-del-docs">🗑 수집문서 삭제</button>',
        '      <button type="button" class="pbox-btn-sm" data-act="clear-doc-sel">선택 해제</button>',
        '    </div>',
        '  </div>'
      ].join('\n') : ''),
      '  <div class="pbox-card pbox-list-card">',
      '    <div class="pbox-sec-hd"><span>판례 · 심결례 · 행정해석 <b>' + docs.length + '</b>건</span><span class="pbox-muted">중복 병합된 출처 배지가 함께 표시됩니다</span></div>',
      '    <div class="pbox-table-wrap">',
      '      <table class="pbox-table" aria-label="판례 및 유권해석 목록">',
      '        <thead><tr>',
      '          <th class="col-chk"><input type="checkbox" data-act="toggle-all-docs" aria-label="검색된 문서 전체 선택"' + (allDocsSelected ? ' checked' : '') + '></th>',
      '          <th class="col-num">번호</th>',
      '          <th style="width:96px">분류</th>',
      '          <th style="width:125px">선고·회시기관</th>',
      '          <th style="width:145px">사건·문서번호</th>',
      '          <th>제목 및 핵심 요지</th>',
      '          <th style="width:96px">일자</th>',
      '          <th style="width:128px">출처·동작</th>',
      '        </tr></thead>',
      '        <tbody>',
      (docs.length ? docs.map(function (d, idx) {
        var checked = state.selectedDocIds.has(d.id) ? ' checked' : '';
        var srcCnt = (d.sources || []).length;
        return '<tr>' +
          '<td class="col-chk"><input type="checkbox" data-act="toggle-doc-chk" data-id="' + esc(d.id) + '" aria-label="' + esc(d.title) + ' 선택"' + checked + '></td>' +
          '<td class="col-num">' + (idx + 1) + '</td>' +
          '<td class="pbox-cell-hide-m"><span class="' + docTypeBadgeClass(d.docType) + '">' + esc(docTypeBadgeLabel(d.docType)) + '</span></td>' +
          '<td class="pbox-cell-hide-m" title="' + esc(d.court || d.agency) + '">' + esc(d.court || d.agency) + '</td>' +
          '<td class="pbox-mono pbox-cell-meta" title="' + esc((d.court || d.agency) + ' ' + (d.caseNo || '')) + '">' + esc(d.caseNo || d.court || d.agency || '-') + '</td>' +
          '<td class="pbox-row-click pbox-cell-main" role="button" tabindex="0" data-act="open-doc" data-id="' + esc(d.id) + '" title="' + esc(d.title + ' — ' + d.summary) + '">' +
            '<strong>' + esc(d.title) + '</strong> <span class="pbox-muted pbox-cell-sum">— ' + esc(d.summary) + '</span>' +
          '</td>' +
          '<td class="col-num pbox-cell-hide-m">' + esc(d.decisionDate || '') + '</td>' +
          '<td class="pbox-cell-actions" title="' + esc((d.sources || []).join(', ')) + '">' +
            '<button type="button" class="pbox-mini-act" data-act="open-doc" data-id="' + esc(d.id) + '">원문</button> ' +
            '<button type="button" class="pbox-mini-act" data-act="attach-doc" data-id="' + esc(d.id) + '">@첨부</button>' +
            (srcCnt > 1 ? ' <span class="pbox-badge-green" title="중복 병합 출처 ' + srcCnt + '곳">+' + srcCnt + '</span>' : '') +
          '</td>' +
        '</tr>';
      }).join('') : '<tr class="pbox-empty-row"><td colspan="8" class="pbox-empty-cell">조건에 맞는 판례·유권해석이 없습니다. 검색어를 줄이거나 하급심 수집함에서 문서를 추가해 보세요.</td></tr>'),
      '        </tbody>',
      '      </table>',
      '    </div>',
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

  function buildIngestHtml() {
    var pv = state.ingestPreview;
    var busyAttr = state.ingestBusy ? ' disabled aria-busy="true"' : '';
    var lowerBusyAttr = state.lowerPullBusy ? ' disabled aria-busy="true"' : '';
    var cfg = global.PuPBoxStore.getConfig();
    var lb = state.lowerStatusBanner;
    var lowerBannerHtml = lb
      ? ('    <div class="pbox-status-banner ' + esc(lb.kind) + '" role="' + (lb.kind === 'ok' ? 'status' : 'alert') + '">' +
         '<strong>' + esc(lb.title) + '</strong>' +
         (lb.detail ? ('<div style="margin-top:3px">' + esc(lb.detail) + '</div>') : '') +
         '</div>')
      : '';
    return [
      '<div class="pbox-page-wrap">',
      '  <div class="pbox-card pbox-flat-m" style="margin-bottom:14px">',
      '    <div class="pbox-sec-hd"><span>🏛️ 지방법원 · 행정법원 · 고등법원 하급심 공식 API 자동 수집 (org=400202)</span></div>',
      '    <div class="pbox-info-note">',
      '      법제처 공동활용 무료 <b>OC 아이디</b>(<code>open.law.go.kr</code> 가입 이메일 앞자리)를 연결하면 <b>지방법원·행정법원·고등법원 하급심 판례(<code>org=400202</code>, 본문 포함 검색)</b>와 <b>근로복지공단 산재 판례</b>를 즉시 당겨와 중복 제거 후 적재합니다.<br>',
      '      수천 건 초기 대량 적재가 필요할 때는 터미널에서 <code class="pbox-inline-code">node scripts/backfill-pbox-lowercourt.js --oc=아이디</code> 를 실행해 생성된 JSON 파일을 아래 수집함에 끌어다 놓으세요.',
      '    </div>',
      '    <div class="pbox-matched-grid" style="margin-bottom:10px">',
      '      <label class="pbox-field"><span class="pbox-label">대상 하급심 법원</span>' +
               '<select id="pboxLowerCourtSel" class="pbox-input">' +
               LOWER_COURT_OPTIONS.map(function (opt) {
                 var sel = state.lowerCourtFilter === opt.value ? ' selected' : '';
                 return '<option value="' + esc(opt.value) + '"' + sel + '>' + esc(opt.label) + '</option>';
               }).join('') +
               '</select></label>',
      '      <label class="pbox-field"><span class="pbox-label">수집 쟁점 묶음</span>' +
               '<select id="pboxLowerPresetSel" class="pbox-input">' +
               LOWER_PRESET_OPTIONS.map(function (opt) {
                 var sel = state.lowerPreset === opt.value ? ' selected' : '';
                 return '<option value="' + esc(opt.value) + '"' + sel + '>' + esc(opt.label) + '</option>';
               }).join('') +
               '</select></label>',
      '      <label class="pbox-field"><span class="pbox-label">지정 검색어 (선택 · 입력 시 해당 단어 집중 수집)</span>' +
               '<input type="text" id="pboxLowerQueryInput" class="pbox-input" value="' + esc(state.lowerCustomQuery) + '" placeholder="예: 추간판탈출증, 고라니, 포괄임금"></label>',
      '      <label class="pbox-field"><span class="pbox-label">법제처 무료 OC 아이디 (서버 미설정 시 사용)</span>' +
               '<input type="text" id="pboxLowerLawOcInput" class="pbox-input" value="' + esc(cfg.lawOc || '') + '" placeholder="open.law.go.kr 신청 이메일 앞자리"></label>',
      '    </div>',
      '    <div class="pbox-btn-group">',
      '      <button type="button" class="pbox-btn-primary" data-act="pull-lower-court"' + lowerBusyAttr + '>' + (state.lowerPullBusy ? '⏳ 하급심 판례 수집 중…' : '📥 지방법원·하급심 판례 당겨오기') + '</button>',
      '    </div>',
      lowerBannerHtml,
      '  </div>',
      '  <div class="pbox-card pbox-flat-m" style="margin-bottom:14px">',
      '    <div class="pbox-sec-hd"><span>📥 사법정보공개포털 PDF · AI-Hub/백필 JSON · 수행 사건 결정문 적재함</span></div>',
      '    <div class="pbox-info-note">',
      '      미간행 최신 지방법원 판결은 ① <b>사법정보공개포털 판결서 인터넷열람 PDF</b>, ② <b>AI-Hub 법률 말뭉치 / 초기 백필 JSON</b>, ③ <b>사무실 수행 사건 판결·판정서</b>를 아래에 끌어놓기 한 번으로 <b>주민등록번호·실명·연락처·이메일·계좌·상세호수를 자동 비식별화</b>하고 <b>3단계 중복제거</b>를 거쳐 적재합니다. <b>기본값으로 내 브라우저에만 보관</b>되며, 비식별화 확인 체크 시에만 사무실 공유 DB로 전송됩니다.',
      '    </div>',
      '    <div id="pboxDropZone" class="pbox-dropzone" role="button" tabindex="0" aria-busy="' + (state.ingestBusy ? 'true' : 'false') + '" data-act="pick-ingest-files" aria-label="판결문·결정서 파일 선택 또는 끌어놓기">',
      '      <div class="pbox-drop-icon" aria-hidden="true">' + (state.ingestBusy ? '⏳' : '📄') + '</div>',
      '      <div class="pbox-drop-title">' + (state.ingestBusy ? '파일 텍스트 추출 및 개인정보 비식별 처리 중입니다…' : '여기를 누르거나 판결문·결정서 파일(.pdf · .txt · .md · AI-Hub .json)을 끌어다 놓으세요') + '</div>',
      '      <div class="pbox-drop-sub">브라우저 안에서 즉시 텍스트를 뽑고 본문·제목·파일명의 개인정보를 가린 뒤 중복 여부를 검사합니다</div>',
      '      <input type="file" id="pboxIngestFileInput" multiple accept=".pdf,.txt,.md,.json" style="display:none" aria-label="수집할 판결문 파일 선택"' + busyAttr + '>',
      '    </div>',
      '  </div>',
      '  <div class="pbox-card pbox-flat-m">',
      '    <div class="pbox-sec-hd"><span>✍️ 판결문·유권해석 본문 직접 붙여넣기 (비식별·중복 미리보기)</span></div>',
      '    <textarea id="pboxIngestTa" class="pbox-textarea" rows="7" aria-label="수집할 판결문 본문 입력" placeholder="예: 서울행정법원 2025. 8. 14. 선고 2024구단12345 판결 [사건: 요양불승인처분취소] 원고 홍길동 (9001011234567, 연락처 010-1234-5678, 계좌번호 12345678901234) … 본문을 붙여넣고 [비식별·메타 미리보기]를 눌러 보세요.">' + esc(state.ingestRawText) + '</textarea>',
      '    <div style="margin-top:10px">',
      '      <label class="pbox-chk-line"><input type="checkbox" id="pboxShareConfirmChk"' + (state.ingestShareConfirmed ? ' checked' : '') + '> 비식별화 마스킹 결과를 직접 검토했으며, 사무실 공유 DB에도 함께 올립니다 (미체크 시 내 PC 브라우저에만 보관)</label>',
      '    </div>',
      '    <div class="pbox-btn-group" style="margin-top:10px">',
      '      <button type="button" class="pbox-btn-sm" data-act="preview-ingest"' + busyAttr + '>🔍 비식별화 · 사건번호 자동추출 미리보기</button>',
      '      <button type="button" class="pbox-btn-primary" data-act="commit-ingest"' + busyAttr + '>✅ 3단계 중복검증 후 P박스 DB 적재</button>',
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
            '<input type="checkbox" data-act="toggle-proj-chk" data-id="' + esc(p.id) + '" aria-label="' + esc(p.name) + ' 선택"' + chk + '>' +
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
    if (!rEl) return;
    if (!state.readerOpen) {
      rEl.style.display = 'none';
      rEl.innerHTML = '';
      return;
    }
    rEl.style.display = 'flex';

    if (state.readerKind === 'law') {
      var law = state.readerLaw;
      var fam = state.readerLawFamily;
      if (!law) {
        rEl.innerHTML = '<div class="pbox-reader-hd"><strong>📖 법령 원문 불러오는 중…</strong><button type="button" class="pbox-icon-btn" data-act="close-reader" aria-label="리더 닫기">✕</button></div><div class="pbox-reader-bd"><div class="pbox-loading-line">국가법령 미러에서 조문 전체를 가져오고 있습니다…</div></div>';
        return;
      }
      var effClass = (law.effectiveState && law.effectiveState.status === 'upcoming') ? 'pbox-badge-amber' : 'pbox-badge-green';
      var qArt = state.readerArticleFilter.trim().toLowerCase();
      var arts = (law.articles || []).filter(function (a) {
        if (!qArt) return true;
        return (a.no + ' ' + (a.heading || '') + ' ' + (a.text || '')).toLowerCase().indexOf(qArt) >= 0;
      });

      var siblingTabs = (fam && fam.files ? fam.files : []).filter(function (fn) {
        return !(fam.hasRepealStub && fn === '법률');
      }).map(function (fn) {
        var fullFn = fn + '.md';
        var isCur = law.fileName === fullFn;
        return '<button type="button" role="tab" aria-selected="' + (isCur ? 'true' : 'false') + '" class="pbox-tab-pill' + (isCur ? ' active' : '') + '" data-act="open-law" data-dir="' + esc(law.dir) + '" data-file="' + esc(fullFn) + '">' + esc(fn === '법률(법률)' ? '법률(현행)' : fn) + '</button>';
      }).join('');

      rEl.innerHTML = [
        '<div class="pbox-reader-hd">',
        '  <div class="pbox-reader-titlewrap">',
        '    <div class="pbox-reader-kicker"><span class="' + effClass + '">' + esc(law.effectiveState ? law.effectiveState.label : '시행법령') + '</span> <span class="pbox-muted">공포 제' + esc(law.promulgationNo || '-') + '호</span></div>',
        '    <strong class="pbox-reader-title">' + esc(law.title) + '</strong>',
        '  </div>',
        '  <div class="pbox-btn-group">',
        '    <button type="button" class="pbox-btn-sm" data-act="attach-law" data-dir="' + esc(law.dir) + '" data-file="' + esc(law.fileName) + '">@ AI 첨부</button>',
        '    <button type="button" class="pbox-icon-btn" data-act="close-reader" aria-label="리더 닫기">✕</button>',
        '  </div>',
        '</div>',
        (siblingTabs ? '<div class="pbox-reader-tabs" role="tablist" aria-label="관련 하위법령 탭">' + siblingTabs + '</div>' : ''),
        '<div class="pbox-reader-tools">',
        '  <input type="search" id="pboxReaderArtInput" class="pbox-input" aria-label="이 법령 내 조문 찾기" value="' + esc(state.readerArticleFilter) + '" placeholder="이 법령 내 조문 번호·단어 찾기 (예: 제23조, 제56조, 통상임금, 해고…)">',
        '  <span class="pbox-muted">' + arts.length + ' / ' + (law.articles || []).length + '개 조문</span>',
        '</div>',
        '<div class="pbox-reader-bd">',
        (arts.length ? arts.map(function (a) {
          var domId = 'pboxArt_' + a.no.replace(/[^0-9가-힣]/g, '');
          var hi = state.readerHighlightArt === a.no ? ' highlight' : '';
          return '<article id="' + domId + '" class="pbox-law-art' + hi + '">' +
            (a.chapter ? '<div class="pbox-art-chap">' + esc(a.chapter) + '</div>' : '') +
            '<div class="pbox-art-hd">' +
              '<strong>' + esc(a.no + (a.heading ? ' (' + a.heading + ')' : '')) + '</strong>' +
              '<button type="button" class="pbox-mini-act" data-act="copy-art" data-law="' + esc(law.title) + '" data-no="' + esc(a.no + (a.heading ? '(' + a.heading + ')' : '')) + '">조문복사</button>' +
            '</div>' +
            '<div class="pbox-art-txt">' + esc(a.text).replace(/\n/g, '<br>') + '</div>' +
          '</article>';
        }).join('') : '<div class="pbox-plain-law">' + esc(law.plainText).replace(/\n/g, '<br>') + '</div>'),
        (law.addenda ? '<details class="pbox-addenda"><summary>부칙 보기</summary><pre class="pbox-preview-pre">' + esc(law.addenda) + '</pre></details>' : ''),
        '</div>'
      ].join('\n');
      return;
    }

    if (state.readerKind === 'doc' && state.readerDoc) {
      var d = state.readerDoc;
      rEl.innerHTML = [
        '<div class="pbox-reader-hd">',
        '  <div class="pbox-reader-titlewrap">',
        '    <div class="pbox-reader-kicker"><span class="' + docTypeBadgeClass(d.docType) + '">' + esc(docTypeBadgeLabel(d.docType)) + '</span> <span class="pbox-mono">' + esc(d.caseNo || '') + '</span> · ' + esc(d.decisionDate || '') + '</div>',
        '    <strong class="pbox-reader-title">' + esc(d.title) + '</strong>',
        '  </div>',
        '  <div class="pbox-btn-group">',
        '    <button type="button" class="pbox-btn-sm" data-act="attach-doc" data-id="' + esc(d.id) + '">@ AI 첨부</button>',
        '    <button type="button" class="pbox-btn-sm" data-act="copy-doc-body" data-id="' + esc(d.id) + '">📋 전문복사</button>',
        '    <button type="button" class="pbox-icon-btn" data-act="close-reader" aria-label="리더 닫기">✕</button>',
        '  </div>',
        '</div>',
        '<div class="pbox-reader-bd">',
        '  <div class="pbox-doc-meta-box">',
        '    <div><b>기관/법원:</b> ' + esc(d.court || d.agency) + '</div>',
        '    <div><b>출처 채널:</b> ' + esc((d.sources || []).join(' · ')) + '</div>',
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

  function openModalHtml(html, keepCurrentFocus) {
    var back = document.getElementById('pboxModalBackdrop');
    var body = document.getElementById('pboxModalBox');
    if (!back || !body) return;
    if (back.style.display !== 'flex') {
      state._modalPrevFocus = document.activeElement || null;
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
    if (back) back.style.display = 'none';
    if (state._modalPrevFocus && typeof state._modalPrevFocus.focus === 'function') {
      try { state._modalPrevFocus.focus(); } catch (e) {}
    }
    state._modalPrevFocus = null;
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

  function showConfigModal() {
    var cfg = global.PuPBoxStore.getConfig();
    openModalHtml([
      '<div class="pbox-modal-hd"><strong id="pboxModalTitle">⚙ P박스 자동동기화 · 무료 공유 DB 설정</strong><button type="button" class="pbox-icon-btn" data-act="close-modal" aria-label="설정 닫기">✕</button></div>',
      '<div class="pbox-modal-bd">',
      '  <div class="pbox-info-note">',
      '    <b>현재 비용: ₩0 (완전 무료)</b> — 기본 상태에서도 5,773편 전 법령 미러와 UID 격리 IndexedDB로 모든 기능이 작동합니다.<br>',
      '    사무실 공유 DB(Supabase Free Tier $0/월)는 보안을 위해 비로그인 익명 접근을 차단하고 <b>푸른 서버 인증 대리인(pboxApi)</b> 또는 <b>직원 인증 JWT</b>로만 읽기·쓰기를 허용합니다.',
      '  </div>',
      '  <div class="pbox-form-stack">',
      '    <label class="pbox-field"><span class="pbox-label">법제처 국가법령정보 공동활용 OC 아이디 (선택 · 서버 자동수집 연동)</span><input type="text" id="pboxCfgLawOc" class="pbox-input" value="' + esc(cfg.lawOc) + '" placeholder="open.law.go.kr 신청 이메일 앞자리 ID"></label>',
      '    <label class="pbox-field"><span class="pbox-label">Supabase HTTPS Project URL (선택 · 직접 조회 시)</span><input type="url" id="pboxCfgSupaUrl" class="pbox-input" value="' + esc(cfg.supabaseUrl) + '" placeholder="https://xxxxxxxxxxxx.supabase.co"></label>',
      '    <label class="pbox-field"><span class="pbox-label">Supabase 직원 인증 JWT (선택 · 현재 로그인 세션 메모리에만 보관되며 로그아웃 시 자동 파기)</span><input type="password" id="pboxCfgSupaKey" class="pbox-input" value="' + esc(cfg.supabaseStaffJwt) + '" placeholder="인증된 직원 세션 JWT (localStorage 영구 저장 안 함)"></label>',
      '    <label class="pbox-chk-line"><input type="checkbox" id="pboxCfgAutoBoot"' + (cfg.autoSyncOnBoot ? ' checked' : '') + '> 앱을 열 때 법령 개정·수집 변경분 자동 점검</label>',
      '    <label class="pbox-chk-line"><input type="checkbox" id="pboxCfgOfflineAi"' + (cfg.preferOfflineAi ? ' checked' : '') + '> 클라우드 AI 호출 없이 100% 내장 무료 합성 모드만 사용</label>',
      '  </div>',
      '  <div class="pbox-btn-group" style="margin-top:12px">',
      '    <button type="button" class="pbox-btn-sm" data-act="test-supa-cfg">🔌 연결 시험</button>',
      '    <button type="button" class="pbox-btn-sm" data-act="backup-export-json">💾 전체 자료 JSON 백업</button>',
      '    <button type="button" id="pboxBackupImportBtn" class="pbox-btn-sm" data-act="backup-import-json"' + (state.backupBusy ? ' disabled aria-busy="true"' : '') + '>' + (state.backupBusy ? '⏳ 백업 복원 중…' : '📂 JSON 백업 복원') + '</button>',
      '    <input type="file" id="pboxBackupFileInput" accept=".json" style="display:none" aria-label="백업 JSON 파일 선택">',
      '  </div>',
      '  <div class="pbox-modal-ft">',
      '    <button type="button" class="pbox-btn-sm" data-act="close-modal">닫기</button>',
      '    <button type="button" class="pbox-btn-primary" data-act="save-cfg">설정 저장 및 동기화</button>',
      '  </div>',
      '</div>'
    ].join('\n'));
  }

  function showPureunRoadmapModal() {
    openModalHtml([
      '<div class="pbox-modal-hd"><strong id="pboxModalTitle">✦ 내용 검토 관리방식 및 푸른노무법인 전환 설계</strong><button type="button" class="pbox-icon-btn" data-act="close-modal" aria-label="창 닫기">✕</button></div>',
      '<div class="pbox-modal-bd">',
      '  <div class="pbox-info-note">',
      '    <b>1단계 (현재 운영 중 — 엘박스형 내용검토 · 문서작성 · 작업관리)</b><br>',
      '    • 홈 중앙 입력창(<code>자동</code> · <code>🔍 검색</code> · <code>✦ 내용검토</code> · <code>✎ 문서작성</code>) 및 <code>새 문서로 시작</code> · <code>문서 열기</code> 워크스페이스<br>',
      '    • 근로계약서·용역계약서·취업규칙 8대 강행법규 위반 조항 자동 진단 및 우측 법령·판례 원문 실시간 분할 대조<br>',
      '    • 좌측 <code>✦ 작업</code> 실시간 이력 보관 및 체크박스·번호 규격 일괄 관리',
      '  </div>',
      '  <div class="pbox-info-note">',
      '    <b>2단계 (추후 확장 — 푸른노무법인 전용 업무방식 <code>workflowStyle: pureun</code>)</b><br>',
      '    • 푸른포털 사건·자문사 수임코드 및 전담 공인노무사·담당자 배정 정보 자동 연동<br>',
      '    • 임금·퇴직금·연차수당 계산기 및 산재 평균임금 산정 결과를 검토서·이유서 표에 직접 삽입<br>',
      '    • [실무자 초안 → 공인노무사 법리 검수·결재 → 푸른노무법인 공식 의견서 양식 출력] 단계별 결재흐름 지원<br>',
      '    • 현재 엘박스형으로 저장된 모든 작업·초안·프로젝트는 별도 마이그레이션 없이 그대로 승계됩니다.',
      '  </div>',
      '  <div class="pbox-modal-ft">',
      '    <button type="button" class="pbox-btn-primary" data-act="close-modal">확인</button>',
      '  </div>',
      '</div>'
    ].join('\n'));
  }

  /* ══════════════════════════════════════════════════════════════
   * 이벤트 위임 처리기
   * ══════════════════════════════════════════════════════════════ */
  function getAuthObj() {
    return (typeof firebase !== 'undefined' && firebase.auth) ? firebase.auth() : null;
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
    var shareChk = document.getElementById('pboxShareConfirmChk');
    var allowShare = !!(shareChk && shareChk.checked);

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

    var effMode = opts.mode || (workflowObj ? 'draft' : state.promptMode);
    if (effMode === 'search' && !workflowObj && !opts.inWorkspace) {
      global.PuPBoxStore.saveThread({
        title: '"' + q.slice(0, 28) + '" 검색',
        query: q,
        answer: '',
        mode: 'search',
        engineLabel: '통합검색',
        workflowStyle: 'lbox'
      });
      state.caseQuery = q;
      switchView('cases');
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

    global.PuPBoxStore.askLegalAi({
      query: q,
      mode: effMode,
      workflow: workflowObj || null,
      attached: state.attached,
      sourceText: srcTxt,
      sourceFileName: opts.sourceFileName || (opts.inWorkspace && state.activeThread ? state.activeThread.sourceFileName : ''),
      customTitle: opts.customTitle || '',
      threadId: opts.threadId || '',
      workflowStyle: 'lbox',
      auth: getAuthObj(),
      manual: true
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
    } else if (act === 'open-pureun-roadmap') {
      showPureunRoadmapModal();
    } else if (act === 'start-new-doc') {
      var blankTh = global.PuPBoxStore.saveThread({
        title: '새 문서 · 내용 검토',
        query: '',
        answer: '',
        mode: 'review',
        sourceText: '',
        workflowStyle: 'lbox'
      });
      state.activeThread = blankTh;
      state.workspaceTab = 'editor';
      switchView('workspace');
    } else if (act === 'open-review-file') {
      var rf = document.getElementById('pboxReviewFileInput');
      if (rf && (!ev || ev.target !== rf)) rf.click();
    } else if (act === 'set-ws-tab') {
      syncWorkspaceEditorDraftIfPresent();
      state.workspaceTab = btn.getAttribute('data-tab') || 'report';
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
      state.promptMode = btn.getAttribute('data-mode') || 'auto';
      renderMain();
    } else if (act === 'use-sample') {
      var sq = btn.getAttribute('data-q') || '';
      var ta = document.getElementById('pboxPromptInput');
      if (ta) ta.value = sq;
      runPromptSubmit(sq, null);
    } else if (act === 'submit-prompt') {
      runPromptSubmit();
    } else if (act === 'rm-att') {
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
      toast('노무·산재 핵심 법령 20편 전문을 내려받습니다…');
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
      state.caseDocType = btn.getAttribute('data-dtype') || 'all';
      renderMain();
    } else if (act === 'run-case-filter') {
      var ci = document.getElementById('pboxCaseSearchInput');
      if (ci) state.caseQuery = ci.value;
      renderMain();
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
      var schk2 = document.getElementById('pboxShareConfirmChk');
      var raw2 = ita2 ? ita2.value : state.ingestRawText;
      var allowShare2 = !!(schk2 && schk2.checked);
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
        var docSrc = state.activeThread.answer || state.activeThread.sourceText || '';
        var wordHtml = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + esc(state.activeThread.title) + '</title></head><body style="font-family:Malgun Gothic,sans-serif;line-height:1.7">' + formatSimpleMd(docSrc) + '</body></html>';
        downloadBlob('pbox-opinion.doc', wordHtml, 'application/msword;charset=utf-8');
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
    } else if (act === 'test-supa-cfg') {
      var uVal = (document.getElementById('pboxCfgSupaUrl') || {}).value || '';
      var kVal = (document.getElementById('pboxCfgSupaKey') || {}).value || '';
      global.PuPBoxStore.testSupabaseConnection({ supabaseUrl: uVal.trim(), supabaseStaffJwt: kVal.trim() })
        .then(function () { toast('✓ Supabase 직원 인증 연결 성공!'); })
        .catch(function (e) { toast(e.message, 'err'); });
    } else if (act === 'save-cfg') {
      global.PuPBoxStore.saveConfig({
        supabaseUrl: (document.getElementById('pboxCfgSupaUrl') || {}).value || '',
        supabaseStaffJwt: (document.getElementById('pboxCfgSupaKey') || {}).value || '',
        lawOc: (document.getElementById('pboxCfgLawOc') || {}).value || '',
        autoSyncOnBoot: !!(document.getElementById('pboxCfgAutoBoot') || {}).checked,
        preferOfflineAi: !!(document.getElementById('pboxCfgOfflineAi') || {}).checked
      });
      closeModal();
      toast('설정이 저장되었습니다.');
      global.PuPBoxStore.runIncrementalSync({ callServer: false }).then(function () { renderAll(); });
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

  function bindDelegatedEvents() {
    if (state._eventsBound) return;
    state._eventsBound = true;

    document.addEventListener('click', function (ev) {
      var back = document.getElementById('pboxModalBackdrop');
      if (ev.target === back) {
        closeModal();
        return;
      }
      var btn = ev.target.closest('[data-act]');
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
          if (curIdx >= 0 && opts.length > 1) {
            ev.preventDefault();
            var step = (ev.key === 'ArrowDown' || ev.key === 'ArrowRight') ? 1 : -1;
            var nextOpt = opts[(curIdx + step + opts.length) % opts.length];
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

      if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey) && ev.target && ev.target.id === 'pboxPromptInput') {
        ev.preventDefault();
        runPromptSubmit();
      } else if (ev.key === 'Enter' && ev.target && ev.target.id === 'pboxWsFollowInput') {
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
      } else if (ev.key === 'Enter' && ev.target && ev.target.id === 'pboxLawSearchInput') {
        state.lawQuery = ev.target.value;
        state.lawPageLimit = 80;
        renderMain();
      } else if (ev.key === 'Enter' && ev.target && ev.target.id === 'pboxCaseSearchInput') {
        state.caseQuery = ev.target.value;
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
          showAttachModal('', false);
        }
      }
    });

    document.addEventListener('change', function (ev) {
      if (!ev.target) return;
      if (ev.target.id === 'pboxReviewFileInput') {
        handleReviewFileOpen(ev.target.files);
        ev.target.value = '';
      } else if (ev.target.id === 'pboxQuickFileInput' || ev.target.id === 'pboxIngestFileInput') {
        handleIngestFiles(ev.target.files);
        ev.target.value = '';
      } else if (ev.target.id === 'pboxShareConfirmChk') {
        state.ingestShareConfirmed = !!ev.target.checked;
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
        clearViewSelections();
        renderMain();
      });
      global.addEventListener('storage', function (ev) {
        if (ev && ev.key === 'pu_auth_logout_at' && ev.newValue) {
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
    state.aiBusy = false;
    state.reviewFileBusy = false;
    state.ingestBusy = false;
    state.lowerPullBusy = false;
    state.backupBusy = false;
    state.workspaceTab = 'report';
    state.hideHomeEmptyProjects = false;
    state.activeThread = null;
    state.activeSearchRes = null;
    state.attached = [];
    state.activeProjectId = '';
    state.lowerCourtFilter = '';
    state.lowerPreset = 'all';
    state.lowerCustomQuery = '';
    state.lowerStatusBanner = null;
    state.caseQuery = '';
    state.lawQuery = '';
    state.ingestRawText = '';
    state.ingestPreview = null;
    state.ingestShareConfirmed = false;
    state.selectedDocIds.clear();
    state.selectedLawDirs.clear();
    state.selectedProjectIds.clear();
    state.selectedRecentIds.clear();
    state.selectedTaskIds.clear();
  }

  function setAuthUser(u) {
    var prevUid = state.authUser && state.authUser.uid ? state.authUser.uid : '';
    var nextUid = u && u.uid ? u.uid : '';
    state.authUser = u || null;

    if (prevUid !== nextUid) {
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
      });
    } else {
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
