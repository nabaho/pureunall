/* 모은 자료 — 밀린 메일은 «이어 달리기»로 끝까지 (대표 지시 2026-10-05 「지금까지 컨설팅했던것 모두 가지고 와라」)

   ■ 무엇이 있었나 (10-05 실측)
     아직 안 본 취업규칙 메일 744통 — 701통이 2023년 이전 «지난 메일»(POP3).
     지난 메일은 목록에 첨부 표시가 없어(머리글만 받아 둔다) 한 통씩 통째로 받아야 한다 → 한 회차(7분)에 8~10통.
     하루 한 번(05:00)이면 두 달이 넘는다.
   ■ 지키는 규칙
     ① 회차가 «남은 메일 수»(left)를 적는다
     ② 남았고·이번에 나아갔고·연결 실패투성이가 아니면 다음 회차를 부른다 — 한도(MAX_CHAIN 이음)까지
     ③ 두 회차가 «동시에» 돌지 않는다 — 잠금(lock). 잠겨 있으면 그냥 돌아간다(skipped)
     ④ 회차가 끝나면(터져도) 잠금을 푼다
     ⑤ 지난 메일(POP3)은 첨부를 모르므로 넓은 낱말(○○규정·변경신고)도 고른다 — 지금 메일은 첨부가 있을 때만
   실행: node --test tests/rules-collect-chain.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../functions/rules-collect.js');
const P = require('../functions/rules-collect-pick.js');

function fakeDb(init) {
  const store = JSON.parse(JSON.stringify(init || {}));
  const get = (p) => p.split('/').filter(Boolean).reduce((o, k) => (o == null ? undefined : o[k]), store);
  const set = (p, v) => {
    const ks = p.split('/').filter(Boolean); let o = store;
    ks.slice(0, -1).forEach((k) => { o[k] = o[k] || {}; o = o[k]; });
    if (v === null) delete o[ks[ks.length - 1]]; else o[ks[ks.length - 1]] = JSON.parse(JSON.stringify(v));
  };
  const db = {
    store,
    ref: (p) => ({
      once: async () => ({ val: () => (p ? get(p) : store) ?? null }),
      update: async (obj) => { Object.keys(obj).forEach((k) => set((p ? p + '/' : '') + k, obj[k])); },
      set: async (v) => set(p, v),
      transaction: async (fn) => { const v = fn(get(p) ?? null); if (v === undefined) return { committed: false }; set(p, v); return { committed: true }; },
    }),
  };
  return db;
}
const row = (i) => ({ s: '가나상사 취업규칙 송부 ' + i, d: 1000 + i, e: 'hr@gana.co.kr', a: 1 });
function mail(n) {
  const box = {}; for (let i = 0; i < n; i++) box[100 + i] = row(i);
  return { mailbox: { msgs: { 'INBOX-4a1e411c': box }, old: { msgs: {} } }, data: { companies: { v: [] } } };
}
const base = (db, extra) => Object.assign({ db, bucket: { file: () => ({ save: async () => {} }) }, now: () => 1e12, limit: 2,
  budgetMs: 1e9, contractVersion: 1, fetchAtts: async () => [] }, extra || {});

test('① 회차가 남은 메일 수를 적는다', async () => {
  const db = fakeDb(mail(5));
  const s = await C.run(base(db));
  assert.equal(s.mails, 2);
  assert.equal(s.left, 3, '★ 남은 메일 수가 없다 — 이어 달릴지 못 가른다');
  assert.equal(db.store.rules_mgmt.library.run.left, 3);
  const s2 = await C.run(base(db));
  assert.equal(s2.left, 1);
});

test('② 이어 달리기 — 남았고 나아갔으면 다음, 아니면 멈춤 · 한도', () => {
  assert.equal(C.shouldChain({ left: 3, mails: 2, retry: 0 }, 0), true);
  assert.equal(C.shouldChain({ left: 0, mails: 2, retry: 0 }, 0), false, '다 봤는데 또 부른다');
  assert.equal(C.shouldChain({ left: 3, mails: 0, retry: 0 }, 0), false, '★ 한 통도 못 봤는데 또 부르면 끝없이 돈다');
  assert.equal(C.shouldChain({ left: 3, mails: 4, retry: 4 }, 0), false, '★ 연결 실패투성이인데 또 부른다');
  assert.equal(C.shouldChain({ left: 3, mails: 2, retry: 0, skipped: 'busy' }, 0), false);
  assert.equal(C.shouldChain({ left: 3, mails: 2, retry: 0 }, C.MAX_CHAIN), false, '★ 한도 없이 이어 달린다');
});

test('③ 잠겨 있으면 돌지 않는다 — 두 회차가 같은 메일을 동시에 보지 않게', async () => {
  const db = fakeDb(mail(5));
  db.store.rules_mgmt = { library: { lock: { until: 1e12 + 60000, by: '앞 회차' } } };
  const s = await C.run(base(db));
  assert.equal(s.skipped, 'busy');
  assert.equal(db.store.rules_mgmt.library.seen, undefined, '잠겼는데 메일을 봤다');
});

test('③ 잠금이 시간이 지났으면(앞 회차가 죽었다) 이어받는다', async () => {
  const db = fakeDb(mail(3));
  db.store.rules_mgmt = { library: { lock: { until: 1e12 - 1, by: '죽은 회차' } } };
  const s = await C.run(base(db));
  assert.equal(s.mails, 2);
});

test('④ 끝나면 잠금을 푼다 — 터져도', async () => {
  const db = fakeDb(mail(3));
  await C.run(base(db));
  assert.equal(db.store.rules_mgmt.library.lock, undefined, '끝났는데 잠금이 남았다 — 다음 회차가 한동안 못 돈다');
  const db2 = fakeDb(mail(3));
  const orig = db2.ref;
  db2.ref = (p) => { const r = orig(p); if (p === 'data/companies') r.once = async () => { throw new Error('읽기 실패'); }; return r; };
  await assert.rejects(C.run(base(db2)));
  assert.equal(db2.store.rules_mgmt.library.lock, undefined, '터졌는데 잠금이 남았다');
});

test('⑤ 지난 메일(POP3)은 넓은 낱말도 고른다 — 첨부를 모르니까', () => {
  assert.equal(P.isRulesMail({ s: '가나상사 인사관리규정 검토', a: 0, o: 1 }), true, '★ 지난 메일의 ○○규정을 놓친다');
  assert.equal(P.isRulesMail({ s: '가나상사 인사관리규정 검토', a: 0 }), false, '지금 메일은 첨부가 있을 때만');
});

test('index.js 가 이어 달린다 — shouldChain 이면 ask 한 줄 · onCreate 가 이음 번호를 넘긴다', () => {
  const src = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'functions', 'index.js'), 'utf8');
  const fn = src.slice(src.indexOf('async function rulesCollectOnce('), src.indexOf('exports.collectRulesMail ='));
  assert.match(fn, /RulesCollect\.shouldChain\(sum, n\)/, '★ 이어 달리지 않는다 — 하루 한 번이면 두 달이 넘는다');
  assert.match(fn, /chain: n \+ 1/);
  const ask = src.slice(src.indexOf('exports.collectRulesMailAsk ='), src.indexOf('exports.collectRulesMailAsk =') + 600);
  assert.match(ask, /rulesCollectOnce\([^;]*, chain\)/, '★ 이음 번호를 안 넘겨 한도(MAX_CHAIN)가 안 걸린다');
});
