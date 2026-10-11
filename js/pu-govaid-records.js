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

  return { softDeleted: softDeleted, confirmed: confirmed, carryToCompany: carryToCompany };
});
