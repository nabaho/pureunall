/* pu-union.html (노사관계·단체교섭) 폰 감사 & 로컬 미리보기용 합성 시드
   ※ 100% 가상 사업장·가상 이메일·가상 연락처(010-0000-xxxx)만 사용 */
const NOW = Date.UTC(2026, 10, 15, 9, 0, 0);

const companies = [
  { id: 'uco-1', name: '㈜푸른샘전자', puNo: 21001, bizType: '제조업', tel: '010-0000-1101' },
  { id: 'uco-2', name: '㈜새별물류서비스', puNo: 21002, bizType: '운수창고업', tel: '010-0000-1102' }
];

const userDir = {
  staffA: { sid: 'staffA', name: '홍노무사', email: 'staffa@pureun-sample.example' },
  staffB: { sid: 'staffB', name: '김노무사', email: 'staffb@pureun-sample.example' }
};

const cases = {
  'ur_seed_2026_1': {
    id: 'ur_seed_2026_1',
    entityType: 'Case',
    schemaVersion: 1,
    contractVersion: 1,
    revision: 2,
    createdAt: NOW - 864e5 * 45,
    updatedAt: NOW - 864e5 * 2,
    companyId: 'uco-1',
    companyName: '㈜푸른샘전자',
    year: '2026',
    title: '2026년 임금 및 단체교섭 (제4차 교섭 진행)',
    track: 'bargain',
    performMode: 'direct_bargain',
    status: 'active',
    unionName: '푸른샘전자노동조합',
    managerMain: 'staffA',
    managerSub: 'staffB',
    receiveDate: '2026-10-01',
    demandDate: '2026-10-05',
    disputeApplyDate: '',
    isPublicService: false,
    agreedDate: '',
    latestDate: '2026-11-13',
    steps: {
      intake:    { done: true, autoDone: true, manual: false, date: '2026-10-01', note: '교섭요구 수임' },
      channel:   { done: true, autoDone: true, manual: false, date: '2026-10-18', note: '교섭대표노조 확정' },
      demand:    { done: true, autoDone: true, manual: false, date: '2026-10-22', note: '노조 요구안 접수' },
      strategy:  { done: true, autoDone: false, manual: true, date: '2026-10-29', note: '법률검토 의견서 완료' },
      negotiate: { done: true, autoDone: true, manual: false, date: '2026-11-13', note: '4차 본교섭 진행중' },
      dispute:   { done: false, autoDone: false, manual: false, date: '', note: '' },
      agree:     { done: false, autoDone: false, manual: false, date: '', note: '' },
      close:     { done: false, autoDone: false, manual: false, date: '', note: '' }
    },
    rounds: [
      { roundNo: 1, date: '2026-10-25', kind: '상견례·기본합의', agenda: '교섭위원 및 기본원칙 합의', result: '기본합의서 체결' },
      { roundNo: 2, date: '2026-11-01', kind: '실무교섭', agenda: '임금인상률 및 근로시간 조항 설명', result: '자료 추가검토' },
      { roundNo: 3, date: '2026-11-08', kind: '본교섭', agenda: '기본급·수당 인상률 쟁점 조율', result: '사측 수정안 제시 예정' },
      { roundNo: 4, date: '2026-11-13', kind: '본교섭', agenda: '사측 수정안 2.8% 제시 및 휴가제도 논의', result: '검토 후 5차 교섭' }
    ],
    wageSim: { headcount: 145, monthlyBaseTotal: 460000000, demandRate: 6.2, offerRate: 2.8, agreedRate: 3.1, indirectRatio: 19.5 }
  },
  'ur_seed_2025_1': {
    id: 'ur_seed_2025_1',
    entityType: 'Case',
    schemaVersion: 1,
    contractVersion: 1,
    revision: 1,
    createdAt: NOW - 864e5 * 400,
    updatedAt: NOW - 864e5 * 300,
    companyId: 'uco-1',
    companyName: '㈜푸른샘전자',
    year: '2025',
    title: '2025년 임금협상 타결',
    track: 'wage',
    performMode: 'review_advisory',
    status: 'closed',
    unionName: '푸른샘전자노동조합',
    managerMain: 'staffA',
    receiveDate: '2025-03-10',
    demandDate: '2025-03-12',
    agreedDate: '2025-06-20',
    latestDate: '2025-06-25',
    steps: {
      intake:    { done: true, autoDone: true, manual: false, date: '2025-03-10', note: '요구 접수' },
      channel:   { done: true, autoDone: true, manual: false, date: '2025-03-20', note: '단일노조 확인' },
      demand:    { done: true, autoDone: true, manual: false, date: '2025-03-28', note: '요구안 수신' },
      strategy:  { done: true, autoDone: false, manual: true, date: '2025-04-05', note: '시뮬레이션' },
      negotiate: { done: true, autoDone: true, manual: false, date: '2025-06-12', note: '6차 본교섭' },
      dispute:   { done: false, autoDone: false, manual: false, date: '', note: '' },
      agree:     { done: true, autoDone: true, manual: false, date: '2025-06-20', note: '임금협약 체결' },
      close:     { done: true, autoDone: true, manual: false, date: '2025-06-25', note: '이행점검 완료' }
    }
  },
  'ur_seed_2026_2': {
    id: 'ur_seed_2026_2',
    entityType: 'Case',
    schemaVersion: 1,
    contractVersion: 1,
    revision: 1,
    createdAt: NOW - 864e5 * 20,
    updatedAt: NOW - 864e5 * 1,
    companyId: 'uco-2',
    companyName: '㈜새별물류서비스',
    year: '2026',
    title: '2026년 교섭창구단일화 · 쟁의조정 대응',
    track: 'single_ch',
    performMode: 'dispute_response',
    status: 'mediating',
    unionName: '새별물류복수노조',
    managerMain: 'staffB',
    receiveDate: '2026-10-20',
    demandDate: '2026-10-22',
    disputeApplyDate: '2026-11-10',
    isPublicService: false,
    latestDate: '2026-11-14',
    steps: {
      intake:    { done: true, autoDone: true, manual: false, date: '2026-10-20', note: '창구단일화 착수' },
      channel:   { done: true, autoDone: true, manual: false, date: '2026-11-04', note: '확정공고' },
      demand:    { done: true, autoDone: false, manual: true, date: '2026-11-06', note: '교섭요구안 수신' },
      strategy:  { done: true, autoDone: true, manual: false, date: '2026-11-08', note: '대응시나리오' },
      negotiate: { done: false, autoDone: false, manual: false, date: '', note: '' },
      dispute:   { done: true, autoDone: true, manual: false, date: '2026-11-10', note: '지노위 조정신청' },
      agree:     { done: false, autoDone: false, manual: false, date: '', note: '' },
      close:     { done: false, autoDone: false, manual: false, date: '', note: '' }
    }
  }
};

