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
  'c.style.cursor="auto";' +
  /* ⚠ 목록의 머리표 「—」는 «목록에서만» 뜻이 있다. 창에 따라 들어오면 글 앞에
       점 하나가 덩그러니 남는다 — 대표 화면에서 실제로 그렇게 보였다(2026-09-20). */
  'var 머=c.querySelector("span");' +
  'if(머&&머.textContent.replace(/\\s|\\u00a0/g,"")==="\\u2014")머.parentNode.removeChild(머);' +
  'b.appendChild(c);' +
  /* ★★★ 기사 창에 «어디서 온 기사인지 · 원문으로 가는 단추»를 붙인다
       (대표 지시 2026-09-20 「노동뉴스는 … 당해 뉴스를 팝업하게 해라」).
     ⚠ 줄이 한 줄뿐인 기사는 창을 열어도 새로 얻는 것이 없었다 — 제목만 되풀이했다.
     ⚠ 기사 «본문»은 여기에 안 싣는다. 판례(판결문)는 저작권 대상이 아니라 우리
       양식으로 펼 수 있지만, 신문 기사는 남의 저작물이다(functions/news-brief.js
       맨 위 규칙). 그래서 «그 기사로 바로 가는 큰 단추»까지가 우리가 할 수 있는 것이다. */
  'var 매체=el.getAttribute("data-src")||"",주소=el.getAttribute("data-url")||"";' +
  'if(주소){var f=document.createElement("div");f.className="popf";' +
  'f.innerHTML=\'<a href="\'+주소.replace(/"/g,"&quot;")+\'" target="_blank" rel="noopener">\'' +
  '+(매체?매체.replace(/</g,"&lt;")+"에서 ":"")+"기사 원문 보기 ↗</a>";' +
  'b.appendChild(f);}' +
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

/* ══════════════════════════════════════════════════════════════════════════
   틀고정한 차림표를 «일하게» 만든다 (대표 지시 2026-09-18 「캡쳐2 틀고정」)
   ══════════════════════════════════════════════════════════════════════════
   ⚠⚠ 차림표는 지금까지 «글자»였다. 굴러도 따라오기는 하는데 눌러도 아무 일이
     없었다 — 따라오는 값이 없는 띠였다. 편지(pu-news-tpl.js)에서 링크로 못 만드는
     까닭은 «메일 프로그램이 같은 편지 안 자리이동(#앵커)을 대개 무시»하기 때문이다.
     누르면 헛일이 되는 손잡이를 편지에 둘 수는 없다.
   ★ 그래서 «여기»에서 붙인다. 이 쪽은 브라우저라 확실히 통하고, 편지 속 글자는
     하나도 안 건드린다(메일은 예전 그대로다).
   ★ 짝은 «차례»로 맺는다. 차림표 칸 넷과 꼭지 자리표(<a id="g-…">)가 같은 차례다.
     ⚠ 지역 소식 꼭지도 id="g-" 를 달고 나오는데 «맨 뒤»라 넷과 안 부딪힌다.
   ★ 지금 보고 있는 꼭지에 밑줄이 그어진다 — 긴 쪽에서 «내가 어디쯤인지»가 보인다.
   ⚠ 따라오는 띠의 «키»만큼 덜 내려가야 제목이 띠 밑에 숨지 않는다. */
