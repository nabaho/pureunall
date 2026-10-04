/* 취업규칙 ✏️ 조문 편집 — 「💡 우리 문안」 상자 그리기 (설계 §8-2·§8-3 · 2026-10-04 목업 세 물음 「추천대로」)

   조문 편집 카드(#art-edit) 아래에, 모은 자료에서 «같은 조 주제»로 우리 사무소가 쓴 문안을
   많아야 셋(가장 최근 · 비슷한 회사 · 가장 많이 씀) 보이고, 「이 문안 넣기」로 「변경 후」 칸에 넣는다.
   고르기는 lib-recommend.js, 덩어리는 view-topics model(📚 와 같은 부품), 견주기는 pu-rules-filecmp.js —
   여기서는 «글»을 만들기만 한다(DOM 을 만지지 않는다 — 검사가 그린 글을 본다).

   st = { state:'idle'|'loading'|'ready'|'error'|'notitle', done, total, err,
          picks(lib-recommend pick 결과), curBody(지금 글 — 머리 뗀 것), curCoName,
          warns:{[g.key]:[finding]}, open:{[g.key]:true},
          docs(모은 자료 규칙 본문 수), places(이 주제 곳 수), band, bizType, terms:{회사, 근로자},
          headStrip(조 머리 떼는 정규식 — rules.html 의 RE_HEAD_STRIP. 괄호 【】（）「」 … 모두) }

   ★ 보이는 글 = 넣을 글 (2026-10-04 최종 검토)
     덩어리의 «맞춘 글»(g.text — 띄어쓰기를 한 칸으로 접고 {회사}·{근로자} 자리표시를 넣은 비교용 글)이 아니라
     대표 문서(p.rep)의 «진짜 본문»(줄바꿈 그대로)에서 만든다 — wording(p, st):
       ① 조 머리를 뗀다(rules.html 의 넓은 괄호 머리 정규식)
       ② 그 회사 이름(lib-topics coCore — 같은 글 판정과 같은 잣대)을 이 회사 이름으로, 뒤 조사는 받침에 맞게
       ③ 그 글의 호칭(사원·직원·근로자·종업원)을 이 문서의 호칭으로 — «홀로 선» 것만, 뒤 조사는 받침에 맞게
     몸(bodyHtml)과 넣기(rules.html recClick → insertText)가 «같은» wording 을 쓴다.

   ★ 지키는 것
     · 글은 모두 esc — 회사 이름·문안·오류 글의 꺾쇠가 태그가 되면 안 된다.
     · 초록(<ins>)은 «지금 글에 없는 곳»만. 지금 글에만 있는 곳('-')은 그리지 않는다(넣으면 사라질 곳이라 헷갈린다).
     · 한 줄 칸(머리 줄·흐린 줄·⚠ 줄·회사 줄·알림 줄·끝 줄)은 넘치면 … 이고 title 에 전문.
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
  function coName(m) { return m.companyId ? (m.companyName || '(지운 업체)') : '(미확정)'; }

  /* ── 이름·호칭 바꾸기 ── */
  function isHan(ch) { return /[가-힣]/.test(ch || ''); }
  function lastCode(w) { var c = String(w || '').slice(-1).charCodeAt(0); return c >= 0xAC00 && c <= 0xD7A3 ? (c - 0xAC00) % 28 : -1; }
  function hasBatchim(w) { return lastCode(w) > 0; }
  /* 「으로/로」 — 받침이 있고 그것이 ㄹ 이 아닐 때만 「으로」 */
  function batchimNotL(w) { var b = lastCode(w); return b > 0 && b !== 8; }
  // 받침 따라 갈리는 조사 — [받침 있을 때, 없을 때]
  var JOSA_PAIRS = [['으로서', '로서'], ['으로써', '로써'], ['으로', '로'], ['이란', '란'], ['이라', '라'], ['이나', '나'],
    ['이며', '며'], ['이고', '고'], ['이다', '다'], ['이', '가'], ['은', '는'], ['을', '를'], ['과', '와']];
  // 받침과 상관없는 조사·꼬리 — 그대로 둔다
  var JOSA_SAME = ['에게서', '에게', '에서', '에', '의', '도', '만', '까지', '부터', '마다', '들', '께', '한테', '보다', '처럼', '만큼', '인', '임'];
  function longFirst(a, b) { return (b.f || b).length - (a.f || a).length; }
  var PAIR_FORMS = [].concat.apply([], JOSA_PAIRS.map(function (p) {
    return p.map(function (f) { return { f: f, p: p }; });
  })).sort(longFirst);
  var ALL_FORMS = JOSA_SAME.concat(PAIR_FORMS.map(function (x) { return x.f; })).sort(longFirst);
  /* 조사 사슬(「으로서의」「들에게」)이 끝나면 한글이 아닌 것(띄어쓰기·문장부호·끝)이 와야 한다 —
     아니면 조사가 아니라 낱말의 일부다(사원증·근로자대표·가족). fillWord 의 (?![가-힣]) 와 같은 결 */
  function chainOk(s, depth) {
    if (!s || !isHan(s.charAt(0))) return true;
    if (depth >= 3) return false;
    return ALL_FORMS.some(function (f) { return s.indexOf(f) === 0 && chainOk(s.slice(f.length), depth + 1); });
  }
  /* 낱말 뒤 → { n:바꿀 조사 길이, p:조사 쌍 } · { n:0 }(바꿀 조사 없음) · null(뒤에 한글 낱말이 붙음) */
  function josaAfter(after) {
    if (!after || !isHan(after.charAt(0))) return { n: 0 };
    for (var i = 0; i < PAIR_FORMS.length; i++) {
      var x = PAIR_FORMS[i];
      if (after.indexOf(x.f) === 0 && chainOk(after.slice(x.f.length), 1)) return { n: x.f.length, p: x.p };
    }
    return chainOk(after, 0) ? { n: 0 } : null;
  }
  function josaFor(word, p) {
    var b = p[0].charAt(0) === '으' ? batchimNotL(word) : hasBatchim(word);
    return p[b ? 0 : 1];
  }
  /* re(전역) 에 걸린 곳을 to 로 — ok(앞 글자, 뒤 글, 조사) 가 참일 때만. 뒤 조사는 to 의 받침에 맞춘다 */
  function swapAt(text, re, to, ok) {
    var out = '', i = 0, m;
    re.lastIndex = 0;
    while ((m = re.exec(text))) {
      if (!m[0].length) { re.lastIndex++; continue; }
      var k = m.index, end = k + m[0].length, after = text.slice(end), j = josaAfter(after);
      if (!ok(text.charAt(k - 1), after, j)) continue;
      out += text.slice(i, k) + to + (j && j.p ? josaFor(to, j.p) : '');
      i = end + (j && j.p ? j.n : 0);
      re.lastIndex = i;
    }
    return out + text.slice(i);
  }
  function reEsc(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  // 호칭 — detectTerms 와 같은 낱말에 «종업원»을 더한다
  var TERMS = ['사원', '직원', '근로자', '종업원'];
  // 법이 쓰는 말이라 호칭을 바꾸면 안 되는 묶음 — 「근로자의 날」을 「사원의 날」로 만들면 안 된다
  var KEEP = { 근로자: ['대표', ' 대표', '퇴직급여', '의 날', '의날', '명부', '참여', '위원'] };
  /* «홀로 선» 호칭: 앞이 한글이 아니고(임직원·신입사원·기간제근로자 아님), 뒤가 조사·띄어쓰기·문장부호·끝 */
  function standalone(word) {
    var keep = KEEP[word] || [];
    return function (prev, after, j) {
      return !isHan(prev) && j !== null && !keep.some(function (w) { return after.indexOf(w) === 0; });
    };
  }
  function countTerm(text, word) {
    var n = 0, ok = standalone(word);
    swapAt(text, new RegExp(reEsc(word), 'g'), word, function (prev, after, j) { if (ok(prev, after, j)) n++; return false; });
    return n;
  }
  /* 그 글의 호칭 — 홀로 선 것이 가장 많은 것(같으면 앞 차례). 하나도 없으면 '' */
  function termOf(text) {
    var best = '', n = 0;
    TERMS.forEach(function (w) { var c = countTerm(text, w); if (c > n) { n = c; best = w; } });
    return best;
  }
  function swapTerm(text, from, to) {
    if (!from || !to || from === to) return text;
    return swapAt(text, new RegExp(reEsc(from), 'g'), to, standalone(from));
  }
  /* 회사 이름 — (주)·㈜·주식회사 꼬리표째 이 회사 이름으로. 낱말 경계는 따지지 않는다(normText 와 같은 결) */
  var CO_TAG = '(?:\\(\\s*[주유]\\s*\\)|[㈜㈲]|주식회사|유한회사)';
  function swapCo(text, core, to) {
    var re = new RegExp('(?:' + CO_TAG + '\\s*)?' + reEsc(core) + '(?:\\s*' + CO_TAG + ')?', 'g');
    return swapAt(text, re, to, function () { return true; });
  }

  /* 넣을(=보일) 글 — 대표 문서의 진짜 본문에서. 맨 위 머리 주석 ①②③ */
  function wording(p, st) {
    st = st || {};
    var g = (p && p.group) || {}, rep = (p && p.rep) || (g.members || [])[0] || {}, tm = st.terms || {};
    var t = String(rep.body || '').replace(/\r\n?/g, '\n');
    if (st.headStrip) t = t.replace(st.headStrip, '');
    t = t.replace(/^\s+|\s+$/g, '');
    var co = T().coCore(rep.companyName);
    if (co.length >= 2 && tm.회사) t = swapCo(t, co, tm.회사);
    return swapTerm(t, termOf(t), tm.근로자);
  }

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

  /* 몸 — 넣을 글(wording)을 지금 글에 견줘, 지금 글에 없는 곳을 초록으로. 지금 글에만 있는 곳은 그리지 않는다.
     wordDiff 의 '='·'+' 를 이으면 넣을 글 그대로다 — 보이는 글 = 넣을 글. 줄바꿈은 <br> 로 지킨다. */
  function bodyHtml(p, st) {
    function h(s) { return esc(s).replace(/\n/g, '<br>'); }
    return (FC().wordDiff(String(st.curBody || ''), wording(p, st)) || []).map(function (s) {
      return s.t === '+' ? '<ins>' + h(s.s) + '</ins>' : s.t === '=' ? h(s.s) : '';
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
      + '<div class="rec-ob">' + bodyHtml(p, st) + '</div>'
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
    // 이 회사의 규모·업태를 모르면 «비슷한 회사» 칸은 비어 있다 — 왜 비었는지 한 줄(설계 §8-2)
    var note = st.band && st.bizType ? '' : line('rec-note', '규모·업태를 몰라 비슷한 회사를 못 찾습니다');
    var tm = st.terms || {}, both = [tm.회사, tm.근로자].filter(Boolean).join('·');
    // 몸은 이미 이 회사 말로 바꿔 보인다 — 자리표시({회사}·{근로자})를 화면에 내놓지 않는다
    var foot = '초록 = 지금 글에 없는 곳. 회사 이름·호칭은 이 회사 것' + (both ? '(' + both + ')' : '') + '으로 바꿔 보이며, 보이는 그대로 넣습니다.';
    return head + picks.map(function (p, i) { return cardHtml(p, st, i); }).join('') + note + line('rec-foot', foot);
  }

  /* 넣을 글 — text(wording 결과, 머리 없음) 앞에 조 머리를 붙인다.
     머리는 지금 「변경 후」 글의 것(hd.headOf — rules.html 의 artHeadOf: 넓은 괄호 머리), 없으면 연 조의 머리(hd.own).
     ⚠ 머리 찾기는 rules.html 에 «한 벌»만 둔다 — 문안 은행(bankUse)도 같은 artHeadOf·aeOwnHead 를 쓴다. */
  function insertText(curAfter, text, hd) {
    hd = hd || {};
    var head = (typeof hd.headOf === 'function' ? hd.headOf(curAfter) : '') || hd.own || '';
    return (head ? head + ' ' : '') + String(text || '');
  }

  var api = { boxHtml: boxHtml, insertText: insertText, wording: wording, swapTerm: swapTerm, termOf: termOf };
  if (root) root.PuRulesV2RecommendView = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
