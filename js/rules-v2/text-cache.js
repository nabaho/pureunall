/* 취업규칙(새) — 가린 글을 브라우저에 담아 두는 칸 (IndexedDB)
   ⚠ 담기는 것은 «가린 글»뿐이다 — 직원 누구나 읽는 그 글과 같다. 원문·개인정보는 없다.
   ⚠ 이 칸은 브라우저 프로필 안에 산다 — 「사이트 데이터 지우기」 하면 사라지고, 사라져도
     다음에 다시 받으면 그만이다(원본은 서버에 있다).
   ⚠ 어떤 실패도 던지지 않는다 — IndexedDB 가 없거나(시크릿 창·막힘) 열리지 않으면
     «아무것도 안 하는 칸»처럼 굴어 화면은 칸 없이도 그대로 돈다(get→null, put→끝).
   DB 'rules-v2-text' · 저장소 't' · 열쇠 id · 값 {v,text} (v = 판 표시: updatedAt||createdAt) */
(function (root) {
  'use strict';
  var DB = 'rules-v2-text', STORE = 't';

  // 아무것도 안 하는 칸
  var NOOP = {
    get: function () { return Promise.resolve(null); },
    put: function () { return Promise.resolve(); }
  };

  function make(idbFactory) {
    if (!idbFactory) return NOOP;
    var opening = null; // 한 번만 연다 — 실패해도 그 결과(null)를 그대로 쓴다
    function open() {
      if (opening) return opening;
      opening = new Promise(function (resolve) {
        try {
          var rq = idbFactory.open(DB, 1);
          rq.onupgradeneeded = function () {
            try { rq.result.createObjectStore(STORE); } catch (e) { /* 이미 있음 */ }
          };
          rq.onsuccess = function () { resolve(rq.result); };
          rq.onerror = function () { resolve(null); };
          rq.onblocked = function () { resolve(null); };
        } catch (e) { resolve(null); }
      });
      return opening;
    }
    // 한 번의 읽기/쓰기 — 무슨 일이 있어도 resolve(fallback)
    function run(mode, fn, fallback) {
      return open().then(function (db) {
        if (!db) return fallback;
        return new Promise(function (resolve) {
          try {
            var tx = db.transaction(STORE, mode);
            var rq = fn(tx.objectStore(STORE));
            var out = fallback;
            if (rq) rq.onsuccess = function () { out = rq.result == null ? fallback : rq.result; };
            tx.oncomplete = function () { resolve(out); };
            tx.onerror = tx.onabort = function () { resolve(fallback); };
          } catch (e) { resolve(fallback); }
        });
      }, function () { return fallback; });
    }
    return {
      get: function (id) {
        return run('readonly', function (s) { return s.get(String(id)); }, null).then(function (r) {
          return r && typeof r.text === 'string' ? { v: String(r.v), text: r.text } : null;
        });
      },
      put: function (id, v, text) {
        return run('readwrite', function (s) { s.put({ v: String(v), text: String(text) }, String(id)); return null; }, undefined)
          .then(function () { /* 결과를 쓰지 않는다 */ });
      }
    };
  }

  var api = { make: make, DB: DB, STORE: STORE };
  if (root) root.PuRulesV2TextCache = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
