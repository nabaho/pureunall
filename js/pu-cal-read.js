/* 푸른 캘린더 — 이알피 자료를 «같은 뜻으로» 읽는 문
   ────────────────────────────────────────────────────────────────────────
   푸른 캘린더(pu-cal.html)는 제 자료를 따로 갖지 않는다. 이알피가 쓰는 그 칸을
   그대로 읽는다 — 이알피에서 넣은 연차가 여기 바로 보여야 하고, 그 반대도 같다.

   ⚠ 그런데 그 칸의 «생김새»가 한 가지가 아니다.
     서버에는 `data/{표} = { v: …, u: 시각 }` 으로 들어 있는데, v 가
       ① 배열            (아직 안 옮긴 옛 표)
       ② {번호: 항목}     (칸별 저장으로 옮긴 표)
       ③ {이름: 값}       (사번이 열쇠인 표 · 연도가 열쇠인 표 — 배열로 펴면 안 된다)
     셋 다일 수 있다. 이것을 잘못 펴면 **번호가 영영 사라진다**(2026-09-16 에 실제로 겪었다).

   ★ 그래서 이알피의 해석기와 «글자 하나까지 같은 셈»을 여기 둔다.
     tests/cal-read-same-as-erp.test.js 가 이알피의 것과 이것을 **같은 자료로 나란히
     돌려** 결과가 다르면 걸린다. 한쪽만 고치면 그 자리에서 드러난다.
     ⚠ 이알피 쪽을 고쳤다면 여기도 고친다. 검사가 시키는 대로만 하면 된다.

   ⚠ 이 문은 **읽기만 한다.** 저장은 아직 이알피가 한다(1걸음-나).
     쓰기를 여기 붙일 때는 반드시 마감 자물쇠(PuWork.LOCK_TABLES)를 먼저 지나야 한다 —
     안 그러면 마감한 달의 근태가 캘린더에서 뚫리고 급여가 조용히 틀어진다. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PuCalRead = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  /* 번호가 아예 없는 자국에 «내용으로» 한결같은 번호를 지어 준다.
     ⚠ 이알피와 같은 셈이어야 한다 — 다르면 같은 항목이 두 앱에서 다른 번호를 갖는다. */
  function stableId(x) {
    var s;
    try { s = JSON.stringify(x); } catch (_e) { s = String(x); }
    var h = 0;
    for (var j = 0; j < s.length; j++) { h = ((h << 5) - h + s.charCodeAt(j)) | 0; }
    return 'noid-' + (h >>> 0).toString(36) + '-' + s.length.toString(36);
  }

  /* 서버에서 온 값을 화면이 쓸 꼴로 편다. 이알피 normalizeFbValue 와 같은 셈이다. */
  function normalize(v) {
    var arr;
    if (Array.isArray(v)) { arr = v; }
    else if (v && typeof v === 'object') {
      var ks = Object.keys(v);
      // {0,1,2,…} 자리번호 열쇠 = 배열이 서버에서 객체가 된 것
      var isArrayLike = ks.length === 0 || ks.every(function (k, i) { return k === String(i); });
      // 열쇠가 그 항목의 번호와 같다 = 번호-지도 → 배열로 되돌린다
      var idHits = 0, mapOk = ks.length > 0;
      ks.forEach(function (id) {
        var x = v[id];
        if (x == null) return;
        if (typeof x !== 'object' || Array.isArray(x)) { mapOk = false; return; }
        if ((x.id != null && String(x.id) === id) || (x.code != null && String(x.code) === id)) { idHits++; return; }
        if (x.id == null && x.code == null) return;   // 칸만 든 자국 — 열쇠로 되살린다
        mapOk = false;                                 // 번호가 있는데 열쇠와 다르다 → 이름-열쇠 지도
      });
      var isSelfMap = mapOk && idHits > 0;
      if (!(isArrayLike || isSelfMap)) return v;       // 이름-열쇠 지도는 그대로 둔다
      arr = ks.map(function (id) {
        var x = v[id];
        if (!isArrayLike && x && typeof x === 'object' && !Array.isArray(x) && x.id == null) {
          x = Object.assign({}, x, { id: String(id) });
        }
        return x;
      }).filter(function (x) { return x != null; });
    } else { return v; }

    // 번호 있는 것과 없는 것이 «섞였을 때만» 없는 쪽에 번호를 지어 붙인다
    if (Array.isArray(arr)) {
      var anyId = false, anyNo = false;
      arr.forEach(function (x) { if (x && x.id) anyId = true; else if (x && typeof x === 'object') anyNo = true; });
      if (anyId && anyNo) {
        arr = arr.map(function (x) {
          if (x && typeof x === 'object' && !Array.isArray(x) && !x.id) {
            return Object.assign({}, x, { id: stableId(x) });
          }
          return x;
        });
      }
    }
    // 같은 번호가 두 번 이상이면 첫 것만 (이알피 저장 규칙과 같다)
    var seen = {};
    return arr.filter(function (x) {
      var i = x && x.id;
      if (typeof i !== 'string' || !i) return true;
      if (seen[i]) return false;
      seen[i] = 1; return true;
    });
  }

  /* ── 서버에서 읽기 ───────────────────────────────────────────────────
     ⚠ 큰 표를 value 로 «지켜보지» 않는다 — 한 건만 바뀌어도 목록 전체가
       열린 모든 화면으로 다시 내려온다(요금과 깜빡임의 뿌리, 2026-09-17).
       한 번 받고(once), 그 뒤에는 바뀐 «한 건»만 받는다. */
  var _db = null;
  var _raw = {};           // 표마다 «편기 전» 생김새 — 쓰는 쪽이 이것을 봐야 한다
  function attach(db) { _db = db; return api; }

  /* 편기 «전»의 생김새. 저장 관문이 「이 표가 아직 배열인가」를 여기서 본다 —
     배열인 표에 글자 열쇠를 쓰면 표가 깨지므로, 그때는 쓰지 않고 이알피로 보낸다. */
  function rawForm(key) { return Object.prototype.hasOwnProperty.call(_raw, key) ? _raw[key] : null; }

  function readOnce(key) {
    if (!_db) return Promise.reject(new Error('서버에 아직 안 붙었습니다'));
    return _db.ref('data/' + key).once('value').then(function (s) {
      var raw = s.val();
      var v = (raw && typeof raw === 'object' && 'v' in raw) ? raw.v : raw;
      _raw[key] = v;
      return normalize(v);
    });
  }

  /* 여러 칸을 한꺼번에. 한 칸을 못 읽어도(권한·그물) 나머지는 그대로 온다 —
     ⚠ 못 읽은 칸을 «빈 것»으로 주지 않는다. 빈 배열은 「없다」는 거짓말이 된다. */
  function readMany(keys) {
    var out = {}, bad = {};
    return Promise.all((keys || []).map(function (k) {
      return readOnce(k).then(function (v) { out[k] = v; })
        .catch(function (e) { bad[k] = (e && e.message) || String(e); });
    })).then(function () { return { data: out, failed: bad }; });
  }

  /* 바뀐 한 건만 받아 표를 고쳐 준다. 되돌리개(끄는 함수)를 준다. */
  function watch(key, onChange) {
    if (!_db) return function () {};
    var ref = _db.ref('data/' + key + '/v');
    var timer = null;
    function ping() { clearTimeout(timer); timer = setTimeout(function () { onChange(key); }, 150); }
    ref.on('child_added', ping); ref.on('child_changed', ping); ref.on('child_removed', ping);
    return function () {
      clearTimeout(timer);
      try { ref.off('child_added', ping); ref.off('child_changed', ping); ref.off('child_removed', ping); } catch (e) {}
    };
  }

  var api = {
    normalize: normalize,
    stableId: stableId,
    attach: attach,
    rawForm: rawForm,
    readOnce: readOnce,
    readMany: readMany,
    watch: watch
  };
  return api;
});
