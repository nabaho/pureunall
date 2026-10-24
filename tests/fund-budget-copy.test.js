'use strict';
/* 전년 계획에서 복사 — 예산 세부 항목을 지난해 것 그대로 가져오고 해마다 바뀌는 칸에 «확인 필요» 표시
 * (대표 지시 2026-10-24 「지역 공동기금은 매년 비슷하다 — 사업계획서 어떻게」, 목업 승인 「추천대로」 = A안)
 * ⚠ 이 저장소는 github.io 로 공개된다 — 기금·금액은 전부 지어낸 것이다(목업의 가짜 자료 그대로).
 * node --test tests/fund-budget-copy.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8').replace(/\r\n/g, '\n');
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
  return SRC.slice(i, SRC.indexOf(';', i) + 1);
}
const B = (() => {
  const box = {};
  new Function([
    'var S={fundId:"F1",year:2027}, funds={};',
    grabDecl('BUD_GWAN'), grabDecl('BUD_CHK_FIELDS'),
    grabFn('num'), grabFn('_fnum'), grabFn('budItemAmt'), grabFn('budItemBasis'), grabFn('budItemsList'),
    grabFn('bizRate'), 'var BIZ_RATE_DEFAULT=2.0;', grabFn('budCopyPlan'), grabFn('budCopyMap'), grabFn('budSrcYears'), grabFn('budCopyTargets'),
    'this.S=S; this.funds=funds; this.plan=budCopyPlan; this.map=budCopyMap; this.years=budSrcYears; this.targets=budCopyTargets; this.bizRate=bizRate; this.amt=budItemAmt;',
  ].join('\n')).call(box);
  return box;
})();

/* 목업 ② 의 가짜 자료 그대로(2026) */
const Y26 = {
  a: { gwan: 'int', name: '예금이자', base: '1,200,000', rate: '3.2', months: '12', ord: 1 },
  b: { gwan: 'loanint', name: '대부이자', base: '400,000', rate: '4.5', months: '12', ord: 2 },
  c: { gwan: 'purpose', name: '경조금', n: '120', n_unit: '인', price: '150', times: '2', t_unit: '회', ord: 3 },
  d: { gwan: 'admin', name: '회의비', price: '300', n: '4', n_unit: '회', ord: 4 },
  e: { gwan: 'spare', name: '예비비', price: '3,000', ord: 5 },
};

test('★★ 이율만 올해 기금 정보 이율로 — 원금·인원은 전년 값에 «확인 필요» 표시', () => {
  const rows = B.plan(Y26, 2.8);
  assert.equal(rows.length, 5);
  const [a, b, c, d, e] = rows;
  assert.equal(a.o.rate, '2.8', '예금이자 이율은 올해 값');
  assert.equal(a.rateFrom, 3.2);
  assert.equal(a.o.base, '1,200,000', '원금은 추정하지 않고 전년 값 그대로');
  assert.deepEqual(a.o.chk, { base: 1 });
  assert.equal(B.amt(a.o), 33600, '1,200,000 × 2.8% = 33,600 (목업)');
  assert.equal(b.o.rate, '4.5', '대부이자 이율은 건드리지 않는다');
  assert.equal(b.rateFrom, null);
  assert.deepEqual(b.o.chk, { base: 1 });
  assert.deepEqual(c.o.chk, { n: 1 }, '목적사업은 인원 칸');
  assert.equal(c.o.n, '120');
  assert.equal(d.o.chk, undefined, '관리비는 그대로');
  assert.equal(e.o.chk, undefined, '예비비는 그대로');
  assert.deepEqual(c.why, ['인원 확인']);
});

test('복사는 원본을 바꾸지 않고, 원본의 옛 확인 표시·id 는 가져오지 않는다', () => {
  const src = JSON.parse(JSON.stringify(Y26)); src.a.chk = { base: 1 };
  const rows = B.plan(src, 2.8);
  assert.equal(src.a.rate, '3.2', '원본 이율 그대로');
  assert.equal(rows[0].o._id, undefined);
  assert.deepEqual(rows[0].o.chk, { base: 1 }, '새 표시는 다시 단다');
  assert.deepEqual(JSON.parse(JSON.stringify(Y26)), Y26);
});

test('비어 있는 칸은 지어내지 않는다 — 원금이 빈 줄은 표시를 달지 않는다', () => {
  const rows = B.plan({ x: { gwan: 'int', name: '예금이자', rate: '3.0', ord: 1 } }, 2.8);
  assert.equal(rows[0].o.base, undefined);
  assert.equal(rows[0].o.chk, undefined);
  assert.equal(B.plan(Y26, '')[0].o.rate, '3.2', '올해 이율을 모르면 그대로 둔다');
});

