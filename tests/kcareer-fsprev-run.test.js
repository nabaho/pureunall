'use strict';
/* 「보기·편집」의 폴더 원본 미리보기를 «실제로 돌려» 본다 (대표 제보 2026-09-12 「왜 원본 안보이나?」)
   ────────────────────────────────────────────────────────────────────────
   ⚠ 글자만 찾는 검사는 기능을 꺼 버려도 통과한다 — 그래서 앱의 함수를 그대로 떼어
     vm 에 올리고 «가짜 서류 폴더»(PDF·PNG·한글·모르는 형식)를 물려 돌린다.
     무엇이 화면 칸에 들어갔나를 본다.
   ⚠ vm 최상위 const 는 var 로 바꿔 올린다(선언이 갇히지 않게). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');

/* 앱에서 함수를 «이름으로» 떼어 온다 — 중괄호를 세어 끝을 찾는다 */
function 떼기(머리) {
  const i = SRC.indexOf(머리);
  assert.ok(i > 0, 머리 + ' 를 못 찾았습니다');
  let d = 0, started = false;
  for (let p = i; p < SRC.length; p++) {
    const c = SRC[p];
    if (c === '{') { d++; started = true; }
    else if (c === '}') { d--; if (started && d === 0) return SRC.slice(i, p + 1); }
  }
  assert.fail(머리 + ' 의 끝을 못 찾았습니다');
}

/* ── 가짜 서류 폴더 ── */
function 폴더(파일들) {
  return {
    getDirectoryHandle: async function (name) {
      const sub = 파일들['/' + name];
      assert.ok(sub, '없는 하위 폴더: ' + name);
      return 폴더(sub);
    },
    getFileHandle: async function (name) {
      const f = 파일들[name];
      if (!f) throw new Error('NotFoundError: ' + name);
      return { getFile: async function () {
        return { name: name,
                 arrayBuffer: async function () { return Uint8Array.from(f.bytes || [1, 2, 3]).buffer; } };
      } };
    }
  };
}

function 무대(opts) {
  opts = opts || {};
  const box = { innerHTML: '' };
  const pdf호출 = [];
  const ctx = {
    console: { warn: function () {}, log: function () {} },
    document: { getElementById: function (id) { return id === 'fsPrevBox' ? box : null; } },
    URL: { createObjectURL: function () { return 'blob:fake'; }, revokeObjectURL: function () {} },
    fsRoot: async function () { return opts.root === null ? null : 폴더(opts.files || {}); },
    abToB64: function () { return 'QkFTRTY0'; },
    escapeHtml: function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); },
    _jsAttr: function (s) { return String(s).replace(/'/g, "\\'"); },
    showPDFInline: function (id, cid, alt) { pdf호출.push({ id: id, cid: cid, alt: alt }); },
    openLocalOriginal: function () {},
    getFileAsync: async function (id) { return opts.attach && opts.attach[id] ? opts.attach[id] : null; },
  };
  vm.createContext(ctx);
  const 코드 = [
    떼기('function _isHwpName(n){'),
    떼기('async function _fsFileOf(relPath){'),
    떼기('async function recFileAsync(rec, id){'),
    떼기('async function _renderFsFormPreview(rec){'),
    'var _fsPrevUrl=null;'
  ].join('\n').replace(/^(\s*)const /gm, '$1var ');
  vm.runInContext(코드, ctx);
  return { ctx: ctx, box: box, pdf: pdf호출 };
}

const PDF = { files: { '/1. 위촉장': { '2024 전담노무사.pdf': { bytes: [37, 80, 68, 70] } } } };

/* ══════ ★ 실제 증상 ══════ */

test('★★★ 폴더에 있는 PDF 원본이 편집창 왼쪽에 «그려진다»', async () => {
  const m = 무대(PDF);
  await vm.runInContext(
    '_renderFsFormPreview({src:"fs",relPath:"1. 위촉장/2024 전담노무사.pdf"})', m.ctx);
  await new Promise(function (r) { setTimeout(r, 30); });
  assert.equal(m.pdf.length, 1, '★★★ PDF 를 그리지 않았습니다 — 대표가 보신 그 빈 화면입니다');
  assert.equal(m.pdf[0].cid, 'splitPdfBox');
  assert.ok(m.pdf[0].alt && m.pdf[0].alt.file, '★★ 알맹이를 안 넘기면 그리개가 첨부 창고를 뒤집니다');
  assert.equal(m.pdf[0].alt.file.base64, 'QkFTRTY0', '폴더에서 읽은 바이트를 넘겨야 합니다');
  assert.equal(m.pdf[0].alt.file.name, '2024 전담노무사.pdf');
  assert.match(m.pdf[0].alt.bar, /openLocalOriginal/, '★ 단추가 죽으면 안 됩니다');
  assert.match(m.box.innerHTML, /splitPdfBox/, '그릴 자리를 먼저 놓아야 합니다');
});

