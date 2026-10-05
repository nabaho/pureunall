'use strict';
/* 기술보호 — 1회차 30만원, «총 몇 회 했나» (대표 지시 2026-10-04 「기술보호컨설팅도 현장클리닉과 같이」 →
   목업 → 「추천대로 해라 · 셀은 너무 크게 하지 말고 작게」)
   ── 현장클리닉의 «단가 × 단위 수» 셈을 «회» 단위로 같이 쓴다. 같은 컴포넌트·같은 한 줄 칩.
   ── 정한 것: 1회 300,000원 · 부가세 «없음»(서버의 기술보호 잔금이 전부 900,000·600,000·300,000이라)
              · 최대 3회 · 사업마다 한 줄씩 · 회계연도는 현장클리닉과 같은 기준.

   못 박는 것(규칙) — «실제 함수를 돌려» 본다:
   ① 서버의 실제 유형(코드가 지어진 값, 이름 「통합기술보호지원단」)도 단가·단위·부가세를 찾는다
   ② 부가세 없음이면 합계 = 공급가, 「부가세포함」을 켜지 않는다 — 현장클리닉(별도 +10%)은 그대로
   ③ 두 사업이 서로의 건을 세지 않는다
   ④ 최대 3회를 넘는 «짐작»은 버린다 · 사람이 적은 값은 그대로 둔다
   ⑤ 띠는 «한 줄 칩»이다(큰 카드가 아니다) — 기술보호 줄이 컨설팅관리에 하나 더 붙는다
   ⑥ 일정관리의 맞추기 띠도 기술보호는 «회»로 읽는다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn.js');
const { stripJs } = require('./strip-comments.js');

const R = path.join(__dirname, '..');
const ERP_RAW = fs.readFileSync(path.join(R, 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');
const ERP = stripJs(ERP_RAW);
const GOV = fs.readFileSync(path.join(R, 'gov-consulting.html'), 'utf8').replace(/\r\n/g, '\n');
const fn = (n) => { const f = cutFn(ERP, 'function ' + n + '('); assert.ok(f, n + ' 를 못 찾았습니다'); return f; };
const DE = (x) => JSON.parse(JSON.stringify(x));          // vm 안에서 만든 객체 → 겉모양 같은 평범한 객체

/* 실제 씨앗표 — 소스에서 그대로 */
const SEED_SRC = ERP_RAW.slice(ERP_RAW.indexOf('var BIZ_CONS_SEED = ['), ERP_RAW.indexOf('var BIZ_FUND_SEED = ['));

/* 서버에 있는 «그대로의 모양» — 코드는 화면에서 지어진 값, 단가 칸은 없다 */
const TYPES = [
  { code: 'consulting-mp0w1084', short: '현클', name: '현장클리닉' },
  { code: 'consulting-mp0wogrl', short: '기보', name: '통합기술보호지원단' },
  { code: 'consulting-mozfisq7', short: '일터', name: '일터상생혁신컨설팅' },
];

function 세상(types, extra) {
  const ctx = Object.assign({
    console, Math, Number, String, Array, Object, JSON, parseInt, Date,
    dbGet: (k, d) => (k === 'biz_cons_types' ? types : (k === 'contracts' ? [] : (k === 'app_settings' ? {} : d))),
    todayYMD: () => '2026-10-04',
    useState: (v) => [v, () => {}],
    h(tag, props) { return { tag, props: props || {}, kids: Array.prototype.slice.call(arguments, 2) }; },
  }, extra || {});
  vm.createContext(ctx);
  vm.runInContext(SEED_SRC, ctx);
  /* clinicDayCards 가 쓰는 두 상수 — 소스의 한 줄을 그대로 싣는다(값을 여기 다시 적지 않는다) */
  ['var CLINIC_PLAN_STATUS = ', 'var CLINIC_SKIP_REASON = '].forEach((k) => {
    const a = ERP_RAW.indexOf(k); assert.ok(a >= 0, k + ' 를 못 찾았습니다');
    vm.runInContext(ERP_RAW.slice(a, ERP_RAW.indexOf('\n', a)), ctx);
  });
  vm.runInContext(['consNameKey', 'consTypeDayFee', 'consTypeDayOpt', 'consDayAmount', 'clinicIsType', 'techIsType',
    'clinicFeeDays', 'clinicDaysOf', 'clinicFyRange', 'clinicDayCards', 'clinicGovHint'].map(fn).join('\n'), ctx);
  return ctx;
}

