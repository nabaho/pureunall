'use strict';
/* 회사를 «사업자번호»로 알아본다 (대표 결정 2026-09-18 · 목업 ㉠㉡ 승인 2026-09-21)
   ═══════════════════════════════════════════════════════════════════════════
   ■ 무엇이 막혀 있었나
     계약이 든 사업자번호 81개 가운데 업체관리에 있는 것이 **0개**였다(2026-09-18 실측).
     컨설팅 사업장을 업체관리에 일부러 안 넣기로 했기 때문이다.
     그래서 번호가 또렷이 적혀 있어도 **관계가 0개**였고, 관계망을 켜면 계약 160건 중
     50건만 들어가면서 화면은 「다 봤다」고 말하게 되어 있었다.

   ■ 여기서 못 박는 것
     ① 번호가 업체관리에 있으면 «그 업체»가 이 번호의 얼굴이다 — 새 회사를 만들지 않는다
     ② 업체관리에 없으면 «번호 자체»가 회사다 — 계약·컨설팅·기업정보함이 한 곳에 모인다
     ③ 번호로 찾은 것은 1.0 이다 (이름으로 찾은 것은 0.85 그대로 — 색인에 안 담긴다)
     ④ 같은 번호가 둘 이상이면 «안 잇는다» — 이름으로 물러서지도 않는다
     ⑤ 10자리가 아닌 번호는 안 쓴다
     ⑥ 번호로 만든 회사도 «개체»가 있다 — 없으면 관계가 색인에서 조용히 버려진다
     ⑦ 원본에는 한 글자도 안 쓴다

   실행: node --test tests/ontology-bizno-key.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const O = require('../js/pu-ontology.js');

/* 업체관리에는 셋만 있다 — 「마바물산」은 일부러 없다(컨설팅 사업장 흉내) */
function 원장(over) {
  return Object.assign({
    companies: [
      { id: 'co-1', name: '가나상사', bizNo: '111-11-11111' },
      { id: 'co-2', name: '다라산업', bizNo: '222-22-22222' },
      { id: 'co-3', name: '사아기업' }
    ],
    user_dir: [{ sid: 'P-001', name: '홍길동' }]
  }, over || {});
}
function 돌리기(data, sources) { return O.auditIntegrated(원장(data), sources || {}, { uid: 'u1' }); }
function 회사관계(r, 주체) {
  return r.edges.filter(function (e) {
    return decodeURIComponent(e.subject) === 주체 && e.object.indexOf('Organization:') === 0;
  }).map(function (e) { return { 상대: decodeURIComponent(e.object), 신뢰도: e.confidence }; });
}

/* ══════ ① 번호가 업체관리에 있으면 그 업체가 얼굴이다 ══════ */

test('★★ 번호가 업체관리에 있으면 «그 업체»로 잇는다 — 새 회사를 만들지 않는다', () => {
  const r = 돌리기({ contracts: [{ id: 'ct-1', bizNo: '222-22-22222', companyName: '다라산업' }] });
  const 관계 = 회사관계(r, 'Contract:ct-1');
  assert.equal(관계.length, 1, '계약이 회사에 안 붙었습니다.');
  assert.equal(관계[0].상대, 'Organization:co-2',
    '★ 번호로 새 회사를 만들었습니다 — 이미 이어져 있던 관계가 둘로 갈라집니다.');
});

test('★★★ 번호로 찾은 것은 «1.0» 이다 — 0.99 면 색인에서 통째로 빠진다', () => {
  const r = 돌리기({ contracts: [{ id: 'ct-1', bizNo: '222-22-22222', companyName: '다라산업' }] });
  assert.equal(회사관계(r, 'Contract:ct-1')[0].신뢰도, 1,
    '★ 번호로 찾았는데 1.0 이 아닙니다. 색인은 1.0 만 담으므로 0.01 차이로 전부 빠집니다.');
});

/* ══════ ② 업체관리에 없으면 번호 자체가 회사다 ══════ */

test('★★★ 업체관리에 «없는» 회사도 번호로 이어진다 — 계약 81건이 여기 걸려 있었다', () => {
  const r = 돌리기({ contracts: [{ id: 'ct-1', bizNo: '333-33-33333', companyName: '마바물산' }] });
  const 관계 = 회사관계(r, 'Contract:ct-1');
  assert.equal(관계.length, 1,
    '★ 업체관리에 없다고 관계를 안 만듭니다 — 컨설팅 사업장이 통째로 끊깁니다.');
  assert.match(관계[0].상대, /^Organization:biz:3333333333$/, '번호가 회사 열쇠가 아닙니다.');
  assert.equal(관계[0].신뢰도, 1, '번호로 이었는데 1.0 이 아닙니다.');
});

test('★★★ 계약과 컨설팅이 «같은 회사»로 모인다 — 번호가 같으면 한 회사다', () => {
  const r = 돌리기({
    contracts: [{ id: 'ct-1', bizNo: '333-33-33333', companyName: '마바물산' }],
    consultings: [{ id: 'cn-1', bizNo: '333-33-33333', companyName: '마바물산' }]
  });
  const a = 회사관계(r, 'Contract:ct-1'), b = 회사관계(r, 'Project:cn-1');
  assert.equal(a.length, 1); assert.equal(b.length, 1);
  assert.equal(a[0].상대, b[0].상대,
    '★ 같은 번호인데 다른 회사에 붙었습니다 — 「회사 한 장」이 두 장이 됩니다.');
});

