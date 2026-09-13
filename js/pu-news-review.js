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

  /* 재시도마다 서버가 준 최신 목록에 한 건만 더한다. 입력 객체는 고치지 않는다. */
  function 회차추가(issue, news, draft, by, at) {
    if (!news || !news.id) return null;
    var cur = issue || { 회차:draft.회차, 상태:'초안' };
    if (cur.상태 === '발송') return null;
    var list = Array.isArray(cur.지역뉴스) ? cur.지역뉴스 : [];
    if (list.some(function(x) { return x && (x.id === news.id ||
      (news.후보Id && x.후보Id === news.후보Id)); })) return null;
    return Object.assign({}, cur, { 지역뉴스:list.concat([news]),
      고친이:by, 고친때:at, revision:(Number(cur.revision)||0)+1 });
  }

  /* 두 경로의 공통 부모 newsletter에서 승인과 회차 추가를 함께 확정한다. */
  function 원자승인(root, id, draft, own, by, at) {
    if (!root || !draft || !draft.열쇠) return null;
    var c = (root.regionalCandidates || {})[id];
    if (!c || c.id !== id || c.상태 !== '검토대기') return null;
    var issues = root.issues || {};
    if (승인된회차(id, issues)) return null;
    var issue = issues[draft.열쇠];
    var news = 승인뉴스(c, own, (issue || {}).지역뉴스 || [], at);
    var next = 회차추가(issue, news, draft, by, at);
    if (!next) return null;
    return Object.assign({}, root, {
      issues:Object.assign({}, issues, { [draft.열쇠]:next }),
      regionalCandidates:Object.assign({}, root.regionalCandidates, { [id]:Object.assign({}, c, {
        상태:'승인', 승인회차:draft.열쇠, 승인일:at, 검토자:by, 검토일:at,
        revision:(Number(c.revision)||0)+1, updatedAt:at
      }) })
    });
  }

  function 승인된회차(candidateId, issues) {
    var id = clean(candidateId, 100);
    var all = issues && typeof issues === 'object' ? issues : {};
    return Object.keys(all).find(function(key) {
      var news = all[key] && Array.isArray(all[key].지역뉴스) ? all[key].지역뉴스 : [];
      return news.some(function(x) { return x && clean(x.후보Id, 100) === id; });
    }) || '';
  }

  /* 옛 화면의 저장 요청은 시간만으로 취소할 수 없다.
     저장된 회차가 확인된 경우만 확정하고, 미확인 잠금은 자동 해제하지 않는다. */
  function 복구판정(candidate, issues, now, waitMs) {
    var c = candidate && typeof candidate === 'object' ? candidate : null;
    if (!c || c.상태 !== '승인처리중') return null;
    var 회차 = 승인된회차(c.id, issues);
    if (회차) return Object.assign({}, c, {
      상태:'승인', revision:Math.max(1, Number(c.revision)||1) + 1,
      승인회차:회차, 승인일:Number(now)||Date.now(), 복구일:Number(now)||Date.now(), 복구결과:'회차 저장 확인'
    });
    return null;
  }

  var API = { 검토변경:검토변경, 승인뉴스:승인뉴스, 수동뉴스:수동뉴스,
    철회:철회, 활성인가:활성인가, 승인된회차:승인된회차, 복구판정:복구판정,
    회차추가:회차추가, 원자승인:원자승인 };
  if (typeof module === 'object' && module.exports) module.exports = API;
  else global.PuNewsReview = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
