'use strict';
/* ☁ 위촉장 원본 — 서류 폴더가 없는 기기(PC·폰)에서도 «클라우드 사본»으로 보인다 (대표 제보 2026-11-22)
   「위촉장 원문도 여기다가 넣어야 될 것 같은데 지금 다 사라졌다 … 핸드폰에서도 원본을 잠깐 볼 수 있어야」
   ────────────────────────────────────────────────────────────────────────
   무엇이 막혀 있었나
     ① 편집창 왼쪽 미리보기(_renderFsFormPreview)만 사본으로 안 넘어갔다 — 사본이 올라가 있어도
        「서류 폴더가 연결돼 있지 않습니다」만 떴다(원본 열기·서식 채우기는 전부터 넘어갔다).
     ② 사본을 «새 탭»으로 열었다 — 폰 Chrome 은 PDF 를 탭에서 못 그리고, 받은 뒤(await) 여는 탭은 팝업으로 막혀
        폰에서는 사본이 열리지 않는 것처럼 보였다.
   ⚠ 글자만 찾는 검사는 기능을 꺼 버려도 통과한다 — 앱의 함수를 그대로 떼어 vm 에 올려 «돌려» 본다.
   ⚠ 값(높이·문구)이 아니라 «규칙»을 본다: 폴더가 먼저인가 · 사본이 쓰였나 · 폰에서 새 탭을 안 부르나. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');

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

/* 가짜 서류 폴더 */
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
        return { name: name, arrayBuffer: async function () { return Uint8Array.from(f.bytes || [1, 2, 3]).buffer; } };
      } };
    }
  };
}

const 사본 = (name, bytes) => ({ name: name, buf: Uint8Array.from(bytes || [9, 9, 9]).buffer });

function 무대(opts) {
  opts = opts || {};
  const box = { innerHTML: '' };
  const 창 = { innerHTML: '', 켜짐: false, classList: { add: function () { 창.켜짐 = true; }, remove: function () { 창.켜짐 = false; } } };
  const 호출 = { pdf: [], 사본받기: 0, 새탭: [], 한글: [], 알림: [], 주소: [], 놓음: [] };
  const ctx = {
    console: { warn: function () {}, log: function () {} },
    KcareerScan: require('../js/kcareer-scan.js'),
    document: { getElementById: function (id) { return id === 'fsPrevBox' ? box : (id === 'imgBody' ? 창 : (id === 'imgModal' ? 창.ov : null)); } },
    URL: { createObjectURL: function (x) { 호출.주소.push(x); return 'blob:' + 호출.주소.length; }, revokeObjectURL: function (u) { 호출.놓음.push(u); } },
    Blob: function (parts, o) { this.parts = parts; this.type = o && o.type; },
    window: { open: function (u) { 호출.새탭.push(u); } },
    setTimeout: function () {},
    fsRoot: async function () { return opts.root === null ? null : 폴더(opts.files || {}); },
    abToB64: function (buf) { return 'B64:' + Array.from(new Uint8Array(buf)).join(','); },
    escapeHtml: function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); },
    _jsAttr: function (s) { return String(s).replace(/'/g, "\\'"); },
    showPDFInline: function (id, cid, alt) { 호출.pdf.push({ id: id, cid: cid, alt: alt }); },
    openHwpViewer: function (buf, name) { 호출.한글.push(name); },
    toast: function (m) { 호출.알림.push(String(m)); },
    fsSupported: function () { return opts.폰 ? false : true; },
    _fsRoot: opts.root === null ? null : {},
    _fsCloudFile: async function () { 호출.사본받기++; return opts.사본 || null; },
  };
  창.ov = 창;
  vm.createContext(ctx);
  const 코드 = [
    떼기('function _isHwpName(n){'),
    떼기('function _kcFormMime(ext){'),
    떼기('async function _fsDir('),
    떼기('async function _fsFileOf(relPath){'),
    떼기('async function _renderFsFormPreview(rec){'),
    떼기('function _peekCloudCopy(cf){'),
    opts.진짜열기 ? 떼기('async function openLocalOriginal(relPath){') : 'var openLocalOriginal=function(){};',
    'var _fsPrevUrl=null; var _peekUrl=null;'
  ].join('\n').replace(/^(\s*)const /gm, '$1var ').replace(/^(\s*)let /gm, '$1var ');
  vm.runInContext(코드, ctx);
  return { ctx: ctx, box: box, 창: 창, 호출: 호출 };
}
const 기다림 = () => new Promise((r) => setTimeout(r, 30));
const PDF폴더 = { files: { '/1. 위촉장': { '점검.pdf': { bytes: [1, 2, 3] } } } };
const 미리보기 = (m, rel) => vm.runInContext('_renderFsFormPreview({src:"fs",relPath:' + JSON.stringify(rel) + '})', m.ctx);

