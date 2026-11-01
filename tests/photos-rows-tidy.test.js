/* 사진첩 — 행 정리 (대표 지시 2026-11-01 「추천대로」, 목업 「이대로」)
 *
 * ① 폰: 사진 위 띠가 석 줄이라 첫 사진이 화면 28% 아래(248px)에서 시작했다
 *    → 차례 고르개를 «켜진 칸 하나»로 줄이고, 「안 읽은 서류」 띠를 도구줄 안으로(200px)
 * ② 폰: 할 일이 없어도 「준비」 딱지가 늘 떠 있었다 → 올리는 중·실패일 때만
 * ③ PC: 1280~1400px 에서 분류 탭 끝 두엇이 둘째 줄로 떨어졌다 → «넘칠 때만» 짧은 이름
 * (띠 자리 규칙 자체는 tests/photos-ask-bar-one-line.test.js 가 본다)
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
const PHONE_MAX = Number((RAW.match(/^const PHONE_MAX = (\d+);/m) || [])[1]);

/* ══ ① 차례 고르개 — 폰은 한 칸, 누르면 넘어간다 ══ */

function sortCtx(phone, now) {
  const ctx = { gridSort: now, isPhone: function () { return phone; }, GRID_SORT_LS: 'k',
    localStorage: { setItem: function () {} }, resetGridRenderLimit: function () {}, renderGrid: function () {} };
  vm.createContext(ctx);
  vm.runInContext(cutFn(RAW, 'function pickSort(').replace(/^function pickSort/, 'this.pickSort = function'), ctx);
  return ctx;
}

test('★★ 폰에서 켜진 칸을 누르면 «다른 차례»로 넘어간다 — 한 칸만 보이므로 그것이 유일한 단추다', () => {
  const c = sortCtx(true, 'new');
  c.pickSort('new');
  assert.equal(c.gridSort, 'title', '★★ 폰에서 「최신순 ⇅」를 눌러도 제목순으로 안 바뀝니다');
  c.pickSort('title');
  assert.equal(c.gridSort, 'new', '★ 제목순에서 다시 누르면 최신순으로 돌아와야 합니다');
});

test('★★ 넓은 화면은 지금 그대로 — 켜진 칸을 또 눌러도 안 바뀐다(두 칸이 다 보인다)', () => {
  const c = sortCtx(false, 'new');
  c.pickSort('new');
  assert.equal(c.gridSort, 'new', '★★ PC 에서 「최신순」을 다시 누르면 제목순으로 뒤집힙니다');
  c.pickSort('title');
  assert.equal(c.gridSort, 'title');
});

