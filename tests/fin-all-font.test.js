'use strict';
/* 재무 전 화면 글자 (2026-10-12 대표 「재무화면도 글자 크게 단 재무관리는 여기서 글자크기만」) — 12px 아래 글자가 다시 생기지 않게
   실행: node --test tests/fin-all-font.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { stripJs } = require('./strip-comments.js');
const SRC = stripJs(fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n'));
const SCREENS = ['BankPickModal', 'FinanceLedger', 'FinanceIncome', 'IncomeUnmatchedTab', 'IncomePendingTab', 'IncomeListTab', 'IncomeCompanyTab', 'IncomeKindTab', 'IncomeDetailModal',
  'FinanceExpense', 'ExpenseDetailModal', 'RecurringExpenseModal', 'ExpenseBudgetModal', 'ExpenseBulkImportModal', 'CardExcelImportModal',
  'FinanceInvoice', 'InvoiceDetailModal', 'FinanceTxn', 'FinancePnL', 'FinanceReceivable', 'MonthClose', 'FinanceAuto', 'FinanceVAT'];

test('재무 화면 함수 안에 12px 아래 글자가 없다', () => {
  const bad = [];
  SCREENS.forEach(function(nm){
    const a = SRC.indexOf('\nfunction ' + nm + '(');
    assert.ok(a >= 0, nm + ' 를 못 찾았습니다');
    const b = SRC.indexOf('\nfunction ', a + 10);
    const hit = SRC.slice(a, b).match(/fontSize:\s*'(?:[0-9]|1[01])(?:\.\d+)?px'/g) || [];
    if(hit.length) bad.push(nm + ' ' + hit.length + '곳');
  });
  assert.equal(bad.length, 0, '작은 글자가 남았습니다:\n' + bad.join('\n'));
});
