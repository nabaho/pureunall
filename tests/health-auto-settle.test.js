'use strict';
/* 시스템 장애 알림 — «화면에 띄우지 않고 저절로 처리 완료로 정리한다» (대표 지시 2026-11-22)
   「시스템 장애 알림 관련 모두 처리 완료 버튼 안 눌러도 자동으로 정리되게,
     앞으로 다른 전체 프로그램에 이 창 안 뜨게 다 만들어 달라.」

   못 박는 것(규칙) — 값을 글자로 박지 않고 «뜻»을 본다:
   ① 이 화면에서 난 오류는 서버에 «처음부터 처리 완료»(resolved · resolvedBy 'auto')로 적는다 — 기록은 남긴다
   ② 총괄관리자 화면이 열리면 «열린 알림 전부»(잔소리 포함)를 조용히 처리 완료로 바꾼다 — 지우지 않는다(null 금지)
   ③ 총괄관리자가 아니면 서버 알림을 읽지도 쓰지도 않는다
   ④ 자주 읽지 않는다(성공 뒤 오래·실패 뒤 짧게) · 정리가 실패해도 새 장애로 다시 적지 않는다 · 한 건이 막혀도 나머지는 정리된다
   ⑤ 어느 프로그램에도 «스스로» 단추·창을 만들지 않는다 — 창은 사람이 「열어보기」를 눌렀을 때만(코드·화면 전부 훑는다)
   ⑥ 앞으로 만드는 프로그램도 같다 — 장애 알림용 떠 있는 단추를 따로 만들지 않는다(전체 화면 훑기) */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripJs, stripComments } = require('./strip-comments.js');
const { cutFn } = require('./cut-fn.js');

const ROOT = path.join(__dirname, '..');
const HEALTH_SRC = fs.readFileSync(path.join(ROOT, 'js', 'pu-health.js'), 'utf8');
const HEALTH = stripJs(HEALTH_SRC);

const MIN = 60 * 1000;
const HOUR = 60 * MIN;

/* 진짜 pu-health.js 를 «돌린다» — 가짜 창·저장소·파이어베이스를 쥐여 준다.
   opts.role     uid_roles/<uid> 에서 읽히는 값
   opts.alerts   systemAlerts 에서 읽히는 값(uid → id → 알림)
   opts.store    localStorage 의 처음 내용
   opts.failRead true 면 systemAlerts 읽기가 실패한다
   opts.rejectIf 함수(patch) → true 면 그 묶음 쓰기를 거절한다 */
function boot(opts) {
  opts = opts || {};
  const store = Object.assign({}, opts.store || {});
  const calls = { reads: 0, updates: [], sets: [], created: 0, appended: 0, roleReads: 0 };
  const user = { uid: 'me', email: 'me@example.com', displayName: '홍길동', getIdToken: () => Promise.resolve('t') };
  let authCb = null;
  const db = {
    goOnline() {},
    ref(p) {
      if (p === undefined) {
        return { update(patch) {
          if (opts.rejectIf && opts.rejectIf(patch)) return Promise.reject(new Error('PERMISSION_DENIED'));
          calls.updates.push(patch); return Promise.resolve();
        } };
      }
      if (p === 'systemAlerts') {
        return { once() {
          calls.reads += 1;
          return opts.failRead ? Promise.reject(new Error('permission_denied')) : Promise.resolve({ val: () => opts.alerts || {} });
        } };
      }
      if (/^uid_roles\//.test(p)) {
        return { once() { calls.roleReads += 1; return Promise.resolve({ val: () => opts.role || {} }); } };
      }
      return {
        set(v) { calls.sets.push({ path: p, value: v }); return Promise.resolve(); },
        update(v) { calls.updates.push({ [p]: v }); return Promise.resolve(); }
      };
    }
  };
  const app = {
    auth: () => ({ currentUser: user, onAuthStateChanged(cb) { authCb = cb; } }),
    database: () => db
  };
  const listeners = {};
  const win = {
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; }
    },
    navigator: { onLine: true },
    location: { pathname: '/pureunall/fund.html' },
    document: {
      getElementById: () => null,
      createElement: () => { calls.created += 1; return { style: {}, setAttribute() {}, appendChild() {}, querySelector() { return { onclick: null, style: {} }; } }; },
      body: { appendChild() { calls.appended += 1; } }
    },
    firebase: { apps: [app], initializeApp() {} },
    addEventListener: (n, f) => { (listeners[n] = listeners[n] || []).push(f); },
    setTimeout: (fn) => { fn(); return 0; },
    console: { warn() {}, log() {} },
    Date, JSON, Math, Object, Array, String, Number, Promise
  };
  win.window = win;
  vm.createContext(win);
  vm.runInContext(HEALTH_SRC, win);
  return {
    win, store, calls, listeners,
    login: () => { authCb(user); return ticks(); },
    pending: () => JSON.parse(store.pu_health_pending_v1 || '[]'),
    settleRecord: () => JSON.parse(store.pu_health_settle_v1 || 'null')
  };
}
function ticks(n) {
  let p = Promise.resolve();
  for (let i = 0; i < (n || 30); i++) p = p.then(() => new Promise((r) => setImmediate(r)));
  return p;
}

