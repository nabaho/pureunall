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
  /* 지역 공고의 시·도·시·군 → 사업 조건(2026-10-31 3단계). 전국 공고면 빈 조건 */
  function areaCond(a) {
    var s = list((a || {}).sido), g = list((a || {}).sgg), c = {};
    if (s.length) c.regions = s.map(String);
    if (s.length && g.length) c.sigungu = g.map(String);
    return c;
  }
  function programFromNotice(n, year) {
    n = n || {};
    var ag = [n.ntce, n.inst].map(function (x) { return x == null ? '' : String(x).trim(); }).filter(Boolean)
      .filter(function (x, i, a) { return a.indexOf(x) === i; }).join(' · ');
    return { id: 'gp-b' + n.id, name: String(n.nm || '').slice(0, 200), agency: ag, fields: n.field ? [String(n.field)] : [],
      summary: String(n.memo || '').slice(0, 600), status: 'draft', baseYear: year, cond: areaCond(n.area),
      source: { title: String(n.nm || '').slice(0, 200), no: String(n.no || ''), page: '', url: /^https:\/\//.test(n.url || '') ? n.url : '' },
      bizinfo: [String(n.no || n.id)] };
  }

  /* ★ 노무사 직접 사업 (대표 지시 2026-10-13 「공인노무사가 직접 할 수 있는 사업은 별표시 … 모든 영역에서」).
     법인 전체가 같은 별을 본다(사람마다 따로가 아니다). 끈 것도 {on:false} 로 남긴다 — 정기 조사·초기 표시가 다시 켜지 않게 */
  function starred(prev, known, on, why, actor, now) {
    var b = base(prev, known), cur = b.star || {};
    return Object.assign(b, { id: b.id, star: { on: !!on, why: (why || cur.why || ''), by: actor, at: now } });
  }

  /* 4단계 연계 (대표 2026-11-01 시안 → 「추천대로」)
     «신청 대행»만 업무관리 할 일 한 줄. «안내만»은 검토 칸의 told 로만 남는다(업무관리 진행중이 쌓이지 않게).
     결과(선정·탈락)도 검토 칸 — 금액은 적지 않는다. */
  function safe(s) { return String(s == null ? '' : s).replace(/[.#$\[\]\/]/g, '_'); }
  /* 같은 회사×사업은 언제나 같은 id — 두 번 눌러도 업무관리에 한 줄 */
  function workKey(key, pid) { return 'GA-' + safe(key) + '-' + safe(pid); }
  function workItem(o) {
    o = o || {};
    var s = o.subject || {}, t = o.target || {}, m = o.mgr || {}, title = String(t.name || t.short || '').trim();
    var rec = { id: workKey(s.key, t.id), no: o.year + '-지원-' + safe(t.short || title).slice(0, 12), cat: '지원',
      company: String(s.name || ''), co_id: s.kind === 'co' ? String(s.id || '') : '',
      title: (title + ' — 신청 대행').slice(0, 200), status: '진행중', start: o.today || '', due: o.due || '',
      brief: [String(o.note || '').trim(), '🎯 정부지원금에서 넘김'].filter(Boolean).join(' · ').slice(0, 300),
      mgr_main: { sid: String(m.sid || ''), name: String(m.name || '') }, mgr_subs: [],
      src: 'govaid', ga: { key: String(s.key || ''), pid: String(t.id || '') }, created_at: o.nowIso || '' };
    if (s.kind === 'co' && s.id) rec.companyId = String(s.id);
    if (!m.sid) rec.pe_nomgr = true;
    return rec;
  }
  var TOLD_HOW = ['메일', '카톡', '전화', '방문'], RESULTS = ['selected', 'rejected'];
  /* 검토 칸에 진행(work·told·result)을 얹는다 — 결정·사유·검토한 사람은 그대로. null 이면 그 칸을 비운다 */
  function reviewPatched(prev, subject, pid, patch, actor, now, opt) {
    patch = patch || {}; opt = opt || {}; subject = subject || {};
    if (patch.told && TOLD_HOW.indexOf(patch.told.how) < 0) throw new Error('안내한 방법을 고르세요: ' + TOLD_HOW.join('·'));
    if (patch.result && RESULTS.indexOf(patch.result.v) < 0) throw new Error('결과는 선정·탈락만 적습니다');
    var b = Object.assign({}, prev || {}, { id: subject.key + '__' + pid, entityType: 'EligibilityReview', subjectKey: subject.key, programId: pid });
    if (subject.kind === 'co') b.companyId = subject.id; else { b.sourceKind = 'govaidProspect'; b.sourceId = subject.id; }
    if (opt.targetKind) b.targetKind = opt.targetKind;
    if (opt.targetName) b.targetName = String(opt.targetName).slice(0, 200);
    ['work', 'told', 'result'].forEach(function (k) {
      if (!(k in patch)) return;
      b[k] = patch[k] ? Object.assign({}, patch[k], { by: actor, at: patch[k].at || now }) : null;
    });
    if (patch.case) b.case = casePatched(b.case, patch.case, actor, now);
    return b;
  }

  /* 신청 대행 «진행 카드»(대표 지시 2026-11-01 「필요서류 … 신청후 승인날경우 지원금 받는것 까지 한번에」 → 「추천대로」).
     case = { docs:{d0…(사업 사전 서류 차례)·x…(더한 서류): {st, memo, label?}}, appliedAt, approvedAt, payN, pays:{1:{due, appliedAt, paidAt}}, keepUntil }
     ⚠ 서류 파일은 여기 두지 않는다(메일·사진첩 서고) — 상태·메모만. ⚠ 금액은 여기 적지 않는다 — 전 직원이 읽는 칸이다(govaid_money 는 관리자·재무만).
     칸별로 덧붙인다 — 한 서류·한 회차를 고쳐도 다른 서류·회차는 그대로. 빈 글자는 그 칸을 지운다 */
  var DOC_ST = ['', 'asked', 'got', 'ok', 'fix'], DATE = /^\d{4}-\d{2}-\d{2}$/;
  function day(v, what) {
    var t = v == null ? '' : String(v).trim();
    if (t && !DATE.test(t)) throw new Error(what + ' 날짜는 YYYY-MM-DD 꼴로 적습니다: ' + t);
    return t;
  }
  function put(o, k, v) { if (v === '' || v == null) delete o[k]; else o[k] = v; }
  function casePatched(prev, p, actor, now) {
    var c = JSON.parse(JSON.stringify(prev || {}));
    Object.keys(p.docs || {}).forEach(function (id) {
      if (!/^[dx]\d{1,3}$/.test(id)) throw new Error('서류 번호가 맞지 않습니다: ' + id);
      var x = p.docs[id], d = Object.assign({}, (c.docs || {})[id] || {});
      if (x === null) { if (c.docs) delete c.docs[id]; return; }
      if ('st' in x) { if (DOC_ST.indexOf(x.st || '') < 0) throw new Error('서류 상태는 요청함·받음·검토 끝·보완 필요만 적습니다'); put(d, 'st', x.st); }
      if ('memo' in x) put(d, 'memo', String(x.memo || '').trim().slice(0, 300));
      if ('label' in x) put(d, 'label', String(x.label || '').trim().slice(0, 120));
      c.docs = c.docs || {}; c.docs[id] = d;
    });
    ['appliedAt', 'approvedAt', 'keepUntil'].forEach(function (k) { if (k in p) put(c, k, day(p[k], k === 'keepUntil' ? '고용 유지 끝나는' : k === 'appliedAt' ? '신청한' : '승인')); });
    if ('payN' in p) { var n = Number(p.payN); if (!(n >= 1 && n <= 12 && Math.floor(n) === n)) throw new Error('지급 회차는 1~12 사이로 적습니다'); c.payN = n; }
    Object.keys(p.pays || {}).forEach(function (n) {
      if (!/^\d{1,2}$/.test(n)) throw new Error('지급 회차 번호가 맞지 않습니다: ' + n);
      var x = p.pays[n] || {}, r = Object.assign({}, (c.pays || {})[n] || {});
      Object.keys(x).forEach(function (k) {
        if (['due', 'appliedAt', 'paidAt'].indexOf(k) < 0) throw new Error(k === 'amount' ? '금액은 이 칸에 적지 않습니다(관리자·재무만 보는 자리에)' : '모르는 칸: ' + k);
        put(r, k, day(x[k], n + '회차'));
      });
      c.pays = c.pays || {}; c.pays[n] = r;
    });
    c.by = actor; c.at = now;
    return c;
  }
  /* 받은 금액 — govaid_money/{회사 열쇠}/{사업 id} (관리자·재무만 읽고 쓴다). 회차별 원 단위 정수, 빈 값은 지운다 */
  function moneyPatched(prev, subject, pid, n, amount, actor, now) {
    subject = subject || {};
    var b = Object.assign({}, prev || {}, { id: subject.key + '__' + pid, entityType: 'EligibilityReview', subjectKey: subject.key, programId: pid });
    if (subject.kind === 'co') b.companyId = subject.id; else { b.sourceKind = 'govaidProspect'; b.sourceId = subject.id; }
    if (!/^\d{1,2}$/.test(String(n))) throw new Error('지급 회차 번호가 맞지 않습니다');
    var pays = JSON.parse(JSON.stringify(b.pays || {}));
    if (amount === null || amount === '' || amount === undefined) delete pays[n];
    else {
      var a = Number(amount);
      if (!(a >= 0 && Math.floor(a) === a && a < 1e11)) throw new Error('금액은 0 이상의 원 단위 숫자로 적습니다');
      pays[n] = { amount: a, by: actor, at: now };
    }
    b.pays = pays;
    return b;
  }

  return { softDeleted: softDeleted, confirmed: confirmed, carryToCompany: carryToCompany, starred: starred,
    noticeLinked: noticeLinked, noticeDecided: noticeDecided, programFromNotice: programFromNotice,
    workKey: workKey, workItem: workItem, reviewPatched: reviewPatched, moneyPatched: moneyPatched, TOLD_HOW: TOLD_HOW, DOC_ST: DOC_ST };
});
