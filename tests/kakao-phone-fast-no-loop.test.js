'use strict';
/* 모바일(폰) 카카오 로그인 지연·무한 대기·창 반복 방지 검증
   node --test tests/kakao-phone-fast-no-loop.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const kakaoClientSrc = fs.readFileSync(path.join(ROOT, 'js', 'pu-kakao.js'), 'utf8');
const kakaoServerSrc = fs.readFileSync(path.join(ROOT, 'functions', 'kakao.js'), 'utf8');
const authsyncSrc = fs.readFileSync(path.join(ROOT, 'js', 'pu-authsync.js'), 'utf8');
const enterSrc = fs.readFileSync(path.join(ROOT, 'enter.html'), 'utf8');

function shapedState(mode = 'login', nonceChar = 'A') {
  return mode + '.1700000000000.' + nonceChar.repeat(32) + '.' + 'B'.repeat(43);
}

function createStorage(init = {}) {
  const map = Object.assign({}, init);
  return {
    _map: map,
    getItem(k) { return Object.prototype.hasOwnProperty.call(map, k) ? map[k] : null; },
    setItem(k, v) { map[k] = String(v); },
    removeItem(k) { delete map[k]; },
  };
}

function loadClient(opts = {}) {
  const calls = [];
  const sessionStorage = createStorage(opts.session || {});
  const localStorage = createStorage(opts.local || {});
  const ctx = {
    window: null,
    sessionStorage,
    localStorage,
    location: { href: opts.href || 'https://erp.pureunlabor.co.kr/enter.html' },
    history: { replaceState() {} },
    Date, JSON, Promise, URL, setTimeout, clearTimeout,
    fetch: opts.fetch || ((url, o) => {
      calls.push({ url, o });
      if (String(url).includes('kakaoAuthUrl')) {
        return Promise.resolve({
          status: 200,
          text: () => Promise.resolve(JSON.stringify({
            ok: true,
            url: 'https://kauth.kakao.com/oauth/authorize?client_id=test',
            state: opts.state || shapedState('login'),
          })),
        });
      }
      return Promise.resolve({ status: 204, text: () => Promise.resolve('') });
    }),
  };
  if (opts.early) ctx.__puKakaoEarlyLogin = opts.early;
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(kakaoClientSrc, ctx);
  return { K: ctx.PuKakao, calls, ctx, sessionStorage, localStorage };
}

test('① prefetchLogin 으로 주소를 미리 받아두면 goLogin 클릭 시 kakaoAuthUrl 재호출 없이 즉시 이동한다', async () => {
  const state = shapedState('login', 'P');
  const { K, calls, ctx } = loadClient({ state });
  const pre = await K.prefetchLogin({ ask: false });
  assert.ok(pre && pre.state === state);
  assert.equal(calls.filter(c => c.url.includes('kakaoAuthUrl')).length, 1);

  await K.goLogin({ ask: false });
  // 캐시 소비로 kakaoAuthUrl 은 추가 호출되지 않아야 한다
  assert.equal(calls.filter(c => c.url.includes('kakaoAuthUrl')).length, 1);
  assert.equal(ctx.location.href, 'https://kauth.kakao.com/oauth/authorize?client_id=test');
});

test('② 모바일 PWA·앱 전환으로 sessionStorage 가 비어도 localStorage 10분 백업으로 복귀 성공한다', () => {
  const state = shapedState('login', 'M');
  const bak = JSON.stringify({ mode: 'login', sid: '', nonce: state, at: Date.now() - 5000 });
  const { K, localStorage } = loadClient({
    href: 'https://erp.pureunlabor.co.kr/enter.html?code=CODE1&state=' + encodeURIComponent(state),
    session: {},
    local: { pu_kakao_state_bak: bak },
  });
  const p = K.pending();
  assert.deepEqual(Object.assign({}, p), { code: 'CODE1', mode: 'login', sid: '' });
  assert.equal(localStorage.getItem('pu_kakao_state_bak'), null, '복귀 후 백업은 즉시 삭제해야 한다');
});

test('②-2 localStorage 백업이 10분 만료됐거나 nonce 가 다르면 거절한다', () => {
  const state = shapedState('login', 'X');
  const expired = JSON.stringify({ mode: 'login', sid: '', nonce: state, at: Date.now() - 11 * 60 * 1000 });
  const r1 = loadClient({
    href: 'https://erp.pureunlabor.co.kr/enter.html?code=CODE1&state=' + encodeURIComponent(state),
    local: { pu_kakao_state_bak: expired },
  }).K.pending();
  assert.ok(r1.error, '만료된 백업은 거절해야 한다');

  const wrongNonce = JSON.stringify({ mode: 'login', sid: '', nonce: shapedState('login', 'Y'), at: Date.now() });
  const r2 = loadClient({
    href: 'https://erp.pureunlabor.co.kr/enter.html?code=CODE1&state=' + encodeURIComponent(state),
    local: { pu_kakao_state_bak: wrongNonce },
  }).K.pending();
  assert.ok(r2.error, 'nonce 가 다른 백업은 거절해야 한다');
});

test('③ <head> 선제 발사(__puKakaoEarlyLogin)가 있으면 loginFinish 가 중복 POST 없이 결과를 소비한다', async () => {
  const state = shapedState('login', 'E');
  const early = {
    code: 'CODE_EARLY',
    state,
    promise: Promise.resolve({
      status: 200,
      text: JSON.stringify({ ok: true, token: 'CT:early', profile: { acct: { sid: 'P001' }, all: [] } }),
    }),
  };
  const { K, calls, ctx } = loadClient({
    href: 'https://erp.pureunlabor.co.kr/enter.html?code=CODE_EARLY&state=' + encodeURIComponent(state),
    session: { pu_kakao_state: JSON.stringify({ mode: 'login', sid: '', nonce: state, at: Date.now() }) },
    early,
  });
  const p = K.pending();
  assert.equal(p.code, 'CODE_EARLY');
  const res = await K.loginFinish(p.code);
  assert.equal(res.token, 'CT:early');
  assert.equal(calls.filter(c => c.url.includes('kakaoLoginFinish')).length, 0, '선제 요청이 있는데 중복 호출했다');
  assert.equal(ctx.__puKakaoEarlyLogin, undefined, '소비 후 전역 참조는 지워야 한다');
});

test('④ kakaoAuthUrl GET 요청이 일시적 네트워크 오류로 실패하면 1회 자동 재시도한다', async () => {
  let tries = 0;
  const state = shapedState('login', 'R');
  const { K, ctx } = loadClient({
    fetch(url) {
      if (String(url).includes('warm=1')) return Promise.resolve({ status: 204, text: () => Promise.resolve('') });
      tries++;
      if (tries === 1) return Promise.reject(new Error('network blip'));
      return Promise.resolve({
        status: 200,
        text: () => Promise.resolve(JSON.stringify({ ok: true, url: 'https://kauth.kakao.com/oauth/authorize?retry=1', state })),
      });
    },
  });
  await K.goLogin({ ask: false });
  assert.equal(tries, 2);
  assert.equal(ctx.location.href, 'https://kauth.kakao.com/oauth/authorize?retry=1');
});

test('②-3 sessionStorage 에 다른 nonce 가 남아 있어도 localStorage 일치 백업으로 복귀하고, 다른 탭 백업은 보존한다', () => {
  const curState = shapedState('login', 'C');
  const staleState = shapedState('login', 'S');
  const { K, localStorage } = loadClient({
    href: 'https://erp.pureunlabor.co.kr/enter.html?code=CODE2&state=' + encodeURIComponent(curState),
    session: { pu_kakao_state: JSON.stringify({ mode: 'login', sid: '', nonce: staleState, at: Date.now() }) },
    local: { pu_kakao_state_bak: JSON.stringify({ mode: 'login', sid: '', nonce: curState, at: Date.now() }) },
  });
  const p = K.pending();
  assert.deepEqual(Object.assign({}, p), { code: 'CODE2', mode: 'login', sid: '' });
  assert.equal(localStorage.getItem('pu_kakao_state_bak'), null);

  // 다른 탭이 시작한 백업은 이 탭의 불일치 콜백이 지우지 않아야 한다
  const otherTabState = shapedState('login', 'O');
  const otherBak = JSON.stringify({ mode: 'login', sid: '', nonce: otherTabState, at: Date.now() });
  const rOther = loadClient({
    href: 'https://erp.pureunlabor.co.kr/enter.html?code=CODE3&state=' + encodeURIComponent(curState),
    session: {},
    local: { pu_kakao_state_bak: otherBak },
  });
  assert.ok(rOther.K.pending().error);
  assert.equal(rOther.localStorage.getItem('pu_kakao_state_bak'), otherBak, '다른 탭의 유효 백업을 지웠다');
});

test('①-2 prefetchLogin 이 진행 중일 때 goLogin 을 누르면 중복 요청 없이 진행 중 Promise 를 재사용한다', async () => {
  const state = shapedState('login', 'I');
  let resolveAuth;
  let authCalls = 0;
  const { K, ctx } = loadClient({
    fetch(url) {
      if (String(url).includes('warm=1')) return Promise.resolve({ status: 204, text: () => Promise.resolve('') });
      authCalls++;
      return new Promise((res) => {
        resolveAuth = () => res({
          status: 200,
          text: () => Promise.resolve(JSON.stringify({ ok: true, url: 'https://kauth.kakao.com/oauth/authorize?inflight=1', state })),
        });
      });
    },
  });
  const preP = K.prefetchLogin({ ask: false });
  const goP = K.goLogin({ ask: false });
  resolveAuth();
  await Promise.all([preP, goP]);
  assert.equal(authCalls, 1, '진행 중인 prefetchLogin 이 있는데 kakaoAuthUrl 을 중복 호출했다');
  assert.equal(ctx.location.href, 'https://kauth.kakao.com/oauth/authorize?inflight=1');
});

test('⑤ 서버(functions/kakao.js)는 512MB 메모리와 1회성 state 확정 소비 후 카카오 코드 교환을 사용한다', () => {
  assert.match(kakaoServerSrc, /exports\.kakaoAuthUrl[\s\S]*?memory:\s*"512MB"/);
  assert.match(kakaoServerSrc, /exports\.kakaoLoginFinish[\s\S]*?memory:\s*"512MB"/);
  const fin = kakaoServerSrc.slice(kakaoServerSrc.indexOf('exports.kakaoLoginFinish'));
  const consumeAt = fin.indexOf('await consumeState(parsed.raw)');
  const codeAt = fin.indexOf('await kakaoIdFromCode(');
  assert.ok(consumeAt > 0 && codeAt > consumeAt, 'state 1회성 소비가 확정된 뒤에 카카오 코드를 교환해야 한다');
});

test('⑥ pu-authsync.js 는 모바일 부팅 직후(!seenUid) 세션 복원 유예를 12초로 준다', () => {
  const delays = [];
  const g = {
    navigator: { userAgent: 'Mozilla/5.0 (Linux; Android 14; Mobile) Chrome/120.0' },
    firebase: { auth: () => ({ currentUser: null, onAuthStateChanged() {} }) },
    localStorage: createStorage({ pu_auth_uid: 'U1' }),
    sessionStorage: createStorage(),
    document: { createElement: () => ({ style: {} }), body: { appendChild() {} } },
    location: { replace() {}, reload() {} },
    addEventListener() {},
    setTimeout(fn, ms) { delays.push(ms); return delays.length; },
    clearTimeout() {}, setInterval: () => 1, clearInterval: () => {},
    Date, String, Object, console,
  };
  g.window = g;
  vm.createContext(g);
  vm.runInContext(authsyncSrc, g);
  g.PuAuthSync._onAuth(null);
  assert.equal(delays[0], 12000, '모바일 부팅 직후 유예가 12초여야 한다');
});

test('⑦ enter.html 은 <head> 선제 발사·bfcache 버튼 복구·앱↔포털 핑퐁 루프 차단을 포함한다', () => {
  assert.match(enterSrc, /window\.__puKakaoEarlyLogin\s*=/);
  assert.match(enterSrc, /js\/pu-kakao\.js\?v=\d+/);
  assert.match(enterSrc, /window\.addEventListener\('pageshow'[\s\S]*?kkResetBtn\(\)/);
  assert.match(enterSrc, /var loopKey = 'pu_return_loop'/);
});
