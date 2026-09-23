'use strict';
/* 낡은 PC 가 로그인해도 서버 자료를 지우거나 되살리지 않는다 (대표 지시 2026-09-23)

   「다른 사람들이 로그인 할때마다 계속 데이터 삭제 및 소실 문제가 끊임없이 발생한다
    정확한 이유를 찾아서 완벽하게 해결해라.」

   ── 무슨 일이 있었나 (2026-09-23 실측, 급여 payroll_monthly) ──
   15:14 백업 526건 → 15:16 서버 486건. 한 PC 가 낡은 사본으로 급여표를 «통째로» 다시 써서
   다른 PC 가 막 넣은 40건이 지워졌다. 그보다 앞서 이미 지워졌던 옛 열쇠 41건이 되살아나 있었다.
   다른 쪽 PC 에는 「263건이 한꺼번에 지워졌습니다」가 떴다.

   ── 뿌리 — 셋이 같은 착각: 「서버에 없고 이 PC 에만 있는 줄 = 내가 못 보낸 변경」 ──
   ① 못 보낸 표시가 «표 통째»였다 — 어느 줄을 바꿨는지 몰랐다
   ② 로그인해 서버 값을 받을 때 「이 PC 에만 있는 줄」을 전부 되살렸다 — 남이 지운 줄까지
   ③ 다시 보내는 일꾼이 사본을 지우고 dbSet 을 불러, 이전 값 없는 저장이 서버 표를 통째로 바꿨다

   ── 여기서 못 박는 것 ──
   ⓐ 못 보낸 변경은 «줄»로 적힌다 — 이 저장이 실제로 바꾼 것뿐이다
   ⓑ 되살리는 것은 «적힌 줄»뿐이다 — 남이 지운 줄은 되살리지 않는다
   ⓒ 다시 보낼 때 «그 줄만» 보낸다 — 다른 줄은 한 줄도 건드리지 않는다
   ⓓ 이름 열쇠 표를 «통째로» 밀지 않는다 — 사본을 지우고 부르는 옛 길을 안 탄다
   ⓔ 기준을 모르는 저장은 서버 줄을 하나도 지우지 않는다
   ⓕ 옛 숫자 열쇠 표는 예전 길 그대로다 — 줄로 쓸 수 없어서다

   실행: node --test tests/login-stale-copy-wipes-server.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8');
const fn = (decl) => cutFn(SRC, decl);

/* 순수 셈들을 한 방에 싣는다 */
function pure() {
  const ctx = { JSON, Object, Array, String, Number };
  vm.createContext(ctx);
  ['function _fbOpsAdd(', 'function _fbOpsEmpty(', 'function _fbOpsApply(',
   'function _fbOpsUpdates(', 'function _fbPendKeepRows(', 'function _fbUnknownBaseUpserts(']
    .forEach((d) => vm.runInContext(fn(d), ctx));
  return ctx;
}

/* 오늘 서버 모양 그대로 — 급여 한 줄 */
function pay(sid, ym, extra) {
  return Object.assign({ id: 'pay-' + sid + '-' + ym, empSid: sid, ym: ym, baseSalary: 3000000 }, extra || {});
}
/* 서버 526건 = 원래 486건 + 다른 PC 가 막 넣은 40건 */
function 오늘() {
  const 원래 = [];
  for (let i = 0; i < 486; i++) 원래.push(pay('A-' + String(i % 11).padStart(3, '0'), '2025-' + String(i).padStart(4, '0')));
  const 새것 = [];
  for (let i = 0; i < 40; i++) 새것.push(pay('P-' + String(i % 7).padStart(3, '0'), '202601' + i));
  return { 원래, 새것, 서버: 원래.concat(새것) };
}
const idMap = (arr) => { const m = {}; arr.forEach((x) => { m[x.id] = x; }); return m; };

/* ══════ ⓐ 줄로 적는다 ══════ */
test('ⓐ★★ 못 보낸 변경은 «이 저장이 바꾼 줄»만 적힌다 — 사본 전체가 아니다', () => {
  const P = pure();
  const { 원래 } = 오늘();
  const 고친 = 원래.map((x, i) => (i === 7 ? Object.assign({}, x, { baseSalary: 3100000 }) : x));
  const ops = P._fbOpsAdd(null, 원래, 고친);
  assert.deepEqual(Object.keys(ops.up), [원래[7].id], '★★ 한 줄 고쳤는데 다른 줄까지 «못 보낸 것»으로 적혔습니다');
  assert.deepEqual(Object.keys(ops.rm), [], '★ 지우지 않았는데 지운 것으로 적혔습니다');

  const 뺀 = 원래.filter((_, i) => i !== 3);
  const ops2 = P._fbOpsAdd(null, 원래, 뺀);
  assert.deepEqual(Object.keys(ops2.rm), [원래[3].id], '★ 지운 줄이 적히지 않았습니다');
});

