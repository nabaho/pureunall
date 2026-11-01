/* 기업정부지원금 — 신청 대행 «진행 카드» (대표 지시 2026-11-01 「필요서류등을 검토하고 진행 … 신청후 승인날경우 지원금 받는것 까지 어떻게 한번에」
   → 시안 → 「추천대로」: 서류 파일은 메일·사진첩에, 여기엔 상태·메모만 · 금액은 관리자(재무)만 · 수수료 청구는 이번에 안 함) */
const test = require('node:test');
const assert = require('node:assert/strict');
const W = require('../js/pu-ontology-write.js');
const R = require('../js/pu-govaid-records.js');
const V = require('../js/pu-govaid-view.js');

const NOW = 1790000000000;
const CO = { key: 'co_c1', kind: 'co', id: 'c1', name: '가나다정밀(주)' };
const PROG = { id: 'gp-1', name: '청년일자리도약장려금', docs: [{ key: 'contract', label: '근로계약서', stage: '신청' }, { key: 'rules', label: '취업규칙', stage: '신청' }, { key: 'bizReg', label: '사업자등록증', stage: '신청' }] };
const base = (c) => ({ id: 'co_c1__gp-1', decision: 'yes', work: { id: 'GA-co_c1-gp-1', due: '2026-11-10' }, case: c });

test('서류 목록 — 사업 사전의 서류가 저절로 들어오고, 사람이 더한 서류가 뒤에 붙는다 · ★ 노무 서류 표시', () => {
  const d = V.caseDocs(PROG, base({ docs: { d1: { st: 'fix', memo: '신고 안 됨' }, x1: { label: '청년 졸업증명서', st: 'asked' } } }));
  assert.deepEqual(d.map((x) => x.id), ['d0', 'd1', 'd2', 'x1']);
  assert.equal(d[0].labor, true, '근로계약서는 ★ 노무 서류');
  assert.equal(d[2].labor, false);
  assert.equal(d[1].st, 'fix');
  assert.equal(d[1].memo, '신고 안 됨');
  assert.equal(d[0].st, '', '아직 아무것도 안 한 서류');
  assert.equal(d[3].label, '청년 졸업증명서');
});

test('단계 — 서류 요청 → 검토 → 신청 → 심사 → 승인 → 지급 → 받음 → 사후관리', () => {
  const st = (c, extra) => V.caseStage(Object.assign(base(c), extra || {}), PROG).n;
  assert.equal(st(null), 1, '아무것도 안 했으면 ① 서류 요청');
  assert.equal(st({ docs: { d0: { st: 'got' } } }), 2, '하나라도 받았으면 ② 서류 검토');
  assert.equal(st({ docs: { d0: { st: 'ok' }, d1: { st: 'ok' }, d2: { st: 'ok' } } }), 3, '모두 검토 끝이면 ③ 신청');
  assert.equal(st({ docs: { d0: { st: 'ok' }, d1: { st: 'fix' }, d2: { st: 'ok' } } }), 2, '보완이 남아 있으면 아직 ② 검토');
  assert.equal(st({ appliedAt: '2026-11-05' }), 4, '신청했으면 ④ 심사');
  assert.equal(st({ appliedAt: '2026-11-05', approvedAt: '2026-12-01' }), 5, '승인 ⑤');
  assert.equal(st({ approvedAt: '2026-12-01', payN: 4, pays: { 1: { appliedAt: '2027-01-05' } } }), 6, '지급 신청 ⑥');
  assert.equal(st({ approvedAt: '2026-12-01', payN: 2, pays: { 1: { paidAt: '2027-02-01' } } }), 6, '아직 덜 받았으면 ⑥');
  assert.equal(st({ approvedAt: '2026-12-01', payN: 2, pays: { 1: { paidAt: '2027-02-01' }, 2: { paidAt: '2027-05-01' } } }), 7, '다 받으면 ⑦ 받음');
  assert.equal(st({ approvedAt: '2026-12-01', payN: 1, pays: { 1: { paidAt: '2027-02-01' } }, keepUntil: '2027-12-31' }), 8, '고용 유지 기간이 있으면 ⑧ 사후관리');
  assert.equal(V.caseStage(Object.assign(base({ appliedAt: '2026-11-05' }), { result: { v: 'rejected' } }), PROG).label, '탈락');
});

