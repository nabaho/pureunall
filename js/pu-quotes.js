/* ══ 견적·계약 기록 저장 층 (견적·계약 자동화 계획 1) ══
   ■ 자리
     RTDB pu_quotes/{qid}      견적·계약 «기록» — 재직 직원이 읽는다(회사·날짜·종류·출처…). 금액 칸은 없다.
     RTDB pu_quote_amt/{qid}   «금액·담당» — 대표·총괄관리자·재무, 그리고 그 건의 확정 담당자(owner)만 읽는다(규칙).
   ■ 지키는 것
     ⓐ 금액은 기록과 다른 자리에 둔다 — 파이어베이스는 부모에서 준 읽기를 아래에서 못 거두므로.
     ⓑ 순서: 기록 먼저, 금액 나중. 금액 칸은 «그 기록을 만든 사람»만 처음 만들 수 있다(규칙) — 기록이 먼저 있어야 한다.
        금액 쓰기가 실패해도 기록은 남는다(호출한 쪽이 오류를 받는다).
     ⓒ RTDB 에 undefined 를 안 넣는다 — 빈 칸은 아예 뺀다. 칸 길이는 규칙과 같게 미리 자른다.
     ⓓ 금액 전체 읽기가 거절되면(재무·관리자가 아닌 직원) 건마다 읽고 거절은 건너뛴다.
     ⓔ 온톨로지 원칙 — 기록은 id(열쇠와 같다)·entityType('Document')·createdAt·updatedAt 을 갖는다.
     ⓕ 담당 확정은 총괄관리자만(규칙). 여러 건이면 «한 번에» 쓴다(하나라도 거절되면 아무것도 안 바뀐다). */
