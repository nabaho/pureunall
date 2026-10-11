/* 정부지원금 씨앗 — 캡처 71줄이 «빠짐없이 한 번씩» 들어갔는가 (2026-10-11)
   ★ 줄 번호 합집합이 규칙이다: 1~71 에서 자리표시 4줄을 뺀 67줄이 꼭 한 번씩. */
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../js/pu-govaid-seed.js');

const R = S.records();
const D2 = ['디지털 전환(사업전환)', '사업전환'];

test('캡처의 모든 줄이 꼭 한 번씩 — 자리표시만 빠진다', () => {
  const seen = [];
  R.forEach((r) => r.seedRow.forEach((n) => seen.push(n)));
  const want = [];
  for (let n = 1; n <= 71; n++) if (S.PLACEHOLDER_ROWS.indexOf(n) < 0) want.push(n);
  assert.deepEqual(seen.slice().sort((a, b) => a - b), want);
});

test('서로 다른 사업은 47개', () => {
  assert.equal(R.length, 47); // 검사고정-허용: 캡처 71줄 − 자리표시 4줄 − 분야만 다른 짝 20쌍 = 47 (설계서 7절)
});

test('id 는 «gp-r + 큰 번호» 이고 겹치지 않는다 — 다시 넣어도 같은 자리', () => {
  const ids = R.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length);
  R.forEach((r) => assert.equal(r.id, 'gp-r' + Math.max.apply(null, r.seedRow)));
});

test('모두 초안이고 조건은 비어 있다 — 요건을 지어내지 않는다', () => {
  R.forEach((r) => {
    assert.equal(r.status, 'draft');
    assert.equal(r.cond, undefined);
    assert.equal(r.entityType, 'SupportProgram');
  });
});

test('짝으로 합친 사업은 분야 꼬리표가 둘 — 디지털 전환(사업전환) · 사업전환', () => {
  const pairs = R.filter((r) => r.seedRow.length === 2);
  assert.ok(pairs.length >= 1);
  pairs.forEach((r) => assert.deepEqual(r.fields, D2, r.name));
  R.filter((r) => r.seedRow.length === 1).forEach((r) => assert.equal(r.fields.length, 1, r.name));
});

test('의심 두 곳 — 기관이 다른 #54↔#10 은 기관을 비우고, 잘린 클라우드 두 줄은 합치지 않는다', () => {
  const ip = R.find((r) => r.seedRow.indexOf(10) >= 0);
  assert.deepEqual(ip.seedRow, [54, 10]);
  assert.equal(ip.agency, '');
  assert.ok(R.find((r) => r.id === 'gp-r39'));
  assert.ok(R.find((r) => r.id === 'gp-r38'));
});

test('자리표시(사업명 «기타»)는 사업으로 넣지 않는다', () => {
  R.forEach((r) => assert.notEqual(r.name, '기타'));
});
