'use strict';
/* 컨설팅보고서 앱(gov-report.html) — 왼쪽 사업 목록 모델·사업 종결 판정의 순수 함수 (브라우저 window.PuGovReportNav / Node 겸용)
   (대표 지시 2026-10-12 「섞어서 진행」·「연도별로, 사업이름 중심 ()에 수행기관」·「종결된 것은 종결 사업으로 뺄 수 있게」
    · 계획 docs/superpowers/plans/2026-10-12-gov-report-nav-closed.md · UI 재정리 1단계)
   무엇을 지키나
     · 읽기만 한다 — 받은 값으로 목록 모델을 만들 뿐 아무 데도 쓰지 않고 받은 값을 바꾸지 않는다.
     · 사업 한 줄 = «사업 이름 (수행기관)». 기관이 비면 「기관 미지정」. 이름이 같고 기관만 다른 사업은 label.text 로 구분된다.
     · 종결 표시는 scal_bizState/{사업 코드} = { closedFrom:'YYYY', closedAt?, reason?, by?, at }. 사업이 «종결» 인 해 = 고른 해 >= closedFrom.
       closedFrom 은 정확히 4자리 숫자 문자열이고, 문자열끼리 견준다(연도 숫자 인자도 String 으로). 「사업 전체」 = ALL_FROM('2000').
       상태 객체는 «자기 소유 속성»만 읽는다(__proto__·constructor·toString 같은 이름·프로토타입 쪽 값은 종결이 아니다).
     · 종결 사업도 목록(closed 묶음)에는 남고 실제 업체 수(count)를 그대로 담는다 — 단, 숫자 합계(total)에는 들어가지 않는다.
     · 묶음 정하는 차례는 PuGovReportDocs.sidebarGroups 와 같은 조건(visibleTypes·linkOf·pairs·planFor)을 그대로 호출한다 — 거기를 고치지 않는다.
   ⚠ 규칙(scripts/make-firebase-rules.js 의 scal_bizState)과 같은 모양이어야 한다: closedFrom ^[0-9]{4}$ · closedAt YYYY-MM-DD · reason·by ≤ 40자
     (REASON_MAX = 40). 한쪽만 바꾸면 화면이 만든 기록을 규칙이 거절한다.
   ⚠ 저장소는 공개다 — 검사는 합성 자료만 쓴다. */
(function (root) {
  var Docs = (typeof module !== 'undefined' && module.exports) ? require('./pu-gov-report-docs.js') : root.PuGovReportDocs;
  var REASONS = ['사업 기간 끝남', '이번 연도 수행 안 함', '계약 종료', '기타'];
  var REASON_MAX = 40;
  var BY_MAX = 40;
  var ALL_FROM = '2000';
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

  /* 왼쪽 목록 모델. 항목 = { code, name, agency, label, kind, plan, typeId, count, closedFrom }
     종결 → closed(count 보존·total 제외) · 연결 없음 → unlinked · 업체 있음 → open · 업체 없음 + 서류 틀 없음 → noPlan · 그 밖 → quiet */
  function build(o) {
    o = o || {};
    var out = { open: [], quiet: [], noPlan: [], unlinked: [], closed: [], total: 0 };
    var types = (o.input || {}).types;
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
    out.open.sort(function (a, b) { return (b.count - a.count) || byOrder(a, b); });
    ['quiet', 'noPlan', 'unlinked', 'closed'].forEach(function (k) { out[k].sort(byOrder); });
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

  var api = { REASONS: REASONS, REASON_MAX: REASON_MAX, ALL_FROM: ALL_FROM, NO_AGENCY: NO_AGENCY,
    label: label, closedFor: closedFor, closeEntry: closeEntry, build: build, closedTypeIds: closedTypeIds };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PuGovReportNav = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
