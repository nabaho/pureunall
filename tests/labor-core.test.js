/* 노동법 계산 코어 검산 — js/pu-labor-core.js
   급여는 법적 책임 행위다. "화면에서 눌러 봤더니 맞더라"로는 못 믿는다.
   여기서 법 조문별로 손계산과 맞춰 본다. 실행: node tests/labor-core.test.js */
const path = require('path');
const L = require(path.join(__dirname, '..', 'js', 'pu-labor-core.js'));

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? ' — ' + extra : '')); }
}
function eq(name, got, want) {
  ok(name + ' (=' + want + ')', got === want, '실제 ' + got);
}
function near(name, got, want, tol) {
  ok(name + ' (≈' + want + ')', Math.abs(got - want) <= (tol == null ? 0.01 : tol), '실제 ' + got);
}
function section(t) { console.log('\n── ' + t + ' ──'); }

/* ══════════ 통상임금 (근기법 시행령 6조) ══════════ */
section('통상임금·소정근로시간');
eq('월 통상임금 209만 ÷ 209h = 시급 1만', L.hourlyOrdinary(2090000, { monthlyStdHours: 209 }), 10000);
near('주40h → 월 소정근로시간 208.6h', L.monthlyStdHoursFrom(40), 208.6, 0.1);
eq('주40h 주휴 유급시간 = 8h', L.weeklyHolidayHours(40), 8);
eq('주20h 단시간 주휴 = 4h (비례)', L.weeklyHolidayHours(20), 4);
eq('주14h 초단시간 주휴 = 0 (근기법 18조3항)', L.weeklyHolidayHours(14), 0);

/* ══════════ 근태 집계 ══════════ */
section('근태 — 시간 세기');
eq('09:00~19:30 휴게 60분 = 9.5h', L.dayWorkedHours({ in: '09:00', out: '19:30', breakMin: 60 }), 9.5);
eq('18:00~02:00 야간(22~06) = 240분', L.nightMinutes(L.hm('18:00'), L.hm('02:00')), 240);
eq('09:00~18:00 야간 = 0분', L.nightMinutes(L.hm('09:00'), L.hm('18:00')), 0);
eq('2026-03-02는 월요일', L.dow('2026-03-02'), 1);
eq('주 시작(월요일) 계산', L.weekStart('2026-03-05'), '2026-03-02');

// 월~금 각 10시간 → 일연장 2h×5=10h. 소정내 40h라 주40h 초과는 없다(중복 금지)
const wk10 = ['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06']
  .map(d => ({ date: d, hours: 10 }));
const a1 = L.summarizeAttendance(wk10, {});
eq('일 8h 초과 연장 = 10h', a1.합계.연장, 10);
eq('연장 중복계산 없음(주40h 초과분 0)', a1.주별[0].주연장추가, 0);
eq('실근로 50h', a1.합계.실근로, 50);

// 월~토 각 7시간 = 42h → 일연장 0, 주40h 초과 2h만 연장
const wk7 = ['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06', '2026-03-07']
  .map(d => ({ date: d, hours: 7 }));
const a2 = L.summarizeAttendance(wk7, {});
eq('일연장 0 (하루 7h)', a2.주별[0].일연장, 0);
eq('주 40h 초과분 2h가 연장', a2.합계.연장, 2);

// 주휴 — 월~금 8h 개근
const wk8 = ['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06']
  .map(d => ({ date: d, hours: 8 }));
const a3 = L.summarizeAttendance(wk8, {});
eq('개근 시 주휴 8h 발생(근기법 55조)', a3.주휴시간, 8);
// 결근이 있으면 주휴 없음
const a4 = L.summarizeAttendance(wk8.slice(0, 4).concat([{ date: '2026-03-06', type: 'absent' }]), {});
eq('결근 있으면 주휴 0', a4.주휴시간, 0);
eq('결근 1일 집계', a4.합계.결근일수, 1);

// 휴일근로 (일요일 2026-03-01)
const a5 = L.summarizeAttendance([{ date: '2026-03-01', hours: 10 }], {});
eq('휴일 8h 이내 = 8h', a5.합계.휴일8이내, 8);
eq('휴일 8h 초과 = 2h', a5.합계.휴일8초과, 2);
eq('휴일근로는 연장에 넣지 않음(중복 금지)', a5.합계.연장, 0);

// 연장 주 12시간 한도(근기법 53조) — 막지 않고 알린다
const wk16 = ['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06']
  .map(d => ({ date: d, hours: 12 }));
const a6 = L.summarizeAttendance(wk16, {});
eq('연장 20h → 주 12h 한도 초과 경고', a6.연장한도초과주.length, 1);

