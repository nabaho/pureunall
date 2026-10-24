/* 포털 «자주 쓰는 앱 + 이름 줄» 접기 (대표 2026-10-24 시안 2)
   「앱을 한화면에 다나오는것 말고 접어다 펴는 방식도 검토」 → 시안 넷 →
   「추천대로하고 폰에서도 추천대로 해달라 그리고 폰에서는 화면안 밖으로 나가면 안된다」

   지키는 규칙
   ① 줄 머리는 누르면 접히고 펴지는 «단추»다(키보드로도).
   ② 맨 위에 «자주 쓰는 앱» 줄 · 검색칸 · 「모두 펴기·접기」가 있다.
   ③ 별표가 없으면 지금처럼 다 펼친 채, 별표가 있으면 손대지 않은 줄은 접힌 채로 시작.
      첫 별표를 누른 순간 보던 줄이 갑자기 접히지는 않는다.
   ④ 별표 수에는 한도가 있다.
   ⑤ 별표를 눌러도 앱이 열리지 않는다.
   ⑥ 복제한 타일(자주 쓰는 앱 줄)에는 data-key 가 없다 — 알림 딱지를 붙이는 곳이
      `.tile[data-key="…"]` 로 «첫 번째» 타일을 찾으므로, 복제본이 그 자리를 가로채면 안 된다.
   ⑦ 폰에서 접힌 줄은 «줄을 바꿔» 흐른다 — 옆으로 밀거나 화면 밖으로 나가지 않는다(대표 지시). */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { cutFn } = require('./cut-fn');

const E = fs.readFileSync(path.join(__dirname, '..', 'enter.html'), 'utf8');
const HEAD = E.slice(0, E.indexOf('</head>'));
const BODY = E.slice(E.indexOf('</head>'));

/* CSS 에서 어떤 선택자의 규칙 몸통을 모두 모은다(폰 구간 안의 것까지). */
function rulesFor(sel) {
  const out = [];
  let at = 0;
  for (;;) {
    const i = HEAD.indexOf(sel + '{', at);
    if (i < 0) break;
    const j = HEAD.indexOf('}', i);
    out.push(HEAD.slice(i + sel.length + 1, j));
    at = j;
  }
  return out;
}

test('① 줄 머리는 누르면 접히는 단추다 (키보드로도)', () => {
  const build = cutFn(E, 'function buildAppRows(');
  assert.match(build, /data-fold-row=/, '★ 줄 머리에 접기 표시(data-fold-row)가 없다');
  assert.match(build, /aria-expanded=/, '★ 펼침 상태를 화면읽기에 알리지 않는다');
  assert.match(build, /role="button"/, '★ 줄 머리가 단추로 읽히지 않는다');
  assert.match(build, /tabindex="0"/, '★ 키보드로 줄 머리에 갈 수 없다');
  const wire = cutFn(E, 'function initFold(');
  assert.match(wire, /data-fold-row/, '★ 줄 머리를 눌러도 아무 일이 없다');
  assert.match(wire, /Enter/, '★ 키보드(Enter)로 접을 수 없다');
});

test('② 자주 쓰는 앱 줄 · 검색칸 · 모두 펴기 단추가 «줄들보다 위»에 있다', () => {
  ['pinRow', 'pinTiles', 'appSearch', 'foldAllBtn'].forEach((id) =>
    assert.ok(BODY.indexOf('id="' + id + '"') > 0, '★ ' + id + ' 칸이 없다'));
  assert.ok(BODY.indexOf('id="pinRow"') < BODY.indexOf('id="appRows"'),
    '★ 자주 쓰는 앱 줄이 네 줄보다 아래에 있다');
});

function foldBox() {
  const src = [
    E.match(/var PIN_MAX = \d+;/)[0],
    cutFn(E, 'function pinKeys('),
    cutFn(E, 'function rowFolded('),
    cutFn(E, 'function togglePin('),
  ].join('\n');
  const ctx = {
    APP_ROWS: [{ id: 'client' }, { id: 'store' }, { id: 'sales' }, { id: 'inside' }],
    tilePrefs: { pins: null, fold: null },
    _foldSession: {},
    _searchQ: '',
    APPS: [], alerts: 0, saved: 0,
    saveTilePrefs() { ctx.saved++; },
    paintPins() {}, applyFold() {},
    alert() { ctx.alerts++; },
  };
  /* 보이는 별표 = 저장된 별표 (상자 안에는 감춘 타일이 없다) */
  ctx.pinnedVisible = () => (ctx.tilePrefs.pins || []).slice();
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  ctx.APPS = Array.from({ length: ctx.PIN_MAX + 3 }, (_, i) => ({ key: 'a' + i }));
  return ctx;
}

test('③ 별표가 없으면 다 펼친 채, 별표가 있으면 손대지 않은 줄은 접힌 채로 시작', () => {
  const c = foldBox();
  assert.strictEqual(c.rowFolded('client'), false, '★ 별표가 없는데 줄이 접혀 있다 — 지금 화면이 바뀐다');
  c.tilePrefs.pins = ['a0'];
  assert.strictEqual(c.rowFolded('client'), true, '★ 별표가 있는데 줄이 다 펼쳐져 있다');
  c.tilePrefs.fold = { client: false };
  assert.strictEqual(c.rowFolded('client'), false, '★ 사람이 펴 둔 줄을 다시 접는다');
  c.tilePrefs.pins = [];
  c.tilePrefs.fold = { store: true };
  assert.strictEqual(c.rowFolded('store'), true, '★ 사람이 접어 둔 줄을 다시 편다');
  c._searchQ = '메일';
  assert.strictEqual(c.rowFolded('store'), false, '★ 찾는 중인데 줄이 접혀 찾은 앱이 안 보인다');
});

