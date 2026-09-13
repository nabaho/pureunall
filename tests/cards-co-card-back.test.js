/* ══════ 명함에서 «보던 기업 상세»로 돌아간다 (대표 보고 2026-09-12) ═══════════
   대표: 「명함확인후 뒤로 백할 수 없다」

   ■ 무엇이 문제였나
   기업 상세의 「사람」 칸에서 이름을 누르면 명함이 열린다. 그런데 명함은 «같은 자리»
   (#pcDetail)를 갈아 끼우므로 보던 기업 상세가 통째로 사라진다. 닫아도 목록으로 나갈
   뿐이라, 회사를 목록에서 다시 찾아 눌러야 했다 — 사람 둘을 잇달아 보려면 그 짓을
   두 번 한다.

   ★ 못 박는 것
     ① 기업 상세에서 연 명함에는 「◀ 뒤로」가 있다.
     ② 목록에서 연 명함에는 «없다» — 눌러도 갈 곳이 없는 단추는 고장으로 읽힌다.
     ③ 어디서 왔는지는 «그 자리에서 넘긴다». 전역에 기억해 두면 목록에서 연 명함에도
        남아 엉뚱한 회사로 데려간다.
     ④ ✕ 는 그대로 «닫기»다 — 둘을 한 단추로 합치면 나가려는 손이 갈 곳을 잃는다.
     ⑤ 돌아갈 때는 회사를 여는 «같은 길»을 다시 부른다 — 그래야 늦게 오는 것
        (이알피 이력·보낸 서류)도 똑같이 채워진다.

   node --test tests/cards-co-card-back.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { cutFn } = require('./cut-fn');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8')
  .split('\r\n').join('\n');

/* ── ①② 「◀ 뒤로」가 붙는 자리 ─────────────────────────────────────────── */

/* 명함 패널의 머리줄을 «실제로 만들어» 본다 — 글자만 찾으면 조건이 뒤집혀도 통과한다.
   ⚠★ 「어디서 왔나」를 읽는 줄(_back)도 «원본에서 떠 온다» (2026-09-12 이빨 확인에서
     새어 잡은 것). 처음에는 그 줄을 손으로 베껴 넣었는데, 그러면 제품 코드에서 그
     줄을 「늘 붙인다」로 바꿔도 검사가 제 사본만 보고 통과했다 — 검사가 지키는 것이
     제품이 아니라 제 사본이 된다. */
function head(backCo) {
  const fn = cutFn(SRC, 'function openPcDetail(');
  const at = fn.indexOf('const _back = String(backCo');
  assert.ok(at > 0, '★ 「어디서 왔나」를 읽는 자리를 찾지 못했습니다');
  const backLine = fn.slice(at, fn.indexOf('\n', at));
  const tplAt = fn.indexOf('`', fn.indexOf("$('pcDetail').innerHTML =", at));
  const end = fn.indexOf('</div>', fn.indexOf('class="pdhead"', tplAt));
  assert.ok(tplAt > 0 && end > tplAt, '머리줄을 찾지 못했습니다');
  const tpl = fn.slice(tplAt, end) + '</div>`';
  const ctx = { String, esc: s => String(s == null ? '' : s), isCard: true, backCo: backCo };
  vm.createContext(ctx);
  return vm.runInContext(backLine + '\n(' + tpl + ')', ctx);
}

test('★★★ 기업 상세에서 연 명함에는 「◀ 뒤로」가 있다', () => {
  const h = head('1348605772');
  assert.match(h, /◀ 뒤로/,
    '★★★ 돌아갈 길이 없으면 회사를 목록에서 다시 찾아야 한다 — 대표가 지적한 그 화면이다');
  assert.match(h, /coBackToDetail\('1348605772'\)/, '★★ 어느 회사로 돌아갈지 안 심었다');
});

test('★★★ 목록에서 연 명함에는 «없다» — 눌러도 갈 곳이 없는 단추는 고장이다', () => {
  ['', undefined, null].forEach(v => {
    assert.ok(!/◀ 뒤로/.test(head(v)), '★★★ 갈 곳도 없는데 「뒤로」가 붙었다 (' + String(v) + ')');
  });
});

