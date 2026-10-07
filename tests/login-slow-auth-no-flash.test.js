'use strict';
/* 로그인 확인이 늦을 때 로그인 화면을 «먼저» 드러내지 않는다 (대표 보고 2026-10-07
   「앱에 들어갔다 나오면 튕겨서 다시 로그인 화면 나오고 또 로그인되고 반복한다 — 정확한 이유」).

   이유: 구글 인증 도구(10.13)는 저장된 로그인을 쓰기 «전에» 서버에 확인하러 간다(열쇠 갱신 + 계정 조회).
   폰이 막 깨어나면 8초를 넘긴다. 포털은 8초에 가림막을 걷어 로그인 화면이 드러났고,
   이알피는 확인 중(currentUser 비어 있음)을 «로그인 없음»으로 읽어 자물쇠를 띄웠다.
   실측: 대표 폰 실제 로그인은 그날 한 번 — 튕긴 것들은 로그아웃이 아니었다.

   못 박는 것(규칙):
   ① 포털: 8초가 지나도 인증 도구가 있으면 가림막을 두고 «느리다» + 「로그인 화면 보기」 단추
   ② 포털: 단추를 누르면 바로 열린다 · 마지막 안전망은 구글 요청 시간(30초)보다 길다
   ③ 포털: 인증 도구가 아예 없거나 카카오에서 돌아온 참이면 예전처럼 곧장 연다
   ④ 포털: «로그인 없음»이 확정되면 곧장 로그인 화면(기다리지 않는다)
   ⑤ 이알피: 포털 경유 대기는 구글 요청 시간보다 길다 · 확인이 끝나기 전엔 자물쇠를 안 띄운다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const R = path.join(__dirname, '..');
const enter = fs.readFileSync(path.join(R, 'enter.html'), 'utf8').replace(/\r\n/g, '\n');
const erp = fs.readFileSync(path.join(R, 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');
function strip(s) { return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1'); }

/* 가림막 스크립트(본문 첫 인라인 스크립트)를 떼어 가짜 문서·가짜 시계로 돌린다 */
const BOOT = (() => {
  const a = enter.indexOf("(function(){\n  var s=document.getElementById('pu-boot-splash');");
  assert.ok(a > 0, '가림막 스크립트를 못 찾음');
  return enter.slice(a, enter.indexOf('})();', a) + 5);
})();
function boot(opt) {
  opt = opt || {};
  const timers = [];
  let now = 0;
  const kids = [];
  const splash = { style: {}, removed: false, remove() { this.removed = true; }, appendChild(el) { kids.push(el); } };
  const msg = { style: {}, textContent: '로그인 상태 확인 중…' };
  const doc = {
    getElementById: (id) => (id === 'pu-boot-splash' ? (splash.removed ? null : splash) : id === 'pu-boot-msg' ? msg : null),
    createElement: () => ({ style: {}, onclick: null }),
  };
  const c = {
    document: doc, window: {},
    location: { search: opt.kk ? '?code=1&state=2' : '' },
    setTimeout: (fn, ms) => { timers.push({ at: now + ms, fn }); },
  };
  if (!opt.noSdk) c.firebase = { auth() {} };
  vm.createContext(c);
  vm.runInContext(BOOT, c);
  function tick(to) {
    for (;;) {
      timers.sort((x, y) => x.at - y.at);
      const t = timers[0];
      if (!t || t.at > to) break;
      timers.shift(); now = t.at; t.fn();
    }
    now = to;
  }
  return { splash, msg, kids, tick };
}

test('①★ 8초가 지나도 로그인 화면을 드러내지 않는다 — «느리다»고 말하고 단추를 준다', () => {
  const b = boot();
  b.tick(8000);
  assert.equal(b.splash.removed, false, '8초에 가림막을 걷으면 «있는 로그인»을 확인하는 동안 로그인 화면이 드러난다');
  assert.match(b.msg.textContent, /늦어지고/);
  assert.equal(b.kids.length, 1, '기다리기 싫은 사람이 누를 단추가 있어야 한다');
  assert.match(b.kids[0].textContent, /로그인 화면/);
});
test('② 단추를 누르면 곧장 열린다 · 마지막 안전망은 30초보다 길다', () => {
  const b = boot();
  b.tick(8000);
  b.kids[0].onclick();
  assert.equal(b.splash.removed, true);
  const c = boot();
  c.tick(30000);
  assert.equal(c.splash.removed, false, '구글 요청은 30초까지 걸릴 수 있다 — 그 전에 걷으면 또 튕긴다');
  c.tick(60000);
  assert.equal(c.splash.removed, true, '들어올 길은 결국 열린다');
});
test('③ 인증 도구가 안 실렸으면 기다릴 것이 없다 — 8초에 연다', () => {
  const b = boot({ noSdk: true });
  b.tick(8000);
  assert.equal(b.splash.removed, true);
});
test('③ 카카오에서 돌아온 참은 예전대로(20초, 단추 없음)', () => {
  const b = boot({ kk: true });
  b.tick(19000);
  assert.equal(b.splash.removed, false);
  b.tick(20000);
  assert.equal(b.splash.removed, true);
  assert.equal(b.kids.length, 0);
});
test('④ «로그인 없음»이 확정되면 기다리지 않고 곧장 로그인 화면', () => {
  /* onAuthStateChanged 의 «로그인 없음» 갈래 — 미로그인 확정 줄부터 가림막 걷기까지 사이에 기다림이 없어야 한다 */
  const a = enter.indexOf('// 미로그인 확정');
  assert.ok(a > 0, '미로그인 갈래를 못 찾음');
  const b = enter.indexOf('_rmBootSplash();', a);
  assert.ok(b > a && b - a < 1500, '로그인 없음이면 곧장 가림막을 걷는다');
  assert.doesNotMatch(strip(enter.slice(a, b)), /setTimeout|await /, '로그인이 없는 기기를 기다리게 하면 안 된다');
});

test('⑤★ 이알피: 포털 경유 대기는 구글 요청 시간(30초)보다 길다', () => {
  const m = /var to = setTimeout\(function\(\)\{ setSsoWait\(false\); \}, (\d+)\);/.exec(erp);
  assert.ok(m, 'ssoWait 안전망을 못 찾음');
  assert.ok(Number(m[1]) >= 30000, '8초로 두면 폰이 느릴 때 로그인 화면으로 튕긴다');
});
test('⑤★ 이알피: 인증 확인이 끝나기 전에는 자물쇠를 띄우지 않는다', () => {
  const s = strip(erp);
  assert.match(s, /onAuthStateChanged\(function\(user\)\{\s*window\.__puAuthKnown = true;/, '확인이 끝났다는 표시를 «먼저» 남긴다');
  const a = s.indexOf('var _waitFrom = Date.now();');
  assert.ok(a > 0);
  const chunk = s.slice(a, s.indexOf('PuGate.show()', a));
  assert.match(chunk, /!window\.__puAuthKnown && Date\.now\(\) - _waitFrom < (\d+)\)\{ t = setTimeout\(check, \d+\); return; \}/,
    '확인 중(currentUser 비어 있음)을 «로그인 없음»으로 읽으면 자물쇠가 떴다가 저절로 들어간다');
  const lim = Number(/_waitFrom < (\d+)/.exec(chunk)[1]);
  assert.ok(lim >= 30000);
});
