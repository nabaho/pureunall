/* 뉴스레터 «전문 보기» 쪽 — 판단하는 층 (파이어베이스도 인터넷도 모른다)
   ═══════════════════════════════════════════════════════════════════════════
   대표 지시 2026-09-12: 「전체적으로 한화면에 모든내용의 요약만 나오게 만들고
   클릭하면 … 확인할 수 있게 해달라」
   대표 결정: 「받는 분의 편지 — 요약만 보내고 「자세히 보기」는 웹 페이지로」

   ★★ 여기서 편지를 «다시 짓지 않는다».
     보낼 때 앱이 지은 전문을 회차에 그대로 담아 두고(newsletter/issues/{회차}/전문),
     이 쪽은 그것을 꺼내 줄 뿐이다. 까닭 둘:
       ① 편지 짓는 층(js/pu-news-tpl.js)은 화면 쪽에 있다. 서버(functions/)에는
          그 파일이 올라가지 않는다 — 베껴 두면 «두 벌»이 되어 반드시 어긋난다.
       ② 받는 분이 보는 쪽은 «그때 나간 그대로»여야 한다. 다시 지으면 자료가
          바뀐 뒤에 열었을 때 편지와 다른 것이 보인다.

   ⚠⚠ 이 쪽은 «누구나» 열 수 있다 — 받는 분이 메일에서 누르는 자리라 로그인이 없다.
     그래서 회차에서 «전문 한 칸만» 읽는다. 회차 안에는 받는 분들의 주소(받는이)가
     들어 있다 — 통째로 꺼내 내주면 그것이 그대로 새 나간다.
   ⚠ 초안은 안 보여 준다. 다음 주 열쇠는 규칙이라 누구나 지어 볼 수 있어서,
     안 보여 주지 않으면 «보내기 전 초안»이 밖에서 읽힌다. */
'use strict';

/* 회차 열쇠 — 자리 이름으로 쓰이므로 추적 쪽(news-track.js)과 «같은 잣대»로 씻는다.
   ⚠ 두 곳이 다르게 씻으면 편지가 가리키는 자리와 우리가 읽는 자리가 어긋난다. */
