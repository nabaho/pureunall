/* 반복 작업이 큰 대기열을 통째로 읽지 않도록 배선과 보안규칙을 함께 확인한다. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const fn = fs.readFileSync(path.join(__dirname, '../functions/index.js'), 'utf8');
const rules = require('../docs/firebase-rules-전체-적용본.json').rules;

function body(name, next) {
  const start = fn.indexOf('exports.' + name + ' =');
  assert.ok(start >= 0, name + ' 함수를 못 찾았다');
  const end = next ? fn.indexOf('exports.' + next + ' =', start + 1) : fn.indexOf('\nexports.', start + 1);
  return fn.slice(start, end >= 0 ? end : undefined);
}

test('예약 발송은 시각 색인으로 기한이 된 줄만 읽는다', () => {
  assert.match(body('sendScheduledMail'), /orderByChild\("at"\)\.endAt\(now\)\.limitToFirst\(/);
  assert.deepEqual(rules.pucards.scheduled['.indexOn'], ['at', 'bulk']);
  assert.equal(rules.pucards.scheduled['.write'], rules.pucards.items['.write'], '이름 붙인 칸의 기존 쓰기 권한을 유지한다');
  assert.deepEqual(rules.pucards.scheduled.$k2, rules.pucards.items.$k2, '예약줄 하위 쓰기 권한을 유지한다');
});

test('뉴스레터 감시 두 곳은 해당 회차의 대기열만 받는다', () => {
  for (const name of ['newsletterBounceScan', 'newsletterWatchDelivery']) {
    const b = body(name);
    assert.match(b, /orderByChild\("bulk"\)\.equalTo\(String\(/, name + '가 대기열 전체를 읽는다');
    assert.doesNotMatch(b, /scheduled"\)\.once\("value"\)/);
  }
});

test('입금 알림의 서버 조회에도 색인만 추가하고 공개 권한은 추가하지 않는다', () => {
  assert.deepEqual(rules.hanaSmsBridge.adminAlerts['.indexOn'], ['receivedAt']);
  assert.equal(rules.hanaSmsBridge['.read'], undefined);
  assert.equal(rules.hanaSmsBridge['.write'], undefined);
});
