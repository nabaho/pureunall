'use strict';
/* 푸른메일함 첨부 미리보기 — 한글(.hwp·.hwpx)을 글자 뭉치가 아니라 «한글 양식 쪽 모양» 그대로 캔버스에 그린다 (2026-11-11)
 *
 * ■ 왜 고쳤나
 *   기존 메일 첨부 미리보기(mbPvDraw)는 .hwp·.hwpx 도 워드와 함께 extractDocText 로 «글자만» 뽑아 <pre> 에 부었다.
 *   표·체크박스·서명란이 든 한글 양식(동의서·신청서·계약서)이 세로 글자 줄로 깨져 모양을 알아볼 수 없었다.
 *   이미 기업정보함에 실려 있는 공용 한글 엔진(js/pu-hwp-engine.js · vendor/rhwp-core WASM)으로
 *   쪽마다 캔버스에 종이 모양 그대로 그리고, 엔진이 못 여는 옛 형식(HWP 3.0 등)·워드만 글자 추출로 물러난다.
 *
 * ■ 지키는 규칙
 *   ① .hwp·.hwpx 는 PureunHwp.openDoc(저장소 사본 cdnBase:'')으로 열어 #mbPvHwp 캔버스에 그린다(바깥 CDN 안 나감)
 *   ② 확장자가 .hwp 여도 속이 PK(hwpx)면 바이트 머릿글 형식('document.' + fmt)으로 열어 어긋남 오류를 막는다
 *   ③ 받아 둔 바이트(_mbAttBuf)는 사본(buf.slice())으로 넘겨 두 번째 미리보기가 비지 않는다
 *   ④ 올려놓기(mbPvLibsFor)는 한글이면 PureunHwp.loadCore 로 WASM 엔진만 미리 깨우고 xlsx(900KB)는 안 받는다
 *   ⑤ 엔진이 못 여는 파일(HWP 3.0·손상본)과 워드(.docx·.doc·.odt·.rtf)는 글자 추출로 물러난다
 *   ⑥ 창을 닫거나(mbPvClose)·다른 첨부를 열거나(mbAttPeek)·메일을 나갈 때(mbBack/openMailMsg) WASM doc.free() 를 반드시 부른다
 *   ⑦ 키 큰 A4 용지가 위쪽으로 잘리지 않게(.pvpdf margin:auto) 둔다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { sliceFn } = require('./fnslice.js');

const ROOT = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(ROOT, 'pu-cards.html'), 'utf8').replace(/\r\n/g, '\n');
const CSS = HTML.slice(HTML.indexOf('<style>'), HTML.indexOf('</style>')).replace(/\/\*[\s\S]*?\*\//g, ' ');
const fn = (n) => sliceFn(HTML, 'function ' + n + '(');

const HWP5_MAGIC = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 1, 2, 3, 4]);
const HWPX_MAGIC = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 9, 8, 7, 6]);

function makeBox(opts) {
  const o = opts || {};
  const calls = { loadCore: [], openDoc: [], renderPage: [], freed: 0, pdfDestroyed: 0, scripts: [], extractText: 0, renders: 0 };
  const fakeDoc = (pages) => ({
    pageCount: () => pages,
    getPageInfo: (i) => JSON.stringify({ width: 794, height: 1123, page: i }),
    renderPageToCanvas: (i, cv, sc) => { calls.renderPage.push({ i, sc }); },
    free: () => { calls.freed++; },
  });
  const PureunHwp = o.noEngine ? undefined : {
    loadCore: async (cfg) => { calls.loadCore.push(cfg); },
    detectFormat: (b) => {
      if (b && b[0] === 0xd0 && b[1] === 0xcf) return 'hwp';
      if (b && b[0] === 0x50 && b[1] === 0x4b) return 'hwpx';
      return '';
    },
    openDoc: o.openDoc || (async (bytes, name, cfg) => {
      calls.openDoc.push({ len: bytes.byteLength, buf: bytes.buffer, name, cfg });
      if (o.openFail) throw new Error('엔진이 못 여는 옛 형식');
      return fakeDoc(o.pages || 2);
    }),
  };
  const els = {};
  const ctx = {
    console: { warn: () => {}, log: () => {}, error: () => {} },
    Promise, Object, Array, Number, String, Math, JSON, Uint8Array, TextDecoder, Blob,
    URL: { createObjectURL: () => 'blob:test', revokeObjectURL: () => {} },
    setTimeout: (cb) => { cb(); return 1; },
    clearTimeout: () => {},
    confirm: () => true,
    toast: () => {},
    esc: (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])),
    fmtMB: (n) => Math.round(n / 1024) + 'KB',
    MB_PV_MAX: 20 * 1024 * 1024,
    MB_PV_TEXT_MAX: 200000,
    MB_PV_IMG: { jpg: 1, jpeg: 1, png: 1 },
    MB_PV_TXT: { txt: 1, csv: 1 },
    MB_PV_DOC: { hwp: 1, hwpx: 1, doc: 1, docx: 1, odt: 1, rtf: 1 },
    MB_PV_XLS: { xlsx: 1, xls: 1 },
    MB_HWP_CORE_OPT: { cdnBase: '', coreUrl: 'vendor/rhwp-core/rhwp.js' },
    state: {
      mbPv: null,
      mbOpen: {
        slug: 'IN', uid: '1',
        atts: o.atts || [
          { name: '(양식)전문가 풀 참여 동의서.hwp', mime: 'application/x-hwp', size: 157 * 1024 },
          { name: '안내문.docx', mime: '', size: 40 * 1024 },
        ],
      },
    },
    firebase: { auth: () => ({ currentUser: { getIdToken: async () => 'tok' } }) },
    mbAttBytes: async (open, i) => (o.bytesFor ? o.bytesFor(i) : (i === 0 ? HWP5_MAGIC : HWPX_MAGIC)),
    extractDocText: async () => { calls.extractText++; return o.fallbackText || '폴백 본문 글자'; },
    renderMailPage: () => { calls.renders++; },
    mbPhMoreSet: () => {},
    mbQrClose: () => {},
    window: { PureunHwp, pako: {}, XLSX: {}, devicePixelRatio: 2 },
    document: {
      head: { appendChild: (s) => { calls.scripts.push(s.src); if (s.onload) s.onload(); } },
      getElementById: (id) => els[id] || null,
      createElement: (tag) => {
        const attrs = {}, children = [];
        return {
          tagName: tag.toUpperCase(), className: '', style: {}, width: 0, height: 0, textContent: '',
          children,
          getContext: () => ({}),
          setAttribute: (k, v) => { attrs[k] = String(v); },
          getAttribute: (k) => (k in attrs ? attrs[k] : null),
          appendChild: (c) => { children.push(c); return c; },
          querySelector: (sel) => (sel === 'canvas' ? children.find((x) => x.tagName === 'CANVAS') || null : null),
        };
      },
    },
  };
  ctx.window.extractDocText = ctx.extractDocText;
  vm.createContext(ctx);
  vm.runInContext([
    'const _mbPvLibWait = {}; let _mbPvSeq = 0;',
    fn('mbPvExt'), fn('mbPvKind'), fn('mbPvLib'), fn('mbPvLibsFor'),
      fn('mbPvRelease'), fn('mbPvReset'), fn('mbPvClose'), fn('mbAttPeek'),
      fn('mbPvDraw'), fn('mbPvPdfDraw'), fn('mbPvHwpDraw'), fn('mbPvPage'), fn('mbPvAfter'), fn('mbPvHtml'), fn('mbBack'),
  ].join('\n'), ctx);
  ctx.__calls = calls;
  ctx.__els = els;
  ctx.__fakePdf = () => ({ destroy: () => { calls.pdfDestroyed++; } });
  return ctx;
}

test('① 공용 한글 엔진(js/pu-hwp-engine.js)이 loadCore 를 내보낸다', () => {
  const Hwp = require(path.join(ROOT, 'js', 'pu-hwp-engine.js'));
  assert.equal(typeof Hwp.loadCore, 'function', '미리 깨우기에 쓸 PureunHwp.loadCore 가 없습니다');
});

test('① .hwp 첨부를 열면 글자 추출이 아니라 PureunHwp.openDoc(저장소 사본)으로 쪽 모양을 준비하고 머리줄에 한글 양식을 적는다', async () => {
  const b = makeBox({ pages: 2 });
  const src = new Uint8Array(HWP5_MAGIC);
  const got = await b.mbPvDraw('doc', src, { name: '(양식)전문가 풀 참여 동의서.hwp', mime: 'application/x-hwp' });
  assert.equal(b.__calls.openDoc.length, 1, 'PureunHwp.openDoc 을 부르지 않았습니다');
  assert.equal(b.__calls.openDoc[0].cfg.cdnBase, '', '바깥 CDN 주소를 비우지 않았습니다');
  assert.notEqual(b.__calls.openDoc[0].buf, src.buffer, '원본 버퍼를 그대로 넘겼습니다 — 사본(slice)이어야 합니다');
  assert.equal(b.__calls.extractText, 0, '정상 한글인데 글자 추출기가 돌았습니다');
  assert.equal(got.pages, 2);
  assert.ok(got.hwp, '열린 한글 문서 객체가 없습니다');

  b.state.mbPv = Object.assign({ i: 0, tok: 1, name: '(양식)전문가 풀 참여 동의서.hwp', size: 157 * 1024, kind: 'doc', loading: false }, got);
  const html = b.mbPvHtml();
  assert.match(html, /id="mbPvHwp"/, '한글 캔버스 무대(#mbPvHwp)를 그리지 않습니다');
  assert.match(html, /한글 양식 2쪽/, '머리줄에 한글 양식 쪽수를 적지 않습니다');
  assert.doesNotMatch(html, /글자만 뽑아 보여/, '양식 그대로 그리는데 옛 안내(글자만 뽑아)가 남아 있습니다');
  assert.match(html, /class="pvpg"/, '여러 쪽 한글에 쪽 넘김 막대가 없습니다');
});

test('② 확장자가 .hwp 여도 속이 HWPX(PK)면 바이트 형식으로 열어 확장자 어긋남 오류를 막는다', async () => {
  const b = makeBox({ pages: 1 });
  const got = await b.mbPvDraw('doc', new Uint8Array(HWPX_MAGIC), { name: '이름만옛한글.hwp', mime: '' });
  assert.equal(b.__calls.openDoc.length, 1);
  assert.equal(b.__calls.openDoc[0].name, 'document.hwpx', '바이트에서 읽은 실제 형식(hwpx)으로 열어야 합니다');
  assert.ok(got.hwp);
});

test('② 확장자가 잘린 한글 첨부도 MIME 으로 알아보고 양식으로 연다', async () => {
  const b = makeBox({ pages: 1 });
  assert.equal(b.mbPvKind('긴이름이라확장자가잘린첨부파일', 'application/x-hwp'), 'doc');
  const got = await b.mbPvDraw('doc', new Uint8Array(HWP5_MAGIC), { name: '긴이름이라확장자가잘린첨부파일', mime: 'application/x-hwp' });
  assert.equal(b.__calls.openDoc.length, 1);
  assert.ok(got.hwp);
});

test('④ 올려놓기(mbPvLibsFor)는 한글이면 WASM 코어만 미리 깨우고 무거운 xlsx 판독기는 부르지 않는다', async () => {
  const b = makeBox();
  await b.mbPvLibsFor('doc', '동의서.hwp');
  assert.equal(b.__calls.loadCore.length, 1);
  assert.equal(b.__calls.loadCore[0].cdnBase, '');
  assert.equal(b.__calls.scripts.length, 0, '한글 엔진이 있는데 옛 스크립트를 추가로 실었습니다');
});

test('⑤ 엔진이 못 여는 옛 한글(HWP 3.0 등)과 워드(.docx)는 죽지 않고 글자 추출로 물러난다', async () => {
  const old = makeBox({ openFail: true, fallbackText: '옛 한글 본문' });
  const r1 = await old.mbPvDraw('doc', new Uint8Array(HWP5_MAGIC), { name: '옛문서.hwp', mime: '' });
  assert.equal(old.__calls.openDoc.length, 1);
  assert.equal(old.__calls.extractText, 1, '엔진 실패 뒤 글자 추출로 물러나지 않았습니다');
  assert.equal(r1.text, '옛 한글 본문');

  const word = makeBox();
  const r2 = await word.mbPvDraw('doc', new Uint8Array(HWPX_MAGIC), { name: '안내.docx', mime: '' });
  assert.equal(word.__calls.openDoc.length, 0, '.docx 에 한글 엔진을 부르면 안 됩니다');
  assert.equal(word.__calls.extractText, 1);
  assert.equal(r2.text, '폴백 본문 글자');
});

test('④-2 mbPvHwpDraw 가 쪽 캔버스를 실제로 그리고 mbPvPage 로 쪽을 옮긴다', async () => {
  const b = makeBox({ pages: 3 });
  const got = await b.mbPvDraw('doc', new Uint8Array(HWP5_MAGIC), { name: '양식.hwp', mime: '' });
  b.state.mbPv = Object.assign({ i: 0, tok: 7, name: '양식.hwp', kind: 'doc', loading: false }, got);
  const stage = { clientWidth: 920, clientHeight: 640, scrollTop: 0, addEventListener: () => {}, removeEventListener: () => {}, parentNode: null };
  const host = b.document.createElement('div');
  host.parentNode = stage;
  b.__els.mbPvHwp = host;

  b.mbPvHwpDraw();
  assert.equal(host.children.length, 3, '3쪽 문서인데 쪽 상자가 3개가 아닙니다');
  assert.ok(b.__calls.renderPage.length >= 1, '첫 쪽을 캔버스에 그리지 않았습니다');
  b.mbPvPage(1);
  assert.equal(b.state.mbPv.page, 2, '다음 쪽으로 이동하지 않았습니다');
});

test('⑥ 창 닫기·다른 첨부 열기·늦게 도착한 응답·메일 나가기에서 모두 WASM 메모리를 해제한다', async () => {
  const b = makeBox({ pages: 2 });
  b.mbAttPeek(0);
  await new Promise((r) => setImmediate(r));
  assert.ok(b.state.mbPv && b.state.mbPv.hwp, '미리보기가 열리지 않았습니다');

  b.mbPvClose();
  assert.equal(b.state.mbPv, null);
  assert.equal(b.__calls.freed, 1, '창을 닫았는데 doc.free() 를 부르지 않았습니다');

  /* 닫힌 뒤에 늦게 도착한 응답도 그 자리에서 해제하고 창을 되살리지 않는다 */
  let resolveSlow;
  const slow = makeBox({
    openDoc: () => new Promise((res) => { resolveSlow = res; }),
  });
  slow.mbAttPeek(0);
  await new Promise((r) => setImmediate(r));
  slow.mbPvClose();
  let slowFreed = 0;
  resolveSlow({ pageCount: () => 1, getPageInfo: () => '{}', renderPageToCanvas: () => {}, free: () => { slowFreed++; } });
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));
  assert.equal(slow.state.mbPv, null, '닫은 창이 늦은 응답으로 되살아났습니다');
  assert.equal(slowFreed, 1, '버려진 늦은 응답의 WASM 문서를 해제하지 않았습니다');

  /* 메일 읽기에서 뒤로 나갈 때도 열린 미리보기를 정리한다 */
  const nav = makeBox({ pages: 1 });
  nav.mbAttPeek(0);
  await new Promise((r) => setImmediate(r));
  nav.mbBack();
  assert.equal(nav.state.mbPv, null);
  assert.equal(nav.__calls.freed, 1, '메일을 나갈 때 미리보기 WASM 문서를 해제하지 않았습니다');
});

