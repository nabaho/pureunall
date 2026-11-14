'use strict';
/* P박스(pu-pbox.html) 폰 화면 점검용 자료 — 내장 국가법령 색인 및 공개 판례 코퍼스로 즉시 렌더링한다 */
module.exports = {
  data: {},
  views: [
    {
      name: 'laws',
      run: async (page) => {
        await page.evaluate(() => {
          if (window.PuPBoxApp) window.PuPBoxApp.switchView('laws');
        });
      }
    },
    {
      name: 'cases',
      run: async (page) => {
        await page.evaluate(() => {
          if (window.PuPBoxApp) window.PuPBoxApp.switchView('cases');
        });
      }
    },
    {
      name: 'workflows',
      run: async (page) => {
        await page.evaluate(() => {
          if (window.PuPBoxApp) window.PuPBoxApp.switchView('workflows');
        });
      }
    }
  ]
};