/* ══════ ① 편집창 미리보기 ══════ */

test('★★★ 폴더가 없는 기기에서도 사본이 있으면 PDF 가 «그려진다»', async () => {
  const m = 무대({ root: null, 사본: 사본('점검.pdf', [7, 7, 7]) });
  await 미리보기(m, '1. 위촉장/점검.pdf'); await 기다림();
  assert.equal(m.호출.pdf.length, 1, '★★★ 사본이 있는데도 안 그렸습니다 — 대표가 본 「폴더 연결 안 됨」 빈 화면입니다');
  assert.equal(m.호출.pdf[0].cid, 'splitPdfBox');
  assert.equal(m.호출.pdf[0].alt.file.base64, 'B64:7,7,7', '사본에서 받은 바이트를 그려야 합니다');
  assert.match(m.호출.pdf[0].alt.bar, /openLocalOriginal/, '★ 단추가 죽으면 안 됩니다');
  assert.match(m.box.innerHTML, /☁/, '★ 사본으로 보고 있다는 표시가 있어야 합니다 — 원본인 줄 알고 판단하면 안 됩니다');
});

test('★★ 폴더 원본이 «먼저» — 폴더에 있으면 사본을 받지도 않는다', async () => {
  const m = 무대(Object.assign({ 사본: 사본('점검.pdf', [7, 7, 7]) }, PDF폴더));
  await 미리보기(m, '1. 위촉장/점검.pdf'); await 기다림();
  assert.equal(m.호출.사본받기, 0, '★★ 폴더에 원본이 있는데 사본을 받으면 늘 느리고 데이터를 씁니다');
  assert.equal(m.호출.pdf[0].alt.file.base64, 'B64:1,2,3', '폴더에서 읽은 바이트여야 합니다');
  assert.ok(!/☁/.test(m.box.innerHTML), '폴더 원본에는 사본 표시가 붙으면 안 됩니다');
});

test('★★ 폴더는 이어졌는데 파일이 옮겨졌으면 사본으로 — 사본도 없으면 «옮겨졌거나»', async () => {
  const 있음 = 무대({ files: { '/1. 위촉장': {} }, 사본: 사본('점검.pdf', [5]) });
  await 미리보기(있음, '1. 위촉장/점검.pdf'); await 기다림();
  assert.equal(있음.호출.pdf.length, 1, '★★ 옮겨진 파일도 사본이 있으면 보여야 합니다');
  assert.equal(있음.호출.pdf[0].alt.file.base64, 'B64:5');
  const 없음 = 무대({ files: { '/1. 위촉장': {} } });
  await 미리보기(없음, '1. 위촉장/점검.pdf'); await 기다림();
  assert.equal(없음.호출.pdf.length, 0);
  assert.match(없음.box.innerHTML, /옮겨졌거나/, '★★ 터지고 끝나면 화면이 빈 채로 남습니다');
  assert.match(없음.box.innerHTML, /openLocalOriginal/);
});

