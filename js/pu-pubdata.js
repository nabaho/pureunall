/* 🗂 공공데이터 공용 자리 읽기 도구 — 모든 프로그램이 «같은 함수»로 읽는다 (대표 「진행」 2026-10-11)
   ═══════════════════════════════════════════════════════════════════════════
   쓰는 쪽은 서버뿐이다(functions/pubdata.js · nps-monthly.js · nts-monthly.js).
   화면은 읽기만 하고, 새로 받고 싶으면 ask() 로 «받아 달라»를 남긴다 — 서버가 받아 쓰고 요청을 지운다.

     PuPubdata.co(번호)            → Promise<{nps, ei, eiHist, nts} | null>   회사 한 곳(사업자번호 10자리)
     PuPubdata.watch(번호, fn)     → 끄기 함수                               열려 있는 동안 바뀌면 다시 그린다
     PuPubdata.holidays(연도)      → Promise<[{date,name,kind}]>             공휴일(한국천문연구원 특일)
     PuPubdata.ask(번호, 갈래, 이름) → Promise                                 'ei' | 'nps' | 생략(둘 다)
     PuPubdata.mergeHolidays(손입력, 받은것) → 손입력이 이기고, 없는 날만 더한 목록 (저장하지 않는다)

   ⚠ firebase(compat) 가 먼저 실려 있어야 한다. 없으면 null·빈 목록을 돌려주고 오류를 내지 않는다.
   ⚠ 돈(보험료)은 이 자리에 없다. */
(function (root) {
  'use strict';
  var PUB = 'pubdata';
  function digits(s) { return String(s == null ? '' : s).replace(/[^0-9]/g, ''); }
  function db() {
    try { return root.firebase && root.firebase.database ? root.firebase.database() : null; } catch (_) { return null; }
  }
  function co(no) {
    var n = digits(no), d = db();
    if (n.length !== 10 || !d) return Promise.resolve(null);
    return d.ref(PUB + '/co/' + n).once('value').then(function (s) { return s.val(); }, function () { return null; });
  }
  function watch(no, fn) {
    var n = digits(no), d = db();
    if (n.length !== 10 || !d || typeof fn !== 'function') return function () {};
    var ref = d.ref(PUB + '/co/' + n);
    var cb = function (s) { try { fn(s.val()); } catch (_) {} };
    ref.on('value', cb, function () {});
    return function () { try { ref.off('value', cb); } catch (_) {} };
  }
  function holidays(year) {
    var y = String(year || ''), d = db();
    if (!/^\d{4}$/.test(y) || !d) return Promise.resolve([]);
    return d.ref(PUB + '/common/holidays/' + y).once('value').then(function (s) {
      var v = s.val();
      return (v && Array.isArray(v.list)) ? v.list : [];
    }, function () { return []; });
  }
  function ask(no, k, nm) {
    var n = digits(no), d = db();
    if (n.length !== 10 || !d) return Promise.resolve(false);
    var v = { at: root.firebase.database.ServerValue.TIMESTAMP };
    if (k === 'ei' || k === 'nps') v.k = k;
    if (nm) v.nm = String(nm).slice(0, 100);
    return d.ref('pubdata_req/' + n).set(v).then(function () { return true; }, function () { return false; });
  }
  /* 손으로 넣은 날(약정휴일·고친 이름)이 이긴다 — 같은 날짜가 있으면 받은 것을 안 넣는다. 지우는 일은 없다. */
  function mergeHolidays(manual, pub) {
    var out = [].concat(manual || []).filter(function (x) { return x && x.date; });
    var have = {};
    out.forEach(function (x) { have[x.date] = 1; });
    [].concat(pub || []).forEach(function (x) {
      if (!x || !x.date || have[x.date]) return;
      have[x.date] = 1;
      out.push({ date: x.date, name: x.name, kind: x.kind, src: 'kasi' });
    });
    return out.sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); });
  }
  root.PuPubdata = { co: co, watch: watch, holidays: holidays, ask: ask, mergeHolidays: mergeHolidays, digits: digits };
})(typeof window !== 'undefined' ? window : globalThis);