/* ══════════ 법정수당 (근기법 56조) ══════════ */
section('법정수당 — 가산');
const al1 = L.statutoryAllowances(a1, 10000, {});
eq('연장 10h × 1.5 = 150,000', al1.연장수당, 150000);
const al2 = L.statutoryAllowances(a5, 10000, {});
eq('휴일 8h×1.5 + 2h×2.0 = 160,000', al2.휴일수당, 160000);
const alNight = L.statutoryAllowances({ 합계: { 야간: 4 }, 주휴시간: 0 }, 10000, {});
eq('야간 4h × 0.5(가산분) = 20,000', alNight.야간수당, 20000);
// 5인 미만은 가산 미적용(근기법 56조 적용 제외)
const al3 = L.statutoryAllowances(a1, 10000, { policy: { fiveOrMore: false } });
eq('5인 미만 연장 10h × 1.0 = 100,000', al3.연장수당, 100000);
eq('5인 미만 야간가산 0', L.statutoryAllowances({ 합계: { 야간: 4 } }, 10000, { policy: { fiveOrMore: false } }).야간수당, 0);
// 주휴수당은 월급제에 이미 포함 → 이중지급 금지
eq('월급제 주휴수당 0 (월급에 포함)', L.statutoryAllowances(a3, 10000, { payType: 'monthly' }).주휴수당, 0);
eq('시급제 주휴수당 8h = 80,000', L.statutoryAllowances(a3, 10000, { payType: 'hourly' }).주휴수당, 80000);

section('포괄임금 차액 · 최저임금');
const fx = L.checkFixedOT(100000, { 법정수당합계: 150000 });
eq('고정 연장수당 부족액 50,000', fx.부족액, 50000);
eq('부족 판정', fx.판정, 'short');
eq('충분하면 ok', L.checkFixedOT(200000, { 법정수당합계: 150000 }).판정, 'ok');
const mw = L.checkMinWage({ 산입임금: 1800000, 소정근로시간: 209, 주휴시간: 0, minWageHourly: 10320 });
eq('최저임금 위반 판정', mw.판정, 'violation');
eq('환산시급 8,612원', mw.환산시급, 8612);
eq('최저임금 충족 판정', L.checkMinWage({ 산입임금: 2200000, 소정근로시간: 209, minWageHourly: 10320 }).판정, 'ok');

/* ══════════ 연차 (근기법 60조) ══════════ */
section('연차 발생');
eq('1년 미만 5개월 개근 = 5일', L.accrueAnnual({ hireDate: '2026-01-01', asOf: '2026-06-01' }).발생일수, 5);
eq('1년 미만 한도 11일', L.accrueAnnual({ hireDate: '2025-01-01', asOf: '2025-12-25' }).발생일수, 11);
eq('1년차 = 15일', L.accrueAnnual({ hireDate: '2025-01-01', asOf: '2026-01-01' }).발생일수, 15);
eq('3년차 = 16일 (가산 1)', L.accrueAnnual({ hireDate: '2023-01-01', asOf: '2026-01-01' }).발생일수, 16);
eq('5년차 = 17일 (가산 2)', L.accrueAnnual({ hireDate: '2021-01-01', asOf: '2026-01-01' }).발생일수, 17);
eq('21년차 = 25일 (한도)', L.accrueAnnual({ hireDate: '2005-01-01', asOf: '2026-01-01' }).발생일수, 25);
eq('25년차도 25일 한도 유지', L.accrueAnnual({ hireDate: '2001-01-01', asOf: '2026-01-01' }).발생일수, 25);
eq('5인 미만 = 연차 0 (60조 적용 제외)',
  L.accrueAnnual({ hireDate: '2020-01-01', asOf: '2026-01-01', policy: { fiveOrMore: false } }).발생일수, 0);
eq('출근율 80% 미만 → 개근 월수만큼(8일)',
  L.accrueAnnual({ hireDate: '2020-01-01', asOf: '2026-01-01', attendanceRate: 0.7, perfectMonths: 8 }).발생일수, 8);
ok('회계연도 첫해 비례 발생 계산됨',
  L.accrueAnnualFiscalFirstYear('2026-07-01').발생일수 > 0 && L.accrueAnnualFiscalFirstYear('2026-07-01').발생일수 < 15,
  JSON.stringify(L.accrueAnnualFiscalFirstYear('2026-07-01')));

section('연차 대장·수당·촉진');
const lg = L.annualLedger({ 발생일수: 15, 이월일수: 3, 사용일수: 20 });
eq('잔여 -2일', lg.잔여일수, -2);
eq('초과사용 2일', lg.초과사용, 2);
ok('초과사용 경고 문구 있음', !!lg.경고);
const lgHr = L.annualLedger({ 발생일수: 15, 이월일수: 0, 사용일수: 2, 사용시간: 2, policy: { dailyContractHours: 8 } });
eq('시간차 2h(8h 기준 0.25일) → 총 사용 2.25일', lgHr.사용일수, 2.25);
eq('시간차 반영 잔여일수 12.75일', lgHr.잔여일수, 12.75);
eq('시간차 반영 잔여시간 102h', lgHr.잔여시간, 102);
eq('시간차 반영 미사용수당 102h × 1만 = 1,020,000', L.annualUnusedPay({ 미사용일수: lgHr.잔여일수, 미사용시간: lgHr.잔여시간, 시급: 10000 }).금액, 1020000);
const attHr = L.summarizeAttendance([
  { date: '2026-03-02', type: 'hourleave', leaveHours: 3, in: '13:00', out: '18:00', breakMin: 0 },
  { date: '2026-03-03', type: 'quarter', leaveHours: 2 }
]);
eq('일별 시간차(3h) + 반반차(2h) = 연차사용시간 5h', attHr.합계.연차사용시간, 5);
eq('일별 시간차(3h) + 반반차(2h) = 연차사용 0.625일', attHr.합계.연차사용, 0.625);
const up = L.annualUnusedPay({ 미사용일수: 5, 시급: 10000 });
eq('연차수당 5일 × 8h × 1만 = 400,000', up.금액, 400000);
eq('촉진 적법 이행 → 수당 0 (61조)', L.annualUnusedPay({ 미사용일수: 5, 시급: 10000, 촉진적법: true }).금액, 0);
ok('촉진 미이행 → 지급의무 있음', L.annualUnusedPay({ 미사용일수: 5, 시급: 10000, 촉진적법: false }).지급의무 === true);
const ps = L.promotionSchedule('2026-12-31');
eq('1차 촉진 기한 = 소멸 6개월 전', ps['1차촉진기한'], '2026-06-30');
eq('2차 촉진 기한 = 소멸 2개월 전', ps['2차촉진기한'], '2026-10-31');
const ps1 = L.promotionSchedule('2026-12-31', 'under1');
eq('1년 미만은 3개월 전 1차', ps1['1차촉진기한'], '2026-09-30');
eq('1년 미만은 1개월 전 2차', ps1['2차촉진기한'], '2026-11-30');

