/* 취업규칙(새) — 「🧹 정리하기」 그리기 (설계 §10-3 · 2026-10-09 목업 「추천대로」)
   그리는 것만 한다 — 셈은 lib-tidy.js(PuRulesV2Tidy), 저장은 rules-v2.html 의 손잡이가 store.js 로.
   ★ 지키는 것
     · 맨 왼쪽 ☐ + 보이는 차례 번호. 표의 칸은 한 줄 — 넘치면 … 이고 title 에 전문.
     · 이름 단서에는 진한 「확정」 단추를 달지 않는다 — 사람이 «맞음»을 골라 누른다(설계 §10 ③).
     · 띠(한꺼번에)는 일괄 가능(bulkOk)만 센다 — 사업장은 주소 일치, ★ 는 신고서 바로 앞 판(§10 ④).
     · 이름·주소·제목은 걸러(esc) 넣는다. */
(function (root) {
  'use strict';
  function TD() { return root.PuRulesV2Tidy; }
  function OR() { return root.PuRulesV2Order; }
  function LB() { return root.PuRulesV2Lib; }
  function esc(v) { return LB().esc(v); }
  function ymd(ms) { return LB().ymd(ms); }
  function coName(st, id) {
    var c = (st.companies || []).filter(function (x) { return String(x.id) === String(id); })[0];
    return c ? String(c.name || c.id) : '(지운 업체)';
  }
  function ensure(st) {
    if (!st.tidy) st.tidy = { step: 'link', q: '', picked: new Set(), open: {}, ver: {}, last: null };
    return st.tidy;
  }
  function td(cls, title, html) { return '<td' + (cls ? ' class="' + cls + '"' : '') + ' title="' + esc(title) + '">' + html + '</td>'; }
  function chipCls(w) {
    var T = TD();
    return w === T.W_ADDR ? 'addr' : w === T.W_LEARN ? 'learn' : w === T.W_NAME ? 'name' : 'dom';
  }
  function chip(w) { return '<span class="tchip ' + chipCls(w) + '">' + esc(w) + '</span>'; }
  function hit(q, parts) { q = String(q || '').trim().toLowerCase(); return !q || parts.join(' ').toLowerCase().indexOf(q) >= 0; }

  function stepsHtml(st, n) {
    var t = ensure(st);
    return '<div class="tsteps">'
      + '<button data-act="tidyStep" data-s="link" class="' + (t.step === 'link' ? 'on' : '') + '">① 사업장 잇기 · 묶음 ' + n.groups + '</button>'
      + '<button data-act="tidyStep" data-s="final" class="' + (t.step === 'final' ? 'on' : '') + '">② ★최종본 고르기 · 회차 ' + n.rounds + '</button>'
      + '<input class="q" data-role="tq" placeholder="🔍 주소·제목·회사" value="' + esc(t.q) + '">'
      + '</div>';
  }
  function lastHtml(st) {
    var l = ensure(st).last;
    if (!l) return '';
    var what = l.kind === 'final' ? '★ 정함 ' + l.rounds.length + '회차' : l.kind === 'none' ? '사업장 없음으로 둠 ' + l.ids.length + '건' : '방금 확정 ' + l.ids.length + '건';
    return '<div class="tlast">✓ ' + esc(l.label) + ' — ' + esc(what) + ' <button class="btn sm" data-act="tidyUndo">되돌리기</button></div>';
  }

  /* ── ① 사업장 잇기 ── */
  function linkButtons(st, g) {
    var out = '';
    if (g.pre) {
      out +='<button class="btn sm p" data-act="tidyLink" data-key="' + esc(g.key) + '" data-co="' + esc(g.pre) + '">' + esc(coName(st, g.pre)) + ' 확정</button>';
    } else {
      g.cands.slice(0, 3).forEach(function (c) {
        out += '<button class="btn sm" data-act="tidyLink" data-key="' + esc(g.key) + '" data-co="' + esc(c.companyId) + '">' + esc(coName(st, c.companyId)) + ' 맞음</button>';
      });
    }
    out += '<button class="btn sm" data-act="tidyOther" data-key="' + esc(g.key) + '">다른 회사…</button>'
      + '<button class="btn sm" data-act="tidyNone" data-key="' + esc(g.key) + '">사업장 없음</button>'
      + '<button class="lnk" data-act="tidyOpen" data-key="' + esc(g.key) + '">' + (ensure(st).open[g.key] ? '접기' : '펼치기') + '</button>';
    return out;
  }
  function candText(st, g) {
    if (!g.cands.length) return { t: '단서 없음', h: '<span class="none">단서 없음</span>' };
    var t = g.cands.map(function (c) { return coName(st, c.companyId) + ' (' + c.whys.join(', ') + ')'; }).join(' / ');
    var h = g.cands.slice(0, 3).map(function (c) {
      return '🏢 ' + esc(coName(st, c.companyId)) + (c.companyId === g.pre ? '' : '?') + c.whys.map(chip).join('');
    }).join(' ');
    if (g.mixed) { t = '회사가 섞였을 수 있음 — 펼쳐 보세요 · ' + t; h = '<span class="mix">섞였을 수 있음 — 펼쳐 보세요</span> ' + h; }
    return { t: t, h: h };
  }
  function linkTable(st, list) {
    var t = ensure(st);
    var body = list.map(function (g, i) {
      var on = t.picked.has(g.key);
      var who = g.ours ? '✉ 우리 쪽 메일 한 통' : g.addr;
      var c = candText(st, g);
      var row = '<tr data-tkey="' + esc(g.key) + '"' + (on ? ' class="ck"' : '') + '>'
        + '<td class="c"><input type="checkbox" data-tpick="' + esc(g.key) + '"' + (on ? ' checked' : '') + '></td>'
        + '<td class="no">' + (i + 1) + '</td>'
        + td('', who, esc(who))
        + td('', '메일 ' + g.mails + '통 · 서류 ' + g.ids.length + '건', '메일 ' + g.mails + ' · 서류 ' + g.ids.length)
        + td('', g.subject + (g.mails > 1 ? ' 외 ' + (g.mails - 1) + '통' : ''), esc(g.subject || '(제목 없음)') + (g.mails > 1 ? ' <span class="why">외 ' + (g.mails - 1) + '통</span>' : ''))
        + td('', c.t, c.h)
        + td('', '', linkButtons(st, g))
        + '</tr>';
      if (t.open[g.key]) {
        OR().byMail(g.items).forEach(function (m) {
          var ids = m.items.map(function (it) { return it.id; });
          var s = (m.mail.subject || '(제목 없음)') + ' · ' + ymd(m.mail.date) + ' · 첨부 ' + ids.length;
          row += '<tr class="mail"><td></td><td></td><td colspan="4" title="' + esc(s) + '">✉ ' + esc(s) + '</td>'
            + '<td title=""><button class="btn sm" data-act="linkMail" data-ids="' + esc(ids.join(',')) + '">사업장 확정…</button></td></tr>';
        });
      }
      return row;
    }).join('');
    if (!body) body = '<tr><td colspan="7" class="empty" title="">이을 서류가 없습니다 ✓</td></tr>';
    return '<table class="lib"><colgroup><col style="width:36px"><col style="width:48px"><col style="width:210px"><col style="width:110px"><col><col style="width:300px"><col style="width:300px"></colgroup>'
      + '<thead><tr><th class="c"><input type="checkbox" data-act="tpickAll" title="보이는 것 모두 고르기"></th><th class="c">번호</th><th>보낸 주소(묶음)</th><th>메일 · 서류</th><th>제목 예</th><th>후보 · 근거</th><th>확정</th></tr></thead>'
      + '<tbody>' + body + '</tbody></table>';
  }
  function linkPane(st, all) {
    var t = ensure(st);
    var list = all.filter(function (g) {
      return hit(t.q, [g.addr, g.subject].concat(g.cands.map(function (c) { return coName(st, c.companyId); })));
    });
    var bulk = list.filter(function (g) { return g.bulkOk; }), bulkDocs = 0;
    bulk.forEach(function (g) { bulkDocs += g.ids.length; });
    var band = bulk.length ? '<div class="tband">✅ <b>보낸 주소가 업체관리 담당자 메일과 같은 서류 ' + bulkDocs + '건</b>(' + bulk.length + '묶음) — 후보가 하나뿐입니다'
      + '<span class="sp"></span><button class="btn sm g" data-act="tidyBand">보이는 «주소 일치» 모두 확정</button></div>' : '';
    var picked = list.filter(function (g) { return t.picked.has(g.key); });
    var bar = picked.length ? '<div class="bulk">☑ <b>' + picked.length + '묶음</b> 골랐습니다 —'
      + '<button class="btn sm p" data-act="tidyBulkLink">골라 둔 후보로 확정</button>'
      + '<button class="btn sm" data-act="tidyBulkNone">사업장 없음</button>'
      + '<button class="btn sm" data-act="tidyUnpick">고르기 풀기</button>'
      + '<span class="hint">골라 둔 후보가 없는 묶음(이름 단서·단서 없음)은 건너뜁니다</span></div>' : '';
    return band + bar + linkTable(st, list);
  }

  /* ── ② ★최종본 고르기 ── */
  function flowHtml(r, chosen) {
    var g = r.group, parts = g.rows.map(function (v) {
      var f = v.item.id === chosen;
      return '<i' + (f ? ' class="f"' : '') + '>' + (f ? '★ ' : '') + (v.no ? v.no + '판' : '현행') + ' ' + esc(ymd(v.item.date).slice(5)) + '</i>';
    });
    var rep = g.items.filter(function (it) { return it.kind === '신고서'; })[0];
    if (rep) parts.push('<i class="rep">신고서 ✉ ' + esc(ymd(rep.date).slice(5)) + '</i>');
    return parts.join('');
  }
  function finalTable(st, list) {
    var t = ensure(st);
    var body = list.map(function (r, i) {
      var on = t.picked.has(r.roundId), chosen = t.ver[r.roundId] || r.pre;
      var v = r.group.rows.filter(function (x) { return x.item.id === chosen; })[0] || r.group.rows[r.group.rows.length - 1];
      var why = chosen === r.pre ? r.why : [];
      var opts = r.group.rows.map(function (x) {
        return '<option value="' + esc(x.item.id) + '"' + (x.item.id === chosen ? ' selected' : '') + '>' + (x.no ? x.no + '판' : '현행') + ' · ' + esc(ymd(x.item.date)) + '</option>';
      }).join('');
      var flowT = r.group.rows.map(function (x) { return (x.no ? x.no + '판' : '현행'); }).join(' → ');
      return '<tr data-tkey="' + esc(r.roundId) + '"' + (on ? ' class="ck"' : '') + '>'
        + '<td class="c"><input type="checkbox" data-tpick="' + esc(r.roundId) + '"' + (on ? ' checked' : '') + '></td>'
        + '<td class="no">' + (i + 1) + '</td>'
        + td('', coName(st, r.companyId), '🏢 ' + esc(coName(st, r.companyId)))
        + td('', r.roundKey, esc(r.roundKey.replace(/^r(\d{4})(\d{2})/, '$1-$2')))
        + td('tflow', flowT, flowHtml(r, chosen))
        + td('', (v.item.name || '') + (why.length ? ' · ' + why.join(', ') : ' · 근거 없음 — 마지막 판'),
          esc(v.item.name || '') + (why.length ? why.map(function (w) { return '<span class="tchip addr">' + esc(w) + '</span>'; }).join('') : ' <span class="none">근거 없음</span>'))
        + td('', '', '<select data-role="tidyVer" data-rid="' + esc(r.roundId) + '">' + opts + '</select>'
          + '<button class="btn sm p" data-act="tidyFinal" data-rid="' + esc(r.roundId) + '">★ 이 판으로</button>'
          + '<button class="btn sm" data-act="tidyNoFinal" data-rid="' + esc(r.roundId) + '">최종본 없음</button>')
        + '</tr>';
    }).join('');
    if (!body) body = '<tr><td colspan="7" class="empty" title="">고를 회차가 없습니다 — ① 에서 사업장을 이으면 회차가 생깁니다</td></tr>';
    return '<table class="lib"><colgroup><col style="width:36px"><col style="width:48px"><col style="width:160px"><col style="width:84px"><col><col style="width:280px"><col style="width:300px"></colgroup>'
      + '<thead><tr><th class="c"><input type="checkbox" data-act="tpickAll" title="보이는 것 모두 고르기"></th><th class="c">번호</th><th>사업장</th><th>회차</th><th>흐름 (판 → 신고)</th><th>골라 둔 판 · 근거</th><th>정하기</th></tr></thead>'
      + '<tbody>' + body + '</tbody></table>';
  }
  function finalPane(st, all) {
    var t = ensure(st);
    var list = all.filter(function (r) { return hit(t.q, [coName(st, r.companyId), r.roundKey]); });
    var bulk = list.filter(function (r) { return r.bulkOk; });
    var band = bulk.length ? '<div class="tband b">★ <b>신고서 메일 바로 앞 판이 있는 회차 ' + bulk.length + '개</b> — 그 판을 골라 두었습니다'
      + '<span class="sp"></span><button class="btn sm p" data-act="tidyBandFinal">보이는 ' + bulk.length + '회차 ★ 확정</button></div>' : '';
    var picked = list.filter(function (r) { return t.picked.has(r.roundId); });
    var bar = picked.length ? '<div class="bulk">☑ <b>' + picked.length + '회차</b> 골랐습니다 —'
      + '<button class="btn sm p" data-act="tidyBulkFinal">골라 둔 판으로 ★</button>'
      + '<button class="btn sm" data-act="tidyUnpick">고르기 풀기</button></div>' : '';
    return band + bar + finalTable(st, list);
  }

  function html(st) {
    var t = ensure(st);
    var gs = TD().groups(st.data, st.companies), rs = TD().rounds(st.data);
    var n = { groups: gs.length, rounds: rs.length };
    return '<div class="tidy">' + stepsHtml(st, n) + lastHtml(st)
      + (t.step === 'final' ? finalPane(st, rs) : linkPane(st, gs)) + '</div>';
  }

  var api = { html: html, ensure: ensure, coName: coName };
  if (root) root.PuRulesV2TidyView = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
