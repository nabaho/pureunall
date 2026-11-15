'use strict';
/* 메일 첨부 미리보기 팝업창 — 비율로 크게·작게 조절 + 2쪽 이상 한눈에 보기 검사 (2026-11-15)
 *
 * ■ 지키는 규칙
 *   ① 여러 쪽 PDF·한글(.hwp·.hwpx)을 PC 화면에서 열면 기본으로 «2쪽 나란히 보기»가 켜져
 *      한 화면 가로·세로 안에 최소 2쪽 전체가 잘리지 않고 한눈에 들어온다
 *   ② 비율 축소(mbPvZoomStep(-1))·확대(mbPvZoomStep(1))·직접 지정(mbPvZoomSet)·Ctrl+휠이
 *      종이 가로세로 비율을 유지한 채 크기를 줄이거나 키우고, 확대 시 캔버스 해상도도 선명하게 다시 그린다
 *   ③ 1쪽 / 2쪽 / 여러쪽 배치를 바꾸면 한 줄에 들어가는 쪽 수가 각각 1쪽·2쪽·3쪽 이상으로 바뀌며,
 *      나란히 놓인 줄에서 다음 쪽(▶)을 누르면 같은 줄에 머물지 않고 다음 줄(3–4쪽)로 넘어간다
 *   ④ 팝업창 전체창 토글(mbPvWideToggle)과 그림·엑셀·글자 첨부의 비율 조절도 함께 동작한다 */
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

function makeElem(tag) {
  const attrs = {}, listeners = {}, classes = new Set(), children = [];
  let txtVal = '';
  const el = {
    tagName: String(tag || 'div').toUpperCase(),
    style: {},
    width: 0,
    height: 0,
    value: '',
    disabled: false,
    selected: false,
    get textContent() { return txtVal; },
    set textContent(v) { txtVal = String(v == null ? '' : v); if (txtVal === '') children.length = 0; },
    children,
    options: children,
    parentNode: null,
    get className() { return Array.from(classes).join(' '); },
    set className(v) {
      classes.clear();
      String(v || '').split(/\s+/).filter(Boolean).forEach((c) => classes.add(c));
    },
    classList: {
      add: (c) => classes.add(c),
      remove: (c) => classes.delete(c),
      toggle: (c, force) => {
        const on = force === undefined ? !classes.has(c) : !!force;
        if (on) classes.add(c); else classes.delete(c);
        return on;
      },
      contains: (c) => classes.has(c),
    },
    getContext: () => ({}),
    contains: (t) => t === el || children.includes(t),
    setAttribute: (k, v) => {
      attrs[k] = String(v);
      if (k === 'class') el.className = v;
    },
    getAttribute: (k) => (k in attrs ? attrs[k] : null),
    appendChild: (c) => {
      c.parentNode = el;
      children.push(c);
      return c;
    },
    replaceChild: (newCh, oldCh) => {
      const idx = children.indexOf(oldCh);
      if (idx >= 0) {
        oldCh.parentNode = null;
        newCh.parentNode = el;
        children[idx] = newCh;
      }
      return oldCh;
    },
    addEventListener: (ev, cb) => { (listeners[ev] = listeners[ev] || []).push(cb); },
    removeEventListener: (ev, cb) => {
      if (listeners[ev]) listeners[ev] = listeners[ev].filter((x) => x !== cb);
    },
    dispatch: (ev, payload) => {
      (listeners[ev] || []).slice().forEach((cb) => cb(payload));
    },
    querySelector: (sel) => {
      if (sel === 'canvas') return children.find((x) => x.tagName === 'CANVAS') || null;
      if (sel === 'b') return children.find((x) => x.tagName === 'B') || null;
      return null;
    },
    querySelectorAll: (sel) => {
      if (sel === 'button') return children.filter((x) => x.tagName === 'BUTTON');
      return [];
    },
  };
  return el;
}

