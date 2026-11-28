/* 안전보건체계구축(safety.html) 폰·PC 화면 실측 점검용 합성 자료 — 모두 지어낸 값이다. */
'use strict';

const NOW = Date.UTC(2026, 10, 23, 2, 0, 0);

const companies = [
  { id: 'sfco-1', name: '(주)한가람금속정밀', bizNo: '123-81-51001', email: 'safety@hangaram.example', bizType: '금속가공제품 제조업', status: 'active' },
  { id: 'sfco-2', name: '(주)청솔로지스틱스', bizNo: '123-81-51002', email: 'ops@cheongsol.example', bizType: '화물운송·창고물류업', status: 'active' },
  { id: 'sfco-3', name: '푸른샘종합사회복지관', bizNo: '123-81-51003', email: 'care@pureunsam.example', bizType: '사회복지서비스업', status: 'active' },
];

const projects = {
  'sf_sfco-1_2026': {
    id: 'sf_sfco-1_2026',
    entityType: 'Project',
    schemaVersion: 1,
    contractVersion: 1,
    createdAt: NOW - 864e5 * 20,
    updatedAt: NOW - 3600e3,
    revision: 2,
    companyId: 'sfco-1',
    companyName: '(주)한가람금속정밀',
    year: 2026,
    industryCode: 'mfg_high',
    extraIndustries: ['retail_logis'],
    track: 'kosha_high',
    selectedHazards: ['m_forklift', 'm_crane', 'm_molding', 'm_ladder'],
    workerCount: 38,
    status: 'active',
    roundCount: 3,
    source: '시드 합성 데이터',
    consultantName: '점검노무사 공인노무사',
    summaryNote: '프레스·천장크레인·지게차 복합 공정 고위험 특화 구축 중',
    rounds: [
      { roundNo: 1, date: '2026-10-05', twoPersonTeam: true, ceoMet: true, workerMet: true, siteTour: true, summary1PProvided: false, topic: '1회차(2인1조): CEO 면담, 사전체크 검토, 전 공정 순회점검' },
      { roundNo: 2, date: '2026-10-21', twoPersonTeam: true, ceoMet: false, workerMet: true, siteTour: true, summary1PProvided: false, topic: '2회차(2인1조): 지게차·크레인 시범 위험성평가 및 감소대책 수립' },
      { roundNo: 3, date: '2026-11-10', twoPersonTeam: false, ceoMet: true, workerMet: true, siteTour: true, summary1PProvided: true, topic: '3회차: 사업장 주도 위험성평가 참관 및 1P 중간강평' },
    ],
  },
  'sf_sfco-2_2025': {
    id: 'sf_sfco-2_2025',
    entityType: 'Project',
    schemaVersion: 1,
    contractVersion: 1,
    createdAt: NOW - 864e5 * 240,
    updatedAt: NOW - 864e5 * 180,
    revision: 1,
    companyId: 'sfco-2',
    companyName: '(주)청솔로지스틱스',
    year: 2025,
    industryCode: 'retail_logis',
    extraIndustries: [],
    track: 'kosha_etc',
    selectedHazards: ['m_forklift', 'm_truck', 'm_ladder'],
    workerCount: 24,
    status: 'archive',
    roundCount: 3,
    source: '과거 수행이력 아카이브',
    consultantName: '점검노무사 공인노무사',
    summaryNote: '물류창고 지게차 보행통로 분리·도크 고임목 체계구축 완료',
  },
  'sf_sfco-3_2026': {
    id: 'sf_sfco-3_2026',
    entityType: 'Project',
    schemaVersion: 1,
    contractVersion: 1,
    createdAt: NOW - 864e5 * 10,
    updatedAt: NOW - 7200e3,
    revision: 1,
    companyId: 'sfco-3',
    companyName: '푸른샘종합사회복지관',
    year: 2026,
    industryCode: 'medical_welfare',
    extraIndustries: ['service_fac'],
    track: 'welfare_pub',
    selectedHazards: ['m_ladder'],
    workerCount: 42,
    status: 'active',
    roundCount: 2,
    source: '복지·공공 연계',
    consultantName: '점검노무사 공인노무사',
    summaryNote: '방문돌봄 폭언·폭행 보호지침, 감염예방·근골격계 부담작업 개선',
  },
};

