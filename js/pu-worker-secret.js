/* 사건·계약 근로자의 주민번호·계좌번호·예금주 — «그 건의 담당자와 대표만» (대표 결정 2026-10-15)
   설계·목업: status/2026-10-15-rrn-owner-only.md

   ■ 왜 따로 두나
     사건(data/cases)·계약(data/contracts)은 «한 덩어리»라 재직 직원 누구나 통째로 읽는다.
     규칙은 덩어리 안의 «칸 하나»만 막지 못한다. 그래서 그 셋을 덩어리에서 떼어
     worker_secret/{표}/{건 id}/{근로자 id} 에 둔다. 보안규칙이 그 자리에서
     「이 건의 주담당·부담당인가, 대표인가」를 서버에서 직접 따진다.

   ■ 화면은 «누가 볼 수 있나»를 따로 흉내 내지 않는다
     읽어 보고, 서버가 거절하면(permission_denied) 🔒 로 보인다. 잣대는 규칙 한 곳이다.

   ■ 공개 덩어리에는 «있다»는 표시만 남는다 — hasRrn·hasAccount (값은 없음)
     담당이 아닌 직원은 그것으로 「🔒 담당자만」/「—」를 가른다.

   ■ 이 PC 사본에도 안 남긴다 — 저장 입구(dbUpsert·dbPatch·dbUpsertMany·dbSet) 맨 앞에서 뗀다.
     창(계약·사건)은 열 때 read() 로 받아 merge() 로 제 상태에만 붙이고, 저장하면 다시 떼어진다.

   ⚠ 「칸이 없다」와 「빈칸이다」는 다르다
     없음 = 모름(이 사람은 못 읽었다) → 손대지 않는다.
     빈칸 = 담당자가 지웠다 → 담당자 칸에서 지우고 표시도 내린다.
     그래서 담당이 아닌 직원이 그 건을 저장해도 주민번호는 그대로 남는다. */
