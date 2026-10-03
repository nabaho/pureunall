const test = require('node:test');
const assert = require('node:assert/strict');
global.PuOntology = require('../js/pu-ontology.js');
const OW = require('../js/pu-ontology-write.js');
const S0 = require('../js/rules-v2/store.js');

// 가짜 DB — 관문이 부르는 transaction(함수) → {committed, snapshot} 만 흉내낸다.
function fakeDb() {
  const store = {};
  const get = (p) => p.split('/').reduce((o, k) => (o == null ? undefined : o[k]), store);
  const put = (p, v) => { const ks = p.split('/'); let o = store; ks.slice(0, -1).forEach((k) => { o[k] = o[k] || {}; o = o[k]; }); o[ks[ks.length - 1]] = v; };
  let n = 0;
  const ref = (p) => ({ path: p,
    once: async () => ({ val: () => get(p) ?? null }),
    transaction: async (fn) => { const v = fn(get(p) ?? null); if (v === undefined) return { committed: false }; put(p, v); return { committed: true, snapshot: { val: () => v } }; },
    push: () => ref(p + '/k' + (++n)), key: p.split('/').pop() });
  return { store, ref };
}
const COS = [{ id: 'co_gana', name: '가나상사' }];
const make = (db) => S0.make({ db, gateway: OW.createGateway({ mode: 'enforce', actor: '홍길동' }),
  companies: () => COS, actor: () => '홍길동', now: () => 1000 });

test('사업장 확정 — 관문 칸을 갖춘 레코드, 없는 업체는 거절', async () => {
  const db = fakeDb(); const S = make(db);
  await S.linkCompany(['rd_1', 'rd_2'], 'co_gana');
  const h = db.store.rules_mgmt.library.human;
  assert.equal(h.rd_1.companyId, 'co_gana');
  assert.equal(h.rd_1.companyLinkStatus, 'linked');
  assert.equal(h.rd_1.entityType, 'RulesDocument');
  assert.equal(h.rd_1.id, 'rd_1');
  assert.ok(h.rd_1.revision >= 1);
  await assert.rejects(() => S.linkCompany(['rd_3'], 'co_없음'), /업체/);
});

test('사업장 필요 없음 — 업체 칸 없이 not_required 로 관문을 통과한다', async () => {
  const db = fakeDb(); const S = make(db);
  await S.notRequired(['rd_1']);
  const r = db.store.rules_mgmt.library.human.rd_1;
  assert.equal(r.companyLinkStatus, 'not_required');
  assert.ok(!r.companyId, 'companyId 는 비어 있다');
  assert.equal(r.entityType, 'RulesDocument');
  assert.ok(r.revision >= 1);
  // 이미 연결된 서류를 풀 때도 companyId 가 비워진다
  await S.linkCompany(['rd_2'], 'co_gana');
  await S.notRequired(['rd_2']);
  assert.ok(!db.store.rules_mgmt.library.human.rd_2.companyId);
});

test('최종본은 회차 레코드 한 칸 — 바꾸면 앞의 것이 내려가고, 풀면 null(지우지 않는다)', async () => {
  const db = fakeDb(); const S = make(db);
  await S.setFinal('co_gana', 'r202601', 'rd_1');
  await S.setFinal('co_gana', 'r202601', 'rd_2');
  const r = db.store.rules_mgmt.library.rounds['co_gana_r202601'];
  assert.equal(r.finalDocId, 'rd_2');
  assert.equal(r.entityType, 'RulesRound');
  assert.equal(r.finalBy, '홍길동');
  await S.setFinal('co_gana', 'r202601', null);
  assert.equal(db.store.rules_mgmt.library.rounds['co_gana_r202601'].finalDocId, null);
  assert.ok(db.store.rules_mgmt.library.rounds['co_gana_r202601'].revision >= 3);
});

test('회차 키에 꼬리(r202601b)가 붙어도 한 레코드 키로 쓴다', async () => {
  const db = fakeDb(); const S = make(db);
  await S.setFinal('co_gana', 'r202601b', 'rd_9');
  assert.equal(db.store.rules_mgmt.library.rounds['co_gana_r202601b'].finalDocId, 'rd_9');
});

test('갈래·회차 고치기는 사업장 칸을 안 건드린다', async () => {
  const db = fakeDb(); const S = make(db);
  await S.linkCompany(['rd_1'], 'co_gana');
  await S.setKind('rd_1', '신고서');
  await S.setRound('rd_1', 'r202512');
  const h = db.store.rules_mgmt.library.human.rd_1;
  assert.equal(h.kindFix, '신고서'); assert.equal(h.round, 'r202512'); assert.equal(h.companyId, 'co_gana');
});

test('지금 더 모으기 신호', async () => {
  const db = fakeDb(); const S = make(db);
  await S.ask();
  const a = Object.values(db.store.rules_mgmt.library.ask)[0];
  assert.equal(a.entityType, 'Task'); assert.equal(a.kind, 'rulesCollect');
});

test('읽기 — 서버 칸이 비어 있어도 빈 모양을 돌려준다', async () => {
  const db = fakeDb(); const S = make(db);
  const L = await S.load();
  assert.deepEqual(Object.keys(L).sort(), ['docs', 'human', 'rounds', 'run']);
  assert.equal(L.run, null);
  assert.equal(await S.text('rd_none'), '');
});
