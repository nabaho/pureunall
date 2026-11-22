'use strict';
/* 정부사업신청 — 🤖 AI 사업 탭 (브라우저 window.GovAi / Node module.exports 겸용, DOM·통신 없음)

   대표 지시 2026-11-19 「ai 관련 사업 별도로 탭만들어달라」 — 함께 붙여 준 사업 넷(고용부 HR플랫폼 · 중기부 스마트서비스 ·
   과기정통부 AI·클라우드 바우처 · 중기부 스마트공장)과 넓은 AI 도입·전환 지원을 한 탭에 모은다.
   · 갈래 고르는 «규칙»은 공고를 받을 때와 같은 것(GovG2b.judgeAi) — 받을 때와 보여 줄 때 잣대가 다르면 「받았는데 안 보인다」가 된다.
   · 목록 짜기(차례·마감·셈)는 📍 지역 탭과 «한 벌»(GovRegion.buildWith) — 갈래 고르는 법(cls)만 다르다.
   · 모집 글(서버가 매일 읽는 기관 게시판)은 제목이 갈래에 걸리거나, AI 사업 쪽 게시판·기관(데이터바우처 · 공단 AI훈련코치)이면 넣는다.
   ⚠ 읽기만 한다 — 아무것도 고치거나 담지 않는다. */
(function (root) {
  var isNode = typeof module !== 'undefined' && module.exports;
  var G = isNode ? require('./gov-g2b.js') : root.GovG2b;
  var R = isNode ? require('./gov-region.js') : root.GovRegion;
  function s(v) { return v == null ? '' : String(v).trim(); }

  var KEYS = G.AI_PROGRAMS.map(function (p) { return p.k; });
  var NAME = {}; G.AI_PROGRAMS.forEach(function (p) { NAME[p.k] = p.name; });
  var ICON = { hr: '🧑‍💼', smart: '🛠', voucher: '🎫', factory: '🏭', ai: '🤖' };
  function label(k) { return NAME[k] || k; }
  function icon(k) { return ICON[k] || '🤖'; }

  /* 서버 게시판·기관 → 갈래 (functions/recruit-watch.js BOARDS · js/gov-recruit.js ORGS 의 번호 그대로).
     ⚠ 번호를 바꾸면 여기도 — tests/gov-ai.test.js 가 맞대 본다. */
  var BOARD_AI = { voucher: 'voucher' };          /* 데이터산업진흥원 알림 — 데이터바우처 공급기업·평가위원 */
  var ORG_AI = { voucher: 'voucher', hrdkai: 'ai' };   /* 혁신·데이터 바우처 · 공단 AI훈련코치(AX 코칭) */

  /* 공고 줄 → { groups, why }. 지금 규칙에 안 걸려도 받을 때 붙은 표시(r.ai)가 있으면 그것을 쓴다(규칙이 바뀌어도 사라지지 않게) */
  function ofFeed(r) {
    if (!r) return { groups: [], why: [] };
    var ks = G.judgeAi(r), why = 'AI 갈래 — ';
    if (!ks.length && s(r.ai)) { ks = s(r.ai).split(',').filter(function (k) { return KEYS.indexOf(k) >= 0; }); why = '받을 때 AI 갈래 — '; }
    return { groups: ks, why: ks.length ? [why + ks.map(label).join('·')] : [] };
  }
  /* 모집 글 → { groups, why } */
  function ofHit(h) {
    if (!h) return { groups: [], why: [] };
    var ks = G.judgeAi({ nm: h.title }), why = [];
    if (ks.length) why.push('제목 — ' + ks.map(label).join('·'));
    var b = BOARD_AI[s(h.board)], o = ORG_AI[s(h.org)];
    [[b, 'AI 사업 쪽 게시판'], [o, 'AI 사업 쪽 기관']].forEach(function (x) {
      if (x[0] && ks.indexOf(x[0]) < 0) { ks.push(x[0]); why.push(x[1] + ' — ' + label(x[0])); }
    });
    return { groups: KEYS.filter(function (k) { return ks.indexOf(k) >= 0; }), why: why };
  }
  function build(o) { return R.buildWith(o, { keys: KEYS, feed: ofFeed, hit: ofHit }); }

  var api = { KEYS: KEYS, BOARD_AI: BOARD_AI, ORG_AI: ORG_AI, label: label, icon: icon, ofFeed: ofFeed, ofHit: ofHit, build: build };
  if (isNode) module.exports = api;
  else root.GovAi = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
