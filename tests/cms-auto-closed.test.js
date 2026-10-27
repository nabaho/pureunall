'use strict';
/* 🤖 자동 처리 화면도 종료 업체를 «알아보되, 확정은 사람이 거래내역에서» (건의 · 김보람 2026-10-27, 대표 「해줘」)

   ■ 왜
   종료 업체의 자동이체(남은 달 몫)가 자동 처리 화면에 오면 「처음 보는 회원 · 후보 없음」으로만 보였다.
   거래내역 CMS 창은 이미 종료 업체를 알아보고 달별로 나눠 적는데, 이 화면은 그 사실을 모르는 채 «업체를 새로 이으라»고 했다.

   ★ 규칙 (값이 아니라 규칙)
     ① 처음 보는 회원의 이름이 종료 업체와 «꼭 같으면» 화면이 「종료 업체」로 알려 준다 — 「후보 없음」으로 두지 않는다
     ② 이 화면은 종료 업체에 회원코드를 잇지도, 입금을 만들지도 않는다 — 단추는 사람을 거래내역으로 보낸다
        (몇 개월분인지·달별로 나눌지는 사람이 정해야 하고, 그 창이 이미 그렇게 한다)
     ③ 비슷한 이름은 안 붙는다 · 활성 업체 후보는 예전처럼 「이 업체로 잇기」(확인창 → 잇기)
     ④ 종료 업체에 이어져 있는 회원코드라도 자동 확정은 되지 않는다 (판정은 활성 업체만) */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn');
const { stripComments } = require('./strip-comments');
const A = require('../js/pu-cms-auto.js');

