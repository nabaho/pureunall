'use strict';
/* 취업규칙 두 앱 합치기 — Task 5 (대표 승인 목업 2026-10-04 「추천대로」)
   ─────────────────────────────────────────────────────────────────────────
   「취업규칙 관리」(rules.html)와 「취업규칙(새)」(rules-v2.html)는 사람 눈에 «한 앱»이다.
   포털 타일은 「취업규칙」 하나, 앱 머리줄의 «갈래 단추»로 오간다(2026-10-04 🏢 사업장을 더해 넷).
   코드는 두 파일로 남는다(그래야 고치기 쉽다) — 그래서 두 파일이 «같은 단추»를 따로 들고 있다.

   ★ 못 박는 것 — 값이 아니라 규칙
     ① 포털에는 취업규칙 타일이 «하나» — 둘이면 같은 앱 문이 둘이라 사람이 어느 쪽인지 헷갈린다
     ② 즐겨찾기 목록에도 하나 — 포털과 즐겨찾기가 어긋나면 눌러도 못 가는 줄이 생긴다
     ③ rulesv2 는 «등록은 남고» 타일이 없음을 밝힌다(portal:false) — 등록을 지우면 관문이 저장을 거절한다
     ④ 두 화면의 갈래 단추가 «같다» — 한쪽만 고치면 오가다 단추가 바뀌어 다른 앱처럼 보인다
     ⑤ 준비중 문의 이름이 포털 타일 이름과 짝이다
   ⚠ 단추 글자를 «이 값»으로 박지 않는다 — 두 파일이 서로 «같은가»를 본다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripComments } = require('./strip-comments');

const R = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8').replace(/\r\n/g, '\n');
const O = require('../js/pu-ontology.js');

/* 포털 타일 목록 덩어리를 그대로 돌려 본다 — 글자 찾기로는 주석 속 줄과 진짜 줄이 안 갈린다 */
function listOf(src, label) {
  const at = src.indexOf('var APPS = [');
  assert.ok(at > -1, label + ' 의 APPS 를 못 찾았다');
  const end = src.indexOf('\n  ];', at);
  assert.ok(end > at, label + ' 의 APPS 끝을 못 찾았다');
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(src.slice(at, end + 4).replace('var APPS', 'this.APPS'), ctx);
  return ctx.APPS;
}
const 포털 = () => listOf(R('enter.html'), 'enter.html');
const 앱바 = () => listOf(R('js/pu-appbar.js'), 'js/pu-appbar.js');
const 취업규칙줄 = (list) => list.filter((a) => /^rules/.test(a.key) || /^rules(-v2)?\.html/.test(a.url));