(function (w) {
  'use strict';

  var Q = 'pu_quotes', A = 'pu_quote_amt';
  var TYPES = [
    { code: 'education', label: '교육·강의' },
    { code: 'investigation', label: '괴롭힘·성희롱 조사' },
    { code: 'safety', label: '산업안전 컨설팅' },
    { code: 'hr_consult', label: '인사노무 컨설팅' },
    { code: 'bargaining', label: '노사관계·단체교섭' },
    { code: 'fund', label: '근로복지기금' },
    { code: 'opinion', label: '의견서' },
    { code: 'advice', label: '노무자문' },
    { code: 'case', label: '사건 대리' },
    { code: 'other', label: '기타' }
  ];
  /* 위 순서로 처음 맞는 것 — «기타» 는 낱말 없이 마지막 */
  var WORDS = [
    ['education', /교육|강의|특강/],
    ['investigation', /괴롭힘|성희롱|진상\s*조사|사안\s*조사/],
    ['safety', /산업\s*안전|중대\s*재해|안전\s*보건|위험성\s*평가/],
    ['hr_consult', /직무\s*분석|취업\s*규칙|인사\s*규정|규정|진단|실태\s*조사|불법\s*파견|하도급|인건비|원가|인사\s*노무\s*컨설팅|컨설팅/],
    ['bargaining', /교섭|임금\s*협상|단체\s*협약|노사\s*관계|노사\s*협의회|노동\s*조합|노조/],
    ['fund', /근로\s*복지\s*기금|복지\s*기금|기금\s*설립|사내\s*기금|공동\s*기금/],
    ['opinion', /의견서|법률\s*검토/],
    ['advice', /자문|급여\s*관리|급여\s*위임|아웃소싱|사무\s*위탁/],
    ['case', /위임|대리|사건|구제\s*신청|체당금|대지급금/]
  ];
  var MAX = { co: 80, coKey: 80, scope: 300, period: 60, ownerGuess: 60, srcKey: 200, fileId: 120, type: 30 };
  var KST_MS = 9 * 3600 * 1000;

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
  function pad(n) { return ('0' + n).slice(-2); }
  /* 날짜 → 'YYYY-MM-DD' (규칙이 이 모양만 받는다). 숫자(ms)는 한국 시간으로 읽는다. 못 읽으면 '' */
  function dateOf(v) {
    if (typeof v === 'number' && isFinite(v) && v > 0) {
      var d = new Date(v + KST_MS);
      return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
    }
    var m = /^\s*(\d{4})[-.\/년]\s*(\d{1,2})[-.\/월]\s*(\d{1,2})/.exec(String(v == null ? '' : v));
    if (!m) return '';
    var mo = +m[2], da = +m[3];
    if (mo < 1 || mo > 12 || da < 1 || da > 31) return '';
    return m[1] + '-' + pad(mo) + '-' + pad(da);
  }
  function str(r, k, v) {
    if (typeof v !== 'string' || !v) return;
    r[k] = MAX[k] ? v.slice(0, MAX[k]) : v;
  }
  /* 기록 모양 — undefined 는 뺀다. id·by·createdAt·updatedAt 은 여기서 채운다(호출한 쪽이 못 정한다) */
  function recordOf(rec, now, qid) {
    rec = rec || {};
    var r = {
      id: qid, entityType: 'Document',
      doc: rec.doc === 'contract' ? 'contract' : 'quote',
      type: typeof rec.type === 'string' && rec.type ? rec.type.slice(0, MAX.type) : 'other',
      co: String(rec.co == null ? '' : rec.co).slice(0, MAX.co),
      date: dateOf(rec.date),
      review: rec.review === 'ok' ? 'ok' : 'check',
      by: ctx.uid, createdAt: now, updatedAt: now
    };
    var key = rec.co ? w.PuOfficeStore && w.PuOfficeStore.coKey(rec.co) : rec.coKey;
    str(r, 'coKey', key || rec.coKey);
    str(r, 'scope', rec.scope); str(r, 'period', rec.period); str(r, 'fileId', rec.fileId);
    str(r, 'srcKey', rec.srcKey); str(r, 'ownerGuess', rec.ownerGuess);
    if (typeof rec.staff === 'number' && isFinite(rec.staff) && rec.staff >= 0) r.staff = Math.round(rec.staff);
    var s = rec.src || {};
    r.src = { how: s.how === 'mail' || s.how === 'window' ? s.how : 'upload' };
    if (typeof s.slug === 'string' && s.slug) r.src.slug = s.slug.slice(0, 120);
    if (typeof s.key === 'string' && s.key) r.src.key = s.key.slice(0, 200);
    return r;
  }
  /* 금액 칸 — 금액을 못 읽었으면 amount 를 뺀다(담당만 있는 칸도 된다) */
  function amountOf(amt, now) {
    var a = {
      vat: amt.vat === 'incl' || amt.vat === 'excl' ? amt.vat : '',
      owner: typeof amt.owner === 'string' ? amt.owner.slice(0, 40) : '',
      by: ctx.uid, at: now
    };
    if (amt.amount != null && amt.amount !== '') a.amount = Number(amt.amount);
    return a;
  }
  function logIt(kind, o) {
    if (w.PuWorklog && w.PuWorklog.log) return w.PuWorklog.log(kind, o);
    return Promise.resolve();
  }

  function save(rec, amt) {
    try {
      var db = needDb(), now = Date.now();
      var ref = db.ref(Q).push(), qid = ref.key;
      var r = recordOf(rec, now, qid);
      if (!r.date) return Promise.reject(new Error('견적 날짜를 알 수 없습니다 — 「YYYY-MM-DD」 모양으로 넣어 주세요'));
      var a = null;
      if (amt && (amt.amount != null && amt.amount !== '' || amt.owner)) {
        a = amountOf(amt, now);
        if ('amount' in a && (!isFinite(a.amount) || a.amount < 0)) return Promise.reject(new Error('견적 금액이 올바른 숫자가 아닙니다'));
      }
      return Promise.resolve(ref.set(r)).then(function () {
        return a ? db.ref(A + '/' + qid).set(a) : null;
      }).then(function () {
        var note = r.type + (a && 'amount' in a ? ' · 금액 있음' : '');
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
          r.id = id;   /* 열쇠가 정본 — 칸에 다른 값이 있어도 열쇠를 쓴다 */
          return r;
        }).sort(function (a, b) {
          return String(b.date || '').localeCompare(String(a.date || '')) || ((b.createdAt || 0) - (a.createdAt || 0));
        });
      });
    } catch (e) { return Promise.reject(e); }
  }

  /* 금액 — 전체 읽기는 대표·총괄·재무만 된다. 거절되면 건마다(한꺼번에) 읽고, 거절된 건은 빼고 돌려준다. */
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
        return Promise.all(ids.map(function (id) {
          return Promise.resolve(db.ref(A + '/' + id).once('value')).then(function (s) {
            var x = s && s.val();
            if (x != null) o[id] = x;
          }, function (e2) { if (!isDenied(e2)) throw e2; });
        })).then(function () { return o; });
      });
    } catch (e) { return Promise.reject(e); }
  }

  /* 확정 담당자 지정 — 규칙상 isAdmin 만 된다(남이 쓴 금액의 owner 를 바꾸는 것이라서).
     ■ 여러 건을 «한 번에» 쓴다 — 금액 칸이 있으면 owner 만, 없으면 담당만 있는 칸을 새로 만든다.
     ■ 작업 기록에는 uid 가 아니라 «이름»을 적는다(화면에 아이디를 안 보인다 — 대표 결정 2026-10-25). */
  function confirmOwners(qids, uid, name) {
    try {
      qids = (qids || []).filter(function (q) { return typeof q === 'string' && q; });
      if (!qids.length || !uid) return Promise.reject(new Error('견적 번호와 담당자가 필요합니다'));
      var db = needDb(), owner = String(uid).slice(0, 40), now = Date.now();
      return amounts(qids).then(function (have) {
        var up = {};
        qids.forEach(function (q) {
          if (have[q]) up[A + '/' + q + '/owner'] = owner;
          else up[A + '/' + q] = { vat: '', owner: owner, by: ctx.uid, at: now };
        });
        return db.ref().update(up);
      }).then(function () {
        return logIt('owner_confirm', { target: qids.join(','), note: (name || '이름 없음') + (qids.length > 1 ? ' · ' + qids.length + '건' : '') });
      });
    } catch (e) { return Promise.reject(e); }
  }
  function confirmOwner(qid, uid, name) { return confirmOwners([qid], uid, name); }

  /* 기존 견적·계약 기록 수정 — createdAt·id·entityType·by 를 보존하고, 금액 칸도 함께 갱신(권한 범위 내) */
  function update(qid, recPatch, amtPatch) {
    try {
      if (!qid || typeof qid !== 'string') return Promise.reject(new Error('견적 번호가 없습니다'));
      var db = needDb(), now = Date.now();
      recPatch = recPatch || {};
      return Promise.resolve(db.ref(Q + '/' + qid).once('value')).then(function (snap) {
        var cur = snap && snap.val();
        if (!cur) throw new Error('견적 기록을 찾지 못했습니다');
        var merged = Object.assign({}, cur, recPatch);
        var next = recordOf(merged, now, qid);
        next.createdAt = typeof cur.createdAt === 'number' ? cur.createdAt : now;
        next.by = typeof cur.by === 'string' && cur.by ? cur.by : ctx.uid;
        if (!next.date) throw new Error('견적 날짜를 알 수 없습니다 — 「YYYY-MM-DD」 모양으로 넣어 주세요');
        return Promise.resolve(db.ref(Q + '/' + qid).set(next)).then(function () {
          if (!amtPatch) return null;
          return Promise.resolve(db.ref(A + '/' + qid).once('value')).then(function (as) { return as && as.val(); }, function () { return null; })
            .then(function (curAmt) {
              var owner = amtPatch.owner != null ? String(amtPatch.owner).slice(0, 40) : String((curAmt && curAmt.owner) || '').slice(0, 40);
              var vat = amtPatch.vat != null ? amtPatch.vat : ((curAmt && curAmt.vat) || '');
              var hasAmt = amtPatch.amount !== undefined ? (amtPatch.amount != null && amtPatch.amount !== '') : (curAmt && curAmt.amount != null);
              var rawAmt = amtPatch.amount !== undefined ? amtPatch.amount : (curAmt && curAmt.amount);
              if (!hasAmt && !owner && !curAmt) return null;
              var a = amountOf({ vat: vat, owner: owner, amount: hasAmt ? rawAmt : '' }, now);
              if ('amount' in a && (!isFinite(a.amount) || a.amount < 0)) throw new Error('견적 금액이 올바른 숫자가 아닙니다');
              return db.ref(A + '/' + qid).set(a);
            });
        }).then(function () {
          return logIt('quote_save', { target: qid, note: '수정 · ' + next.type }).then(function () { return qid; });
        });
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

  w.PuQuotes = { TYPES: TYPES, typeOf: typeOf, dateOf: dateOf, init: init, save: save, update: update, list: list, amounts: amounts,
    confirmOwner: confirmOwner, confirmOwners: confirmOwners, findBySrc: findBySrc };
})(typeof window !== 'undefined' ? window : this);
