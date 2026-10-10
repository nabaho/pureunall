/* ◀ 메일 «뒤로가기 한 걸음» (대표 지시 2026-10-10)
   「받은메일함 자료를 보다가 백 버튼을 누르면 받은메일로 가야 하는데 계속 전체메일로 간다.
     이 부분 반드시 고쳐라」

   ★ 메일 화면은 칸을 옮기거나 메일을 열어도 브라우저 기록에 아무것도 안 남겼다. 뒤로가기는
     앱을 통째로 나갔고, 메일을 다시 열면 첫 화면이 늘 「전체메일」이었다.
   이 검사는 «실제로 돌린다» — 칸을 옮기고, 메일을 열고, 뒤로가기를 눌러 어디로 가는지 본다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { sliceFn } = require('./fnslice');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8');
const fn = (name) => sliceFn(HTML, 'function ' + name + '(');

function make() {
  const calls = { opened: [], back: 0 };
  const box = {
    state: { view: 'mail', mailSent: 'box', mbBox: '', mbOpen: null },
    mbNow: () => box.state.mbBox || '*all',
    mbBack: () => { calls.back++; box.state.mbOpen = null; },
    console,
  };
  /* openMailBox 는 «진짜 첫 줄»(기록 남기기)만 떠 와서 쓴다 — 나머지는 화면 일이라 가짜 */
  const real = fn('openMailBox');
  const head = real.slice(0, real.indexOf('\n') + 1);
  const noteLine = real.split('\n').find((l) => /mbNavNote\(id\)/.test(l));
  assert.ok(noteLine, 'openMailBox 가 칸을 옮길 때 기록을 안 남긴다');
  box.openMailBox = null;
  vm.createContext(box);
  vm.runInContext(
    'let _mbNav = [], _mbNavQuiet = false;\n' + fn('mbNavNote') + '\n' + fn('mbBackStep') + '\n' +
    head + noteLine + '\n  state.view="mail"; state.mailSent="box"; state.mbBox=id; state.mbOpen=null; globalThis.__opened.push(id);\n}\n' +
    ';this.openMailBox = openMailBox; this.mbBackStep = mbBackStep; this.mbNavNote = mbNavNote; this.__nav = () => JSON.stringify(_mbNav);',
    Object.assign(box, { __opened: calls.opened }));
  box.__calls = calls;
  return box;
}

test('★★ 받은메일함 → 메일 읽기 → 뒤로가기 = «받은메일함 목록» (전체메일로 안 간다)', () => {
  const b = make();
  b.openMailBox('*all');                    // 처음 문 — 기록을 안 쌓는다
  b.openMailBox('INBOX');
  b.state.mbOpen = { slug: 'INBOX', uid: '5' };
  assert.equal(b.mbBackStep(), true, '읽는 중 뒤로가기가 처리되지 않아 앱을 나간다');
  assert.equal(b.__calls.back, 1, '메일 목록으로 안 돌아간다');
  assert.equal(b.state.mbBox, 'INBOX', '칸이 바뀌었다 — 받은메일함이어야 한다');
  assert.equal(b.state.mbOpen, null);
});

test('★★ 칸을 옮기며 봤으면 «바로 전에 보던 칸»으로 한 걸음씩 돌아간다', () => {
  const b = make();
  b.openMailBox('*all');
  b.openMailBox('INBOX');
  b.openMailBox('업무A');
  b.openMailBox('*old');
  assert.equal(b.mbBackStep(), true); assert.equal(b.state.mbBox, '업무A');
  assert.equal(b.mbBackStep(), true); assert.equal(b.state.mbBox, 'INBOX');
  assert.equal(b.mbBackStep(), true); assert.equal(b.state.mbBox, '*all');
  assert.equal(b.mbBackStep(), false, '더 갈 곳이 없는데 «처리했다»고 해서 앱을 영영 못 나간다');
});

test('★ 뒤로가기가 연 칸은 기록에 안 쌓인다 — 안 그러면 제자리를 맴돈다', () => {
  const b = make();
  b.openMailBox('*all'); b.openMailBox('INBOX'); b.openMailBox('업무A');
  b.mbBackStep();
  assert.equal(b.__nav(), JSON.stringify(['*all']), '뒤로가기가 연 칸이 기록에 또 쌓였다');
});

test('★ 같은 칸을 또 눌러도 기록이 늘지 않는다', () => {
  const b = make();
  b.openMailBox('*all'); b.openMailBox('INBOX'); b.openMailBox('INBOX'); b.openMailBox('INBOX');
  assert.equal(b.__nav(), JSON.stringify(['*all']));
});

test('★ 메일 화면이 아니거나 목록 화면이 아니면 건드리지 않는다 — 쓰기·연락처 화면은 제 길이 있다', () => {
  const b = make();
  b.openMailBox('*all'); b.openMailBox('INBOX');
  b.state.mailSent = '';
  assert.equal(b.mbBackStep(), false);
  b.state.mailSent = 'box'; b.state.view = 'list';
  assert.equal(b.mbBackStep(), false);
});

test('★ 기록은 서른 칸까지만 — 끝없이 쌓이지 않는다', () => {
  const b = make();
  b.openMailBox('*all');
  for (let i = 0; i < 80; i++) b.openMailBox('칸' + i);
  assert.ok(JSON.parse(b.__nav()).length <= 30);
});

test('★★ 뒤로가기 파수꾼이 «떠 있는 창 → 메일 한 걸음» 차례로 부른다', () => {
  const i = HTML.indexOf('PuBack.guard(function(){');
  assert.ok(i > 0);
  const g = HTML.slice(i, i + 900).replace(/\/\*[\s\S]*?\*\//g, ' ');
  const a = g.indexOf('closeTopVisible()'), m = g.indexOf('mbBackStep()');
  assert.ok(a > 0 && m > a, '메일 한 걸음이 파수꾼에 없거나, 떠 있는 창 닫기보다 앞이다');
  assert.ok(g.indexOf('coBackStep()') < a, '기업 상세 한 걸음이 밀려났다');
});
