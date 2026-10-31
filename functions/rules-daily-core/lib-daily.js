/* 취업규칙 — 「🤖 매일 정리」 셈 (설계 §14 · 2026-10-31 목업 세 물음 「추천대로」)
   순수 모듈. 화면(rules-v2)과 서버(functions/rules-daily.js)가 «같은 판정»을 쓴다 —
   서버 사본(functions/rules-daily-core/)은 scripts/sync-rules-daily-core.js 가 «글자 그대로» 만든다. 손으로 고치지 않는다.

     plan     — 저절로 확정할 서류. 🧹 정리하기(lib-tidy)의 묶음 셈을 «그대로» 딛는다.
                (가) 단계 1·일괄 가능 — 묶음의 모든 서류가 업체관리에 등록된 주소로 그 한 회사를 가리킨다
                (나) 단계 2(앞서 확정) — 단, «사람이» 확정한 서류의 주소일 때만(자동 확정이 다시 근거가 되어 번지지 않게)
     ownerOf  — 처리 담당: 서버가 적은 메일함 담당(doc.owner) → 없으면 확정된 사업장의 업체 주담당 → 없으면 못 정함
     summary  — 하루 기록 한 줄(새 메일·담은 서류·자동 확정·확인 필요·담당별 수)

   ⚠ 저절로 확정하지 «않는» 것: 도메인·이름 단서뿐인 묶음 · 섞인 묶음 · 우리 쪽 주소 · 끝난 업체 ·
     사람이 손댄 서류(잇기·풀기·사업장 없음) · 되돌린 주소(noAuto) · 갈래 「기타」(lib-tidy isOpen 이 뺀다).
   ⚠ ★최종본은 여기서 다루지 않는다 — 사람이 고른다. */
