/* 데이터관리(pu-datahub.html) 폰·PC 점검 자료 — 모두 지어낸 합성 값이다(사람·업체·금액 전부).
 * 사람은 「점검○○」, 업체는 「(주)가나점검NN」 꼴로만 지어낸다. 실제 사람·업체·금액·사번을 넣지 말 것.
 * 날짜는 «도구를 돌리는 날» 기준으로 만든다 — 앱이 이번 달을 끝 달로 12개월·53주를 읽기 때문이다.
 * 대표 표지(app_owner/uid)를 가짜 로그인 uid 와 같게 두어 앱이 열린다(seed.js 의 UID).
 */
'use strict';

const path = require('node:path');
const C = require(path.join(__dirname, '..', '..', '..', 'js', 'pu-datahub-calc.js'));
/* seed.js 의 가짜 로그인 uid 와 같은 값 — seed.js 가 이 파일을 읽으므로 거꾸로 require 하지 않는다(돌림 require 면 빈 값이 온다) */
const UID = 'pa-uid-1';

/* 씨앗 고정 난수 — 돌릴 때마다 같은 모양 */
let seed = 20261121;
function R() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
function pad2(x) { return (x < 10 ? '0' : '') + x; }
function ymOf(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1); }
function ymd(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }

const now = new Date();
const NOW = now.getTime();

/* 사람 — 노무사(P-)·직원(A-). 한 사람은 긴 이름(폰 칸 넘침 점검) */
const 사람 = [
  { sid: 'P001', name: '점검대표', role: 'admin', status: 'active', title: '대표노무사' },
  { sid: 'P-801', name: '점검노무가', role: 'staff', status: 'active', title: '노무사' },
  { sid: 'P-802', name: '점검노무나', role: 'staff', status: 'active', title: '노무사' },
  { sid: 'P-803', name: '점검노무사긴이름보기', role: 'staff', status: 'active', title: '노무사' },
  { sid: 'A-801', name: '점검직원라', role: 'staff', status: 'active', title: '사무장' },
  { sid: 'A-802', name: '점검직원마', role: 'staff', status: 'active', title: '주임' },
  { sid: 'A-803', name: '점검직원바', role: 'staff', status: 'active', title: '사원' },
  { sid: 'T-801', name: '점검퇴사사', role: 'staff', status: 'retired', title: '노무사' },
];
const 노무사 = ['P001', 'P-801', 'P-802', 'P-803'];
const 직원 = ['A-801', 'A-802', 'A-803'];

/* 업체 30곳 — 주담당은 노무사 넷에게 나눠 준다. 몇 곳은 자문료가 밀려 미수가 보이게 */
const companies = [];
for (let i = 0; i < 30; i++) {
  companies.push({
    id: 'dco-' + pad2(i + 1), name: '(주)가나점검' + pad2(i + 1), no: 10801 + i, status: i === 29 ? 'closed' : 'active',
    managerMain: 노무사[i % 4], monthlyAdvisoryFee: i < 22 ? (20 + Math.round(R() * 40)) * 10000 : 0,
    contractStartDate: '2024-01', taxInvoicePaymentDay: '10'
  });
}

