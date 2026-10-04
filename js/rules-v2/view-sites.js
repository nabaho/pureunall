/* 취업규칙(새) — 「🏢 사업장」 그리기 (설계 §7-2 · 2026-10-04 목업 「추천대로」)

   그리는 것만 한다 — 셈은 lib-sites.js(PuRulesV2Sites)·lib-order.js, 읽기·저장은 rules-v2.html 의 손잡이(H).
   그림(DOM)이 아니라 «글»을 돌려주는 함수로 나눴다 — 검사가 그린 글을 그대로 본다(📥 view-library 와 같은 꼴).

   ★ 지키는 것
     · 왼쪽 표의 칸은 한 줄 — 넘치면 … 이고 title 에 전문(CSS 는 rules-v2.html 의 .sites td).
     · 「✓ 이 회사 자료 맞음」은 후보가 있는 줄에만 — 단추는 업체 id 를 든다(이름으로 잇지 않는다).
     · 「✏️ 이 사업장 개정 시작」은 판이 있을 때만 — 최종본이 없으면 «가장 최근 판»으로 열고 그렇다고 알린다.
       판이 하나도 없으면 「📄 파일 올려 개정 시작」(사업장이 미리 골라진 채로).
     · 가린 글은 여기서 안 읽는다 — 서류 줄의 「📥 에서 보기」가 모은 자료 갈래의 오른쪽 칸을 연다. */
