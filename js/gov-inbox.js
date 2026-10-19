'use strict';
/* 정부사업신청 — 서버가 매일 모은 공고(gov_feed/rows)를 «내 목록(feed)»에 합치기
   (브라우저 window.GovInbox / Node module.exports 겸용, DOM·통신 없음)

   대표 지시 2026-10-12 「매일매일 공고를 크롤링 하고 모을 수 있나? 그게 가능하게 만들어 달라」.
   서버(functions/gov-feed-collect.js)는 받은 함에만 쓴다. 내 목록에 합치는 일은 «화면»이 한다 —
   숨김·별표·메모를 서버가 덮으면 안 되기 때문이다(gov-sync 의 줄마다 시각 규칙과도 부딪힌다).
   ⚠ 번호(no)가 내 목록에 «이미 있으면»(숨긴 것·지나간 것 포함) 건드리지 않는다 — 대표가 숨긴 공고가 되살아나면 안 된다.
   ⚠ 받은 함 줄은 서버가 «그때의 낱말»로 거른 것이다 — 지금 낱말(keep)에 안 맞으면 합치지 않는다. */
(function (root) {
  function s(v) { return v == null ? '' : String(v).trim(); }

  /* feed(내 목록 배열) + rows(받은 함 {열쇠: 줄}) → { adds(새 줄, 오래된 것부터), skipped, dropped }
     o = { dday(closeDt, today), keep(row) → 걸리나, today } — 새 줄에 id 를 붙이는 일은 부르는 쪽이 한다 */
  function merge(feed, rows, o) {
    o = o || {};
    const have = {};
    (feed || []).forEach(function (r) { if (r && r.no != null) have[String(r.no)] = 1; });
    const list = Object.keys(rows || {}).map(function (k) { return rows[k]; })
      .filter(function (r) { return r && s(r.no) && s(r.nm); })
      .sort(function (a, b) { return s(a.at).localeCompare(s(b.at)); });
    const adds = []; let skipped = 0, dropped = 0;
    list.forEach(function (r) {
      const no = s(r.no);
      if (have[no]) { skipped++; return; }
      if (o.keep && !o.keep(r)) { dropped++; return; }
      have[no] = 1;
      adds.push({
        src: s(r.src), no: no, nm: s(r.nm), org: s(r.org), ntce: s(r.ntce),
        openDt: s(r.openDt), closeDt: s(r.closeDt), prc: Number(r.prc) || 0, mthd: s(r.mthd),
        url: /^https:\/\//.test(s(r.url)) ? s(r.url) : '', kw: s(r.kw),
        year: s(r.openDt).slice(0, 4), dday: o.dday ? o.dday(r.closeDt, o.today) : null,
        type: '새 공고', savedAt: s(r.at)
      });
      /* 지역·업종 제한 — 있을 때만(서버가 나라장터 상세에서 읽은 것). 아래 칸 이름은 gov-g2b.js 와 같다 */
      ['rgn', 'ind', 'indY', 'jnt', 'lk'].forEach(function (k) { if (s(r[k])) adds[adds.length - 1][k] = s(r[k]); });
    });
    return { adds: adds, skipped: skipped, dropped: dropped };
  }

  /* 서버 상태 한 줄 — last = gov_feed/last · todayYmd = 서울 날짜. 문장과 «멈춘 날수»를 돌려준다 */
  function status(last, todayYmd) {
    if (!last) return { k: 'none', text: '아직 한 번도 안 돌았습니다 — 매일 아침 07:40 에 돕니다' };
    if (last.error) return { k: 'bad', text: '못 받았습니다 — ' + s(last.error) };
    const c = last.counts || {};
    const at = last.at ? new Date(Date.parse(last.at) + 9 * 3600e3).toISOString().slice(5, 16).replace('T', ' ').replace('-', '.') : '';
    let late = 0;
    if (last.today && todayYmd) late = Math.round((Date.parse(todayYmd) - Date.parse(last.today)) / 86400000);
    const body = '마지막 ' + at + ' · 나라장터 ' + (c.g2b || 0) + ' · 알리오 ' + (c.alio || 0) + ' · 기업마당 ' + (c.biz || 0)
      + ' · 새로 걸린 ' + (last.added || 0) + '건';
    if (late >= 2) return { k: 'late', text: body + ' — ⚠ ' + late + '일째 새로 안 돌았습니다' };
    return { k: 'ok', text: body };
  }

  const api = { merge: merge, status: status };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GovInbox = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
