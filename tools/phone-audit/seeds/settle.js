/* 컨설팅정산(pu-settle.html) 폰 점검 자료 — 모두 지어낸 것이다(공개 저장소). 사람은 seed.js 의 점검대표·점검노무·점검사무장. */
'use strict';
const C = require('../../../js/pu-settle-core.js');

const T0 = Date.UTC(2026, 9, 1, 0, 0, 0);
const TYPE = 'cons-ilteo';
const 업체 = ['(주)가나점검산업', '다라점검케미칼(주)', '(주)마바점검바이오', '(주)사아점검정밀 가나다라마바사아자차카타파하', '(주)자차점검', '(주)카타점검산업'];
const consultings = 업체.map((n, i) => ({ id: 'CS-' + (i + 1), typeCode: TYPE, companyName: n, companyId: 'CO-' + (i + 1), no: '일혁-2026-00' + (i + 1),
  startDate: '2026-0' + (6 + (i % 3)) + '-01', endDate: '2026-11-16' }));

/* 비용지급 안내 한 장 — 지급월 셋, 사업장마다 주관(점검대표) + 담당(점검노무 25% · 점검사무장 30%) */
const months = [{ key: '2026-07', label: '7월', col: 20 }, { key: '2026-09', label: '9월 (10/2 지급)', col: 21 }, { key: '2026-10', label: '10월', col: 22 }];
const rows = [];
업체.forEach((co, i) => {
  const mk = months[i % 3].key, staff = i % 2 ? '점검사무장' : '점검노무';
  const lead = 2568182 + i * 1000, st = 977273 + i * 500;
  rows.push({ line: 7 + i * 2, name: '점검대표', company: co, totalPre: lead * 2, amounts: { [mk]: lead } });
  rows.push({ line: 8 + i * 2, name: staff, company: co, totalPre: st * 2, amounts: { [mk]: st } });
});
const notice = { id: 'N-0001', entityType: 'SettleNotice', typeCode: TYPE, fileName: '비용지급 안내_점검(~10월) 가나다라마바사아자차카타파하.xlsx', receivedAt: T0 + 29 * 864e5,
  source: 'upload', months, rows, revision: 1, createdAt: T0, updatedAt: T0 };
notice.hash = C.noticeHash(rows);

const rule = { id: TYPE, entityType: 'SettleRule', typeCode: TYPE, mode: 'pool', title: '일터상생혁신', leadSid: 'P001', rates: { P002: 25, P003: 30 }, siteRates: {},
  msgHead: '', msgFoot: '', active: true, revision: 1, createdAt: T0, updatedAt: T0 };
const company = {}, person = {};
업체.forEach((co, i) => { if (i !== 5) company[C.linkKey(co)] = { id: C.linkKey(co), entityType: 'SettleLink', kind: 'company', text: co, consultingId: 'CS-' + (i + 1), companyId: 'CO-' + (i + 1) }; });
[['점검대표', 'P001'], ['점검노무', 'P002'], ['점검사무장', 'P003']].forEach(([n, s]) => { person[C.linkKey(n)] = { id: C.linkKey(n), entityType: 'SettleLink', kind: 'person', text: n, sid: s }; });
const ctx = { companyLinks: {}, personLinks: {}, actuals: {}, adjusts: [], names: { P001: '점검대표', P002: '점검노무', P003: '점검사무장' } };
Object.keys(company).forEach((k) => { ctx.companyLinks[k] = { consultingId: company[k].consultingId, companyId: company[k].companyId }; });
Object.keys(person).forEach((k) => { ctx.personLinks[k] = person[k].sid; });

const adjusts = {
  'A-1': { id: 'A-1', entityType: 'SettleAdjust', typeCode: TYPE, consultingId: 'CS-1', sid: 'P002', amount: -988987, memo: '1차 미정산분 이월 — 가나다라마바사아자차카타파하', appliedRunId: null, revision: 1, createdAt: T0, updatedAt: T0 },
  'A-2': { id: 'A-2', entityType: 'SettleAdjust', typeCode: TYPE, consultingId: 'CS-2', sid: 'P003', amount: 12000, memo: '끝수 맞춤', appliedRunId: TYPE + '_2026-09', revision: 1, createdAt: T0, updatedAt: T0 },
};
function run(mk, status) {
  const rid = C.runId(TYPE, mk), res = C.settleMonth(notice, mk, rule, ctx);
  const r = { id: rid, entityType: 'SettleRun', typeCode: TYPE, monthKey: mk, label: '2026년 ' + months.find((m) => m.key === mk).label, noticeId: notice.id, status,
    sites: res.sites, issues: res.issues, actuals: {}, changed: mk === '2026-09', transfers: [], revision: 2, createdAt: T0, updatedAt: T0 + 30 * 864e5 };
  if (status === 'confirmed') r.transfers = C.transfersOf(res.sites, 'P001').map((t, i) => Object.assign({ paid: i === 0, paidAt: i === 0 ? T0 + 30 * 864e5 : null, paidBy: i === 0 ? 'P001' : null }, t));
  return r;
}
const runs = {};
[['2026-07', 'manual'], ['2026-09', 'confirmed'], ['2026-10', 'draft']].forEach(([mk, st]) => { const r = run(mk, st); runs[r.id] = r; });

