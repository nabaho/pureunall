/* 취업규칙 ✏️ 검토·개정 — 「💬 이 문서에 묻기」 그리기 (설계 §13 · 2026-10-30 목업 세 물음 「추천대로」)

   오른쪽 칸의 «💬 묻기» 탭 안 — 묻는 범위 한 줄과, 묻고 답한 목록(최근 것이 위).
   여기서는 «글»을 만들기만 한다(DOM 을 만지지 않는다 — 검사가 그린 글을 본다). 부르기·옮겨 가기는 rules.html.

   한 줄 e = { state:'sending'|'ready'|'error'|'nolocal', q(질문), sent([조 이름] — AI 가 읽은 조), titles({조 이름: 제목}),
               answer, cites([{label, where}]), none, dropped(보내지 않은 조를 근거로 들어 뺀 수),
               review({state:'before'|'ok'|'warn', counts, n}), err, msg }

   ★ 지키는 것
     · 글은 모두 esc — AI 가 쓴 글·질문의 꺾쇠가 태그가 되면 안 된다.
     · 근거 조 단추는 data-ask-go(조 이름) — 누르면 왼쪽 원본 미리보기의 그 조로 간다.
     · 근거가 없으면 «없다»고, 근거를 못 믿으면 «못 믿는다»고 적는다 — 빈칸으로 두면 «근거 있음»으로 읽힌다.
     · 한 줄 칸(범위·⚠ 줄·칩)은 넘치면 … 이고 title 에 전문. */
(function (root) {
  'use strict';

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function h(s) { return esc(s).replace(/\n/g, '<br>'); }
  /* 한 줄 칸 — 넘치면 … (CSS), 전문은 title */
  function line(cls, text) { return '<span class="' + cls + '" title="' + esc(text) + '">' + esc(text) + '</span>'; }

  var NOTE = '⚠ AI 가 쓴 답 — 일수·조 번호는 원문으로 확인 · 효력 판단은 담당 노무사';
  var EMPTY = '이 규칙에 물어보세요 — 답에는 근거 조와 같은 조의 자동 검토 판정이 함께 붙습니다.';

  function scopeHtml(o) {
    o = o || {};
    var site = String(o.site || '').trim();
    var txt = '📄 이 문서(원본)' + (site ? ' · ' + site : '') + ' · ' + (Number(o.n) || 0) + '개 조';
    return '<span class="ask-lbl">묻는 범위</span>' + line('ask-scope-chip', txt);
  }

  function citeText(c, titles) {
    var t = titles && titles[c.label] ? '【' + titles[c.label] + '】' : '';
    return c.label + t + (c.where ? ' ' + c.where : '');
  }
  function goBtn(label, text, cls) {
    return '<button type="button" class="' + cls + '" data-ask-go="' + esc(label) + '" title="왼쪽 원본에서 ' + esc(label) + '을(를) 봅니다">'
      + esc(text) + '</button>';
  }

  function reviewHtml(rv) {
    rv = rv || { state: 'before' };
    if (rv.state === 'ok') return '<span class="ask-rv ok">✓ 지적 없음</span>';
    if (rv.state === 'warn') {
      var c = rv.counts || {};
      var parts = ['위반의심', '누락', '수동확인'].filter(function (k) { return c[k]; }).map(function (k) { return k + ' ' + c[k]; });
      var t = '⚠ ' + parts.join(' · ') + ' — 자동 검토 결과 보기 ›';
      return '<button type="button" class="ask-rv warn" data-ask-review="1" title="' + esc(t) + '">' + esc(t) + '</button>';
    }
    return '<span class="ask-rv none" title="「취업규칙 검토」를 누르면 같은 조의 판정이 함께 보입니다">검토 전</span>';
  }

  function readyHtml(e) {
    var cites = e.cites || [], titles = e.titles || {};
    var out = '<div class="ask-a">' + h(e.answer) + '</div>';
    var basis = cites.length
      ? cites.map(function (c) { return goBtn(c.label, citeText(c, titles) + ' ↗', 'ask-cite'); }).join('')
      : '<span class="ask-rv none">없음</span>';
    out += '<div class="ask-row"><span class="ask-lbl">근거</span>' + basis + '</div>';
    if (e.dropped) out += '<div class="ask-row">' + line('ask-warn', '⚠ 문서에 없는 조를 근거로 들어 ' + e.dropped + '개를 뺐습니다') + '</div>';
    if (!e.none && !cites.length) out += '<div class="ask-row">' + line('ask-warn', '⚠ 근거 조를 확인하지 못했습니다 — 답을 그대로 믿지 마세요') + '</div>';
    if (cites.length) out += '<div class="ask-row"><span class="ask-lbl">같은 조 검토</span>' + reviewHtml(e.review) + '</div>';
    return out;
  }

  function sentHtml(e) {
    var sent = e.sent || [], titles = e.titles || {};
    if (!sent.length) return '';
    return '<details class="ask-sent"><summary>AI 가 읽은 조 ' + sent.length + '개</summary><div class="ask-sent-list">'
      + sent.map(function (l) { return goBtn(l, l + (titles[l] ? '【' + titles[l] + '】' : ''), 'ask-cite off'); }).join('')
      + '</div></details>';
  }

  function itemHtml(e) {
    e = e || {};
    var body;
    if (e.state === 'sending') body = line('ask-wait', 'AI 가 관련 조 ' + (e.sent || []).length + '개를 읽는 중…');
    else if (e.state === 'error') body = '<div class="ask-err">' + h(e.err || 'AI 에게 묻지 못했습니다') + '</div>';
    else if (e.state === 'nolocal') body = '<div class="ask-a">' + h(e.msg) + '</div>';
    else body = readyHtml(e);
    var foot = '';
    if (e.state === 'ready') foot = '<div class="ask-foot">' + sentHtml(e) + line('ask-note', NOTE) + '</div>';
    else if (e.state === 'sending') foot = '<div class="ask-foot">' + sentHtml(e) + '</div>';
    return '<div class="ask-qa"><div class="ask-q">' + h(e.q) + '</div>' + body + foot + '</div>';
  }

  function listHtml(list) {
    if (!list || !list.length) return '<div class="ask-empty">' + esc(EMPTY) + '</div>';
    return list.map(itemHtml).join('');
  }

  var api = { scopeHtml: scopeHtml, itemHtml: itemHtml, listHtml: listHtml, reviewHtml: reviewHtml, NOTE: NOTE };
  if (root) root.PuRulesAskView = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
