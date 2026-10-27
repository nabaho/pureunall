'use strict';
/* 🏦 종료 업체를 골라 입금표시하면 «실제로 줄이 만들어진다» + 여러 달 몫은 달별로 나눈다 (건의 · 김보람 2026-10-27, 대표 「추천대로」)

   ■ 왜 생겼나 — 첫 고침(PR #2786)이 «반쪽»이었다
   종료 업체를 이름으로 알아보게는 했지만(tests/cms-closed-company.test.js), 창의 apply() 가
   `var co = byName[n]; if(!co) return;` 로 «자문 중 풀»만 봐서 종료 업체는 확인까지 눌러도 조용히 건너뛰어졌다.
   그 결과가 건의 화면의 「고른 업체가 없습니다」였다(확인 창에는 엔타스시가 있었는데 줄은 0개).
   그 검사는 소스 글자만 봤고 apply() 를 «돌려 보지» 않아서 이 구멍을 못 잡았다. 이 검사는 apply() 를 떠서 돌린다.

   ★ 규칙
     ① 해지·미등록 업체를 골라도 입금표시 줄이 만들어진다(예전엔 0줄 + 「고른 업체가 없습니다」)
     ② 종료 업체가 자문료의 «정확한 배수»(2~6배)를 한 번에 냈으면 달별로 나눠 적을지 묻는다 — 나누면 첫 달부터 «다음 달»로 이어 한 줄씩
     ③ 한 줄로 적기를 고르면 예전처럼 한 줄 · 배수가 아니면 묻지도 나누지도 않는다
     ④ 이미 입금된 달·마감된 달이 끼면 나누지 않고 한 줄로(경고) · 나이스빌 지문(cmsKey)은 첫 줄에만
     ⑤ 종료 업체의 업체관리 기록(CMS 체크)은 건드리지 않는다 · 자문 중 업체는 예전 그대로 한 줄 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn');
const { stripComments } = require('./strip-comments');

const ERP = stripComments(fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8'));
const MODAL = cutFn(ERP, 'function CmsMatchModal(props)');
const APPLY = cutFn(MODAL, 'async function apply()');
const SPLIT_PLAN = cutFn(ERP, 'function erpCmsSplitPlan(co, amount, ym, all)');
const ADD_ROWS = cutFn(ERP, 'function erpCmsAddRows(co, plan, date, note, kind, cmsKey, add)');
const YM_NEXT = cutFn(ERP, 'function _erpYmNext(ym)');

/* 창의 apply() 를 «떠서» 돌린다 — 창이 쥐고 있는 값(sel·풀·금액 …)을 가짜로 넣는다 */
function run(opt) {
  const calls = [];            // erpAddCompanyIncome 호출 기록
  const prompts = [];          // popConfirm 으로 물은 것
  const toasts = [];
  const upserts = [];          // 업체관리 기록을 고친 업체(CMS 체크)
  const done = { applied: null };
  const income = opt.income || [];
  const ctx = {
    sel: opt.sel, busy: false, setBusy() {},
    sum: (opt.deposit || 0), diff: 0,
    paidMap: Object.assign({}, opt.paid || {}),
    byName: opt.byName || {}, byNameAll: opt.byNameAll,
    effAmt: (n) => opt.amt[n],
    amtFrom: () => 'cms',
    basis: 'nb', nbData: opt.nbRows ? { items: opt.nbRows } : null,
    props: { addIncome: opt.addIncome || null, onApplied: (...a) => { done.applied = a; } },
    ym: opt.ym || '2026-04', month: parseInt((opt.ym || '2026-04').slice(5), 10), year: parseInt((opt.ym || '2026-04').slice(0, 4), 10),
    ymd: '2026-04-20', refDay: 20, amount: opt.deposit,
    dbGet: (k, d) => (k === 'finance_income' ? income : (k === 'companies' ? (opt.companies || []) : d)),
    dbUpsertMany: (k, rows) => { rows.forEach((r) => upserts.push(r.name)); return true; },
    todayYMD: () => '2026-10-27',
    erpCmsKeyTaken: () => false,
    isIncomeLocked: (m) => (opt.locked || []).indexOf(m) >= 0,
    erpAdvisoryPaidFor: (co, m, all) => (all || []).filter((i) => i.companyName === co.name && i.advisoryYm === m),
    erpAddCompanyIncome: (co, month, year, date, note, kind, amount, o) => {
      calls.push({ name: co.name, ym: year + '-' + ('0' + month).slice(-2), amount, kind, cmsKey: (o && o.cmsKey) || '', note });
      return true;
    },
    popConfirm: async (msg, o) => {
      prompts.push({ msg, choices: o && o.choices ? o.choices.map((c) => c.key) : null });
      if (o && o.choices) {
        const keys = o.choices.map((c) => c.key);
        if (keys.indexOf('split') >= 0) return opt.split || 'split';
        return opt.kind || '자문료';
      }
      return true;
    },
    showToast: (t) => { toasts.push(String(t)); },
    window: {}, Object, Array, String, parseInt, Promise,
  };
  vm.createContext(ctx);
  vm.runInContext([YM_NEXT, SPLIT_PLAN, ADD_ROWS, 'async ' + APPLY.replace(/^async\s+/, '')].join('\n') + '\nthis.apply = apply;', ctx);
  return ctx.apply().then(() => ({ calls, prompts, toasts, upserts, applied: done.applied }));
}

