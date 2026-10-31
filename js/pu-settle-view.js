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

  var STATUS_KO = { draft: '계산만', confirmed: '확정', manual: '기록만' };
  var ROLE_KO = { lead: '주관', staff: '담당' };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function won(n) { return n == null ? '—' : C.fmt(n); }
  function kst(ms) { return ms ? new Date(Number(ms) + 9 * 3600e3).toISOString().slice(5, 16).replace('T', ' ') : ''; }
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

  /* ── ① 지급월 정산표 목록 ── */
  function runsTable(runs, sel, bizNames) {
    sel = sel || {}; bizNames = bizNames || {};
    var list = (runs || []).filter(function (r) { return r && !r._deleted; })
      .sort(function (a, b) { return a.monthKey < b.monthKey ? 1 : a.monthKey > b.monthKey ? -1 : (a.typeCode < b.typeCode ? -1 : 1); });
    if (!list.length) return '<div class="empty">아직 정산표가 없습니다. «📥 안내 파일»에서 비용지급 안내를 올려 주세요.</div>';
    var allOn = list.every(function (r) { return sel[r.id]; });
    var h = '<div class="bulk" data-bulk="runs"></div><div class="scroll"><table class="t" data-name="runs"><thead><tr>' + ckHead('runs', allOn)
      + '<th>지급월</th><th>사업</th><th class="r">사업장</th><th>상태</th><th class="r">송금 남음</th></tr></thead><tbody>';
    list.forEach(function (r, i) {
      var tr = r.transfers || [], left = tr.filter(function (t) { return !t.paid; }).length;
      h += '<tr data-id="' + esc(r.id) + '">' + ckCell(r.id, sel[r.id]) + '<td class="n">' + (i + 1) + '</td>'
        + '<td class="ti"><a href="#" data-run="' + esc(r.id) + '" title="' + esc(r.label) + '">' + esc(r.label || r.monthKey) + '</a></td>'
        + nw('biz', bizNames[r.typeCode] || r.typeCode)
        + '<td class="r" data-k="cnt">' + (r.sites || []).length + '</td>'
        + '<td class="nw" data-k="st"><span class="pill st-' + esc(r.status) + '">' + esc(STATUS_KO[r.status] || r.status) + '</span>' + (r.changed ? ' <span class="pill st-chg">바뀜</span>' : '') + '</td>'
        + '<td class="r" data-k="left">' + (r.status === 'confirmed' ? left + ' / ' + tr.length : '—') + '</td></tr>';
    });
    return h + '</tbody></table></div>';
  }

  /* ── ② 정산표 한 장 ── */
  function runDetail(run, names, sel) {
    sel = sel || {};
    var iss = issuesOf(run), ok = C.checkRun(run.sites || [], run.issues || []).ok, draft = run.status === 'draft';
    var T = 0, shares = 0, tr = run.transfers || [], trSum = 0;
    (run.sites || []).forEach(function (s) { T += s.totalNet; s.members.forEach(function (m) { if (m.role === 'staff' && m.share != null) shares += m.share; }); });
    tr.forEach(function (t) { trSum += t.amount; });
    var h = '<div class="kpis">'
      + '<div class="kpi"><span>세후 합계</span><b>' + won(T) + '원</b></div>'
      + '<div class="kpi"><span>담당 몫 합계</span><b>' + won(shares) + '원</b></div>'
      + '<div class="kpi"><span>송금</span><b>' + tr.length + '건 · ' + won(trSum) + '원</b></div>'
      + '<div class="kpi' + (iss.length ? ' bad' : '') + '"><span>확인 필요</span><b>' + iss.length + '건</b></div></div>';
    h += '<div class="bar"><b>' + esc(run.label || run.monthKey) + '</b> <span class="pill st-' + esc(run.status) + '">' + esc(STATUS_KO[run.status] || run.status) + '</span><span class="sp"></span>';
    if (draft) h += '<button class="sm" data-act="recalc">다시 계산</button><button class="sm" data-act="manual" title="이미 손으로 정산을 끝낸 달 — 기록만 남기고 카톡은 보내지 않는다">기록만</button>'
      + '<button class="sm pri" data-act="confirm"' + (ok ? '' : ' disabled title="확인 필요를 먼저 풀어 주세요"') + '>확정</button>';
    else h += '<button class="sm" data-act="unconfirm">' + (run.status === 'manual' ? '기록만 풀기' : '확정 풀기') + '</button><button class="sm" data-act="xlsx">엑셀</button>'
      + (run.status === 'confirmed' ? '<button class="sm pri" data-act="msgs">카톡 문구</button>' : '');
    h += '</div>';
    if (run.changed) h += '<div class="warn">새 안내 파일에서 이 달 금액이 바뀌었습니다 — 확정을 풀고 다시 계산하세요.</div>';
    if (iss.length) h += '<div class="warn">' + iss.map(esc).join(' · ') + '</div>';
    var rows = [], idx = 0;
    (run.sites || []).forEach(function (s, si) {
      rows.push('<tr class="grp"><td colspan="15" title="' + esc(s.company) + '">' + esc(s.company) + ' · ' + s.round + '차 · 세후 합계 ' + won(s.totalNet) + '원' + (s.issues.length ? ' · <span class="bad">확인 필요 ' + s.issues.length + '</span>' : '') + '</td></tr>');
      s.members.forEach(function (m, mi) {
        var id = si + ':' + mi, key = s.consultingId + '|' + m.sid;
        idx++;
        rows.push('<tr>' + ckCell(id, sel[id]) + '<td class="n">' + idx + '</td>'
          + nw('site', s.company) + nw('role', ROLE_KO[m.role] || m.role) + nw('name', nameOf(names, m.sid, m.name), 'ti')
          + num('pre', m.pre) + num('wht', m.inc + m.loc) + num('net', m.net)
          + '<td class="r" data-k="act">' + (draft && s.consultingId && m.sid
            ? '<input type="text" inputmode="numeric" class="amt" data-actual="' + esc(key) + '" value="' + (m.actual == null ? '' : esc(C.fmt(m.actual))) + '" placeholder="통장 입금">'
            : esc(m.actual == null ? '' : won(m.actual))) + '</td>'
          + '<td class="r" data-k="rate">' + (m.rate == null ? '' : esc(m.rate) + '%') + '</td>'
          + num('share', m.share) + num('diff', m.diff) + '<td class="r" data-k="adj">' + (m.adjust ? esc(won(m.adjust)) : '') + '</td>'
          + '<td class="r b" data-k="settle">' + esc(won(m.settle)) + '</td>' + num('final', m.final) + '</tr>');
      });
    });
    h += '<div class="bulk" data-bulk="members"></div><div class="scroll"><table class="t" data-name="run"><thead><tr>' + ckHead('members', false)
      + '<th>사업장</th><th>구분</th><th>이름</th><th class="r">세전</th><th class="r">원천징수</th><th class="r">세후</th><th class="r">통장 실입금</th><th class="r">요율</th><th class="r">몫</th><th class="r">차액</th><th class="r">조정</th><th class="r">정산액</th><th class="r">최종</th></tr></thead><tbody>'
      + rows.join('') + '</tbody></table></div>';
    h += '<div class="sec">송금 목록</div>';
    if (!tr.length) return h + '<div class="empty">주고받을 금액이 없습니다.</div>';
    h += '<div class="bulk" data-bulk="transfers"></div><div class="scroll"><table class="t" data-name="transfers"><thead><tr>' + ckHead('transfers', false)
      + '<th>사업장</th><th>보내는 사람</th><th>받는 사람</th><th class="r">금액</th><th>보냄</th><th>보낸 때</th></tr></thead><tbody>';
    tr.forEach(function (t, i) {
      h += '<tr>' + ckCell('t' + i, sel['t' + i]) + '<td class="n">' + (i + 1) + '</td>' + nw('site', t.company) + nw('from', nameOf(names, t.fromSid), 'ti') + nw('to', nameOf(names, t.toSid))
        + num('amt', t.amount)
        + '<td data-k="paid"><label class="ck"><input type="checkbox" data-paid="' + i + '"' + (t.paid ? ' checked' : '') + (run.status === 'confirmed' ? '' : ' disabled') + '> 보냄</label></td>'
        + '<td class="nw" data-k="at">' + esc(t.paid ? kst(t.paidAt) : '') + '</td></tr>';
    });
    return h + '</tbody></table></div>';
  }

  /* ── ③ 안내 파일 ── */
  function noticesTable(notices, sel) {
    sel = sel || {};
    var list = (notices || []).filter(function (n) { return n && !n._deleted; }).sort(function (a, b) { return (b.receivedAt || 0) - (a.receivedAt || 0); });
    if (!list.length) return '<div class="empty">올린 안내 파일이 없습니다.</div>';
    var allOn = list.every(function (n) { return sel[n.id]; });
    var h = '<div class="bulk" data-bulk="notices"></div><div class="scroll"><table class="t" data-name="notices"><thead><tr>' + ckHead('notices', allOn)
      + '<th>파일</th><th>받은 때</th><th>지급월</th><th class="r">줄</th><th>출처</th><th></th></tr></thead><tbody>';
    list.forEach(function (n, i) {
      var months = (n.months || []).map(function (m) { return m.label; }).join(' · ');
      h += '<tr>' + ckCell(n.id, sel[n.id]) + '<td class="n">' + (i + 1) + '</td>' + nw('file', n.fileName, 'ti') + '<td class="nw" data-k="at">' + esc(kst(n.receivedAt)) + '</td>'
        + nw('months', months) + '<td class="r" data-k="rows">' + (n.rows || []).length + '</td>' + nw('src', n.source === 'agent' ? 'PC 심부름꾼' : '올림')
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

  /* ── ④ 규칙·요율 ── */
  function rulesBox(rule, opt) {
    opt = opt || {}; rule = rule || {};
    var people = opt.people || [], sites = opt.sites || [], biz = opt.bizTypes || [];
    function personOpts(cur) { return '<option value="">— 사람 —</option>' + people.map(function (p) { return '<option value="' + esc(p.sid) + '"' + (p.sid === cur ? ' selected' : '') + '>' + esc(p.name) + '</option>'; }).join(''); }
    function nameBy(sid) { var p = people.filter(function (x) { return x.sid === sid; })[0]; return p ? p.name : '(이름 없음)'; }
    var h = '<div class="card"><div class="sec">정산 규칙</div>'
      + '<div class="fr"><label>사업 종류</label><div class="fv"><select id="r_type"' + (opt.isNew ? '' : ' disabled') + '>' + biz.map(function (b) { return '<option value="' + esc(b.code) + '"' + (b.code === rule.typeCode ? ' selected' : '') + '>' + esc(b.name) + '</option>'; }).join('') + '</select></div></div>'
      + '<div class="fr"><label>이름</label><div class="fv"><input type="text" id="r_title" value="' + esc(rule.title || '') + '" placeholder="카톡 머리말에 쓰는 사업 이름"></div></div>'
      + '<div class="fr"><label>방식</label><div class="fv"><span class="pill">pool — 사업장 세후 합계 × 담당 요율, 차액 양방향 정산</span></div></div>'
      + '<div class="fr"><label>주관</label><div class="fv"><select id="r_lead">' + personOpts(rule.leadSid) + '</select></div></div>'
      + '<div class="fr"><label>켜짐</label><div class="fv"><label class="ck"><input type="checkbox" id="r_active"' + (rule.active !== false ? ' checked' : '') + '> 이 사업 종류는 컨설팅정산에서 개별정산한다(재무관리 성과급에서 뺀다)</label></div></div>'
      + '<div class="sec">사람별 요율 (%)</div><div class="scroll"><table class="t" data-name="rates"><thead><tr><th>이름</th><th class="r">요율</th><th></th></tr></thead><tbody>';
    Object.keys(rule.rates || {}).forEach(function (sid) {
      h += '<tr>' + nw('name', nameBy(sid), 'ti') + '<td class="r" data-k="pct"><input type="text" inputmode="decimal" class="pct" data-rate="' + esc(sid) + '" value="' + esc(rule.rates[sid]) + '"></td><td data-k="btn"><button class="sm" data-rate-del="' + esc(sid) + '">빼기</button></td></tr>';
    });
    h += '<tr><td><select id="r_addSid">' + personOpts('') + '</select></td><td class="r"><input type="text" inputmode="decimal" class="pct" id="r_addPct" placeholder="%"></td><td><button class="sm" id="r_addRate">더하기</button></td></tr></tbody></table></div>';
    h += '<div class="sec">사업장별 예외 요율</div><div class="scroll"><table class="t" data-name="siteRates"><thead><tr><th>사업장</th><th>이름</th><th class="r">요율</th><th></th></tr></thead><tbody>';
    var siteLabel = {}; sites.forEach(function (s) { siteLabel[s.consultingId] = s.label; });
    Object.keys(rule.siteRates || {}).forEach(function (cid) {
      Object.keys(rule.siteRates[cid] || {}).forEach(function (sid) {
        h += '<tr>' + nw('site', siteLabel[cid] || '(연결된 사업장)') + nw('name', nameBy(sid), 'ti') + '<td class="r" data-k="pct">' + esc(rule.siteRates[cid][sid]) + '%</td><td data-k="btn"><button class="sm" data-srate-del="' + esc(cid + '|' + sid) + '">빼기</button></td></tr>';
      });
    });
    h += '<tr><td><select id="r_sSite"><option value="">— 사업장 —</option>' + sites.map(function (s) { return '<option value="' + esc(s.consultingId) + '">' + esc(s.label) + '</option>'; }).join('') + '</select></td><td><select id="r_sSid">' + personOpts('') + '</select></td>'
      + '<td class="r"><input type="text" inputmode="decimal" class="pct" id="r_sPct" placeholder="%"></td><td><button class="sm" id="r_addSRate">더하기</button></td></tr></tbody></table></div>';
    h += '<div class="sec">카톡 문구</div>'
      + '<div class="fr"><label>머리말</label><div class="fv"><input type="text" id="r_head" value="' + esc(rule.msgHead || '') + '" placeholder="' + esc(C.DEFAULT_HEAD) + '"></div></div>'
      + '<div class="fr"><label>맺음말</label><div class="fv"><input type="text" id="r_foot" value="' + esc(rule.msgFoot || '') + '" placeholder="' + esc(C.DEFAULT_FOOT) + '"></div></div>'
      + '<div class="bar"><span class="hint">{사업} · {월} 은 저절로 바뀝니다.</span><span class="sp"></span><button class="pri" id="r_save">규칙 저장</button></div></div>';
    return h;
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
        + '<td class="r"><input type="text" inputmode="numeric" class="amt" id="a_amt" placeholder="−는 담당→주관"></td><td><input type="text" id="a_memo" placeholder="내용"></td><td></td><td><button class="sm" id="a_add">더하기</button></td></tr>';
    }
    return h + '</tbody></table></div>';
  }

  /* ── ⑤ 카톡 문구 ── */
  function messagesBox(msgs) {
    if (!(msgs || []).length) return '<div class="empty">보낼 문구가 없습니다 — 담당노무사 정산이 있는 확정 정산표를 고르세요.</div>';
    return '<div class="cards">' + msgs.map(function (m, i) {
      return '<div class="card cardp"><div class="bar"><b>' + esc(m.name) + '</b><span class="sp"></span><button class="sm pri" data-copy="' + i + '">복사</button></div>'
        + '<textarea readonly rows="' + Math.min(18, String(m.text).split('\n').length + 1) + '" data-msg="' + i + '">' + esc(m.text) + '</textarea></div>';
    }).join('') + '</div>';
  }

  return { STATUS_KO: STATUS_KO, esc: esc, runsTable: runsTable, runDetail: runDetail, noticesTable: noticesTable, linkBox: linkBox,
    rulesBox: rulesBox, adjustsTable: adjustsTable, messagesBox: messagesBox };
});
