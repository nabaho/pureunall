/* 🏢 사업장 표 — 머리 단추·창·띠·쪽 막대 «그린 글». 이름은 가짜만.
   ★ 규칙: 머리 단추는 #을 뺀 일곱 칸 · 창은 칸마다 맞는 입력 · 쪽 막대는 50곳 넘을 때만 · 번호가 이어진다 · 띠는 조건 있을 때만 · 이름은 걸러 넣는다 */
const test = require('node:test');
const assert = require('node:assert/strict');
global.PuRulesV2Order = require('../js/rules-v2/lib-order.js');
global.PuRulesV2Sites = require('../js/rules-v2/lib-sites.js');
global.PuRulesV2SiteCols = require('../js/rules-v2/lib-sitecols.js');
global.PuRulesV2Lib = require('../js/rules-v2/view-library.js');
const V = require('../js/rules-v2/view-sites.js');
const SC = global.PuRulesV2SiteCols;

function row(i, o) {
  return Object.assign({ id: 'c' + i, name: '회사' + i, size: 10, band: '10~29인', bizType: '제조업', linked: 1, cand: 0, candIds: [],
    candMails: 0, last: Date.UTC(2026, 0, 1), groups: [], fin: { state: '', at: 0, docId: '' }, mgr: 'P-001', subs: [], bizNo: '', closed: false }, o || {});
}
const MANY = Array.from({ length: 120 }, (_, i) => row(i + 1));
function st(extra) { return { data: { docs: {}, human: {}, rounds: {} }, companies: [], staff: { 'P-001': '홍길동' }, me: '',
  sites: Object.assign({ f: 'all', q: '', sel: '', who: '', cols: {}, sort: null, page: 1, pop: '', popq: '', popPos: null }, extra || {}) }; }

