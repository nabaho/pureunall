'use strict';
/* 폭풍은 «횟수»가 아니라 «고름»으로 가른다 (대표 화면 2026-09-18 저녁)
   ─────────────────────────────────────────────────────────────────────────
   ■ 무엇이 있었나
     대표님이 나스(192.168.0.21) 인증서를 브라우저에 받으시느라 그 주소를 열었다 닫았다
     하시며 이알피를 몇 번 새로고침하셨다. 그러자 빨간 띠가 떴다 —
     「3분 안에 3번 다시 켜졌습니다 (브라우저·확장이 새로고침, 마지막은 47초 전).
       … 브라우저의 자동 새로고침 확장이나 탭 돌리기를 꺼 주세요.」
     대표님은 끌 것을 찾으셨고, 없어서 나에게 「탭돌리기 꺼주세요 이것 처리해라」고 하셨다.
     **끌 것이 없었다.** 이 감지기의 거짓 경보는 이것으로 세 번째다(9/17 저녁·9/18 낮·9/18 저녁).

   ■ 까닭
     지금까지는 «몇 번 켜졌나»만 셌다. 그런데 새로고침을 손으로 세 번 누르는 것은 아주 흔하다.
     횟수만으로는 사람과 기계가 갈리지 않는다.

   ■ 가르는 것
     기계(자동 새로고침 확장·탭 돌리기·감시 도구)는 «고르게» 켠다 — 20초·20초·20초.
     사람은 못 그런다 — 47초·9초·2분. 그래서 횟수«와» 고름이 둘 다 서야 폭풍이다.

   ★ 못 박는 것 — 값이 아니라 규칙이다
     ① 횟수를 넘겨도 간격이 제각각이면 띠를 안 띄운다 (대표 화면 그대로)
     ② 고르게 되풀이되면 그대로 잡는다 (2026-09-17 진짜 폭풍 — 20초마다)
     ③ 띠는 «끄라»고 시키기 전에 «왜 사람이 아닌지» 근거를 먼저 댄다
     ④ 잰 간격을 PU_BOOT 로 내보낸다 — 이알피 덮개가 같은 말을 해야 하니까
     ⑤ 못 가려도 콘솔에는 남는다 — 알리지 않는 것과 안 보는 것은 다르다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn.js');

const ROOT = path.join(__dirname, '..');
const VER = fs.readFileSync(path.join(ROOT, 'js', 'pu-version.js'), 'utf8');
const ERP = fs.readFileSync(path.join(ROOT, 'pu-erp.html'), 'utf8');

/* pu-version.js 를 가짜 창에 싣는다. 같은 sessionStorage 를 넘기면 «같은 탭»이다. */
function boot(opts) {
  const sess = opts.session || {};
  const local = opts.local || {};
  const logs = { info: [], warn: [] };
  const body = { kids: [], appendChild(c) { this.kids.push(c); return c; } };
  const el = () => ({ style: {}, kids: [], attrs: {}, textContent: '', id: '', tabIndex: 0,
    appendChild(c) { this.kids.push(c); return c; }, setAttribute(k, v) { this.attrs[k] = v; },
    addEventListener() {}, parentNode: null });
  const win = {
    document: { readyState: 'complete', body, referrer: '', createElement: el,
      getElementById: id => body.kids.find(k => k.id === id) || null,
      querySelector: () => null, scripts: [], addEventListener() {} },
    sessionStorage: { getItem: k => (k in sess ? sess[k] : null), setItem: (k, v) => { sess[k] = String(v); }, removeItem: k => { delete sess[k]; } },
    localStorage: { getItem: k => (k in local ? local[k] : null), setItem: (k, v) => { local[k] = String(v); }, removeItem: k => { delete local[k]; } },
    location: { href: 'https://x.test/pureunall/pu-erp.html', origin: 'https://x.test', pathname: opts.pathname || '/pureunall/pu-erp.html' },
    performance: { getEntriesByType: () => [{ type: opts.navType || 'reload' }] },
    console: { info: m => logs.info.push(m), warn: m => logs.warn.push(m), log() {}, error() {} },
    setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, addEventListener() {},
    fetch: () => Promise.reject(new Error('no')),
    URL, JSON, Date: Object.assign(function () { return new Date(opts.now); }, { now: () => opts.now }),
  };
  win.window = win;
  vm.createContext(win);
  vm.runInContext(VER, win);
  return { win, logs, banner: body.kids.find(k => k.id === 'pu-boot-storm') || null };
}

/* 같은 탭에서 주어진 «초 간격»대로 잇따라 켠다 */
function bootSeries(gapsSec, opts) {
  const sess = {}, local = {};
  let t = 5000000, last = boot(Object.assign({ session: sess, local, now: t }, opts));
  gapsSec.forEach(g => { t += g * 1000; last = boot(Object.assign({ session: sess, local, now: t }, opts)); });
  return last;
}

