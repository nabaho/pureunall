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
    var g = { candidate: [], unknown: [], no: [], unconfirmed: [], closed: [] };
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
    var g = { candidate: [], unknown: [], no: 0, closed: 0 };
    profiles.forEach(function (pf) {
      var r = M.judge(pf, program, year);
      if (r.verdict === 'candidate' || r.verdict === 'unknown') g[r.verdict].push({ profile: pf, result: r });
      else if (r.verdict === 'no') g.no++;
      else if (r.verdict === 'closed') g.closed++;
    });
    return g;
  }
  function snapshot(result) {
    return { verdict: result.verdict, items: (result.items || []).map(function (i) { return { key: i.key, label: i.label, state: i.state }; }) };
  }
  /* 사업 중심 — 부처(관) 묶음 (대표 지시 2026-10-12 「고용노동부 등 관 중심으로 우선 재편」).
     담당기관 칸의 «앞머리»가 부처다 — 괄호·가운뎃점·빗금 뒤는 산하기관·담당과 */
  var NO_MIN = '기관 모름', FIRST_MIN = '고용노동부';
  function ministryOf(agency) {
    var a = clean(agency).split(/[(（·・\/,]/)[0].trim();
    return a || NO_MIN;
  }
  /* 고용노동부가 맨 앞(노무법인의 본업), 그다음 사업이 많은 부처, 기관 모름은 맨 끝. 묶음 안은 받은 차례 그대로 */
  function byMinistry(progs) {
    var map = {}, order = [];
    progs.forEach(function (p) { var m = ministryOf(p.agency); if (!map[m]) { map[m] = []; order.push(m); } map[m].push(p); });
    function rank(m) { return m === FIRST_MIN ? 0 : (m === NO_MIN ? 2 : 1); }
    return order.sort(function (a, b) { return (rank(a) - rank(b)) || (map[b].length - map[a].length) || a.localeCompare(b, 'ko'); })
      .map(function (m) { return { ministry: m, items: map[m] }; });
  }
  /* 목록에 보일 이름 — 앞의 «2026년(도)»는 떼어 이름이 먼저 보이게, 해는 따로 */
  function shortTitle(p) {
    var n = clean(p && p.name), m = n.match(/^(\d{4})년도?\s+(.+)$/);
    return m ? { title: m[2], year: m[1] } : { title: n, year: '' };
  }
  /* 한눈 표 열 머리용 짧은 이름 — 사람이 넣은 short 가 먼저. 없으면 앞의 해·괄호·«— 뒤»·꼬리 «지원사업/사업/지원»을 떼고
     10자가 넘으면 9자 + … (대표 지시 2026-10-12 한눈 표 시안 A: 머리 글자를 가로로 읽히게) */
  function shortName(p) {
    var s = clean(p && p.short);
    if (s) return s;
    s = shortTitle(p).title.replace(/\s*[—–-]\s.*$/, '').replace(/\([^)]*\)/g, '').replace(/\s*(지원\s*사업|사업|지원)$/, '').trim();
    return s.length > 10 ? s.slice(0, 9) + '…' : s;
  }
  /* 회사별 «준비할 서류» — 후보(candidate) 사업의 docs 를 낱말(key)로 모은다. «그 밖»은 공고 이름별로.
     노무 서류(DOCS[key].labor) 먼저 → 쓰이는 사업이 많은 것 → 낱말표 차례 */
  function docsFor(profile, progs, year) {
    var D = M.DOCS, order = Object.keys(D), map = {}, out = [];
    progs.forEach(function (p) {
      if (M.judge(profile, p, year).verdict !== 'candidate') return;
      M.list(p.docs).forEach(function (d) {
        if (!d) return;
        var key = D[d.key] ? d.key : 'other', label = key === 'other' ? clean(d.label) || '그 밖' : D[key].label, id = key + '|' + (key === 'other' ? label : '');
        if (!map[id]) { map[id] = { key: key, label: label, labor: !!D[key].labor, programs: [], stages: [] }; out.push(map[id]); }
        var e = map[id];
        if (!e.programs.some(function (x) { return x.id === p.id; })) e.programs.push({ id: p.id, name: clean(p.name), short: shortName(p) });
        if (d.stage && e.stages.indexOf(d.stage) < 0) e.stages.push(d.stage);
      });
    });
    return out.sort(function (a, b) { return (b.labor - a.labor) || (b.programs.length - a.programs.length) || (order.indexOf(a.key) - order.indexOf(b.key)); });
  }
  /* 📰 새 공고 (2026-10-12) — 서버 govaidNoticeWatch 가 쌓은 기업마당 공고를 «처리할 것»부터 거른다.
     view: sug(비슷한 사전 사업이 있는 것) · all(처리 안 한 것 전체) · labor(인력·경영 분야) · linked(사업에 이은 것) · ignored(관계없음)
     «이은 것»은 공고 쪽이 아니라 사업의 bizinfo 로 안다 — 잇기의 근거는 사업 레코드 하나다 */
  var LABOR_FIELDS = ['인력', '경영'];
  function noticeRows(noticesMap, progs, opt) {
    opt = opt || {};
    var today = clean(opt.today), view = opt.view || 'sug', q = clean(opt.q).toLowerCase(), byId = {}, linkOf = {};
    progs.forEach(function (p) { if (!p || !p.id || p._deleted) return; byId[p.id] = p; M.list(p.bizinfo).forEach(function (no) { linkOf[clean(no)] = p; }); });
    return rows(noticesMap).filter(function (n) { return n && clean(n.id); }).map(function (n) {
      var sug = M.list(n.suggest).filter(function (s) { return s && byId[s.id]; }).map(function (s) { return { p: byId[s.id], score: s.score }; });
      var cos = view === 'local' ? M.list(opt.profiles).filter(function (pf) { var v = pf.vals || {}; return !!areaMatch(n, (v.region || {}).v, (v.sigungu || {}).v); }).length : 0;
      return { n: n, linkedTo: linkOf[clean(n.no || n.id)] || null, sug: sug, cos: cos };
    }).filter(function (r) {
      var n = r.n, open = !clean(n.closeDt) || clean(n.closeDt) >= today, fresh = !n.decision && !r.linkedTo;
      if (opt.openOnly && !open) return false;
      if (q && (clean(n.nm) + ' ' + clean(n.ntce) + ' ' + clean(n.inst)).toLowerCase().indexOf(q) < 0) return false;
      if (view === 'linked') return !!r.linkedTo;
      if (view === 'ignored') return n.decision === 'ignore';
      if (!fresh) return false;
      if (view === 'sug') return r.sug.length > 0;
      if (view === 'local') return r.cos > 0;   /* 지역 공고 — 우리 고객사가 있는 지역만 */
      if (view === 'labor') return LABOR_FIELDS.indexOf(clean(n.field)) >= 0;
      return true;
    }).sort(function (a, b) { return (b.cos - a.cos) || clean(b.n.openDt).localeCompare(clean(a.n.openDt)) || clean(a.n.nm).localeCompare(clean(b.n.nm), 'ko'); });
  }
  /* 📍 지자체 공고 (대표 지시 2026-10-31 「각 지자체별로 진행되는 지원사업등 매칭」 → 「추천대로」: 공고 그대로 회사에 매칭).
     공고 area = {sido:[…], sgg:[…]}(서버가 이름 앞 [충남] 아산시 … 에서 읽음). 시·도가 같고, 시·군 공고면 시·군도 같아야 맞음.
     ⚠ 지역만 맞춘 «넓은 1차 명단»이다 — 공고마다 세부 조건이 달라 기계가 확정하지 않는다(화면이 «원문 확인»을 붙인다) */
  function areaMatch(n, region, sgg) {
    var a = (n && n.area) || {}, sido = M.list(a.sido), g = M.list(a.sgg);
    if (!clean(region) || sido.indexOf(clean(region)) < 0) return '';
    if (g.length) return g.indexOf(clean(sgg)) >= 0 ? 'sgg' : '';
    return 'sido';
  }
  function openNow(n, today) { return !clean(n.closeDt) || clean(n.closeDt) >= today; }
  function localNotices(profile, noticesMap, today) {
    var v = (profile && profile.vals) || {}, region = (v.region || {}).v, sgg = (v.sigungu || {}).v, hc = M.num((v.headcount || {}).v);
    return rows(noticesMap).filter(function (n) { return n && clean(n.id) && !n.decision && openNow(n, today); }).map(function (n) {
      var scope = areaMatch(n, region, sgg); if (!scope) return null;
      var who = M.list(n.who), small = who.indexOf('소상공인') >= 0 && who.indexOf('중소기업') < 0;
      /* 소상공인 — 상시 근로자 10명 미만(제조·건설·운수, 그 밖은 5명 미만)이 상한이라 10명 이상이면 어긋남(추정) */
      return { n: n, scope: scope, mismatch: small && hc != null && hc >= 10 ? '소상공인 대상 — 이 회사 근로자 ' + hc + '명(추정 어긋남)' : '' };
    }).filter(Boolean).sort(function (a, b) {
      return (a.scope === b.scope ? 0 : (a.scope === 'sgg' ? -1 : 1)) || (!!a.mismatch - !!b.mismatch) || clean(b.n.openDt).localeCompare(clean(a.n.openDt));
    });
  }
  /* 지역 요약 — 고객사가 있는 시·도·시·군마다 고객사 수 · 그 시·군 공고 · 도 전체 공고(접수 중, 처리 안 한 것) */
  function regionSummary(profiles, noticesMap, today) {
    var by = {}, out = [], open = rows(noticesMap).filter(function (n) { return n && !n.decision && openNow(n, today) && M.list((n.area || {}).sido).length; });
    profiles.forEach(function (pf) {
      var v = pf.vals || {}, r = clean((v.region || {}).v), g = clean((v.sigungu || {}).v), k = r + '|' + g;
      if (!by[k]) { by[k] = { sido: r, sgg: g, cos: 0, sggOpen: 0, sidoOpen: 0, star: 0 }; out.push(by[k]); }
      by[k].cos++;
    });
    out.forEach(function (x) {
      if (!x.sido) return;
      open.forEach(function (n) {
        var s = areaMatch(n, x.sido, x.sgg);
        if (s === 'sgg') x.sggOpen++; else if (s === 'sido') x.sidoOpen++;
        if (s && n.star && n.star.on) x.star++;
      });
    });
    return out.sort(function (a, b) { return (!a.sido - !b.sido) || (b.cos - a.cos); });
  }
  function noticeCount(noticesMap, progs, today) { return noticeRows(noticesMap, progs, { view: 'sug', openOnly: true, today: today }).length; }
  /* ★ 노무사 직접 사업 — 화면마다 같은 잣대(대표 지시 2026-10-13 「모든 영역에서」) */
  function isStar(p) { return !!(p && p.star && p.star.on === true); }
  function starOnly(progs, on) { return on ? progs.filter(isStar) : progs; }
  function needsCheck(p, year) { return !p || p.status !== 'confirmed' || !(Number(p.baseYear) >= Number(year)); }

  return { rows: rows, programs: programs, companies: companies, subjects: subjects, reviewOf: reviewOf,
    forSubject: forSubject, grid: grid, forProgram: forProgram, snapshot: snapshot, needsCheck: needsCheck,
    ministryOf: ministryOf, byMinistry: byMinistry, shortTitle: shortTitle, shortName: shortName, docsFor: docsFor,
    noticeRows: noticeRows, noticeCount: noticeCount, localNotices: localNotices, regionSummary: regionSummary, areaMatch: areaMatch, isStar: isStar, starOnly: starOnly };
});
