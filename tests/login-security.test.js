'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const LS = require('../functions/login-security');

test('firstIp — X-Forwarded-For 맨 앞 것만 쓴다', () => {
  assert.equal(LS.firstIp('203.0.113.9, 10.0.0.1, 10.0.0.2'), '203.0.113.9');
  assert.equal(LS.firstIp('  203.0.113.9  '), '203.0.113.9');
  assert.equal(LS.firstIp(''), '');
  assert.equal(LS.firstIp(undefined), '');
});

test('parseAttempt — 정상 입력', () => {
  const r = LS.parseAttempt({
    email: 'P001@Pureun.kr', deviceId: 'dev-1', ua: 'Mozilla/5.0', ok: true, code: '',
  });
  assert.equal(r.valid, true);
  assert.equal(r.email, 'p001@pureun.kr');   // 소문자로 통일
  assert.equal(r.deviceId, 'dev-1');
  assert.equal(r.ok, true);
});

test('parseAttempt — 이메일이 없거나 이상하면 거절', () => {
  assert.equal(LS.parseAttempt({ deviceId: 'd', email: '' }).valid, false);
  assert.equal(LS.parseAttempt({ deviceId: 'd', email: '이메일아님' }).valid, false);
  assert.equal(LS.parseAttempt(null).valid, false);
});

test('parseAttempt — 기기ID가 없으면 거절', () => {
  assert.equal(LS.parseAttempt({ email: 'a@pureun.kr', deviceId: '' }).valid, false);
});

test('parseAttempt — ua 는 150자로 자른다', () => {
  const long = 'x'.repeat(300);
  const r = LS.parseAttempt({ email: 'a@pureun.kr', deviceId: 'd', ua: long });
  assert.equal(r.ua.length, 150);
});
