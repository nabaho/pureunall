'use strict';
/* 기업 상세 찾기 — 컨설팅 종류로도 찾는다 (대표 지시 2026-10-05 「검색에서 컨설팅 종류로 검색이 가능하게」)
   ■ 못 박는 것 — coQueryHit 를 «혼자» 떼어 실제로 돌린다
     ① 상호·사업자번호·대표자는 예전처럼 걸린다
     ② 서류 갈래 딱지(extra.tags)·메모(extra.memo)·이알피 업체유형(erp.type)으로도 걸린다
     ③ 아무 정보도 없는 회사(extra·erp 없음)에서 깨지지 않는다
   ⚠ 예시는 가짜다(가나상사·홍길동, 사업자번호 123-). */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { cutFn } = require('./cut-fn');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8').replace(/\r\n/g, '\n');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(cutFn(SRC, 'function coQueryHit('), ctx);
const hit = (o, q) => ctx.coQueryHit(o, q.toLowerCase());

const co = {
  name: '가나상사', bizno: '1234567890', ceo: '홍길동',
  extra: { tags: { '2021년 충남북부상공회의소 인사노무 컨설팅 신청서': true },
           memo: '[현장클리닉] 2025-07-16 신청 · 2025-09-16 완료 · 클리닉위원 홍길순' },
  erp: { type: '자문' }
};

test('상호·사업자번호·대표자로는 예전처럼 찾는다', () => {
  assert.ok(hit(co, '가나'));
  assert.ok(hit(co, '1234567890'));
  assert.ok(hit(co, '홍길동'));
});

test('컨설팅 종류(갈래 딱지·메모·업체유형)로 찾는다', () => {
  assert.ok(hit(co, '상공회의소'), '서류 갈래 딱지');
  assert.ok(hit(co, '현장클리닉'), '메모');
  assert.ok(hit(co, '홍길순'), '메모에 적힌 클리닉위원');
  assert.ok(hit(co, '자문'), '이알피 업체유형');
  assert.ok(!hit(co, '기술보호'));
});

test('정보가 없는 회사에서 깨지지 않는다', () => {
  assert.ok(!hit({ name: '다라', bizno: '', ceo: '' }, '현장클리닉'));
  assert.ok(hit({ name: '다라' }, '다라'));
});

test('찾기 칸 안내에 컨설팅 종류가 보인다', () => {
  assert.equal((SRC.match(/'상호·사업자번호·대표자·컨설팅 종류로 찾기'/g) || []).length, 2);
});
