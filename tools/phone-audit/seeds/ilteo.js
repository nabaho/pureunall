/* 일터상생혁신 자동화(ilteo.html) 폰 점검 자료 — 모두 지어낸 합성 값이다.
 *
 * 읽는 자리: scal_ilteo(projects · intake · mid · final · snapshots) ·
 *           data/companies/v · data/consultings/v · data/biz_cons_types/v ·
 *           scal_cos · scal_types · scal_scheds · mailbox/folders · mailbox/msgs
 */
'use strict';

const NOW = Date.UTC(2026, 10, 15, 2, 0, 0);
const MID_AT = NOW - 864e5 * 7;

const companies = [
  { id: 'ico-1', name: '(주)가나상생정밀테크', bizNo: '123-81-20045', email: 'hr@gana-ilteo.example', bizType: '정밀기계 제조업', status: 'active' },
  { id: 'ico-2', name: '(주)다라혁신모빌리티', bizNo: '123-81-20059', email: 'people@dara-innov.example', bizType: '자동차부품 제조업', status: 'active' },
  { id: 'ico-3', name: '(주)마바파트너스물류', bizNo: '123-81-20063', email: 'admin@maba-partner.example', bizType: '스마트물류 서비스업', status: 'active' },
];

const consultings = [
  {
    id: 'cons-ilt-3',
    companyId: 'ico-3',
    companyName: '(주)마바파트너스물류',
    bizNo: '123-81-20063',
    bizName: '2026년 일터혁신 상생컨설팅',
    year: 2026,
  },
];

const projects = {
  'ilt-1': {
    id: 'ilt-1', entityType: 'Project', schemaVersion: 1, contractVersion: 1,
    createdAt: NOW - 864e5 * 25, updatedAt: NOW - 3600e3, revision: 4,
    companyId: 'ico-1', companyName: '(주)가나상생정밀테크', bizNo: '123-81-20045',
    year: 2026, level: 'deep', industry: '정밀기계 제조업', workerCount: 68,
    contactEmails: ['hr@gana-ilteo.example'],
    consultantName: '점검노무사 공인노무사',
    selectedTasks: ['wt_45day', 'wg_redesign'],
    designTeamCount: 5,
    midConfirmedAt: MID_AT,
    interviews: {
      exec: '업무집중시간제 도입을 전제로 격주 금요일 오후 단축근무 긍정 검토, 통상임금 법적 리스크 선제적 해소 희망',
      hr: '연장근로 사전승인제 정착 및 기본급·제수당 체계 단순화, 취업규칙 신구대조표 정비 요청',
      worker: '임금 총액 감소 없는 근로시간 단축과 자유로운 연차 사용 분위기 정착 희망',
    },
  },
  'ilt-2': {
    id: 'ilt-2', entityType: 'Project', schemaVersion: 1, contractVersion: 1,
    createdAt: NOW - 864e5 * 10, updatedAt: NOW - 7200e3, revision: 1,
    companyId: 'ico-2', companyName: '(주)다라혁신모빌리티', bizNo: '123-81-20059',
    year: 2026, level: 'pro', industry: '자동차부품 제조업', workerCount: 42,
    contactEmails: ['people@dara-innov.example'],
    consultantName: '점검노무사 공인노무사',
    selectedTasks: ['wt_mgmt', 'cu_balance'],
    designTeamCount: 4,
  },
};

