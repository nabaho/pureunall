/* 푸른이알피(erp) 폰 점검 자료 — 모두 «지어낸» 것이다.
 *
 * ⚠ 실제 고객·직원 이름·주민번호·계좌를 넣지 않는다. 사람은 「점검○○」, 업체는 「(주)가나다…」.
 * ⚠ 표가 «꽉 찼을 때» 를 보려고 목록마다 25줄 넘게, 긴 업체명·큰 금액·여러 상태를 섞는다.
 * 자료 꼴: 서버 data/<칸> = { u:시각, v:{ id:건 } } (건별 칸) · { u:시각, v:[…] } (통째 칸)
 *   ⚠ u 가 없으면 이알피가 «서버가 새롭지 않다»로 보고 안 받는다(_fbApplyRecordInner).
 * 인사관리(hr)·재무관리(fin) 는 같은 파일(pu-erp.html)이라 이 자료를 그대로 쓴다 — seeds/hr.js·fin.js.
 */
'use strict';

const U = Date.UTC(2026, 9, 18, 1, 0, 0);
const 성 = ['가나', '다라', '마바', '사아', '자차', '카타', '파하', '거너', '더러', '머버'];
const 꼬리 = ['산업', '테크놀로지', '물류서비스', '정밀기계공업', '푸드시스템', '건설엔지니어링', '바이오헬스케어', '디자인랩'];
function 업체명(i) {
  const a = 성[i % 성.length], b = 꼬리[i % 꼬리.length];
  // 셋에 하나는 아주 길게 — 폰에서 잘리는지 본다
  return i % 3 === 0 ? `(주)${a}${b}점검글로벌홀딩스제${i + 1}공장` : `(주)${a}${b}${i + 1}`;
}
function 사업자(i) { return `999-8${i % 10}-${String(10000 + i * 37).slice(-5)}`; }
function 날(m, d) { return `2026-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`; }
function 지도(arr) { const o = {}; arr.forEach(r => { o[r.id] = r; }); return o; }

/* ── 사람 30 — 재직·휴직·퇴직·입사예정을 섞는다 ── */
const 직책 = ['노무사', '사무장', '주임', '대리', '과장', '수습노무사'];
const 상태 = ['active', 'active', 'active', 'active', 'leave', 'retired', 'scheduled'];
const 사람 = [
  { sid: 'P001', name: '점검대표', role: 'admin', status: 'active', dept: '대표', pos: '대표노무사', rank: '대표', title: '대표노무사', hireDate: '2015-03-02', contractType: '정규직' },
  { sid: 'P002', name: '점검노무', role: 'staff', status: 'active', dept: '노무1팀', pos: '노무사', rank: '노무사', title: '노무사', hireDate: '2019-07-01', contractType: '정규직' },
  { sid: 'P003', name: '점검사무장', role: 'staff', status: 'active', dept: '경영지원', pos: '사무장', rank: '사무장', title: '사무장', hireDate: '2018-01-02', contractType: '정규직' },
];
for (let i = 4; i <= 30; i++) {
  const st = 상태[i % 상태.length];
  const t = 직책[i % 직책.length];
  사람.push({
    sid: 'P' + String(i).padStart(3, '0'), name: '점검' + ['가람', '나래', '다솜', '라온', '마루', '바다', '사랑', '아라', '자람'][i % 9] + (i > 12 ? i : ''),
    role: 'staff', status: st, dept: ['노무1팀', '노무2팀', '경영지원', '컨설팅팀'][i % 4], pos: t, rank: t, title: t,
    hireDate: st === 'scheduled' ? 날(11, 2) : `20${String(15 + (i % 10)).padStart(2, '0')}-0${1 + (i % 9)}-0${1 + (i % 8)}`,
    retireDate: st === 'retired' ? 날(9, 30) : '', contractType: i % 5 === 0 ? '계약직' : '정규직',
    contractEnd: i % 5 === 0 ? 날(12, 31) : '', branch: i % 4 === 0 ? '부산지사' : '본사',
    phone: '010-0000-' + String(1000 + i), email: `p${String(i).padStart(3, '0')}@pureun.kr`,
  });
}
const 담당 = sid => 사람[sid % 6].sid;

