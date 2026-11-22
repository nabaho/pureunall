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
// 기밀 문서(괴롭힘 조사·P박스) 가림 도우미 — 떠서 돌리는 조각 앞에 함께 붙인다 (main 2026-11-21 «pbox» 연결)
function privHelpers() {
  const a = /const _isPrivateBridgeId = [\s\S]*?\n {2}\};\n/.exec(CODE);
  const b = /const _isPrivateFrom = [^\n]*\n/.exec(CODE);
  assert.ok(a && b, '기밀 문서 가림 도우미(_isPrivateBridgeId·_isPrivateFrom)를 못 찾았습니다');
  return a[0] + b[0];
}

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
  // 2026-11-20: 연결 정보는 «지금 탭» 의 것(cur.fundCtx)
  return new Function('$', 'h', 'saveToFund', 'cur', code + '\nreturn _renderFundBridgeBar;')(dom.$, dom.h, () => {}, { fundCtx: ctx })();
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
  assert.throws(() => new Function('$', 'h', 'saveToFund', 'cur', old + '\nreturn _renderFundBridgeBar;')(dom.$, dom.h, () => {}, { fundCtx: { fundName: 'x' } })(), /NotFoundError/);
});

test('★★★ «열기» 메시지는 같은 사이트가 보낸 것만 듣는다 (다른 출처는 무시)', () => {
  const at = CODE.indexOf("window.addEventListener('message', e => {");
  assert.ok(at >= 0, "window.addEventListener('message' 를 못 찾았습니다");
  const block = CODE.slice(at, CODE.indexOf('\n  });', at) + '\n  });'.length);
  let handler = null;
  const calls = [];
  // main 의 조사 문서 전용 팝업 확인(_initFrom·_initBid)이 같은 블록 안에서 쓰이므로 «일반 기금 창» 값으로 넣는다
  new Function('window', 'location', 'loadFromFundPayload', '_initFrom', '_initBid', privHelpers() + block)(
    { addEventListener: (t, f) => { if (t === 'message') handler = f; } },
    { origin: 'https://nabaho.github.io' },
    p => calls.push(p), '', '');
  assert.strictEqual(typeof handler, 'function');
  const open = origin => handler({ origin, data: { type: 'pureun_hangul_open', payload: { html: '<p>x</p>' } } });
  open('https://evil.example');
  open('null');
  assert.strictEqual(calls.length, 0, '다른 출처의 «열기» 가 편집기에 들어왔습니다');
  open('https://nabaho.github.io');
  assert.strictEqual(calls.length, 1, '같은 사이트의 «열기» 는 받아야 합니다');
  assert.doesNotThrow(() => handler(null));
});

// ---------- 2026-11-20 점검: 연결은 «연 문서» 에만 · 같은 쪽지는 한 번만 · 못 열면 함께 온 HTML 로 ----------
// loadFromFundPayload 를 떠서 가짜 openBlob·addDoc 로 돌린다
function runLoad({ openOk = true, initFrom = '' } = {}) {
  const keyLine = /const _bridgeKey = [^\n]*\n/.exec(CODE);
  assert.ok(keyLine, '_bridgeKey 를 못 찾았습니다');
  const code = keyLine[0] + privHelpers() + 'const _initFrom = ' + JSON.stringify(initFrom) + ';\nconst _initBid = "";\n' + cutFn(CODE, 'async function loadFromFundPayload(');
  const log = { opened: [], added: [], bars: 0, toasts: [] };
  const fn = new Function('_seenBridgeIds', 'window', 'location', 'BroadcastChannel', 'openBlob', 'addDoc', '_renderFundBridgeBar', 'Hx', 'toast', '_b64ToBytes', 'File', 'console',
    code + '\nreturn loadFromFundPayload;')(
    new Set(), { PureunSafeHtml: { clean: s => s } }, { origin: 'https://erp.example' }, undefined, // 거르기는 tests/hangul-safe-html.test.js 가 본다
    async file => { const d = { name: file.name }; log.opened.push(d); return openOk ? d : null; },
    o => { const d = Object.assign({}, o); log.added.push(d); return d; },
    () => { log.bars++; }, { defaultPage: () => ({ margin: {} }) }, m => log.toasts.push(m), () => new Uint8Array([1]),
    function (parts, name) { this.name = name; }, { warn() {} });
  return { load: fn, log };
}

test('★★★ 기금관리가 같은 쪽지를 여러 번 보내도(bridgeId 없이 저장소·메시지·채널) 한 번만 연다', async () => {
  const { load, log } = runLoad();
  const p = { sentAt: 1795161000000, fundId: 'F1', fundName: '시험기금', kind: 'rule', label: '규약', name: '시험기금_규약', format: 'hwpx', b64: 'AA==' };
  for (let i = 0; i < 5; i++) await load(Object.assign({}, p));
  assert.strictEqual(log.opened.length, 1, '같은 쪽지로 탭이 여러 개 열렸습니다 (' + log.opened.length + ')');
  await load(Object.assign({}, p, { sentAt: p.sentAt + 5000 })); // 다시 눌러 새로 보낸 것은 연다
  assert.strictEqual(log.opened.length, 2);
});

