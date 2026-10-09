'use strict';
/* 숨어 있던 탭이 앞으로 나올 때 로그인 화면(노란 카카오 단추)이 번쩍이지 않는다
   (대표 지시 2026-10-09 「앱을 클릭하면 아주 잠깐 카카오톡 로그인 화면이 팝업처럼 나온다 —
    완전히 안 나오게 해라. 모든 앱들에서 계속 한 번씩 나온다」).

   까닭: 로그아웃하면 열린 앱 탭들이 모두 로그인 화면으로 밀려나 뒤에 숨은 채 남는다.
   다시 로그인한 뒤 그 탭이 앞으로 나오면 «예전에 그려 둔» 로그인 화면이 먼저 보이고,
   파이어베이스가 다른 탭의 로그인을 알아챈 뒤에야 포털로 바뀌었다.

   못 박는 것(규칙):
   ① 숨을 때 로그인 화면 위에 가림막을 다시 세운다
   ② 다시 보일 때 그새 로그인이 들어오면 가림막은 포털이 걷는다(로그인 화면이 한 번도 안 보인다)
   ③ 끝내 로그인이 없으면 잠깐 뒤 걷는다(들어올 길은 늘 열린다)
   ④ 입력하던 값이 있거나 · 포털이 떠 있거나 · 카카오 복귀 중이면 가리지 않는다
   ⑤ 숨은 탭에서 «로그인 없음»으로 드러냈으면 곧바로 다시 가린다
   ⑥ 40초 안전망은 숨은 탭에서 걷지 않는다
   ⑦ 그래도 번쩍이면 어느 길이었는지 이 기기에 남긴다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const enter = fs.readFileSync(path.join(__dirname, '..', 'enter.html'), 'utf8').replace(/\r\n/g, '\n');

const GUARD = (() => {
  const a = enter.indexOf('var _loginGuard = (function(){');
  assert.ok(a > 0, '로그인 화면 지킴이를 못 찾음');
  const b = enter.indexOf('\n  })();', a);
  assert.ok(b > a);
  return enter.slice(a, b + 8);
})();

function world(opt) {
  opt = opt || {};
  const els = {};
  const timers = [];
  let now = 0;
  const listeners = { doc: {}, win: {} };
  const store = {};
  function el(id, extra) { return Object.assign({ id, style: {}, value: '' }, extra || {}); }
  els.loginView = el('loginView');
  els.loginId = el('loginId', { value: opt.typed || '' });
  els.loginPw = el('loginPw');
  if (opt.splash) els['pu-boot-splash'] = el('pu-boot-splash', { remove() { delete els['pu-boot-splash']; } });
  const document = {
    hidden: false,
    getElementById: (id) => els[id] || null,
    createElement: () => {
      const e = el('', { setAttribute() {}, remove() { if (els[e.id] === e) delete els[e.id]; } });
      return e;
    },
    body: { appendChild(e) { if (e.id) els[e.id] = e; } },
    addEventListener: (n, fn) => { (listeners.doc[n] = listeners.doc[n] || []).push(fn); },
  };
  const c = {
    document,
    window: {
      __kkReturning: !!opt.kk,
      addEventListener: (n, fn) => { (listeners.win[n] = listeners.win[n] || []).push(fn); },
      matchMedia: () => ({ matches: false }),
    },
    auth: { currentUser: null },
    _handled: !!opt.portal,
    $: (id) => els[id] || null,
    _rmBootSplash() { const s = els['pu-boot-splash']; if (s) s.remove(); },
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
    setTimeout: (fn, ms) => { const t = { at: now + ms, fn }; timers.push(t); return t; },
    clearTimeout: (t) => { const i = timers.indexOf(t); if (i >= 0) timers.splice(i, 1); },
    JSON, Array, Date,
  };
  vm.createContext(c);
  vm.runInContext(GUARD, c);
  function fire(target, name, ev) { (listeners[target][name] || []).forEach((fn) => fn(ev || {})); }
  return {
    c, els, store,
    covered: () => !!els['pu-boot-splash'],
    hide() { document.hidden = true; fire('doc', 'visibilitychange'); },
    show() { document.hidden = false; fire('doc', 'visibilitychange'); },
    tick(ms) {
      const to = now + ms;
      for (;;) {
        timers.sort((x, y) => x.at - y.at);
        const t = timers[0];
        if (!t || t.at > to) break;
        timers.shift(); now = t.at; t.fn();
      }
      now = to;
    },
  };
}

test('①② 숨을 때 가리고, 다시 보일 때 그새 로그인이 들어왔으면 로그인 화면을 한 번도 안 보인다', () => {
  const w = world();
  w.hide();
  assert.equal(w.covered(), true, '숨을 때 로그인 화면 위에 가림막을 세워야 한다 — 안 그러면 앞으로 나올 때 그려 둔 로그인 화면이 먼저 보인다');
  w.show();
  w.tick(500);
  assert.equal(w.covered(), true, '★ 보이자마자 걷으면 다른 탭의 로그인을 알아채기 전이라 로그인 화면이 번쩍인다');
  /* 파이어베이스가 다른 탭의 로그인을 알아챘다 → onAuthStateChanged → enterPortal */
  w.c.auth.currentUser = { email: 'p001@pureun.kr' };
  w.c._handled = true;
  w.c._loginGuard.userSeen();
  w.tick(5000);
  assert.equal(w.covered(), true, '가림막은 포털이 다 그린 뒤 걷는다(enterPortal) — 지킴이가 먼저 걷으면 빈 화면·로그인이 비친다');
});

