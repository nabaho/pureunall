'use strict';
/* 인사관리 2단계 — 연차를 «입사일 기준 한 벌»로 (대표 지시 2026-10-10 「모두 다해라」 · 「연차는 입사일 기준」)
   ═══════════════════════════════════════════════════════════════════════════
   연차를 세는 곳이 네 벌(근태 잔여 · 휴가관리 · 대시보드 · 퇴직 재산정)이었고 모두 «12월 31일까지 찬 햇수»로 셌다.
     ① 입사 다음 해 1년 미만 월차 누락 ② 아직 안 온 달 선반영 ③ 화면마다 다른 숫자 ④ 퇴직 재산정의 «비례» 부여
   이제 발생은 날짜가 있는 사건(erpLeaveGrants) 한 벌이고, 모든 화면이 그 위에서 센다.
   ★ 날짜·일수는 근로기준법 제60조 그 자체라 박는다(검사고정-허용).
   실행: node --test tests/hr-stage2-leave.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripJs } = require('./strip-comments.js');

const R = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(R, 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');
function fnSrc(name){
  const i = SRC.indexOf('\nfunction ' + name + '(');
  assert.ok(i >= 0, name + ' 함수를 못 찾았습니다 — 이름이 바뀌었다면 이 검사도 함께 고치십시오');
  const j = SRC.indexOf('\nfunction ', i + 10);
  return SRC.slice(i + 1, j < 0 ? undefined : j);
}
function fixedDate(y, m, d){
  const T = new Date(y, m - 1, d).getTime();
  return class extends Date { constructor(...a){ if (a.length === 0) super(T); else super(...a); } static now(){ return T; } };
}
function leaveEnv(opt){
  opt = opt || {};
  const store = Object.assign({ policy_leave: {}, attendance_records: [], user_accounts: [] }, opt.store || {});
  const ctx = { Math, Number, String, parseInt, parseFloat, isNaN, isFinite, Object, Array, JSON,
    Date: opt.today ? fixedDate(...opt.today) : Date, dbGet: (k, d) => (k in store ? store[k] : d), USERS_SEED: [] };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(R, 'js', 'pu-work-core.js'), 'utf8'), ctx);
  const LOCAL_YMD = (fs.readFileSync(path.join(R, 'js', 'utils.js'), 'utf8').match(/function localYMD\([^\n]*/) || [''])[0];
  vm.runInContext(LOCAL_YMD + '\nvar PUREUN_5IN_DATE = "2021-06-01";\n' +
    ['getLeaveStartDate', '_lvYmd', '_lvParse', '_lvAddMonths', '_lvDayBefore', 'erpLeaveGrants', 'erpLeaveGrantedInYear',
     'erpLeaveBalanceAt', 'getLeaveRemain', 'calcRetirementLeaveJoinBasis', 'calcLeavePromoStage', 'leaveLedgerWithIds'].map(fnSrc).join('\n') +
    '\nthis.G = erpLeaveGrants; this.Y = erpLeaveGrantedInYear; this.B = erpLeaveBalanceAt; this.remain = getLeaveRemain;' +
    ' this.retire = calcRetirementLeaveJoinBasis; this.promo = calcLeavePromoStage; this.ll = leaveLedgerWithIds;', ctx);
  return ctx;
}
const J = x => JSON.stringify(x);

test('① 입사 다음 해의 1년 미만 월차가 빠지지 않는다 — 2025-12-01 입사의 2026년 = 월차 11 + 15', () => {
  const E = leaveEnv();
  /* 검사고정-허용: 제60조② 매월 1일(최대 11) + 제60조① 1년 80% → 15일 */
  assert.equal(E.Y({ hireDate: '2025-12-01' }, '2026', '2026-12-31').days, 26);
  assert.equal(E.Y({ hireDate: '2025-03-04' }, '2026', '2026-12-31').days, 17, '1·2월 월차 2일 + 3월 4일 15일');
  assert.equal(E.Y({ hireDate: '2025-03-04' }, '2025', '2025-12-31').days, 9);
});

test('② 아직 오지 않은 달은 세지 않는다 — 3월 16일 입사자의 10월 10일 현재는 6일', () => {
  const E = leaveEnv();
  assert.equal(E.Y({ hireDate: '2026-03-16' }, '2026', '2026-10-10').days, 6);   // 4/16 ~ 9/16
});

test('① 가산 — 3년 근속부터 2년마다 1일, 최대 25일', () => {
  const E = leaveEnv();
  const g = E.G({ hireDate: '2022-01-10' }, '2048-12-31').filter(x => x.kind === 'year');
  /* 검사고정-허용: 제60조④ — 1년 15, 2년 15, 3년 16, 4년 16, 5년 17 … 21년 25(한도) */
  assert.equal(J(g.slice(0, 5).map(x => x.days)), J([15, 15, 16, 16, 17]));
  assert.equal(g[20].days, 25);
  assert.equal(g[22].days, 25, '25일 한도를 넘었습니다');
});

test('① 정책에 15일 미만을 적어도 법정 15일 아래로 내려가지 않는다', () => {
  const E = leaveEnv();
  const g = E.G({ hireDate: '2022-01-10' }, '2023-12-31', { baseAfterOneYear: 10 }).filter(x => x.kind === 'year');
  assert.equal(g[0].days, 15);
});

