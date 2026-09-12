'use strict';
/* 푸른노무법인 경력관리 — 「여러 장 PDF 를 서류마다 갈라 읽기」
   (브라우저 window.KcareerPageSplit / Node module.exports 겸용, DOM·통신 없음 — 글자만 본다)

   ── 왜 만드나 (대표 지시 2026-09-12 「한번에 여러장 pdf를 넣어도 모두 인식할수있게해라」) ──
   위촉장 열 장을 한 PDF 로 스캔해 넣으면 **한 건만** 등록됐다.
   까닭은 «고장»이 아니라 «짜임»이었다:
     · `_ocrPayload` 가 PDF 를 쪽마다 그림으로 바꿔 `pages[]` 로 넘기고,
     · 판독층(`pu-doc-read.js`)의 `readWithPrompt` 는 그 여러 장을
       **「한 문서의 여러 쪽」**으로 읽는다(그 층 주석에 그렇게 적혀 있다).
   경력증명서가 2장이면 2장을 «함께» 봐야 하므로 그 짜임 자체는 옳다.
   빠진 것은 **「이 묶음에 서류가 몇 개인가」를 묻는 일**이었다.

   ■ 여기서 하는 일 — «자리만 AI 가, 값은 우리가» 그대로다
     ① 부르는 쪽의 판독 사전을 **그대로** 두고, 「쪽을 서류별로 묶어 달라」를 덧붙인다.
     ② AI 가 `{"docs":[{"pages":[1],…},{"pages":[2,3],…}]}` 로 답하면 그것을 **검사해서**
        서류 목록으로 돌려준다. 담는 것은 결정적 코드가 한다.
   ⚠★ 「갈라 주세요」라고 **권하면 안 먹힌다**(옆 앱 실측 — `9bc6f0d4` 「권하기에서 못 박기로」).
     **꼴을 못 박고**, 그 꼴이 아니면 **아예 안 쓴다**(옛 길로 물러선다).
   ⚠★ 못 알아들으면 «오늘 되던 것»이 그대로 되어야 한다 — `parseDocs` 가 null 을 돌려주면
     부르는 쪽은 예전처럼 «한 건»으로 담는다. 새 기능 때문에 되던 것이 멈추면 안 된다.
   ⚠ 서류가 «하나»라고 답하면 그것도 옳은 답이다 — 억지로 가르지 않는다.
     2쪽짜리 경력증명서를 두 건으로 만들면 그게 더 나쁘다. */
