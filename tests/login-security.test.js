'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const LS = require('../functions/login-security');

test('lastIp — X-Forwarded-For 맨 뒤 것만 쓴다(구글이 직접 본 IP)', () => {
  // ⚠ 견본의 «차례»가 뜻을 지닌다: 앞쪽 두 개는 부르는 쪽이 적어 보낼 수 있는 값이고,
  //   구글 앞단(GFE)이 실제로 본 IP 는 맨 뒤에 붙는다. 그래서 맨 뒤가 이겨야 한다.
  assert.equal(LS.lastIp('198.51.100.7, 10.0.0.1, 203.0.113.9'), '203.0.113.9');
  assert.equal(LS.lastIp('  203.0.113.9  '), '203.0.113.9');
  assert.equal(LS.lastIp(''), '');
  assert.equal(LS.lastIp(undefined), '');
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

test('parseAttempt — RTDB 경로에 못 쓰는 글자가 섞인 기기ID는 거절', () => {
  // . # $ [ ] / 는 실시간DB 열쇠에 못 쓴다 — 통과시키면 update() 가 예외를 던지고
  // 그 예외가 알림 만들기까지 삼켜 감지가 통째로 «조용히» 멎는다.
  ['dev.1', 'dev#1', 'dev$1', 'dev[1]', 'dev/1', '기기1', 'dev 1'].forEach((bad) => {
    assert.equal(LS.parseAttempt({ email: 'a@pureun.kr', deviceId: bad }).valid, false, bad);
  });
  assert.equal(LS.parseAttempt({ email: 'a@pureun.kr', deviceId: 'x'.repeat(65) }).valid, false, '너무 긴 것도 거절');
  // 멀쩡한 모양(enter.html 생성기가 만드는 꼴)은 그대로 통과한다
  ['dev-1', 'no-storage-mfa1b2', 'mfa1b2c3k9q0z', 'a_B-9'].forEach((good) => {
    assert.equal(LS.parseAttempt({ email: 'a@pureun.kr', deviceId: good }).valid, true, good);
  });
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

test('nextBurst — 「이미 알렸다」 표시를 같은 창 안에서는 이어받고, 리셋·새 창에서는 지운다', () => {
  const t0 = 1_000_000;
  const carried = LS.nextBurst({ count: 5, windowStartAt: t0, alerted: true }, t0 + 60_000, false);
  assert.equal(carried.alerted, true, '같은 창 안에서는 이어받는다');

  const rolled = LS.nextBurst({ count: 5, windowStartAt: t0, alerted: true }, t0 + LS.FAIL_WINDOW_MS + 1, false);
  assert.equal(rolled.alerted, false, '창이 새로 열리면 다시 울릴 수 있다');

  const reset = LS.nextBurst({ count: 5, windowStartAt: t0, alerted: true }, t0 + 60_000, true);
  assert.equal(reset.alerted, false, '성공하면 표시도 함께 지운다');
});

test('burstAlertDue — 문턱을 «넘는 순간»에만 울리고, 그 뒤로는 안 울린다', () => {
  const t0 = 1_000_000;

  // ① 문턱 바로 앞까지는 조용하다
  let prev = { count: LS.FAIL_THRESHOLD - 2, windowStartAt: t0, alerted: false };
  let now = LS.nextBurst(prev, t0 + 1_000, false);
  assert.equal(LS.burstAlertDue(prev, now), false, '아직 문턱 아래');

  // ② 문턱을 넘는 그 한 번만 울린다
  prev = { count: LS.FAIL_THRESHOLD - 1, windowStartAt: t0, alerted: false };
  now = LS.nextBurst(prev, t0 + 2_000, false);
  assert.equal(LS.burstAlertDue(prev, now), true, '넘는 순간 한 번');

  // ③ 울린 뒤에는 같은 묶음 안에서 아무리 더 두드려도 다시 안 울린다
  //    (부르는 쪽이 alerted:true 를 저장해 둔 상태를 그대로 흉내 낸다)
  prev = Object.assign({}, now, { alerted: true });
  for (let i = 0; i < 20; i += 1) {
    now = LS.nextBurst(prev, t0 + 3_000 + i, false);
    assert.equal(LS.burstAlertDue(prev, now), false, '같은 묶음에서는 다시 안 울린다');
    prev = Object.assign({}, now, { alerted: true });
  }

  // ④ 성공으로 리셋된 뒤 다시 문턱을 넘으면 그때는 울린다
  let after = LS.nextBurst(prev, t0 + 10_000, true);
  assert.equal(after.count, 0);
  for (let i = 0; i < LS.FAIL_THRESHOLD; i += 1) {
    const before = after;
    after = LS.nextBurst(before, t0 + 11_000 + i, false);
    const due = LS.burstAlertDue(before, after);
    assert.equal(due, i === LS.FAIL_THRESHOLD - 1, '리셋 뒤 다시 문턱을 넘을 때 한 번');
  }
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
    assert.ok(a.detail.includes('1.2.3.4'), 'detail에 IP 포함');
    assert.ok(a.detail.includes('US'), 'detail에 국가 포함');
    assert.ok(a.detail.includes('UA'), 'detail에 UA 포함');
  });
  assert.deepEqual(all.map((a) => a.kind).sort(),
    ['security-burst', 'security-country', 'security-device']);
});

test('buildAlerts — detail 필드의 (모름) 대체경로', () => {
  const noIp = LS.buildAlerts({
    uid: 'u2', email: 'b@pureun.kr', deviceIsNew: true, countryIsNew: false,
    burstSuspicious: false, country: '', ip: '', ua: '', failCount: 0,
  });
  assert.equal(noIp.length, 1);
  assert.ok(noIp[0].detail.includes('(모름)'), 'IP가 없으면 (모름) 표시');
  assert.ok(!noIp[0].detail.includes(' · 국가'), 'country가 없으면 국가 부분 생략');
  assert.ok(!noIp[0].detail.includes(' · ') || noIp[0].detail.indexOf(' · ') === noIp[0].detail.lastIndexOf(' · '), 'UA가 없으면 마지막 · 생략');
});
