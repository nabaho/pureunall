/* 경력관리 ↔ 이알피 연결 — 온톨로지 검토 (대표 지시 2026-09-29 「추천대로 모두 다」)
   ① 연결 열쇠는 이알피의 영구 id('cases#id') — 옛 줄 번호('cases/3')는 확인해서 옮긴다
   ② 이름이 같다고 자동으로 잇지 않는다 — 사람이 고른 것만
   ③ 한 번 쓴 번호(CS0012)를 다시 주지 않는다 — 첨부 원본이 번호로 찾아지므로
   실제 kcareer.html 의 함수를 잘라 돌린다(흉내 낸 사본을 두면 앱이 바뀌어도 검사가 통과한다). */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const CODE = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');

/* 함수 하나를 괄호 짝으로 잘라 낸다 */
function cutFn(src, head) {
  const i = src.indexOf(head);
  assert.ok(i >= 0, head + ' 를 못 찾았습니다');
  let j = src.indexOf('{', i), depth = 0;
  for (; j < src.length; j++) {
    const ch = src[j];
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) break; }
  }
  return src.slice(i, j + 1);
}

function sandbox(store) {
  const toasts = [];
  const ctx = {
    console, JSON, String, Number, Array, Object, Date, Math, RegExp, parseInt, Set,
    get: (k) => (store[k] || []).map((x) => (x && typeof x === 'object') ? Object.assign({}, x) : x),
    set: (k, arr) => { store[k] = arr.map((x) => (x && typeof x === 'object') ? Object.assign({}, x) : x); },
    toast: (m) => toasts.push(String(m)),
    closePuSync: () => {}, renderCareer: () => {},
    CAREER_CFG: {}, NS: 'kc_', LS: { set() {}, get() { return ''; } },
    _toasts: toasts
  };
  vm.createContext(ctx);
  vm.runInContext("var TRASH_STORE='trash';", ctx);
  vm.runInContext("var PU_SYNC_STORES=['case','consult','fund','etc','advisory'];", ctx);
  ['function kcTrashList(', 'function kcNextNo(', 'function nextId(prefix,store)',
   'function _puKnownRefs(', 'function puSyncCommit(', 'function puUndoSync('].forEach((h) => vm.runInContext(cutFn(CODE, h), ctx));
  return ctx;
}

/* ═══ ③ 번호 ═══ */
test('③ ★ 지운 번호를 다시 주지 않는다 — 가장 큰 번호의 다음', () => {
  const ctx = sandbox({ case: [{ id: 'CS0001' }, { id: 'CS0003' }] });
  assert.equal(ctx.nextId('CS', 'case'), 'CS0004', '빈 CS0002 를 채우면 안 됩니다');
});
test('③ ★ 휴지통에 든 번호도 «쓴 번호»다 — 그 원본이 새 건에 붙어 보이면 안 된다', () => {
  const ctx = sandbox({ case: [{ id: 'CS0001' }], trash: [{ store: 'case', rec: { id: 'CS0009' }, files: ['CS0009'] }] });
  assert.equal(ctx.nextId('CS', 'case'), 'CS0010');
});
test('③ 다른 칸의 휴지통은 섞이지 않는다 · 앞글자가 겹쳐도 짜임이 다르면 안 센다', () => {
  const ctx = sandbox({ cert: [{ id: 'C0002' }], trash: [{ store: 'certdoc', rec: { id: 'CD0050' }, files: ['CD0050'] }] });
  assert.equal(ctx.nextId('C', 'cert'), 'C0003', 'CD0050 은 C 번호가 아니다');
});
test('③ 한 번에 여러 건 — 아직 저장 안 한 묶음도 본다', () => {
  const ctx = sandbox({ case: [{ id: 'CS0001' }] });
  assert.equal(ctx.kcNextNo('CS', 4, 'case', [{ id: 'CS0002' }]), 'CS0003');
});
test('③ 위촉장 번호(유형+연도-순번)도 같은 규칙', () => {
  const ctx = sandbox({ wiccok: [{ id: '위촉장2026-001' }, { id: '위촉장2026-004' }] });
  vm.runInContext(cutFn(CODE, 'function wiccokId('), ctx);
  assert.equal(ctx.wiccokId('위촉장', '2026'), '위촉장2026-005');
});
test('③ 번호 만드는 곳이 모두 kcNextNo 를 쓴다 — 한 곳이라도 옛 방식이면 번호가 다시 나온다', () => {
  const body = CODE.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.equal((body.match(/while\([^)]*\.some\([^)]*\.id\s*===\s*(mk\(\)|pre\s*\+)/g) || []).length, 0,
    '«빈 번호부터 채우는» 반복문이 남아 있습니다 — kcNextNo 로 바꾸십시오');
});

