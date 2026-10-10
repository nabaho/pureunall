'use strict';
/* 💰 이알피 금액 받아오기 (대표 지시 2026-10-09 「이알피금액도 받아오게」)
   못 박는 것:
     ① 금액 = 계약금 + 잔금 (+ 옛 컨설팅비) — fee 칸은 계약금과 같은 값이라 더하지 않는다
     ② 부가세 포함분은 ÷1.1 — 섞인 채로 더하지 않고 «공급가액»으로 맞춘다
     ③ 사건은 안 받는다(성공보수 %) · 금액이 없으면 칸을 안 만든다
     ④ 이미 있는 실적: 비었거나 이알피에서 받은 금액만 고친다 · 사람이 적은 금액은 그대로 · 영구 열쇠만 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const P = require('../js/kcareer-pusync.js');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');

test('① 계약금 + 잔금 — fee 는 더하지 않는다 · 옛 컨설팅비', () => {
  assert.equal(P.amountOf('consultings', { fee: 1000000, contractFee: 1000000, balanceFee: 2000000 }), 3000000);
  assert.equal(P.amountOf('consultings', { consultingFee: 700000 }), 700000);
  assert.equal(P.amountOf('funds', { contractFee: '1,500,000' }), 1500000, '쉼표 섞인 글자도');
});

test('② 부가세 포함분은 공급가액으로', () => {
  assert.equal(P.amountOf('consultings', { contractFee: 1100000, contractFeeVatIncluded: true, balanceFee: 1000000, balanceFeeVatIncluded: false }), 2000000);
  assert.equal(P.amountOf('other_projects', { balanceFee: 1155000, balanceFeeVatIncluded: true }), 1050000);
});

test('③ 사건·업체는 안 받는다 · 금액이 없으면 칸을 안 만든다', () => {
  assert.equal(P.amountOf('cases', { contractFee: 5000000 }), 0);
  assert.equal(P.amountOf('companies', { contractFee: 5000000 }), 0);
  const m = P.mapRecord('consultings', 'k1', { id: 'c1', companyName: '가나상사', contractFee: 2000000, balanceFee: 1000000, status: 'closed' }, {}, []);
  assert.equal(m.rec.amt, '3000000');
  assert.equal(m.rec.amtFrom, 'erp', '어디서 온 금액인지 적는다 — 다음 동기화가 따라 고친다');
  const m0 = P.mapRecord('consultings', 'k2', { id: 'c2', companyName: '다라테크' }, {}, []);
  assert.ok(!('amt' in m0.rec), '없는 금액을 0 으로 적지 않는다');
});

test('④ 이미 있는 실적 — 비었거나 이알피 금액만 · 사람이 적은 것은 그대로 · 영구 열쇠만', () => {
  const coll = { consultings: [{ id: 'c1', companyName: '가나상사', contractFee: 2000000 }, { id: 'c2', companyName: '다라테크', contractFee: 900000 }] };
  const ref1 = P.refOf('consultings', 0, coll.consultings[0]), ref2 = P.refOf('consultings', 1, coll.consultings[1]);
  const recs = [
    { puRef: ref1, org: '가나상사' },                                   /* 빈 금액 → 받는다 */
    { puRef: ref2, org: '다라테크', amt: '1234', },                      /* 사람이 적은 금액 → 그대로 */
    { puRef: 'consultings/0', org: '가나상사' },                          /* 줄 번호 열쇠 → 안 건드린다 */
  ];
  assert.deepEqual(P.buildAmtUpdates(coll, recs), [{ puRef: ref1, amt: '2000000' }]);
  assert.deepEqual(P.buildAmtUpdates(coll, [{ puRef: ref2, org: '다라테크', amt: '500000', amtFrom: 'erp' }]), [{ puRef: ref2, amt: '900000' }], '이알피에서 바뀌면 따라 고친다');
  assert.deepEqual(P.buildAmtUpdates(coll, [{ puRef: ref1, amt: '2000000', amtFrom: 'erp' }]), [], '같으면 할 일 없음');
});

test('④ 화면 — 동기화가 금액을 받아 쓰고, 자동 동기화도 «할 일»로 센다', () => {
  assert.match(SRC, /var amtUps = KcareerPuSync\.buildAmtUpdates\(collData, after\);/);
  assert.match(SRC, /r\.amt = amtMap\[r\.puRef\]; r\.amtFrom = 'erp';/);
  assert.match(SRC, /\(ctx\.amtUps\|\|\[\]\)\.length/, '금액만 바뀐 날에도 자동 동기화가 돈다');
  assert.match(SRC, /<script src="js\/kcareer-pusync\.js\?v=\d+"><\/script>/);
});

test('⑤ 2026-10-10 검토 — 사람이 고친 금액은 지켜지고, 이알피에서 지운 금액은 비운다', () => {
  const save = SRC.slice(SRC.indexOf('function saveForm('), SRC.indexOf('function saveForm(') + 3000);
  assert.match(save, /'amt' in data && String\(data\.amt\|\|''\)!==String\(_amt0\|\|''\)\) delete db\[i\]\.amtFrom;/, '고치면 이알피 표시를 뗀다');
  assert.match(SRC, /if\(지금 && r\.amtFrom !== 'erp'\) return;/, '쓰는 순간에도 사람이 적은 금액이면 그대로');
  const coll = { consultings: [{ id: 'c1', companyName: '가나상사' }] };
  const ref = P.refOf('consultings', 0, coll.consultings[0]);
  assert.deepEqual(P.buildAmtUpdates(coll, [{ puRef: ref, amt: '900000', amtFrom: 'erp' }]), [{ puRef: ref, amt: '' }], '이알피에서 지워지면 비운다');
  assert.deepEqual(P.buildAmtUpdates(coll, [{ puRef: ref, amt: '900000' }]), [], '사람이 적은 것은 그대로');
});
