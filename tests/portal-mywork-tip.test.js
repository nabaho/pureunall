'use strict';
/* 📋 포털 «내 업무» 첫 안내 — 로그인하면 머리줄 «내 업무» 단추 바로 아래에 안내 상자 (대표 지시 2026-11-22)

   대표 말씀: 「로그인하면 내 업무 현재 진행 상황은 어디다라고 하고 팝업창으로, 내 업무 박스 옆에 여기를 누르면
     본인 지금 현재 업무를 입력하거나 ERP 진행 상황 등을 확인할 수 있다, 여기에 데이터를 넣을 수 있다, 관리가 가능하다」.

   지키는 규칙
     ① 처음(이 기기에서 «알겠어요»를 안 누른 사람)에게 뜬다 · 단추가 안 보이면 안 뜬다
     ② «알겠어요» = 그 사람(로그인 UID)만 다시 안 뜬다 — 한 PC 를 같이 쓰는 다른 사람에게는 뜬다
     ③ ✕ = 이번만 닫는다(저장 안 함) · 같은 창에서 다시 그려도 또 안 뜬다 · 다음 로그인(새 창)에는 다시 뜬다
     ④ «내 업무» 단추를 누르면(안내가 없어도) 안다고 본다 · «내 업무 열기»는 단추를 누른 것과 같다
     ⑤ 저장이 막힌 브라우저(사생활 보호 창)에서도 오류 없이 뜨고 닫힌다
     ⑥ 화면 양옆 8px 안 · 화살표는 단추 가운데를 가리킨다
     ⑦ 건의하기 말풍선과 겹치지 않는다(이 안내가 뜰 차례·떠 있으면 그쪽이 쉰다)
     ⑧ 심사 전용 계정에는 안 띄운다 · 다른 사람으로 다시 그리면 걷는다 · 확인 창(모달)보다 아래

   실행: node --test tests/portal-mywork-tip.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ENTER = fs.readFileSync(path.join(__dirname, '..', 'enter.html'), 'utf8').replace(/\r\n/g, '\n');

/* head 로 시작하는 곳부터 짝이 맞는 닫는 중괄호까지 — 따옴표 안의 괄호는 센다에서 뺀다 */
function 몸(head) {
  const at = ENTER.indexOf(head);
  assert.ok(at >= 0, head + ' 를 못 찾았다 — 검사가 헛돈다');
  let i = ENTER.indexOf('{', at), d = 0, q = '';
  for (; i < ENTER.length; i++) {
    const ch = ENTER[i];
    if (q) { if (ch === '\\') { i++; continue; } if (ch === q) q = ''; continue; }
    if (ch === '\'' || ch === '"' || ch === '`') { q = ch; continue; }
    if (ch === '{') d++;
    else if (ch === '}') { d--; if (!d) return ENTER.slice(at, i + 1); }
  }
  throw new Error('짝을 못 맞춤: ' + head);
}
const 함수들 = ['mwTipSeen', 'mwTipAck', 'mwTipBtn', 'portalMyWorkTipDue', 'mwTipKey', 'mwTipClose', 'mwTipRedraw', 'mwTipWire', 'mwTipBusy',
  'mwTipPlace', 'portalMyWorkTip', 'sgShowTip'];
