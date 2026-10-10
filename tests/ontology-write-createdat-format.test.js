/* createdAt 없던 레코드에 도장을 찍을 때의 «모양» 규칙 (2026-10-10, 업체 6건 localeCompare 사고).
 * 업체는 글자(ISO)로 저장·비교한다. 숫자를 찍으면 (a.createdAt||'').localeCompare 가 죽는다.
 * 있던 createdAt 은 어떤 경우에도 그대로 둔다. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const W = require('../js/pu-ontology-write.js');

const NOW = Date.UTC(2026, 9, 10, 3, 4, 5); // 시각은 임의 — 규칙은 «모양»
const ISO = new Date(NOW).toISOString();

test('업체(Organization)에 createdAt 이 없으면 ISO 글자로 찍는다', () => {
  const p = W.prepareRecord({ id: 'co-real-1', name: 'x' }, {
    entityType: 'Organization', previous: { id: 'co-real-1', name: 'x' }, expectedRevision: 0, now: NOW, allowPendingCompany: true });
  assert.equal(p.ok, true);
  assert.equal(typeof p.value.createdAt, 'string');
  assert.equal(p.value.createdAt, ISO);
  assert.equal(p.value.createdAt.localeCompare('2026-01-01') > 0, true); // 정렬이 죽지 않는다
});

test('이미 있는 createdAt 은 글자든 숫자든 건드리지 않는다', () => {
  ['2025-03-04T01:02:03.000Z', '2025-03-04', 1700000000000].forEach(v => {
    const p = W.prepareRecord({ id: 'a' }, { entityType: 'Organization',
      previous: { id: 'a', createdAt: v, revision: 2 }, expectedRevision: 2, now: NOW });
    assert.equal(p.value.createdAt, v);
    const q = W.prepareRecord({ id: 'a', createdAt: v }, { entityType: 'Case', now: NOW });
    assert.equal(q.value.createdAt, v);
  });
});

test('글자 updatedAt 을 쓰는 레코드는 ISO, 숫자 저장소(캘린더 등)는 숫자 그대로', () => {
  const s = W.prepareRecord({ id: 'a', updatedAt: '2026-01-01' }, { entityType: 'Case', now: NOW });
  assert.equal(s.value.createdAt, ISO);
  const n = W.prepareRecord({ id: 'b' }, { entityType: 'Case', now: NOW });
  assert.equal(typeof n.value.createdAt, 'number');
});

test('timeFormat 옵션이 먼저다', () => {
  assert.equal(W.prepareRecord({ id: 'a' }, { entityType: 'Organization', timeFormat: 'number', now: NOW }).value.createdAt, NOW);
  assert.equal(W.prepareRecord({ id: 'a' }, { entityType: 'Case', timeFormat: 'iso', now: NOW }).value.createdAt, ISO);
});

test('서버 쪽 업체 도장(functions/mail-fill.js)도 같은 규칙 — 숫자 createdAt 을 찍지 않는다', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'functions', 'mail-fill.js'), 'utf8');
  assert.match(src, /out\.createdAt\s*=\s*cur\.createdAt\s*!=\s*null\s*\?\s*cur\.createdAt\s*:\s*new Date\(now\)\.toISOString\(\)/);
});

test('캘린더 관문은 이알피 근태(attendance_records)에 ISO 를 지정한다', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'pu-cal-write.js'), 'utf8');
  assert.match(src, /table\s*===\s*'attendance_records'\)\s*ctx\.timeFormat\s*=\s*'iso'/);
  assert.match(src, /timeFormat:\s*table\s*===\s*'attendance_records'\s*\?\s*'iso'/);
});
