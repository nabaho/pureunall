/* 취업규칙 「🤖 매일 정리」 서버 일 (functions/rules-daily.js · 설계 §14). 회사·사람은 지어낸 것만. 가짜 DB 로 돈다.
   ★ 못 박는 것은 규칙이다:
     ① 스위치 — 없으면 시범: 담당은 적고 «했을 것»만 기록, 사람 칸은 안 쓴다 · off 면 아무것도 안 쓴다(마지막 한 줄만)
     ② 켜짐 — 사람 칸을 화면 관문과 같은 모양(id·entityType·revision…)으로, linkedBy 자동 · 기록이 사람 칸보다 «먼저»
     ③ 셈한 뒤 사람이 손댔으면 쓰지 않는다(트랜잭션 안에서 다시 본다)
     ④ 처리 담당 — 메일함 잣대(whoAll)로, 바뀐 것만 쓴다(두 번째 회차는 안 씀)
     ⑤ 기록에 메일 주소·제목이 없다 · 던지지 않는다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../functions/rules-daily.js');

const DAY = 864e5;
const NOW = Date.UTC(2026, 9, 31, 3, 0, 0);
const LIB = 'rules_mgmt/library';

/* 가짜 실시간DB — 경로 읽기·쓰기·여러 자리 update·트랜잭션. 쓴 차례를 writes 에 남긴다 */
function fakeDb(init, hooks) {
  const store = JSON.parse(JSON.stringify(init || {}));
  const writes = [];
  const parts = (p) => String(p || '').split('/').filter(Boolean);
  const get = (p) => parts(p).reduce((o, k) => (o == null ? undefined : o[k]), store);
  const put = (p, v) => {
    const ks = parts(p); let o = store;
    ks.slice(0, -1).forEach((k) => { if (o[k] == null || typeof o[k] !== 'object') o[k] = {}; o = o[k]; });
    if (v === null) delete o[ks[ks.length - 1]]; else o[ks[ks.length - 1]] = JSON.parse(JSON.stringify(v));
  };
  const snap = (v) => ({ val: () => (v === undefined ? null : JSON.parse(JSON.stringify(v))), exists: () => v != null });
  return {
    store, writes,
    ref(p) {
      return {
        once: async () => { if (hooks && hooks.read) hooks.read(p); return snap(get(p)); },
        set: async (v) => { writes.push(['set', p]); put(p, v); },
        update: async (obj) => {
          Object.keys(obj).forEach((k) => { writes.push(['update', p ? p + '/' + k : k]); put(p ? p + '/' + k : k, obj[k]); });
        },
        transaction: async (fn) => {
          if (hooks && hooks.beforeTx) hooks.beforeTx(p, store, put);
          const next = fn(get(p) === undefined ? null : JSON.parse(JSON.stringify(get(p))));
          if (next === undefined) return { committed: false, snapshot: snap(get(p)) };
          writes.push(['tx', p]); put(p, next);
          return { committed: true, snapshot: snap(get(p)) };
        },
      };
    },
  };
}
/* 메일함 담당 표 — 업체관리에 적힌 주소 → 주담당(②) 하나만 채운 최소 모양 */
function tables() {
  return { hand: {}, retired: {}, succ: {}, co: {}, wkAddr: {}, coById: {}, coByName: {}, workLink: {}, workByKey: {}, workByAddr: {},
    erpAddr: { 'hr@gana.co.kr': '점검노무' }, boxWho: {}, noWho: {}, sidByName: { '점검노무': 'P002' }, nameBySid: { P002: '점검노무', 'P-003': '점검사무장' } };
}
function seed(extra) {
  const doc = (id, from, cand, created) => ({ id, entityType: 'RulesDocument', name: id + '.hwp', kind: '규칙본문', status: '담김', dir: '받음',
    mail: { src: 'imap', box: 'INBOX', key: id, date: created, from, to: '370-6@daum.net', subject: '취업규칙 개정 검토 요청' },
    companyCand: cand, createdAt: created });
  const init = {
    data: { companies: { v: [{ id: 'c1', name: '가나정밀', managerMain: 'P-002' }, { id: 'c2', name: '다라물산', managerMain: 'P-003' }] } },
    rules_mgmt: { library: {
      docs: {
        rd_a: doc('rd_a', 'hr@gana.co.kr', [{ companyId: 'c1', why: '주소' }], NOW - 3600e3),
        rd_b: doc('rd_b', 'hr@gana.co.kr', [{ companyId: 'c1', why: '주소' }], NOW - 3000e3),
        rd_c: doc('rd_c', 'x@dara.kr', [{ companyId: 'c2', why: '도메인' }], NOW - 2 * DAY),
      },
      human: {},
    } },
  };
  return Object.assign(init, extra || {});
}
const run = (db, extra) => R.runOnce(Object.assign({ db, now: () => NOW, contractVersion: 1, tables: async () => tables() }, extra || {}));
const lib = (db) => db.store.rules_mgmt.library;

