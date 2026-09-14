'use strict';
/* 업체관리에 «없는» 업체로 지난 계약을 넣을 때 — 막고 끝내지 않는다
   (건의 2026-09-10 김보람 「업체연결 기능으로 인해 계약관리에 지난 계약이 저장되지 않습니다」)

   ■ 건의
     26/1/30 신솔이엔에스 컨설팅 대금 440,000원 입금을 처리하려고, 26/1/27 자로 끝난
     그 컨설팅 건을 계약관리에 넣으려 했는데 저장이 안 됐다.

   ■ 까닭 (2026-09-14 실측)
     업체 연결 검증이 「업체를 선택하거나 신규·미확정 업체는 연결 보류를 선택하세요」로 막는다.
     신솔이엔에스는 업체관리에 **없다**(0건). 빠져나갈 「연결 보류」는 기업정보 탭 아래쪽
     작은 체크칸에 있는데, 저장 단추를 누른 사람에게는 그 자리가 안 보인다 —
     토스트만 뜨고 길이 없는 것처럼 느껴진다.
     ★ 한 곳 얘기가 아니다: **컨설팅 92건 가운데 69곳의 업체가 업체관리에 없다.**

   ■ 이 검사가 지키는 것
     ① 저장 단추 자리에서 «먼저 묻는다» — 막히기 전에 길을 준다
     ② 묻는 것은 «그 경우»만 (업체를 못 고른 때) — 다른 잘못까지 덮지 않는다
     ③ ★★ 문턱을 «풀지 않는다» — 이름이 같다고 업체 ID 를 채우지 않는다
     ④ 물을 필요 없는 자리(근로자 의뢰·이미 보류)는 안 묻는다
     ⑤ 검증 함수 자체는 그대로 — 이관·저장직전 재검사가 같은 문을 쓴다 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { test } = require('node:test');
const { cutFn } = require('./cut-fn');
const { stripComments } = require('./strip-comments');

const R = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(R, 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');
const bare = stripComments(src);
const 묻기 = stripComments('<script>' + cutFn(src, 'async function erpAskDeferCompanyLink(') + '</script>');

test('① ★★ 저장 단추 자리에서 «먼저» 묻는다 — 막히고 나서가 아니다', function () {
  /* ⚠ 고정 폭으로 자르지 않는다 — 창을 좁게 잡으면 함수 끝에 못 닿아 «안 보고 통과»한다
     (tests/test-cut-truncation.test.js 가 이것을 기계로 막는다). cutFn 으로 통째로 뽑는다.
     ⚠ save(form) 은 사건관리에도 있다 — 계약 쪽을 잡았는지 먼저 확인한다. */
  const 저장 = stripComments('<script>' + cutFn(src, 'async function save(form)') + '</script>');
  assert.match(저장, /erpValidateContractCompany/,
    '★ 계약 저장 자리를 못 잘랐습니다 — 다른 save 를 잡았는지 보세요');
  const 물음 = 저장.indexOf('erpAskDeferCompanyLink');
  const 검증 = 저장.indexOf('erpValidateContractCompany');
  assert.ok(물음 > 0, '★★ 저장할 때 길을 안 줍니다 — 토스트만 뜨고 끝납니다');
  assert.ok(검증 > 0, '★ 업체 연결 검증이 사라졌습니다');
  assert.ok(물음 < 검증, '★★ 묻기가 검증 «뒤»에 있습니다 — 이미 막힌 뒤라 소용이 없습니다');
  assert.match(저장, /form\s*=\s*await erpAskDeferCompanyLink\(form\)/,
    '★★ 물어 놓고 그 답을 «안 받습니다» — 고른 값이 저장에 안 실립니다');
});

test('② ★ 묻는 것은 «업체를 못 고른 때»만 — 다른 잘못까지 덮지 않는다', function () {
  assert.match(묻기, /checked\.code!=='company_selection_required'/,
    '★★ 어떤 잘못이든 「연결 보류」를 권합니다 — 업체가 «중복»이거나 «사업자번호가 다른» 것까지\n' +
    '   보류로 덮으면, 고쳐야 할 것을 덮고 지나갑니다');
  assert.match(묻기, /checked\.ok \|\|/, '★ 멀쩡할 때도 묻습니다');
});

test('③ ★★ 문턱을 «풀지 않는다» — 이름이 같다고 업체 ID 를 채우지 않는다', function () {
  /* 이 검증이 있는 까닭: 사업자번호가 같다는 이유로 자문 계약이 기금 업체에 들어간 적이 있다.
     「연결 보류」는 ID 를 «안 채운다»고 사람이 밝히는 것이라 그 위험이 없다. */
  assert.match(묻기, /companyId:\s*''/,
    '★★ 보류로 고를 때 업체 ID 를 비우지 않습니다 — 엉뚱한 업체에 붙을 수 있습니다');
  assert.match(묻기, /companyLinkStatus:\s*'pending'/,
    '★★ 「연결 보류」라고 표시하지 않습니다 — 나중에 무엇이 미확정인지 알 수 없게 됩니다');
  /* ⚠ 후보를 찾아 «저절로» 붙이는 길이 생기면 안 된다 */
  assert.ok(!/companyLinkAutoMatch|companyLinkCandidates/.test(묻기),
    '★★ 묻는 자리에서 업체를 «자동으로» 찾아 붙입니다 — 사람이 고른 것이 아닙니다');
  /* 사람이 고른 것만 보류가 된다 */
  assert.match(묻기, /await popConfirm\(/, '★★ 묻지도 않고 보류로 바꿉니다');
  assert.match(묻기, /if\(!yes\) return form;/,
    '★★ 「업체 고르기」를 골라도 보류로 바꿉니다 — 사람의 답을 무시합니다');
});

test('④ ★ 물을 필요 없는 자리는 안 묻는다', function () {
  assert.match(묻기, /clientType==='worker'/,
    '★ 근로자 의뢰인데도 업체를 고르라고 묻습니다 — 그쪽은 업체가 없는 게 정상입니다');
  assert.match(묻기, /companyLinkStatus==='pending'/,
    '★ 이미 보류로 고른 것에 또 묻습니다');
});

test('⑤ ★★ 검증 함수 자체는 그대로 — 이관·저장직전 재검사가 같은 문을 쓴다', function () {
  const 검증 = stripComments('<script>' + cutFn(src, 'function erpValidateContractCompany(') + '</script>');
  assert.match(검증, /if\(!checked\.ok\)\{showToast\('⚠ '\+checked\.message\);return null;\}/,
    '★★ 검증 문이 물러졌습니다 — 이관·저장직전 재검사도 이 문을 씁니다');
  assert.ok(!/popConfirm/.test(검증),
    '★★ 검증 함수가 사람에게 묻습니다 — 이관처럼 «사람이 없는» 자리에서도 창이 뜹니다');
});
