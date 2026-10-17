/* 📮 우편번호 저절로 넣기 — 문자열로 화면을 그리는 앱(기금·경력관리)이 함께 쓴다
   (대표 지시 2026-10-17 「우편번호찾기 기능있는데 자동으로 니가 찾아서 항상 입력해라」)
   ════════════════════════════════════════════════════════════════════════

   주소는 있는데 우편번호가 비면, 서버(zipLookup — 카카오 주소검색)에 물어 우편번호 칸을 채운다.
   푸른이알피(pu-erp.html 의 erpZipFor·useAutoZip)와 «같은 규칙»이다 — 그쪽은 Preact 라
   훅으로 달았고, 여기는 입력칸(DOM)에 단다.

   ⚠★ 서버는 «한 곳으로 딱 떨어질 때만» 우편번호를 준다(functions/zip-lookup.js) — 갈리면
     안 넣고, 화면의 우편번호 찾기 단추가 그대로 남는다.
   ⚠ 주소 칸은 안 고친다 — 우편번호만 넣는다. 이미 적힌 우편번호도 안 덮는다.
   ⚠ 넣기 «직전»에 그때 주소가 지금도 같고 우편번호가 아직 비었는지 다시 본다 —
     기다리는 사이 사람이 고친 것을 덮지 않는다.
   ⚠ 서버로 가는 것은 주소 글자(q·key·alt)뿐이다(회사명·사람 이름은 안 간다).
   ⚠ 저장은 이 파일이 안 한다 — 칸에 넣은 «뒤» 무엇을 할지(저장·알림)는 앱이 정한다(done).

   쓰는 법:  PuZip.bind(주소칸, 우편번호칸, function(우편번호, 그때주소){ … 저장·알림 … })
   js/pu-addr.js 를 먼저 싣는다(찾을 말을 만든다). */
(function (root) {
  'use strict';

  var URL = 'https://asia-northeast3-pureun-erp.cloudfunctions.net/zipLookup';
  var WAIT = 700;   // 타자 치는 동안 묻지 않게 잠깐 기다렸다 묻는다
  var memo = {};    // 찾을 말 → Promise<우편번호|''> — 같은 주소는 한 번만 묻는다

  function fetchT(url, opt, ms) {
    if (typeof AbortController === 'undefined') return fetch(url, opt);
    var c = new AbortController(), t = setTimeout(function () { c.abort(); }, ms);
    opt.signal = c.signal;
    return fetch(url, opt).then(function (r) { clearTimeout(t); return r; },
      function (e) { clearTimeout(t); throw e; });
  }

  /* 주소 → Promise<다섯 자리 우편번호|''>. 로그인 전·짧은 주소·갈리는 주소는 ''. */
  function lookup(addr) {
    var PA = root.PuAddr;
    var a = String(addr || '').trim();
    if (!PA || a.length < 4) return Promise.resolve('');
    var q = PA.query(a), key = PA.key(a), alt = PA.clean(a);
    if (q.length < 4) return Promise.resolve('');
    var m = q + '|' + key;
    if (memo[m]) return memo[m];
    var u = null;
    try { u = (root.firebase && root.firebase.auth && root.firebase.auth().currentUser) || null; } catch (e) {}
    if (!u) return Promise.resolve('');
    var p = u.getIdToken().then(function (tok) {
      return fetchT(URL, { method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tok },
        body: JSON.stringify({ q: q, key: key, alt: alt }) }, 15000);
    }).then(function (r) {
      if (!r.ok) throw new Error('zipLookup ' + r.status);
      return r.json();
    }).then(function (j) {
      return (j && j.ok && /^\d{5}$/.test(String(j.zip || ''))) ? String(j.zip) : '';
    }).catch(function (e) {
      delete memo[m];   // 그물·서버 탓이면 다음에 다시 묻는다 — «없음»으로 굳히지 않는다
      try { console.warn('[우편번호 자동]', e && e.message || e); } catch (_) {}
      return '';
    });
    memo[m] = p;
    return p;
  }

  function val(el) { return String((el && el.value) || '').trim(); }

  /* 주소칸·우편번호칸에 단다 — 지금 한 번 보고, 주소를 고치면 또 본다.
     done(우편번호, 그때주소) 은 칸에 넣은 «뒤» 부른다. */
  function bind(addrEl, zipEl, done) {
    if (!addrEl || !zipEl) return;
    var t = 0;
    function check() {
      clearTimeout(t);
      var a = val(addrEl);
      if (a.length < 4 || val(zipEl)) return;
      t = setTimeout(function () {
        lookup(a).then(function (z) {
          /* 그사이 칸이 사라졌거나(다시 그림) 주소를 고쳤거나 우편번호를 적었으면 그대로 둔다 */
          if (!z || zipEl.isConnected === false || val(addrEl) !== a || val(zipEl)) return;
          zipEl.value = z;
          if (done) done(z, a);
        });
      }, WAIT);
    }
    if (addrEl.addEventListener) addrEl.addEventListener('input', check);
    check();
  }

  var api = { URL: URL, lookup: lookup, bind: bind };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PuZip = api;
})(typeof window !== 'undefined' ? window : this);
