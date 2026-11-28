'use strict';
/* 로그인 멈춤 · 반복 새로고침 · 상단 부팅폭풍 빨간 띠 오탐 근본 해결 회귀 테스트
   실제 VM 실행 + 주석 제거 정적 검증으로 모든 방어선을 확인한다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('vm');
const { cutFn } = require('./cut-fn');
const { stripComments, stripJs } = require('./strip-comments');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n/g, '\n');

const ENTER = read('enter.html');
const ENTER_CODE = stripComments(ENTER);
const AUTHSYNC = read('js/pu-authsync.js');
const VERSION = read('js/pu-version.js');

function cutBlock(src, startMarker, endMarker) {
  const a = src.indexOf(startMarker);
  assert.ok(a >= 0, '시작 표식을 찾지 못했습니다: ' + startMarker);
  const b = src.indexOf(endMarker, a);
  assert.ok(b > a, '끝 표식을 찾지 못했습니다: ' + endMarker);
  return src.slice(a, b + endMarker.length);
}

test('① _loginGuard.cover() 는 #pu-boot-msg 와 8초 탈출 버튼(#pu-boot-skip)을 만들고 show() 는 포털 준비 시 교착을 푼다', () => {
  const GUARD = cutBlock(ENTER, 'var _loginGuard = (function(){', '\n  })();');
  const timers = [];
  let now = 1000, nextId = 0, forcedOpen = 0, removed = 0;
  const listeners = { doc: {}, win: {} };
  const els = { loginView: { id: 'loginView', style: {}, value: '' }, loginId: { value: '' }, loginPw: { value: '' } };
  function makeEl() {
    const o = {
      id: '', style: {}, kids: [], textContent: '', onclick: null, type: '',
      setAttribute() {},
      appendChild(c) { this.kids.push(c); if (c.id) els[c.id] = c; return c; },
      remove() {
        removed++;
        delete els[this.id];
        this.kids.forEach((k) => { if (k.id) delete els[k.id]; });
      },
      set innerHTML(html) {
        this._html = html;
        if (/id="pu-boot-msg"/.test(html)) {
          const msgEl = makeEl();
          msgEl.id = 'pu-boot-msg';
          msgEl.textContent = '로그인 상태 확인 중…';
          els['pu-boot-msg'] = msgEl;
        }
      },
    };
    return o;
  }
  const c = {
    document: {
      hidden: false,
      getElementById: (id) => els[id] || null,
      createElement: makeEl,
      body: { appendChild(e) { if (e.id) els[e.id] = e; } },
      addEventListener: (n, fn) => { (listeners.doc[n] = listeners.doc[n] || []).push(fn); },
    },
    window: {
      __kkReturning: false,
      __puForceShowLogin: () => { forcedOpen++; c._rmBootSplash(); },
      addEventListener: (n, fn) => { (listeners.win[n] = listeners.win[n] || []).push(fn); },
      matchMedia: () => ({ matches: false }),
    },
    auth: { currentUser: { email: 'p001@pureun.kr' } },
    _handled: true,
    _portalReady: true,
    $: (id) => els[id] || null,
    _rmBootSplash() { if (els['pu-boot-splash']) els['pu-boot-splash'].remove(); },
    localStorage: { getItem: () => null, setItem() {} },
    setTimeout(fn, ms) { const id = ++nextId; timers.push({ id, at: now + ms, fn }); return id; },
    clearTimeout(id) { const i = timers.findIndex((t) => t.id === id); if (i >= 0) timers.splice(i, 1); },
    JSON, Array, Date: { now: () => now },
  };
  vm.createContext(c);
  vm.runInContext(GUARD, c);

  function tick(ms) {
    const to = now + ms;
    for (;;) {
      timers.sort((a, b) => a.at - b.at);
      const t = timers[0];
      if (!t || t.at > to) break;
      timers.shift();
      now = t.at;
      t.fn();
    }
    now = to;
  }

  // (a) cover() 후 8초가 지나면 메시지가 바뀌고 탈출 버튼이 생겨야 한다
  c._loginGuard.cover();
  assert.ok(els['pu-boot-msg'], '재가림막에도 #pu-boot-msg 가 있어야 한다');
  tick(8000);
  assert.ok(els['pu-boot-skip'], '8초 후 탈출 버튼(#pu-boot-skip)이 생성돼야 한다');
  assert.match(els['pu-boot-msg'].textContent, /늦어지고/);
  els['pu-boot-skip'].onclick();
  assert.equal(forcedOpen, 1, '탈출 버튼 클릭 시 강제 로그인 복귀가 실행돼야 한다');
  assert.equal(els['pu-boot-splash'], undefined);

  // (b) 포털이 이미 준비된(_handled && _portalReady) 상태에서 재가림막 후 다시 보이면 영구 교착 없이 걷혀야 한다
  c._loginGuard.cover();
  assert.ok(els['pu-boot-splash']);
  c._loginGuard._show();
  tick(2000);
  assert.equal(els['pu-boot-splash'], undefined, '_handled && _portalReady 인데 가림막이 걷히지 않았다(영구 교착)');
  assert.ok(removed >= 2);
});

test('② enterPortal() 은 renderPortal 중 예외가 나도 finally 에서 가림막과 진입 잠금을 해제한다', async () => {
  const fnSrc = cutFn(ENTER_CODE, 'function enterPortal(user, verifiedProfile)');
  let splashRemoved = 0;
  const portalView = { style: { display: 'none' } };
  const loginView = { style: { display: 'block' } };
  const ctx = {
    window: { __puPortalEntering: false, __puLoginNavAt: Date.now() },
    document: { body: { classList: { add() {} } } },
    auth: { currentUser: { uid: 'U1', email: 'p001@pureun.kr' } },
    db: { ref: () => ({ once: () => Promise.resolve({ val: () => [] }) }) },
    localStorage: { getItem: () => null, removeItem() {} },
    sessionStorage: { getItem: () => null, setItem() {} },
    _handled: true,
    _portalUid: '',
    _portalReady: false,
    _freshLogin: false,
    _returnToApp: () => false,
    puPlayReviewerAcct: () => null,
    sidToEmail: (s) => String(s || '').toLowerCase().replace(/-/g, '') + '@pureun.kr',
    puDirMatch: () => ({ acct: { sid: 'P-001', name: '테스트', role: 'member', status: 'active' }, all: [] }),
    renderPortal: () => { throw new Error('boom in renderPortal'); },
    armKakaoPortalHistory: () => {},
    puLoginTimingSave: () => {},
    _rmBootSplash: () => { splashRemoved++; },
    $: (id) => (id === 'portalView' ? portalView : id === 'loginView' ? loginView : null),
    console: { error() {} },
    setTimeout, clearTimeout, Promise, JSON, Date, Math, Object, Array, String, Number,
  };
  vm.createContext(ctx);
  vm.runInContext(fnSrc, ctx);
  ctx.enterPortal({ uid: 'U1', email: 'p001@pureun.kr' }, { acct: { sid: 'P-001', name: '테스트', role: 'member', status: 'active' }, all: [] });
  await new Promise((r) => setImmediate(r));
  assert.equal(splashRemoved, 1, 'renderPortal 이 실패해도 가림막은 반드시 걷혀야 한다');
  assert.equal(ctx.window.__puPortalEntering, false, '진입 잠금(__puPortalEntering)이 풀리지 않았다');
  assert.equal(ctx._portalReady, true);
});

test('③ _instantReturnFromApp 미확정 복원 중 null 은 3초 내 복구되고, 확정 세션은 AUTH_RECOVERY_MS 를 유지하며 pu_auth_uid 를 동기화한다', () => {
  const obsSrc = cutBlock(ENTER, 'auth.onAuthStateChanged(function(user){', '\n  });');
  const callback = obsSrc.slice('auth.onAuthStateChanged('.length, obsSrc.lastIndexOf('});')) + '}';
  function runObs(opts) {
    const timers = [];
    const local = {};
    const events = [];
    const ctx = {
      window: {
        _puAuthAt: 100,
        __kkReturning: false,
        _fastRestored: !!opts.fastRestored,
        __puAuthConfirmedUid: opts.confirmedUid || '',
        __puForceShowLogin: () => { events.push('forceShowLogin'); },
      },
      auth: { currentUser: opts.currentUser || null },
      _handled: !!opts.handled,
      _portalUid: opts.portalUid || 'U1',
      _portalReady: true,
      _authRecheckTimer: null,
      _kkLoginStarting: false,
      AUTH_RECOVERY_MS: 15000,
      _loginGuard: { cover() { events.push('cover'); }, userSeen() {}, shown() {} },
      _rmBootSplash() { events.push('uncover'); },
      _markSelfAuthNav() { events.push('markSelf'); },
      enterPortal() { events.push('enter'); },
      sessionStorage: { setItem() {}, removeItem() {} },
      localStorage: {
        getItem: (k) => (k in local ? local[k] : null),
        setItem: (k, v) => { local[k] = String(v); },
        removeItem: (k) => { delete local[k]; },
      },
      location: { pathname: '/enter.html', replace(u) { events.push('replace:' + u); }, reload() { events.push('reload'); } },
      setTimeout(fn, ms) { const t = { fn, ms }; timers.push(t); return t; },
      clearTimeout() {},
      $: () => null,
      Date: class extends Date { static now() { return 200; } },
    };
    vm.createContext(ctx);
    vm.runInContext('window._cb = ' + callback + ';', ctx);
    return { ctx, local, timers, events };
  }

  // (a) 로그인 확정 시 localStorage.pu_auth_uid 기록
  const rOk = runObs({ handled: false });
  rOk.ctx.window._cb({ uid: 'U99', email: 'p099@pureun.kr' });
  assert.equal(rOk.local.pu_auth_uid, 'U99', '포털 로그인 확정 시 pu_auth_uid 를 기록해야 한다');
  assert.equal(rOk.ctx.window.__puAuthConfirmedUid, 'U99');

  // (b) 미확정 빠른 복원 상태에서 null 도착 → 5초 이하 짧은 유예 후 새로고침 없이 __puForceShowLogin 복귀
  const rFast = runObs({ handled: true, fastRestored: true, confirmedUid: '' });
  rFast.ctx.window._cb(null);
  assert.equal(rFast.timers.length, 1);
  assert.ok(rFast.timers[0].ms <= 5000, '미확정 빠른 복원이 15초 동안 멈추면 안 된다: ' + rFast.timers[0].ms);
  rFast.timers[0].fn();
  assert.ok(rFast.events.includes('forceShowLogin'));
  assert.ok(!rFast.events.some((e) => e.startsWith('replace:')), '미확정 복원 해제는 강제 새로고침을 일으키지 않아야 한다');

  // (c) 실제 확정 세션에서 null 도착 → AUTH_RECOVERY_MS(15초) 대기 후 _markSelfAuthNav + replace
  const rReal = runObs({ handled: true, fastRestored: false, confirmedUid: 'U1' });
  rReal.ctx.window._cb(null);
  assert.equal(rReal.timers[0].ms, 15000);
  rReal.timers[0].fn();
  assert.ok(rReal.events.includes('markSelf'), '리다이렉트 전 내부 인증 이동 표식을 남겨야 한다');
  assert.ok(rReal.events.some((e) => e.startsWith('replace:')));
});

test('④ doLogin() 은 이미 LOCAL 이면 중복 setPersistence 를 건너뛰고, 15초 후 강제 새로고침 대신 버튼만 복구하며 persistence 실패는 여전히 막는다', async () => {
  const fnSrc = cutFn(ENTER_CODE, 'function doLogin()');
  const preSrc = 'var _loginReqSeq = 0;\n' + fnSrc;
  function runLogin(opts) {
    const timers = [];
    const calls = [];
    const errors = [];
    const btn = { disabled: false };
    const local = Object.assign({}, opts.local || {});
    const ctx = {
      $: (id) => {
        if (id === 'loginId') return { value: 'p001' };
        if (id === 'loginPw') return { value: 'secret1234' };
        if (id === 'loginBtn') return btn;
        if (id === 'autoLogin') return { checked: opts.keep !== false };
        if (id === 'saveId') return { checked: false };
        return null;
      },
      sidToEmail: (s) => s + '@pureun.kr',
      showErr: (m) => { if (m) errors.push(m); },
      firebase: { auth: { Auth: { Persistence: { LOCAL: 'local', SESSION: 'session' } } } },
      auth: {
        currentUser: opts.currentUser || null,
        setPersistence: (m) => { calls.push('persist:' + m); return opts.persistFn ? opts.persistFn(m) : Promise.resolve(); },
        signInWithEmailAndPassword: (e, p) => { calls.push('signIn:' + e); return opts.signInFn ? opts.signInFn(e, p) : Promise.resolve({ user: { uid: 'U1', email: e, getIdToken: () => Promise.resolve('T') } }); },
      },
      localStorage: { getItem: (k) => (k in local ? local[k] : null), setItem: (k, v) => { local[k] = String(v); }, removeItem: (k) => { delete local[k]; } },
      location: { pathname: '/enter.html', replace() { calls.push('replace'); }, reload() { calls.push('reload'); } },
      reportLogin() {},
      enterPortal() { calls.push('enterPortal'); },
      _freshLogin: false, _handled: false,
      window: {}, navigator: {},
      setTimeout(fn, ms) { const t = { fn, ms }; timers.push(t); return t; },
      clearTimeout() {},
      Promise, Date, Error,
    };
    vm.createContext(ctx);
    vm.runInContext(preSrc, ctx);
    ctx.doLogin();
    return { ctx, btn, calls, errors, timers, local };
  }

  // (a) 이미 local 이면 중복 setPersistence 를 부르지 않고 바로 로그인
  const rSkip = runLogin({ local: { pu_portal_persistence_applied: 'local' } });
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));
  assert.ok(!rSkip.calls.some((c) => c.startsWith('persist:')), '이미 LOCAL 인데 중복 setPersistence 를 호출했다');
  assert.ok(rSkip.calls.includes('enterPortal'));
  assert.equal(rSkip.local.pu_auth_uid, 'U1');

  // (b) 응답 지연 시 강제 새로고침 없이 버튼만 복구
  const rHang = runLogin({
    local: { pu_portal_persistence_applied: 'local' },
    signInFn: () => new Promise(() => {}),
  });
  await new Promise((r) => setImmediate(r));
  assert.equal(rHang.btn.disabled, true);
  const wd = rHang.timers.find((t) => t.ms >= 10000);
  assert.ok(wd, '응답 감시 타이머가 있어야 한다');
  wd.fn();
  assert.equal(rHang.btn.disabled, false, '응답 지연 시 로그인 버튼이 풀려야 한다');
  assert.ok(!rHang.calls.includes('replace') && !rHang.calls.includes('reload'), '응답 지연으로 페이지를 강제 새로고침하면 안 된다');
  assert.ok(rHang.errors.some((e) => /지연/.test(e)));

  // (c) setPersistence 실패 시 signIn 을 실행하지 않고 에러를 표시
  const rFail = runLogin({
    keep: false,
    persistFn: () => Promise.reject(new Error('idb blocked')),
  });
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));
  assert.ok(!rFail.calls.some((c) => c.startsWith('signIn:')), '저장소 설정 실패 시 로그인을 강행하면 안 된다');
  assert.equal(rFail.btn.disabled, false);
  assert.ok(rFail.errors.length >= 1);
});

test('⑤ kkHandleReturn() 에 persist·signInWithCustomToken 타임아웃과 비-bfcache 복귀 시 카카오 버튼 복구가 있다', async () => {
  const fnSrc = cutFn(ENTER_CODE, 'function kkHandleReturn()');
  assert.match(fnSrc, /setTimeout\([\s\S]*?로그인 저장소 응답이 지연/, '카카오 persist 타임아웃이 없다');
  assert.match(fnSrc, /setTimeout\([\s\S]*?로그인 마무리 응답이 지연/, '카카오 signInWithCustomToken 타임아웃이 없다');
  assert.match(ENTER_CODE, /document\.addEventListener\('visibilitychange'[\s\S]*?_kkLoginStarting[\s\S]*?kkResetBtn\(\)/,
    '카카오 화면에서 일반 복귀 시 비활성 버튼 복구가 없다');

  // 실제 VM 에서 signInWithCustomToken 이 멎었을 때 타임아웃으로 가림막이 걷히고 오류를 보이는지 확인
  const timers = [];
  let splashedRemoved = 0, unfolded = 0;
  const shownErrs = [];
  const ctx = {
    window: { __kkReturning: true, PuKakao: { pending: () => ({ mode: 'login', code: 'C1' }), loginFinish: () => Promise.resolve('CT') } },
    PuKakao: null,
    db: { ref: () => ({ once: () => Promise.resolve() }) },
    firebase: { auth: { Auth: { Persistence: { LOCAL: 'local', SESSION: 'session' } } } },
    auth: { setPersistence: () => Promise.resolve(), signInWithCustomToken: () => new Promise(() => {}) },
    localStorage: { getItem: () => '1', setItem() {}, removeItem() {} },
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: { hidden: false },
    showErr: (m) => { if (m) shownErrs.push(m); },
    kkEndReturn: () => { ctx.window.__kkReturning = false; splashedRemoved++; },
    kkUnfoldPw: () => { unfolded++; },
    _freshLogin: false, _handled: false,
    setTimeout(fn, ms) { const t = { fn, ms }; timers.push(t); return t; },
    clearTimeout() {},
    Promise, Date, Error,
  };
  ctx.PuKakao = ctx.window.PuKakao;
  vm.createContext(ctx);
  vm.runInContext(fnSrc, ctx);
  ctx.kkHandleReturn();
  for (let i = 0; i < 6; i++) await new Promise((r) => setImmediate(r));
  const signInTimeout = timers.find((t) => t.ms >= 20000);
  assert.ok(signInTimeout, 'signInWithCustomToken 타임아웃이 등록돼야 한다');
  signInTimeout.fn();
  for (let i = 0; i < 6; i++) await new Promise((r) => setImmediate(r));
  assert.equal(splashedRemoved, 1, 'signInWithCustomToken 타임아웃 시 가림막이 걷혀야 한다');
  assert.equal(unfolded, 1, '실패 시 비밀번호 로그인 칸을 펼쳐야 한다');
  assert.ok(shownErrs.some((e) => /지연/.test(e)));
});

test('⑥ pu-authsync.js 는 PC 부팅 유예가 10초 이상이고, 유저 도착 시 대기 중인 nullTimer 를 취소한다', () => {
  const timers = [];
  let now = 1000, nextId = 0;
  const local = { pu_auth_uid: 'U1' };
  const g = {
    navigator: { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0' },
    firebase: { auth: () => ({ currentUser: g._u || null, onAuthStateChanged() {} }) },
    localStorage: { getItem: (k) => (k in local ? local[k] : null), setItem: (k, v) => { local[k] = String(v); }, removeItem: (k) => { delete local[k]; } },
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: { createElement: () => ({ style: {} }), body: { appendChild() {} } },
    location: { replace() {}, reload() {} },
    addEventListener() {},
    setTimeout(fn, ms) { const id = ++nextId; timers.push({ id, at: now + ms, fn, ms }); return id; },
    clearTimeout(id) { const i = timers.findIndex((t) => t.id === id); if (i >= 0) timers.splice(i, 1); },
    setInterval: () => 1, clearInterval() {},
    Date, String, Object, console,
  };
  g.window = g;
  vm.createContext(g);
  vm.runInContext(AUTHSYNC, g);

  g.PuAuthSync._onAuth(null);
  assert.equal(timers.length, 1);
  assert.ok(timers[0].ms >= 10000, 'PC 부팅 직후 유예가 너무 짧아 다중 탭 복원에서 조기 튕김이 발생한다: ' + timers[0].ms);

  // 4초 뒤 유저가 복원되면 nullTimer 가 취소돼 이후 12초가 지나도 튕기지 않아야 한다
  g._u = { uid: 'U1', isAnonymous: false };
  g.PuAuthSync._onAuth(g._u);
  assert.equal(timers.length, 0, '유저 복원 시 대기 중인 nullTimer 를 즉시 취소해야 한다');
  assert.equal(g.PuAuthSync._wasKicked(), false);
});

test('⑦ 4개 앱(이알피·기업정보함·정부사업일정·규정관리)의 doAutoLogout() 이 모두 broadcastLogout 을 호출한다', () => {
  ['pu-erp.html', 'pu-cards.html', 'gov-consulting.html', 'rules.html'].forEach((file) => {
    const fn = stripJs(cutFn(read(file), 'function doAutoLogout()'));
    assert.match(fn, /PuAuthSync\.broadcastLogout\(\)/, file + ' 의 doAutoLogout 이 전체 로그아웃 신호(broadcastLogout)를 보내지 않습니다');
    assert.match(fn, /pu_boot_self_nav/, file + ' 의 doAutoLogout 이 내부 인증 이동 표식을 남기지 않습니다');
  });
});

test('⑧ pu-version.js 는 내부 인증 이동 반복 시 외부 확장을 탓하지 않고 복구 배너를 띄우며, 1~2개 탭 반복은 새 탭으로 오진하지 않는다', () => {
  function runBootSeries(optsList) {
    const local = {};
    const sharedSess = optsList[0] && optsList[0].shareSession ? {} : null;
    let last = null;
    optsList.forEach((opt) => {
      const sess = sharedSess || opt.sess || {};
      const logs = { info: [], warn: [] };
      const body = { kids: [], appendChild(c) { this.kids.push(c); return c; } };
      function el(tag) {
        return {
          tagName: tag, style: {}, kids: [], attrs: {}, textContent: '', id: '', tabIndex: 0,
          appendChild(c) { this.kids.push(c); return c; },
          setAttribute(k, v) { this.attrs[k] = v; },
          addEventListener(ev, fn) { (this._ev = this._ev || {})[ev] = fn; },
          parentNode: null,
        };
      }
      const win = {
        document: {
          readyState: 'complete', body, referrer: '',
          createElement: el,
          getElementById: (id) => body.kids.find((k) => k.id === id) || null,
          querySelector: () => null, scripts: [], addEventListener() {},
        },
        sessionStorage: {
          getItem: (k) => (k in sess ? sess[k] : null),
          setItem: (k, v) => { sess[k] = String(v); },
          removeItem: (k) => { delete sess[k]; },
        },
        localStorage: {
          getItem: (k) => (k in local ? local[k] : null),
          setItem: (k, v) => { local[k] = String(v); },
          removeItem: (k) => { delete local[k]; },
        },
        location: {
          href: opt.href || 'https://erp.pureunlabor.co.kr/enter.html',
          origin: 'https://erp.pureunlabor.co.kr',
          pathname: '/enter.html',
          search: opt.search || '',
          replace(u) { last._replaced = u; },
        },
        performance: { getEntriesByType: () => [{ type: opt.navType || 'navigate' }] },
        console: { info: (m) => logs.info.push(m), warn: (m) => logs.warn.push(m), log() {}, error() {} },
        setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, addEventListener() {},
        fetch: () => Promise.reject(new Error('no')),
        URL, JSON, Math, Array, String, Number, Object, Promise, Error, RegExp, Infinity,
        Date: Object.assign(function () { return new Date(opt.now); }, { now: () => opt.now }),
      };
      win.window = win;
      vm.createContext(win);
      vm.runInContext(VERSION, win);
      last = { win, logs, local, banner: body.kids.find((k) => k.id === 'pu-boot-storm') || null, _replaced: null };
    });
    return last;
  }

  // (a) 내부 인증 리다이렉트(enter.html?v=<13자리> 또는 pu_boot_self_nav) 5회 반복 → 외부 확장 탓 금지 + 복구 배너
  const selfSeries = [0, 12, 24, 36, 48].map((s) => ({
    now: 1795856000000 + s * 1000,
    navType: 'navigate',
    search: '?v=' + (1795856000000 + s * 1000),
  }));
  const resSelf = runBootSeries(selfSeries);
  assert.equal(resSelf.win.PU_BOOT.storm, true);
  assert.equal(resSelf.win.PU_BOOT.selfAuthLoop, true, '내부 인증 리다이렉트 반복을 selfAuthLoop 로 분류해야 한다');
  assert.ok(resSelf.banner, '복구 배너가 표시돼야 한다');
  const msg = resSelf.banner.kids[0].textContent;
  assert.doesNotMatch(msg, /사람이 누르면 이렇게 고르게 못 누릅니다/, '내부 인증 반복인데 외부 확장/사람 탓 경고를 띄우면 안 된다');
  assert.match(msg, /브라우저 확장 문제가 아니라/, '외부 확장 문제가 아님을 안내해야 한다');
  const rstBtn = resSelf.banner.kids.find((k) => k.textContent === '로그인 화면 초기화');
  assert.ok(rstBtn, '로그인 화면 초기화 버튼이 있어야 한다');
  rstBtn._ev.click();
  assert.equal(resSelf.local.pu_boot_dev_v1, undefined, '초기화 클릭 시 기기 부팅 기록이 비워져야 한다');
  assert.equal(resSelf.local.pu_boot_meta_v1, undefined, '초기화 클릭 시 부팅 메타 기록이 비워져야 한다');
  assert.equal(resSelf._replaced, '/enter.html', '초기화 클릭 시 포털 진입 경로로 다시 열려야 한다');

  // (b) 1개 탭이 4번 리로드한 뒤 새 탭을 1번 열어 devStorm 이 됐을 때 '매번 새 탭으로 열림' 오진 금지
  const tabA = {};
  const tabB = {};
  const mixed = [
    { now: 5000000, navType: 'reload', sess: tabA },
    { now: 5012000, navType: 'reload', sess: tabA },
    { now: 5024000, navType: 'reload', sess: tabA },
    { now: 5036000, navType: 'reload', sess: tabA },
    { now: 5048000, navType: 'navigate', sess: tabB },
  ];
  const resMixed = runBootSeries(mixed);
  assert.equal(resMixed.win.PU_BOOT.storm, true);
  assert.equal(resMixed.win.PU_BOOT.selfAuthLoop, false);
  assert.doesNotMatch(resMixed.banner.kids[0].textContent, /매번 새 탭으로 열림/, '2개 탭뿐인데 매번 새 탭으로 열렸다고 오진하면 안 된다');
});
