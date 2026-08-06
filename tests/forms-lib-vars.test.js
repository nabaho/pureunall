'use strict';
// 변수 추출·플래그 — 실행: node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert');
const L = require('../tools/forms_lib.js');

test('extractVars: {{변수}}를 그대로 수집', () => {
  const v = L.extractVars('<p>{{이름}} {{주민등록번호}}</p>');
  assert.deepStrictEqual(v.map(x => x.key).sort(), ['이름', '주민등록번호']);
});

test('extractVars: 빈 기입란 라벨을 변수로 승격', () => {
  const v = L.extractVars('<p>성 명 : ______</p><p>주    소 :        </p>');
  const keys = v.map(x => x.key);
  assert.ok(keys.includes('이름'));
  assert.ok(keys.includes('주소'));
});

test('extractVars: 중복 제거', () => {
  const v = L.extractVars('<p>{{이름}}</p><p>성명 : ____</p><p>{{이름}}</p>');
  assert.strictEqual(v.filter(x => x.key === '이름').length, 1);
});

test('extractVars: 주민등록번호는 required, 가족연락처는 아님', () => {
  const v = L.extractVars('<p>{{주민등록번호}} {{가족연락처}}</p>');
  assert.strictEqual(v.find(x => x.key === '주민등록번호').required, true);
  assert.strictEqual(v.find(x => x.key === '가족연락처').required, false);
});

test('extractVars: type이 붙는다', () => {
  const v = L.extractVars('<p>{{작성일}} {{착수금}} {{이름}}</p>');
  assert.strictEqual(v.find(x => x.key === '작성일').type, 'date');
  assert.strictEqual(v.find(x => x.key === '착수금').type, 'money');
  assert.strictEqual(v.find(x => x.key === '이름').type, 'text');
});

test('flagIssues: 구법 용어를 잡는다', () => {
  assert.ok(L.flagIssues('<p>소액체당금 지급청구서</p>').includes('구법용어'));
  assert.ok(L.flagIssues('<p>일반체당금</p>').includes('구법용어'));
  assert.ok(!L.flagIssues('<p>간이대지급금 지급청구서</p>').includes('구법용어'));
});

test('flagIssues: 노무사회 회원가입용 동의서를 잡는다', () => {
  const f = L.flagIssues('<p>개인정보 제공 동의서</p><p>회비산출의 근거자료</p>');
  assert.ok(f.includes('동의서용도불일치'));
});

test('flagIssues: PII 잔존을 잡는다', () => {
  assert.ok(L.flagIssues('<p>790101-1234567</p>').includes('PII잔존'));
});

test('flagIssues: 깨끗하면 빈 배열', () => {
  assert.deepStrictEqual(L.flagIssues('<p>위 임 장</p><p>{{이름}}</p>'), []);
});

// 추가 테스트: 주소가 있고 자동치환 대상 PII는 없을 때 '주소포함' 플래그를 확인
test('flagIssues: 법인 사무소 주소가 있으면 주소포함 플래그만 붙인다', () => {
  const html = '<p>위 임 장</p><p>사무소: 충남 천안시 서북구 원두정8길 6, 두정빌딩 3층</p>';
  const flags = L.flagIssues(html);
  assert.ok(flags.includes('주소포함'), '주소포함 플래그가 있어야 함');
  assert.ok(!flags.includes('PII잔존'), 'PII잔존 플래그가 없어야 함');
});
