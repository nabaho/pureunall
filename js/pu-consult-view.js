/* 푸른통합시스템 — 12개 컨설팅 전용 앱 공통 통합 워크스페이스 컨트롤러
 * (브라우저 window.PuConsultView)
 *
 * 지원 앱:
 *   techprotect, clinic, chamber, hrconsult, evalcomp, pubconsult,
 *   familywork, socialent, sixthind, laboraudit, unionneg, specialcons
 *
 * 5개 탭:
 *   1. projects : 수행 기업 관리 · 6단계 진행 · 메일/카톡·문자 자동감지 묶음
 *   2. check    : 착수 사전 체크 · 도메인 전문 실무 점검 · 필수 산출서류 점검
 *   3. intake   : 메일(IMAP+POP3)·카톡·문자 통합 인박스 · 로컬파일 비식별 · 카톡/문자 빠른입력
 *   4. report   : 섹션별 보고서 작성 · A4 웹 미리보기 · HWPX 3종 · 푸른한글 · 인쇄 · CSV
 *   5. coach    : 수습·주니어 노무사 RAG 행동코치 (지금 할 일 TOP 6 · 유의어 RAG 검색 · AI 질의)
 */
(function (global) {
  'use strict';

  var SESSION_EPOCH = 0;
  var APP_KEY = 'sixthind';
  var fb = null;
  var fbDb = null;
  var ME = null;
  var gate = null;
  var PREVIEW_MODE = false;
  var DIFF_HIGHLIGHT = true;
  var CUR_TAB = 'projects';
  var CUR_PID = '';
  var CUR_REPORT_KIND = 'comprehensive';
  var CUR_COACH_ANSWER = null;

  var D = {
    projects: {},
    checks: {},
    comms: {},
    reports: {},
    msgIntake: {},
    companies: [],
    consultings: [],
    mailboxFolders: {},
    mailboxMsgs: {},
    mailboxOldMsgs: {},
    ragNotes: {},
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
    return Object.keys(D.projects || {}).map(function (k) {
      return Object.assign({ id: k }, D.projects[k]);
    }).filter(function (p) { return p && !p._deleted; })
      .sort(function (a, b) { return (num(b.updatedAt, 0) - num(a.updatedAt, 0)) || str(a.companyName).localeCompare(str(b.companyName)); });
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

  async function saveRecord(subPath, id, record, entityType) {
    var rec = Object.assign({ id: id, entityType: entityType || 'Document', schemaVersion: 1, contractVersion: 1 }, record);
    if (PREVIEW_MODE || !fbDb || !gate) {
      rec.updatedAt = Date.now();
      rec.createdAt = rec.createdAt || rec.updatedAt;
      rec.revision = num(rec.revision, 0) + 1;
      return rec;
    }
    var ref = fbDb.ref(rootPath(subPath));
    var res = await gate.save(ref, rec, {
      entityType: entityType || 'Document',
      expectedRevision: num(rec.revision, 0),
      allowPendingCompany: true
    });
    return (res && res.snapshot && typeof res.snapshot.val === 'function') ? res.snapshot.val() : rec;
  }

  async function softDeleteRecord(subPath, prev, entityType) {
    if (PREVIEW_MODE || !fbDb || !gate) {
      return Object.assign({}, prev, { _deleted: true, deletedAt: Date.now() });
    }
    var ref = fbDb.ref(rootPath(subPath));
    await gate.remove(ref, prev, { entityType: entityType || 'Document' });
    return true;
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
      createdAt: now - 864e5 * 90, updatedAt: now - 864e5 * 30,
      companyId: 'co_pv_2', companyName: '(주)다라산업', bizNo: '123-81-51002',
      year: 2025, trackId: t1.id, trackName: t1.name, stage: 'followup',
      workerCount: 45, consultantName: '점검노무사', status: 'done',
      summaryNote: cat.name + ' 최종 결과보고·산출물 인도 완료 (과거 수행사례)'
    };
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

  function rebuildDiscoverAndRag() {
    var I = Intake();
    var R = Rag();
    var C = Cat();
    var projs = projectsList();
    if (I && !PREVIEW_MODE) {
      D.discover = I.discoverForApp(APP_KEY, {
        companies: D.companies,
        consultings: D.consultings,
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
      safeVal('mailbox/folders'),
      safeVal('mailbox/msgs'),
      safeVal('mailbox/old/msgs')
    ]);
    if (epoch !== SESSION_EPOCH || (ME && ME.uid !== uid)) return;
    D.projects = res[0] || {};
    D.checks = res[1] || {};
    D.comms = res[2] || {};
    D.reports = res[3] || {};
    D.msgIntake = res[4] || {};
    D.ragNotes = res[5] || {};
    var coRaw = res[6] && res[6].v !== undefined ? res[6].v : res[6];
    D.companies = Array.isArray(coRaw) ? coRaw : (coRaw && typeof coRaw === 'object' ? Object.values(coRaw) : []);
    var csRaw = res[7] && res[7].v !== undefined ? res[7].v : res[7];
    D.consultings = Array.isArray(csRaw) ? csRaw : (csRaw && typeof csRaw === 'object' ? Object.values(csRaw) : []);
    D.mailboxFolders = res[8] || {};
    D.mailboxMsgs = res[9] || {};
    D.mailboxOldMsgs = res[10] || {};

    rebuildDiscoverAndRag();
    if ($('syncStateChip')) $('syncStateChip').textContent = '최신 동기화 완료';
    draw();
  }

  /* ══ 3. 상단 변경점 바(#recent-diff-bar) & KPI & 워크스페이스 헤더 ═════ */
  function renderRecentDiffBar() {
    var el = $('recentDiffBarWrap');
    if (!el) return;
    var cat = getAppCat();
    el.innerHTML = '<div id="recent-diff-bar" class="note ' + (DIFF_HIGHLIGHT ? 'code-diff-box' : '') + '" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">' +
      '<span class="chip c-blue">변경됨 · NEW</span>' +
      '<b>' + esc(cat.icon + ' ' + cat.name) + ' 전용 앱 신규 구축:</b>' +
      '<span class="hint">메일(IMAP+POP3)·카톡/문자 자동분류 + 체크리스트 + HWPX/푸른한글 + 수습 RAG 행동코치가 통합되었습니다.</span>' +
      '<span class="sp"></span>' +
      '<button type="button" class="sm" data-diff-tab="projects">메일·카톡 자동감지</button>' +
      '<button type="button" class="sm" data-diff-tab="report">HWPX·푸른한글</button>' +
      '<button type="button" class="sm pri" data-diff-tab="coach">RAG 행동코치</button>' +
      '<button type="button" class="sm" id="toggleDiffBtn">' + (DIFF_HIGHLIGHT ? '변경 강조 끄기' : '변경 강조 켜기') + '</button>' +
      '</div>';
    el.querySelectorAll('[data-diff-tab]').forEach(function (b) {
      b.onclick = function () { switchTab(b.getAttribute('data-diff-tab')); };
    });
    if ($('toggleDiffBtn')) {
      $('toggleDiffBtn').onclick = function () { DIFF_HIGHLIGHT = !DIFF_HIGHLIGHT; draw(); };
    }
  }

  function diffCls(on) {
    return (DIFF_HIGHLIGHT && on) ? ' code-diff-box' : '';
  }
  function diffBadge(label) {
    return DIFF_HIGHLIGHT ? ' <span class="chip c-blue">' + esc(label || '변경됨') + '</span>' : '';
  }

  function renderTopMeta() {
    var cat = getAppCat();
    var proj = projectById(CUR_PID);
    var pList = projectsList();
    var cands = (D.discover && D.discover.bundles) || [];
    var rag = Rag();
    var nextPlan = (proj && rag) ? rag.recommendNextActions(APP_KEY, proj, getCheckDoc(proj.id), getProjectComms(proj.id)) : null;

    if ($('nDiscover')) $('nDiscover').textContent = String(cands.length);
    var kpiBox = $('kpiRow');
    if (kpiBox) {
      kpiBox.innerHTML =
        '<div class="kpi k-blue"><span>등록 사업장</span><b>' + pList.length + '건</b></div>' +
        '<div class="kpi"><span>진행 중 사업장</span><b>' + pList.filter(function (x) { return x.status !== 'done'; }).length + '건</b></div>' +
        '<div class="kpi k-green"><span>현재 선택 진행률</span><b>' + (nextPlan ? nextPlan.readinessPct + '%' : '-') + '</b></div>' +
        '<div class="kpi k-amber"><span>메일·카톡 감지후보</span><b>' + cands.length + '곳</b></div>' +
        '<div class="kpi"><span>연계 자료(메일·톡)</span><b>' + (proj ? getProjectComms(proj.id).length : 0) + '건</b></div>';
    }

    var scopeBox = $('scopeBarWrap');
    if (scopeBox) {
      if (!proj) {
        scopeBox.innerHTML = '<div class="scope-bar"><span class="scope-lbl">선택 사업장: 없음</span><span class="hint">아래 목록에서 사업장을 선택하거나 [+ 신규 사업장 등록]을 누르세요.</span></div>';
      } else {
        var stages = cat.stages || [];
        var curIdx = Math.max(0, stages.findIndex(function (s) { return s.id === (proj.stage || 'intake'); }));
        var stepBtns = stages.map(function (s, idx) {
          var cls = idx < curIdx ? 'done' : (idx === curIdx ? 'cur' : '');
          return '<button type="button" class="ws-step ' + cls + '" data-stage-set="' + esc(s.id) + '" title="' + esc(s.desc || s.name) + '">' +
            '<b>' + s.no + '. ' + esc(s.name) + '</b><span>' + (idx < curIdx ? '완료' : (idx === curIdx ? '현재 단계' : '대기')) + '</span></button>';
        }).join('');
        scopeBox.innerHTML =
          '<div class="card' + diffCls(false) + '">' +
            '<div class="prof">' +
              '<span><b>선택 사업장</b>' + esc(proj.companyName) + '</span>' +
              '<span><b>트랙</b><span class="chip c-blue">' + esc(proj.trackName || proj.trackId || cat.shortName) + '</span></span>' +
              '<span><b>연도</b>' + esc(String(proj.year || 2026)) + '년</span>' +
              '<span><b>근로자</b>' + num(proj.workerCount, 0) + '명</span>' +
              '<span class="sp"></span>' +
              '<button type="button" class="sm" data-nav-tab="coach">지금 할 일 ' + (nextPlan ? nextPlan.actions.length : 0) + '건 보기 →</button>' +
            '</div>' +
            '<div class="ws-steps">' + stepBtns + '</div>' +
          '</div>';
        scopeBox.querySelectorAll('[data-stage-set]').forEach(function (b) {
          b.onclick = function () { setProjectStage(proj.id, b.getAttribute('data-stage-set')); };
        });
        scopeBox.querySelectorAll('[data-nav-tab]').forEach(function (b) {
          b.onclick = function () { switchTab(b.getAttribute('data-nav-tab')); };
        });
      }
    }
  }

  /* ══ 4. 탭 1: 사업장 목록 + 메일·카톡 자동감지 ═══════════════════════ */
  function renderProjectsTab() {
    var box = $('projectsBox');
    var discBox = $('discoverBox');
    var cat = getAppCat();
    var q = str($('projQ') && $('projQ').value).toLowerCase();
    var rows = projectsList().filter(function (p) {
      if (!q) return true;
      return (str(p.companyName) + ' ' + str(p.trackName) + ' ' + str(p.summaryNote)).toLowerCase().indexOf(q) >= 0;
    });

    if (box) {
      if (!rows.length) {
        box.innerHTML = '<div class="empty">아직 등록된 ' + esc(cat.name) + ' 사업장이 없습니다. 아래 [자동 감지 후보]에서 1클릭 등록하거나 [+ 신규 사업장 등록]을 누르세요.</div>';
      } else {
        var trs = rows.map(function (p, i) {
          var ckKey = 'p:' + p.id;
          var checked = SEL[ckKey] ? ' checked' : '';
          var curCls = p.id === CUR_PID ? ' class="cur"' : '';
          var stgObj = (cat.stages || []).find(function (s) { return s.id === (p.stage || 'intake'); }) || { name: '착수' };
          var commCnt = getProjectComms(p.id).length;
          return '<tr data-row="' + esc(p.id) + '"' + curCls + '>' +
            '<td class="c"><input type="checkbox" data-ck="' + esc(ckKey) + '" data-list="proj"' + checked + ' aria-label="' + esc(p.companyName) + ' 선택"></td>' +
            '<td class="n">' + (i + 1) + '</td>' +
            '<td class="ti" title="' + esc(p.companyName) + '">' + esc(p.companyName) + '</td>' +
            '<td data-k="badge" title="' + esc(p.trackName || cat.shortName) + '"><span class="chip c-blue">' + esc(p.trackName || cat.shortName) + '</span> <span class="chip">' + esc(stgObj.name) + '</span></td>' +
            '<td title="' + esc(String(p.year || 2026)) + '년">' + esc(String(p.year || 2026)) + '</td>' +
            '<td title="연계 자료 ' + commCnt + '건">' + commCnt + '건</td>' +
            '<td class="wide" title="' + esc(p.summaryNote || '-') + '">' + esc(p.summaryNote || '-') + '</td>' +
            '<td data-k="act"><button type="button" class="sm pri" data-pick="' + esc(p.id) + '">열기</button><button type="button" class="sm danger" data-del-proj="' + esc(p.id) + '">보관삭제</button></td>' +
          '</tr>';
        }).join('');
        box.innerHTML = '<div class="scroll"><table class="t" data-name="proj">' +
          '<thead><tr><th class="c"><input type="checkbox" data-ckall="proj" aria-label="전체 선택"></th><th class="n">№</th><th>수진기업명</th><th>트랙 · 단계</th><th>연도</th><th>메일/톡</th><th class="wide">진행 요약</th><th data-k="act">작업</th></tr></thead>' +
          '<tbody>' + trs + '</tbody></table></div>';

        box.querySelectorAll('[data-pick]').forEach(function (b) {
          b.onclick = function (e) { e.stopPropagation(); CUR_PID = b.getAttribute('data-pick'); switchTab('check'); };
        });
        box.querySelectorAll('tr[data-row]').forEach(function (tr) {
          tr.onclick = function (e) {
            if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON')) return;
            CUR_PID = tr.getAttribute('data-row');
            draw();
          };
        });
        box.querySelectorAll('[data-del-proj]').forEach(function (b) {
          b.onclick = function (e) { e.stopPropagation(); handleDeleteProject(b.getAttribute('data-del-proj')); };
        });
      }
    }

    if (discBox) {
      var cands = (D.discover && D.discover.bundles) || [];
      if (!cands.length) {
        discBox.innerHTML = '<div class="empty">메일함·카톡 수집함에서 아직 미등록인 신규 후보를 찾지 못했습니다. (전체 자동 감지는 상단 [메일·카톡 재스캔]을 누르세요.)</div>';
      } else {
        var cTrs = cands.slice(0, 60).map(function (b, i) {
          var ckKey = 'd:' + b.key;
          var sampleTxt = (b.sampleSubjects || [])[0] || '';
          var badgeTxt = '메일 ' + b.mailCount + ' · 톡 ' + b.msgCount + (b.erpCount ? ' · ERP ' + b.erpCount : '');
          return '<tr data-cand="' + esc(b.key) + '">' +
            '<td class="c"><input type="checkbox" data-ck="' + esc(ckKey) + '" data-list="cand"' + (SEL[ckKey] ? ' checked' : '') + ' aria-label="' + esc(b.companyName) + ' 선택"></td>' +
            '<td class="n">' + (i + 1) + '</td>' +
            '<td class="ti" title="' + esc(b.companyName) + '">' + esc(b.companyName) + '</td>' +
            '<td data-k="badge" title="' + esc(badgeTxt) + '"><span class="chip c-amber">' + esc(badgeTxt) + '</span></td>' +
            '<td title="' + esc(String(b.year || 2026)) + '">' + esc(String(b.year || 2026)) + '</td>' +
            '<td class="wide" title="' + esc(sampleTxt) + '">' + esc(sampleTxt || '-') + '</td>' +
            '<td data-k="act"><button type="button" class="sm ok" data-import-cand="' + esc(b.key) + '">1클릭 등록</button></td>' +
          '</tr>';
        }).join('');
        discBox.innerHTML = '<div class="bar"><button type="button" class="sm ok" id="bulkImportCandBtn">선택 후보 일괄 등록</button><span class="hint">메일·카톡 수집함·ERP 자동분류에서 선별된 후보입니다.</span></div>' +
          '<div class="scroll"><table class="t" data-name="cand"><thead><tr><th class="c"><input type="checkbox" data-ckall="cand" aria-label="후보 전체선택"></th><th class="n">№</th><th>후보 기업·제목</th><th>감지 출처</th><th>연도</th><th class="wide">대표 수신 제목</th><th data-k="act">등록</th></tr></thead><tbody>' + cTrs + '</tbody></table></div>';
        discBox.querySelectorAll('[data-import-cand]').forEach(function (b) {
          b.onclick = function () { importCandidateByKey(b.getAttribute('data-import-cand')); };
        });
        if ($('bulkImportCandBtn')) {
          $('bulkImportCandBtn').onclick = importSelectedCandidates;
        }
      }
    }
  }

  /* ══ 5. 탭 2: 사전체크 · 도메인 실무점검 · 필수서류 ═════════════════ */
  function renderCheckTab() {
    var box = $('checkBox');
    if (!box) return;
    var proj = projectById(CUR_PID);
    if (!proj) {
      box.innerHTML = '<div class="card"><div class="empty">① [수행 기업·자동감지] 탭에서 사업장을 선택해 주세요.</div></div>';
      return;
    }
    var cat = getAppCat();
    var cd = getCheckDoc(proj.id);

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
          '<td data-k="act">' +
            '<select data-chk-st="' + kindKey + ':' + esc(it.id) + '" aria-label="상태 선택">' +
              '<option value="">미점검</option>' +
              '<option value="ok"' + (st === 'ok' ? ' selected' : '') + '>적정·완료</option>' +
              '<option value="fix"' + (st === 'fix' ? ' selected' : '') + '>보완필요</option>' +
              '<option value="no"' + (st === 'no' ? ' selected' : '') + '>미이행</option>' +
              '<option value="na"' + (st === 'na' ? ' selected' : '') + '>해당없음</option>' +
            '</select>' +
          '</td>' +
        '</tr>';
      }).join('');
      return '<div class="card"><div class="sec"><span>' + esc(title) + '</span><span class="chip c-blue">' + (items || []).length + '항목</span></div>' +
        '<div class="scroll"><table class="t" data-name="chk_' + kindKey + '"><thead><tr><th class="c"><input type="checkbox" data-ckall="chk_' + kindKey + '" aria-label="전체"></th><th class="n">№</th><th>점검 항목</th><th>구분</th>' + (showLaw ? '<th>법령·지침</th>' : '') + '<th class="wide">메모</th><th data-k="act">판정</th></tr></thead><tbody>' + trs + '</tbody></table></div></div>';
    }

    box.innerHTML =
      '<div class="card"><div class="bar">' +
        '<b>' + esc(proj.companyName) + ' · 체크리스트' + diffBadge('6단계 연동') + '</b>' +
        '<span class="sp"></span>' +
        '<button type="button" class="pri" id="saveCheckBtn">체크 결과 저장</button>' +
        '<button type="button" class="sm" id="toCoachFromCheckBtn">RAG 행동 코치 보기</button>' +
      '</div></div>' +
      renderGroupTable('1. 착수 사전 체크', cat.preChecks, 'pre', false) +
      renderGroupTable('2. ' + cat.shortName + ' 실무 핵심 점검', cat.domainChecks, 'domain', true) +
      renderGroupTable('3. 단계별 필수 산출서류', cat.requiredDocs, 'docs', false);

    box.querySelectorAll('[data-quick-ok]').forEach(function (cb) {
      cb.onchange = function () {
        var parts = cb.getAttribute('data-quick-ok').split(':');
        var sel = box.querySelector('[data-chk-st="' + cssEsc(parts[0] + ':' + parts[1]) + '"]');
        if (sel) sel.value = cb.checked ? 'ok' : '';
      };
    });
    if ($('saveCheckBtn')) $('saveCheckBtn').onclick = function () { saveCurrentChecks(proj.id); };
    if ($('toCoachFromCheckBtn')) $('toCoachFromCheckBtn').onclick = function () { switchTab('coach'); };
  }

  /* ══ 6. 탭 3: 메일·카톡·문자 통합 인박스 & 빠른 수집 ═════════════════ */
  function renderIntakeTab() {
    var box = $('intakeBox');
    if (!box) return;
    var proj = projectById(CUR_PID);
    if (!proj) {
      box.innerHTML = '<div class="card"><div class="empty">① [수행 기업·자동감지] 탭에서 사업장을 선택해 주세요.</div></div>';
      return;
    }
    var comms = getProjectComms(proj.id);
    var trs = comms.map(function (c, i) {
      var ckKey = 'cm:' + str(c.id || i);
      var atts = Array.isArray(c.atts) && c.atts.length ? c.atts.join(', ') : '-';
      return '<tr data-comm-idx="' + i + '">' +
        '<td class="c"><input type="checkbox" data-ck="' + esc(ckKey) + '" data-list="comm" aria-label="자료 선택"></td>' +
        '<td class="n">' + (i + 1) + '</td>' +
        '<td class="ti" title="' + esc(c.subject || c.title) + '">' + esc(c.subject || c.title || '수신 자료') + '</td>' +
        '<td data-k="badge" title="' + esc(c.source || 'mail') + '"><span class="chip c-blue">' + esc(c.source || 'mail') + '</span></td>' +
        '<td title="' + esc(c.date || '-') + '">' + esc(c.date || '-') + '</td>' +
        '<td class="wide" title="' + esc(c.maskedPreview || '') + ' / 첨부: ' + esc(atts) + '">' + esc(c.maskedPreview || atts) + '</td>' +
        '<td data-k="act"><button type="button" class="sm" data-open-comm="' + i + '">내용 보기</button></td>' +
      '</tr>';
    }).join('');

    box.innerHTML =
      '<div class="card' + diffCls(true) + '">' +
        '<div class="sec"><span>💬 카카오톡·문자·로컬문서 즉시 수집 → ' + esc(proj.companyName) + diffBadge('자동 비식별') + '</span>' +
          '<span class="sp"></span>' +
          '<a class="act-link" href="pu-msg-intake.html" target="_blank" rel="noopener">카톡·문자 전체 수집허브 열기 ↗</a>' +
        '</div>' +
        '<div class="bar" style="flex-direction:column;align-items:stretch">' +
          '<div class="drop-zone" id="dropZone" role="button" tabindex="0" aria-label="로컬 파일 업로드 드롭존"><b>로컬 파일(.txt · .hwpx · .docx · .csv) 드래그 또는 클릭</b><span>주민번호·전화번호·계좌·PC경로는 브라우저에서 즉시 [가림] 처리된 요약만 저장됩니다.</span><input type="file" id="fileUploadInput" multiple aria-label="로컬 파일 선택" style="display:none"></div>' +
          '<textarea id="quickMsgPaste" rows="4" aria-label="카톡 대화 또는 문자 붙여넣기" placeholder="카카오톡 대화 내용이나 문자(SMS)를 여기에 붙여넣고 [이 사업에 바로 정리]를 누르면 자동 분류·비식별화되어 인박스에 저장됩니다."></textarea>' +
          '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">' +
            '<select id="quickMsgChannel" aria-label="메시지 채널 선택"><option value="kakao_export">카카오톡 대화</option><option value="sms_paste">문자(SMS/LMS)</option></select>' +
            '<button type="button" class="pri" id="quickMsgSaveBtn">이 사업에 비식별 정리·저장</button>' +
            '<span class="hint">OTP·인증번호·주민번호·계좌·연락처는 자동 차단/가림됩니다.</span>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="card">' +
        '<div class="sec"><span>📨 수집·연계된 메일·카톡·문자 인박스 (' + comms.length + '건)</span></div>' +
        (comms.length
          ? '<div class="scroll"><table class="t" data-name="comm"><thead><tr><th class="c"><input type="checkbox" data-ckall="comm" aria-label="전체"></th><th class="n">№</th><th>제목 · 요지</th><th>채널</th><th>일자</th><th class="wide">비식별 요약 · 첨부</th><th data-k="act">상세</th></tr></thead><tbody>' + trs + '</tbody></table></div>'
          : '<div class="empty">아직 연결된 메일·카톡 자료가 없습니다. 위 입력창에 붙여넣거나 [메일·카톡 재스캔]을 실행하세요.</div>') +
      '</div>';

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
    box.querySelectorAll('[data-open-comm]').forEach(function (b) {
      b.onclick = function () { openCommModal(comms[Number(b.getAttribute('data-open-comm'))]); };
    });
  }

  /* ══ 7. 탭 4: 보고서 & HWPX & 푸른한글 ════════════════════════════════ */
  function renderReportTab() {
    var box = $('reportBox');
    if (!box) return;
    var proj = projectById(CUR_PID);
    if (!proj) {
      box.innerHTML = '<div class="card"><div class="empty">① [수행 기업·자동감지] 탭에서 사업장을 선택해 주세요.</div></div>';
      return;
    }
    var cd = getCheckDoc(proj.id);
    var comms = getProjectComms(proj.id);
    var savedSec = (D.reports && D.reports[proj.id] && D.reports[proj.id].sections) || {};
    var hwpxApi = Hwpx();
    var res = hwpxApi ? hwpxApi.resolveSections(APP_KEY, proj, cd, comms, savedSec) : { sections: [] };
    var previewHtml = hwpxApi ? hwpxApi.buildPreviewHtml(CUR_REPORT_KIND, APP_KEY, proj, cd, comms, savedSec) : '';

    var secCards = res.sections.map(function (s) {
      return '<div class="rpt-sec-card"><div class="rpt-sec-hd"><b>제' + s.no + '장 · ' + esc(s.title) + '</b><span class="sp"></span><span class="hint">' + esc(s.hint) + '</span></div>' +
        '<div class="rpt-sec-body"><textarea data-sec-key="' + esc(s.key) + '" rows="5">' + esc(s.text) + '</textarea></div></div>';
    }).join('');

    box.innerHTML =
      '<div class="card"><div class="bar">' +
        '<b>' + esc(proj.companyName) + ' · 보고서 및 HWPX 출력' + diffBadge('원클릭 .hwpx') + '</b>' +
        '<select id="reportKindSel">' +
          '<option value="comprehensive"' + (CUR_REPORT_KIND === 'comprehensive' ? ' selected' : '') + '>최종 결과보고서</option>' +
          '<option value="summary1p"' + (CUR_REPORT_KIND === 'summary1p' ? ' selected' : '') + '>핵심 개선 1P 요약</option>' +
          '<option value="checklist"' + (CUR_REPORT_KIND === 'checklist' ? ' selected' : '') + '>맞춤형 체크리스트</option>' +
        '</select>' +
        '<span class="sp"></span>' +
        '<button type="button" class="pri" id="saveReportSecBtn">원고 저장</button>' +
        '<button type="button" class="ok" id="dlHwpxBtn">HWPX 내려받기</button>' +
        '<button type="button" class="sm" id="openHangulBtn">푸른한글에서 열기 ↗</button>' +
        '<button type="button" class="sm" id="printPdfBtn">PDF 인쇄</button>' +
        '<button type="button" class="sm" id="dlCsvBtn">CSV 점검표</button>' +
      '</div></div>' +
      '<div class="report-workbench">' +
        '<div class="card"><div class="sec"><span>📝 보고서 장별 원고 편집 (비식별)</span></div><div class="rpt-sec-list">' + secCards + '</div></div>' +
        '<div class="report-side-sticky">' + previewHtml + '</div>' +
      '</div>';

    function gatherSections() {
      var out = {};
      box.querySelectorAll('[data-sec-key]').forEach(function (ta) {
        out[ta.getAttribute('data-sec-key')] = cleanText(ta.value);
      });
      return out;
    }
    if ($('reportKindSel')) {
      $('reportKindSel').onchange = function () { CUR_REPORT_KIND = $('reportKindSel').value; renderReportTab(); };
    }
    if ($('saveReportSecBtn')) {
      $('saveReportSecBtn').onclick = function () { saveReportSections(proj.id, gatherSections()); };
    }
    if ($('dlHwpxBtn')) {
      $('dlHwpxBtn').onclick = function () {
        try {
          var secs = gatherSections();
          var bytes = hwpxApi.generateHwpxBytes(CUR_REPORT_KIND, APP_KEY, proj, cd, comms, secs);
          var fname = hwpxApi.suggestedFileName(CUR_REPORT_KIND, APP_KEY, proj);
          hwpxApi.downloadHwpxBytes(bytes, fname);
          toast('한글(.hwpx) 생성 완료: ' + fname);
        } catch (err) { toast('HWPX 생성 오류: ' + (err && err.message || err)); }
      };
    }
    if ($('openHangulBtn')) {
      $('openHangulBtn').onclick = function () {
        try {
          hwpxApi.openInHangulEditor(CUR_REPORT_KIND, APP_KEY, proj, cd, comms, gatherSections());
          toast('푸른한글 편집기로 문서를 전송했습니다.');
        } catch (err) { toast('푸른한글 열기 오류: ' + (err && err.message || err)); }
      };
    }
    if ($('printPdfBtn')) {
      $('printPdfBtn').onclick = function () {
        hwpxApi.openPrintWindow(CUR_REPORT_KIND, APP_KEY, proj, cd, comms, gatherSections());
      };
    }
    if ($('dlCsvBtn')) {
      $('dlCsvBtn').onclick = function () {
        var name = hwpxApi.downloadCsv(APP_KEY, proj, cd);
        toast('CSV 내려받기 완료: ' + name);
      };
    }
  }

  /* ══ 8. 탭 5: 수습 노무사 RAG 행동 코치 & 실무 학습 ══════════════════ */
  function renderCoachTab() {
    var box = $('coachBox');
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
      var actCards = plan.actions.map(function (a, i) {
        return '<tr>' +
          '<td class="c"><input type="checkbox" data-ck="act:' + i + '" data-list="coach_act" aria-label="행동 확인"></td>' +
          '<td class="n">' + (i + 1) + '</td>' +
          '<td class="ti" title="' + esc(a.step) + '">' + esc(a.step) + '</td>' +
          '<td data-k="badge" title="' + esc(a.priority) + '"><span class="chip ' + (a.priority === '긴급' ? 'c-red' : 'c-blue') + '">' + esc(a.priority) + '</span></td>' +
          '<td class="wide" title="' + esc(a.detail) + '">' + esc(a.detail) + '</td>' +
          '<td data-k="act"><button type="button" class="sm pri" data-go-tab="' + esc(a.targetTab || 'check') + '">이동</button></td>' +
        '</tr>';
      }).join('');
      nextActionsHtml =
        '<div class="card' + diffCls(true) + '">' +
          '<div class="sec"><span>🎯 지금 해야 할 행동 (Next Action · ' + esc(plan.stageName) + ' · 준비도 ' + plan.readinessPct + '%)</span>' + diffBadge('수습 행동가이드') +
            '<span class="sp"></span><a class="act-link" href="pu-coach.html?app=' + encodeURIComponent(APP_KEY) + '" target="_blank" rel="noopener">전 사업 RAG 학습 허브 열기 ↗</a>' +
          '</div>' +
          '<div class="scroll"><table class="t" data-name="coach_act"><thead><tr><th class="c"><input type="checkbox" data-ckall="coach_act" aria-label="전체"></th><th class="n">№</th><th>실행 단계</th><th>우선순위</th><th class="wide">구체적 행동 지침</th><th data-k="act">바로가기</th></tr></thead><tbody>' + actCards + '</tbody></table></div>' +
          '<div class="bar"><span class="chip c-amber wrap-chip">자주 하는 실수: ' + esc((plan.mistakes || [])[0] || '-') + '</span><span class="chip wrap-chip">법령근거: ' + esc((plan.legalRefs || []).join(' · ')) + '</span></div>' +
        '</div>';
    }

    var hitsHtml = '';
    if (CUR_COACH_ANSWER) {
      var citList = (CUR_COACH_ANSWER.hits || []).map(function (h, i) {
        return '<div class="ind-card" style="margin-bottom:6px"><div class="ind-hd"><b>[근거 #' + (i + 1) + '] ' + esc(h.chunk.title) + '</b><span class="chip c-blue">점수 ' + h.score + '</span></div>' +
          '<div style="font-size:12px;color:var(--ink2);white-space:pre-wrap">' + esc(h.chunk.chunk_text.slice(0, 400)) + '</div></div>';
      }).join('');
      hitsHtml = '<div class="ok-banner" style="white-space:pre-wrap">' + esc(CUR_COACH_ANSWER.answer) + '</div>' + citList;
    }

    var quizHtml = (pb.quizzes || []).map(function (qz, idx) {
      var choices = qz.choices || qz.opts || [];
      return '<div class="ind-card"><div class="ind-hd"><b>Q' + (idx + 1) + '. ' + esc(qz.q) + '</b></div>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap">' +
          choices.map(function (ch, ci) {
            return '<button type="button" class="sm" data-quiz="' + idx + ':' + ci + '">' + (ci + 1) + ') ' + esc(ch) + '</button>';
          }).join('') +
        '</div><div class="hint" id="quizRes_' + idx + '"></div></div>';
    }).join('');

    box.innerHTML =
      nextActionsHtml +
      '<div class="card">' +
        '<div class="sec"><span>🧠 ' + esc(cat.name) + ' 하이브리드 RAG 검색 · 근거 기반 행동 코치</span></div>' +
        '<div class="bar">' +
          '<input type="text" id="coachQueryInput" aria-label="RAG 실무 검색 질문" placeholder="예: 6차산업 현장코칭 필수서류, 경업금지 기간 보상요건, 창구단일화 기한..." style="flex:1;min-width:220px">' +
          '<button type="button" class="pri" id="coachSearchLocalBtn">RAG 근거 검색</button>' +
          '<button type="button" class="ok" id="coachAskAiBtn">AI 선임노무사 코칭(비식별)</button>' +
        '</div>' +
        '<div id="coachResultWrap" style="padding:0 12px 12px">' + hitsHtml + '</div>' +
      '</div>' +
      '<div class="guide-grid">' +
        '<div class="ind-card"><div class="ind-hd"><b>📚 사업 핵심 플레이북</b></div><div style="font-size:12.5px;line-height:1.55">' + esc(pb.overview || cat.desc) + '</div>' +
          '<ul class="ind-ul">' + (pb.commonMistakes || []).map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul></div>' +
        '<div>' + quizHtml + '</div>' +
      '</div>';

    box.querySelectorAll('[data-go-tab]').forEach(function (b) {
      b.onclick = function () { switchTab(b.getAttribute('data-go-tab')); };
    });
    if ($('coachSearchLocalBtn')) $('coachSearchLocalBtn').onclick = function () { runCoachSearch(false); };
    if ($('coachAskAiBtn')) $('coachAskAiBtn').onclick = function () { runCoachSearch(true); };
    if ($('coachQueryInput')) {
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
  }

  /* ══ 9. 상호작용 액션 (저장 · 감지등록 · RAG · 모달) ═════════════════ */
  async function setProjectStage(pid, stageId) {
    var proj = projectById(pid);
    if (!proj) return;
    var next = Object.assign({}, proj, { stage: stageId });
    try {
      var saved = await saveRecord('projects/' + pid, pid, next, 'Project');
      D.projects[pid] = saved;
      draw();
      toast('진행 단계를 변경했습니다.');
    } catch (e) { toast('단계 저장 오류: ' + e.message); }
  }

  async function saveCurrentChecks(pid) {
    var box = $('checkBox');
    var cur = getCheckDoc(pid);
    var next = {
      id: 'main', projectId: pid, entityType: 'Document', schemaVersion: 1, contractVersion: 1,
      revision: num(cur.revision, 0),
      pre: Object.assign({}, cur.pre),
      domain: Object.assign({}, cur.domain),
      docs: Object.assign({}, cur.docs)
    };
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
    try {
      var saved = await saveRecord('reports/' + pid, pid, rec, 'Document');
      D.reports[pid] = saved;
      renderReportTab();
      toast('보고서 원고가 저장되었습니다.');
    } catch (e) { toast('원고 저장 오류: ' + e.message); }
  }

  async function handleDeleteProject(pid) {
    var proj = projectById(pid);
    if (!proj) return;
    try {
      var deleted = await softDeleteRecord('projects/' + pid, proj, 'Project');
      if (deleted && typeof deleted === 'object') D.projects[pid] = deleted;
      else D.projects[pid] = Object.assign({}, proj, { _deleted: true });
      if (CUR_PID === pid) CUR_PID = '';
      rebuildDiscoverAndRag();
      draw();
      toast('사업장을 보관삭제(_deleted) 처리했습니다.');
    } catch (e) { toast('삭제 오류: ' + e.message); }
  }

  async function importCandidate(bundle) {
    if (!bundle) return;
    var cat = getAppCat();
    var tr = (cat.tracks || [])[0] || { id: 'default', name: cat.name };
    var pid = 'pr_' + APP_KEY + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
    var rec = {
      id: pid, entityType: 'Project', schemaVersion: 1, contractVersion: 1, revision: 0,
      companyId: str(bundle.companyId),
      companyName: cleanText(bundle.companyName) || '수진기업',
      year: num(bundle.year, 2026),
      trackId: tr.id,
      trackName: tr.name,
      stage: 'collect',
      workerCount: 0,
      consultantName: (ME && ME.name) || '전담 노무사',
      status: 'active',
      summaryNote: '자동 감지 등록 (메일 ' + bundle.mailCount + ' / 톡 ' + bundle.msgCount + ')'
    };
    var saved = await saveRecord('projects/' + pid, pid, rec, 'Project');
    D.projects[pid] = saved;
    if (Array.isArray(bundle.comms)) {
      D.comms[pid] = D.comms[pid] || {};
      for (var i = 0; i < Math.min(20, bundle.comms.length); i++) {
        var cm = bundle.comms[i];
        var cid = 'cm_' + Date.now().toString(36) + '_' + i;
        var cRec = {
          id: cid, projectId: pid, entityType: 'Document', schemaVersion: 1, contractVersion: 1, revision: 0,
          source: str(cm.source || 'mail'), date: str(cm.date), subject: cleanText(cm.subject),
          maskedPreview: cleanText(cm.maskedPreview), atts: Array.isArray(cm.atts) ? cm.atts : []
        };
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

  async function importSelectedCandidates() {
    var picks = (D.discover.bundles || []).filter(function (b) { return SEL['d:' + b.key]; });
    if (!picks.length) { toast('체크박스로 후보를 먼저 선택하세요.'); return; }
    var btn = $('bulkImportCandBtn');
    if (btn) { btn.disabled = true; btn.textContent = '등록 중…'; }
    try {
      for (var i = 0; i < picks.length; i++) await importCandidate(picks[i]);
      SEL = Object.create(null);
      rebuildDiscoverAndRag();
      draw();
      toast(picks.length + '개 후보를 일괄 등록했습니다.');
    } finally {
      if ($('bulkImportCandBtn')) { $('bulkImportCandBtn').disabled = false; $('bulkImportCandBtn').textContent = '선택 후보 일괄 등록'; }
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
    for (var i = 0; i < parsed.items.length; i++) {
      var it = parsed.items[i];
      var cid = 'cm_' + it.id;
      var cRec = {
        id: cid, projectId: proj.id, entityType: 'Document', schemaVersion: 1, contractVersion: 1, revision: 0,
        source: ch, date: it.msgDate, subject: it.title, maskedPreview: it.maskedBody, atts: it.attNames || []
      };
      D.comms[proj.id][cid] = await saveRecord('comms/' + proj.id + '/' + cid, cid, cRec, 'Document');
    }
    if (ta) ta.value = '';
    rebuildDiscoverAndRag();
    draw();
    toast(parsed.items.length + '건 비식별 정리 후 인박스에 저장했습니다.');
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
    D.comms[proj.id][cid] = await saveRecord('comms/' + proj.id + '/' + cid, cid, cRec, 'Document');
    toast('파일 비식별 저장 완료: ' + file.name);
  }

  function runCoachSearch(useAi) {
    var qEl = $('coachQueryInput');
    var q = str(qEl && qEl.value);
    if (!q) { toast('검색할 질문을 입력해 주세요.'); return; }
    var R = Rag();
    if (!R || !D.ragIndex) return;
    var aiBtn = $('coachAskAiBtn');
    if (useAi && aiBtn) { aiBtn.disabled = true; aiBtn.textContent = 'AI 코칭 조회 중…'; }
    R.askGroundedCoach(D.ragIndex, q, {
      appKey: APP_KEY,
      useAi: !!useAi && !PREVIEW_MODE,
      auth: fb ? fb.auth() : null,
      manual: true
    }).then(function (res) {
      CUR_COACH_ANSWER = res;
      renderCoachTab();
    }).catch(function () {
      if (aiBtn) { aiBtn.disabled = false; aiBtn.textContent = 'AI 선임노무사 코칭(비식별)'; }
    });
  }

  function openNewProjectModal() {
    var m = $('modal'), box = $('mbox');
    if (!m || !box) return;
    LAST_FOCUS_EL = document.activeElement;
    var cat = getAppCat();
    var opts = (cat.tracks || []).map(function (t) {
      return '<option value="' + esc(t.id) + '">' + esc(t.name) + '</option>';
    }).join('');
    box.innerHTML =
      '<div class="mhd"><b id="mhdTitle">+ ' + esc(cat.name) + ' 신규 사업장 등록</b><span class="sp"></span><button type="button" class="sm" id="mCloseBtn">닫기</button></div>' +
      '<div class="mbd">' +
        '<div class="fr"><label for="npCoName">수진기업명</label><div class="fv"><input type="text" id="npCoName" placeholder="예: (주)푸른샘식품"></div></div>' +
        '<div class="fr"><label for="npTrack">세부 트랙</label><div class="fv"><select id="npTrack">' + opts + '</select></div></div>' +
        '<div class="fr"><label for="npYear">수행연도</label><div class="fv"><input type="number" id="npYear" value="2026"></div></div>' +
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
      var trObj = (cat.tracks || []).find(function (t) { return t.id === trId; }) || { id: trId, name: cat.shortName };
      var pid = 'pr_' + APP_KEY + '_' + Date.now().toString(36);
      var rec = {
        id: pid, entityType: 'Project', schemaVersion: 1, contractVersion: 1, revision: 0,
        companyName: co, year: num($('npYear').value, 2026),
        trackId: trObj.id, trackName: trObj.name, stage: 'intake',
        workerCount: num($('npWorkers').value, 0),
        consultantName: (ME && ME.name) || '전담 노무사',
        status: 'active', summaryNote: cleanText($('npNote').value)
      };
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

  function switchTab(tab) {
    CUR_TAB = tab || 'projects';
    document.querySelectorAll('.tabs button[data-t]').forEach(function (b) {
      var on = b.getAttribute('data-t') === CUR_TAB;
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
    renderTopMeta();
    if (CUR_TAB === 'projects') renderProjectsTab();
    else if (CUR_TAB === 'check') renderCheckTab();
    else if (CUR_TAB === 'intake') renderIntakeTab();
    else if (CUR_TAB === 'report') renderReportTab();
    else if (CUR_TAB === 'coach') renderCoachTab();
  }

  function bindEvents() {
    document.querySelectorAll('.tabs button[data-t]').forEach(function (b) {
      b.onclick = function () { switchTab(b.getAttribute('data-t')); };
    });
    if ($('projQ')) $('projQ').oninput = function () { if (CUR_TAB === 'projects') renderProjectsTab(); };
    if ($('newProjBtn')) $('newProjBtn').onclick = openNewProjectModal;
    if ($('scanAllBtn')) $('scanAllBtn').onclick = function () { rebuildDiscoverAndRag(); draw(); toast('메일·카톡 자동분류를 재실행했습니다.'); };
    if ($('reloadBtn')) $('reloadBtn').onclick = function () { reload(SESSION_EPOCH, ME && ME.uid); };
    if ($('outBtn')) $('outBtn').onclick = function () { if (fb && fb.auth) fb.auth().signOut(); };

    document.addEventListener('change', function (e) {
      var t = e.target;
      if (!t || t.type !== 'checkbox') return;
      var allList = t.getAttribute('data-ckall');
      if (allList) {
        document.querySelectorAll('input[type="checkbox"][data-list="' + allList + '"]').forEach(function (cb) {
          cb.checked = t.checked;
          var k = cb.getAttribute('data-ck');
          if (k) SEL[k] = t.checked;
        });
        return;
      }
      var k = t.getAttribute('data-ck');
      if (k) SEL[k] = t.checked;
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
      var authUid = (u && u.uid) ? String(u.uid) : '';
      if ($('outBtn')) $('outBtn').style.display = authUid ? '' : 'none';
      if (!authUid) {
        if ($('lock')) $('lock').style.display = 'none';
        if (global.PuGate) global.PuGate.show();
        return;
      }
      var epoch = ++SESSION_EPOCH;
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
    switchTab: switchTab
  };
})(typeof window !== 'undefined' ? window : globalThis);
