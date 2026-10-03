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

/* ── 고침 1회차: 중간에 터진 메일의 문서를 다음 메일이 「이미 있다」며 겹침으로 세면 영영 사라진다 ── */
const ruleDoc = (tag) => ({ name: '가나상사_취업규칙' + tag + '.hwpx', data: gana('별표 ' + tag) });
test('★ 첫 메일이 중간에 터져도, 같은 파일이 붙은 다음 메일이 그 문서를 잃게 하지 않는다', async () => {
  const A = ruleDoc('A'), B = ruleDoc('B');
  const BYMAIL = { 'i_INBOX-4a1e411c_12': [A, B], 'i_INBOX-4a1e411c_11': [A] };
  const db = fakeDb(MAIL);
  let saves = 0, healthy = false;
  const files = {};
  const bucket = { files, file: (name) => ({ save: async (data) => {
    saves++;
    if (!healthy && saves === 2) throw Object.assign(new Error('창고 끊김'), { code: 'EPIPE' });   // 첫 메일의 둘째 첨부에서만
    files[name] = Buffer.from(data);
  } }) };
  const opts = (extra) => base(db, bucket, Object.assign({ fetchAtts: async (m) => BYMAIL[m.mailKey] || [] }, extra || {}));
  const s1 = await C.run(opts({ limit: 2 }));
  const lib = db.store.rules_mgmt.library;
  assert.equal(s1.retry, 1);
  assert.equal(lib.seen['i_INBOX-4a1e411c_12'], undefined, '터진 메일은 seen 에 안 적는다');
  const idA = Object.keys(lib.docs).find((id) => lib.docs[id].name.includes('규칙A'));
  Object.values(lib.seen).forEach((sn) => (sn.docs || []).forEach((id) => assert.ok(lib.docs[id], '★ seen 이 가리키는 문서가 없다: ' + id)));
  assert.ok(idA && lib.docs[idA].status === '담김', '둘째 메일이 A 를 담았어야');
  healthy = true;
  await C.run(opts({ limit: 60 }));
  const names = Object.values(db.store.rules_mgmt.library.docs).map((d) => d.name).sort();
  assert.ok(names.some((n) => n.includes('규칙B')), '다시 돌리면 B 도 담긴다');
  assert.ok(db.store.rules_mgmt.library.seen['i_INBOX-4a1e411c_12'], '다시 돌려 이제 본 것으로 적힌다');
});

test('오류에는 이름표만 — 메시지(글 조각 인용 가능)는 담지 않는다', async () => {
  const db = fakeDb(MAIL), bucket = fakeBucket();
  const s = await C.run(base(db, bucket, { fetchAtts: async () => { throw new Error('본문 인용 900101-1234567'); } }));
  assert.ok(!JSON.stringify(db.store.rules_mgmt).includes('900101'), '★ 오류 메시지가 DB 에 남았다');
  assert.ok(!JSON.stringify(s).includes('900101'));
  assert.ok(s.errors.length >= 1);
});

test('메일 하나의 DB 쓰기가 터져도 회차 기록은 남고 그 메일은 다시 시도로 센다', async () => {
  const db = fakeDb(MAIL), bucket = fakeBucket();
  const realRef = db.ref;
  db.ref = (p) => {
    const r = realRef(p);
    if (!p) return { ...r, update: async (obj) => { if (Object.keys(obj).some((k) => k.includes('/seen/'))) throw Object.assign(new Error('쓰기 실패'), { code: 'EDB' }); return r.update(obj); } };
    return r;
  };
  const s = await C.run(base(db, bucket, { limit: 1 }));
  assert.equal(s.retry, 1);
  assert.equal(s.stored, 0, '쓰이지 않은 것은 담음으로 세지 않는다');
  assert.ok(db.store.rules_mgmt.library.run, '회차 기록은 쓰인다');
});

test('큰 첨부가 이미 보류로 있어도 seen.docs 에는 그 id 가 들어간다', async () => {
  const db = fakeDb(MAIL), bucket = fakeBucket();
  const fa = async () => [{ name: '큰취업규칙.hwp', tooBig: true }];
  await C.run(base(db, bucket, { limit: 1, fetchAtts: fa }));
  const lib = db.store.rules_mgmt.library;
  const key = Object.keys(lib.seen)[0], id = Object.keys(lib.docs)[0];
  delete lib.seen[key];   // 같은 메일을 다시 보게 한다(문서는 이미 있음)
  await C.run(base(db, bucket, { limit: 1, fetchAtts: fa }));
  assert.deepEqual(db.store.rules_mgmt.library.seen[key].docs, [id]);
});

/* ★★★ 취업규칙 서류가 아닌 첨부는 «글을 담지 않는다» (2026-10-03 첫 회차 실측)
   본문에 「취업규칙」 이 든 메일이면 첨부를 다 받는데, 첫 회차 47건 가운데 23건이 「기타」였다 —
   대부분 징계 통지서·징계위원회 회의록·의결서(근로자 이름이 그대로 든 인사 기록)였다.
   이름은 가리지 않기로 한 것이라(헛잡기) 그 글이 재직 직원 전체가 읽는 자리에 앉았다.
   → 갈래가 「기타」면 보류 줄(까닭만)로 남기고 글·파일은 아무것도 안 담는다. */
test('★★★ 갈래가 「기타」인 첨부는 글을 담지 않는다 — 징계 기록 같은 것이 직원 전체에 열린다', async () => {
  const mail = JSON.parse(JSON.stringify(MAIL));
  mail.mailbox.msgs['INBOX-4a1e411c'] = { 20: { s: '징계위원회 관련 — 취업규칙 제30조에 따라', d: 4000, e: 'hr@gana.co.kr', a: 1 } };
  const db = fakeDb(mail), bucket = fakeBucket();
  const doc = H.build(H.para('징계위원회 회의록') + H.para('대상자 홍길동 — 무단결근 3일'));
  const sum = await C.run(base(db, bucket, { fetchAtts: async () => [{ name: '1. 징계위원회 회의록 (홍길동).hwpx', data: doc }] }));
  const lib = db.store.rules_mgmt.library;
  const d = Object.values(lib.docs)[0];
  assert.equal(sum.stored, 0, '★★★ 취업규칙 서류가 아닌데 담았다');
  assert.equal(sum.held, 1);
  assert.equal(d.status, '보류');
  assert.equal(d.kind, '기타');
  assert.match(d.holdWhy, /취업규칙 서류가 아님/);
  assert.equal((lib.text || {})[d.id], undefined, '★★★ 글을 담았다');
  assert.equal(d.file, null);
  assert.equal(d.textLen, 0);
  assert.ok(!JSON.stringify(db.store.rules_mgmt).includes('무단결근'), '★★★ 본문 글자가 어딘가 남았다');
  assert.deepEqual(Object.keys(bucket.files), []);
  assert.ok(lib.seen['i_INBOX-4a1e411c_20'], '본 메일로 적어야 다음에 다시 안 받는다');
});
