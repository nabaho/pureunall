/* 업체 종료 — 미입금 자문료 정리 (2026-10-11 검토 §5)
   실행: node --test tests/erp-co-close-incomes.test.js

   ── 지키는 규칙 ──
   ① 고르는 잣대는 companyId — 이름이 같은 다른 업체(지점·동명 법인)의 돈을 함께 지우지 않는다.
      companyId 없는 줄은 «정규화한 이름이 같고 그 이름의 살아 있는 업체가 이 한 곳»일 때만.
   ② 휴지통·되돌린 줄, 입금된 줄, 자문료가 아닌 줄은 고르지 않는다.
   ③ 휴지통에 «먼저» 담고 → 그 줄들만 뺀다(dbRemoveMany). 입금표 통째 저장은 없다.
   ④ 휴지통에 못 담으면 하나도 지우지 않는다 · 빼기가 실패하면 방금 담은 휴지통 줄을 거둔다.
   ⑤ 마감된 달 줄은 건너뛰고 몇 건인지 센다.
   ⑥ confirmCloseCompany 가 이 두 길을 쓴다 — 이름 비교·통째 저장이 돌아오지 않았다. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn');

const src = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8');

function load(store, opt){
  opt = opt || {};
  const calls = { set: [], removeMany: [] };
  const ctx = {
    console, Date, Math, String, Array, Object,
    dbGet: (k, d) => (k in store ? store[k] : d),
    dbSet: (k, v) => { calls.set.push(k); if(opt.failSet && opt.failSet(k)) return false; store[k] = v; return true; },
    dbRemoveMany: (k, ids) => { calls.removeMany.push([k, Array.from(ids)]); if(opt.failRemove) return false; store[k] = store[k].filter((x) => !ids.includes(x.id)); return true; },
    trashKeyFor: () => 'trash_fin',
    isIncomeLocked: (ym) => (opt.locked || []).includes(ym),
    CURRENT_USER: { sid: 'P-001' },
  };
  vm.createContext(ctx);
  vm.runInContext([cutFn(src, 'function erpNormName('), cutFn(src, 'function erpCoAlive('),
    cutFn(src, 'function erpCloseCoPendingIncomes('), cutFn(src, 'function erpMoveIncomesToTrash(')].join('\n'), ctx);
  return { ctx, calls };
}

const CO = { id: 'co-1', name: '㈜가나상사', status: 'active' };
const fi = (o) => Object.assign({ id: 'fi-' + Math.random().toString(36).slice(2), kind: '자문료', paid: false,
  companyId: 'co-1', companyName: '㈜가나상사', date: '2026-10-10', advisoryYm: '2026-10', amount: 220000 }, o || {});

test('① companyId 로 고른다 — 같은 이름의 다른 업체 돈은 남는다', () => {
  const mine = fi(), other = fi({ companyId: 'co-2' });
  const { ctx } = load({});
  const ids = ctx.erpCloseCoPendingIncomes(CO, [mine, other], [CO, { id: 'co-2', name: '㈜가나상사', status: 'active' }]).map((x) => x.id);
  assert.ok(ids.includes(mine.id));
  assert.ok(!ids.includes(other.id), '★ 이름이 같은 다른 업체의 미입금까지 지웁니다');
});

test('① companyId 없는 줄 — 이름의 살아 있는 업체가 이 한 곳일 때만', () => {
  const noId = fi({ companyId: undefined, companyName: '주식회사 가나상사' });
  const { ctx } = load({});
  assert.equal(ctx.erpCloseCoPendingIncomes(CO, [noId], [CO]).length, 1, '정규화 이름이 같고 업체가 하나면 고른다');
  assert.equal(ctx.erpCloseCoPendingIncomes(CO, [noId], [CO, { id: 'co-9', name: '가나상사', status: 'active' }]).length, 0,
    '★ 같은 이름 업체가 둘인데 이름으로 골랐습니다');
});

test('② 휴지통·되돌린·입금된·자문료 아닌 줄은 고르지 않는다', () => {
  const { ctx } = load({});
  const rows = [fi({ _deleted: true }), fi({ undoneDate: '2026-10-11' }), fi({ paid: true }), fi({ kind: '착수금' })];
  assert.equal(ctx.erpCloseCoPendingIncomes(CO, rows, [CO]).length, 0);
});

test('③ 휴지통에 먼저 담고 그 줄들만 뺀다 — 입금표 통째 저장 없음', () => {
  const a = fi(), b = fi(), keep = fi({ companyId: 'co-2' });
  const store = { finance_income: [a, b, keep], trash_fin: [] };
  const { ctx, calls } = load(store);
  const r = ctx.erpMoveIncomesToTrash([a.id, b.id], '업체 종료');
  assert.equal(r.ok, true); assert.equal(r.moved, 2);
  assert.equal(calls.set.includes('finance_income'), false, '★ 입금표를 통째 저장합니다');
  assert.equal(calls.set.filter((k) => k === 'trash_fin').length, 1, '휴지통은 한 번에 씁니다');
  assert.equal(calls.removeMany.length, 1);
  assert.deepEqual(calls.removeMany[0][1].slice().sort(), [a.id, b.id].sort());
  assert.deepEqual(Array.from(store.finance_income, (x) => x.id), [keep.id]);
  assert.equal(store.trash_fin.length, 2);
  assert.ok(store.trash_fin.every((t) => t.storeKey === 'finance_income' && t.item && t.item.id), '되살릴 수 있게 원본을 담는다');
});

test('④ 휴지통에 못 담으면 하나도 안 지운다 · 빼기가 실패하면 휴지통 줄을 거둔다', () => {
  const a = fi();
  const s1 = { finance_income: [a], trash_fin: [] };
  const L1 = load(s1, { failSet: (k) => k === 'trash_fin' });
  assert.equal(L1.ctx.erpMoveIncomesToTrash([a.id], 'x').ok, false);
  assert.equal(L1.calls.removeMany.length, 0, '★ 휴지통에 못 담았는데 지웁니다');
  assert.equal(s1.finance_income.length, 1);

  const s2 = { finance_income: [a], trash_fin: [{ id: 'trash-old', storeKey: 'finance_income', item: { id: 'z' } }] };
  const L2 = load(s2, { failRemove: true });
  assert.equal(L2.ctx.erpMoveIncomesToTrash([a.id], 'x').ok, false);
  assert.deepEqual(Array.from(s2.trash_fin, (t) => t.id), ['trash-old'], '★ 지우기 실패 뒤 휴지통에 사본이 남아 «두 벌»이 됩니다');
  assert.equal(s2.finance_income.length, 1);
});

test('⑤ 마감된 달 줄은 건너뛰고 센다', () => {
  const sep = fi({ date: '2026-09-10', advisoryYm: '2026-09' }), oct = fi();
  const store = { finance_income: [sep, oct], trash_fin: [] };
  const { ctx } = load(store, { locked: ['2026-09'] });
  const r = ctx.erpMoveIncomesToTrash([sep.id, oct.id], 'x');
  assert.equal(r.moved, 1); assert.equal(r.locked, 1);
  assert.ok(store.finance_income.some((x) => x.id === sep.id), '★ 마감된 달 돈을 지웠습니다');
});

test('⑥ confirmCloseCompany 가 이 길을 쓴다 — 이름 비교·입금표 통째 저장이 돌아오지 않았다', () => {
  const fn = cutFn(src, 'async function confirmCloseCompany(').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  assert.match(fn, /erpCloseCoPendingIncomes\(/);
  assert.match(fn, /erpMoveIncomesToTrash\(/);
  assert.equal(/dbSet\(\s*['"]finance_income['"]/.test(fn), false, '★ 입금표를 통째 저장합니다');
  assert.equal(/companyName\s*===\s*closeModal\.name/.test(fn), false, '★ 이름으로 고릅니다');
  assert.match(fn, /locked/, '마감된 달로 건너뛴 건수를 사람에게 알려야 합니다');
});