const 서버 = () => ({
  uidA: {
    a1: { uid: 'uidA', kind: 'security-device', message: '처음 보는 기기에서 로그인 성공', page: 'enter.html', createdAt: 5, status: 'new' },
    a2: { uid: 'uidA', kind: 'javascript', message: 'ResizeObserver loop completed with undelivered notifications.', page: 'fund.html', createdAt: 4, status: 'new' },
    a3: { uid: 'uidA', kind: 'backup', message: 'permission_denied at /esign', page: 'docs-esign.html', createdAt: 3, status: 'resolved' }
  },
  uidB: {
    b1: { uid: 'uidB', kind: 'storage-bigwrite', message: '저장 공간 미리 알림', page: 'gov-consulting.html', createdAt: 2, status: 'new' }
  }
});

/* ── ① 이 화면에서 난 오류 ── */
test('① 이 화면에서 난 오류는 서버에 «처음부터 처리 완료»로 적는다 — 기록은 남는다', async () => {
  const b = boot({ role: {} });
  await b.login();
  assert.equal(b.win.PUHealth.report('javascript', new Error('allItems is not defined')), true);
  await ticks();
  assert.equal(b.calls.sets.length, 1, '기록을 아예 안 남기면 나중에 무슨 오류가 났었는지 볼 길이 없다');
  const rec = b.calls.sets[0];
  assert.match(rec.path, /^systemAlerts\/me\//, '본인 자리에 적는다(서버 규칙이 허락하는 길)');
  assert.equal(rec.value.status, 'resolved', '★ new 로 적으면 누군가 눌러 줘야 한다');
  assert.equal(rec.value.resolvedBy, 'auto', '손으로 누른 것(uid)과 구별되어야 한다');
  assert.equal(typeof rec.value.resolvedAt, 'number');
  assert.match(rec.value.message, /allItems/);
  assert.equal(b.pending().length, 0, '올린 것은 대기줄에서 빠진다');
});

test('① 이 업데이트 «전에» 대기줄에 있던 것(status new)도 처리 완료로 올라간다', async () => {
  const old = [{ localId: 'x1', kind: 'save', message: '저장 자동복구 실패', detail: '', page: 'pu-erp.html', createdAt: 1, status: 'new' }];
  const b = boot({ store: { pu_health_pending_v1: JSON.stringify(old) } });
  await b.login();
  assert.equal(b.calls.sets.length, 1);
  assert.equal(b.calls.sets[0].value.status, 'resolved');
  assert.equal(b.calls.sets[0].value.resolvedBy, 'auto');
});

test('① 잔소리는 여전히 아예 올리지 않는다 — 기록할 값어치가 없다', async () => {
  const b = boot();
  await b.login();
  assert.equal(b.win.PUHealth.report('javascript', 'ResizeObserver loop completed with undelivered notifications.'), false);
  await ticks();
  assert.equal(b.calls.sets.length, 0);
});

/* ── ② ③ 쌓인 것 정리 ── */
test('② 총괄관리자 화면이 열리면 열린 알림 «전부»(잔소리 포함)를 처리 완료로 — 한 건씩과 같은 세 칸만', async () => {
  const b = boot({ role: { isAdmin: true }, alerts: 서버() });
  await b.login();
  assert.equal(b.calls.reads, 1);
  assert.equal(b.calls.updates.length, 1, '100건 이하는 한 번의 묶음 쓰기');
  const up = b.calls.updates[0];
  assert.deepEqual(Object.keys(up).sort(), [
    'systemAlerts/uidA/a1/resolvedAt', 'systemAlerts/uidA/a1/resolvedBy', 'systemAlerts/uidA/a1/status',
    'systemAlerts/uidA/a2/resolvedAt', 'systemAlerts/uidA/a2/resolvedBy', 'systemAlerts/uidA/a2/status',
    'systemAlerts/uidB/b1/resolvedAt', 'systemAlerts/uidB/b1/resolvedBy', 'systemAlerts/uidB/b1/status'
  ], '★ 잔소리(a2)도 정리한다 · 이미 처리된 것(a3)은 건드리지 않는다');
  assert.ok(Object.values(up).every((v) => v !== null && v !== undefined), '★★ null 은 «지우는 것»이다 — 기록이 사라진다');
  assert.equal(up['systemAlerts/uidA/a1/status'], 'resolved');
  assert.equal(up['systemAlerts/uidA/a1/resolvedBy'], 'auto');
  assert.equal(b.calls.sets.length, 0, '정리하면서 다른 것을 새로 쓰지 않는다');
});

test('② 100건씩 묶어서 쓴다 — 한 번에 너무 큰 쓰기를 하지 않는다', async () => {
  const many = { uidA: {} };
  for (let i = 0; i < 230; i++) many.uidA['k' + i] = { uid: 'uidA', kind: 'javascript', message: 'm' + i, page: 'p.html', createdAt: i, status: 'new' };
  const b = boot({ role: { isAdmin: true }, alerts: many });
  await b.login();
  const sizes = b.calls.updates.map((u) => Object.keys(u).length / 3);
  assert.deepEqual(sizes.reduce((a, c) => a + c, 0), 230, '하나도 빠뜨리지 않는다');
  assert.ok(sizes.length >= 3 && Math.max.apply(null, sizes) <= 100, '묶음 크기에 한도가 있다');
});

test('③ 총괄관리자가 아니면 서버 알림을 읽지도 쓰지도 않는다', async () => {
  for (const role of [{}, { isSubAdmin: true }, { isAdmin: false }]) {
    const b = boot({ role, alerts: 서버() });
    await b.login();
    assert.equal(b.calls.reads, 0, JSON.stringify(role));
    assert.equal(b.calls.updates.length, 0, JSON.stringify(role));
  }
});

/* ── ④ 얼마나 자주 · 실패했을 때 ── */
test('④ 정리가 잘 끝났으면 한참 동안 다시 읽지 않는다 — 장애 이력 전체를 읽는 일이다', async () => {
  const first = boot({ role: { isAdmin: true }, alerts: 서버() });
  await first.login();
  assert.equal(first.settleRecord().ok, true, '끝난 것을 적어 둔다');
  const again = boot({ role: { isAdmin: true }, alerts: 서버(), store: first.store });
  await again.login();
  assert.equal(again.calls.reads, 0, '화면을 열 때마다 읽으면 읽는 양만 는다');
});

test('④ 때가 지나면 다시 정리한다 — 성공 뒤는 길게, 실패 뒤는 짧게', async () => {
  const now = Date.now();
  const cases = [
    [{ at: now - 7 * HOUR, ok: true }, 1, '성공 뒤 충분히 지남'],
    [{ at: now - 1 * HOUR, ok: true }, 0, '성공 뒤 얼마 안 됨'],
    [{ at: now - 31 * MIN, ok: false }, 1, '실패 뒤에는 짧게 기다리고 다시'],
    [{ at: now - 5 * MIN, ok: false }, 0, '실패 직후에는 쉰다']
  ];
  for (const [rec, reads, why] of cases) {
    const b = boot({ role: { isAdmin: true }, alerts: {}, store: { pu_health_settle_v1: JSON.stringify(rec) } });
    await b.login();
    assert.equal(b.calls.reads, reads, why);
  }
});

test('④ 읽기에 실패해도 조용하다 — 실패를 새 장애로 다시 적으면 알림이 늘어나는 순환이 된다', async () => {
  const b = boot({ role: { isAdmin: true }, failRead: true });
  await b.login();
  assert.ok(b.calls.reads >= 1);
  assert.equal(b.calls.updates.length, 0);
  assert.equal(b.pending().length, 0, '정리 실패가 대기줄(새 장애)로 들어가면 안 된다');
  assert.equal(b.settleRecord().ok, false, '실패했다고 적어 둔다 — 짧게 기다린 뒤 다시 한다');
});

test('④ 묶음 하나가 거절돼도 나머지는 정리된다 — 걸린 묶음은 건별로 다시 쓴다', async () => {
  const b = boot({
    role: { isAdmin: true }, alerts: 서버(),
    rejectIf: (patch) => Object.keys(patch).length > 3 || Object.keys(patch).some((k) => /uidA\/a1\//.test(k))
  });
  await b.login();
  const done = new Set();
  b.calls.updates.forEach((u) => Object.keys(u).forEach((k) => { if (/\/status$/.test(k)) done.add(k.split('/')[2]); }));
  assert.deepEqual(Array.from(done).sort(), ['a2', 'b1'], '막힌 한 건(a1) 때문에 나머지가 안 정리되면 14건이 영영 남는다');
});

/* ── ⑤ 스스로 단추·창을 만들지 않는다 ── */
test('⑤ 오류가 나도, 관리자가 들어와도 화면에 아무것도 만들지 않는다', async () => {
  const b = boot({ role: { isAdmin: true }, alerts: 서버() });
  await b.login();
  b.win.PUHealth.report('javascript', new Error('todayStr is not defined'));
  b.win.PUHealth.report('promise', new Error('permission_denied at /esign'));
  await ticks();
  assert.equal(b.calls.created, 0, '★ 요소를 만들었다 — 빨간 단추나 창이 뜰 수 있다');
  assert.equal(b.calls.appended, 0);
});

test('⑤ 코드에 떠 있는 단추가 없다 — 단추 이름·빨간 칠·고정 위치가 모두 사라졌다', () => {
  assert.doesNotMatch(HEALTH, /pu-health-admin-badge/, '단추를 되살렸다');
  assert.doesNotMatch(HEALTH, /HEALTH_ALARM|paintAdminBadge|ensureAdminBadge|knownOpen|adminLoadFailed/, '옛 단추 규칙이 남았다');
  assert.equal((HEALTH.match(/position:fixed/g) || []).length, 1,
    '고정 위치는 «사람이 연 창의 어두운 바탕» 하나뿐이어야 한다 — 단추를 따로 박으면 앱바(pu-appbar.js)와 겹친다');
});

test('⑤ 창(renderAdminPanel)은 «열어보기» 한 길로만 뜬다 — 오류·로그인·정리에서 부르지 않는다', () => {
  const calls = HEALTH.match(/renderAdminPanel\(/g) || [];
  assert.equal(calls.length, 2, '정의 한 번 + 부르는 곳 한 번(showAdminPanel)이어야 한다');
  assert.match(cutFn(HEALTH, 'function showAdminPanel('), /renderAdminPanel\(app\)/);
  for (const fn of ['function enqueue(', 'function flush(', 'function settleOpen(', 'function monitorAdmin(', 'function bindApp(', 'function install(']) {
    assert.doesNotMatch(cutFn(HEALTH, fn), /renderAdminPanel|showAdminPanel|openAdminPanel/, fn + ' 가 창을 띄웁니다');
  }
  assert.match(HEALTH, /openAdminPanel: showAdminPanel/, '사람이 여는 문(포털 설정)은 남아 있어야 한다');
});

test('④ 정리는 지우지 않는다 — 서버 값을 비우거나 remove 하는 길이 없다', () => {
  assert.doesNotMatch(HEALTH, /\.remove\(\)\s*\.then|\.ref\([^)]*\)\.remove\(|\.set\(null\)/, '서버 기록을 지우는 길이 있다');
  const patch = cutFn(HEALTH, 'function resolveAllPatch(');
  assert.doesNotMatch(patch, /null/, '값을 null 로 쓰면 기록이 지워진다');
  const settle = cutFn(HEALTH, 'function settleOpen(');
  assert.match(settle, /flattenAlerts\(snapshot\.val\(\), true\)/, '잔소리까지 «열린 것 전부»를 본다');
  assert.match(settle, /\.catch\(function \(\) \{ return 0; \}\)/, '정리 실패를 삼키지 않으면 새 장애로 다시 적힌다');
});

/* ── ⑤ ⑥ 어느 프로그램(화면)에서도, 앞으로 만드는 것도 ── */
const SKIP_DIRS = ['node_modules', '.git', '.codex-worktrees', 'dist', 'build', '.superpowers', '.claude', 'fixtures', '_harness', 'backups', 'tools', 'tests', 'docs', 'status'];
function walk(dir, exts, out) {
  out = out || [];
  fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
    if (SKIP_DIRS.indexOf(e.name) >= 0) return;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, exts, out);
    else if (exts.some((x) => e.name.endsWith(x))) out.push(p);
  });
  return out;
}
const rel = (p) => path.relative(ROOT, p).replace(/\\/g, '/');
const PAGES = walk(ROOT, ['.html']);
const SHARED_JS = walk(path.join(ROOT, 'js'), ['.js']);