var 차림표스크립트 =
  '(function(){' +
  'var 줄=document.querySelector("#wrap [data-stick]");if(!줄)return;' +
  'var 칸=줄.querySelectorAll("td[align=center]");' +
  'var 가=document.querySelectorAll("#wrap [id^=\'g-\']");' +
  'var 표=[];' +
  'for(var i=0;i<칸.length&&i<가.length;i++){(function(c,a){' +
  'c.className="nav";c.setAttribute("role","link");c.tabIndex=0;표.push({c:c,a:a});' +
  /* ⚠ 내려앉는 자리(-띠키-14)와 아래 «어디냐»의 잣대(+띠키+22)는 짝이다.
       내려앉은 꼭지가 곧바로 «켜져» 보여야 한다 — 어긋나면 눌렀는데 옛 꼭지에
       밑줄이 남아 「안 눌렸나」가 된다(2026-09-18 실측: 1px 차이로 그랬다). */
  'function 가자(){var y=a.getBoundingClientRect().top+window.scrollY-줄.offsetHeight-14;' +
  'window.scrollTo({top:y<0?0:y,behavior:"smooth"});}' +
  /* ⚠⚠ 누를 때 «초점»이 잡히면 브라우저가 그 칸을 보이게 하려고 쪽을 «옆으로» 민다.
       창이 편지(980)보다 좁으면 왼쪽이 통째로 잘려 나간다 — 실제로 겪었다(2026-09-18).
       마우스 누름을 막으면 초점이 안 잡히고, 누르기(click)는 그대로 온다.
     ⚠ 키보드(Tab)로 올 때는 초점이 필요하다 — 그때 옆으로 미는 것은 «맞는» 일이다. */
  'c.addEventListener("mousedown",function(e){e.preventDefault();});' +
  'c.addEventListener("click",가자);' +
  'c.addEventListener("keydown",function(e){' +
  'if(e.key==="Enter"||e.key===" "){e.preventDefault();가자();}});' +
  '})(칸[i],가[i]);}' +
  'if(!표.length)return;' +
  'function 어디냐(){var h=줄.offsetHeight+22,사=0;' +
  'for(var i=0;i<표.length;i++){if(표[i].a.getBoundingClientRect().top<=h)사=i;}' +
  'for(var j=0;j<표.length;j++)표[j].c.className=(j===사?"nav on":"nav");}' +
  'window.addEventListener("scroll",어디냐,{passive:true});어디냐();' +
  '})();';

/* ══════════════════════════════════════════════════════════════════════════
   「전문 보기」를 «그 자리에서» 편다 (대표 지시 2026-09-18)
   ══════════════════════════════════════════════════════════════════════════
   「판례 전문보기 클릭하면 이렇게 창으로 넘어간다. 그러면 읽고 보는게 더힘들다.
     전문보기하면 처음화면에서 전문으로 다 내려오게만 만들어야된다.
     캡쳐1 화면에서 모두 보이는것이다 새창으로 안가고」

   ★ 누르면 newsFull 에서 받아 «그 자리 아래»에 편다. 창으로 안 넘어간다.
   ★ 어느 판례인지는 두 곳에서 읽는다 —
       ① 편지가 달아 둔 표(data-full="prec:622111")
       ② 없으면 법제처 주소에서(옛 회차의 담아 둔 전문도 그대로 된다)
   ⚠ 잡는 자리가 «훑는 쪽»(capture)이다. 팝업 여는 손잡이보다 먼저 잡아야
     누를 때 창이 같이 뜨지 않는다.
   ⚠ 못 받아 오면 «법제처에서 보기» 링크를 그대로 보여 준다 — 오늘보다 나빠지지 않는다.
   ⚠ 자바스크립트가 없으면 그냥 옛날처럼 법제처로 간다(링크를 살려 둔다). */
