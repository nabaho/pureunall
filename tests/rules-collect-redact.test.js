/* 서버가 첨부 하나를 가린다 — 지키는 선(설계 §4-2):
   ① 원래 번호가 돌려주는 것(글·파일·셈) 어디에도 없다 ② 남거나 못 읽으면 담지 않는다
   ③ 한글만 파일째, 워드는 글만 ④ PDF 는 글만 가려 담는다(설계 §11) */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const H = require('../hwpx_gen.js');
const X = require('../functions/rules-collect-redact.js');
const { makePdf } = require('./pdf-gen.js');
const HAS_PDFJS = (() => {
  try { require.resolve('pdfjs-dist/package.json', { paths: [path.join(__dirname, '../functions')] }); return true; }
  catch (_) { return false; }
})();

const RRN = '900101-1234567', PHONE = '010-9876-5432';
const hwpx = (s) => H.build(H.para('제1조(목적) 이 규칙은 가나상사 사원의 근로조건을 정한다.') + H.para(s));
const has = (u8, s) => !!u8 && Buffer.from(u8).includes(Buffer.from(s));

test('한글 — 파일째 가리고 원래 번호가 어디에도 없다', async () => {
  const r = await X.redactOne(hwpx('담당 홍길동 ' + PHONE + ' 주민 ' + RRN), 'hwpx');
  assert.equal(r.ok, true);
  assert.ok(r.total >= 2);
  assert.ok(r.data && r.data.length > 0);
  [RRN, PHONE].forEach((s) => {
    assert.ok(!r.text.includes(s), '★ 가린 글에 남았다');
    assert.ok(!has(r.data, s), '★ 가린 파일 바이트에 남았다');
    assert.ok(!JSON.stringify(r.count).includes(s));
  });
});

test('찾은 것이 없으면 원본 그대로(가린 것과 같다)', async () => {
  const src = hwpx('개인정보 없음');
  const r = await X.redactOne(src, 'hwpx');
  assert.equal(r.ok, true);
  assert.equal(r.total, 0);
  assert.ok(Buffer.from(r.data).equals(Buffer.from(src)));
});

test('PDF — 글을 뽑아 가린 글만, 파일은 안 담는다', { skip: !HAS_PDFJS && 'pdfjs-dist 없음' }, async () => {
  const buf = makePdf([[{ x: 40, y: 800, s: 'Article 1 (Purpose) of the work rules for all employees' },
    { x: 40, y: 780, s: 'RRN ' + RRN + ' phone 010-9876-5432' }]]);
  const r = await X.redactOne(buf, 'pdf');
  assert.equal(r.ok, true);
  assert.equal(r.format, 'pdf');
  assert.equal(r.data, null, '★ PDF 파일을 내보냈다');
  assert.ok(!r.text.includes(RRN), '★ 주민번호가 남았다');
  assert.ok(r.total >= 1);
  assert.match(r.text, /Article 1 \(Purpose\)/);
});

/* ★ 글자 사이가 벌어진 PDF — pdf.js 가 「9 0 0 1 0 1 - 1 2 3 …」 으로 뽑아 번호 규칙·RAW_RE 가 못 잡는다(최종 검토 실측) */
const SPACED = RRN.split('').join(' ');
const SPACED_NET = /주민번호 꼴/;
for (const [label, spec] of [['글자 간격(Tc)', { tc: 8 }], ['글자마다 따로(Td/Tj)', { glyphs: true }]]) {
  test('PDF — 벌어진 주민번호는 보류 (' + label + ')', { skip: !HAS_PDFJS && 'pdfjs-dist 없음' }, async () => {
    /* 벌어진 줄은 짧게(쪽 밖으로 나가면 잘린다) — 스캔 한도(30자)는 평범한 둘째 줄이 채운다 */
    const buf = makePdf([[{ x: 40, y: 800, s: 'Article 1 (Purpose) of the work rules for all employees' },
      Object.assign({ x: 40, y: 780, s: 'RRN ' + RRN }, spec)]]);
    const r = await X.redactOne(buf, 'pdf');
    assert.equal(r.ok, false, '★ 벌어진 주민번호가 담기게 됐다');
    assert.match(r.holdWhy, SPACED_NET);
    assert.equal(r.text, undefined, '★ 보류인데 글을 돌려준다');
  });
}

