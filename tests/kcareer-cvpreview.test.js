'use strict';
/* 빠른 이력서 — 오른쪽 한글 미리보기 (안 A, 대표 승인 2026-09-28)
   ─────────────────────────────────────────────────────────────
   「왼쪽에서 직접 치고 오른쪽에 한글 엔진이 그린 진짜 모양이 늘 보입니다. 쪽 수는 한글 기준
    하나, PDF도 한글 문서에서 뽑습니다. 대신 화면을 열면 한글 엔진(7MB)을 곧바로 받습니다.」
   ⚠ 엔진을 곧바로 받는 것은 «이 화면이 보일 때만»이다 — 부팅 때 숨은 화면에서 그리면
     어느 화면에서나 7MB 를 받게 된다(다른 곳의 「누를 때만」 규칙은 그대로).
   ⚠ 앱의 진짜 함수를 vm 에 올리고 가짜 화면에 대고 «돌려» 본다. */
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

/* ── 가짜 화면 ── */
function 칸(id) {
  const e = {
    id, children: [], parentNode: null, style: {}, textContent: '', title: '', dataset: {},
    clientWidth: 480, clientHeight: 700, scrollTop: 0, offsetTop: 0, offsetParent: {},
    _cls: new Set(),
    classList: {
      add: (c) => e._cls.add(c), remove: (c) => e._cls.delete(c),
      contains: (c) => e._cls.has(c),
      toggle: (c, on) => { if (on === undefined ? !e._cls.has(c) : on) e._cls.add(c); else e._cls.delete(c); }
    },
    appendChild(k) { if (k.parentNode) k.parentNode.removeChild(k); k.parentNode = e; e.children.push(k); return k; },
    removeChild(k) { e.children = e.children.filter((x) => x !== k); k.parentNode = null; },
    querySelectorAll(sel) {
      const out = [];
      const walk = (n) => n.children.forEach((k) => { if (sel === 'canvas' && k.tag === 'canvas') out.push(k); walk(k); });
      walk(e); return out;
    },
    querySelector(sel) { return e.querySelectorAll(sel)[0] || null; },
    getBoundingClientRect() { return { top: e.offsetTop - (e.parentNode ? e.parentNode.scrollTop : 0), bottom: 0 }; }
  };
  Object.defineProperty(e, 'innerHTML', { set(v) { e.children.forEach((k) => { k.parentNode = null; }); e.children = []; e._html = v; }, get() { return e._html || ''; } });
  Object.defineProperty(e, 'className', { set(v) { e._cls = new Set(String(v).split(/\s+/).filter(Boolean)); }, get() { return [...e._cls].join(' '); } });
  return e;
}
function 무대(o) {
  o = o || {};
  const 칸들 = {};
  ['dm-quick', 'cvHwpBody', 'cvHwpState', 'cvHwpPgNo', 'cvPageCnt', 'cvSplit', 'cvPvBtn', 'cvHwpPane'].forEach((k) => { 칸들[k] = 칸(k); });
  if (o.active !== false) 칸들['dm-quick'].classList.add('active');
  if (o.hidden) 칸들['dm-quick'].offsetParent = null;
  const 저장 = Object.assign({}, o.ls || {});
  const 부름 = { render: 0, build: 0, svg: 0, print: 0, open: 0, count: 0, soon: 0, 시계: [] };
  const 몸 = 칸('body');
  const 창 = { document: { write() {}, open() {}, close() {} }, closed: false, close() { 창.closed = true; }, focus() {}, print() { 부름.print++; } };
  const ctx = {
    console: { warn() {} }, Math, String, Number, Array, Date, JSON, parseInt, Promise, Object,
    localStorage: { getItem: (k) => (k in 저장 ? 저장[k] : null), setItem: (k, v) => { 저장[k] = String(v); }, removeItem: (k) => { delete 저장[k]; } },
    document: {
      getElementById: (id) => 칸들[id] || null,
      createElement: (tag) => { const e = 칸('new'); e.tag = tag; return e; },
      body: 몸
    },
    setTimeout: (f, ms) => { 부름.시계.push({ f, ms }); return 부름.시계.length; },
    clearTimeout: () => {},
    _safe: (f) => { try { return f(); } catch (e) { return null; } },
    toast: () => {},
    _hwpEngineReady: !!o.ready,
    _cvBuildHwpx: () => { 부름.build++; if (o.buildFail) throw new Error('x'); return { bytes: new Uint8Array([1]), name: '이력서_가.hwpx' }; },
    PureunHwp: {
      renderPreview: async (box) => {
        부름.render++;
        if (o.renderFail) throw new Error('엔진 없음');
        for (let i = 0; i < (o.pages || 3); i++) { const c = 칸('cv'); c.tag = 'canvas'; c.offsetTop = 12 + i * 1000; box.appendChild(c); }
        if (o.duringRender) o.duringRender(ctx, 칸들);
        return { pageCount: o.pages || 3 };
      }
    },
    KcareerSvgText: { printHtml: () => '<html></html>' },
    _hwpSvgPages: async (v) => { 부름.svg++; 부름.svgArg = v; return o.svgFail ? null : ['<svg/>']; },
    window: { open: () => { 부름.open++; 부름.svgBeforeOpen = 부름.svg; return o.popupBlocked ? null : 창; }, print: () => { 부름.print++; 부름.screenPrint = (부름.screenPrint || 0) + 1; } },
    piObj: () => ({}), set: () => {}, _logCv: () => {},
    cvHwpCount: () => { 부름.count++; },
    cvRenderGuide: () => { 부름.guide = (부름.guide || 0) + 1; }
  };
  ctx.window.PureunHwp = ctx.PureunHwp; ctx.window.KcareerSvgText = ctx.KcareerSvgText;
  vm.createContext(ctx);
  const 코드 = [
    SRC.match(/var CV_PV_KEY=[^\n]*\n/)[0],
    SRC.match(/var _cvPvT=null[^\n]*\n/)[0],
    ...['function cvPvOn(', 'function cvPvActive(', 'function cvPvSoon(', 'function _cvPvState(', 'function cvPvUI(',
      'function cvPvToggle(', 'function _cvPvFit(', 'function _cvPvPageNo(', 'function cvPvPage(', 'function _cvPvBadge(',
      'async function cvPvRender(', 'function printCV('].map(떼기)
  ].join('\n');
  vm.runInContext(코드, ctx);
  return { ctx, 칸들, 부름, 저장, 몸, 창, 돌려: (s) => vm.runInContext(s, ctx) };
}
const 쉼 = () => new Promise((r) => setImmediate(r));