test('① ★★ 서버의 실제 기술보호 유형도 단가·단위·부가세를 찾는다', () => {
  const w = 세상(TYPES);
  const t = DE(w.consTypeDayOpt('consulting-mp0wogrl'));
  assert.deepEqual(t, { fee: 300000, unit: '회', noVat: true },
    '★★ 서버 유형(이름 「통합기술보호지원단」)에서 기술보호 단가를 못 찾습니다 — 회차 칸이 영영 안 뜹니다');
  assert.deepEqual(DE(w.consTypeDayOpt('consulting-mp0w1084')), { fee: 350000, unit: '일', noVat: false },
    '★ 현장클리닉이 바뀌었습니다 — 일·부가세 별도 그대로여야 합니다');
  assert.equal(w.consTypeDayOpt('consulting-mozfisq7').fee, 0, '단가 없는 유형에 칸이 뜹니다');
  assert.equal(w.consTypeDayOpt('').fee, 0);
});

test('① 설정에서 고친 값이 이긴다 · 0 은 「쓰지 않는다」', () => {
  const edited = TYPES.map((x) => x.code === 'consulting-mp0wogrl' ? Object.assign({}, x, { dayFee: 330000, dayUnit: '일', dayVat: 'add' }) : x);
  assert.deepEqual(DE(세상(edited).consTypeDayOpt('consulting-mp0wogrl')), { fee: 330000, unit: '일', noVat: false },
    '설정에서 적은 단위·부가세가 이름 기본값에 밀립니다');
  const partial = TYPES.map((x) => x.code === 'consulting-mp0wogrl' ? Object.assign({}, x, { dayFee: 330000 }) : x);
  assert.deepEqual(DE(세상(partial).consTypeDayOpt('consulting-mp0wogrl')), { fee: 330000, unit: '회', noVat: true },
    '단가만 적고 단위·부가세를 안 적으면 «이름으로» 정한다(기술보호=회·부가세 없음)');
  const off = TYPES.map((x) => x.code === 'consulting-mp0wogrl' ? Object.assign({}, x, { dayFee: 0 }) : x);
  assert.equal(세상(off).consTypeDayOpt('consulting-mp0wogrl').fee, 0, '0 은 「쓰지 않는다」인데 씨앗이 되살아납니다');
});

test('② ★★ 부가세 없음이면 합계 = 공급가 — 현장클리닉(별도 +10%)은 모양까지 그대로', () => {
  const w = 세상(TYPES);
  assert.deepEqual(DE(w.consDayAmount(300000, 3, true)), { dayFee: 300000, days: 3, net: 900000, vat: 0, total: 900000, noVat: true });
  assert.deepEqual(DE(w.consDayAmount(300000, 1, true)).total, 300000);
  assert.deepEqual(DE(w.consDayAmount(350000, 3)), { dayFee: 350000, days: 3, net: 1050000, vat: 105000, total: 1155000 },
    '★★ 현장클리닉 셈의 결과 모양이 바뀌었습니다(noVat 칸이 새어 들어옴)');
  assert.equal(w.consDayAmount(300000, 0, true), null);
  assert.equal(w.consDayAmount(0, 3, true), null);
});

test('② 「잔금에 넣기」 — 부가세 없음이면 「부가세포함」을 켜지 않는다', () => {
  const run = (calc) => {
    let out = null;
    const c = { setF: (up) => { out = up({ successFee: 0, balanceFeeVatIncluded: true }); }, Object };
    vm.createContext(c);
    vm.runInContext(fn('_applyDayCalc') + '\n_applyDayCalc(' + JSON.stringify(calc) + ');', c);
    return DE(out);
  };
  const tech = run({ dayFee: 300000, days: 3, net: 900000, vat: 0, total: 900000, noVat: true });
  assert.equal(tech.successFee, 900000);
  assert.equal(tech.balanceFeeVatIncluded, false, '★★ 30만원 3회(900,000)를 «세금 든 값»으로 읽습니다 — 뒤에서 한 번 더 붙습니다');
  const clinic = run({ dayFee: 350000, days: 3, net: 1050000, vat: 105000, total: 1155000 });
  assert.equal(clinic.balanceFeeVatIncluded, true, '★ 현장클리닉은 「부가세포함」이 켜져야 합니다');
});

