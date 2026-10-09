'use strict';
/* 인증 복원 중 잠깐 비는 알림을 실제 로그아웃과 구별한다. 화면은 즉시 가리고,
   같은 사람이 돌아오면 그대로 두되 진짜 로그아웃은 로그인 화면으로 보낸다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'enter.html'), 'utf8');
const marker = 'auth.onAuthStateChanged(function(user){';
const start = source.indexOf(marker);
const end = source.indexOf('\n    });', start);
assert.ok(start > 0 && end > start, '포털 인증 관찰자를 찾지 못했습니다');
const callback = source.slice(start + 'auth.onAuthStateChanged('.length, end) + '\n    }';

function boot(logoutAt) {
  let nextId = 0;
  const timers = new Map();
  const events = [];
  const user = { uid: 'U1', email: 'p001@pureun.kr' };
  const ctx = {
    window: { _puAuthAt: 100, __kkReturning: false },
    auth: { currentUser: user },
    _handled: true, _portalUid: 'U1', _portalReady: true, _authRecheckTimer: null,
    _loginGuard: { cover() { events.push('cover'); }, userSeen() { events.push('seen'); }, shown() {} },
    _rmBootSplash() { events.push('uncover'); },
    enterPortal() { events.push('enter'); },
    sessionStorage: { setItem() {}, removeItem() {} },
    localStorage: { getItem() { return logoutAt == null ? null : String(logoutAt); }, setItem() {}, removeItem() {} },
    location: { pathname: '/enter.html', replace() { events.push('replace'); }, reload() { events.push('reload'); } },
    setTimeout(fn, delay) { const id = ++nextId; timers.set(id, { fn, delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
    Date: class extends Date { static now() { return 101; } },
  };
  ctx.$ = () => null;
  vm.createContext(ctx);
  vm.runInContext('window.authChanged = ' + callback + ';', ctx);
  return { ctx, user, events, timers, fire: (u) => ctx.window.authChanged(u), run() { for (const [id, t] of [...timers]) { timers.delete(id); t.fn(); } } };
}

test('같은 사람의 인증이 잠깐 비었다 돌아오면 로그인 화면으로 보내지 않는다', () => {
  const b = boot();
  b.ctx.auth.currentUser = null;
  b.fire(null);
  assert.deepEqual(b.events, ['cover']);
  assert.equal([...b.timers.values()][0].delay, 2500);
  b.ctx.auth.currentUser = b.user;
  b.fire(b.user);
  b.run();
  assert.ok(b.events.includes('uncover'));
  assert.ok(!b.events.includes('replace'));
  assert.ok(!b.events.includes('enter'), '포털을 중복으로 열면 안 됩니다');
});

test('인증이 돌아오지 않으면 기존 사람 화면을 가린 채 새 로그인으로 보낸다', () => {
  const b = boot();
  b.ctx.auth.currentUser = null;
  b.fire(null);
  b.run();
  assert.deepEqual(b.events, ['cover', 'replace']);
});

test('명시적인 로그아웃과 다른 사람 로그인은 지체 없이 이전 화면을 닫는다', () => {
  const out = boot(101);
  out.ctx.auth.currentUser = null;
  out.fire(null);
  assert.equal([...out.timers.values()][0].delay, 0);
  out.run();
  assert.ok(out.events.includes('replace'));

  const switched = boot();
  switched.fire({ uid: 'U2', email: 'p002@pureun.kr' });
  assert.deepEqual(switched.events, ['cover', 'replace']);
});

test('포털이 다 그려지기 전 인증 알림은 가림막을 걷지 않는다', () => {
  const b = boot();
  b.ctx._portalReady = false;
  b.fire(b.user);
  assert.ok(!b.events.includes('uncover'));
  const enter = source.slice(source.indexOf('function enterPortal(user){'), source.indexOf('  // ── 프로그램 창 관리자'));
  assert.match(enter, /renderPortal\([\s\S]*_portalReady = true;[\s\S]*_rmBootSplash\(\)/);
});
