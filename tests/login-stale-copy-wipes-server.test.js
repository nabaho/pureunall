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
   ⓕ 옛 숫자 열쇠 표(연장근로·비정기급여)도 통째로 안 민다 — 트랜잭션으로 적힌 줄만 얹는다
   ⓖ 사번 묶음표(휴가부여)는 «바뀐 사번»만 적고 얹는다 — 뭉개진 배열도 옛 자리를 지우지 않는다

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

/* ══════ ⓕ 옛 숫자 열쇠 표·사번 묶음표도 통째로 안 민다 (2026-09-23 저녁) ══════
   연장근로(overtime_records)·비정기급여(payroll_irregular)는 서버가 아직 배열 꼴이고,
   휴가부여(leave_grants)는 사번 묶음표가 옛 코드에 뭉개져 번호 없는 배열이 돼 있다.
   예전에는 이 셋만 «사본을 지우고 dbSet» 하는 옛 길로 갔다. */
function flushLegacy(opts) {
  const calls = { dbSet: [], storeRemove: [], update: [], txn: [], alert: 0 };
  const server = JSON.parse(JSON.stringify(opts.server));   // { 'data/표': {v,u} }
  const store = {};
  Object.keys(opts.사본).forEach((k) => { store[k] = JSON.stringify(opts.사본[k]); });
  const ctx = {
    JSON, Object, Array, String, Number, Date, Math, console: { log() {}, warn() {} },
    window: { _fbPendingKeys: Object.assign({}, opts.flags), _fbPendingOps: JSON.parse(JSON.stringify(opts.ops || {})) },
    DIFF_KEYS: ['payroll_monthly', 'overtime_records', 'leave_grants', 'payroll_irregular'],
    _fbObjForm: Object.assign({ overtime_records: false, leave_grants: false, payroll_irregular: false }, opts.objForm),
    fbDb: {
      ref(path) {
        return {
          update(u) { calls.update.push(u); return Promise.resolve(); },
          transaction(fnT, cb) {
            calls.txn.push(path);
            const res = fnT(server[path] === undefined ? null : JSON.parse(JSON.stringify(server[path])));
            if (res === undefined) { cb(null, false, null); return; }
            server[path] = res;
            cb(null, true, { val: () => JSON.parse(JSON.stringify(res)) });
          },
        };
      },
    },
    _fbSynced: true, KEY: 'k_',
    localStorage: { setItem() {} },
    _dbCache: {},
    fbShouldSync() { return true; },
    _erpStoreGet(k) { return store[k] || null; },
    _erpStoreSet(k, v) { store[k] = v; },
    _erpStoreRemove(k) { calls.storeRemove.push(k); delete store[k]; },
    dbGet(k, d) { return store[k] ? JSON.parse(store[k]) : d; },
    dbSet(k, v) { calls.dbSet.push({ k }); },
    _scheduleFbChanged() {}, fbSyncFail() {},
    erpAlert() { calls.alert++; },
  };
  ctx.window.erpAlert = ctx.erpAlert;
  vm.createContext(ctx);
  ['function _fbOpsEmpty(', 'function _fbOpsApply(', 'function _fbOpsUpdates(', 'function _fbReplayOps(',
   'function _fbReplayOpsTxn(', 'function _fbReplayMapOps(', 'function _fbOpsPutBack(', 'function _fbTakeServer(',
   'function _erpNameMap(', 'function erpObjIsMap(', 'function erpObjMerge(', 'function normalizeFbValue(',
   'function arrayToIdMap(', 'function _fbStableId(', 'function _flushPendingLocalNewer('].forEach((d) => vm.runInContext(fn(d), ctx));
  ctx._flushPendingLocalNewer();
  return { calls, server, store, ctx };
}
const ot = (i, extra) => Object.assign({ id: 'ot-' + i, sid: 'P-00' + (i % 5), date: '2026-06-' + String(i + 1).padStart(2, '0'), hours: 2 }, extra || {});