test('③ 두 사업은 서로의 건을 세지 않는다', () => {
  const w = 세상(TYPES);
  assert.equal(w.techIsType('consulting-mp0wogrl', TYPES), true);
  assert.equal(w.techIsType('consulting-mp0w1084', TYPES), false);
  assert.equal(w.techIsType('consulting-mozfisq7', TYPES), false);
  assert.equal(w.techIsType('cons-techguard', []), true, '씨앗 코드');
  assert.equal(w.techIsType('', TYPES), false);
  assert.equal(w.clinicIsType('consulting-mp0wogrl', TYPES), false, '★ 기술보호가 현장클리닉으로 셉니다');
});

const FY = { year: 2026, start: '2026-01-01', end: '2026-12-31' };
const C = (o) => Object.assign({ id: 'x' + Math.random(), typeCode: 'consulting-mp0wogrl', managerMain: 'P-1', status: 'pending',
  startDate: '2026-06-01', balanceFee: 900000, balanceFeeVatIncluded: false }, o);

test('④ ★★ 최대 3회를 넘는 짐작은 버리고, 사람이 적은 값은 그대로 둔다', () => {
  const w = 세상(TYPES);
  assert.deepEqual(DE(w.clinicDaysOf({ balanceFee: 900000 }, 300000, 3)), { days: 3, est: true, feeDays: 3 });
  assert.deepEqual(DE(w.clinicDaysOf({ balanceFee: 600000 }, 300000, 3)), { days: 2, est: true, feeDays: 2 });
  assert.equal(w.clinicDaysOf({ balanceFee: 1200000 }, 300000, 3).days, 0, '★★ 120만 원 ÷ 30만 원 = 4회 — 최대 3회를 넘는 숫자를 짐작했습니다');
  assert.equal(w.clinicDaysOf({ balanceFee: 1200000 }, 300000).days, 4, '한도를 안 주면(현장클리닉) 짐작을 막지 않는다');
  assert.equal(w.clinicDaysOf({ consultDays: 2, balanceFee: 1200000 }, 300000, 3).days, 2, '사람이 적은 값이 우선');
  assert.equal(w.clinicDaysOf({ consultDays: 5 }, 300000, 3).days, 5, '사람이 적은 값은 한도로 깎지 않는다');
  assert.equal(w.clinicDaysOf({ balanceFee: 990000, balanceFeeVatIncluded: true }, 300000, 3).days, 3, '부가세 든 금액도 3회');
});

test('③ ★★ 기술보호 셈 — 수행·예정·확인 필요·미수행, 현장클리닉 건은 안 센다', () => {
  const w = 세상(TYPES);
  const items = [
    C({ id: 'a', status: 'closed', closedReason: '정상 종료' }),                                   // 끝남 · 일수 안 적음 → ≈3 · 확인 필요
    C({ id: 'b' }),                                                                               // 진행 900,000 → ≈3
    C({ id: 'c', balanceFee: 300000 }),                                                           // 진행 300,000 → ≈1
    C({ id: 'd', status: 'closed', closedReason: '미수행 종료' }),                                // 미수행 → 셈에서 뺀다
    C({ id: 'e', typeCode: 'consulting-mp0w1084', balanceFee: 1155000, balanceFeeVatIncluded: true }), // 현장클리닉 → 기술보호에서 안 센다
    C({ id: 'f', startDate: '2025-12-31' }),                                                       // 지난 회계연도
  ];
  const contracts = [{ id: 'k1', managerMain: 'P-1', status: 'signed', kinds: ['consulting'], typeCodes: { consulting: 'consulting-mp0wogrl' }, consultDays: 1, startDate: '2026-09-18' },
    { id: 'k2', managerMain: 'P-1', status: 'cancelled', kinds: ['consulting'], typeCodes: { consulting: 'consulting-mp0wogrl' }, consultDays: 3, startDate: '2026-08-06' }];
  const r = w.clinicDayCards(items, contracts, TYPES, FY, w.consTypeDayFee, w.techIsType, 3);
  assert.equal(r.total.cnt, 3, '수행 건수(끝남 1 + 진행 2) — 미수행·현장클리닉·지난 해는 빠집니다');
  assert.equal(r.total.days, 3 + 3 + 1, '회차 합');
  assert.equal(r.total.skip, 1, '「미수행 종료」는 따로 센다');
  assert.equal(r.total.planCnt, 1, '예정은 계약관리의 이관 전·유효 건(취소는 뺀다)');
  assert.equal(r.total.planDays, 1);
  assert.deepEqual(Array.from(r.check, (x) => x.rec.id), ['a'], '끝났는데 회차를 안 적어 짐작한 건만 확인 필요');
  /* 같은 자료를 기본(현장클리닉)으로 세면 기술보호 건이 하나도 안 잡힌다 */
  const clinic = w.clinicDayCards(items, [], TYPES, FY, w.consTypeDayFee);
  assert.equal(clinic.total.cnt, 1, '★★ 기본(현장클리닉)이 기술보호 건을 같이 셉니다');
  assert.equal(clinic.total.days, 3);
});

