/* 밖에서 보내 온 HTML 을 편집기에 넣기 전에 거른다 (2026-11-22)
   ■ 무엇을: 기금관리·업무이관 같은 다른 화면이 «일반 서식» 으로 보내 온 HTML (hangul/js/app.js 의 loadFromFundPayload).
     편집기는 받은 HTML 을 문서 칸에 그대로 넣으므로, 보낸 쪽 자료에 실행되는 조각이 섞여 있으면 편집기 창에서 돌 수 있다.
   ■ 어떻게
     ① 실행되지 않는 <template> 안에서 푼다(그림을 불러오거나 on… 속성이 도는 일이 없다).
     ② 위험한 요소(script·style·iframe·object·form …)는 속까지 통째로 지우고, 모르는 요소는 껍데기만 걷어 글은 남긴다.
     ③ on… 속성·srcdoc·id·name 같은 속성은 지우고, 주소 속성은 http(s)·상대 주소·그림 data 주소만 남긴다.
     ④ 각주 본문(data-note — 나중에 HTML 로 다시 그려진다)도 같은 방식으로 거른다.
     ⑤ 다시 풀어 거른 결과가 같아질 때까지 되풀이한다(풀 때마다 모양이 바뀌는 조각을 막는다).
   ■ 지키는 것: 서식(글꼴·크기·색·표·칸 합치기·테두리·style·편집기의 data-* 표시)은 그대로 둔다.
   지킴: tests/hangul-safe-html.test.js */
