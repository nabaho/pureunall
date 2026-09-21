'use strict';
/* 계약관리 › 계약 추가 › 계약정보 — 계약유형 6칸 (대표 지시 2026-09-21 「계약유형 셀 1줄로 만들어라」)

   여태 3열×2줄(1fr 1fr 1fr) 이었다. 6종(상담사항·업체계약·사건계약·컨설팅계약·
   기금관리·기타사업)이 다 짧은 낱말이라 한 줄에 다 들어간다.

   ★ 이 검사가 못 박는 것은 «규칙»이지 «지금 값(6)»이 아니다 — 칸 수를 숫자로
   안 보고, 그리드 열 수를 CONTRACT_KINDS.length(항목 개수)에서 «뽑아 쓰는지»를
   본다. 그래야 나중에 계약유형이 7종으로 늘어도 줄이 저절로 따라간다. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { cutFn } = require('./cut-fn');
const { stripJs } = require('./strip-comments');

const RAW = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8');
const MODAL = stripJs(cutFn(RAW, 'function ContractModal(props)'));

test('계약유형 그리드는 «항목 개수만큼» 열이 나온다 — 6을 그대로 박지 않는다', () => {
  const 자리 = MODAL.indexOf("h('label', null, '계약유형 (다중 선택 가능) *')");
  assert.ok(자리 > 0, '계약유형 라벨을 못 찾았습니다.');
  const 그리드줄 = MODAL.slice(자리, 자리 + 300);

  assert.match(그리드줄, /gridTemplateColumns:\s*'repeat\(\s*'\s*\+\s*CONTRACT_KINDS\.length\s*\+\s*'\s*,\s*1fr\)'/,
    '열 수를 CONTRACT_KINDS.length 에서 뽑지 않습니다 — 숫자를 그대로 박으면' +
    ' 계약유형이 늘어나도 한 줄에 안 담깁니다.');
  assert.doesNotMatch(그리드줄, /gridTemplateColumns:\s*'1fr 1fr 1fr'/,
    '옛 3열×2줄 그리드가 그대로 남아 있습니다.');
});

test('칸 하나가 두 줄로 안 접히게 — 줄바꿈 없이 잘라 보인다', () => {
  const 자리 = MODAL.indexOf("h('label', null, '계약유형 (다중 선택 가능) *')");
  const 버튼자리 = MODAL.indexOf('toggleKind(k.v)', 자리);
  assert.ok(버튼자리 > 자리, '계약유형 단추를 못 찾았습니다.');
  const 버튼모양 = MODAL.slice(버튼자리, 버튼자리 + 700);

  /* ⚠ 칸이 여섯으로 좁아진 만큼, 「컨설팅계약」처럼 긴 이름이 둘째 줄로
     밀리면(=칸이 세로로 늘어나면) 옆 칸들과 높이가 안 맞아 줄이 들쭉날쭉해진다.
     한 줄로 자르는 장치(whiteSpace:nowrap)가 있는지를 본다. */
  assert.match(버튼모양, /whiteSpace:\s*'nowrap'/,
    '긴 이름(예: 컨설팅계약)이 줄바꿈되면 칸 높이가 서로 달라집니다.');
});
