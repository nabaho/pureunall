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

/* 쪽 껍데기 — 편지는 700px 고정 폭 표다(pu-news-tpl.js 의 넓이).
   ★ 폰에서 «잘리지 않게» 하는 길은 viewport 를 700 으로 못 박는 것이다. 그러면
     폰 브라우저가 700px 짜리 쪽을 «제 화면에 맞게 줄여» 보여 준다 — 좌우가 안 잘린다.
     PC 브라우저는 이 값을 무시하므로 700px 그대로 나온다.
   ⚠ width=device-width 로 두면 폰에서 700px 가 그대로 깔려 오른쪽이 잘린다
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
  't=document.getElementById("popt");' +
  'function 꼭지이름(el){var 가=document.querySelectorAll("[id^=\'g-\']"),n="";' +
  'for(var i=0;i<가.length;i++){' +
  'if(가[i].compareDocumentPosition(el)&Node.DOCUMENT_POSITION_FOLLOWING){' +
  'var s=가[i].nextElementSibling;n=s?s.textContent:n;}}return n;}' +
  'function 열기(el){if(!el)return;b.innerHTML="";' +
  'var c=el.cloneNode(true);c.removeAttribute("id");c.removeAttribute("data-pop");' +
  'c.style.cursor="auto";b.appendChild(c);' +
  't.textContent=꼭지이름(el)||"이 소식";p.className="on";}' +
  'function 닫기(){p.className="";' +
  'if(location.hash)history.replaceState(null,"",location.pathname+location.search);}' +
  'document.addEventListener("click",function(e){' +
  'if(e.target.closest&&e.target.closest("#pop")){' +
  'if(e.target.id==="popx"||e.target===p)닫기();return;}' +
  'if(e.target.closest&&e.target.closest("a"))return;' +
  'var el=e.target.closest&&e.target.closest("[data-pop]");if(el){e.preventDefault();열기(el);}});' +
  'document.addEventListener("keydown",function(e){if(e.key==="Escape")닫기();});' +
  'function 해시로(){var h=location.hash.replace("#","");' +
  'if(h.indexOf("n-")===0){var el=document.getElementById(h);if(el)열기(el);}}' +
  'window.addEventListener("hashchange",해시로);해시로();' +
  '})();';

function 쪽(제목, 전문) {
  return '<!doctype html><html lang="ko"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=700">'
    + '<title>' + esc(제목 || '푸른노무법인 주간뉴스레터') + '</title>'
    + '<meta name="robots" content="noindex">'
    + '<style>html,body{margin:0;padding:0;background:#e9e7e3}'
    + '#wrap{width:700px;margin:0 auto}'
    /* 누를 수 있다는 것을 손이 알게 한다 — 메일에는 이 규칙이 안 간다(<style> 은 지워진다) */
    + '[data-pop]{cursor:pointer}'
    + '[data-pop]:hover{outline:2px solid #8a6f57;outline-offset:3px}'
    + '#pop{position:fixed;inset:0;background:rgba(36,26,19,.55);display:none;z-index:99}'
    + '#pop.on{display:flex;align-items:flex-start;justify-content:center;padding:24px 12px}'
    + '#pop .in{background:#fff;width:min(660px,94vw);max-height:88vh;border-radius:10px;'
    + 'display:flex;flex-direction:column;overflow:hidden;'
    + 'box-shadow:0 14px 40px rgba(36,26,19,.35)}'
    + '#pop .hd{display:flex;align-items:center;gap:8px;padding:12px 15px;background:#f5f1ec;'
    + 'border-bottom:1px solid #e0dcd6;font:bold 14px \'Malgun Gothic\',sans-serif;color:#4a3c2e}'
    + '#pop .hd b{flex:1;min-width:0}'
    + '#pop #popx{border:1px solid #e0dcd6;background:#fff;border-radius:6px;padding:5px 11px;'
    + 'font:bold 12px \'Malgun Gothic\',sans-serif;color:#6f5a48;cursor:pointer}'
    + '#pop .bd{overflow:auto;padding:18px 16px}'
    + '</style>'
    + '</head><body><div id="wrap">' + 전문 + '</div>'
    + '<div id="pop"><div class="in">'
    + '<div class="hd"><b id="popt">이 소식</b><button id="popx" type="button">닫기 ✕</button></div>'
    + '<div class="bd" id="popb"></div></div></div>'
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

module.exports = { 회차열쇠, 읽기, 볼수있나, 쪽, 없는쪽, 까닭말 };
