'use strict';
/* 이관 시 빠지던 칸 넷 — 법인등록번호·대표자전화·본사주소·대표자2 (검증 2026-09-19)

   ■ 대표 지시
     「계약추가에 넣고 정리된 정보들은 사무관리에 옮겨져도 충돌이 생기면 안된다.
      이부분도 검증 한번 해라」

   ■ 실측 (2026-09-19)
     계약창 「기업정보」 탭 열일곱 칸 전부를 transferContract() 와 대조했다.
     ★ 법인등록번호(corpRegNo)·대표자전화(ceoPhone)·본사주소(addressDetail) 가
       업체·사건·컨설팅/기금/기타 다섯 갈래 «전부»에서 빠져 있었다 — 잘못 옮겨간 것이
       아니라 «아예 안 옮겨갔다»(누락이지 충돌은 아니다).
     ★ 대표자2(ceo2)는 사건·컨설팅/기금/기타엔 있는데 «업체 갈래에만» 빠져 있었다.
     ⚠ ceoPhone·addressDetail 은 옮길 «자리»(업체관리 CompanyEditModal)조차 없었다 —
       칸을 먼저 만들고 나서 이관 코드를 고쳤다(둘 다 해야 값이 안 사라진다).

   ■ 이 검사가 지키는 것
     ① 다섯 갈래 모두 corpRegNo·ceoPhone·addressDetail 을 들고 간다
     ② 업체 갈래도 ceo2 를 들고 간다 (나머지 넷과 같아진다)
     ③ 업체관리(CompanyEditModal)에 대표자전화·본사주소를 «사람이 볼» 칸이 있다
     ④ 「지난 계약 불러오기」(ERP_CO_FILL_KEYS)도 본사주소를 채운다 */

const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { cutFn } = require('./cut-fn');
const { stripJs } = require('./strip-comments');

const R = path.join(__dirname, '..');
const RAW = fs.readFileSync(path.join(R, 'pu-erp.html'), 'utf8');
const SRC = stripJs(RAW);
const 이관 = stripJs(cutFn(RAW, 'function transferContract('));

/* 갈래별로 잘라 본다 — 통째로 보면 «다른 갈래에 있는 줄»을 보고 이 갈래도
   있다고 착각한다(부가세 검사가 겪은 것과 같은 함정). */
function 업체갈래() {
  const from = 이관.indexOf("if(kindV === 'company')");
  const to = 이관.indexOf("if(kindV === 'case')", from);
  assert.ok(from > 0 && to > from, '업체 갈래를 못 찾았다');
  return 이관.slice(from, to);
}
function 사건갈래() {
  const from = 이관.indexOf("if(kindV === 'case')");
  const to = 이관.indexOf('var typeKeyMap', from);
  assert.ok(from > 0 && to > from, '사건 갈래를 못 찾았다');
  return 이관.slice(from, to);
}
function 공용갈래() {
  const from = 이관.indexOf('var typeKeyMap');
  assert.ok(from > 0, '컨설팅/기금/기타 공용 갈래를 못 찾았다');
  return 이관.slice(from);
}

test('①★ 업체 갈래 — corpRegNo·ceoPhone·addressDetail·ceo2 를 들고 간다', () => {
  const 업체 = 업체갈래();
  assert.match(업체, /corpRegNo:\s*co\.corpRegNo/, '★ 법인등록번호를 안 들고 간다');
  assert.match(업체, /ceoPhone:\s*co\.ceoPhone/, '★ 대표자 전화를 안 들고 간다');
  assert.match(업체, /addressDetail:\s*co\.addressDetail/, '★ 본사주소를 안 들고 간다');
  assert.match(업체, /ceo2:\s*co\.ceo2/,
    '★ 대표자2 를 안 들고 간다 — 사건·컨설팅 갈래엔 있는데 업체만 빠져 있었다');
});

test('②★ 사건 갈래 — corpRegNo·ceoPhone·addressDetail 을 들고 간다', () => {
  const 사건 = 사건갈래();
  assert.match(사건, /corpRegNo:\s*caseCo\.corpRegNo/, '★ 법인등록번호를 안 들고 간다');
  assert.match(사건, /ceoPhone:\s*caseCo\.ceoPhone/, '★ 대표자 전화를 안 들고 간다');
  assert.match(사건, /addressDetail:\s*caseCo\.addressDetail/, '★ 본사주소를 안 들고 간다');
});

test('③★ 컨설팅·기금·기타 공용 갈래 — corpRegNo·ceoPhone·addressDetail 을 들고 간다', () => {
  const 공용 = 공용갈래();
  assert.match(공용, /corpRegNo:\s*co2\.corpRegNo/, '★ 법인등록번호를 안 들고 간다');
  assert.match(공용, /ceoPhone:\s*co2\.ceoPhone/, '★ 대표자 전화를 안 들고 간다');
  assert.match(공용, /addressDetail:\s*co2\.addressDetail/, '★ 본사주소를 안 들고 간다');
});

test('④★ 업체관리에 «사람이 볼» 대표자전화·본사주소 칸이 있다 — 옮겨도 숨은 값이면 못 고친다', () => {
  const MODAL = stripJs(cutFn(RAW, 'function CompanyEditModal(props)'));
  assert.match(MODAL, /fld4\('대표자 전화'/, '업체관리에 대표자 전화 입력칸이 없다');
  assert.match(MODAL, /value:f\.ceoPhone \|\| ''.*onChange:set\('ceoPhone'\)/,
    '대표자 전화 칸이 ceoPhone 에 이어져 있지 않다');
  assert.match(MODAL, /fld4\('본사주소'/, '업체관리에 본사주소 입력칸이 없다');
  assert.match(MODAL, /value:f\.addressDetail \|\| ''.*onChange:set\('addressDetail'\)/,
    '본사주소 칸이 addressDetail 에 이어져 있지 않다');
});

test('⑤ 「지난 계약 불러오기」도 본사주소를 채운다', () => {
  assert.match(SRC, /ERP_CO_FILL_KEYS = \[[^\]]*'addressDetail'/,
    'ERP_CO_FILL_KEYS 에 addressDetail 이 없다 — 새 계약에서 옛 회사를 골라도 본사주소가 안 온다');
  const fn = stripJs(cutFn(RAW, 'function _coFieldsOf(r)'));
  assert.match(fn, /addressDetail:\s*co\.addressDetail/,
    '_coFieldsOf 가 본사주소를 안 읽는다');
});
