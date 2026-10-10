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

/* ── 다시 보기 ── */
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
function heldDoc(id, o) {
  return Object.assign({ id, entityType: 'RulesDocument', revision: 1, name: o.name, kind: o.kind || '규칙본문', sha: o.sha,
    status: '보류', holdWhy: o.why || C.PDF_HOLD.OLD, file: null, textLen: 0, pii: { count: {}, residual: 0 }, dir: '받음',
    mail: { src: 'imap', box: 'INBOX-4a1e411c', key: o.uid, date: 3000, from: 'hr@gana.co.kr', to: '', subject: 's' },
    companyCand: [], companyId: null, companyLinkStatus: 'pending', createdAt: 1, updatedAt: 1 }, o.extra || {});
}
function seeded(docsList, seen, rows) {
  const init = MAIL(rows || { 20: { s: '가나상사 취업규칙', d: 3000, e: 'hr@gana.co.kr', a: 2 } });
  const docs = {}; docsList.forEach((d) => { docs[d.id] = d; });
  init.rules_mgmt = { library: { docs, seen: seen || {}, text: {} } };
  return init;
}
const PA = fakePdf('A'), PB = fakePdf('B');

test('다시 보기 — 옛 PDF 보류 규칙본문만, 지문이 같은 첨부만 읽어 담는다', async () => {
  const idA = 'rd_' + sha(PA).slice(0, 24), idC = 'rd_c';
  const db = fakeDb(seeded([heldDoc(idA, { name: '취업규칙.pdf', sha: sha(PA), uid: '20' }),
    heldDoc(idC, { name: '동의서.pdf', kind: '동의서', sha: 'x', uid: '20' })],
    { 'i_INBOX-4a1e411c_20': { at: 1, docs: [idA, idC], why: '' } }));
  let fetched = 0;
  const sum = await C.run(base(db, fakeBucket(), { 'i_INBOX-4a1e411c_20': [{ name: '다른.pdf', data: PB }, { name: '취업규칙.pdf', data: PA }] },
    { fetchAtts: async (m) => { fetched++; return m.mailKey === 'i_INBOX-4a1e411c_20' ? [{ name: '다른.pdf', data: PB }, { name: '취업규칙.pdf', data: PA }] : []; } }));
  const lib = db.store.rules_mgmt.library;
  assert.equal(lib.docs[idA].status, '담김');
  assert.equal(lib.docs[idA].revision, 2);
  assert.ok(lib.text[idA].startsWith('제1조'));
  assert.equal(lib.docs[idC].holdWhy, C.PDF_HOLD.OLD, '★ 동의서 PDF 를 다시 읽었다(범위 밖)');
  assert.equal(Object.keys(lib.docs).length, 2, '★ 지문이 다른 첨부(다른.pdf)를 새로 담았다');
  assert.equal(fetched, 1);
  assert.equal(sum.pdf.done, 1); assert.equal(sum.pdf.stored, 1); assert.equal(sum.pdf.left, 0);
});

test('다시 보기 — 같은 메일에 한글 본문이 담겨 있으면 사본 보류', async () => {
  const idA = 'rd_' + sha(PA).slice(0, 24);
  const hw = { id: 'rd_h', entityType: 'RulesDocument', revision: 1, name: '취업규칙.hwp', kind: '규칙본문', status: '담김', sha: 'h', mail: { src: 'imap', box: 'INBOX-4a1e411c', key: '20' } };
  const db = fakeDb(seeded([heldDoc(idA, { name: '취업규칙.pdf', sha: sha(PA), uid: '20' }), hw],
    { 'i_INBOX-4a1e411c_20': { at: 1, docs: [idA, 'rd_h'], why: '' } }));
  await C.run(base(db, fakeBucket(), { 'i_INBOX-4a1e411c_20': [{ name: '취업규칙.pdf', data: PA }] }));
  const d = db.store.rules_mgmt.library.docs[idA];
  assert.deepEqual([d.status, d.holdWhy], ['보류', C.PDF_HOLD.COPY]);
});

test('다시 보기 — 첨부를 못 찾으면 못 찾음, 메일 줄이 없어도 못 찾음', async () => {
  const idA = 'rd_' + sha(PA).slice(0, 24), idZ = 'rd_z';
  const db = fakeDb(seeded([heldDoc(idA, { name: '취업규칙.pdf', sha: sha(PA), uid: '20' }),
    heldDoc(idZ, { name: '규칙.pdf', sha: 'zz', uid: '99' })], {}));
  await C.run(base(db, fakeBucket(), { 'i_INBOX-4a1e411c_20': [{ name: '다른.pdf', data: PB }] }));
  const lib = db.store.rules_mgmt.library;
  assert.equal(lib.docs[idA].holdWhy, C.PDF_HOLD.LOST);
  assert.equal(lib.docs[idZ].holdWhy, C.PDF_HOLD.LOST, '메일 목록에 줄이 없다');
});