const ERP = stripComments(fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8'));

const CO = [
  { id: 'a1', name: '(주)활성샘플', status: 'active', bizNo: '123-81-10011', monthlyAdvisoryFee: 110000 },
  { id: 'c1', name: '종료샘플상사', status: 'closed', bizNo: '123-81-20012', monthlyAdvisoryFee: 110000 },
];
const ROW = (k, name, code) => ({ _k: k, name, code, wdate: '2026-04-17', amount: 220000, status: 'ok' });
const NEW = '회원코드가 어느 업체에도 이어져 있지 않음';

/* 자동 처리 화면(FinanceAuto)을 가짜 환경에서 «실제로 그려» 본다 — 소스 글자만 찾는 검사로는 이 화면의 단추가 무엇을 하는지 모른다 */
function render(items) {
  const calls = { link: [], patch: [], income: [], nav: [], confirm: [], toast: [], run: [] };
  const win = {
    __erpCmsAutoLast: { items, status: {}, since: '2026-01-01' }, innerWidth: 1280,
    confirm: (m) => { calls.confirm.push(m); return true; },
    addEventListener() {}, removeEventListener() {},
  };
  const ctx = {
    window: win, CURRENT_USER: { sid: 'P-001' }, isAdminByUser: () => true,
    useState: (v) => [typeof v === 'function' ? v() : v, () => {}],
    usePersistedState: (k, v) => [v, () => {}],
    useEffect: () => {}, useFillHeight: () => ({ ref: null, max: '' }),
    h: (t, p, ...c) => ({ t, p: p || {}, c: [].concat(...c.map((x) => (Array.isArray(x) ? x : [x]))) }),
    dbGet: (k, d) => (k === 'companies' ? CO : d),
    dbPatch: (...a) => { calls.patch.push(a); return true; },
    dbSet: (...a) => { calls.patch.push(a); return true; },
    erpUpsertIncome: (...a) => { calls.income.push(a); return true; },
    erpAddCompanyIncome: (...a) => { calls.income.push(a); return true; },
    erpCmsLinkMember: (code, id) => { calls.link.push([code, id]); return true; },
    erpCmsAutoRun: (o) => { calls.run.push(o); },
    erpCmsUndo: () => Promise.resolve(true),
    showToast: (m) => { calls.toast.push(m); },
    __nav: (r) => { calls.nav.push(r); },
    _erpNameCmp: (a, b) => ({ score: a === b ? 100 : (a && b && (a.indexOf(b) >= 0 || b.indexOf(a) >= 0) ? 90 : 0) }),
    erpAliasCompany: () => null, erpCleanMemo: (x) => x, erpPrevList: () => [],
    Object, Array, String, parseInt, Date, Math, JSON,
  };
  vm.createContext(ctx);
  vm.runInContext([
    cutFn(ERP, 'function erpNormName(s)'),
    cutFn(ERP, 'function _nbDigits(v)'),
    cutFn(ERP, 'function erpNicebillCoIndex()'),
    cutFn(ERP, 'function erpNicebillMatchCo(idx, name, bizNo, out)'),
    cutFn(ERP, 'function erpCmsAutoCandidate(ix, name)'),
    cutFn(ERP, 'function FinanceAuto(props)'),
    'this.tree = FinanceAuto({ onNavigate: function(r){ __nav(r); } });',
  ].join('\n'), ctx);
  const rows = {};
  (function walk(n) {
    if (!n || typeof n !== 'object') return;
    if (n.t === 'tr' && n.p.key) rows[n.p.key] = n;
    (n.c || []).forEach(walk);
  })(ctx.tree);
  const text = (n) => (n && typeof n === 'object' ? (n.c || []).map(text).join('') : (n == null ? '' : String(n)));
  const cells = (k) => rows[k].c.map(text);
  const button = (k) => {
    let b = null;
    (function walk(n) { if (!n || typeof n !== 'object') return; if (n.t === 'button') b = n; (n.c || []).forEach(walk); })(rows[k]);
    return b;
  };
  return { calls, cells, button, keys: Object.keys(rows), props: (k) => rows[k].c[6].p };
}

const ITEMS = [
  { row: ROW('k-closed', '종료샘플상사', 'Z-C'), verdict: 'new_member', company: null, why: NEW },
  { row: ROW('k-near', '종료샘플상사2호점', 'Z-N'), verdict: 'new_member', company: null, why: NEW },
  { row: ROW('k-active', '(주)활성샘플', 'Z-A'), verdict: 'new_member', company: null, why: NEW },
];

test('①★ 이름이 종료 업체와 꼭 같으면 화면이 「종료 업체」로 알려 준다 (「후보 없음」이 아니다)', () => {
  const r = render(ITEMS);
  assert.ok(r.keys.length >= 3, '세 줄이 그려져야 한다');
  const c = r.cells('k-closed');
  assert.ok(c.some((t) => t === '종료 업체'), '★ 「무엇」 칸이 종료 업체를 말하지 않는다: ' + c.join(' | '));
  const hint = c[6];
  assert.ok(hint.indexOf('종료샘플상사') >= 0 && hint.indexOf('종료 업체') >= 0 && hint.indexOf('거래내역') >= 0, '★ 안내 글이 종료 업체·거래내역을 말하지 않는다: ' + hint);
  assert.doesNotMatch(hint, /후보 없음/);
  assert.equal(r.props('k-closed').title, hint, '긴 글은 title 에 전문');
  assert.equal(c.length, 8, '한 칸은 한 줄 — 칸 수가 늘지 않는다');
});

test('①★ 같은 이름이 여러 줄이어도 둘째 줄부터 «종료 업체» 표시가 남는다 (한 달에 출금이 여러 번 나간 업체)', () => {
  /* 찾은 결과를 캐시에서 꺼낼 때 «어떻게 찾았는지»가 빠지면 첫 줄만 종료 업체로 보이고 나머지는 일반 후보로 보였다 */
  const r = render([
    { row: ROW('t1', '종료샘플상사', 'Z-C'), verdict: 'new_member', company: null, why: NEW },
    { row: ROW('t2', '종료샘플상사', 'Z-C'), verdict: 'new_member', company: null, why: NEW },
    { row: ROW('t3', '종료샘플상사', 'Z-C'), verdict: 'new_member', company: null, why: NEW },
  ]);
  ['t1', 't2', 't3'].forEach((k) => {
    assert.ok(r.cells(k).some((t) => t === '종료 업체'), '★ ' + k + ' 줄이 종료 업체로 안 보인다');
    assert.equal(r.button(k).c.join(''), '거래내역에서 확정', '★ ' + k + ' 줄의 단추');
    r.button(k).p.onClick();
  });
  assert.deepEqual(r.calls.nav, ['fin/ledger', 'fin/ledger', 'fin/ledger']);
  assert.equal(r.calls.link.length + r.calls.patch.length + r.calls.income.length, 0, '★ 둘째 줄부터 종료 업체를 잇거나 입금을 만들었다');
});

test('②★ 종료 업체 단추는 회원코드도 입금도 만들지 않고 사람을 거래내역으로 보낸다', () => {
  const r = render(ITEMS);
  const b = r.button('k-closed');
  assert.ok(b && b.c.join('') === '거래내역에서 확정', '★ 단추 글자: ' + (b && b.c.join('')));
  b.p.onClick();
  assert.deepEqual(r.calls.nav, ['fin/ledger'], '★ 거래내역으로 가야 한다');
  assert.equal(r.calls.link.length, 0, '★ 종료 업체에 회원코드를 이었다');
  assert.equal(r.calls.patch.length, 0, '★ 저장소에 썼다');
  assert.equal(r.calls.income.length, 0, '★ 입금표시를 만들었다 — 사람이 확인하기 전에');
  assert.equal(r.calls.confirm.length, 0);
  assert.equal(r.calls.run.length, 0, '자동 처리를 다시 돌리지도 않는다(쓸 것이 없다)');
});

test('③★ 비슷한 이름은 종료 업체에 붙지 않는다 — 후보 없음, 눌러도 아무것도 안 한다', () => {
  const r = render(ITEMS);
  const c = r.cells('k-near');
  assert.equal(c[6], '후보 없음');
  assert.ok(!c.some((t) => t === '종료 업체'), '★ 비슷한 이름이 종료 업체로 보였다');
  const b = r.button('k-near');
  assert.equal(b.c.join(''), '이 업체로 잇기');
  b.p.onClick();
  assert.equal(r.calls.link.length, 0); assert.equal(r.calls.nav.length, 0);
  assert.ok(r.calls.toast.some((m) => /후보가 없습니다/.test(m)), '이유를 알린다');
});

test('③★ 활성 업체 후보는 예전 그대로 — 확인창을 거쳐 한 업체에만 잇는다', () => {
  const r = render(ITEMS);
  const c = r.cells('k-active');
  assert.match(c[6], /후보: \(주\)활성샘플 \(이름으로 찾음 — 누르기 전엔 안 이음\)/);
  const b = r.button('k-active');
  assert.equal(b.c.join(''), '이 업체로 잇기');
  b.p.onClick();
  assert.equal(r.calls.confirm.length, 1, '확인창을 거친다');
  assert.deepEqual(r.calls.link, [['Z-A', 'a1']]);
  assert.equal(r.calls.run.length, 1, '잇고 나면 한 번 다시 돈다');
  assert.equal(r.calls.nav.length, 0);
});

test('④★ 종료 업체에 이어져 있는 회원코드라도 자동 확정은 되지 않는다 (판정은 활성 업체만)', () => {
  const rows = [{ _k: 'x1', status: 'ok', wdate: '2026-04-17', code: 'Z-C', name: '종료샘플상사', amount: 110000 }];
  const co = { id: 'c1', name: '종료샘플상사', status: 'closed', cmsMemberCodes: ['Z-C'], monthlyAdvisoryFee: 110000 };
  const out = A.judgeRows(rows, { companies: [co], incomes: [], since: '2026-01-01' });
  assert.notEqual(out[0].verdict, 'auto', '★ 종료 업체의 출금이 사람 확인 없이 자동 확정된다');
  assert.equal(out[0].verdict, 'new_member');
  /* 이빨 — 같은 업체가 활성이면 같은 줄이 자동 확정된다(위 기대가 «다른 까닭으로 우연히» 맞은 게 아님) */
  const live = A.judgeRows(rows, { companies: [Object.assign({}, co, { status: 'active' })], incomes: [], since: '2026-01-01' });
  assert.equal(live[0].verdict, 'auto', '활성이면 자동 확정 — ④ 의 기대가 의미 있다');
});

test('화면 소스 — 후보는 한 곳(erpCmsAutoCandidate)에서 찾고, 그 호출만 종료 업체를 허용한다', () => {
  const helper = cutFn(ERP, 'function erpCmsAutoCandidate(ix, name)');
  assert.match(helper, /allowClosed\s*:\s*true/);
  const screen = cutFn(ERP, 'function FinanceAuto(props)');
  assert.doesNotMatch(screen, /erpNicebillMatchCo\(/, '화면이 직접 찾으면 허용 규칙이 두 군데로 갈라진다');
  assert.match(screen, /erpCmsAutoCandidate\(/);
  /* 종료 업체 갈래에서 잇기·입금 함수를 부르지 않는다 */
  const closedBranch = screen.slice(screen.indexOf("k.via === 'closed'"), screen.indexOf("k.via === 'closed'") + 160);
  assert.doesNotMatch(closedBranch, /erpCmsLinkMember|dbPatch|erpUpsertIncome|erpAddCompanyIncome/);
});