const 열쇠줄 = (ENTER.match(/var MWTIP_KEY = '[^']+';/) || [])[0];

/* 아주 작은 가짜 화면 — 이 안내가 쓰는 것만 */
function 놀이터(o = {}) {
  const store = o.store || new Map();
  const ls = o.막힘
    ? { getItem() { throw new Error('막힘'); }, setItem() { throw new Error('막힘'); } }
    : { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) };
  const byId = {};
  const 문서 = {};
  const 듣기 = (m) => ({ add: (t, f) => (m[t] = m[t] || []).push(f), del: (t, f) => { m[t] = (m[t] || []).filter((x) => x !== f); } });
  function el(tag) {
    const e = {
      tagName: tag, attrs: {}, style: {}, children: [], listeners: {}, hidden: false, parentNode: null, _q: {}, rect: null, 눌림: 0,
      classList: { add() {}, remove() {} },
      보임: false,
      getClientRects() { return this.보임 ? [{}] : []; },
      focus() { 문서.activeElement = this; },
      contains(x) { return x === this || Object.values(this._q).indexOf(x) >= 0 || this.children.some((c) => c.contains(x)); },
      setAttribute(k, v) { this.attrs[k] = String(v); if (k === 'id') byId[v] = this; },
      getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
      addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); },
      appendChild(c) { c.parentNode = this; this.children.push(c); if (c.attrs.id) byId[c.attrs.id] = c; return c; },
      remove() {
        if (this.parentNode) this.parentNode.children = this.parentNode.children.filter((x) => x !== this);
        if (this.attrs.id && byId[this.attrs.id] === this) delete byId[this.attrs.id];
        this.parentNode = null;
      },
      querySelector(s) { return this._q[s] || null; },
      getBoundingClientRect() { return this.rect || { left: 0, top: 0, bottom: 0, right: 0, width: 0 }; },
      click() { this.눌림++; (this.listeners.click || []).slice().forEach((f) => f({ preventDefault() {} })); },
    };
    Object.defineProperty(e, 'id', { get() { return this.attrs.id; }, set(v) { this.setAttribute('id', v); } });
    Object.defineProperty(e, 'innerHTML', {
      get() { return this._html || ''; },
      set(h) { this._html = h; ['mw-x', 'mw-ok', 'mw-go', 'mw-ar'].forEach((c) => { if (h.indexOf('class="' + c + '"') >= 0) this._q['.' + c] = el('span'); }); },
    });
    return e;
  }
  const docL = {}, winL = {};
  const vw = o.vw || 1366;
  const bar = el('div'); bar.rect = { left: 0, top: 0, bottom: 80, right: vw, width: vw };
  const btn = el('a'); btn.setAttribute('id', 'headApp_work'); bar.appendChild(btn);
  btn.rect = o.btnRect || { left: 600, right: 780, top: 20, bottom: 64, width: 180 };
  if (o.hidden) btn.hidden = true;
  const sgFab = el('button'); sgFab.setAttribute('id', 'sgFab');
  const 확인창 = el('div'); 확인창.setAttribute('id', 'sgDoneModal'); 확인창.보임 = !!o.확인창;
  const 몸통 = el('body');
  const sgTips = o.sgTips || [];
  문서.createElement = el;
  문서.body = 몸통;
  문서.activeElement = o.초점 || 몸통;
  문서.querySelectorAll = (s) => (s === '.sg-tip' ? sgTips.slice() : []);
  문서.addEventListener = (t, f) => 듣기(docL).add(t, f);
  문서.removeEventListener = (t, f) => 듣기(docL).del(t, f);
  문서.documentElement = { clientWidth: vw };
  const ctx = {
    localStorage: ls,
    _curUid: o.uid === undefined ? 'uid-A' : o.uid,
    _sgTipShown: false,
    $: (id) => byId[id] || null,
    document: 문서,
    window: { addEventListener: (t, f) => 듣기(winL).add(t, f), removeEventListener: (t, f) => 듣기(winL).del(t, f), innerWidth: vw },
    requestAnimationFrame: (f) => f(),
    setTimeout: () => 0,
    Math, String,
  };
  vm.createContext(ctx);
  assert.ok(열쇠줄, '열쇠 이름 줄(var MWTIP_KEY)을 못 찾았다');
  vm.runInContext(열쇠줄 + '\nvar _mwTipSession = {};', ctx);
  함수들.forEach((n) => vm.runInContext(몸('function ' + n + '('), ctx));
  return { ctx, store, bar, btn, sgFab, docL, winL, byId, 문서, 몸통, 열쇠: (uid) => vm.runInContext('MWTIP_KEY', ctx) + uid,
    tip: () => byId.mwTip || null, run: (s) => vm.runInContext(s, ctx) };
}

test('① 처음 로그인한 사람에게 «내 업무» 단추 바로 아래에 뜬다 · 단추가 안 보이면 안 뜬다', () => {
  const p = 놀이터();
  assert.equal(p.run('portalMyWorkTipDue()'), true, '뜰 차례라고 답하지 않는다');
  p.run('portalMyWorkTip(false)');
  const t = p.tip();
  assert.ok(t, '★ 처음 로그인했는데 안내가 안 뜬다');
  assert.equal(t.parentNode, p.bar, '머리줄(단추와 같은 틀) 안에 붙지 않았다 — 자리를 못 맞춘다');
  assert.equal(t.getAttribute('role'), 'dialog');
  assert.equal(t.getAttribute('aria-modal'), 'false', '포털을 막는 창이 아니라 말풍선이다');
  assert.ok(t.getAttribute('aria-labelledby'), '화면읽기가 읽을 제목이 없다');
  assert.ok((t.innerHTML.match(/<li>/g) || []).length >= 3, '무엇을 할 수 있는지(보기·입력·이알피 확인·관리) 안내가 모자라다');
  /* 숨은 단추 · 로그인 전 */
  const q = 놀이터({ hidden: true }); q.run('portalMyWorkTip(false)');
  assert.equal(q.tip(), null, '★ 단추가 안 보이는데 안내가 뜬다(가리킬 곳이 없다)');
  const r = 놀이터({ uid: '' }); r.run('portalMyWorkTip(false)');
  assert.equal(r.tip(), null, '★ 누구인지 모르는데 안내가 뜬다');
});

