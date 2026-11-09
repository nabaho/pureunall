'use strict';
/* 보낸메일에서 지난 견적·계약 가져오기 (견적·계약 자동화 계획 1 · 작업 7)
   Review Focus — ② 같은 메일을 두 번 가져올 때 ③ AI 한도에 걸릴 때 ④ 금액을 못 읽은 견적.
   ★ 주민번호는 AI 로 나가지 않는다 — PuDocRead.readTextWithPrompt 가 한 번 더 지운다(마지막 문지기).
   제목·회사·금액은 모두 지어낸 것이다(실제 고객사 이름을 쓰지 않는다). */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const { test } = require('node:test');

const R = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(R, f), 'utf8').replace(/\r\n/g, '\n');
const out = (v) => JSON.parse(JSON.stringify(v));

function load() {
  const box = { console, Date, Math, JSON, Promise, Object, Array, String, Number, Error, RegExp, isFinite };
  box.window = box;
  vm.createContext(box);
  ['js/pu-quotes.js', 'js/pu-quote-detect.js', 'js/pu-quote-import.js'].forEach((f) => vm.runInContext(read(f), box));
  return box;
}
const I = load().PuQuoteImport;

/* ── 고르기 ── */
test('우리 견적만', () => {
  const f = I.isOurQuote;
  assert.ok(f('[푸른노무법인] 직무분석 컨설팅 견적서 송부의 건', ['견적서_인사노무컨설팅_충남어린이인성학습원_261106.pdf']));
  assert.ok(f('[푸른노무법인] 산업안전 컨설팅 견적서 송부의 건 (비교견적서 2부 추가)', []));
  assert.ok(!f('[푸른노무법인] 비교견적서 요청의 건', []));
  assert.ok(!f('RE: 비교견적서 작성 요청', ['견적서_직장 내 괴롭힘 조사 용역_푸른노무법인_261002.pdf']));
  assert.ok(!f('RE: RE: 견적의뢰를 요청합니다. (제이더블유인테크)', []));
  assert.ok(!f('RE: RE: RE: [푸른노무법인] 루나랩 모션 데스크 상품 견적 요청드립니다.', []));
  assert.ok(!f('안녕하세요 자료 보냅니다', ['소개서.pdf']));
});
test('우리 계약서만 — 근로계약서는 아니다', () => {
  assert.ok(I.isOurContract('[푸른노무법인] 2026년 자문계약서 송부의 건', []));
  assert.ok(I.isOurContract('계약 송부', ['위임 계약서_가나상사.hwpx']));
  assert.ok(!I.isOurContract('[푸른노무법인] 메디움천안요양병원 근로계약서 송부드립니다.', []));
  assert.ok(!I.isOurContract('점심 약속', []));
});
test('docOf — 견적과 계약서를 함께 말하면 계약서', () => {
  assert.strictEqual(I.docOf('견적서 및 자문계약서 송부', []), 'contract');
  assert.strictEqual(I.docOf('견적서 송부', []), 'quote');
  assert.strictEqual(I.docOf('근로계약서 송부', []), '');
});
test('pickAtt — 푸른 것 먼저', () => {
  assert.strictEqual(I.pickAtt(['열린노무법인_비교견적서.pdf', '푸른노무법인_견적서_산업안전.pdf'], 'quote'), 1);
});
test('pickAtt — 문서 종류에 맞는 이름 먼저, 이름이 안 맞아도 pdf·hwp·hwpx 가 있으면 그 첫 번째, 없으면 -1', () => {
  assert.strictEqual(I.pickAtt(['안내.pdf', '견적서.pdf'], 'quote'), 1);
  assert.strictEqual(I.pickAtt(['안내.pdf', '견적서.pdf'], 'contract'), 0, '계약서 이름이 없으면 첫 문서');
  assert.strictEqual(I.pickAtt(['표지.jpg', '계약서_가.hwp', '견적서.pdf'], 'contract'), 1);
  assert.strictEqual(I.pickAtt(['사진.jpg', '표.xlsx'], 'quote'), -1);
  assert.strictEqual(I.pickAtt([], 'quote'), -1);
});
test('pickAtt — 이름이 60자에서 잘려 확장자를 알 수 없는 첨부도 후보다(받아 보고 정한다)', () => {
  const long = '견적서_' + 'ㄱ'.repeat(60 - 4);        /* 60자 — 뒤가 잘려 .pdf 가 없다 */
  assert.strictEqual(long.length, 60);
  assert.strictEqual(I.pickAtt([long], 'quote'), 0);
  assert.strictEqual(I.pickAtt(['짧은이름.jpg'], 'quote'), -1);
});
test('namesOf — 배열 · «0,1,2» 열쇠 지도 · JSON 글자 · 엉뚱한 값', () => {
  assert.deepStrictEqual(out(I.namesOf(['a.pdf', 'b.hwp'])), ['a.pdf', 'b.hwp']);
  assert.deepStrictEqual(out(I.namesOf({ 0: 'a.pdf', 1: 'b.hwp' })), ['a.pdf', 'b.hwp']);
  assert.deepStrictEqual(out(I.namesOf('["a.pdf","b.hwp"]')), ['a.pdf', 'b.hwp']);
  assert.deepStrictEqual(out(I.namesOf('깨진{')), []);
  assert.deepStrictEqual(out(I.namesOf(undefined)), []);
});

