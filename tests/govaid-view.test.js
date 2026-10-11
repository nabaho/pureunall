/* 정부지원금 화면 묶음 — 예비 고객 접기 · 지운 것 빼기 · 표 열 숨기기 (2026-10-11) */
const test = require('node:test');
const assert = require('node:assert/strict');
const V = require('../js/pu-govaid-view.js');

const Y = 2026;
const P1 = { id: 'gp-a', name: '가 사업', status: 'confirmed', baseYear: Y, cond: { headcount: { min: 5 } } };
const P2 = { id: 'gp-b', name: '나 사업', status: 'confirmed', baseYear: Y, cond: { regions: ['제주'] } };
const P3 = { id: 'gp-c', name: '다 사업', status: 'draft', cond: {} };
const COS = { v: [
  { id: 'c1', name: '(예시)가나다', bizNo: '111-11-11111', address: '충남 천안시', status: 'active' },
  { id: 'c2', name: '(예시)끝난곳', bizNo: '222-22-22222', status: 'terminated' },
  { id: 'c3', name: '(예시)지운곳', _deleted: true },
] };
const PUB = { 1111111111: { nps: { now: { ym: '202609', cnt: 12 } } } };

test('봉투를 벗기고, 지운 것·끝난 업체는 뺀다', () => {
  assert.deepEqual(V.companies(COS).map((c) => c.id), ['c1']);
  assert.deepEqual(V.programs({ a: P1, b: Object.assign({}, P2, { _deleted: true }) }).map((p) => p.id), ['gp-a']);
});

test('업체와 이어진 예비 고객은 목록에 따로 안 나오고 업체 쪽 별칭이 된다', () => {
  const prs = { p1: { id: 'p1', name: '(예시)예비', companyLinkStatus: 'linked', companyId: 'c1' },
                p2: { id: 'p2', name: '(예시)새손님', companyLinkStatus: 'pending' } };
  const s = V.subjects(COS, prs, PUB, {});
  assert.deepEqual(s.map((x) => x.key).sort(), ['co_c1', 'pr_p2']);
  assert.deepEqual(s.find((x) => x.key === 'co_c1').aliases, ['pr_p1']);
  assert.equal(s.find((x) => x.key === 'co_c1').vals.headcount.v, 12, '사업자번호로 공공데이터를 붙인다');
});

test('검토는 업체 열쇠 먼저, 없으면 이어진 예비 고객 때의 검토 — 지운 검토는 없는 셈', () => {
  const pf = { key: 'co_c1', aliases: ['pr_p1'] };
  const rv = { pr_p1: { 'gp-a': { decision: 'hold' } }, co_c1: { 'gp-b': { decision: 'yes', _deleted: true } } };
  assert.equal(V.reviewOf(rv, pf, 'gp-a').decision, 'hold');
  assert.equal(V.reviewOf(rv, pf, 'gp-b'), null);
});

test('회사 하나 — 사업을 판정 묶음으로 가른다', () => {
  const pf = V.subjects(COS, {}, PUB, {})[0];
  const g = V.forSubject(pf, [P1, P2, P3], Y);
  assert.deepEqual(g.candidate.map((x) => x.program.id), ['gp-a']);
  assert.deepEqual(g.no.map((x) => x.program.id), ['gp-b']);
  assert.deepEqual(g.unconfirmed.map((x) => x.program.id), ['gp-c']);
});

test('한눈 표 — 후보·정보 부족이 하나도 없는 사업 열은 숨긴다', () => {
  const s = V.subjects(COS, {}, PUB, {});
  const g = V.grid(s, [P1, P2, P3], Y);
  assert.deepEqual(g.cols.map((p) => p.id), ['gp-a']);
  assert.equal(g.rows[0].candidates, 1);
});

test('사업 하나 — 후보·정보 부족 회사와 안 맞음 수', () => {
  const s = V.subjects(COS, { p2: { id: 'p2', name: '(예시)새손님' } }, PUB, {});
  const g = V.forProgram(P1, s, Y);
  assert.deepEqual(g.candidate.map((x) => x.profile.key), ['co_c1']);
  assert.deepEqual(g.unknown.map((x) => x.profile.key), ['pr_p2']);
  assert.equal(g.no, 0);
});

test('검토 기록에 남길 «그때의 판정»', () => {
  const snap = V.snapshot({ verdict: 'candidate', items: [{ key: 'headcount', label: '근로자 5명 이상', state: 'ok', extra: 1 }] });
  assert.deepEqual(snap, { verdict: 'candidate', items: [{ key: 'headcount', label: '근로자 5명 이상', state: 'ok' }] });
});

test('확인할 조건 — 초안이거나 지난해 확정이면 확인 필요', () => {
  assert.equal(V.needsCheck(P1, Y), false);
  assert.equal(V.needsCheck(P3, Y), true);
  assert.equal(V.needsCheck(Object.assign({}, P1, { baseYear: Y - 1 }), Y), true);
});
