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

test('업태·종목·규모는 «보이는 글자» 라벨 없이 남아 있다 — 높이맞춤용 spacer 는 예외', () => {
  /* ⚠ 값이 있으면 스스로 무엇인지 알 수 있는 칸(업태·종목·규모)까지 «보이는»
     라벨을 붙이면, "라벨 없이" 원칙이 슬금슬금 다 없어진다. 예외는 «구별이
     안 되는 칸»만이다.
     ★ 2026-09-21 추가: 고용·산재 칸 위에 글자를 얹었더니(위 테스트) 그 두
     칸만 높아져 업태·종목·규모와 줄이 안 맞았다(대표 지시 「행일치시키고」).
     그래서 업태 등도 div 로 감싸되, «안 보이는» 같은 높이의 글자(visibility:
     hidden)만 얹어 높이만 맞춘다 — 이건 라벨이 아니라 spacer라 예외로 본다. */
  const 자리 = MODAL.indexOf("placeholder:'업태'");
  assert.ok(자리 > 0, '업태 칸을 못 찾았습니다.');
  const 앞부분 = MODAL.slice(Math.max(0, 자리 - 300), 자리);
  if(/h\('div',\s*null,\s*h\('div'/.test(앞부분)){
    assert.match(앞부분, /visibility:\s*'hidden'/,
      '업태 칸을 div 로 감쌌는데 visibility:hidden 이 없습니다 — «보이는» 라벨을 붙인 것입니다(예외가 넓어졌습니다).');
  }
});

test('업태·종목·규모 칸도 고용·산재와 같은 높이의 spacer 를 얹어 줄을 맞춘다', () => {
  const bizType자리 = MODAL.indexOf("placeholder:'업태'");
  const bizCat자리 = MODAL.indexOf("placeholder:'종목'");
  const size자리 = MODAL.indexOf("value:f.company.companySize");
  assert.ok(bizType자리 > 0 && bizCat자리 > 0 && size자리 > 0, '업태·종목·규모 칸을 못 찾았습니다.');
  [bizType자리, bizCat자리, size자리].forEach(function(자리){
    const 앞부분 = MODAL.slice(Math.max(0, 자리 - 300), 자리);
    assert.match(앞부분, /h\('div',\s*null,\s*h\('div',\s*\{\s*style:\{[^}]*visibility:\s*'hidden'/,
      '높이맞춤 spacer(visibility:hidden) 를 못 찾았습니다 — 고용·산재보다 줄이 위로 붙습니다.');
  });
});
