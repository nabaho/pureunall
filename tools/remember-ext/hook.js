/* 푸른 리멤버 연결 — 리멤버 화면 «안»(MAIN world)에서 도는 조각 (2026-10-24)
   리멤버 웹은 명함 목록을 POST api.rememberapp.co.kr/v2/stacks/list.json 으로 부른다.
   그 요청의 머리(authorization 등)는 화면 안에서만 만들어져 페이지 밖에서는 못 부른다(10/24 실측).
   그래서 화면이 스스로 목록을 부를 때 «머리만 기억»해 두었다가, 같은 머리로 «수정순» 목록을 지난번 기준(cp)까지 받는다.

   ⚠ 머리는 이 탭의 메모리에만 있다 — 어디에도 저장하지 않고, 확장·푸른 쪽으로 보내지도 않는다.
   ⚠ 리멤버에는 읽기(목록)만 부른다. 고치거나 지우는 주소는 부르지 않는다. */
(function () {
  'use strict';
  var LIST = 'https://api.rememberapp.co.kr/v2/stacks/list.json';
  var PER = 50, MAX_PAGES = 10;
  var HOOK = 'pu-rem-hook', RELAY = 'pu-rem-relay';
  var heads = null;                       /* 화면이 쓴 머리 — 메모리에만 */
  var of = window.fetch;

  function grab(a0, a1) {
    try {
      var url = typeof a0 === 'string' ? a0 : (a0 && a0.url) || '';
      if (url.indexOf('/v2/stacks/list.json') < 0) return;
      var h = {};
      var src = (a1 && a1.headers) || (a0 && typeof a0 === 'object' && a0.headers) || {};
      new Headers(src).forEach(function (v, k) { h[k] = v; });
      if (h.authorization) heads = h;
    } catch (e) { /* 못 읽어도 화면은 그대로 돈다 */ }
  }
  window.fetch = function (a0, a1) { grab(a0, a1); return of.apply(this, arguments); };

  function trim(st) {
    var mc = st.main_card || {}, im = mc.image || {};
    var side = function (o) { return o ? { original: o.original || '', preview: o.preview || '', empty: !!o.empty } : null; };
    return { id: st.id, created_at: st.created_at, updated_at: st.updated_at,
      main_card: { id: mc.id, created_at: mc.created_at, updated_at: mc.updated_at, requested_at: mc.requested_at,
        image: { front: side(im.front), back: side(im.back) }, data: mc.data } };
  }

  function page(n) {
    /* ⚠ credentials 를 넣지 않는다 — 리멤버 화면도 기본값으로 부른다. 'include' 를 주면 서버의 CORS 답과 맞지 않아 «Failed to fetch»(2026-10-31 실측) */
    return of.call(window, LIST, { method: 'POST', headers: heads,
      body: JSON.stringify({ group_ids: [], exclude_fields: ['sub_cards'], master: false, page: n, per: PER, sort: [{ updated_at: 'desc' }] }) })
      .then(function (r) { if (r.status === 401 || r.status === 403) throw new Error('login'); return r.json(); });
  }

  function waitHeads(ms) {
    return new Promise(function (ok) {
      var t0 = Date.now();
      (function tick() { if (heads || Date.now() - t0 > ms) return ok(!!heads); setTimeout(tick, 500); })();
    });
  }

  /* 기준(cp) 뒤에 바뀐 것까지 — 첫 회차(cp 0)는 첫 쪽만(기준 잡기용) */
  async function pull(cp) {
    if (!(await waitHeads(30000))) return { err: /login/.test(location.href) ? 'login' : 'no-heads' };
    var out = [], total = 0;
    for (var n = 1; n <= MAX_PAGES; n++) {
      var j = await page(n);
      var d = (j && j.data) || {};
      var st = d.stacks || [];
      total = (d.metainfo && d.metainfo.total_count) || total;
      st.forEach(function (x) { out.push(trim(x)); });
      var last = st[st.length - 1];
      var lastT = last ? (Date.parse(last.updated_at) || 0) : 0;
      if (!cp || !st.length || st.length < PER || lastT <= cp) break;
    }
    return { stacks: out, total: total };
  }

  window.addEventListener('message', function (ev) {
    if (ev.source !== window) return;
    var m = ev.data;
    if (!m || m.__from !== RELAY || m.__to !== HOOK || m.cmd !== 'pull') return;
    pull(Number(m.cp) || 0).then(function (r) { window.postMessage(Object.assign({ __from: HOOK, __to: RELAY, cmd: 'cards', seq: m.seq }, r), location.origin); },
      function (e) { window.postMessage({ __from: HOOK, __to: RELAY, cmd: 'cards', seq: m.seq, err: /login/.test(String(e && e.message)) ? 'login' : String((e && e.message) || e).slice(0, 80) }, location.origin); });
  });
})();
