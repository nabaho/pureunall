/* 포털 «관리실 서랍» — 영업관리·내부관리 줄을 왼쪽 서랍으로 (대표 지시 2026-11-28)
   「5번 시안으로 · 관리실은 왼쪽 · 영업관리/내부관리는 공간으로 확 구분 · 표기도」

   지키는 규칙
   ① 영업·내부 줄은 «서랍 안»에 지어지고, 서랍은 #appRows «안에» 있다(줄 고정·꾹 눌러 ★·끌기가 #appRows 에 붙어 있다).
      의뢰인 업무·자료함은 서랍 «밖»에 그대로다. 줄 틀(appTiles_<id>)은 하나도 안 없어진다.
   ② 서랍 구역은 영업·내부 둘이고, 탭마다 이름·누가 쓰는 일·앱 개수·확인할 앱 수를 «표기»한다. 구역마다 색이 다르다.
   ③ 머리줄 «관리실» 단추는 기본 감춤이고, 앱이 하나라도 보이면(또는 배치를 바꿀 수 있는 관리자면) 켠다 — 길이 숨지 않는다.
      앱이 없는 구역 탭은 감춘다. 지금 탭이 감춰지면 보이는 탭으로 옮긴다. 아무것도 없으면 열린 서랍도 닫는다.
   ④ 서랍 줄은 접히지 않는다(머리가 감춰져 한 번 접히면 못 편다).
   ⑤ 닫기: ✕ · Esc · 서랍 밖 누르기 — 단, 관리자가 앱을 끌어 옮기는 중(lay-editing)에는 열어 둔다.
   ⑥ 서랍 맨 아래에 «백업·복구 · 설정» 줄이 있다(대표 지시 2026-11-28). 떠 있는 두 단추를 «대신 눌러 준다» — 원본이 있고 켜져 있을 때(= 관리자)만 보이고,
      누르면 서랍을 먼저 닫은 뒤 원본 단추를 누른다.
   ⚠ 글자만 찾는 검사가 아니다 — 원본의 함수를 «떠서» 가짜 화면 위에서 돌려 본다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn');

const E = fs.readFileSync(path.join(__dirname, '..', 'enter.html'), 'utf8').replace(/\r\n/g, '\n');

function sliceBlock(from, endMarker) {
  const a = E.indexOf(from);
  assert.ok(a > -1, '★ 원본에서 「' + from + '」 을 못 찾았다');
  return E.slice(a, E.indexOf(endMarker, a) + endMarker.length);
}
const ROWS_SRC = sliceBlock('var APP_ROWS = [', '\n  ];');
const MG_SRC = sliceBlock('var MG_ZONES = [', '\n  ];');
const FUNCS_SRC = ['function mgInDrawer(', 'function mgDrawerHtml(', 'function buildAppRows(', 'function mgSelect(', 'function mgFootSrc(', 'function mgFootSync(', 'function mgFootClick(', 'function mgSync(', 'function mgOpen(', 'function mgClose(']
  .map((d) => cutFn(E, d)).join('\n');

function fakeEl(extra) {
  const el = {
    hidden: false, textContent: '', title: '', tabIndex: 0, dataset: {}, children: [], style: {}, _attrs: {},
    classList: {
      _s: new Set(),
      add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); },
      contains(c) { return this._s.has(c); },
    },
    setAttribute(k, v) { this._attrs[k] = String(v); },
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(this._attrs, k) ? this._attrs[k] : null; },
    querySelector() { return null; }, focus() {},
  };
  return Object.assign(el, extra || {});
}

function world(opts) {
  opts = opts || {};
  const els = {};
  const ctx = {
    console, els, store: {}, canDrag: !!opts.canDrag,
    localStorage: { getItem: () => null, setItem(k, v) { ctx.store[k] = v; } },
  };
  vm.createContext(ctx);
  vm.runInContext(ROWS_SRC + '\n' + MG_SRC + '\n'
    + 'var _mgTab = "sales";\n'
    + 'var $ = function(id){ return els[id] || null; };\n'
    + 'function tileShown(t){ return !!t && (!t.style || t.style.display !== "none"); }\n'
    + 'function layoutCanDrag(){ return canDrag; }\nfunction layoutEditing(){ return false; }\n'
    + FUNCS_SRC, ctx);
  return ctx;
}

/* 서랍 화면 조각 — 단추·탭·세는 칸·구역 상자 */
function drawerWorld(tilesBySheet, opts) {
  const w = world(opts);
  const zones = ['sales', 'inside'];
  w.els.mgDrawer = fakeEl();
  w.els.mgBtn = fakeEl({ hidden: true });
  w.els.mgBadge = fakeEl({ hidden: true });
  zones.forEach((z) => {
    w.els['mgTab_' + z] = fakeEl({ dataset: { zone: z } });
    w.els['mgCnt_' + z] = fakeEl();
    w.els['mgBadge_' + z] = fakeEl({ hidden: true });
    w.els['mgPane_' + z] = fakeEl({ hidden: true });
    w.els['appTiles_' + z] = fakeEl({ children: (tilesBySheet[z] || []).map((t) => fakeEl({
      style: { display: t.off ? 'none' : '' },
      querySelector: () => (t.alert ? fakeEl({}) : null),
    })) });
  });
  return w;
}

