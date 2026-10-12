'use strict';
/* sign.js — 灰度 공식 통로의 서명 (설계서 §7)
   규칙1(일반)  sign = HMACMD5(body + sdkKey + date, sdkSecret)
   규칙2(파일)  sign = HMACMD5(sdkKey + date, sdkSecret)
   ⚠ sdkSecret 은 서명에만 쓰고 어디에도 보내거나 찍지 않는다. */
const crypto = require('node:crypto');

function hmacMd5Hex(data, secret) {
  return crypto.createHmac('md5', String(secret)).update(String(data), 'utf8').digest('hex');
}
function signGeneral(body, sdkKey, date, secret) { return hmacMd5Hex(body + sdkKey + date, secret); }
function signFile(sdkKey, date, secret) { return hmacMd5Hex(sdkKey + date, secret); }

/* date 머리글 모양 — 공식 문서 예시는 RFC 1123("Wed, 09 Aug 2023 07:27:44 GMT"),
   공식 파이썬 SDK 는 자바식("Wed Aug 09 07:27:44 GMT 2023")이다. 장비가 어느 쪽을 받는지는 실제 장비로 확인한다(설계서 §7 [확인 필요]).
   서명은 «보낸 그 글자»로 계산하므로 어느 쪽이든 서명은 맞는다. */
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function formatDate(ms, style) {
  if (style === 'java') {
    const d = new Date(ms), p = (n) => String(n).padStart(2, '0');
    return DAYS[d.getUTCDay()] + ' ' + MONTHS[d.getUTCMonth()] + ' ' + p(d.getUTCDate()) + ' ' + p(d.getUTCHours()) + ':' + p(d.getUTCMinutes()) + ':' + p(d.getUTCSeconds()) + ' GMT ' + d.getUTCFullYear();
  }
  return new Date(ms).toUTCString();
}

/* 요청 머리글을 만든다. body 가 문자열이면 규칙1, file:true 면 규칙2 */
function buildHeaders(o) {
  const date = formatDate(o.now, o.dateStyle);
  const h = { requestId: o.requestId, sdkKey: o.sdkKey, date: date };
  h.sign = o.file ? signFile(o.sdkKey, date, o.sdkSecret) : signGeneral(o.body == null ? '' : o.body, o.sdkKey, date, o.sdkSecret);
  return h;
}

module.exports = { hmacMd5Hex, signGeneral, signFile, formatDate, buildHeaders };
