'use strict';
// 복합 HWP → 서식 단위 분할 — 실행: node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert');
const L = require('../tools/forms_lib.js');

test('isTitleLine: 자간 벌린 중앙 제목을 잡는다', () => {
  assert.ok(L.isTitleLine('위   임   약   정   서'));
  assert.ok(L.isTitleLine('위        임        장'));
});

test('isTitleLine: 자간이 없어도 서식 어미면 잡는다', () => {
  assert.ok(L.isTitleLine('진정 취하서 및 반의사불벌고지확인서'));
  assert.ok(L.isTitleLine('개인정보 제공 동의서'));
  assert.ok(L.isTitleLine('소액체당금 지급청구서'));
});

test('isTitleLine: 본문 문장은 제목이 아니다', () => {
  assert.ok(!L.isTitleLine('본인은 귀하에게 상기 사건의 처리에 관한 일체의 사항을 위임하고'));
  assert.ok(!L.isTitleLine('제2조【보수】'));
  assert.ok(!L.isTitleLine(''));
  assert.ok(!L.isTitleLine('가'));
});

test('splitSegments: 서식 3종이 3조각으로 갈린다', () => {
  const html = [
    '<p>위   임   약   정   서</p>',
    '<p>제1조 사건위임 본인은 일체를 위임한다</p>',
    '<p>위        임        장</p>',
    '<p>상기인을 대리인으로 선임합니다</p>',
    '<p>개인정보 제공 동의서</p>',
    '<p>수집목적에 동의합니다</p>',
  ].join('\n');
  const segs = L.splitSegments(html);
  assert.strictEqual(segs.length, 3);
  assert.strictEqual(segs[0].title, '위임약정서');
  assert.strictEqual(segs[1].title, '위임장');
  assert.strictEqual(segs[2].title, '개인정보제공동의서');
  assert.ok(segs[0].html.includes('제1조'));
  assert.ok(!segs[0].html.includes('상기인을'));
  assert.deepStrictEqual(segs.map(s => s.index), [0, 1, 2]);
});

test('splitSegments: 제목이 하나면 통째로 한 조각', () => {
  const html = '<p>합   의   서</p><p>갑과 을은 다음과 같이 합의한다</p>';
  const segs = L.splitSegments(html);
  assert.strictEqual(segs.length, 1);
  assert.strictEqual(segs[0].title, '합의서');
});

test('splitSegments: 제목 앞 머리말은 첫 조각에 붙는다', () => {
  const html = '<p>붙임1</p><p>위   임   장</p><p>본문</p>';
  const segs = L.splitSegments(html);
  assert.strictEqual(segs.length, 1);
  assert.strictEqual(segs[0].title, '위임장');
  assert.ok(segs[0].html.includes('붙임1'));
});

test('splitSegments: 표 안의 짧은 셀은 제목으로 오인하지 않는다', () => {
  const html = '<p>위   임   장</p><table><tr><td>동의서</td><td>내용</td></tr></table>';
  const segs = L.splitSegments(html);
  assert.strictEqual(segs.length, 1);
});
