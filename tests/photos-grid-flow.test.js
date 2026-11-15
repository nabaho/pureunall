/* 사진첩 — PC 격자: 날짜 묶음을 옆으로 이어 붙인다 (대표 승인 2026-11-08 「안①로 진행」)
 *
 * 까닭: 날짜마다 새 줄로 시작해서, 하루 1~3장인 날은 그 줄의 나머지가 통째로 비었다
 *       (지어낸 자료 1280px 실측 — 칸 자리의 59%, 1600px 은 66% 가 빈칸).
 * 고침: 날짜 묶음마다 상자(.dgrp)로 감싸고 PC(900px 이상)에서만 한 줄에 흘린다.
 *       날짜 줄·✓·차례·폰 화면은 그대로다.
 *
 * ⚠ renderGrid 는 «실제 함수를 떠서 돌린다» — 글자만 찾는 검사는 기능을 꺼도 초록이다
 *   (STATUS.md 「되풀이된 실수 ②」). 바깥 부품만 가짜로 대신한다.
 * ⚠ 값(132px·6px)은 «규칙»이다 — 칸 폭이 CSS 격자와 같아야 줄 끝이 어긋나지 않는다. 검사고정-허용: 칸 최소 폭·틈은 두 곳이 같아야 하는 규칙
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn.js');
const { stripJs } = require('./strip-comments.js');

const RAW = fs.readFileSync(path.join(__dirname, '..', 'pu-photos.html'), 'utf8');
const CSS = (RAW.match(/<style[^>]*>[\s\S]*?<\/style>/g) || []).join('\n').replace(/\/\*[\s\S]*?\*\//g, '');

const DAY = 864e5;
const NOON = new Date(2026, 10, 8, 12, 0, 0).getTime();

/* vm 안의 «지금» — 진짜 오늘 날짜를 쓰지 않는다.
   ⚠ dayLabel 은 new Date() 로 «오늘»을 가려 「(오늘)」을 붙인다. vm 안의 Date 는 «따로»라서 안 박으면 진짜 지금을 써,
     시험을 만든 날(2026-11-08)이 지나자마자 날짜 줄 시험이 빨개졌다(2026-11-09). 사진 시각(NOON)과 같은 시계로 박아 둔다. */
class FixedDate extends Date {
  constructor(...a) { if (a.length) super(...a); else super(NOON); }
  static now() { return NOON; }
}

/* 가짜 격자 — innerHTML 만 받는다 */
function makeCtx(opts) {
  opts = opts || {};
  const grid = { innerHTML: '' };
  const empty = { style: {} };
  const ctx = {
    gridSort: opts.sort || 'new',
    gridRenderLimit: 0, _gridHtml: null,
    gridItems: [], gridYears: [], gridQ: '', kindTab: 'all', oldOnly: false, needOnly: false,
    gridOwner: 'me', ALL_OWNERS: '__all__', NO_TITLE: '제목을 못 읽음', KIND_TABS: [{ key: 'all', label: '전체' }],
    GRAB_TAG: '', DRAG_TIP: '', selected: new Set(),
    fitCalls: 0,
    Date: FixedDate,
    $: function (id) { return id === 'grid' ? grid : (id === 'empty' ? empty : null); },
    shownItems: function () { return opts.items || []; },
    resetGridRenderLimit: function () { ctx.gridRenderLimit = opts.limit || 9999; },
    renderKindTabs: function () {}, renderFolders: function () {}, renderGridBar: function () {}, renderSortSeg: function () {},
    customTabLabel: function (k) { return k; },
    titleKey: function (it) { return it.title || ctx.NO_TITLE; },
    photoTime: function (it) { return it.t; },
    idsOf: function (it) { return it.pages || [it.id]; },
    esc: function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); },
    safeSrc: function (s) { return s || ''; },
    laneOf: function () { return 'doc'; }, needsCheck: function () { return false; },
    readHoldMine: function () { return false; }, readWaitOf: function () { return false; },
    readingThis: function () { return false; }, isUsed: function () { return false; }, usedWhere: function () { return ''; },
    sharedByName: function () { return ''; }, checkWhy: function () { return ''; }, docLabel: function () { return ''; },
    docTitle: function () { return ''; },
    fitGridCols: function () { ctx.fitCalls++; },
  };
  vm.createContext(ctx);
  vm.runInContext(cutFn(RAW, 'function dayKey(') + '\n' + cutFn(RAW, 'function dayLabel(') + '\n' + cutFn(RAW, 'function renderGrid('), ctx);
  ctx.grid = grid;
  return ctx;
}

