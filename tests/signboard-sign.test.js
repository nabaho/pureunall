/* 전광판 심부름꾼 — 서명(HMAC-MD5) (2026-10-12)
   값 자체가 규칙이다: 아래 시험 값은 HMAC-MD5 표준(RFC 2202)의 공개 시험 벡터라 박는 게 맞다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../scripts/signboard-agent/sign.js');

test('HMAC-MD5 가 표준 시험 벡터와 같다', () => {
  /* 검사고정-허용: RFC 2202 시험 벡터 — 값 자체가 규칙이다 */
  assert.equal(S.hmacMd5Hex('what do ya want for nothing?', 'Jefe'), '750c783e6ab0b503eaa86e310a5db738');
  assert.equal(S.hmacMd5Hex('Hi There', Buffer.alloc(16, 0x0b).toString('latin1')), '9294727a3638bb1c13f48ef8158bfc9d');
});

test('규칙1 은 본문+키+날짜를, 규칙2 는 키+날짜만 서명한다', () => {
  const body = '{"method":"getAll"}', key = 'K', date = 'D', secret = 'S';
  assert.equal(S.signGeneral(body, key, date, secret), S.hmacMd5Hex(body + key + date, secret));
  assert.equal(S.signFile(key, date, secret), S.hmacMd5Hex(key + date, secret));
  assert.notEqual(S.signGeneral(body, key, date, secret), S.signFile(key, date, secret));
});

test('날짜 머리글 두 가지 모양', () => {
  const ms = Date.UTC(2023, 7, 9, 7, 27, 44);
  assert.equal(S.formatDate(ms, 'rfc1123'), 'Wed, 09 Aug 2023 07:27:44 GMT');
  assert.equal(S.formatDate(ms, 'java'), 'Wed Aug 09 07:27:44 GMT 2023');
});

test('머리글 — 서명이 «실제로 보낸 날짜 글자»로 계산되고, 비밀은 어디에도 없다', () => {
  const h = S.buildHeaders({ requestId: 'r1', sdkKey: 'KEY', sdkSecret: 'SECRET-VALUE', body: '{"a":1}', now: Date.UTC(2026, 9, 12), dateStyle: 'rfc1123' });
  assert.equal(h.sign, S.signGeneral('{"a":1}', 'KEY', h.date, 'SECRET-VALUE'));
  assert.equal(JSON.stringify(h).includes('SECRET-VALUE'), false);
  const f = S.buildHeaders({ requestId: 'r2', sdkKey: 'KEY', sdkSecret: 'SECRET-VALUE', file: true, now: Date.UTC(2026, 9, 12) });
  assert.equal(f.sign, S.signFile('KEY', f.date, 'SECRET-VALUE'));
});
