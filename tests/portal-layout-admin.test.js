/* 포털 «앱 배치» — 관리자(권형하)만 옮기고, 모든 직원이 같은 배치를 본다 (대표 지시 2026-11-08)
   「화면에서 프로그램을 위아래로 이동가능하게 해라. 서로 다른 영역을 정리할 수 있게 하고 틀 고정하게 하면
     각 영역에서만 움직이게 해라. 만약 의뢰인 업무를 내부관리로 보내고 틀고정으로 하면 내부관리에서만 움직이게
     하는 것이다. 이 부분은 관리자인 권형하만 가능하게 해라.」

   지키는 규칙
   ① 순서·영역 계산(layMove·layBulk)은 «틀 고정한 앱을 다른 영역으로 안 보낸다» — 같은 영역 안 순서는 된다.
   ② 끌기(onTileDragOver)도 같다 — 틀 고정은 제 영역 밖에서 아무 일도 안 하고, 아닌 앱은 다른 영역에도 놓인다(빈 영역 포함).
   ③ 관리자가 «배치 편집 중»일 때만 서버에 쓴다 — 직원·편집 안 하는 관리자·제자리에 놓은 끌기는 서버를 부르지도 않는다.
   ④ 서버가 거절하면 화면을 되돌리고 까닭을 말한다(조용히 실패하지 않는다).
   ⑤ 저장된 공용 배치가 있으면 모두가 그것을 따르고(영역·순서·준비중은 맨 끝), 없을 때만 예전 개인 저장값을 따른다.
   ⑥ 직원 화면에는 편집 단추·줄·📌 가 «아예 없다». 위임관리인도 같다(서버 규칙이 관리자만 쓰게 한다).
   ⑦ 설정 창 저장(cfgSave)이 같은 자리의 배치를 지우지 않는다 — 배치를 못 읽으면 저장하지 않는다.
   ⑧ 저장 자리(data/app_config)의 쓰기 규칙은 «관리자만» — 위임관리인·직원은 못 쓴다(규칙을 넓히지 않았다는 증거).

   ⚠ 글자만 찾는 검사가 아니다 — 원본의 함수를 «떠서» 가짜 화면 위에서 돌려 본다(STATUS 「검사가 헛돈다」). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const { cutFn } = require('./cut-fn');

const E = fs.readFileSync(path.join(__dirname, '..', 'enter.html'), 'utf8').replace(/\r\n/g, '\n');

/* ── 원본 그대로 싣는 것들 ─────────────────────────────────────────── */
const FN = [
  'function layClean(', 'function laySig(', 'function layIsFrozen(', 'function layRowOf(', 'function layoutDefault(',
  'function layCopy(', 'function layFind(', 'function layMove(', 'function layBulk(', 'function layBuild(',
  'function layoutAdminOk(', 'function layoutEditing(', 'function layModelFromDom(', 'function layModelToDom(',
  'function layoutSay(', 'function layoutCacheRead(', 'function layoutCacheSave(', 'function layoutPublish(',
  'function layoutCommit(', 'function layoutApply(', 'function tilesToDefault(', 'function layoutRepaint(',
  'function layoutLoad(', 'function layoutFreezeToggle(', 'function layoutResetDefault(', 'function onFreezeClick(',
  'function ensureLayoutMarks(', 'function layoutMarksPaint(', 'function layoutUiPaint(', 'function layoutEditToggle(',
  'function soonToEnd(', 'function savedRowOf(', 'function applyTileOrder(', 'function persistOrderFromDom(',
  'function updateLockUi(', 'function onTileDragStart(', 'function onTileDragEnd(', 'function onTileDragOver(',
  'function rowExists(', 'function appRowOf(',
  'function lpEsc(', 'function lpApp(', 'function lpRowLabel(', 'function lpPicked(', 'function lpRender(',
  'function lpBodyClick(', 'function lpBodyChange(', 'function lpBulk(',
];
function sliceBlock(from, endMarker) {
  const a = E.indexOf(from);
  assert.ok(a > -1, '★ 원본에서 「' + from + '」 을 못 찾았다');
  return E.slice(a, E.indexOf(endMarker, a) + endMarker.length);
}
const APPS_SRC = sliceBlock('var APPS = [', '\n  ];');
const ROWS_SRC = sliceBlock('var APP_ROWS = [', '\n  ];');
const MOVED_SRC = E.match(/var ROW_MOVED_FROM = [^;]+;/)[0];
const PATH_SRC = E.match(/var LAYOUT_PATH = [^;]+;/)[0];
const CACHE_SRC = E.match(/var LAYOUT_CACHE = [^;]+;/)[0];
const FUNCS_SRC = FN.map((d) => cutFn(E, d)).join('\n');

/* ── 가짜 화면 ─────────────────────────────────────────────────────── */
function fakeEl(extra) {
  const set = new Set();
  const el = {
    dataset: {}, style: {}, _attrs: {}, hidden: false, textContent: '', title: '', children: [], parentNode: null,
    classList: {
      add: (n) => set.add(n), remove: (n) => set.delete(n), contains: (n) => set.has(n),
      toggle: (n, f) => { const on = f === undefined ? !set.has(n) : !!f; if (on) set.add(n); else set.delete(n); return on; },
    },
    setAttribute(k, v) { el._attrs[k] = String(v); }, getAttribute(k) { return el._attrs[k] === undefined ? null : el._attrs[k]; },
    addEventListener() {}, querySelector: () => null,
  };
  return Object.assign(el, extra || {});
}