test('PDF — 벌어진 주민번호 꼴이 가린 글에 남으면 보류(가짜 글)', async () => {
  const spaced = { pdfText: async () => ({ text: 'x'.repeat(40) + ' ' + SPACED, chars: 60, pages: 1 }),
    redactFile: async (b, t) => ({ text: t, count: {}, total: 0, residual: 0, unscanned: 0, data: null }) };
  const r = await X.redactOne(Buffer.from('x'), 'pdf', spaced);
  assert.equal(r.ok, false);
  assert.match(r.holdWhy, SPACED_NET);
  /* 숫자에 붙은 더 긴 수·번호 꼴이 아닌 숫자 열은 걸리지 않는다 */
  const fine = { pdfText: async () => ({ text: 'Article ' + 'x'.repeat(40) + ' 1 2 3 4 5 6 7 8 9 0 and page 1 - 2', chars: 60, pages: 1 }),
    redactFile: async (b, t) => ({ text: t, count: {}, total: 0, residual: 0, unscanned: 0, data: null }) };
  assert.equal((await X.redactOne(Buffer.from('x'), 'pdf', fine)).ok, true);
});

test('PDF — 글 없으면 스캔 보류, 못 열면 열지 못함 보류', async () => {
  const scan = await X.redactOne(Buffer.from('x'), 'pdf', { pdfText: async () => ({ text: ' ', chars: 0, pages: 1 }) });
  assert.deepEqual([scan.ok, scan.holdWhy], [false, '스캔 PDF — 글 없음']);
  /* pdf.js 가 «문서가 나쁨» 으로 던지는 이름만 열지 못함 */
  for (const name of ['InvalidPDFException', 'PasswordException', 'FormatError', 'MissingPDFException', 'UnexpectedResponseException']) {
    const bad = await X.redactOne(Buffer.from('x'), 'pdf', { pdfText: async () => { throw Object.assign(new Error('깨짐'), { name }); } });
    assert.deepEqual([bad.ok, bad.holdWhy], [false, 'PDF 를 열지 못함'], name);
  }
});

test('PDF — 문서 탓이 아닌 오류(싣기·메모리·모르는 실패)는 옛 까닭으로 남겨 다시 본다', async () => {
  for (const e of [new Error('메모리'), Object.assign(new TypeError('x is not a function'), {}), Object.assign(new Error('없음'), { name: 'InvalidPDFException', code: 'PDFJS_MISSING' })]) {
    const r = await X.redactOne(Buffer.from('x'), 'pdf', { pdfText: async () => { throw e; } });
    assert.deepEqual([r.ok, r.holdWhy], [false, 'PDF — 아직 못 읽음'], '★ 환경 탓인데 영영 닫았다: ' + e.name);
  }
});

test('PDF — 깨진 실제 파일은 열지 못함으로 닫는다', { skip: !HAS_PDFJS && 'pdfjs-dist 없음' }, async () => {
  for (const junk of ['%PDF-1.7 not really', 'garbage', '']) {
    const r = await X.redactOne(Buffer.from(junk), 'pdf');
    assert.deepEqual([r.ok, r.holdWhy], [false, 'PDF 를 열지 못함'], JSON.stringify(junk));
  }
});

test('PDF — 쪽 한도에 잘렸는지(truncated·pages)를 돌려준다', async () => {
  const mk = (extra) => ({ pdfText: async () => Object.assign({ text: '제1조 ' + 'x'.repeat(40), chars: 60, pages: 301 }, extra),
    redactFile: async (b, t) => ({ text: t, count: {}, total: 0, residual: 0, unscanned: 0, data: null }) });
  const cut = await X.redactOne(Buffer.from('x'), 'pdf', mk({ truncated: true }));
  assert.deepEqual([cut.ok, cut.truncated, cut.pages], [true, true, 301]);
  const whole = await X.redactOne(Buffer.from('x'), 'pdf', mk({ pages: 3 }));
  assert.deepEqual([whole.ok, whole.truncated, whole.pages], [true, false, 3]);
});

test('PDF — pdf.js 를 못 실으면 옛 까닭으로 남긴다(다음에 다시 본다)', async () => {
  const r = await X.redactOne(Buffer.from('x'), 'pdf', { pdfText: async () => { throw Object.assign(new Error('없음'), { code: 'PDFJS_MISSING' }); } });
  assert.deepEqual([r.ok, r.holdWhy], [false, 'PDF — 아직 못 읽음']);
});

