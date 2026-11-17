/* 사업장 포털(비즈니스지원단·현장클리닉 등) 접속 비밀번호 — «그 건의 담당자와 대표만» (2026-11-15)
   선례: js/pu-worker-secret.js (사건·계약 근로자 주민번호·계좌 분리)

   ■ 왜 따로 두나
     컨설팅(data/consultings)·계약(data/contracts)·업체(data/companies) 원장은 «한 덩어리»라
     재직 근로자 누구나 통째로 읽는다. 공개 덩어리에는 아이디(siteId)와 «비번 있음» 표시(hasSitePw)만 두고,
     실제 비밀번호(sitePw)는 site_secret/{표}/{건 id}/sitePw 에 따로 둔다.
     보안규칙이 서버에서 직접 「이 건의 주담당·부담당인가, 총괄관리자(대표)인가」를 따진다.

   ■ 비번 숨김 · 클릭 열람 원칙
     담당자·관리자라도 화면을 열자마자 평문 비번을 드러내지 않는다(•••••••• / password 칸).
     담당자가 [보기] 단추를 눌렀을 때만 읽거나 가림을 푼다.

   ■ 실수로 비번이 지워지지 않는 안전장치
     빈칸('')으로 덮어써서 기존 비번이 날아가는 사고를 막으려고,
     빈칸 삭제는 사용자가 비번 입력칸을 직접 고쳐 비웠다는 표시(_sitePwDirty: true)가 있을 때만
     hasSitePw = false 와 서버 null 지우기를 보낸다. */