/* spec = { 영역 id: [[앱 key, 준비중(1)] …] } — 영역 상자와 타일을 만든다. 위치는 «지금 순서»로 셈해 준다(끌기 계산용). */
function world(spec, opts) {
  opts = opts || {};
  const ctx = {
    console, setTimeout: () => 0, clearTimeout() {},
    confirm: () => (opts.confirm === undefined ? true : opts.confirm),
    alert() {}, said: [], calls: [], failWith: null,
    isMobile: () => !!opts.mobile,
    auth: { currentUser: { uid: 'u1' } },
  };
  vm.createContext(ctx);
  vm.runInContext(APPS_SRC + '\n' + ROWS_SRC + '\n' + MOVED_SRC + '\n' + PATH_SRC + '\n' + CACHE_SRC, ctx);
  vm.runInContext('var tilePrefs = { order: null, rows: null }; var _layout = null, _layoutAdmin = false, _layoutEdit = false,'
    + ' _layoutWriting = 0, _layoutSayT = 0, _dragBefore = null, _dragWarned = false, _dragEl = null, _lpSel = {}, _lpBulkRow = "";', ctx);
  const ids = JSON.parse(vm.runInContext('JSON.stringify(APP_ROWS.map(function(r){ return r.id; }))', ctx));
  const conts = ids.map((id, ci) => {
    const c = fakeEl({ dataset: { row: id }, id });
    c.getBoundingClientRect = () => ({ left: 0, top: ci * 200, right: 800, bottom: ci * 200 + 100, width: 800, height: 100 });
    c.appendChild = (t) => {
      if (t.parentNode) t.parentNode.children.splice(t.parentNode.children.indexOf(t), 1);
      c.children.push(t); t.parentNode = c; return t;
    };
    c.insertBefore = (t, ref) => {
      if (t.parentNode) t.parentNode.children.splice(t.parentNode.children.indexOf(t), 1);
      const at = ref ? c.children.indexOf(ref) : c.children.length;
      c.children.splice(at < 0 ? c.children.length : at, 0, t); t.parentNode = c; return t;
    };
    return c;
  });
  const byId = {}; conts.forEach((c) => { byId[c.id] = c; });
  ids.forEach((id) => (spec[id] || []).forEach(([key, soon]) => {
    const t = fakeEl({ dataset: { key, row: id } });
    if (soon) t.dataset.soonApp = '1';
    t.getBoundingClientRect = () => {
      const p = t.parentNode, ci = conts.indexOf(p), j = p.children.indexOf(t);
      return { left: j * 100, top: ci * 200, width: 96, height: 100 };
    };
    /* 진짜 화면의 nextSibling — 없으면 «뒤에 끼우기»가 «맨 끝에 붙이기»로 보여 검사가 거짓이 된다 */
    Object.defineProperty(t, 'nextSibling', { get() { const p = t.parentNode; return p ? (p.children[p.children.indexOf(t) + 1] || null) : null; } });
    byId[id].appendChild(t);
  }));
  const all = () => [].concat(...conts.map((c) => c.children.slice()));
  const db = {
    ref: (p) => ({
      set(rec) { ctx.calls.push({ op: 'set', path: p, rec: JSON.parse(JSON.stringify(rec)) }); return ctx.failWith ? Promise.reject(ctx.failWith) : Promise.resolve(); },
      once() { ctx.calls.push({ op: 'once', path: p }); return Promise.resolve({ val: () => ctx.serverValue }); },
    }),
  };
  const els = {};
  Object.assign(ctx, {
    tileConts: () => conts, tileCont: (id) => byId[id] || conts[0], allTiles: all,
    origTile: (k) => all().find((t) => t.dataset.key === k) || null,
    hideEmptyRows() {}, db,
    localStorage: { _m: {}, getItem(k) { return k in this._m ? this._m[k] : null; }, setItem(k, v) { this._m[k] = String(v); }, removeItem(k) { delete this._m[k]; } },
    $: (id) => els[id] || null,
    document: { body: fakeEl(), activeElement: null, createElement: () => fakeEl() },
    layoutPanelOpen() { ctx.panelOpened = (ctx.panelOpened || 0) + 1; },
  });
  ctx.els = els; ctx.conts = conts;
  vm.runInContext(FUNCS_SRC, ctx);
  /* 말하기는 가로채서 센다 — 화면 글자가 아니라 «말했는가»를 본다 */
  ctx.layoutSay = (m, bad) => { ctx.said.push({ m, bad: !!bad }); };
  return ctx;
}
const keysOf = (c) => c.children.map((t) => t.dataset.key);
const plain = (v) => JSON.parse(JSON.stringify(v));
const BASE = {
  client: [['erp'], ['cal'], ['govaid'], ['payroll', 1]],
  store: [['mail'], ['photos']],
  sales: [['home']],
  inside: [['hr'], ['career']],
};
const model = (over) => Object.assign({
  rowIds: ['client', 'store', 'inside'],
  rows: { client: ['erp', 'cal', 'payroll'], store: ['mail'], inside: ['hr'] },
  frozen: {}, tail: { payroll: true },
}, over || {});

/* ══ ① 순수 계산 ═════════════════════════════════════════════════════ */
function pure() {
  const w = world({});
  return w;
}

test('① 배치 정리 — 틀린 값은 버리고, 순서가 비면 «배치 없음»이다', () => {
  const w = pure();
  assert.equal(w.layClean(null), null);
  assert.equal(w.layClean({ order: [] }), null, '★ 순서가 빈 배치는 «없는 것»이다');
  assert.equal(w.layClean({ rows: { a: 'x' } }), null);
  const L = plain(w.layClean({ order: ['a', 'a', 7, '', 'b'], rows: { a: 'client', b: 5, c: '' }, frozen: { a: true, b: 'yes', c: false } }));
  assert.deepEqual(L, { order: ['a', 'b'], rows: { a: 'client' }, frozen: { a: true } },
    '★ 겹친 키·숫자 키·빈 영역·true 가 아닌 틀 고정은 버려야 한다');
});

test('① 순서 단추 — 같은 영역 안에서 위·아래, 끝에서는 안 된다, 준비중은 늘 맨 끝', () => {
  const w = pure(), m = model();
  let r = w.layMove(m, 'cal', 'up');
  assert.ok(r.ok); assert.deepEqual(plain(r.model.rows.client), ['cal', 'erp', 'payroll']);
  r = w.layMove(m, 'erp', 'up');
  assert.equal(r.ok, false, '★ 맨 위에서 더 위로는 안 된다');
  r = w.layMove(m, 'cal', 'down');
  assert.equal(r.ok, false, '★ 준비중 앞의 앱이 준비중 뒤로 가면 안 된다(준비중은 늘 맨 끝)');
  r = w.layMove(m, 'payroll', 'up');
  assert.equal(r.ok, false, '★ 준비중이 일반 앱 앞으로 가면 안 된다');
  assert.deepEqual(plain(m.rows.client), ['erp', 'cal', 'payroll'], '★ 원본 모델을 고치면 «미리 돌려 보기»가 거짓이 된다');
});

