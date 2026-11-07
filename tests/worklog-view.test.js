'use strict';
/* 작업 기록 화면 (견적·계약 자동화 계획 1 · 작업 3)
   순수 함수(달 이동·거르기·사람 집계)와, 빈 달·권한 없음 문구를 확인한다. document 는 아주 작은 대역을 쓴다. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const { test } = require('node:test');

const SRC = fs.readFileSync(path.join(__dirname, '../js/pu-worklog-view.js'), 'utf8').replace(/\r\n/g, '\n');

function node(tag) {
  const n = { tag, children: [], attrs: {}, listeners: {}, _text: '', style: {} };
  n.appendChild = (c) => { n.children.push(c); return c; };
  n.setAttribute = (k, v) => { n.attrs[k] = v; };
  n.addEventListener = (ev, fn) => { n.listeners[ev] = fn; };
  Object.defineProperty(n, 'textContent', { get() { return n._text; }, set(v) { n._text = String(v); n.children = []; } });
  Object.defineProperty(n, 'innerHTML', { get() { return ''; }, set() { n.children = []; n._text = ''; } });
  return n;
}
function textOf(n) { return n._text + n.children.map(textOf).join(' '); }
function load() {
  const document = { createElement: node, head: node('head') };
  const box = { console, Date, Math, JSON, Promise, Object, Array, String, Number, Error, document };
  box.window = box;
  vm.createContext(box);
  vm.runInContext(SRC, box);
  return box.PuWorklogView;
}
const out = (v) => JSON.parse(JSON.stringify(v));
const tick = () => new Promise((r) => setTimeout(r, 0));

test('shiftMonth — 해를 넘겨도 맞다', () => {
  const V = load();
  assert.equal(V.shiftMonth('202601', -1), '202512');
  assert.equal(V.shiftMonth('202612', 1), '202701');
  assert.equal(V.shiftMonth('202611', -1), '202610');
});

const ROWS = [
  { id: 'a', kind: 'download', at: 3, by: 'u1', byName: '김철수' },
  { id: 'b', kind: 'form_save', at: 2, by: 'u2', byName: '이영희' },
  { id: 'c', kind: 'download', at: 1, by: 'u1', byName: '김철수' },
  { id: 'd', kind: 'download', at: 0, by: 'u2', byName: '이영희' }
];

test('filterRows — 사람·종류를 함께 건다', () => {
  const V = load();
  assert.deepEqual(out(V.filterRows(ROWS, {}).map((r) => r.id)), ['a', 'b', 'c', 'd']);
  assert.deepEqual(out(V.filterRows(ROWS, { by: '김철수' }).map((r) => r.id)), ['a', 'c']);
  assert.deepEqual(out(V.filterRows(ROWS, { kind: 'download' }).map((r) => r.id)), ['a', 'c', 'd']);
  assert.deepEqual(out(V.filterRows(ROWS, { by: '이영희', kind: 'download' }).map((r) => r.id)), ['d']);
});

test('people — 많은 순, 이름이 없으면 아이디 대신 «이름 없음»', () => {
  const V = load();
  const rows = ROWS.concat([{ id: 'e', kind: 'upload', at: 5, by: 'u1', byName: '김철수' }, { id: 'f', kind: 'upload', at: 6, by: 'u9' }]);
  assert.deepEqual(out(V.people(rows)), [{ name: '김철수', n: 3 }, { name: '이영희', n: 2 }, { name: '이름 없음', n: 1 }]);
});

test('fmtTime — 한국 시간 MM.DD HH:mm', () => {
  const V = load();
  assert.equal(V.fmtTime(Date.UTC(2026, 10, 7, 15, 5)), '11.08 00:05');
});

test('mount — 빈 달이면 «이 달에는 기록이 없습니다»', async () => {
  const V = load();
  const root = node('div');
  const asked = [];
  V.mount(root, { list: (m) => { asked.push(m); return Promise.resolve([]); }, kinds: {}, now: () => Date.UTC(2026, 10, 7, 3, 0) });
  await tick();
  assert.deepEqual(asked, ['202611']);
  assert.match(textOf(root), /2026년 11월/);
  assert.match(textOf(root), /이 달에는 기록이 없습니다/);
});

test('mount — 읽기가 거절되면 짧은 안내만 그린다(죽지 않는다)', async () => {
  const V = load();
  const root = node('div');
  V.mount(root, { list: () => Promise.reject(new Error('PERMISSION_DENIED')), kinds: {}, now: () => 0 });
  await tick();
  assert.match(textOf(root), /총괄관리자만 볼 수 있습니다/);
});

test('mount — 줄을 그리고 자동 표시를 붙인다', async () => {
  const V = load();
  const root = node('div');
  const rows = [{ id: 'x', kind: 'auto_detect', at: Date.UTC(2026, 10, 7, 3, 0), by: 'u1', byName: '김철수', target: '가나상사', note: '메모', auto: 'mail' }];
  V.mount(root, { list: () => Promise.resolve(rows), kinds: { auto_detect: '자동 감지' }, now: () => Date.UTC(2026, 10, 7, 3, 0) });
  await tick();
  const t = textOf(root);
  assert.match(t, /11\.07 12:00/);
  assert.match(t, /자동 감지/);
  assert.match(t, /가나상사/);
  assert.match(t, /🤖 자동/);
});

test('사용자 값은 innerHTML 로 조립하지 않는다', () => {
  const body = SRC.replace(/\/\*[\s\S]*?\*\//g, '');
  const uses = body.match(/innerHTML[^;\n]*/g) || [];
  uses.forEach((u) => assert.match(u, /innerHTML\s*=\s*''/, 'innerHTML 은 비울 때만: ' + u));
});

test('docs-esign.html 연결 — 총괄관리자만 메뉴가 보인다', () => {
  const html = fs.readFileSync(path.join(__dirname, '../docs-esign.html'), 'utf8').replace(/\r\n/g, '\n');
  assert.match(html, /<script src="js\/pu-worklog-view\.js\?v=1"><\/script>/);
  assert.match(html, /<button type="button" class="nav sub" data-pane="log" id="navLog" hidden>🧾 작업 기록<\/button>/);
  assert.match(html, /<div id="paneLog" hidden>[\s\S]*<div id="logRoot"><\/div>/);
  assert.match(html, /log: 'paneLog'/);
  assert.match(html, /h === '#log'\) return 'log'/);
  assert.match(html, /\.nav\[hidden\]\{display:none\}/, '.nav 의 display:flex 가 hidden 을 이기지 않게');
  assert.match(html, /uid_roles\/' \+ u\.uid\)\.once\('value'\)[\s\S]*r\.isAdmin === true[\s\S]*\$\('navLog'\)\.hidden = !isAdmin/);
  assert.ok(!/isSubAdmin[^\n]*navLog|navLog[^\n]*isSubAdmin/.test(html), '부관리자는 세지 않는다');
  assert.match(html, /name === 'log' && !mounted\.log/);
});
