/* 받는 화면: 똑같은 메일 첨부는 사진첩에 두 번 안 넣는다 — 지우지 않고 «같은 첨부»로만 적는다 (대표 지시 2026-10-31)
   firstOfFile 을 실제로 꺼내 돌려, «먼저 차지한 쪽만 true» 라는 규칙을 본다. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'remember-intake.html'), 'utf8');

function load() {
  const m = html.match(/var FP_ROOT[\s\S]*?function firstOfFile[\s\S]*?\r?\n  }\r?\n/);
  assert.ok(m, 'firstOfFile 을 찾지 못했습니다');
  const store = {};
  const db = { ref: (p) => ({
    transaction: (fn) => { const r = fn(store[p]); if (r === undefined) return Promise.resolve({ committed: false }); store[p] = r; return Promise.resolve({ committed: true }); },
    remove: () => { delete store[p]; return Promise.resolve(); } }) };
  const ctx = { db, window: { crypto: crypto.webcrypto }, crypto: crypto.webcrypto, Uint8Array, Promise, Date, String, Array };
  vm.createContext(ctx);
  vm.runInContext(m[0] + '\nthis.firstOfFile = firstOfFile;', ctx);
  return { f: ctx.firstOfFile, store };
}

test('같은 내용은 두 번째부터 first=false', async () => {
  const { f } = load();
  const a = await f(new Uint8Array([1, 2, 3, 4]), 'm1');
  const b = await f(new Uint8Array([1, 2, 3, 4]), 'm2');
  assert.strictEqual(a.first, true);
  assert.strictEqual(b.first, false);
});

test('내용이 다르면 둘 다 first=true', async () => {
  const { f } = load();
  assert.strictEqual((await f(new Uint8Array([1, 2, 3]), 'm1')).first, true);
  assert.strictEqual((await f(new Uint8Array([1, 2, 4]), 'm2')).first, true);
});

test('사진첩에 못 갔으면 release 로 돌려놓아 다음에 다시 넣을 수 있다', async () => {
  const { f, store } = load();
  const a = await f(new Uint8Array([9, 9]), 'm1');
  await a.release();
  assert.strictEqual(Object.keys(store).length, 0);
  assert.strictEqual((await f(new Uint8Array([9, 9]), 'm2')).first, true);
});

test('docOne 은 지문을 확인한 «뒤에» 넘기고, 겹치면 지우지 않고 dup 으로만 적는다', () => {
  const one = html.slice(html.indexOf('function docOne'));
  assert.ok(one.indexOf('firstOfFile(') > -1 && one.indexOf('firstOfFile(') < one.indexOf('PuHandoff.put('), '지문 확인이 넘기기보다 앞이어야 합니다');
  assert.ok(/st:\s*'dup'/.test(one), "겹침은 st:'dup' 으로 적습니다");
  assert.ok(!/\.remove\(\)|deletePhoto|dropDup/.test(one.slice(0, one.indexOf('function docFlush'))), '겹침 처리에서 지우는 길을 부르지 않습니다');
});