test('★★ 폴더도 사본도 없으면 «왜»를 말한다 — 폰에서는 «PC 에서 연결» 길을 안내한다', async () => {
  const PC = 무대({ root: null });
  await 미리보기(PC, '1. 위촉장/점검.pdf'); await 기다림();
  assert.equal(PC.호출.pdf.length, 0);
  assert.match(PC.box.innerHTML, /서류 폴더/); assert.match(PC.box.innerHTML, /더보기/, 'PC 는 연결하는 곳을 알려 줘야 합니다');
  const 폰 = 무대({ root: null, 폰: true });
  await 미리보기(폰, '1. 위촉장/점검.pdf'); await 기다림();
  assert.match(폰.box.innerHTML, /PC/, '★★ 폰은 폴더를 못 잇는다 — «더보기 › 폴더 연결»만 알리면 막다른 길입니다');
  assert.ok(!/더보기/.test(폰.box.innerHTML), '폰에서 못 하는 길을 알리면 안 됩니다');
});

test('★ 사본이 그림·한글이어도 같다 — 그림은 사본 바이트로, 한글은 뷰어 길로', async () => {
  const 그림 = 무대({ root: null, 사본: 사본('표창.jpg', [1, 2]) });
  await 미리보기(그림, '3. 표창/표창.jpg'); await 기다림();
  assert.match(그림.box.innerHTML, /<img src="blob:1"/, '★ 사본 그림이 안 나옵니다');
  assert.equal(그림.호출.주소[0].type, 'image/jpeg', '그림 형식을 알려 줘야 브라우저가 그립니다');
  const 한글 = 무대({ root: null, 사본: 사본('위촉장.hwpx', [1]) });
  await 미리보기(한글, '1. 위촉장/위촉장.hwpx'); await 기다림();
  assert.equal(한글.호출.pdf.length, 0, '한글을 PDF 로 그리려 들면 깨집니다');
  assert.match(한글.box.innerHTML, /openLocalOriginal/, '여는 길이 있어야 합니다');
});

/* ══════ ② 앱 안 원본 창(폰에서도 열린다) ══════ */