test('★★ 폰 CSS 는 켜진 칸만 보이고, 그 폭 기준이 isPhone() 과 «같다»', () => {
  assert.ok(PHONE_MAX > 0, 'PHONE_MAX 를 못 찾았습니다');
  const blocks = CSS.match(/@media \(max-width:(\d+)px\)\{[^{}]*#sortSeg button:not\(\.on\)\{display:none\}/g) || [];
  assert.equal(blocks.length, 1, '★★ 폰에서 안 켜진 칸을 접는 규칙이 없습니다 — 두 칸이면 띠와 한 줄에 안 듭니다');
  const w = Number(blocks[0].match(/max-width:(\d+)px/)[1]);
  assert.equal(w, PHONE_MAX, '★★ 접는 폭(' + w + ')과 넘기는 폭(' + PHONE_MAX + ')이 다르면 «안 넘어가는 한 칸» 구간이 생깁니다');
  assert.match(CSS, /#sortSeg button\.on::after\{content:' ⇅'/, '★ 눌러서 바뀐다는 표시가 없습니다');
});

test('★★ 띠 자리는 «고를 때»와 «띠를 새로 그릴 때» 다시 정한다 — 안 그러면 처음 자리에 박힌다', () => {
  assert.match(stripJs(cutFn(RAW, 'function renderGridBar(')), /placeAskBar\(\)/,
    '★★ 사진을 골라도 띠가 붙박이 줄 안에 남아 고른 단추와 함께 사진을 가립니다');
  assert.match(stripJs(cutFn(RAW, 'function renderReadAsk(')), /\.then\(placeAskBar\)/,
    '★★ 「서류입니까?」 띠로 바뀌어도 도구줄 안에 남아 제목이 「🖼 한…」까지 잘립니다');
});

/* ══ ② 「준비」 딱지 — 할 말이 있을 때만 ══ */

function el() { return { style: {}, textContent: '', className: '', classList: { add: function (c) { this._c = c; } } }; }
function summaryCtx(jobs) {
  const ids = { phSummaryOwner: el(), phSummaryDoc: el(), phSummaryState: el(), ownerSel: null };
  const ctx = { $: function (id) { return ids[id] || null; }, collectDoc: null, upJobs: jobs,
    renderPhNeedBtn: function () {}, Date: Date };
  vm.createContext(ctx);
  vm.runInContext(cutFn(RAW, 'function renderPhSummary('), ctx);
  ctx.renderPhSummary();
  return ids.phSummaryState;
}

test('★★ 할 일이 없으면 상태 딱지를 «안 그린다» — 「준비」는 아무것도 안 알려 주면서 늘 떠 있었다', () => {
  const s = summaryCtx([]);
  assert.equal(s.style.display, 'none', '★★ 할 일이 없는데 딱지가 떠 있습니다');
  assert.ok(!/준비/.test(s.textContent), '★ 「준비」가 남아 있습니다');
});

test('★★ 올리는 중·실패는 지금처럼 보인다 — 빼면 올리다 걸린 것을 모른다', () => {
  const busy = summaryCtx([{ state: 'up' }]);
  assert.equal(busy.style.display, '', '★★ 올리는 중인데 딱지가 안 보입니다');
  assert.match(busy.textContent, /올리는 중 1/);
  const fail = summaryCtx([{ state: 'fail' }]);
  assert.equal(fail.style.display, '', '★★ 실패했는데 딱지가 안 보입니다 — 다시 걸 길을 못 찾습니다');
  assert.match(fail.textContent, /⚠ 1/);
});

test('★ 처음 그릴 때도 「준비」가 안 뜬다 · 칸을 못 박아 상태가 넓은 칸에 앉지 않는다', () => {
  const tag = (RAW.match(/<span class="state" id="phSummaryState"[^>]*>[^<]*<\/span>/) || [''])[0];
  assert.ok(tag, '상태 칸이 없습니다');
  assert.ok(!/준비/.test(tag), '★ 처음 열 때 「준비」가 잠깐 떴다 사라집니다');
  assert.match(CSS, /#phSummaryBtn \.owner\{grid-column:2/, '★★ 이름 칸이 못 박혀 있지 않습니다 — 빈 칸을 건너 자리가 당겨집니다');
  assert.match(CSS, /#phSummaryBtn \.state\{grid-column:3\}/, '★ 상태 딱지가 넓은 칸(1fr)에 앉아 길게 늘어납니다');
});

/* ══ ③ 분류 탭 — 넘칠 때만 짧은 이름 ══ */

function kindsEl(lastTop) {
  const cls = new Set();
  return { classList: { add: function (c) { cls.add(c); }, remove: function (c) { cls.delete(c); }, contains: function (c) { return cls.has(c); } },
    firstElementChild: { getBoundingClientRect: function () { return { top: 68 }; } },
    lastElementChild: { getBoundingClientRect: function () { return { top: cls.has('tight') ? 68 : lastTop }; } } };
}
function fitCtx() {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(cutFn(RAW, 'function fitKinds('), ctx);
  return ctx;
}

test('★★ 탭이 둘째 줄로 떨어지면 짧은 이름으로 — 한 줄에 들면 긴 이름 그대로', () => {
  const c = fitCtx();
  const over = kindsEl(107);
  c.fitKinds(over);
  assert.ok(over.classList.contains('tight'), '★★ 넘치는데 줄이지 않습니다 — 사진이 39px 아래로 밀립니다');
  const fits = kindsEl(68);
  c.fitKinds(fits);
  assert.ok(!fits.classList.contains('tight'), '★★ 넉넉한데 이름을 줄입니다 — 넓은 화면에서 「사업자」로 보입니다');
});

test('★★ 늘 «긴 이름으로 다시 재고» 정한다 — 한번 줄이면 창을 넓혀도 안 돌아오는 일이 없게', () => {
  const c = fitCtx();
  const k = kindsEl(68);
  k.classList.add('tight');               // 좁을 때 줄여 둔 채로 넓혔다
  c.fitKinds(k);
  assert.ok(!k.classList.contains('tight'), '★★ 넓혔는데 짧은 이름이 그대로 남습니다');
  const fn = stripJs(cutFn(RAW, 'function fitKinds('));
  assert.ok(fn.indexOf("remove('tight')") < fn.indexOf('getBoundingClientRect'), '★ 재기 전에 짧은 이름을 풀지 않습니다');
});

test('★★ 탭 줄 높이를 재기 «전»에 맞춘다 — 뒤에 하면 찾기 줄이 붙는 자리가 한 줄 어긋난다', () => {
  const fn = stripJs(cutFn(RAW, 'function syncStickyTop('));
  const fit = fn.indexOf('fitKinds('), h = fn.indexOf('getBoundingClientRect().height');
  assert.ok(fit > 0, '★★ 창 크기·탭 수가 바뀔 때 다시 맞추지 않습니다');
  assert.ok(fit < h, '★★ 높이를 먼저 재고 줄입니다 — 붙는 자리(--kindsH)가 두 줄 높이로 남습니다');
});

test('★★ 줄인 모습 — 짧은 이름·「＋」, 「전체」 장수는 갈래 스위치와 같아 한 번만', () => {
  assert.match(CSS, /#kinds\.tight \.wide-only\{display:none\}/, '★★ 넘쳐도 긴 이름이 그대로입니다');
  assert.match(CSS, /#kinds\.tight \.narrow-only\{display:inline\}/, '★★ 긴 이름을 감추고 짧은 이름을 안 띄웁니다 — 탭이 빈칸이 됩니다');
  assert.match(CSS, /#kinds\.tight button\[data-key="all"\] \.n\{display:none\}/, '★ 「전체」 장수가 남아 한 줄에 안 듭니다');
  assert.match(RAW, /class="add" onclick="openAddKind\(\)"[^>]*>＋<span class="wide-only"> 분류 추가<\/span>/,
    '★ 「＋ 분류 추가」가 줄어들지 않습니다(넓을 때는 글이 다 보여야 합니다)');
});
