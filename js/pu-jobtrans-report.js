/* 푸른통합시스템 — 산업·일자리전환 컨설팅(KMAC · CEPA) 중간보고서 · 후속Diff · 최종결과보고서 · 완료계 조립 엔진
 * (브라우저 window.PuJobtransReport / Node module.exports 겸용)
 *
 * 맡는 일:
 *   1. 기초자료(pre_mid) 비식별 재무·인력·임금·노동전환 설문 통계 및 규정 이슈·인터뷰를 통합하여
 *      운영기관별(KMAC 구조혁신 vs CEPA 산업일자리전환지원센터) 맞춤 중간보고서 7개 섹션과 표 데이터를 생성한다.
 *   2. 중간보고 확정 기준선(Snapshot)과 후속 메일(post_mid) 피드백·전환배치·훈련·상생협약 변경점(Diff)을 결합하여
 *      KMAC 본컨설팅/정책매니저 · CEPA 진단컨설팅/전문컨설팅(석탄화력·미래차)별 최종결과보고서 8개 섹션 및 표를 조립한다.
 *   3. 기관별 부속 제출 문안(수행계획서 · 회차별 수행일지 · 완료보고서/완료계 · 장려금/정책매니저 연계서)을 생성한다.
 *   4. 수기 편집 잠금(locks[key]) 보존 및 선택적 AI 윤문 시 개인정보 2중 가림·환각 숫자 검증 안전장치를 제공한다.
 */
