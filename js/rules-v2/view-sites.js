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
  /* 담당 이름 — 명부(st.staff: 사번→이름)에서. 명부에 없으면 사번 그대로(지우면 누가 맡았는지 잃는다) */
  function staffName(st, sid) { return (st.staff && st.staff[sid]) || sid; }
  /* 담당 고르개 (2026-10-05) — 모두 · 내 담당(사번을 알 때만) · 담당자별(곳 수) · 담당 없음 */
  function ownerSelect(st, oc) {
    var who = (st.sites || {}).who || '', me = st.me || '';
    oc = oc || {};
    function opt(v, label) { return '<option value="' + esc(v) + '"' + (who === v ? ' selected' : '') + '>' + esc(label) + '</option>'; }
    var ids = Object.keys(oc).filter(function (k) { return k !== '-' && k !== me; })
      .sort(function (a, b) { return staffName(st, a).localeCompare(staffName(st, b), 'ko'); });
    return '<select class="who" data-role="sm" title="담당자로 거르기 — 주담당·부담당 모두">'
      + opt('', '담당: 모두')
      + (me ? opt(me, '내 담당 (' + (oc[me] || 0) + ')') : '')
      + ids.map(function (k) { return opt(k, staffName(st, k) + ' (' + oc[k] + ')'); }).join('')
      + (oc['-'] ? opt('-', '담당 없음 (' + oc['-'] + ')') : '')
      + '</select>';
  }
  function filterHtml(st, c, oc) {
    var s = st.sites || {}, f = s.f || 'has';
    c = c || { has: 0, wait: 0, all: 0 };
    function chip(v, label, extra) {
      return '<button class="chip' + (extra ? ' ' + extra : '') + (f === v ? ' on' : '') + '" data-act="siteF" data-f="' + v + '">'
        + esc(label) + '<b>' + (c[v] || 0) + '</b></button>';
    }
    return '<div class="flt">'
      + chip('has', '취업규칙 자료 있는 곳') + chip('wait', '확정 기다림', 'warn') + chip('all', '모든 거래처')
      + ownerSelect(st, oc)
      + '<input class="q" data-role="sq" placeholder="🔍 회사 이름 · 사업자번호" value="' + esc(s.q || '') + '">'
      + '<button class="btn" data-act="reload">새로고침</button>'
      + '</div>';
  }

  /* 담당 칸 — 주담당 이름(부담당이 있으면 「+n」), 전부는 title 에 */
  function ownerCell(st, r) {
    var subs = (r.subs || []).map(function (s) { return staffName(st, s); });
    var main = r.mgr ? staffName(st, r.mgr) : '';
    if (!main && !subs.length) return td('', '담당 없음', '<span class="k none">—</span>');
    var t = (main ? main : '') + (subs.length ? (main ? ' · ' : '') + '부 ' + subs.join(', ') : '');
    return td('', t, esc(main || subs[0]) + (main && subs.length ? ' <span class="k none">+' + subs.length + '</span>' : ''));
  }
  /* ── 왼쪽 표 ── (rows 는 이미 거른 것) */
  function listHtml(st, rows, opt) {
    var sel = (st.sites || {}).sel || '', off = opt ? opt.offset || 0 : 0;
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
        + td('no', String(off + i + 1), String(off + i + 1))
        + td('', r.name + (r.closed ? ' (폐업)' : ''), '<b>' + esc(r.name) + '</b>' + (r.closed ? ' <span class="k none">폐업</span>' : ''))
        + td('', size || '인원 모름', size ? esc(size) : '<span class="k none">—</span>')
        + td('', r.bizType || '업태 모름', r.bizType ? esc(r.bizType) : '<span class="k none">—</span>')
        + ownerCell(st, r)
        + td('', docT.join(' · ') || '자료 없음', doc.join(' '))
        + td('', r.last ? '최근 메일 ' + ymd(r.last) : '자료 없음', esc(last))
        + fin
        + '</tr>';
    }).join('');
    var condOn = opt && SC().conditions(opt.cols).length > 0;
    if (!body) body = '<tr><td colspan="8" class="empty" title="">' + (condOn ? '거른 조건에 맞는 사업장이 없습니다 — 조건을 풀어 보세요' : '맞는 사업장이 없습니다 — 「모든 거래처」에서 찾아보세요') + '</td></tr>';
    return '<table class="sites"><colgroup><col style="width:44px"><col><col style="width:120px"><col style="width:96px"><col style="width:84px"><col style="width:250px"><col style="width:80px"><col style="width:80px"></colgroup>'
      + (opt ? headHtml(st, opt) : '<thead><tr><th class="c">#</th><th>사업장</th><th>규모</th><th>업태</th><th>담당</th><th>취업규칙 자료</th><th>최근</th><th>★최종본</th></tr></thead>')
      + '<tbody>' + body + '</tbody></table>';
  }

  /* ── 머리줄 거르기 (설계 §12) — 단추·창·띠·쪽 막대. 셈은 lib-sitecols.js ── */
  function SC() { return root.PuRulesV2SiteCols; }
  /* 거르는 칸 머리 — 이름 · 규모 · 업태 · 담당 · 자료 · 최근 · ★최종본 (#은 아니다) */
  var HEAD = [['name', '사업장'], ['band', '규모'], ['biz', '업태'], ['who', '담당'], ['docs', '취업규칙 자료'], ['last', '최근'], ['fin', '★최종본']];
  function colOn(opt, key, st) {
    var cols = opt.cols || {};
    if (key === 'name') return !!String(((st && st.sites) || {}).q || '').trim();
    if (key === 'who') return !!String(((st && st.sites) || {}).who || '');
    return Array.isArray(cols[key]) && cols[key].length > 0;
  }
  function headCell(st, opt, key, label) {
    var sk = SC().SORT_OF[key], so = opt.sort || {}, arrow = so.key === sk ? (so.dir === 'desc' ? ' <span class="ar">▼</span>' : ' <span class="ar">▲</span>') : '';
    var on = colOn(opt, key, st) || so.key === sk;
    return '<th class="ch' + (on ? ' on' : '') + '"><button class="h" data-act="colOpen" data-key="' + esc(key) + '" title="' + esc(label) + ' — 거르기·순서">'
      + '<span class="lb">' + esc(label) + '</span>' + arrow + '<span class="fl">▾</span></button></th>';
  }
  function headHtml(st, opt) {
    var cells = HEAD.map(function (h) { return headCell(st, opt, h[0], h[1]); });
    return '<thead><tr><th class="c">#</th>' + cells.join('') + '</tr></thead>';
  }
  /* 창 — 한 번에 하나. position:fixed (표 칸이 가로 스크롤이라 안에 두면 잘린다) */
  function popHtml(st, key, rows) {
    var s = st.sites || {}, cols = s.cols || {}, so = s.sort || {}, sk = SC().SORT_OF[key];
    var pos = s.popPos || { x: 40, y: 140 };
    var sort = '<div class="sort"><button class="' + (so.key === sk && so.dir !== 'desc' ? 'on' : '') + '" data-act="colSort" data-key="' + esc(key) + '" data-dir="asc">▲ 오름</button>'
      + '<button class="' + (so.key === sk && so.dir === 'desc' ? 'on' : '') + '" data-act="colSort" data-key="' + esc(key) + '" data-dir="desc">▼ 내림</button></div>';
    var body = '';
    if (key === 'name') {
      body = '<input type="text" data-role="sq" placeholder="🔍 이름 · 사업자번호" value="' + esc(s.q || '') + '">';
    } else if (key === 'who') {
      var oc = Sx().ownerCounts(rows), me = st.me;
      // 지금 고른 담당은 이 목록에 0곳이어도 보인다(SC.options 가 고른 값을 남기는 것과 같다)
      if (s.who && !(s.who in oc)) oc[s.who] = 0;
      var ids =Object.keys(oc).filter(function (k) { return k !== '-'; })
        .sort(function (a, b) { return staffName(st, a).localeCompare(staffName(st, b), 'ko'); });
      var wopt = function (v, label, n) {
        return '<button class="wo' + ((s.who || '') === v ? ' on' : '') + '" data-act="colWho" data-v="' + esc(v) + '" title="' + esc(label) + '"><span class="t">' + esc(label) + '</span><span>' + n + '</span></button>';
      };
      body = '<div class="list">' + wopt('', '모두', (rows || []).length) + (oc['-'] || s.who === '-' ? wopt('-', '담당 없음', oc['-'] || 0) : '')
        + ids.map(function (k) { return wopt(k, staffName(st, k) + (k === me ? ' (나)' : ''), oc[k]); }).join('') + '</div>';
    } else {
      var q = String(s.popq || '').trim();
      var sel = cols[key] || [], opts = SC().options(rows, key, cols);
      if (q) opts = opts.filter(function (o) { return o.label.indexOf(q) >= 0 || sel.indexOf(o.v) >= 0; });
      body = (key === 'biz' ? '<input type="text" data-role="colq" placeholder="🔍 업태 찾기" value="' + esc(s.popq || '') + '">' : '')
        + '<div class="list">' + (opts.map(function (o) {
          return '<label title="' + esc(o.label) + '"><input type="checkbox" data-role="colchk" data-key="' + esc(key) + '" data-v="' + esc(o.v) + '"' + (sel.indexOf(o.v) >= 0 ? ' checked' : '') + '> '
            + '<span class="t">' + esc(o.label) + '</span><span>' + o.n + '</span></label>';
        }).join('') || '<div class="none">값이 없습니다</div>') + '</div>';
    }
    return '<div class="cpop" style="position:fixed;left:' + Math.round(pos.x) + 'px;top:' + Math.round(pos.y) + 'px">' + sort + body
      + '<div class="foot"><button data-act="colClear" data-key="' + esc(key) + '">이 칸 풀기</button><button class="p" data-act="colClose">닫기</button></div></div>';
  }
  function condHtml(cols, total) {
    var c = SC().conditions(cols);
    if (!c.length) return '';
    return '<div class="cact">거른 조건 ' + c.map(function (x) {
      return '<span class="tag">' + esc(x.text) + ' <button data-act="colClear" data-key="' + x.key + '" title="이 조건 풀기">✕</button></span>';
    }).join('') + ' → <b>' + total + '곳</b><button class="clr" data-act="colsClear">모두 풀기</button></div>';
  }
  function pagerHtml(pg) {
    if (!pg || pg.pages <= 1) return '';
    var btn = SC().pageWindow(pg.page, pg.pages).map(function (p) {
      return p === '…' ? '<span class="dots">…</span>'
        : '<button class="pg' + (p === pg.page ? ' on' : '') + '" data-act="pageGo" data-p="' + p + '">' + p + '</button>';
    }).join('');
    return '<div class="pager"><span class="info"><b>' + pg.from + '–' + pg.to + '</b> / ' + pg.total + '곳</span>'
      + '<button class="pg"' + (pg.page <= 1 ? ' disabled' : '') + ' data-act="pageGo" data-p="' + (pg.page - 1) + '">‹ 이전</button>' + btn
      + '<button class="pg"' + (pg.page >= pg.pages ? ' disabled' : '') + ' data-act="pageGo" data-p="' + (pg.page + 1) + '">다음 ›</button></div>';
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
    /* 「← 목록」 — 폰(900px 이하)에서만 보인다. 폰에서는 이 칸이 화면을 덮는 판으로 뜨므로 닫을 길이 있어야 한다
       (PC 는 왼쪽 표가 늘 보여 다른 줄을 누르면 된다 — CSS 가 숨긴다). 고른 것을 비우는 손잡이(siteSel)를 그대로 쓴다 */
    return '<div class="sside">'
      + '<button class="lnk sback" data-act="siteSel" data-co="" title="사업장 목록으로 돌아갑니다">← 목록</button>'
      + '<h3 title="' + esc(row.name) + '">' + esc(row.name) + '</h3>'
      + '<div class="sub" title="' + esc(sub) + '">' + esc(sub || '사업자번호·인원 모름') + '</div>'
      + startHtml(st, row) + hist + '</div>';
  }

  /* ── 꽂기 — 셈은 그릴 때 한 번(거래처 수백 곳 — 가볍다) ── */
  function render(el, st, handlers) {
    var s = st.sites || {};
    var rows = Sx().model(st.data, st.companies);
    var cols = s.cols || {};
    var base = Sx().filter(rows, s.f || 'has', s.q || '', s.who || '');        // 위쪽 칩·담당·검색
    var kept = SC().apply(base, cols);                                          // 머리줄 조건
    // 순서에는 «이름을 못 찾은 사번»을 사번 글자 그대로 넣지 않는다 — 빈 값으로 보내 오름·내림 모두 맨 끝에 둔다(표시는 staffName 그대로)
    var sorted = SC().sortRows(kept, s.sort, function (sid) { return (st.staff || {})[sid] || ''; });
    var pg = SC().page(sorted, s.page);
    // 담당 창은 «담당 거르기 전» 목록(위쪽 칩·검색만 건)에서 사람별 수를 센다. 나머지 창은 base 를 넘기고
    // options 가 cols 로 «그 칸 자신만 빼고» 센다
    // 머리줄 조건(cols)은 그대로 걸린다 — 담당 창의 수도 «지금 보이는 표»를 기준으로 센다(설계 §12-2)
    var popRows = s.pop === 'who' ? SC().apply(Sx().filter(rows, s.f || 'has', s.q || '', ''), cols) : base;
    var row = s.sel ? rows.filter(function (r) { return r.id === s.sel; })[0] : null;
    var opt = { offset: pg.from ? pg.from - 1 : 0, cols: cols, sort: s.sort, pop: s.pop };
    el.innerHTML = filterHtml(st, Sx().counts(rows), Sx().ownerCounts(rows)) + condHtml(cols, kept.length)
      + '<div class="swrap"><div class="stbl">' + listHtml(st, pg.items, opt) + pagerHtml(pg) + '</div>' + sideHtml(st, row) + '</div>'
      + (s.pop ? popHtml(st, s.pop, popRows) : '')
      + (st.busy ? '<div class="busy">' + esc(st.busy) + '</div>' : '');
    var H = handlers || {};
    el.onclick = function (ev) {
      // 눌린 것을 «먼저» 읽는다 — 닫기가 다시 그리면 눌린 단추가 떨어져 나가 그 누름이 삼켜진다
      var b = ev.target.closest && ev.target.closest('[data-act]');
      // 창 밖을 누르면 창을 닫는다(창 안·머리 단추는 빼고) — 여기서는 상태만 비우고 다시 그리지 않는다.
      // 누른 것에 손잡이가 있으면 그 손잡이의 그림이 닫힌 창으로 그린다. 없을 때만 colClose 가 직접 그린다
      var out = !!s.pop && !(ev.target.closest && (ev.target.closest('.cpop') || ev.target.closest('[data-act="colOpen"]')));
      if (out) { s.pop = ''; s.popq = ''; }
      var run = b && el.contains(b) && b.tagName !== 'INPUT' && H[b.dataset.act];
      if (run) {
        ev.preventDefault(); run(b.dataset, ev);
        // 손잡이가 다시 그리지 않았으면(예: 확인창에서 취소) 낡은 창이 화면에 남는다 — 상태는 닫혔으니 창 노드도 뗀다
        if (out && !s.pop) { var stale = el.querySelector && el.querySelector('.cpop'); if (stale && stale.remove) stale.remove(); }
        return;
      }
      if (!out) return;
      // 입력칸·선택칸을 눌렀으면 다시 그리지 않는다 — 그리면 그 칸이 DOM 에서 떨어져 나가 커서·열린 목록이 사라진다. 창만 떼어 낸다
      var tg = ev.target, inCtl = /^(INPUT|SELECT|TEXTAREA)$/.test((tg && tg.tagName) || '') || !!(tg && tg.closest && tg.closest('input,select,textarea'));
      if (inCtl) { var pp = el.querySelector && el.querySelector('.cpop'); if (pp && pp.remove) pp.remove(); }
      else if (H.colClose) H.colClose();
    };
    /* 한글은 조합해 가며 들어온다 — 조합 중에 다시 그리면 칸이 새로 만들어져 「ㄷㅗ」 처럼 조각난다.
       값은 «늘» 그때그때 손잡이에 넘긴다(낡은 값이 남지 않게). 다시 그리는 일을 미루는 것은 손잡이 몫이다 —
       손잡이가 el.__pdComposing 을 보고 조합 중에는 그리지 않고, 조합이 끝나면(compositionend) 한 번 더 불린다.
       ⚠ oncompositionend 는 표준 핸들러 «속성»이 아니다(rules.html 같은 주의) — addEventListener 로, render 가 겹쳐 달지 않게 한 번만 */
    el.__pdCur = { H: H, s: s };
    var typed = function (t, cur) {
      if (!t || !t.dataset) return;
      if (t.dataset.role === 'sq' && cur.H.sq) cur.H.sq(t.value);
      if (t.dataset.role === 'colq' && cur.H.colq) cur.H.colq(t.value);
    };
    // input 이벤트가 조합 여부를 알려 준다 — compositionend 가 못 닿는 경우(칸이 떨어져 나감)에도 깃발이 갇히지 않게 여기서도 맞춘다
    el.oninput = function (ev) { el.__pdComposing = !!ev.isComposing; typed(ev.target, el.__pdCur); };
    if (!el.__pdComp && el.addEventListener) {
      el.__pdComp = true;
      el.addEventListener('compositionstart', function () { el.__pdComposing = true; });
      el.addEventListener('compositionend', function (ev) { el.__pdComposing = false; typed(ev.target, el.__pdCur); });
    }
    el.onchange = function (ev) {
      var t = ev.target;
      if (t.dataset && t.dataset.role === 'sm' && H.sm) H.sm(t.value);
      if (t.dataset && t.dataset.role === 'colchk' && H.colToggle) H.colToggle(t.dataset.key, t.dataset.v, t.checked);
    };
  }

  var api = { render: render, listHtml: listHtml, sideHtml: sideHtml, filterHtml: filterHtml,
    headHtml: headHtml, popHtml: popHtml, condHtml: condHtml, pagerHtml: pagerHtml };
  if (root) root.PuRulesV2SitesView = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
