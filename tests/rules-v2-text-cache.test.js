const test = require('node:test');
const assert = require('node:assert/strict');
const S0 = require('../js/rules-v2/store.js');
const TC = require('../js/rules-v2/text-cache.js');

// 가짜 DB — once('value') 만 흉내낸다. 받은 수·동시에 떠 있는 수를 센다.
function fakeDb(texts, opt) {
  opt = opt || {};
  const st = { calls: [], inflight: 0, max: 0 };
  const ref = (p) => ({ once: async () => {
    const id = p.split('/').pop();
    st.calls.push(id); st.inflight++; st.max = Math.max(st.max, st.inflight);
    await new Promise((r) => setTimeout(r, opt.delay || 0));
    st.inflight--;
    if (opt.failId === id) throw new Error('받기 실패');
    return { val: () => (id in texts ? texts[id] : null) };
  } });
  return { db: { ref }, st };
}
const mk = (db) => S0.make({ db, gateway: null, companies: () => [], actor: () => '홍길동', now: () => 1 });
// 가짜 칸 — 넣은 것을 그대로 기억한다.
function fakeCache(init) {
  const m = Object.assign({}, init || {}); const puts = [];
  return { m, puts, get: async (id) => m[id] || null, put: async (id, v, text) => { m[id] = { v, text }; puts.push(id); } };
}
const DOCS = { rd_1: { updatedAt: 10 }, rd_2: { createdAt: 5 }, rd_3: { updatedAt: 7, createdAt: 1 } };
const TEXTS = { rd_1: '제1조 가나상사', rd_2: '제1조 다라상사', rd_3: '제1조 마바상사' };

test('칸 없음 — 모두 받아 온다', async () => {
  const f = fakeDb(TEXTS); const r = await mk(f.db).texts(DOCS, null);
  assert.deepEqual(Object.assign({}, r.texts), TEXTS);
  assert.equal(r.failed.length, 0);
  assert.equal(f.st.calls.length, 3);
});

test('칸에 같은 판이 있으면 받지 않는다', async () => {
  const f = fakeDb(TEXTS);
  const c = fakeCache({ rd_1: { v: '10', text: '칸의 글1' }, rd_2: { v: '5', text: '칸의 글2' } });
  const r = await mk(f.db).texts(DOCS, c);
  assert.equal(r.texts.rd_1, '칸의 글1');
  assert.equal(r.texts.rd_2, '칸의 글2');
  assert.deepEqual(f.st.calls, ['rd_3']);
  assert.deepEqual(c.puts, ['rd_3']);
});

test('판이 다르면 다시 받아 칸을 갈아 끼운다', async () => {
  const f = fakeDb(TEXTS);
  const c = fakeCache({ rd_1: { v: '9', text: '옛 글' } });
  const r = await mk(f.db).texts({ rd_1: DOCS.rd_1 }, c);
  assert.equal(r.texts.rd_1, TEXTS.rd_1);
  assert.equal(c.m.rd_1.v, '10');
  assert.equal(c.m.rd_1.text, TEXTS.rd_1);
});

test('하나가 실패해도 나머지는 받고 실패 id 를 알린다', async () => {
  const f = fakeDb(TEXTS, { failId: 'rd_2' }); const c = fakeCache();
  const r = await mk(f.db).texts(DOCS, c);
  assert.deepEqual(r.failed, ['rd_2']);
  assert.equal(r.texts.rd_1, TEXTS.rd_1);
  assert.equal(r.texts.rd_3, TEXTS.rd_3);
  assert.ok(!('rd_2' in r.texts));
  assert.ok(!('rd_2' in c.m), '실패한 것은 칸에 넣지 않는다');
});

test('동시에 받는 수는 6개를 넘지 않는다', async () => {
  const texts = {}, docs = {};
  for (let i = 0; i < 20; i++) { texts['d' + i] = 't' + i; docs['d' + i] = { updatedAt: i + 1 }; }
  const f = fakeDb(texts, { delay: 5 });
  const r = await mk(f.db).texts(docs, null);
  assert.equal(Object.keys(r.texts).length, 20);
  assert.ok(f.st.max <= 6, '동시 ' + f.st.max);
  assert.ok(f.st.max >= 2, '나란히 받아야 한다');
});

test('진행 알림 — 한 건 끝날 때마다 (done,total)', async () => {
  const f = fakeDb(TEXTS); const seen = [];
  await mk(f.db).texts(DOCS, null, (d, t) => seen.push([d, t]));
  assert.equal(seen.length, 3);
  assert.deepEqual(seen[seen.length - 1], [3, 3]);
});

test('make(null) — 아무것도 안 하는 칸', async () => {
  const c = TC.make(null);
  assert.equal(await c.get('x'), null);
  await c.put('x', '1', 't');
  assert.equal(await c.get('x'), null);
  assert.equal(await TC.make(undefined).get('x'), null);
});

test('열기가 실패하는 idbFactory — 던지지 않고 칸 없음처럼', async () => {
  const idb = { open() { const rq = {}; setTimeout(() => rq.onerror && rq.onerror({}), 0); return rq; } };
  const c = TC.make(idb);
  assert.equal(await c.get('x'), null);
  await c.put('x', '1', 't');
  const thrower = { open() { throw new Error('막힘'); } };
  const c2 = TC.make(thrower);
  assert.equal(await c2.get('x'), null);
  await c2.put('x', '1', 't');
});
