/* 자료 메일 보내기 — 순수 로직
   ═══════════════════════════════════════════════════════════════════════════
   보내는 일 자체(SMTP)는 index.js 가 한다. 여기는 **값만** 다룬다 —
   그래야 실제로 메일을 쏘지 않고도 검사할 수 있다.

   ⚠ 이 층이 막아야 하는 것 네 가지
   1. 아무 데나 보내기 — 받는 주소를 검사하고 개수를 막는다. 로그인한 직원만
      부를 수 있지만, 그래도 우리 계정이 공개 발송기가 되면 안 된다.
   2. 너무 큰 첨부 — 메일 서버가 통째로 거절하면 '보냈다'고 나오고 실제로는
      아무 데도 안 간다. 보내기 전에 우리가 먼저 막는다.
   3. 헤더 끼워넣기 — 제목에 줄바꿈이 들어가면 받는사람·참조를 몰래 더할 수 있다.
   4. 빈 껍데기 — 받는 주소나 제목이 없으면 아예 부르지 않는다. */
'use strict';

/* 다음메일 기준. 25MB 라고 적혀 있지만 base64 로 부풀면 더 커지므로 여유를 둔다. */
const MAX_TOTAL_BYTES = 18 * 1024 * 1024;
const MAX_TO = 5;
const MAX_SUBJECT = 200;

/* 주소 하나가 쓸 만한가. 완벽한 검사가 아니라 '눈에 띄는 잘못'을 거른다 —
   진짜 판정은 메일 서버가 한다. */
function isEmail(v) {
  const s = String(v == null ? '' : v).trim();
  return /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]{2,}$/.test(s);
}

/* 쉼표·세미콜론으로 여러 개 올 수 있다. 다듬어 중복을 없애고 개수를 막는다. */
function parseRecipients(v) {
  const raw = Array.isArray(v) ? v : String(v == null ? '' : v).split(/[,;]/);
  const out = [];
  raw.forEach(function (x) {
    const s = String(x == null ? '' : x).trim();
    if (!s || !isEmail(s) || out.indexOf(s) >= 0) return;
    out.push(s);
  });
  return out;
}

/* 제목의 줄바꿈을 없앤다 — 남겨 두면 그 뒤에 Bcc: 한 줄을 붙여
   우리 몰래 다른 곳으로도 보낼 수 있다(헤더 끼워넣기). */
function cleanSubject(v) {
  return String(v == null ? '' : v).replace(/[\r\n]+/g, ' ').trim().slice(0, MAX_SUBJECT);
}

/* base64 dataURL 이 실제로 몇 바이트인가. 문자열 길이로 재면 3분의 1을 더 크게 본다. */
function dataUrlBytes(dataUrl) {
  const s = String(dataUrl == null ? '' : dataUrl);
  const i = s.indexOf(',');
  if (i < 0) return 0;
  const b64 = s.slice(i + 1);
  const pad = (b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0);
  return Math.max(0, Math.floor(b64.length * 3 / 4) - pad);
}

/* 자료 하나를 첨부 한 개로. 파일 내용이 없으면 null — 부르는 쪽이 걸러낸다.
   ⚠ 이름이 없으면 '자료.dat' 로 둔다. 이름 없는 첨부는 받는 쪽에서 열리지 않는다. */
