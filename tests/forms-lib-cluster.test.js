'use strict';
// 서식 군집 로직 — 실행: node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert');
const L = require('../tools/forms_lib.js');

test('normalizeForHash: 태그·엔티티 제거하고 숫자를 #로 뭉갠다', () => {
  assert.strictEqual(L.normalizeForHash('<p>금 5,000원</p>'), '금 #,###원');
  assert.strictEqual(L.normalizeForHash('<p>가</p>\n<p>나</p>'), '가 나');
  assert.strictEqual(L.normalizeForHash('<td>A&nbsp;B</td>'), 'A B');
});

test('formHash: 날짜·금액만 다른 같은 서식은 같은 해시', () => {
  const a = '<p>위 임 장</p><p>작성일 2023년 5월 1일 금 100,000원</p>';
  const b = '<p>위 임 장</p><p>작성일 2025년 9월 7일 금 250,000원</p>';
  assert.strictEqual(L.formHash(a), L.formHash(b));
});

test('formHash: 문구가 다르면 다른 해시', () => {
  assert.notStrictEqual(L.formHash('<p>위 임 장</p>'), L.formHash('<p>진 정 서</p>'));
});

test('formHash: 10자 16진수', () => {
  assert.match(L.formHash('<p>아무거나</p>'), /^[0-9a-f]{10}$/);
});

test('similarity: 동일 문서는 1, 무관한 문서는 낮음', () => {
  const t = '가 나 다 라 마 바 사 아 자 차';
  assert.strictEqual(L.similarity(t, t), 1);
  assert.ok(L.similarity(t, '하 파 타 카 차 자 아 사 바 마') < 0.3);
});

test('similarity: 한 문단 다른 판본은 0.85 이상', () => {
  const base = Array.from({ length: 40 }, (_, i) => '조항' + i).join(' ');
  assert.ok(L.similarity(base, base + ' 추가문단 하나') >= 0.85);
});

test('clusterByContent: 완전동일 3건이 한 군집으로', () => {
  const items = [
    { key: 'a', text: '위 임 장 본문 하나 둘 셋 넷 다섯' },
    { key: 'b', text: '위 임 장 본문 하나 둘 셋 넷 다섯' },
    { key: 'c', text: '위 임 장 본문 하나 둘 셋 넷 다섯' },
    { key: 'd', text: '전혀 다른 문서 여섯 일곱 여덟 아홉 열' },
  ];
  const groups = L.clusterByContent(items).map(g => g.map(x => x.key).sort());
  assert.strictEqual(groups.length, 2);
  assert.ok(groups.some(g => g.join(',') === 'a,b,c'));
  assert.ok(groups.some(g => g.join(',') === 'd'));
});

// Minor 4 회귀: 위 테스트는 해시가 같은 항목끼리만 있어서 2차 유사도 병합
// (jaccardSets(repShingles[i], repShingles[j]))이 실행은 되어도 성공한 적이 없다
// (전부 완전동일이라 1차 해시에서 이미 합쳐짐). 커밋 ef5266c가 이 비교를
// similarity(...) → jaccardSets(repShingles[i], repShingles[j])로 바꿨는데,
// repShingles가 잘못된 인덱스를 가리켜도 이 테스트는 통과한다. 해시가 다르지만
// 문구가 비슷한 두 항목이 실제로 병합되는지, 무관한 항목은 병합되지 않는지를
// 직접 확인한다.
test('clusterByContent: 해시는 다르지만 유사한 두 판본은 병합되고 무관한 문서는 남는다', () => {
  const base = Array.from({ length: 40 }, (_, i) => '조항' + i).join(' ');
  const items = [
    { key: 'a', text: base },
    { key: 'b', text: base + ' 추가문단 하나' },
    { key: 'c', text: '전혀 다른 문서 여섯 일곱 여덟 아홉 열' },
  ];
  const groups = L.clusterByContent(items).map(g => g.map(x => x.key).sort());
  assert.strictEqual(groups.length, 2);
  assert.ok(groups.some(g => g.join(',') === 'a,b'));
  assert.ok(groups.some(g => g.join(',') === 'c'));
});