const CLOSED = { id: 'c1', name: '종료상사', fee: 110000, payDay: '20', mainSid: 'A-003', mainName: '담당', off: '해지' };
const ACTIVE = { id: 'a1', name: '활성상사', fee: 110000, payDay: '20', mainSid: 'A-003', mainName: '담당' };

test('①★ 해지(종료) 업체를 골라 확인하면 «줄이 실제로 만들어진다» (예전엔 0줄 · 「고른 업체가 없습니다」)', async () => {
  const r = await run({ sel: ['종료상사'], byName: {}, byNameAll: { 종료상사: CLOSED }, amt: { 종료상사: 110000 }, deposit: 110000 });
  assert.equal(r.calls.length, 1, '★ 종료 업체인데 입금표시 줄이 안 만들어졌다 — 조용히 건너뛰었다');
  assert.equal(r.calls[0].name, '종료상사'); assert.equal(r.calls[0].amount, 110000);
  assert.deepEqual(r.applied && r.applied.slice(0, 2), [1, 0], '처리 곳 수가 0 이면 창이 「고른 업체가 없습니다」라고 한다');
});

test('②★ 종료 업체가 자문료의 2배를 냈으면 «달별로 나눠 적기»를 묻고, 나누면 첫 달부터 다음 달로 한 줄씩', async () => {
  const r = await run({ sel: ['종료상사'], byNameAll: { 종료상사: CLOSED }, amt: { 종료상사: 220000 }, deposit: 220000, split: 'split',
    nbRows: [{ coName: '종료상사', key: 'K1', amount: 220000 }] });
  const asked = r.prompts.filter((p) => p.choices && p.choices.indexOf('split') >= 0);
  assert.equal(asked.length, 1, '나눌지 묻지 않았다');
  assert.ok(/110,000원 × 2개월/.test(asked[0].msg) && /2026-04 · 2026-05/.test(asked[0].msg), '확인 글에 «얼마 × 몇 달 → 어느 달»이 없다');
  assert.deepEqual(r.calls.map((c) => [c.ym, c.amount]), [['2026-04', 110000], ['2026-05', 110000]], '★ 달별 두 줄이 아니다');
  assert.equal(r.calls[0].cmsKey, 'K1'); assert.equal(r.calls[1].cmsKey, '', '★ 나이스빌 지문이 둘째 줄에도 붙었다 — 같은 명세 줄이 두 번 잡힌다');
  assert.ok(/2개월분 중 1번째/.test(r.calls[0].note) && /2개월분 중 2번째/.test(r.calls[1].note));
  assert.deepEqual(r.applied && r.applied.slice(0, 2), [1, 0], '업체 한 곳은 «한 곳»으로 센다(줄 수가 아니라)');
});

test('③★ 「한 줄로 적기」를 고르면 예전처럼 220,000원 한 줄 · 배수가 아니면 묻지도 나누지도 않는다', async () => {
  const one = await run({ sel: ['종료상사'], byNameAll: { 종료상사: CLOSED }, amt: { 종료상사: 220000 }, deposit: 220000, split: 'one' });
  assert.deepEqual(one.calls.map((c) => [c.ym, c.amount]), [['2026-04', 220000]]);
  const odd = await run({ sel: ['종료상사'], byNameAll: { 종료상사: CLOSED }, amt: { 종료상사: 150000 }, deposit: 150000 });
  assert.equal(odd.prompts.filter((p) => p.choices && p.choices.indexOf('split') >= 0).length, 0, '배수가 아닌데 나눌지 물었다');
  assert.deepEqual(odd.calls.map((c) => c.amount), [150000]);
  const seven = await run({ sel: ['종료상사'], byNameAll: { 종료상사: CLOSED }, amt: { 종료상사: 770000 }, deposit: 770000 });
  assert.equal(seven.calls.length, 1, '7배는 «여러 달 몫»이라 보기엔 너무 크다 — 나누지 않는다(상한 6)');
});

test('④★ 이미 입금된 달·마감된 달이 끼면 나누지 않고 한 줄로 적는다(경고) — 중복·마감을 건드리지 않는다', async () => {
  const dup = await run({ sel: ['종료상사'], byNameAll: { 종료상사: CLOSED }, amt: { 종료상사: 220000 }, deposit: 220000,
    income: [{ companyName: '종료상사', advisoryYm: '2026-05', amount: 110000 }] });
  assert.equal(dup.prompts.filter((p) => p.choices && p.choices.indexOf('split') >= 0).length, 0, '이미 입금된 달이 끼었는데 나눌지 물었다');
  assert.ok(dup.toasts.some((t) => /2026-05 자문료가 이미 입금/.test(t)), '왜 안 나누는지 말하지 않았다');
  assert.deepEqual(dup.calls.map((c) => [c.ym, c.amount]), [['2026-04', 220000]]);
  const lock = await run({ sel: ['종료상사'], byNameAll: { 종료상사: CLOSED }, amt: { 종료상사: 220000 }, deposit: 220000, locked: ['2026-05'] });
  assert.ok(lock.toasts.some((t) => /마감/.test(t)));
  assert.equal(lock.calls.length, 1);
});

