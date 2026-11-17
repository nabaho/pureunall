'use strict';
/* 정부사업신청 — 📍 대전·충남·충북 (브라우저 window.GovRegion / Node module.exports 겸용, DOM·통신 없음)

   대표 지시 2026-11-16 「대전충남충북 공공기관의 입찰 컨설턴트모집은 별도로 탭만들어 관리하게 해달라」.
   이미 화면에 있는 두 자료 — 공고 모아보기 줄(나라장터·알리오·기업마당)과 서버가 매일 읽는 기관 게시판 모집 글 — 에서
   «이 지역 것»만 골라 한 목록으로 만든다. 새로 받지도, 아무것도 고치지도 않는다(읽기만).

   ⚠ 지역은 «적혀 있을 때만» 정한다 — 지어내지 않는다. 보는 곳(차례대로):
     공고 = 참가 가능 지역·지역 해시태그(rgn) → 기관(org) → 공고 기관(ntce) → 공고명(nm)
     모집 글 = 그 지역 기관 게시판(BOARD_REGION) → 제목(title) → 게시판 이름(boardName)
     까닭(why)을 함께 돌려준다 — 「왜 여기 있나」를 줄에서 바로 본다.
   ⚠ 이름이 낱말과 겹치는 곳은 «시·군»까지 붙어야 센다: 「디지털 대전환」은 대전이 아니고,
     예산(돈)·부여(주다)·음성(소리)·보은·영동(강원 영동)·아산(아산재단·서울아산병원)·공주·금산·홍성·서천도 그렇다.
   ⚠ 「충청」만 있고 도(道)가 안 적힌 것(충청권·충청지방…)은 «충청 공통»으로 따로 센다 — 넷 중 어디인지 지어내지 않는다.
   ★ 세종도 넣었다(대표 지시 2026-11-17 「세종도 넣어달라」). ⚠ 「세종」은 다른 곳 이름에 흔하다 —
     세종문화회관·세종대학교·세종로(서울), 세종대왕·세종시대(그 임금의 시대), 세종연구소, 세종병원 … 그래서 «세종시·세종특별자치시»처럼 적혔거나,
     「세종」 바로 뒤에 한글이 안 붙을 때(「[세종]」·「대전·세종」·「세종 지역」)와 알려진 세종 기관 이름만 센다. */
