/* 정부사업신청 — 기기 사이 «합치기» (순수 모듈, DOM·통신 없음) (2026-10-04)

   ⚠★ 사고(2026-10-04 실측): 옛 판 화면이 gov/{uid} 를 «통째로» set() 하면서 그 판이 모르는
      「컨설턴트 모집」 칸(recruit)을 통째로 지웠다. 오후 3시에 있던 서류 276건이 4시 55분에 없었다.
      통째 덮어쓰기는 «옛 판»도 «낡은 기기»도 새 자료를 지운다.
   ★ 그래서 세 가지로 바꾼다
     ① 칸마다 따로 쓴다(update) — 내가 안 건드린 칸은 클라우드에서 그대로다.
     ② 기록 «한 줄마다» 고친 시각(stamp)을 남기고, 합칠 때 더 나중에 고친 쪽이 이긴다.
        지운 줄도 시각을 남긴다(지운 시각) — 안 그러면 다른 기기의 옛 줄이 «되살아난다».
     ③ 옛 판의 통째 쓰기는 보안규칙이 막는다(sv ≥ 2 인 쓰기만 받는다 — scripts/make-firebase-rules.js).
   ⚠ 값의 모양은 그대로다(푸른 캘린더 pu-cal-recruit.js 가 gov/{uid}/recruit/* 를 읽는다). 시각은 따로 stamp/ 에.
   ⚠ RTDB 열쇠에 못 쓰는 글자(. # $ / [ ])는 «_»로 바꾼다 — 메일 폴더 「3.컨설팅」의 «.» 하나로
     클라우드 저장이 통째로 멈췄다(검토 2026-10-04). */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GovSync = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  /* 칸 목록 — 이 한 곳에서만 정한다(저장·받기·합치기가 모두 이것을 본다).
     kind: scalar(글자 하나) · whole(통째로 한 덩이 — 다시 읽으면 되는 것) · map(열쇠→값) · rows(배열, idf 로 줄을 가른다) */
  var FIELDS = [
    { ls: 'feed',               path: 'feed',               kind: 'rows', idf: 'no' },
    { ls: 'kw',                 path: 'kw',                 kind: 'scalar' },
    { ls: 'key_data',           path: 'key_data',           kind: 'scalar' },
    { ls: 'key_biz',            path: 'key_biz',            kind: 'scalar' },
    { ls: 'last',               path: 'last',               kind: 'scalar' },
    { ls: 'last_at',            path: 'last_at',            kind: 'scalar' },   /* 마지막으로 받은 때 (#1946) */
    { ls: 'recruit_scan',       path: 'recruit/scan',       kind: 'whole' },
    { ls: 'recruit_at',         path: 'recruit/at',         kind: 'scalar' },
    { ls: 'recruit_log',        path: 'recruit/log',        kind: 'map' },
    { ls: 'recruit_url',        path: 'recruit/url',        kind: 'map' },
    { ls: 'recruit_custom',     path: 'recruit/custom',     kind: 'rows', idf: 'id' },
    { ls: 'recruit_seen',       path: 'recruit/seen',       kind: 'map' },
    { ls: 'recruit_mailitems',  path: 'recruit/mailitems',  kind: 'whole' },
    { ls: 'recruit_mail_at',    path: 'recruit/mail_at',    kind: 'scalar' },
    { ls: 'recruit_mailfolders',path: 'recruit/mailfolders',kind: 'scalar' },
    { ls: 'recruit_mailmap',    path: 'recruit/mailmap',    kind: 'map' },
    { ls: 'recruit_mailskip',   path: 'recruit/mailskip',   kind: 'map' },
    { ls: 'recruit_need',       path: 'recruit/need',       kind: 'map' },
    { ls: 'recruit_due',        path: 'recruit/due',        kind: 'map' }    /* 글마다 사람이 넣은 마감일 (2026-10-05) */
  ];
  var SV = 2;   /* 이 판의 쓰기 표 — 보안규칙이 이 값 이상만 받는다 */
  var byLs = {};
  FIELDS.forEach(function (f) { byLs[f.ls] = f; });
  function field(ls) { return byLs[ls] || null; }

  function safeKey(k) { return String(k == null ? '' : k).replace(/[.#$\/\[\]]/g, '_') || '_'; }
  function same(a, b) { return JSON.stringify(a === undefined ? null : a) === JSON.stringify(b === undefined ? null : b); }
  function isObj(v) { return v && typeof v === 'object' && !Array.isArray(v); }

  /* 값 → {열쇠: 값} (열쇠는 safeKey) */
  function entries(f, v) {
    var out = {};
    if (f.kind === 'scalar' || f.kind === 'whole') {
      var empty = f.kind === 'scalar' ? (v == null || v === '') : !(Array.isArray(v) && v.length);
      if (!empty) out._ = v;
      return out;
    }
    if (f.kind === 'map') {
      if (isObj(v)) Object.keys(v).forEach(function (k) { if (v[k] != null) out[safeKey(k)] = v[k]; });
      return out;
    }
    /* rows — RTDB 는 배열을 {0:…,1:…} 로 돌려줄 때도 있다 */
    var arr = Array.isArray(v) ? v : (isObj(v) ? Object.keys(v).map(function (k) { return v[k]; }) : []);
    arr.forEach(function (r) { if (r && r[f.idf] != null && r[f.idf] !== '') out[safeKey(r[f.idf])] = r; });
    return out;
  }
  /* {열쇠: 값} → 값. rows 는 order(먼저 본 열쇠 차례)를 따른다 */
  function fromEntries(f, e, order) {
    if (f.kind === 'scalar') return e._ != null ? e._ : '';
    if (f.kind === 'whole') return Array.isArray(e._) ? e._ : [];
    if (f.kind === 'map') { var m = {}; Object.keys(e).forEach(function (k) { m[k] = e[k]; }); return m; }
    /* ⚠ 차례 목록에 같은 열쇠가 두 번 올 수 있다(두 기기에 다 있는 줄) — 한 번만(검사가 잡았다: 같은 공고가 두 줄이 됐다) */
    var keys = [], had = {};
    (order || []).forEach(function (k) { if (e[k] !== undefined && !had[k]) { had[k] = 1; keys.push(k); } });
    Object.keys(e).forEach(function (k) { if (!had[k]) { had[k] = 1; keys.push(k); } });
    return keys.map(function (k) { return e[k]; });
  }

  /* 고친 줄에 시각을 찍는다 — 새로 생긴 줄·바뀐 줄·«지운 줄» 모두 */
  function stampChanges(f, oldV, newV, stamps, now) {
    var a = entries(f, oldV), b = entries(f, newV), out = {};
    Object.keys(stamps || {}).forEach(function (k) { out[k] = stamps[k]; });
    var keys = Object.keys(a).concat(Object.keys(b).filter(function (k) { return !(k in a); }));
    keys.forEach(function (k) { if (!same(a[k], b[k])) out[k] = Math.max(now, (out[k] || 0) + 1); });
    return out;
  }

  /* 합치기 — 열쇠마다 더 나중에 고친 쪽이 이긴다.
     시각이 같으면(둘 다 0 = 옛 자료) 있는 쪽이 이기고, 둘 다 있으면 이 기기 것이 이긴다.
     ⚠ 지운 줄은 «시각만 있고 값이 없다» — 더 나중이면 반대쪽 값을 지운다. */
  function merge(f, localV, localSt, cloudV, cloudSt) {
    var L = entries(f, localV), C = entries(f, cloudV), ls = localSt || {}, cs = cloudSt || {};
    var keys = {}, out = {}, st = {};
    [L, C, ls, cs].forEach(function (o) { Object.keys(o).forEach(function (k) { keys[k] = 1; }); });
    Object.keys(keys).forEach(function (k) {
      var lt = ls[k] || 0, ct = cs[k] || 0, v;
      if (lt > ct) v = L[k];
      else if (ct > lt) v = C[k];
      else v = (L[k] !== undefined) ? L[k] : C[k];
      if (v !== undefined) out[k] = v;
      var t = Math.max(lt, ct); if (t) st[k] = t;
    });
    var order = f.kind === 'rows' ? Object.keys(L).concat(Object.keys(C)) : null;
    var value = fromEntries(f, out, order);
    return { value: value, stamps: st,
      localChanged: !same(entries(f, value), L) || !same(st, ls),
      cloudChanged: !same(entries(f, value), C) || !same(st, cs) };
  }

  /* 클라우드에 쓸 모양 — map 열쇠를 safeKey 로(값은 그대로) */
  function toCloud(f, v) {
    if (f.kind === 'map') return entries(f, v);
    if (f.kind === 'scalar') return v == null ? '' : v;
    return Array.isArray(v) ? v : [];
  }

  /* 같은 id 를 가진 서로 다른 줄(두 기기가 따로 번호를 매겼다)이 있으면 뒤엣것에 새 번호 */
  function dedupeIds(rows, idKey, make) {
    var seen = {}, changed = 0;
    (rows || []).forEach(function (r) {
      if (!r) return;
      if (r[idKey] && !seen[r[idKey]]) { seen[r[idKey]] = 1; return; }
      var n = make(seen); r[idKey] = n; seen[n] = 1; changed++;
    });
    return changed;
  }

  return { FIELDS: FIELDS, SV: SV, field: field, safeKey: safeKey, entries: entries, fromEntries: fromEntries,
    stampChanges: stampChanges, merge: merge, toCloud: toCloud, dedupeIds: dedupeIds };
});
