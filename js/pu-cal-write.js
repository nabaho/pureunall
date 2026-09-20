/* 푸른 캘린더 — 이알피 자료를 «고치는» 문 (1걸음-나)
   ────────────────────────────────────────────────────────────────────────
   일정·근태의 주인은 이알피다. 푸른 캘린더는 그 칸에 «같은 규칙으로» 쓴다.
   규칙이 한 줄이라도 달라지면 두 앱이 서로를 덮고, 그 손해는 **급여에서** 드러난다.

   ★ 여기 담긴 것은 «관문»이다. 지나야 할 여섯 가지 —

     ① 번호 없는 항목은 안 쓴다
        번호 없는 항목이 하나라도 생기면 그 표는 안전 병합이 꺼지고 «통째 저장»으로
        떨어진다. 한 번 고칠 때마다 1MB 를 주고받게 되고, 두 기기가 서로를 덮는다.

     ② 번호·칸 이름에 금지문자(. # $ / [ ])가 있으면 이 길로 안 쓴다
        실시간DB 의 경로 글자다. 들어가면 엉뚱한 자리에 쓴다.

     ③ 마감된 달은 막는다 — «새 날짜»와 «원래 날짜» 둘 다 본다
        옮기는 것도 막아야 한다. 잠긴 달에서 빼내는 것 역시 잠긴 달을 고치는 일이다.
        ⚠ 날짜가 없는 기록은 어느 달인지 알 수 없으니 막지 않는다(막으면 영영 못 고친다).

     ④ 표가 «지도형»일 때만 이 길로 쓴다
        아직 배열로 있는 표에 v/{번호} 를 쓰면 배열에 글자 열쇠가 섞여 표가 깨진다.
        그럴 때는 쓰지 않고 «이알피에서 하라»고 돌려보낸다 — 이알피에는 그 표를
        통째로 안전하게 저장하는 길이 따로 있다. 우리는 그 길을 흉내 내지 않는다.

     ⑤ 바뀐 칸만 보낸다. 레코드를 통째로 덮지 않는다
        두 사람이 서로 다른 칸을 고쳐도 나중 사람이 앞사람 칸을 되돌리지 않게.

     ⑥ 번호를 «늘» 함께 보낸다
        실시간DB 의 update 는 없는 자리에 쓰면 만들어 준다. 그래서 서버에 없던 건에
        칸만 쓰면 «본문에 번호가 없는 껍데기»가 생긴다 — ①이 말한 그 사고다.
        (이알피는 이 한 줄이 dbPatch 에만 빠져 있어 오래 못 찾았다. 2026-09-14)

   ⚠ 이 문은 이알피의 «지역 사본»을 건드리지 않는다. 우리는 서버에만 쓰고,
     화면은 바뀐 한 건을 다시 받아 고쳐 그린다. 그래서 이알피가 열려 있어도 안전하다.

   tests/cal-write-gate.test.js 가 여섯 가지를 하나씩 되돌려 보며 지킨다. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PuCalWrite = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  /* 실시간DB 경로에 못 쓰는 글자 — 이알피의 _REC_BADKEY 와 같아야 한다 */
  var BADKEY = /[.#$\[\]\/]/;

  var _db = null, _ctx = null;
  /* ctx: { lockedMonths:[…], dateOf(table,id), formOf(table), who() } */
  function attach(db, ctx) { _db = db; _ctx = ctx || {}; return api; }

  function fail(code, msg) { return { ok: false, code: code, message: msg }; }
  var OK = { ok: true };

  function lockedMonths() {
    var v = _ctx.lockedMonths;
    return Array.isArray(v) ? v : (typeof v === 'function' ? (v() || []) : []);
  }

  /* ③ 마감 자물쇠 — 대상 표인지, 어느 달인지는 js/pu-work-core.js 가 정한다 */
  function lockedBy(table, ymd) {
    var W = (typeof PuWork !== 'undefined') ? PuWork : require('./pu-work-core.js');
    var ym = W.lockMonthOf(table, ymd);
    if (!ym) return '';
    return lockedMonths().indexOf(ym) >= 0 ? ym : '';
  }

  /* ④ 그 표가 지금 서버에서 «지도형»인가.
     열쇠가 죄다 0,1,2… 이면 아직 배열이다 — 그 표에는 이 길로 쓰지 않는다. */
  function isMapForm(rawV) {
    if (rawV == null) return false;                 // 아직 아무것도 없다 → 모른다, 안 쓴다
    if (Array.isArray(rawV)) return false;
    if (typeof rawV !== 'object') return false;
    var ks = Object.keys(rawV);
    if (!ks.length) return false;
    return !ks.every(function (k, i) { return k === String(i); });
  }

  /* 관문 — 쓰기 전에 «다» 본다. 하나라도 걸리면 아무것도 안 보낸다. */
  function check(table, id, fields, prevDate) {
    if (!_db) return fail('no_server', '서버에 아직 안 붙었습니다');
    if (typeof id !== 'string' || !id) return fail('no_id', '번호 없는 항목은 저장하지 않습니다');
    if (BADKEY.test(id)) return fail('bad_id', '번호에 쓸 수 없는 글자가 있습니다 — 푸른이알피에서 고쳐 주세요');
    var bad = '';
    Object.keys(fields || {}).forEach(function (f) { if (BADKEY.test(f)) bad = f; });
    if (bad) return fail('bad_field', '「' + bad + '」 칸 이름에 쓸 수 없는 글자가 있습니다');

    var ymNew = lockedBy(table, (fields || {}).date);
    if (ymNew) return fail('locked', ymNew + ' 근태·휴가는 마감됐습니다 — 고칠 수 없습니다');
    var ymOld = lockedBy(table, prevDate);
    if (ymOld) return fail('locked', ymOld + ' 근태·휴가는 마감됐습니다 — 그 달에서 빼낼 수 없습니다');

    var form = typeof _ctx.formOf === 'function' ? _ctx.formOf(table) : null;
    if (!isMapForm(form)) {
      return fail('array_form',
        '이 표는 아직 옛 방식(배열)으로 담겨 있습니다 — 푸른이알피에서 고쳐 주세요.\n'
        + '여기서 쓰면 표가 깨집니다.');
    }
    return OK;
  }

  /* ⑤⑥ 보낼 칸을 만든다 — 바뀐 것만 + 번호는 늘 */
  function fieldPaths(id, fields, prev) {
    var out = {};
    Object.keys(fields).forEach(function (f) {
      var v = fields[f];
      if (prev && JSON.stringify(prev[f]) === JSON.stringify(v)) return;   // 안 바뀐 칸은 안 보낸다
      out[id + '/' + f] = (v === undefined ? null : v);
    });
    out[id + '/id'] = id;                                                   // ⑥ 그물
    return out;
  }

  function stamp(out, id) {
    out[id + '/updatedAt'] = Date.now();
    var who = typeof _ctx.who === 'function' ? _ctx.who() : null;
    if (who) out[id + '/updatedBy'] = who;
    return out;
  }

  /* 서버에 보낸다. 표의 «시각»(u)도 함께 올려 다른 화면이 바뀐 줄 안다. */
  function send(table, childPaths) {
    var updates = {};
    Object.keys(childPaths).forEach(function (p) {
      updates['data/' + table + '/v/' + p] = childPaths[p];
    });
    updates['data/' + table + '/u'] = Date.now();
    return _db.ref().update(updates);
  }

  /* 한 건 넣기·고치기. prev 는 지금 화면이 들고 있는 그 건(없으면 새것). */
  function save(table, item, prev) {
    if (!item || typeof item !== 'object') return Promise.resolve(fail('no_item', '저장할 것이 없습니다'));
    var id = item.id;
    var fields = {};
    Object.keys(item).forEach(function (f) { if (f !== 'id') fields[f] = item[f]; });
    var g = check(table, id, fields, prev && prev.date);
    if (!g.ok) return Promise.resolve(g);
    var paths = stamp(fieldPaths(id, fields, prev), id);
    return send(table, paths).then(function () { return OK; })
      .catch(function (e) { return fail('server', (e && e.message) || String(e)); });
  }

  /* ── 사람 색 «채워 넣기» (data/staff_colors) ──────────────────────────────
     캘린더를 한 곳으로 모으기 1걸음. 이 색을 «정하는 곳»이 여태 이알피 법인
     대시보드 한 곳뿐이라, 그 화면을 걷어내면 새 직원에게 색이 영영 안 생긴다.

     ⚠ 이것만은 «레코드 표»가 아니라 한 덩이 지도다(사번 → 색). 위 여섯 관문
       (번호·마감·지도형…)이 그대로 맞지 않아 따로 둔다. 대신 이 넷을 본다 —
       ① 빈 지도는 안 쓴다 — 올리면 서버의 색이 «통째로» 날아간다
       ② 열쇠는 사번(금지문자 없음), 값은 #rrggbb 만 — 섞이면 읽는 쪽이 깨진다
       ③ 이알피 dbSet 과 «같은 겉꼴»({v,u})로 쓴다 — 아니면 서로 못 읽는다
       ④ 통째로 «덮어쓴다» — 부르는 쪽이 「있던 것 + 채운 것」을 다 넘겨야 한다.
          (그래서 부르는 쪽이 있던 색을 먼저 읽었는지가 중요하다)
     ⚠ «누가» 쓸 수 있는지는 여기서 안 본다 — 부르는 쪽이 고르고, 마지막 문은
       서버 규칙(staff_colors 는 관리자·위임관리인만)이다. */
  var COLORV = /^#[0-9a-fA-F]{6}$/;
  function saveColors(colors) {
    if (!_db) return Promise.resolve(fail('no_db', '아직 서버에 붙기 전입니다'));
    if (!colors || typeof colors !== 'object' || Array.isArray(colors)) {
      return Promise.resolve(fail('bad_shape', '사람 색은 «사번 → 색» 지도여야 합니다'));
    }
    var keys = Object.keys(colors);
    if (!keys.length) {
      return Promise.resolve(fail('empty', '빈 색표는 안 올립니다 — 서버의 색이 통째로 날아갑니다'));
    }
    for (var i = 0; i < keys.length; i++) {
      if (BADKEY.test(keys[i])) {
        return Promise.resolve(fail('bad_id', '사번에 쓸 수 없는 글자가 있습니다: ' + keys[i]));
      }
      if (!COLORV.test(String(colors[keys[i]]))) {
        return Promise.resolve(fail('bad_color',
          '색이 #rrggbb 꼴이 아닙니다: ' + keys[i] + ' = ' + colors[keys[i]]));
      }
    }
    return _db.ref('data/staff_colors').set({ v: colors, u: Date.now() })
      .then(function () { return OK; })
      .catch(function (e) { return fail('server', (e && e.message) || String(e)); });
  }

  /* 한 건 지우기 — 자리를 비운다(v/{번호} = null). */
  function remove(table, id, prev) {
    var g = check(table, id, {}, prev && prev.date);
    if (!g.ok) return Promise.resolve(g);
    var paths = {}; paths[id] = null;
    return send(table, paths).then(function () { return OK; })
      .catch(function (e) { return fail('server', (e && e.message) || String(e)); });
  }

  /* 새 번호 — 이알피가 쓰는 꼴과 같게 (att-…, sch-…)
     ⚠ 뒤에 붙이는 아무값을 «넉넉히» 둔다. 이알피는 세 글자만 붙이는데,
       재어 보니 오백 번에 세 번 겹쳤다(같은 밀리초에 두 건을 넣으면 그렇다).
       번호가 겹치면 한 건이 다른 한 건을 **조용히 덮는다** — 달력은 끌어놓기로
       여러 건을 잇따라 만들 수 있어 이알피보다 겹칠 자리가 많다.
     ⚠ 번호의 «생김새»는 규칙이 아니다(속뜻 없는 딱지다). 그래서 길게 해도
       이알피와 갈리는 것이 아니다 — 갈리면 안 되는 것은 저장 «관문»이다. */
  function newId(prefix) {
    var r = '';
    while (r.length < 8) r += Math.random().toString(36).slice(2);
    return prefix + '-' + Date.now().toString(36) + '-' + r.slice(0, 8);
  }

  var api = {
    BADKEY: BADKEY,
    attach: attach,
    isMapForm: isMapForm,
    check: check,
    fieldPaths: fieldPaths,
    save: save,
    saveColors: saveColors,
    remove: remove,
    newId: newId
  };
  return api;
});
