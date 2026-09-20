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

test('isNewDevice — 이미 기록이 있는 계정에서만 "새 기기"로 본다', () => {
  assert.equal(LS.isNewDevice({}, 'dev-1'), false, '처음 로그인은 기준선일 뿐 의심 아님');
  assert.equal(LS.isNewDevice({ 'dev-1': { firstSeenAt: 1 } }, 'dev-1'), false, '아는 기기');
  assert.equal(LS.isNewDevice({ 'dev-1': { firstSeenAt: 1 } }, 'dev-2'), true, '모르는 기기');
});

test('isNewCountry — 국가를 모르면(빈 문자열) 의심하지 않는다', () => {
  assert.equal(LS.isNewCountry({ KR: { firstSeenAt: 1 } }, ''), false);
  assert.equal(LS.isNewCountry({}, 'KR'), false, '기준선');
  assert.equal(LS.isNewCountry({ KR: { firstSeenAt: 1 } }, 'US'), true);
});

test('nextBurst — 성공하면 그 자리에서 리셋', () => {
  const r = LS.nextBurst({ count: 4, windowStartAt: 1000 }, 2000, true);
  assert.equal(r.count, 0);
});

test('nextBurst — 창 안에서는 계속 쌓이고, 창을 벗어나면 새로 센다', () => {
  const t0 = 1_000_000;
  const within = LS.nextBurst({ count: 2, windowStartAt: t0 }, t0 + 60_000, false);
  assert.equal(within.count, 3);
  assert.equal(within.windowStartAt, t0);

  const after = LS.nextBurst({ count: 2, windowStartAt: t0 }, t0 + LS.FAIL_WINDOW_MS + 1, false);
  assert.equal(after.count, 1, '창을 벗어나면 1부터 다시');
});

// 검사고정-허용: 문턱값 자체가 설계문서 §5 의 승인된 규칙(15분/5회)이라 값으로 박는다.
test('burstIsSuspicious — 문턱을 채워야 의심(그 앞은 아직 아님)', () => {
  const justBelow = { count: LS.FAIL_THRESHOLD - 1, windowStartAt: 0 };
  const atThreshold = { count: LS.FAIL_THRESHOLD, windowStartAt: 0 };
  assert.equal(LS.burstIsSuspicious(justBelow), false);
  assert.equal(LS.burstIsSuspicious(atThreshold), true);
  assert.equal(LS.FAIL_THRESHOLD, 5);          // 검사고정-허용: 설계문서 §5 승인값
  assert.equal(LS.FAIL_WINDOW_MS, 15 * 60 * 1000); // 검사고정-허용: 설계문서 §5 승인값(15분)
});

test('buildAlerts — 걸린 것만 담고, 공통 자리(uid/email/page/status)를 채운다', () => {
  const none = LS.buildAlerts({
    uid: 'u1', email: 'a@pureun.kr', deviceIsNew: false, countryIsNew: false,
    burstSuspicious: false, country: '', ip: '1.2.3.4', ua: 'UA', failCount: 0,
  });
  assert.deepEqual(none, []);

  const all = LS.buildAlerts({
    uid: 'u1', email: 'a@pureun.kr', deviceIsNew: true, countryIsNew: true,
    burstSuspicious: true, country: 'US', ip: '1.2.3.4', ua: 'UA', failCount: 5,
  });
  assert.equal(all.length, 3);
  all.forEach((a) => {
    assert.equal(a.uid, 'u1');
    assert.equal(a.email, 'a@pureun.kr');
    assert.equal(a.page, 'enter.html');
    assert.equal(a.status, 'new');
    assert.ok(a.kind.indexOf('security-') === 0);
    assert.ok(a.message.length > 0);
  });
  assert.deepEqual(all.map((a) => a.kind).sort(),
    ['security-burst', 'security-country', 'security-device']);
});
