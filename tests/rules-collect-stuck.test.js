/* 모은 자료 — 한 통에서 멈춰도 줄이 서지 않는다 (2026-10-07 대표 「다음」)
   ■ 무엇이 있었나 — 10-05 17:32 부터 이틀 동안 모든 회차가 9분 제한에 잘렸다. 첫 메일을 받거나 가리다 멈췄고,
     잘리면 기록이 안 남아 다음 회차가 같은 메일을 또 집었다 — 632통이 그대로 섰다.
   ■ 지키는 규칙
     ① 받기가 멈추면 시간 한도(fetchMs)에서 끊고 그 메일만 «다시»로 — 회차는 끝까지 가고 run 기록을 쓴다
     ② 손대기 전 시도 표시(try)를 남기고, 끝나면(담음·보류·너무 큼·없어짐) 지운다
     ③ 시간 초과는 표시를 남기고, 보통 실패(끊김)는 지운다 — 보통 실패가 쌓여 건너뛰면 안 된다
     ④ 표시가 2번 쌓인 메일(두 회차를 죽인 메일)은 seen 에 「멈춤 — 건너뜀」으로 적고 넘어간다 — 원본은 메일함에
   실행: node --test tests/rules-collect-stuck.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../hwpx_gen.js');
const C = require('../functions/rules-collect.js');

function fakeDb(init) {
  const store = JSON.parse(JSON.stringify(init || {}));
  const get = (p) => p.split('/').filter(Boolean).reduce((o, k) => (o == null ? undefined : o[k]), store);
  const set = (p, v) => {
    const ks = p.split('/').filter(Boolean); let o = store;
    ks.slice(0, -1).forEach((k) => { o[k] = o[k] || {}; o = o[k]; });
    if (v === null) delete o[ks[ks.length - 1]]; else o[ks[ks.length - 1]] = JSON.parse(JSON.stringify(v));
  };
  return {
    store,
    ref: (p) => ({
      once: async () => ({ val: () => (p ? get(p) : store) ?? null }),
      update: async (obj) => { Object.keys(obj).forEach((k) => set((p ? p + '/' : '') + k, obj[k])); },
      set: async (v) => set(p, v),
    }),
  };
}
const bucket = () => ({ files: {}, file: () => ({ save: async () => {} }) });
const RULE = H.build(H.para('제1조(목적) 이 규칙은 가나상사 사원의 근로조건을 정한다.'));
const MAIL = {
  mailbox: {
    msgs: { 'INBOX-4a1e411c': {
      10: { s: '가나상사 취업규칙 송부', d: 3000, e: 'hr@gana.co.kr', a: 1 },
      11: { s: '다나상사 취업규칙 송부', d: 2000, e: 'hr@dana.co.kr', a: 1 },
    } },
    old: { msgs: {} },
  },
  data: { companies: { v: [] } },
};
const A = 'i_INBOX-4a1e411c_10', B = 'i_INBOX-4a1e411c_11';
const never = () => new Promise(() => {});
const opts = (db, fetchAtts, extra) => Object.assign({ db, bucket: bucket(), now: () => 1e12, limit: 60, budgetMs: 1e9,
  contractVersion: 1, fetchMs: 30, fetchAtts }, extra || {});
const lib = (db) => db.store.rules_mgmt.library;

test('① 받기가 멈추면 그 메일만 끊고 회차는 끝까지 — run 기록을 쓴다', async () => {
  const db = fakeDb(MAIL);
  const sum = await C.run(opts(db, (m) => (m.mailKey === A ? never() : Promise.resolve([{ name: '다나_취업규칙.hwpx', data: RULE }]))));
  assert.equal(sum.retry, 1);
  assert.ok(sum.errors.includes('FETCH_TIMEOUT'));
  assert.ok(lib(db).seen[B], '★ 멈춘 메일 뒤의 메일을 못 봤다');
  assert.ok(!lib(db).seen[A]);
  assert.ok(lib(db).run, '★ run 기록이 없다 — 다음 회차가 밀린 걸 모른다');
  assert.equal(lib(db).try[A].n, 1, '③ 시간 초과는 표시를 남긴다');
  assert.equal(lib(db).try[B], undefined, '② 끝난 메일의 표시가 남았다');
});

test('④ 두 번 멈춘 메일은 셋째 회차에 건너뛴다', async () => {
  const db = fakeDb(MAIL);
  const f = (m) => (m.mailKey === A ? never() : Promise.resolve([]));
  await C.run(opts(db, f));
  await C.run(opts(db, f));
  assert.equal(lib(db).try[A].n, 2);
  let asked = 0;
  const sum = await C.run(opts(db, (m) => { if (m.mailKey === A) asked++; return f(m); }));
  assert.equal(asked, 0, '★ 두 번 멈춘 메일을 또 집었다');
  assert.equal(sum.stuck, 1);
  assert.match(lib(db).seen[A].why, /^멈춤 2번 — 건너뜀/);
  assert.equal(Object.keys(lib(db).try || {}).length, 0, '건너뛴 메일의 표시가 남았다');
  assert.equal(sum.left, 0);
});

test('④ 가리다 회차가 통째로 죽은 메일도 — 표시만 남아 있으면 건너뛴다', async () => {
  const db = fakeDb(Object.assign({}, MAIL, { rules_mgmt: { library: { try: { [A]: { at: 1, n: 2 } } } } }));
  let asked = 0;
  await C.run(opts(db, (m) => { if (m.mailKey === A) asked++; return Promise.resolve([]); }));
  assert.equal(asked, 0);
  assert.match(lib(db).seen[A].why, /멈춤/);
});

test('③ 보통 실패(끊김)는 표시를 지운다 — 쌓여서 건너뛰면 안 된다', async () => {
  const db = fakeDb(MAIL);
  const f = (m) => (m.mailKey === A ? Promise.reject(Object.assign(new Error('끊김'), { code: 'ECONNRESET' })) : Promise.resolve([]));
  await C.run(opts(db, f)); await C.run(opts(db, f)); await C.run(opts(db, f));
  assert.ok(!lib(db).seen[A], '★ 끊김 세 번에 건너뛰었다 — 연결만 돌아오면 담을 메일이다');
  assert.equal((lib(db).try || {})[A], undefined);
});

test('② 없어짐·너무 큼도 표시를 지운다', async () => {
  const db = fakeDb(MAIL);
  await C.run(opts(db, (m) => (m.mailKey === A ? Promise.reject(Object.assign(new Error('x'), { status: 404 })) : Promise.resolve([]))));
  assert.equal(lib(db).seen[A].why, '없어짐');
  assert.equal(Object.keys(lib(db).try || {}).length, 0);
});

test('받기 한도 + 예산 < 9분 — 잘리기 전에 끝난다', () => {
  assert.ok(C.FETCH_MS + 7 * 60 * 1000 < 540 * 1000, '받기 한도가 너무 길다 — 예산 끝에 시작한 받기가 9분 제한에 잘린다');
  assert.equal(C.STUCK_MAX, 2);
});