test('② «알겠어요» = 그 사람만 다시 안 뜬다 — 같은 PC 의 다른 사람에게는 뜬다', () => {
  const store = new Map();
  const p = 놀이터({ store });
  p.run('portalMyWorkTip(false)');
  p.tip().querySelector('.mw-ok').click();
  assert.equal(p.tip(), null, '«알겠어요»를 눌렀는데 안 닫힌다');
  assert.equal(store.get(p.열쇠('uid-A')), '1', '★ «알겠어요»를 기억하지 않는다 — 로그인마다 또 뜬다');
  const 다음 = 놀이터({ store }); 다음.run('portalMyWorkTip(false)');
  assert.equal(다음.tip(), null, '★ «알겠어요» 누른 사람에게 다음 로그인에 또 뜬다');
  assert.equal(다음.run('portalMyWorkTipDue()'), false);
  const 남 = 놀이터({ store, uid: 'uid-B' }); 남.run('portalMyWorkTip(false)');
  assert.ok(남.tip(), '★ 같은 PC 의 다른 사람에게 안 뜬다 — 열쇠가 사람마다가 아니다');
});

test('③ ✕ = 이번만 닫는다 — 같은 창에서 다시 그려도 안 뜨고, 다음 로그인엔 다시 뜬다', () => {
  const store = new Map();
  const p = 놀이터({ store });
  p.run('portalMyWorkTip(false)');
  p.tip().querySelector('.mw-x').click();
  assert.equal(p.tip(), null, '✕ 를 눌렀는데 안 닫힌다');
  assert.equal(store.size, 0, '★ ✕ 가 «다시 안 보기»로 저장됐다 — 그건 «알겠어요»다');
  p.run('portalMyWorkTip(false)');
  assert.equal(p.tip(), null, '★ 같은 창에서 포털을 다시 그리니 또 뜬다 — 닫은 것을 무시한다');
  const 새창 = 놀이터({ store }); 새창.run('portalMyWorkTip(false)');
  assert.ok(새창.tip(), '★ ✕ 로 닫은 사람에게 다음 로그인에 안 뜬다');
  /* Esc 도 «이번만» */
  const e = 놀이터(); e.run('portalMyWorkTip(false)');
  (e.docL.keydown || []).forEach((f) => f({ key: 'Escape' }));
  assert.equal(e.tip(), null, 'Esc 로 안 닫힌다');
  assert.equal((e.docL.keydown || []).length, 0, '닫은 뒤에도 키 듣기가 남았다');
  assert.equal((e.winL.resize || []).length, 0, '닫은 뒤에도 창 크기 듣기가 남았다');
});

test('④ «내 업무» 단추를 누르면 안다고 본다 · «내 업무 열기»는 단추를 누른 것과 같다', () => {
  const store = new Map();
  const p = 놀이터({ store });
  p.run('portalMyWorkTip(false)');
  p.btn.click();
  assert.equal(p.tip(), null, '단추를 눌렀는데 안내가 남았다');
  assert.equal(store.get(p.열쇠('uid-A')), '1', '★ 단추를 눌러 들어갔는데 다음에 또 안내한다');
  /* 안내가 없을 때(✕ 로 닫은 뒤) 눌러도 */
  const s2 = new Map(), q = 놀이터({ store: s2 });
  q.run('portalMyWorkTip(false)'); q.tip().querySelector('.mw-x').click();
  q.btn.click();
  assert.equal(s2.get(q.열쇠('uid-A')), '1', '★ ✕ 뒤에 단추로 들어갔는데 기억하지 않는다');
  /* 열기 */
  const s3 = new Map(), r = 놀이터({ store: s3 });
  r.run('portalMyWorkTip(false)');
  r.tip().querySelector('.mw-go').click();
  assert.equal(r.btn.눌림, 1, '★ «내 업무 열기»가 단추를 누르지 않는다 — 여는 길이 둘이 된다');
  assert.equal(r.tip(), null);
  assert.equal(s3.get(r.열쇠('uid-A')), '1');
  /* 다시 그려도 단추 듣기는 한 번만 붙는다 */
  const s4 = new Map(), w = 놀이터({ store: s4 });
  w.run('portalMyWorkTip(false)'); w.run('portalMyWorkTip(true)'); w.run('portalMyWorkTip(true)');
  assert.equal((w.btn.listeners.click || []).length, 1, '단추에 같은 듣기가 여러 번 붙는다');
});