test('★★ 한글 원본은 캔버스로 그리지 않고 «원본 열기»로 보낸다', async () => {
  const m = 무대({ files: { '/1. 위촉장': { '위촉장.hwp': {} } } });
  await vm.runInContext('_renderFsFormPreview({src:"fs",relPath:"1. 위촉장/위촉장.hwp"})', m.ctx);
  await new Promise(function (r) { setTimeout(r, 30); });
  assert.equal(m.pdf.length, 0, '★★ 한글을 PDF 로 그리려 들면 깨진 화면이 뜹니다');
  assert.match(m.box.innerHTML, /위촉장\.hwp/, '무슨 파일인지 말해야 합니다');
  assert.match(m.box.innerHTML, /openLocalOriginal/, '★★ 여는 길이 없으면 막다른 길입니다');
  /* ⚠ 「미리보기 미지원 형식」으로 떨어지면 안 된다 — 한글은 앱 안 뷰어로 «볼 수 있는» 서류다.
     이 두 줄이 없으면 한글 판정을 꺼도 검사가 통과한다(고장넣기로 확인했다). */
  assert.match(m.box.innerHTML, /한글 문서는 원본 열기로 봅니다/,
    '★★ 한글은 「볼 수 있다」고 말해야 합니다 — 미지원으로 떨어뜨리면 안 됩니다');
  assert.ok(!/미리보기 미지원/.test(m.box.innerHTML),
    '★★ 한글이 「미리보기 미지원」 칸으로 떨어졌습니다 — 한글 판정이 꺼졌습니다');
});

test('★★ 그림 원본은 그대로 보여 준다', async () => {
  const m = 무대({ files: { '/3. 포상 및 표창': { '표창장.jpg': {} } } });
  await vm.runInContext('_renderFsFormPreview({src:"fs",relPath:"3. 포상 및 표창/표창장.jpg"})', m.ctx);
  await new Promise(function (r) { setTimeout(r, 30); });
  assert.match(m.box.innerHTML, /<img src="blob:fake"/, '★ 그림이 안 나옵니다');
});

/* ══════ 막혔을 때 — 빈 칸은 고장으로 읽힌다 ══════ */

test('★★ 폴더가 연결 안 됐으면 «왜»를 말한다 — 조용히 비우지 않는다', async () => {
  const m = 무대({ root: null });
  await vm.runInContext('_renderFsFormPreview({src:"fs",relPath:"1. 위촉장/x.pdf"})', m.ctx);
  await new Promise(function (r) { setTimeout(r, 30); });
  assert.match(m.box.innerHTML, /서류 폴더/, '★★ 빈 칸으로 두면 고장으로 읽힙니다');
  assert.match(m.box.innerHTML, /더보기/, '어디서 연결하는지 알려 줘야 합니다');
});

test('★★ 파일이 옮겨졌으면 그렇다고 말하고 여는 길을 준다', async () => {
  const m = 무대({ files: { '/1. 위촉장': {} } });     /* 폴더는 있고 파일이 없다 */
  await vm.runInContext('_renderFsFormPreview({src:"fs",relPath:"1. 위촉장/없는파일.pdf"})', m.ctx);
  await new Promise(function (r) { setTimeout(r, 30); });
  assert.match(m.box.innerHTML, /옮겨졌거나/, '★★ 터지고 끝나면 화면이 빈 채로 남습니다');
  assert.match(m.box.innerHTML, /openLocalOriginal/);
});

test('모르는 형식은 «미리보기 미지원»이라 밝힌다', async () => {
  const m = 무대({ files: { '/x': { 'a.zip': {} } } });
  await vm.runInContext('_renderFsFormPreview({src:"fs",relPath:"x/a.zip"})', m.ctx);
  await new Promise(function (r) { setTimeout(r, 30); });
  assert.match(m.box.innerHTML, /미리보기 미지원/);
  assert.match(m.box.innerHTML, /a\.zip/);
});

/* ══════ 바이트 읽개 — 두 보관 방식이 «같은 모양»으로 나온다 ══════ */

test('★★ recFileAsync — 폴더 원본과 앱 첨부가 같은 모양으로 나온다', async () => {
  const m = 무대({ files: { '/1. 위촉장': { '가.pdf': {} } },
                   attach: { 'W-1': { name: '나.pdf', ext: 'pdf', base64: 'QUJD' } } });
  const a = await vm.runInContext(
    'recFileAsync({src:"fs",relPath:"1. 위촉장/가.pdf"})', m.ctx);
  assert.equal(a.name, '가.pdf');
  assert.equal(a.ext, 'pdf', '★ 확장자를 안 주면 쓰는 쪽이 형식을 못 가릅니다');
  assert.equal(a.base64, 'QkFTRTY0', '★★ base64 가 없으면 OCR·원문 텍스트가 못 읽습니다');
  const b = await vm.runInContext('recFileAsync({id:"W-1"},"W-1")', m.ctx);
  assert.equal(b.base64, 'QUJD', '앱 안 첨부 길이 그대로여야 합니다');
  assert.deepEqual(Object.keys(a).sort().filter(function (k) { return k !== 'file'; }),
                   ['base64', 'ext', 'name'], '두 길의 칸 이름이 같아야 합니다');
});

test('★ 폴더가 없으면 null — «없는 것»과 «못 읽은 것»을 뭉뚱그리지 않는다', async () => {
  const m = 무대({ root: null });
  const r = await vm.runInContext('recFileAsync({src:"fs",relPath:"a/b.pdf"})', m.ctx);
  assert.equal(r, null);
});