test('③ 정부사업일정 참고 — 기술보호는 «기술보호» 사업의 방문만 본다', () => {
  const w = 세상(TYPES);
  const SCAL = {
    types: { t3: { id: 't3', name: '현장클리닉' }, t4: { id: 't4', name: '기술보호', fullName: '기술보호울타리' } },
    cos: { c1: { id: 'c1', name: '가나상사', erpId: 'e1' } },
    scheds: { s1: { id: 's1', coId: 'c1', typeId: 't4', date: '2026-07-01' }, s2: { id: 's2', coId: 'c1', typeId: 't3', date: '2026-07-02' } },
  };
  const norm = (s) => String(s || '').replace(/\s/g, '');
  const tech = w.clinicGovHint({ id: 'e1', companyName: '가나상사' }, SCAL, norm, (nk) => nk.indexOf('기술보호') >= 0);
  assert.deepEqual(Array.from(tech.dates), ['2026-07-01'], '★★ 기술보호 방문에 현장클리닉 날짜가 섞였습니다');
  const clinic = w.clinicGovHint({ id: 'e1', companyName: '가나상사' }, SCAL, norm);
  assert.deepEqual(Array.from(clinic.dates), ['2026-07-02'], '기본은 현장클리닉 그대로');
});

/* ───── ⑤ 띠를 «실제로 그려» 본다 ───── */
function 그린다(prog, items) {
  const w = 세상(TYPES);
  const ctx = w;
  vm.runInContext(['techIsType', 'clinicIsType'].length ? '' : '', ctx);
  const progSrc = ERP_RAW.slice(ERP_RAW.indexOf('var UNIT_PROGS = {'), ERP_RAW.indexOf('function ClinicDayCards('));
  vm.runInContext(progSrc + '\n' + fn('ClinicDayCards'), ctx);
  ctx.__props = { items, types: TYPES, userName: () => '권형하', pickedSid: '', pickedType: '', onPick() {}, onPatch() {},
    prog: prog === 'tech' ? vm.runInContext('UNIT_PROGS.tech', ctx) : undefined };
  const node = vm.runInContext('ClinicDayCards(__props)', ctx);
  return node ? JSON.stringify(node) : null;
}

test('⑤ ★★ 기술보호 띠 — 한 줄 칩에 «회»로 적힌다', () => {
  const html = 그린다('tech', [C({ id: 'a', status: 'closed', closedReason: '정상 종료' }), C({ id: 'b' }), C({ id: 'c', balanceFee: 300000 })]);
  assert.ok(html, '기술보호 건이 있는데 띠가 안 그려집니다');
  assert.match(html, /🛡 기술보호/, '띠 이름');
  assert.match(html, /7회/, '★★ 3회+3회+1회 = 7회 가 칩에 «회»로 안 적혔습니다');
  assert.doesNotMatch(html, /7일/, '★★ 기술보호가 «일»로 적힙니다');
  assert.match(html, /⚠ 확인 필요 1/, '끝났는데 회차를 안 적은 건이 확인 필요에 안 올랐습니다');
  assert.match(html, /"whiteSpace":"nowrap","overflowX":"auto"/, '★ 한 줄 + 넘치면 옆으로 — 큰 카드가 아니다');
  assert.doesNotMatch(html, /"fontSize":"24px"/, '★★ 큰 숫자가 돌아왔습니다');
});

