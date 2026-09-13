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
    { id:'chungnam-press', 기관:'충청남도', 이름:'보도자료', 지역:'충남', 방식:'board',
      목록주소:'https://www.chungnam.go.kr/cnportal/bbs/B0000417/list.do?menuNo=500498',
      공공누리:'게시물별 유형 확인' },
    { id:'seosan-company', 기관:'서산시', 이름:'기업지원 새소식', 지역:'충남/서산시', 방식:'board',
      목록주소:'https://www.seosan.go.kr/company/selectBbsNttList.do?bbsNo=2824&key=9456',
      공공누리:'게시물별 유형 확인' },
    { id:'cheonan-company', 기관:'천안시', 이름:'일자리·기업지원 사전정보', 지역:'충남/천안시', 방식:'board',
      목록주소:'https://www.cheonan.go.kr/prog/ioCateData/kor/sub03_01_02/list.do?cate_b_cd=b01&cate_cd=0111',
      공공누리:'게시물별 유형 확인' }
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
