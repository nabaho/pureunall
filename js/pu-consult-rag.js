/* 푸른통합시스템 — 수습·주니어 노무사용 하이브리드 RAG 검색 · 행동 코치 · 학습 엔진
 * (브라우저 window.PuConsultRag / Node module.exports 겸용)
 *
 * 맡는 일:
 *   1. 12개 신규 사업 + 기존 6개 사업 플레이북 · 과거 비식별 수행사례 · 수습 메모를 통합 RAG 청크로 색인
 *      (gemini-autopush/erp_rag_schema.sql 과 호환되는 record_key/domain/chunk_text 구조 + JSONL 내보내기)
 *   2. 한국어 노무 컨설팅 유의어 확장 + 2-gram + BM25 하이브리드 검색 (외부 API 없이 0원 즉시 검색)
 *   3. 현재 사업장의 진행단계·체크리스트·미정리 메일/카톡을 읽어 "지금 내가 해야 할 행동 TOP 5" 결정론적 추천
 *   4. 근거 강제(Zero-Hallucination) 프롬프트 조립 및 PuAiCall(readDoc) 비식별 AI 코칭 연계
 */
(function (root, factory) {
  'use strict';
  var isNode = typeof module === 'object' && module.exports;
  var Cat = isNode ? require('./pu-consult-catalogs.js') : root.PuConsultCatalogs;
  var Intake = isNode ? require('./pu-consult-intake.js') : root.PuConsultIntake;
  var api = factory(root, Cat, Intake);
  if (isNode) module.exports = api;
  if (root) root.PuConsultRag = api;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this), function (root, Cat, Intake) {
  'use strict';

  function str(v) { return v == null ? '' : String(v).trim(); }
  function cleanText(v) {
    var s = str(v);
    return Intake ? Intake.sanitizeText(s) : s;
  }

  /* ── 한국어 노무·컨설팅 도메인 유의어 그룹 ── */
  var SYNONYM_GROUPS = [
    ['6차산업', '육차산업', '농촌융복합', '농촌융복합산업', '현장코칭', '농업회사법인', '영농조합', '제63조', '계절근로'],
    ['기술보호', '기술보호지원반', '기술보호울타리', '영업비밀', '비밀관리성', '비밀유지서약', '경업금지', '전직금지', '직무발명'],
    ['현장클리닉', '비즈니스지원단', '비지니스지원단', '상담위원', '방문확인서'],
    ['상공회의소', '충남북부상의', '서산상의', '대한상의', '업체방문확인서', '자문결과보고서'],
    ['기초인사노무', '근로계약서', '연봉계약서', '도급계약서', '프리랜서', '근로자성', '포괄임금', '통상임금', '고정ot', '취업규칙'],
    ['평가보상', '인사평가', '성과평가', '역량평가', '직무분석', '직무급', '성과급', '인센티브', 'kpi', 'mbo', 'pip', '성과개선', '불이익변경'],
    ['공공기관', '사회서비스원', '공무직', '돌봄종사자', '휴게시간', '용역원가', '통합공시', '알리오'],
    ['출산육아', '육아휴직', '육아지원3법', '배우자출산휴가', '난임휴가', '가족친화', '유연근무', '재택근무', '시차출퇴근'],
    ['사회적기업', '씨앗컨설팅', '예비사회적기업', '사회적경제', 'svi', '취약계층', '유급근로자'],
    ['자율점검', '근로감독', '기초노동질서', '시정지시', '모의감독', '노무진단', '서류보존', '노사협의회'],
    ['단체교섭', '임단협', '창구단일화', '교섭요구', '공고', '타임오프', '근로시간면제', '부당노동행위', '단체협약'],
    ['특화위탁', '중진공', '혁신바우처', '통상변화대응', '삼성협력', '경비원', '감단직', '이음센터', '직업계고', '공정채용', '채용절차법'],
    ['일터혁신', '일터상생혁신', '노사발전재단', '중간보고', '이행점검확인서'],
    ['산업일자리전환', '구조혁신', 'kmac', '충남경제진흥원', '노동전환', '정책매니저'],
    ['안전보건', '중대재해', '위험성평가', '2인1조', '고위험기인물', '7대핵심요소'],
    ['직장내괴롭힘', '성희롱', '비밀유지', '외부조사', '3요건', '분리조치']
  ];

  var SYN_MAP = Object.create(null);
  SYNONYM_GROUPS.forEach(function (grp) {
    grp.forEach(function (term) {
      var k = term.toLowerCase();
      if (!SYN_MAP[k]) SYN_MAP[k] = [];
      grp.forEach(function (other) {
        var o = other.toLowerCase();
        if (SYN_MAP[k].indexOf(o) < 0) SYN_MAP[k].push(o);
      });
    });
  });

  function tokenize(text, expandSynonyms) {
    var s = str(text).toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!s) return [];
    var words = s.split(' ').filter(Boolean);
    var tokens = [];
    var seen = Object.create(null);

    function add(t) {
      if (!t || seen[t]) return;
      seen[t] = 1;
      tokens.push(t);
    }

    words.forEach(function (w) {
      add(w);
      if (w.length >= 2) {
        for (var i = 0; i <= w.length - 2; i++) add(w.slice(i, i + 2));
      }
      if (expandSynonyms) {
        Object.keys(SYN_MAP).forEach(function (synKey) {
          if (w.indexOf(synKey) >= 0 || synKey.indexOf(w) >= 0 && w.length >= 2) {
            SYN_MAP[synKey].forEach(function (rel) { add(rel); });
          }
        });
      }
    });
    return tokens;
  }

  /* ══ 1. 통합 지식 청크 색인 구축 (erp_rag_schema 호환) ════════════════ */
  function buildKnowledgeIndex(catalogs, liveData) {
    var catObj = catalogs && typeof catalogs.getAllWithExisting === 'function'
      ? catalogs.getAllWithExisting()
      : (catalogs || (Cat && Cat.getAllWithExisting ? Cat.getAllWithExisting() : {}));
    var live = liveData || {};
    var chunks = [];

    function pushChunk(c) {
      var text = cleanText(c.chunk_text);
      if (!text) return;
      var toks = tokenize(c.title + ' ' + text + ' ' + (c.keywords || ''), false);
      chunks.push({
        chunk_id: str(c.chunk_id),
        record_key: str(c.record_key),
        domain: str(c.domain),
        doc_id: str(c.doc_id),
        appKey: str(c.appKey),
        appName: str(c.appName),
        kind: str(c.kind || 'playbook'),
        stageId: str(c.stageId),
        title: cleanText(c.title),
        organization: cleanText(c.organization || '푸른노무법인'),
        doc_date: str(c.doc_date || '2026-11-28'),
        parse_status: 'OK',
        chunk_text: text,
        searchable_text: cleanText(c.title + '\n' + text),
        metadata: c.metadata || {},
        _tokens: toks
      });
    }

    Object.keys(catObj).forEach(function (appKey) {
      var app = catObj[appKey];
      if (!app) return;
      var pb = app.ragPlaybook || {};

      // A. 사업 개요
      if (pb.overview) {
        pushChunk({
          chunk_id: 'pb_' + appKey + '_overview',
          record_key: 'consult_' + appKey,
          domain: 'consulting',
          doc_id: appKey,
          appKey: appKey,
          appName: app.name,
          kind: 'overview',
          title: '[' + app.name + '] 사업 개요 및 주관기관 안내',
          organization: app.agency || '푸른노무법인',
          chunk_text: pb.overview + (Array.isArray(app.tracks) && app.tracks.length ? ('\n세부 트랙: ' + app.tracks.map(function (t) { return t.name; }).join(', ')) : ''),
          keywords: app.name + ' ' + (app.agency || ''),
          metadata: { appKey: appKey, htmlFile: app.htmlFile || '' }
        });
      }

      // B. 단계별 행동 가이드
      (pb.stageActions || []).forEach(function (sa, idx) {
        var stInfo = (app.stages || []).find(function (s) { return s.id === sa.stageId; }) || { no: idx + 1, name: sa.stageId };
        var bodyLines = [];
        if (sa.mustDo && sa.mustDo.length) bodyLines.push('필수 행동: ' + sa.mustDo.join(' / '));
        if (sa.checkPoints && sa.checkPoints.length) bodyLines.push('핵심 체크포인트: ' + sa.checkPoints.join(' / '));
        if (sa.deliverables && sa.deliverables.length) bodyLines.push('산출물: ' + sa.deliverables.join(', '));
        if (sa.cautions && sa.cautions.length) bodyLines.push('주의사항: ' + sa.cautions.join(' / '));
        pushChunk({
          chunk_id: 'pb_' + appKey + '_stage_' + sa.stageId,
          record_key: 'consult_' + appKey,
          domain: 'consulting_stage',
          doc_id: appKey + ':' + sa.stageId,
          appKey: appKey,
          appName: app.name,
          kind: 'stage_action',
          stageId: sa.stageId,
          title: '[' + app.name + '] ' + stInfo.no + '단계(' + stInfo.name + ') 실무 행동 지침',
          organization: app.agency || '푸른노무법인',
          chunk_text: bodyLines.join('\n'),
          keywords: stInfo.name + ' ' + app.name,
          metadata: { appKey: appKey, stageId: sa.stageId, stepNo: stInfo.no }
        });
      });

      // C. 전문 체크리스트 & 법적근거
      if (Array.isArray(app.domainChecks) && app.domainChecks.length) {
        pushChunk({
          chunk_id: 'pb_' + appKey + '_checks',
          record_key: 'consult_' + appKey,
          domain: 'consulting_checklist',
          doc_id: appKey + ':checks',
          appKey: appKey,
          appName: app.name,
          kind: 'checklist',
          title: '[' + app.name + '] 핵심 법적·실무 체크리스트 (' + app.domainChecks.length + '항목)',
          organization: app.agency || '푸른노무법인',
          chunk_text: app.domainChecks.map(function (c, i) {
            return (i + 1) + '. [' + c.cat + '] ' + c.title + ' (근거: ' + c.law + ')';
          }).join('\n'),
          keywords: app.name + ' 체크리스트 법령',
          metadata: { appKey: appKey }
        });
      }

      // D. 흔한 실수 / 모니터링 Red-line & 법령 근거
      if ((pb.commonMistakes && pb.commonMistakes.length) || (pb.legalRefs && pb.legalRefs.length)) {
        var mLines = [];
        if (pb.commonMistakes && pb.commonMistakes.length) {
          mLines.push('자주 발생하는 실수·보완사례:\n- ' + pb.commonMistakes.join('\n- '));
        }
        if (pb.legalRefs && pb.legalRefs.length) {
          mLines.push('적용 법령·운영지침:\n- ' + pb.legalRefs.join('\n- '));
        }
        pushChunk({
          chunk_id: 'pb_' + appKey + '_mistakes_laws',
          record_key: 'consult_' + appKey,
          domain: 'consulting_risk',
          doc_id: appKey + ':risks',
          appKey: appKey,
          appName: app.name,
          kind: 'mistake_legal',
          title: '[' + app.name + '] 주의할 실수 사례 및 법적 근거',
          organization: app.agency || '푸른노무법인',
          chunk_text: mLines.join('\n\n'),
          keywords: app.name + ' 실수 보완 법령 판례',
          metadata: { appKey: appKey }
        });
      }

      // E. 수습 실전 Q&A
      (pb.sampleQA || []).forEach(function (qa, qIdx) {
        pushChunk({
          chunk_id: 'pb_' + appKey + '_qa_' + qIdx,
          record_key: 'consult_' + appKey,
          domain: 'consulting_qa',
          doc_id: appKey + ':qa:' + qIdx,
          appKey: appKey,
          appName: app.name,
          kind: 'qa',
          title: '[' + app.name + ' Q&A] ' + qa.q,
          organization: app.agency || '푸른노무법인',
          chunk_text: '질문: ' + qa.q + '\n실무 답변 및 행동요령: ' + qa.a,
          keywords: app.name + ' ' + qa.q,
          metadata: { appKey: appKey, qIdx: qIdx }
        });
      });
    });

    // F. 실시간 과거·진행 비식별 수행사례 색인 (projectsByApp: { appKey: [proj...] })
    var byApp = live.projectsByApp || {};
    Object.keys(byApp).forEach(function (appKey) {
      var app = catObj[appKey] || { name: appKey, agency: '' };
      var arr = Array.isArray(byApp[appKey]) ? byApp[appKey] : Object.values(byApp[appKey] || {});
      arr.forEach(function (p) {
        if (!p || p._deleted) return;
        var summary = str(p.summaryNote || p.note || '');
        if (!summary && !p.track) return;
        pushChunk({
          chunk_id: 'case_' + appKey + '_' + p.id,
          record_key: 'case_' + appKey + '_' + p.id,
          domain: 'past_case',
          doc_id: str(p.id),
          appKey: appKey,
          appName: app.name,
          kind: 'case_record',
          title: '[' + app.name + ' 수행사례 ' + str(p.year || '') + '] ' + str(p.trackName || p.track || '참여사업장'),
          organization: str(p.companyName || '비식별 사업장'),
          doc_date: str(p.year || '2026'),
          chunk_text: '수행트랙: ' + str(p.trackName || p.track || '-') + '\n진행단계: ' + str(p.stage || '완료') + '\n핵심요약: ' + summary,
          keywords: app.name + ' ' + str(p.trackName || '') + ' ' + str(p.year || ''),
          metadata: { appKey: appKey, projectId: p.id, year: p.year || '' }
        });
      });
    });

    // G. 수습 노무사 / 사내 축적 실무 학습 노트 (coachNotes)
    var notes = Array.isArray(live.coachNotes) ? live.coachNotes : Object.values(live.coachNotes || {});
    notes.forEach(function (n) {
      if (!n || n._deleted) return;
      var ak = str(n.appKey || 'general');
      var app = catObj[ak] || { name: '공통 실무노트' };
      pushChunk({
        chunk_id: 'note_' + n.id,
        record_key: 'coach_note_' + n.id,
        domain: 'coach_note',
        doc_id: str(n.id),
        appKey: ak,
        appName: app.name,
        kind: 'coach_note',
        title: '[' + app.name + ' 학습노트] ' + str(n.title || '실무 팁'),
        organization: '푸른노무법인 수습코치',
        doc_date: str(n.createdAt).slice(0, 10) || '2026-11-28',
        chunk_text: str(n.body || ''),
        keywords: app.name + ' ' + str(n.tags || ''),
        metadata: { appKey: ak, noteId: n.id }
      });
    });

    // 역문서 빈도(IDF) 사전 계산
    var df = Object.create(null);
    var totalLen = 0;
    chunks.forEach(function (ch) {
      totalLen += ch._tokens.length || 1;
      var seenDoc = Object.create(null);
      ch._tokens.forEach(function (t) {
        if (!seenDoc[t]) {
          seenDoc[t] = 1;
          df[t] = (df[t] || 0) + 1;
        }
      });
    });

    return {
      chunks: chunks,
      df: df,
      avgLen: chunks.length ? (totalLen / chunks.length) : 1,
      builtAt: Date.now()
    };
  }

  /* ══ 2. 하이브리드 BM25 + 유의어 + 구문 매칭 검색 ═════════════════════ */
  function search(index, query, opts) {
    var o = opts || {};
    var idx = index || { chunks: [], df: {}, avgLen: 1 };
    var qRaw = str(query);
    if (!qRaw) return [];
    var qNorm = qRaw.toLowerCase().replace(/\s+/g, '');
    var qTokens = tokenize(qRaw, true);
    var N = idx.chunks.length || 1;
    var k1 = 1.4, b = 0.65;
    var filterApp = str(o.appKey);
    var filterKind = str(o.kind);
    var topK = Number(o.limit || 8);

    var scored = [];
    for (var i = 0; i < idx.chunks.length; i++) {
      var ch = idx.chunks[i];
      if (filterApp && filterApp !== 'all' && ch.appKey !== filterApp) continue;
      if (filterKind && filterKind !== 'all' && ch.kind !== filterKind) continue;

      var tf = Object.create(null);
      ch._tokens.forEach(function (t) { tf[t] = (tf[t] || 0) + 1; });

      var score = 0;
      for (var j = 0; j < qTokens.length; j++) {
        var qt = qTokens[j];
        var f = tf[qt] || 0;
        if (!f) continue;
        var n_q = idx.df[qt] || 1;
        var idf = Math.log(1 + (N - n_q + 0.5) / (n_q + 0.5));
        var dl = ch._tokens.length || 1;
        score += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + b * (dl / idx.avgLen))));
      }

      // 제목/핵심구문 직접 일치 가중치
      var titleNorm = ch.title.toLowerCase().replace(/\s+/g, '');
      var bodyNorm = ch.chunk_text.toLowerCase().replace(/\s+/g, '');
      if (qNorm.length >= 2 && titleNorm.indexOf(qNorm) >= 0) score += 8.5;
      else if (qNorm.length >= 2 && bodyNorm.indexOf(qNorm) >= 0) score += 4.5;
      if (filterApp && ch.appKey === filterApp) score += 1.5;

      if (score > 0.2) {
        scored.push({ chunk: ch, score: Number(score.toFixed(3)) });
      }
    }

    scored.sort(function (a, b) { return b.score - a.score; });
    return scored.slice(0, topK);
  }

  /* ══ 3. 수습 노무사 "지금 내가 해야 할 행동" 결정론적 추천 엔진 ══════════ */
  function recommendNextActions(appKey, project, checkDoc, comms) {
    var app = Cat ? Cat.get(appKey) : null;
    if (!app) return { stageName: '-', actions: [], mistakes: [], legalRefs: [], readinessPct: 0 };

    var proj = project || {};
    var chk = checkDoc || {};
    var preDone = chk.pre || {};
    var domDone = chk.domain || {};
    var docDone = chk.docs || {};
    var commList = Array.isArray(comms) ? comms : [];

    var curStageId = str(proj.stage || 'intake');
    var stages = app.stages || [];
    var curStage = stages.find(function (s) { return s.id === curStageId; }) || stages[0] || { id: 'intake', no: 1, name: '착수·사전진단' };

    var pb = app.ragPlaybook || {};
    var stageRule = (pb.stageActions || []).find(function (sa) { return sa.stageId === curStage.id; }) || (pb.stageActions && pb.stageActions[0]) || {};

    var actions = [];

    // 1) 미완료 필수 사전체크 점검
    var missingPre = (app.preChecks || []).filter(function (p) { return !preDone[p.id] || preDone[p.id].status !== 'ok'; });
    if (missingPre.length) {
      actions.push({
        priority: '긴급',
        step: '착수 사전체크 보완 (' + missingPre.length + '건 남음)',
        detail: missingPre.slice(0, 2).map(function (x) { return x.title; }).join(' · '),
        targetTab: 'check'
      });
    }

    // 2) 미정리 메일·카톡/문자 자료 점검
    if (commList.length) {
      actions.push({
        priority: '권장',
        step: '수신 메일·카톡·문자 자료 확인 (' + commList.length + '건 연결됨)',
        detail: '가장 최근 수신: ' + cleanText(commList[0].subject || commList[0].title || '').slice(0, 60),
        targetTab: 'intake'
      });
    }

    // 3) 현재 단계 필수 행동 (플레이북 기반)
    (stageRule.mustDo || []).forEach(function (m) {
      actions.push({
        priority: '단계필수',
        step: curStage.no + '단계[' + curStage.name + '] 수행 행동',
        detail: m,
        targetTab: curStage.id === 'design' || curStage.id === 'final' ? 'report' : 'check'
      });
    });

    // 4) 현재 단계/누적 필수 서류 체크
    var missingDocs = (app.requiredDocs || []).filter(function (d) { return !docDone[d.id] || docDone[d.id].status !== 'ok'; });
    if (missingDocs.length) {
      actions.push({
        priority: '서류',
        step: '필수 서류 징구·작성 (' + missingDocs.length + '종 미완료)',
        detail: missingDocs.slice(0, 3).map(function (d) { return d.name; }).join(', '),
        targetTab: 'check'
      });
    }

    // 5) 전문 체크리스트 보완율 계산
    var totalItems = (app.preChecks || []).length + (app.domainChecks || []).length + (app.requiredDocs || []).length;
    var okCount = 0;
    (app.preChecks || []).forEach(function (x) { if (preDone[x.id] && preDone[x.id].status === 'ok') okCount++; });
    (app.domainChecks || []).forEach(function (x) { if (domDone[x.id] && domDone[x.id].status === 'ok') okCount++; });
    (app.requiredDocs || []).forEach(function (x) { if (docDone[x.id] && docDone[x.id].status === 'ok') okCount++; });
    var readinessPct = totalItems ? Math.round((okCount / totalItems) * 100) : 0;

    return {
      appKey: app.key,
      appName: app.name,
      stageId: curStage.id,
      stageName: curStage.no + '단계 · ' + curStage.name,
      readinessPct: readinessPct,
      actions: actions.slice(0, 6),
      checkPoints: stageRule.checkPoints || [],
      cautions: stageRule.cautions || [],
      mistakes: pb.commonMistakes || [],
      legalRefs: pb.legalRefs || []
    };
  }

  /* ══ 4. 근거 강제(Zero-Hallucination) 프롬프트 조립 & AI 코치 호출 ══════ */
  function buildGroundedPrompt(query, hits, context) {
    var safeQuery = cleanText(query);
    var ctxNote = context ? cleanText(context) : '';
    var evidenceText = (hits || []).map(function (h, idx) {
      var ch = h.chunk || h;
      return '[근거 #' + (idx + 1) + '] (' + ch.appName + ' / ' + ch.title + ')\n' + cleanText(ch.chunk_text).slice(0, 900);
    }).join('\n\n');

    return [
      '당신은 푸른노무법인의 수습·주니어 노무사를 지도하는 선임 노무사 실무 코치입니다.',
      '아래 [근거 자료]에 적힌 사실과 법령·절차만 인용하여 한국어로 정확하게 답하세요.',
      '규칙:',
      '1. 근거에 없는 법조문·기한·금액·서류명을 추측해 지어내지 마세요. 근거가 부족하면 "등록된 지식고에서 확인되지 않음 — 담당 선임 노무사 확인 필요"라고 밝히세요.',
      '2. 응답 형식: ① 핵심 결론 → ② 지금 해야 할 행동 (1·2·3단계) → ③ 놓치기 쉬운 주의사항 → ④ 인용 근거([근거 #N])',
      '3. 고객사 실명·개인정보는 절대 언급하지 마세요.',
      ctxNote ? ('\n[현재 작업 문맥]\n' + ctxNote) : '',
      '\n[수습 노무사 질문]\n' + safeQuery,
      '\n[근거 자료]\n' + (evidenceText || '(검색된 근거 없음)')
    ].join('\n');
  }

  function buildLocalCoachAnswer(query, hits, appKey) {
    if (!hits || !hits.length) {
      return {
        grounded: false,
        mode: 'local_rag',
        answer: '① 등록된 컨설팅 지식고에서 "' + cleanText(query) + '"와 직접 일치하는 문서를 찾지 못했습니다.\n② 먼저 해당 사업 앱의 [✅ 체크리스트]와 [📚 사업별 표준 플레이북]을 확인하거나, 검색어를 "6차산업", "평가보상", "기술보호", "창구단일화" 등 핵심 키워드로 좁혀 다시 검색해 보세요.',
        citations: []
      };
    }
    var lines = [];
    lines.push('① 핵심 안내 (' + hits[0].chunk.appName + ')');
    lines.push(hits[0].chunk.chunk_text.split('\n').slice(0, 4).join('\n'));
    if (hits.length > 1) {
      lines.push('\n② 연관 행동 및 실무 체크포인트');
      hits.slice(1, 4).forEach(function (h, i) {
        lines.push('• [근거 #' + (i + 2) + '] ' + h.chunk.title + ': ' + h.chunk.chunk_text.split('\n')[0]);
      });
    }
    lines.push('\n③ 인용 근거');
    hits.forEach(function (h, i) {
      lines.push('- [근거 #' + (i + 1) + '] ' + h.chunk.title + ' (유사도 ' + h.score + ')');
    });
    return {
      grounded: true,
      mode: 'local_rag',
      answer: lines.join('\n'),
      citations: hits.map(function (h, i) { return { no: i + 1, title: h.chunk.title, appKey: h.chunk.appKey, kind: h.chunk.kind }; })
    };
  }

  function askGroundedCoach(index, query, opts) {
    var o = opts || {};
    var hits = search(index, query, { appKey: o.appKey, limit: Number(o.limit || 5) });
    var localRes = buildLocalCoachAnswer(query, hits, o.appKey);
    var aiCall = o.aiCall || (root && root.PuAiCall);
    var auth = o.auth || null;

    if (!o.useAi || !aiCall || typeof aiCall.ask !== 'function' || !hits.length) {
      return Promise.resolve(Object.assign({}, localRes, { hits: hits }));
    }

    var prompt = buildGroundedPrompt(query, hits, o.context);
    var targetApp = Cat && Cat.get(o.appKey) ? o.appKey : 'coach';
    return aiCall.ask([{ text: prompt }], { auth: auth, app: targetApp, manual: !!o.manual })
      .then(function (reply) {
        var txt = '';
        if (typeof reply === 'string') txt = reply;
        else if (reply && reply.candidates && reply.candidates[0] && reply.candidates[0].content && reply.candidates[0].content.parts) {
          txt = reply.candidates[0].content.parts.map(function (p) { return p.text || ''; }).join('');
        }
        return {
          grounded: true,
          mode: 'ai_rag',
          answer: cleanText(txt) || localRes.answer,
          citations: localRes.citations,
          hits: hits
        };
      })
      .catch(function (err) {
        return Object.assign({}, localRes, {
          hits: hits,
          aiFallbackReason: str((err && err.message) || '로컬 RAG 근거 답변으로 대체')
        });
      });
  }

  /* ══ 5. Supabase(erp_rag_schema.sql) 호환 JSONL 내보내기 ══════════════ */
  function exportRagJsonl(index) {
    var idx = index || { chunks: [] };
    return idx.chunks.map(function (ch) {
      return JSON.stringify({
        record_key: ch.record_key,
        domain: ch.domain,
        doc_id: ch.doc_id,
        title: ch.title,
        organization: ch.organization,
        doc_date: ch.doc_date,
        parse_status: ch.parse_status,
        chunk_id: ch.chunk_id,
        chunk_text: ch.chunk_text,
        searchable_text: ch.searchable_text,
        metadata: ch.metadata
      });
    }).join('\n');
  }

  return {
    SYNONYM_GROUPS: SYNONYM_GROUPS,
    tokenize: tokenize,
    buildKnowledgeIndex: buildKnowledgeIndex,
    search: search,
    recommendNextActions: recommendNextActions,
    buildGroundedPrompt: buildGroundedPrompt,
    buildLocalCoachAnswer: buildLocalCoachAnswer,
    askGroundedCoach: askGroundedCoach,
    exportRagJsonl: exportRagJsonl
  };
});