test('ⓐ★ 여러 번 못 보내면 «쌓인다» — 되살렸다 지웠으면 마지막 뜻이 남는다', () => {
  const P = pure();
  const a = pay('A-001', '2026-01'), b = pay('A-002', '2026-01');
  let ops = P._fbOpsAdd(null, [a], [a, b]);         // b 넣음
  ops = P._fbOpsAdd(ops, [a, b], [a]);              // b 다시 지움
  assert.equal(ops.up[b.id], undefined, '★ 지운 줄이 «넣을 것»으로 남아 되살아납니다');
  assert.equal(ops.rm[b.id], 1);
  ops = P._fbOpsAdd(ops, [a], [a, b]);              // 또 넣음
  assert.ok(ops.up[b.id] && !ops.rm[b.id], '★ 다시 넣었는데 «지울 것»으로 남았습니다');
});

/* ══════ ⓑ 되살리기 ══════ */
test('ⓑ★★ 로그인 때 되살리는 것은 «내가 못 보낸 줄»뿐 — 남이 지운 41건은 안 되살린다', () => {
  const P = pure();
  const { 원래 } = 오늘();
  /* 낡은 PC 사본: 서버에서 이미 지워진 옛 열쇠 41건 + 내가 오프라인에서 넣은 1건 */
  const 지워진옛것 = [];
  for (let i = 0; i < 41; i++) 지워진옛것.push(pay('X-' + i, '2026' + String(i).padStart(2, '0')));
  const 내가넣은 = pay('A-009', '2026-09');
  const 사본 = 원래.concat(지워진옛것, [내가넣은]);
  const ops = P._fbOpsAdd(null, 원래.concat(지워진옛것), 사본);   // 이번 저장이 바꾼 것 = 내가넣은 하나

  const 되살림 = P._fbPendKeepRows(사본, 원래, ops);
  assert.deepEqual(Array.from(되살림).map((x) => x.id), [내가넣은.id],
    '★★ 남이 지운 줄까지 되살립니다 — 2026-09-23 옛 열쇠 41건이 되살아난 바로 그 길입니다: ' + 되살림.length + '건');
});

test('ⓑ 적힌 것이 없으면(옛 숫자 열쇠 표) 예전 뜻 그대로다', () => {
  const P = pure();
  const 사본 = [pay('A-1', 'x'), pay('A-2', 'y')];
  const 서버 = [pay('A-1', 'x')];
  assert.deepEqual(Array.from(P._fbPendKeepRows(사본, 서버, null)).map((x) => x.id), ['pay-A-2-y']);
});

/* ══════ ⓒ 그 줄만 보낸다 ══════ */
test('ⓒ★★ 다시 보낼 때 «적힌 줄»만 경로로 보낸다 — 서버의 다른 줄은 한 줄도 안 건드린다', () => {
  const P = pure();
  const { 서버 } = 오늘();
  const 고친 = Object.assign({}, 서버[10], { baseSalary: 1 });
  const ops = { up: { [고친.id]: 고친 }, rm: { [서버[20].id]: 1 } };
  const u = P._fbOpsUpdates('payroll_monthly', ops, 123);
  const 경로 = Object.keys(u).filter((p) => p !== 'data/payroll_monthly/u');
  assert.equal(경로.length, 2, '★★ 적힌 두 줄 말고 다른 줄까지 보냅니다: ' + 경로.length);
  assert.equal(u['data/payroll_monthly/v/' + 서버[20].id], null, '★ 지울 줄이 null 로 안 갑니다');
  assert.ok(!('data/payroll_monthly' in u) && !('data/payroll_monthly/v' in u),
    '★★ 표 통째 경로에 씁니다 — 그러면 서버 표가 통째로 바뀝니다');

  /* 이 PC 사본에 얹어도 다른 줄은 그대로다 */
  const next = P._fbOpsApply(서버, ops);
  assert.equal(next.length, 서버.length - 1);
  assert.ok(next.some((x) => x.id === 고친.id && x.baseSalary === 1));
});