test('① 영업·내부 줄은 서랍 «안», 서랍은 #appRows «안», 의뢰인 업무·자료함은 서랍 «밖»에 지어진다', () => {
  const w = world();
  const host = fakeEl({ innerHTML: '' });
  w.els.appRows = host;
  vm.runInContext('buildAppRows()', w);
  const h = host.innerHTML;
  const at = (s) => h.indexOf(s);
  const drawerAt = at('<aside id="mgDrawer"');
  const drawerEnd = at('</aside>');
  assert.ok(drawerAt > 0 && drawerEnd > drawerAt, '★ 서랍이 #appRows 안에 지어져야 한다');
  ['client', 'store'].forEach((id) => {
    const a = at('id="appTiles_' + id + '"');
    assert.ok(a > -1 && a < drawerAt, '★ 「' + id + '」 줄은 서랍 밖(앞)에 있어야 한다');
  });
  ['sales', 'inside'].forEach((id) => {
    const a = at('id="appTiles_' + id + '"');
    assert.ok(a > drawerAt && a < drawerEnd, '★ 「' + id + '」 줄은 서랍 안에 있어야 한다');
  });
  const salesPane = h.slice(at('id="mgPane_sales"'), at('id="mgPane_inside"'));
  assert.ok(salesPane.includes('appTiles_sales') && !salesPane.includes('appTiles_inside'), '★ 영업 구역에는 영업 줄만 — 두 줄을 섞지 않는다');
  const found = [...h.matchAll(/data-row-freeze="([a-z]+)"/g)].map((m) => m[1]).sort();
  assert.deepEqual(found, ['client', 'inside', 'sales', 'store'], '★ 줄 고정 단추(줄마다 하나)가 서랍 줄에도 있어야 한다');
});

test('② 탭마다 이름·누가 쓰는 일·앱 개수·확인할 앱 수를 표기하고, 구역 색이 다르다', () => {
  const w = world();
  const host = fakeEl({ innerHTML: '' });
  w.els.appRows = host;
  vm.runInContext('buildAppRows()', w);
  const h = host.innerHTML;
  ['sales', 'inside'].forEach((z) => {
    const tab = h.slice(h.indexOf('id="mgTab_' + z + '"'), h.indexOf('</button>', h.indexOf('id="mgTab_' + z + '"')));
    assert.ok(/mg-tab-t/.test(tab) && /mg-tab-s/.test(tab) && tab.includes('id="mgCnt_' + z + '"') && tab.includes('id="mgBadge_' + z + '"'),
      '★ 「' + z + '」 탭에 이름·누가 쓰는 일·개수 칸·확인할 앱 칸이 모두 있어야 한다');
  });
  const css = (sel) => { const a = E.indexOf(sel); assert.ok(a > -1, '★ CSS 「' + sel + '」 이 없다'); return E.slice(a, E.indexOf('}', a)); };
  const c1 = css('.mg-zone[data-zone="sales"]{'), c2 = css('.mg-zone[data-zone="inside"]{');
  assert.notEqual(c1.match(/--mg-c:([^;]+);/)[1], c2.match(/--mg-c:([^;]+);/)[1], '★ 두 구역의 띠 색이 달라야 «공간이 갈린 것»이 보인다');
  assert.notEqual(c1.match(/--mg-bg:([^;]+);/)[1], c2.match(/--mg-bg:([^;]+);/)[1], '★ 두 구역의 바탕색도 달라야 한다');
});

test('③ 단추는 앱이 하나라도 보일 때만 켜고, 숫자(확인할 앱)·개수를 맞춘다', () => {
  const w = drawerWorld({ sales: [{}, {}, { alert: true }], inside: [{ off: true }, { off: true, alert: true }] });
  vm.runInContext('mgSync()', w);
  assert.equal(w.els.mgBtn.hidden, false, '★ 영업 앱이 보이는데 관리실 단추가 감춰져 있다 — 길이 숨었다');
  assert.equal(w.els.mgCnt_sales.textContent, '3개');
  assert.equal(w.els.mgBadge_sales.textContent, '확인할 앱 1');
  assert.equal(w.els.mgBadge_sales.hidden, false);
  assert.equal(w.els.mgBadge.textContent, '1', '★ 머리줄 단추 숫자는 «지금 보이는» 확인할 앱만 센다(감춘 타일 제외)');
  assert.equal(w.els.mgTab_inside.hidden, true, '★ 보이는 앱이 없는 구역 탭은 감춘다');
  assert.equal(w.els.mgTab_sales.hidden, false);
});

