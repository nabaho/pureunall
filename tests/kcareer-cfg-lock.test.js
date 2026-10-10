'use strict';
/* 🔒 환경설정 잠금 (대표 지시 2026-10-09 「환경설정 혹시라도 다른 사람이 들어오면 안된다」)
   못 박는 것:
     ① PIN 이 있으면 들어올 때 잠긴다 · 틀린 PIN 은 안 열린다 · 맞는 PIN 은 열린다(신분증 PIN 하나)
     ② 5분 손대지 않으면 · 다른 화면으로 가면 · 창을 가리면 · 「지금 잠그기」면 다시 잠긴다
     ③ PIN 이 없는 기기는 잠그지 못한다 — 대신 빨간 띠로 말한다
     ④ 환경설정은 «대표 본인»('owner')만 — 관리자·확인 중에는 안 연다
     ⑤ 잠겨 있으면 잠금 칸 말고는 아무것도 안 보인다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
function 떼기(머리) {
  const i = SRC.indexOf(머리); assert.ok(i > 0, 머리);
  let d = 0, s = false;
  for (let p = i; p < SRC.length; p++) { if (SRC[p] === '{') { d++; s = true; } else if (SRC[p] === '}') { d--; if (s && !d) return SRC.slice(i, p + 1); } }
}

function 세상() {
  const store = {}, 알림 = [], cls = new Set(), 칸 = {};
  const el = (id) => (칸[id] = 칸[id] || { id, value: '', style: {}, focus() {}, classList: { contains: (c) => c === 'active' && id === 'page-settings' } });
  const 듣기 = {};
  const ctx = {
    console: { error() {}, warn() {}, log() {} }, JSON, Object, Array, String, Number, Date, Math, Uint8Array, TextEncoder, TextDecoder,
    crypto: webcrypto, window: {}, NS: 'cm3_', 알림, store,
    LS: { get: (k) => (k in store ? store[k] : null), set: (k, v) => { store[k] = v; return true; }, remove: (k) => { delete store[k]; } },
    toast: (m) => 알림.push(String(m)), _safe: (f) => { try { f(); } catch (e) {} },
    showIDOverlay() {}, setTimeout: (f) => f(), setInterval: () => 1, clearInterval() {},
    btoa: (s) => Buffer.from(s, 'binary').toString('base64'), atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    document: {
      body: { classList: { add: (c) => cls.add(c), remove: (c) => cls.delete(c), contains: (c) => cls.has(c),
        toggle: (c, on) => (on ? cls.add(c) : cls.delete(c)) } },
      getElementById: el, querySelector: () => null, visibilityState: 'visible',
      addEventListener: (ev, f) => { (듣기[ev] = 듣기[ev] || []).push(f); },
    },
  };
  ctx.window.crypto = webcrypto;
  vm.createContext(ctx);
  const 쓸것 = ['function abToB64(', 'function b64ToAb(', 'function hasIDPin(', 'function _idCryptoOK(', 'async function _deriveIdKey(',
    'async function _persistIdDocs(', 'async function _decryptIdDocs(', 'function lockIDDocs(', 'function _cfgActive(', 'function kcCfgApply(',
    'function kcCfgLock(', 'async function kcCfgUnlock(', 'function _cfgArm(', 'function _cfgBind('];
  vm.runInContext('var _idUnlocked=false, _idKey=null, _idDocs=null;\n' + SRC.match(/var KC_CFG_IDLE_MS=[^\n]*/)[0] + '\n' + 쓸것.map(떼기).join('\n'), ctx);
  return { ctx, 잠김: () => cls.has('cfg-locked'), 칸: el, 듣기 };
}
async function PIN정하기(w, pin) {
  await vm.runInContext(`(async function(){ var salt=crypto.getRandomValues(new Uint8Array(16)); LS.set(NS+'id_salt', abToB64(salt.buffer));
    _idKey=await _deriveIdKey('${pin}', salt); _idDocs=[]; await _persistIdDocs(); _idKey=null; _idDocs=null; })()`, w.ctx);
}
const 넣고풀기 = async (w, pin) => { w.칸('cfgPinInput').value = pin; await vm.runInContext('kcCfgUnlock()', w.ctx); };

test('① PIN 이 있으면 들어올 때 잠기고 · 틀리면 안 열리고 · 맞으면 열린다', async () => {
  const w = 세상(); await PIN정하기(w, '4826');
  vm.runInContext('kcCfgApply()', w.ctx);
  assert.equal(w.잠김(), true, '들어오면 잠김');
  await 넣고풀기(w, '1111');
  assert.equal(w.잠김(), true, '틀린 PIN');
  assert.ok(w.ctx.알림.some((m) => /틀렸/.test(m)));
  assert.equal(w.칸('cfgPinInput').value, '', '틀린 PIN 은 칸에서 지운다');
  await 넣고풀기(w, '4826');
  assert.equal(w.잠김(), false, '맞는 PIN');
  assert.equal(vm.runInContext('_idUnlocked', w.ctx), true, '신분증도 함께 열린다 — PIN 하나');
});

