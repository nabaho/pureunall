'use strict';
/* 한글(HWPX) 문서의 글자를 «XML 에서 직접» 찾아 바꾸는 엔진 — 브라우저 window.PuHwpxFill / Node 겸용
   (대표 지시 2026-09-26 「줄칸 간격등 정리가 계속 안된다 … 근본적 해결 … 기존서류와 같이 사용」)

   왜 새로 만드나
     · 기금 한글 틀(#1583)은 rhwp 엔진의 replaceAll 로 표지를 바꿨는데, 사업계획서를 열어 보니
       «표 안의 표»(4. 기금예치 계획)는 rhwp 가 찾지도 바꾸지도 못했다(searchAllText 결과 0).
       남의 기금 자료(은행 이름·금액·날짜)가 그 안에 그대로 남는다.
     · HWPX 는 ZIP 안의 XML 이라 표가 몇 겹이든 글상자든 글자는 전부 <hp:t> 안에 있다.
       XML 에서 바로 바꾸면 깊이에 상관없이 닿고, 글자 모양(run)도 그대로 산다.
   무엇을 지키나
     · 태그는 건드리지 않는다 — <hp:t> 안의 «글자»만 바꾼다. 한 낱말이 여러 run 에 쪼개져 있어도
       첫 조각 자리에 새 글을 넣고 나머지 조각에서 그만큼 지운다(글자 모양은 첫 조각의 것).
     · 글자를 바꾼 문단만 옛 줄 정보(linesegarray)를 걷는다 — 안 걷으면 한글이 옛 줄 자리를 믿어
       긴 글이 한 줄에 겹친다(#1583·#1584 에서 한글로 직접 열어 보고 배운 것). 한글도 rhwp 도
       줄 정보가 없는 문단은 새로 나눠 그린다.
   자리 이름(주소) — 틀을 만들 때 «어느 칸»인지 가리키려고 쓴다
     P3        본문 넷째 문단
     T5.C7.P0  문서 안 여섯째 표(겹친 표도 차례대로 센다)의 여덟째 칸 첫 문단
     B2.P1     셋째 글상자(머리말·그림 글상자 등)의 둘째 문단 */
