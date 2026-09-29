'use strict';
// pu-erp 실적 동기화 순수 모듈 단위테스트 — 실행: node --test tests/kcareer-pusync.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const PS = require('../js/kcareer-pusync.js');

test('isClosed: closedDate 또는 종료 status만 종료다', () => {
  assert.equal(PS.isClosed({ closedDate: '2026-03-01' }), true);
  assert.equal(PS.isClosed({ status: 'closed' }), true);
  assert.equal(PS.isClosed({ status: 'done' }), true);
  assert.equal(PS.isClosed({ status: '완료' }), true);
  assert.equal(PS.isClosed({ status: '종료' }), true);
  assert.equal(PS.isClosed({ status: 'CLOSED' }), true);          // 대소문자 무시
});

test('isClosed: endDate만 있으면 미종료다 — 예정일일 수 있다', () => {
  assert.equal(PS.isClosed({ endDate: '2026-12-31' }), false);
  assert.equal(PS.isClosed({ status: 'active' }), false);
  assert.equal(PS.isClosed({ status: 'progress' }), false);
  assert.equal(PS.isClosed({ status: 'open', endDate: '2026-01-01' }), false);
  assert.equal(PS.isClosed({}), false);
  assert.equal(PS.isClosed(null), false);
});

const UMAP = { '2001': '권형하', '2003': '박한별' };

test('mapRecord: cases → case 스토어', () => {
  const r = PS.mapRecord('cases', '-Nx1', {
    caseType: '부당해고', companyName: '나루토건', title: '부당해고 구제신청',
    closedDate: '2026-03-15', managerMain: '2001'
  }, UMAP);
  assert.equal(r.store, 'case');
  assert.deepEqual(r.rec, {
    type: '부당해고', agency: '', org: '나루토건', project: '부당해고 구제신청',
    year: '2026', main: '권형하', status: '완료', puRef: 'cases/-Nx1'
  });
});

test('mapRecord: consultings → consult, funds → fund, other_projects → etc', () => {
  const c = PS.mapRecord('consultings', '-Nc1', {
    consultingType: '일터혁신', companyName: '열음폴리텍', programName: '임금체계 재설계',
    closedDate: '2025-11-30', workers: [{ sid: '2003', isPrimary: true }]
  }, UMAP);
  assert.equal(c.store, 'consult');
  assert.equal(c.rec.type, '일터혁신');
  assert.equal(c.rec.main, '박한별');            // workers의 isPrimary에서
  assert.equal(c.rec.puRef, 'consultings/-Nc1');

  const f = PS.mapRecord('funds', '-Nf1', {
    fundType: '사내근로복지기금', companyName: '소담', title: '설립 컨설팅',
    status: 'done', endDate: '2026-01-10', managerMain: '2001'
  }, UMAP);
  assert.equal(f.store, 'fund');
  assert.equal(f.rec.year, '2026');              // closedDate 없으면 endDate에서

  const e = PS.mapRecord('other_projects', '-No1', {
    programName: '재기컨설팅', companyName: '중진공', status: '완료', managerMain: '9999'
  }, UMAP);
  assert.equal(e.store, 'etc');
  assert.equal(e.rec.main, '9999');              // 변환표에 없으면 sid 그대로
  assert.equal(e.rec.year, '');                  // 날짜가 아예 없으면 빈 값
});

