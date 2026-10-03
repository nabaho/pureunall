/* 한 회차를 가짜 DB·창고·메일로 «실제로» 돌린다 (메일 동기화 검사와 같은 방식).
   지키는 것: 고르기→받기→가리기→담기, 겹침 거르기, 한도, 다시 시도 가르기,
   ★ DB·창고에 쓰인 어디에도 원래 번호가 없다, ★ 보류는 아무것도 안 담는다,
   ★ 도장·서명 그림이 붙는 갈래(동의서 등)는 글만 담고 파일은 창고에 안 둔다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../hwpx_gen.js');
const C = require('../functions/rules-collect.js');

const RRN = '900101-1234567';
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
function fakeBucket() {
  const files = {};
  return { files, file: (name) => ({ save: async (data) => { files[name] = Buffer.from(data); } }) };
}
const gana = (s) => H.build(H.para('제1조(목적) 이 규칙은 가나상사 사원의 근로조건을 정한다.') + H.para(s));
const MAIL = {
  mailbox: {
    msgs: {
      'INBOX-4a1e411c': {
        10: { s: '가나상사 취업규칙 송부', d: 3000, e: 'hr@gana.co.kr', a: 2 },
        11: { s: 'RE: 가나상사 취업규칙 송부', d: 3500, e: 'hr@gana.co.kr', a: 1 },
        12: { s: '취업규칙 동의서', d: 3600, e: 'hr@gana.co.kr', a: 1 },
      },
    },
    old: { msgs: {} },
  },
  data: { companies: { v: [{ id: 'co_gana', name: '가나상사', email: 'hr@gana.co.kr' }] } },
};
const SAME = gana('연락처 010-9876-5432 주민 ' + RRN);   // 답장에 «같은 파일» — 같은 바이트여야 겹침이 된다
const ATTS = {
  'i_INBOX-4a1e411c_10': [{ name: '가나상사_취업규칙(안).hwpx', data: SAME },
                          { name: '사진.jpg', data: Buffer.from('x') }],
  'i_INBOX-4a1e411c_11': [{ name: '가나상사_취업규칙(안).hwpx', data: SAME }],
  'i_INBOX-4a1e411c_12': [{ name: '동의서_스캔.pdf', data: Buffer.from('%PDF-1.7 ' + RRN) }],
};
const base = (db, bucket, extra) => Object.assign({ db, bucket, now: () => 1e12, limit: 60, budgetMs: 1e9,
  contractVersion: 1, fetchAtts: async (m) => ATTS[m.mailKey] || [] }, extra || {});

test('담고, 겹침은 한 번만, PDF 는 보류 줄만 — 원래 번호는 어디에도 없다', async () => {
  const db = fakeDb(MAIL), bucket = fakeBucket();
  const sum = await C.run(base(db, bucket));
  const lib = db.store.rules_mgmt.library;
  const docs = Object.values(lib.docs);
  assert.equal(sum.stored, 1);
  assert.equal(sum.dup, 1, '같은 파일이 답장에 또 붙었다 — 한 번만');
  assert.equal(sum.held, 1);
  const kept = docs.find((d) => d.status === '담김');
  assert.equal(kept.kind, '규칙본문');
  assert.equal(kept.entityType, 'RulesDocument');
  assert.deepEqual(kept.companyCand, [{ companyId: 'co_gana', why: '주소' }]);
  assert.equal(kept.companyLinkStatus, 'pending');
  assert.equal(kept.companyId, null, '★ 후보를 사업장으로 확정했다 — 확정은 사람');
  assert.ok(kept.file && /^rules_lib\/rd_\w+\.hwpx$/.test(kept.file.path));
  const held = docs.find((d) => d.status === '보류');
  assert.match(held.holdWhy, /PDF/);
  assert.equal(held.file, null);
  assert.equal(lib.text[held.id], undefined, '★ 보류인데 글을 담았다');
  const everything = JSON.stringify(db.store.rules_mgmt) + Object.values(bucket.files).map((b) => b.toString('latin1')).join('');
  assert.ok(!everything.includes(RRN), '★ DB·창고 어딘가에 원래 주민번호가 남았다');
  assert.ok(lib.seen['i_INBOX-4a1e411c_10'] && lib.seen['i_INBOX-4a1e411c_12']);
  assert.equal(lib.run.stored, 1);
});

test('동의서는 글만 담는다 — 파일은 창고에 안 둔다(도장·서명 그림을 kordoc 이 안 본다)', async () => {
  const db = fakeDb(MAIL), bucket = fakeBucket();
  const s = await C.run(base(db, bucket, { limit: 1, fetchAtts: async () =>
    [{ name: '동의서.hwpx', data: gana('동의자 서명 주민 ' + RRN) }] }));
  assert.equal(s.stored, 1);
  const lib = db.store.rules_mgmt.library;
  const d = Object.values(lib.docs)[0];
  assert.equal(d.kind, '동의서');
  assert.equal(d.status, '담김');
  assert.equal(d.file, null, '★ 도장·서명이 든 갈래의 파일을 창고에 뒀다');
  assert.deepEqual(Object.keys(bucket.files), [], '★ 창고에 뭔가 올라갔다');
  assert.ok(typeof lib.text[d.id] === 'string' && lib.text[d.id].length > 0, '글은 담긴다');
  assert.ok(!JSON.stringify(db.store.rules_mgmt).includes(RRN));
});

test('다시 돌리면 본 메일은 안 본다', async () => {
  const db = fakeDb(MAIL), bucket = fakeBucket();
  await C.run(base(db, bucket));
  const again = await C.run(base(db, bucket));
  assert.equal(again.mails, 0);
});

test('한도 — limit 통까지만', async () => {
  const db = fakeDb(MAIL), bucket = fakeBucket();
  const s = await C.run(base(db, bucket, { limit: 1 }));
  assert.equal(s.mails, 1);
});

test('연결이 끊기면 seen 에 안 적어 다음에 다시 — 지워진 메일(404)은 적고 끝', async () => {
  const db = fakeDb(MAIL), bucket = fakeBucket();
  const s = await C.run(base(db, bucket, { fetchAtts: async (m) => {
    if (m.mailKey.endsWith('_10')) throw Object.assign(new Error('끊김'), { code: 'ECONNRESET' });
    if (m.mailKey.endsWith('_11')) throw Object.assign(new Error('없음'), { status: 404 });
    return [];
  } }));
  const seen = db.store.rules_mgmt.library.seen;
  assert.equal(seen['i_INBOX-4a1e411c_10'], undefined, '★ 끊긴 메일을 본 것으로 적었다 — 영영 안 다시 본다');
  assert.equal(seen['i_INBOX-4a1e411c_11'].why, '없어짐');
  assert.equal(s.retry, 1);
});

test('「담음 0, 오류 있음」이 사흘 이어지면 alert', async () => {
  const db = fakeDb(Object.assign({}, MAIL, { rules_mgmt: { library: { run: { zeroStreak: 2 } } } })), bucket = fakeBucket();
  const s = await C.run(base(db, bucket, { fetchAtts: async () => { throw Object.assign(new Error('끊김'), { code: 'ETIMEDOUT' }); } }));
  assert.equal(s.zeroStreak, 3);
  assert.equal(s.alert, true);
  const ok = await C.run(base(fakeDb(MAIL), fakeBucket()));
  assert.equal(ok.zeroStreak, 0);
  assert.equal(ok.alert, false);
});

test('너무 큰 첨부는 보류', async () => {
  const db = fakeDb(MAIL), bucket = fakeBucket();
  await C.run(base(db, bucket, { limit: 1, fetchAtts: async () => [{ name: '큰취업규칙.hwp', tooBig: true }] }));
  const d = Object.values(db.store.rules_mgmt.library.docs)[0];
  assert.equal(d.status, '보류');
  assert.match(d.holdWhy, /20MB/);
});
