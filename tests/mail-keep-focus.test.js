/* 메일 검색칸 — 글자를 치는 중인 칸은 «그대로 둔 채» 나머지만 갈아 끼운다 (대표 지시 2026-11-14)
 *
 *   「검색기능이 이상하다 제대로 작동 잘 안한다」
 *
 * ■ 무슨 일이었나
 *   검색칸에 한 글자 칠 때마다 메일 화면 전체를 다시 그렸다(el.innerHTML = …). 검색칸 자신도 새로 만들어져
 *   커서가 풀렸다 — 「s」 한 글자만 들어가고 다음 글자는 어디에도 안 들어갔다(실제 브라우저 재현: 친 뒤 활성 요소 BODY).
 *   수신기록·사업장별·보낸 메일·폰 검색칸도 같은 모양이었다. 한글은 조합 중에 칸이 바뀌면 입력기가 깨진다.
 *
 * ■ 무엇을 지키나
 *   ① 커서가 data-keep 칸에 있으면 그 «칸 자신(같은 객체)»과 조상 줄기는 그대로, 옆 가지만 새 것으로 바뀐다.
 *   ② 칸에 든 글자는 건드리지 않는다 — 코드가 값을 바꿨을 때만 새 값을 따른다.
 *   ③ 커서가 그 칸에 없거나, 새 그림에 같은 칸이 없거나, 줄기 모양이 다르면 «예전처럼 통째로» 그린다.
 *   ④ 줄기의 클래스·글귀 같은 속성은 새 것을 따른다(한쪽만 옛것으로 남지 않게).
 *   ⑤ 다섯 검색칸(메일함 PC·폰, 수신기록, 사업장별, 보낸 메일)에 표가 붙어 있고, 그리는 길이 mailPaint 를 지난다.
 *
 * ⚠ 외부 DOM 도구(jsdom)에 기대지 않는다 — 이 PC 에는 없고 CI 에서만 깔린다. 필요한 만큼만 직접 만든 가짜 DOM 이다.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { sliceFn } = require('./fnslice.js');

const cards = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8');

/* ── 아주 작은 가짜 DOM — mailPaint 가 쓰는 만큼만 ── */
let PARSE = () => [];
class FNode {
  constructor(tag, attrs, kids) {
    this.tagName = String(tag).toUpperCase(); this._a = Object.assign({}, attrs || {});
    this.parentNode = null; this.childNodes = []; (kids || []).forEach((k) => this.appendChild(k));
    this._value = (attrs && attrs.value) || ''; this.valueSets = 0; this.selection = null;
    this.scrollTop = 0;
  }
  get firstChild() { return this.childNodes[0] || null; }
  get nextSibling() { if (!this.parentNode) return null; const s = this.parentNode.childNodes; return s[s.indexOf(this) + 1] || null; }
  get attributes() { return Object.keys(this._a).map((name) => ({ name, value: this._a[name] })); }
  getAttribute(n) { return n in this._a ? this._a[n] : null; }
  hasAttribute(n) { return n in this._a; }
  setAttribute(n, v) { this._a[n] = String(v); }
  removeAttribute(n) { delete this._a[n]; }
  appendChild(k) { if (k.parentNode) k.parentNode.removeChild(k); k.parentNode = this; this.childNodes.push(k); return k; }
  insertBefore(k, ref) {
    if (k.parentNode) k.parentNode.removeChild(k);
    k.parentNode = this; const i = this.childNodes.indexOf(ref);
    if (i < 0) this.childNodes.push(k); else this.childNodes.splice(i, 0, k);
    return k;
  }
  removeChild(k) { const i = this.childNodes.indexOf(k); if (i >= 0) { this.childNodes.splice(i, 1); k.parentNode = null; } return k; }
  contains(n) { for (; n; n = n.parentNode) if (n === this) return true; return false; }
  querySelectorAll() {            /* mailPaint 는 '[data-keep]' 만 묻는다 */
    const out = []; const walk = (n) => n.childNodes.forEach((c) => { if (c.hasAttribute('data-keep')) out.push(c); walk(c); });
    walk(this); return out;
  }
  set innerHTML(html) { this.childNodes.forEach((c) => { c.parentNode = null; }); this.childNodes = []; (PARSE(html) || []).forEach((k) => this.appendChild(k)); }
  get value() { return this._value; }
  set value(v) { this._value = String(v); this.valueSets++; }
  setSelectionRange(a, b) { this.selection = [a, b]; }
}
const N = (tag, attrs, kids) => new FNode(tag, attrs, kids);