test('④ 퇴직하면 기념일 «당일»에 근로관계가 있어야 생긴다 — 마지막 근무일 다음 기념일의 15일은 없다', () => {
  const E = leaveEnv();
  const lastBefore = E.G({ hireDate: '2025-05-16', lastWorkDate: '2026-05-15' }, '2026-12-31');
  assert.equal(lastBefore.reduce((s, x) => s + x.days, 0), 11, '1년 근무 후 퇴직(기념일 전날 마지막 근무) → 월차 11일만');
  const onAnn = E.G({ hireDate: '2025-05-16', lastWorkDate: '2026-05-16' }, '2026-12-31');
  assert.equal(onAnn.reduce((s, x) => s + x.days, 0), 26);
});

test('기산일 — 2021-06-01 전 입사자는 2021-06-01 부터 (모든 화면이 같은 잣대)', () => {
  const E = leaveEnv();
  const g = E.G({ hireDate: '2019-07-18' }, '2026-12-31').filter(x => x.kind === 'year');
  assert.equal(g[0].date, '2022-06-01');
  assert.equal(g[4].days, 17, '2026-06-01 = 5년 → 17일');
  /* 촉진도 같은 기산일 — 다음 기념일(2027-06-01) 전날이 만료 */
  const p = leaveEnv({ today: [2026, 10, 10] }).promo('2019-07-18', 2026);
  const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  assert.equal(ymd(p.expiry), '2027-05-31', '촉진 만료일이 부여와 다른 기산일을 봅니다');
});

test('잔여 = 기한이 남은 발생 − 생긴 순서대로 쓴 것 (기한 지난 것은 뺀다)', () => {
  const att = [1, 2, 3, 4, 5].map(i => ({ sid: 'X-1', date: '2025-03-0' + i, type: 'leave' }));
  const E = leaveEnv({ store: { attendance_records: att } });
  const b = E.B({ sid: 'X-1', hireDate: '2024-01-10' }, '2025-06-01');
  /* 2025-01-10 에 생긴 15일 − 3월에 쓴 5일 = 10. 1년 미만 월차 11일은 2025-01-09 에 소멸 */
  assert.equal(b.remain, 10);
  assert.equal(b.expired, 11);
});

test('퇴직 재산정 = 장부 잔여 — 정확히 1년 다니고 퇴직하면 «1년 미만»이 아니라 월차 11일, 비례 부여 없음', () => {
  const E = leaveEnv();
  const r = E.retire('2025-05-16', '2026-05-16', {}, { sid: 'X-1', lastWorkDate: '2026-05-15' });
  assert.equal(r.days, 11);
  const r2 = E.retire('2023-05-16', '2026-02-10', {}, { sid: 'X-1' });
  assert.equal(r2.days, 15, '마지막 기념일(2025-05-16)에 생긴 15일이 남는다 — 그 뒤 구간을 «비례»로 주지 않는다');
});

test('근태 잔여(getLeaveRemain)도 같은 장부 — 퇴직일 뒤·오늘 뒤 달은 없다', () => {
  const users = [{ sid: 'X-1', hireDate: '2025-12-01' }];
  const E = leaveEnv({ today: [2026, 12, 31], store: { user_accounts: users } });
  assert.equal(E.remain('X-1', 2026).total, 26);
});

test('수기 부여표·대시보드·휴가관리가 같은 장부를 부른다 (따로 세는 셈이 없다)', () => {
  const code = stripJs(SRC);
  const lm = code.slice(code.indexOf('function calcGrantDays('), code.indexOf('function calcGrantDays(') + 2500);
  assert.match(lm, /erpLeaveGrantedInYear\(/, '휴가관리 화면이 따로 셉니다');
  assert.doesNotMatch(lm, /365\.25|30\.44/);
  const ml = code.slice(code.indexOf('var myLeave = (function(){'), code.indexOf('var myLeave = (function(){') + 2500);
  assert.match(ml, /erpLeaveGrantedInYear\(/, '대시보드 «내 휴가»가 따로 셉니다');
  assert.doesNotMatch(ml, /365\.25|30\.44/);
});

test('부여일수 수정 — 반일 허용, 이월은 정책 한도까지', () => {
  const code = stripJs(SRC);
  const i0 = code.indexOf('function saveOverride(){'); /* 계약서 양식에도 saveOverride(f) 가 있다 — 인자 없는 휴가관리 것 */
  const so = code.slice(i0, code.indexOf('function resetOverride', i0));
  assert.ok(i0 >= 0);
  assert.match(so, /parseFloat\(mForm\.total\)/);
  assert.match(so, /carryOverLimit/);
  assert.doesNotMatch(so, /parseInt\(mForm/);
});

test('연차대장 — 이름이 하나뿐일 때만 사번을 붙이고, 동명이인이면 붙이지 않는다', () => {
  const E = leaveEnv();
  const one = E.ll([{ name: '가나', year: 2026 }], [{ sid: 'A-1', name: '가나' }]);
  assert.equal(one.rows[0].sid, 'A-1');
  assert.equal(one.rows[0].id, 'll-가나|2026', '병합 열쇠(id)가 바뀌면 안 됩니다');
  const two = E.ll([{ name: '가나', year: 2026 }], [{ sid: 'A-1', name: '가나' }, { sid: 'A-2', name: '가나' }]);
  assert.equal(two.rows[0].sid, undefined);
});

test('명세서의 연차 현황은 사번이 붙은 줄을 사번으로 찾는다', () => {
  const code = stripJs(SRC);
  assert.ok((code.match(/x\.sid \? x\.sid===u\.sid : x\.name===u\.name/g) || []).length >= 2);
});