function makeEnv(opts) {
  const o = opts || {};
  const els = {};
  let dlgEl = null;
  const ctx = {
    console: { warn: () => {}, log: () => {}, error: () => {} },
    Promise, Object, Array, Number, String, Math, JSON, Uint8Array, TextDecoder, Blob,
    URL: { createObjectURL: () => 'blob:pv', revokeObjectURL: () => {} },
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
    state: { mbPv: null, mbOpen: { slug: 'IN', uid: '1', atts: [] } },
    firebase: { auth: () => ({ currentUser: { getIdToken: async () => 'tok' } }) },
    mbAttBytes: async () => new Uint8Array([1, 2, 3]),
    renderMailPage: () => {},
    window: { innerWidth: o.innerWidth || 1600, devicePixelRatio: 2 },
    document: {
      activeElement: null,
      getElementById: (id) => els[id] || null,
      querySelector: (sel) => (sel === '.mck.pvbox' ? dlgEl : null),
      createElement: (tag) => makeElem(tag),
    },
  };
  vm.createContext(ctx);
  vm.runInContext([
    'const MB_PV_ZOOM_MIN = 40, MB_PV_ZOOM_MAX = 250;',
    'const MB_PV_ZOOMS = [40, 50, 65, 75, 85, 100, 115, 130, 150, 175, 200, 250];',
    'const _mbPvLibWait = {}; let _mbPvSeq = 0; let _mbPvWide = false;',
    fn('mbPvExt'), fn('mbPvKind'), fn('mbPvLib'), fn('mbPvLibsFor'),
    fn('mbPvZoomOf'), fn('mbPvColsOf'), fn('mbPvCalcBox'), fn('mbPvApplyContentZoom'),
    fn('mbPvSyncView'), fn('mbPvZoomSet'), fn('mbPvZoomStep'), fn('mbPvColsSet'), fn('mbPvWideToggle'),
    fn('mbPvRelease'), fn('mbPvReset'), fn('mbPvClose'), fn('mbAttPeek'),
    fn('mbPvDraw'), fn('mbPvPdfDraw'), fn('mbPvHwpDraw'), fn('mbPvPage'), fn('mbPvAfter'), fn('mbPvHtml'),
  ].join('\n'), ctx);
  ctx.__els = els;
  ctx.__setDlg = (d) => { dlgEl = d; };
  return ctx;
}

function fakePdfDoc(pages, counter) {
  return {
    numPages: pages,
    getPage: async (pgNo) => ({
      pageNumber: pgNo,
      getViewport: ({ scale }) => ({ width: 595 * scale, height: 842 * scale }),
      render: () => {
        if (counter) counter.renders++;
        return { promise: Promise.resolve(), cancel: () => {} };
      },
    }),
    destroy: () => { if (counter) counter.destroyed++; },
  };
}

test('① 여러 쪽 PDF(8쪽)를 PC 에서 열면 기본 2쪽 보기가 켜져 가로·세로 안에 2쪽 전체가 한눈에 들어온다', async () => {
  const env = makeEnv({ innerWidth: 1920 });
  const stat = { renders: 0, destroyed: 0 };
  env.state.mbPv = {
    i: 0, tok: 1, name: '심의의견서(참고2)_권형하.pdf', size: 261 * 1024, kind: 'pdf',
    loading: false, err: '', pdf: fakePdfDoc(8, stat), pdfBase: { w: 595, h: 842 }, page: 1, pages: 8,
  };
  const html = env.mbPvHtml();
  assert.match(html, /class="pvseg pvcols"/, '쪽 배치 선택 단추 묶음이 없습니다');
  assert.match(html, /class="pvseg pvzoom"/, '화면 배율 조절 묶음이 없습니다');
  assert.match(html, /data-cols="2"[^>]*class="on"/, '여러 쪽 문서인데 기본값이 2쪽 보기가 아닙니다');

  const stage = makeElem('div');
  stage.clientWidth = 1380;
  stage.clientHeight = 760;
  stage.scrollTop = 0;
  const host = makeElem('div');
  const firstCv = makeElem('canvas');
  stage.appendChild(host);
  env.__els.mbPvPdf = host;
  env.__els.mbPvCanvas = firstCv;

  env.mbPvPdfDraw();
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));

  assert.equal(host.children.length, 8);
  assert.equal(host.getAttribute('data-cols'), '2');
  const w1 = parseInt(host.children[0].style.width, 10);
  const h1 = parseInt(host.children[0].style.height, 10);
  const w2 = parseInt(host.children[1].style.width, 10);
  assert.ok(w1 > 200 && w2 > 200, '쪽 너비가 비정상적입니다');
  assert.ok(w1 + w2 + 14 <= stage.clientWidth, `2쪽 너비 합(${w1 + w2 + 14})이 무대 너비(${stage.clientWidth})를 넘어 나란히 놓이지 않습니다`);
  assert.ok(h1 <= stage.clientHeight, `쪽 높이(${h1})가 무대 높이(${stage.clientHeight})를 넘어 한 쪽이 위아래로 잘립니다`);
});