test('다음 할 일 — 보완 서류 이름 · 신청 마감 · 다음 회차 지급 신청 기한 · 고용 유지 끝', () => {
  const nx = (c) => V.caseNext(base(c), PROG);
  assert.match(nx({ docs: { d1: { st: 'fix' } } }).text, /보완.*취업규칙/);
  assert.equal(nx({ docs: { d0: { st: 'ok' }, d1: { st: 'ok' }, d2: { st: 'ok' } } }).due, '2026-11-10', '신청 차례면 마감은 공고 마감');
  const p = nx({ approvedAt: '2026-12-01', payN: 3, pays: { 1: { paidAt: '2027-02-01' }, 2: { due: '2027-04-30' } } });
  assert.match(p.text, /2회차 지급 신청/);
  assert.equal(p.due, '2027-04-30');
  const k = nx({ approvedAt: '2026-12-01', payN: 1, pays: { 1: { paidAt: '2027-02-01' } }, keepUntil: '2027-12-31' });
  assert.match(k.text, /고용 유지/);
  assert.equal(k.due, '2027-12-31');
});

test('진행 칸 저장 — 서류·회차는 칸별로 덧붙이고(다른 서류·회차는 그대로), 결정·업무관리 연결은 안 건드린다', () => {
  const prev = base({ docs: { d0: { st: 'ok', memo: '확인' }, d1: { st: 'got' } }, pays: { 1: { due: '2027-01-31' } }, payN: 2 });
  const out = R.reviewPatched(prev, CO, 'gp-1', { case: { docs: { d1: { st: 'fix', memo: '신고 안 됨' } }, pays: { 1: { appliedAt: '2027-01-10' } }, appliedAt: '2026-11-05' } }, 'A-001', NOW);
  assert.deepEqual(out.case.docs.d0, { st: 'ok', memo: '확인' }, '건드리지 않은 서류는 그대로');
  assert.equal(out.case.docs.d1.st, 'fix');
  assert.equal(out.case.docs.d1.memo, '신고 안 됨');
  assert.equal(out.case.pays['1'].due, '2027-01-31', '회차의 다른 칸은 그대로');
  assert.equal(out.case.pays['1'].appliedAt, '2027-01-10');
  assert.equal(out.case.payN, 2);
  assert.equal(out.case.appliedAt, '2026-11-05');
  assert.equal(out.case.by, 'A-001');
  assert.equal(out.decision, 'yes');
  assert.equal(out.work.id, 'GA-co_c1-gp-1');
});

test('진행 칸 저장 — 낱말·날짜 꼴이 아니면 막는다, 빈 글자는 그 칸을 지운다', () => {
  assert.throws(() => R.reviewPatched(base(null), CO, 'gp-1', { case: { docs: { d0: { st: '아무거나' } } } }, 'A', NOW), /서류/);
  assert.throws(() => R.reviewPatched(base(null), CO, 'gp-1', { case: { appliedAt: '11월 5일' } }, 'A', NOW), /날짜/);
  assert.throws(() => R.reviewPatched(base(null), CO, 'gp-1', { case: { payN: 40 } }, 'A', NOW), /회차/);
  assert.throws(() => R.reviewPatched(base(null), CO, 'gp-1', { case: { pays: { 1: { amount: 3000000 } } } }, 'A', NOW), /금액/, '금액은 이 칸(전 직원이 봄)에 못 적는다');
  const out = R.reviewPatched(base({ appliedAt: '2026-11-05' }), CO, 'gp-1', { case: { appliedAt: '' } }, 'A', NOW);
  assert.equal(out.case.appliedAt, undefined);
});

test('진행 칸을 얹은 검토가 강제 관문을 통과한다', () => {
  const r = R.reviewPatched(null, CO, 'gp-1', { case: { docs: { x1: { label: '졸업증명서', st: 'asked' } }, payN: 2 } }, 'A-001', NOW);
  const p = W.prepareRecord(r, { entityType: 'EligibilityReview', now: NOW, actor: 'A-001' });
  assert.equal(p.ok, true, JSON.stringify(p.issues));
});

test('금액 — 관리자·재무만 보는 자리(govaid_money)에 회차별로, 강제 관문 통과', () => {
  const m = R.moneyPatched(null, CO, 'gp-1', 2, 1500000, 'A-001', NOW);
  assert.equal(m.id, 'co_c1__gp-1');
  assert.equal(m.pays['2'].amount, 1500000);
  assert.equal(m.companyId, 'c1');
  const m2 = R.moneyPatched(m, CO, 'gp-1', 1, 900000, 'A-001', NOW);
  assert.equal(m2.pays['2'].amount, 1500000, '다른 회차는 그대로');
  assert.equal(R.moneyPatched(m2, CO, 'gp-1', 1, null, 'A', NOW).pays['1'], undefined, '빈 값은 그 회차 금액을 지운다');
  assert.throws(() => R.moneyPatched(null, CO, 'gp-1', 1, -5, 'A', NOW), /금액/);
  const p = W.prepareRecord(m, { entityType: 'EligibilityReview', now: NOW, actor: 'A-001' });
  assert.equal(p.ok, true, JSON.stringify(p.issues));
});
