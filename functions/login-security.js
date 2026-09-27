/* 로그인 무단시도 감지 — 값 다루는 부분만(순수 함수, 서버 I/O 없음).
   설계문서: docs/superpowers/specs/2026-09-20-login-security-monitoring-design.md
   ⚠ 여기서는 Firebase·geoip 를 부르지 않는다 — 그래야 실제 값 그대로 단위테스트할 수 있다
     (functions/billing-alert.js 와 같은 이유). 네트워크·DB 는 functions/index.js 가 맡는다. */
'use strict';

/* X-Forwarded-For 는 «맨 뒤» 것을 쓴다 (2026-09-20 보안검토 IMPORTANT 4).
   구글 앞단(GFE)은 자기가 실제로 본 클라이언트 IP 를 이 머리글 «뒤에» 덧붙인다.
   앞쪽 항목은 부르는 쪽이 마음대로 적어 보낼 수 있는 값이라 믿을 수 없다 —
   맨 앞을 쓰면 침입자가 적어 넣은 가짜 IP 로 국가를 판정하게 된다.
   맨 뒤를 쓰면 «구글이 직접 본 것»만 믿는다.
   ⚠ IAM 권한 문제(별건)가 풀려 이 함수를 실제로 부를 수 있게 되면,
     살아 있는 요청 하나를 찍어 이 순서를 다시 확인할 것. */
function lastIp(forwardedFor) {
  const parts = String(forwardedFor || '').split(',');
  return String(parts[parts.length - 1] || '').trim();
}

/* 기기ID 는 RTDB 경로의 한 칸으로 그대로 쓰인다. . # $ [ ] / 가 섞이면
   db.ref().update() 가 통째로 예외를 던지고, 그 예외가 알림 만들기까지 삼켜
   기기·국가·연속실패 판정이 «조용히» 멎는다 (2026-09-20 보안검토 IMPORTANT 6).
   그래서 모양부터 막는다.
   enter.html 의 생성기는 toString(36)(0-9·a-z)과 붙임표만 쓰므로 이 그물에 안 걸린다. */
const DEVICE_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

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
  if (!DEVICE_ID_RE.test(deviceId)) {
    return { valid: false, why: '기기ID 형식이 올바르지 않습니다' };
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

/* 연속실패 묶음은 «이미 알렸는가»(alerted)를 함께 지고 다닌다 — 알림이 한 번만
   울리게 하려고(아래 burstAlertDue 참고). 리셋될 때(성공)와 창이 새로 열릴 때는
   false 로 되돌리고, 같은 창 안에서는 앞의 값을 그대로 이어받는다. */
function nextBurst(prevBurst, nowMs, ok) {
  if (ok) return { count: 0, windowStartAt: nowMs, alerted: false };
  const prev = (prevBurst && typeof prevBurst === 'object') ? prevBurst : null;
  const withinWindow = !!prev && (nowMs - prev.windowStartAt) < FAIL_WINDOW_MS;
  return {
    count: withinWindow ? prev.count + 1 : 1,
    windowStartAt: withinWindow ? prev.windowStartAt : nowMs,
    alerted: withinWindow ? (prev.alerted === true) : false,
  };
}

function burstIsSuspicious(burst) {
  return !!burst && burst.count >= FAIL_THRESHOLD;
}

/* 알림은 «문턱을 넘는 그 순간» 한 번만 울린다 (2026-09-20 보안검토 IMPORTANT 3).
   예전에는 문턱을 넘은 뒤로는 요청마다 계속 울렸다 — 15분 안에 200번 두드리면
   알림이 196개 쌓인다. systemAlerts 는 다른 화면들도 통째로 읽어 쓰는 공용 판이라,
   그 한 번의 공격이 판 전체를 묻어 버린다.
   다시 울릴 수 있게 되는 때: 성공으로 리셋되거나 15분 창이 새로 열린 뒤 다시 문턱을 넘을 때. */
function burstAlertDue(prevBurst, newBurst) {
  const prevAlerted = !!(prevBurst && typeof prevBurst === 'object' && prevBurst.alerted === true);
  return !prevAlerted && burstIsSuspicious(newBurst);
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
  lastIp, parseAttempt,
  FAIL_WINDOW_MS, FAIL_THRESHOLD,
  isNewDevice, isNewCountry, nextBurst, burstIsSuspicious, burstAlertDue, buildAlerts,
};
