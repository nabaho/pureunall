'use strict';
/* 🔎 담당 점검 · 오른쪽 딱지 열 (대표 승인 목업 2026-10-03)
   「담당자가 지정되었는데 잘못 되거나 변경할 경우 검토할 수 있게 해라 … 내부체크시스템 만들어라」
   「캡쳐2 부분 열을 정리해달라」

   지키는 것
   ① 처음 켜는 날은 기준만 적는다 · 기준에 없던 새 업체는 «바뀐 것»이 아니다
   ② 바뀐 것은 «전 → 새»로 남긴다 · 확인 전에 또 바뀌면 «처음 담당»을 지킨다 · 원래대로 돌아오면 지운다
   ③ 적는 것은 관리자 PC 만 — 보는 것은 누구나
   ④ 퇴사자 담당 · 빈 담당(메일 오는 곳만) · 손으로 정한 담당 ≠ 이알피 — 확인·그대로 둔 것은 빠진다
   ⑤ 딱지는 갈래마다 정해진 열에 — 이 쪽에서 안 쓰인 갈래는 자리를 안 잡는다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { sliceFn } = require('./fnslice.js');

const app = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8').replace(/\r\n/g, '\n');
const strip = (s) => String(s).replace(/\/\*[\s\S]*?\*\//g, ' ');
const D = Date.now();

const COS = () => [
  { id: 'co1', name: '가나상사', managerMain: 'P-001' },
  { id: 'co2', name: '다라물류', managerMain: 'P-002' },
  { id: 'co3', name: '마바테크', managerMain: 'P-009' },      /* 퇴사자 */
  { id: 'co4', name: '사아무역', managerMain: '' },           /* 빈 담당 */
  { id: 'co5', name: '자차상회', managerMain: '' },           /* 빈 담당 · 메일 없음 */
  { id: 'co6', name: '끝난업체', managerMain: 'P-001', status: 'closed' },
];
function box(o) {
  o = o || {};
  const ctx = {
    Object, String, Number, Array, Date, RegExp, JSON, Promise, Math,
    console: { log() {}, warn() {} },
    state: { isAdmin: o.admin !== false, view: 'mail' },
    myEmail: 'p001@pureun.kr', DB_ROOT: 'pucards', MB_OLD_ID: '*old',
    _memo: {}, _mbOwner: o.owner || {}, _mbMsgs: {},
    ErpMatch: { ready: true, companies: o.cos || COS(), nameBySid: { 'P-001': '권형하', 'P-002': '박한별', 'P-009': '이퇴사' },
      _norm: (s) => String(s || '').replace(/\s/g, '') },
    mbMemoOf: () => ctx._memo, mbMemoClear: () => { ctx._memo = {}; },
    mbRetired: (n) => n === '이퇴사', mbWhoLive: (n) => (n === '이퇴사' ? '' : n),
    mbWhoIndex: () => ({}), mbFolderBy: () => ({ kind: 'inbox' }), mbGotFolder: () => true,
    mbCoNameOf: (e) => (o.coOf || {})[e] || '',
    mbCoRec: (n) => ({ '가나상사': { main: '권형하' }, '다라물류': { main: '박한별' } })[n] || null,
    toast: (t) => { ctx._toast = t; }, renderPCSide() {}, renderMailPage() {}, mbDrawSoon() { ctx._drew = (ctx._drew || 0) + 1; },
    Store: { mode: 'firebase' },
  };
  ctx.writes = [];
  ctx.firebase = { database: () => ({ ref: (p) => ({
    update: async (u) => { ctx.writes.push(p ? { p, u } : u); },
    set: async (v) => { ctx.writes.push({ p, v }); },
    once: async () => ({ val: () => null }) }) }) };
  vm.createContext(ctx);
  vm.runInContext("var _mgrSeen = null, _mgrChange = null, _mgrKeep = null, _mgrBusy = false, _mgrLoading = false; var _mgrReqs = " + JSON.stringify(o.reqs || []) + ";", ctx);
  const m = app.match(/^const MGR_KEY_OK = [^\n]*;/m); assert.ok(m);
  vm.runInContext(m[0].replace(/^const /, 'var '), ctx);
  ['mgrLoad', 'mgrLiveCos', 'mgrName', 'mgrDiff', 'mgrMailCount', 'mgrRows', 'mgrCount', 'mgrAck']
    .forEach((n) => vm.runInContext(sliceFn(app, 'function ' + n + '('), ctx));
  vm.runInContext(sliceFn(app, 'async function mgrWatchRun('), ctx);
  if (o.seen !== undefined) vm.runInContext('_mgrSeen = ' + JSON.stringify(o.seen) + '; _mgrChange = ' + JSON.stringify(o.change || {}) + '; _mgrKeep = ' + JSON.stringify(o.keep || {}) + ';', ctx);
  ctx.get = (n) => vm.runInContext(n, ctx);
  return ctx;
}
const plain = (x) => JSON.parse(JSON.stringify(x));

