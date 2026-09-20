/* 로그인 무단시도 감지 — 값 다루는 부분만(순수 함수, 서버 I/O 없음).
   설계문서: docs/superpowers/specs/2026-09-20-login-security-monitoring-design.md
   ⚠ 여기서는 Firebase·geoip 를 부르지 않는다 — 그래야 실제 값 그대로 단위테스트할 수 있다
     (functions/billing-alert.js 와 같은 이유). 네트워크·DB 는 functions/index.js 가 맡는다. */
'use strict';

function firstIp(forwardedFor) {
  const raw = String(forwardedFor || '').split(',')[0].trim();
  return raw;
}

function parseAttempt(body) {
  const b = (body && typeof body === 'object') ? body : {};
  const email = String(b.email || '').trim().toLowerCase();
  const deviceId = String(b.deviceId || '').trim();
  const ua = String(b.ua || '').slice(0, 150);
  const ok = b.ok === true;
  const code = String(b.code || '').slice(0, 60);

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { valid: false, why: '이메일이 없거나 이상합니다' };
  }
  if (!deviceId) {
    return { valid: false, why: '기기ID가 없습니다' };
  }
  return { valid: true, email, deviceId, ua, ok, code };
}

module.exports = { firstIp, parseAttempt };