test('★★★ 보일 때 곧바로 그리고, 쪽 수 배지는 «한글 값 하나»다', async () => {
  const m = 무대({ pages: 4 });
  await m.돌려('cvPvRender()');
  assert.equal(m.부름.render, 1, '★★★ 한글 엔진으로 안 그립니다');
  assert.equal(m.칸들.cvHwpBody.querySelectorAll('canvas').length, 4, '★★ 그린 쪽이 오른쪽 칸으로 안 옮겨졌습니다');
  assert.equal(m.칸들.cvPageCnt.textContent, 'A4 4장 · 한글', '★★ 배지가 한글 값이 아닙니다');
  assert.equal(m.칸들.cvHwpPgNo.textContent, '1 / 4', '쪽 번호가 안 매겨집니다');
  m.돌려('cvPvPage(1)');
  assert.equal(m.칸들.cvHwpPgNo.textContent, '2 / 4', '▶ 가 다음 쪽으로 안 갑니다');
  assert.equal(m.칸들.cvHwpBody.scrollTop, 1000, '▶ 가 그 쪽으로 안 옮깁니다');
  m.돌려('cvPvPage(9)');
  assert.equal(m.칸들.cvHwpPgNo.textContent, '4 / 4', '끝 쪽을 넘어갑니다');
  assert.equal(m.몸.children.length, 0, '★ 보이지 않는 그림칸을 안 치웠습니다 — 칠 때마다 쌓입니다');
  assert.equal(m.ctx._hwpEngineReady, true);
});

