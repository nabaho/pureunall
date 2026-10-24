/* 📇 리멤버 → 푸른사진첩·기업정보함 — 계산 층 (대표 「반드시 자동으로」 2026-10-24, 목업 승인)
   ═══════════════════════════════════════════════════════════════════════════
   리멤버 웹이 스스로 부르는 명함 목록(api.rememberapp.co.kr/v2/stacks/list.json, snake_case)을
   기업정보함 «명함» 칸과 사진첩 «판독 결과»로 바꾸고, 지난번 어디까지 받았는지(cp, 수정 시각)로 새것을 가른다.
   브라우저·노드 둘 다에서 돈다 — 검사(tests/remember-auto.test.js)가 이 파일을 그대로 부른다.

   ★ 옛 명함은 이미 다 들어와 있다(대표 10/24) — 첫 회차는 «기준(cp)»만 잡고 아무것도 넣지 않는다.
   ★ 리멤버 쪽은 읽기만 한다. 우리 쪽도 지우지 않는다.
   ⚠ 사람 이름·회사는 리멤버가 준 그대로 — 고치지 않는다(전화번호 모양만 맞춘다). */
(function (root) {
  'use strict';

  function s(v) { return String(v == null ? '' : v).trim(); }
  function digits(v) { return s(v).replace(/\D/g, ''); }

  /* 전화 모양 — 국내 번호를 기업정보함이 쓰는 꼴(010-1234-5678 · 041-123-4567 · 02-123-4567)로 */
  function phone(o) {
    if (!o) return '';
    var raw = s(o.national_number || o.nationalNumber || o.normalized_number || o.normalizedNumber);
    var d = digits(raw);
    if (/^82/.test(d) && d.length >= 11) d = '0' + d.slice(2);
    if (!d) return '';
    if (/^02/.test(d)) return d.length === 9 ? d.replace(/^(02)(\d{3})(\d{4})$/, '$1-$2-$3') : d.replace(/^(02)(\d{4})(\d{4})$/, '$1-$2-$3');
    if (d.length === 11) return d.replace(/^(\d{3})(\d{4})(\d{4})$/, '$1-$2-$3');
    if (d.length === 10) return d.replace(/^(\d{3})(\d{3})(\d{4})$/, '$1-$2-$3');
    if (d.length === 8) return d.replace(/^(\d{4})(\d{4})$/, '$1-$2');
    return raw;
  }

  /* 리멤버 명함 묶음(stack) 하나 → 평평한 명함 */
  function fromApi(st) {
    var mc = (st && st.main_card) || {};
    var d = ((mc.data || {})['default']) || {};
    var nm = d.name || {};
    var first = s(nm.first), last = s(nm.last);
    /* 한글 이름은 성+이름을 붙인다(홍 + 길동 → 홍길동). 로마자는 띄운다 */
    var name = /[가-힣]/.test(first + last) ? (last + first) : [first, last].filter(Boolean).join(' ');
    var ad = d.address || {};
    var img = mc.image || {};
    var pic = function (o) { return (!o || o.empty) ? '' : s(o.original || o.preview); };
    var t1 = Date.parse(st && st.updated_at) || 0, t2 = Date.parse(mc.updated_at) || 0;
    return {
      rid: s(st && st.id), cid: s(mc.id),
      createdAt: s((st && st.created_at) || mc.created_at),
      requestedAt: s(mc.requested_at),
      updatedAt: Math.max(t1, t2) || 0,
      name: name, company: s(d.company), dept: s(d.department), title: s(d.position),
      mobile: phone(d.mobile), tel: phone(d.tel), fax: phone(d.fax),
      email: s(d.email), address: [s(ad['default']), s(ad.detail)].filter(Boolean).join(' '),
      front: pic(img.front), back: pic(img.back)
    };
  }

  /* 기업정보함 «명함» 칸 (PuDocRead.mapTo('cards','card') 가 아는 이름) — 빈 칸은 안 담는다 */
  function toFields(c) {
    var f = {};
    ['name', 'company', 'dept', 'title', 'mobile', 'tel', 'fax', 'email', 'address'].forEach(function (k) { if (c && s(c[k])) f[k] = s(c[k]); });
    return f;
  }

  /* 사진첩 «판독 결과» — 리멤버가 이미 읽어 준 것이라 다시 판독하지 않게 적어 둔다 */
  function readOf(c, now, by) {
    return { kind: 'card', fields: toFields(c), auto: false, via: 'remember', rid: s(c && c.rid),
      at: now || Date.now(), ack: { at: now || Date.now(), by: s(by) || '리멤버' } };
  }

  /* 이번에 다룰 명함 — cp(지난번 가장 늦은 수정 시각) 뒤에 바뀐 것만, 오래된 것부터.
     첫 회차(cp 없음)는 아무것도 다루지 않고 기준만 잡는다 — 옛 명함은 이미 다 들어와 있다. */
  function plan(cards, cp) {
    var list = (cards || []).filter(function (c) { return c && c.rid && c.updatedAt; });
    var top = list.reduce(function (m, c) { return Math.max(m, c.updatedAt); }, Number(cp) || 0);
    if (!cp) return { first: true, todo: [], cp: top };
    var todo = list.filter(function (c) { return c.updatedAt > Number(cp); })
      .sort(function (a, b) { return a.updatedAt - b.updatedAt; });
    /* 같은 묶음 번호가 두 번 오면(쪽이 밀려서) 한 번만 */
    var seen = {};
    todo = todo.filter(function (c) { if (seen[c.rid]) return false; seen[c.rid] = 1; return true; });
    return { first: false, todo: todo, cp: top };
  }

  /* 사진을 새로 올릴까 — 처음 받는 명함이거나, 앞면 그림이 바뀌었을 때만(같은 그림을 두 장 쌓지 않는다) */
  function needPhoto(c, seen) {
    if (!c || !c.front) return false;
    if (!seen) return true;
    return s(seen.front).split('?')[0] !== s(c.front).split('?')[0];
  }

  /* 리멤버 그림 주소는 이 집 것만 받는다 — 아무 주소나 내려받지 않게 */
  function okImageUrl(u) { return /^https:\/\/remember-cdn\.rememberapp\.co\.kr\/[^\s"'<>]+$/.test(s(u)); }

  var api = { phone: phone, fromApi: fromApi, toFields: toFields, readOf: readOf, plan: plan, needPhoto: needPhoto, okImageUrl: okImageUrl };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PuRemember = api;
})(typeof window !== 'undefined' ? window : globalThis);
