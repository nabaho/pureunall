/* 새 비밀번호 규칙 — 이알피(pu-erp.html)와 로그인 화면(enter.html)이 «같은 규칙»을 쓴다 (2026-11-01 개인정보 4단계)
   ■ 왜 — 변경창이 4자(이알피)·6자(로그인 화면)만 받아 «1234» 같은 비밀번호로 바꿀 수 있었다. 로그인은 사번@pureun.kr 꼴이라
     비밀번호가 곧 계정의 전부다. 길이를 10자로 올리고, 가장 흔한 값과 아이디가 든 값을 막는다.
   ■ 클라이언트 검사다 — 서버가 대신 막아 주지 않는다(파이어베이스 최소 길이는 6자). 그래서 규칙을 한 파일에 둔다.
   ⚠ 규칙을 «약하게» 고치지 말 것 — 검사(tests/pw-policy.test.js)가 길이·흔한 값·아이디 포함을 막는다. */
(function (global) {
  'use strict';
  var MIN_LEN = 10;

  /* 약하면 «이유 문장», 괜찮으면 '' — id 는 사번(P-001)·로그인 이메일 어느 쪽이든, cur 는 현재 비밀번호(같으면 거절) */
  function weakReason(pw, id, cur) {
    pw = String(pw == null ? '' : pw);
    if (pw.length < MIN_LEN) return '새 비밀번호는 ' + MIN_LEN + '자 이상이어야 합니다.';
    if (/^(.)\1+$/.test(pw)) return '같은 글자만 반복한 비밀번호는 쓸 수 없습니다.';
    var low = pw.toLowerCase();
    if (/123456|654321|1234567890|qwerty|password|abcdef/.test(low)) return '123456 같은 흔한 값이 들어간 비밀번호는 쓸 수 없습니다.';
    var idc = String(id == null ? '' : id).toLowerCase().replace(/@.*$/, '').replace(/[^a-z0-9]/g, '');
    if (idc.length >= 3 && low.indexOf(idc) >= 0) return '아이디(사번)가 들어간 비밀번호는 쓸 수 없습니다.';
    if (cur != null && String(cur) === pw) return '현재 비밀번호와 다른 비밀번호를 입력하세요.';
    return '';
  }

  var api = { MIN_LEN: MIN_LEN, weakReason: weakReason };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.PuPwPolicy = api;
})(typeof window !== 'undefined' ? window : globalThis);