test('⑤ 저장이 막힌 브라우저에서도 오류 없이 뜨고 닫힌다', () => {
  const p = 놀이터({ 막힘: true });
  assert.doesNotThrow(() => p.run('portalMyWorkTip(false)'));
  assert.ok(p.tip(), '★ 저장을 못 읽는다고 안내를 아예 안 띄운다');
  assert.doesNotThrow(() => p.tip().querySelector('.mw-ok').click(), '★ 저장을 못 하는데 오류가 난다');
  assert.equal(p.tip(), null);
  assert.doesNotThrow(() => p.btn.click());
});

test('⑥ 화면 양옆 8px 안 · 화살표는 단추 가운데를 가리킨다', () => {
  [
    { vw: 360, btnRect: { left: 270, right: 306, top: 30, bottom: 66, width: 36 } },   // 폰 — 단추가 오른쪽 끝 가까이
    { vw: 1366, btnRect: { left: 617, right: 800, top: 66, bottom: 110, width: 183 } },
    { vw: 768, btnRect: { left: 8, right: 44, top: 66, bottom: 106, width: 36 } },     // 단추가 왼쪽 끝
  ].forEach((o) => {
    const p = 놀이터(o);
    p.run('portalMyWorkTip(false)');
    const t = p.tip();
    const w = parseFloat(t.style.width), left = parseFloat(t.style.left);
    assert.ok(w > 0 && w <= o.vw - 16, o.vw + 'px: 폭이 화면보다 넓다 ' + w);
    assert.ok(left >= 8 && left + w <= o.vw - 8, o.vw + 'px: ★ 화면 밖으로 나간다 left=' + left + ' w=' + w);
    assert.ok(parseFloat(t.style.top) > o.btnRect.bottom - 1, o.vw + 'px: 단추를 덮는다(아래에 와야 한다)');
    const ar = parseFloat(t.querySelector('.mw-ar').style.left), cx = o.btnRect.left + o.btnRect.width / 2;
    assert.ok(ar >= 0 && ar <= w, o.vw + 'px: 화살표가 상자 밖이다');
    const 끝에걸림 = ar === 14 || ar === w - 26;   // 단추가 화면 끝이라 상자 모서리 가까이 붙은 때만 비켜 선다
    assert.ok(끝에걸림 || Math.abs(left + ar + 6 - cx) <= 1, o.vw + 'px: ★ 화살표가 단추 가운데를 안 가리킨다');
  });
});

test('⑦ 건의하기 말풍선과 겹치지 않는다 — 이 안내가 뜰 차례·떠 있으면 그쪽이 쉰다', () => {
  const p = 놀이터();
  p.run('sgShowTip()');
  assert.equal(p.sgFab.children.length, 0, '★ 내 업무 안내가 뜰 차례인데 건의하기 말풍선이 같은 자리에 뜬다');
  assert.equal(p.run('_sgTipShown'), false, '쉰 것인데 «보였다»로 적어 다음 기회도 잃는다');
  /* 이미 «알겠어요» 한 사람에게는 건의하기 말풍선이 그대로 뜬다 */
  const store = new Map([[p.열쇠('uid-A'), '1']]);
  const q = 놀이터({ store }); q.run('sgShowTip()');
  assert.equal(q.sgFab.children.length, 1, '★ 안내를 다 본 사람에게 건의하기 말풍선이 안 뜬다');
  /* 먼저 떠 있던 건의하기 말풍선은 걷는다 */
  const old = { removed: 0, remove() { this.removed++; } };
  const r = 놀이터({ sgTips: [old] }); r.run('portalMyWorkTip(false)');
  assert.equal(old.removed, 1, '먼저 떠 있던 건의하기 말풍선을 안 걷는다 — 겹쳐 보인다');
});