/* ══════ ⓓ 통째로 밀지 않는다 — 실제로 돌려 본다 ══════ */
function flushWith(opts) {
  /* _flushPendingLocalNewer 와 _fbReplayOps 를 가짜 서버로 돌린다 */
  const calls = { dbSet: [], storeRemove: [], update: [], alert: 0 };
  const store = {};
  store.payroll_monthly = JSON.stringify(opts.사본);
  if (opts.legacy) store.overtime_records = JSON.stringify(opts.legacy);
  const ctx = {
    JSON, Object, Array, String, Number, Date, console: { log() {}, warn() {} },
    window: { _fbPendingKeys: Object.assign({}, opts.flags), _fbPendingOps: opts.ops ? { payroll_monthly: opts.ops } : {} },
    DIFF_KEYS: ['payroll_monthly', 'overtime_records'],
    _fbObjForm: { payroll_monthly: true, overtime_records: false },
    fbDb: { ref() { return { update(u) { calls.update.push(u); return Promise.resolve(); } }; } },
    _fbSynced: true,
    KEY: 'k_',
    localStorage: { setItem() {} },
    _dbCache: {},
    fbShouldSync() { return true; },
    _erpStoreGet(k) { return store[k] || null; },
    _erpStoreSet(k, v) { store[k] = v; },
    _erpStoreRemove(k) { calls.storeRemove.push(k); delete store[k]; },
    dbGet(k, d) { return store[k] ? JSON.parse(store[k]) : d; },
    dbSet(k, v) { calls.dbSet.push({ k, n: Array.isArray(v) ? v.length : null }); },
    _scheduleFbChanged() {},
    fbSyncFail() {},
    erpAlert() { calls.alert++; },
  };
  ctx.window.erpAlert = ctx.erpAlert;
  vm.createContext(ctx);
  ['function _fbOpsEmpty(', 'function _fbOpsApply(', 'function _fbOpsUpdates(', 'function _fbReplayOps(',
   'function _flushPendingLocalNewer('].forEach((d) => vm.runInContext(fn(d), ctx));
  ctx._flushPendingLocalNewer();
  return { calls, store };
}

test('ⓓ★★★ 낡은 PC(486건)가 로그인해도 서버(526건)를 통째로 덮지 않는다 — 오늘 그 장면', () => {
  const { 원래 } = 오늘();
  /* 적힌 줄 없이 «표 통째» 표시만 남은 낡은 PC — 오늘 40건을 지운 쪽이다 */
  const { calls } = flushWith({ 사본: 원래, flags: { payroll_monthly: true } });
  assert.deepEqual(calls.storeRemove, [],
    '★★★ 이 PC 사본을 지우고 저장합니다 — 이전 값 없는 저장이 되어 서버 표를 통째로 바꾸는 길입니다');
  assert.deepEqual(calls.dbSet, [],
    '★★★ 낡은 사본 전체를 dbSet 으로 밉니다 — 2026-09-23 급여 40건이 이렇게 사라졌습니다');
  assert.deepEqual(calls.update, [], '★ 바꾼 줄이 없는데 서버에 무엇을 보냅니다');
});

test('ⓓ★★ 낡은 PC 가 오프라인에서 «한 줄» 고쳤으면 — 그 한 줄만 보낸다', () => {
  const { 원래 } = 오늘();
  const 고친 = Object.assign({}, 원래[5], { baseSalary: 3200000 });
  const 사본 = 원래.map((x, i) => (i === 5 ? 고친 : x));
  const { calls, store } = flushWith({ 사본, flags: { payroll_monthly: true }, ops: { up: { [고친.id]: 고친 }, rm: {} } });
  assert.deepEqual(calls.dbSet, [], '★★ 한 줄 고친 것을 표 통째 저장으로 보냅니다');
  assert.equal(calls.update.length, 1, '★ 고친 줄을 안 보냅니다 — 오프라인 변경이 사라집니다');
  const 경로 = Object.keys(calls.update[0]).filter((p) => !/\/u$/.test(p));
  assert.deepEqual(경로, ['data/payroll_monthly/v/' + 고친.id], '★★ 고친 한 줄 말고 다른 줄까지 보냅니다: ' + 경로.length);
  assert.ok(JSON.parse(store.payroll_monthly).some((x) => x.id === 고친.id && x.baseSalary === 3200000),
    '★ 이 PC 화면에서 고친 값이 사라졌습니다');
});

