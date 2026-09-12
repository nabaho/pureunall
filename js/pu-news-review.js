(function (global) {
  'use strict';

  /* 검토대기 후보의 상태 전이와 회차에 담을 지역뉴스 모양.
     화면과 서버 값을 직접 만지지 않는 순수 부품으로 두어 동시검토 규칙을 검사한다. */
  function clean(v, n) { return String(v == null ? '' : v).trim().slice(0, n || 1000); }

  function 검토변경(candidate, next, by, at, reason) {
    var c = candidate && typeof candidate === 'object' ? candidate : null;
    if (!c || c.상태 !== '검토대기' || ['승인처리중','제외'].indexOf(next) < 0) return null;
    var out = Object.assign({}, c, {
      상태:next, revision:Math.max(1, Number(c.revision)||1) + 1,
      검토자:clean(by, 120), 검토일:Number(at)||Date.now()
    });
    if (next === '제외') out.제외사유 = clean(reason, 300) || '뉴스레터에 싣지 않음';
    return out;
  }

  function 승인뉴스(candidate, ownText, existing, at) {
    var c = candidate && typeof candidate === 'object' ? candidate : null;
    var own = clean(ownText, 1200);
    if (!c || !c.id || !own || !/^https:\/\//.test(clean(c.링크))) return null;
    if ((existing || []).some(function(x){ return x && x.후보Id === c.id; })) return null;
    return {
      id:'approved-' + clean(c.id, 100), entityType:'Message', schemaVersion:1,
      contractVersion:1, revision:1, sourceKind:'regionalNewsCandidate', sourceId:clean(c.id, 100),
      지역:clean(c.지역, 40) || '전국', 제목:clean(c.제목, 220), 링크:clean(c.링크, 1000),
      언론사:clean(c.기관, 80), 출처Id:clean(c.출처Id || c.sourceId, 80),
      후보Id:clean(c.id, 100), 우리말:own, 갈래:'지역기사', 상태:'활성', 승인일:Number(at)||Date.now()
    };
  }

  function 수동뉴스(input, by, at) {
    var x = input && typeof input === 'object' ? input : {};
    var 시각 = Number(at) || Date.now();
    var 출처 = clean(x.출처Id, 80), 링크 = clean(x.링크, 1000), 우리말 = clean(x.우리말, 1200);
    if (!출처 || !우리말 || !/^https:\/\//.test(링크)) return null;
    return {
      id:'manual-regional-' + 시각, entityType:'Message', schemaVersion:1,
      contractVersion:1, revision:1, sourceKind:'regionalNewsSource', sourceId:출처,
      지역:clean(x.지역, 40) || '전국', 제목:clean(x.제목, 220), 링크:링크,
      언론사:clean(x.언론사, 80), 출처Id:출처, 우리말:우리말,
      갈래:'지역기사', 상태:'활성', 등록자:clean(by, 120), 등록일:시각
    };
  }

  function 철회(news, reason, by, at) {
    var x = news && typeof news === 'object' ? news : null;
    var 왜 = clean(reason, 300);
    if (!x || x.상태 === '철회' || !왜) return null;
    return Object.assign({}, x, {
      상태:'철회', revision:Math.max(1, Number(x.revision)||1) + 1,
      철회사유:왜, 철회자:clean(by, 120), 철회일:Number(at)||Date.now()
    });
  }

  function 활성인가(news) { return !!news && news.상태 !== '철회'; }

  function 승인된회차(candidateId, issues) {
    var id = clean(candidateId, 100);
    var all = issues && typeof issues === 'object' ? issues : {};
    return Object.keys(all).find(function(key) {
      var news = all[key] && Array.isArray(all[key].지역뉴스) ? all[key].지역뉴스 : [];
      return news.some(function(x) { return x && clean(x.후보Id, 100) === id; });
    }) || '';
  }

  /* 브라우저가 승인 도중 닫혀도 영구 잠금으로 두지 않는다.
     회차에 들어갔으면 승인 완료, 안 들어간 채 10분 지난 것만 검토대기로 돌린다. */
  function 복구판정(candidate, issues, now, waitMs) {
    var c = candidate && typeof candidate === 'object' ? candidate : null;
    if (!c || c.상태 !== '승인처리중') return null;
    var 회차 = 승인된회차(c.id, issues);
    if (회차) return Object.assign({}, c, {
      상태:'승인', revision:Math.max(1, Number(c.revision)||1) + 1,
      승인회차:회차, 승인일:Number(now)||Date.now(), 복구결과:'회차 저장 확인'
    });
    var 지금 = Number(now)||Date.now(), 기다림 = Math.max(60000, Number(waitMs)||600000);
    if (!Number(c.검토일) || Number(c.검토일) > 지금 - 기다림) return null;
    return Object.assign({}, c, {
      상태:'검토대기', revision:Math.max(1, Number(c.revision)||1) + 1,
      검토자:'', 검토일:0, 복구일:지금, 복구결과:'회차 저장 없음 — 잠금 해제'
    });
  }

  var API = { 검토변경:검토변경, 승인뉴스:승인뉴스, 수동뉴스:수동뉴스,
    철회:철회, 활성인가:활성인가, 승인된회차:승인된회차, 복구판정:복구판정 };
  if (typeof module === 'object' && module.exports) module.exports = API;
  else global.PuNewsReview = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
