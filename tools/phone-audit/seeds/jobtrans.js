/* 산업일자리전환 자동화(jobtrans.html) 폰·PC 화면 실측 점검용 합성 자료 — 모두 지어낸 값이다.
 *
 * 읽는 자리: scal_jobtrans(projects · intake · mid · final · snapshots) ·
 *           data/companies/v · data/consultings/v · data/biz_cons_types/v ·
 *           scal_cos · scal_types · scal_scheds · mailbox/folders · mailbox/msgs
 */
'use strict';

const NOW = Date.UTC(2026, 10, 15, 2, 0, 0);
const MID_AT = NOW - 864e5 * 7;

const companies = [
  { id: 'jtco-1', name: '(주)가나전환테크', bizNo: '123-81-31001', email: 'hr@gana-trans.example', bizType: '소재·정밀부품 제조업', status: 'active' },
  { id: 'jtco-2', name: '(주)다라모빌리티부품', bizNo: '123-81-31002', email: 'people@dara-mob.example', bizType: '자동차부품 제조업', status: 'active' },
  { id: 'jtco-3', name: '(주)마바에너지설비', bizNo: '123-81-31003', email: 'admin@maba-energy.example', bizType: '발전설비 정비업', status: 'active' },
];

const consultings = [
  {
    id: 'cons-jt-3',
    companyId: 'jtco-3',
    companyName: '(주)마바에너지설비',
    bizNo: '123-81-31003',
    bizName: '2026년 충남경제진흥원 산업일자리전환 전문컨설팅(석탄화력)',
    year: 2026,
  },
];

const projects = {
  'jt_co_syn_1_kmac_2026': {
    id: 'jt_co_syn_1_kmac_2026',
    entityType: 'Project',
    schemaVersion: 1,
    contractVersion: 1,
    createdAt: NOW - 864e5 * 24,
    updatedAt: NOW - 1800e3,
    revision: 3,
    companyId: 'jtco-1',
    companyName: '(주)가나전환테크',
    bizNo: '123-81-31001',
    year: 2026,
    agency: 'kmac',
    track: 'kmac_std',
    industry: '소재·정밀부품 제조업',
    mainProduct: '친환경 경량 하우징 모듈',
    transGoal: '내연기관 다이캐스팅 → 친환경 경량 전장 하우징 공정·직무 전환',
    workerCount: 74,
    contactEmails: ['hr@gana-trans.example'],
    consultantName: '점검노무사 공인노무사',
    selectedTasks: ['jt_impact', 'jt_survey', 'jt_job_redesign', 'jt_reskill', 'jt_gov_match'],
    tfTeamCount: 5,
    midConfirmedAt: MID_AT,
    interviews: {
      exec: '탄소중립·전동화 수주 확대에 맞춰 기존 주조라인 인력을 감원 없이 전장 가공·검사 직무로 재배치 희망',
      hr: '전환 대상 직무기술서(JD) 표준화 및 배치전환 기준 명확화를 위한 취업규칙 신구대조표 정비 요청',
      worker: '신규 설비 적응을 위한 사내 S-OJT 교육 시간 보장 및 전환 기간 임금 보전 기준 마련 희망',
    },
  },
  'jt_co_syn_2_cepa_2026': {
    id: 'jt_co_syn_2_cepa_2026',
    entityType: 'Project',
    schemaVersion: 1,
    contractVersion: 1,
    createdAt: NOW - 864e5 * 14,
    updatedAt: NOW - 3600e3,
    revision: 2,
    companyId: 'jtco-2',
    companyName: '(주)다라모빌리티부품',
    bizNo: '123-81-31002',
    year: 2026,
    agency: 'cepa',
    track: 'cepa_auto',
    industry: '자동차부품 제조업',
    mainProduct: '미래차 배터리 쿨링 브래킷',
    transGoal: '내연기관 배기부품 → 전기차 열관리 부품 라인 직무재교육 및 장려금 연계',
    workerCount: 48,
    contactEmails: ['people@dara-mob.example'],
    consultantName: '점검노무사 공인노무사',
    selectedTasks: ['jt_impact', 'jt_job_redesign', 'jt_reskill', 'jt_emp_stab', 'jt_gov_match'],
    tfTeamCount: 4,
    midConfirmedAt: MID_AT,
    interviews: {
      exec: '충남 내연기관 부품 물량 감소에 선제 대응하여 열관리 부품 신규 라인 조기 안정화 추진',
      hr: '충남 산업일자리전환 장려금 요건에 부합하는 직무전환 인원 산정 및 완료계 증빙 체계화 희망',
      worker: '전동화 부품 품질검사 자격 취득 지원 및 교대근무 피로도 완화 요청',
    },
  },
};