test('⑦ 키 큰 용지가 위쪽으로 잘리지 않게 .pvstage 가 세로 중앙 정렬을 쓰지 않고 min-height:0 과 상단 시작 흐름을 지킨다', () => {
  const st = CSS.match(/\.pvstage\s*\{([^}]*)\}/);
  assert.ok(st, '.pvstage 규칙이 없습니다');
  assert.match(st[1], /align-items\s*:\s*flex-start/, '.pvstage 가 align-items:flex-start 가 아니면 긴 문서 윗부분이 잘립니다');
  assert.doesNotMatch(st[1], /align-items\s*:\s*center/, '.pvstage 에 align-items:center 가 남아 있습니다');
  assert.match(st[1], /min-height\s*:\s*0/, '.pvstage 에 min-height:0 이 없어 작은 창에서 아래 단추가 밀릴 수 있습니다');
  const m = CSS.match(/\.pvstage\s+\.pvpdf\s*\{([^}]*)\}/);
  assert.ok(m && /margin\s*:\s*auto/.test(m[1]), '.pvpdf 에 margin:auto 가 없습니다');
  const hwpCv = CSS.match(/\.pvstage\s+\.pvhwp\s+canvas\s*\{([^}]*)\}/);
  assert.ok(hwpCv && /margin\s*:\s*0/.test(hwpCv[1]), '.pvhwp 안쪽 캔버스에 margin:0 이 없습니다');
});

