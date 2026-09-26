/* ══════════════════════════════════════════════════════════════════
   pu-rules-lawwatch.js — 법 개정 감시 셈개 (규정관리 화면이 부른다)

   서버(rulesLawWatch)가 매일 새벽 rules_mgmt/lawwatch/events 에 «법이 바뀌었다» 를 적는다.
   이 파일은 그것을 받아 세 칸으로 좁힌다 —

     ① 법이 바뀌었다      events
     ② 흔들린 검토 기준   criteria(event)       — 연결표(PuRulesLawLink)로 그 조를 콕 집은 규칙
     ③ 다시 볼 사업장     sitesFor(event, …)    — 각 사업장의 «마지막 완료 회차» 에 검토 엔진을
                                                 그 조의 시행일 기준으로 다시 돌린다

   ── 사업장 판정 ──
     엔진이 판정할 수 있는 기준(값비교·존재여부·금지문구) → 엔진 결과를 따른다.
     엔진이 못 하는 기준(수동확인) → 그 회차가 시행일 «이후를 기준일로» 검토됐으면 반영된 것으로 본다
       (검토자가 그 기준일로 이 항목을 봤다). 아니면 「확인 필요」.
   ⚠ 이 파일은 아무 데도 쓰지 않는다. 사업장 원본도 안 고친다 — 「개정안 만들기」 는
     규정관리의 새 회차 길(startNextRevision)로 넘길 뿐이고, 확정은 노무사가 한다.
   ══════════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';
  if (!root || root.PuRulesLawWatch) return;

  var PATH = 'rules_mgmt/lawwatch';
  var FAIL = { '누락': 1, '위반의심': 1, '시행예정': 1 };

  function list(v) { return v && typeof v === 'object' ? Object.keys(v).map(function (k) { return v[k]; }) : []; }
  function artsOf(ev) {
    var num = function (a) { var m = /^(\d+)(?:의(\d+))?$/.exec(a); return m ? (+m[1]) * 100 + (+(m[2] || 0)) : 0; };
    return list(ev && ev.arts).sort(function (x, y) { return num(x.art) - num(y.art); });
  }
  function daysTo(ymd, today) {
    var a = Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10));
    var b = Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10));
    return Math.round((a - b) / 864e5);
  }
  function artLabel(a) { return '제' + String(a).replace(/^(\d+)의(\d+)$/, '$1조의$2').replace(/^(\d+)$/, '$1조'); }

  /* ② 흔들린 검토 기준 — 조마다
     covered   : 이 조의 시행일과 시행일이 같은 기준이 있다 → 이미 반영(「✓ 이미 있음」)
     coveredBy : 같은 조를 가리키지만 위 기준이 맡는다
     update    : 이 조를 맡을 기준이 없다 → 검토 기준을 손봐야 한다 */
  function criteria(ev, rules, K) {
    var byId = {};
    (rules || []).forEach(function (r) { byId[r.id] = r; });
    return artsOf(ev).map(function (a) {
      var ids = K.rulesForArticle(ev.lawKey, a.art, rules);
      var cover = ids.filter(function (id) { return byId[id] && byId[id].effective && byId[id].effective === a.effective; });
      var rs = ids.map(function (id) {
        var r = byId[id] || { id: id, name: '' };
        var st = cover.indexOf(id) >= 0 ? 'covered' : (cover.length ? 'coveredBy' : 'update');
        return { id: id, name: r.name || '', type: r.type || '', effective: r.effective || '', state: st, by: cover[0] || '' };
      });
      return { art: a.art, title: a.title, kind: a.kind, effective: a.effective, effNote: a.effNote || '',
        before: a.before || '', after: a.after || '', beforeUnknown: !!a.beforeUnknown,
        rules: rs, covered: cover.length > 0 };
    });
  }

  /* 사업장마다 «마지막 완료 회차» 하나 — 시행일 최신, 같으면 확정 최신 */
  function latestSites(doneStore) {
    var out = [];
    Object.keys(doneStore || {}).forEach(function (sk) {
      var best = null;
      Object.keys(doneStore[sk] || {}).forEach(function (rv) {
        var r = doneStore[sk][rv];
        if (!r || r._deleted) return;
        var key = String(r.asof || '') + '|' + String(r.doneAt || r.savedAt || '');
        if (!best || key > best.key) best = { key: key, rev: rv, rec: r };
      });
      if (best) out.push({ siteKey: sk, rev: best.rev, rec: best.rec });
    });
    return out;
  }

  /* ③ 다시 볼 사업장
     evalFn(rec, asof, ruleIds) → [{ id, status, found, loc }]  — 규정관리가 자기 엔진으로 넣어 준다.
     돌려주는 줄: { siteKey, rev, site, bizno, ownerUid, ownerName, asof, state, loc, arts, rules, why }
       state: todo(반영 안 됨) · missing(관련 조항 자체 없음) · manual(확인 필요) · done(반영됨)
     기준이 이 사업장에 안 걸리면(규모·조건) 줄을 안 만든다. */
  function sitesFor(ev, sites, evalFn, rules, K) {
    var out = [];
    var arts = artsOf(ev);
    (sites || []).forEach(function (s) {
      var rec = s.rec || {};
      var fails = [], manual = [], anyFound = false, seen = 0, loc = '', hitArts = [];
      arts.forEach(function (a) {
        var ids = K.rulesForArticle(ev.lawKey, a.art, rules);
        if (!ids.length) return;
        var res = [];
        try { res = evalFn(rec, a.effective || ev.effective, ids) || []; } catch (e) { res = []; }
        res.forEach(function (x) {
          seen++;
          if (x.found) anyFound = true;
          if (!loc && x.loc) loc = x.loc;
          if (FAIL[x.status]) { fails.push(x.id); if (hitArts.indexOf(a.art) < 0) hitArts.push(a.art); }
          else if (x.status === '수동확인' && !(String(rec.asof || '') >= String(a.effective || ''))) {
            manual.push(x.id); if (hitArts.indexOf(a.art) < 0) hitArts.push(a.art);
          }
        });
      });
      if (!seen) return;                                    // 이 사업장엔 걸리는 기준이 없다
      var state = fails.length ? (anyFound ? 'todo' : 'missing') : (manual.length ? 'manual' : 'done');
      out.push({
        siteKey: s.siteKey, rev: s.rev, site: rec.site || '', bizno: rec.bizno || '',
        ownerUid: rec.ownerUid || '', ownerName: rec.ownerName || rec.owner || '',
        asof: rec.asof || '', state: state, loc: loc, arts: hitArts,
        rules: fails.concat(manual),
        why: state === 'todo' ? '기준 ' + fails.join('·') + ' 을(를) 못 채움'
           : state === 'missing' ? '관련 조항을 찾지 못함'
           : state === 'manual' ? '마지막 회차 기준일(' + (rec.asof || '—') + ')이 시행일 전 — 직접 확인'
           : '반영됨'
      });
    });
    var ORDER = { todo: 0, missing: 1, manual: 2, done: 3 };
    return out.sort(function (a, b) { return ORDER[a.state] - ORDER[b.state] || String(a.site).localeCompare(String(b.site)); });
  }

  /* 사건 목록 — 가까운 시행일 순. 「지난 것」 = 걸린 사업장이 모두 반영된 사건 */
  function sortEvents(events) {
    return list(events).filter(function (e) { return e && e.id && e.arts; })
      .sort(function (a, b) { return String(a.firstEffective || a.effective).localeCompare(String(b.firstEffective || b.effective)); });
  }
  function counts(rows, uid) {
    var c = { todo: 0, missing: 0, manual: 0, done: 0, open: 0, mine: 0, owners: {} };
    (rows || []).forEach(function (r) {
      c[r.state]++;
      if (r.state !== 'done') {
        c.open++;
        if (r.ownerName || r.ownerUid) c.owners[r.ownerUid || r.ownerName] = 1;
        if (uid && r.ownerUid === uid) c.mine++;
      }
    });
    c.ownerCount = Object.keys(c.owners).length;
    return c;
  }

  /* 서버에서 한 번 받는다 — 작다(사건 몇 건). ⚠ base(기준 판)는 받지 않는다: 화면에 필요 없다. */
  var cache = null;
  function load(db, cb) {
    if (!db) { cb && cb(null); return; }
    var n = 0, got = { events: null, lastRun: null };
    var done = function () { if (++n === 2) { cache = got; cb && cb(got); } };
    db.ref(PATH + '/events').once('value').then(function (s) { got.events = s.val() || {}; done(); }, function () { got.events = {}; done(); });
    db.ref(PATH + '/lastRun').once('value').then(function (s) { got.lastRun = s.val() || null; done(); }, function () { done(); });
  }

  root.PuRulesLawWatch = {
    PATH: PATH, criteria: criteria, latestSites: latestSites, sitesFor: sitesFor,
    sortEvents: sortEvents, counts: counts, artsOf: artsOf, artLabel: artLabel, daysTo: daysTo,
    load: load, _cache: function () { return cache; }, _seed: function (v) { cache = v; return v; }
  };
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));

if (typeof module !== 'undefined' && module.exports) {
  module.exports = (typeof window !== 'undefined' ? window : globalThis).PuRulesLawWatch;
}
