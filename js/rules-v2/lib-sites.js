/* 취업규칙(새) — 「🏢 사업장」 줄 셈 (설계 §7-2 · 2026-10-03 목업 「추천대로」)
   순수 모듈. 사업장 한 곳을 한 줄로 만든다: 확정 문서 수 · 후보 문서 수 · 최종본 표시 · 개정을 시작할 판.
   ⚠ 확정(linked)은 사람이 사업장에 이은 것만, 후보(cand)는 서버가 «이 사업장일 수도» 하고 적어 둔 것 —
     후보는 후보일 뿐이라 회차·판·최종본 셈에는 넣지 않는다 (그건 lib-order 의 확정 자료만).
   ⚠ 업체 원본은 읽기만 한다. 이 모듈은 아무것도 고치거나 쓰지 않는다. */
(function (root) {
  'use strict';
  var O = (root && root.PuRulesV2Order) || (typeof require === 'function' ? require('./lib-order.js') : null);
  function str(v) { return v == null ? '' : String(v); }

  // 직원 수 띠 — 숫자가 아니거나 0 이면 빈 글자(띠 없음)
  function band(n) {
    n = Number(n);
    if (!(n > 0)) return '';
    return n < 5 ? '5인 미만' : n < 10 ? '5~9인' : n < 30 ? '10~29인' : '30인 이상';
  }

  // 검색용 이름 — 소문자, 띄어쓰기·법인 꼬리표·괄호를 걷는다
  function normName(s) {
    return str(s).toLowerCase().replace(/\s+/g, '')
      .replace(/㈜|\(주\)|주식회사|유한회사/g, '')
      .replace(/[()（）]/g, '');
  }

  function kindOk(it) { return it.kind !== '기타'; }
  // 후보 — 아직 어느 사업장에도 안 이은 문서(이미 이었거나 «이을 필요 없음»으로 닫은 것은 제외)
  function isOpenCand(it) {
    var st = it.h && it.h.companyLinkStatus;
    return !it.companyId && st !== 'linked' && st !== 'not_required' && kindOk(it);
  }

  function model(data, companies) {
    data = data || {};
    var items = O.merge(data.docs, data.human);
    var groupsAll = O.companyGroups(items, data.rounds);
    var groupsBy = {}, linkedBy = {}, candBy = {};
    groupsAll.forEach(function (g) { (groupsBy[g.companyId] = groupsBy[g.companyId] || []).push(g); });
    items.forEach(function (it) {
      if (it.companyId) {
        if (kindOk(it)) (linkedBy[it.companyId] = linkedBy[it.companyId] || []).push(it);
        return;
      }
      if (!isOpenCand(it)) return;
      var seen = {};
      ((it.doc && it.doc.companyCand) || []).forEach(function (c) {
        var id = c && c.companyId;
        if (!id || seen[id]) return;
        seen[id] = 1; (candBy[id] = candBy[id] || []).push(it);
      });
    });

    var rows = [];
    (companies || []).forEach(function (co) {
      if (!co || !co.id) return;
      var linked = linkedBy[co.id] || [], cand = candBy[co.id] || [];
      var closed = co.status === 'closed';
      if (closed && !(linked.length + cand.length)) return;
      var mails = {}; cand.forEach(function (it) { mails[O.mailKey(it)] = 1; });
      var last = 0;
      linked.concat(cand).forEach(function (it) { if (it.date > last) last = it.date; });
      var groups = (groupsBy[co.id] || []).slice().sort(function (a, b) { return b.last - a.last; });
      var size = Number(co.employmentInsuredCount) || 0;
      rows.push({ id: co.id, name: str(co.name), bizNo: str(co.bizNo), size: size, band: band(size),
        bizType: str(co.bizType), closed: closed, linked: linked.length, cand: cand.length,
        candIds: cand.map(function (it) { return it.id; }), candMails: Object.keys(mails).length,
        last: last, groups: groups, fin: finOf(linked.length, groups),
        // 담당 — 업체관리의 «사번»(주 managerMain · 부 managerSubs). 이름으로 맞추지 않는다
        mgr: str(co.managerMain).trim(), subs: (Array.isArray(co.managerSubs) ? co.managerSubs : []).map(str).filter(Boolean) });
    });
    return rows.sort(function (a, b) {
      return (b.cand > 0 ? 1 : 0) - (a.cand > 0 ? 1 : 0) || b.last - a.last || a.name.localeCompare(b.name, 'ko');
    });
  }

  // 규칙 본문이 있는 가장 최근 회차 — 최근 회차가 신고서뿐이면 그 앞 회차로 간다
  function latestWithRules(groups) {
    for (var i = 0; i < (groups || []).length; i++) if (groups[i].rows.length > 0) return groups[i];
    return null;
  }
  function finOf(linkedCount, groups) {
    if (!linkedCount) return { state: '', at: 0, docId: '' };
    var g = latestWithRules(groups);
    if (!g || !g.finalDocId) return { state: 'none', at: 0, docId: '' };
    var at = 0;
    g.items.forEach(function (it) { if (it.id === g.finalDocId) at = it.date; });
    return { state: 'set', at: at, docId: g.finalDocId };
  }

  // 개정을 시작할 문서 — 최종본이 있으면 그것, 없으면 마지막 판(notFinal 로 알린다)
  function startDoc(row) {
    var g = latestWithRules(row && row.groups);
    if (!g) return null;
    if (g.finalDocId) return { docId: g.finalDocId, roundKey: g.roundKey, notFinal: false };
    var lastRow = g.rows[g.rows.length - 1];
    return { docId: lastRow.item.id, roundKey: g.roundKey, notFinal: true, no: lastRow.no };
  }

  /* 담당 거르기 (2026-10-05) — who: '' 모두 · '-' 담당 없음 · 사번(주담당이거나 부담당) */
  function ownerOf(r, who) {
    if (!who) return true;
    if (who === '-') return !r.mgr && !(r.subs || []).length;   // 아무도 안 맡은 곳 — 빠지면 아무도 안 본다
    return r.mgr === who || (r.subs || []).indexOf(who) >= 0;   // 부담당도 내 담당이다
  }
  function ownerCounts(rows) {
    var c = {};
    (rows || []).forEach(function (r) {
      var ws = {}; if (r.mgr) ws[r.mgr] = 1; (r.subs || []).forEach(function (s) { ws[s] = 1; });
      var ks = Object.keys(ws);
      if (!ks.length) c['-'] = (c['-'] || 0) + 1;
      ks.forEach(function (k) { c[k] = (c[k] || 0) + 1; });
    });
    return c;
  }
  // 거르개 — 'has'(기본): 확정·후보가 있는 곳 · 'wait': 후보 있는 곳 · 'all' · who: 담당
  function filter(rows, f, q, who) {
    var list = (rows || []).filter(function (r) {
      if (!ownerOf(r, who)) return false;
      return f === 'all' ? true : f === 'wait' ? r.cand > 0 : (r.linked + r.cand) > 0;
    });
    var nq = normName(q), digits = str(q).replace(/\D/g, '');
    if (!nq && digits.length < 3) return list;
    return list.filter(function (r) {
      if (nq && normName(r.name).indexOf(nq) >= 0) return true;
      return digits.length >= 3 && r.bizNo.replace(/\D/g, '').indexOf(digits) >= 0;
    });
  }
  function counts(rows) {
    var c = { has: 0, wait: 0, all: (rows || []).length };
    (rows || []).forEach(function (r) { if (r.linked + r.cand > 0) c.has++; if (r.cand > 0) c.wait++; });
    return c;
  }

  var api = { band: band, model: model, filter: filter, counts: counts, ownerCounts: ownerCounts, startDoc: startDoc, normName: normName };
  if (root) root.PuRulesV2Sites = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
