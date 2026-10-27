'use strict';
/* 합치기가 «서로 되받아치며» 6초마다 새로고침하던 사고 (2026-10-27 「이 탭이 3분 안에 13번 다시 켜졌습니다」 · 깜빡임)
   에지·크롬이 번갈아 합치고 올리고 새로고침했다. 규칙: 한 기기가 2분에 한 번만 합친다 · 새로고침은 10분에 한 번 · 두 표시는 기기마다(클라우드로 안 간다). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
function 떼기(머리) {
  const i = SRC.indexOf(머리); assert.ok(i > 0, 머리);
  let d = 0, s = false;
  for (let p = i; p < SRC.length; p++) { if (SRC[p] === '{') { d++; s = true; } else if (SRC[p] === '}') { d--; if (s && !d) return SRC.slice(i, p + 1); } }
}

test('① 두 표시(합친 시각·새로고침 시각)는 기기마다 — 클라우드로 안 오간다', () => {
  const skip = SRC.slice(SRC.indexOf('var FB_SKIP='), SRC.indexOf('];', SRC.indexOf('var FB_SKIP=')));
  assert.ok(/'_fbmergeat'/.test(skip) && /'_fbmergereload'/.test(skip), '오가면 다른 기기까지 같이 쉬거나 같이 새로고침한다');
});

test('② 한 기기가 2분에 한 번만 합치고, 쉬는 동안은 조용히 기다린다 — 방금 합쳤으면 클라우드를 읽지도 않는다', async () => {
  const 호출 = { once: 0, later: [] };
  const 저장 = { cm3__fbmergeat: String(Date.now() - 30000) };      /* 30초 전에 합쳤다 */
  const ctx = {
    LS: { get: (k) => (k in 저장 ? 저장[k] : null), set: (k, v) => { 저장[k] = v; return true; } }, NS: 'cm3_',
    fbAutoOn: () => true, KC_SAFE: false, kcNoPush: () => false, fbUid: 'U', _fbMerging: false, _fbMergeFails: 0, _fbBusyWait: 0, _fbMergeLater: false,
    fbDb: { ref: () => ({ once: () => { 호출.once++; return new Promise(() => {}); } }) },
    document: { querySelector: () => null }, window: {}, fbShowNotice() {}, setTimeout: (f, ms) => { 호출.later.push(ms); return 1; }, Date, Number
  };
  vm.createContext(ctx);
  vm.runInContext(떼기('function fbNewerSync('), ctx);
  ctx.fbNewerSync(); ctx.fbNewerSync();
  assert.equal(호출.once, 0, '쉬는 중에는 클라우드를 읽지 않는다');
  assert.equal(호출.later.length, 1, '다시 볼 때를 «한 번만» 잡는다');
  assert.ok(호출.later[0] > 80000 && 호출.later[0] <= 100000, '남은 쉼(약 90초) 뒤');
  /* 충분히 쉬었으면 합친다 */
  저장.cm3__fbmergeat = String(Date.now() - 200000);
  ctx.fbNewerSync();
  assert.equal(호출.once, 1, '쉼이 끝나면 클라우드를 읽는다');
  assert.ok(Date.now() - Number(저장.cm3__fbmergeat) < 5000, '합치기를 시작하며 시각을 적는다');
});

test('③ 새로고침은 10분에 한 번 — 그 사이는 화면만 다시 그린다', () => {
  const f = strip(떼기('function fbNewerSync('));
  assert.ok(/_fbmergereload/.test(f) && /600000/.test(f), '10분 한도');
  const i = f.indexOf('kcReload(1500)');
  assert.ok(i > 0 && f.lastIndexOf('600000', i) > 0 && f.lastIndexOf('600000', i) < i, '새로고침은 한도 «안쪽»에서만');
  assert.ok(/renderHome\(\)/.test(f) && /buildNav\(\)/.test(f), '한도 밖에서는 화면만 다시 그린다');
  assert.ok(/120000/.test(f) && /_fbmergeat/.test(f), '2분 쉼');
});
