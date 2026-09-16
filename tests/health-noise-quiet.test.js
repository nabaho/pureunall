/* 잔소리는 장애가 아니다 — 빨간 배지가 «깜빡이던» 뿌리 둘을 끊는다
   ─────────────────────────────────────────────────────────────────────────
   대표 제보 2026-09-16 「계속 깜빡이며 경고가 계속 반복된다 해결좀해라」

   ■ 무엇이 있었나 (서버 실측)
     대표 화면의 「⚠ 장애 알림 7」이 켤 때마다 다시 켜졌다. 열린 7건을 읽어 보니
     «전부» 기금 화면(fund.html)이 10분마다 올린
     「ResizeObserver loop completed with undelivered notifications.」였다(누적 69건).
     이것은 크롬이 «이번 칸에 한 번 더 그린다»고 알려 주는 말이지 고장이 아니다.
     오류 그물이 그것을 장애로 세어 10분마다 새 건을 만들었고, 새 건마다 배지를
     다시 칠해 깜빡였다. 「Script error.」(37건)도 같다 — 내용 없는 말이다.

   ■ 뿌리 둘
     ① pu-health.js — 잔소리를 장애로 올리고, 이미 쌓인 것도 세어 배지를 켰다
     ② fund.html   — 크기 감시 콜백 «안에서» observe() 를 다시 걸고 표 스크롤을
                     켜고 껐다. 둘 다 같은 칸 안에서 감시를 다시 깨우는 짓이다.

   ★ 못 박는 것
     · 잔소리는 올리지도(enqueue) 세지도(flattenAlerts) 않는다 — 두 곳 «함께»
     · 진짜 오류는 그대로 올린다 — 거르개가 넓어지면 장애가 조용해진다
     · fund.html 은 콜백 안에서 observe/disconnect 를 되풀이하지 않고,
       표 스크롤 손질은 다음 칸으로 미룬다, 같은 값은 다시 적지 않는다 */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { cutFn } = require('./cut-fn.js');
const { stripJs } = require('./strip-comments.js');

const ROOT = path.join(__dirname, '..');
const HEALTH = fs.readFileSync(path.join(ROOT, 'js', 'pu-health.js'), 'utf8');
const FUND = stripJs(fs.readFileSync(path.join(ROOT, 'fund.html'), 'utf8'));

/* pu-health 를 «진짜로 돌린다» — 가짜 창·문서·저장소를 쥐여 준다 */
function boot() {
  const store = {};
  const listeners = {};
  const win = {
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; }
    },
    navigator: { onLine: false },              /* 서버로는 «안 나가게» — 대기줄만 본다 */
    location: { pathname: '/pureunall/fund.html' },
    document: {
      getElementById: () => null,
      createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }),
      body: { appendChild() {} }
    },
    addEventListener: (n, f) => { (listeners[n] = listeners[n] || []).push(f); },
    setTimeout, clearTimeout, console, Date, JSON, Math, Object, Array, String, Number, Promise
  };
  win.window = win;
  vm.createContext(win);
  vm.runInContext(HEALTH, win);
  return { win, store, listeners, pending: () => JSON.parse(store.pu_health_pending_v1 || '[]') };
}

const 잔소리 = 'ResizeObserver loop completed with undelivered notifications.';

test('① 「ResizeObserver loop」는 장애로 «올리지 않는다»', () => {
  const b = boot();
  assert.strictEqual(b.win.PUHealth.report('javascript', 잔소리), false);
  assert.strictEqual(b.pending().length, 0, '대기줄에 들어가면 10분마다 서버로 올라가 배지를 켠다');
});

test('② 「Script error.」도 장애가 아니다 — 무엇이 났는지 알 길이 없는 빈말이다', () => {
  const b = boot();
  assert.strictEqual(b.win.PUHealth.report('javascript', 'Script error.'), false);
  assert.strictEqual(b.pending().length, 0);
});

test('③ 오류 «객체»로 와도 걸러진다 — window.error 는 Error 를 넘긴다', () => {
  const b = boot();
  assert.strictEqual(b.win.PUHealth.report('javascript', new Error(잔소리)), false);
  assert.strictEqual(b.pending().length, 0);
});

test('④ 진짜 오류는 그대로 올린다 — 거르개가 넓어지면 장애가 조용해진다', () => {
  const b = boot();
  assert.strictEqual(b.win.PUHealth.report('javascript', new Error('allItems is not defined')), true);
  assert.strictEqual(b.pending().length, 1);
  assert.match(b.pending()[0].message, /allItems/);
});

