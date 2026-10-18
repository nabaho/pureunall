/* 컨설팅보고서(gov-report.html) 폰 점검 자료 — 모두 지어낸 것이다.
 *
 * 이 앱은 정부사업일정과 같은 일정 자료(scal_staff·scal_types·scal_cos·scal_scheds)를 읽고,
 * 이알피 사업 목록(data/biz_cons_types)·사업 이음표(scal_erpTypeMap)·이알피 계약(data/consultings)·
 * 서류 진행 기록(scal_docs)을 겹쳐 «사업 대시보드»를 만든다. 일정 자료는 seeds/consult.js 것을 그대로 쓴다.
 * ⚠ 사람·업체는 지어낸 것. 사업 이름은 양식이 고를 낱말(현장클리닉·기술보호·일터혁신…)만 맞춘다.
 */
'use strict';

const consult = require('./consult.js');
const D = consult.data;

/* 이알피 사업 → 일정의 사업 종류(t1…t7) */
const BIZ = [
  { code: 'consulting-01', name: '현장클리닉', short: '클리닉', agency: '점검지원단(중기청)', sortOrder: 1 },
  { code: 'consulting-02', name: '일터상생혁신컨설팅', short: '일터', agency: '점검노사발전재단', sortOrder: 2 },
  { code: 'consulting-03', name: '통합기술보호지원단', short: '기술보호', agency: '점검지원단(중기청)', sortOrder: 3 },
  { code: 'consulting-04', name: '인사노무컨설팅점검상의', short: '인사노무', agency: '점검상공회의소', sortOrder: 4 },
  { code: 'consulting-05', name: '산업일자리전환컨설팅점검', short: '산일', agency: '점검경제진흥원', sortOrder: 5 },
  { code: 'consulting-06', name: '씨앗컨설팅점검센터', short: '씨앗', agency: '점검사회적경제지원센터', sortOrder: 6 },
  { code: 'consulting-07', name: '진단컨설팅점검', short: '진단', agency: '', sortOrder: 7 },
];
const TMAP = { 'consulting-01': 't3', 'consulting-02': 't1', 'consulting-03': 't4', 'consulting-04': 't7', 'consulting-05': 't2', 'consulting-06': 't6', 'consulting-07': 't5' };
const CODE_OF = Object.fromEntries(Object.entries(TMAP).map(([c, t]) => [t, c]));

/* 이알피 계약 — 업체마다 하나(일부는 일부러 없음) */
const CONS = {};
D.scal_cos.forEach((co, i) => {
  if (i % 6 === 5) return;
  const id = 'k' + (i + 1);
  CONS[id] = { id, companyName: co.name, bizNo: '000-00-' + String(10000 + i).slice(-5), typeCodes: { consulting: CODE_OF[co.types[0]] },
    programName: (BIZ.find(b => b.code === CODE_OF[co.types[0]]) || {}).name || '', startDate: '2026-03-01', endDate: '2026-12-31',
    status: 'active', managerMain: 'P001', amount: 9900000 + i * 1230000,
    contacts: [{ name: '점검연락' + (i + 1), phone: '010-0000-0000', isPrimary: true }] };
});

/* 서류 진행 기록 — 몇 곳은 진행·완료·막힘을 섞는다 */
const YEAR = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 4);
const DOCS = {};
D.scal_cos.slice(0, 18).forEach((co, i) => {
  const rid = co.types[0] + '_' + YEAR;
  const st = ['doing', 'done', 'na', 'doing'][i % 4];
  DOCS[co.id] = { [rid]: { items: {
    sign: { st, sentAt: YEAR + '-09-' + String(10 + (i % 18)).padStart(2, '0'), by: '점검대표', at: Date.now() - i * 864e5 },
    ...(i % 3 === 0 ? { submit: { st: 'done', gotAt: YEAR + '-10-01', how: 'mail', ack: true, by: '점검노무', at: Date.now() - 3 * 864e5, note: '접수 메일 받음' } } : {}),
  } } };
});

module.exports = {
  data: Object.assign({}, D, {
    scal_erpTypeMap: TMAP,
    scal_docs: DOCS,
    data: {
      biz_cons_types: { u: 1, v: BIZ },
      consultings: { u: 1, v: CONS },
      user_dir: { v: [
        { sid: 'P001', name: '점검대표', role: 'admin', status: 'active' },
        { sid: 'P002', name: '점검노무', role: 'staff', status: 'active' },
        { sid: 'P003', name: '점검사무장', role: 'staff', status: 'active' },
      ] },
    },
  }),
  views: [
    { name: 'all', run: async (p) => { await p.evaluate(() => grSetTab('all')); } },
    { name: 'biz', run: async (p) => { await p.evaluate(() => grSetBiz('consulting-01')); } },
    { name: 'biz-big', run: async (p) => { await p.evaluate(() => grSetBiz('consulting-02')); } },
    { name: 'board', run: async (p) => { await p.evaluate(() => grSetDashView('board')); },
      back: async (p) => { await p.evaluate(() => grSetDashView('table')); } },
    { name: 'toc', run: async (p) => { await p.evaluate(() => { grSetBiz('consulting-01'); grOpenToc('c03', 't3'); }); },
      back: async (p) => { await p.evaluate(() => grCloseToc()); } },
    { name: 'cell', run: async (p) => { await p.evaluate(() => grOpenCell('c03', 't3', 'sign')); }, wait: 2500,
      back: async (p) => { await p.evaluate(() => grCloseCell()); } },
    { name: 'gohome', run: async (p) => { await p.evaluate(() => grGoHome()); } },
  ],
};
