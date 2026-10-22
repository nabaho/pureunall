'use strict';
/* 컨설팅보고서 앱(gov-report.html) — 왼쪽 사업 목록 모델·사업 종결 판정의 순수 함수 (브라우저 window.PuGovReportNav / Node 겸용)
   (대표 지시 2026-10-12 「섞어서 진행」·「연도별로, 사업이름 중심 ()에 수행기관」·「종결된 것은 종결 사업으로 뺄 수 있게」
    · 계획 docs/superpowers/plans/2026-10-12-gov-report-nav-closed.md · UI 재정리 1단계)
   무엇을 지키나
     · 읽기만 한다 — 받은 값으로 목록 모델을 만들 뿐 아무 데도 쓰지 않고 받은 값을 바꾸지 않는다.
     · 사업 한 줄 = «사업 이름 (수행기관)». 기관이 비면 「기관 미지정」. 이름이 같고 기관만 다른 사업은 label.text 로 구분된다.
     · 종결 표시는 scal_bizState/{사업 코드} = { closedFrom:'YYYY', closedAt?, reason?, by?, at }. 사업이 «종결» 인 해 = 고른 해 >= closedFrom.
       closedFrom 은 정확히 4자리 숫자 문자열이고, 문자열끼리 견준다(연도 숫자 인자도 String 으로). 「사업 전체」 = ALL_FROM('2000').
       되돌리기 = 기록을 지우는 것이 아니라 closedFrom NEVER_FROM('9999') 표시(저장 관문이 물리적 삭제를 막고, 처리자·시각도 남는다) — 어느 정상 연도에서도 종결이 아니다.
       상태 객체는 «자기 소유 속성»만 읽는다(__proto__·constructor·toString 같은 이름·프로토타입 쪽 값은 종결이 아니다).
     · 종결 사업도 목록(closed 묶음)에는 남고 실제 업체 수(count)를 그대로 담는다 — 단, 숫자 합계(total)에는 들어가지 않는다.
     · 사업 순서(2026-10-12, UI 4단계): 기본 = 푸른이알피 사업 순서(sortOrder → 이름), 대표가 끌어서 정한 순서 scal_bizOrder/main = { list:'A,B', by?, at } 가 있으면 그 사업들이 그 순서로 앞.
       build 의 모든 묶음(진행 포함)이 이 순서로 정렬된다 — 업체 수 내림차순은 쓰지 않는다. parseOrder·rankMap·reorder·orderEntry 모두 순수 함수.
     · 묶음 정하는 차례는PuGovReportDocs.sidebarGroups 와 같은 조건(visibleTypes·linkOf·pairs·planFor)을 그대로 호출한다 — 거기를 고치지 않는다.
   ⚠ 규칙(scripts/make-firebase-rules.js 의 scal_bizState)과 같은 모양이어야 한다: closedFrom ^[0-9]{4}$ · closedAt YYYY-MM-DD · reason·by ≤ 40자
     (REASON_MAX = 40). 한쪽만 바꾸면 화면이 만든 기록을 규칙이 거절한다.
   ⚠ 저장소는 공개다 — 검사는 합성 자료만 쓴다. */
