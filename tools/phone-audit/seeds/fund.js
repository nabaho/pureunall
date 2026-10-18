/* 폰 점검 — 기금관리(fund.html) 지어낸 자료
 * ⚠ 모두 지어낸 것이다 — 기금·업체·사람 이름은 「점검○○」, 번호는 9로 시작하는 가짜.
 * 자리: fund_erp/funds/{FUND-NNNN} · sites/{fid}/{sid} · txns/{fid}/{yr}/{id} · billings
 * 표가 «꽉 찼을 때»를 보려고 기금 32개(지역·공동·사내·지난) · 한 기금에 참여사업장 28곳 · 거래 40줄. */
'use strict';

const 지역 = ['충남', '충남', '충남', '경기', '경기', '충남', '경기', '충남'];
const 담당 = [{ sid: 'P001', name: '점검대표' }, { sid: 'P002', name: '점검노무' }, { sid: 'P003', name: '점검사무장' }];
const funds = {};
for (let i = 1; i <= 32; i++) {
  const id = 'FUND-' + String(i).padStart(4, '0');
  const type = i <= 18 ? '공동' : (i <= 26 ? '공동' : '사내');
  const region = i <= 18 ? 지역[i % 지역.length] : '';
  const short = i <= 18 ? region + ' ' + i + '호 점검' + (i % 4 === 0 ? '더행복한 상생' : '') + '기금'
    : (i <= 26 ? '점검공동' + i + '기금' : '(주)점검' + i + '사내근로복지기금');
  funds[id] = {
    name: (i <= 18 ? region + ' ' + i + '호 더행복한 ' + region + ' 공동근로복지기금' : short + ' 법인'),
    short_name: short, region, fund_type: type, lifecycle: i === 30 ? '계약종료' : '운영',
    setup_stage: i === 31 ? '설립준비' : '', mgr_main: 담당[i % 3], mgr_subs: i % 4 === 0 ? [담당[(i + 1) % 3]] : [],
    chairman: '점검위원' + i, address: '충청남도 점검시 가나구 다라로 ' + (100 + i) + '번길 ' + i + ', 3층 (점검동, 가나다빌딩)',
    inka_no: i % 3 ? '제2026-' + i + '호' : '', inka_date: i % 3 ? '2020-0' + (1 + i % 9) + '-15' : '',
    corp_reg_no: i % 2 ? '9' + String(100000 + i) + '-0000' + i : '', reg_date: i % 2 ? '2020-03-02' : '', tax_id_no: i % 5 ? '9' + String(10 + i) + '-82-' + String(10000 + i) : '',
    years: { 2026: { opening: { cash: 120000000 + i * 1000000 } } },
  };
}
// 참여사업장 — FUND-0001 에 28곳(긴 상호·긴 소재지·여러 업종)
const sites = { 'FUND-0001': {} };
const 업종 = ['제조업', '도소매업', '운수업', '서비스업', '건설업', '보건업 및 사회복지 서비스업'];
for (let k = 1; k <= 28; k++) {
  sites['FUND-0001']['S' + String(k).padStart(3, '0')] = {
    seq_label: String(k), name: k % 5 === 0 ? '(주)가나다라마바사아자차카타파하 점검' + k + '공장' : '점검' + k + '산업(주)',
    ceo: '점검대표' + k, biz_no: '9' + String(10 + k) + '-81-' + String(20000 + k), biz_type: 업종[k % 업종.length],
    company_size: [3, 12, 45, 160, 7, 1200][k % 6], partner: k % 7 === 0, lead: k === 1,
    contacts: [{ name: '점검담당' + k, title: '과장', mobile: '010-0000-' + String(1000 + k), email: 'pa' + k + '@example.test', isPrimary: true }],
    address: '충청남도 점검시 가나구 다라로 ' + k + '번길 ' + (k * 3) + ', ' + (k % 3 + 1) + '층',
  };
}
// 거래 — 2026년 40줄(입금·출금·미분류·승인 섞음)
const txns = { 'FUND-0001': { 2026: {} } };
let bal = 121000000;
for (let k = 1; k <= 40; k++) {
  const dep = k % 3 === 0 ? 0 : (k % 7 === 0 ? 85000000 : 1250000 + k * 13000);
  const wd = k % 3 === 0 ? 3200000 + k * 1000 : 0;
  bal += dep - wd;
  txns['FUND-0001'][2026]['T' + String(k).padStart(3, '0')] = {
    date: '2026-' + String(1 + (k % 9)).padStart(2, '0') + '-' + String(1 + (k % 27)).padStart(2, '0'),
    memo: k % 4 === 0 ? '점검' + k + '산업(주) 출연금 입금 — 2026년 상반기 분 (협력업체 근로자 복지 목적)' : (wd ? '복지사업 지원금 지급 점검' + k : '이자 입금'),
    deposit: dep, withdraw: wd, balance: bal,
    debit: k % 5 === 0 ? '' : (wd ? '목적사업비' : '보통예금'), credit: k % 5 === 0 ? '' : (wd ? '보통예금' : (k % 4 === 0 ? '출연금' : '이자수익')),
    approved: k % 2 === 0,
  };
}

module.exports = {
  data: { fund_erp: { funds, sites, txns } },
  views: [
    { name: 'gong', run: async (page) => { await page.evaluate(() => goHomeTab('개별공동')); } },
    { name: 'fund', run: async (page) => { await page.evaluate(() => go('fund', 'FUND-0001')); } },
    { name: 'sites', wait: 2500, run: async (page) => { await page.evaluate(() => goTab('sites')); } },
    { name: 'closing', wait: 2500, run: async (page) => { await page.evaluate(() => { S.year = 2026; goTab('closing'); }); } },
    { name: 'annual', wait: 2500, run: async (page) => { await page.evaluate(() => goTab('annual')); } },
    { name: 'billing', wait: 2500, run: async (page) => { await page.evaluate(() => go('billing')); } },
    { name: 'menu', run: async (page) => { await page.evaluate(() => toggleSide()); } },
  ],
};
