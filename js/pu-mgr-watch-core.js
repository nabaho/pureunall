/* 🔎 담당 점검 — 셈 «한 벌» (2026-10-07 기업정보함 점검 ③)
   ════════════════════════════════════════════════════════════════════════
   이알피 업체 기록에는 담당 «변경 이력»이 없다(실측 2026-10-03: 377곳 중 0곳). 그래서
   «마지막으로 본 담당»을 pucards/config/mgrSeen/{업체 id} 에 적어 두고, 다음에 다르면
   pucards/config/mgrChange/{업체 id} 에 「전 → 새」를 남긴다. 사람이 「확인」하면 ack.

   ★ 왜 따로 떼었나 — 예전에는 이 셈이 기업정보함(pu-cards.html) 안에 있어
     «대표님 PC 에서 메일 화면이 열려 있을 때만» 돌았다. 화면을 안 열면 바뀐 담당을 못 잡았다.
     이제 서버(functions/mgr-watch.js)가 10분마다 돈다 — 같은 셈을 «한 벌» 쓰려고 여기 둔다.
   ⚠⚠ 고칠 곳은 늘 이 파일(js/)이다. 서버 사본(functions/mgr-watch-core/)은 손으로 고치지 않는다 —
     고친 뒤  node scripts/sync-mgr-watch-core.js  를 돌리고 서버 함수(mgrWatch)를 다시 올린다.
     tests/mgr-watch-core-in-sync.test.js 가 둘이 한 글자라도 다르면 걸린다.
   ⚠ 처음(기준이 빈 때)은 «지금 담당»을 적어 두기만 한다 — 그 전 것을 모르니 바뀐 것으로 안 잡는다.
   ⚠ 이알피 담당을 «고치지» 않는다. 찾아서 보여 줄 뿐이다. 업체는 열쇠(id)로 본다. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PuMgrWatch = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
  'use strict';

  /* DB 열쇠로 못 쓰는 글자가 든 id 는 건너뛴다 */
  var KEY_OK = /^[^.#$\[\]\/]+$/;

  /* 지금 일하는 업체만 — 끝난 업체(종료·해지·폐업)는 담당이 비거나 바뀌어도 볼 일이 없다 */
  function liveCos(cos) {
    return (cos || []).filter(function (c) {
      return c && c.id && KEY_OK.test(String(c.id)) && !c._deleted
        && !/closed|terminated|inactive/.test(String(c.status || ''));
    });
  }

  /* 지난번 본 담당 ↔ 지금 — 새 기준과 바뀐 것
     ⚠ 기준이 비어 있으면(처음) 바뀐 것을 안 낸다. 기준에 없던 새 업체도 «바뀐 것»이 아니다. */
  function diff(seen, cos, now) {
    var s0 = seen || {};
    var first = !Object.keys(s0).length;
    var next = {}, changes = [];
    (cos || []).forEach(function (c) {
      var id = String(c.id), m = String(c.managerMain || '');
      next[id] = m;
      if (first || !Object.prototype.hasOwnProperty.call(s0, id)) return;
      if (String(s0[id] || '') !== m) {
        /* 이알피가 남긴 이력의 마지막 줄이 «이 바꿈»이면 누가 했는지 함께 적는다(2026-10-03 승인제) */
        var hist = Array.isArray(c.mgrHistory) ? c.mgrHistory : [];
        var last = hist[hist.length - 1];
        var by = (last && String(last.to || '') === m)
          ? (last.okByName ? String(last.reqByName || '') + ' 요청 · ' + String(last.okByName) + ' 승인' : String(last.byName || ''))
          : '';
        var ch = { co: id, coName: String(c.name || ''), from: String(s0[id] || ''), to: m, at: now };
        if (by) ch.by = by;
        changes.push(ch);
      }
    });
    return { first: first, next: next, changes: changes };
  }

  /* 무엇을 적을지 — 기준(mgrSeen)과 바뀐 것(mgrChange)의 «고칠 자리»를 돌려준다.
     up 의 열쇠는 'mgrSeen/{id}' · 'mgrChange/{id}' (앞에 pucards/config/ 를 붙여 쓴다).
     ⚠ 확인 안 한 것이 또 바뀌면 «처음 담당»을 그대로 둔다 — 전→새 가 한눈에 보이게.
     ⚠ 원래대로 돌아왔으면 그 줄을 지운다(null). */
  function plan(seen, change, cos, now) {
    var s0 = seen || {}, c0 = change || {};
    var d = diff(s0, liveCos(cos), now);
    var up = {}, n = 0;
    Object.keys(d.next).forEach(function (id) { if (s0[id] !== d.next[id]) up['mgrSeen/' + id] = d.next[id]; });
    d.changes.forEach(function (ch) {
      var prev = c0[ch.co];
      var from = (prev && !prev.ack) ? String(prev.from || '') : ch.from;
      if (from === ch.to) {
        if (prev) up['mgrChange/' + ch.co] = null;
        return;
      }
      var rec = { co: ch.co, coName: ch.coName, from: from, to: ch.to, at: ch.at };
      if (ch.by) rec.by = ch.by;
      up['mgrChange/' + ch.co] = rec; n++;
    });
    return { up: up, n: n, first: d.first };
  }

  return { KEY_OK: KEY_OK, liveCos: liveCos, diff: diff, plan: plan };
});