function toAttachment(meta, dataUrl) {
  const url = String(dataUrl == null ? '' : dataUrl);
  const i = url.indexOf(',');
  if (i < 0 || !url.slice(i + 1)) return null;
  const m = (meta || {});
  const name = String(m.fileName || m.name || '자료.dat').replace(/[\\/:*?"<>|\r\n]/g, '_');
  return {
    filename: name,
    content: url.slice(i + 1),
    encoding: 'base64',
    bytes: dataUrlBytes(url)
  };
}

/* ══════ 서식 있는 본문 (대표 지시 2026-08-24 「다음메일과 완전하게 같게」) ══════
   그전에는 쓰기 화면에 글꼴·굵게 단추가 있는데 받는 사람에게는 아무 영향이 없었다 —
   본문이 평문이라 서식이 갈 데가 없었다. 이제 서식을 실제로 보낸다.

   ⚠ 남의 손으로 만들어진 HTML 을 그대로 내보내지 않는다. 직원만 쓰는 화면이지만,
     한 번 나간 메일은 되돌릴 수 없고 받는 쪽 메일 프로그램에서 열린다.
     그래서 «허용한 것만 남기고 나머지는 버린다»(allowlist). 새 태그를 쓰려면
     여기 목록에 먼저 올려야 한다 — 목록에 없으면 조용히 사라진다. */

/* 다음메일 도구줄이 내는 태그들.
   ⚠ img 는 «우리 것»만 통과한다(아래 IMG_OK). 아무 그림이나 허용하면
     받는 쪽이 열 때 남의 서버로 신호가 가서 「언제 읽었나」가 새 나간다.

   ★ 표(table)를 2026-09-02 에 «더했다» — 뉴스레터 때문이다(대표 지시 같은 날).
     메일에서 자리를 잡는 길은 표뿐이다. div 로 짠 자리잡기는 아웃룩·다음메일에서
     무너진다. 표가 없으면 뉴스레터가 «줄글 뭉치»로 도착한다.
   ★ 표를 더하는 것은 안전한 쪽이다 — 표는 글을 «담는» 그릇이지 무엇을 «하지»
     않는다. 위험한 것은 script·iframe·on* 손잡이·javascript: 주소인데
     그 넷은 아래에서 그대로 막는다. 엑셀에서 표를 붙여넣던 평소 메일도 함께 살아난다. */
const HTML_OK = ['b','strong','i','em','u','s','strike','br','p','div','span',
                 'ul','ol','li','a','hr','blockquote','font','sub','sup','img',
                 'table','thead','tbody','tfoot','tr','td','th','caption','h1','h2','h3','h4','h5','h6'];

/* 통과시킬 그림 —
   ① cid:pusign — 내 서명 명함 사진(functions/mail-sign.js). 보낼 때 서버가
      이 이름으로 인라인 첨부를 붙여 준다.
   ② 우리 홈페이지에 «우리가 올린» 그림. 뉴스레터 배너·로고 자리다.
      바깥 그림을 계속 막는 까닭(열람 시각이 남의 서버로 새는 것)은 그대로 지킨다 —
      우리 주소는 우리 서버라, 우리가 이미 아는 것 말고는 새 나갈 데가 없다.
   ⚠ 여기에 «남의 도메인»을 더하지 말 것. 한 줄 더하는 순간 열람 추적이 뚫린다. */
const SIGN_IMG_OK = 'cid:pusign';
/* ③ 우리 서버 함수 — 뉴스레터 열람 추적 그림(1×1)이다.
      대표 지시 2026-09-03 「열람 미열람을 정확하게 확인하고 …」
   ★ 위 ②와 같은 잣대다 — «우리 서버»라 우리가 이미 아는 것 말고는 새 나갈 데가 없다.
     남의 서버 그림을 계속 막는 까닭(열람 시각이 남에게 새는 것)은 그대로 지킨다.
   ⚠ 이 한 줄이 없으면 «우리 추적 그림도 함께 버려져» 열람이 영영 안 찍힌다.
     tests/mail-bulk.test.js 가 그것을 본다 — 그리고 남의 도메인이 여전히 막히는지도. */
const IMG_HOST_OK = ['https://nabaho.github.io/pureunall/',
                     'https://asia-northeast3-pureun-erp.cloudfunctions.net/'];
function imgSrcOk(v) {
  const s = String(v == null ? '' : v).trim();
  if (s.toLowerCase() === SIGN_IMG_OK) return SIGN_IMG_OK;
  for (const p of IMG_HOST_OK) { if (s.slice(0, p.length).toLowerCase() === p) return s; }
  return '';
}

/* 메일에서 안전한 꾸밈만. position·z-index 처럼 «자리를 잡는» 것은 받는 화면을
   덮어쓸 수 있어 뺀다.
   ★ 2026-09-02 에 padding·border·width·height·letter-spacing 을 더했다 —
     표로 짠 뉴스레터가 여백과 테두리 없이는 만들어지지 않는다.
     이 다섯은 «자기 칸 안»에서만 힘을 쓴다. 받는 화면을 덮는 것들과 다르다. */
const STYLE_OK = ['color','background-color','background','font-family','font-size',
                  'font-weight','font-style','text-decoration','text-align',
                  'line-height','margin','margin-left','padding-left','text-indent',
                  'padding','padding-top','padding-right','padding-bottom',
                  'border','border-top','border-bottom','border-left','border-right',
                  'border-radius','border-collapse','border-spacing',
                  'width','max-width','height','min-height','vertical-align',
                  'letter-spacing','display'];

/* 태그마다 남길 속성. 여기 없는 속성은 다 버린다(on* 손잡이가 여기서 걸러진다). */
/* ★ class 는 2026-09-26 에 더했다 — 화면 크기별 규칙(@media)이 붙잡을 손잡이다.
     ⚠ 값은 «우리 이름»(pu-…)만 남긴다(cleanClass). 남의 반 이름을 통과시켜 봐야
       우리 규칙은 .pu- 만 고르므로 아무 일도 안 하지만, 안 남기는 편이 깨끗하다. */
const TABLE_ATTR = ['style','class','width','height','align','valign','bgcolor',
                    'cellpadding','cellspacing','border','colspan','rowspan','role'];
const ATTR_OK = {
  a:    ['href','style'],
  font: ['color','face','size','style'],
  p:    ['style','align'], div: ['style','class','align'], span: ['style'],
  ul:   ['style'], ol: ['style'], li: ['style'], blockquote: ['style'],
  b:['style'], strong:['style'], i:['style'], em:['style'],
  u:['style'], s:['style'], strike:['style'], sub:['style'], sup:['style'],
  h1:['style'], h2:['style'], h3:['style'], h4:['style'], h5:['style'], h6:['style'],
  hr:[], br:[],
  table: TABLE_ATTR, thead: TABLE_ATTR, tbody: TABLE_ATTR, tfoot: TABLE_ATTR,
  tr: TABLE_ATTR, td: TABLE_ATTR, th: TABLE_ATTR, caption: ['style','align'],
  /* 그림 — 주소와 «자리 크기»만. 크기를 안 받으면 배너가 원본 크기로 튀어나와
     편지 폭을 넘는다. alt 는 그림이 안 뜰 때 대신 나오는 글자라 받는다. */
  img: ['src','width','height','alt','style']
};

/* 반 이름은 «우리 것»(pu-…)만 남긴다 — 화면 크기별 규칙이 붙잡는 손잡이다 */
function cleanClass(v) {
  return String(v == null ? '' : v).split(/\s+/)
    .filter(function (c) { return /^pu-[a-z0-9-]{1,20}$/.test(c); })
    .slice(0, 4).join(' ');
}

/* style 한 줄에서 허용한 속성만 남긴다. url( 이 있으면 그 style 을 통째로 버린다 —
   바깥 그림을 불러오면 「언제 읽었나」가 남의 서버에 새 나간다. */
function cleanStyle(v) {
  const s = String(v == null ? '' : v);
  if (/url\s*\(|expression\s*\(|[<>]/i.test(s)) return '';
  const out = [];
  s.split(';').forEach(function (part) {
    const i = part.indexOf(':');
    if (i < 0) return;
    const k = part.slice(0, i).trim().toLowerCase();
    const val = part.slice(i + 1).trim();
    if (!val || STYLE_OK.indexOf(k) < 0) return;
    out.push(k + ':' + val);
  });
  return out.join(';');
}

/* 누를 수 있는 주소인가 — http·https·mailto 만. javascript: 는 받는 쪽에서 돈다. */
function cleanHref(v) {
  const s = String(v == null ? '' : v).trim().replace(/[ -\s]/g, '');
  return /^(https?:\/\/|mailto:)/i.test(s) ? s.replace(/"/g, '&quot;') : '';
}

/* ══════════════════════════════════════════════════════════════════════════
   <style> 가운데 «화면 크기별 규칙»만 되살린다 (2026-09-26)
   ══════════════════════════════════════════════════════════════════════════
   위 sanitizeHtml 의 주석에 까닭을 적어 두었다. 여기서는 «어떻게» 만 본다.
   ⚠ 통과 못 하는 것은 조용히 버린다 — 반만 통과시키면 무너진 CSS 가 나간다.
   ⚠ 우리가 붙이는 반 이름은 모두 pu- 로 시작한다(js/pu-news-tpl.js).
     남의 편지에는 그런 반 이름이 없으므로 이 문으로는 아무것도 못 한다. */
const 반이름 = /^\.pu-[a-z0-9-]{1,20}$/;
function 꾸밈한줄(본문) {
  const out = [];
  String(본문 || '').split(';').forEach(function (part) {
    const i = part.indexOf(':');
    if (i < 0) return;
    const k = part.slice(0, i).trim().toLowerCase();
    let val = part.slice(i + 1).trim();
    if (!val || STYLE_OK.indexOf(k) < 0) return;
    /* !important 는 값이 아니라 «세기»다 — 떼어 보고 다시 붙인다 */
    let 세게 = '';
    const m = /^([\s\S]*?)\s*!\s*important$/i.exec(val);
    if (m) { val = m[1].trim(); 세게 = ' !important'; }
    if (!val || /url\s*\(|expression\s*\(|[<>{}]/i.test(val)) return;
    out.push(k + ':' + val + 세게);
  });
  return out.join(';');
}
function 안전한스타일(html) {
  const 덩이 = String(html || '').match(/<style\b[^>]*>([\s\S]*?)<\/style>/i);
  if (!덩이) return '';
  const 속 = 덩이[1];
  if (/@import|expression\s*\(|url\s*\(/i.test(속)) return '';
  const 살림 = [];
  /* @media (…) { …규칙들… } — 중괄호가 한 겹이라 이 꼴이면 충분하다.
     ⚠⚠ «빈 글자에 맞는» 꼴로 바꾸지 말 것. 이 되풀이는 lastIndex 로 앞으로 가는데,
       빈 글자에 맞으면 lastIndex 가 안 움직여 «영영 돈다» — 검사가 통째로 멎는다
       (2026-09-26 에 실제로 그렇게 됐다. 아래 한도가 그 안전장치다). */
  const 미디어 = /@media\s+([^{]{1,120})\{([\s\S]*?)\}\s*\}/g;
  let m;
  let 돌이 = 0;
  while ((m = 미디어.exec(속))) {
    /* ⚠ 안전 고리 — 어떤 까닭으로든 앞으로 안 나가면 여기서 끊는다.
         메일 한 통 때문에 발송기가 영영 멎는 일은 없어야 한다.
       ⚠ 지금 꼴(@media…)로는 «여기까지 못 온다» — 되돌림 검사로 못 잡는다(2026-09-26 확인).
         빼지는 말 것. 2026-09-26 에 이 되풀이가 실제로 영영 돌아 CI 가 10분 멎었다 —
         그때 이 고리가 있었으면 그 자리에서 끝났다. */
    if (++돌이 > 50 || 미디어.lastIndex <= m.index) break;
    const 조건 = m[1].trim();
    /* 조건도 좁게 — 화면 폭을 보는 것만 받는다(장치·인쇄 규칙은 안 받는다) */
    if (!/^(only\s+screen\s+and\s+)?\(\s*max-width\s*:\s*\d{2,4}px\s*\)$/i.test(조건)) continue;
    const 규칙들 = [];
    const 규칙 = /([^{}]+)\{([^{}]*)\}/g;
    let r;
    while ((r = 규칙.exec(m[2] + '}'))) {
      const 고르개 = r[1].trim();
      if (!고르개.split(',').every(function (x) { return 반이름.test(x.trim()); })) continue;
      const 몸 = 꾸밈한줄(r[2]);
      if (몸) 규칙들.push(고르개 + '{' + 몸 + '}');
    }
    if (규칙들.length) 살림.push('@media ' + 조건 + '{' + 규칙들.join('') + '}');
  }
  return 살림.length ? '<style>' + 살림.join('') + '</style>' : '';
}

/* 허용한 서식만 남긴다. 모르는 태그는 «글자는 살리고 태그만» 버린다 —
   태그와 함께 글자까지 버리면 편지 내용이 사라진다. */
function sanitizeHtml(v) {
  let s = String(v == null ? '' : v);
  if (!s) return '';
  /* ★★ 폰에서 글자가 작지 않게 — «화면 크기별 규칙»만 통과시킨다 (대표 지시 2026-09-26
       「폰에서 글자가 작다」)
     ═══════════════════════════════════════════════════════════════════════
     편지는 980px 고정 표다. 폰은 그것을 통째로 줄여 보여 주므로 글자가 38% 로 작아진다.
     줄이지 않게 하는 길은 «@media» 하나뿐이다 — 아웃룩은 @media 를 모르므로
     데스크톱 모습은 한 글자도 안 바뀌고, 폰·웹메일만 칸을 쌓아 폭에 맞춘다.
   ⚠⚠ 그래도 <style> 은 여전히 «거의 다» 버린다. 통과하는 것은 아래 셋을 모두 지킬 때뿐:
       ① @media 블록 «안»에 있는 규칙만 (밖에 있으면 데스크톱까지 덮는다)
       ② 고르개가 «우리가 붙인 반 이름»(.pu-…)일 때만 — 남의 편지를 그대로 전달할 때
          그쪽 style 이 우리 편지를 건드리지 못한다
       ③ 값은 inline 과 «같은 잣대»(STYLE_OK) — url()·expression() 은 그대로 막는다
     ⚠ 이 문을 넓히지 말 것. 넓히는 순간 「받은 것 그대로 전달」로 들어온 남의 CSS 가
       우리 편지를 덮는다(글을 숨기거나 남의 서버 그림을 부른다). */
  const 살린꾸밈 = 안전한스타일(s);
  s = s.replace(/<\s*(script|style|iframe|object|embed|template)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, '');
  s = s.replace(/<\s*(script|style|iframe|object|embed|template)\b[^>]*>/gi, '');
  s = s.replace(/<!--[\s\S]*?-->/g, '');

  /* ⚠⚠ 되살린 꾸밈은 «태그 거르개를 지난 뒤»에 붙인다. 먼저 붙이면 아래 거르개가
       <style> 을 다시 버리면서 «속 CSS 를 글자로» 남긴다 — 편지 맨 위에
       @media only screen… 이 그대로 보인다(2026-09-26 에 실제로 그렇게 됐다). */
  return 살린꾸밈 + s.replace(/<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g,
    function (whole, slash, rawName, rawAttrs) {
      const name = rawName.toLowerCase();
      if (HTML_OK.indexOf(name) < 0) return '';        // 태그만 버리고 글자는 남긴다
      if (slash) return '</' + name + '>';
      /* 그림은 «우리 것»만. 그 밖의 img 는 통째로 버린다 —
         속성만 걸러 빈 <img> 를 남기면 받는 화면에 깨진 그림 자리가 뜬다. */
      if (name === 'img') {
        const src = /src\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/i.exec(rawAttrs);
        const val = src ? (src[2] !== undefined ? src[2] : (src[3] !== undefined ? src[3] : src[4])) : '';
        const okSrc = imgSrcOk(val);
        if (!okSrc) return '';
        /* 서명 그림은 예전 그대로 — src 하나만 남긴다. 받을 이유가 없는 속성이고,
           받는 속성이 늘어날수록 빠져나갈 틈이 생긴다. */
        if (okSrc === SIGN_IMG_OK) return '<img src="' + SIGN_IMG_OK + '">';
        /* 우리 홈페이지 그림(뉴스레터 배너·로고)은 «자리 크기»까지 남긴다 —
           크기를 버리면 배너가 원본 크기로 튀어나와 편지 폭을 넘는다.
           src 는 여기서 확인한 값으로 «다시 적는다» — 아래 걸개를 거치지 않게. */
        const keepImg = ['src="' + okSrc.replace(/"/g, '&quot;') + '"'];
        const reI = /([a-zA-Z-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
        let mi;
        while ((mi = reI.exec(rawAttrs))) {
          const ki = mi[1].toLowerCase();
          if (ki === 'src') continue;
          if (['width', 'height', 'alt', 'style'].indexOf(ki) < 0) continue;
          const vi = mi[3] !== undefined ? mi[3] : (mi[4] !== undefined ? mi[4] : mi[5]);
          if (ki === 'style') { const cs = cleanStyle(vi); if (cs) keepImg.push('style="' + cs + '"'); continue; }
          if (/[<>"]/.test(vi)) continue;
          keepImg.push(ki + '="' + vi + '"');
        }
        return '<img ' + keepImg.join(' ') + '>';
      }
      const allow = ATTR_OK[name] || [];
      const keep = [];
      /* 속성 하나하나를 이름으로 확인한다 — 목록에 없으면 버린다(on* 이 여기서 걸린다) */
      const re = /([a-zA-Z-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
      let m;
      while ((m = re.exec(rawAttrs))) {
        const k = m[1].toLowerCase();
        const val = m[3] !== undefined ? m[3] : (m[4] !== undefined ? m[4] : m[5]);
        if (allow.indexOf(k) < 0) continue;
        if (k === 'style') { const cs = cleanStyle(val); if (cs) keep.push('style="' + cs + '"'); continue; }
        if (k === 'class') { const cc = cleanClass(val); if (cc) keep.push('class="' + cc + '"'); continue; }
        if (k === 'href')  { const hf = cleanHref(val);  if (hf) keep.push('href="' + hf + '"');  continue; }
        if (/[<>"]/.test(val)) continue;
        keep.push(k + '="' + val + '"');
      }
      return '<' + name + (keep.length ? ' ' + keep.join(' ') : '') + '>';
    });
}

/* 서식 있는 본문에서 평문 몫을 뽑는다. 서식을 못 읽는 메일 프로그램이 아직 있어
   두 몫을 «같이» 보내는데, 평문을 따로 쓰면 두 몫이 다른 말을 하게 된다. */
function htmlToText(v) {
  /* ⚠ pu-cards.html 의 htmlToTextC 와 «한 글자도 다르지 않게» 유지한다.
     tests/cards-mail-editor.test.js 가 두 쪽이 같은 답을 내는지 확인한다. */
  let s = String(v == null ? '' : v);
  if (!s) return '';
  s = s.replace(/<\s*(script|style)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, '');
  s = s.replace(/<\s*br\s*\/?\s*>/gi, '\n');
  s = s.replace(/<\s*\/\s*(p|div|li|blockquote|tr|h[1-6])\s*>/gi, '\n');
  s = s.replace(/<\s*hr\s*\/?\s*>/gi, '\n');
  s = s.replace(/<[^>]*>/g, '');
  s = s.replace(/&nbsp;/gi, ' ').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
       .replace(/&quot;/gi, '"').replace(/&#0*39;|&apos;/gi, "'").replace(/&amp;/gi, '&');
  /* 편집기는 빈 문단을 잔뜩 남긴다 — 셋 이상은 둘로 줄인다 */
  return s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

/* 첨부가 너무 클 때 하는 말 — «한 곳»에만 적는다.
   ⚠ 재는 자리가 둘이다: 여기(붙인 뒤 합계)와 mail-deliver(내려받기 «전»에 미리).
     문구를 두 벌로 두면 같은 일에 다른 말이 나와 무엇이 문제인지 흐려진다. */
function sizeError(total) {
  return '첨부가 너무 큽니다 (' + (Number(total || 0) / 1024 / 1024).toFixed(1) + 'MB). '
       + (MAX_TOTAL_BYTES / 1024 / 1024) + 'MB 아래로 줄여 주세요.';
}

/* 보내도 되는 요청인가. 되면 {ok:true, ...정리된 값}, 아니면 {ok:false, error}.
   ⚠ 첨부 크기는 **합계**로 본다. 한 개씩만 보면 8MB 세 개가 통과한다.
   ⚠★ 여기는 «붙어 있는 첨부의 bytes»만 셀 수 있다. bytes 를 안 달고 넘기면
      합계가 0 으로 보여 **한도가 통째로 없는 것과 같다**(2026-09-03 실측: 창고를
      거쳐 온 30MB 두 개가 그대로 통과했다). 첨부를 만드는 쪽이 bytes 를 «반드시»
      단다 — tests/mail-send-size.test.js 가 그것까지 지킨다. */
function validateSend(o) {
  const p = o || {};
  const to = parseRecipients(p.to);
  if (!to.length) return { ok: false, error: '받는 사람 주소가 없거나 형식이 맞지 않습니다.' };
  if (to.length > MAX_TO) return { ok: false, error: '받는 사람은 한 번에 ' + MAX_TO + '명까지입니다.' };

  const cc = parseRecipients(p.cc).filter(function (a) { return to.indexOf(a) < 0; });
  if (cc.length > MAX_TO) return { ok: false, error: '참조는 한 번에 ' + MAX_TO + '명까지입니다.' };

  /* 숨은참조 — 받는사람·참조에 이미 있으면 뺀다. 그대로 두면 같은 사람에게 두 통 간다. */
  const bcc = parseRecipients(p.bcc).filter(function (a) {
    return to.indexOf(a) < 0 && cc.indexOf(a) < 0;
  });
  if (bcc.length > MAX_TO) return { ok: false, error: '숨은참조는 한 번에 ' + MAX_TO + '명까지입니다.' };

  const subject = cleanSubject(p.subject);
  if (!subject) return { ok: false, error: '제목이 비어 있습니다.' };

  /* 서식 있는 본문 — 오면 씻어서 쓰고, 안 오면 예전과 «똑같이» 평문만 보낸다.
     여기서 멋대로 html 을 만들면, 평문으로 걸어 둔 옛 예약 메일의 모양이 바뀐다. */
  const html = sanitizeHtml(p.html);
  /* 평문 몫 — 화면이 준 것이 있으면 그것을, 없으면 서식에서 뽑아낸다 */
  const given = String(p.body == null ? '' : p.body);
  const body = given.trim() ? given : htmlToText(html);
  /* ⚠ 빈 껍데기는 «글자»로 판단한다. <p><br></p> 는 태그가 있어도 빈 편지다. */
  if (!body.trim()) return { ok: false, error: '본문이 비어 있습니다.' };

  const files = (p.attachments || []).filter(Boolean);
  let total = 0;
  files.forEach(function (f) { total += (f.bytes || 0); });
  if (total > MAX_TOTAL_BYTES) return { ok: false, error: sizeError(total) };
  return { ok: true, to: to, cc: cc, bcc: bcc, subject: subject,
    body: body, html: html, attachments: files, bytes: total };
}

/* 보낸 기록 — 화면이 아니라 **서버가** 남긴다. 실제로 나간 것만 남아야
   '보냈다는데 안 왔다'를 가릴 수 있다. 기업정보함 화면이 쓰는 모양과 같아야 한다. */
function sentLogRec(o) {
  const p = o || {};
  return {
    at: p.at || 0,
    by: String(p.by || ''),
    to: (p.to || []).join(', '),
    names: (p.names || []).map(function (v) { return String(v || ''); }).filter(Boolean),
    set: String(p.set || ''),
    auto: true                 /* 자동 발송으로 나갔다는 표시 — 손으로 보낸 것과 구분 */
  };
}

module.exports = {
  MAX_TOTAL_BYTES, MAX_TO, MAX_SUBJECT,
  isEmail, parseRecipients, cleanSubject, dataUrlBytes,
  toAttachment, validateSend, sentLogRec, sizeError,
  sanitizeHtml, htmlToText, cleanStyle, cleanHref, cleanClass, 안전한스타일,
  HTML_OK, STYLE_OK, SIGN_IMG_OK
};
