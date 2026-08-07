'use strict';
// 서식 분류 — 실행: node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const L = require('../tools/forms_lib.js');
const TX = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'tools', 'forms_taxonomy.json'), 'utf8'));

const c = (rel, html) => L.classify(rel, html || '', TX);

test('도메인은 매칭 트랙 중 최빈값', () => {
  assert.strictEqual(c('2. 임금체불/개별서류정리/위임약정서.hwp').domain, 'wageArrears');
  assert.strictEqual(c('3. 노동위원회자료/서식/2. 대리인 선임신고서.hwp').domain, 'laborCommission');
  assert.strictEqual(c('8. 공동기금/정관.hwp').domain, 'fund');
});

test('트랙은 복수로 잡힌다', () => {
  const r = c('3. 체당금자료/체당금 위임장.hwp');
  assert.ok(r.track.includes('대지급금'));
  assert.ok(r.track.includes('수임·위임'));
});

test('category는 제목·경로로 정해진다', () => {
  assert.strictEqual(c('x/위임약정서.hwp', '<p>위 임 약 정 서</p>').category, 'mandate');
  assert.strictEqual(c('x/개인정보_제공_동의서.hwp', '<p>개인정보 제공 동의서</p>').category, 'consent');
  assert.strictEqual(c('x/진정서.hwp', '<p>진 정 서</p>').category, 'complaint');
  assert.strictEqual(c('x/소액체당금 지급청구서.hwp', '<p>소액체당금 지급청구서</p>').category, 'wageGuarantee');
  assert.strictEqual(c('x/채권계산서.hwp', '<p>채권계산서</p>').category, 'civil');
  assert.strictEqual(c('x/합의서.hwp', '<p>합 의 서</p>').category, 'settlement');
  assert.strictEqual(c('x/취업규칙.hwp', '<p>취업규칙</p>').category, 'internal');
});

test('esign: 근로자 서명 서식만 true', () => {
  assert.strictEqual(c('x/위임약정서.hwp', '<p>위 임 약 정 서</p><p>위임인 : (인)</p>').esign, true);
  assert.strictEqual(c('x/취업규칙.hwp', '<p>취업규칙</p><p>제1조 목적</p>').esign, false);
});

test('signer: 서명란 문구로 판별', () => {
  assert.strictEqual(c('x/a.hwp', '<p>위 임 장</p><p>위임인 : ( 서 명 )</p>').signer, 'worker');
  assert.strictEqual(c('x/b.hwp', '<p>확 약 서</p><p>사업주 : (인)</p>').signer, 'employer');
  assert.strictEqual(c('x/c.hwp', '<p>안 내 문</p><p>본문만 있음</p>').signer, null);
});

test('jurisdiction: 지청명을 뽑는다', () => {
  assert.strictEqual(c('x/진정취하서양식(new) - 천안.hwp').jurisdiction, '천안');
  assert.strictEqual(c('x/체불확인서 발급신청서-평택.hwp').jurisdiction, '평택');
  assert.strictEqual(c('x/약정서-위임장(보령).hwp').jurisdiction, '보령');
  assert.strictEqual(c('x/위임약정서.hwp').jurisdiction, null);
});

test('매칭 트랙이 없으면 domain은 other', () => {
  assert.strictEqual(c('x/사진.hwp', '<p>내용</p>').domain, 'other');
});

// Minor 3 회귀: signFields의 label은 서식 캡션(누가 서명하는 자리인가)이어야
// 하고, 문서 제목이 새어 들어가면 안 된다.
test('signFieldLabel: 서명자 역할·카테고리로 캡션을 고른다', () => {
  assert.strictEqual(L.signFieldLabel('worker', 'mandate'), '위임인');
  assert.strictEqual(L.signFieldLabel('worker', 'complaint'), '진정인');
  assert.strictEqual(L.signFieldLabel('worker', 'wageGuarantee'), '신청인');
  assert.strictEqual(L.signFieldLabel('employer', 'mandate'), '사업주');
  assert.strictEqual(L.signFieldLabel('worker', 'internal'), '근로자');
  assert.strictEqual(L.signFieldLabel(null, 'mandate'), '서명');
});
