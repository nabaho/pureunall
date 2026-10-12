/* 정부지원금 타일은 «의뢰인 업무» 줄 (대표 지시 2026-10-12 「의뢰인 업무로 넣어달라」).
   처음엔 영업관리(sales)에 두었다 — 그때 타일을 끌어 본 사람은 옛 줄이 저장돼 있으니 없던 일로 쳐야 옮겨 간다
   (계약서등관리 2026-10-10 과 같은 자리: tests/portal-docs-row-store.test.js). 포털과 앱 막대가 같은 줄이어야 한다. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const en = fs.readFileSync(path.join(__dirname, '..', 'enter.html'), 'utf8');
const bar = fs.readFileSync(path.join(__dirname, '..', 'js', 'pu-appbar.js'), 'utf8');

test('정부지원금의 제자리는 의뢰인 업무(client) — 포털과 앱 막대 둘 다', () => {
  assert.match(en, /\{ key:'govaid',[^\n]*row:'client' \}/);
  assert.match(bar, /\{ key: 'govaid',\s+row: 'client',/);
});

test('저장된 옛 줄(sales)은 무시하고 제자리로, 사람이 다른 줄로 옮긴 것은 그대로', () => {
  const src = en.match(/var ROW_MOVED_FROM = [^\n]+\n\s*function savedRowOf[\s\S]*?\n  \}/);
  assert.ok(src, 'ROW_MOVED_FROM · savedRowOf 를 찾지 못함');
  const ctx = { tilePrefs: null, rowExists: (id) => ['client', 'store', 'sales', 'inside'].includes(id) };
  vm.createContext(ctx);
  vm.runInContext(src[0], ctx);
  ctx.tilePrefs = { rows: { govaid: 'sales', govbid: 'sales' } };
  assert.strictEqual(ctx.savedRowOf('govaid', 'client'), 'client');
  assert.strictEqual(ctx.savedRowOf('govbid', 'sales'), 'sales');
  ctx.tilePrefs = { rows: { govaid: 'inside' } };
  assert.strictEqual(ctx.savedRowOf('govaid', 'client'), 'inside');
});