section('휴가 종류·보상휴가');
ok('법정휴가 12종 이상 등재', L.LEAVE_KINDS.length >= 12, '실제 ' + L.LEAVE_KINDS.length);
eq('배우자 출산휴가 20일', L.leaveKind('spouse').days, 20);
eq('출산전후휴가 90일(다태아 120)', L.leaveKind('maternity').days, 90);
eq('육아휴직 무급(고용보험)', L.leaveKind('childcare').paid, false);
eq('가족돌봄휴가 10일', L.leaveKind('family').days, 10);
const cl = L.compLeaveHours({ 합계: { 연장: 3.5 } });
eq('보상휴가 연장 3.5h → 5.25h (57조)', cl.휴가시간, 5.25);

/* ══════════ 퇴직금 (퇴직급여법) ══════════ */
section('평균임금·퇴직금');
const aw = L.averageWage({ 기간임금총액: 9000000, 기간일수: 91, 통상일급: 100000 });
eq('평균임금 < 통상임금 → 통상임금 적용(근기법 2조2항)', aw.통상임금적용, true);
eq('일평균임금 = 통상일급 100,000', aw.일평균임금, 100000);
near('산정 평균임금 98,901', aw.산정평균임금, 98901.1, 0.2);
const aw2 = L.averageWage({ 기간임금총액: 12000000, 기간일수: 91, 통상일급: 100000, 연간상여: 4000000 });
ok('상여 3/12 산입됨', aw2.상여산입액 === 1000000, '실제 ' + aw2.상여산입액);
ok('평균임금이 통상임금보다 크면 그대로', aw2.통상임금적용 === false && aw2.일평균임금 > 100000);

const sv = L.severancePay({ 일평균임금: 100000, 입사일: '2024-01-01', 퇴사일: '2025-12-31' });
eq('재직일수 731일', sv.재직일수, 731);
eq('퇴직금 = 1일평균 × 30 × 731/365', sv.금액, 6008219);
eq('1년 미만 퇴직금 0', L.severancePay({ 일평균임금: 100000, 입사일: '2025-01-01', 퇴사일: '2025-12-30' }).금액, 0);
eq('주 15h 미만 퇴직금 대상 아님',
  L.severancePay({ 일평균임금: 100000, 재직일수: 800, 주소정근로시간: 10 }).지급의무, false);

section('퇴직연금·퇴직소득세');
const dc = L.dcContribution({ 연간임금총액: 36000000, 실제납입액: 2500000 });
eq('DC 최소부담금 = 연간/12 = 300만', dc.최소부담금, 3000000);
eq('DC 부족액 50만', dc.부족액, 500000);
eq('DC 부족 판정', dc.판정, 'short');
const rt = L.retirementIncomeTax({ 퇴직급여: 30000000, 근속년수: 10 });
eq('근속연수공제 10년 = 1,500만', rt.근속연수공제, 15000000);
eq('환산급여 1,800만', rt.환산급여, 18000000);
eq('환산급여공제 1,400만', rt.환산급여공제, 14000000);
eq('과세표준 400만', rt.과세표준, 4000000);
eq('퇴직소득세 200,000', rt.소득세, 200000);
eq('지방소득세 20,000', rt.지방소득세, 20000);
eq('기본세율 1,400만 이하 6%', L.basicTax(14000000), 840000);
eq('기본세율 5,000만 구간 누진공제', L.basicTax(50000000), 50000000 * 0.15 - 1260000);