test('① 영역 옮기기 — 다른 영역 끝(준비중 앞)으로 간다 · 📌 틀 고정한 앱은 못 간다 · 풀면 간다', () => {
  const w = pure(), m = model({ frozen: { erp: true } });
  let r = w.layMove(m, 'cal', 'row', 'store');
  assert.ok(r.ok);
  assert.deepEqual(plain(r.model.rows.store), ['mail', 'cal']);
  assert.deepEqual(plain(r.model.rows.client), ['erp', 'payroll']);
  r = w.layMove(model({ rows: { client: ['erp'], store: ['mail', 'tailx'], inside: [] }, tail: { tailx: true } }), 'erp', 'row', 'store');
  assert.deepEqual(plain(r.model.rows.store), ['mail', 'erp', 'tailx'], '★ 준비중 «앞»에 끼워야 준비중이 맨 끝에 남는다');
  r = w.layMove(m, 'erp', 'row', 'inside');
  assert.equal(r.ok, false, '★★ 틀 고정한 앱이 다른 영역으로 갔다');
  assert.match(r.why, /틀 고정/, '까닭을 말해야 한다');
  r = w.layMove(m, 'erp', 'up'); assert.equal(r.ok, false);   // 맨 위라 안 되는 것 — 틀 고정 때문이 아니다
  r = w.layMove(m, 'erp', 'down');
  assert.ok(r.ok, '★ 틀 고정한 앱도 «같은 영역 안» 순서는 바꿀 수 있어야 한다');
  const un = w.layMove(m, 'erp', 'unfreeze');
  assert.ok(un.ok);
  assert.ok(w.layMove(un.model, 'erp', 'row', 'inside').ok, '★ 틀 고정을 풀면 옮길 수 있어야 한다');
  assert.equal(w.layMove(m, 'erp', 'row', 'nowhere').ok, false, '없는 영역');
  assert.equal(w.layMove(m, 'erp', 'row', 'client').ok, false, '이미 그 영역');
});

test('① 한꺼번에 — 틀 고정은 건너뛰고 건수를 센다 · 전부 막히면 ok:false', () => {
  const w = pure(), m = model({ frozen: { erp: true } });
  let r = w.layBulk(m, ['erp', 'cal'], 'row', 'inside');
  assert.ok(r.ok); assert.equal(r.moved, 1); assert.equal(r.frozenSkip, 1);
  assert.deepEqual(plain(r.model.rows.inside), ['hr', 'cal']);
  assert.ok(plain(r.model.rows.client).includes('erp'), '★★ 틀 고정한 앱이 일괄 옮기기에 딸려 갔다');
  r = w.layBulk(m, ['erp'], 'row', 'inside');
  assert.equal(r.ok, false); assert.match(r.why, /틀 고정/);
  r = w.layBulk(m, ['cal', 'mail'], 'freeze');
  assert.ok(r.ok); assert.equal(r.moved, 2);
  assert.deepEqual(Object.keys(r.model.frozen).sort(), ['cal', 'erp', 'mail']);
});

test('① 저장할 배치 만들기 — 화면에 안 그린 앱의 자리·틀 고정은 버리지 않는다', () => {
  const w = pure();
  const old = { order: ['hidden', 'erp'], rows: { hidden: 'store', erp: 'client' }, frozen: { hidden: true } };
  const next = plain(w.layBuild(model({ frozen: { hidden: true, erp: true } }), old));
  assert.deepEqual(next.order.slice(-1), ['hidden'], '★ 안 그린 앱이 순서에서 빠졌다');
  assert.equal(next.rows.hidden, 'store', '★ 안 그린 앱의 영역을 잃었다');
  assert.deepEqual(next.frozen, { hidden: true, erp: true });
  assert.equal(next.rows.cal, 'client');
});

/* ══ ⑤ 배치 적용 ═════════════════════════════════════════════════════ */
test('⑤ 공용 배치가 있으면 모두 그것을 따른다 — 영역·순서·준비중은 맨 끝', () => {
  const w = world(BASE);
  vm.runInContext(`_layout = layClean({ order:['hr','erp','mail','cal','photos','payroll','govaid','home','career'],
    rows:{ hr:'client', erp:'client', cal:'inside', mail:'store', photos:'store', payroll:'client', govaid:'client', home:'sales', career:'inside' } });`, w);
  w.applyTileOrder();
  assert.deepEqual(keysOf(w.conts[0]), ['hr', 'erp', 'govaid', 'payroll'], '★ 영역·순서·준비중 맨 끝이 안 맞다');
  assert.deepEqual(keysOf(w.conts[3]), ['cal', 'career']);
  assert.deepEqual(keysOf(w.conts[1]), ['mail', 'photos']);
});

test('⑤ 공용 배치가 «있으면» 옛 개인 저장값은 안 따른다 · «없으면» 예전처럼 따른다', () => {
  const w = world(BASE);
  vm.runInContext(`tilePrefs = { order:['govaid','cal','erp'], rows:{ govaid:'client', cal:'client', erp:'client' } };`, w);
  w.applyTileOrder();
  assert.deepEqual(keysOf(w.conts[0]).slice(0, 3), ['govaid', 'cal', 'erp'], '★ 공용 배치가 없을 때는 옛 저장값을 따라야 한다(바뀌면 모든 사람 화면이 갑자기 달라진다)');
  vm.runInContext(`_layout = layClean({ order:['erp','cal','govaid'], rows:{} });`, w);
  w.tilesToDefault(); w.applyTileOrder();
  assert.deepEqual(keysOf(w.conts[0]).slice(0, 3), ['erp', 'cal', 'govaid'], '★ 공용 배치가 개인 저장값에 밀렸다');
});

