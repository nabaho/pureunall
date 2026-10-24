'use strict';
/* 앱바 «프로그램 이동» 목록 — 의뢰인 업무·자료함만, 칸을 나눠서 (대표 지시 2026-10-11)

   「즐겨찾기에 의뢰인 업무와 자료함만 즐겨찾기가 되게 해라 그리고 즐겨찾기 의뢰인업무 자료함을 중간에 구분해서 확인하게해라」
   → 목업 → 「영업 내부관리 빼는 것으로 진행」
   ■ 규칙
     ⓐ 목록에는 포털의 «의뢰인 업무(client)·자료함(store)» 줄 앱만 — 영업관리·내부관리는 빠진다.
     ⓑ 별표는 그 앱들에만. 예전에 단 영업·내부관리 별표는 즐겨찾기로 안 친다(저장값은 지우지 않는다).
     ⓒ 차례: ⭐ 즐겨찾기 → 의뢰인 업무 → 자료함, 칸마다 머리줄. 즐겨찾기한 앱은 제 칸에 다시 안 나온다.
     ⓓ 줄 나눔은 포털(enter.html)의 row 와 같다 — 한쪽만 바뀌면 여기서 걸린다.
     ⓔ 빠진 앱도 APPS 에는 남는다 — 그 앱 안에서 «지금 어느 앱인지»를 알아본다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const R = path.join(__dirname, '..');

function load(role, stored) {
  const store = Object.assign({}, stored || {});
  const made = [];
  const el = (tag) => {
    const n = { tag, style: {}, attrs: {}, kids: [], textContent: '', innerHTML: '',
      setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k]; }, hasAttribute(k) { return k in this.attrs; },
      appendChild(c) { this.kids.push(c); return c; }, addEventListener() {}, remove() {}, querySelector: () => null,
      getBoundingClientRect: () => ({ left: 0, top: 0, bottom: 20, right: 100, width: 100, height: 20 }) };
    Object.defineProperty(n, 'innerHTML', { get() { return ''; }, set() { n.kids = []; } });
    made.push(n); return n;
  };
  const win = { innerWidth: 1200, innerHeight: 900 };
  if (role !== null) win.PuWhoami = { get: () => ({ role }), onChange() {} };
  const ctx = {
    window: win,
    document: { createElement: el, querySelector: () => null, body: { appendChild() {} }, addEventListener() {}, removeEventListener() {} },
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; } },
    setInterval: () => 0, clearInterval() {}, setTimeout: () => 0, clearTimeout() {}
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(R, 'js', 'pu-appbar.js'), 'utf8'), ctx);
  return { B: win.PuAppBar, store, made };
}
const keys = (B) => [...B._ordered().map((a) => a.key)];
const rowOf = (B, k) => B.APPS.find((a) => a.key === k).row;

test('ⓐ 목록에는 의뢰인 업무·자료함 앱만 — 영업·내부관리는 관리자에게도 빠진다', () => {
  const { B } = load('admin');
  const k = keys(B);
  assert.ok(k.length >= 8, '목록이 너무 짧다');
  k.forEach((x) => assert.ok(['client', 'store'].includes(rowOf(B, x)), x + ' 는 의뢰인 업무·자료함 앱이 아니다'));
  ['hr', 'fin', 'career', 'govbid', 'rehabad', 'home', 'news'].forEach((x) => assert.ok(!k.includes(x), x + ' 가 목록에 남았다'));
  ['erp', 'cards', 'photos', 'work', 'docs'].forEach((x) => assert.ok(k.includes(x), x + ' 가 목록에서 사라졌다'));
});

test('ⓑ 별표는 의뢰인 업무·자료함에만 — 영업·내부관리 별표는 안 붙고, 예전 것은 즐겨찾기로 안 친다', () => {
  const { B, store } = load('admin', { pu_appbar_favs: JSON.stringify(['news', 'cards', 'hr']) });
  assert.deepEqual([...B.favs()], ['cards'], '예전 영업·내부관리 별표가 즐겨찾기로 남았다');
  B.toggleFav('home');
  assert.ok(!B.favs().includes('home'), '홈페이지(영업관리)에 별표가 붙었다');
  B.toggleFav('erp');
  assert.ok(B.favs().includes('erp'));
  assert.ok(!JSON.parse(store.pu_appbar_favs).includes('home'));
});

test('ⓒ 차례 — 즐겨찾기 → 의뢰인 업무 → 자료함, 즐겨찾기한 앱은 맨 위 한 번만', () => {
  const { B } = load('admin', { pu_appbar_favs: JSON.stringify(['photos', 'erp']) });
  const k = keys(B);
  assert.deepEqual(k.slice(0, 2).sort(), ['erp', 'photos']);
  assert.equal(k.filter((x) => x === 'photos').length, 1, '즐겨찾기한 앱이 두 번 나온다');
  const rest = k.slice(2).map((x) => rowOf(B, x));
  const firstStore = rest.indexOf('store');
  assert.ok(firstStore > 0, '의뢰인 업무가 먼저 와야 한다');
  assert.ok(rest.slice(firstStore).every((r) => r === 'store'), '자료함 다음에 의뢰인 업무가 섞였다');
});

test('ⓒ 칸 머리줄을 그린다 — ⭐ 즐겨찾기 · 의뢰인 업무 · 자료함', () => {
  const src = fs.readFileSync(path.join(R, 'js', 'pu-appbar.js'), 'utf8');
  assert.match(src, /secHead\('fav', '⭐ 즐겨찾기'\)/);
  assert.match(src, /var ROWS = \[\{ id: 'client', label: '의뢰인 업무' \}, \{ id: 'store', label: '자료함' \}\];/);
  assert.match(src, /data-pu-sec/);
});

test('ⓓ 줄 나눔은 포털과 같다', () => {
  const { B } = load('admin');
  const enter = fs.readFileSync(path.join(R, 'enter.html'), 'utf8');
  B.APPS.forEach((a) => {
    const line = enter.split(/\r?\n/).find((l) => l.includes("key:'" + a.key + "'") && l.includes('row:'));
    if (!line) return;   // 포털에 없는 앱(메일 등 다른 이름)은 건너뛴다
    const m = line.match(/row:'([a-z]+)'/);
    assert.equal(a.row, m[1], a.key + ' 의 줄이 포털과 다르다(앱바 ' + a.row + ' · 포털 ' + m[1] + ')');
  });
});

test('ⓔ 빠진 앱도 APPS 에는 남는다 — 그 앱 안에서 제 이름을 알아본다', () => {
  const { B } = load('admin');
  const all = B.APPS.map((a) => a.key);
  ['hr', 'fin', 'career', 'home', 'news', 'govbid'].forEach((x) => assert.ok(all.includes(x), x + ' 가 APPS 에서 지워졌다'));
  B.APPS.forEach((a) => assert.ok(a.row, a.key + ' 에 row 가 없다'));
});

test('ⓕ 「지금 안 씀」(off) 앱은 앱 막대 목록에도 없다 — 관리자 포함 (대표 지시 2026-10-24)', () => {
  /* 포털 타일의 off 와 짝 — 타일만 감추면 앱 막대 «프로그램 이동»으로 그대로 들어간다. */
  ['admin', 'staff'].forEach((role) => {
    const { B } = load(role);
    const k = keys(B);
    ['rules', 'payroll', 'paydata'].forEach((x) => assert.ok(!k.includes(x), role + ' 앱 막대에 ' + x + ' 가 남았다'));
    ['erp', 'cards', 'photos', 'docs'].forEach((x) => assert.ok(k.includes(x), x + ' 까지 사라졌다'));
  });
  const { B } = load('admin');
  ['rules', 'payroll', 'paydata'].forEach((x) => assert.ok(B.APPS.find((a) => a.key === x), x + ' 를 APPS 에서 지웠다 — 그 앱 안에서 whoAmI 가 길을 잃는다'));
});
