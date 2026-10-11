/* 업체 → 계약 회사 사본 맞추기 (2026-10-11 검토 §1)
   실행: node --test tests/erp-co-sync-contracts.test.js

   ── 지키는 규칙 ──
   ① 잣대는 companyId — 사업자번호가 같은 «다른 업체»(본점·지점)의 계약을 건드리지 않는다.
   ② 진행 중 계약만 — 종료·취소·이관완료·만료·휴지통 계약은 그때 값을 남긴다.
   ③ 바뀐 칸만 쓴다 — undefined 칸은 넣지 않는다.
   ④ 사업자번호를 고치면 «옛 번호»로 이어진 계약이 바뀐다(예전에는 반대였다).
   ⑤ companyId 없는 계약은 그 번호의 살아 있는 업체가 이 한 곳일 때만, 아니면 보류로 센다.
   ⑥ 저장은 한 번 — 계약표 통째 저장(dbSet) 없이 dbUpsertMany 한 번.
   ⑦ 화면의 두 자리(수정창·칸 바로 고치기)가 이 길을 쓴다 — 옛 syncToContracts 가 돌아오지 않았다. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn');

const src = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8');

function load(store){
  const calls = { upsertMany: [], set: [], toast: [] };
  const ctx = {
    console, JSON, String, Object, Array,
    dbGet: (k, d) => (k in store ? store[k] : d),
    dbSet: (k, v) => { calls.set.push(k); store[k] = v; return true; },
    dbUpsertMany: (k, items) => { calls.upsertMany.push([k, items]); return true; },
    showToast: (m) => { calls.toast.push(String(m)); },
  };
  vm.createContext(ctx);
  /* 바깥 상수 두 개는 함수와 함께 떼어 온다 */
  const constStart = src.indexOf('var ERP_CO_CT_FIELDS');
  const constEnd = src.indexOf('function erpCoSyncContractsPlan(');
  assert.ok(constStart > 0 && constEnd > constStart, 'ERP_CO_CT_FIELDS · ERP_CT_ENDED 를 못 찾음');
  vm.runInContext(cutFn(src, 'function erpCoAlive(') + '\n' + src.slice(constStart, constEnd)
    + cutFn(src, 'function erpCoSyncContractsPlan(') + '\n' + cutFn(src, 'function erpCoSyncContracts('), ctx);
  return { ctx, calls };
}

const CO = { id: 'co-1', name: '가나상사', bizNo: '111-11-11111', ceo: '김대표', address: '서울' };
const ct = (o) => Object.assign({ id: 'ct-' + Math.random().toString(36).slice(2), status: 'signed',
  companyId: 'co-1', companyName: '가나상사', bizNo: '111-11-11111',
  company: { name: '가나상사', bizNo: '111-11-11111', ceo: '김대표', address: '서울' } }, o || {});

test('① companyId 로 고른다 — 사업자번호가 같은 다른 업체의 계약은 그대로', () => {
  const mine = ct(), branch = ct({ companyId: 'co-2', companyName: '가나상사(지점)' });
  const store = { contracts: [mine, branch], companies: [CO, { id: 'co-2', name: '가나상사(지점)', bizNo: '111-11-11111' }] };
  const { ctx } = load(store);
  const plan = ctx.erpCoSyncContractsPlan(CO, Object.assign({}, CO, { ceo: '이대표' }), store.contracts, store.companies);
  const ids = plan.records.map((r) => r.id);
  assert.ok(ids.includes(mine.id), '이 업체의 계약이 빠졌습니다');
  assert.ok(!ids.includes(branch.id), '★ 같은 사업자번호의 «다른 업체» 계약까지 바뀝니다');
});

test('② 끝난 계약·휴지통 계약은 «그때 값»을 남긴다', () => {
  const live = ct();
  const ended = ['closed', 'cancelled', 'transferred', 'expired'].map((st) => ct({ status: st }));
  const trashed = ct({ _deleted: true });
  const store = { contracts: [live].concat(ended, [trashed]), companies: [CO] };
  const { ctx } = load(store);
  const plan = ctx.erpCoSyncContractsPlan(CO, Object.assign({}, CO, { address: '부산' }), store.contracts, store.companies);
  const ids = plan.records.map((r) => r.id);
  assert.ok(ids.includes(live.id));
  ended.concat([trashed]).forEach((c) => assert.ok(!ids.includes(c.id), '★ ' + (c.status) + (c._deleted ? '(휴지통)' : '') + ' 계약의 회사 사본이 바뀝니다'));
});

