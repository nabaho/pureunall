'use strict';
/* 계약 서식 글자 뽑기 — 알피가 «공용 읽개»를 쓴다 (2026-09-12)

   ■ 무엇이 틀리고 있었나
     같은 한글 파일이 화면마다 다르게 읽혔다. 취업규칙·급여데이터함·사진첩·기업정보함은
     공용 읽개(hwp_extract.js)로 본문을 통째로 읽는데, **알피만 제 것을 따로** 들고
     `.hwp` 를 「미리보기 글자」(PrvText — 한글이 넣어 두는 맛보기)로 읽었다.
     그래서 알피에 넣으면 본문 조각만 나오거나 「미리보기 텍스트 없음」으로 빈손이 됐다.
     조용히 틀리던 자리다 — 아무도 오류를 못 봤고, 그냥 글자가 적게 왔다.

   ■ 규칙
     ⓐ 읽개는 «한 곳»이다 — hwp_extract.js 의 extractDocText.
     ⓑ 확장자가 아니라 «파일 속 표식»으로 가린다.
     ⓒ 못 읽으면 «왜»를 그대로 전한다(암호화·손상은 사람이 할 일이 다르다).
   ⚠ 알피가 제 읽개를 다시 만들면 안 된다 — 두 벌이 되면 또 갈린다. */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const zlib = require('zlib');
const assert = require('assert');
const { test } = require('node:test');
const { stripComments } = require('./strip-comments');
const { cutFn } = require('./cut-fn');

