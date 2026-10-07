/* 푸른 큰 사본 창고 — localStorage 에 두기엔 큰 것을 IndexedDB 로 (2026-10-07)

   ── 왜 생겼나
     nabaho.github.io 의 모든 앱이 localStorage «한 주소 몫 약 5MB»를 함께 쓴다.
     2026-10-07 대표 크롬이 5,242,346자(한도)까지 차서 경력관리가 목록을 못 적었다.
     실측 상위: 이알피 계약서 양식 1.3MB · 규정관리 작업본 0.5MB · 규정 보관함 0.5MB ·
     급여 0.36MB … 경력관리 자기 몫은 0.43MB 뿐이었다 — 남의 짐에 밀려난 것이다.
     IndexedDB 는 한 주소 몫이 수백 MB 라 이런 덩어리를 두기에 맞다.

   ── 옮기는 차례 (이것이 이 파일의 «규칙»이다 — tests/big-store-move.test.js)
     ① 옛 자리(localStorage)에서 읽는다
     ② 새 자리(IndexedDB)에 쓴다 — 쓰기가 «끝났다»는 답(oncomplete)을 받을 때까지 기다린다
     ③ 새 자리에서 «다시 읽어» 글자 하나까지 같은지 본다
     ④ 그 사이 옛 자리가 바뀌지 않았을 때만 옛 자리를 지운다
     → 어느 한 걸음이라도 어긋나면 옛 자리를 «그대로 둔다». 잃는 길이 없다.

   ── 읽기·쓰기는 «동기식»으로 (mirror)
     앱들은 localStorage.getItem 처럼 그 자리에서 값을 받는다. IndexedDB 는 늘 기다려야 하므로
     켤 때 한 번 다 읽어 메모리에 쥐고(boot), 그 뒤로는 메모리에서 바로 준다.
     쓰기는 메모리에 바로 얹고, IndexedDB 에는 뒤에서 적는다.
     ⚠ 켜지는 중(wait)과 IndexedDB 를 못 쓰는 브라우저(off)에서는 «예전 그대로» localStorage 를 쓴다.
     ⚠★ 옛 자리에 값이 «있으면 그것이 이긴다» — 옛 판 화면(다른 탭)이 적은 것일 수 있다.
        옛 자리 값은 새 자리로 옮긴 «뒤에야» 지우므로, 남아 있다면 그쪽이 더 새것이다.

   ⚠ 실데이터를 로그에 찍지 않는다 — 열쇠 이름과 글자 수만 남긴다. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(root);
  else root.PuBigStore = factory(root);
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';

  var DB_NAME = 'pu-big-store';
  var STORE = 'kv';

  /* ── IndexedDB 를 연다. 못 열면(사생활 창·막힘·시간 넘김) null — 부르는 쪽은 예전 길로 간다 ── */
  function open(opts) {
    opts = opts || {};
    var idb = opts.idb || (root && root.indexedDB) || null;
    var name = opts.name || DB_NAME;
    var timeoutMs = opts.timeoutMs || 3000;
    return new Promise(function (resolve) {
      if (!idb) { resolve(null); return; }
      var done = false;
      var timer = setTimeout(function () { finish(null); }, timeoutMs);
      function finish(db) {
        if (done) {
          /* 시간이 넘은 뒤에 열렸다 — 이미 «못 씀»으로 정했으니 닫는다(늦은 쓰기를 막는다) */
          if (db) { try { db.close(); } catch (_) {} }
          return;
        }
        done = true; clearTimeout(timer);
        resolve(db ? wrap(db) : null);
      }
      /* ⚠ 같은 이름의 창고가 «칸(kv) 없이» 먼저 생겨 있을 수 있다(다른 판·손으로 연 것).
           그러면 판을 하나 올려 칸을 만든다 — 안 그러면 쓰기가 영영 실패해 옮기지를 못한다(잃지는 않는다). */
      function go(ver, retried) {
        var req;
        try { req = (ver ? idb.open(name, ver) : idb.open(name)); } catch (_) { finish(null); return; }
        req.onupgradeneeded = function () {
          try {
            var db = req.result;
            if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
          } catch (_) {}
        };
        req.onsuccess = function () {
          var db = req.result;
          var ok = false;
          try { ok = db.objectStoreNames.contains(STORE); } catch (_) {}
          if (ok) { finish(db); return; }
          var next = (Number(db.version) || 1) + 1;
          try { db.close(); } catch (_) {}
          if (retried) { finish(null); return; }
          go(next, true);
        };
        req.onerror = function () { finish(null); };
      }
      go(0, false);
    });
  }

  /* 쓰기는 «거래가 끝났다(oncomplete)»에서야 됐다고 답한다 — put 의 onsuccess 는 아직 디스크 전이다 */
  function wrap(db) {
    try { db.onversionchange = function () { try { db.close(); } catch (_) {} }; } catch (_) {}
    function tx(mode, work) {
      return new Promise(function (resolve, reject) {
        var t, out = null;
        try { t = db.transaction(STORE, mode); } catch (e) { reject(e); return; }
        t.oncomplete = function () { resolve(out); };
        t.onerror = function () { reject(t.error || new Error('idb error')); };
        t.onabort = function () { reject(t.error || new Error('idb abort')); };
        try { work(t.objectStore(STORE), function (v) { out = v; }); }
        catch (e) { try { t.abort(); } catch (_) {} reject(e); }
      });
    }
    return {
      get: function (k) {
        return tx('readonly', function (s, set) {
          var r = s.get(k);
          r.onsuccess = function () { set(r.result === undefined ? null : r.result); };
        });
      },
      put: function (k, v) { return tx('readwrite', function (s) { s.put(v, k); }); },
      del: function (k) { return tx('readwrite', function (s) { s.delete(k); }); },
      close: function () { try { db.close(); } catch (_) {} }
    };
  }

  /* ── 한 칸 옮기기: 읽기 → 쓰기 → 다시 읽어 견주기 → 그때만 옛 자리 지우기 ──
     돌려주는 것: { key, moved, value, why }
       value — 지금 «믿을» 값(옮겼든 못 옮겼든). 옛 자리에 아무것도 없으면 null.
       why   — none(옛 자리 비어 있음) · ok · write(새 자리 쓰기 실패) · verify(다시 읽으니 다름)
               · changed(그 사이 옛 자리가 바뀜) · ls-read · ls-remove */
  function moveFromLs(store, ls, key) {
    var raw;
    try { raw = ls.getItem(key); } catch (_) { return Promise.resolve({ key: key, moved: false, value: null, why: 'ls-read' }); }
    if (raw == null) return Promise.resolve({ key: key, moved: false, value: null, why: 'none' });
    return Promise.resolve()
      .then(function () { return store.put(key, raw); })
      .then(function () { return store.get(key); })
      .then(function (back) {
        if (back !== raw) return { key: key, moved: false, value: raw, why: 'verify' };
        var now;
        try { now = ls.getItem(key); } catch (_) { now = raw; }
        if (now !== raw) return { key: key, moved: false, value: now, why: 'changed' };
        try { ls.removeItem(key); } catch (_) { return { key: key, moved: false, value: raw, why: 'ls-remove' }; }
        return { key: key, moved: true, value: raw, why: 'ok' };
      }, function () {
        return { key: key, moved: false, value: raw, why: 'write' };
      });
  }

  /* ── 켤 때: 칸마다 옛 자리를 먼저 옮기고(있으면 그것이 이긴다), 없으면 새 자리 값을 읽는다 ──
     돌려주는 것: { values:{key:값|null}, report:[{key,why,len}] }
     ⚠ 새 자리 읽기에 실패한 칸은 why:'idb-read' 로 적고 값은 null — 부르는 쪽이 «모른다»로 다룬다 */
  function bootKeys(store, ls, keys) {
    var values = {}, report = [];
    var chain = Promise.resolve();
    keys.forEach(function (key) {
      chain = chain.then(function () {
        return moveFromLs(store, ls, key).then(function (r) {
          if (r.value != null) {
            values[key] = r.value;
            report.push({ key: key, why: r.why, len: r.value.length });
            return;
          }
          if (r.why !== 'none') { values[key] = null; report.push({ key: key, why: r.why, len: 0 }); return; }
          return store.get(key).then(function (v) {
            values[key] = (typeof v === 'string') ? v : null;
            report.push({ key: key, why: values[key] == null ? 'empty' : 'idb', len: values[key] ? values[key].length : 0 });
          }, function () {
            values[key] = null;
            report.push({ key: key, why: 'idb-read', len: 0 });
          });
        });
      });
    });
    return chain.then(function () { return { values: values, report: report }; });
  }

  /* ── 동기식 거울 ──
     opts: { keys:[열쇠…], ls, open:()=>Promise<store|null>, onWriteFail(key, err) }
     state: 'wait'(켜지는 중) → 'on'(IndexedDB 씀) | 'off'(못 씀 — 예전 그대로 localStorage) */
  function mirror(opts) {
    opts = opts || {};
    var ls = opts.ls;
    var own = {};
    (opts.keys || []).forEach(function (k) { own[k] = 1; });
    var mem = Object.create(null);
    var pending = [];
    var m = {
      state: 'wait',
      store: null,
      ready: null,
      report: null,
      owns: function (k) { return own[k] === 1; },
      keys: function () { return Object.keys(own); },
      /* 지금 값 — on 이면 메모리, 그 밖에는 localStorage(예전 그대로) */
      get: function (k) {
        if (m.state === 'on') {
          if (Object.prototype.hasOwnProperty.call(mem, k)) return mem[k];
          try { return ls.getItem(k); } catch (_) { return null; }
        }
        return ls.getItem(k);
      },
      /* on 이면 메모리에 바로 얹고 IndexedDB 에 뒤에서 적는다(던지지 않는다).
         그 밖에는 localStorage 에 적는다 — 공간이 없으면 «예전처럼» 던진다(부르는 쪽 처리 그대로). */
      set: function (k, v) {
        v = String(v);
        if (m.state !== 'on') { ls.setItem(k, v); return; }
        mem[k] = v;
        var p = m.store.put(k, v).then(function () {
          /* 적힌 것이 «지금 값»일 때만 옛 자리를 비운다 — 뒤따른 쓰기가 또 비운다 */
          if (mem[k] === v) { try { if (ls.getItem(k) !== null) ls.removeItem(k); } catch (_) {} }
        }, function (err) {
          /* 새 자리에 못 적었다 → 옛 자리에라도. 그것도 못 하면 «낡은 옛 값»을 지운다 —
             남겨 두면 다음에 켤 때 «옛 자리가 이긴다» 규칙에 따라 낡은 것이 살아난다. */
          if (mem[k] !== v) return;
          try { ls.setItem(k, v); }
          catch (e2) {
            try { ls.removeItem(k); } catch (_) {}
            if (typeof opts.onWriteFail === 'function') { try { opts.onWriteFail(k, e2 || err); } catch (_) {} }
          }
        });
        pending.push(p);
        p.then(function () { var i = pending.indexOf(p); if (i >= 0) pending.splice(i, 1); });
      },
      remove: function (k) {
        delete mem[k];
        try { ls.removeItem(k); } catch (_) {}
        if (m.state === 'on' && m.store) {
          var p = m.store.del(k).catch(function () {});
          pending.push(p);
          p.then(function () { var i = pending.indexOf(p); if (i >= 0) pending.splice(i, 1); });
        }
      },
      /* 뒤에서 적는 중인 것이 다 끝날 때까지 — 새로고침 앞에서 쓴다 */
      flush: function () { return Promise.all(pending.slice()).then(function () {}); },
      boot: function () {
        if (m.ready) return m.ready;
        var opener = opts.open || function () { return open(opts); };
        m.ready = Promise.resolve()
          .then(function () { return opener(); })
          .then(function (store) {
            if (!store) throw new Error('no idb');
            return bootKeys(store, ls, m.keys()).then(function (res) {
              m.store = store;
              m.keys().forEach(function (k) {
                /* ⚠ 켜지는 사이 옛 자리에 새로 적힌 것이 있으면 그것이 이긴다 */
                var now = null;
                try { now = ls.getItem(k); } catch (_) {}
                if (now != null) mem[k] = now;
                else if (res.values[k] != null) mem[k] = res.values[k];
              });
              m.state = 'on';
              m.keys().forEach(function (k) {
                var still = null;
                try { still = ls.getItem(k); } catch (_) {}
                if (still != null) m.set(k, still);   // 다시 옮긴다 — 쓰기가 끝나면 옛 자리를 비운다
              });
              m.report = { state: 'on', report: res.report, missing: m.keys().filter(function (k) { return !(k in mem); }) };
              return m.report;
            });
          })
          .catch(function () {
            m.state = 'off';
            m.report = {
              state: 'off', report: [],
              missing: m.keys().filter(function (k) { try { return ls.getItem(k) == null; } catch (_) { return true; } })
            };
            return m.report;
          });
        return m.ready;
      }
    };
    return m;
  }

  return { open: open, moveFromLs: moveFromLs, bootKeys: bootKeys, mirror: mirror, DB_NAME: DB_NAME };
});