test('mapRecord: caseType이 비면 사건번호에서 유형·연도를 뽑는다', () => {
  // pu-erp 사건은 caseType이 비어 있고 진행중이라 종료일도 없다.
  // 그런데 사건번호에 둘 다 들어 있다 — 부해등-2026-003 → 유형 부해등, 연도 2026 (실사용)
  const r = PS.mapRecord('cases', 'k1', {
    companyName: '가나사회서비스원', caseNo: '부해등-2026-003', managerMain: '2001'
  }, UMAP);
  assert.equal(r.rec.type, '부해등');
  assert.equal(r.rec.year, '2026');
  assert.equal(r.rec.project, '부해등-2026-003');
  assert.equal(r.rec.main, '권형하');

  // 쉼표가 든 유형도 그대로 — 성,직괴-2026-001
  const r2 = PS.mapRecord('cases', 'k2', { companyName: '나비리아', caseNo: '성,직괴-2026-001' }, UMAP);
  assert.equal(r2.rec.type, '성,직괴');
  assert.equal(r2.rec.year, '2026');

  // caseType이 있으면 그것을 우선한다
  const r3 = PS.mapRecord('cases', 'k3', { caseType: '부당해고', caseNo: '부해등-2026-004' }, UMAP);
  assert.equal(r3.rec.type, '부당해고');

  // 종료일이 있으면 연도는 종료일에서 (사건번호보다 우선)
  const r4 = PS.mapRecord('cases', 'k4', { caseNo: '임금체불-2025-001', closedDate: '2026-03-15' }, UMAP);
  assert.equal(r4.rec.year, '2026');

  // 사건번호 형식이 아니면 유형은 비운다
  const r5 = PS.mapRecord('cases', 'k5', { companyName: 'A사', title: '윤성진아버지 유족사건' }, UMAP);
  assert.equal(r5.rec.type, '');
  assert.equal(r5.rec.project, '윤성진아버지 유족사건');
});

/* pu-erp의 유형 코드표 (biz_cons_types 등). name과 agency가 함께 들어 있다 */
const TYPEMAP = {
  consulting: [
    { code: 'cons-job-neung', name: '산업일자리', agency: '한국능률협회' },
    { code: 'cons-ilteo', name: '일터상생혁신', agency: '노사발전재단' },
    { code: 'cons-clinic', name: '현장클리닉', agency: '' },
    { code: 'cons-other', name: '기타', agency: '' }
  ],
  case: [{ code: 'case-buhae', name: '부당해고', agency: '' }]
};

test('mapRecord: 유형 코드에서 유형 이름과 수행기관을 채운다', () => {
  const r = PS.mapRecord('consultings', 'k1', {
    companyName: '벼리테크', typeCode: 'cons-job-neung', status: 'closed', closedDate: '2026-02-01', managerMain: '2001'
  }, UMAP, TYPEMAP);
  assert.equal(r.rec.type, '산업일자리');
  assert.equal(r.rec.agency, '한국능률협회', '수행기관이 채워지면 외부기관 실적 탭으로 간다');

  /* typeCodes.consulting 형태도 읽는다 */
  const r2 = PS.mapRecord('consultings', 'k2', {
    companyName: '벼리아이', typeCodes: { consulting: 'cons-ilteo' }, status: 'done'
  }, UMAP, TYPEMAP);
  assert.equal(r2.rec.type, '일터상생혁신');
  assert.equal(r2.rec.agency, '노사발전재단');

  /* agency가 빈 코드는 내부 실적 — 수행기관을 비워 둔다 */
  const r3 = PS.mapRecord('consultings', 'k3', { companyName: 'A사', typeCode: 'cons-clinic' }, UMAP, TYPEMAP);
  assert.equal(r3.rec.type, '현장클리닉');
  assert.equal(r3.rec.agency, '');

  /* 코드표에 없는 코드·코드표 자체가 없을 때도 죽지 않는다 */
  const r4 = PS.mapRecord('consultings', 'k4', { companyName: 'B사', typeCode: 'cons-없음' }, UMAP, TYPEMAP);
  assert.equal(r4.rec.type, '');
  const r5 = PS.mapRecord('consultings', 'k5', { companyName: 'C사', typeCode: 'cons-ilteo' }, UMAP, null);
  assert.equal(r5.rec.type, '');
  assert.equal(r5.rec.agency, '');
});

test('mapRecord: consultingType이 있으면 코드표보다 우선한다', () => {
  const r = PS.mapRecord('consultings', 'k1', {
    companyName: 'A사', consultingType: '직접입력유형', typeCode: 'cons-ilteo'
  }, UMAP, TYPEMAP);
  assert.equal(r.rec.type, '직접입력유형');
  assert.equal(r.rec.agency, '노사발전재단', '수행기관은 코드표에서 그대로 가져온다');
});

