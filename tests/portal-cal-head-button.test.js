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
     ⑥ CSS — [hidden] 이 먹는다(display 를 주면 hidden 이 풀리는 함정) · 폰에서는 이름 글자를 접고 그림(+숫자 딱지)만
     ⑦ 「오늘 N건」(대표 지시 2026-11-15) = 구글 공용 달력의 «오늘 일정» 건수 — 걸친 날 셈이 푸른 캘린더의 진짜 gcalToEvent 와 같다(맞대 본다)
     ⑧ 못 받으면 숫자를 «안 보인다»(못 받음 ≠ 0건) · 받으면 말풍선·접근성 이름이 무엇을 센 숫자인지 밝힌다
     ⑨ 하루치 한 번 — 5분 캐시 · 실패하면 1분 쉼 · 동시에 두 번 안 받는다 · 날이 바뀌면 어제 숫자를 지운다
     ⑩ 같은 달력·같은 열쇠(pu-cal.html)로 하루치만 · 서버 자료(.ref)는 안 읽는다 */
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
/* 「오늘 N건」 구역 — var PORTAL_GCAL 부터 «오늘 N건 끝» 표시까지 통째로 떠 온다 */
const 건수구역 = (() => {
  const a = ENTER.indexOf('var PORTAL_GCAL');
  const b = ENTER.indexOf('/* ── 오늘 N건 끝 ── */', a);
  assert.ok(a > 0 && b > a, '「오늘 N건」 구역(var PORTAL_GCAL … 오늘 N건 끝)을 못 찾았다');
  return ENTER.slice(a, b);
})();