const R = path.join(__dirname, '..');
const ERP = fs.readFileSync(path.join(R, 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');

/* 진짜 읽개를 그대로 싣는다 — 베껴 적으면 견주는 뜻이 없다 */
const 읽개 = (function () {
  const box = { console, TextDecoder, Uint8Array, DataView, Set, Promise,
    Math, String, Object, Array, Error, parseInt, module: undefined,
    pako: { inflateRaw: (u8) => new Uint8Array(zlib.inflateRawSync(Buffer.from(u8))) } };
  box.globalThis = box;
  vm.createContext(box);
  vm.runInContext(fs.readFileSync(path.join(R, 'hwp_extract.js'), 'utf8'), box);
  return box;
})();

/* ── 진짜 .hwpx 한 장을 지어 낸다 (zip + xml) ── */
function 만든hwpx(글) {
  const xml = '<?xml version="1.0"?><hs:sec xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph">'
    + 글.map((p) => '<hp:p><hp:run><hp:t>' + p + '</hp:t></hp:run></hp:p>').join('')
    + '</hs:sec>';
  return zip([['mimetype', Buffer.from('application/hwp+zip')],
              ['Contents/section0.xml', Buffer.from(xml, 'utf8')]]);
}
/* 아주 작은 ZIP 만들개 — 압축 없이(STORE) 담는다 */
function zip(files) {
  const locals = [], central = [];
  let off = 0;
  for (const [name, data] of files) {
    const nb = Buffer.from(name, 'utf8');
    const crc = crc32(data);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0, 6);
    lh.writeUInt16LE(0, 8); lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(data.length, 22);
    lh.writeUInt16LE(nb.length, 26); lh.writeUInt16LE(0, 28);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(0, 10); ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(data.length, 24);
    ch.writeUInt16LE(nb.length, 28); ch.writeUInt32LE(off, 42);
    locals.push(lh, nb, data);
    central.push(ch, nb);
    off += lh.length + nb.length + data.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
  return Buffer.concat([Buffer.concat(locals), cd, end]);
}
let _crcT = null;
function crc32(buf) {
  if (!_crcT) {
    _crcT = [];
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; _crcT[n] = c >>> 0; }
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = _crcT[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

test('① ★★ .hwpx 본문이 그대로 읽힌다 — 표 안 글자도 같이', async function () {
  const buf = 만든hwpx(['자문계약서', '갑: 가나상사', '제1조(목적) 본 계약은 …']);
  const t = await 읽개.extractDocText(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length));
  assert.match(t, /자문계약서/, '★★ 제목을 못 읽었습니다');
  assert.match(t, /가나상사/, '★★ 본문을 못 읽었습니다');
  assert.match(t, /제1조/);
});

test('② ★★ 확장자가 아니라 «파일 속 표식»으로 가린다', async function () {
  /* 이름은 .pdf 인데 속은 hwpx — 실제로 들어오는 모양이다 */
  const buf = 만든hwpx(['이름은 거짓말을 한다']);
  const t = await 읽개.extractDocText(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length));
  assert.match(t, /이름은 거짓말을 한다/,
    '★★ 확장자를 믿고 읽으면 이름이 틀린 파일을 통째로 놓칩니다');
});

/* RTF 는 한글을 «\uN?» 으로 적는다 — 글자를 그대로 넣으면 실제 파일과 다른 것을 시험하게 된다
   (2026-09-12 에 그렇게 만들었다가 이 검사가 제 자리를 못 지켰다) */
const rtf한글 = (s) => s.split('').map(function (c) {
  const n = c.charCodeAt(0);
  return n < 128 ? c : '\\u' + n + '?';
}).join('');

test('③ ★★ .doc 로 저장된 RTF 를 읽는다 — 예전에는 «미지원»으로 돌려보냈다', async function () {
  const rtf = Buffer.from('{\\rtf1\\ansi ' + rtf한글('내용증명')
    + '\\par ' + rtf한글('발신인 홍길동') + '\\par}', 'latin1');
  /* ⚠ extractRtfText 를 «바로» 부르면 안 된다 — 알피가 부르는 것은 extractDocText 이고,
     가름길(표식 보기)이 망가져도 이 검사가 통과해 버린다(2026-09-12 이빨 확인에서 찾음). */
  const t = await 읽개.extractDocText(rtf.buffer.slice(rtf.byteOffset, rtf.byteOffset + rtf.length));
  assert.match(t, /내용증명/, '★★ RTF 를 못 읽습니다');
  assert.match(t, /홍길동/);
});

/* ── 알피가 그 읽개를 «실제로 쓰는가» ── */

test('④ ★★ 알피가 공용 읽개를 쓴다 — 제 것을 따로 만들지 않는다', function () {
  const fn = cutFn(stripComments(ERP), 'function extractTemplateText(');
  assert.match(fn, /extractDocText\(buf\)/,
    '★★ 알피가 또 제 읽개를 만들었습니다 — 두 벌이 되면 화면마다 또 갈립니다');
  /* 「미리보기 글자」로 되돌아가면 안 된다 — 그것이 조용히 틀리던 자리다 */
  assert.ok(!/PrvText/.test(fn),
    '★★ 미리보기 글자(PrvText)로 되돌아갔습니다 — 본문이 조각만 옵니다');
});

test('⑤ ★★ 옛 읽개가 «파일에서 사라졌다» — 남겨 두면 다음 사람이 그걸 씁니다', function () {
  const src = stripComments(ERP);
  ['_extractTemplateText_OLD', '_xmlExtract', 'PrvText'].forEach(function (n) {
    assert.ok(src.indexOf(n) < 0, '★★ 「' + n + '」 이 아직 남아 있습니다');
  });
});

test('⑥ ★ 읽개를 «그 파일을 열 때만» 받는다 — 모두에게 짐을 지우지 않는다', function () {
  const src = stripComments(ERP);
  assert.match(src, /function _ensureDocText\(needPdf, cb\)/, '★ 늦게 받는 자리가 없습니다');
  /* 머리에 박아 두면 모든 사람이 늘 받는다 */
  assert.ok(!/<script src="hwp_extract\.js/.test(src),
    '★ 머리에 박아 두면 이 길로 안 오는 사람도 늘 내려받습니다');
  assert.ok(!/<script src="vendor\/pako/.test(src), '★ pako 도 마찬가지입니다');
});

test('⑦ ★★ PDF 일 때만 pdf.js 를 받는다 — 한글 하나 읽자고 1MB 를 받지 않는다', function () {
  const fn = cutFn(stripComments(ERP), 'function _ensureDocText(');
  assert.match(fn, /if\(!needPdf\)\{ cb\(null\); return; \}/,
    '★★ 한글 파일에도 pdf.js 를 받습니다');
  /* 그 판정은 «파일 속 표식»으로 한다 */
  const look = cutFn(stripComments(ERP), 'function _looksPdf(');
  assert.match(look, /0x25 && u\[1\]===0x50 && u\[2\]===0x44 && u\[3\]===0x46/,
    '★ 이름으로 PDF 를 가립니다 — 속을 봐야 합니다');
});

test('⑧ ★ 못 읽으면 «왜»를 그대로 전한다 — 암호화와 손상은 할 일이 다르다', function () {
  const fn = cutFn(stripComments(ERP), 'function extractTemplateText(');
  assert.match(fn, /err && err\.message/,
    '★ 까닭을 삼키면 「안 됩니다」만 남습니다');
  assert.match(fn, /cb\(text, text\?null:'본문 텍스트 없음'\)/, '★ 빈손을 성공으로 넘깁니다');
});

test('⑨ ★ 알아볼 수 없는 파일을 «읽은 척하지 않는다»', async function () {
  await assert.rejects(async function () {
    const fake = Buffer.alloc(600);
    fake.write('HWP Document File', 0, 'latin1');
    await 읽개.extractHwpText(fake.buffer.slice(fake.byteOffset, fake.byteOffset + fake.length));
  }, /HWP|CFB|형식/, '★★ 아무 파일이나 읽는 척합니다');
});

test('⑩ ★★ 암호화된 한글은 «거절한다» — 반쯤 읽어 들이면 안 된다', function () {
  /* ⚠ 진짜 암호화 파일을 지어내려면 CFB 껍데기를 통째로 만들어야 한다. 여기서는
     «거절하는 규칙이 읽개에 있는가»를 못박는다 — 검사고정-허용: 이 줄이 곧 규칙이다.
     (앞서 가짜 버퍼로 시험했더니 CFB 단계에서 먼저 넘어져, 이 규칙을 빼도 통과했다) */
  const src = fs.readFileSync(path.join(R, 'hwp_extract.js'), 'utf8');
  assert.match(src, /if \(flags & 2\) throw new Error\("암호화된 HWP/,
    '★★ 암호화된 한글을 거르지 않습니다 — 깨진 글자가 계약 본문으로 들어갑니다');
});

test('⑪ ★★ hwpx 에서 «hp:t 인 것만» 골라 읽는다 — 표 태그가 본문에 섞이면 안 된다', function () {
  const fn = cutFn(fs.readFileSync(path.join(R, 'hwp_extract.js'), 'utf8'), 'function extractHwpxText(');
  /* ⚠ 「파일 어딘가에 빡빡한 꼴이 있다」로는 모자라다 — 같은 줄이 두 번 나와서,
     골라 내는 줄(match)만 헐거워져도 통과했다(2026-09-12 이빨 확인에서 찾음).
     <hp:t[^>]*> 로 두면 <hp:tbl>·<hp:tc>·<hp:tr> 까지 걸려 서식 XML 이 본문이 된다. */
  assert.match(fn, /\.match\(\/<hp:t\(\?:\\s\[\^>\]\*\)\?>/,
    '★★ 골라 내는 자리의 태그 이름이 헐겁습니다 — 표 서식이 계약 본문에 섞여 들어옵니다');
});

test('⑫ ★★ 가름길이 «표식»을 차례로 본다 — PDF → RTF → ZIP → 그 밖은 한글(CFB)', function () {
  /* ⚠ 진짜 .hwp(CFB) 를 지어내려면 껍데기를 통째로 만들어야 해서, 여기서는 «가름의 뼈대»를
     못박는다 — ZIP 표식(PK)을 안 보면 한글 파일이 zip 인 줄 알고 넘어간다.
     검사고정-허용: 이 네 줄의 «차례»가 곧 규칙이다. */
  const fn = cutFn(fs.readFileSync(path.join(R, 'hwp_extract.js'), 'utf8'), 'async function extractDocText(');
  /* ⚠ '0x50' 하나로 ZIP 자리를 찾으면 안 된다 — PDF 표식 «%PDF»(0x25 0x50 0x44 0x46)에도
     0x50 이 들어 있어 엉뚱한 줄을 짚는다(2026-09-12 에 실제로 그랬다). 줄 전체로 찾는다. */
  const pdf = fn.indexOf('u8[0] === 0x25');
  const rtf = fn.indexOf('u8[0] === 0x7b');
  const zip = fn.indexOf('u8[0] === 0x50 && u8[1] === 0x4b');
  const hwp = fn.indexOf('extractHwpText(arrayBuffer');
  assert.ok(pdf > 0 && rtf > 0 && zip > 0 && hwp > 0,
    '가름길의 조각을 못 찾았습니다 — pdf/rtf/zip/hwp = ' + [pdf, rtf, zip, hwp].join('/'));
  assert.ok(pdf < rtf && rtf < zip && zip < hwp,
    '★★ 가리는 차례가 바뀌었습니다 — 한글 파일이 엉뚱한 읽개로 갑니다');
  assert.match(fn, /u8\[0\] === 0x50 && u8\[1\] === 0x4b/,
    '★★ ZIP 표식을 안 봅니다 — 한글(CFB)까지 zip 으로 풀려다 넘어집니다');
});
