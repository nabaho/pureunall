'use strict';
/* 한글 미리보기 창(js/pu-hwp-preview.js) — 읽기 전용, 엔진은 PureunHwp.renderPreview 만 (2026-10-11)
 * 지키는 것: 열기·실패·엔진 없음·닫기 정리·한 번에 하나·Esc·바깥 클릭·파일 이름은 글자로(textContent)·
 *           외부 주소·편집기·새 창 없음.
 * node --test tests/pu-hwp-preview.test.js */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { test } = require('node:test');

const FILE = path.join(__dirname, '..', 'js', 'pu-hwp-preview.js');
const SRC = fs.readFileSync(FILE, 'utf8');

/* 아주 작은 가짜 문서 — 만든 원소·붙은 자리·글자·이벤트만 */
function fakeDoc() {
  const listeners = {};
  function mk(tag) {
    const el = {
      tagName: String(tag).toUpperCase(), children: [], parentNode: null, style: {}, attrs: {}, _l: {},
      _text: '', set textContent(v) { this._text = String(v); this.children = []; }, get textContent() {
        return this._text + this.children.map((c) => c.textContent).join('');
      },
      set innerHTML(v) { if (v !== '') throw new Error('innerHTML 에 글자를 넣었다'); this.children = []; this._text = ''; },
      get innerHTML() { return ''; },
      setAttribute(k, v) { this.attrs[k] = String(v); },
      getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
      appendChild(c) { c.parentNode = this; this.children.push(c); return c; },
      removeChild(c) { this.children = this.children.filter((x) => x !== c); c.parentNode = null; return c; },
      remove() { if (this.parentNode) this.parentNode.removeChild(this); },
      addEventListener(t, f) { (this._l[t] = this._l[t] || []).push(f); },
      fire(t, ev) { (this._l[t] || []).forEach((f) => f(Object.assign({ target: this, preventDefault() {} }, ev || {}))); },
      click() { this.fire('click'); }
    };
    return el;
  }
  const body = mk('body');
  const doc = {
    body, createElement: mk,
    addEventListener(t, f) { (listeners[t] = listeners[t] || []).push(f); },
    removeEventListener(t, f) { listeners[t] = (listeners[t] || []).filter((x) => x !== f); },
    listenerCount(t) { return (listeners[t] || []).length; },
    key(k) { (listeners.keydown || []).slice().forEach((f) => f({ key: k, preventDefault() {} })); }
  };
  return doc;
}
function all(el, out) { out = out || []; out.push(el); el.children.forEach((c) => all(c, out)); return out; }
function walk(doc) { return all(doc.body); }

function load(opts) {
  const o = opts || {};
  const doc = fakeDoc();
  const calls = [];
  const g = { document: doc };
  if (o.engine !== false) {
    g.PureunHwp = {
      renderPreview(host, input, name) {
        calls.push({ host, input, name });
        if (o.fail) return Promise.reject(new Error(o.fail));
        if (o.hold) return new Promise((res) => { calls[calls.length - 1].resolve = () => res({ pageCount: 3 }); });
        host.appendChild(doc.createElement('canvas'));
        return Promise.resolve({ pageCount: o.pages || 3 });
      }
    };
  }
  if (o.back) g.PuBack = o.back;
  delete require.cache[require.resolve(FILE)];
  const saved = {};
  Object.keys(g).forEach((k) => { saved[k] = global[k]; global[k] = g[k]; });
  const P = require(FILE);
  Object.keys(g).forEach((k) => { if (saved[k] === undefined) delete global[k]; else global[k] = saved[k]; });
  /* 모듈은 globalThis 를 읽으니, 시험 동안은 다시 걸어 둔다 */
  return { P, doc, calls, g, run: async (fn) => {
    Object.keys(g).forEach((k) => { saved[k] = global[k]; global[k] = g[k]; });
    try { return await fn(); } finally { Object.keys(g).forEach((k) => { if (saved[k] === undefined) delete global[k]; else global[k] = saved[k]; }); }
  } };
}
const text = (doc) => walk(doc).map((e) => e._text).join('|');

