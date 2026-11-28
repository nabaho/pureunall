/* ═══════════════════════════════════════════════════════════════════════════
   법인 카카오톡 방 화면 (pu-kakaoroom.html) — 2026-11-28 자료함 신규 앱
   ───────────────────────────────────────────────────────────────────────────
   ★ 저장은 공용 온톨로지 관문(gate = PuOntologyWrite.createGateway enforce)만 사용한다.
   ★ 지우기는 _deleted 논리 삭제(tombstone)만 사용한다.
   ★ 저장 전 PuRrnMask.maskRrnInText 존재를 검사해 주민번호 지우개 없이 저장하지 않는다.
   ★ 화면 출력 문자열은 모두 esc() 를 거친다(XSS 차단).
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var FB_CONFIG = {
    apiKey: 'AIzaSyDkZz5QlKSoqMOYByp5YGeMNLNDrIghliA',
    authDomain: 'pureun-erp.firebaseapp.com',
    databaseURL: 'https://pureun-erp-default-rtdb.asia-southeast1.firebasedatabase.app',
    projectId: 'pureun-erp',
    appId: '1:936817166182:web:9bd31f70d0afdf5fca2aa7',
    messagingSenderId: '936817166182'
  };
  var MB_FN = 'https://asia-northeast3-pureun-erp.cloudfunctions.net/hanaMessageBridge';
  var IDB_NAME = 'pu-work-kakao-dl';
  var IDB_STORE = 'handles';
  var IDB_KEY = 'kakaoDl';
  var OBS_IDB = 'pu-work-obs';

  var K = window.PuKakaoRoomCore;
  var KW = window.PuKakaoWork;
  var KE = window.PuKakaoExport;
  var RM = window.PuRrnMask;

  var fbAuth = null, fbDb = null, gate = null;
  var ME = { uid: '', sid: '', name: '', admin: false };
  var ARCHIVE = {};
  var FILE_ARCHIVE = {};
  var WORK_ITEMS = {};
  var COMPANIES = {};
  var SERVER_FILES = [];
  var ROOMS = ['푸른노무법인 업무채팅방'];
  var PHONE_DEV = null;
  var TAB = 'archive';
  var ARCH_PICK = {};
  var FILE_PICK = {};
  var FILE_DEST = {};
  var STAGE = null;        /* { room, sourceKind, rawFiles, analyzed, exportMsgs, exportFiles } */
  var FOLDER_H = null;
  var LOCAL_FILES = [];
  var DIFF_ON = false;
  var PREV_MODAL_FOCUS = null;

  var RECENT_CODE_CHANGES = [
    { id: 'diff-collect', tab: 'collect', targetId: 'collectInputCard', label: '신규 · 약관 무위반 수집·안전판별', desc: 'OTP 차단 · 주민번호/계좌/비번 3중 가림 · 잡담 제외' },
    { id: 'diff-archive', tab: 'archive', targetId: 'archiveTableCard', label: '신규 · 자료함 영구보관·진행추적', desc: '원문 30일 파기 한계 해소 · 실시간 업무상태 조인' },
    { id: 'diff-files', tab: 'files', targetId: 'filesTableCard', label: '강화 · 민감 첨부 PC전용·만료 D-day', desc: '신분증/통장/급여 서버전송 차단 · 사진첩/기업정보함 연계' },
    { id: 'diff-safety', tab: 'safety', targetId: 'safetyGuideBox', label: '신규 · 계정정지 방지·법령 가이드', desc: '공식 3대 수집 경로 vs 금지 방식 한눈에 확인' }
  ];

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function toast(msg, ms) {
    var t = $('toast'); if (!t) return;
    t.textContent = String(msg || '');
    t.className = 'on';
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.className = ''; }, ms || 3800);
  }
  function isLocalPreview() {
    var h = (location && location.hostname) || '';
    return (h === '127.0.0.1' || h === 'localhost') && /[?&]preview=1\b/.test(location.search || '');
  }
  function statusBadge(st) {
    if (st === 'done') return '<span class="tag green">처리완료</span>';
    if (st === 'tracking') return '<span class="tag blue">진행추적중</span>';
    return '<span class="tag amber">접수·대기</span>';
  }
  function safetyBadge(saf, redCount) {
    if (saf === 'redacted') {
      var n = Number(redCount);
      if (!isFinite(n) || n < 1) n = 1;
      n = Math.floor(n);
      return '<span class="tag amber" title="주민번호·계좌·비밀번호 등 ' + esc(String(n)) + '곳 자동 가림 처리됨">🛡 가림 ' + esc(String(n)) + '</span>';
    }
    return '<span class="tag green" title="민감정보·OTP 없는 순수 업무 내용">✅ 안전</span>';
  }
  function hasRrnMask() {
    return !!(window.PuRrnMask && typeof window.PuRrnMask.maskRrnInText === 'function');
  }
  function maskRrnStr(s) {
    var m = window.PuRrnMask && window.PuRrnMask.maskRrnInText;
    if (typeof m !== 'function') return String(s == null ? '' : s);
    var res = m(String(s == null ? '' : s));
    return (res && typeof res === 'object') ? String(res.text == null ? '' : res.text) : String(res || '');
  }
  function checkRrnGuardUI() {
    var ok = hasRrnMask();
    var w = $('rrnGuardWarn');
    if (w) w.style.display = ok ? 'none' : 'block';
    return ok;
  }

  /* ── 최근 변경점 안내 바 & 강조 표시 ── */
  function renderDiffBar() {
    var bar = $('recent-diff-bar'); if (!bar) return;
    if (!DIFF_ON) {
      bar.style.display = 'none';
      clearDiffHighlights();
      return;
    }
    bar.style.display = 'flex';
    bar.innerHTML = '<b>✨ 이번 작업 변경점 (자료함 신규 앱)</b>' +
      RECENT_CODE_CHANGES.map(function (c) {
        return '<button type="button" class="diff-pill" data-diff-id="' + esc(c.id) + '" title="' + esc(c.desc) + '">' +
          esc(c.label) + '<span class="diff-badge">NEW</span></button>';
      }).join('') +
      '<span class="sp"></span>' +
      '<button type="button" class="sm" id="btnHideDiffBar">표시 끄기</button>';
    applyDiffHighlights();
  }
  function clearDiffHighlights() {
    [].forEach.call(document.querySelectorAll('.code-diff-box'), function (el) {
      el.classList.remove('code-diff-box');
    });
  }
  function applyDiffHighlights() {
    clearDiffHighlights();
    if (!DIFF_ON) return;
    RECENT_CODE_CHANGES.forEach(function (c) {
      var el = $(c.targetId);
      if (el) el.classList.add('code-diff-box');
    });
  }

  /* ── 서버 API 호출 (총괄관리자 전용 hanaMessageBridge) ── */
  function callBridge(action, payload) {
    if (isLocalPreview()) return mockBridge(action, payload);
    var u = fbAuth && fbAuth.currentUser;
    if (!u) return Promise.reject(new Error('로그인이 필요합니다'));
    return u.getIdToken().then(function (tok) {
      return fetch(MB_FN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tok },
        body: JSON.stringify(Object.assign({ action: action }, payload || {}))
      });
    }).then(function (r) {
      return r.json().catch(function () { return { ok: false, error: 'HTTP ' + r.status }; });
    }).then(function (j) {
      if (!j || !j.ok) throw new Error((j && j.error) || '서버가 응답하지 않았습니다');
      return j;
    });
  }

  /* ── 로컬 미리보기 전용 가상 시드 ── */
  function initPreviewSeed() {
    var now = Date.now();
    ME = { uid: 'preview-admin', sid: 'P-001', name: '미리보기 관리자', admin: true };
    COMPANIES = {
      'co_sample_1': { id: 'co_sample_1', name: '한빛제조(주)' },
      'co_sample_2': { id: 'co_sample_2', name: '푸른물류(주)' }
    };
    WORK_ITEMS = {
      'wk_sample_1': { id: 'wk_sample_1', no: '경기2026부해3347', title: '한빛제조 부당해고 구제신청 대응', status: '진행중', co_id: 'co_sample_1', company: '한빛제조(주)', mgr_main: { name: '김노무사' }, last: { d: '2026-11-27', t: '답변서 1차 초안 검토 완료' } },
      'wk_sample_2': { id: 'wk_sample_2', no: '자문-2026-019', title: '푸른물류 근로복지기금 설립 및 정관 인가', status: '대기중', co_id: 'co_sample_2', company: '푸른물류(주)', mgr_main: { name: '이노무사' }, last: { d: '2026-11-26', t: '정관 초안 송부' } }
    };
    ARCHIVE = {
      'kr_seed0001a1b2c3': {
        id: 'kr_seed0001a1b2c3', entityType: K.ENTITY_ARCHIVE, schemaVersion: 3, contractVersion: 1, revision: 1,
        createdAt: now - 86400000, updatedAt: now - 3600000, createdBy: 'P-001', updatedBy: 'P-001',
        originSystem: 'kakaotalk', originId: 'kr_seed0001a1b2c3', room: '푸른노무법인 업무채팅방', day: '2026-11-27',
        senders: ['김노무사', '박담당'], msgCount: 3, domain: 'case', safety: 'safe', redactedCount: 0,
        summary: '💬 카톡 · 김노무사·박담당 — 경기2026부해3347 답변서 제출기한 12월 4일까지 연장 신청 완료 · 📎 답변서_연장신청서.hwpx',
        caseNos: ['경기2026부해3347'], due: '2026-12-04', fileNames: ['답변서_연장신청서.hwpx'],
        matchBasis: 'sure', workItemId: 'wk_sample_1', workLogId: '', companyId: 'co_sample_1', companyLinkStatus: 'linked',
        companyHint: '한빛제조(주)', status: 'tracking', note: '심문회의 일정 확인 필요'
      },
      'kr_seed0002d4e5f6': {
        id: 'kr_seed0002d4e5f6', entityType: K.ENTITY_ARCHIVE, schemaVersion: 3, contractVersion: 1, revision: 1,
        createdAt: now - 172800000, updatedAt: now - 7200000, createdBy: 'P-001', updatedBy: 'P-001',
        originSystem: 'kakaotalk', originId: 'kr_seed0002d4e5f6', room: '푸른노무법인 업무채팅방', day: '2026-11-26',
        senders: ['이노무사'], msgCount: 2, domain: 'fund', safety: 'redacted', redactedCount: 1,
        summary: '💬 카톡 · 이노무사 — 푸른물류 근로복지기금 출연 계좌(●●●-계좌-●●●) 확인 및 정관 수정본 공유',
        caseNos: [], due: '', fileNames: [], matchBasis: 'guess', workItemId: '', workLogId: '',
        companyId: '', companyLinkStatus: 'pending', companyHint: '푸른물류(주)', status: 'open', note: ''
      }
    };
    SERVER_FILES = [
      { id: 'aabbccdd11223344', room: '푸른노무법인 업무채팅방', sender: '김노무사', name: '답변서_연장신청서.hwpx', sentAt: now - 2 * 86400000, status: 'todo', dest: 'photo' },
      { id: 'eeff001122334455', room: '푸른노무법인 업무채팅방', sender: '박담당', name: '근로자_신분증_통장사본.pdf', sentAt: now - 11 * 86400000, status: 'todo', dest: 'pc' }
    ];
    PHONE_DEV = { deviceName: '대표님 폰 (미리보기)', appVersion: '2.6.1', lastSweepAt: now - 300000, lastTalkAt: now - 300000, kakaoLastAt: now - 3600000, kakaoSeen: 12, kakaoListed: 5 };
    if (window.PuOntologyWrite) {
      gate = window.PuOntologyWrite.createGateway({ mode: 'enforce', actor: ME.sid });
    }
    DIFF_ON = true;
  }

  function mockBridge(action, payload) {
    var now = Date.now();
    if (action === 'pairStatus') return Promise.resolve({ ok: true, devices: PHONE_DEV ? [PHONE_DEV] : [] });
    if (action === 'kakaoRooms') return Promise.resolve({ ok: true, rooms: ROOMS.slice() });
    if (action === 'kakaoRoomsSet') { ROOMS = (payload.rooms || []).slice(); return Promise.resolve({ ok: true, rooms: ROOMS }); }
    if (action === 'kakaoFiles') return Promise.resolve({ ok: true, items: SERVER_FILES.slice() });
    if (action === 'kakaoFileSet') {
      var ids = payload.ids || [];
      SERVER_FILES.forEach(function (f) {
        if (ids.indexOf(f.id) >= 0) { f.status = payload.status || f.status; if (payload.dest) f.dest = payload.dest; }
      });
      return Promise.resolve({ ok: true, changed: ids.length });
    }
    if (action === 'kakaoList') {
      return Promise.resolve({
        ok: true,
        items: [
          { id: 'n_1', room: '푸른노무법인 업무채팅방', sender: '김노무사', text: '경기2026부해3347 답변서 초안 검토 부탁드립니다 12월 4일까지 제출입니다.', sentAt: now - 3600000, src: 'notify' },
          { id: 'n_2', room: '푸른노무법인 업무채팅방', sender: '이노무사', text: '네 확인했습니다', sentAt: now - 3500000, src: 'notify' },
          { id: 'n_3', room: '푸른노무법인 업무채팅방', sender: '문자알림', text: '[Web발신] 카카오 인증번호 482910 타인 노출 금지', sentAt: now - 3400000, src: 'notify' },
          { id: 'n_4', room: '푸른노무법인 업무채팅방', sender: '박담당', text: '한빛제조 담당자 홍길동 900101-1234567 계좌 110-123-456789 비번: secret1234 연락처 010-0000-0000 확인요청', sentAt: now - 3000000, src: 'notify' }
        ]
      });
    }
    if (action === 'kakaoImport') return Promise.resolve({ ok: true, fresh: (payload.lines || []).length, dup: 0, files: { fresh: 0 } });
    return Promise.resolve({ ok: true });
  }

  /* ── 데이터 변환 유틸 (PuKakaoExport.matchGroups 규격) ── */
  function buildMatchWorkList() {
    return Object.keys(WORK_ITEMS).map(function (id) {
      var it = WORK_ITEMS[id];
      if (!it || it._deleted) return null;
      var stageNos = Array.isArray(it.stageNos) ? it.stageNos : [];
      var titleNos = KE && typeof KE.extractCaseNos === 'function' ? KE.extractCaseNos(it.title) : [];
      return {
        id: id,
        no: it.no || '',
        stageNos: stageNos.concat(titleNos),
        key: String(it.company || it.coName || '').replace(/\s+/g, '').toLowerCase(),
        open: it.state !== 'done' && it.status !== '종결' && it.status !== '완료' && it.status !== 'closed'
      };
    }).filter(Boolean);
  }
  function buildMatchCompanyList() {
    var out = [], seen = {}, seenIds = {};
    Object.keys(COMPANIES).forEach(function (cid) {
      var c = COMPANIES[cid]; if (!c || c._deleted) return;
      var nm = String(c.name || c.companyName || '').trim();
      var k = nm.replace(/\s+/g, '').toLowerCase();
      if (k.length >= 3 && !seen[k]) { seen[k] = 1; seenIds[cid] = 1; out.push({ key: k, name: nm, label: nm, id: cid }); }
    });
    Object.keys(WORK_ITEMS).forEach(function (wid) {
      var it = WORK_ITEMS[wid];
      if (!it || it._deleted || !it.co_id) return;
      var cid = String(it.co_id).trim();
      var nm = String(it.company || it.coName || '').trim();
      var k = nm.replace(/\s+/g, '').toLowerCase();
      if (cid && k.length >= 3 && !seen[k] && !seenIds[cid]) {
        seen[k] = 1; seenIds[cid] = 1;
        out.push({ key: k, name: nm, label: nm, id: cid });
      }
    });
    return out;
  }

  /* ── 파이어베이스 데이터 로드 ── */
  function tryRestoreDlFolder() {
    return loadSavedHandle(IDB_NAME, IDB_STORE, IDB_KEY).then(function (h) {
      if (!h) return;
      var perm = h.queryPermission ? h.queryPermission({ mode: 'read' }) : Promise.resolve('granted');
      return perm.then(function (st) {
        if (st !== 'granted') return;
        FOLDER_H = h;
        return scanDirHandle(h);
      });
    }).catch(function () {});
  }

  function loadFirebaseData() {
    if (isLocalPreview()) {
      renderAll();
      return Promise.resolve();
    }
    var reads = [
      fbDb.ref('kakao_room/items').once('value').then(function (s) { ARCHIVE = s.val() || {}; }).catch(function () { ARCHIVE = {}; }),
      fbDb.ref('kakao_room/files').once('value').then(function (s) { FILE_ARCHIVE = s.val() || {}; }).catch(function () { FILE_ARCHIVE = {}; }),
      fbDb.ref('work_erp/items').once('value').then(function (s) { WORK_ITEMS = s.val() || {}; }).catch(function () { WORK_ITEMS = {}; }),
      fbDb.ref('data/companies').once('value').then(function (s) { COMPANIES = s.val() || {}; }).catch(function () { COMPANIES = {}; }),
      tryRestoreDlFolder()
    ];
    if (ME.admin) {
      reads.push(
        callBridge('pairStatus').then(function (j) { PHONE_DEV = KW ? KW.pickPhone(j.devices) : null; }).catch(function () { PHONE_DEV = null; }),
        callBridge('kakaoRooms').then(function (j) { ROOMS = j.rooms && j.rooms.length ? j.rooms : ROOMS; }).catch(function () {}),
        callBridge('kakaoFiles').then(function (j) { SERVER_FILES = j.items || []; }).catch(function () {})
      );
    }
    return Promise.all(reads).then(function () {
      renderAll();
    });
  }

  /* ── KPI · 탭 ── */
  function joinedArchive() {
    return K.joinWorkProgress(ARCHIVE, WORK_ITEMS, COMPANIES);
  }
  function renderKpis() {
    var rows = joinedArchive();
    var linked = rows.filter(function (r) { return !!r.workItemId; }).length;
    var unlinked = rows.length - linked;
    var activeWork = rows.filter(function (r) { return r.workLinked && r.workState !== '종결' && r.workState !== '완료'; }).length;
    var expSoon = combinedFiles().filter(function (f) { return f.status !== 'done' && KW && KW.fileLeft(f.sentAt) <= 3; }).length;
    var phoneSt = ME.admin ? (KW && PHONE_DEV ? KW.phoneDiagnosis(PHONE_DEV).level : (PHONE_DEV ? 'ok' : 'none')) : 'staff';
    var phoneLabel = phoneSt === 'ok' ? '정상 수집' : (phoneSt === 'staff' ? '관리자 연동' : (phoneSt === 'bad' ? '점검 필요' : (phoneSt === 'warn' ? '설정 확인' : '미연결')));
    var phoneCls = phoneSt === 'ok' ? 'g' : (phoneSt === 'bad' ? 'r' : 'a');

    $('kpiRow').innerHTML =
      '<div class="kpi b"><span>영구보관 업무</span><b>' + rows.length + '건</b></div>' +
      '<div class="kpi g"><span>업무 연결됨</span><b>' + linked + '건</b></div>' +
      '<div class="kpi a"><span>미연결 확인</span><b>' + unlinked + '건</b></div>' +
      '<div class="kpi b"><span>연결업무 진행중</span><b>' + activeWork + '건</b></div>' +
      '<div class="kpi ' + (expSoon ? 'r' : '') + '"><span>만료임박 파일</span><b>' + expSoon + '건</b></div>' +
      '<div class="kpi ' + phoneCls + '"><span>폰 자동수집</span><b>' + esc(phoneLabel) + '</b></div>';
  }

  function setTab(t) {
    TAB = t;
    [].forEach.call(document.querySelectorAll('#tabs button'), function (b) {
      var isOn = b.getAttribute('data-tab') === t;
      b.classList.toggle('on', isOn);
      b.setAttribute('aria-selected', isOn ? 'true' : 'false');
      b.setAttribute('tabindex', isOn ? '0' : '-1');
    });
    [].forEach.call(document.querySelectorAll('.pane'), function (p) {
      var isOn = p.id === 'p-' + t;
      p.classList.toggle('on', isOn);
      if (isOn) p.removeAttribute('hidden');
      else p.setAttribute('hidden', 'hidden');
    });
    renderAll();
  }

  /* ── 1. 현황·진행추적 탭 ── */
  function fillDomainOptions() {
    var sel = $('fDomain');
    if (!sel || sel.options.length > 1) return;
    K.DOMAINS.forEach(function (d) {
      var o = document.createElement('option');
      o.value = d.key; o.textContent = d.icon + ' ' + d.label;
      sel.appendChild(o);
    });
  }

  function filteredArchive() {
    var q = ($('qArchive') && $('qArchive').value || '').trim().toLowerCase();
    var dom = ($('fDomain') && $('fDomain').value) || '';
    var lnk = ($('fLink') && $('fLink').value) || '';
    var st = ($('fStatus') && $('fStatus').value) || '';
    return joinedArchive().filter(function (r) {
      if (dom && r.domain !== dom) return false;
      if (lnk === 'linked' && !r.workItemId) return false;
      if (lnk === 'unlinked' && r.workItemId) return false;
      if (st && r.status !== st) return false;
      if (q) {
        var hay = [r.summary, r.companyHint, r.companyLabel, r.workTitle, r.workNo, (r.caseNos || []).join(' '), (r.senders || []).join(' '), r.room, r.note].join(' ').toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
  }

  function renderArchive() {
    fillDomainOptions();
    var rows = filteredArchive();
    var selIds = Object.keys(ARCH_PICK).filter(function (id) { return ARCH_PICK[id]; });
    $('archiveSelCount').textContent = selIds.length + '건 선택';
    $('archiveSelBar').classList.toggle('on', selIds.length > 0);

    if (!rows.length) {
      $('archiveTableBox').innerHTML = '<div class="empty">보관된 비식별 카톡 업무가 없습니다. «🤖 자동수집·안전판별» 탭에서 대화를 불러와 안전 판별 후 보관해 보세요.</div>';
      return;
    }

    var allPicked = rows.length > 0 && rows.every(function (r) { return !!ARCH_PICK[r.id]; });
    var h = '<table class="t"><thead><tr>' +
      '<th class="ck"><input type="checkbox" id="archPickAll" aria-label="보이는 항목 모두 선택"' + (allPicked ? ' checked' : '') + '></th>' +
      '<th class="no">№</th>' +
      '<th class="w-day">날짜</th>' +
      '<th class="w-dom">영역</th>' +
      '<th class="w-saf">안전판별</th>' +
      '<th>비식별 업무 요약</th>' +
      '<th class="w-who">참여자</th>' +
      '<th class="w-rel">연결 업무 · 실시간 진행</th>' +
      '<th class="w-st">상태</th>' +
      '<th class="w-act">관리</th>' +
      '</tr></thead><tbody>';

    rows.forEach(function (r, idx) {
      var picked = !!ARCH_PICK[r.id];
      var relText = r.workLinked
        ? (r.workNo ? r.workNo + ' · ' : '') + r.workTitle + ' [' + r.workState + (r.workManager ? '·' + r.workManager : '') + ']'
        : (r.companyLinked ? r.companyLabel + ' (업무 미연결)' : (r.companyHint ? '힌트: ' + r.companyHint : '미연결'));
      var senders = (r.senders || []).join('·') || '-';
      h += '<tr class="' + (picked ? 'picked' : '') + '" data-arch-id="' + esc(r.id) + '">' +
        '<td class="ck"><input type="checkbox" class="arch-ck" data-id="' + esc(r.id) + '"' + (picked ? ' checked' : '') + ' aria-label="선택"></td>' +
        '<td class="no">' + (idx + 1) + '</td>' +
        '<td class="w-day" title="' + esc(r.day) + '">' + esc(r.day) + '</td>' +
        '<td class="w-dom" title="' + esc(r.domainLabel) + '"><span class="one"><span class="tag blue">' + esc(r.domainIcon + ' ' + r.domainLabel) + '</span></span></td>' +
        '<td class="w-saf">' + safetyBadge(r.safety, r.redactedCount) + '</td>' +
        '<td class="ti" title="' + esc(r.summary) + '"><button type="button" class="ttl" data-open-arch="' + esc(r.id) + '">' + esc(r.summary) + '</button></td>' +
        '<td class="w-who" title="' + esc(senders) + '">' + esc(senders) + '</td>' +
        '<td class="w-rel" title="' + esc(relText) + '">' + (r.workLinked ? '<span class="tag green">연결</span> ' : '<span class="tag">확인</span> ') + esc(relText) + '</td>' +
        '<td class="w-st">' + statusBadge(r.status) + '</td>' +
        '<td class="w-act"><button type="button" class="sm" data-open-arch="' + esc(r.id) + '">연결·상세</button></td>' +
        '</tr>';
    });
    $('archiveTableBox').innerHTML = h + '</tbody></table>';
  }

  /* ── 2. 자동수집·안전판별 탭 ── */
  function renderPhoneDiag() {
    var box = $('phoneDiagBody'); if (!box) return;
    if (!ME.admin) {
      box.innerHTML = '<div class="note" style="margin:0">폰 자동수집(하나문자 공식 알림)과 서버 원문 관리는 총괄관리자 권한으로 실행됩니다. 일반 직원은 아래 «대화 복사 붙여넣기» 또는 «현황·진행추적»을 이용해 주세요.</div>';
      if ($('btnManageRooms')) $('btnManageRooms').style.display = 'none';
      if ($('btnPullServer')) $('btnPullServer').style.display = 'none';
      return;
    }
    if ($('btnManageRooms')) $('btnManageRooms').style.display = '';
    if ($('btnPullServer')) $('btnPullServer').style.display = '';
    var d = KW ? KW.phoneDiagnosis(PHONE_DEV) : { level: 'none', title: '진단 모듈 없음', fix: '' };
    var cls = d.level === 'ok' ? 'note' : (d.level === 'bad' ? 'danger-box' : 'warn');
    box.innerHTML = '<div class="' + cls + '" style="margin:0"><b>' + esc(d.title) + '</b>' +
      (d.fix ? '<br>' + esc(d.fix) : '') +
      '<br><span class="hint">받을 등록 방(' + ROOMS.length + '곳): ' + esc(ROOMS.join(', ') || '없음') + '</span></div>';
  }

  function renderCollectPreview() {
    checkRrnGuardUI();
    renderPhoneDiag();
    var statsBox = $('safetyStatsChips');
    var drawer = $('blockedDrawer');
    var box = $('collectPreviewBox');
    var btnBoth = $('btnSaveArchiveAndWork');
    var btnArch = $('btnSaveArchiveOnly');
    var btnSrv = $('btnPushServerNotes');

    if (!STAGE || !STAGE.analyzed) {
      statsBox.innerHTML = '';
      drawer.innerHTML = '';
      btnBoth.disabled = true; btnArch.disabled = true; btnSrv.disabled = true;
      return;
    }

    var st = STAGE.analyzed.stats;
    var rows = STAGE.analyzed.rows;
    var blocked = STAGE.analyzed.blocked;
    var noise = STAGE.analyzed.noise;

    statsBox.innerHTML =
      '<div class="kpi g"><span>안전 업무</span><b>' + st.safeMessages + '줄</b></div>' +
      '<div class="kpi a"><span>민감정보 가림</span><b>' + st.redactedMessages + '줄</b></div>' +
      '<div class="kpi r"><span>OTP·보안 차단</span><b>' + st.blockedCount + '줄</b></div>' +
      '<div class="kpi"><span>잡담·시스템 제외</span><b>' + st.noiseCount + '줄</b></div>';

    var dh = '';
    if (blocked.length || noise.length) {
      dh = '<details class="warn" style="margin:0"><summary><b>자동 제외·차단 내역 보기</b> — 보안 차단 ' + blocked.length + '건 · 단순 잡담/시스템 ' + noise.length + '건 (저장 대상에서 자동 제외됨)</summary><div style="margin-top:6px;font-size:12px">';
      blocked.forEach(function (b) { dh += '<div>🚫 [' + esc(b.day) + '] ' + esc(b.sender) + ' — ' + esc(b.reason) + '</div>'; });
      noise.slice(0, 15).forEach(function (n) { dh += '<div>💬 [' + esc(n.day) + '] ' + esc(n.sender) + ' — ' + esc(n.reason) + ' (' + esc(n.text) + ')</div>'; });
      if (noise.length > 15) dh += '<div class="hint">… 외 단순 잡담 ' + (noise.length - 15) + '건</div>';
      dh += '</div></details>';
    }
    drawer.innerHTML = dh;

    if (!rows.length) {
      box.innerHTML = '<div class="empty">안전 판별을 통과한 업무 대화 묶음이 없습니다. (OTP·잡담은 자동 제외되었습니다)</div>';
      btnBoth.disabled = true; btnArch.disabled = true;
      btnSrv.disabled = !(ME.admin && STAGE.exportMsgs && STAGE.exportMsgs.length);
      return;
    }

    var canRrn = checkRrnGuardUI();
    btnBoth.disabled = !canRrn;
    btnArch.disabled = !canRrn;
    btnSrv.disabled = !(ME.admin && STAGE.exportMsgs && STAGE.exportMsgs.length && canRrn);

    var workList = buildMatchWorkList();
    var allOn = rows.length > 0 && rows.every(function (r) { return !!r.on; });
    var h = '<table class="t"><thead><tr>' +
      '<th class="ck"><input type="checkbox" id="stgPickAll" aria-label="저장할 업무 모두 선택"' + (allOn ? ' checked' : '') + '></th>' +
      '<th class="no">№</th>' +
      '<th class="w-day">날짜</th>' +
      '<th class="w-dom">업무 영역</th>' +
      '<th class="w-saf">안전판별</th>' +
      '<th>비식별 업무 요약</th>' +
      '<th class="w-rel">연결할 업무 (확정 시 체크)</th>' +
      '<th class="w-st">매칭 근거</th>' +
      '</tr></thead><tbody>';

    rows.forEach(function (r, i) {
      var basisTxt = r.m.basis === 'sure' ? '<span class="tag blue">사건번호 일치</span>'
        : (r.m.basis === 'guess' ? '<span class="tag amber">업체명 짐작</span>'
        : (r.m.basis === 'newno' ? '<span class="tag red">미등록 번호</span>' : '<span class="tag">미연결 보관</span>'));
      var selHtml = '<select class="stg-item-sel" data-idx="' + i + '" aria-label="연결 업무 선택" style="max-width:100%"><option value="">업무 연결 안 함 (자료함만 보관)</option>';
      workList.forEach(function (w) {
        var it = WORK_ITEMS[w.id] || {};
        var lbl = (it.no ? '[' + it.no + '] ' : '') + (it.title || w.id);
        selHtml += '<option value="' + esc(w.id) + '"' + (r.itemId === w.id ? ' selected' : '') + '>' + esc(lbl) + '</option>';
      });
      selHtml += '</select>';

      h += '<tr class="' + (r.on ? 'picked' : '') + '">' +
        '<td class="ck"><input type="checkbox" class="stg-ck" data-idx="' + i + '"' + (r.on ? ' checked' : '') + ' aria-label="선택"></td>' +
        '<td class="no">' + (i + 1) + '</td>' +
        '<td class="w-day">' + esc(r.day) + '</td>' +
        '<td class="w-dom"><span class="tag blue">' + esc(r.domainLabel) + '</span></td>' +
        '<td class="w-saf">' + safetyBadge(r.safety, r.redactedCount) + '</td>' +
        '<td class="ti" title="' + esc(r.d.text) + '">' + esc(r.d.text) + '</td>' +
        '<td class="w-rel">' + selHtml + '</td>' +
        '<td class="w-st">' + basisTxt + '</td>' +
        '</tr>';
    });
    box.innerHTML = h + '</tbody></table>';
  }

  function runAnalyzeOnMessages(msgs, room, meta) {
    meta = meta || {};
    var workList = buildMatchWorkList();
    var companies = buildMatchCompanyList();
    var analyzed = K.analyzeMessages(msgs, {
      room: room,
      workItems: workList,
      companies: companies,
      maskSensitive: KW ? KW.maskSensitive : null,
      maskRrn: RM ? RM.maskRrnInText : null
    });
    /* 사건번호 미연결이라도 자료함 보관 체크는 기본적으로 선택할 수 있게 하되,
       온톨로지 원칙상 업체명 짐작만으로 itemId 를 채우지 않았으므로 안전하게 체크 가능 */
    analyzed.rows.forEach(function (r) {
      if (r.m.basis === 'sure') r.on = true;
      else if (r.m.basis === 'none' || r.m.basis === 'newno') r.on = true;
      else r.on = false;   /* 짐작(guess)은 사람이 업무 선택 후 체크하도록 기본 해제 */
    });
    STAGE = {
      room: room,
      sourceKind: meta.sourceKind || 'paste',
      exportMsgs: meta.exportMsgs || null,
      exportFiles: meta.exportFiles || null,
      analyzed: analyzed
    };
    renderCollectPreview();
  }

  function pullFromServer() {
    if (!ME.admin) { toast('총괄관리자만 서버 알림을 불러올 수 있습니다'); return; }
    if (!KE || !KW) { toast('카톡 계산 모듈이 없습니다'); return; }
    Promise.all([
      callBridge('kakaoList', { days: KW.KEEP_DAYS || 30 }),
      callBridge('kakaoFiles'),
      callBridge('pairStatus').catch(function () { return { devices: [] }; })
    ]).then(function (res) {
      var notes = res[0].items || [];
      SERVER_FILES = res[1].items || [];
      if (res[2].devices) PHONE_DEV = KW.pickPhone(res[2].devices);
      var since = Date.now() - (KW.KEEP_DAYS || 30) * 86400000;
      var rooms = KE.serverRooms(notes.filter(function (x) {
        return x && Number(x.sentAt) >= since && KW.classify(x.text).kind !== 'media';
      }));
      var room = ($('collectRoomInput').value || '').trim() || (rooms[0] && rooms[0].room) || ROOMS[0] || '푸른노무법인 업무채팅방';
      $('collectRoomInput').value = room;
      var srv = KE.fromServer(notes, SERVER_FILES, {
        room: room,
        since: since,
        isMedia: function (t) { return KW.classify(t).kind === 'media'; }
      });
      var lines = KE.fromLines(srv.lines, srv.files);
      if (!lines.length) {
        STAGE = null;
        renderCollectPreview();
        toast('최근 30일 내 서버에 모인 해당 방 대화가 없습니다. .txt 내보내기나 붙여넣기를 이용하세요.');
        return;
      }
      runAnalyzeOnMessages(lines, room, { sourceKind: 'server' });
      toast('서버 수집 대화 ' + lines.length + '건을 안전 판별했습니다');
    }).catch(function (e) {
      toast('서버 조회 실패: ' + ((e && e.message) || e));
    });
  }

  function handleTxtFile(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      var text = String(reader.result || '');
      var roomHint = ($('collectRoomInput').value || '').trim();
      var parsed = null;
      if (KW && typeof KW.parseExport === 'function') {
        var allowed = ROOMS.slice();
        if (roomHint && allowed.indexOf(roomHint) < 0) allowed.push(roomHint);
        parsed = KW.parseExport(text, { fileName: file.name });
        if (parsed && parsed.ok) {
          parsed.room = roomHint || (KW.pickRoom && KW.pickRoom(allowed, parsed.rooms)) || (parsed.rooms && parsed.rooms[0]) || '';
        }
      }
      if (!parsed || !parsed.ok) {
        parsed = K.parseQuickPaste(text, roomHint);
      }
      if (!parsed || !parsed.ok) {
        toast((parsed && parsed.error) || '파일을 읽지 못했습니다');
        return;
      }
      $('collectRoomInput').value = parsed.room || roomHint || ROOMS[0] || '푸른노무법인 업무채팅방';
      var lines = KE ? KE.fromLines(parsed.messages, parsed.files) : parsed.messages;
      runAnalyzeOnMessages(lines, $('collectRoomInput').value, {
        sourceKind: 'export',
        exportMsgs: parsed.messages,
        exportFiles: parsed.files
      });
      toast('파일에서 ' + lines.length + '줄을 안전 판별했습니다');
    };
    reader.readAsText(file, 'utf-8');
  }

  function pushWorkLogIfAbsent(wp) {
    if (!wp) return Promise.resolve(false);
    if (isLocalPreview() || !gate || !fbDb) return Promise.resolve(true);
    return Promise.all([
      fbDb.ref(wp.logPath).once('value'),
      fbDb.ref(wp.itemLogPath).once('value')
    ]).then(function (snaps) {
      var tasks = [];
      if (!snaps[0].exists()) {
        tasks.push(gate.save(fbDb.ref(wp.logPath), function (prevLog) {
          if (prevLog && prevLog._deleted) return null;
          return wp.logRecord;
        }, { entityType: K.ENTITY_MESSAGE, expectedRevision: -1 }));
      }
      if (!snaps[1].exists()) {
        tasks.push(gate.save(fbDb.ref(wp.itemLogPath), function (prevItemLog) {
          if (prevItemLog && prevItemLog._deleted) return null;
          return wp.itemLogRecord;
        }, { entityType: K.ENTITY_MESSAGE, expectedRevision: -1 }));
      }
      if (!tasks.length) return false;
      return Promise.all(tasks).then(function () { return true; });
    });
  }

  function saveStageRecords(alsoWriteWorkLog) {
    if (!checkRrnGuardUI()) { toast('주민번호 지우개가 없어 저장을 중단했습니다'); return; }
    if (!STAGE || !STAGE.analyzed) return;
    var picked = STAGE.analyzed.rows.filter(function (r) { return !!r.on; });
    if (!picked.length) { toast('저장할 업무 항목을 체크해 주세요'); return; }

    var now = Date.now();
    var workWriteCount = 0;
    var skippedDeleted = 0;
    var tasks = [];
    var savedRecords = [];

    picked.forEach(function (r) {
      var itemObj = (r.itemId && WORK_ITEMS[r.itemId] && !WORK_ITEMS[r.itemId]._deleted) ? WORK_ITEMS[r.itemId] : null;
      var rawCoId = itemObj && itemObj.co_id ? String(itemObj.co_id) : '';
      var companyId = (rawCoId && (!COMPANIES[rawCoId] || !COMPANIES[rawCoId]._deleted)) ? rawCoId : '';
      var rec = K.buildArchiveRecord(r, {
        now: now,
        actor: ME.sid,
        room: STAGE.room,
        companyId: companyId,
        maskSensitive: KW ? KW.maskSensitive : null,
        maskRrn: RM ? RM.maskRrnInText : null
      });
      var prev = ARCHIVE[rec.id] || null;
      if (prev && prev._deleted) {
        skippedDeleted++;
        return;
      }
      if (prev) {
        rec.createdAt = prev.createdAt || rec.createdAt;
        rec.createdBy = prev.createdBy || rec.createdBy;
        rec.revision = Number(prev.revision || 0) + 1;
        rec.note = prev.note || rec.note;
        rec.status = prev.status || rec.status;
      }
      if (alsoWriteWorkLog && r.itemId && (!WORK_ITEMS[r.itemId] || !WORK_ITEMS[r.itemId]._deleted)) {
        var wp = K.buildWorkLogPayload(r, r.itemId, { sid: ME.sid, name: ME.name }, now);
        if (wp) {
          rec.workLogId = wp.lid;
          workWriteCount++;
          tasks.push(pushWorkLogIfAbsent(wp));
        }
      }
      savedRecords.push(rec);
      if (!isLocalPreview() && gate && fbDb) {
        tasks.push(gate.save(fbDb.ref('kakao_room/items/' + rec.id), function (serverPrev) {
          if (serverPrev && serverPrev._deleted) return null;
          return rec;
        }, {
          entityType: K.ENTITY_ARCHIVE,
          expectedRevision: prev ? Number(prev.revision || 0) : -1
        }).then(function (res) {
          var val = res && res.snapshot && typeof res.snapshot.val === 'function' ? res.snapshot.val() : null;
          if (val) rec._saved = val;
        }));
      }
    });

    if (!savedRecords.length && skippedDeleted > 0) {
      toast('이미 삭제 표시된 ' + skippedDeleted + '건은 되살리지 않고 건너뛰었습니다', 5000);
      return;
    }

    Promise.all(tasks).then(function () {
      savedRecords.forEach(function (rec) {
        ARCHIVE[rec.id] = rec._saved || rec;
        delete rec._saved;
      });
      var msg = '자료함 ' + savedRecords.length + '건 영구 보관 완료' +
        (workWriteCount ? ' (업무관리 진행기록 ' + workWriteCount + '건 동시 반영)' : '') +
        (skippedDeleted ? ' · 삭제건 ' + skippedDeleted + '건 제외' : '');
      toast(msg);
      STAGE = null;
      $('pasteInput').value = '';
      setTab('archive');
    }).catch(function (e) {
      toast('저장 실패: ' + ((e && e.message) || e), 5000);
    });
  }

  /* ── 3. 첨부자료 보관함 탭 ── */
  function matchLocalFile(name) {
    if (!LOCAL_FILES.length || !KW) return null;
    for (var i = 0; i < LOCAL_FILES.length; i++) {
      if (KW.sameFileName(name, LOCAL_FILES[i].name)) return LOCAL_FILES[i];
    }
    return null;
  }

  function combinedFiles() {
    var map = {};
    SERVER_FILES.forEach(function (f) {
      if (!f || !f.name || f._deleted) return;
      var archId = K.buildFileRecord(f, { room: f.room }).id;
      var archived = FILE_ARCHIVE[archId];
      if (archived && archived._deleted) return;
      map[archId] = Object.assign({ source: 'server' }, f, archived ? {
        status: archived.status || f.status,
        dest: archived.dest || f.dest
      } : {}, {
        id: archId,
        serverId: f.id
      });
    });
    Object.keys(FILE_ARCHIVE).forEach(function (id) {
      var f = FILE_ARCHIVE[id];
      if (!f || f._deleted) return;
      if (!map[id]) map[id] = Object.assign({ source: 'archive' }, f, { id: id });
    });
    return Object.keys(map).map(function (k) { return map[k]; })
      .sort(function (a, b) { return Number(b.sentAt || 0) - Number(a.sentAt || 0); });
  }

  function renderFiles() {
    var files = combinedFiles();
    var box = $('filesTableBox');
    var selIds = Object.keys(FILE_PICK).filter(function (id) { return FILE_PICK[id]; });
    $('filesSelCount').textContent = selIds.length + '건 선택';
    $('filesSelBar').classList.toggle('on', selIds.length > 0);
    $('folderStateHint').textContent = FOLDER_H
      ? ('폴더 연결됨 (' + LOCAL_FILES.length + '개 스캔)')
      : 'PC 카톡 받은 파일 폴더 미연결 (클릭해 연결)';

    if (!files.length) {
      box.innerHTML = '<div class="empty">등록된 카톡 첨부파일 이력이 없습니다.</div>';
      return;
    }

    var allPicked = files.length > 0 && files.every(function (f) { return !!FILE_PICK[f.id]; });
    var h = '<table class="t"><thead><tr>' +
      '<th class="ck"><input type="checkbox" id="filePickAll" aria-label="첨부파일 모두 선택"' + (allPicked ? ' checked' : '') + '></th>' +
      '<th class="no">№</th>' +
      '<th class="w-day">보낸 날</th>' +
      '<th>파일 이름</th>' +
      '<th class="w-who">보낸 사람</th>' +
      '<th class="w-saf">만료 D-day</th>' +
      '<th class="w-st">보관 위치</th>' +
      '<th class="w-rel">보낼 곳</th>' +
      '<th class="w-act">상태</th>' +
      '</tr></thead><tbody>';

    files.forEach(function (f, i) {
      var rawLeft = KW ? KW.fileLeft(f.sentAt) : 14;
      var left = isFinite(rawLeft) ? Math.floor(rawLeft) : 14;
      var sensitive = K.isSensitiveFileName(f.name);
      var defaultDest = sensitive ? 'pc' : (FILE_DEST[f.id] || f.dest || (KW ? KW.guessDest(f.name) : 'photo'));
      FILE_DEST[f.id] = defaultDest;
      var local = matchLocalFile(f.name);
      var expBadge = left < 0 ? '<span class="tag red">만료 지남</span>'
        : (left <= 3 ? '<span class="tag red">D-' + left + ' 임박</span>' : '<span class="tag blue">D-' + left + '</span>');
      var locBadge = local ? '<span class="tag green">PC 폴더 확인</span>' : '<span class="tag">PC 미확인</span>';
      var stBadge = f.status === 'done' ? '<span class="tag green">보관 완료</span>' : '<span class="tag amber">대기</span>';
      var sensBadge = sensitive ? '<span class="tag red">민감·PC전용</span> ' : '';

      var destSel = sensitive
        ? '<span class="tag red">💻 PC에만 보관 (자동고정)</span>'
        : '<select class="file-dest-sel" data-id="' + esc(f.id) + '" aria-label="보낼 곳 선택">' +
            '<option value="photo"' + (defaultDest === 'photo' ? ' selected' : '') + '>🖼️ 사진첩</option>' +
            '<option value="co"' + (defaultDest === 'co' ? ' selected' : '') + '>📑 기업정보함(계약서)</option>' +
            '<option value="pc"' + (defaultDest === 'pc' ? ' selected' : '') + '>💻 PC에만 보관</option>' +
          '</select>';

      h += '<tr class="' + (FILE_PICK[f.id] ? 'picked' : '') + '">' +
        '<td class="ck"><input type="checkbox" class="file-ck" data-id="' + esc(f.id) + '"' + (FILE_PICK[f.id] ? ' checked' : '') + ' aria-label="선택"></td>' +
        '<td class="no">' + (i + 1) + '</td>' +
        '<td class="w-day">' + esc(K.kstDay(f.sentAt)) + '</td>' +
        '<td class="ti" title="' + esc(f.name) + '">' + sensBadge + esc(f.name) + '</td>' +
        '<td class="w-who">' + esc(f.sender || '-') + '</td>' +
        '<td class="w-saf">' + expBadge + '</td>' +
        '<td class="w-st">' + locBadge + '</td>' +
        '<td class="w-rel">' + destSel + '</td>' +
        '<td class="w-act">' + stBadge + '</td>' +
        '</tr>';
    });
    box.innerHTML = h + '</tbody></table>';
  }

  function connectDlFolder() {
    if (!window.showDirectoryPicker) {
      toast('크롬 또는 엣지 브라우저에서 PC 폴더 연결을 지원합니다');
      return;
    }
    window.showDirectoryPicker({ mode: 'read' }).then(function (dir) {
      FOLDER_H = dir;
      saveHandleIdb(IDB_NAME, IDB_STORE, IDB_KEY, dir);
      return scanDirHandle(dir);
    }).then(function () {
      renderFiles();
      toast('PC 카톡 폴더에서 파일 ' + LOCAL_FILES.length + '개를 확인했습니다');
    }).catch(function (e) {
      if (e && e.name !== 'AbortError') toast('폴더 연결 실패: ' + e.message);
    });
  }

  function scanDirHandle(dir) {
    LOCAL_FILES = [];
    if (!dir || !dir.entries) return Promise.resolve();
    var iter = dir.entries();
    function step() {
      return iter.next().then(function (r) {
        if (r.done) return;
        if (r.value && r.value[1] && r.value[1].kind === 'file') {
          LOCAL_FILES.push({ name: r.value[0], h: r.value[1] });
        }
        return step();
      });
    }
    return step();
  }

  function saveHandleIdb(dbName, storeName, key, val) {
    try {
      var req = indexedDB.open(dbName, 1);
      req.onupgradeneeded = function () { if (!req.result.objectStoreNames.contains(storeName)) req.result.createObjectStore(storeName); };
      req.onsuccess = function () {
        var tx = req.result.transaction(storeName, 'readwrite');
        tx.objectStore(storeName).put(val, key);
      };
    } catch (e) {}
  }

  function loadSavedHandle(dbName, storeName, key) {
    return new Promise(function (resolve) {
      try {
        var req = indexedDB.open(dbName, 1);
        req.onupgradeneeded = function () { if (!req.result.objectStoreNames.contains(storeName)) req.result.createObjectStore(storeName); };
        req.onsuccess = function () {
          var tx = req.result.transaction(storeName, 'readonly');
          var g = tx.objectStore(storeName).get(key);
          g.onsuccess = function () { resolve(g.result || null); };
          g.onerror = function () { resolve(null); };
        };
        req.onerror = function () { resolve(null); };
      } catch (e) { resolve(null); }
    });
  }

  function sendPickedFiles(forcePcOnly) {
    var all = combinedFiles();
    var picked = all.filter(function (f) { return FILE_PICK[f.id]; });
    if (!picked.length) { toast('처리할 파일을 선택해 주세요'); return; }

    var by = { photo: [], co: [], pc: [] };
    picked.forEach(function (f) {
      var dest = (forcePcOnly || K.isSensitiveFileName(f.name)) ? 'pc' : (FILE_DEST[f.id] || f.dest || 'photo');
      by[dest].push(f);
    });
    if (by.photo.length && by.co.length) {
      toast('사진첩과 기업정보함은 팝업 차단 방지를 위해 따로 보내 주세요');
      return;
    }
    if (by.co.length > 1) {
      toast('기업정보함 계약서는 회사 확인 창이 열리므로 한 번에 1건씩 보내 주세요');
      return;
    }
    var needLocal = by.photo.concat(by.co);
    var missing = needLocal.filter(function (f) { return !matchLocalFile(f.name); });
    if (missing.length) {
      toast('PC 폴더에서 못 찾은 파일(' + missing[0].name + ')이 있습니다. 먼저 폴더를 연결해 주세요.', 5000);
      return;
    }

    var now = Date.now();
    var built = [];
    var writePromises = [];
    picked.forEach(function (f) {
      var dest = (forcePcOnly || K.isSensitiveFileName(f.name)) ? 'pc' : (FILE_DEST[f.id] || f.dest || 'photo');
      var rec = K.buildFileRecord(Object.assign({}, f, { dest: dest, status: 'done' }), { now: now, actor: ME.sid, room: f.room });
      var prev = FILE_ARCHIVE[rec.id] || null;
      if (prev && prev._deleted) return;
      if (prev) {
        rec.createdAt = prev.createdAt || rec.createdAt;
        rec.createdBy = prev.createdBy || rec.createdBy;
        rec.revision = Number(prev.revision || 0) + 1;
      }
      built.push({ f: f, rec: rec, dest: dest });
      if (!isLocalPreview() && gate && fbDb) {
        writePromises.push(gate.save(fbDb.ref('kakao_room/files/' + rec.id), function (serverPrev) {
          if (serverPrev && serverPrev._deleted) return null;
          return rec;
        }, {
          entityType: K.ENTITY_FILE,
          expectedRevision: prev ? Number(prev.revision || 0) : -1
        }).then(function (res) {
          var val = res && res.snapshot && typeof res.snapshot.val === 'function' ? res.snapshot.val() : null;
          if (val) rec._saved = val;
        }));
      }
    });

    if (!built.length) { toast('이미 삭제된 파일 항목은 건너뛰었습니다'); return; }

    var handoffChain = Promise.resolve();
    if (by.photo.length && window.PuHandoff) {
      handoffChain = Promise.all(by.photo.map(function (f) {
        var loc = matchLocalFile(f.name);
        return loc.h.getFile().then(function (file) {
          return file.arrayBuffer().then(function (buf) {
            return window.PuHandoff.put({ name: file.name, type: file.type || 'application/octet-stream', bytes: new Uint8Array(buf), from: '법인 카톡 방 · ' + f.sender });
          });
        });
      })).then(function (keys) {
        if (window.PuAppBar && window.PuAppBar.goApp) {
          window.PuAppBar.goApp('pu-photos.html?take=' + keys.map(encodeURIComponent).join(','));
        }
      });
    } else if (by.co.length && window.PuHandoff) {
      var cf = by.co[0], cloc = matchLocalFile(cf.name);
      handoffChain = cloc.h.getFile().then(function (file) {
        return file.arrayBuffer().then(function (buf) {
          return window.PuHandoff.put({ name: file.name, type: file.type || 'application/octet-stream', bytes: new Uint8Array(buf), from: '법인 카톡 방 · ' + cf.sender });
        });
      }).then(function (key) {
        if (window.PuAppBar && window.PuAppBar.goApp) {
          window.PuAppBar.goApp('pu-cards.html?take=' + encodeURIComponent(key) + '&to=co');
        }
      });
    }

    Promise.all(writePromises).then(function () {
      if (ME.admin) {
        return Promise.all(['pc', 'photo', 'co'].map(function (dKey) {
          if (!by[dKey].length) return Promise.resolve();
          return callBridge('kakaoFileSet', {
            ids: by[dKey].map(function (x) { return x.serverId || x.id; }),
            status: 'done',
            dest: dKey
          }).catch(function () {});
        }));
      }
      return null;
    }).then(function () {
      built.forEach(function (b) {
        FILE_ARCHIVE[b.rec.id] = b.rec._saved || b.rec;
        delete b.rec._saved;
        var sid = b.f.serverId || b.f.id;
        SERVER_FILES.forEach(function (sf) {
          if (sf && (sf.id === sid || sf.id === b.rec.id)) {
            sf.status = 'done';
            sf.dest = b.dest;
          }
        });
      });
      return handoffChain;
    }).then(function () {
      FILE_PICK = {};
      renderFiles();
      renderKpis();
      toast('첨부자료 ' + built.length + '건을 안전하게 처리했습니다');
    }).catch(function (e) {
      toast('처리 실패: ' + ((e && e.message) || e));
    });
  }

  /* ── 4. 업체·업무별 보기 & 옵시디언 내보내기 ── */
  function renderGroups() {
    var by = ($('groupBySel') && $('groupBySel').value) || 'work';
    var rows = joinedArchive();
    var box = $('groupsBox');
    if (!rows.length) {
      box.innerHTML = '<div class="card"><div class="empty">보관된 비식별 카톡 업무가 없습니다.</div></div>';
      return;
    }

    var buckets = {};
    rows.forEach(function (r) {
      var key = '', label = '';
      if (by === 'work') {
        key = r.workItemId || '__unlinked';
        label = r.workLinked ? ((r.workNo ? '[' + r.workNo + '] ' : '') + r.workTitle + ' (' + r.workState + ')') : '업무 미연결 (연결 확인 필요)';
      } else if (by === 'company') {
        key = r.companyId || (r.companyHint ? 'hint:' + r.companyHint : '__none');
        label = r.companyLinked ? ('🏢 ' + r.companyLabel) : (r.companyHint ? '🏢 힌트: ' + r.companyHint : '업체 미연결');
      } else if (by === 'domain') {
        key = r.domain || 'admin';
        label = r.domainIcon + ' ' + r.domainLabel;
      } else {
        key = r.room || '기본 방';
        label = '💬 ' + key;
      }
      if (!buckets[key]) buckets[key] = { label: label, items: [], workItemId: r.workItemId };
      buckets[key].items.push(r);
    });

    box.innerHTML = Object.keys(buckets).map(function (k) {
      var b = buckets[k];
      return '<div class="grp-card"><div class="grp-hd"><b>' + esc(b.label) + '</b><span class="tag blue">' + b.items.length + '건</span></div>' +
        b.items.map(function (r) {
          return '<div class="tl-row">' +
            '<span class="tag">' + esc(r.day) + '</span>' +
            safetyBadge(r.safety, r.redactedCount) +
            '<button type="button" class="ttl tl-txt" data-open-arch="' + esc(r.id) + '" title="' + esc(r.summary) + '">' + esc(r.summary) + '</button>' +
            statusBadge(r.status) +
            '</div>';
        }).join('') +
        '</div>';
    }).join('');
  }

  function exportObsidian() {
    if (!checkRrnGuardUI()) { toast('주민번호 지우개가 없어 옵시디언 내보내기를 중단했습니다'); return; }
    if (!window.showDirectoryPicker) { toast('크롬 또는 엣지 브라우저에서 옵시디언 금고 내보내기를 지원합니다'); return; }
    var rows = joinedArchive();
    if (!rows.length) { toast('내보낼 비식별 카톡 업무가 없습니다'); return; }

    var byDay = {};
    rows.forEach(function (r) {
      (byDay[r.day] = byDay[r.day] || []).push(r);
    });

    loadSavedHandle(OBS_IDB, 'handles', 'vault').then(function (h) {
      if (h) return h.requestPermission({ mode: 'readwrite' }).then(function (p) { return p === 'granted' ? h : null; }).catch(function () { return null; });
      return null;
    }).then(function (h) {
      return h || window.showDirectoryPicker({ mode: 'readwrite' });
    }).then(function (vault) {
      saveHandleIdb(OBS_IDB, 'handles', 'vault', vault);
      return vault.getDirectoryHandle('업무관리', { create: true }).then(function (r) {
        return r.getDirectoryHandle('카톡일지', { create: true });
      });
    }).then(function (dir) {
      var days = Object.keys(byDay).sort();
      return days.reduce(function (p, d) {
        return p.then(function () {
          var body = '---\n날짜: ' + d + '\n출처: 푸른 법인 카카오톡 방 (비식별 영구보관)\n---\n# ' + d + ' 법인 카톡 업무일지\n\n' +
            byDay[d].map(function (r) {
              var line = '- [' + (r.status === 'done' ? 'x' : ' ') + '] [' + r.domainLabel + '] ' + r.summary;
              if (r.workLinked) line += ' (연결업무: ' + (r.workNo || r.workTitle) + ' · ' + r.workState + ')';
              return maskRrnStr(line);
            }).join('\n') + '\n';
          return dir.getFileHandle(d + '.md', { create: true }).then(function (fh) {
            return fh.createWritable().then(function (w) { return w.write(body).then(function () { return w.close(); }); });
          });
        });
      }, Promise.resolve()).then(function () { return days.length; });
    }).then(function (n) {
      toast('옵시디언 업무관리/카톡일지에 ' + n + '일치를 내보냈습니다');
    }).catch(function (e) {
      if (e && e.name !== 'AbortError') toast('내보내기 실패: ' + e.message);
    });
  }

  /* ── 5. 안전·법령 가이드 탭 ── */
  function renderSafetyGuide() {
    var P = K.SAFETY_POLICY;
    var h = '<div class="grid-2">' +
      '<div class="card"><div class="sec">✅ 허용 수집 경로 (카카오 약관 무위반 · 계정 안전)</div>' +
      P.allowed.map(function (a) {
        return '<div class="note"><b>' + esc(a.title) + '</b><br>' + esc(a.desc) + '</div>';
      }).join('') +
      '</div>' +
      '<div class="card"><div class="sec">🚫 절대 금지 방식 (아이디 정지 · 위법 방지)</div>' +
      P.forbidden.map(function (f) {
        return '<div class="danger-box"><b>' + esc(f.title) + '</b><br>' + esc(f.reason) + '</div>';
      }).join('') +
      '</div></div>' +
      '<div class="card"><div class="sec">🛡️ 개인정보·보안 5중 보호장치 & 폰 자동수집 체크리스트</div>' +
      '<div class="grid-2"><div><ul style="margin:4px 0;padding-left:18px;line-height:1.75">' +
      P.protections.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') +
      '</ul></div><div><ol style="margin:4px 0;padding-left:18px;line-height:1.75">' +
      '<li>PC 카톡 «설정 › 알림 › 모바일 알림 설정»에서 PC 사용 중에도 폰 알림 받기 켜기</li>' +
      '<li>폰 카톡 법인 업무방 메뉴(≡) › 알림 켜기</li>' +
      '<li>폰 하나문자 앱(2.5.1 이상) 배터리 절전 예외 등록 & 알림 접근 권한 유지</li>' +
      '<li>주 1회 톡서랍 파일 받기 후 «첨부자료 보관함»으로 사진첩·기업정보함·PC 이관</li>' +
      '</ol></div></div></div>';
    $('safetyGuideBox').innerHTML = h;
  }

  /* ── 모달 (상세·연결 / 받을 방 설정) ── */
  function openArchiveModal(id) {
    var rows = joinedArchive();
    var r = null;
    for (var i = 0; i < rows.length; i++) if (rows[i].id === id) r = rows[i];
    if (!r) return;

    var workList = buildMatchWorkList();
    var coList = buildMatchCompanyList();
    var wOpts = '<option value="">연결 안 함</option>' + workList.map(function (w) {
      var it = WORK_ITEMS[w.id] || {};
      var lbl = (it.no ? '[' + it.no + '] ' : '') + (it.title || w.id);
      return '<option value="' + esc(w.id) + '"' + (r.workItemId === w.id ? ' selected' : '') + '>' + esc(lbl) + '</option>';
    }).join('');
    var cOpts = '<option value="">연결 안 함</option>' + coList.map(function (c) {
      return '<option value="' + esc(c.id) + '"' + (r.companyId === c.id ? ' selected' : '') + '>' + esc(c.label) + '</option>';
    }).join('');

    $('mbox').innerHTML =
      '<div class="bar" style="margin-bottom:8px"><h2 style="margin:0;font-size:16px">💬 카톡 업무 상세 · 영구 연결</h2><span class="sp"></span>' +
      '<button type="button" class="sm" id="mClose">닫기</button></div>' +
      '<div class="note"><b>비식별 요약:</b><br>' + esc(r.summary) + '</div>' +
      '<div class="kv">' +
      '<b>날짜 · 방</b><span>' + esc(r.day + ' · ' + r.room) + '</span>' +
      '<b>영역 · 판별</b><span>' + esc(r.domainIcon + ' ' + r.domainLabel) + ' · ' + safetyBadge(r.safety, r.redactedCount) + '</span>' +
      '<b>참여자</b><span>' + esc((r.senders || []).join(' · ') || '-') + '</span>' +
      '<b>사건번호 · 기한</b><span>' + esc(((r.caseNos || []).join(', ') || '-') + (r.due ? ' · 기한 ' + r.due : '')) + '</span>' +
      '<b>첨부 파일명</b><span>' + esc((r.fileNames || []).join(', ') || '-') + '</span>' +
      '<b>실시간 업무상태</b><span>' + (r.workLinked ? esc(r.workState + ' · 담당 ' + (r.workManager || '-') + (r.workLastDate ? ' · 최근기록 ' + r.workLastDate : '')) : '연결된 업무 없음') + '</span>' +
      '</div>' +
      '<div class="card" style="margin:10px 0">' +
      '<div style="margin-bottom:8px"><label class="hint" for="mWorkSel">연결할 업무 (확정 연결)</label><select id="mWorkSel" style="width:100%;margin-top:4px">' + wOpts + '</select></div>' +
      '<div style="margin-bottom:8px"><label class="hint" for="mCoSel">연결할 업체 (기업정보함 원장 ID)</label><select id="mCoSel" style="width:100%;margin-top:4px">' + cOpts + '</select></div>' +
      '<div style="margin-bottom:8px"><label class="hint" for="mStSel">추적 상태</label><select id="mStSel" style="width:100%;margin-top:4px">' +
      '<option value="open"' + (r.status === 'open' ? ' selected' : '') + '>접수·대기</option>' +
      '<option value="tracking"' + (r.status === 'tracking' ? ' selected' : '') + '>진행추적중</option>' +
      '<option value="done"' + (r.status === 'done' ? ' selected' : '') + '>처리완료</option></select></div>' +
      '<div><label class="hint" for="mNote">후속 진행 메모</label><textarea id="mNote" rows="3" maxlength="1000" style="margin-top:4px">' + esc(r.note || '') + '</textarea></div>' +
      '</div>' +
      '<div class="bar">' +
      '<button type="button" class="pri" id="mSave">저장</button>' +
      '<button type="button" class="sm" id="mPushWorkLog">📋 업무관리 진행기록에도 남기기</button>' +
      '<button type="button" class="sm dng" id="mDelete">삭제</button>' +
      '<span class="sp"></span>' +
      (r.workItemId ? '<a class="sm" href="work.html" target="_blank" rel="noopener">업무관리 열기 ↗</a>' : '') +
      '</div>';
    if (!PREV_MODAL_FOCUS && document.activeElement) PREV_MODAL_FOCUS = document.activeElement;
    $('modal').classList.add('on');
    if ($('mClose')) $('mClose').focus();

    $('mClose').onclick = closeModal;
    $('mSave').onclick = function () {
      if (!checkRrnGuardUI()) { toast('주민번호 지우개가 없어 저장할 수 없습니다'); return; }
      var rawRec = ARCHIVE[r.id]; if (!rawRec || rawRec._deleted) return;
      var wid = $('mWorkSel').value;
      var cid = $('mCoSel').value;
      var noteMasked = K.stripSecrets($('mNote').value || '', KW ? KW.maskSensitive : null, RM ? RM.maskRrnInText : null).text.slice(0, 1000);
      var next = Object.assign({}, rawRec, {
        workItemId: wid,
        companyId: cid,
        companyLinkStatus: cid ? 'linked' : 'pending',
        status: $('mStSel').value,
        note: noteMasked,
        updatedAt: Date.now(),
        updatedBy: ME.sid
      });
      var saveP = (!isLocalPreview() && gate && fbDb)
        ? gate.save(fbDb.ref('kakao_room/items/' + r.id), function (serverPrev) {
            if (serverPrev && serverPrev._deleted) return null;
            return next;
          }, { entityType: K.ENTITY_ARCHIVE, expectedRevision: Number(rawRec.revision || 0) })
        : Promise.resolve();
      saveP.then(function (res) {
        var saved = res && res.snapshot && typeof res.snapshot.val === 'function' ? res.snapshot.val() : null;
        next.revision = saved && saved.revision ? saved.revision : Number(rawRec.revision || 0) + 1;
        ARCHIVE[r.id] = saved || next;
        closeModal();
        renderAll();
        toast('연결·진행 상태를 저장했습니다');
      }).catch(function (e) {
        if (!isLocalPreview()) {
          fbDb.ref('kakao_room/items/' + r.id).once('value').then(function (s) { if (s.val()) ARCHIVE[r.id] = s.val(); });
        }
        toast('저장 실패: ' + ((e && e.message) || e));
      });
    };

    $('mPushWorkLog').onclick = function () {
      var wid = $('mWorkSel').value;
      if (!wid) { toast('먼저 연결할 업무를 선택해 주세요'); return; }
      if (!checkRrnGuardUI()) return;
      var wp = K.buildWorkLogPayload(r, wid, { sid: ME.sid, name: ME.name }, Date.now());
      if (!wp) return;
      pushWorkLogIfAbsent(wp).then(function (wrote) {
        if (ARCHIVE[r.id]) ARCHIVE[r.id].workLogId = wp.lid;
        toast(wrote ? '업무관리 진행기록에 반영했습니다' : '이미 동일한 진행기록이 있어 건너뛰었습니다');
      }).catch(function (e) { toast('반영 실패: ' + ((e && e.message) || e)); });
    };

    $('mDelete').onclick = function () {
      var rawRec = ARCHIVE[r.id]; if (!rawRec || rawRec._deleted) return;
      if (!confirm('이 카톡 업무 보관 항목을 삭제 표시할까요?')) return;
      var p = (!isLocalPreview() && gate && fbDb)
        ? gate.remove(fbDb.ref('kakao_room/items/' + r.id), rawRec, { entityType: K.ENTITY_ARCHIVE })
        : Promise.resolve();
      p.then(function () {
        ARCHIVE[r.id] = Object.assign({}, rawRec, { _deleted: true, deletedAt: Date.now(), deletedBy: ME.sid, revision: Number(rawRec.revision || 0) + 1 });
        delete ARCH_PICK[r.id];
        closeModal();
        renderAll();
        toast('삭제 표시했습니다');
      }).catch(function (e) { toast('삭제 실패: ' + ((e && e.message) || e)); });
    };
  }

  function openRoomsModal() {
    $('mbox').innerHTML =
      '<div class="bar" style="margin-bottom:8px"><h2 style="margin:0;font-size:16px">⚙ 받을 법인 카카오톡 방 설정</h2><span class="sp"></span>' +
      '<button type="button" class="sm" id="mClose">닫기</button></div>' +
      '<p class="hint">한 줄에 방 이름 하나를 적습니다. 카톡 방 이름과 <b>글자 그대로 일치</b>하는 방의 알림만 수집합니다. (개인 대화 혼입 원천 차단)</p>' +
      '<textarea id="mRoomsTa" rows="5">' + esc(ROOMS.join('\n')) + '</textarea>' +
      '<div class="bar" style="justify-content:flex-end;margin-top:10px">' +
      '<button type="button" class="pri" id="mRoomsSave">저장</button></div>';
    if (!PREV_MODAL_FOCUS && document.activeElement) PREV_MODAL_FOCUS = document.activeElement;
    $('modal').classList.add('on');
    if ($('mClose')) $('mClose').focus();
    $('mClose').onclick = closeModal;
    $('mRoomsSave').onclick = function () {
      var list = ($('mRoomsTa').value || '').split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean);
      callBridge('kakaoRoomsSet', { rooms: list }).then(function (j) {
        ROOMS = j.rooms || list;
        closeModal();
        renderPhoneDiag();
        toast('받을 법인 방 ' + ROOMS.length + '곳을 저장했습니다');
      }).catch(function (e) { toast('저장 실패: ' + ((e && e.message) || e)); });
    };
  }

  function closeModal() {
    $('modal').classList.remove('on');
    $('mbox').innerHTML = '';
    if (PREV_MODAL_FOCUS && document.body && document.body.contains(PREV_MODAL_FOCUS) && typeof PREV_MODAL_FOCUS.focus === 'function') {
      PREV_MODAL_FOCUS.focus();
    }
    PREV_MODAL_FOCUS = null;
  }

  function renderAll() {
    renderDiffBar();
    renderKpis();
    if (TAB === 'archive') renderArchive();
    else if (TAB === 'collect') renderCollectPreview();
    else if (TAB === 'files') renderFiles();
    else if (TAB === 'groups') renderGroups();
    else if (TAB === 'safety') renderSafetyGuide();
  }

  /* ── 이벤트 바인딩 ── */
  function bindEvents() {
    $('tabs').addEventListener('click', function (e) {
      var b = e.target && e.target.closest && e.target.closest('button[data-tab]');
      if (b) setTab(b.getAttribute('data-tab'));
    });
    $('tabs').addEventListener('keydown', function (e) {
      var btns = [].slice.call($('tabs').querySelectorAll('button[data-tab]'));
      var idx = btns.indexOf(document.activeElement);
      if (idx < 0) return;
      var nextIdx = -1;
      if (e.key === 'ArrowRight') nextIdx = (idx + 1) % btns.length;
      else if (e.key === 'ArrowLeft') nextIdx = (idx - 1 + btns.length) % btns.length;
      else if (e.key === 'Home') nextIdx = 0;
      else if (e.key === 'End') nextIdx = btns.length - 1;
      if (nextIdx >= 0) {
        e.preventDefault();
        setTab(btns[nextIdx].getAttribute('data-tab'));
        btns[nextIdx].focus();
      }
    });
    $('diffToggleBtn').addEventListener('click', function () {
      DIFF_ON = !DIFF_ON;
      renderDiffBar();
    });
    $('recent-diff-bar').addEventListener('click', function (e) {
      if (e.target && e.target.id === 'btnHideDiffBar') { DIFF_ON = false; renderDiffBar(); return; }
      var pill = e.target && e.target.closest && e.target.closest('button[data-diff-id]');
      if (!pill) return;
      var id = pill.getAttribute('data-diff-id');
      for (var i = 0; i < RECENT_CODE_CHANGES.length; i++) {
        if (RECENT_CODE_CHANGES[i].id === id) {
          DIFF_ON = true;
          setTab(RECENT_CODE_CHANGES[i].tab);
          var el = $(RECENT_CODE_CHANGES[i].targetId);
          if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          break;
        }
      }
    });

    ['qArchive', 'fDomain', 'fLink', 'fStatus'].forEach(function (id) {
      $(id).addEventListener(id === 'qArchive' ? 'input' : 'change', renderArchive);
    });
    $('btnReloadAll').addEventListener('click', loadFirebaseData);
    $('btnGoCollect').addEventListener('click', function () { setTab('collect'); });

    $('archiveTableBox').addEventListener('change', function (e) {
      var t = e.target;
      if (t.id === 'archPickAll') {
        filteredArchive().forEach(function (r) { ARCH_PICK[r.id] = !!t.checked; });
        renderArchive();
      } else if (t.classList && t.classList.contains('arch-ck')) {
        ARCH_PICK[t.getAttribute('data-id')] = !!t.checked;
        renderArchive();
      }
    });
    $('archiveTableBox').addEventListener('click', function (e) {
      var b = e.target && e.target.closest && e.target.closest('[data-open-arch]');
      if (b) openArchiveModal(b.getAttribute('data-open-arch'));
    });

    $('archiveSelBar').addEventListener('click', function (e) {
      var b = e.target && e.target.closest && e.target.closest('button[data-bulk-st]');
      if (!b) return;
      var st = b.getAttribute('data-bulk-st');
      var ids = Object.keys(ARCH_PICK).filter(function (id) { return ARCH_PICK[id] && ARCHIVE[id] && !ARCHIVE[id]._deleted; });
      if (!ids.length) return;
      Promise.all(ids.map(function (id) {
        var cur = ARCHIVE[id];
        var next = Object.assign({}, cur, { status: st, updatedAt: Date.now(), updatedBy: ME.sid });
        var p = (!isLocalPreview() && gate && fbDb)
          ? gate.save(fbDb.ref('kakao_room/items/' + id), function (serverPrev) {
              if (serverPrev && serverPrev._deleted) return null;
              return next;
            }, { entityType: K.ENTITY_ARCHIVE, expectedRevision: Number(cur.revision || 0) })
          : Promise.resolve();
        return p.then(function (res) {
          var saved = res && res.snapshot && typeof res.snapshot.val === 'function' ? res.snapshot.val() : null;
          next.revision = saved && saved.revision ? saved.revision : Number(cur.revision || 0) + 1;
          ARCHIVE[id] = saved || next;
        });
      })).then(function () {
        ARCH_PICK = {};
        renderAll();
        toast(ids.length + '건의 상태를 변경했습니다');
      }).catch(function (err) { toast('일괄 변경 실패: ' + ((err && err.message) || err)); });
    });
    $('btnBulkClear').addEventListener('click', function () { ARCH_PICK = {}; renderArchive(); });
    $('btnBulkDelete').addEventListener('click', function () {
      var ids = Object.keys(ARCH_PICK).filter(function (id) { return ARCH_PICK[id] && ARCHIVE[id] && !ARCHIVE[id]._deleted; });
      if (!ids.length || !confirm(ids.length + '건을 삭제 표시할까요?')) return;
      Promise.all(ids.map(function (id) {
        var cur = ARCHIVE[id];
        var p = (!isLocalPreview() && gate && fbDb)
          ? gate.remove(fbDb.ref('kakao_room/items/' + id), cur, { entityType: K.ENTITY_ARCHIVE })
          : Promise.resolve();
        return p.then(function () {
          ARCHIVE[id] = Object.assign({}, cur, { _deleted: true, deletedAt: Date.now(), deletedBy: ME.sid, revision: Number(cur.revision || 0) + 1 });
        });
      })).then(function () {
        ARCH_PICK = {};
        renderAll();
        toast(ids.length + '건을 삭제 표시했습니다');
      }).catch(function (err) { toast('삭제 실패: ' + ((err && err.message) || err)); });
    });

    /* 수집·판별 탭 */
    $('btnManageRooms').addEventListener('click', openRoomsModal);
    $('btnPullServer').addEventListener('click', pullFromServer);
    $('btnConnectFolder').addEventListener('click', connectDlFolder);
    $('btnFilesFolder').addEventListener('click', connectDlFolder);
    $('btnFilesReload').addEventListener('click', function () {
      if (!ME.admin) { renderFiles(); return; }
      callBridge('kakaoFiles').then(function (j) { SERVER_FILES = j.items || []; renderFiles(); toast('새로고침했습니다'); }).catch(function (e) { toast(e.message); });
    });

    var dz = $('txtDropZone'), fi = $('txtFileInput');
    dz.addEventListener('click', function () { fi.click(); });
    dz.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fi.click(); } });
    dz.addEventListener('dragover', function (e) { e.preventDefault(); dz.classList.add('over'); });
    dz.addEventListener('dragleave', function () { dz.classList.remove('over'); });
    dz.addEventListener('drop', function (e) {
      e.preventDefault(); dz.classList.remove('over');
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) handleTxtFile(f);
    });
    fi.addEventListener('change', function () {
      if (fi.files && fi.files[0]) handleTxtFile(fi.files[0]);
      fi.value = '';
    });

    $('btnRunSafety').addEventListener('click', function () {
      var room = ($('collectRoomInput').value || '').trim() || ROOMS[0] || '푸른노무법인 업무채팅방';
      var parsed = K.parseQuickPaste($('pasteInput').value, room);
      if (!parsed.ok) { toast(parsed.error); return; }
      var lines = KE ? KE.fromLines(parsed.messages, parsed.files) : parsed.messages;
      runAnalyzeOnMessages(lines, parsed.room, {
        sourceKind: parsed.mode || 'paste',
        exportMsgs: parsed.mode === 'export' ? parsed.messages : null,
        exportFiles: parsed.mode === 'export' ? parsed.files : null
      });
    });

    $('btnLoadSamplePaste').addEventListener('click', function () {
      $('collectRoomInput').value = '푸른노무법인 업무채팅방';
      $('pasteInput').value = [
        '2026년 11월 28일 토요일',
        '[김노무사] [오전 9:30] 경기2026부해3347 답변서 제출기한 12월 4일까지 연장 신청 완료했습니다.',
        '[이노무사] [오전 9:31] 네 확인했습니다',
        '[문자알림] [오전 9:32] [Web발신] 카카오 인증번호 991234 절대 타인에게 알려주지 마세요',
        '[박담당] [오전 9:35] 한빛제조 의뢰인 900101-1234567 계좌 110-123-456789 비번: temp1234 확인 요청합니다 연락처 010-0000-0000',
        '[김노무사] [오전 9:36] 파일: 답변서_연장신청서.hwpx'
      ].join('\n');
      $('btnRunSafety').click();
    });

    $('collectPreviewBox').addEventListener('change', function (e) {
      if (!STAGE || !STAGE.analyzed) return;
      var t = e.target;
      if (t.id === 'stgPickAll') {
        STAGE.analyzed.rows.forEach(function (r) { r.on = !!t.checked; });
        renderCollectPreview();
      } else if (t.classList && t.classList.contains('stg-ck')) {
        var r = STAGE.analyzed.rows[Number(t.getAttribute('data-idx'))];
        if (r) { r.on = !!t.checked; renderCollectPreview(); }
      } else if (t.classList && t.classList.contains('stg-item-sel')) {
        var idx = Number(t.getAttribute('data-idx'));
        var row = STAGE.analyzed.rows[idx];
        if (row) {
          row.itemId = t.value;
          row.on = true;
          renderCollectPreview();
        }
      }
    });

    $('btnSaveArchiveAndWork').addEventListener('click', function () { saveStageRecords(true); });
    $('btnSaveArchiveOnly').addEventListener('click', function () { saveStageRecords(false); });
    $('btnPushServerNotes').addEventListener('click', function () {
      if (!ME.admin || !STAGE || !STAGE.exportMsgs) return;
      if (!checkRrnGuardUI()) return;
      var prep = K.prepareServerImport(STAGE.exportMsgs, STAGE.exportFiles || [], {
        keepDays: (KW && KW.KEEP_DAYS) || 30,
        maxLines: 5000,
        maxFiles: 500,
        maskSensitive: KW ? KW.maskSensitive : null,
        maskRrn: RM ? RM.maskRrnInText : null
      });
      if (!prep.lines.length && !prep.files.length) {
        toast('OTP·만료(30일 초과) 등을 제외하면 서버에 보낼 안전한 대화가 없습니다');
        return;
      }
      callBridge('kakaoImport', {
        room: STAGE.room,
        lines: prep.lines,
        files: prep.files
      }).then(function (j) {
        var extra = [];
        if (prep.blockedCount) extra.push('OTP차단 ' + prep.blockedCount + '줄 제외');
        if (prep.oldCount) extra.push('30일초과 ' + prep.oldCount + '줄 제외');
        toast('서버 30일 보관함에 새 글 ' + (j.fresh || 0) + '건을 넣었습니다' + (extra.length ? ' (' + extra.join(', ') + ')' : ''));
      }).catch(function (e) { toast('서버 보관 실패: ' + ((e && e.message) || e)); });
    });

    /* 첨부자료 보관함 */
    $('filesTableBox').addEventListener('change', function (e) {
      var t = e.target;
      if (t.id === 'filePickAll') {
        combinedFiles().forEach(function (f) { FILE_PICK[f.id] = !!t.checked; });
        renderFiles();
      } else if (t.classList && t.classList.contains('file-ck')) {
        FILE_PICK[t.getAttribute('data-id')] = !!t.checked;
        renderFiles();
      } else if (t.classList && t.classList.contains('file-dest-sel')) {
        FILE_DEST[t.getAttribute('data-id')] = t.value;
      }
    });
    $('btnFilesSend').addEventListener('click', function () { sendPickedFiles(false); });
    $('btnFilesPcDone').addEventListener('click', function () { sendPickedFiles(true); });

    /* 묶기 & 옵시디언 */
    $('groupBySel').addEventListener('change', renderGroups);
    $('btnObsidianExport').addEventListener('click', exportObsidian);

    /* 모달 외부 클릭 · Escape 닫기 · 포커스 가둠 */
    $('modal').addEventListener('click', function (e) { if (e.target === $('modal')) closeModal(); });
    document.addEventListener('keydown', function (e) {
      var m = $('modal');
      if (!m || !m.classList.contains('on')) return;
      if (e.key === 'Escape') { closeModal(); return; }
      if (e.key === 'Tab') {
        var focusable = [].slice.call($('mbox').querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')).filter(function (el) {
          return el.offsetParent !== null;
        });
        if (!focusable.length) return;
        var first = focusable[0], last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  }

  /* ── 부팅 & 인증 관문 ── */
  function boot() {
    bindEvents();
    if (isLocalPreview()) {
      initPreviewSeed();
      $('lock').style.display = 'none';
      $('app').style.display = 'block';
      renderAll();
      return;
    }
    if (typeof firebase === 'undefined') {
      $('lockWhy').textContent = 'Firebase SDK 를 불러오지 못했습니다.';
      $('lock').style.display = 'block';
      return;
    }
    if (!firebase.apps || !firebase.apps.length) firebase.initializeApp(FB_CONFIG);
    fbAuth = firebase.auth();
    fbDb = firebase.database();

    fbAuth.onAuthStateChanged(function (user) {
      if (!user) {
        $('app').style.display = 'none';
        $('lock').style.display = 'block';
        $('lockWhy').textContent = '재직 직원 계정으로 로그인하면 열립니다.';
        if (window.PuKakaoRoomGate) window.PuKakaoRoomGate.show();
        return;
      }
      fbDb.ref('uid_roles/' + user.uid).once('value').then(function (s) {
        var r = s.val();
        if (!r || r.status !== 'active') {
          $('app').style.display = 'none';
          $('lock').style.display = 'block';
          $('lockWhy').textContent = '재직 직원만 접근할 수 있습니다.';
          if (window.PuKakaoRoomGate) window.PuKakaoRoomGate.show();
          return;
        }
        ME = {
          uid: user.uid,
          sid: String(r.sid || user.uid),
          name: String(r.name || user.displayName || '직원'),
          admin: r.isAdmin === true || r.isAdmin === 1
        };
        gate = window.PuOntologyWrite.createGateway({ mode: 'enforce', actor: ME.sid });
        if (window.PuKakaoRoomGate) window.PuKakaoRoomGate.hide();
        $('lock').style.display = 'none';
        $('app').style.display = 'block';
        loadFirebaseData();
      }).catch(function () {
        $('app').style.display = 'none';
        $('lock').style.display = 'block';
        $('lockWhy').textContent = '권한 확인 중 오류가 발생했습니다.';
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