test('② 다시 볼 때 로그인이 이미 와 있으면(포털 알림이 아직 안 왔어도) 걷지 않는다', () => {
  const w = world();
  w.hide();
  w.show();
  w.c.auth.currentUser = { email: 'p001@pureun.kr' };   // 저장소에서 읽혔지만 onAuthStateChanged 는 아직
  w.tick(2000);
  assert.equal(w.covered(), true, '★ 들어온 사람에게 로그인 화면을 보이면 그것이 바로 «번쩍임»이다');
});

test('③ 끝내 로그인이 없으면 잠깐 뒤 걷는다 — 들어올 길은 늘 열린다', () => {
  const w = world();
  w.hide();
  w.show();
  w.tick(2000);
  assert.equal(w.covered(), false);
});

test('④ 입력하던 값 · 포털 화면 · 카카오 복귀 중에는 가리지 않는다', () => {
  const typed = world({ typed: 'p001' });
  typed.hide();
  assert.equal(typed.covered(), false, '비밀번호를 보러 다른 창에 다녀온 사람을 가리면 안 된다');
  const portal = world({ portal: true });
  portal.hide();
  assert.equal(portal.covered(), false, '포털 위에 가림막을 세우면 돌아왔을 때 2초씩 가려진다');
  const kk = world({ kk: true });
  kk.hide();
  assert.equal(kk.covered(), false, '카카오 복귀 길은 제 가림막을 따로 쥐고 있다');
  const off = world();
  off.els.loginView.style.display = 'none';
  off.hide();
  assert.equal(off.covered(), false, '로그인 화면이 안 떠 있으면 가릴 것이 없다');
});

test('⑤ 숨은 탭에서 «로그인 없음»으로 드러냈으면 곧바로 다시 가린다 (아무도 못 봤다)', () => {
  const w = world({ splash: true });
  w.c.document.hidden = true;
  w.c._rmBootSplash();
  w.c._loginGuard.shown('로그인 없음');
  assert.equal(w.covered(), true);
  const v = world({ splash: true });
  v.c._rmBootSplash();
  v.c._loginGuard.shown('로그인 없음');
  assert.equal(v.covered(), false, '보이는 탭에서 «로그인 없음»이면 곧장 로그인 화면이어야 한다(기다리게 하지 않는다)');
});

test('⑦ 로그인 화면을 드러낸 직후 로그인이 들어오면 «번쩍였다»를 이 기기에 남긴다 — 이름·주소 없이', () => {
  const w = world({ splash: true });
  w.c._rmBootSplash();
  w.c._loginGuard.shown('로그인 없음');
  w.c.auth.currentUser = { email: 'p001@pureun.kr' };
  w.c._loginGuard.userSeen();
  const log = JSON.parse(w.store.pu_login_flash_log || '[]');
  assert.equal(log.length, 1);
  assert.equal(log[0].why, '로그인 없음');
  assert.doesNotMatch(JSON.stringify(log), /@|p001|pureun/i, '기록에 사람을 가리키는 것이 들어가면 안 된다');
  const quiet = world();
  quiet.c._loginGuard.userSeen();
  assert.equal(quiet.store.pu_login_flash_log, undefined, '로그인 화면을 드러낸 적이 없으면 적을 것도 없다');
});

test('훅: 로그인 들어옴·로그인 없음 갈래가 지킴이를 부른다', () => {
  const a = enter.indexOf('auth.onAuthStateChanged(function(user){');
  const area = enter.slice(a, enter.indexOf('// ── 로그인 실행 ──', a));
  // 같은 사람 복원·다른 사람 전환을 먼저 가려도, 포털을 드러내기 전 지킴이에 알려야 한다.
  assert.match(area, /if\(user && user\.email\)\{[\s\S]*?_loginGuard\.userSeen\(\)[\s\S]*?enterPortal\(user\)/,
    '포털을 드러내기 전에 로그인 화면 지킴이에 알려야 한다');
  assert.match(area, /_rmBootSplash\(\);\s*try \{ if\(!window\.__kkReturning\) _loginGuard\.shown\(/, '로그인 화면을 드러낸 직후 알린다');
});

/* ⑥ 부팅 스크립트의 40초 안전망 — 가짜 시계로 돌린다 */
test('⑥ 40초 안전망은 숨은 탭에서 걷지 않고, 보이면 그때 걷는다', () => {
  const a = enter.indexOf("(function(){\n  var s=document.getElementById('pu-boot-splash');");
  assert.ok(a > 0);
  const BOOT = enter.slice(a, enter.indexOf('})();', a) + 5);
  const timers = [];
  let now = 0;
  const splash = { style: {}, removed: false, remove() { this.removed = true; }, appendChild() {} };
  const doc = {
    hidden: true,
    getElementById: (id) => (id === 'pu-boot-splash' ? (splash.removed ? null : splash) : id === 'pu-boot-msg' ? { style: {} } : null),
    createElement: () => ({ style: {} }),
  };
  const c = { document: doc, window: {}, location: { search: '' }, firebase: { auth() {} },
    setTimeout: (fn, ms) => { timers.push({ at: now + ms, fn }); } };
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
  tick(90000);
  assert.equal(splash.removed, false, '★ 숨은 탭에서 걷으면 그 탭이 앞으로 나올 때 로그인 화면이 번쩍인다');
  doc.hidden = false;
  tick(95000);
  assert.equal(splash.removed, true, '보이면 그때 걷는다 — 갇히지 않는다');
});
