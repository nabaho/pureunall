/* 푸른통합시스템 — 안전보건체계구축 실무 서류·서식 22종 업종별 체크 · 초안 생성 · 샘플 자동치환 엔진
 * (브라우저 window.PuSafetyDocs / Node module.exports 겸용)
 *
 * 맡는 일:
 *   1. 최초 착수 6단계 로드맵 및 실무 서류·서식 22종(규정·회의록·점검표·계획서·대장) 정의
 *   2. 업종(8대 업종)·근로자 규모(5~49인/50인+/30인+/100인+)·계약/작업중지 사유별 자동 필수판별
 *   3. 사업장·업종 맞춤형 실무 초안 본문 자동 생성
 *   4. 타 사업장 작성본·수집 자료·PC 업로드 샘플에서 상호·대표자·사업자번호·연도·사용자 키워드 1클릭 자동 치환
 */
(function (root, factory) {
  'use strict';
  var isNode = typeof module === 'object' && module.exports;
  var Cat = isNode ? require('./pu-safety-catalog.js') : root.PuSafetyCatalog;
  var api = factory(Cat);
  if (isNode) module.exports = api;
  if (root) root.PuSafetyDocs = api;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this), function (Cat) {
  'use strict';

  function str(v) { return v == null ? '' : String(v).trim(); }
  function num(v, d) {
    if (v == null || v === '' || typeof v === 'boolean') return d === undefined ? 0 : d;
    var n = Number(v);
    return isFinite(n) ? n : (d === undefined ? 0 : d);
  }
  function escapeRe(s) {
    return String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  function todayYmd() {
    return new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  }
  /* 타 사업장 샘플 본문에 남을 수 있는 민감 식별정보 패턴 1차 마스킹 */
  function maskCrossSamplePii(raw) {
    var t = String(raw == null ? '' : raw);
    var count = 0;
    t = t.replace(/\b(\d{6})\s*-\s*([1-4]\d{6})\b/g, function (_, f) { count++; return f + '-*******'; });
    t = t.replace(/\b(01[016789])[\s.-]?(\d{3,4})[\s.-]?(\d{4})\b/g, function () { count++; return '[연락처 비식별]'; });
    t = t.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, function () { count++; return '[이메일 비식별]'; });
    t = t.replace(/(?:[A-Za-z]:\\|\/Users\/|\/home\/)[^\s\r\n"']+/g, function () { count++; return '[로컬경로]'; });
    return { text: t, count: count };
  }
  function coreCorpName(v) {
    return str(v)
      .replace(/^\s*(?:주식회사|㈜|\(주\)|유한회사|유한책임회사|\(유\))\s*/g, '')
      .replace(/\s*(?:주식회사|㈜|\(주\)|유한회사|유한책임회사|\(유\))\s*$/g, '')
      .trim() || str(v);
  }

  /* ══ 1. 최초 안전보건체계구축 착수 6단계 로드맵 ══════════════════════════ */
  var ONBOARDING_STEPS = [
    {
      code: 'step1', order: 1, title: '1단계 · 계약·착수 기초파악',
      timing: '계약 직후 ~ 1주 (1회차 전후)',
      desc: '위임계약 체결 후 기초자료 요청서를 발송하고, 경영책임자(CEO)·현장담당자 킥오프 면담으로 인원·업종·설비·재해·작업중지/시정명령 이력을 확정합니다.',
      docCodes: ['kickoff_req', 'kickoff_minutes', 'site_inventory']
    },
    {
      code: 'step2', order: 2, title: '2단계 · 방침·조직·규정·예산',
      timing: '1~2주차 (체계 뼈대 제정)',
      desc: '안전보건경영방침을 선포하고 관리조직·업무분장, 업종 특화 안전보건관리규정(취업규칙 연계), 연간 이행계획 및 예산을 확정합니다.',
      docCodes: ['policy_goal', 'org_roles', 'safety_rules', 'plan_budget']
    },
    {
      code: 'step3', order: 3, title: '3단계 · 협의체·회의록·TBM',
      timing: '2~3주차 (근로자 참여)',
      desc: '산업안전보건위원회·노사협의회 안전안건 회의록, 종사자 의견청취함, 매일 작업 전 10분 안전점검회의(TBM) 기록 체계를 가동합니다.',
      docCodes: ['committee_minutes', 'worker_voice', 'tbm_log']
    },
    {
      code: 'step4', order: 4, title: '4단계 · 위험성평가·점검표',
      timing: '3~6주차 (2~3회차 핵심)',
      desc: '위험성평가 실시규정을 제정하고 팀 회의록·공정별 평가표·개선조치를 완료하며, 반기 이행점검표와 보호구·기계 점검일지를 구축합니다.',
      docCodes: ['risk_regulation', 'risk_meeting_log', 'risk_sheet', 'halfyear_inspect', 'ppe_machine_log']
    },
    {
      code: 'step5', order: 5, title: '5단계 · 교육·물질·업종특화',
      timing: '4~7주차 (3~4회차)',
      desc: '연간 교육계획·서명부, MSDS 관리대장과 함께 유통(고객응대·근골격계·물류동선) 또는 제조(안전작업허가·LOTO) 특화 서식을 정착합니다.',
      docCodes: ['edu_plan_log', 'msds_chem_log', 'permit_loto', 'customer_ergo']
    },
    {
      code: 'step6', order: 6, title: '6단계 · 비상·도급·작업중지해제',
      timing: '종결·사후 (4~5회차/긴급)',
      desc: '비상대응계획·훈련기록, 적격 수급업체 수준평가표를 정비하고, 작업중지명령·급박위험 발생 시 작업중지권 및 해제 개선계획서를 완성합니다.',
      docCodes: ['emergency_plan', 'subcontract_eval', 'workstop_release']
    }
  ];

  var DOC_CATEGORIES = [
    { code: 'init', name: '착수·기초' },
    { code: 'rules', name: '규정·방침' },
    { code: 'minutes', name: '회의록·참여' },
    { code: 'risk', name: '위험성·점검' },
    { code: 'edu', name: '교육·물질·특화' },
    { code: 'special', name: '비상·도급·작업중지' }
  ];

  /* ══ 2. 안전보건체계 실무 표준 서류·서식 22종 마스터 ═════════════════════ */
  var DOC_TEMPLATES = [
    {
      code: 'kickoff_req', no: 1, step: 'step1', stepLabel: '1단계 착수', category: 'init', categoryLabel: '착수·기초', docKind: 'round_log',
      name: '최초 착수 기초자료 요청서 및 킥오프 안내문', short: '기초자료 요청서',
      legalRef: '컨설팅 착수 공통 · 산안법 제14조~36조', frequency: '계약 직후 1회',
      summary: '사업자등록증·조직도·도면·설비·취업규칙·산재/감독이력 사전 준비 공문'
    },
    {
      code: 'kickoff_minutes', no: 2, step: 'step1', stepLabel: '1단계 착수', category: 'minutes', categoryLabel: '회의록·참여', docKind: 'round_log',
      name: '착수 킥오프 회의록 (CEO · 담당자 최초 면담)', short: '착수 회의록',
      legalRef: '중처법 시행령 제4조 제1호 · 공단 2026 기준', frequency: '1회차 방문 시',
      summary: '경영책임자 의지 확인, 현장 애로사항, 추진 일정 및 개선 목표 합의 회의록'
    },
    {
      code: 'site_inventory', no: 3, step: 'step1', stepLabel: '1단계 착수', category: 'init', categoryLabel: '착수·기초', docKind: 'policy_org',
      name: '사업장 기초현황 · 보유설비 · 유해인자 · 도급 파악표', short: '기초현황 파악표',
      legalRef: '중처법 시행령 제4조 제3호·제9호', frequency: '착수 1회 · 변경 시',
      summary: '공정/매장/창고 레이아웃, 지게차·설비·화학물질·수급업체 목록 일람표'
    },
    {
      code: 'policy_goal', no: 4, step: 'step2', stepLabel: '2단계 뼈대', category: 'rules', categoryLabel: '규정·방침', docKind: 'policy_org',
      name: '안전보건경영방침 및 연도별 안전보건목표 선언서', short: '경영방침·목표',
      legalRef: '중처법 시행령 제4조 제1호 (전 사업장 필수)', frequency: '매년 초 갱신·게시',
      summary: '대표이사 서명 방침 게시문 + 정량·정성 목표 및 핵심 추진지표(KPI)'
    },
    {
      code: 'org_roles', no: 5, step: 'step2', stepLabel: '2단계 뼈대', category: 'rules', categoryLabel: '규정·방침', docKind: 'policy_org',
      name: '안전보건 관리조직도 · 권한/책임 업무분장표 · 선임/지정서', short: '조직·업무분장',
      legalRef: '중처법 시행령 제4조 제5호, 산안법 제15~19조', frequency: '제정 · 인사이동 시',
      summary: '경영책임자·안전보건관리책임자·관리감독자·담당자 지정서 및 평가 기준'
    },
    {
      code: 'safety_rules', no: 6, step: 'step2', stepLabel: '2단계 뼈대', category: 'rules', categoryLabel: '규정·방침', docKind: 'rules_hr',
      name: '안전보건관리규정 (취업규칙 안전보건 장 · 업종 특화수칙)', short: '안전보건관리규정',
      legalRef: '산안법 제25조·제26조 · 중처법 제4조', frequency: '제정 · 개정 시 게시/신고',
      summary: '조직·교육·점검·사고조사·작업중지권·업종별 필수 안전작업 수칙 표준 규정'
    },
    {
      code: 'plan_budget', no: 7, step: 'step2', stepLabel: '2단계 뼈대', category: 'rules', categoryLabel: '규정·방침', docKind: 'plan_budget',
      name: '연간 안전보건 이행계획서 및 예산 편성·집행 실적표', short: '이행계획·예산표',
      legalRef: '중처법 시행령 제4조 제4호 (인력·시설·장비 예산)', frequency: '매년 편성 · 반기 집행점검',
      summary: '월별 실행계획 및 보호구·시설보강·검진·교육·위탁 예산 편성/집행 증빙표'
    },
    {
      code: 'committee_minutes', no: 8, step: 'step3', stepLabel: '3단계 참여', category: 'minutes', categoryLabel: '회의록·참여', docKind: 'worker_voice',
      name: '산업안전보건위원회 / 노사협의회 안전보건 안건 회의록', short: '산보위·노사위 회의록',
      legalRef: '산안법 제24조 · 근참법 제20조', frequency: '분기 1회 정기·수시',
      summary: '노사 동수 참석, 안전목표·위험성평가·규정개정·작업중지 심의·의결 회의록'
    },
    {
      code: 'worker_voice', no: 9, step: 'step3', stepLabel: '3단계 참여', category: 'minutes', categoryLabel: '회의록·참여', docKind: 'worker_voice',
      name: '종사자 안전보건 의견청취서 및 개선조치 결과 관리대장', short: '근로자 의견청취표',
      legalRef: '중처법 시행령 제4조 제7호 (반기 1회 이상)', frequency: '반기 1회 이상 · 상시',
      summary: '현장/매장/하청 종사자 제안 접수→검토→조치완료 회신 및 불이익 금지 확인'
    },
    {
      code: 'tbm_log', no: 10, step: 'step3', stepLabel: '3단계 참여', category: 'minutes', categoryLabel: '회의록·참여', docKind: 'inspect_list',
      name: '작업 전 안전점검회의 (TBM) 일지 및 참여 서명부', short: 'TBM 일지·서명부',
      legalRef: '위험성평가 지침 제13조 (상시 공유)', frequency: '작업 시작 전 상시/주간',
      summary: '당일 작업공정, 지게차·설비·추락 핵심 위험포인트 3건, 보호구 확인 서명부'
    },
    {
      code: 'risk_regulation', no: 11, step: 'step4', stepLabel: '4단계 위험성', category: 'risk', categoryLabel: '위험성·점검', docKind: 'risk_proc',
      name: '위험성평가 실시규정 및 추진절차서 (최초·정기·수시·상시)', short: '위평 실시규정',
      legalRef: '산안법 제36조, 사업장 위험성평가에 관한 지침', frequency: '최초 제정 · 매년 검토',
      summary: '평가조직·빈도×강도(또는 체크리스트/핵심요인법) 기준·근로자 참여/공유 절차'
    },
    {
      code: 'risk_meeting_log', no: 12, step: 'step4', stepLabel: '4단계 위험성', category: 'minutes', categoryLabel: '회의록·참여', docKind: 'risk_proc',
      name: '위험성평가 추진회의록 및 결과 근로자 주지·서명 확인서', short: '위평 회의록',
      legalRef: '고용부 고시 제12조·제13조 (참여 및 결과공유)', frequency: '최초·정기·수시 평가마다',
      summary: '현장 근로자 참여 위험도 협의·감소대책 결정 회의록 및 게시/공유 서명부'
    },
    {
      code: 'risk_sheet', no: 13, step: 'step4', stepLabel: '4단계 위험성', category: 'risk', categoryLabel: '위험성·점검', docKind: 'risk_proc',
      name: '업종 맞춤형 공정별 유해·위험요인 파악 및 위험성평가표', short: '위험성평가표',
      legalRef: '산안법 제36조 · 중처법 시행령 제4조 제3호', frequency: '최초 · 연 1회 · 수시',
      summary: '업종·기인물 특화 공정별 위험요인, 위험성 등급, 감소대책, 이행확인표'
    },
    {
      code: 'halfyear_inspect', no: 14, step: 'step4', stepLabel: '4단계 위험성', category: 'risk', categoryLabel: '위험성·점검', docKind: 'inspect_list',
      name: '반기 1회 안전보건관리체계 이행점검표 및 경영책임자 보고서', short: '반기 이행점검표',
      legalRef: '중처법 시행령 제4조 제3호·제4호·제5호·제7호·제8호·제9호', frequency: '상·하반기 각 1회 필수',
      summary: '중처법 의무 9호 전 항목 반기 자체점검표 + 미흡사항 경영자 보고/개선결재'
    },
    {
      code: 'ppe_machine_log', no: 15, step: 'step4', stepLabel: '4단계 위험성', category: 'risk', categoryLabel: '위험성·점검', docKind: 'inspect_list',
      name: '보호구 지급대장 및 보유 기계·설비·지게차 일일/월간 점검일지', short: '보호구·설비점검표',
      legalRef: '안전보건규칙 제32조·제35조·제179조', frequency: '지급 시 · 작업 전 점검',
      summary: '안전화·안전모·장갑 수령서명대장 및 지게차·프레스·컨베이어·도크 점검 체크표'
    },
    {
      code: 'edu_plan_log', no: 16, step: 'step5', stepLabel: '5단계 교육·특화', category: 'edu', categoryLabel: '교육·물질·특화', docKind: 'edu_record',
      name: '연간 안전보건교육 계획서 및 교육 실시일지 · 참석 서명부', short: '안전교육 계획·일지',
      legalRef: '산안법 제29조~제32조 (정기·채용시·변경·특별)', frequency: '매분기 정기 · 입사/변경 시',
      summary: '사무/현장/관리감독자 연간 교육시간표, 교육내용 요약, 참석자 자필 서명부'
    },
    {
      code: 'msds_chem_log', no: 17, step: 'step5', stepLabel: '5단계 교육·특화', category: 'edu', categoryLabel: '교육·물질·특화', docKind: 'msds_list',
      name: '취급 화학물질(MSDS) 목록 대장 · 경고표지 · 보관 점검표', short: 'MSDS 대장',
      legalRef: '산안법 제114조·제115조 (게시 및 교육)', frequency: '취급 개시 · 변경 시',
      summary: '유해·화학물질/세척제/살균제 목록, 경고라벨 부착, 세안설비·환기 점검'
    },
    {
      code: 'permit_loto', no: 18, step: 'step5', stepLabel: '5단계 교육·특화', category: 'edu', categoryLabel: '교육·물질·특화', docKind: 'permit_loto',
      name: '비일상·고위험 작업허가서(PTW) 및 운전정지(LOTO) 절차서', short: '작업허가·LOTO',
      legalRef: '안전보건규칙 제92조 · 중처법 제4조 제3호', frequency: '정비·화기·밀폐·고소 작업 시',
      summary: '전원차단 잠금(LOTO) 수칙 및 화기·밀폐·고소작업 사전 승인 허가서 양식'
    },
    {
      code: 'customer_ergo', no: 19, step: 'step5', stepLabel: '5단계 교육·특화', category: 'edu', categoryLabel: '교육·물질·특화', docKind: 'rules_hr',
      name: '고객응대근로자 보호 매뉴얼 및 근골격계·물류안전 수칙', short: '고객응대·근골격계',
      legalRef: '산안법 제41조 · 안전보건규칙 제80조·제656조', frequency: '제정 · 상시 비치/게시',
      summary: '폭언·폭행 예방 안내문·업무중단·유급휴식 절차 + 2인1조 중량물·고임목·의자비치 수칙'
    },
    {
      code: 'emergency_plan', no: 20, step: 'step6', stepLabel: '6단계 비상·도급', category: 'special', categoryLabel: '비상·도급·작업중지', docKind: 'emergency',
      name: '비상조치계획서 · 비상대응조직도 · 비상연락망 · 반기 훈련결과서', short: '비상대응·훈련서',
      legalRef: '중처법 시행령 제4조 제8호 (반기 1회 훈련 필수)', frequency: '반기 1회 이상 훈련·점검',
      summary: '화재·끼임·지게차충돌·정전 시나리오별 작업중지·대피·구호·119신고·훈련기록'
    },
    {
      code: 'subcontract_eval', no: 21, step: 'step6', stepLabel: '6단계 비상·도급', category: 'special', categoryLabel: '비상·도급·작업중지', docKind: 'subcontract',
      name: '적격 수급업체(도급·용역·위탁) 선정 기준평가표 및 협의체 회의록', short: '수급업체 평가·협의체',
      legalRef: '중처법 시행령 제4조 제9호 · 산안법 제64조', frequency: '계약 전 평가 · 월/분기 점검',
      summary: '운송·설비보수·청소·공사 외주업체 계약 전 안전수준 점수표 및 월 1회 협의체 회의록'
    },
    {
      code: 'workstop_release', no: 22, step: 'step6', stepLabel: '6단계 비상·도급', category: 'special', categoryLabel: '비상·도급·작업중지', docKind: 'accident_near',
      name: '급박한 위험 작업중지권 절차서 및 작업중지명령 해제 개선계획서', short: '작업중지·해제계획서',
      legalRef: '산안법 제51조·제52조·제55조 · 고용부 작업중지 해제 기준', frequency: '상시 절차 · 명령 발생 시 즉시',
      summary: '근로자 작업중지권 행사 절차 + 고용부 작업중지명령 해제 심의용 개선계획/의견청취서'
    }
  ];

  function getTemplate(code) {
    return DOC_TEMPLATES.find(function (t) { return t.code === code; }) || null;
  }

  function hasWorkstopContext(project) {
    var p = project || {};
    var txt = [p.summaryNote, p.source, p.companyName, p.contractBrief].map(str).join(' ');
    return /작업중지|중대재해|시정명령|감독대응|해제/.test(txt);
  }

  /* ══ 3. 업종 · 근로자 규모 · 계약 사유별 서류 필요 여부 판별 ════════════ */
  function evalDocRequirement(tpl, project) {
    var t = typeof tpl === 'string' ? getTemplate(tpl) : tpl;
    if (!t) return { level: 'optional', label: '선택', cls: '', reason: '' };
    var p = project || {};
    var indCode = str(p.industryCode) || 'mfg_general';
    var extras = Array.isArray(p.extraIndustries) ? p.extraIndustries : [];
    var allInds = [indCode].concat(extras);
    var workers = num(p.workerCount, 0);
    var isWorkstop = hasWorkstopContext(p);
    var hasInd = function (arr) { return allInds.some(function (ic) { return arr.indexOf(ic) >= 0; }); };

    if (t.code === 'workstop_release') {
      if (isWorkstop) {
        return { level: 'urgent', label: '긴급필수', cls: 'c-urgent', reason: '작업중지·감독 대응 계약/이력 감지 — 개선계획·근로자의견·해제심의 서류 최우선' };
      }
      return { level: 'recommended', label: '권장(체계)', cls: 'c-amber', reason: '산안법 제52조 작업중지권 보장 및 급박위험 대응 절차 구비 권장' };
    }

    if (t.code === 'customer_ergo') {
      if (hasInd(['retail_logis', 'service_fac', 'medical_welfare', 'food_lodging', 'edu_office'])) {
        return { level: 'industry_req', label: '업종필수', cls: 'c-green', reason: '유통·서비스·복지·외식·교육 업종 필수(고객응대 산안법 제41조 + 근골격계·물류안전)' };
      }
      return { level: 'optional', label: '해당시', cls: '', reason: '대고객 응대 또는 중량물 취급 공정 보유 시 작성' };
    }

    if (t.code === 'permit_loto') {
      if (hasInd(['mfg_general', 'mfg_high', 'const_sub'])) {
        return { level: 'industry_req', label: '업종필수', cls: 'c-green', reason: '제조·건설·설비보수 LOTO(전원차단)·화기·밀폐 안전작업허가 핵심 의무' };
      }
      if (hasInd(['retail_logis'])) {
        return { level: 'recommended', label: '권장', cls: 'c-amber', reason: '물류창고 컨베이어·도크·냉동기계 정비·외부공사 진행 시 적용 권장' };
      }
      return { level: 'optional', label: '해당시', cls: '', reason: '기계 정비·고소·화기·밀폐 등 비일상 작업 발생 시 작성' };
    }

    if (t.code === 'msds_chem_log') {
      if (hasInd(['mfg_high', 'mfg_general'])) {
        return { level: 'industry_req', label: '업종필수', cls: 'c-green', reason: '제조공정 절삭유·세척제·도료·화학물질 MSDS 현장 게시 및 교육 의무' };
      }
      if (hasInd(['food_lodging', 'service_fac', 'medical_welfare'])) {
        return { level: 'recommended', label: '권장', cls: 'c-amber', reason: '주방세제·소독제(락스/산성세제 혼합금지)·의약용품 취급 시 비치 권장' };
      }
      return { level: 'optional', label: '해당시', cls: '', reason: '세척제·도료 등 화학물질 취급 시 작성 (미취급 시 해당없음 가능)' };
    }

    if (t.code === 'subcontract_eval') {
      if (hasInd(['const_sub', 'mfg_high']) || workers >= 50) {
        return { level: 'industry_req', label: '업종필수', cls: 'c-green', reason: '원하청 혼재·도급·설치·외주보수 계약 시 수급인 적격성 평가 의무(중처법 제4조 9호)' };
      }
      return { level: 'recommended', label: '권장', cls: 'c-amber', reason: '화물운송·지입·창고용역·청소/경비·시설공사 외주 위탁 시 필수' };
    }

    if (t.code === 'committee_minutes') {
      if (workers >= 50) {
        return { level: 'required', label: '법정필수', cls: 'c-blue', reason: '상시 50인+ 산보위 설치·분기 회의록 의무(도매 등 일부 업종은 100인+, 30인+ 노사위 대체 확인)' };
      }
      if (workers >= 30) {
        return { level: 'industry_req', label: '규모필수', cls: 'c-green', reason: '상시 30인 이상 노사협의회 분기별 정기회의록(안전보건 안건 포함) 의무' };
      }
      return { level: 'recommended', label: '권장', cls: 'c-amber', reason: '30인 미만은 법정 설치 의무는 없으나 근로자 참여 증빙용 노사간담회 회의록 권장' };
    }

    if (t.code === 'safety_rules') {
      if (workers >= 100) {
        return { level: 'required', label: '법정필수', cls: 'c-blue', reason: '상시 100인 이상 산안법 제25조 단독 안전보건관리규정 작성·게시 의무' };
      }
      if (workers >= 10 || workers === 0) {
        return { level: 'industry_req', label: '핵심필수', cls: 'c-green', reason: '10인+ 취업규칙 내 안전보건 조항 필수 (또는 단독 안전보건관리규정 제정 권장)' };
      }
      return { level: 'recommended', label: '권장', cls: 'c-amber', reason: '10인 미만 사업장도 기본 안전수칙·작업중지권 내부 규정 비치 권장' };
    }

    if (t.code === 'kickoff_req' || t.code === 'kickoff_minutes' || t.code === 'site_inventory') {
      return { level: 'required', label: '착수필수', cls: 'c-blue', reason: '계약 직후 최초 착수 시 현황 파악 및 킥오프 면담 증빙' };
    }

    if (['policy_goal', 'org_roles', 'plan_budget', 'worker_voice', 'risk_regulation', 'risk_meeting_log', 'risk_sheet', 'halfyear_inspect', 'ppe_machine_log', 'edu_plan_log', 'emergency_plan'].indexOf(t.code) >= 0) {
      return { level: 'required', label: '법정필수', cls: 'c-blue', reason: '산안법·중처법(5인+) 전 업종 공통 핵심 이행 서류' };
    }

    return { level: 'recommended', label: '권장', cls: 'c-amber', reason: '컨설팅 수행 표준 증빙' };
  }

  /* ══ 4. 업종·사업장 맞춤형 22종 실무 초안 자동 생성 ═══════════════════════ */
  function indSpecificClauseLines(indCode) {
    var ind = Cat.getIndustry(indCode);
    var topChecks = (ind.checks || []).slice(0, 6).map(function (c, i) {
      return (i + 1) + '. [' + c.cat + '] ' + c.text + ' (근거: ' + (c.lawRef || '안전보건규칙') + ')';
    });
    return {
      ind: ind,
      hazardsBullets: (ind.mainHazards || []).map(function (h, i) { return '  ' + (i + 1) + ') ' + h; }).join('\n'),
      checksBullets: topChecks.join('\n')
    };
  }

  function buildTemplateDraft(docCode, project, opts) {
    var tpl = getTemplate(docCode);
    if (!tpl) return { title: '안전보건 서식', body: '' };
    var p = project || {};
    var o = opts || {};
    var indCode = str(o.presetIndustryCode) || str(p.industryCode) || 'mfg_general';
    var ctx = indSpecificClauseLines(indCode);
    var ind = ctx.ind;
    var co = str(o.companyName) || str(p.companyName) || '(사업장명)';
    var ceo = str(o.ceoName) || str(p.ceoName) || '대표이사 ○○○';
    var addr = str(o.address) || str(p.address) || '(사업장 소재지 입력)';
    var mgr = str(o.siteManager) || str(p.contactName) || '안전보건관리담당자 ○○○';
    var cons = str(o.consultantName) || str(p.consultantName) || '푸른노무법인 전담 공인노무사';
    var workers = num(o.workerCount != null ? o.workerCount : p.workerCount, 0);
    var workerText = workers > 0 ? (workers + '명') : '○명';
    var yr = num(o.year != null ? o.year : p.year, 2026) || 2026;
    var ymd = str(o.docDate) || todayYmd();
    var scales = Cat.getScaleObligations(workers || 25, ind.code);
    var reqProj = Object.assign({}, p, { industryCode: indCode, workerCount: workers });
    if (o.presetIndustryCode) reqProj.extraIndustries = [];
    var reqInfo = evalDocRequirement(tpl, reqProj);
    var isWorkstop = hasWorkstopContext(p);

    var hdr = '■ 문서명: ' + tpl.name + '\n' +
      '■ 사업장: ' + co + '  |  업종: ' + ind.name + '  |  상시근로자: ' + workerText + ' (' + scales.scaleBand + ')\n' +
      '■ 소재지: ' + addr + '  |  작성일: ' + ymd + '\n' +
      '■ 적용판정: [' + reqInfo.label + '] ' + reqInfo.reason + '\n\n';

    var body = '';
    if (docCode === 'kickoff_req') {
      body = hdr +
        '수신: ' + co + ' ' + ceo + ' 귀하 (참조: ' + mgr + ')\n' +
        '발신: 푸른노무법인 (' + cons + ')\n' +
        '제목: ' + yr + '년 안전보건관리체계 구축 착수 킥오프 및 기초자료 요청\n\n' +
        '1. 목적\n' +
        '위임계약 체결에 따라 ' + co + '의 [' + ind.short + '] 업종 특성과 근로자 규모(' + workerText + ')에 맞는 중대재해처벌법·산업안전보건법 이행체계를 최단기간 내 체계적으로 구축하기 위하여 아래와 같이 착수 기초자료를 요청드립니다.\n\n' +
        '2. 최초 착수 필수 준비자료 목록\n' +
        '| 연번 | 요청 자료명 | 확인 목적 | 준비 여부 |\n' +
        '| 1 | 사업자등록증, 조직도 및 비상연락망 | 업무분장·관리책임자 체계 편성 | [ ] |\n' +
        '| 2 | 작업장·창고·매장 배치도 및 공정 흐름도 | 동선·위험구역 사전 파악 | [ ] |\n' +
        '| 3 | 보유 유해·위험 기계기구·지게차·화물차 목록 | 안전인증·검사·기인물 점검 | [ ] |\n' +
        '| 4 | 기존 취업규칙, 안전보건관리규정, 도급·용역 계약 현황 | 규정 정비 및 수급인 평가 범위 | [ ] |\n' +
        '| 5 | 최근 3년 산재·공상·아차사고 이력 및 감독/시정명령서 | 재발방지 및 중점 개선과제 설정 | [ ] |\n' +
        '| 6 | 기존 위험성평가표, 교육일지, 건강검진 수검현황, MSDS | 누락 법정의무 즉시 보완 | [ ] |\n\n' +
        '3. ' + ind.short + ' 업종 1회차 현장점검 중점 사항\n' +
        ctx.checksBullets + '\n\n' +
        (isWorkstop ? '※ 긴급 확인: 본 사업장은 위험성평가 및 작업중지명령 해제/감독 대응이 포함되어 있으므로, 관할 노동지청 명령서·지적사항 사본 및 현장 사진 자료를 우선 송부해 주시기 바랍니다.\n' : '');
    } else if (docCode === 'kickoff_minutes') {
      body = hdr +
        '1. 회의 개요\n' +
        '| 일시 | ' + ymd + ' 10:00~11:30 | 장소 | ' + co + ' 회의실 |\n' +
        '| 참석자(회사) | ' + ceo + ', ' + mgr + ', 현장 반장·근로자 대표 ○○○ | 수행기관 | ' + cons + ' |\n\n' +
        '2. 경영책임자(CEO) 1차 면담 및 주요 논의 안건\n' +
        '- 안건 1: ' + yr + '년 안전보건경영방침·목표 및 중처법 시행령 제4조 의무사항 확인\n' +
        '- 안건 2: ' + co + '(' + ind.short + ') 핵심 5대 위험요인 공유\n' + ctx.hazardsBullets + '\n' +
        '- 안건 3: 매 회차 현장 근로자 의견청취 및 위험성평가 추진 일정 확정\n' +
        (isWorkstop ? '- 안건 4(긴급): 작업중지명령·지적사항 원인과 즉각 개선조치·해제 심의 일정 확정\n' : '') + '\n' +
        '3. 의결 및 조치계획\n' +
        '| 구분 | 조치 내용 | 담당자 | 기한 |\n' +
        '| 1 | 안전보건경영방침 확정·게시 및 관리감독자 지정서 발령 | ' + ceo + ' / ' + mgr + ' | ' + ymd + ' |\n' +
        '| 2 | 전 공정·물류/작업장 순회점검 및 위험성평가 착수 | ' + mgr + ' / ' + cons + ' | 착수 2주 내 |\n\n' +
        '4. 참석자 서명 확인\n' +
        '경영책임자: ' + ceo + ' (서명)   |   근로자대표: ○○○ (서명)   |   컨설턴트: ' + cons + ' (서명)\n';
    } else if (docCode === 'site_inventory') {
      body = hdr +
        '1. 일반 및 규모 현황\n' +
        '| 항목 | 현황 내용 | 법적 기준 판정 |\n' +
        '| 사업장명 / 대표자 | ' + co + ' / ' + ceo + ' | 중처법 ' + (workers >= 5 ? '적용 대상(5인+)' : '5인 미만 기본의무') + ' |\n' +
        '| 주업종 / 근로자수 | ' + ind.name + ' / ' + workerText + ' | 노사협의회 ' + (workers >= 30 ? '대상(30인+)' : '자율 권장') + ' |\n' +
        '| 안전관리 선임구분 | ' + scales.scaleBand + ' | 담당자/관리자 대상 확인 |\n\n' +
        '2. 보유 유해·위험 기계기구 · 설비 · 차량 목록\n' +
        '| 설비·장비명 | 대수/규격 | 안전인증·검사 유효기한 | 관리담당자 | 비고 |\n' +
        '| 지게차 / 하역운반기계 | ○대 | 면허·전용통로·후방경보 | ○○○ | ' + (indCode === 'retail_logis' ? '창고·도크 핵심' : '운반구역') + ' |\n' +
        '| 작업설비 / 컨베이어·프레스 | ○대 | 방호덮개·LOTO·비상정지 | ○○○ | 해당 시 기재 |\n' +
        '| 이동식 사다리 / 고소작업대 | ○대 | A형 3.5m이하·2인1조 | ○○○ | 안전모·안전대 |\n\n' +
        '3. ' + ind.short + ' 업종 주요 위험공정 및 도급·외주 현황\n' +
        ctx.hazardsBullets + '\n\n' +
        '| 도급·용역·위탁 업체명 | 작업 내용 | 출입 인원 | 적격평가 완료 여부 |\n' +
        '| ○○○ (화물운송/보수/청소 등) | 상하차·설비정비·시설관리 | ○명 | [ ] 완료  [ ] 예정 |\n';
    } else if (docCode === 'policy_goal') {
      body = hdr +
        '[' + yr + '년도 ' + co + ' 안전보건경영방침]\n\n' +
        co + '은(는) 모든 종사자(협력사·수급인 포함)의 생명과 안전을 경영활동의 최우선 가치로 삼고, 안전한 ' + ind.short + ' 일터를 조성하기 위하여 다음 사항을 성실히 이행한다.\n\n' +
        '1. 경영책임자는 산업안전보건법 및 중대재해처벌법 등 안전보건 관계 법령을 철저히 준수하고, 필요한 인력·시설·예산을 최우선 배정한다.\n' +
        '2. 노사가 함께 참여하는 위험성평가를 상시 실시하여 현장의 유해·위험요인을 사전에 발굴·제거한다.\n' +
        '3. 작업 전 안전점검회의(TBM)와 안전교육을 내실화하고, 급박한 위험 발견 시 종사자 누구나 즉시 작업중지권을 행사할 수 있도록 보장한다.\n' +
        '4. 반기 1회 이상 안전보건관리체계 이행상태를 점검·평가하여 문제점을 즉시 개선한다.\n\n' +
        '[' + yr + '년도 안전보건 핵심 목표 (KPI)]\n' +
        '| 번호 | 세부 목표 항목 | 목표 수치 / 달성 기준 | 점검 주기 |\n' +
        '| 1 | 중대산업재해 및 휴업 3일+ 산업재해 발생 | 0건 (Zero) | 상시 / 반기 |\n' +
        '| 2 | 전 공정·작업장 위험성평가 및 감소대책 이행률 | 100% 완료 | 연 1회 + 수시 |\n' +
        '| 3 | 종사자 안전보건교육 수료율 및 의견청취 처리율 | 100% / 14일 이내 회신 | 분기 / 반기 |\n' +
        '| 4 | 비상대응 시나리오 반기 1회 합동 훈련 실시 | 연 2회 완료 | 상·하반기 |\n\n' +
        '선언일: ' + ymd + '\n' +
        co + '  경영책임자  ' + ceo + '  (서명 또는 인)\n';
    } else if (docCode === 'org_roles') {
      body = hdr +
        '1. 안전보건관리체계 조직도\n' +
        '[경영책임자: ' + ceo + ']\n' +
        '   ├── 안전보건관리책임자 / 총괄책임: ' + mgr + '\n' +
        '   ├── 근로자 참여기구: 산업안전보건위원회 / 노사협의회 (근로자위원 · 사용자위원 동수)\n' +
        '   ├── 업종별 관리감독자: 현장/창고/공정별 부서장·팀장 지정\n' +
        '   └── 안전·보건 담당자 / 도급 협의체(필요 시)\n\n' +
        '2. 직책별 안전보건 권한 · 책임 · 업무분장표\n' +
        '| 직책 | 지정 성명 | 법령상 핵심 책임 및 권한 | 평가 기준(반기) |\n' +
        '| 경영책임자 | ' + ceo + ' | 방침·목표 결정, 예산·인력 배정, 반기 이행점검 및 재발방지 총괄 | 이행률 · 재해 0건 |\n' +
        '| 안전보건총괄 | ' + mgr + ' | 위험성평가·교육·검진·점검 총괄, 수급인 안전조치 확인 | 일정준수 · 100% |\n' +
        '| 관리감독자 | (부서장 지정) | 작업 전 TBM, 기계·지게차·동선 점검, 보호구 착용 지도, 작업중지 조치 | TBM·점검일지 |\n' +
        '| 전체 종사자 | 전 직원 | 안전수칙·보호구 준수, 위험요인 제안 및 급박위험 시 작업중지권 행사 | 참여·제안 건수 |\n\n' +
        '3. 관리감독자 지정서(약식)\n' +
        '위 사람을 산업안전보건법 제16조에 따른 ' + co + '의 관리감독자로 지정하며, 소속 작업자의 유해·위험요인 통제 및 안전작업 지휘 권한을 부여합니다.\n' +
        '발령일: ' + ymd + '   |   ' + co + ' ' + ceo + ' (인)\n';
    } else if (docCode === 'safety_rules') {
      body = hdr +
        '제1장 총칙\n' +
        '제1조(목적) 이 규정은 산업안전보건법 제25조 및 중대재해처벌법에 따라 ' + co + ' 종사자(협력사·수급인 포함)의 안전·보건을 유지·증진하고 산업재해를 예방하기 위한 기준을 정함을 목적으로 한다.\n' +
        '제2조(적용범위) 이 규정은 ' + co + ' 본사·사업장·창고·매장·작업장에서 근무하는 모든 임직원 및 도급·용역·위탁 종사자에게 적용한다.\n\n' +
        '제2장 안전보건관리조직 및 직무\n' +
        '제3조(경영책임자의 책무) 대표이사는 매년 안전보건경영방침·목표, 예산·인력을 편성하고 반기 1회 이상 이행상태를 점검·개선한다.\n' +
        '제4조(관리감독자 및 근로자 참여) 회사는 부서별 관리감독자를 지정하고, 근로자 의견청취·노사협의회(산보위)를 통해 안전보건 사항을 협의한다.\n\n' +
        '제3장 위험성평가 및 안전보건교육·점검\n' +
        '제5조(위험성평가) 최초·연 1회 정기·설비/공정 변경 및 재해발생 시 수시 위험성평가를 근로자 참여하에 실시하고 결과를 게시·공유한다.\n' +
        '제6조(안전보건교육 및 건강관리) 정기·채용 시·작업변경·특별교육 및 일반/특수 건강검진을 법정 주기에 따라 이행한다.\n\n' +
        '제4장 ' + ind.short + ' 업종 특화 안전작업 수칙 (핵심 준수사항)\n' +
        '제7조(업종 특화 안전기준) 모든 종사자는 다음 ' + ind.short + ' 중점 안전수칙을 반드시 준수한다.\n' +
        ctx.checksBullets + '\n\n' +
        '제5장 급박한 위험 시 작업중지 및 비상대응\n' +
        '제8조(작업중지권 보장) 종사자는 산업재해가 발생할 급박한 위험이 있는 경우 즉시 작업을 중지하고 대피한 후 관리감독자에게 보고하며, 회사는 이를 이유로 어떠한 불이익 처분도 하지 않는다.\n' +
        '제9조(사고조사 및 징계/포상) 아차사고 및 산업재해 발생 시 원인조사·재발방지 대책을 수립하며, 우수 제안자에게는 포상하고 고의·중대한 안전수칙 반복 위반 시 취업규칙에 따라 징계할 수 있다.\n\n' +
        '부칙: 이 규정은 ' + ymd + '부터 시행한다. (취업규칙 안전보건 장과 연동 운영)\n';
    } else if (docCode === 'plan_budget') {
      body = hdr +
        '1. ' + yr + '년도 연간 안전보건 이행계획서\n' +
        '| 추진 영역 | 주요 실행 과제 | 수행 시기 | 담당 |\n' +
        '| 체계 수립 | 경영방침 선포, 조직·업무분장, 안전보건관리규정 정비 | 1분기(착수 시) | ' + ceo + ' / ' + mgr + ' |\n' +
        '| 위험성평가 | ' + ind.short + ' 공정·설비 최초/정기 평가 및 감소대책 완료 | 상반기 / 수시 | 전 부서 |\n' +
        '| 교육·건강 | 정기(분기)·신규·특별교육 및 건강검진 100% 수검 | 매분기 / 연중 | ' + mgr + ' |\n' +
        '| 점검·훈련 | 반기 1회 체계 이행점검, 비상대피·소화훈련 2회 | 6월 · 11월 | 전 직원 |\n\n' +
        '2. ' + yr + '년도 안전보건 예산 편성 및 집행 실적표\n' +
        '| 비목 구분 | 세부 편성 항목 (업종: ' + ind.short + ') | 편성액(천원) | 집행액(천원) | 증빙자료 |\n' +
        '| 보호구·장구 | 안전화, 안전모, 절연/내화학장갑, 안전대, 조리화/방한복 | 0,000 | 0,000 | 세금계산서·지급대장 |\n' +
        '| 시설·방호개선 | 방호덮개, LOTO 잠금장치, 동선 도색, 반사경, 고임목, 미끄럼매트 | 0,000 | 0,000 | 공사내역·전후사진 |\n' +
        '| 교육·검진·자문 | 안전보건 법정교육, 건강검진, 안전검사, 컨설팅 자문료 | 0,000 | 0,000 | 수료증·이체내역 |\n' +
        '| 비상·표지물품 | 소화기, 비상구유도등, 구급함, 자국어 안전표지판, 휴게시설 | 0,000 | 0,000 | 구매영수증·현장사진 |\n\n' +
        '승인: ' + co + ' 경영책임자 ' + ceo + ' (인)\n';
    } else if (docCode === 'committee_minutes') {
      body = hdr +
        '1. 회의 개요 (' + (workers >= 50 ? '산업안전보건위원회' : '노사협의회 안전보건 분과') + ')\n' +
        '| 회의 일시 | ' + ymd + ' 15:00 | 장소 | ' + co + ' 회의실 | 정기/수시 | 정기 분기회의 |\n' +
        '| 사용자위원 | ' + ceo + ', ' + mgr + ', 부서장 ○○○ | 근로자위원 | 근로자대표 ○○○ 외 ○명 |\n\n' +
        '2. 심의 · 의결 안건\n' +
        '- 안건 1: ' + yr + '년 안전보건경영방침·이행계획·예산 보고 및 동의\n' +
        '- 안건 2: ' + ind.short + ' 작업장 위험성평가 실시 결과 및 감소대책 이행점검\n' +
        '- 안건 3: ' + (indCode === 'retail_logis' ? '물류창고 지게차 동선 분리·상하차 고임목·고객응대 보호조치 협의' : '기계류 방호장치·LOTO 절차·MSDS·유해작업 보호구 지급 협의') + '\n' +
        '- 안건 4: 근로자 건의사항 및 작업중지권·아차사고 처리 결과 확인\n\n' +
        '3. 회의 결과 및 이행 결정\n' +
        '| 안건 | 노사 합의 · 의결 사항 | 담당자 | 완료예정일 |\n' +
        '| 1 | 현장 제안 유해·위험요인 즉시 개선 및 예산 우선 집행 승인 | ' + mgr + ' | ' + ymd + ' +14일 |\n' +
        '| 2 | 분기 안전보건교육 및 반기 비상대응 합동훈련 일정 확정 | 관리감독자 | 당해 반기 내 |\n\n' +
        '4. 노사 참석위원 서명 확인 (이 회의록을 사내 게시판에 게시·주지함)\n' +
        '사용자위원 대표: ' + ceo + ' (서명)   |   근로자위원 대표: ○○○ (서명)\n';
    } else if (docCode === 'worker_voice') {
      body = hdr +
        '1. 종사자 안전보건 의견청취 및 제안 접수·개선 처리 대장\n' +
        '(중대재해처벌법 시행령 제4조 제7호 — 하청·배송·수급인 포함 전 종사자 의견청취)\n\n' +
        '| 연번 | 접수일 | 소속/공정 | 제안·불편 유해위험요인 내용 | 검토 및 개선 조치 결과 | 처리일 | 회신확인 |\n' +
        '| 1 | ' + ymd + ' | ' + (indCode === 'retail_logis' ? '물류·상하차' : '현장·작업장') + ' | ' + (ind.mainHazards[0] || '작업동선·협착 위험 개선 요청') + ' | 현장 점검 후 보완 완료(사진 첨부) | 처리중 | 서명 |\n' +
        '| 2 | ' + ymd + ' | ' + (indCode === 'retail_logis' ? '창고·매장' : '공통설비') + ' | ' + (ind.mainHazards[1] || '보호구·조명·바닥 미끄럼 보완 요청') + ' | 예산 반영 및 교체 예정 | 검토중 | 서명 |\n\n' +
        '2. 종사자 면담·설문 핵심 확인 사항 (체크)\n' +
        '- [ ] 안전보건 의견제안함(온라인/오프라인) 및 QR·담당자 직통 신고 창구 안내 여부\n' +
        '- [ ] 위험요인 신고·작업중지 시 어떠한 인사상·경제상 불이익도 없음 고지 여부\n' +
        '- [ ] 개선 결과를 제안자 및 전체 근로자에게 게시판·TBM으로 공유 완료 여부\n';
    } else if (docCode === 'tbm_log') {
      body = hdr +
        '1. 작업 전 10분 안전점검회의 (TBM: Tool Box Meeting) 일지\n' +
        '| 작업일자 | ' + ymd + ' | 작업부서/구역 | ' + co + ' (' + ind.short + ' 현장) | 관리감독자 | ' + mgr + ' |\n\n' +
        '2. 금일 주요 작업 및 3대 핵심 위험요인 · 안전대책\n' +
        '| 금일 작업내용 | 핵심 위험요인 (아차사고·기인물) | 작업 전 필수 안전대책 (직접 확인) |\n' +
        '| 1일 주요공정 | ' + (ind.mainHazards[0] || '끼임·부딪힘 위험') + ' | 방호장치·전용통로·유도자·안전거리 확보 |\n' +
        '| 보조/비일상작업 | ' + (ind.mainHazards[1] || '전도·추락·근골격계') + ' | 운전정지(LOTO)·2인1조·중량물 대차 사용 |\n\n' +
        '3. 작업자 건강상태 및 개인보호구 착용 확인 서명부\n' +
        '| 번호 | 성명 | 작업내용 | 건강이상 유무 | 안전모/화/보호구 | 서명 |\n' +
        '| 1 |  |  | [ ] 양호  [ ] 이상 | [ ] 착용완료 |  |\n' +
        '| 2 |  |  | [ ] 양호  [ ] 이상 | [ ] 착용완료 |  |\n' +
        '| 3 |  |  | [ ] 양호  [ ] 이상 | [ ] 착용완료 |  |\n';
    } else if (docCode === 'risk_regulation') {
      body = hdr +
        '제1조(목적) 본 규정은 산업안전보건법 제36조 및 고용노동부 「사업장 위험성평가에 관한 지침」에 따라 ' + co + '의 유해·위험요인을 스스로 파악하고 감소대책을 수립·실행하기 위한 절차를 정한다.\n' +
        '제2조(평가 시기) 1. 최초평가: 체계구축 착수 시 전 공정·작업 대상 실시  2. 정기평가: 매년 1회 재검토  3. 수시평가: 설비/원재료/공정 변경 또는 산재·작업중지·아차사고 발생 시 즉시  4. 상시평가: 월 1회 순회점검·TBM·근로자 제안 연계.\n' +
        '제3조(평가 조직 및 근로자 참여) 안전보건관리책임자를 총괄로 하여 부서 관리감독자 및 해당 공정/작업 현장 근로자 2인 이상을 반드시 평가팀에 참여시킨다.\n' +
        '제4조(평가 방법) 사업장 특성에 맞춰 빈도(가능성 1~3)·강도(중대성 1~3) 곱셈법 또는 체크리스트법·핵심요인 기술법(OPS)을 선택 적용하며, 위험성 수준 "상" 항목은 작업 전 즉시 개선 완료 후 작업한다.\n' +
        '제5조(감소대책 우선순위) ① 위험작업·설비 제거(대체) → ② 공학적 대책(방호덮개·연동장치·배기·통로구획) → ③ 관리적 대책(표지·교육·LOTO·교대) → ④ 개인보호구 지급 순서로 적용한다.\n' +
        '제6조(기록 보존 및 결과 공유) 위험성평가 결과표와 개선대책은 TBM·사내 게시판·노사협의회를 통해 전 근로자에게 공유하고 3년 이상 보존한다.\n';
    } else if (docCode === 'risk_meeting_log') {
      body = hdr +
        '1. 위험성평가 추진회의 개요\n' +
        '| 회의 일시 | ' + ymd + ' | 평가 구분 | [ ] 최초  [ ] 정기  [✓] 수시/개선 | 주관 | ' + mgr + ' |\n' +
        '| 참여자 | 관리감독자, 현장근로자 대표(○명), 컨설턴트 ' + cons + ' |\n\n' +
        '2. 도출된 주요 유해·위험요인 및 근로자 의견 반영 내역\n' +
        ctx.hazardsBullets + '\n\n' +
        '| 순번 | 공정·작업장소 | 현장 근로자 제기 위험요인 | 합의된 감소대책 | 완료기한 |\n' +
        '| 1 | 주요 작업구역 | ' + (ind.mainHazards[0] || '기계/장비 위험') + ' | 방호조치·작업절차 정비 및 표지 부착 | ' + ymd + ' +14일 |\n' +
        '| 2 | 동선·운반구역 | ' + (ind.mainHazards[1] || '하역·충돌·추락 위험') + ' | 전용통로 표시·고임목·사다리 2인1조 의무 | ' + ymd + ' +14일 |\n\n' +
        '3. 위험성평가 결과 근로자 주지 및 공유 확인 서명부\n' +
        '(평가 결과와 개선대책을 교육·게시·TBM을 통해 안내받고 내용을 숙지하였음을 확인합니다.)\n' +
        '| 번호 | 소속 | 성명 | 주지 확인일 | 서명 |\n' +
        '| 1 |  |  | ' + ymd + ' |  |\n' +
        '| 2 |  |  | ' + ymd + ' |  |\n';
    } else if (docCode === 'risk_sheet') {
      var checkRowsText = (ind.checks || []).slice(0, 6).map(function (c, i) {
        return '| ' + (i + 1) + ' | ' + c.cat + ' | ' + c.text + ' | 중/상 | ' + (c.evidence || '현장개선·교육') + ' | ' + mgr + ' | 진행 |';
      }).join('\n');
      body = hdr +
        '1. ' + co + ' (' + ind.name + ') 맞춤형 유해·위험요인 평가 및 감소대책표\n' +
        '| 번호 | 공정·구분 | 유해·위험요인 파악 | 현재 위험도 | 감소대책 및 실행방법 | 담당자 | 개선완료 |\n' +
        checkRowsText + '\n\n' +
        '2. 평가 참여자 확인: 관리책임자 ' + mgr + ' (서명)  |  현장근로자 ○○○ (서명)  |  자문 ' + cons + ' (서명)\n';
    } else if (docCode === 'halfyear_inspect') {
      body = hdr +
        '1. 반기 1회 안전보건관리체계 이행점검표 (중처법 시행령 제4조 각 호 기준)\n' +
        '| 점검 항목 | 법령 근거 | 상·하반기 이행 여부 | 미흡사항 · 즉시 개선조치 계획 |\n' +
        '| 1. 경영방침·목표 설정 및 반기 달성도 관리 | 시행령 제4조 1·2호 | [ ] 적정  [ ] 보완 | 게시상태·목표실적 점검 |\n' +
        '| 2. 전담조직·업무분장 및 평가·권한 부여 | 시행령 제4조 2·5호 | [ ] 적정  [ ] 보완 | 관리감독자 반기 업무수행 평가 |\n' +
        '| 3. 유해·위험요인 확인 및 개선 절차 점검 | 시행령 제4조 3호 | [ ] 적정  [ ] 보완 | 위험성평가·개선전후 사진 확인 |\n' +
        '| 4. 안전보건 인력·시설·장비 예산 편성/집행 | 시행령 제4조 4호 | [ ] 적정  [ ] 보완 | 예산 집행률·영수증 대조 |\n' +
        '| 5. 종사자 의견청취 및 개선조치 피드백 | 시행령 제4조 7호 | [ ] 적정  [ ] 보완 | 의견함·면담 조치율 100% 확인 |\n' +
        '| 6. 중대산업재해 대비 매뉴얼 및 반기 훈련 | 시행령 제4조 8호 | [ ] 적정  [ ] 보완 | 반기 1회 훈련사진·결과보고 |\n' +
        '| 7. 도급·용역·위탁 수급업체 수준평가·점검 | 시행령 제4조 9호 | [ ] 적정  [ ] 해당없음 | 외주업체 점검·협의체 회의록 |\n\n' +
        '2. 경영책임자(CEO) 보고 및 승인 결재\n' +
        '점검일자: ' + ymd + '   |   점검자: ' + mgr + ' (서명)   |   경영책임자 확인: ' + ceo + ' (서명)\n';
    } else if (docCode === 'ppe_machine_log') {
      body = hdr +
        '1. 개인보호구 지급 · 관리 대장\n' +
        '| 지급일 | 수령자 성명 | 부서 | 지급 품목 (안전화·안전모·안전대·장갑 등) | 규격/KCs 인증 | 수량 | 수령자 서명 |\n' +
        '| ' + ymd + ' | ○○○ | 현장/물류 | 안전화 / 작업용 보호장갑 / 보안경 | KCs 인증품 | 각 1 |  |\n\n' +
        '2. 주요 보유 기계 · 설비 · 지게차 · 사다리 점검 일지 (' + ind.short + ' 특화)\n' +
        '| 점검 항목 | 점검 기준 | 판정(적정/불량) | 이상 시 조치내용 |\n' +
        '| 지게차·운반차량 | 제동장치·후방경보·전조등·안전띠·시동키 관리·고임목 | [ ] 적정  [ ] 불량 | |\n' +
        '| 기계 방호·비상정지 | 끼임부위 덮개, 라이트커튼/인터록, 비상정지버튼 정상 | [ ] 적정  [ ] 불량 | |\n' +
        '| 사다리·바닥·통로 | A형 3.5m이하 2인1조, 랙 하중표시, 통로 적치물 없음 | [ ] 적정  [ ] 불량 | |\n' +
        '| 전기·분전함·소화기 | 분전함 시건·접지, 누전차단, 소화기 압력계 정상위치 | [ ] 적정  [ ] 불량 | |\n';
    } else if (docCode === 'edu_plan_log') {
      body = hdr +
        '1. ' + yr + '년도 연간 안전보건교육 계획표 (산업안전보건법 제29조)\n' +
        '| 교육 구분 | 대상자 | 법정 기준 | 주요 교육 과목 (' + ind.short + ' 특화) | 예정 시기 |\n' +
        '| 정기 안전교육 | 전 근로자 | 매분기 3~6시간(사무3·생산6) | ' + ind.short + ' 사고사례, TBM, 작업중지권, 건강증진 | 3·6·9·12월 |\n' +
        '| 채용 시 교육 | 신규·단기·알바 | 일용 1시간 / 상용 8시간 | 사업장 위험요인, 보호구, 비상대피로, MSDS | 입사 즉시 |\n' +
        '| 작업내용변경·특별 | 설비·취급·지게차 등 | 변경 2시간 / 특별 16시간 | 지게차·크레인·밀폐·화기·사다리·혼합작업 수칙 | 작업 전 |\n\n' +
        '2. 안전보건교육 실시 일지\n' +
        '| 교육일시 | ' + ymd + ' (1시간) | 강사 | ' + mgr + ' / ' + cons + ' | 장소 | 사내 회의실 |\n' +
        '| 교육제목 | ' + ind.short + ' 핵심 위험성평가 · 작업중지권 · 보호구 및 응급조치 교육 |\n\n' +
        '3. 교육 참석자 서명부\n' +
        '| 번호 | 소속 | 성명 | 서명 | 번호 | 소속 | 성명 | 서명 |\n' +
        '| 1 |  |  |  | 3 |  |  |  |\n' +
        '| 2 |  |  |  | 4 |  |  |  |\n';
    } else if (docCode === 'msds_chem_log') {
      body = hdr +
        '1. 취급 화학물질 (MSDS: 물질안전보건자료) 관리대장\n' +
        '| 번호 | 제품명(화학물질명) | 사용 공정/장소 | 주요 유해·위험성 | 경고표지 부착 | MSDS 비치위치 | 관리담당 |\n' +
        '| 1 |  |  | [ ] 인화성  [ ] 부식·자극 | [ ] 부착 | 현장/창고 바인더 | ' + mgr + ' |\n' +
        '| 2 |  |  | [ ] 흡입독성  [ ] 혼합금지 | [ ] 부착 | 현장/창고 바인더 | ' + mgr + ' |\n\n' +
        '2. 화학물질 취급 현장 필수 체크사항\n' +
        '- [ ] 소분 용기(스프레이·통) 포함 모든 용기에 제품명·경고그림문자(GHS 라벨) 부착\n' +
        '- [ ] 작업자가 쉽게 볼 수 있는 현장 위치에 MSDS 최신본(또는 QR코드) 게시 및 교육 완료\n' +
        '- [ ] 염소계 세제(락스)와 산성 세제 혼합 보관·혼합 사용 금지 표지 부착 및 환기·보호구 비치\n';
    } else if (docCode === 'permit_loto') {
      body = hdr +
        '1. 비일상 작업 운전정지 · 잠금장치 (LOTO) 표준 절차\n' +
        '① 정비·청소·수리·이물질 제거 시작 전 반드시 설비 동력원(차단기·밸브)을 완전 차단한다.\n' +
        '② 작업자 개인 자물쇠(Lock)로 잠그고, 「점검·수리 중 조작금지 (작업자명·연락처)」 표지(Tag-Out)를 부착한다.\n' +
        '③ 잔압·잔열·회전 관성 완전 정지 및 검전 확인 후 작업하며, 시운전 전 모든 인원 대피를 확인한 뒤 잠금을 해제한다.\n\n' +
        '2. 고위험 작업 사전 안전작업허가서 (PTW)\n' +
        '| 허가 번호 | PTW-' + yr + '-___ | 작업 일시 | ' + ymd + ' __:__ ~ __:__ | 허가 대상 | [ ] 화기  [ ] 밀폐  [ ] 고소(2m+)  [ ] LOTO정전 |\n' +
        '| 작업 장소 및 내용 | | 작업팀장 / 감시인 | |\n\n' +
        '| 사전 안전조치 필수 확인 | 확인 여부 |\n' +
        '| 화기: 주변 11m 가연물 제거, 불티비산방지포, 소화기 2대+, 화재감시자(종료 후 1시간 감시) | [ ] 확인 |\n' +
        '| 밀폐: 작업 전 산소(18~23.5%)·유해가스 농도측정, 송풍환기 가동, 송기마스크·감시인 | [ ] 확인 |\n' +
        '| 고소: 안전대 부착설비 체결, 이동식/시스템비계·작업발판 고정, 하부 출입통제 | [ ] 확인 |\n\n' +
        '허가 신청: 현장담당 ○○○ (인)   |   최종 승인: 관리책임자 ' + mgr + ' (인)\n';
    } else if (docCode === 'customer_ergo') {
      body = hdr +
        '1. 고객응대근로자 보호 매뉴얼 (산업안전보건법 제41조)\n' +
        '① 매장·안내데스크·전화 ARS에 폭언·폭행·성희롱 금지 사전 안내문(음성안내) 상시 게시\n' +
        '② 폭언·폭행 발생 시 4단계 대응: (1) 정중한 중단 요청 및 녹음·채증 → (2) 업무 일시 중단 및 대피/전환 → (3) 상급자(책임자) 인계·경찰/보안 신고 → (4) 피해 근로자 유급휴식·심리상담·법률지원\n\n' +
        '2. ' + ind.short + ' 근골격계 부담작업 · 물류 · 매장 안전수칙\n' +
        '| 작업 구분 | 핵심 위험요인 | 의무 준수 수칙 |\n' +
        '| 중량물 인력취급 | 20kg+ 박스 반복 상·하차·적재 요통 | 2인1조 공동취급, 대차·핸드팔레트·리프트 우선 사용, 허리 굽히지 않고 무릎 굽혀 들기 |\n' +
        '| 화물차 상·하차 | 차량 이동 충돌·도크 끼임·적재함 추락 | 바퀴 고임목(전후) 체결 + 시동정지·열쇠 회수 + 적재함 위 뛰어내림 금지 |\n' +
        '| 창고 지게차·랙 | 지게차 사각지대 충돌·랙 파렛트 낙하 | 지게차 전용통로/보행로 분리, 랙 층별 최대적재하중 표시, 반사경·후진경보기 작동 |\n' +
        '| 냉동/냉장 창고 | 내부 문 잠김 사고·저체온증 | 안쪽 비상개문장치·비상경보벨 매일 점검, 방한복 지급·주기적 교대 휴식 |\n' +
        '| 계산대·매장 입식 | 장시간 서서 근무 하지정맥·족저근막 | 의자 비치 및 교대 휴식시간 보장, 피로방지 매트 설치 |\n';
    } else if (docCode === 'emergency_plan') {
      body = hdr +
        '1. 중대산업재해 · 급박한 위험 발생 시 비상조치계획서\n' +
        '| 비상 시나리오 | 즉각 초동 조치 | 구호 · 대피 · 보고 절차 |\n' +
        '| 화재 · 폭발 | 최초 발견자 "불이야" 전파·화재경보기·초기소화 | 방화구획 폐쇄, 유도등 따라 집결지 대피, 119 신고 및 인원점호 |\n' +
        '| 기계 끼임·지게차 깔림 | 즉시 비상정지(E-STOP) · 동력차단 · 작업중지 | 119 구급대 신고(무단 이동 금지), 응급처치, 노동지청 보고 |\n' +
        '| 감전 · 추락 · 냉동창고 갇힘 | 전원 차단 후 절연봉 분리 / 비상경보 가동 | AED·구급함 처치, 협력사·가족·고용노동지청 긴급보고 |\n\n' +
        '2. 비상대응 조직도 및 비상연락망\n' +
        '| 역할 | 담당자 | 임무 | 비상연락망(유관기관) |\n' +
        '| 비상지휘본부장 | ' + ceo + ' | 작업중지 명령, 대내외 총괄 보고 | 고용노동부 중대재해신고: 1544-1120 |\n' +
        '| 현장대응반장 | ' + mgr + ' | 현장 통제·전원차단·인원파악 | 소방·응급구조: 119 / 경찰: 112 |\n' +
        '| 대피·소화반 | 관리감독자 ○○○ | 초기소화, 거동불편·하청인원 유도 | 안전보건공단: 1644-4544 |\n\n' +
        '3. 반기 1회 비상대응 훈련 결과 기록표\n' +
        '| 훈련일시 | ' + ymd + ' | 시나리오 | (화재대피 / 지게차·설비 응급조치) | 참여인원 | ○명 |\n' +
        '| 개선 도출사항 | 비상구 적치물 제거, 경보음 사각지대 보완 등 훈련 후 즉시 개선 기록 |\n';
    } else if (docCode === 'subcontract_eval') {
      body = hdr +
        '1. 적격 수급업체(도급·용역·위탁) 선정 안전보건 수준 평가표 (계약 체결 전 필수)\n' +
        '| 평가 분야 | 세부 평가 항목 | 배점 | 평가점수 | 확인 증빙 |\n' +
        '| ① 안전보건 관리체계 | 방침·전담조직·법정교육 이수 여부 | 20 | | 방침·교육이수증 |\n' +
        '| ② 유해·위험성 관리 | 해당 작업 위험성평가·안전작업절차 보유 | 30 | | 위험성평가표·LOTO |\n' +
        '| ③ 비상대응·보호구 | 비상연락체계, 작업자 KCs 보호구·장비 인증 | 25 | | 보호구대장·장비검사 |\n' +
        '| ④ 최근 재해·행정처분 | 최근 3년 산재 발생, 영업정지·과태료 유무 | 25 | | 산재요양승인율 확인 |\n' +
        '| 합계 (기준: 70점+ B등급 이상 적격 선정) | 총 100점 | /100 | 판정: [ ] 적격  [ ] 보완 |\n\n' +
        '2. 도급인-수급인 합동안전보건 점검 및 협의체 회의록 (산안법 제64조)\n' +
        '| 점검/회의일 | ' + ymd + ' | 도급인 참석 | ' + mgr + ' | 수급인 참석 | ○○○ 소장/기사 |\n' +
        '| 협의·지적 내용 | 혼재작업 신호수 배치, ' + ind.short + ' 반입장비(지게차·사다리) 점검, 보호구 착용 확인 |\n';
    } else if (docCode === 'workstop_release') {
      body = hdr +
        '1. 근로자 작업중지권 발동 및 안전확보 절차 (산안법 제51조·제52조)\n' +
        '① 현장에 급박한 위험(방호장치 고장, 지게차 충돌·전도 위험, 랙 붕괴 우려, 감전·밀폐·개구부 추락 위험 등)이 있으면 작업자 누구나 즉시 작업을 중단하고 안전구역으로 대피한다.\n' +
        '② 관리감독자(' + mgr + ')에게 지체 없이 보고하며, 회사는 정당한 작업중지 행사 근로자에게 해고·징계 등 불리한 처우를 절대 금지한다.\n' +
        '③ 유해·위험요인 완전 개선 및 현장 근로자 참여 재확인 후 경영책임자 승인 하에 작업을 재개한다.\n\n' +
        '2. 관할 고용노동지청 작업중지명령 해제 대응 개선계획 및 심의 제출 서식 (산안법 제55조)\n' +
        '| 구분 | 세부 작성 · 증빙 준비 사항 | 담당 | 준비 상태 |\n' +
        '| ① 명령 개요 | 관할 노동지청, 명령서 번호, 대상 설비·작업범위, 지적된 핵심 위험요인 정리 | ' + mgr + ' | [ ] |\n' +
        '| ② 수시 위험성평가 | 명령 사유 및 동일·유사 공정 전수 재평가 (근로자 2인+ 참여·서명) | 평가팀/' + cons + ' | [ ] |\n' +
        '| ③ 공학적·관리적 개선 | 방호장치 신설, 동선 분리, LOTO, 적재기준, 전·후 비교 사진대지 첨부 | ' + mgr + ' | [ ] |\n' +
        '| ④ 근로자 의견청취 | 작업중지 대상·인근 작업 근로자의 개선상태 확인 및 해제 의견청취 확인서 | 근로자대표 | [ ] |\n' +
        '| ⑤ 특별교육·해제신청 | 재발방지 안전교육 일지/서명부 첨부하여 지방고용노동관서에 해제 신청서 제출 | ' + ceo + '/' + cons + ' | [ ] |\n\n' +
        '3. 작업중지명령 해제 관련 근로자 의견청취 확인서(별지)\n' +
        '위 사업장(' + co + ')의 개선조치 완료 상태를 현장 작업자 대표들이 직접 확인하였으며, 추가 위험요인 해소 여부 및 작업 재개에 대한 의견을 아래와 같이 제출합니다.\n' +
        '- 근로자 의견 요지: (개선조치 적합 / 추가 보완요청 사항 기재)\n' +
        '- 확인일: ' + ymd + '   |   참여 근로자 서명: ○○○ (인), ○○○ (인)\n';
    }

    return {
      code: tpl.code,
      docKind: tpl.docKind,
      title: co + '_' + tpl.short + '(' + yr + ')',
      body: body,
      industryCode: ind.code,
      industryName: ind.name
    };
  }

  /* ══ 5. 샘플 풀 수집 (내장 업종 샘플 + 타 사업장 작성본 + 수집 자료) ═══ */
  function collectSamplePool(docCode, currentPid, projectsMap, checksMap, intakeMap) {
    var tpl = getTemplate(docCode);
    if (!tpl) return [];
    var pool = [];
    var projs = projectsMap || {};
    var checks = checksMap || {};
    var intakes = intakeMap || {};
    var curProj = projs[currentPid] || {};

    function uniqList(arr) {
      var out = [];
      arr.forEach(function (v) {
        var s = str(v);
        if (s && out.indexOf(s) < 0) out.push(s);
      });
      return out;
    }

    /* (1) 타 사업장이 이미 작성·저장한 동일 docCode 또는 동일 docKind 문서 */
    Object.keys(projs).forEach(function (pid) {
      if (pid === currentPid) return;
      var p = projs[pid];
      if (!p || p._deleted) return;
      var box = checks[pid] || {};
      Object.keys(box).forEach(function (ckKey) {
        if (ckKey.indexOf('doc_') !== 0) return;
        var rec = box[ckKey];
        if (!rec || rec._deleted || !str(rec.body)) return;
        if (rec.docCode !== docCode && rec.docKind !== tpl.docKind) return;
        var ind = Cat.getIndustry(p.industryCode);
        var sanitizedProj = maskCrossSamplePii(rec.body);
        var cos = uniqList([rec.companyName, p.companyName]);
        var ceos = uniqList([rec.ceoName, p.ceoName]);
        var bizNos = uniqList([rec.bizNo, p.bizNo]);
        var addrs = uniqList([rec.address, p.address]);
        var consList = uniqList([rec.consultantName, p.consultantName]);
        pool.push({
          id: 'proj:' + pid + ':' + ckKey,
          group: 'project',
          label: '[작성본] ' + str(p.companyName) + ' (' + (p.year || '') + ' · ' + ind.short + ') — ' + str(rec.title || tpl.short),
          sourceCompany: cos[0] || '',
          sourceCompanies: cos,
          sourceCeo: ceos[0] || '',
          sourceCeos: ceos,
          sourceBizNo: bizNos[0] || '',
          sourceBizNos: bizNos,
          sourceAddress: addrs[0] || '',
          sourceAddresses: addrs,
          sourceConsultant: consList[0] || '',
          sourceConsultants: consList,
          sourceYear: num(p.year, 2025),
          sourceIndustry: ind.short,
          piiMaskedCount: sanitizedProj.count,
          hasCrossCompanyNotice: true,
          body: sanitizedProj.text
        });
      });
    });

    /* (2) 타 사업장·동일 사업장 비식별 수집 카드 중 동일 docKind 실무 자료 */
    Object.keys(intakes).forEach(function (pid) {
      var box = intakes[pid] || {};
      var p = projs[pid] || {};
      if (p && p._deleted) return;
      Object.keys(box).forEach(function (cid) {
        var c = box[cid];
        if (!c || c._deleted || c.docKind !== tpl.docKind) return;
        var txt = str(c.maskedExcerpt);
        if (txt.length < 25) return;
        var sanitizedIntake = maskCrossSamplePii(txt);
        var intakeCos = uniqList([c.companyName, p.companyName]);
        var intakeCeos = uniqList([p.ceoName]);
        var intakeAddrs = uniqList([p.address]);
        pool.push({
          id: 'intake:' + pid + ':' + cid,
          group: 'intake',
          label: '[수집자료] ' + str(p.companyName || c.companyName || '참고사업장') + ' — ' + str(c.title || c.docKindName),
          sourceCompany: intakeCos[0] || '',
          sourceCompanies: intakeCos,
          sourceCeo: intakeCeos[0] || '',
          sourceCeos: intakeCeos,
          sourceBizNo: str(p.bizNo),
          sourceBizNos: uniqList([p.bizNo]),
          sourceAddress: intakeAddrs[0] || '',
          sourceAddresses: intakeAddrs,
          sourceConsultant: '',
          sourceConsultants: [],
          sourceYear: num(p.year, 2025),
          sourceIndustry: Cat.getIndustry(p.industryCode).short,
          piiMaskedCount: sanitizedIntake.count,
          hasCrossCompanyNotice: true,
          body: sanitizedIntake.text
        });
      });
    });

    /* (3) 내장 업종별 표준 샘플 (현재 사업장 업종 우선 + 유통/일반제조/고위험제조/복지/건설 비교) */
    var presetInds = [];
    if (curProj.industryCode) presetInds.push(curProj.industryCode);
    ['retail_logis', 'mfg_general', 'mfg_high', 'service_fac', 'medical_welfare', 'const_sub'].forEach(function (ic) {
      if (presetInds.indexOf(ic) < 0) presetInds.push(ic);
    });
    presetInds.forEach(function (ic, idx) {
      var ind = Cat.getIndustry(ic);
      var sampleCorpName = idx === 0 && curProj.companyName
        ? curProj.companyName
        : '㈜표준' + ind.short.replace(/[·/\s]+/g, '') + '샘플';
      var sampleProj = {
        companyName: sampleCorpName,
        industryCode: ic,
        year: 2025,
        workerCount: ic === 'mfg_high' ? 45 : 30,
        ceoName: '(대표자)',
        bizNo: '(사업자번호 입력)',
        address: '충남 서산시 ○○로 123',
        consultantName: '푸른노무법인 전담 공인노무사'
      };
      var generated = buildTemplateDraft(docCode, sampleProj, { presetIndustryCode: ic, year: 2025 });
      pool.push({
        id: 'builtin:' + ic,
        group: 'builtin',
        label: '[표준샘플 · ' + ind.short + '] ' + tpl.short + (idx === 0 ? ' (현재 업종 맞춤)' : ' (' + ind.name + ' 기준)'),
        sourceCompany: sampleCorpName,
        sourceCeo: '(대표자)',
        sourceBizNo: '(사업자번호 입력)',
        sourceAddress: '충남 서산시 ○○로 123',
        sourceYear: 2025,
        sourceIndustry: ind.short,
        body: generated.body
      });
    });

    return pool;
  }

  /* ══ 6. 기존 샘플 → 신규/타겟 사업장 자동 치환 엔진 ═════════════════════ */
  function buildCorpVariants(rawName) {
    var s = str(rawName);
    if (!s) return [];
    var core = coreCorpName(s);
    var list = [s];
    if (core && core.length >= 2) {
      ['주식회사 ' + core, '주식회사' + core, '㈜' + core, '(주)' + core, core + '㈜', core + '(주)', core].forEach(function (v) {
        if (list.indexOf(v) < 0) list.push(v);
      });
    }
    return list.sort(function (a, b) { return b.length - a.length; });
  }

  function replaceAllLiteral(text, needle, replacement) {
    if (!needle || needle === replacement) return { text: text, count: 0 };
    var re = new RegExp(escapeRe(needle), 'g');
    var hits = 0;
    var out = text.replace(re, function () {
      hits++;
      return replacement;
    });
    return { text: out, count: hits };
  }

  function adaptSampleText(rawText, opts) {
    var o = opts || {};
    var text = String(rawText == null ? '' : rawText);
    var totalReplacements = 0;
    var changes = [];

    /* 1. 상호명 변형(주식회사/(주)/㈜ 포함, 사업장·서류 레코드 양쪽) 단일 패스 치환으로 이중 중첩 치환 방지 */
    var dstCo = str(o.targetCompany);
    var srcCos = [];
    (Array.isArray(o.sourceCompanies) ? o.sourceCompanies : []).concat([o.sourceCompany]).forEach(function (c) {
      var s = str(c);
      if (s && srcCos.indexOf(s) < 0) srcCos.push(s);
    });
    var coVariants = [];
    srcCos.forEach(function (sc) {
      if (!dstCo || coreCorpName(sc) === coreCorpName(dstCo)) return;
      buildCorpVariants(sc).forEach(function (v) {
        if (coVariants.indexOf(v) < 0) coVariants.push(v);
      });
    });
    if (coVariants.length && dstCo) {
      coVariants.sort(function (a, b) { return b.length - a.length; });
      var altRe = new RegExp(coVariants.map(escapeRe).join('|'), 'g');
      var coHits = 0;
      text = text.replace(altRe, function () {
        coHits++;
        return dstCo;
      });
      if (coHits > 0) {
        totalReplacements += coHits;
        changes.push({ from: srcCos[0], to: dstCo, count: coHits });
      }
    }

    /* 2. 대표자 / 사업자번호 / 소재지 / 담당자 치환 (타겟 공란 시 타 사업장 원본 비식별 자리표시자로 대체) */
    var maskMissing = !!o.maskMissingTargetMeta;
    var metaSpecs = [
      { sources: (Array.isArray(o.sourceCeos) ? o.sourceCeos : []).concat([o.sourceCeo]), target: str(o.targetCeo), fallback: '대표이사 ○○○', skip: ['(대표자)', '대표이사 ○○○'] },
      { sources: (Array.isArray(o.sourceBizNos) ? o.sourceBizNos : []).concat([o.sourceBizNo]), target: str(o.targetBizNo), fallback: '(사업자번호 입력)', skip: ['(사업자번호 입력)', '000-00-00000'] },
      { sources: (Array.isArray(o.sourceAddresses) ? o.sourceAddresses : []).concat([o.sourceAddress]), target: str(o.targetAddress), fallback: '(사업장 소재지 입력)', skip: ['(사업장 소재지 입력)', '충남 서산시 ○○로 123'] },
      { sources: (Array.isArray(o.sourceConsultants) ? o.sourceConsultants : []).concat([o.sourceConsultant]), target: str(o.targetConsultant), fallback: '푸른노무법인 전담 공인노무사', skip: ['푸른노무법인 전담 공인노무사'] }
    ];
    metaSpecs.forEach(function (spec) {
      var uniqueSrcs = [];
      spec.sources.forEach(function (v) {
        var s = str(v);
        if (s && uniqueSrcs.indexOf(s) < 0) uniqueSrcs.push(s);
      });
      uniqueSrcs.sort(function (a, b) { return b.length - a.length; });
      uniqueSrcs.forEach(function (srcVal) {
        var dstVal = spec.target || (maskMissing && spec.skip.indexOf(srcVal) < 0 ? spec.fallback : '');
        if (!dstVal || srcVal === dstVal) return;
        var r = replaceAllLiteral(text, srcVal, dstVal);
        if (r.count > 0) {
          text = r.text;
          totalReplacements += r.count;
          changes.push({ from: srcVal, to: dstVal, count: r.count });
        }
      });
    });

    /* 3. 연도 치환 (예: 2024 -> 2026) */
    var sy = num(o.sourceYear, 0);
    var ty = num(o.targetYear, 0);
    if (o.replaceYear !== false && sy >= 2015 && sy <= 2035 && ty >= 2015 && ty <= 2035 && sy !== ty) {
      var yrRe = new RegExp('(?<!\\d)' + sy + '(?=년|[.\\-/\\s\\)]|$)', 'g');
      var yrHits = 0;
      text = text.replace(yrRe, function () {
        yrHits++;
        return String(ty);
      });
      if (yrHits > 0) {
        totalReplacements += yrHits;
        changes.push({ from: sy + '년', to: ty + '년', count: yrHits });
      }
    }

    /* 4. 사용자 지정 치환 쌍 ('원본 -> 바꿀말' 줄바꿈·쉼표·세미콜론 목록 또는 배열) */
    var customList = Array.isArray(o.customPairs)
      ? o.customPairs
      : String(o.customPairs || '').split(/\r?\n|[;,]/).map(function (line) {
          var m = line.split(/\s*(?:->|=>|→)\s*/);
          return m.length >= 2 ? { from: str(m[0]), to: str(m.slice(1).join('→')) } : null;
        }).filter(Boolean);
    customList.forEach(function (cp) {
      var f = str(cp && cp.from), t = cp && cp.to != null ? String(cp.to).trim() : '';
      if (!f || f === t) return;
      var r = replaceAllLiteral(text, f, t);
      if (r.count > 0) {
        text = r.text;
        totalReplacements += r.count;
        changes.push({ from: f, to: t, count: r.count });
      }
    });

    return {
      text: text,
      totalReplacements: totalReplacements,
      changes: changes
    };
  }

  /* ══ 7. 서류 보유·작성 진행률 집계 ══════════════════════════════════════ */
  function computeDocsSummary(project, docsMap) {
    var dmap = docsMap && typeof docsMap === 'object' ? docsMap : {};
    var total = DOC_TEMPLATES.length;
    var applicableTotal = 0;
    var requiredTotal = 0;
    var doneCount = 0;
    var draftCount = 0;
    var todoCount = 0;
    var naCount = 0;
    var urgentTodoCount = 0;

    DOC_TEMPLATES.forEach(function (tpl) {
      var rec = dmap[tpl.code] || null;
      var req = evalDocRequirement(tpl, project);
      var st = rec ? str(rec.status) : 'todo';
      var isNa = (rec && (rec.applicable === 'na' || st === 'na'));
      if (isNa) {
        naCount++;
        return;
      }
      applicableTotal++;
      if (req.level === 'urgent' || req.level === 'required' || req.level === 'industry_req') {
        requiredTotal++;
      }
      if (st === 'done') doneCount++;
      else if (st === 'draft' || st === 'review') draftCount++;
      else {
        todoCount++;
        if (req.level === 'urgent') urgentTodoCount++;
      }
    });

    var pct = applicableTotal ? Math.round((doneCount / applicableTotal) * 100) : 0;
    return {
      total: total,
      applicableTotal: applicableTotal,
      requiredTotal: requiredTotal,
      doneCount: doneCount,
      draftCount: draftCount,
      todoCount: todoCount,
      naCount: naCount,
      urgentTodoCount: urgentTodoCount,
      pct: pct
    };
  }

  function findCrossCompanyResidue(rawText, guard) {
    var g = guard && typeof guard === 'object' ? guard : null;
    if (!g) return { found: [] };
    var hay = String(rawText == null ? '' : rawText);
    var found = [];
    var dstCore = coreCorpName(g.targetCompany || '');
    var dstCeo = str(g.targetCeo || '');
    var srcCos = Array.isArray(g.sourceCompanies) ? g.sourceCompanies : (g.sourceCompany ? [g.sourceCompany] : []);
    srcCos.forEach(function (c) {
      var core = coreCorpName(c);
      if (!core || core.length < 2 || core === dstCore) return;
      if (hay.indexOf(core) >= 0 && found.indexOf(core) < 0) found.push(core);
    });
    var srcCeos = Array.isArray(g.sourceCeos) ? g.sourceCeos : (g.sourceCeo ? [g.sourceCeo] : []);
    srcCeos.forEach(function (nm) {
      var n = str(nm);
      if (!n || n.length < 2 || n === '(대표자)' || n === '대표이사 ○○○' || n === dstCeo) return;
      if (hay.indexOf(n) >= 0 && found.indexOf(n) < 0) found.push(n);
    });
    return { found: found };
  }

  return {
    ONBOARDING_STEPS: ONBOARDING_STEPS,
    DOC_CATEGORIES: DOC_CATEGORIES,
    DOC_TEMPLATES: DOC_TEMPLATES,
    getTemplate: getTemplate,
    hasWorkstopContext: hasWorkstopContext,
    evalDocRequirement: evalDocRequirement,
    buildTemplateDraft: buildTemplateDraft,
    collectSamplePool: collectSamplePool,
    adaptSampleText: adaptSampleText,
    findCrossCompanyResidue: findCrossCompanyResidue,
    computeDocsSummary: computeDocsSummary
  };
});