test('★★★ 사본 PDF 는 «새 탭»이 아니라 앱 안 원본 창에 그린다 — 폰에서 팝업·내려받기로 안 빠진다', async () => {
  const m = 무대({ root: null, 진짜열기: true, 사본: 사본('점검.pdf', [4, 4]) });
  await vm.runInContext('openLocalOriginal("1. 위촉장/점검.pdf")', m.ctx); await 기다림();
  assert.equal(m.호출.새탭.length, 0, '★★★ 사본을 받은 뒤 새 탭을 열면 폰에서 막힙니다(팝업·PDF 못 그림)');
  assert.equal(m.창.켜짐, true, '원본 창을 열어야 합니다');
  assert.equal(m.호출.pdf.length, 1);
  assert.equal(m.호출.pdf[0].cid, 'imgBody', '원본 창 안에 그려야 합니다');
  assert.equal(m.호출.pdf[0].alt.file.base64, 'B64:4,4');
  assert.match(m.호출.pdf[0].alt.bar, /window\.open\(_peekUrl/, '새 탭이 «필요한 사람»은 단추로 — 눌렀을 때 바로 열린다');
  assert.ok(m.호출.주소.length >= 1 && String(m.호출.주소[0].type) === 'application/pdf', '새 탭 단추용 주소는 받아 둔 자리에서 미리 만든다');
});

test('★★ 한글 사본은 한글 뷰어로, 모르는 형식만 옛 길(새 탭)', async () => {
  const 한글 = 무대({ root: null, 진짜열기: true, 사본: 사본('위촉장.hwpx', [1]) });
  await vm.runInContext('openLocalOriginal("1. 위촉장/위촉장.hwpx")', 한글.ctx); await 기다림();
  assert.deepEqual(한글.호출.한글, ['위촉장.hwpx']);
  assert.equal(한글.창.켜짐, false, '한글은 원본 창(그림·PDF 용)을 열지 않는다');
  const 기타 = 무대({ root: null, 진짜열기: true, 사본: 사본('자료.zip', [1]) });
  await vm.runInContext('openLocalOriginal("x/자료.zip")', 기타.ctx); await 기다림();
  assert.equal(기타.창.켜짐, false);
  assert.equal(기타.호출.새탭.length, 1, '그릴 수 없는 형식은 옛 길로 연다');
});

test('★ 사본이 없을 때 — 폰이면 «PC 에서 연결»을, PC 면 «더보기 › 폴더 연결»을 알린다', async () => {
  const 폰 = 무대({ root: null, 진짜열기: true, 폰: true });
  await vm.runInContext('openLocalOriginal("a/b.pdf")', 폰.ctx); await 기다림();
  assert.ok(폰.호출.알림.some((t) => /PC/.test(t)), '★★ 폰에서 못 하는 길을 알리면 막다른 길입니다');
  assert.ok(!폰.호출.알림.some((t) => /더보기/.test(t)));
  const PC = 무대({ root: null, 진짜열기: true });
  await vm.runInContext('openLocalOriginal("a/b.pdf")', PC.ctx); await 기다림();
  assert.ok(PC.호출.알림.some((t) => /더보기/.test(t)));
});

test('★ 앞서 연 사본 주소는 놓아 준다 — 열 때마다 쌓이지 않는다', async () => {
  const m = 무대({ root: null, 진짜열기: true, 사본: 사본('점검.pdf', [4]) });
  await vm.runInContext('openLocalOriginal("a/점검.pdf")', m.ctx);
  await vm.runInContext('openLocalOriginal("a/점검.pdf")', m.ctx); await 기다림();
  assert.equal(m.호출.놓음.length, 1, '두 번째 열 때 첫 주소를 놓아야 합니다');
});

/* ══════ 목록의 «원본» 단추 — 사본이 있으면 ☁ 로 알린다 ══════ */

test('★ 폴더 줄의 「원본」 단추 — 사본이 올라가 있으면 ☁ 가 붙고 없으면 안 붙는다', () => {
  const ctx = { kcIsStaff: () => false, hasOriginal: () => true, fileExists: () => true, _jsAttr: (s) => String(s) };
  vm.createContext(ctx);
  vm.runInContext(떼기('function rowActions(id,store,label,page,rec){').replace(/^(\s*)const /gm, '$1var '), ctx);
  const 줄 = (extra) => vm.runInContext('rowActions("W1","wiccok","점검","wiccok",' + JSON.stringify(Object.assign({ id: 'W1', src: 'fs', relPath: '1. 위촉장/점검.pdf' }, extra)) + ')', ctx);
  assert.match(줄({ fsCloud: 'kcareer_forms/u/FS_wiccok_W1' }), /원본☁/, '사본이 있으면 표시가 있어야 어느 줄이 안전한지 보입니다');
  assert.ok(!/☁/.test(줄({})), '사본이 없는 줄에 표시를 붙이면 거짓말입니다');
});

test('★★ 파일 이름은 «글자»로만 화면에 들어간다 — 사본 이름은 공유 기록(relPath)에서 오므로 «<» 가 든 이름이 태그가 되면 안 된다', async () => {
  const 가짜창 = { innerHTML: '' }, 쪽칸 = { appendChild: function () {} };
  const 쪽 = { getViewport: function () { return { width: 5, height: 5 }; }, render: function () { return { promise: Promise.resolve() }; } };
  const 문서 = { numPages: 1, getPage: async function () { return 쪽; } };
  const ctx = {
    console: { warn: function () {}, log: function () {} },
    document: {
      getElementById: function (id) { return id === 'x_pg' ? 쪽칸 : (id === 'x' ? 가짜창 : null); },
      createElement: function () { return { style: {}, getContext: function () { return {}; } }; }
    },
    window: { _pdfjs: { getDocument: function () { return { promise: Promise.resolve(문서) }; } } },
    _pdfLoadLib: async function () { return true; },
    b64ToAb: function () { return new ArrayBuffer(1); },
    escapeHtml: function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); },
    getFileAsync: async function () { return null; }
  };
  vm.createContext(ctx);
  vm.runInContext(떼기('async function showPDFInline(id,containerId,alt){').replace(/^(\s*)const /gm, '$1var '), ctx);
  const 이름 = '<img src=x onerror=1>.pdf';
  await vm.runInContext('showPDFInline(null,"x",{file:{name:' + JSON.stringify(이름) + ',ext:"pdf",base64:"QQ=="},bar:""})', ctx);
  assert.ok(!/<img src=x/.test(가짜창.innerHTML), '★★★ 파일 이름이 태그로 들어갑니다 — 저장형 XSS 입니다');
  assert.match(가짜창.innerHTML, /&lt;img src=x/, '이름은 글자로 보여야 합니다');
});