const intake = {
  'jt_co_syn_1_kmac_2026': {
    'in-fin-1': {
      id: 'in-fin-1',
      projectId: 'jt_co_syn_1_kmac_2026',
      entityType: 'Document',
      schemaVersion: 1,
      contractVersion: 1,
      createdAt: NOW - 864e5 * 20,
      updatedAt: NOW - 864e5 * 20,
      analyzedAt: NOW - 864e5 * 20,
      checkedAt: NOW - 864e5 * 20,
      revision: 1,
      companyId: 'jtco-1',
      companyName: '(주)가나전환테크',
      source: 'upload',
      title: '최근3개년_재무제표_점검용.xlsx',
      phase: 'pre_mid',
      docKind: 'biz_fin',
      track: 'quant',
      piiStripped: true,
      stats: {
        fin3Y: [
          { year: 2023, salesM: 14200, opProfitM: 920, netProfitM: 710 },
          { year: 2024, salesM: 13600, opProfitM: 740, netProfitM: 560 },
          { year: 2025, salesM: 14950, opProfitM: 1080, netProfitM: 840 },
        ],
        salesTrendPct: 5.3,
        unitLabel: '백만원',
      },
      summaryLines: ['최근 3개년 재무추이 집계: 2023년 매출 14,200백만원 → 2025년 매출 14,950백만원 (+5.3%)'],
    },
    'in-roster-1': {
      id: 'in-roster-1',
      projectId: 'jt_co_syn_1_kmac_2026',
      entityType: 'Document',
      schemaVersion: 1,
      contractVersion: 1,
      createdAt: NOW - 864e5 * 19,
      updatedAt: NOW - 864e5 * 19,
      analyzedAt: NOW - 864e5 * 19,
      checkedAt: NOW - 864e5 * 19,
      revision: 1,
      companyId: 'jtco-1',
      companyName: '(주)가나전환테크',
      source: 'upload',
      title: '조직직무인력현황_점검용.xlsx',
      phase: 'pre_mid',
      docKind: 'org_roster',
      track: 'quant',
      piiStripped: true,
      stats: {
        activeCount: 74,
        regularCount: 68,
        nonRegularCount: 6,
        nonRegularPct: 8.1,
        senior50Count: 19,
        senior50Pct: 25.7,
        shortTenurePct: 28.4,
        topDepts: [
          { dept: '생산가공본부', count: 38, pct: 51.4 },
          { dept: '전장품질팀', count: 22, pct: 29.7 },
          { dept: '경영지원팀', count: 14, pct: 18.9 },
        ],
        topJobs: [
          { job: '다이캐스팅·가공', count: 28, pct: 37.8 },
          { job: '전장모듈검사', count: 22, pct: 29.7 },
        ],
        turnover3Y: [
          { year: 2024, hires: 10, leaves: 8, leaveRatePct: 10.8 },
          { year: 2025, hires: 12, leaves: 7, leaveRatePct: 9.5 },
          { year: 2026, hires: 8, leaves: 4, leaveRatePct: 5.4 },
        ],
      },
      summaryLines: ['재직 근로자 총 74명 (정규직 68명 · 기간제 6명, 50세 이상 중장년 25.7%)'],
    },
    'in-post-1': {
      id: 'in-post-1',
      projectId: 'jt_co_syn_1_kmac_2026',
      entityType: 'Document',
      schemaVersion: 1,
      contractVersion: 1,
      createdAt: NOW - 864e5 * 2,
      updatedAt: NOW - 864e5 * 2,
      analyzedAt: NOW - 864e5 * 2,
      checkedAt: NOW - 864e5 * 2,
      revision: 1,
      companyId: 'jtco-1',
      companyName: '(주)가나전환테크',
      source: 'mail',
      mailKey: 'i:inbox:602',
      title: '중간보고 피드백 및 고용안정 노사 상생협약 동의 결과 송부',
      phase: 'post_mid',
      docKind: 'labor_accord',
      track: 'text',
      piiStripped: true,
      postDiff: {
        targetJobs: '주조가공직 → 친환경 전장하우징 정밀가공·검사직',
        transferHeadcount: 18,
        trainingProgram: '사내 S-OJT 40시간 및 폴리텍 전장품 품질관리 직무훈련 병행',
        accordSummary: '인위적 구조조정 없는 고용유지 및 전환 기간 임금 100% 보전 노사 상생협약',
        effectiveDate: '2026년 12월 1일',
        govAidTarget: '구조혁신 연계 사업전환자금 및 S-OJT 훈련지원',
        requests: ['중장년 전환 대상자 대상 디지털 측정장비 실습시간 8시간 추가 배정 요청'],
      },
      summaryLines: [
        '전환 대상 직무·인원 확정: 전장하우징 정밀가공·검사직 18명',
        '노사 상생협약 동의율 89.2% (74명 중 66명 동의)',
      ],
    },
  },
};