/* ══════════ 4대보험·급여 통합 ══════════ */
section('4대보험·지방세');
eq('지방세 = 소득세×10% 10원절사', L.localIncomeTax(123456), 12340);
eq('지방세 0원 처리', L.localIncomeTax(0), 0);
const ins = L.insuranceEmployee({ 과세총액: 3000000, 연도: 2025 });
eq('국민연금 4.5% (2025)', ins.국민연금, 135000);
/* 2026-10-07: 요율표를 안 넘겨도 2026년이면 2026년 요율을 써야 한다 (전엔 2025 값이 박혀 있었다) */
const i26 = L.insuranceEmployee({ 과세총액: 3000000, 연도: 2026 });
eq('국민연금 4.75% (2026)', i26.국민연금, 142500);
eq('건강보험 3.595% (2026)', i26.건강보험, Math.floor(3000000 * 0.03595));
eq('장기요양 건보×13.14% (2026)', i26.장기요양, Math.floor(Math.floor(3000000 * 0.03595) * 0.1314));
eq('고용보험 0.9% (2026)', i26.고용보험, 27000);
const i25 = L.insuranceEmployee({ 과세총액: 3000000, 연도: 2025 });
eq('장기요양 건보×12.95% (2025)', i25.장기요양, Math.floor(Math.floor(3000000 * 0.03545) * 0.1295));
const i30 = L.insuranceEmployee({ 과세총액: 3000000, 연도: 2030 });
eq('표에 없는 해는 가장 가까운 앞 해 값', i30.국민연금, 142500);
ok('근거에 연도가 남는다', /^2026년 요율/.test(i26.근거));
eq('요율계산 모드', ins.모드, '요율계산');
const ins2 = L.insuranceEmployee({ 과세총액: 3000000, 고지_국민연금: 120000, 고지_건강보험: 100000 });
eq('고지액이 계산값을 이긴다', ins2.국민연금, 120000);
eq('고지액 모드 표시', ins2.모드, '고지액');

section('월 급여 통합 — 지급 − 공제 = 실수령');
const mp = L.monthlyPayroll({
  기본급: 2090000, 근태기록: wk10, 소득세: 30000
});
eq('시급 1만 자동 산출', mp.시급, 10000);
eq('연장수당 150,000 반영', mp.지급.연장수당, 150000);
eq('지급총액 2,240,000', mp.지급.지급총액, 2240000);
ok('지급총액 − 공제총액 = 실수령 (검산)',
  mp.지급.지급총액 - mp.공제.공제총액 === mp.실수령,
  mp.지급.지급총액 + ' - ' + mp.공제.공제총액 + ' ≠ ' + mp.실수령);

/* 2026년 최저임금 10,320원 × 209h = 2,156,880원.
   ⚠ 기본급 209만원은 최저임금 **미달**이다 — 코어가 이것을 잡아내는지 본다.
     (설계할 때 209만/209h=시급1만 을 "정상"이라 착각하기 쉬운 지점) */
const mpUnder = L.monthlyPayroll({ 기본급: 2090000, 최저임금시급: 10320, 소득세: 0 });
ok('최저임금 검증 결과 포함', !!mpUnder.검증.최저임금);
eq('기본급 209만원 = 2026 최저임금 미달 적발', mpUnder.검증.최저임금.판정, 'violation');
const mpOk = L.monthlyPayroll({ 기본급: 2200000, 최저임금시급: 10320, 소득세: 30000 });
eq('기본급 220만원은 최저임금 충족', mpOk.검증.최저임금.판정, 'ok');
eq('충족이면 초록 신호', mpOk.검증.신호, 'green');
const mpBad = L.monthlyPayroll({ 기본급: 1500000, 최저임금시급: 10320, 소득세: 0 });
eq('최저임금 미달이면 빨강 신호', mpBad.검증.신호, 'red');
const mpNoTax = L.monthlyPayroll({ 기본급: 2200000, 최저임금시급: 10320 });
ok('소득세 표 없으면 조용히 0으로 두지 않고 표시', mpNoTax.검증.소득세미정 === true);
eq('소득세 미정이면 주황 신호', mpNoTax.검증.신호, 'orange');


/* ══════════ 근로소득 간이세액표 (소득세법 134조) ══════════
   ⚠ 국세청은 산출 산식을 공개하지 않는다 — 표 자체가 법적 기준이다.
     그래서 여기서는 **국세청이 공표한 예시**로 맞춰 본다:
       월 급여 3,500,000원 · 공제대상가족 4명 → 49,340원
       그중 8~20세 자녀가 2명이면 → 49,340 − 29,160 = 20,180원 (2024.2.29 개정판)
     아래 TT 는 그 **2024년판** 자녀공제를 담은 작은 연습용 표다.
     실제 내장 표(2026년판)는 맨 아래 「내장 간이세액표」 묶음에서 따로 검산한다. */
section('간이세액표 — 국세청 공표 예시로 검산 (2024년판 자녀공제)');
const TT = {
  연도: '2025',
  자녀공제: { one: 12500, two: 29160, extra: 25000 },
  rows: [
    { min: 1060000, max: 1065000, tax: [1040, 0, 0, 0, 0] },
    { min: 3500000, max: 3505000, tax: [127220, 102220, 74450, 49340, 30500] },
    { min: 10000000, max: null, tax: [1500000, 1400000, 1300000, 1200000, 1100000] }
  ]
};
eq('2024년판 자녀 1명 공제 12,500', L.childCredit(1, TT), 12500);
eq('2024년판 자녀 2명 공제 29,160', L.childCredit(2, TT), 29160);
eq('2024년판 자녀 3명 = 29,160 + 25,000', L.childCredit(3, TT), 54160);
eq('2024년판 자녀 4명 = 29,160 + 25,000×2', L.childCredit(4, TT), 79160);
eq('자녀 0명 공제 없음', L.childCredit(0, TT), 0);
// 표에 자녀공제가 없으면 현행(2026.2.27 개정) 금액
eq('현행 자녀 1명 20,830', L.childCredit(1), 20830);
eq('현행 자녀 2명 45,830', L.childCredit(2), 45830);
eq('현행 자녀 3명 = 45,830 + 33,330', L.childCredit(3), 79160);

