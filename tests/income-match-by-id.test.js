'use strict';
/* 자문료 수입 줄은 업체 번호가 있으면 번호로 «그 회사 것»인지 본다 (대표 「추천대로」 2026-10-04, 가 단계)
   ── 왜: 상호가 바뀌면 이름으로는 지난 입금이 떨어져 나가 «안 냄»으로 보이고, 같은 달 자문료를 또 만들라고 했다.
   ── 옛 줄(번호 없음)은 지금처럼 이름으로 — 그 줄에 번호를 붙이는 일(나 단계)은 미뤘다.

   못 박는 것(규칙):
   ① 둘 다 번호가 있으면 번호만 본다 — 이름이 달라도 같은 회사, 같아도 번호가 다르면 남
   ② 번호 없는 옛 줄·이름만 넘어온 자리는 이름으로 본다
   ③ 입금관리 업체입금 탭(냈나·얼마·그 줄)·자동 짝짓기·자문료 만들기 중복 막이·분기/선납 판정이 이 한 곳을 쓴다
   ④ 새로 만드는 자문료 줄은 업체 번호를 함께 적는다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn.js');
const { stripJs } = require('./strip-comments.js');

const B = stripJs(fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n'));
const fn = (n, from) => { const f = cutFn(from || B, 'function ' + n + '('); assert.ok(f, n + ' 를 못 찾았습니다'); return f; };
const TAB = fn('IncomeCompanyTab');

function 상자(incomes) {
  const ctx = { incomes, selYear: 2026, String };
  vm.createContext(ctx);
  vm.runInContext([fn('incomeIsCo'), fn('isPaid', TAB), fn('paidInfo', TAB), fn('getItem', TAB)].join('\n'), ctx);
  return ctx;
}

test('① ★★ 상호가 바뀌어도 번호로 지난 입금을 찾는다 · 같은 이름 남의 회사는 아니다', () => {
  const c = 상자([
    { id: 'i1', companyId: 'co1', companyName: '가나상사', sourceKind: 'company', date: '2026-03-10', amount: 200000 },
    { id: 'i2', companyId: 'co9', companyName: '다라상회', sourceKind: 'company', date: '2026-03-12', amount: 100000 }
  ]);
  const 새이름 = { id: 'co1', name: '가나홀딩스' };      // 상호를 바꿨다
  assert.equal(c.isPaid(새이름, 3), true, '★★ 상호가 바뀌자 3월 자문료가 «안 냄»으로 보입니다 — 또 받으라고 합니다');
  assert.equal(c.getItem(새이름, 3).id, 'i1');
  assert.equal(c.paidInfo(새이름, 3, 200000).full, true);
  const 같은이름남 = { id: 'co2', name: '다라상회' };     // 이름만 같은 다른 회사
  assert.equal(c.isPaid(같은이름남, 3), false, '★★ 이름만 같은 남의 입금을 내 것으로 칩니다');
});

test('② 번호 없는 옛 줄·이름만 넘어온 자리는 이름으로 본다', () => {
  const c = 상자([{ id: 'i3', companyName: '가나상사', sourceKind: 'company', date: '2026-02-05', amount: 200000 }]);
  assert.equal(c.isPaid({ id: 'co1', name: '가나상사' }, 2), true, '★ 번호 없는 옛 줄을 못 찾습니다 — 1~8월 입금이 사라져 보입니다');
  assert.equal(c.isPaid('가나상사', 2), true, '이름만 넘어온 자리가 깨졌습니다');
  assert.equal(c.isPaid({ id: 'co1', name: '가나홀딩스' }, 2), false, '번호 없는 옛 줄을 다른 이름으로 잇습니다');
});

test('③ ★★ 견주는 자리가 모두 incomeIsCo 한 곳을 쓴다 — 이름 견주기가 남지 않는다', () => {
  ['isPaid', 'paidInfo', 'getItem'].forEach((n) => assert.match(fn(n, TAB), /incomeIsCo\(i, who\)/, '★ ' + n + ' 가 아직 이름으로 견줍니다'));
  assert.doesNotMatch(TAB, /(?:isPaid|getItem|paidInfo)\([\w.]*\.name,/, '★★ 탭이 아직 «이름»을 넘깁니다 — 번호로 못 견줍니다');
  assert.doesNotMatch(TAB, /co\.name===i\.companyName/, '한 달 전체 해제가 이름으로 견줍니다');
  const auto = fn('erpAutoMarkCompanyIncome');
  assert.match(auto, /incomeIsCo\(i, co\)/, '★ 자동 짝짓기의 «이미 냈나»가 이름으로 봅니다');
  assert.doesNotMatch(auto, /alreadyPaid\(c\.co\.name/, '자동 짝짓기가 이름을 넘깁니다');
  assert.doesNotMatch(B, /i\.companyName===co\.name/, '★ 이름으로만 견주는 자리가 남았습니다');
});

test('④ ★ 새로 만드는 자문료 줄은 업체 번호를 함께 적는다', () => {
  const 줄 = B.split('\n');
  const 만드는 = [];
  줄.forEach((L, k) => {
    if (L.indexOf("sourceKind:'company', sourceId:''") < 0) return;
    if (/\bco\.(fee|payDay)\b|\(co\b/.test((줄[k - 1] || '') + L)) 만드는.push(L);
  });
  assert.ok(만드는.length >= 5, '자문료 줄 만드는 자리를 못 찾았습니다(' + 만드는.length + ') — 검사가 헛돕니다');
  const 빠짐 = 만드는.filter((L) => !/companyId:\(co && co\.id\)/.test(L));
  assert.deepEqual(빠짐, [], '★ 업체 번호 없이 만드는 자리가 있습니다 — 그 줄은 상호가 바뀌면 떨어져 나갑니다');
});
