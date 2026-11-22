/* 폰 화면 점검 — 공공 기업검색 독립 프로그램(pu-pubsearch.html) 자료·화면
 * ⚠ 자료는 모두 cards.js 의 지어낸 샘플을 재사용한다. 실제 고객·직원 없음. */
'use strict';

const cards = require('./cards.js');

module.exports = {
  data: JSON.parse(JSON.stringify(cards.data)),
  views: [
    {
      name: 'home',
      async run(page) {
        await page.waitForTimeout(300);
      },
    },
  ],
};