test('ⓕ★★★ 옛 숫자 열쇠 표(연장근로) — 낡은 PC 가 «한 줄» 고쳤으면 서버 11건 위에 그 한 줄만 얹는다', () => {
  const 서버줄 = []; for (let i = 0; i < 11; i++) 서버줄.push(ot(i));
  /* 낡은 PC 사본: 남이 넣은 끝 두 줄이 없다 + 내가 오프라인에서 5번 줄을 고쳤다 */
  const 고친 = ot(5, { hours: 4 });
  const 사본 = 서버줄.slice(0, 9).map((x, i) => (i === 5 ? 고친 : x));
  const { calls, server, store } = flushLegacy({
    server: { 'data/overtime_records': { v: 서버줄, u: 1 } },
    사본: { overtime_records: 사본 },
    flags: { overtime_records: true },
    ops: { overtime_records: { up: { [고친.id]: 고친 }, rm: {} } },
  });
  assert.deepEqual(calls.storeRemove, [], '★★★ 이 PC 사본을 지우고 저장합니다 — 급여 40건이 사라진 그 옛 길입니다');
  assert.deepEqual(calls.dbSet, [], '★★★ 낡은 사본(9건)을 dbSet 으로 통째 밉니다 — 남이 넣은 2건이 지워집니다');
  const v = server['data/overtime_records'].v;
  assert.ok(!Array.isArray(v), '★ 쓰는 김에 이름 열쇠 꼴로 안 바뀌었습니다 — 다음에도 옛 길을 탑니다');
  assert.equal(Object.keys(v).length, 11, '★★★ 서버 11건이 ' + Object.keys(v).length + '건이 됐습니다 — 남의 줄을 지웠습니다');
  assert.equal(v['ot-5'].hours, 4, '★★ 내가 고친 한 줄이 안 올라갔습니다');
  assert.ok(v['ot-9'] && v['ot-10'], '★★ 남이 넣은 줄이 사라졌습니다');
  assert.equal(JSON.parse(store.overtime_records).length, 11, '★ 이 PC 사본이 서버 결과로 안 맞춰졌습니다');
});

test('ⓕ★★ 옛 숫자 열쇠 표에 «표 통째 표시»만 있으면 아무것도 안 민다', () => {
  const 서버줄 = []; for (let i = 0; i < 11; i++) 서버줄.push(ot(i));
  const { calls, server } = flushLegacy({
    server: { 'data/overtime_records': { v: 서버줄, u: 1 } },
    사본: { overtime_records: 서버줄.slice(0, 3) },
    flags: { overtime_records: true },
  });
  assert.deepEqual(calls.dbSet, [], '★★★ 적힌 줄이 없는데 사본 3건을 통째로 밉니다 — 서버 11건이 3건이 됩니다');
  assert.deepEqual(calls.storeRemove, []);
  assert.equal(server['data/overtime_records'].v.length, 11);
});

test('ⓕ★ 서버 줄이 «모두» 번호가 없으면 손대지 않고 다음에 다시 — 이름 열쇠 꼴로 바꾸면 전부 빠진다', () => {
  const 서버줄 = [{ sid: 'P-001', hours: 1 }, { sid: 'P-002', hours: 2 }];
  const { calls, server, ctx } = flushLegacy({
    server: { 'data/payroll_irregular': { v: 서버줄, u: 1 } },
    사본: { payroll_irregular: [ot(0, { hours: 9 })] },
    flags: { payroll_irregular: true },
    ops: { payroll_irregular: { up: { 'ot-0': ot(0, { hours: 9 }) }, rm: {} } },
  });
  assert.deepEqual(server['data/payroll_irregular'].v, 서버줄, '★★ 번호 없는 줄들을 버렸습니다');
  assert.deepEqual(calls.dbSet, []);
  assert.ok(ctx.window._fbPendingOps.payroll_irregular, '★ 못 보낸 줄을 버렸습니다 — 다음 연결 때 다시 보내야 합니다');
});

test('ⓕ★ 번호 없는 줄이 «섞여» 있으면 한결같은 번호를 받아 함께 남는다 — 한 줄도 안 빠진다', () => {
  const { server } = flushLegacy({
    server: { 'data/payroll_irregular': { v: [ot(0), { sid: 'P-001', hours: 1 }], u: 1 } },
    사본: { payroll_irregular: [ot(0, { hours: 9 })] },
    flags: { payroll_irregular: true },
    ops: { payroll_irregular: { up: { 'ot-0': ot(0, { hours: 9 }) }, rm: {} } },
  });
  const v = server['data/payroll_irregular'].v;
  assert.equal(Object.keys(v).length, 2, '★★ 번호 없던 줄이 빠졌습니다');
  assert.equal(v['ot-0'].hours, 9);
});

