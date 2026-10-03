/* ══════════════════════════════════════════════════════════════════
   pu-hwp-mark.js — 바꿀 자리 만들기 (설계 2026-09-29 §4, 대표 「pr2 진행」 2026-10-03)
   한글 원본에서 글자를 찾아 {{표시}} 나 고친 글자로 바꾼다. 엔진(rhwp HwpDocument)을 받아 쓸 뿐
   싣지 않는다 — 검사는 흉내 문서로 돈다(tests/hwp-mark.test.js).
   ⚠ 여러 자리는 «문서 뒤쪽부터» — 앞을 바꾸면 뒤 위치가 밀린다(pu-hwp-keep 규칙 ④와 같은 까닭).
   ⚠ 바꾼 뒤 그 자리를 다시 읽어 확인한다 — 겹친 표 등에서 엔진 위치가 어긋나면 조용히 망가지지 않게.
   ══════════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';
  var CTX = 12;
  var COMMON = ['수신자', '참조', '송부일자', '호칭', '담당노무사', '노무사연락처', '견적금액', '부가세', '비용합계', '기간',
    '회사명', '대표자', '주소', '계약일', '계약금액', '위임사무'];
  function J(s) { if (typeof s !== 'string') return s; try { return JSON.parse(s); } catch (e) { return null; } }
  function markName(s) {
    var n = String(s == null ? '' : s).trim().replace(/^\x7b\x7b/, '').replace(/\x7d\x7d$/, '').trim();
    if (!n || n.length > 30 || /[\x7b\x7d\n]/.test(n)) return '';
    return '\x7b\x7b' + n + '\x7d\x7d';
  }
  /* 한 자리의 읽기·쓰기 손잡이 — 본문 문단과 표 칸 문단을 같은 꼴로 */
  function at(doc, h) {
    if (h.cell) {
      var a = [h.sec, h.cell.pp, h.cell.ci, h.cell.ci2, h.cell.cp];
      return {
        len: function () { return doc.getCellParagraphLength.apply(doc, a); },
        text: function (o, n) { return doc.getTextInCell.apply(doc, a.concat([o, n])); },
        del: function (o, n) { return doc.deleteTextInCell.apply(doc, a.concat([o, n])); },
        ins: function (o, t) { return doc.insertTextInCell.apply(doc, a.concat([o, t])); }
      };
    }
    return {
      len: function () { return doc.getParagraphLength(h.sec, h.para); },
      text: function (o, n) { return doc.getTextRange(h.sec, h.para, o, n); },
      del: function (o, n) { return doc.deleteText(h.sec, h.para, o, n); },
      ins: function (o, t) { return doc.insertText(h.sec, h.para, o, t); }
    };
  }
  function hitsOf(doc, find) {
    find = String(find == null ? '' : find);
    if (!find) return [];
    var raw = J(doc.searchAllText(find, true, true)) || [];
    return raw.map(function (r, i) {
      var c = r.cellContext;
      var h = { i: i, sec: r.sec, para: r.para, off: r.charOffset,
        cell: c ? { pp: c.parentPara, ci: c.ctrlIdx, ci2: c.cellIdx, cp: c.cellPara } : null, before: '', after: '' };
      try {
        var p = at(doc, h), L = p.len(), b0 = Math.max(0, h.off - CTX), a0 = h.off + find.length;
        h.before = p.text(b0, h.off - b0);
        h.after = a0 < L ? p.text(a0, Math.min(CTX, L - a0)) : '';
      } catch (e) {}
      return h;
    });
  }
  /* 문서 뒤쪽이 먼저 오게 — 구역 · 문단 · (표 칸이면 칸 위치) · 글자 위치 */
  function key(h) { return [h.sec, h.para, h.cell ? 1 : 0, h.cell ? h.cell.ci : 0, h.cell ? h.cell.ci2 : 0, h.cell ? h.cell.cp : 0, h.off]; }
  function cmpDesc(a, b) { var x = key(a), y = key(b); for (var i = 0; i < x.length; i++) { if (x[i] !== y[i]) return y[i] - x[i]; } return 0; }
  function apply(doc, find, to, which) {
    find = String(find == null ? '' : find); to = String(to == null ? '' : to);
    var hits = hitsOf(doc, find), pick;
    if (which === 'all') pick = hits.slice();
    else pick = (typeof which === 'number' && hits[which]) ? [hits[which]] : [];
    pick.sort(cmpDesc);
    var count = 0, failed = 0;
    pick.forEach(function (h) {
      try {
        var p = at(doc, h);
        J(p.del(h.off, find.length));
        if (to) J(p.ins(h.off, to));
        if (p.text(h.off, to.length) === to) count++; else failed++;
      } catch (e) { failed++; }
    });
    return { count: count, failed: failed };
  }
  var api = { COMMON: COMMON, markName: markName, hitsOf: hitsOf, apply: apply };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PuHwpMark = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
