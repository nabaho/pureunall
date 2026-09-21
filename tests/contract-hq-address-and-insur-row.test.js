'use strict';
/* 계약관리 › 계약 추가 › 기업정보 — 두 가지 대표 지시 (2026-09-21)

   ① 「본사주소도 같은 형태로해라 셀 검색 셀로」
      2026-09-19 에 이미 [입력+검색] 두 칸으로 만들었는데, 사업장주소처럼
      [우편번호+검색+주소] «세 칸»을 말씀하신 것이었다.
      ⚠ 새 데이터 칸(headZipcode 등)은 여전히 안 만든다 — addressDetail 문자열
        하나에서 우편번호만 잘라 «보여주는 칸»만 둘로 나눈다(transferContract()
        이관을 다시 손대지 않기 위해, 2026-09-19 결정 그대로).

   ② 「업종규모 4대보험 가입자수 한줄로 만들어라」
      업태·종목·규모(3칸)와 4대보험 가입자수(고용·산재, 2칸)가 서로 다른 그리드에
      갈라져 있었다 — 예전엔 4대보험 칸이 「근로자 단독 의뢰에서도 보이게」 showCompany
      «밖»에 있었는데, showCompany 는 이미 늘 true 라(근로자 단독이어도 상대 회사
      입력이 필요해서) 실제로는 늘 함께 그려지고 있었다. 그래서 한 줄로 합친다.

   ■ 여기서 보는 것 — «값»이 아니라 «모양»이다
   ⚠ stripComments 를 안 쓴다 — 세 번째 검사가 «옛 설명 주석이 실제로 없어졌는가»를
     직접 보려는 것이라, 주석을 걷으면 그 검사 자체가 늘(있어도 없어도) 통과해
     헛돈다. 나머지 두 검사도 이모지·변수명으로 유일한 자리를 짚으므로 원본
     그대로 봐도 안전하다. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const RAW = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8');

/* cutFn(있는 도구)은 decl 에 여는 중괄호가 없어야 한다 — 이건 이름 없는
   (function(){ 라 «표시 하나» 뒤를 거꾸로 찾아 그 앞의 (function() 을 잡는다. */
function cutIife(src, uniqueMarker, declBeforeMarker) {
  const markerIdx = src.indexOf(uniqueMarker);
  if (markerIdx < 0) throw new Error('표시를 못 찾음: ' + uniqueMarker);
  const head = src.lastIndexOf(declBeforeMarker, markerIdx);
  if (head < 0) throw new Error('표시 앞에서 「' + declBeforeMarker + '」 를 못 찾음');
  let i = src.indexOf('{', head + declBeforeMarker.length);
  if (i < 0) throw new Error('여는 중괄호를 못 찾음');
  let d = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') d++;
    else if (src[i] === '}') { d--; if (!d) return src.slice(head, i + 1); }
  }
  throw new Error('닫는 중괄호를 못 찾음');
}

test('본사주소 — 우편번호 칸이 실제로 생겼다(사업장주소와 같은 3칸)', () => {
  const 본사블록 = cutIife(RAW, "var _hm = /^\\((\\d{3,7})\\)", '(function()');

  // ① 우편번호 칸이 실제로 있다 — placeholder·maxLength·너비까지 사업장주소와 같은 값인지 본다.
  assert.match(본사블록, /placeholder:\s*'우편번호'/, '우편번호 칸 자체가 없습니다 — 아직 2칸([입력+검색])입니다.');
  assert.match(본사블록, /maxLength:\s*7/, '우편번호 칸의 글자수 제한이 사업장주소와 다릅니다.');
  assert.match(본사블록, /width:\s*'90px'/, '우편번호 칸 너비가 사업장주소(90px)와 다릅니다.');

  // ② 셋 다 «한 줄»(pu-n6 pu-n6-6)에 있다 — 줄을 갈라놓지 않았다.
  assert.match(본사블록, /pu-n6 pu-n6-6/, '한 줄(pu-n6-6) 밖으로 빠졌습니다.');

  // ③ 검색·입력 모두 여전히 «한 문자열»(addressDetail)로 저장된다 — 새 칸을 안 만든다.
  assert.match(본사블록, /setCompanyField\('addressDetail'\)/, 'addressDetail 이 아닌 새 칸에 쓰고 있습니다 — transferContract() 이관을 다시 손대야 합니다.');
  assert.doesNotMatch(본사블록, /headZipcode/, '새 칸(headZipcode)을 만들었습니다 — 2026-09-19 결정과 어긋납니다.');

  // ④ 우편번호를 손으로 지워도 주소가 안 날아간다 — 두 칸이 «같은 문자열»의 앞뒤를 나눠 쓴다.
  assert.match(본사블록, /combineHead\(e\.target\.value,\s*_headAddr\)/, '우편번호만 바꿔도 주소가 사라질 수 있습니다(주소를 안 지키고 씁니다).');
  assert.match(본사블록, /combineHead\(_headZip,\s*e\.target\.value\)/, '주소만 바꿔도 우편번호가 사라질 수 있습니다(우편번호를 안 지키고 씁니다).');
});

test('업종·규모 옆에 4대보험 가입자수 두 칸이 «같은 줄»로 붙었다', () => {
  const 시작 = RAW.indexOf("sec6('🏭 업종 · 규모 · 4대보험 가입자수'");
  assert.ok(시작 > 0, '합쳐진 제목(🏭 업종 · 규모 · 4대보험 가입자수)을 못 찾았습니다 — 한 줄로 합치지 않았습니다.');
  const 끝 = RAW.indexOf('🔗 업체 연결', 시작);
  assert.ok(끝 > 시작, '뒤이은 자리(🔗 업체 연결)를 못 찾았습니다.');
  const 한줄 = RAW.slice(시작, 끝);

  ['bizType', 'bizCategory', 'companySize', 'employmentInsuredCount', 'injuryInsuredCount'].forEach((필드) => {
    assert.match(한줄, new RegExp(필드), '「' + 필드 + '」 칸이 같은 줄 안에 없습니다.');
  });

  // 다섯 칸이 «중간에 다른 그리드로 안 끊기고» 나온다 — 사이에 새 div 를 열면 줄이 갈라진다.
  const 열린div수 = (한줄.match(/h\('div',\s*\{\s*className:\s*'pu-g6'/g) || []).length;
  assert.equal(열린div수, 0, '중간에 별도 pu-g6 그리드를 다시 열었습니다 — 줄이 갈라집니다.');
});

test('4대보험 가입자수를 «따로» 그리는 옛 자리가 더는 없다', () => {
  assert.doesNotMatch(RAW, /이 상자는 showCompany.{0,3}밖.{0,3}에 있다/,
    '4대보험을 따로 그리던 옛 그리드 주석이 아직 남아 있습니다 — 실제로 합쳤는지 다시 보십시오.');
  // sec6('👥 4대보험 가입자수') «단독» 호출(둘째 인자 없이 혼자)은 이제 없어야 한다.
  assert.doesNotMatch(RAW, /sec6\('👥 4대보험 가입자수'\)/,
    '4대보험만 담은 독립된 sec6 호출이 아직 있습니다 — 여전히 갈라져 있다는 뜻입니다.');
});