/* 입금 — 지난 26개월(다년 대조용으로 그 전 해도 조금). 자문료·사건·컨설팅·기금·기타를 섞는다 */
const incomes = {};
let fid = 0;
function addIncome(rec) { fid++; const id = 'dfi-' + fid; incomes[id] = Object.assign({ id: id, confirmed: true }, rec); }
for (let back = 25; back >= 0; back--) {
  const d = new Date(now.getFullYear(), now.getMonth() - back, 1);
  const ym = ymOf(d);
  const last = back === 0 ? Math.max(1, now.getDate() - 1) : new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  companies.forEach((co, i) => {
    if (!co.monthlyAdvisoryFee || co.status !== 'active') return;
    /* 미수 흉내 — 세 곳은 최근 두 달을 안 냈다 */
    if (i % 9 === 4 && back >= 1 && back <= 2) return;
    if (back === 0 && R() < 0.5) return;
    const day = Math.min(last, 5 + Math.floor(R() * 15));
    addIncome({ date: ym + '-' + pad2(day), amount: co.monthlyAdvisoryFee, kind: '자문료', sourceKind: 'company', companyId: co.id, companyName: co.name,
      advisoryYm: ym, confirmedBy: 직원[i % 3], cardFee: (i % 7 === 0) ? Math.round(co.monthlyAdvisoryFee * 0.015) : 0 });
  });
  const nCase = 2 + Math.floor(R() * 4);
  for (let k = 0; k < nCase; k++) {
    const co = companies[Math.floor(R() * 29)];
    const lead = 노무사[Math.floor(R() * 4)];
    addIncome({ date: ym + '-' + pad2(Math.min(last, 1 + Math.floor(R() * 27))), amount: (100 + Math.round(R() * 900)) * 10000,
      sourceKind: k % 3 === 0 ? 'consulting' : 'case', companyId: co.id, companyName: co.name, perfYM: ym,
      perfShares: [{ sid: lead, sharePct: 70 }, { sid: 노무사[(노무사.indexOf(lead) + 1) % 4], sharePct: 30 }], confirmedBy: 직원[k % 3] });
  }
  if (R() < 0.6) addIncome({ date: ym + '-' + pad2(Math.min(last, 12)), amount: (50 + Math.round(R() * 200)) * 10000, sourceKind: 'fund', perfShares: [{ sid: 'P-802' }], confirmedBy: 'A-801' });
  if (R() < 0.5) addIncome({ date: ym + '-' + pad2(Math.min(last, 20)), amount: (10 + Math.round(R() * 60)) * 10000, sourceKind: 'other', confirmedBy: 'A-802' });
}
/* 빠져야 하는 줄 — 휴지통·되돌림·성과조정·과거기록·개인수익 (화면 숫자에 안 들어가야 한다) */
const ymNow = ymOf(now);
addIncome({ date: ymNow + '-01', amount: 99990000, sourceKind: 'case', _deleted: true, perfShares: [{ sid: 'P-801' }] });
addIncome({ date: ymNow + '-01', amount: 88880000, sourceKind: 'case', undoneDate: ymNow + '-02', perfShares: [{ sid: 'P-801' }] });
addIncome({ date: ymNow + '-01', amount: 77770000, sourceKind: 'perf-adjust', perfShares: [{ sid: 'P-801' }] });
addIncome({ date: ymNow + '-01', amount: 66660000, sourceKind: 'case', confirmed: false, perfShares: [{ sid: 'P-801' }] });
addIncome({ date: ymNow + '-01', amount: 55550000, sourceKind: 'other', isPersonalIncome: true });

/* 업무관리 — 업무건 몇 개와 지난 53주 기록 {d, t, k, by} (본문 t 는 앱이 그리지 않는다) */
const items = {};
for (let i = 0; i < 40; i++) {
  const co = companies[i % 30];
  items['dwk-' + pad2(i + 1)] = { id: 'dwk-' + pad2(i + 1), co_id: co.id, co_name: co.name, title: '점검 업무 ' + (i + 1), status: i % 5 === 0 ? 'done' : 'open', mgr_main: { sid: co.managerMain } };
}
const logs = {};
const weeks = C.weekList(ymd(now), 53);
let lid = 0;
weeks.forEach((wk, wi) => {
  const y = wk.slice(0, 4);
  const box = ((logs[y] = logs[y] || {})[wk] = {});
  /* 그 주의 월요일 날짜 */
  const m = /^(\d{4})-W(\d{2})$/.exec(wk);
  const jan4 = new Date(+m[1], 0, 4), mon = new Date(jan4); mon.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7) + (+m[2] - 1) * 7);
  사람.forEach((p, pi) => {
    if (p.status !== 'active') return;
    if (p.sid === 'A-803' && wi % 4 === 1) return;                 /* 기록을 자주 빠뜨리는 사람 — 기록률이 낮게 */
    const busy = (p.sid === 'P-802' && wi >= 44) ? 8 : 0;           /* 최근 몇 주 일이 몰린 사람 */
    const cnt = Math.max(0, Math.round((p.title === '노무사' || p.title === '대표노무사' ? 7 : 10) * (0.6 + R() * 0.8)) + busy);
    for (let k = 0; k < cnt; k++) {
      const it = 'dwk-' + pad2(1 + ((pi * 7 + k) % 40));
      const dd = new Date(mon); dd.setDate(mon.getDate() + (k % 5));
      if (dd > now) continue;
      lid++;
      (box[it] = box[it] || {})['dlg-' + lid] = { d: ymd(dd), t: '점검 기록 본문(화면에 안 나와야 함)', k: 'step', by: p.sid };
    }
  });
});