test('새 줄 묶음 — 차례 유지·id 겹침 없음', () => {
  const m = B.map(B.plan(Y26, 2.8));
  const ks = Object.keys(m);
  assert.equal(ks.length, 5); assert.equal(new Set(ks).size, 5);
  const ords = ks.map((k) => m[k].ord);
  assert.deepEqual(ords, ords.slice().sort((x, y) => x - y));
  assert.deepEqual(ks.map((k) => m[k].name), ['예금이자', '대부이자', '경조금', '회의비', '예비비']);
});

test('지난해 찾기 — 올해보다 앞선 해 중 항목이 있는 해, 가까운 해부터', () => {
  const f = { years: { 2024: { budget_items: Y26 }, 2025: { budget_items: {} }, 2026: { budget_items: Y26 }, 2027: { budget_items: Y26 }, 2028: { budget_items: Y26 } } };
  assert.deepEqual(B.years(f, 2027), ['2026', '2024']);
  assert.deepEqual(B.years({}, 2027), []);
});

test('★ 일괄 대상 — 운영 중인 기금만, 올해 항목이 이미 있으면 have>0 로 표시(건너뜀)', () => {
  Object.keys(B.funds).forEach((k) => delete B.funds[k]);
  Object.assign(B.funds, {
    A: { _id: 'A', name: '예시 지역공동기금 A', fund_type: '공동', years: { 2026: { budget_items: Y26 } } },
    B: { _id: 'B', name: '예시 지역공동기금 B', fund_type: '공동', years: { 2026: { budget_items: Y26 }, 2027: { budget_items: { z: Y26.a } } } },
    C: { _id: 'C', name: '예시 사내기금 C', fund_type: '사내', years: {} },
    D: { _id: 'D', name: '예시 종료 기금', lifecycle: '기록보관', years: { 2026: { budget_items: Y26 } } },
    E: { _id: 'E', name: '예시 샘플', _sample: true, years: { 2026: { budget_items: Y26 } } },
  });
  const T = B.targets();
  assert.deepEqual(T.map((t) => t.id), ['C', 'A', 'B'], '이름 가나다순');
  assert.deepEqual(T.map((t) => [t.src, t.n, t.have]), [[null, 0, 0], ['2026', 5, 0], ['2026', 5, 1]]);
});

test('배선 — 노란 표시는 칸을 고치면 사라지고, 복사는 세부 항목만 쓴다', () => {
  const set = grabFn('budItemSet');
  assert.match(set, /up\['chk\/'\+k\]=null/, '칸을 고치면 그 칸의 확인 표시를 지운다');
  assert.match(set, /\.update\(up\)/);
  const html = grabFn('budItemsHTML');
  assert.ok(html.includes('budCopyOpen()') && html.includes("hlp('budget.copy')"), '머리줄에 복사 단추와 ⓘ');
  assert.ok(html.includes('background:#fde68a') && html.includes('budChkOk(') && html.includes('budChkAll()'), '노란 칸·확인·확인 끝');
  ['budCopyGo', 'budCopyMultiGo'].forEach((n) => {
    const f = grabFn(n);
    assert.ok(!/\/welfare\/|\/budget\/|\/closing\//.test(f), n + ': 목적사업 탭·예산 다섯 칸·결산은 건드리지 않는다');
    assert.ok(f.includes('_audit('), n + ': 일지에 남긴다');
  });
  assert.match(grabFn('budCopyMultiGo'), /!t\.have/, '일괄은 이미 있는 기금을 건너뛴다');
  assert.match(grabFn('budCopyGo'), /have&&!B\.over/, '한 곳씩은 «지우고 다시» 체크 없이는 덮어쓰지 않는다');
  assert.ok(/'budget\.copy':\{t:/.test(SRC), '도움말 항목');
});

test('★ 예금 이자율은 소수 그대로 읽는다 — 진짜 num()(정수 반올림)을 써도 2.8% 가 3% 가 되지 않는다', () => {
  assert.equal(B.bizRate({ interest_rate: '2.8' }), 2.8);
  assert.equal(B.bizRate({ interest_rate: 3.25 }), 3.25);
  assert.equal(B.bizRate({ interest_rate: '3.5%' }), 3.5);
  assert.equal(B.bizRate({ interest_rate: '0' }), 0, '0%는 사람이 일부러 적은 값이다');
  [{}, { interest_rate: '' }, { interest_rate: '-1' }, { interest_rate: '99' }, { interest_rate: 'abc' }]
    .forEach((f) => assert.equal(B.bizRate(f), 2.0, JSON.stringify(f)));
});