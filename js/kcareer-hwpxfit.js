/* 한글 서식 «칸 맞춤» — 채운 글자가 칸보다 길면 장평·글자 크기를 줄여 한 줄에 넣는다
   (대표 지시 2026-09-29 「글자크기등은 자동으로 조절되어서 칸안에 들어갈 수 있게」)

   ■ 무엇이 문제였나 (실측, 이력서 서식)
     근무기간 칸에 「2011.05 ~ 2014.02」를 넣자 「02」가 아랫줄로 꺾였다.
     근무처 칸의 「권형하노무사사무소」도 마지막 글자가 넘어갔다.
     칸 높이는 한 줄짜리라 꺾인 줄이 옆 칸 글자와 겹쳐 보였다.

   ■ 어떻게 하나
     칸 폭(칸 여백·문단 여백을 뺀 것)과 글자 폭(글자 모양의 크기·장평·자간으로 어림)을 견준다.
     넘치면 ① 장평을 85%까지 먼저 줄이고 ② 그래도 넘치면 글자 크기를 원래의 60%까지 줄인다.
     줄인 모양은 헤더에 «새 글자 모양»으로 덧붙인다 — 원래 모양은 다른 칸도 쓰므로 고치지 않는다.

   ■ 무엇을 «안» 하나 — 이것이 더 중요하다
     ⚠ 이번에 글자를 «바꾼» 칸만 본다. 표시는 줄 정보(linesegarray)가 걷혔는가다 —
        채우는 자(kcareer-hwpxfill.js)가 바꾼 문단에서만 걷는다. 서식에 원래 적힌 글자는 그대로다.
     ⚠ 문단이 둘 이상이거나 줄바꿈이 든 칸은 «여러 줄이 뜻»이다 — 건드리지 않는다.
     ⚠ 60%로 줄여도 안 들어가는 긴 글(자기소개·기타사항)은 줄이지 않는다 — 줄을 바꿔 읽히는 게 낫다.
     ⚠ 칸 폭·글자 모양을 못 읽으면 아무것도 안 한다. 어림이 틀릴 바에는 원래대로 둔다. */
