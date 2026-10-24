/* 재무관리(fin = pu-erp.html?app=fin) 폰 점검 — 자료는 이알피와 같은 것을 쓴다(seeds/erp.js, 모두 지어낸 것). */
'use strict';
const erp = require('./erp.js');
module.exports = {
  data: erp.data,
  views: [
    /* 거래내역 — 입금 카드 · 출금 카드(2026-10-24 재무 폰 정리). 통장 묶음은 seeds/erp.js 의 지어낸 40줄 */
    erp.메뉴('fin/ledger', 3500),
    { name: 'ledger-exp', wait: 1500, run: async (page) => { await page.locator('.ld-tab').filter({ hasText: '출금' }).first().click(); } },
    erp.메뉴('fin/income', 3000),
    /* 입금관리 안의 탭 둘 — 기간 탭(월별·연도별·전체)이 따로 그려진다 */
    { name: 'income-list', wait: 2000, run: async (page) => { await page.locator('main').getByText('입금 리스트').first().click(); } },
    { name: 'income-co', wait: 2000, run: async (page) => { await page.locator('main').getByText('업체입금').first().click(); } },
    erp.메뉴('fin/expense', 3000),
    erp.메뉴('fin/pnl'),
    erp.메뉴('fin/invoice'),
    erp.메뉴('fin/recv'),
    erp.메뉴('fin/vat'),
    erp.메뉴('fin/auto'),
    erp.메뉴('fin/close'),
  ],
};
