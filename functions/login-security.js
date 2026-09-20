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

// 검사고정-허용: 설계문서 §5 승인 문턱값 — 15분 안에 비밀번호 5회 연속 실패
const FAIL_WINDOW_MS = 15 * 60 * 1000;
const FAIL_THRESHOLD = 5;

function isNewDevice(knownDevices, deviceId) {
  const known = knownDevices || {};
  const hasBaseline = Object.keys(known).length > 0;
  return hasBaseline && !known[deviceId];
}

function isNewCountry(knownCountries, country) {
  if (!country) return false;                 // 모르면 의심하지 않는다
  const known = knownCountries || {};
  const hasBaseline = Object.keys(known).length > 0;
  return hasBaseline && !known[country];
}

function nextBurst(prevBurst, nowMs, ok) {
  if (ok) return { count: 0, windowStartAt: nowMs };
  const prev = (prevBurst && typeof prevBurst === 'object') ? prevBurst : null;
  const withinWindow = !!prev && (nowMs - prev.windowStartAt) < FAIL_WINDOW_MS;
  return {
    count: withinWindow ? prev.count + 1 : 1,
    windowStartAt: withinWindow ? prev.windowStartAt : nowMs,
  };
}

function burstIsSuspicious(burst) {
  return !!burst && burst.count >= FAIL_THRESHOLD;
}

function buildAlerts(input) {
  const alerts = [];
  const detail = 'IP ' + (input.ip || '(모름)')
    + (input.country ? ' · 국가 ' + input.country : '')
    + (input.ua ? ' · ' + input.ua : '');
  if (input.deviceIsNew) {
    alerts.push({ kind: 'security-device', message: '처음 보는 기기에서 로그인 성공 (' + input.email + ')' });
  }
  if (input.countryIsNew) {
    alerts.push({ kind: 'security-country', message: '평소와 다른 국가에서 로그인 성공: ' + input.country + ' (' + input.email + ')' });
  }
  if (input.burstSuspicious) {
    alerts.push({ kind: 'security-burst', message: '짧은 시간에 비밀번호 ' + input.failCount + '회 연속 실패 (' + input.email + ')' });
  }
  return alerts.map((a) => Object.assign(
    { uid: input.uid, email: input.email, page: 'enter.html', status: 'new', detail },
    a,
  ));
}

module.exports = {
  firstIp, parseAttempt,
  FAIL_WINDOW_MS, FAIL_THRESHOLD,
  isNewDevice, isNewCountry, nextBurst, burstIsSuspicious, buildAlerts,
};
