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