test('★★★ 처음 켜는 날은 기준만 적는다 — 바뀐 것으로 안 잡는다', () => {
  const c = box();
  const d = plain(c.mgrDiff({}, c.mgrLiveCos(), D));
  assert.equal(d.first, true);
  assert.equal(d.changes.length, 0, '★★★ 처음인데 «바뀌었다»고 합니다');
  assert.equal(d.next.co1, 'P-001');
  assert.equal(d.next.co6, undefined, '★ 끝난 업체까지 지켜봅니다');
});

test('★★★ 바뀐 것을 «전 → 새»로 낸다 · 기준에 없던 새 업체는 바뀐 것이 아니다', () => {
  const c = box();
  const d = plain(c.mgrDiff({ co1: 'P-002', co2: 'P-002', co4: 'P-001' }, c.mgrLiveCos(), D));
  assert.deepEqual(d.changes.map((x) => x.co + ':' + x.from + '>' + x.to).sort(), ['co1:P-002>P-001', 'co4:P-001>']);
});

test('★★★ 관리자 PC 만 적는다 — 기준과 바뀐 것을 한 번에', async () => {
  const n = box({ admin: false, seen: { co1: 'P-002' } });
  await n.mgrWatchRun();
  assert.equal(n.writes.length, 0, '★★★ 관리자가 아닌데 적습니다 — 여러 PC 가 기준을 서로 덮습니다');
  const c = box({ seen: { co1: 'P-002', co2: 'P-002', co3: 'P-009', co4: '', co5: '' } });
  await c.mgrWatchRun();
  assert.equal(c.writes.length, 1, '★★ 여러 번 나눠 적습니다');
  const u = c.writes[0];
  assert.deepEqual(plain(u['pucards/config/mgrChange/co1']), { co: 'co1', coName: '가나상사', from: 'P-002', to: 'P-001', at: u['pucards/config/mgrChange/co1'].at });
  assert.equal(u['pucards/config/mgrSeen/co1'], 'P-001', '★★ 기준을 새로 안 적어 다음에 또 잡습니다');
  assert.match(String(c._toast), /담당이 바뀐 업체 1곳/);
});

test('★★ 확인 전에 또 바뀌면 «처음 담당»을 지킨다 · 원래대로 돌아오면 줄을 지운다', async () => {
  const cos = COS(); cos[0].managerMain = 'P-009';
  const c = box({ cos, seen: { co1: 'P-002' }, change: { co1: { co: 'co1', coName: '가나상사', from: 'P-001', to: 'P-002', at: 1 } } });
  await c.mgrWatchRun();
  assert.equal(c.writes[0]['pucards/config/mgrChange/co1'].from, 'P-001', '★★ 처음 담당을 잃어 무엇이 바뀌었는지 모릅니다');
  const cos2 = COS();
  const b = box({ cos: cos2, seen: { co1: 'P-002' }, change: { co1: { co: 'co1', from: 'P-001', to: 'P-002', at: 1 } } });
  await b.mgrWatchRun();
  assert.equal(b.writes[0]['pucards/config/mgrChange/co1'], null, '★★ 원래대로 돌아왔는데 «바뀌었다»가 남습니다');
});

test('★★★ 넷을 가려 보여 준다 — 확인한 것·메일 없는 빈 담당·그대로 둔 것은 빠진다', () => {
  const c = box({ seen: {}, change: { co1: { co: 'co1', from: 'P-002', to: 'P-001', at: 2 }, co2: { co: 'co2', from: 'P-001', to: 'P-002', at: 1, ack: 3 } },
    owner: { 'kim@ganasa,co,kr': '박한별', 'lee@dara,co,kr': '박한별', 'x@keep,kr': '박한별', '@ganasa,co,kr': '박한별' },
    coOf: { 'kim@ganasa.co.kr': '가나상사', 'lee@dara.co.kr': '다라물류', 'x@keep.kr': '가나상사' },
    keep: { 'x@keep,kr': 1 } });
  c._memo.mgrCnt = { '사아무역': 7 };
  const r = plain(c.mgrRows());
  assert.deepEqual(r.changes.map((x) => x.co), ['co1'], '★★ 확인한 것이 또 나옵니다');
  assert.deepEqual(r.retired.map((x) => x.co.id), ['co3']);
  assert.deepEqual(r.empty.map((x) => x.co.id), ['co4'], '★★ 메일도 안 오는 빈 담당까지 늘어놓습니다');
  assert.deepEqual(r.hand.map((x) => x.em), ['kim@ganasa.co.kr'], '★★ 손으로 정한 것과 이알피가 같은 것·그대로 둔 것·도메인 것까지 냅니다');
  assert.equal(c.mgrCount(), 4);
});

