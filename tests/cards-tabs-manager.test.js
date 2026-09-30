/* 🔖 내 탭 관리 — 한눈에 (대표 지시 2026-09-30 「너무 정리가 안되어 있다 … 탭관련 한눈에 보기 쉽게」 → 목업 → 「진행」)
   ★ 못 박는 것
     ① 탭 이름이 «보인다» · 한 탭 = 한 줄(이름 · 대상 · 조건 · 명함 수 · ↑↓ 이름 삭제)
     ② «무엇으로 거르나»로 묶는다 — 이알피 갈래 · 회사·이름으로 · 직접 담는 탭 · 그 밖
     ③ 조건이 같은 탭을 알린다(담는 탭은 저마다 다른 칸이라 뺀다) · 0장인 탭을 주황으로
     ④ 명함 수는 «나중에 하나씩» 센다 — 여는 순간 28개를 한꺼번에 세지 않는다 · 목록과 같은 잣대(countMatching)
     ⑤ ↑↓ 는 같은 갈래(명함·사업자) 안에서 이웃과 차례를 맞바꾼다
   node --test tests/cards-tabs-manager.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8').split('\r\n').join('\n');
const V = (id, name, f, o) => Object.assign({ id, name, kind: 'card', scope: 'all', order: 0, f: f || {} }, o || {});

function load(views, counts) {
  const shown = [], put = [], timers = [];
  const ctx = { console, Object, Array, String, Number, JSON, Date,
    esc: s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    state: { views, groups: { g1: { name: '기관·공공' } }, tab: 'card', view: 'settings', setSub: 'views' },
    ERP_FILTER_LABEL: { 자문: '자문' }, _panelTarget: 'inline', _closeBtn: () => '',
    showPanel: h => shown.push(h), toast() {}, renderSettingsPage: () => ctx.openViewManager(),
    $: () => ({ classList: { contains: () => false, remove() {} } }),
    countMatching: f => { ctx._counted = (ctx._counted || 0) + 1; return (counts || {})[JSON.stringify(f)] ?? 5; },
    viewSig: f => JSON.stringify([f.q || '', f.erpFilter || '', (f.colFilter || {}).company || '', f.vtab || '']),
    Store: { putView: v => put.push(v) },
    setTimeout: (fn) => { timers.push(fn); return 1; },
    renameView() {}, deleteView() {} };
  vm.createContext(ctx);
  vm.runInContext(['var _vmCounts = {}, _vmCounting = false, _vmCountedAt = 0, _vmSeg = "all";',
    SRC.match(/^const VM_GROUPS = [^\n]*$/m)[0].replace('const ', 'var '),
    ...['function vmGroupOf(', 'function vmDesc(', 'function vmTwins(', 'function vmSorted(', 'function vmScopeName(',
      'function vmCountOne(', 'function vmCountRun(', 'function vmRepaint(', 'function vmSegSet(', 'function vmMove(',
      'function openViewManager('].map(f => cutFn(SRC, f))].join('\n'), ctx);
  ctx._shown = shown; ctx._put = put;
  ctx._flush = () => { let n = 0; while (timers.length && n++ < 500) timers.shift()(); };
  return ctx;
}
const VIEWS = () => ({
  a: V('a', '자문', { erpFilter: '자문' }, { order: 1 }),
  b: V('b', '공단', { colFilter: { company: '공단' } }, { scope: 'g1', order: 2 }),
  c: V('c', '공단2', { colFilter: { company: '공단' } }, { scope: 'g1', order: 3 }),
  d: V('d', '담는칸', { vtab: 'd' }, { manual: true, order: 4 }),
  e: V('e', '등록증', {}, { kind: 'biz', order: 5 })
});

test('★★★ ① 탭 이름이 보이고 한 탭이 한 줄 — 옛 두 줄 모양이 없다', () => {
  const c = load(VIEWS());
  c.openViewManager(); c._flush();
  const h = c._shown[c._shown.length - 1];
  assert.match(h, /<td class="nm" title="자문">자문<\/td>/, '★★★ 탭 이름이 표에 없다');
  assert.ok(!/class="ditem"/.test(h) && !/<br>/.test(h), '★ 옛 두 줄 모양이 남았다');
  assert.match(h, /📁 기관·공공/); assert.match(h, /이알피 자문/);
});

test('★★★ ② «무엇으로 거르나»로 묶는다', () => {
  const c = load(VIEWS());
  const g = id => c.vmGroupOf(c.state.views[id]);
  assert.deepEqual(['a', 'b', 'd', 'e'].map(g), ['erp', 'match', 'manual', 'etc']);
  c.openViewManager(); c._flush();
  const h = c._shown[c._shown.length - 1];
  ['이알피 갈래 · 1', '회사·이름으로 거르기 · 2', '직접 담는 탭 · 1', '그 밖 · 1'].forEach(t => assert.ok(h.indexOf(t) > 0, '★ 묶음 「' + t + '」 이 없다'));
});

test('★★★ ③ 조건이 같은 탭을 알리고 · 0장인 탭은 주황', () => {
  const counts = { [JSON.stringify({ erpFilter: '자문' })]: 0 };
  const c = load(VIEWS(), counts);
  const tw = c.vmTwins(Object.values(c.state.views));
  assert.deepEqual(Object.keys(tw).sort(), ['b', 'c'], '★ 같은 대상·조건의 탭을 못 찾았다');
  c.openViewManager(); c._flush();
  const h = c._shown[c._shown.length - 1];
  assert.match(h, /조건 같음: 공단2/);
  assert.match(h, /class="vmn zero">0</, '★ 0장인 탭이 주황이 아니다');
  assert.match(h, /0장인 탭<b>1<\/b>/); assert.match(h, /조건이 같은 탭<b>2<\/b>/);
});

test('★★★ ④ 명함 수는 여는 순간 한꺼번에 세지 «않는다» — 먼저 보여 주고 하나씩', () => {
  const c = load(VIEWS());
  c.openViewManager();
  assert.equal(c._counted || 0, 0, '★★★ 여는 순간 탭을 다 셌다 — 28개면 화면이 멈춘다');
  assert.match(c._shown[0], /…/, '★ 세기 전에는 «…»로 둔다');
  c._flush();
  assert.equal(c._counted, 5, '★ 다 세지 않았다');
  assert.match(cutFn(SRC, 'function vmCountOne('), /countMatching\(v\.f\)/, '★ 목록과 다른 잣대로 센다');
  assert.match(cutFn(SRC, 'function vmCountRun('), /setTimeout\(step, 0\)/);
});

test('★★ ⑤ ↑↓ 는 같은 갈래 안에서 이웃과 차례를 맞바꾼다', () => {
  const c = load(VIEWS());
  c.vmMove('b', -1);
  const o = Object.fromEntries(c._put.map(v => [v.id, v.order]));
  assert.deepEqual(o, { a: 2, b: 1 });
  c._put.length = 0;
  c.vmMove('e', -1);
  assert.equal(c._put.length, 0, '★ 사업자 탭이 명함 탭과 자리를 바꿨다');
});