eq('★ 국세청 예시 — 월350만·가족4명 = 49,340원',
  L.withholdingTax({ 월과세급여: 3500000, 부양가족수: 4, table: TT }).소득세, 49340);
eq('★ 국세청 예시 — 자녀 2명이면 20,180원',
  L.withholdingTax({ 월과세급여: 3500000, 부양가족수: 4, 자녀수: 2, table: TT }).소득세, 20180);
eq('가족 1명은 첫 칸', L.withholdingTax({ 월과세급여: 3500000, 부양가족수: 1, table: TT }).소득세, 127220);
eq('가족 칸이 11개가 아닌 표는 마지막 칸(0으로 떨어지지 않는다)',
  L.withholdingTax({ 월과세급여: 3500000, 부양가족수: 11, table: TT }).소득세, 30500);
// 급여가 표 하한보다 적으면 세액 0원이 정답 — 단시간·일용에서 경고가 뜨면 안 된다
const low = L.withholdingTax({ 월과세급여: 500000, 부양가족수: 1, table: TT });
eq('표 하한 미달 → 세액 0원', low.소득세, 0);
eq('표 하한 미달은 정상 상태(경고 아님)', low.상태, 'ok');
// 마지막 구간은 상한이 없어야 한다
eq('표 상한 위 급여도 마지막 구간이 받는다',
  L.withholdingTax({ 월과세급여: 90000000, 부양가족수: 1, table: TT }).소득세, 1500000);
// 표가 아예 없으면 조용히 0으로 두지 않는다
const noT = L.withholdingTax({ 월과세급여: 3500000, 부양가족수: 4 });
eq('표 없으면 상태가 표없음', noT.상태, '표없음');
ok('표 없으면 안내 문구가 있다', !!noT.안내);
// 원천징수 비율 신청(80%·120%) — 소득세법 시행령 194조
eq('80% 신청 = 39,470원 (10원 절사)',
  L.withholdingTax({ 월과세급여: 3500000, 부양가족수: 4, table: TT, 비율: 80 }).소득세, 39470);
eq('120% 신청 = 59,200원',
  L.withholdingTax({ 월과세급여: 3500000, 부양가족수: 4, table: TT, 비율: 120 }).소득세, 59200);
eq('자녀공제가 표값보다 크면 0 (음수 금지)',
  L.withholdingTax({ 월과세급여: 1060000, 부양가족수: 1, 자녀수: 3, table: TT }).소득세, 0);

section('간이세액표 — 월급여 통합계산에 물렸는가');
const mpT = L.monthlyPayroll({ 기본급: 3500000, 간이세액표: TT, 부양가족수: 4, 자녀수: 2 });
eq('통합계산 소득세 = 20,180', mpT.공제.소득세, 20180);
eq('통합계산 지방세 = 2,010 (10원 절사)', mpT.공제.지방세, 2010);
eq('표가 있으면 소득세미정 아님', mpT.검증.소득세미정, false);
ok('지급 − 공제 = 실수령 (표 적용 후에도)',
  mpT.지급.지급총액 - mpT.공제.공제총액 === mpT.실수령);
ok('세금 근거가 남는다', /간이세액표/.test((mpT.근거 || {}).소득세 || ''));
// 대장에 적힌 소득세가 있으면 그것이 가장 세다
eq('대장 값이 표보다 우선',
  L.monthlyPayroll({ 기본급: 3500000, 간이세액표: TT, 부양가족수: 4, 소득세: 12345 }).공제.소득세, 12345);

section('간이세액표 변환기 — engine/build_simpletax.js');
const B = require(path.join(__dirname, '..', 'engine', 'build_simpletax.js'));
eq('쉼표 있는 숫자 읽기', B.toNum('127,220'), 127220);
eq('빈 칸은 null', B.toNum(''), null);
eq('따옴표·공백 제거', B.toNum(' "1,060" '), 1060);
const cells = B.splitCsvLine('1060,1065,"1,040",0');
eq('CSV 칸 나누기(따옴표 안 쉼표 보존)', cells.length, 4);
eq('따옴표 안 쉼표를 칸 구분으로 읽지 않는다', B.toNum(cells[2]), 1040);
const fsx = require('fs'), osx = require('os');
const tmpCsv = path.join(osx.tmpdir(), 'st-test.csv');
fsx.writeFileSync(tmpCsv,
  '월급여액(천원),,공제대상 가족의 수\n이상,미만,1,2,3,4\n1060,1065,1040,0,0,0\n3500,3505,127220,102220,74450,49340\n10000,,1500000,1400000,1300000,1200000\n');
const built = B.build(tmpCsv, 2026);
eq('구간 3개를 읽었다', built.rows.length, 3);
eq('천원 단위를 원 단위로 환산', built.rows[0].min, 1060000);
eq('마지막 구간은 상한 없음(높은 급여가 새지 않게)', built.rows[built.rows.length - 1].max, null);
eq('변환한 표(2026년 기준)로 국세청 예시가 맞는다 — 자녀공제 2026년판',
  L.withholdingTax({ 월과세급여: 3500000, 부양가족수: 4, 자녀수: 2, table: built }).소득세, 3510);
const built25 = B.build(tmpCsv, 2025);
eq('2025년 이전 표는 2024년판 자녀공제를 싣는다',
  L.withholdingTax({ 월과세급여: 3500000, 부양가족수: 4, 자녀수: 2, table: built25 }).소득세, 20180);

