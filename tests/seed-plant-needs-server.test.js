'use strict';
/* 🌱 씨앗은 «서버가 비어 있다고 확인된 뒤에만» 심는다 (2026-10-26 사건)

   ■ 무슨 일이 있었나
   2026-10-26 09:28(KST) 이 기기에 사본이 없던 기기가 환경설정 › 사무관리기준을 열자, 화면이
   「사본이 없으면 씨앗을 심는다」는 옛 규칙으로 씨앗을 서버에 써 버렸다.
   컨설팅 19건·사건 12건·기타사업 12건의 유형 사전이 통째로 씨앗(14·13·11건)으로 바뀌었고,
   사전을 코드로 잇던 컨설팅 112건·사건 40건·기타사업 5건이 모두 「미설정」이 됐다.
   「이 기기에 사본이 없다」는 「서버에 자료가 없다」가 아니다 — 새 기기·지운 저장 공간·서버 자료가 아직 안 온 순간이 모두 «사본 없음»이다.

   ★ 규칙 (값이 아니라 규칙)
     ① 씨앗을 서버에 쓰는 길은 erpPlantSeed 하나뿐이다 — dbSet(키, 씨앗) 을 직접 부르는 곳이 없다
     ② erpPlantSeed: 사본이 있으면 안 쓴다 · 서버에 자료가 있으면 그것을 받는다 · 서버가 비어 있을 때만 심는다 ·
        서버를 못 읽거나 서버가 없으면 심지 않는다 · 같은 키를 짧은 사이에 거듭 묻지 않는다
     ③ 유형 사전을 쓰는 동작(추가·수정·삭제·숨김·끌기·복원·개인입금)은 사본이 있을 때만 한다 — 씨앗 위에 얹어 저장하면 서버를 덮는다
     ④ bizTypeApply(합치기·정리 길 포함)도 사본이 없으면 쓰지 않는다 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn');
const { stripComments } = require('./strip-comments');

const ROOT = path.join(__dirname, '..');
const ERP = stripComments(fs.readFileSync(path.join(ROOT, 'pu-erp.html'), 'utf8'));

/* ── ① 씨앗을 직접 심는 줄이 없다 ── */
test('①★ dbSet(키, 씨앗) 을 직접 부르는 곳이 없다 — erpPlantSeed 와 사번·명부 한 곳만', () => {
  const fnBody = cutFn(ERP, 'function erpPlantSeed(k, seed, onDone)');
  const outside = ERP.replace(fnBody, '');
  const bad = [];
  outside.split('\n').forEach((line, i) => {
    if (/\bdbSet\(\s*[^,;)]+,\s*(?:[A-Z][A-Z0-9_]*SEED\b|[A-Za-z_.]+\.seed\b)/.test(line)) bad.push((i + 1) + ': ' + line.trim().slice(0, 130));
  });
  /* 허용 — 직원 명부(USERS_SEED)는 fbSeedAllowed() 로 «동기화가 끝난 뒤에만» 심는다(그 길이 따로 있다) */
  const real = bad.filter((b) => !/USERS_SEED/.test(b));
  assert.deepEqual(real, [], '★ 씨앗을 서버에 직접 쓰는 줄이 있다 — erpPlantSeed(키, 씨앗) 을 쓴다:\n' + real.join('\n'));
});

/* ── ② erpPlantSeed 가 하는 일을 «떠서 돌려» 본다 ── */
function world(over) {
  const w = Object.assign({
    store: {}, writes: [], applied: [], asks: 0, serverRec: undefined, serverFails: false, fbDb: true, now: 1000000,
  }, over || {});
  const ctx = {
    dbGet: (k, d) => (k in w.store ? w.store[k] : d),
    dbSet: (k, v) => { w.writes.push([k, v]); w.store[k] = v; return true; },
    _fbApplyRecord: (k, rec) => { w.applied.push(k); w.store[k] = rec.v; return true; },
    window: {},
    Date: { now: () => w.now },
    Promise, Array, Object,
  };
  ctx.fbDb = w.fbDb ? {
    ref: (p) => ({
      once: () => {
        w.asks++;
        if (w.serverFails) return Promise.reject(new Error('끊김'));
        return Promise.resolve({ val: () => w.serverRec });
      },
    }),
  } : null;
  vm.createContext(ctx);
  vm.runInContext('var _erpSeedAsked = {};\n' + cutFn(ERP, 'function erpPlantSeed(k, seed, onDone)'), ctx);
  w.ctx = ctx;
  return w;
}
const tick = () => new Promise((r) => setImmediate(r));
const SEED = [{ code: 'cons-x', short: '씨', name: '씨앗' }];

test('②★ 이 기기에 사본이 있으면 아무것도 안 묻고 안 쓴다', async () => {
  const w = world({ store: { biz_cons_types: [{ code: 'real' }] } });
  let how; w.ctx.erpPlantSeed('biz_cons_types', SEED, (h) => { how = h; });
  await tick();
  assert.equal(how, 'local'); assert.equal(w.asks, 0); assert.deepEqual(w.writes, []);
});

test('②★ ★★ 사본이 없어도 서버에 자료가 있으면 «씨앗을 쓰지 않고» 서버 것을 받는다', async () => {
  const w = world({ serverRec: { u: 5, v: [{ code: 'real-1' }, { code: 'real-2' }] } });
  let how; w.ctx.erpPlantSeed('biz_cons_types', SEED, (h) => { how = h; });
  await tick();
  assert.equal(how, 'server');
  assert.deepEqual(w.writes, [], '★★ 서버에 진짜 사전이 있는데 씨앗을 썼다 — 2026-10-26 사건이 되풀이된다');
  assert.deepEqual(w.applied, ['biz_cons_types']);
});