test('머리 — #을 뺀 일곱 칸이 단추, 걸린 칸은 on, 순서 화살표', () => {
  const h = V.listHtml(st({ cols: { biz: ['제조업'] }, sort: { key: 'size', dir: 'asc' } }), MANY.slice(0, 3),
    { offset: 0, cols: { biz: ['제조업'] }, sort: { key: 'size', dir: 'asc' }, pop: '' });
  const keys = [...h.matchAll(/data-act="colOpen"[^>]*data-key="(\w+)"/g)].map((m) => m[1]);
  assert.deepEqual(keys.sort(), ['band', 'biz', 'docs', 'fin', 'last', 'name', 'who']);
  assert.match(h, /<th class="[^"]*\bon\b[^"]*"[^>]*>\s*<button[^>]*data-key="biz"/, '걸린 업태 머리가 on');
  assert.match(h, /data-key="band"[^>]*>[^<]*(?:<[^>]+>)*[^<]*▲/, '순서 걸린 규모에 ▲');
  assert.match(h, /<th class="c">#<\/th>/, '# 머리는 단추가 아니다');
});

test('번호는 offset 으로 이어진다, 머리 옵션이 없으면 옛 모양 그대로', () => {
  const nums = (h) => [...h.matchAll(/<td class="no"[^>]*>(\d+)<\/td>/g)].map((m) => +m[1]);
  assert.deepEqual(nums(V.listHtml(st(), MANY.slice(50, 53), { offset: 50, cols: {}, sort: null, pop: '' })), [51, 52, 53]);
  const old = V.listHtml(st(), MANY.slice(0, 2));
  assert.deepEqual(nums(old), [1, 2]);
  assert.doesNotMatch(old, /colOpen/);
});

test('창 — 칸마다 맞는 입력 + 순서 단추 + 풀기·닫기', () => {
  const rows = MANY.slice(0, 5);
  const pop = (key, extra) => V.popHtml(st(Object.assign({ pop: key }, extra)), key, rows);
  const biz = pop('biz');
  assert.match(biz, /data-act="colSort"[^>]*data-key="biz"[^>]*data-dir="asc"/);
  assert.match(biz, /data-act="colSort"[^>]*data-dir="desc"/);
  assert.match(biz, /type="checkbox"[^>]*data-role="colchk"[^>]*data-key="biz"[^>]*data-v="제조업"/);
  assert.match(biz, /data-role="colq"/);
  assert.match(biz, /data-act="colClear"/); assert.match(biz, /data-act="colClose"/);
  assert.match(pop('band'), /data-role="colchk"[^>]*data-key="band"/);
  assert.match(pop('last'), /data-key="last"[^>]*data-v="2026"/);
  assert.match(pop('name'), /data-role="sq"/, '사업장 칸은 있는 검색 입력과 같은 조건');
  const who = pop('who');
  assert.match(who, /data-act="colWho"/); assert.doesNotMatch(who, /colchk/);
});

test('창 — 자료·★최종본은 «있는 값»만 목록에 뜬다(세 갈래가 다 있을 때 셋 다)', () => {
  // options 는 행에 있는 값만 돌려준다 — 다섯 줄이 전부 «확정»이면 후보·자료 없음은 안 뜨는 게 맞다
  const mixed = [row(1, { linked: 1 }), row(2, { linked: 0, cand: 1 }), row(3, { linked: 0, cand: 0, fin: { state: 'set', at: 1, docId: 'd' } })];
  const docs = V.popHtml(st({ pop: 'docs' }), 'docs', mixed);
  ['linked', 'cand', 'none'].forEach((v) => assert.match(docs, new RegExp('data-v="' + v + '"')));
  const fin = V.popHtml(st({ pop: 'fin' }), 'fin', mixed);
  assert.match(fin, /data-v="set"/);
});

test('창 — 고른 값은 체크, 위치는 fixed, 업태 찾기 글로 목록을 줄인다', () => {
  const rows = [row(1, { bizType: '제조업' }), row(2, { bizType: '도소매' })];
  const s = st({ pop: 'biz', cols: { biz: ['도소매'] }, popPos: { x: 120, y: 80 }, popq: '도소' });
  const h = V.popHtml(s, 'biz', rows);
  assert.match(h, /data-v="도소매"[^>]*checked|checked[^>]*data-v="도소매"/);
  assert.match(h, /position:fixed/); assert.match(h, /left:120px/); assert.match(h, /top:80px/);
  assert.doesNotMatch(h, /data-v="제조업"/, '찾기 글에 안 맞는 값은 뺀다');
});

test('띠 — 조건이 있을 때만, ✕ 와 모두 풀기, 곳 수', () => {
  assert.equal(V.condHtml({}, 289), '');
  const h = V.condHtml({ biz: ['제조업'], band: ['10~29인'] }, 31);
  assert.match(h, /업태: 제조업/); assert.match(h, /규모: 10~29인/);
  assert.match(h, /data-act="colClear"[^>]*data-key="biz"/);
  assert.match(h, /data-act="colsClear"/);
  assert.match(h, /31곳/);
});

test('쪽 막대 — 50곳 넘을 때만, 지금 쪽 on, 이전·다음 끝에서 꺼짐', () => {
  assert.equal(V.pagerHtml(SC.page(MANY.slice(0, 50), 1)), '');
  const h = V.pagerHtml(SC.page(MANY, 1));
  assert.match(h, /1–50[^<]*<\/b>[^<]*\/ 120곳/);
  assert.match(h, /class="pg on"[^>]*data-act="pageGo"[^>]*data-p="1"|data-act="pageGo"[^>]*data-p="1"[^>]*class="pg on"/);
  assert.match(h, /disabled[^>]*>‹ 이전|‹ 이전<\/button>/);
  const last = V.pagerHtml(SC.page(MANY, 3));
  assert.match(last, /disabled[^>]*>다음 ›/);
  assert.match(V.pagerHtml(SC.page(Array.from({ length: 1000 }, (_, i) => row(i)), 10)), /…/);
});

test('이름·업태·담당 이름은 걸러 넣는다', () => {
  const evil = row(1, { name: '<img src=x>', bizType: '<b>업</b>' });
  const h = V.popHtml(st({ pop: 'biz' }), 'biz', [evil]) + V.listHtml(st(), [evil], { offset: 0, cols: {}, sort: null, pop: '' });
  assert.doesNotMatch(h, /<img src=x>/); assert.doesNotMatch(h, /<b>업<\/b>/);
  const w = V.popHtml(st({ pop: 'who' }), 'who', [row(2, { mgr: 'P-9' })]);
  assert.doesNotMatch(w, /<script/);
});

test('render — 거르기·순서·쪽을 이어 그린다: 120곳 2쪽은 51번부터 50곳', () => {
  const el = { innerHTML: '', contains: () => true };
  const real = global.PuRulesV2Sites.model;
  global.PuRulesV2Sites.model = () => MANY;
  try {
    V.render(el, st({ page: 2 }), {});
  } finally { global.PuRulesV2Sites.model = real; }
  const nums = [...el.innerHTML.matchAll(/<td class="no"[^>]*>(\d+)<\/td>/g)].map((m) => +m[1]);
  assert.equal(nums.length, 50); assert.equal(nums[0], 51); assert.equal(nums[49], 100);
  assert.match(el.innerHTML, /51–100[^<]*<\/b>[^<]*\/ 120곳/);
});

test('render — 머리줄 조건·순서가 먼저 걸리고 띠의 곳 수는 걸러진 수, 담당 창은 담당 거르기 전 수', () => {
  const rs = [row(1, { bizType: '제조업', size: 30 }), row(2, { bizType: '도소매', size: 5 }), row(3, { bizType: '제조업', size: 12, mgr: 'P-002' })];
  const run = (extra) => {
    const el = { innerHTML: '', contains: () => true };
    const real = global.PuRulesV2Sites.model;
    global.PuRulesV2Sites.model = () => rs;
    try { V.render(el, Object.assign(st(extra), { staff: { 'P-001': '홍길동', 'P-002': '김철수' } }), {}); } finally { global.PuRulesV2Sites.model = real; }
    return el.innerHTML;
  };
  const h = run({ cols: { biz: ['제조업'] }, sort: { key: 'size', dir: 'desc' } });
  assert.match(h, /<b>2곳<\/b>/, '띠의 곳 수는 조건으로 걸러진 수');
  const names = [...h.matchAll(/<tr data-act="siteSel"[^>]*>.*?<b>(회사\d+)<\/b>/g)].map((m) => m[1]);
  assert.deepEqual(names, ['회사1', '회사3'], '제조업 둘, 규모 내림차순');
  const w = run({ pop: 'who', who: 'P-002' });
  assert.match(w, /data-act="colWho" data-v="P-001"/, '담당을 P-002 로 걸어도 창에는 다른 담당도 남는다');
});

/* ── 손잡이 이음 — 가짜 이벤트로 el.onclick/onchange/oninput 을 부른다 ── */
function fakeTarget(o) {
  o = o || {};
  const t = { tagName: o.tag || 'BUTTON', dataset: o.dataset || {}, checked: !!o.checked, value: o.value || '',
    closest(sel) {
      if (sel === '[data-act]' && o.dataset && o.dataset.act && !o.noAct) return t;
      const hit = (o.closest || {})[sel];
      return hit === undefined ? null : hit;
    } };
  return t;
}
function wire(sites, handlers) {
  // 진짜 colClose 는 다시 그려서 눌린 단추를 DOM 에서 떼어 낸다 — 그 뒤 el.contains 는 거짓이 된다
  let redrawn = false;
  const popup = { removed: false, remove() { popup.removed = true; } };
  const el = { innerHTML: '', contains: () => !redrawn, querySelector: (q) => (q === '.cpop' ? popup : null), popup };
  const state = st(sites);
  const calls = [];
  const H = {};
  ['colClose', 'siteSel', 'colToggle', 'colq', 'reload'].forEach((n) => {
    H[n] = (...a) => { calls.push([n].concat(a)); if (n === 'colClose') redrawn = true; };
  });
  Object.assign(H, handlers || {});
  const real = global.PuRulesV2Sites.model;
  global.PuRulesV2Sites.model = () => MANY.slice(0, 3);
  try { V.render(el, state, H); } finally { global.PuRulesV2Sites.model = real; }
  return { el, state, calls, count: (n) => calls.filter((c) => c[0] === n).length };
}
const ev = (t) => ({ target: t, preventDefault() {} });

test('손잡이 이음 — 창 안을 누르면 닫지 않는다, 머리 단추도 여기서 닫지 않는다', () => {
  const w = wire({ pop: 'biz', popq: '제' });
  w.el.onclick(ev(fakeTarget({ closest: { '.cpop': {} } })));
  assert.equal(w.count('colClose'), 0); assert.equal(w.state.sites.pop, 'biz'); assert.equal(w.state.sites.popq, '제');
  w.el.onclick(ev(fakeTarget({ dataset: { act: 'colOpen', key: 'biz' }, closest: { '[data-act="colOpen"]': {} } })));
  assert.equal(w.count('colClose'), 0); assert.equal(w.state.sites.pop, 'biz');
});

test('손잡이 이음 — 창 밖의 누름은 삼켜지지 않는다: 손잡이가 불리고 창 상태는 비워진다', () => {
  const w = wire({ pop: 'biz', popq: '제' });
  w.el.onclick(ev(fakeTarget({ dataset: { act: 'siteSel', co: 'c1' } })));
  assert.equal(w.count('siteSel'), 1, '밖의 행을 눌러도 그 누름이 일을 한다');
  assert.equal(w.state.sites.pop, ''); assert.equal(w.state.sites.popq, '');
  assert.equal(w.count('colClose'), 0, '손잡이가 있으면 colClose 는 따로 부르지 않는다');
});

test('손잡이 이음 — 손잡이가 불릴 때 창 상태는 이미 비어 있다(그림이 닫힌 창으로 그려진다)', () => {
  let seen = null; let state = null;
  const w = wire({ pop: 'biz' }, { siteSel() { seen = w.state.sites.pop; } });
  state = w.state;
  w.el.onclick(ev(fakeTarget({ dataset: { act: 'siteSel' } })));
  assert.equal(seen, ''); assert.equal(state.sites.pop, '');
});

test('손잡이 이음 — 창 밖, 손잡이 없는 곳을 누르면 colClose 한 번, 창이 닫혀 있으면 아무 일도 없다', () => {
  const w = wire({ pop: 'biz' });
  w.el.onclick(ev(fakeTarget()));
  assert.equal(w.count('colClose'), 1); assert.equal(w.state.sites.pop, '');
  const w2 = wire({ pop: '' });
  w2.el.onclick(ev(fakeTarget()));
  w2.el.onclick(ev(fakeTarget({ dataset: { act: 'siteSel' } })));
  assert.equal(w2.count('colClose'), 0); assert.equal(w2.count('siteSel'), 1);
});

test('손잡이 이음 — 창 밖의 입력칸·선택칸을 누르면 그 칸을 다시 그리지 않는다: 상태만 비우고 창 DOM 만 뗀다', () => {
  [{ tag: 'INPUT' }, { tag: 'SELECT' }, { closest: { 'input,select,textarea': {} } }].forEach((o) => {
    const w = wire({ pop: 'biz', popq: '제' });
    w.el.onclick(ev(fakeTarget(o)));
    assert.equal(w.count('colClose'), 0, 'colClose 를 부르면 눌린 칸이 떨어져 나간다');
    assert.equal(w.state.sites.pop, ''); assert.equal(w.state.sites.popq, '');
    assert.equal(w.el.popup.removed, true, '창 DOM 은 뗀다');
  });
  const w2 = wire({ pop: 'biz' });
  w2.el.onclick(ev(fakeTarget()));
  assert.equal(w2.count('colClose'), 1, '버튼 따위를 눌렀을 때는 지금처럼 colClose');
  assert.equal(w2.el.popup.removed, false);
});

test('손잡이 이음 — 체크 바뀜은 colToggle(칸, 값, 체크), 업태 찾기 글은 colq(글)', () => {
  const w = wire({ pop: 'biz' });
  w.el.onchange({ target: fakeTarget({ tag: 'INPUT', dataset: { role: 'colchk', key: 'biz', v: '제조업' }, checked: true }) });
  assert.deepEqual(w.calls.filter((c) => c[0] === 'colToggle')[0], ['colToggle', 'biz', '제조업', true]);
  w.el.oninput({ target: fakeTarget({ tag: 'INPUT', dataset: { role: 'colq' }, value: '도소' }) });
  assert.deepEqual(w.calls.filter((c) => c[0] === 'colq')[0], ['colq', '도소']);
});

test('창 — 담당 창은 지금 고른 담당을 0곳이어도 보여 준다 · 키는 걸러 넣는다', () => {
  const h = V.popHtml(st({ pop: 'who', who: 'P-777' }), 'who', [row(1)]);
  assert.match(h, /data-act="colWho" data-v="P-777"/);
  const none = V.popHtml(st({ pop: 'who', who: '-' }), 'who', [row(1)]);
  assert.match(none, /data-v="-"/);
  const k = V.popHtml(st({ pop: 'biz' }), 'x"><i', [row(1)]);
  assert.doesNotMatch(k, /data-key="x"><i/);
});

test('빈 표 — 머리줄 조건 때문이면 «조건을 풀어 보세요», 아니면 옛 안내', () => {
  const on = V.listHtml(st(), [], { offset: 0, cols: { biz: ['제조업'] }, sort: null, pop: '' });
  assert.match(on, /거른 조건에 맞는 사업장이 없습니다/);
  const off = V.listHtml(st(), [], { offset: 0, cols: {}, sort: null, pop: '' });
  assert.match(off, /모든 거래처/); assert.doesNotMatch(off, /거른 조건에 맞는/);
  assert.match(V.listHtml(st(), []), /모든 거래처/);
});