/* 재무관리 거래내역(입금 대조 «당겨오기») — 10월 사업장 주관 세후와 같은 금액 둘 + 가까운 금액 하나 + 관계없는 입금·지출 */
const net = (pre) => pre - C.withholding(pre).total;
const ledger_batches = { v: [{ id: 'lb-pa1', by: 'P001', at: '2026-10-31T01:00:00Z', fileName: '점검 거래문자', src: 'hana-sms', rows: [
  { _k: 'h1', type: 'income', src: 'bank', date: '2026-10-28 10:12', memo: '가나점검재단', note: '하나은행 문자 · ****1234', amount: net(2568182 + 2 * 1000) },
  { _k: 'h2', type: 'income', src: 'bank', date: '2026-10-28 10:13', memo: '가나점검재단', note: '하나은행 문자 · ****1234', amount: net(2568182 + 5 * 1000) - 20 },
  { _k: 'h3', type: 'income', src: 'bank', date: '2026-10-29 09:00', memo: '점검상사 자문료', note: '하나은행 문자 · ****1234', amount: 550000 },
  { _k: 'h4', type: 'expense', src: 'bank', date: '2026-10-29 12:00', memo: '사무실 임차료', amount: 1100000 },
] }] };

/* 직원 명부 — seed.js 의 세 사람 + 퇴사자 한 명(요율표 «+ 사람»·주관 고르기에 안 나와야 한다) */
const 명부 = [
  { sid: 'P001', name: '점검대표', role: 'admin', status: 'active' },
  { sid: 'P002', name: '점검노무', role: 'staff', status: 'active' },
  { sid: 'P003', name: '점검사무장', role: 'staff', status: 'active' },
  { sid: 'P009', name: '점검퇴사', role: 'staff', status: 'resigned' },
];

module.exports = {
  data: {
    data: {
      user_dir: { v: 명부 },
      user_accounts: { v: 명부 },
      ledger_batches,
      /* 개인입금 자동 연결 점검용 — 유형 스위치가 켜진 «가짜 일자리전환»(규칙 없음 → 빈 칸으로 올라온다) + 유형은 법인인데 이 건만 개인입금인 현장클리닉 한 건 */
      biz_cons_types: { v: [{ code: TYPE, short: '일혁', name: '일터상생혁신', agency: '노사발전재단' }, { code: 'cons-clinic', short: '클릭', name: '현장클리닉', agency: '' },
        { code: 'cons-jobs', short: '일자', name: '점검일자리전환', agency: '점검협회', personalDeposit: true },
        /* 개인입금 사업이 많을 때(실제 7개) 요율표가 창 폭 안에서 잘리지 않는지 보는 가짜 유형 — 이름은 길게 */
        ...['통합점검보호지원단', '점검기술지원컨설팅충남', '점검기초컨설팅푸른법인', '점검인사노무컨설팅북부상의', '점검사회적기업컨설팅', '점검노동전환컨설팅'].map((n, i) => ({ code: 'cons-pj' + i, short: 'P' + i, name: n, agency: '가짜기관' + i, personalDeposit: true }))] },
      consultings: { v: consultings.concat([{ id: 'CS-P1', typeCode: 'cons-clinic', personalDepositMode: 'on', companyName: '(주)점검개인입금', companyId: 'CO-P1', no: '클릭-2026-001', startDate: '2026-05-01', endDate: '2026-12-01' }]) },
    },
    /* rooms — 한 사람만 카톡 방이 있다(사람 줄의 «💬 방» 칩과 «방 없음» 등록 칸을 둘 다 본다) */
    settle: { rules: { [TYPE]: rule }, links: { company, person }, notices: { [notice.id]: notice }, runs, adjusts, rooms: { P002: { sid: 'P002', room: '점검노무 노무사(점검)' } } },
  },
  views: [
    { name: 'run', run: async (p) => { await p.click('#monthStrip [data-month="2026-10"]'); await p.click('#step2 [data-run]'); } },
    { name: 'sel', run: async (p) => { const c = await p.$$('#step2 input[data-ck]'); for (const x of c.slice(0, 2)) await x.click(); } },
    { name: 'sent', run: async (p) => { await p.click('#monthStrip [data-month="2026-09"]'); } },
    { name: 'inbox', run: async (p) => { await p.click('#inboxBtn'); } },
    { name: 'link', run: async (p) => { await p.click('#noticesBox [data-notice]'); } },
    { name: 'year', run: async (p) => { await p.click('#tabs button[data-tab=year]'); } },
    { name: 'msg', run: async (p) => { await p.click('#monthStrip [data-month="2026-10"]'); await p.click('#step3 .kchip'); } },
    { name: 'rules', run: async (p) => { await p.click('#tabs button[data-tab=setup]'); } },
    { name: 'kakao', run: async (p) => { await p.click('#subtabs button[data-sub=kakao]'); } },
  ],
};