/* 상태: 폰 · 지금(가짜 시계 ms) · 구글응답(JSON) · 구글오류(true 면 fetch 가 거부) */
function 놀이터(상태) {
  상태 = 상태 || {};
  const 속성 = {};
  const 처리 = {};
  const 딱지 = { hidden: true, 클래스: new Set(), classList: null };
  딱지.classList = { toggle(c, f) { if (f) 딱지.클래스.add(c); else 딱지.클래스.delete(c); }, contains(c) { return 딱지.클래스.has(c); } };
  const el = {
    hidden: true, href: '', title: '', target: '', 처리수: 0,
    _m: { textContent: '' }, _d: { textContent: '' }, _v: { textContent: '' }, _n: 딱지,
    querySelector(sel) {
      return sel === '.hd-m' ? this._m : sel === '.hd-d' ? this._d : sel === '.hd-nv' ? this._v : sel === '.hd-n' ? this._n : null;
    },
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(속성, k) ? 속성[k] : null; },
    setAttribute(k, v) { 속성[k] = String(v); },
    removeAttribute(k) { delete 속성[k]; },
    addEventListener(t, fn) { 처리[t] = fn; this.처리수++; },
  };
  el.setAttribute('data-name', '푸른 캘린더');
  el.setAttribute('data-head-app', '1');
  const 문서처리 = {};
  const 열림 = [];
  const 받음 = [];                                   // fetch 로 부른 주소들
  const 시계 = { 지금: 상태.지금 || Date.now() };
  class 가짜날짜 extends Date {
    constructor(...a) { if (a.length === 0) super(시계.지금); else super(...a); }
    static now() { return 시계.지금; }
  }
  const document = {
    hidden: false,
    getElementById(id) { return id === 'headApp_cal' ? el : null; },
    querySelectorAll(sel) { return sel === '[data-head-app]' ? [el] : []; },
    addEventListener(t, fn) { 문서처리[t] = fn; },
  };
  const g = { 응답: Object.prototype.hasOwnProperty.call(상태, '구글응답') ? 상태.구글응답 : { items: [] }, 오류: !!상태.구글오류, 보류: !!상태.구글보류, 풀기: null };
  const ctx = vm.createContext({
    document,
    Date: 가짜날짜,
    isMobile: () => !!상태.폰,
    portalAppWindowName: (k) => 'pureun-' + k,
    openPortalApp: (app, url) => { 열림.push({ app, url }); },
    fetch: (url) => {
      받음.push(String(url));
      if (g.오류) return Promise.reject(new Error('연결 실패'));
      if (g.보류) return new Promise((res) => { g.풀기 = () => res({ json: () => Promise.resolve(g.응답) }); });   // 응답이 «늦게» 오는 경우를 흉내
      return Promise.resolve({ json: () => Promise.resolve(g.응답) });
    },
  });
  const 시작 = ENTER.indexOf('function portalHeadAppsHide');
  assert.ok(시작 > 0, 'portalHeadAppsHide 를 못 찾았다');
  const 글 = [몸(ENTER, 'function portalHeadAppsHide'), 몸(ENTER, 'function portalHeadAppDate'), 몸(ENTER, 'function portalHeadAppLabel'),
    몸(ENTER, 'function portalHeadAppPaint'), 건수구역,
    몸(ENTER, "document.addEventListener('visibilitychange', function(){", 시작) + ');'].join('\n');
  vm.runInContext(글, ctx);
  return { el, document, 처리, 문서처리, 열림, 받음, 시계, g, ctx };
}
const 흘려보내기 = () => new Promise((r) => setImmediate(r));   // 대기 중인 약속(then)들이 다 돌 때까지
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
  /* 폰: 이름 글자(b)는 접고, 「오늘 N건」은 그림 모서리 딱지로 바꾼다(글자 «오늘»·«건»은 접고 숫자만) */
  const 폰구간 = /@media\s*\(max-width:\s*\d+px\)\s*\{\s*\.pbar \.hd-app\s*\{[^@]*/.exec(css);
  assert.ok(폰구간, '폰 구간(.hd-app 을 건드리는 @media)을 못 찾았다');
  assert.match(폰구간[0], /\.pbar \.hd-tx b\s*\{\s*display:\s*none/, '★ 폰 구간에서 단추의 이름 글자를 접지 않는다 — 머리줄이 한 줄을 넘는다');
  assert.match(폰구간[0], /\.pbar \.hd-n\s*\{[^}]*position:\s*absolute/, '★ 폰에서 「오늘 N건」이 모서리 딱지가 아니다 — 글자가 머리줄 폭을 먹는다');
  assert.match(폰구간[0], /\.pbar \.hd-n \.hd-nl\s*\{\s*display:\s*none/, '폰 딱지에 「오늘」·「건」 글자가 남는다');
  assert.match(css, /\.pbar \.hd-n\[hidden\]\s*\{\s*display:\s*none/, '★ 숫자 칸의 [hidden] 줄이 없다 — 못 받았는데 빈 칸이 보인다');
});

test('⑥★ 태블릿 세로 폭(768px)에서도 단추 글자를 접는다 — 머리줄은 한 줄(nowrap)이라 안 접으면 로그아웃이 화면 밖으로 밀린다', () => {
  const css = ENTER.slice(0, ENTER.indexOf('</style>'));
  const 접음 = /@media\s*\(max-width:\s*(\d+)px\)\s*\{\s*\.pbar \.hd-app\s*\{[^@]*\.pbar \.hd-tx b\s*\{\s*display:\s*none/.exec(css);
  assert.ok(접음, '단추 글자를 접는 @media 를 못 찾았다');
  /* 검사고정-허용: 768 은 아이패드 세로 폭 — «이 폭에서 접는가»가 규칙이다(2026-11-15 768px 에서 로그아웃이 102px 밀린 것을 직접 쟀다) */
  assert.ok(Number(접음[1]) >= 768, '★ 단추 글자를 ' + 접음[1] + 'px 이하에서만 접는다 — 태블릿 세로(768px)에서 머리줄이 한 줄을 넘는다');
  /* 접어도 줄 사이 틈(13px)이 그대로면 768px 에서 16px 넘는다 — 폰(≤520px)은 줄이 접히므로 건드리지 않는다 */
  const 틈 = /@media\s*\(min-width:\s*521px\)\s*and\s*\(max-width:\s*(\d+)px\)\s*\{\s*\.pbar\s*\{[^}]*gap:\s*\d+px/.exec(css);
  assert.ok(틈, '★ 태블릿 구간(521px~)에서 머리줄 틈을 줄이지 않는다 — 글자를 접어도 768px 에서 넘친다');
  assert.ok(Number(틈[1]) >= Number(접음[1]), '틈을 줄이는 구간이 글자를 접는 구간보다 좁다 — 그 사이 폭에서 넘친다');
});

test('⑦ 오늘 N건 단추 칸 — 머리줄 단추 안에 숫자 칸이 «감춰진 채» 있다 · 모든 count 앱에는 세는 함수가 있다', () => {
  const pbar = ENTER.slice(ENTER.indexOf('<div class="pbar">'));
  const at = pbar.indexOf('id="headApp_cal"');
  const 단추 = pbar.slice(at, pbar.indexOf('</a>', at));
  const 칸 = /<[a-z]+ class="hd-n"[^>]*>/.exec(단추);
  assert.ok(칸, '★ 단추 안에 숫자 칸(.hd-n)이 없다');
  assert.match(칸[0], /\shidden(\s|>|=)/, '★ 숫자 칸이 처음부터 보인다 — 받기 전에 빈 딱지가 뜬다(aria-hidden 은 hidden 이 아니다)');
  assert.ok(단추.indexOf('class="hd-nv"') >= 0, '숫자를 채울 자리(.hd-nv)가 없다');
  /* APPS 의 count 값마다 세는 함수가 있어야 한다 — 값만 적고 함수가 없으면 숫자가 영영 안 뜬다 */
  const s0 = ENTER.indexOf('var APPS = ['), s1 = ENTER.indexOf('var APP_ROWS', s0);
  const 앱줄 = ENTER.slice(s0, s1).split('\n').filter((l) => /^\s*\{\s*key:'/.test(l));
  const 센다 = 앱줄.filter((l) => /\bcount:'/.test(l)).map((l) => /\bcount:'([A-Za-z0-9_]+)'/.exec(l)[1]);
  assert.ok(센다.length >= 1, 'count 를 쓰는 앱이 없다 — 캘린더 단추의 「오늘 N건」이 꺼졌다');
  const 표 = /var PORTAL_HEAD_COUNTERS = \{([^}]*)\}/.exec(건수구역);
  assert.ok(표, 'PORTAL_HEAD_COUNTERS 를 못 찾았다');
  센다.forEach((k) => assert.ok(new RegExp('\\b' + k + '\\s*:').test(표[1]), '★ count:\'' + k + '\' 인데 세는 함수가 없다'));
});

test('① 챗봇 안내 글에도 «자료함에 캘린더» 옛 말이 안 남는다', () => {
  const kb = fs.readFileSync(path.join(__dirname, '..', 'js', 'pu-chatbot-kb.js'), 'utf8');
  assert.ok(!/자료함\(7개\)\]: [^\n]*푸른 캘린더/.test(kb), '★ 길잡이 챗봇이 «자료함(7개)에 캘린더»라고 안내한다');
  assert.ok(/머리줄/.test(kb), '챗봇 안내에 캘린더가 머리줄 단추라는 말이 없다');
});

/* ══ ⑦ 「오늘 N건」 — 무엇을 세나(푸른 캘린더의 진짜 셈과 맞댄다) ══ */
const CAL = fs.readFileSync(path.join(__dirname, '..', 'pu-cal.html'), 'utf8').replace(/\r\n/g, '\n');

/* 푸른 캘린더의 «진짜» gcalToEvent + eventsOn 의 구글 걸침 판단(date === ymd || date < ymd <= end)으로 그 날 칸에 드는 구글 일정 수 */
function 달력이센다(items, ymd) {
  const 상자 = {
    D: { user_accounts: [], staff_colors: {}, gcal_mail_sid: {} }, window: { _gcalColors: {} },
    Object, Array, String, JSON, Math, parseInt, Date,
  };
  vm.createContext(상자);
  vm.runInContext([
    'function todayYMD(){ return ' + JSON.stringify(ymd) + '; }',
    ...['function shiftDay(ymd, n){', 'function allUsers(){', 'function users(){', 'function userOf(sid){', 'function colorOf(sid){',
      'function gcalMailKey(m){', 'function gcalMailMap(){', 'function gcalSidByMail(mail){', 'function gcalPalette(){',
      'function gcalMailColor(mail){', 'function 제목시각(title, 구글시각){', 'function 일정담당(ev){', 'function gcalToEvent(ev){']
      .map((h) => 몸(CAL, h)),
    'var __items = ' + JSON.stringify(items) + ', __ymd = ' + JSON.stringify(ymd) + ', __n = 0;',
    '__items.filter(function(ev){ return ev.start && (ev.start.date || ev.start.dateTime); }).map(gcalToEvent).forEach(function(ge){',
    '  if(ge.date === __ymd || (ge.end && ge.date < __ymd && __ymd <= ge.end)) __n++;',
    '});',
  ].join('\n'), 상자);
  return 상자.__n;
}
function 포털이센다(items, ymd) {
  const g = 놀이터({ 지금: new Date(2026, 10, 15, 12, 0, 0).getTime() });
  return vm.runInContext('portalCountGcalOn', g.ctx)(items, ymd);
}

const 오늘 = '2026-11-15';
const 한낮 = () => new Date(2026, 10, 15, 12, 0, 0).getTime();     // 가짜 시계 — 어느 시간대에서도 «지역 날짜»가 2026-11-15
const 일정들 = [
  { id: 'a', summary: '오늘 상담', start: { dateTime: '2026-11-15T10:00:00+09:00' }, end: { dateTime: '2026-11-15T11:00:00+09:00' } },    // 든다
  { id: 'b', summary: '종일 휴무', start: { date: '2026-11-15' }, end: { date: '2026-11-16' } },                                        // 든다
  { id: 'c', summary: '어제 종일', start: { date: '2026-11-14' }, end: { date: '2026-11-15' } },                                        // 안 든다(종일의 end.date 는 «다음 날»이라 끝 안 듦)
  { id: 'd', summary: '사흘 연수', start: { date: '2026-11-13' }, end: { date: '2026-11-17' } },                                        // 든다(걸침)
  { id: 'e', summary: '자정에 끝남', start: { dateTime: '2026-11-14T22:00:00+09:00' }, end: { dateTime: '2026-11-15T00:00:00+09:00' } },  // 안 든다(자정에 끝나면 그날은 안 든다)
  { id: 'f', summary: '밤샘', start: { dateTime: '2026-11-14T23:00:00+09:00' }, end: { dateTime: '2026-11-15T01:00:00+09:00' } },       // 든다(새벽 1시까지)
  { id: 'g', summary: '내일', start: { dateTime: '2026-11-16T09:00:00+09:00' }, end: { dateTime: '2026-11-16T10:00:00+09:00' } },       // 안 든다
  { id: 'h', summary: '끝 없음', start: { dateTime: '2026-11-15T15:00:00+09:00' } },                                                   // 든다(끝이 없으면 시작한 날)
  { id: 'i', summary: '시작 없음' },                                                                                                    // 건너뜀
];

test('⑦★ 오늘 건수 셈 — 걸친 날 규칙이 푸른 캘린더의 진짜 gcalToEvent 와 «날마다» 같다(종일 끝날·자정 끝·여러 날·끝 없음)', () => {
  for (let k = -3; k <= 3; k++) {
    const d = new Date(2026, 10, 15 + k);
    const ymd = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    assert.equal(포털이센다(일정들, ymd), 달력이센다(일정들, ymd),
      '★ ' + ymd + ' 의 건수가 푸른 캘린더(구글 일정 칸에 드는 수)와 다르다 — 단추의 숫자가 달력과 어긋난다');
  }
  assert.equal(달력이센다(일정들, 오늘), 5, '검사 자료의 기대값(달력 쪽)이 틀어졌다 — 자료 또는 달력의 걸침 규칙을 본다');
  assert.equal(포털이센다(일정들, 오늘), 5);
  assert.equal(포털이센다([], 오늘), 0);
  assert.equal(포털이센다(null, 오늘), 0);
});

async function 그리고받기(상태, 앱옵션) {
  const g = 놀이터(Object.assign({ 지금: 한낮() }, 상태));
  vm.runInContext('portalHeadAppPaint', g.ctx)(Object.assign({}, 앱, { count: 'gcalToday' }, 앱옵션 || {}));
  await 흘려보내기();
  return g;
}

test('⑧★ 받으면 숫자 · 0건도 «받은 0» 으로 보이되 흐리게 · 말풍선·접근성 이름이 무엇을 센 숫자인지 밝힌다', async () => {
  const g = await 그리고받기({ 구글응답: { items: 일정들 } });
  assert.equal(g.el._n.hidden, false, '★ 받았는데 숫자 칸을 안 켠다');
  assert.equal(g.el._v.textContent, '5');
  assert.equal(g.el._n.클래스.has('is-zero'), false);
  assert.equal(g.el.getAttribute('data-n'), '5');
  assert.match(g.el.getAttribute('aria-label'), /푸른 캘린더 — 오늘 11월 15일 · 오늘 구글 공용 달력 일정 5건/, '★ 접근성 이름(폰은 글자를 접는다)에 건수가 없다');
  assert.match(g.el.title, /구글 공용 달력 일정 5건/, '★ 말풍선이 무엇을 센 숫자인지 안 밝힌다 — 달력 칸과 다른 수가 «틀린 말»이 된다');
  assert.match(g.el.title, /연차·출장·나만 보기/, '말풍선이 안 센 것(근태·나만 보기)을 안 밝힌다');

  const 영 = await 그리고받기({ 구글응답: { items: [] } });
  assert.equal(영.el._n.hidden, false, '★ 받은 0건을 안 보인다');
  assert.equal(영.el._v.textContent, '0');
  assert.equal(영.el._n.클래스.has('is-zero'), true, '0건은 흐리게(is-zero) 보여야 한다 — 일정 있는 날과 구분');
});

test('⑧★ 못 받으면 숫자를 «안 보인다» — 0건으로 쳐서 거짓말하지 않는다(응답 오류·연결 실패·쪽 나뉨·이상한 응답)', async () => {
  const 경우 = [
    ['구글이 오류를 준다', { 구글응답: { error: { message: '열쇠 오류' } } }],
    ['연결이 실패한다', { 구글오류: true }],
    ['한 쪽에 안 담겨 쪽이 나뉜다(셀 수 없다)', { 구글응답: { items: 일정들, nextPageToken: 'abc' } }],
    ['목록이 없는 이상한 응답', { 구글응답: {} }],
    ['응답이 null', { 구글응답: null }],
  ];
  for (const [이름, 상태] of 경우) {
    const g = await 그리고받기(상태);
    assert.equal(g.el._n.hidden, true, '★ [' + 이름 + '] 못 받았는데 숫자 칸이 보인다 — 못 받음을 0건으로 보이면 «일정 없음» 거짓말');
    assert.equal(g.el.getAttribute('data-n'), null, '[' + 이름 + '] 숫자 표식이 남는다');
    assert.ok(!/건/.test(g.el.getAttribute('aria-label')), '[' + 이름 + '] 못 받았는데 접근성 이름에 건수가 있다');
    assert.ok(!/구글 공용 달력 일정/.test(g.el.title), '[' + 이름 + '] 못 받았는데 말풍선에 건수가 있다');
    assert.equal(g.el.hidden, false, '[' + 이름 + '] 숫자를 못 받아도 단추는 서야 한다 — 달력으로 가는 길이 막히면 안 된다');
  }
});

test('⑨★ 하루치 한 번 — 5분 캐시 · 동시에 두 번 안 받는다 · 5분이 지나면 다시', async () => {
  const g = await 그리고받기({ 구글응답: { items: 일정들 } });
  const paint = vm.runInContext('portalHeadAppPaint', g.ctx);
  const 단추 = Object.assign({}, 앱, { count: 'gcalToday' });
  assert.equal(g.받음.length, 1);
  paint(단추); await 흘려보내기(); paint(단추); await 흘려보내기();
  assert.equal(g.받음.length, 1, '★ 다시 그릴 때마다 구글을 부른다 — 배치를 건드릴 때마다 요청이 쌓인다');
  assert.equal(g.el._v.textContent, '5', '캐시로 다시 그려도 숫자는 그대로여야 한다');
  g.시계.지금 += 5 * 60 * 1000 + 1000;
  paint(단추); await 흘려보내기();
  assert.equal(g.받음.length, 2, '★ 5분이 지났는데 다시 안 센다 — 낮 동안 일정이 늘어도 숫자가 안 맞는다');

  const 동시 = 놀이터({ 지금: 한낮(), 구글보류: true });
  const p2 = vm.runInContext('portalHeadAppPaint', 동시.ctx);
  p2(단추); p2(단추); p2(단추);
  await 흘려보내기();                       // 구글 호출은 한 박자 뒤에 일어난다 — 그 뒤에 센다
  assert.equal(동시.받음.length, 1, '★ 받는 중에 또 그리면 또 받는다 — 같은 요청이 겹친다');
});

test('⑨★ 실패하면 1분은 쉰다(요청 폭주 없음) · 1분 뒤에는 다시 시도해 되살아난다', async () => {
  const g = await 그리고받기({ 구글오류: true });
  const paint = vm.runInContext('portalHeadAppPaint', g.ctx);
  const 단추 = Object.assign({}, 앱, { count: 'gcalToday' });
  assert.equal(g.받음.length, 1);
  g.시계.지금 += 30 * 1000;
  paint(단추); await 흘려보내기();
  assert.equal(g.받음.length, 1, '★ 실패 직후 다시 그릴 때마다 구글을 때린다');
  g.g.오류 = false; g.g.응답 = { items: 일정들 };
  g.시계.지금 += 31 * 1000;
  paint(단추); await 흘려보내기();
  assert.equal(g.받음.length, 2, '★ 1분이 지나도 다시 시도하지 않는다 — 한 번 실패하면 하루 종일 숫자가 없다');
  assert.equal(g.el._v.textContent, '5', '다시 시도해 받았는데 숫자가 안 뜬다');
});

test('⑨★ 날이 바뀌면 어제 숫자를 지우고 오늘 것을 다시 센다 · 받는 사이 자정을 넘기면 어제 응답을 오늘 것으로 쓰지 않는다', async () => {
  const g = await 그리고받기({ 구글응답: { items: 일정들 } });
  assert.equal(g.el._v.textContent, '5');
  /* 자정을 넘겨 다시 본다 — 새 숫자가 오기 «전»에는 어제 숫자가 남아 있으면 안 된다 */
  g.시계.지금 = new Date(2026, 10, 16, 0, 5, 0).getTime();
  g.g.응답 = { items: [{ id: 'z', summary: '내일 일정', start: { dateTime: '2026-11-16T09:00:00+09:00' }, end: { dateTime: '2026-11-16T10:00:00+09:00' } }] };
  g.g.보류 = true;
  g.문서처리.visibilitychange();
  assert.equal(g.el._n.hidden, true, '★ 날이 바뀌었는데 어제 숫자가 남아 있다 — 어제의 5건을 오늘 것처럼 보인다');
  await 흘려보내기();                       // 구글 호출이 나간 뒤에야 «풀기»가 생긴다
  g.g.풀기(); await 흘려보내기();
  assert.equal(g.el._n.hidden, false);
  assert.equal(g.el._v.textContent, '1', '★ 오늘(11-16) 건수를 새로 안 센다');
  assert.ok(decodeURIComponent(g.받음[g.받음.length - 1]).indexOf('timeMin=2026-11-16T00:00:00+09:00') >= 0, '★ 새 날의 하루치를 받지 않는다');

  /* 받는 사이 자정을 넘김: 11-15 23:59 에 시작한 요청이 11-16 에 도착 → 반영하지 않는다 */
  const h = 놀이터({ 지금: new Date(2026, 10, 15, 23, 59, 50).getTime(), 구글보류: true, 구글응답: { items: 일정들 } });
  vm.runInContext('portalHeadAppPaint', h.ctx)(Object.assign({}, 앱, { count: 'gcalToday' }));
  await 흘려보내기();                       // 요청이 «나간» 뒤에 시계를 넘긴다
  h.시계.지금 = new Date(2026, 10, 16, 0, 0, 10).getTime();
  h.g.풀기(); await 흘려보내기();
  assert.equal(h.el._n.hidden, true, '★ 자정을 넘겨 도착한 어제 응답을 오늘 숫자로 쓴다');
  assert.equal(h.el.getAttribute('data-n'), null);
});

test('⑨ 받는 사이 단추가 감춰지면(다른 사람으로 바뀜) 늦게 온 숫자를 반영하지 않는다', async () => {
  const g = 놀이터({ 지금: 한낮(), 구글보류: true, 구글응답: { items: 일정들 } });
  vm.runInContext('portalHeadAppPaint', g.ctx)(Object.assign({}, 앱, { count: 'gcalToday' }));
  await 흘려보내기();                       // 요청이 «나간» 뒤에 단추를 감춘다
  vm.runInContext('portalHeadAppsHide', g.ctx)();
  g.g.풀기(); await 흘려보내기();
  assert.equal(g.el.getAttribute('data-n'), null, '★ 감춘 단추에 숫자를 쓴다 — 볼 수 없는 사람의 단추에 값이 남는다');
});

test('⑩★ 같은 달력·같은 열쇠(pu-cal.html)로 «하루치»만 · 받는 것은 시작·끝뿐(제목·설명·참석자는 안 받는다)', async () => {
  const g = await 그리고받기({ 구글응답: { items: 일정들 } });
  assert.equal(g.받음.length, 1);
  const url = g.받음[0];
  const 열쇠 = /var GCAL_API_KEY = "([^"]+)"/.exec(CAL), 달력 = /var GCAL_CAL_ID\s*=\s*"([^"]+)"/.exec(CAL);
  assert.ok(열쇠 && 달력, 'pu-cal.html 의 GCAL_API_KEY·GCAL_CAL_ID 를 못 찾았다');
  assert.ok(url.indexOf('/calendars/' + encodeURIComponent(달력[1]) + '/events?') >= 0, '★ 푸른 캘린더와 «다른 달력»을 본다 — 숫자가 달력과 영영 안 맞는다');
  assert.ok(url.indexOf('key=' + 열쇠[1]) >= 0, '★ 푸른 캘린더와 다른 열쇠를 쓴다(열쇠가 바뀌면 두 곳을 함께 고쳐야 한다)');
  const q = decodeURIComponent(url);
  assert.ok(q.indexOf('timeMin=2026-11-15T00:00:00+09:00') >= 0, '하루의 시작(오늘 0시, 한국 시간)이 아니다');
  assert.ok(q.indexOf('timeMax=2026-11-16T00:00:00+09:00') >= 0, '하루의 끝(내일 0시)이 아니다 — 하루치가 아니면 건수가 부푼다');
  assert.ok(q.indexOf('singleEvents=true') >= 0, '★ 반복 일정을 하루치씩 펴지 않는다 — 매주 회의가 빠진다');
  const 필드 = /[?&]fields=([^&]+)/.exec(url);
  assert.ok(필드, '★ fields 가 없다 — 제목·설명·참석자(고객 이름·연락처)까지 포털이 통째로 받는다');
  const f = decodeURIComponent(필드[1]);
  assert.ok(/start/.test(f) && /end/.test(f), '시작·끝을 안 받으면 셀 수 없다');
  assert.ok(!/summary|description|attendees|creator|organizer|location/.test(f), '★ 포털이 건수만 세는데 제목·설명·만든이까지 받는다: ' + f);
});

test('⑩★ 오늘 N건은 서버 자료를 읽지 않는다 — 구글 하루치 한 번뿐(자료를 더 넓게 읽지 않는다)', () => {
  const 코드 = 건수구역.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  assert.ok(!/\.ref\(|firebase\.|db\.|my_schedules|cal_private|attendance_records/.test(코드), '★ 단추 숫자를 세려고 서버 자료(일정·근태·나만 보기)를 읽는다 — 포털이 넓게 읽게 된다');
  assert.ok((코드.match(/fetch\(/g) || []).length === 1, 'fetch 가 한 곳(오늘 하루치)이 아니다');
});
