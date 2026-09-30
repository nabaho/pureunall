/* ⚙️ 환경설정 Esc 뒤로 · 🐌 «누가» 멈추게 했나 (대표 지시 2026-09-30)
   「환경설정에서 esc 누르면 뒤로가기」 · 「기업정보함 로그인 할 경우 계속 느려지고 있다 원인 찾아달라」

   ★ 못 박는 것
     ① Esc: 하위 화면 → 환경설정 목록 → 원래 목록. 창·패널이 열려 있으면 그것부터 닫는다. 쓰는 중이면 안 간다
     ② 초시계는 «제 안에서 쓴 시간»을 센다(자식 시간 빼고) · 끝나면 원래 함수로 되돌린다
     ③ 대문자(생성자)·브라우저 것·진단 자신은 안 감싼다
     ④ 멈췄을 때만 이름을 대고, 코드에 안 잡힌 나머지는 «코드 밖(화면 배치·그리기)»으로 말한다
     ⑤ 처음 뜰 때(로그인 직후)도 10초 본다
   node --test tests/cards-esc-prof.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8').split('\r\n').join('\n');

/* ── ① Esc ── */

test('★★★ ① settingsBack — 하위 화면이면 목록으로, 목록이면 원래 화면으로', () => {
  const log = [];
  const ctx = { state: { setSub: 'views' }, renderSettingsPage: () => log.push('render'), closeSettingsPage: () => log.push('close') };
  vm.createContext(ctx);
  vm.runInContext(cutFn(SRC, 'function setSub(') + '\n' + cutFn(SRC, 'function settingsBack('), ctx);
  ctx.settingsBack();
  assert.equal(ctx.state.setSub, ''); assert.deepEqual(log, ['render'], '★ 하위 화면에서 목록으로 안 돌아왔다');
  ctx.settingsBack();
  assert.deepEqual(log, ['render', 'close'], '★ 목록에서 원래 화면으로 안 나갔다');
});

test('★★★ ① Esc 는 창·패널이 열려 있으면 그것부터 · 쓰는 중이면 안 간다', () => {
  const at = SRC.indexOf("if(state.view === 'settings' && !anyOpen && !쓰는중){ e.preventDefault(); settingsBack(); return; }");
  assert.ok(at > 0, '★★ 환경설정 Esc 가 없다');
  const before = SRC.slice(at - 600, at);
  assert.match(before, /const anyOpen = document\.querySelector\('\.modalbg\.open'\) \|\| \(\$\('pcDetail'\)/, '★ 열린 창을 안 본다 — 창을 닫으려던 Esc 가 화면을 나가 버린다');
  assert.match(before, /const 쓰는중 = typing && /, '★ 붙여 넣던 명단이 Esc 한 번에 날아간다');
  assert.ok(SRC.indexOf('closePcDetail();', at) - at < 120, '★ 환경설정이 아니면 예전처럼 창을 닫아야 한다');
});

/* ── ②③ 초시계 ── */

function prof(win) {
  const ctx = { window: win, performance: { now: () => win._t }, Object, Function, Array };
  vm.createContext(ctx);
  vm.runInContext(SRC.match(/^const CO_PROF_RE = [^\n]*$/m)[0].replace('const ', 'var ') + '\n' + cutFn(SRC, 'function coProfStart('), ctx);
  return ctx.coProfStart;
}

test('★★★ ② «제 안에서 쓴 시간»을 센다 — 부모 시간에서 자식 시간을 뺀다 · 끝나면 되돌린다', () => {
  const win = { _t: 0 };
  win.child = function () { win._t += 300; };
  win.parent = function () { win._t += 100; win.child(); win._t += 50; };
  const origParent = win.parent, origChild = win.child;
  const stop = prof(win)();
  assert.notEqual(win.parent, origParent, '감싸지 않았다');
  win.parent();
  const hot = stop();
  const by = Object.fromEntries(Array.from(hot).map(h => [h.name, h.ms]));
  assert.equal(by.child, 300); assert.equal(by.parent, 150, '★★ 부모가 자식 시간까지 떠안았다 — 범인을 잘못 짚는다');
  assert.equal(hot.jsMs, 450);
  assert.equal(win.parent, origParent, '★★★ 끝났는데 원래 함수로 안 되돌렸다'); assert.equal(win.child, origChild);
});

test('★★ ③ 대문자(생성자)·속성 단 함수·진단 자신은 안 감싼다', () => {
  const win = { _t: 0 };
  win.Maker = function () {}; win.tagged = function () {}; win.tagged.flag = 1;
  win.coWatchStart = function () {}; win.plain = function () {};
  const keep = { Maker: win.Maker, tagged: win.tagged, coWatchStart: win.coWatchStart };
  const stop = prof(win)();
  Object.keys(keep).forEach(k => assert.equal(win[k], keep[k], '★ ' + k + ' 를 감쌌다'));
  assert.notEqual(win.plain, undefined);
  stop();
});

/* ── ④⑤ 알림 ── */

test('★★ ④ 멈췄을 때만 이름을 대고, 코드 밖 시간을 따로 말한다', () => {
  const ctx = {}; vm.createContext(ctx);
  vm.runInContext(cutFn(SRC, 'function coWatchVerdict('), ctx);
  const hot = [{ name: 'findSimilarGroups', ms: 420, n: 1 }];
  const 멈춤 = Array.from(ctx.coWatchVerdict({ blockedMs: 900, renders: 1, builds: 0, writes: 0, parked: 0, pending: 0, hot, jsMs: 450, secs: 10 }));
  assert.ok(멈춤.some(l => /10초 중 900ms/.test(l)));
  assert.ok(멈춤.some(l => /🐌 오래 걸린 곳: findSimilarGroups 420ms/.test(l)), '★★ 범인 이름을 안 댄다');
  assert.ok(멈춤.some(l => /코드 밖\(화면 배치·그리기\) 약 450ms/.test(l)), '★ 함수에 안 잡힌 시간을 말하지 않는다');
  const 멀쩡 = Array.from(ctx.coWatchVerdict({ blockedMs: 100, renders: 1, builds: 0, writes: 0, parked: 0, pending: 0, hot, jsMs: 90 }));
  assert.ok(!멀쩡.some(l => /🐌/.test(l)), '★ 멀쩡할 때 이름을 대면 늘 무언가가 범인처럼 보인다');
});

test('★★ ⑤ 처음 뜰 때(로그인 직후)도 10초 본다', () => {
  assert.match(SRC, /window\.addEventListener\('load', function\(\)\{ try\{ coWatchStart\('처음 뜰 때'\); \}catch\(_\)\{\} \}\);/);
  assert.match(cutFn(SRC, 'function coWatchStart('), /언제 === '처음 뜰 때' \? 10 : 5/);
});