test('다시 보기 — 연결이 끊기면 그대로 두고 남은 것으로 센다, 두 번 멈춘 메일은 멈춤', async () => {
  const idA = 'rd_' + sha(PA).slice(0, 24);
  const db = fakeDb(seeded([heldDoc(idA, { name: '취업규칙.pdf', sha: sha(PA), uid: '20' })], {}));
  const sum = await C.run(base(db, fakeBucket(), {}, { fetchAtts: async () => { throw Object.assign(new Error('끊김'), { code: 'ECONNRESET' }); } }));
  assert.equal(db.store.rules_mgmt.library.docs[idA].holdWhy, C.PDF_HOLD.OLD);
  assert.equal(sum.pdf.left, 1);
  assert.ok(sum.left >= 1, '이어 달리기가 받게 left 에 더한다');
  const db2 = fakeDb(seeded([heldDoc(idA, { name: '취업규칙.pdf', sha: sha(PA), uid: '20' })], {}));
  db2.store.rules_mgmt.library.try = { 'pdf_i_INBOX-4a1e411c_20': { at: 1, n: C.STUCK_MAX } };
  await C.run(base(db2, fakeBucket(), { 'i_INBOX-4a1e411c_20': [{ name: '취업규칙.pdf', data: PA }] }));
  assert.equal(db2.store.rules_mgmt.library.docs[idA].holdWhy, C.PDF_HOLD.STUCK);
});

test('다시 보기 — 예산이 다 되면 시작하지 않는다', async () => {
  const idA = 'rd_' + sha(PA).slice(0, 24);
  const db = fakeDb(seeded([heldDoc(idA, { name: '취업규칙.pdf', sha: sha(PA), uid: '20' })], {}));
  let t = 0;
  const sum = await C.run(base(db, fakeBucket(), { 'i_INBOX-4a1e411c_20': [{ name: '취업규칙.pdf', data: PA }] },
    { now: () => (t += 1e6), budgetMs: 1e6 }));
  assert.equal(db.store.rules_mgmt.library.docs[idA].holdWhy, C.PDF_HOLD.OLD);
  assert.equal(sum.pdf.left, 1);
});

/* ── 다시 보기 보강 (검토 1차) ── */
const KEY20 = 'i_INBOX-4a1e411c_20', KEY21 = 'i_INBOX-4a1e411c_21';
const ROWS2 = { 20: { s: '가나상사 취업규칙', d: 3000, e: 'hr@gana.co.kr', a: 1 }, 21: { s: '가나상사 취업규칙 둘', d: 3001, e: 'hr@gana.co.kr', a: 1 } };
const seenOf = (...ks) => { const o = {}; ks.forEach((k) => { o[k] = { at: 1, docs: [], why: '' }; }); return o; };
const tryOf = (db) => ((db.store.rules_mgmt.library || {}).try) || {};

test('다시 보기 — pdf.js 를 못 실으면(OLD 가 돌아옴) 아무것도 안 쓰고 멈춘다, 이어 달리지 않는다', async () => {
  const idA = 'rd_a', idB = 'rd_b';
  const db = fakeDb(seeded([heldDoc(idA, { name: '취업규칙.pdf', sha: sha(PA), uid: '20' }), heldDoc(idB, { name: '규칙.pdf', sha: sha(PB), uid: '21' })],
    seenOf(KEY20, KEY21), ROWS2));
  let fetched = 0;
  const sum = await C.run(base(db, fakeBucket(), {}, {
    fetchAtts: async (m) => { fetched++; return [{ name: '취업규칙.pdf', data: PA }, { name: '규칙.pdf', data: PB }]; },
    redact: async () => ({ ok: false, holdWhy: C.PDF_HOLD.OLD, count: {}, total: 0 }),
  }));
  const lib = db.store.rules_mgmt.library;
  [idA, idB].forEach((id) => { assert.equal(lib.docs[id].holdWhy, C.PDF_HOLD.OLD); assert.equal(lib.docs[id].revision, 1, '★ 환경 탓인데 문서를 고쳐 썼다'); });
  assert.equal(fetched, 1, '★ 멈추지 않고 다음 메일도 받았다');
  assert.deepEqual(Object.keys(tryOf(db)).filter((k) => k.indexOf('pdf_') === 0), [], '표시가 남았다');
  assert.equal(sum.pdf.done, 0); assert.equal(sum.pdf.left, 2);
  assert.ok(sum.errors.indexOf('PDFJS_MISSING') >= 0);
  assert.equal(C.shouldChain(sum, 0), false, '★ pdf.js 없는 환경에서 이어 달린다');
});

