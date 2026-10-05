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
 'function clinicFeeDays(', 'function clinicDaysOf(', 'function clinicDayCards('].forEach((h) => vm.runInContext(cutFn(h), ctx));
vm.runInContext("var CLINIC_PLAN_STATUS = ['consult','review','negotiate','confirmed','signed','progress'];", ctx);
/* 「미수행 종료」 글자는 원본의 한 줄을 그대로 싣는다 — 여기서 다시 적으면 두 벌이 된다 */
vm.runInContext((src.match(/^var CLINIC_SKIP_REASON = .*$/m) || [''])[0], ctx);
vm.runInContext(cutFn('function clinicGovHint('), ctx);

const TYPES = [
  { code: 'consulting-x1', name: '현장클리닉', dayFee: 350000 },
  { code: 'consulting-x2', name: '기술보호' }
];
const fee = (code) => (code === 'consulting-x1' ? 350000 : 0);
/* 일수·추정 여부만 견준다 (feeDays 는 따로 본다) */
const DE = (r) => ({ days: r.days, est: r.est });
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
  assert.deepEqual(DE(ctx.clinicDaysOf({ consultDays: 3 }, 350000)), { days: 3, est: false });
  assert.deepEqual(DE(ctx.clinicDaysOf({ dayCalc: { days: 2 } }, 350000)), { days: 2, est: false });
  assert.deepEqual(DE(ctx.clinicDaysOf({ balanceFee: 1155000, balanceFeeVatIncluded: true }, 350000)), { days: 3, est: true });
  assert.deepEqual(DE(ctx.clinicDaysOf({ balanceFee: 700000 }, 350000)), { days: 2, est: true });
  assert.deepEqual(DE(ctx.clinicDaysOf({ balanceFee: 500000 }, 350000)), { days: 0, est: false }, '★ 억지 숫자를 만들지 않는다');
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
test('★ 사람마다 «어느 건»인지 목록이 남는다 — 계약관리 담당자별 한 해 목록 (2026-10-05)', () => {
  const rows = R.by['P-1'].rows;
  assert.ok(Array.isArray(rows) && rows.length === R.by['P-1'].cnt + R.by['P-1'].planCnt + R.by['P-1'].skip,
    '★ 수행·예정·미수행 종료 건이 모두 목록에 있어야 합니다');
  rows.forEach((x) => {
    assert.ok(['do', 'end', 'plan', 'skip'].includes(x.st), '구분: ' + x.st);
    assert.ok(!('amount' in x) && !('fee' in x) && !('balanceFee' in x), '★ 목록에는 금액을 넣지 않는다(대표 2026-10-05)');
  });
});
test('화면: 실적 띠는 계약관리에만(목록 열기) · 컨설팅관리에는 없다 · 카드는 셈 함수 하나를 쓴다', () => {
  /* 대표 지시 2026-10-05 「계약관리로 보내라 — 매번 계약할 때 확인」 · 같은 숫자를 두 곳에 두지 않는다 */
  const cm = cutFn('function ContractManagement(');
  assert.match(cm, /h\(ClinicDayCards, \{[^}]*listMode:true/, '★ 계약관리에 띠(목록 열기)가 있어야 합니다');
  assert.doesNotMatch(cutFn('function ProjectManagementShared('), /h\(ClinicDayCards,/, '★ 컨설팅관리에 띠가 남아 있으면 같은 숫자가 두 곳에 보입니다');
  assert.match(cutFn('function ClinicDayCards('), /clinicDayCards\(props\.items, dbGet\('contracts', \[\]\), types, fy, consTypeDayFee, prog\.isType, prog\.max\)/);
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

/* 2026-10-02 대표 보고 「7건이면 21일일 수 있는데 왜 15일인가」 — 실제 자료의 세 꼴 (번호는 가짜) */
test('★★ 잔금 1,150,000원(5천 원 덜) — 3일로 본다(0일로 버리지 않는다)', () => {
  assert.equal(ctx.clinicDaysOf({ balanceFee: 1150000, balanceFeeVatIncluded: true }, 350000).days, 3);
});
test('★★ 1,155,000원인데 「부가세 포함」이 꺼져 있어도 3일 — 금액은 부가세가 든 값이다', () => {
  const r = ctx.clinicDaysOf({ balanceFee: 1155000, balanceFeeVatIncluded: false }, 350000);
  assert.equal(r.days, 3); assert.equal(r.est, true);
});
test('부가세 없이 1,050,000원·포함 770,000원도 맞게', () => {
  assert.equal(ctx.clinicDaysOf({ balanceFee: 1050000 }, 350000).days, 3);
  assert.equal(ctx.clinicDaysOf({ balanceFee: 770000, balanceFeeVatIncluded: true }, 350000).days, 2);
});
test('★ 적힌 일수가 금액과 다르면 적힌 대로 세되 «어긋남»으로 알린다(고치지 않는다)', () => {
  const items = [{ id: 'z', no: '현클-2026-901', typeCode: 'consulting-x1', managerMain: 'P-9', startDate: '2026-09-14', consultDays: 2, balanceFee: 1155000, balanceFeeVatIncluded: true }];
  const r = ctx.clinicDayCards(items, [], TYPES, FY26, fee);
  assert.equal(r.by['P-9'].days, 2);
  assert.equal(r.by['P-9'].odd.length, 1);
  assert.equal(r.by['P-9'].odd[0].feeDays, 3);
});
test('끝난 건 수를 따로 센다 — 표에는 안 나오고 「📦 종료 보기」에 있다', () => {
  assert.equal(R.by['P-1'].done, 1);
});
test('★ 사람을 눌러도 상태 거르개는 그대로 — 고르개에 없는 값(all)을 넣지 않는다', () => {
  assert.equal(src.indexOf("setStatusFilter(sid ? 'all'"), -1);
});

/* ══ 수행 안 하고 끝난 건 · 확인 필요 (대표 지시 2026-10-04 「날짜와 진행 일수가 안 맞다 · 수행 안 하고 종료된 것도」
     + 「담당자들이 정부사업일정에 사진이나 일정 안 넣고 진행하는 경우도 많다 — 반영해라」) ══ */
const C = (o) => Object.assign({ typeCode: 'consulting-x1', managerMain: 'P-1', startDate: '2026-06-01' }, o);
test('★★ 「미수행 종료」 건은 수행 건수·일수에서 빠지고 따로 센다', () => {
  const r = ctx.clinicDayCards([
    C({ id: 'a', consultDays: 3, status: 'closed', closedReason: '정상 종료' }),
    C({ id: 'b', consultDays: 3, status: 'closed', closedReason: ctx.CLINIC_SKIP_REASON }),
  ], [], TYPES, FY26, fee);
  assert.equal(r.by['P-1'].cnt, 1);
  assert.equal(r.by['P-1'].days, 3);
  assert.equal(r.by['P-1'].skip, 1);
  assert.equal(r.total.skip, 1);
  assert.equal(ctx.CLINIC_SKIP_REASON, '미수행 종료');
});
test('★ 다른 종료 사유(계약 해지 등)는 «했는지»를 말하지 않으므로 그대로 센다', () => {
  const r = ctx.clinicDayCards([C({ id: 'a', consultDays: 2, status: 'closed', closedReason: '계약 해지' })], [], TYPES, FY26, fee);
  assert.equal(r.by['P-1'].days, 2);
});
test('★★ 확인 필요 = 끝났는데 «종료 사유 없음» 또는 «일수를 안 적어 금액으로만 짐작»', () => {
  const r = ctx.clinicDayCards([
    C({ id: 'noReason', consultDays: 3, status: 'closed' }),
    C({ id: 'est', balanceFee: 1155000, balanceFeeVatIncluded: true, status: 'closed', closedReason: '정상 종료' }),
    C({ id: 'ok', consultDays: 3, status: 'closed', closedReason: '정상 종료' }),
    C({ id: 'running', balanceFee: 1155000, balanceFeeVatIncluded: true, status: 'pending' }),
    C({ id: 'skipped', status: 'closed', closedReason: '미수행 종료' }),
  ], [], TYPES, FY26, fee);
  const ids = Array.from(r.check, (x) => x.rec.id).sort();
  assert.equal(ids.join(','), 'est,noReason', '확인 필요가 어긋났다: ' + ids.join(','));
  assert.equal(r.check.find((x) => x.rec.id === 'noReason').noReason, true);
  const es = r.check.find((x) => x.rec.id === 'est');
  assert.equal(es.est, true);
  assert.equal(es.days, 3);
});

const SCAL = {
  types: [{ id: 't3', name: '현장클리닉' }, { id: 't1', name: '일터혁신' }],
  cos: {
    g1: { id: 'g1', name: '㈜가나상사', erpId: 'erp-1' },
    g2: { id: 'g2', name: '다라테크' },
    g3: { id: 'g3', name: '마바산업' }, g4: { id: 'g4', name: '마바산업' },
    g5: { id: 'g5', name: '사아물산', mergedInto: 'g2' },
    g6: { id: 'g6', name: '자차', deleted: true },
  },
  scheds: [
    { coId: 'g1', typeId: 't3', date: '2026-06-05' }, { coId: 'g1', typeId: 't3', date: '2026-06-01' },
    { coId: 'g1', typeId: 't3', date: '2026-06-01' }, { coId: 'g1', typeId: 't1', date: '2026-06-09' },
    { coId: 'g2', typeId: 't3', date: '2026-07-01' }, { coId: 'g5', typeId: 't3', date: '2026-06-20' },
    { coId: 'g3', typeId: 't3', date: '2026-08-01' },
  ],
};
const norm = (s) => String(s || '').replace(/㈜|\s/g, '');
test('★ 정부사업일정 참고 — 이어진 사업장 먼저, 현장클리닉 일정만, 같은 날은 하루', () => {
  const g = ctx.clinicGovHint({ id: 'erp-1', companyName: '전혀 다른 이름' }, SCAL, norm);
  assert.equal(g.how, 'id');
  assert.deepEqual(Array.from(g.dates), ['2026-06-01', '2026-06-05']);
});
test('★ 정부사업일정 참고 — 이름은 «딱 하나»일 때만, 합쳐진 사업장 일정도', () => {
  const g = ctx.clinicGovHint({ id: 'x', companyName: '다라테크' }, SCAL, norm);
  assert.equal(g.how, 'name');
  assert.deepEqual(Array.from(g.dates), ['2026-06-20', '2026-07-01']);
  assert.equal(ctx.clinicGovHint({ id: 'x', companyName: '마바산업' }, SCAL, norm), null, '같은 이름이 둘인데 하나를 골랐다');
  assert.equal(ctx.clinicGovHint({ id: 'x', companyName: '자차' }, SCAL, norm), null, '지운 사업장을 봤다');
});

/* ── 화면 ── */
const bare = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1');
test('★★ 확인 창은 직접 저장하지 않는다 — 컨설팅관리 저장 길(itemPatch)로만, 정부사업일정엔 안 쓴다', () => {
  const m = bare(cutFn('function ClinicCheckModal('));
  for (const w of ['dbPatch', 'dbUpsert', 'dbSet', '.update(', '.set(', '.remove(', '.push(']) {
    assert.ok(!m.includes(w), '확인 창 안에 「' + w + '」 가 있다');
  }
  assert.match(m, /props\.onPatch\(x\.rec\.id, patch\)/);
  assert.match(m, /props\.canEdit/, '고칠 수 있는 사람을 안 가린다');
  /* 띠가 계약관리로 옮겨 갔다(2026-10-05) — 저장 길은 컨설팅관리와 같은 «컨설팅 한 건 dbPatch» 다 */
  assert.match(cutFn('function ContractManagement('), /dbPatch\('consultings', id, fields\)[\s\S]{0,400}?onPatch:patch/, '계약관리 띠가 컨설팅 저장 길을 안 넘긴다');
  assert.match(bare(cutFn('function ClinicDayCards(')), /canEdit: canCloseDirect/);
});
test('★ 종료 창에서 「미수행 종료」를 고를 수 있다', () => {
  assert.match(src, /h\('option', \{ value:CLINIC_SKIP_REASON \}/);
});
test('★ 띠에 「⚠ 확인 필요」 칩 — 셈 함수가 고른 건 수를 그대로', () => {
  assert.match(bare(cutFn('function ClinicDayCards(')), /'⚠ 확인 필요 ' \+ r\.check\.length/);
});