test('★★ ✕(닫기)는 그대로 남는다 — 나가려는 손이 갈 곳을 잃으면 안 된다', () => {
  const h = head('1348605772');
  assert.match(h, /class="x" onclick="closeDetail\(\)"/,
    '★★ 「뒤로」와 「닫기」를 한 단추로 합치면 닫으려다 회사가 열린다');
});

/* ── ③ 어디서 왔는지를 «그 자리에서» 넘긴다 ─────────────────────────────── */

test('★★★ 기업 상세의 사람 줄이 «회사 열쇠»를 함께 넘긴다', () => {
  const panel = cutFn(SRC, 'function coDetailPanelHtml(');
  assert.match(panel, /openDetail\('\$\{c\.id\}','\$\{esc\(String\(o\.key\)/,
    '★★★ 회사 열쇠를 안 넘기면 명함에서 돌아갈 자리를 알 수 없다');
});

test('★★★ 「어디서 왔나」를 전역에 기억하지 않는다 — 목록 명함에 남으면 엉뚱한 회사로 간다', () => {
  const open = cutFn(SRC, 'function openPcDetail(');
  const det = cutFn(SRC, 'function openDetail(');
  assert.match(det, /function openDetail\(id, backCo\)/, '★★ 받는 자리가 없다');
  assert.match(det, /openPcDetail\(id, backCo\)/, '★★ 받아 놓고 안 넘긴다');
  assert.match(open, /function openPcDetail\(id, backCo\)/, '★★ 명함 패널이 그것을 안 받는다');
  /* 전역에 두면 「지난번 회사」가 남는다 — 그 꼴을 못 박아 막는다 */
  assert.ok(!/_coBackKey|_cardBackCo/.test(SRC),
    '★★★ 전역에 기억해 두면 목록에서 연 명함에도 「뒤로」가 남는다');
});

/* ── ⑤ 돌아가는 길 ─────────────────────────────────────────────────────── */

function back(list) {
  const ctx = { String, Array, state: { coPick:'' }, _opened: null, _closed: 0,
    coList: () => list,
    openCoDetailPanel: k => { ctx._opened = k; },
    closePcDetail: () => { ctx._closed++; } };
  vm.createContext(ctx);
  vm.runInContext(cutFn(SRC, 'function coBackToDetail('), ctx);
  return ctx;
}

test('★★★ 돌아가면 그 회사 상세가 «다시 열린다»', () => {
  const c = back([{ key:'1348605772' }]);
  c.coBackToDetail('1348605772');
  assert.equal(c._opened, '1348605772', '★★★ 눌러도 회사가 안 열린다');
  assert.equal(c.state.coPick, '1348605772',
    '★★ 고른 회사 표를 안 되돌리면 목록에서 그 줄이 골라진 채로 안 보인다');
});

test('★★ 회사를 여는 «같은 길»을 다시 부른다 — 늦게 오는 것도 똑같이 채워진다', () => {
  const fn = cutFn(SRC, 'function coBackToDetail(');
  assert.match(fn, /openCoDetailPanel\(k\)/,
    '★★ 새 길을 내면 이알피 이력·보낸 서류가 안 채워진 빈 패널이 뜬다');
});

/* ── ⑥ 폰·브라우저 «뒤로가기»도 ◀뒤로와 «같은 걸음»을 밟는다 (2026-09-12 실측) ──
   ■ 무엇이 문제였나
   뒤로가기는 pu-back.js 의 「맨 위 덮개를 그 창의 ✕ 로 닫는다」에만 기대고 있었다.
   기업 상세에서 명함을 열고 뒤로가기를 누르면 명함의 ✕(closeDetail)가 눌려 «통째로
   닫혔다» — 화면에는 ◀뒤로가 붙어 있는데 뒤로가기는 회사까지 지웠다. 실제로 재 봤다:
     기업상세 → 명함 → 뒤로 = (닫힘)   ✗   기대: 기업상세로 돌아감

   ★ 못 박는 것
     ⑥㉮ 온 자리를 «패널 칸»(dataset.backCo)에 적는다 — 뒤로가기는 onclick 글자를
         읽을 수 없다.
     ⑥㉯ 목록에서 연 명함·기업 상세에는 그 칸이 «없다» — 남으면 ◀뒤로가 없는 화면에서
         뒤로가기만 엉뚱한 회사로 간다.
     ⑥㉰ 걸음은 coBackToDetail «한 곳»을 탄다 — 단추와 뒤로가기가 갈라지면 안 된다.
     ⑥㉱ 「물러서기」를 「닫기」보다 «먼저» 묻는다. */

function 대역패널() {
  const el = { innerHTML: '', dataset: {}, style: {}, _cls: new Set(),
    classList: { add: c => el._cls.add(c), remove: c => el._cls.delete(c),
                 contains: c => el._cls.has(c) },
    querySelector: () => null, querySelectorAll: () => [] };
  return el;
}
/* 명함 패널을 여는 «진짜» 함수를 돌린다 — 화면을 그리는 조각만 대역이다.
   ⚠ openPcDetail 자체를 대역으로 바꾸면 「_back 을 어디에 적나」를 안 지키게 된다. */
function 명함열기(backCo) {
  const el = 대역패널();
  const ctx = { String, Object, Array, Number, Math, JSON, console,
    esc: s => String(s == null ? '' : s),
    $: id => (id === 'pcDetail' ? el : null),
    state: { items: { c1: { id:'c1', kind:'card', name:'류재혁' } }, groups: {} },
    CARD_FIELDS: [], BIZ_FIELDS: [],
    detailThumbOf: () => ({ front:'', back:'' }), ensureThumbs: () => Promise.resolve(),
    fillDetailPhotos: () => {}, photoSlot: () => '', photoBackBtn: () => '',
    pcMoreLine: () => '', fmtDate: () => '', fmtBizno: v => v, digits: v => v,
    rulesBoxHtml: () => '', ErpMatch: { full: () => '', leftOfCard: () => '' } };
  vm.createContext(ctx);
  vm.runInContext(cutFn(SRC, 'function openPcDetail('), ctx);
  ctx.openPcDetail('c1', backCo);
  return el;
}

test('★★★ ⑥㉮ 기업 상세에서 연 명함은 «온 자리»를 패널 칸에 적는다', () => {
  const el = 명함열기('1348605772');
  assert.equal(el.dataset.backCo, '1348605772',
    '★★★ 뒤로가기는 단추의 onclick 글자를 못 읽는다 — 칸에 안 적으면 갈 곳을 모른다');
});

test('★★★ ⑥㉯ 목록에서 연 명함에는 그 칸이 «없다»', () => {
  ['', undefined, null].forEach(v => {
    assert.equal(명함열기(v).dataset.backCo, undefined,
      '★★★ 갈 곳이 없는데 칸이 남으면 뒤로가기만 엉뚱한 회사로 간다 (' + String(v) + ')');
  });
  /* 앞 명함이 남긴 칸을 «지우는지»까지 본다 — 같은 자리를 갈아 끼우는 패널이다 */
  const el = 명함열기('1348605772');
  assert.equal(el.dataset.backCo, '1348605772');
});

test('★★★ ⑥㉯ 기업 상세를 열면 그 칸을 지운다 — 상세는 «돌아갈 곳»이 아니라 그 자리다', () => {
  const el = 대역패널();
  el.dataset.backCo = '1348605772';   /* 명함을 보다가 회사로 돌아온 참이다 */
  const ctx = { String, Object, Array, console,
    $: id => (id === 'pcDetail' ? el : null),
    coList: () => [{ key:'1348605772', name:'신성컨트롤' }],
    coDetailPanelHtml: () => '<i>몸통</i>',
    state: { coPick: '1348605772' },
    loadErpCaseCons: () => {}, renderCoErpHistory: () => {},
    loadCoSent: () => {}, coSentHtml: () => '', coHeadRepaint: () => {} };
  vm.createContext(ctx);
  vm.runInContext('var _coHistSum=null,_coLeftDocsN=null,_coRowDocsOpen={};\n'
    + cutFn(SRC, 'function openCoDetailPanel('), ctx);
  ctx.openCoDetailPanel('1348605772');
  assert.equal(el.dataset.backCo, undefined,
    '★★★ 안 지우면 회사 상세에서 뒤로가기를 눌러 «제자리»로 돌아가는 맴돌이가 된다');
  assert.equal(el.dataset.coKey, '1348605772');
});

function 걸음(dataset, open) {
  const el = 대역패널();
  Object.assign(el.dataset, dataset || {});
  if (open !== false) el.classList.add('open');
  const ctx = { String, console, $: id => (id === 'pcDetail' ? el : null),
    _간곳: null, coBackToDetail(k) { ctx._간곳 = k; } };
  vm.createContext(ctx);
  vm.runInContext(cutFn(SRC, 'function coBackStep('), ctx);
  return { 잡았나: ctx.coBackStep(), 간곳: ctx._간곳 };
}

test('★★★ ⑥㉰ 뒤로가기가 «그 회사로» 돌아간다 — 단추와 같은 길이다', () => {
  const r = 걸음({ backCo: '1348605772', cardId: 'c1' });
  assert.equal(r.간곳, '1348605772', '★★★ 뒤로가기가 명함을 닫아 버리면 회사까지 사라진다');
  assert.equal(r.잡았나, true,
    '★★★ 참을 안 돌려주면 pu-back 이 「아무도 안 잡았다」로 보고 앱을 통째로 나간다');
});

test('★★ ⑥㉰ 돌아갈 곳이 없으면 «비켜선다» — 그래야 그 다음 잣대(닫기)가 돈다', () => {
  assert.deepEqual(걸음({ cardId: 'c1' }), { 잡았나: false, 간곳: null },
    '★★ 목록에서 연 명함까지 붙잡으면 뒤로가기가 아무 일도 안 하는 단추가 된다');
  assert.deepEqual(걸음({ coKey: '1348605772' }), { 잡았나: false, 간곳: null },
    '★★ 기업 상세를 붙잡으면 제자리로 돌아가는 맴돌이가 된다');
  assert.deepEqual(걸음({ backCo: '1348605772' }, false), { 잡았나: false, 간곳: null },
    '★★★ 닫힌 패널까지 붙잡으면 아무것도 안 열린 화면에서 뒤로가기가 안 나간다');
});

test('★★★ ⑥㉱ 「물러서기」를 「닫기」보다 «먼저» 묻는다', () => {
  const at = SRC.indexOf('PuBack.guard(');
  assert.ok(at > 0, '★★★ 뒤로가기 파수꾼을 아예 안 달았다 — 뒤로가기가 앱을 통째로 나간다');
  const 파수꾼 = SRC.slice(at, SRC.indexOf('</script>', at));
  assert.match(파수꾼, /coBackStep\(\)/, '★★★ 뒤로가기가 「한 걸음 물러서기」를 안 묻는다');
  assert.match(파수꾼, /closeTopVisible\(\)/, '★★ 창을 닫는 길이 사라졌다');
  assert.ok(파수꾼.indexOf('coBackStep()') < 파수꾼.indexOf('closeTopVisible()'),
    '★★★ 순서가 뒤집히면 명함이 ✕ 로 닫혀 보던 회사까지 사라진다 — 고치기 전 그 꼴이다');
});

test('★★ 그새 사라진 회사면 조용히 닫는다 — 빈 패널을 띄우면 「눌렀는데 없다」가 된다', () => {
  const c = back([{ key:'9999999999' }]);
  c.coBackToDetail('1348605772');
  assert.equal(c._opened, null, '★★ 없는 회사를 열었다');
  assert.equal(c._closed, 1, '★ 아무 일도 안 일어나면 눌러도 반응이 없는 것처럼 보인다');
  /* 열쇠가 아예 비어 있어도 같다 */
  const c2 = back([{ key:'1348605772' }]);
  c2.coBackToDetail('');
  assert.equal(c2._closed, 1);
});