test('다시 보기 — 큰 메일: 처음 멈춤은 큰 메일 표시로 올리고, 다음엔 길게 기다려 읽고, 또 멈추면 닫는다', async () => {
  const idA = 'rd_' + sha(PA).slice(0, 24);
  const mk = () => seeded([heldDoc(idA, { name: '취업규칙.pdf', sha: sha(PA), uid: '20' })], seenOf(KEY20));
  const db = fakeDb(mk());
  const s1 = await C.run(base(db, fakeBucket(), {}, { fetchAtts: async () => { throw Object.assign(new Error('멈춤'), { code: 'FETCH_TIMEOUT', hang: true }); } }));
  assert.equal(db.store.rules_mgmt.library.docs[idA].holdWhy, C.PDF_HOLD.OLD);
  assert.equal(tryOf(db)['pdf_' + KEY20].slow, true);
  assert.equal(tryOf(db)['pdf_' + KEY20].n, 0);
  assert.equal(s1.retry, 1);
  const waits = [];
  const s2 = await C.run(base(db, fakeBucket(), { [KEY20]: [{ name: '취업규칙.pdf', data: PA }] }, { slowMs: 7777,
    fetchAtts: async () => { waits.push(1); return [{ name: '취업규칙.pdf', data: PA }]; } }));
  assert.equal(db.store.rules_mgmt.library.docs[idA].status, '담김');
  assert.equal(s2.pdf.stored, 1);
  assert.equal(tryOf(db)['pdf_' + KEY20], undefined);
  const db3 = fakeDb(mk());
  db3.store.rules_mgmt.library.try = { ['pdf_' + KEY20]: { at: 1, n: 1, slow: true } };
  await C.run(base(db3, fakeBucket(), { [KEY20]: [{ name: '취업규칙.pdf', data: PA }] }));
  assert.equal(db3.store.rules_mgmt.library.docs[idA].holdWhy, C.PDF_HOLD.STUCK);
});

test('다시 보기 — 큰 메일은 긴 기다림이 남은 예산에 안 들어가면 시작하지 않는다', async () => {
  const idA = 'rd_' + sha(PA).slice(0, 24);
  const db = fakeDb(seeded([heldDoc(idA, { name: '취업규칙.pdf', sha: sha(PA), uid: '20' })], seenOf(KEY20)));
  db.store.rules_mgmt.library.try = { ['pdf_' + KEY20]: { at: 1, n: 0, slow: true } };
  let fetched = 0, t = 0;
  const sum = await C.run(base(db, fakeBucket(), {}, { now: () => (t += 2000), budgetMs: 6000, slowMs: 5000, fetchMs: 10, fetchAtts: async () => { fetched++; return []; } }));
  assert.equal(fetched, 0);
  assert.equal(sum.pdf.left, 1);
});

test('다시 보기 — 읽다 터지면 표시를 남겨 STUCK_MAX 번째에 멈춤으로 닫는다', async () => {
  const idA = 'rd_' + sha(PA).slice(0, 24);
  const db = fakeDb(seeded([heldDoc(idA, { name: '취업규칙.pdf', sha: sha(PA), uid: '20' })], seenOf(KEY20)));
  const opt = { fetchAtts: async () => [{ name: '취업규칙.pdf', data: PA }], redact: async () => { throw Object.assign(new Error('깨짐'), { code: 'BOOM' }); } };
  const s1 = await C.run(base(db, fakeBucket(), {}, opt));
  assert.equal(tryOf(db)['pdf_' + KEY20].n, 1, '★ 터졌는데 표시를 지웠다 — 영영 안 멈춘다');
  assert.equal(s1.retry, 1);
  for (let i = 1; i < C.STUCK_MAX; i++) await C.run(base(db, fakeBucket(), {}, opt));
  assert.equal(tryOf(db)['pdf_' + KEY20].n, C.STUCK_MAX);
  assert.equal(db.store.rules_mgmt.library.docs[idA].holdWhy, C.PDF_HOLD.OLD);
  await C.run(base(db, fakeBucket(), {}, opt));
  assert.equal(db.store.rules_mgmt.library.docs[idA].holdWhy, C.PDF_HOLD.STUCK);
  assert.equal(tryOf(db)['pdf_' + KEY20], undefined);
});

test('다시 보기 — 메일 줄이 없어 못 찾음으로 닫으면 표시도 치운다', async () => {
  const idZ = 'rd_z';
  const db = fakeDb(seeded([heldDoc(idZ, { name: '규칙.pdf', sha: 'zz', uid: '99' })], {}));
  db.store.rules_mgmt.library.try = { 'pdf_i_INBOX-4a1e411c_99': { at: 1, n: 1 } };
  await C.run(base(db, fakeBucket(), {}));
  assert.equal(db.store.rules_mgmt.library.docs[idZ].holdWhy, C.PDF_HOLD.LOST);
  assert.equal(tryOf(db)['pdf_i_INBOX-4a1e411c_99'], undefined);
});

test('다시 보기 — 대상이 없으면 셈은 옛 그대로(pdf 0, left 0)', async () => {
  const db = fakeDb(MAIL({ 30: { s: '가나상사 취업규칙', d: 3000, e: 'hr@gana.co.kr', a: 1 } }));
  const sum = await C.run(base(db, fakeBucket(), { 'i_INBOX-4a1e411c_30': [{ name: '가나상사_취업규칙.pdf', data: fakePdf('n') }] }));
  assert.deepEqual(sum.pdf, { done: 0, stored: 0, held: 0, left: 0 });
  assert.equal(sum.mails, 1); assert.equal(sum.retry, 0); assert.equal(sum.left, 0);
});