test('④ ⑤ ★★ 띠가 기술보호의 최대 3회를 실제로 건다 — 4회로 읽히는 잔금은 세지 않는다', () => {
  /* 검사고정-허용: 기술보호는 최대 3회·의무방문 3회가 규칙이다(대표 확인 2026-10-04, 일정관리 종류의 최대회차와 같다) */
  const w = 세상(TYPES);
  const progSrc = ERP_RAW.slice(ERP_RAW.indexOf('var UNIT_PROGS = {'), ERP_RAW.indexOf('function ClinicDayCards('));
  vm.runInContext(progSrc, w);
  assert.equal(vm.runInContext('UNIT_PROGS.tech.max', w), 3, '기술보호 최대 회차');
  assert.equal(vm.runInContext('UNIT_PROGS.tech.unit', w), '회');
  assert.equal(vm.runInContext('UNIT_PROGS.clinic.max', w), 0, '현장클리닉은 한도가 없다');
  assert.equal(vm.runInContext('UNIT_PROGS.clinic.unit', w), '일');
  const html = 그린다('tech', [C({ id: 'z', balanceFee: 1200000 })]);
  assert.doesNotMatch(html, /4회/, '★★ 120만 원을 4회로 셌습니다 — 기술보호는 최대 3회입니다');
});

test('⑤ 기술보호 건이 한 건도 없으면 띠를 그리지 않는다 · 현장클리닉 띠는 «일» 그대로', () => {
  assert.equal(그린다('tech', [C({ id: 'e', typeCode: 'consulting-mp0w1084', balanceFee: 1155000, balanceFeeVatIncluded: true })]), null,
    '빈 줄은 잔소리다');
  const clinic = 그린다('clinic', [C({ id: 'e', typeCode: 'consulting-mp0w1084', balanceFee: 1155000, balanceFeeVatIncluded: true })]);
  assert.match(clinic, /🏥 현장클리닉/);
  assert.match(clinic, /3일/, '현장클리닉은 일 단위 그대로');
  assert.doesNotMatch(clinic, /3회/);
});

test('⑤ 계약관리 띠에 기술보호 줄이 «하나 더» 붙는다 · 확인 창은 사업 설명서를 받는다', () => {
  /* 2026-10-05 #2000: 띠가 컨설팅관리에서 계약관리로 옮겨졌다(대표 「매번 계약할 때 확인이 필요하다」) — 접힘 단추(unitStrip) 안.
     자리가 바뀌어도 «기술보호 줄이 현장클리닉 줄 옆에 하나 더» 붙는다는 것은 그대로다. */
  assert.match(ERP, /unitStrip && \(function\(\)\{[\s\S]{0,1600}?h\(ClinicDayCards, \{ key:'clinic', prog: UNIT_PROGS\.clinic,[^\n]*\n\s*h\(ClinicDayCards, \{ key:'tech', prog: UNIT_PROGS\.tech,/,
    '★★ 기술보호 줄이 안 붙었습니다');
  assert.match(fn('ClinicDayCards'), /ckOpen && h\(ClinicCheckModal, \{ prog: prog,/, '확인 창이 어느 사업인지 모릅니다');
  const modal = fn('ClinicCheckModal');
  assert.match(modal, /prog\.max > 0 && n > prog\.max/, '★★ 최대 3회를 손으로 쳐서 넘길 수 있습니다');
  assert.match(modal, /max:\(prog\.max > 0 \? prog\.max : 30\)/, '입력 칸의 최대치');
  assert.match(modal, /clinicGovHint\(x\.rec, scal, pcNormCo, prog\.govMatch\)/, '정부사업일정 참고가 사업을 안 가립니다');
});

test('⑥ 일정관리 맞추기 띠 — 기술보호는 「3회」, 현장클리닉은 「3일」로 읽는다', () => {
  const run = (typeName) => {
    const ctx = { co_editId: 'co1', erpDaysForCoType: () => 3, getTypes: () => [{ id: 'tx', name: typeName, fullName: typeName }] };
    vm.createContext(ctx);
    const i = GOV.indexOf('function erpDaysNote('); let d = 0, s = false, j = i;
    for (; j < GOV.length; j++) { if (GOV[j] === '{') { d++; s = true; } else if (GOV[j] === '}') { d--; if (s && !d) break; } }
    vm.runInContext(GOV.slice(i, j + 1), ctx);
    return ctx.erpDaysNote('tx', 2);
  };
  assert.match(run('기술보호울타리'), /<b>3회<\/b>라고 적혀 있습니다/, '★★ 기술보호 계약을 「3일」로 읽습니다');
  assert.match(run('현장클리닉'), /<b>3일<\/b>이라고 적혀 있습니다/, '현장클리닉은 일 그대로');
});
