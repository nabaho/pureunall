/* 2026-09-24 · 급여 겹친 달 정리 — 같은 사람의 같은 달 급여가 두 줄일 때
   대표 지시: 「목업 만든 것 실제로 만들어라」 (목업: status/2026-09-23-legacy-tables-no-wipe.md 이어)
   실제 자료로 확인한 5개 겹친 달(2026-09-23) — 옛 사번정리 도구가 사번 칸만 바꾸고
   열쇠는 그대로 둬, 한 사람의 같은 달 급여가 두 줄 남았다.

   ── 여기서 못 박는 것 ──
   ① 같은 사번·같은 달에 줄이 둘 이상이면 «겹친 달»로 묶는다. 지운 표시가 있는 줄은 뺀다.
   ② 값이 다른 칸만 «다른 칸»으로 센다 — id·empSid·ym(그룹을 가르는 열쇠)은 빼고 센다.
   ③ 자동으로 고르지 않는다 — 남길 줄은 사람이 고른다. 고르지 않으면 아무것도 안 지운다.
   ④ 지우는 것은 «표시»다(TrashBin) — 물리 삭제가 아니라 되돌릴 수 있다.
   ⑤ 고른 줄이 아닌 다른 줄만 지운다 — 다른 사람·다른 달의 줄은 손대지 않는다.

   실행: node --test tests/payroll-dup-months.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8');
const fn = (decl) => cutFn(SRC, decl);

function pure() {
  const ctx = { JSON, Object, Array, String, console: { warn() {} } };
  vm.createContext(ctx);
  vm.runInContext(fn('var PAYROLL_DUP_IGNORE_FIELDS'), ctx);
  vm.runInContext(fn('function payrollDupGroups('), ctx);
  return ctx;
}

/* 2026-09-23 실제 서버 자료 그대로 — 박한별(P-003) 1~3월은 완전히 같은 값의 중복,
   4월은 (미확정 가져오기 줄) vs (실지급 완료 줄)로 값이 다르다. */
function pay(id, empSid, ym, extra) {
  return Object.assign({ id, empSid, ym, empName: '박한별', baseSalary: 3700000 }, extra || {});
}

test('① 같은 사번·같은 달 줄이 둘이면 겹친 달로 묶는다', () => {
  const P = pure();
  const rows = [
    pay('pay-P-003-202601', 'P-003', '2026-01'),
    pay('pay-P-004-2026-01', 'P-003', '2026-01'),
    pay('pay-P-003-202605', 'P-003', '2026-05'),  // 겹치지 않는 달 — 묶이면 안 된다
  ];
  const groups = P.payrollDupGroups(rows);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].empSid, 'P-003');
  assert.equal(groups[0].ym, '2026-01');
  assert.deepEqual(Array.from(groups[0].items.map((x) => x.id)).sort(), ['pay-P-003-202601', 'pay-P-004-2026-01']);
});

test('① 줄이 셋이어도 하나로 묶인다 — 둘씩 쪼개지 않는다', () => {
  const P = pure();
  const rows = ['a', 'b', 'c'].map((s) => pay('pay-' + s, 'P-009', '2026-02'));
  const groups = P.payrollDupGroups(rows);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].items.length, 3);
});

test('① 지운 표시(_deleted)가 있는 줄은 겹침 계산에서 뺀다 — 이미 정리된 것', () => {
  const P = pure();
  const rows = [
    pay('pay-1', 'P-003', '2026-01'),
    pay('pay-2', 'P-003', '2026-01', { _deleted: true }),
  ];
  assert.equal(P.payrollDupGroups(rows).length, 0, '★ 지운 줄까지 세어 «아직 겹친다»고 합니다');
});

test('① 사번이나 달이 다르면 안 묶인다', () => {
  const P = pure();
  const rows = [pay('pay-1', 'P-003', '2026-01'), pay('pay-2', 'P-004', '2026-01')];
  assert.equal(P.payrollDupGroups(rows).length, 0);
});

test('② id·empSid·ym 은 「다른 칸」으로 안 센다 — 그룹을 가르는 열쇠일 뿐이다', () => {
  const P = pure();
  const rows = [pay('pay-a', 'P-003', '2026-01'), pay('pay-b', 'P-003', '2026-01')];
  const g = P.payrollDupGroups(rows)[0];
  assert.deepEqual(g.diffFields, [], '★ id 가 다르다는 것만으로 「다른 칸」이 생깁니다: ' + g.diffFields.join(','));
  // empSid·ym 은 한 묶음 안에서 늘 같아 diffFields 로는 안 드러난다 — fields(전체 칸 목록) 자체에서도 뺐는지 직접 본다.
  assert.ok(!g.fields.includes('empSid'), '★ empSid 를 「전체 칸 보기」 목록에 넣습니다 — 위 제목줄과 똑같은 값이 또 한 줄 나옵니다');
  assert.ok(!g.fields.includes('ym'), '★ ym 을 「전체 칸 보기」 목록에 넣습니다 — 위 제목줄과 똑같은 값이 또 한 줄 나옵니다');
});