test('② 5분 손대지 않으면 · 창을 가리면 · 「지금 잠그기」면 다시 잠긴다', async () => {
  const w = 세상(); await PIN정하기(w, '4826');
  vm.runInContext('kcCfgApply()', w.ctx); await 넣고풀기(w, '4826');
  vm.runInContext('kcCfgApply()', w.ctx);
  assert.equal(w.잠김(), false, '방금 푼 것은 다시 들어와도 열려 있다');
  vm.runInContext('_cfgLastAct=Date.now()-KC_CFG_IDLE_MS-1; kcCfgApply()', w.ctx);
  assert.equal(w.잠김(), true, '5분 지나 들어오면 잠김');
  await 넣고풀기(w, '4826');
  w.ctx.document.visibilityState = 'hidden'; (w.듣기.visibilitychange || []).forEach((f) => f());
  assert.equal(w.잠김(), true, '창을 가리면 잠김');
  /* 2026-10-10 검토: 가릴 때는 «화면만» — 폰에서 신분증을 찍으려고 카메라를 열면 창이 가려진다.
     그때 신분증 보관함까지 잠그면 돌아와 담는 순간 버려졌다 */
  assert.equal(vm.runInContext('_idUnlocked', w.ctx), true, '가릴 때는 신분증 보관함을 잠그지 않는다');
  w.ctx.document.visibilityState = 'visible';
  await 넣고풀기(w, '4826');
  vm.runInContext("kcCfgLock(false,'idle')", w.ctx);
  assert.equal(vm.runInContext('_idUnlocked', w.ctx), false, '5분 잠금은 신분증도 함께 잠근다');
  await 넣고풀기(w, '4826');
  vm.runInContext('kcCfgLock(true)', w.ctx);
  assert.equal(w.잠김(), true, '지금 잠그기');
  assert.equal(vm.runInContext('_idUnlocked', w.ctx), false, '지금 잠그기도 신분증까지');
  assert.equal(KC_IDLE(), 5 * 60 * 1000);
  function KC_IDLE() { return vm.runInContext('KC_CFG_IDLE_MS', w.ctx); }
});

test('③ PIN 이 없는 기기는 잠그지 못한다 — 빨간 띠로 말한다', () => {
  const w = 세상();
  vm.runInContext('kcCfgApply()', w.ctx);
  assert.equal(w.잠김(), false);
  assert.equal(w.칸('cfgPinNudge').style.display, '', '띠가 보인다');
  vm.runInContext('kcCfgLock(true)', w.ctx);
  assert.ok(w.ctx.알림.some((m) => /PIN 이 없어/.test(m)), '잠그기를 눌러도 «왜 안 되는지» 말한다');
});

test('④ 환경설정은 대표 본인(owner)만 · 떠나면 잠근다', () => {
  const nav = strip(떼기('function nav_to('));
  assert.ok(/id==='page-settings'\s*&&\s*_lk!=='owner'/.test(nav), '관리자·확인 중이 아니라 «대표 본인»일 때만');
  assert.ok(!/_me\.isAdmin/.test(nav.slice(0, nav.indexOf("_lk!=='owner'") + 40)), '관리자 잣대는 더 쓰지 않는다');
  assert.ok(/id!=='page-settings'\)\s*_safe\(function\(\)\{\s*kcCfgLock\(\);/.test(nav), '다른 화면으로 가면 잠근다');
  assert.ok(nav.indexOf('kcCfgApply') > nav.indexOf("_lk!=='owner'"), '들어올 때 잠금 판정');
});

test('⑤ 잠겨 있으면 잠금 칸 말고는 아무것도 안 보인다 · PIN 칸은 폰 16px', () => {
  assert.ok(/body\.cfg-locked #page-settings>\.page>\*:not\(#cfgLock\)\{display:none!important\}/.test(SRC));
  assert.ok(/<div id="cfgLock"[^>]*>/.test(SRC) && /id="cfgPinInput"[^>]*font-size:16px/.test(SRC));
  const page = SRC.slice(SRC.indexOf('id="page-settings"'), SRC.indexOf('<div class="tabrow">', SRC.indexOf('id="page-settings"')));
  assert.ok(/id="cfgLock"/.test(page), '잠금 칸은 환경설정 .page 바로 아래(CSS 가 그 자리를 본다)');
});

test('⑥ 2026-10-10 검토 — 맞춰 볼 암호문이 없으면 열지 않는다 · 창을 닫는다 · 잠긴 칸에 쓰면 말한다', async () => {
  const w = 세상(); await PIN정하기(w, '4826');
  delete w.ctx.store['cm3_id_docs_enc'];
  vm.runInContext('kcCfgApply()', w.ctx);
  await 넣고풀기(w, '0000');
  assert.equal(w.잠김(), true, '암호문이 없으면 아무 PIN 도 맞지 않는다');
  const lock = strip(떼기('function kcCfgLock('));
  assert.ok(/\.modal-ov\.open/.test(lock) && /closeForm\(\)/.test(lock), '환경설정 밖에 뜬 창(신분증 크게 보기·계좌 입력)도 닫는다');
  assert.ok(/why!=='hidden'/.test(lock), '가릴 때는 신분증 보관함을 잠그지 않는다');
  const setFn = strip(떼기('function set(key,arr)'));
  assert.ok(/key==='id_docs'[\s\S]*?return false;/.test(setFn), '잠긴 신분증 칸에 쓰면 false — 조용히 버리지 않는다');
  const save = strip(떼기('function saveForm('));
  assert.ok((save.match(/set\(def\.store,db\)===false\) return;/g) || []).length >= 2, '못 담았으면 「등록 완료」를 띄우지 않는다');
  const per = strip(떼기('async function _persistIdDocs('));
  assert.ok(/===false/.test(per) && /return true;/.test(per), '담았는지 돌려준다');
  assert.ok(/if\(!\(await _persistIdDocs\(\)\)\) throw/.test(SRC), 'PIN 정하기는 암호문을 못 담으면 평문을 지우기 전에 멈춘다');
});
