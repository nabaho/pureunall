'use strict';
/* 「받은 시각은 최신인데 사본은 모자란」 기기를 스스로 고친다 (대표 신고 2026-10-05
   「여전히 데이터가 사라졌다. 상담접수 계약확정 다시 살려라」).

   서버 계약 167건 · 대표 크롬 사본 36건 · 그 사본의 받은 시각 = 서버 시각.
   u-감시가 시각만 보고 「그대로다」로 끝내 그 크롬은 영영 다시 안 받았다(엣지는 멀쩡).

   못 박는 것(규칙):
   ① 시각이 같아 건너뛸 때도, 건별 표는 서버 «번호 명단»과 견준다 — 서버에 있고 사본에 없으면 다시 받는다
   ② 사본에만 있는 줄·지운 업체 번호는 모자람으로 안 센다(병합 규칙 · 매번 통째로 받지 않게)
   ③ 맞으면 한동안 안 본다 · 모자랐으면 «봤다» 표시를 안 남긴다(다음에 또 본다)
   ④ 열쇠가 id 가 아닌 표는 명단에 넣지 않는다(늘 모자라 보여 켤 때마다 통째로 받는다)
   ⑤ 브라우저 저장소에 못 쓰면 「받은 시각」을 남기지 않는다 — 남기면 옛 사본을 최신으로 믿는다
   ⑥ 못 쓴 표는 캐시를 통째로 비울 때도 메모리 것을 남긴다 — 비우면 옛 사본이 화면에 뜬다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');
function strip(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1');
}
function body(s, head) {
  const i = s.indexOf(head);
  assert.ok(i >= 0, '못 찾음: ' + head);
  let d = 0;
  for (let k = s.indexOf('{', i); k < s.length; k++) {
    if (s[k] === '{') d++;
    else if (s[k] === '}') { d--; if (!d) return s.slice(i, k + 1); }
  }
  throw new Error('괄호가 안 닫힘: ' + head);
}
function line(s, re) { const m = re.exec(s); assert.ok(m, '못 찾음: ' + re); return m[0]; }
function mem() {
  const m = {};
  return { m, getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; } };
}

const IDCHK_KEYS = line(src, /var FB_IDCHK_KEYS = \[[\s\S]*?\];/);
const IDCHK_MS = line(src, /var _FB_IDCHK_MS = [^;]+;/);
const GAP = body(src, 'function _fbIdGap(');
const CHECK = body(src, 'function _fbIdCheck(');

function idctx(local, opts) {
  opts = opts || {};
  const ls = mem();
  const calls = { live: [], fetch: 0 };
  const ctx = {
    KEY: 'pureun_v6_', localStorage: ls, console: { warn() {} }, Date, Object, String, parseInt,
    fbDb: {}, _fbKeyLive: {}, _FB_HIDE_DELETED: { ledger_batches: 1 }, FB_DB_REST: 'https://x',
    _fbLocalArr: () => local.slice(),
    coTombMap: () => opts.tomb || {},
    firebase: { auth: () => ({ currentUser: { getIdToken: () => Promise.resolve('t') } }) },
    _bootFetch: () => { calls.fetch++; return Promise.resolve(opts.server || {}); },
    _fbLive: (k) => { calls.live.push(k); return Promise.resolve(true); },
  };
  vm.createContext(ctx);
  vm.runInContext(IDCHK_KEYS + '\n' + IDCHK_MS + '\n' + GAP + '\n' + CHECK, ctx);
  return { ctx, ls, calls };
}

test('①★ 시각이 같아도 서버에 있고 사본에 없는 번호가 있으면 다시 받는다', async () => {
  const { ctx, calls, ls } = idctx([{ id: 'c1' }], { server: { c1: true, c2: true, c3: true } });
  const n = await ctx._fbIdCheck('contracts');
  assert.equal(n, 2);
  assert.deepEqual(calls.live, ['contracts']);
  assert.equal(ls.getItem('pureun_v6__idchk_contracts'), null, '③ 모자랐으면 «봤다»를 안 남긴다');
});
test('② 사본에만 있는 줄은 탓하지 않는다 — 다시 안 받는다', async () => {
  const { ctx, calls, ls } = idctx([{ id: 'c1' }, { id: 'c2' }, { id: 'local-only' }], { server: { c1: true, c2: true } });
  assert.equal(await ctx._fbIdCheck('contracts'), 0);
  assert.equal(calls.live.length, 0);
  assert.ok(ls.getItem('pureun_v6__idchk_contracts'), '③ 맞으면 «봤다» 시각을 남긴다');
});
test('② 지운 업체 번호는 모자람으로 안 센다', async () => {
  const { ctx, calls } = idctx([{ id: 'a' }], { server: { a: true, gone: true }, tomb: { gone: { at: 'x' } } });
  assert.equal(await ctx._fbIdCheck('companies'), 0);
  assert.equal(calls.live.length, 0);
});
test('③ 방금 맞았으면 한동안 다시 안 본다(요금)', async () => {
  const { ctx, calls, ls } = idctx([{ id: 'c1' }], { server: { c1: true, c2: true } });
  ls.setItem('pureun_v6__idchk_contracts', String(Date.now()));
  await ctx._fbIdCheck('contracts');
  assert.equal(calls.fetch, 0);
});
test('④ 열쇠가 id 가 아닌 표·삭제표시를 빼는 표는 명단에 없다 — 안 본다', async () => {
  for (const k of ['leave_grants', 'closed_archive', 'ledger_batches', 'attendance_records']) {
    const { ctx, calls } = idctx([], { server: { a: true } });
    await ctx._fbIdCheck(k);
    assert.equal(calls.fetch, 0, k + ' 를 보면 켤 때마다 통째로 받는다');
  }
  const { ctx } = idctx([]);
  assert.ok(ctx.FB_IDCHK_KEYS.indexOf('contracts') >= 0, '계약은 반드시 본다 — 이번 신고의 표');
});
test('①★ 시각이 같아 건너뛰는 자리에서 번호 검사를 부른다', () => {
  const sync = strip(body(src, 'function _fbSyncKeys('));
  const at = sync.indexOf('if(need){');
  assert.ok(at >= 0);
  const rest = sync.slice(at);
  const elseAt = rest.indexOf('} else {');
  assert.ok(elseAt >= 0);
  const elseBody = rest.slice(elseAt, rest.indexOf('return;', elseAt));
  assert.match(elseBody, /_fbIdCheck\(\s*k\s*\)/, '건너뛸 때 번호 검사를 안 부르면 갇힌 기기가 영영 안 풀린다');
});

/* ── ⑤ 저장소에 못 쓰면 받은 시각을 안 남긴다 ── */
function writeCtx(failStore) {
  const ls = mem();
  ls.setItem('pureun_v6__meta_contracts', '111');
  const ctx = {
    KEY: 'pureun_v6_', localStorage: ls, JSON, _dbCache: {},
    _erpStoreSet: () => { if (failStore) throw new Error('QuotaExceededError'); },
    _scheduleFbChanged() {},
  };
  vm.createContext(ctx);
  vm.runInContext(body(src, 'function _fbWriteArr('), ctx);
  return { ctx, ls };
}
test('⑤★ 저장소가 차서 못 쓰면 「받은 시각」을 지운다 — 다음에 켤 때 다시 받게', () => {
  const { ctx, ls } = writeCtx(true);
  ctx._fbWriteArr('contracts', [{ id: 'a' }], 999);
  assert.equal(ls.getItem('pureun_v6__meta_contracts'), null);
  assert.equal(ctx._dbCache.contracts.length, 1, '메모리는 옳은 것을 든다');
});
test('⑤ 잘 썼으면 받은 시각을 남긴다', () => {
  const { ctx, ls } = writeCtx(false);
  ctx._fbWriteArr('contracts', [{ id: 'a' }], 999);
  assert.equal(ls.getItem('pureun_v6__meta_contracts'), '999');
});