/* ── 업체 32 ── */
const 업체 = [];
for (let i = 0; i < 32; i++) {
  업체.push({
    id: 'co-pa' + i, entityType: 'company', name: 업체명(i), bizNo: 사업자(i), ceo: '점검대표자' + i,
    typeCode: ['자문', '급여', '노조', '기금'][i % 4], status: i % 9 === 8 ? 'closed' : 'active', suspended: i % 11 === 5,
    managerMain: 담당(i), managerSubs: i % 3 ? [담당(i + 1)] : [],
    startDate: 날(1 + (i % 9), 1 + (i % 27)), monthlyAdvisoryFee: [330000, 550000, 1100000, 2200000][i % 4],
    phone: '02-0000-' + String(2000 + i), address: '서울특별시 점검구 점검로 ' + (i + 1) + '길 ' + (100 + i) + ', 점검빌딩 ' + (i % 12 + 1) + '층',
    workers: 5 + i * 3, createdAt: '2026-0' + (1 + (i % 9)) + '-01T00:00:00.000Z',
  });
}

/* ── 계약 30 — 상담접수·계약협의·계약확정 ── */
const 계약종류 = ['company', 'case', 'consulting', 'fund', 'other', 'consult'];
const 계약 = [];
for (let i = 0; i < 30; i++) {
  const k = 계약종류[i % 계약종류.length];
  계약.push({
    id: 'ct-pa' + i, entityType: 'contract', contractNo: `계약-2026-${String(100 + i)}`,
    companyName: 업체명(i), clientName: 업체명(i), bizNo: 사업자(i), companyId: 'co-pa' + i,
    managerMain: 담당(i), managerSubs: i % 2 ? [담당(i + 2)] : [], kind: k, kinds: i % 4 === 0 ? [k, 'consulting'] : [k],
    // 실자료는 kinds 와 함께 늘 이 칸들을 갖는다(계약 창이 f.typeCodes[갈래] 를 읽는다).
    // ⚠ 빈 {} 는 파이어베이스가 안 담는다(가짜도 prune 으로 걷는다) — 갈래마다 '' · 0 을 넣어 둔다.
    typeCodes: Object.fromEntries((i % 4 === 0 ? [k, 'consulting'] : [k]).map(x => [x, ''])),
    amounts: Object.fromEntries((i % 4 === 0 ? [k, 'consulting'] : [k]).map(x => [x, 0])),
    briefs: Object.fromEntries((i % 4 === 0 ? [k, 'consulting'] : [k]).map(x => [x, '점검 메모'])),
    company: { name: 업체명(i), bizNo: 사업자(i), ceo: '점검대표자' + i, address: '', phone: '', email: '', fax: '', contacts: [{ name: '점검담당' + i }] },
    status: ['consult', 'review', 'signed'][i % 3], programName: ['일터혁신 컨설팅', '부당해고 구제신청', '근로복지기금 설립', '임금체계 개편 및 직무급 도입 컨설팅'][i % 4],
    contractFee: [3300000, 5500000, 11000000, 120000000][i % 4], consultDate: 날(10, 1 + (i % 17)), contractDate: 날(10, 1 + (i % 17)),
    note: i % 5 === 0 ? '담당자 회신 대기 — 견적서 다시 보냄. 다음 주 화요일 방문 예정' : '',
    createdAt: `2026-10-${String(1 + (i % 17)).padStart(2, '0')}T01:00:00.000Z`,
  });
}

/* ── 사건 28 ── */
const 사건 = [];
for (let i = 0; i < 28; i++) {
  사건.push({
    id: 'cs-pa' + i, entityType: 'case', caseNo: `사건-2026-${String(200 + i)}`, companyName: 업체명(i + 3), bizNo: 사업자(i + 3),
    managerMain: 담당(i + 1), managerSubs: i % 3 ? [담당(i + 3)] : [], typeCode: ['부당해고', '임금체불', '산재', '직장내괴롭힘'][i % 4],
    typeName: ['부당해고 구제신청', '임금체불 진정', '산업재해 보상 청구', '직장 내 괴롭힘 조사'][i % 4],
    status: ['progress', 'progress', 'pending', 'closed'][i % 4], jurisdiction: ['서울지방노동위원회', '중앙노동위원회', '근로복지공단 서울남부지사'][i % 3],
    receiveDate: 날(1 + (i % 9), 1 + (i % 27)), dueDate: 날(10, 18 + (i % 12)), retainerFee: [1100000, 2200000, 3300000][i % 3],
    successFee: [0, 5500000, 11000000][i % 3], workers: [{ name: '점검근로자' + i }], opponent: '점검상대방' + i,
    note: i % 4 === 1 ? '심문회의 일정 조율 중 — 이유서 초안 검토 요청' : '', createdAt: '2026-09-01T00:00:00.000Z',
  });
}

