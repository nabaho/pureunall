/* 혁신바우처(중진공) 컨설팅 유형 — 대표 지시 2026-11-09
   「중진공 혁신바우처 컨설팅도 하나의 영역으로 넣어줘」
   씨앗을 고쳐도 이미 쓰는 사전(서버)은 안 바뀐다 → 읽을 때 «없으면 한 번» 얹는다(consEnsureVoucher).
   ⚠ 2026-10-26 사고(씨앗이 서버 사전을 덮음) 때문에 «이 기기에 받은 사전이 있을 때만», bizTypeApply 로 쓴다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { cutFn } = require('./cut-fn');

const APP = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8');
const SEED_SRC = APP.slice(APP.indexOf('var BIZ_CONS_SEED = ['), APP.indexOf('var BIZ_FUND_SEED'));
const BIZ_CONS_SEED = new Function(SEED_SRC + '; return BIZ_CONS_SEED;')();

function make(store) {
  const writes = [];
  const applied = [];
  const dbGet = (k, d) => (k in store ? store[k] : d);
  const dbSet = (k, v) => { store[k] = v; writes.push(k); };
  const bizTypeApply = (k, seed, fn) => { applied.push(k); if (store[k] == null) return null; const n = fn(store[k].slice()); dbSet(k, n); return n; };
  const bizTypeNextOrder = (cur) => 500;
  const bizTypeHist = (item) => Object.assign({}, item, { hist: [{ act: 'add' }] });
  const f = new Function('dbGet', 'dbSet', 'bizTypeApply', 'bizTypeNextOrder', 'bizTypeHist', 'BIZ_CONS_SEED',
    cutFn(APP, 'function consEnsureVoucher(') + '; return consEnsureVoucher;')(
    dbGet, dbSet, bizTypeApply, bizTypeNextOrder, bizTypeHist, BIZ_CONS_SEED);
  return { f, writes, store, applied };
}

test('씨앗의 혁신바우처는 중진공 사업으로 적혀 있다', () => {
  const v = BIZ_CONS_SEED.find(x => /바우처/.test(x.name));
  assert.ok(v, '컨설팅 씨앗에 바우처가 없습니다');
  assert.match(v.agency, /중소벤처기업진흥공단/);
});

test('★ 사전에 바우처가 없으면 «한 줄» 얹고 표시를 남긴다 — 두 번 불러도 한 줄', () => {
  const t = make({ biz_cons_types: [{ code: 'cons-x', short: '일혁', name: '일터상생혁신' }] });
  const r = t.f(t.store.biz_cons_types);
  assert.equal(r.filter(x => /바우처/.test(x.name)).length, 1);
  assert.equal(r.length, 2, '기존 유형이 사라졌습니다');
  assert.equal(t.store.biz_cons_voucher_seeded, true);
  const r2 = t.f(t.store.biz_cons_types);
  assert.equal(r2.filter(x => /바우처/.test(x.name)).length, 1, '두 번 불렀더니 두 줄이 됐습니다');
});

test('★ 이미 바우처가 있거나(숨김 포함), 대표님이 지운 뒤(표시 있음)에는 손대지 않는다', () => {
  const a = make({ biz_cons_types: [{ code: 'v', name: '혁신바우처', hidden: true }] });
  a.f(a.store.biz_cons_types);
  assert.deepEqual(a.writes, []);
  const b = make({ biz_cons_types: [{ code: 'x', name: '인사노무' }], biz_cons_voucher_seeded: true });
  b.f(b.store.biz_cons_types);
  assert.deepEqual(b.writes, [], '일부러 지운 유형이 되살아납니다');
});

test('★ 이 기기에 받은 사전이 없으면 쓰지 않는다 — 씨앗 위에 얹어 서버를 덮지 않게(2026-10-26)', () => {
  const t = make({});
  t.f(BIZ_CONS_SEED.filter(x => !/바우처/.test(x.name)));
  assert.deepEqual(t.writes, []);
  /* 쓰기 관문까지 가지도 않는다 — 가면 「서버에서 받는 중」 알림이 화면마다 뜬다 */
  assert.deepEqual(t.applied, [], '사전을 받기 전에 쓰기를 시도합니다');
});

test('같은 번호(cons-voucher)가 다른 이름으로 이미 쓰이면 번호를 갈라 붙인다', () => {
  const t = make({ biz_cons_types: [{ code: 'cons-voucher', name: '옛이름' }] });
  const r = t.f(t.store.biz_cons_types);
  const v = r.find(x => /바우처/.test(x.name));
  assert.notEqual(v.code, 'cons-voucher');
});
