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

module.exports = {
  data: {
    data: {
      biz_cons_types: { v: [{ code: TYPE, short: '일혁', name: '일터상생혁신', agency: '노사발전재단' }, { code: 'cons-clinic', short: '클릭', name: '현장클리닉', agency: '' }] },
      consultings: { v: consultings },
    },
    settle: { rules: { [TYPE]: rule }, links: { company, person }, notices: { [notice.id]: notice }, runs, adjusts },
  },
  views: [
    { name: 'run', run: async (p) => { await p.click('#runsBox [data-run]'); } },
    { name: 'sel', run: async (p) => { const c = await p.$$('#runBox input[data-ck]'); for (const x of c.slice(0, 2)) await x.click(); } },
    { name: 'notices', run: async (p) => { await p.click('#tabs button[data-tab=notices]'); } },
    { name: 'link', run: async (p) => { await p.click('#noticesBox [data-notice]'); } },
    { name: 'rules', run: async (p) => { await p.click('#tabs button[data-tab=rules]'); } },
    { name: 'msgs', run: async (p) => { await p.click('#tabs button[data-tab=msgs]'); } },
  ],
};
