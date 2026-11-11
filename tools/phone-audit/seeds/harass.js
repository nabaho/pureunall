/* 괴롭힘·성희롱 조사(pu-harass.html) 폰 점검 자료 — 모두 지어낸 합성 값이다.
 *
 * 읽는 자리: harass_invest(cases · erp_sync · erp_ack · dismissed) · harass_secret ·
 *           data/companies/v · data/cases/v · data/biz_case_types/v · mailbox/folders · mailbox/msgs
 */
'use strict';

const NOW = Date.UTC(2026, 10, 11, 1, 0, 0);

const companies = [
  { id: 'hco-1', name: '(주)가나점검테크놀로지솔루션', bizNo: '000-00-20001', email: 'hr@gana-audit.example', status: 'active' },
  { id: 'hco-2', name: '(주)다라점검바이오헬스케어시스템즈', bizNo: '000-00-20002', email: 'audit@dara-check.example', status: 'active' },
  { id: 'hco-3', name: '점검물류센터(주) 중부사업장', bizNo: '000-00-20003', email: 'team@logis-audit.example', status: 'active' },
];

const erpCases = [
  {
    id: 'ec-hi-1', caseNo: '조사-2026-001', typeCode: 'case-investigate',
    companyId: 'hco-1', companyName: '(주)가나점검테크놀로지솔루션', bizNo: '000-00-20001',
    managerMain: 'P001', managerSubs: ['P002'], receiveDate: '2026-10-05', dueDate: '2026-11-20',
    status: 'progress', brief: '직장 내 괴롭힘 조사 (5/8단계 · 63%)',
  },
];

const harassCases = {
  'hc-1': {
    id: 'hc-1', entityType: 'Case', schemaVersion: 1, contractVersion: 1,
    createdAt: NOW - 864e5 * 10, updatedAt: NOW - 3600e3, revision: 3,
    erpCaseId: 'ec-hi-1', erpCaseNo: '조사-2026-001', sourceKind: 'case', sourceId: 'ec-hi-1',
    companyId: 'hco-1', companyName: '(주)가나점검테크놀로지솔루션', bizNo: '000-00-20001',
    category: 'harass', title: '생산품질본부 직장 내 괴롭힘 신고 외부전문가 조사 건',
    managerMain: 'P001', managerSubs: ['P002'],
    receiveDate: '2026-10-05', dueDate: '2026-11-20', closeDate: '',
    verdictSummary: 'partial',
    steps: {
      intake: { done: true, date: '2026-10-05', note: '조사 위임계약서 및 착수공문 접수 완료' },
      plan: { done: true, date: '2026-10-08', note: '조사계획서·출석요구 공문 발송' },
      pledge: { done: true, date: '2026-10-10', note: '비밀유지서약서 징구 완료' },
      victim: { done: true, date: '2026-10-14', note: '신고인 및 참고인 면담 완료' },
      accused: { done: true, date: '2026-10-21', note: '피신고인 소명 면담 및 반대질문권 부여' },
      witness: { done: false, date: '', note: '' },
      review: { done: false, date: '', note: '' },
      report: { done: false, date: '', note: '' },
    },
    mailLinks: [
      { key: 'i:inbox:101', slug: 'inbox', uid: '101', dir: 'in', date: '2026-10-05', ts: NOW - 864e5 * 30, from: '인사팀 <hr@gana-audit.example>', to: 'p001@pureun.kr', subject: '[(주)가나점검테크놀로지솔루션] 직장 내 괴롭힘 조사 위임계약서 송부의 건', docRole: 'quote_contract', stepCode: 'intake', attCount: 2, attNames: ['위임계약서.pdf', '조사요청공문.pdf'] },
      { key: 'i:sent:202', slug: 'sent', uid: '202', dir: 'out', date: '2026-10-08', ts: NOW - 864e5 * 27, from: '점검대표 <p001@pureun.kr>', to: 'hr@gana-audit.example', subject: '[(주)가나점검테크놀로지솔루션] 직장 내 괴롭힘 조사계획서 송부', docRole: 'official_plan', stepCode: 'plan', attCount: 1, attNames: ['조사계획서.hwp'] },
      { key: 'i:inbox:109', slug: 'inbox', uid: '109', dir: 'in', date: '2026-10-14', ts: NOW - 864e5 * 20, from: '인사팀 <hr@gana-audit.example>', to: 'p001@pureun.kr', subject: '[(주)가나점검테크놀로지솔루션] 신고인 피해진술서 제출', docRole: 'victim_stmt', stepCode: 'victim', attCount: 1, attNames: ['신고인진술서_점검용.pdf'] },
    ],
  },
  'hc-2': {
    id: 'hc-2', entityType: 'Case', schemaVersion: 1, contractVersion: 1,
    createdAt: NOW - 864e5 * 4, updatedAt: NOW - 7200e3, revision: 1,
    companyId: 'hco-2', companyName: '(주)다라점검바이오헬스케어시스템즈', bizNo: '000-00-20002',
    category: 'both', title: '연구소 직장 내 괴롭힘 및 성희롱 복합 조사 건',
    managerMain: 'P002', managerSubs: [],
    receiveDate: '2026-11-01', dueDate: '2026-12-10', closeDate: '',
    verdictSummary: '',
    steps: {
      intake: { done: true, date: '2026-11-01', note: '착수 공문 접수' },
    },
    mailLinks: [],
  },
};