test('①-2 여러 쪽 한글(.hwp) 양식도 기본 2쪽 보기로 열려 한 화면에 2쪽이 함께 들어온다', () => {
  const env = makeEnv({ innerWidth: 1600 });
  const rendered = [];
  env.state.mbPv = {
    i: 0, tok: 2, name: '사후관리보고서.hwp', size: 42 * 1024, kind: 'doc',
    loading: false, err: '', page: 1, pages: 4,
    hwpSizes: [{ w: 794, h: 1123 }, { w: 794, h: 1123 }, { w: 794, h: 1123 }, { w: 794, h: 1123 }],
    hwp: {
      pageCount: () => 4,
      renderPageToCanvas: (idx, cv, sc) => { rendered.push({ idx, sc }); },
      free: () => {},
    },
  };
  const stage = makeElem('div');
  stage.clientWidth = 1320;
  stage.clientHeight = 740;
  const host = makeElem('div');
  stage.appendChild(host);
  env.__els.mbPvHwp = host;

  env.mbPvHwpDraw();
  assert.equal(host.children.length, 4);
  assert.equal(host.getAttribute('data-cols'), '2');
  const w = parseInt(host.children[0].style.width, 10);
  const h = parseInt(host.children[0].style.height, 10);
  assert.ok(w * 2 + 14 <= stage.clientWidth, '한글 2쪽이 나란히 들어오지 않습니다');
  assert.ok(h <= stage.clientHeight, '한글 쪽 높이가 무대를 넘어 잘립니다');

  const firstCanvas = host.children[0].querySelector('canvas');
  const prevDraws = rendered.length;
  env.mbPvZoomSet(150);
  const wZoomed = parseInt(host.children[0].style.width, 10);
  assert.ok(wZoomed > w, '배율을 키웠는데 한글 쪽 크기가 커지지 않았습니다');
  assert.ok(rendered.length > prevDraws, '배율을 키웠는데 한글 캔버스를 고해상도로 다시 그리지 않았습니다');
  const swappedCanvas = host.children[0].querySelector('canvas');
  assert.notEqual(swappedCanvas, firstCanvas, '한글 배율 변경 시 오프스크린 캔버스 교체(swap)가 동작하지 않았습니다');
  assert.equal(firstCanvas.width, 0, '교체된 이전 캔버스 비트맵 메모리를 해제하지 않았습니다');

  /* 1쪽 보기 고배율(250%)에서 쪽 너비가 무대를 넘을 때 왼쪽 잘림 방지를 위해 host 폭을 쪽 폭으로 넓힌다 */
  env.mbPvColsSet(1);
  env.mbPvZoomSet(250);
  const wMax = parseInt(host.children[0].style.width, 10);
  assert.ok(wMax > stage.clientWidth, '1쪽 보기 250% 확대 시 쪽 너비가 무대보다 넓어져야 합니다');
  assert.equal(host.getAttribute('data-overflow'), '1', '고배율 가로 넘침 시 data-overflow 표시가 켜지지 않았습니다');
  assert.equal(host.style.width, wMax + 'px', '고배율에서 왼쪽 잘림을 막기 위한 host 폭 확장이 적용되지 않았습니다');
});

