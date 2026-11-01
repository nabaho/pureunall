// 콘솔에 주민번호·급여 표를 «통째로» 찍지 않는다 (2026-11-01 개인정보 처리 검토 0단계)
// 까닭: 콘솔은 화면 녹화·확장프로그램·옆사람에게 그대로 보인다(안전성 확보조치 기준 제7조⑤).
// 되돌리기는 서버 매일 백업(봉인)으로 한다.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const code = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '');

// 민감 표: 외부인 주민번호(payroll_irregular)·급여(payroll_monthly)·명부(user_accounts)
const SENSITIVE = ['payroll_irregular', 'payroll_monthly', 'user_accounts'];

test('콘솔에 민감 표를 dbGet 째로 찍지 않는다', () => {
  SENSITIVE.forEach(function (k) {
    const re = new RegExp("console\\.(log|table|info)\\([^;]*JSON\\.stringify\\(dbGet\\('" + k + "'");
    assert.doesNotMatch(code, re, k + ' 를 콘솔에 통째로 찍는 줄이 있습니다 — 건수만 찍으세요');
  });
});

test('사번정리 백업은 급여·근태 내용 없이 id·사번만 찍는다', () => {
  ['payroll_monthly', 'overtime_records', 'attendance_records', 'finance_income'].forEach(function (k) {
    const re = new RegExp("console\\.log\\('\\[사번정리 백업\\] " + k + "',\\s*JSON\\.stringify\\([A-Za-z_$]+\\)\\)");
    assert.doesNotMatch(code, re, k + ' 를 통째로 찍고 있습니다');
  });
});
