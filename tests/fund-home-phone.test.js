'use strict';
/* 폰에서 기금 목록 — 기금명이 «한 글자씩» 세로로 쌓이던 것이 다시 났다(대표 폰 캡쳐 2026-09-30 「컴팩트하게 다시정리」).
 * 주담당 132px·계약관계 122px 이 폰에서도 그대로라 411px 화면에서 기금명 칸이 40px 남짓이었다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8');
const phone = (() => { const i = SRC.indexOf('@media (max-width:600px){'); return SRC.slice(i, SRC.indexOf('\n  }', i)); })();

test('★★ 폰에서는 번호·주담당·계약관계 폭을 줄인다 — 넓은 화면 폭(132·122px)이 폰까지 오면 기금명이 한 글자씩 쌓인다', () => {
  assert.match(phone, /table\.fixcol th\.no\{width:32px!important/);
  assert.match(phone, /table\.fixcol th\.mgc\{width:54px!important\}/);
  assert.match(phone, /table\.fixcol th\.lcc\{width:92px!important\}/);
  assert.match(SRC, /cols\.push\(\['주담당','mgc','132px'\]/, '주담당 머리 칸에 폭 이름표가 없다 — 폰 규칙이 안 걸린다');
  assert.match(SRC, /cols\.push\(\['계약관계','lcc','122px'\]\)/);
});

test('폰에서는 기금명 아래 긴 정식 이름 줄을 접는다 — 약칭이 한 줄로 서게', () => {
  assert.match(SRC, /'<div class="muted ph" style="font-weight:400;font-size:11\.5px">'\+esc\(f\.name\|\|''\)\+'<\/div><\/td>'/);
  assert.match(phone, /\.ph\{display:none\}/);
});