test('⑧ openDoc 성공 뒤 pageCount·getPageInfo 예외나 둘째 쪽 캔버스 그리기 예외·PDF 그리기 예외가 나도 메모리를 해제하고 빈 종이를 남기지 않는다', async () => {
  let pageCountFreed = 0;
  const brokenCount = makeBox({
    openDoc: async () => ({
      pageCount: () => { throw new Error('손상된 쪽표'); },
      free: () => { pageCountFreed++; },
    }),
    fallbackText: '폴백 글자',
  });
  const fb = await brokenCount.mbPvDraw('doc', new Uint8Array(HWP5_MAGIC), { name: '손상.hwp', mime: '' });
  assert.equal(pageCountFreed, 1, 'pageCount 예외 뒤 doc.free() 를 부르지 않았습니다');
  assert.equal(fb.text, '폴백 글자', 'pageCount 예외 뒤 글자 폴백으로 넘어가지 않았습니다');

  let pageInfoFreed = 0;
  const brokenInfo = makeBox({
    openDoc: async () => ({
      pageCount: () => 2,
      getPageInfo: () => { throw new Error('쪽 정보 손상'); },
      free: () => { pageInfoFreed++; },
    }),
    fallbackText: '쪽정보 폴백 글자',
  });
  const fb2 = await brokenInfo.mbPvDraw('doc', new Uint8Array(HWP5_MAGIC), { name: '손상2.hwp', mime: '' });
  assert.equal(pageInfoFreed, 1, 'getPageInfo 예외 뒤 doc.free() 를 부르지 않았습니다');
  assert.equal(fb2.text, '쪽정보 폴백 글자');

  let renderFreed = 0;
  const brokenSecondPage = makeBox({
    openDoc: async () => ({
      pageCount: () => 2,
      getPageInfo: () => JSON.stringify({ width: 794, height: 1123 }),
      renderPageToCanvas: (idx) => { if (idx === 1) throw new Error('둘째 쪽 WASM 그리기 실패'); },
      free: () => { renderFreed++; },
    }),
  });
  const got = await brokenSecondPage.mbPvDraw('doc', new Uint8Array(HWP5_MAGIC), { name: '오류.hwp', mime: '' });
  brokenSecondPage.state.mbPv = Object.assign({ i: 0, tok: 9, name: '오류.hwp', kind: 'doc', loading: false, err: '' }, got);
  const host = brokenSecondPage.document.createElement('div');
  host.parentNode = { clientWidth: 900, clientHeight: 640, scrollTop: 0, addEventListener: () => {}, removeEventListener: () => {} };
  brokenSecondPage.__els.mbPvHwp = host;
  brokenSecondPage.mbPvHwpDraw();
  assert.equal(renderFreed, 1, '둘째 쪽 그리기 실패 뒤 WASM 문서를 해제하지 않았습니다');
  assert.match(brokenSecondPage.state.mbPv.err, /그리지 못했습니다/, '빈 종이 대신 오류 안내를 띄워야 합니다');

  let pdfDestroyed = 0;
  const brokenPdf = makeBox();
  const cv = brokenPdf.document.createElement('canvas');
  cv.parentNode = { clientWidth: 900, scrollTop: 0 };
  brokenPdf.__els.mbPvCanvas = cv;
  brokenPdf.state.mbPv = {
    i: 0, tok: 3, name: '오류.pdf', kind: 'pdf', page: 1, pages: 1, loading: false, err: '',
    pdf: { getPage: async () => { throw new Error('손상된 PDF 쪽'); }, destroy: () => { pdfDestroyed++; } },
  };
  brokenPdf.mbPvPdfDraw();
  await new Promise((r) => setImmediate(r));
  assert.equal(pdfDestroyed, 1, 'PDF 그리기 실패 뒤 pdf.destroy() 를 부르지 않았습니다');
  assert.match(brokenPdf.state.mbPv.err, /그리지 못했습니다/);

  /* 이전 PDF 쪽 요청이 늦게 실패해도 이미 넘어간 현재 쪽 문서를 부수지 않는다 */
  let rejectPage1, raceDestroyed = 0;
  const racePdf = makeBox();
  const cv2 = racePdf.document.createElement('canvas');
  cv2.parentNode = { clientWidth: 900, scrollTop: 0 };
  cv2.getContext = () => ({});
  racePdf.__els.mbPvCanvas = cv2;
  racePdf.state.mbPv = {
    i: 0, tok: 4, name: '경쟁.pdf', kind: 'pdf', page: 1, pages: 2, loading: false, err: '',
    pdf: {
      getPage: (pgNo) => (pgNo === 1
        ? new Promise((_, rej) => { rejectPage1 = rej; })
        : Promise.resolve({ getViewport: ({ scale }) => ({ width: 600 * scale, height: 800 * scale }), render: () => ({ promise: Promise.resolve() }) })),
      destroy: () => { raceDestroyed++; },
    },
  };
  racePdf.mbPvPdfDraw();
  racePdf.state.mbPv.page = 2;
  racePdf.mbPvPdfDraw();
  rejectPage1(new Error('지나간 1쪽 지연 취소'));
  await new Promise((r) => setImmediate(r));
  assert.equal(raceDestroyed, 0, '이미 넘어간 이전 쪽 실패가 현재 PDF 를 닫았습니다');
  assert.equal(racePdf.state.mbPv.err, '');
});

