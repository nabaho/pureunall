/* 푸른통합시스템 — 안전보건관리체계 구축 진단집계 · 종합보고서(7장) · 핵심 개선사항 1P 요약보고서 조립 엔진
 * (브라우저 window.PuSafetyReport / Node module.exports 겸용)
 *
 * 맡는 일:
 *   1. 사전체크(12)·7대 핵심요소(25)·업종특화·고위험 기인물·표준 16대 서류 보유현황을 실시간 집계해 충족률·등급을 산출한다.
 *   2. 위험성평가 유해·위험요인 매트릭스(상/중/하 · 개선완료율)와 2026 공단 수행 준수사항(CEO 2회+ 면담 등)을 검증한다.
 *   3. 2026 공단 평가 기준에 맞춘 종합보고서(7장) 및 최종 회차 사업주 강평용 핵심 개선사항 1P 요약보고서 초안을 생성한다.
 *   4. 수기 편집 잠금(locks[key])을 보존한다.
 */
(function (root, factory) {
  'use strict';
  var isNode = typeof module === 'object' && module.exports;
  var Cat = isNode ? require('./pu-safety-catalog.js') : root.PuSafetyCatalog;
  var api = factory(Cat);
  if (isNode) module.exports = api;
  if (root) root.PuSafetyReport = api;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this), function (Cat) {
  'use strict';

  function str(v) { return v == null ? '' : String(v).trim(); }
  function num(v, d) {
    var n = Number(v);
    return isFinite(n) ? n : (d === undefined ? 0 : d);
  }
  function round1(v) { return Math.round((Number(v) || 0) * 10) / 10; }

  function normalizeCheckVal(v) {
    var s = str(v).toLowerCase();
    if (s === 'ok' || s === '적정' || s === '예' || s === 'true' || s === '1') return 'ok';
    if (s === 'fix' || s === '보완' || s === '부분') return 'fix';
    if (s === 'no' || s === '미이행' || s === '부적정' || s === '아니오') return 'no';
    if (s === 'na' || s === '해당없음') return 'na';
    return '';
  }

  function statusLabel(v) {
    var nv = normalizeCheckVal(v);
    if (nv === 'ok') return '적정';
    if (nv === 'fix') return '보완필요';
    if (nv === 'no') return '미이행';
    if (nv === 'na') return '해당없음';
    return '미점검';
  }

  /* ══ 1. 4계층 체크리스트 · 서류보유 통합 집계 ════════════════════════ */
  function computeCheckSummary(project, checkDoc) {
    var p = project || {};
    var cd = checkDoc && typeof checkDoc === 'object' ? checkDoc : {};
    var ind = Cat.getIndustry(p.industryCode || cd.industryCode);
    var extraInds = Array.isArray(p.extraIndustries) ? p.extraIndustries : (Array.isArray(cd.extraIndustries) ? cd.extraIndustries : []);
    var allIndCodes = [ind.code].concat(extraInds.filter(function (c) { return c && c !== ind.code; }));
    var hazardCodes = Array.isArray(p.selectedHazards) && p.selectedHazards.length
      ? p.selectedHazards
      : (Array.isArray(cd.selectedHazards) && cd.selectedHazards.length ? cd.selectedHazards : ind.recommendedHazards);

    var preMap = cd.pre || {};
    var core7Map = cd.core7 || {};
    var indMap = cd.industry || {};
    var hazMap = cd.hazards || {};
    var docMap = cd.docs || {};

    /* (1) 사전 착수 체크 12항목 */
    var preDone = 0;
    Cat.PRE_CHECKS.forEach(function (item) {
      var st = normalizeCheckVal(preMap[item.id] && (preMap[item.id].status || preMap[item.id]));
      if (st === 'ok' || st === 'na') preDone++;
    });
    var prePct = Cat.PRE_CHECKS.length ? round1((preDone / Cat.PRE_CHECKS.length) * 100) : 0;

    /* (2) 공식 7대 핵심요소 25문항 */
    var core7Total = 0, core7Ok = 0, core7Fix = 0, core7No = 0;
    var elementBars = Cat.CORE7_ELEMENTS.map(function (el) {
      var items = Cat.CORE7_CHECKS.filter(function (c) { return c.elementId === el.id; });
      var eOk = 0, eFix = 0, eNo = 0, eApp = 0;
      items.forEach(function (it) {
        var st = normalizeCheckVal(core7Map[it.id] && (core7Map[it.id].status || core7Map[it.id]));
        if (st === 'na') return;
        eApp++;
        core7Total++;
        if (st === 'ok') { eOk++; core7Ok++; }
        else if (st === 'fix') { eFix++; core7Fix++; }
        else if (st === 'no') { eNo++; core7No++; }
      });
      var pct = eApp ? round1((eOk / eApp) * 100) : 100;
      return {
        id: el.id,
        no: el.no,
        name: el.name,
        short: el.short,
        total: eApp,
        okCount: eOk,
        fixCount: eFix,
        noCount: eNo,
        pct: pct
      };
    });
    var core7Pct = core7Total ? round1((core7Ok / core7Total) * 100) : 0;

    /* (3) 업종별 특화 체크리스트 */
    var indItems = Cat.getIndustryChecks(allIndCodes);
    var indApp = 0, indOk = 0, indFix = 0;
    var indFixList = [];
    indItems.forEach(function (it) {
      var st = normalizeCheckVal(indMap[it.id] && (indMap[it.id].status || indMap[it.id]));
      if (st === 'na') return;
      indApp++;
      if (st === 'ok') indOk++;
      else if (st === 'fix' || st === 'no') {
        indFix++;
        indFixList.push({ id: it.id, cat: it.cat, text: it.text, status: statusLabel(st) });
      }
    });
    var indPct = indApp ? round1((indOk / indApp) * 100) : 0;

    /* (4) 고위험 기인물 점검 */
    var hazApp = 0, hazOk = 0, hazFix = 0;
    var hazFixList = [];
    hazardCodes.forEach(function (hc) {
      var ha = Cat.getHazardAgent(hc);
      if (!ha) return;
      ha.items.forEach(function (txt, idx) {
        var key = hc + '_' + (idx + 1);
        var st = normalizeCheckVal(hazMap[key] && (hazMap[key].status || hazMap[key]));
        if (st === 'na') return;
        hazApp++;
        if (st === 'ok') hazOk++;
        else if (st === 'fix' || st === 'no') {
          hazFix++;
          hazFixList.push({ agent: ha.short, text: txt, status: statusLabel(st) });
        }
      });
    });
    var hazPct = hazApp ? round1((hazOk / hazApp) * 100) : 0;

    /* (5) 16대 표준서류 보유 현황 */
    var docReady = 0;
    Cat.DOC_KINDS.forEach(function (dk) {
      var st = normalizeCheckVal(docMap[dk.code] && (docMap[dk.code].status || docMap[dk.code]));
      if (st === 'ok' || st === 'na') docReady++;
    });
    var docPct = Cat.DOC_KINDS.length ? round1((docReady / Cat.DOC_KINDS.length) * 100) : 0;

    var checkedAny = (preDone + core7Ok + core7Fix + core7No + indOk + indFix + hazOk + hazFix + docReady) > 0;
    var overallPct = round1(core7Pct * 0.45 + indPct * 0.30 + docPct * 0.25);
    var grade = !checkedAny
      ? '진단대기'
      : (overallPct >= 85 ? '우수' : (overallPct >= 65 ? '양호' : (overallPct >= 45 ? '보통' : '보완시급')));

    return {
      industry: ind,
      allIndustryCodes: allIndCodes,
      hazardCodes: hazardCodes,
      preDone: preDone,
      preTotal: Cat.PRE_CHECKS.length,
      prePct: prePct,
      core7Ok: core7Ok,
      core7Fix: core7Fix,
      core7No: core7No,
      core7Total: core7Total,
      core7Pct: core7Pct,
      elementBars: elementBars,
      indOk: indOk,
      indFix: indFix,
      indTotal: indApp,
      indPct: indPct,
      indFixList: indFixList,
      hazOk: hazOk,
      hazFix: hazFix,
      hazTotal: hazApp,
      hazPct: hazPct,
      hazFixList: hazFixList,
      docReady: docReady,
      docTotal: Cat.DOC_KINDS.length,
      docPct: docPct,
      overallPct: overallPct,
      grade: grade
    };
  }

  function computeRiskMatrix(hazards) {
    var list = Array.isArray(hazards) ? hazards.filter(function (h) { return h && !h._deleted; }) : [];
    var high = 0, mid = 0, low = 0, done = 0;
    list.forEach(function (h) {
      if (h.level === '상') high++;
      else if (h.level === '하') low++;
      else mid++;
      if (h.status === '완료' || h.status === '개선완료') done++;
    });
    return {
      list: list,
      total: list.length,
      highCount: high,
      midCount: mid,
      lowCount: low,
      doneCount: done,
      donePct: list.length ? round1((done / list.length) * 100) : 0
    };
  }

  /* ══ 2. 회차 정규화 및 2026 공단 준수사항 점검 ════════════════════════ */
  function normalizeRounds(project) {
    var p = project || {};
    var tr = Cat.getTrack(p.track);
    var source = Array.isArray(p.rounds) && p.rounds.length ? p.rounds : [];
    var defaultTopics = [
      '1회차(착수·2인1조): 사업주(CEO) 최초 면담, 사전체크 검토, 전 공정 순회점검 및 근로자 면담',
      '2회차(시범·' + (tr.pairRounds.indexOf(2) >= 0 ? '2인1조' : '1인') + '): 발굴 위험요인 빈도·강도 시범 위험성평가 및 현실적 감소대책 논의',
      '3회차(참관·지원): 사업장 주도 위험성평가 참관·리뷰, 근로자 교육 및 개선이행 점검',
      '4회차(정착): 비상조치 시나리오·훈련, 도급/수급업체 적격평가 및 26종 표준서류 정비',
      '5회차(최종): 사업주 최종 면담, 종합보고서·핵심 개선사항 1P 요약보고서 강평 및 정부지원 연계'
    ];
    if (!source.length) {
      var cnt = tr.defaultRounds || 3;
      for (var i = 0; i < cnt; i++) {
        var rno = i + 1;
        source.push({
          roundNo: rno,
          date: '',
          twoPersonTeam: tr.pairRounds.indexOf(rno) >= 0,
          ceoMet: rno === 1 || rno === cnt,
          workerMet: true,
          siteTour: true,
          summary1PProvided: rno === cnt,
          topic: defaultTopics[i] || (rno + '회차 안전보건관리체계 구축 지원 및 현장 순회점검')
        });
      }
    }
    var rounds = source.map(function (r, idx) {
      var rno = num(r.roundNo) || (idx + 1);
      return {
        roundNo: rno,
        date: str(r.date) || '일정 조율',
        twoPersonTeam: !!r.twoPersonTeam,
        ceoMet: !!r.ceoMet,
        workerMet: r.workerMet !== false,
        siteTour: r.siteTour !== false,
        summary1PProvided: !!r.summary1PProvided,
        topic: str(r.topic) || (rno + '회차 컨설팅 수행')
      };
    });
    return {
      rounds: rounds,
      compliance: Cat.auditCompliance(p, rounds)
    };
  }

  /* ══ 3. 종합보고서(7장) + 핵심 개선사항 1P 요약보고서 생성 ═════════════ */
  function buildComprehensiveReport(project, checkDoc, intakeMap, prevReport) {
    var p = project || {};
    var tr = Cat.getTrack(p.track);
    var sum = computeCheckSummary(p, checkDoc);
    var risk = computeRiskMatrix((checkDoc && checkDoc.riskItems) || p.riskItems || []);
    var rdInfo = normalizeRounds(p);
    var scales = Cat.getScaleObligations(p.workerCount || 25, sum.industry.code);
    var prev = prevReport && typeof prevReport === 'object' ? prevReport : {};
    var locks = Object.assign({}, prev.locks || {});
    var prevSecs = prev.sections || {};

    var coName = str(p.companyName) || '참여사업장';
    var yr = p.year || 2026;
    var consultant = str(p.consultantName) || '푸른노무법인 전담 공인노무사';
    var workers = num(p.workerCount) || 0;

    var aidMatches = Cat.GOV_AID_PROGRAMS.filter(function (a) {
      return a.matchIndustries.indexOf(sum.industry.code) >= 0;
    }).slice(0, 4);

    var intakeCards = Object.keys(intakeMap || {}).map(function (k) { return intakeMap[k]; })
      .filter(function (c) { return c && !c._deleted; });

    var gen = {};
    gen.s1_overview = [
      '1. 사업장 개요: ' + coName + ' (' + sum.industry.name + ', 상시근로자 ' + (workers ? workers + '명' : '확인중') + ', ' + scales.scaleBand + ')에 대하여 ' + yr + '년도 [' + tr.name + '] 컨설팅을 수행하였다.',
      '2. 적용 법령 및 사전 체크: 착수 사전 체크 ' + sum.preDone + '/' + sum.preTotal + '항목(' + sum.prePct + '%) 점검 완료. ' + (scales.items[0] ? scales.items[0].title : ''),
      '3. 수집 자료 현황: 메일·로컬 보유 서류 ' + intakeCards.length + '건 및 표준 16대 문서체계 ' + sum.docReady + '/' + sum.docTotal + '종(' + sum.docPct + '%) 확인.'
    ].join('\n');

    var weakEls = sum.elementBars.slice().sort(function (a, b) { return a.pct - b.pct; }).slice(0, 2);
    gen.s2_core7 = [
      '1. 7대 핵심요소 종합 진단: 총 ' + sum.core7Total + '개 유효 항목 중 적정 ' + sum.core7Ok + '개(충족률 ' + sum.core7Pct + '%), 보완필요 ' + sum.core7Fix + '개, 미이행 ' + sum.core7No + '개 — 종합 안전보건 수준 [' + sum.grade + ' · ' + sum.overallPct + '%].',
      '2. 요소별 진단 요약: ' + sum.elementBars.map(function (b) { return b.no + '.' + b.short + ' ' + b.pct + '%'; }).join(' | '),
      '3. 우선 보완 핵심요소: ' + weakEls.map(function (w) { return '[' + w.name + ' ' + w.pct + '%]'; }).join(', ') + ' 영역의 절차서 정비 및 실행력 강화가 최우선 과제로 도출되었다.'
    ].join('\n');

    gen.s3_industry = [
      '1. 업종 맞춤 리스크(' + sum.industry.name + '): ' + sum.industry.mainHazards.join(' · ') + '.',
      '2. 업종 특화 점검: ' + sum.indTotal + '항목 중 ' + sum.indOk + '항목 적정(' + sum.indPct + '%), 보완·미이행 ' + sum.indFix + '건.',
      '3. 고위험 기인물(' + sum.hazardCodes.map(function (c) { var ha = Cat.getHazardAgent(c); return ha ? ha.short : c; }).join(', ') + ') 점검: ' + sum.hazTotal + '개 항목 중 적정 ' + sum.hazOk + '건(' + sum.hazPct + '%), 보완필요 ' + sum.hazFix + '건.'
    ].join('\n');

    gen.s4_risk = [
      '1. 위험성평가 시범·참관 실시: 2회차 컨설턴트 주도 시범평가(빈도·강도법) 후, 3회차에 사업장 담당자·근로자 주도의 전체 공정 위험성평가를 참관·지원하였다.',
      '2. 발굴 유해·위험요인 현황: 총 ' + risk.total + '건 발굴 (상 ' + risk.highCount + '건 · 중 ' + risk.midCount + '건 · 하 ' + risk.lowCount + '건), 개선 완료 ' + risk.doneCount + '건(' + risk.donePct + '%).',
      risk.list.length
        ? '3. 주요 개선 대책: ' + risk.list.slice(0, 3).map(function (r) { return '[' + r.process + '] ' + r.factor + ' → ' + r.measure; }).join(' / ')
        : '3. 주요 개선 대책: 현장 순회점검에서 확인된 끼임·부딪힘·추락·근골격계 요인에 대해 방호덮개·LOTO·전용통로·보호구 지급 개선을 권고하였다.'
    ].join('\n');

    gen.s5_engage = [
      '1. 사업주·근로자 면담 이행: CEO 면담 ' + rdInfo.compliance.ceoCount + '회 실시(기준 ' + rdInfo.compliance.minCeoMeetings + '회+), 매 회차 현장 근로자 면담 및 순회점검을 통해 형식적 서류 컨설팅을 지양하고 실질 참여를 유도하였다.',
      '2. 인사·노무체계 연계: ' + sum.industry.approach + '.',
      '3. 근로자 참여 활성화: 아차사고 신고·안전제안 포상 및 작업중지권 절차를 안전보건관리규정·취업규칙과 연계하여 현장 정착 기반을 마련하였다.'
    ].join('\n');

    gen.s6_followup = [
      '1. 추천 정부 재정지원사업 연계: ' + aidMatches.map(function (a) { return a.name + '(' + a.support + ')'; }).join(' / '),
      '2. 컨설팅 이후 반기별 필수 이행 과제: ① 위험요인 개선 미완료 항목 기한 내 완료 확인, ② 반기 1회 경영자 안전보건 점검·평가 결과 보고, ③ 반기 1회 비상조치계획 모의훈련 실시, ④ 신규·도급업체 투입 전 적격성 평가 철저.'
    ].join('\n');

    gen.s7_rounds = [
      '총 ' + rdInfo.rounds.length + '회차 수행 (' + tr.name + ' · 전담 컨설턴트: ' + consultant + ')',
      '2026 수행 준수 점검: ' + (rdInfo.compliance.ok ? '전 항목 기준 충족(적정)' : rdInfo.compliance.issues.join(' / '))
    ].join('\n');

    var sections = {};
    Cat.REPORT_SECTIONS.forEach(function (s) {
      sections[s.key] = (locks[s.key] && str(prevSecs[s.key])) ? prevSecs[s.key] : (gen[s.key] || '');
    });

    var topFixItems = sum.indFixList.slice(0, 3).map(function (x) { return '[' + x.cat + '] ' + x.text; })
      .concat(sum.hazFixList.slice(0, 2).map(function (x) { return '[' + x.agent + '] ' + x.text; }));

    var onePageSummary = {
      companyName: coName,
      industryName: sum.industry.name,
      workerCount: workers,
      grade: sum.grade,
      overallPct: sum.overallPct,
      core7Pct: sum.core7Pct,
      indPct: sum.indPct,
      docPct: sum.docPct,
      keyStrengths: sum.elementBars.slice().sort(function (a, b) { return b.pct - a.pct; }).slice(0, 2)
        .map(function (e) { return e.name + ' (' + e.pct + '%)'; }),
      urgentFixes: topFixItems.length ? topFixItems : ['7대 핵심요소 미점검·보완 항목 및 위험성평가 개선기한 내 현장 조치 완료 필요'],
      recommendedAids: aidMatches.map(function (a) { return a.name; }),
      nextHalfYearRule: '반기 1회 위험요인 개선이행·비상대응훈련·적격수급인 점검 결과를 대표이사에게 보고·보관하십시오.'
    };

    return {
      schema: Cat.REPORT_SECTIONS,
      sections: sections,
      locks: locks,
      onePageSummary: onePageSummary,
      structured: {
        summary: sum,
        risk: risk,
        rounds: rdInfo.rounds,
        compliance: rdInfo.compliance,
        scales: scales,
        aidMatches: aidMatches,
        elementRows: sum.elementBars.map(function (b) {
          return [b.no + '. ' + b.name, String(b.total), String(b.okCount), String(b.fixCount + b.noCount), b.pct + '%'];
        }),
        roundRows: rdInfo.rounds.map(function (r) {
          return [r.roundNo + '회차', r.date, r.twoPersonTeam ? '2인1조' : '1인', (r.ceoMet ? 'CEO✓ ' : '') + (r.workerMet ? '근로자✓' : ''), r.topic];
        })
      }
    };
  }

  return {
    normalizeCheckVal: normalizeCheckVal,
    statusLabel: statusLabel,
    computeCheckSummary: computeCheckSummary,
    computeRiskMatrix: computeRiskMatrix,
    normalizeRounds: normalizeRounds,
    buildComprehensiveReport: buildComprehensiveReport
  };
});
