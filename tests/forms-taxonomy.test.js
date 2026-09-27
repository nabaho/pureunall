'use strict';
// 분류 사전 무결성 — 실행: node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const TX = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'tools', 'forms_taxonomy.json'), 'utf8'));

test('트랙은 6개 도메인을 모두 덮는다', () => {
  const domains = new Set(TX.tracks.map(t => t.domain));
  for (const d of ['wageArrears', 'laborCommission', 'industrialAccident',
                   'consulting', 'fund', 'bargaining']) {
    assert.ok(domains.has(d), '도메인 누락: ' + d);
  }
});

test('모든 트랙 정규식이 컴파일된다', () => {
  for (const t of TX.tracks) {
    assert.doesNotThrow(() => new RegExp(t.re), '컴파일 실패: ' + t.name);
  }
});

test('대표 경로가 기대한 트랙에 걸린다', () => {
  const hit = rel => TX.tracks.filter(t => new RegExp(t.re).test(rel)).map(t => t.name);
  assert.ok(hit('2. 임금체불/개별서류정리/진정취하서양식(new).hwp').includes('임금체불·진정'));
  assert.ok(hit('3. 체당금자료/2.소액체당금/소액체당금 지급청구서.hwp').includes('대지급금'));
  assert.ok(hit('3. 체당금자료/가압류 및 배당/2.채권계산서-하나텍.hwp').includes('민사·집행'));
  assert.ok(hit('2. 임금체불/개별서류정리/노무사위임장(집단위임장포함).hwp').includes('수임·위임'));
});