function photo(id, dayAgo, extra) {
  return Object.assign({ id: id, t: NOON - dayAgo * DAY, thumb: '', meta: { kind: 'photo' } }, extra || {});
}

/* 묶음 상자들을 «글자 그대로» 읽어 낸다 — 짝이 맞는 마크업이어야 한다 */
function groups(html) {
  const out = [];
  const re = /<div class="dgrp( wide)?" data-n="(\d+)">([\s\S]*?)(?=<div class="dgrp|<\/div><\/div><\/div>|$)/g;
  let m;
  while ((m = re.exec(html))) {
    out.push({
      wide: !!m[1], n: Number(m[2]),
      cells: (m[3].match(/<div class="cell[ "]/g) || []).length,
      label: (m[3].match(/<b title="[^"]*">([^<]*)<\/b>/) || [])[1],
    });
  }
  return out;
}
const count = (s, re) => (s.match(re) || []).length;

/* ══ ① 그리기 — 묶음 상자가 날짜마다 서고, 짝이 맞는다 ══ */

test('★★ 날짜마다 묶음 상자가 서고 data-n 은 «그 묶음에서 그린 칸 수»다', () => {
  const items = [photo('a', 0), photo('b', 0), photo('c', 0), photo('d', 1), photo('e', 3), photo('f', 3)];
  const c = makeCtx({ items: items });
  c.renderGrid();
  const g = groups(c.grid.innerHTML);
  assert.equal(g.length, 3, '★★ 날짜 셋인데 묶음 상자가 ' + g.length + '개 — 짧은 날을 옆에 붙일 수가 없습니다');
  assert.deepEqual(g.map(x => x.n), [3, 1, 2], '★★ data-n 이 칸 수와 다릅니다 — 묶음 폭이 틀어집니다');
  assert.deepEqual(g.map(x => x.n), g.map(x => x.cells), '★★ data-n 과 실제 그린 칸 수가 다릅니다');
  assert.match(c.grid.innerHTML, /^<div class="dflow">/, '★ 묶음 상자들을 흘려 담는 흐름 상자(.dflow)가 맨 바깥에 없습니다');
});

test('★★ 마크업의 여닫는 짝이 맞는다 — 안 맞으면 날짜 줄이 엉뚱한 상자 안에 들어간다', () => {
  [[], [photo('a', 0)], [photo('a', 0), photo('b', 2), photo('c', 2)]].forEach(function (items) {
    const c = makeCtx({ items: items });
    c.renderGrid();
    const h = c.grid.innerHTML;
    if (!items.length) { assert.equal(h, '', '비었을 때는 아무것도 그리지 않습니다'); return; }
    assert.equal(count(h, /<div[ >]/g), count(h, /<\/div>/g),
      '★★ <div> ' + count(h, /<div[ >]/g) + '개 / </div> ' + count(h, /<\/div>/g) + '개 — 짝이 안 맞습니다(' + items.length + '장)');
  });
});

test('★★ 날짜 줄(✓·날짜·장수)은 그대로 — 묶음 상자 첫머리에 한 번씩 선다', () => {
  const items = [photo('a', 0), photo('b', 1), photo('c', 1)];
  const c = makeCtx({ items: items });
  c.renderGrid();
  const h = c.grid.innerHTML;
  assert.equal(count(h, /<div class="day"><button class="dayck"/g), 3 - 1, '★ 날짜 줄이 날짜마다 하나씩 아닙니다');
  assert.match(h, /<div class="dgrp" data-n="1"><div class="day"><button class="dayck"/, '★★ 날짜 줄이 묶음 상자의 첫 자식이 아닙니다');
  assert.match(h, /<span>2장<\/span>/, '★ 장수 표시가 사라졌습니다');
  assert.match(h, /onclick="toggleDay\('/, '★★ 「이 날 전부 고르기」 단추가 사라졌습니다');
});

test('★ 같은 날이 떨어져 나오면 «다른 묶음»이다 — 날짜 줄을 그리는 판정과 같은 셈', () => {
  /* 제목순에서는 같은 제목이 떨어져 나올 수 있다 — 머리 줄이 두 번 서면 상자도 두 개여야 한다 */
  const items = [photo('a', 0, { title: 'X' }), photo('b', 0, { title: 'Y' }), photo('c', 0, { title: 'X' })];
  const c = makeCtx({ items: items, sort: 'title' });
  c.renderGrid();
  const g = groups(c.grid.innerHTML);
  assert.equal(g.length, count(c.grid.innerHTML, /<div class="day">/g),
    '★★ 날짜(제목) 줄 수와 묶음 상자 수가 다릅니다 — 상자에 줄이 둘 들어갑니다');
  assert.deepEqual(g.map(x => x.n), [1, 1, 1]);
});

test('★★ 접힌 문서는 «칸 하나»로 센다 — 여섯 쪽이어도 data-n 은 1', () => {
  const items = [photo('a', 0, { pages: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6'] })];
  const c = makeCtx({ items: items });
  c.renderGrid();
  const g = groups(c.grid.innerHTML);
  assert.equal(g[0].n, 1, '★★ 장 수(6)로 넣으면 묶음 폭이 여섯 칸이 되어 빈 자리가 생깁니다');
  assert.match(c.grid.innerHTML, /<span>6장<\/span>/, '날짜 줄의 «장» 수는 여섯 그대로');
});

test('★ 폰은 60장씩 끊어 그린다 — 마지막 묶음의 data-n 은 그려진 칸 수', () => {
  const items = [photo('a', 0), photo('b', 0), photo('c', 0), photo('d', 0)];
  const c = makeCtx({ items: items, limit: 2 });
  c.renderGrid();
  const g = groups(c.grid.innerHTML);
  assert.equal(g.length, 1);
  assert.equal(g[0].n, 2, '★ 안 그린 칸까지 세면 묶음 폭이 실제보다 넓습니다');
  assert.equal(g[0].cells, 2);
  assert.match(c.grid.innerHTML, /<span>4장<\/span>/, '날짜 줄 장수는 걸러진 «전부»로 센다(기존 규칙)');
  assert.match(c.grid.innerHTML, /id="gridMore"/, '「사진 더 보기」 단추가 사라졌습니다');
});

test('★ 「제목을 못 읽음」 묶음만 한 줄을 통째로 쓴다(.wide) — 안내 글이 길다', () => {
  const items = [photo('a', 0, { title: '' }), photo('b', 0, { title: '사업자등록증' })];
  const c = makeCtx({ items: items, sort: 'title' });
  c.renderGrid();
  const g = groups(c.grid.innerHTML);
  const wide = g.filter(x => x.wide);
  assert.equal(wide.length, 1, '★ 안내 글이 긴 묶음이 한 줄을 안 씁니다');
  assert.equal(wide[0].label, '제목을 못 읽음');
  const dateMode = makeCtx({ items: [photo('a', 0)] });
  dateMode.renderGrid();
  assert.equal(groups(dateMode.grid.innerHTML).filter(x => x.wide).length, 0, '날짜순에는 .wide 가 없어야 합니다');
});

test('★★ 칸 폭을 맞추는 함수를 «그린 뒤마다» 부른다 — 같은 글자라 건너뛰어도 폭은 바뀌었을 수 있다', () => {
  const fn = stripJs(cutFn(RAW, 'function renderGrid('));
  const skip = fn.indexOf('_gridHtml = html;');
  const fit = fn.indexOf('fitGridCols()');
  assert.ok(skip > 0 && fit > skip, '★★ fitGridCols() 가 «건너뛰는 줄» 뒤(밖)에 있어야 합니다');
  assert.ok(!/if \(_gridHtml !== html\) \{[^}]*fitGridCols/.test(fn), '★★ 건너뛰는 괄호 «안»에 넣으면 폭이 바뀌어도 안 맞춥니다');
  /* 실제로 불리는가 */
  const c = makeCtx({ items: [photo('a', 0)] });
  c.renderGrid();
  assert.equal(c.fitCalls, 1, '★★ 그린 뒤 칸 폭을 안 맞춥니다');
});

/* ══ ② 칸 폭 — 실제 함수를 돌려 수를 본다 ══ */

function fitCtx(width, ns) {
  const groupsEl = ns.map(function (n) {
    const props = {};
    return { getAttribute: function () { return String(n); }, style: { setProperty: function (k, v) { props[k] = v; } }, props: props };
  });
  const flowProps = {};
  const flow = {
    clientWidth: width,
    style: { setProperty: function (k, v) { flowProps[k] = v; } },
    querySelectorAll: function () { return groupsEl; },
    props: flowProps,
  };
  const ctx = { $: function () { return { querySelector: function () { return flow; } }; } };
  vm.createContext(ctx);
  vm.runInContext(
    RAW.match(/^const GRID_CELL_MIN_PC = \d+;$/m)[0] + '\n' + RAW.match(/^const GRID_CELL_GAP = \d+;$/m)[0] + '\n'
    + cutFn(RAW, 'function gridColsFor(') + '\n' + cutFn(RAW, 'function fitGridCols('), ctx);
  return { ctx: ctx, flow: flow, groups: groupsEl };
}

test('★★ 한 줄 칸 수를 폭에서 구해, 칸 폭은 줄에 꽉 차게 나누고 묶음은 칸 수를 넘지 않는다', () => {
  const t = fitCtx(1000, [3, 1, 20]);
  t.ctx.fitGridCols();
  /* 1000px: 칸 132 + 틈 6 → (1000+6)/138 = 7칸 → 칸 폭 (1000 − 6×6)/7 */
  assert.equal(Number(t.flow.props['--cw'].replace('px', '')).toFixed(3), ((1000 - 36) / 7).toFixed(3),
    '★★ 칸 폭이 줄에 꽉 차지 않습니다 — 줄 끝이 들쭉날쭉해집니다');
  assert.deepEqual(t.groups.map(g => g.props['--n']), ['3', '1', '7'],
    '★★ 묶음 칸 수는 «그 묶음 칸 수»와 «한 줄 칸 수» 중 작은 값이어야 합니다');
});

test('★★ 칸이 한 줄에 하나도 안 들어가는 좁은 폭에서도 최소 한 칸', () => {
  const t = fitCtx(90, [5]);
  t.ctx.fitGridCols();
  assert.equal(t.groups[0].props['--n'], '1', '★ 폭이 좁다고 0칸이 되면 CSS 격자가 깨집니다');
});

test('★★ 폭이 0(격자가 숨음)이면 건드리지 않는다 — 0 으로 나눠 칸이 한 줄에 하나씩 서는 것을 막는다', () => {
  const t = fitCtx(0, [3]);
  t.ctx.fitGridCols();
  assert.equal(t.flow.props['--cw'], undefined, '★★ 숨었을 때 칸 폭을 넣으면 다시 보여도 틀린 값이 남습니다');
  assert.equal(t.groups[0].props['--n'], undefined);
});

test('★ 격자가 아직 안 그려졌으면(.dflow 없음) 아무 일도 안 한다', () => {
  const ctx = { $: function () { return { querySelector: function () { return null; } }; } };
  vm.createContext(ctx);
  vm.runInContext(RAW.match(/^const GRID_CELL_MIN_PC = \d+;$/m)[0] + '\n' + RAW.match(/^const GRID_CELL_GAP = \d+;$/m)[0] + '\n'
    + cutFn(RAW, 'function gridColsFor(') + '\n' + cutFn(RAW, 'function fitGridCols('), ctx);
  assert.doesNotThrow(function () { ctx.fitGridCols(); });
});

/* 폭을 지켜보는 덩어리를 «떠서 돌린다» — 가짜 ResizeObserver·그림 차례(requestAnimationFrame)로.
   ⚠ 미리보기 창이 숨겨져 있으면 진짜 둘이 아예 안 돈다(2026-11-08 실측: 상관없는 상자에 건 것도
     2초 넘게 안 돎) — 그래서 «창 크기를 바꿔 보는 확인»은 증거가 못 되고, 이 검사가 그 몫을 한다. */
function watchCtx() {
  const calls = { fit: 0, ro: [], rafQ: [], observed: null };
  const gridEl = { id: 'grid' };
  const ctx = {
    calls: calls,
    document: { getElementById: function (id) { return id === 'grid' ? gridEl : null; } },
    ResizeObserver: function (cb) { calls.cb = cb; this.observe = function (el) { calls.observed = el; }; },
    requestAnimationFrame: function (f) { calls.rafQ.push(f); },
    fitGridCols: function () { calls.fit++; },
    gridEl: gridEl,
  };
  vm.createContext(ctx);
  const start = RAW.lastIndexOf('try {', RAW.indexOf('let gridFitW = -1;'));
  const end = RAW.indexOf('function showMorePhotos(');
  assert.ok(start > 0 && end > start, '폭을 지켜보는 덩어리를 찾지 못했습니다');
  vm.runInContext(RAW.slice(start, end), ctx);
  ctx.flush = function () { const q = calls.rafQ.splice(0); q.forEach(function (f) { f(); }); };
  ctx.resize = function (w) { calls.cb([{ contentRect: { width: w } }]); };
  return ctx;
}

test('★★ 격자(#grid)의 폭을 지켜본다 — 창·왼쪽 칸 접기로 폭이 바뀌면 알아야 한다', () => {
  const w = watchCtx();
  assert.equal(w.calls.observed, w.gridEl, '★★ 격자 폭을 지켜보는 곳이 없습니다 — 창을 키우거나 줄여도 묶음 폭이 안 따라갑니다');
});

test('★★ 폭이 바뀌면 «다음 그림 차례»에 칸 폭을 다시 맞춘다 — 그 자리에서 바로 맞추지 않는다', () => {
  const w = watchCtx();
  w.resize(900);
  assert.equal(w.calls.fit, 0, '★★ 지켜보는 중에 바로 맞추면 높이가 바뀌어 「ResizeObserver loop」 오류가 장애 알림으로 올라갑니다');
  w.flush();
  assert.equal(w.calls.fit, 1, '★★ 폭이 바뀌었는데 칸 폭을 안 맞춥니다');
  w.resize(700); w.flush();
  assert.equal(w.calls.fit, 2, '★ 두 번째 바뀜도 따라가야 합니다');
});

test('★★ 폭이 그대로면 다시 맞추지 않는다 — 높이만 바뀐 것에 또 반응하면 끝없이 돈다', () => {
  const w = watchCtx();
  w.resize(900); w.flush();
  w.resize(900); w.flush();
  w.resize(900.4); w.flush();   // 같은 폭의 소수점 떨림
  assert.equal(w.calls.fit, 1, '★★ 같은 폭인데 ' + w.calls.fit + '번 맞췄습니다');
});

test('★ 숨었다(폭 0) 다시 보이면 맞춘다 — 0 일 때의 방어는 fitGridCols 안에 있으므로 여기서는 부른다', () => {
  const w = watchCtx();
  w.resize(0); w.flush();
  w.resize(965); w.flush();
  assert.equal(w.calls.fit, 2, '★★ 설정 화면에 갔다 돌아왔는데 칸 폭을 다시 안 맞춥니다');
});

test('★ ResizeObserver 가 없는 브라우저에서는 조용히 넘어간다 — 격자는 예전 폭(최소 칸 폭)으로 그려진다', () => {
  const ctx = { document: { getElementById: function () { return {}; } }, fitGridCols: function () {} };
  vm.createContext(ctx);
  const start = RAW.lastIndexOf('try {', RAW.indexOf('let gridFitW = -1;'));
  const end = RAW.indexOf('function showMorePhotos(');
  assert.doesNotThrow(function () { vm.runInContext(RAW.slice(start, end), ctx); });
});

/* ══ ③ 꾸밈 — PC 에서만, 칸 크기는 CSS 격자와 같다 ══ */

test('★★ 칸 최소 폭·틈은 CSS 격자(PC)와 «같다» — 다르면 줄 끝이 어긋난다', () => {
  const minPc = Number(RAW.match(/^const GRID_CELL_MIN_PC = (\d+);$/m)[1]);
  const gap = Number(RAW.match(/^const GRID_CELL_GAP = (\d+);$/m)[1]);
  const pc = CSS.match(/@media \(min-width:900px\)\{\s*#grid \.cells\{grid-template-columns:repeat\(auto-fill,minmax\((\d+)px,1fr\)\)\}/);
  assert.ok(pc, 'PC 격자(minmax) 규칙을 못 찾았습니다');
  assert.equal(Number(pc[1]), minPc, '★★ CSS 칸 최소 폭(' + pc[1] + ')과 코드(' + minPc + ')가 다릅니다');
  const base = CSS.match(/#grid \.cells\{display:grid;grid-template-columns:[^;]*;gap:(\d+)px\}/);
  assert.ok(base, '격자 기본 규칙을 못 찾았습니다');
  assert.equal(Number(base[1]), gap, '★★ CSS 칸 사이 틈(' + base[1] + ')과 코드(' + gap + ')가 다릅니다');
});

test('★★ 이어 붙이기 꾸밈은 «900px 이상»에만 걸린다 — 폰 격자는 예전 그대로', () => {
  /* 묶음 상자 규칙(.dflow·.dgrp 의 display·width·flex)이 @media (min-width:900px) 밖에 나오면 폰 모양이 바뀐다 */
  const outside = CSS.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');
  assert.ok(!/#grid \.dflow/.test(outside), '★★ .dflow 꾸밈이 미디어 밖에 있습니다 — 폰에서도 옆으로 흐릅니다');
  assert.ok(!/#grid \.dgrp(?!:first-child)[^{]*\{/.test(outside.replace(/#grid \.dgrp:first-child \.day\{margin-top:\d+px\}/g, '')),
    '★★ .dgrp 꾸밈이 미디어 밖에 있습니다 — 폰에서도 묶음이 줄어듭니다');
  const pc = CSS.match(/@media \(min-width:900px\)\{\s*#grid \.dflow\{[^}]*\}[\s\S]*?\n\}/);
  assert.ok(pc, '★★ PC 이어 붙이기 규칙 덩어리를 못 찾았습니다');
  assert.match(pc[0], /#grid \.dflow\{display:flex;flex-wrap:wrap/, '★ 한 줄에 흘러 담지 않습니다');
  assert.match(pc[0], /#grid \.dgrp\.wide\{flex-basis:100%\}/, '★ 「제목을 못 읽음」이 한 줄을 안 씁니다');
  assert.match(pc[0], /#grid \.dgrp \.cells\{grid-template-columns:repeat\(var\(--n,1\),var\(--cw,132px\)\)\}/,
    '★★ 묶음 칸 수·칸 폭이 CSS 에 안 이어졌습니다 — fitGridCols 가 넣은 값이 안 쓰입니다');
  assert.match(pc[0], /#grid \.dgrp \.day b\{overflow:hidden;text-overflow:ellipsis/, '★ 날짜 줄이 넘쳐도 «…» 로 안 줄입니다');
});

test('★★ 첫 날짜 줄의 위 여백 규칙은 «첫 묶음»으로 가린다 — .day:first-child 가 남으면 모든 줄이 여백을 잃는다', () => {
  assert.ok(!/#grid \.day:first-child/.test(CSS),
    '★★ 날짜 줄은 이제 묶음 상자의 첫 자식이라, .day:first-child 는 «모든» 날짜 줄에 걸립니다');
  assert.match(CSS, /#grid \.dgrp:first-child \.day\{margin-top:0\}/);
});

test('★ 날짜 줄에는 전체 글자를 title 로 남긴다 — «…» 로 잘려도 읽을 수 있다', () => {
  const c = makeCtx({ items: [photo('a', 0)] });
  c.renderGrid();
  const d = new Date(NOON);
  const label = (d.getMonth() + 1) + '월 ' + d.getDate() + '일 (오늘)';   // 시험 시계(NOON)의 «오늘» — 진짜 날짜가 아니다
  assert.ok(c.grid.innerHTML.includes('<b title="' + label + '">' + label + '</b>'),
    '날짜 줄 글자가 title 에도 그대로 남아야 합니다: ' + label);
});

test('★ 시험의 «지금»은 박혀 있다 — 진짜 오늘 날짜가 바뀌어도 「(오늘)」 줄이 흔들리지 않는다', () => {
  const c = makeCtx({ items: [] });
  assert.strictEqual(vm.runInContext('new Date().getTime()', c), NOON, 'new Date() 가 시험 시계여야 합니다');
  assert.strictEqual(vm.runInContext('Date.now()', c), NOON, 'Date.now() 도 시험 시계여야 합니다');
  assert.strictEqual(vm.runInContext('new Date(0).getTime()', c), 0, '값을 준 new Date(값) 은 그대로 받아야 합니다');
});