const SLUG = 'Sent Messages-abc12345';
const MSGS = {
  k1: { s: '[푸른노무법인] 직무분석 컨설팅 견적서 송부의 건', d: 1000, t: 'hr@gana.example,x@y.example', tn: '가나상사 담당', an: ['견적서_직무분석.pdf'], a: 1, u: 11 },
  k2: { s: '[푸른노무법인] 2026년 자문계약서 송부의 건', d: 3000, t: 'a@nada.example', tn: '', an: { 0: '자문계약서.hwpx' }, a: 1, u: 22 },
  k3: { s: '비교견적서 요청의 건', d: 2000, t: 'z@z.example', an: ['견적서.pdf'], a: 1, u: 33 },
  k4: { s: '근로계약서 송부', d: 4000, t: 'q@q.example', an: ['근로계약서.pdf'], a: 1, u: 44 },
  k5: { s: '성희롱예방교육 견적서', d: 5000, t: 'e@edu.example', a: 0, u: 55 },
  k6: { s: '견적서 보냅니다', d: 500, t: 'n@n.example', an: ['견적서.pdf'], a: 1 }
};
test('candidates — 우리 견적·계약만, 최근 것이 먼저, srcKey = 폴더|열쇠', () => {
  const c = out(I.candidates(MSGS, SLUG));
  assert.deepStrictEqual(c.map((x) => x.key), ['k5', 'k2', 'k1', 'k6']);
  assert.strictEqual(c[1].srcKey, SLUG + '|k2');
  assert.strictEqual(c[1].doc, 'contract');
  assert.strictEqual(c[2].to, 'hr@gana.example', '받는 주소는 첫 사람만');
  assert.strictEqual(c[2].toName, '가나상사 담당');
  assert.strictEqual(c[2].attIndex, 0); assert.strictEqual(c[2].attName, '견적서_직무분석.pdf');
});
test('candidates — 첨부가 없거나 메일 번호(u)를 모르면 첨부 없이 기록만(attIndex -1)', () => {
  const c = out(I.candidates(MSGS, SLUG));
  assert.strictEqual(c.find((x) => x.key === 'k5').attIndex, -1, '첨부가 없다');
  assert.strictEqual(c.find((x) => x.key === 'k6').attIndex, -1, '번호가 없어 받을 수 없다');
});

/* ── 기록 만들기 ── */
const CAND = { slug: SLUG, key: 'k1', uid: '11', subject: '[푸른노무법인] 직무분석 컨설팅 견적서 송부의 건', date: Date.UTC(2026, 9, 31, 16, 0),
  to: 'hr@gana.example', toName: '가나상사 담당', doc: 'quote', attIndex: 0, attName: '견적서_직무분석.pdf', attCount: 1, srcKey: SLUG + '|k1' };
