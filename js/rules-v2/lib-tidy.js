/* 취업규칙(새) — 「🧹 정리하기」 셈 (설계 §10-2 · 2026-10-09 목업 「추천대로」)
   순수 모듈. 아무것도 쓰지 않는다 — 사람이 누를 «거리»만 셈한다.
   ① 사업장 잇기: 미확정 서류를 «보낸 주소»로 묶고 후보·근거를 붙인다.
   ② ★최종본 고르기: 최종본이 없는 회차마다 골라 둘 판을 정한다.
   ⚠ 저절로 확정하지 않는다. 이름 단서는 보이기만 — 골라 두지도(pre) 일괄에 넣지도 않는다.
   ⚠ 우리 쪽 주소(회사 메일함·직원 메일)는 묶지 않는다 — 직원이 전달한 메일은 회사가 섞인다. */
(function (root) {
  'use strict';
  var O = (root && root.PuRulesV2Order) || (typeof require === 'function' ? require('./lib-order.js') : null);
  // lib-topics 는 «부를 때» 찾는다 — 화면에서 lib-topics.js 가 이 파일보다 뒤에 실려도 된다
  function TP() { return (root && root.PuRulesV2Topics) || (typeof require === 'function' ? require('./lib-topics.js') : null); }
  // 회사 메일함 — 수집기(functions/rules-collect-pick.js)의 SELF 와 같은 주소
  var SELF = '370-6@daum.net';
  var W_ADDR = '주소 일치', W_LEARN = '앞서 확정', W_DOM = '도메인', W_NAME = '이름 단서';
  var SERVER_WHY = { '주소': W_ADDR, '도메인': W_DOM };
  function str(v) { return v == null ? '' : String(v); }
  function emailOf(s) {
    var t = str(s).trim(), m = /<([^<>]+)>/.exec(t);
    return (m ? m[1] : t).trim().toLowerCase();
  }
  function isOurs(a) { a = emailOf(a); return a === SELF || /@fairrunlabor\.com$/.test(a); }
  function addrOf(doc) {
    var m = (doc && doc.mail) || {};
    var list = doc && doc.dir === '보냄' ? str(m.to).split(/[,;]/) : [str(m.from)];
    for (var i = 0; i < list.length; i++) {
      var a = emailOf(list[i]);
      if (a && a.indexOf('@') > 0 && !isOurs(a)) return a;
    }
    return '';
  }
  function isOpen(it) {
    var st = it.h && it.h.companyLinkStatus;
    return it.kind !== '기타' && !it.companyId && st !== 'linked' && st !== 'not_required';
  }
  function squash(s) { return str(s).replace(/\s+/g, '').toLowerCase(); }

  // 이름 단서 — 핵심 이름(2글자 이상)이 제목·파일 이름에 든 회사. 긴 이름 안에 든 짧은 이름은 버린다. 셋까지.
  function nameHits(hay, cores) {
    var hits = cores.filter(function (c) { return hay.indexOf(c.core) >= 0; });
    hits = hits.filter(function (c) {
      return !hits.some(function (o) { return o.core !== c.core && o.core.indexOf(c.core) >= 0; });
    });
    hits.sort(function (a, b) { return b.core.length - a.core.length; });
    var seen = {}, out = [];
    hits.forEach(function (c) { if (!seen[c.id] && out.length < 3) { seen[c.id] = 1; out.push(c.id); } });
    return out;
  }

  function fill(g, learned, liveId, cores) {
    var mails = {}, last = 0, latest = null, cands = {}, order = [], sigs = {};
    function add(id, why) {
      if (!liveId[id]) return;
      if (!cands[id]) { cands[id] = { companyId: id, whys: [] }; order.push(id); }
      if (cands[id].whys.indexOf(why) < 0) cands[id].whys.push(why);
    }
    var hay = '';
    g.items.forEach(function (it) {
      mails[O.mailKey(it)] = 1;
      if (!latest || it.date > latest.date) latest = it;
      if (it.date > last) last = it.date;
      var sc = ((it.doc && it.doc.companyCand) || []).filter(function (c) { return c && c.companyId && liveId[c.companyId]; });
      sc.forEach(function (c) { add(String(c.companyId), SERVER_WHY[c.why] || W_DOM); });
      var sig = sc.map(function (c) { return String(c.companyId); }).sort().join(',');
      if (sig) sigs[sig] = 1;
      hay += ' ' + squash((it.doc && it.doc.mail && it.doc.mail.subject) || '') + ' ' + squash(it.name);
    });
    if (g.addr && learned[g.addr]) Object.keys(learned[g.addr]).forEach(function (id) { add(id, W_LEARN); });
    var names = nameHits(hay, cores);
    names.forEach(function (id) { add(id, W_NAME); });
    var strong = order.filter(function (id) { var w = cands[id].whys; return w.indexOf(W_ADDR) >= 0 || w.indexOf(W_LEARN) >= 0; });
    var mixed = names.length >= 2 || Object.keys(sigs).length >= 2;
    var pre = !mixed && strong.length === 1 && names.every(function (id) { return id === strong[0]; }) ? strong[0] : '';
    var tier = pre ? (cands[pre].whys.indexOf(W_ADDR) >= 0 ? 1 : 2)
      : order.some(function (id) { return cands[id].whys.some(function (w) { return w !== W_NAME; }); }) ? 3
      : order.length ? 4 : 5;
    var bulkOk = tier === 1 && g.items.every(function (it) {
      return ((it.doc && it.doc.companyCand) || []).some(function (c) { return c && String(c.companyId) === pre && c.why === '주소'; });
    });
    // 후보 차례: 굳은 근거 → 도메인 → 이름 단서
    function rank(id) { var w = cands[id].whys; return w.indexOf(W_ADDR) >= 0 || w.indexOf(W_LEARN) >= 0 ? 0 : w.indexOf(W_DOM) >= 0 ? 1 : 2; }
    g.cands = order.slice().sort(function (a, b) { return rank(a) - rank(b); }).map(function (id) { return cands[id]; });
    g.mails = Object.keys(mails).length; g.last = last;
    g.subject = str(latest && latest.doc && latest.doc.mail && latest.doc.mail.subject);
    g.pre = pre; g.tier = tier; g.mixed = mixed; g.bulkOk = bulkOk;
    return g;
  }

  function groups(data, companies) {
    data = data || {};
    var items = O.merge(data.docs, data.human);
    var live = (companies || []).filter(function (c) { return c && c.id && !c._deleted; });
    var liveId = {}; live.forEach(function (c) { liveId[String(c.id)] = 1; });
    var cores = live.map(function (c) { return { id: String(c.id), core: squash(TP().coCore(c.name)) }; })
      .filter(function (c) { return c.core.length >= 2; });
    // 앞서 확정 — 사람이 이은 서류의 주소 → 회사
    var learned = {};
    items.forEach(function (it) {
      if (!it.companyId) return;
      var a = addrOf(it.doc);
      if (a) (learned[a] = learned[a] || {})[it.companyId] = 1;
    });
    var map = {}, list = [];
    items.filter(isOpen).forEach(function (it) {
      var a = addrOf(it.doc), key = a ? 'a:' + a : 'm:' + O.mailKey(it);
      var g = map[key];
      if (!g) { g = map[key] = { key: key, addr: a, ours: !a, items: [], ids: [] }; list.push(g); }
      g.items.push(it); g.ids.push(it.id);
    });
    list.forEach(function (g) { fill(g, learned, liveId, cores); });
    return list.sort(function (a, b) {
      return a.tier - b.tier || b.items.length - a.items.length || b.last - a.last || (a.key < b.key ? -1 : 1);
    });
  }

  var api = { SELF: SELF, W_ADDR: W_ADDR, W_LEARN: W_LEARN, W_DOM: W_DOM, W_NAME: W_NAME,
    addrOf: addrOf, isOurs: isOurs, isOpen: isOpen, groups: groups };
  if (root) root.PuRulesV2Tidy = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