test('★ 사본 그림에는 대체 글(alt)이 붙는다 — 스크린리더가 파일 이름을 읽는다', async () => {
  const 미리 = 무대({ root: null, 사본: 사본('표창.jpg', [1, 2]) });
  await 미리보기(미리, '3. 표창/표창.jpg'); await 기다림();
  assert.match(미리.box.innerHTML, /<img [^>]*alt="[^"]+"/, '미리보기 그림에 alt 가 있어야 합니다');
  const 창 = 무대({ root: null, 진짜열기: true, 사본: 사본('표창.jpg', [1, 2]) });
  await vm.runInContext('openLocalOriginal("3. 표창/표창.jpg")', 창.ctx); await 기다림();
  assert.match(창.창.innerHTML, /<img [^>]*alt="[^"]+"/, '원본 창 그림에 alt 가 있어야 합니다');
});

test('★ 원본 창의 폰용 모양은 «폰 구간 안에서만» 바뀐다 — PC 는 그대로(대표 폰 규칙)', () => {
  const 줄 = SRC.split('\n').filter((l) => /#imgModal\b/.test(l) && /\{/.test(l) && !/id="imgModal"/.test(l));
  assert.ok(줄.length >= 1, '폰용 원본 창 규칙이 있어야 합니다');
  /* 규칙 한 줄마다 «바로 위쪽에서 열린 @media» 가 폰 폭이어야 한다 — 바깥(전체 폭)에 적히면 PC 가 바뀐다 */
  for (const l of 줄) {
    const at = SRC.indexOf(l);
    const 앞 = SRC.slice(Math.max(0, at - 800), at);
    const m = [...앞.matchAll(/@media\s*\(\s*max-width\s*:\s*(\d+)px\s*\)\s*\{/g)].pop();
    assert.ok(m, '★★ 폰 구간(@media) 밖에 적혔습니다 — PC 화면이 바뀝니다: ' + l.trim().slice(0, 60));
    assert.ok(Number(m[1]) <= 780, '폰 폭 구간이어야 합니다: ' + m[1]);
    const 닫힘 = 앞.slice(m.index).split('\n}').length - 1;      /* 그 @media 가 이미 닫혔다면 바깥이다 */
    assert.equal(닫힘, 0, '★★ @media 가 닫힌 뒤(바깥)에 적혔습니다: ' + l.trim().slice(0, 60));
  }
});

test('★ 사본 길을 지키는 코드 — 폴더가 먼저, 폰에서는 새 탭을 부르지 않는다(글자 점검)', () => {
  const p = 떼기('async function _renderFsFormPreview(rec){');
  assert.ok(p.indexOf('_fsFileOf(rec.relPath)') < p.indexOf('_fsCloudFile(rec.relPath)'), '폴더가 먼저');
  assert.ok(/if\(!lf\)\{[^}]*_fsCloudFile/.test(p), '폴더에 없을 때만 사본');
  const o = 떼기('async function openLocalOriginal(relPath){');
  assert.ok(o.indexOf('_peekCloudCopy(cf)') > 0 && o.indexOf('_peekCloudCopy(cf)') < o.indexOf('window.open(cu'),
    '앱 안 창이 «먼저», 새 탭은 그 밖의 형식만');
  assert.equal(SRC.split('async function showPDFInline(').length - 1, 1, 'PDF 그리개는 한 벌');
});