/* ── 내장 간이세액표(js/pu-simpletax.js) — 법제처 별표2 <개정 2026.2.27.> 그대로 ──
   기준점은 외부 공표값과 맞춘다:
     월 3,500천원 · 가족 4명 → 49,340원 / 자녀 2명이면 49,340 − 45,830 = 3,510원
     (2026.3.1 이후 원천징수분부터 — 급여 안내 자료의 계산 예시와 같은 값) */
section('내장 간이세액표 — 법제처 별표2 2026.2.27 개정판');
const ST = require(path.join(__dirname, '..', 'js', 'pu-simpletax.js'));
ok('내장 표가 하나 이상 있다', ST.tables && ST.tables.length >= 1);
const T26 = L.pickSimpleTaxTable(ST.tables, '2026-03');
ok('2026년 3월은 2026년판 표를 고른다', !!T26 && T26.시행 === '2026-03-01');
eq('2026년판 개정일', T26 && T26.개정, '2026-02-27');
eq('2026년 2월(말일 기준)은 내장 표가 없다 — 옛 달에 새 표를 쓰지 않는다',
  L.pickSimpleTaxTable(ST.tables, '2026-02'), null);
ok('2월 급여라도 3월에 지급하면 새 표', !!L.pickSimpleTaxTable(ST.tables, '2026-02', '2026-03-10'));
eq('연도 없는 달 이름은 고르지 않는다', L.pickSimpleTaxTable(ST.tables, '3월'), null);
eq('2025년은 내장 표 없음', L.pickSimpleTaxTable(ST.tables, '2025-05'), null);
const w26 = function (o) { return L.withholdingTax(Object.assign({ table: T26 }, o)); };
eq('★ 월 350만·가족 4명 = 49,340원', w26({ 월과세급여: 3500000, 부양가족수: 4 }).소득세, 49340);
eq('★ 자녀 2명이면 3,510원 (49,340 − 45,830)', w26({ 월과세급여: 3500000, 부양가족수: 4, 자녀수: 2 }).소득세, 3510);
eq('자녀 1명이면 28,510원 (49,340 − 20,830)', w26({ 월과세급여: 3500000, 부양가족수: 4, 자녀수: 1 }).소득세, 28510);
eq('표 첫 구간(77만원) 아래는 0원', w26({ 월과세급여: 700000, 부양가족수: 1 }).소득세, 0);
eq('월 106만원·1명 = 1,040원', w26({ 월과세급여: 1060000, 부양가족수: 1 }).소득세, 1040);
eq('월 200만원·1명 = 19,520원', w26({ 월과세급여: 2000000, 부양가족수: 1 }).소득세, 19520);
eq('월 999만원·1명 = 1,503,990원(표 마지막 구간)', w26({ 월과세급여: 9990000, 부양가족수: 1 }).소득세, 1503990);
eq('월 1,000만원 정확히 = 1,000만원 줄 1,507,400원', w26({ 월과세급여: 10000000, 부양가족수: 1 }).소득세, 1507400);
// 1,000만원 초과 산식(별표2 제6호 끝): 1,000만원 줄 + 초과액 × 98% × 35% + 25,000
eq('월 1,200만원·1명 = 1,507,400 + 2,000,000×0.98×0.35 + 25,000 = 2,218,400',
  w26({ 월과세급여: 12000000, 부양가족수: 1 }).소득세, 2218400);
// 1,400만~2,800만: 1,000만원 줄 + 1,397,000 + 1,400만 초과액 × 98% × 38%
eq('월 2,000만원·1명 = 1,507,400 + 1,397,000 + 6,000,000×0.98×0.38 = 5,138,800',
  w26({ 월과세급여: 20000000, 부양가족수: 1 }).소득세, 5138800);
// 8,700만 초과: 1,000만원 줄 + 31,034,600 + 초과액 × 45%
eq('월 1억원·1명 = 1,507,400 + 31,034,600 + 13,000,000×0.45 = 38,392,000',
  w26({ 월과세급여: 100000000, 부양가족수: 1 }).소득세, 38392000);
ok('★ 1,000만원 초과 급여가 1,000만원 세액에 멈추지 않는다(고액 급여 과소징수 방지)',
  w26({ 월과세급여: 15000000, 부양가족수: 1 }).소득세 > w26({ 월과세급여: 10000000, 부양가족수: 1 }).소득세);
// 별표2 제4호: 11명 초과 = 11명 세액 − (10명 세액 − 11명 세액) × 초과 인원
eq('가족 11명 = 11명 칸 10,640원', w26({ 월과세급여: 3500000, 부양가족수: 11 }).소득세, 10640);
eq('가족 12명 = 10,640 − (14,010 − 10,640) × 1 = 7,270원', w26({ 월과세급여: 3500000, 부양가족수: 12 }).소득세, 7270);
eq('가족이 아주 많아도 음수는 0', w26({ 월과세급여: 3500000, 부양가족수: 20 }).소득세, 0);
ok('근거에 개정일이 남는다', /2026-02-27/.test(w26({ 월과세급여: 3500000, 부양가족수: 4 }).출처));
// 표 자체 검사 — 변환이 칸을 밀려 읽었으면 여기서 걸린다
const R26 = T26.rows;
ok('구간이 끊김 없이 이어진다', R26.every(function (r, i) { return i === 0 || R26[i - 1].max === r.min; }));
ok('모든 줄이 가족 11칸', R26.every(function (r) { return r.tax.length === 11; }));
ok('가족이 늘면 세액은 줄거나 같다', R26.every(function (r) {
  return r.tax.every(function (v, i) { return i === 0 || v <= r.tax[i - 1]; }); }));
