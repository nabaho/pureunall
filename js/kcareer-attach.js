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
      if (t === '</hp:tc>') {
        if (top.row && top.cell) {
          /* 문단은 « / » 로 가른다 — 한 칸에 기관을 문단마다 하나씩 적는 서식이 많다(「서산시설관리공단¶아산시시설관리공단」).
             한 칸 띄움으로 이으면 두 기관이 한 이름으로 붙어 짝을 못 찾는다. */
          top.cell.text = top.cell.text.split('\u0001').map(function (x) { return x.replace(/\s+/g, ' ').trim(); })
            .filter(Boolean).join(' / ');
          top.row.push(top.cell);
        }
        top.cell = null; continue;
      }
      if (t === '</hp:p>') { if (top.cell) top.cell.text += '\u0001'; continue; }
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
  /* 경력(재직) 표인가 — 머리 줄 바로 위의 «구역 이름» 줄이 「경력」이거나, 머리에 근무처·재직이 있으면.
     이 줄들은 대개 증빙을 안 붙인다(붙이면 재직증명서) — 화면이 맨 아래에 접어 둔다. */
  var CAREER_LABEL = /^(경력|경력사항|주요경력|근무경력|재직경력|경력및활동)$/;
  function careerOf(rows, hi) {
    var head = rows[hi] || [];
    if (head.some(function (c) { return /^(근무처|직장명|근무기간|재직기간)$/.test(맨(c)); })) return true;
    for (var i = hi - 1; i >= 0; i--) {
      var 찬 = (rows[i] || []).filter(function (c) { return 맨(c); });
      if (찬.length === 1) return CAREER_LABEL.test(맨(찬[0]));
      if (찬.length > 1) return false;
    }
    return false;
  }
  function pickRows(tables) {
    var out = [];
    (tables || []).forEach(function (rows, ti) {
      var h = null, 경력 = false;
      rows.forEach(function (row, ri) {
        if (!h) { h = headOf(row); if (h) 경력 = careerOf(rows, ri); return; }
        var g = function (k) { return h[k] != null ? String(row[h[k]] || '').trim() : ''; };
        var org = g('org');
        if (!맨(org) && !맨(g('content'))) return;   /* 빈 줄 */
        out.push({ table: ti, row: ri, period: g('period'), org: org, kind: g('kind'), content: g('content'),
          text: row.join(' · '), contentCol: h.content != null ? h.content : row.length - 1, sig: sigOf(g('period'), org),
          career: 경력 });
      });
    });
    return out;
  }

  /* 줄의 «이름표» — 기간·기관 글자. 「(첨부 n)」을 어느 줄에 붙일지 이것으로 다시 찾는다 */
  function sigOf(period, org) { return 맨(period) + '|' + 맨(org).replace(/\//g, ''); }

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
  /* ★ 같은 곳인가 — 이름이 같거나, 지사·본부·지청·청처럼 «딸린 자리» 꼬리만 다를 때만 (2026-10-04 대표 «추천대로»).
     ⚠ 이름 «안에 들어 있다»로 보지 않는다 — 「충청남도」가 「충청남도경제진흥원」까지 삼켜 후보가 37개가 됐다. */
  var 꼬리 = /^(청|도청|시청|군청|구청|본부|본사|지사|지청|지부|지점|사무소|사업소|.{1,4}(본부|지사|지청|지부|지점|사무소|사업소))$/;
  function samePlace(a, b) {
    if (!a || !b) return false;
    if (a === b) return true;
    /* 머리에 「한국·대한」만 더 붙은 이름 — 「청소년상담복지센터협의회」 = 「한국청소년상담복지센터협의회」 */
    var 머리뗌 = function (x) { return x.replace(/^(한국|대한민국|대한)/, ''); };
    if (머리뗌(a).length >= 5 && 머리뗌(a) === 머리뗌(b)) return true;
    var L = a.length >= b.length ? a : b, S = a.length >= b.length ? b : a;
    if (S.length >= 2 && L.indexOf(S) === 0 && 꼬리.test(L.slice(S.length))) return true;
    /* 이름 변형 — 「서산시비정규직지원센터」·「서산시비정규직근로자지원센터」처럼 앞(5자+)·끝(2자+)이 같고
       가운데 몇 자만 다르면 같은 곳. ⚠ 「충청남도」·「충청남도경제진흥원」은 끝이 달라 여기 안 걸린다. */
    var 앞 = 0; while (앞 < S.length && S[앞] === L[앞]) 앞++;
    var 끝 = 0; while (끝 < S.length - 앞 && S[S.length - 1 - 끝] === L[L.length - 1 - 끝]) 끝++;
    return 앞 >= 5 && 끝 >= 2 && 앞 + 끝 >= S.length - 1 && L.length - S.length <= 4;
  }
  function orgHit(rowOrg, recOrg) {
    var R = orgNorm(recOrg); if (R.length < 2) return false;
    return orgTokens(rowOrg).some(function (t) { return samePlace(t, R); });
  }
  function overlap(a, b) { return !!(a && b && a[0] <= b[1] && b[0] <= a[1]); }
  /* 내용 낱말 — 「노사분쟁 조정·중재단 위원」과 위촉장 제목이 겹치는가. 흔한 말은 뺀다 */
  var 흔한말 = /^(위원|위원회|위촉|위촉장|담당|관련|업무|노무사|공인노무사|기타|활동|내용)$/;
  function words(s) {
    return (String(s || '').match(/[가-힣A-Za-z]{2,}/g) || []).filter(function (w) { return !흔한말.test(w); });
  }
  function recText(r) { return [r.titleVal, r.title, r.name, r.content, r.role, r.type, r.kind].filter(Boolean).join(' '); }
  function contentScore(rowWords, r) {
    if (!rowWords.length) return null;
    var t = 맨(recText(r)), n = 0;
    rowWords.forEach(function (w) { if (t.indexOf(w) >= 0) n++; });
    return Math.min(n, 3);
  }
  /* 해마다 다시 받은 «같은 위촉»인가 — 제목 낱말에서 숫자(연도·제n기)·기관 이름을 뗀 것 */
  function recWords(r) {
    var 기관 = orgNorm(r.org || r.client || r.agency || '');
    return words(recText(r)).filter(function (w) { return 기관.indexOf(w) < 0; });
  }
  function sameKind(r) { return orgNorm(r.org || r.client || r.agency || '') + '|' + recWords(r).join(''); }
  /* 그 기록의 낱말이 줄 «내용»에 얼마나 들어 있나 (0~1) — 「고문노무사 설립심의」는 「고문노무사」 줄에 0.5 */
  function fitOf(rowText, r) {
    var ws = recWords(r); if (!ws.length) return null;
    var t = 맨(rowText), n = 0;
    ws.forEach(function (w) { if (t.indexOf(w) >= 0) n++; });
    return n / ws.length;
  }
  function candidates(row, recs) {
    var py = years(row.period), rw = words(row.content);
    var out = (recs || []).filter(function (x) { return x && x.r && orgHit(row.org, x.r.org || x.r.client || x.r.agency || ''); })
      .map(function (x) {
        var ry = recYears(x.r), 기간 = (py && ry) ? overlap(py, ry) : null, 내용 = contentScore(rw, x.r);
        return { r: x.r, page: x.page, 기간맞음: 기간, 내용: 내용, 맞음: fitOf(row.content, x.r), 해: ry ? ry[1] : 0,
                 점수: 2 + (기간 ? 1 : 0) - (기간 === false ? 2 : 0) + (내용 || 0) };
      })
      /* 기간이 «안 겹치는» 기록은 내용이 맞아도 뺀다 — 다른 때의 위촉장이다 */
      .filter(function (c) { return c.기간맞음 !== false; })
      .sort(function (a, b) { return (b.점수 - a.점수) || (b.해 - a.해); });
    /* ★ 미리 체크 — 줄에 적힌 «기관 × 맡은 일» 마다 가장 최근 하나.
       기간이 맞고, 그 기록의 제목 낱말이 줄 «내용»에 거의 다 들어 있을 때만(60%+).
       예) 「노사분쟁 조정·중재단 위원, 공무직 인사위원회 위원」 줄 → 조정·중재단 최근 1 + 인사위원회 최근 1.
       「고문노무사 설립심의」(낱말 절반만 맞음)는 「고문노무사」 줄에서 체크하지 않는다 — 사람이 보고 고른다.
       ⚠ 내용이 빈 줄은 기관당 «한 갈래»뿐일 때만 체크한다. */
    var 빈내용 = !rw.length;
    orgTokens(row.org).forEach(function (tok) {
      var 맞음 = out.filter(function (c) {
        return samePlace(tok, orgNorm(c.r.org || c.r.client || c.r.agency || '')) && c.기간맞음 === true
          && (빈내용 ? true : (c.맞음 !== null && c.맞음 >= 0.6));
      });
      if (!맞음.length) return;
      var 갈래 = {};
      맞음.forEach(function (c) { var k = sameKind(c.r); (갈래[k] = 갈래[k] || []).push(c); });
      var ks = Object.keys(갈래);
      if (빈내용 && ks.length > 1) return;
      ks.forEach(function (k) { 갈래[k].slice().sort(function (a, b) { return b.해 - a.해; })[0].먼저 = true; });
    });
    return out;
  }

  /* ④ 번호 — 고른 것만, 놓인 차례대로 */
  function number(items, word) {
    var n = 0, w = word || '첨부';
    (items || []).forEach(function (it) { it.no = it.on ? ++n : null; it.label = it.on ? (w + ' ' + it.no) : ''; });
    return n;
  }

  var api = { readTables: readTables, pickRows: pickRows, candidates: candidates, number: number, markRows: markRows, sigOf: sigOf,
    years: years, recYears: recYears, orgTokens: orgTokens, orgHit: orgHit, samePlace: samePlace, words: words, fitOf: fitOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.KcareerAttach = api;
})(typeof window !== 'undefined' ? window : this);
