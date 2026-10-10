/* PDF 글 뽑기 (설계 §11-1 · 2026-10-10 대표 「추천대로」)
   ⚠ 원본 바이트는 이 함수 안에서만 산다 — 돌려주는 것은 «가리기 전» 글이다. 담기 전에 반드시 redactOne 이 가린다.
   ⚠ pdf.js 는 처음 부를 때 한 번 싣는다(functions 의존성 pdfjs-dist, legacy 빌드). 못 실으면 code:'PDFJS_MISSING' —
     부르는 쪽은 옛 까닭(「PDF — 아직 못 읽음」)으로 남겨 다음에 다시 보게 한다. «못 읽는 PDF» 로 닫으면 안 된다.
   줄 다시 세우기: 같은 쪽·같은 높이(글자 높이의 절반 안) 조각을 한 줄로, 왼쪽부터. 틈이 글자 높이의 0.25배를 넘으면 빈칸.
   그래야 「제N조」가 줄 머리에 와서 조 나누기·조별 문안·판 견주기가 돈다. */
'use strict';
const path = require('path');
const SCAN_MIN = 30;     // 공백을 뺀 글자가 이보다 적으면 글 없는(스캔) PDF
const MAX_PAGES = 300;

let mod = null;
function load() {
  if (!mod) {
    mod = import('pdfjs-dist/legacy/build/pdf.mjs').catch(() => {
      mod = null;
      throw Object.assign(new Error('pdf.js 를 싣지 못함'), { code: 'PDFJS_MISSING' });
    });
  }
  return mod;
}
function assetDir(sub) {
  return path.join(path.dirname(require.resolve('pdfjs-dist/package.json')), sub) + path.sep;
}

function linesOf(items) {
  const byPage = {};
  (items || []).forEach((t) => {
    if (!t || !String(t.str || '').length) return;
    (byPage[t.page] = byPage[t.page] || []).push(t);
  });
  const pages = Object.keys(byPage).map(Number).sort((a, b) => a - b);
  const out = [];
  pages.forEach((pg, pi) => {
    const rows = [];
    byPage[pg].forEach((t) => {
      const h = Math.abs(Number(t.h)) || 10;
      let r = rows.find((x) => Math.abs(x.y - t.y) <= h / 2);
      if (!r) { r = { y: t.y, items: [] }; rows.push(r); }
      r.items.push(t);
    });
    rows.sort((a, b) => b.y - a.y);
    if (pi > 0) out.push('');
    rows.forEach((r) => {
      r.items.sort((a, b) => a.x - b.x);
      let s = '', end = null;
      r.items.forEach((t) => {
        const h = Math.abs(Number(t.h)) || 10;
        if (end != null && t.x - end > h * 0.25) s += ' ';
        s += String(t.str);
        end = t.x + (Number(t.w) || 0);
      });
      s = s.replace(/[ \t ]+/g, ' ').trim();
      if (s) out.push(s);
    });
  });
  return out.join('\n');
}

async function pdfText(buf) {
  const pdfjs = await load();
  const data = new Uint8Array(buf);
  const doc = await pdfjs.getDocument({ data, cMapUrl: assetDir('cmaps'), cMapPacked: true,
    standardFontDataUrl: assetDir('standard_fonts'), isEvalSupported: false, useSystemFonts: false, verbosity: 0 }).promise;
  try {
    const n = Math.min(doc.numPages, MAX_PAGES), items = [];
    for (let p = 1; p <= n; p++) {
      const pg = await doc.getPage(p);
      const tc = await pg.getTextContent();
      tc.items.forEach((t) => {
        if (!t || typeof t.str !== 'string') return;
        const tr = t.transform || [1, 0, 0, 1, 0, 0];
        items.push({ str: t.str, x: tr[4], y: tr[5], w: t.width, h: Math.abs(tr[3]) || t.height || 10, page: p });
      });
      pg.cleanup();
    }
    const text = linesOf(items);
    return { text, pages: doc.numPages, truncated: doc.numPages > MAX_PAGES, chars: text.replace(/\s/g, '').length };
  } finally {
    try { await doc.destroy(); } catch (_) { /* 닫기 실패는 무시 */ }
  }
}

module.exports = { linesOf, pdfText, SCAN_MIN, MAX_PAGES, load };
