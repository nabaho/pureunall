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
    },
    {
      name: 'ingest',
      run: async (page) => {
        await page.evaluate(() => {
          if (window.PuPBoxApp) window.PuPBoxApp.switchView('ingest');
        });
      }
    },
    {
      name: 'projects',
      run: async (page) => {
        await page.evaluate(() => {
          if (window.PuPBoxStore && window.PuPBoxStore.saveProject && !window.PuPBoxStore.getProjects().length) {
            window.PuPBoxStore.saveProject({
              name: '부당해고구제재심판정취소및임금청구통합자문사건_' + '가'.repeat(180),
              clientName: '주식회사푸른테스트사업장_' + 'A'.repeat(180),
              docIds: ['prec-sc-2020da247190'],
              lawKeys: ['근로기준법']
            });
          }
          if (window.PuPBoxApp) window.PuPBoxApp.switchView('projects');
        });
      }
    }
  ]
};
