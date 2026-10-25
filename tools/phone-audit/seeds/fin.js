/* 재무관리(fin = pu-erp.html?app=fin) 폰 점검 — 자료는 이알피와 같은 것을 쓴다(seeds/erp.js, 모두 지어낸 것). */
'use strict';
const erp = require('./erp.js');
/* 급여 줄(귀속월 딱지 + 긴 비고) — 대표 폰 캡처(2026-10-25 출금관리)를 그대로 재현한다. 이름은 지어낸 것 */
const data = JSON.parse(JSON.stringify(erp.data));
[['가나다', 3322622], ['라마바', 2009570], ['사아자', 2641808]].forEach(([n, a], i) => {
  data.data.finance_expense.v['fe-payrow' + i] = { id: 'fe-payrow' + i, date: '2026-10-05', amount: a, category: 'exp-salary', payee: n,
    note: '2026-09월 근무분 급여(2026-10 지급) 실수령액', createdAt: '2026-10-01T00:00:00.000Z' };
});
/* 스크롤 — 목록이 «본문 상자 안»에서 구르므로 그 상자를 내려 아래쪽 줄도 갈무리한다 */
function 내리기(name, px) {
  return { name, wait: 700, run: async (page) => { await page.evaluate((d) => {
    const els = [...document.querySelectorAll('main, main *')].filter((e) => e.scrollHeight > e.clientHeight + 40 && /(auto|scroll)/.test(getComputedStyle(e).overflowY));
    els.sort((a, b) => b.clientHeight - a.clientHeight); if (els[0]) els[0].scrollTop += d; else window.scrollBy(0, d);
  }, px); } };
}
module.exports = {
  data,
  views: [
    /* 거래내역 — 입금 카드 · 출금 카드(2026-10-24 재무 폰 정리). 통장 묶음은 seeds/erp.js 의 지어낸 40줄 */
    erp.메뉴('fin/ledger', 3500),
    { name: 'ledger-exp', wait: 1500, run: async (page) => { await page.locator('.ld-tab').filter({ hasText: '출금' }).first().click(); } },
    erp.메뉴('fin/income', 3000),
    { name: 'income-confirm', wait: 2500, run: async (page) => { await page.locator('main').getByText('입금확정', { exact: true }).first().click(); }, back: async (page) => { await page.keyboard.press('Escape'); await page.waitForTimeout(400); } },
    /* 입금관리 안의 탭 둘 — 기간 탭(월별·연도별·전체)이 따로 그려진다 */
    { name: 'income-perf', wait: 2000, run: async (page) => { await page.locator('main').getByText('성과 미반영').first().click(); } },
    { name: 'income-list', wait: 2000, run: async (page) => { await page.locator('main').getByText('입금 리스트').first().click(); } },
    { name: 'income-case', wait: 2000, run: async (page) => { await page.locator('main').getByText('사건입금').first().click(); } },
    { name: 'income-co', wait: 2000, run: async (page) => { await page.locator('main').getByText('업체입금').first().click(); } },
    내리기('income-co-s', 900),
    erp.메뉴('fin/expense', 3000),
    { name: 'expense-add', wait: 2000, run: async (page) => { await page.locator('main').getByText('출금 추가').first().click(); }, back: async (page) => { await page.keyboard.press('Escape'); await page.waitForTimeout(400); } },
    { name: 'expense-list', wait: 2200, run: async (page) => { await page.locator('main').getByText('급여').first().click(); } },
    erp.메뉴('fin/pnl'),
    { name: 'pnl-cat', wait: 1800, run: async (page) => { await page.locator('main').getByText('카테고리별 지출').first().click(); } },
    { name: 'pnl-chart', wait: 2500, run: async (page) => { await page.locator('main').getByText('분석 차트').first().click(); } },
    erp.메뉴('fin/invoice'),
    { name: 'invoice-match', wait: 1800, run: async (page) => { await page.locator('main').getByText('입금 대조').first().click(); } },
    { name: 'invoice-arc', wait: 1800, run: async (page) => { await page.locator('main').getByText('업체별 아카이브').first().click(); } },
    erp.메뉴('fin/recv'),
    erp.메뉴('fin/vat'),
    erp.메뉴('fin/auto'),
    { name: 'auto-fail', wait: 1800, run: async (page) => { await page.locator('main').getByText('출금 실패').first().click(); } },
    { name: 'auto-done', wait: 1800, run: async (page) => { await page.locator('main').getByText('자동 확정').first().click(); } },
    erp.메뉴('fin/close'),
  ],
};
