'use strict';
/* 이관은 「부가세 포함」 표시를 «함께» 들고 간다 (건의 2026-09-10 김보람 · 고침 2026-09-11)

   ■ 건의
     「계약관리에 부가세포함 금액으로 등록했는데 사건이 이관되면 부가세별도 금액으로
      바뀝니다. (부가세 포함 체크 후 165만원 → 이관하면 부가세 별도 165만원.
      거래내역에서 매칭할 때 165,000원 차액이 생김)」

   ■ 실측 (2026-09-11 · 운영 자료)
     계약에서 이관된 사건 23건 가운데 **12건에 부가세 칸이 아예 없었다.**
     그 가운데 «원본 계약에는 부가세 포함이 켜져 있던» 것이 **7건**이고,
     부해등-2026-005(← 계약-2026-131 · 착수금 1,650,000)이 건의에 적힌 바로 그 건이다.

   ■ 까닭
     transferContract 의 사건(case) 갈래가 그 두 칸을 «안 넣었다».
     컨설팅·기금·기타 갈래는 넣고 있었다 — 사건만 빠져 있었다.

   ■ 이 검사가 지키는 것
     ① 사건 이관이 부가세 두 칸을 다 들고 간다
     ② 컨설팅·기금·기타도 그대로 들고 간다 (되돌아가지 않게)
     ③ 두 칸이 «따로» 쓰인다 — 착수금은 contractFee…, 성공보수는 balanceFee… */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { test } = require('node:test');
const { cutFn } = require('./cut-fn');
const { stripComments } = require('./strip-comments');