const intake = {
  'ilt-1': {
    'in-roster': {
      id: 'in-roster', projectId: 'ilt-1', entityType: 'Document', schemaVersion: 1, contractVersion: 1,
      createdAt: NOW - 864e5 * 20, updatedAt: NOW - 864e5 * 20, analyzedAt: NOW - 864e5 * 20, checkedAt: NOW - 864e5 * 20, revision: 1,
      companyId: 'ico-1', companyName: '(주)가나상생정밀테크',
      source: 'upload', title: '인력현황_및_3개년입퇴사_점검용.xlsx', phase: 'pre_mid', docKind: 'org_roster', track: 'quant', piiStripped: true,
      stats: {
        activeCount: 68, regularCount: 62, nonRegularCount: 6, nonRegularPct: 8.8, shortTenurePct: 35.3, activityGrantEligible: true,
        topDepts: [{ dept: '생산기술본부', count: 34, pct: 50.0 }, { dept: '품질연구소', count: 20, pct: 29.4 }, { dept: '경영지원팀', count: 14, pct: 20.6 }],
        turnover3Y: [{ year: 2024, hires: 11, leaves: 9, leaveRatePct: 13.2 }, { year: 2025, hires: 14, leaves: 8, leaveRatePct: 11.8 }, { year: 2026, hires: 9, leaves: 4, leaveRatePct: 5.9 }],
      },
      summaryLines: ['재직 인원 총 68명 (정규직 62명 · 기간제 6명) · 100인 미만 활동비 지원 대상'],
    },
    'in-post-1': {
      id: 'in-post-1', projectId: 'ilt-1', entityType: 'Document', schemaVersion: 1, contractVersion: 1,
      createdAt: NOW - 864e5 * 2, updatedAt: NOW - 864e5 * 2, analyzedAt: NOW - 864e5 * 2, checkedAt: NOW - 864e5 * 2, revision: 1,
      companyId: 'ico-1', companyName: '(주)가나상생정밀테크',
      source: 'mail', mailKey: 'i:inbox:502', title: '중간보고 피드백 및 주4.5일제 찬반투표 결과 회신', phase: 'post_mid', docKind: 'worker_consent', track: 'text', piiStripped: true,
      postDiff: {
        adoptedModel: '격주 금요일 오후 4시간 단축형 주4.5일제',
        wageAgreement: '임금 100% 보전 및 고정연장수당 기본급 전환',
        effectiveDate: '2026년 12월 1일',
        targetScope: '전 부서 상시 근로자',
        voteTotal: 68, voteYes: 59, votePct: 86.8,
        requests: ['생산기술본부 교대조는 월 단위로 금요일 단축 일정을 사전 편성하도록 문구 반영 요청'],
      },
      summaryLines: ['합의 모델: 격주 금요일 오후 4시간 단축형 주4.5일제', '근로자 찬반투표 찬성률 86.8% (68명 중 59명 찬성)'],
    },
  },
};

const mailboxFolders = {
  inbox: { kind: 'inbox', name: '받은편지함' },
  sent: { kind: 'sent', name: '보낸편지함' },
};

const mailboxMsgs = {
  inbox: {
    '501': { u: 501, s: '[(주)가나상생정밀테크] 취업규칙 및 임금대장 기초자료 송부의 건', f: '인사팀', e: 'hr@gana-ilteo.example', t: 'p001@pureun.kr', d: NOW - 864e5 * 18, a: 2, an: ['취업규칙_점검용.hwpx', '임금대장_점검용.xlsx'] },
    '502': { u: 502, s: '[(주)가나상생정밀테크] 중간보고 피드백 및 근로자 찬반투표 결과 송부', f: '인사팀', e: 'hr@gana-ilteo.example', t: 'p001@pureun.kr', d: NOW - 864e5 * 2, a: 2, an: ['디자인팀협의록.hwpx', '찬반투표집계표.pdf'] },
    '503': { u: 503, s: '[(주)가나상생정밀테크] 5회차 수행 타임스탬프 사진 및 참석자 서명지 송부', f: '인사팀', e: 'hr@gana-ilteo.example', t: 'p001@pureun.kr', d: NOW - 864e5 * 1, a: 3, an: ['5회차_시작사진.jpg', '5회차_종료사진.jpg', '5회차_서명지.pdf'] },
  },
};

module.exports = {
  data: {
    scal_ilteo: {
      projects: projects,
      intake: intake,
      mid: {},
      final: {},
      snapshots: {},
    },
    data: {
      companies: { v: companies },
      consultings: { v: consultings },
      biz_cons_types: { v: [{ id: 'bct-ilteo', name: '일터혁신 상생컨설팅' }] },
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
  ],
};
