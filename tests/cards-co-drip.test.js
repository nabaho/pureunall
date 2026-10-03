/* ⚡ 기업 상세 목록 — 나눠 놓기 · 몰려오면 끝에 한 번 (대표 지시 2026-10-03 「기업상세도 확인」 → 「진행」)
   대표 크롬 실측: 회사 200줄 표를 화면에 놓는 데 115ms(20줄 10ms) · 들어갈 때 두 번.
   ★ 못 박는 것
     ① 놓기 «전»에 41번째 줄부터 떼어 두고, 곧이어 40줄씩 «빠짐없이» 붙인다(차례 그대로)
     ② 새로 그려 옛 표가 화면에서 떨어지면 붙이던 것은 멈춘다
     ③ 굴려 둔 같은 목록은 한 번에 놓는다(자리 지키기) · 처음/바뀐 목록/안 굴린 것만 나눈다
     ④ 목록 그리기도 몰려오면 끝에 한 번
   node --test tests/cards-co-drip.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8').split('\r\n').join('\n');

function fakeTable(n) {
  const tb = { rows: [], isConnected: true,
    appendChild(f) { (f.kids || [f]).forEach(r => { r.parent = tb; tb.rows.push(r); }); } };
  for (let i = 0; i < n; i++) tb.rows.push({ id: i, parent: tb, remove() { tb.rows.splice(tb.rows.indexOf(this), 1); this.parent = null; } });
  return tb;
}
function load(tb) {
  const q = [];
  const ctx = { Array, setTimeout: fn => { q.push(fn); return q.length; },
    document: { createDocumentFragment: () => ({ kids: [], appendChild(r) { this.kids.push(r); } }) } };
  vm.createContext(ctx);
  vm.runInContext([SRC.match(/^const CO_DRIP_FIRST = \d+, CO_DRIP_STEP = \d+;$/m)[0].replace('const', 'var'),
    cutFn(SRC, 'function coRowsDripStart(')].join('\n'), ctx);
  const root = { querySelector: s => s === 'table.cotbl > tbody' ? tb : null };
  return { ctx, root, run: () => { let k = 0; while (q.length && k++ < 50) q.shift()(); } };
}

test('★★★ ① 앞 40줄만 먼저 · 나머지는 곧이어 빠짐없이, 차례 그대로', () => {
  const tb = fakeTable(200); const { ctx, root, run } = load(tb);
  const left = ctx.coRowsDripStart(root);
  assert.equal(tb.rows.length, 40, '★★★ 놓기 전에 줄을 안 뗐다 — 200줄을 한 번에 잰다');
  assert.equal(left, 160);
  run();
  assert.equal(tb.rows.length, 200, '★★★ 떼어 둔 줄을 다 안 붙였다 — 회사가 사라진다');
  assert.deepEqual(tb.rows.map(r => r.id), Array.from({ length: 200 }, (_, i) => i), '★ 차례가 뒤섞였다');
});

test('★★ 40줄 이하면 손대지 않는다', () => {
  const tb = fakeTable(30); const { ctx, root } = load(tb);
  assert.equal(ctx.coRowsDripStart(root), 0); assert.equal(tb.rows.length, 30);
});

test('★★ ② 새로 그려 옛 표가 떨어지면 붙이던 것은 멈춘다', () => {
  const tb = fakeTable(200); const { ctx, root, run } = load(tb);
  ctx.coRowsDripStart(root); tb.isConnected = false; run();
  assert.equal(tb.rows.length, 40, '★ 화면에 없는 옛 표에 계속 붙였다');
});

test('★★★ ③ 굴려 둔 같은 목록은 한 번에 · ④ 목록 그리기도 몰려오면 끝에 한 번', () => {
  const rp = cutFn(SRC, 'function renderCoPage(');
  assert.match(rp, /if\(\(!sameList \|\| !keepTop\) && typeof coRowsDripStart === 'function'\) coRowsDripStart\(el\);\s*\n\s*const body = el\.querySelector\('\.cobody'\);/,
    '★★★ 나눠 놓기가 자리 되꽂기보다 뒤에 있거나 조건이 다르다');
  assert.match(rp, /if\(typeof coPageBurst === 'function' && coPageBurst\(\)\) return;/, '★ 몰려오는 그리기를 안 묶는다');
  assert.match(SRC, /\.cotbl\{[^}]*table-layout:fixed/, '★ 표 칸이 고정이 아니면 붙일 때마다 앞줄을 다시 잰다');
});