const docs = {
  ur_seed_2026_1: {
    ud_s1: { id: 'ud_s1', caseId: 'ur_seed_2026_1', entityType: 'Document', schemaVersion: 1, contractVersion: 1, revision: 1, createdAt: NOW - 864e5 * 30, updatedAt: NOW - 864e5 * 30, companyId: 'uco-1', companyName: '㈜푸른샘전자', year: '2026', group: 'progress', role: 'demand_notice', roleLabel: '교섭요구 공문', stepCode: 'channel', title: '2026_푸른샘전자_노조교섭요구안.hwpx', fileName: '2026_푸른샘전자_노조교섭요구안.hwpx', source: '메일 자동수집', reviewState: 'replied', docDate: '2026-10-22' },
    ud_s2: { id: 'ud_s2', caseId: 'ur_seed_2026_1', entityType: 'Document', schemaVersion: 1, contractVersion: 1, revision: 1, createdAt: NOW - 864e5 * 12, updatedAt: NOW - 864e5 * 12, companyId: 'uco-1', companyName: '㈜푸른샘전자', year: '2026', group: 'review', role: 'legal_opinion', roleLabel: '단협·임협 법률검토 의견서', stepCode: 'strategy', title: '2026_단협조항_법률검토의견서.docx', fileName: '2026_단협조항_법률검토의견서.docx', source: '직접 등록', reviewState: 'reviewing', docDate: '2026-11-03' },
    ud_s3: { id: 'ud_s3', caseId: 'ur_seed_2026_1', entityType: 'Document', schemaVersion: 1, contractVersion: 1, revision: 1, createdAt: NOW - 864e5 * 20, updatedAt: NOW - 864e5 * 20, companyId: 'uco-1', companyName: '㈜푸른샘전자', year: '2026', group: 'signed', role: 'channel_notice', roleLabel: '창구단일화 공고문', stepCode: 'channel', title: '교섭대표노조_확정공고문.hwpx', fileName: '교섭대표노조_확정공고문.hwpx', source: '생성 출력', reviewState: 'final', docDate: '2026-10-18' }
  },
  ur_seed_2026_2: {
    ud_s4: { id: 'ud_s4', caseId: 'ur_seed_2026_2', entityType: 'Document', schemaVersion: 1, contractVersion: 1, revision: 1, createdAt: NOW - 864e5 * 5, updatedAt: NOW - 864e5 * 5, companyId: 'uco-2', companyName: '㈜새별물류서비스', year: '2026', group: 'progress', role: 'dispute_doc', roleLabel: '쟁의조정 신청·답변·파업시나리오', stepCode: 'dispute', title: '노동쟁의조정_사용자측_답변서.hwpx', fileName: '노동쟁의조정_사용자측_답변서.hwpx', source: '로컬 파일', reviewState: 'replied', docDate: '2026-11-11' }
  }
};

