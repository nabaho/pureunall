/* 달력에 «날짜로 뜨는» 것들 — 사건 기한과 휴직 (2026-09-21)
   ────────────────────────────────────────────────────────────────────────
   ★ 왜 파일로 뺐나 (캘린더 한 곳으로 모으기 5걸음)
     4걸음에서 이알피 법인 대시보드를 걷어내며 그 달력의 층 셋이 함께 사라졌다 —
       ① 사건 마감일(사람이 넣은 것)  ② 사건 단계 기한(계산된 것)  ③ 휴직 시작·종료
     ①②는 대표 지시로 푸른 캘린더에 되살린다. ③은 4걸음에서 «보고하지 못하고»
     함께 사라졌던 것이라 같이 되살린다.

   ★ 왜 여기서 셈하나 — 단계 기한은 이알피도 «나의 업무 D-day»에서 쓴다.
     같은 셈을 두 곳에 쓰면 언젠가 어긋나고, 그때 어느 쪽이 맞는지 아무도 모른다.
     그래서 이알피의 caseStageDue 도 이 파일을 부른다.

   ★ 옮겨 온 규칙들 (지운 이알피 코드에서 그대로)
     ① 끝난 사건은 안 그린다 — permanentArchived · closedDate
     ② 보고 있는 달 범위 밖은 안 넣는다
     ③ 단계 기한은 «계산된 값»이라 끌어 옮길 수 없다(movable:false)
        — 사람이 넣은 마감일과 다르다. 옮기면 계산이 맞지 않게 된다.
     ④ 아직 «확인되지 않은» 기한에는 「(확인)」을 붙이고 색을 달리한다 —
        그대로 믿고 날짜를 넘기면 사고다
     ⑤ 휴직은 «시작일과 종료일에만» 뜬다 — 그 사이를 다 칠하면 달력이 덮인다

   ⚠ 여기서 자료를 «읽지» 않는다. 부르는 쪽이 읽어서 넘긴다 —
     앱마다 읽는 길(dbGet · PuCalRead)이 달라서다.

   tests/case-due-chips.test.js 가 위 다섯을 하나씩 되돌려 보며 지킨다. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PuCaseDue = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  /* YYYY-MM-DD + n일.
     ⚠ Date.UTC 로만 센다 — 지역 시간으로 세면 서머타임·시간대에 따라 하루 밀린다.
       법정 기한이 하루 밀리면 그것은 사고다. */
  function addDays(ymd, days) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || ''));
    if (!m) return '';
    var t = Date.UTC(+m[1], +m[2] - 1, +m[3]) + (days * 86400000);
    var d = new Date(t);
    return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2)
      + '-' + ('0' + d.getUTCDate()).slice(-2);
  }

  /* 단계 하나의 기한 — 기산일(송달일 또는 판정일) + dueDays «달력일».
     ※ 달력일 기준이다(영업일 아님). 법정 기준이 영업일이면 대표가 유형 관리에서 고친다. */
  function stageDue(stage, stageDef) {
    if (!stage || !stageDef) return null;
    var days = parseInt(stageDef.dueDays, 10) || 0;
    if (days <= 0) return null;
    var basis = (stageDef.dueFrom === 'result') ? 'result' : 'notice';
    var base = (basis === 'result') ? stage.resultDate : stage.noticeDate;
    var due = addDays(base, days);
    if (!due) return null;
    return { due: due, basis: basis, days: days };
  }

  /* 단계 코드 → 그 단계의 정의. 카탈로그는 부르는 쪽이 넘긴다(숨긴 것도 포함해 찾는다 —
     숨겼다고 이미 걸린 기한이 사라지면 안 된다). */
  function infoOf(catalog, code) {
    if (!code || !Array.isArray(catalog)) return null;
    for (var i = 0; i < catalog.length; i++) {
      if (catalog[i] && catalog[i].code === code) return catalog[i];
    }
    return null;
  }

  function 끝난사건(c) { return !!(c && (c.permanentArchived || c.closedDate)); }
  function 범위안(d, from, to) {
    if (!d) return false;
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  }

  /* 달력에 얹을 것들을 한 벌로 만든다.
     입력: { cases, stageCatalog, loa, users, from, to }
       from·to — 보고 있는 달의 «첫 칸·마지막 칸» 날짜(앞뒤 달에 걸친 줄까지)
     나옴: [{ date, sid, kind, text, color, tip, search, movable:false }]
       kind — 'case-due' | 'stage-due' | 'loa'
     ⚠ 셋 다 movable:false 다. 계산된 값이거나 다른 화면이 주인인 자료라
       달력에서 끌어 옮기면 «그 화면과 어긋난다». */
  function chips(입력) {
    var o = 입력 || {};
    var cases = Array.isArray(o.cases) ? o.cases : [];
    var 카탈로그 = Array.isArray(o.stageCatalog) ? o.stageCatalog : [];
    var loa = Array.isArray(o.loa) ? o.loa : [];
    var users = Array.isArray(o.users) ? o.users : [];
    var from = o.from || '', to = o.to || '';
    var out = [];

    function 이름(sid) {
      for (var i = 0; i < users.length; i++) {
        if (users[i] && users[i].sid === sid) return users[i].name || '';
      }
      return '';
    }
    function 사건이름(c) { return c.companyName || c.title || c.caseNo || '사건'; }

    cases.forEach(function (c) {
      if (!c || 끝난사건(c)) return;                         /* ① */
      var 담당 = c.managerMain || '';
      var 찾을말 = [c.title, c.caseNo, c.caseType, c.companyName, c.payee]
        .filter(Boolean).join(' ');

      /* ── 사람이 넣은 마감일 ── */
      (Array.isArray(c.deadlines) ? c.deadlines : []).forEach(function (d) {
        if (!d || !범위안(d.date, from, to)) return;         /* ② */
        out.push({
          date: d.date, sid: 담당, kind: 'case-due',
          text: '⚖️ ' + (c.title || c.caseNo || '사건') + ' 마감',
          color: '#dc2626',
          tip: (c.title || c.caseNo || '사건') + ' 마감'
            + (c.companyName ? '\n' + c.companyName : '')
            + (d.note ? '\n' + d.note : '')
            + '\n\n사건관리에서 고칩니다',
          search: 찾을말, movable: false
        });
      });

      /* ── 계산된 단계 기한 ── */
      (Array.isArray(c.stages) ? c.stages : []).forEach(function (stg) {
        var info = infoOf(카탈로그, stg && stg.code);
        var d = stageDue(stg, info);
        if (!d || !범위안(d.due, from, to)) return;          /* ② */
        var 이름표 = (info && (info.short || info.name)) || '단계';
        var 확인됨 = !!(info && info.dueVerified);
        out.push({
          date: d.due, sid: 담당, kind: 'stage-due',
          /* ④ 확인 안 된 기한은 그대로 믿지 않게 «(확인)»을 붙인다 */
          text: '⚖ ' + 이름표 + ' 기한' + (확인됨 ? '' : '(확인)') + ' · ' + 사건이름(c),
          color: 확인됨 ? '#991b1b' : '#d97706',
          tip: 이름표 + ' 기한 · ' + 사건이름(c)
            + '\n' + (d.basis === 'result' ? '판정일' : '송달일') + ' + ' + d.days + '일'
            + (확인됨 ? '' : '\n⚠ 아직 확인되지 않은 기한입니다 — 법령을 직접 확인하십시오')
            + '\n\n사건 ▸ 심급·단계에서 계산된 기한입니다',
          search: [찾을말, stg && stg.caseNo, info && info.name].filter(Boolean).join(' '),
          movable: false                                      /* ③ */
        });
      });
    });

    /* ── 휴직 — 시작일·종료일에만 ⑤ ── */
    loa.forEach(function (l) {
      if (!l || !l.startDate) return;
      var 누구 = 이름(l.sid);
      var 머리 = '🏠 ' + (l.typeLabel || l.loaType || '휴직') + (누구 ? ' ' + 누구 : '');
      function 넣기(날, 꼬리) {
        out.push({
          date: 날, sid: l.sid, kind: 'loa',
          text: 머리 + ' ' + 꼬리, color: '#2563eb',
          tip: 머리 + ' ' + 꼬리
            + (l.startDate ? '\n' + l.startDate + ' ~ ' + (l.endDate || '(미정)') : '')
            + '\n\n인사관리 ▸ 휴직에서 고칩니다',
          search: [누구, l.typeLabel, l.loaType].filter(Boolean).join(' '),
          movable: false
        });
      }
      if (범위안(l.startDate, from, to)) 넣기(l.startDate, '시작');
      /* 종료일이 시작일과 «같으면» 두 번 그리지 않는다 — 한 칸에 같은 말이 두 줄 뜬다 */
      if (l.endDate && l.endDate !== l.startDate && 범위안(l.endDate, from, to)) 넣기(l.endDate, '종료');
    });

    return out;
  }

  return { addDays: addDays, stageDue: stageDue, infoOf: infoOf, chips: chips };
});