test('열기 — 창이 뜨고 제목은 파일 이름, 엔진에 (host, 입력, 이름)이 간다, 끝나면 「N쪽」', async () => {
  const w = load({ pages: 4 });
  await w.run(async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const r = await w.P.open(bytes, '보고서.hwpx');
    assert.strictEqual(r.pageCount, 4);
    assert.strictEqual(w.P.isOpen(), true);
    assert.strictEqual(w.calls.length, 1);
    assert.strictEqual(w.calls[0].input, bytes);
    assert.strictEqual(w.calls[0].name, '보고서.hwpx');
    assert.ok(text(w.doc).includes('보고서.hwpx'));
    assert.ok(text(w.doc).includes('4쪽'));
    assert.ok(walk(w.doc).some((e) => e.tagName === 'CANVAS'), '그림판이 host 안에 없다');
  });
});
test('불러오는 중… 이 먼저 보인다', async () => {
  const w = load({ hold: true });
  await w.run(async () => {
    const p = w.P.open(new Uint8Array(1), 'a.hwp');
    assert.ok(text(w.doc).includes('불러오는 중…'));
    w.calls[0].resolve(); await p;
    assert.ok(!text(w.doc).includes('불러오는 중…'));
  });
});
test('실패 — 창 안에 「미리보기를 열지 못했습니다 — 이유」, onFail 호출, 거절', async () => {
  const w = load({ fail: '파일이 깨졌습니다' });
  await w.run(async () => {
    let seen = null;
    await assert.rejects(w.P.open(new Uint8Array(1), 'x.hwp', { onFail: (e) => { seen = e; } }), /미리보기를 열지 못했습니다 — 파일이 깨졌습니다/);
    assert.ok(text(w.doc).includes('미리보기를 열지 못했습니다 — 파일이 깨졌습니다'));
    assert.ok(seen && /깨졌/.test(seen.message));
    assert.strictEqual(w.P.isOpen(), true, '실패해도 창은 닫기 전까지 남는다');
    w.P.close();
    assert.strictEqual(w.P.isOpen(), false);
  });
});
test('엔진이 없으면 창을 열지 않고 「한글 엔진을 불러오지 못했습니다」', async () => {
  const w = load({ engine: false });
  await w.run(async () => {
    let seen = null;
    await assert.rejects(w.P.open(new Uint8Array(1), 'a.hwp', { onFail: (e) => { seen = e; } }), /한글 엔진을 불러오지 못했습니다/);
    assert.strictEqual(w.P.isOpen(), false);
    assert.strictEqual(walk(w.doc).length, 1, '창 조각이 남았다');
    assert.ok(seen);
  });
});
test('닫기 — 창·키 듣개가 사라지고 뒤로가기 층도 비운다', async () => {
  const closed = []; let handler = null;
  const back = { open(n, f) { handler = f; return 7; }, close(id) { closed.push(id); } };
  const w = load({ back });
  await w.run(async () => {
    await w.P.open(new Uint8Array(1), 'a.hwp');
    assert.strictEqual(w.doc.listenerCount('keydown'), 1);
    assert.strictEqual(typeof handler, 'function');
    w.P.close();
    assert.strictEqual(w.P.isOpen(), false);
    assert.strictEqual(walk(w.doc).length, 1);
    assert.strictEqual(w.doc.listenerCount('keydown'), 0);
    assert.deepStrictEqual(closed, [7]);
    w.P.close(); /* 여러 번 불려도 탈이 없다 */
    /* 뒤로가기가 닫는 함수를 부르면 닫힌다 */
    await w.P.open(new Uint8Array(1), 'b.hwp');
    handler();
    assert.strictEqual(w.P.isOpen(), false);
  });
});
test('닫기 단추는 data-close 를 달고, 누르면 닫힌다', async () => {
  const w = load();
  await w.run(async () => {
    await w.P.open(new Uint8Array(1), 'a.hwp');
    const b = walk(w.doc).find((e) => e.tagName === 'BUTTON');
    assert.ok(b && b.getAttribute('data-close') !== null);
    assert.strictEqual(b.textContent, '닫기');
    b.click();
    assert.strictEqual(w.P.isOpen(), false);
  });
});
test('한 번에 하나 — 두 번째 open 은 같은 창을 쓰고 제목·내용만 바꾼다', async () => {
  const w = load();
  await w.run(async () => {
    await w.P.open(new Uint8Array(1), '첫째.hwp');
    const rootsBefore = w.doc.body.children.length;
    await w.P.open(new Uint8Array(2), '둘째.hwpx');
    assert.strictEqual(w.doc.body.children.length, rootsBefore);
    assert.strictEqual(rootsBefore, 1);
    assert.ok(text(w.doc).includes('둘째.hwpx'));
    assert.ok(!text(w.doc).includes('첫째.hwp|'), '첫째 제목이 남았다');
    assert.strictEqual(w.doc.listenerCount('keydown'), 1, '키 듣개가 겹쳤다');
    assert.strictEqual(walk(w.doc).filter((e) => e.tagName === 'CANVAS').length, 1, '옛 그림판이 남았다');
  });
});
test('늦게 끝난 옛 요청은 새 창을 건드리지 않는다', async () => {
  const w = load({ hold: true });
  await w.run(async () => {
    const p1 = w.P.open(new Uint8Array(1), '첫째.hwp').catch(() => 'stale');
    const p2 = w.P.open(new Uint8Array(1), '둘째.hwp');
    w.calls[0].resolve(); await p1;
    assert.ok(text(w.doc).includes('불러오는 중…'), '옛 요청이 새 창의 상태를 바꿨다');
    w.calls[1].resolve(); await p2;
    assert.ok(text(w.doc).includes('3쪽'));
  });
});
test('Esc 로 닫힌다, 다른 키는 아니다', async () => {
  const w = load();
  await w.run(async () => {
    await w.P.open(new Uint8Array(1), 'a.hwp');
    w.doc.key('Enter'); assert.strictEqual(w.P.isOpen(), true);
    w.doc.key('Escape'); assert.strictEqual(w.P.isOpen(), false);
  });
});
test('바깥(배경)을 누르면 닫히고, 안쪽을 누르면 안 닫힌다', async () => {
  const w = load();
  await w.run(async () => {
    await w.P.open(new Uint8Array(1), 'a.hwp');
    const root = w.doc.body.children[0];
    const inner = root.children[0];
    inner.fire('click', { target: inner });
    assert.strictEqual(w.P.isOpen(), true);
    root.fire('click', { target: root });
    assert.strictEqual(w.P.isOpen(), false);
  });
});
test('파일 이름은 «글자»로 넣는다 — innerHTML 에 데이터를 넣지 않는다', async () => {
  const w = load();
  await w.run(async () => {
    const evil = '<img src=x onerror=alert(1)>.hwp';
    await w.P.open(new Uint8Array(1), evil);
    const hit = walk(w.doc).filter((e) => e._text === evil);
    assert.strictEqual(hit.length, 1, '이름이 글자로 들어가지 않았다');
    assert.ok(!walk(w.doc).some((e) => e.tagName === 'IMG'));
  });
  const code = SRC.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
  assert.ok(!/innerHTML\s*=\s*[^'"\s;]/.test(code) && !/innerHTML\s*\+?=\s*['"][^'"]/.test(code), 'innerHTML 로 글을 넣는 줄이 있다');
});
test('★ 새 파일에 남의 주소·편집기·새 창이 없다', () => {
  const bare = SRC.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
  assert.ok(!/esm\.sh|edwardkim\.github\.io/.test(bare));
  assert.ok(!/createEditor/.test(bare));
  assert.ok(!/window\.open|\.open\(\s*['"]http/.test(bare));
  assert.ok(!/https?:\/\//.test(bare), '외부 주소가 있다');
  assert.ok(!/fetch\(|XMLHttpRequest|sendBeacon|localStorage|indexedDB/.test(bare), '밖으로 보내거나 저장하는 길이 있다');
  assert.match(bare, /renderPreview/);
});
test('브라우저에서는 window.PuHwpPreview 로 붙는다', () => {
  assert.match(SRC, /global\.PuHwpPreview\s*=/);
  assert.match(SRC, /module\.exports/);
});