(function (global) {
  'use strict';

  var ROOT = 'site_secret';
  var MAX_LEN = 120;
  var KINDS = {
    cases: 1,
    contracts: 1,
    consultings: 1,
    funds: 1,
    other_projects: 1,
    companies: 1
  };

  function isKind(k) { return Object.prototype.hasOwnProperty.call(KINDS, k); }

  /* 한 건 통째 — dbUpsert·dbSet 용 */
  function split(kind, rec) {
    if (!isKind(kind) || !rec || typeof rec !== 'object') {
      return { record: rec, secret: null, any: false };
    }
    var hasPwProp = Object.prototype.hasOwnProperty.call(rec, 'sitePw');
    var hasDirtyProp = Object.prototype.hasOwnProperty.call(rec, '_sitePwDirty');
    if (!hasPwProp && !hasDirtyProp) {
      return { record: rec, secret: null, any: false };
    }
    var copy = Object.assign({}, rec);
    var raw = copy.sitePw;
    var dirty = copy._sitePwDirty === true;
    delete copy.sitePw;
    delete copy._sitePwDirty;

    var v = (raw == null ? '' : String(raw).trim()).slice(0, MAX_LEN);
    if (v) {
      copy.hasSitePw = true;
      return { record: copy, secret: { sitePw: v }, any: true };
    }
    if (dirty) {
      copy.hasSitePw = false;
      return { record: copy, secret: { sitePw: '' }, any: true };
    }
    return { record: copy, secret: null, any: true };
  }

  /* 칸 몇 개만 — dbPatch 용 */
  function splitPatch(kind, fields) {
    if (!isKind(kind) || !fields || typeof fields !== 'object') {
      return { fields: fields, secret: null, any: false };
    }
    var hasPwProp = Object.prototype.hasOwnProperty.call(fields, 'sitePw');
    var hasDirtyProp = Object.prototype.hasOwnProperty.call(fields, '_sitePwDirty');
    if (!hasPwProp && !hasDirtyProp) {
      return { fields: fields, secret: null, any: false };
    }
    var f2 = Object.assign({}, fields);
    var raw = f2.sitePw;
    var dirty = f2._sitePwDirty === true;
    delete f2.sitePw;
    delete f2._sitePwDirty;

    var v = (raw == null ? '' : String(raw).trim()).slice(0, MAX_LEN);
    if (v) {
      f2.hasSitePw = true;
      return { fields: f2, secret: { sitePw: v }, any: true };
    }
    if (dirty) {
      f2.hasSitePw = false;
      return { fields: f2, secret: { sitePw: '' }, any: true };
    }
    return { fields: f2, secret: null, any: true };
  }

  function updatePaths(kind, recId, secret) {
    var out = {};
    if (!isKind(kind) || !recId || !secret || !Object.prototype.hasOwnProperty.call(secret, 'sitePw')) {
      return out;
    }
    var v = String(secret.sitePw == null ? '' : secret.sitePw).trim().slice(0, MAX_LEN);
    out[ROOT + '/' + kind + '/' + recId + '/sitePw'] = v ? v : null;
    return out;
  }

  /* ── 서버 ───────────────────────────────────────────────────────── */
  var cache = {};
  var CACHE_MS = 60 * 1000;

  function denied(e) { return !!(e && /permission|denied/i.test(String(e.code || e.message || e))); }

  /* 읽기 — {ok:true, sitePw} | {ok:false, denied:true} | {ok:false, error} */
  function read(db, kind, recId) {
    if (!db || !isKind(kind) || !recId) return Promise.resolve({ ok: false, error: '인자' });
    var key = kind + '/' + recId, hit = cache[key];
    if (hit && (Date.now() - hit.at) < CACHE_MS) {
      return Promise.resolve({ ok: true, sitePw: hit.sitePw });
    }
    return db.ref(ROOT + '/' + key + '/sitePw').once('value').then(function (snap) {
      var pw = snap && snap.val() ? String(snap.val()) : '';
      cache[key] = { at: Date.now(), sitePw: pw };
      return { ok: true, sitePw: pw };
    }, function (e) {
      return denied(e) ? { ok: false, denied: true } : { ok: false, error: String((e && e.message) || e) };
    });
  }

  /* 쓰기 — 새 건이면 서버에 담당자가 먼저 닿아야 규칙이 통과하므로 거절 시 재시도 */
  function write(db, kind, recId, secret, opts) {
    var paths = updatePaths(kind, recId, secret);
    if (!db || !Object.keys(paths).length) return Promise.resolve({ ok: true, n: 0 });
    var waits = (opts && opts.waits) || [1500, 4000];
    var key = kind + '/' + recId;
    function go(i) {
      return db.ref().update(paths).then(function () {
        delete cache[key];
        return { ok: true, n: Object.keys(paths).length };
      }, function (e) {
        if (denied(e) && i < waits.length) {
          return new Promise(function (r) { setTimeout(r, waits[i]); }).then(function () { return go(i + 1); });
        }
        return { ok: false, denied: denied(e), error: String((e && e.message) || e) };
      });
    }
    return go(0);
  }

  /* 이관·동기화 — 출발 건의 비번을 도착 건으로 옮긴다 */
  function carry(db, srcKind, srcId, dstKind, dstId) {
    return read(db, srcKind, srcId).then(function (r) {
      if (!r.ok) return r;
      if (!r.sitePw) return { ok: true, n: 0 };
      return write(db, dstKind, dstId, { sitePw: r.sitePw });
    });
  }

  /* 권한 판정 보조 — 화면에서 담당자(주·부담당) 또는 총괄관리자인지 확인.
     실제 보안은 서버 규칙(site_secret)이 강제하며, 화면은 비담당자에게 불필요한 칸을 숨기는 용도다. */
  function canAccess(user, rec, extraRecs) {
    if (!user) return false;
    if (user.isAdmin) return true;
    var sid = user.sid ? String(user.sid).trim() : '';
    if (!sid) return false;
    var list = [rec].concat(Array.isArray(extraRecs) ? extraRecs : []);
    for (var i = 0; i < list.length; i++) {
      var r = list[i];
      if (!r || typeof r !== 'object') continue;
      if (r.managerMain && String(r.managerMain).trim() === sid) return true;
      if (Array.isArray(r.managerSubs)) {
        for (var j = 0; j < r.managerSubs.length; j++) {
          if (r.managerSubs[j] && String(r.managerSubs[j]).trim() === sid) return true;
        }
      }
    }
    return false;
  }

  function clearCache(kind, recId) {
    if (kind && recId) {
      delete cache[kind + '/' + recId];
      return;
    }
    Object.keys(cache).forEach(function (k) { delete cache[k]; });
  }

  var api = {
    ROOT: ROOT,
    MAX_LEN: MAX_LEN,
    KINDS: KINDS,
    isKind: isKind,
    split: split,
    splitPatch: splitPatch,
    updatePaths: updatePaths,
    read: read,
    write: write,
    carry: carry,
    canAccess: canAccess,
    clearCache: clearCache
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.PuSiteSecret = api;
})(typeof window !== 'undefined' ? window : globalThis);
