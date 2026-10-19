/* 푸른 캘린더 › 담당자 이름으로 기업정보함 찾기 · 주소 확인 · 연락처 남기기 — 순수 모듈 (2026-10-19)
   ────────────────────────────────────────────────────────────────────────
   대표 지시 2026-10-19 「사람 이름 검색 시에 정보함에 이름·주소 등을 모두 찾아서 자동으로 넣을 수 있게」
     「주소가 바뀌는 경우가 많으니 그 경우 주소 체크하게 해주고」
     「담당자 연락처도 항상 남기게 해줘 — 그래야 방문 시에 연락처로 전화할 수 있다」.

   ★ 읽기만 한다 — 기업정보함(pucards/idx)을 고치지 않는다. 색인은 화면이 이미 받아 둔 목록(list)을 넘겨받는다.
   ★ 주소는 «정보함에 적힌 때»를 모른다(색인에 갱신일이 없다). 그래서 «옛 주소일 수 있다»는 전제로
     ① 정보함 주소가 그대로 들어가면 사람이 «맞습니다»를 눌러야 하고(저장 때도 한 번 더 묻는다)
     ② 일정에 적은 위치와 정보함 주소가 다르면 둘을 나란히 보여 주고
     ③ 같은 업체에 주소가 여럿이면(이전·지점) 어느 것인지 고르게 한다.
   ★ 연락처(전화번호)는 «담당자» 칸에 글로 남는다 → 구글 일정 설명(「담당자: …」)에 실려 폰 구글 캘린더에서
     눌러 전화할 수 있다. 전화번호가 없으면 저장 전에 «그래도?»를 묻는다(막지는 않는다 — 방문이 아닌 일정도 있다).
   ⚠ 이름으로 업체를 «잇지» 않는다(온톨로지) — 고른 명함의 번호(k)만 sourceId 로 남는다(pu-cal.html 저장 쪽).

   tests/cal-card-lookup.test.js 가 실제로 돌려 본다. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PuCalCard = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function s(v) { return v == null ? '' : String(v); }
  function digits(v) { return s(v).replace(/\D/g, ''); }

  /* 한국 전화번호 꼴 — 휴대폰·지역번호·1588 류. 날짜(2026-10-20)는 걸리지 않는다(맨 앞이 0 이 아니다) */
  var PHONE_RE = /0\d{1,2}[-.\s)]*\d{3,4}[-.\s]*\d{4}|\b1[5-9]\d{2}[-.\s]*\d{4}\b/;
  function hasPhone(text) { return PHONE_RE.test(s(text)); }

  /* ── 이름으로 찾기 ───────────────────────────────────────────────────── */
  /* 칸에 «정빛나이사» 처럼 이름 뒤에 직함이 붙어 와도 이름을 찾는다 */
  var TITLES = '대표이사|대표|이사|사장|부사장|전무|상무|본부장|센터장|원장|소장|실장|팀장|부장|차장|과장|대리|주임|사원|선생님|선생|님';
  var TITLE_TAIL = new RegExp('\\s*(?:' + TITLES + ')\\s*$');
  function stripTitle(q) { var t = s(q).trim(); var r = t.replace(TITLE_TAIL, '').trim(); return r.length >= 2 ? r : t; }

  /* list: 화면이 받아 둔 색인 줄들 [{k, c, n, ti, m, t, ct, ad, kind}] · 돌려주는 것: 여덟 줄까지 */
  function rank(list, q, limit) {
    q = s(q).trim().toLowerCase();
    if (!q || !Array.isArray(list)) return [];
    var q2 = stripTitle(q).toLowerCase();
    var dq = digits(q);
    var out = [];
    list.forEach(function (x) {
      if (!x) return;
      var n = s(x.n).toLowerCase(), c = s(x.c).toLowerCase();
      var 점 = -1;
      if (n) {
        if (n === q || n === q2) 점 = 0;
        else if (n.indexOf(q2) === 0 || (n.length >= 2 && q.indexOf(n) === 0)) 점 = 1;
        else if (n.indexOf(q2) > 0) 점 = 2;
      }
      if (점 < 0 && c) {
        if (c.indexOf(q) === 0) 점 = 3; else if (c.indexOf(q) > 0) 점 = 4;
      }
      if (점 < 0 && dq.length >= 4 && digits(s(x.m) + s(x.t) + s(x.ct)).indexOf(dq) >= 0) 점 = 5;
      if (점 >= 0) out.push({ x: x, 점: 점 });
    });
    out.sort(function (a, b) { return a.점 - b.점 || (s(b.x.n) ? 1 : 0) - (s(a.x.n) ? 1 : 0) || s(a.x.c).localeCompare(s(b.x.c)); });
    return out.slice(0, limit || 8).map(function (o) { return o.x; });
  }

  /* ── 연락처 글 ───────────────────────────────────────────────────────── */
  function phoneOf(x) { return s(x && (x.m || x.t)).trim(); }
  /* 「정빛나 이사 · 010-1234-5678 · 회사 044-123-4567」— 전화번호를 «항상» 담는다(있으면) */
  function contactText(x) {
    if (!x) return '';
    var who = (s(x.n).trim() + (x.ti ? ' ' + s(x.ti).trim() : '')).trim();
    var p = phoneOf(x), ct = s(x.ct).trim();
    var parts = [who || s(x.c).trim()];
    if (p) parts.push(p);
    if (ct && digits(ct) !== digits(p)) parts.push('회사 ' + ct);
    return parts.filter(Boolean).join(' · ');
  }

  /* ── 주소 ────────────────────────────────────────────────────────────── */
  function addrKey(a) {
    return s(a).toLowerCase().replace(/\([^)]*\)/g, '').replace(/[^0-9a-z가-힣]/g, '')
      .replace(/특별자치시|특별자치도|특별시|광역시/g, '');
  }
  /* 도로명+번호(예: 의사로36번길 38-6)가 같으면 같은 주소로 본다 — 「충남」과 「충청남도」처럼 앞말이 달라도 */
  function roadKey(a) {
    var m = /([가-힣0-9]+(?:대로|로|길))\s*(\d+(?:-\d+)?)/.exec(s(a));
    return m ? m[1] + ' ' + m[2] : '';
  }
  function addrSame(a, b) {
    var ka = addrKey(a), kb = addrKey(b);
    if (!ka || !kb) return false;
    if (ka === kb || ka.indexOf(kb) >= 0 || kb.indexOf(ka) >= 0) return true;
    var ra = roadKey(a), rb = roadKey(b);
    return !!ra && ra === rb;
  }
  function normCo(v) {
    return s(v).toLowerCase().replace(/\s+/g, '').replace(/\(주\)|㈜|주식회사|\(유\)|유한회사|\(사\)|\(재\)/g, '');
  }

  /* 고른 명함을 일정 창(m)에 채운다. 사람이 이미 쓴 «위치»는 덮지 않는다(다르면 알린다).
     opts.overwriteContact — 담당자 칸에서 이름을 쳐서 고른 것이므로, 친 글(이름)을 연락처 글로 바꾼다. */
  function fill(m, x, opts) {
    opts = opts || {};
    if (!m || !x) return { filled: [] };
    var filled = [];
    m.card = x;
    if (!s(m.title).trim() && s(x.c || x.n).trim()) { m.title = s(x.c || x.n) + ' 미팅'; filled.push('제목'); }
    if (!s(m.place).trim() && s(x.ad).trim()) { m.place = s(x.ad); filled.push('주소'); }
    if (opts.overwriteContact || !s(m.contact).trim()) { var t = contactText(x); if (t) { m.contact = t; filled.push('담당자·연락처'); } }
    addrState(m, x);
    return { filled: filled };
  }
  /* 장소 칸과 정보함 주소의 관계를 적어 둔다 — 화면이 안내 줄을 그린다 */
  function addrState(m, x) {
    m.addrOk = false;
    m.addrFromCard = !!(x && s(x.ad).trim() && addrSame(m.place, x.ad));
    m.addrDiff = (x && s(x.ad).trim() && s(m.place).trim() && !m.addrFromCard) ? s(x.ad) : '';
  }

  /* 안내 줄 재료 — {fromCard, diff, alts:[{ad, who}], ok} · 명함을 안 골랐으면 null */
  function addrHints(m, list) {
    if (!m || !m.card) return null;
    var x = m.card;
    var cur = s(m.place);
    var fromCard = !!(s(x.ad).trim() && addrSame(cur, x.ad));
    /* 「지금 위치가 맞음」을 눌렀으면(addrKeep) 다름 안내를 접는다 */
    var diff = (s(x.ad).trim() && cur.trim() && !fromCard && !m.addrKeep) ? s(x.ad) : '';
    var alts = [], seen = {};
    var co = normCo(x.c);
    /* 주소를 확인했거나(addrOk) 어느 곳인지 골랐으면 «다른 주소가 있다» 안내를 접는다 */
    if (co && Array.isArray(list) && !m.addrOk) {
      list.forEach(function (y) {
        if (!y || normCo(y.c) !== co || !s(y.ad).trim()) return;
        var key = addrKey(y.ad);
        if (!key || addrSame(y.ad, x.ad) || seen[key]) return;
        if (addrSame(y.ad, cur)) return;            // 지금 위치와 같은 것은 «다른 주소»가 아니다
        seen[key] = 1;
        alts.push({ ad: s(y.ad), who: s(y.n) || '업체' });
      });
    }
    return { fromCard: fromCard, diff: diff, alts: alts.slice(0, 4), ok: !!m.addrOk };
  }

  /* ── 저장 전 확인거리 — [{kind, msg}] · 비면 그냥 저장 ───────────────────
     ⚠ 막지 않는다. 묻는다 — 방문이 아닌 일정(회의·행사)도 있고, 사람이 판단할 일이다. */
  function saveWarnings(m) {
    var w = [];
    if (!m || m.kind !== 'sch') return w;
    var place = s(m.place).trim(), contact = s(m.contact).trim();
    if (m.card && s(m.card.ad).trim() && !m.addrOk && addrSame(place, m.card.ad)) {
      w.push({ kind: 'addr', msg: '📍 장소가 기업정보함에 적힌 주소 그대로입니다.\n업체는 이전하는 일이 많습니다 — 현재 주소가 맞는지 확인하셨습니까?\n\n[확인] 맞습니다, 저장\n[취소] 돌아가서 확인' });
    }
    /* 새 일정이거나 담당자 칸을 바꿨을 때만 — 이미 있는 일정의 시간만 옮길 때마다 묻지 않는다 */
    var 손댐 = m.mode === 'new' || contact !== s(m.contact0).trim();
    if (손댐) {
      if (contact && !hasPhone(contact)) {
        w.push({ kind: 'phone', msg: '📞 담당자 연락처(전화번호)가 없습니다.\n방문 때 전화하려면 번호를 남겨 두셔야 합니다.\n\n[확인] 그래도 저장\n[취소] 돌아가서 적기' });
      } else if (!contact && place) {
        w.push({ kind: 'nocontact', msg: '📞 장소는 있는데 담당자 연락처가 비어 있습니다.\n방문 때 전화할 번호가 필요하지 않으십니까?\n\n[확인] 그래도 저장\n[취소] 돌아가서 적기' });
      }
    }
    return w;
  }

  return {
    hasPhone: hasPhone, rank: rank, stripTitle: stripTitle, phoneOf: phoneOf, contactText: contactText,
    addrSame: addrSame, addrKey: addrKey, roadKey: roadKey, normCo: normCo,
    fill: fill, addrState: addrState, addrHints: addrHints, saveWarnings: saveWarnings
  };
});
