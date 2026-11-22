/* 밖에서 보내 온 HTML 을 편집기에 넣기 전에 거른다 (2026-11-22)
   ■ 무엇을: 기금관리·업무이관 같은 다른 화면이 «일반 서식» 으로 보내 온 HTML (hangul/js/app.js 의 loadFromFundPayload).
     편집기는 받은 HTML 을 문서 칸에 그대로 넣으므로, 보낸 쪽 자료에 실행되는 조각이 섞여 있으면 편집기 창에서 돌 수 있다.
   ■ 어떻게
     ① 실행되지 않는 <template> 안에서 푼다(그림을 불러오거나 on… 속성이 도는 일이 없다).
     ② 위험한 요소(script·style·iframe·object·form·svg·math …)는 속까지 통째로 지우고, 모르는 요소는 껍데기만 걷어 글은 남긴다.
        그림(SVG)·수식(MathML)은 받지 않는다 — 도형·수식은 .hwpx(b64) 로 온다(main 의 같은 결정, 2026-11-22).
     ③ 속성은 «남기는 목록» 에 든 것만 둔다(on…·id·name·srcdoc 같은 것은 모두 빠짐). 편집기 표시(data-*)는 «값 모양이 맞는 것만» —
        쪽·단 나누기·칸 테두리·미주 구분·문단 번호·장평·줄 간격·표 너비 비율 등.
        머리말·글자 겹침·필드처럼 나중에 HTML 로 다시 그려지는 JSON 표시는 받지 않는다. 각주 본문(data-note)은 같은 방식으로 걸러 남긴다.
     ④ 주소: 글 링크(a href)는 http(s)·mailto·tel·상대 주소, 불러오는 그림(img src)은 그림 data 주소와 «같은 사이트» 주소만.
     ⑤ style: 글자로 검사하지 않고 «브라우저의 CSS 해석기» 로 읽은 뒤, 문서 서식에 쓰는 속성(글꼴·크기·색·정렬·여백·테두리·폭 …)만
        골라 다시 쓴다 — 주석·따옴표·이스케이프로 감춘 조각이 남지 않는다. 배경 그림은 그림 data 주소만, 위치는 static·relative 만.
     ⑥ 다시 풀어 거른 결과가 같아질 때까지 되풀이한다(풀 때마다 모양이 바뀌는 조각을 막는다).
   ⚠ 이 파일에 «백슬래시 u» 이스케이프를 쓰지 않는다 — 편집 도구가 실제 글자로 바꿔 정규식을 깨뜨린 일이 있다(글자 번호로 만든다).
   지킴: tests/hangul-safe-html.test.js */
