/* 모은 자료 전수 재검사 — 담긴 가린 글 전체에서 개인정보 «꼴»을 다시 찾는다 (설계 §4-9)
   서버는 «가린 파일을 다시 읽어 남은 것이 0일 때만» 담는다. 이 연장은 그 뒤에 «사람이»
   한 번 더 훑는 그물이다 — 가림 엔진과 «다른 잣대»(단순 꼴)라서 엔진이 같은 자리를 함께 놓치지 않는다.
   ★ 못 박는 것 — ① 꼴을 찾는다 ② 가린 것(●)은 안 센다 ③ 보고에 원래 번호를 싣지 않는다 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../scripts/rules-library-audit.js');

test('주민·전화·계좌 꼴을 찾고, 가린 것(●)은 안 센다', () => {
  const r = A.scan({ rd_1: '연락처 010-9876-5432', rd_2: '주민 900101-●●●●●●●', rd_3: '계좌 123456-01-234567' });
  assert.deepEqual(r.hits.map((h) => h.id).sort(), ['rd_1', 'rd_3']);
  assert.equal(r.docs, 3);
});

test('★ 보고에 원래 번호를 싣지 않는다 — 어느 문서에 어느 꼴이 몇 개인지만', () => {
  const r = A.scan({ rd_1: '연락처 010-9876-5432 · 메일 hong@gana.co.kr', rd_2: '주민 900101-1234567' });
  const s = JSON.stringify(r);
  assert.ok(!s.includes('9876') && !s.includes('hong@') && !s.includes('1234567'), '보고에 번호가 실렸습니다');
  assert.deepEqual(r.hits.find((h) => h.id === 'rd_2'), { id: 'rd_2', kind: '주민', n: 1 });
});

test('날짜·조문 번호·사업자번호는 개인정보가 아니다 — 헛잡지 않는다', () => {
  const r = A.scan({ rd_1: '2026. 7. 1. 시행 · 제93조 제1호 · 사업자등록번호 123-45-67890 · 근로기준법 제60조' });
  assert.deepEqual(r.hits, []);
});

test('빈 것·null 에 안 터진다', () => {
  assert.deepEqual(A.scan(null), { docs: 0, hits: [] });
  assert.deepEqual(A.scan({ rd_1: null }).hits, []);
});

test('유선 전화(지역번호)는 «전화»로 센다 — 계좌로 세지 않는다', () => {
  const r = A.scan({ rd_1: '담당 031-123-4567 · 팩스 02-555-1234 · 휴대 01012345678' });
  assert.deepEqual(r.hits, [{ id: 'rd_1', kind: '전화', n: 3 }]);
});