test('①★ 포털에 취업규칙 타일은 하나 — 열쇠 rules, 이름은 「취업규칙」, rulesv2 줄은 없다', () => {
  const list = 포털();
  assert.ok(list.length >= 10, '★ 포털 목록이 너무 짧다 — 검사가 헛돈다');
  const 줄 = 취업규칙줄(list);
  assert.equal(줄.length, 1, '★★ 취업규칙 타일이 ' + 줄.length + '개다 — 한 앱의 문이 둘이면 어느 쪽인지 헷갈린다');
  assert.equal(줄[0].key, 'rules');
  // 첫 화면은 🏢 사업장(rules-v2.html) — 타일 주소는 «취업규칙 앱 식구(rules.html·rules-v2.html)» 중 하나여야 한다
  // (프로그램 등록은 rules.html 그대로 — 갈래 단추가 두 화면을 오간다)
  assert.equal(줄[0].url, 'rules-v2.html', '★ 타일은 첫 화면 🏢 사업장(rules-v2.html)으로 들어온다'); // 검사고정-허용 — 대표 결정 2026-10-04 「추천」: 첫 화면 = 사업장
  assert.match(줄[0].url, /^rules(-v2)?\.html(#|\?|$)/, '★ 타일 주소가 취업규칙 앱 식구가 아니다');
  assert.equal(줄[0].name, '취업규칙', '★ 대표 결정 — 포털 타일 이름은 「취업규칙」'); // 검사고정-허용 — 대표 결정 2026-10-04 타일 이름
  assert.ok(!list.some((a) => a.key === 'rulesv2'), '★★ rulesv2 타일이 남았다');
});

test('②★ 즐겨찾기 목록에도 rulesv2 가 없다 — 포털과 짝', () => {
  const list = 앱바();
  assert.ok(list.length >= 10, '★ 즐겨찾기 목록이 너무 짧다 — 검사가 헛돈다');
  assert.ok(!list.some((a) => a.key === 'rulesv2'), '★★ 즐겨찾기에 rulesv2 가 남았다');
  const 줄 = 취업규칙줄(list);
  assert.equal(줄.length, 1);
  assert.equal(줄[0].key, 'rules');
  assert.equal(줄[0].url, 포털().find((a) => a.key === 'rules').url, '★ 포털 타일과 즐겨찾기가 다른 화면으로 간다');
  assert.equal(줄[0].name, 포털().find((a) => a.key === 'rules').name, '★ 포털 타일과 즐겨찾기의 이름이 다르다');
});

test('③★★ rulesv2 는 등록부에 남고, 타일이 없음을 밝힌다', () => {
  const p = O.PROGRAMS.rulesv2;
  assert.ok(p, '★★ 등록을 지웠다 — 쓰는 자리 선언이 사라져 관문이 저장을 거절한다');
  assert.equal(p.file, 'rules-v2.html');
  assert.equal(p.portal, false, '★★ 타일이 없는데 portal:false 로 밝히지 않았다');
  assert.notEqual(O.PROGRAMS.rules.portal, false, '★ 포털 타일인 rules 까지 숨겼다');
});

/* ── 갈래 단추 ── */
function 단추(f) {
  const s = stripComments(R(f));
  const m = s.match(/<nav class="rmode"[^>]*>([\s\S]*?)<\/nav>/);
  assert.ok(m, '★★ ' + f + ' 머리줄에 갈래 단추(nav.rmode)가 없다');
  const links = [...m[1].matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map((x) => ({
    href: (x[1].match(/href="([^"]+)"/) || [])[1],
    on: /class="[^"]*\bon\b/.test(x[1]),
    text: x[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
  }));
  return { raw: m[0], links };
}

test('④★★ 두 화면 머리줄에 갈래 단추가 «같게» 있다 — 주소, 이름, 차례도 같다', () => {
  const a = 단추('rules.html'), b = 단추('rules-v2.html');
  const 주소 = (x) => x.links.map((l) => l.href);
  ['rules-v2.html#sites', 'rules.html', 'rules-v2.html#topics', 'rules-v2.html#lib'].forEach((u) => {
    assert.ok(주소(a).includes(u), '★★ rules.html 단추에 ' + u + ' 가 없다');
    assert.ok(주소(b).includes(u), '★★ rules-v2.html 단추에 ' + u + ' 가 없다');
  });
  assert.deepEqual(a.links.map((l) => [l.href, l.text]), b.links.map((l) => [l.href, l.text]),
    '★★ 두 화면의 단추가 다르다 — 오가다 단추가 바뀌면 다른 앱처럼 보인다');
  a.links.forEach((l) => assert.ok(l.text.length > 1, '★ 이름 없는 단추: ' + l.href));
  // 같은 창으로 간다 — 새 창을 열면 «한 앱 한 창»이 깨진다
  [a, b].forEach((x) => assert.doesNotMatch(x.raw, /target=/, '★★ 갈래 단추가 새 창을 연다'));
});

test('④★ 지금 갈래가 켜져 있다 — 검토·개정 화면에서는 rules.html 단추', () => {
  const a = 단추('rules.html');
  assert.deepEqual(a.links.filter((l) => l.on).map((l) => l.href), ['rules.html']);
});

test('④★★ rules-v2 는 갈래를 «제자리에서» 바꾸고, 켜짐도 주소를 따른다', () => {
  const s = stripComments(R('rules-v2.html'));
  // 옛 탭 자리와 「옛 규정관리」 단추는 걷었다 — 단추가 둘이면 같은 곳으로 가는 길이 둘이다
  assert.doesNotMatch(s, /옛 규정관리/, '★ 「옛 규정관리」 단추가 남았다 — 이제 ✏️ 검토·개정이 그 길이다');
  // 화면 가르기는 단추에 걸려 있다 — 주소 해시만 바꾸고(pushState) 다시 그린다
  const route = s.slice(s.indexOf('function rv2Route'), s.indexOf('rv2Route();', s.indexOf('function rv2Route')));
  assert.match(route, /\.rmode/, '★★ 단추 켜짐을 주소(갈래)에 맞추지 않는다');
  assert.match(route, /pushState/, '★★ 갈래 바꾸기가 기록을 안 남긴다 — 뒤로가기로 못 돌아온다');
});

test('⑤★ 준비중 문 이름이 포털 타일 이름과 짝이다', () => {
  const name = 포털().find((a) => a.key === 'rules').name;
  ['rules.html', 'rules-v2.html'].forEach((f) => {
    const m = stripComments(R(f)).match(/PuGate\.soonUnlessAdmin\('([^']+)'\)/);
    assert.ok(m, '★★ ' + f + ' 에 준비중 문이 없다');
    assert.equal(m[1], name, '★ ' + f + ' 준비중 문 이름이 포털 타일과 다르다');
  });
});

test('⑤★ rules-v2 앱바는 rules 타일을 «지금 앱»으로 켠다', () => {
  const s = stripComments(R('rules-v2.html'));
  const m = s.match(/PuAppBar\.mount\([^)]*current:\s*'([^']+)'/);
  assert.ok(m, '★ rules-v2 가 앱바에 지금 앱을 알려 주지 않는다');
  assert.ok(앱바().some((a) => a.key === m[1]), '★★ 앱바 목록에 없는 열쇠(' + m[1] + ')로 켠다 — 아무 줄도 안 켜진다');
  assert.equal(m[1], 'rules');
});

/* ⑥ 타일 주소가 rules-v2.html 이 되어도, ✏️ 검토·개정(rules.html)에서도 「지금 앱」은 취업규칙이다.
   whoAmI 가 «파일 이름 == 타일 주소» 로만 알아내면 rules.html 쪽이 «어느 앱도 아님» 이 된다. */
function 앱바열기(pathname) {
  const win = {};
  const el = () => ({ style: {}, setAttribute() {}, appendChild() {}, addEventListener() {}, remove() {}, textContent: '' });
  const ctx = {
    window: win,
    document: { createElement: el, querySelector: () => null, readyState: 'loading',
                body: { appendChild() {} }, addEventListener() {} },
    localStorage: { getItem: () => null, setItem() {} },
    setInterval: () => 0, clearInterval() {}, setTimeout: () => 0
  };
  win.location = { pathname: pathname, search: '' };
  ctx.location = win.location;
  vm.createContext(ctx);
  vm.runInContext(R('js/pu-appbar.js'), ctx);
  return win.PuAppBar;
}

test('⑥★ 취업규칙 앱 식구 두 파일 어느 쪽에서든 지금 앱은 rules', () => {
  ['/pureunall/rules.html', '/pureunall/rules-v2.html'].forEach((p) => {
    assert.equal(앱바열기(p).whoAmI(), 'rules', '★★ ' + p + ' 에서 지금 앱을 못 알아낸다 — 보던 화면 기록·켜짐 표시가 빠진다');
  });
});
