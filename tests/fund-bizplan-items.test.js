'use strict';
/* 예산 세부 항목 — 실무매뉴얼 부록3식 «인원 × 단가 × 횟수» 산출근거 (2026-10-05 목업 승인, 2026-10-07 「추천대로」 구현)
 * ⚠ 이 저장소는 github.io 로 공개된다 — 기금·금액은 전부 지어낸 것이다(목업의 가짜 자료 그대로).
 * node --test tests/fund-bizplan-items.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8');
function grabFn(name) {
  const i = SRC.indexOf('function ' + name + '(');
  assert.ok(i >= 0, 'fund.html 에 함수가 없다: ' + name);
  let d = 0, on = false;
  for (let j = i; j < SRC.length; j++) {
    if (SRC[j] === '{') { d++; on = true; }
    else if (SRC[j] === '}') { d--; if (on && !d) return SRC.slice(i, j + 1); }
  }
  throw new Error('끝을 못 찾음: ' + name);
}
function grabDecl(name) {
  const i = SRC.indexOf('var ' + name + '=');
  assert.ok(i >= 0, '상수가 없다: ' + name);
  return SRC.slice(i, SRC.indexOf(';', i) + 1);       // 이 상수들에는 안쪽에 ; 가 없다
}
const B = (() => {
  const box = {};
  new Function([
    'var S={fundId:"F1",year:2027}, funds={};',
    grabDecl('BUD_GWAN'), grabDecl('BUD_GWAN_KEY'), grabDecl('BUDGET_KEYS'), grabDecl('BIZ_SPLIT'), 'var BIZ_RATE_DEFAULT=2.0;',
    grabFn('num'), grabFn('_fnum'), grabFn('budItemAmt'), grabFn('budItemBasis'), grabFn('budItemsList'), grabFn('budItemSums'),
    grabFn('budgetOf'), grabFn('_hasBudget'), grabFn('useRate'), grabFn('bizRate'),
    'function foundContribLive(){ return 0; }', grabFn('autoBudget'), grabFn('planBudget'), grabFn('bizplanRows'), grabFn('bizplanBS'),
    'this.S=S; this.funds=funds; this.amt=budItemAmt; this.basis=budItemBasis; this.list=budItemsList; this.sums=budItemSums;',
    'this.budgetOf=budgetOf; this.rows=bizplanRows; this.bs=bizplanBS;',
  ].join('\n')).call(box);
  return box;
})();

/* 목업 ① 의 가짜 자료 그대로 */
const ITEMS = {
  a: { gwan: 'int', name: '예금이자', base: '10,000', rate: '2.0', months: '8', ord: 1 },
  b: { gwan: 'purpose', name: '명절 상품권', n: '40', n_unit: '인', price: '300', times: '2', t_unit: '회', ord: 2 },
  c: { gwan: 'purpose', name: '건강검진비', n: '40', n_unit: '인', price: '150', ord: 3 },
  d: { gwan: 'purpose', name: '경조사비', n: '10', n_unit: '건', price: '200', ord: 4 },
  e: { gwan: 'purpose', name: '선택적복지', n: '40', n_unit: '인', price: '1,200', ord: 5 },
  f: { gwan: 'admin', name: '등기소송비', memo: '임원변경등기', n: '2', n_unit: '회', price: '200', ord: 6 },
  g: { gwan: 'admin', name: '회의진행비', memo: '협의회·이사회', n: '4', n_unit: '회', price: '250', ord: 7 },
  h: { gwan: 'spare', name: '예비비', price: '4,000', ord: 8 },
};

test('★★ 산식 → 금액(천원)·산출근거 — 목업 그대로', () => {
  const L = B.list(ITEMS);
  assert.deepEqual(L.map((x) => B.amt(x)), [133, 24000, 6000, 2000, 48000, 400, 1000, 4000]);
  assert.deepEqual(L.map((x) => B.basis(x)), [
    '-10,000×2.0%×(8/12)=133', '-40인×2회×300=24,000', '-40인×150=6,000', '-10건×200=2,000', '-40인×1,200=48,000',
    '-임원변경등기 2회×200=400', '-협의회·이사회 4회×250=1,000', '-예비비 4,000']);
  assert.equal(B.amt({ gwan: 'purpose', name: 'x' }), 0, '단가가 없으면 0 — 지어내지 않는다');
  assert.equal(B.amt({ gwan: 'int', base: '1000', rate: '1.5' }), 15, '달을 비우면 12달');
});

