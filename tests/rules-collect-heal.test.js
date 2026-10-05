/* 이미 담긴 글을 «다시 훑어» 고친다 (대표 「추천대로」 2026-10-05 — 유선 번호도 가리게 고친 뒤 그 문서를 다시 가려 담기)

   새 그물(다시 읽은 글을 한 번 더 훑기)은 «앞으로» 담는 것만 지킨다. 이미 담긴 규칙본문 1건에는
   유선 번호 5곳이 그대로 있고, 그 한글 파일도 창고에 있다. 사람이 DB 를 손으로 고치지 않고 수집 회차가 스스로 고친다.
   ■ 지키는 규칙
     ① 담긴 글마다 한 번씩(판 RECHECK_V) 다시 훑는다 — 이미 훑은 것은 다시 안 본다(회차마다 비용이 들지 않게)
     ② 걸리면 글을 가려 다시 쓰고, 파일은 «믿지 않는다» — 창고에서 지우고 file 을 비운다(글만)
     ③ 파일을 못 지웠으면 그 자리를 적어 둔다(fileOrphan) — 이름을 잃어버리면 아무도 못 지운다
     ④ 걸리지 않은 것은 판 표시만 — 글·파일 그대로
   실행: node --test tests/rules-collect-heal.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../functions/rules-collect.js');

function fakeDb(init) {
  const store = JSON.parse(JSON.stringify(init || {}));
  const get = (p) => p.split('/').filter(Boolean).reduce((o, k) => (o == null ? undefined : o[k]), store);
  const set = (p, v) => {
    const ks = p.split('/').filter(Boolean); let o = store;
    ks.slice(0, -1).forEach((k) => { o[k] = o[k] || {}; o = o[k]; });
    if (v === null) delete o[ks[ks.length - 1]]; else o[ks[ks.length - 1]] = JSON.parse(JSON.stringify(v));
  };
  return { store, ref: (p) => ({
    once: async () => ({ val: () => (p ? get(p) : store) ?? null }),
    update: async (obj) => { Object.keys(obj).forEach((k) => set((p ? p + '/' : '') + k, obj[k])); },
    set: async (v) => set(p, v),
  }) };
}
function bucket(fail) {
  const gone = [];
  return { gone, file: (p) => ({ save: async () => {}, delete: async () => { if (fail) throw new Error('창고 오류'); gone.push(p); } }) };
}
const doc = (id, o) => Object.assign({ id, kind: '규칙본문', status: '담김', name: id + '.hwp', revision: 1, textLen: 30,
  pii: { count: { phone: 1 }, residual: 0 }, file: { path: 'rules_lib/' + id + '.hwp', format: 'hwp', size: 10 } }, o);
const init = () => ({
  mailbox: { msgs: {}, old: { msgs: {} } }, data: { companies: { v: [] } },
  rules_mgmt: { library: {
    docs: { rd_a: doc('rd_a'), rd_b: doc('rd_b'), rd_c: doc('rd_c', { status: '보류', file: null }) },
    text: { rd_a: '담당 연락처 031-123-4567', rd_b: '제1조(목적) 근로조건을 정한다.' },
  } },
});
/* 가짜 다시 훑기 — 숫자 꼴만 본다(진짜 kordoc 는 kordoc-redact-leak 검사가 본다) */
const recheck = async (t) => {
  const m = String(t).match(/\d{3}-\d{3}-\d{4}/g) || [];
  return { leak: m.length, count: m.length ? { phone: m.length } : {}, text: String(t).replace(/(\d{3})-\d{3}-(\d{4})/g, '$1-●●●-$2') };
};
const base = (db, b, extra) => Object.assign({ db, bucket: b, now: () => 2e12, limit: 60, budgetMs: 1e9, contractVersion: 1,
  fetchAtts: async () => [], recheck }, extra || {});

test('★★★ 담긴 글에서 번호가 걸리면 가려 다시 쓰고, 파일은 창고에서 지운다(글만)', async () => {
  const db = fakeDb(init()), b = bucket(false);
  const s = await C.run(base(db, b));
  const L = db.store.rules_mgmt.library;
  assert.equal(s.healed, 1);
  assert.equal(L.text.rd_a, '담당 연락처 031-●●●-4567', '★★★ 글을 다시 가리지 않았다');
  assert.equal(L.docs.rd_a.file, undefined, '★★★ 번호가 남은 파일을 그대로 이어 두었다');
  assert.deepEqual(b.gone, ['rules_lib/rd_a.hwp'], '★★ 창고의 파일을 안 지웠다');
  assert.equal(L.docs.rd_a.pii.count.phone, 2, '가린 셈에 더해져야 화면에 보인다');
  assert.equal(L.docs.rd_a.revision, 2);
  assert.equal(L.docs.rd_a.status, '담김');
});

test('④ 걸리지 않은 것은 판 표시만 — 글·파일 그대로 · 보류는 안 본다', async () => {
  const db = fakeDb(init()), b = bucket(false);
  await C.run(base(db, b));
  const L = db.store.rules_mgmt.library;
  assert.equal(L.text.rd_b, '제1조(목적) 근로조건을 정한다.');
  assert.ok(L.docs.rd_b.file && L.docs.rd_b.file.path);
  assert.equal(L.docs.rd_b.recheckV, C.RECHECK_V);
  assert.equal(L.docs.rd_c.recheckV, undefined, '보류(글 없음)까지 훑었다');
});

test('① 한 번 훑은 것은 다시 안 본다', async () => {
  const db = fakeDb(init()), b = bucket(false);
  await C.run(base(db, b));
  let n = 0;
  await C.run(base(db, b, { recheck: async (t) => { n++; return recheck(t); } }));
  assert.equal(n, 0, '회차마다 모든 글을 다시 훑는다 — 이어 달리기 150번이면 150번');
});

test('③ 파일을 못 지웠으면 그 자리를 적어 둔다', async () => {
  const db = fakeDb(init()), b = bucket(true);
  await C.run(base(db, b));
  const d = db.store.rules_mgmt.library.docs.rd_a;
  assert.equal(d.file, undefined, '못 지웠어도 이어 두면 안 된다');
  assert.equal(d.fileOrphan, 'rules_lib/rd_a.hwp', '★ 못 지운 파일의 자리를 잃었다');
});
