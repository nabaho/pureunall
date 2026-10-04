/* 푸른 캘린더 › 컨설턴트 모집 일정 — 순수 모듈 (DOM·통신 없음)
   ────────────────────────────────────────────────────────────────────────
   대표 결정 2026-10-04: 컨설턴트 모집 일정을 「구글 캘린더와 푸른 캘린더 둘 다」에.
   구글 쪽은 정부사업신청(gov.html)이 «일정 만들기 창»을 채워 연다(PR #1904).
   이 파일은 푸른 쪽 — 대표 개인 클라우드 gov/{uid}/recruit 를 «달력 칩»으로 바꾼다.

   ★ 칩은 둘이다
     ① [모집 준비] 기관 — 보통 N월 모집 : 모집 달의 «앞 달 1일», 해마다
     ② [마감] 기관 컨설턴트 지원       : log[기관][해].due 가 적힌 날

   ★ 기관 묶기·모집 달·준비 날 셈은 js/gov-recruit.js(GovRecruit)를 «그대로» 부른다.
     ⚠ 여기서 다시 짜지 말 것 — 두 곳이 되면 정부사업신청 화면과 달력의 날짜가 어긋난다.

   ⚠ 여기서 자료를 «읽지» 않는다. 부르는 쪽(pu-cal.html)이 대표일 때만 읽어 넘긴다.
   ⚠ 이알피 data/ 일정 표에 쓰지 않는다 — 화면에 얹어 보이기만 한다(movable:false).
   ⚠ 폴더 이름(scan.name)은 제목·줄 어디에도 넣지 않는다 — 기관 이름만.
   ⚠ 공지 링크는 http(s) 만 받는다 — 사람이 고쳐 넣은 주소(recruit.url)가 섞인다.

   tests/cal-recruit.test.js 가 vm 에 올려 실제로 돌려 본다. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PuCalRecruit = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  /* 대표 = 사번 P-001 또는 이름 권형하 (경력관리 잠금과 같은 잣대) */
  var OWNER_SID = 'P-001', OWNER_NAME = '권형하';
  function isOwner(me) {
    if (!me) return false;
    var sid = String(me.sid || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    return sid === 'P001' || String(me.name || '').trim() === OWNER_NAME;
  }

  function s(v) { return v == null ? '' : String(v); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymdOf(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function dateOf(ymd) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s(ymd));
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }
  /* 파이어베이스는 배열을 {0:…,1:…} 로 돌려줄 때가 있다 — 어느 쪽이든 배열로 */
  function list(v) {
    if (Array.isArray(v)) return v.filter(Boolean);
    if (v && typeof v === 'object') return Object.keys(v).map(function (k) { return v[k]; }).filter(Boolean);
    return [];
  }
  function obj(v) { return (v && typeof v === 'object' && !Array.isArray(v)) ? v : {}; }
  function safeUrl(u) { u = s(u).trim(); return /^https?:\/\/[^\s"'<>]+$/i.test(u) ? u : ''; }

  /* 기관 묶음 — 정부사업신청 recGroups 와 같은 셈(묶고 → 링크 덮어쓰기) */
  function orgsOf(GR, recruit) {
    var rc = obj(recruit), u = obj(rc.url);
    var g = GR.group(list(rc.scan), list(rc.custom));
    g.orgs.forEach(function (o) { if (u[o.id] != null) o.url = s(u[o.id]); });
    return g.orgs;
  }

  /* 입력: { recruit, GovRecruit, from, to, sid }
       from·to — 보이는 첫 칸·끝 칸 날짜(YYYY-MM-DD) · sid — 칩 주인(대표 사번)
     나옴: [{ date, sid, key(기관 id), kind:'recruit-prep'|'recruit-due', text, color, rows, hint, tip, url, movable:false }] */
  function chips(o) {
    o = o || {};
    var GR = o.GovRecruit, rc = obj(o.recruit);
    var from = dateOf(o.from), to = dateOf(o.to);
    if (!GR || !from || !to || to < from) return [];
    var log = obj(rc.log), out = [], sid = s(o.sid);
    var orgs = GR.order(orgsOf(GR, rc), from);

    function 상태줄(id, y) {
      var st = s(obj(obj(log[id])[y]).st);
      return st ? { i: '✔', t: y + '년 상태: ' + st } : null;
    }
    function 공통줄(org) {
      return [
        org.what ? { i: '🧑‍💼', t: org.what } : null,
        org.years.length ? { i: '📁', t: '지원한 해: ' + org.years.join('·') } : null,
        safeUrl(org.url) ? { i: '🔗', t: safeUrl(org.url) } : null
      ];
    }

    orgs.forEach(function (org) {
      /* ① 준비 알림 — GovRecruit.prepDate 로 «보이는 첫 날 이후 가장 가까운» 날부터 센다 */
      if (org.month) {
        var d = GR.prepDate(org.month, from), guard = 0;
        while (d && d <= to && guard++ < 5) {
          var y = String(org.month === 1 ? d.getFullYear() + 1 : d.getFullYear());   /* 모집이 열리는 해 */
          var 제목 = '[모집 준비] ' + org.name + ' — 보통 ' + org.month + '월 모집';
          out.push({ date: ymdOf(d), sid: sid, key: org.id, kind: 'recruit-prep', text: '🧑‍💼 ' + 제목,
            color: '#0f766e', url: safeUrl(org.url),
            rows: 공통줄(org).concat([상태줄(org.id, y)]).filter(Boolean),
            hint: ['「보통」은 그동안 서류를 만든 파일 날짜로 어림한 달입니다 — 실제 공고를 확인하세요.',
                   '정부사업신청 › 🧑‍💼 컨설턴트 모집에서 고칩니다 (나만 보입니다).'],
            tip: 제목 + (org.what ? '\n' + org.what : ''), movable: false });
          d = GR.prepDate(org.month, new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1));
        }
      }
      /* ② 마감일 — 적어 둔 해마다 */
      Object.keys(obj(log[org.id])).forEach(function (y) {
        var due = s(obj(log[org.id][y]).due), dd = dateOf(due);
        if (!dd || dd < from || dd > to) return;
        var 제목 = '[마감] ' + org.name + ' 컨설턴트 지원';
        out.push({ date: due, sid: sid, key: org.id, kind: 'recruit-due', text: '⏰ ' + 제목,
          color: '#b91c1c', url: safeUrl(org.url),
          rows: 공통줄(org).concat([상태줄(org.id, y)]).filter(Boolean),
          hint: ['정부사업신청 › 🧑‍💼 컨설턴트 모집에서 적은 마감일입니다 (나만 보입니다).'],
          tip: 제목 + (org.what ? '\n' + org.what : ''), movable: false });
      });
    });
    return out;
  }

  return { isOwner: isOwner, chips: chips, safeUrl: safeUrl, OWNER_SID: OWNER_SID, OWNER_NAME: OWNER_NAME };
});
