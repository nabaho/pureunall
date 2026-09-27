'use strict';
/* 「준비중」 타일 — 보이되 못 누른다 (대표 지시 2026-09-23)
   ─────────────────────────────────────────────────────────────────────────
   「권형하 이외 클릭하면 앱이 안 열리게 해달라. 준비중 이라고 연하게 앱에 보이고
    다른사람은 클릭안되게 했으면좋겠다.
    취업규칙관리 급여관리 문서관리 푸른메일 급여데이터함 이부분이다」

   ■ 이것은 adminOnly 와 «다른» 것이다
     adminOnly 는 타일을 아예 안 그린다(2026-08-17 「흐리게도 보이지 않게」).
     이것은 반대다 — **보이되 못 누른다.** 짓는 중인 것이 있다는 사실은 알리되
     열어서 반쪽짜리를 보지는 않게 한다. 둘을 헷갈리면 한쪽 지시가 지워진다.

   ★ 못 박는 것 — 값이 아니라 규칙
     ① 다섯 앱에 표가 붙어 있다 (이름은 늘 수 있으니 «다섯 개»로 세지 않는다)
     ② 대표가 아니면 «흐리고·준비중이라 적히고·못 눌린다»
     ③ 대표에게는 그대로다 — 잠근 김에 대표까지 잠그면 일을 못 하신다
     ④ 눌렀을 때 «까닭을 말한다» — 아무 일도 안 나면 고장인 줄 안다
     ⑤ 「로그인 후 바로가기」로도 못 샌다 — 타일만 잠그면 그쪽으로 그냥 열린다
     ⑥ 잣대를 사번으로 박지 않는다 — 사번이 바뀌면 대표님 화면이 통째로 잠긴다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripJs } = require('./strip-comments');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'enter.html'), 'utf8').replace(/\r\n/g, '\n');

/* 타일을 그리는 대목을 «중괄호를 세어» 뜬다 — 글자로 끝을 찾으면 같은 글자에서 잘린다 */
function 타일그리기() {
  const a = SRC.indexOf('APPS.forEach(function(app){');
  assert.ok(a > -1, '★★ 타일 그리는 대목을 못 찾았다');
  assert.equal(SRC.indexOf('APPS.forEach(function(app){', a + 1), -1,
    '★★ 같은 대목이 둘이다 — 어느 쪽을 본 것인지 알 수 없다');
  let i = SRC.indexOf('{', a), d = 0, j = i;
  do { if (SRC[j] === '{') d++; else if (SRC[j] === '}') d--; j++; } while (j < SRC.length && d > 0);
  return SRC.slice(a, SRC.indexOf(')', j) + 1) + ';';
}

/* 진짜 코드를 돌려 «그려 본다» — 이 저장소 교훈: 글자만 보면 안 잡힌다 */
function 그려보기(role) {
  const 그린것 = [], 외침 = [];
  const el = () => {
    const o = { dataset: {}, style: {}, _attrs: {}, _clicks: [],
      className: '', href: '', title: '', innerHTML: '', target: undefined,
      setAttribute(k, v) { o._attrs[k] = v; },
      removeAttribute(k) { if (k === 'target') o.target = undefined; delete o._attrs[k]; },
      addEventListener(k, fn) { if (k === 'click') o._clicks.push(fn); },
      appendChild() {} };
    return o;
  };
  const ctx = {
    console, Object, Array, String, JSON,
    document: { createElement: el },
    alert: (m) => 외침.push(m),
    role,
    sgIsAdmin: () => role === 'admin',
    isMobile: () => false,
    appRowOf: (a) => a.row,
    portalAppWindowName: (k) => 'pu_' + k,
    tileCont: () => ({ appendChild: (a) => 그린것.push(a) })
  };
  vm.createContext(ctx);
  /* APPS 와 잣대 함수를 «원본 그대로» 싣는다 — 베껴 적으면 화면과 갈라진다 */
  const A = SRC.indexOf('var APPS = [');
  const B = SRC.indexOf('function appIsSoon(');
  const Bend = SRC.indexOf('\n', B);
  vm.runInContext(SRC.slice(A, SRC.indexOf('\n  ];', A) + 5), ctx);
  vm.runInContext(SRC.slice(B, Bend), ctx);
  vm.runInContext('var _isAdm = (role === "admin") || sgIsAdmin();\n' + 타일그리기(), ctx);
  const m = {};
  그린것.forEach(t => { m[t.dataset.key] = t; });
  return { 타일: m, 외침 };
}

const 준비중앱 = ['rules', 'payroll', 'docs', 'mail', 'paydata'];

test('①★★ 대표가 지목한 다섯에 표가 붙어 있다', () => {
  const A = SRC.indexOf('var APPS = [');
  const 목록 = SRC.slice(A, SRC.indexOf('\n  ];', A));
  준비중앱.forEach(k => {
    const 줄 = 목록.split('\n').find(l => l.indexOf("key:'" + k + "'") >= 0);
    assert.ok(줄, '★★ ' + k + ' 앱이 목록에 없다');
    assert.match(줄, /soon:\s*true/,
      '★★ ' + k + ' 에 준비중 표가 없다 — 대표가 지목하신 다섯 중 하나다');
  });
});

