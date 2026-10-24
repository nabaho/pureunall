/* 포털 «자주 쓰는 앱 + 이름 줄» 접기 (대표 2026-10-24 시안 2)
   「앱을 한화면에 다나오는것 말고 접어다 펴는 방식도 검토」 → 시안 넷 →
   「추천대로하고 폰에서도 추천대로 해달라 그리고 폰에서는 화면안 밖으로 나가면 안된다」

   지키는 규칙
   ① 줄 머리는 누르면 접히고 펴지는 «단추»다(키보드로도).
   ② 맨 위에 «자주 쓰는 앱» 줄 · 검색칸 · 「모두 펴기·접기」가 있다.
   ③ 처음에는 줄이 «이름 칩»으로 접혀 있다(대표 2026-10-24 「니가 보여준건 길게 되었는데 왜 화면은 동그랗나」).
      사람이 편 줄은 편 채로 기억하고, 찾는 중에는 다 펼친다.
   ④ 별표 수에는 한도가 있다.
   ⑤ 별표를 눌러도 앱이 열리지 않는다.
   ⑥ 복제한 타일(자주 쓰는 앱 줄)에는 data-key 가 없다 — 알림 딱지를 붙이는 곳이
      `.tile[data-key="…"]` 로 «첫 번째» 타일을 찾으므로, 복제본이 그 자리를 가로채면 안 된다.
   ⑦ 폰에서 접힌 줄은 «줄을 바꿔» 흐른다 — 옆으로 밀거나 화면 밖으로 나가지 않는다(대표 지시).
   ⑧ 앱을 마우스로 끌어 «자주 쓰는 앱» 줄에 놓으면 들어간다 — 놓은 자리에
      (대표 2026-10-24 「자주쓰는앱은 마우스로 위로 드래그해서 올릴수 있게 해라」). */
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
    cutFn(E, 'function pinAt('),
    cutFn(E, 'function togglePin('),
  ].join('\n');
  const ctx = {
    APP_ROWS: [{ id: 'client' }, { id: 'store' }, { id: 'sales' }, { id: 'inside' }],
    tilePrefs: { pins: null, fold: null },
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

test('③ 처음에는 줄이 이름 칩으로 접혀 있다 — 별표가 없어도 (대표 「왜 화면은 동그랗나」)', () => {
  const c = foldBox();
  c.APP_ROWS.forEach((r) =>
    assert.strictEqual(c.rowFolded(r.id), true, '★ 처음 화면에서 ' + r.id + ' 줄이 동그란 타일로 펼쳐져 있다'));
  c.tilePrefs.fold = { client: false };
  assert.strictEqual(c.rowFolded('client'), false, '★ 사람이 펴 둔 줄을 다시 접는다');
  assert.strictEqual(c.rowFolded('store'), true, '★ 손대지 않은 줄이 펼쳐진다');
  c._searchQ = '메일';
  assert.strictEqual(c.rowFolded('store'), false, '★ 찾는 중인데 줄이 접혀 찾은 앱이 안 보인다');
});

test('③ 별표로 넣고 다시 누르면 뺀다 — 저장한다', () => {
  const c = foldBox();
  c.togglePin('a1');
  assert.deepStrictEqual(Array.from(c.tilePrefs.pins), ['a1']);
  c.togglePin('a1');
  assert.deepStrictEqual(Array.from(c.tilePrefs.pins), [], '★ 별표를 다시 눌러도 빠지지 않는다');
  assert.ok(c.saved >= 2, '★ 넣고 뺀 것을 저장하지 않는다');
});

test('⑧ 끌어 놓으면 «놓은 자리»에 들어간다 — 이미 있으면 자리만 옮기고, 한도를 지킨다', () => {
  const c = foldBox();
  c.pinAt('a0', 0); c.pinAt('a1', 1); c.pinAt('a2', 2);
  assert.deepStrictEqual(Array.from(c.tilePrefs.pins), ['a0', 'a1', 'a2']);
  c.pinAt('a3', 1);
  assert.deepStrictEqual(Array.from(c.tilePrefs.pins), ['a0', 'a3', 'a1', 'a2'], '★ 놓은 자리가 아닌 데로 들어갔다');
  c.pinAt('a2', 0);
  assert.deepStrictEqual(Array.from(c.tilePrefs.pins), ['a2', 'a0', 'a3', 'a1'], '★ 이미 있는 앱을 끌었는데 둘이 됐거나 자리가 틀렸다');
  c.pinAt('a0', 99);
  assert.deepStrictEqual(Array.from(c.tilePrefs.pins), ['a2', 'a3', 'a1', 'a0'], '★ 맨 뒤에 놓았는데 엉뚱한 자리');
  for (let i = 4; i < c.PIN_MAX; i++) c.pinAt('a' + i, 0);
  const before = c.alerts;
  c.pinAt('a' + c.PIN_MAX, 0);
  assert.strictEqual(c.tilePrefs.pins.length, c.PIN_MAX, '★ 끌어 놓기로 한도를 넘었다');
  assert.strictEqual(c.alerts, before + 1, '★ 왜 안 들어가는지 말하지 않는다');
  c.pinAt('a0', 0);
  assert.strictEqual(c.tilePrefs.pins.length, c.PIN_MAX, '★ 한도에서 «자리 옮기기»까지 막았다');
  assert.strictEqual(c.tilePrefs.pins[0], 'a0');
});

test('⑧ 자주 쓰는 앱 줄이 끌어 놓기를 받는다 (PC)', () => {
  const wire = cutFn(E, 'function initFold(');
  assert.match(wire, /'dragover'/, '★ 자주 쓰는 앱 줄 위로 끌어도 받지 않는다');
  assert.match(wire, /'drop'/, '★ 자주 쓰는 앱 줄에 놓아도 아무 일이 없다');
  assert.match(wire, /pinAt\(/, '★ 놓은 앱을 넣지 않는다');
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
  assert.match(fn, /c\.draggable =/, '★ 복제본의 끌기를 정하지 않았다 — 진짜 타일의 끌기 설정을 그대로 물려받는다');
});

test('⑦ 폰: 접힌 줄은 화면 폭을 따라 칸 수가 준다 — 옆으로 밀거나 화면 밖으로 나가지 않는다', () => {
  const r = rulesFor('.tilerow.fold .tiles');
  assert.ok(r.length > 0, '★ 접힌 줄 모양이 없다');
  /* 줄바꿈(flex-wrap) 이든 «폭 따라 칸 수가 주는 격자»(auto-fill/auto-fit + minmax) 든 —
     칩이 화면 폭을 넘지 않는 길이면 된다. 칸 수를 못 박은 격자(repeat(4,…))는 안 된다. */
  const flows = r.some((b) => /flex-wrap:wrap/.test(b) ||
    (/display:grid/.test(b) && /repeat\(auto-(fill|fit),\s*minmax\(/.test(b)));
  assert.ok(flows, '★ 칩 칸 수가 화면 폭을 안 따른다 — 폰에서 화면 밖으로 나간다');
  r.forEach((b) => {
    assert.ok(!/nowrap|overflow-x\s*:\s*(auto|scroll)/.test(b),
      '★ 접힌 줄을 옆으로 밀게 만들었다 — 대표 지시 「폰에서는 화면 안 밖으로 나가면 안 된다」');
  });
});

test('⑨ 행·열이 맞는다 — 접힌 줄의 칩은 같은 폭 칸(격자)에 선다 (대표 「행 열 간격 정리 해라」)', () => {
  const r = rulesFor('.tilerow.fold .tiles');
  assert.ok(r.some((b) => /display:grid/.test(b) && /grid-template-columns:/.test(b)),
    '★ 칩이 제 글자 길이만큼 서서 줄마다 세로 열이 어긋난다');
});

test('⑨ 빨간 딱지가 칩 폭을 늘리지 않는다 — 귀퉁이에 떠 있다 (대표 「칸넓게 안늘어나는지」)', () => {
  ['.tilerow.fold .tile-alert', '.tilerow.fold .tile .nl-warn'].forEach((sel) => {
    const r = rulesFor(sel);
    assert.ok(r.length > 0, '★ 접힌 줄에서 ' + sel + ' 자리를 안 정했다');
    assert.ok(r.some((b) => /position:absolute/.test(b)),
      '★ ' + sel + ' 이 칩 안에 글자처럼 서서 그 칩만 넓어진다');
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