test('★★ 「확인」은 그 줄에 누가·언제를 적는다', () => {
  const c = box({ seen: {}, change: { co1: { co: 'co1', from: 'P-002', to: 'P-001', at: 2 } } });
  c.mgrAck('co1');
  const w = c.writes[0];
  assert.equal(w.p, 'pucards/config/mgrChange/co1');
  assert.ok(w.u.ack && w.u.ackBy === 'p001@pureun.kr');
  assert.equal(plain(c.mgrRows()).changes.length, 0);
});

test('★★ 메일 창 옆줄·본문·시계에 걸려 있다 — 견주어 적는 것은 관리자만', () => {
  assert.match(app, /onclick="openMgrPage\(\)"[\s\S]{0,300}담당 점검/, '★★ 옆줄에 자리가 없습니다');
  assert.match(app, /: state\.mailSent==='mgr' \? mgrHtml\(\)/, '★★ 본문이 이 화면을 안 그립니다');
  const tick = strip(sliceFn(app, 'function mnewTickStart('));
  assert.match(tick, /state\.isAdmin\)\{ mnewLogLoad\(mnewAutoFill\); mgrLoad\(mgrWatchRun\); \}/, '★★ 관리자 시계가 담당을 안 견줍니다');
  const html = strip(sliceFn(app, 'function mgrHtml('));
  assert.doesNotMatch(html, /mgrWatchRun\(|firebase/, '★★ 그리는 자리에서 적습니다');
});

/* ══════ ⑤ 오른쪽 딱지 열 ══════ */
function colBox(parts) {
  const ctx = { String, Array, Math, esc: (s) => String(s) };
  vm.createContext(ctx);
  const m = app.match(/^const MB_TAG_SLOTS = [^\n]*;/m); assert.ok(m);
  vm.runInContext(m[0].replace(/^const /, 'var '), ctx);
  const mx = app.match(/^const MB_TAG_MAX = [^\n]*;/m); assert.ok(mx);
  vm.runInContext(mx[0].replace(/^const /, 'var '), ctx);
  ['MB_TAG_ALONE', 'MB_TAG_REST_MAX'].forEach((k) => {
    const r = app.match(new RegExp('^const ' + k + ' = [^\\n]*;', 'm')); assert.ok(r, k);
    vm.runInContext(r[0].replace(/^const /, 'var '), ctx);
  });
  ['mbTagW', 'mbTagCols', 'mbTagColsHtml'].forEach((n) => vm.runInContext(sliceFn(app, 'function ' + n + '('), ctx));
  ctx.mbTagParts = (v) => parts[v];
  return ctx;
}
test('★★★ 쓰이는 열은 비어 있어도 자리를 지킨다 · 안 쓰이는 열은 자리를 안 잡는다', () => {
  const E = ['', '', '', '', '', '', '', '', ''];
  const a = E.slice(); a[0] = '<i>📁 칸</i>'; a[2] = '<i>급여자료</i>';
  const b = E.slice(); b[0] = '<i>📁 칸</i>';
  const c = colBox([a, b]);
  const t = c.mbTagCols([0, 1]);
  const h1 = c.mbTagColsHtml(t, 0), h2 = c.mbTagColsHtml(t, 1);
  const cols = (h) => (h.match(/dm-c-[a-z]+/g) || []).join(',');
  /* 담당 열 + 나머지는 «한 무리»(2026-10-04 「그래도 너무 넓게 차지한다」) */
  assert.equal(cols(h1), 'dm-c-who,dm-c-rest');
  assert.equal(cols(h2), cols(h1), '★★★ 줄마다 열이 달라 세로줄이 안 맞습니다');
  const rw = (h) => (h.match(/dm-c-rest" style="width:(\d+)px/) || [])[1];
  assert.ok(rw(h1) && rw(h1) === rw(h2), '★★★ 무리의 너비가 줄마다 달라 시작 자리가 안 맞습니다');
  assert.doesNotMatch(h1 + h2, /dm-c-work|dm-c-box|dm-c-hrk/, '★★ 갈래마다 열을 따로 세워 줄이 넓어집니다');
  const d = colBox([E.slice()]);
  assert.equal(d.mbTagColsHtml(d.mbTagCols([0]), 0), '', '★★ 아무 딱지도 없는데 자리를 잡습니다');
});

