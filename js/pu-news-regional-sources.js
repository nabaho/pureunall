(function (global) {
  'use strict';

  /* 지역뉴스의 단일 공식 출처 등록부.
     1단계에서는 «어디를 읽을지»만 확정한다. RSS는 다음 수집 단계에서 자동으로 읽고,
     게시판은 사이트별 읽개가 검증되기 전까지 사람이 원문을 확인한다. */
  var 목록 = [
    { id:'moel-notice', 기관:'고용노동부', 이름:'공지사항', 지역:'전국', 방식:'rss',
      목록주소:'https://www.moel.go.kr/rss/notice.do', 공공누리:'출처표시 확인' },
    { id:'moel-policy', 기관:'고용노동부', 이름:'정책자료', 지역:'전국', 방식:'rss',
      목록주소:'https://www.moel.go.kr/rss/policy.do', 공공누리:'출처표시 확인' },
    { id:'moel-lawinfo', 기관:'고용노동부', 이름:'법령정보', 지역:'전국', 방식:'rss',
      목록주소:'https://www.moel.go.kr/rss/lawinfo.do', 공공누리:'출처표시 확인' },
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
