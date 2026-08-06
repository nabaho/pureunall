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

test('pickRepresentative: 빈 양식에 사무소 주소(review)가 있어도 탈락하지 않는다', () => {
  // Finding 2 — scanPii는 주소를 kind:'review'로 보고한다(자동 치환 대상이 아님).
  // pickRepresentative는 kind:'redact'만 '더러움'으로 봐야 한다. 필터를
  // scanPii(...).length === 0 으로 되돌리면 이 테스트가 실패해야 한다.
  const members = [
    {
      rel: 'case/실사건.hwp',
      mtime: 9000,
      html: '<p>성명 : 김철수 800101-1234567</p>',   // 진짜 주민번호 — kind:'redact'
    },
    {
      rel: 'form/빈양식.hwp',
      mtime: 1000,
      html: '<p>성명 : ______</p>' +
            '<p>주소 : ______</p>' +
            // 노무법인 사무소 주소 — 실제 개인 주소가 아니라 kind:'review'로만 잡혀야 한다.
            '<p>사무소 주소: 충남 천안시 서북구 원두정8길 6, 두정빌딩 3층</p>',
    },
  ];
  const r = L.pickRepresentative(members);
  assert.strictEqual(r.rep.rel, 'form/빈양식.hwp');
  assert.strictEqual(r.pickedBy, 'blank');
});

test('blankScore: 밑줄뿐 아니라 괄호공백·콜론공백 기입란도 잡는다 (Finding 1)', () => {
  const paren = '<p>성명 (    )</p><p>주소 (    )</p>';
  const colon = '<p>성명 :     </p><p>주소 :     </p>';
  assert.ok(L.blankScore(paren) > 0, '괄호공백 기입란이 0점이면 안 된다');
  assert.ok(L.blankScore(colon) > 0, '콜론공백 기입란이 0점이면 안 된다');
});

test('pickRepresentative: 괄호공백·콜론공백으로만 표시된 빈 양식도 대표로 뽑힌다 (Finding 1)', () => {
  const members = [
    { rel: 'case/실사건.hwp', mtime: 9000, html: '<p>성명 : 김철수 800101-1234567</p>' },
    { rel: 'form/괄호식.hwp', mtime: 1000, html: '<p>성명 (    )</p><p>주소 (    )</p>' },
  ];
  const r1 = L.pickRepresentative(members);
  assert.strictEqual(r1.rep.rel, 'form/괄호식.hwp');
  assert.strictEqual(r1.pickedBy, 'blank');

  const members2 = [
    { rel: 'case/실사건.hwp', mtime: 9000, html: '<p>성명 : 김철수 800101-1234567</p>' },
    { rel: 'form/콜론식.hwp', mtime: 1000, html: '<p>성명 :     </p><p>주소 :     </p>' },
  ];
  const r2 = L.pickRepresentative(members2);
  assert.strictEqual(r2.rep.rel, 'form/콜론식.hwp');
  assert.strictEqual(r2.pickedBy, 'blank');
});
