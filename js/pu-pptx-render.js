/* 파워포인트(pptx) 슬라이드 «대략 모양» 그리기 — 강의자료 슬라이드 미리보기 (2026-11-22)
   대표 지시 「PPT 자료 원본을 작게 해 가지고 진열 보여줄 수 있을까? 그렇게 해야 어떻게 강의했는지 비교가 되는데」.

   ■ 무엇을 하나
   pptx 는 zip 안의 XML 이다. 슬라이드마다 도형·글상자·그림·표의 «자리와 크기», 글자(크기·굵기·색·정렬·글머리),
   바탕(색·그림), 테마 색을 읽어 SVG 로 다시 그린다. 원본 파일은 읽기만 한다(바꾸지 않는다).
   ⚠ «대략 모양»이다 — 파워포인트와 글꼴·줄바꿈·도형 모양(별·화살표 등은 네모로)·차트·도식(SmartArt)이 다를 수 있다.
     차트·도식·개체는 회색 칸에 이름만. EMF·WMF 그림은 브라우저가 못 그려 «그림» 칸으로.

   ■ 어디서 도나
   격리된 칸(pu-slides-frame.html, sandbox="allow-scripts" 만 — 이 사이트 로그인 증표에 손이 안 닿는다) 안에서만 그린다.
   ★ 문서에서 읽은 글자는 textContent 로만 넣는다(innerHTML 금지) · 그림은 zip 안의 바이트를 blob: 주소로만.
   ★ XML 은 이 파일의 작은 해석기(xml)로 읽는다 — 브라우저·node 검사 둘 다 같은 코드로 돈다.

   parse(JSZip, buf, {maxSlides}) → Promise<model>  · draw(model, slideIndex, document, urlOf) → <svg>
   model = { w, h(pt), slides:[{ no, title, bg:{color|img}, shapes:[…] }], media:{ 'ppt/media/x.png': true } } */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PuPptx = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var EMU_PT = 12700;                 /* 1pt = 12700 EMU */
  var MAX_SLIDES = 300;
  /* 한도 — 남의 파일(메일·PC)이라 «작은 zip 이 풀면 엄청 커지는» 파일·끝없는 XML 로 칸이 멈추거나 메모리를 다 쓰지 않게 */
  var LIMIT = { xmlPart: 8 * 1048576, xmlTotal: 80 * 1048576, nodes: 400000, depth: 40, cols: 60, rows: 60, shapes: 40000 };

  /* zip 안 파일을 «실제로 풀린 바이트»를 세며 읽는다 — 선언된 크기(_data)를 믿지 않는다. 한도를 넘으면 그 자리에서 멈추고 실패 */
  function readLimited(file, limit) {
    return new Promise(function (res, rej) {
      var chunks = [], got = 0, done = false, st;
      try { st = file.internalStream('uint8array'); } catch (e) { rej(e); return; }
      st.on('data', function (c) {
        if (done) return;
        got += c.length;
        if (got > limit) { done = true; try { st.pause(); } catch (_) {} rej(new Error('자료가 너무 커서 그리지 않았습니다')); return; }
        chunks.push(c);
      }).on('error', function (e) { if (!done) { done = true; rej(e); } })
        .on('end', function () {
          if (done) return; done = true;
          var out = new Uint8Array(got), o = 0;
          chunks.forEach(function (c) { out.set(c, o); o += c.length; });
          res(out);
        });
      st.resume();
    });
  }
  function utf8(u8) { return new TextDecoder('utf-8').decode(u8); }
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var XHTML_NS = 'http://www.w3.org/1999/xhtml';

  /* ───────── 작은 XML 해석기 — { n:이름, a:{속성}, c:[자식], t:글자 } ───────── */
  function unesc(s) {
    return String(s).replace(/&(lt|gt|amp|quot|apos|#\d+|#x[0-9a-fA-F]+);/g, function (_, e) {
      if (e === 'lt') return '<'; if (e === 'gt') return '>'; if (e === 'amp') return '&'; if (e === 'quot') return '"'; if (e === 'apos') return "'";
      var n = e.charAt(1) === 'x' || e.charAt(1) === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : '';
    });
  }
  function xml(str, maxNodes) {
    var rootN = { n: '#root', a: {}, c: [], t: '' };
    var stack = [rootN], count = 0, cap = maxNodes || LIMIT.nodes;
    var re = /<!\[CDATA\[([\s\S]*?)\]\]>|<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!DOCTYPE[^>]*>|<(\/?)([A-Za-z_][\w:.-]*)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;
    var m;
    str = String(str || '');
    while ((m = re.exec(str))) {
      var top = stack[stack.length - 1];
      if (m[1] != null) { top.t += m[1]; continue; }
      if (m[3]) {
        if (m[2] === '/') { if (stack.length > 1) stack.pop(); continue; }
        if (++count > cap) throw new Error('슬라이드 구조가 너무 큽니다');
        var node = { n: m[3], a: {}, c: [], t: '' };
        var ar = /([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g, am;
        while ((am = ar.exec(m[4] || ''))) node.a[am[1]] = unesc(am[2] != null ? am[2] : am[3]);
        top.c.push(node);
        if (!m[5]) stack.push(node);
        continue;
      }
      if (m[6] != null && stack.length > 1) top.t += unesc(m[6]);
    }
    return rootN;
  }
  function kids(node, name) { return node ? node.c.filter(function (k) { return k.n === name; }) : []; }
  function kid(node, name) { if (!node) return null; for (var i = 0; i < node.c.length; i++) if (node.c[i].n === name) return node.c[i]; return null; }
  function at(node, path) { var cur = node; path.split('/').forEach(function (p) { cur = cur ? kid(cur, p) : null; }); return cur; }
  function num(v, d) { var n = parseFloat(v); return isFinite(n) ? n : d; }

  /* ───────── 경로·관계(rels) ───────── */
  function dirOf(p) { var i = p.lastIndexOf('/'); return i < 0 ? '' : p.slice(0, i + 1); }
  function joinPath(base, target) {
    if (!target) return '';
    if (target.charAt(0) === '/') return target.slice(1);
    var parts = (dirOf(base) + target).split('/'), out = [];
    parts.forEach(function (s) { if (s === '..') out.pop(); else if (s && s !== '.') out.push(s); });
    return out.join('/');
  }
  function relsPathOf(part) { return dirOf(part) + '_rels/' + part.slice(dirOf(part).length) + '.rels'; }

  /* ───────── 색 ───────── */
  var PRST = { black: '000000', white: 'FFFFFF', red: 'FF0000', green: '008000', blue: '0000FF', yellow: 'FFFF00', gray: '808080', grey: '808080',
    darkGray: 'A9A9A9', lightGray: 'D3D3D3', orange: 'FFA500', navy: '000080', purple: '800080' };
  function hexToRgb(h) { h = String(h || '000000').replace(/[^0-9a-fA-F]/g, ''); if (h.length === 3) h = h.replace(/(.)/g, '$1$1'); h = (h + '000000').slice(0, 6); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  function rgbToHex(r) { return '#' + r.map(function (v) { v = Math.max(0, Math.min(255, Math.round(v))); return (v < 16 ? '0' : '') + v.toString(16); }).join(''); }
  function rgbToHsl(c) {
    var r = c[0] / 255, g = c[1] / 255, b = c[2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, h = 0, s = 0;
    if (mx !== mn) { var d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; }
    return [h, s, l];
  }
  function hslToRgb(h, s, l) {
    function f(p, q, t) { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < 1 / 2) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p; }
    if (!s) return [l * 255, l * 255, l * 255];
    var q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    return [f(p, q, h + 1 / 3) * 255, f(p, q, h) * 255, f(p, q, h - 1 / 3) * 255];
  }
  /* 색 칸(a:solidFill 같은 것) → { c:'#rrggbb', o:불투명도 } | null.  ctx: { scheme:{dk1…}, map:{bg1:'lt1'…}, ph:{c,o} } */
  function colorOf(fillNode, ctx) {
    if (!fillNode) return null;
    var cn = null;
    for (var i = 0; i < fillNode.c.length; i++) { if (/^a:(srgbClr|schemeClr|sysClr|prstClr|scrgbClr|hslClr)$/.test(fillNode.c[i].n)) { cn = fillNode.c[i]; break; } }
    if (!cn) return null;
    var hex = '000000';
    if (cn.n === 'a:srgbClr') hex = cn.a.val;
    else if (cn.n === 'a:sysClr') hex = cn.a.lastClr || (cn.a.val === 'window' ? 'FFFFFF' : '000000');
    else if (cn.n === 'a:prstClr') hex = PRST[cn.a.val] || '000000';
    else if (cn.n === 'a:scrgbClr') hex = rgbToHex([num(cn.a.r, 0) / 1000 * 2.55, num(cn.a.g, 0) / 1000 * 2.55, num(cn.a.b, 0) / 1000 * 2.55]).slice(1);
    else if (cn.n === 'a:hslClr') hex = rgbToHex(hslToRgb(num(cn.a.hue, 0) / 21600000, num(cn.a.sat, 0) / 100000, num(cn.a.lum, 0) / 100000)).slice(1);
    else if (cn.n === 'a:schemeClr') {
      var v = cn.a.val;
      if (v === 'phClr') { if (ctx && ctx.ph) hex = ctx.ph.c.slice(1); }
      else {
        var mapped = (ctx && ctx.map && ctx.map[v]) || ({ bg1: 'lt1', tx1: 'dk1', bg2: 'lt2', tx2: 'dk2' })[v] || v;
        hex = (ctx && ctx.scheme && ctx.scheme[mapped]) || (mapped === 'lt1' ? 'FFFFFF' : mapped === 'dk1' ? '000000' : '808080');
      }
    }
    var rgb = hexToRgb(hex), o = 1;
    cn.c.forEach(function (md) {
      var val = num(md.a.val, 100000) / 100000;
      if (md.n === 'a:alpha') o = val;
      else if (md.n === 'a:tint') rgb = rgb.map(function (x) { return 255 - (255 - x) * val; });
      else if (md.n === 'a:shade') rgb = rgb.map(function (x) { return x * val; });
      else if (md.n === 'a:lumMod' || md.n === 'a:lumOff') {
        var hsl = rgbToHsl(rgb);
        hsl[2] = md.n === 'a:lumMod' ? hsl[2] * val : Math.min(1, hsl[2] + val);
        rgb = hslToRgb(hsl[0], hsl[1], hsl[2]);
      }
    });
    return { c: rgbToHex(rgb), o: o };
  }
  /* 칠하기 — spPr·bgPr 아래의 solidFill / gradFill(첫 색) / pattFill(앞색) / blipFill(그림) / noFill */
  function fillOf(node, ctx, rels, base) {
    if (!node) return undefined;
    if (kid(node, 'a:noFill')) return null;
    var s = kid(node, 'a:solidFill'); if (s) return colorOf(s, ctx);
    var g = kid(node, 'a:gradFill');
    if (g) { var gs = kids(at(g, 'a:gsLst'), 'a:gs'); if (gs.length) return colorOf(gs[Math.floor((gs.length - 1) / 2)], ctx); }
    var pt = kid(node, 'a:pattFill'); if (pt) return colorOf(kid(pt, 'a:fgClr'), ctx);
    var bf = kid(node, 'a:blipFill') || kid(node, 'p:blipFill');
    if (bf) { var img = blipOf(bf, rels, base); if (img) return { img: img }; }
    return undefined;   /* «적힌 것 없음» — 물려받을 것을 찾는다 */
  }
  function blipOf(blipFill, rels, base) {
    var b = kid(blipFill, 'a:blip'); if (!b) return '';
    var id = b.a['r:embed']; if (!id || !rels[id]) return '';
    return joinPath(base, rels[id].target);
  }

  /* ───────── 글자 ───────── */
  /* 기호 글꼴(Wingdings·Symbol)의 글머리 — 브라우저에는 그 글꼴이 없어 «v»·«n» 같은 글자로 보인다 → 비슷한 유니코드 기호로 */
  var WING = { 'v': '❖', 'Ø': '➢', 'ü': '✔', 'n': '■', 'l': '●', 'q': '❑', 'p': '□', 'o': '□', 'u': '◆', '§': '▪', 'Ÿ': '•', 'à': '→', 'è': '➔', 'Ü': '➢', 'ð': '⇒', 'ê': '✱', 'w': '◆', 'ª': '■', '¨': '◆', 'ä': '▶', 'Ö': '➢' };
  var SYM = { '·': '•', '§': '▪', 'Þ': '⇒', '®': '→' };
  function bulletChar(ch, font) {
    ch = String(ch || '•');
    if (/wingdings/i.test(font || '')) return WING[ch] || '•';
    if (/symbol/i.test(font || '')) return SYM[ch] || ch;
    return ch;
  }
  function lvlStyle(lst, lvl) { return lst ? kid(lst, 'a:lvl' + (lvl + 1) + 'pPr') : null; }
  /* 물려받는 순서: 글자 → 문단 → 도형 lstStyle → (레이아웃·마스터 자리) lstStyle → 마스터 txStyles */
  function textOf(txBody, chain, ctx, phType) {
    if (!txBody) return null;
    var bp = kid(txBody, 'a:bodyPr') || { a: {}, c: [] };
    var inhBp = chain.map(function (c) { return c && c.bodyPr; }).filter(Boolean);
    function bpa(k, d) { if (bp.a[k] != null) return bp.a[k]; for (var i = 0; i < inhBp.length; i++) if (inhBp[i].a[k] != null) return inhBp[i].a[k]; return d; }
    var fit = kid(bp, 'a:normAutofit');
    var scale = fit ? num(fit.a.fontScale, 100000) / 100000 : 1;
    var lsts = [kid(txBody, 'a:lstStyle')].concat(chain.map(function (c) { return c && c.lst; }));
    var paras = [], auto = 0;
    kids(txBody, 'a:p').forEach(function (p) {
      var pPr = kid(p, 'a:pPr') || { a: {}, c: [] };
      var lvl = Math.max(0, Math.min(8, num(pPr.a.lvl, 0)));
      var ls = lsts.map(function (l) { return lvlStyle(l, lvl); }).filter(Boolean);
      function pa(k, d) { if (pPr.a[k] != null) return pPr.a[k]; for (var i = 0; i < ls.length; i++) if (ls[i].a[k] != null) return ls[i].a[k]; return d; }
      function pk(n) { var x = kid(pPr, n); if (x) return x; for (var i = 0; i < ls.length; i++) { x = kid(ls[i], n); if (x) return x; } return null; }
      /* 글머리 — 적힌 것(buNone/buChar/buAutoNum)이 먼저, 없으면 물려받는다 */
      var bu = '';
      var own = kid(pPr, 'a:buNone') ? 'none' : kid(pPr, 'a:buChar') ? 'char' : kid(pPr, 'a:buAutoNum') ? 'auto' : '';
      if (!own) for (var i = 0; i < ls.length && !own; i++) own = kid(ls[i], 'a:buNone') ? 'none' : kid(ls[i], 'a:buChar') ? 'char' : kid(ls[i], 'a:buAutoNum') ? 'auto' : '';
      var defR = [kid(pPr, 'a:defRPr')].concat(ls.map(function (l) { return kid(l, 'a:defRPr'); })).filter(Boolean);
      function ra(rPr, k, d) { if (rPr && rPr.a[k] != null) return rPr.a[k]; for (var i = 0; i < defR.length; i++) if (defR[i].a[k] != null) return defR[i].a[k]; return d; }
      function rcolor(rPr) {
        var f = rPr && kid(rPr, 'a:solidFill'); if (f) return colorOf(f, ctx);
        for (var i = 0; i < defR.length; i++) { f = kid(defR[i], 'a:solidFill'); if (f) return colorOf(f, ctx); }
        return chain.fontColor || colorOf({ c: [{ n: 'a:schemeClr', a: { val: 'tx1' }, c: [] }] }, ctx);
      }
      var runs = [];
      p.c.forEach(function (r) {
        if (r.n === 'a:r' || r.n === 'a:fld') {
          var rPr = kid(r, 'a:rPr'), t = kid(r, 'a:t');
          var txt = t ? t.t : '';
          if (!txt) return;
          runs.push({ t: txt, sz: num(ra(rPr, 'sz', phType === 'title' || phType === 'ctrTitle' ? 4400 : 1800), 1800) / 100 * scale,
            b: ra(rPr, 'b', '0') === '1', i: ra(rPr, 'i', '0') === '1', u: (ra(rPr, 'u', 'none') || 'none') !== 'none', col: rcolor(rPr) });
        } else if (r.n === 'a:br') runs.push({ t: '\n', sz: 0, br: true });
      });
      var text = runs.map(function (r) { return r.t; }).join('');
      if (own === 'auto' && text.trim()) auto++;
      if (own === 'char' && text.trim()) { var bc = pk('a:buChar'), bf = pk('a:buFont'); bu = bulletChar(bc && bc.a.char, bf && bf.a.typeface); }
      else if (own === 'auto' && text.trim()) bu = auto + '.';
      var endR = kid(p, 'a:endParaRPr');
      paras.push({ runs: runs, text: text, bu: bu, lvl: lvl, algn: pa('algn', 'l'), marL: num(pa('marL', lvl * 457200), 0) / EMU_PT,
        emptySz: num(ra(endR, 'sz', 1800), 1800) / 100 * scale });
    });
    var has = paras.some(function (p) { return p.text.trim(); });
    return { paras: paras, has: has, anchor: bpa('anchor', 't'),
      ins: [num(bpa('lIns', 91440), 91440), num(bpa('tIns', 45720), 45720), num(bpa('rIns', 91440), 91440), num(bpa('bIns', 45720), 45720)].map(function (v) { return v / EMU_PT; }),
      vert: (bpa('vert', 'horz') || 'horz') !== 'horz' };
  }

  /* ───────── 자리(placeholder) 물려받기 ───────── */
  function phOf(sp) {
    var nv = kid(sp, 'p:nvSpPr') || kid(sp, 'p:nvPicPr') || kid(sp, 'p:nvGraphicFramePr');
    var ph = nv ? at(nv, 'p:nvPr/p:ph') : null;
    if (!ph) return null;
    return { type: ph.a.type || 'body', idx: ph.a.idx != null ? String(ph.a.idx) : '' };
  }
  function phIndex(spTree) {
    var byIdx = {}, byType = {};
    (spTree ? spTree.c : []).forEach(function (sp) {
      var ph = phOf(sp); if (!ph) return;
      if (ph.idx) byIdx[ph.idx] = sp;
      if (!byType[ph.type]) byType[ph.type] = sp;
    });
    return { byIdx: byIdx, byType: byType };
  }
  var TYPE_ALIAS = { ctrTitle: 'title', subTitle: 'body', obj: 'body' };
  function findPh(idx, ph) {
    if (!idx || !ph) return null;
    return (ph.idx && idx.byIdx[ph.idx]) || idx.byType[ph.type] || idx.byType[TYPE_ALIAS[ph.type]] || null;
  }
  function xfrmOf(sp) {
    var x = at(sp, 'p:spPr/a:xfrm') || at(sp, 'p:grpSpPr/a:xfrm') || kid(sp, 'p:xfrm');
    if (!x) return null;
    var off = kid(x, 'a:off'), ext = kid(x, 'a:ext');
    if (!off || !ext) return null;
    return { x: num(off.a.x, 0), y: num(off.a.y, 0), w: num(ext.a.cx, 0), h: num(ext.a.cy, 0), rot: num(x.a.rot, 0) / 60000,
      flipH: x.a.flipH === '1', flipV: x.a.flipV === '1', chOff: kid(x, 'a:chOff'), chExt: kid(x, 'a:chExt') };
  }
  function txStyleFor(type, master) {
    var tx = master && at(master.root, 'p:sldMaster/p:txStyles');
    if (!tx) return null;
    if (type === 'title' || type === 'ctrTitle') return kid(tx, 'p:titleStyle');
    if (type === 'body' || type === 'subTitle' || type === 'obj') return kid(tx, 'p:bodyStyle');
    return kid(tx, 'p:otherStyle');
  }

  /* ───────── 한 부분(슬라이드·레이아웃·마스터)의 도형들 → 평평한 목록 ───────── */
  function shapesOf(part, ctx, opts) {
    var out = [];
    var tree = at(part.root, part.rootName + '/p:cSld/p:spTree');
    if (!tree) return out;
    var depth = 0;
    function walk(node, tf) {
      if (++depth > LIMIT.depth) { depth--; return; }       /* 묶음 안 묶음이 끝없이 — 거기서 멈춘다 */
      walkIn(node, tf);
      depth--;
    }
    function walkIn(node, tf) {
      node.c.forEach(function (el) {
        if (el.n === 'mc:AlternateContent') { var fb = kid(el, 'mc:Fallback') || kid(el, 'mc:Choice'); if (fb) walk(fb, tf); return; }
        var ph = phOf(el);
        if (ph && opts.skipPh) return;                        /* 레이아웃·마스터의 «자리»는 그리지 않는다(슬라이드가 채운다) */
        var lay = ph ? findPh(opts.layoutPh, ph) : null, mas = ph ? findPh(opts.masterPh, ph) : null;
        var xf = xfrmOf(el) || (lay && xfrmOf(lay)) || (mas && xfrmOf(mas));
        if (el.n === 'p:grpSp') {
          if (!xf) { walk(el, tf); return; }
          var cx = num(xf.chOff && xf.chOff.a.x, 0), cy = num(xf.chOff && xf.chOff.a.y, 0);
          var cw = num(xf.chExt && xf.chExt.a.cx, xf.w) || 1, ch = num(xf.chExt && xf.chExt.a.cy, xf.h) || 1;
          var sx = xf.w / cw, sy = xf.h / ch;
          var o = tf(xf.x, xf.y, 0, 0);
          walk(el, function (x, y, w, h) {
            return { x: o.x + (x - cx) * sx * o.s, y: o.y + (y - cy) * sy * o.t, w: w * sx * o.s, h: h * sy * o.t, s: sx * o.s, t: sy * o.t };
          });
          return;
        }
        if (!xf) return;
        var box = tf(xf.x, xf.y, xf.w, xf.h);
        var s = { x: box.x / EMU_PT, y: box.y / EMU_PT, w: box.w / EMU_PT, h: box.h / EMU_PT, rot: xf.rot, flipH: xf.flipH, flipV: xf.flipV };
        var spPr = kid(el, 'p:spPr');
        var style = kid(el, 'p:style');
        if (el.n === 'p:sp' || el.n === 'p:cxnSp') {
          var geom = at(spPr, 'a:prstGeom');
          s.type = el.n === 'p:cxnSp' ? 'line' : 'shape';
          s.geom = geom ? geom.a.prst : (at(spPr, 'a:custGeom') ? 'cust' : 'rect');
          if (/^(line|straightConnector\d*|bentConnector\d*|curvedConnector\d*)$/.test(s.geom)) s.type = 'line';
          var f = fillOf(spPr, ctx, part.rels, part.path);
          if (f === undefined && style) { var fr = kid(style, 'a:fillRef'); if (fr && num(fr.a.idx, 0) > 0) f = colorOf(fr, ctx); }
          s.fill = f || null;
          var ln = at(spPr, 'a:ln'), stroke = null, sw = 0.75;
          if (ln) { sw = num(ln.a.w, 9525) / EMU_PT; stroke = kid(ln, 'a:noFill') ? null : (colorOf(kid(ln, 'a:solidFill'), ctx) || (style ? colorOf(kid(style, 'a:lnRef'), ctx) : null)); }
          else if (style) { var lr = kid(style, 'a:lnRef'); if (lr && num(lr.a.idx, 0) > 0) stroke = colorOf(lr, ctx); }
          s.stroke = stroke; s.sw = Math.max(0.25, Math.min(20, sw));
          var chain = [lay, mas].map(function (src) {
            if (!src) return null;
            return { bodyPr: at(src, 'p:txBody/a:bodyPr'), lst: at(src, 'p:txBody/a:lstStyle') };
          });
          if (ph) chain.push({ lst: txStyleFor(ph.type, opts.master) });
          else chain.push({ lst: txStyleFor('other', opts.master) });
          if (style) { var fontRef = kid(style, 'a:fontRef'); var fc = fontRef ? colorOf(fontRef, ctx) : null; if (fc) chain.fontColor = fc; }
          s.text = textOf(kid(el, 'p:txBody'), chain, ctx, ph ? ph.type : '');
          if (s.type === 'shape' && !s.fill && !s.stroke && !(s.text && s.text.has)) return;   /* 보이는 것이 없으면 건너뛴다(빈 자리 등) */
          s.ph = ph ? ph.type : '';
        } else if (el.n === 'p:pic') {
          s.type = 'pic';
          s.img = blipOf(kid(el, 'p:blipFill'), part.rels, part.path);
          if (!s.img) return;
        } else if (el.n === 'p:graphicFrame') {
          var gd = at(el, 'a:graphic/a:graphicData');
          var tbl = gd ? kid(gd, 'a:tbl') : null;
          if (tbl) {
            s.type = 'table';
            var cols = kids(at(tbl, 'a:tblGrid'), 'a:gridCol').slice(0, LIMIT.cols).map(function (g) { return Math.max(0, num(g.a.w, 0)) / EMU_PT; });
            var tot = cols.reduce(function (a, b) { return a + b; }, 0) || 1;
            s.cols = cols.map(function (c) { return c / tot * s.w; });
            s.rows = kids(tbl, 'a:tr').slice(0, LIMIT.rows).map(function (tr) {
              /* 합친 칸(gridSpan)은 «남은 칸 수»까지만 — 문서 값을 그대로 반복 횟수로 쓰지 않는다 */
              var used = 0;
              return { h: Math.max(0, num(tr.a.h, 0)) / EMU_PT, cells: kids(tr, 'a:tc').slice(0, cols.length).map(function (tc) {
                var left = Math.max(0, cols.length - used);
                var span = Math.max(1, Math.min(left || 1, Math.floor(num(tc.a.gridSpan, 1)) || 1));
                used += span;
                return { span: span, merged: tc.a.hMerge === '1' || tc.a.vMerge === '1',
                  fill: fillOf(kid(tc, 'a:tcPr'), ctx, part.rels, part.path) || null,
                  text: textOf(kid(tc, 'a:txBody'), [{ lst: txStyleFor('other', opts.master) }], ctx, '') };
              }) };
            });
          } else {
            var uri = gd ? String(gd.a.uri || '') : '';
            s.type = 'box';
            s.label = /chart/.test(uri) ? '차트' : /diagram/.test(uri) ? '도식' : '개체';
          }
        } else return;
        out.push(s);
      });
    }
    walk(tree, function (x, y, w, h) { return { x: x, y: y, w: w, h: h, s: 1, t: 1 }; });
    return out;
  }

  function bgOf(part, ctx) {
    var bg = at(part.root, part.rootName + '/p:cSld/p:bg');
    if (!bg) return undefined;
    var bgPr = kid(bg, 'p:bgPr');
    if (bgPr) { var f = fillOf(bgPr, ctx, part.rels, part.path); if (f !== undefined) return f; }
    var ref = kid(bg, 'p:bgRef'); if (ref) return colorOf(ref, ctx);
    return undefined;
  }

  /* ───────── 통째로 읽기 ───────── */
  function parse(JSZip, buf, opts) {
    opts = opts || {};
    var maxSlides = opts.maxSlides || MAX_SLIDES;
    var cache = Object.create(null);                         /* 열쇠가 문서에서 온다 — «toString» 같은 이름이 Object 와 부딪히지 않게 */
    var xmlUsed = 0;
    return JSZip.loadAsync(buf).then(function (zip) {
      function sizeOf(f) { return f && f._data && typeof f._data.uncompressedSize === 'number' ? f._data.uncompressedSize : -1; }
      function text(p) {
        var f = zip.file(p); if (!f) return Promise.resolve('');
        if (sizeOf(f) > LIMIT.xmlPart) return Promise.reject(new Error('슬라이드 한 장이 너무 큽니다'));
        /* 몫은 «zip 에 적힌 크기»만큼 미리 잡는다(여러 부분이 함께 풀려도 합계가 넘지 않게).
           그리고 «풀리는 동안» 실제 바이트를 세어, 적힌 크기를 넘으면(거짓 크기) 그 자리에서 멈추고 실패한다 */
        var declared = sizeOf(f);
        var room = declared >= 0 ? declared : LIMIT.xmlPart;
        if (xmlUsed + room > LIMIT.xmlTotal) return Promise.reject(new Error('자료가 너무 커서 그리지 않았습니다'));
        xmlUsed += room;
        return readLimited(f, room).then(function (u8) { xmlUsed -= room - u8.length; return utf8(u8); }, function (e) { xmlUsed -= room; throw e; });
      }
      function load(p, rootName) {
        if (!p) return Promise.resolve(null);
        if (cache[p]) return cache[p];
        cache[p] = Promise.all([text(p), text(relsPathOf(p))]).then(function (two) {
          if (!two[0]) return null;
          var rels = Object.create(null);
          kids(kid(xml(two[1]), 'Relationships'), 'Relationship').forEach(function (r) {
            if (r.a.TargetMode === 'External') return;
            rels[r.a.Id] = { target: r.a.Target, type: String(r.a.Type || '').replace(/^.*\//, '') };
          });
          return { path: p, root: xml(two[0]), rels: rels, rootName: rootName };
        });
        return cache[p];
      }
      var sharedShapes = Object.create(null);
      function shared(part, make) { return sharedShapes[part.path] || (sharedShapes[part.path] = make()); }
      function relOf(part, type) { if (!part) return ''; for (var k in part.rels) if (part.rels[k].type === type) return joinPath(part.path, part.rels[k].target); return ''; }
      return load('ppt/presentation.xml', 'p:presentation').then(function (pres) {
        if (!pres) throw new Error('파워포인트(pptx) 파일이 아닙니다');
        var sz = at(pres.root, 'p:presentation/p:sldSz');
        var W = num(sz && sz.a.cx, 12192000) / EMU_PT, H = num(sz && sz.a.cy, 6858000) / EMU_PT;
        var ids = kids(at(pres.root, 'p:presentation/p:sldIdLst'), 'p:sldId');
        var paths = ids.map(function (s) { var r = pres.rels[s.a['r:id']]; return r ? joinPath(pres.path, r.target) : ''; }).filter(Boolean);
        var truncated = paths.length > maxSlides;
        paths = paths.slice(0, maxSlides);
        var media = Object.create(null);
        return Promise.all(paths.map(function (sp, i) {
          return load(sp, 'p:sld').then(function (slide) {
            if (!slide) return null;
            return load(relOf(slide, 'slideLayout'), 'p:sldLayout').then(function (layout) {
              return load(relOf(layout, 'slideMaster'), 'p:sldMaster').then(function (master) {
                return load(relOf(master, 'theme'), 'a:theme').then(function (theme) {
                  var scheme = {};
                  var cs = theme ? at(theme.root, 'a:theme/a:themeElements/a:clrScheme') : null;
                  (cs ? cs.c : []).forEach(function (c) {
                    var k = c.n.replace(/^a:/, ''), v = kid(c, 'a:srgbClr'), y = kid(c, 'a:sysClr');
                    scheme[k] = v ? v.a.val : y ? (y.a.lastClr || (y.a.val === 'window' ? 'FFFFFF' : '000000')) : '808080';
                  });
                  var cm = master ? at(master.root, 'p:sldMaster/p:clrMap') : null;
                  var ctx = { scheme: scheme, map: cm ? cm.a : null };
                  var layoutTree = layout ? at(layout.root, 'p:sldLayout/p:cSld/p:spTree') : null;
                  var masterTree = master ? at(master.root, 'p:sldMaster/p:cSld/p:spTree') : null;
                  var common = { layoutPh: phIndex(layoutTree), masterPh: phIndex(masterTree), master: master };
                  var showMaster = slide.root.c[0] && slide.root.c[0].a.showMasterSp !== '0' && !(layout && layout.root.c[0] && layout.root.c[0].a.showMasterSp === '0');
                  var bg = bgOf(slide, ctx);
                  if (bg === undefined && layout) bg = bgOf(layout, ctx);
                  if (bg === undefined && master) bg = bgOf(master, ctx);
                  var shapes = [];
                  /* 마스터·레이아웃 장식은 여러 슬라이드가 함께 쓴다 — 한 번만 읽고 같은 목록을 쓴다(장마다 다시 읽지 않는다) */
                  if (master && showMaster) shapes = shapes.concat(shared(master, function () { return shapesOf(master, ctx, { skipPh: true, master: master }); }));
                  if (layout && showMaster) shapes = shapes.concat(shared(layout, function () { return shapesOf(layout, ctx, { skipPh: true, master: master, masterPh: common.masterPh }); }));
                  shapes = shapes.concat(shapesOf(slide, ctx, common));
                  if (bg && bg.img) media[bg.img] = true;
                  shapes.forEach(function (s) { if (s.img) media[s.img] = true; if (s.fill && s.fill.img) media[s.fill.img] = true; });
                  var title = '';
                  shapes.some(function (s) { if ((s.ph === 'title' || s.ph === 'ctrTitle') && s.text && s.text.has) { title = s.text.paras.map(function (p) { return p.text; }).join(' ').trim(); return true; } return false; });
                  /* 제목 자리가 없으면 «가장 큰 글자»의 문단 — 쪽 번호·날짜·바닥글·숫자만 있는 글은 빼고 */
                  if (!title) {
                    var best = 0;
                    shapes.forEach(function (s) {
                      if (!s.text || !s.text.has || /^(sldNum|dt|ftr)$/.test(s.ph || '')) return;
                      s.text.paras.forEach(function (p) {
                        var t = p.text.trim(); if (!t || /^[\d\s.\-\/]+$/.test(t) || t.length < 2) return;
                        var sz = Math.max.apply(null, p.runs.map(function (r) { return r.sz || 0; }).concat([0]));
                        if (sz > best + 0.5) { best = sz; title = t; }
                      });
                    });
                  }
                  return { no: i + 1, title: title.replace(/\s+/g, ' ').slice(0, 120), bg: bg || { c: '#ffffff', o: 1 }, shapes: shapes };
                });
              });
            });
          });
        })).then(function (slides) {
          /* 도형 합계 한도 — 앞에서부터 세어 넘으면 거기서 끊는다(«앞 N장까지»로 알린다) */
          var out = [], count = 0;
          slides.filter(Boolean).some(function (s) {
            count += s.shapes.length;
            if (count > LIMIT.shapes && out.length) { truncated = true; return true; }
            out.push(s); return false;
          });
          return { w: W, h: H, slides: out, media: media, truncated: truncated, zip: zip };
        });
      });
    });
  }

  /* ───────── 그리기(SVG) — 브라우저에서만. 문서 글자는 textContent 로만 넣는다 ───────── */
  var DRAWABLE = /\.(png|jpe?g|gif|bmp|webp|svg)$/i;
  function el(doc, name, attrs) { var e = doc.createElementNS(SVG_NS, name); for (var k in attrs) if (attrs[k] != null) e.setAttribute(k, String(attrs[k])); return e; }
  function paint(f) { return f && f.c ? f.c : 'none'; }
  function drawText(doc, g, s, t) {
    if (!t || !t.has) return;
    var x = s.x + t.ins[0], y = s.y + t.ins[1], w = Math.max(1, s.w - t.ins[0] - t.ins[2]), h = Math.max(1, s.h - t.ins[1] - t.ins[3]);
    var fo = el(doc, 'foreignObject', { x: x, y: y, width: w, height: h });
    var box = doc.createElementNS(XHTML_NS, 'div');
    box.setAttribute('style', 'width:' + w + 'px;height:' + h + 'px;display:flex;flex-direction:column;overflow:visible;font-family:"Malgun Gothic","Apple SD Gothic Neo",sans-serif;line-height:1.18;word-break:keep-all;overflow-wrap:anywhere;' +
      'justify-content:' + (t.anchor === 'ctr' ? 'center' : t.anchor === 'b' ? 'flex-end' : 'flex-start') + (t.vert ? ';writing-mode:vertical-rl' : ''));
    t.paras.forEach(function (p) {
      var d = doc.createElementNS(XHTML_NS, 'div');
      d.setAttribute('style', 'margin:0;white-space:pre-wrap;text-align:' + (p.algn === 'ctr' ? 'center' : p.algn === 'r' ? 'right' : p.algn === 'just' ? 'justify' : 'left') +
        ';padding-left:' + Math.min(p.marL, w * 0.6) + 'px' + (p.text.trim() ? '' : ';height:' + (p.emptySz * 1.18) + 'px'));
      if (p.bu) { var b = doc.createElementNS(XHTML_NS, 'span'); b.textContent = p.bu + ' '; var f0 = p.runs[0]; b.setAttribute('style', 'font-size:' + (f0 ? f0.sz : 18) + 'px;color:' + (f0 && f0.col ? f0.col.c : '#000000')); d.appendChild(b); }
      p.runs.forEach(function (r) {
        if (r.br) { d.appendChild(doc.createElementNS(XHTML_NS, 'br')); return; }
        var sp = doc.createElementNS(XHTML_NS, 'span');
        sp.textContent = r.t;
        sp.setAttribute('style', 'font-size:' + r.sz + 'px;color:' + (r.col ? r.col.c : '#000000') + (r.col && r.col.o < 1 ? ';opacity:' + r.col.o : '') +
          (r.b ? ';font-weight:700' : '') + (r.i ? ';font-style:italic' : '') + (r.u ? ';text-decoration:underline' : ''));
        d.appendChild(sp);
      });
      box.appendChild(d);
    });
    fo.appendChild(box);
    g.appendChild(fo);
  }
  function draw(model, index, doc, urlOf) {
    var sl = model.slides[index];
    var svg = el(doc, 'svg', { viewBox: '0 0 ' + model.w + ' ' + model.h, preserveAspectRatio: 'xMidYMid meet', role: 'img' });
    svg.setAttribute('aria-label', (sl.no) + '쪽' + (sl.title ? ' — ' + sl.title : ''));
    var clipId = 'c' + Math.random().toString(36).slice(2);
    var defs = el(doc, 'defs', {}), cp = el(doc, 'clipPath', { id: clipId }); cp.appendChild(el(doc, 'rect', { x: 0, y: 0, width: model.w, height: model.h })); defs.appendChild(cp); svg.appendChild(defs);
    var root = el(doc, 'g', { 'clip-path': 'url(#' + clipId + ')' });
    svg.appendChild(root);
    var bg = sl.bg || {};
    if (bg.img && DRAWABLE.test(bg.img) && urlOf(bg.img)) root.appendChild(el(doc, 'image', { href: urlOf(bg.img), x: 0, y: 0, width: model.w, height: model.h, preserveAspectRatio: 'none' }));
    else root.appendChild(el(doc, 'rect', { x: 0, y: 0, width: model.w, height: model.h, fill: bg.c || '#ffffff' }));
    sl.shapes.forEach(function (s) {
      var g = el(doc, 'g', {});
      var tf = [];
      if (s.rot) tf.push('rotate(' + s.rot + ' ' + (s.x + s.w / 2) + ' ' + (s.y + s.h / 2) + ')');
      if (tf.length) g.setAttribute('transform', tf.join(' '));
      if (s.type === 'line') {
        var x1 = s.flipH ? s.x + s.w : s.x, x2 = s.flipH ? s.x : s.x + s.w, y1 = s.flipV ? s.y + s.h : s.y, y2 = s.flipV ? s.y : s.y + s.h;
        g.appendChild(el(doc, 'line', { x1: x1, y1: y1, x2: x2, y2: y2, stroke: paint(s.stroke) === 'none' ? '#595959' : s.stroke.c, 'stroke-width': s.sw }));
      } else if (s.type === 'pic') {
        if (DRAWABLE.test(s.img) && urlOf(s.img)) g.appendChild(el(doc, 'image', { href: urlOf(s.img), x: s.x, y: s.y, width: s.w, height: s.h, preserveAspectRatio: 'none' }));
        else { g.appendChild(el(doc, 'rect', { x: s.x, y: s.y, width: s.w, height: s.h, fill: '#e2e8f0', stroke: '#94a3b8', 'stroke-width': 0.75 })); label(doc, g, s, '그림'); }
      } else if (s.type === 'box') {
        g.appendChild(el(doc, 'rect', { x: s.x, y: s.y, width: s.w, height: s.h, fill: '#f8fafc', stroke: '#94a3b8', 'stroke-width': 0.75, 'stroke-dasharray': '4 3' }));
        label(doc, g, s, s.label);
      } else if (s.type === 'table') {
        var yy = s.y;
        s.rows.forEach(function (r) {
          var xx = s.x, ci = 0;
          r.cells.forEach(function (c) {
            if (ci >= s.cols.length) return;
            var cw = 0; for (var k = 0; k < c.span && ci + k < s.cols.length; k++) cw += s.cols[ci + k] || 0;
            if (!c.merged) {
              g.appendChild(el(doc, 'rect', { x: xx, y: yy, width: cw, height: r.h, fill: paint(c.fill) === 'none' ? 'none' : c.fill.c, stroke: '#a6a6a6', 'stroke-width': 0.5 }));
              drawText(doc, g, { x: xx, y: yy, w: cw, h: r.h }, c.text);
            }
            xx += cw; ci += c.span;
          });
          yy += r.h;
        });
      } else {
        var fill = s.fill && s.fill.img ? null : s.fill;
        var common = { fill: paint(fill), stroke: paint(s.stroke), 'stroke-width': s.stroke ? s.sw : null, 'fill-opacity': fill && fill.o < 1 ? fill.o : null };
        if (s.fill && s.fill.img && DRAWABLE.test(s.fill.img) && urlOf(s.fill.img)) g.appendChild(el(doc, 'image', { href: urlOf(s.fill.img), x: s.x, y: s.y, width: s.w, height: s.h, preserveAspectRatio: 'none' }));
        if (s.geom === 'ellipse' || s.geom === 'flowChartConnector') g.appendChild(el(doc, 'ellipse', Object.assign({ cx: s.x + s.w / 2, cy: s.y + s.h / 2, rx: s.w / 2, ry: s.h / 2 }, common)));
        else if (fill || s.stroke) g.appendChild(el(doc, 'rect', Object.assign({ x: s.x, y: s.y, width: s.w, height: s.h, rx: /^round/.test(s.geom) ? Math.min(s.w, s.h) * 0.16 : null }, common)));
        drawText(doc, g, s, s.text);
      }
      root.appendChild(g);
    });
    return svg;
  }
  function label(doc, g, s, txt) {
    var t = el(doc, 'text', { x: s.x + s.w / 2, y: s.y + s.h / 2, 'text-anchor': 'middle', 'dominant-baseline': 'middle', 'font-size': Math.max(8, Math.min(28, s.h / 5)), fill: '#64748b' });
    t.textContent = txt;
    g.appendChild(t);
  }

  return { parse: parse, draw: draw, readLimited: readLimited, DRAWABLE: DRAWABLE, MAX_SLIDES: MAX_SLIDES, LIMIT: LIMIT, _xml: xml, _colorOf: colorOf, _joinPath: joinPath, _textOf: textOf };
});