test('③ 지금 탭이 감춰지면 보이는 탭으로 옮기고, 아무것도 없으면 단추를 감추고 열린 서랍도 닫는다', () => {
  const w = drawerWorld({ sales: [{ off: true }], inside: [{}] });
  vm.runInContext('_mgTab = "sales"; mgSync();', w);
  assert.equal(vm.runInContext('_mgTab', w), 'inside', '★ 영업 구역이 비었으면 내부 구역으로 옮겨야 한다');
  assert.equal(w.els.mgPane_inside.hidden, false);
  assert.equal(w.els.mgPane_sales.hidden, true);
  const e = drawerWorld({ sales: [{ off: true }], inside: [] });
  e.els.mgDrawer.classList.add('open');
  vm.runInContext('mgSync()', e);
  assert.equal(e.els.mgBtn.hidden, true, '★ 보일 앱이 없으면 단추도 감춘다(빈 서랍을 열게 두지 않는다)');
  assert.equal(e.els.mgDrawer.classList.contains('open'), false, '★ 열려 있던 서랍도 닫혀야 한다');
});

test('③ 배치를 바꿀 수 있는 관리자는 빈 구역도 보인다 — 비었다고 감추면 그 구역으로 앱을 못 옮긴다', () => {
  const w = drawerWorld({ sales: [], inside: [] }, { canDrag: true });
  vm.runInContext('mgSync()', w);
  assert.equal(w.els.mgBtn.hidden, false);
  assert.equal(w.els.mgTab_sales.hidden, false);
  assert.equal(w.els.mgTab_inside.hidden, false);
});

test('④ 서랍 줄은 접히지 않는다 — 접기 계산에서 빼고, 접힘 클래스를 달지 않는다', () => {
  assert.match(E, /box\.classList\.toggle\('fold', folded && !r\.drawer\)/, '★ applyFold 가 서랍 줄에 fold 를 달면 칩 모양이 되고 머리가 감춰져 못 편다');
  assert.match(E, /\.mg-zone \.tilerow-h\{display:none;\}/, '★ 서랍 안 줄 머리는 탭·구역 머리가 대신한다');
});

