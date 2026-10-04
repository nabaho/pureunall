/* 취업규칙 ✏️ 조문 편집 — 「✨ AI 다듬기」 상자 그리기 (설계 §9 · 2026-10-04 목업 세 물음 「추천대로」)

   조문 편집 카드(#art-edit) 아래에 AI 다듬기 단추 둘(뜻 그대로 다듬기 · 검토 지적 반영)을 두고,
   AI 가 고쳐 온 글을 «지금 글»에 견줘 보인 뒤, 사람이 「이 판으로 바꾸기」를 눌러야 「변경 후」 칸에 들어간다.
   여기서는 «글»을 만들기만 한다(DOM 을 만지지 않는다 — 검사가 그린 글을 본다). 부르기·넣기는 rules.html.

   st = { state:'menu'|'sending'|'ready'|'error', mode:'tidy'|'fix', hasFindings, nFindings,
          cur(지금 변경 후 본문 — 머리 뗀 것), got({text, why, maskLeft} — restore 뒤 글), err,
          before(검토 때 이 조의 위반의심 수), warns(다시 판정 위반 의심 배열 — 못 했으면 null), judgeFail(다시 판정 못 함),
          unjudged(이 조에 누락·수동확인 지적이 있었나 — 그것은 다시 판정하지 않는다) }

   ★ 지키는 것
     · 글은 모두 esc — AI 가 쓴 글·지금 글의 꺾쇠가 태그가 되면 안 된다.
     · 보이는 글 = 넣을 글: wordDiff(지금 글, AI 글)의 '=' 와 '+' 를 이으면 AI 글 그대로다. 줄바꿈은 <br>.
       '+' 는 <ins>(AI 가 넣은 곳), '-' 는 <del>(AI 가 뺀 곳 — 사라질 곳이라 줄을 그어 보인다).
     · 「지적 반영」 단추는 지적이 있을 때만 — 없는 지적을 «반영»하라고 시킬 수는 없다.
     · 한 줄 칸(머리·안내·⚠ 줄)은 넘치면 … 이고 title 에 전문. */
(function (root) {
  'use strict';

  function lib(name, rel) {
    if (root && root[name]) return root[name];
    if (typeof require === 'function') { try { return require(rel); } catch (e) { /* 화면에서는 위에서 찾는다 */ } }
    return null;
  }
  function P() { return lib('PuRulesPolish', './lib-polish.js'); }
  function FC() { return lib('PuRulesFileCmp', '../pu-rules-filecmp.js'); }

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function h(s) { return esc(s).replace(/\n/g, '<br>'); }
  /* 한 줄 칸 — 넘치면 … (CSS), 전문은 title */
  function line(cls, text) { return '<span class="' + cls + '" title="' + esc(text) + '">' + esc(text) + '</span>'; }
  function head(extra, title) { return '<div class="pol-h"><b>' + esc(title || '✨ AI 다듬기') + '</b>' + (extra || '') + '</div>'; }

  function menuHtml(st) {
    var rows = '<button class="stbtn pol-opt" data-pol="tidy">' + esc(P().MODES.tidy) + '</button>';
    if (st.hasFindings) {
      rows += '<button class="stbtn pol-opt" data-pol="fix">' + esc(P().MODES.fix) + ' · 이 조의 지적 ' + esc(st.nFindings || 0) + '건</button>';
    }
    return head() + '<div class="pol-menu">' + rows + '</div>'
      + line('pol-note', 'AI 에게는 이 조 하나만, 회사 이름·개인정보를 가리고 보냅니다 — 하루 몫은 회사 전체가 함께 씁니다');
  }

  /* 다시 판정 한 줄 — 무엇을 견줬는지 밝힌다.
     before: 검토 때 이 조의 위반의심 수 · warns: AI 글을 다시 판정한 위반의심(못 했으면 judgeFail).
     다시 판정은 «위반의심»만 한다 — 누락·수동확인이 있던 조라면 그것은 다시 안 봤다고 말한다(0 이 «다 고쳤다»로 읽히지 않게).
     ⚠ 판정을 못 했으면 숫자를 쓰지 않는다 — 못 한 것을 0 이라고 하면 «다 고쳤다»로 읽힌다. */
  function judgeLine(st) {
    if (st.judgeFail || !st.warns) return '검토 기준으로 다시 판정 못 함';
    return '검토 기준으로 다시 판정: 위반 의심 ' + (Number(st.before) || 0) + ' → ' + st.warns.length
      + (st.unjudged ? ' · 누락·수동확인은 다시 판정하지 않음' : '');
  }
  function readyHtml(st) {
    var got = st.got || {};
    var segs = FC().wordDiff(String(st.cur || ''), String(got.text || '')) || [];
    var body = segs.map(function (s) {
      return s.t === '+' ? '<ins>' + h(s.s) + '</ins>' : s.t === '-' ? '<del>' + h(s.s) + '</del>' : h(s.s);
    }).join('');
    var warn1 = '⚠ AI 가 쓴 글입니다 — 법 조항 번호·일수는 꼭 확인하세요';
    var out = head(line('pol-hm', P().MODES[st.mode] || ''), '✨ AI 가 고친 판')
      + '<div class="pol-body">' + body + '</div>';
    if (got.why) out += line('pol-why', '바꾼 까닭(AI): ' + got.why);
    out += '<div class="pol-warn" title="' + esc(warn1) + '">' + esc(warn1) + '</div>';
    out += line('pol-why', judgeLine(st));
    if (got.maskLeft) {
      var w2 = '⚠ 가린 자리가 남아 있습니다 — 넣은 뒤 손으로 채우세요';
      out += '<div class="pol-warn" title="' + esc(w2) + '">' + esc(w2) + '</div>';
    }
    out += '<div class="pol-foot"><button class="stbtn pol-use" data-pol="use">이 판으로 바꾸기</button>'
      + '<button class="stbtn" data-pol="drop">버리기</button>'
      + '<button class="stbtn" data-pol="menu">다시</button></div>';
    return out;
  }

  function boxHtml(st) {
    st = st || {};
    if (st.state === 'sending') return head() + '<div class="pol-msg">AI 가 고치는 중…</div>';
    if (st.state === 'error') {
      return head() + '<div class="pol-msg">' + line('pol-err', st.err || '알 수 없는 오류') + '</div>'
        + '<div class="pol-foot"><button class="stbtn" data-pol="drop">닫기</button></div>';
    }
    if (st.state === 'ready') return readyHtml(st);
    if (st.state === 'menu') return menuHtml(st);
    return '';
  }

  var api = { boxHtml: boxHtml };
  if (root) root.PuRulesPolishView = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
