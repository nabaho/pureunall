'use strict';
/* 폰 머리줄 한 줄(대표 선택 2026-09-30 「목업 안 B」) — 보기·분류는 고르는 상자, 검색은 🔍 를 눌러 펼친다.
 * PC 는 그대로(세그먼트 단추)라서 두 벌을 그려 두고 CSS 로 가른다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8');
const phone = (() => { const i = SRC.indexOf('@media (max-width:600px){'); return SRC.slice(i, SRC.indexOf('\n  }', i)); })();
const gF = (n) => { const i = SRC.indexOf('function ' + n + '('); assert.ok(i >= 0, '없음 ' + n); let d = 0;
  for (let k = SRC.indexOf('{', i); k < SRC.length; k++) { if (SRC[k] === '{') d++; else if (SRC[k] === '}') { d--; if (!d) return SRC.slice(i, k + 1); } } };

test('PC 는 그대로 — 세그먼트 단추는 남고, 폰용 상자·🔍 는 PC 에서 숨는다', () => {
  assert.match(SRC, /\.hd-m\{display:none\}/);
  assert.match(SRC, /'<span class="hd-pc" style="display:contents">'\+_bar\+homeViewBar\(\)\+\(regBar\?_bar\+regBar:''\)\+'<\/span>'/);
  assert.match(SRC, /\.hd-tools\{display:contents\}/, 'PC 에서는 도구 묶음이 자리를 만들지 않는다');
});

test('폰에서는 PC 조각을 숨기고 상자를 보인다', () => {
  assert.match(phone, /\.hd-pc\{display:none!important\}/);
  assert.match(phone, /select\.hd-m,button\.hd-m\{display:inline-block\}/);
  assert.match(phone, /#homehead\.qopen \.search\.sq\{display:block/, '🔍 를 눌러야 검색칸이 나온다');
  assert.match(phone, /#homehead \.search\.sq\{display:none/);
  assert.match(phone, /#homehead \.hd-tools\{display:flex;flex-wrap:wrap[^}]*order:9;flex:1 1 100%/, '정보 채우기 도구는 아래 줄로');
});

test('보기·분류 상자 — 고르면 PC 단추와 같은 함수를 부른다', () => {
  const vs = gF('homeViewSel');
  assert.match(vs, /onchange="homeView\(this\.value\)"/);
  assert.match(vs, /HOME_VIEWS\.map/);
  assert.match(SRC, /regSel='<select class="hsel hd-m" aria-label="분류" onchange="S\.homeReg=this\.value;renderHome\(\)">'/);
  assert.match(SRC, /'<option value="">전체 '/);
});

test('🔍 는 검색칸을 펼치고 닫을 때 검색어도 비운다', () => {
  const t = gF('homeSearchToggle');
  assert.match(t, /S\.qOpen=!S\.qOpen; if\(!S\.qOpen\) S\.q=''/);
  assert.match(SRC, /var _qo=\(S\.qOpen\|\|S\.q\)\?' qopen':''/, '검색어가 있으면 닫혀 있어도 펼쳐 보인다');
  assert.match(SRC, /<input class="search sq" id="hq"/);
});

test('제목 앞 그림 글자는 폰에서만 뺀다 — 한글 제목은 쪼개지 않는다', () => {
  const box = {}; new Function(['function esc(s){return String(s)}', gF('_hdTitle'), 'this.f=_hdTitle;'].join(String.fromCharCode(10))).call(box);
  assert.equal(box.f('🏛 지역기금'), '<span class="hd-pc">🏛 </span>지역기금');
  assert.equal(box.f('기금 현황'), '기금 현황');
});
