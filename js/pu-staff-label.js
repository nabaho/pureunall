/* 👤 직원 이름표 — 이름만. 같은 이름이면 직책으로 가른다. 사번은 안 쓴다 (대표 결정 2026-10-25 「이름만 있어야한다」)
   ════════════════════════════════════════════════════════════════════════
   2026-10-19 에는 「같은 이름 재직자가 둘 이상일 때만 이름 · 사번」이었다. 사번에서 로그인 아이디가 그대로
   만들어지므로(P-001 → p001@…) 화면 어디에도 사번을 안 적기로 하면서, 그 «예외»도 걷었다.

   ■ 규칙
     · 고르는 목록·화면 글자에는 «이름»만 쓴다 — 일반 그룹웨어도 이름(+직위)만 보인다.
     · 같은 이름이 둘 이상이면 «그때만» 직책을 붙인다 — 「권형하 (대표노무사)」. 직책도 같으면 「이름 (1)」「이름 (2)」
       (번호는 사번 순서 — 화면마다 같다). 사번 글자로 가르지 않는다.
     · 이름을 모르면 「이름 미확인」 — 사번을 대신 적지 않는다.
   ⚠ 값(value)·저장은 여전히 사번이다 — 바뀌는 것은 «보이는 글자»뿐이다(온톨로지: 사람은 sid 로 잇는다).
   ⚠ 동명이인 판단 범위(list)는 «그 화면이 다루는 사람 전체»로 준다. */
(function (root) {
  'use strict';

  function nm(u) { return String((u && u.name) || '').trim(); }

  function ttl(u) { return String((u && u.title) || '').trim(); }

  /* u 의 이름표. list = 같은 이름을 견줄 사람들(없으면 견주지 않는다)
     같은 이름이 둘 이상이면: 직책이 서로 다르면 「이름 (직책)」, 직책도 같으면 「이름 (1)」「이름 (2)」 —
     번호는 «사번 순서»라 화면마다 같다(사번 글자는 안 나온다). */
  function label(u, list) {
    var n = nm(u);
    if (!n) return '이름 미확인';
    var sid = String((u && u.sid) || '');
    var same = [], seen = {};
    (list || []).forEach(function (x) {
      var k = String((x && x.sid) || '') || '?';
      if (nm(x) === n && !seen[k]) { seen[k] = 1; same.push(x); }
    });
    if (same.length < 2) return n;
    var t = ttl(u);
    if (t && same.filter(function (x) { return ttl(x) === t; }).length === 1) return n + ' (' + t + ')';
    same.sort(function (x, y) { return String(x.sid || '') < String(y.sid || '') ? -1 : 1; });
    var i = 0;
    same.forEach(function (x, k) { if (String(x.sid || '') === sid) i = k + 1; });
    return n + ' (' + (i || '?') + ')';
  }

  var api = { label: label };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PuStaffLabel = api;
})(typeof window !== 'undefined' ? window : this);
