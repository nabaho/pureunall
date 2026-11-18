/* 업무 오케스트레이션(pu-orchestrator.html) 폰 점검 자료 — 모두 지어낸 합성 값이다.
 * 사업자등록번호는 123- 접두 규칙, 연락처는 010-0000-xxxx 규칙만 사용한다.
 */
'use strict';

const NOW = Date.UTC(2026, 10, 17, 2, 0, 0);

const companies = [
  { id: 'oco-1', name: '(주)가나테크놀로지', bizNo: '123-81-30011', puNo: 10201, typeCode: '자문', status: 'active', managerMain: 'P-001' },
  { id: 'oco-2', name: '(주)다라솔루션즈',   bizNo: '123-81-30025', puNo: 10202, typeCode: '급여', status: 'active', managerMain: 'P-002' },
];

const userDir = [
  { sid: 'P-001', name: '점검노무사', status: 'active' },
  { sid: 'P-002', name: '지원노무사', status: 'active' },
];

module.exports = {
  data: {
    data: {
      companies: { v: companies },
      user_dir: { v: userDir },
      contracts: {
        v: [
          { id: 'oct-1', companyId: 'oco-1', companyName: '(주)가나테크놀로지', stage: '상담접수', managerMain: 'P-001', createdAt: NOW - 864e5 * 8 },
          { id: 'oct-2', companyName: '(주)미연결샘플기업', companyLinkStatus: 'pending', stage: '계약협의', managerMain: 'P-002', createdAt: NOW - 864e5 * 2 },
        ],
      },
      contract_requests: {
        'creq-1': { id: 'creq-1', companyId: 'oco-1', companyName: '(주)가나테크놀로지', contractType: '노무자문 계약', status: 'pending', createdAt: NOW - 864e5 * 4, managerMain: 'P-001' },
      },
      cases: {
        v: [
          { id: 'oca-1', companyId: 'oco-1', companyName: '(주)가나테크놀로지', title: '부당해고 구제신청 사건', status: 'progress', managerMain: 'P-001', dueDate: '2026-11-19' },
        ],
      },
      consultings: {
        v: [
          { id: 'ocons-1', companyId: 'oco-2', companyName: '(주)다라솔루션즈', bizName: '2026년 일터혁신 상생컨설팅', status: 'progress', managerMain: 'P-002' },
        ],
      },
      funds: { v: [] },
    },
    work_erp: {
      items: {
        'wk-1': { id: 'wk-1', co_id: 'oco-1', co_name: '(주)가나테크놀로지', title: '취업규칙 동의절차 안내 발송', status: 'open', dueDate: '2026-11-18', mgr_main: { sid: 'P-001' } },
        'GA-oco-1-gp1': { id: 'GA-oco-1-gp1', co_id: 'oco-1', co_name: '(주)가나테크놀로지', title: '청년일자리 지원금 신청대행', status: 'open', mgr_main: { sid: 'P-001' } },
      },
    },
    pu_quotes: {
      'qt-1': { id: 'qt-1', co: '(주)다라솔루션즈', coKey: '123-81-30025', doc: 'quote', scope: '직무·임금체계 컨설팅', review: 'check', date: '2026-11-15' },
    },
    pucards: {
      ontIdx: {
        '1238199999': { company: '(주)서류도착기업', docs: ['bizreg'] },
      },
    },
  },
  views: [
    { name: 'companies', run: async (p) => { await p.click('#tabs button[data-tab="companies"]'); } },
    { name: 'runbooks',  run: async (p) => { await p.click('#tabs button[data-tab="runbooks"]'); } },
    { name: 'diag',      run: async (p) => { await p.click('#tabs button[data-tab="diag"]'); } },
  ],
};
