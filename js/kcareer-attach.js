/* kcareer-attach.js — 📎 첨부서류 만들기의 «셈» (대표 승인 2026-10-03 목업)
   ------------------------------------------------------------------
   「이력서 관리에서 실적을 넣은 경우 경력관리에서 첨부서류로 만들어야 되는데 …
    첨부서류도 넘버링해서 한번에 하고 싶다」

   여기는 화면도 파일도 만지지 않는다 — 글자만 받아 셈만 한다(그래서 node 검사로 돌린다).
     ① readTables(sectionXml)  신청서의 표를 «줄·칸 글자»로 편다(표 속 표는 따로 센다)
     ② pickRows(tables)       「기관」 칸이 있는 표만 골라 줄마다 기간·기관·구분·내용을 뽑는다
     ③ candidates(row, recs)  그 줄에 붙일 만한 기록(원본 파일이 있는 것)을 고른다
     ④ number(items)          고른 증빙에 첨부 1, 2, 3 … 을 매긴다

   ⚠★ 기관 «이름만»으로 저절로 붙이지 않는다 (CLAUDE.md 온톨로지 — 이름으로 관계를 정하지 않는다).
      후보를 «보여 줄» 뿐이고, 미리 체크하는 것은 기관도 맞고 기간도 겹치는 후보가 «딱 하나»일 때뿐이다.
      그래도 사람이 창에서 보고 끌 수 있다 — 무엇을 낼지는 사람이 정한다.
   ------------------------------------------------------------------ */