(function (root) {
  function s(v) { return v == null ? '' : String(v).trim(); }

  var REGIONS = ['대전', '세종', '충남', '충북'];
  var WIDE = '충청';   /* 도가 안 적힌 «충청» — 화면에는 「충청 공통」 */
  var PAT = {
    '대전': /대전(?!환)|유성구|대덕구/,
    '세종': /세종특별자치|세종시(?!대)|정부세종|세종청사|세종테크노파크|세종창조경제|세종지역|세종권|대전세종|세종충[남북]|충[남북]세종|세종(?![가-힣])/,
    '충남': /충남|충청남도|천안|공주시|보령|아산시|서산|논산|계룡|당진|금산군|부여군|서천군|청양|홍성군|예산군|태안/,
    '충북': /충북|충청북도|청주|충주|제천|보은군|옥천|영동군|증평|진천|괴산|음성군|단양/
  };
  var PAT_WIDE = /충청(?!남도|북도)/;

  /* 서버(functions/recruit-watch.js BOARDS)가 읽는 게시판 가운데 «그 지역 기관»의 것 — 게시판 번호 → 지역.
     ⚠ 서버에서 게시판 번호를 바꾸면 여기도 바꾼다 — tests/gov-region.test.js 가 두 쪽을 맞대 본다.
     ⚠ 전국 기관(노사발전재단·LH·공인노무사회 …) 게시판은 넣지 않는다 — 그 글은 «제목»에 지역이 있을 때만 들어온다. */
  var BOARD_REGION = {
    daejeon: '대전', djmoel: '대전', djtp: '대전', djbea: '대전',
    chungnam: '충남', cheonan: '충남', dangjin: '충남', seosan: '충남', tp: '충남', cepa: '충남', sinbo: '충남',
    chungbuk: '충북', chungbuk2: '충북', cri: '충북', cri_job: '충북'
  };

  /* 글 하나에 적힌 지역 → ['대전','충남',…] (REGIONS 차례). 도가 하나라도 적혀 있으면 «충청»은 안 붙인다 */
  function regionsIn(text) {
    var t = s(text), out = [];
    if (!t) return out;
    REGIONS.forEach(function (k) { if (PAT[k].test(t)) out.push(k); });
    if (!out.length && PAT_WIDE.test(t)) out.push(WIDE);
    return out;
  }
  function label(k) { return k === WIDE ? '충청 공통' : k; }

  /* 여러 자리를 차례로 본다 — 지역이 나온 자리마다 까닭 하나. [[까닭, 글], …] */
  function scan(spots) {
    var regions = [], why = [];
    spots.forEach(function (sp) {
      var got = regionsIn(sp[1]);
      if (!got.length) return;
      var fresh = got.filter(function (k) { return regions.indexOf(k) < 0; });
      if (!fresh.length) return;
      /* 도가 적힌 자리가 나오면 앞서 «충청»만 있던 것은 걷는다 — 「충청권」과 「충남」이 함께 뜨면 헷갈린다 */
      if (fresh.some(function (k) { return k !== WIDE; })) { var w = regions.indexOf(WIDE); if (w >= 0) regions.splice(w, 1); }
      if (fresh.length === 1 && fresh[0] === WIDE && regions.length) return;
      fresh.forEach(function (k) { regions.push(k); });
      why.push(sp[0] + ' — ' + fresh.map(label).join('·'));
    });
    return { regions: order(regions), why: why };
  }
  function order(list) {
    return REGIONS.concat([WIDE]).filter(function (k) { return list.indexOf(k) >= 0; });
  }

  /* 공고 모아보기 줄 하나 → { regions, why } — 나라장터 rgn 은 «참가 가능 지역», 기업마당 rgn 은 «해시태그·제목» */
  function ofFeed(r) {
    if (!r) return { regions: [], why: [] };
    return scan([
      [s(r.src) === '기업마당' ? '지역 표시' : '참가 가능 지역', r.rgn],
      ['기관', r.org],
      ['공고 기관', r.ntce !== r.org ? r.ntce : ''],
      ['공고명', r.nm]
    ]);
  }
  /* 서버 모집 글 하나 → { regions, why } */
  function ofHit(h) {
    if (!h) return { regions: [], why: [] };
    var b = BOARD_REGION[s(h.board)];
    /* 지역 기관 게시판이면 그것이 첫 까닭이다(게시판 이름은 다시 안 본다 — 같은 말) */
    var res = scan(b ? [['제목', h.title]] : [['제목', h.title], ['게시판', h.boardName]]);
    if (b) {
      if (res.regions.indexOf(b) < 0) res.regions = order(res.regions.filter(function (k) { return k !== WIDE; }).concat([b]));
      res.why.unshift('지역 기관 게시판 — ' + b);
    }
    return res;
  }

  /* build(o) → { items[], counts{대전,충남,충북,충청,feed,hit,live,fresh} }
     o.feed    공고 모아보기 줄 [{id,src,type,nm,org,ntce,rgn,closeDt,dday,url,savedAt,hidden}]
     o.hits    서버 모집 글 [{key,title,org,board,boardName,date,href,per}]
     o.today   'YYYY-MM-DD'
     o.seen    봤음 표시 {key: 시각}
     o.deps    { feedDue(r) · hitDue(h) → 마감 상태 {k:'past'|'soon'|'open'|'rolling'|'unknown', text, days?, to?} }
               (gov.html 은 둘 다 GovRecruit.dueState 로 만든다 — 공고와 모집 글이 «같은 잣대»로 마감을 말한다)
     ⚠ 숨긴 공고(hidden)도 담는다(hidden:true) — 거르는 것은 부르는 쪽(보기 고르개)이다. */
  function dueOf(fn, x) { var d = fn ? (fn(x) || {}) : {}; return { k: s(d.k) || 'unknown', text: s(d.text), days: typeof d.days === 'number' && !isNaN(d.days) ? d.days : null, to: s(d.to) }; }
  function build(o) {
    o = o || {};
    var deps = o.deps || {}, seen = o.seen || {}, items = [];
    var counts = { feed: 0, hit: 0, live: 0, fresh: 0 };
    REGIONS.concat([WIDE]).forEach(function (k) { counts[k] = 0; });
    (o.feed || []).forEach(function (r) {
      if (!r || !r.id) return;
      var g = ofFeed(r); if (!g.regions.length) return;
      var due = dueOf(deps.feedDue, r);
      var closeYmd = /^\d{4}-\d{2}-\d{2}/.test(s(r.closeDt)) ? s(r.closeDt).slice(0, 10) : '';
      items.push({ kind: 'feed', ref: r.id, sel: 'f:' + r.id, title: s(r.nm), org: s(r.org), src: s(r.src) || '공고',
        date: s(r.savedAt).slice(0, 10), to: due.to || closeYmd, days: due.days, dueK: due.k, dueText: due.text,
        past: due.k === 'past', isNew: s(r.type) === '새 공고', type: s(r.type), hidden: !!r.hidden,
        url: /^https?:\/\//.test(s(r.url)) ? s(r.url) : '', regions: g.regions, why: g.why });
    });
    (o.hits || []).forEach(function (h) {
      if (!h || !h.key || !s(h.title)) return;
      var g = ofHit(h); if (!g.regions.length) return;
      var due = dueOf(deps.hitDue, h);
      items.push({ kind: 'hit', ref: h.key, sel: 'h:' + h.key, title: s(h.title), org: s(h.boardName || h.org), src: '모집 글',
        date: s(h.date).slice(0, 10), to: due.to, days: due.days, dueK: due.k, dueText: due.text,
        past: due.k === 'past', isNew: !seen[h.key], type: '', hidden: false,
        url: /^https:\/\//.test(s(h.href)) ? s(h.href) : '', regions: g.regions, why: g.why });
    });
    /* 차례: 마감 안 지난 것(마감 가까운 것부터 → 마감 모름은 최근 것부터) → 마감 지난 것(최근 마감부터) */
    items.sort(function (a, b) {
      if (a.past !== b.past) return a.past ? 1 : -1;
      if (!a.past) {
        var ad = a.days == null, bd = b.days == null;
        if (ad !== bd) return ad ? 1 : -1;
        if (!ad && a.days !== b.days) return a.days - b.days;
        return b.date.localeCompare(a.date);
      }
      return (b.days == null ? -1e9 : b.days) - (a.days == null ? -1e9 : a.days) || b.date.localeCompare(a.date);
    });
    items.forEach(function (x) {
      if (x.hidden) return;
      counts[x.kind]++;
      x.regions.forEach(function (k) { counts[k]++; });
      if (!x.past) { counts.live++; if (x.isNew) counts.fresh++; }
    });
    return { items: items, counts: counts };
  }

  var api = { REGIONS: REGIONS, WIDE: WIDE, BOARD_REGION: BOARD_REGION, regionsIn: regionsIn, label: label,
    ofFeed: ofFeed, ofHit: ofHit, build: build };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GovRegion = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
