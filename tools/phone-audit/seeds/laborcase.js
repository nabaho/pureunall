/* 부당해고·노동사건관리(pu-case.html) 폰·데스크톱 점검 시드 — 모두 지어낸 합성 데이터 */
'use strict';

const NOW = Date.UTC(2026, 10, 28, 1, 0, 0);

const companies = [
  { id: 'lcco-1', name: '(주)가나점검테크', bizNo: '123-81-20033', status: 'active' },
  { id: 'lcco-2', name: '(주)다라점검서비스', bizNo: '123-81-20044', status: 'active' }
];

const erpCases = [
  {
    id: 'ec-lc-1', caseNo: '노동위-2026-009', typeCode: 'case-dismissal',
    companyId: 'lcco-1', companyName: '(주)가나점검테크',
    managerMain: 'P001', managerSubs: ['P002'], receiveDate: '2026-10-02'
  }
];

const laborCases = {
  'lc-1': {
    id: 'lc-1', entityType: 'Case', schemaVersion: 1, contractVersion: 1,
    createdAt: NOW - 864e5 * 25, updatedAt: NOW - 3600e3, revision: 2,
    erpCaseId: 'ec-lc-1', sourceKind: 'case', sourceId: 'ec-lc-1',
    domain: 'labor_dismissal', track: 'nlrc', subType: 'dismissal', subTypeLabel: '부당해고 구제', ourRole: 'employer',
    title: '(주)가나점검테크 (김해고) 부당해고 구제신청',
    companyId: 'lcco-1', companyName: '(주)가나점검테크', claimantName: '김해고',
    caseNo: '서울2026부해1234', jurisdiction: '서울지방노동위원회',
    year: 2026, receiveDate: '2026-10-02', actionDate: '2026-09-20',
    hearingDate: '2026-12-03', initialServedDate: '2026-11-22',
    status: '재심검토중', rulingResult: '일부인용',
    managerMain: 'P001', managerSubs: ['P002'],
    steps: {
      intake: { done: true, date: '2026-10-02' },
      petition_reason: { done: true, date: '2026-10-08' },
      answer_brief: { done: true, date: '2026-10-24' },
      evidence_prep: { done: true, date: '2026-11-01' },
      hearing: { done: true, date: '2026-11-12' },
      ruling_initial: { done: true, date: '2026-11-22' },
      re_appeal: { done: false, date: '' }
    },
    docs: [
      { id: 'ld-1', name: '신청인_이유서_1차.pdf', title: '신청인 이유서 1차', ext: 'pdf', date: '2026-10-08', side: 'opponent', roleLabel: '상대방(신청인) 서류', exhibitNo: '갑 제1호증', pairKey: '이유-답변', sourceOrigin: 'mail' },
      { id: 'ld-2', name: '피신청인_답변서_푸른.hwpx', title: '피신청인 답변서', ext: 'hwpx', date: '2026-10-24', side: 'ours', roleLabel: '당사 대응서류', exhibitNo: '을 제1호증', pairKey: '이유-답변', sourceOrigin: 'D', archiveRelPath: '2026/가나점검테크/부당해고_김해고/01_당사제출·대응서류/답변서.hwpx' },
      { id: 'ld-3', name: '서울지노위_초심판정서.pdf', title: '초심 판정서', ext: 'pdf', date: '2026-11-22', side: 'agency', roleLabel: '위원회 판정문', pairKey: '초심판정', outcomeSignal: 'partial', sourceOrigin: 'NAS' }
    ],
    mailLinks: [
      { id: 'inbox_601', slug: 'inbox', uid: '601', box: 'inbox', date: '2026-10-08', subject: '[(주)가나점검테크] 서울2026부해1234 신청인 이유서 송달 및 답변서 요청', from: '인사팀 <hr@gana-check.example>', attachmentNames: ['신청인_이유서_1차.pdf'] }
    ]
  },
  'lc-2': {
    id: 'lc-2', entityType: 'Case', schemaVersion: 1, contractVersion: 1,
    createdAt: NOW - 864e5 * 120, updatedAt: NOW - 864e5 * 50, revision: 1,
    domain: 'labor_wage', track: 'molab', subType: 'wage', subTypeLabel: '임금·퇴직금 체불', ourRole: 'employer',
    title: '(주)다라점검서비스 (최진정) 임금체불 진정사건',
    companyId: 'lcco-2', companyName: '(주)다라점검서비스', claimantName: '최진정',
    caseNo: '진정2026-55012', jurisdiction: '고용노동부 서울강남지청',
    year: 2026, receiveDate: '2026-07-01', correctionDueDate: '2026-12-01',
    status: '시정지시 대응', rulingResult: '시정지시',
    managerMain: 'P001', managerSubs: [],
    steps: { intake: { done: true }, petition_notice: { done: true }, rebuttal: { done: true }, correction: { done: false } },
    docs: [
      { id: 'ld-4', name: '고용노동지청_시정지시서.pdf', title: '시정지시서', ext: 'pdf', date: '2026-11-18', side: 'agency', roleLabel: '노동청 통지', sourceOrigin: 'mail' }
    ],
    mailLinks: []
  }
};

module.exports = {
  data: {
    labor_cases: { cases: laborCases, erp_sync: {}, erp_ack: {}, dismissed: {} },
    labor_secret: { 'lc-1': { id: 'lc-1', entityType: 'Document', strategyMemo: '점검용 합성 화해 하한 및 재심 대응 전략' } },
    harass_invest: { cases: { 'hc-ref-1': { id: 'hc-ref-1', companyId: 'lcco-1', companyName: '(주)가나점검테크', title: '사내 괴롭힘 신고 병행 조사', receiveDate: '2026-09-15' } } },
    data: {
      companies: { v: companies },
      cases: { v: erpCases },
      biz_case_types: { v: [{ code: 'case-dismissal', short: '부당해고', name: '부당해고 구제', sortOrder: 30 }] },
      user_dir: { P001: { name: '점검대표' }, P002: { name: '이부담당' } }
    },
    mailbox: {
      folders: { inbox: { kind: 'inbox', name: '받은편지함' }, sent: { kind: 'sent', name: '보낸편지함' } },
      msgs: {
        inbox: {
          '701': { u: 701, s: '[(주)다라점검서비스] 서울2026부노331 교섭해태 구제신청 이유서 접수', f: '총무팀', e: 'hr@dara-svc.example', t: 'p001@pureun.kr', d: NOW - 864e5 * 1, a: 1, an: ['구제신청서_점검용.pdf'], p: '구제신청서 송부드립니다.' }
        }
      },
      old: { msgs: {} }
    }
  },
  views: [
    { name: 'yearly', run: async (p) => { await p.click('#tabNav button[data-tab="yearly"]'); } },
    { name: 'counter', run: async (p) => { await p.click('#tabNav button[data-tab="counter"]'); } },
    { name: 'mail', run: async (p) => { await p.click('#tabNav button[data-tab="mail"]'); } },
    { name: 'detail', run: async (p) => { await p.click('#tabNav button[data-tab="detail"]'); } }
  ]
};
