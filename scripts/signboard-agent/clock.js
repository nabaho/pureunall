'use strict';
/* clock.js — 장비 시계가 한국 시간·실제 시각과 맞는가 (설계서 §7)
   기간 예약(날짜·시간대)은 «장비 시계»로 지켜진다. 중국 시간(UTC+8)으로 맞춰 있으면 1시간 어긋난다 — 알리기만 한다. */
function analyzeClock(props, nowMs) {
  props = props || {};
  const tz = /UTC([+-])(\d{2}):(\d{2})/.exec(String(props['time.timeZone'] || ''));
  const t = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(String(props.time || ''));
  if (!tz || !t) return { known: false };
  const offsetMin = (tz[1] === '-' ? -1 : 1) * (Number(tz[2]) * 60 + Number(tz[3]));
  const deviceUtc = Date.UTC(+t[1], +t[2] - 1, +t[3], +t[4], +t[5], +t[6]) - offsetMin * 60000;
  return { known: true, offsetMin: offsetMin, tzIsKst: offsetMin === 540, skewSec: Math.round((deviceUtc - nowMs) / 1000) };
}
/* 화면에 띄울 경고 글(없으면 빈 문자열) */
function clockWarning(c) {
  if (!c || !c.known) return '장비 시계를 읽지 못했습니다';
  const w = [];
  if (!c.tzIsKst) w.push('장비 시간대가 한국(UTC+9)이 아닙니다 — 기간 예약이 어긋납니다');
  if (Math.abs(c.skewSec) > 120) w.push('장비 시계가 실제와 ' + Math.round(Math.abs(c.skewSec) / 60) + '분 어긋나 있습니다');
  return w.join(' / ');
}
module.exports = { analyzeClock, clockWarning };
