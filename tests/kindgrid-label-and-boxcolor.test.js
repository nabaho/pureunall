'use strict';
/* 계약관리 › 계약정보 — 계약유형 라벨을 버튼 위 한 줄로, 세부설정 박스 테두리를
   그 종류 버튼과 같은 색으로 (대표 지시 2026-09-21 「캡쳐1 글자를 캡쳐2 셀위에
   올려라 … 각 셀의 박스 외각에 계약유형 셀의 테두리색과 같이 색을 넣어주는건
   어떤가」, 목업 승인 https://claude.ai/artifact/SZJcwEdUoUS8HGfp3tSUQy → 「진행」)

   ★ 못 박는 것: ①라벨이 옆칸(.fld 의 110px+1fr 나란히 규칙)이 아니라 한 줄
   통째로 놓였는가, ②세부설정 박스가 종류마다 다른 색 테두리를 쓰는가(공용
   kboxColorStyle 을 거치는가) — 정확한 px·hex 값 같은 «지금 값»이 아니다. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { cutFn } = require('./cut-fn');
const { stripJs } = require('./strip-comments');

const RAW = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8');
const MODAL = stripJs(cutFn(RAW, 'function ContractModal(props)'));

test('계약유형 라벨이 «옆칸 나란히»(.fld 2칸 규칙)가 아니라 한 줄 통째로 놓였다', () => {
  const at = MODAL.indexOf("'계약유형 (다중 선택 가능) *'");
  assert.ok(at > 0, '계약유형 라벨을 못 찾았습니다.');
  const 바깥div자리 = MODAL.lastIndexOf("className:'fld'", at);
  assert.ok(바깥div자리 > 0, '.fld 바깥 div 를 못 찾았습니다.');
  // ★ 바깥 div 자체의 style(«className:'fld'» 바로 뒤)만 본다 — 라벨 자신의
  //   style(display:block) 을 잘못 잡지 않도록 창을 짧게 자른다.
  const 바깥스타일 = MODAL.slice(바깥div자리, 바깥div자리 + 60);
  assert.match(바깥스타일, /className:'fld',\s*style:\{\s*display:\s*'block'\s*\}/,
    '.fld 바깥 div 가 옆칸 나란히(grid 110px+1fr) 규칙을 그대로 씁니다 — 라벨이 좁은 칸에서 줄바뀝니다.');
});

test('세부설정 박스(컨설팅·사건·기타 갈래)가 종류별 색 테두리(kboxColorStyle)를 쓴다', () => {
  const at = MODAL.indexOf('if(isConsulting || isCase || isOther){');
  assert.ok(at > 0, '컨설팅·사건·기타 갈래를 못 찾았습니다.');
  const 둘레 = MODAL.slice(at, at + 200);
  assert.match(둘레, /className:'pu-kbox',\s*style:\s*kboxColorStyle\(k\.color\)/,
    '이 갈래의 pu-kbox 가 kboxColorStyle(k.color) 를 안 씁니다.');
});

test('세부설정 박스(기금·업체·상담 갈래)도 같은 색 테두리 장치를 쓴다', () => {
  const consultAt = MODAL.indexOf('if(isConsulting || isCase || isOther){');
  const at = MODAL.indexOf("h('div', { key:kindV, className:'pu-kbox'", consultAt + 200);
  assert.ok(at > 0, '기금·업체·상담 갈래를 못 찾았습니다.');
  const 둘레 = MODAL.slice(at, at + 300);
  assert.match(둘레, /className:'pu-kbox',\s*style:\s*kboxColorStyle\(k\.color\)/,
    '이 갈래의 pu-kbox 가 kboxColorStyle(k.color) 를 안 씁니다 — 두 갈래가 따로 만들어져 하나만 고쳐지기 쉽습니다.');
});

test('kboxColorStyle 은 왼쪽 굵은 띠 + 옅은 나머지 테두리를 만든다 — 있다/없다가 아니라 «색이 실제로 먹는가»', () => {
  const RAWFULL = RAW;
  const fnAt = RAWFULL.indexOf('function kboxColorStyle(hex)');
  assert.ok(fnAt > 0, 'kboxColorStyle 함수를 못 찾았습니다.');
  const fn = stripJs(RAWFULL.slice(fnAt, RAWFULL.indexOf('\n}', fnAt) + 2));
  assert.match(fn, /borderLeft:\s*'4px solid '\s*\+\s*hex/, '왼쪽 굵은 띠가 hex 값을 안 씁니다.');
  assert.match(fn, /border(Top|Right|Bottom):\s*'1px solid '\s*\+\s*hex/, '나머지 테두리도 hex 를 써야 «그 색» 임을 압니다.');
});
