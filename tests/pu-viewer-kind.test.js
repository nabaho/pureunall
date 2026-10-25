'use strict';
/* 문서뷰어 형식 가리기(js/pu-viewer-kind.js) — «규칙»을 못 박는다 (2026-10-25)
 *
 * ■ 지키는 것
 *   ① 형식은 «파일 서명»으로 가른다 — 확장자를 속인 파일도 진짜 형식으로 본다
 *   ② 진짜 파일(한글·PDF·엑셀)을 만들어 넣어 본다 — 손으로 흉내 낸 바이트만으로 초록이 되지 않게
 *   ③ 아직 못 그리는 형식(워드·파워포인트)은 «알아보되, 못 그린다고 말해 준다»
 *   ④ 크기 한도를 넘으면 열지 않는다(한도 값은 못 박지 않고 상수를 따라간다)
 *   ⑤ 알 수 없는 바이트·빈 파일·읽을 수 없는 입력은 이유를 말하고 거절한다
 * node --test tests/pu-viewer-kind.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { makePdf } = require('./pdf-gen.js');

const ROOT = path.join(__dirname, '..');
const K = require(path.join(ROOT, 'js', 'pu-viewer-kind.js'));
const JSZip = require(path.join(ROOT, 'vendor', 'jszip.min.js'));
const XLSX = require(path.join(ROOT, 'vendor', 'xlsx.full.min.js'));
const HWPX = require(path.join(ROOT, 'hwpx_gen.js'));

const u8 = (b) => new Uint8Array(b);
async function zipOf(names) {
  const z = new JSZip();
  names.forEach((n) => z.file(n, '<x/>'));
  return u8(await z.generateAsync({ type: 'uint8array' }));
}

test('진짜 PDF — 서명으로 알아본다(확장자가 달라도)', () => {
  const pdf = makePdf([[{ x: 72, y: 700, s: 'hello', size: 12 }]]);
  const b = typeof pdf === 'string' ? Buffer.from(pdf, 'latin1') : pdf;
  assert.equal(K.check(b, 'a.pdf').kind, 'pdf');
  assert.equal(K.check(b, '확장자없음').kind, 'pdf');
  assert.equal(K.check(b, 'a.hwp').kind, 'pdf');
});

test('진짜 한글(hwpx) — 확장자를 pdf 로 속여도 hwpx 로 본다', () => {
  const hw = u8(HWPX.build(HWPX.para('시험')));
  assert.equal(K.check(hw, 'a.hwpx').kind, 'hwpx');
  assert.equal(K.check(hw, 'a.pdf').kind, 'hwpx');
});

test('진짜 엑셀 — xlsx 와 옛 xls 를 가른다', () => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['가', '나'], [1, 2]]), 'S1');
  const xlsx = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const xls = XLSX.write(wb, { type: 'buffer', bookType: 'biff8' });
  assert.equal(K.check(xlsx, 'a.xlsx').kind, 'xlsx');
  assert.equal(K.check(xls, 'a.xls').kind, 'xls');
  assert.equal(K.check(xlsx, 'a.xls').kind, 'xlsx', '확장자보다 내용이 먼저다');
});

test('옛 한글(hwp, CFB)은 안의 FileHeader 이름으로 알아본다', () => {
  const b = new Uint8Array(4096);
  b.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1], 0);
  'FileHeader'.split('').forEach((c, i) => { b[1024 + i * 2] = c.charCodeAt(0); });
  assert.equal(K.check(b, 'a.hwp').kind, 'hwp');
  const o = new Uint8Array(4096); o.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1], 0);
  assert.equal(K.check(o, 'a.doc').ok, false, '글자 이름이 없는 옛 오피스 파일은 열지 않는다');
});

test('CSV — 확장자가 csv·tsv 이고 글자 파일일 때만', () => {
  const txt = u8(Buffer.from('a,b\n1,2\n'));
  assert.equal(K.check(txt, 'a.csv').kind, 'csv');
  assert.equal(K.check(txt, 'a.tsv').kind, 'csv');
  assert.equal(K.check(txt, 'a.txt').ok, false);
  assert.equal(K.check(u8([0, 1, 2, 3]), 'a.csv').ok, false, '글자 파일이 아니면 csv 로 안 본다');
});

test('워드·파워포인트는 알아보되 «못 그린다고» 말해 준다 (2판)', async () => {
  const docx = await zipOf(['[Content_Types].xml', 'word/document.xml']);
  const pptx = await zipOf(['[Content_Types].xml', 'ppt/presentation.xml']);
  const d = K.check(docx, 'a.docx'), p = K.check(pptx, 'a.pptx');
  assert.equal(d.ok, false); assert.equal(d.kind, 'docx'); assert.ok(d.error);
  assert.equal(p.ok, false); assert.equal(p.kind, 'pptx'); assert.ok(p.error);
});

test('아무 압축파일이나 열지 않는다', async () => {
  const z = await zipOf(['readme.txt', 'a/b.bin']);
  const r = K.check(z, 'a.zip');
  assert.equal(r.ok, false);
  assert.ok(r.error);
});

test('크기 한도를 넘으면 거절한다(한도 값은 상수를 따라간다)', () => {
  assert.ok(K.MAX_BYTES > 0);
  const big = new Uint8Array(K.MAX_BYTES + 1);
  big.set([0x25, 0x50, 0x44, 0x46, 0x2d], 0);        // %PDF- — 서명이 맞아도 크면 거절
  const r = K.check(big, 'a.pdf');
  assert.equal(r.ok, false);
  assert.match(r.error, /큽니다/);
});

test('빈 파일·읽을 수 없는 입력·모르는 바이트는 이유를 말하고 거절한다', () => {
  assert.equal(K.check(new Uint8Array(0), 'a.pdf').ok, false);
  assert.equal(K.check(null, 'a.pdf').ok, false);
  assert.equal(K.check('문자열', 'a.pdf').ok, false);
  const r = K.check(u8([1, 2, 3, 4, 5, 6, 7, 8]), 'a.pdf');
  assert.equal(r.ok, false);
  assert.ok(r.error && r.error.length > 4);
});

test('zip 끝 목록이 깨졌어도 죽지 않는다', () => {
  const b = new Uint8Array(64); b.set([0x50, 0x4b, 0x03, 0x04], 0);
  assert.doesNotThrow(() => K.check(b, 'a.xlsx'));
  assert.equal(K.check(b, 'a.xlsx').ok, false);
});
