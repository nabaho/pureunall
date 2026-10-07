/* 기업정보함 폰 — 갈래 다섯을 한 줄에서 고른다 (대표 지시 2026-10-07)
   「기업정보함에 화면이 너무 정리가 안되어 있다 명함 사업자등 깔끔하게 한화면에 선택해서
    볼수 있게 해달라 메일함을 보일 필요없다」 → 목업 → ㉮(연락처 정리도 폰 안에서).

   ★ 못 박는 것
     ① 폰 갈래 줄(#tabs)에 명함·사업자·기업·근로자·연락처 다섯이 있다
     ② 켜지는 것은 언제나 «하나»다 — 근로자·연락처 화면에서 명함 칸이 같이 켜지지 않는다
     ③ 근로자·연락처 화면에서 명함·사업자 칸을 누르면 그 화면에서 «나온다»
     ④ 폰의 연락처 정리는 메일 화면으로 넘기지 않고 이 창(#list)에 그린다
   node --test tests/cards-phone-five-tabs.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8').split('\r\n').join('\n');
function fn(name) {
  const at = SRC.indexOf('function ' + name + '(');
  assert.ok(at >= 0, name + ' 를 못 찾았다');
  const end = SRC.indexOf('\n}', at) + 2;
  return SRC.slice(at, end);
}

test('★★ ① 폰 갈래 줄에 다섯 칸이 있고, 칸마다 제 화면을 연다', () => {
  const a = SRC.indexOf('<div id="tabs">');
  const block = SRC.slice(a, SRC.indexOf('</div>', a));
  [['tabCard', "setTab('card')"], ['tabBiz', "setTab('biz')"], ['tabCo', 'openCoMobile()'],
   ['tabWk', 'openWkPage()'], ['tabCnt', 'openCntPage()']].forEach(([id, call]) => {
    assert.match(block, new RegExp('id="' + id + '"[^>]*onclick="' + call.replace(/[()]/g, '\\$&') + '"'),
      '★★ ' + id + ' 칸이 없거나 엉뚱한 곳을 엽니다');
  });
});

function syncCtx(view, tab) {
  const on = {};
  const el = id => ({ classList: { toggle: (c, v) => { on[id] = v; } } });
  const ctx = { state: { view, tab }, $: el };
  vm.createContext(ctx);
  vm.runInContext(fn('syncMobileTabs'), ctx);
  ctx.syncMobileTabs();
  return on;
}

test('★★ ② 켜지는 칸은 언제나 하나다', () => {
  const cases = [['list', 'card', 'tabCard'], ['list', 'biz', 'tabBiz'], ['co', 'card', 'tabCo'],
                 ['wk', 'card', 'tabWk'], ['cnt', 'card', 'tabCnt']];
  cases.forEach(([view, tab, want]) => {
    const on = syncCtx(view, tab);
    const lit = Object.keys(on).filter(k => on[k]);
    assert.deepEqual(lit, [want], '★★ ' + view + '/' + tab + ' 에서 켜진 칸: ' + lit.join(','));
  });
});

test('★★ ③ 근로자·연락처 화면에서 명함 칸을 누르면 그 화면에서 나온다', () => {
  ['wk', 'cnt'].forEach(v => {
    const ctx = { state: { view: v, tab: 'card' }, resetSelOnViewSwitch() {}, syncMobileSearchFor() {}, render() {} };
    vm.createContext(ctx);
    vm.runInContext(fn('setTab'), ctx);
    ctx.setTab('card');
    assert.equal(ctx.state.view, 'list', '★★ ' + v + ' 화면이 그대로 남아 명함이 안 보입니다');
  });
});

test('★★ ④ 폰의 연락처 정리는 메일 화면으로 넘기지 않고 이 창(#list)에 그린다', () => {
  assert.doesNotMatch(fn('openCntPage'), /openMnewPage\(/, '★★ 폰에서 또 메일 화면으로 넘어갑니다');
  const drawn = {};
  const ctx = {
    document: { body: { classList: { contains: () => false } } },
    $: id => (id === 'list' || id === 'pcMail') ? (drawn[id] = { scrollTop: 0, set innerHTML(v) { drawn[id].html = v; } }) : null,
    mbMemoClear() {}, mnewTickStart() {}, cntLoading: () => true, mnewCount() {}, cntHtml: () => '<div class="cn"></div>',
  };
  vm.createContext(ctx);
  vm.runInContext(fn('renderCntPage'), ctx);
  ctx.renderCntPage();
  assert.ok(drawn.list && drawn.list.html, '★★ 폰에서 #list 에 안 그립니다');
  assert.ok(!drawn.pcMail, '★ 폰에서 PC 칸(#pcMail)에 그립니다 — 폰에는 그 칸이 안 보입니다');
  /* 폰 render 가 그 화면으로 보낸다 */
  assert.match(fn('render'), /state\.view==='cnt'\) return renderCntPage\(\)/);
});