test('ⓕ★★ 낡은 PC 사본이 작아도, 서버 기준으로 절반 넘게 지우게 되면 안 보내고 알린다', () => {
  const 서버줄 = []; for (let i = 0; i < 12; i++) 서버줄.push(ot(i));
  const rm = {}; 서버줄.slice(0, 8).forEach((x) => { rm[x.id] = 1; });
  /* 이 PC 사본은 3건뿐이라 이 PC 기준 검사(10건 이상)는 안 걸린다 — 서버 기준으로 다시 봐야 한다 */
  const { calls, server } = flushLegacy({
    server: { 'data/overtime_records': { v: 서버줄, u: 1 } },
    사본: { overtime_records: 서버줄.slice(8, 11) },
    flags: { overtime_records: true },
    ops: { overtime_records: { up: {}, rm } },
  });
  assert.equal(server['data/overtime_records'].v.length, 12, '★★ 서버 12건 가운데 8건 지우기를 묻지도 않고 보냅니다');
  assert.equal(calls.alert, 1, '★ 막았다고 알리지 않습니다');
});

/* 휴가부여 — 서버가 뭉개진 배열 11칸(번호·사번 없음). 남이 P-002 를 이미 고쳐 둔 상태 */
const 뭉갠휴가 = () => { const a = []; for (let i = 0; i < 11; i++) a.push({ 2025: { total: 16, carryOver: 0 } }); return a; };

test('ⓖ★★★ 사번 묶음표(휴가부여) — 적힌 사번만 얹는다. 옛 11칸도, 남이 고친 사번도 그대로다', () => {
  const 서버v = Object.assign({}, 뭉갠휴가(), { 'P-002': { 2026: { total: 20, carryOver: 1 } } });
  const 내것 = { 2026: { total: 17, carryOver: 0 } };
  const { calls, server } = flushLegacy({
    server: { 'data/leave_grants': { v: 서버v, u: 1 } },
    사본: { leave_grants: Object.assign({}, 뭉갠휴가(), { 'P-001': 내것, 'P-002': { 2026: { total: 15, carryOver: 0 } } }) },
    flags: { leave_grants: true },
    ops: { leave_grants: { up: {}, rm: {}, map: { set: { 'P-001': 내것 }, del: {} } } },
    objForm: { leave_grants: true },
  });
  assert.deepEqual(calls.dbSet, [], '★★★ 사본 전체를 dbSet 으로 밉니다 — 남이 고친 P-002 가 옛 값으로 돌아갑니다');
  const v = server['data/leave_grants'].v;
  assert.deepEqual(v['P-001'], 내것, '★★ 내가 고친 사번이 안 올라갔습니다');
  assert.equal(v['P-002'][2026].total, 20, '★★★ 남이 고친 P-002 를 이 PC 의 옛 값으로 되돌렸습니다');
  for (let i = 0; i < 11; i++) assert.ok(v[String(i)], '★★ 옛 자리 ' + i + ' 를 지웠습니다');
});

test('ⓖ★★ 서버가 «뭉개진 배열» 그대로여도 얹는다 — 막으면 휴가부여는 영영 저장이 안 된다', () => {
  const 내것 = { 2026: { total: 17, carryOver: 0 } };
  const { server } = flushLegacy({
    server: { 'data/leave_grants': { v: 뭉갠휴가(), u: 1 } },
    사본: { leave_grants: 뭉갠휴가() },
    flags: { leave_grants: true },
    ops: { leave_grants: { up: {}, rm: {}, map: { set: { 'P-001': 내것 }, del: {} } } },
  });
  const v = server['data/leave_grants'].v;
  assert.ok(!Array.isArray(v) && v['P-001'], '★★ 뭉개진 배열이라는 까닭으로 저장을 막았습니다');
  assert.equal(Object.keys(v).length, 12, '★★ 옛 11칸 가운데 지운 것이 있습니다');
});

test('ⓖ★ 번호 있는 줄의 배열(목록 표)에는 사번 열쇠를 얹지 않는다 — 모양이 다른 것이다', () => {
  const { server } = flushLegacy({
    server: { 'data/leave_grants': { v: [ot(0), ot(1)], u: 1 } },
    사본: { leave_grants: {} },
    flags: { leave_grants: true },
    ops: { leave_grants: { up: {}, rm: {}, map: { set: { 'P-001': { 2026: {} } }, del: {} } } },
  });
  assert.ok(Array.isArray(server['data/leave_grants'].v), '★ 목록 표에 사번 열쇠를 섞었습니다');
});