test('buildSyncPlan: ★ 같은 업체·같은 해의 기존 실적은 «자동으로 붙이지 않고» 제안으로 둔다', () => {
  const collData = {
    cases: null,
    consultings: { v: {
      k1: { companyName: '벼리테크', typeCode: 'cons-job-neung', status: 'closed', closedDate: '2026-02-01' },
      k2: { companyName: '새로운회사', typeCode: 'cons-ilteo', status: 'closed', closedDate: '2026-03-01' }
    }, u: 1 },
    funds: null, other_projects: null
  };
  /* 시드로 들어있던 기존 실적 — puRef가 없다 */
  const existing = [
    { id: 'CN0001', store: 'consult', org: '벼리테크', year: '2026', type: '산업일자리' }
  ];
  const plan = PS.buildSyncPlan(collData, new Set(), UMAP, TYPEMAP, existing);
  assert.equal(plan.adds.length, 1, '기존에 있을 수 있는 건은 새로 만들지 않는다(중복 방지)');
  assert.equal(plan.adds[0].rec.org, '새로운회사');
  // 온톨로지: 이름으로 관계 열쇠를 삼지 않는다 — 사람이 고를 때까지 잇지 않는다
  assert.equal(plan.links.length, 0, '★ 이름이 같다고 자동으로 붙이면 안 됩니다');
  assert.equal(plan.suggests.length, 1, '연결 제안으로 남아야 합니다');
  assert.equal(plan.suggests[0].cands[0].id, 'CN0001');
  assert.equal(plan.suggests[0].add.rec.agency, '한국능률협회', '연결할 때 채울 수행기관을 함께 들고 있다');
});

test('buildSyncPlan: ★ 한 업체에 같은 해 두 건이면 후보를 «둘 다» 보여 준다 — 아무 쪽에나 붙지 않는다', () => {
  const collData = { cases: { v: {
    a: { id: 'c-a', companyName: '가나상사', title: '부당해고', caseNo: '부해등-2026-001', status: 'closed', closedDate: '2026-03-01' }
  }, u: 1 } };
  const existing = [
    { id: 'CS0001', store: 'case', org: '가나상사', year: '2026', project: '임금체불' },
    { id: 'CS0002', store: 'case', org: '가나상사', year: '2026', project: '부당해고' }
  ];
  const plan = PS.buildSyncPlan(collData, new Set(), UMAP, TYPEMAP, existing);
  assert.equal(plan.links.length, 0);
  assert.deepEqual(plan.suggests[0].cands.map((c) => c.id), ['CS0001', 'CS0002']);
});

test('buildSyncPlan: ★ 영구 id 가 있으면 열쇠는 «cases#id» — 줄 번호가 아니다', () => {
  const collData = { cases: [
    { id: 'case-1', companyName: '가나상사', caseNo: '부해등-2026-001', title: 't', closedDate: '2026-01-01' },
    { id: 'case-2', companyName: '다라전자', caseNo: '산재등-2026-004', title: 't', closedDate: '2026-01-01' }
  ] };
  const plan = PS.buildSyncPlan(collData, new Set(), {});
  assert.deepEqual(plan.adds.map((a) => a.rec.puRef), ['cases#case-1', 'cases#case-2']);
  const r = plan.adds[1].rec;
  assert.equal(r.sourceKind, 'case', '온톨로지 sourceKind');
  assert.equal(r.sourceId, 'case-2', '온톨로지 sourceId = 이알피 영구 id');
  assert.equal(r.sourceNo, '산재등-2026-004', '관리번호는 보여 주기용으로 따로');
  assert.equal(r.puRefWeak, undefined);
  // 이미 id 로 들어온 것은 건너뛴다 — 줄이 밀려도(앞의 것이 지워져도) 같은 건으로 안다
  const plan2 = PS.buildSyncPlan({ cases: [collData.cases[1]] }, new Set(['cases#case-2']), {});
  assert.equal(plan2.adds.length, 0, '★ 앞줄이 지워져 줄 번호가 바뀌어도 같은 건이다');
  assert.equal(plan2.skippedKnown, 1);
});

test('buildSyncPlan: id 없는 옛 레코드는 줄 번호 열쇠 + 약한 연결 표시', () => {
  const plan = PS.buildSyncPlan({ cases: [{ companyName: 'E사', title: 't', closedDate: '2025-05-05' }] }, new Set(), {});
  assert.equal(plan.adds[0].rec.puRef, 'cases/0');
  assert.equal(plan.adds[0].rec.puRefWeak, true);
  assert.equal(plan.adds[0].rec.sourceId, '');
});

