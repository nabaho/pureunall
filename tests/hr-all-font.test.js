'use strict';
/* 인사관리 전 화면 글자 (2026-10-12 대표 「인사관리 전화면도 글자크게」) — 화면 함수 안에 12px 아래 글자가 다시 생기지 않게
   ⚠ 급여명세서(PayrollPayslip)는 인쇄 문서라 뺀다 · 퇴직정산은 retire-table-font 검사가 본다
   실행: node --test tests/hr-all-font.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { stripJs } = require('./strip-comments.js');
const SRC = stripJs(fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n'));
const SCREENS = ['StaffRoster', 'StaffRosterModal', 'StaffRosterDetail', 'RetireModal', 'PerfManagement', 'PerfConfirmTab', 'PerfPublishModal',
  'AttendanceManagement', 'LeaveManagement', 'LeaveOfAbsenceTab', 'LeaveLedgerTab', 'SpecialLeavePanel',
  'PayrollManagement', 'PayrollLedger', 'PayrollHistory', 'PayrollIrregular', 'PayrollDupModal', 'PayrollBulkModal', 'Certificate'];

test('인사관리 화면 함수 안에 12px 아래 글자가 없다', () => {
  const bad = [];
  SCREENS.forEach(function(nm){
    const a = SRC.indexOf('\nfunction ' + nm + '(');
    assert.ok(a >= 0, nm + ' 를 못 찾았습니다');
    const b = SRC.indexOf('\nfunction ', a + 10);
    const hit = SRC.slice(a, b).match(/fontSize:\s*'(?:[0-9]|1[01])(?:\.\d+)?px'/g) || [];
    if(hit.length) bad.push(nm + ' ' + hit.length + '곳 (' + hit.slice(0, 3).join(' ') + ')');
  });
  assert.equal(bad.length, 0, '작은 글자가 남았습니다:\n' + bad.join('\n'));
});
