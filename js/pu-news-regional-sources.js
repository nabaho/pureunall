(function (global) {
  'use strict';

  /* 지역뉴스의 단일 공식 출처 등록부.
     1단계에서는 «어디를 읽을지»만 확정한다. RSS는 다음 수집 단계에서 자동으로 읽고,
     게시판은 사이트별 읽개가 검증되기 전까지 사람이 원문을 확인한다.

     ★ 2026-09-13 — 대표 물음 「다른지역 정보 가지고 오는건 어떻게 되었나」로 드러난 것:
       아래 지자체 셋(충청남도·서산시·천안시)은 «등록만 되어 있고 읽는 코드가 없었다».
       서버는 rss 만 읽었으므로, 날마다 07:10 에 돌면서도 지역 정보는 «한 건도»
       안 들어오고 있었다. 쌓인 후보 20건이 전부 「전국」이었던 까닭이다.
     ★ 그래서 «지방고용노동관서» 둘을 더하고 게시판 읽개를 세웠다(방식 board).
       노동 공지만 올라오고 moel.go.kr 이라 공식링크 검사도 그대로 지난다.
     ⚠ 지자체 셋은 아직 «사람이 보는 것»이다 — 읽개가 없다.
       천안시 주소는 2026-09-13 실측에서 404 였다(고쳐야 한다). */
  var 목록 = [
    { id:'moel-notice', 기관:'고용노동부', 이름:'공지사항', 지역:'전국', 방식:'rss',
      목록주소:'https://www.moel.go.kr/rss/notice.do', 공공누리:'출처표시 확인' },
    { id:'moel-policy', 기관:'고용노동부', 이름:'정책자료', 지역:'전국', 방식:'rss',
      목록주소:'https://www.moel.go.kr/rss/policy.do', 공공누리:'출처표시 확인' },
    { id:'moel-lawinfo', 기관:'고용노동부', 이름:'법령정보', 지역:'전국', 방식:'rss',
      목록주소:'https://www.moel.go.kr/rss/lawinfo.do', 공공누리:'출처표시 확인' },
    /* ★ 여기 둘은 «서버가 읽는다»(functions/news-region.js 의 같은 id).
         지방관서에는 RSS 가 없어 게시판을 읽는다 — 실측 2026-09-13 로 세웠다. */
    { id:'moel-cheonan', 기관:'대전지방고용노동청 천안지청', 이름:'공지사항',
      지역:'충남', 방식:'board', 밑주소:'https://www.moel.go.kr',
      목록주소:'https://www.moel.go.kr/local/cheonan/news/notice/noticeList.do',
      공공누리:'출처표시 확인' },
    { id:'moel-seosan', 기관:'대전지방고용노동청 서산지청', 이름:'공지사항',
      지역:'충남/서산시', 방식:'board', 밑주소:'https://www.moel.go.kr',
      목록주소:'https://www.moel.go.kr/local/seosan/news/notice/noticeList.do',
      공공누리:'출처표시 확인' },
    { id:'moel-pyeongtaek', 기관:'경기지방고용노동청 평택지청', 이름:'공지사항',
      지역:'경기', 방식:'board', 밑주소:'https://www.moel.go.kr',
      목록주소:'https://www.moel.go.kr/local/pyeongtaek/news/notice/noticeList.do',
      공공누리:'출처표시 확인' },
    /* ── 아래 셋은 «사람이 보는» 자리다. 서버는 안 읽는다. ─────────────────
       ⚠ 2026-09-13 에 셋을 실제로 두드려 본 결과를 «적어 둔다». 적어 두지 않으면
         다음에 또 「읽개만 만들면 되겠네」로 시작해 같은 길을 걷는다.
       ★ 읽개를 안 만든 까닭은 게을러서가 아니라 «들어올 것이 없어서»다.
         읽으려면 공식링크 잣대를 go.kr 로 넓혀야 하는데(지금은 moel.go.kr 만),
         그 값을 치르고 얻는 것이 아래와 같다. */
    { id:'chungnam-press', 기관:'충청남도', 이름:'보도자료', 지역:'충남', 방식:'board',
      목록주소:'https://www.chungnam.go.kr/cnportal/bbs/B0000417/list.do?menuNo=500498',
      공공누리:'게시물별 유형 확인',
      살핌:'2026-09-13 실측 — 200 이지만 목록이 「조회 데이터가 없습니다」로 비어서 온다(주소가 낡음)' },
    { id:'seosan-company', 기관:'서산시', 이름:'기업지원 새소식', 지역:'충남/서산시', 방식:'board',
      목록주소:'https://www.seosan.go.kr/company/selectBbsNttList.do?bbsNo=2824&key=9456',
      공공누리:'게시물별 유형 확인',
      살핌:'2026-09-13 실측 — 살아 있으나 글이 2건뿐' },
    /* ★ 2026-09-13 대표 지시 「주소 찾아라」로 새 주소를 찾아 갈아 끼웠다(404 → 200).
       ⚠⚠ 그런데 «담을 것이 없다». 천안시 판을 다 열어 보고 재어 본 결과다:
         · 기업지원 공고(여기)  — 줄 13건 · 노무 관련 «0건».
           중소기업 육성자금 이자 지원 · 농공단지 물류비 · 해외시장개척단 ·
           전시박람회 참가 지원 · 기업인의 상 — 모두 «자금·판로» 지원이다.
         · 고시/공고             — 민방위 공시송달 · 거주불명등록 · 건축위원회 ·
           주민등록증 반송 — 모두 «지자체 행정»이다.
         · 채용공고              — 관서 채용이라 제외말이 거른다.
       ★ 천안시는 노무를 «다루지 않는다». 그것은 천안지청 몫이고 우리는 이미 읽고 있다
         (moel-cheonan). 그래서 여기는 읽개를 붙이지 않는다.
       ⚠ 게다가 지자체 판을 읽으면 관련말 「과태료」가 엉뚱한 것을 잡는다 — 실측에서
         「식품위생법 위반 과태료 체납 공시송달」·「의료법 위반 행정처분」이 걸렸다.
         공식링크 잣대를 넓히지 «않는» 까닭이 하나 더 늘었다.
       ★ 자금·판로 지원까지 편지에 실을지는 «꼭지를 넓히는 일»이라 대표 결정이 필요하다.
         결정이 나면 그때 읽개를 붙인다 — 주소는 여기 찾아 두었다. */
    { id:'cheonan-company', 기관:'천안시', 이름:'기업지원 공고', 지역:'충남/천안시', 방식:'board',
      목록주소:'https://www.cheonan.go.kr/bbs/BBSMSTR_000000000241/list.do',
      곁주소:'https://www.cheonan.go.kr/bbs/BBSMSTR_000000000242/list.do',
      공공누리:'게시물별 유형 확인',
      살핌:'2026-09-13 실측 — 200(옛 주소는 404였다). 줄 13건 가운데 노무 관련 0건 — 자금·판로 지원만 올라온다' }
  ];

  var 저작권 = {
    본문복제:false, 사진복제:false, 자체요약필수:true, 원문링크필수:true,
    설명:'제목·기관·공식 원문 링크와 푸른이 직접 작성한 요약만 사용합니다.'
  };

  function 공식주소인가(url) {
    try {
      var u = new URL(String(url || ''));
      return u.protocol === 'https:' && /(^|\.)go\.kr$/i.test(u.hostname);
    } catch (_) { return false; }
  }

  function 지역출처(지역) {
    var 곳 = String(지역 || '전국').trim() || '전국';
    return 목록.filter(function (x) {
      return x.지역 === '전국' || 곳 === x.지역 || 곳.indexOf(x.지역 + '/') === 0;
    }).sort(function (a, b) {
      return b.지역.split('/').length - a.지역.split('/').length || a.기관.localeCompare(b.기관, 'ko');
    });
  }

  var API = { 목록:목록, 저작권:저작권, 공식주소인가:공식주소인가, 지역출처:지역출처 };
  if (typeof module === 'object' && module.exports) module.exports = API;
  else global.PuNewsRegionalSources = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
