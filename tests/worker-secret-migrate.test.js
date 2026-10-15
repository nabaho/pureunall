/* 근로자 주민번호·계좌·예금주 옮기기 계획 — 대표 결정 2026-10-15 (scripts/worker-secret-migrate.js)
 *   ① 값은 담당자 칸에 «복사»부터 — 공개 덩어리는 같은 값이 담당자 칸에 있을 때만 비운다
 *   ② 담당자 칸에 다른 값이 있으면 덮지 않는다(conflict)
 *   ③ 빈칸은 옮길 것 없이 걷기만, 표시는 «없음»
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { plan } = require('../scripts/worker-secret-migrate.js');

const data = () => ({
  cases: { 'c-1': { workers: [{ id: 'w1', rrn: '900101-1000000' }, { id: 'w2', name: '칸 없음' }, { id: 'w3', rrn: '' }] } },
  contracts: { 'ct-1': { company: { workers: [{ id: 'w9', rrn: '800202-2000000', account: '123-45', holder: '최예시' }] } } }
});

test('★★ ① 처음에는 복사만 — 비울 것은 빈칸뿐', () => {
  const p = plan(data(), {});
  assert.equal(p.count.copy, 4);
  assert.deepEqual(Object.keys(p.copy).sort(), [
    'worker_secret/cases/c-1/w1/rrn',
    'worker_secret/contracts/ct-1/w9/account', 'worker_secret/contracts/ct-1/w9/holder', 'worker_secret/contracts/ct-1/w9/rrn']);
  assert.deepEqual(Object.keys(p.clear).sort(), ['data/cases/v/c-1/workers/2/hasRrn', 'data/cases/v/c-1/workers/2/rrn'],
    '★★ 담당자 칸에 없는 값을 공개 덩어리에서 비우려 합니다 — 값을 잃습니다');
});

test('★★ ① 복사가 된 뒤에는 같은 값만 비우고 「있다」 표시를 남긴다', () => {
  const secret = { cases: { 'c-1': { w1: { rrn: '900101-1000000' } } },
    contracts: { 'ct-1': { w9: { rrn: '800202-2000000', account: '123-45', holder: '최예시' } } } };
  const p = plan(data(), secret);
  assert.equal(p.count.copy, 0);
  assert.equal(p.clear['data/cases/v/c-1/workers/0/rrn'], null);
  assert.equal(p.clear['data/cases/v/c-1/workers/0/hasRrn'], true);
  assert.equal(p.clear['data/contracts/v/ct-1/company/workers/0/account'], null);
  assert.equal(p.clear['data/contracts/v/ct-1/company/workers/0/hasAccount'], true);
  assert.equal(Object.keys(p.clear).some((k) => k.indexOf('/workers/1/') >= 0), false, '칸 없는 근로자를 건드립니다');
});

test('★ ② 담당자 칸에 다른 값이 있으면 덮지도 비우지도 않는다', () => {
  const p = plan(data(), { cases: { 'c-1': { w1: { rrn: '111111-1111111' } } } });
  assert.deepEqual(p.conflicts, ['worker_secret/cases/c-1/w1/rrn']);
  assert.equal('worker_secret/cases/c-1/w1/rrn' in p.copy, false);
  assert.equal('data/cases/v/c-1/workers/0/rrn' in p.clear, false);
});

test('열쇠 없는 근로자는 건너뛰고 알린다', () => {
  const p = plan({ cases: { 'c-2': { workers: [{ rrn: '1' }] } } }, {});
  assert.deepEqual(p.noId, ['cases/c-2#0']);
  assert.equal(Object.keys(p.copy).length, 0);
});