(function (g) {
  'use strict';
  // 속까지 통째로 지우는 요소
  const DROP = new Set(['script', 'style', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet', 'link', 'meta', 'base',
    'form', 'input', 'button', 'textarea', 'select', 'option', 'optgroup', 'noscript', 'noembed', 'noframes', 'template', 'portal',
    'svg', 'math', 'title', 'head', 'xmp', 'plaintext', 'listing']);
  // 그대로 두는 요소 — 편집기·서식이 쓰는 것. 여기 없는 요소는 껍데기만 걷는다(글은 남김)
  const KEEP = new Set([
    'a', 'abbr', 'address', 'article', 'aside', 'b', 'bdi', 'bdo', 'big', 'blockquote', 'br', 'caption', 'center', 'cite', 'code',
    'col', 'colgroup', 'dd', 'del', 'details', 'dfn', 'div', 'dl', 'dt', 'em', 'figcaption', 'figure', 'font', 'footer',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'i', 'img', 'ins', 'kbd', 'label', 'li', 'main', 'mark', 'nobr', 'ol', 'p',
    'pre', 'q', 'rp', 'rt', 'ruby', 's', 'samp', 'section', 'small', 'span', 'strike', 'strong', 'sub', 'summary', 'sup',
    'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'tt', 'u', 'ul', 'var', 'wbr']);
  // 남기는 속성 — 여기 없는 속성은 모두 지운다(id·name·srcdoc·attributionsrc 같은 것도). href 는 a 에만, src 는 img 에만.
  const ATTR_OK = new Set(['class', 'style', 'title', 'lang', 'dir', 'align', 'valign', 'width', 'height', 'colspan', 'rowspan',
    'span', 'border', 'cellpadding', 'cellspacing', 'bgcolor', 'color', 'face', 'size', 'start', 'type', 'value', 'reversed', 'alt',
    'href', 'src', 'contenteditable', 'nowrap', 'headers', 'scope', 'open', 'frame', 'rules', 'clear', 'noshade']);
  // 남겨도 되는 편집기 표시와 그 값 모양 (hangul/js/dom.js·editor.js 가 읽는 것 — 값이 HTML 로 다시 그려지지 않는 것만)
  const FLAG = v => /^[0-9a-z]{0,8}$/i.test(v);
  const NUM = v => /^-?[0-9]{1,9}(\.[0-9]{1,6})?$/.test(v);
  const WORD = v => /^[A-Za-z_]{0,24}$/.test(v);
  const DATA_OK = {
    'data-kind': (v, tag) => tag === 'sup' && /^(foot|end)$/.test(v), // 각주·미주 구분
    'data-pb': FLAG, 'data-cb': FLAG, 'data-newpage': FLAG, 'data-kept': FLAG, 'data-dm': FLAG, // 쪽·단 나누기, 기본 칸 여백
    'data-ls0': v => v === '', // 마지막 글자 자간 보기용 표시
    'data-border': v => /^[A-Za-z0-9_#.,;=-]{0,400}$/.test(v), // 칸 테두리 «종류,굵기,색;…»
    'data-dir': WORD, 'data-wrap': WORD, 'data-hh': NUM, // 칸 글자 방향·한 줄 입력·원래 높이
    'data-c': v => /^[0-9a-f]{1,6}$/i.test(v), // 한컴 전용 글자 번호
    'data-head': v => /^[A-Za-z_]{1,24}:[0-9]{1,6}:[0-9]{1,3}$/.test(v), // 문단 번호·글머리표·개요 «종류:번호:수준»
    'data-ratio': NUM, 'data-sp': NUM, 'data-lse': NUM, 'data-spl': v => /^-?[0-9]{1,4}(\.[0-9]{1,6})?em$/.test(v), // 장평·자간 보정
    'data-lt': WORD, 'data-lv': NUM, 'data-ls': NUM, // 줄 간격(고정·최소·비율)
    'data-wr': NUM, // 표 너비 비율
  };
  const MAX_NOTE_DEPTH = 3;
  // 주소에서 «javascript:» 따위를 감추는 데 쓰이는 보이지 않는 글자(제어 문자·빈칸 종류) — 판정 전에 걷는다
  const INVISIBLE = new RegExp('[' + [[0x00, 0x20], [0x7f, 0xa0], [0x1680, 0x1680], [0x180e, 0x180e], [0x2000, 0x200f],
    [0x2028, 0x2029], [0x205f, 0x205f], [0x3000, 0x3000], [0xfeff, 0xfeff]]
    .map(([a, b]) => String.fromCharCode(a) + (a === b ? '' : '-' + String.fromCharCode(b))).join('') + ']', 'g');

  const here = () => { try { const o = g.location && g.location.origin; return o && o !== 'null' ? o : ''; } catch (e) { return ''; } };

  // 주소가 안전한가. resource=true 는 «저절로 불러오는 것»(그림): 그림 data 주소와 같은 사이트 주소만.
  //  resource=false 는 글 링크(누를 때만 감): http(s)·mailto·tel·상대 주소.
  function safeUrl(v, resource) {
    const s = String(v == null ? '' : v).replace(INVISIBLE, '');
    const m = /^([a-z][a-z0-9+.\-]*):/i.exec(s);
    if (!m) return !(resource && /^[\\/]{2}/.test(s)); // 상대 주소(«//남의사이트» 는 그림으로 불러오지 않는다)
    const sc = m[1].toLowerCase();
    if (resource) {
      if (sc === 'data') return /^data:image\/(png|jpe?g|gif|webp|bmp|svg\+xml)[;,]/i.test(s);
      if (sc === 'http' || sc === 'https') { try { return !!here() && new URL(s).origin === here(); } catch (e) { return false; } }
      return false;
    }
    return sc === 'http' || sc === 'https' || sc === 'mailto' || sc === 'tel';
  }

  // style — 문서 서식에 쓰는 속성만. 브라우저는 묶음 속성을 잘게 풀어 준다(white-space → white-space-collapse·text-wrap-mode,
  //  background-repeat → -x·-y, font-variant → font-variant-* 등) — 그래서 «갈래» 로 허용한다.
  const STYLE_PROPS = [
    /^(margin|padding)(-[a-z-]+)?$/,
    /^border(?!-image)(-[a-z-]+)?$/, // 테두리 그림(border-image)은 바깥 그림을 불러올 수 있어 뺀다
    /^font(-[a-z-]+)?$/,
    /^text-(?!shadow)[a-z-]+$/,
    /^white-space(-[a-z-]+)?$/,
    /^(color|line-height|letter-spacing|word-spacing|word-break|overflow-wrap|word-wrap|hyphens|tab-size|vertical-align|direction|unicode-bidi|writing-mode)$/,
    /^background(-(color|image|repeat|repeat-x|repeat-y|position|position-x|position-y|size|origin|clip))?$/,
    /^(width|min-width|max-width|height|min-height|max-height|box-sizing|float|clear|display|visibility|opacity|overflow(-x|-y)?|position)$/,
    /^(table-layout|caption-side|empty-cells)$/,
    /^list-style(-[a-z-]+)?$/,
    /^(page-break|break)-(before|after|inside)$/,
    /^(flex(-[a-z-]+)?|justify-[a-z-]+|align-[a-z-]+|place-[a-z-]+|gap|row-gap|column-gap|order)$/, // 기금 서식의 날인란 배치
    /^--(w|tbl|tbr)$/, // 편집기 표 너비 변수(값은 숫자만 — 아래)
  ];
  // 배경 그림: 그림 data 주소 하나만 — 따옴표로 감싼 것은 속에 따옴표·백슬래시가 없어야, 안 감싼 것은 따옴표·괄호·빈칸·백슬래시가 없어야
  const SAFE_BG = /^url\((?:"data:image\/(?:png|jpe?g|gif|webp|bmp|svg\+xml)[;,][^"\\]*"|data:image\/(?:png|jpe?g|gif|webp|bmp|svg\+xml)[;,][^"'()\\\s]*)\)$/i;
  function okStyleValue(prop, val) {
    const v = String(val).trim();
    if (prop === 'position') return /^(static|relative)$/i.test(v); // 화면(편집기 단추)을 덮는 fixed·absolute·sticky 는 받지 않는다
    if (prop.indexOf('--') === 0) return /^-?[0-9]{1,6}(\.[0-9]{1,6})?(%|px|mm|pt|em)?$/.test(v); // 표 너비 변수는 숫자만
    if (prop === 'background-image') return /^none$/i.test(v) || SAFE_BG.test(v); // var() 로 바깥 주소를 끌어오는 것도 막는다
    if (/url\(/i.test(v)) return false;
    return !/expression|image-set|javascript:|vbscript:|-moz-binding|@import|\\|<|>/i.test(v);
  }
  function cleanStyle(el) {
    let st = null;
    try { st = el.style; } catch (e) { st = null; }
    if (!st || typeof st.length !== 'number' || typeof st.getPropertyValue !== 'function') { el.removeAttribute('style'); return; }
    // 고른 속성을 빈 요소에 다시 넣고 «브라우저가 쓴» style 글을 쓴다(브라우저가 묶음 이름으로 다시 묶는다 — 엔진마다 같은 모양)
    const box = (el.ownerDocument || g.document).createElement('span');
    const out = box.style;
    for (let i = 0; i < st.length; i++) {
      const p = String(st[i] || '').toLowerCase();
      if (!p || !STYLE_PROPS.some(re => re.test(p))) continue;
      const v = st.getPropertyValue(p);
      if (!v || !okStyleValue(p, v)) continue;
      try { out.setProperty(p, v, st.getPropertyPriority(p) === 'important' ? 'important' : ''); } catch (e) { /* 못 넣는 값은 버림 */ }
    }
    const css = String(out.cssText || '').trim();
    if (css) el.setAttribute('style', css);
    else el.removeAttribute('style');
  }

  function cleanAttrs(el, tag, depth) {
    let hasStyle = false;
    for (const a of Array.from(el.attributes)) {
      const n = a.name.toLowerCase(), v = a.value;
      let ok = true;
      if (n.indexOf('on') === 0) ok = false;
      else if (n === 'href') ok = tag === 'a' && safeUrl(v, false);
      else if (n === 'src') ok = tag === 'img' && safeUrl(v, true);
      else if (n === 'style') hasStyle = true; // 아래에서 CSS 해석기로 다시 쓴다
      else if (n === 'data-note') { // 각주 본문 — 나중에 HTML 로 다시 그려지므로 같은 방식으로 거른다
        if (depth >= MAX_NOTE_DEPTH) ok = false;
        else { const c = cleanOnce(v, depth + 1); if (c !== v) el.setAttribute(a.name, c); }
      } else if (n.indexOf('data-') === 0) ok = !!(DATA_OK[n] && DATA_OK[n](v, tag));
      else ok = ATTR_OK.has(n) && !/url\s*\(|expression|javascript:/i.test(v.replace(INVISIBLE, '')); // 남기는 속성도 속에 참조·실행 문법이 없어야
      if (!ok) el.removeAttribute(a.name);
    }
    if (hasStyle) cleanStyle(el);
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

  g.PureunSafeHtml = { clean, safeUrl };
})(typeof window !== 'undefined' ? window : globalThis);
