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
      후보Id:clean(c.id, 100), 우리말:own, 갈래:'지역기사', 승인일:Number(at)||Date.now()
    };
  }

  var API = { 검토변경:검토변경, 승인뉴스:승인뉴스 };
  if (typeof module === 'object' && module.exports) module.exports = API;
  else global.PuNewsReview = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