/* ── ⑥ 못 쓴 표는 캐시 비우기에서 살아남는다 ── */
function storeCtx(full) {
  const store = mem();
  if (full) store.setItem = () => { throw new Error('QuotaExceededError'); };
  const ctx = { KEY: 'pureun_v6_', localStorage: store, sessionStorage: mem(), Object };
  vm.createContext(ctx);
  vm.runInContext(line(src, /var _dbStoreFailed = \{\};/) + '\nvar _dbCache = {};\n'
    + body(src, 'function _dbCacheClear(') + '\n' + body(src, 'function _erpStoreSet('), ctx);
  return ctx;
}
test('⑥★ 못 쓴 표는 「못 썼다」로 남고, 던지는 것은 예전 그대로다', () => {
  const ctx = storeCtx(true);
  assert.throws(() => ctx._erpStoreSet('contracts', '[]'));
  assert.equal(ctx._dbStoreFailed.contracts, true);
});
test('⑥★ 캐시를 통째로 비워도 못 쓴 표의 메모리 것은 남는다 · 나머지는 비운다', () => {
  const ctx = storeCtx(true);
  try { ctx._erpStoreSet('contracts', '[]'); } catch (_) {}
  vm.runInContext("_dbCache.contracts = [1,2,3]; _dbCache.cases = [9];", ctx);
  ctx._dbCacheClear();
  assert.equal(vm.runInContext('_dbCache.contracts && _dbCache.contracts.length', ctx), 3);
  assert.equal(vm.runInContext('_dbCache.cases', ctx), undefined);
});
test('⑥ 다시 잘 쓰면 「못 썼다」 표시가 풀린다', () => {
  const ctx = storeCtx(false);
  vm.runInContext('_dbStoreFailed.contracts = true;', ctx);
  ctx._erpStoreSet('contracts', '[]');
  assert.equal(ctx._dbStoreFailed.contracts, undefined);
});
