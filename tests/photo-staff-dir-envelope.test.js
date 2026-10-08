'use strict';
/* 사진첩 «이 신청서로 계약 등록»의 주담당 고르개가 비지 않는다 (2026-10-08)

   무슨 일이 있었나 — 대표가 기술보호울타리 신청서(광성산업)를 사진첩에 넣고 계약을 만들려 했는데
   주담당 고르개가 「직원 명부를 아직 못 받았습니다」로 비어 단추가 눌리지 않았다.
   data/user_dir 은 2026-09-22 부터 { u, v } 봉투인데 erpStaff 가 v 를 안 풀었다 —
   그날부터 사진첩에서 계약을 만든 사람은 아무도 없었다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn.js');

const DOCFILE = fs.readFileSync(path.join(__dirname, '..', 'js', 'pu-doc-file.js'), 'utf8');

function run(val) {
  const ctx = {
    STAFF_DIR: 'data/user_dir', Promise, Object, Array, String,
    deps: { db: { ref: () => ({ once: () => Promise.resolve({ val: () => val }) }) } },
  };
  vm.createContext(ctx);
  vm.runInContext(cutFn(DOCFILE, 'function erpStaff('), ctx);
  return ctx.erpStaff().then((list) => list.map((u) => u.sid));
}
const people = [
  { sid: 'P-001', name: '홍길동', status: 'active' },
  { sid: 'P-002', name: '김철수', status: 'retired' },
  { sid: 'A-001', name: '이영희', status: 'active' },
];

test('★★ 봉투 { u, v } 를 풀어 읽는다 — 이것을 안 풀면 고르개가 빈다', async () => {
  const sids = await run({ u: 1791443444101, v: people });
  assert.deepEqual(sids.slice().sort(), ['A-001', 'P-001'],
    '★★ 명부가 { u, v } 인데 v 를 안 풀면 아무도 안 나와 계약을 못 만듭니다');
});

test('봉투 안이 번호 열쇠 객체여도 읽는다', async () => {
  const sids = await run({ u: 1, v: { 0: people[0], 2: people[2] } });
  assert.equal(sids.length, 2);
});

test('옛 꼴(맨 배열)도 그대로 읽는다 · 그만둔 사람은 뺀다', async () => {
  const sids = await run(people);
  assert.ok(!sids.includes('P-002'), '★ 그만둔 사람 앞으로 계약이 등록되면 안 됩니다');
  assert.equal(sids.length, 2);
});
