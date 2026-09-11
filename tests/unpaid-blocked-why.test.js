'use strict';
/* 「받을 것이 있는데 금액을 못 내서 빠진 자리」를 화면이 말한다 (대표 지시 2026-09-11)

   ■ 건의 (2026-09-10)
     「2025년 수임 사건의 성공보수가 2026년에 들어왔는데 거래내역에서 매칭이 안 됩니다」

   ■ 실측으로 알아낸 것
     해가 바뀐 것과는 «상관이 없다» — 후보 목록에 연도 거르개는 없다.
     까닭은 erpUnpaidParts 의 `if(f <= 0) return;` 이다. 성공보수를 「%」로 두고
     승소금액을 안 넣으면 caseSuccessFeeAmount 가 0 을 내어 **말없이** 빠진다.

   ■ 이 검사가 지키는 것
     ① 그런 항목을 찾아낸다 (erpUnpaidBlocked)
     ② 이미 받은 건·금액이 멀쩡한 건은 건드리지 않는다
     ③ 「받을 항목이 없다」와 «갈라서» 말한다 — 뭉치면 「건을 만드세요」로 잘못 안내한다
     ④ 후보 목록 자체는 «안 바꾼다» — 금액 0 을 넣으면 매칭·합계가 흔들린다 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const { test } = require('node:test');
const { cutFn } = require('./cut-fn');
const { stripComments } = require('./strip-comments');

const R = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(R, 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');
const bare = stripComments(src);

/* 진짜 함수를 그대로 실어 돌린다 — 흉내낸 사본은 본체가 바뀌어도 통과한다 */
const ctx = { console: console };
vm.createContext(ctx);
vm.runInContext(cutFn(src, 'function caseSuccessFeeAmount('), ctx);
vm.runInContext(cutFn(src, 'function erpClosedUnpaid('), ctx);
vm.runInContext(cutFn(src, 'function erpUnpaidBlocked('), ctx);
const blocked = (it) => vm.runInContext('erpUnpaidBlocked(' + JSON.stringify(it) + ')', ctx);
const feeOf = (it) => vm.runInContext('caseSuccessFeeAmount(' + JSON.stringify(it) + ')', ctx);

const 퍼센트_승소금액없음 = { id: 'c1', companyName: '가나상사', successFee: 15, successFeeType: 'percent' };

test('① ★★ 성공보수가 %인데 승소금액이 비면 «금액을 못 낸다»', function () {
  assert.equal(feeOf(퍼센트_승소금액없음), 0, '이 경우 금액이 0 이라는 전제가 깨졌습니다');
  const b = blocked(퍼센트_승소금액없음);
  assert.equal(b.length, 1, '★★ 말없이 빠지는 항목을 못 찾습니다');
  assert.equal(b[0].splitLabel, '성공보수');
  assert.match(b[0].why, /승소금액/, '★ 무엇이 비었는지 안 알려 줍니다');
  assert.match(b[0].why, /15/, '★ 몇 %인지 안 알려 줍니다');
  assert.ok(b[0].fix, '★ 어떻게 고치는지 안 알려 줍니다');
});

test('② ★ 멀쩡한 건은 건드리지 않는다', function () {
  assert.deepEqual(blocked({ successFee: 15, successFeeType: 'percent', judgmentAmount: 10000000 }), [],
    '★ 승소금액이 있는데도 막힌 것으로 봅니다');
  assert.deepEqual(blocked({ successFee: 3000000, successFeeType: 'amount' }), [],
    '★ 금액으로 적은 성공보수를 막힌 것으로 봅니다');
  assert.deepEqual(blocked({ successFee: 0, successFeeType: 'percent' }), [],
    '★ 성공보수가 아예 없는 건까지 올립니다');
  assert.deepEqual(blocked(null), [], '빈 값에서 넘어집니다');
  assert.deepEqual(blocked({ _deleted: true, successFee: 15, successFeeType: 'percent' }), [],
    '★ 지운 건을 올립니다');
});