test('★★ 급여데이터함 딱지는 «갈래»와 «📋 데이터함» 두 열로 가른다 · 열 너비는 CSS 한 곳', () => {
  const parts = strip(sliceFn(app, 'function mbTagParts('));
  assert.match(parts, /hr\.indexOf\('<span class="dm-hr go"'\)/);
  assert.match(app, /\.dm-c\{flex:none;[^}]*overflow:hidden[^}]*white-space:nowrap\}/, '★ 열이 넘쳐 줄이 두 줄이 됩니다');
  const m = app.match(/^const MB_TAG_SLOTS = \[([^\]]*)\]/m);
  m[1].replace(/'/g, '').split(',').map((x) => x.trim()).forEach((k) =>
    assert.match(app, new RegExp('\\.dm-c-' + k + '\\{width:\\d+px\\}'), '★★ 「' + k + '」 열의 너비가 없습니다 — 세로줄이 안 맞습니다'));
});

/* ══════ 이알피 승인제와 이어짐 (2026-10-03) ══════ */
test('★★ 승인 기다리는 이알피 요청도 함께 센다', () => {
  const c = box({ seen: {}, reqs: [{ id: 'r1', coId: 'co1', coName: '가나상사', from: 'P-002', to: 'P-001', by: 'P-003', byName: '김보람', at: D, status: 'wait' }] });
  const r = plain(c.mgrRows());
  assert.equal(r.pending.length, 1, '★★ 이알피에서 기다리는 요청이 안 보입니다');
  assert.equal(c.mgrCount(), 2, '퇴사자 1 · 빈 담당 0(메일 없음) · 요청 1');
});

test('★★ 바뀐 것에 «누가 바꿨는지» — 이알피 이력의 마지막 줄이 그 바꿈이면', () => {
  const cos = COS();
  cos[0].managerMain = 'P-001';
  cos[0].mgrHistory = [{ at: D, from: 'P-002', to: 'P-001', reqByName: '김보람', okByName: '권형하' }];
  cos[1].managerMain = 'P-001';
  cos[1].mgrHistory = [{ at: D, from: 'P-009', to: 'P-009' }];
  const c = box({ cos });
  const d = plain(c.mgrDiff({ co1: 'P-002', co2: 'P-002' }, c.mgrLiveCos(), D));
  const byCo = {}; d.changes.forEach((x) => { byCo[x.co] = x; });
  assert.equal(byCo.co1.by, '김보람 요청 · 권형하 승인', '★★ 누가 바꿨는지 안 적습니다');
  assert.equal(byCo.co2.by, undefined, '★ 다른 바꿈의 이력을 갖다 붙입니다');
});

test('★★★ 열 너비는 이 쪽에서 가장 긴 딱지에 맞춘다 — 짧으면 좁게 · 줄마다 같게 · 상한은 넘지 않게', () => {
  const E = ['', '', '', '', '', '', '', '', ''];
  const a = E.slice(); a[0] = '<span class="dm-who">👤 권형하</span>';
  const b = E.slice(); b[0] = '<span class="dm-who">👤 신욱임</span>';
  const c = colBox([a, b]);
  const t = c.mbTagCols([0, 1]);
  const w = (h) => Number((h.match(/dm-c-who" style="width:(\d+)px"/) || [])[1]);
  const w1 = w(c.mbTagColsHtml(t, 0)), w2 = w(c.mbTagColsHtml(t, 1));
  assert.ok(w1 > 0 && w1 === w2, '★★★ 줄마다 너비가 달라 세로줄이 안 맞습니다');
  assert.ok(w1 < 100, '★★★ 짧은 딱지만 있는데 열이 넓습니다: ' + w1 + 'px');
  const long = E.slice(); long[0] = '<span class="dm-who">' + '가'.repeat(60) + '</span>';
  const d = colBox([long]);
  assert.ok(w(d.mbTagColsHtml(d.mbTagCols([0]), 0)) <= 150, '★★ 긴 딱지 하나가 열을 끝없이 넓힙니다');
});