test('★★★ 번호로 만든 회사도 «개체»가 있다 — 없으면 색인이 조용히 버린다', () => {
  const r = 돌리기({ contracts: [{ id: 'ct-1', bizNo: '333-33-33333', companyName: '마바물산' }] });
  const snap = O.buildSnapshot(r, {});
  assert.equal(snap.meta.danglingEdges, 0,
    '★ 개체 없는 회사에 이었습니다 — 그 관계는 색인에서 말없이 사라집니다.');
  assert.ok(snap.meta.confirmedEdges >= 1, '색인에 담긴 관계가 없습니다.');
});

/* ══════ ③ 기업정보함도 같은 회사에 모인다 ══════ */

test('★★ 기업정보함 서류가 «같은 번호»의 회사에 붙는다 — 열쇠가 이미 번호다', () => {
  const r = 돌리기(
    { contracts: [{ id: 'ct-1', bizNo: '333-33-33333', companyName: '마바물산' }] },
    { cards_coinfo: { ok: true, value: {
      '3333333333': { company: '마바물산', docs: { d1: { kind: 'bizreg', docName: '사업자등록증' } } }
    } } });
  const 계약 = 회사관계(r, 'Contract:ct-1');
  const 서류 = r.edges.filter(function (e) {
    return e.predicate === 'forOrganization' && decodeURIComponent(e.subject).indexOf('Document') === 0;
  });
  assert.equal(서류.length, 1, '★ 기업정보함 서류가 회사에 안 붙었습니다.');
  assert.equal(decodeURIComponent(서류[0].object), 계약[0].상대,
    '★ 계약과 서류가 다른 회사에 붙었습니다 — 한 회사가 둘로 보입니다.');
  assert.equal(서류[0].confidence, 1, '번호로 이었는데 1.0 이 아닙니다.');
});

/* ══════ ④ 안 이어야 할 자리 ══════ */

test('★★★ 같은 번호가 둘 이상이면 «안 잇는다» — 이름으로 물러서지도 않는다', () => {
  /* ⚠ 예시 번호는 «123-» 으로 시작해야 한다 — tests/no-real-client-data.test.js 가 막는다.
     그 밖의 번호는 국세청에 치면 실제 사업장이 나올 수 있다. */
  const r = O.auditIntegrated({
    companies: [
      { id: 'co-a', name: '가나상사', bizNo: '123-45-67890' },
      { id: 'co-b', name: '가나상사', bizNo: '123-45-67890' }
    ],
    contracts: [{ id: 'ct-1', bizNo: '123-45-67890', companyName: '가나상사' }]
  }, {}, { uid: 'u1' });
  assert.deepEqual(회사관계(r, 'Contract:ct-1'), [],
    '★ 같은 번호를 가진 업체가 둘인데 이었습니다 — 어느 쪽인지 사람이 먼저 정해야 합니다.');
  assert.ok(r.issues.some(function (x) { return x.code === 'duplicate_business_number' && x.id === 'ct-1'; }),
    '잇지 않았으면 «왜 안 이었는지»를 남겨야 합니다 — 조용히 빠지면 아무도 모릅니다.');
});

test('★★ 이름만 같은 것은 «0.85» 그대로다 — 관계망 색인에 안 담긴다', () => {
  const r = 돌리기({ contracts: [{ id: 'ct-1', companyName: '사아기업' }] });
  const 관계 = 회사관계(r, 'Contract:ct-1');
  assert.equal(관계.length, 1, '이름 후보까지 없애면 화면에서 고칠 단서가 사라집니다.');
  assert.equal(관계[0].신뢰도, 0.85,
    '★ 이름으로 찾은 것을 1.0 으로 올렸습니다 — 이름만 같은 다른 회사가 섞입니다.');
  const snap = O.buildSnapshot(r, {});
  assert.ok(snap.meta.excludedCandidates >= 1, '0.85 가 색인에 담겼습니다.');
});

test('★★ 10자리가 아닌 번호는 «안 쓴다» — 잘못 적힌 번호로 남의 회사에 붙이지 않는다', () => {
  ['333-33-3333', '3333', '', '33333333333'].forEach(function (bad) {
    const r = 돌리기({ contracts: [{ id: 'ct-1', bizNo: bad, companyName: '없는회사' }] });
    assert.deepEqual(회사관계(r, 'Contract:ct-1'), [],
      '★ 「' + bad + '」 로 회사를 이었습니다 — 10자리가 아닌 것은 사업자번호가 아닙니다.');
  });
});

/* ══════ ⑤ 원본은 안 건드린다 ══════ */

test('★★ 원본을 한 글자도 안 바꾼다 — 읽기 전용이다', () => {
  const data = 원장({ contracts: [{ id: 'ct-1', bizNo: '333-33-33333', companyName: '마바물산' }] });
  const 처음 = JSON.stringify(data);
  const r = O.auditIntegrated(data, {}, { uid: 'u1' });
  assert.equal(JSON.stringify(data), 처음, '★ 진단이 원본을 고쳤습니다.');
  assert.equal(r.readOnly, true, '읽기 전용 표시가 사라졌습니다.');
});
