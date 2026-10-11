'use strict';
/* 푸른노무법인 정부사업신청 — 「같은 기관의 컨설턴트·전문가 모집 글」 짝짓기
   (브라우저 window.GovOrgRec / Node module.exports 겸용, DOM·통신 없음)

   대표 지시 2026-10-11 「노무컨설팅이 공고나면 공인노무사가 컨설팅을 수행한다. 이럴 경우 기관에서 공인노무사
   모집공고가 있는 경우가 많다 — 그 기관에 컨설턴트 모집공고가 있는지도 자동으로 검토」 + 「딱지 진행」.

   공고 모아보기 줄(기업마당·나라장터·알리오)의 «기관»으로, 서버(recruitWatch)가 매일 남기는 모집 글(gov_watch/hits)을 찾는다.
   ⚠ 읽기만 한다 — 어디에도 쓰지 않는다. 짝은 «기관 이름»으로만(공고 내용은 안 본다).
   ⚠ 같은 기관 = ① 화면 사전의 기관 번호가 같거나(서버 게시판이 정한 org) ② 모집 글 «제목»에 기관 이름이 든 것
      (공인노무사회 공지에 실린 「[한국콘텐츠진흥원] … 컨설턴트 모집」 꼴 — 게시판이 기관을 못 정한다).
   ⚠ 제목 경로는 기관 이름이 «4글자 이상»일 때만 — 「충남」·「대전」 같은 짧은 지역 이름이 아무 글에나 걸린다.
   ⚠ 행사·안내(박람회·설명회)와 후보 추천은 «모집»이 아니므로 뺀다. */
(function (root) {
  function s(v) { return v == null ? '' : String(v).trim(); }

  function namesOf(row) {
    row = row || {};
    var seen = {}, out = [];
    [row.org, row.ntce].forEach(function (n) { n = s(n); if (n && !seen[n]) { seen[n] = 1; out.push(n); } });
    return out;
  }

  /* deps = { matches(name)→기관번호[], orgKey(name), kindOf(title), per(hit)→기간, dueState(per, today), today } */
  function find(row, hits, deps) {
    var names = namesOf(row), none = { live: [], past: [], names: names };
    if (!names.length || !hits || !hits.length) return none;
    var ids = [], keys = [];
    names.forEach(function (n) {
      (deps.matches(n) || []).forEach(function (id) { if (id && id !== 'kcplaa' && ids.indexOf(id) < 0) ids.push(id); });
      var k = deps.orgKey(n); if (k && k.length >= 4 && keys.indexOf(k) < 0) keys.push(k);
    });
    var live = [], past = [];
    hits.forEach(function (h) {
      if (!h || !s(h.title)) return;
      var kind = deps.kindOf(h.title);
      if (kind === 'event' || kind === 'rec') return;
      var how = '';
      if (h.org && h.org !== 'kcplaa' && ids.indexOf(h.org) >= 0) how = 'board';
      else {
        /* ⚠ 괄호 «안»이 곧 기관 이름이다([한국콘텐츠진흥원] …) — orgKey 는 괄호 속을 지우므로 괄호 글자만 걷고 넘긴다 */
        var tk = deps.orgKey(s(h.title).replace(/[\[\]()（）]/g, ' '));
        for (var i = 0; i < keys.length; i++) if (tk.indexOf(keys[i]) >= 0) { how = 'title'; break; }
      }
      if (!how) return;
      var st = deps.dueState(deps.per(h), deps.today);
      var it = { hit: h, how: how, kind: kind, due: st };
      (st && st.k === 'past' ? past : live).push(it);
    });
    var byDate = function (a, b) { return s(b.hit.date).localeCompare(s(a.hit.date)); };
    live.sort(byDate); past.sort(byDate);
    return { live: live, past: past, names: names };
  }

  var api = { find: find, namesOf: namesOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GovOrgRec = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