(function (g) {
  'use strict';
  // 속까지 통째로 지우는 요소
  const DROP = new Set(['script', 'style', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet', 'link', 'meta', 'base',
    'form', 'input', 'button', 'textarea', 'select', 'option', 'optgroup', 'noscript', 'noembed', 'noframes', 'template', 'portal',
    'foreignobject', 'animate', 'animatemotion', 'animatetransform', 'set', 'discard', 'handler', 'listener', 'title', 'head']);
  // 그대로 두는 요소 — 편집기·서식이 쓰는 것. 여기 없는 요소는 껍데기만 걷는다(글은 남김)
  const KEEP = new Set([
    'a', 'abbr', 'address', 'article', 'aside', 'b', 'bdi', 'bdo', 'big', 'blockquote', 'br', 'caption', 'center', 'cite', 'code',
    'col', 'colgroup', 'dd', 'del', 'details', 'dfn', 'div', 'dl', 'dt', 'em', 'figcaption', 'figure', 'font', 'footer',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'i', 'img', 'ins', 'kbd', 'label', 'li', 'main', 'mark', 'nobr', 'ol', 'p',
    'pre', 'q', 'rp', 'rt', 'ruby', 's', 'samp', 'section', 'small', 'span', 'strike', 'strong', 'sub', 'summary', 'sup',
    'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'tt', 'u', 'ul', 'var', 'wbr',
    // 그림(SVG) — 편집기의 도형·글상자
    'svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'text', 'tspan', 'textpath', 'defs',
    'lineargradient', 'radialgradient', 'stop', 'pattern', 'clippath', 'mask', 'marker', 'image', 'use', 'symbol', 'desc',
    // 수식(MathML) — hangul/js/eq.js 가 만드는 것
    'math', 'mi', 'mn', 'mo', 'mover', 'mroot', 'mrow', 'mspace', 'msqrt', 'msub', 'msubsup', 'msup', 'mtable', 'mtd', 'mtext',
    'mtr', 'munder', 'munderover', 'mfrac']);
  // 지우는 속성 (on… 은 따로)
  const DROP_ATTR = new Set(['srcdoc', 'formaction', 'action', 'ping', 'srcset', 'imagesrcset', 'id', 'name', 'form', 'is',
    'autofocus', 'attributename', 'http-equiv']);
  // 주소가 들어가는 속성
  const URL_ATTR = new Set(['href', 'xlink:href', 'src', 'background', 'poster', 'data', 'cite', 'longdesc', 'lowsrc', 'dynsrc',
    'codebase', 'manifest', 'icon']);
  const MAX_NOTE_DEPTH = 3;

  // 주소 앞뒤·사이에 숨겨 «javascript:» 를 감추는 데 쓰이는 보이지 않는 글자(제어 문자·빈칸 종류) — 판정 전에 걷는다
  //  (역슬래시 이스케이프 없이 글자 번호로 만든다 — 편집 도구가 이스케이프를 실제 글자로 바꿔 정규식을 깨뜨린 일이 있다)
  const INVISIBLE = new RegExp('[' + [[0x00, 0x20], [0x7f, 0xa0], [0x1680, 0x1680], [0x180e, 0x180e], [0x2000, 0x200f],
    [0x2028, 0x2029], [0x205f, 0x205f], [0x3000, 0x3000], [0xfeff, 0xfeff]]
    .map(([a, b]) => String.fromCharCode(a) + (a === b ? '' : '-' + String.fromCharCode(b))).join('') + ']', 'g');
  // 주소가 안전한가 — 상대 주소·#·http(s) 만. 그림 자리(img·배경 등)는 그림 data 주소도. 글 링크(a)는 mailto·tel 도.
  function safeUrl(v, image) {
    const s = String(v == null ? '' : v).replace(INVISIBLE, '');
    const m = /^([a-z][a-z0-9+.\-]*):/i.exec(s);
    if (!m) return true;
    const sc = m[1].toLowerCase();
    if (sc === 'http' || sc === 'https') return true;
    if (!image && (sc === 'mailto' || sc === 'tel')) return true;
    if (image && sc === 'data') return /^data:image\/(png|jpe?g|gif|webp|bmp|svg\+xml)[;,]/i.test(s);
    return false;
  }

  // style 속성이 안전한가 — 옛 브라우저의 실행 문법·바깥 불러오기·위험한 주소를 막는다(글꼴·크기·테두리 같은 서식은 그대로)
  function safeStyle(v) {
    const s = String(v || '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\\/g, '');
    if (/expression\s*\(|javascript\s*:|vbscript\s*:|-moz-binding|behavior\s*:|@import/i.test(s)) return false;
    const re = /url\s*\(\s*(['"]?)([^'")]*)\1\s*\)/gi;
    let m;
    while ((m = re.exec(s))) if (!safeUrl(m[2], true)) return false;
    return true;
  }

  function cleanAttrs(el, tag, depth) {
    for (const a of Array.from(el.attributes)) {
      const n = a.name.toLowerCase(), v = a.value;
      let ok = true;
      if (n.indexOf('on') === 0 || DROP_ATTR.has(n)) ok = false;
      else if (URL_ATTR.has(n)) {
        if (tag === 'use') ok = /^#/.test(v.trim()); // 다른 문서의 도형을 끌어오지 않는다
        else ok = safeUrl(v, tag !== 'a');
      } else if (n === 'style') ok = safeStyle(v);
      else if (n === 'data-note') { // 각주 본문 — 나중에 HTML 로 다시 그려지므로 같은 방식으로 거른다
        if (depth >= MAX_NOTE_DEPTH) ok = false;
        else { const c = cleanOnce(v, depth + 1); if (c !== v) el.setAttribute(a.name, c); }
      }
      if (!ok) el.removeAttribute(a.name);
    }
  }

  function walk(parent, depth) {
    for (const node of Array.from(parent.childNodes)) {
      if (node.nodeType === 8 || node.nodeType === 7) { node.remove(); continue; } // 주석·처리 지시
      if (node.nodeType !== 1) continue;
      const tag = String(node.localName || node.nodeName || '').toLowerCase();
      if (DROP.has(tag)) { node.remove(); continue; }
      walk(node, depth); // 속을 먼저 거른 뒤
      if (!KEEP.has(tag)) { node.replaceWith(...Array.from(node.childNodes)); continue; } // 모르는 요소는 껍데기만 걷는다
      cleanAttrs(node, tag, depth);
    }
  }

  function cleanOnce(html, depth) {
    const doc = g.document;
    const tpl = doc && doc.createElement ? doc.createElement('template') : null;
    if (!tpl || !tpl.content) throw new Error('이 브라우저에서는 서식 HTML 을 안전하게 거를 수 없습니다');
    tpl.innerHTML = String(html == null ? '' : html);
    walk(tpl.content, depth || 0);
    return tpl.innerHTML;
  }

  // 거른 HTML 을 돌려준다. 다시 풀어 거른 결과가 같아질 때까지(최대 4번) — 끝내 바뀌면 글자만 남긴다.
  function clean(html) {
    let out = cleanOnce(html, 0);
    for (let i = 0; i < 4; i++) {
      const again = cleanOnce(out, 0);
      if (again === out) return out;
      out = again;
    }
    const tpl = g.document.createElement('template');
    tpl.innerHTML = out;
    const p = g.document.createElement('p');
    p.textContent = tpl.content.textContent || '';
    return p.outerHTML;
  }

  g.PureunSafeHtml = { clean, safeUrl, safeStyle };
})(typeof window !== 'undefined' ? window : globalThis);