(function (root) {
  var Docs = (typeof module !== 'undefined' && module.exports) ? require('./pu-gov-report-docs.js') : root.PuGovReportDocs;
  var REASONS = ['사업 기간 끝남', '이번 연도 수행 안 함', '계약 종료', '기타'];
  var REASON_MAX = 40;
  var BY_MAX = 40;
  var ALL_FROM = '2000';
  var NEVER_FROM = '9999';   // 되돌림 표시 — closedFrom 이 이 값이면 어느 연도에서도 종결이 아니다(노드를 지우지 않고 «누가 언제 되돌렸는지» 남긴다)
  var NO_AGENCY = Docs.NO_AGENCY;   // 「기관 미지정」 — 옆 모듈과 같은 말

  function str(v) { return v == null ? '' : String(v).trim(); }
  function has(o, k) { return o !== null && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, k); }
  function isYear(v) { return typeof v === 'string' && /^[0-9]{4}$/.test(v); }
  /* PuGovReportDocs 의 order·byOrder 와 같다(그쪽은 안 내보낸다) — sortOrder 없으면 맨 뒤, 같으면 이름순 */
  function order(t) { return (t.sortOrder != null && t.sortOrder !== '' && isFinite(+t.sortOrder)) ? +t.sortOrder : Infinity; }
  function byOrder(a, b) {
    var x = order(a), y = order(b);
    if (x !== y) return x < y ? -1 : 1;
    return str(a.name).localeCompare(str(b.name), 'ko');
  }

  /* {name, agency} → {name, agency, text} — text = '이름 (기관)', 기관이 비면 「기관 미지정」 */
  function label(item) {
    item = item || {};
    var name = str(item.name), agency = str(item.agency) || NO_AGENCY;
    return { name: name, agency: agency, text: name + ' (' + agency + ')' };
  }

  /* 이 사업이 고른 해에 종결인가 — state[code].closedFrom(4자리) <= String(year) */
  function closedFor(state, code, year) {
    if (!state || typeof state !== 'object' || Array.isArray(state)) return false;
    if (!has(state, code)) return false;
    var e = state[code];
    if (!e || typeof e !== 'object' || Array.isArray(e)) return false;
    var y = String(year);
    return isYear(e.closedFrom) && isYear(y) && e.closedFrom <= y;
  }

  /* 되돌림 표시인가 — 이 사업 기록의 closedFrom 이 NEVER_FROM(자기 소유 속성만 읽는다) */
  function isReopened(state, code) {
    if (!state || typeof state !== 'object' || Array.isArray(state) || !has(state, code)) return false;
    var e = state[code];
    return !!e && typeof e === 'object' && !Array.isArray(e) && e.closedFrom === NEVER_FROM;
  }

  /* 종결 기록 한 줄 — 규칙이 받아들이는 모양만 만든다. from·now 가 이상하면 null */
  function closeEntry(o) {
    o = o || {};
    var from = (typeof o.from === 'number') ? String(o.from) : o.from;
    if (!isYear(from)) return null;
    if (typeof o.now !== 'number' || !isFinite(o.now)) return null;
    var out = { closedFrom: from };
    var day = str(o.at);
    if (/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(day)) out.closedAt = day;
    var reason = str(o.reason).slice(0, REASON_MAX);
    if (reason) out.reason = reason;
    var by = str(o.by).slice(0, BY_MAX);
    if (by) out.by = by;
    out.at = o.now;
    return out;
  }

  /* ── 사업 순서 (2026-10-12, UI 4단계) ──
     기본 = 푸른이알피 «컨설팅 사업» 순서(sortOrder → 이름). 대표가 끌어서 바꾼 순서(scal_bizOrder/main = { list:'A,B', by, at })가 있으면 그 사업들이 그 순서로 앞.
     순수 함수 — 받은 값을 바꾸지 않는다. 사업 코드 꼴은 규칙·화면(GR_BIZ.code)과 같다: ^[A-Za-z0-9_-]{1,40}$ */
  var ORDER_MAX = 200;        // 목록에 담는 사업 코드 수 상한 — 화면이 지킨다(규칙은 길이·글자 꼴만 본다)
  var ORDER_LEN_MAX = 4000;   // list 전체 글자 수 상한 — 규칙의 list 길이와 같은 값(tests/gov-report-rules.test.js)
  var ORDER_NODE_KEY = 'main';   // scal_bizOrder 아래 문서 이름(한 문서)
  var CODE_RE = /^[A-Za-z0-9_-]{1,40}$/;
  function isCode(c) { return typeof c === 'string' && CODE_RE.test(c) && c !== '__proto__' && c !== 'constructor' && c !== 'prototype'; }
  /* 코드를 키로 쓰는 맵은 «자기 소유 속성»으로만 담는다(__proto__ 가 와도 프로토타입을 건드리지 않는다) */
  function put(map, k, v) { Object.defineProperty(map, k, { value: v, enumerable: true, writable: true, configurable: true }); }

  /* scal_bizOrder/main 값 → 사업 코드 배열. 코드 꼴만 남기고 중복은 처음 것만, 최대 ORDER_MAX. 못 읽으면 [] */
  function parseOrder(entry) {
    if (!has(entry, 'list') || typeof entry.list !== 'string') return [];
    var seen = new Set(), out = [], parts = entry.list.split(',');
    for (var i = 0; i < parts.length && out.length < ORDER_MAX; i++) {
      var c = parts[i];
      if (!isCode(c) || seen.has(c)) continue;
      seen.add(c); out.push(c);
    }
    return out;
  }

  /* 보이는 사업의 «현재 전체 순서» 코드 배열 — order 에 있는(보이는) 사업이 그 순서로 앞, 나머지는 이알피 순서(sortOrder 없으면 뒤 → 이름 → 들어온 차례) */
  function fullOrder(o) {
    o = o || {};
    var visible = Docs.visibleTypes(o.biz), seen = new Set(), vis = new Set(), out = [];
    visible.forEach(function (t) { vis.add(t.code); });
    (Array.isArray(o.order) ? o.order : []).forEach(function (c) {
      if (typeof c === 'string' && vis.has(c) && !seen.has(c)) { seen.add(c); out.push(c); }
    });
    visible.slice().sort(byOrder).forEach(function (t) {
      if (!seen.has(t.code)) { seen.add(t.code); out.push(t.code); }
    });
    return out;
  }

  /* o = { biz, order } → { 사업 코드: 0..n-1 } (보이는 사업만) */
  function rankMap(o) {
    var map = {};
    fullOrder(o).forEach(function (c, i) { put(map, c, i); });
    return map;
  }

  /* 사업 code 를 targetCode 의 앞(after 거짓) 또는 뒤(after 참)로 옮긴 «새 전체 순서» 코드 배열. 보이는 사업이 아니거나 같거나 결과가 현재와 같으면 null */
  function reorder(o, code, targetCode, after) {
    var cur = fullOrder(o);
    if (typeof code !== 'string' || typeof targetCode !== 'string' || code === targetCode) return null;
    if (cur.indexOf(code) < 0 || cur.indexOf(targetCode) < 0) return null;
    var next = cur.filter(function (c) { return c !== code; });
    var at = next.indexOf(targetCode) + (after ? 1 : 0);
    next.splice(at, 0, code);
    var same = next.length === cur.length && next.every(function (c, i) { return c === cur[i]; });
    return same ? null : next;
  }

  /* 저장할 기록 한 줄 { list:'A,B', by?, at } — 규칙이 받아들이는 모양만 만든다. 목록이 이상하거나 비면·now 가 숫자가 아니면 null (by 가 비면 칸을 두지 않는다) */
  function orderEntry(list, by, now) {
    if (!Array.isArray(list) || !list.length || list.length > ORDER_MAX) return null;
    if (typeof now !== 'number' || !isFinite(now)) return null;
    var seen = new Set();
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if (!isCode(c) || seen.has(c)) return null;
      seen.add(c);
    }
    var joined = list.join(',');
    if (joined.length > ORDER_LEN_MAX) return null;
    var out = { list: joined };
    var who = str(by).slice(0, BY_MAX);
    if (who) out.by = who;
    out.at = now;
    return out;
  }

  /* 왼쪽 목록 모델. 항목 = { code, name, agency, label, kind, plan, typeId, count, closedFrom }
     종결 → closed(count 보존·total 제외) · 연결 없음 → unlinked · 업체 있음 → open · 업체 없음 + 서류 틀 없음 → noPlan · 그 밖 → quiet
     각 묶음은 사업 순서(rankMap — o.order 가 있으면 그 순서가 먼저, 나머지 이알피 순서)로 정렬한다. 진행 사업도 업체 수로 정렬하지 않는다 */
  function build(o) {
    o = o || {};
    var out = { open: [], quiet: [], noPlan: [], unlinked: [], closed: [], total: 0 };
    var types = (o.input || {}).types;
    var rank = rankMap({ biz: o.biz, order: o.order });
    function byRank(a, b) { return rank[a.code] - rank[b.code]; }
    Docs.visibleTypes(o.biz).forEach(function (t) {
      var p = Docs.planFor(t.name), id = Docs.linkOf(t.code, o.tmap, types);
      var closed = closedFor(o.state, t.code, o.year);
      var item = { code: t.code, name: t.name, agency: t.agency, label: label(t), kind: p.kind, plan: p.key, typeId: id,
        count: id ? Docs.pairs(o.input, id, o.year).length : 0, closedFrom: closed ? o.state[t.code].closedFrom : '', sortOrder: t.sortOrder };
      if (closed) out.closed.push(item);
      else if (!id) out.unlinked.push(item);
      else if (item.count > 0) out.open.push(item);
      else if (p.key === Docs.NONE.key) out.noPlan.push(item);
      else out.quiet.push(item);
    });
    ['open', 'quiet', 'noPlan', 'unlinked', 'closed'].forEach(function (k) { out[k].sort(byRank); });
    out.open.forEach(function (x) { out.total += x.count; });
    [out.open, out.quiet, out.noPlan, out.unlinked, out.closed].forEach(function (a) { a.forEach(function (x) { delete x.sortOrder; }); });
    return out;
  }

  /* 종결로 판정된 사업이 이어진 정부사업일정 사업 종류 id → {typeId:1} (화면이 숫자·알림에서 거를 때) */
  function closedTypeIds(o) {
    o = o || {};
    var out = {}, types = (o.input || {}).types;
    Docs.visibleTypes(o.biz).forEach(function (t) {
      if (!closedFor(o.state, t.code, o.year)) return;
      var id = Docs.linkOf(t.code, o.tmap, types);
      if (id) out[id] = 1;
    });
    return out;
  }

  var api = { REASONS: REASONS, REASON_MAX: REASON_MAX, ALL_FROM: ALL_FROM, NEVER_FROM: NEVER_FROM, NO_AGENCY: NO_AGENCY,
    ORDER_MAX: ORDER_MAX, ORDER_LEN_MAX: ORDER_LEN_MAX, ORDER_NODE_KEY: ORDER_NODE_KEY,
    label: label, closedFor: closedFor, isReopened: isReopened, closeEntry: closeEntry, build: build, closedTypeIds: closedTypeIds,
    parseOrder: parseOrder, rankMap: rankMap, reorder: reorder, orderEntry: orderEntry };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PuGovReportNav = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
