// 거래내역 화면 정리 (대표 「시안대로」 2026-10-24) — 「버튼이 너무 많다 · 좌우화면이 넘친다」
// 규칙: ① 넓은 화면의 묶음 메뉴는 «원래 단추의 복사본» — 같은 동작을 부르고, 폰에서는 원래 단추가 그대로 산다
//       ② 숨기는 규칙은 서로 반대 폭에만 걸린다(둘이 같은 폭에서 겹치면 단추가 둘 다 사라진다)
//       ③ 표는 칸 너비를 지키고(table-layout:fixed) «처리» 칸이 오른쪽에 붙박이다
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { stripComments } = require('./strip-comments');

const SRC = stripComments(fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n'));
const CSS = fs.readFileSync(path.join(__dirname, '..', 'css', 'pu-erp.css'), 'utf8').replace(/\r\n/g, '\n');
const LEDGER = SRC.slice(SRC.indexOf('function FinanceLedger('));

function mediaBody(css, head){
  const i = css.indexOf(head);
  assert.ok(i >= 0, head + ' 블록이 없습니다');
  let d = 0, j = css.indexOf('{', i);
  for(let k = j; k < css.length; k++){ if(css[k] === '{') d++; else if(css[k] === '}'){ d--; if(!d) return css.slice(j + 1, k); } }
}
const TIDY = CSS.slice(CSS.lastIndexOf('/*', CSS.indexOf('거래내역 정리 (대표'))).replace(/\/\*[\s\S]*?\*\//g, '');   // 주석은 뺀다 — 주석이 규칙 이름을 말해도 검사에 안 걸리게

test('① ★ 묶음 메뉴 안 항목이 원래 단추와 «같은 동작»을 부른다 — 메뉴만 있고 일은 안 하는 단추가 되면 안 된다', () => {
  const auto = LEDGER.slice(LEDGER.indexOf("wideMenu('auto'"), LEDGER.indexOf("wideMenu('auto'") + 2600);
  assert.match(auto, /runAutoMatch\)/, '★ 자동 매칭이 메뉴에서 안 불립니다');
  assert.match(auto, /setLdStF\(ldStF==='auto'/, '★ 저절로 확정 후보 보기가 메뉴에서 안 불립니다');
  assert.match(auto, /setAutoTidyOn\(!autoTidyOn\)/, '★ 저절로 확정 스위치가 메뉴에 없습니다');
  assert.match(auto, /setAutoInvOn\(!autoInvOn\)/, '★ 계산서 일치 스위치가 메뉴에 없습니다');
  assert.match(auto, /_meNow\(\)\.isAdmin && wideSwitch\('at'/, '★★ 스위치가 관리자 아닌 사람에게도 보입니다');
  assert.match(auto, /_meNow\(\)\.isAdmin && wideSwitch\('ai'/, '★★ 계산서 스위치가 관리자 아닌 사람에게도 보입니다');
  const more = LEDGER.slice(LEDGER.indexOf("wideMenu('more'"), LEDGER.indexOf("wideMenu('more'") + 1600);
  assert.match(more, /setHeldOpen\(true\)/, '★ 보류함이 메뉴에 없습니다');
  assert.match(more, /setLdQ\(/, '★ 찾기가 메뉴에 없습니다');
  assert.match(more, /setConfHistOpen\(true\)/, '★★ 확정 이력이 메뉴에 없습니다 — 되돌릴 길이 사라집니다');
});

test('② ★ 원래 단추는 «넓은 화면에서만» 감춘다 — 폰에서는 그대로 산다', () => {
  assert.match(LEDGER, /className:'ld-bar-auto ld-narrow-only',\s*onClick:runAutoMatch/, '자동 매칭 원본에 표시가 없습니다');
  assert.match(LEDGER, /key:'autoc',className:'ld-narrow-only'/, '저절로 확정 후보 원본에 표시가 없습니다');
  assert.match(LEDGER, /key:'autot',className:'ld-bar-auto ld-narrow-only'/);
  assert.match(LEDGER, /key:'autoinv',className:'ld-bar-auto ld-narrow-only'/);
  assert.match(LEDGER, /className:'ld-more-item ld-narrow-only',onClick:function\(\)\{setHeldOpen\(true\)/);
  assert.match(LEDGER, /className:'ld-more-item ld-narrow-only',onClick:function\(\)\{setConfHistOpen\(true\)/);
  assert.match(LEDGER, /className:'ld-wide-only'/, '★ 묶음 메뉴에 폰에서 감추는 표시가 없습니다');
});

test('③ ★★ 감추는 규칙은 서로 «반대 폭»에만 — 같은 폭이면 두 단추가 다 사라진다', () => {
  const wide = mediaBody(TIDY, '@media (min-width:641px)');
  const phone = mediaBody(TIDY, '@media (max-width:640px)');
  assert.match(wide, /\.ld-narrow-only\{ display:none !important; \}/);
  assert.doesNotMatch(wide, /ld-wide-only/, '★★ 넓은 화면에서 메뉴를 감춥니다');
  assert.match(phone, /\.ld-wide-only\{ display:none !important; \}/);
  assert.doesNotMatch(phone, /ld-narrow-only/, '★★ 폰에서 원래 단추를 감춥니다 — 폰 단추가 사라집니다');
  const outside = TIDY.replace(wide, '').replace(phone, '');
  assert.doesNotMatch(outside, /ld-(narrow|wide)-only/, '★ 폭 조건 밖에서 감춥니다');
});

test('④ ★ 표 — 칸 너비를 지키고 넘치면 …, 「처리」 칸은 오른쪽 붙박이(넓은 화면만)', () => {
  const wide = mediaBody(TIDY, '@media (min-width:641px)');
  assert.match(wide, /\.ld-tb\{ table-layout:fixed;/, '★ 칸 너비를 안 지키면 내용만큼 늘어나 다시 넘칩니다');
  assert.match(wide, /text-overflow:ellipsis/);
  assert.match(wide, /td\.ld-c-act, \.ld-tb th\.ld-c-act\{ position:sticky; right:0;/, '★★ 처리 칸이 붙박이가 아닙니다');
  assert.match(wide, /td\.ld-c-act\{ background:inherit; \}/, '★ 붙박이 칸이 투명하면 밀려 지나가는 글이 비쳐 보입니다');
  const th = LEDGER.match(/className:'ld-c-act',style:Object\.assign\(\{\},thS,\{width:'(\d+)px'/);
  assert.ok(th && +th[1] >= 150, '★ 처리 칸 너비가 단추 넷(찾기·등록·보류·✕)이 들어갈 만큼 안 됩니다');
});

test('⑤ ★ 안내 긴 글은 ⓘ 로 줄이고 전문은 마우스를 올리면(title) 뜬다', () => {
  assert.match(LEDGER, /className:'ld-hint',\s*title:'칩을 누르면/, '★ 줄이면서 안내 글까지 잃었습니다');
  assert.doesNotMatch(LEDGER, /'↑ 칩을 누르면/, '긴 안내 글이 그대로 한 줄을 차지합니다');
});
