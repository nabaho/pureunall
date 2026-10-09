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
    // 여러 건은 한 건씩 차례로 — 한 건이 거절되면 거기서 멈추고 «몇 건 했는지» 알린다(일괄 정리 때 사람이 알아야 한다).
    function each(ids, fn, onProgress) {
      var done = 0, total = ids.length;
      return ids.reduce(function (p, id) {
        return p.then(function () {
          return fn(id).then(function () {
            done++;
            if (onProgress) { try { onProgress(done, total); } catch (e) { /* 알림 실패는 무시 */ } }
          });
        });
      }, Promise.resolve()).catch(function (e) {
        throw new Error(done + '/' + total + '건 저장한 뒤 멈춤 — ' + ((e && e.message) || e));
      });
    }
    var S = {
      load: function () {
        return Promise.all([val(LIB + '/docs'), val(LIB + '/human'), val(LIB + '/rounds'), val(LIB + '/run')])
          .then(function (v) { return { docs: v[0] || {}, human: v[1] || {}, rounds: v[2] || {}, run: v[3] || null }; });
      },
      text: function (id) { return val(LIB + '/text/' + id).then(function (t) { return t == null ? '' : String(t); }); },
      // 가린 글 여럿 받기 — docs={id:doc}. 브라우저 칸(cache)에 같은 판(v)이 있으면 받지 않는다.
      // 한 번에 6개씩, 하나가 실패해도 나머지는 계속(실패 id 는 failed 로 알린다).
      texts: function (docs, cache, onProgress) {
        var ids = Object.keys(docs || {}), out = {}, failed = [], next = 0, done = 0, total = ids.length;
        function tick() { done++; if (onProgress) { try { onProgress(done, total); } catch (e) { /* 알림 실패는 무시 */ } } }
        function one(id) {
          var d = docs[id] || {}, v = String(d.updatedAt || d.createdAt || '');
          var look = cache ? cache.get(id).catch(function () { return null; }) : Promise.resolve(null);
          return look.then(function (hit) {
            if (hit && hit.v === v) { out[id] = hit.text; return; }
            return S.text(id).then(function (t) {
              out[id] = t;
              if (cache) return cache.put(id, v, t).catch(function () { /* 칸 실패는 무시 */ });
            });
          }).catch(function () { failed.push(id); }).then(tick);
        }
        function worker() {
          if (next >= total) return Promise.resolve();
          return one(ids[next++]).then(worker);
        }
        var workers = [];
        for (var i = 0; i < Math.min(6, total); i++) workers.push(worker());
        return Promise.all(workers).then(function () { return { texts: out, failed: failed }; });
      },
      linkCompany: function (ids, companyId, onProgress) {
        var chk = root.PuOntology.validateCompanyLink({ companyId: companyId }, o.companies());
        if (!chk.ok) return Promise.reject(new Error(chk.message));
        var at = o.now(), by = o.actor();
        return each(ids, function (id) {
          return saveHuman(id, { companyId: companyId, companyLinkStatus: 'linked', linkedBy: by, linkedAt: at });
        }, onProgress);
      },
      notRequired: function (ids, onProgress) {
        var at = o.now(), by = o.actor();
        return each(ids, function (id) {
          return saveHuman(id, { companyId: null, companyLinkStatus: 'not_required', linkedBy: by, linkedAt: at });
        }, onProgress);
      },
      // 되돌리기(🧹 방금 한 일) — 다시 «미확정». 지우지 않고 칸만 돌린다.
      unlink: function (ids, onProgress) {
        var at = o.now(), by = o.actor();
        return each(ids, function (id) {
          return saveHuman(id, { companyId: null, companyLinkStatus: 'pending', linkedBy: by, linkedAt: at });
        }, onProgress);
      },
      setKind: function (id, kind) { return saveHuman(id, { kindFix: String(kind || '') }); },
      setRound: function (id, roundKey) { return saveHuman(id, { round: String(roundKey || '') }); },
      setFinal: function (companyId, roundKey, docId) {
        var rid = companyId + '_' + roundKey;
        return gw.save(db.ref(LIB + '/rounds/' + rid), function (prev) {
          // 최종본을 정하면 «최종본 없음»은 꺼진다 — 안 그러면 나중에 최종본을 풀 때 회차가 정리 목록에서 사라진다
          var patch = { id: rid, companyId: companyId, roundKey: roundKey,
            finalDocId: docId || null, finalBy: docId ? o.actor() : '', finalAt: docId ? o.now() : 0 };
          if (docId) patch.noFinal = false;
          return Object.assign({}, prev || {}, patch);
        }, { entityType: 'RulesRound' });
      },
      // 「최종본 없음」 — 중간에 멈춘 회차를 정리하기 목록에서 닫는다. 최종본(finalDocId)은 건드리지 않는다.
      setNoFinal: function (companyId, roundKey, on) {
        var rid = companyId + '_' + roundKey;
        return gw.save(db.ref(LIB + '/rounds/' + rid), function (prev) {
          return Object.assign({}, prev || {}, { id: rid, companyId: companyId, roundKey: roundKey, noFinal: on === true });
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
