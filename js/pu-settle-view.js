/* pu-settle-view.js — 컨설팅정산 화면을 «글자(HTML)로 만드는» 순수 함수 (2026-10-31)
   설계 docs/superpowers/specs/2026-10-31-consult-settle-design.md §4.2
   ■ 읽기·쓰기·DOM 없음 — 화면(pu-settle.html)은 이 글자를 innerHTML 로 꽂고 단추를 듣기만 한다. 그래서 node 로 검사할 수 있다.
   ⚠ 표의 한 칸은 «한 줄»이다 — 칸 안에 줄을 쌓지 않는다. 넘치면 … 와 title(전문).
   ⚠ 목록 맨 왼쪽은 ☐(고르기) 다음 번호(보는 번호 — 저장하지 않는다).
   ⚠ 사람이 적은 글(파일 이름·업체·이름·메모)은 반드시 esc() 를 지난다. 사번은 속성(data-*)에만 두고 화면 글자에 쓰지 않는다. */
(function (root, factory) {
  var core = root && root.SettleCore;
  if (typeof module === 'object' && module.exports) core = require('./pu-settle-core.js');
  var api = factory(core);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SettleView = api;
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';

  /* draft 는 «임시저장» — 서버에 저장돼 있고 확정 전까지 고칠 수 있다(대표 지시 2026-10-31 「임시저장기능 만들어 달라」) */
  var STATUS_KO = { draft: '임시저장', confirmed: '확정', manual: '기록만' };
  var ROLE_KO = { lead: '주관', staff: '담당' };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function won(n) { return n == null ? '—' : C.fmt(n); }
  function kst(ms) { return ms ? new Date(Number(ms) + 9 * 3600e3).toISOString().slice(5, 16).replace('T', ' ') : ''; }
  function kstFull(ms) { return ms ? new Date(Number(ms) + 9 * 3600e3).toISOString().slice(0, 16).replace('T', ' ') : ''; }
  /* 세율 고르기 — 3.3% 사업소득 / 8.8% 기타소득(대표 지시 2026-10-31 「3.3 8.8 퍼로 역계산」) */
  function taxSel(attr, cur) {
    return '<select ' + attr + ' title="원천징수 세율">' + ['3.3', '8.8'].map(function (t) { return '<option value="' + t + '"' + (C.taxOf(cur) === t ? ' selected' : '') + '>' + t + '%</option>'; }).join('') + '</select>';
  }
  function whtCell(m) { return '<td class="r" data-k="wht">' + esc(won(m.inc + m.loc)) + (C.taxOf(m.tax) === '8.8' ? ' <span class="pill">8.8%</span>' : '') + '</td>'; }
  function nameOf(names, sid, fallback) { return (names && sid && names[sid]) || fallback || '(이름 없음)'; }
  function ckHead(key, allOn) { return '<th class="c"><input type="checkbox" data-all="' + esc(key) + '"' + (allOn ? ' checked' : '') + '></th><th class="n">번호</th>'; }
  function ckCell(id, on) { return '<td class="c"><input type="checkbox" data-ck="' + esc(id) + '"' + (on ? ' checked' : '') + '></td>'; }
  function nw(k, text, cls) { return '<td class="nw' + (cls ? ' ' + cls : '') + '" data-k="' + k + '" title="' + esc(text) + '">' + esc(text) + '</td>'; }
  function num(k, n) { return '<td class="r" data-k="' + k + '">' + esc(won(n)) + '</td>'; }
  function issuesOf(run) {
    var out = (run.issues || []).slice();
    (run.sites || []).forEach(function (s) { (s.issues || []).forEach(function (x) { out.push(s.company + ' — ' + x); }); });
    return out;
  }

  /* ── ① 지급월 정산표 목록 — 사업 종류마다 묶음 머리(사업 이름 전체) 아래 지급월 줄 ──
     대표 지시 2026-10-31 「깔끔하게 볼수 있게」 「사업 이름 정확하게 알아야 된다」 — 줄마다 긴 사업 이름을 되풀이하지 않는다 */
  /* 대표 지시 2026-10-31 「여러가지 다양한 컨설팅이 있을 가능성 … 추가로 정리가능하게」 — opt.types(규칙이 있는 사업 종류)는 정산표가 아직 없어도
     묶음 머리로 보이고, 묶음마다 «+ 입력»(안내 엑셀 없는 컨설팅의 직접 입력)을 단다 */
  function runsTable(runs, sel, bizNames, cur, opt) {
    sel = sel || {}; bizNames = bizNames || {}; opt = opt || {};
    var bnOf = function (code) { return bizNames[code] || code || ''; };
    var list = (runs || []).filter(function (r) { return r && !r._deleted; });
    var types = [], seen = {};
    list.map(function (r) { return r.typeCode; }).concat(opt.types || []).forEach(function (c) { if (c && !seen[c]) { seen[c] = 1; types.push(c); } });
    types.sort(function (a, b) { return bnOf(a) < bnOf(b) ? -1 : bnOf(a) > bnOf(b) ? 1 : 0; });
    if (!types.length) return '<div class="empty">아직 정산표가 없습니다. «📥 안내 파일»에서 비용지급 안내를 올리거나, «⚙️ 규칙·요율»에서 컨설팅 종류를 더한 뒤 직접 입력하세요.</div>';
    var allOn = list.length > 0 && list.every(function (r) { return sel[r.id]; }), i = 0;
    var h = '<div class="bulk" data-bulk="runs"></div><div class="scroll"><table class="t" data-name="runs"><thead><tr>' + ckHead('runs', allOn)
      + '<th>지급월</th><th class="r">사업장</th><th>상태</th><th class="r">송금 남음</th></tr></thead><tbody>';
    types.forEach(function (code) {
      h += '<tr class="grp"><td colspan="5" title="' + esc(bnOf(code)) + '">' + esc(bnOf(code)) + '</td>'
        + '<td class="r"><button class="sm" data-manual="' + esc(code) + '" title="안내 엑셀이 없는 지급분을 직접 넣는다">+ 입력</button></td></tr>';
      var mine = list.filter(function (r) { return r.typeCode === code; }).sort(function (a, b) { return a.monthKey < b.monthKey ? 1 : -1; });
      if (!mine.length) h += '<tr class="none"><td></td><td></td><td colspan="4" class="hint">아직 정산표 없음 — «+ 입력» 또는 «📥 안내 파일»</td></tr>';
      mine.forEach(function (r) { i++; h += runRow(r, i); });
    });
    return h + '</tbody></table></div>';
    function runRow(r, i) {
      var tr = r.transfers || [], left = tr.filter(function (t) { return !t.paid; }).length;
      return '<tr data-id="' + esc(r.id) + '"' + (r.id === cur ? ' class="on"' : '') + '>' + ckCell(r.id, sel[r.id]) + '<td class="n">' + i + '</td>'
        + '<td class="ti"><a href="#" data-run="' + esc(r.id) + '" title="' + esc(r.label) + '">' + esc(r.label || r.monthKey) + '</a></td>'
        + '<td class="r" data-k="cnt">' + (r.sites || []).length + '</td>'
        + '<td class="nw" data-k="st"><span class="pill st-' + esc(r.status) + '">' + esc(STATUS_KO[r.status] || r.status) + '</span>' + (r.changed ? ' <span class="pill st-chg">바뀜</span>' : '') + '</td>'
        + '<td class="r" data-k="left">' + (r.status === 'confirmed' && tr.length ? left + ' / ' + tr.length : '') + '</td></tr>';
    }
  }

  /* ── ①-1 직접 입력 — 안내 엑셀이 없는 컨설팅(대표 선택 2026-10-31) ──
     st  = {type, siteId, month:'YYYY-MM', rows:[{sid, role:'lead'|'staff', tax:'3.3'|'8.8', net(실수령액, 선택), pre}]}
     ★ 실수령액만 알면 거기에 적는다 → 세율로 세전을 거꾸로 계산해 세전 칸을 채운다(대표 지시 2026-10-31). 저장하면 그 금액이 통장 실입금이 된다.
     opt = {types:[{code,name}](규칙이 있는 종류), sites:[{consultingId,label}](그 종류·2026), staff:[{sid,name}](재직자), names, rates:{sid:%}(그 종류 요율),
            entries:[C.manualEntries 결과](그 종류), sel:{i:1}, selE:{key:1}}
     ⚠ 주관 줄은 규칙의 주관으로 못박는다(바꾸려면 요율표). 담당은 요율표에 요율이 있어야 저장된다. */
  function manualBox(st, opt) {
    st = st || {}; opt = opt || {};
    var rows = st.rows || [], sel = opt.sel || {}, rates = opt.rates || {}, names = opt.names || {};
    var h = '<div class="bar"><b>✍️ 직접 입력</b><span class="hint">안내 엑셀이 없는 지급분 — 사업장·지급월·사람별 세전을 넣으면 정산표가 생깁니다</span><span class="sp"></span><button class="sm" id="m_close">닫기</button></div>'
      + '<div class="bar"><label class="hint" for="m_type">컨설팅 종류</label><select id="m_type">'
      + (opt.types || []).map(function (b) { return '<option value="' + esc(b.code) + '"' + (b.code === st.type ? ' selected' : '') + '>' + esc(b.name) + '</option>'; }).join('') + '</select>'
      + '<label class="hint" for="m_site">사업장</label><select id="m_site"><option value="">— 사업장 —</option>'
      + (opt.sites || []).map(function (s) { return '<option value="' + esc(s.consultingId) + '"' + (s.consultingId === st.siteId ? ' selected' : '') + '>' + esc(s.label) + '</option>'; }).join('') + '</select>'
      + '<label class="hint" for="m_month">지급월</label><input type="month" id="m_month" value="' + esc(st.month || '') + '"></div>'
      + '<div class="bulk" data-bulk="manual"></div><div class="scroll"><table class="t" data-name="manual"><thead><tr>' + ckHead('manual', rows.length > 0 && rows.every(function (r, i) { return sel[i]; }))
      + '<th>수행자</th><th class="r">요율</th><th>세율</th><th class="r">실수령액(통장)</th><th class="r">세전</th><th class="r">세후 계산</th></tr></thead><tbody>';
    rows.forEach(function (r, i) {
      var pre = C.won(r.pre), w = C.withholding(pre, r.tax), sg = (opt.suggest || {})[r.sid];
      var rate = r.sid && rates[r.sid] != null ? rates[r.sid] + '%' : (r.sid && sg != null ? sg + '% (기존)' : '');
      h += '<tr>' + ckCell(String(i), sel[i]) + '<td class="n">' + (i + 1) + '</td>'
        + (r.role === 'lead'
          ? '<td class="ti" data-k="who">' + esc(nameOf(names, r.sid, '(주관 없음 — 요율표에서 고르세요)')) + ' <span class="pill role-lead">주관</span></td><td class="r" data-k="rate"></td>'
          : '<td data-k="who"><select data-m="' + i + '|sid">' + staffOpts(opt.staff, names, r.sid, '— 담당 —') + '</select> <span class="pill">담당</span></td>'
            + '<td class="r" data-k="rate"' + (rate && rates[r.sid] == null ? ' title="이 컨설팅 요율표에 없어 다른 컨설팅에서 쓰는 요율을 가져왔습니다 — 저장하면 요율표에도 들어갑니다"' : '') + '>'
            + (rate ? esc(rate) : (r.sid ? '<span class="bad">요율표에 없음</span>' : '')) + '</td>')
        + '<td data-k="tax">' + taxSel('data-m="' + i + '|tax"', r.tax) + '</td>'
        + '<td class="r" data-k="real"><input type="text" inputmode="numeric" class="amt" data-m="' + i + '|net" value="' + esc(r.net == null ? '' : r.net) + '" placeholder="알면 적기"></td>'
        + '<td class="r" data-k="pre"><input type="text" inputmode="numeric" class="amt" data-m="' + i + '|pre" value="' + esc(r.pre == null ? '' : r.pre) + '" placeholder="세전"></td>'
        + '<td class="r" data-k="net" data-m-net="' + i + '">' + esc(won(pre - w.total)) + '</td></tr>';
    });
    h += '</tbody></table></div><div class="bar"><button class="sm" id="m_add">+ 담당</button>'
      + '<span class="hint">따로 나눠 받지 않았으면 주관이 전액, 담당 세전은 0 · 실수령액만 알면 그 칸에 — 세전을 거꾸로 계산합니다</span>'
      + '<span class="sp"></span><button class="pri" id="m_save">저장하고 정산표 만들기</button></div>';
    var es = opt.entries || [], selE = opt.selE || {};
    h += '<div class="sec">이 컨설팅에 직접 넣은 것</div>';
    if (!es.length) return h + '<div class="empty">아직 없습니다.</div>';
    h += '<div class="bulk" data-bulk="mentries"></div><div class="scroll"><table class="t" data-name="mentries"><thead><tr>' + ckHead('mentries', es.every(function (e) { return selE[e.key]; }))
      + '<th>지급월</th><th>사업장</th><th>사람별 세전</th></tr></thead><tbody>';
    es.forEach(function (e, i) {
      var ppl = e.people.map(function (p) { return p.name + ' ' + C.fmt(p.pre); }).join(' · ');
      h += '<tr>' + ckCell(e.key, selE[e.key]) + '<td class="n">' + (i + 1) + '</td><td class="nw" data-k="mon">' + esc(e.monthKey) + '</td>'
        + nw('site', e.company, 'ti') + nw('ppl', ppl) + '</tr>';
    });
    return h + '</tbody></table></div>';
  }

  /* 임시저장(확정 전)인 달은 아직 송금 목록이 저장돼 있지 않다 — 각 사업장의 주관을 상대로 «확정하면 생길» 목록을 미리 보여 준다 */
  function previewTransfers(sites) {
    var out = [];
    (sites || []).forEach(function (s) {
      var lead = (s.members || []).filter(function (m) { return m.role === 'lead'; })[0];
      if (lead) out = out.concat(C.transfersOf([s], lead.sid));
    });
    return out;
  }
  /* ── ② 정산표 한 장 ──
     opt = {biz:사업 이름, pend:{'consultingId|sid': 친 글}} — pend 는 «아직 임시저장 안 한» 통장 실입금(화면에만 있다).
     대표 지시 2026-10-31 「임시저장기능 만들어 달라 … 깔끔하게 볼수 있게」:
       · 통장 실입금은 쳐도 바로 저장하지 않는다 — 노란 칸으로 남고 «임시저장 (n)» 한 번에 저장, 옆에 마지막 임시저장 시각
       · 사업장은 묶음 머리에 한 번(누가 누구에게 얼마도 거기에), 구분·요율은 이름 옆 딱지, 차액·조정 칸은 이월·조정이 있을 때만 */
  function runDetail(run, names, sel, opt) {
    sel = sel || {}; opt = opt || {};
    var pend = opt.pend || {}, nPend = Object.keys(pend).length;
    var iss = issuesOf(run), ok = C.checkRun(run.sites || [], run.issues || []).ok, draft = run.status === 'draft';
    var T = 0, shares = 0, tr = draft ? previewTransfers(run.sites) : (run.transfers || []), trSum = 0, paidN = 0, checkedN = 0, hasAdj = false;
    (run.sites || []).forEach(function (s) { T += s.totalNet; s.members.forEach(function (m) {
      if (m.role === 'staff' && m.share != null) shares += m.share;
      if (m.pre > 0) { paidN++; if (m.actual != null) checkedN++; }
      if (m.adjust) hasAdj = true;
    }); });
    tr.forEach(function (t) { trSum += t.amount; });
    var h = '<div class="bar"><b>' + esc(run.label || run.monthKey) + '</b> <span class="pill st-' + esc(run.status) + '">' + esc(STATUS_KO[run.status] || run.status) + '</span>'
      + (opt.biz ? '<span class="hint" title="' + esc(opt.biz) + '">' + esc(opt.biz) + '</span>' : '') + '<span class="sp"></span>';
    if (draft) h += '<span class="hint" data-k="stamp">' + esc(kst(run.updatedAt || run.createdAt)) + ' 임시저장됨</span>'
      + '<button class="sm" data-act="manual" title="이미 손으로 정산을 끝낸 달 — 기록만 남기고 카톡은 보내지 않는다">기록만</button><button class="sm" data-act="recalc">다시 계산</button>'
      + '<button class="sm' + (nPend ? ' pend' : '') + '" data-act="draftSave" id="draftSave" title="고친 통장 실입금을 서버에 저장한다 — 다른 PC에서도 이어서 할 수 있다">임시저장' + (nPend ? ' (' + nPend + ')' : '') + '</button>'
      + '<button class="sm pri" data-act="confirm"' + (ok ? '' : ' disabled title="확인 필요를 먼저 풀어 주세요"') + '>확정</button>';
    else h += '<button class="sm" data-act="unconfirm">' + (run.status === 'manual' ? '기록만 풀기' : '확정 풀기') + '</button><button class="sm" data-act="xlsx">엑셀</button>'
      + (run.status === 'confirmed' ? '<button class="sm pri" data-act="msgs">카톡 문구</button>' : '');
    h += '</div><div class="kpis">'
      + '<div class="kpi"><span>세후 합계 · 입금 확인 ' + checkedN + '/' + paidN + '</span><b>' + won(T) + '원</b></div>'
      + '<div class="kpi"><span>담당 몫 합계</span><b>' + won(shares) + '원</b></div>'
      + '<div class="kpi"><span>' + (draft ? '송금(확정하면)' : '송금') + '</span><b>' + tr.length + '건 · ' + won(trSum) + '원</b></div>'
      + '<div class="kpi' + (iss.length ? ' bad' : '') + '"><span>확인 필요</span><b>' + iss.length + '건</b></div></div>';
    if (run.changed) h += '<div class="warn">새 안내 파일에서 이 달 금액이 바뀌었습니다 — 확정을 풀고 다시 계산하세요.</div>';
    if (iss.length) h += '<div class="warn">' + iss.map(esc).join(' · ') + '</div>';
    /* 송금 방향 — 사업장마다 주관을 알아 두고 «반환 / 추가 지급»을 붙인다(대표 지시 2026-10-31 「정확하게 이해가능하게 정리」) */
    var leadBy = {}, leadName = '';
    (run.sites || []).forEach(function (s) { s.members.forEach(function (m) { if (m.role === 'lead') { leadBy[s.consultingId || s.company] = m.sid; if (!leadName) leadName = nameOf(names, m.sid, m.name); } }); });
    var dirTag = function (t) { var d = C.dirOf(t, leadBy[t.consultingId || t.company]); return '<span class="pill dir-' + d + '">' + C.DIR_KO[d] + '</span>'; };
    var lead = leadName ? '주관(' + esc(leadName) + ')' : '주관';
    h += '<div class="bar legend"><span class="pill dir-back">반환</span><span class="hint">담당 → ' + lead + '</span>'
      + '<span class="pill dir-more">추가 지급</span><span class="hint">' + lead + ' → 담당</span>'
      + '<span class="hint">· 몫 = 사업장 세후 합계 × 요율 · 정산액 + 받을 돈 / − 보낼 돈</span></div>';
    var cols = hasAdj ? 12 : 10, rows = [], idx = 0;
    (run.sites || []).forEach(function (s, si) {
      var st = draft ? previewTransfers([s]) : tr.filter(function (t) { return t.consultingId && s.consultingId ? t.consultingId === s.consultingId : t.company === s.company; });
      var stOne = function (t) { return nameOf(names, t.fromSid) + ' → ' + nameOf(names, t.toSid) + ' ' + won(t.amount) + '원'; };
      var stText = st.length ? st.map(function (t) { return stOne(t) + ' ' + C.DIR_KO[C.dirOf(t, leadBy[t.consultingId || t.company])]; }).join(' · ') : '주고받을 금액 없음';
      rows.push('<tr class="grp"><td colspan="6" title="' + esc(s.company) + '">' + esc(s.company) + ' · ' + s.round + '차 · 세후 합계 ' + won(s.totalNet) + '원' + (s.issues.length ? ' · <span class="bad">확인 필요 ' + s.issues.length + '</span>' : '') + '</td>'
        + '<td colspan="' + (cols - 6) + '" class="r grp-tr" title="' + esc(stText) + '">'
        + (st.length ? st.map(function (t) { return esc(stOne(t)) + ' ' + dirTag(t); }).join(' · ') : esc(stText)) + '</td></tr>');
      s.members.forEach(function (m, mi) {
        var id = si + ':' + mi, key = s.consultingId + '|' + m.sid, nm = nameOf(names, m.sid, m.name), hasP = Object.prototype.hasOwnProperty.call(pend, key);
        var tag = m.role === 'lead' ? '<span class="pill role-lead">주관</span>' : '<span class="pill">' + ROLE_KO.staff + (m.rate == null ? '' : ' ' + esc(m.rate) + '%') + '</span>';
        idx++;
        rows.push('<tr>' + ckCell(id, sel[id]) + '<td class="n">' + idx + '</td>'
          + '<td class="nw ti" data-k="name" title="' + esc(nm) + '">' + esc(nm) + ' ' + tag + '</td>'
          + num('pre', m.pre) + whtCell(m) + num('net', m.net)
          + '<td class="r" data-k="act">' + (draft && s.consultingId && m.sid
            ? '<input type="text" inputmode="numeric" class="amt' + (hasP ? ' dirty' : '') + '" data-actual="' + esc(key) + '" value="' + esc(hasP ? pend[key] : (m.actual == null ? '' : C.fmt(m.actual))) + '" placeholder="통장 입금">'
            : esc(m.actual == null ? '' : won(m.actual)))
          /* 통장 실입금이 있으면 계산한 세후와 견준 딱지 — 같으면 «일치», 다르면 차이(실입금 − 계산). 고치는 중(노란 칸)이면 옛 딱지는 감춘다 */
          + (m.actual == null || hasP ? '' : ' <span class="pill ' + (m.actual === m.net ? 'st-confirmed' : 'st-draft') + '" data-k="cmp">' + (m.actual === m.net ? '일치' : esc(C.fmt(m.actual - m.net))) + '</span>') + '</td>'
          /* 주관은 몫·차액이 없다 — «—» 를 찍지 않고 비워 둔다(말을 하는 값만, 폰 카드에서 칸 이름도 안 붙는다) */
          + (m.role === 'lead' ? '<td class="r" data-k="share"></td>' : num('share', m.share))
          + (hasAdj ? (m.role === 'lead' ? '<td class="r" data-k="diff"></td>' : num('diff', m.diff)) + '<td class="r" data-k="adj">' + (m.adjust ? esc(won(m.adjust)) : '') + '</td>' : '')
          + '<td class="r b" data-k="settle">' + esc(won(m.settle)) + '</td>' + num('final', m.final) + '</tr>');
      });
    });
    h += '<div class="bulk" data-bulk="members"></div><div class="scroll"><table class="t" data-name="run"><thead><tr>' + ckHead('members', false)
      + '<th>이름</th><th class="r">세전</th><th class="r">원천징수</th><th class="r">세후</th><th class="r">통장 실입금</th><th class="r">몫</th>'
      + (hasAdj ? '<th class="r">차액</th><th class="r">조정</th>' : '') + '<th class="r">정산액</th><th class="r">최종</th></tr></thead><tbody>'
      + rows.join('') + '</tbody></table></div>';
    if (draft) h += '<div class="warn" id="pendNote"' + (nPend ? '' : ' style="display:none"') + '>저장 안 한 칸 ' + nPend + '개 — «임시저장»을 누르면 다른 PC에서도 이어서 할 수 있습니다</div>';
    h += '<div class="sec">' + (draft ? '송금 목록 — 미리보기(확정하면 이대로 생깁니다)' : '송금 목록') + '</div>';
    if (!tr.length) return h + '<div class="empty">주고받을 금액이 없습니다.</div>';
    h += '<div class="bulk" data-bulk="transfers"></div><div class="scroll"><table class="t" data-name="transfers"><thead><tr>' + ckHead('transfers', false)
      + '<th>사업장</th><th>구분</th><th>보내는 사람</th><th>받는 사람</th><th class="r">금액</th><th>보냄</th><th>보낸 때</th></tr></thead><tbody>';
    tr.forEach(function (t, i) {
      h += '<tr>' + ckCell('t' + i, sel['t' + i]) + '<td class="n">' + (i + 1) + '</td>' + nw('site', t.company) + '<td class="nw" data-k="dir">' + dirTag(t) + '</td>'
        + nw('from', nameOf(names, t.fromSid), 'ti') + nw('to', nameOf(names, t.toSid))
        + num('amt', t.amount)
        + '<td data-k="paid"><label class="ck"><input type="checkbox" data-paid="' + i + '"' + (t.paid ? ' checked' : '') + (run.status === 'confirmed' ? '' : ' disabled') + '> 보냄</label></td>'
        + '<td class="nw" data-k="at">' + esc(t.paid ? kst(t.paidAt) : '') + '</td></tr>';
    });
    return h + '</tbody></table></div>';
  }

  /* ── ③ 안내 파일 ── */
  function noticesTable(notices, sel, bizNames) {
    sel = sel || {}; bizNames = bizNames || {};
    var list = (notices || []).filter(function (n) { return n && !n._deleted; }).sort(function (a, b) { return (b.receivedAt || 0) - (a.receivedAt || 0); });
    if (!list.length) return '<div class="empty">올린 안내 파일이 없습니다.</div>';
    var allOn = list.every(function (n) { return sel[n.id]; });
    var h = '<div class="bulk" data-bulk="notices"></div><div class="scroll"><table class="t" data-name="notices"><thead><tr>' + ckHead('notices', allOn)
      + '<th>사업</th><th>파일</th><th>지급월</th><th>받은 때</th><th class="r">줄</th><th>출처</th><th></th></tr></thead><tbody>';
    list.forEach(function (n, i) {
      /* 지급월은 해마다 묶어 «2026년 7월 · 9월 (10/2 지급) · 10월» */
      var byY = {}, ys = [];
      (n.months || []).forEach(function (m) { var y = C.yearOf(m.key); if (!byY[y]) { byY[y] = []; ys.push(y); } byY[y].push(m.label); });
      var months = ys.map(function (y) { return y + '년 ' + byY[y].join(' · '); }).join(' / ');
      h += '<tr>' + ckCell(n.id, sel[n.id]) + '<td class="n">' + (i + 1) + '</td>' + nw('biz', bizNames[n.typeCode] || n.typeCode || '', 'ti') + nw('file', n.fileName)
        + nw('months', months) + '<td class="nw" data-k="at">' + esc(kstFull(n.receivedAt)) + '</td>'
        + '<td class="r" data-k="rows">' + (n.rows || []).length + '</td>' + nw('src', n.source === 'agent' ? 'PC 심부름꾼' : n.source === 'manual' ? '직접 입력' : '올림')
        + '<td data-k="btn"><button class="sm" data-notice="' + esc(n.id) + '">정산표 만들기</button></td></tr>';
    });
    return h + '</tbody></table></div>';
  }
  /* 아직 확정 안 된 업체·사람 연결 — 후보는 «보여만» 준다(미리 골라 두지 않는다) */
  function linkBox(unlinked) {
    var co = (unlinked && unlinked.companies) || [], pe = (unlinked && unlinked.people) || [];
    if (!co.length && !pe.length) return '';
    function sel(kind, item, opts) {
      return '<div class="fr"><label title="' + esc(item.text) + '">' + esc(item.text) + '</label><div class="fv"><select data-link="' + kind + '" data-key="' + esc(item.key) + '"><option value="">— 고르기 —</option>'
        + opts + '</select><button class="sm" data-link-save="' + kind + '|' + esc(item.key) + '">확정</button></div></div>';
    }
    var h = '<div class="card linkbox"><div class="sec">연결 확정 — 안내 파일의 글을 이알피 원본에 한 번만 이어 주세요</div>';
    co.forEach(function (c) { h += sel('company', c, (c.candidates || []).map(function (o) { return '<option value="' + esc(o.consultingId + '|' + (o.companyId || '')) + '">' + esc(o.label) + '</option>'; }).join('')); });
    pe.forEach(function (p) { h += sel('person', p, (p.candidates || []).map(function (o) { return '<option value="' + esc(o.sid) + '">' + esc(o.label) + '</option>'; }).join('')); });
    return h + '</div>';
  }

  /* ── ④ 규칙·요율 — 요율표 하나(줄 = 사람, 칸 = 사업 종류) + 사업마다 «자세히»(접힘) ──
     대표 지시 2026-10-31 「규칙 요율 너무 불필요하게 화면 많이 차지 … 사업종류 사람마다 다 다를 수 있는데 깔끔하게 정리」.
     work = {types:[code], rules:{code:{title, leadSid, rates:{sid:'25'}, siteRates:{cid:{sid:pct}}, msgHead, msgFoot, active}}, people:[sid], dirty, open}
     opt  = {bizNames:{code:이름}, addTypes:[{code,name}], staff:[{sid,name}](재직자만), names:{sid:이름}, sitesByType:{code:[{consultingId,label}]}, sel:{sid:1}}
     ⚠ 고르기(사람·주관)는 재직자만 — 그러나 이미 들어 있는 사람(퇴사 뒤에도 남은 요율)은 이름으로 보인다. */
  function staffOpts(staff, names, cur, blank) {
    var list = (staff || []).slice();
    if (cur && !list.some(function (p) { return p.sid === cur; })) list.unshift({ sid: cur, name: (names && names[cur]) || '(이름 없음)' });
    return '<option value="">' + esc(blank || '— 사람 —') + '</option>' + list.map(function (p) { return '<option value="' + esc(p.sid) + '"' + (p.sid === cur ? ' selected' : '') + '>' + esc(p.name) + '</option>'; }).join('');
  }
  function rateMatrix(work, opt) {
    opt = opt || {}; work = work || {};
    var types = work.types || [], rules = work.rules || {}, people = work.people || [], names = opt.names || {}, sel = opt.sel || {}, biz = opt.bizNames || {};
    /* 칸 머리는 사업 이름 «전체» — 줄이거나 … 로 자르지 않는다(대표 지시 2026-10-31 「사업 이름 정확하게 알아야 된다」). 사업이 많으면 표만 옆으로 민다 */
    var title = function (code) { var r = rules[code] || {}; return r.title || biz[code] || code; };
    var h = '<div class="card"><div class="bar"><b>요율표</b><span class="hint">줄 = 사람 · 칸 = 사업 종류 · 25 = 25%</span><span class="sp"></span>'
      + '<select id="mx_addType" title="요율표에 사업 종류 칸을 더한다"><option value="">+ 사업 종류</option>'
      + (opt.addTypes || []).map(function (b) { return '<option value="' + esc(b.code) + '">' + esc(b.name) + '</option>'; }).join('') + '</select>'
      + (Object.keys(opt.suggest || {}).length ? '<button class="sm" id="mx_fill" title="빈 칸에 그 사람이 다른 컨설팅에서 쓰는 요율을 넣는다 — «저장»을 눌러야 반영">빈 칸에 기존 % 넣기</button>' : '')
      + '<button class="sm pri" id="mx_save"' + (work.dirty ? '' : ' disabled') + '>저장</button></div>';
    if (!types.length) return h + '<div class="empty">아직 사업 종류가 없습니다 — 오른쪽 위 «+ 사업 종류»로 칸을 더하세요.</div></div>';
    var sug = opt.suggest || {};
    var allOn = people.length > 0 && people.every(function (s) { return sel[s]; });
    h += '<div class="bulk" data-bulk="mxpeople"></div><div class="scroll"><table class="t mx" data-mx-table><thead><tr>'
      + '<th class="c"><input type="checkbox" data-all="mxpeople"' + (allOn ? ' checked' : '') + '></th><th class="n">번호</th><th>이름</th>'
      + types.map(function (c) { return '<th class="mxc" title="' + esc(title(c)) + '">' + esc(title(c)) + '</th>'; }).join('') + '</tr></thead><tbody>'
      + '<tr class="cfg"><td></td><td></td><td>주관</td>' + types.map(function (c) { return '<td class="mxc"><select data-lead="' + esc(c) + '">' + staffOpts(opt.staff, names, (rules[c] || {}).leadSid, '— 고르기 —') + '</select></td>'; }).join('') + '</tr>'
      + '<tr class="cfg"><td></td><td></td><td>켜짐</td>' + types.map(function (c) { return '<td class="mxc"><label class="ck" title="켜면 이 사업 종류는 컨설팅정산에서 개별정산한다(재무관리 성과급에서 뺀다)"><input type="checkbox" data-on="' + esc(c) + '"' + ((rules[c] || {}).active !== false ? ' checked' : '') + '></label></td>'; }).join('') + '</tr>';
    people.forEach(function (sid, i) {
      h += '<tr>' + ckCell(sid, sel[sid]) + '<td class="n">' + (i + 1) + '</td><td class="ti" title="' + esc(names[sid] || '') + '">' + esc(names[sid] || '(이름 없음)') + '</td>'
        + types.map(function (c) {
          var v = ((rules[c] || {}).rates || {})[sid], s = sug[c + '|' + sid];
          /* 빈 칸은 그 사람의 기존 %를 흐리게 보여 준다(넣지는 않는다 — «빈 칸에 기존 % 넣기» 또는 직접 친다) */
          return '<td class="mxc"><input type="text" inputmode="decimal" class="pct" data-mx="' + esc(c + '|' + sid) + '" value="' + esc(v == null ? '' : v) + '" placeholder="' + (s == null ? '—' : esc(s)) + '"'
            + (s == null ? '' : ' title="기존 ' + esc(s) + '% — 다른 컨설팅에서 쓰는 요율"') + '></td>'; }).join('') + '</tr>';
    });
    var addable = (opt.staff || []).filter(function (p) { return people.indexOf(p.sid) < 0; });
    h += '<tr class="cfg"><td></td><td></td><td colspan="' + (types.length + 1) + '"><select id="mx_addSid"><option value="">+ 사람(재직자)</option>'
      + addable.map(function (p) { return '<option value="' + esc(p.sid) + '">' + esc(p.name) + '</option>'; }).join('') + '</select></td></tr>';
    return h + '</tbody></table></div>' + (work.dirty ? '<div class="bar"><span class="hint bad">저장하지 않은 변경이 있습니다.</span></div>' : '') + '</div>';
  }
  /* 사업마다 접어 두는 «자세히» — 카톡 머리말·맺음말·이름, 사업장별 예외 요율 */
  function ruleDetails(work, opt) {
    opt = opt || {}; work = work || {};
    var rules = work.rules || {}, names = opt.names || {}, biz = opt.bizNames || {};
    return (work.types || []).map(function (c) {
      var r = rules[c] || {}, sites = (opt.sitesByType || {})[c] || [], label = {}, sr = r.siteRates || {};
      sites.forEach(function (s) { label[s.consultingId] = s.label; });
      var rows = [];
      Object.keys(sr).forEach(function (cid) { Object.keys(sr[cid] || {}).forEach(function (sid) { rows.push({ cid: cid, sid: sid, pct: sr[cid][sid] }); }); });
      var h = '<details class="card rd" data-rd="' + esc(c) + '"' + (work.open === c ? ' open' : '') + '><summary class="sec">⋯ ' + esc(r.title || biz[c] || c) + ' 자세히 — 카톡 문구 · 사업장별 예외 요율' + (rows.length ? ' (' + rows.length + ')' : '') + '</summary>'
        + '<div class="fr"><label>이름</label><div class="fv"><input type="text" data-rf="' + esc(c) + '|title" value="' + esc(r.title || '') + '" placeholder="' + esc(biz[c] || c) + '"></div></div>'
        + '<div class="fr"><label>머리말</label><div class="fv"><input type="text" data-rf="' + esc(c) + '|msgHead" value="' + esc(r.msgHead || '') + '" placeholder="' + esc(C.DEFAULT_HEAD) + '"></div></div>'
        + '<div class="fr"><label>맺음말</label><div class="fv"><input type="text" data-rf="' + esc(c) + '|msgFoot" value="' + esc(r.msgFoot || '') + '" placeholder="' + esc(C.DEFAULT_FOOT) + '"></div></div>'
        + '<div class="fr"><label>원천징수</label><div class="fv">' + taxSel('data-rf="' + esc(c) + '|tax"', r.tax) + '<span class="hint">이 컨설팅의 기본 — 3.3% 사업소득 / 8.8% 기타소득</span></div></div>'
        + '<div class="sec">사업장별 예외 요율 <span class="hint">— 이 사업장에서만 요율표와 다를 때</span></div><div class="scroll"><table class="t sr"><tbody>';
      rows.forEach(function (x) {
        h += '<tr><td class="nw" title="' + esc(label[x.cid] || '') + '">' + esc(label[x.cid] || '(연결된 사업장)') + '</td><td class="nw">' + esc(names[x.sid] || '(이름 없음)') + '</td><td class="r">' + esc(x.pct) + '%</td>'
          + '<td><button class="sm" data-srate-del="' + esc(c + '|' + x.cid + '|' + x.sid) + '">빼기</button></td></tr>';
      });
      h += '<tr><td><select data-sr-site="' + esc(c) + '"><option value="">— 사업장 —</option>' + sites.map(function (s) { return '<option value="' + esc(s.consultingId) + '">' + esc(s.label) + '</option>'; }).join('') + '</select></td>'
        + '<td><select data-sr-sid="' + esc(c) + '"><option value="">— 사람 —</option>' + (work.people || []).map(function (sid) { return '<option value="' + esc(sid) + '">' + esc(names[sid] || '(이름 없음)') + '</option>'; }).join('') + '</select></td>'
        + '<td class="r"><input type="text" inputmode="decimal" class="pct" data-sr-pct="' + esc(c) + '" placeholder="%"></td><td><button class="sm" data-srate-add="' + esc(c) + '">더하기</button></td></tr>';
      return h + '</tbody></table></div><div class="bar"><span class="hint">{사업} · {월} 은 저절로 바뀝니다. 고친 뒤 요율표의 «저장»을 누르세요.</span></div></details>';
    }).join('');
  }
  function adjustsTable(adjusts, siteNames, names, sel, opt) {
    sel = sel || {}; siteNames = siteNames || {}; opt = opt || {};
    var list = (adjusts || []).filter(function (a) { return a && !a._deleted; });
    var allOn = list.length > 0 && list.every(function (a) { return sel[a.id]; });
    var h = '<div class="bulk" data-bulk="adjusts"></div><div class="scroll"><table class="t" data-name="adjusts"><thead><tr>' + ckHead('adjusts', allOn)
      + '<th>사업장</th><th>이름</th><th class="r">금액</th><th>내용</th><th>상태</th><th></th></tr></thead><tbody>';
    list.forEach(function (a, i) {
      h += '<tr>' + ckCell(a.id, sel[a.id]) + '<td class="n">' + (i + 1) + '</td>' + nw('site', siteNames[a.consultingId] || '(연결된 사업장)') + nw('name', nameOf(names, a.sid), 'ti')
        + num('amt', a.amount) + nw('memo', a.memo || '') + nw('st', a.appliedRunId ? '붙음' : '다음 정산 때 붙음')
        + '<td data-k="btn">' + (a.appliedRunId ? '' : '<button class="sm" data-adj-del="' + esc(a.id) + '">지우기</button>') + '</td></tr>';
    });
    if (!list.length) h += '<tr><td colspan="8" class="empty">이월·조정이 없습니다.</td></tr>';
    if (opt.sites && opt.people) {
      h += '<tr><td></td><td></td><td><select id="a_site"><option value="">— 사업장 —</option>' + opt.sites.map(function (s) { return '<option value="' + esc(s.consultingId) + '">' + esc(s.label) + '</option>'; }).join('') + '</select></td>'
        + '<td><select id="a_sid"><option value="">— 사람 —</option>' + opt.people.map(function (p) { return '<option value="' + esc(p.sid) + '">' + esc(p.name) + '</option>'; }).join('') + '</select></td>'
        + '<td class="r"><input type="text" inputmode="numeric" class="amt" id="a_amt" placeholder="−는 반환"></td><td><input type="text" id="a_memo" placeholder="내용"></td><td></td><td><button class="sm" id="a_add">더하기</button></td></tr>';
    }
    return h + '</tbody></table></div>';
  }

  /* ── ②-1 입금 대조 (임시저장인 정산표) — 통장에 실제로 들어온 금액과 계산한 세후를 견준다 ──
     st = {people:[{sid,name}], sid, found:[], source:'paste'|'ledger'|'', text, matches:[C.matchDeposits 결과], pick:{key:foundId}, sel:{key:1}}
     ⚠ 금액이 같다는 것은 후보일 뿐 — 아래 «저장»을 눌러야 통장 실입금이 된다. 고르기만으로는 아무것도 안 바뀐다. */
  var KIND_KO = { exact: '일치', near: '금액 다름 — 확인', none: '못 찾음' };
  function depositBox(st) {
    st = st || {};
    var people = st.people || [], found = st.found || [], matches = st.matches || [], pick = st.pick || {}, sel = st.sel || {};
    var h = '<details class="card dep"' + (st.open ? ' open' : '') + ' data-dep-box><summary class="sec">💳 입금 대조 — 통장에 실제로 들어온 금액과 견주기</summary>'
      + '<div class="bar"><label class="hint" for="dep_sid">누구 통장</label><select id="dep_sid"><option value="">— 사람 —</option>'
      + people.map(function (p) { return '<option value="' + esc(p.sid) + '"' + (p.sid === st.sid ? ' selected' : '') + '>' + esc(p.name) + '</option>'; }).join('') + '</select>'
      + '<span class="sp"></span><button class="sm" id="dep_pull" title="재무관리 거래내역(하나은행 문자·통장 엑셀로 모은 대표 통장)에서 이 달 입금을 가져온다">재무관리에서 당겨오기</button></div>'
      + '<div class="fr"><textarea id="dep_text" rows="3" placeholder="인터넷뱅킹 거래내역·입금 문자·엑셀 줄을 복사해 붙여 넣으세요">' + esc(st.text || '') + '</textarea></div>'
      + '<div class="bar"><button class="sm" id="dep_read">붙여 넣은 글 읽기</button><span class="hint">' + (found.length ? '찾은 입금 ' + found.length + '건 · ' + (st.source === 'ledger' ? '재무관리' : '붙여넣기') : '사람을 고르고 붙여 넣거나 당겨오세요') + '</span></div>';
    if (!st.sid) return h + '</details>';
    if (!matches.length) return h + '<div class="empty">이 사람은 이 정산표에 받을 금액이 없습니다.</div></details>';
    var allOn = matches.every(function (m) { return sel[m.key]; });
    h += '<div class="scroll"><table class="t" data-name="deposits"><thead><tr>' + ckHead('deposits', allOn)
      + '<th>사업장</th><th class="r">예상 세후</th><th>찾은 입금</th><th class="r">차이</th><th>상태</th></tr></thead><tbody>';
    matches.forEach(function (m, i) {
      var cur = pick[m.key] || '', f = found.filter(function (x) { return x.id === cur; })[0] || null, diff = f ? f.amount - m.expected : null;
      var kind = !f ? 'none' : (diff === 0 ? 'exact' : 'near');
      h += '<tr>' + ckCell(m.key, sel[m.key]) + '<td class="n">' + (i + 1) + '</td>' + nw('site', m.company, 'ti') + num('exp', m.expected)
        + '<td data-k="pick"><select data-dep="' + esc(m.key) + '"><option value="">— 없음 —</option>'
        + found.map(function (x) { return '<option value="' + esc(x.id) + '"' + (x.id === cur ? ' selected' : '') + '>' + esc(C.fmt(x.amount) + '원 · ' + (x.date || '') + ' · ' + (x.memo || '') + (x.note ? ' · ' + x.note : '')) + '</option>'; }).join('')
        + '</select></td>' + '<td class="r" data-k="diff">' + (diff == null ? '' : esc(C.fmt(diff))) + '</td>'
        + '<td class="nw" data-k="st"><span class="pill ' + (kind === 'exact' ? 'st-confirmed' : kind === 'near' ? 'st-draft' : '') + '">' + esc(KIND_KO[kind]) + '</span></td></tr>';
    });
    return h + '</tbody></table></div><div class="bar"><span class="hint">고른 줄의 «찾은 입금»을 통장 실입금으로 저장하고 다시 계산합니다.</span><span class="sp"></span>'
      + '<button class="pri" id="dep_apply">고른 줄 저장</button></div></details>';
  }

  /* ── ⓪ 계산기 — 컨설팅 종류 · 사업장 · 수행자 · 요율을 고르면 그 사업장 하나만 계산한다(저장 없음) ──
     대표 지시 2026-10-31 「컨설팅종류, 사업장 수행자 요율 등 각각 선택하게 하고 그부분만 반영하게 간단하게 해라. 카톡문구는 별도로」.
     st  = {type, siteId, rows:[{sid, role:'lead'|'staff', pre, rate, actual}]}
     opt = {bizList:[{code,name}], sites:[{consultingId,label}](그 종류·2026), staff:[{sid,name}](재직자), names, sel:{i:1}} */
  var RATES = [10, 15, 20, 25, 30, 35, 40, 50];
  function calcBox(st, opt) {
    st = st || {}; opt = opt || {};
    var rows = st.rows || [], sel = opt.sel || {};
    var h = '<div class="card"><div class="bar"><b>🧮 계산기</b><span class="hint">고른 사업장 하나만 계산합니다 — 저장하지 않습니다</span><span class="sp"></span><button class="sm" id="c_reset">새로</button></div>'
      + '<div class="bar"><label class="hint" for="c_type">컨설팅 종류</label><select id="c_type"><option value="">— 고르기 —</option>'
      + (opt.bizList || []).map(function (b) { return '<option value="' + esc(b.code) + '"' + (b.code === st.type ? ' selected' : '') + '>' + esc(b.name) + '</option>'; }).join('') + '</select>'
      + '<label class="hint" for="c_site">사업장</label><select id="c_site"><option value="">— 사업장 —</option>'
      + (opt.sites || []).map(function (s) { return '<option value="' + esc(s.consultingId) + '"' + (s.consultingId === st.siteId ? ' selected' : '') + '>' + esc(s.label) + '</option>'; }).join('') + '</select></div>'
      + '<datalist id="c_rates">' + RATES.map(function (r) { return '<option value="' + r + '">'; }).join('') + '</datalist>'
      + '<div class="bulk" data-bulk="calc"></div><div class="scroll"><table class="t" data-name="calc"><thead><tr>' + ckHead('calc', rows.length > 0 && rows.every(function (r, i) { return sel[i]; }))
      + '<th>수행자</th><th>구분</th><th>세율</th><th class="r">세전</th><th class="r">요율(%)</th><th class="r">통장 실입금</th><th></th></tr></thead><tbody>';
    rows.forEach(function (r, i) {
      h += '<tr>' + ckCell(String(i), sel[i]) + '<td class="n">' + (i + 1) + '</td>'
        + '<td data-k="who"><select data-c="' + i + '|sid">' + staffOpts(opt.staff, opt.names, r.sid, '— 수행자 —') + '</select></td>'
        + '<td data-k="role"><select data-c="' + i + '|role"><option value="lead"' + (r.role === 'lead' ? ' selected' : '') + '>주관</option><option value="staff"' + (r.role !== 'lead' ? ' selected' : '') + '>담당</option></select></td>'
        + '<td data-k="tax">' + taxSel('data-c="' + i + '|tax"', r.tax) + '</td>'
        + '<td class="r" data-k="pre"><input type="text" inputmode="numeric" class="amt" data-c="' + i + '|pre" value="' + esc(r.pre || '') + '" placeholder="비우면 역계산"></td>'
        + '<td class="r" data-k="rate">' + (r.role === 'lead' ? '<span class="hint">—</span>' : '<input type="text" inputmode="decimal" class="pct" list="c_rates" data-c="' + i + '|rate" value="' + esc(r.rate == null ? '' : r.rate) + '" placeholder="%">') + '</td>'
        + '<td class="r" data-k="act"><input type="text" inputmode="numeric" class="amt" data-c="' + i + '|actual" value="' + esc(r.actual || '') + '" placeholder="선택"></td>'
        + '<td data-k="btn"><button class="sm" data-c-del="' + i + '" title="이 줄 빼기">빼기</button></td></tr>';
    });
    return h + '</tbody></table></div><div class="bar"><button class="sm" id="c_add">+ 수행자</button><span class="hint">요율은 담당만 — 주관은 나머지를 받는다. 통장 실입금을 넣으면 그 금액으로 계산하고, 세전을 비우면 실입금에서 거꾸로 계산</span></div></div>';
  }
  /* 계산 결과 — 보기 전용(고르기 칸 없음) */
  function calcResult(res, names) {
    res = res || {}; names = names || {};
    if (!res.members || !res.members.length) return '';
    var nm = function (m) { return (m.sid && names[m.sid]) || m.name || '(이름 없음)'; };
    var h = '<div class="card"><div class="kpis">'
      + '<div class="kpi"><span>사업장 세후 합계</span><b>' + won(res.totalNet) + '원</b></div>'
      + '<div class="kpi"><span>담당 몫 합계</span><b>' + won(res.members.reduce(function (s, m) { return s + (m.share || 0); }, 0)) + '원</b></div>'
      + '<div class="kpi"><span>송금</span><b>' + (res.transfers || []).length + '건</b></div>'
      + '<div class="kpi' + (res.issues.length ? ' bad' : '') + '"><span>확인 필요</span><b>' + res.issues.length + '건</b></div></div>';
    if (res.issues.length) h += '<div class="warn">' + res.issues.map(esc).join(' · ') + '</div>';
    h += '<div class="scroll"><table class="t" data-name="calcout"><thead><tr><th>이름</th><th>구분</th><th class="r">세전</th><th class="r">원천징수</th><th class="r">세후</th><th class="r">요율</th><th class="r">몫</th><th class="r">정산액</th><th class="r">최종</th></tr></thead><tbody>';
    res.members.forEach(function (m) {
      h += '<tr>' + nw('name', nm(m), 'ti') + nw('role', ROLE_KO[m.role]) + num('pre', m.pre) + whtCell(m) + num('net', m.used)
        + '<td class="r" data-k="rate">' + (m.rate == null ? '' : esc(m.rate) + '%') + '</td>'
        + (m.role === 'lead' ? '<td class="r" data-k="share"></td>' : num('share', m.share)) + '<td class="r b" data-k="settle">' + esc(won(m.settle)) + '</td>' + num('final', m.final) + '</tr>';
    });
    h += '</tbody></table></div>';
    if ((res.transfers || []).length) h += '<div class="sec">정산</div><div class="bar tr-list">'
      + res.transfers.map(function (t) { return '<span>' + esc(t.from) + ' → ' + esc(t.to) + '  <b>' + esc(C.fmt(t.amount)) + '원</b> <span class="pill dir-' + t.dir + '">' + C.DIR_KO[t.dir] + '</span></span>'; }).join('')
      + '<span class="hint">반환 = 담당이 몫보다 더 받아 주관에게 돌려줌 · 추가 지급 = 주관이 더 받아 담당에게 더 줌</span></div>';
    return h + '</div>';
  }

  /* ── ⓪-1 실수령액 → 세전 역계산(대표 지시 2026-10-31 「실수령액만 알고 있어서 세전금액을 판단하기 어려운 경우 … 3.3 8.8 퍼로 역계산」) ──
     st = {net, tax}. 입력칸은 revBox 가 한 번 그리고, 글을 칠 때는 revResult 만 다시 그린다 */
  function revBox(st) {
    st = st || {};
    return '<div class="card"><div class="bar"><b>↩️ 실수령액 → 세전</b><span class="hint">통장에 들어온 금액만 알 때 세전을 거꾸로 계산합니다</span></div>'
      + '<div class="bar"><label class="hint" for="r_net">실수령액</label><input type="text" inputmode="numeric" class="amt" id="r_net" value="' + esc(st.net || '') + '" placeholder="예: 6,759,330">'
      + '<label class="hint" for="r_tax">세율</label>' + taxSel('id="r_tax"', st.tax) + '</div><div id="revOut">' + revResult(st) + '</div></div>';
  }
  function revResult(st) {
    st = st || {};
    if (!(C.won(st.net) > 0)) return '<div class="bar"><span class="hint">3.3% 사업소득: 소득세 3% + 지방소득세 0.3% · 8.8% 기타소득: 필요경비 60% 뺀 40%에 22%(세전 12만 5천 원 이하는 0)</span></div>';
    var r = C.preFromNet(st.net, st.tax);
    return '<div class="kpis">'
      + '<div class="kpi"><span>세전(' + esc(C.TAX_KO[C.taxOf(st.tax)]) + ')</span><b>' + won(r.pre) + '원</b></div>'
      + '<div class="kpi"><span>소득세</span><b>' + won(r.inc) + '원</b></div>'
      + '<div class="kpi"><span>지방소득세</span><b>' + won(r.loc) + '원</b></div>'
      + '<div class="kpi' + (r.exact ? '' : ' bad') + '"><span>' + (r.exact ? '검산 — 세후' : '딱 맞는 세전 없음 — 가장 가까운 세후') + '</span><b>' + won(r.net) + '원</b></div></div>';
  }

  /* ── ①-2 연간 합계 — 고른 해의 정산표에서 담당마다 반환·추가 지급(대표 지시 2026-10-31 「매년 관리할 수 있게」) ──
     sum = C.yearSummary 결과. 보기 전용 요약(고르기 칸 없음 — 저장소 규칙의 «요약 숫자» 예외) */
  function yearBox(sum, names) {
    sum = sum || { counts: {}, people: [], leads: {} }; names = names || {};
    var c = sum.counts || {}, h = '<div class="sec">' + esc(sum.year) + '년 합계</div>'
      + '<div class="bar"><span class="hint">정산표 ' + (c.runs || 0) + ' — 임시저장 ' + (c.draft || 0) + ' · 확정 ' + (c.confirmed || 0) + ' · 기록만 ' + (c.manual || 0) + '</span></div>';
    if (!sum.people.length) return h + '<div class="empty">이 해에 주고받을 금액이 없습니다.</div>';
    h += '<div class="scroll"><table class="t" data-name="year"><thead><tr><th>담당</th><th class="r">반환</th><th class="r">추가 지급</th><th class="r">차감</th></tr></thead><tbody>';
    sum.people.forEach(function (p) {
      var net = p.more - p.back;
      h += '<tr>' + nw('name', nameOf(names, p.sid, p.name), 'ti') + num('back', p.back || null) + num('more', p.more || null)
        + '<td class="r b" data-k="sum">' + esc(net > 0 ? '받을 ' + C.fmt(net) : net < 0 ? '보낼 ' + C.fmt(-net) : '0') + '</td></tr>';
    });
    Object.keys(sum.leads).forEach(function (sid) {
      var v = sum.leads[sid];
      h += '<tr class="grp"><td colspan="3" title="주관 순액">주관 ' + esc(nameOf(names, sid)) + ' — 순액</td><td class="r">' + esc(v > 0 ? '받을 ' + C.fmt(v) : v < 0 ? '보낼 ' + C.fmt(-v) : '0') + '</td></tr>';
    });
    return h + '</tbody></table></div>';
  }

  /* ── ⑤ 카톡 문구 ── */
  /* opt.preview — 확정 전 정산표: 문구는 보여 주되 복사 단추 대신 안내(금액이 바뀔 수 있다) */
  function messagesBox(msgs, opt) {
    opt = opt || {};
    if (!(msgs || []).length) return '<div class="empty">보낼 문구가 없습니다 — 담당노무사 정산이 있는 정산표를 고르세요.</div>';
    return (opt.preview ? '<div class="warn">확정 전 미리보기입니다 — 금액이 바뀔 수 있어 복사는 정산표를 «확정»한 뒤에 됩니다.</div>' : '')
      + '<div class="cards">' + msgs.map(function (m, i) {
      return '<div class="card cardp"><div class="bar"><b>' + esc(m.name) + '</b><span class="sp"></span>'
        + (opt.preview ? '<span class="hint">확정하면 복사</span>' : '<button class="sm pri" data-copy="' + i + '">복사</button>') + '</div>'
        + '<textarea readonly rows="' + Math.min(30, String(m.text).split('\n').length + 1) + '" data-msg="' + i + '">' + esc(m.text) + '</textarea></div>';
    }).join('') + '</div>';
  }

  return { STATUS_KO: STATUS_KO, esc: esc, calcBox: calcBox, calcResult: calcResult, revBox: revBox, revResult: revResult, yearBox: yearBox, runsTable: runsTable, manualBox: manualBox, runDetail: runDetail, depositBox: depositBox, noticesTable: noticesTable, linkBox: linkBox,
    rateMatrix: rateMatrix, ruleDetails: ruleDetails, adjustsTable: adjustsTable, messagesBox: messagesBox };
});
