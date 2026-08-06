'use strict';
// 대표본 선정 — 실행: node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert');
const L = require('../tools/forms_lib.js');

test('blankScore: 기입란이 많을수록 높다', () => {
  const blank = '<p>성명 : ______</p><p>주소 : ______</p>';
  const filled = '<p>성명 : 홍길동</p><p>주소 : 천안시</p>';
  assert.ok(L.blankScore(blank) > L.blankScore(filled));
});

test('pickRepresentative: PII 없는 빈 양식을 우선', () => {
  const members = [
    { rel: 'case/실사건.hwp',  mtime: 2000, html: '<p>성명 : 홍길동 790101-1234567</p>' },
    { rel: 'form/빈양식.hwp', mtime: 1000, html: '<p>성명 : ______</p><p>주소 : ______</p>' },
  ];
  const r = L.pickRepresentative(members);
  assert.strictEqual(r.rep.rel, 'form/빈양식.hwp');
  assert.strictEqual(r.pickedBy, 'blank');
});

test('pickRepresentative: 빈 양식이 없으면 최신 사건본', () => {
  const members = [
    { rel: 'old.hwp', mtime: 1000, html: '<p>성명 : 김철수 800101-1234567</p>' },
    { rel: 'new.hwp', mtime: 9000, html: '<p>성명 : 이영희 850101-2234567</p>' },
  ];
  const r = L.pickRepresentative(members);
  assert.strictEqual(r.rep.rel, 'new.hwp');
  assert.strictEqual(r.pickedBy, 'anonymized-latest');
});

test('pickRepresentative: 빈 양식이 여럿이면 기입란 많고 최신인 것', () => {
  const members = [
    { rel: 'a.hwp', mtime: 1000, html: '<p>성명 : ______</p>' },
    { rel: 'b.hwp', mtime: 2000, html: '<p>성명 : ______</p><p>주소 : ______</p><p>연락처 : ______</p>' },
  ];
  assert.strictEqual(L.pickRepresentative(members).rep.rel, 'b.hwp');
});

test('pickRepresentative: 빈 배열이면 null', () => {
  assert.strictEqual(L.pickRepresentative([]).rep, null);
});