/* ── 컨설팅·기금·기타 각 26 ── */
function 사업(kind, pre, n, off) {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({
      id: `${pre}-pa${i}`, entityType: kind, no: `${pre.toUpperCase()}-2026-${String(300 + i)}`, companyName: 업체명(i + off), bizNo: 사업자(i + off),
      managerMain: 담당(i + off), managerSubs: i % 2 ? [담당(i + off + 1)] : [], status: ['progress', 'progress', 'pending', 'closed'][i % 4],
      programName: ['일터혁신 컨설팅(노사파트너십)', '근로복지기금 설립 지원', '직무분석 및 평가체계 구축', '청년 일자리 도약 장려금'][i % 4],
      contractDate: 날(1 + (i % 9), 1 + (i % 27)), startDate: 날(1 + (i % 9), 1 + (i % 27)), endDate: 날(12, 1 + (i % 27)),
      contractFee: [3300000, 8800000, 15400000, 125000000][i % 4], balanceFee: [0, 2200000, 4400000][i % 3],
      createdAt: '2026-08-01T00:00:00.000Z',
    });
  }
  return out;
}

/* ── 통장 묶음 1 — 이번 달 입금·출금 40줄 ── */
const 통장줄 = [];
for (let i = 0; i < 40; i++) {
  const inc = i % 3 !== 2;
  통장줄.push({
    src: 'bank', type: inc ? 'income' : 'expense', date: `${날(10, 1 + (i % 17))} ${String(9 + (i % 9)).padStart(2, '0')}:${String(10 + i).slice(-2)}`,
    amount: inc ? [330000, 550000, 1100000, 12345000, 2200000][i % 5] : [45000, 1280000, 9900, 3300000][i % 4],
    memo: inc ? (i % 4 === 0 ? '(주)가나산업점검글로벌' : i % 4 === 1 ? '점검자문료10월분' : i % 4 === 2 ? '더빌이체' : '다라테크놀로지') : (i % 2 ? '점검임대료' : '점검카드대금'),
    note: '',
  });
}
const 묶음 = { id: 'lb-pa1', by: 'P001', byName: '점검대표', at: '2026-10-17T01:00:00.000Z', fileName: '점검통장.xlsx', src: 'bank', from: 날(10, 1), to: 날(10, 17), n: 통장줄.length, rows: 통장줄 };

/* ── 입금·출금 기록 30 ── */
const 입금 = [], 출금 = [];
for (let i = 0; i < 30; i++) {
  입금.push({
    id: 'fi-pa' + i, date: 날(1 + (i % 10), 1 + (i % 27)), amount: [330000, 5500000, 12345000, 1100000][i % 4],
    category: ['inc-case-fee', 'inc-cons-fee', 'inc-advisory', 'inc-fund-fee'][i % 4], sourceKind: 'manual', sourceId: '',
    companyName: 업체명(i), kind: ['착수금', '성공보수', '자문료', '계약금'][i % 4], managerSid: 담당(i), managerName: '점검노무',
    perfShares: [], createdAt: '2026-10-01T00:00:00.000Z',
  });
  출금.push({
    id: 'fe-pa' + i, date: 날(1 + (i % 10), 1 + (i % 27)), amount: [45000, 1280000, 9900, 3300000][i % 4],
    category: ['exp-rent', 'exp-card', 'exp-misc', 'exp-salary'][i % 4], payee: i % 3 ? '점검임대인' : '(주)마바정밀기계공업점검거래처', memo: '점검출금' + i,
    createdAt: '2026-10-01T00:00:00.000Z',
  });
}

