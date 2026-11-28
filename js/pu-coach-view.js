/* 푸른통합시스템 — 수습·주니어 노무사 RAG 실무코치 & 학습 허브 (pu-coach.html)
 * (브라우저 window.PuCoachView)
 *
 * 4개 탭:
 *   1. search    : 통합 하이브리드 RAG 검색 & AI 선임노무사 코치 (18개 사업 전체·개별 필터)
 *   2. playbooks : 18개 사업별 표준 플레이북 · 단계별 해야 할 일 · 흔한 실수 · 법령근거
 *   3. cases     : 비식별 수행사례 아카이브 & 수습 노무사 실무 셀프 퀴즈
 *   4. notes     : 수습 학습 노트 저장(coach_rag/notes) & Supabase 호환 RAG JSONL 내보내기
 */
(function (global) {
  'use strict';

  var SESSION_EPOCH = 0;
  var fb = null;
  var fbDb = null;
  var ME = null;
  var gate = null;
  var PREVIEW_MODE = false;
  var DIFF_HIGHLIGHT = true;
  var CUR_TAB = 'search';
  var CUR_APP_FILTER = 'all';
  var CUR_ANSWER = null;

  var D = {
    notes: {},
    msgIntake: {},
    projectsByApp: {},
    companies: [],
    ragIndex: null
  };
  var SEL = Object.create(null);

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
  function cleanText(raw) {
    var I = Intake();
    return I ? I.sanitizeText(str(raw)) : str(raw);
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

  function notesList() {
    return Object.keys(D.notes || {}).map(function (k) {
      return Object.assign({ id: k }, D.notes[k]);
    }).filter(function (n) { return n && !n._deleted; })
      .sort(function (a, b) { return num(b.updatedAt, 0) - num(a.updatedAt, 0); });
  }

  function rebuildIndex() {
    var C = Cat();
    var R = Rag();
    if (C && R) {
      D.ragIndex = R.buildKnowledgeIndex(C, {
        msgIntake: D.msgIntake,
        projectsByApp: D.projectsByApp,
        coachNotes: D.notes
      });
    }
  }

  function buildPreviewData() {
    D.notes = {
      nt_pv_1: {
        id: 'nt_pv_1', entityType: 'Document', schemaVersion: 1, contractVersion: 1, revision: 1,
        createdAt: Date.now() - 864e5, updatedAt: Date.now() - 3600e3,
        appKey: 'sixthind', title: '6차산업 현장코칭 방문 전 반드시 확인할 3가지',
        tags: '6차산업, 농촌융복합, 제63조',
        body: '1) 농업회사법인 근로자가 제조·체험·판매에 종사하면 근기법 제63조 농업 적용제외가 부인되므로 근로계약서와 출근부를 분리 점검합니다.\n2) 인증/현장코칭 결과보고서 날인본을 기한 내 시스템에 업로드해야 정산이 완료됩니다.'
      },
      nt_pv_2: {
        id: 'nt_pv_2', entityType: 'Document', schemaVersion: 1, contractVersion: 1, revision: 1,
        createdAt: Date.now() - 1728e5, updatedAt: Date.now() - 7200e3,
        appKey: 'evalcomp', title: '평가보상·임금체계 불이익변경 판단 요령',
        tags: '평가보상, 취업규칙, 불이익변경',
        body: '고정수당을 폐지하거나 성과급 비중을 높여 일부 근로자에게 불리해질 수 있으면 근로기준법 제94조 불이익변경 절차(근로자 과반수 또는 노조 동의)를 거쳐야 안전합니다.'
      }
    };
    D.projectsByApp = {
      sixthind: [{ id: 'cs_pv_si1', companyName: '(주)가나농업법인', year: 2026, trackName: '농촌융복합 현장코칭', stage: 'visit', summaryNote: '가공공장 근로자와 영농 인력 근로시간·휴게 구분 설계' }],
      techprotect: [{ id: 'cs_pv_tp1', companyName: '(주)다라정밀', year: 2025, trackName: '통합 기술보호지원반', stage: 'followup', summaryNote: '입사 통합 보안서약서·직무발명보상규정 정비 완료' }],
      evalcomp: [{ id: 'cs_pv_ec1', companyName: '(주)마바전자', year: 2026, trackName: '성과평가·KPI 연동', stage: 'design', summaryNote: '직무급 등급별 KPI 지표 및 공정평가 이의신청 절차 신설' }]
    };
  }

  function safeVal(path) {
    if (!fbDb) return Promise.resolve(null);
    return fbDb.ref(path).once('value').then(function (s) { return s ? s.val() : null; }).catch(function () { return null; });
  }

  async function reload(epoch, uid) {
    if (PREVIEW_MODE) {
      buildPreviewData();
      rebuildIndex();
      draw();
      return;
    }
    if (!fbDb) return;
    if ($('syncStateChip')) { $('syncStateChip').style.display = ''; $('syncStateChip').textContent = '지식고 색인 중…'; }
    var res = await Promise.all([
      safeVal('coach_rag/notes'),
      safeVal('msg_intake/items'),
      safeVal('data/companies')
    ]);
    if (epoch !== SESSION_EPOCH || (ME && ME.uid !== uid)) return;
    D.notes = res[0] || {};
    D.msgIntake = res[1] || {};
    var co = res[2] && res[2].v !== undefined ? res[2].v : res[2];
    D.companies = Array.isArray(co) ? co : (co && typeof co === 'object' ? Object.values(co) : []);
    var C = Cat();
    var apps = C ? C.listNew12() : [];
    var projResults = await Promise.all(apps.map(function (a) {
      return safeVal(a.rtdbRoot + '/projects').then(function (v) { return [a.key, v || {}]; });
    }));
    if (epoch !== SESSION_EPOCH || (ME && ME.uid !== uid)) return;
    D.projectsByApp = {};
    projResults.forEach(function (pair) { D.projectsByApp[pair[0]] = pair[1]; });
    rebuildIndex();
    if ($('syncStateChip')) $('syncStateChip').textContent = 'RAG 색인 완료 (' + (D.ragIndex ? D.ragIndex.chunks.length : 0) + '청크)';
    draw();
  }

  function renderRecentDiffBar() {
    var el = $('recentDiffBarWrap');
    if (!el) return;
    el.innerHTML = '<div id="recent-diff-bar" class="note ' + (DIFF_HIGHLIGHT ? 'code-diff-box' : '') + '" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">' +
      '<span class="chip c-blue">변경됨 · UI 통일</span>' +
      '<b>🧠 실무코치·RAG학습:</b>' +
      '<span class="hint">괴롭힘 조사 동일 슬림 UI · 18개 컨설팅 플레이북·수행사례·법령근거 하이브리드 RAG 검색</span>' +
      '<span class="sp"></span>' +
      '<button type="button" class="sm pri" data-diff-tab="search">RAG 검색</button>' +
      '<button type="button" class="sm" data-diff-tab="playbooks">18대 플레이북</button>' +
      '<button type="button" class="sm" data-diff-tab="cases">사례·퀴즈</button>' +
      '<button type="button" class="sm" id="toggleDiffBtn">' + (DIFF_HIGHLIGHT ? '표시 끄기' : '표시 켜기') + '</button>' +
      '</div>';
    el.querySelectorAll('[data-diff-tab]').forEach(function (b) {
      b.onclick = function () { switchTab(b.getAttribute('data-diff-tab')); };
    });
    if ($('toggleDiffBtn')) $('toggleDiffBtn').onclick = function () { DIFF_HIGHLIGHT = !DIFF_HIGHLIGHT; draw(); };
  }

  function renderKpis() {
    var box = $('kpiRow');
    if (!box) return;
    var C = Cat();
    var chunkCnt = D.ragIndex ? D.ragIndex.chunks.length : 0;
    var appCnt = C ? C.listAll().length : 18;
    var caseCnt = Object.keys(D.projectsByApp).reduce(function (acc, k) {
      var v = D.projectsByApp[k];
      return acc + (Array.isArray(v) ? v.length : Object.keys(v || {}).length);
    }, 0);
    box.innerHTML =
      '<div class="kpi k-blue"><span>색인 RAG 지식청크</span><b>' + chunkCnt + '건</b></div>' +
      '<div class="kpi"><span>탑재 컨설팅 사업</span><b>' + appCnt + '개</b></div>' +
      '<div class="kpi k-green"><span>비식별 수행사례</span><b>' + caseCnt + '건</b></div>' +
      '<div class="kpi k-amber"><span>수습 학습노트</span><b>' + notesList().length + '건</b></div>' +
      '<div class="kpi"><span>선택 필터</span><b>' + esc(CUR_APP_FILTER === 'all' ? '전 사업' : ((C && C.get(CUR_APP_FILTER) && C.get(CUR_APP_FILTER).shortName) || CUR_APP_FILTER)) + '</b></div>';
  }

  function runRagQuery(useAi, presetQ) {
    if (presetQ && $('ragQueryInput')) $('ragQueryInput').value = presetQ;
    var q = str($('ragQueryInput') && $('ragQueryInput').value);
    if (!q) { toast('검색할 업무 질문이나 키워드를 입력하세요.'); return; }
    var R = Rag();
    if (!R || !D.ragIndex) return;
    var aiBtn = $('ragAiBtn');
    if (useAi && aiBtn) { aiBtn.disabled = true; aiBtn.textContent = 'AI 코칭 조회 중…'; }
    var redactions = [];
    Object.keys(D.projectsByApp || {}).forEach(function (ak) {
      var raw = D.projectsByApp[ak];
      var list = Array.isArray(raw) ? raw : Object.values(raw || {});
      list.forEach(function (p) { if (p && !p._deleted && p.companyName) redactions.push(p.companyName); });
    });
    (D.companies || []).forEach(function (c) { if (c && c.name) redactions.push(c.name); });
    R.askGroundedCoach(D.ragIndex, q, {
      appKey: CUR_APP_FILTER,
      useAi: !!useAi && !PREVIEW_MODE,
      auth: fb ? fb.auth() : null,
      manual: true,
      limit: 6,
      redactTerms: redactions
    }).then(function (res) {
      if (aiBtn) { aiBtn.disabled = false; aiBtn.textContent = 'AI 선임노무사 코칭(비식별)'; }
      CUR_ANSWER = res;
      renderSearchTab();
    }).catch(function () {
      if (aiBtn) { aiBtn.disabled = false; aiBtn.textContent = 'AI 선임노무사 코칭(비식별)'; }
    });
  }

  function renderSearchTab() {
    var box = $('searchResultsBox');
    if (!box) return;
    if (!CUR_ANSWER) {
      box.innerHTML = '<div class="empty">위 검색창에 궁금한 실무 상황(예: "6차산업 근로기준법 63조", "평가보상 불이익변경", "기술보호 경업금지")을 입력하거나 빠른 질문을 눌러보세요.</div>';
      return;
    }
    var cards = (CUR_ANSWER.hits || []).map(function (h, i) {
      var ch = h.chunk;
      return '<div class="ind-card" style="margin-bottom:8px">' +
        '<div class="ind-hd"><b>[근거 #' + (i + 1) + '] ' + esc(ch.title) + '</b><span class="chip c-blue">' + esc(ch.appName) + '</span><span class="chip">점수 ' + h.score + '</span></div>' +
        '<div style="font-size:12.5px;color:var(--ink2);white-space:pre-wrap;line-height:1.55">' + esc(ch.chunk_text) + '</div>' +
      '</div>';
    }).join('');
    box.innerHTML =
      '<div class="ok-banner" style="white-space:pre-wrap;line-height:1.6">' + esc(CUR_ANSWER.answer) + '</div>' +
      (cards || '<div class="hint">일치하는 근거 문서가 없습니다.</div>');
  }

  function renderPlaybooksTab() {
    var box = $('playbooksBox');
    if (!box) return;
    var C = Cat();
    var apps = C ? C.listAll() : [];
    var filtered = CUR_APP_FILTER === 'all' ? apps : apps.filter(function (a) { return a.key === CUR_APP_FILTER; });
    box.innerHTML = '<div class="guide-grid">' + filtered.map(function (app) {
      var pb = app.ragPlaybook || {};
      var stagesHtml = (pb.stageActions || []).map(function (sa) {
        return '<li><b>[' + esc(sa.stageId) + ']</b> ' + esc((sa.mustDo || []).join(' · ')) +
          (sa.deliverables && sa.deliverables.length ? ' <span class="chip">' + esc(sa.deliverables.join(', ')) + '</span>' : '') + '</li>';
      }).join('');
      return '<div class="ind-card">' +
        '<div class="ind-hd"><b>' + esc(app.icon + ' ' + app.name) + '</b><span class="chip c-blue">' + esc(app.agency || '-') + '</span><span class="sp"></span>' +
          '<a class="act-link" href="' + esc(app.htmlFile) + '" target="_blank" rel="noopener">앱 열기 ↗</a></div>' +
        '<div style="font-size:12.5px;line-height:1.5">' + esc(pb.overview || app.desc) + '</div>' +
        '<ul class="ind-ul">' + stagesHtml + '</ul>' +
        '<div class="hint">주의: ' + esc((pb.commonMistakes || []).join(' / ') || '-') + '</div>' +
      '</div>';
    }).join('') + '</div>';
  }

  function renderCasesTab() {
    var box = $('casesBox');
    if (!box) return;
    var C = Cat();
    var apps = C ? C.listAll() : [];
    var caseRows = [];
    Object.keys(D.projectsByApp || {}).forEach(function (ak) {
      if (CUR_APP_FILTER && CUR_APP_FILTER !== 'all' && ak !== CUR_APP_FILTER) return;
      var app = C && C.get(ak);
      var raw = D.projectsByApp[ak];
      var list = Array.isArray(raw) ? raw : Object.values(raw || {});
      list.forEach(function (p) {
        if (!p || p._deleted) return;
        caseRows.push({ appKey: ak, appName: app ? app.name : ak, p: p });
      });
    });

    var trs = caseRows.map(function (r, idx) {
      var p = r.p;
      return '<tr>' +
        '<td class="c"><input type="checkbox" data-ck="cs:' + idx + '" data-list="cases" aria-label="사례 선택"></td>' +
        '<td class="n">' + (idx + 1) + '</td>' +
        '<td class="ti" title="' + esc(p.companyName || '비식별 기업') + '">' + esc(p.companyName || '비식별 기업') + '</td>' +
        '<td data-k="badge" title="' + esc(r.appName) + '"><span class="chip c-blue">' + esc(r.appName) + '</span></td>' +
        '<td title="' + esc(String(p.year || 2026)) + '">' + esc(String(p.year || 2026)) + '</td>' +
        '<td class="wide" title="' + esc(p.summaryNote || '-') + '">' + esc(p.summaryNote || '-') + '</td>' +
        '<td data-k="act"><a class="act-link" href="' + esc((C && C.get(r.appKey) && C.get(r.appKey).htmlFile) || 'enter.html') + '" target="_blank" rel="noopener">앱 보기</a></td>' +
      '</tr>';
    }).join('');

    var quizzes = [];
    apps.forEach(function (a) {
      if (CUR_APP_FILTER && CUR_APP_FILTER !== 'all' && a.key !== CUR_APP_FILTER) return;
      var qs = (a.ragPlaybook && a.ragPlaybook.quizzes) || [];
      qs.forEach(function (q, i) { quizzes.push({ app: a, q: q, qid: a.key + '_' + i }); });
    });

    var qzHtml = quizzes.map(function (item, idx) {
      var choices = item.q.choices || item.q.opts || [];
      return '<div class="ind-card"><div class="ind-hd"><b>[' + esc(item.app.shortName) + '] Q' + (idx + 1) + '. ' + esc(item.q.q) + '</b></div>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap">' +
          choices.map(function (ch, ci) {
            return '<button type="button" class="sm" data-hqz="' + idx + ':' + ci + '">' + (ci + 1) + ') ' + esc(ch) + '</button>';
          }).join('') +
        '</div><div class="hint" id="hqzOut_' + idx + '"></div></div>';
    }).join('');

    box.innerHTML =
      '<div class="card"><div class="sec"><span>📂 비식별 수행사례 아카이브 (' + caseRows.length + '건)</span></div>' +
        (caseRows.length
          ? '<div class="scroll"><table class="t" data-name="cases"><thead><tr><th class="c"><input type="checkbox" data-ckall="cases" aria-label="전체"></th><th class="n">№</th><th>수진기업(비식별)</th><th>컨설팅 사업</th><th>연도</th><th class="wide">핵심 수행 내용</th><th data-k="act">열기</th></tr></thead><tbody>' + trs + '</tbody></table></div>'
          : '<div class="empty">아직 등록된 수행사례가 없습니다. 각 전용 앱에서 사업장을 등록하면 자동으로 누적 색인됩니다.</div>') +
      '</div>' +
      '<div class="card"><div class="sec"><span>✍️ 수습·주니어 노무사 실무 퀴즈 (' + quizzes.length + '문항)</span></div>' +
        '<div class="guide-grid" style="padding:10px">' + qzHtml + '</div></div>';

    box.querySelectorAll('[data-hqz]').forEach(function (b) {
      b.onclick = function () {
        var ps = b.getAttribute('data-hqz').split(':');
        var item = quizzes[Number(ps[0])];
        if (!item) return;
        var ansIdx = item.q.answerIndex != null ? item.q.answerIndex : item.q.ans;
        var expTxt = item.q.explain || item.q.exp || '';
        var ok = Number(ps[1]) === Number(ansIdx);
        var out = $('hqzOut_' + ps[0]);
        if (out) out.textContent = (ok ? '✅ 정답! ' : '❌ 다시 확인: ') + str(expTxt);
      };
    });
  }

  function renderNotesTab() {
    var box = $('notesBox');
    if (!box) return;
    var list = notesList().filter(function (n) {
      return !CUR_APP_FILTER || CUR_APP_FILTER === 'all' || str(n.appKey) === CUR_APP_FILTER;
    });
    var trs = list.map(function (n, i) {
      return '<tr>' +
        '<td class="c"><input type="checkbox" data-ck="nt:' + esc(n.id) + '" data-list="notes" aria-label="선택"></td>' +
        '<td class="n">' + (i + 1) + '</td>' +
        '<td class="ti" title="' + esc(n.title) + '">' + esc(n.title) + '</td>' +
        '<td data-k="badge" title="' + esc(n.appKey) + '"><span class="chip c-blue">' + esc(n.appKey) + '</span></td>' +
        '<td title="' + esc(n.tags || '-') + '">' + esc(n.tags || '-') + '</td>' +
        '<td class="wide" title="' + esc(n.body) + '">' + esc(n.body) + '</td>' +
        '<td data-k="act"><button type="button" class="sm danger" data-del-note="' + esc(n.id) + '">보관삭제</button></td>' +
      '</tr>';
    }).join('');
    box.innerHTML =
      '<div class="sec"><span>📚 저장된 수습 실무 학습 노트 (' + list.length + '건)</span><span class="sp"></span>' +
        '<button type="button" class="ok sm" id="exportJsonlBtn">RAG JSONL 내려받기 (erp_rag_schema 호환)</button></div>' +
      (list.length
        ? '<div class="scroll"><table class="t" data-name="notes"><thead><tr><th class="c"><input type="checkbox" data-ckall="notes" aria-label="전체"></th><th class="n">№</th><th>노트 제목</th><th>사업</th><th>태그</th><th class="wide">실무 요약</th><th data-k="act">관리</th></tr></thead><tbody>' + trs + '</tbody></table></div>'
        : '<div class="empty">아직 작성된 학습 노트가 없습니다. 위 입력 양식으로 첫 노트를 남겨보세요.</div>');

    if ($('exportJsonlBtn')) {
      $('exportJsonlBtn').onclick = function () {
        var R = Rag();
        if (!R || !D.ragIndex) return;
        var txt = R.exportRagJsonl(D.ragIndex);
        var blob = new Blob([txt], { type: 'application/x-ndjson;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'pureun_consult_rag_corpus.jsonl';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
        toast('RAG JSONL 내보내기를 완료했습니다.');
      };
    }
    box.querySelectorAll('[data-del-note]').forEach(function (b) {
      b.onclick = async function () {
        var id = b.getAttribute('data-del-note');
        var prev = D.notes[id];
        if (!prev) return;
        try {
          if (PREVIEW_MODE || !fbDb || !gate) {
            D.notes[id] = Object.assign({}, prev, { _deleted: true });
          } else {
            await gate.remove(fbDb.ref('coach_rag/notes/' + id), prev, { entityType: 'Document' });
            D.notes[id] = Object.assign({}, prev, { _deleted: true });
          }
          rebuildIndex();
          draw();
          toast('학습 노트를 보관삭제했습니다.');
        } catch (err) {
          toast('노트 삭제 오류: ' + (err && err.message || err));
        }
      };
    });
  }

  async function saveNewNote() {
    var title = cleanText($('noteTitleInput') && $('noteTitleInput').value);
    var body = cleanText($('noteBodyInput') && $('noteBodyInput').value);
    var appKey = ($('noteAppSel') && $('noteAppSel').value) || 'sixthind';
    var tags = cleanText($('noteTagsInput') && $('noteTagsInput').value);
    if (!title || !body) { toast('제목과 내용을 모두 입력하세요.'); return; }
    var btn = $('saveNoteBtn');
    if (btn) { btn.disabled = true; btn.textContent = '저장 중…'; }
    var nid = 'nt_' + Date.now().toString(36);
    var rec = {
      id: nid, entityType: 'Document', schemaVersion: 1, contractVersion: 1, revision: 0,
      createdBy: (ME && ME.uid) || 'preview', appKey: appKey, title: title, tags: tags, body: body
    };
    try {
      if (PREVIEW_MODE || !fbDb || !gate) {
        rec.createdAt = Date.now();
        rec.updatedAt = rec.createdAt;
        rec.revision = 1;
        D.notes[nid] = rec;
      } else {
        var res = await gate.save(fbDb.ref('coach_rag/notes/' + nid), rec, { entityType: 'Document', allowPendingCompany: true });
        D.notes[nid] = (res && res.snapshot && typeof res.snapshot.val === 'function') ? res.snapshot.val() : rec;
      }
      if ($('noteTitleInput')) $('noteTitleInput').value = '';
      if ($('noteBodyInput')) $('noteBodyInput').value = '';
      rebuildIndex();
      draw();
      toast('수습 학습 노트를 저장하고 RAG 색인에 즉시 반영했습니다.');
    } catch (err) {
      toast('노트 저장 오류: ' + (err && err.message || err));
    } finally {
      if ($('saveNoteBtn')) { $('saveNoteBtn').disabled = false; $('saveNoteBtn').textContent = '학습 노트 저장 & 색인'; }
    }
  }

  function populateAppSelects() {
    var C = Cat();
    var apps = C ? C.listAll() : [];
    var filterSel = $('appFilterSel');
    if (filterSel) {
      filterSel.innerHTML = '<option value="all">전체 18개 사업</option>' +
        apps.map(function (a) { return '<option value="' + esc(a.key) + '"' + (a.key === CUR_APP_FILTER ? ' selected' : '') + '>' + esc(a.icon + ' ' + a.name) + '</option>'; }).join('');
      filterSel.onchange = function () { CUR_APP_FILTER = filterSel.value; draw(); };
    }
    var noteSel = $('noteAppSel');
    if (noteSel) {
      noteSel.innerHTML = apps.map(function (a) { return '<option value="' + esc(a.key) + '">' + esc(a.icon + ' ' + a.name) + '</option>'; }).join('');
    }
  }

  function switchTab(t) {
    CUR_TAB = t || 'search';
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
    renderKpis();
    if (CUR_TAB === 'search') renderSearchTab();
    else if (CUR_TAB === 'playbooks') renderPlaybooksTab();
    else if (CUR_TAB === 'cases') renderCasesTab();
    else if (CUR_TAB === 'notes') renderNotesTab();
  }

  function bindEvents() {
    document.querySelectorAll('.tabs button[data-t]').forEach(function (b) {
      b.onclick = function () { switchTab(b.getAttribute('data-t')); };
    });
    document.querySelectorAll('[data-quick-q]').forEach(function (b) {
      b.onclick = function () { runRagQuery(false, b.getAttribute('data-quick-q')); };
    });
    if ($('ragSearchBtn')) $('ragSearchBtn').onclick = function () { runRagQuery(false); };
    if ($('ragAiBtn')) $('ragAiBtn').onclick = function () { runRagQuery(true); };
    if ($('ragQueryInput')) $('ragQueryInput').onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); runRagQuery(false); } };
    if ($('saveNoteBtn')) $('saveNoteBtn').onclick = saveNewNote;
    if ($('reloadBtn')) $('reloadBtn').onclick = function () { reload(SESSION_EPOCH, ME && ME.uid); };
    if ($('outBtn')) $('outBtn').onclick = function () { if (fb && fb.auth) fb.auth().signOut(); };
    document.addEventListener('change', function (e) {
      var t = e.target;
      if (!t || t.type !== 'checkbox') return;
      var allList = t.getAttribute('data-ckall');
      if (allList) {
        document.querySelectorAll('input[type="checkbox"][data-list="' + cssEsc(allList) + '"]').forEach(function (cb) {
          cb.checked = t.checked;
          var k = cb.getAttribute('data-ck');
          if (k) SEL[k] = t.checked;
        });
        return;
      }
      var k = t.getAttribute('data-ck');
      if (k) SEL[k] = t.checked;
    });
    populateAppSelects();
  }

  function lockScreen(why) {
    if ($('app')) $('app').style.display = 'none';
    if ($('lock')) $('lock').style.display = 'block';
    if ($('lockWhy')) $('lockWhy').textContent = why || '';
  }

  function boot(firebaseInstance) {
    fb = firebaseInstance;
    fbDb = fb && fb.database ? fb.database() : null;
    if (typeof location !== 'undefined') {
      var sp = new URLSearchParams(location.search || '');
      if (sp.get('app')) CUR_APP_FILTER = str(sp.get('app'));
    }
    bindEvents();
    if (isLocalPreviewAllowed()) {
      PREVIEW_MODE = true;
      ME = { uid: 'preview', sid: 'P000', name: '점검미리보기' };
      if ($('lock')) $('lock').style.display = 'none';
      if ($('app')) $('app').style.display = '';
      if ($('who')) $('who').textContent = '미리보기 모드(읽기전용)';
      reload(++SESSION_EPOCH, 'preview');
      return;
    }
    if (!fb || !fb.auth) { lockScreen('Firebase 인증을 초기화할 수 없습니다.'); return; }
    try { fb.auth().setPersistence(fb.auth.Auth.Persistence.LOCAL); } catch (e) {}
    fb.auth().onAuthStateChanged(async function (u) {
      var epoch = ++SESSION_EPOCH;
      var authUid = (u && u.uid) ? String(u.uid) : '';
      if ($('outBtn')) $('outBtn').style.display = authUid ? '' : 'none';
      if (!authUid) {
        ME = null;
        gate = null;
        D = { notes: {}, msgIntake: {}, projectsByApp: {}, companies: [], ragIndex: null };
        if ($('lock')) $('lock').style.display = 'none';
        if ($('app')) $('app').style.display = 'none';
        if (global.PuGate) global.PuGate.show();
        return;
      }
      if (global.PuGate) global.PuGate.hide();
      var roleVal = {};
      try { roleVal = (await fbDb.ref('uid_roles/' + authUid).once('value')).val() || {}; } catch (e) {}
      if (epoch !== SESSION_EPOCH) return;
      if (roleVal.status !== 'active' || !roleVal.sid) { lockScreen('재직 중인 직원 계정이 아닙니다.'); return; }
      ME = { uid: authUid, sid: String(roleVal.sid), name: String(roleVal.name || '') };
      gate = wrapSnapGuard(global.PuOntologyWrite.createGateway({ mode: 'enforce', actor: ME.sid }));
      if ($('lock')) $('lock').style.display = 'none';
      if ($('app')) $('app').style.display = '';
      await reload(epoch, authUid);
    });
  }

  global.PuCoachView = { boot: boot, reload: reload, switchTab: switchTab };
})(typeof window !== 'undefined' ? window : globalThis);
