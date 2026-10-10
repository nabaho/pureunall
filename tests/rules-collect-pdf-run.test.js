/* 모으기 회차 × PDF (설계 §11-3·§11-4) — 가짜 DB·메일로 «실제로» 돌린다. 이름·번호는 가짜만.
   ★ 못 박는 규칙: PDF 는 맨 뒤 · 같은 메일 한글 본문이 담기면 PDF 규칙본문은 사본 보류 · 원래 번호는 어디에도 없다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
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
  return { store, ref: (p) => ({
    once: async () => ({ val: () => (p ? get(p) : store) ?? null }),
    update: async (obj) => { Object.keys(obj).forEach((k) => set((p ? p + '/' : '') + k, obj[k])); },
    set: async (v) => set(p, v),
  }) };
}
function fakeBucket() { const files = {}; return { files, file: (n) => ({ save: async (d) => { files[n] = Buffer.from(d); }, delete: async () => { delete files[n]; } }) }; }
const RULE_TEXT = '제1조(목적) 이 규칙은 가나상사 사원의 근로조건을 정한다.\n' + Array.from({ length: 12 }, (_, i) => '제' + (i + 2) + '조(조목) 내용 ' + i).join('\n');
/* 가짜 PDF — 바이트에 표시만 두고, o.redact 가 그 표시를 보고 글을 돌려준다(pdf.js 없이 회차 길만 본다) */
const fakePdf = (tag) => Buffer.from('%PDF-FAKE ' + tag);
function fakeRedact(real) {
  return async (buf, ext) => {
    if (ext !== 'pdf') return real(buf, ext);
    const tag = buf.toString('latin1').replace('%PDF-FAKE ', '');
    if (tag === 'scan') return { ok: false, holdWhy: '스캔 PDF — 글 없음', count: {}, total: 0 };
    return { ok: true, format: 'pdf', text: RULE_TEXT + '\n' + tag, data: null, count: { 주민: 1 }, total: 1 };
  };
}
const X = require('../functions/rules-collect-redact.js');
const MAIL = (rows) => ({ mailbox: { msgs: { 'INBOX-4a1e411c': rows }, old: { msgs: {} } },
  data: { companies: { v: [{ id: 'co_gana', name: '가나상사', email: 'hr@gana.co.kr' }] } } });
const base = (db, bucket, atts, extra) => Object.assign({ db, bucket, now: () => 1e12, limit: 60, budgetMs: 1e9,
  contractVersion: 1, fetchAtts: async (m) => atts[m.mailKey] || [], redact: fakeRedact(X.redactOne) }, extra || {});
const docsOf = (db) => Object.values(((db.store.rules_mgmt || {}).library || {}).docs || {});

test('한글 본문과 PDF 가 한 메일 — PDF 가 앞에 와도 PDF 는 사본 보류, 한글은 담김', async () => {
  const db = fakeDb(MAIL({ 10: { s: '가나상사 취업규칙 송부', d: 3000, e: 'hr@gana.co.kr', a: 2 } })), bucket = fakeBucket();
  const hw = H.build(H.para(RULE_TEXT.split('\n')[0]) + H.para('제2조(정의) 사원이란 …') + H.para('담당 ' + RRN));
  await C.run(base(db, bucket, { 'i_INBOX-4a1e411c_10': [{ name: '가나상사_취업규칙.pdf', data: fakePdf('a') }, { name: '가나상사_취업규칙.hwpx', data: hw }] }));
  assert.ok(!JSON.stringify(db.store.rules_mgmt).includes(RRN), '★ 원래 주민번호가 DB 어딘가에 남았다');
  const ds = docsOf(db);
  const pdf = ds.find((d) => /\.pdf$/.test(d.name)), hwp = ds.find((d) => /\.hwpx$/.test(d.name));
  assert.equal(hwp.status, '담김');
  assert.equal(pdf.status, '보류');
  assert.equal(pdf.holdWhy, C.PDF_HOLD.COPY);
  assert.equal(db.store.rules_mgmt.library.text[pdf.id], undefined, '★ 사본인데 글을 담았다');
});