test('③ ★★ 이미 받은 건은 올리지 않는다 — 다 받은 돈을 다시 조르면 안 된다', function () {
  ['successPaid', 'successPaidDate'].forEach(function (k) {
    const it = Object.assign({}, 퍼센트_승소금액없음);
    it[k] = k === 'successPaid' ? true : '2026-02-02';
    assert.deepEqual(blocked(it), [], '★★ 이미 받은 건(' + k + ')을 아직 받을 것으로 올립니다');
  });
  /* 「여기까지로 닫은」 것도 더 기다릴 것이 아니다 */
  const 닫은것 = Object.assign({ unpaidClosed: { 성공보수: { amount: 1, reason: '포기' } } }, 퍼센트_승소금액없음);
  assert.deepEqual(blocked(닫은것), [], '★ 닫아 둔 항목을 다시 올립니다');
});

test('④ ★★ 후보 목록 자체는 안 바꾼다 — 금액 0 을 넣으면 매칭·합계가 흔들린다', function () {
  const parts = stripComments('<script>' + cutFn(src, 'function erpUnpaidParts(') + '</script>');
  assert.match(parts, /if\(f <= 0\) return;/,
    '★★ 금액 0 짜리가 후보에 들어갑니다 — 매칭·합계가 흔들립니다');
  assert.ok(!/erpUnpaidBlocked/.test(parts), '★ 후보 만드는 곳이 막힌 항목까지 섞고 있습니다');
});

test('⑤ ★★ 「받을 항목이 없다」와 «갈라서» 말한다', function () {
  const why = stripComments('<script>' + cutFn(src, 'function whyNone(') + '</script>');
  assert.match(why, /blocked/, '★★ 막힌 항목을 안 봅니다');
  /* 갈라 보지 않으면 「등록된 업체지만 받을 항목이 없습니다」로 잘못 안내한다 —
     건은 이미 있는데 「사무관리에 건을 만드세요」라고 하는 셈이다. */
  assert.match(why, /n === 0 && blocked\.length/,
    '★★ 받을 항목이 없는 것과 금액을 못 낸 것을 뭉쳐 봅니다');
  assert.match(bare, /kind:'blocked'/, '★ blocked 갈래를 만들지 않았습니다');
  /* ⚠ 표를 «만들기만» 하고 안 채우면 whyNone 은 늘 빈 목록을 본다 — 찾아 놓고
     아무 일도 안 하는 셈이다. 채우는 줄까지 못 박는다
     (2026-09-11 되돌림 검사에서 이 구멍이 드러났다). */
  const idx = bare.slice(bare.indexOf('var _blockedByCo'), bare.indexOf('function whyNone('));
  assert.ok(idx.length > 50, '막힌 항목 표를 못 찾았습니다');
  assert.match(idx, /erpUnpaidBlocked\(/, '★★ 표를 채울 때 막힌 항목을 찾지 않습니다');
  assert.match(idx, /_blockedByCo\[k\]\.push\(/,
    '★★ 찾아 놓고 표에 안 담습니다 — whyNone 이 늘 빈 목록을 봅니다');
});

test('⑥ ★ 화면이 그 갈래를 «먼저» 그린다 — 뒤에 두면 noitem 이 가로챈다', function () {
  const 그림 = bare.indexOf("_why.kind==='blocked'");
  const 없음 = bare.indexOf("_why.kind==='noitem'");
  assert.ok(그림 > 0, '★★ 화면에 그 갈래가 없습니다 — 찾아 놓고 안 보여 줍니다');
  assert.ok(그림 < 없음, '★★ noitem 뒤에 두면 영영 안 그려집니다');
  assert.match(bare, /받을 항목은 있는데 금액이 비었습니다/, '★ 사람이 읽을 말이 없습니다');
});

test('⑦ ★ 사건 편집창의 경고는 그대로 둔다 — 두 자리가 같은 말을 해야 한다', function () {
  assert.match(bare, /승소금액을 넣어야 입금관리에 뜹니다/,
    '★ 사건 편집창 경고를 지웠습니다. 거래내역에서만 알려 주면 사건을 고치러 갈 때 또 헤맵니다');
});
