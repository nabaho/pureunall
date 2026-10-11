/* pu-govaid-view.js — 정부지원금 화면이 그릴 «묶음»을 만든다 (2026-10-11)
   설계: docs/superpowers/specs/2026-10-11-govaid-design.md (6절)
   ■ 순수 함수 — 자료를 받아 목록·묶음을 돌려줄 뿐, 읽기·쓰기·DOM 이 없다. 판정은 GovaidMatch 가 한다.
   ■ 업체와 이어진 예비 고객은 목록에 따로 세우지 않는다 — 업체의 aliases 로 접어,
     예비 고객 때 남긴 검토가 업체 화면에서도 보이게 한다(reviewOf). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./pu-govaid-match.js'));
  else root.GovaidView = factory(root.GovaidMatch);
})(typeof self !== 'undefined' ? self : this, function (M) {
  'use strict';

  /* 푸른이알피 isActiveContract 의 «끝난» 상태와 같은 목록(js/rehab-match.js CLOSED_STATUS) */
  var CLOSED = ['closed', 'cancelled', 'transferred', 'terminated', 'expired'];
  function clean(v) { return v == null ? '' : String(v).trim(); }
  function byName(a, b) { return clean(a.name).localeCompare(clean(b.name), 'ko'); }
  function rows(v) {
    if (v && typeof v === 'object' && !Array.isArray(v) && Object.prototype.hasOwnProperty.call(v, 'v')) v = v.v;
    return M.list(v);
  }
  function programs(map) {
    return rows(map).filter(function (p) { return p && clean(p.id) && !p._deleted; }).sort(byName);
  }
  function companies(v) {
    return rows(v).filter(function (c) { return c && clean(c.id) && !c._deleted && CLOSED.indexOf(clean(c.status)) < 0; });
  }
  function subjects(companiesV, prospectsMap, pubCo, extrasMap) {
    pubCo = pubCo || {}; extrasMap = extrasMap || {};
    var byId = {}, out = [];
    companies(companiesV).forEach(function (co) {
      var p = M.profileFromCompany(co, pubCo[M.digits(co.bizNo)], extrasMap['co_' + clean(co.id)]);
      byId[p.id] = p; out.push(p);
    });
    rows(prospectsMap).forEach(function (pr) {
      if (!pr || !clean(pr.id) || pr._deleted) return;
      var linked = pr.companyLinkStatus === 'linked' && byId[clean(pr.companyId)];
      if (linked) { linked.aliases.push('pr_' + clean(pr.id)); return; }
      out.push(M.profileFromProspect(pr, pubCo[M.digits(pr.bizno)], extrasMap['pr_' + clean(pr.id)]));
    });
    return out.sort(byName);
  }
  function reviewOf(reviews, profile, pid) {
    reviews = reviews || {};
    var keys = [profile.key].concat(profile.aliases || []);
    for (var i = 0; i < keys.length; i++) {
      var r = (reviews[keys[i]] || {})[pid];
      if (r && !r._deleted) return r;
    }
    return null;
  }
  function forSubject(profile, progs, year) {
    var g = { candidate: [], unknown: [], no: [], unconfirmed: [] };
    progs.forEach(function (p) { var r = M.judge(profile, p, year); g[r.verdict].push({ program: p, result: r }); });
    return g;
  }
  function grid(profiles, progs, year) {
    var used = {};
    var out = profiles.map(function (pf) {
      var cells = {}, n = 0;
      progs.forEach(function (p) {
        var v = M.judge(pf, p, year).verdict;
        cells[p.id] = v;
        if (v === 'candidate') n++;
        if (v === 'candidate' || v === 'unknown') used[p.id] = 1;
      });
      return { profile: pf, cells: cells, candidates: n };
    });
    return { cols: progs.filter(function (p) { return used[p.id]; }), rows: out };
  }
  function forProgram(program, profiles, year) {
    var g = { candidate: [], unknown: [], no: 0 };
    profiles.forEach(function (pf) {
      var r = M.judge(pf, program, year);
      if (r.verdict === 'candidate' || r.verdict === 'unknown') g[r.verdict].push({ profile: pf, result: r });
      else if (r.verdict === 'no') g.no++;
    });
    return g;
  }
  function snapshot(result) {
    return { verdict: result.verdict, items: (result.items || []).map(function (i) { return { key: i.key, label: i.label, state: i.state }; }) };
  }
  function needsCheck(p, year) { return !p || p.status !== 'confirmed' || !(Number(p.baseYear) >= Number(year)); }

  return { rows: rows, programs: programs, companies: companies, subjects: subjects, reviewOf: reviewOf,
    forSubject: forSubject, grid: grid, forProgram: forProgram, snapshot: snapshot, needsCheck: needsCheck };
});
