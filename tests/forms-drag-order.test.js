'use strict';
/* 끌어서 차례 바꾸기 (대표 「서류의 순서를 마우스 드래그로 위아래 순서 바꿀 수 있게 … 모든 계약서관리에 동일 적용」 2026-10-09) — 가짜 자료만
   ⓐ 순수 — moveIn(앞·뒤) · applyOrder(그 갈래만) · 목록 정렬은 order 먼저, 없으면 맨 뒤 이름순
   ⓑ 화면 — 양식 줄 · 아래 막대(고른 서류=채우기 차례) · 왼쪽 세트 목록 세 곳 모두 dragSort, 저장은 거래 한 길 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { test } = require('node:test');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'js/pu-contract-forms.js'), 'utf8').replace(/\r\n/g, '\n');
global.window = global.window || {};
require('../js/pu-contract-forms.js');
const C = global.window.PuContractForms;
const cut = (s) => { const a = SRC.indexOf(s); assert.ok(a >= 0, s); return SRC.slice(a, SRC.indexOf('\n    }\n', a)); };

test('ⓐ moveIn · applyOrder · 정렬', () => {
  assert.deepStrictEqual(C.moveIn(['a', 'b', 'c', 'd'], 'd', 'b', false), ['a', 'd', 'b', 'c']);
  assert.deepStrictEqual(C.moveIn(['a', 'b', 'c', 'd'], 'a', 'c', true), ['b', 'c', 'a', 'd']);
  assert.deepStrictEqual(C.moveIn(['a', 'b'], 'x', 'a', false), ['a', 'b'], '없는 열쇠면 그대로');
  assert.deepStrictEqual(C.moveIn(['a', 'b'], 'a', 'a', true), ['a', 'b']);
  const list = [{ id: 'a', name: '가' }, { id: 'b', name: '나' }, { id: 'z', name: '다', order: 7 }];
  C.applyOrder(list, ['b', 'a']);
  assert.deepStrictEqual(list.map((f) => f.order), [1, 0, 7], '고른 것만 0,1… 다른 것은 그대로');
  assert.equal(C.orderOf({}), 1e9); assert.equal(C.orderOf({ order: 2 }), 2);
  const forms = [
    { id: 'x1', kind: 'company', name: '가 자문계약서' }, { id: 'x2', kind: 'company', name: '나 CMS', order: 0 },
    { id: 'x3', kind: 'company', name: '다 급여', order: 1 }, { id: 'x4', kind: 'company', name: '라 견적', groupName: '견적서·제안서' }];
  const ids = C.filterForms(forms, { kind: 'company' }).map((f) => f.id);
  assert.ok(ids.indexOf('x2') < ids.indexOf('x3') && ids.indexOf('x3') < ids.indexOf('x1'), '정한 차례가 먼저, 안 정한 것은 뒤 이름순: ' + ids);
});

test('ⓑ 세 곳 모두 끌기 · 저장은 거래', () => {
  assert.match(SRC, /var SORT_TYPE = 'text\/x-pcf-sort';/);
  const d = SRC.slice(SRC.indexOf('function dragSort('), SRC.indexOf('/* 칩 개수 — 측 칩은'));
  assert.match(d, /if \(from == null \|\| from === r\.id\) return;\n        e\.preventDefault\(\);/, '우리 끌기일 때만 놓을 수 있다(파일 끌어 놓기와 섞이지 않게)');
  assert.match(SRC, /dragSort\(rows, moveForm\);/, '양식 목록');
  assert.match(SRC, /dragSort\(chips, moveChecked\);/, '고른 서류(세트 안) 차례');
  assert.match(SRC, /dragSort\(setRows, moveSet\);/, '왼쪽 세트 목록');
  const mf = cut('function moveForm(');
  assert.match(mf, /groupOf\(fa\) !== groupOf\(fb\)/, '같은 갈래 안에서만');
  assert.match(mf, /change\(function \(list\) \{ return applyOrder\(list, ids\); \}/);
  const mc = cut('function moveChecked(');
  assert.match(mc, /changeSets\(db, function \(doc\)/); assert.match(mc, /isSeedSet\(id\) && doc\.rm\.indexOf\(id\) < 0/, '지운 기본 세트를 되살리지 않는다');
  assert.match(mc, /doc\.v = setsOf\(doc\)/, '기본 세트를 고쳐도 목록 차례가 그대로(맨 위로 튀지 않게)');
  const ms = cut('function moveSet(');
  assert.match(ms, /var all = setsOf\(doc\)/); assert.match(ms, /그사이 남이 만든 세트는 끝에/);
});
