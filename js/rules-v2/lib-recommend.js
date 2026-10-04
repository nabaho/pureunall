/* 취업규칙(새) — 「우리 문안 고르기」 셈 (설계 §8-2 · 2026-10-04 목업 세 물음 「추천대로」)
   순수 모듈. 한 조 주제의 «문안 덩어리»(view-topics model 의 byTopic[주제])에서
   지금 쓰는 글에 견줘 볼 만한 것을 세 갈래로 하나씩, 많아야 3개 고른다.
     · recent  — 가장 최근 : ★최종본이 있으면 그 날짜가, 없으면 덩어리의 마지막 날짜가 가장 큰 것
     · similar — 비슷한 회사 : 규모 띠·업태가 같은 «다른 회사»가 쓴 것(둘 다 알 때만)
     · most    — 가장 많이 씀 : 쓴 곳(회사 수)이 가장 많은 것
   차례는 늘 최근 → 비슷한 → 많이, 후보가 없는 갈래는 빠진다.
   ⚠ 세 갈래는 서로 다른 덩어리 — 앞 갈래가 고른 것은 뒤 갈래 후보에서 뺀다.
   ⚠ 지금 쓰는 글(curBody)과 «같은 글»(normKey 같음)인 덩어리는 후보가 아니다 — 같은 걸 추천할 필요가 없다.
   ⚠ 읽기만 한다. 덩어리·회사 원본은 건드리지 않는다. */
(function (root) {
  'use strict';

  /* 다른 부품은 «쓸 때» 찾는다 — 싣는 차례에 기대지 않게 */
  function lib(name, rel) {
    if (root && root[name]) return root[name];
    if (typeof require === 'function') { try { return require(rel); } catch (e) { /* 화면에서는 위에서 찾는다 */ } }
    return null;
  }
  function T() { return lib('PuRulesV2Topics', './lib-topics.js'); }
  function S() { return lib('PuRulesV2Sites', './lib-sites.js'); }

  var LABELS = { recent: '가장 최근', similar: '비슷한 회사', most: '가장 많이 씀' };

  function num(v) { return Number(v) || 0; }

  /* 점수(숫자 칸 목록)가 가장 큰 것 — 칸 순서대로 견주고, 끝까지 같으면 앞선 것(차례 유지) */
  function best(list, score) {
    var top = null;
    list.forEach(function (x) {
      if (!top) { top = x; return; }
      var a = score(x), b = score(top);
      for (var i = 0; i < a.length; i++) {
        if (a[i] > b[i]) { top = x; return; }
        if (a[i] < b[i]) return;
      }
    });
    return top;
  }
  /* ★ 먼저, 같으면 최근 먼저 — 대표 member 고르기(차례를 이미 가진 members 라도 걸러낸 뒤라 다시 가른다) */
  function bestMember(ms) {
    return best(ms, function (m) { return [m.final ? 1 : 0, num(m.date)]; });
  }

  function pickRecent(cands) {
    var withFinal = cands.filter(function (g) { return num(g.finals) > 0; });
    var pool = withFinal.length ? withFinal : cands;
    var scored = pool.map(function (g) {
      var ms = withFinal.length ? g.members.filter(function (m) { return m.final; }) : g.members;
      var rep = best(ms, function (m) { return [num(m.date)]; });
      return { g: g, rep: rep, date: rep ? num(rep.date) : 0 };
    });
    var top = best(scored, function (x) { return [x.date]; });
    return top ? { why: 'recent', group: top.g, rep: top.rep } : null;
  }

  function pickSimilar(cands, ctx) {
    if (!ctx.band || !ctx.bizType) return null;
    var S0 = S();
    var coById = ctx.coById || {};
    var scored = [];
    cands.forEach(function (g) {
      var seen = Object.create(null), hit = [], ms = [];
      g.members.forEach(function (m) {
        var id = m.companyId;
        if (!id || id === ctx.companyId) return;
        var co = coById[id];
        if (!co) return;
        if (S0.band(co.employmentInsuredCount) !== ctx.band || String(co.bizType || '') !== ctx.bizType) return;
        ms.push(m);
        if (!seen[id]) { seen[id] = 1; hit.push({ companyId: id, companyName: m.companyName || String(co.name || '') }); }
      });
      if (hit.length) scored.push({ g: g, hit: hit, ms: ms });
    });
    var top = best(scored, function (x) { return [x.hit.length, num(x.g.finals), num(x.g.last)]; });
    return top ? { why: 'similar', group: top.g, rep: bestMember(top.ms), similar: top.hit } : null;
  }

  function pickMost(cands) {
    var top = best(cands, function (g) { return [num(g.places), num(g.finals), num(g.last)]; });
    return top ? { why: 'most', group: top, rep: top.members[0] } : null;   // members 는 이미 ★ → 최근 차례
  }

  function pick(groups, ctx) {
    ctx = ctx || {};
    var mine = T().normKey(ctx.curBody, ctx.curCoName);
    var cands = (groups || []).filter(function (g) { return g && g.members && g.members.length && g.key !== mine; });
    var out = [];
    function take(r) {
      if (!r) return;
      out.push(r);
      cands = cands.filter(function (g) { return g !== r.group; });   // 겹침 빼기 — 한 덩어리는 한 갈래에만
    }
    take(pickRecent(cands));
    take(pickSimilar(cands, ctx));
    take(pickMost(cands));
    return out;
  }

  var api = { pick: pick, LABELS: LABELS };
  if (root) root.PuRulesV2Recommend = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
