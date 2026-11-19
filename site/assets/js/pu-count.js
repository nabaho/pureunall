/* 홈페이지 방문 셈 — «숫자만» 보낸다 (대표 지시 2026-11-19 「추천대로」 — 방문 통계 자체 집계)
   보내는 것: 쪽 이름(work1·notice …) · 어디서 왔나(검색엔진 이름 같은 갈래) · 폰/PC · 쪽 보기/상담 전화 누름 · 이 방문의 첫 쪽인가.
   ★ 쿠키를 쓰지 않는다. 사람을 알아볼 값(아이디·주소·글)을 보내지 않는다. 받는 서버도 IP 를 적지 않는다(functions/site-stats.js).
   ★ «이 방문의 첫 쪽»은 창을 닫으면 지워지는 표시(sessionStorage)로만 안다 — 남지 않는다.
   ★ 우리 홈페이지 주소에서만 돈다 — ERP 의 사본·미리보기·로컬에서는 안 센다. 자동으로 돌리는 브라우저(검사·로봇)도 안 센다.
   ★ 실패해도 아무 일 없다 — 홈페이지가 느려지거나 오류를 보이면 안 된다.
   유입 갈래 이름은 functions/site-stats.js 의 유입갈래와 같아야 한다(다르면 서버가 버린다). */
(function () {
  'use strict';
  var 받는곳 = 'https://us-central1-pureun-erp.cloudfunctions.net/siteHit';
  try {
    var 집 = String(location.hostname || '').toLowerCase();
    if (집 !== 'pureunlabor.co.kr' && 집 !== 'www.pureunlabor.co.kr') return;
    if (navigator.webdriver) return;
    if (/bot|crawl|spider|slurp|headless|lighthouse|preview/i.test(navigator.userAgent || '')) return;
  } catch (e) { return; }

  function 쪽() {
    var 조각 = String(location.pathname || '/').split('/').filter(Boolean);
    if (!조각.length || /^index\.html?$/i.test(조각[0])) return 'home';
    var k = 조각[0].toLowerCase();
    return /^[a-z0-9_]{1,30}$/.test(k) ? k : 'other';
  }
  function 들어온곳() {
    var r = '';
    try { r = document.referrer || ''; } catch (e) { r = ''; }
    if (!r) return 'direct';
    var h = '';
    try { h = new URL(r).hostname.toLowerCase(); } catch (e) { return 'other'; }
    if (/^mail\./.test(h) || /(^|\.)erp\.pureunlabor\.co\.kr$/.test(h) || /(^|\.)nabaho\.github\.io$/.test(h)) return 'erp';
    if (/(^|\.)pureunlabor\.co\.kr$/.test(h)) return 'self';
    if (/(^|\.)search\.naver\.com$/.test(h)) return 'naver';
    if (/(^|\.)naver\.com$/.test(h)) return 'naverx';
    if (/(^|\.)google\.[a-z.]+$/.test(h)) return 'google';
    if (/(^|\.)daum\.net$/.test(h)) return 'daum';
    if (/(^|\.)bing\.com$/.test(h)) return 'bing';
    if (/(^|\.)kakao\.com$/.test(h) || /(^|\.)kakaocdn\.net$/.test(h)) return 'kakao';
    if (/(^|\.)(facebook\.com|instagram\.com|youtube\.com|t\.co|x\.com|twitter\.com|band\.us|linkedin\.com|threads\.net)$/.test(h)) return 'sns';
    return 'other';
  }
  function 기기() {
    try { if (/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '')) return 'm'; } catch (e) { /* 무시 */ }
    return 'pc';
  }
  var 곳 = 들어온곳();
  var 새방문 = 0;
  try {
    if (!sessionStorage.getItem('puVisit')) { sessionStorage.setItem('puVisit', '1'); 새방문 = 곳 === 'self' ? 0 : 1; }
  } catch (e) {
    새방문 = 곳 === 'self' ? 0 : 1;    // 표시를 못 쓰는 브라우저 — 밖에서 들어온 쪽만 새 방문으로
  }
  function 보내기(행동) {
    var 글 = JSON.stringify({ p: 쪽(), r: 곳, d: 기기(), e: 행동, v: 행동 === 'view' ? 새방문 : 0 });
    try {
      if (navigator.sendBeacon && navigator.sendBeacon(받는곳, new Blob([글], { type: 'text/plain' }))) return;
    } catch (e) { /* 아래 길로 */ }
    try { fetch(받는곳, { method: 'POST', body: 글, keepalive: true, mode: 'no-cors', headers: { 'Content-Type': 'text/plain' } }); }
    catch (e) { /* 못 보내도 그만 */ }
  }
  보내기('view');
  /* 상담 전화 누름 — 전화번호(tel:) 링크를 누를 때 한 번 */
  document.addEventListener('click', function (ev) {
    var t = ev.target;
    var a = t && t.closest ? t.closest('a[href^="tel:"]') : null;
    if (a) 보내기('tel');
  }, true);
})();
