/* 부팅 폭풍 감지 — 같은 탭이 되풀이 켜지면 «앱이 스스로 말한다» (대표 제보 2026-09-17 「계속 돈이 새고 있다」)
   ─────────────────────────────────────────────────────────────────────────
   ■ 무엇이 있었나
     서버 통신 기록 165초에 이알피 8번·기업정보함 9번·업무관리 8번이 «처음부터 다시 켜진» 자국.
     한 PC, 약 20초마다. 켤 때마다 큰 표를 전부 다시 받아 시간당 500MB(≈₩700).
     서버 쪽 판 표식은 모두 안정 → 바깥(확장·탭 돌리기)이 새로고침하는 쪽으로 기울었다.
     추측을 끝내려면 앱이 부팅마다 «몇 초 만에·어떤 종류로» 켜졋는지 스스로 찍어야 한다.

   ★ 못 박는 것
     ① 3분 안 3번째 부팅부터 «폭풍»으로 본다 — 2번은 아니다(F5 두 번은 사람이다)
     ② 부팅 시각은 같은 탭에서 이어지는 sessionStorage 에 남는다 — localStorage 면 다른 탭·다른 날이 섞인다
     ③ 3분 넘은 옛 부팅은 걷어낸다 — 아침에 켠 것이 저녁 한 번을 폭풍으로 만들면 안 된다
     ④ 폭풍이면 화면에 띠를 띄우고 PU_BOOT.storm 을 세운다 — 앱(이알피)이 그것으로 받기를 멈춘다
     ⑤ 새로고침 종류(reload/navigate)를 그대로 적는다 — 원인의 «안팎»을 가르는 한 글자
     ⑥ 이알피는 폭풍이면 초기 동기화를 «사람이 누를 때까지» 미룬다 — 한 번 누르면 그 세션은 다시 묻지 않는다 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { cutFn } = require('./cut-fn.js');
const { stripJs } = require('./strip-comments.js');

const ROOT = path.join(__dirname, '..');
const VER = fs.readFileSync(path.join(ROOT, 'js', 'pu-version.js'), 'utf8');
const ERP = stripJs(fs.readFileSync(path.join(ROOT, 'pu-erp.html'), 'utf8'));

/* pu-version.js 를 가짜 창에 싣는다 — 부팅 시각은 넘겨 준 sessionStorage 에 쌓인다 */
function boot(opts) {
  opts = opts || {};
  const sess = opts.session || {};
  const local = opts.local || {};
  const logs = { info: [], warn: [] };
  const body = { kids: [], appendChild(c) { this.kids.push(c); return c; } };
  function el(tag) { return { tagName: tag, style: {}, kids: [], attrs: {}, textContent: '', id: '', tabIndex: 0,
    appendChild(c) { this.kids.push(c); return c; }, setAttribute(k, v) { this.attrs[k] = v; },
    addEventListener() {}, parentNode: null }; }
  const win = {
    document: {
      readyState: 'complete', body, referrer: opts.referrer || '',
      createElement: el, getElementById: id => body.kids.find(k => k.id === id) || null,
      querySelector: () => null, scripts: [], addEventListener() {}
    },
    sessionStorage: { getItem: k => (k in sess ? sess[k] : null), setItem: (k, v) => { sess[k] = String(v); }, removeItem: k => { delete sess[k]; } },
    localStorage: { getItem: k => (k in local ? local[k] : null), setItem: (k, v) => { local[k] = String(v); }, removeItem: k => { delete local[k]; } },
    location: { href: 'https://x.test/pureunall/pu-erp.html', origin: 'https://x.test', pathname: opts.pathname || '/pureunall/pu-erp.html' },
    performance: { getEntriesByType: () => [{ type: opts.navType || 'reload' }] },
    console: { info: m => logs.info.push(m), warn: m => logs.warn.push(m), log() {}, error() {} },
    setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, addEventListener() {},
    fetch: () => Promise.reject(new Error('no')), URL, JSON, Date, Math, Array, String, Number, Object, Promise, Error, RegExp
  };
  if (typeof opts.now === 'number') { const N = opts.now; win.Date = Object.assign(function () { return new Date(N); }, { now: () => N }); }
  win.window = win;
  vm.createContext(win);
  vm.runInContext(VER, win);
  return { win, sess, logs, banner: body.kids.find(k => k.id === 'pu-boot-storm') || null };
}

