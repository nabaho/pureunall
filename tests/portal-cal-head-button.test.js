'use strict';
/* 📅 포털 머리줄 앱 단추 — 캘린더를 자료함에서 빼고 «한 번에» 누르게 (대표 지시 2026-11-14, 목업 A안)
   ─────────────────────────────────────────────────────────────────────────
   APPS 의 `head:true` 앱(지금은 푸른 캘린더)은 줄 타일을 «만들지 않고», 머리줄(.pbar)의 큰 단추(#headApp_<key>)로 선다.
   저장된 공용 배치(app_config)에 자료함 따위로 적혀 있어도 타일 자체가 없으니 그 자리에 안 남는다.

   ★ 이 검사가 지키는 것 (값이 아니라 규칙)
     ① head 앱은 줄 타일을 안 만든다 — 타일을 그리는 반복의 앞머리를 «돌려서» 본다(보통 앱은 타일로, head 앱은 단추로)
        · 감춘 앱(off)·관리자 전용·역할 제한은 head 앱에도 그대로 먹는다(볼 수 없는 사람에게 단추가 서면 안 된다)
     ② 모든 head 앱에는 머리줄 단추가 있다 — 건의하기 바로 왼쪽, 처음엔 감춰져 있다(로그인 전에 보이면 안 된다)
     ③ 단추를 그리는 함수를 «돌려서» 본다 — 켜기·주소(sso=1)·창 이름(PC)·오늘 날짜·접근성 이름
     ④ 눌렀을 때 «타일과 같은 길» — PC 는 openPortalApp(10분 캐시 버킷), 폰은 링크 그대로. 두 번 그려도 처리를 한 번만 붙인다
     ⑤ 자정을 넘겨 열어 둔 포털도 다시 볼 때(visibilitychange) 날짜를 맞춘다 — 감춘 단추는 건드리지 않는다
     ⑥ CSS — [hidden] 이 먹는다(display 를 주면 hidden 이 풀리는 함정) · 폰에서는 글자를 접고 그림만
   ⚠ 「오늘 N건」은 일부러 안 넣었다 — 달력 화면이 보여 주는 것과 다른 수가 나오면 틀린 말이다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ENTER = fs.readFileSync(path.join(__dirname, '..', 'enter.html'), 'utf8').replace(/\r\n/g, '\n');

/* head 로 시작하는 «첫 여는 중괄호»부터 짝이 맞는 닫는 중괄호까지 */
function 몸(src, head, from) {
  const i = src.indexOf(head, from || 0);
  assert.ok(i >= 0, head + ' 를 못 찾았다');
  const open = src.indexOf('{', i);
  let depth = 0, j = open;
  for (; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}') { depth--; if (depth === 0) break; }
  }
  return src.slice(i, j + 1);
}

/* ── 타일 반복의 앞머리(역할·감춤·head 판단까지) — «돌려서» 본다 ── */
const 반복머리 = (() => {
  const mark = "APPS.forEach(function(app){\n      // 역할 제한이 있으면 확인";
  const i0 = ENTER.indexOf(mark);
  assert.ok(i0 >= 0, '타일을 그리는 반복을 못 찾았다');
  const i1 = ENTER.indexOf("var extra = '';", i0);
  assert.ok(i1 > i0, '타일 반복의 «타일을 만들기 직전» 자리를 못 찾았다');
  return ENTER.slice(i0 + "APPS.forEach(function(app){".length, i1);
})();

function 돌려보기(app, role, opt) {
  const o = opt || {};
  const 불림 = [];
  const f = new Function('app', 'role', 'sgIsAdmin', 'portalAppPermOk', 'portalHeadAppPaint',
    반복머리 + "\n return 'tile';");
  const 결과 = f(app, role, () => !!o.sgAdmin, () => !!o.permOk, (a) => 불림.push(a.key));
  return { 타일: 결과 === 'tile', 단추: 불림 };
}

test('①★ head 앱은 줄 타일을 안 만들고 머리줄 단추로 간다 — 보통 앱은 그대로 타일', () => {
  const head = { key: 'x1', name: '머리앱', url: 'x.html', roles: null, row: 'store', head: true };
  const 보통 = { key: 'x2', name: '보통앱', url: 'y.html', roles: null, row: 'store' };
  const a = 돌려보기(head, 'staff');
  assert.equal(a.타일, false, '★ head 앱인데 줄 타일이 만들어진다 — 자료함에 그대로 남는다');
  assert.deepEqual(a.단추, ['x1'], '★ head 앱인데 머리줄 단추를 안 그린다');
  const b = 돌려보기(보통, 'staff');
  assert.equal(b.타일, true, '★ 보통 앱이 타일로 안 간다 — head 판단이 너무 넓다');
  assert.deepEqual(b.단추, [], '보통 앱에 머리줄 단추가 그려진다');
});