test('② 실제 값이 같으면 다른 칸 0개 — 2026-09-23 서버의 완전 중복 그대로', () => {
  const P = pure();
  const A = pay('pay-P-003-202601', 'P-003', '2026-01', { grossPay: 4150000, netPay: 3443150, paidDate: '2026-02-05', status: 'paid' });
  const B = pay('pay-P-004-2026-01', 'P-003', '2026-01', { grossPay: 4150000, netPay: 3443150, paidDate: '2026-02-05', status: 'paid' });
  const g = P.payrollDupGroups([A, B])[0];
  assert.deepEqual(g.diffFields, []);
});

test('② 값이 다른 칸만 잡는다 — 2026-09-23 서버의 미확정 가져오기 줄 vs 실지급 줄', () => {
  const P = pure();
  const A = pay('pay-P-003-2026-04', 'P-003', '2026-04', { note: '2026 급여대장 가져오기(확정)' });  // netPay 등 없음
  const B = pay('pay-P-003-202604', 'P-003', '2026-04', { note: '휴직 중', grossPay: 4240000, netPay: 3122880, paidDate: '2026-05-05' });
  const g = P.payrollDupGroups([A, B])[0];
  assert.ok(g.diffFields.includes('netPay'), '실지급액이 다른데 「다른 칸」에 안 잡힙니다');
  assert.ok(g.diffFields.includes('note'), '메모가 다른데 「다른 칸」에 안 잡힙니다');
  assert.ok(!g.diffFields.includes('baseSalary'), '기본급은 같은데 「다른 칸」으로 잡힙니다');
});

test('② workHours 74.64 vs 75 처럼 «작은 차이»도 다른 칸으로 잡는다 — 반올림해서 숨기지 않는다', () => {
  const P = pure();
  const A = pay('pay-a', 'P-004', '2026-02', { workHours: 74.64 });
  const B = pay('pay-b', 'P-004', '2026-02', { workHours: 75 });
  assert.ok(P.payrollDupGroups([A, B])[0].diffFields.includes('workHours'));
});

/* ══════ ③④⑤ 지우기 — 실제 저장 경로까지 돌린다 ══════ */
function withApply() {
  const store = { payroll_monthly: [] };
  const trashCalls = [];
  const auditCalls = [];
  const ctx = {
    JSON, Object, Array, String, console: { warn() {} },
    dbGet(k, d) { return store[k] !== undefined ? store[k] : d; },
    dbSet(k, v) { store[k] = v; },
    TrashBin: {
      remove(storageKey, itemId, reason) {
        trashCalls.push({ storageKey, itemId, reason });
        const arr = store[storageKey] || [];
        let found = false;
        store[storageKey] = arr.map((x) => {
          if (x && x.id === itemId) { found = true; return Object.assign({}, x, { _deleted: true, _deletedReason: reason }); }
          return x;
        });
        return found;
      },
    },
    AuditLog: { write(...args) { auditCalls.push(args); return true; } },
  };
  vm.createContext(ctx);
  vm.runInContext(fn('var PAYROLL_DUP_IGNORE_FIELDS'), ctx);
  vm.runInContext(fn('function payrollDupGroups('), ctx);
  vm.runInContext(fn('function payrollDupApply('), ctx);
  return { ctx, store, trashCalls, auditCalls };
}

test('③④ 남길 줄을 고르면 «다른» 줄만 TrashBin 으로 지운 표시된다 — 물리 삭제가 아니다', () => {
  const { ctx, store, trashCalls } = withApply();
  store.payroll_monthly = [
    pay('pay-P-003-202601', 'P-003', '2026-01'),
    pay('pay-P-004-2026-01', 'P-003', '2026-01'),
  ];
  const g = ctx.payrollDupGroups(store.payroll_monthly)[0];
  const removed = ctx.payrollDupApply(g, 'pay-P-003-202601', '검사');
  assert.deepEqual(Array.from(removed), ['pay-P-004-2026-01']);
  assert.deepEqual(trashCalls.map((c) => c.itemId), ['pay-P-004-2026-01']);
  const after = store.payroll_monthly;
  assert.equal(after.length, 2, '★★ 물리적으로 지웠습니다 — 줄 수가 줄면 안 됩니다(TrashBin은 표시만 합니다)');
  assert.equal(after.find((x) => x.id === 'pay-P-003-202601')._deleted, undefined, '남긴 줄에 지운 표시가 붙었습니다');
  assert.equal(after.find((x) => x.id === 'pay-P-004-2026-01')._deleted, true, '지울 줄에 표시가 안 붙었습니다');
});

