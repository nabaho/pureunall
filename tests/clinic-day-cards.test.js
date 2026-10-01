/* 🏥 현장클리닉 주담당별 회계연도 일수 (대표 지시 2026-09-30 — 목업 안 D)
   「해는 회계년도로 · 예정건은 계약관리에서 건수를 작성할 경우 몇 건 예정으로 · 주담당만」
   실제 pu-erp.html 의 셈 함수를 잘라 돌린다. 이름은 모두 가짜. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8');
function cutFn(head) {
  const i = src.indexOf(head); assert.ok(i >= 0, head);
  let j = src.indexOf('{', i), d = 0;
  for (; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}' && --d === 0) break; }
  return src.slice(i, j + 1);
}
const ctx = { console, Object, Array, String, JSON, Math, Date, parseInt, window: {} };
vm.createContext(ctx);
['function consNameKey(', 'function clinicFyRange(', 'function clinicIsType(',
 'function clinicDaysOf(', 'function clinicDayCards('].forEach((h) => vm.runInContext(cutFn(h), ctx));
vm.runInContext("var CLINIC_PLAN_STATUS = ['consult','review','negotiate','confirmed','signed','progress'];", ctx);

const TYPES = [
  { code: 'consulting-x1', name: '현장클리닉', dayFee: 350000 },
  { code: 'consulting-x2', name: '기술보호' }
];
const fee = (code) => (code === 'consulting-x1' ? 350000 : 0);
const FY26 = ctx.clinicFyRange('01-01', '2026-09-30', 0);

test('회계연도: 01-01 이면 달력 해', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(FY26)), { year: 2026, start: '2026-01-01', end: '2026-12-31' });
});
test('★ 회계연도: 04-01 시작이면 3월은 «지난» 회계연도, 끝은 다음 해 3-31', () => {
  const a = ctx.clinicFyRange('04-01', '2026-03-15', 0);
  assert.equal(a.year, 2025); assert.equal(a.start, '2025-04-01'); assert.equal(a.end, '2026-03-31');
  const b = ctx.clinicFyRange('04-01', '2026-04-01', 0);
  assert.equal(b.year, 2026); assert.equal(b.end, '2027-03-31');
  assert.equal(ctx.clinicFyRange('04-01', '2026-05-01', -1).start, '2025-04-01', '◀ 지난 회계연도');
});
test('현장클리닉 알아보기 — 코드가 그때그때 지어져도 이름으로', () => {
  assert.equal(ctx.clinicIsType('consulting-x1', TYPES), true);
  assert.equal(ctx.clinicIsType('consulting-x2', TYPES), false);
  assert.equal(ctx.clinicIsType('cons-clinic', []), true);
  assert.equal(ctx.clinicIsType('c9', [{ code: 'c9', name: '현장 클리닉 컨설팅' }]), true);
});
test('일수: 적힌 값 → dayCalc → 잔금 ÷ 단가 «추정»(나누어 떨어질 때만)', () => {
  assert.deepEqual({ ...ctx.clinicDaysOf({ consultDays: 3 }, 350000) }, { days: 3, est: false });
  assert.deepEqual({ ...ctx.clinicDaysOf({ dayCalc: { days: 2 } }, 350000) }, { days: 2, est: false });
  assert.deepEqual({ ...ctx.clinicDaysOf({ balanceFee: 1155000, balanceFeeVatIncluded: true }, 350000) }, { days: 3, est: true });
  assert.deepEqual({ ...ctx.clinicDaysOf({ balanceFee: 700000 }, 350000) }, { days: 2, est: true });
  assert.deepEqual({ ...ctx.clinicDaysOf({ balanceFee: 500000 }, 350000) }, { days: 0, est: false }, '★ 억지 숫자를 만들지 않는다');
});

const ITEMS = [
  { id: 'a', typeCode: 'consulting-x1', managerMain: 'P-1', managerSubs: ['P-2'], startDate: '2026-03-02', consultDays: 3 },
  { id: 'b', typeCode: 'consulting-x1', managerMain: 'P-1', startDate: '2026-08-04', balanceFee: 1155000, balanceFeeVatIncluded: true, status: 'closed' },
  { id: 'c', typeCode: 'consulting-x1', managerMain: 'P-2', startDate: '2026-09-14', consultDays: 3 },
  { id: 'd', typeCode: 'consulting-x1', managerMain: 'P-2', startDate: '2025-12-20', consultDays: 3 },   // 지난 회계연도
  { id: 'e', typeCode: 'consulting-x2', managerMain: 'P-1', startDate: '2026-05-01', consultDays: 5 },   // 현장클리닉 아님
  { id: 'f', typeCode: 'consulting-x1', managerMain: 'P-1', startDate: '2026-06-01', consultDays: 3, _deleted: true }
];
const CONTRACTS = [
  { id: 'k1', kinds: ['consulting'], typeCodes: { consulting: 'consulting-x1' }, managerMain: 'P-2', status: 'review', signDate: '2026-09-20', consultDays: 3 },
  { id: 'k2', kinds: ['consulting'], typeCodes: { consulting: 'consulting-x1' }, managerMain: 'P-3', status: 'consult', signDate: '2026-09-25', consultDays: 0 },
  { id: 'k3', kinds: ['consulting'], typeCodes: { consulting: 'consulting-x1' }, managerMain: 'P-1', status: 'transferred', transferredTo: 'x', signDate: '2026-08-01', consultDays: 3 },
  { id: 'k4', kinds: ['consulting'], typeCodes: { consulting: 'consulting-x2' }, managerMain: 'P-1', status: 'review', signDate: '2026-09-01', consultDays: 2 },
  { id: 'k5', kinds: ['company'], managerMain: 'P-1', status: 'review', signDate: '2026-09-01' }
];
const R = ctx.clinicDayCards(ITEMS, CONTRACTS, TYPES, FY26, fee);

test('★ 주담당별 이번 회계연도 일수 — 종료 건도 «수행»으로 센다', () => {
  assert.equal(R.by['P-1'].days, 6); assert.equal(R.by['P-1'].cnt, 2); assert.equal(R.by['P-1'].est, 1);
  assert.equal(R.by['P-2'].days, 3); assert.equal(R.by['P-2'].cnt, 1);
});
test('★ 주담당만 — 부담당에게는 세지 않는다', () => {
  assert.equal(R.by['P-2'].cnt, 1, 'a 건의 부담당 P-2 에게 더해지면 안 됩니다');
});
test('지난 회계연도·다른 유형·지운 건은 빠진다', () => {
  assert.equal(R.total.cnt, 3); assert.equal(R.total.days, 9);
});
test('★ 예정 = 계약관리의 이관 전 현장클리닉 계약 (일수는 적힌 대로)', () => {
  assert.equal(R.by['P-2'].planCnt, 1); assert.equal(R.by['P-2'].planDays, 3);
  assert.equal(R.by['P-3'].planCnt, 1, '일수를 아직 안 적은 계약도 «건»으로는 예정');
  assert.equal(R.by['P-3'].planDays, 0);
  assert.equal(R.by['P-3'].cnt, 0, '예정만 있는 사람도 카드가 생긴다');
});
test('★ 이관된 계약은 예정에서 빠진다 — 컨설팅관리 쪽과 두 번 세지 않는다', () => {
  assert.equal(R.by['P-1'].planCnt, 0);
  assert.equal(R.total.planCnt, 2);
});
test('화면: 컨설팅관리에만 카드가 붙고, 카드는 셈 함수 하나를 쓴다', () => {
  assert.match(src, /props\.sourceKind === 'consulting' && h\(ClinicDayCards,/);
  assert.match(cutFn('function ClinicDayCards('), /clinicDayCards\(props\.items, dbGet\('contracts', \[\]\), types, fy, consTypeDayFee\)/);
  assert.match(cutFn('function ClinicDayCards('), /app\.fiscalYearStart/, '회계연도는 앱 설정에서');
});

/* 2026-10-01 「셀이 너무 크다 얇게 한 줄로 · 컨설팅관리에 들어와 있으면 수행」 — 목업 안 A */
test('★★ 한 줄 띠 — 큰 카드(24px 숫자·세 줄)가 돌아오지 않는다', () => {
  const ui = cutFn('function ClinicDayCards(');
  assert.doesNotMatch(ui, /fontSize:'24px'/, '★★ 큰 숫자 카드가 돌아왔습니다 — 표를 아래로 밀어냅니다');
  assert.match(ui, /whiteSpace:'nowrap', overflowX:'auto'/, '★ 띠는 한 줄 + 넘치면 옆으로');
  assert.doesNotMatch(ui, /큰 숫자 = 컨설팅관리에 들어온 일수/, '★ 늘 떠 있는 설명 줄은 말풍선으로 옮겼다');
});
test('★★ 큰 글씨는 «모두 몇 건» = 수행(컨설팅관리) + 예정(계약관리)', () => {
  const ui = cutFn('function ClinicDayCards(');
  assert.match(ui, /var all = s\.cnt \+ s\.planCnt;/);
  assert.match(ui, /all \+ '건'/);
  assert.match(ui, /\(b\.cnt \+ b\.planCnt\) - \(a\.cnt \+ a\.planCnt\)/, '많이 맡은 사람부터');
  // 셈: P-2 는 수행 1 + 예정 1 = 2건
  assert.equal(R.by['P-2'].cnt + R.by['P-2'].planCnt, 2);
});
