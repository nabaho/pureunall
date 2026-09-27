/* 뉴스레터 — «움직이는 화면»을 짓는 층 (대표 지시 2026-09-23)
   ═══════════════════════════════════════════════════════════════════════════
   「추석 설 명절 인사등을 영상 또는 화면으로도 보내고 싶은데」
   대표 결정: 「영상 말고 «움직이는 화면»만」

   ■ 무엇인가
     그림 몇 장이 차례로 넘어가며 글이 얹히는 웹 쪽 하나. 편지의 ▶ 를 누르면 열린다.

   ■ 왜 영상이 아닌가
     ① 메일은 영상을 못 튼다 — 다음메일·아웃룩이 <video> 를 못 보고, 우리 발송기도
        허락 목록에 없는 태그를 조용히 버린다. 어차피 «웹으로 한 번 나가야» 한다.
     ② 영상 파일은 둘 곳이 마땅찮다 — 우리 저장소(공개)는 한 번 넣으면 되돌리기
        어렵고, 유튜브는 «누가 언제 봤나»를 가져간다. 창고는 돈이 든다.
     ③ 그림 넘기기는 그 셋이 다 없다. 대신 «목소리»를 못 담는다 — 대표께 말씀드렸다.

   ■ 짓는 곳이 «여기»인 까닭 — 서버(functions/)가 아니라
     편지(전문)와 같은 길이다: 화면이 짓고 → 회차에 담아 두고(쇼) → 서버는 꺼내 줄 뿐.
     ★ 그래야 «보내기 전에» 대표께서 화면에서 미리 보실 수 있다.
     ⚠ 서버에 같은 것을 또 짓지 말 것 — 두 벌이면 반드시 어긋난다
       (functions/news-view.js 첫머리가 같은 까닭을 적어 두었다).

   ⚠⚠ 그림은 «우리 것»만 싣는다. 남의 서버 그림을 실으면 받는 분이 이 쪽을 여는
     순간 그 서버가 «언제 봤나»를 가져간다 — 편지(img주소)와 발송기(IMG_HOST_OK)가
     막는 것과 같은 구멍이다. 서버도 CSP 로 한 번 더 막는다(문은 둘이다). */

