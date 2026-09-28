'use strict';
/* 계약관리 › 계약 추가 › 계약정보 — 「종류별 세부설정」 금액·부가세포함을 줄
   맨 끝(오른쪽)으로, 계약서 찾기·원본·판독 보기를 한 줄로
   (대표 지시 2026-09-21 「금액넣는것 둘다 오른쪽 끝으로 보내고 부가세 포함표시도
   그쪽으로 보내고 다시 정리한번해라」 「계약서 3건발견과 아래 원본판독보기 같은 줄로
   넣어라」, 목업 승인 옵션A — https://claude.ai/artifact/Kr1jnf4guw7rBEsxdi83DD)

   ★ 못 박는 것은 «차례»(유형선택·업무요약이 먼저, 금액+부가세포함이 나중=오른쪽)
   와 «오른쪽 끝으로 미는 장치» 가 있는가이다. 색·글꼴 같은 «지금 값»은 아니다.
   ★ 2026-09-28 부터 그 장치는 칸마다 붙인 marginLeft:auto 가 아니라 «오른쪽 끝 묶음»
     (kEnd → .pu-kend{margin-left:auto}) 이다 — 대표 「모두 오른쪽끝으로 … 형태를 일치시켜라」.
     칸마다 따로 밀면 좁은 줄에서 금액만 다음 줄 왼쪽으로 떨어졌다(사건계약 성공보수). */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { cutFn } = require('./cut-fn');
const { stripJs } = require('./strip-comments');

const RAW = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8');
const MODAL = stripJs(cutFn(RAW, 'function ContractModal(props)'));
const CSS = fs.readFileSync(path.join(__dirname, '..', 'css', 'pu-erp.css'), 'utf8');
/* 금액칸 바로 앞(같은 묶음 안)에 kEnd( 가 열려 있는가 — 사이에 다른 줄(pu-krow)이 끼면 안 된다 */
function 묶음안(idx, why) {
  const 앞 = MODAL.slice(Math.max(0, idx - 1200), idx);
  const k = 앞.lastIndexOf('kEnd(');
  assert.ok(k >= 0, why + ' — 오른쪽 끝 묶음(kEnd) 안에 없습니다. 줄 끝까지 안 밀립니다.');
  assert.doesNotMatch(앞.slice(k), /className:'pu-krow'/, why + ' — 묶음과 금액 사이에 다른 줄이 끼었습니다.');
}
test('오른쪽 끝 묶음(.pu-kend)이 실제로 줄 끝으로 민다(margin-left:auto) · 줄바꿈 없이 붙어 다닌다', () => {
  const m = CSS.match(/\.pu-kend\s*\{([^}]*)\}/);
  assert.ok(m, '.pu-kend 규칙이 없습니다');
  assert.match(m[1], /margin-left:\s*auto/, '묶음이 오른쪽 끝으로 안 밀립니다');
  assert.match(m[1], /white-space:\s*nowrap|flex:\s*none/, '묶음이 쪼개져 금액만 따로 떨어질 수 있습니다');
});

test('계약금/착수금 줄 — 유형선택·업무요약이 먼저, 금액(오른쪽 끝)이 나중', () => {
  const briefIdx = MODAL.indexOf('briefInput(kindV),');
  const amtIdx = MODAL.indexOf("placeholder: isConsulting ? '계약금' : '착수금'");
  assert.ok(briefIdx > 0 && amtIdx > 0, '계약금 줄의 briefInput·금액칸을 못 찾았습니다.');
  assert.ok(briefIdx < amtIdx, '업무요약이 금액보다 뒤에 있습니다 — 금액이 오른쪽 끝으로 안 갔습니다.');

  묶음안(amtIdx, '계약금 칸');
});

test('잔금 줄(컨설팅 일수 행) — 금액이 오른쪽 끝 묶음 안에 있다', () => {
  const idx = MODAL.indexOf("placeholder:'잔금'");
  assert.ok(idx > 0, '잔금 칸을 못 찾았습니다.');
  묶음안(idx, '잔금 칸');
});

test('성공보수(사건·기타) — 제 줄에서 원/%·금액·부가세포함이 오른쪽 끝 묶음 안에 있다', () => {
  const idx = MODAL.indexOf("placeholder:'성공보수'");
  assert.ok(idx > 0, '성공보수 칸을 못 찾았습니다.');
  묶음안(idx, '성공보수 칸');
});

test('기금·업체·상담 줄 — 업무요약이 먼저, 금액(오른쪽 끝)이 나중', () => {
  const briefIdx = MODAL.lastIndexOf('briefInput(kindV)');
  const amtIdx = MODAL.indexOf("placeholder:'금액'");
  assert.ok(briefIdx > 0 && amtIdx > 0, '기금 등 줄의 briefInput·금액칸을 못 찾았습니다.');
  assert.ok(briefIdx < amtIdx, '업무요약이 금액보다 뒤에 있습니다.');

  묶음안(amtIdx, '금액 칸');
});

test('📷 계약서 찾기 단추가 아래 「원본·판독 보기」와 같은 한 줄(div) 안에 있다', () => {
  const findIdx = MODAL.indexOf("'건 발견' : '📷 계약서 찾기')");
  const docIdx = MODAL.indexOf("'원본·판독 보기')");
  assert.ok(findIdx > 0 && docIdx > findIdx, '찾기 단추·원본판독 단추를 못 찾았습니다.');

  const 사이 = MODAL.slice(findIdx, docIdx);
  // 둘 사이에 kbox/krow 가 새로 열리거나(다른 칸 종류로 넘어가거나) cmsBlock() 호출이
  // 끼어 있으면 같은 한 줄이 아니라 다른 구역이다.
  assert.doesNotMatch(사이, /cmsBlock\(\)/,
    '찾기 단추와 원본판독 사이에 cmsBlock() 이 있습니다 — 같은 줄이 아닙니다.');
  assert.ok(사이.length < 1200,
    '찾기 단추와 원본판독 사이 글자가 너무 많습니다 — 다른 구역일 수 있습니다(' + 사이.length + '자).');
});

test('예전처럼 찾기 단추만 따로 감싸던 자리(marginBottom:8px 단독 줄)는 더는 없다', () => {
  assert.doesNotMatch(MODAL, /style:\{\s*marginBottom:'8px'\s*\}\s*\}\s*,\s*h\('button'/,
    '찾기 단추가 다시 단독 줄로 돌아갔습니다.');
});
