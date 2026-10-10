/* 계약서등관리 타일은 «자료함» 줄 (대표 2026-10-05 «자료함으로», 2026-10-10 「자료함으로 옮겨줘」).
   10-05 에 row 만 바꿨더니, 그 전에 타일을 한 번이라도 끈 사람은 저장된 옛 줄(client)이 이겨
   의뢰인 업무 줄에 그대로 남았다. 옛 줄 값은 없던 일로 친다. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const en = fs.readFileSync(path.join(__dirname, '..', 'enter.html'), 'utf8');

test('계약서등관리 앱의 제자리는 자료함(store)', () => {
  assert.match(en, /\{ key:'docs',\s+name:'계약서등관리',[^\n]*row:'store' \}/);
});

test('저장된 옛 줄(client)은 무시하고 제자리로, 다른 앱·다른 줄은 그대로', () => {
  const src = en.match(/var ROW_MOVED_FROM = [^\n]+\n\s*function savedRowOf[\s\S]*?\n  \}/);
  assert.ok(src, 'ROW_MOVED_FROM · savedRowOf 를 찾지 못함');
  const ctx = { tilePrefs: null, rowExists: (id) => ['client', 'store', 'inout'].includes(id) };
  vm.createContext(ctx);
  vm.runInContext(src[0], ctx);
  ctx.tilePrefs = { rows: { docs: 'client', erp: 'client', cards: 'store', photos: 'gone' } };
  assert.strictEqual(ctx.savedRowOf('docs', 'store'), 'store');
  assert.strictEqual(ctx.savedRowOf('erp', 'client'), 'client');
  assert.strictEqual(ctx.savedRowOf('cards', 'store'), 'store');
  assert.strictEqual(ctx.savedRowOf('photos', 'store'), 'store');
  ctx.tilePrefs = { rows: { docs: 'inout' } };
  assert.strictEqual(ctx.savedRowOf('docs', 'store'), 'inout');
});