test('toRecord — 금액 못 읽으면 확인 필요(금액 칸 없음)', () => {
  const r = I.toRecord(CAND, { 금액: '' }, 'f1', 1);
  assert.strictEqual(r.amt, null); assert.strictEqual(r.rec.review, 'check');
});
test('toRecord — 4,000,000 · 별도 · 직원수 30', () => {
  const r = I.toRecord(CAND, { 금액: '4000000', 부가세: '별도', 직원수: '30', 의뢰처: '(주)가나상사', 업무종류: '직무분석', 기간: '3개월', 과업내용: ' 직무분석 및  보고서 ' }, 'f1', 1);
  assert.strictEqual(r.amt.amount, 4000000); assert.strictEqual(r.amt.vat, 'excl'); assert.strictEqual(r.amt.owner, '');
  assert.strictEqual(r.rec.staff, 30); assert.strictEqual(r.rec.review, 'ok');
  assert.strictEqual(r.rec.co, '(주)가나상사'); assert.strictEqual(r.rec.type, 'hr_consult');
  assert.strictEqual(r.rec.period, '3개월'); assert.strictEqual(r.rec.scope, '직무분석 및 보고서', '공백을 줄인다');
  assert.strictEqual(r.rec.fileId, 'f1'); assert.strictEqual(r.rec.srcKey, CAND.srcKey);
  assert.deepStrictEqual(out(r.rec.src), { how: 'mail', slug: SLUG, key: 'k1' });
  assert.strictEqual(r.rec.doc, 'quote');
});
test('toRecord — 날짜는 «메일 시각»을 한국 시간으로(UTC 10-31 16:00 = 11-01 01:00)', () => {
  assert.strictEqual(I.toRecord(CAND, {}, '', 1).rec.date, '2026-11-01');
});
test('toRecord — 금액은 «숫자»일 때만. 쉼표·원은 걷고, 「400만원」·0·글자는 못 읽은 것(추측하지 않는다)', () => {
  const amt = (v) => I.toRecord(CAND, { 금액: v }, '', 1).amt;
  assert.strictEqual(amt('4,000,000원').amount, 4000000);
  assert.strictEqual(amt(1200000).amount, 1200000);
  assert.strictEqual(amt('400만원'), null);
  assert.strictEqual(amt('0'), null);
  assert.strictEqual(amt('-5'), null);
  assert.strictEqual(amt('협의'), null);
  assert.strictEqual(amt('99999999999999'), null, '말이 안 되게 큰 값');
});
test('toRecord — 부가세 · 직원수 모양', () => {
  const v = (f) => I.toRecord(CAND, Object.assign({ 금액: '1000' }, f), '', 1);
  assert.strictEqual(v({ 부가세: '포함' }).amt.vat, 'incl');
  assert.strictEqual(v({ 부가세: '' }).amt.vat, '');
  assert.strictEqual(v({ 직원수: '1,200명' }).rec.staff, 1200);
  assert.ok(!('staff' in v({ 직원수: '많음' }).rec), '모르는 인원을 0 으로 채우지 않는다');
});
test('toRecord — 의뢰처는 AI → 받는 이름 → 받는 주소의 도메인 순', () => {
  assert.strictEqual(I.toRecord(CAND, { 의뢰처: '다라전자' }, '', 1).rec.co, '다라전자');
  assert.strictEqual(I.toRecord(CAND, {}, '', 1).rec.co, '가나상사 담당');
  assert.strictEqual(I.toRecord(Object.assign({}, CAND, { toName: '' }), {}, '', 1).rec.co, 'gana.example');
});
test('toRecord — 업무 종류: AI 가 안 맞으면 «제목 + 첨부 이름»으로', () => {
  assert.strictEqual(I.toRecord(Object.assign({}, CAND, { subject: '성희롱예방교육 견적서', attName: '' }), { 업무종류: '기타' }, '', 1).rec.type, 'education');
  assert.strictEqual(I.toRecord(Object.assign({}, CAND, { subject: '자문 견적서', attName: '' }), {}, '', 1).rec.type, 'advice');
});
test('★ toRecord 의 결과를 저장 층이 그대로 받는다(날짜·종류·칸 길이 — 규칙이 거절할 모양이 아니다)', async () => {
  const box = load(); const saved = [];
  const store = {};
  const db = { ref(p) { return { key: 'qq' + saved.length, push() { return db.ref(p + '/qq'); },
    set(v) { store[p] = v; return Promise.resolve(); } }; } };
  box.PuQuotes.init({ db, uid: 'u1' });
  const out1 = box.PuQuoteImport.toRecord(CAND, { 금액: '4000000', 부가세: '별도', 과업내용: 'x'.repeat(400) }, 'f1', 1);
  await box.PuQuotes.save(out1.rec, out1.amt);
  const rec = Object.keys(store).map((k) => store[k]).find((v) => v && v.doc);
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(rec.date));
  assert.ok(rec.scope.length <= 300, '규칙의 칸 길이(300)로 잘린다');
});

