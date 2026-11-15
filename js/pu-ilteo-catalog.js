/* 푸른통합시스템 — 일터혁신 상생컨설팅(일터상생혁신) 도메인 카탈로그 및 기준 사전
 * (브라우저 window.PuIlteoCatalog / Node module.exports 겸용)
 *
 * 맡는 일:
 *   1. 노사발전재단 2026년 일터혁신 상생컨설팅 9대 분야 · 19개 공식 개선과제 사전 정의
 *   2. 6단계 수행 생애주기 및 재단 필수 인정 기준(디자인팀·사전설문·회차수행·활동비) 상수 정의
 *   3. 수신·첨부 서류 12종 분류 체계 및 선택 과제별 착수 기초자료(pre_mid)·중간보고 이후 후속자료(post_mid) 체크리스트 도출
 *   4. 전직원 조직진단(EOS) 5대 대영역 · 16개 세부영역 표준 기준표 및 업종별 준거집단 평균치 제공
 *   5. 중간보고서 · 최종보고서(결과보고) · 플랫폼 입력 문안 3종의 표준 목차 스키마 정의
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PuIlteoCatalog = api;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this), function () {
  'use strict';

  /* 컨설팅 수준 구분 */
  var LEVELS = {
    basic: { code: 'basic', name: '기초컨설팅', short: '기초', eosMinPct: 70, minTasks: 1, maxTasks: 2, defaultWeeks: 5 },
    pro:   { code: 'pro',   name: '전문컨설팅', short: '전문', eosMinPct: 70, minTasks: 2, maxTasks: 5, defaultWeeks: 10 },
    deep:  { code: 'deep',  name: '심화컨설팅', short: '심화', eosMinPct: 50, minTasks: 2, maxTasks: 5, defaultWeeks: 15 },
    spec:  { code: 'spec',  name: '특화컨설팅', short: '특화', eosMinPct: 50, minTasks: 3, maxTasks: 5, defaultWeeks: 15 }
  };

  /* 재단 필수 운영·인정 기준 */
  var CRITERIA = {
    designTeamMin: 4,            // 일터혁신 디자인팀 최소 인원(노·사 균형 편성)
    kickoffDaysLimit: 14,        // 착수 후 2주 이내 디자인팀 등록 및 협약 체결
    roundMinMins: 120,           // 회차별 회의 최소 120분(2시간) 이상
    roundMinCompanyPeople: 3,    // 회차별 기업 측 참석자 최소 3인 이상
    facePctMin: 70,              // 전체 수행 회차 중 대면 비율 70% 이상
    activityGrantMaxWorkers: 99, // 상시근로자 100인 미만 기업 활동비 지원 대상
    activityGrantWon: 1200000,   // 일터혁신 활동비 지원 한도(120만원)
    followUpMonths: 3,           // 종료 후 이행지원 기간(3개월)
    followUpVisits: 2            // 이행지원 점검 횟수(2회)
  };

  /* 6단계 표준 수행 생애주기 */
  var STAGES = [
    { code: 'kickoff',  order: 1, name: '착수·기초자료 수집',   short: '착수·기초수집', phase: 'pre_mid',  desc: '참여안내서·협약, 디자인팀 등록(4인+), 기초자료 메일 수신' },
    { code: 'diag',     order: 2, name: '현황진단·설문·인터뷰', short: '현황진단',      phase: 'pre_mid',  desc: '규정·근태·임금 교차분석, 전직원 EOS 설문, 계층별 인터뷰' },
    { code: 'mid_rpt',  order: 3, name: '중간보고·기준선 확정', short: '중간보고',      phase: 'pre_mid',  desc: '통합진단·이슈·추진방향 중간보고서(PPT) 발표 및 기준선 확정' },
    { code: 'design',   order: 4, name: '제도설계·후속메일 협의', short: '후속협의·설계', phase: 'post_mid', desc: '디자인팀 피드백 메일 반영, 임금·근로시간 시뮬레이션, 근로자 의견수렴·투표' },
    { code: 'final_rpt', order: 5, name: '최종 결과보고·제출',  short: '결과보고',      phase: 'post_mid', desc: '최종보고서(PPT)·신구대조표 완성, 플랫폼 수행보고·최종평가·활동비 정산' },
    { code: 'followup', order: 6, name: '이행지원·사후관리',   short: '이행관리',      phase: 'post_mid', desc: '종료 후 3개월간 제도 안착 점검(2회), 이행관리 등록·이행결과표 제출' }
  ];

  /* 9대 컨설팅 분야 */
  var DOMAINS = [
    { code: 'worktime', name: '근로시간',           icon: '⏰', defaultDocs: ['work_rules', 'labor_contract', 'time_leave', 'wage_ledger'] },
    { code: 'wage',     name: '임금체계',           icon: '💰', defaultDocs: ['work_rules', 'labor_contract', 'wage_ledger', 'org_roster'] },
    { code: 'coop',     name: '근로자 참여 및 협력', icon: '🤝', defaultDocs: ['lmanagement', 'org_roster', 'eos_survey'] },
    { code: 'culture',  name: '직장문화',           icon: '🌱', defaultDocs: ['work_rules', 'time_leave', 'eos_survey'] },
    { code: 'skill',    name: '직무역량',           icon: '📚', defaultDocs: ['org_roster', 'work_rules', 'eos_survey'] },
    { code: 'job',      name: '직무체계',           icon: '🧩', defaultDocs: ['org_roster', 'work_rules'] },
    { code: 'eval',     name: '평가체계',           icon: '📊', defaultDocs: ['org_roster', 'work_rules', 'wage_ledger'] },
    { code: 'hire',     name: '공정채용',           icon: '🔎', defaultDocs: ['org_roster', 'work_rules', 'labor_contract'] },
    { code: 'senior',   name: '장년친화',           icon: '🌳', defaultDocs: ['org_roster', 'work_rules', 'wage_ledger'] }
  ];

  /* 노사발전재단 2026년 공식 19개 개선과제 카탈로그 */
  var TASKS = [
    {
      code: 'wt_mgmt', domain: 'worktime', name: '근로시간 관리방안 마련', levels: ['pro'],
      summary: '출퇴근 기록 실효성 확보, 연장·야간·휴일근로 사전승인제 및 연차휴가 활성화 기준 정립',
      lawPoints: ['근로기준법 제50조(근로시간)·제53조(연장근로의 제한)', '근로기준법 제60조·제61조(연차유급휴가 및 사용촉진)'],
      govAid: ['워라밸일자리 장려금(소정근로시간 단축)', '유연근무 장려금']
    },
    {
      code: 'wt_shift', domain: 'worktime', name: '근무체계 개편(일가정양립 포함)', levels: ['deep'],
      summary: '교대제·변형근로 개편, 시차출퇴근·선택적 근로시간제·탄력적 근로시간제 도입 및 일가정양립 근무체계 구축',
      lawPoints: ['근로기준법 제51조·제51조의2(탄력적 근로시간제)', '근로기준법 제52조(선택적 근로시간제 근로자대표 서면합의)'],
      govAid: ['유연근무 장려금(시차·선택·재택·원격근무)', '일·가정양립 환경개선 시스템 구축비']
    },
    {
      code: 'wt_45day', domain: 'worktime', name: '주4.5일제 도입(근로시간 단축)', levels: ['deep', 'spec'],
      summary: '임금 감소 없는 주 소정근로시간 단축(예: 주40h→36h/35h, 격주·매주 금요일 반일·조기퇴근) 모델 설계 및 업무집중도 향상',
      lawPoints: ['근로기준법 제50조·제94조(소정근로시간 단축에 따른 취업규칙 변경 및 임금보전 원칙)', '월 통상임금 산정기준시간(209h→191h/188h) 재산정'],
      govAid: ['주4.5일제 도입 시범사업 장려금', '워라밸일자리 장려금']
    },
    {
      code: 'wg_mgmt', domain: 'wage', name: '임금관리체계 개선', levels: ['pro'],
      summary: '임금구성항목 단순화·명확화, 통상임금 산입범위 적법화 및 임금명세서 교부 기준 정비',
      lawPoints: ['근로기준법 제43조(임금지급 4대 원칙)·제48조 제2항(임금명세서 필수 기재사항)', '대법원 전원합의체 통상임금 고정성 폐지 판례 반영'],
      govAid: ['정규직 전환 지원금(임금체계 개편 연계)']
    },
    {
      code: 'wg_inclusive', domain: 'wage', name: '포괄임금제 개선', levels: ['pro', 'spec'],
      summary: '고정연장·야간·휴일수당(포괄임금) 약정 해체 또는 실근로시간 기반 정산체계 전환 및 기본급·직무수당 재편',
      lawPoints: ['근로기준법 제56조(연장·야간 및 휴일근로 가산수당 실근로 정산)', '고정OT 축소·기본급 전환 시 통상시급 변동 시뮬레이션'],
      govAid: ['일터혁신 연계 근로시간 단축 장려금']
    },
    {
      code: 'wg_redesign', domain: 'wage', name: '임금체계 재설계', levels: ['deep'],
      summary: '직무·역량·성과 가치를 반영한 기본급 테이블(호봉·직능·직무급·밴드형) 재설계 및 수당체계 합리화',
      lawPoints: ['근로기준법 제94조 제1항 단서(불이익 변경 여부 판단 및 근로자 과반수 동의 절차)', '동일가치노동 동일임금 취지 반영'],
      govAid: ['직무·성과 중심 임금체계 개편 정부포상·우대']
    },
    {
      code: 'cp_council', domain: 'coop', name: '노사협의회 활성화', levels: ['pro'],
      summary: '근로자참여법상 노사협의회 규정 정비, 근로자위원 민주적 선출절차 확립 및 분기별 정기회의 의제 운영 고도화',
      lawPoints: ['근로자참여 및 협력증진에 관한 법률 제4조(30인 이상 설치 의무)·제12조(분기 정기회의)·제20조·제21조(협의·의결사항)'],
      govAid: ['노사파트너십 프로그램 지원사업']
    },
    {
      code: 'cp_partner', domain: 'coop', name: '노사파트너십 증진', levels: ['deep', 'spec'],
      summary: '고충처리위원회 실효화, 노사 공동 일터혁신 위원회 상설화 및 다채널 소통·갈등예방 프로세스 구축',
      lawPoints: ['근로자참여법 제26조(고충처리위원 배치 및 10일 이내 처리 통보 의무)'],
      govAid: ['노사파트너십 프로그램 지원사업', '노사문화 우수기업 인증 연계']
    },
    {
      code: 'cp_innov', domain: 'coop', name: '참여적 혁신 활동', levels: ['deep'],
      summary: '현장 근로자 주도형 제안제도, 소집단 개선활동(분임조) 및 생산성·안전 공동개선 보상체계 설계',
      lawPoints: ['근로자참여법 제20조 제1항(생산성 향상과 성과 배분 협의)'],
      govAid: ['스마트공장·일터혁신 연계 지원사업']
    },
    {
      code: 'cu_balance', domain: 'culture', name: '일가정양립 프로그램 설계 및 운영', levels: ['pro'],
      summary: '모성보호·육아지원 14대 법정 제도 최신 개정법 반영, 자동육아휴직·육아기 단축근무 업무대행 체계 구축',
      lawPoints: ['남녀고용평등법 제19조(육아휴직)·제19조의2(육아기 근로시간 단축)·제22조의2(가족돌봄휴직·휴가)'],
      govAid: ['출산육아기 고용안정장려금(육아휴직·육아기 단축·대체인력·업무분담 지원금)']
    },
    {
      code: 'cu_protect', domain: 'culture', name: '근로자 보호 체계 구축', levels: ['pro'],
      summary: '직장 내 괴롭힘·성희롱 예방·조사·피해자보호 매뉴얼 정립 및 감정노동·직무스트레스 건강보호 체계 구축',
      lawPoints: ['근로기준법 제76조의2·제76조의3(직장 내 괴롭힘 금지 및 조사·비밀유지 의무)', '남녀고용평등법 제12조~제14조', '산업안전보건법 제41조(고객응대근로자 보호)'],
      govAid: ['근로자지원프로그램(EAP) 지원', '안전보건관리체계 구축 컨설팅 연계']
    },
    {
      code: 'sk_std', domain: 'skill', name: '학습체계 기준 수립', levels: ['pro'],
      summary: '직급·직무별 필수 교육훈련 기준 수립, 신입 근로자 온보딩(OJT) 가이드 및 사내 학습시간 인정 기준 마련',
      lawPoints: ['근로자직업능력 개발법(사업주 직업능력개발훈련 기준)'],
      govAid: ['사업주 직업능력개발훈련 지원금', '체계적 현장훈련(S-OJT) 지원']
    },
    {
      code: 'sk_design', domain: 'skill', name: '학습체계 설계', levels: ['deep'],
      summary: '직무역량 모델링 기반 경력개발경로(CDP)·연간 교육훈련 로드맵 설계 및 사내강사·멘토링 보상제도 구축',
      lawPoints: ['근로자직업능력 개발법 및 직무역량 평가·인정 규정'],
      govAid: ['체계적 현장훈련(S-OJT)', '일학습병행제 연계']
    },
    {
      code: 'jb_analysis', domain: 'job', name: '직무조사 및 분석', levels: ['deep'],
      summary: '전 부서 직무조사표 배포·검증, 직무분류체계 수립 및 표준 직무기술서·직무명세서(JD/JS) 편람 완성',
      lawPoints: ['근로기준법 제17조(담당 업무의 명시) 및 인사규정 직무분류 근거'],
      govAid: ['능력중심 인적자원관리(NCS 기업활용 컨설팅) 연계']
    },
    {
      code: 'jb_redesign', domain: 'job', name: '직무 재설계 및 업무기능 개선', levels: ['deep'],
      summary: '부서 간 R&R 중복·사각지대 해소, 핵심·비핵심 업무 재분배 및 업무 프로세스 간소화를 통한 장시간 근로 원천 감축',
      lawPoints: ['전직·배치전환의 정당성 기준 및 업무분장 규정 정비'],
      govAid: ['일터혁신 근로시간 단축·스마트업무환경 지원 연계']
    },
    {
      code: 'ev_design', domain: 'eval', name: '평가체계 설계 및 조직관리', levels: ['deep'],
      summary: '업적평가(KPI/MBO) 및 역량평가 지표 설계, 다면피드백·이의신청 절차 도입 및 평가결과의 보상·육성 환류 체계화',
      lawPoints: ['인사평가 공정성·객관성 확보 기준(이의신청권·평가면담 기록화)'],
      govAid: ['노사파트너십·성과공유제 도입 기업 지원']
    },
    {
      code: 'hr_diag', domain: 'hire', name: '채용제도 진단 및 개선', levels: ['pro'],
      summary: '채용공고·입사지원서 편견요소 점검(채용절차법 준수), 수습·시용 평가기준 명확화 및 조기이탈 방지 온보딩 개선',
      lawPoints: ['채용절차의 공정화에 관한 법률 제4조의3(출신지역·혼인·재산·직계존비속 정보 요구 금지)·제11조(채용서류 반환)'],
      govAid: ['청년일자리 도약장려금', '공정채용 우수기업 지원']
    },
    {
      code: 'hr_design', domain: 'hire', name: '채용제도 설계 및 운영지원', levels: ['deep'],
      summary: '직무역량 기반 구조화 면접 도구·평정표 개발, 면접관 교육 가이드 및 채용~수습~정규전환 전 과정 표준화',
      lawPoints: ['채용절차법 전 조항 및 남녀고용평등법 제7조(모집과 채용의 성차별 금지)'],
      govAid: ['청년일자리 도약장려금', '고용촉진장려금']
    },
    {
      code: 'sn_hr', domain: 'senior', name: '장년친화 인사 제도', levels: ['deep'],
      summary: '정년 도래·고령 근로자 계속고용제도(재고용·정년연장·정년폐지) 설계, 숙련기술 전수제 및 장년 적합직무 개발',
      lawPoints: ['고령자고용법 제19조(정년 60세 이상)·제19조의2(임금피크제·계속고용 절차 및 근로자 과반수 동의)'],
      govAid: ['고령자 계속고용장려금(분기당 90만원, 최대 3년)', '고령자 고용지원금']
    }
  ];

  /* 수신·첨부 서류 12종 분류 체계
   * - track: 'quant'(브라우저 로컬 비식별 통계 전용 — AI·서버 원본 전송 절대 금지) | 'text'(2중 마스킹 후 쟁점·합의 추출) | 'meta'(회차·서명 상태 확인)
   * - defaultPhase: 'pre_mid'(착수~중간보고 기초자료) | 'post_mid'(중간보고 이후 후속·결과보고 자료)
   */
  var DOC_KINDS = [
    {
      code: 'guide_agree', name: '참여안내서·협약·디자인팀 명단', short: '협약·디자인팀',
      defaultPhase: 'pre_mid', track: 'meta', govStepKey: 'guide',
      keywords: ['참여안내서', '참여 안내서', '협약서', '3자협약', '디자인팀', '추진팀', '위촉', '착수동의']
    },
    {
      code: 'org_roster', name: '조직도·인력현황·3개년 입퇴사', short: '조직·인력현황',
      defaultPhase: 'pre_mid', track: 'quant', govStepKey: '',
      keywords: ['조직도', '인력현황', '인원현황', '사원명부', '근로자명부', '입퇴사', '입사퇴사', '재직자', '정원현황']
    },
    {
      code: 'work_rules', name: '취업규칙·인사임금규정', short: '취업규칙·제규정',
      defaultPhase: 'pre_mid', track: 'text', govStepKey: '',
      keywords: ['취업규칙', '인사규정', '복무규정', '급여규정', '임금규정', '보수규정', '연봉규정', '사규', '내규']
    },
    {
      code: 'labor_contract', name: '근로계약서·연봉계약서 서식', short: '근로계약서',
      defaultPhase: 'pre_mid', track: 'text', govStepKey: '',
      keywords: ['근로계약서', '연봉계약서', '표준근로계약', '계약직계약서', '촉탁계약서']
    },
    {
      code: 'wage_ledger', name: '임금대장·수당산정표(비식별 통계)', short: '임금대장·수당',
      defaultPhase: 'pre_mid', track: 'quant', govStepKey: '',
      keywords: ['임금대장', '급여대장', '급여명세', '임금명세', '수당산정', '연봉테이블', '호봉표', '통상임금', '포괄임금', '시뮬레이션', '모의계산']
    },
    {
      code: 'time_leave', name: '출퇴근·근태기록·연차대장(비식별 통계)', short: '근태·연차기록',
      defaultPhase: 'pre_mid', track: 'quant', govStepKey: '',
      keywords: ['출퇴근', '근태', '연장근로', '초과근무', '교대근무', '근무일정', '근무표', '연차대장', '연차현황', '휴가사용']
    },
    {
      code: 'lmanagement', name: '노사협의회 규정·회의록·단체협약', short: '노사협의회·단협',
      defaultPhase: 'pre_mid', track: 'text', govStepKey: '',
      keywords: ['노사협의회', '협의회규정', '정기회의', '근로자위원', '고충처리', '단체협약', '노사합의']
    },
    {
      code: 'eos_survey', name: '전직원 조직진단(EOS) 설문 결과', short: 'EOS 설문결과',
      defaultPhase: 'pre_mid', track: 'quant', govStepKey: '',
      keywords: ['설문', '조직진단', 'eos', '응답률', '인식조사', '만족도조사', '사전설문']
    },
    {
      code: 'round_proof', name: '회차 수행 사진(타임스탬프)·서명지', short: '회차사진·서명지',
      defaultPhase: 'post_mid', track: 'meta', govStepKey: 'round',
      keywords: ['타임스탬프', '시작사진', '종료사진', '서명지', '참석자서명', '참석명단', '수행사진', '회의사진']
    },
    {
      code: 'design_feedback', name: '중간보고 피드백·디자인팀 협의록·보완안', short: '피드백·협의회신',
      defaultPhase: 'post_mid', track: 'text', govStepKey: 'mid',
      keywords: ['피드백', '검토의견', '수정의견', '보완요청', '보완자료', '협의결과', '디자인팀회의', '회의록', '중간보고검토', '최종안검토', '개선안']
    },
    {
      code: 'worker_consent', name: '근로자 의견수렴·시범운영·찬반투표·동의서', short: '찬반투표·동의서',
      defaultPhase: 'post_mid', track: 'text', govStepKey: 'final',
      keywords: ['의견수렴', '찬반투표', '과반수동의', '동의서', '근로자대표', '서면합의', '설명회', '시범운영', '시범작성', '신구대조표']
    },
    {
      code: 'settle_eval', name: '최종평가·활동비 정산·이행결과 증빙', short: '정산·이행증빙',
      defaultPhase: 'post_mid', track: 'meta', govStepKey: 'follow',
      keywords: ['활동비', '정산', '영수증', '지출증빙', '최종평가', '사후교육', '아카데미', '이행결과', '이행관리', '신고접수증']
    }
  ];

  /* 전직원 조직진단(EOS) 5대 대영역 · 16개 세부영역 표준 기준표 (5점 만점 기준 업종 평균 준거치 포함) */
  var EOS_AREAS = [
    {
      code: 'leadership', name: '리더십 및 전략공유', bench: 3.65,
      items: [
        { code: 'eos_01', name: '경영비전 및 목표 공유', bench: 3.62 },
        { code: 'eos_02', name: '부서장 소통 및 코칭 리더십', bench: 3.70 },
        { code: 'eos_03', name: '변화·혁신 추진 의지', bench: 3.63 }
      ]
    },
    {
      code: 'worktime_env', name: '근로시간 및 일가정양립', bench: 3.55,
      items: [
        { code: 'eos_04', name: '근로시간 적정성 및 정시퇴근 문화', bench: 3.48 },
        { code: 'eos_05', name: '연차휴가 및 유연근무 활용 자유도', bench: 3.60 },
        { code: 'eos_06', name: '일·가정양립 및 모성보호 지원', bench: 3.57 }
      ]
    },
    {
      code: 'job_eval', name: '직무·역량 및 평가공정성', bench: 3.50,
      items: [
        { code: 'eos_07', name: '업무분장(R&R) 명확성 및 효율성', bench: 3.52 },
        { code: 'eos_08', name: '교육훈련 및 직무역량 개발 지원', bench: 3.46 },
        { code: 'eos_09', name: '인사평가 기준 공정성 및 피드백 수용성', bench: 3.42 },
        { code: 'eos_10', name: '채용·배치·승진 기회의 공정성', bench: 3.60 }
      ]
    },
    {
      code: 'wage_reward', name: '임금·보상 및 복리후생', bench: 3.38,
      items: [
        { code: 'eos_11', name: '담당 직무·성과 대비 임금 공정성', bench: 3.32 },
        { code: 'eos_12', name: '임금 산정방식(수당·명세) 투명성', bench: 3.48 },
        { code: 'eos_13', name: '복리후생 및 장기근속 지원 만족도', bench: 3.34 }
      ]
    },
    {
      code: 'coop_culture', name: '노사소통 및 조직몰입', bench: 3.62,
      items: [
        { code: 'eos_14', name: '노사협의회·고충처리 의견반영 수준', bench: 3.54 },
        { code: 'eos_15', name: '상호존중 문화 및 괴롭힘 예방 신뢰도', bench: 3.72 },
        { code: 'eos_16', name: '조직몰입도 및 재직 지속 의향', bench: 3.60 }
      ]
    }
  ];

  /* 중간보고서 표준 섹션 스키마 */
  var MID_SECTIONS = [
    { key: 'overview',      part: 'Ⅰ. 프로젝트 개요',   title: '1. 추진 배경·목적 및 수행체계·디자인팀 편성' },
    { key: 'schedule',      part: 'Ⅰ. 프로젝트 개요',   title: '2. 전체 추진일정 및 회차별 수행경과' },
    { key: 'company_stat',  part: 'Ⅱ-1. 기업 현황',     title: '3. 기업 일반현황 및 인력구조·3개년 입퇴사 분석' },
    { key: 'policy_issues', part: 'Ⅱ-2. 주요 이슈 도출', title: '4. 제도·규정 및 근태·임금 데이터 교차진단 이슈' },
    { key: 'interviews',    part: 'Ⅱ-2. 주요 이슈 도출', title: '5. 계층별(경영진·인사·근로자) 인터뷰 진단 결과' },
    { key: 'eos_diag',      part: 'Ⅱ-2. 주요 이슈 도출', title: '6. 전직원 조직진단(EOS) 설문 분석 및 준거집단 격차' },
    { key: 'direction',     part: 'Ⅱ-3. 추진 방향',     title: '7. 선택 개선과제별 추진목표·설계방향 및 기대효과' }
  ];

  /* 최종보고서(결과보고) 표준 섹션 스키마 */
  var FINAL_SECTIONS = [
    { key: 'exec_summary',  part: 'Ⅰ. 컨설팅 종합 요약', title: '1. 수행 개요·추진 경과 및 핵심 성과 요약' },
    { key: 'diag_recap',    part: 'Ⅱ. 현황진단 기준선', title: '2. 중간보고 진단 기준선 및 핵심 개선과제 연결' },
    { key: 'task_designs',  part: 'Ⅲ. 과제별 제도설계', title: '3. 개선과제별 협의 경과(메일 피드백 반영) 및 최종 설계안' },
    { key: 'simulation',    part: 'Ⅲ. 과제별 제도설계', title: '4. 근로시간·임금 모의계산(시뮬레이션) 및 적법성 검토' },
    { key: 'consent_rule',  part: 'Ⅲ. 과제별 제도설계', title: '5. 근로자 의견수렴·찬반투표 결과 및 규정 신구대조 핵심' },
    { key: 'roadmap',       part: 'Ⅳ. 이행 로드맵',     title: '6. 단·중·장기 이행 로드맵 및 향후 3개월 실행계획' },
    { key: 'gov_support',   part: 'Ⅳ. 이행 로드맵',     title: '7. 연계 정부지원사업 검토 및 이행 리스크 관리방안' }
  ];

  var taskByCode = {};
  TASKS.forEach(function (t) { taskByCode[t.code] = t; });
  var domainByCode = {};
  DOMAINS.forEach(function (d) { domainByCode[d.code] = d; });
  var docKindByCode = {};
  DOC_KINDS.forEach(function (k) { docKindByCode[k.code] = k; });

  function getTask(code) { return taskByCode[String(code || '')] || null; }
  function getDomain(code) { return domainByCode[String(code || '')] || null; }
  function getDocKind(code) { return docKindByCode[String(code || '')] || null; }
  function getLevel(code) { return LEVELS[String(code || '')] || LEVELS.deep; }

  /* 선택한 개선과제 목록에 맞춰 필수 수신 체크리스트를 도출한다.
   * phase: 'pre_mid'(착수~중간보고 기초자료) | 'post_mid'(중간보고 이후 후속·결과보고 자료)
   */
  function checklistFor(phase, selectedTaskCodes) {
    var codes = Array.isArray(selectedTaskCodes) && selectedTaskCodes.length
      ? selectedTaskCodes
      : ['wt_45day', 'wg_redesign'];
    if (phase === 'post_mid') {
      var postList = [
        { docKind: 'design_feedback', required: true, reason: '중간보고 이후 디자인팀 검토의견·수정요청 메일 확인' },
        { docKind: 'round_proof',     required: true, reason: '회차별 시작·종료 타임스탬프 사진 2장 및 참석자 전원 서명지' },
        { docKind: 'worker_consent',  required: true, reason: '제도 도입 관련 근로자 의견수렴·설명회·찬반투표 또는 과반수 동의서' },
        { docKind: 'settle_eval',     required: true, reason: '최종평가·아카데미 사후교육·활동비 정산 및 취업규칙 신고/이행 증빙' }
      ];
      var hasWageOrTime = codes.some(function (c) {
        var t = getTask(c);
        return t && (t.domain === 'worktime' || t.domain === 'wage' || t.domain === 'senior');
      });
      if (hasWageOrTime) {
        postList.splice(1, 0, {
          docKind: 'wage_ledger',
          required: false,
          reason: '제도개편안 확정을 위한 보완 임금·근로시간 모의계산(시뮬레이션) 검증 자료'
        });
      }
      return postList.map(function (item) {
        var dk = getDocKind(item.docKind) || {};
        return {
          docKind: item.docKind,
          name: dk.name || item.docKind,
          short: dk.short || item.docKind,
          track: dk.track || 'text',
          required: item.required,
          reason: item.reason
        };
      });
    }

    var needMap = {
      guide_agree: { required: true, reason: '착수 2주 내 참여안내서 서명·협약 및 디자인팀(노사 4인+) 편성 확인' },
      org_roster:  { required: true, reason: '기업 현황 및 직군·직급·연령·3개년 입퇴사 인력구조 분석 필수' },
      work_rules:  { required: true, reason: '현행 취업규칙·제규정 적법성 및 제도 운영 실태 교차진단 필수' },
      eos_survey:  { required: true, reason: '노사발전재단 전직원 조직진단(EOS) 응답률 충족 및 16개 영역 격차 분석' }
    };
    codes.forEach(function (c) {
      var t = getTask(c);
      if (!t) return;
      var dom = getDomain(t.domain);
      (dom ? dom.defaultDocs : []).forEach(function (dkCode) {
        if (!needMap[dkCode]) {
          needMap[dkCode] = {
            required: true,
            reason: '선택 과제 「' + t.name + '」 정밀 진단을 위한 기초자료'
          };
        }
      });
    });
    if (!needMap.labor_contract) {
      needMap.labor_contract = { required: false, reason: '근로조건 명시 및 취업규칙과의 정합성 교차 확인' };
    }

    var preOrder = ['guide_agree', 'org_roster', 'work_rules', 'labor_contract', 'time_leave', 'wage_ledger', 'lmanagement', 'eos_survey'];
    return preOrder.filter(function (code) { return !!needMap[code]; }).map(function (code) {
      var dk = getDocKind(code) || {};
      return {
        docKind: code,
        name: dk.name || code,
        short: dk.short || code,
        track: dk.track || 'text',
        required: !!needMap[code].required,
        reason: needMap[code].reason
      };
    });
  }

  /* 선택 과제에 연계 가능한 정부지원사업 중복 제거 목록 */
  function linkedGovAidsFor(selectedTaskCodes) {
    var seen = {}, out = [];
    (selectedTaskCodes || []).forEach(function (c) {
      var t = getTask(c);
      if (!t) return;
      (t.govAid || []).forEach(function (aid) {
        if (seen[aid]) return;
        seen[aid] = 1;
        out.push({ aidName: aid, fromTaskCode: t.code, fromTaskName: t.name });
      });
    });
    return out;
  }

  /* 메일 요청 문안 생성 (보내기 직전 채우기용 — 발송 클릭은 반드시 사람이 한다) */
  function buildDocRequestMailText(project, missingItems, phase) {
    var coName = String((project && project.companyName) || '귀 사').trim();
    var items = Array.isArray(missingItems) ? missingItems : [];
    var isPost = phase === 'post_mid';
    var subject = '[푸른노무법인] ' + coName + ' 일터혁신 상생컨설팅 '
      + (isPost ? '중간보고 후속 협의·결과보고 준비자료 요청의 건' : '착수 기초자료 송부 요청의 건');
    var lines = [
      '안녕하십니까, 푸른노무법인 일터혁신 상생컨설팅 전담팀입니다.',
      '',
      coName + '의 성공적인 일터혁신 상생컨설팅 수행 및 ' + (isPost ? '제도설계 확정·최종 결과보고서 작성' : '정밀 현황진단·중간보고서 작성') + '을 위하여 아래 자료의 송부를 요청드립니다.',
      ''
    ];
    if (items.length) {
      lines.push('■ 요청 자료 목록');
      items.forEach(function (it, idx) {
        lines.push('  ' + (idx + 1) + '. ' + it.name + (it.reason ? ' (' + it.reason + ')' : ''));
      });
    } else {
      lines.push('■ 요청 사항: 최근 협의된 보완 자료 및 회차 참석 서명지·사진 회신 부탁드립니다.');
    }
    lines.push('');
    lines.push('※ 임금대장·근태기록 등 인사 데이터는 사업장 전체 통계 분석 용도로만 활용되며, 주민등록번호 뒷자리 등 민감 고유식별정보는 가림(삭제) 처리 후 보내주셔도 무방합니다.');
    lines.push('※ 본 메일에 회신으로 첨부해 주시면 컨설팅 일정에 맞춰 신속히 검토·반영하겠습니다.');
    lines.push('');
    lines.push('감사합니다.');
    lines.push('푸른노무법인 드림');
    return { subject: subject, body: lines.join('\n') };
  }

  return {
    LEVELS: LEVELS,
    CRITERIA: CRITERIA,
    STAGES: STAGES,
    DOMAINS: DOMAINS,
    TASKS: TASKS,
    DOC_KINDS: DOC_KINDS,
    EOS_AREAS: EOS_AREAS,
    MID_SECTIONS: MID_SECTIONS,
    FINAL_SECTIONS: FINAL_SECTIONS,
    getTask: getTask,
    getDomain: getDomain,
    getDocKind: getDocKind,
    getLevel: getLevel,
    checklistFor: checklistFor,
    linkedGovAidsFor: linkedGovAidsFor,
    buildDocRequestMailText: buildDocRequestMailText
  };
});