const mailboxFolders = {
  inbox: { kind: 'inbox', name: '받은편지함' },
  sent: { kind: 'sent', name: '보낸편지함' },
};

const mailboxMsgs = {
  inbox: {
    '601': { u: 601, s: '[(주)가나전환테크] 사업자등록증·재무제표·취업규칙 기초자료 송부', f: '인사팀', e: 'hr@gana-trans.example', t: 'p001@pureun.kr', d: NOW - 864e5 * 18, a: 3, an: ['사업자등록증.pdf', '3개년재무제표.xlsx', '취업규칙.hwpx'] },
    '602': { u: 602, s: '[(주)가나전환테크] 중간보고 피드백 및 노사 상생협약서 회신', f: '인사팀', e: 'hr@gana-trans.example', t: 'p001@pureun.kr', d: NOW - 864e5 * 2, a: 2, an: ['노동전환TF회의록.hwpx', '고용안정협약서.pdf'] },
    '603': { u: 603, s: '[(주)다라모빌리티부품] 충남 산업일자리전환 기초진단 자료 송부', f: '관리부', e: 'people@dara-mob.example', t: 'p001@pureun.kr', d: NOW - 864e5 * 11, a: 2, an: ['인력현황표.xlsx', '전환계획요약.hwp'] },
    '604': { u: 604, s: '[가나전환테크] 현장 사진 및 서명부 추가 전달', f: '담당자개인메일', e: 'worker123@naver.com', t: 'p001@pureun.kr', d: NOW - 864e5 * 1, a: 2, an: ['현장사진.jpg', '서명부.pdf'] },
  },
};

module.exports = {
  data: {
    scal_jobtrans: {
      projects: projects,
      intake: intake,
      mid: {},
      final: {},
      snapshots: {},
    },
    data: {
      companies: { v: companies },
      consultings: { v: consultings },
      biz_cons_types: { v: [{ id: 'bct-jt', name: '산업일자리전환 컨설팅' }] },
    },
    scal_cos: {},
    scal_types: {},
    scal_scheds: {},
    scal_docs: {},
    mailbox: {
      folders: mailboxFolders,
      msgs: mailboxMsgs,
    },
  },
  views: [
    { name: 'intake', run: async (p) => { await p.click('#tabs button[data-tab="intake"]'); } },
    { name: 'mid',    run: async (p) => { await p.click('#tabs button[data-tab="mid"]'); } },
    { name: 'final',  run: async (p) => { await p.click('#tabs button[data-tab="final"]'); } },
    {
      name: 'cepa-mid',
      run: async (p) => {
        await p.click('#tabs button[data-tab="mid"]');
        await p.selectOption('#p-mid select[data-proj-sel="1"]', 'jt_co_syn_2_cepa_2026');
      },
    },
    {
      name: 'cepa-final',
      run: async (p) => {
        await p.click('#tabs button[data-tab="final"]');
        await p.selectOption('#p-final select[data-proj-sel="1"]', 'jt_co_syn_2_cepa_2026');
      },
    },
  ],
};