test('buildRefMigration: ★ 옛 줄 번호 열쇠를 «그 줄이 아직 같은 건일 때만» 영구 열쇠로 옮긴다', () => {
  const collData = { cases: { v: [
    { id: 'c-0', companyName: '가나상사', title: '부당해고', caseNo: '부해등-2026-001' },
    { id: 'c-1', companyName: '다라전자', title: '임금체불', caseNo: '체불-2026-002' },   // 원래 2번째에 있던 건이 지워져 한 칸 당겨졌다
    { companyName: '마바건설', title: '산재' }                                          // id 없음
  ], u: 1 }, consultings: { v: { 'co-9': { id: 'co-9', companyName: '사아', title: '컨설팅' } }, u: 1 } };
  const recs = [
    { id: 'CS0001', store: 'case', puRef: 'cases/0', org: '가나상사', project: '부해등-2026-001' },  // 그대로 → 옮김
    { id: 'CS0002', store: 'case', puRef: 'cases/1', org: '가나상사', project: '산재사건' },          // 그 줄에 다른 업체 → 확인 필요
    { id: 'CS0003', store: 'case', puRef: 'cases/1', org: '다라전자', project: '다른내용' },          // 업체는 같은데 내용이 다르다 → 확인 필요
    { id: 'CS0004', store: 'case', puRef: 'cases/7', org: '가나상사' },                              // 그 줄이 없다 → 확인 필요
    { id: 'CS0005', store: 'case', puRef: 'cases/2', org: '마바건설' },                              // id 없는 줄 → 약한 연결 유지
    { id: 'CN0001', store: 'consult', puRef: 'consultings/co-9', org: '엉뚱' },                    // 지도 저장, 열쇠 = id → 옮김
    { id: 'CS0006', store: 'case', puRef: 'cases#c-0', org: '가나상사' }                            // 이미 영구 → 손대지 않음
  ];
  const m = PS.buildRefMigration(collData, recs);
  assert.deepEqual(m.upgrades.map((u) => [u.id, u.puRef]), [['CS0001', 'cases#c-0'], ['CN0001', 'consultings#co-9']]);
  assert.equal(m.upgrades[0].sourceNo, '부해등-2026-001');
  assert.equal(m.upgrades[0].sourceId, 'c-0');
  assert.deepEqual(m.broken.map((b) => b.id), ['CS0002', 'CS0003', 'CS0004'], '★ 어긋난 연결은 자동으로 다른 건에 붙이지 않고 사람에게');
  assert.equal(m.broken[2].reason, 'gone');
  assert.deepEqual(m.weak.map((w) => w.id), ['CS0005']);
});

test('buildRefMigration: ★ 관리번호만 같다고 옮기지 않는다 — 업체가 달라지면 확인 필요', () => {
  const m = PS.buildRefMigration({ cases: [{ id: 'x', companyName: '다른회사', caseNo: '부해등-2026-001' }] },
    [{ id: 'CS0001', store: 'case', puRef: 'cases/0', org: '가나상사', project: '부해등-2026-001' }]);
  assert.equal(m.upgrades.length, 0);
  assert.equal(m.broken.length, 1);
});

test('buildNoUpdates: 이알피가 관리번호를 다시 매기면 영구 열쇠로 이어진 건만 따라 고친다', () => {
  const collData = { consultings: [{ id: 'k1', no: '기술보호-2026-003' }, { no: '기술보호-2026-009' }] };
  const ups = PS.buildNoUpdates(collData, [
    { puRef: 'consultings#k1', sourceNo: '기술보호-2026-004' },
    { puRef: 'consultings/1', sourceNo: '' },                           // 줄 번호 열쇠 — 따라가지 않는다
    { puRef: 'consultings#k1', sourceNo: '기술보호-2026-004', puRefCheck: 'moved' }
  ]);
  assert.deepEqual(ups, [{ puRef: 'consultings#k1', sourceNo: '기술보호-2026-003' }]);
});

test('mapRecord: 모르는 컬렉션은 null', () => {
  assert.equal(PS.mapRecord('unknown', 'k', {}, {}), null);
});