test('①★★ 사람이 제멋대로 새로고침한 것은 폭풍이 아니다 — 대표 화면 그대로', () => {
  /* 인증서를 받으시며: 47초 뒤, 9초 뒤, 55초 뒤, 15초 뒤, 40초 뒤 — 여섯 번이다(문턱을 넘겼다) */
  const r = bootSeries([47, 9, 55, 15, 40], { navType: 'reload' });
  assert.ok(r.win.PU_BOOT.count >= 5, '횟수로는 문턱을 넘겼다 — 그래서 옛 코드가 띠를 띄웠다');
  assert.equal(r.win.PU_BOOT.even, false, '★ 47·9·120·15·40초를 «고르다»고 하면 사람과 기계가 안 갈린다');
  assert.equal(r.win.PU_BOOT.storm, false);
  assert.equal(r.banner, null,
    '★★ 바로 이 띠가 대표님께 「탭 돌리기를 꺼 주세요」라고 시켰고, 끌 것이 없었다');
});

test('②★ 고르게 되풀이되는 진짜 폭풍은 그대로 잡는다 — 2026-09-17 자국(20초마다)', () => {
  const r = bootSeries([20, 20, 21, 19, 20, 20, 20], { navType: 'reload' });
  assert.equal(r.win.PU_BOOT.even, true, '★★ 고름을 보느라 진짜 폭풍을 놓치면 요금이 그대로 샌다');
  assert.equal(r.win.PU_BOOT.storm, true);
  assert.ok(r.banner, '★ 진짜 폭풍인데 아무 말이 없다');
});

test('③★ 띠는 «끄라»고 시키기 전에 «왜 사람이 아닌지»를 먼저 댄다', () => {
  const r = bootSeries([20, 20, 20, 20, 20], { navType: 'reload' });
  const t = r.banner.kids[0].textContent;
  assert.match(t, /고르게/, '★ 근거 없이 시키면 받는 사람은 끌 것을 찾다 못 찾는다');
  assert.match(t, /사람이 누르면/, '★★ 「왜 내 탓인가」가 안 적혀 있으면 지시가 아니라 야단이다');
  const before = t.indexOf('고르게'), order = t.indexOf('꺼 주세요');
  assert.ok(before > -1 && order > -1 && before < order, '★ 근거가 지시보다 뒤에 오면 읽는 사람은 지시부터 읽는다');
});

test('④ 잰 간격을 PU_BOOT 로 내보낸다 — 이알피 덮개가 같은 말을 해야 한다', () => {
  const r = bootSeries([20, 20, 20, 20, 20], { navType: 'reload' });
  assert.equal(typeof r.win.PU_BOOT.every, 'number', '★ 간격을 안 내보내면 덮개는 옛 문장을 그대로 쓴다');
  assert.ok(Math.abs(r.win.PU_BOOT.every - 20) <= 2);
  const gate = cutFn(ERP, 'function _erpBootStormGate(');
  assert.match(gate, /PU_BOOT\.every/, '★ 덮개가 간격을 안 읽는다');
  assert.match(gate, /고르게/, '★★ 띠는 근거를 대는데 덮개만 옛말로 시키면 어긋난 안내가 남는다');
  assert.match(gate, /사람이 누르면/);
});

test('⑤ 못 가려도 콘솔에는 남는다 — 알리지 않는 것과 안 보는 것은 다르다', () => {
  const r = bootSeries([47, 9, 55, 15, 40], { navType: 'reload' });
  assert.ok(r.logs.info.some(m => /간격/.test(m)), '★ 잰 것을 안 찍으면 다음 사람이 또 추측한다');
  assert.ok(r.logs.info.some(m => /제각각/.test(m)), '★ 왜 안 알렸는지가 없으면 「감지기가 죽었나」를 의심한다');
  assert.equal(r.logs.warn.length, 0, '★ 알리지 않기로 했으면 경고도 안 찍는다');
});

test('⑥ 간격이 셋보다 적으면 고름을 판단하지 않는다 — 둘은 우연히 닮는다', () => {
  const f = cutFn(VER, 'function gapStat(');
  assert.match(f, /gaps\.length < 3/, '★ 간격 둘로 「고르다」고 하면 F5 세 번이 다시 폭풍이 된다');
  const r = bootSeries([20, 20], { navType: 'reload' });
  assert.equal(r.win.PU_BOOT.even, false);
  assert.equal(r.win.PU_BOOT.storm, false);
});

test('⑦ 문턱과 고름은 «둘 다» 서야 한다 — 하나만으로는 갈리지 않는다', () => {
  const f = cutFn(VER, 'function noteBoot(');
  assert.match(f, /tabMany && stat\.even/, '★ 횟수만으로 폭풍이라 하면 2026-09-18 거짓 경보가 그대로 돌아온다');
  assert.match(f, /devMany && stat\.even/);
  /* 아주 고르게 켜져도 넷이면 폭풍이 아니다 — 문턱 쪽도 살아 있어야 한다 */
  const few = bootSeries([20, 20, 20], { navType: 'reload' });
  assert.equal(few.win.PU_BOOT.count, 4);
  assert.equal(few.win.PU_BOOT.storm, false, '★ 넷에 폭풍이라 하면 포털이 앱 넷을 여는 것도 폭풍이다');
  assert.equal(few.banner, null);
});
