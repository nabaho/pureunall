/* 취업규칙(새) — 「📥 모은 자료」 그리기 (설계 §4-6 · 2026-10-03 목업 2 「추천대로」)

   그리는 것만 한다 — 셈은 lib-order.js(PuRulesV2Order), 읽기·저장은 store.js(PuRulesV2Store).
   그림(DOM)이 아니라 «글»을 돌려주는 함수로 나눴다 — 검사가 그린 글을 그대로 본다.

   ★ 지키는 것
     · 표에는 가린 «셈»만 — 가린 글은 옆 칸에만(누른 한 건). 표 그리는 함수는 글을 안 받는다.
     · 표의 칸은 한 줄 — 넘치면 … 이고 title 에 전문(CSS 는 rules-v2.html 의 .lib td).
     · 보류 줄은 못 고른다 — 담긴 것이 없으니 최종본·사업장을 걸 것도 없다.
     · 업체는 이름으로 «거르고» id 로 «고른다» — 이름이 같은 두 회사를 섞지 않는다.
     · 최종본은 회차 레코드(rounds)의 finalDocId 하나뿐 — 후보는 후보라고 적는다.
     · 「지금 더 모으기」는 관리자에게만 보인다(규칙도 ask 를 관리자에게만 연다). */
(function (root) {
  'use strict';

  function O() { return root.PuRulesV2Order; }
  function KT() {
    if (root && root.PuKordocText) return root.PuKordocText;
    if (typeof require === 'function') { try { return require('../pu-kordoc-text.js'); } catch (e) { /* 화면에서는 위에서 찾는다 */ } }
    return null;
  }
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  /* 한국 시간 날짜 — 서버가 적은 메일 날짜(ms)를 그대로 */
  function ymd(ms) {
    var n = Number(ms || 0);
    if (!n) return '날짜 모름';
    return new Date(n + 9 * 3600e3).toISOString().slice(0, 10);
  }
  function md(ms) { var s = ymd(ms); return s.length === 10 ? (+s.slice(5, 7)) + '/' + (+s.slice(8, 10)) : s; }
  function roundLabel(rk) { var m = /^r(\d{4})(\d{2})$/.exec(String(rk || '')); return m ? m[1] + '.' + m[2] + ' 회차' : String(rk || ''); }

  /* 가린 셈의 이름표 — pu-kordoc-text.js 의 countLabel 을 «그대로» 쓴다(이름표가 두 벌이면 갈린다) */
  function piiLabel(count) {
    var k = KT();
    if (k && k.countLabel) return k.countLabel(count || {});
    return Object.keys(count || {}).map(function (r) { return r + ' ' + count[r]; }).join(' · ');
  }

  /* 업체 목록 — data/companies 가 {v:[…]} 이든 객체든 배열로 */
  function companyList(raw) {
    if (!raw) return [];
    var src = Array.isArray(raw) ? raw : Array.isArray(raw.v) ? raw.v
      : Object.keys(raw.v && typeof raw.v === 'object' ? raw.v : raw).map(function (k) { return (raw.v && typeof raw.v === 'object' ? raw.v : raw)[k]; });
    return src.filter(function (c) { return c && typeof c === 'object' && c.id; });
  }
  function coName(st, id) {
    var c = (st.companies || []).filter(function (x) { return x.id === id; })[0];
    return c ? String(c.name || c.id) : '';
  }

  /* ✉ 메일 열기 — 사업장이 확정됐으면 그 사업장과 오간 메일, 아니면 메일함 */
  function mailHref(companyId) {
    return companyId ? 'pu-cards.html?view=mail&mail=co&co=' + encodeURIComponent(companyId) : 'pu-cards.html?view=mail';
  }

  /* 가벼운 조 나누기 — 줄 머리의 「제N조·제N조의M」 에서 자른다(본문 속 「법 제93조」 는 안 자른다) */
  function parseArticles(text) {
    var t = String(text || '').replace(/\r\n?/g, '\n');
    var re = /^[ \t]*제\s*(\d+)\s*조(?:\s*의\s*(\d+))?/gm, m, heads = [];
    while ((m = re.exec(t))) heads.push({ at: m.index, label: '제' + m[1] + '조' + (m[2] ? '의' + m[2] : '') });
    return heads.map(function (h, i) {
      var body = t.slice(h.at, i + 1 < heads.length ? heads[i + 1].at : t.length).trim();
      var tm = /^제\s*\d+\s*조(?:\s*의\s*\d+)?\s*[(（]([^)）\n]{1,40})[)）]/.exec(body);
      return { label: h.label, title: tm ? tm[1].trim() : '', body: body };
    });
  }

  /* ── 셈 한 번 — 그리는 함수들이 같은 셈을 본다 ── */
  function model(st) {
    var d = st.data || {};
    var items = O().merge(d.docs || {}, d.human || {});
    var no = O().numberOf(items);
    var groups = O().companyGroups(items, d.rounds || {});
    var info = {};                                    // docId → { ver, total, final, cand:[…], group }
    groups.forEach(function (g) {
      g.rows.forEach(function (v) {
        info[v.item.id] = { ver: v.no, total: g.rows.length ? g.rows[g.rows.length - 1].no : 0,
          final: g.finalDocId === v.item.id, cand: g.cand[v.item.id] || [], group: g };
      });
      g.items.forEach(function (it) { if (!info[it.id]) info[it.id] = { group: g, cand: [] }; });
    });
    return { items: items, no: no, groups: groups, info: info };
  }
  function flags(it, M) {
    var i = M.info[it.id] || {};
    return { hold: it.status === '보류', final: !!i.final, cand: !!(i.cand && i.cand.length) && !i.final,
      unlinked: !it.companyId && it.h.companyLinkStatus !== 'not_required' };
  }
  var KINDS = ['규칙본문', '신구대조표', '신고서', '동의서', '의견청취', '기타'];
  var KIND_LABEL = { '규칙본문': '규칙 본문' };
  var KIND_CLS = { '규칙본문': 'rule', '신구대조표': 'cmp', '신고서': 'rep', '동의서': 'agr' };
  function passes(it, st, M) {
    var f = st.filt || {}, fl = flags(it, M);
    if (f.kind && it.kind !== f.kind) return false;
    if (f.only === 'final' && !fl.final) return false;
    if (f.only === 'cand' && !fl.cand) return false;
    if (f.only === 'unlinked' && !(fl.unlinked && !fl.hold)) return false;
    if (f.only === 'hold' && !fl.hold) return false;
    var q = String(f.q || '').trim().toLowerCase();
    if (q) {
      var hay = [it.name, (it.doc.mail || {}).subject, it.companyId ? coName(st, it.companyId) : ''].join(' ').toLowerCase();
      if (hay.indexOf(q) < 0) return false;
    }
    return true;
  }

  /* ── 맨 위 — 마지막 모으기 ── */
  function runHtml(st) {
    var M = model(st), r = (st.data || {}).run || null;
    var c = { stored: 0, held: 0, unlinked: 0, final: 0, cand: 0 };
    M.items.forEach(function (it) {
      var fl = flags(it, M);
      if (fl.hold) c.held++; else c.stored++;
      if (fl.unlinked && !fl.hold) c.unlinked++;
      if (fl.final) c.final++;
      if (fl.cand) c.cand++;
    });
    var when = r && r.at ? ymd(r.at) + ' ' + new Date(Number(r.at) + 9 * 3600e3).toISOString().slice(11, 16) : '아직 없음';
    var last = r ? '이번에 메일 ' + (r.mails || 0) + '통 · 담음 ' + (r.stored || 0) + ' · 보류 ' + (r.held || 0) + ' · 겹침 ' + (r.dup || 0) : '';
    return '<div class="run">'
      + '<span class="k" title="' + esc(last) + '">마지막 모으기 <b>' + esc(when) + '</b></span>'
      + '<span class="k">담음<span class="v g">' + c.stored + '</span></span>'
      + '<span class="k">보류<span class="v a">' + c.held + '</span></span>'
      + '<span class="k">사업장 미확정<span class="v a">' + c.unlinked + '</span></span>'
      + '<span class="k">최종본<span class="v g">' + c.final + '</span></span>'
      + '<span class="k">최종본 후보<span class="v a">' + c.cand + '</span></span>'
      + (r && r.alert ? '<span class="st hold" title="사흘 넘게 담은 것이 없고 오류가 났습니다">⚠ 모으기 멈춤</span>' : '')
      + '<span class="sp"></span>'
      + '<button class="btn" data-act="reload">새로고침</button>'
      + (st.isAdmin ? '<button class="btn" data-act="ask" title="서버가 메일 60통을 더 훑습니다(1~2분)">⟳ 지금 더 모으기 <span class="adm">관리자</span></button>' : '')
      + '</div>';
  }

  /* ── 거르기 줄 ── */
  function filterHtml(st) {
    var M = model(st), f = st.filt || {};
    var n = { all: 0, final: 0, cand: 0, unlinked: 0, hold: 0 }, byKind = {};
    M.items.forEach(function (it) {
      var fl = flags(it, M);
      n.all++; byKind[it.kind] = (byKind[it.kind] || 0) + 1;
      if (fl.final) n.final++; if (fl.cand) n.cand++; if (fl.hold) n.hold++;
      if (fl.unlinked && !fl.hold) n.unlinked++;
    });
    function chip(act, val, label, cnt, on) {
      return '<button class="chip' + (on ? ' on' : '') + '" data-act="' + act + '" data-v="' + esc(val) + '">' + esc(label) + '<b>' + cnt + '</b></button>';
    }
    var seg = '<div class="seg"><button data-act="view" data-v="mail" class="' + (st.view !== 'company' ? 'on' : '') + '">메일 순</button>'
      + '<button data-act="view" data-v="company" class="' + (st.view === 'company' ? 'on' : '') + '">사업장별 순서</button></div>';
    var chips = chip('kind', '', '모두', n.all, !f.kind);
    KINDS.forEach(function (k) { if (byKind[k]) chips += chip('kind', k, KIND_LABEL[k] || k, byKind[k], f.kind === k); });
    chips += '<span class="sep"></span>'
      + chip('only', 'final', '★ 최종본만', n.final, f.only === 'final')
      + chip('only', 'cand', '최종본 후보', n.cand, f.only === 'cand')
      + chip('only', 'unlinked', '사업장 미확정', n.unlinked, f.only === 'unlinked')
      + chip('only', 'hold', '보류', n.hold, f.only === 'hold');
    return '<div class="flt">' + seg + (st.view === 'company' ? '' : chips)
      + '<input class="q" data-role="q" placeholder="🔍 파일·회사·메일 제목" value="' + esc(f.q || '') + '"></div>';
  }

  /* ── 고르면 뜨는 일괄 단추 ── */
  function bulkHtml(st) {
    var n = st.picked ? st.picked.size : 0;
    if (!n) return '';
    return '<div class="bulk">☑ <b>' + n + '건</b> 골랐습니다 —'
      + '<button class="btn sm p" data-act="bulkFinal" title="한 건만 고를 때 — 그 사업장·회차의 최종본으로">★ 최종본으로</button>'
      + '<button class="btn sm" data-act="bulkLink">사업장 확정…</button>'
      + '<button class="btn sm" data-act="bulkKind">갈래 고치기…</button>'
      + '<button class="btn sm" data-act="unpick">고르기 풀기</button>'
      + '<span class="hint">최종본은 한 사업장·한 회차에 하나 — 새로 고르면 앞의 것은 «이전 판»으로 내려갑니다</span></div>';
  }

  /* ── 표 ── (글을 안 받는다 — 셈과 이름만 그린다) */
  function tableHtml(st) {
    return st.view === 'company' ? companyTable(st) : mailTable(st);
  }
  function td(cls, title, html) {
    return '<td' + (cls ? ' class="' + cls + '"' : '') + ' title="' + esc(title) + '">' + html + '</td>';
  }
  function pickCell(st, it, disabled) {
    var on = st.picked && st.picked.has(it.id);
    return '<td class="c"><input type="checkbox" data-pick="' + esc(it.id) + '"' + (on ? ' checked' : '') + (disabled ? ' disabled' : '') + '></td>';
  }
  function siteCell(st, it) {
    if (it.companyId) { var nm = coName(st, it.companyId); return td('', nm || '지운 업체', '🏢 ' + esc(nm || '(지운 업체)')); }
    if (it.h.companyLinkStatus === 'not_required') return td('', '사업장 없음으로 둠', '<span class="none">사업장 없음</span>');
    var cand = (it.doc.companyCand || []).filter(function (c) { return c && c.companyId; });
    if (cand.length) {
      var t = cand.map(function (c) { return (coName(st, c.companyId) || c.companyId) + '? · ' + (c.why || ''); }).join(' / ');
      return td('', t, '<span class="cand">' + esc(t) + '</span>');
    }
    return td('', '후보 없음 — 메일 줄의 「사업장 확정」으로 잇는다', '<span class="none">후보 없음 — 찾아 잇기</span>');
  }
  function finalCell(it, M) {
    var i = M.info[it.id] || {};
    if (it.status === '보류') return td('fin0', '보류는 못 고른다', '보류는 못 고름');
    if (i.final) {
      var g = i.group || {};
      var who = [g.finalBy, g.finalAt ? md(g.finalAt) : ''].filter(Boolean).join(' ');
      return td('', '★ 최종본' + (who ? ' — ' + who : ''), '<span class="fin1">★ 최종본</span>' + (who ? ' <span class="why">· ' + esc(who) + '</span>' : ''));
    }
    if (i.cand && i.cand.length) return td('', '후보 — ' + i.cand.join(' / '), '<span class="sug">후보 · ' + esc(i.cand[0]) + '</span>');
    return td('fin0', '', '—');
  }
  function statusCell(it) {
    if (it.status === '보류') return td('', it.doc.holdWhy || '보류', '<span class="st hold">보류</span>');
    if (it.doc.file) return td('', '가린 파일과 글을 담았습니다', '<span class="st ok">담김</span>');
    return td('', '파일째 가릴 수 없는 꼴이라 가린 글만 담았습니다', '<span class="st ok">글만</span>');
  }
  function mailTable(st) {
    var M = model(st);
    var shown = M.items.filter(function (it) { return passes(it, st, M); });
    var body = O().byMail(shown).map(function (g) {
      /* 메일 한 통의 첨부를 한 번에 — 이미 이어진 메일에는 단추를 안 단다(바꿀 때는 ☐ 로 골라 「사업장 확정…」) */
      var m = g.mail || {}, ids = g.items.filter(function (it) {
        return it.status !== '보류' && flags(it, M).unlinked; }).map(function (it) { return it.id; });
      var head = '✉ ' + (m.subject || '(제목 없음)');
      var meta = ymd(m.date) + ' · ' + (g.items[0].dir || '') + ' · 첨부 ' + g.items.length;
      var rows = '<tr class="mail"><td></td>' + '<td colspan="8" title="' + esc(head + ' · ' + meta) + '">✉ <b>' + esc(m.subject || '(제목 없음)') + '</b> · ' + esc(meta)
        + (ids.length ? ' <button class="btn sm" data-act="linkMail" data-ids="' + esc(ids.join(',')) + '">사업장 확정…</button>' : '')
        + '</td></tr>';
      g.items.slice().sort(function (a, b) { return M.no[b.id] - M.no[a.id]; }).forEach(function (it) {
        var fl = flags(it, M), i = M.info[it.id] || {};
        var cls = [st.picked && st.picked.has(it.id) ? 'ck' : '', fl.hold ? 'hold' : '', fl.final ? 'fin' : '', st.sel === it.id ? 'sel' : ''].filter(Boolean).join(' ');
        var pan = i.ver != null && it.kind === '규칙본문' ? (i.ver === 0 ? '현행' : i.ver + '판 / ' + i.total) : '—';
        var pii = piiLabel((it.doc.pii || {}).count);
        rows += '<tr data-row="' + esc(it.id) + '"' + (cls ? ' class="' + cls + '"' : '') + '>'
          + pickCell(st, it, fl.hold)
          + '<td class="no">' + M.no[it.id] + '</td>'
          + td('', it.kind, '<span class="k1 ' + (KIND_CLS[it.kind] || '') + '">' + esc(KIND_LABEL[it.kind] || it.kind) + '</span>')
          + td('file', it.name, '<button class="lnk" data-act="sel" data-id="' + esc(it.id) + '">' + esc(it.name) + '</button>')
          + siteCell(st, it)
          + td('pan', pan, esc(pan))
          + finalCell(it, M)
          + td('pii', pii ? '가린 것: ' + pii : '가린 것 없음', pii ? esc(pii) : '<span class="none">없음</span>')
          + statusCell(it)
          + '</tr>';
      });
      return rows;
    }).join('');
    if (!body) body = '<tr><td colspan="9" class="empty" title="">' + (M.items.length ? '거른 조건에 맞는 자료가 없습니다' : '아직 모은 자료가 없습니다 — 서버가 매일 새벽 5시에 모읍니다') + '</td></tr>';
    return '<table class="lib"><colgroup><col style="width:36px"><col style="width:48px"><col style="width:92px"><col><col style="width:150px"><col style="width:84px"><col style="width:130px"><col style="width:120px"><col style="width:58px"></colgroup>'
      + '<thead><tr><th class="c"><input type="checkbox" data-act="pickAll" title="보이는 것 모두 고르기"></th><th class="c">번호</th><th>갈래</th><th>파일</th><th>사업장</th><th>판</th><th>최종본</th><th>가린 것</th><th>상태</th></tr></thead>'
      + '<tbody>' + body + '</tbody></table>';
  }
  function companyTable(st) {
    var M = model(st), q = String((st.filt || {}).q || '').trim().toLowerCase();
    var groups = M.groups.filter(function (g) { return !q || coName(st, g.companyId).toLowerCase().indexOf(q) >= 0; });
    var body = groups.map(function (g) {
      var nm = coName(st, g.companyId) || '(지운 업체)';
      var mails = {}; g.items.forEach(function (it) { mails[O().mailKey(it)] = 1; });
      var flow = g.rows.map(function (v) {
        var f = g.finalDocId === v.item.id;
        return '<i' + (f ? ' class="f"' : v.no ? ' class="r"' : '') + '>' + (f ? '★ ' : '') + (v.no ? v.no + '판' : '현행') + '</i>';
      });
      var rep = g.items.filter(function (it) { return it.kind === '신고서'; })[0];
      if (rep) flow.push('<i>신고서 ✉ ' + esc(md(rep.date)) + '</i>');
      var candIds = Object.keys(g.cand || {});
      var candTxt = !g.finalDocId && candIds.length ? '최종본 후보: ' + candIds.map(function (id) {
        var v = g.rows.filter(function (r) { return r.item.id === id; })[0];
        return (v ? (v.no ? v.no + '판' : '현행') : id) + ' — ' + g.cand[id].join(', ');
      }).join(' / ') : '';
      var meta = roundLabel(g.roundKey) + ' · 메일 ' + Object.keys(mails).length + '통 · 규칙 본문 ' + g.rows.length + '개';
      var rows = '<tr class="cohead"><td></td><td colspan="6" title="' + esc(nm + ' · ' + meta + (candTxt ? ' · ' + candTxt : '')) + '"><b>🏢 ' + esc(nm) + '</b>'
        + '<span class="meta">' + esc(meta) + '</span>'
        + (flow.length ? '<span class="flow">' + flow.join('→') + '</span>' : '')
        + (candTxt ? '<span class="sug">' + esc(candTxt) + '</span>' : '')
        + '</td></tr>';
      g.rows.forEach(function (v, k) {
        var it = v.item, fin = g.finalDocId === it.id, prev = k ? g.rows[k - 1].item : null;
        var dif = '— (출발점)';
        if (prev) {
          var d = st.diff && st.diff[it.id];
          dif = d ? '바뀐 조 <b>' + (d.counts['바뀜'] || 0) + '</b>' + (d.counts['새 조'] ? ' · 새 조 ' + d.counts['새 조'] : '') + (d.counts['없어짐'] ? ' · 없어짐 ' + d.counts['없어짐'] : '')
            : '<button class="lnk" data-act="diff" data-id="' + esc(it.id) + '" data-prev="' + esc(prev.id) + '" title="앞 판과 조 단위로 견줍니다">…</button>';
        }
        var finHtml = fin ? '<span class="fin1">★ 최종본</span> <span class="why">' + esc([g.finalBy, g.finalAt ? md(g.finalAt) : ''].filter(Boolean).join(' ')) + '</span>'
          + ' <button class="lnk" data-act="unsetFinal" data-co="' + esc(g.companyId) + '" data-round="' + esc(g.roundKey) + '">풀기</button>'
          : '<button class="btn sm g" data-act="setFinal" data-co="' + esc(g.companyId) + '" data-round="' + esc(g.roundKey) + '" data-id="' + esc(it.id) + '">★ 최종본으로</button>'
            + (g.finalDocId ? ' <span class="fin0">이전 판</span>' : '');
        var cls = [st.picked && st.picked.has(it.id) ? 'ck' : '', fin ? 'fin' : '', st.sel === it.id ? 'sel' : ''].filter(Boolean).join(' ');
        rows += '<tr data-row="' + esc(it.id) + '"' + (cls ? ' class="' + cls + '"' : '') + '>'
          + pickCell(st, it, false)
          + '<td class="no">' + v.no + '</td>'
          + td('', ymd(it.date), esc(ymd(it.date)))
          + td('file', it.name, '<button class="lnk" data-act="sel" data-id="' + esc(it.id) + '">' + esc(it.name) + '</button>')
          + td('', it.dir === '보냄' ? '푸른노무법인이 보냄' : '회사가 보냄', esc(it.dir === '보냄' ? '보냄 (푸른)' : '받음 (회사)'))
          + td('pan', prev ? '앞 판과 달라진 조' : '출발점', dif)
          + td('', fin ? '★ 최종본' : '', finHtml)
          + '</tr>';
      });
      return rows;
    }).join('');
    if (!body) body = '<tr><td colspan="7" class="empty" title="">사업장이 확정된 자료가 아직 없습니다 — 「메일 순」에서 메일마다 「사업장 확정」을 누르세요</td></tr>';
    return '<table class="lib"><colgroup><col style="width:36px"><col style="width:48px"><col style="width:96px"><col><col style="width:104px"><col style="width:150px"><col style="width:190px"></colgroup>'
      + '<thead><tr><th class="c"><input type="checkbox" data-act="pickAll" title="보이는 것 모두 고르기"></th><th class="c">순서</th><th>날짜</th><th>파일 (규칙 본문만)</th><th>보낸 쪽</th><th>앞 판과 달라진 조</th><th>최종본</th></tr></thead>'
      + '<tbody>' + body + '</tbody></table>';
  }

  /* ── 옆 칸 — 누른 한 건. 가린 글은 여기에만 ── */
  function sideHtml(st, text) {
    var d = st.data || {}, doc = (d.docs || {})[st.sel];
    if (!doc) return '<div class="side empty">파일 이름을 누르면 여기에 가린 글이 보입니다</div>';
    var h = (d.human || {})[st.sel] || {};
    var co = h.companyLinkStatus === 'linked' ? h.companyId : '';
    var m = doc.mail || {};
    var kind = h.kindFix || doc.kind;
    var pii = piiLabel((doc.pii || {}).count);
    var opts = KINDS.map(function (k) { return '<option value="' + esc(k) + '"' + (k === kind ? ' selected' : '') + '>' + esc(KIND_LABEL[k] || k) + '</option>'; }).join('');
    return '<div class="side">'
      + '<div class="sh"><b title="' + esc(doc.name) + '">' + esc(doc.name) + '</b><button class="lnk" data-act="closeSide">닫기</button></div>'
      + '<div class="meta2">✉ ' + esc(m.subject || '') + '<br>' + esc(ymd(m.date)) + ' · ' + esc(doc.dir || '') + (co ? ' · 🏢 ' + esc(coName(st, co) || co) : '') + '</div>'
      + '<div class="meta2">갈래 <select data-role="kind" data-id="' + esc(st.sel) + '">' + opts + '</select>'
      + ' · 가린 것: ' + (pii ? esc(pii) : '없음') + '</div>'
      + '<div class="acts"><a class="btn sm" href="' + esc(mailHref(co)) + '" target="_blank" rel="noopener">✉ 메일 열기(원본)</a>'
      + (doc.file && doc.file.path ? '<button class="btn sm" data-act="file" data-id="' + esc(st.sel) + '">📎 가린 파일 받기</button>' : '')
      + '</div>'
      + (doc.status === '보류'
        ? '<div class="holdwhy">보류 — ' + esc(doc.holdWhy || '') + '<br>담긴 것이 없습니다. 원본은 메일함에서 직접 보세요.</div>'
        : '<pre class="txt">' + (text == null ? '읽는 중…' : esc(text)) + '</pre>')
      + '</div>';
  }

  /* ── 사업장 고르기 — 이름으로 거르고, 단추는 id 를 든다 ── */
  function linkPickerHtml(target, companies, q) {
    var qq = String(q || '').trim();
    var list = (companies || []).filter(function (c) {
      return c && c.id && !c._deleted && (!qq || String(c.name || '').indexOf(qq) >= 0);
    }).slice(0, 40);
    return '<div class="pick"><div class="ph"><b>사업장 확정</b> — ' + esc((target && target.label) || ((target && target.ids || []).length + '건'))
      + '<button class="lnk" data-act="closePick">닫기</button></div>'
      + '<input class="q" data-role="coq" placeholder="회사 이름으로 찾기" value="' + esc(qq) + '">'
      + '<div class="plist">' + (qq ? (list.length ? list.map(function (c) {
          return '<button class="co" data-act="pickCo" data-co="' + esc(c.id) + '" title="' + esc(c.name) + ' (' + esc(c.id) + ')">🏢 ' + esc(c.name || c.id)
            + (c.bizNo || c.bizno ? ' <span class="why">' + esc(c.bizNo || c.bizno) + '</span>' : '') + '</button>';
        }).join('') : '<div class="none">맞는 업체가 없습니다 — 기업정보함에 먼저 등록하세요</div>') : '<div class="none">이름을 두 글자 이상 넣으세요</div>')
      + '</div><div class="pf"><button class="btn sm" data-act="noCo" title="취업규칙과 상관없는 첨부 등 — 사업장 없이 둡니다">사업장 없음</button></div></div>';
  }

  /* ── 꽂기 — 위 글들을 놓고 data-act 단추에 손잡이를 건다 ── */
  function render(el, st, handlers) {
    var side = st.sel ? sideHtml(st, st.text && st.text.id === st.sel ? st.text.body : null) : '';
    el.innerHTML = runHtml(st) + filterHtml(st) + bulkHtml(st)
      + '<div class="wrap' + (side ? ' two' : '') + '"><div class="tbl">' + tableHtml(st) + '</div>' + side + '</div>'
      + (st.picker ? '<div class="veil">' + linkPickerHtml(st.picker, st.companies, st.picker.q) + '</div>' : '')
      + (st.busy ? '<div class="busy">' + esc(st.busy) + '</div>' : '');
    var H = handlers || {};
    el.onclick = function (ev) {
      var b = ev.target.closest && ev.target.closest('[data-act]');
      if (!b || !el.contains(b) || b.tagName === 'INPUT') return;
      if (H[b.dataset.act]) { ev.preventDefault(); H[b.dataset.act](b.dataset, ev); }
    };
    el.onchange = function (ev) {
      var t = ev.target;
      if (t.dataset && t.dataset.pick != null && H.pick) H.pick(t.dataset.pick, t.checked);
      else if (t.dataset && t.dataset.act === 'pickAll' && H.pickAll) H.pickAll(t.checked);
      else if (t.dataset && t.dataset.role === 'kind' && H.setKind) H.setKind(t.dataset.id, t.value);
    };
    el.oninput = function (ev) {
      var t = ev.target;
      if (t.dataset && t.dataset.role === 'q' && H.q) H.q(t.value);
      else if (t.dataset && t.dataset.role === 'coq' && H.coq) H.coq(t.value);
    };
  }

  var api = { render: render, runHtml: runHtml, filterHtml: filterHtml, bulkHtml: bulkHtml, tableHtml: tableHtml,
    sideHtml: sideHtml, linkPickerHtml: linkPickerHtml, piiLabel: piiLabel, parseArticles: parseArticles,
    companyList: companyList, mailHref: mailHref, ymd: ymd, esc: esc };
  if (root) root.PuRulesV2Lib = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