test('★★★ 숨은 화면·꺼 둔 때는 7MB 엔진을 «안» 받는다', async () => {
  for (const o of [{ active: false }, { hidden: true }, { ls: { kc_cv_pv_off: '1' } }]) {
    const m = 무대(o);
    await m.돌려('cvPvRender()');
    m.돌려('cvPvSoon()');
    assert.equal(m.부름.render, 0, '★★★ 안 보이는데 엔진을 받았습니다: ' + JSON.stringify(o));
    assert.equal(m.부름.시계.length, 0, '★★ 안 보이는데 그릴 예약을 걸었습니다: ' + JSON.stringify(o));
  }
});

test('★★ 치고 «1초» 잠잠해진 뒤 그린다 — 칠 때마다 지으면 끊긴다', () => {
  const m = 무대();
  m.돌려('cvPvSoon()');
  assert.equal(m.부름.render, 0, '★★ 기다리지 않고 곧바로 그립니다');
  assert.equal(m.부름.시계.length, 1);
  assert.ok(m.부름.시계[0].ms >= 800 && m.부름.시계[0].ms <= 1500, '잠잠해질 때를 기다리지 않습니다(' + m.부름.시계[0].ms + ')');
});

test('★★ 겹쳐 돌지 않고, 도는 사이 바뀐 것은 «끝난 뒤 한 번 더» 그린다', async () => {
  let m2 = null;
  const m = 무대({ duringRender: (ctx) => { m2 = vm.runInContext('cvPvRender()', ctx); } });
  await m.돌려('cvPvRender()');
  await m2;
  assert.equal(m.부름.render, 1, '★★ 도는 중에 또 그려 겹쳤습니다');
  assert.ok(m.부름.시계.length >= 1, '★★ 도는 사이 친 것이 미리보기에 영영 안 나옵니다');
  assert.equal(m.ctx._cvPvBusy, false, '★★ 빗장을 안 풀었습니다 — 다시는 안 그립니다');
});

test('★★ 못 그리면 «조용히» 넘기지 않는다 — 빗장도 푼다', async () => {
  const m = 무대({ renderFail: true });
  await m.돌려('cvPvRender()');
  assert.match(m.칸들.cvHwpState.textContent, /그리지 못했습니다/, '★★ 빈 칸만 남습니다 — 고장으로 읽힙니다');
  assert.equal(m.ctx._cvPvBusy, false);
  assert.equal(m.몸.children.length, 0, '보이지 않는 그림칸이 남았습니다');
  const m2 = 무대({ buildFail: true });
  await m2.돌려('cvPvRender()');
  assert.match(m2.칸들.cvHwpState.textContent, /못 만들었습니다/);
  assert.equal(m2.부름.render, 0);
});

test('★ 그리는 사이 화면을 떠나면 끼우지 않는다', async () => {
  const m = 무대({ duringRender: (ctx, 칸들) => { 칸들['dm-quick'].classList.remove('active'); } });
  await m.돌려('cvPvRender()');
  assert.equal(m.칸들.cvHwpBody.querySelectorAll('canvas').length, 0, '★ 떠난 화면에 그림을 끼웠습니다');
});

test('★★ 끄기·켜기 — 기억하고, 끄면 그림을 비우고 옛 배지 길로 돌아간다', async () => {
  const m = 무대();
  await m.돌려('cvPvRender()');
  m.돌려('cvPvToggle()');
  assert.equal(m.저장.kc_cv_pv_off, '1', '★★ 끈 것을 기억하지 않습니다 — 다시 열면 또 7MB');
  assert.ok(m.칸들.cvSplit.classList.contains('pv-off'), '칸이 안 접힙니다');
  assert.equal(m.칸들.cvHwpBody.querySelectorAll('canvas').length, 0, '★ 끄고도 큰 그림을 쥐고 있습니다');
  assert.match(m.칸들.cvPvBtn.textContent, /켜기/);
  assert.equal(m.부름.guide, 1, '★ 끈 뒤 배지를 옛 길로 다시 안 그립니다 — 한글 값이 낡은 채 남습니다');
  m.돌려('cvPvToggle()');
  assert.equal(m.저장.kc_cv_pv_off, undefined, '켠 것을 기억하지 않습니다');
  assert.ok(!m.칸들.cvSplit.classList.contains('pv-off'));
  await 쉼();
  assert.equal(m.부름.render, 2, '★ 다시 켜도 안 그립니다');
});