test('① 첫 부팅·둘째 부팅은 폭풍이 아니다 — F5 두 번은 사람이다', () => {
  const sess = {};
  const a = boot({ session: sess, now: 1000000 });
  assert.equal(a.win.PU_BOOT.count, 1); assert.equal(a.win.PU_BOOT.storm, false); assert.equal(a.banner, null);
  const b = boot({ session: sess, now: 1000000 + 20000 });
  assert.equal(b.win.PU_BOOT.count, 2); assert.equal(b.win.PU_BOOT.storm, false, '★ 두 번째에 폭풍이라 하면 F5 한 번 더 누른 사람을 막는다');
  assert.equal(b.win.PU_BOOT.since, 20, '★ 직전 부팅에서 몇 초인지 적어야 원인을 잰다');
});

test('②★ 3분 안 세 번째 부팅부터 폭풍 — 띠가 뜨고 PU_BOOT.storm 이 선다', () => {
  const sess = {};
  boot({ session: sess, now: 1000000 });
  boot({ session: sess, now: 1000000 + 20000 });
  const c = boot({ session: sess, now: 1000000 + 40000, navType: 'reload' });
  assert.equal(c.win.PU_BOOT.storm, true);
  assert.ok(c.banner, '★★ 폭풍인데 화면에 아무 말이 없다 — 원인이 바깥이면 사람만 끌 수 있는데 알릴 길이 없다');
  assert.match(c.banner.kids[0].textContent, /3번 다시 켜졌습니다/);
  assert.match(c.banner.kids[0].textContent, /브라우저·확장이 새로고침/, '★ reload 인데 «주소로 다시 열림»이라 하면 원인을 안에서 찾게 만든다');
  assert.ok(c.logs.warn.some(m => /다시 켜졌습니다/.test(m)), '★ 콘솔에도 남아야 사람이 보낸 캡처로 알 수 있다');
});

test('③ 3분 넘은 옛 부팅은 걷어낸다 — 아침 것이 저녁 한 번을 폭풍으로 만들지 않는다', () => {
  const sess = {};
  boot({ session: sess, now: 1000000 });
  boot({ session: sess, now: 1000000 + 10000 });
  const late = boot({ session: sess, now: 1000000 + 4 * 60 * 1000 });   // 4분 뒤
  assert.equal(late.win.PU_BOOT.count, 1, '★ 옛 부팅을 안 걷으면 하루 종일 세 번째 부팅마다 폭풍이다');
  assert.equal(late.win.PU_BOOT.storm, false);
});

