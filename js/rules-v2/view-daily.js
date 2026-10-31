/* 취업규칙(새) — 「🤖 매일 정리」 그리기 (설계 §14-4 · 2026-10-31 목업 「추천대로」)
   📥 모은 자료의 네 번째 보기. 그리는 것만 한다 — 셈은 lib-daily.js(PuRulesDaily, 서버와 같은 판정), 저장은 rules-v2.html 의 손잡이가 store.js 로.
   ★ 지키는 것
     · 오늘 숫자·«확정했을 것»은 화면이 «지금 자료로» 다시 셈한다(서버 기록을 기다리지 않는다). 지난 날은 서버 기록(auto/log)에서.
     · 맨 왼쪽 ☐ + 보이는 차례 번호. 표의 칸은 한 줄 — 넘치면 … 이고 title 에 전문.
     · 자동 확정 줄에만 「되돌리기」. 확인이 필요한 줄은 「이 회사 맞음…」(사람이 고른다).
     · 스위치는 관리자에게만 보인다(규칙도 관리자·위임관리인만 쓰게 막는다).
     · 이름·파일·회사는 걸러(esc) 넣는다. 메일 주소는 그리지 않는다. */
(function (root) {
  'use strict';
  function D() { return root.PuRulesDaily; }
  function OR() { return root.PuRulesV2Order; }
  function TD() { return root.PuRulesV2Tidy; }
  function LB() { return root.PuRulesV2Lib; }
  function esc(v) { return LB().esc(v); }
  var KST = 9 * 3600e3, DAY = 864e5;
  var MODE_LABEL = { dry: '시범 운행 — 확정은 아직 안 씀', live: '켜짐 — 매일 자동 확정', off: '꺼짐' };
  var STATE_LABEL = { auto: '자동 확정', human: '사람 확정', none: '사업장 없음', would: '시범: 확정했을 것', soon: '다음 정리 때 확정', need: '확인 필요' };

  function ensure(st) {
    if (!st.daily) st.daily = { span: 'today', who: '', picked: new Set() };
    return st.daily;
  }
  function now(st) { return typeof st.now === 'function' ? st.now() : Date.now(); }
  function hm(ms) { var d = new Date(Number(ms || 0) + KST).toISOString(); return (+d.slice(5, 7)) + '/' + (+d.slice(8, 10)) + ' ' + d.slice(11, 16); }
  function coName(st, id) {
    var c = (st.companies || []).filter(function (x) { return String(x.id) === String(id); })[0];
    return c ? String(c.name || c.id) : '(지운 업체)';
  }
  function coById(st) { var m = {}; (st.companies || []).forEach(function (c) { if (c && c.id != null) m[String(c.id)] = c; }); return m; }
  function sidKey(x) { return String(x || '').trim().toUpperCase().replace(/^([A-Z])-?(\d+)$/, '$1-$2'); }
  function nameOf(st) { return function (sid) { return (st.staff || {})[sidKey(sid)] || ''; }; }
  function myName(st) { return (st.staff || {})[sidKey(st.me)] || ''; }
  function auto(st) { return (st.data && st.data.auto) || {}; }

  /* 표에 놓을 줄 — 기간(오늘·7일) 안에 담은 서류(기타 빼고)에 처리 담당·정리 상태를 붙인다 */
  function model(st) {
    var t = ensure(st), data = st.data || {}, A = auto(st), mode = D().modeOf(A.cfg);
    var t0 = now(st), today = D().dayKey(t0);
    var plan = D().plan(data, st.companies);
    var planned = {};
    plan.link.forEach(function (x) { planned[x.docId] = x; });
    var cos = coById(st), nm = nameOf(st);
    var all = OR().merge(data.docs, data.human).filter(function (it) {
      if (it.kind === '기타') return false;
      var c = Number(it.doc.createdAt || 0);
      return t.span === 'week' ? c > t0 - 7 * DAY : D().dayKey(c) === today;
    }).sort(function (a, b) { return (Number(b.doc.createdAt) || 0) - (Number(a.doc.createdAt) || 0) || (a.id < b.id ? -1 : 1); });
    var rows = all.map(function (it) {
      var h = it.h || {}, st2 = 'need', co = '', why = '';
      if (h.companyLinkStatus === 'linked' && h.companyId) {
        co = String(h.companyId);
        if (h.linkedBy === D().AUTO_BY) { st2 = 'auto'; why = (h.auto && h.auto.why) || ''; }
        else { st2 = 'human'; why = [nm(h.linkedBy) || h.linkedBy, h.linkedAt ? hm(h.linkedAt).split(' ')[0] : ''].filter(Boolean).join(' '); }
      } else if (h.companyLinkStatus === 'not_required') st2 = 'none';
      else if (planned[it.id]) { st2 = mode === 'live' ? 'soon' : 'would'; co = planned[it.id].companyId; why = planned[it.id].why; }
      else {
        var cand = (it.doc.companyCand || []).filter(function (c) { return c && c.companyId; });
        why = cand.length > 1 ? '후보 ' + cand.length : cand.length ? (cand[0].why === '주소' ? '주소 일치 — 묶음 확인' : '도메인만') : '단서 없음';
        if (h.noAuto) why = '되돌림 — 사람이 정함';
      }
      var ow = D().ownerOf(it.doc, h, cos, nm);
      return { it: it, state: st2, co: co, why: why, owner: ow };
    });
    var who = t.who, me = myName(st);
    var byWho = {}, noOwner = 0, mine = 0;
    rows.forEach(function (r) {
      if (!r.owner.who) noOwner++; else byWho[r.owner.who] = (byWho[r.owner.who] || 0) + 1;
      if (me && r.owner.who === me) mine++;
    });
    var shown = rows.filter(function (r) {
      if (!who) return true;
      if (who === '@me') return !!me && r.owner.who === me;
      if (who === '@none') return !r.owner.who;
      return r.owner.who === who;
    });
    var s = D().summary(data, st.companies, { now: t0, mode: mode, plan: mode === 'live' ? { link: [], more: 0 } : plan, nameOf: nm });
    var logs = Object.keys(A.log || {}).sort().reverse().filter(function (k) { return k !== today; }).slice(0, 6).map(function (k) { return A.log[k]; });
    return { mode: mode, last: A.last || null, unreadable: !!A.unreadable, today: today, s: s, plan: plan, rows: rows, shown: shown,
      byWho: byWho, noOwner: noOwner, mine: mine, me: me, logs: logs };
  }

  function kpi(cls, n, label) { return '<div class="dkpi' + (cls ? ' ' + cls : '') + '" title="' + esc(label + ' ' + n) + '"><b>' + esc(n) + '</b><span>' + esc(label) + '</span></div>'; }
  function logLine(L) {
    if (!L) return '';
    var who = Object.keys(L.byOwner || {}).map(function (k) { return k + ' ' + L.byOwner[k]; }).join(' · ');
    var txt = L.date.slice(5).replace('-', '/') + ' · 새 메일 ' + (L.mails || 0) + '통 · 서류 ' + (L.docs || 0) + '건'
      + (L.mode === 'live' ? ' · 자동 확정 ' + (L.linked || 0) : ' · (시범) 했을 것 ' + (L.would || 0))
      + ' · 확인 필요 ' + (L.need || 0) + ' · 담당 못 정함 ' + (L.noOwner || 0) + (who ? ' · ' + who : '');
    return '<div class="dlog" title="' + esc(txt) + '">' + esc(txt) + '</div>';
  }
  function panelHtml(st, M) {
    var t = ensure(st), s = M.s;
    var last = M.last && M.last.at ? '마지막 정리 ' + hm(M.last.at) : '서버가 아직 안 돌았습니다';
    var sw = '';
    if (st.isAdmin) {
      sw = '<span class="dsw" title="사업장 자동 확정 스위치 — 관리자만">'
        + ['dry', 'live', 'off'].map(function (m) {
          return '<button data-act="dailyMode" data-m="' + m + '" class="' + (M.mode === m ? 'on' : '') + '">' + ({ dry: '시범', live: '켜기', off: '끄기' })[m] + '</button>';
        }).join('') + '</span>';
    }
    var head = '<div class="dh"><b>🤖 매일 정리</b><span class="dmode ' + M.mode + '">' + esc(MODE_LABEL[M.mode]) + '</span>'
      + '<span class="why" title="' + esc(last) + '">' + esc(last) + '</span>' + sw + '</div>';
    var warn = M.unreadable ? '<div class="dwarn">서버 기록·스위치를 못 읽었습니다 — 보안규칙 게시 전일 수 있습니다(아래 숫자는 화면이 지금 자료로 셈한 것입니다)</div>' : '';
    var kpis = '<div class="dkpis">' + kpi('', s.mails + '통', '오늘 새 메일') + kpi('', s.docs + '건', '오늘 담은 서류')
      + (M.mode === 'live' ? kpi('ok', s.linked, '오늘 자동 확정') : kpi('ok', s.would, '자동 확정했을 것(시범)'))
      + kpi('w', s.need, '사람 확인 필요') + kpi('m', s.noOwner, '담당 못 정함(오늘)') + '</div>';
    function chip(v, label, n) {
      return '<button class="chip' + (t.who === v ? ' on' : '') + '" data-act="dailyWho" data-v="' + esc(v) + '">' + esc(label) + ' <b>' + n + '</b></button>';
    }
    var chips = '<div class="dwho"><span class="why">처리 담당</span>' + chip('', '모두', M.rows.length)
      + (M.me ? chip('@me', '내 것', M.mine) : '')
      + Object.keys(M.byWho).sort(function (a, b) { return M.byWho[b] - M.byWho[a] || (a < b ? -1 : 1); }).map(function (w) { return chip(w, w, M.byWho[w]); }).join('')
      + (M.noOwner ? chip('@none', '못 정함', M.noOwner) : '') + '</div>';
    return '<div class="dpanel">' + head + warn + kpis + chips + (M.logs.length ? '<div class="dlogs">' + M.logs.map(logLine).join('') + '</div>' : '') + '</div>';
  }

  function td(cls, title, html) { return '<td' + (cls ? ' class="' + cls + '"' : '') + ' title="' + esc(title) + '">' + html + '</td>'; }
  function siteCell(st, r) {
    if (r.co) {
      var nm = coName(st, r.co) + (r.state === 'would' || r.state === 'soon' ? '?' : '');
      return td('co', nm, '🏢 ' + esc(nm));
    }
    if (r.state === 'none') return td('co', '사업장 없음', '<span class="why">사업장 없음</span>');
    var cand = (r.it.doc.companyCand || []).filter(function (c) { return c && c.companyId; }).map(function (c) { return coName(st, c.companyId); });
    var t = cand.length ? '후보: ' + cand.join(' · ') : '후보 없음';
    return td('co', t, '<span class="why">' + esc(t) + '</span>');
  }
  function ownerCell(r) {
    var o = r.owner;
    if (!o.who) return td('who', '처리 담당을 정하지 못했습니다', '<span class="dchip no">못 정함</span>');
    var src = o.why === 'mail' ? '메일함 담당' : '업체 주담당';
    return td('who', o.who + ' · ' + src, '<span class="dchip">' + esc(o.who) + '</span><span class="why">' + esc(src) + '</span>');
  }
  function stateCell(r) {
    var label = STATE_LABEL[r.state];
    return td('st', label + (r.why ? ' · ' + r.why : ''), '<span class="dst ' + r.state + '">' + esc(label) + '</span>' + (r.why ? '<span class="why">' + esc(r.why) + '</span>' : ''));
  }
  function actCell(r) {
    if (r.state === 'auto') return '<td class="act"><button class="btn sm" data-act="dailyUndo" data-id="' + esc(r.it.id) + '" title="미확정으로 돌리고, 이 주소는 다시 자동 확정하지 않습니다">되돌리기</button></td>';
    if (r.state === 'human' || r.state === 'none') return '<td class="act"></td>';
    return '<td class="act"><button class="btn sm g" data-act="linkMail" data-ids="' + esc(r.it.id) + '">이 회사 맞음…</button></td>';
  }
  function tableHtml(st, M) {
    var t = ensure(st);
    var vis = {}; M.shown.forEach(function (r) { vis[r.it.id] = 1; });
    t.picked.forEach(function (id) { if (!vis[id]) t.picked.delete(id); });   // 걸러져 안 보이는 줄은 고른 것에서 뺀다
    var spans = '<div class="dspan"><button class="chip' + (t.span === 'today' ? ' on' : '') + '" data-act="dailySpan" data-v="today">오늘</button>'
      + '<button class="chip' + (t.span === 'week' ? ' on' : '') + '" data-act="dailySpan" data-v="week">최근 7일</button>'
      + '<button class="btn sm" data-act="reload" title="다시 읽기">↻</button></div>';
    var n = t.picked.size;
    var nAuto = M.shown.filter(function (r) { return t.picked.has(r.it.id) && r.state === 'auto'; }).length;
    var nOpen = M.shown.filter(function (r) { return t.picked.has(r.it.id) && r.state !== 'auto' && r.state !== 'human' && r.state !== 'none'; }).length;
    var bar = n ? '<div class="dbar"><b>' + n + '건 선택</b>'
      + (nAuto ? '<button class="btn sm" data-act="dailyUndoPicked">자동 확정 ' + nAuto + '건 되돌리기</button>' : '')
      + (nOpen ? '<button class="btn sm g" data-act="dailyLinkPicked">' + nOpen + '건 사업장 확정…</button>' : '')
      + '<button class="lnk" data-act="dailyUnpick">고르기 풀기</button></div>' : '';
    var allOn = M.shown.length > 0 && M.shown.every(function (r) { return t.picked.has(r.it.id); });
    var body = M.shown.map(function (r, i) {
      var on = t.picked.has(r.it.id), it = r.it;
      var file = it.name + ' · ' + (it.kind || '');
      return '<tr data-drow="' + esc(it.id) + '"' + (on ? ' class="ck"' : '') + '>'
        + '<td class="c"><input type="checkbox" data-dpick="' + esc(it.id) + '"' + (on ? ' checked' : '') + '></td>'
        + '<td class="no">' + (i + 1) + '</td>'
        + td('dt', hm(it.doc.createdAt), esc(hm(it.doc.createdAt)))
        + siteCell(st, r)
        + td('file', file, '<button class="lnk" data-act="sel" data-id="' + esc(it.id) + '">' + esc(file) + '</button>')
        + ownerCell(r) + stateCell(r) + actCell(r) + '</tr>';
    }).join('');
    if (!body) body = '<tr><td colspan="8" class="empty" title="">' + (t.span === 'today' ? '오늘 담은 서류가 없습니다 — 「최근 7일」로 넓혀 보세요' : '이 기간에 담은 서류가 없습니다') + '</td></tr>';
    return spans + bar + '<table class="lib dly"><colgroup><col style="width:34px"><col style="width:40px"><col style="width:96px"><col style="width:20%"><col><col style="width:150px"><col style="width:180px"><col style="width:124px"></colgroup>'
      + '<thead><tr><th class="c"><input type="checkbox" data-act="dpickAll" title="보이는 줄 모두 고르기"' + (allOn ? ' checked' : '') + '></th><th class="c">№</th><th>담은 때</th><th>사업장</th><th>서류</th><th>처리 담당</th><th>정리</th><th></th></tr></thead>'
      + '<tbody>' + body + '</tbody></table>';
  }

  function html(st) {
    var M = model(st);
    return '<div class="daily">' + panelHtml(st, M) + tableHtml(st, M) + '</div>';
  }

  var api = { ensure: ensure, model: model, html: html, panelHtml: panelHtml, tableHtml: tableHtml, MODE_LABEL: MODE_LABEL, STATE_LABEL: STATE_LABEL };
  if (root) root.PuRulesV2DailyView = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