test('PDF — 가린 글에 주민번호 꼴이 남으면 보류(마지막 그물)', async () => {
  const leaky = { pdfText: async () => ({ text: 'x'.repeat(40) + ' ' + RRN, chars: 60, pages: 1 }),
    redactFile: async (b, t) => ({ text: t, count: {}, total: 0, residual: 0, unscanned: 0, data: null }) };
  const r = await X.redactOne(Buffer.from('x'), 'pdf', leaky);
  assert.equal(r.ok, false);
  assert.match(r.holdWhy, /주민번호/);
});

test('못 읽는 한글 — 글을 못 읽으면 보류', async () => {
  const junk = await X.redactOne(Buffer.from('PK\u0003\u0004 not a real zip'), 'hwpx');
  assert.equal(junk.ok, false);
  assert.match(junk.holdWhy, /읽지 못/);
});

test('마지막 그물 — 가린 글에 주민번호 꼴이 남으면 보류', async () => {
  assert.ok(X.RAW_RE.test('주민 ' + RRN));
  assert.ok(!X.RAW_RE.test('주민 900101-●●●●●●●'));
  assert.ok(X.RAW_RE.test('A900101-1234567'), '★ 글자에 붙은 번호도 잡아야');
  assert.ok(X.RAW_RE.test('번호900101-1234567입니다'));
  assert.ok(!X.RAW_RE.test('1900101-12345678'), '숫자에 붙은 더 긴 수는 번호가 아니다');
});

/* 닫는 쪽 가지 — 가림 엔진을 가짜로 바꿔 결정적으로 본다. 어느 가지든 ok:false, 담을 글·파일을 돌려주지 않는다 */
const fake = (red, text) => ({
  read: async () => ({ text: text || '제1조 가나상사 규칙 본문 길이를 충분히 채운 글' }),
  redactFile: async () => Object.assign({ fileOk: true, total: 0, count: {}, residual: 0, unscanned: 0, data: null, text: '깨끗한 글' }, red),
});
const held = (r, re) => {
  assert.equal(r.ok, false);
  assert.match(r.holdWhy, re);
  assert.equal(r.text, undefined, '★ 보류인데 글을 돌려준다');
  assert.equal(r.data, undefined, '★ 보류인데 파일을 돌려준다');
};
const SRC = Buffer.from('원본');

test('닫는 쪽 — 가린 뒤에도 남으면 보류', async () => {
  held(await X.redactOne(SRC, 'hwpx', fake({ total: 1, count: { rrn: 1 }, residual: 2, data: new Uint8Array(3) })), /남음/);
});
test('닫는 쪽 — 검사 못 한 부분이 있으면 보류(찾은 것이 0이어도)', async () => {
  held(await X.redactOne(SRC, 'hwpx', fake({ total: 0, unscanned: 1 })), /검사 못 한/);
  held(await X.redactOne(SRC, 'docx', fake({ fileOk: false, total: 0, unscanned: 3 })), /검사 못 한/);
});
test('닫는 쪽 — 가린 글에 주민번호 꼴이 남으면 보류', async () => {
  held(await X.redactOne(SRC, 'hwpx', fake({ total: 1, count: { rrn: 1 }, data: new Uint8Array(3), text: '주민 ' + RRN })), /주민번호 꼴/);
});
test('닫는 쪽 — 찾았는데 가린 파일이 없으면 보류(원본을 내보내지 않는다)', async () => {
  held(await X.redactOne(SRC, 'hwpx', fake({ total: 2, count: { rrn: 2 }, data: null })), /가린 파일/);
});
test('닫는 쪽 — 가림 엔진이 던지거나 글을 못 읽어도 보류', async () => {
  const boom = { read: async () => ({ text: '충분히 긴 본문' }), redactFile: async () => { throw new Error('x'); } };
  held(await X.redactOne(SRC, 'hwpx', boom), /실패/);
  held(await X.redactOne(SRC, 'hwpx', { read: async () => null, redactFile: async () => ({}) }), /읽지 못/);
});
test('열린 쪽 — 모두 깨끗하면 담는다(가짜 엔진)', async () => {
  const r = await X.redactOne(SRC, 'docx', fake({ fileOk: false, total: 0 }));
  assert.equal(r.ok, true);
  assert.equal(r.data, null);
});
