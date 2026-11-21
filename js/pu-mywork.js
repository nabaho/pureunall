/* 📋 내 업무 숫자 — 포털 머리줄 «내 업무» 단추 · 이알피 「나의 업무」 · 업무관리 「내 업무」가 «같은 숫자»를 쓴다
   (대표 지시 2026-11-21 「로그인한 사람이 자기 업무를 한 번에 보고 클릭해서 확인」 → 추천대로).

   ★ 누가 쓰나: 업무관리(work.html)가 «내 업무» 화면을 그릴 때 그 사람 몫 한 줄만 적는다.
       work_erp/mysum/{사번} = { v, n, dd[], nx[], nl, ws, we, at }
         n  = 진행 건수 — 업무관리 「내 업무」 머리의 «진행» 과 같은 셈(이관한 계약·자문·급여 뺌, 펼침 단추와 상관없이)
         dd = 기한(다음 할 일·업무 기한·사건 단계 기한 중 이른 것) 날짜들 — «임박»은 읽는 쪽이 «오늘» 기준으로 다시 센다
         nx = 다음 할 일 날짜들 — «오늘까지 할 일»도 읽는 쪽이 다시 센다
         nl = 이번 주 미기록 건수 — ws~we(그 주 월~일) 안에서만 뜻이 있다
       날짜를 «숫자»가 아니라 «날짜»로 두는 까닭: 업무관리를 어제 열었어도 오늘 임박이 맞게 나온다.
   ★ 누가 읽나: 포털(enter.html)·이알피(pu-erp.html) — 이 한 줄(수십 바이트)만 읽는다. 업무 목록 통째(work_erp/items)를 안 읽는다.
   ⚠ 못 읽었거나 너무 오래된 값(STALE_DAYS)은 «숫자를 안 보인다» — 못 받음 ≠ 0건(포털 「오늘 N건」과 같은 원칙).
   ⚠ 이름·업체·제목은 담지 않는다 — 날짜와 건수뿐이다. 자리(work_erp)는 원래 «로그인한 직원 모두 읽기»라 더 넓게 공개되지 않는다. */
(function (root) {
  'use strict';
  var PATH = 'work_erp/mysum';
  var STALE_DAYS = 14;               // 이보다 오래 업무관리를 안 열었으면 숫자를 믿지 않는다
  var MAX_DATES = 400;               // 한 사람 몫이 이보다 많을 일은 없다 — 이상한 값이 서버를 키우지 않게

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymdOf(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function isYmd(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s); }
  /* 사번을 서버 열쇠로 — 열쇠에 못 쓰는 글자만 바꾼다(P-001 은 그대로) */
  function key(sid) { return String(sid || '').trim().replace(/[.#$\[\]\/]/g, '_'); }
  function pathOf(sid) { var k = key(sid); return k ? PATH + '/' + k : ''; }
  /* 업무관리 dday 와 같은 셈 — 오늘 0 · 지났으면 음수 */
  function dday(dateStr, todayYmd) {
    if (!isYmd(dateStr) || !isYmd(todayYmd)) return null;
    var a = Date.UTC(+dateStr.slice(0, 4), +dateStr.slice(5, 7) - 1, +dateStr.slice(8, 10));
    var b = Date.UTC(+todayYmd.slice(0, 4), +todayYmd.slice(5, 7) - 1, +todayYmd.slice(8, 10));
    return Math.round((a - b) / 86400000);
  }
  function dates(list) {
    return (Array.isArray(list) ? list : []).filter(isYmd).sort().slice(0, MAX_DATES);
  }
  /* 업무관리가 적을 한 줄. o = { n, dues:[날짜], nexts:[날짜], nolog, ws, we, now } */
  function build(o) {
    o = o || {};
    var out = { v: 1, n: Math.max(0, o.n | 0), dd: dates(o.dues), nx: dates(o.nexts), at: +o.now || Date.now() };
    if (isYmd(o.ws) && isYmd(o.we) && o.nolog !== null && o.nolog !== undefined) {
      out.nl = Math.max(0, o.nolog | 0); out.ws = o.ws; out.we = o.we;
    }
    return out;
  }
  /* 시각(at)만 다른 것은 «같다» — 바뀐 것이 없으면 다시 안 적는다 */
  function same(a, b) {
    if (!a || !b) return false;
    function strip(x) { var c = {}; Object.keys(x).sort().forEach(function (k) { if (k !== 'at') c[k] = x[k]; }); return JSON.stringify(c); }
    return strip(a) === strip(b);
  }
  /* 읽는 쪽 셈. 못 믿을 값이면 null — 화면은 숫자를 안 보인다.
     돌려주는 것: { open, due(7일 안·지난 기한), next(오늘까지 할 일), nolog(이번 주가 아니면 null), at } */
  function counts(sum, todayYmd, nowMs) {
    if (!sum || typeof sum !== 'object' || !(+sum.at > 0) || !isYmd(todayYmd)) return null;
    var now = +nowMs || Date.now();
    if (now - sum.at > STALE_DAYS * 86400000) return null;
    if (sum.at - now > 86400000) return null;             // 시계가 엉뚱하게 앞선 값도 안 믿는다
    var due = dates(sum.dd).filter(function (d) { var n = dday(d, todayYmd); return n !== null && n <= 7; }).length;
    var next = dates(sum.nx).filter(function (d) { return d <= todayYmd; }).length;
    var nolog = (isYmd(sum.ws) && isYmd(sum.we) && todayYmd >= sum.ws && todayYmd <= sum.we && sum.nl !== undefined)
      ? Math.max(0, sum.nl | 0) : null;
    return { open: Math.max(0, sum.n | 0), due: due, next: next, nolog: nolog, at: +sum.at };
  }
  /* 「11-21 18:07 기준」 — 말풍선에 쓴다 */
  function stamp(at) {
    var d = new Date(+at); if (isNaN(d)) return '';
    return pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  /* 한 줄 풀이 — 「진행 12 · 임박 2 · 오늘 할 일 1」. 0건인 임박·할 일은 안 적는다(진행은 늘 적는다) */
  function line(c) {
    if (!c) return '';
    var p = ['진행 ' + c.open];
    if (c.due) p.push('임박 ' + c.due);
    if (c.next) p.push('할 일 ' + c.next);
    return p.join(' · ');
  }

  var api = { PATH: PATH, STALE_DAYS: STALE_DAYS, key: key, pathOf: pathOf, dday: dday, ymdOf: ymdOf,
    build: build, same: same, counts: counts, stamp: stamp, line: line };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.PuMyWork = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