test('⑤ 지금 없는 영역 이름이 저장돼 있으면 앱의 제자리로 보낸다 — 타일이 사라지면 안 된다', () => {
  const w = world(BASE);
  vm.runInContext(`_layout = layClean({ order:['erp','mail'], rows:{ erp:'gone', mail:'store' } });`, w);
  w.applyTileOrder();
  const all = w.allTiles().map((t) => t.dataset.key).sort();
  assert.equal(all.length, 9, '★ 타일이 사라졌다');
  assert.ok(keysOf(w.conts[0]).includes('erp'), '★ 없는 영역 이름이면 앱의 제자리(영역)로 가야 한다');
});

/* ══ ② 끌기 ═════════════════════════════════════════════════════════ */
function dragOver(w, tile, x, y) {
  w._dragEl = tile;
  w.onTileDragOver({ clientX: x, clientY: y, preventDefault() { w.prevented = true; }, dataTransfer: {} });
}
const admin = (w, edit) => vm.runInContext(`_layoutAdmin = true; _layoutEdit = ${edit === false ? 'false' : 'true'};`, w);

test('② 📌 틀 고정한 앱은 끌어도 «다른 영역으로 안 간다» — 같은 영역 안 순서는 바뀐다', () => {
  const w = world(BASE); admin(w);
  vm.runInContext(`_layout = layClean({ order:['erp','cal','govaid','payroll','mail','photos','home','hr','career'], rows:{}, frozen:{ erp:true } });`, w);
  const erp = w.origTile('erp');
  dragOver(w, erp, 50, 3 * 200 + 50);              // 내부관리 영역의 앱 위로 끌었다
  assert.equal(erp.parentNode.dataset.row, 'client', '★★ 틀 고정한 앱이 다른 영역으로 갔다');
  assert.ok(w.said.some((s) => s.bad && /틀 고정/.test(s.m)), '★ 왜 안 되는지 말해야 한다');
  dragOver(w, erp, 150, 50);                       // 같은 영역의 다음 앱 위로
  assert.deepEqual(keysOf(w.conts[0]).slice(0, 3), ['cal', 'erp', 'govaid'], '★ 틀 고정한 앱도 제 영역 안에서는 움직여야 한다');
});

test('② 틀 고정이 아닌 앱은 다른 영역(빈 영역 포함)에도 놓인다', () => {
  const spec = Object.assign({}, BASE, { sales: [] });
  const w = world(spec); admin(w);
  const cal = w.origTile('cal');
  dragOver(w, cal, 50, 3 * 200 + 50);
  assert.equal(cal.parentNode.dataset.row, 'inside', '★ 틀 고정 아닌 앱이 다른 영역으로 못 갔다');
  dragOver(w, cal, 300, 2 * 200 + 50);             // 빈 영역 상자 안
  assert.equal(cal.parentNode.dataset.row, 'sales', '★ 빈 영역에 놓지 못한다 — 영역을 비우면 다시 못 채운다');
});

test('② 편집 중이 아니거나 관리자가 아니면 끌어도 배치가 «안 바뀐다»', () => {
  for (const [isAdmin, edit] of [[false, true], [true, false]]) {
    const w = world(BASE);
    vm.runInContext(`_layoutAdmin = ${isAdmin}; _layoutEdit = ${edit};`, w);
    const cal = w.origTile('cal');
    dragOver(w, cal, 50, 3 * 200 + 50);
    assert.equal(cal.parentNode.dataset.row, 'client', '★★ 관리자 편집 중이 아닌데 끌기가 배치를 바꿨다');
    assert.ok(!w.prevented, '★ 놓을 수 있는 자리로 열어 주면 안 된다');
  }
});

/* ══ ③④ 저장 ═════════════════════════════════════════════════════════ */
function dragAndDrop(w, tile, toRow) {
  w.onTileDragStart.call(tile, { dataTransfer: { setData() {} } });
  if (toRow) w.tileCont(toRow).appendChild(tile);
  w.onTileDragEnd.call(tile);
}

test('③ 관리자가 편집 중에 옮기면 «공용 배치 자리»에 한 번 쓴다', () => {
  const w = world(BASE); admin(w);
  dragAndDrop(w, w.origTile('cal'), 'inside');
  const sets = w.calls.filter((c) => c.op === 'set');
  assert.equal(sets.length, 1, '★ 서버에 쓴 횟수가 ' + sets.length + ' 이다');
  assert.equal(sets[0].path, 'data/app_config/portalLayout', '★ 공용 배치는 관리자 쓰기 규칙이 걸린 자리(data/app_config)에 둔다');
  assert.equal(sets[0].rec.rows.cal, 'inside');
  assert.ok(Array.isArray(sets[0].rec.order) && sets[0].rec.order.length >= 9);
  assert.ok(sets[0].rec.updatedAt, '언제 바꿨는지 남아야 한다');
  assert.equal(JSON.parse(w.localStorage.getItem('pu_portal_layout_v1')).rows.cal, 'inside', '★ 이 기기에도 받아 둬야 다음에 깜빡이지 않는다');
});

test('③ 직원·편집 안 하는 관리자는 «서버를 부르지도 않는다»', () => {
  for (const [isAdmin, edit] of [[false, true], [false, false], [true, false]]) {
    const w = world(BASE);
    vm.runInContext(`_layoutAdmin = ${isAdmin}; _layoutEdit = ${edit};`, w);
    dragAndDrop(w, w.origTile('cal'), 'inside');
    assert.equal(w.calls.length, 0, '★★ 관리자 편집 중이 아닌데 서버에 썼다 (관리자=' + isAdmin + ', 편집=' + edit + ')');
  }
  const w = world(BASE);                                     // 어떻게든 직접 불려도 — 쓰지 않는다
  return w.layoutPublish({ order: ['erp'], rows: { erp: 'client' }, frozen: {} }).then((ok) => {
    assert.equal(ok, false); assert.equal(w.calls.length, 0, '★★ 직원 화면에서 layoutPublish 가 서버에 썼다');
  });
});