/* ── 하나씩 가져오기 ── */
function host(over) {
  const calls = { have: [], fetch: [], store: [], text: [], read: [], save: [], log: [], steps: [] };
  const h = Object.assign({
    have: (k) => { calls.have.push(k); return Promise.resolve(false); },
    fetchAtt: (c) => { calls.fetch.push(c.key); return Promise.resolve({ name: c.attName, type: 'application/pdf', bytes: new Uint8Array([1, 2, 3]) }); },
    store: (f, c) => { calls.store.push({ name: f.name, key: c.key, size: f.size }); return Promise.resolve('file-' + c.key); },
    extractText: (bytes, name) => { calls.text.push(name); return Promise.resolve('견적서 본문 합계 4,000,000원'); },
    readText: (prompt, text) => { calls.read.push({ prompt, text }); return Promise.resolve({ ok: true, data: { 금액: '4000000', 부가세: '별도' } }); },
    save: (rec, amt) => { calls.save.push({ rec, amt }); return Promise.resolve('q' + calls.save.length); },
    log: (k, o) => calls.log.push({ k, o }),
    now: () => Date.UTC(2026, 10, 8)
  }, over || {});
  h.calls = calls;
  return h;
}
const C = (key, over) => Object.assign({}, CAND, { key, srcKey: SLUG + '|' + key, attName: key + '.pdf', subject: '견적서 ' + key }, over || {});

