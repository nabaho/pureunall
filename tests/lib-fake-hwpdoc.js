/* 가짜 한글 문서 — rhwp HwpDocument 중 «원본 살려 고치기» 가 쓰는 부분만 흉내 낸다.
   진짜 엔진(8MB wasm)을 검사에 싣지 않으려고 만들었다. 동작은 진짜 엔진에서 잰 대로다:
   · 넣은 글자는 «바로 앞 글자» 모양을 받는다(맨 앞이면 뒤 글자)
   · 문단을 쪼개면 새 문단은 쪼갠 문단의 문단 모양을 받는다
   · 표에 줄을 넣으면 그 뒤 칸 번호가 한 줄(열 수)만큼 밀린다
   문단: { t:'글', cs:[글자마다 모양 번호], ps:문단 모양 번호 } */
'use strict';

function para(t, cs, ps) {
  t = String(t);
  const arr = Array.isArray(cs) ? cs.slice() : new Array(t.length).fill(cs == null ? 1 : cs);
  return { t, cs: arr, ps: ps == null ? 1 : ps };
}
/* 조 한 줄 — 머리(「제3조(목적)」)는 head 모양, 나머지는 body 모양 */
function art(t, head, body, ps) {
  const m = /^\s*제\s*\d+\s*조(?:\s*의\s*\d+)?\s*(?:[(（][^)）]*[)）])?/.exec(t);
  const h = m ? m[0].length : 0;
  return para(t, [...t].map((_, i) => (i < h ? head : body)), ps);
}

