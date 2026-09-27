/* 이음센터 «공개 일정»을 만드는 곳 — 한 곳에서 (2026-09-20)
   ────────────────────────────────────────────────────────────────────────
   외부 변호사·노무사에게 드리는 공유 링크(ieum-view.html)가 읽는 자리가
   `ieum_public` 이다. 원본은 이알피의 근태(attendance_records)이고, 여기 담기는 것은
   **이름·날짜·구분 셋뿐**이다 — 연락처·사번 같은 개인정보는 넣지 않는다(단방향 거울).

   ★ 왜 파일로 뺐나
     이 셈이 이알피 안에만 있었다. 그런데 이음 근무를 «푸른 캘린더에서도» 고치게
     되면서(1걸음), 캘린더에서 고친 것은 공개 뷰에 안 따라가는 구멍이 생겼다.
     캘린더에 같은 셈을 한 벌 더 쓰면 두 벌이 되어 언젠가 어긋난다 —
     그래서 «만드는 곳»을 이 파일 하나로 두고 두 앱이 함께 부른다.

   ★ 여기 담기는 것 (늘리지 말 것)
       roster : { "2026-09-24": [ {n:"홍길동", k:"law"}, … ] }   ← 그 날 누가 나오나
       people : { "<공유열쇠>": { name:"홍길동" } }               ← 그 링크가 누구 것인가
       updatedAt : 언제 발행했나
     k 는 셋뿐이다 — law(변호사) · ex(그 밖 외부) · in(우리 직원).

   ⚠ 이름 말고는 넣지 않는다. 이 자리는 로그인한 사람이면 누구나 읽는다(규칙 ieum_public).
   ⚠ 지난해 것부터 담는다 — 연말·연초에 지난달 일정이 사라지지 않게.

   tests/ieum-public-one-place.test.js 가 「두 앱이 같은 셈을 쓰는가」를 지킨다. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PuIeumPublic = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  /* 그 사람이 어느 무리인가 — 변호사는 따로 본다(공유 뷰가 색을 달리 준다) */
  function kindOf(ext) {
    return (String((ext && ext.role) || '').indexOf('변호사') >= 0) ? 'law' : 'ex';
  }

  /* 근태에서 «공개해도 되는 것»만 뽑아 낸다. 서버를 안 만진다(순수 셈). */
  function build(입력) {
    var o = 입력 || {};
    var att = o.attendance || [];
    var users = o.users || [];
    var ext = o.externals || [];
    var 올해 = o.year || new Date().getFullYear();
    var 지난해 = String(올해 - 1);

    var extMap = {}; ext.forEach(function (x) { if (x && x.id) extMap[x.id] = x; });
    var userMap = {}; users.forEach(function (u) { if (u && u.sid) userMap[u.sid] = u; });

    var roster = {};
    att.forEach(function (r) {
      if (!r || r.type !== 'eum-work' || !r.date) return;
      if (String(r.date).slice(0, 4) < 지난해) return;
      var name = '', kind = 'in';
      if (r.externalId) {
        var e = extMap[r.externalId];
        if (!e) return;                       /* 없는 사람은 담지 않는다 */
        name = e.name; kind = kindOf(e);
      } else if (r.sid) {
        var u = userMap[r.sid];
        name = u ? u.name : r.sid; kind = 'in';
      } else { return; }
      if (!roster[r.date]) roster[r.date] = [];
      roster[r.date].push({ n: name, k: kind });
    });

    /* 링크를 받은 «지금 일하는» 외부 사람만 */
    var people = {};
    ext.forEach(function (x) {
      if (!x || x.active === false || !x.shareKey) return;
      people[x.shareKey] = { name: x.name };
    });

    return { roster: roster, people: people };
  }

  /* 만들어서 올린다. 올리는 자리는 한 곳(ieum_public)이고 통째로 덮는다 —
     원본(attendance_records)에서 언제든 다시 만들 수 있는 거울이라 그래도 된다. */
  function publish(db, 입력) {
    if (!db) return Promise.reject(new Error('서버에 붙기 전입니다'));
    var 만든것 = build(입력);
    return db.ref('ieum_public').set({
      roster: 만든것.roster, people: 만든것.people, updatedAt: Date.now()
    }).then(function () { return 만든것; });
  }

  /* 새 공유 열쇠 — 이알피가 쓰던 것과 같은 꼴(36진수 8+4자리) */
  function newShareKey() {
    return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
  }

  return { build: build, publish: publish, kindOf: kindOf, newShareKey: newShareKey };
});
