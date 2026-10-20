/* 👤 직원 이름표 — 이름만, 같은 이름 재직자가 둘 이상일 때만 사번 (대표 지시 2026-10-19)
   ════════════════════════════════════════════════════════════════════════
   「푸른 통합시스템 모든곳에 권형하를 넣으면 p001 이 나온다 … 검토해라」 → 「추천대로 진행」.

   ■ 규칙
     · 고르는 목록·화면 글자에는 «이름»만 쓴다 — 일반 그룹웨어도 이름(+직위)만 보인다.
       좁은 칸에서 「권형하 · P-00」처럼 이름표가 잘리던 것도 함께 사라진다.
     · 같은 이름이 둘 이상이면 «그때만» 사번을 붙인다 — 「권형하 · P-001」. 고를 때 헷갈리면 안 된다.
     · 이름을 모르면 사번을 그대로 보인다 — 빈칸보다 낫다.
   ⚠ 값(value)·저장은 여전히 사번이다 — 바뀌는 것은 «보이는 글자»뿐이다(온톨로지: 사람은 sid 로 잇는다).
   ⚠ 그대로 두는 곳: 내 신원 표시(포털 머리·pu-whoami — 잘못 로그인 알아채기, 2026-08-10·09-12 대표 결정),
     인사·급여·권한 화면의 사번 칸, 임금명세서의 사번 칸(근로기준법 시행령 제27조의2 «사원번호 등»).
   ⚠ 동명이인 판단 범위(list)는 «그 화면이 다루는 사람 전체»로 준다 — 목록에서 빠진 사람(주담당 등)과
     이름이 같아도 헷갈리기 때문이다. */
(function (root) {
  'use strict';

  function nm(u) { return String((u && u.name) || '').trim(); }

  /* list 안에서 이름이 둘 이상 겹치는 이름들 → { 이름: true } */
  function dupNames(list) {
    var seen = {}, dup = {};
    (list || []).forEach(function (u) {
      var k = nm(u);
      if (!k) return;
      if (seen[k] && seen[k] !== String((u && u.sid) || '')) dup[k] = true;
      if (!seen[k]) seen[k] = String((u && u.sid) || '') || '?';
    });
    return dup;
  }

  /* u 의 이름표. list = 같은 이름을 견줄 사람들(없으면 견주지 않는다) */
  function label(u, list) {
    var n = nm(u), sid = String((u && u.sid) || '');
    if (!n) return sid;
    return (sid && dupNames(list)[n]) ? n + ' · ' + sid : n;
  }

  var api = { label: label, dupNames: dupNames };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PuStaffLabel = api;
})(typeof window !== 'undefined' ? window : this);
