'use strict';
// 푸른노무법인 경력관리 — 🏢 사업관리(정부입찰·용역·공모) 판정
// (브라우저 window.KcareerBiz / Node module.exports 겸용, DOM·브라우저 API 미사용)
//
// 대표 지시 2026-10-05 「이력서 관리 아래에 사업관리를 별도로 — 대시보드로.
//   컨설턴트 모집 외 정부입찰 사업 등을 따로」 + 「계약한 것만이 아니라 입찰에 넣었던 서식·서류 등
//   모두를 별도 보관하고, 필요할 때 찾아오거나 비교하려는 것」 → 목업 1+2 승인.
// ⚠ 개인 지원(컨설턴트·위원·강사 모집)은 이력서관리·제출서류 몫이다 — 여기는 «법인으로 내는 사업».
// ⚠ 판정(갈래 짐작·셈·비교)은 «이 한 곳». 화면(kcareer.html)은 읽고 그리고 담기만 한다.
(function (root) {

  /* 구분 — 대표 승인 2026-10-05 */
  var KINDS = ['입찰·용역', '수행기관', '공모·바우처', '기타'];
  /* 단계 — 공고 → 준비 → 제출 → 심사 → 선정/탈락/포기 → 계약 · 「모름」은 폴더에서 올린 지난 해 건
     ⚠ 지난 해 건을 「제출」로 두면 한눈에의 «진행 중»에 몇 년 치가 영영 남는다 — 결과를 모르면 «모름»이다 */
  var STAGES = ['공고', '준비', '제출', '심사', '선정', '탈락', '포기', '계약', '모름'];
  /* 폴더에서 올린 건의 첫 단계 — 올해 것은 아직 결과 전(제출), 지난 해 것은 모름 */
  function stageForImport(year, now) {
    var Y = (now ? new Date(now) : new Date()).getFullYear();
    return String(year) >= String(Y) ? '제출' : '모름';
  }
  var OPEN = { '공고': 1, '준비': 1, '제출': 1, '심사': 1 };
  var WIN = { '선정': 1, '계약': 1 };
  var DECIDED = { '선정': 1, '계약': 1, '탈락': 1 };   /* 포기는 «결과»가 아니다 — 선정률에 넣지 않는다 */
  /* 서류 갈래 */
  var DOC_KINDS = ['공고문', '제안서', '입찰서식', '가격·견적', '증빙', '결과·계약', '기타'];

  /* 파일 이름으로 갈래를 «짐작»한다 — 사람이 바꿀 수 있다.
     ⚠ 차례가 뜻을 가진다: 「사업계획서」는 제안서, 「참가신청서」는 입찰서식, 「사업자등록증」은 증빙. */
  var DOC_RULES = [
    ['공고문', /공고|제안\s*요청|과업\s*(지시|내용)|rfp|모집\s*안내|사업\s*안내/i],
    ['가격·견적', /견적|산출|가격|예산|원가|내역서|단가/],
    ['결과·계약', /계약서|협약서|선정\s*(통보|결과|안내)|결과\s*(통보|안내)|낙찰|합격|통보문/],
    ['제안서', /제안서|사업\s*계획|수행\s*계획|기획서|발표\s*자료|ppt/i],
    ['증빙', /사업자\s*등록|등기|증명|실적|재무|납세|완납|인감|자격증|이력서|경력|재직|졸업|통장|보고서/],
    ['입찰서식', /신청서|서약|확약|각서|위임장|참가|서식|별지|동의서|확인서|입찰|청렴/]
  ];
  function guessDocKind(name) {
    var s = String(name || '').replace(/\.[^.]+$/, '');
    for (var i = 0; i < DOC_RULES.length; i++) if (DOC_RULES[i][1].test(s)) return DOC_RULES[i][0];
    return '기타';
  }

  /* 서류 한 장의 «사업을 수행한 해» (대표 지시 2026-10-07 「년도는 사업수행한 년도로」).
     2026년에 낸 사업에 「2023 일터혁신」 실적 증빙이 함께 담긴다 — 사업 연도(2026)를 그대로 쓰면 다 2026 이다.
     차례: ① 사람이 적은 해(d.year) ② 파일 이름의 해(20231015 · 2023년 · _230903) ③ 결과·계약 서류는 파일 날짜
           ④ 그 밖엔 사업 연도.  ⚠ 공고·서식·증빙은 «파일 날짜»를 안 쓴다 — 2026 신청 서류는 2025년 가을에
           만들어지고, 통장 사본은 몇 년 전 파일이다. 결과 보고서만 «끝낸 뒤» 만들어진다.
     돌려주는 것 { year, from:'직접'|'이름'|'파일날짜'|'사업' } — 화면은 from 을 풍선말로 보인다. */
  var 끝낸뒤 = /(결과|완료|최종)\s*보고/;
  function docYear(d, b, now) {
    d = d || {}; b = b || {};
    var 끝 = (now ? new Date(now) : new Date()).getFullYear() + 1;
    function ok(y) { y = Number(y); return y >= 2000 && y <= 끝 ? String(y) : ''; }
    var y = ok(d.year); if (y) return { year: y, from: '직접' };
    /* 결과·완료 보고서는 갈래가 «증빙»으로 짐작돼도 끝낸 뒤 만든 것이다 */
    var n = String(d.name || '').replace(/\.[^.]+$/, ''), m;
    if ((m = n.match(/(?:^|\D)(20\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])(?!\d)/)) && (y = ok(m[1]))) return { year: y, from: '이름' };
    if ((m = n.match(/(?:^|\D)(20\d{2})(?!\d)/)) && (y = ok(m[1]))) return { year: y, from: '이름' };
    if ((m = n.match(/(?:^|\D)(\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])(?!\d)/)) && (y = ok('20' + m[1]))) return { year: y, from: '이름' };
    if (((d.kind || guessDocKind(d.name)) === '결과·계약' || 끝낸뒤.test(n)) && (y = ok(String(d.mtime || '').slice(0, 4)))) return { year: y, from: '파일날짜' };
    return { year: String(b.year || ''), from: '사업' };
  }

  /* 7번 폴더의 건 가운데 «사업» 같은 것 — 먼저 추려 보여 줄 뿐, 올리는 것은 사람이 고른다.
     ⚠ 「○○지원사업 컨설턴트 모집」은 개인 지원이다 — 모집·위원·강사가 붙으면 사업으로 보지 않는다. */
  var BIZ_WORD = /사업(?!자)|용역|입찰|제안|수행기관|공급기업|바우처|클리닉|실태\s*조사|분쟁사업장|컨소시엄|위탁|운영기관|일자리\s*전환|구조\s*개선/;
  var PERSON_WORD = /모집|위원|강사|컨설턴트|자문|고문|멘토|이사|인력\s*풀|전문가\s*풀|코치|지원단|프로필|노무사$/;
  function looksBiz(name) {
    var s = String(name || '');
    return BIZ_WORD.test(s) && !PERSON_WORD.test(s);
  }
  /* 건 폴더 → 사업 한 건의 밑그림 { year, title, org } */
  function fromCaseDir(yearDir, name) {
    var s = String(name || '').trim();
    var y = (s.match(/^(20\d{2})/) || String(yearDir || '').match(/(20\d{2})/) || [])[1] || '';
    var org = ((s.match(/[(（\[［]([^)）\]］]{2,30})[)）\]］]/) || [])[1] || '').replace(/[~∼].*$/, '').trim();
    var title = s.replace(/^(20\d{2})\s*[-_.]?\s*/, '').replace(/[(（\[［][^)）\]］]*[)）\]］]/g, ' ').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
    return { year: y, title: title || s, org: org };
  }

  /* 마감까지 며칠 — 날짜 모양은 점·줄표·빗금 모두 받는다(경력관리 일자는 섞여 저장된다) */
  function ymd(v) {
    var m = String(v || '').match(/(20\d{2})\D{0,3}(\d{1,2})\D{0,3}(\d{1,2})/);
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }
  function dDay(due, now) {
    var d = ymd(due); if (!d) return null;
    var n = now ? new Date(now) : new Date(); n = new Date(n.getFullYear(), n.getMonth(), n.getDate());
    return Math.round((d - n) / 86400000);
  }
  function yearOf(r) { return String((r && (r.year || (String(r.due || r.sentAt || '').match(/20\d{2}/) || [])[0])) || ''); }

  /* 한눈에 셈 — recs: 사업 기록 · now: 기준 시각(검사가 고정 시계를 넣는다) */
  function summary(recs, now) {
    var n = now ? new Date(now) : new Date(), Y = String(n.getFullYear());
    var out = { year: Y, thisYear: 0, open: 0, openBy: {}, win: 0, decided: 0, rate: null, due: [], byYear: {}, byKind: {} };
    (recs || []).forEach(function (r) {
      if (!r) return;
      var y = yearOf(r), st = r.stage || '준비';
      if (y === Y) out.thisYear++;
      if (OPEN[st]) { out.open++; out.openBy[st] = (out.openBy[st] || 0) + 1; }
      if (y) { var b = out.byYear[y] = out.byYear[y] || { n: 0, win: 0 }; b.n++; if (WIN[st]) b.win++; }
      var k = r.kind || '기타'; out.byKind[k] = (out.byKind[k] || 0) + 1;
      if (DECIDED[st]) { out.decided++; if (WIN[st]) out.win++; }
      var dd = dDay(r.due, n);
      if (OPEN[st] && dd !== null && dd >= 0 && dd <= 7) out.due.push({ id: r.id, title: r.title, org: r.org, due: r.due, dDay: dd, stage: st });
    });
    out.rate = out.decided ? Math.round(out.win * 100 / out.decided) : null;
    out.due.sort(function (a, b) { return a.dDay - b.dDay; });
    return out;
  }

  /* ── 📑 두 서류 비교 — 줄끼리 견준다 (글자만, 표·그림 모양은 안 본다) ── */
  function textLines(text) {
    return String(text == null ? '' : text).split(/\r?\n/)
      .map(function (s) { return s.replace(/[\s　]+/g, ' ').trim(); })
      .filter(Boolean);
  }
  var MAX_LINES = 4000;   /* 줄 수 × 줄 수 표를 만든다 — 그 이상이면 앞쪽만 견주고 그렇다고 알린다 */
  /* ⇒ { rows:[{t:'same'|'add'|'del'|'chg', a, b}], cut:bool, same, add, del, chg } */
  function lineDiff(aText, bText) {
    var A = textLines(aText), B = textLines(bText), cut = false;
    if (A.length > MAX_LINES) { A = A.slice(0, MAX_LINES); cut = true; }
    if (B.length > MAX_LINES) { B = B.slice(0, MAX_LINES); cut = true; }
    var n = A.length, m = B.length, W = m + 1;
    var L = new Uint16Array((n + 1) * W);   /* 뒤에서부터 LCS 길이 */
    for (var i = n - 1; i >= 0; i--) for (var j = m - 1; j >= 0; j--)
      L[i * W + j] = A[i] === B[j] ? L[(i + 1) * W + j + 1] + 1 : Math.max(L[(i + 1) * W + j], L[i * W + j + 1]);
    var raw = [], x = 0, y = 0;
    while (x < n && y < m) {
      if (A[x] === B[y]) { raw.push({ t: 'same', a: A[x], b: B[y] }); x++; y++; }
      else if (L[(x + 1) * W + y] >= L[x * W + y + 1]) { raw.push({ t: 'del', a: A[x] }); x++; }
      else { raw.push({ t: 'add', b: B[y] }); y++; }
    }
    while (x < n) raw.push({ t: 'del', a: A[x++] });
    while (y < m) raw.push({ t: 'add', b: B[y++] });
    /* 빠진 줄 바로 뒤에 생긴 줄이 오면 «고친 줄» 한 쌍으로 묶는다 */
    var rows = [];
    for (var k = 0; k < raw.length; k++) {
      if (raw[k].t === 'del') {
        var dels = [], adds = [];
        while (k < raw.length && raw[k].t === 'del') dels.push(raw[k++]);
        while (k < raw.length && raw[k].t === 'add') adds.push(raw[k++]);
        k--;
        var p = Math.min(dels.length, adds.length);
        for (var q = 0; q < p; q++) rows.push({ t: 'chg', a: dels[q].a, b: adds[q].b });
        for (q = p; q < dels.length; q++) rows.push(dels[q]);
        for (q = p; q < adds.length; q++) rows.push(adds[q]);
      } else rows.push(raw[k]);
    }
    var c = { same: 0, add: 0, del: 0, chg: 0 };
    rows.forEach(function (r) { c[r.t]++; });
    return { rows: rows, cut: cut, same: c.same, add: c.add, del: c.del, chg: c.chg };
  }

  /* ── 엑셀(.xlsx) → 줄 (대표 지시 2026-10-05 「엑셀 견적서도 비교」) ──
     .xlsx 는 XML 묶음이다 — 화면이 JSZip 으로 풀어 글자만 넘기고, 여기서 «행마다 한 줄»로 편다:
       「[견적] 3행: 컨설팅비 · 1 · 3,000,000」  → 줄 비교(lineDiff)가 바뀐 행을 칠한다.
     ⚠ 옛 .xls(이진)는 못 읽는다. 수식은 «계산된 값»(v)을 쓴다 — 식 글자는 견주지 않는다.
     parts: { shared, workbook, rels, sheets:{ 'xl/worksheets/sheet1.xml': xml, … } } */
  function xmlText(s) {
    return String(s == null ? '' : s).replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&#(\d+);/g, function (m, n) { return String.fromCharCode(+n); }).replace(/&amp;/g, '&');
  }
  function attr(tag, name) { var m = String(tag).match(new RegExp('\\s' + name + '="([^"]*)"')); return m ? m[1] : ''; }
  function xlsxLines(parts) {
    parts = parts || {};
    var shared = [];
    String(parts.shared || '').replace(/<si\b[^>]*>([\s\S]*?)<\/si>/g, function (m, inner) {
      /* 읽는 법(rPh) 글자는 빼고 <t> 만 잇는다 */
      var t = ''; inner.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '').replace(/<t\b[^>]*>([\s\S]*?)<\/t>/g, function (mm, x) { t += x; return mm; });
      shared.push(xmlText(t)); return m;
    });
    var rid = {};
    String(parts.rels || '').replace(/<Relationship\b[^>]*>/g, function (tag) { rid[attr(tag, 'Id')] = attr(tag, 'Target'); return tag; });
    var order = [];
    String(parts.workbook || '').replace(/<sheet\b[^>]*>/g, function (tag) {
      var t = rid[attr(tag, 'r:id')] || '';
      if (t) order.push({ name: xmlText(attr(tag, 'name')), path: 'xl/' + t.replace(/^\/?xl\//, '').replace(/^\//, '') });
      return tag;
    });
    var sheets = parts.sheets || {};
    if (!order.length) Object.keys(sheets).sort().forEach(function (p, i) { order.push({ name: '시트' + (i + 1), path: p }); });
    var out = [];
    order.forEach(function (s) {
      var xml = sheets[s.path]; if (!xml) return;
      String(xml).replace(/<row\b([^>]*)>([\s\S]*?)<\/row>/g, function (m, ra, inner) {
        var vals = [];
        inner.replace(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g, function (mm, ca, body) {
          var t = attr(' ' + ca, 't'), v = '';
          var vm = String(body || '').match(/<v\b[^>]*>([\s\S]*?)<\/v>/);
          if (t === 's') v = shared[+(vm ? vm[1] : -1)] || '';
          else if (t === 'inlineStr') v = xmlText((String(body || '').match(/<is\b[^>]*>([\s\S]*?)<\/is>/) || [])[1] || '');
          else v = vm ? xmlText(vm[1]) : '';
          v = String(v).replace(/\s+/g, ' ').trim();
          if (v) vals.push(v);
          return mm;
        });
        if (vals.length) out.push('[' + s.name + '] ' + (attr(' ' + ra, 'r') || '?') + '행: ' + vals.join(' · '));
        return m;
      });
    });
    return out;
  }

  /* ── 📈 선정·계약 사업 → 실적 입력 칸 짝 (대표 지시 2026-10-05) ──
     실적 셋(컨설팅·기금·기타)의 입력 칸 이름에 맞춘다. 저장은 화면에서 사람이 한다.
     ⚠ 금액은 숫자만 · 유형은 사업명에 «일터혁신·구조혁신»이 있을 때만 그 이름, 아니면 «기타» */
  function perfFields(page, r) {
    r = r || {};
    var amt = String(r.amt == null ? '' : r.amt).replace(/[^\d]/g, '');
    var note = '🏢 사업관리 ' + (r.id || '') + '에서' + (r.kind ? ' · ' + r.kind : '');
    var 유형 = /일터\s*혁신/.test(r.title || '') ? '일터혁신' : (/구조\s*혁신/.test(r.title || '') ? '구조혁신' : '기타');
    /* ★ 수행기관 칸은 «수행기관으로 들어간 사업»일 때만 (2026-10-07 검토).
         수행기관이 적힌 실적은 «외부기관 실적»으로 간다(_isExternal). 입찰·용역처럼 발주처와 «직접» 맺은 사업에
         발주기관을 수행기관으로 적으면, 컨설팅실적이 아니라 외부기관 실적에만 보였다. */
    var 수행 = (r.kind === '수행기관') ? (r.org || '') : '';
    if (page === 'consult') return { type: 유형, org: r.org || '', project: r.title || '', agency: 수행, year: r.year || '', status: '진행', amt: amt, note: note };
    if (page === 'fund') return { org: r.org || '', project: r.title || '', year: r.year || '', status: '진행', amt: amt, note: note };
    if (page === 'etc') return { type: r.kind || '', org: r.org || '', project: r.title || '', year: r.year || '', amt: amt, note: note };
    return null;
  }

  var api = {
    xlsxLines: xlsxLines, perfFields: perfFields,
    KINDS: KINDS, STAGES: STAGES, DOC_KINDS: DOC_KINDS,
    isOpen: function (st) { return !!OPEN[st]; }, isWin: function (st) { return !!WIN[st]; },
    guessDocKind: guessDocKind, docYear: docYear, looksBiz: looksBiz, fromCaseDir: fromCaseDir, stageForImport: stageForImport,
    dDay: dDay, summary: summary, textLines: textLines, lineDiff: lineDiff, MAX_LINES: MAX_LINES
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.KcareerBiz = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
