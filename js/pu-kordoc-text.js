/* ══════════════════════════════════════════════════════════════════
   pu-kordoc-text.js — kordoc 로 원본을 읽어 «규정관리가 읽는 글» 로 (2026-09-30)

   kordoc(vendor/kordoc, MIT)는 한글·워드 문서를 문단·제목·표로 돌려준다. 표를 칸 그대로
   돌려주므로, 노동부 표준취업규칙처럼 «조문 칸 | 해설(작성시 착안사항) 칸» 인 큰 표에서
   조문 칸만 정확히 집을 수 있다 — 글줄 모양으로 해설을 짐작해 떼던 것(stripCommentary)보다 정확하다.

   ⚠ 브라우저 안에서만 읽는다(원본을 서버로 보내지 않는다). 묶음은 1.4MB 라 쓸 때 처음 한 번 싣는다.
   ⚠ 못 읽으면(PDF·RTF·ODT·엔진 실패) null — 부르는 쪽이 예전 읽개로 돌아간다.
   ══════════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';
  if (!root || root.PuKordocText) return;

  var SRC = 'vendor/kordoc/kordoc.browser.min.js?v=1';
  var TAG = /^\s*(\[(?:필수|선택)(?:\s*[,·ㆍ]\s*(?:필수|선택))*\]|☞|◈)/;
  var mod = null;

  function load() {
    if (!mod) mod = import(new URL(SRC, root.location ? root.location.href : 'http://x/').href);
    return mod;
  }
  /* 한글(.hwp=OLE2)·ZIP(.hwpx·.docx·.xlsx) 만 — PDF 는 이 묶음에 PDF 부품이 없어 예전 읽개가 읽는다 */
  function canRead(buf) {
    var b = buf instanceof Uint8Array ? buf : new Uint8Array(buf || []);
    if (b.length < 8) return false;
    if (b[0] === 0xD0 && b[1] === 0xCF && b[2] === 0x11 && b[3] === 0xE0) return true;
    return b[0] === 0x50 && b[1] === 0x4B;
  }
  function cellText(c) { return c ? String(c.text || '').replace(/\r/g, '') : ''; }

  /* 해설판 표인가 — 머리 줄에 「착안사항」 이 있거나, 둘째 칸이 [필수]·[선택]·☞ 로 시작하는 줄이 절반 넘을 때.
     해설 칸 번호를 돌려준다(없으면 -1) */
  function commentaryCol(t) {
    var rows = t.cells || [];
    for (var r = 0; r < Math.min(rows.length, 2); r++) {
      for (var c = 1; c < (rows[r] || []).length; c++) if (/착안\s*사항/.test(cellText(rows[r][c]))) return c;
    }
    if ((t.cols || 0) < 2) return -1;
    var body = rows.filter(function (row) { return row && row.length >= 2 && cellText(row[0]).trim(); });
    if (body.length < 2) return -1;
    var tagged = body.filter(function (row) { return TAG.test(cellText(row[1])); }).length;
    return tagged * 2 > body.length ? 1 : -1;
  }

  /* 블록 → 글. 문단·제목은 한 덩이씩(빈 줄로 가름), 표는 칸마다 한 덩이 —
     해설판 표는 조문 칸만. 머리 줄(「취업규칙(안)」 따위)은 뺀다 */
  function toText(blocks) {
    var out = [], cut = 0, tables = 0;
    (blocks || []).forEach(function (b) {
      if (!b) return;
      if (b.type === 'table' && b.table) {
        tables++;
        var t = b.table, cc = commentaryCol(t);
        (t.cells || []).forEach(function (row, r) {
          if (!row) return;
          if (cc >= 0) {
            if (r === 0 && (row[0] && row[0].isHeader || /착안\s*사항/.test(row.map(cellText).join(' ')))) return;
            if (row[cc] && cellText(row[cc]).trim()) cut++;
            row.forEach(function (c, i) { if (i !== cc && cellText(c).trim()) out.push(cellText(c)); });
            return;
          }
          row.forEach(function (c) { if (cellText(c).trim()) out.push(cellText(c)); });
        });
        return;
      }
      var s = String(b.text || '');
      if (s.trim()) out.push(s);
    });
    return { text: out.join('\n\n'), commentaryCells: cut, tables: tables };
  }

  /* 읽기 — 성공하면 { text, commentaryCells, tables, via:'kordoc' }, 못 읽으면 null */
  async function read(buf) {
    if (!canRead(buf)) return null;
    var K = await load();
    var r = await K.parse(new Uint8Array(buf instanceof ArrayBuffer ? buf.slice(0) : buf), { ocr: false });
    if (!r || !r.success || !Array.isArray(r.blocks)) return null;
    var o = toText(r.blocks);
    if (o.text.replace(/\s/g, '').length < 20) return null;
    o.via = 'kordoc';
    return o;
  }

  root.PuKordocText = { SRC: SRC, load: load, canRead: canRead, toText: toText, commentaryCol: commentaryCol, read: read };
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));

if (typeof module !== 'undefined' && module.exports) {
  module.exports = (typeof window !== 'undefined' ? window : globalThis).PuKordocText;
}