test('③ 끌었다가 «제자리에 놓으면» 쓰지 않는다 — 아무것도 안 옮겼는데 내 순서가 모두에게 퍼지면 안 된다', () => {
  const w = world(BASE); admin(w);
  dragAndDrop(w, w.origTile('cal'), null);
  assert.equal(w.calls.length, 0, '★★ 안 옮겼는데 공용 배치를 썼다');
  assert.equal(vm.runInContext('_layout', w), null);
});

test('③ 배치가 그대로면 다시 쓰지 않는다', () => {
  const w = world(BASE); admin(w);
  dragAndDrop(w, w.origTile('cal'), 'inside');
  const n = w.calls.filter((c) => c.op === 'set').length;
  w.persistOrderFromDom();
  assert.equal(w.calls.filter((c) => c.op === 'set').length, n, '★ 같은 배치를 또 썼다');
});

test('④ 서버가 거절하면 화면을 되돌리고 «까닭을 말한다»', async () => {
  const w = world(BASE); admin(w);
  w.failWith = { code: 'PERMISSION_DENIED', message: 'permission_denied' };
  w.tileCont('inside').appendChild(w.origTile('cal'));   // 화면에서 옮겨 둔 상태
  const next = w.layBuild(w.layModelFromDom(), null);
  const ok = await w.layoutPublish(next);
  assert.equal(ok, false);
  assert.equal(vm.runInContext('_layout', w), null, '★ 서버가 거절했는데 공용 배치가 남았다');
  assert.equal(w.origTile('cal').parentNode.dataset.row, 'client', '★★ 서버가 거절했는데 화면이 옮겨진 채로 남았다');
  assert.ok(w.said.some((s) => s.bad && /관리자/.test(s.m)), '★ 거절 까닭(관리자만)을 말해야 한다: ' + JSON.stringify(w.said));
  assert.equal(vm.runInContext('_layoutWriting', w), 0, '★ 쓰는 중 표시가 안 내려가면 서버 읽기가 영원히 막힌다');
});

test('③ 📌 틀 고정 누르기 — 관리자만, 켜고 끄는 값이 서버에 간다', () => {
  const w = world(BASE); admin(w);
  w.layoutFreezeToggle('erp');
  let rec = w.calls.filter((c) => c.op === 'set').pop().rec;
  assert.deepEqual(rec.frozen, { erp: true }, '★ 틀 고정이 저장되지 않았다');
  assert.equal(rec.rows.erp, 'client', '★ 틀 고정한 앱의 영역(지금 있는 곳)이 함께 저장돼야 한다');
  w.layoutFreezeToggle('erp');
  rec = w.calls.filter((c) => c.op === 'set').pop().rec;
  assert.equal(rec.frozen, undefined, '★ 풀었는데 틀 고정이 남았다');
  const s = world(BASE);
  s.layoutFreezeToggle('erp');
  assert.equal(s.calls.length, 0, '★★ 직원 화면에서 틀 고정이 서버에 갔다');
});

test('③ 「처음 자리로」 — 기본 배치를 «새로 저장»한다(지우지 않는다) · 묻고 아니라면 안 한다', () => {
  const w = world(BASE, { confirm: false }); admin(w);
  vm.runInContext(`_layout = layClean({ order:['hr','erp'], rows:{ hr:'client', erp:'inside' }, frozen:{ erp:true } });`, w);
  w.layoutResetDefault();
  assert.equal(w.calls.length, 0, '★ 아니오 했는데 저장했다');
  const y = world(BASE); admin(y);
  vm.runInContext(`_layout = layClean({ order:['hr','erp'], rows:{ hr:'client', erp:'inside' }, frozen:{ erp:true } });`, y);
  y.layoutResetDefault();
  const sets = y.calls.filter((c) => c.op === 'set');
  assert.equal(sets.length, 1);
  assert.equal(sets[0].rec.frozen, undefined, '★ 처음 자리로 했는데 틀 고정이 남았다');
  const dflt = plain(vm.runInContext('layoutDefault()', y));
  assert.deepEqual(sets[0].rec.order, dflt.order, '★ 기본 순서(APPS 순서)로 저장해야 한다');
  assert.equal(y.calls.filter((c) => c.op === 'once').length, 0);
});

test('⑤ 서버의 공용 배치를 읽어 화면을 맞춘다 — 쓰는 중에는 덮어쓰지 않는다 · 배치가 없어졌으면 기본 자리로', async () => {
  const w = world(BASE);
  w.serverValue = { order: ['hr', 'erp'], rows: { hr: 'client', erp: 'client' } };
  w.layoutLoad(); await new Promise((r) => setImmediate(r));
  assert.deepEqual(keysOf(w.conts[0]).slice(0, 2), ['hr', 'erp'], '★ 서버의 공용 배치가 화면에 안 올랐다');
  assert.ok(w.localStorage.getItem('pu_portal_layout_v1'), '★ 기기에 받아 두지 않았다');
  w.serverValue = null;
  w.layoutLoad(); await new Promise((r) => setImmediate(r));
  assert.equal(vm.runInContext('_layout', w), null);
  assert.equal(keysOf(w.conts[0])[0], 'erp', '★ 배치가 없어졌는데 옛 배치 순서가 남았다(기본 자리로 돌아와야 한다)');
  assert.equal(w.localStorage.getItem('pu_portal_layout_v1'), null, '★ 없어진 배치가 기기에 남았다');
  vm.runInContext('_layoutWriting = 1;', w);
  w.serverValue = { order: ['hr'], rows: {} };
  w.layoutLoad(); await new Promise((r) => setImmediate(r));
  assert.equal(vm.runInContext('_layout', w), null, '★ 쓰는 중에 서버 읽기가 덮어썼다');
});