test('②★ 서버도 비어 있을 때만 씨앗을 심는다', async () => {
  const w = world({ serverRec: null });
  let how; w.ctx.erpPlantSeed('biz_cons_types', SEED, (h) => { how = h; });
  await tick();
  assert.equal(how, 'planted');
  assert.equal(w.writes.length, 1); assert.equal(w.writes[0][0], 'biz_cons_types');
});

test('②★ 사본이 «빈 배열»이어도 서버를 먼저 본다 (옛 코드는 빈 배열에도 씨앗을 심었다)', async () => {
  const w = world({ store: { biz_case_types: [] }, serverRec: { u: 9, v: [{ code: 'case-real' }] } });
  w.ctx.erpPlantSeed('biz_case_types', SEED);
  await tick();
  assert.deepEqual(w.writes, []); assert.deepEqual(w.applied, ['biz_case_types']);
});

test('②★ 서버를 못 읽으면 심지 않는다 · 서버가 없어도(오프라인) 심지 않는다', async () => {
  const f = world({ serverFails: true });
  let how; f.ctx.erpPlantSeed('biz_cons_types', SEED, (h) => { how = h; });
  await tick();
  assert.equal(how, 'error'); assert.deepEqual(f.writes, [], '★ 서버를 못 읽었는데 씨앗을 심었다');
  const o = world({ fbDb: false });
  o.ctx.erpPlantSeed('biz_cons_types', SEED, (h) => { how = h; });
  await tick();
  assert.equal(how, 'offline'); assert.deepEqual(o.writes, [], '★ 서버가 없는데 씨앗을 심었다 — 나중에 서버로 올라가 덮는다');
});

test('②★ 같은 키를 그리는 동안 거듭 묻지 않는다 (30초에 한 번)', async () => {
  const w = world({ serverRec: null });
  w.store.__never = 1;
  // 사본이 안 생기는 경우(서버가 받아 줘도 이 기기에 못 얹음)를 흉내: dbSet 을 막는다
  w.ctx.dbSet = () => false;
  for (let i = 0; i < 5; i++) w.ctx.erpPlantSeed('holidays', SEED);
  await tick();
  assert.equal(w.asks, 1, '그리는 동안 서버를 5번 물었다');
  w.now += 31000;
  w.ctx.erpPlantSeed('holidays', SEED); await tick();
  assert.equal(w.asks, 2, '30초가 지난 뒤에는 다시 물을 수 있어야 한다');
});

/* ── ③ 유형 사전을 쓰는 동작은 사본이 있을 때만 ── */
test('③★ 유형 카드의 쓰는 동작 여덟 가지가 모두 문(bizTypeWritable)을 지난다', () => {
  const card = cutFn(ERP, 'function BizTypeCard(props)');
  [
    'function togglePersonal(x)', 'function add()', 'function del(code)', 'function purge(code)', 'function unhide(code)',
    'async function editType(x)', 'function reseed()', 'function onDrop(targetCode, e)',
  ].forEach((decl) => {
    const body = cutFn(card, decl);
    assert.ok(/bizTypeWritable\(cat\.storageKey\)/.test(body), '★ ' + decl + ' 이(가) 사본 확인 없이 쓴다 — 씨앗 위에 얹어 서버를 덮을 수 있다');
  });
  assert.ok(!/dbSet\(\s*cat\.storageKey/.test(card), '★ 유형 카드가 마운트에서 사전을 직접 쓴다');
  assert.ok(/erpPlantSeed\(cat\.storageKey, cat\.seed/.test(card), '유형 카드가 서버에 먼저 묻지 않는다');
});

/* ── ④ bizTypeApply 그물 ── */
test('④★ bizTypeApply(합치기·정리 길 포함)는 사본이 없으면 쓰지 않는다', () => {
  const writes = [];
  const ctx = {
    dbGet: () => null, dbSet: (...a) => { writes.push(a); }, showToast() {}, Array, Object,
    bizTypeRead: (k, seed) => seed.slice(), bizTypeStampRoles: (x) => x,
  };
  vm.createContext(ctx);
  vm.runInContext(cutFn(ERP, 'function bizTypeWritable(storageKey)') + '\n' + cutFn(ERP, 'function bizTypeApply(storageKey, seed, fn)'), ctx);
  const r = ctx.bizTypeApply('biz_cons_types', SEED, (cur) => cur.concat([{ code: 'new', sortOrder: 5 }]));
  assert.equal(r, null);
  assert.deepEqual(writes, [], '★ 사본이 없는데 사전을 썼다 — 씨앗 + 바꿈 하나가 서버의 진짜 사전을 덮는다');
});

test('④★ (이빨) 옛 모양(마운트에서 dbSet 씨앗)은 ① 검사가 잡는다', () => {
  const old = "if(!existing){ dbSet(cat.storageKey, cat.seed); existing = cat.seed; }";
  assert.ok(/\bdbSet\(\s*[^,;)]+,\s*(?:[A-Z][A-Z0-9_]*SEED\b|[A-Za-z_.]+\.seed\b)/.test(old), '옛 모양을 못 잡는다');
  const ok = "if(!existing){ erpPlantSeed(cat.storageKey, cat.seed); existing = cat.seed; }";
  assert.ok(!/\bdbSet\(\s*[^,;)]+,\s*(?:[A-Z][A-Z0-9_]*SEED\b|[A-Za-z_.]+\.seed\b)/.test(ok), '새 모양에 헛경고');
});
