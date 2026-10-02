/* 📍 주소 검색어 · 같은 곳인가 (대표 제보 2026-10-02 「한 회사 — 기업정보함과 이알피 주소가 다르다」)
   ════════════════════════════════════════════════════════════════════════

   ■ 무슨 일이 있었나 (서버·다음 주소검색으로 실측)
     사업자등록증 사진을 읽은 글자가 「○○시 «서구» ○○읍 ○○1길 27」이었다
     (그 시에는 서구가 없다 — 서북구). 계약 창 「🔍 검색」은 칸에 적힌 «통째»로
     미리 찾는데, 다음 주소검색은 틀린 «구» 때문에 엉뚱한 «다른 구의 다른 길»
     를 «맨 위»에 올린다. 그것을 누르는 순간 바로 적용됐다 — 엉뚱한 주소가 들어갔다.
     도로명과 번호만 넣으면 바른 곳 «한 곳»만 나온다.

   ■ 그래서 둘을 한다
     ① query  — 미리 찾을 말을 «시·군 + 도로명 + 건물번호»로 줄인다.
                시·도·구·읍·동은 사진 판독이 잘 틀리는 자리라 뺀다(시·군은 남긴다 —
                「중앙로 10」 같은 흔한 길이 전국에서 쏟아지지 않게).
     ② same   — 고른 주소의 «도로명+번호»가 적어 둔 것과 같은가.
                다르면 바로 넣지 않고 한 번 묻는다.

   ⚠ 도로명이 없는 주소(지번만: 「○○리 73-4」)는 판단하지 않는다 — 전처럼 둔다.
   ⚠ 두 화면(푸른이알피·기업정보함)이 같은 잣대를 쓰게 «한 파일»이다 (js/pu-cokey.js 와 같은 결).
*/
(function (root) {
  'use strict';

  function clean(s) {
    return String(s == null ? '' : s)
      .replace(/\([^)]*\)/g, ' ')        // (○○리73-4번지) · (역삼동, 일리빌딩)
      .replace(/^\s*\d{5}\s+/, ' ')      // 앞에 붙은 우편번호
      .replace(/[,，]/g, ' ')
      .replace(/\s+/g, ' ').trim();
  }

  /* 도로명 + 건물번호 → { road:'가나1길', no:'27' } 또는 null
     「가나대로 123번길 16-16」 처럼 «번길»이 떨어져 있으면 붙여서 본다. */
  function road(s) {
    var t = clean(s).replace(/(\S(?:로|길))\s+(\d+번길)/g, '$1$2');
    var m = t.match(/(?:^|\s)([^\s]*[가-힣0-9](?:로|길)(?:\d+번길)?)\s*(\d+(?:-\d+)?)(?=$|[\s,])/);
    if (!m) return null;
    return { road: m[1], no: m[2] };
  }

  function key(s) { var r = road(s); return r ? r.road + ' ' + r.no : ''; }

  /* 시·군 — 「○○시」 「○○군」 「서울특별시」 「세종특별자치시」.
     ⚠ 「충청남도」 같은 도, 「서북구」 같은 구는 안 쓴다 — 틀려도 걸러지지 않는다. */
  function city(s) {
    var toks = clean(s).split(' ');
    for (var i = 0; i < toks.length; i++) if (/^[가-힣]+(?:시|군)$/.test(toks[i])) return toks[i];
    return '';
  }

  /* 미리 찾을 말. 도로명을 못 찾으면 예전처럼 «다듬은 통째»(층·호 뺀 것). */
  function query(s) {
    var r = road(s);
    if (r) { var c = city(s); return (c ? c + ' ' : '') + r.road + ' ' + r.no; }
    return clean(s).replace(/\s*\d+층.*$/, ' ').replace(/\s*[\d-]+호.*$/, ' ').replace(/\s+/g, ' ').trim();
  }

  /* 같은 곳인가 — 둘 다 도로명이 있을 때만 판단한다(아니면 null = 모름). */
  function same(a, b) {
    var ka = key(a), kb = key(b);
    if (!ka || !kb) return null;
    return ka === kb;
  }

  var api = { clean: clean, road: road, key: key, city: city, query: query, same: same };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PuAddr = api;
})(typeof window !== 'undefined' ? window : this);
