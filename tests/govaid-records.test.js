/* 정부지원금 — 저장 레코드 만들기 (2026-10-11 최종 검토 뒤)
   ★ 실제 RTDB 거래는 «찬 자리»에서 먼저 null 로 불린다. 거기서 undefined 를 돌려주면
     서버에 묻지도 않고 접힌다(메모리 rtdb-transaction-cold-abort). 이 검사는 그 차례를 흉내 낸다:
     ① null 로 부름 → undefined 면 끝(실패) ② 값이 있으면 서버 값으로 다시 부름. */
const test = require('node:test');
const assert = require('node:assert/strict');
const W = require('../js/pu-ontology-write.js');
const R = require('../js/pu-govaid-records.js');

function coldRef(serverValue) {
  const ref = { saved: undefined };
  ref.transaction = function (fn) {
    let out = fn(null);
    if (out === undefined) return Promise.resolve({ committed: false });
    if (serverValue != null) { out = fn(JSON.parse(JSON.stringify(serverValue))); if (out === undefined) return Promise.resolve({ committed: false }); }
    ref.saved = out;
    return Promise.resolve({ committed: true });
  };
  return ref;
}
const NOW = 1790000000000;
const gate = W.createGateway({ mode: 'enforce', actor: 'A-001', now: () => NOW });
const SERVER = { id: 'gp-r47', entityType: 'SupportProgram', name: '정규직 전환 지원', status: 'draft',
  schemaVersion: 3, contractVersion: 1, createdAt: 1, updatedAt: 1, revision: 4 };

test('[왜 gate.remove 를 안 쓰나] 찬 자리 거래에서 공용 remove 는 서버에 묻지도 않고 접힌다', async () => {
  await assert.rejects(gate.remove(coldRef(SERVER), SERVER, { entityType: 'SupportProgram' }));
});

test('지운 표식 — 찬 자리(null)에서도 레코드를 돌려줘 서버 값으로 다시 불린다', async () => {
  const ref = coldRef(SERVER);
  await gate.save(ref, (prev) => R.softDeleted(prev, SERVER, 'A-001', NOW), { entityType: 'SupportProgram' });
  assert.equal(ref.saved._deleted, true);
  assert.equal(ref.saved.id, 'gp-r47');
  assert.equal(ref.saved.deletedBy, 'A-001');
  assert.equal(ref.saved.revision, 5, '서버 판 4 다음');
});

test('확정 — 찬 자리에서도 id 를 가진 레코드', async () => {
  const ref = coldRef(SERVER);
  await gate.save(ref, (prev) => R.confirmed(prev, SERVER, 2026, 'A-001', NOW), { entityType: 'SupportProgram' });
  assert.equal(ref.saved.status, 'confirmed');
  assert.equal(ref.saved.baseYear, 2026);
  assert.equal(ref.saved.confirmedBy, 'A-001');
  assert.equal(ref.saved.name, '정규직 전환 지원', '서버 값을 바탕으로');
});

test('예비 고객을 업체와 이을 때 — 업체 보충값의 빈 칸만 채우고, 무엇을 옮겼는지 돌려준다', () => {
  const coExtra = { vals: { foundedYear: 2010 }, facts: { retireAgePolicy: false } };
  const prospect = { foundedYear: 2015, industry: 'C', headcount: 12, region: '세종', size: '소기업' };
  const out = R.carryToCompany(coExtra, prospect, { salesDropPct: 20 }, { retireAgePolicy: true, hasFixedTerm: true }, { hasAutoHeadcount: false });
  assert.equal(out.vals.foundedYear, 2010, '업체에 이미 있는 값은 그대로');
  assert.equal(out.vals.industry, 'C');
  assert.equal(out.vals.salesDropPct, 20);
  assert.equal(out.vals.headcount, 12, '공공데이터 인원이 없을 때만 옮긴다');
  assert.equal(out.vals.region, undefined, '지역·규모는 업체관리 값이 있으니 옮기지 않는다');
  assert.equal(out.vals.size, undefined);
  assert.equal(out.facts.retireAgePolicy, false, '업체에 이미 있는 사실은 그대로');
  assert.equal(out.facts.hasFixedTerm, true);
  assert.deepEqual(out.moved.sort(), ['hasFixedTerm', 'headcount', 'industry', 'salesDropPct']);
  const withAuto = R.carryToCompany(null, prospect, {}, {}, { hasAutoHeadcount: true });
  assert.equal(withAuto.vals.headcount, undefined, '국민연금·고용보험 인원이 있으면 옛 입력으로 덮지 않는다');
});

