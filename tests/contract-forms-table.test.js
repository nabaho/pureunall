'use strict';
/* 계약서 양식 목록 — 원본 보관함과 같은 방식(대표 2026-10-07 「계약서 양식도 같은방식」): ☐·#·원본 칸·고정 머리줄·더 거르기 — 가짜 자료만 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { test } = require('node:test');
const R = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(R, 'js/pu-contract-forms.js'), 'utf8').replace(/\r\n/g, '\n');
global.window = global.window || {};
require('../js/pu-contract-forms.js');
const C = global.window.PuContractForms;

test('원본 형식 — 한글 > 엑셀 > PDF > 글자만 (첨부·보관함 원본 둘 다 본다)', () => {
  assert.strictEqual(C.srcType({ attachments: [{ name: '위임계약서.hwp' }] }), 'hwp');
  assert.strictEqual(C.srcType({ originals: [{ name: '표지틀.xlsx', fileId: 'x' }], attachments: [{ name: '미리보기.pdf', role: 'preview' }] }), 'xlsx');
  assert.strictEqual(C.srcType({ attachments: [{ name: '신청서.pdf' }] }), 'pdf');
  assert.strictEqual(C.srcType({ body: '본문만' }), 'text');
  assert.strictEqual(C.srcType(null), 'text');
});

test('더 거르기 — 원본 형식·사용 여부', () => {
  const list = [
    { id: 'a', attachments: [{ name: 'a.hwp' }] },
    { id: 'b', attachments: [{ name: 'b.xlsx' }], enabled: false },
    { id: 'c' }];
  const ids = (src, use) => C.moreFilter(list, src, use).map(f => f.id);
  assert.deepStrictEqual(ids('', ''), ['a', 'b', 'c']);
  assert.deepStrictEqual(ids('hwp', ''), ['a']);
  assert.deepStrictEqual(ids('', 'off'), ['b']);
  assert.deepStrictEqual(ids('', 'on'), ['a', 'c']);
  assert.deepStrictEqual(ids('text', 'on'), ['c']);
});

test('목록 화면 — 표(☐·#·양식·원본), 머리줄 고정, 체크는 고르기와 따로, 줄을 누르면 오른쪽에', () => {
  const a = SRC.indexOf('    function listCol(list) {'), f = SRC.slice(a, SRC.indexOf('    function cardGrid(list) {', a));
  assert.match(f, /'aria-label': '보이는 양식 모두 묶음에 넣기'/);
  assert.match(f, /el\('th', \{ 'class': 'pcf-ln2', text: '#' \}\)/);
  assert.match(f, /el\('th', \{ 'class': 'pcf-lsrc', text: '원본' \}\)/);
  assert.match(f, /ck\.addEventListener\('click', function \(e\) \{ e\.stopPropagation\(\); \}\);/, '체크할 때 그 양식이 골라지면 안 된다');
  assert.match(f, /onclick: function \(\) \{ select\(f\.id\); \}/);
  assert.match(SRC, /\.pcf-lt thead th\{position:sticky;top:0/);
  assert.match(SRC, /function shown\(\) \{ var sv = setViewList\(\); if \(sv\) return moreFilter\(sv, S\.src, S\.use\); var cv = S\.kind === '_closed'; return moreFilter\(filterForms\(/, '목록은 거르기 한 길(세트 보기·종료 서식 보기 포함)');
  assert.match(SRC, /function resetFilters\(\) \{[^}]*S\.src = ''; S\.use = '';/);
});