/* ═══ ①② 동기화 반영 ═══ */
function baseCtx(picks) {
  const store = {
    case: [
      { id: 'CS0001', puRef: 'cases/0', org: '가나상사', src: 'pu' },
      { id: 'CS0002', puRef: 'cases/1', org: '다라전자', src: 'pu', status: '진행' },
      { id: 'CS0003', org: '마바건설', year: '2026' }                              // 시드 — 이어지지 않음
    ],
    trash: [{ store: 'case', rec: { id: 'CS0007' }, files: ['CS0007'] }]
  };
  const ctx = sandbox(store);
  ctx._puSyncCtx = {
    syncId: 'PS1',
    plan: {
      adds: [{ store: 'case', rec: { puRef: 'cases#n1', org: '새회사', sourceKind: 'case', sourceId: 'n1' } }],
      links: [],
      suggests: [
        { add: { store: 'case', rec: { puRef: 'cases#m1', org: '마바건설', sourceKind: 'case', sourceId: 'm1', sourceNo: '부해등-2026-009' } },
          cands: [{ id: 'CS0003', store: 'case' }] },
        { add: { store: 'case', rec: { puRef: 'cases#m2', org: '마바건설', sourceKind: 'case', sourceId: 'm2' } },
          cands: [{ id: 'CS0003', store: 'case' }] }
      ]
    },
    statusUps: [{ puRef: 'cases/1', status: '완료', year: '2026' }],   // 어긋난 연결에 온 상태 갱신 — 막혀야 한다
    noUps: [{ puRef: 'cases#c0', sourceNo: '부해등-2026-002' }],
    mig: {
      upgrades: [{ id: 'CS0001', store: 'case', oldRef: 'cases/0', puRef: 'cases#c0', sourceKind: 'case', sourceId: 'c0', sourceNo: '부해등-2026-001' }],
      broken: [{ id: 'CS0002', store: 'case', oldRef: 'cases/1', reason: 'moved' }]
    },
    picks: picks || {}
  };
  return { ctx, store };
}
const rec = (store, id) => store.case.find((r) => r.id === id);

test('① ★ 옛 줄 번호 연결을 영구 번호로 옮긴다 · 관리번호는 새 값을 따라간다', () => {
  const { ctx, store } = baseCtx();
  ctx.puSyncCommit();
  const r = rec(store, 'CS0001');
  assert.equal(r.puRef, 'cases#c0');
  assert.equal(r.sourceKind, 'case');
  assert.equal(r.sourceId, 'c0');
  assert.equal(r.sourceNo, '부해등-2026-002', '관리번호(이름표)는 이알피를 따라간다');
});
test('① ★ 어긋난 연결은 지우지 않고 «확인 필요»로 — 남의 사건 상태로 덮지 않는다', () => {
  const { ctx, store } = baseCtx();
  ctx.puSyncCommit();
  const r = rec(store, 'CS0002');
  assert.equal(r.puRef, 'cases/1', '옛 열쇠는 그대로 남긴다(사람이 볼 수 있게)');
  assert.equal(r.puRefCheck, 'moved');
  assert.equal(r.status, '진행', '★ 어긋난 줄의 «완료»가 들어오면 안 됩니다');
});
test('② ★ 고르지 않으면(보류) 잇지도, 새로 만들지도 않는다', () => {
  const { ctx, store } = baseCtx();
  ctx.puSyncCommit();
  assert.equal(rec(store, 'CS0003').puRef, undefined, '이름이 같다고 자동으로 붙으면 안 됩니다');
  assert.equal(store.case.filter((r) => r.puRef === 'cases#m1' || r.puRef === 'cases#m2').length, 0);
  assert.ok(ctx._toasts.some((t) => /같은 건 확인 2건/.test(t)), '넘긴 것을 알려 줘야 합니다');
});
test('② 사람이 고른 것만 잇는다 · 같은 실적에 두 건을 붙이지 않는다', () => {
  const { ctx, store } = baseCtx({ 0: 'L|case|CS0003', 1: 'L|case|CS0003' });
  ctx.puSyncCommit();
  const r = rec(store, 'CS0003');
  assert.equal(r.puRef, 'cases#m1');
  assert.equal(r.sourceId, 'm1');
  assert.equal(r.sourceNo, '부해등-2026-009');
  assert.equal(store.case.filter((x) => x.puRef === 'cases#m2').length, 0, '두 번째는 이미 이어진 실적이라 붙지 않는다');
});
test('② 「새로 추가」를 고르면 새 실적 — 번호는 휴지통 다음(③)', () => {
  const { ctx, store } = baseCtx({ 1: 'add' });
  ctx.puSyncCommit();
  const added = store.case.filter((r) => r.src === 'pu' && r.syncId === 'PS1').map((r) => r.id + ':' + r.puRef).sort();
  assert.deepEqual(added, ['CS0008:cases#n1', 'CS0009:cases#m2']);
});
test('② 어긋났던 실적에 제 건을 다시 고르면 확인 표시가 풀리고, 되돌리면 옛 상태로', () => {
  const { ctx, store } = baseCtx();
  ctx._puSyncCtx.plan.suggests = [{ add: { store: 'case', rec: { puRef: 'cases#d1', org: '다라전자', sourceKind: 'case', sourceId: 'd1' } },
    cands: [{ id: 'CS0002', store: 'case' }] }];
  ctx._puSyncCtx.picks = { 0: 'L|case|CS0002' };
  ctx.puSyncCommit();
  let r = rec(store, 'CS0002');
  assert.equal(r.puRef, 'cases#d1');
  assert.equal(r.puRefCheck, undefined);
  ctx.puUndoSync('PS1');
  r = rec(store, 'CS0002');
  assert.equal(r.puRef, 'cases/1', '되돌리면 옛 열쇠로');
  assert.equal(r.puRefCheck, 'moved', '다시 확인 필요로');
});