test('④ 부팅 시각은 sessionStorage 에 남는다 — localStorage 면 다른 탭이 섞인다', () => {
  const f = cutFn(VER, 'function noteBoot(');
  assert.match(f, /sessionStorage\.getItem\(BOOT_KEY\)/);
  assert.match(f, /sessionStorage\.setItem\(BOOT_KEY/);
  assert.ok(!/localStorage/.test(f), '★★ localStorage 에 쌓으면 탭 열 개를 열기만 해도 «폭풍»이 되고, 지난 날 것까지 남는다');
});

test('⑤ 새로고침 종류를 그대로 적는다 — 원인의 «안팎»을 가르는 한 글자', () => {
  const sess = {};
  const a = boot({ session: sess, navType: 'navigate', referrer: 'https://x.test/pureunall/enter.html' });
  assert.equal(a.win.PU_BOOT.type, 'navigate');
  assert.equal(a.win.PU_BOOT.from, '/pureunall/enter.html', '★ 어디서 왔는지가 없으면 「앱이 다시 열었다」를 증명할 수 없다');
  assert.ok(a.logs.info.some(m => /\[부팅\] navigate/.test(m) && /온 곳 \/pureunall\/enter\.html/.test(m)));
});

test('⑥ 이알피는 폭풍이면 초기 동기화를 «사람이 누를 때까지» 미룬다', async () => {
  const gate = cutFn(ERP, 'function _erpBootStormGate(');
  const sync = cutFn(ERP, 'function fbInitialSync(');
  assert.match(sync, /_erpBootStormGate\(\)/, '★ 초기 동기화가 폭풍 문을 안 거친다');
  assert.ok(sync.indexOf('_erpBootStormGate()') < sync.indexOf('_bootKeyPlan()'), '★★ 문은 자료를 받기 «전»에 있어야 한다 — 뒤면 이미 다 받은 뒤다');
  /* 실제로 돌려 본다 — 폭풍이면 약속을 돌려주고, 누르면 풀린다 */
  const sess = {};
  let clicked = null; const body = { kids: [], appendChild(c) { body.kids.push(c); return c; } };
  const ctx = {
    window: { PU_BOOT: { storm: true, count: 5, since: 21, type: 'reload' } },
    sessionStorage: { getItem: k => sess[k] || null, setItem: (k, v) => { sess[k] = v; } },
    document: { body, createElement: t => ({ type: '', style: {}, id: '', textContent: '', kids: [], appendChild(c) { this.kids.push(c); return c; }, set onclick(f) { clicked = f; }, get onclick() { return clicked; }, parentNode: body }) },
    console: { warn() {} }, Promise, Date,
  };
  vm.createContext(ctx);
  vm.runInContext('var _bootStormGateShown = false;\n' + gate, ctx);
  const g = ctx._erpBootStormGate();
  assert.ok(g && typeof g.then === 'function', '★ 폭풍인데 문이 안 닫힌다 — 그대로 917KB 를 받는다');
  let done = false; g.then(() => { done = true; });
  await new Promise(r => setTimeout(r, 0));
  assert.equal(done, false, '★ 사람이 누르기 전에 풀리면 문이 아니다');
  clicked(); await new Promise(r => setTimeout(r, 0));
  assert.equal(done, true, '★ 눌렀는데 이어가지 않는다');
  assert.equal(sess['pu_boot_storm_ok'], '1', '★ 한 번 눌렀으면 이 세션은 다시 묻지 않아야 한다');
  /* 이미 눌렀으면 문이 안 닫힌다 */
  ctx._bootStormGateShown = false;
  assert.equal(ctx._erpBootStormGate(), null, '★ 눌렀는데 다음 부팅에 또 막으면 진짜 쓰는 사람을 괴롭힌다');
  /* 폭풍이 아니면 문이 없다 */
  ctx.window.PU_BOOT = { storm: false }; delete sess['pu_boot_storm_ok']; ctx._bootStormGateShown = false;
  assert.equal(ctx._erpBootStormGate(), null);
});

/* ══ 두 번째 눈 — 부팅마다 «새 탭»이 열리면 sessionStorage 는 매번 빈다 (2026-09-17 저녁 재검증) ══
   배포 1시간 뒤 기록에서도 부팅 8번/165초가 그대로였다 — 첫 눈(탭)만으로는 문이 한 번도 안 닫혔다. */
test('⑧★ 탭은 매번 새것이어도 «이 기기·이 화면» 3분 안 5번째부터는 폭풍', () => {
  const local = {};
  let last = null;
  for (let i = 0; i < 5; i++) last = boot({ session: {}, local, now: 1000000 + i * 20000 });   // 매번 빈 sessionStorage = 새 탭
  assert.equal(last.win.PU_BOOT.count, 1, '탭으로는 늘 첫 부팅이다 — 그래서 첫 눈은 못 본다');
  assert.equal(last.win.PU_BOOT.devCount, 5);
  assert.equal(last.win.PU_BOOT.storm, true, '★★ 새 탭으로 되풀이 열리는 폭풍을 놓치면 문이 영영 안 닫힌다(재검증에서 실제로 그랬다)');
  assert.equal(last.win.PU_BOOT.tabStorm, false); assert.equal(last.win.PU_BOOT.devStorm, true);
  assert.ok(last.banner, '★ 띠가 없다');
  assert.match(last.banner.kids[0].textContent, /매번 새 탭으로 열림/, '★ 어떻게 열리는지(새 탭)를 말해야 사람이 원인을 찾는다');
});

test('⑨ 기기 눈은 4번까지는 참는다 — 포털이 앱을 여는 것·F5 몇 번은 폭풍이 아니다', () => {
  const local = {};
  let last = null;
  for (let i = 0; i < 4; i++) last = boot({ session: {}, local, now: 1000000 + i * 20000 });
  assert.equal(last.win.PU_BOOT.devCount, 4);
  assert.equal(last.win.PU_BOOT.storm, false, '★ 넷에 폭풍이라 하면 F5 몇 번 누른 사람을 막는다');
});

test('⑩ 기기 눈은 «화면 경로별»로 센다 — 앱 여러 개를 연달아 여는 것은 정상이다', () => {
  const local = {};
  boot({ session: {}, local, now: 1000000, pathname: '/pureunall/pu-erp.html' });
  boot({ session: {}, local, now: 1000000 + 1000, pathname: '/pureunall/pu-cards.html' });
  boot({ session: {}, local, now: 1000000 + 2000, pathname: '/pureunall/work.html' });
  boot({ session: {}, local, now: 1000000 + 3000, pathname: '/pureunall/enter.html' });
  const e = boot({ session: {}, local, now: 1000000 + 4000, pathname: '/pureunall/pu-photos.html' });
  assert.equal(e.win.PU_BOOT.devCount, 1, '★★ 화면을 가르지 않으면 포털이 앱 넷을 여는 순간 다섯째 앱이 폭풍이 된다');
  assert.equal(e.win.PU_BOOT.storm, false);
});

test('⑪ 기기 눈도 3분 넘은 것은 걷어낸다', () => {
  const local = {};
  for (let i = 0; i < 4; i++) boot({ session: {}, local, now: 1000000 + i * 1000 });
  const late = boot({ session: {}, local, now: 1000000 + 4 * 60 * 1000 });
  assert.equal(late.win.PU_BOOT.devCount, 1);
});

test('⑬ 이알피 덮개 — 기기 눈만 걸린 폭풍(새 탭)이면 「1번 다시 켜졌다」는 거짓말 대신 기기 수와 «새 탭»을 말한다', () => {
  const gate = cutFn(ERP, 'function _erpBootStormGate(');
  const body = { kids: [], appendChild(c) { body.kids.push(c); return c; } };
  const ctx = {
    window: { PU_BOOT: { storm: true, tabStorm: false, devStorm: true, count: 1, devCount: 6, since: 19, type: 'navigate' } },
    sessionStorage: { getItem: () => null, setItem() {} },
    document: { body, createElement: t => ({ type: '', style: {}, id: '', textContent: '', kids: [], appendChild(c) { this.kids.push(c); return c; }, set onclick(f) {}, parentNode: body }) },
    console: { warn() {} }, Promise, Date, Math,
  };
  vm.createContext(ctx);
  vm.runInContext('var _bootStormGateShown = false;\n' + gate, ctx);
  const g = ctx._erpBootStormGate();
  assert.ok(g, '★ 기기 눈만 걸린 폭풍에 문이 안 닫힌다 — 바로 이것이 재검증에서 새던 자리다');
  const gather = n => (n.textContent || '') + ' ' + (n.kids || []).map(gather).join(' ');   // parentNode 가 body 를 가리켜 JSON 으로는 못 뽑는다(순환)
  const texts = body.kids.map(gather).join(' ');
  assert.match(texts, /새 탭/, '★ 새 탭으로 열리는 폭풍인데 「이 탭이 다시 켜진다」고 하면 사람이 엉뚱한 곳을 본다');
  assert.match(texts, /6번/, '★ 탭 수(1)가 아니라 기기 수(6)를 말해야 한다');
  assert.ok(!/1번/.test(texts), '★★ 「3분 안에 1번 다시 켜졌습니다」는 거짓말이다');
});

test('⑭★ 「자료 받기 계속」을 눌러도 폭풍이 3번 더 이어지면 다시 묻는다 — 한 번 누른 탭이 영영 통째로 받던 구멍', async () => {
  const gate = cutFn(ERP, 'function _erpBootStormGate(');
  const sess = {};
  let clicked = null;
  const body = { kids: [], appendChild(c) { body.kids.push(c); return c; } };
  const ctx = {
    window: { PU_BOOT: { storm: true, tabStorm: true, count: 8, since: 20, type: 'reload' } },
    sessionStorage: { getItem: k => (k in sess ? sess[k] : null), setItem: (k, v) => { sess[k] = String(v); } },
    document: { body, createElement: t => ({ type: '', style: {}, id: '', textContent: '', kids: [], appendChild(c) { this.kids.push(c); return c; }, set onclick(f) { clicked = f; }, get onclick() { return clicked; }, parentNode: body }) },
    console: { warn() {} }, Promise, Date, Math, Number, String,
  };
  vm.createContext(ctx);
  vm.runInContext('var _bootStormGateShown = false;\n' + gate, ctx);
  const boot = () => { ctx._bootStormGateShown = false; return ctx._erpBootStormGate(); };
  assert.ok(boot(), '1번째 폭풍 부팅 — 문');
  clicked();                                                   // 사람이 「계속」
  assert.equal(boot(), null, '누른 직후 다음 부팅은 봐준다');
  assert.equal(boot(), null, '그 다음도 봐준다');
  assert.ok(boot(), '★★ 눌러도 부팅이 3번 더 이어졌다 = 여전히 폭풍 — 다시 물어야 한다. 옛 코드는 영영 열어 두어 요금이 그대로 샜다');
  clicked();
  assert.equal(boot(), null, '다시 누르면 또 봐준다');
});

test('⑮★ 탭 눈도 «화면 경로별» — 로그아웃→포털→포털 새로고침→로그인→이알피 는 폭풍이 아니다 (거짓 경보였다)', () => {
  const sess = {};
  boot({ session: sess, now: 1000000, pathname: '/pureunall/enter.html', navType: 'navigate' });          // 로그아웃 → 포털
  boot({ session: sess, now: 1000000 + 3000, pathname: '/pureunall/enter.html', navType: 'reload' });     // 포털이 스스로 새로고침
  const erp = boot({ session: sess, now: 1000000 + 12000, pathname: '/pureunall/pu-erp.html', navType: 'navigate', referrer: 'https://x.test/pureunall/enter.html' });
  assert.equal(erp.win.PU_BOOT.count, 1, '★★ 같은 탭의 포털 부팅을 이알피 부팅으로 세면 정상 로그인 흐름이 폭풍이 된다(2026-09-17 대표 화면 「3번, 주소로 다시 열림」)');
  assert.equal(erp.win.PU_BOOT.storm, false);
  assert.equal(erp.banner, null, '★ 거짓 경보 띠 — 이알피 문까지 닫혀 대표가 「다시 이렇게 나온다」고 했다');
  /* 같은 화면이 3번이면 여전히 폭풍이다 — 눈이 먼 것이 아니다 */
  boot({ session: sess, now: 1000000 + 20000, pathname: '/pureunall/pu-erp.html' });
  const third = boot({ session: sess, now: 1000000 + 40000, pathname: '/pureunall/pu-erp.html' });
  assert.equal(third.win.PU_BOOT.count, 3); assert.equal(third.win.PU_BOOT.storm, true);
});

test('⑫ 첫 눈(탭)은 여전히 sessionStorage 만 본다 — 기기 눈은 딴 함수에 있다', () => {
  assert.ok(!/localStorage/.test(cutFn(VER, 'function noteBoot(')), '★ 탭 눈에 localStorage 가 섞이면 탭 열 개를 열기만 해도 폭풍이 된다');
  assert.match(cutFn(VER, 'function noteBootDevice('), /localStorage/, '★ 기기 눈은 localStorage 여야 새 탭을 가로질러 센다');
});

test('⑦ 검사에 걸리지 않게 — 띠에 <button 태그 글자를 쓰지 않는다(deployment-gate 가 막는다)', () => {
  assert.doesNotMatch(VER, /<button/, '★ tests/deployment-gate.test.js 가 pu-version.js 에 <button 이 없기를 못 박았다');
});
