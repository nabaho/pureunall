/* 푸른통합시스템 — 산업·일자리전환 컨설팅(한국능률협회컨설팅 KMAC · 충남경제진흥원 CEPA) 도메인 카탈로그 및 양식 사전
 * (브라우저 window.PuJobtransCatalog / Node module.exports 겸용)
 *
 * 맡는 일:
 *   1. 운영기관 2대 체계(한국능률협회컨설팅 KMAC 구조혁신 vs 충남경제진흥원 CEPA 산업일자리전환지원센터) 및 5개 세부 트랙 정의
 *   2. 6단계 수행 생애주기 및 기관별 필수 운영·인정 기준(수행회차·설문·현장방문·완료계/완료보고서) 정의
 *   3. 수신·첨부 서류 12종 분류 체계 및 기관·트랙별 착수 기초자료(pre_mid)·중간보고 이후 후속자료(post_mid) 체크리스트 도출
 *   4. 노동전환 인식수준 및 노사관계 진단 설문 5대 영역 · 15개 세부항목 기준표 제공
 *   5. 기관별·트랙별 완전히 분리된 중간보고서 · 최종결과보고서 · 완료계/정책매니저 표준 목차 스키마 정의
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PuJobtransCatalog = api;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this), function () {
  'use strict';

  /* 운영기관 2대 구분 */
  var AGENCIES = {
    kmac: {
      code: 'kmac',
      name: '한국능률협회컨설팅(KMAC)',
      organizer: '중소벤처기업진흥공단 · 한국능률협회컨설팅',
      fullTitle: '중소벤처기업진흥공단 · 한국능률협회컨설팅 구조혁신지원사업(산업·일자리전환)',
      short: '능률협회(KMAC)',
      badgeCls: 'c-blue',
      defaultRounds: 8,
      minFacePct: 75,
      surveyName: '노동전환 인식수준 및 노사관계 진단 설문',
      completionDocName: '완료보고서 및 정책매니저(사후관리) 점검표'
    },
    cepa: {
      code: 'cepa',
      name: '충남경제진흥원(CEPA)',
      organizer: '충청남도 · 충남경제진흥원(산업일자리전환지원센터)',
      fullTitle: '충남경제진흥원 · 충남 산업일자리전환지원센터 컨설팅',
      short: '충남경제진흥원(CEPA)',
      badgeCls: 'c-green',
      defaultRounds: 5,
      minFacePct: 80,
      surveyName: '산업·일자리전환 근로자 인식 및 직무전환 수요조사',
      completionDocName: '컨설팅 완료계 및 산업일자리전환 장려금 연계서'
    }
  };

  /* 기관별 세부 수행 트랙 */
  var TRACKS = {
    kmac_std: {
      code: 'kmac_std',
      agency: 'kmac',
      name: 'KMAC 산업·일자리전환 본컨설팅',
      short: 'KMAC 본컨설팅',
      defaultRounds: 8,
      defaultDays: 10,
      minFacePct: 75,
      minRoundMins: 120,
      minPeople: 2,
      targetSector: '탄소중립·디지털전환 추진 제조·뿌리·소부장 중소기업',
      summary: '사업전환 연계 직무분석·재설계, 노동전환 인식수준 진단, 고용안정 노사협약 및 정부지원사업 매칭 체계도 수립'
    },
    kmac_pm: {
      code: 'kmac_pm',
      agency: 'kmac',
      name: 'KMAC 구조혁신 진단·정책매니저 연계',
      short: 'KMAC 진단·정책매니저',
      defaultRounds: 4,
      defaultDays: 5,
      minFacePct: 75,
      minRoundMins: 120,
      minPeople: 2,
      targetSector: '구조혁신 사전진단 및 전환계획 승인·사후관리 기업',
      summary: '기업 구조혁신(사업·디지털·일자리) 로드맵 점검, 정책자금·직무훈련·고용장려금 매칭 및 이행 모니터링'
    },
    cepa_diag: {
      code: 'cepa_diag',
      agency: 'cepa',
      name: 'CEPA 진단컨설팅 (수행계획·진단결과)',
      short: 'CEPA 진단컨설팅',
      defaultRounds: 3,
      defaultDays: 3,
      minFacePct: 80,
      minRoundMins: 120,
      minPeople: 2,
      targetSector: '충남 소재 석탄화력·자동차부품 등 산업전환 예정 기업',
      summary: '전방산업 전환 영향도 기초진단, 인사·노무·직무 취약점 도출, 전문컨설팅 및 충남 지원사업 연계 설계'
    },
    cepa_coal: {
      code: 'cepa_coal',
      agency: 'cepa',
      name: 'CEPA 전문컨설팅 (석탄화력발전 협력사 트랙)',
      short: 'CEPA 전문(석탄화력)',
      defaultRounds: 6,
      defaultDays: 8,
      minFacePct: 80,
      minRoundMins: 120,
      minPeople: 2,
      targetSector: '충남 석탄화력발전 단계적 폐지 영향 발전정비·설비·기자재 협력기업',
      summary: '석탄화력 폐지 일정에 따른 유휴·전환 인력 규모 산정, 친환경·신재생·플랜트 직무전환 및 고용유지 방안 수립'
    },
    cepa_auto: {
      code: 'cepa_auto',
      agency: 'cepa',
      name: 'CEPA 전문컨설팅 (자동차부품·주력산업 트랙)',
      short: 'CEPA 전문(미래차·주력)',
      defaultRounds: 6,
      defaultDays: 8,
      minFacePct: 80,
      minRoundMins: 120,
      minPeople: 2,
      targetSector: '충남 내연기관 자동차부품·디스플레이·철강 등 주력산업 전환 추진 기업',
      summary: '전동화·미래모빌리티 부품 전환에 따른 공정·직무 재설계, 현장인력 직무재교육(Reskilling) 및 장려금 연계'
    }
  };

  /* 운영·인정 기준 상수 */
  var CRITERIA = {
    tfTeamMin: 4,               // 노사 공동 노동전환 TF(추진팀) 최소 인원
    roundMinMins: 120,          // 회차당 최소 자문 시간(분)
    roundMinCompanyPeople: 2,   // 회차당 기업 측 참석 최소 인원
    surveyMinPct: 60,           // 노동전환 인식수준 설문 권장 응답률(%)
    followUpMonths: 3           // 사후 이행점검 기간(개월)
  };

  /* 6단계 수행 생애주기 */
  var STAGES = [
    { code: 'kickoff',  order: 1, name: '착수·수행계획·기초자료', short: '착수·기초수집', phase: 'pre_mid',  desc: '수행계획서 수립, 노사 TF 편성, 재무·인력 기초자료 메일 수신' },
    { code: 'diag',     order: 2, name: '전환영향·설문·인터뷰 진단', short: '전환진단·설문', phase: 'pre_mid',  desc: '전방산업 영향·3개년 재무·인력 분석, 노동전환 인식설문 및 인터뷰' },
    { code: 'mid_rpt',  order: 3, name: '기관맞춤 중간보고 확정', short: '중간보고',      phase: 'pre_mid',  desc: 'KMAC/CEPA 양식별 중간보고서 작성·검토 및 진단 기준선 확정' },
    { code: 'design',   order: 4, name: '직무재설계·후속메일 협의', short: '직무설계·협의', phase: 'post_mid', desc: '중간보고 피드백 메일 반영, 직무재설계·전환배치·훈련체계 확정' },
    { code: 'final_rpt', order: 5, name: '최종보고서·완료계 출력', short: '최종보고·완료계', phase: 'post_mid', desc: '기관별 최종결과보고서·완료보고서/완료계 HWPX·푸른한글·PDF 완성' },
    { code: 'followup', order: 6, name: '장려금·정책매니저 사후관리', short: '장려금·사후관리', phase: 'post_mid', desc: '산업일자리전환 장려금·정부지원사업 매칭 신청 및 이행점검' }
  ];

  /* 산업·일자리전환 8대 핵심 컨설팅 과제 카탈로그 */
  var TASKS = [
    {
      code: 'jt_impact',
      name: '전방산업 구조변화 및 사업전환 영향도 진단',
      agencies: ['kmac', 'cepa'],
      summary: '탄소중립·석탄화력 폐지·전동화 등 외부 산업전환 요인이 주력 품목 매출·가동률 및 직군별 인력수요에 미치는 영향 분석',
      lawPoints: ['산업전환에 따른 고용안정 지원 등에 관한 법률 제3조·제6조(산업전환 영향 사전진단 및 고용안정 지원)'],
      govAid: ['중진공 구조혁신지원사업(사업·일자리전환)', '충남 산업일자리전환 전문컨설팅']
    },
    {
      code: 'jt_survey',
      name: '노동전환 인식수준 조사 및 노사 상생소통 체계 구축',
      agencies: ['kmac', 'cepa'],
      summary: '전 근로자 노동전환 인식수준(5대 영역) 설문 분석, 노사 공동 전환추진위원회(TF) 및 노사협의회 사전협의 프로세스 정립',
      lawPoints: ['근로자참여 및 협력증진에 관한 법률 제20조(신기계·기술 도입 및 배치전환 협의)', '산업전환고용안정법 노사 사전협의 원칙'],
      govAid: ['노사파트너십 프로그램 지원사업', '노동전환 노사상생 협약 인센티브']
    },
    {
      code: 'jt_job_redesign',
      name: '전환직무 분석 · 직무재설계(JD) 및 전환배치 기준 수립',
      agencies: ['kmac', 'cepa'],
      summary: '축소·유지·확대·신설 직무 매트릭스 도출, 전환 대상 직무기술서(JD)·요구역량 정의 및 공정한 전환배치 인사기준 마련',
      lawPoints: ['근로기준법 제23조 제1항(전직·배치전환의 업무상 필요성 및 생활상 불이익 비교형량, 본인 협의 절차 명시)'],
      govAid: ['충남 산업일자리전환 장려금(직무전환 배치 연계)', '고용노동부 노동전환 지원금']
    },
    {
      code: 'jt_reskill',
      name: '직무전환 교육훈련(Reskilling·Upskilling) 및 사내 OJT 체계',
      agencies: ['kmac', 'cepa'],
      summary: '신사업·스마트공정 직무 수행을 위한 수준별 직무재교육 커리큘럼, 체계적 현장훈련(S-OJT) 및 훈련시간 유급인정 기준 설계',
      lawPoints: ['근로자직업능력 개발법 제20조(사업주 직업능력개발훈련 지원)', '직무전환 훈련기간 중 임금보전 및 평가 환류'],
      govAid: ['산업전환 공동훈련센터·지역혁신 프로젝트 훈련', '사업주 직업능력개발훈련·체계적 현장훈련(S-OJT)']
    },
    {
      code: 'jt_emp_stab',
      name: '고용안정 상생협약 및 전환기 인사·복무규정 정비',
      agencies: ['kmac', 'cepa'],
      summary: '인위적 구조조정 지양 및 고용유지 노사 상생협약 체결, 전환배치·직무교육·고충처리 관련 취업규칙 및 인사규정 신구대조 정비',
      lawPoints: ['근로기준법 제94조(취업규칙 변경 및 근로자 과반수 의견청취·동의)', '고용보험법 고용유지·전환 지원 요건'],
      govAid: ['고용유지지원금 · 무급휴직 신속지원', '노동전환 고용안정 협약기업 우대지원']
    },
    {
      code: 'jt_wage_time',
      name: '전환공정 대응 근무체계 및 직무·숙련 기반 보상체계 개편',
      agencies: ['kmac', 'cepa'],
      summary: '신규 라인 가동·다품종 공정에 맞춘 교대·유연근무 개편, 전환기 임금보전 원칙 및 직무·다기능 숙련수당 체계 설계',
      lawPoints: ['근로기준법 제50조~제53조(근로시간·유연근무) · 제43조·제48조(임금지급 및 임금명세서)', '통상임금 산입범위 적법화'],
      govAid: ['워라밸일자리·유연근무 장려금', '일터혁신 상생컨설팅 연계 지원']
    },
    {
      code: 'jt_smart_safe',
      name: '신설비·스마트공정 도입에 따른 작업환경 및 안전보건 정비',
      agencies: ['kmac', 'cepa'],
      summary: '전동화·자동화 설비 도입에 따른 유해·위험요인 재성평가 반영, 신규 공정 안전작업표준서 및 고령·숙련인력 작업환경 개선',
      lawPoints: ['산업안전보건법 제36조(위험성평가 — 설비·공정 변경 시 수시평가 의무) · 제29조(작업내용 변경 시 안전보건교육)'],
      govAid: ['클린사업장 조성지원 · 스마트안전장비 지원', '고령자 친화 작업환경 개선 지원']
    },
    {
      code: 'jt_gov_match',
      name: '정부·지자체 노동전환 지원제도 매칭 체계도 및 실행계획',
      agencies: ['kmac', 'cepa'],
      summary: '사업전환 승인·정책자금·R&D·직무훈련·고용장려금(충남 산업일자리전환 장려금 등) 기업 맞춤형 시기별 신청 로드맵 구축',
      lawPoints: ['중소기업 사업전환 촉진에 관한 특별법', '충청남도 정의로운 전환 및 산업일자리전환 지원 조례·운영지침'],
      govAid: ['충남 산업일자리전환 장려금', '중진공 사업전환자금·구조혁신 후속연계', '청년·고령자 계속고용장려금']
    }
  ];

  /* 수신·첨부 서류 12종 분류 체계
   * - track: 'quant'(브라우저 로컬 비식별 통계 전용 — 원본 성명·주민번호 외부 전송 0건) | 'text'(2중 마스킹 요약) | 'meta'(일정·서명·증빙 확인)
   */
  var DOC_KINDS = [
    {
      code: 'plan_agree', name: '수행계획서·협약서·참여신청서', short: '수행계획·신청서',
      defaultPhase: 'pre_mid', track: 'meta',
      keywords: ['수행계획서', '착수계', '협약서', '참여신청서', '신청서', '사전진단', '추진팀', '위촉', '구조혁신', '일자리전환']
    },
    {
      code: 'biz_fin', name: '사업자등록증·최근 3개년 표준재무제표', short: '사업자·재무3개년',
      defaultPhase: 'pre_mid', track: 'quant',
      keywords: ['사업자등록증', '재무제표', '표준재무제표', '손익계산서', '재무상태표', '매출액', '영업이익', '부가가치세', '기업현황']
    },
    {
      code: 'org_roster', name: '조직도·직무별 인력현황·3개년 입퇴사 명부', short: '조직도·인력명부',
      defaultPhase: 'pre_mid', track: 'quant',
      keywords: ['조직도', '인력현황', '인원현황', '근로자명부', '사원명부', '입퇴사', '재직자', '직무현황', '부서별인원', '4대보험']
    },
    {
      code: 'biz_tech', name: '주요 생산품·전방거래처·신사업/설비전환 자료', short: '사업·품목·전환자료',
      defaultPhase: 'pre_mid', track: 'text',
      keywords: ['회사소개서', '사업계획서', '생산품', '주력품목', '석탄화력', '발전소', '내연기관', '미래차', '전동화', '신사업', '매출비중', '공정도']
    },
    {
      code: 'work_rules', name: '취업규칙·인사규정·배치전환/교육 규정', short: '취업규칙·인사규정',
      defaultPhase: 'pre_mid', track: 'text',
      keywords: ['취업규칙', '인사규정', '복무규정', '보수규정', '임금규정', '교육훈련규정', '사규', '내규', '노사협의회규정']
    },
    {
      code: 'labor_contract', name: '표준 근로계약서·연봉계약서·직무기술서', short: '근로계약·직무기술서',
      defaultPhase: 'pre_mid', track: 'text',
      keywords: ['근로계약서', '연봉계약서', '직무기술서', '직무명세서', '업무분장표', '직무조사표']
    },
    {
      code: 'wage_time', name: '임금대장·근태기록·연차현황(비식별 통계)', short: '임금·근태통계',
      defaultPhase: 'pre_mid', track: 'quant',
      keywords: ['임금대장', '급여대장', '임금명세', '수당', '출퇴근', '근태', '교대제', '연장근로', '연차']
    },
    {
      code: 'trans_survey', name: '노동전환 인식수준 및 노사관계 설문 결과', short: '노동전환 설문결과',
      defaultPhase: 'pre_mid', track: 'quant',
      keywords: ['설문', '인식수준', '인식조사', '노동전환설문', '노사관계진단', '직무전환수요', '응답', '설문집계']
    },
    {
      code: 'round_log', name: '회차별 수행일지·현장사진·참석자 서명부', short: '수행일지·사진·서명',
      defaultPhase: 'post_mid', track: 'meta',
      keywords: ['수행일지', '자문일지', '수행사진', '현장사진', '타임스탬프', '서명부', '서명지', '참석자명단', '회의록']
    },
    {
      code: 'mid_feedback', name: '중간보고 피드백·전환직무/배치 설계 회신', short: '중간피드백·전환설계',
      defaultPhase: 'post_mid', track: 'text',
      keywords: ['피드백', '중간보고검토', '검토의견', '수정의견', '보완요청', '전환배치안', '직무재설계안', '교육계획안', '로드맵검토']
    },
    {
      code: 'labor_accord', name: '노사 상생협약서·근로자 동의서·신구대조표', short: '노사협약·신구대조',
      defaultPhase: 'post_mid', track: 'text',
      keywords: ['상생협약', '고용안정협약', '노사합의서', '동의서', '의견수렴', '설명회', '신구대조표', '개정안']
    },
    {
      code: 'completion_aid', name: '완료계·완료보고서 증빙·장려금/정책매니저 서류', short: '완료계·장려금연계',
      defaultPhase: 'post_mid', track: 'meta',
      keywords: ['완료계', '완료보고서', '완료확인서', '만족도조사', '지원금신청서', '장려금', '정책매니저', '사후관리', '검수확인']
    }
  ];

  /* 노동전환 인식수준 및 노사관계 진단 설문 5대 영역 · 15개 세부항목 (5점 만점 기준 준거치 포함) */
  var SURVEY_AREAS = [
    {
      code: 'env_aware', name: '산업전환 환경인식 및 추진 공감대', bench: 3.60,
      items: [
        { code: 'sv_01', name: '전방산업(탄소중립·전동화 등) 환경변화 인지 수준', bench: 3.65 },
        { code: 'sv_02', name: '회사의 신사업·공정전환 추진 필요성 공감도', bench: 3.62 },
        { code: 'sv_03', name: '산업·일자리전환 방향성에 대한 구성원 이해도', bench: 3.53 }
      ]
    },
    {
      code: 'comm_trust', name: '경영진 비전 공유 및 노사소통 신뢰', bench: 3.52,
      items: [
        { code: 'sv_04', name: '전환 계획 수립 시 사전 정보공유 투명성', bench: 3.48 },
        { code: 'sv_05', name: '노사협의회·전환TF를 통한 현장 의견반영 수준', bench: 3.50 },
        { code: 'sv_06', name: '노사 간 상호존중 및 협력적 노사관계 신뢰도', bench: 3.58 }
      ]
    },
    {
      code: 'job_adapt', name: '직무전환 수용성 및 배치전환 공정성', bench: 3.40,
      items: [
        { code: 'sv_07', name: '신규 직무·신설비 담당 전환 의향 및 수용성', bench: 3.44 },
        { code: 'sv_08', name: '부서·공정 간 업무분장(R&R) 및 직무기준 명확성', bench: 3.38 },
        { code: 'sv_09', name: '전환배치 대상자 선정 및 인사절차의 공정성', bench: 3.38 }
      ]
    },
    {
      code: 'reskill_edu', name: '직무재교육(Reskilling) 및 역량개발 지원', bench: 3.35,
      items: [
        { code: 'sv_10', name: '신기술·전환직무 교육훈련 프로그램 충분성', bench: 3.30 },
        { code: 'sv_11', name: '교육훈련 참여를 위한 근무시간 배려 및 지원', bench: 3.36 },
        { code: 'sv_12', name: '숙련기술 전수(OJT) 및 사내 학습문화 수준', bench: 3.39 }
      ]
    },
    {
      code: 'emp_security', name: '고용안정 신뢰도 및 장기근속 의향', bench: 3.48,
      items: [
        { code: 'sv_13', name: '산업전환 과정에서의 고용유지·안정성 신뢰도', bench: 3.45 },
        { code: 'sv_14', name: '직무전환 후 근로조건·임금수준 보전 기대감', bench: 3.42 },
        { code: 'sv_15', name: '전환 완료 후 회사 내 지속 성장 및 근속 의향', bench: 3.57 }
      ]
    }
  ];

  /* ══ 기관별 중간보고서 표준 섹션 스키마 (KMAC vs CEPA 완전 분리) ══════════ */
  var KMAC_MID_SECTIONS = [
    { key: 'overview',      part: 'Ⅰ. 구조혁신 컨설팅 개요',       title: '1. 추진 배경·목적 및 수행체계(노사 공동 TF·일정)' },
    { key: 'company_fin',   part: 'Ⅱ. 기업 일반현황 및 경영추이',   title: '2. 기업 일반현황 · 최근 3개년 재무 및 인력구조 추이' },
    { key: 'trans_impact',  part: 'Ⅲ. 산업전환 환경 및 영향진단',   title: '3. 전방산업 구조변화(탄소중립·디지털) 및 주력사업 영향 분석' },
    { key: 'hr_policy_diag', part: 'Ⅳ. 인사노무·직무 현황진단',     title: '4. 조직·직무체계 및 취업규칙·근로시간·임금 교차진단 이슈' },
    { key: 'survey_diag',   part: 'Ⅴ. 노동전환 인식 및 노사진단',   title: '5. 노동전환 인식수준(5대 영역) 및 노사관계 설문·인터뷰 분석' },
    { key: 'core_issues',   part: 'Ⅵ. 종합 시사점 및 핵심과제',     title: '6. 진단 종합 시사점(SWOT/As-Is) 및 중점 전환과제 도출' },
    { key: 'mid_direction', part: 'Ⅶ. 향후 설계방향 및 추진계획',   title: '7. 과제별 세부 설계방향(To-Be) 및 잔여 회차 수행계획' }
  ];

  var CEPA_MID_SECTIONS = [
    { key: 'overview',      part: 'Ⅰ. 충남 산업일자리전환 사업개요', title: '1. 과업 개요 · 추진 경과 및 수행체계(충남경제진흥원 표준)' },
    { key: 'company_fin',   part: 'Ⅱ. 참여기업 일반현황 분석',      title: '2. 참여기업 일반현황 · 3개년 매출/재무 및 고용 추이' },
    { key: 'trans_impact',  part: 'Ⅲ. 전환산업 환경 및 리스크 진단', title: '3. 석탄화력 폐지·미래차 전환 등 전방산업 영향도 및 공급망 진단' },
    { key: 'hr_policy_diag', part: 'Ⅳ. 직무구조 및 인사노무 진단',   title: '4. 공정·직무별 인력배치 현황 및 노동법규·인사제도 취약점 분석' },
    { key: 'survey_diag',   part: 'Ⅴ. 근로자 인식조사 및 인터뷰',   title: '5. 경영진·현장근로자 심층 인터뷰 및 직무전환 수요·인식 분석' },
    { key: 'core_issues',   part: 'Ⅵ. 전환 애로사항 및 개선과제',   title: '6. 기업 맞춤형 일자리전환 핵심 애로요인 및 중점 개선과제 선정' },
    { key: 'mid_direction', part: 'Ⅶ. 하반기 직무전환·지원금 연계안', title: '7. 직무재설계·교육훈련 설계방향 및 충남 지원사업 연계 계획' }
  ];

  /* ══ 기관별 최종결과보고서 표준 섹션 스키마 (KMAC vs CEPA 진단/전문 완전 분리) ══ */
  var KMAC_FINAL_SECTIONS = [
    { key: 'exec_summary',  part: 'Ⅰ. 구조혁신(산업·일자리전환) 종합 요약', title: '1. 컨설팅 수행 개요 · 회차별 추진실적 및 핵심 성과 요약' },
    { key: 'diag_baseline', part: 'Ⅱ. 기업현황 및 노동전환 진단 종합',     title: '2. 3개년 경영·인력 추이, 산업전환 영향 및 인식수준 진단 기준선' },
    { key: 'job_redesign',  part: 'Ⅲ. 산업전환 연계 직무분석 및 재설계',   title: '3. 축소·확대·신설 직무 매트릭스, 직무기술서(JD) 및 전환배치 설계안' },
    { key: 'reskill_plan',  part: 'Ⅳ. 직무전환 교육훈련 및 역량개발 체계', title: '4. 전환 인력 맞춤형 직무재교육(Reskilling)·S-OJT 커리큘럼 및 운영방안' },
    { key: 'hr_governance', part: 'Ⅴ. 고용안정 노사협약 및 인사제도 개편', title: '5. 중간보고 피드백 반영 노사 상생협약, 근무·보상체계 및 취업규칙 정비안' },
    { key: 'roadmap',       part: 'Ⅵ. 중장기 일자리전환 실행 로드맵',      title: '6. 단계별(단기·중기·장기) 인력전환·채용·조직개편 실행 로드맵' },
    { key: 'gov_matching',  part: 'Ⅶ. 정부지원사업 매칭 체계도',          title: '7. 중진공·고용부·훈련기관 연계 정부지원사업 매칭 체계도 및 활용계획' },
    { key: 'completion_pm', part: 'Ⅷ. 완료보고 및 정책매니저 사후관리',    title: '8. 컨설팅 종합소견 · 완료보고 요약 및 정책매니저 이행점검 계획' }
  ];

  var CEPA_DIAG_FINAL_SECTIONS = [
    { key: 'exec_summary',  part: 'Ⅰ. 진단컨설팅 수행 개요',              title: '1. 진단컨설팅 목적 · 수행일정 및 참여기업 기초현황 요약' },
    { key: 'diag_baseline', part: 'Ⅱ. 기업 경영·인력 및 산업전환 영향진단', title: '2. 최근 3개년 매출·고용 추이 및 석탄화력/미래차 전환 영향도 분석' },
    { key: 'job_redesign',  part: 'Ⅲ. 공정·직무 현황 및 전환대상 직무 도출', title: '3. 부서·공정별 직무 현황 분석 및 업종전환·신사업 필요 직무 도출' },
    { key: 'hr_governance', part: 'Ⅳ. 인사·노무관리 적법성 및 제도 진단',   title: '4. 근로계약·취업규칙·근로시간·임금체계 진단 이슈 및 정비 방향' },
    { key: 'reskill_plan',  part: 'Ⅴ. 근로자 인식분석 및 교육훈련 수요',    title: '5. 경영진·근로자 인터뷰 결과 및 직무전환 교육훈련(Reskilling) 수요' },
    { key: 'roadmap',       part: 'Ⅵ. 전문컨설팅 연계 및 단계별 전환계획',  title: '6. 단·중기 일자리전환 개선과제 및 심화(전문)컨설팅 연계 로드맵' },
    { key: 'gov_matching',  part: 'Ⅶ. 충남 산업일자리전환 지원사업 연계',   title: '7. 충남 산업일자리전환 장려금 · 직무훈련 · 중앙정부 지원금 매칭안' },
    { key: 'completion_pm', part: 'Ⅷ. 진단컨설팅 완료계 및 종합의견',      title: '8. 전담 컨설턴트 종합 소견 및 충남경제진흥원 완료계 제출 요약' }
  ];

  var CEPA_PRO_FINAL_SECTIONS = [
    { key: 'exec_summary',  part: 'Ⅰ. 전문컨설팅 종합 요약',              title: '1. 충남 산업일자리전환 전문컨설팅 수행 개요 · 추진경과 및 핵심 성과' },
    { key: 'diag_baseline', part: 'Ⅱ. 전방산업 전환 영향 및 현황진단 기준선', title: '2. 석탄화력 폐지·미래차 전환 영향 분석 및 기업 경영·인력·설문 기준선' },
    { key: 'job_redesign',  part: 'Ⅲ. 신사업·전환공정 직무재설계 및 재배치', title: '3. 전환 대상 직군·인원 산정, 직무기술서(JD) 재설계 및 배치전환 기준' },
    { key: 'reskill_plan',  part: 'Ⅳ. 맞춤형 직무전환 훈련 및 숙련전수 설계', title: '4. 직무재교육(Reskilling) 과정 설계, 훈련일정 및 충남 지역훈련기관 연계' },
    { key: 'hr_governance', part: 'Ⅴ. 고용안정 상생협약 및 인사·보상 개편안', title: '5. 후속 협의 반영 고용유지 노사협약, 근무·임금보전 기준 및 규정 신구대조' },
    { key: 'roadmap',       part: 'Ⅵ. 연차별 산업·일자리전환 이행 로드맵',   title: '6. 연차별(2026~2028) 사업다각화·직무전환·신규채용 이행 로드맵' },
    { key: 'gov_matching',  part: 'Ⅶ. 충남 산업일자리전환 장려금·지원 매칭', title: '7. 충남 산업일자리전환 장려금 요건 검토 및 정부·지자체 지원사업 연계표' },
    { key: 'completion_pm', part: 'Ⅷ. 전문컨설팅 완료계 및 사후관리 계획',  title: '8. 전문컨설팅 완료계 요약 · 기대효과 및 컨설팅 종료 후 사후 이행점검 계획' }
  ];

  /* 사후관리·완료 점검 항목 (기관별 분리) */
  var KMAC_FOLLOWUP_ITEMS = [
    { code: 'km_fu_1', month: '종료 직후', title: 'KMAC 구조혁신 완료보고서 · 수행일지 · 참석자 서명부 및 기업 만족도 설문 제출', proof: '완료보고서 · 만족도 완료 확인' },
    { code: 'km_fu_2', month: 'M+1개월', title: '노동전환 노사 상생협약서 체결 및 개정 취업규칙(배치전환·교육규정) 신고 완료', proof: '노사협약서 · 취업규칙 신고접수증' },
    { code: 'km_fu_3', month: 'M+1개월 (정책매니저 1차)', title: '정책매니저 1차 점검 — 전환 대상 직무기술서(JD) 현업 배포 및 직무전환 훈련 신청', proof: '정책매니저 1차 점검일지 · 훈련신청서' },
    { code: 'km_fu_4', month: 'M+2개월', title: '중진공 사업전환 승인 · 구조혁신 연계 정책자금 또는 고용노동부 노동전환 지원금 신청', proof: '지원사업 신청 접수증' },
    { code: 'km_fu_5', month: 'M+3개월 (정책매니저 2차)', title: '정책매니저 2차 점검 — 전환배치 인력 적응도·고용유지율 점검 및 사후관리 종결 보고', proof: '정책매니저 최종 이행점검표' }
  ];

  var CEPA_FOLLOWUP_ITEMS = [
    { code: 'cp_fu_1', month: '종료 직후', title: '충남경제진흥원 컨설팅 완료계 · 결과보고서(HWPX/PDF) · 회차별 자문일지·사진 제출', proof: '완료계 · 최종보고서 접수 확인' },
    { code: 'cp_fu_2', month: 'M+1개월', title: '전환 대상 근로자 직무재교육(Reskilling) 입과 또는 사내 직무전환 OJT 개시', proof: '교육훈련 계획서 · 수료/출석 증빙' },
    { code: 'cp_fu_3', month: 'M+1~2개월', title: '노사 합의 기반 전환배치 인사발령 및 개정 근로계약·취업규칙 현업 적용', proof: '전환배치 발령장 · 노사합의서 사본' },
    { code: 'cp_fu_4', month: 'M+2개월', title: '충남 산업일자리전환지원센터 「산업일자리전환 장려금」 및 연계 지원금 요건 증빙 신청', proof: '장려금 지원신청서 · 고용유지 증빙' },
    { code: 'cp_fu_5', month: 'M+3개월', title: '전환배치 근로자 고용유지 및 직무 적응 모니터링 (진단컨설팅 기업은 전문컨설팅 후속 신청)', proof: '사후 모니터링 기록지' }
  ];

  var taskByCode = {};
  TASKS.forEach(function (t) { taskByCode[t.code] = t; });
  var docKindByCode = {};
  DOC_KINDS.forEach(function (d) { docKindByCode[d.code] = d; });

  function getAgency(code) {
    return AGENCIES[String(code || '').toLowerCase()] || AGENCIES.kmac;
  }

  function getTrack(trackCode, agencyCode) {
    var tc = String(trackCode || '');
    if (TRACKS[tc]) return TRACKS[tc];
    var ag = getAgency(agencyCode).code;
    return ag === 'cepa' ? TRACKS.cepa_coal : TRACKS.kmac_std;
  }

  function tracksForAgency(agencyCode) {
    var ag = getAgency(agencyCode).code;
    return Object.keys(TRACKS).map(function (k) { return TRACKS[k]; })
      .filter(function (t) { return t.agency === ag; });
  }

  function getTask(code) { return taskByCode[String(code || '')] || null; }
  function getDocKind(code) { return docKindByCode[String(code || '')] || null; }

  function getMidSections(agencyCode) {
    return getAgency(agencyCode).code === 'cepa' ? CEPA_MID_SECTIONS : KMAC_MID_SECTIONS;
  }

  function getFinalSections(agencyCode, trackCode) {
    var tr = getTrack(trackCode, agencyCode);
    if (tr.agency === 'cepa') {
      return tr.code === 'cepa_diag' ? CEPA_DIAG_FINAL_SECTIONS : CEPA_PRO_FINAL_SECTIONS;
    }
    return KMAC_FINAL_SECTIONS;
  }

  function getFollowupItems(agencyCode) {
    return getAgency(agencyCode).code === 'cepa' ? CEPA_FOLLOWUP_ITEMS : KMAC_FOLLOWUP_ITEMS;
  }

  /* 기관·트랙 및 선택 과제에 따른 필수 수신 서류 체크리스트 도출 */
  function checklistFor(phase, agencyCode, trackCode, selectedTaskCodes) {
    var ag = getAgency(agencyCode);
    var tr = getTrack(trackCode, ag.code);
    var codes = Array.isArray(selectedTaskCodes) && selectedTaskCodes.length
      ? selectedTaskCodes
      : ['jt_impact', 'jt_job_redesign', 'jt_reskill', 'jt_gov_match'];

    if (phase === 'post_mid') {
      var postList = [
        { docKind: 'mid_feedback',   required: true, reason: ag.short + ' 중간보고 이후 전환직무·재배치·훈련계획 검토 피드백 확인' },
        { docKind: 'round_log',      required: true, reason: '회차별 수행일지·현장 방문 사진 및 참석자 서명부 편철' },
        { docKind: 'labor_accord',   required: tr.code !== 'cepa_diag', reason: '고용안정 노사 상생협약서·근로자 의견수렴 동의서 및 규정 신구대조표' },
        { docKind: 'completion_aid', required: true, reason: ag.completionDocName + ' 증빙 확정' }
      ];
      return postList.map(function (it) {
        var dk = getDocKind(it.docKind);
        return Object.assign({}, dk, it);
      });
    }

    var needMap = {
      plan_agree:   { required: true, reason: ag.short + ' ' + tr.short + ' 수행계획서·참여신청서 및 노사 TF 편성 확인' },
      biz_fin:      { required: true, reason: '사업자등록증 및 최근 3개년 표준재무제표(매출·영업이익 추이 분석 필수)' },
      org_roster:   { required: true, reason: '조직도·부서/직무별 인력현황 및 3개년 입퇴사 추이(비식별 통계 집계용)' },
      biz_tech:     { required: true, reason: ag.code === 'cepa' ? '주력 품목·거래처(석탄화력/내연기관 비중) 및 신사업 전환 계획 파악' : '주력 생산품·공정도 및 탄소중립/디지털 사업전환 배경 파악' },
      work_rules:   { required: true, reason: '현행 취업규칙·인사규정 내 배치전환·교육훈련·근로조건 조항 법정 진단' },
      trans_survey: { required: tr.code !== 'cepa_diag', reason: ag.surveyName + ' 응답 집계' }
    };

    codes.forEach(function (c) {
      if (c === 'jt_job_redesign' || c === 'jt_emp_stab') {
        needMap.labor_contract = { required: true, reason: '표준 근로계약서(담당업무·근무장소 명시) 및 현행 직무기술서 점검' };
      }
      if (c === 'jt_wage_time') {
        needMap.wage_time = { required: true, reason: '전환공정 근무체계 및 직무·숙련 보상 설계를 위한 임금·근태 비식별 통계' };
      }
    });

    if (!needMap.labor_contract) {
      needMap.labor_contract = { required: false, reason: '표준 근로계약서 및 직무분장표 참고 확인' };
    }
    if (!needMap.wage_time) {
      needMap.wage_time = { required: false, reason: '임금·근로시간 현황 비식별 기초 통계 참고' };
    }

    var order = ['plan_agree', 'biz_fin', 'org_roster', 'biz_tech', 'work_rules', 'labor_contract', 'wage_time', 'trans_survey'];
    return order.filter(function (k) { return !!needMap[k]; }).map(function (k) {
      var dk = getDocKind(k);
      return Object.assign({}, dk, { docKind: k, required: !!needMap[k].required, reason: needMap[k].reason });
    });
  }

  /* 미수신 서류 요청 메일 초안 생성기 (발송은 사람이 직접 수행 — 단일 opts 객체 또는 (proj, missingDocs, phase) 인자 모두 지원) */
  function buildDocRequestMail(opts, maybeDocs, maybePhase) {
    var o = opts || {};
    var coName = String(o.companyName || '귀 사업장').trim();
    var phaseArg = maybePhase !== undefined ? maybePhase : o.phase;
    var phase = phaseArg === 'post_mid' ? 'post_mid' : 'pre_mid';
    var ag = getAgency(o.agency);
    var tr = getTrack(o.track, ag.code);
    var docsArg = Array.isArray(maybeDocs) ? maybeDocs : o.missingDocs;
    var missing = Array.isArray(docsArg) ? docsArg : [];
    var consultant = String(o.consultantName || '푸른노무법인 전담 컨설턴트').trim();

    var subj = phase === 'post_mid'
      ? '[푸른노무법인] ' + coName + ' ' + ag.short + ' 산업·일자리전환 최종보고서 및 완료서류 작성을 위한 후속자료 요청'
      : '[푸른노무법인] ' + coName + ' ' + ag.short + ' (' + tr.short + ') 중간보고 진단을 위한 기초자료 송부 요청';

    var listLines = missing.length
      ? missing.map(function (m, idx) {
          var dk = typeof m === 'string' ? getDocKind(m) : (getDocKind(m.docKind || m.code) || m);
          var nm = dk && dk.name ? dk.name : String(m);
          var rsn = (m && m.reason) ? ' — ' + m.reason : '';
          return '  ' + (idx + 1) + '. ' + nm + rsn;
        }).join('\n')
      : '  1. (필수 서류가 모두 확인되었습니다 — 추가 보완의견이 있으시면 회신 부탁드립니다)';

    var body = [
      '안녕하십니까, ' + coName + ' 인사·노무 담당자님.',
      ag.fullTitle + ' 수행기관 푸른노무법인(' + consultant + ')입니다.',
      '',
      phase === 'post_mid'
        ? '지난 중간보고회에서 논의된 산업·일자리전환 설계 방향을 바탕으로 기관 제출용 최종 결과보고서 및 ' + ag.completionDocName + '를 마무리하고자 아래 후속 자료 회신을 요청드립니다.'
        : '원활한 기업 현황·산업전환 영향 진단 및 ' + ag.short + ' 양식 기준 중간보고서 작성을 위하여 아래 기초자료 송부를 요청드립니다.',
      '',
      '[요청 서류 목록]',
      listLines,
      '',
      '※ 개인정보 보호 안내: 보내주시는 인력명부·임금·설문 등 정량 자료는 브라우저 내 사업장 단위 비식별 통계(부서·직군별 인원 및 평균치)로만 집계되며, 개별 성명이나 주민등록번호는 보고서에 기재되지 않습니다.',
      '※ 회신 주실 곳: 본 메일 회신 (첨부 가능 형식: 한글 .hwpx/.hwp, 엑셀 .xlsx, PDF 등)',
      '',
      '감사합니다.',
      '푸른노무법인 드림'
    ].join('\n');

    return { subject: subj, body: body };
  }

  /* 사업명·유형 텍스트로 운영기관(kmac / cepa) 및 세부 트랙 자동 추론 */
  function inferAgencyAndTrack(text) {
    var s = String(text || '').toLowerCase();
    if (/충남|충경진|cepa|경제진흥원|석탄화력|정의로운/.test(s)) {
      if (/진단\s*컨설팅|기초\s*진단/.test(s)) return { agency: 'cepa', track: 'cepa_diag' };
      if (/자동차|미래차|모빌리티|전동화|부품/.test(s)) return { agency: 'cepa', track: 'cepa_auto' };
      return { agency: 'cepa', track: 'cepa_coal' };
    }
    if (/정책\s*매니저|사후\s*관리/.test(s)) {
      return { agency: 'kmac', track: 'kmac_pm' };
    }
    return { agency: 'kmac', track: 'kmac_std' };
  }

  return {
    AGENCIES: AGENCIES,
    TRACKS: TRACKS,
    CRITERIA: CRITERIA,
    STAGES: STAGES,
    TASKS: TASKS,
    DOC_KINDS: DOC_KINDS,
    SURVEY_AREAS: SURVEY_AREAS,
    KMAC_MID_SECTIONS: KMAC_MID_SECTIONS,
    CEPA_MID_SECTIONS: CEPA_MID_SECTIONS,
    KMAC_FINAL_SECTIONS: KMAC_FINAL_SECTIONS,
    CEPA_DIAG_FINAL_SECTIONS: CEPA_DIAG_FINAL_SECTIONS,
    CEPA_PRO_FINAL_SECTIONS: CEPA_PRO_FINAL_SECTIONS,
    getAgency: getAgency,
    getTrack: getTrack,
    tracksForAgency: tracksForAgency,
    getTask: getTask,
    getDocKind: getDocKind,
    getMidSections: getMidSections,
    getFinalSections: getFinalSections,
    getFollowupItems: getFollowupItems,
    checklistFor: checklistFor,
    buildDocRequestMail: buildDocRequestMail,
    inferAgencyAndTrack: inferAgencyAndTrack
  };
});
