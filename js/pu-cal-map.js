/* 푸른 캘린더 › 주소 지도 · 하루 방문 동선 — 순수 모듈 (DOM·통신 없음)
   ────────────────────────────────────────────────────────────────────────
   대표 지시 2026-10-09 「팝업창이 나올경우 주소에 대해 지도를 팝업으로 볼수 있게」
                       「시간단위로 사업장방문시 주소로 동선 만들고 … 제네시스 차량에」(순정내비).

   ★ 지도는 «구글 지도 끼워 보기»(열쇠 없이 주소 글자만으로 뜬다).
     카카오·네이버 지도는 창 안에 못 끼운다(열쇠·도메인 등록이 있어야 한다) — 대신 «앱으로 넘기는 단추».
   ★ 동선은 그날 «주소가 있는» 일정만, «시각 순서»로 늘어놓는다. 시각 없는 것은 맨 뒤.
     출발지는 비운다 — 구글 지도가 «지금 내 자리»에서 시작한다.
   ★ 순정 내비로는 이 화면이 «직접» 못 보낸다(차 회사 앱을 거쳐야 한다).
     그래서 동선을 «글로 복사»해 주고, 한 곳씩 «주소 복사»를 둔다 — 차 회사 앱에 붙여 넣는다.

   ⚠ 주소는 남이 적은 글이다 — 링크는 언제나 encodeURIComponent 를 거친다.
   ⚠ 온라인 회의(줌·구글 미트 링크)는 장소가 아니다 — 동선과 지도에서 뺀다.

   tests/cal-map-route.test.js 가 실제로 돌려 본다. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PuCalMap = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  /* 구글 지도 길찾기 주소가 받는 경유지 수 — 넘치면 나눠 연다 */
  var MAX_WAYPOINTS = 9;

  function s(v) { return v == null ? '' : String(v); }
  function enc(v) { return encodeURIComponent(v); }

  /* 장소 글 → 지도에 넣을 주소. 장소가 아니면 "" */
  function cleanPlace(v) {
    var t = s(v).replace(/\s+/g, ' ').trim();
    if (!t) return '';
    if (/^(https?:\/\/|www\.)/i.test(t)) return '';
    if (/zoom\.us|meet\.google|teams\.microsoft|webex/i.test(t)) return '';
    return t.slice(0, 200);
  }

  /* 창 안에 끼울 구글 지도(열쇠 없이) */
  function embedUrl(place) {
    var p = cleanPlace(place);
    return p ? 'https://maps.google.com/maps?q=' + enc(p) + '&hl=ko&z=16&output=embed' : '';
  }

  /* 앱·새 창으로 넘기는 주소들 */
  function links(place) {
    var p = cleanPlace(place);
    if (!p) return null;
    return {
      kakao: 'https://map.kakao.com/link/search/' + enc(p),
      naver: 'https://map.naver.com/p/search/' + enc(p),
      google: 'https://www.google.com/maps/search/?api=1&query=' + enc(p),
      googleGo: 'https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=' + enc(p)
    };
  }

  /* 제목 앞 시각 — 「1000 가나상사」「0930-1500 …」「10:30 …」 → 「HH:MM」, 없으면 "".
     pu-cal.html 제목시각 과 «같은 꼴»만 시각으로 본다(연도 「2026년」·날짜 「2026-10」은 시각이 아니다).
     ⚠ 화면(js/pu-cal-map.js titleTime) ↔ 서버(functions/trip-remind.js titleTime) 같은 셈 — 검사가 맞대 본다. */
  function titleTime(title) {
    var m = /^\s*([01]\d|2[0-3]):?([0-5]\d)(?![\d년.\/]|-\d{1,2}(?!\d))/.exec(s(title));
    return m ? m[1] + ':' + m[2] : '';
  }

  /* 종일 일정의 제목 시각 — 「2026 일터혁신 31차 신청 마감」 같은 «연도»(2020~2039, 쌍점 없음)는 시각이 아니다.
     새벽 구글 시각을 고칠 때(화면 제목시각)는 구글 시각이 이미 있어 이 걱정이 없지만, 종일 일정은 제목이 전부다 */
  function allDayTime(title) {
    return /^\s*20[23]\d(?![:\d])/.test(s(title)) ? '' : titleTime(title);
  }

  function hm(v) {
    var m = /^(\d{2}):(\d{2})/.exec(s(v));
    return m && m[0] !== '00:00' ? m[0] : '';
  }

  /* 그날의 방문지 — 구글 일정 · 우리 일정 · 나만 보기 를 한 줄로.
     src = { gcal:[{id,date,end,time,text,place}], sch:[{id,date,time,endTime,title,place}], priv:[…] }
     돌려주는 것: [{ key, time, endTime, title, place }] (시각 순, 시각 없는 것은 뒤) */
  function stopsOn(ymd, src) {
    var o = src || {}, out = [];
    (o.gcal || []).forEach(function (e) {
      if (!e || e.date !== ymd) return;                       /* 여러 날 일정은 첫날에만 */
      var p = cleanPlace(e.place);
      /* 종일 일정이라도 제목 앞에 시각을 적었으면(「1000 …」) 그 시각으로 줄 세운다(2026-10-10).
         새벽 구글 시각은 화면(gcalToEvent)이 이미 제목 시각으로 바꿔 둔다. 여러 날 종일은 안 읽는다 */
      var 시각 = hm(e.time) || ((!e.end || e.end === e.date) ? allDayTime(e.text) : '');
      if (p) out.push({ key: 'gcal:' + e.id, time: 시각, endTime: '', title: s(e.text) || '일정', place: p });
    });
    [['sch', o.sch], ['priv', o.priv]].forEach(function (pair) {
      (pair[1] || []).forEach(function (x) {
        if (!x || x.date !== ymd || x._deleted) return;
        var p = cleanPlace(x.place);
        if (p) out.push({ key: pair[0] + ':' + x.id, time: hm(x.time), endTime: hm(x.endTime), title: s(x.title) || '일정', place: p });
      });
    });
    return out
      .map(function (x, i) { return { x: x, i: i }; })
      .sort(function (a, b) {
        var ta = a.x.time || '99:99', tb = b.x.time || '99:99';
        return ta < tb ? -1 : ta > tb ? 1 : a.i - b.i;
      })
      .map(function (w) { return w.x; });
  }

  /* 바로 앞과 같은 주소는 한 번만 들른다 */
  function dedupe(stops) {
    var out = [];
    (stops || []).forEach(function (x) {
      var p = cleanPlace(x && x.place);
      if (p && (!out.length || out[out.length - 1].place !== p)) out.push(Object.assign({}, x, { place: p }));
    });
    return out;
  }

  /* 구글 지도 길찾기 — 출발지는 «지금 내 자리». 경유지가 넘치면 여러 묶음으로 나눈다
     (다음 묶음은 앞 묶음의 끝에서 시작한다). 돌려주는 것: 주소 배열 */
  function routeUrls(stops) {
    var xs = dedupe(stops), urls = [];
    if (!xs.length) return urls;
    var 한번 = MAX_WAYPOINTS + 1;                                 /* 경유지 + 도착 */
    for (var i = 0; i < xs.length; i += 한번) {
      var 묶음 = xs.slice(i, i + 한번);
      var 끝 = 묶음[묶음.length - 1];
      var 들름 = 묶음.slice(0, -1).map(function (x) { return x.place; });
      var u = 'https://www.google.com/maps/dir/?api=1&travelmode=driving';
      if (i > 0) u += '&origin=' + enc(xs[i - 1].place);
      u += '&destination=' + enc(끝.place);
      if (들름.length) u += '&waypoints=' + enc(들름.join('|'));
      urls.push(u);
    }
    return urls;
  }

  /* 복사해 붙여 넣는 동선 글 — 차 회사 앱·메시지에 붙인다 */
  function routeText(ymd, stops) {
    var xs = dedupe(stops);
    if (!xs.length) return '';
    return ['[' + ymd + ' 방문 동선]'].concat(xs.map(function (x, i) {
      return (i + 1) + '. ' + (x.time ? x.time + (x.endTime ? '~' + x.endTime : '') + ' ' : '') + x.title + '\n   ' + x.place;
    })).join('\n');
  }

  return {
    MAX_WAYPOINTS: MAX_WAYPOINTS, titleTime: titleTime, allDayTime: allDayTime,
    cleanPlace: cleanPlace, embedUrl: embedUrl, links: links,
    stopsOn: stopsOn, dedupe: dedupe, routeUrls: routeUrls, routeText: routeText
  };
});