/* ── 나의 업무 — 오늘 할일·업무·일정 ── */
const 오늘 = '2026-10-18';
const 할일 = [], 업무 = [], 일정 = [];
for (let i = 0; i < 8; i++) 할일.push({ id: 'td-pa' + i, sid: 'P001', date: 오늘, title: i % 2 ? '점검 서류 확인 — ' + 업체명(i) : '전화 회신', done: i % 4 === 3 });
for (let i = 0; i < 26; i++) 업무.push({ id: 'wi-pa' + i, sid: 'P001', type: ['consult', 'labor', 'written', 'review', 'phone', 'visit', 'other'][i % 7], title: '점검업무 ' + (i + 1) + (i % 3 === 0 ? ' — 근로감독 대응 자료 정리 및 시정지시 이행 보고서 작성' : ''), companyName: 업체명(i), status: 'open', date: 날(10, 1 + (i % 17)), dueDate: 날(10, 18 + (i % 10)) });
for (let i = 0; i < 12; i++) 일정.push({ id: 'sc-pa' + i, sid: 'P001', date: 날(10, 1 + i * 2), title: '점검일정 ' + (i + 1), time: '10:00' });

const 출석 = [];
for (let i = 0; i < 26; i++) 출석.push({ id: 'at-pa' + i, sid: 사람[i % 10].sid, date: 날(10, 1 + (i % 17)), type: ['leave', 'trip', 'absent'][i % 3], memo: '점검근태' + i });

const data = {
  data: {
    user_accounts: { u: U, v: 사람 },
    user_dir: { u: U, v: 사람 },
    companies: { u: U, v: 지도(업체) },
    contracts: { u: U, v: 지도(계약) },
    cases: { u: U, v: 지도(사건) },
    consultings: { u: U, v: 지도(사업('consulting', 'cn', 26, 5)) },
    funds: { u: U, v: 지도(사업('fund', 'fd', 26, 7)) },
    other_projects: { u: U, v: 지도(사업('other', 'ot', 26, 9)) },
    ledger_batches: { u: U, v: { 'lb-pa1': 묶음 } },
    finance_income: { u: U, v: 지도(입금) },
    finance_expense: { u: U, v: 지도(출금) },
    attendance_records: { u: U, v: 지도(출석) },
    my_todos: { u: U, v: 할일 },
    my_work_items: { u: U, v: 업무 },
    my_schedules: { u: U, v: 일정 },
  },
};

/* 메뉴로 옮긴다 — 앱이 window.navigateTo(=selectMenu) 를 열어 둔다 */
function 메뉴(id, wait) {
  return { name: id.replace('/', '-'), wait: wait || 2500, run: async (page) => { await page.evaluate((m) => window.navigateTo(m), id); } };
}

/* 목록에서 한 건을 눌러 창을 연다 — 재고 나서 Esc 로 닫는다 */
function 창(name, text) {
  return {
    name, wait: 2000,
    run: async (page) => { await page.locator('main').getByText(text, { exact: false }).first().click({ timeout: 5000 }); },
    back: async (page) => { await page.keyboard.press('Escape'); await page.waitForTimeout(300); await page.keyboard.press('Escape'); },
  };
}

module.exports = {
  data,
  views: [
    메뉴('biz/contract'),
    창('contract-open', '파하바이오헬스케어점검글로벌홀딩스제7공장'),   // 계약 카드는 (주) 를 ㈜ 로 줄여 그린다
    메뉴('biz/company'),
    /* 폰 카드의 ☐ 를 눌러 «N건 선택» 줄이 뜨는지 본다 — 재고 나서 도로 푼다 */
    { name: 'company-pick', wait: 1200,
      run: async (page) => { await page.locator('main input[type=checkbox]').nth(1).click(); await page.locator('main input[type=checkbox]').nth(2).click(); },
      back: async (page) => { await page.getByText('✕ 선택 해제').click().catch(() => {}); } },
    창('company-open', '(주)파하바이오헬스케어점검글로벌홀딩스제7공장'),
    메뉴('biz/case'),
    창('case-open', '사건-2026-208'),
    메뉴('biz/consulting'),
    메뉴('biz/fund'),
    메뉴('biz/other'),
    메뉴('biz/closed'),
    { name: 'menu', run: async (page) => { await page.click('.hd-burger'); }, back: async (page) => { await page.click('.sb-overlay').catch(() => {}); } },
  ],
  메뉴,
  창,
};