/* 메일 화면 모양: 윗줄(.bar: 단추 · 검색칸 · 단추) + 목록(.list) — 번호 n 이 바뀌면 «옆 가지»가 바뀐다 */
const page = (o) => [
  N('div', { class: 'bar' + (o.on ? ' on' : '') }, [
    N('button', { id: 'b' + o.n }),
    N('span', { class: 'search' }, [N('input', { id: 'q', 'data-keep': o.mark || 'q', value: o.q || '' })]),
    N('button', { id: 'c' + o.n }),
  ]),
  N('div', { class: 'list' }, [N('p', { id: 'r' + o.n })]),
];

function makeEnv() {
  const doc = { activeElement: null, createElement: () => new FNode('div') };
  const ctx = { document: doc };
  vm.createContext(ctx);
  const api = vm.runInContext([
    sliceFn(cards, 'function mailPaintAttrs(o, n)'),
    sliceFn(cards, 'function mailPaint(el, html)'),
    '({ mailPaint })',
  ].join('\n'), ctx);
  return { api, doc };
}
const ids = (root) => { const out = []; const walk = (n) => n.childNodes.forEach((c) => { if (c.getAttribute('id')) out.push(c.getAttribute('id')); walk(c); }); walk(root); return out; };

function setup(first) {
  const { api, doc } = makeEnv();
  const el = new FNode('div');
  PARSE = () => page(first || { n: 1 });
  el.innerHTML = 'first';
  const input = el.querySelectorAll()[0];
  return { api, doc, el, input };
}

test('① 커서가 검색칸에 있으면 «같은 칸»이 남고 옆 가지만 새것으로 바뀐다', () => {
  const { api, doc, el, input } = setup({ n: 1 });
  doc.activeElement = input;
  input._value = 'ab';                                 /* 사람이 친 글 */
  PARSE = () => page({ n: 2, q: 'ab' });
  const kept = api.mailPaint(el, 'second');
  assert.equal(kept, true, '칸을 그대로 두는 길로 안 갔습니다');
  assert.equal(el.querySelectorAll()[0], input, '★ 검색칸이 새로 만들어졌습니다 — 커서가 풀립니다');
  assert.ok(el.contains(input), '칸이 화면에서 빠졌습니다');
  assert.deepEqual(ids(el).sort(), ['b2', 'c2', 'q', 'r2'].sort(), '옆 가지(단추·목록)가 새것으로 안 바뀌었습니다: ' + ids(el));
});

test('① 옆 가지의 «차례»도 새 그림 그대로다 — 칸 앞·뒤 단추가 제자리', () => {
  const { api, doc, el, input } = setup({ n: 1 });
  doc.activeElement = input;
  PARSE = () => page({ n: 7 });
  api.mailPaint(el, 'x');
  const bar = el.childNodes[0];
  assert.deepEqual(bar.childNodes.map((c) => c.getAttribute('id')), ['b7', null, 'c7'], '단추·칸 차례가 어긋났습니다');
  assert.equal(bar.childNodes[1].childNodes[0], input);
  assert.equal(el.childNodes.length, 2, '목록 줄이 두 벌이거나 빠졌습니다');
});