(function (root) {

  /* 한 번에 읽을 쪽 수 뚜껑 — 넘으면 앞쪽만 읽고 «남았다»고 말한다.
     ⚠ 뚜껑을 없애지 말 것. 30쪽짜리를 통째로 보내면 요금과 시간이 함께 튄다. */
  var MAX_PAGES = 12;

  /* ⚠ 사전은 «그대로» 쓴다 — 칸 이름을 여기 다시 적으면 두 벌이 되어 한쪽만 고쳐진다.
     덧붙이는 것은 «묶는 방법»뿐이다. */
  function buildPrompt(base, n) {
    var 쪽 = Number(n) > 0 ? Number(n) : 1;
    return String(base == null ? '' : base).trim() + '\n\n'
      + '─────────────────────────────\n'
      + '⚠ 지금 드리는 그림은 **' + 쪽 + '쪽**입니다. 첫 그림이 1쪽이고 쪽 순서대로 놓여 있습니다.\n'
      + '이 묶음 안에 **서로 다른 서류가 여러 개** 들어 있을 수 있습니다'
      + '(여러 장을 한 번에 스캔한 것입니다).\n'
      + '반대로 **한 서류가 여러 쪽**일 수도 있습니다(2장짜리 경력증명서 등).\n\n'
      + '그래서 답은 **반드시 아래 꼴로만** 주십시오. 다른 꼴은 쓰지 마십시오.\n'
      + '{"docs":[{"pages":[1],  …위에서 말한 칸들… },'
      + '{"pages":[2,3], …위에서 말한 칸들… }]}\n\n'
      + '· `pages` 는 그 서류가 차지한 쪽 번호입니다(1부터 ' + 쪽 + '까지).\n'
      + '· 서류가 하나뿐이면 docs 에 하나만 넣으십시오.\n'
      + '· 쪽마다 기관·날짜·제목이 다르면 **서로 다른 서류**입니다 — 갈라 주십시오.\n'
      + '· 앞 쪽에서 이어지는 내용(표 이어짐·서명만 있는 쪽)이면 **같은 서류**입니다.\n'
      + '· 빈 쪽이나 서류가 아닌 쪽은 어느 docs 에도 넣지 마십시오.\n'
      + '· 칸 이름과 값 규칙은 **위에 적힌 그대로** 지키십시오. 모르는 값은 빈 문자열.\n'
      + '· docs 밖에는 아무 말도 쓰지 마십시오. JSON 만.';
  }

  function 쪽번호(v, n) {
    var out = [], seen = {};
    (Array.isArray(v) ? v : [v]).forEach(function (x) {
      var p = parseInt(String(x).replace(/[^0-9]/g, ''), 10);
      if (!(p >= 1 && p <= n)) return;
      if (seen[p]) return;
      seen[p] = 1; out.push(p);
    });
    out.sort(function (a, b) { return a - b; });
    return out;
  }

  /* 값이 하나라도 들어 있나 — 빈 서류를 만들지 않는다 */
  function 알맹이있나(f) {
    if (!f) return false;
    return Object.keys(f).some(function (k) {
      var v = f[k];
      return v != null && String(v).trim() !== '';
    });
  }

  /* AI 답 → 서류 목록.
     돌려주는 것 = { docs:[{pages:[..], fields:{..}}], unused:[쪽번호…] } 또는 null(못 알아들음) */
  function parseDocs(parsed, n) {
    var 쪽수 = Number(n) > 0 ? Number(n) : 1;
    if (!parsed || typeof parsed !== 'object') return null;
    var list = parsed.docs;
    if (!Array.isArray(list) || !list.length) return null;     /* 꼴이 아니면 «안 쓴다» */

    var docs = [], 쓴쪽 = {};
    list.forEach(function (d) {
      if (!d || typeof d !== 'object') return;
      var fields = {};
      Object.keys(d).forEach(function (k) { if (k !== 'pages') fields[k] = d[k]; });
      if (!알맹이있나(fields)) return;                          /* 빈 서류는 만들지 않는다 */
      /* ⚠ 같은 쪽이 두 서류에 들어가면 앞선 것이 이긴다 — 원본이 두 줄에 붙으면 안 된다 */
      var pages = 쪽번호(d.pages, 쪽수).filter(function (p) { return !쓴쪽[p]; });
      pages.forEach(function (p) { 쓴쪽[p] = 1; });
      docs.push({ pages: pages, fields: fields });
    });
    if (!docs.length) return null;

    /* 쪽 번호를 아예 안 준 서류가 있으면 «남은 쪽»을 순서대로 하나씩 나눠 준다.
       ⚠ 지어내는 것이 아니다 — 서류 수와 쪽 수가 맞을 때만, 순서대로 잇는 것뿐이다. */
    var 남음 = [];
    for (var p = 1; p <= 쪽수; p++) if (!쓴쪽[p]) 남음.push(p);
    docs.forEach(function (d) {
      if (d.pages.length) return;
      if (남음.length) d.pages = [남음.shift()];
    });
    docs = docs.filter(function (d) { return d.pages.length; });
    if (!docs.length) return null;

    docs.sort(function (a, b) { return a.pages[0] - b.pages[0]; });
    return { docs: docs, unused: 남음 };
  }

  var api = { buildPrompt: buildPrompt, parseDocs: parseDocs, MAX_PAGES: MAX_PAGES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.KcareerPageSplit = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
