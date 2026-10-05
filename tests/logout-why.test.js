'use strict';
/* 「왜 로그아웃됐나」 를 기기에 적고 로그인 화면에 한 줄 (대표 보고 2026-10-05
   「폰에서 🏠 누르면 로그인 화면이 계속 나온다 — 안 나오게 할 수 없나?」)

   지키는 것
   ① signOut 을 부르면 «언제·어느 화면·까닭·쉰 분·유지 켰나» 가 남고, 로그아웃은 원래대로 일어난다
   ② 로그인한 사람이 없거나 익명이면 적지 않는다(«로그아웃»이 아니다)
   ③ 지난번 까닭: 기록이 마지막 로그인보다 뒤면 그 까닭, 기록 없이 풀렸으면 «말없이 풀림», 7일 지나면 침묵
   ④ 저장소 보존 청하기는 «로그인 유지» 켠 기기만
   ⑤ 파이어베이스가 늦게 실려도 감싼다
   ⑥ signOut 을 부르는 화면은 «모두» 이 파일을 싣는다 — 하나라도 빠지면 거기서 난 로그아웃이 «말없이 풀림»으로 잘못 보인다
   ⑦ 포털: 로그인하면 seen·persist, 로그인 화면엔 한 줄 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { stripJs, stripComments } = require('./strip-comments.js');

const ROOT = path.join(__dirname, '..');
const MOD = fs.readFileSync(path.join(ROOT, 'js', 'pu-logout-why.js'), 'utf8');

function box(opt) {
  opt = opt || {};
  const store = Object.assign({}, opt.store || {});
  const calls = [];
  function Auth() { this.currentUser = opt.user === undefined ? { uid: 'u1', email: 'a@example.com' } : opt.user; }
  Auth.prototype.signOut = function () { calls.push('orig'); return 'done'; };
  const timers = [];
  const ctx = {
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
    location: { pathname: '/pureunall/' + (opt.page || 'pu-erp.html') },
    document: { hidden: !!opt.hidden },
    navigator: opt.navigator || {},
    setInterval: (fn) => { timers.push(fn); return timers.length; }, clearInterval() {},
    Promise,
  };
  if (!opt.late) ctx.firebase = { auth: { Auth } };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(MOD, ctx);
  return { ctx, store, calls, Auth, timers, rec: () => JSON.parse(store.pu_logout_why || 'null') };
}

test('① 부르면 까닭이 남고 로그아웃은 원래대로', () => {
  const b = box({ store: { pu_last_active: String(Date.now() - 65 * 60000), pu_portal_auto: '1' }, hidden: true });
  b.ctx.PuLogoutWhy.why('자동 로그아웃(60분)');
  const r = new b.Auth().signOut();
  assert.equal(r, 'done', '원래 signOut 의 결과를 돌려줘야 합니다');
  assert.equal(b.calls.join(','), 'orig', '로그아웃 자체가 일어나지 않았습니다');
  const rec = b.rec();
  assert.equal(rec.why, '자동 로그아웃(60분)');
  assert.equal(rec.page, 'pu-erp.html');
  assert.ok(rec.idleMin >= 64 && rec.idleMin <= 66, '쉰 분이 틀렸습니다: ' + rec.idleMin);
  assert.equal(rec.hidden, true);
  assert.equal(rec.keep, true);
  /* 까닭은 한 번 쓰면 비운다 — 다음 로그아웃에 옛 까닭이 붙으면 거짓 기록이다 */
  new b.Auth().signOut();
  assert.equal(b.rec().why, '로그아웃');
});

test('② 로그인한 사람이 없거나 익명이면 적지 않는다', () => {
  const none = box({ user: null });
  new none.Auth().signOut();
  assert.equal(none.rec(), null);
  assert.equal(none.calls.length, 1, '적지 않아도 로그아웃은 불려야 합니다');
  const anon = box({ user: { uid: 'x', isAnonymous: true } });
  new anon.Auth().signOut();
  assert.equal(anon.rec(), null, '익명(전자서명 등)은 사람 로그아웃이 아닙니다');
});

