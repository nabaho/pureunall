/* 취업규칙(새) — 「🏢 사업장」 표의 거르기·순서·쪽 셈 (설계 §12 · 2026-10-12 대표 「추천대로」)
   순수 모듈. 아무것도 쓰지 않고 저장하지 않는다 — 조건은 화면 상태(ST.sites)에만 산다.
   칸 안은 «또는», 칸끼리는 «그리고». 한 곳이 확정·후보를 둘 다 가지면 «자료» 칸의 두 값에 모두 속한다.
   빈 값·모름은 순서에서 오름·내림 모두 맨 끝. */
(function (root) {
  'use strict';
  var SIZE = 50;
  var KEYS = ['band', 'biz', 'docs', 'last', 'fin'];
  var SORT_OF = { name: 'name', band: 'size', biz: 'biz', who: 'who', docs: 'docs', last: 'last', fin: 'fin' };
  var BANDS = ['5인 미만', '5~9인', '10~29인', '30인 이상'];
  var LABEL_DOCS = { linked: '확정 있음', cand: '후보 있음', none: '자료 없음' };
  var LABEL_FIN = { set: '정함', none: '미정', '': '확정 자료 없음' };
  var COL_NAME = { name: '사업장', band: '규모', biz: '업태', who: '담당', docs: '취업규칙 자료', last: '최근', fin: '★최종본' };
  function str(v) { return v == null ? '' : String(v); }
  // 최근 메일 연도 — 한국 시간(서머타임 없음 +9시간)
  function yearOf(ms) { return Number(ms) > 0 ? String(new Date(Number(ms) + 9 * 36e5).getUTCFullYear()) : ''; }

  function tagsOf(r, key) {
    if (key === 'band') return [str(r.band)];
    if (key === 'biz') return [str(r.bizType)];
    if (key === 'last') return [yearOf(r.last)];
    if (key === 'fin') return [str(r.fin && r.fin.state)];
    if (key === 'docs') {
      var t = [];
      if (r.linked > 0) t.push('linked');
      if (r.cand > 0) t.push('cand');
      if (!t.length) t.push('none');
      return t;
    }
    return [];
  }
  function apply(rows, cols, exceptKey) {
    cols = cols || {};
    var act = KEYS.filter(function (k) { return k !== exceptKey && Array.isArray(cols[k]) && cols[k].length; });
    if (!act.length) return (rows || []).slice();
    return (rows || []).filter(function (r) {
      return act.every(function (k) {
        return tagsOf(r, k).some(function (v) { return cols[k].indexOf(v) >= 0; });
      });
    });
  }
  function labelOf(key, v) {
    if (v === '') return key === 'band' ? '(모름)' : key === 'last' ? '(없음)' : key === 'fin' ? LABEL_FIN[''] : '(비어 있음)';
    if (key === 'docs') return LABEL_DOCS[v] || v;
    if (key === 'fin') return LABEL_FIN[v] || v;
    return v;
  }
  function options(rows, key, cols) {
    var left = apply(rows, cols, key), n = {}, sel = ((cols || {})[key] || []).slice();
    left.forEach(function (r) { tagsOf(r, key).forEach(function (v) { n[v] = (n[v] || 0) + 1; }); });
    sel.forEach(function (v) { if (!(v in n)) n[v] = 0; });
    var vs = Object.keys(n);
    // 규모 값은 BANDS 네 개뿐이다 — lib-sites.js band() 가 이 네 라벨만 만든다(그 밖의 값은 생기지 않는다)
    if (key === 'band') vs = BANDS.filter(function (v) { return v in n; }).concat('' in n ? [''] : []);
    else if (key === 'docs') vs = ['linked', 'cand', 'none'].filter(function (v) { return v in n; });
    else if (key === 'fin') vs = ['set', 'none', ''].filter(function (v) { return v in n; });
    else if (key === 'last') vs = vs.filter(function (v) { return v; }).sort().reverse().concat('' in n ? [''] : []);
    else vs = vs.filter(function (v) { return v; }).sort(function (a, b) { return n[b] - n[a] || a.localeCompare(b, 'ko'); })
      .concat('' in n ? [''] : []);
    return vs.map(function (v) { return { v: v, label: labelOf(key, v), n: n[v] }; });
  }

  // 순서 — 값이 «없음»이면 방향과 상관없이 맨 끝. 안정(원래 차례가 동점을 가른다)
  function sortValue(r, key, nameOf) {
    if (key === 'name') return str(r.name) || null;
    if (key === 'size') return r.size > 0 ? r.size : null;
    if (key === 'biz') return str(r.bizType) || null;
    if (key === 'who') {
      // 사번은 있는데 이름을 못 찾으면(퇴사·모름) '' 또는 undefined → 빈 값으로 보고 맨 끝
      var w = r.mgr || (r.subs || [])[0] || '';
      return w ? (str(nameOf ? nameOf(w) : w) || null) : null;
    }
    // 자료 0건(확정·후보 둘 다 없음)은 «값 없음» — 오름·내림 모두 맨 끝 (규모 0 과 같다)
    if (key === 'docs') { var n = (r.linked || 0) + (r.cand || 0); return n > 0 ? n : null; }
    if (key === 'last') return r.last > 0 ? r.last : null;
    // 오름: 정함 → 미정 → 없음 (없음은 내림에서도 끝)
    if (key === 'fin') return r.fin && r.fin.state === 'set' ? 1 : r.fin && r.fin.state === 'none' ? 2 : null;
    return null;
  }
  function sortRows(rows, sort, nameOf) {
    var list = (rows || []).slice();
    if (!sort || !sort.key) return list;
    var dir = sort.dir === 'desc' ? -1 : 1;
    var idx = list.map(function (r, i) { return { r: r, i: i, v: sortValue(r, sort.key, nameOf) }; });
    idx.sort(function (a, b) {
      if (a.v === null && b.v === null) return a.i - b.i;
      if (a.v === null) return 1;
      if (b.v === null) return -1;
      var c = typeof a.v === 'number' && typeof b.v === 'number' ? a.v - b.v : String(a.v).localeCompare(String(b.v), 'ko');
      return c ? c * dir : a.i - b.i;
    });
    return idx.map(function (x) { return x.r; });
  }

  function page(list, p, size) {
    size = size || SIZE;
    var total = (list || []).length, pages = Math.max(1, Math.ceil(total / size));
    var cur = Math.min(pages, Math.max(1, Number(p) || 1));
    var from = total ? (cur - 1) * size + 1 : 0, to = Math.min(total, cur * size);
    return { items: (list || []).slice(total ? from - 1 : 0, to), page: cur, pages: pages, total: total, from: from, to: to };
  }
  function pageWindow(page, pages) {
    var out = [], i;
    if (pages <= 7) { for (i = 1; i <= pages; i++) out.push(i); return out; }
    var a = Math.max(2, page - 1), b = Math.min(pages - 1, page + 1);
    if (page <= 3) { a = 2; b = 4; }
    if (page >= pages - 2) { a = pages - 3; b = pages - 1; }
    out.push(1);
    if (a > 2) out.push('…');
    for (i = a; i <= b; i++) out.push(i);
    if (b < pages - 1) out.push('…');
    out.push(pages);
    return out;
  }
  function conditions(cols) {
    cols = cols || {};
    return KEYS.filter(function (k) { return Array.isArray(cols[k]) && cols[k].length; }).map(function (k) {
      var text = cols[k].map(function (v) { return labelOf(k, v); }).join(', ');
      return { key: k, title: COL_NAME[k], text: COL_NAME[k] + ': ' + text };
    });
  }

  var api = { SIZE: SIZE, KEYS: KEYS, SORT_OF: SORT_OF, LABEL_DOCS: LABEL_DOCS, LABEL_FIN: LABEL_FIN, COL_NAME: COL_NAME,
    tagsOf: tagsOf, apply: apply, options: options, sortRows: sortRows, page: page, pageWindow: pageWindow, conditions: conditions };
  if (root) root.PuRulesV2SiteCols = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