/* 현황판 — 서버가 한 시간마다 쓰는 «건수·비율만» 흉내. 몇 앱은 비워 «서버 집계 전»이 보이게 */
const at = NOW - 25 * 60000;
const board = {
  erp: { n: [{ label: '진행 사건', v: 142 }, { label: '이달 접수', v: 11 }, { label: '만료 임박', v: 6 }], bar: { name: '종결한 비율', pct: 63 }, state: 'ok', at },
  work: { n: [{ label: '업무', v: 236 }, { label: '새 업무', v: 38 }, { label: '기한 지남', v: 7 }], bar: { name: '단계 끝낸 비율', pct: 74 }, state: 'ok', at },
  fin: { n: [{ label: '이달 입금', v: 83 }, { label: '올해 입금', v: 874 }, { label: '보류 거래', v: 12 }], state: 'ok', at },
  cal: { n: [{ label: '오늘 일정', v: 9 }, { label: '근태 기록', v: 231 }, { label: '새 후보', v: 3 }], state: 'ok', at },
  consult: { n: [{ label: '진행 사업장', v: 31 }, { label: '새 사업장', v: 2 }, { label: '기한 지남', v: 1 }], bar: { name: '보고서 검토 끝낸 비율', pct: 78 }, state: 'ok', at },
  govreport: { n: [{ label: '서류 줄', v: 418 }, { label: '이달 처리', v: 57 }, { label: '막힘', v: 2 }], bar: { name: '서류 끝낸 비율', pct: 71 }, state: 'ok', at },
  mail: { n: [{ label: '메일', v: 6412 }, { label: '이달 받음', v: 388 }, { label: '안 읽음', v: 23 }], state: 'ok', at },
  hangul: { state: 'na', why: '문서가 각자 브라우저 안(IndexedDB)에만 있어 서버가 못 셈', at },
  pbox: { state: 'na', why: '자료가 각자 브라우저 안(IndexedDB)에만 있어 서버가 못 셈', at },
  orch: { state: 'na', why: '자기 자료가 없는 앱 — 다른 앱 자료를 읽기만 함', at },
};

/* 관계망 판 — 이름은 없다(앱이 업체 목록·명부로 화면 안에서만 붙인다) */
const ent = { internal: {}, personal: {}, financial: {} }, edg = { internal: {}, personal: {}, financial: {} };
function E(vis, key, row) { ent[vis][key] = row; }
function L(vis, s, p, o) { const id = 'edge:' + encodeURIComponent(s + '|' + p + '|' + o); edg[vis][id] = { id, subject: s, predicate: p, object: o, sourceStore: 'contracts', confidence: 1 }; }
companies.forEach((co) => E('internal', 'Organization:' + co.id, { id: co.id, type: 'Organization', program: 'erp', no: co.no }));
사람.forEach((p) => E('personal', 'Person:' + encodeURIComponent(p.sid), { id: p.sid, type: 'Person', program: 'hr' }));
companies.slice(0, 20).forEach((co, i) => {
  const ck = 'Contract:dct-' + pad2(i + 1);
  E('internal', ck, { id: 'dct-' + pad2(i + 1), type: 'Contract', program: 'erp' });
  L('internal', ck, 'contractedWith', 'Organization:' + co.id);
  L('personal', ck, 'assignedTo', 'Person:' + encodeURIComponent(co.managerMain));
  if (i < 12) { const cs = 'Case:dcs-' + pad2(i + 1); E('internal', cs, { id: 'dcs-' + pad2(i + 1), type: 'Case', program: 'erp' }); L('internal', cs, 'concerns', 'Organization:' + co.id); L('personal', cs, 'assignedTo', 'Person:' + encodeURIComponent(노무사[(i + 1) % 4])); }
  if (i < 8) { const tk = 'Task:dwk-' + pad2(i + 1); E('internal', tk, { id: 'dwk-' + pad2(i + 1), type: 'Task', program: 'work' }); L('internal', tk, 'derivedFrom', ck); }
  if (i < 10) { const fi = 'FinancialTransaction:dfi-' + (i + 1); E('financial', fi, { id: 'dfi-' + (i + 1), type: 'FinancialTransaction', program: 'fin' }); L('financial', fi, 'paidFor', ck); }
});
const GEN = 'ont-pa0001';

