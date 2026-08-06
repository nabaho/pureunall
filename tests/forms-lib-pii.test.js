'use strict';
// 익명화·PII 검사 — 실행: node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert');
const L = require('../tools/forms_lib.js');

test('anonymize: 주민등록번호를 변수로 치환', () => {
  const r = L.anonymize('<p>주민번호 790101-1234567</p>');
  assert.ok(r.html.includes('{{주민등록번호}}'));
  assert.ok(!/\d{6}-\d{7}/.test(r.html));
  assert.strictEqual(r.hits['주민등록번호'], 1);
});

test('anonymize: 사업자등록번호가 계좌번호로 오인되지 않는다', () => {
  const r = L.anonymize('<p>사업자 123-45-67890</p>');
  assert.ok(r.html.includes('{{사업자등록번호}}'));
  assert.ok(!r.html.includes('{{계좌번호}}'));
});

test('anonymize: 휴대폰·유선전화·계좌를 각각 치환', () => {
  const r = L.anonymize('<p>010-1234-5678 / 041-556-0035 / 352-1234-5678-12</p>');
  assert.ok(r.html.includes('{{연락처}}'));
  assert.ok(r.html.includes('{{전화번호}}'));
  assert.ok(r.html.includes('{{계좌번호}}'));
});

test('anonymize: 날짜를 계좌번호로 오인하지 않는다', () => {
  const r = L.anonymize('<p>작성일 2023-01-15</p>');
  assert.ok(!r.html.includes('{{계좌번호}}'));
  assert.ok(r.html.includes('2023-01-15'));
});

test('anonymize: 인명 사전으로 실명을 치환', () => {
  const r = L.anonymize('<p>위임인 홍길동 (인)</p>', ['홍길동']);
  assert.ok(r.html.includes('{{이름}}'));
  assert.ok(!r.html.includes('홍길동'));
  assert.strictEqual(r.hits['이름'], 1);
});

test('anonymize: 이미 치환된 변수는 건드리지 않는다', () => {
  const r = L.anonymize('<p>{{주민등록번호}}</p>');
  assert.strictEqual(r.html, '<p>{{주민등록번호}}</p>');
  assert.strictEqual(Object.keys(r.hits).length, 0);
});

test('scanPii: 남아 있는 개인정보를 라벨과 표본으로 보고', () => {
  const found = L.scanPii('<p>790101-1234567 그리고 010-9999-8888</p>');
  const labels = found.map(f => f.label).sort();
  assert.deepStrictEqual(labels, ['연락처', '주민등록번호']);
  assert.ok(found.find(f => f.label === '주민등록번호').sample.includes('790101'));
});

test('scanPii: 깨끗한 서식은 빈 배열', () => {
  assert.deepStrictEqual(L.scanPii('<p>위 임 장</p><p>{{이름}} {{주민등록번호}}</p>'), []);
});
