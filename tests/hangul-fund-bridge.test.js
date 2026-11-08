'use strict';
/* 한글 편집기 ↔ 기금관리 직접 연결(hangul/js/app.js 의 «기금관리 직접 연결 브리지») — 2026-11-08
   ■ 무엇이었나
     ① #2928 로 넣은 «기금관리 → 푸른한글 직접 열기» 는 문서를 한 번도 못 열었다.
        연동 띠를 메뉴 줄에 끼우는 `_renderFundBridgeBar` 가 찾기 칸(#quickFind)을 메뉴 줄의 «직계 자식»으로
        가정하고 `insertBefore` 했는데, 실제로는 `.quickfind` 상자 안에 있어 NotFoundError 가 났다
        (loadFromFundPayload 가 맨 처음 부르는 함수라 서식이 열리기 전에 멈춘다 — 빈 편집기만 뜸).
        글자만 찾는 검사로는 안 잡힌다(되풀이된 실수 ②) → 가짜 DOM 에서 «돌려» 본다.
     ② 서식 HTML 이 편집기 안으로 들어오는 «열기» 메시지를 출처(origin) 확인 없이 받고, 문서 전문이 든
        «저장» 메시지를 '*' 로 보냈다. → 같은 사이트 것만 받고, 보낼 때도 같은 사이트로 좁힌다.
   node --test tests/hangul-fund-bridge.test.js */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { test } = require('node:test');
const { cutFn } = require('./cut-fn');
const R = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(R, 'hangul/js/app.js'), 'utf8').replace(/\r\n/g, '\n');
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\n\s*\/\/[^\n]*/g, '\n');
const CODE = strip(SRC);

/* 진짜 DOM 처럼 «기준 노드가 내 자식이 아니면 던지는» 아주 작은 가짜 — 이 가짜가 옛 코드를 잡는지도 아래에서 확인한다 */
function fakeDom({ withBox = true } = {}) {
  const mk = (id, kids) => ({ id, children: kids || [], contains(n) { return n === this || this.children.some(c => c === n || (c.contains && c.contains(n))); } });
  const qf = mk('quickFind');
  const box = mk('', [qf]);
  const menus = mk('menus'), grow = mk('', []);
  const mb = mk('menubar', withBox ? [menus, grow, box] : [menus, grow]);
  mb.insertBefore = (node, ref) => {
    if (ref && !mb.children.includes(ref)) throw new Error('NotFoundError: 기준 노드가 이 노드의 자식이 아닙니다');
    mb.children.splice(ref ? mb.children.indexOf(ref) : mb.children.length, 0, node);
  };
  const byId = { menubar: mb, quickFind: qf };
  const made = [];
  const h = (tag, props, ...kids) => {
    const el = { tag, props, kids, id: (props && props.id) || '', children: [], _html: 'x', append(...k) { this.kids.push(...k); }, remove() { const i = mb.children.indexOf(this); if (i >= 0) mb.children.splice(i, 1); delete byId[this.id]; }, contains() { return false; } };
    Object.defineProperty(el, 'innerHTML', { set(v) { this.kids = []; this._html = v; }, get() { return this._html; } });
    made.push(el);
    if (el.id) byId[el.id] = el;
    return el;
  };
  return { mb, box, h, $: id => byId[id] || null, made };
}
function runBar(dom, ctx) {
  const code = cutFn(CODE, 'function _renderFundBridgeBar(');
  return new Function('$', 'h', 'saveToFund', 'fundCtx', code + '\nreturn _renderFundBridgeBar;')(dom.$, dom.h, () => {}, ctx)();
}

test('★★★ 연동 띠가 메뉴 줄에 들어간다 — 찾기 상자 «앞»에, 오류 없이', () => {
  const dom = fakeDom();
  assert.doesNotThrow(() => runBar(dom, { fundId: 'f1', fundName: '시험기금', label: '서식' }));
  const i = dom.mb.children.findIndex(c => c.id === 'fundBridgeBar');
  assert.ok(i >= 0, '연동 띠가 메뉴 줄에 안 들어갔습니다');
  assert.strictEqual(dom.mb.children[i + 1], dom.box, '찾기 상자 바로 앞에 들어가야 합니다');
});

test('★★ 찾기 상자가 없는 화면에서도 던지지 않고 맨 뒤에 붙는다', () => {
  const dom = fakeDom({ withBox: false });
  assert.doesNotThrow(() => runBar(dom, { fundId: 'f1', fundName: '시험기금' }));
  assert.strictEqual(dom.mb.children[dom.mb.children.length - 1].id, 'fundBridgeBar');
});

test('★★ 가짜 DOM 이 진짜처럼 옛 코드(#quickFind 를 직계 자식으로 가정)를 잡는다 — 검사가 헛돌지 않는다', () => {
  const dom = fakeDom();
  const old = cutFn(CODE, 'function _renderFundBridgeBar(').replace(/const ref = [^\n]*\n/, '').replace('mb.insertBefore(wrap, ref || null)', 'mb.insertBefore(wrap, qf || null)');
  assert.match(old, /insertBefore\(wrap, qf \|\| null\)/, '옛 코드로 되돌리지 못했습니다 — 이 검사의 바꿔치기를 고쳐야 합니다');
  assert.throws(() => new Function('$', 'h', 'saveToFund', 'fundCtx', old + '\nreturn _renderFundBridgeBar;')(dom.$, dom.h, () => {}, { fundName: 'x' })(), /NotFoundError/);
});

test('★★★ «열기» 메시지는 같은 사이트가 보낸 것만 듣는다 (다른 출처는 무시)', () => {
  const at = CODE.indexOf("window.addEventListener('message', e => {");
  assert.ok(at >= 0, "window.addEventListener('message' 를 못 찾았습니다");
  const block = CODE.slice(at, CODE.indexOf('\n  });', at) + '\n  });'.length);
  let handler = null;
  const calls = [];
  new Function('window', 'location', 'loadFromFundPayload', block)(
    { addEventListener: (t, f) => { if (t === 'message') handler = f; } },
    { origin: 'https://nabaho.github.io' },
    p => calls.push(p));
  assert.strictEqual(typeof handler, 'function');
  const open = origin => handler({ origin, data: { type: 'pureun_hangul_open', payload: { html: '<p>x</p>' } } });
  open('https://evil.example');
  open('null');
  assert.strictEqual(calls.length, 0, '다른 출처의 «열기» 가 편집기에 들어왔습니다');
  open('https://nabaho.github.io');
  assert.strictEqual(calls.length, 1, '같은 사이트의 «열기» 는 받아야 합니다');
  assert.doesNotThrow(() => handler(null));
});

test('★★ «저장» 메시지(문서 전문)를 보낼 때 받는 쪽을 같은 사이트로 좁힌다 — 맨 \'*\' 만 쓰지 않는다', () => {
  const fn = cutFn(CODE, 'function saveToFund(');
  const m = /window\.opener\.postMessage\(msg,\s*([^;]*?)\)\s*;?\s*\}\s*catch/.exec(fn);
  assert.ok(m, 'opener.postMessage 를 못 찾았습니다');
  assert.ok(/location\.origin/.test(m[1]), "받는 쪽을 location.origin 으로 좁혀야 합니다 (지금: " + m[1] + ')');
});