const clauses = {
  ur_seed_2026_1: {
    uc_s1: {
      id: 'uc_s1', caseId: 'ur_seed_2026_1', entityType: 'Document', schemaVersion: 1, contractVersion: 1, revision: 1,
      createdAt: NOW - 864e5 * 15, updatedAt: NOW - 864e5 * 2,
      companyId: 'uco-1', companyName: '㈜푸른샘전자', year: '2026',
      articleNo: '제12조', category: 'union', topic: '근로시간면제(타임오프) 한도',
      currentText: '조합 전임자 1명(연 2,000시간) 이내 근로시간면제 부여',
      unionDemand: '타임오프 한도 연 3,000시간 확대 및 간부 교육시간 추가 부여',
      companyOffer: '법정 한도(연 2,000시간) 유지, 노사공동교육 연간 16시간 별도 인정',
      opinion: '노조법 제24조 초과 합의 시 부당노동행위 리스크 존재 — 법정 한도 준수 필요',
      state: 'discussed'
    },
    uc_s2: {
      id: 'uc_s2', caseId: 'ur_seed_2026_1', entityType: 'Document', schemaVersion: 1, contractVersion: 1, revision: 1,
      createdAt: NOW - 864e5 * 14, updatedAt: NOW - 864e5 * 2,
      companyId: 'uco-1', companyName: '㈜푸른샘전자', year: '2026',
      articleNo: '제34조', category: 'wage', topic: '기본급 및 직무수당 조정',
      currentText: '기본급 동결(전년도 협약 기준)',
      unionDemand: '기본급 6.2% 인상 및 위험수당 월 5만원 신설',
      companyOffer: '기본급 2.8% 인상 + 성과 연동 일시금 검토',
      opinion: '간접노동비 19.5% 반영 시 3% 내외 타결 시나리오 권장',
      state: 'pending'
    }
  }
};

module.exports = {
  data: {
    union_rel: { cases, docs, clauses, mails: {}, dismissed: {}, snapshots: {} },
    data: {
      companies: { v: companies },
      cases: { v: [] },
      user_dir: { v: userDir }
    },
    mailbox: {
      folders: {
        inbox: { kind: 'inbox', name: '받은편지함' },
        sent: { kind: 'sent', name: '보낸편지함' }
      },
      msgs: {
        inbox: {
          '801': { u: 801, s: '[㈜푸른샘전자] 2026년 4차 본교섭 사측안 검토 요청', f: '인사팀', e: 'hr@saem-sample.example', t: 'staffa@pureun-sample.example', d: NOW - 864e5 * 2, a: 1, an: ['4차교섭_신구대비표_검토안.xlsx'], p: '제4차 본교섭 사측 수정안 법률 검토 요청드립니다.' },
          '802': { u: 802, s: '[㈜가상의료재단] 2026년 임단협 노조 교섭요구 공문 송부', f: '총무팀', e: 'admin@med-sample.example', t: 'staffa@pureun-sample.example', d: NOW - 864e5 * 4, a: 1, an: ['2026_단체교섭_요구서.pdf'], p: '교섭요구사실 공고 및 창구단일화 절차 문의드립니다.' }
        }
      },
      old: { msgs: { v: {} } }
    }
  },
  views: [
    { name: 'workspace', run: async (p) => { await p.click('#tabs button[data-tab="workspace"]'); } },
    { name: 'mails',     run: async (p) => { await p.click('#tabs button[data-tab="mails"]'); } },
    { name: 'docs',      run: async (p) => { await p.click('#tabs button[data-tab="docs"]'); } },
    { name: 'review',    run: async (p) => { await p.click('#tabs button[data-tab="review"]'); } }
  ]
};