test('runImport — 정상: 받기 → 🔒 저장 → 글자 → AI → 기록 → 작업 기록(자동)', async () => {
  const h = host();
  const r = await I.runImport([C('a'), C('b')], h, (s) => h.calls.steps.push(s));
  assert.deepStrictEqual(out(r), { done: 2, skipped: 0, failed: 0, left: 0, check: 0 });
  assert.deepStrictEqual(h.calls.fetch, ['a', 'b']);
  assert.strictEqual(h.calls.save[0].rec.fileId, 'file-a');
  assert.strictEqual(h.calls.save[0].amt.amount, 4000000);
  assert.strictEqual(h.calls.log.length, 2);
  assert.strictEqual(h.calls.log[0].k, 'auto_detect');
  assert.strictEqual(h.calls.log[0].o.auto, '보낸메일 가져오기');
  assert.strictEqual(h.calls.log[0].o.target, 'q1');
  assert.match(h.calls.steps[0], /^1\/2 · 견적서 a/);
});
test('★ runImport — 이미 가져온 메일(같은 srcKey)은 건너뛴다: 받기·AI·저장을 안 한다', async () => {
  const h = host({ have: (k) => Promise.resolve(k === SLUG + '|a') });
  const r = await I.runImport([C('a'), C('b')], h);
  assert.strictEqual(r.skipped, 1); assert.strictEqual(r.done, 1);
  assert.deepStrictEqual(h.calls.fetch, ['b']);
  assert.strictEqual(h.calls.read.length, 1);
  const again = await I.runImport([C('a')], host({ have: () => Promise.resolve(true) }));
  assert.deepStrictEqual(out(again), { done: 0, skipped: 1, failed: 0, left: 0, check: 0 });
});
test('★ runImport — AI 하루 한도면 그 자리에서 멈춘다: 이미 넣은 건 그대로, 남은 건수와 까닭', async () => {
  let n = 0;
  const h = host({ readText: () => (++n === 2 ? Promise.resolve({ ok: false, why: 'AI 하루 한도를 다 썼습니다' }) : Promise.resolve({ ok: true, data: { 금액: '1000' } })) });
  const r = await I.runImport([C('a'), C('b'), C('c'), C('d')], h);
  assert.strictEqual(r.done, 1);
  assert.strictEqual(r.left, 3, '한도에 걸린 b 부터 d 까지');
  assert.match(r.stopped, /한도/);
  assert.strictEqual(h.calls.save.length, 1, '걸린 건은 저장하지 않는다(다음에 다시)');
  assert.deepStrictEqual(h.calls.fetch, ['a', 'b'], '그 뒤 메일은 받지도 않는다');
});
test('runImport — AI 가 한도 오류를 «던져도» 멈춘다', async () => {
  const h = host({ readText: () => Promise.reject(new Error('429 Too Many Requests')) });
  const r = await I.runImport([C('a'), C('b')], h);
  assert.strictEqual(r.done, 0); assert.strictEqual(r.left, 2); assert.match(r.stopped, /429/);
});
test('★ runImport — 금액을 못 읽은 견적은 기록을 남기되 «확인 필요»', async () => {
  const h = host({ readText: () => Promise.resolve({ ok: true, data: { 금액: '', 과업내용: '직무분석' } }) });
  const r = await I.runImport([C('a')], h);
  assert.strictEqual(r.done, 1); assert.strictEqual(r.check, 1);
  assert.strictEqual(h.calls.save[0].rec.review, 'check');
  assert.strictEqual(h.calls.save[0].amt, null, '모르는 금액 칸을 만들지 않는다');
  assert.strictEqual(h.calls.save[0].rec.scope, '직무분석');
});
test('runImport — AI 가 한도 말고 다른 이유로 못 읽어도 기록은 남기고 확인 필요', async () => {
  const h = host({ readText: () => Promise.resolve({ ok: false, why: 'AI 가 표 모양(JSON)으로 답하지 않았습니다' }) });
  const r = await I.runImport([C('a'), C('b')], h);
  assert.strictEqual(r.done, 2); assert.strictEqual(r.check, 2); assert.ok(!r.stopped);
});
test('★ runImport — 글자를 못 뽑은 파일(스캔본·암호)은 AI 를 부르지 않는다(원본 파일도 안 보낸다)', async () => {
  const h = host({ extractText: () => Promise.resolve('   ') });
  const r = await I.runImport([C('a')], h);
  assert.strictEqual(h.calls.read.length, 0);
  assert.strictEqual(r.done, 1); assert.strictEqual(r.check, 1);
  assert.strictEqual(h.calls.save[0].rec.fileId, 'file-a', '파일은 🔒 에 보관한다');
  const h2 = host({ extractText: () => Promise.reject(new Error('암호 파일')) });
  const r2 = await I.runImport([C('a')], h2);
  assert.strictEqual(h2.calls.read.length, 0); assert.strictEqual(r2.check, 1);
});
test('runImport — 첨부가 없는 메일은 받기·저장·AI 없이 기록만(확인 필요)', async () => {
  const h = host();
  const r = await I.runImport([C('a', { attIndex: -1, attName: '' })], h);
  assert.strictEqual(h.calls.fetch.length, 0); assert.strictEqual(h.calls.store.length, 0); assert.strictEqual(h.calls.read.length, 0);
  assert.strictEqual(r.done, 1); assert.strictEqual(r.check, 1);
  assert.ok(!('fileId' in h.calls.save[0].rec));
});
test('runImport — 첨부를 못 받으면 «가져오지 못함»: 저장하지 않고 다음 메일로(다시 누르면 다시 시도)', async () => {
  const h = host({ fetchAtt: (c) => (c.key === 'a' ? Promise.reject(new Error('너무 큽니다')) : Promise.resolve({ name: 'b.pdf', type: '', bytes: new Uint8Array([1]) })) });
  const r = await I.runImport([C('a'), C('b')], h);
  assert.strictEqual(r.failed, 1); assert.strictEqual(r.done, 1);
  assert.strictEqual(h.calls.save.length, 1);
  assert.strictEqual(h.calls.save[0].rec.srcKey, SLUG + '|b');
});
test('★ runImport — 저장 권한이 없으면(규칙 게시 전) 그 자리에서 멈춘다: AI 요금을 헛되이 쓰지 않는다', async () => {
  const h = host({ save: () => Promise.reject(new Error('PERMISSION_DENIED: Permission denied')) });
  const r = await I.runImport([C('a'), C('b'), C('c')], h);
  assert.strictEqual(r.done, 0); assert.strictEqual(r.left, 3);
  assert.match(r.stopped, /저장 권한이 없습니다/);
  assert.strictEqual(h.calls.read.length, 1, '첫 건에서 멈추므로 AI 는 한 번만 불렀다');
});
test('runImport — 그 밖의 저장 실패는 «가져오지 못함» 으로 세고 이어 간다', async () => {
  let n = 0;
  const h = host({ save: (rec) => (++n === 1 ? Promise.reject(new Error('network')) : Promise.resolve('q')) });
  const r = await I.runImport([C('a'), C('b')], h);
  assert.strictEqual(r.failed, 1); assert.strictEqual(r.done, 1); assert.ok(!r.stopped);
});
test('★ runImport — AI 로 보내는 글자는 상한(TEXT_MAX)까지만, 사전(prompt)과 글자가 따로', async () => {
  const h = host({ extractText: () => Promise.resolve('가'.repeat(I.TEXT_MAX + 5000)) });
  await I.runImport([C('a')], h);
  assert.strictEqual(h.calls.read[0].text.length, I.TEXT_MAX);
  assert.strictEqual(h.calls.read[0].prompt, I.QUOTE_PROMPT);
});
test('QUOTE_PROMPT — 칸 일곱 개와 지킬 말', () => {
  ['의뢰처', '업무종류', '금액', '부가세', '기간', '과업내용', '직원수'].forEach((k) => assert.ok(I.QUOTE_PROMPT.includes('"' + k + '"'), k));
  assert.match(I.QUOTE_PROMPT, /숫자만/); assert.match(I.QUOTE_PROMPT, /150자/);
});
test('runImport — 빈 목록', async () => {
  assert.deepStrictEqual(out(await I.runImport([], host())), { done: 0, skipped: 0, failed: 0, left: 0, check: 0 });
});

