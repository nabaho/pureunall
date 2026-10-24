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
      ['rgn', 'ind', 'indY', 'jnt'].forEach(function (k) { if (s(r[k])) adds[adds.length - 1][k] = s(r[k]); });
      if (s(r.lk) === '2') adds[adds.length - 1].lk = '2';   /* «제대로 본» 표시만(1 은 차수 빠진 옛 헛 조회) */
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

  /* ── 출처별 «받은 기록» — 나라장터·알리오·기업마당이 «계속 새로 들어오는지» 눈으로 보려고 (대표 지시 2026-10-19) ──
     화면이 「새로 받기」를 마칠 때마다 출처마다 한 줄을 남긴다(noteFetch). 하루 한 줄씩 21일치(hist)도 쌓는다.
     ⚠ «받은 건수»는 걸러내기 «전» 건수다 — 걸린 공고는 드물어서 목록의 최근 공고일은 «수집이 멈췄다»는 증거가 못 된다.
        그래서 받은 «전체» 중 가장 최근 게시일(newest)을 따로 적는다.
     ⚠ 못 받은 날(err)은 «받았다»로 덮지 않는다 — 마지막으로 «잘» 받은 때(okAt)를 따로 둔다. */
  var SRCS = [{ k: 'g2b', label: '나라장터', late: 6 }, { k: 'alio', label: '알리오', late: 0 }, { k: 'biz', label: '기업마당', late: 0 }];
  var HIST_DAYS = 21;
  function seoulDay(iso) { var t = Date.parse(iso); return isNaN(t) ? '' : new Date(t + 9 * 3600e3).toISOString().slice(0, 10); }
  function seoulStamp(iso) { var t = Date.parse(iso); return isNaN(t) ? '' : new Date(t + 9 * 3600e3).toISOString().slice(5, 16).replace('T', ' ').replace('-', '.'); }
  function mmdd(ymd) { return /^\d{4}-\d{2}-\d{2}/.test(s(ymd)) ? s(ymd).slice(5, 10).replace('-', '.') : ''; }
  function daysBetween(a, b) { var x = Date.parse(a), y = Date.parse(b); return isNaN(x) || isNaN(y) ? null : Math.round((y - x) / 86400000); }
  /* rows → 가장 최근 게시일(YYYY-MM-DD) */
  function newestOf(rows) {
    var best = '';
    (rows || []).forEach(function (r) { var d = s(r && r.openDt).slice(0, 10); if (/^\d{4}-\d{2}-\d{2}$/.test(d) && d > best) best = d; });
    return best;
  }
  /* stat(옛 기록) + 이번에 받은 결과 → 새 stat (옛 것은 안 고친다). info = { n, newest, err } */
  function noteFetch(stat, key, info, nowIso) {
    var st = stat && typeof stat === 'object' ? JSON.parse(JSON.stringify(stat)) : {};
    st.cur = st.cur && typeof st.cur === 'object' ? st.cur : {};
    st.hist = Array.isArray(st.hist) ? st.hist : [];
    info = info || {};
    var prev = st.cur[key] || {}, err = s(info.err).slice(0, 120);
    var rec = { at: nowIso, n: Number(info.n) || 0, newest: s(info.newest), err: err, okAt: err ? s(prev.okAt) : nowIso };
    st.cur[key] = rec;
    var d = seoulDay(nowIso);
    if (d) {
      var row = st.hist.filter(function (h) { return h && h.d === d; })[0];
      if (!row) { row = { d: d }; st.hist.push(row); }
      /* 같은 날 잘 받은 뒤 한 번 못 받아도 그날을 «못 받음»으로 바꾸지 않는다 */
      if (!(row[key] && !row[key].e && err)) row[key] = { n: rec.n, newest: rec.newest, e: err ? 1 : 0 };
    }
    st.hist.sort(function (a, b) { return a.d < b.d ? -1 : a.d > b.d ? 1 : 0; });
    if (st.hist.length > HIST_DAYS) st.hist = st.hist.slice(st.hist.length - HIST_DAYS);
    return st;
  }
  /* 출처마다 한 줄 요약 — k: ok / late / bad / none, todayYmd = 서울 날짜 */
  function summarize(stat, todayYmd) {
    return SRCS.map(function (sr) {
      var c = stat && stat.cur && stat.cur[sr.k];
      if (!c) return { key: sr.k, label: sr.label, k: 'none', text: '아직 받은 기록이 없습니다' };
      var okDay = seoulDay(c.okAt || ''), age = okDay && todayYmd ? daysBetween(okDay, todayYmd) : null;
      var newestAge = c.newest && todayYmd ? daysBetween(c.newest, todayYmd) : null;
      var got = seoulStamp(c.at) + ' 받음 · ' + (Number(c.n) || 0).toLocaleString('ko-KR') + '건' + (c.newest ? ' · 최근 게시 ' + mmdd(c.newest) : '');
      if (c.err) return { key: sr.k, label: sr.label, k: 'bad', text: '못 받음 — ' + s(c.err) + (c.okAt ? ' · 마지막 성공 ' + seoulStamp(c.okAt) : ' · 아직 성공한 적 없음') };
      if (age != null && age >= 2) return { key: sr.k, label: sr.label, k: 'late', text: age + '일째 새로 안 받았습니다 — 마지막 ' + seoulStamp(c.okAt) };
      if (sr.late && newestAge != null && newestAge > sr.late) return { key: sr.k, label: sr.label, k: 'late', text: got + ' — ⚠ 받은 공고 중 가장 최근 게시가 ' + newestAge + '일 전입니다. 새 공고가 안 오는지 확인해 주세요' };
      return { key: sr.k, label: sr.label, k: 'ok', text: got };
    });
  }
  /* 하루 한 줄 기록 → 표 줄(최근 날부터) — 칸 글: 「3,077건 · 최근 게시 10.17」·「⚠ 못 받음」·「—」 */
  function history(stat) {
    var list = (stat && Array.isArray(stat.hist) ? stat.hist : []).slice().reverse();
    return list.map(function (h) {
      var cells = {};
      SRCS.forEach(function (sr) {
        var c = h[sr.k];
        cells[sr.k] = !c ? '—' : (c.e ? '⚠ 못 받음' : (Number(c.n) || 0).toLocaleString('ko-KR') + '건' + (c.newest ? ' · 최근 게시 ' + mmdd(c.newest) : ''));
      });
      return { d: h.d, day: mmdd(h.d), cells: cells };
    });
  }

  const api = { merge: merge, status: status, noteFetch: noteFetch, summarize: summarize, history: history, newestOf: newestOf, SRCS: SRCS, HIST_DAYS: HIST_DAYS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GovInbox = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