test('①★ head 앱에도 감춤(off)·관리자 전용·역할 제한이 그대로 먹는다 — 볼 수 없는 사람에게 단추가 서면 안 된다', () => {
  const 베이스 = { key: 'x1', name: '머리앱', url: 'x.html', head: true };
  assert.deepEqual(돌려보기(Object.assign({ off: true }, 베이스), 'admin').단추, [], '★ off 앱의 단추가 선다');
  assert.deepEqual(돌려보기(Object.assign({ adminOnly: true }, 베이스), 'staff').단추, [], '★ 관리자 전용 단추가 직원에게 선다');
  assert.deepEqual(돌려보기(Object.assign({ adminOnly: true }, 베이스), 'admin').단추, ['x1'], '관리자에게는 서야 한다');
  assert.deepEqual(돌려보기(Object.assign({ roles: ['admin'] }, 베이스), 'staff').단추, [], '★ 역할 제한이 head 앱에 안 먹는다');
  assert.deepEqual(돌려보기(Object.assign({ roles: ['admin'] }, 베이스), 'admin').단추, ['x1']);
});

test('② 모든 head 앱에는 머리줄 단추가 있다 — 건의하기 바로 왼쪽 · 처음엔 감춰져 있다', () => {
  const s0 = ENTER.indexOf('var APPS = [');
  const s1 = ENTER.indexOf('var APP_ROWS', s0);
  assert.ok(s0 > 0 && s1 > s0, 'APPS 목록을 못 찾았다');
  const 앱줄 = ENTER.slice(s0, s1).split('\n').filter((l) => /^\s*\{\s*key:'/.test(l));
  const heads = 앱줄.filter((l) => /\bhead:true\b/.test(l)).map((l) => /key:'([a-z0-9_]+)'/.exec(l)[1]);
  assert.ok(heads.length >= 1, 'head 앱이 하나도 없다 — 캘린더가 다시 줄 타일로 돌아갔다');
  assert.ok(heads.indexOf('cal') >= 0, '푸른 캘린더가 head 앱이 아니다');
  const pbar = ENTER.slice(ENTER.indexOf('<div class="pbar">'));
  const chat = pbar.indexOf('id="chatFab"'), sg = pbar.indexOf('id="sgFab"');
  assert.ok(chat > 0 && sg > chat, '머리줄에서 챗봇·건의하기를 못 찾았다');
  heads.forEach((k) => {
    const at = pbar.indexOf('id="headApp_' + k + '"');
    assert.ok(at > 0, '★ head 앱 ' + k + ' 의 머리줄 단추(#headApp_' + k + ')가 없다');
    assert.ok(at > chat && at < sg, k + ' 단추가 챗봇과 건의하기 «사이»에 있지 않다');
    const tag = pbar.slice(pbar.lastIndexOf('<a ', at), pbar.indexOf('>', at));
    assert.match(tag, /\bhidden\b/, '★ ' + k + ' 단추가 처음부터 보인다 — 로그인 전에 보이면 안 된다');
    assert.match(tag, /data-head-app=/, k + ' 단추에 data-head-app 표식이 없다(감추기·날짜 맞추기가 못 찾는다)');
    assert.match(tag, /href="[^"]+"/, k + ' 단추에 주소가 없다');
  });
});

/* ── 단추를 그리는 함수들을 «돌린다» ── */
function 놀이터(상태) {
  const 속성 = {};
  const 처리 = {};
  const el = {
    hidden: true, href: '', title: '', target: '', 처리수: 0,
    _m: { textContent: '' }, _d: { textContent: '' },
    querySelector(sel) { return sel === '.hd-m' ? this._m : (sel === '.hd-d' ? this._d : null); },
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(속성, k) ? 속성[k] : null; },
    setAttribute(k, v) { 속성[k] = String(v); },
    removeAttribute(k) { delete 속성[k]; },
    addEventListener(t, fn) { 처리[t] = fn; this.처리수++; },
  };
  el.setAttribute('data-name', '푸른 캘린더');
  el.setAttribute('data-head-app', '1');
  const 문서처리 = {};
  const 열림 = [];
  const document = {
    hidden: false,
    getElementById(id) { return id === 'headApp_cal' ? el : null; },
    querySelectorAll(sel) { return sel === '[data-head-app]' ? [el] : []; },
    addEventListener(t, fn) { 문서처리[t] = fn; },
  };
  const ctx = vm.createContext({
    document,
    isMobile: () => !!상태.폰,
    portalAppWindowName: (k) => 'pureun-' + k,
    openPortalApp: (app, url) => { 열림.push({ app, url }); },
  });
  const 시작 = ENTER.indexOf('function portalHeadAppsHide');
  assert.ok(시작 > 0, 'portalHeadAppsHide 를 못 찾았다');
  const 글 = [몸(ENTER, 'function portalHeadAppsHide'), 몸(ENTER, 'function portalHeadAppDate'), 몸(ENTER, 'function portalHeadAppPaint'),
    몸(ENTER, "document.addEventListener('visibilitychange', function(){", 시작) + ');'].join('\n');
  vm.runInContext(글, ctx);
  return { el, document, 처리, 문서처리, 열림, ctx };
}
const 앱 = { key: 'cal', name: '푸른 캘린더', desc: '일정·근태', url: 'pu-cal.html', roles: null, row: 'client', head: true };
const 지금날짜 = () => { const d = new Date(); return { m: (d.getMonth() + 1) + '월', d: String(d.getDate()) }; };

test('③ 단추 그리기 — 켜고 · sso=1 주소 · PC 는 창 이름 · 오늘 날짜 · 접근성 이름', () => {
  const g = 놀이터({ 폰: false });
  const 앞 = 지금날짜();
  vm.runInContext('portalHeadAppPaint', g.ctx)(앱);
  const 뒤 = 지금날짜();
  assert.equal(g.el.hidden, false, '★ 단추를 안 켠다');
  assert.match(g.el.href, /^pu-cal\.html\?sso=1$/, '★ 주소가 타일과 다르다(sso=1 이 있어야 로그인이 이어진다)');
  assert.equal(g.el.target, 'pureun-cal', 'PC 는 앱마다 정해진 창 이름으로 열어야 같은 창을 다시 쓴다');
  assert.ok(g.el.title.indexOf('푸른 캘린더') >= 0, '말풍선(title)에 앱 이름이 없다');
  assert.ok([앞.m, 뒤.m].indexOf(g.el._m.textContent) >= 0, '★ 달력 그림의 월이 오늘이 아니다: ' + g.el._m.textContent);
  assert.ok([앞.d, 뒤.d].indexOf(g.el._d.textContent) >= 0, '★ 달력 그림의 일이 오늘이 아니다: ' + g.el._d.textContent);
  const 라벨 = g.el.getAttribute('aria-label') || '';
  assert.ok(라벨.indexOf('푸른 캘린더') >= 0 && 라벨.indexOf('오늘') >= 0, '★ 접근성 이름이 없다(폰은 글자를 접으므로 이것이 유일한 이름이다): ' + 라벨);
});

test('③ 폰에서는 새 창 대상(target)을 달지 않는다 — 한 화면에서 이동', () => {
  const g = 놀이터({ 폰: true });
  g.el.target = 'x';
  g.el.setAttribute('target', 'x');
  vm.runInContext('portalHeadAppPaint', g.ctx)(앱);
  assert.equal(g.el.getAttribute('target'), null, '★ 폰인데 target 이 남아 있다');
});

test('④ 눌렀을 때 타일과 같은 길 — PC 는 openPortalApp(10분 캐시 버킷), 폰은 링크 그대로', () => {
  const pc = 놀이터({ 폰: false });
  vm.runInContext('portalHeadAppPaint', pc.ctx)(앱);
  let 막음 = 0;
  pc.처리.click({ preventDefault() { 막음++; } });
  assert.equal(막음, 1, '★ PC 에서 링크의 기본 이동을 안 막는다 — 창 재사용이 안 된다');
  assert.equal(pc.열림.length, 1, '★ PC 에서 openPortalApp 을 안 부른다');
  assert.equal(pc.열림[0].app.key, 'cal');
  assert.match(pc.열림[0].url, /^pu-cal\.html\?sso=1&v=\d+$/, '★ 주소가 타일과 다르다(sso=1 + 10분 캐시 번호)');

  const 폰 = 놀이터({ 폰: true });
  vm.runInContext('portalHeadAppPaint', 폰.ctx)(앱);
  let 폰막음 = 0;
  폰.처리.click({ preventDefault() { 폰막음++; } });
  assert.equal(폰막음, 0, '★ 폰에서 링크를 막는다 — 눌러도 안 열린다');
  assert.equal(폰.열림.length, 0, '폰에서 창 열기를 부른다');
});

test('④ 두 번 그려도 누름 처리는 한 번만 붙는다 — 로그인·배치가 바뀔 때마다 다시 그린다', () => {
  const g = 놀이터({ 폰: false });
  const paint = vm.runInContext('portalHeadAppPaint', g.ctx);
  paint(앱); paint(앱); paint(앱);
  assert.equal(g.el.처리수, 1, '★ 그릴 때마다 처리가 쌓인다 — 한 번 눌렀는데 창이 여러 번 열린다');
});

test('① 다시 그리기 전에 단추를 감춘다 — 다른 사람으로 바뀌어도 앞사람의 단추가 안 남는다', () => {
  const g = 놀이터({ 폰: false });
  vm.runInContext('portalHeadAppPaint', g.ctx)(앱);
  assert.equal(g.el.hidden, false);
  vm.runInContext('portalHeadAppsHide', g.ctx)();
  assert.equal(g.el.hidden, true, '★ 감추기가 안 먹는다');
  /* 그리는 쪽이 그 감추기를 «부른다» — 타일을 비우는 자리와 타일 반복 «사이»에서. 안 부르면 볼 수 없는 사람에게 앞사람의 단추가 남는다 */
  const 비움 = ENTER.indexOf("tileConts().forEach(function(c){ c.innerHTML = ''; });");
  const 반복 = ENTER.indexOf("APPS.forEach(function(app){\n      // 역할 제한이 있으면 확인");
  const 감춤 = ENTER.indexOf('portalHeadAppsHide();', 비움);
  assert.ok(비움 > 0 && 반복 > 비움, '타일을 비우고 다시 그리는 자리를 못 찾았다');
  assert.ok(감춤 > 비움 && 감춤 < 반복, '★ 포털을 다시 그릴 때 타일 반복 앞에서 portalHeadAppsHide() 를 부르지 않는다');
});

test('⑤ 날짜 맞추기 — 다시 볼 때 «보이는» 단추만, 안 보일 때(hidden)는 건드리지 않는다', () => {
  const g = 놀이터({ 폰: false });
  vm.runInContext('portalHeadAppPaint', g.ctx)(앱);
  const 핸들 = g.문서처리.visibilitychange;
  assert.equal(typeof 핸들, 'function', '★ visibilitychange 처리가 안 붙었다 — 밤새 열어 둔 포털은 어제 날짜를 보인다');
  g.el._m.textContent = '낡음'; g.el._d.textContent = '낡음';
  g.document.hidden = true;
  핸들();
  assert.equal(g.el._d.textContent, '낡음', '탭이 가려져 있을 때는 건드리지 않는다');
  g.document.hidden = false;
  핸들();
  assert.notEqual(g.el._d.textContent, '낡음', '★ 다시 볼 때 날짜를 안 맞춘다');
  g.el._d.textContent = '낡음'; g.el.hidden = true;
  핸들();
  assert.equal(g.el._d.textContent, '낡음', '★ 감춘 단추(볼 수 없는 사람)의 날짜까지 맞춘다 — 의미 없는 일');
});

test('⑥ CSS — [hidden] 이 먹는다 · 폰에서는 글자를 접고 그림만 · 챗봇과 건의하기 사이에 서는 차례', () => {
  const css = ENTER.slice(0, ENTER.indexOf('</style>'));
  assert.match(css, /\.pbar \.hd-app\[hidden\]\s*\{\s*display:\s*none/, '★ [hidden] 줄이 없다 — display 를 준 단추는 hidden 이 풀려 로그인 전에도 보인다');
  assert.match(css, /\.pbar \.hd-app\s*\{[^}]*order:\s*4/, '단추의 order 가 챗봇·건의하기(4)와 같지 않다 — 둘 사이에 서려면 같아야 한다');
  const 폰 = /@media\s*\(max-width:\s*\d+px\)\s*\{[^@]*\.pbar \.hd-tx\s*\{\s*display:\s*none/.exec(css);
  assert.ok(폰, '★ 폰 구간에서 단추의 글자를 접지 않는다 — 머리줄이 한 줄을 넘는다');
});

test('① 챗봇 안내 글에도 «자료함에 캘린더» 옛 말이 안 남는다', () => {
  const kb = fs.readFileSync(path.join(__dirname, '..', 'js', 'pu-chatbot-kb.js'), 'utf8');
  assert.ok(!/자료함\(7개\)\]: [^\n]*푸른 캘린더/.test(kb), '★ 길잡이 챗봇이 «자료함(7개)에 캘린더»라고 안내한다');
  assert.ok(/머리줄/.test(kb), '챗봇 안내에 캘린더가 머리줄 단추라는 말이 없다');
});