/* ── ★ 주민번호는 AI 로 나가지 않는다 — PuDocRead.readTextWithPrompt (마지막 문지기) ── */
const server = require(path.join(R, 'functions', 'doc-read.js'));
function readerWithSpy(withMask) {
  const sent = [];
  const ctx = { console, Promise, Object, Array, JSON, String, Number, Math, Date, RegExp, Error, isFinite, parseInt, parseFloat, setTimeout, clearTimeout,
    fetch(url, init) {
      sent.push(JSON.parse(init.body));
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ ok: true, reply: { candidates: [{ content: { parts: [{ text: '{"금액":"4000000"}' }] } }] } }) });
    } };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  if (withMask) vm.runInContext(read('js/pu-rrn-mask.js'), ctx);
  vm.runInContext(read('js/pu-doc-read.js'), ctx);
  ctx.PuDocRead.init({ fetch: ctx.fetch, getToken: () => Promise.resolve('tok'), readDocUrl: 'https://example/readDoc' });
  return { D: ctx.PuDocRead, sent };
}
test('★ readTextWithPrompt — 글자만 보내고, 서버가 받는 모양이고, 답을 표로 돌려준다', async () => {
  const r = readerWithSpy(true);
  const res = await r.D.readTextWithPrompt('사전', '견적서 합계 4,000,000원');
  assert.strictEqual(res.ok, true); assert.strictEqual(res.data.금액, '4000000');
  assert.strictEqual(r.sent.length, 1);
  assert.ok(!r.sent[0].parts.some((p) => p.inline_data), '그림이 실리면 안 된다');
  assert.strictEqual(server.validate(r.sent[0]).ok, true, '서버가 돌려보내면 가져오기가 통째로 안 된다');
  assert.strictEqual(r.sent[0].parts[0].text, '사전');
});
test('★★ readTextWithPrompt — 주민번호는 AI 로 나가는 글자에서 지워진다', async () => {
  const r = readerWithSpy(true);
  await r.D.readTextWithPrompt('사전', '위임인 홍길동 (주민등록번호 900101-1234567) 보수 3,000,000원');
  const body = JSON.stringify(r.sent[0]);
  assert.ok(!/900101-?1234567/.test(body), '주민번호가 AI 요청에 그대로 실렸다');
  assert.ok(!/1234567/.test(body));
  assert.ok(body.includes('3,000,000원'), '금액은 남는다');
});
test('★ readTextWithPrompt — 지우개가 화면에 없으면 멈춘다(그대로 보내지 않는다)', async () => {
  const r = readerWithSpy(false);
  const res = await r.D.readTextWithPrompt('사전', '주민번호 900101-1234567');
  assert.strictEqual(res.ok, false); assert.match(res.why, /주민번호 지우개/);
  assert.strictEqual(r.sent.length, 0, 'AI 를 부르면 안 된다');
});
test('readTextWithPrompt — 빈 글자·빈 사전은 AI 를 부르지 않는다(부르는 만큼이 요금)', async () => {
  const r = readerWithSpy(true);
  assert.strictEqual((await r.D.readTextWithPrompt('사전', '   ')).ok, false);
  assert.strictEqual((await r.D.readTextWithPrompt('  ', '글')).ok, false);
  assert.strictEqual(r.sent.length, 0);
});