/* ══ 📋 목록 창 — 폰에서 관리자가 쓰는 길 ═══════════════════════════════ */
function panelWorld(frozenKeys) {
  const w = world(BASE); admin(w);
  w.els.lpBody = fakeEl({ innerHTML: '', scrollTop: 0, contains: () => false });
  w.els.lpSelBar = fakeEl({ hidden: true });
  w.els.lpSelN = fakeEl();
  w.els.lpBulkRow = fakeEl({ innerHTML: '', value: '' });
  const fz = {}; (frozenKeys || []).forEach((k) => { fz[k] = true; });
  w._fz = fz;
  vm.runInContext('_layout = layClean({ order:["erp","cal","govaid","payroll","mail","photos","home","hr","career"], rows:{}, frozen:' + JSON.stringify(fz) + ' });', w);
  return w;
}
const btn = (act, key) => ({ disabled: false, dataset: { act, key } });
const click = (w, b) => w.lpBodyClick({ target: { closest: () => b } });
const html = (w) => w.els.lpBody.innerHTML;
const rowHtml = (w, key) => (html(w).match(new RegExp('<div class="lp-row" data-key="' + key + '">[' + String.fromCharCode(92) + 's' + String.fromCharCode(92) + 'S]*?</select></span></div>')) || [''])[0];