test('★★★ 🖨 PDF 는 «한글 문서에서» — 창을 먼저 열고, 못 하면 화면 인쇄로 물러선다', async () => {
  const m = 무대();
  m.돌려('printCV()');
  assert.equal(m.부름.open, 1);
  assert.equal(m.부름.svgBeforeOpen, 0, '★★ 기다린 뒤에 창을 엽니다 — 팝업으로 막힙니다');
  await 쉼(); await 쉼();
  assert.equal(m.부름.svg, 1, '★★★ 한글 문서에서 안 뽑습니다');
  assert.equal(m.부름.svgArg && m.부름.svgArg.name, '이력서_가.hwpx', '★★ 큰 창 문서를 뽑습니다 — 빠른 이력서가 아닙니다');
  assert.ok(!m.부름.screenPrint, '★ 한글 길이 됐는데 화면 인쇄도 했습니다');
  const m2 = 무대({ svgFail: true });
  m2.돌려('printCV()'); await 쉼(); await 쉼();
  assert.equal(m2.부름.screenPrint, 1, '★★★ 못 뽑으면 PDF 가 아예 막힙니다');
  assert.equal(m2.창.closed, true, '빈 창을 남겼습니다');
  const m3 = 무대({ popupBlocked: true });
  m3.돌려('printCV()');
  assert.equal(m3.부름.screenPrint, 1, '★ 팝업이 막히면 아무 일도 안 납니다');
});

test('★★ 배지 길 — 미리보기가 켜져 있으면 cvRenderGuide 는 한 번 더 세지 않는다', () => {
  const g = 떼기('function cvRenderGuide(');
  const i켜짐 = g.indexOf('cvPvActive()'), i셈 = g.indexOf('cvHwpCount();');
  assert.ok(i켜짐 > 0 && i셈 > i켜짐, '★★ 미리보기 갈래가 없거나 옛 셈 뒤에 있습니다 — 같은 문서를 두 번 짓습니다');
  const 갈래 = g.slice(i켜짐, g.indexOf('}', g.indexOf('return;', i켜짐)));
  assert.match(갈래, /cvPvSoon\(\)/, '★★ 미리보기를 다시 그리게 안 합니다');
  assert.match(갈래, /return;/, '★ 옛 셈으로 흘러 내려갑니다');
});

test('★★ 이 탭을 열 때 곧바로 그린다 — 그리고 탭 «안»에서만', () => {
  const t = 떼기('function rhTab(');
  assert.match(t, /if\(tabId==='dm-quick'\)\{ _safe\(cvPvUI\); _safe\(function\(\)\{ if\(cvPvActive\(\)\) cvPvRender\(\); \}\); \}/,
    '★★ 빠른 이력서를 열어도 오른쪽이 비어 있습니다');
});

test('★ 오른쪽 칸은 #cvSheet «밖» — 안에 두면 지워지고 한글 문서에도 들어간다', () => {
  const i시트 = SRC.indexOf('<div id="cvSheet"'), i칸 = SRC.indexOf('<aside class="cv-hwp-pane" id="cvHwpPane"');
  const i시트끝 = SRC.indexOf('</div>', i시트);
  assert.ok(i칸 > i시트끝, '★ 미리보기 칸이 시트 안에 있습니다');
  assert.match(SRC, /\.cv-split:not\(\.pv-off\) \.cv-pnum\{display:none\}/, '★★ 왼쪽 「n / N 쪽」이 남아 쪽 수가 둘로 보입니다');
  assert.match(SRC, /@media\(max-width:1279px\)\{\s*\.cv-split\{grid-template-columns:minmax\(0,1fr\)\}/, '★ 좁은 화면에서 안 쌓입니다');
  assert.match(SRC, /id="cvPvBtn" onclick="cvPvToggle\(\)"/, '끄는 단추가 없습니다');
});