/* ── 검토 2026-11-09 (Codex) — 지난 견적·계약 «기록»은 직원 모두가 읽는다: AI 가 쓴 글의 금액을 공개 칸에 쓰기 전에 가린다 ── */
test('★ 공개 칸(의뢰처·기간·과업내용)에는 금액 글자가 가려져 저장된다 — 금액은 잠긴 칸(amt)에만', () => {
  const r = I.toRecord(CAND, { 금액: '4000000', 부가세: '별도', 의뢰처: '(주)가나상사', 업무종류: '직무분석',
    기간: '3개월 (월 130만원씩)', 과업내용: '직무분석 컨설팅 총액 400만원, 선금 ₩2000000, 잔금 사백만원' }, 'f1', 1);
  const j = JSON.stringify(out(r.rec));
  assert.ok(!/400만|130만|2000000|사백만|4,000,000|4000000/.test(j), '공개 기록에 금액이 들어갔다: ' + j);
  assert.match(r.rec.scope, /○○/); assert.match(r.rec.period, /○○/);
  assert.strictEqual(out(r.amt).amount, 4000000, '금액은 잠긴 칸에 그대로');
});
test('공개 칸 가리기는 금액이 아닌 글을 건드리지 않는다 · 의뢰처가 비면 받는 이름·주소 도메인으로 채운다', () => {
  const r = I.toRecord(CAND, { 금액: '', 의뢰처: '', 기간: '2026-11-01 ~ 2026-12-31', 과업내용: '신입 사원 직무분석 30인 대상 3개월' }, 'f1', 1);
  assert.strictEqual(r.rec.period, '2026-11-01 ~ 2026-12-31'); assert.strictEqual(r.rec.scope, '신입 사원 직무분석 30인 대상 3개월');
  assert.ok(r.rec.co);
});
test('QUOTE_PROMPT — 과업내용에는 금액을 쓰지 말라고 한다', () => {
  assert.match(I.QUOTE_PROMPT, /금액·보수·비용 이야기는 쓰지 마세요/);
});