test('PDF 만 있는 메일 — 가린 글을 담고 파일은 안 담는다', async () => {
  const db = fakeDb(MAIL({ 11: { s: '가나상사 취업규칙', d: 3100, e: 'hr@gana.co.kr', a: 1 } })), bucket = fakeBucket();
  await C.run(base(db, bucket, { 'i_INBOX-4a1e411c_11': [{ name: '가나상사_취업규칙.pdf', data: fakePdf('b') }] }));
  const pdf = docsOf(db)[0];
  assert.equal(pdf.status, '담김');
  assert.equal(pdf.kind, '규칙본문');
  assert.equal(pdf.file, null);
  assert.ok(db.store.rules_mgmt.library.text[pdf.id].startsWith('제1조'));
  assert.equal(Object.keys(bucket.files).length, 0, '★ PDF 파일을 창고에 담았다');
});

test('스캔 PDF — 보류(스캔), 글 없음', async () => {
  const db = fakeDb(MAIL({ 12: { s: '가나상사 취업규칙', d: 3200, e: 'hr@gana.co.kr', a: 1 } })), bucket = fakeBucket();
  await C.run(base(db, bucket, { 'i_INBOX-4a1e411c_12': [{ name: '가나상사_취업규칙.pdf', data: fakePdf('scan') }] }));
  const pdf = docsOf(db)[0];
  assert.deepEqual([pdf.status, pdf.holdWhy], ['보류', '스캔 PDF — 글 없음']);
});

test('isPdfName', () => {
  assert.equal(C.isPdfName('a.PDF'), true);
  assert.equal(C.isPdfName('a.hwp'), false);
  assert.equal(C.isPdfName('xpdf'), false);
  assert.equal(C.isPdfName('a_pdf'), false);
});

/* R1 — 한글 본문이 «겹침»(앞 메일·옛 회차에 이미 있음)이어도 같은 메일의 PDF 는 사본 보류 */
const hwBody = () => H.build(H.para(RULE_TEXT.split('\n')[0]) + H.para('제2조(정의) 사원이란 …'));

test('뒤 메일이 같은 한글 본문을 다시 붙여 오고 새 PDF 도 — PDF 는 사본 보류 (같은 회차)', async () => {
  const db = fakeDb(MAIL({
    /* 회차는 «새 메일부터» 돈다(날짜 내림차순) — 한글 본문을 먼저 담는 쪽(21)이 더 새 것, 다시 붙여 온 쪽(20)이 더 옛것 */
    21: { s: '가나상사 취업규칙', d: 4100, e: 'hr@gana.co.kr', a: 1 },
    20: { s: 'RE: 가나상사 취업규칙', d: 4000, e: 'hr@gana.co.kr', a: 2 } })), bucket = fakeBucket();
  const hw = hwBody();
  await C.run(base(db, bucket, {
    'i_INBOX-4a1e411c_21': [{ name: '가나상사_취업규칙.hwpx', data: hw }],
    'i_INBOX-4a1e411c_20': [{ name: '가나상사_취업규칙.hwpx', data: hw }, { name: '가나상사_취업규칙_최종.pdf', data: fakePdf('c') }] }));
  const ds = docsOf(db);
  const pdf = ds.find((d) => /\.pdf$/.test(d.name));
  assert.equal(ds.filter((d) => /\.hwpx$/.test(d.name)).length, 1);
  assert.equal(pdf.status, '보류');
  assert.equal(pdf.holdWhy, C.PDF_HOLD.COPY);
  assert.equal(db.store.rules_mgmt.library.text[pdf.id], undefined, '★ 사본인데 글을 담았다');
});

test('한글 본문이 회차 전에 이미 담겨 있다 — 새 메일의 PDF 는 사본 보류', async () => {
  const P = require('../functions/rules-collect-pick.js');
  const hw = hwBody();
  const hid = P.docIdOf(crypto.createHash('sha256').update(hw).digest('hex'));
  const seed = MAIL({ 30: { s: '가나상사 취업규칙', d: 5000, e: 'hr@gana.co.kr', a: 2 } });
  seed.rules_mgmt = { library: { docs: { [hid]: { id: hid, name: '가나상사_취업규칙.hwpx', kind: '규칙본문', status: '담김' } } } };
  const db = fakeDb(seed), bucket = fakeBucket();
  await C.run(base(db, bucket, { 'i_INBOX-4a1e411c_30': [{ name: '가나상사_취업규칙.hwpx', data: hw }, { name: '가나상사_취업규칙.pdf', data: fakePdf('d') }] }));
  const pdf = docsOf(db).find((d) => /\.pdf$/.test(d.name));
  assert.equal(pdf.status, '보류');
  assert.equal(pdf.holdWhy, C.PDF_HOLD.COPY);
  assert.equal(((db.store.rules_mgmt.library || {}).text || {})[pdf.id], undefined, '★ 사본인데 글을 담았다');
});