(function (root, factory) {
  'use strict';
  var isNode = typeof module === 'object' && module.exports;
  var Cat = isNode ? require('./pu-jobtrans-catalog.js') : root.PuJobtransCatalog;
  var Intake = isNode ? require('./pu-jobtrans-intake.js') : root.PuJobtransIntake;
  var api = factory(Cat, Intake);
  if (isNode) module.exports = api;
  if (root) root.PuJobtransReport = api;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this), function (Cat, Intake) {
  'use strict';

  function str(v) { return v == null ? '' : String(v).trim(); }
  function num(v, d) {
    var n = Number(v);
    return isFinite(n) ? n : (d === undefined ? 0 : d);
  }
  function round1(v) { return Math.round((Number(v) || 0) * 10) / 10; }
  function fmtNum(v) {
    var n = Math.round(Number(v) || 0);
    return n.toLocaleString('ko-KR');
  }

  /* ══ 1. 수집 카드(intakeMap) 통합 요약기 ═══════════════════════════════ */
  function collectIntakeSummary(intakeMap) {
    var map = intakeMap && typeof intakeMap === 'object' ? intakeMap : {};
    var cards = Object.keys(map).map(function (k) { return map[k]; })
      .filter(function (r) { return r && typeof r === 'object' && !r._deleted; })
      .sort(function (a, b) { return (num(a.analyzedAt || a.updatedAt) - num(b.analyzedAt || b.updatedAt)); });

    var preCards = cards.filter(function (c) { return (c.phase || 'pre_mid') === 'pre_mid'; });
    var postCards = cards.filter(function (c) { return c.phase === 'post_mid'; });

    var finStats = null, rosterStats = null, wageTimeStats = null, surveyStats = null;
    var policyIssues = [], seenIssue = {};
    var techExcerpts = [];

    preCards.forEach(function (c) {
      if (c.docKind === 'biz_fin' && c.stats) finStats = c.stats;
      if (c.docKind === 'org_roster' && c.stats) rosterStats = c.stats;
      if (c.docKind === 'wage_time' && c.stats) wageTimeStats = c.stats;
      if (c.docKind === 'trans_survey' && c.stats) surveyStats = c.stats;
      (Array.isArray(c.policyIssues) ? c.policyIssues : []).forEach(function (iss) {
        if (!iss || !iss.id || seenIssue[iss.id]) return;
        seenIssue[iss.id] = 1;
        policyIssues.push(iss);
      });
      if (c.maskedExcerpt && c.docKind === 'biz_tech') {
        techExcerpts.push(str(c.maskedExcerpt).slice(0, 360));
      }
    });

    var mergedDiff = {
      targetJobs: '',
      transferHeadcount: 0,
      trainingProgram: '',
      accordSummary: '',
      effectiveDate: '',
      govAidTarget: '',
      requests: [],
      roundsByNo: {},
      postMailCount: postCards.length
    };

    postCards.forEach(function (c) {
      var d = c.postDiff;
      if (!d || typeof d !== 'object') return;
      if (d.targetJobs) mergedDiff.targetJobs = str(d.targetJobs);
      if (num(d.transferHeadcount) > 0) mergedDiff.transferHeadcount = num(d.transferHeadcount);
      if (d.trainingProgram) mergedDiff.trainingProgram = str(d.trainingProgram);
      if (d.accordSummary) mergedDiff.accordSummary = str(d.accordSummary);
      if (d.effectiveDate) mergedDiff.effectiveDate = str(d.effectiveDate);
      if (d.govAidTarget) mergedDiff.govAidTarget = str(d.govAidTarget);
      if (num(d.roundNo) > 0) {
        var rno = num(d.roundNo);
        var prevR = mergedDiff.roundsByNo[rno] || {};
        mergedDiff.roundsByNo[rno] = {
          roundNo: rno,
          mode: d.roundMode || prevR.mode || '',
          mins: num(d.roundMins) || prevR.mins || 0,
          people: num(d.roundPeople) || prevR.people || 0,
          hasPhoto: !!(d.hasPhoto || prevR.hasPhoto),
          hasSign: !!(d.hasSign || prevR.hasSign)
        };
      }
      (Array.isArray(d.requests) ? d.requests : []).forEach(function (rq) {
        var s = str(rq);
        if (s && mergedDiff.requests.indexOf(s) < 0 && mergedDiff.requests.length < 8) {
          mergedDiff.requests.push(s);
        }
      });
    });

    return {
      preCards: preCards,
      postCards: postCards,
      finStats: finStats,
      rosterStats: rosterStats,
      wageTimeStats: wageTimeStats,
      surveyStats: surveyStats,
      policyIssues: policyIssues,
      techExcerpts: techExcerpts,
      mergedDiff: mergedDiff
    };
  }

  function selectedTaskObjects(project) {
    var codes = Array.isArray(project && project.selectedTasks) && project.selectedTasks.length
      ? project.selectedTasks
      : ['jt_impact', 'jt_job_redesign', 'jt_reskill', 'jt_gov_match'];
    var list = codes.map(function (c) { return Cat.getTask(c); }).filter(Boolean);
    return list.length ? list : [Cat.getTask('jt_impact'), Cat.getTask('jt_job_redesign'), Cat.getTask('jt_reskill')].filter(Boolean);
  }

  /* ══ 2. 기관·트랙별 수행 회차 정규화 및 인정기준 점검 ══════════════════ */
  function normalizeRounds(project, schedRounds, mergedDiff) {
    var p = project || {};
    var ag = Cat.getAgency(p.agency);
    var tr = Cat.getTrack(p.track, ag.code);
    var customRounds = Array.isArray(p.rounds) ? p.rounds : [];
    var source = customRounds.length ? customRounds : (Array.isArray(schedRounds) ? schedRounds.slice() : []);
    var proofByNo = (mergedDiff && mergedDiff.roundsByNo) || {};

    var kmacTopics = [
      '착수 오리엔테이션 · 노사 공동 전환추진 TF 위촉 및 구조혁신 수행계획 확정',
      '최근 3개년 재무·인력 추이 및 탄소중립·디지털 사업전환 영향도 현장진단',
      '조직·직무분장 현황 및 취업규칙·근로계약·임금·근태 법정 교차진단',
      '노동전환 인식수준(5대 영역) 및 노사관계 진단 설문·계층별 심층 인터뷰',
      '중간보고회 개최 — 산업·일자리전환 핵심 이슈 공유 및 전환직무 설계방향 합의',
      '축소·확대·신설 직무 매트릭스 도출, 전환 대상 직무기술서(JD) 및 재배치 기준 설계',
      '전환 인력 직무재교육(Reskilling)·S-OJT 커리큘럼 및 고용안정 노사 상생협약 검토',
      '정부지원사업 매칭 체계도 확정, 취업규칙 신구대조표 완성 및 최종 결과보고회'
    ];
    var cepaDiagTopics = [
      '진단컨설팅 착수 · 참여기업 일반현황 및 전방산업(석탄화력/미래차) 전환 리스크 조사',
      '공정·직무별 인력배치 분석, 경영진·근로자 인터뷰 및 인사노무 기초진단',
      '진단컨설팅 결과보고 — 일자리전환 개선과제 도출 및 전문컨설팅·장려금 연계 안내'
    ];
    var cepaProTopics = [
      '전문컨설팅 착수 · 수행계획 확정 및 전방산업(석탄화력 폐지/미래차 전환) 영향 정밀진단',
      '부서·공정별 직무분석, 근로자 직무전환 수요조사 및 인사노무 제도 취약점 점검',
      '중간보고회 — 전환 대상 직군·인원 기준선 확정 및 신사업 대응 직무설계 방향 협의',
      '신사업·전환공정 직무기술서(JD) 재설계 및 공정 전환배치·고용유지 기준 수립',
      '충남 지역훈련기관 연계 직무재교육(Reskilling) 계획 및 노사 상생협약·규정 정비',
      '최종 결과보고회 · 충남경제진흥원 완료계 작성 및 산업일자리전환 장려금 매칭 확정'
    ];

    var defaultTopics = ag.code === 'cepa'
      ? (tr.code === 'cepa_diag' ? cepaDiagTopics : cepaProTopics)
      : kmacTopics;

    if (!source.length) {
      var baseCnt = tr.defaultRounds || ag.defaultRounds || 6;
      for (var i = 0; i < baseCnt; i++) {
        source.push({
          roundNo: i + 1,
          date: '',
          mode: (i === 1 && baseCnt >= 5) ? 'remote' : 'face',
          mins: 120,
          companyPeople: 3,
          topic: defaultTopics[i % defaultTopics.length],
          hasPhoto: false,
          hasSign: false
        });
      }
    }

    var out = source.map(function (r, idx) {
      var rno = num(r.roundNo) || (idx + 1);
      var pf = proofByNo[rno] || {};
      var mode = str(r.mode || pf.mode) || 'face';
      var topic = str(r.topic || r.memo) || defaultTopics[idx % defaultTopics.length];
      var mins = num(r.mins) || num(pf.mins) || 120;
      var companyPeople = num(r.companyPeople) || num(pf.people) || 3;
      var hasPhoto = !!(r.hasPhoto || pf.hasPhoto);
      var hasSign = !!(r.hasSign || pf.hasSign);

      var issues = [];
      if (mins < Cat.CRITERIA.roundMinMins) issues.push('자문시간 ' + mins + '분 (120분 미달)');
      if (companyPeople < Cat.CRITERIA.roundMinCompanyPeople) issues.push('기업 참석 ' + companyPeople + '명 미달');
      if (!hasPhoto) issues.push('현장사진 미확인');
      if (!hasSign) issues.push('수행일지·서명 미확인');

      return {
        roundNo: rno,
        date: str(r.date) || '일정 조율',
        mode: mode === 'remote' ? 'remote' : 'face',
        modeLabel: mode === 'remote' ? '비대면(화상)' : '대면(현장방문)',
        mins: mins,
        companyPeople: companyPeople,
        topic: topic,
        hasPhoto: hasPhoto,
        hasSign: hasSign,
        issues: issues,
        ok: issues.length === 0
      };
    });

    var targetRounds = tr.defaultRounds || ag.defaultRounds || 6;
    var minRoundMins = Cat.CRITERIA.roundMinMins || 120;
    var minPeople = Cat.CRITERIA.roundMinCompanyPeople || 2;
    var faceCount = out.filter(function (r) { return r.mode === 'face'; }).length;
    var facePct = out.length ? round1((faceCount / out.length) * 100) : 100;
    var faceMet = facePct >= ag.minFacePct;
    var allTimeAndPeopleMet = out.length > 0 && out.every(function (r) {
      return r.mins >= minRoundMins && r.companyPeople >= minPeople;
    });

    return {
      rounds: out,
      targetRounds: targetRounds,
      totalCount: out.length,
      faceCount: faceCount,
      facePct: facePct,
      minFacePct: ag.minFacePct,
      minRoundMins: minRoundMins,
      minPeople: minPeople,
      faceMet: faceMet,
      allTimeAndPeopleMet: allTimeAndPeopleMet,
      proofReadyCount: out.filter(function (r) { return r.hasPhoto && r.hasSign; }).length
    };
  }

  /* ══ 3. 기관별 맞춤 중간보고서(Mid-Report) 자동 초안 생성 ═══════════════ */
  function buildMidReport(project, intakeMap, schedRounds, prevMid) {
    var p = project || {};
    var ag = Cat.getAgency(p.agency);
    var tr = Cat.getTrack(p.track, ag.code);
    var coName = str(p.companyName) || '참여기업';
    var industry = str(p.industry) || (ag.code === 'cepa' ? '발전설비·자동차부품 제조업' : '주력 제조·소부장 산업');
    var mainProduct = str(p.mainProduct) || (tr.code === 'cepa_coal' ? '발전설비 정비·기자재' : (tr.code === 'cepa_auto' ? '자동차 내연기관·전동화 부품' : '산업용 핵심 부품'));
    var transGoal = str(p.transGoal || p.transitionGoal) || (tr.code === 'cepa_coal' ? '친환경 에너지·플랜트 설비 분야 업의 전환' : (tr.code === 'cepa_auto' ? '미래차(전동화·경량화) 부품 공정 전환' : '탄소중립·스마트공정 기반 고부가가치 사업전환'));

    var tasks = selectedTaskObjects(p);
    var sum = collectIntakeSummary(intakeMap);
    var rdInfo = normalizeRounds(p, schedRounds, sum.mergedDiff);
    var locks = Object.assign({}, (prevMid && prevMid.locks) || {});
    var prevSecs = (prevMid && prevMid.sections) || {};

    var rs = sum.rosterStats;
    var fs = sum.finStats;
    var ws = sum.wageTimeStats;
    var sv = sum.surveyStats;
    var workerCnt = (rs && rs.activeCount) || num(p.workerCount) || 0;

    /* 표 데이터 조립 */
    var finRows = fs && fs.fin3Y && fs.fin3Y.length
      ? fs.fin3Y.map(function (y) {
          var netVal = y.netProfitM != null ? y.netProfitM : y.netIncomeM;
          return [y.year + '년', fmtNum(y.salesM) + '백만원', fmtNum(y.opProfitM) + '백만원', fmtNum(netVal) + '백만원'];
        })
      : [['최근 3개년', '재무제표 수신 시 자동 집계', '-', '-']];

    var deptRows = rs && rs.topDepts && rs.topDepts.length
      ? rs.topDepts.map(function (d) { return [d.dept, d.count + '명', d.pct + '%']; })
      : [['전체 조직(명부 수신 대기)', workerCnt ? workerCnt + '명' : '집계 대기', '100%']];

    var turnoverRows = rs && rs.turnover3Y && rs.turnover3Y.length
      ? rs.turnover3Y.map(function (y) { return [y.year + '년', y.hires + '명', y.leaves + '명', y.leaveRatePct + '%']; })
      : [['최근 3개년', '인력명부 수신 대기', '-', '-']];

    var scheduleRows = rdInfo.rounds.map(function (r) {
      return [r.roundNo + '회차', r.date, r.modeLabel, r.topic, r.mins + '분 / 기업 ' + r.companyPeople + '인'];
    });

    var surveyAreaBars = [];
    if (sv && Array.isArray(sv.areas) && sv.areas.length) {
      sv.areas.forEach(function (a) {
        surveyAreaBars.push({ label: a.name, score: a.score, bench: a.bench, gap: a.gap });
      });
    } else {
      Cat.SURVEY_AREAS.forEach(function (a) {
        surveyAreaBars.push({ label: a.name, score: round1(a.bench - 0.15), bench: a.bench, gap: -0.15, placeholder: true });
      });
    }

    var effectiveIssues = sum.policyIssues.length ? sum.policyIssues : tasks.map(function (t) {
      return { id: 't_' + t.code, severity: 'high', title: t.name, finding: t.summary };
    });
    var issueRows = effectiveIssues.map(function (iss) {
      return [iss.severity === 'high' ? '핵심' : '보완', iss.title, iss.finding];
    });

    /* 인터뷰 요약 */
    var iv = (p.interviews && typeof p.interviews === 'object') ? p.interviews : {};
    var ivExec = str(iv.exec) || '전방산업 구조변화에 대응한 신사업·신공정 안착이 시급하며, 핵심 숙련인력 이탈 방지 및 직무다기능화를 희망함';
    var ivHr = str(iv.hr) || '직무전환·배치전환 기준 명확화, 교육훈련 유급인정 규정 정비 및 전환장려금·정부지원사업 매칭 실무 가이드 요청';
    var ivWorker = str(iv.worker) || '산업전환 과정에서의 고용안정 보장, 전환 직무에 대한 충분한 현장 교육(OJT) 제공 및 기존 임금수준 보전 희망';

    /* 1) overview — 기관별 문안 분리 */
    var secOverview = ag.code === 'cepa' ? [
      '1) 충남 산업일자리전환 컨설팅 추진 배경 및 목적',
      '• 본 과업은 충남경제진흥원(충남 산업일자리전환지원센터) 「' + (p.year || 2026) + '년 ' + tr.name + '」의 일환으로, ' + coName + '(' + industry + ', 주력품목: ' + mainProduct + ')의 성공적인 산업·일자리전환과 근로자 고용안정을 지원하기 위하여 수행됨.',
      '• 특히 충청남도 내 ' + (tr.code === 'cepa_coal' ? '석탄화력발전 단계적 폐지에 따른 협력사 발주 감소 리스크' : '내연기관 중심 주력산업의 미래차·친환경 전환 압력') + '에 선제 대응하여, 「' + transGoal + '」 실행에 필요한 직무전환·인사노무 개선안 및 지원사업 연계 방안을 도출함.',
      '',
      '2) 수행 체계 및 회차별 추진 경과',
      '• 수행 구성: 노사 공동 전환추진 TF(경영·인사·현장근로자 대표) 및 푸른노무법인 전담 공인노무사 공동 수행 (총 ' + rdInfo.totalCount + '회차, 대면 비율 ' + rdInfo.facePct + '%)',
      rdInfo.rounds.map(function (r) { return '  - [' + r.roundNo + '회차 | ' + r.date + ' | ' + r.modeLabel + '] ' + r.topic; }).join('\n')
    ].join('\n') : [
      '1) 중진공·KMAC 구조혁신지원사업(산업·일자리전환) 추진 배경 및 목적',
      '• ' + coName + '(' + industry + (workerCnt ? ', 상시근로자 ' + workerCnt + '명' : '') + ')는 탄소중립·디지털전환 등 급격한 산업구조 변화 속에서 「' + transGoal + '」을 체계적으로 달성하고 구성원의 고용안정을 확립하기 위하여 중소벤처기업진흥공단·한국능률협회컨설팅(KMAC) 구조혁신(산업·일자리전환) 컨설팅을 추진함.',
      '• 본 중간보고서는 수집된 3개년 재무·인력 비식별 데이터, 노동전환 인식수준 조사(5대 영역) 및 법정 인사규정 진단을 종합하여 중점 과제인 ' + tasks.map(function (t, i) { return '(' + (i + 1) + ') ' + t.name; }).join(', ') + '의 기준선(Baseline)을 확정하는 데 목적이 있음.',
      '',
      '2) 노사 공동 TF 편성 및 회차별 수행 현황',
      '• 노사 동수 참여 원칙의 「노동전환 추진 TF」를 가동하여 총 ' + rdInfo.totalCount + '회차(현장 대면 ' + rdInfo.facePct + '%) 일정으로 수행 중임.',
      rdInfo.rounds.map(function (r) { return '  - [' + r.roundNo + '회차 | ' + r.date + ' | ' + r.modeLabel + '] ' + r.topic; }).join('\n')
    ].join('\n');

    /* 2) company_fin */
    var secCompanyFin = [
      '1) 참여기업 일반현황 및 최근 3개년 경영(재무) 추이',
      '• 기업명: ' + coName + ' / 업종: ' + industry + ' / 주력 품목: ' + mainProduct,
      fs
        ? ('• 최근 3개년 매출 추이: ' + fs.fin3Y.map(function (y) { return y.year + '년 ' + fmtNum(y.salesM) + '백만원(영업이익 ' + fmtNum(y.opProfitM) + '백만원)'; }).join(' → ')
          + ' (기간 매출 변동률 ' + (fs.salesTrendPct >= 0 ? '+' : '') + fs.salesTrendPct + '%)')
        : '• [재무데이터 안내] 사업자등록증 및 최근 3개년 표준재무제표를 첨부·확인하면 연도별 매출액·영업이익 추이표가 자동 반영됩니다.',
      '',
      '2) 조직·인력 구성 및 최근 3개년 입·퇴사 추이 (비식별 명부 집계)',
      rs
        ? ('• 현재 재직 근로자는 총 ' + rs.activeCount + '명(정규직 ' + rs.regularCount + '명, 비정규직 ' + rs.nonRegularCount + '명)이며, 50세 이상 중장년 숙련인력 비중은 ' + rs.senior50Pct + '%, 3년 미만 단기근속 비중은 ' + rs.shortTenurePct + '%로 분석됨.\n'
          + '• 부서·직군 분포: ' + (rs.topDepts.map(function (d) { return d.dept + ' ' + d.count + '명(' + d.pct + '%)'; }).join(', ') || '-') + '\n'
          + '• 3개년 입·퇴사: ' + rs.turnover3Y.map(function (y) { return y.year + '년 입사 ' + y.hires + '명/퇴사 ' + y.leaves + '명(이직률 ' + y.leaveRatePct + '%)'; }).join(' · '))
        : ('• 상시근로자 규모: 약 ' + (workerCnt || '집계 대기') + '명 — ① 기초자료 탭에서 인력명부 엑셀을 확인하면 부서·연령·3개년 입퇴사 통계가 자동 생성됩니다.')
    ].join('\n');

    /* 3) trans_impact */
    var secTransImpact = ag.code === 'cepa' ? [
      '1) 충남 주력·전환산업 외부 환경변화 및 공급망 영향 진단',
      tr.code === 'cepa_coal'
        ? '• [석탄화력 단계적 폐지 영향] 정부의 전력수급기본계획에 따른 충남 권역(보령·태안·당진 등) 석탄화력발전소 단계적 폐지 일정이 본격화됨에 따라, 기존 발전설비 경상정비·기자재 납품 물량의 중장기 축소가 불가피함.'
        : '• [미래차·친환경 산업전환 영향] 완성차 및 전방 고객사의 전동화(EV·수소·하이브리드)·스마트화 전환 가속화로 기존 내연기관·전통 제조 품목의 수주 구조가 급변하고 있음.',
      '• [기업 전환 목표] ' + coName + '는 기존 「' + mainProduct + '」 중심 매출 구조에서 「' + transGoal + '」으로 사업 포트폴리오 다각화 및 공정 전환을 추진 중임.',
      sum.techExcerpts.length ? ('• [기초자료 확인 요지] ' + sum.techExcerpts[0]) : '• 신규 전환 품목의 품질·납기 경쟁력 확보를 위해 기존 현장 인력의 선제적 직무재설계 및 재교육(Reskilling)이 핵심 성패 요인으로 진단됨.'
    ].join('\n') : [
      '1) 산업구조 변화(탄소중립·디지털전환) 및 사업전환 영향도 분석',
      '• 전방 산업의 탄소배출 감축 규제 강화, 공급망 ESG 요구 및 공정 디지털화 추세에 따라 기존 「' + mainProduct + '」 생산방식의 고도화와 「' + transGoal + '」 추진이 필수적인 시점임.',
      '• 사업전환 추진에 따라 기존 단순·반복 조립/가공 직무의 비중은 점진적으로 조정되는 반면, 신규 설비 운용·품질보증·공정관리 직무의 인력 수요가 확대될 것으로 전망됨.',
      sum.techExcerpts.length ? ('• [기업 사업자료 핵심] ' + sum.techExcerpts[0]) : '• 외부 인력 신규 채용만으로는 숙련 공백 해소가 어려우므로, 재직 근로자의 체계적 직무전환(Job Transition)과 고용안정 기반 구축이 병행되어야 함.'
    ].join('\n');

    /* 4) hr_policy_diag */
    var secHrPolicy = [
      '1) 직무체계 및 근로시간·임금 구조 교차진단',
      ws
        ? ('• 비식별 임금·근태 통계(' + ws.workerCount + '명 기준) 분석 결과, 월 임금총액 중 기본급 비중 ' + ws.baseSharePct + '%, 고정연장수당 ' + ws.fixOtSharePct + '%, 직무·제수당 ' + ws.allowSharePct + '%'
          + (ws.avgWeekHours ? ', 주 평균 실근로시간은 ' + ws.avgWeekHours + '시간으로 나타남.' : '로 나타남.'))
        : '• 현행 직무분장표 및 직무기술서(JD)가 전환 예정 신사업·신공정 직무 요건을 충분히 반영하지 못하고 있어 전환기 R&R 재정립이 요구됨.',
      '',
      '2) 취업규칙·근로계약·인사규정 법정 점검 이슈',
      effectiveIssues.map(function (iss, idx) {
        return '• 진단이슈 ' + (idx + 1) + ' [' + iss.title + ']: ' + iss.finding;
      }).join('\n')
    ].join('\n');

    /* 5) survey_diag */
    var secSurvey = [
      '1) 계층별(경영진·인사·현장근로자) 심층 인터뷰 결과',
      '• [경영진] ' + ivExec,
      '• [인사·노무 실무] ' + ivHr,
      '• [현장 근로자] ' + ivWorker,
      '',
      '2) ' + ag.surveyName + ' 집계 분석',
      sv
        ? ('• 설문 종합 평균: ' + sv.totalAvg.toFixed(2) + '점 / 5.00점' + (sv.respondentCount ? ' (응답 ' + sv.respondentCount + '명' + (sv.responseRatePct ? ', 응답률 ' + sv.responseRatePct + '%' : '') + ')' : '') + '\n'
          + sv.areas.map(function (a) { return '  - ' + a.name + ': ' + a.score.toFixed(2) + '점 (준거 ' + a.bench.toFixed(2) + '점 대비 ' + (a.gap >= 0 ? '+' : '') + a.gap.toFixed(2) + '점)'; }).join('\n') + '\n'
          + '• 집중 보완 항목: ' + (sv.weakestItems || []).map(function (w) { return w.name + '(' + w.score.toFixed(2) + '점)'; }).join(', '))
        : '• 설문 엑셀 집계표를 등록하면 5대 영역(환경인식·노사소통·직무전환 수용성·직무재교육·고용안정 신뢰도) 점수와 격차 분석이 자동 반영됩니다.'
    ].join('\n');

    /* 6) core_issues */
    var secCoreIssues = [
      '1) 현황진단 종합 시사점 (As-Is 요약)',
      '• [산업·사업 측면] 「' + mainProduct + '」에서 「' + transGoal + '」으로의 전환 방향성은 명확하나, 전환기 공정 변화와 인력 수급을 연결하는 구체적 직무전환 로드맵이 부재함.',
      '• [인력·직무 측면] 숙련 인력의 암묵지를 신공정으로 이전할 직무기술서(JD) 및 사내 OJT 체계화가 시급하며, 전환배치 시 근로자 수용성을 높일 객관적 인사기준 마련이 필요함.',
      '• [노사·제도 측면] 산업전환 과정에서의 고용불안 해소를 위한 노사 사전협의 채널 정례화 및 취업규칙 내 직무전환·유급훈련 근거 명문화가 요구됨.',
      '',
      '2) 선정 핵심 전환과제 (' + tasks.length + '대 중점 과제)',
      tasks.map(function (t, idx) {
        return '• 과제 ' + (idx + 1) + '. ' + t.name + ' — ' + t.summary;
      }).join('\n')
    ].join('\n');

    /* 7) mid_direction */
    var secMidDirection = [
      '1) 과제별 세부 제도설계 방향 (To-Be)',
      tasks.map(function (t, idx) {
        return [
          '■ 중점과제 ' + (idx + 1) + '. ' + t.name,
          '  - 설계 목표: ' + t.summary,
          '  - 법령·규정 준수: ' + (t.lawPoints || []).join(' / '),
          '  - 연계 지원사업: ' + (t.govAid || []).join(', ')
        ].join('\n');
      }).join('\n\n'),
      '',
      '2) 중간보고 이후 후속 추진 계획',
      '• 본 중간보고 기준선에 대한 노사 TF 검토 피드백(전환 대상 직무·인원, 직무재교육 과정, 상생협약 문안)을 후속 메일로 수렴하여 '
        + ag.short + ' 공식 양식에 맞춘 최종 결과보고서 및 ' + ag.completionDocName + '를 완성함.'
    ].join('\n');

    var generated = {
      overview: secOverview,
      company_fin: secCompanyFin,
      trans_impact: secTransImpact,
      hr_policy_diag: secHrPolicy,
      survey_diag: secSurvey,
      core_issues: secCoreIssues,
      mid_direction: secMidDirection
    };

    var schema = Cat.getMidSections(ag.code);
    var sections = {};
    schema.forEach(function (s) {
      if (locks[s.key] && str(prevSecs[s.key])) {
        sections[s.key] = prevSecs[s.key];
      } else {
        sections[s.key] = generated[s.key] || '';
      }
    });

    return {
      agency: ag.code,
      track: tr.code,
      schema: schema,
      sections: sections,
      locks: locks,
      structured: {
        coName: coName,
        agencyName: ag.name,
        agencyFullTitle: ag.fullTitle,
        trackName: tr.name,
        industry: industry,
        mainProduct: mainProduct,
        transGoal: transGoal,
        workerCnt: workerCnt,
        finRows: finRows,
        deptRows: deptRows,
        turnoverRows: turnoverRows,
        scheduleRows: scheduleRows,
        issueRows: issueRows,
        surveyAreaBars: surveyAreaBars,
        interviewRows: [
          ['경영진·사업총괄', ivExec, '신사업 공정 안착 및 핵심숙련 유지'],
          ['인사·노무 담당', ivHr, '직무전환 기준·규정 정비 및 장려금 연계'],
          ['현장 근로자·대표', ivWorker, '고용안정·임금보전 및 체계적 OJT 지원']
        ],
        roundCheck: rdInfo
      }
    };
  }

  function buildMidSnapshot(project, midReport, actorSid, nowMs) {
    var ts = Number(nowMs) || Date.now();
    return {
      id: 'snap_mid_' + ts,
      kind: 'mid_baseline',
      agency: project.agency || 'kmac',
      track: project.track || 'kmac_std',
      title: str(project.companyName) + ' (' + Cat.getAgency(project.agency).short + ') 중간보고 확정 스냅샷',
      sections: Object.assign({}, midReport.sections),
      confirmedBy: str(actorSid),
      confirmedAt: ts
    };
  }

  /* ══ 4. 기관별 최종결과보고서(Final-Report) 자동 조립 ═══════════════════ */
  function buildFinalReport(project, midReport, intakeMap, schedRounds, prevFinal) {
    var p = project || {};
    var ag = Cat.getAgency(p.agency);
    var tr = Cat.getTrack(p.track, ag.code);
    var coName = str(p.companyName) || '참여기업';
    var mid = midReport || buildMidReport(p, intakeMap, schedRounds, null);
    var sum = collectIntakeSummary(intakeMap);
    var d = sum.mergedDiff;
    var rdInfo = normalizeRounds(p, schedRounds, d);
    var tasks = selectedTaskObjects(p);
    var locks = Object.assign({}, (prevFinal && prevFinal.locks) || {});
    var prevSecs = (prevFinal && prevFinal.sections) || {};

    var ovMap = (p.diffOverrides && typeof p.diffOverrides === 'object') ? p.diffOverrides : {};
    var stMap = (p.diffStatusMap && typeof p.diffStatusMap === 'object') ? p.diffStatusMap : {};

    var targetJobs = str(d.targetJobs || p.targetJobs) || (tr.code === 'cepa_coal' ? '친환경 플랜트 설비정비 · 안전품질관리 직무' : (tr.code === 'cepa_auto' ? '전동화 부품 조립·검사 · 스마트공정 설비보전 직무' : '스마트공정 운영 · 신사업 품질기술 직무'));
    var transferHc = num(d.transferHeadcount || p.transferHeadcount) || Math.max(3, Math.round((mid.structured.workerCnt || 25) * 0.25));
    var trainingProg = str((ovMap.df_edu && ovMap.df_edu.finVal) || d.trainingProgram || p.trainingProgram) || (ag.code === 'cepa' ? '충남 산업일자리전환 지역혁신 직무재교육 및 사내 S-OJT (40시간)' : '산업전환 공동훈련센터 직무전환 과정 및 사내 체계적 현장훈련(S-OJT)');
    var accordTxt = str((ovMap.df_acc && ovMap.df_acc.finVal) || d.accordSummary || p.accordSummary) || '산업전환기 인위적 구조조정 배제, 전환배치 사전협의 및 교육기간 중 임금 100% 보전 노사 상생합의';
    var effDate = str(d.effectiveDate || p.effectiveDate) || (p.year || 2026) + '년 하반기';

    /* 직무전환 매트릭스 표 (KMAC / CEPA 공통 핵심 시각표) */
    var jobMatrixRows = [
      ['기존 레거시 공정 직무', mid.structured.mainProduct + ' 단순가공·조립', '비중 축소 · 다기능화', '전환교육 후 신공정 재배치 (' + transferHc + '명)'],
      ['전환 핵심 확대 직무', targetJobs, '핵심 확대 · 중점 육성', '직무기술서(JD) 재설계 및 숙련전수 OJT 배치'],
      ['품질·안전·공정관리 직무', '신규 규격 품질보증 · 설비안전관리', '기능 고도화 · 신설', '스마트 측정·안전보건 수시 위험성평가 전담'],
      ['기술영업·경영지원 직무', '전환 신사업 수주관리 · 정부지원 연계', '역할 재정립', '전환 프로젝트 관리 및 장려금·훈련 행정 총괄']
    ];

    /* 후속 협의 Diff 대조표 */
    var baseDiffItems = [
      { id: 'df_jobs', item: '전환 대상 직무·인원', midVal: '진단 단계 직무재편 후보군 검토', finVal: targetJobs + ' (전환 목표 ' + transferHc + '명)' },
      { id: 'df_edu',  item: '직무재교육(Reskilling)', midVal: '교육훈련 수요 파악 및 과정 탐색', finVal: trainingProg },
      { id: 'df_acc',  item: '고용안정·노사합의', midVal: '전환기 고용불안 해소 필요성 도출', finVal: accordTxt },
      { id: 'df_aid',  item: '시행시기·연계지원금', midVal: '정부·지자체 지원사업 후보 검토', finVal: effDate + ' / ' + (str(d.govAidTarget) || (ag.code === 'cepa' ? '충남 산업일자리전환 장려금 연계' : '중진공 구조혁신 후속 정책자금·훈련 연계')) }
    ];
    var customDiffs = (Array.isArray(p.customDiffRows) ? p.customDiffRows : [])
      .filter(function (x) { return x && !x._deleted; })
      .map(function (x) { return Object.assign({}, x, { custom: true }); });
    var diffObjects = baseDiffItems.concat(customDiffs).map(function (row) {
      var ov = (!row.custom && ovMap[row.id]) ? ovMap[row.id] : null;
      var itemTxt = (ov && str(ov.item)) || row.item;
      var midTxt = (ov && str(ov.midVal)) || row.midVal;
      var finTxt = (ov && str(ov.finVal)) || row.finVal;
      var st = stMap[row.id] || (ov && str(ov.status)) || row.status || '합의 확정 ✓';
      return { id: row.id, item: itemTxt, midVal: midTxt, finVal: finTxt, status: st, custom: !!row.custom };
    });
    var diffSummaryRows = diffObjects.map(function (r) { return [r.item, r.midVal, r.finVal, r.status]; });

    /* 취업규칙·인사규정 신구대조 핵심표 */
    var sinGuRows = [
      [
        '제15조 (전환배치 및 직무재설계 원칙)',
        '회사는 업무상 필요에 따라 근로자의 근무부서 또는 담당업무를 변경할 수 있다.',
        '산업·사업전환으로 직무를 재편·전환배치할 경우 객관적 역량기준에 의하며, 최소 2주 전 본인 사전협의와 직무적응 교육을 실시하고 근로조건 불이익이 없도록 보호한다.',
        '산업전환고용안정법 취지 및 정당한 인사권 기준 명문화'
      ],
      [
        '제28조 (직무전환 교육훈련 및 유급인정)',
        '회사는 직원의 직무능력 향상을 위해 교육을 실시할 수 있다.',
        '산업·일자리전환 직무재교육(Reskilling) 및 사내 OJT 참여시간은 소정근로시간(유급)으로 인정하며, 수료 결과를 전환 직무 배치 및 다기능 숙련수당에 반영한다.',
        '근로자직업능력 개발법 및 직무전환 수용성 제고'
      ],
      [
        '제52조 (산업전환 관련 노사 사전협의)',
        '노사협의회는 분기별 정기회의를 개최한다.',
        '신사업 진출, 주요 설비·공정 전환 및 대규모 직무재배치 계획 수립 시 노사협의회(또는 전환추진 TF)를 통해 고용안정 및 훈련방안을 사전 협의한다.',
        '근로자참여법 제20조(신기계·기술 도입 협의) 강화'
      ],
      [
        '제60조 (설비·공정 변경 시 안전보건조치)',
        '회사는 산업재해 예방을 위해 안전보건교육을 실시한다.',
        '전환 설비 도입 또는 작업내용 변경 시 지체 없이 수시 위험성평가를 실시하고, 전환배치 근로자에게 작업 변경 안전보건교육을 실시한다.',
        '산업안전보건법 제29조·제36조 준수'
      ]
    ];

    /* 연차별·단계별 로드맵 표 */
    var roadmapRows = ag.code === 'cepa' ? [
      ['1단계: 기반구축 (' + (p.year || 2026) + '년 하반기)', '완료계 제출 · 노사 상생협약 체결 · 전환 직무기술서(JD) 및 개정 취업규칙 확정', '경영진 · 인사팀 · 노사TF', '완료계 · 상생협약서 · 개정 사규'],
      ['2단계: 훈련·재배치 (2027년 상반기)', trainingProg + ' 이수 및 ' + targetJobs + ' 단계적 전환배치(' + transferHc + '명)', '생산·기술부서 · 훈련기관', '훈련수료증 · 전환배치 발령부'],
      ['3단계: 장려금·안착 (2027년 하반기~2028년)', '충남 산업일자리전환 장려금 신청 · 고용유지 모니터링 및 전환품목 양산 안정화', '인사팀 · 충남경제진흥원 연계', '장려금 지급결정 · 고용유지 확인서']
    ] : [
      ['단기 (종료 후 1~3개월)', '노동전환 노사 상생협약 체결 · 취업규칙 변경신고 · 전환 직무기술서(JD) 현업 적용', '인사팀 · 노사 전환TF', '상생협약서 · 신고접수증'],
      ['중기 (종료 후 4~6개월)', trainingProg + ' 운영 · 전환대상 ' + transferHc + '명 단계적 재배치 및 정책매니저 점검', '현업부서 · 정책매니저', '훈련이수표 · 1·2차 점검일지'],
      ['장기 (종료 후 7~12개월)', mid.structured.transGoal + ' 공정 안정화, 직무·숙련 보상 환류 및 사업전환 정책자금 연계', '경영진 · 노사협의회', '연간 전환성과 평가표']
    ];

    /* 정부·지자체 지원사업 매칭 체계도 표 */
    var govMatchRows = ag.code === 'cepa' ? [
      ['충남 산업일자리전환 장려금', '충남경제진흥원 (산업일자리전환지원센터)', '컨설팅 이수 후 직무전환 배치·교육 및 고용유지 요건 충족 기업·근로자 장려금 지원', '1순위 핵심 연계'],
      [tr.code === 'cepa_diag' ? '충남 산업일자리전환 전문컨설팅' : '충남 지역혁신 프로젝트 직무훈련', '충남경제진흥원 · 충남인적자원개발위원회', tr.code === 'cepa_diag' ? '진단컨설팅 완료 기업 대상 심화 직무재설계·인사제도 구축 후속 연계' : '석탄화력·미래차 전환 재직자 맞춤형 직무재교육 훈련비 지원', '즉시 후속 신청'],
      ['노동전환 고용안정 지원금 · S-OJT', '고용노동부 · 한국산업인력공단', '사업전환·직무전환 교육훈련 기간 인건비·훈련비 및 체계적 현장훈련 비용 지원', '병행 매칭 활용'],
      ['중진공 구조혁신 · 사업전환자금', '중소벤처기업진흥공단', '신사업 설비투자·운전자금 융자 우대 및 사업전환 계획 승인 기업 세제·금융 특례', '중기 설비투자 연계']
    ] : [
      ['중진공 사업전환 계획 승인 · 전용자금', '중소벤처기업진흥공단', '구조혁신 컨설팅 이수 기업 대상 신사업 설비·운전자금 융자 및 세제 특례 연계', '1순위 정책자금'],
      ['산업전환 공동훈련센터 · S-OJT 지원', '고용노동부 · 한국산업인력공단', '탄소중립·디지털 전환 재직자 직무재교육 무상훈련 및 사내 체계적 현장훈련 지원', '전환훈련 핵심연계'],
      ['노동전환 지원금 (고용안정 협약연계)', '고용노동부 (관할 고용센터)', '노사 합의로 직무전환·근로시간 조정·재배치를 실시하여 고용을 유지하는 사업주 지원', '노사협약 후 신청'],
      ['구조혁신 정책매니저 사후관리 지원', '한국능률협회컨설팅(KMAC) · 중진공', '컨설팅 종료 후 전환로드맵 이행 점검 및 후속 정부 R&D·수출바우처 매칭 자문', '사후관리 가동']
    ];

    /* 8개 최종 섹션 문안 생성 */
    var secExecSummary = [
      '1) 컨설팅 수행 개요 및 추진 실적',
      '• 사업명: ' + ag.fullTitle + ' (' + tr.name + ')',
      '• 참여기업: ' + coName + ' (' + mid.structured.industry + ' / 상시근로자 ' + (mid.structured.workerCnt || '-') + '명 / 전환목표: ' + mid.structured.transGoal + ')',
      '• 수행실적: 총 ' + rdInfo.totalCount + '회차 수행 완료 (대면 비율 ' + rdInfo.facePct + '%, 수행일지·서명 증빙 ' + rdInfo.proofReadyCount + '/' + rdInfo.totalCount + '회 확인)',
      '',
      '2) 핵심 도출 성과 요약',
      '• [전환직무·재배치] 「' + targetJobs + '」 중심 직무재설계 및 재직자 ' + transferHc + '명 단계적 전환배치 기준 수립',
      '• [직무재교육 체계] ' + trainingProg + ' 실행계획 및 유급 교육시간 인정 기준 확립',
      '• [노사상생·규정정비] ' + accordTxt + ' 및 취업규칙 4대 핵심 조항 신구대조표 완성',
      '• [지원사업 매칭] ' + govMatchRows[0][0] + ' 등 ' + govMatchRows.length + '대 정부·지자체 지원제도 실행 로드맵 구축'
    ].join('\n');

    var secDiagBaseline = [
      '1) 기업 경영·인력 추이 및 산업전환 영향 기준선 요약',
      mid.sections.company_fin,
      '',
      '2) 전방산업 전환 리스크 및 인식수준 진단 결과',
      mid.sections.trans_impact,
      '',
      mid.sections.survey_diag
    ].join('\n');

    var secJobRedesign = [
      '1) 산업전환 연계 직무분석 및 축소·확대·신설 직무 매트릭스',
      jobMatrixRows.map(function (r) {
        return '• [' + r[0] + '] (' + r[1] + ') → 전환방향: ' + r[2] + ' / 실행조치: ' + r[3];
      }).join('\n'),
      '',
      '2) 전환 대상 직무기술서(JD) 재설계 및 공정 전환배치 기준',
      '• 중점 전환직무: ' + targetJobs + ' (전환 목표 인원: ' + transferHc + '명)',
      '• 전환배치 3대 공정 원칙: ① 직무역량·희망직무 사전 면담 실시, ② 최소 2주 전 사전 예고 및 노사 TF 협의, ③ 전환 직무 적응기간(3개월) 동안 평가 불이익 배제 및 멘토 매칭 운영'
    ].join('\n');

    var secReskillPlan = [
      '1) 전환 인력 맞춤형 직무재교육(Reskilling·Upskilling) 운영 설계',
      '• 핵심 훈련과정: ' + trainingProg,
      '• 단계별 커리큘럼 구성:',
      '  - [기초 소양(8h)] 산업·안전보건 변화 이해, 신규 설비 안전작업표준 및 품질 기본규격 교육',
      '  - [직무 전환(24h)] 「' + targetJobs + '」 핵심 공정 실무, 디지털 측정·설비 운용 외부 전문훈련 연계',
      '  - [현장 정착 S-OJT(8h+)] 사내 선임 숙련자 1:1 매칭 현장 실습 및 직무수행 체크리스트 인증',
      '',
      '2) 교육훈련 시간·비용 지원 및 인사 환류 방안',
      '• 모든 직무전환 지정 훈련시간은 소정근로시간(100% 유급)으로 인정하며, 과정 이수자에게 전환 직무 우선 배치 및 다기능 직무수당 부여 근거를 연계함.'
    ].join('\n');

    var secHrGovernance = [
      '1) 중간보고 이후 후속 피드백 반영 내역 (Baseline → Final Diff)',
      diffObjects.map(function (r) {
        return '• [' + r.item + '] (중간기준) ' + r.midVal + ' → (최종확정) ' + r.finVal + ' [' + r.status + ']';
      }).join('\n'),
      (d.requests && d.requests.length ? ('• 기업 추가 반영 요청: ' + d.requests.join(' / ')) : ''),
      '',
      '2) 고용안정 노사 상생협약 및 취업규칙 신구대조 핵심',
      '• 상생협약 골자: ' + accordTxt,
      sinGuRows.map(function (r) {
        return '• ' + r[0] + ': (현행) ' + r[1] + ' ⇒ (개정안) ' + r[2];
      }).join('\n')
    ].filter(Boolean).join('\n');

    var secRoadmap = [
      '1) 단계별·연차별 산업·일자리전환 이행 로드맵 (' + effDate + ' 기점)',
      roadmapRows.map(function (r) {
        return '• [' + r[0] + '] ' + r[1] + ' (추진주체: ' + r[2] + ' / 핵심산출물: ' + r[3] + ')';
      }).join('\n'),
      '',
      '2) 이행 리스크 관리 및 KPI 모니터링 지표',
      '• 핵심 성과지표(KPI): ① 전환대상 인력 교육이수율(목표 100%), ② 전환배치 근로자 6개월 고용유지율(목표 90% 이상), ③ 노사 전환TF 분기 점검 이행률(100%)'
    ].join('\n');

    var secGovMatching = [
      '1) 기업 맞춤형 정부·지자체 지원사업 매칭 체계도',
      govMatchRows.map(function (r, idx) {
        return '• ' + (idx + 1) + '. [' + r[0] + ' | ' + r[1] + '] (' + r[3] + ')\n   - 지원내용 및 요건: ' + r[2];
      }).join('\n'),
      '',
      '2) 수급 요건 충족을 위한 노무관리 필수 유의사항',
      '• 고용유지·일자리전환 관련 지원금은 권고사직·경영상 해고 등 인위적 감원 발생 시 지원이 제한되므로, 본 컨설팅에서 수립한 전환배치·사내훈련 절차를 우선 이행하고 전자 출퇴근·훈련 수료 증빙을 편철·보관해야 함.'
    ].join('\n');

    var fuChecks = (p.followupChecks && typeof p.followupChecks === 'object') ? p.followupChecks : {};
    var fuItems = Cat.getFollowupItems(ag.code);
    var secCompletionPm = ag.code === 'cepa' ? [
      '1) 충남경제진흥원 컨설팅 완료계 및 종합 소견',
      '• ' + coName + '는 ' + tr.name + ' 전 과정을 성실히 이수하여 전방산업 전환 리스크에 대응하는 구체적인 직무재설계·재교육 및 고용유지 기반을 마련함.',
      '• 특히 ' + (tr.code === 'cepa_diag' ? '본 진단 결과를 토대로 후속 전문컨설팅 및 충남 산업일자리전환 지원사업과의 즉각적인 연계가 타당함.' : '충남 산업일자리전환 장려금 및 지역혁신 직무훈련과 연계할 경우 전환 인력의 이탈 없는 안정적 신사업 안착이 기대됨.'),
      '',
      '2) 완료 제출 및 사후 이행점검 계획',
      fuItems.map(function (f, i) {
        return '• ' + (i + 1) + '. ' + (fuChecks[f.code] ? '[완료✓] ' : '[예정□] ') + '[' + f.month + '] ' + f.title;
      }).join('\n')
    ].join('\n') : [
      '1) KMAC 구조혁신(산업·일자리전환) 완료보고 및 전담 컨설턴트 종합소견',
      '• ' + coName + '는 노사 공동 전환추진 TF의 적극적인 참여 아래 사업전환 목표(' + mid.structured.transGoal + ')와 직결된 인적자원 전환 로드맵, 직무기술서(JD), 상생협약 및 규정 개정안을 완비함.',
      '• 향후 중진공 사업전환 정책자금 및 고용노동부 산업전환 공동훈련센터·노동전환 지원금을 단계별로 결합할 경우 높은 구조혁신 시너지가 창출될 것으로 판단됨.',
      '',
      '2) 구조혁신 정책매니저(사후관리) 이행점검 계획',
      fuItems.map(function (f, i) {
        return '• ' + (i + 1) + '. ' + (fuChecks[f.code] ? '[완료✓] ' : '[예정□] ') + '[' + f.month + '] ' + f.title;
      }).join('\n')
    ].join('\n');

    var generated = {
      exec_summary: secExecSummary,
      diag_baseline: secDiagBaseline,
      job_redesign: secJobRedesign,
      reskill_plan: secReskillPlan,
      hr_governance: secHrGovernance,
      roadmap: secRoadmap,
      gov_matching: secGovMatching,
      completion_pm: secCompletionPm
    };

    var schema = Cat.getFinalSections(ag.code, tr.code);
    var finalSections = {};
    schema.forEach(function (s) {
      if (locks[s.key] && str(prevSecs[s.key])) {
        finalSections[s.key] = prevSecs[s.key];
      } else {
        finalSections[s.key] = generated[s.key] || '';
      }
    });

    return {
      agency: ag.code,
      track: tr.code,
      schema: schema,
      sections: finalSections,
      locks: locks,
      structured: {
        coName: coName,
        agencyCode: ag.code,
        agencyName: ag.name,
        agencyFullTitle: ag.fullTitle,
        trackCode: tr.code,
        trackName: tr.name,
        targetJobs: targetJobs,
        transferHeadcount: transferHc,
        trainingProgram: trainingProg,
        accordSummary: accordTxt,
        effectiveDate: effDate,
        jobMatrixRows: jobMatrixRows,
        diffObjects: diffObjects,
        diffSummaryRows: diffSummaryRows,
        sinGuRows: sinGuRows,
        roadmapRows: roadmapRows,
        govMatchRows: govMatchRows,
        roundCheck: rdInfo,
        midStructured: mid.structured
      }
    };
  }

  /* ══ 5. 기관 제출용 부속 서식 문안 (수행계획서 · 완료계/완료보고서 · 회차일지) ══ */
  function buildSubmissionTexts(project, midReport, finalReport, intakeMap, schedRounds) {
    var p = project || {};
    var ag = Cat.getAgency(p.agency);
    var tr = Cat.getTrack(p.track, ag.code);
    var mid = midReport || buildMidReport(p, intakeMap, schedRounds, null);
    var fin = finalReport || buildFinalReport(p, mid, intakeMap, schedRounds, null);
    var rdInfo = fin.structured.roundCheck;

    var planText = [
      '【' + ag.short + ' — ' + tr.name + ' 수행계획서 요약 문안】',
      '■ 참여기업: ' + mid.structured.coName + ' (' + mid.structured.industry + ')',
      '■ 전환목표: ' + mid.structured.transGoal,
      '■ 전담 컨설턴트: ' + (str(p.consultantName) || '푸른노무법인 전담 공인노무사'),
      '',
      '1. 참여기업 현황 및 컨설팅 필요성',
      mid.sections.company_fin,
      '',
      '2. 중점 수행 과제 및 설계 방향',
      mid.sections.mid_direction,
      '',
      '3. 회차별 수행 일정 계획 (총 ' + rdInfo.totalCount + '회차)',
      rdInfo.rounds.map(function (r) {
        return '  - ' + r.roundNo + '회차 (' + r.date + ', ' + r.modeLabel + ', ' + r.mins + '분): ' + r.topic;
      }).join('\n')
    ].join('\n');

    var completionText = ag.code === 'cepa' ? [
      '【충남경제진흥원(충남 산업일자리전환지원센터) 컨설팅 완료계 문안】',
      '■ 사 업 명: ' + (p.year || 2026) + '년 충남 산업일자리전환 ' + (tr.code === 'cepa_diag' ? '진단컨설팅' : '전문컨설팅'),
      '■ 참여기업: ' + mid.structured.coName + ' (주력품목: ' + mid.structured.mainProduct + ')',
      '■ 수행기관 / 컨설턴트: 푸른노무법인 / ' + (str(p.consultantName) || '전담 공인노무사'),
      '■ 수행횟수: 총 ' + rdInfo.totalCount + '회 수행 완료 (현장방문 ' + rdInfo.faceCount + '회, 비대면 ' + (rdInfo.totalCount - rdInfo.faceCount) + '회)',
      '',
      '■ 주요 과업 완수 내역',
      '  1) 전방산업 전환 영향 및 인사노무 현황 진단 완료',
      '  2) 전환 대상 직무(' + fin.structured.targetJobs + ', ' + fin.structured.transferHeadcount + '명) 및 직무재교육 계획 수립',
      '  3) 고용안정 상생협약안 · 취업규칙 신구대조표 및 충남 산업일자리전환 장려금 매칭 완료',
      '',
      '위와 같이 산업·일자리전환 컨설팅 과업을 모두 완료하였기에 결과보고서 및 증빙서류를 첨부하여 완료계를 제출합니다.'
    ].join('\n') : [
      '【중진공 · 한국능률협회컨설팅(KMAC) 구조혁신(산업·일자리전환) 완료보고서 및 정책매니저 요약】',
      '■ 사 업 명: ' + (p.year || 2026) + '년 구조혁신지원사업 (산업·일자리전환 컨설팅)',
      '■ 참여기업: ' + mid.structured.coName + ' (전환목표: ' + mid.structured.transGoal + ')',
      '■ 수행컨설턴트: 푸른노무법인 ' + (str(p.consultantName) || '전담 공인노무사'),
      '■ 총 수행회차: 총 ' + rdInfo.totalCount + '회차 완수 (대면 ' + rdInfo.facePct + '%)',
      '',
      '■ 핵심 산출물 요약',
      '  1) 노동전환 인식수준 조사(5대 영역) 및 노사관계 진단 기준선 확립',
      '  2) 전환 직무 매트릭스 · 직무기술서(JD) 재설계(' + fin.structured.targetJobs + ') 및 S-OJT 훈련 로드맵 수립',
      '  3) 노동전환 고용안정 노사 상생협약서 및 정부지원사업 매칭 체계도(' + fin.structured.govMatchRows.length + '종) 도출',
      '',
      '■ 정책매니저(사후관리) 중점 연계 사항',
      fin.sections.completion_pm
    ].join('\n');

    var roundLogsText = rdInfo.rounds.map(function (r) {
      return [
        '[' + r.roundNo + '회차 컨설팅 수행일지 — ' + mid.structured.coName + ']',
        '• 일시 / 방법: ' + r.date + ' / ' + r.modeLabel + ' (' + r.mins + '분, 기업 참석 ' + r.companyPeople + '인)',
        '• 자문 주제: ' + r.topic,
        '• 수행 내용: ' + r.topic + ' 관련 기업 기초데이터 및 현장 의견을 검토하고 ' + ag.short + ' 보고서 반영 사항을 확정함.',
        '• 증빙 확인: 현장사진(' + (r.hasPhoto ? '완료✓' : '미확인') + ') · 서명부(' + (r.hasSign ? '완료✓' : '미확인') + ')'
      ].join('\n');
    }).join('\n\n');

    return {
      planText: planText,
      completionText: completionText,
      roundLogsText: roundLogsText
    };
  }

  /* ══ 6. AI 윤문 프롬프트 및 환각 숫자 검증 안전장치 ═════════════════════ */
  function buildAiPolishPrompt(sectionTitle, rawSectionText, agencyCode, namesToMask) {
    var ag = Cat.getAgency(agencyCode);
    var masked = Intake.maskPiiStrict(rawSectionText, namesToMask || []);
    if (Intake.hasResidualPii(masked.text)) {
      return { ok: false, error: '개인정보 패턴이 남아 있어 외부 AI 전송을 차단했습니다.' };
    }
    var prompt = [
      '당신은 대한민국 공인노무사가 작성하는 「' + ag.fullTitle + '」 공식 컨설팅 보고서 전문 윤문 도우미입니다.',
      '아래 초안에 포함된 모든 수치(인원, 금액, 비율%, 점수, 연도, 회차)와 사실관계는 단 하나도 변경하거나 새로 지어내지 마세요.',
      '노무 표준 용어 원칙에 따라 「급여」 대신 「임금」, 「직원」 대신 「근로자」로 표기하세요.',
      '[참여기업], [대표자], [담당자], [가림] 같은 비식별 표시는 절대 삭제하거나 바꾸지 말고 그대로 유지하세요.',
      ag.short + ' 제출용 공식 보고서에 걸맞은 명확하고 전문적인 개조식 문체로 다듬어 본문만 출력하세요.',
      '',
      '[섹션 제목] ' + str(sectionTitle),
      '[초안 본문]',
      masked.text
    ].join('\n');

    return {
      ok: true,
      prompt: prompt,
      maskedText: masked.text,
      back: masked.back
    };
  }

  function extractSignificantNumbers(text) {
    var matches = String(text == null ? '' : text).match(/\d+(?:,\d{3})*(?:\.\d+)?/g) || [];
    var out = {};
    matches.forEach(function (m) {
      var clean = m.replace(/,/g, '');
      if (clean.length >= 2 || clean.indexOf('.') >= 0) out[clean] = 1;
    });
    return out;
  }

  function checkHallucinatedNumbers(sourceText, aiReplyText) {
    var srcSet = extractSignificantNumbers(sourceText);
    var repSet = extractSignificantNumbers(aiReplyText);
    var added = Object.keys(repSet).filter(function (n) { return !srcSet[n]; });
    return {
      clean: added.length === 0,
      hallucinatedNumbers: added
    };
  }

  return {
    collectIntakeSummary: collectIntakeSummary,
    normalizeRounds: normalizeRounds,
    buildMidReport: buildMidReport,
    buildMidSnapshot: buildMidSnapshot,
    buildFinalReport: buildFinalReport,
    buildSubmissionTexts: buildSubmissionTexts,
    buildAiPolishPrompt: buildAiPolishPrompt,
    checkHallucinatedNumbers: checkHallucinatedNumbers
  };
});
