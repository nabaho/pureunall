'use strict';
/* 자문수입 id 자동복구가 «되풀이 새로고침 고리»를 만들지 않는다 (2026-09-17 저녁, 대표 화면 캡처로 확정)

   ■ 무엇이 있었나
     부팅 12초 뒤 _fbSynced 가 강제로 참 → 자가점검이 이 기기 사본에서 「id 없는 기록이 섞였다」
     → erpRepairFinanceIncomeIds({auto:true}) → 거래(transaction)는 구독 없는 «찬 자리»라 null 로
     먼저 불리고 옛 코드는 거기서 접었다 → committed:false → 그런데 갈무리는 err 만 보고
     «무조건 location.reload()» → 사본의 껍데기는 sessionStorage 에 그대로 → 다음 부팅도 같다.
     탭이 약 20초마다 스스로 다시 켜지며 매번 서버 자료를 통째로 다시 받았다(시간당 ≈500MB).
     대표 화면: 「이 탭이 3분 안에 8번 다시 켜졌습니다 (reload)」 — 우리 코드였다.

   ■ 규칙
     ① 실제로 고친 것이 있을 때만, 탭 세션에 한 번만 새로 연다. committed 가 아니면 절대 안 연다.
     ② 자동 길은 탭 세션에 한 번만 돈다.
     ③ 서버가 이미 온전하면 서버는 건드리지 않고 사본만 맞춘다 — 새로고침 없이 끝.
     ④ 찬 자리(null)에서 접지 않는다 — 미리 읽은 바탕으로 «해 본다». */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { cutFn } = require('./cut-fn');

const ERP = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8');
const FN = cutFn(ERP, 'window.erpRepairFinanceIncomeIds = function(opts)');   // ⚠ 여는 중괄호는 빼고 준다 — cutFn 이 그 다음 중괄호부터 짝을 센다
const CONSTS = (ERP.match(/var FI_REPAIR_AUTO_ONCE = '[^']+';/) || [''])[0] + '\n' + (ERP.match(/var FI_REPAIR_RELOADED = '[^']+';/) || [''])[0];

/* 실시간DB 거래 흉내 — 진짜처럼 ① null 로 먼저 ② 접으면 끝 ③ 값을 주면 진짜 값으로 다시 (rtdb-transaction-cold-abort) */
function makeWorld(o) {
  o = o || {};
  const sess = {}, local = {}, toasts = [], timers = [], stored = [];
  let serverVal = o.server;            // {v: ..., u: ...} 또는 null
  const calls = { once: 0, tx: 0, reloads: 0, confirm: 0 };
  const ref = {
    once(ev) { calls.once++; return Promise.resolve({ val: () => serverVal }); },
    transaction(fn, cb) {
      calls.tx++;
      const r1 = fn(null);                                     // ① 찬 자리
      if (r1 === undefined) { cb(null, false, null); return; } // ② 접으면 서버에 묻지도 않고 끝
      if (o.abortAlways) { cb(null, false, null); return; }    // (서버가 끝내 안 받아 준 경우)
      const r2 = fn(serverVal);                                // ③ 진짜 값으로 다시
      if (r2 === undefined) { cb(null, false, null); return; }
      serverVal = r2;
      cb(null, true, { val: () => r2 });
    },
  };
  const ctx = {
    window: {}, fbDb: { ref: () => ref }, _fbSynced: true,
    sessionStorage: { getItem: k => (k in sess ? sess[k] : null), setItem: (k, v) => { sess[k] = String(v); } },
    localStorage: { getItem: k => (k in local ? local[k] : null), setItem: (k, v) => { local[k] = String(v); }, removeItem: k => { delete local[k]; } },
    showToast: m => toasts.push(m), console: { info() {}, warn() {} },
    confirm: () => { calls.confirm++; return true; },
    normalizeFbValue: v => Array.isArray(v) ? v : (v && typeof v === 'object') ? Object.keys(v).map(k => v[k]) : null,
    arrayToIdMap: arr => { const m = {}; arr.forEach(x => { if (x && x.id) m[x.id] = x; }); return m; },
    _erpStoreSet: (k, v) => stored.push({ k, rows: JSON.parse(v) }),
    KEY: 'pureun_v6_', _dbCache: {}, _fbObjForm: {},
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    location: { reload() { calls.reloads++; } },
    Date, JSON, Math, Object, Array, String, Number, Promise,
  };
  vm.createContext(ctx);
  vm.runInContext(CONSTS + '\n' + FN, ctx);
  const run = async (opts) => { ctx.window.erpRepairFinanceIncomeIds(opts); await new Promise(r => setImmediate(r)); await new Promise(r => setImmediate(r)); };
  const fireTimers = () => { const t = timers.splice(0); t.forEach(x => x.fn()); return t.length; };
  return { ctx, run, calls, toasts, timers, stored, sess, fireTimers, server: () => serverVal };
}
const clean = () => ({ v: { a1: { id: 'a1', amt: 1 }, a2: { id: 'a2', amt: 2 } }, u: 100 });
const dirty = () => ({ v: [{ id: 'a1', amt: 1 }, { undoneBy: '홍길동' }], u: 100 });   // 한 건이 id 없음(되돌리기 찌꺼기)

