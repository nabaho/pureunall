'use strict';
/* 계약관리 › 계약 추가 › 기업정보 — 고용·산재 가입자수 칸 위 이름표
   (대표 지시 2026-09-21 「4대보험가입자 줄의 숫자위에 고용 산재 단어 넣어라」)

   ⚠ 이건 「셀 위 라벨 없이, placeholder 로만」(2026-09-19) 원칙의 «예외»다 —
   부담당 슬롯과 같은 까닭. placeholder 는 값이 «비어 있을 때만» 보이는데
   고용·산재 인원수는 기본값이 0(빈 칸이 아니라 «값 0»)이라 placeholder 가
   한 번도 안 뜨고, 값 자체(0)로는 어느 쪽인지 구별이 안 된다.

   ★ 여기서 못 박는 것은 «라벨이 있는가»이지 글자 크기·색 같은 «지금 값»이 아니다. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { cutFn } = require('./cut-fn');
const { stripJs } = require('./strip-comments');

const RAW = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8');
const MODAL = stripJs(cutFn(RAW, 'function ContractModal(props)'));

test('고용·산재 가입자수 칸 위에 «고용»·«산재» 글자가 실제로 있다', () => {
  const 고용자리 = MODAL.indexOf("onChange:setCompanyField('employmentInsuredCount')");
  const 산재자리 = MODAL.indexOf("onChange:setCompanyField('injuryInsuredCount')");
  assert.ok(고용자리 > 0 && 산재자리 > 고용자리, '고용·산재 칸을 못 찾았습니다.');

  const 고용주변 = MODAL.slice(Math.max(0, 고용자리 - 400), 고용자리);
  const 산재주변 = MODAL.slice(Math.max(0, 산재자리 - 400), 산재자리);

  assert.match(고용주변, /,\s*'고용'\s*\)/, '고용 칸 «위»에 «고용» 글자가 없습니다.');
  assert.match(산재주변, /,\s*'산재'\s*\)/, '산재 칸 «위»에 «산재» 글자가 없습니다.');
});

test('업태·종목·규모는 그대로 라벨 없이(placeholder 만) 남아 있다 — 예외를 넓히지 않는다', () => {
  /* ⚠ 값이 있으면 스스로 무엇인지 알 수 있는 칸(업태·종목·규모)까지 라벨을
     붙이면, "라벨 없이" 원칙이 슬금슬금 다 없어진다. 예외는 «구별이 안 되는
     칸»만이다. */
  const 자리 = MODAL.indexOf("placeholder:'업태'");
  assert.ok(자리 > 0, '업태 칸을 못 찾았습니다.');
  const 앞부분 = MODAL.slice(Math.max(0, 자리 - 200), 자리);
  assert.doesNotMatch(앞부분, /h\('div',\s*null,\s*h\('div'/,
    '업태 칸에도 라벨용 div 를 씌웠습니다 — 예외가 필요 없는 칸까지 늘렸습니다.');
});
