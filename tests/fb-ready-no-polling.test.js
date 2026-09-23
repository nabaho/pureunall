'use strict';
/* 「준비될 때까지 두드리기」를 없앤다 (2026-09-23 전체점검 ⑧)
   ─────────────────────────────────────────────────────────────────────────
   ■ 먼저, 내가 세어 놓고 틀린 것을 바로잡는다
     점검 보고서에 「같은 것을 기다리는 시계가 일곱 개」라고 적었다. 다시 재 보니 아니다.
       · `:167`  — PuWhoami 를 기다리는데, 그 파일은 «바로 앞에서» 실려 있다.
                   첫 판에서 이미 있으므로 **시계가 아예 안 돈다.**
       · `:4527` — 주소에 `?fixsync=1` 이 있을 때만 돈다. **평소에는 안 돈다.**
     평소 부팅에 도는 것은 다섯이고, 그중 **둘**이 «똑같은 것»(fbDb+fbAuthReady)을
     따로 기다리고 있었다. 그 둘을 없앤다.

   ■ 두드릴 까닭이 애초에 없었다
     준비되는 그 자리(onAuthStateChanged)는 **이미 `fb_auth_ready` 를 알려 주고 있다.**
     알려 주는데도 0.5초마다 물어보고 있었던 것이다.
     두드리기의 진짜 값은 「늦게 안다」 — 0.5초마다 물으면 최대 0.5초 늦게 시작한다.

   ★ 못 박는 것 — 값이 아니라 규칙
     ① 같은 것을 기다리는 시계를 다시 만들지 않는다
     ② 준비되면 «그 순간» 받는다 (0.5초 뒤가 아니라)
     ③ 안 오면 «끝난다» — 영영 매달리지 않는다
     ④ 화면을 떠난 뒤 늦게 온 답으로 일을 벌이지 않는다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn');
const { stripJs } = require('./strip-comments');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');
const FN = cutFn(SRC, 'function erpWhenFbReady(');

/* 진짜 함수를 떠서 돌린다 — 가짜 창과 가짜 시계를 준다 */
function 판(opts) {
  const listeners = {};
  const timers = [];
  const ctx = {
    console, Promise, Object,
    fbDb: opts.db ? {} : null,
    fbAuthReady: !!opts.ready,
    _fbReadyP: null,
    setTimeout: (fn, ms) => { const id = timers.length; timers.push({ fn, ms, id, alive: true }); return id; },
    clearTimeout: (id) => { if (timers[id]) timers[id].alive = false; }
  };
  ctx.window = {
    addEventListener: (k, fn) => { (listeners[k] = listeners[k] || []).push(fn); },
    removeEventListener: (k, fn) => {
      if (listeners[k]) listeners[k] = listeners[k].filter(x => x !== fn);
    }
  };
  vm.createContext(ctx);
  vm.runInContext(FN, ctx);
  return {
    ctx, listeners, timers,
    호출: (ms) => ctx.erpWhenFbReady ? ctx.erpWhenFbReady(ms) : vm.runInContext('erpWhenFbReady(' + (ms || '') + ')', ctx),
    신호: () => (listeners['fb_auth_ready'] || []).forEach(f => f()),
    시계돌리기: () => timers.filter(t => t.alive).forEach(t => { t.alive = false; t.fn(); })
  };
}