test('② 칸의 글자는 건드리지 않는다(같은 글이면 값을 다시 쓰지 않는다)', () => {
  const { api, doc, el, input } = setup({ n: 1 });
  doc.activeElement = input;
  input._value = '점검';
  const before = input.valueSets;
  PARSE = () => page({ n: 2, q: '점검' });
  api.mailPaint(el, 'x');
  assert.equal(input.value, '점검');
  assert.equal(input.valueSets, before, '★ 같은 글인데 값을 다시 써서 글자 조합·커서가 흔들립니다');
});

test('② 코드가 값을 바꿨으면(예: 지우기) 새 값을 따르고 커서를 끝에 둔다', () => {
  const { api, doc, el, input } = setup({ n: 1 });
  doc.activeElement = input;
  input._value = '옛 글';
  PARSE = () => page({ n: 2, q: '' });                  /* 상태가 비워졌다 */
  api.mailPaint(el, 'x');
  assert.equal(input.value, '', '코드가 비웠는데 칸에 옛 글이 남았습니다');
});

test('③ 커서가 검색칸에 없으면 예전처럼 «통째로» 그린다', () => {
  const { api, doc, el, input } = setup({ n: 1 });
  doc.activeElement = null;                             /* 다른 곳을 눌렀다 */
  PARSE = () => page({ n: 2 });
  assert.equal(api.mailPaint(el, 'x'), false);
  assert.notEqual(el.querySelectorAll()[0], input, '커서가 없는데 옛 칸이 남았습니다(값이 낡을 수 있다)');
});

test('③ 커서가 «이 화면 조각 바깥»의 검색칸에 있으면 건드리지 않고 통째로 그린다', () => {
  const { api, doc, el, input } = setup({ n: 1 });
  /* 다른 조각 — 줄기 모양(깊이·꼬리표)이 새 그림과 «같은» 칸이라, 깊이·꼬리표 검사로는 못 거른다 */
  PARSE = () => page({ n: 1 });
  const outside = new FNode('div'); outside.innerHTML = 'outside';
  const outsideInput = outside.querySelectorAll()[0];
  doc.activeElement = outsideInput;
  PARSE = () => [N('div', { class: 'w' }, page({ n: 2 }))];     /* 한 겹 더 감싼 새 그림 — 깊이가 바깥 칸과 같다 */
  assert.equal(api.mailPaint(el, 'x'), false, '바깥 칸의 표를 보고 이 조각의 칸을 남겼습니다');
  assert.equal(outside.childNodes.length, 2, '바깥 조각을 건드렸습니다');
  assert.notEqual(el.querySelectorAll()[0], input);
});

test('③ 같은 표의 칸이 새 그림에 «둘»이면 어느 칸인지 못 정하니 통째로 그린다 — 커서가 다른 칸 자리로 안 옮겨 간다', () => {
  const { api, doc, el, input } = setup({ n: 1 });
  doc.activeElement = input;
  PARSE = () => [...page({ n: 2 }), N('div', { class: 'again' }, [N('input', { id: 'q2', 'data-keep': 'q' })])];
  assert.equal(api.mailPaint(el, 'x'), false, '★ 같은 표가 둘인데 첫 칸에 맞춰 버렸습니다');
  assert.notEqual(el.querySelectorAll()[0], input);
});

test('③ 같은 표의 칸이 «지금 화면»에 둘이어도 통째로 그린다', () => {
  const { api, doc, el, input } = setup({ n: 1 });
  el.appendChild(N('div', { class: 'dup' }, [N('input', { id: 'dup', 'data-keep': 'q' })]));
  doc.activeElement = input;
  PARSE = () => page({ n: 2 });
  assert.equal(api.mailPaint(el, 'x'), false);
});

test('검색어가 «바뀌었으면» 줄기의 스크롤은 맨 위로 — 예전(통째로 다시 그림)과 같다', () => {
  const { api, doc, el, input } = setup({ n: 1, q: 'a' });      /* 직전에 그려 둔 검색어 'a' */
  doc.activeElement = input;
  const bar = el.childNodes[0]; bar.scrollTop = 120;
  input._value = 'ab';                                           /* 한 글자 더 쳤다 */
  PARSE = () => page({ n: 2, q: 'ab' });
  api.mailPaint(el, 'x');
  assert.equal(bar.scrollTop, 0, '★ 검색어를 바꿨는데 목록이 내려간 자리에 남아 위쪽 결과가 안 보입니다');
});