test('①★ 서버가 온전하면 — 거래도, 새로고침도 없다. 사본만 서버 것으로 맞춘다', async () => {
  const w = makeWorld({ server: clean() });
  await w.run({ auto: true });
  assert.equal(w.calls.tx, 0, '★ 서버가 온전한데 거래를 열면 «찬 자리 접힘 → 새로고침» 고리의 입구다');
  assert.equal(w.timers.length, 0, '★★ 새로고침을 예약하면 안 된다 — 20초 고리가 이것이었다');
  assert.equal(w.stored.length, 1); assert.equal(w.stored[0].rows.length, 2);
  assert.equal(w.ctx._fbObjForm.finance_income, true);
});

test('②★ 자동 길은 탭 세션에 한 번만 — 두 번째 부름은 서버도 안 읽는다', async () => {
  const w = makeWorld({ server: clean() });
  await w.run({ auto: true });
  await w.run({ auto: true });
  assert.equal(w.calls.once, 1, '★★ 안 고쳐진 채 부팅마다 또 도는 것이 고리다 — 1MB 를 부팅마다 다시 읽는 값도 든다');
  /* 사람이 단추를 누르면(수동) 그때는 다시 한다 */
  await w.run({});
  assert.equal(w.calls.once, 2);
});

test('③★ 찬 자리에서 접혀 committed:false 면 — 새로고침하지 않는다 (옛 코드가 새로 열던 바로 그 자리)', async () => {
  const w = makeWorld({ server: dirty(), abortAlways: true });
  await w.run({ auto: true });
  assert.equal(w.calls.tx, 1, '서버에 껍데기가 있으니 거래는 시도한다');
  assert.equal(w.timers.length, 0, '★★★ committed:false 인데 location.reload() 를 예약했다 — 탭이 20초마다 다시 켜지는 고리');
  assert.equal(w.calls.reloads, 0);
});

test('④ 찬 자리(null)에서 접지 않는다 — 바탕으로 해 보고, 진짜 값으로 다시 불려 실제로 고친다', async () => {
  const w = makeWorld({ server: dirty() });
  await w.run({});
  assert.equal(w.calls.confirm, 1);
  const after = w.server();
  assert.ok(after && after.v && !Array.isArray(after.v), '서버가 지도형(id 열쇠)으로 바뀌어야 한다');
  const rows = Object.keys(after.v).map(k => after.v[k]);
  assert.equal(rows.length, 2, '★ 아무것도 지우지 않는다 — 돈이 걸린 자료다');
  assert.ok(rows.every(x => x && x.id), '★ 빠진 id 가 채워져야 한다');
  assert.equal(rows.find(x => x.undoneBy).undoneBy, '홍길동', '내용은 그대로');
});

test('⑤★ 실제로 고쳤을 때만 새로 열고, 그것도 탭 세션에 한 번만', async () => {
  const w = makeWorld({ server: dirty() });
  await w.run({});
  assert.equal(w.timers.length, 1, '고친 것이 있으니 한 번은 새로 연다');
  assert.equal(w.fireTimers(), 1); assert.equal(w.calls.reloads, 1);
  /* 같은 탭에서 또 고칠 것이 생겨도(서버에 다른 껍데기) 두 번째 새로고침은 없다 */
  w.ctx.fbDb.ref = (() => { const r = makeWorld({ server: dirty() }); return () => ({ once: () => Promise.resolve({ val: () => dirty() }), transaction: (fn, cb) => { const v = fn(dirty()); cb(null, true, { val: () => v }); } }); })();
  await w.run({});
  assert.equal(w.timers.length, 0, '★★ 탭 세션에 두 번째 새로고침 — 고리의 씨앗');
  assert.match(w.toasts[w.toasts.length - 1], /복구 완료/);
});

test('⑥ 원본 글자 — location.reload 는 reloadOnce 안 «한 곳»뿐이다', () => {
  const { stripJs } = require('./strip-comments');           // 주석은 먼저 걷는다 — 「옛 코드는 reload 를 걸었다」는 설명 글자가 잡히지 않게
  const hits = stripJs(FN).match(/location\.reload\(/g) || [];
  assert.equal(hits.length, 1, '★ 새로고침 자리가 둘이면 하나는 지킴이(한 번만) 밖에 있다');
  const once = cutFn(FN, 'function reloadOnce(');
  assert.match(once, /location\.reload\(/);
  assert.match(FN, /if\(!committed \|\| !repaired\)/, '★ committed 를 안 보는 갈무리가 20초 고리였다');
});