test('③ 첫 별표를 누른 순간 보던 줄은 접히지 않는다 — 다음에 열 때부터 접힌다', () => {
  const c = foldBox();
  c.togglePin('a1');
  assert.deepStrictEqual(Array.from(c.tilePrefs.pins), ['a1']);
  c.APP_ROWS.forEach((r) =>
    assert.strictEqual(c.rowFolded(r.id), false, '★ 별표를 누르자 ' + r.id + ' 줄이 갑자기 접혔다'));
  c._foldSession = {};   /* 다음에 포털을 열면 */
  assert.strictEqual(c.rowFolded('client'), true, '★ 다음에 열어도 접히지 않는다');
  c.togglePin('a1');
  assert.deepStrictEqual(Array.from(c.tilePrefs.pins), [], '★ 별표를 다시 눌러도 빠지지 않는다');
  assert.ok(c.saved >= 2, '★ 넣고 뺀 것을 저장하지 않는다');
});

test('④ 별표 수에는 한도가 있다 — 넘으면 넣지 않고 까닭을 말한다', () => {
  const c = foldBox();
  assert.ok(c.PIN_MAX > 0);
  for (let i = 0; i < c.PIN_MAX; i++) c.togglePin('a' + i);
  assert.strictEqual(c.tilePrefs.pins.length, c.PIN_MAX);
  c.togglePin('a' + c.PIN_MAX);
  assert.strictEqual(c.tilePrefs.pins.length, c.PIN_MAX, '★ 한도를 넘어 들어갔다');
  assert.strictEqual(c.alerts, 1, '★ 왜 안 들어가는지 말하지 않는다');
});

test('⑤ 별표를 눌러도 앱이 열리지 않는다', () => {
  const fn = cutFn(E, 'function onPinStarClick(');
  assert.match(fn, /preventDefault\(\)/, '★ 별표를 누르면 타일 주소로 넘어간다(폰)');
  assert.match(fn, /stopPropagation\(\)/, '★ 별표를 누르면 타일의 «열기»가 함께 돈다(PC)');
});

test('⑥ 자주 쓰는 앱 줄의 복제 타일에는 data-key 가 없다', () => {
  const fn = cutFn(E, 'function paintPins(');
  assert.match(fn, /cloneNode\(true\)/);
  assert.match(fn, /removeAttribute\('data-key'\)/,
    '★ 복제본이 data-key 를 지닌다 — 알림 딱지가 진짜 타일 대신 복제본에 붙는다');
  assert.match(fn, /draggable = false/, '★ 복제본을 끌면 순서 저장이 엉킨다');
});

test('⑦ 폰: 접힌 줄은 줄을 바꿔 흐른다 — 옆으로 밀거나 화면 밖으로 나가지 않는다', () => {
  const r = rulesFor('.tilerow.fold .tiles');
  assert.ok(r.length > 0, '★ 접힌 줄 모양이 없다');
  assert.ok(r.some((b) => /display:flex/.test(b)), '★ 폰의 네 칸 격자를 그대로 써서 칩이 칸에 갇힌다');
  assert.ok(r.some((b) => /flex-wrap:wrap/.test(b)), '★ 칩이 줄을 안 바꾼다 — 화면 밖으로 나간다');
  r.forEach((b) => {
    assert.ok(!/nowrap|overflow-x\s*:\s*(auto|scroll)/.test(b),
      '★ 접힌 줄을 옆으로 밀게 만들었다 — 대표 지시 「폰에서는 화면 안 밖으로 나가면 안 된다」');
  });
});

test('⑦ 폰: 검색칸 글씨가 16px 이상이다 (아이폰이 화면을 확대하지 않게)', () => {
  const r = rulesFor('.fold-search input');
  assert.ok(r.some((b) => /font-size:\s*16px/.test(b)), '★ 폰에서 검색칸을 누르면 화면이 확대된다');
});

test('설정을 읽을 때 별표·접힘을 버리지 않는다 (기기·서버 둘 다)', () => {
  const box = { };
  vm.createContext(box);
  vm.runInContext(cutFn(E, 'function tilePrefsFrom('), box);
  const p = box.tilePrefsFrom({ order: ['erp'], pins: ['erp', 3, 'mail'], fold: { store: true } });
  assert.deepStrictEqual(Array.from(p.pins), ['erp', 'mail'], '★ 별표 목록을 버렸거나 이상한 값을 남겼다');
  assert.strictEqual(p.fold.store, true, '★ 접힘을 버렸다');
  const empty = box.tilePrefsFrom(null);
  assert.strictEqual(empty.pins, null);
  const init = cutFn(E, 'function initTileOrder(');
  assert.ok((init.match(/tilePrefsFrom\(/g) || []).length >= 2,
    '★ 기기 저장분이나 서버 저장분 한쪽이 별표·접힘을 버린다');
});