/* 📰 새 공고 (2026-10-12) — 잇기·풀기·처리. 찬 자리(null) 부름에서도 id 를 가진 레코드를 돌려줘야 한다 */
test('공고 잇기 — 사업의 bizinfo 에 공고번호를 더하고(겹치지 않게), 풀면 뺀다', () => {
  const known = { id: 'gp-r12', name: '스마트공장', bizinfo: ['P0'] };
  const a = R.noticeLinked(null, known, 'P1', true);
  assert.equal(a.id, 'gp-r12', '찬 자리에서도 id');
  assert.deepEqual(a.bizinfo, ['P0', 'P1']);
  assert.deepEqual(R.noticeLinked(a, known, 'P1', true).bizinfo, ['P0', 'P1'], '두 번 이어도 하나');
  assert.deepEqual(R.noticeLinked(a, known, 'P1', false).bizinfo, ['P0']);
  assert.deepEqual(R.noticeLinked({ id: 'gp-r12', bizinfo: { 0: 'P0' } }, known, 'P2', true).bizinfo, ['P0', 'P2'], '파이어베이스가 배열을 객체로 줘도');
});
test('공고 처리 — 사람 칸(decision·decidedBy·decidedAt)만 바꾸고 서버 칸은 그대로, 풀면 처리를 지운다', () => {
  const known = { id: 'P1', no: 'P1', nm: '어느 공고', suggest: [{ id: 'gp-r12', score: 0.9 }], seenAt: 5 };
  const d = R.noticeDecided(null, known, 'ignore', 'A-001', 9);
  assert.equal(d.id, 'P1');
  assert.equal(d.entityType, 'Document');
  assert.equal(d.docKind, 'govNotice');
  assert.equal(d.decision, 'ignore');
  assert.equal(d.decidedBy, 'A-001');
  assert.equal(d.nm, '어느 공고', '서버 칸을 그대로 둔다');
  const u = R.noticeDecided(d, known, '', 'A-001', 10);
  assert.equal(u.decision, null, '처리 지우기');
});
test('공고 → 새 사업 초안 — 이름·기관·요약·원문·공고번호를 옮기고 조건은 비운 초안', () => {
  const n = { id: 'PBLN_1', no: 'PBLN_1', nm: '2026년 어느 지원사업 공고', ntce: '중소벤처기업부', inst: '어느 진흥원', memo: '요약', url: 'https://www.bizinfo.go.kr/a', field: '인력' };
  const p = R.programFromNotice(n, 2026);
  assert.equal(p.id, 'gp-b' + 'PBLN_1');
  assert.equal(p.status, 'draft');
  assert.equal(p.name, n.nm);
  assert.equal(p.agency, '중소벤처기업부 · 어느 진흥원');
  assert.deepEqual(p.bizinfo, ['PBLN_1']);
  assert.equal(p.source.url, n.url);
  assert.deepEqual(p.fields, ['인력']);
  assert.equal(p.baseYear, 2026);
});

/* ★ 노무사 직접 사업 (대표 지시 2026-10-13 「공인노무사가 직접 할 수 있는 사업은 별표시 … 모든 영역에서」) */
test('별표 — 켜고 끄는 사람·때·까닭을 남긴다(끈 것도 남겨 다시 켜지지 않게), 찬 자리에서도 id', () => {
  const known = { id: 'gp-r71', name: '청년도약' };
  const on = R.starred(null, known, true, '신청 대행', 'A-001', 5);
  assert.equal(on.id, 'gp-r71');
  assert.deepEqual(on.star, { on: true, why: '신청 대행', by: 'A-001', at: 5 });
  const off = R.starred(on, known, false, '', 'A-002', 6);
  assert.equal(off.star.on, false);
  assert.equal(off.star.by, 'A-002');
  assert.equal(off.star.why, '신청 대행', '끌 때 까닭을 비우면 앞 까닭을 둔다');
});

test('지역 공고 → 사전 초안 — 공고의 시·도·시·군을 조건으로 옮긴다', () => {
  const n = { id: 'P9', no: 'P9', nm: '[충남] 아산시 해외마케팅', area: { sido: ['충남'], sgg: ['아산시'] }, url: 'https://www.bizinfo.go.kr/a' };
  const p = R.programFromNotice(n, 2026);
  assert.deepEqual(p.cond.regions, ['충남']);
  assert.deepEqual(p.cond.sigungu, ['아산시']);
  assert.deepEqual(R.programFromNotice({ id: 'P8', nm: '전국 공고' }, 2026).cond, {}, '전국 공고는 조건 없음');
});