test('mapRecord: 상태를 pu-erp 실제 상태로 옮긴다 — 진행중도 가져온다', () => {
  // 사건 13건 중 11건이 진행중이었다(실사용). 종료만 받으면 실적이 영원히 안 들어온다.
  const open = PS.mapRecord('cases', 'k9', {
    caseType: '임금체불', companyName: '오지훈', title: '임금체불사건', managerMain: '2001'
  }, UMAP);
  assert.equal(open.rec.status, '진행');
  const closed = PS.mapRecord('cases', 'k8', {
    caseType: '산재', companyName: 'B사', title: 't', status: 'closed', managerMain: '2001'
  }, UMAP);
  assert.equal(closed.rec.status, '완료');
});

test('buildSyncPlan: 진행중도 담되 종료 건수를 따로 센다', () => {
  const collData = {
    cases: { v: {
      k1: { caseType: '산재', companyName: 'A사', title: 't1', status: 'closed', managerMain: '2001' },
      k2: { caseType: '임금체불', companyName: 'B사', title: 't2', managerMain: '2001' }   // 진행중
    }, u: 1 },
    consultings: null, funds: null, other_projects: null
  };
  const plan = PS.buildSyncPlan(collData, new Set(), UMAP);
  assert.equal(plan.adds.length, 2, '진행중도 들어와야 합니다');
  assert.equal(plan.closedCount, 1, '종료 건수를 따로 세어 미리보기에 보여준다');
  assert.equal(plan.openCount, 1);
  assert.equal(plan.skippedOpen, 0, '진행중을 제외하지 않는다');
});

test('buildStatusUpdates: 진행 → 완료로 바뀐 것만 상태를 맞춘다', () => {
  const collData = {
    cases: { v: {
      k1: { caseType: '산재', companyName: 'A사', status: 'closed', closedDate: '2026-05-01' },  // 종료됨
      k2: { caseType: '임금체불', companyName: 'B사', status: 'active' },                        // 여전히 진행
      k3: { caseType: '부해', companyName: 'C사', status: 'closed' }                             // 이미 완료로 반영됨
    }, u: 1 },
    consultings: null, funds: null, other_projects: null
  };
  const existing = [
    { id: 'CS0001', puRef: 'cases/k1', org: 'A사', status: '진행', year: '' },
    { id: 'CS0002', puRef: 'cases/k2', org: 'B사', status: '진행', year: '2026' },
    { id: 'CS0003', puRef: 'cases/k3', org: 'C사', status: '완료', year: '2025' },
    { id: 'CS0004', status: '진행' },                    // 손으로 등록한 건 — puRef 없으면 건드리지 않는다
    { id: 'CS0005', puRef: 'cases/없음', status: '진행' } // pu-erp에서 사라진 건
  ];
  const ups = PS.buildStatusUpdates(collData, existing);
  assert.equal(ups.length, 1, '바뀐 것만 나와야 합니다');
  assert.equal(ups[0].puRef, 'cases/k1');
  assert.equal(ups[0].status, '완료');
  assert.equal(ups[0].year, '2026', '종료일에서 연도를 채운다');
});

test('buildStatusUpdates: ★ 줄 번호 열쇠의 그 줄에 «다른 업체»가 와 있으면 상태를 덮지 않는다', () => {
  // 앞의 사건이 지워져 한 칸 당겨졌다 — 1번 줄은 이제 다른 업체의 끝난 사건이다
  const collData = { cases: [ { companyName: '다라전자', status: 'closed', closedDate: '2026-05-01' } ] };
  const ups = PS.buildStatusUpdates(collData, [{ id: 'CS0001', puRef: 'cases/0', org: '가나상사', status: '진행' }]);
  assert.equal(ups.length, 0, '★ 남의 사건이 끝났다고 내 실적을 완료로 바꾸면 안 됩니다');
});

test('buildStatusUpdates: 영구 열쇠는 줄이 밀려도 제 건을 찾는다 · 확인 대기 건은 건드리지 않는다', () => {
  const collData = { cases: [
    { id: 'c-9', companyName: '다라전자', status: 'active' },
    { id: 'c-1', companyName: '가나상사', status: 'closed', closedDate: '2026-06-01' }
  ] };
  const ups = PS.buildStatusUpdates(collData, [
    { id: 'CS0001', puRef: 'cases#c-1', org: '가나상사', status: '진행' },
    { id: 'CS0002', puRef: 'cases#c-1', org: '가나상사', status: '진행', puRefCheck: 'moved' }
  ]);
  assert.deepEqual(ups.map((u) => u.puRef + ':' + u.status), ['cases#c-1:완료']);
});