(function (root) {
  var MK_RE = /{{([^{}]{1,30})}}/g;   // {{이름}} — 중괄호를 그대로 쓰지 않는다(검사들의 함수 자르기)
  var BLANK = '＿＿＿';                                  // ＿＿＿ — 모르는 값(지어내지 않는다)

  function dec(s) {
    return String(s).replace(/&(lt|gt|amp|quot|apos|#\d+|#x[0-9a-fA-F]+);/g, function (m, e) {
      if (e === 'lt') return '<'; if (e === 'gt') return '>'; if (e === 'amp') return '&';
      if (e === 'quot') return '"'; if (e === 'apos') return "'";
      return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    });
  }
  function enc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  /* 문단을 문서 차례대로 모은다 — 각 문단의 «글자 조각»(XML 속 자리)과 이어 붙인 글 */
  function scan(xml) {
    xml = String(xml || '');
    var re = /<(\/?)([A-Za-z0-9_:.-]+)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>|([^<]+)/g, m;
    var stack = [], ctx = [{ id: '', n: 0 }], tbls = [], nT = 0, nB = 0, open = [], out = [], inT = 0;
    while ((m = re.exec(xml))) {
      if (m[5] != null) {
        if (inT && open.length) open[open.length - 1].segs.push({ s: m.index, e: m.index + m[5].length, text: dec(m[5]) });
        continue;
      }
      var close = m[1] === '/', name = m[2], self = m[4] === '/';
      if (!close) {
        if (name === 'hp:tbl') tbls.push({ i: nT++, c: -1 });
        else if (name === 'hp:tc' && tbls.length) tbls[tbls.length - 1].c++;
        else if (name === 'hp:subList') {
          var par = stack[stack.length - 1], t = tbls[tbls.length - 1];
          ctx.push({ id: (par === 'hp:tc' && t) ? ('T' + t.i + '.C' + t.c + '.') : ('B' + (nB++) + '.'), n: 0 });
        } else if (name === 'hp:p') {
          var c = ctx[ctx.length - 1];
          var p = { addr: c.id + 'P' + (c.n++), segs: [], start: m.index, end: -1, lsS: -1, lsE: -1 };
          open.push(p); out.push(p);
        } else if (name === 'hp:t' && !self) inT++;
        if (name === 'hp:linesegarray' && open.length && stack[stack.length - 1] === 'hp:p') {
          var own = open[open.length - 1];
          own.lsS = m.index;
          if (self) own.lsE = m.index + m[0].length;
        }
        if (!self) stack.push(name);
      } else {
        stack.pop();
        if (name === 'hp:tbl') tbls.pop();
        else if (name === 'hp:subList') ctx.pop();
        else if (name === 'hp:t') inT = Math.max(0, inT - 1);
        else if (name === 'hp:linesegarray' && open.length && stack[stack.length - 1] === 'hp:p') open[open.length - 1].lsE = m.index + m[0].length;
        else if (name === 'hp:p') { var q = open.pop(); if (q) q.end = m.index + m[0].length; }
      }
    }
    out.forEach(function (p) { p.text = p.segs.map(function (s) { return s.text; }).join(''); });
    return out;
  }

  /* 주소가 규칙에 맞나 — 'T13.C9.P0' 은 그 문단 하나, 'T13.C9.' 처럼 점으로 끝나면 그 아래 전부 */
  function atMatch(addr, at) {
    if (!at) return true;
    return addr === at || (at.charAt(at.length - 1) === '.' && addr.indexOf(at) === 0);
  }
  /* ── 줄 정보를 걷을까 둘까 ──
     걷으면 한글도 rhwp 도 그 문단을 새로 나눈다. 그런데 앱 안 미리보기(rhwp)는 «표 칸 안»에서 새로 나눌 때
     폭을 잘못 재어 한 줄짜리 제목·이름을 두 줄로 꺾었다(2026-09-26, 사업계획서 표지 — 한글에서는 멀쩡).
     그래서 «한 줄짜리» 문단은 새 글이 그 줄 폭에 넉넉히 들어가면 줄 정보를 그대로 둔다(둘 다 원본처럼 그린다).
     여러 줄 문단이나, 한 줄 폭을 넘을 수 있는 글은 걷는다 — 옛 줄 자리를 믿으면 한글에서 글자가 겹친다(#1583).
     글 폭은 글자 크기(textheight)로 어림한다: 한글·한자·전각 1자 = 1, 숫자 0.55, 영문 0.6, 빈칸·문장부호 0.5.
     어림은 «넓게» 잡는다 — 모자라게 어림해 겹치는 것보다, 넓게 어림해 새로 나누는 편이 안전하다. */
  function estWidth(t, h) {
    var w = 0;
    for (var i = 0; i < t.length; i++) {
      var c = t.charCodeAt(i);
      if ((c >= 0x1100 && c <= 0x11FF) || (c >= 0x3000 && c <= 0x9FFF) || (c >= 0xAC00 && c <= 0xD7A3) || (c >= 0xF900 && c <= 0xFAFF) || (c >= 0xFF01 && c <= 0xFF60) || (c >= 0x2460 && c <= 0x27BF)) w += 1;
      else if (c >= 48 && c <= 57) w += 0.55;
      else if ((c >= 65 && c <= 90) || (c >= 97 && c <= 122)) w += 0.6;
      else w += 0.5;
    }
    return w * h;
  }
  function lineInfo(xml, p) {
    if (p.lsS < 0 || p.lsE <= p.lsS) return null;
    var body = xml.slice(p.lsS, p.lsE), segs = body.match(/<hp:lineseg\b[^>]*>/g) || [];
    var attr = function (s, k) { var m = new RegExp('\\b' + k + '="(-?\\d+)"').exec(s); return m ? +m[1] : 0; };
    return { n: segs.length, width: segs.length ? attr(segs[0], 'horzsize') : 0, h: segs.length ? (attr(segs[0], 'textheight') || attr(segs[0], 'vertsize')) : 0 };
  }
  /* mode: 'auto' — 한 줄이고 새 글이 폭에 들어가면 둔다 / 'keep1' — 한 줄이면 둔다(틀 만들 때: 값은 채울 때 정해진다) */
  function lineEdit(p, xml, newText, mode) {
    if (p.lsS < 0 || p.lsE <= p.lsS) return [];
    var li = xml != null ? lineInfo(xml, p) : null;
    if (li && li.n === 1 && newText != null) {
      if (mode === 'keep1') return [];
      if (li.width > 0 && li.h > 0 && estWidth(newText, li.h) <= li.width * 0.97) return [];
    }
    return [{ s: p.lsS, e: p.lsE, raw: '' }];
  }
  /* 한 문단에 [{a,b,to}] 를 적용한 «새 글» — 줄 정보 판단용 */
  function newTextOf(p, pairs) {
    var t = p.text, out = '', pos = 0;
    pairs.slice().sort(function (x, y) { return x.a - y.a; }).forEach(function (r) { out += t.slice(pos, r.a) + r.to; pos = r.b; });
    return out + t.slice(pos);
  }
  function applyEdits(xml, edits) {
    edits.sort(function (x, y) { return y.s - x.s; });
    var out = xml, lastS = Infinity;
    edits.forEach(function (d) {
      if (d.e > lastS) return;                            // 겹치면 뒤엣것을 버린다(안전)
      out = out.slice(0, d.s) + d.raw + out.slice(d.e); lastS = d.s;
    });
    return out;
  }
  /* 같은 조각을 여러 번 고치는 경우를 하나로 합친다 — 한 문단에서 여러 자리를 바꿀 때 */
  function paraReplace(p, pairs) {
    /* pairs: [{a,b,to}] (문단 글 기준, 겹치지 않게) → 새 글 → 조각별로 다시 나눠 쓴다 */
    if (!pairs.length) return [];
    pairs.sort(function (x, y) { return x.a - y.a; });
    var text = p.text, segs = p.segs, edits = [];
    /* 각 조각의 새 글 = 원래 조각 글에서 걸린 부분을 바꾼 것. 바꿀 글은 «시작이 걸린 조각»에 넣는다 */
    var bounds = [], pos = 0;
    segs.forEach(function (s) { bounds.push([pos, pos + s.text.length]); pos += s.text.length; });
    var nt = segs.map(function (s) { return s.text.split(''); });
    var ins = segs.map(function () { return {}; });
    pairs.forEach(function (r) {
      for (var i = 0; i < segs.length; i++) {
        var sa = bounds[i][0], sb = bounds[i][1];
        for (var k = Math.max(r.a, sa); k < Math.min(r.b, sb); k++) nt[i][k - sa] = '';
      }
      /* 넣을 자리 — r.a 를 품은 조각(없으면 끝 조각의 끝) */
      var at = -1;
      for (var j = 0; j < segs.length; j++) if (r.a >= bounds[j][0] && r.a < bounds[j][1]) { at = j; break; }
      if (at < 0) { at = segs.length - 1; ins[at][segs[at].text.length] = (ins[at][segs[at].text.length] || '') + r.to; }
      else ins[at][r.a - bounds[at][0]] = (ins[at][r.a - bounds[at][0]] || '') + r.to;
    });
    segs.forEach(function (s, i) {
      var arr = nt[i], outS = '';
      for (var k = 0; k <= arr.length; k++) { if (ins[i][k]) outS += ins[i][k]; if (k < arr.length) outS += arr[k]; }
      if (outS !== s.text) edits.push({ s: s.s, e: s.e, raw: enc(outS) });
    });
    return edits;
  }
  /* 글자가 하나도 없는 문단(빈 칸)에 글을 «새로» 넣는다 — 첫 run 안에 <hp:t> 를 만든다.
     ⚠ 한글이 저장한 빈 칸은 run 이 스스로 닫혀 있다(<hp:run …/>). 그 «뒤»에 글자를 붙이면
       한글이 버린다(#1584 에서 한글로 직접 열어 보고 알았다) — 반드시 run «안»에 넣는다. */
  function emptyInsert(xml, p, text) {
    var body = xml.slice(p.start, p.end);
    var m = /<hp:run\b((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/.exec(body);
    if (!m) return null;
    var at = p.start + m.index;
    if (m[2] === '/') return { s: at, e: at + m[0].length, raw: '<hp:run' + m[1] + '><hp:t>' + enc(text) + '</hp:t></hp:run>' };
    return { s: at + m[0].length, e: at + m[0].length, raw: '<hp:t>' + enc(text) + '</hp:t>' };
  }

  /* 글 바꾸기 규칙: [{at:'T5.C7.'|'P3'|null, find:'…', to:'…', all:true|false, nth:1}]
     at 은 «주소 앞부분» — 'T5.' 면 여섯째 표 전체, null 이면 문서 전체. 문단을 넘는 글은 못 찾는다.
     돌려주는 것: {xml, hits:[규칙마다 바꾼 수]} */
  function replaceText(xml, rules, opts) {
    var mode = (opts && opts.lines) || 'auto';
    var ps = scan(xml), hits = rules.map(function () { return 0; }), edits = [];
    /* set(문단 통째)을 먼저 — 같은 문단에 «찾아 바꾸기»(예: 연도 전부)가 겹치면 set 이 이긴다 */
    var order = rules.map(function (r, i) { return i; })
      .sort(function (a, b) { return (rules[a].set != null ? 0 : 1) - (rules[b].set != null ? 0 : 1) || a - b; });
    ps.forEach(function (p) {
      var pairs = [], touched = false;
      order.forEach(function (ri) {
        var r = rules[ri];
        if (!atMatch(p.addr, r.at)) return;
        /* drop — 문단을 «통째로» 없앤다(원본의 둘째 회사 서명 줄처럼, 반복 묶음이 대신 세울 줄) */
        if (r.drop) {
          if (!r.at || pairs.length || touched) return;
          edits.push({ s: p.start, e: p.end, raw: '' }); hits[ri]++; touched = '\u0000drop'; return;
        }
        if (touched === '\u0000drop') return;
        /* set — 그 문단의 글 «전부»를 바꾼다(표 칸 값 자리). 빈 칸이면 새로 넣는다 */
        if (r.set != null) {
          if (pairs.length || touched) return;              // 한 문단에 set 은 하나만
          if (!r.at) return;                                // 문서 전체를 통째로 바꾸는 일은 없다
          if (p.text.length) { pairs.push({ a: 0, b: p.text.length, to: r.set }); hits[ri]++; }
          else if (r.set !== '') {
            var leaf = xml.slice(p.start + 1, p.end).indexOf('<hp:p') < 0;
            var ins = leaf ? emptyInsert(xml, p, r.set) : null;
            if (ins) { edits.push(ins); touched = r.set; hits[ri]++; }
          }
          return;
        }
        if (!r.find) return;
        var from = 0, i, seen = 0;
        while ((i = p.text.indexOf(r.find, from)) >= 0) {
          seen++;
          var clash = pairs.some(function (x) { return i < x.b && i + r.find.length > x.a; });
          if (!clash && (!r.nth || r.nth === seen)) { pairs.push({ a: i, b: i + r.find.length, to: r.to }); hits[ri]++; if (!r.all && !r.nth) { from = p.text.length; break; } }
          from = i + r.find.length;
        }
      });
      if (touched === '\u0000drop') return;
      if (pairs.length) edits = edits.concat(paraReplace(p, pairs), lineEdit(p, xml, newTextOf(p, pairs), mode));
      else if (touched) edits = edits.concat(lineEdit(p, xml, touched, mode));
    });
    return { xml: applyEdits(xml, edits), hits: hits };
  }

  /* 문서에 든 표지 이름들 */
  function markers(xml) {
    var out = {};
    scan(xml).forEach(function (p) {
      var m; MK_RE.lastIndex = 0;
      while ((m = MK_RE.exec(p.text))) { if (/^[#\/]/.test(m[1])) continue; out[m[1]] = (out[m[1]] || 0) + 1; }   // 반복 묶음 표시는 이름이 아니다
    });
    return out;
  }

  /* 표지를 값으로 — V[이름] 이 배열이면 번호 표지({{근로자위원1}}…)에 차례대로.
     모르는 이름은 그대로 두고 알린다. 빈 값은 밑줄. 돌려주는 것: {xml, filled, unknown:[], over:{}} */
  function fill(xml, V, opts) {
    opts = opts || {};
    var blank = opts.blank != null ? opts.blank : BLANK;
    var show = function (v) { v = (v == null) ? '' : String(v); return v === '' ? blank : v; };
    var ps = scan(xml), edits = [], filled = 0, unknown = {}, maxN = {};
    ps.forEach(function (p) {
      var pairs = [], m; MK_RE.lastIndex = 0;
      while ((m = MK_RE.exec(p.text))) {
        var name = m[1], val, known = true;
        if (/^[#\/]/.test(name)) continue;                  // 반복 묶음 표시 — expand 가 먼저 걷는다
        if (Object.prototype.hasOwnProperty.call(V, name) && !Array.isArray(V[name])) val = V[name];
        else {
          var base = name.replace(/\d+$/, ''), n = +(name.slice(base.length) || 0);
          if (n && Array.isArray(V[base])) { val = V[base][n - 1]; maxN[base] = Math.max(maxN[base] || 0, n); }
          else known = false;
        }
        if (!known) { unknown[name] = 1; continue; }
        if (val != null && String(val) !== '') filled++;
        pairs.push({ a: m.index, b: m.index + m[0].length, to: show(val) });
      }
      if (pairs.length) edits = edits.concat(paraReplace(p, pairs), lineEdit(p, xml, newTextOf(p, pairs), opts.lines || 'auto'));
    });
    var over = {};
    Object.keys(maxN).forEach(function (k) { var L = (V[k] || []).filter(function (x) { return x != null && String(x) !== ''; }).length; if (L > maxN[k]) over[k] = L - maxN[k]; });
    return { xml: applyEdits(xml, edits), filled: filled, unknown: Object.keys(unknown), over: over };
  }

  /* ── 반복 묶음 — 회사마다 서명 한 줄, 회사마다 확인서 한 장 ── (2026-09-26)
     틀에 {{#이름}} 이 든 문단부터 {{/이름}} 이 든 문단까지가 한 묶음이다. V[이름] 이 배열이면
     그 수만큼 묶음을 베끼고, 베낀 것마다 그 항목의 값(항목 → 없으면 V)으로 채운다.
     · {{#쪽:이름}} — «장» 단위로 베낀다(묶음을 품은 맨 바깥 문단째로, 둘째부터 새 쪽에서 시작).
       설립 서류는 한 장이 통째로 1칸짜리 표(테두리 상자)라, 칸 안 문단만 베끼면 한 상자에 확인서가 이어 붙는다.
     · 배열이 비면 «한 벌»을 빈 값으로 남긴다 — 서명란이 통째로 사라지면 날인받을 자리가 없다(HTML 과 같다).
     ⚠ 둘째 장부터는 쪽 설정(secPr·단 설정)을 뺀다 — 구역 설정이 여러 번 나오면 한글이 새 구역으로 읽는다. */
  var RP_RE = /{{([#\/])(쪽:|행:)?([^{}]{1,30})}}/g;
  /* ── 표 줄 다루기 — 협의회 명부처럼 «사람 수만큼 줄»이 늘어나는 표 ──
     ⚠ 겹친 표(표 안의 표)의 줄은 다루지 않는다 — 명부·재산목록은 겹치지 않는다(틀 만들 때 확인).
     줄을 늘리거나 지우면 그 표의 rowCnt 와, 뒤 줄들의 cellAddr rowAddr 를 함께 고쳐야 한다(안 고치면 한글이 표를 못 읽는다). */
  function rowOf(xml, pos) {                      // pos 를 품은 <hp:tr>…</hp:tr> 의 [시작, 끝)
    var a = Math.max(xml.lastIndexOf('<hp:tr>', pos), xml.lastIndexOf('<hp:tr ', pos));
    var b = xml.indexOf('</hp:tr>', pos);
    return (a < 0 || b < 0) ? null : { a: a, b: b + '</hp:tr>'.length };
  }
  function tableOf(xml, pos) {
    var a = xml.lastIndexOf('<hp:tbl', pos), b = xml.indexOf('</hp:tbl>', pos);
    return (a < 0 || b < 0) ? null : { a: a, b: b + '</hp:tbl>'.length };
  }
  function shiftRows(chunk, by) {                  // 조각 안 모든 칸의 rowAddr 를 by 만큼
    return chunk.replace(/(<hp:cellAddr\b[^>]*\browAddr=")(\d+)"/g, function (m, h, n) { return h + (+n + by) + '"'; });
  }
  function rowSpan(chunk) {                        // 줄 묶음이 차지하는 줄 수 = <hp:tr> 개수
    return (chunk.match(/<hp:tr[ >]/g) || []).length;
  }
  /* 표에서 [ra, rb) 줄 묶음을 outs(글 조각 배열)로 바꾸고, rowCnt·뒤 줄 번호를 고친다 */
  function replaceRows(xml, ra, rb, outs) {
    var t = tableOf(xml, ra); if (!t) return xml;
    var n0 = rowSpan(xml.slice(ra, rb)), per = n0;
    var body = outs.map(function (o, i) { return shiftRows(o, i * per); }).join('');
    var delta = outs.length * per - n0;
    var tail = shiftRows(xml.slice(rb, t.b), delta);
    var head = xml.slice(t.a, ra).replace(/(<hp:tbl\b[^>]*\browCnt=")(\d+)"/, function (m, h, n) { return h + (+n + delta) + '"'; });
    return xml.slice(0, t.a) + head + body + tail + xml.slice(t.b);
  }
  /* 틀 만들 때 — 그 칸이 든 표 줄을 통째로 지운다(원본의 둘째 위원 줄처럼 반복이 대신 세울 줄) */
  /* ⚠ 지울 줄은 «표 시작 + 몇째 줄»로 기억하고 한 줄 지울 때마다 새로 찾는다. 글 자리(위치)로 기억하면,
       앞서 지운 줄이 표 머리의 줄 수를 「10」→「9」로 한 글자 줄여 다음 자리가 한 칸 밀린다 —
       그러면 줄은 지워져도 뒤 줄 번호·줄 수가 안 고쳐져 한글이 표를 못 그린다(빈 쪽, 2026-09-26 협의회 명부). */
  function dropRows(xml, addrs) {
    var ps = scan(xml), hits = 0, seen = {}, targets = [];
    ps.filter(function (p) { return addrs.indexOf(p.addr) >= 0; }).forEach(function (p) {
      var r = rowOf(xml, p.start), t = r && tableOf(xml, r.a); if (!t) return;
      var k = rowSpan(xml.slice(t.a, r.a)), key = t.a + ':' + k;
      if (!seen[key]) { seen[key] = 1; targets.push({ t: t.a, k: k }); }
    });
    /* 뒤 줄부터 — 앞 줄의 차례·표 시작 자리는 뒤를 지워도 그대로다(바뀌는 줄 수 글자는 표 시작보다 뒤) */
    targets.sort(function (x, y) { return (y.t - x.t) || (y.k - x.k); });
    targets.forEach(function (g) {
      var re = /<hp:tr[ >]/g, m, i = -1; re.lastIndex = g.t;
      while ((m = re.exec(xml)) && ++i < g.k) { /* 몇째 줄까지 */ }
      var r = m && rowOf(xml, m.index + 1); if (!r) return;
      xml = replaceRows(xml, r.a, r.b, []); hits++;
    });
    return { xml: xml, hits: hits };
  }
  function expand(xml, V, opts) {
    opts = opts || {};
    var guard = 0, filled = 0, unknown = {};
    for (;;) {
      if (++guard > 20) break;
      var ps = scan(xml), start = null, end = null, m;
      for (var i = 0; i < ps.length && !end; i++) {
        RP_RE.lastIndex = 0;
        while ((m = RP_RE.exec(ps[i].text))) {
          if (!start && m[1] === '#') start = { p: ps[i], page: m[2] === '쪽:', row: m[2] === '행:', name: m[3] };
          else if (start && m[1] === '/' && m[3] === start.name) { end = { p: ps[i] }; break; }
        }
      }
      if (!start || !end) break;
      var a, b, rowsA = null;
      if (start.row) {
        var r1 = rowOf(xml, start.p.start), r2 = rowOf(xml, end.p.start);
        if (!r1 || !r2) break;
        a = r1.a; b = r2.b; rowsA = true;
      } else if (start.page) {
        /* 묶음을 품은 «맨 바깥» 문단 — 주소에 점이 없는 것(P3) 가운데 그 자리를 품은 것 */
        var tops = ps.filter(function (p) { return /^P\d+$/.test(p.addr); });
        var outer = function (q) { return tops.filter(function (t) { return t.start <= q.start && q.end <= t.end; })[0] || q; };
        a = outer(start.p).start; b = outer(end.p).end;
      } else { a = start.p.start; b = end.p.end; }
      var block = xml.slice(a, b);
      var tag = function (k) { return '{{' + k + (start.page ? '쪽:' : start.row ? '행:' : '') + start.name + '}}'; };
      block = replaceText(block, [{ find: tag('#'), to: '', all: true }, { find: tag('/'), to: '', all: true }], { lines: 'keep1' }).xml;
      /* 값이 «숫자»면 그 수만큼 빈 벌(0 이면 묶음째 없앤다) — 명부의 여유 빈 줄처럼 사람 수에 따라 늘고 주는 자리.
         목록이 비면 빈 한 벌이다(서명란이 사라지면 날인받을 자리가 없다) — 숫자 0 과 다르다 */
      var cnt = typeof V[start.name] === 'number' ? Math.max(0, Math.floor(V[start.name])) : -1;
      var empty = cnt < 0 && !(Array.isArray(V[start.name]) && V[start.name].length);
      var list = cnt >= 0 ? Array.apply(null, Array(cnt)).map(function () { return {}; }) : empty ? [{}] : V[start.name];
      if (cnt >= 0) empty = true;                                          // 빈 벌의 값 자리는 비운다
      var inBlock = empty ? Object.keys(markers(block)) : [];
      var outs = list.map(function (item, idx) {
        var VV = {}; Object.keys(V).forEach(function (k) { VV[k] = V[k]; });
        inBlock.forEach(function (k) { if (!(k in VV)) VV[k] = ''; });   // 빈 한 벌 — 항목 값 자리는 밑줄로
        Object.keys(item || {}).forEach(function (k) { VV[k] = item[k]; });
        VV['번호'] = String(idx + 1);
        var r = fill(block, VV, opts);
        filled += r.filled; r.unknown.forEach(function (k) { unknown[k] = 1; });
        var x = r.xml;
        if (start.page && idx > 0) {
          x = x.replace(/<hp:secPr\b[\s\S]*?<\/hp:secPr>/, '').replace(/<hp:ctrl>\s*<hp:colPr\b[^>]*\/>\s*<\/hp:ctrl>/, '')
            .replace(/<hp:p\b([^>]*?)\bpageBreak="0"/, '<hp:p$1pageBreak="1"');
        }
        return x;
      });
      xml = rowsA ? replaceRows(xml, a, b, outs) : xml.slice(0, a) + outs.join('') + xml.slice(b);
    }
    return { xml: xml, filled: filled, unknown: Object.keys(unknown) };
  }

  /* 쉬운 글 뽑기 — 검사·AI 도우미·남의 자료 찾기용 */
  function textOf(xml) { return scan(xml).map(function (p) { return p.text; }).filter(Boolean).join('\n'); }

  var api = { scan: scan, replaceText: replaceText, markers: markers, fill: fill, expand: expand, dropRows: dropRows, textOf: textOf,
    BLANK: BLANK, atMatch: atMatch, _dec: dec, _enc: enc };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PuHwpxFill = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
