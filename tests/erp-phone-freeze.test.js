'use strict';
/* 이알피 폰 — 틀 고정 · 요약 접기 · 옆으로 밀지 않기 (대표 지시 2026-10-23)
   「급여 등 이 창을 좌우로 움직여야 되는데 … 폰에서는 드롭다운 방식으로」
   「상단은 아래 위에 높이가 너무 많이 차지」
   「ERP 에서 폰에서 관리하는 모든 부분, 데이터가 들어가는데 틀 고정이 필요한 모든 부분 틀 고정」

   ★ 못 박는 것 — 규칙
     ① 자료를 넣고 정리하는 폰 목록(업체·계약·사건·컨설팅/기금/기타)의 검색·거르개 줄은 «붙어 있다»(.pu-mfreeze)
     ② 그 표시를 받는 폰 CSS 가 있고, 바탕이 칠해져 있다(투명하면 밑 카드가 비친다)
     ③ 폰 요약 숫자는 «한 줄로 접힌다» — 펼침은 이 기기에 기억한다
     ④ 업체관리 폰 거르개는 옆으로 밀지 않는다 — 상태·유형은 고르기 상자 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { cutFn } = require('./cut-fn');
const { stripJs, stripComments } = require('./strip-comments');

const root = path.join(__dirname, '..');
const RAW = fs.readFileSync(path.join(root, 'pu-erp.html'), 'utf8');
const CSS = stripComments(fs.readFileSync(path.join(root, 'css', 'pu-erp.css'), 'utf8'));

const PAGES = [
  ['업체관리', 'function CompanyManagement('],
  ['사건관리', 'function CaseManagement('],
  ['컨설팅·기금·기타', 'function ProjectManagementShared('],
];

test('①★★ 폰 목록의 검색·거르개 줄은 틀 고정이다', () => {
  PAGES.forEach(([name, decl]) => {
    const fn = stripJs(cutFn(RAW, decl));
    const at = fn.indexOf('pu-mfreeze');
    assert.ok(at > 0, '★ ' + name + ' 폰 도구줄이 고정이 아닙니다 — 목록을 내리면 검색·거르개가 사라집니다');
    assert.ok(fn.lastIndexOf('innerWidth <= 768', at) > 0, name + ' — 고정 표시가 폰 갈래 밖에 있습니다');
  });
  /* 계약관리는 한 덩이가 PC·폰을 같이 쓴다 — 폰에서도 sticky 여야 한다 */
  const ct = stripJs(cutFn(RAW, 'function ContractManagement('));
  const at = ct.indexOf("'pu-mfreeze'");
  assert.ok(at > 0, '★ 계약관리 폰 도구줄이 고정이 아닙니다');
  const box = ct.slice(at, at + 300);
  assert.doesNotMatch(box, /position:\s*window\.innerWidth\s*<=\s*768\s*\?\s*'static'/, '★ 계약관리가 폰에서만 static 으로 돌아갔습니다');
});

test('②★ .pu-mfreeze 폰 규칙 — 붙고, 바탕이 있다', () => {
  const phone = CSS.slice(CSS.search(/@media\s*\(max-width:\s*768px\)/));
  const at = phone.indexOf('.pu-mfreeze{');
  assert.ok(at >= 0, '★ 폰 CSS 에 .pu-mfreeze 가 없습니다');
  const r = phone.slice(at, phone.indexOf('}', at));
  assert.match(r, /position:\s*sticky/, '붙지 않습니다');
  assert.match(r, /top:\s*0/, '붙는 자리가 없습니다');
  assert.match(r, /background:\s*#[0-9a-f]{3,6}/i, '★ 바탕이 투명하면 밑 카드가 비쳐 글자가 겹칩니다');
});

test('③★ 폰 요약 숫자는 한 줄로 접히고, 펼침은 기억한다', () => {
  const fn = stripJs(cutFn(RAW, 'function MonthKpiHeader('));
  assert.match(fn, /winW\s*<=\s*768/, '폰을 따로 안 봅니다');
  assert.match(fn, /localStorage\.getItem\('[^']+'\)/, '펼침을 기억하지 않습니다 — 열 때마다 접힙니다');
  assert.match(fn, /className:'mkpi-sum'/, '접힌 한 줄이 없습니다');
  const sum = fn.slice(fn.indexOf("className:'mkpi-sum'"));
  assert.match(sum.slice(0, 900), /whiteSpace:'nowrap'[\s\S]{0,80}textOverflow:'ellipsis'/, '★ 접힌 줄이 두 줄로 꺾입니다');
  assert.match(fn, /'▴ 요약 접기'/, '펼친 뒤 다시 접을 길이 없습니다');
});

test('④★ 업체관리 폰 거르개는 옆으로 밀지 않는다 — 상태·유형은 고르기 상자', () => {
  const fn = stripJs(cutFn(RAW, 'function CompanyManagement('));
  const from = fn.indexOf('pu-mfreeze');
  /* 폰 갈래 끝 = PC 도구줄의 검색칸 (PC 는 칩을 그대로 쓴다) */
  const to = fn.indexOf("placeholder:'🔍 업체명·번호·대표·주소·메모'", from);
  assert.ok(to > from, '폰 갈래의 끝을 못 찾았습니다');
  const bar = fn.slice(from, to);
  assert.doesNotMatch(bar, /overflowX:'auto'/, '★ 폰 거르개를 다시 옆으로 밀게 했습니다');
  assert.match(bar, /h\('select', \{ value:statusTab/, '상태 고르기 상자가 없습니다');
  assert.match(bar, /typeSelect\(\)/, '유형 고르기 상자가 없습니다');
  assert.doesNotMatch(bar, /typeChips\(\)/, '★ 폰에 옆으로 미는 유형 칩이 돌아왔습니다');
});