test('⑨ 비정상적으로 큰 쪽 크기(100000×100000)가 들어와도 캔버스 픽셀 수가 8M 상한을 절대 넘지 않는다', async () => {
  const MAX_PX = 8 * 1024 * 1024;
  const b = makeBox({
    openDoc: async () => ({
      pageCount: () => 1,
      getPageInfo: () => JSON.stringify({ width: 100000, height: 100000 }),
      renderPageToCanvas: () => {},
      free: () => {},
    }),
  });
  const got = await b.mbPvDraw('doc', new Uint8Array(HWP5_MAGIC), { name: '거대문서.hwp', mime: '' });
  b.state.mbPv = Object.assign({ i: 0, tok: 11, name: '거대문서.hwp', kind: 'doc', loading: false }, got);
  const host = b.document.createElement('div');
  host.parentNode = { clientWidth: 1200, clientHeight: 800, scrollTop: 0, addEventListener: () => {}, removeEventListener: () => {} };
  b.__els.mbPvHwp = host;
  b.mbPvHwpDraw();
  const cv = host.children[0].querySelector('canvas');
  assert.ok(cv.width > 0 && cv.height > 0, '캔버스가 그려지지 않았습니다');
  assert.ok(cv.width * cv.height <= MAX_PX, `픽셀 수(${cv.width * cv.height})가 8M 상한(${MAX_PX})을 넘었습니다`);
});

