'use strict';
/* 계약관리 › 종류별 세부설정 아래 — CMS 자동이체·개인입금이 세로로 두 줄이던 것
   (대표 지시 2026-09-21 「이부분도 한줄로 만들어줘」, 캡쳐: CMS 자동이체 줄
   아래에 개인입금 줄이 따로 떨어져 있던 화면)

   ★ cmsBlock() 이 personalDepositBlock() 을 «부르는 자리»는 그대로 둔다 —
   tests/personal-deposit.test.js 가 그 정확한 모양(마지막에 이어 부른다)을
   이미 못 박고 있다. 여기서 새로 못 박는 것은 «둘이 같은 flex 줄에 나란히
   놓였는가»이지, 안쪽 체크박스·안내 문구 같은 «지금 값»이 아니다. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { cutFn } = require('./cut-fn');
const { stripJs } = require('./strip-comments');

const RAW = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8');
const CMSFN = stripJs(cutFn(RAW, 'function cmsBlock()'));
const PDFN = stripJs(cutFn(RAW, 'function personalDepositBlock()'));

test('cmsBlock() 바깥 상자가 flex 줄이다 — CMS·개인입금이 나란히 놓일 자리', () => {
  const outerAt = CMSFN.indexOf("return h('div',");
  assert.ok(outerAt > 0, 'cmsBlock 의 바깥 div 를 못 찾았다.');
  const 바깥스타일 = CMSFN.slice(outerAt, outerAt + 160);
  assert.match(바깥스타일, /display:\s*'flex'/, '바깥 상자가 flex 가 아니다 — 한 줄로 안 나란해진다.');
  assert.match(바깥스타일, /flexWrap:\s*'wrap'/, '줄바꿈 장치(flexWrap)가 없다 — 좁아지면 겹친다.');
});

test('personalDepositBlock() 이 flex 짝(자기 폭만 차지)이지, 늘 새 줄(marginTop 블록)이 아니다', () => {
  const outerAt = PDFN.indexOf("return h('div',");
  assert.ok(outerAt > 0, 'personalDepositBlock 의 바깥 div 를 못 찾았다.');
  const 바깥스타일 = PDFN.slice(outerAt, outerAt + 100);
  assert.match(바깥스타일, /flex:\s*'1 1 \d+px'/,
    '개인입금 바깥 div 에 flex 기본값이 없다 — CMS 옆줄에 못 낀다.');
});

test('cmsBlock() 은 여전히 personalDepositBlock() 을 부른다 — 함수만 만들고 안 이어붙이는 실수 방지', () => {
  assert.match(CMSFN, /personalDepositBlock\(\)/,
    'cmsBlock 안에서 personalDepositBlock() 을 더는 안 부른다 — 화면에서 사라진다.');
});