test('검색어가 «같은» 다시 그리기(새 메일 도착 등)는 스크롤을 건드리지 않는다', () => {
  const { api, doc, el, input } = setup({ n: 1, q: 'ab' });
  doc.activeElement = input; input._value = 'ab';
  const bar = el.childNodes[0]; bar.scrollTop = 120;
  PARSE = () => page({ n: 2, q: 'ab' });
  api.mailPaint(el, 'x');
  assert.equal(bar.scrollTop, 120, '검색어가 그대로인데 스크롤을 맨 위로 보냈습니다');
});

test('③ 깊이만 다른 줄기(꼬리표는 앞부분이 같다)도 억지로 맞추지 않고 통째로 그린다', () => {
  const { api, doc, el, input } = setup({ n: 1 });
  doc.activeElement = input;
  PARSE = () => [N('div', { class: 'outer' }, page({ n: 2 }))];   /* 새 그림이 한 겹 더 깊다: input·span·div.bar·div.outer */
  assert.equal(api.mailPaint(el, 'x'), false, '★ 깊이가 다른 줄기를 같다고 봐서 엉뚱한 곳을 갈아 끼웁니다');
  assert.notEqual(el.querySelectorAll()[0], input);
  assert.equal(el.childNodes.length, 1);
});

test('③ 새 그림에 같은 칸이 없으면 통째로 그린다', () => {
  const { api, doc, el, input } = setup({ n: 1 });
  doc.activeElement = input;
  PARSE = () => [N('div', { class: 'other' }, [N('p', { id: 'zz' })])];
  assert.equal(api.mailPaint(el, 'x'), false);
  assert.deepEqual(ids(el), ['zz']);
});

test('③ 표는 같아도 «다른 칸»이면(표 이름이 다르면) 통째로 그린다', () => {
  const { api, doc, el, input } = setup({ n: 1 });
  doc.activeElement = input;
  PARSE = () => page({ n: 2, mark: 'otherbox' });
  assert.equal(api.mailPaint(el, 'x'), false);
  assert.notEqual(el.querySelectorAll()[0], input);
});

test('③ 줄기 모양(깊이·꼬리표)이 다르면 억지로 맞추지 않고 통째로 그린다', () => {
  const { api, doc, el, input } = setup({ n: 1 });
  doc.activeElement = input;
  PARSE = () => [N('div', { class: 'bar' }, [N('input', { id: 'q', 'data-keep': 'q' })])];   /* span 한 겹이 없다 */
  assert.equal(api.mailPaint(el, 'x'), false);
  /* 깊이는 같지만 꼬리표가 다른 줄기(.bar > button, span → section) — 준비를 «먼저» 하고 새 그림을 정한다 */
  const second = setup({ n: 1 });
  second.doc.activeElement = second.input;
  PARSE = () => [N('div', { class: 'bar' }, [N('button', { id: 'b9' }), N('section', {}, [N('input', { id: 'q', 'data-keep': 'q' })])]),
                 N('div', { class: 'list' })];
  assert.equal(second.api.mailPaint(second.el, 'x'), false, '꼬리표가 다른 줄기를 같다고 봅니다');
});

test('④ 줄기의 속성(클래스)은 새 것을 따른다 — 칸 자신의 속성도 맞춘다', () => {
  const { api, doc, el, input } = setup({ n: 1, on: false });
  doc.activeElement = input;
  PARSE = () => page({ n: 2, on: true });
  api.mailPaint(el, 'x');
  assert.equal(el.childNodes[0].getAttribute('class'), 'bar on', '줄기의 클래스가 옛것으로 남았습니다');
  assert.equal(input.getAttribute('data-keep'), 'q');
});