test('③ 바뀐 칸만 쓴다 — 안 바뀐 칸·undefined 칸은 계약에 안 들어간다', () => {
  const c1 = ct();
  const store = { contracts: [c1], companies: [CO] };
  const { ctx } = load(store);
  const form = Object.assign({}, CO, { ceo: '이대표', fax: undefined });
  const plan = ctx.erpCoSyncContractsPlan(CO, form, store.contracts, store.companies);
  assert.deepEqual(Array.from(plan.fields), ['ceo'], '바뀐 칸은 대표자 하나뿐인데 다른 칸까지 씁니다');
  assert.equal(plan.records[0].company.ceo, '이대표');
  assert.equal('fax' in plan.records[0].company, false, '★ undefined 칸이 계약에 들어갑니다');
  /* 아무것도 안 바뀌면 쓸 것도 없다 */
  assert.equal(ctx.erpCoSyncContractsPlan(CO, Object.assign({}, CO), store.contracts, store.companies).records.length, 0);
});

test('④ 사업자번호를 고치면 «옛 번호»로 이어진 계약이 새 번호로 바뀐다', () => {
  const oldLinked = ct();                                             // companyId 로 이어짐
  const oldNoId = ct({ companyId: undefined });                       // companyId 없음, 옛 번호
  const newCo = Object.assign({}, CO, { bizNo: '222-22-22222' });
  /* 업체표에는 이미 «고친 뒤» 값이 들어 있다 */
  const store = { contracts: [oldLinked, oldNoId], companies: [newCo] };
  const { ctx } = load(store);
  const plan = ctx.erpCoSyncContractsPlan(CO, newCo, store.contracts, store.companies);
  const byId = {}; plan.records.forEach((r) => { byId[r.id] = r; });
  assert.ok(byId[oldLinked.id], '★ 옛 번호 계약이 그대로 남습니다');
  assert.equal(byId[oldLinked.id].bizNo, '222-22-22222');
  assert.equal(byId[oldLinked.id].company.bizNo, '222-22-22222');
  assert.ok(byId[oldNoId.id], 'companyId 없는 옛 번호 계약도 이 업체 하나뿐이면 맞춘다');
});

test('⑤ companyId 없는 계약 — 그 번호의 살아 있는 업체가 둘 이상이면 건드리지 않고 «보류»로 센다', () => {
  const noId = ct({ companyId: undefined });
  const twin = { id: 'co-2', name: '가나상사 본점', bizNo: '1111111111' };
  const store = { contracts: [noId], companies: [CO, twin] };
  const { ctx, calls } = load(store);
  const plan = ctx.erpCoSyncContractsPlan(CO, Object.assign({}, CO, { ceo: '이대표' }), store.contracts, store.companies);
  assert.equal(plan.records.length, 0, '★ 어느 업체 계약인지 모르는데 덮어씁니다');
  assert.ok(plan.held >= 1);
  ctx.erpCoSyncContracts(CO, Object.assign({}, CO, { ceo: '이대표' }));
  assert.ok(calls.toast.some((m) => /연결 보류\s*\d+\s*건/.test(m)), '보류 건수를 사람에게 알려야 합니다');
  /* 쌍둥이가 종료된 업체면 «살아 있는» 업체는 하나 — 맞춘다 */
  const plan2 = ctx.erpCoSyncContractsPlan(CO, Object.assign({}, CO, { ceo: '이대표' }), store.contracts,
    [CO, Object.assign({}, twin, { status: 'closed' })]);
  assert.equal(plan2.records.length, 1);
});

test('⑥ 저장은 dbUpsertMany 한 번 — 계약표 통째 저장은 없다', () => {
  const store = { contracts: [ct(), ct(), ct()], companies: [CO] };
  const { ctx, calls } = load(store);
  ctx.erpCoSyncContracts(CO, Object.assign({}, CO, { name: '가나상사2', ceo: '이대표', address: '부산' }));
  assert.equal(calls.set.includes('contracts'), false, '★ 계약표를 통째 저장합니다');
  assert.equal(calls.upsertMany.length, 1, '★ 저장을 여러 번 합니다');
  assert.equal(calls.upsertMany[0][0], 'contracts');
  assert.equal(calls.upsertMany[0][1].length, 3);
  assert.equal(calls.upsertMany[0][1][0].companyName, '가나상사2', '이름은 바깥 companyName 에도');
});

test('⑦ 화면의 두 자리가 이 길을 쓴다 — 옛 syncToContracts 가 돌아오지 않았다', () => {
  const bare = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  assert.equal(/syncToContracts\s*\(/.test(bare), false, '★ 사업자번호로 묶어 통째 저장하던 syncToContracts 가 되살아났습니다');
  const cm = cutFn(src, 'function CompanyManagement(');
  const n = (cm.match(/erpCoSyncContracts\(/g) || []).length;
  assert.ok(n >= 2, '수정창 저장과 칸 바로 고치기 모두 erpCoSyncContracts 를 거쳐야 합니다');
});
