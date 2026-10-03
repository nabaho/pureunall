/* 취업규칙(새) — 「모은 자료」 읽기·저장 (설계 §4-6·§4-10-1)
   ⚠ 쓰는 자리는 human·rounds·ask 셋뿐 — 서버 칸(docs·text·seen·run)은 규칙이 막는다.
   ⚠ 저장은 관문(gateway.save)으로만 — revision 트랜잭션, 물리 삭제 없음.
   ⚠ 최종본은 회차 레코드의 finalDocId 한 칸. 「회차에 하나」가 레코드 모양으로 지켜진다.
   ⚠ 「사업장 필요 없음」은 companyId 를 비우고 companyLinkStatus:'not_required' —
     관문은 빈 companyId 를 받는다(companyName 만 있을 때만 막는다). */
(function (root) {
  'use strict';
  var LIB = 'rules_mgmt/library';
  function make(o) {
    var db = o.db, gw = o.gateway;
    function val(p) { return db.ref(p).once('value').then(function (s) { return s.val(); }); }
    function saveHuman(id, patch, ctx) {
      return gw.save(db.ref(LIB + '/human/' + id), function (prev) {
        return Object.assign({}, prev || {}, patch, { id: id });
      }, Object.assign({ entityType: 'RulesDocument', allowPendingCompany: true }, ctx || {}));
    }
    // 여러 건은 한 건씩 차례로 — 한 건이 거절되면 거기서 멈춘다.
    function each(ids, fn) {
      return ids.reduce(function (p, id) { return p.then(function () { return fn(id); }); }, Promise.resolve());
    }
    var S = {
      load: function () {
        return Promise.all([val(LIB + '/docs'), val(LIB + '/human'), val(LIB + '/rounds'), val(LIB + '/run')])
          .then(function (v) { return { docs: v[0] || {}, human: v[1] || {}, rounds: v[2] || {}, run: v[3] || null }; });
      },
      text: function (id) { return val(LIB + '/text/' + id).then(function (t) { return t == null ? '' : String(t); }); },
      linkCompany: function (ids, companyId) {
        var chk = root.PuOntology.validateCompanyLink({ companyId: companyId }, o.companies());
        if (!chk.ok) return Promise.reject(new Error(chk.message));
        var at = o.now(), by = o.actor();
        return each(ids, function (id) {
          return saveHuman(id, { companyId: companyId, companyLinkStatus: 'linked', linkedBy: by, linkedAt: at });
        });
      },
      notRequired: function (ids) {
        var at = o.now(), by = o.actor();
        return each(ids, function (id) {
          return saveHuman(id, { companyId: null, companyLinkStatus: 'not_required', linkedBy: by, linkedAt: at });
        });
      },
      setKind: function (id, kind) { return saveHuman(id, { kindFix: String(kind || '') }); },
      setRound: function (id, roundKey) { return saveHuman(id, { round: String(roundKey || '') }); },
      setFinal: function (companyId, roundKey, docId) {
        var rid = companyId + '_' + roundKey;
        return gw.save(db.ref(LIB + '/rounds/' + rid), function (prev) {
          return Object.assign({}, prev || {}, { id: rid, companyId: companyId, roundKey: roundKey,
            finalDocId: docId || null, finalBy: docId ? o.actor() : '', finalAt: docId ? o.now() : 0 });
        }, { entityType: 'RulesRound' });
      },
      ask: function () {
        var ref = db.ref(LIB + '/ask').push();
        return gw.save(ref, function () { return { id: ref.key, kind: 'rulesCollect', by: o.actor() }; },
          { entityType: 'Task', expectedRevision: -1 });
      }
    };
    return S;
  }
  var api = { make: make, LIB: LIB };
  if (root) root.PuRulesV2Store = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