test('①★★ 같은 것을 기다리는 시계를 «다시 만들지» 않는다', () => {
  /* 이것이 이 판의 요점이다. 버전 게이트와 접속자 현황이 똑같은 조건을
     각자의 setInterval 로 기다리고 있었다. 새로 만들면 그 자리에서 걸린다. */
  const bare = stripJs(SRC);
  const 두드림 = (bare.match(/setInterval\([^]{0,260}?fbAuthReady/g) || []);
  assert.deepEqual(두드림, [],
    '★★ fbAuthReady 를 setInterval 로 기다리는 자리가 ' + 두드림.length + '곳 있다.\n' +
    '  준비되는 자리가 fb_auth_ready 로 «알려 준다» — erpWhenFbReady() 를 쓰라.\n' +
    '  두드리면 최대 그 주기만큼 늦게 시작한다.');
  assert.match(bare, /erpWhenFbReady\(/, '★ 알려 주는 것을 받는 자리가 하나도 없다');
});

test('②★★ 준비되면 «그 순간» 받는다 — 시계를 기다리지 않는다', () => {
  const p = 판({ db: false, ready: false });
  let 끝났나 = null;
  p.호출(20000).then(v => { 끝났나 = v; });
  p.ctx.fbDb = {}; p.ctx.fbAuthReady = true;
  p.신호();                                   // ← 시계는 한 번도 안 돌렸다
  return Promise.resolve().then(() => {
    assert.equal(끝났나, true,
      '★★ 신호가 왔는데 안 끝났다 — 시계가 돌아야만 안다면 그만큼 늦게 시작한다');
  });
});

test('②-2 이미 준비돼 있으면 신호를 «기다리지» 않는다', () => {
  /* 늦게 부르는 쪽은 신호가 이미 지나갔다. 그때 매달리면 영영 안 끝난다. */
  const p = 판({ db: true, ready: true });
  let 끝났나 = null;
  p.호출().then(v => { 끝났나 = v; });
  return Promise.resolve().then(() => {
    assert.equal(끝났나, true, '★★ 이미 준비됐는데 매달렸다 — 신호는 이미 지나갔다');
  });
});

test('③★★ 안 오면 «끝난다» — 영영 매달리지 않는다', () => {
  const p = 판({ db: false, ready: false });
  let 끝났나 = null;
  p.호출(20000).then(v => { 끝났나 = v; });
  assert.ok(p.timers.some(t => t.ms === 20000), '★★ 물러날 시계가 없다 — 안 오면 영영 기다린다');
  p.시계돌리기();
  return Promise.resolve().then(() => {
    assert.equal(끝났나, false,
      '★★ 끝나긴 했는데 «됐다»고 답했다 — 부르는 쪽이 준비 안 된 채로 일을 벌인다');
  });
});

test('③-2 한 번 만든 약속을 다시 만들지 않는다 — 부를 때마다 시계가 생기면 안 된다', () => {
  const p = 판({ db: false, ready: false });
  const a = p.호출(1000), b = p.호출(1000), c = p.호출(1000);
  assert.equal(a, b); assert.equal(b, c);
  assert.equal(p.timers.length, 1,
    '★★ 세 번 불렀더니 시계가 ' + p.timers.length + '개 생겼다 — 없애려던 것을 다시 만든 셈이다');
});

test('③-3 끝나면 듣던 것을 «뗀다» — 안 떼면 쌓인다', () => {
  const p = 판({ db: false, ready: false });
  p.호출(20000);
  assert.equal((p.listeners['fb_auth_ready'] || []).length, 1);
  p.ctx.fbDb = {}; p.ctx.fbAuthReady = true;
  p.신호();
  return Promise.resolve().then(() => {
    assert.equal((p.listeners['fb_auth_ready'] || []).length, 0,
      '★ 끝났는데 아직 듣고 있다 — 화면을 오래 켜 두면 이런 것이 쌓인다');
  });
});

test('④★★ 화면을 떠난 뒤 늦게 온 답으로 일을 벌이지 않는다', () => {
  /* 접속자 현황은 로그인 상태에 매달린 자리다. 로그아웃해 그 자리가 사라진 뒤
     답이 도착하면 «없는 사람»을 접속자로 올린다. */
  /* ⚠ 닻을 「접속자 현황(presence)」 로 잡으면 «안 된다» — 같은 글이 4,888,632자 위쪽
     설명 주석에도 있어서 거기가 먼저 걸린다. 그러면 파일 끝까지가 조각이 되어
     검사가 엉뚱한 것을 본다(이 저장소 「되풀이된 실수 ⑥」). 실제로 한 번 걸렸다.
     이 자리에만 있는 글로 잡는다. */
  const 닻 = '접속자 현황(presence) — 로그인 상태 + Firebase 인증 준비되면 등록';
  const i = SRC.indexOf(닻);
  assert.ok(i > -1, '★★ 접속자 현황 자리를 못 찾았다');
  assert.equal(SRC.indexOf(닻, i + 1), -1, '★★ 닻이 두 군데 있다 — 어느 쪽을 본 것인지 알 수 없다');
  const 조각 = SRC.slice(i, SRC.indexOf('}, [isLoggedIn]);', i));
  assert.match(조각, /erpWhenFbReady\(/, '★ 아직 두드리고 있다');
  const 표 = 조각.match(/var\s+([^\s=]+)\s*=\s*false;/);
  assert.ok(표, '★★ «떠났는지» 를 적어 두는 표가 없다');
  assert.match(조각, new RegExp('if\\s*\\(\\s*' + 표[1] + '[^)]*\\)\\s*return'),
    '★★ 떠난 뒤에도 그대로 일을 한다 — 로그아웃한 사람이 접속자로 올라간다');
  assert.match(조각, new RegExp('return function\\(\\)\\{[^}]*' + 표[1] + '\\s*=\\s*true'),
    '★★ 떠날 때 표를 세우지 않는다 — 표만 있고 아무도 안 세우면 없는 것과 같다');
});
