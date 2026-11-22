/* 푸른통합시스템 — 팝업·앱 즉시 열림 가속기 (UID 격리 IndexedDB 경량 스냅샷 + 무거운 판독기 지연 적재)
 *
 * 맡는 일:
 *   1. 앱 창(팝업·새 탭)을 열 때 대용량 전체 메일함(mailbox/msgs · mailbox/old/msgs)이나 공공데이터를
 *      다 내려받기 전에도 마지막으로 확인한 경량 목록 스냅샷을 0.1초 안에 먼저 그려 빈 화면 대기를 없앤다.
 *   2. 모든 스냅샷은 IndexedDB('pu_fast_boot_v1')에만 두어 localStorage 5MB 한도를 건드리지 않으며,
 *      반드시 접속 계정 UID 별로 격리하고 로그아웃·계정 전환 시 즉시 비운다.
 *      (비밀유지 금고 harass_secret · 메일 원문 · 주민등록번호 등 민감 본문은 절대 저장하지 않는다.)
 *   3. 초기 화면 표시에 쓰이지 않는 대용량 문서 판독기(pdf.min.js · xlsx.full.min.js · jszip.min.js · hwp.js)는
 *      파일 업로드·내보내기 실행 시점에만 동적 적재하여 초기 스크립트 파싱 지연을 제거한다.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(root || globalThis);
  } else {
    var g = root || (typeof window !== 'undefined' ? window : globalThis);
    g.PuFastBoot = factory(g);
  }
})(typeof window !== 'undefined' ? window : globalThis, function (global) {
  'use strict';

  var DB_NAME = 'pu_fast_boot_v1';
  var STORE_NAME = 'snaps';
  var SNAP_VER = 1;
  var MAX_AGE_MS = 3 * 24 * 3600 * 1000;
  var ALLOWED_SCRIPT_RE = /^(?:vendor|hangul\/js|js)\/[A-Za-z0-9._\/-]+(?:\?v=\d+)?$/;

  var _dbPromise = null;
  var _scriptPromises = Object.create(null);
  var _clearEpoch = 0;

  function str(v) { return v == null ? '' : String(v).trim(); }

  function deleteKeyQuiet(db, key) {
    try {
      var tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(key);
    } catch (e) {}
  }

  function globalLogoutAt() {
    try {
      var ls = global && global.localStorage ? global.localStorage : null;
      return ls ? (Number(ls.getItem('pu_auth_logout_at') || 0) || 0) : 0;
    } catch (e) {
      return 0;
    }
  }

  function openDb(timeoutMs) {
    if (_dbPromise) return _dbPromise;
    var idb = null;
    try { idb = global && global.indexedDB ? global.indexedDB : null; } catch (e) { idb = null; }
    if (!idb || typeof idb.open !== 'function') return Promise.resolve(null);

    _dbPromise = new Promise(function (resolve) {
      var settled = false;
      var timer = setTimeout(function () {
        if (settled) return;
        settled = true;
        _dbPromise = null;
        resolve(null);
      }, timeoutMs || 400);

      function finish(db) {
        if (settled) {
          if (db) { try { db.close(); } catch (e) {} }
          return;
        }
        settled = true;
        clearTimeout(timer);
        if (!db) _dbPromise = null;
        resolve(db || null);
      }

      try {
        var req = idb.open(DB_NAME, 1);
        req.onupgradeneeded = function () {
          try {
            var db = req.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
              db.createObjectStore(STORE_NAME);
            }
          } catch (e) {}
        };
        req.onsuccess = function () {
          var db = req.result;
          try {
            db.onversionchange = function () {
              try { db.close(); } catch (e) {}
              _dbPromise = null;
            };
          } catch (e) {}
          finish(db);
        };
        req.onerror = function () { finish(null); };
        req.onblocked = function () { finish(null); };
      } catch (e) {
        finish(null);
      }
    });
    return _dbPromise;
  }

  function snapKey(appKey, uid) {
    var a = str(appKey);
    var u = str(uid);
    if (!a || !u) return '';
    return a + ':' + u;
  }

  function readSnap(appKey, uid) {
    var k = snapKey(appKey, uid);
    if (!k) return Promise.resolve(null);
    return openDb(350).then(function (db) {
      if (!db) return null;
      return new Promise(function (resolve) {
        var settled = false;
        var timer = setTimeout(function () {
          if (settled) return;
          settled = true;
          resolve(null);
        }, 300);
        try {
          var tx = db.transaction(STORE_NAME, 'readonly');
          var req = tx.objectStore(STORE_NAME).get(k);
          req.onsuccess = function () {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            var rec = req.result;
            if (!rec || typeof rec !== 'object' || rec.v !== SNAP_VER || rec.uid !== str(uid)) {
              resolve(null);
              return;
            }
            var logoutTs = globalLogoutAt();
            if ((rec.at && (Date.now() - Number(rec.at)) > MAX_AGE_MS) || (logoutTs > 0 && Number(rec.at || 0) <= logoutTs)) {
              deleteKeyQuiet(db, k);
              resolve(null);
              return;
            }
            resolve(rec.data || null);
          };
          req.onerror = function () {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve(null);
          };
        } catch (e) {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve(null);
          }
        }
      });
    });
  }

  function writeSnap(appKey, uid, data) {
    var k = snapKey(appKey, uid);
    if (!k || !data || typeof data !== 'object') return Promise.resolve(false);
    var epochAtStart = _clearEpoch;
    var startedAt = Date.now();
    return openDb(500).then(function (db) {
      if (!db || _clearEpoch !== epochAtStart) return false;
      return new Promise(function (resolve) {
        try {
          var logoutTs = globalLogoutAt();
          if (_clearEpoch !== epochAtStart || (logoutTs > 0 && logoutTs >= startedAt)) { resolve(false); return; }
          try {
            var ls = global && global.localStorage ? global.localStorage : null;
            var lsUid = ls ? str(ls.getItem('pu_auth_uid')) : '';
            if (ls && lsUid && lsUid !== str(uid)) { resolve(false); return; }
          } catch (e) {}
          var tx = db.transaction(STORE_NAME, 'readwrite');
          tx.oncomplete = function () { resolve(_clearEpoch === epochAtStart); };
          tx.onerror = function () { resolve(false); };
          tx.onabort = function () { resolve(false); };
          tx.objectStore(STORE_NAME).put({
            v: SNAP_VER,
            uid: str(uid),
            at: Date.now(),
            data: data
          }, k);
        } catch (e) {
          resolve(false);
        }
      });
    });
  }

  function clearAll() {
    _clearEpoch += 1;
    return openDb(350).then(function (db) {
      if (!db) return false;
      return new Promise(function (resolve) {
        try {
          var tx = db.transaction(STORE_NAME, 'readwrite');
          tx.oncomplete = function () { resolve(true); };
          tx.onerror = function () { resolve(false); };
          tx.onabort = function () { resolve(false); };
          tx.objectStore(STORE_NAME).clear();
        } catch (e) {
          resolve(false);
        }
      });
    });
  }

  function loadScriptOnce(src, checkReady) {
    var cleanSrc = str(src);
    var pathPart = cleanSrc.split('?')[0];
    if (!ALLOWED_SCRIPT_RE.test(cleanSrc) || pathPart.indexOf('..') !== -1 || pathPart.indexOf('//') !== -1 || /(?:^|\/)\./.test(pathPart)) {
      return Promise.reject(new Error('허용되지 않은 스크립트 경로입니다: ' + cleanSrc));
    }
    try {
      if (typeof checkReady === 'function' && checkReady()) return Promise.resolve(true);
    } catch (e) {}
    if (_scriptPromises[cleanSrc]) return _scriptPromises[cleanSrc];

    var doc = global && global.document ? global.document : null;
    if (!doc || typeof doc.createElement !== 'function') {
      return Promise.resolve(false);
    }

    _scriptPromises[cleanSrc] = new Promise(function (resolve, reject) {
      var el = doc.createElement('script');
      el.src = cleanSrc;
      el.async = true;
      el.onload = function () { resolve(true); };
      el.onerror = function () {
        delete _scriptPromises[cleanSrc];
        reject(new Error('문서 판독 도구를 불러오지 못했습니다: ' + cleanSrc));
      };
      (doc.head || doc.body || doc.documentElement).appendChild(el);
    });
    return _scriptPromises[cleanSrc];
  }

  function ensurePdfJs() {
    return loadScriptOnce('vendor/pdf.min.js?v=1', function () { return !!global.pdfjsLib; }).then(function (ok) {
      try {
        if (global.pdfjsLib && global.pdfjsLib.GlobalWorkerOptions) {
          global.pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js?v=1';
        }
      } catch (e) {}
      return ok;
    });
  }

  function ensureXlsx() {
    return loadScriptOnce('vendor/xlsx.full.min.js?v=1', function () { return !!global.XLSX; });
  }

  function ensureJsZip() {
    return loadScriptOnce('vendor/jszip.min.js?v=1', function () { return !!global.JSZip; });
  }

  async function ensureHwpLibs() {
    await loadScriptOnce('hangul/js/zip.js?v=1', function () { return !!(global.PureunZip || global.Zip); });
    await loadScriptOnce('hangul/js/hwpx.js?v=2', function () { return !!(global.PureunHwpx || global.PuHwpx); });
    await loadScriptOnce('hangul/js/hwp.js?v=1', function () { return !!(global.PureunHwp || global.PuHwp); });
    return true;
  }

  try {
    if (global && typeof global.addEventListener === 'function') {
      global.addEventListener('storage', function (ev) {
        if (ev && (ev.key === 'pu_auth_logout_at' || (ev.key === 'pu_auth_uid' && !ev.newValue))) {
          clearAll();
        }
      });
    }
  } catch (e) {}

  return {
    readSnap: readSnap,
    writeSnap: writeSnap,
    clearAll: clearAll,
    loadScriptOnce: loadScriptOnce,
    ensurePdfJs: ensurePdfJs,
    ensureXlsx: ensureXlsx,
    ensureJsZip: ensureJsZip,
    ensureHwpLibs: ensureHwpLibs
  };
});
