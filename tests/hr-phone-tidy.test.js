'use strict';
/* 인사관리 폰 화면 정리 (2026-10-25 대표 「폰에서 UI 너무 이상하다 … 좌우로 너무 많이 나가고 아래위로도 너무 길게」→ 시안 → 「시안대로」)
   «지금 값»이 아니라 «규칙»을 본다 — 입력칸은 상자 안에 · 폰 격자는 전체 규칙에 안 접히는 꼴 · 접이 · 인사관리만 줄바꿈
   실행: node --test tests/hr-phone-tidy.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { stripJs } = require('./strip-comments.js');

const RAW = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');
const SRC = stripJs(RAW);
const CSS = fs.readFileSync(path.join(__dirname, '..', 'css', 'pu-erp.css'), 'utf8').replace(/\r\n/g, '\n');
function fnSrc(name){
  const i = SRC.indexOf('\nfunction ' + name + '(');
  assert.ok(i >= 0, name + ' 함수를 못 찾았습니다');
  const j = SRC.indexOf('\nfunction ', i + 10);
  return SRC.slice(i + 1, j < 0 ? undefined : j);
}
const PAY = fnSrc('PayrollPayslip');

test('급여 입력칸 — 칸을 묶는 상자는 비어 있지 않다(열자마자 닫혀 칸이 한 줄씩 쌓이던 것)', () => {
  /* 상자 줄이 «}}),» 로 끝나고 바로 뒤가 label 이면 상자가 비어 있는 것이다 */
  const bad = PAY.match(/gridTemplateColumns:[^\n]*\}\}\),\n\s*h\('label'/g);
  assert.equal(bad, null, '★ 빈 격자 상자가 남았습니다 — 입력칸이 상자 밖에 흩어집니다');
  assert.match(PAY, /gridTemplateColumns:_mob\?'minmax\(0,1fr\) minmax\(0,1fr\)':'1fr 1fr 1fr',[^\n]*\},\n\s*h\('label', null,\n\s*h\('div',\{style:labelStyle\},'부양가족 수'\)/);
});

test('폰 격자는 css/pu-erp.css 의 «1fr 1fr · repeat(2/3/4 → 한 칸» 규칙에 안 걸리는 꼴(minmax)로 쓴다', () => {
  assert.match(CSS, /\.page \[style\*="repeat\(2"\]/, '이 검사는 전체 규칙이 있다는 전제 — 규칙이 사라지면 이 검사도 손봐야 합니다');
  assert.doesNotMatch(PAY, /_mob\?'repeat\(/, '폰용 격자에 repeat( 를 쓰면 한 줄로 접힙니다');
  assert.doesNotMatch(PAY, /_mob\?'1fr 1fr'/, "폰용 격자에 '1fr 1fr' 를 쓰면 한 줄로 접힙니다");
  const mgr = fnSrc('PayrollManagement');
  assert.match(mgr, /window\.innerWidth<=768\n\s*\? \{ display:'grid', gridTemplateColumns:'minmax\(0,1fr\) minmax\(0,1fr\)'/, '급여 탭 줄은 폰에서 2칸 격자');
});

test('급여명세서 폰 — 입력·근거·추이는 접이(키가 달·직원), 넓은 화면은 늘 펼침', () => {
  assert.match(PAY, /var _foldKey = u\.sid \+ '\|' \+ props\.selYM;/);
  ['inOpen', 'basisOpen', 'trendOpen'].forEach(k => assert.match(PAY, new RegExp('var ' + k + ' = !_mob \\|\\| ')));
  assert.match(PAY, /display: inOpen \? 'block' : 'none'/);
  assert.match(PAY, /display: basisOpen \? 'grid' : 'none'/);
  assert.match(PAY, /display: trendOpen \? 'block' : 'none'/);
});

test('급여명세서 폰 — 카드 안쪽 여백을 줄이고, 입력 다음에 명세서·그 뒤에 추이(order)', () => {
  assert.match(PAY, /padding:_mob\?'12px':'30px'/);
  assert.match(PAY, /_mob \? \{display:'contents'\} : \{order:2\}/);
  assert.match(PAY, /order:_mob\?3:undefined/);
});

test('인사관리 폰 — 칩·탭·단추 줄은 옆으로 밀지 않고 줄바꿈 · 인사관리 메뉴에서만(재무는 그대로)', () => {
  assert.match(SRC, /document\.body\.setAttribute\('data-erp-group', String\(current \|\| ''\)\.split\('\/'\)\[0\]\)/);
  const at = CSS.indexOf('body[data-erp-group="hr"] main [style*="overflow-x: auto"]');
  assert.ok(at > 0, '인사관리 줄바꿈 규칙이 있어야 한다');
  const rule = CSS.slice(at, CSS.indexOf('}', at) + 1);
  assert.match(rule, /flex-wrap:wrap !important/);
  assert.doesNotMatch(CSS.slice(at - 400, at + 400), /data-erp-group="fin"/, '재무에는 손대지 않는다');
  const media = CSS.lastIndexOf('@media', at);
  assert.match(CSS.slice(media, at), /max-width:768px/, '폰에서만');
});