var 전문펴기스크립트 =
  '(function(){' +
  'function 씻(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;")' +
  '.replace(/>/g,"&gt;").replace(/"/g,"&quot;");}' +
  'function 줄(s){return 씻(s).replace(/\\n/g,"<br>");}' +
  'function 어느것(a){var d=a.getAttribute("data-full");' +
  'if(d){var p=d.split(":");' +
  'if(p.length===2&&/^(prec|expc)$/.test(p[0])&&/^\\d{1,12}$/.test(p[1]))return p;}' +
  'var h=a.getAttribute("href")||"";if(h.indexOf("law.go.kr")<0)return null;' +
  'var g=/[?&]target=(prec|expc)\\b/.exec(h),n=/[?&]ID=(\\d{1,12})\\b/i.exec(h);' +
  'return (g&&n)?[g[1],n[1]]:null;}' +
  /* 어디에 펴나 — 창 안이면 창 바닥, 쪽이면 그 건의 «표 바로 다음».
     ⚠⚠ 판례 한 건은 <table> 이다. 거기에 그냥 붙이면(appendChild) 덩이가 표 «안»으로
       들어가 74px 짜리 딱지 칸 폭으로 쪼그라든다 — 실제로 그렇게 나왔다(2026-09-18).
       표 «다음»에 끼워야 칸 폭을 다 쓴다. */
  'function 놓기(a,칸){var b=a.closest("#popb");if(b){b.appendChild(칸);return;}' +
  'var t=a.closest("[data-pop]");' +
  'if(t&&t.parentNode){t.parentNode.insertBefore(칸,t.nextSibling);return;}' +
  '(a.closest("td")||a.parentNode).appendChild(칸);}' +
  /* ⚠⚠ 접었을 때 돌려놓는 글귀를 «글자로 박아 두지 않는다» (2026-09-20 실측).
       「전문 보기 ↓」로 박아 두었더니, 편지가 ↗ 로 바뀐 뒤에도 여기만 ↓ 로 되돌려
       놓아 «한 번 폈다 접으면 화살표가 바뀌는» 쪽이 되었다. 살아 있는 쪽에서
       ↗ 둘·↓ 하나가 잡혔다.
     ★ 그래서 처음 글귀를 «적어 두었다가» 그대로 돌려놓는다 — 편지가 무엇으로
       바뀌든 여기는 따라간다(두 곳에 같은 글귀를 두지 않는다). */
  'function 펴기(a,t,id){' +
  'if(a.__label==null)a.__label=a.textContent;' +
  'if(a.__full){var 켜짐=a.__full.style.display!=="none";' +
  'a.__full.style.display=켜짐?"none":"";a.textContent=켜짐?a.__label:"접기 ↑";return;}' +
  'var 칸=document.createElement("div");칸.className="full";' +
  '칸.innerHTML=\'<div class="ld">전문을 받아 오는 중입니다…</div>\';' +
  '놓기(a,칸);a.__full=칸;a.textContent="접기 ↑";' +
  'fetch("/newsFull?t="+t+"&id="+id).then(function(r){return r.json();}).then(function(d){' +
  'if(!d||!d.ok)throw new Error((d&&d.말)||"못 받아 왔습니다");' +
  'var h="";' +
  'if(d.제목)h+=\'<div class="tt">\'+씻(d.제목)+"</div>";' +
  'if(d.인용)h+=\'<div class="ct">\'+씻(d.인용)+"</div>";' +
  /* ⚠⚠ 여기와 news-full.js 쪽() 은 «같은 칸들»을 그린다 — 한쪽만 고치면
       메일에서 새 탭으로 여신 분과 웹에서 그 자리에 펴신 분이 «다른 것»을 보신다.
     ★ 주문은 판에 얹고, 접는 칸(판결 이유)은 <details> 로 접어 둔다. */
  '(d.칸들||[]).forEach(function(k){' +
  'var 몸=\'<div class="p\'+(k.이름==="주문"?" key":"")+\'">\'+줄(k.글)' +
  '+(k.잘림?\'<div class="cut">… 너무 길어 여기까지만 보여 드립니다. 아래 「법제처에서 보기」로 다 보실 수 있습니다.</div>\':"")' +
  '+"</div>";' +
  'h+=k.접기?(\'<details class="fold"><summary>\'+씻(k.이름)' +
  '+\' <span style="font-weight:normal;letter-spacing:0">(\'+String(k.글||"").length.toLocaleString()+\'자)</span></summary>\'' +
  '+몸+"</details>"):("<h4>"+씻(k.이름)+"</h4>"+몸);});' +
  'h+=\'<div class="src"><a href="\'+씻(d.법제처||"")+\'" target="_blank" rel="noopener">법제처에서 보기 ↗</a></div>\';' +
  '칸.innerHTML=h;' +
  '}).catch(function(err){' +
  '칸.innerHTML=\'<div class="err">\'+씻((err&&err.message)||"못 받아 왔습니다")' +
  '+\' <a href="\'+씻(a.getAttribute("href")||"")+\'" target="_blank" rel="noopener">법제처에서 보기 ↗</a></div>\';' +
  '});}' +
  'document.addEventListener("click",function(e){' +
  'var a=e.target.closest&&e.target.closest("a[href]");if(!a)return;' +
  'var 것=어느것(a);if(!것)return;' +
  'e.preventDefault();e.stopPropagation();펴기(a,것[0],것[1]);},true);' +
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
    /* ══════════════════════════════════════════════════════════════════════
       ★★★ 쪽도 «창(팝업)과 같은 옷»을 입는다 (대표 지시 2026-09-20
         「현재 팝업디자인이 정말 마음에 든다 이렇게 뉴스레터 화면 바꿔 줄수없나」)
       ══════════════════════════════════════════════════════════════════════
       ★ 창이 좋았던 까닭은 둘이다 — ① 갈색 머리띠가 «누가 보낸 것인지»를 먼저
         말한다 ② 흰 종이가 떠 있어 «한 장»으로 보인다. 그 둘을 쪽에도 입힌다.
       ⚠⚠ 카드에 overflow:hidden 을 걸지 «말 것». 걸면 안에 있는 차림표의
         틀고정(position:sticky)이 통째로 죽는다 — 창(#pop .in)에서 베껴 올 때
         제일 쉽게 딸려 오는 줄이 그것이다. 모서리는 머리·꼬리에 따로 둥글린다.
       ⚠ 창 뒤의 «큰 PUREUN 글자»는 여기 안 가져온다. 재 보니 그 글자가 550px 인데
         편지 카드가 982px 라, 어떤 창 너비에서도 카드에 가려 «한 번도 안 보인다».
         안 보이는 것을 넣어 두면 다음 사람이 「왜 안 나오지」로 시간을 쓴다. */
    + 'body{padding:24px 0 44px}'
    /* 떠 있는 흰 종이 — 창의 .in 과 같은 결(그림자는 조금 옅게, 늘 떠 있으므로) */
    + '#card{position:relative;z-index:1;width:' + 폭 + 'px;margin:0 auto;background:#fff;'
    + 'border:1px solid #ddd7cf;border-radius:16px;'
    + 'box-shadow:0 18px 44px rgba(36,26,19,.16),0 2px 6px rgba(36,26,19,.06)}'
    + '#card .hd{display:flex;align-items:center;gap:10px;padding:14px 20px;'
    + 'background:#6f5a48;border-radius:15px 15px 0 0}'
    + '#card .hd .mark{font:bold 11px Georgia,\'Times New Roman\',serif;letter-spacing:2.5px;'
    + 'color:#e2d3bd;white-space:nowrap}'
    + '#card .hd .bar{width:1px;align-self:stretch;background:#8a7563}'
    + '#card .hd b{flex:1;min-width:0;font:bold 15px \'Malgun Gothic\',sans-serif;color:#fff;'
    + 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
    /* 살구빛 가는 띠 — 머리와 편지 사이를 한 겹 띄운다(창과 같다) */
    + '#card .acc{height:5px;background:#fbf4ea;border-bottom:1px solid #efe7dc}'
    + '#card .ft{display:flex;align-items:center;gap:8px;padding:12px 20px;background:#faf8f5;'
    + 'border-top:1px solid #eceae6;border-radius:0 0 15px 15px;'
    + 'font:12px \'Malgun Gothic\',sans-serif;color:#9a938a}'
    + '#card .ft .nm{font-weight:bold;color:#6f5a48}'
    + '#card .ft .sp{flex:1}'
    + '#wrap{width:100%;margin:0 auto}'
    /* ★★ 차림표를 «틀고정» — 굴러도 따라온다 (대표 지시 2026-09-13 「이부분 틀고정 해라」).
       ★ 편지는 표로 짜여 있다. 차림표 칸(꼭지 넷이 든 tr)에 자리표를 붙여 두고
         여기서 그 줄만 붙잡는다 — 편지 «속 글자»는 손대지 않는다.
       ⚠ 메일 프로그램은 position 을 대개 무시한다 — 거기서는 옛날처럼 그냥 붙어 있다.
         해롭지 않다. 통하는 곳(이 웹 쪽)에서만 따라오면 된다.
       ⚠ z-index 가 없으면 따라오는 띠 «밑으로» 글이 지나가며 겹쳐 읽힌다.
       ⚠ 바탕을 안 깔면 뒤 글자가 그대로 비친다. */
    + '#wrap [data-stick]{position:sticky;top:0;z-index:5;background:#ffffff;'
    + 'box-shadow:0 2px 6px rgba(36,26,19,.06)}'
    /* ⚠ 줄(tr)에 건 그림자를 안 그리는 브라우저가 있다 — 칸에도 한 번 건다. */
    + '#wrap [data-stick]>td{box-shadow:0 2px 6px rgba(36,26,19,.06)}'
    /* ★ 눌리는 차림표 (2026-09-18). 칸 서식이 «인라인»이라 !important 가 있어야 이긴다.
       ⚠ 밑줄은 border 가 아니라 inset 그림자로 긋는다 — border 를 얹으면 그 칸만
         1px 커져 차림표가 통째로 들썩인다. */
    + '#wrap [data-stick] td.nav{cursor:pointer;transition:color .12s,background .12s}'
    + '#wrap [data-stick] td.nav:hover{color:#241a13 !important;background:#faf8f5}'
    + '#wrap [data-stick] td.nav.on{color:#241a13 !important;'
    + 'box-shadow:inset 0 -2px 0 #6f5a48}'
    + '#wrap [data-stick] td.nav:focus-visible{outline:2px solid #c9b79b;outline-offset:-3px}'
    /* ★ 그 자리에서 편 «전문» (2026-09-18). 창으로 안 넘어가고 여기에 쌓인다.
       ⚠ 글자 크기를 편지보다 살짝 낮춘다 — 길어서, 편지와 같은 크기면 벽처럼 보인다.
       ⚠ 창 안(.bd)은 zoom 1.22 가 걸려 있어 여기서 더 키우지 않는다. */
    + '.full{margin-top:16px;padding-top:13px;border-top:1px solid #e0dcd6;text-align:left;'
    + 'font:13.5px/1.85 \'Malgun Gothic\',sans-serif;color:#33302c}'
    + '.full h4{margin:15px 0 5px;font-size:11.5px;letter-spacing:1.5px;color:#8a6f57;font-weight:bold}'
    + '.full h4:first-child{margin-top:0}'
    + '.full .tt{font-weight:bold;font-size:14.5px;line-height:1.5;color:#241a13;word-break:keep-all}'
    + '.full .ct{margin-top:3px;font-size:12px;color:#9a938a}'
    + '.full .p{word-break:keep-all}'
    /* ★ 주문은 «결론»이다 — 판에 얹어 눈에 먼저 들어오게 한다 (news-full.js 쪽() 과 같은 모양) */
    + '.full .p.key{background:#fbf4ea;border-left:3px solid #6f5a48;padding:10px 12px;'
    + 'font-weight:bold;color:#241a13}'
    /* ★★ 긴 이유는 접어 둔다 — 그 자리에서 펴도 쪽이 18장이 되면 안 본다 */
    + '.full details.fold{margin-top:15px;border-top:1px solid #e0dcd6;padding-top:4px}'
    + '.full details.fold>summary{cursor:pointer;list-style:none;padding:7px 0;'
    + 'font-size:11.5px;letter-spacing:1.5px;color:#8a6f57;font-weight:bold}'
    + '.full details.fold>summary::-webkit-details-marker{display:none}'
    + '.full details.fold>summary::after{content:" 펴 보기 ▾";font-weight:normal;color:#9a938a}'
    + '.full details.fold[open]>summary::after{content:" 접기 ▴";font-weight:normal;color:#9a938a}'
    + '.full details.fold>summary:hover{color:#241a13}'
    + '.full .ld,.full .err{padding:6px 0;font-size:13px;color:#8a837a}'
    + '.full .cut{margin-top:8px;font-size:12px;color:#9a938a}'
    + '.full .src{margin-top:15px;font-size:12px}'
    + '.full .src a,.full .err a{color:#1b3a6b;font-weight:bold;text-decoration:none}'
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
    /* ★ 기사 창 아래의 «원문으로 가는 단추» — 창을 연 보람이 여기에 있다.
         ⚠ 기사 본문은 안 싣는다(남의 저작물). 그래서 단추를 «크게» 둔다 —
           작은 글씨 「원문 ↗」 하나로는 열어 본 뜻이 없다. */
    + '#pop .popf{margin-top:18px;padding-top:15px;border-top:1px solid #e0dcd6}'
    + '#pop .popf a{display:inline-block;background:#6f5a48;color:#fff;'
    + "font:bold 13px 'Malgun Gothic',sans-serif;text-decoration:none;"
    + 'padding:10px 18px;border-radius:4px}'
    + '#pop .popf a:hover{background:#5b4938}'
    /* ★ 꼬리 — 누가 보낸 쪽인지, 궁금하면 어디로 물어야 하는지. 없던 자리다. */
    + '#pop .ft{display:flex;align-items:center;gap:8px;padding:12px 18px;background:#faf8f5;'
    + 'border-top:1px solid #eceae6;font:12px \'Malgun Gothic\',sans-serif;color:#9a938a}'
    + '#pop .ft .nm{font-weight:bold;color:#6f5a48}'
    + '#pop .ft .sp{flex:1}'
    + '</style>'
    + '</head><body>'
    /* 떠 있는 흰 종이 — 머리띠 · 편지 · 꼬리띠 (창과 같은 차림) */
    + '<div id="card">'
    + '<div class="hd"><span class="mark">PUREUN</span><span class="bar"></span>'
    + '<b>' + esc(꼬리제목(제목) || '주간 노동뉴스레터') + '</b></div>'
    + '<div class="acc"></div>'
    + '<div id="wrap">' + 전문 + '</div>'
    + '<div class="ft"><span class="nm">푸른노무법인</span>'
    + '<span>' + esc(꼬리제목(제목)) + '</span>'
    + '<span class="sp"></span><span>문의 041-556-0035</span></div>'
    + '</div>'
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
    + '<script>' + 창스크립트 + 차림표스크립트 + 전문펴기스크립트 + '<\/script>'
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
