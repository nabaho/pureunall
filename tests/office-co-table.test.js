'use strict';
/* 기업별 계약서 — 원본 보관함과 같은 방식(대표 2026-10-07 「기업별계약서도 같은방식」):
   회사 목록 거르기 · 계약서 파일 표(☐·#·제목·계약일·출처) · 출처 거르기 · 틀 고정 · 오른쪽 미리보기 · 묶어 받기·골라 보내기 — 가짜 자료만 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const { test } = require('node:test');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'js/pu-office-docs.js'), 'utf8').replace(/\r\n/g, '\n');
function load() {
  const box = { console, Date, Math, JSON, Promise, Object, Array, String, Number, Error };
  box.window = box;
  vm.createContext(box);
  vm.runInContext(SRC, box);
  return box.PuOfficeDocs;
}
const ids = (xs, k) => JSON.parse(JSON.stringify(xs)).map(x => x[k || 'key']);

test('회사 목록 거르기 — 계약 기록·파일·사업자번호 없음 + 검색', () => {
  const D = load();
  const cos = [{ key: 'a', name: '가나상사', n: 3, r: 0, bz: '123-45-67890' }, { key: 'b', name: '다라산업', n: 0, r: 2, bz: '' }, { key: 'c', name: '마바상회', n: 1, r: 1, bz: '12345' }];
  assert.deepStrictEqual(ids(D.filterCos(cos, '', '')), ['a', 'b', 'c']);
  assert.deepStrictEqual(ids(D.filterCos(cos, '', 'recs')), ['b', 'c']);
  assert.deepStrictEqual(ids(D.filterCos(cos, '', 'files')), ['a', 'c']);
  assert.deepStrictEqual(ids(D.filterCos(cos, '', 'nobz')), ['b', 'c'], '10자리가 아닌 번호도 «없음»');
  assert.deepStrictEqual(ids(D.filterCos(cos, '상', 'nobz')), ['c']);
});

test('파일 출처 거르기 — 출처가 없는 옛 줄은 업로드로 본다', () => {
  const D = load();
  const docs = [{ id: '1', src: 'upload' }, { id: '2', src: 'photo' }, { id: '3', src: 'folder' }, { id: '4' }];
  assert.deepStrictEqual(ids(D.filterDocs(docs, ''), 'id'), ['1', '2', '3', '4']);
  assert.deepStrictEqual(ids(D.filterDocs(docs, 'upload'), 'id'), ['1', '4']);
  assert.deepStrictEqual(ids(D.filterDocs(docs, 'photo'), 'id'), ['2']);
});

test('화면 — 파일 표(☐·#), 줄을 누르면 오른쪽 미리보기, 체크는 고르기와 따로, 틀 고정, 묶어 받기·골라 보내기', () => {
  const a = SRC.indexOf('function mountCompanies('), m = SRC.slice(a, SRC.indexOf('function readBytes(', a));
  assert.match(m, /'aria-label': '보이는 파일 모두 고르기'/);
  assert.match(m, /el\('th', \{ style: 'width:40px', text: '#' \}\)/);
  assert.match(m, /onclick: function \(\) \{ S\.dsel = d; draw\(\); \}/);
  assert.match(m, /cb\.addEventListener\('click', function \(e\) \{ e\.stopPropagation\(\); \}\);/);
  assert.match(m, /function drawDocPreview\(box\)/);
  assert.match(m, /function zipDocs\(\)[\s\S]*host\.zip\(files\)/);
  assert.match(m, /openResend\(S\.dpicked\)/);
  assert.match(m, /if \(S\.dkey !== key\) \{ S\.dpicked = \{\}; S\.dsel = null; S\.dkey = key; \}/, '회사를 바꾸면 고른 것·미리보기를 비운다');
  assert.match(SRC, /\.pod-co-r\{[^}]*max-height:calc\(100vh[^)]*\)[^}]*overflow:auto/);
  assert.match(SRC, /\.pod-co-r \.pod-rt thead th\{position:sticky;top:0/);
  assert.doesNotMatch(m.slice(m.indexOf('function zipDocs('), m.indexOf('function zipDocs(') + 2000), /\.remove\(\)/);
});
