/* ══ 작업 기록 — «누가 언제 무엇을 했나» 덧붙이기 장부 (견적·계약 자동화 계획 1) ══
   ■ 자리  RTDB pu_worklog/{YYYYMM}/{push}   — 달별로 나눠 쌓는다. 새로 쓰기만(고치기·지우기는 규칙이 막는다).
   ■ 읽기는 총괄관리자만(규칙). 쓰기는 재직 직원 누구나, 내 이름으로만.
   ⚠ 기록은 «곁가지»다 — 기록이 실패해도 본 업무(저장·발송 등)를 막으면 안 되므로
     log() 는 어떤 오류도 삼키고 console.warn 만 남긴다.
   ⚠ RTDB 는 undefined 를 거절한다 — 빈 칸은 아예 뺀다. 칸 길이는 규칙과 같게 미리 자른다. */
(function (w) {
  'use strict';

  var ROOT = 'pu_worklog';
  var KINDS = {
    form_save: '서식 저장', download: '내려받기', upload: '올리기', mail_send: '메일 발송',
    sign_request: '서명 요청', review_request: '검토 요청', review_done: '검토 완료',
    erp_register: '이알피 등록', erp_confirm: '계약확정', auto_detect: '자동 감지',
    quote_save: '견적 기록', owner_confirm: '담당 확정'
  };
  var KST_MS = 9 * 3600 * 1000;
  var ctx = { db: null, uid: '', name: '' };

  function init(o) {
    o = o || {};
    ctx = { db: o.db || null, uid: o.uid || '', name: o.name || '' };
  }
  /* 한국 시간 기준 달 열쇠 — UTC 에 9시간을 더해 읽는다 */
  function monthKey(ms) {
    var d = new Date(ms + KST_MS);
    return String(d.getUTCFullYear()) + ('0' + (d.getUTCMonth() + 1)).slice(-2);
  }
  function put(r, k, v, max) {
    if (typeof v !== 'string' || !v) return;
    r[k] = v.slice(0, max);
  }
  function entry(kind, o, now) {
    if (!Object.prototype.hasOwnProperty.call(KINDS, kind)) throw new Error('모르는 작업 종류: ' + kind);
    o = o || {};
    var r = { kind: kind, at: typeof now === 'number' ? now : Date.now(), by: ctx.uid };
    put(r, 'byName', ctx.name, 60);
    put(r, 'target', o.target, 120);
    put(r, 'note', o.note, 200);
    put(r, 'auto', o.auto, 60);
    return r;
  }
  function log(kind, o) {
    try {
      if (!ctx.db) return Promise.resolve();
      var e = entry(kind, o);
      return Promise.resolve(ctx.db.ref(ROOT + '/' + monthKey(e.at)).push(e)).then(function () {}, function (err) {
        if (w.console) w.console.warn('작업 기록 실패', err && err.message);
      });
    } catch (err) {
      if (w.console) w.console.warn('작업 기록 실패', err && err.message);
      return Promise.resolve();
    }
  }
  function list(month) {
    if (!ctx.db) return Promise.resolve([]);
    return Promise.resolve(ctx.db.ref(ROOT + '/' + month).once('value')).then(function (snap) {
      var v = (snap && snap.val()) || {};
      return Object.keys(v).map(function (id) {
        var r = { id: id };
        Object.keys(v[id]).forEach(function (k) { r[k] = v[id][k]; });
        return r;
      }).sort(function (a, b) { return (b.at || 0) - (a.at || 0); });
    });
  }

  w.PuWorklog = { KINDS: KINDS, init: init, monthKey: monthKey, entry: entry, log: log, list: list };
})(typeof window !== 'undefined' ? window : this);