(function (global) {
  'use strict';

  function 풀기(s) {
    return String(s || '').replace(/<[^>]*>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&');
  }
  function 맨(s) { return String(s || '').replace(/[\s　]/g, ''); }

  /* ① 표를 편다 — 칸 안 글자는 문단마다 한 칸 띄워 잇는다. 표 속 표는 «그 표대로» 따로 나온다 */
  function readTablesPos(xml) {
    var s = String(xml || ''), out = [], 쌓 = [], m;
    var re = /<hp:tbl\b[^>]*>|<\/hp:tbl>|<hp:tr\b[^>]*>|<\/hp:tr>|<hp:tc\b[^>]*>|<\/hp:tc>|<\/hp:p>|<hp:t(?:\s[^>]*)?>([\s\S]*?)<\/hp:t>/g;
    while ((m = re.exec(s))) {
      var t = m[0], top = 쌓[쌓.length - 1];
      if (/^<hp:tbl\b/.test(t)) { 쌓.push({ rows: [], row: null, cell: null }); continue; }
      if (t === '</hp:tbl>') { var 끝 = 쌓.pop(); if (끝) out.push(끝.rows); continue; }
      if (!top) continue;
      if (/^<hp:tr\b/.test(t)) { top.row = []; continue; }
      if (t === '</hp:tr>') { if (top.row) top.rows.push(top.row); top.row = null; continue; }
      if (/^<hp:tc\b/.test(t)) { top.cell = { text: '', tStart: -1, tEnd: -1 }; continue; }
      if (t === '</hp:tc>') { if (top.row && top.cell) { top.cell.text = top.cell.text.replace(/\s+/g, ' ').trim(); top.row.push(top.cell); } top.cell = null; continue; }
      if (t === '</hp:p>') { if (top.cell) top.cell.text += ' '; continue; }
      /* 칸의 «마지막 글자 조각» 자리도 적는다 — 「(첨부 n)」을 거기 붙인다(markRows) */
      if (top.cell) { top.cell.text += 풀기(m[1]); top.cell.tStart = m.index + t.indexOf('>') + 1; top.cell.tEnd = m.index + t.length - 7; }
    }
    return out;
  }
  function readTables(xml) {
    return readTablesPos(xml).map(function (rs) { return rs.map(function (r) { return r.map(function (c) { return c.text; }); }); });
  }

  /* ② 머리 줄에서 칸 뜻을 읽는다 — 「기관」이 있어야 실적 표다 */
  var COL = {
    period: /^(기간|연도|년도|일자|기간\(년\)|활동기간|수행기간|위촉기간|수상일|수상년도|연월)$/,
    org: /(기관|발주처|수여처|위촉처|소속기관|발주기관|수여기관)/,
    kind: /^(구분|분야|종류|유형)$/,
    content: /(내용|직위|직책|역할|업무|활동|포상명|표창명|사업명|과제명|위원회)/
  };
  function headOf(row) {
    var h = {};
    (row || []).forEach(function (c, i) {
      var k = 맨(c);
      if (h.period == null && COL.period.test(k)) h.period = i;
      else if (h.org == null && COL.org.test(k)) h.org = i;
      else if (h.kind == null && COL.kind.test(k)) h.kind = i;
      else if (h.content == null && COL.content.test(k)) h.content = i;
    });
    /* ⚠ 「기관」만으로는 모자란다 — 신청서 첫 장의 「기관명 | 푸른노무법인 | 사업자등록번호…」 같은
         «일반 현황» 표도 기관이란 말이 있다(2026-10-04 실측: 35줄이 실적으로 잡혔다).
         기간이나 내용 칸이 «함께» 있어야 실적 표다. */
    return (h.org != null && (h.period != null || h.content != null)) ? h : null;
  }
  function pickRows(tables) {
    var out = [];
    (tables || []).forEach(function (rows, ti) {
      var h = null;
      rows.forEach(function (row, ri) {
        if (!h) { h = headOf(row); return; }
        var g = function (k) { return h[k] != null ? String(row[h[k]] || '').trim() : ''; };
        var org = g('org');
        if (!맨(org) && !맨(g('content'))) return;   /* 빈 줄 */
        out.push({ table: ti, row: ri, period: g('period'), org: org, kind: g('kind'), content: g('content'),
          text: row.join(' · '), contentCol: h.content != null ? h.content : row.length - 1, sig: sigOf(g('period'), org) });
      });
    });
    return out;
  }

  /* 줄의 «이름표» — 기간·기관 글자. 「(첨부 n)」을 어느 줄에 붙일지 이것으로 다시 찾는다 */
  function sigOf(period, org) { return 맨(period) + '|' + 맨(org); }

  /* ⑤ 「(첨부 n)」 적기 — 지을 때마다 «원본에서 새로» 붙인다(그래서 두 번 적히지 않는다).
     marks: [{ sig, text:'(첨부 1, 2)' }] — 그 줄 «내용» 칸의 마지막 글자 뒤에 한 칸 띄워 붙인다.
     ⚠ 이미 「(첨부 …)」가 붙어 있으면(예전에 저장한 파일을 다시 올린 경우) 떼고 새로 붙인다.
     ⚠ 줄을 못 찾거나 글자가 없는 칸이면 손대지 않는다 — 엉뚱한 칸에 번호가 박히면 안 된다. */
  var MARK_OLD = /\s*\(첨부\s*[\d,\s]+\)\s*$/;
  function escXml(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function markRows(xml, marks) {
    var s = String(xml || '');
    if (!marks || !marks.length) return { xml: s, n: 0 };
    var bySig = {};
    marks.forEach(function (k) { if (k && k.sig && k.text) bySig[k.sig] = k.text; });
    var pos = readTablesPos(s);
    var rows = pickRows(pos.map(function (rs) { return rs.map(function (r) { return r.map(function (c) { return c.text; }); }); }));
    var edits = [];
    rows.forEach(function (row) {
      var 글 = bySig[row.sig]; if (!글) return;
      var cell = (pos[row.table][row.row] || [])[row.contentCol];
      if (!cell || cell.tEnd < 0) return;
      edits.push({ a: cell.tStart, b: cell.tEnd, 글: 글 });
    });
    edits.sort(function (x, y) { return y.a - x.a; });
    edits.forEach(function (e) {
      var 안 = s.slice(e.a, e.b).replace(MARK_OLD, '');
      s = s.slice(0, e.a) + 안 + ' ' + escXml(e.글) + s.slice(e.b);
    });
    return { xml: s, n: edits.length };
  }

  /* ③ 짝 후보 — 원본 파일이 있는 기록만 받는다(부르는 쪽이 거른다) */
  var 이번해 = function () { return new Date().getFullYear(); };
  function years(s) {
    var t = String(s || ''), ys = (t.match(/(19|20)\d{2}/g) || []).map(Number);
    if (!ys.length) return null;
    var a = Math.min.apply(null, ys), b = Math.max.apply(null, ys);
    if (/현재|진행|~\s*$|-\s*$/.test(t)) b = Math.max(b, 이번해());
    return [a, b];
  }
  function recYears(r) {
    return years([r.period, r.year, r.date, r.issueDate, r.startDate, r.endDate].filter(Boolean).join(' '));
  }
  var 떼말 = /(주식회사|\(주\)|㈜|재단법인|사단법인|\(재\)|\(사\)|\(사단\)|\(재단\))/g;
  function orgNorm(s) { return 맨(String(s || '').replace(떼말, '')); }
  /* 한 칸에 기관이 여럿 적힌다 — 「충청남도·세종시교육청·충남사회서비스원 등」 */
  function orgTokens(s) {
    return String(s || '').split(/[·,、\/\n]|\s+등\s*$|\s{2,}/).map(function (x) { return orgNorm(x.replace(/\s*등$/, '')); })
      .filter(function (x) { return x.length >= 2; });
  }
  function orgHit(rowOrg, recOrg) {
    var R = orgNorm(recOrg); if (R.length < 2) return false;
    return orgTokens(rowOrg).some(function (t) { return t === R || (t.length >= 3 && R.indexOf(t) >= 0) || (R.length >= 3 && t.indexOf(R) >= 0); });
  }
  function overlap(a, b) { return !!(a && b && a[0] <= b[1] && b[0] <= a[1]); }
  function candidates(row, recs) {
    var py = years(row.period);
    var out = (recs || []).filter(function (x) { return x && x.r && orgHit(row.org, x.r.org || x.r.client || x.r.agency || ''); })
      .map(function (x) {
        var ry = recYears(x.r), 기간 = (py && ry) ? overlap(py, ry) : null;
        return { r: x.r, page: x.page, 기간맞음: 기간, 점수: 2 + (기간 ? 1 : 0) - (기간 === false ? 2 : 0) };
      })
      .filter(function (c) { return c.점수 > 0; })
      .sort(function (a, b) { return b.점수 - a.점수; });
    /* 미리 체크 — 기관·기간이 다 맞는 후보가 «딱 하나»일 때만 */
    var 딱 = out.filter(function (c) { return c.기간맞음 === true; });
    if (딱.length === 1) 딱[0].먼저 = true;
    return out;
  }

  /* ④ 번호 — 고른 것만, 놓인 차례대로 */
  function number(items, word) {
    var n = 0, w = word || '첨부';
    (items || []).forEach(function (it) { it.no = it.on ? ++n : null; it.label = it.on ? (w + ' ' + it.no) : ''; });
    return n;
  }

  var api = { readTables: readTables, pickRows: pickRows, candidates: candidates, number: number, markRows: markRows, sigOf: sigOf,
    years: years, recYears: recYears, orgTokens: orgTokens, orgHit: orgHit };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.KcareerAttach = api;
})(typeof window !== 'undefined' ? window : this);
