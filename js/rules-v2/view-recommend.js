/* 취업규칙 ✏️ 조문 편집 — 「💡 우리 문안」 상자 그리기 (설계 §8-2 · 2026-10-04 목업 세 물음 「추천대로」)

   조문 편집 카드(#art-edit) 아래에, 모은 자료에서 «같은 조 주제»로 우리 사무소가 쓴 문안을
   많아야 셋(가장 최근 · 비슷한 회사 · 가장 많이 씀) 보이고, 「이 문안 넣기」로 「변경 후」 칸에 넣는다.
   고르기는 lib-recommend.js, 덩어리는 view-topics model(📚 와 같은 부품), 견주기는 pu-rules-filecmp.js —
   여기서는 «글»을 만들기만 한다(DOM 을 만지지 않는다 — 검사가 그린 글을 본다).

   st = { state:'idle'|'loading'|'ready'|'error'|'notitle', done, total, err,
          picks(lib-recommend pick 결과), curBody(지금 글 — 머리 뗀 것), curCoName,
          warns:{[g.key]:[finding]}, open:{[g.key]:true},
          docs(모은 자료 규칙 본문 수), places(이 주제 곳 수), band, bizType, terms:{회사, 근로자},
          fill(넣기와 같은 채우개 — rules.html 의 fillTpl. 없으면 자리표시 그대로) }

   ★ 지키는 것
     · 글은 모두 esc — 회사 이름·문안·오류 글의 꺾쇠가 태그가 되면 안 된다.
     · 초록(<ins>)은 «지금 글에 없는 곳»만. 지금 글에만 있는 곳('-')은 그리지 않는다(넣으면 사라질 곳이라 헷갈린다).
     · 한 줄 칸(머리 줄·흐린 줄·⚠ 줄·회사 줄·끝 줄)은 넘치면 … 이고 title 에 전문.
     · 넣기는 «변경 후» 칸까지 — 저장·반영은 사람이 「신구대조표에 반영」을 눌러야 한다. */