(function (root) {
  'use strict';

  function Sx() { return root.PuRulesV2Sites; }
  function O() { return root.PuRulesV2Order; }
  function Lib() { return root.PuRulesV2Lib; }
  function esc(v) { return Lib().esc(v); }
  function ymd(ms) { return Lib().ymd(ms); }
  /* M/D — 회차 흐름·서류 줄의 짧은 날짜 */
  function md(ms) { var s = ymd(ms); return s.length === 10 ? (+s.slice(5, 7)) + '/' + (+s.slice(8, 10)) : s; }
  /* 「2026.09 회차」 — 사람이 붙인 이름(r + 6자리가 아닌 것)은 그대로. 날짜 모르는 묶음은 그렇다고 */
  function roundLabel(rk) {
    rk = String(rk || '');
    if (rk === 'r000000') return '날짜 모름';
    var m = /^r(\d{4})(\d{2})$/.exec(rk);
    return m ? m[1] + '.' + m[2] + ' 회차' : rk;
  }
  function verLabel(no) { return no ? no + '판' : '현행'; }
  function td(cls, title, html) {
    return '<td' + (cls ? ' class="' + cls + '"' : '') + ' title="' + esc(title) + '">' + html + '</td>';
  }
  function linkBtn(row) {
    return '<button class="btn sm g" data-act="siteLink" data-co="' + esc(row.id) + '" title="'
      + esc('후보 ' + row.cand + '건(메일 ' + row.candMails + '통)을 이 사업장 자료로 확정합니다') + '">✓ 이 회사 자료 맞음</button>';
  }

  /* ── 위 거르개 줄 ── */
  function filterHtml(st, c) {
    var s = st.sites || {}, f = s.f || 'has';
    c = c || { has: 0, wait: 0, all: 0 };
    function chip(v, label, extra) {
      return '<button class="chip' + (extra ? ' ' + extra : '') + (f === v ? ' on' : '') + '" data-act="siteF" data-f="' + v + '">'
        + esc(label) + '<b>' + (c[v] || 0) + '</b></button>';
    }
    return '<div class="flt">'
      + chip('has', '취업규칙 자료 있는 곳') + chip('wait', '확정 기다림', 'warn') + chip('all', '모든 거래처')
      + '<input class="q" data-role="sq" placeholder="🔍 회사 이름 · 사업자번호" value="' + esc(s.q || '') + '">'
      + '<button class="btn" data-act="reload">새로고침</button>'
      + '</div>';
  }

  /* ── 왼쪽 표 ── (rows 는 이미 거른 것) */
  function listHtml(st, rows) {
    var sel = (st.sites || {}).sel || '';
    var body = (rows || []).map(function (r, i) {
      var size = r.size > 0 ? r.size + '명' + (r.band ? ' · ' + r.band : '') : '';
      var doc = [], docT = [];
      if (r.linked) { doc.push('<span class="k ok">확정 ' + r.linked + '</span>'); docT.push('확정 ' + r.linked); }
      if (r.cand) { doc.push('<span class="k cand">후보 ' + r.cand + '</span>'); docT.push('후보 ' + r.cand + '(메일 ' + r.candMails + '통)'); }
      if (r.cand) doc.push(linkBtn(r));
      if (!doc.length) doc.push('<span class="k none">자료 없음</span>');
      var last = r.last ? ymd(r.last).slice(0, 7) : '—';
      var fin = r.fin && r.fin.state === 'set'
        ? td('', '★최종본 ' + (r.fin.at ? ymd(r.fin.at) : ''), '<span class="fin">★' + (r.fin.at ? ' ' + esc(ymd(r.fin.at).slice(2, 7)) : '') + '</span>')
        : r.fin && r.fin.state === 'none' ? td('', '최종본을 아직 안 정했습니다', '<span class="k none">미정</span>')
          : td('', '확정된 자료가 없습니다', '<span class="k none">—</span>');
      return '<tr data-act="siteSel" data-co="' + esc(r.id) + '"' + (sel === r.id ? ' class="sel"' : '') + '>'
        + td('no', String(i + 1), String(i + 1))
        + td('', r.name + (r.closed ? ' (폐업)' : ''), '<b>' + esc(r.name) + '</b>' + (r.closed ? ' <span class="k none">폐업</span>' : ''))
        + td('', size || '인원 모름', size ? esc(size) : '<span class="k none">—</span>')
        + td('', r.bizType || '업태 모름', r.bizType ? esc(r.bizType) : '<span class="k none">—</span>')
        + td('', docT.join(' · ') || '자료 없음', doc.join(' '))
        + td('', r.last ? '최근 메일 ' + ymd(r.last) : '자료 없음', esc(last))
        + fin
        + '</tr>';
    }).join('');
    if (!body) body = '<tr><td colspan="7" class="empty" title="">맞는 사업장이 없습니다 — 「모든 거래처」에서 찾아보세요</td></tr>';
    return '<table class="sites"><colgroup><col style="width:44px"><col><col style="width:120px"><col style="width:96px"><col style="width:250px"><col style="width:80px"><col style="width:80px"></colgroup>'
      + '<thead><tr><th class="c">#</th><th>사업장</th><th>규모</th><th>업태</th><th>취업규칙 자료</th><th>최근</th><th>★최종본</th></tr></thead>'
      + '<tbody>' + body + '</tbody></table>';
  }

  /* ── 오른쪽 — 고른 사업장의 이력 ── */
  function startHtml(st, row) {
    var sd = Sx().startDoc(row);
    if (!sd) {
      return '<div class="start"><button class="btn" data-act="siteUpload" data-co="' + esc(row.id) + '">📄 파일 올려 개정 시작</button>'
        + '<small>검토·개정에 이 사업장이 미리 골라진 채로 열립니다.</small></div>';
    }
    var doc = ((st.data || {}).docs || {})[sd.docId] || {};
    var name = doc.name || sd.docId;
    var note = sd.notFinal
      ? '⚠ 최종본이 아직 없습니다 — 가장 최근 판(' + esc(verLabel(sd.no)) + ' 「' + esc(name) + '」)으로 엽니다.'
      : '★최종본 「' + esc(name) + '」(' + esc(ymd((doc.mail || {}).date)) + ' 메일)의 원본을 메일에서 받아 검토·개정에 엽니다 — 받은 파일이 그 문서와 같은지 지문으로 확인합니다.';
    return '<div class="start"><button class="btn p" data-act="siteStart" data-id="' + esc(sd.docId) + '" data-nf="' + (sd.notFinal ? '1' : '') + '">✏️ 이 사업장 개정 시작</button>'
      + '<small' + (sd.notFinal ? ' class="warn"' : '') + '>' + note + '</small></div>';
  }
  function roundHtml(g) {
    var mails = {}; g.items.forEach(function (it) { mails[O().mailKey(it)] = 1; });
    var flow = g.rows.map(function (v) {
      var f = g.finalDocId === v.item.id, t = verLabel(v.no) + ' ' + md(v.item.date);
      return '<i' + (f ? ' class="f"' : '') + ' title="' + esc(v.item.name) + '">' + (f ? '★' : '') + esc(t) + '</i>';
    });
    var rep = g.items.filter(function (it) { return it.kind === '신고서'; })[0];
    if (rep) flow.push('<i title="' + esc(rep.name) + '">신고서 ✉ ' + esc(md(rep.date)) + '</i>');
    var items = g.items.map(function (it) {
      var f = g.finalDocId === it.id;
      var nm = (f ? '★ ' : '') + it.name;
      return '<div><span class="nm' + (f ? ' f' : '') + '" title="' + esc(nm + ' · ' + it.kind) + '">' + esc(nm) + '</span>'
        + '<span class="d">' + esc(md(it.date) + ' ' + (it.dir || '')) + (it.status === '보류' ? ' (보류)' : '') + '</span>'
        + '<button class="lnk" data-act="siteDoc" data-id="' + esc(it.id) + '" title="모은 자료에서 가린 글을 봅니다">📥 에서 보기</button>'
        + '<a class="lnk" href="' + esc(Lib().mailHref(g.companyId)) + '" target="_blank" rel="noopener">✉ 메일</a></div>';
    }).join('');
    return '<div class="round"><div class="rh"><b>' + esc(roundLabel(g.roundKey)) + '</b>'
      + '<span class="m">메일 ' + Object.keys(mails).length + '통</span>'
      + (g.finalDocId ? '<span class="k ok">★최종본 정함</span>' : '<span class="k none">최종본 미정</span>') + '</div>'
      + (flow.length ? '<div class="rflow">' + flow.join('→') + '</div>' : '')
      + '<div class="items">' + items + '</div></div>';
  }
  function candHtml(st, row) {
    var docs = (st.data || {}).docs || {};
    var list = (row.candIds || []).map(function (id) {
      var d = docs[id] || {};
      var why = (d.companyCand || []).filter(function (c) { return c && c.companyId === row.id && c.why; })
        .map(function (c) { return c.why; }).join(', ');
      var nm = d.name || id;
      return '<div><span class="nm" title="' + esc(nm) + '">' + esc(nm) + '</span>'
        + '<span class="d">' + esc(ymd((d.mail || {}).date)) + '</span>'
        + '<span class="why" title="' + esc(why) + '">' + esc(why || '근거 없음') + '</span>'
        + '<button class="lnk" data-act="siteDoc" data-id="' + esc(id) + '" title="모은 자료에서 가린 글을 봅니다">📥 에서 보기</button></div>';
    }).join('');
    return '<div class="round cand"><div class="rh"><b>후보 자료</b><span class="m">' + row.cand + '건 · 메일 ' + row.candMails + '통</span>'
      + linkBtn(row) + '</div><div class="items">' + list + '</div></div>';
  }
  function sideHtml(st, row) {
    if (!row) return '<div class="sside empty">사업장을 고르면 여기에 취업규칙 이력과 「✏️ 이 사업장 개정 시작」이 보입니다</div>';
    var sub = [row.bizNo, row.size > 0 ? row.size + '명' + (row.band ? '(' + row.band + ')' : '') : '', row.bizType].filter(Boolean).join(' · ');
    var hist = row.groups.map(roundHtml).join('');
    if (row.cand) hist += candHtml(st, row);
    if (!hist) hist = '<div class="none">아직 이 사업장의 취업규칙 자료가 없습니다.</div>';
    return '<div class="sside">'
      + '<h3 title="' + esc(row.name) + '">' + esc(row.name) + '</h3>'
      + '<div class="sub" title="' + esc(sub) + '">' + esc(sub || '사업자번호·인원 모름') + '</div>'
      + startHtml(st, row) + hist + '</div>';
  }

  /* ── 꽂기 — 셈은 그릴 때 한 번(거래처 수백 곳 — 가볍다) ── */
  function render(el, st, handlers) {
    var s = st.sites || {};
    var rows = Sx().model(st.data, st.companies);
    var shown = Sx().filter(rows, s.f || 'has', s.q || '');
    var row = s.sel ? rows.filter(function (r) { return r.id === s.sel; })[0] : null;
    el.innerHTML = filterHtml(st, Sx().counts(rows))
      + '<div class="swrap"><div class="stbl">' + listHtml(st, shown) + '</div>' + sideHtml(st, row) + '</div>'
      + (st.busy ? '<div class="busy">' + esc(st.busy) + '</div>' : '');
    var H = handlers || {};
    el.onclick = function (ev) {
      var b = ev.target.closest && ev.target.closest('[data-act]');
      if (!b || !el.contains(b) || b.tagName === 'INPUT') return;
      if (H[b.dataset.act]) { ev.preventDefault(); H[b.dataset.act](b.dataset, ev); }
    };
    el.oninput = function (ev) {
      var t = ev.target;
      if (t.dataset && t.dataset.role === 'sq' && H.sq) H.sq(t.value);
    };
    el.onchange = null;
  }

  var api = { render: render, listHtml: listHtml, sideHtml: sideHtml, filterHtml: filterHtml };
  if (root) root.PuRulesV2SitesView = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
