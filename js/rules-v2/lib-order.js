/* 취업규칙(새) — 「모은 자료」 셈 (설계 §4-6 · 2026-10-03 목업 2 「추천대로」)
   순수 모듈. 서버가 적은 재료(갈래·날짜·보낸 쪽·메일 열쇠·이름)와 사람 칸(human)만 보고 셈한다.
   ⚠ 회차·판 순서·최종본 후보는 «사업장 확정»을 딛는다 — 미확정 자료는 사업장별 보기에 안 넣는다.
   ⚠ 후보는 후보일 뿐 — 최종본은 사람이 회차 레코드(rounds)에 적은 것만. */
(function (root) {
  'use strict';
  // 반년(183일) 넘게 비면 다른 회차로 본다
  var GAP = 183 * 864e5;
  function str(v) { return v == null ? '' : String(v); }
  function merge(docs, human) {
    return Object.keys(docs || {}).map(function (id) {
      var d = docs[id] || {}, h = (human || {})[id] || {};
      return { id: id, doc: d, h: h, kind: h.kindFix || d.kind, name: str(d.name), status: d.status, dir: d.dir,
        companyId: h.companyLinkStatus === 'linked' && h.companyId ? str(h.companyId) : null,
        date: Number((d.mail && d.mail.date) || 0), round: str(h.round) };
    });
  }
  function numberOf(items) {
    var s = items.slice().sort(function (a, b) {
      return (Number(a.doc.createdAt) || 0) - (Number(b.doc.createdAt) || 0) || (a.id < b.id ? -1 : 1); });
    var out = {}; s.forEach(function (it, i) { out[it.id] = i + 1; }); return out;
  }
  function mailKey(it) { var m = it.doc.mail || {}; return str(m.src) + ':' + str(m.box) + ':' + str(m.key); }
  function byMail(items) {
    var map = {}, list = [];
    items.forEach(function (it) {
      var k = mailKey(it);
      if (!map[k]) { map[k] = { mailKey: k, mail: it.doc.mail || {}, items: [] }; list.push(map[k]); }
      map[k].items.push(it);
    });
    return list.sort(function (a, b) { return Number(b.mail.date || 0) - Number(a.mail.date || 0); });
  }
  // 회차 이름의 연월은 한국 시간 기준 — 한국은 서머타임이 없어 +9시간이면 된다 (UTC 로 보면 1일 새벽 메일이 전달로 밀린다)
  function ym(ms) { var d = new Date(ms + 9 * 36e5); return 'r' + d.getUTCFullYear() + ('0' + (d.getUTCMonth() + 1)).slice(-2); }
  var UNDATED = 'r000000';
  function roundsOf(items) {
    var s = items.slice().sort(function (a, b) { return a.date - b.date || (a.id < b.id ? -1 : 1); });
    var auto = [], cur = null, last = 0, undated = [];
    s.filter(function (it) { return !it.round; }).forEach(function (it) {
      // 날짜를 모르는 것은 간격 셈에 끼우지 않는다 — 다음 회차를 삼키거나 1970년 회차를 만든다
      if (!it.date) { undated.push(it); return; }
      // 신고서는 회차를 닫는다. 단, 같은 메일에 딸린 다른 첨부는 그 회차에 남긴다
      var closedHere = cur && cur.closed && mailKey(it) !== cur.closeMail;
      if (!cur || (last && it.date - last > GAP) || closedHere) { cur = { items: [] }; auto.push(cur); }
      cur.items.push(it); last = it.date;
      if (it.kind === '신고서' && !cur.closed) { cur.closed = true; cur.closeMail = mailKey(it); }
    });
    // 자동 회차의 이름은 한 사업장 안에서 겹치지 않게 — 같은 달에 신고서 뒤 새 회차가 열려도 따로 둔다 (r202601, r202601b …)
    var byKey = {};
    auto.forEach(function (r) {
      var base = ym(r.items[0].date), key = base, n = 0;
      while (byKey[key]) { n++; key = base + String.fromCharCode(97 + n); }
      byKey[key] = { roundKey: key, items: r.items };
    });
    if (undated.length) { byKey[UNDATED] = { roundKey: UNDATED, items: undated }; }
    // 사람이 고른 회차가 자동 셈을 이긴다 — 이미 있는 이름(접미 포함)에는 합친다
    s.filter(function (it) { return it.round; }).forEach(function (it) {
      byKey[it.round] = byKey[it.round] || { roundKey: it.round, items: [] }; byKey[it.round].items.push(it); });
    function first(r) { return r.items[0].date || Infinity; }
    return Object.keys(byKey).map(function (k) {
      byKey[k].items.sort(function (a, b) { return a.date - b.date || (a.id < b.id ? -1 : 1); }); return byKey[k];
    }).sort(function (a, b) { var x = first(a), y = first(b); return x === y ? 0 : (x < y ? -1 : 1); });
  }
  function versionsOf(round) {
    var rules = round.items.filter(function (it) { return it.kind === '규칙본문' && it.status === '담김'; });
    var out = [], n = 0;
    rules.forEach(function (it, i) {
      if (i === 0 && it.dir === '받음') out.push({ item: it, no: 0 });
      else out.push({ item: it, no: ++n });
    });
    return out;
  }
  var R_REPORT = '신고서 메일 바로 앞 판', R_NAME = '파일 이름에 「최종·신고용」', R_AGREE = '동의서와 같은 메일';
  function finalCandOf(round) {
    var out = {};
    function add(id, why) { (out[id] = out[id] || []).indexOf(why) < 0 && out[id].push(why); }
    var vs = versionsOf(round).map(function (v) { return v.item; });
    var report = round.items.filter(function (it) { return it.kind === '신고서'; })[0];
    if (report) {
      var before = vs.filter(function (it) { return it.date <= report.date; }).pop();
      if (before) add(before.id, R_REPORT);
    }
    vs.forEach(function (it) { if (/최종|신고용/.test(it.name)) add(it.id, R_NAME); });
    // 「동의서와 같은 메일」 — 날짜가 가깝다는 것이 아니라 같은 메일 한 통이어야 한다
    var agreeMails = round.items.filter(function (it) { return it.kind === '동의서'; }).map(mailKey);
    vs.forEach(function (it) {
      if (agreeMails.indexOf(mailKey(it)) >= 0) add(it.id, R_AGREE);
    });
    return out;
  }
  function companyGroups(items, rounds) {
    var byCo = {};
    items.forEach(function (it) { if (it.companyId) (byCo[it.companyId] = byCo[it.companyId] || []).push(it); });
    var out = [];
    Object.keys(byCo).forEach(function (co) {
      roundsOf(byCo[co]).forEach(function (r) {
        var rid = co + '_' + r.roundKey, rec = (rounds || {})[rid] || {};
        // 최종본은 그 회차 안에 있는 문서일 때만 보인다 — 회차가 바뀌어 밖으로 나간 옛 표시는 무시
        var fin = rec.finalDocId && r.items.some(function (it) { return it.id === rec.finalDocId; }) ? rec.finalDocId : null;
        out.push({ companyId: co, roundKey: r.roundKey, roundId: rid, items: r.items, rows: versionsOf(r),
          cand: finalCandOf(r), finalDocId: fin, finalBy: fin ? rec.finalBy : '', finalAt: fin ? rec.finalAt : 0,
          hasReport: r.items.some(function (it) { return it.kind === '신고서'; }),
          last: r.items[r.items.length - 1].date });
      });
    });
    return out.sort(function (a, b) { return (a.finalDocId ? 1 : 0) - (b.finalDocId ? 1 : 0) || b.last - a.last; });
  }
  var api = { merge: merge, numberOf: numberOf, byMail: byMail, roundsOf: roundsOf, versionsOf: versionsOf,
    finalCandOf: finalCandOf, companyGroups: companyGroups, mailKey: mailKey, R_REPORT: R_REPORT, R_NAME: R_NAME, R_AGREE: R_AGREE };
  if (root) root.PuRulesV2Order = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