class FakeDoc {
  constructor(sections, tables) {
    this.S = sections.map(s => s.map(p => (typeof p === 'string' ? para(p) : p)));
    this.T = tables || {};                     // '구역|문단|컨트롤' → { cols, cells:[[문단…],…] }
  }
  _p(sec, k) { const p = this.S[sec][k]; if (!p) throw new Error('없는 문단 ' + sec + '/' + k); return p; }
  _tb(sec, pp, ci) { const t = this.T[sec + '|' + pp + '|' + ci]; if (!t) throw new Error('없는 표'); return t; }
  _c(sec, pp, ci, cell, k) { const c = this._tb(sec, pp, ci).cells[cell]; if (!c) throw new Error('없는 칸 ' + cell); if (k === undefined) return c; const p = c[k]; if (!p) throw new Error('없는 칸 문단 ' + cell + '/' + k); return p; }
  static _ins(p, off, s) {
    const id = off > 0 ? p.cs[off - 1] : (p.cs[0] != null ? p.cs[0] : 1);
    p.t = p.t.slice(0, off) + s + p.t.slice(off);
    p.cs.splice(off, 0, ...new Array(s.length).fill(id));
  }
  static _del(p, off, n) { p.t = p.t.slice(0, off) + p.t.slice(off + n); p.cs.splice(off, n); }
  static _split(list, k, off) {
    const p = list[k];
    const q = { t: p.t.slice(off), cs: p.cs.slice(off), ps: p.ps };
    p.t = p.t.slice(0, off); p.cs = p.cs.slice(0, off);
    list.splice(k + 1, 0, q);
  }
  /* 본문 */
  getSectionCount() { return this.S.length; }
  getParagraphCount(s) { return this.S[s].length; }
  getParagraphLength(s, k) { return this._p(s, k).t.length; }
  getTextRange(s, k, o, n) { return this._p(s, k).t.substr(o, n); }
  insertText(s, k, o, t) { FakeDoc._ins(this._p(s, k), o, t); return '{"ok":true}'; }
  deleteText(s, k, o, n) { FakeDoc._del(this._p(s, k), o, n); return '{"ok":true}'; }
  splitParagraph(s, k, o) { FakeDoc._split(this.S[s], k, o); this._shiftTables(s, k, +1); return '{"ok":true}'; }
  mergeParagraph(s, k) {
    const a = this._p(s, k - 1), b = this._p(s, k);
    a.t += b.t; a.cs = a.cs.concat(b.cs); this.S[s].splice(k, 1); this._shiftTables(s, k - 1, -1);
    return '{"ok":true}';
  }
  /* 본문 문단이 늘거나 줄면 그 뒤에 걸린 표의 «걸린 문단 번호» 도 밀린다 */
  _shiftTables(s, k, d) {
    const moved = {};
    Object.keys(this.T).forEach(key => {
      const [ts, pp, ci] = key.split('|').map(Number);
      const np = (ts === s && pp > k) ? pp + d : pp;
      moved[ts + '|' + np + '|' + ci] = this.T[key];
    });
    this.T = moved;
  }
  getCharPropertiesAt(s, k, o) { const p = this._p(s, k); return JSON.stringify({ charShapeId: p.cs[Math.min(o, p.cs.length - 1)] }); }
  setCharShapeId(s, k, a, b, id) { const p = this._p(s, k); for (let i = a; i < b; i++) p.cs[i] = id; return '{"ok":true}'; }
  getParaPropertiesAt(s, k) { return JSON.stringify({ paraShapeId: this._p(s, k).ps }); }
  setParaShapeId(s, k, id) { this._p(s, k).ps = id; return '{"ok":true}'; }
  /* 표 칸 */
  getCellParagraphCount(s, pp, ci, c) { return this._c(s, pp, ci, c).length; }
  getCellParagraphLength(s, pp, ci, c, k) { return this._c(s, pp, ci, c, k).t.length; }
  getTextInCell(s, pp, ci, c, k, o, n) { return this._c(s, pp, ci, c, k).t.substr(o, n); }
  insertTextInCell(s, pp, ci, c, k, o, t) { FakeDoc._ins(this._c(s, pp, ci, c, k), o, t); return '{"ok":true}'; }
  deleteTextInCell(s, pp, ci, c, k, o, n) { FakeDoc._del(this._c(s, pp, ci, c, k), o, n); return '{"ok":true}'; }
  splitParagraphInCell(s, pp, ci, c, k, o) { FakeDoc._split(this._c(s, pp, ci, c), k, o); return '{"ok":true}'; }
  deleteRangeInCell(s, pp, ci, c, sp, so, ep, eo) {
    const L = this._c(s, pp, ci, c), a = L[sp], b = L[ep];
    const tail = { t: b.t.slice(eo), cs: b.cs.slice(eo) };
    a.t = a.t.slice(0, so) + tail.t; a.cs = a.cs.slice(0, so).concat(tail.cs);
    L.splice(sp + 1, ep - sp);
    return '{"ok":true}';
  }
  getCellCharPropertiesAt(s, pp, ci, c, k, o) { const p = this._c(s, pp, ci, c, k); return JSON.stringify({ charShapeId: p.cs[Math.min(o, p.cs.length - 1)] }); }
  setCharShapeIdInCell(s, pp, ci, c, k, a, b, id) { const p = this._c(s, pp, ci, c, k); for (let i = a; i < b; i++) p.cs[i] = id; return '{"ok":true}'; }
  getCellParaPropertiesAt(s, pp, ci, c, k) { return JSON.stringify({ paraShapeId: this._c(s, pp, ci, c, k).ps }); }
  setCellParaShapeId(s, pp, ci, c, k, id) { this._c(s, pp, ci, c, k).ps = id; return '{"ok":true}'; }
  getCellInfo(s, pp, ci, c) { const t = this._tb(s, pp, ci); return JSON.stringify({ row: Math.floor(c / t.cols), col: c % t.cols, rowSpan: 1, colSpan: 1 }); }
  getTableDimensions(s, pp, ci) { const t = this._tb(s, pp, ci); return JSON.stringify({ rowCount: t.cells.length / t.cols, colCount: t.cols, cellCount: t.cells.length }); }
  insertTableRow(s, pp, ci, row, below) {
    const t = this._tb(s, pp, ci), at = (below ? row + 1 : row) * t.cols;
    const fresh = [];
    for (let c = 0; c < t.cols; c++) { const up = t.cells[row * t.cols + c][0]; fresh.push([{ t: '', cs: [], ps: up.ps }]); }
    t.cells.splice(at, 0, ...fresh);
    return JSON.stringify({ ok: true, rowCount: t.cells.length / t.cols, colCount: t.cols });
  }
  /* 찾기 — 진짜 엔진처럼 본문과 칸을 문서 순서로 */
  searchAllText(q) {
    const out = [];
    this.S.forEach((ps, s) => ps.forEach((p, k) => {
      let i = p.t.indexOf(q); while (i >= 0) { out.push({ sec: s, para: k, charOffset: i, length: q.length }); i = p.t.indexOf(q, i + 1); }
      Object.keys(this.T).forEach(key => {
        const [ts, pp, ci] = key.split('|').map(Number);
        if (ts !== s || pp !== k) return;
        this.T[key].cells.forEach((cell, c) => cell.forEach((cp, ck) => {
          let j = cp.t.indexOf(q); while (j >= 0) { out.push({ sec: s, para: pp, charOffset: j, length: q.length, cellContext: { parentPara: pp, ctrlIdx: ci, cellIdx: c, cellPara: ck } }); j = cp.t.indexOf(q, j + 1); }
        }));
      });
    }));
    return JSON.stringify(out);
  }
  /* 검사용 — 본문 한 구역의 글을 줄로 */
  lines(s) { return this.S[s].map(p => p.t); }
  cellLines(key, c) { return this.T[key].cells[c].map(p => p.t); }
  clone() { return new FakeDoc(JSON.parse(JSON.stringify(this.S)), JSON.parse(JSON.stringify(this.T))); }
}

module.exports = { FakeDoc, para, art };
