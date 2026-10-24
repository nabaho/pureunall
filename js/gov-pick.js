'use strict';
/* 정부사업신청 — 🎯 «지원할 만한 것» 추리기 (브라우저 window.GovPick / Node module.exports 겸용, DOM·통신 없음)

   대표 지시 2026-10-24 「푸른노무법인이나 권형하 노무사가 지원할 만한 컨설턴트 또는 사업을 팝업으로 나오게 해서 확인할 수 있는 방법」 → 「추천대로」.
   이미 화면에 있는 자료(서버가 매일 모으는 모집 글 · 공고 모아보기 · 지난 이력 견주기 · 해마다 지원하던 기관)를 «한 목록»으로 모아 순서를 정한다.
   ⚠ 순서는 «규칙»이다 — AI 가 아니다. 틀릴 수 있어서 줄마다 «왜 올라왔는지»(why)를 함께 돌려준다. 까닭 없는 순위는 믿을 수 없다.
   ⚠ 아무것도 지우거나 바꾸지 않는다(읽기만). 숨기기는 부르는 쪽이 따로 적는 «이 팝업에서만 숨김» 표시(off)를 넘겨 준다. */
(function (root) {
  function s(v) { return v == null ? '' : String(v).trim(); }

  /* 우리 지역(법인 천안 — 충남·세종·대전·충북). 부르는 쪽이 바꿀 수 있다 */
  var REGIONS = ['충남', '세종', '대전', '충북'];
  var SIDO = ['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'];
  var SIDO_FULL = { '서울특별시': '서울', '부산광역시': '부산', '대구광역시': '대구', '인천광역시': '인천', '광주광역시': '광주', '대전광역시': '대전', '울산광역시': '울산',
    '세종특별자치시': '세종', '경기도': '경기', '강원도': '강원', '강원특별자치도': '강원', '충청북도': '충북', '충청남도': '충남', '전라북도': '전북', '전북특별자치도': '전북',
    '전라남도': '전남', '경상북도': '경북', '경상남도': '경남', '제주특별자치도': '제주' };
  function sido(w) { w = s(w); return SIDO.indexOf(w) >= 0 ? w : (SIDO_FULL[w] || ''); }

  /* 지역 제한 판정 — rgn = 「충청남도 · 세종특별자치시」 꼴(나라장터 참가 가능 지역) 또는 「충남」(기업마당 해시태그)
     in = 우리 지역이 들어 있다 / out = 지역 제한이 있는데 우리 지역이 없다 / none = 제한 정보가 없다(모름 — 없다고 하지 않는다) */
  function regionFit(rgn, regions) {
    var mine = regions || REGIONS, names = [];
    s(rgn).split(/\s*[·,\/]\s*|\s+/).forEach(function (w) { var k = sido(w); if (k && names.indexOf(k) < 0) names.push(k); });
    if (!names.length) return { k: 'none', names: [] };
    var hit = names.filter(function (n) { return mine.indexOf(n) >= 0; });
    return hit.length ? { k: 'in', names: names, hit: hit } : { k: 'out', names: names };
  }

  function days(to, today) {
    var d = Math.round((Date.parse(to) - Date.parse(today)) / 864e5);
    return isNaN(d) ? null : d;
  }
  function mmdd(ymd) { return /^\d{4}-\d{2}-\d{2}/.test(s(ymd)) ? Number(s(ymd).slice(5, 7)) + '.' + Number(s(ymd).slice(8, 10)) : ''; }

  /* 지난 이력 견줌 결과 → 점수·까닭 (같은 기관·사업 / 비슷한 이력) */
  function byMatch(f, why) {
    var same = (f && f.same || []).length, sim = (f && f.similar || []).length;
    if (same) { why.push('지난 이력과 같은 기관·사업 ' + same + '건'); return 35; }
    if (sim) { why.push('비슷한 이력 ' + sim + '건'); return 20; }
    return 0;
  }

  /* rank(o) → { items[], counts{hit,feed,org,out,starred} }
     o.today        'YYYY-MM-DD'
     o.hits         서버가 모은 모집 글 [{key,title,org,boardName,board,date,href,per}]
     o.feed         공고 모아보기 줄 [{id,no,nm,org,ntce,src,type,hidden,closeDt,dday,url,rgn,ind,indY,mthd}]
     o.orgs         해마다 지원하던 기관 [{id,name,month,years[],custom}] (GovRecruit.group 결과)
     o.off          {열쇠: 날짜} — 이 팝업에서 숨긴 것
     o.seen         {모집 글 열쇠: 1} — 「봤음」
     o.regions      우리 지역 (기본 REGIONS)
     o.deps         { kindOf(title), kindInfo(k), dueOf(hit) → {k,days,text}, matchHit(hit), matchFeed(row), orgName(id), monthsAhead(month,today), appliedThisYear(org,today) }
     ⚠ 열쇠: 모집 글 = hit.key · 공고 = 'f|'+no · 해마다 기관 = 'o|'+id+'|'+해 */
  function rank(o) {
    o = o || {};
    var deps = o.deps || {}, today = s(o.today), off = o.off || {}, seen = o.seen || {}, mine = o.regions || REGIONS;
    var items = [], counts = { hit: 0, feed: 0, org: 0, out: 0, starred: 0 };
    var liveOrg = {};

    /* ① 서버가 모은 모집 글 — 접수 중·곧 마감·수시·기간 모름(최근 글만). 행사·후보 추천은 «모집»이 아니라 뺀다 */
    (o.hits || []).forEach(function (h) {
      if (!h || !h.title) return;
      var key = s(h.key); if (!key || off[key]) return;
      var kind = deps.kindOf ? deps.kindOf(h.title) : 'etc';
      if (kind === 'event' || kind === 'rec') return;
      var due = deps.dueOf ? deps.dueOf(h) : { k: 'unknown', text: '기간 모름' };
      if (!due || due.k === 'past') return;
      if (due.k === 'unknown') {                                  /* 기간을 모르면 «최근 글»만 — 옛 글이 영영 떠 있으면 안 된다 */
        var age = h.date ? -days(h.date, today) : null;
        if (age == null || age > 45) return;
      }
      var why = [], sc = kind === 'cons' ? 30 : kind === 'board' ? 20 : kind === 'teach' ? 10 : 5;
      var ki = deps.kindInfo ? deps.kindInfo(kind) : { icon: '📎', name: '기타' };
      var mt = deps.matchHit ? deps.matchHit(h) : null;
      var ms = byMatch(mt, why); sc += ms;
      if (kind === 'etc' && !ms) return;                           /* 갈래도 모르고 이력도 없으면 잡음 */
      if (due.k === 'soon') { sc += 40 + Math.max(0, 7 - (due.days || 0)); why.unshift(due.days === 0 ? '오늘 마감' : '마감 ' + due.days + '일 전'); }
      else if (due.k === 'open') sc += 10;
      else if (due.k === 'rolling') sc += 5;
      var orgId = s(h.org) && h.org !== 'kcplaa' ? h.org : '';
      var org = (orgId && deps.orgName && deps.orgName(orgId)) || s(h.boardName).replace(/\s*(공지사항|공지|게시판|알림).*$/, '');
      var yrs = orgId ? ((o.orgs || []).filter(function (x) { return x.id === orgId; })[0] || {}).years || [] : [];
      if (yrs.length) { sc += 15; why.push(yrs.slice(-3).join('·') + ' 지원한 기관'); }
      if (orgId) liveOrg[orgId] = 1;
      if (seen[key]) sc -= 5;
      items.push({ key: key, kind: 'hit', icon: '🧑‍💼', typeName: '모집 글', sub: ki.icon + ' ' + ki.name, title: s(h.title), org: org,
        due: due, score: sc, why: why, out: false, url: /^https:\/\//.test(s(h.href)) ? s(h.href) : '', isNew: !seen[key], ref: h.key, board: s(h.boardName) });
      counts.hit++;
    });

    /* ② 공고 모아보기 — 아직 안 지났고, 내가 숨기거나 별표·지원 표시를 하지 않은 새 공고 */
    (o.feed || []).forEach(function (r) {
      if (!r || !r.nm) return;
      if (r.type === '관심') { counts.starred++; return; }
      if (r.hidden || r.type === '지나감' || r.type === '지원함') return;
      var key = 'f|' + s(r.no || r.id); if (off[key]) return;
      var d = typeof r.dday === 'number' ? r.dday : (r.closeDt ? days(s(r.closeDt).slice(0, 10), today) : null);
      if (d != null && d < 0) return;
      var why = [], sc = r.src === '알리오' ? 15 : 20;
      var mt = deps.matchFeed ? deps.matchFeed(r) : null;
      sc += byMatch(mt, why);
      var due = d == null ? { k: 'unknown', text: '마감 모름' } : (d <= 7 ? { k: 'soon', days: d, text: (d === 0 ? '오늘 마감' : '~' + mmdd(r.closeDt) + ' · D-' + d) } : { k: 'open', days: d, text: '~' + mmdd(r.closeDt) + ' · D-' + d });
      if (due.k === 'soon') { sc += 40 + Math.max(0, 7 - d); why.unshift(d === 0 ? '오늘 마감' : '마감 ' + d + '일 전'); } else if (due.k === 'open') sc += 10;
      var out = false;
      var fit = regionFit(r.rgn, mine);
      if (fit.k === 'in') { sc += 10; why.push('지역 제한 — 우리 지역 포함(' + fit.hit.join('·') + ')'); }
      else if (fit.k === 'out') { sc -= 60; out = true; why.push('지역 제한 — 우리 지역 아님(' + fit.names.slice(0, 3).join('·') + (fit.names.length > 3 ? ' 외' : '') + ')'); }
      if (r.ind || r.indY === 'Y') { sc -= 10; why.push('업종·면허 제한 있음 — 해당되는지 확인'); }
      if (/수의/.test(s(r.mthd))) { sc -= 15; why.push('수의계약 — 정해진 곳과 직접 계약하는 경우가 많음'); }
      var kwHit = s(r.kw);
      if (kwHit) why.push('걸린 낱말 ' + kwHit.split(',').slice(0, 3).join('·'));
      items.push({ key: key, kind: 'feed', icon: '📋', typeName: s(r.src) || '공고', sub: s(r.src), title: s(r.nm), org: s(r.org) || s(r.ntce),
        due: due, score: sc, why: why, out: out, url: /^https:\/\//.test(s(r.url)) ? s(r.url) : '', isNew: r.type === '새 공고', ref: r.id });
      counts.feed++; if (out) counts.out++;
    });

    /* ③ 해마다 지원하던 기관 — 이번 달·다음 달에 열리던 곳인데 올해는 아직 안 냈고, 지금 접수 중인 글도 없는 곳 */
    (o.orgs || []).forEach(function (g) {
      if (!g || !g.id || !(g.years || []).length || !g.month) return;
      if (liveOrg[g.id]) return;
      if (deps.appliedThisYear && deps.appliedThisYear(g, today)) return;
      var ahead = deps.monthsAhead ? deps.monthsAhead(g.month, today) : 99;
      if (ahead > 1) return;
      var y = s(today).slice(0, 4), key = 'o|' + g.id + '|' + y; if (off[key]) return;
      var why = [g.years.slice(-3).join('·') + ' 지원한 기관', ahead === 0 ? '보통 이번 달(' + g.month + '월)에 모집' : '보통 다음 달(' + g.month + '월)에 모집'];
      var sc = 25 + 3 * Math.min(g.years.length, 5) + (ahead === 0 ? 8 : 0);
      items.push({ key: key, kind: 'org', icon: '🔁', typeName: '해마다', sub: '해마다 지원', title: s(g.name) + ' — 올해 모집을 확인하세요', org: s(g.name),
        due: { k: 'seasonal', text: '보통 ' + g.month + '월' }, score: sc, why: why, out: false, url: '', isNew: false, ref: g.id });
      counts.org++;
    });

    items.sort(function (a, b) {
      return b.score - a.score
        || (a.due && a.due.days != null ? a.due.days : 999) - (b.due && b.due.days != null ? b.due.days : 999)
        || a.title.localeCompare(b.title);
    });
    return { items: items, counts: counts };
  }

  /* 자동으로 띄울 만한가 — 우리 지역을 벗어난 것을 뺀 «쓸 만한 줄»이 하나라도 있을 때만 (자동 팝업이 빈 말로 뜨면 귀찮다) */
  function worthy(res) { return (res.items || []).filter(function (x) { return !x.out && x.score >= 40; }).length; }

  var api = { rank: rank, worthy: worthy, regionFit: regionFit, REGIONS: REGIONS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GovPick = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