const R = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(R, 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');
const 이관 = stripComments('<script>' + cutFn(src, 'function transferContract(') + '</script>');

/* 사건 갈래만 잘라 본다 — 아래 컨설팅 갈래가 같은 줄을 갖고 있어, 통째로 보면
   사건에서 빼도 검사가 통과한다(2026-09-11 되돌림 검사에서 확인). */
function 사건갈래(){
  const from = 이관.indexOf("if(kindV === 'case')");
  const to = 이관.indexOf('// consulting / fund / other', from) >= 0
    ? 이관.indexOf('// consulting / fund / other', from)
    : 이관.indexOf('var typeKeyMap', from);
  assert.ok(from > 0 && to > from, '사건 갈래를 못 찾았습니다');
  return 이관.slice(from, to);
}

test('① ★★ 사건 이관이 부가세 두 칸을 «다» 들고 간다', function () {
  const 사건 = 사건갈래();
  assert.match(사건, /contractFeeVatIncluded:\s*!!contract\.contractFeeVatIncluded/,
    '★★ 착수금 쪽 부가세 표시를 안 들고 갑니다 — 165만원이 181만 5천으로 셈해집니다');
  assert.match(사건, /balanceFeeVatIncluded:\s*!!contract\.balanceFeeVatIncluded/,
    '★★ 성공보수 쪽 부가세 표시를 안 들고 갑니다');
});

test('② ★ 컨설팅·기금·기타도 그대로 들고 간다 — 되돌아가지 않게', function () {
  const from = 이관.indexOf('var typeKeyMap');
  const 나머지 = 이관.slice(from);
  assert.ok(from > 0, '공통 갈래를 못 찾았습니다');
  assert.match(나머지, /contractFeeVatIncluded:\s*!!contract\.contractFeeVatIncluded/);
  assert.match(나머지, /balanceFeeVatIncluded:\s*!!contract\.balanceFeeVatIncluded/);
});

test('③ ★★ 두 칸은 «따로» 쓰인다 — 하나만 넣으면 반만 고쳐진다', function () {
  const 미납 = stripComments('<script>' + cutFn(src, 'function erpUnpaidParts(') + '</script>');
  /* 착수금·계약금은 contractFee…(cVat), 성공보수·잔금은 balanceFee…(bVat) 를 본다.
     이 짝이 깨지면 이관에서 한 칸만 들고 가도 반쪽만 맞는다. */
  assert.match(미납, /var cVat = it\.contractFeeVatIncluded/, '착수금 쪽 표시가 바뀌었습니다');
  assert.match(미납, /bVat = it\.balanceFeeVatIncluded/, '성공보수 쪽 표시가 바뀌었습니다');
  assert.match(미납, /'착수금',\s*it\.retainerFee,\s*'retainerPaidAmount',\s*cVat/,
    '★ 착수금이 보는 표시가 바뀌었습니다');
  assert.match(미납, /'successPaidAmount',\s*bVat/, '★ 성공보수가 보는 표시가 바뀌었습니다');
});

/* ── ⑤⑥⑦ 지난 기록 바로잡기 (2026-09-14) ──────────────────────────────
   코드는 2026-09-11 에 고쳤지만 «이미 이관된» 기록은 스스로 안 고쳐진다.
   ★ 실측 2026-09-14: 어긋난 칸 10개 · 거래내역 차액 합계 1,715,500원
     (건의에 적힌 부해등-2026-005 ← 계약-2026-131 이 그 중 하나다).
   그래서 환경설정 → 시스템 → 데이터 관리에 «바로잡기» 단추를 만들었다.
   운영 자료를 고치는 단추라 지켜야 할 것이 많다. */

test('⑤ ★★ 바로잡기는 «금액을 건드리지 않는다» — 표시 한 칸만 바꾼다', function () {
  const 고침 = stripComments('<script>' + cutFn(src, 'function VatCarryFixSection(') + '</script>');
  /* 쓰는 것은 dbPatch 한 곳이고, 넣는 것은 참/거짓 한 칸뿐이어야 한다 */
  assert.match(고침, /var p = \{\};\s*p\[x\.flag\] = true;/,
    '★★ 표시 말고 다른 것을 씁니다 — 금액이 바뀌면 돈이 틀어집니다');
  assert.match(고침, /dbPatch\(x\.store, x\.id, p\)/, '★ 기록을 고치는 자리가 바뀌었습니다');
  /* ⚠ 금액 칸 이름이 쓰기 쪽에 나타나면 안 된다 */
  const 쓰는곳 = 고침.slice(고침.indexOf('async function fix'), 고침.indexOf('async function fix') + 900);
  assert.ok(!/retainerFee|successFee|contractFee\b|balanceFee\b/.test(쓰는곳),
    '★★ 고치는 자리에 «금액 칸»이 들어왔습니다 — 표시만 바꿔야 합니다');
  /* 한 방향뿐 — 「포함」으로 맞추기만 하고, 지우지 않는다 */
  assert.ok(!/=\s*false/.test(쓰는곳),
    '★★ 표시를 «지우는» 길이 생겼습니다 — 사람이 일부러 별도로 둔 것을 되돌리면 안 됩니다');
});

test('⑥ ★★ 잇는 열쇠가 sourceContractNo · sourceContractId 다', function () {
  const 훑기 = stripComments('<script>' + cutFn(src, 'function erpVatCarryScan(') + '</script>');
  /* ⚠ srcContractId·contractId 로 이으면 «0건»이 나온다(2026-09-12 에 실제로 그랬다).
     0건은 「고칠 것이 없다」로 읽혀서 틀린 안심을 준다 — 그래서 열쇠를 못 박는다. */
  assert.match(훑기, /it\.sourceContractNo && byNo\[it\.sourceContractNo\]/,
    '★★ 계약번호로 안 잇습니다 — 0건이 나와 「고칠 것이 없다」로 읽힙니다');
  assert.match(훑기, /it\.sourceContractId && byId\[it\.sourceContractId\]/,
    '★★ 계약 id 로 안 잇습니다');
  assert.ok(!/srcContractId/.test(훑기), '★★ 없는 이름(srcContractId)으로 잇습니다 — 0건이 됩니다');
});

test('⑦ ★ 셈에서 빼야 할 것을 뺀다 — %·0원·이미 맞는 것', function () {
  const 훑기 = stripComments('<script>' + cutFn(src, 'function erpVatCarryScan(') + '</script>');
  assert.match(훑기, /if\(!c\[flag\]\) return;/, '★★ 계약이 «포함»인지 안 보고 고칩니다');
  assert.match(훑기, /if\(it\[flag\]\) return;/, '★ 이미 맞는 칸도 고치려 듭니다');
  assert.match(훑기, /successFeeType === 'percent'/,
    '★★ 성공보수 %(요율)를 금액으로 셉니다 — 요율에는 부가세가 없습니다');
  assert.match(훑기, /if\(!amt\) return;/, '★ 0원도 어긋났다고 셉니다');
  /* 돈이 걸린 자리 — 관리자만 본다 */
  const 화면 = stripComments('<script>' + cutFn(src, 'function VatCarryFixSection(') + '</script>');
  assert.match(화면, /CURRENT_USER\.isAdmin \|\| CURRENT_USER\.isSubAdmin/,
    '★★ 아무나 돈 기록을 고칠 수 있습니다');
  /* ⚠ 「popConfirm 이라는 글자가 있나」로는 부족하다 — if(false && await popConfirm(…))
     처럼 «묻기만 하고 막지 않는» 자리에도 그 글자는 그대로 남는다(되돌림 검사에서 드러났다).
     묻고 «아니면 돌아서는지»를 본다. */
  assert.match(화면, /if\(!\(await popConfirm\(/,
    '★★ 묻기는 해도 «아니오»에서 안 돌아섭니다 — 묻지도 않고 고치는 것과 같습니다');
});

test('④ ★ 「부가세 포함」이면 그대로, 아니면 ×1.1 — 셈은 한 곳에서만', function () {
  const 셈 = stripComments('<script>' + cutFn(src, 'function erpExpectAmount(') + '</script>');
  assert.match(셈, /taxType\s*\?\s*f\s*:\s*Math\.round\(f\s*\*\s*1\.1\)/,
    '★ 부가세 셈이 바뀌었습니다 — 표시가 있어도 ×1.1 하면 고친 뜻이 없어집니다');
  /* 165만원 예: 표시가 있으면 1,650,000 · 없으면 1,815,000 → 차액 165,000 */
  const f = 1650000;
  assert.equal(Math.round(f * 1.1) - f, 165000, '건의에 적힌 차액 165,000원과 셈이 맞지 않습니다');
});