(function (global) {
  'use strict';

  var ROOT = 'worker_secret';
  var FIELDS = ['rrn', 'account', 'holder'];
  /* 표시 칸 — 값 대신 «있다»만. 예금주는 계좌와 한 묶음이라 따로 표시하지 않는다. */
  var FLAG = { rrn: 'hasRrn', account: 'hasAccount' };
  var LIMIT = { rrn: 20, account: 40, holder: 40 };
  /* 표마다 근로자가 사는 자리 — 계약만 company 안에 있다(이관 코드가 그렇게 옮긴다) */
  var WORKER_PATH = {
    cases: ['workers'],
    contracts: ['company', 'workers'],
    consultings: ['workers'],
    funds: ['workers'],
    other_projects: ['workers']
  };

  function isKind(k) { return Object.prototype.hasOwnProperty.call(WORKER_PATH, k); }
  function newWid() { return 'w-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  function workersOf(kind, rec) {
    var p = WORKER_PATH[kind], o = rec;
    for (var i = 0; o && i < p.length; i++) o = o[p[i]];
    return Array.isArray(o) ? o : (o && typeof o === 'object' ? Object.keys(o).map(function (k) { return o[k]; }) : null);
  }

  /* 근로자 배열 하나에서 셋을 뗀다. 바뀐 배열과 {wid:{칸:값}} 을 돌려준다. */
  function splitWorkers(list) {
    var secrets = {}, any = false;
    var out = (list || []).map(function (w) {
      if (!w || typeof w !== 'object') return w;
      var has = FIELDS.some(function (f) { return Object.prototype.hasOwnProperty.call(w, f); });
      if (!has) return w;
      var c = Object.assign({}, w);
      if (!c.id) c.id = newWid();          /* 열쇠 없는 근로자는 담당자 칸에 둘 자리가 없다 */
      var s = {}, n = 0;
      FIELDS.forEach(function (f) {
        if (!Object.prototype.hasOwnProperty.call(c, f)) return;
        var v = c[f] == null ? '' : String(c[f]).trim();
        /* 빈칸은 «있던 것을 지웠다»일 때만 지우기로 보낸다. 새 줄의 빈칸(표시가 안 켜짐)은 보낼 것이 없다 —
           보내면 담당이 아닌 직원이 근로자를 «추가»만 해도 담당자 칸 쓰기가 거절되어 알림이 뜬다. */
        var flag = FLAG[f] || (f === 'holder' ? 'hasAccount' : '');
        if (v || (flag && w[flag] === true)) { s[f] = v; n++; }
        if (FLAG[f]) c[FLAG[f]] = !!v;
        delete c[f];
      });
      if (n) secrets[c.id] = s;
      any = true;
      return c;
    });
    return { workers: out, secrets: secrets, any: any };
  }

  /* 한 건 통째 — dbUpsert·dbSet 용 */
  function split(kind, rec) {
    if (!isKind(kind) || !rec || typeof rec !== 'object') return { record: rec, secrets: {}, any: false };
    var list = workersOf(kind, rec);
    if (!list) return { record: rec, secrets: {}, any: false };
    var r = splitWorkers(list);
    if (!r.any) return { record: rec, secrets: {}, any: false };
    var copy = Object.assign({}, rec), p = WORKER_PATH[kind];
    if (p.length === 1) copy[p[0]] = r.workers;
    else copy[p[0]] = Object.assign({}, copy[p[0]] || {}, (function () { var o = {}; o[p[1]] = r.workers; return o; })());
    return { record: copy, secrets: r.secrets, any: true };
  }

  /* 칸 몇 개만 — dbPatch 용. fields 안의 workers(또는 company.workers)만 본다 */
  function splitPatch(kind, fields) {
    if (!isKind(kind) || !fields || typeof fields !== 'object') return { fields: fields, secrets: {}, any: false };
    var p = WORKER_PATH[kind];
    var holder = p.length === 1 ? fields : fields[p[0]];
    if (!holder || typeof holder !== 'object' || !Array.isArray(holder[p[p.length - 1]])) return { fields: fields, secrets: {}, any: false };
    var r = splitWorkers(holder[p[p.length - 1]]);
    if (!r.any) return { fields: fields, secrets: {}, any: false };
    var f2 = Object.assign({}, fields);
    if (p.length === 1) f2[p[0]] = r.workers;
    else { f2[p[0]] = Object.assign({}, holder); f2[p[0]][p[1]] = r.workers; }
    return { fields: f2, secrets: r.secrets, any: true };
  }

  /* 담당자 칸 값 → 창 상태에 붙인다(저장하면 다시 떼어진다). 원본은 안 바꾼다. */
  /* ⚠ 창 상태 «전체»를 복제하지 않는다 — 근로자 자리만 얕게 새로 만든다(날짜·함수 등이 섞여 있어도 안전) */
  function merge(kind, rec, map) {
    if (!isKind(kind) || !rec || !map) return rec;
    var p = WORKER_PATH[kind], list = workersOf(kind, rec);
    if (!list) return rec;
    var touched = false;
    var next = list.map(function (w) {
      if (!w || !w.id || !map[w.id]) return w;
      var c = null;
      FIELDS.forEach(function (f) {
        if (map[w.id][f] != null && w[f] == null) { c = c || Object.assign({}, w); c[f] = map[w.id][f]; }
      });
      if (c) touched = true;
      return c || w;
    });
    if (!touched) return rec;
    var copy = Object.assign({}, rec);
    if (p.length === 1) copy[p[0]] = next;
    else { copy[p[0]] = Object.assign({}, rec[p[0]]); copy[p[0]][p[1]] = next; }
    return copy;
  }

  /* {wid:{칸:값}} → 실시간DB update 경로들. 빈칸은 지우기(null). 칸 길이를 넘으면 자른다(규칙과 같은 한도). */
  function updatePaths(kind, recId, secrets) {
    var out = {};
    Object.keys(secrets || {}).forEach(function (wid) {
      var s = secrets[wid] || {};
      FIELDS.forEach(function (f) {
        if (!Object.prototype.hasOwnProperty.call(s, f)) return;
        var v = String(s[f] == null ? '' : s[f]).trim().slice(0, LIMIT[f]);
        out[ROOT + '/' + kind + '/' + recId + '/' + wid + '/' + f] = v ? v : null;
      });
    });
    return out;
  }

  /* ── 서버 ───────────────────────────────────────────────────────── */
  var cache = {};          /* 표/건 → {at, map} — 한 창을 여닫을 때 되풀이 읽지 않게 */
  var CACHE_MS = 60 * 1000;

  function denied(e) { return !!(e && /permission|denied/i.test(String(e.code || e.message || e))); }

  /* 읽기 — {ok:true,map} | {ok:false,denied:true} | {ok:false,error} */
  function read(db, kind, recId) {
    if (!db || !isKind(kind) || !recId) return Promise.resolve({ ok: false, error: '인자' });
    var key = kind + '/' + recId, hit = cache[key];
    if (hit && (Date.now() - hit.at) < CACHE_MS) return Promise.resolve({ ok: true, map: hit.map });
    return db.ref(ROOT + '/' + key).once('value').then(function (snap) {
      var map = (snap && snap.val()) || {};
      cache[key] = { at: Date.now(), map: map };
      return { ok: true, map: map };
    }, function (e) {
      return denied(e) ? { ok: false, denied: true } : { ok: false, error: String((e && e.message) || e) };
    });
  }

  /* 쓰기 — 건(record)이 서버에 먼저 있어야 규칙이 담당자를 안다. 새 건이면 아직 안 닿았을 수 있어
     거절되면 두 번(1.5초·4초 뒤) 다시 해 본다. 그래도 안 되면 {ok:false} — 부르는 쪽이 알린다. */
  function write(db, kind, recId, secrets, opts) {
    var paths = updatePaths(kind, recId, secrets);
    if (!db || !Object.keys(paths).length) return Promise.resolve({ ok: true, n: 0 });
    var waits = (opts && opts.waits) || [1500, 4000];
    var key = kind + '/' + recId;
    function go(i) {
      return db.ref().update(paths).then(function () {
        delete cache[key];
        return { ok: true, n: Object.keys(paths).length };
      }, function (e) {
        if (denied(e) && i < waits.length) {
          return new Promise(function (r) { setTimeout(r, waits[i]); }).then(function () { return go(i + 1); });
        }
        return { ok: false, denied: denied(e), error: String((e && e.message) || e) };
      });
    }
    return go(0);
  }

  /* 이관·불러오기 — 출발 건의 담당자 칸을 도착 건으로. 출발을 못 읽으면 {ok:false,denied:true}
     (조용히 빠뜨리지 않는다 — 부르는 쪽이 「담당자가 옮겨야 합니다」라고 알린다). wids 를 주면 그 사람만. */
  function carry(db, srcKind, srcId, dstKind, dstId, wids) {
    return read(db, srcKind, srcId).then(function (r) {
      if (!r.ok) return r;
      var pick = {};
      Object.keys(r.map || {}).forEach(function (wid) {
        if (wids && wids.indexOf(wid) < 0) return;
        pick[wid] = r.map[wid];
      });
      if (!Object.keys(pick).length) return { ok: true, n: 0 };
      return write(db, dstKind, dstId, pick);
    });
  }

  /* 화면 글자 — 앞 7자리만(900101-1●●●●●●) */
  function maskRrn(v) {
    var d = String(v || '').replace(/\D/g, '');
    if (d.length < 7) return d ? '●●●●●●' : '';
    return d.slice(0, 6) + '-' + d.charAt(6) + '●●●●●●';
  }

  var api = {
    ROOT: ROOT, FIELDS: FIELDS, FLAG: FLAG, WORKER_PATH: WORKER_PATH,
    isKind: isKind, workersOf: workersOf, split: split, splitPatch: splitPatch, merge: merge,
    updatePaths: updatePaths, read: read, write: write, carry: carry, maskRrn: maskRrn,
    _cache: cache
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.PuWorkerSecret = api;
})(typeof window !== 'undefined' ? window : globalThis);
