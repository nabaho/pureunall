/* 폰 화면 점검 — 공공 기업검색(pu-cards.html?view=pubsearch) 자료·화면
 * ⚠ 자료는 모두 cards.js 의 지어낸 샘플을 재사용한다. 실제 고객·직원 없음. */
'use strict';

const cards = require('./cards.js');

module.exports = {
  data: JSON.parse(JSON.stringify(cards.data)),
  views: [
    {
      name: 'pubsearch-open',
      async run(page) {
        await page.waitForTimeout(400);
        await page.evaluate(() => {
          if (window.PuPubSearch && typeof window.PuPubSearch.open === 'function') {
            window.PuPubSearch.open();
          }
        });
        await page.waitForTimeout(300);
      },
    },
  ],
};