test('여러 번 연달아 갈아 끼워도 칸이 같은 칸이다 — 한 글자씩 칠 때마다', () => {
  const { api, doc, el, input } = setup({ n: 1 });
  doc.activeElement = input;
  for (let i = 2; i <= 12; i++) {
    input._value += 'x';
    const q = input._value;
    PARSE = () => page({ n: i, q });
    assert.equal(api.mailPaint(el, 'k' + i), true);
    assert.equal(el.querySelectorAll()[0], input, i + '번째에 칸이 바뀌었습니다');
  }
  assert.equal(input.value, 'x'.repeat(11));
  assert.equal(el.childNodes.length, 2);
});

/* ── 소스 지킴 ── */
test('⑤ 다섯 검색칸에 «지킬 칸» 표가 붙어 있다 — 표가 서로 겹치지 않는다', () => {
  const marks = {
    mbQ: /<input id="mbQ" data-keep="mbQ"/,
    dmmQ: /<input id="dmmQ" data-keep="dmmQ"/,
    ibQ: /<input id="ibQ" data-keep="ibQ"/,
    ctQ: /<input id="ctQ" data-keep="ctQ"/,
    sentQ: /<input data-keep="sentQ"/,
  };
  Object.keys(marks).forEach((k) => assert.match(cards, marks[k], k + ' 검색칸에 data-keep 이 없습니다 — 한 글자 치면 커서가 풀립니다'));
  const found = (cards.match(/data-keep="([^"]+)"/g) || []).map((s) => /"([^"]+)"/.exec(s)[1]);
  const inSource = found.filter((m) => Object.keys(marks).includes(m));
  assert.equal(new Set(inSource).size, Object.keys(marks).length);
});

test('⑤ 메일 화면 그리기는 mailPaint 를 지난다 — 통째로 innerHTML 에 넣지 않는다', () => {
  const page = sliceFn(cards, 'function renderMailPage()').replace(/\/\*[\s\S]*?\*\//g, ' ');
  assert.match(page, /mailPaint\(el, html\)/, 'PC 그리기가 mailPaint 를 안 지납니다');
  assert.ok(!/el\.innerHTML\s*=\s*\(state\.mailSent/.test(page), '옛 방식(통째로 넣기)이 남았습니다');
  const mob = sliceFn(cards, 'function renderMailMobile()').replace(/\/\*[\s\S]*?\*\//g, ' ');
  assert.ok((mob.match(/paint\(`/g) || []).length >= 2, '폰 그리기가 mailPaint 를 안 지납니다');
  assert.ok(!/body\.innerHTML\s*=/.test(mob), '폰이 몸통만 따로 통째로 넣는 옛 방식이 남았습니다');
  assert.ok(!/\bel\.innerHTML\s*=\s*`<div (class="mmbar"|id="mmBody")/.test(mob), '폰이 띠·몸통을 통째로 넣는 옛 방식이 남았습니다');
});

test('⑤ 입력 처리는 그대로다 — 다섯 검색칸 «각각» 조합 중에는 그리지 않고 조합이 끝나면 그린다(한글)', () => {
  /* 같은 문장이 여러 칸에 있어 «한 칸만 바뀌어도» 통과하는 일이 없도록 칸마다 자기 표 근처를 본다 */
  ['mbQ', 'dmmQ', 'ibQ', 'ctQ', 'sentQ'].forEach((k) => {
    const at = cards.indexOf('data-keep="' + k + '"');
    assert.ok(at > 0, k + ' 칸을 못 찾았습니다');
    const near = cards.slice(at, at + 500);
    assert.match(near, /isComposing/, k + ' 칸이 조합 중에도 그립니다 — 한글이 깨집니다');
    assert.match(near, /oncompositionend/, k + ' 칸이 조합이 끝나도 안 그립니다 — 마지막 글자가 검색에 안 걸립니다');
  });
});