test('ⓓ★ 보류됐던 지우기가 절반을 넘으면 보내지 않고 알린다 — 동기화 전 저장은 급감 차단을 안 거쳤다', () => {
  const { 원래 } = 오늘();
  const rm = {}; 원래.slice(0, 300).forEach((x) => { rm[x.id] = 1; });
  const { calls } = flushWith({ 사본: 원래, flags: { payroll_monthly: true }, ops: { up: {}, rm } });
  assert.deepEqual(calls.update, [], '★★ 300건 지우기를 묻지도 않고 서버에 보냅니다');
  assert.equal(calls.alert, 1, '★ 막았다고 사람에게 알리지 않습니다');
});

test('ⓕ 옛 숫자 열쇠 표는 예전 길 그대로 — 줄로 쓸 수 없어서다', () => {
  const { 원래 } = 오늘();
  const { calls } = flushWith({ 사본: 원래, legacy: [{ id: 'o1' }], flags: { overtime_records: true } });
  assert.deepEqual(calls.dbSet.map((c) => c.k), ['overtime_records'], '옛 표의 못 보낸 것이 안 올라갑니다');
});

/* ══════ ⓔ 기준을 모르면 지우지 않는다 ══════ */
test('ⓔ★★★ 기준(prev)을 모르는 저장은 서버 줄을 «하나도» 안 지운다 — 바뀐 줄만 얹는다', () => {
  const P = pure();
  const { 원래, 서버 } = 오늘();
  const 사본 = 원래.map((x, i) => (i === 0 ? Object.assign({}, x, { baseSalary: 1 }) : x));
  const u = P._fbUnknownBaseUpserts('payroll_monthly', 사본, idMap(서버), 9);
  const 지움 = Object.keys(u).filter((p) => u[p] === null);
  assert.deepEqual(지움, [], '★★★ 기준도 모르면서 서버 줄을 지웁니다: ' + 지움.length + '건');
  const 얹음 = Object.keys(u).filter((p) => !/\/u$/.test(p));
  assert.deepEqual(얹음, ['data/payroll_monthly/v/' + 사본[0].id], '★ 바뀐 줄 말고 다른 것까지 씁니다');
  assert.equal(P._fbUnknownBaseUpserts('payroll_monthly', 원래, idMap(서버), 9), null,
    '★ 바뀐 것이 없는데 무엇을 보냅니다');
});

test('ⓔ★★ 그 그물이 «통째 덮어쓰기 바로 앞»에 있다 — 뒤에 있으면 이미 늦다', () => {
  const body = fn('function dbSet(');
  const net = body.indexOf('_fbUnknownBaseUpserts(k, v, sv.v, ts)');
  const wipe = body.indexOf("fbDb.ref('data/'+k).set({v:fbValue, u:ts})");
  assert.ok(net > 0, '★★ 기준 없는 저장을 거르는 그물이 dbSet 에 없습니다');
  assert.ok(wipe > net, '★★ 그물이 통째 덮어쓰기보다 뒤에 있습니다 — 덮은 뒤에 거르면 늦습니다');
  const cond = body.slice(body.lastIndexOf('if(', net), net);
  assert.match(cond, /!Array\.isArray\(prev\)/, '★ 「기준을 모를 때」라는 조건이 빠졌습니다 — 보통 저장까지 막습니다');
});

/* ══════ ⓐ 가 실제 저장 길에 붙어 있는가 ══════ */
test('ⓐ★★ 동기화 전 보류·보내기 실패 두 자리 모두 «줄»로 적는다', () => {
  const body = fn('function dbSet(');
  const i = body.indexOf('if(!_fbSynced){');
  assert.ok(i > 0, '동기화 전 보류 자리를 못 찾았습니다');
  assert.match(body.slice(i, i + 900), /_fbOpsAdd\(/, '★★ 동기화 전에 보류한 저장이 «줄»로 안 적힙니다');
  const j = body.indexOf('var _markPending = function(');
  assert.ok(j > 0, '보내기 실패 자리를 못 찾았습니다');
  assert.match(body.slice(j, j + 700), /_fbOpsAdd\(/, '★★ 보내기에 실패한 저장이 «줄»로 안 적힙니다');
});

test('ⓑ★★ 로그인 때 서버 값을 받는 자리가 «적힌 줄»로만 되살린다', () => {
  const body = fn('function _fbApplyRecordInner(');
  assert.match(body, /_fbPendKeepRows\(/, '★★ 되살리는 줄을 고르는 셈을 안 씁니다 — 「이 PC 에만 있는 줄」을 전부 되살립니다');
  assert.match(body, /_fbReplayOps\(k\)/, '★ 적힌 줄을 다시 보내는 길이 없습니다');
});