test('② 비율 축소(−)·확대(+)·Ctrl+마우스휠이 종이 비율을 유지하며 크기를 바꾸고 캔버스 픽셀도 다시 그린다', async () => {
  const env = makeEnv({ innerWidth: 1920 });
  const stat = { renders: 0, destroyed: 0 };
  env.state.mbPv = {
    i: 0, tok: 3, name: '보고서.pdf', size: 500 * 1024, kind: 'pdf',
    loading: false, err: '', pdf: fakePdfDoc(6, stat), pdfBase: { w: 595, h: 842 }, page: 1, pages: 6,
  };
  const dlg = makeElem('div');
  const stage = makeElem('div');
  stage.clientWidth = 1380;
  stage.clientHeight = 760;
  const host = makeElem('div');
  const firstCv = makeElem('canvas');
  stage.appendChild(host);
  dlg.querySelector = (sel) => {
    if (sel === '.pvstage') return stage;
    return null;
  };
  dlg.querySelectorAll = () => [];
  env.document.activeElement = dlg;
  env.__setDlg(dlg);
  env.__els.mbPvPdf = host;
  env.__els.mbPvCanvas = firstCv;

  env.mbPvAfter();
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));

  const baseW = parseInt(host.children[0].style.width, 10);
  const baseH = parseInt(host.children[0].style.height, 10);
  const baseRatio = baseW / baseH;
  const baseCvPx = host.children[0].querySelector('canvas').width;

  /* 축소(−): 종이 비율을 유지한 채 더 작아져 4쪽 이상이 한눈에 들어온다 */
  env.mbPvZoomStep(-1);
  env.mbPvZoomStep(-1);
  await new Promise((r) => setImmediate(r));
  const smallW = parseInt(host.children[0].style.width, 10);
  const smallH = parseInt(host.children[0].style.height, 10);
  assert.ok(smallW < baseW && smallH < baseH, '축소 단추를 눌렀는데 쪽 크기가 줄지 않았습니다');
  assert.ok(Math.abs((smallW / smallH) - baseRatio) < 0.02, '축소 뒤 종이 가로세로 비율이 깨졌습니다');

  /* 확대(+): 기준보다 크게 키우면 캔버스 픽셀 해상도도 선명하게 올라간다 */
  env.mbPvZoomSet(150);
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));
  const bigW = parseInt(host.children[0].style.width, 10);
  const bigCvPx = host.children[0].querySelector('canvas').width;
  assert.ok(bigW > baseW, '확대했는데 쪽 너비가 커지지 않았습니다');
  assert.ok(bigCvPx > baseCvPx, '확대했는데 캔버스 비트맵 해상도가 올라가지 않아 흐릿해집니다');

  /* 상·하한 방어 (최소 40% ~ 최대 250%) 및 폰(375px)·1쪽 고배율 가로 넘침 보호 */
  env.mbPvZoomSet(5);
  assert.equal(env.state.mbPv.zoom, 40, '최소 배율 하한(40%)과 선택 목록 최솟값이 일치해야 합니다');
  stage.clientWidth = 359;
  env.mbPvZoomSet(9999);
  assert.equal(env.state.mbPv.zoom, 250, '최대 배율 상한(250%)을 지켜야 합니다');
  assert.equal(host.getAttribute('data-overflow'), '1', '폰 화면 250% 확대에서 가로 넘침 시 왼쪽 잘림 방지 속성이 켜져야 합니다');
  assert.equal(host.style.width, host.children[0].style.width, '폰 화면 250% 확대에서 host 폭이 쪽 폭과 같아 왼쪽이 잘리지 않아야 합니다');
  stage.clientWidth = 1380;
  const maxCv = host.children[0].querySelector('canvas');
  assert.ok(maxCv.width * maxCv.height <= 8 * 1024 * 1024, '최대 배율에서도 캔버스 8M 픽셀 상한을 지켜야 합니다');

  /* Ctrl + 마우스 휠은 배율만 바꾸고 브라우저 전체 확대는 막는다(preventDefault) */
  env.mbPvZoomSet(100);
  let prevented = 0;
  dlg.dispatch('wheel', { ctrlKey: true, deltaY: -120, preventDefault: () => { prevented++; } });
  assert.equal(prevented, 1, 'Ctrl+휠에서 브라우저 기본 확대를 막지 않았습니다');
  assert.ok(env.state.mbPv.zoom > 100, 'Ctrl+휠 위로 굴렸는데 배율이 커지지 않았습니다');

  /* 일반 마우스 휠(Ctrl 없음)은 문서 스크롤이 되도록 막지 않는다 */
  let plainPrevented = 0;
  dlg.dispatch('wheel', { ctrlKey: false, metaKey: false, deltaY: 120, preventDefault: () => { plainPrevented++; } });
  assert.equal(plainPrevented, 0, '일반 스크롤 휠까지 막았습니다');
});