test('⑩ 미리보기 창에 대화상자 접근성 속성(role=dialog·aria-modal·aria-label)·Escape 닫기·DOM 재렌더링 뒤 포커스 복귀가 있다', () => {
  const b = makeBox({ pages: 2 });
  let refocused = 0;
  b.document.querySelector = (sel) => (sel === 'button[onclick="mbAttPeek(0)"]' ? { focus: () => { refocused++; } } : null);
  b.state.mbPv = {
    i: 0, tok: 1, name: '양식.hwp', size: 10240, kind: 'doc', loading: false, hwp: {}, pages: 2, page: 1,
    _prevFocus: { isConnected: false, focus: () => { throw new Error('분리된 옛 노드에 focus 하면 안 됩니다'); } },
  };
  const html = b.mbPvHtml();
  assert.match(html, /role="dialog"[^>]*aria-modal="true"/);
  assert.match(html, /aria-label="이전 쪽"/);
  assert.match(html, /aria-label="다음 쪽"/);
  assert.match(html, /aria-label="닫기"/);
  assert.match(HTML, /if\s*\(\s*e\.key\s*===\s*'Escape'\s*\)\s*\{\s*if\s*\(\s*state\.mbPv\s*\)\s*\{\s*e\.preventDefault\(\);\s*mbPvClose\(\);\s*return;\s*\}/);
  b.mbPvClose();
  assert.equal(refocused, 1, '창을 닫은 뒤 새로 그려진 미리보기 단추로 포커스가 돌아가지 않았습니다');
});

test('⑪ 여러 쪽 PDF(19쪽 등)도 한 쪽씩 끊기지 않고 #mbPvPdf 안에 전체 쪽을 한 번에 세로 연속 스크롤로 펼치며 스크롤·쪽 이동·정리가 된다', async () => {
  const b = makeBox();
  let pdfRendered = 0, pdfDestroyed = 0, scrollHandler = null;
  const fakePdf = {
    numPages: 19,
    getPage: async (pgNo) => ({
      pageNumber: pgNo,
      getViewport: ({ scale }) => ({ width: 595 * scale, height: 842 * scale }),
      render: () => { pdfRendered++; return { promise: Promise.resolve(), cancel: () => {} }; },
    }),
    destroy: () => { pdfDestroyed++; },
  };
  b.state.mbPv = {
    i: 0, tok: 21, name: '중간보고서외.pdf', size: 1536 * 1024, kind: 'pdf',
    loading: false, err: '', pdf: fakePdf, pdfBase: { w: 595, h: 842 }, page: 1, pages: 19,
  };
  const html = b.mbPvHtml();
  assert.match(html, /id="mbPvPdf"/, 'PDF 연속 스크롤 무대(#mbPvPdf)를 그리지 않습니다');
  assert.match(html, /canvas id="mbPvCanvas"/, '첫 쪽 캔버스(#mbPvCanvas)가 없습니다');
  assert.match(html, /PDF 19쪽/, '머리줄에 PDF 전체 쪽수를 적지 않습니다');

  const stage = {
    clientWidth: 960, clientHeight: 720, scrollTop: 0,
    addEventListener: (ev, fnCb) => { if (ev === 'scroll') scrollHandler = fnCb; },
    removeEventListener: (ev) => { if (ev === 'scroll') scrollHandler = null; },
    parentNode: null,
  };
  const host = b.document.createElement('div');
  const firstCv = b.document.createElement('canvas');
  firstCv.getContext = () => ({});
  b.__els.mbPvPdf = host;
  b.__els.mbPvCanvas = firstCv;
  host.parentNode = stage;

  b.mbPvPdfDraw();
  assert.equal(host.children.length, 19, '19쪽 PDF 인데 19쪽이 한 번에 펼쳐지지 않았습니다');
  host.children.forEach((pgEl, idx) => { pgEl.offsetTop = idx * 1260; });

  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));
  assert.equal(pdfRendered, 19, '연속 스크롤 환경에서 PDF 각 쪽이 캔버스에 그려지지 않았습니다');

  const prevRenders = b.__calls.renders;
  b.mbPvPage(1);
  assert.equal(b.state.mbPv.page, 2, '다음 쪽 단추로 2쪽으로 이동하지 않았습니다');
  assert.equal(b.__calls.renders, prevRenders, '연속 스크롤 PDF 인데 쪽 이동 시 전체 창을 다시 그렸습니다');
  assert.ok(stage.scrollTop > 1000, '2쪽 위치로 스크롤이 이동하지 않았습니다');

  if (scrollHandler) {
    stage.scrollTop = 5 * 1260;
    scrollHandler();
    assert.equal(b.state.mbPv.page, 6, '스크롤 위치에 따라 현재 쪽 번호가 갱신되지 않았습니다');
  }

  b.mbPvClose();
  assert.equal(pdfDestroyed, 1, '창을 닫을 때 pdf.destroy() 가 호출되지 않았습니다');
  assert.equal(scrollHandler, null, '창을 닫을 때 스크롤 감시기가 해제되지 않았습니다');
});