test('unwrap: pu-erp의 {v,u} 봉투를 벗긴다', () => {
  // pu-erp는 data/{키} = {v:실제값, u:타임스탬프} 로 저장하고 자신은 data/{키}/v 로 읽는다.
  // 봉투를 안 벗기면 컬렉션마다 v·u 두 개가 레코드로 세어진다(4×2=8건 유령 레코드).
  assert.deepEqual(PS.unwrap({ v: [1, 2], u: 123 }), [1, 2]);
  assert.deepEqual(PS.unwrap({ v: { a: 1 }, u: 1 }), { a: 1 });
  assert.equal(PS.unwrap({ v: null, u: 1 }), null);          // 빈 봉투
  assert.deepEqual(PS.unwrap([1, 2]), [1, 2]);               // 봉투 없으면 그대로
  assert.deepEqual(PS.unwrap({ k1: { a: 1 } }), { k1: { a: 1 } });
  assert.equal(PS.unwrap(null), null);
});

test('buildSyncPlan: 봉투에 싸인 컬렉션도 제대로 읽는다', () => {
  const closed = { caseType: '부당해고', companyName: 'A사', title: '사건1', closedDate: '2026-01-01', managerMain: '2001' };
  const collData = {
    cases: { v: { k1: closed }, u: 1770000000000 },          // pu-erp 실제 형태
    consultings: { v: {}, u: 1 },
    funds: null,
    other_projects: null
  };
  const plan = PS.buildSyncPlan(collData, new Set(), UMAP);
  assert.equal(plan.adds.length, 1);
  assert.equal(plan.adds[0].rec.puRef, 'cases/k1');
  assert.equal(plan.skippedOpen, 0, '봉투의 u(타임스탬프)를 레코드로 세면 안 됩니다');
});

test('buildSyncPlan: puRef 처음인 것만 들어오고 이미 있는 건 건너뛴다', () => {
  const collData = {
    cases: {
      k1: { caseType: '부당해고', companyName: 'A사', title: '사건1', closedDate: '2026-01-01', managerMain: '2001' },
      k2: { caseType: '임금체불', companyName: 'B사', title: '사건2', status: 'active' },            // 진행 중 → 상태만 '진행'으로
      k3: { caseType: '산재', companyName: 'C사', title: '사건3', status: 'closed', managerMain: '2001' }
    },
    consultings: {
      c1: { consultingType: '일터혁신', companyName: 'D사', title: '컨설팅1', status: 'done', managerMain: '2003' }
    },
    funds: null,                                                                                      // 컬렉션이 비어도 죽지 않는다
    other_projects: {}
  };
  const existing = new Set(['cases/k3']);                                                             // 이미 들어온 것(배제 포함)
  const plan = PS.buildSyncPlan(collData, existing, UMAP);

  assert.equal(plan.adds.length, 3);                                                                  // k1 + k2 + c1
  // 자문·고문(advisory)이 2026-09-03 에 늘었다 — companies 를 안 넘겼으니 0 이어야 한다
  assert.deepEqual(plan.counts, { case: 2, consult: 1, fund: 0, etc: 0, advisory: 0 });
  assert.equal(plan.closedCount, 2);                                                                  // k1 · c1
  assert.equal(plan.openCount, 1);                                                                    // k2
  assert.equal(plan.skippedKnown, 1);                                                                 // k3
  const refs = plan.adds.map((a) => a.rec.puRef).sort();
  assert.deepEqual(refs, ['cases/k1', 'cases/k2', 'consultings/c1']);
  assert.equal(plan.adds.find((a) => a.rec.puRef === 'cases/k2').rec.status, '진행');
});

test('buildSyncPlan: 배열형 컬렉션(Firebase가 배열로 줄 때)도 처리한다', () => {
  const collData = { cases: [null, { caseType: '사건', companyName: 'E사', title: 't', closedDate: '2025-05-05' }],
                     consultings: null, funds: null, other_projects: null };
  const plan = PS.buildSyncPlan(collData, new Set(), {});
  assert.equal(plan.adds.length, 1);
  assert.equal(plan.adds[0].rec.puRef, 'cases/1');                                                    // 배열 인덱스가 키
});