function 회차열쇠(v) {
  return String(v == null ? '' : v).trim().replace(/[.#$/[\]]/g, '_').slice(0, 40);
}

function 읽기(q) {
  const o = q && typeof q === 'object' ? q : {};
  const 회차 = 회차열쇠(o.i);
  return { 회차: 회차, ok: !!회차 };
}

/* 보여 줄 수 있는 회차인가.
   ⚠ 「없다」와 「아직 안 보냈다」를 가른다 — 사람에게 하는 말이 달라야 한다. */
function 볼수있나(상태, 전문) {
  const s = String(상태 == null ? '' : 상태).trim();
  const t = String(전문 == null ? '' : 전문).trim();
  if (!s) return { ok: false, 까닭: '없음' };
  if (s === '초안') return { ok: false, 까닭: '초안' };
  if (!t) return { ok: false, 까닭: '전문없음' };
  return { ok: true, 까닭: '' };
}

const 까닭말 = {
  없음: '그런 회차가 없습니다.',
  초안: '아직 보내지 않은 회차입니다.',
  전문없음: '이 회차는 전문이 담겨 있지 않습니다.'
};

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* 쪽 껍데기 — 편지는 «고정 폭 표»다(메일 700 · 전문 980, pu-news-tpl.js).
   ★ 폰에서 «잘리지 않게» 하는 길은 viewport 를 그 폭으로 못 박는 것이다. 그러면
     폰 브라우저가 그 폭짜리 쪽을 «제 화면에 맞게 줄여» 보여 준다 — 좌우가 안 잘린다.
     PC 브라우저는 이 값을 무시하므로 제 폭 그대로 나온다.
   ⚠⚠ 폭을 여기에 «적지 않는다» — 지어진 전문에서 읽는다(전문폭). 두 곳에 적으면
     한쪽만 바뀌어 잘리거나 가운데로 쏠린다. 옛 회차는 700 으로 담겨 있다.
   ⚠ width=device-width 로 두면 폰에서 그 폭이 그대로 깔려 오른쪽이 잘린다
     (실측 2026-09-12: 375px 폰에서 325px 가 화면 밖으로 나갔다).
   ⚠ transform:scale(calc(100vw/716)) 같은 것으로 줄이려 하지 말 것 —
     scale() 은 «수»를 받는데 calc(길이/수) 는 길이라 통째로 무시된다. 실제로 겪었다.
   ⚠ 편지 «안»을 손대지 않는다. 손대면 메일에서 보는 것과 달라진다. */
/* ══════════════════════════════════════════════════════════════════════════
   한 건만 띄우는 창 (대표 지시 2026-09-12)
   ══════════════════════════════════════════════════════════════════════════
   「각각의 건에 대해 클릭하면 팝업으로 각각의 기사 정책 판례등이 팝업으로 나오게
     해달라. 몇건 자세히보기 이렇게 안본다」

   ★ 편지에 붙여 둔 자리표(data-pop)를 그대로 쓴다 — 여기서 내용을 «다시 짓지 않고»
     그 칸을 통째로 베껴 창에 넣는다. 편지와 창이 다를 수가 없다.
   ★ 요약 편지의 줄은 …#n-news-2 로 온다. 그 자리로 내려가고 «창까지 열어» 준다 —
     내려만 가면 「눌렀는데 뭐가 달라졌나」가 된다.
   ⚠ 칸 안의 링크(원문·내려받기)는 «그대로 통하게» 둔다. 링크까지 창을 열면
     내려받기를 누를 길이 없어진다. */
var 창스크립트 =
  '(function(){' +
  'var p=document.getElementById("pop"),b=document.getElementById("popb"),' +
  't=document.getElementById("popt"),y=0;' +
  'function 꼭지이름(el){var 가=document.querySelectorAll("[id^=\'g-\']"),n="";' +
  'for(var i=0;i<가.length;i++){' +
  'if(가[i].compareDocumentPosition(el)&Node.DOCUMENT_POSITION_FOLLOWING){' +
  'var s=가[i].nextElementSibling;n=s?s.textContent:n;}}return n;}' +
  'function 열기(el){if(!el)return;b.innerHTML="";' +
  'var c=el.cloneNode(true);c.removeAttribute("id");c.removeAttribute("data-pop");' +
  'c.style.cursor="auto";b.appendChild(c);' +
  't.textContent=꼭지이름(el)||"이 소식";p.className="on";' +
  /* ⚠ 창이 떠 있는 동안 «뒤가 굴러가지» 않게 한다. 안 막으면 창 안에서 굴린 줄
       알았는데 뒤의 편지가 움직여, 닫았을 때 엉뚱한 자리에 서 있게 된다.
       ⚠ scrollY 를 적어 두고 닫을 때 되돌린다 — 안 되돌리면 맨 위로 튄다. */
  'y=window.scrollY;document.documentElement.style.overflow="hidden";' +
  'b.scrollTop=0;}' +
  'function 닫기(){if(p.className!=="on")return;p.className="";' +
  'document.documentElement.style.overflow="";window.scrollTo(0,y);' +
  'if(location.hash)history.replaceState(null,"",location.pathname+location.search);}' +
  'document.addEventListener("click",function(e){' +
  'if(e.target.closest&&e.target.closest("#pop")){' +
  'if(e.target.id==="popx"||e.target===p)닫기();return;}' +
  'if(e.target.closest&&e.target.closest("a"))return;' +
  'var el=e.target.closest&&e.target.closest("[data-pop]");if(el){e.preventDefault();열기(el);}});' +
  'document.addEventListener("keydown",function(e){if(e.key==="Escape")닫기();});' +
  /* ⚠ 자리로 «우리가» 내려간 뒤에 연다. 브라우저가 알아서 내려가기를 기다리면
       그 전에 열려 버려, 닫았을 때 맨 위로 튄다(그때 적어 둔 자리가 0 이라서). */
  'function 해시로(){var h=location.hash.replace("#","");' +
  'if(h.indexOf("n-")!==0)return;var el=document.getElementById(h);if(!el)return;' +
  'el.scrollIntoView();열기(el);}' +
  'window.addEventListener("hashchange",해시로);해시로();' +
  '})();';

/* 꼬리에 적을 제목 — «법인 이름은 덜어 낸다».
   ⚠⚠ 실측 2026-09-13(배포한 창을 열어 보고 알았다): 꼬리가
     「푸른노무법인  푸른노무법인 2026년 09월 2주차 주간뉴스레터 입니다.」였다.
     제목이 «편지 제목 그대로»라 법인 이름이 이미 들어 있었기 때문이다.
   ★ 이름은 꼬리가 따로 굵게 적는다 — 여기서는 그것만 덜어 내고 회차는 남긴다.
   ⚠ 덜어 내다 남는 것이 없으면 빈칸만 남는다 — 버팀말을 둔다. */
function 꼬리제목(제목) {
  const t = String(제목 == null ? '' : 제목)
    .split('푸른노무법인').join(' ')
    .replace(/\s*입니다\.?\s*$/, '')
    .replace(/\s+/g, ' ').trim();
  return t || '주간뉴스레터';
}

/* 편지가 «몇 px 짜리 표»인지 — 지어진 것에서 읽는다.
   ★★ 숫자를 여기에도 적으면 한쪽만 바뀌어 쪽이 잘리거나 가운데로 쏠린다.
     2026-09-17 전문을 980 으로 넓혔는데, 이 값을 안 따라가면 폰에서 오른쪽이 잘린다.
   ⚠ 옛 회차는 700 으로 담겨 있다 — 그때 담긴 대로 700 으로 보여야 맞다. */
function 전문폭(전문) {
  var m = /<table[^>]*\swidth="(\d{3,4})"[^>]*style="width:\1px;background-color:#ffffff/
    .exec(String(전문 || ''));
  var n = m ? Number(m[1]) : 700;
  return (n >= 600 && n <= 1200) ? n : 700;
}

function 쪽(제목, 전문) {
  var 폭 = 전문폭(전문);
  return '<!doctype html><html lang="ko"><head><meta charset="utf-8">'
    /* ★ 폰에서 «잘리지 않게» 하는 길은 viewport 를 편지 폭으로 못 박는 것이다.
         그러면 폰이 그 폭짜리 쪽을 제 화면에 맞게 줄여 보여 준다 — 좌우가 안 잘린다. */
    + '<meta name="viewport" content="width=' + 폭 + '">'
    + '<title>' + esc(제목 || '푸른노무법인 주간뉴스레터') + '</title>'
    + '<meta name="robots" content="noindex">'
    + '<style>html,body{margin:0;padding:0;background:#e9e7e3}'
    + '#wrap{width:' + 폭 + 'px;margin:0 auto}'
    /* ★★ 차림표를 «틀고정» — 굴러도 따라온다 (대표 지시 2026-09-13 「이부분 틀고정 해라」).
       ★ 편지는 표로 짜여 있다. 차림표 칸(꼭지 넷이 든 tr)에 자리표를 붙여 두고
         여기서 그 줄만 붙잡는다 — 편지 «속 글자»는 손대지 않는다.
       ⚠ 메일 프로그램은 position 을 대개 무시한다 — 거기서는 옛날처럼 그냥 붙어 있다.
         해롭지 않다. 통하는 곳(이 웹 쪽)에서만 따라오면 된다.
       ⚠ z-index 가 없으면 따라오는 띠 «밑으로» 글이 지나가며 겹쳐 읽힌다.
       ⚠ 바탕을 안 깔면 뒤 글자가 그대로 비친다. */
    + '#wrap [data-stick]{position:sticky;top:0;z-index:5;background:#ffffff;'
    + 'box-shadow:0 2px 6px rgba(36,26,19,.06)}'
    /* 누를 수 있다는 것을 손이 알게 한다 — 메일에는 이 규칙이 안 간다(<style> 은 지워진다) */
    + '[data-pop]{cursor:pointer}'
    + '[data-pop]{border-radius:6px;transition:outline-color .12s}'
    + '[data-pop]:hover{outline:2px solid #c9b79b;outline-offset:3px}'
    /* ⚠⚠ 바탕을 «비치게» 두지 말 것 (대표 지시 2026-09-12 「팝업인경우 1개의 사항만
         나오면 된다. 뒤에 배경에 또 내용이 이중으로 있는것 처럼보인다」).
       반투명으로 덮으면 뒤의 편지가 그대로 비쳐, 한 건만 보려고 열었는데
       같은 내용이 두 벌 깔린 것처럼 보인다. 종이빛으로 «꽉» 덮는다.
       ⚠ 예쁘게 만들려고 그림자·그러데이션을 넣다가 여기를 반투명으로 바꾸기 쉽다.
         검사(newsletter-view-look)가 그 자리를 지킨다. */
    + '#pop{position:fixed;inset:0;background:#e9e7e3;display:none;z-index:99}'
    /* ★ 가운데로 세운다 (대표 지시 2026-09-13 「너무 무미 건조하다」).
       ⚠ 한 문단짜리가 화면 꼭대기에 붙고 아래가 통째로 비어 있었다 —
         그것이 「무미건조」의 큰 몫이었다. */
    + '#pop.on{display:flex;align-items:center;justify-content:center;padding:20px 12px}'
    /* ★★ 창 «뒤»에 우리 얼굴을 둔다 (대표 지시 2026-09-13
         「팝업창 뒤 배경에 좀 뭔가를 넣고 싶다 … 너무 무미 건조하다」).
       ⚠⚠ pointer-events:none 이 없으면 «바깥 누르기»가 통째로 죽는다.
         닫는 길은 셋(단추·바깥·Esc)인데, 화면은 멀쩡해 보이면서 하나가 사라진다 —
         닫으려다 안 닫히는 것으로만 겪게 된다.
       ⚠ 여기 적는 것은 코드가 «이미 아는 것»(이름·전화)뿐이다.
         주소·대표자 같은 것을 지어 넣으면 손님이 그것을 사실로 읽는다. */
    /* ⚠ 가운데에 두면 카드 «뒤로 숨어» 넣은 뜻이 없어진다 — 위아래로 벌려 둔다. */
    + '#pop .bg{position:absolute;inset:0;display:flex;flex-direction:column;'
    + 'align-items:center;justify-content:space-between;padding:34px 0 20px;'
    + 'pointer-events:none;-webkit-user-select:none;user-select:none;overflow:hidden}'
    + '#pop .bg .w{font:bold 96px Georgia,\'Times New Roman\',serif;letter-spacing:16px;'
    + 'color:#dedad4;line-height:1;white-space:nowrap}'
    + '#pop .bg .s{margin-top:10px;font:bold 15px \'Malgun Gothic\',sans-serif;'
    + 'letter-spacing:5px;color:#c8c2b9;white-space:nowrap}'
    + '#pop .bg .t{font:12.5px \'Malgun Gothic\',sans-serif;color:#c8c2b9}'
    + '#pop .bg .top{display:flex;flex-direction:column;align-items:center}'
    /* ★ 글자를 키운 만큼 창도 넓힌다 — 안 그러면 줄만 잘게 쪼개진다 */
    /* ⚠⚠ position:relative + z-index 가 «반드시» 있어야 한다. 없으면 뒤에 둔 큰
         글자(.bg 는 자리를 잡은 것이라 위로 온다)가 흰 카드를 «뚫고 나와»
         본문 위에 겹쳐 찍힌다 — 배포하고 눈으로 보고서야 알았다(2026-09-13). */
    + '#pop .in{position:relative;z-index:1;'
    + 'background:#fff;width:min(780px,94vw);max-height:88vh;border-radius:16px;'
    + 'display:flex;flex-direction:column;overflow:hidden;border:1px solid #ddd7cf;'
    + 'box-shadow:0 18px 44px rgba(36,26,19,.22),0 2px 6px rgba(36,26,19,.08);'
    + 'animation:popup .18s ease-out}'
    + '@keyframes popup{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}'
    /* ⚠ 어지럼을 타는 분이 있다. 브라우저 설정을 켜 두면 그것을 지킨다 —
         안 지키면 예쁘게 만든 것이 누군가에게는 괴로움이 된다. */
    + '@media (prefers-reduced-motion:reduce){#pop .in{animation:none}'
    + '[data-pop]{transition:none}}'
    /* ★ 머리 — 편지 띠와 «같은 갈색»이다. 편지와 창이 한 집으로 보이게. */
    + '#pop .hd{display:flex;align-items:center;gap:10px;padding:14px 18px;background:#6f5a48}'
    + '#pop .hd .mark{font:bold 11px Georgia,\'Times New Roman\',serif;letter-spacing:2.5px;'
    + 'color:#e2d3bd;white-space:nowrap}'
    + '#pop .hd .bar{width:1px;align-self:stretch;background:#8a7563}'
    + '#pop .hd b{flex:1;min-width:0;font:bold 15px \'Malgun Gothic\',sans-serif;color:#fff;'
    + 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
    + '#pop #popx{border:1px solid #9d8a78;background:#7d6753;border-radius:8px;padding:6px 12px;'
    + 'font:bold 12px \'Malgun Gothic\',sans-serif;color:#fff;cursor:pointer;white-space:nowrap}'
    + '#pop #popx:hover{background:#8f7862}'
    /* 살구빛 가는 띠 — 머리와 글 사이를 한 겹 띄운다 */
    + '#pop .acc{height:5px;background:#fbf4ea;border-bottom:1px solid #efe7dc}'
    /* ★★ 글자를 «돋보기»로 키운다 (대표 지시 2026-09-13
         「글자를 좀더 많이 크게해서 쉽게 한번에 눈에 들어오게」).
       ⚠⚠ 제목·본문·곁말을 하나씩 키우면 편지와 창이 «서로 다른 글»이 된다.
         비율만 키우면 편지가 정한 결(제목이 본문보다 얼마나 큰가)이 그대로 산다 —
         편지를 손대지 않고 크게 보는 유일한 길이다. */
    + '#pop .bd{overflow:auto;padding:26px 28px;zoom:1.22}'
    /* ★ 꼬리 — 누가 보낸 쪽인지, 궁금하면 어디로 물어야 하는지. 없던 자리다. */
    + '#pop .ft{display:flex;align-items:center;gap:8px;padding:12px 18px;background:#faf8f5;'
    + 'border-top:1px solid #eceae6;font:12px \'Malgun Gothic\',sans-serif;color:#9a938a}'
    + '#pop .ft .nm{font-weight:bold;color:#6f5a48}'
    + '#pop .ft .sp{flex:1}'
    + '</style>'
    + '</head><body><div id="wrap">' + 전문 + '</div>'
    + '<div id="pop">'
    + '<div class="bg" aria-hidden="true">'
    + '<div class="top"><div class="w">PUREUN</div>'
    + '<div class="s">푸른노무법인 주간 노동뉴스레터</div></div>'
    + '<div class="t">문의 041-556-0035</div>'
    + '</div>'
    + '<div class="in">'
    + '<div class="hd"><span class="mark">PUREUN</span><span class="bar"></span>'
    + '<b id="popt">이 소식</b><button id="popx" type="button">닫기 ✕</button></div>'
    + '<div class="acc"></div>'
    + '<div class="bd" id="popb"></div>'
    + '<div class="ft"><span class="nm">푸른노무법인</span>'
    + '<span>' + esc(꼬리제목(제목)) + '</span>'
    + '<span class="sp"></span><span>문의 041-556-0035</span></div>'
    + '</div></div>'
    + '<script>' + 창스크립트 + '<\/script>'
    + '</body></html>';
}

function 없는쪽(까닭) {
  const 말 = 까닭말[까닭] || '보실 수 없는 회차입니다.';
  return '<!doctype html><html lang="ko"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<title>푸른노무법인 주간뉴스레터</title>'
    + '<meta name="robots" content="noindex"></head>'
    + '<body style="margin:0;background:#e9e7e3;font-family:\'Malgun Gothic\',sans-serif">'
    + '<div style="max-width:460px;margin:12vh auto;background:#fff;padding:30px 28px;'
    + 'border-radius:12px;text-align:center">'
    + '<div style="font-size:19px;font-weight:bold;color:#1b3a6b">푸른노무법인</div>'
    + '<div style="height:14px"></div>'
    + '<div style="font-size:14px;line-height:1.8;color:#33302c">' + esc(말) + '</div>'
    + '<div style="height:18px"></div>'
    + '<div style="font-size:12.5px;color:#9a938a">문의 041-556-0035</div>'
    + '</div></body></html>';
}

module.exports = { 회차열쇠, 읽기, 볼수있나, 쪽, 없는쪽, 까닭말, 꼬리제목, 전문폭 };
