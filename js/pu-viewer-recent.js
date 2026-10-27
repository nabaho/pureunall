/* pu-viewer-recent.js — 문서뷰어: 「최근 연 파일」 목록 (2026-10-25)
   ------------------------------------------------------------------
   ★ 담는 것은 «이름·크기·형식·연 때» 넷뿐이다. 파일 내용은 절대 안 담는다.
     (폰을 잃어버려도 고객 자료가 남지 않게 — 대표 결정 2026-10-25 「최근 파일은 이름만」)
   ★ 목록은 이 기기 브라우저(localStorage)에만 있다. 서버로 안 간다.
   ★ 번호는 «보는 번호»다 — 저장하지 않는다(그리는 쪽이 보이는 순서로 매긴다).
   ------------------------------------------------------------------ */
(function (global) {
  'use strict';

  var KEY = 'pu_viewer_recent_v1';
  var MAX_ITEMS = 30;
  var MAX_NAME = 200;

  function clean(r) {
    if (!r || typeof r !== 'object') return null;
    var name = String(r.name == null ? '' : r.name).slice(0, MAX_NAME);
    if (!name) return null;
    var size = Number(r.size); if (!isFinite(size) || size < 0) size = 0;
    var at = Number(r.at); if (!isFinite(at) || at <= 0) at = 0;
    return {
      id: String(r.id || (at + '-' + name)).slice(0, 80),
      name: name, size: size,
      kind: String(r.kind || '').slice(0, 8),
      at: at
    };
  }

  function sanitize(list) {
    var out = [];
    (Array.isArray(list) ? list : []).forEach(function (r) { var c = clean(r); if (c) out.push(c); });
    return out.slice(0, MAX_ITEMS);
  }

  function store() { try { return global.localStorage || null; } catch (_) { return null; } }

  function load() {
    var s = store();
    if (!s) return [];
    try { return sanitize(JSON.parse(s.getItem(KEY) || '[]')); } catch (_) { return []; }
  }

  function save(list) {
    var s = store();
    if (!s) return false;
    try { s.setItem(KEY, JSON.stringify(sanitize(list))); return true; } catch (_) { return false; }
  }

  /* 같은 이름·크기를 다시 열면 맨 위로 올린다 — 중복으로 쌓지 않는다 */
  function add(list, rec, now) {
    var at = now || Date.now();
    var c = clean({ name: rec && rec.name, size: rec && rec.size, kind: rec && rec.kind, at: at, id: at + '-' + (rec && rec.name) });
    if (!c) return sanitize(list);
    var rest = sanitize(list).filter(function (r) { return !(r.name === c.name && r.size === c.size); });
    return [c].concat(rest).slice(0, MAX_ITEMS);
  }

  /* 고른 줄(id)만 «목록에서 뺀다» — 파일 자체는 건드리지 않는다 */
  function removeIds(list, ids) {
    var drop = {};
    (ids || []).forEach(function (i) { drop[i] = true; });
    return sanitize(list).filter(function (r) { return !drop[r.id]; });
  }

  var api = { KEY: KEY, MAX_ITEMS: MAX_ITEMS, sanitize: sanitize, load: load, save: save, add: add, removeIds: removeIds };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.PuViewerRecent = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