test('📋 목록 창이 «그려진다» — 앱마다 한 줄, 영역마다 번호, 틀 고정은 영역 고르개가 잠긴다', () => {
  const w = panelWorld(['erp']);
  w.lpRender();     // APPS 가운데 빈 칸이 있어도 죽지 않아야 한다(처음 만들 때 for 로 읽다 죽었다)
  const n = (html(w).match(/<div class="lp-row"/g) || []).length;
  assert.equal(n, 9, '★ 화면에 있는 앱 수만큼 줄이 있어야 한다: ' + n);
  assert.equal((html(w).match(/<section class="lp-area"/g) || []).length, 4, '★ 영역마다 한 묶음');
  const no = [...html(w).matchAll(new RegExp('<span class="lp-no">([0-9]+)</span>', 'g'))].map((m) => Number(m[1]));
  assert.deepEqual(no, [1, 2, 3, 4, 1, 2, 1, 1, 2], '★ 번호는 «지금 보이는 순서»로 영역마다 1부터 다시 매긴다');
  assert.match(rowHtml(w, 'erp'), /<select[^>]*data-act="row"[^>]*disabled/, '★★ 틀 고정한 앱의 영역 고르개가 안 잠겼다');
  assert.match(rowHtml(w, 'erp'), /lp-b on" data-act="frz"[^>]*aria-pressed="true"/, '★ 틀 고정 단추가 «켜진 모양»이 아니다');
  assert.doesNotMatch(rowHtml(w, 'cal'), /<select[^>]*disabled/, '★ 틀 고정이 아닌 앱의 영역 고르개가 잠겼다');
  assert.match(rowHtml(w, 'erp'), /data-act="up"[^>]*disabled/, '★ 영역 맨 위 앱의 ▲ 가 켜져 있다');
  assert.match(rowHtml(w, 'govaid'), /data-act="down"[^>]*disabled/, '★ 준비중 앞 앱의 ▼ 가 켜져 있다(준비중은 늘 맨 끝)');
  assert.match(rowHtml(w, 'payroll'), /lp-soon/, '준비중 딱지');
  assert.equal(w.els.lpSelBar.hidden, true, '★ 아무것도 안 골랐는데 선택 띠가 떠 있다');
  assert.match(html(w), /aria-label="[^"]*고르기"/, '★ ☐ 고르기 칸에 이름이 있어야 화면읽기가 읽는다');
});

test('📋 목록 창 단추 — ▲▼·영역·📌 가 «한 길(layMove)»로 바뀌고 저장된다 · 틀 고정은 영역 고르개로도 못 간다', () => {
  const w = panelWorld(['erp']);
  w.lpRender();
  click(w, btn('down', 'erp'));
  assert.deepEqual(keysOf(w.conts[0]).slice(0, 3), ['cal', 'erp', 'govaid'], '★ ▼ 가 순서를 안 바꿨다');
  let rec = w.calls.filter((c) => c.op === 'set').pop().rec;
  assert.equal(rec.frozen.erp, true, '★ 순서를 바꿨는데 틀 고정이 사라졌다');
  click(w, btn('frz', 'cal'));
  rec = w.calls.filter((c) => c.op === 'set').pop().rec;
  assert.deepEqual(rec.frozen, { erp: true, cal: true }, '★ 📌 단추가 틀 고정을 저장하지 않았다');
  w.lpBodyChange({ target: { matches: (q) => /select/.test(q), dataset: { act: 'row', key: 'erp' }, value: 'inside' } });
  assert.equal(w.origTile('erp').parentNode.dataset.row, 'client', '★★ 틀 고정한 앱이 영역 고르개로 다른 영역에 갔다');
  w.lpBodyChange({ target: { matches: (q) => /select/.test(q), dataset: { act: 'row', key: 'govaid' }, value: 'inside' } });
  assert.equal(w.origTile('govaid').parentNode.dataset.row, 'inside', '★ 틀 고정 아닌 앱이 영역 고르개로 못 갔다');
  rec = w.calls.filter((c) => c.op === 'set').pop().rec;
  assert.equal(rec.rows.govaid, 'inside');
});

test('📋 목록 창 한꺼번에 — 고르기만으로는 안 바뀌고, 묻고 «한 번에» 저장하며, 틀 고정은 건너뛴다', () => {
  const w = panelWorld(['erp']);
  w.lpRender();
  [['cal'], ['erp'], ['mail']].forEach(([k]) => w.lpBodyChange({ target: { classList: { contains: (c) => c === 'lp-ck' }, dataset: { key: k }, checked: true } }));
  assert.equal(w.calls.length, 0, '★ 고르기만 했는데 저장됐다');
  assert.equal(w.els.lpSelBar.hidden, false, '★ 고른 뒤에 「N건 선택」 띠가 안 뜬다');
  assert.match(w.els.lpSelN.textContent, /3건/);
  w.els.lpBulkRow.value = 'inside';
  const asked = [];
  w.confirm = (m) => { asked.push(m); return false; };
  w.lpBulk('row');
  assert.equal(w.calls.length, 0, '★ 아니오 했는데 저장했다');
  assert.match(asked[0], /3개 중 2개/, '★ 건수를 묻지 않았다: ' + asked[0]);
  assert.match(asked[0], /틀 고정한 1개는 옮기지 않습니다/);
  w.confirm = () => true;
  const before = w.calls.filter((c) => c.op === 'set').length;
  w.lpBulk('row');
  const sets = w.calls.filter((c) => c.op === 'set');
  assert.equal(sets.length - before, 1, '★ 한꺼번에 하는 일이 여러 번에 나눠 저장됐다');
  assert.equal(sets[sets.length - 1].rec.rows.cal, 'inside');
  assert.equal(sets[sets.length - 1].rec.rows.mail, 'inside');
  assert.equal(sets[sets.length - 1].rec.rows.erp, 'client', '★★ 틀 고정한 앱이 일괄 옮기기에 딸려 갔다');
  assert.equal(vm.runInContext('Object.keys(_lpSel).length', w), 0, '★ 한 뒤에는 고른 것을 비워야 한다');
});

/* ══ ⑥ 직원 화면 ═════════════════════════════════════════════════════ */
function uiWorld(role, mobile) {
  const w = world(BASE, { mobile });
  ['layoutEditBtn', 'layoutBar', 'meLayout'].forEach((id) => { w.els[id] = fakeEl({ hidden: true }); });
  w.allTiles().forEach((t) => {
    const ic = fakeEl();
    ic.appendChild = (m) => { m.parentNode = ic; ic._mk = m; };
    ic.removeChild = (m) => { ic._mk = null; m.parentNode = null; };
    ic.querySelector = (sel) => (sel === '.lay-freeze' ? ic._mk || null : null);
    t.querySelector = (sel) => (sel === '.ic' ? ic : null);
    t.ic = ic;
  });
  vm.runInContext(`_layoutAdmin = ${role === 'admin'}; _layoutEdit = false;`, w);
  return w;
}
const marks = (w) => w.allTiles().filter((t) => t.ic._mk).length;

test('⑥ 직원 화면에는 편집 단추·편집 줄·내 메뉴 항목·📌 가 «아예 없다» (위임관리인도 같다)', () => {
  const w = uiWorld('staff', false);
  w.updateLockUi();
  assert.equal(w.els.layoutEditBtn.hidden, true, '★★ 직원 화면에 편집 단추가 보인다');
  assert.equal(w.els.layoutBar.hidden, true);
  assert.equal(w.els.meLayout.hidden, true, '★★ 직원 내 메뉴에 배치 편집이 보인다');
  assert.equal(marks(w), 0, '★★ 직원 화면에 📌 가 만들어졌다');
  w.layoutEditToggle();
  assert.equal(vm.runInContext('_layoutEdit', w), false, '★★ 직원이 편집을 켰다');
  const delegate = uiWorld('admin-delegate', false);   // 위임관리인 — render 가 _layoutAdmin 을 role==='admin' 으로만 켠다
  delegate.updateLockUi();
  assert.equal(delegate.els.layoutEditBtn.hidden, true);
  assert.ok(/_layoutAdmin = \(role === 'admin'\)/.test(E), '★ 관리자 판정이 role === admin 에서 벗어났다(위임관리인은 서버가 막는다)');
});

test('⑥ 관리자: PC 는 편집 단추 + 켜면 편집 줄·📌, 폰은 단추 없이 내 메뉴 항목으로 목록 창', () => {
  const pc = uiWorld('admin', false);
  pc.updateLockUi();
  assert.equal(pc.els.layoutEditBtn.hidden, false, '★ 관리자 PC 에 편집 단추가 없다');
  assert.equal(pc.els.layoutBar.hidden, true, '편집을 켜기 전에는 편집 줄이 없다');
  assert.equal(pc.els.meLayout.hidden, false);
  assert.equal(marks(pc), pc.allTiles().length, '★ 관리자 화면 타일마다 📌 가 있어야 한다');
  pc.updateLockUi();
  assert.equal(marks(pc), pc.allTiles().length, '★ 다시 불러도 📌 가 겹쳐 생기면 안 된다');
  pc.layoutEditToggle();
  assert.equal(vm.runInContext('_layoutEdit', pc), true);
  assert.equal(pc.els.layoutBar.hidden, false, '★ 편집을 켰는데 편집 줄이 안 뜬다');
  assert.equal(pc.document.body.classList.contains('lay-editing'), true);
  pc.layoutEditToggle();
  assert.equal(pc.els.layoutBar.hidden, true);
  const ph = uiWorld('admin', true);
  ph.updateLockUi();
  assert.equal(ph.els.layoutEditBtn.hidden, true, '★ 폰에는 끌기 단추가 필요 없다');
  assert.equal(ph.els.meLayout.hidden, false, '★★ 폰 관리자가 편집으로 들어갈 길이 없다');
  ph.layoutEditToggle();
  assert.equal(ph.panelOpened, 1, '★ 폰에서는 목록 창이 열려야 한다');
  assert.equal(vm.runInContext('_layoutEdit', ph), false);
});

test('⑥ 기본은 «감춘 채»다 — 로그인 전·직원 화면에 잠깐도 안 보인다 (마크업)', () => {
  for (const id of ['layoutEditBtn', 'layoutBar', 'layoutPanel', 'meLayout', 'lpSelBar']) {
    const tag = E.match(new RegExp('<[a-z]+[^>]*id="' + id + '"[^>]*>'));
    assert.ok(tag, '★ ' + id + ' 칸이 없다');
    assert.match(tag[0], /\shidden(\s|>|=)/, '★★ ' + id + ' 가 기본으로 보인다 — 직원 화면에 깜빡 나타난다');
  }
});

/* ══ ⑦ 설정 창 저장 ═════════════════════════════════════════════════ */
function cfgWorld(layoutOnServer, readFails) {
  const els = {};
  const el = (id) => (els[id] = els[id] || fakeEl({ value: '' }));
  const ctx = { console, setTimeout: () => 0, calls: [], SG: { name: '대표' }, sgIsAdmin: () => true, cfgClose() {}, cfgCollectExtra: () => ({ obj: {}, bad: null }) };
  vm.createContext(ctx);
  vm.runInContext(PATH_SRC + "\nvar CFG_PATH = 'data/app_config';\n" + E.match(/var CFG_FIELDS = [^;]+;/)[0], ctx);
  ctx.$ = (id) => el(id);
  ctx.db = { ref: (p) => ({
    once: () => (readFails ? Promise.reject(new Error('offline')) : Promise.resolve({ val: () => layoutOnServer })),
    set: (rec) => { ctx.calls.push({ path: p, rec: JSON.parse(JSON.stringify(rec)) }); return Promise.resolve(); },
  }) };
  vm.runInContext(cutFn(E, 'function cfgSave('), ctx);
  ctx.els = els;
  return ctx;
}

test('⑦ 설정 창에서 저장해도 앱 배치가 «지워지지 않는다»', async () => {
  const layout = { v: 1, order: ['erp', 'hr'], rows: { erp: 'client', hr: 'inside' }, frozen: { hr: true } };
  const w = cfgWorld(layout);
  w.cfgSave(); await new Promise((r) => setImmediate(r));
  const set = w.calls.find((c) => c.path === 'data/app_config');
  assert.ok(set, '★ 설정이 저장되지 않았다');
  assert.deepEqual(set.rec.portalLayout, layout, '★★ 설정 창 저장이 포털 앱 배치를 지웠다 — 이 자리는 통째로 바뀐다');
});

test('⑦ 배치를 못 읽으면 설정도 «저장하지 않는다» — 모르는 채로 덮어쓰면 지워진다', async () => {
  const w = cfgWorld(null, true);
  w.cfgSave(); await new Promise((r) => setImmediate(r));
  assert.equal(w.calls.length, 0, '★★ 배치를 읽지 못했는데 설정을 통째로 덮어썼다');
  assert.match(w.els.cfgStat.textContent, /실패/, '★ 저장 못 한 것을 알려야 한다');
});

test('⑦ 배치가 아직 없으면 설정에 빈 배치를 만들어 넣지 않는다', async () => {
  const w = cfgWorld(null);
  w.cfgSave(); await new Promise((r) => setImmediate(r));
  const set = w.calls.find((c) => c.path === 'data/app_config');
  assert.ok(set); assert.equal('portalLayout' in set.rec, false);
});

/* ══ ⑧ 저장 자리의 쓰기 규칙 — 관리자만 ═══════════════════════════════ */
class Snap {
  constructor(v) { this.v = v; }
  child(p) { let c = this.v; for (const k of String(p).split('/')) c = c && typeof c === 'object' ? c[k] : undefined; return new Snap(c); }
  val() { return this.v; }
  exists() { return this.v !== undefined && this.v !== null; }
  hasChildren(keys) { return keys.every((k) => this.child(k).exists()); }
  isString() { return typeof this.v === 'string'; }
}
const ROLES = {
  adminUid: { isAdmin: true, isSubAdmin: false, status: 'active', sid: 'P-001' },
  subUid: { isAdmin: false, isSubAdmin: true, status: 'active', sid: 'P-003' },
  staffUid: { isAdmin: false, isSubAdmin: false, status: 'active', sid: 'A-001' },
};
const authOf = (uid) => ({ uid, token: { firebase: { sign_in_provider: 'password' }, email: uid + '@pureun.kr' } });
function allowed(expr, uid) {
  const names = ['auth', 'root', 'data', 'newData', '$uid', '$id'];
  /* 파이어베이스는 규칙 계산이 오류(예: 로그인 안 한 auth.uid)를 내면 «막는다» */
  try { return Function(...names, '"use strict"; return Boolean(' + expr + ');')(uid ? authOf(uid) : null, new Snap({ uid_roles: ROLES, sid_roles: {} }), new Snap(undefined), new Snap({}), '', ''); }
  catch (e) { return false; }
}

test('⑧ 배치를 두는 자리(data/app_config)는 «읽기 직원 · 쓰기 관리자만» — 위임관리인도 못 쓴다', () => {
  const generated = JSON.parse(execFileSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'make-firebase-rules.js')], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })).rules;
  const deployed = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'docs', 'firebase-rules-전체-적용본.json'), 'utf8')).rules;
  for (const [name, rules] of [['생성기', generated], ['적용본', deployed]]) {
    const r = rules.data.app_config;
    assert.ok(r, '★ ' + name + ' 에 app_config 규칙이 없다');
    assert.equal(allowed(r['.write'], 'adminUid'), true, '★ ' + name + ': 관리자가 못 쓴다');
    assert.equal(allowed(r['.write'], 'subUid'), false, '★★ ' + name + ': 위임관리인이 쓸 수 있다 — 「권형하만」이 깨진다');
    assert.equal(allowed(r['.write'], 'staffUid'), false, '★★ ' + name + ': 직원이 쓸 수 있다');
    assert.equal(allowed(r['.write'], null), false, '★★ ' + name + ': 로그인 안 한 사람이 쓸 수 있다');
    assert.equal(allowed(r['.read'], 'staffUid'), true, '★ ' + name + ': 직원이 배치를 못 읽으면 같은 배치를 볼 수 없다');
    assert.equal(allowed(r['.read'], null), false, '★ ' + name + ': 로그인 안 한 사람이 읽을 수 있다');
    assert.equal(Object.keys(r).filter((k) => k[0] !== '.').length, 0, '★ ' + name + ': app_config 밑에 자식 규칙이 생겼다 — 쓰기 권한이 갈라질 수 있다');
  }
});

test('⑧ 서버에 쓰는 자리 글자(경로)가 규칙이 걸린 자리 «밑»이다', () => {
  assert.match(vm.runInContext(PATH_SRC + '\nLAYOUT_PATH', vm.createContext({})), /^data\/app_config\/[A-Za-z]+$/,
    '★ 공용 배치를 규칙이 걸리지 않은 다른 자리에 두면 직원이 쓸 수 있다');
});