test('②★★ 대표가 아니면 흐리고·「준비중」이라 적히고·못 눌린다', () => {
  const { 타일 } = 그려보기('member');
  준비중앱.forEach(k => {
    const t = 타일[k];
    assert.ok(t, '★★ ' + k + ' 타일이 아예 안 그려졌다 — 「보이되 못 누르게」이지 감추는 게 아니다');
    assert.match(t.innerHTML, /준비중/, '★★ ' + k + ' 에 「준비중」이 안 적혔다');
    assert.ok(parseFloat(t.style.opacity) < 1, '★★ ' + k + ' 이 또렷하다 — 또렷하면 눌러도 되는 줄 안다');
    assert.equal(t.href, '#', '★★ ' + k + ' 이 아직 그 앱으로 간다');
    assert.equal(t.target, undefined, '★★ ' + k + ' 이 새 탭으로 열린다 — 막은 뜻이 없다');
    assert.doesNotMatch(t.innerHTML, /탭 이동/, '★ 안 열리는데 「탭 이동」이라 적혀 있다');
  });
});

test('③★★ 대표에게는 그대로다 — 잠근 김에 대표까지 잠그면 일을 못 하신다', () => {
  const { 타일 } = 그려보기('admin');
  준비중앱.forEach(k => {
    const t = 타일[k];
    assert.ok(t, '★★ ' + k + ' 타일이 대표 화면에서 사라졌다');
    assert.doesNotMatch(t.innerHTML, /준비중/, '★★ 대표 화면에 「준비중」이 붙었다');
    assert.notEqual(t.href, '#', '★★ 대표님이 ' + k + ' 을 못 여신다');
  });
});

test('④★★ 눌렀을 때 «까닭을 말한다» — 아무 일도 안 나면 고장인 줄 안다', () => {
  const { 타일, 외침 } = 그려보기('member');
  /* ⚠★★ 「여는 처리가 아예 안 붙어 있는가」를 본다 — 막는 처리가 «있는가»가 아니다.
     처음에는 stopPropagation() 으로 막았다. 그것은 부모로 올라가는 것만 막을 뿐
     같은 칸에 붙은 다른 처리는 그대로 돈다 — PC 에서 그냥 열렸다.
     이 검사가 그것을 잡았다(openPortalApp is not defined). 글자만 봤으면 못 잡는다. */
  let 막았나 = false;
  타일['rules']._clicks.forEach(fn => fn({ preventDefault(){ 막았나 = true; }, stopPropagation(){} }));
  assert.ok(막았나, '★★ 누르면 그대로 넘어간다');
  assert.equal(타일['rules']._clicks.length, 1,
    '★★ 누를 때 도는 처리가 ' + 타일['rules']._clicks.length + '개다 — 하나는 «여는» 처리다.\n' +
    '  막는 처리를 앞에 붙여도 같은 칸의 다른 처리는 그대로 돈다. 아예 안 붙여야 한다.');
  assert.equal(외침.length, 1, '★★ 눌렀는데 아무 말이 없다 — 고장난 줄 안다');
  assert.match(외침[0], /준비중/, '★ 무엇 때문에 안 열리는지 말하지 않는다');
});

test('⑤★★ 「로그인 후 바로가기」로도 못 샌다', () => {
  /* 타일만 잠그면 바로가기 드롭다운으로 그냥 열린다. maybeGoHome 도 이 목록을 본다. */
  const i = SRC.indexOf('function accessibleApps(');
  assert.ok(i > -1);
  const 조각 = SRC.slice(i, SRC.indexOf('\n  }', i));
  assert.match(stripJs(조각), /appIsSoon\(/,
    '★★ 바로가기 목록이 준비중을 안 거른다 — 타일은 잠갔는데 그쪽으로 열린다');
});

test('⑥★★ 잣대를 사번으로 박지 않는다 — 바뀌는 날 대표님이 잠긴다', () => {
  const i = SRC.indexOf('function appIsSoon(');
  const 조각 = stripJs(SRC.slice(i, SRC.indexOf('\n', i)));
  assert.doesNotMatch(조각, /P-?00?1|권형하/,
    '★★ 사람을 사번·이름으로 박았다. 사번이 바뀌면 대표님 화면에서 앱이 통째로 잠긴다 —\n' +
    '  잣대는 adminOnly 와 같은 것(명부의 role)이어야 한다');
});

test('⑦ 잣대가 «한 곳»이다 — 두 곳에 두면 한쪽만 고쳐진다', () => {
  const bare = stripJs(SRC);
  const 센것 = (bare.match(/function appIsSoon\(/g) || []).length;
  assert.equal(센것, 1, '★★ 잣대 함수가 ' + 센것 + '개다');
  assert.ok((bare.match(/\.soon\b/g) || []).length <= 1,
    '★★ app.soon 을 직접 보는 자리가 또 있다 — 잣대를 거치지 않으면 규칙이 갈라진다');
});