test('③ 지난번 까닭 — 기록 · 말없이 풀림 · 오래되면 침묵', () => {
  const T = Date.UTC(2026, 9, 5, 10, 0);
  const why = box({ store: { pu_login_seen_at: String(T - 3600e3),
    pu_logout_why: JSON.stringify({ at: T - 60e3, page: 'pu-erp.html', why: '이알피 로그아웃', idleMin: 3, hidden: false, keep: true }) } });
  const L = why.ctx.PuLogoutWhy.last(T);
  assert.equal(L.kind, 'why');
  assert.match(why.ctx.PuLogoutWhy.text(T), /pu-erp\.html · 이알피 로그아웃 · 3분 쉼 · 로그인 유지 켬/);
  /* 로그인을 다시 본 «뒤»에 아무 기록이 없다 = 로그아웃이 불리지 않았는데 풀렸다 */
  const silent = box({ store: { pu_login_seen_at: String(T - 60e3),
    pu_logout_why: JSON.stringify({ at: T - 3 * 864e5, page: 'enter.html', why: '로그아웃' }) } });
  assert.equal(silent.ctx.PuLogoutWhy.last(T).kind, 'silent');
  assert.match(silent.ctx.PuLogoutWhy.text(T), /로그아웃 단추·자동 로그아웃 없이 풀렸습니다/);
  const old = box({ store: { pu_login_seen_at: String(T - 9 * 864e5) } });
  assert.equal(old.ctx.PuLogoutWhy.last(T), null, '오래된 일을 «지난번»이라 하면 헷갈립니다');
  assert.equal(box({}).ctx.PuLogoutWhy.text(T), '', '처음 쓰는 기기에는 아무 말도 하지 않습니다');
});

test('④ 저장소 보존 청하기는 «로그인 유지» 켠 기기만', async () => {
  let asked = 0;
  const nav = { storage: { persisted: () => Promise.resolve(false), persist: () => { asked++; return Promise.resolve(true); } } };
  const off = box({ navigator: nav });
  assert.equal(await off.ctx.PuLogoutWhy.persist(), false);
  assert.equal(asked, 0, '공용 PC(유지 끔)의 저장소를 붙들면 안 됩니다');
  const on = box({ navigator: nav, store: { pu_portal_auto: '1' } });
  assert.equal(await on.ctx.PuLogoutWhy.persist(), true);
  assert.equal(asked, 1);
  const already = box({ store: { pu_portal_auto: '1' },
    navigator: { storage: { persisted: () => Promise.resolve(true), persist: () => { asked++; return Promise.resolve(true); } } } });
  await already.ctx.PuLogoutWhy.persist();
  assert.equal(asked, 1, '이미 허락된 기기에 또 청하지 않습니다');
});

test('⑤ 파이어베이스가 늦게 실려도 감싼다', () => {
  const b = box({ late: true });
  assert.ok(b.timers.length >= 1, '늦게 실릴 때 다시 보는 장치가 없습니다');
  b.ctx.firebase = { auth: { Auth: b.Auth } };
  b.timers[0]();
  new b.Auth().signOut();
  assert.ok(b.rec(), '늦게 실린 파이어베이스를 못 감쌌습니다');
});

test('⑥ signOut 을 부르는 화면은 모두 이 파일을 싣는다', () => {
  const pages = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html'));
  const miss = [];
  let n = 0;
  pages.forEach((f) => {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    const bare = stripComments(src);
    if (!/\.signOut\(\)/.test(bare)) return;
    n++;
    if (!/<script src="js\/pu-logout-why\.js\?v=\d+"><\/script>/.test(bare)) miss.push(f);
  });
  assert.ok(n >= 10, '로그아웃을 부르는 화면을 거의 못 찾았습니다(' + n + ') — 검사가 눈을 감았습니다');
  assert.deepEqual(miss, [], '★ 이 화면에서 난 로그아웃은 까닭이 안 남습니다 — <script src="js/pu-logout-why.js?v=…"> 를 실으세요');
});

test('⑦ 포털 — 로그인하면 seen·persist, 로그인 화면엔 한 줄', () => {
  const src = fs.readFileSync(path.join(ROOT, 'enter.html'), 'utf8');
  const bare = stripComments(src);
  assert.match(bare, /id="logoutWhy"/, '로그인 화면에 까닭 줄이 없습니다');
  const js = stripJs(src);
  assert.match(js, /PuLogoutWhy\.seen\(\); PuLogoutWhy\.persist\(\);/, '로그인한 때를 적지 않으면 «말없이 풀림»을 못 가립니다');
  assert.match(js, /PuLogoutWhy\.text\(\)/, '로그인 화면이 까닭을 안 보여 줍니다');
  assert.match(js, /PuLogoutWhy\.why\('자동 로그아웃\('/, '포털 자동 로그아웃에 까닭이 안 붙습니다');
});