test('③ 1쪽·2쪽·여러쪽 전환과 나란히 놓인 줄 단위 쪽 이동(1–2 → 3–4)이 정확히 동작한다', async () => {
  const env = makeEnv({ innerWidth: 1920 });
  env.state.mbPv = {
    i: 0, tok: 4, name: '안건자료.pdf', size: 320 * 1024, kind: 'pdf',
    loading: false, err: '', pdf: fakePdfDoc(6), pdfBase: { w: 595, h: 842 }, page: 1, pages: 6,
  };
  const pagerB = makeElem('b');
  const prevBtn = makeElem('button');
  const nextBtn = makeElem('button');
  const pagerBar = makeElem('span');
  pagerBar.appendChild(prevBtn);
  pagerBar.appendChild(pagerB);
  pagerBar.appendChild(nextBtn);
  const modalBox = {
    querySelector: (sel) => (sel === '.pvpg' ? pagerBar : null),
  };
  const stage = makeElem('div');
  stage.clientWidth = 1380;
  stage.clientHeight = 760;
  stage.scrollTop = 0;
  stage.parentNode = modalBox;
  const host = makeElem('div');
  const firstCv = makeElem('canvas');
  stage.appendChild(host);
  env.__els.mbPvPdf = host;
  env.__els.mbPvCanvas = firstCv;

  env.mbPvPdfDraw();
  await new Promise((r) => setImmediate(r));

  const w2 = parseInt(host.children[0].style.width, 10);
  env.mbPvColsSet(1);
  assert.equal(host.getAttribute('data-cols'), '1');
  const w1 = parseInt(host.children[0].style.width, 10);
  assert.ok(w1 > w2, '1쪽 보기로 바꿨는데 2쪽 보기보다 넓어지지 않았습니다');

  env.mbPvColsSet(0);
  assert.equal(host.getAttribute('data-cols'), '0');
  const wMulti = parseInt(host.children[0].style.width, 10);
  assert.ok(wMulti * 3 + 28 <= stage.clientWidth, '여러쪽 보기에서 한 줄에 3쪽 이상 들어오지 않습니다');

  /* 다시 2쪽 보기로 돌리고 실제 2단 줄 좌표(1·2쪽 나란히, 3·4쪽 나란히, 5·6쪽 나란히)를 부여해 줄 단위 이동 확인 */
  env.mbPvColsSet(2);
  host.children.forEach((el, idx) => {
    const row = Math.floor(idx / 2), col = idx % 2;
    el.offsetTop = 14 + row * 760;
    el.offsetLeft = 140 + col * 540;
  });
  env.state.mbPv._pdfRelayout(false);
  assert.equal(pagerB.textContent, '1–2', '2쪽 나란히 보기에서 현재 줄 범위(1–2)가 표시되지 않습니다');

  env.mbPvPage(1);
  assert.equal(env.state.mbPv.page, 3, '2쪽 보기에서 ▶ 를 눌렀을 때 다음 줄(3쪽)로 넘어가지 않았습니다');
  assert.equal(pagerB.textContent, '3–4');
  assert.ok(stage.scrollTop > 700, '다음 줄 위치로 스크롤되지 않았습니다');

  env.mbPvPage(-1);
  assert.equal(env.state.mbPv.page, 1, '◀ 를 눌렀을 때 앞 줄(1쪽)로 돌아오지 않았습니다');
  assert.equal(pagerB.textContent, '1–2');
});

test('④ 팝업창 전체창 토글(mbPvWideToggle) 및 그림·표·글자 미리보기 배율 조절이 동작한다', () => {
  const env = makeEnv({ innerWidth: 1920 });
  const img = makeElem('img');
  img.clientWidth = 600;
  const tbl = makeElem('table');
  const txt = makeElem('pre');
  const stage = makeElem('div');
  stage.clientWidth = 1200;
  const wideBtn = makeElem('button');
  const dlg = makeElem('div');
  dlg.querySelector = (sel) => {
    if (sel === '.pvstage') return stage;
    if (sel === '.pvstage .pvimg') return img;
    if (sel === '.pvstage .pvsheet table') return tbl;
    if (sel === '.pvstage .pvtext') return txt;
    if (sel === '.pvwbtn') return wideBtn;
    return null;
  };
  dlg.querySelectorAll = () => [];
  env.__setDlg(dlg);

  env.state.mbPv = { i: 0, tok: 5, name: '현장사진.jpg', size: 120 * 1024, kind: 'img', url: 'blob:pv', zoom: 100, loading: false, err: '' };
  env.mbPvWideToggle();
  assert.equal(env.state.mbPv.wide, true);
  assert.equal(dlg.classList.contains('pvwide'), true, '전체창 토글 시 대화상자에 pvwide 클래스가 붙지 않습니다');

  env.mbPvZoomSet(150);
  assert.equal(img.style.width, '900px', '그림 첨부 확대 시 비율대로 너비가 늘어나지 않습니다');
  assert.ok(parseFloat(tbl.style.fontSize) > 12.5, '엑셀 표 첨부 확대 시 글자 크기가 커지지 않습니다');
  assert.ok(parseFloat(txt.style.fontSize) > 13, '글자 첨부 확대 시 글자 크기가 커지지 않습니다');

  /* CSS 에 팝업창 크기 조절(resize)과 다단 흐름 규칙이 살아 있는지 확인 */
  const pvboxRule = CSS.match(/\.mck\.pvbox\s*\{([^}]*)\}/);
  assert.ok(pvboxRule && /resize\s*:\s*both/.test(pvboxRule[1]), 'PC 팝업창 모서리 크기 조절(resize:both)이 없습니다');
});