test('⑤★ 자문 중 업체는 예전 그대로 한 줄 · 업체입금 탭에서 열면(addIncome) 나누지 않는다', async () => {
  const a = await run({ sel: ['활성상사'], byName: { 활성상사: ACTIVE }, byNameAll: { 활성상사: ACTIVE }, amt: { 활성상사: 220000 }, deposit: 220000 });
  assert.equal(a.prompts.filter((p) => p.choices && p.choices.indexOf('split') >= 0).length, 0, '자문 중 업체에 나눌지 물었다');
  assert.deepEqual(a.calls.map((c) => [c.ym, c.amount]), [['2026-04', 220000]]);
  const added = [];
  const t = await run({ sel: ['종료상사'], byNameAll: { 종료상사: CLOSED }, amt: { 종료상사: 220000 }, deposit: 220000,
    addIncome: (...args) => { added.push(args[0].name); } });
  assert.equal(t.prompts.filter((p) => p.choices && p.choices.indexOf('split') >= 0).length, 0, '업체입금 탭에서 나눌지 물었다');
  assert.deepEqual(added, ['종료상사']);
});

test('⑥★ 순수 계산: 계획은 정확한 배수만 · 달은 해를 넘어 이어진다', () => {
  const ctx = { isIncomeLocked: () => false, erpAdvisoryPaidFor: () => [], parseInt, Number };
  vm.createContext(ctx);
  vm.runInContext(YM_NEXT + '\n' + SPLIT_PLAN + '\nthis.f = erpCmsSplitPlan;', ctx);
  const p = ctx.f({ fee: 110000 }, 330000, '2026-11', []);
  assert.deepEqual(Array.from(p.months), ['2026-11', '2026-12', '2027-01']);
  assert.equal(ctx.f({ fee: 110000 }, 110000, '2026-04', []), null, '1배는 나눌 것이 없다');
  assert.equal(ctx.f({ fee: 110000 }, 230000, '2026-04', []), null, '배수가 아니다');
  assert.equal(ctx.f({ fee: 0 }, 220000, '2026-04', []), null, '자문료 없음');
});

test('⑧★ 종료 업체의 업체관리 기록(CMS 체크)은 건드리지 않는다 · 자문 중 업체는 예전처럼 켠다', async () => {
  const r = await run({ sel: ['종료상사', '활성상사'], byName: { 활성상사: ACTIVE }, byNameAll: { 종료상사: CLOSED, 활성상사: ACTIVE },
    amt: { 종료상사: 110000, 활성상사: 110000 }, deposit: 220000,
    companies: [{ id: 'c1', name: '종료상사' }, { id: 'a1', name: '활성상사' }] });
  assert.equal(r.calls.length, 2);
  assert.deepEqual(r.upserts, ['활성상사'], '★ 종료 업체의 업체관리 기록까지 고쳤다(CMS 체크)');
});

test('⑦★ (이빨) 옛 모양 `var co = byName[n]` 만 보는 apply 는 ① 이 빨갛게 잡는다', async () => {
  const BAD = APPLY.replace('var co = byName[n] || byNameAll[n];', 'var co = byName[n];');
  assert.notEqual(BAD, APPLY, '앵커를 못 찾았다 — 이 이빨 검사가 의미 없다');
  const calls = [];
  const ctx = {
    sel: ['종료상사'], busy: false, setBusy() {}, sum: 110000, diff: 0, paidMap: {}, byName: {}, byNameAll: { 종료상사: CLOSED }, effAmt: () => 110000, amtFrom: () => 'cms',
    basis: 'nb', nbData: null, props: { onApplied() {} }, ym: '2026-04', month: 4, year: 2026, ymd: '2026-04-20', refDay: 20, amount: 110000,
    dbGet: (k, d) => d, dbUpsertMany: () => true, erpCmsKeyTaken: () => false, isIncomeLocked: () => false, erpAdvisoryPaidFor: () => [],
    erpAddCompanyIncome: (co) => { calls.push(co.name); return true; }, popConfirm: async () => true, showToast() {}, window: {}, Object, Array, String, parseInt, Promise,
  };
  vm.createContext(ctx);
  vm.runInContext([YM_NEXT, SPLIT_PLAN, ADD_ROWS, BAD].join('\n') + '\nthis.apply = apply;', ctx);
  await ctx.apply();
  assert.equal(calls.length, 0, '옛 모양이 줄을 만들었다면 이 이빨 검사가 틀린 것이다');
});