ok('급여가 늘면 세액은 늘거나 같다', R26.every(function (r, i) {
  return i === 0 || r.tax.every(function (v, k) { return v >= R26[i - 1].tax[k]; }); }));
eq('표는 1,000만원에서 끝난다(그 위는 산식)', R26[R26.length - 1].max, 10000000);
eq('내장 표 자녀공제 = 별표 제3호(1명 20,830)', T26.자녀공제.one, 20830);

section('내장 간이세액표 — 통합계산');
const mp26 = L.monthlyPayroll({ 기본급: 3500000, 간이세액표: T26, 부양가족수: 4, 자녀수: 2 });
eq('통합계산 소득세 = 3,510', mp26.공제.소득세, 3510);
eq('통합계산 지방세 = 350 (10원 절사)', mp26.공제.지방세, 350);
ok('지급 − 공제 = 실수령', mp26.지급.지급총액 - mp26.공제.공제총액 === mp26.실수령);

section('근로자명부(근기법 41·42조) · 10인이하 법정점검 · 근로계약서·취업규칙 자동 검토');
const rrOk = L.evaluateRosterRow({ 성명: '김철수', 성별: '남', 생년월일: '1988-05-12', 주소: '충남 천안시', 이력: '한식조리사', 종사업무: '조리', 입사일: '2024-03-01', 퇴사일: '2026-06-30', 퇴직사유: '자진퇴사' });
eq('근로자명부 8대 법정항목 완비 = true', rrOk.완비여부, true);
eq('퇴직 후 3년 보존기한 자동 계산 (2029-06-30)', rrOk.보존기한, '2029-06-30');
const rrMiss = L.evaluateRosterRow({ 성명: '이영희', 입사일: '2025-01-01' });
eq('미기재 항목 있으면 완비 = false', rrMiss.완비여부, false);
ok('누락항목에 주소·생년월일 포함', rrMiss.누락항목.indexOf('주소') >= 0 && rrMiss.누락항목.indexOf('생년월일') >= 0);

const comp4 = L.evaluateWorkplaceCompliance({ empCount: 4, fiveOrMore: false, contractCount: 4, rosterCompleteCount: 4, payslipLockedCount: 2 });
eq('4인 사업장 규모구분 = 5인 미만 (10인 이하)', comp4.규모구분, '5인 미만 (10인 이하)');
eq('5인 미만 적용 법정항목 = 8개 (해고예고·퇴직금·성희롱교육특례 포함)', comp4.적용항목수, 8);
const comp8 = L.evaluateWorkplaceCompliance({ empCount: 8, fiveOrMore: true, contractCount: 8, rosterCompleteCount: 8, payslipLockedCount: 3, annualRecordedCount: 8 });
eq('8인 사업장 규모구분 = 5인 이상 10인 미만 (10인 이하)', comp8.규모구분, '5인 이상 10인 미만 (10인 이하)');
eq('5~9인 적용 법정항목 = 12개 (취업규칙 신고는 면제)', comp8.적용항목수, 12);

const stdCt = L.buildStandardContractText({ 성명: '박민수', 입사일: '2026-03-01', 기본급: 2500000, 직종: '생산관리', 급여일: '25일' }, { fiveOrMore: true });
const revCt = L.reviewLaborContract(stdCt, { policy: { fiveOrMore: true }, minWageHourly: 10320 });
eq('표준근로계약서 자동 검토 적합 = true', revCt.적합여부, true);
eq('계약서에서 성명 자동 추출', revCt.추출.성명, '박민수');
eq('계약서에서 입사일 자동 추출', revCt.추출.입사일, '2026-03-01');
eq('계약서에서 기본급 자동 추출', revCt.추출.기본급, 2500000);
const badCt = L.reviewLaborContract('근로자: 최영수\n시급 9,000원 지급\n무단결근 시 위약금 50만원 배상 예정\n퇴직금은 매월 급여에 포함하여 지급', { minWageHourly: 10320 });
eq('위법 계약서 적합 = false', badCt.적합여부, false);
ok('최저임금 미달·위약예정·퇴직금 분할포함 3건 모두 적발', badCt.위법경고.length >= 3);

const stdWr = L.buildStandardWorkRulesText('가람떡집', { fiveOrMore: true });
const revWr = L.reviewWorkRules(stdWr, { empCount: 9 });
eq('표준 취업규칙 근기법 93조 12대 항목 모두 충족', revWr.충족수, 12);
eq('9인 사업장 취업규칙 신고의무 = false (10인 미만 면제)', revWr.신고의무여부, false);
const badWr = L.reviewWorkRules('시업 09:00 임금 매월 25일 지급. 관공서 공휴일은 연차로 대체한다. 배우자 출산휴가 10일 부여. 감봉 징계 가능.', { empCount: 12 });
ok('구법 공휴일 연차대체·배우자출산 10일·감봉 한도 미기재 경고 적발', badWr.위법경고.length >= 3);

