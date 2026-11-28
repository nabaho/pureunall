/* 산재사건관리(pu-sanjae.html) 폰·데스크톱 점검 시드 — 모두 지어낸 합성 데이터 */
'use strict';

const NOW = Date.UTC(2026, 10, 28, 1, 0, 0);

const companies = [
  { id: 'sjco-1', name: '(주)가나점검정밀공업', bizNo: '123-81-20011', status: 'active' },
  { id: 'sjco-2', name: '(주)다라점검물류시스템', bizNo: '123-81-20022', status: 'active' }
];

const erpCases = [
  {
    id: 'ec-sj-1', caseNo: '산재-2026-001', typeCode: 'case-injury',
    companyId: 'sjco-1', companyName: '(주)가나점검정밀공업',
    managerMain: 'P001', managerSubs: ['P002'], receiveDate: '2026-09-10', dueDate: '2026-12-20'
  }
];

const sanjaeCases = {
  'sj-1': {
    id: 'sj-1', entityType: 'Case', schemaVersion: 1, contractVersion: 1,
    createdAt: NOW - 864e5 * 20, updatedAt: NOW - 3600e3, revision: 2,
    erpCaseId: 'ec-sj-1', sourceKind: 'case', sourceId: 'ec-sj-1',
    domain: 'sanjae', subType: 'injury_disease', subTypeLabel: '업무상 질병·질판위', ourRole: 'worker',
    title: '(주)가나점검정밀공업 (이산재) 산재사건',
    companyId: 'sjco-1', companyName: '(주)가나점검정밀공업', claimantName: '이산재',
    caseNo: '산재2026-100234', jurisdiction: '근로복지공단 서울남부지사',
    year: 2026, receiveDate: '2026-09-10', disapprovalDate: '2026-10-15',
    status: '심사불복 진행중', rulingResult: '불승인',
    managerMain: 'P001', managerSubs: ['P002'],
    steps: {
      intake: { done: true, date: '2026-09-10' },
      facts: { done: true, date: '2026-09-14' },
      claim: { done: true, date: '2026-09-20' },
      review: { done: true, date: '2026-10-02' },
      decision: { done: true, date: '2026-10-15' },
      appeal: { done: false, date: '' },
      close: { done: false, date: '' }
    },
    docs: [
      { id: 'sd-1', name: '업무상질병_불승인_결정통지서.pdf', title: '업무상질병 불승인 결정통지서', ext: 'pdf', date: '2026-10-15', side: 'agency', roleLabel: '공단·위원회 판정', pairKey: '심사청구', outcomeSignal: 'lose', sourceOrigin: 'mail' },
      { id: 'sd-2', name: '원처분기관_재해조사_의견서.pdf', title: '원처분기관 의견서', ext: 'pdf', date: '2026-10-20', side: 'opponent', roleLabel: '상대방(원처분청) 서류', pairKey: '심사청구', sourceOrigin: 'D', archiveRelPath: '2026/가나점검정밀공업/산재_이산재/02_상대방제출서류/의견서.pdf' },
      { id: 'sd-3', name: '산재_심사청구_이유서_푸른.hwpx', title: '심사청구 이유서', ext: 'hwpx', date: '2026-11-05', side: 'ours', roleLabel: '당사 대응서류', pairKey: '심사청구', sourceOrigin: 'NAS', archiveRelPath: '2026/가나점검정밀공업/산재_이산재/01_당사제출·대응서류/심사청구이유서.hwpx' }
    ],
    mailLinks: [
      { id: 'inbox_401', slug: 'inbox', uid: '401', box: 'inbox', date: '2026-10-15', subject: '[(주)가나점검정밀공업] 요양급여 불승인 통지 및 심사청구 요청', from: '근로자 <worker@example.com>', attachmentNames: ['불승인결정통지서.pdf'] }
    ]
  },
  'sj-2': {
    id: 'sj-2', entityType: 'Case', schemaVersion: 1, contractVersion: 1,
    createdAt: NOW - 864e5 * 400, updatedAt: NOW - 864e5 * 300, revision: 1,
    domain: 'sanjae', subType: 'injury_accident', subTypeLabel: '업무상 사고', ourRole: 'employer',
    title: '(주)다라점검물류시스템 (박물류) 산재사건',
    companyId: 'sjco-2', companyName: '(주)다라점검물류시스템', claimantName: '박물류',
    caseNo: '산재2025-88210', jurisdiction: '근로복지공단 천안지사',
    year: 2025, receiveDate: '2025-05-12', status: '승인종결', rulingResult: '전부승인',
    managerMain: 'P001', managerSubs: [],
    steps: { intake: { done: true }, facts: { done: true }, claim: { done: true }, decision: { done: true }, close: { done: true } },
    docs: [
      { id: 'sd-4', name: '사업주_의견서_최종.pdf', title: '사업주 의견서', ext: 'pdf', date: '2025-05-18', side: 'ours', roleLabel: '당사 대응', sourceOrigin: 'D' }
    ],
    mailLinks: []
  }
};

module.exports = {
  data: {
    sanjae_cases: { cases: sanjaeCases, erp_sync: {}, erp_ack: {}, dismissed: {} },
    sanjae_secret: { 'sj-1': { id: 'sj-1', entityType: 'Document', strategyMemo: '점검용 합성 대응전략 메모' } },
    data: {
      companies: { v: companies },
      cases: { v: erpCases },
      biz_case_types: { v: [{ code: 'case-injury', short: '산재', name: '산재보상', sortOrder: 20 }] },
      user_dir: { P001: { name: '점검대표' }, P002: { name: '이부담당' } }
    },
    mailbox: {
      folders: { inbox: { kind: 'inbox', name: '받은편지함' }, sent: { kind: 'sent', name: '보낸편지함' } },
      msgs: {
        inbox: {
          '501': { u: 501, s: '[(주)다라점검물류시스템] 소음성 난청 장해급여 청구 및 질판위 심의 자료 송부', f: '인사팀', e: 'hr@dara-check.example', t: 'p001@pureun.kr', d: NOW - 864e5 * 2, a: 1, an: ['직업력조회.pdf'], p: '소음 노출 작업이력 자료 송부드립니다.' }
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