const secrets = {
  'hc-1': {
    id: 'hc-1', entityType: 'Document', schemaVersion: 1, contractVersion: 1,
    createdAt: NOW - 864e5 * 5, updatedAt: NOW - 3600e3, revision: 2,
    overview: '생산품질본부 내 업무 배제 및 반복적 폭언 관련 외부전문가 조사 의뢰 건(점검용 합성 데이터).',
    interviews: [
      { id: 'iv-1', role: 'victim', alias: '신고인 가', dept: '품질관리파트', date: '2026-10-14', method: '대면면담', pledgeSigned: true, summary: '회의석상에서 반복적인 모욕성 발언과 메신저 방 배제가 있었다고 진술함.' },
      { id: 'iv-2', role: 'accused', alias: '피신고인 나', dept: '품질관리파트', date: '2026-10-21', method: '대면면담', pledgeSigned: true, summary: '납기 지연에 따른 업무 질책이었으나 표현이 과했음을 일부 인정함.' },
    ],
    issues: [
      { id: 'iss-1', title: '회의석상 폭언 및 모욕적 언동', whenWhere: '2026-09-12 본사 회의실', claimVictim: '다수 팀원 앞에서 인격 모독 발언 반복', claimAccused: '업무상 실수 지적 과정이었음', evidenceNote: '참고인 2명 진술 일치 및 회의록 확인', factStatus: 'recognized', elemSuperiority: 'yes', elemBeyondScope: 'yes', elemHarm: 'yes', verdict: 'yes' },
      { id: 'iss-2', title: '정기 프로젝트 배정 조정 건', whenWhere: '2026-09-20 사내 메신저', claimVictim: '의도적 업무 배제 주장', claimAccused: '전사 분기 순환배치 기준에 따른 조정', evidenceNote: '인사팀 순환배치 공문 확인', factStatus: 'partial', elemSuperiority: 'yes', elemBeyondScope: 'no', elemHarm: 'no', verdict: 'no' },
    ],
    conclusion: '쟁점 1은 근로기준법 제76조의2 요건을 모두 충족하여 직장 내 괴롭힘에 해당하며, 쟁점 2는 업무상 적정범위 내 인사조정으로 판단함.',
    recommendations: '피해근로자 희망 반영 부서 분리 유지 및 행위자 인사위원회 회부·재발방지 교육 권고.',
    reportBody: '',
  },
};

const mailboxFolders = {
  inbox: { kind: 'inbox', name: '받은편지함' },
  sent: { kind: 'sent', name: '보낸편지함' },
};

const mailboxMsgs = {
  inbox: {
    '301': { u: 301, s: '[(주)마바점검엔지니어링] 직장 내 괴롭힘 외부조사 견적서 및 제안서 요청의 건', f: '법무팀', e: 'legal@maba-audit.example', t: 'p001@pureun.kr', d: NOW - 864e5 * 3, a: 1, an: ['조사제안요청서.pdf'] },
    '302': { u: 302, s: '[(주)마바점검엔지니어링] 직장 내 괴롭힘 조사 위임계약서 송부', f: '법무팀', e: 'legal@maba-audit.example', t: 'p001@pureun.kr', d: NOW - 864e5 * 2, a: 1, an: ['위임계약서_점검용.hwp'] },
  },
};

module.exports = {
  data: {
    harass_invest: {
      cases: harassCases,
      erp_sync: {},
      erp_ack: {
        'hc-1': { id: 'hc-1', harassCaseId: 'hc-1', erpCaseId: 'ec-hi-1', erpCaseNo: '조사-2026-001', syncedRevision: 3, syncedAt: NOW - 1800e3 },
      },
      dismissed: {},
    },
    harass_secret: secrets,
    data: {
      companies: { v: companies },
      cases: { v: erpCases },
      biz_case_types: { v: [{ code: 'case-investigate', short: '조사', name: '조사', sortOrder: 100 }] },
    },
    mailbox: {
      folders: mailboxFolders,
      msgs: mailboxMsgs,
    },
  },
  views: [
    { name: 'inbox', run: async (p) => { await p.click('#tabs button[data-tab="inbox"]'); } },
    { name: 'detail', run: async (p) => { await p.click('#tabs button[data-tab="detail"]'); } },
    { name: 'report', run: async (p) => { await p.click('#tabs button[data-tab="report"]'); } },
  ],
};
