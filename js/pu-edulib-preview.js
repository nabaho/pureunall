/* ═══════════════════════════════════════════════════════════════════════
   강의자료 — 파워포인트(pptx)·워드(docx) «글자만» 미리보기 (2026-11-19)

   강의자료는 대부분 파워포인트다. 푸른 문서뷰어(pu-viewer-frame.html)는 PDF·한글·엑셀만 그리고
   pptx·docx 는 «2판»이라 아직 못 그린다. 나란히 보며 비교하려면 «어느 쪽에 무슨 말이 있는지»가
   먼저 보여야 해서, 슬라이드마다 글자만 뽑아 보여 준다(그림·도형 모양은 원본을 내려받아 본다).

   ★ 원본은 건드리지 않는다 — 바이트를 읽어 글자만 꺼낸다. 저장·전송하지 않는다.
   ★ 글자는 textContent 로만 화면에 넣는다(innerHTML 금지) — 파일 안 글자가 화면 코드가 되지 않게.
   ★ 압축 폭탄 막기 — 파일 50MB, 조각 하나 8MB, 슬라이드 300장까지만 본다.
   쓰는 법: PuEduLibPreview.extract(JSZip, ArrayBuffer, 'pptx'|'docx')
            → Promise<{ kind, parts:[{ no, title, lines:[…] }], truncated }>
   ═══════════════════════════════════════════════════════════════════════ */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PuEduLibPreview = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MAX_FILE = 50 * 1024 * 1024;
  var MAX_PART = 8 * 1024 * 1024;
  var MAX_TOTAL = 80 * 1024 * 1024;     /* 풀린 글자 합계 — 작은 zip 이 풀면 엄청 커지는 파일 대비 */
  var MAX_SLIDES = 300;

  /* zip 안 파일을 «실제로 풀린 바이트»를 세며 읽는다(선언된 크기를 믿지 않는다) — 한도를 넘으면 그 자리에서 멈추고 실패 */
  function readLimited(file, limit) {
    return new Promise(function (res, rej) {
      var chunks = [], got = 0, done = false, st;
      try { st = file.internalStream('uint8array'); } catch (e) { rej(e); return; }
      st.on('data', function (c) {
        if (done) return;
        got += c.length;
        if (got > limit) { done = true; try { st.pause(); } catch (_) {} rej(new Error('풀린 크기가 한도를 넘었습니다')); return; }
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

  /* XML 글자에서 <a:t>…</a:t>(pptx) · <w:t>…</w:t>(docx) 만 뽑는다.
     DOMParser 가 없는 곳(node 검사)에서도 돌게 정규식으로 한다 — 태그 속 글자만 꺼내고 엔티티를 푼다. */
  function unescapeXml(s) {
    return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
      .replace(/&#(\d+);/g, function (_, d) { var n = +d; return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : ''; })
      .replace(/&#x([0-9a-f]+);/gi, function (_, h) { var n = parseInt(h, 16); return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : ''; })
      .replace(/&amp;/g, '&');
  }

  /* 문단(<a:p>·<w:p>) 단위로 글자를 모은다 — 앞에서 뒤로 «한 번» 훑는다(indexOf).
     ⚠ 정규식(.*?</a:p>)으로 하면 닫는 태그가 없는 나쁜 XML 에서 남은 글을 몇 번이고 다시 훑어 화면이 오래 멈춘다(2026-11-22 보안 검토).
       닫는 태그를 못 찾으면 거기서 멈춘다. 줄 수에도 상한(MAX_LINES). */
  var MAX_LINES = 20000;
  function isTagEnd(ch) { return ch === '>' || ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '/'; }
  function paragraphs(xml, pTag, tTag) {
    var out = [], pos = 0, open = '<' + pTag, close = '</' + pTag + '>', tOpen = '<' + tTag, tClose = '</' + tTag + '>';
    xml = String(xml || '');
    while (out.length < MAX_LINES) {
      var s = xml.indexOf(open, pos); if (s < 0) break;
      var ch = xml.charAt(s + open.length);
      if (!isTagEnd(ch)) { pos = s + open.length; continue; }          /* <a:pPr> 같은 다른 태그 */
      var gt0 = xml.indexOf('>', s); if (gt0 < 0) break;
      if (xml.charAt(gt0 - 1) === '/') { pos = gt0 + 1; continue; }    /* 빈 문단 <a:p/> */
      var e = xml.indexOf(close, gt0); if (e < 0) break;               /* 닫는 태그가 없으면 멈춘다 */
      var seg = xml.slice(gt0 + 1, e), line = '', q = 0;
      for (;;) {
        var ts = seg.indexOf(tOpen, q); if (ts < 0) break;
        if (!isTagEnd(seg.charAt(ts + tOpen.length))) { q = ts + tOpen.length; continue; }   /* <a:tab> 같은 것 */
        var gt = seg.indexOf('>', ts); if (gt < 0) break;
        if (seg.charAt(gt - 1) === '/') { q = gt + 1; continue; }
        var te = seg.indexOf(tClose, gt); if (te < 0) break;
        line += unescapeXml(seg.slice(gt + 1, te));
        q = te + tClose.length;
      }
      line = line.replace(/\s+/g, ' ').trim();
      if (line) out.push(line);
      pos = e + close.length;
    }
    return out;
  }

  function slideNo(name) { var m = name.match(/slide(\d+)\.xml$/); return m ? +m[1] : 0; }

  function extract(JSZip, buf, kind) {
    if (!JSZip) return Promise.reject(new Error('zip 도구가 없습니다'));
    if (!buf || buf.byteLength > MAX_FILE) return Promise.reject(new Error('파일이 커서 글자 미리보기를 건너뜁니다'));
    return JSZip.loadAsync(buf).then(function (zip) {
      var names = Object.keys(zip.files);
      var targets, pTag, tTag;
      if (kind === 'pptx') {
        targets = names.filter(function (n) { return /^ppt\/slides\/slide\d+\.xml$/.test(n); })
          .sort(function (a, b) { return slideNo(a) - slideNo(b); });
        pTag = 'a:p'; tTag = 'a:t';
      } else if (kind === 'docx') {
        targets = names.filter(function (n) { return n === 'word/document.xml'; });
        pTag = 'w:p'; tTag = 'w:t';
      } else {
        return Promise.reject(new Error('글자 미리보기를 못 하는 형식입니다'));
      }
      var truncated = targets.length > MAX_SLIDES;
      targets = targets.slice(0, MAX_SLIDES);
      /* 차례로 읽으며 합계를 센다 — 한 부분이 한도를 넘으면 그 부분만 비우고, 합계를 넘으면 거기서 멈춘다 */
      var xmls = [], total = 0;
      return targets.reduce(function (p, n) {
        return p.then(function () {
          if (total >= MAX_TOTAL) { xmls.push(''); truncated = true; return; }
          var room = Math.min(MAX_PART, MAX_TOTAL - total);
          return readLimited(zip.files[n], room).then(function (u8) {
            total += u8.length; xmls.push(utf8(u8));
          }, function () { xmls.push(''); truncated = true; total += room; });   /* 실패해도 그만큼 풀었다 — 합계에 넣어 되풀이되면 멈춘다 */
        });
      }, Promise.resolve()).then(function () {
        var parts = xmls.map(function (x, i) {
          var lines = x ? paragraphs(x, pTag, tTag) : [];
          return { no: kind === 'pptx' ? slideNo(targets[i]) : i + 1, title: lines[0] || '', lines: lines };
        });
        return { kind: kind, parts: parts, truncated: truncated };
      });
    });
  }

  return { extract: extract, _paragraphs: paragraphs, MAX_FILE: MAX_FILE };
});