test('⑤ 이미 서버에 쌓인 잔소리도 «세지 않는다» — 배지는 이것으로 켜졌다', () => {
  const b = boot();
  const 서버 = {
    uidA: {
      a1: { status: 'new', message: 잔소리, page: 'fund.html', createdAt: 3 },
      a2: { status: 'new', message: 'Script error.', page: 'work.html', createdAt: 2 },
      a3: { status: 'new', message: 'allItems is not defined', page: 'pu-cards.html', createdAt: 1 }
    }
  };
  const list = Array.from(b.win.PUHealth._flattenAlerts(서버));
  assert.strictEqual(list.length, 1, '잔소리 둘이 세어지면 대표 화면의 빨간 「7」이 그대로 남는다');
  assert.strictEqual(list[0].id, 'a3');
});

test('⑥ 처리된 것은 여전히 세지 않는다 — 거르개를 넣다 옛 규칙을 깨면 안 된다', () => {
  const b = boot();
  const list = b.win.PUHealth._flattenAlerts({ u: { x: { status: 'resolved', message: 'allItems is not defined' } } });
  assert.strictEqual(list.length, 0);
});

test('⑦ 거르개는 «두 곳이 같은 판정»을 쓴다 — 한 곳만 고치면 반쪽이 된다', () => {
  const src = stripJs(HEALTH);
  const enq = cutFn(src, 'function enqueue(');
  const flat = cutFn(src, 'function flattenAlerts(');
  assert.match(enq, /isNoise\(message\)/, '올릴 때 안 거르면 서버에 영영 쌓인다');
  assert.match(flat, /isNoise\(item\.message\)/, '읽을 때 안 거르면 이미 쌓인 것이 계속 배지를 켠다');
});

/* ── 기금 화면의 되풀이 고리 ─────────────────────────────────────────── */

test('⑧ 크기 감시 콜백 «안에서» observe/disconnect 를 되풀이하지 않는다', () => {
  const f = cutFn(FUND, 'function _syncHomeheadH(');
  assert.ok(!/_homeheadRO\.disconnect\(\);\s*_homeheadRO\.observe\(e\)/.test(f),
    'observe 는 «첫 알림»을 새로 낳는다 — 콜백마다 다시 걸면 그 자체로 고리다');
  assert.match(f, /_homeheadWatched\s*!==\s*e/, '지켜보는 대상이 «바뀌었을 때만» 다시 건다');
});

test('⑨ 표 스크롤 손질은 감시 콜백에서 «다음 칸»으로 미룬다', () => {
  const f = cutFn(FUND, 'function _syncHomeheadH(');
  assert.match(f, /requestAnimationFrame\(_syncTblScroll\)/,
    '같은 칸 안에서 스크롤을 켜면 폭이 바뀌어 감시가 다시 깨어난다 — 그것이 크롬의 「loop」 경고다');
  assert.ok(!/ResizeObserver\(function\(\)\{\s*_syncHomeheadH\(\);\s*_syncTblScroll\(\);\s*\}\)/.test(f),
    '옛 모양(같은 칸에서 바로 _syncTblScroll) 이 되살아났다');
});

test('⑩ 잰 값이 «같으면» 다시 적지 않는다 — 다시 적는 것 자체가 다시 그림을 부른다', () => {
  assert.match(FUND, /function _setCssVar\(name,val\)\{\s*if\(_cssVarLast\[name\]===val\) return false;/);
  const top = cutFn(FUND, 'function _syncTopbarH(');
  const head = cutFn(FUND, 'function _syncHomeheadH(');
  assert.ok(!/style\.setProperty\('--topbar-h'/.test(top), '상단바 높이를 곧바로 적고 있다 — _setCssVar 를 거쳐야 한다');
  assert.ok(!/style\.setProperty\('--homehead-h'/.test(head), '머리줄 높이를 곧바로 적고 있다 — _setCssVar 를 거쳐야 한다');
});

test('⑪ 판 번호가 올라갔다 — 안 올리면 화면이 옛 pu-health 를 캐시에서 계속 쓴다', () => {
  const erp = fs.readFileSync(path.join(ROOT, 'pu-erp.html'), 'utf8');
  const fund = fs.readFileSync(path.join(ROOT, 'fund.html'), 'utf8');
  [erp, fund].forEach(html => {
    const m = html.match(/js\/pu-health\.js\?v=(\d+)/);
    assert.ok(m, 'pu-health.js 에 ?v= 가 없다');
    assert.ok(Number(m[1]) >= 4, '잔소리 거르개가 든 판(4 이상)을 부르지 않는다');
  });
});