(function (global) {
  'use strict';

  /* ⚠ 발송기(functions/mail-send.js IMG_HOST_OK)와 «같은 두 곳»이다.
       ★ 여기에 남의 도메인을 더하지 말 것 — 한 줄 더하는 순간 열람 추적이 뚫린다.
       tests/newsletter-show.test.js 가 두 목록이 같은지 견준다. */
  var 우리주소들 = ['https://nabaho.github.io/pureunall/',
                   'https://asia-northeast3-pureun-erp.cloudfunctions.net/'];

  /* ⚠ 열두 장까지. 넘으면 «인사»가 아니라 «발표»가 된다 — 받는 분이 끝까지 안 본다. */
  var 장면한도 = 12;
  /* 한 장에 머무는 시간 — 글 두 줄을 소리 내 읽을 만큼. */
  var 머무는초 = 5;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function 우리그림인가(u) {
    var s = String(u == null ? '' : u).trim();
    for (var i = 0; i < 우리주소들.length; i++) {
      if (s.slice(0, 우리주소들[i].length).toLowerCase() === 우리주소들[i]) return s;
    }
    return '';
  }

  /* 장면 고르기 — 그림도 글도 없는 장면은 버린다. 남의 그림은 «그림만» 버리고 글은 남긴다.
     ⚠ 원본을 고치지 않는다 — 새 배열을 돌려준다(원본은 회차와 함께 저장되는 자료다). */
  function 장면고르기(장면들) {
    var 목 = Array.isArray(장면들) ? 장면들 : [];
    var 나 = [];
    for (var i = 0; i < 목.length && 나.length < 장면한도; i++) {
      var x = 목[i] || {};
      var 그림 = 우리그림인가(x.그림);
      var 글 = String(x.글 == null ? '' : x.글).trim().slice(0, 300);
      if (!그림 && !글) continue;
      나.push({ 그림: 그림, 글: 글 });
    }
    return 나;
  }

  function 여러줄(s) {
    return esc(s).replace(/\r\n|\r|\n/g, '<br>');
  }

  /* 쪽 한 장을 짓는다. 장면이 없으면 null — 빈 쪽을 담지 않는다. */
  function 쇼짓기(인사, 옵션) {
    var x = 인사 || {};
    var 장 = 장면고르기(x.장면들);
    if (!장.length) return null;
    var o = 옵션 || {};
    var 제목 = String(x.제목 == null ? '' : x.제목).trim() || '푸른노무법인';
    var 서명 = String(x.서명 == null ? '' : x.서명).trim();
    var 회사 = String(o.회사이름 == null ? '' : o.회사이름).trim() || '푸른노무법인';

    var 장면칸 = 장.map(function (s, i) {
      return '<figure class="sc' + (i === 0 ? ' on' : '') + '" data-i="' + i + '">'
        + (s.그림 ? '<div class="pic"><img src="' + esc(s.그림) + '" alt=""'
          + (i === 0 ? '' : ' loading="lazy"') + '></div>' : '<div class="pic none"></div>')
        + (s.글 ? '<figcaption>' + 여러줄(s.글) + '</figcaption>' : '')
        + '</figure>';
    }).join('');
    var 점 = 장.map(function (s, i) {
      return '<button class="dot' + (i === 0 ? ' on' : '') + '" data-go="' + i + '"'
        + ' aria-label="' + (i + 1) + '번째 장면"></button>';
    }).join('');

    /* ⚠ 누르는 것은 모두 «button» — 링크로 만들면 폰에서 길게 누를 때 주소가 뜬다.
       ⚠ prefers-reduced-motion — 움직임을 줄여 달라는 분께는 저절로 넘기지 않는다.
         넘기는 것은 ▶ 를 누르실 때만. (어지럼증이 있는 분이 실제로 계신다.) */
    var 스크립트 = '(function(){'
      + 'var S=[].slice.call(document.querySelectorAll(".sc")),'
      + 'D=[].slice.call(document.querySelectorAll(".dot")),'
      + 'P=document.getElementById("pp"),n=0,t=null,'
      + 'R=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;'
      + 'function go(i){n=(i+S.length)%S.length;'
      + 'S.forEach(function(e,k){e.classList.toggle("on",k===n);});'
      + 'D.forEach(function(e,k){e.classList.toggle("on",k===n);});'
      + 'document.getElementById("no").textContent=(n+1)+" / "+S.length;}'
      + 'function 멈춤(){if(t){clearInterval(t);t=null;}P.textContent="\\u25B6";P.setAttribute("aria-label","재생");}'
      + 'function 재생(){멈춤();P.textContent="\\u23F8";P.setAttribute("aria-label","멈춤");'
      + 't=setInterval(function(){if(n>=S.length-1){멈춤();return;}go(n+1);},' + (머무는초 * 1000) + ');}'
      + 'document.getElementById("pv").onclick=function(){멈춤();go(n-1);};'
      + 'document.getElementById("nx").onclick=function(){멈춤();go(n+1);};'
      + 'P.onclick=function(){if(t)멈춤();else{if(n>=S.length-1)go(0);재생();}};'
      + 'D.forEach(function(e){e.onclick=function(){멈춤();go(+e.getAttribute("data-go"));};});'
      + 'document.addEventListener("keydown",function(e){'
      + 'if(e.key==="ArrowLeft"){멈춤();go(n-1);}'
      + 'else if(e.key==="ArrowRight"){멈춤();go(n+1);}'
      + 'else if(e.key===" "){e.preventDefault();P.click();}});'
      + 'go(0);if(!R&&S.length>1)재생();else 멈춤();'
      + '})();';

    return '<!doctype html><html lang="ko"><head><meta charset="utf-8">'
      + '<meta name="viewport" content="width=device-width,initial-scale=1">'
      + '<meta name="robots" content="noindex">'
      + '<title>' + esc(제목) + ' — ' + esc(회사) + '</title>'
      + '<style>'
      + '*{box-sizing:border-box}'
      + 'html,body{margin:0;height:100%;background:#1b1511;color:#f6efe6;'
      + 'font-family:"Malgun Gothic","Apple SD Gothic Neo",sans-serif}'
      + 'main{max-width:960px;margin:0 auto;min-height:100%;display:flex;flex-direction:column;'
      + 'padding:18px 16px 22px}'
      + 'header{text-align:center;padding:4px 0 14px}'
      + 'header .co{font-size:11px;letter-spacing:4px;color:#b59d86}'
      + 'header h1{margin:6px 0 0;font-size:22px;font-weight:700;letter-spacing:-.4px;color:#fff}'
      + '.stage{position:relative;flex:1;min-height:0}'
      + '.sc{position:absolute;inset:0;margin:0;display:flex;flex-direction:column;'
      + 'opacity:0;visibility:hidden;transition:opacity .6s ease}'
      + '.sc.on{opacity:1;visibility:visible}'
      + '.pic{flex:1;min-height:180px;display:flex;align-items:center;justify-content:center;'
      + 'background:#120d0a;border-radius:10px;overflow:hidden}'
      + '.pic img{max-width:100%;max-height:100%;object-fit:contain;display:block}'
      + '.pic.none{flex:0 0 40px;background:none}'
      + 'figcaption{padding:16px 6px 4px;text-align:center;font-size:19px;line-height:1.7;'
      + 'color:#fbf4ea;min-height:4.4em}'
      + '.bar{display:flex;align-items:center;justify-content:center;gap:10px;padding-top:14px}'
      + '.bar button{font:inherit;border:0;cursor:pointer}'
      + '.ctl{width:44px;height:44px;border-radius:50%;background:#3a2d24;color:#fff;font-size:17px}'
      + '.ctl:hover{background:#4d3c30}'
      + '.dots{display:flex;gap:7px;margin:0 8px}'
      + '.dot{width:9px;height:9px;padding:0;border-radius:50%;background:#5c4a3d}'
      + '.dot.on{background:#e8d6c3}'
      + '#no{min-width:52px;text-align:center;font-size:12.5px;color:#b59d86}'
      + 'footer{text-align:center;font-size:12.5px;color:#9c8876;padding-top:14px}'
      + '@media (prefers-reduced-motion: reduce){.sc{transition:none}}'
      + '@media (max-width:600px){header h1{font-size:18px}figcaption{font-size:16px}'
      + '.dots{display:none}}'
      + '</style></head><body><main>'
      /* 편지 머리(요약머리)와 같은 영문 한 줄 — 편지에서 넘어왔을 때 «같은 집»으로 보이게 */
      + '<header><div class="co">PUREUN LABOR LAW FIRM</div>'
      + '<h1>' + esc(제목) + '</h1></header>'
      + '<div class="stage">' + 장면칸 + '</div>'
      + '<div class="bar">'
      /* ⚠ 앞·뒤는 ‹ › 로 — ▶ 를 둘 쓰면 «재생»과 «다음»이 같아 보인다 */
      + '<button class="ctl" id="pv" aria-label="앞 장면">‹</button>'
      + '<button class="ctl" id="pp" aria-label="재생">▶</button>'
      + '<button class="ctl" id="nx" aria-label="다음 장면">›</button>'
      + '<div class="dots">' + 점 + '</div><span id="no">1 / ' + 장.length + '</span>'
      + '</div>'
      + '<footer>' + (서명 ? esc(서명) + ' · ' : '') + esc(회사) + '</footer>'
      + '</main><script>' + 스크립트 + '</script></body></html>';
  }

  var API = { 쇼짓기: 쇼짓기, 장면고르기: 장면고르기, 우리그림인가: 우리그림인가,
    우리주소들: 우리주소들.slice(), 장면한도: 장면한도 };
  if (typeof module === 'object' && module.exports) module.exports = API;
  else global.PuNewsShow = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
