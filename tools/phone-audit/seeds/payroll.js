/* 폰 점검 — 급여관리(payroll-os.html) 지어낸 자료
 * ⚠ 모두 지어낸 것이다 — 업체는 「(주)가나다라…」, 사람은 「점검○○」. 주민번호·계좌는 넣지 않는다.
 * 자리: data/companies/v (업체관리 원본 — typeCode '급여'·managerMain 사번) ·
 *       payroll_os/{site_cards, payroll/sites(옛 모양 — 직원 표가 줄 안에), payroll_locked, attend, leave, sever}
 * 표가 «꽉 찼을 때»를 보려고 업체 30곳 · 한 곳에 12달 · 한 달에 직원 28명, 큰 금액을 섞는다. */
'use strict';

const 이름들 = [
  '(주)가나다라마바사아자차카타파하 주식회사', '점검상사', '(주)한빛정밀기계공업', '푸른점검물류', '가나식품',
  '(주)다라마건설산업개발', '마바사전자', '(주)아자차글로벌로지스틱스코리아', '카타파의료재단', '(주)하늘점검',
  '점검운수', '(주)누리점검산업', '바다점검수산', '(주)소망점검복지센터', '점검테크',
  '(주)가람점검', '(주)나래점검환경', '다온점검', '(주)라온점검서비스', '마루점검건축',
  '새별점검반찬 배방월천점', '새별점검반찬 모종점', '점검마트 하나로', '점검회관', '(주)점검나비',
  '점검앤드씨', '점검기술', '(주)점검에너지', '점검병원', '(주)점검유통',
];
const 담당 = ['P-001', 'P-002', 'P-001', 'P-003', 'P-001'];
const companies = 이름들.map((nm, i) => ({
  id: 'c' + String(i + 1).padStart(3, '0'), name: nm, typeCode: '급여', status: 'active',
  managerMain: 담당[i % 담당.length], managerSubs: i % 4 === 0 ? ['P-002'] : [],
}));

const 성 = ['점검', '시험', '견본', '보기'];
const 이름 = ['가나', '다라', '마바', '사아', '자차', '카타', '파하', '하늘', '바다', '누리'];
function 직원들(n, seed) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const 기본급 = 2156880 + ((i * 137 + seed * 31) % 40) * 85000 + (i === 0 ? 9800000 : 0);
    const 과세 = 기본급 + (i % 3) * 120000;
    const 소득세 = Math.round(과세 * 0.03 / 10) * 10, 지방세 = Math.floor(소득세 / 100) * 10;
    const 연금 = Math.round(과세 * 0.045), 건보 = Math.round(과세 * 0.03545), 장기 = Math.round(건보 * 0.1295), 고용 = Math.round(과세 * 0.009);
    const 공제 = 소득세 + 지방세 + 연금 + 건보 + 장기 + 고용;
    out.push({ 성명: 성[i % 4] + 이름[(i + seed) % 10] + (i >= 10 ? i : ''), 직책: i === 0 ? '대표이사' : (i % 5 === 0 ? '팀장' : '사원'),
      기본급, 식대: 200000, 과세총액: 과세, 지급총액: 과세 + 200000, 소득세, 지방세, 국민연금: 연금, 건강보험: 건보, 장기요양: 장기, 고용보험: 고용,
      공제총액: 공제, 실수령: 과세 + 200000 - 공제, 입사일: '20' + String(15 + (i % 10)) + '-0' + (1 + i % 9) + '-01' });
  }
  return out;
}
const sites = {}, locked = {}, cards = [], attend = {}, leave = {}, sever = {};
이름들.slice(0, 24).forEach((nm, si) => {
  const recs = [];
  for (let m = 1; m <= 12; m++) {
    const yy = m <= 9 ? 2026 : 2025;
    const 월 = m + '월';
    const sig = ['green', 'green', 'orange', 'green', 'red', 'green'][(m + si) % 6];
    recs.push({ id: 'r' + si + '_' + m, 월, 파일: nm + '_' + yy + '년 ' + m + '월 급여대장(최종).xlsx', 신호: sig, 표시신호: sig,
      직원수: 28, 직원: 직원들(si === 0 ? 28 : 6 + (si % 9), si + m), 이슈: sig === 'red' ? '최저임금 미달 1명' : '' });
    if (m <= 6 && sig !== 'red') locked[nm + '|' + 월] = Date.UTC(2026, m, 5);
  }
  sites[nm] = recs;
  cards.push({ 사업장: nm, 급여일: (si % 3 === 0 ? '익월 10일' : '당월 25일'), 산정기간: '1일~말일', 단수처리: '원 미만 절사', 확인필요: si % 5 === 0 ? '연장근로 시간 확인' : '' });
  for (let k = 0; k < 6; k++) {
    const who = 성[k % 4] + 이름[(k + si) % 10];
    attend[nm + '|9월|' + who] = { 연장: k * 2, 야간: k % 3, 휴일: k % 2 * 8, 결근: 0, 연차사용: k % 3 };
    leave[nm + '|' + who] = { 입사일: '2021-03-0' + (1 + k), 사용: k, 이월: 1 };
    if (k === 2) sever[nm + '|' + who] = { 퇴사일: '2026-08-31', 입사일: '2019-04-01' };
  }
});

module.exports = {
  data: {
    data: { companies: { v: companies } },
    payroll_os: {
      site_cards: cards, payroll_locked: locked, payslip_notice: '연차 사용 촉진 안내 — 9월 30일까지 사용 계획을 제출해 주세요.',
      payroll: { sites }, attend, leave, sever,
    },
  },
  views: [
    { name: 'co', run: async (page) => { await page.evaluate(() => openCo('c001')); } },
    { name: 'pay', run: async (page) => { await page.evaluate(() => pickTab('payroll')); } },
    { name: 'month', run: async (page) => { await page.evaluate(() => navTo({ month: '9월' })); } },
    { name: 'attend', run: async (page) => { await page.evaluate(() => { navTo({ month: null }); pickTab('attend'); }); } },
    { name: 'attm', run: async (page) => { await page.evaluate(() => navTo({ month: '9월' })); } },
    { name: 'leave', run: async (page) => { await page.evaluate(() => pickTab('leave')); } },
    { name: 'sever', run: async (page) => { await page.evaluate(() => pickTab('sever')); } },
    { name: 'slip', run: async (page) => { await page.evaluate(() => pickTab('slip')); } },
    { name: 'report', run: async (page) => { await page.evaluate(() => pickTab('report')); } },
    { name: 'tools', run: async (page) => { await page.evaluate(() => App.go('cards')); } },
  ],
};
