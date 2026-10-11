'use strict';
/* 한글 미리보기 창(js/pu-hwp-preview.js)을 node 에서 돌리는 아주 작은 가짜 문서 (2026-10-11)
 * 만든 원소·붙은 자리·글자·속성·이벤트만 흉내 낸다.
 *
 * ★ 이벤트는 진짜 DOM 처럼 흐른다 — 잡기(capture: 문서 → 대상의 부모) → 대상 → 거품(bubble: 대상의 부모 → 문서).
 *   stopPropagation · stopImmediatePropagation · preventDefault 도 진짜처럼 듣는다.
 *   흐르지 않는 가짜에서는 「안쪽을 눌러도 안 닫힌다」·「Esc 를 먼저 잡아 멈춘다」 검사가 헛돌았다(2026-10-11 검토).
 * ★ 듣개는 붙일 때와 «같은 capture 값»으로 떼야 떨어진다 — 진짜 DOM 규칙. 다르게 떼면 남는다.
 *
 * 쓰는 법:  const { fakeDoc } = require('./helpers/fake-preview-dom.js');
 *           const doc = fakeDoc();  doc.key('Escape', 대상)  → 사건(ev)   ·   el.click() / el.dispatch('click') */

function capOf(opt) { return typeof opt === 'boolean' ? opt : !!(opt && opt.capture); }

function target(self) {
  self._l = [];
  self.addEventListener = function (type, f, opt) {
    const cap = capOf(opt);
    if (this._l.some((x) => x.type === type && x.f === f && x.cap === cap)) return;
    this._l.push({ type, f, cap });
  };
  self.removeEventListener = function (type, f, opt) {
    const cap = capOf(opt);
    this._l = this._l.filter((x) => !(x.type === type && x.f === f && x.cap === cap));
  };
  return self;
}

/* 진짜 DOM 의 흐름: 잡기(위 → 아래) · 대상(잡기 듣개 먼저, 그다음 보통 듣개) · 거품(아래 → 위) */
function dispatch(node, type, init) {
  const path = [];
  for (let n = node; n; n = n.parentNode) path.push(n);
  let stop = false, stopNow = false;
  const ev = Object.assign({}, init || {}, {
    type, target: node, currentTarget: null, eventPhase: 0, defaultPrevented: false,
    preventDefault() { this.defaultPrevented = true; },
    stopPropagation() { stop = true; },
    stopImmediatePropagation() { stop = true; stopNow = true; }
  });
  function run(at, phase, cap) {
    ev.currentTarget = at; ev.eventPhase = phase;
    const list = at._l.filter((x) => x.type === type && x.cap === cap);
    for (const x of list) {
      if (stopNow) return;
      if (at._l.indexOf(x) < 0) continue;   /* 도는 사이에 떼어진 듣개는 부르지 않는다 */
      x.f.call(at, ev);
    }
  }
  for (let i = path.length - 1; i >= 1 && !stop; i--) run(path[i], 1, true);
  if (!stop) { run(node, 2, true); if (!stopNow) run(node, 2, false); }
  for (let i = 1; i < path.length && !stop; i++) run(path[i], 3, false);
  return ev;
}

function fakeDoc() {
  const doc = target({ nodeName: '#document', parentNode: null });
  function mk(tag) {
    return target({
      tagName: String(tag).toUpperCase(), children: [], parentNode: null, style: {}, attrs: {}, _text: '',
      set textContent(v) { this._text = String(v); this.children = []; },
      get textContent() { return this._text + this.children.map((c) => c.textContent).join(''); },
      set innerHTML(v) { if (v !== '') throw new Error('innerHTML 에 글자를 넣었다'); this.children = []; this._text = ''; },
      get innerHTML() { return ''; },
      setAttribute(k, v) { this.attrs[k] = String(v); },
      getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
      appendChild(c) { if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = this; this.children.push(c); return c; },
      removeChild(c) { this.children = this.children.filter((x) => x !== c); c.parentNode = null; return c; },
      remove() { if (this.parentNode) this.parentNode.removeChild(this); },
      dispatch(type, init) { return dispatch(this, type, init); },
      click() { return dispatch(this, 'click'); },
      blur() {}
    });
  }
  const body = mk('body');
  body.parentNode = doc;
  doc.body = body;
  doc.createElement = mk;
  doc.dispatch = function (type, init) { return dispatch(doc, type, init); };
  /* 키 하나 — 대상을 안 주면 body(아무 데도 초점이 없을 때 브라우저가 쓰는 자리) */
  doc.key = function (k, at) { return dispatch(at || body, 'keydown', { key: k }); };
  doc.listenerCount = function (type, cap) {
    return doc._l.filter((x) => x.type === type && (cap === undefined || x.cap === !!cap)).length;
  };
  return doc;
}

function all(el, out) { out = out || []; out.push(el); el.children.forEach((c) => all(c, out)); return out; }

module.exports = { fakeDoc, dispatch, all };
