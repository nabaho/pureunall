/* ══════════════════════════════════════════════════════════════════
   pu-rules-filecmp.js — 두 파일 견주기(신구대조) 부품 (2026-09-30 목업 ③ 「추천대로」)

   회사가 스스로 고쳐 온 새 규칙 파일과 지금 신고된 옛 파일을 «조 단위»로 견준다.
   조번호는 한 조만 끼워도 뒤가 다 밀리므로 번호가 아니라 «제목» 이 먼저다:
     ① 번호·제목이 같다  ② 제목이 같다(가장 가까운 자리)  ③ 본문이 같다  → 짝
     남은 새 조 = 「새 조」, 남은 옛 조 = 「없어짐」.
   짝이 된 것은 본문이 같으면 「같음」(번호가 다르면 「번호 바뀜」), 다르면 「바뀜」.

   ⚠ 글만 다룬다 — 파일을 읽는 것(kordoc)·검토 기준(evaluate)은 규정관리가 넘겨준다.
   ⚠ 문서는 브라우저 밖으로 안 나간다. 이 부품은 어디에도 보내지 않는다.
   ══════════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';

  var HEAD = /^\s*제\s*\d+\s*조(?:\s*의\s*\d+)?\s*(?:[(（<〈［\[][^)）>〉］\]\n]{0,40}[)）>〉］\]]?)?\s*/;
  function ws(s) { return String(s || '').replace(/\s+/g, ''); }
  function titleKey(a) { return String((a && a.title) || '').replace(/[\s·ㆍ,()]/g, '').replace(/등$/, ''); }
  function bodyOf(a) { return String((a && a.body) || '').replace(HEAD, '').trim(); }
  function bodyKey(a) { return ws(bodyOf(a)); }

  /* 짝짓기 — 돌려주는 것: { rows:[{kind, old, now}], counts } (새 파일 순서, 없어진 조는 그 옛 자리에) */
  function compare(oldArts, newArts) {
    oldArts = oldArts || []; newArts = newArts || [];
    var pairOf = new Array(newArts.length), usedOld = {};
    function take(ni, oi) { pairOf[ni] = oi; usedOld[oi] = true; }
    /* ① 번호와 제목이 같다 */
    newArts.forEach(function (na, ni) {
      for (var oi = 0; oi < oldArts.length; oi++) {
        if (usedOld[oi]) continue;
        if (oldArts[oi].label === na.label && titleKey(oldArts[oi]) === titleKey(na)) { take(ni, oi); return; }
      }
    });
    /* ② 제목이 같다 — 여럿이면 자리가 가까운 것 */
    newArts.forEach(function (na, ni) {
      if (pairOf[ni] != null || !titleKey(na)) return;
      var best = -1, gap = Infinity;
      oldArts.forEach(function (oa, oi) {
        if (usedOld[oi] || titleKey(oa) !== titleKey(na)) return;
        var g = Math.abs(oi - ni);
        if (g < gap) { gap = g; best = oi; }
      });
      if (best >= 0) take(ni, best);
    });
    /* ③ 본문이 같다(제목만 고친 조) — 너무 짧은 본문은 우연히 같을 수 있어 뺀다 */
    newArts.forEach(function (na, ni) {
      if (pairOf[ni] != null) return;
      var k = bodyKey(na);
      if (k.length < 10) return;
      for (var oi = 0; oi < oldArts.length; oi++) {
        if (!usedOld[oi] && bodyKey(oldArts[oi]) === k) { take(ni, oi); return; }
      }
    });

    var rows = [], emitted = {};
    function flushOld(upto) {
      for (var oi = 0; oi < upto; oi++) {
        if (!usedOld[oi] && !emitted[oi]) { emitted[oi] = true; rows.push({ kind: '없어짐', old: oldArts[oi], now: null }); }
      }
    }
    newArts.forEach(function (na, ni) {
      var oi = pairOf[ni];
      if (oi == null) { rows.push({ kind: '새 조', old: null, now: na }); return; }
      flushOld(oi);
      var oa = oldArts[oi], same = bodyKey(oa) === bodyKey(na) && titleKey(oa) === titleKey(na);
      var kind = same ? (oa.label === na.label ? '같음' : '번호 바뀜') : '바뀜';
      rows.push({ kind: kind, old: oa, now: na, renum: oa.label !== na.label });
    });
    flushOld(oldArts.length);
    var counts = { '바뀜': 0, '새 조': 0, '없어짐': 0, '번호 바뀜': 0, '같음': 0 };
    rows.forEach(function (r) { counts[r.kind]++; });
    return { rows: rows, counts: counts };
  }

  /* 낱말 단위 차이 — [{t:'='|'-'|'+', s}] . 숫자는 따로 끊어 「15일→12일」 에서 15·12 만 칠한다 */
  var TOK = /\s+|[0-9]+|[가-힣]+|[A-Za-z]+|[^\s0-9가-힣A-Za-z]/g;
  function tokens(s) { return String(s || '').match(TOK) || []; }
  function wordDiff(a, b) {
    var x = tokens(a), y = tokens(b), n = x.length, m = y.length;
    if (n * m > 400000) return [{ t: '-', s: String(a || '') }, { t: '+', s: String(b || '') }];   // 너무 크면 통째로
    var L = [], i, j;
    for (i = 0; i <= n; i++) L.push(new Uint16Array(m + 1));
    for (i = n - 1; i >= 0; i--) for (j = m - 1; j >= 0; j--)
      L[i][j] = x[i] === y[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    var out = [];
    function push(t, s) { var p = out[out.length - 1]; if (p && p.t === t) p.s += s; else out.push({ t: t, s: s }); }
    i = 0; j = 0;
    while (i < n && j < m) {
      if (x[i] === y[j]) { push('=', x[i]); i++; j++; }
      else if (L[i + 1][j] >= L[i][j + 1]) { push('-', x[i]); i++; }
      else { push('+', y[j]); j++; }
    }
    while (i < n) push('-', x[i++]);
    while (j < m) push('+', y[j++]);
    return out;
  }

  /* 바뀐 조에만 검토 기준 — 새 글에서 «위반의심» 이 난 기준을 그 조 곁에 단다.
     옛 글에서도 같은 기준이 위반의심이었으면 was:true (이번에 새로 생긴 것은 아니다). */
  function flag(rows, resOld, resNew) {
    function sus(res) { return (res || []).filter(function (f) { return f && f.status === '위반의심'; }); }
    var oldSus = {};
    sus(resOld).forEach(function (f) { oldSus[f.rule.id] = true; });
    var total = 0, fresh = 0;
    rows.forEach(function (r) {
      r.flags = [];
      if (!r.now || (r.kind !== '바뀜' && r.kind !== '새 조')) return;
      sus(resNew).forEach(function (f) {
        var at = f.loc || (f.hit && f.hit.label) || '';
        if (at !== r.now.label) return;
        r.flags.push({ id: f.rule.id, name: f.rule.name || '', law: f.rule.law || '', note: f.note || '', was: !!oldSus[f.rule.id] });
      });
      total += r.flags.length;
      fresh += r.flags.filter(function (g) { return !g.was; }).length;
    });
    return { total: total, fresh: fresh };
  }

  /* 한글 신구대조표 줄 — [조, 옛 글, 새 글, 비고] (같은 조는 뺀다) */
  function daejoRows(rows) {
    return rows.filter(function (r) { return r.kind !== '같음'; }).map(function (r) {
      var lab = r.old && r.now && r.old.label !== r.now.label ? r.old.label + ' → ' + r.now.label : (r.now || r.old).label;
      var t = (r.now || r.old).title;
      var note = r.kind === '번호 바뀜' ? '글은 같고 번호만 바뀜' : r.kind;
      if (r.flags && r.flags.length) note += ' · 검토 ' + r.flags.map(function (g) { return g.id; }).join('·');
      return [lab + (t ? '(' + t + ')' : ''), r.old ? r.old.body : '(없음)', r.now ? r.now.body : '(없음)', note];
    });
  }

  /* 「이 차이로 새 회차 만들기」 계획 — 옛 파일이 원본, 새 파일 글이 개정안.
     amend: 옛 조 → 새 글 · ins: 새 조(바로 앞 짝 조 뒤) · del: 없어진 옛 조.
     번호만 바뀐 것은 넣지 않는다 — 번호는 규정관리가 개정 방식(일부·전부)에 따라 다시 매긴다. */
  function plan(rows) {
    var amend = [], ins = [], del = [], lastOld = '';
    rows.forEach(function (r) {
      if (r.kind === '없어짐') { del.push(r.old.label); return; }
      if (r.kind === '새 조') { ins.push({ label: r.now.label, title: r.now.title || '', text: bodyOf(r.now), after: lastOld }); return; }
      lastOld = r.old.label;
      if (r.kind === '바뀜') amend.push({ label: r.old.label, title: r.now.title || '', retitle: titleKey(r.old) !== titleKey(r.now),
        text: String(r.now.body || '').replace(/\s+/g, ' ').trim(), flags: r.flags || [] });
    });
    return { amend: amend, ins: ins, del: del };
  }

  var api = { compare: compare, wordDiff: wordDiff, flag: flag, daejoRows: daejoRows, plan: plan, bodyOf: bodyOf };
  if (root) root.PuRulesFileCmp = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
