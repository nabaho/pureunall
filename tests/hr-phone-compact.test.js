'use strict';
/* 인사관리 폰 화면 한 화면에 (2026-10-12 대표 「폰화면 … 가급적 한화면에서 보는거 가능하게 정리」 → 시안 → 「진행」)
   실행: node --test tests/hr-phone-compact.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { stripJs } = require('./strip-comments.js');
const SRC = stripJs(fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n'));

test('근로자명부 폰: 숫자 카드(두 줄 6칸)는 넓은 화면에만 · 폰은 숫자를 상태 칩에 얹어 한 줄 · 옛 카드(입사 … 줄)는 없다', () => {
  /* 2026-10-12 «숫자 칩 한 줄» → 2026-10-18 그 칩 줄과 상태 탭 줄을 «한 줄»로 합쳤다(같은 일을 두 줄에서 했다) */
  assert.match(SRC, /!_rM && h\('div', \{ className:'staff-kpi'/, '★ 폰에서 숫자 카드(staff-kpi)가 다시 그려집니다');
  const at = SRC.indexOf("{ v:'scheduled', label:'입사예정', n:scheduledCount");
  assert.ok(at > 0, '★ 폰 상태 칩에 숫자(n)가 안 얹혔습니다 — 숫자 줄을 따로 두면 두 줄이 됩니다');
  const row = SRC.slice(SRC.lastIndexOf("h('div', {", at), at);
  assert.match(row, /overflowX:'auto'/, '★ 칩 줄은 한 줄로 두고 넘치면 옆으로 밀어야 합니다');
  assert.doesNotMatch(SRC, /h\('span', null, u\.hireDate \? '입사 '\+u\.hireDate : ''\)/, '폰 카드의 «입사 …» 줄이 남았습니다');
});

test('휴가관리 폰: 한 열(표 위·상세 아래) · 위 막대 줄바꿈 · 줄을 누르면 상세로 내려간다', () => {
  assert.match(SRC, /var _lvM = window\.innerWidth <= 768;/);
  assert.match(SRC, /gridTemplateColumns:_lvM\?'minmax\(0,1fr\)':/);
  assert.match(SRC, /flexWrap:_lvM\?'wrap':'nowrap'/);
  assert.match(SRC, /getElementById\('lv-detail'\)/);
  assert.match(SRC, /h\('div',\{id:'lv-detail'\}/);
});

test('퇴직정산 폰: 한 사람 한 줄 · 넓은 화면은 표 그대로', () => {
  assert.match(SRC, /\(tab === 'balance' && window\.innerWidth <= 768\) && h\('div'/);
  assert.match(SRC, /\(tab === 'balance' && window\.innerWidth > 768\) && h\('div'/);
});

test('인사관리기준: «신규 등록» 안내가 한 글자씩 세로로 쌓이지 않는다', () => {
  assert.match(SRC, /whiteSpace:'nowrap', flexShrink:0 \}, title:'신규 직원은 근로자명부에서 등록하세요' \}/);
});