test('⑤ 다른 사번·다른 달의 줄은 절대 안 건드린다', () => {
  const { ctx, store, trashCalls } = withApply();
  store.payroll_monthly = [
    pay('pay-a', 'P-003', '2026-01'), pay('pay-b', 'P-003', '2026-01'),
    pay('pay-c', 'P-004', '2026-01'),   // 다른 사람 — 손대면 안 된다
    pay('pay-d', 'P-003', '2026-02'),   // 다른 달 — 손대면 안 된다
  ];
  const g = ctx.payrollDupGroups(store.payroll_monthly).find((x) => x.empSid === 'P-003' && x.ym === '2026-01');
  ctx.payrollDupApply(g, 'pay-a', '검사');
  assert.deepEqual(trashCalls.map((c) => c.itemId), ['pay-b']);
  assert.equal(store.payroll_monthly.find((x) => x.id === 'pay-c')._deleted, undefined);
  assert.equal(store.payroll_monthly.find((x) => x.id === 'pay-d')._deleted, undefined);
});

test('③ 남길 줄(keepId)을 안 주면 아무것도 안 지운다 — 자동으로 고르지 않는다', () => {
  const { ctx, store, trashCalls } = withApply();
  store.payroll_monthly = [pay('pay-a', 'P-003', '2026-01'), pay('pay-b', 'P-003', '2026-01')];
  const g = ctx.payrollDupGroups(store.payroll_monthly)[0];
  const removed = ctx.payrollDupApply(g, '', '검사');
  assert.equal(removed.length, 0);
  assert.equal(trashCalls.length, 0);
});

test('④ 지운 사유가 TrashBin 에 남는다 — 나중에 왜 지웠는지 알 수 있어야 한다', () => {
  const { ctx, store, trashCalls } = withApply();
  store.payroll_monthly = [pay('pay-a', 'P-003', '2026-01'), pay('pay-b', 'P-003', '2026-01')];
  const g = ctx.payrollDupGroups(store.payroll_monthly)[0];
  ctx.payrollDupApply(g, 'pay-a');
  assert.ok(trashCalls[0].reason && trashCalls[0].reason.length > 0);
});

test('④ 지운 것을 AuditLog 에도 남긴다', () => {
  const { ctx, store, auditCalls } = withApply();
  store.payroll_monthly = [pay('pay-a', 'P-003', '2026-01'), pay('pay-b', 'P-003', '2026-01')];
  const g = ctx.payrollDupGroups(store.payroll_monthly)[0];
  ctx.payrollDupApply(g, 'pay-a');
  assert.equal(auditCalls.length, 1);
  assert.equal(auditCalls[0][0], 'payroll');
});

/* ══════ 배선 — 화면이 실제로 이 규칙을 지키는가 (규칙을 보지, 글자를 안 본다) ══════ */
test('배선★ 지우는 버튼이 TrashBin.remove 를 쓴다 — filter/splice 로 직접 지우지 않는다', () => {
  const body = fn('function payrollDupApply(');
  assert.match(body, /TrashBin\.remove\(/, '★★ 물리 삭제 경로를 씁니다 — 되돌릴 수 없습니다');
});

test('배선★ 겹친 달 버튼은 관리자만 보고, 겹친 것이 있을 때만 보인다', () => {
  const body = fn('function PayrollLedger(');
  const i = body.indexOf("'⚠️ 겹친 달 '");
  assert.ok(i > 0, '겹친 달 버튼을 못 찾았습니다');
  const before = body.slice(Math.max(0, i - 400), i);
  assert.match(before, /dupCount > 0/, '★ 겹친 것이 없어도 버튼이 보입니다');
  assert.match(before, /canSuperEdit\(\)/, '★★ 관리자가 아니어도 급여 겹친 달 정리 버튼이 보입니다');
});

test('배선★★ 지우기 단추는 남길 줄(keepId)을 고르기 전엔 눌리지 않는다', () => {
  const body = fn('function PayrollDupModal(');
  assert.match(body, /disabled:\s*!keepId/, '★★ 고르지 않아도 지우기 단추가 눌립니다 — 자동으로 고르는 길이 열립니다');
});

test('배선★ 모달을 열 때 이전 선택이 남지 않는다 — 다음 묶음으로 넘어가면 keepId 를 비운다', () => {
  const body = fn('function PayrollDupModal(');
  assert.match(body, /setKeepId\(''\)/);
});

test('배선★ 휴지통 화면에서도 지운 급여를 찾아 되살릴 수 있다 — 이 화면이 유일한 길이면 안 된다', () => {
  const body = fn('function TrashView(');
  assert.match(body, /key:\s*'payroll_monthly'/, '★ 휴지통 화면의 표(STORES)에 급여가 없습니다 — 복원할 다른 길이 없어집니다');
});
