'use strict';
/* 푸른노무법인 경력관리 — 자기 저장소(IndexedDB) (2026-10-07 대표 결정 「둘 다 — 지금 살리고 뿌리도」)
   (브라우저 window.KcareerKV / Node module.exports 겸용)

   ■ 왜: nabaho.github.io 의 모든 앱이 localStorage «한 주소 몫 약 5MB»를 함께 쓴다. 2026-10-07 대표 크롬에서
     다른 앱 자료로 꽉 차(5,242,346자) 경력관리가 목록 한 줄도 못 썼다 — 5번 폴더 40개를 넣고도 새로고침하자 목록이 사라졌다.
     IndexedDB 는 앱마다 수백 MB 를 쓸 수 있다. 경력관리 기록은 거기에 둔다.
   ■ 차례 — 켤 때 boot() 를 «기다린 뒤» 앱을 시작한다(화면이 저장소를 읽기 전에 열려 있어야 한다).
     · 처음 한 번: localStorage 의 경력관리 열쇠(cm3_*)를 옮겨 담고, 다시 읽어 «같은지» 견준 뒤에만 옛 자리를 비운다.
     · 열리기 전에 들어온 쓰기는 모아 두었다가 열리면 그 위에 얹는다(나중 것이 이긴다).
     · 포털 홈이 읽는 통(mirror)은 localStorage 에도 사본을 남긴다(못 써도 그만 — 홈은 클라우드를 먼저 본다).
     · 같은 PC 의 다른 탭에는 바뀐 것을 알린다(BroadcastChannel) — 안 알리면 옛 목록으로 덮는다.
     · 옛 첨부 조각(pf_*)은 옮기지 않는다 — 따로 IndexedDB 로 옮기는 길이 이미 있다.
   ■ 못 열면(사생활 창 등) 예전처럼 localStorage 로 돈다. 단 «이미 옮긴 기기»에서 못 열면 broken — 저장을 막고 알린다. */