section('추가 6대 노무·급여 실무 자동 진단 (기간제·상용전환위험·취업규칙서식·지원금·보수총액·전자교부)');
const lcAlerts = L.evaluateLifecycleAlerts([
  { 성명: '김수습', 입사일: '2026-08-15', 고용형태: '정규직' },
  { 성명: '이계약', 입사일: '2024-12-01', 계약종료일: '2026-11-30', 고용형태: '계약직' },
  { 성명: '박정년', 입사일: '2015-03-01', 생년월일: '1967-01-10', 고용형태: '정규직' }
], '2026-11-02');
ok('수습 3개월·계약만료·2년 무기전환·정년 도래 경보가 모두 잡힌다', lcAlerts.length >= 4);

const nrRisks = L.diagnoseNonRegularRisk([
  { 성명: '최일용', 고용형태: '일용직', 일용여부: true, 활동월수: 14, 월평균근로일수: 20, 월평균근로시간: 160 }
]);
eq('14개월·월20일 근무 일용직 위험 진단 대상 = 1명', nrRisks.length, 1);
eq('4대보험 상용가입·주휴연차·해고예고·퇴직금 4대 위험 모두 적발', nrRisks[0].위험수, 4);

const wrDocs = L.buildWorkRulesFilingDocs('가람떡집', [{ 성명: '갑' }, { 성명: '을' }, { 성명: '병' }], { disadvantage: true, date: '2026-11-02' });
eq('3인 사업장 과반수 기준 = 2명', wrDocs.과반수기준, 2);
ok('취업규칙 신고서·동의서·신구대조표 3종 생성됨', wrDocs.신고서.indexOf('신고서') > -1 && wrDocs.의견동의서.indexOf('동의서') > -1 && wrDocs.신구대조표.indexOf('대조표') > -1);

const subMatch = L.matchEmployerSubsidies({ months: 6, infantUnder12Months: true });
eq('출산육아기·고령자 정부지원금 5종 매칭', subMatch.프로그램목록.length, 5);
eq('만 12개월 이내 특례 육아휴직 지원금 6개월 = 200만×3 + 30만×3 = 690만원', subMatch.프로그램목록[0].예상총지원액, 6900000);

const annSettle = L.summarizeAnnualSettlement([
  { 월: '1월', 직원: [{ 성명: '홍길동', 지급총액: 3200000, 과세총액: 3000000, 국민연금: 142500, 건강보험: 100000, 장기요양: 13000, 고용보험: 27000, 소득세: 50000, 지방세: 5000 }] },
  { 월: '2월', 직원: [{ 성명: '홍길동', 지급총액: 3200000, 과세총액: 3000000, 국민연금: 142500, 건강보험: 100000, 장기요양: 13000, 고용보험: 27000, 소득세: 50000, 지방세: 5000 }] }
], '2026');
eq('연간 보수총액 대사표 직원 1명 집계', annSettle.직원수, 1);
eq('2개월 과세보수총액 = 600만원 · 월평균보수 = 300만원', annSettle.행목록[0].연간과세총액 + '/' + annSettle.행목록[0].월평균보수, '6000000/3000000');

const delivHtml = L.buildContractDeliveryHtml('가람떡집', { 성명: '홍길동' }, '표준근로계약서 본문');
ok('근로계약서 전자교부 HTML 에 근기법 17조 2항 명시', delivHtml.indexOf('제17조 제2항') > -1);

section('시간차 1시간 단위 8시간 선택 및 소정근로시간(5시간 등) 최대시간차 상한 관리');
eq('기본(8시간) 최대 시간차 = 8h', L.maxHourLeaveOf({ dailyContractHours: 8 }), 8);
eq('기본(8시간) 1시간 단위 선택 목록 = 1~8h (8개)', L.hourLeaveOptions({ dailyContractHours: 8 }).join(','), '1,2,3,4,5,6,7,8');
eq('소정근로시간 5시간 사업장 최대 시간차 = 5h', L.maxHourLeaveOf({ dailyContractHours: 5 }), 5);
eq('소정근로시간 5시간 사업장 선택 목록 = 1~5h (5개)', L.hourLeaveOptions({ dailyContractHours: 5 }).join(','), '1,2,3,4,5');
eq('개별 근로자 소정근로시간 5시간이면 최대 시간차 = 5h', L.maxHourLeaveOf({ dailyContractHours: 8 }, 5), 5);
const norm5 = L.normalizeHourLeave({ 사용시간: 7, policy: { dailyContractHours: 5 } });
eq('소정근로시간 5시간일 때 7시간 시간차 입력 시 5시간(최대시간차)으로 정리', norm5.사용시간, 5);
eq('상한 초과 정리 표시 = true', norm5.상한초과정리됨, true);
const lg5 = L.annualLedger({ 발생일수: 15, 이월일수: 0, 사용일수: 1, 사용시간: 8, policy: { dailyContractHours: 5 } });
eq('5시간 사업장 연차대장 최대시간차 = 5h', lg5.최대시간차, 5);
eq('5시간 사업장 연차대장 사용시간 8h → 5h로 상한 정리', lg5.사용시간, 5);
eq('5시간 사업장 1일 + 시간차 5h(=1일) → 총 사용 2일', lg5.사용일수, 2);

console.log('\n════════════════════════════════');
console.log('  통과 ' + pass + ' · 실패 ' + fail);
console.log('════════════════════════════════');
process.exit(fail ? 1 : 0);
