/* ══════════════════════════════════════════════════════════════════
   pu-hwp-keep.js — 원본 살려 고치기 (규정관리가 부른다)

   회사가 준 원본 한글 파일(.hwp/.hwpx)을 «그대로 두고» 확정된 신구대조표의
   바뀐 조만 반영한다. 글꼴·머리말·표·쪽번호·안 바뀐 조는 한 글자도 건드리지 않는다.
   목업 ③ 승인(2026-09-26 「추천대로」): 원본과 같은 형식으로 저장 · 제목이 다른 조는 사람이 고른다.

   ── 시험으로 정한 규칙 (status/2026-09-26-rules-keep-original-test.md) ──
   ① 새로 넣은 글자는 «옆 조문의 글자 모양» 을 입힌다. 안 하면 빈 문단의 굵은 조 머리
      모양을 물려받아 통째로 굵게 나온다. 모양 번호는 그 문서에서 그때그때 읽는다(박지 않는다).
   ② .hwp 를 .hwpx 로 바꿔 저장하지 않는다 — 띄어쓰기가 160줄 어긋났다. 원본 형식 그대로.
   ③ 새 항은 같은 조의 «항 문단» 모양을 입힌다(조 머리 문단 모양을 물려받으면 들여쓰기가 틀린다).
   ④ 표에 줄을 넣으면 칸 번호가 밀린다 → 고치기는 «문서 뒤쪽부터» 한다.
   ⑤ 줄(문단) 단위로 견주어 «같은 줄은 손대지 않고», 바뀐 줄 안에서도 앞뒤 공통 글자는 남긴다.

   엔진은 rhwp(HwpDocument). 이 파일은 엔진을 받아서 쓸 뿐 싣지 않는다 — 검사는 가짜 문서로 돈다.
   ⚠ 원본 바이트는 건드리지 않는다. 늘 사본으로 새 문서를 열어 고친다.
   ══════════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';
  if (!root || root.PuHwpKeep) return;

  /* 조 머리 — 「제24조(휴게)」「제24조의2 (휴게시간 선택)」「제10조 삭제」 */
  var HEAD = /^\s*제\s*(\d+)\s*조(?:\s*의\s*(\d+))?\s*(?:[(（]\s*([^)）]{0,40}?)\s*[)）]|(?=\s*삭\s*제))/;
  var HEAD_NUM = /^\s*제\s*\d+\s*조(?:\s*의\s*\d+)?/;
  var STOP = /^\s*(제\s*\d+\s*장|제\s*\d+\s*절|부\s*칙)/;
  var TOC_TAIL = /(\s|\.{2,}|·{2,}|…)\d{1,3}\s*$/;

  function J(s) { if (typeof s !== 'string') return s; try { return JSON.parse(s); } catch (e) { return s; } }
  function norm(s) { return String(s == null ? '' : s).replace(/\s+/g, ''); }
  function lead(s) { var m = /^\s*/.exec(String(s || '')); return m ? m[0] : ''; }
  function keyOf(num, sub) { return String(num) + (sub ? '의' + sub : ''); }
  /* 조 머리 길이 — 「제24조(휴게)」 까지. 삭제 꼴은 「제10조」 까지 */
  function headLen(t) {
    var m = HEAD.exec(String(t || ''));
    if (m && m[3] != null) return m[0].length;
    var n = HEAD_NUM.exec(String(t || ''));
    return n ? n[0].length : 0;
  }

  /* ── 문단 손잡이 — 본문 문단과 표 칸 문단을 같은 모양으로 다룬다 ── */
  function P(doc, base) {
    var S = base.sec;
    if (base.t === 'cell') {
      var a = [S, base.pp, base.ci, base.cell];
      var at = function (k) { return a.concat([k]); };
      return {
        base: base,
        count: function () { return doc.getCellParagraphCount.apply(doc, a); },
        len: function (k) { return doc.getCellParagraphLength.apply(doc, at(k)); },
        text: function (k) { var L = this.len(k); return L ? doc.getTextInCell.apply(doc, at(k).concat([0, L])) : ''; },
        del: function (k, o, n) { if (n > 0) J(doc.deleteTextInCell.apply(doc, at(k).concat([o, n]))); },
        ins: function (k, o, s) { if (s) J(doc.insertTextInCell.apply(doc, at(k).concat([o, s]))); },
        split: function (k, o) { return J(doc.splitParagraphInCell.apply(doc, at(k).concat([o]))); },
        charId: function (k, o) { return J(doc.getCellCharPropertiesAt.apply(doc, at(k).concat([o]))).charShapeId; },
        setChar: function (k, x, y, id) { if (y > x && id != null) J(doc.setCharShapeIdInCell.apply(doc, at(k).concat([x, y, id]))); },
        paraId: function (k) { return J(doc.getCellParaPropertiesAt.apply(doc, at(k))).paraShapeId; },
        setPara: function (k, id) { if (id != null) J(doc.setCellParaShapeId.apply(doc, at(k).concat([id]))); },
        /* 문단 k 를 없앤다 — 앞 문단 끝에서 이 문단 끝까지 지우면 둘이 붙고 이 문단 글자는 사라진다 */
        remove: function (k) {
          if (k <= 0) { this.del(k, 0, this.len(k)); return; }
          J(doc.deleteRangeInCell.apply(doc, a.concat([k - 1, this.len(k - 1), k, this.len(k)])));
        }
      };
    }
    return {
      base: base,
      count: function () { return doc.getParagraphCount(S); },
      len: function (k) { return doc.getParagraphLength(S, k); },
      text: function (k) { var L = this.len(k); return L ? doc.getTextRange(S, k, 0, L) : ''; },
      del: function (k, o, n) { if (n > 0) J(doc.deleteText(S, k, o, n)); },
      ins: function (k, o, s) { if (s) J(doc.insertText(S, k, o, s)); },
      split: function (k, o) { return J(doc.splitParagraph(S, k, o)); },
      charId: function (k, o) { return J(doc.getCharPropertiesAt(S, k, o)).charShapeId; },
      setChar: function (k, x, y, id) { if (y > x && id != null) J(doc.setCharShapeId(S, k, x, y, id)); },
      paraId: function (k) { return J(doc.getParaPropertiesAt(S, k)).paraShapeId; },
      setPara: function (k, id) { if (id != null) J(doc.setParaShapeId(S, k, id)); },
      remove: function (k) { this.del(k, 0, this.len(k)); J(doc.mergeParagraph(S, k)); }
    };
  }
  function sameBase(a, b) {
    return a.t === b.t && a.sec === b.sec && (a.t === 'body' || (a.pp === b.pp && a.ci === b.ci && a.cell === b.cell));
  }
  /* 문서 순서 열쇠 — [구역, 본문 문단(표면 그 표가 걸린 문단), 칸(+1), 칸 안 문단] */
  function orderKey(base, k) {
    return base.t === 'cell' ? [base.sec, base.pp, base.cell + 1, k] : [base.sec, k, 0, 0];
  }
  function cmpKey(a, b) { for (var i = 0; i < 4; i++) { if (a[i] !== b[i]) return a[i] - b[i]; } return 0; }

  /* ── 1. 훑기 — 문서 안의 조 머리를 모두 찾는다 ──
     ⚠ 목차·부록(다른 규정의 제1조…)도 걸린다. 고르는 것은 pickRun 이 한다. */
  function scan(doc) {
    var seen = {}, cands = [];
    /* ⚠ 「조의」 를 빼면 가지번호 조(제24조의2(…))를 못 찾는다 — 「조(」 가 안 들어 있다 */
    ['조(', '조 (', '조（', '조의', '조 삭제', '조삭제'].forEach(function (q) {
      var hits = J(doc.searchAllText(q, false, true)) || [];
      if (!Array.isArray(hits)) return;
      hits.forEach(function (h) {
        var cc = h.cellContext, base, k;
        if (cc) { base = { t: 'cell', sec: h.sec, pp: cc.parentPara, ci: cc.ctrlIdx, cell: cc.cellIdx }; k = cc.cellPara; }
        else { base = { t: 'body', sec: h.sec }; k = h.para; }
        var id = JSON.stringify([base, k]);
        if (seen[id]) return;
        seen[id] = 1;
        var pa = P(doc, base), text = pa.text(k), m = HEAD.exec(text);
        if (!m) return;
        cands.push({ num: +m[1], sub: m[2] ? +m[2] : 0, title: (m[3] || '').trim(), deleted: m[3] == null,
          base: base, k: k, head: text, ord: orderKey(base, k) });
      });
    });
    cands.sort(function (a, b) { return cmpKey(a.ord, b.ord); });
    /* 조의 끝 — 같은 곳(본문 구역·같은 칸) 안의 다음 조 머리 또는 장·절·부칙 머리 앞까지. 끝의 빈 문단은 뺀다 */
    cands.forEach(function (c, i) {
      var pa = P(doc, c.base), n = pa.count(), end = n - 1;
      for (var j = i + 1; j < cands.length; j++) {
        if (sameBase(cands[j].base, c.base)) { end = cands[j].k - 1; break; }
      }
      /* 본문에 표가 끼면(표 안 조문) 그 표가 걸린 문단 앞에서 끊는다 */
      if (c.base.t === 'body') {
        for (var t = i + 1; t < cands.length; t++) {
          var o = cands[t];
          if (o.base.t === 'cell' && o.base.sec === c.base.sec && o.base.pp > c.k) { end = Math.min(end, o.base.pp - 1); break; }
        }
      }
      var lines = [];
      for (var q = c.k; q <= end; q++) {
        var tx = pa.text(q);
        if (q > c.k && STOP.test(tx)) { end = q - 1; break; }
        lines.push(tx);
      }
      while (end > c.k && !String(lines[lines.length - 1] || '').trim()) { lines.pop(); end--; }
      c.end = end;
      c.lines = lines;
      c.toc = lines.length === 1 && lines[0].length < 90 && TOC_TAIL.test(lines[0]);
      c.key = keyOf(c.num, c.sub);
    });
    return cands;
  }

  /* ── 2. 본문 고르기 — 목차·부록을 떼어 내고 «그 취업규칙 본문» 조 목록 하나를 고른다 ──
     조 번호가 다시 작아지는 자리에서 한 줄기가 끊긴다(부록은 제1조부터 다시 시작한다).
     줄기마다 점수 = 신구대조표 조와 번호·제목이 맞는 수 ×1000 + 글자 수/100 (목차는 글자가 적다) */
  function pickRun(cands, want) {
    var runs = [], cur = null, last = null;
    cands.forEach(function (c) {
      if (c.toc) return;
      var v = c.num * 1000 + c.sub;
      if (!cur || v <= last) { cur = []; runs.push(cur); }
      cur.push(c); last = v;
    });
    var W = {};
    (want || []).forEach(function (w) { if (w && w.num) W[keyOf(w.num, w.sub)] = norm(w.title); });
    var best = null, bestScore = -1;
    runs.forEach(function (r) {
      var hit = 0, chars = 0;
      r.forEach(function (c) { if (W[c.key] !== undefined && (W[c.key] === norm(c.title) || !W[c.key])) hit++; chars += c.lines.join('').length; });
      var s = hit * 1000 + chars / 100 + r.length;
      if (s > bestScore) { bestScore = s; best = r; }
    });
    return best || [];
  }

  /* ── 3. 계획 — 바뀐 조마다 «원본의 어디에» 넣는지 ──
     changes: [{ id, kind:'개정'|'삭제'|'신설', num, sub, title(원래 제목), lines:[…],
                 delText, newNo, anchor:{num,sub}|null }]
     돌려주는 줄: { …change, state:'ok'|'place'|'confirm'|'missing'|'differ', target, why }
     개정에는 orig(검토 화면이 읽은 원문)를 함께 준다 — 원본 파일 글자와 견주는 데 쓴다. */
  function plan(run, changes) {
    var by = {};
    run.forEach(function (c) { by[c.key] = c; });
    return (changes || []).map(function (ch) {
      var row = Object.assign({}, ch, { state: 'ok', target: null, why: '' });
      if (ch.kind === '신설') {
        var an = ch.anchor ? by[keyOf(ch.anchor.num, ch.anchor.sub)] : run[run.length - 1];
        if (!an) { row.state = 'confirm'; row.why = '앞 조를 원본에서 찾지 못함 — 넣을 자리를 고르세요'; row.target = run[run.length - 1] || null; }
        else { row.state = 'place'; row.target = an; row.why = (ch.anchor ? an.key : '맨 끝') + ' 뒤'; }
        return row;
      }
      var t = by[keyOf(ch.num, ch.sub)];
      if (!t) { row.state = 'missing'; row.why = '원본에서 이 조를 찾지 못함 — 고르거나 건너뛰세요'; return row; }
      row.target = t;
      if (norm(t.title) !== norm(ch.title) && !(t.deleted && !ch.title)) {
        row.state = 'confirm';
        row.why = '원본 제목 「' + (t.title || '없음') + '」 — 신구대조표 「' + (ch.title || '없음') + '」 와 다름';
        return row;
      }
      /* ★ 원본 파일의 그 조 글자 = 검토 화면이 읽은 원문 이어야 «통째로» 바꿀 수 있다.
         표준취업규칙처럼 조문 칸 옆에 해설 칸이 있는 표는 읽을 때 해설이 원문에 섞인다 —
         그 글로 바꾸면 해설이 조문 칸에 들어가고, 검증도 같은 글로 하니 «통과» 해 버린다(2026-09-26 실측).
         그래서 다르면 멈추고 사람에게 두 글을 보여 준다. 삭제는 조를 통째로 지우니 보지 않는다. */
      if (ch.kind === '개정' && ch.orig != null && norm(t.lines.join('')) !== norm(ch.orig)) {
        row.state = 'differ';
        row.why = '원본 파일의 이 조 글자가 검토 화면의 원문과 다릅니다(표의 해설 칸이 섞였거나 읽기 차이) — 두 글을 보고 고르세요';
      }
      return row;
    });
  }

  /* ── 4. 고치기 ── */
  function lcs(a, b) {
    var n = a.length, m = b.length, dp = [], i, j;
    for (i = 0; i <= n; i++) { dp.push(new Array(m + 1).fill(0)); }
    for (i = n - 1; i >= 0; i--) for (j = m - 1; j >= 0; j--)
      dp[i][j] = norm(a[i]) === norm(b[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    var out = []; i = 0; j = 0;
    while (i < n && j < m) {
      if (norm(a[i]) === norm(b[j])) { out.push([i, j]); i++; j++; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) i++; else j++;
    }
    return out;
  }
  /* 한 줄 안에서 — 앞뒤 공통 글자는 남기고 가운데만 바꾼다 */
  function charEdit(pa, k, oldT, newT, ids) {
    var o = String(oldT), n = String(newT);
    if (o === n) return;
    var p = 0; while (p < o.length && p < n.length && o[p] === n[p]) p++;
    var s = 0; while (s < o.length - p && s < n.length - p && o[o.length - 1 - s] === n[n.length - 1 - s]) s++;
    pa.del(k, p, o.length - p - s);
    var mid = n.slice(p, n.length - s);
    if (!mid) return;
    pa.ins(k, p, mid);
    /* 조 머리 경계에 걸친 글자만 모양을 정해 준다 — 본문 한가운데 넣은 글자는 앞 글자 모양을 따르게 둔다 */
    var h = headLen(n);
    if (h && p <= h) {
      var e = p + mid.length;
      pa.setChar(k, p, Math.min(e, h), ids.head);
      if (e > h) pa.setChar(k, Math.max(p, h), e, ids.body);
    }
  }
  /* 새 줄의 앞 빈칸 — 원문이 「  ② …」 처럼 들여 쓰면 새 항도 같게 */
  function withLead(t, sample) {
    var s = String(t || '');
    if (/^\s/.test(s) || !sample) return s;
    return /^[①-⑳0-9]/.test(s.trim()) ? lead(sample) + s : s;
  }
  /* 그 조의 모양 번호 — 조 머리·본문 글자, 조 머리 문단·항 문단 */
  function idsOf(pa, art) {
    var first = pa.text(art.k), h = headLen(first);
    var ids = { head: pa.charId(art.k, Math.min(1, Math.max(0, first.length - 1))), body: null, headPara: pa.paraId(art.k), itemPara: null, lead: '' };
    if (first.length > h + 1) ids.body = pa.charId(art.k, Math.min(first.length - 1, h + 2));
    for (var q = art.k + 1; q <= art.end; q++) {
      var t = pa.text(q);
      if (!t.trim()) continue;
      if (ids.body == null) ids.body = pa.charId(q, Math.min(t.length - 1, lead(t).length + 1));
      if (ids.itemPara == null) { ids.itemPara = pa.paraId(q); ids.lead = lead(t); }
    }
    if (ids.body == null) ids.body = ids.head;
    if (ids.itemPara == null) ids.itemPara = ids.headPara;
    return ids;
  }
  /* 조 하나의 줄들을 새 줄들로 — 같은 줄은 그대로, 바뀐 줄은 가운데만, 새 줄은 쪼개 넣고, 빠진 줄은 지운다.
     ⚠ 뒤에서부터 한다 — 앞에서 하면 문단 번호가 밀린다. */
  function rewrite(pa, art, newLines, ids) {
    var old = [];
    for (var q = art.k; q <= art.end; q++) old.push(pa.text(q));
    var nl = newLines.map(function (t, i) { return i ? withLead(t, ids.lead) : t; });
    var pairs = lcs(old, nl);
    var segs = [], pi = 0, pj = 0;
    pairs.concat([[old.length, nl.length]]).forEach(function (pr) {
      if (pr[0] > pi || pr[1] > pj) segs.push([pi, pr[0], pj, pr[1]]);
      pi = pr[0] + 1; pj = pr[1] + 1;
    });
    for (var s = segs.length - 1; s >= 0; s--) {
      var a = segs[s][0], b = segs[s][1], c = segs[s][2], d = segs[s][3];
      var m = Math.min(b - a, d - c);
      for (var x = b - 1; x >= a + m; x--) pa.remove(art.k + x);                 // 빠진 줄
      var after = art.k + a + m - 1;                                            // 새 줄을 붙일 앞 문단
      for (var y = d - 1; y >= c + m; y--) {                                   // 새 줄 — 거꾸로 넣으면 순서가 맞는다
        var t = nl[y];
        if (after < art.k) { pa.split(art.k, 0); pa.ins(art.k, 0, t); pa.setChar(art.k, 0, t.length, ids.body); pa.setPara(art.k, ids.itemPara); continue; }
        pa.split(after, pa.len(after));
        pa.ins(after + 1, 0, t);
        pa.setChar(after + 1, 0, t.length, ids.body);
        pa.setPara(after + 1, ids.itemPara);
      }
      for (var z = m - 1; z >= 0; z--) charEdit(pa, art.k + a + z, old[a + z], nl[c + z], ids);   // 바뀐 줄
    }
  }
  function applyDelete(pa, art, text, ids) {
    for (var q = art.end; q > art.k; q--) pa.remove(q);
    var o = pa.text(art.k);
    charEdit(pa, art.k, o, text, ids);
    var h = headLen(text);
    pa.setChar(art.k, 0, h, ids.head);
    pa.setChar(art.k, h, text.length, ids.body);
  }
  /* 새 조 — 본문이면 앞 조 끝 문단을 쪼개고, 표면 그 줄 아래에 줄을 하나 넣는다 */
  function applyInsert(doc, pa, anchor, lines, ids) {
    var h = headLen(lines[0]);
    var put = function (P2, k, t, first) {
      P2.ins(k, 0, t);
      if (first) { P2.setChar(k, 0, h, ids.head); P2.setChar(k, h, t.length, ids.body); P2.setPara(k, ids.headPara); }
      else { P2.setChar(k, 0, t.length, ids.body); P2.setPara(k, ids.itemPara); }
    };
    if (anchor.base.t === 'cell') {
      var b = anchor.base, info = J(doc.getCellInfo(b.sec, b.pp, b.ci, b.cell));
      J(doc.insertTableRow(b.sec, b.pp, b.ci, info.row + (info.rowSpan || 1) - 1, true));
      var dims = J(doc.getTableDimensions(b.sec, b.pp, b.ci)), left = -1;
      for (var c = 0; c < (dims.cellCount || 0); c++) {
        var ci = J(doc.getCellInfo(b.sec, b.pp, b.ci, c));
        if (ci && ci.row === info.row + (info.rowSpan || 1) && ci.col === info.col) { left = c; break; }
      }
      if (left < 0) throw new Error('새 줄의 칸을 찾지 못했습니다');
      var P2 = P(doc, { t: 'cell', sec: b.sec, pp: b.pp, ci: b.ci, cell: left });
      put(P2, 0, lines[0], true);
      for (var i = 1; i < lines.length; i++) { P2.split(i - 1, P2.len(i - 1)); put(P2, i, withLead(lines[i], ids.lead), false); }
      return;
    }
    /* 조 사이에 빈 줄을 두는 문서면 그 모양을 따른다 — 「앞 조 · 빈 줄 · 새 조 · 빈 줄 · 다음 조」 */
    var at = anchor.end;
    var gap = at + 1 < pa.count() && !pa.text(at + 1).trim();
    if (gap) at = at + 1;
    for (var j = 0; j < lines.length; j++) {
      pa.split(at + j, pa.len(at + j));
      put(pa, at + j + 1, j ? withLead(lines[j], ids.lead) : lines[j], j === 0);
    }
    if (gap) { var last = at + lines.length; pa.split(last, pa.len(last)); }
  }
  /* 부칙 — 원본 부칙의 마지막 줄 뒤에 새 줄을 붙인다(그 줄의 글자·문단 모양을 따른다) */
  function findLine(doc, run, text) {
    var want = norm(text);
    if (!want) return null;
    var hits = J(doc.searchAllText(String(text).trim().slice(0, 20), false, true)) || [];
    for (var i = hits.length - 1; i >= 0; i--) {
      var h = hits[i], cc = h.cellContext;
      var base = cc ? { t: 'cell', sec: h.sec, pp: cc.parentPara, ci: cc.ctrlIdx, cell: cc.cellIdx } : { t: 'body', sec: h.sec };
      var k = cc ? cc.cellPara : h.para, pa = P(doc, base);
      if (norm(pa.text(k)) === want) return { base: base, k: k, ord: orderKey(base, k) };
    }
    return null;
  }

  /* 한 번에 — rows 는 plan 이 만든 것(사람이 고른 target 포함). addendum: {after:'옛 부칙 마지막 줄', line:'새 부칙 줄'} */
  function apply(doc, rows, addendum) {
    var ops = [];
    rows.forEach(function (r) {
      if (!r.target || r.skip) return;
      var end = r.target.end;
      ops.push({ r: r, ord: r.kind === '신설' ? orderKey(r.target.base, end).concat([1]) : r.target.ord.concat([0]) });
    });
    var ad = null;
    if (addendum && addendum.line) {
      ad = findLine(doc, null, addendum.after);
      if (ad) ops.push({ ad: ad, ord: ad.ord.concat([2]) });
    }
    /* 뒤에서부터. 같은 자리에 넣는 신설이 여럿이면 뒤에 올 것부터 넣어야 순서가 맞는다 */
    ops.forEach(function (o, i) { o.i = i; });
    ops.sort(function (a, b) { var c = cmpKey(b.ord, a.ord); return c || (b.ord[4] - a.ord[4]) || (b.i - a.i); });
    var done = [];
    ops.forEach(function (o) {
      if (o.ad) {
        var pa0 = P(doc, o.ad.base), t0 = pa0.text(o.ad.k), cid = pa0.charId(o.ad.k, Math.max(0, lead(t0).length)), pid = pa0.paraId(o.ad.k);
        pa0.split(o.ad.k, pa0.len(o.ad.k));
        var line = lead(t0) + String(addendum.line).trim();
        pa0.ins(o.ad.k + 1, 0, line); pa0.setChar(o.ad.k + 1, 0, line.length, cid); pa0.setPara(o.ad.k + 1, pid);
        done.push({ kind: '부칙' });
        return;
      }
      var r = o.r, pa = P(doc, r.target.base), ids = idsOf(pa, r.target);
      if (r.kind === '개정') rewrite(pa, r.target, r.lines, ids);
      else if (r.kind === '삭제') applyDelete(pa, r.target, r.delText, ids);
      else if (r.kind === '신설') applyInsert(doc, pa, r.target, r.lines, ids);
      done.push({ id: r.id, kind: r.kind });
    });
    return { done: done, addendumPlaced: !!ad };
  }

  /* ── 5. 저장 전 검증 — 고친 문서를 «다시 열어» 바뀐 조는 새 글자, 나머지 조는 원본 글자인지 ── */
  function verify(before, after, rows) {
    var A = {}, B = {}, issues = [];
    before.forEach(function (c) { A[c.key] = c; });
    after.forEach(function (c) { B[c.key] = c; });
    var touched = {};
    rows.forEach(function (r) {
      if (r.skip || !r.target) return;
      if (r.kind === '신설') {
        var m = /^제\s*(\d+)\s*조(?:\s*의\s*(\d+))?/.exec(r.newNo || '');
        if (!m) { issues.push({ key: String(r.newNo || ''), why: '신설 조 번호를 읽지 못했습니다' }); return; }
        var key = keyOf(+m[1], m[2] ? +m[2] : 0);
        touched[key] = 1;
        if (!B[key] || norm(B[key].lines.join('')) !== norm(r.lines.join(''))) issues.push({ key: key, why: '신설 조가 원본에 들어가지 않았습니다' });
        return;
      }
      var k2 = keyOf(r.num, r.sub); touched[k2] = 1;
      if (!B[k2]) { issues.push({ key: k2, why: '고친 뒤 이 조를 찾지 못했습니다' }); return; }
      var want = r.kind === '삭제' ? r.delText : r.lines.join('');
      if (norm(B[k2].lines.join('')) !== norm(want)) issues.push({ key: k2, why: '고친 글자가 신구대조표와 다릅니다' });
    });
    Object.keys(A).forEach(function (k) {
      if (touched[k]) return;
      if (!B[k]) { issues.push({ key: k, why: '안 고친 조가 사라졌습니다' }); return; }
      if (norm(A[k].lines.join('')) !== norm(B[k].lines.join(''))) issues.push({ key: k, why: '안 고친 조의 글자가 바뀌었습니다' });
    });
    return { ok: issues.length === 0, issues: issues };
  }

  /* 원본 형식 — .hwp(CFB) 인지 .hwpx(ZIP) 인지 첫 바이트로 가른다. 다른 것이면 이 길을 안 쓴다 */
  function formatOf(bytes) {
    var b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
    if (b.length > 8 && b[0] === 0xD0 && b[1] === 0xCF && b[2] === 0x11 && b[3] === 0xE0) return 'hwp';
    /* .hwpx 와 워드(.docx)는 둘 다 ZIP 이다 — .hwpx 는 첫 칸이 «mimetype» 이고 그 안이 「application/hwp+zip」 */
    if (b.length > 60 && b[0] === 0x50 && b[1] === 0x4B) {
      var head = '';
      for (var i = 30; i < Math.min(b.length, 120); i++) head += String.fromCharCode(b[i]);
      return /^mimetype/.test(head) && head.indexOf('hwp+zip') > 0 ? 'hwpx' : '';
    }
    return '';
  }
  function exportSame(doc, fmt) { return fmt === 'hwpx' ? doc.exportHwpx() : doc.exportHwp(); }

  root.PuHwpKeep = {
    HEAD: HEAD, headLen: headLen, norm: norm, scan: scan, pickRun: pickRun, plan: plan, apply: apply,
    verify: verify, formatOf: formatOf, exportSame: exportSame, _P: P, _lcs: lcs
  };
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));

if (typeof module !== 'undefined' && module.exports) {
  module.exports = (typeof window !== 'undefined' ? window : globalThis).PuHwpKeep;
}