test('⑤ 닫는 길 — ✕ · Esc · 서랍 밖 누르기(배치 편집 중에는 열어 둔다)', () => {
  const wire = cutFn(E, 'function mgWire(');
  assert.match(wire, /mgClose\(true\)/, '★ ✕/Esc 로 닫는 길이 있어야 한다');
  assert.match(wire, /e\.key !== 'Escape'/, '★ Esc 로 닫혀야 한다');
  assert.match(wire, /lay-editing/, '★ 앱을 끌어 옮기는 중(배치 편집)에는 밖을 눌러도 서랍을 닫지 않는다');
  assert.match(wire, /layoutPanel/, '★ 배치 목록 창이 떠 있으면 Esc 는 그 창을 먼저 닫는다');
  assert.match(wire, /mgOtherModalOpen\(\)/, '★ 서랍 앱이 띄운 창(aria-modal)이 떠 있으면 그 창의 누르기·Esc 가 서랍까지 닫으면 안 된다(검증 작업자 지적)');
  assert.doesNotMatch(E, /body\.lay-admin \.mg-zone/, '★ body.lay-admin 은 없는 클래스다 — 관리자 줄 고정 단추 자리는 «단추가 켜진 줄»(:has)로 건다');
  assert.match(E, /<button id="mgBtn"[^>]* hidden>/, '★ 관리실 단추는 «감춘 채»로 시작해 JS 가 켠다');
  assert.match(E, /function initFold\(\)\{\s*mgWire\(\);/, '★ 서랍 연결(mgWire)은 initFold 에서 한 번 건다');
});

/* ⑥ 서랍 맨 아래 «백업·복구 · 설정» */
function footWorld(srcs) {
  const w = drawerWorld({ sales: [{}], inside: [] });
  const clicks = [];
  const mk = (id, src) => fakeEl({ _id: id, hidden: !!(src && src.hidden), style: { display: src && src.off ? 'none' : '' }, click() { clicks.push(id); } });
  const srcEls = {};
  if (srcs.backup) srcEls['pu-backup-admin-button'] = mk('backup', srcs.backup);
  if (srcs.cfg) srcEls.cfgFab = mk('cfg', srcs.cfg);
  w.document = { getElementById: (id) => srcEls[id] || null };
  w.clicks = clicks;
  w.els.mgFt = fakeEl({ hidden: true });
  w.els.mgFtBackup = fakeEl({ hidden: true, _attrs: { 'data-src': 'pu-backup-admin-button' } });
  w.els.mgFtCfg = fakeEl({ hidden: true, _attrs: { 'data-src': 'cfgFab' } });
  w.els.mgFt.querySelectorAll = () => [w.els.mgFtBackup, w.els.mgFtCfg];
  return w;
}

test('⑥ 맨 아래 줄은 원본 단추가 «있고 켜져 있을 때»만 보인다 — 직원(원본 없음)에게는 줄째 감춘다', () => {
  const none = footWorld({});
  vm.runInContext('mgSync()', none);
  assert.equal(none.els.mgFt.hidden, true, '★ 원본 단추가 없으면(직원) 줄도 감춘다');
  const both = footWorld({ backup: {}, cfg: {} });
  vm.runInContext('mgSync()', both);
  assert.equal(both.els.mgFt.hidden, false);
  assert.equal(both.els.mgFtBackup.hidden, false);
  assert.equal(both.els.mgFtCfg.hidden, false);
  const half = footWorld({ backup: {}, cfg: { off: true } });
  vm.runInContext('mgSync()', half);
  assert.equal(half.els.mgFtBackup.hidden, false, '★ 백업·복구만 켜져 있으면 그것만 보인다');
  assert.equal(half.els.mgFtCfg.hidden, true, '★ 설정 원본이 display:none 이면 설정 단추는 감춘다');
  assert.equal(half.els.mgFt.hidden, false);
});

test('⑥ 누르면 서랍을 «먼저» 닫고 원본 단추를 누른다 — 원본이 없으면 아무 일도 안 한다', () => {
  const w = footWorld({ backup: {}, cfg: {} });
  w.els.mgDrawer.classList.add('open');
  const order = [];
  const closeOrig = vm.runInContext('mgClose', w);
  w.mgClose = function () { order.push('close:' + w.els.mgDrawer.classList.contains('open')); return closeOrig.apply(this, arguments); };
  const origClick = w.document.getElementById('cfgFab').click;
  w.document.getElementById('cfgFab').click = function () { order.push('click:' + w.els.mgDrawer.classList.contains('open')); return origClick.apply(this, arguments); };
  vm.runInContext('mgFootClick(els.mgFtCfg)', w);
  assert.deepEqual(w.clicks, ['cfg'], '★ 설정 원본 단추가 눌려야 한다');
  assert.deepEqual(order, ['close:true', 'click:false'], '★ 서랍을 «먼저» 닫고(close) 그 다음에 원본을 눌러야 한다(열려 있으면 뜨는 창이 가려진다)');
  const none = footWorld({});
  vm.runInContext('mgFootClick(els.mgFtBackup)', none);
  assert.deepEqual(none.clicks, [], '★ 원본이 없으면 누를 것이 없다');
});

test('⑥ 서랍 틀에 맨 아래 줄이 있고, 서랍 안 누르기가 그 단추를 원본으로 넘긴다', () => {
  const w = world();
  const host = fakeEl({ innerHTML: '' });
  w.els.appRows = host;
  vm.runInContext('buildAppRows()', w);
  const h = host.innerHTML;
  const end = h.indexOf('</aside>');
  const ft = h.indexOf('id="mgFt"');
  assert.ok(ft > h.indexOf('id="mgPane_inside"') && ft < end, '★ 줄은 구역들 «뒤», 서랍 맨 끝에 있어야 «맨 아래»다');
  assert.match(h, /id="mgFtBackup"[^>]*data-src="pu-backup-admin-button"[^>]* hidden>/, '★ 백업·복구 단추는 감춘 채로 시작해 원본을 따라 켠다');
  assert.match(h, /id="mgFtCfg"[^>]*data-src="cfgFab"[^>]* hidden>/, '★ 설정 단추도 감춘 채로 시작한다');
  assert.match(cutFn(E, 'function mgWire('), /\.mg-ft button[\s\S]*mgFootClick\(ft\)/, '★ 서랍 안 누르기가 맨 아래 단추를 mgFootClick 으로 넘겨야 한다');
  assert.match(E, /body:has\(#mgDrawer\.open\) #cfgFab,body:has\(#mgDrawer\.open\) #pu-backup-admin-button\{visibility:hidden;\}/, '★ 서랍이 열려 있는 동안 떠 있는 두 알약이 맨 아래 줄 위에 겹치지 않게 감춘다');
  assert.match(E, /\.mg-ft\{[^}]*flex:none;/, '★ 줄은 구역이 길어져도 밀려나지 않게 고정 높이(flex:none)다');
});
