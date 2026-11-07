/* ══ 견적·계약 기록 저장 층 (견적·계약 자동화 계획 1) ══
   ■ 자리
     RTDB pu_quotes/{qid}      견적·계약 «기록» — 재직 직원이 읽는다(회사·날짜·종류·출처…). 금액 칸은 없다.
     RTDB pu_quote_amt/{qid}   «금액» — 대표·총괄관리자·재무, 그리고 그 건의 확정 담당자(owner)만 읽는다(규칙).
   ■ 지키는 것
     ⓐ 금액은 기록과 다른 자리에 둔다 — 파이어베이스는 부모에서 준 읽기를 아래에서 못 거두므로.
     ⓑ 순서: 기록 먼저, 금액 나중. 금액 쓰기가 실패해도 기록은 남는다(호출한 쪽이 오류를 받는다).
     ⓒ RTDB 에 undefined 를 안 넣는다 — 빈 칸은 아예 뺀다. 칸 길이는 규칙과 같게 미리 자른다.
     ⓓ 금액 전체 읽기가 거절되면(재무·관리자가 아닌 직원) 건마다 읽고 거절은 건너뛴다. */
(function (w) {
  'use strict';

  var Q = 'pu_quotes', A = 'pu_quote_amt';
  var TYPES = [
    { code: 'education', label: '교육·강의' },
    { code: 'investigation', label: '괴롭힘·성희롱 조사' },
    { code: 'safety', label: '산업안전 컨설팅' },
    { code: 'hr_consult', label: '인사노무 컨설팅' },
    { code: 'bargaining', label: '임금·단체교섭' },
    { code: 'fund', label: '근로복지기금' },
    { code: 'opinion', label: '의견서' },
    { code: 'advice', label: '노무자문' },
    { code: 'case', label: '사건 대리' },
    { code: 'other', label: '기타' }
  ];
  /* 위 순서로 처음 맞는 것 — «기타» 는 낱말 없이 마지막 */
  var WORDS = [
    ['education', /교육|강의/],
    ['investigation', /괴롭힘|성희롱/],
    ['safety', /산업안전|중대재해|안전보건/],
    ['hr_consult', /직무분석|규정|진단|인건비|원가|인사노무\s*컨설팅|컨설팅/],
    ['bargaining', /교섭|임금협상/],
    ['fund', /근로복지기금/],
    ['opinion', /의견서/],
    ['advice', /자문/],
    ['case', /위임|대리|사건/]
  ];
  var MAX = { co: 80, coKey: 80, scope: 300, period: 60, ownerGuess: 60, srcKey: 200, fileId: 120, type: 30 };

  var ctx = { db: null, uid: '', name: '' };
  function init(o) {
    o = o || {};
    ctx = { db: o.db || null, uid: o.uid || '', name: o.name || '' };
  }

  function typeOf(text) {
    var s = String(text == null ? '' : text);
    for (var i = 0; i < WORDS.length; i++) if (WORDS[i][1].test(s)) return WORDS[i][0];
    return 'other';
  }
  function isDenied(e) {
    var s = String((e && (e.code || '')) + ' ' + (e && e.message || ''));
    return /permission[_ ]denied/i.test(s);
  }
  function needDb() {
    if (!ctx.db) throw new Error('견적 기록: 저장소(db)가 아직 준비되지 않았습니다');
    return ctx.db;
  }
  function str(r, k, v) {
    if (typeof v !== 'string' || !v) return;
    r[k] = MAX[k] ? v.slice(0, MAX[k]) : v;
  }
  /* 기록 모양 — undefined 는 뺀다. by·at 은 여기서 채운다(호출한 쪽이 못 정한다) */
  function recordOf(rec, now) {
    rec = rec || {};
    var r = {
      doc: rec.doc === 'contract' ? 'contract' : 'quote',
      type: typeof rec.type === 'string' && rec.type ? rec.type.slice(0, MAX.type) : 'other',
      co: String(rec.co == null ? '' : rec.co).slice(0, MAX.co),
      date: String(rec.date == null ? '' : rec.date),
      review: rec.review === 'ok' ? 'ok' : 'check',
      by: ctx.uid, at: now
    };
    var key = rec.co ? w.PuOfficeStore && w.PuOfficeStore.coKey(rec.co) : rec.coKey;
    str(r, 'coKey', key || rec.coKey);
    str(r, 'scope', rec.scope); str(r, 'period', rec.period); str(r, 'fileId', rec.fileId);
    str(r, 'srcKey', rec.srcKey); str(r, 'ownerGuess', rec.ownerGuess);
    if (typeof rec.staff === 'number' && isFinite(rec.staff)) r.staff = rec.staff;
    var s = rec.src || {};
    r.src = { how: s.how === 'mail' || s.how === 'window' ? s.how : 'upload' };
    if (typeof s.slug === 'string' && s.slug) r.src.slug = s.slug.slice(0, 120);
    if (typeof s.key === 'string' && s.key) r.src.key = s.key.slice(0, 200);
    return r;
  }
  function amountOf(amt, now) {
    return {
      amount: Number(amt.amount),
      vat: amt.vat === 'incl' || amt.vat === 'excl' ? amt.vat : '',
      owner: typeof amt.owner === 'string' ? amt.owner.slice(0, 40) : '',
      by: ctx.uid, at: now
    };
  }
  function logIt(kind, o) {
    if (w.PuWorklog && w.PuWorklog.log) return w.PuWorklog.log(kind, o);
    return Promise.resolve();
  }

  function save(rec, amt) {
    try {
      var db = needDb(), now = Date.now();
      var r = recordOf(rec, now);
      var a = null;
      if (amt && amt.amount != null) {
        a = amountOf(amt, now);
        if (!isFinite(a.amount) || a.amount < 0) return Promise.reject(new Error('견적 금액이 올바른 숫자가 아닙니다'));
      }
      var ref = db.ref(Q).push(), qid = ref.key;
      return Promise.resolve(ref.set(r)).then(function () {
        return a ? db.ref(A + '/' + qid).set(a) : null;
      }).then(function () {
        var note = r.type + (a ? ' · 금액 있음' : '');
        return logIt('quote_save', { target: qid, note: note }).then(function () { return qid; });
      });
    } catch (e) { return Promise.reject(e); }
  }

  function list() {
    try {
      return Promise.resolve(needDb().ref(Q).once('value')).then(function (snap) {
        var v = (snap && snap.val()) || {};
        return Object.keys(v).map(function (id) {
          var r = { id: id };
          Object.keys(v[id]).forEach(function (k) { r[k] = v[id][k]; });
          return r;
        }).sort(function (a, b) { return String(b.date || '').localeCompare(String(a.date || '')); });
      });
    } catch (e) { return Promise.reject(e); }
  }

  /* 금액 — 전체 읽기는 대표·총괄·재무만 된다. 거절되면 건마다 읽고, 거절된 건은 빼고 돌려준다. */
  function amounts(ids) {
    try {
      var db = needDb(); ids = ids || [];
      return Promise.resolve(db.ref(A).once('value')).then(function (snap) {
        var v = (snap && snap.val()) || {}, o = {};
        ids.forEach(function (id) { if (v[id] != null) o[id] = v[id]; });
        return o;
      }, function (e) {
        if (!isDenied(e)) throw e;
        var o = {};
        return ids.reduce(function (p, id) {
          return p.then(function () {
            return Promise.resolve(db.ref(A + '/' + id).once('value')).then(function (s) {
              var x = s && s.val();
              if (x != null) o[id] = x;
            }, function (e2) { if (!isDenied(e2)) throw e2; });
          });
        }, Promise.resolve()).then(function () { return o; });
      });
    } catch (e) { return Promise.reject(e); }
  }

  /* 확정 담당자 지정 — 규칙상 isAdmin 만 된다(남이 쓴 금액의 owner 를 바꾸는 것이라서) */
  function confirmOwner(qid, uid) {
    try {
      if (!qid || !uid) return Promise.reject(new Error('견적 번호와 담당자가 필요합니다'));
      return Promise.resolve(needDb().ref(A + '/' + qid + '/owner').set(String(uid).slice(0, 40))).then(function () {
        return logIt('owner_confirm', { target: qid, note: String(uid) });
      });
    } catch (e) { return Promise.reject(e); }
  }

  function findBySrc(srcKey) {
    try {
      if (!srcKey) return Promise.resolve(null);
      return Promise.resolve(needDb().ref(Q).orderByChild('srcKey').equalTo(srcKey).limitToFirst(1).once('value')).then(function (snap) {
        var v = snap && snap.val();
        var ks = v ? Object.keys(v) : [];
        return ks.length ? ks[0] : null;
      });
    } catch (e) { return Promise.reject(e); }
  }

  w.PuQuotes = { TYPES: TYPES, typeOf: typeOf, init: init, save: save, list: list, amounts: amounts, confirmOwner: confirmOwner, findBySrc: findBySrc };
})(typeof window !== 'undefined' ? window : this);