const checks = {
  'sf_sfco-1_2026': {
    main: {
      id: 'main',
      projectId: 'sf_sfco-1_2026',
      entityType: 'Document',
      schemaVersion: 1,
      contractVersion: 1,
      createdAt: NOW - 864e5 * 18,
      updatedAt: NOW - 3600e3,
      revision: 1,
      companyId: 'sfco-1',
      companyName: '(주)한가람금속정밀',
      pre: {
        pre_01: { status: 'ok', note: '38인 중처법 적용' },
        pre_02: { status: 'ok', note: '기수혜 없음' },
        pre_03: { status: 'ok' },
        pre_04: { status: 'ok' },
        pre_05: { status: 'fix', note: '아차사고 대장 보완' },
      },
      core7: {
        c1_1: { status: 'ok' },
        c1_2: { status: 'ok' },
        c2_1: { status: 'ok' },
        c3_3: { status: 'fix', note: '크레인 훅 해지장치 점검' },
        c4_5: { status: 'no', note: 'LOTO 잠금장치 2개 추가 필요' },
      },
      industry: {
        mh_01: { status: 'fix', note: '프레스 광전자장치 감도점검' },
        mh_02: { status: 'ok' },
      },
      hazards: {
        m_forklift_4: { status: 'fix', note: '전용통로 바닥 도색 보강' },
      },
      docs: {
        policy_org: { status: 'ok' },
        risk_proc: { status: 'ok' },
        emergency: { status: 'fix' },
      },
      riskItems: [
        { id: 'hz-1', process: '지게차 하역장', factor: '보행자 작업반경 혼재 충돌 위험', level: '상', measure: '보행통로 분리 및 후방경보·경광등 점검', status: '진행중' },
        { id: 'hz-2', process: '유압 프레스 2호기', factor: '이물 제거 중 운전정지 미실시 끼임', level: '상', measure: 'LOTO 잠금장치 및 조작금지 표지 의무화', status: '개선완료' },
      ],
    },
  },
};

const intake = {
  'sf_sfco-1_2026': {
    'sfin-1': {
      id: 'sfin-1',
      projectId: 'sf_sfco-1_2026',
      entityType: 'Document',
      schemaVersion: 1,
      contractVersion: 1,
      createdAt: NOW - 864e5 * 12,
      updatedAt: NOW - 864e5 * 12,
      analyzedAt: NOW - 864e5 * 12,
      revision: 1,
      companyId: 'sfco-1',
      companyName: '(주)한가람금속정밀',
      title: '금속가공 공정별 위험성평가 기초표 (비식별)',
      docKind: 'risk_proc',
      docKindName: '3. 위험성평가 절차서·지침 및 실시 결과표',
      source: 'local',
      piiStripped: true,
      maskedExcerpt: '[사업장] 프레스 및 지게차 운반공정 유해위험요인 12건 도출 및 감소대책 수립',
      summaryLines: ['[3. 위험성평가 절차서] 비식별 분석 완료', '위험요인 2건 매트릭스 반영'],
    },
  },
};

module.exports = {
  data: {
    scal_safety: {
      projects,
      checks,
      intake,
      reports: {},
      snapshots: {},
    },
    data: {
      companies: { v: companies },
      consultings: { v: [] },
      biz_cons_types: { v: [{ id: 'bct-sf', name: '산업안전컨설팅' }] },
    },
    scal_cos: {},
    scal_types: {},
    mailbox: {
      folders: {
        inbox: { kind: 'inbox', name: '받은편지함' },
        '5_산재 및 산안 등-seed': { kind: 'custom', name: '5_산재 및 산안 등' },
      },
      msgs: {
        inbox: {
          '701': { u: 701, s: '[(주)한가람금속정밀] 2026년 안전보건관리체계 구축 사전점검 자료', f: '안전관리팀', e: 'safety@hangaram.example', t: 'p001@pureun.kr', d: NOW - 864e5 * 15, a: 2, an: ['위험성평가표.xlsx', '안전보건관리규정.hwpx'] },
        },
      },
    },
  },
  views: [
    { name: 'check',  run: async (p) => { await p.click('#tabs button[data-tab="check"]'); } },
    { name: 'intake', run: async (p) => { await p.click('#tabs button[data-tab="intake"]'); } },
    { name: 'report', run: async (p) => { await p.click('#tabs button[data-tab="report"]'); } },
    { name: 'guide',  run: async (p) => { await p.click('#tabs button[data-tab="guide"]'); } },
  ],
};