test('★★ 관별 합 → 예산 칸(원) — 항목이 있는 관만 얹고, 나머지는 손으로 적은 예산 그대로', () => {
  const s = B.sums(ITEMS);
  assert.equal(s.any, true);
  assert.deepEqual(s.vals, { rev_interest: 133000, exp_purpose: 80000000, exp_admin: 1400000, exp_etc: 4000000 });
  B.funds.F1 = { years: { 2027: { budget: { rev_contrib: 50000000, exp_purpose: 1 }, budget_items: ITEMS } } };
  const b = B.budgetOf('F1', 2027);
  assert.equal(b.exp_purpose, 80000000, '항목 합이 이긴다');
  assert.equal(b.rev_contrib, 50000000, '항목이 없는 관은 그대로');
  B.funds.F1 = { years: { 2027: { budget: { rev_contrib: 5 } } } };
  assert.deepEqual(B.budgetOf('F1', 2027), { rev_contrib: 5 }, '항목이 없으면 예전과 같다');
});

test('★ 손익예산 — 목적사업비 = 항목 합(맞물림), 수지차액은 준비금 환입으로 메워 순이익 0', () => {
  B.funds.F1 = { fund_type: '공동', years: { 2027: { budget_items: ITEMS } } };
  const R = Object.fromEntries(B.rows({ _id: 'F1', fund_type: '공동' }, 2027, []).map((r) => [r[0], r]));
  assert.equal(R['2.고유목적사업비용'][1], 80000000);
  assert.equal(R['가.이자수입'][2], 133000);
  assert.equal(R['가.고유목적사업준비금1전입수입'][1], 133000, '준비금1 = 그 해 이자');
  assert.equal(R['나.고유목적사업준비금2전입수입'][1], 85400000 - 133000, '모자란 만큼 준비금2');
  assert.equal(R['10.당기순이익'][1] + R['10.당기순이익'][2], 0);
});

test('★ 대부이자 — 기금관리 쪽 수입, 준비금1 전입에 포함 · 이자가 필요보다 크면 준비금1 에 남긴다(음수 환입 없음)', () => {
  const it = { x: { gwan: 'loanint', name: '대부이자', base: '20,000', rate: '3', ord: 1 }, y: { gwan: 'spare', price: '100', ord: 2 } };
  B.funds.F1 = { fund_type: '공동', years: { 2027: { budget: { rev_interest: 400000 }, budget_items: it } } };
  const R = Object.fromEntries(B.rows({ _id: 'F1', fund_type: '공동' }, 2027, []).map((r) => [r[0], r]));
  assert.equal(R['나.대부이자수입'][2], 600000);
  assert.equal(R['1.사업수익'][2], 1000000);
  assert.equal(R['7.사업외비용'][2], 1000000, '준비금1 전입 = 예금이자 + 대부이자');
  assert.equal(R['가.고유목적사업준비금1전입수입'][1], 100000, '필요한 만큼만 환입');
  assert.equal(R['나.고유목적사업준비금2전입수입'][1], 0, '음수 환입을 적지 않는다');
  /* 추정재무상태표가 같은 셈으로 대차를 맞춘다 */
  const fin = { cash: 0, savings: 0, secu: 0, loan: 0, otherAsset: 0, res1: 0, res2: 0, basic: 0, retained: 0, liab: 0 };
  const P = B.bs({ _id: 'F1', fund_type: '공동' }, 2027, fin, []);
  assert.equal(P.res1, 900000, '쓰고 남은 이자는 준비금1 에 남는다');
  assert.equal(P.assets, P.curLiab + P.res1 + P.res2 + P.basic + P.retained, '대차가 맞는다');
});

test('★ 그 밖의 수입도 추정재무상태표 현금에 들어간다 — 손익예산과 대차가 함께 맞는다', () => {
  B.funds.F1 = { fund_type: '사내', years: { 2027: { budget: { rev_contrib: 10000000, rev_interest: 50000, rev_etc: 300000, exp_purpose: 7000000, exp_admin: 200000, exp_etc: 100000 } } } };
  const fin = { cash: 1000000, savings: 0, secu: 0, loan: 0, otherAsset: 0, res1: 0, res2: 500000, basic: 500000, retained: 0, liab: 500000 };
  const P = B.bs({ _id: 'F1', fund_type: '사내' }, 2027, fin, []);
  assert.equal(P.cash, 1000000 + 10000000 + 50000 + 300000 - 7300000);
  assert.equal(P.assets, P.curLiab + P.res1 + P.res2 + P.basic + P.retained);
});

test('★ 화면 — 예산 아래 세부 항목 표(□·#), 항목이 정한 칸은 손으로 못 고침, 도움말은 ⓘ', () => {
  assert.match(SRC, /\+budItemsHTML\(fid,yr,plan\);/);
  assert.match(grabFn('budItemsHTML'), /class="bipick"/);
  assert.match(grabFn('budItemsHTML'), /<th class="no">#<\/th>/);
  assert.match(grabFn('budgetView'), /r\[0\] in byItem\?'disabled/);
  assert.match(SRC, /'budget\.items':\{/);
  assert.match(grabFn('budItemsSeed'), /confirmM\(/, '덮어쓰기 전에 묻는다');
});