test('⑧ 심사 전용 계정엔 안 띄움 · 다른 사람으로 다시 그리면 걷음 · 확인 창보다 아래 · 숫자가 붙으면 다시 맞춤', () => {
  const rp = 몸('function renderPortal(');
  const 심사 = rp.indexOf("if(role === 'reviewer'){\n      SG.role");
  assert.ok(심사 > 0, '심사 계정 갈래를 못 찾았다 — 검사가 헛돈다');
  const 갈래 = rp.slice(심사, rp.indexOf('mfaOfferAfterLogin', 심사));
  const 직원 = 갈래.slice(갈래.indexOf('} else {'));
  assert.ok(/portalMyWorkTip\(/.test(직원), '직원 갈래에서 안내를 부르지 않는다');
  assert.ok(!/portalMyWorkTip\(/.test(갈래.slice(0, 갈래.indexOf('} else {'))), '★ 심사 전용 계정에 안내가 뜬다');
  assert.equal((rp.match(/portalMyWorkTip\(/g) || []).length, 1, '포털을 그릴 때 안내를 두 곳에서 부른다');
  assert.ok(/mwTipRedraw\(\)/.test(몸('function portalHeadAppsHide(')), '★ 다른 사람으로 다시 그릴 때 앞사람 안내가 남는다');
  /* 단추 누름 듣기는 «안내를 늦게 띄우기» 앞에서, 바로 — 0.6초 사이에 눌러도 기억한다(외부 검토 2026-11-22 중간) */
  const 직원줄 = 직원.slice(0, 직원.indexOf('setTimeout(function(){ portalMyWorkTip('));
  assert.ok(/mwTipWire\(\)/.test(직원줄), '★ 단추 누름을 안내가 뜬 뒤에야 듣는다 — 그 전에 누르면 다음 로그인에 또 뜬다');
  assert.ok(/mwTipPlace\(\)/.test(몸('function portalMyWorkApply(')), '숫자가 붙어 단추 폭이 바뀌어도 화살표를 다시 안 맞춘다');
  /* z — 확인 창(해결 확인·처리할 건의)이 위다 */
  const css = ENTER.slice(0, ENTER.indexOf('</style>'));
  const z = (sel) => { const m = css.match(new RegExp(sel.replace(/[.#]/g, '\\$&') + '\\{[^}]*z-index:(\\d+)')); return m ? +m[1] : NaN; };
  const 안내 = z('.mw-tip'), 확인 = Math.min(z('#sgDoneModal'), z('#sgPendModal'));
  assert.ok(안내 > 0 && 확인 > 0, 'z-index 를 못 읽었다 — 검사가 헛돈다');
  assert.ok(안내 < 확인, '★ 안내가 확인 창 위로 올라온다 — 꼭 봐야 할 확인 창을 가린다');
  /* 고정 글자만 — 바깥 값을 innerHTML 에 섞지 않는다 */
  const 본문 = 몸('function portalMyWorkTip(');
  const html = 본문.slice(본문.indexOf('t.innerHTML ='), 본문.indexOf(';', 본문.indexOf("'<small>")));
  assert.ok(html.length > 50, '안내 글자 덩이를 못 찾았다');
  assert.ok(!/\+\s*[A-Za-z_$][\w$]*\s*\+/.test(html.replace(/'[^']*'/g, "''")), '★ 안내 innerHTML 에 바깥 값이 섞였다');
});

test('⑩ 안내가 뜨기 전(0.6초 사이)에 단추를 눌러도 «앎»으로 기억한다', () => {
  const store = new Map();
  const p = 놀이터({ store });
  p.run('mwTipWire()');            // 포털을 그리자마자
  p.btn.click();                   // 안내가 뜨기 전에 누름
  assert.equal(store.get(p.열쇠('uid-A')), '1', '★ 안내 전에 단추로 들어갔는데 기억하지 않는다');
  p.run('portalMyWorkTip(false)');
  assert.equal(p.tip(), null, '★ 이미 단추로 들어간 사람에게 안내가 뜬다');
});

test('⑪ 초점 — 뜰 때 안내로(화면읽기) · 키보드로 닫으면 단추로 · 적는 중이거나 확인 창이 있으면 안 빼앗는다', () => {
  const p = 놀이터();
  p.run('portalMyWorkTip(false)');
  assert.equal(p.문서.activeElement, p.tip(), '★ 뜰 때 안내로 초점이 안 간다 — 화면읽기가 안내를 모른다');
  assert.equal(p.tip().getAttribute('tabindex'), '-1', '상자가 초점을 받을 수 없다');
  p.tip().querySelector('.mw-ok').focus();
  p.tip().querySelector('.mw-ok').click();
  assert.equal(p.문서.activeElement, p.btn, '★ 키보드로 닫으면 초점이 사라진다(«내 업무» 단추로 돌아와야)');
  /* Esc 도 */
  const e = 놀이터(); e.run('portalMyWorkTip(false)');
  (e.docL.keydown || []).forEach((f) => f({ key: 'Escape' }));
  assert.equal(e.문서.activeElement, e.btn, '★ Esc 로 닫으면 초점이 사라진다');
  /* 마우스로 다른 곳을 보고 있었으면(초점이 안내 밖) 닫아도 초점을 옮기지 않는다 */
  const m = 놀이터(); m.run('portalMyWorkTip(false)');
  const 밖 = { 밖: true }; m.문서.activeElement = 밖;
  m.tip().querySelector('.mw-x').click();
  assert.equal(m.문서.activeElement, 밖, '안내 밖에 있던 초점을 단추로 끌고 온다');
  /* 적는 중 · 확인 창 */
  const 적는중 = { 입력칸: true };
  const w = 놀이터({ 초점: 적는중 }); w.run('portalMyWorkTip(false)');
  assert.ok(w.tip(), '안내는 뜬다');
  assert.equal(w.문서.activeElement, 적는중, '★ 적는 중인데 초점을 빼앗는다');
  const c = 놀이터({ 확인창: true }); c.run('portalMyWorkTip(false)');
  assert.notEqual(c.문서.activeElement, c.tip(), '★ 확인 창이 떠 있는데 그 아래 안내로 초점을 빼앗는다');
});

test('⑫ 떠 있는 채로 같은 사람이 다시 그려지면 다시 뜬다 · ✕ 로 닫았으면 안 뜬다', () => {
  const p = 놀이터();
  p.run('portalMyWorkTip(false)');
  p.run('mwTipRedraw()');          // portalHeadAppsHide 가 부른다
  assert.equal(p.tip(), null, '다시 그릴 때 걷지 않는다');
  p.run('portalMyWorkTip(false)');
  assert.ok(p.tip(), '★ 같은 사람으로 다시 그렸는데 안내가 사라진 채 돌아오지 않는다');
  p.tip().querySelector('.mw-x').click();
  p.run('mwTipRedraw()'); p.run('portalMyWorkTip(false)');
  assert.equal(p.tip(), null, '★ ✕ 로 닫았는데 다시 그리니 또 뜬다');
});

test('⑬ 폰 — 누르는 자리는 44px 이상', () => {
  const css = ENTER.slice(0, ENTER.indexOf('</style>'));
  const 폰 = css.slice(css.indexOf('.mw-tip:focus'));
  const 덩이 = (폰.match(/@media\(max-width:520px\)\{([\s\S]*?\}\s*)\}/) || [])[1] || '';
  assert.ok(/\.mw-tip/.test(덩이), '폰 구간에서 안내 단추 크기를 못 찾았다 — 검사가 헛돈다');
  const 수 = (re) => { const m = 덩이.match(re); return m ? +m[1] : 0; };
  assert.ok(수(/\.mw-ft button\{[^}]*min-height:(\d+)px/) >= 44, '★ 폰 «내 업무 열기·알겠어요» 단추가 44px 보다 작다');
  assert.ok(수(/\.mw-x\{[^}]*width:(\d+)px/) >= 44 && 수(/\.mw-x\{[^}]*height:(\d+)px/) >= 44, '★ 폰 ✕ 가 44px 보다 작다');
});

test('⑨ 점검 도구 씨앗 — 기본 화면은 «봤음», 안내 열린 모습은 따로 잰다', () => {
  const seed = fs.readFileSync(path.join(__dirname, '..', 'tools', 'phone-audit', 'seeds', 'portal.js'), 'utf8');
  assert.match(seed, /pu_mywork_tip_ok:pa-uid-1/, '기본 홈 화면 잰값이 안내 때문에 흔들린다');
  assert.match(seed, /name:\s*'mywork-tip'/, '안내 열린 화면을 안 잰다');
  assert.ok(ENTER.indexOf("window.portalMyWorkTip = portalMyWorkTip") >= 0, '점검 도구가 안내를 다시 띄울 길이 없다');
  assert.ok(seed.indexOf(vm.runInNewContext(열쇠줄 + ' MWTIP_KEY')) >= 0, '씨앗의 열쇠 이름이 화면과 다르다');
});