(function (root) {
  'use strict';

  var MIN_RATIO = 0.85;   /* 장평은 이만큼까지만 — 더 줄이면 글자가 찌그러져 보인다 */
  var MIN_SIZE = 0.6;     /* 글자 크기는 원래의 이만큼까지만 */
  var SAFETY = 0.96;      /* 어림 오차 몫 — 딱 맞게 줄이면 한글에서 한 글자가 넘어가기도 한다 */

  function num(s, d) { var n = parseFloat(s); return isFinite(n) ? n : d; }
  function attr(tag, name) {
    var m = new RegExp('\\b' + name + '="([^"]*)"').exec(tag || '');
    return m ? m[1] : null;
  }
  function unesc(s) {
    return String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&');
  }

  /* 깊이를 세어 그 켜의 블록만 — 표 안의 표 경계를 잘못 짚지 않게 */
  function blocks(xml, tag) {
    var open = '<' + tag, close = '</' + tag + '>', out = [], pos = 0, src = String(xml || '');
    for (;;) {
      var s = src.indexOf(open, pos);
      if (s < 0) break;
      var c = src.charAt(s + open.length);
      if (c !== '>' && c !== ' ' && c !== '/' && c !== '\n' && c !== '\r' && c !== '\t') { pos = s + open.length; continue; }
      var gt = src.indexOf('>', s);
      if (src.charAt(gt - 1) === '/') { out.push({ start: s, end: gt + 1, text: src.slice(s, gt + 1) }); pos = gt + 1; continue; }
      var depth = 1, i = gt + 1;
      while (depth > 0) {
        var o = src.indexOf(open, i), e = src.indexOf(close, i);
        if (e < 0) return out;
        if (o >= 0 && o < e) {
          var oc = src.charAt(o + open.length), ogt = src.indexOf('>', o);
          if ((oc === '>' || oc === ' ' || oc === '\n' || oc === '\r' || oc === '\t') && src.charAt(ogt - 1) !== '/') depth++;
          i = ogt + 1;
        } else { depth--; i = e + close.length; }
      }
      out.push({ start: s, end: i, text: src.slice(s, i) });
      pos = i;
    }
    return out;
  }

  /* ── 헤더 읽기 ─────────────────────────────────────────────────────── */
  function readChar(block) {
    var open = block.slice(0, block.indexOf('>') + 1);
    var h = num(attr(open, 'height'), 0);
    function lang(tag) {
      var m = new RegExp('<hh:' + tag + '\\b[^>]*>').exec(block);
      return { hangul: num(attr(m && m[0], 'hangul'), tag === 'spacing' ? 0 : 100),
               latin: num(attr(m && m[0], 'latin'), tag === 'spacing' ? 0 : 100) };
    }
    return { height: h, ratio: lang('ratio'), spacing: lang('spacing'), relSz: lang('relSz') };
  }
  function readHeader(headerXml) {
    var chars = {}, paras = {}, maxId = -1;
    blocks(headerXml, 'hh:charPr').forEach(function (b) {
      var id = attr(b.text.slice(0, b.text.indexOf('>') + 1), 'id');
      if (id == null) return;
      chars[id] = { block: b.text, info: readChar(b.text) };
      maxId = Math.max(maxId, parseInt(id, 10) || 0);
    });
    blocks(headerXml, 'hh:paraPr').forEach(function (b) {
      var id = attr(b.text.slice(0, b.text.indexOf('>') + 1), 'id');
      if (id == null) return;
      var l = /<hc:left\b[^>]*value="(-?\d+)"/.exec(b.text), r = /<hc:right\b[^>]*value="(-?\d+)"/.exec(b.text),
          ind = /<hc:intent\b[^>]*value="(-?\d+)"/.exec(b.text);
      paras[id] = { left: l ? +l[1] : 0, right: r ? +r[1] : 0, indent: ind ? +ind[1] : 0 };
    });
    return { chars: chars, paras: paras, maxId: maxId };
  }

  /* ── 글자 폭 어림 (단위: 글자 크기 1em) ──────────────────────────────── */
  function isWide(cp) {
    return (cp >= 0x1100 && cp <= 0x11ff) || (cp >= 0x2e80 && cp <= 0xa4cf) || (cp >= 0xac00 && cp <= 0xd7a3)
      || (cp >= 0xf900 && cp <= 0xfaff) || (cp >= 0xfe30 && cp <= 0xfe4f) || (cp >= 0xff00 && cp <= 0xff60)
      || (cp >= 0x3000 && cp <= 0x303f) || cp === 0x2026 || cp === 0x203b || (cp >= 0x2460 && cp <= 0x27bf);
  }
  function emOf(ch) {
    var cp = ch.codePointAt(0);
    if (isWide(cp)) return { em: 1, wide: true };
    if (ch === ' ') return { em: 0.4, wide: false };
    if (/[.,:;'`|!il]/.test(ch)) return { em: 0.32, wide: false };
    if (/[0-9]/.test(ch)) return { em: 0.56, wide: false };
    if (/[A-Z@%&MW]/.test(ch)) return { em: 0.72, wide: false };
    if (/[a-z]/.test(ch)) return { em: 0.52, wide: false };
    if (cp < 0x80) return { em: 0.5, wide: false };
    return { em: 1, wide: true };   /* 모르는 글자는 넓게 본다 — 덜 줄이는 것보다 넘치지 않는 게 낫다 */
  }
  /* 한 run 의 폭(HWPUNIT). info 는 글자 모양 */
  function runWidth(text, info) {
    var w = 0;
    for (var ch of text) {
      var e = emOf(ch), L = e.wide ? 'hangul' : 'latin';
      var size = info.height * info.relSz[L] / 100;
      w += size * (e.em * info.ratio[L] / 100 + info.spacing[L] / 100);
    }
    return w;
  }

  /* ── 줄인 글자 모양 만들기 ─────────────────────────────────────────── */
  function shrunkBlock(block, newId, ratioF, sizeF) {
    var out = block.replace(/^<hh:charPr\b[^>]*>/, function (open) {
      open = open.replace(/\bid="[^"]*"/, 'id="' + newId + '"');
      return open.replace(/\bheight="(\d+)"/, function (m, h) { return 'height="' + Math.max(100, Math.round(h * sizeF / 10) * 10) + '"'; });
    });
    return out.replace(/<hh:ratio\b[^>]*\/?>/, function (tag) {
      return tag.replace(/(\b(?:hangul|latin|hanja|japanese|other|symbol|user)=")(\d+)"/g, function (m, a, v) {
        return a + Math.max(50, Math.round(v * ratioF)) + '"';
      });
    });
  }

  /* 칸 하나의 쓸 수 있는 폭 */
  function availWidth(tc, tblInMargin, paraInfo) {
    var sz = /<hp:cellSz\b[^>]*>/.exec(tc);
    var w = num(attr(sz && sz[0], 'width'), 0);
    if (!w) return 0;
    var open = tc.slice(0, tc.indexOf('>') + 1);
    var own = attr(open, 'hasMargin') === '1';
    var cm = /<hp:cellMargin\b[^>]*>/.exec(tc);
    var src = own && cm ? cm[0] : tblInMargin;
    var l = num(attr(src, 'left'), 510), r = num(attr(src, 'right'), 510);
    var p = paraInfo || { left: 0, right: 0, indent: 0 };
    return w - l - r - Math.max(0, p.left) - Math.max(0, p.right) - Math.max(0, p.indent);
  }

  /* ── 문서 한 구역을 맞춘다 ─────────────────────────────────────────── */
  function fit(sectionXml, headerXml) {
    var section = String(sectionXml || ''), header = String(headerXml || '');
    var H = readHeader(header);
    var report = [], added = [], cache = {}, nextId = H.maxId + 1;
    if (nextId <= 0) return { section: section, header: header, fitted: report, changed: false };

    function derived(baseId, ratioF, sizeF) {
      var key = baseId + '|' + ratioF.toFixed(3) + '|' + sizeF.toFixed(3);
      if (cache[key]) return cache[key];
      var id = String(nextId++);
      added.push(shrunkBlock(H.chars[baseId].block, id, ratioF, sizeF));
      cache[key] = id;
      return id;
    }

    function fitCell(tc, tblInMargin) {
      if (blocks(tc, 'hp:tbl').length) return tc;              /* 안쪽 표가 든 칸 */
      var ps = blocks(tc, 'hp:p');
      if (ps.length !== 1) return tc;                           /* 여러 문단 = 여러 줄이 뜻 */
      var p = ps[0].text;
      if (/<hp:linesegarray\b/.test(p)) return tc;              /* 이번에 안 바꾼 칸 */
      if (/<hp:lineBreak\b|<hp:tab\b/.test(p)) return tc;
      var runs = [], re = /<hp:run\b[^>]*charPrIDRef="([^"]+)"[^>]*>([\s\S]*?)<\/hp:run>/g, m, total = 0, text = '';
      while ((m = re.exec(p))) {
        var t = '', tr = /<hp:t(?:\s[^>]*)?>([\s\S]*?)<\/hp:t>/g, mt;
        while ((mt = tr.exec(m[2]))) t += unesc(mt[1].replace(/<[^>]*>/g, ''));
        if (!t) continue;
        var c = H.chars[m[1]];
        if (!c || !c.info.height) return tc;                    /* 글자 모양을 못 읽음 */
        runs.push(m[1]);
        total += runWidth(t, c.info);
        text += t;
      }
      if (!runs.length || !text.trim()) return tc;
      var pp = H.paras[attr(p.slice(0, p.indexOf('>') + 1), 'paraPrIDRef')];
      var avail = availWidth(tc, tblInMargin, pp) * SAFETY;
      if (avail <= 0 || total <= avail) return tc;
      var need = avail / total;
      if (need < MIN_RATIO * MIN_SIZE) return tc;               /* 너무 긴 글 — 줄을 바꿔 읽히게 둔다 */
      var ratioF = Math.max(need, MIN_RATIO), sizeF = Math.min(1, need / ratioF);
      /* 한 run 이 여러 번 나와도 같은 모양을 쓴다 */
      var map = {};
      runs.forEach(function (id) { if (!map[id]) map[id] = derived(id, ratioF, sizeF); });
      var np = p.replace(/(<hp:run\b[^>]*charPrIDRef=")([^"]+)(")/g, function (all, a, id, b) {
        return map[id] ? a + map[id] + b : all;
      });
      report.push({ text: text, need: Math.round(need * 100), ratio: Math.round(ratioF * 100), size: Math.round(sizeF * 100) });
      return tc.slice(0, ps[0].start) + np + tc.slice(ps[0].end);
    }

    function walk(xml) {
      var tbls = blocks(xml, 'hp:tbl');
      if (!tbls.length) return xml;
      for (var i = tbls.length - 1; i >= 0; i--) {
        var tb = tbls[i].text;
        var inM = (/<hp:inMargin\b[^>]*>/.exec(tb) || [''])[0];
        var cells = blocks(tb, 'hp:tc');
        for (var j = cells.length - 1; j >= 0; j--) {
          var cell = cells[j].text;
          /* 안쪽 표부터 맞춘 뒤 이 칸을 본다 */
          var inner = cell.indexOf('<hp:tbl') >= 0 ? walk(cell) : cell;
          var nc = fitCell(inner, inM);
          if (nc !== cell) tb = tb.slice(0, cells[j].start) + nc + tb.slice(cells[j].end);
        }
        if (tb !== tbls[i].text) xml = xml.slice(0, tbls[i].start) + tb + xml.slice(tbls[i].end);
      }
      return xml;
    }

    var out = walk(section);
    if (!added.length) return { section: section, header: header, fitted: report, changed: false };
    var close = header.lastIndexOf('</hh:charProperties>');
    if (close < 0) return { section: section, header: header, fitted: [], changed: false };
    var nh = header.slice(0, close) + added.join('') + header.slice(close);
    nh = nh.replace(/(<hh:charProperties\b[^>]*\bitemCnt=")(\d+)(")/, function (m, a, n, b) { return a + (parseInt(n, 10) + added.length) + b; });
    return { section: out, header: nh, fitted: report, changed: true };
  }

  var api = { fit: fit, _runWidth: runWidth, _readHeader: readHeader };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.KcareerHwpxFit = api;
})(typeof window !== 'undefined' ? window : this);