(function (root) {
  'use strict';

  /* 다른 부품은 «쓸 때» 찾는다 — 싣는 차례에 기대지 않게. 서버 사본 폴더에서는 옆 파일을 require 로 찾는다 */
  function TD() { return (root && root.PuRulesV2Tidy) || (typeof require === 'function' ? require('./lib-tidy.js') : null); }
  function O() { return (root && root.PuRulesV2Order) || (typeof require === 'function' ? require('./lib-order.js') : null); }

  var AUTO_BY = '자동';
  var MAX = 100;
  var MODES = ['off', 'dry', 'live'];
  var KST = 9 * 3600e3;

  function str(v) { return v == null ? '' : String(v); }
  function dayKey(ms) { return new Date(Number(ms || 0) + KST).toISOString().slice(0, 10); }
  function modeOf(cfg) { var m = cfg && cfg.mode; return MODES.indexOf(m) >= 0 ? m : 'dry'; }   // 정하지 않았으면 시범
  /* 끝난 업체 — 메일함(mail-owner coLeft)과 같은 잣대 */
  function left(co) {
    var s = str(co && co.status);
    return !co || co._deleted === true || s === 'inactive' || s === 'terminated' || s === 'closed';
  }
  /* 사람이 손댔나 — 잇기·풀기·「사업장 없음」 어느 것이든 사람 이름(linkedBy)이 남는다. 되돌린 표시(noAuto)도 사람 손이다 */
  function touched(h) { return !!(h && ((h.linkedBy && h.linkedBy !== AUTO_BY) || h.noAuto)); }
  function byHuman(h) { return !!(h && h.companyLinkStatus === 'linked' && h.companyId && h.linkedBy && h.linkedBy !== AUTO_BY); }

  /* data = {docs, human}, companies = 업체 배열. 돌려주는 것 { link:[{docId, companyId, why}], skip:{…}, more } */
  function plan(data, companies, opts) {
    opts = opts || {};
    var max = Number(opts.max) > 0 ? Number(opts.max) : MAX;
    data = data || {};
    var docs = data.docs || {}, human = data.human || {};
    var T = TD();
    var byId = {};
    (companies || []).forEach(function (c) { if (c && c.id != null) byId[str(c.id)] = c; });
    // 사람이 확정한 주소 → 회사 / 되돌린 주소
    var humanAddr = {}, noAddr = {};
    Object.keys(human).forEach(function (id) {
      var h = human[id], a = T.addrOf(docs[id]);
      if (!a) return;
      if (h && h.noAuto) noAddr[a] = 1;
      if (byHuman(h)) (humanAddr[a] = humanAddr[a] || {})[str(h.companyId)] = 1;
    });
    var link = [], skip = { weak: 0, undone: 0, left: 0, touched: 0 };
    T.groups({ docs: docs, human: human }, companies).forEach(function (g) {
      var n = g.ids.length;
      var ok = !!g.pre && !!g.addr && ((g.tier === 1 && g.bulkOk) || (g.tier === 2 && !!(humanAddr[g.addr] || {})[g.pre]));
      if (!ok) { skip.weak += n; return; }
      if (noAddr[g.addr]) { skip.undone += n; return; }
      if (left(byId[g.pre])) { skip.left += n; return; }
      var why = g.tier === 1 ? T.W_ADDR : T.W_LEARN;
      g.items.forEach(function (it) {
        if (touched(it.h)) { skip.touched++; return; }
        link.push({ docId: it.id, companyId: str(g.pre), why: why, date: it.date });
      });
    });
    // 최근 것부터 — 한도에 걸려도 오늘 들어온 것이 먼저 정리된다
    link.sort(function (a, b) { return b.date - a.date || (a.docId < b.docId ? -1 : 1); });
    var more = Math.max(0, link.length - max);
    return { link: link.slice(0, max).map(function (x) { return { docId: x.docId, companyId: x.companyId, why: x.why }; }), skip: skip, more: more };
  }

  /* 처리 담당 — nameOf(사번) 는 부르는 쪽 명부(사번 꼴 맞추기는 그쪽 몫) */
  function ownerOf(doc, h, coById, nameOf) {
    var o = doc && doc.owner;
    if (o && str(o.who).trim()) return { who: str(o.who).trim(), sid: str(o.sid), why: 'mail', src: str(o.why) };
    var cid = h && h.companyLinkStatus === 'linked' && h.companyId ? str(h.companyId) : '';
    var co = cid && coById ? coById[cid] : null;
    var sid = co ? str(co.managerMain).trim() : '';
    if (sid) return { who: (nameOf && nameOf(sid)) || sid, sid: sid, why: 'co', src: '' };
    return { who: '', sid: '', why: '', src: '' };
  }

  /* 하루 기록 — 오늘(서울) 담은 서류 기준. linked = 오늘 자동으로 확정된 수(사람 칸), would = 시범에서 «확정했을 것» 수,
     need = 지금 사람이 봐야 할 미확정(자동 대상 아닌 것) 수. 메일 주소·제목은 안 담는다. */
  function summary(data, companies, o) {
    o = o || {};
    data = data || {};
    var docs = data.docs || {}, human = data.human || {};
    var now = Number(o.now || 0), day = dayKey(now), mode = o.mode || 'dry';
    var p = o.plan || { link: [], skip: {}, more: 0 };
    var planned = {};
    (p.link || []).forEach(function (x) { planned[x.docId] = 1; });
    var coById = {};
    (companies || []).forEach(function (c) { if (c && c.id != null) coById[str(c.id)] = c; });
    var items = O().merge(docs, human);
    var mails = {}, nDocs = 0, linked = 0, noOwner = 0, byOwner = {}, need = 0;
    items.forEach(function (it) {
      var h = it.h || {};
      if (TD().isOpen(it) && !planned[it.id]) need++;
      if (h.linkedBy === AUTO_BY && h.companyLinkStatus === 'linked' && dayKey(h.linkedAt) === day) linked++;
      if (dayKey(it.doc.createdAt) !== day) return;
      nDocs++;
      mails[O().mailKey(it)] = 1;
      if (it.kind === '기타') return;
      // 담당 이름이 기록의 열쇠가 된다 — 파이어베이스 열쇠에 못 쓰는 글자(. # $ [ ] /)는 _ 로
      var w = ownerOf(it.doc, h, coById, o.nameOf).who.replace(/[.#$\[\]\/]/g, '_');
      if (!w) noOwner++; else byOwner[w] = (byOwner[w] || 0) + 1;
    });
    return { date: day, at: now, mode: mode, mails: Object.keys(mails).length, docs: nDocs, linked: linked,
      would: mode === 'live' ? 0 : (p.link || []).length + (p.more || 0), need: need, noOwner: noOwner, byOwner: byOwner };
  }

  var api = { AUTO_BY: AUTO_BY, MAX: MAX, MODES: MODES, dayKey: dayKey, modeOf: modeOf, left: left, touched: touched,
    plan: plan, ownerOf: ownerOf, summary: summary };
  if (root) root.PuRulesDaily = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