(function (root) {
  'use strict';

  /* 화면에서는 전역에서, node 검사에서는 require 로 — 부품이 두 벌이면 판정이 갈린다 */
  function lib(name, rel) {
    if (root && root[name]) return root[name];
    if (typeof require === 'function') { try { return require(rel); } catch (e) { /* 화면에서는 위에서 찾는다 */ } }
    return null;
  }
  function T() { return lib('PuRulesV2Topics', './lib-topics.js'); }
  function R() { return lib('PuRulesV2Recommend', './lib-recommend.js'); }
  function FC() { return lib('PuRulesFileCmp', '../pu-rules-filecmp.js'); }

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  /* 한국 시간 연월 — 메일 날짜(ms). view-topics 의 ym 과 같은 셈 */
  function ym(ms) {
    var n = Number(ms || 0);
    if (!n) return '날짜 모름';
    return new Date(n + 9 * 3600e3).toISOString().slice(0, 7);
  }
  /* 한 줄 칸 — 넘치면 … (CSS), 전문은 title */
  function line(cls, text) { return '<span class="' + cls + '" title="' + esc(text) + '">' + esc(text) + '</span>'; }
  /* 「으로/로」 — 받침이 있고 그것이 ㄹ 이 아닐 때만 「으로」 */
  function batchimNotL(w) {
    var c = String(w || '').slice(-1).charCodeAt(0);
    if (!(c >= 0xAC00 && c <= 0xD7A3)) return false;
    var b = (c - 0xAC00) % 28;
    return b !== 0 && b !== 8;
  }
  function coName(m) { return m.companyId ? (m.companyName || '(지운 업체)') : '(미확정)'; }

  /* 갈래마다 흐린 한 줄 */
  function metaText(p, st) {
    var g = p.group, star = g.finals ? ' · ★' + g.finals : '';
    if (p.why === 'recent') {
      var r = p.rep || g.members[0] || {};
      return coName(r) + (r.final ? ' · ★최종본' : '') + ' · ' + ym(r.date);
    }
    if (p.why === 'similar') {
      var sim = p.similar || [], first = sim[0] ? sim[0].companyName : '';
      return (st.band || '') + ' · ' + (st.bizType || '') + ' ' + sim.length + '곳'
        + (first ? ' (' + first + (sim.length > 1 ? ' 외' : '') + ')' : '') + star;
    }
    return (g.places || 0) + '곳' + star + ' · 최근 ' + ym(g.last);
  }

  /* 몸 — 지금 글에 견줘 덩어리에만 있는 곳을 초록으로. 지금 글에만 있는 곳은 그리지 않는다.
     ★ 보이는 글은 «넣을 때 들어갈 글» 그대로 — {회사}·{근로자}를 넣기와 같은 채우개(st.fill)·같은 말(st.terms)로 채운다.
       두 글을 «통째로» 채운 뒤 견준다: 조각마다 채우면 자리표시와 조사(가/이)가 조각 경계에서 갈려 조사가 틀린다.
       두 글이 같은 말로 채워지므로 같은 곳은 같게, 다른 곳만 다르게 남는다. */
  function bodyHtml(g, st) {
    var fill = typeof st.fill === 'function' ? function (s) { return st.fill(s, st.terms || {}); } : function (s) { return s; };
    var cur = fill(T().normText(st.curBody || '', st.curCoName || ''));
    return (FC().wordDiff(cur, fill(g.text)) || []).map(function (s) {
      return s.t === '+' ? '<ins>' + esc(s.s) + '</ins>' : s.t === '=' ? esc(s.s) : '';
    }).join('');
  }
  function warnHtml(ws) {
    if (!ws || !ws.length) return '';
    var first = ws[0].rule || {};
    var all = ws.map(function (f) { var r = f.rule || {}; return r.id + ' ' + r.name + (f.note ? ' — ' + f.note : ''); }).join(' / ');
    return '<div class="rec-warn" title="' + esc('⚠ 검토 기준: ' + all) + '">' + esc('⚠ 검토 기준: ' + (first.name || '') + (ws.length > 1 ? ' 외 ' + (ws.length - 1) : '')) + '</div>';
  }
  function whoHtml(g) {
    return '<div class="rec-who">' + g.members.map(function (m) {
      var t = (m.final ? '★ ' : '') + coName(m) + ' · ' + ym(m.date) + (m.final ? ' · ★최종본' : '');
      return '<div class="rec-who-r" title="' + esc(t) + '">' + esc(t) + '</div>';
    }).join('') + '</div>';
  }
  /* 단추는 picks 의 «몇째»(data-i)로 — 덩어리 열쇠는 자리표시가 든 긴 글이라 화면에 싣지 않는다 */
  function cardHtml(p, st, i) {
    var g = p.group, on = !!(st.open && st.open[g.key]);
    return '<div class="rec-opt" data-rec-card>'
      + '<div class="rec-oh"><span class="rec-tag ' + esc(p.why) + '">' + esc(R().LABELS[p.why] || p.why) + '</span>'
      + line('rec-meta', metaText(p, st)) + '</div>'
      + '<div class="rec-ob">' + bodyHtml(g, st) + '</div>'
      + warnHtml(st.warns && st.warns[g.key])
      + '<div class="rec-of"><button class="stbtn rec-put" data-rec="put" data-i="' + i + '" title="「변경 후」 칸에 넣습니다 — 조 머리는 지금 것을 지킵니다">이 문안 넣기</button>'
      + '<button class="stbtn" data-rec="who" data-i="' + i + '">쓴 회사 ' + (g.places || 0) + '곳 ' + (on ? '▾' : '▸') + '</button></div>'
      + (on ? whoHtml(g) : '')
      + '</div>';
  }

  function boxHtml(st) {
    st = st || {};
    if (!st.state || st.state === 'idle') return '';
    var meta = st.state === 'ready' ? '모은 자료 규칙 본문 ' + (st.docs || 0) + '건 · 이 주제 ' + (st.places || 0) + '곳' : '';
    var head = '<div class="rec-h"><b>💡 우리 문안</b>' + (meta ? line('rec-hm', meta) : '') + '</div>';
    function msg(t) { return head + '<div class="rec-msg">' + esc(t) + '</div>'; }
    if (st.state === 'loading') return msg(st.total ? '모은 자료 읽는 중 ' + (st.done || 0) + '/' + st.total : '모은 자료 읽는 중…');
    if (st.state === 'error') return msg('우리 문안을 못 읽었습니다 — ' + (st.err || '알 수 없는 오류'));
    if (st.state === 'notitle') return msg('이 조는 제목이 없어 주제로 찾을 수 없습니다');
    var picks = st.picks || [];
    if (!picks.length) return msg('이 주제로 모은 다른 문안이 없습니다');
    var tm = st.terms || {}, w = tm.근로자 || '';
    var foot;
    if (typeof st.fill === 'function') {
      // 몸은 이미 채워 보인다 — 자리표시({회사}·{근로자})를 화면에 내놓지 않는다
      var both = [tm.회사, w].filter(Boolean).join('·');
      foot = '초록 = 지금 글에 없는 곳. 회사 이름·호칭은 이 회사 것' + (both ? '(' + both + ')' : '') + '으로 채워 보이며, 보이는 그대로 넣습니다.';
    } else {
      var who = w ? '(' + w + ')' + (batchimNotL(w) ? '으로' : '로') : '으로';   // 호칭(사원)으로 · 호칭(근로자)로
      foot = '초록 = 지금 글에 없는 곳. 넣을 때 {회사}·{근로자}는 이 회사 이름·호칭' + who + ' 바뀝니다.';
    }
    return head + picks.map(function (p, i) { return cardHtml(p, st, i); }).join('') + line('rec-foot', foot);
  }

  /* 넣을 글 — 머리(제N조(…))는 지금 「변경 후」의 것을 지키고, 본문은 덩어리 글을 채워서.
     ⚠ 머리 정규식은 rules.html 의 bankUse(문안 은행 넣기)와 같은 것이다 — 두 벌이 되면 함께 고친다
       (tests/rules-recommend-view.test.js 가 같은지 본다). */
  var HEAD = /^(제\s*\d+\s*조(의\s*\d+)?\s*[\((][^\))]*[\))])/;
  var HEAD_STRIP = /^제\s*\d+\s*조(의\s*\d+)?\s*[\((][^\))]*[\))]\s*/;
  function insertText(curAfter, groupText, terms, fill) {
    var m = String(curAfter || '').match(HEAD), head = m ? m[1] : '';
    var body = String(groupText || '').replace(HEAD_STRIP, '');
    if (typeof fill === 'function') body = fill(body, terms || {});
    return (head ? head + ' ' : '') + body;
  }

  var api = { boxHtml: boxHtml, insertText: insertText };
  if (root) root.PuRulesV2RecommendView = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
