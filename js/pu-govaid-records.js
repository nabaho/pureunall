/* pu-govaid-records.js — 정부지원금: 저장할 레코드를 만든다 (2026-10-11 최종 검토 뒤)
   ■ 순수 함수 — 읽기·쓰기·화면 없음. 화면은 gate.save(ref, function(prev){ return GovaidRecords.…(prev, …) }) 로 쓴다.
   ⚠★ 실제 RTDB 거래는 «찬 자리»에서 먼저 null 로 불린다. 그때 레코드가 아닌 것(undefined·id 없는 것)을
     돌려주면 서버에 묻지도 않고 접힌다(메모리 rtdb-transaction-cold-abort). 그래서 여기 함수는
     prev 가 null 이어도 «화면이 알던 레코드(known)»를 바탕으로 id 를 가진 레코드를 돌려준다.
     서버 값이 따로 있으면 거래가 그 값으로 다시 부르고, 그때는 prev 가 바탕이다.
   ⚠ 공용 gate.remove 를 쓰지 않는다 — 판 비교(expectedRevision)를 null 부름에서 해서 늘 «남이 고쳤다»로 접힌다. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GovaidRecords = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function blank(v) { return v == null || (typeof v === 'string' && v.trim() === ''); }
  function base(prev, known) { return Object.assign({}, prev || known || {}); }

  /* 지운 표식 — 물리 삭제 대신 _deleted 를 남긴다(규칙도 빈 값 쓰기를 막는다) */
  function softDeleted(prev, known, actor, now) {
    var b = base(prev, known);
    return Object.assign(b, { id: b.id, _deleted: true, deletedAt: now, deletedBy: actor });
  }

  /* 사업 확정(올해 기준) — 조건이 있는지는 부르는 쪽이 엔진(judge)으로 먼저 본다 */
  function confirmed(prev, known, year, actor, now) {
    var b = base(prev, known);
    return Object.assign(b, { id: b.id, status: 'confirmed', baseYear: year, confirmedAt: now, confirmedBy: actor });
  }

  /* 예비 고객을 업체와 이을 때 — 예비 고객 때 넣은 값을 업체 보충값의 «빈 칸에만» 옮긴다.
     ⚠ 지역·규모는 옮기지 않는다 — 업체관리 원장(주소·규모)이 있는데 예전에 손으로 넣은 값이 그것을 덮으면 안 된다.
     ⚠ 인원은 공공데이터(국민연금·고용보험) 인원이 없을 때만 옮긴다 — 있으면 그쪽이 더 새롭다. */
  function carryToCompany(coExtra, prospect, formVals, formFacts, opt) {
    coExtra = coExtra || {}; prospect = prospect || {}; formVals = formVals || {}; formFacts = formFacts || {}; opt = opt || {};
    var vals = Object.assign({}, coExtra.vals || {}), facts = Object.assign({}, coExtra.facts || {}), moved = [];
    var from = { foundedYear: prospect.foundedYear, industry: prospect.industry, salesDropPct: formVals.salesDropPct };
    if (!opt.hasAutoHeadcount) from.headcount = prospect.headcount;
    Object.keys(from).forEach(function (k) {
      if (blank(vals[k]) && !blank(from[k])) { vals[k] = from[k]; moved.push(k); }
    });
    Object.keys(formFacts).forEach(function (k) {
      if (typeof facts[k] !== 'boolean' && typeof formFacts[k] === 'boolean') { facts[k] = formFacts[k]; moved.push(k); }
    });
    return { vals: vals, facts: facts, moved: moved };
  }

  /* 📰 새 공고 (2026-10-12 「매년 … 자동 업데이트」) — 서버 govaidNoticeWatch 가 쌓은 기업마당 공고를 사람이 처리한다 */
  function list(v) { return Array.isArray(v) ? v.slice() : (v && typeof v === 'object' ? Object.keys(v).map(function (k) { return v[k]; }) : []); }
  /* 사업에 공고번호를 잇거나 푼다 — 이은 사업만 서버가 날마다 접수 상태를 맞춘다 */
  function noticeLinked(prev, known, no, add) {
    var b = base(prev, known), cur = list(b.bizinfo).filter(function (x) { return x != null && String(x) !== String(no); });
    if (add) cur.push(String(no));
    return Object.assign(b, { id: b.id, bizinfo: cur });
  }
  /* 사람의 처리 — 잇기(linked)·초안 만듦(drafted)·관계없음(ignore). 빈 값이면 처리를 지운다. 서버 칸은 손대지 않는다 */
  function noticeDecided(prev, known, decision, actor, now) {
    var b = base(prev, known);
    return Object.assign(b, { id: b.id, entityType: 'Document', docKind: 'govNotice',
      decision: decision || null, decidedBy: decision ? actor : null, decidedAt: decision ? now : null });
  }
  /* 사전에 없는 사업 — 공고로 초안을 만든다(조건·서류는 노무사가 채워 확정). id 는 공고번호에서 — 같은 공고로 두 번 만들지 않게 */
  function programFromNotice(n, year) {
    n = n || {};
    var ag = [n.ntce, n.inst].map(function (x) { return x == null ? '' : String(x).trim(); }).filter(Boolean)
      .filter(function (x, i, a) { return a.indexOf(x) === i; }).join(' · ');
    return { id: 'gp-b' + n.id, name: String(n.nm || '').slice(0, 200), agency: ag, fields: n.field ? [String(n.field)] : [],
      summary: String(n.memo || '').slice(0, 600), status: 'draft', baseYear: year, cond: {},
      source: { title: String(n.nm || '').slice(0, 200), no: String(n.no || ''), page: '', url: /^https:\/\//.test(n.url || '') ? n.url : '' },
      bizinfo: [String(n.no || n.id)] };
  }

  /* ★ 노무사 직접 사업 (대표 지시 2026-10-13 「공인노무사가 직접 할 수 있는 사업은 별표시 … 모든 영역에서」).
     법인 전체가 같은 별을 본다(사람마다 따로가 아니다). 끈 것도 {on:false} 로 남긴다 — 정기 조사·초기 표시가 다시 켜지 않게 */
  function starred(prev, known, on, why, actor, now) {
    var b = base(prev, known), cur = b.star || {};
    return Object.assign(b, { id: b.id, star: { on: !!on, why: (why || cur.why || ''), by: actor, at: now } });
  }

  return { softDeleted: softDeleted, confirmed: confirmed, carryToCompany: carryToCompany, starred: starred,
    noticeLinked: noticeLinked, noticeDecided: noticeDecided, programFromNotice: programFromNotice };
});
