'use strict';
/* 인사관리 급여·퇴직 계산 «한 벌»을 vm 에 싣는 도우미 (2026-10-10 인사관리 3단계)
   ─────────────────────────────────────────────────────────────────────────
   왜: 평균임금(calcAverageWage)은 이제 급여 계산(calcPayroll — 멈춘 달은 실제 지급값)을 거쳐 센다.
       함수 몇 개만 잘라 싣던 옛 검사들은 그 길을 못 돌려 «ReferenceError» 로 깨졌다.
       검사마다 따로 잘라 싣으면 또 어긋난다 — 한 곳에서 싣는다.
   싣는 것: 진짜 엔진(js/pu-labor-core.js)·간이세액표(js/pu-simpletax.js) + pu-erp.html 의
            요율·급여 계산 구간(PAYROLL_RATES_2026 ~ 보상휴가제 앞) + 평균임금·퇴직금 함수.
   store 로 dbGet 자료를, opt 로 잠금·성과·퇴직연금을 준다. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const R = path.join(__dirname, '..');
function srcOf(){ return fs.readFileSync(path.join(R, 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n'); }
function fnSrc(SRC, name){
  const i = SRC.indexOf('\nfunction ' + name + '(');
  if (i < 0) throw new Error(name + ' 함수를 못 찾았습니다');
  const j = SRC.indexOf('\nfunction ', i + 10);
  return SRC.slice(i + 1, j < 0 ? undefined : j);
}
function hrEnv(store, opt){
  opt = opt || {};
  const SRC = srcOf();
  const S = Object.assign({ pay_items: [], user_accounts: [], leave_of_absence: [], payroll_monthly: [] }, store || {});
  const ctx = {
    console, Math, Number, String, parseInt, parseFloat, isFinite, isNaN, JSON, Object, Array, Date,
    dbGet: (k, d) => (k in S ? S[k] : d),
    isPayrollLocked: ym => (opt.locked || []).indexOf(ym) >= 0,
    calcPerfBonus: () => ({ total: opt.perf || 0, items: [] }),
    getStaffPension: sid => ({ type: (opt.pension || {})[sid] || 'NONE', startDate: '' }),
    USERS_SEED: [], PAY_ITEM_SEED: []
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(R, 'js', 'pu-labor-core.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(R, 'js', 'pu-simpletax.js'), 'utf8'), ctx);
  const a = SRC.indexOf('var PAYROLL_RATES_2026 = {'), b = SRC.indexOf('// ============ 보상휴가제', a);
  if (a < 0 || b < 0) throw new Error('급여 계산 구간을 못 찾았습니다');
  vm.runInContext(SRC.slice(a, b) + '\nfunction getLoaList(){ return dbGet("leave_of_absence", []); }\n' +
    ['_awYmd', '_awParse', '_awDays', 'calcAverageWage', 'calcOrdinaryDailyWage', 'calcLegalSeverance'].map(n => fnSrc(SRC, n)).join('\n') +
    '\nthis.calcPayroll = calcPayroll; this.calcAverageWage = calcAverageWage; this.calcLegalSeverance = calcLegalSeverance;' +
    ' this.calcOrdinaryDailyWage = calcOrdinaryDailyWage; this.payslipLines = payslipLines;', ctx);
  return ctx;
}
module.exports = { hrEnv };