module.exports = {
  data: {
    app_owner: { uid: UID },
    data: {
      user_dir: { v: 사람 },
      companies: { v: companies },
      finance_income: { v: incomes, u: NOW },
    },
    work_erp: { items, logs },
    datahub_board: board,
    datahub: { [UID]: { settings: {
      id: 'settings', entityType: 'ViewState', schemaVersion: 1, contractVersion: 1, createdAt: NOW - 864e5, updatedAt: NOW - 864e5, revision: 1,
      view: 'all', basis: 'cash', net: false, vmode: 'both',
      cLines: { warn: 12, over: 18 }, thresholds: { _rec: 80, work: { w: 5, b: 10 }, erp: { w: 3 }, fin: { w: 20 } }
    } } },
    datahub_device: { [UID]: { fp: 'PA00-0001', name: 'Windows · Chrome', approvedAt: NOW - 3 * 864e5, status: 'active' } },
    ontology: { v1: { current: GEN, gen: { [GEN]: {
      meta: { schema: 'ontology/v1', generationId: GEN, generatedAt: new Date(NOW - 2 * 864e5).toISOString(), confirmedEdges: 0, sourceMutation: 'never' },
      internal: { entities: ent.internal, edges: edg.internal }, personal: { entities: ent.personal, edges: edg.personal }, financial: { entities: ent.financial, edges: edg.financial },
      source: { entities: {}, edges: {} }
    } } } },
  },
  views: [
    { name: 'multi', run: async (p) => { await p.click('.side button[data-v="multi"]'); } },
    { name: 'board', run: async (p) => { await p.click('.side button[data-v="board"]'); } },
    { name: 'graph', run: async (p) => { await p.click('.side button[data-v="graph"]'); }, wait: 2500 },
    { name: 'lock', run: async (p) => { await p.click('.side button[data-v="lock"]'); } },
    { name: 'a', run: async (p) => { await p.click('.side button[data-v="a"]'); } },
    { name: 'b', run: async (p) => { await p.click('.side button[data-v="b"]'); } },
    { name: 'c', run: async (p) => { await p.click('.side button[data-v="c"]'); } },
    { name: 'd', run: async (p) => { await p.click('.side button[data-v="d"]'); } },
    { name: 'e', run: async (p) => { await p.click('.side button[data-v="e"]'); } },
    /* E 2D 업체 막대 목록 — 다음 쪽 넘기기 · 업무 많은 차례 (2026-11-22 「2D 가 빡빡해 확인이 안 된다」) */
    { name: 'e2d', run: async (p) => { await p.click('.side button[data-v="e"]'); await p.click('#e2dNext'); await p.click('#eSort .chip:nth-of-type(2)'); } },
    { name: 'set', run: async (p) => { await p.click('#btnOpenSet'); }, back: async (p) => { await p.click('#btnCloseSet'); } },
    /* 눌러 보기 — 기준 전환·무대 바꾸기·기기 등록 요청(서버 함수는 점검 도구가 막아 «채팅 서버 준비 전»이 떠야 한다)·재인증(가짜 로그인) */
    { name: 'toggles', run: async (p) => { await p.click('.side button[data-v="all"]'); await p.click('#btnBasisToggle'); await p.click('#btnNetToggle'); await p.click('#btnStageTheme'); await p.click('#monthScrub [data-mi="12"]'); } },
    { name: 'devreq', run: async (p) => { await p.click('.side button[data-v="lock"]'); await p.click('#btnDevReq'); }, wait: 2500 },
    /* 3D·2D 보기는 «어느 화면에서 바꿔도 모든 화면에 함께» (2026-11-22 정리 — 위 막대 전체 단추를 합침). A 화면에서 3D 를 누르고 전체 배치로 가서 찍는다 */
    { name: 'mode3d', run: async (p) => { await p.click('.side button[data-v="a"]'); await p.click('.mseg[data-target="dualA"] button[data-m="3d"]'); await p.click('.side button[data-v="all"]');
      const ok = await p.evaluate(() => ['dualAll', 'dualM', 'dualE'].every((id) => document.getElementById(id).classList.contains('mode-3d')) && document.querySelector('.mseg[data-target="dualAll"] button[data-m="3d"]').getAttribute('aria-pressed') === 'true');
      if (!ok) throw new Error('A 화면에서 고른 3D 가 다른 화면에 함께 적용되지 않았다'); } },
    /* 재인증 칸은 기기가 확인된 뒤에만 보인다 — 점검에서는 기기 등록이 안 되므로 숨어 있어야 맞다 */
    { name: 'scroll', run: async (p) => { await p.click('.side button[data-v="all"]'); await p.evaluate(() => window.scrollTo(0, 1600)); }, wait: 800 },
  ],
};