test('ⓖ★★ 사번 묶음표의 못 보낸 변경은 «바뀐 사번»만 적힌다 — 뭉개진 배열에서 시작해도', () => {
  const ctx = { JSON, Object, Array, String };
  vm.createContext(ctx);
  ['function erpObjIsMap(', 'function erpObjDiff(', 'function _erpNameMap(', 'function _fbMapOpsAdd(']
    .forEach((d) => vm.runInContext(fn(d), ctx));
  const prev = 뭉갠휴가();
  const next = Object.assign(ctx._erpNameMap(prev), { 'P-001': { 2026: { total: 17 } } });
  const ops = ctx._fbMapOpsAdd(null, prev, next);
  assert.deepEqual(Object.keys(ops.map.set), ['P-001'], '★★ 바꾸지 않은 칸까지 적습니다: ' + Object.keys(ops.map.set).join(','));
  assert.deepEqual(Object.keys(ops.map.del), [], '★★ 옛 11칸을 «지운 것»으로 적습니다 — 다시 보낼 때 서버에서 지웁니다');
});

test('ⓖ★★ 휴가부여 저장은 뭉개진 배열을 지도로 펴서 쓴다 — 아니면 「수정됨」이라 뜨고 아무것도 안 남는다', () => {
  /* 휴가부여를 «쓰는» 자리마다, 바로 앞에서 읽은 값을 지도로 폈는가 */
  const re = /dbSet\('leave_grants'/g; let m, n = 0;
  while ((m = re.exec(SRC))) {
    n++;
    const before = SRC.slice(Math.max(0, m.index - 700), m.index);
    const rd = before.lastIndexOf("dbGet('leave_grants'");
    assert.ok(rd >= 0, '휴가부여 저장 앞에서 읽는 자리를 못 찾았습니다');
    assert.match(before.slice(Math.max(0, rd - 14), rd), /_erpNameMap\($/,
      '★★ 휴가부여 저장이 읽은 값을 지도로 안 폅니다 — 서버가 뭉개진 배열이면 사번이 JSON 에서 조용히 빠집니다');
  }
  assert.ok(n >= 2, '휴가부여 저장 자리를 못 찾았습니다');
  const body = fn('function dbSet(');
  const g = body.indexOf("_mGuard = '형태'");
  assert.ok(g > 0, '묶음표 형태 보호를 못 찾았습니다');
  assert.match(body.slice(Math.max(0, g - 700), g), /_erpNameMap\(_mBase\)/,
    '★★ 서버가 뭉개진 배열이면 묶음표 저장이 «형태» 보호에 걸려 영영 실패합니다');
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
  assert.match(body.slice(i, i + 900), /_fbOpsAdd\(|_fbPendRecord\(/, '★★ 동기화 전에 보류한 저장이 «줄»로 안 적힙니다');
  const j = body.indexOf('var _markPending = function(');
  assert.ok(j > 0, '보내기 실패 자리를 못 찾았습니다');
  assert.match(body.slice(j, j + 700), /_fbOpsAdd\(|_fbPendRecord\(/, '★★ 보내기에 실패한 저장이 «줄»로 안 적힙니다');
  /* 적는 한 자리가 줄·열쇠 둘 다 적는가 */
  const rec = fn('function _fbPendRecord(');
  assert.match(rec, /_fbOpsAdd\(/, '★★ 목록 표를 줄로 안 적습니다');
  assert.match(rec, /_fbMapOpsAdd\(/, '★★ 사번 묶음표를 열쇠로 안 적습니다 — 다시 보낼 때 사본 전체가 밀립니다');
});

test('ⓑ★★ 로그인 때 서버 값을 받는 자리가 «적힌 줄»로만 되살린다', () => {
  const body = fn('function _fbApplyRecordInner(');
  assert.match(body, /_fbPendKeepRows\(/, '★★ 되살리는 줄을 고르는 셈을 안 씁니다 — 「이 PC 에만 있는 줄」을 전부 되살립니다');
  assert.match(body, /_fbReplayOps\(k\)/, '★ 적힌 줄을 다시 보내는 길이 없습니다');
});
