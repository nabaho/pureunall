'use strict';
/* 기업별 계약서 — 갈래별 정리·대조 (대표 2026-10-09) — 가짜 자료만
   ⓐ 종류 → 갈래(계약서 양식 나무와 같은 말)
   ⓑ 한 회사 나누기 — 기록+파일 ok · 기록만 missing · 파일만 norec(종류 짐작/정해 둔 종류) · 모름 none
   ⓒ 칩 거르기 — 갈래·대조
   ⓓ 저장 — 파일 종류 칸(규칙 길이 묶음), '' 이면 지움 · 전체 읽기는 두 칸만 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const { test } = require('node:test');
const R = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(R, f), 'utf8').replace(/\r\n/g, '\n');
function load() {
  const b = { console, Date, Math, JSON, Promise, Object, Array, String, Number, Error }; b.window = b; vm.createContext(b);
  vm.runInContext(read('js/pu-co-roster.js'), b); vm.runInContext(read('js/pu-office-docs.js'), b);
  return b.PuOfficeDocs;
}
const D = load();

test('ⓐ 종류 → 갈래', () => {
  assert.equal(D.groupOfKind('급여관리'), 'company'); assert.equal(D.groupOfKind('CMS'), 'company');
  assert.equal(D.groupOfKind('사건'), 'case'); assert.equal(D.groupOfKind('컨설팅'), 'consulting');
  assert.equal(D.groupOfKind('기금'), 'fund'); assert.equal(D.groupOfKind('제안서'), 'consult'); assert.equal(D.groupOfKind('모름'), '');
});

test('ⓑ 한 회사 나누기', () => {
  const recs = [{ id: 'r1', kind: '급여관리', date: '2024-03-21', docId: 'd1' }, { id: 'r2', kind: 'CMS', date: '2024-03-21' }];
  const docs = [{ id: 'd1', title: '급여관리 위임계약서' }, { id: 'd2', title: '위임계약서_부당해고', date: '2025-01-02' },
    { id: 'd3', title: '스캔0001' }, { id: 'd4', title: '스캔0002', kind: '컨설팅' }];
  const x = JSON.parse(JSON.stringify(D.coSort(recs, docs)));
  assert.deepStrictEqual(x.n, { ok: 1, missing: 1, norec: 2, none: 1 });
  const by = (id) => x.items.find((i) => (i.doc && i.doc.id === id) || (i.rec && i.rec.id === id));
  assert.equal(by('r1').state, 'ok'); assert.equal(by('r2').state, 'missing');
  assert.equal(by('d2').group, 'case'); assert.equal(by('d2').guessed, true);
  assert.equal(by('d4').group, 'consulting'); assert.equal(by('d4').guessed, false, '정해 둔 종류는 짐작이 아니다');
  assert.equal(by('d3').state, 'none');
  assert.deepStrictEqual(x.groups, { company: 2, case: 1, consulting: 1 });
});

test('ⓒ 칩 거르기', () => {
  const idx = D.coIndex({ a: { r1: { kind: '사건', docId: 'd' } }, b: { r2: { kind: '자문' } } }, { a: { d: { title: 'x' } } });
  const cos = [{ key: 'a' }, { key: 'b' }, { key: 'c' }];
  assert.deepStrictEqual(D.filterCosBy(cos, idx, 'case', '').map((c) => c.key), ['a']);
  assert.deepStrictEqual(D.filterCosBy(cos, idx, '', 'missing').map((c) => c.key), ['b']);
  assert.deepStrictEqual(D.filterCosBy(cos, idx, '', '').map((c) => c.key), ['a', 'b', 'c']);
  assert.deepStrictEqual(D.filterCosBy(cos, null, 'case', 'missing').map((c) => c.key), ['a', 'b', 'c'], '색인을 못 읽으면 갈래 거르기를 걸지 않는다(풀 길 없이 갇히지 않게)');
});

test('ⓓ 저장 · 규칙', () => {
  const st = read('js/pu-office-store.js');
  assert.match(st, /if \('kind' in \(patch \|\| \{\}\)\) up\.kind = patch\.kind \? String\(patch\.kind\)\.slice\(0, 20\) : null;/);
  const all = st.slice(st.indexOf('function listAllCoData('), st.indexOf('\n  }\n', st.indexOf('function listAllCoData(')));
  assert.match(all, /ROOT \+ '\/co_recs'/); assert.match(all, /ROOT \+ '\/co_docs'/); assert.doesNotMatch(all, /originals|secret/);
  const rules = read('scripts/make-firebase-rules.js');
  assert.match(rules, /kind: +\{ '\.validate': 'newData\.isString\(\) && newData\.val\(\)\.length <= 20' \},\n    at: +\{ '\.validate': 'newData\.isNumber\(\)' \},\n    by: +\{ '\.validate': 'newData\.val\(\) === auth\.uid' \},\n    byName/);
});