(function (root) {
  var MARK = '__kv_migrated';

  function create(o) {
    var ns = o.ns, ls = o.ls, idb = o.idb, bc = o.bc || null;
    var onErr = o.onError || function () {};
    var mirror = {}; (o.mirror || []).forEach(function (b) { mirror[ns + b] = 1; });
    var MOVED = ns + '_kv_moved';
    var data = null, state = 'closed', pre = {}, preDel = {}, q = Promise.resolve();
    function mine(k) { k = String(k); return k.indexOf(ns) === 0 && k.indexOf(ns + 'pf_') !== 0 && k !== MOVED; }
    function lsGet(k) { try { return ls.getItem(k); } catch (e) { return null; } }
    function lsKeys() { var out = []; try { for (var i = 0; i < ls.length; i++) { var k = ls.key(i); if (k && mine(k)) out.push(k); } } catch (e) {} return out; }
    function has(obj, k) { return Object.prototype.hasOwnProperty.call(obj, k); }
    function persist(k, v) {
      q = q.then(function () { return v === null ? idb.del(k) : idb.put(k, v); })
           .catch(function (e) { onErr(e, k); });
      return q;
    }
    function post(k, v) { try { if (bc) bc.postMessage({ k: k, v: v }); } catch (e) {} }
    function mirrorWrite(k, v) {
      if (mirror[k]) { try { if (v === null) ls.removeItem(k); else ls.setItem(k, v); } catch (e) {} }
    }
    var api = {
      get state() { return state; },
      mine: mine,
      /* 켜졌으면 저장소 것, 아니면 열리기 전 모은 것 → localStorage */
      get: function (k) {
        if (state === 'ready' && mine(k)) return has(data, k) ? data[k] : null;
        if (mine(k) && has(pre, k)) return pre[k];
        if (mine(k) && preDel[k]) return null;
        return lsGet(k);
      },
      /* 경력관리 열쇠면 true(맡았다) · 아니면 null(부르는 쪽이 예전 길로) */
      set: function (k, v) {
        if (!mine(k) || state === 'fail') return null;
        if (state === 'broken') throw new Error('경력관리 저장소를 열지 못했습니다 — 새로고침해 주세요');
        v = String(v);
        if (state === 'ready') { data[k] = v; persist(k, v); mirrorWrite(k, v); post(k, v); return true; }
        pre[k] = v; delete preDel[k]; try { ls.setItem(k, v); } catch (e) {}
        return true;
      },
      remove: function (k) {
        if (!mine(k) || state === 'fail') return null;
        if (state === 'ready') { delete data[k]; persist(k, null); try { ls.removeItem(k); } catch (e) {} post(k, null); return true; }
        delete pre[k]; preDel[k] = 1; try { ls.removeItem(k); } catch (e) {}
        return true;
      },
      keys: function () { return state === 'ready' ? Object.keys(data) : lsKeys().concat(Object.keys(pre)).filter(function (k, i, a) { return a.indexOf(k) === i && !preDel[k]; }); },
      flush: function () { return q; },
      boot: function () {
        return Promise.resolve().then(function () { return idb.getAll(); }).then(function (all) {
          all = all || {};
          var moved = lsGet(MOVED) === '1';
          var 처음 = !has(all, MARK);
          if (처음 && moved) throw Object.assign(new Error('옮긴 표시는 있는데 저장소가 비었습니다'), { broken: true });
          var put = [];
          if (처음) lsKeys().forEach(function (k) { var v = lsGet(k); if (v != null) { all[k] = v; put.push([k, v]); } });
          Object.keys(pre).forEach(function (k) { all[k] = pre[k]; put.push([k, pre[k]]); });
          Object.keys(preDel).forEach(function (k) { delete all[k]; });
          var 끝 = Promise.resolve();
          put.forEach(function (kv) { 끝 = 끝.then(function () { return idb.put(kv[0], kv[1]); }); });
          Object.keys(preDel).forEach(function (k) { 끝 = 끝.then(function () { return idb.del(k); }); });
          if (처음) 끝 = 끝.then(function () { return idb.put(MARK, String(Date.now())); });
          return 끝.then(function () { return 처음 ? idb.getAll() : all; }).then(function (back) {
            /* ★ 옮긴 것을 «다시 읽어» 견준다 — 하나라도 다르면 옛 자리를 비우지 않는다 */
            var 같다 = true;
            if (처음) put.forEach(function (kv) { if (!back || back[kv[0]] !== kv[1]) 같다 = false; });
            data = {}; Object.keys(all).forEach(function (k) { if (k !== MARK) data[k] = all[k]; });
            state = 'ready'; pre = {}; preDel = {};
            if (같다) {
              /* 공용 5MB 를 돌려준다 — 경력관리 열쇠는 사본 셋(mirror)만 남긴다 */
              lsKeys().forEach(function (k) { if (!mirror[k]) { try { ls.removeItem(k); } catch (e) {} } });
              Object.keys(mirror).forEach(function (k) { if (has(data, k)) mirrorWrite(k, data[k]); });
              try { ls.setItem(MOVED, '1'); } catch (e) {}
            }
            if (bc) bc.onmessage = function (ev) {
              var m = ev && ev.data; if (!m || !m.k || !mine(m.k)) return;
              if (m.v === null) delete data[m.k]; else data[m.k] = String(m.v);
            };
            return { first: 처음, verified: 같다, keys: Object.keys(data).length };
          });
        }).catch(function (e) {
          state = (e && e.broken) || lsGet(MOVED) === '1' ? 'broken' : 'fail';
          onErr(e, '(열기)');
          return { first: false, verified: false, state: state };
        });
      }
    };
    return api;
  }

  /* 브라우저용 IndexedDB 손잡이 — 값은 글자 하나씩(열쇠 → 글자) */
  function browserIdb(name) {
    var dbp = null;
    function open() {
      if (dbp) return dbp;
      dbp = new Promise(function (res, rej) {
        var r = indexedDB.open(name || 'kcareer_kv', 1);
        r.onupgradeneeded = function () { r.result.createObjectStore('kv'); };
        r.onsuccess = function () { res(r.result); };
        r.onerror = function () { rej(r.error); };
        r.onblocked = function () { rej(new Error('저장소가 막혔습니다(다른 탭)')); };
      });
      return dbp;
    }
    function tx(mode, fn) {
      return open().then(function (db) { return new Promise(function (res, rej) {
        var t = db.transaction('kv', mode), st = t.objectStore('kv'), out = fn(st);
        t.oncomplete = function () { res(out && out.result !== undefined ? out.result : out); };
        t.onerror = t.onabort = function () { rej(t.error || new Error('저장소 쓰기 실패')); };
      }); });
    }
    return {
      getAll: function () {
        return open().then(function (db) { return new Promise(function (res, rej) {
          var t = db.transaction('kv', 'readonly'), st = t.objectStore('kv'), out = {};
          var c = st.openCursor();
          c.onsuccess = function () { var cur = c.result; if (cur) { out[cur.key] = cur.value; cur.continue(); } };
          t.oncomplete = function () { res(out); };
          t.onerror = t.onabort = function () { rej(t.error); };
        }); });
      },
      put: function (k, v) { return tx('readwrite', function (st) { st.put(v, k); }); },
      del: function (k) { return tx('readwrite', function (st) { st.delete(k); }); }
    };
  }

  var api = { create: create, browserIdb: browserIdb, MARK: MARK };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.KcareerKV = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