test('① 스위치가 없으면 시범 — 담당은 적고 «했을 것»만 기록, 사람 칸은 안 쓴다', async () => {
  const db = fakeDb(seed());
  const r = await run(db);
  assert.equal(r.mode, 'dry');
  assert.equal(r.error, '');
  assert.deepEqual(lib(db).human, {}, '시범인데 사람 칸을 썼다');
  assert.equal(lib(db).docs.rd_a.owner.who, '점검노무', '처리 담당을 안 적었다');
  assert.equal(lib(db).docs.rd_a.owner.sid, 'P-002', '사번 꼴(P-002)로 맞추지 않았다');
  const last = lib(db).auto.last;
  assert.equal(last.mode, 'dry');
  assert.deepEqual(last.items.map((x) => x.d).sort(), ['rd_a', 'rd_b']);
  const log = lib(db).auto.log['2026-10-31'];
  assert.ok(log.would >= 2);
  assert.equal(log.linked, 0);
});

test('① off 면 아무것도 안 쓴다 — 마지막 한 줄(off)만', async () => {
  const db = fakeDb(seed());
  db.store.rules_mgmt.library.auto = { cfg: { mode: 'off', at: NOW } };
  await run(db);
  assert.ok(!lib(db).docs.rd_a.owner, 'off 인데 담당을 적었다');
  assert.deepEqual(lib(db).human, {});
  assert.equal(lib(db).auto.last.mode, 'off');
  assert.ok(!lib(db).auto.log, 'off 인데 하루 기록을 썼다');
});

test('② 켜짐 — 사람 칸을 관문과 같은 모양으로, linkedBy 자동 · 기록이 사람 칸보다 먼저', async () => {
  const db = fakeDb(seed());
  db.store.rules_mgmt.library.auto = { cfg: { mode: 'live', at: NOW } };
  const r = await run(db);
  assert.equal(r.applied, 2);
  const h = lib(db).human.rd_a;
  assert.equal(h.id, 'rd_a');
  assert.equal(h.entityType, 'RulesDocument');
  assert.ok(Number.isInteger(h.revision) && h.revision >= 1);
  assert.ok(Number.isInteger(h.schemaVersion));
  assert.equal(h.companyId, 'c1');
  assert.equal(h.companyLinkStatus, 'linked');
  assert.equal(h.linkedBy, '자동');
  assert.match(h.auto.why, /주소/);
  assert.ok(!lib(db).human.rd_c, '도메인만인 것을 확정했다');
  const firstLast = db.writes.findIndex((w) => w[1] === LIB + '/auto/last');
  const firstHuman = db.writes.findIndex((w) => w[1].indexOf(LIB + '/human/') === 0);
  assert.ok(firstLast >= 0 && firstHuman > firstLast, '사람 칸을 기록보다 먼저 썼다');
  assert.equal(lib(db).auto.last.applied, 2);
  assert.equal(lib(db).auto.log['2026-10-31'].linked, 2);
});

test('③ 셈한 뒤 사람이 손댔으면 쓰지 않는다', async () => {
  const db = fakeDb(seed(), {
    beforeTx: (p, store, put) => {
      if (p === LIB + '/human/rd_a') put(p, { id: 'rd_a', entityType: 'RulesDocument', revision: 1, companyId: null, companyLinkStatus: 'pending', linkedBy: 'P-003', linkedAt: NOW });
    },
  });
  db.store.rules_mgmt.library.auto = { cfg: { mode: 'live', at: NOW } };
  const r = await run(db);
  assert.equal(r.applied, 1);
  assert.equal(lib(db).human.rd_a.linkedBy, 'P-003', '사람이 정한 것을 자동이 덮었다');
  assert.equal(lib(db).human.rd_b.linkedBy, '자동');
  assert.equal(R.canWrite({ noAuto: true }), false);
  assert.equal(R.canWrite({ companyLinkStatus: 'not_required' }), false);
  assert.equal(R.canWrite(null), true);
});

test('④ 처리 담당은 바뀐 것만 쓴다 — 두 번째 회차는 안 쓴다', async () => {
  const db = fakeDb(seed());
  await run(db);
  const before = db.writes.filter((w) => /\/owner$/.test(w[1])).length;
  assert.ok(before >= 1);
  await run(db);
  const after = db.writes.filter((w) => /\/owner$/.test(w[1])).length;
  assert.equal(after, before, '안 바뀐 담당을 또 썼다');
});

test('⑤ 기록에 메일 주소·제목이 없다 · 던지지 않는다', async () => {
  const db = fakeDb(seed());
  db.store.rules_mgmt.library.auto = { cfg: { mode: 'live', at: NOW } };
  await run(db);
  const a = JSON.stringify(lib(db).auto);
  assert.ok(!/@|개정 검토 요청/.test(a), '기록에 메일 주소·제목이 들어갔다');
  const bad = { ref() { throw new Error('DB 고장'); } };
  const r = await R.runOnce({ db: bad, now: () => NOW, contractVersion: 1, tables: async () => tables() });
  assert.match(r.error, /DB 고장/);
});