test('⑥ 어느 화면도 장애 알림 단추를 따로 만들지 않는다 — 만들 수 있는 곳은 한 군데도 없다', () => {
  const bad = [];
  PAGES.concat(SHARED_JS).forEach((p) => {
    const raw = fs.readFileSync(p, 'utf8');
    const code = p.endsWith('.html') ? stripComments(raw) : stripJs(raw);
    /* 단추를 «만드는» 글자만 본다 — 앱바·화면 CSS 가 그 이름을 «칠하려고» 적는 것(#pu-health-admin-badge{…})은 해가 없다 */
    if (/id\s*=\s*["']pu-health-admin-badge["']/.test(code) || /\.id\s*=\s*["']pu-health-admin-badge["']/.test(code)) bad.push(rel(p));
  });
  assert.deepEqual(bad, [], '이 화면이 장애 알림 단추를 직접 만듭니다 — 단추는 두지 않는 것이 규칙입니다(js/pu-health.js 참고)');
});

test('⑥ 「시스템 장애 알림」 창은 pu-health.js 한 벌뿐이다 — 화면마다 따로 만든 곳이 없다', () => {
  const owners = [];
  PAGES.concat(SHARED_JS).forEach((p) => {
    if (rel(p) === 'js/pu-health.js') return;
    const raw = fs.readFileSync(p, 'utf8');
    const code = p.endsWith('.html') ? stripComments(raw) : stripJs(raw);
    /* 포털 [⚙ 설정]의 안내 줄(<b>시스템 장애 알림</b>)은 «문»이지 창이 아니다 — 창을 «그리는» 글자만 찾는다 */
    if (/['"`][^'"`\n]*시스템 장애 알림 \([^'"`\n]*['"`]/.test(code) || /createElement\([^)]*\)[^;]{0,200}시스템 장애 알림/.test(code)) owners.push(rel(p));
  });
  assert.deepEqual(owners, [], '창을 따로 그리는 화면이 있습니다 — 그러면 저절로 정리해도 이 화면에서는 계속 뜹니다');
});

test('⑥ 모든 화면이 같은 pu-health.js 를 부르고 번호가 하나다 — 고친 파일을 모든 화면이 받는다', () => {
  const vers = new Set();
  const users = [];
  PAGES.forEach((p) => {
    const m = /js\/pu-health\.js\?v=(\d+)/.exec(fs.readFileSync(p, 'utf8'));
    if (m) { vers.add(m[1]); users.push(rel(p)); }
  });
  assert.ok(users.length >= 10, '장애 알림을 쓰는 화면이 너무 적게 잡힌다 — 훑는 길이 깨졌다');
  assert.equal(vers.size, 1, '화면마다 다른 번호면 일부 화면은 옛 파일(단추가 뜨는 것)을 그대로 쓴다: ' + Array.from(vers).join(','));
});

test('⑥ 포털 설정의 안내 글이 «빨갛게 뜬다»고 거짓말하지 않는다', () => {
  const portal = stripComments(fs.readFileSync(path.join(ROOT, 'enter.html'), 'utf8'));
  const i = portal.indexOf('<b>시스템 장애 알림</b>');
  assert.ok(i > 0, '설정의 「시스템 장애 알림」 줄이 있어야 한다(사람이 여는 문)');
  const row = portal.slice(i, i + 400);
  assert.doesNotMatch(row, /빨갛게 뜹니다|왼쪽 아래에/, '단추가 없는데 있다고 안내한다');
  assert.match(row, /저절로/);
});