test('★★★ 기금 연결은 «실제로 연 그 문서» 에만 붙는다 — 다른 탭에는 없다', async () => {
  const { load, log } = runLoad();
  await load({ sentAt: 1, fundId: 'F1', kind: 'rule', label: '규약', format: 'hwpx', b64: 'AA==' });
  assert.deepStrictEqual(log.opened[0].fundCtx && log.opened[0].fundCtx.fundId, 'F1');
  assert.ok(log.bars >= 1, '연결 띠를 다시 그려야 합니다');
  // 소스에도: 전역 하나(let fundCtx)로 두지 않고, 띠·반영은 지금 탭(cur.fundCtx)을 본다
  assert.doesNotMatch(CODE, /let fundCtx\b/, '기금 연결을 창 하나에 하나(전역)로 두면 다른 탭이 그 서식으로 저장됩니다');
  assert.match(cutFn(CODE, 'function saveToFund('), /cur && cur\.fundCtx/);
  assert.match(cutFn(CODE, 'function _renderFundBridgeBar('), /cur && cur\.fundCtx/);
  assert.match(cutFn(CODE, 'function activate('), /_renderFundBridgeBar\(\)/, '탭을 바꾸면 띠도 그 탭의 것으로 바뀌어야 합니다');
});

test('★★ 서식 파일(b64)을 못 열면 함께 온 HTML 로 대신 열고, 연결은 그 문서에 — 둘 다 못 열면 아무 데도 안 붙는다', async () => {
  const r1 = runLoad({ openOk: false });
  await r1.load({ sentAt: 2, fundId: 'F2', kind: 'rule', label: '규약', format: 'hwpx', b64: 'AA==', html: '<p>x</p>' });
  assert.strictEqual(r1.log.added.length, 1, '못 연 b64 대신 HTML 로 열어야 합니다');
  assert.strictEqual(r1.log.added[0].fundCtx.fundId, 'F2');
  assert.strictEqual(r1.log.opened[0].fundCtx, undefined);
  const r2 = runLoad({ openOk: false });
  await r2.load({ sentAt: 3, fundId: 'F3', format: 'hwpx', b64: 'AA==' });
  assert.strictEqual(r2.log.added.length, 0);
  assert.strictEqual(r2.log.opened[0].fundCtx, undefined, '못 연 문서에 연결이 붙었습니다');
});

test('★★★ 기밀 서면(P박스·괴롭힘 조사)은 못 열어도 HTML 로 대신 열지 않고, 열면 자동 저장 사본을 남기지 않는다', async () => {
  // 서식 파일을 못 열었다 — 일반 서식이면 HTML 로 대신 열지만, 기밀 서면은 열지 않는다
  for (const [bridgeId, initFrom] of [['pbox_1', 'pbox'], ['harass_1', 'harass'], ['x1', 'pbox']]) {
    const r = runLoad({ openOk: false, initFrom });
    await r.load({ bridgeId, format: 'hwpx', b64: 'AA==', html: '<p>x</p>' });
    assert.strictEqual(r.log.added.length, 0, bridgeId + ': 기밀 서면을 HTML 로 대신 열었습니다');
    assert.ok(r.log.toasts.length >= 1, bridgeId + ': 못 열었다고 알려야 합니다');
  }
  const ok = runLoad({ openOk: true, initFrom: 'pbox' });
  await ok.load({ bridgeId: 'pbox_2', format: 'hwpx', b64: 'AA==', fundId: 'F9', label: '의견서' });
  assert.strictEqual(ok.log.opened[0].noAutosave, true, '기밀 서면에 자동 저장 막음 표시가 없습니다');
  // P박스 연결은 그 문서에만 붙고(main 2026-11-22 «P박스에 최종본 반영»), 기금 연결은 붙지 않는다
  assert.strictEqual(ok.log.opened[0].pboxCtx && ok.log.opened[0].pboxCtx.bridgeId, 'pbox_2', 'P박스 연결이 연 문서에 붙지 않았습니다');
  assert.strictEqual(ok.log.opened[0].fundCtx, undefined, 'P박스 서면에 기금 연결이 붙었습니다');
  assert.doesNotMatch(CODE, /let pboxCtx\b/, 'P박스 연결을 창 하나에 하나(전역)로 두면 다른 탭이 그 서면으로 반영됩니다');
  // 일반 서식은 그대로 자동 저장 대상
  const plain = runLoad({ openOk: true });
  await plain.load({ sentAt: 9, format: 'hwpx', b64: 'AA==' });
  assert.ok(!plain.log.opened[0].noAutosave, '일반 서식까지 자동 저장을 막았습니다');
  // 자동 저장은 그 표시를 본다
  const AS = strip(fs.readFileSync(path.join(R, 'hangul/js/autosave.js'), 'utf8').replace(/\r\n/g, '\n'));
  assert.match(cutFn(AS, 'async function saveCurrent('), /d\.noAutosave/, '자동 저장이 기밀 서면 표시(noAutosave)를 보지 않습니다');
});

test('★★ «저장» 메시지(문서 전문)를 보낼 때 받는 쪽을 같은 사이트로 좁힌다 — 맨 \'*\' 만 쓰지 않는다', () => {
  const fn = cutFn(CODE, 'function saveToFund(');
  const m = /window\.opener\.postMessage\(msg,\s*([^;]*?)\)\s*;?\s*\}\s*catch/.exec(fn);
  assert.ok(m, 'opener.postMessage 를 못 찾았습니다');
  assert.ok(/location\.origin/.test(m[1]), "받는 쪽을 location.origin 으로 좁혀야 합니다 (지금: " + m[1] + ')');
});
