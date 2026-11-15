'use strict';
/* 공공기관 단협(pu-alio-union.html) — 정적 번들(js/pu-alio-data.js)로 전 탭(기관목록·상세·지역산하비교·다중비교·조문/원문·API)을 점검한다 */
module.exports = {
  data: {},
  views: [
    {
      name: 'organ',
      run: async (page) => {
        await page.click('[data-tab="organ"]');
        await page.waitForTimeout(250);
      }
    },
    {
      name: 'organ_history',
      run: async (page) => {
        await page.click('[data-tab="organ"]');
        await page.waitForTimeout(200);
        await page.selectOption('select[data-f="hOrgan"]', 'C0352');
        await page.waitForTimeout(150);
        await page.click('#pauOrganSubCard [data-h-sub="HISTORY"]');
        await page.waitForTimeout(250);
      }
    },
    {
      name: 'organ_issues',
      run: async (page) => {
        await page.click('[data-tab="organ"]');
        await page.waitForTimeout(200);
        await page.selectOption('select[data-f="hOrgan"]', 'C0005');
        await page.waitForTimeout(150);
        await page.click('#pauOrganSubCard [data-h-sub="ISSUES"]');
        await page.waitForTimeout(250);
      }
    },
    {
      name: 'region',
      run: async (page) => {
        await page.click('[data-tab="matrix"]');
        await page.waitForTimeout(200);
        await page.click('[data-m-submode="REGION"]');
        await page.waitForTimeout(250);
      }
    },
    {
      name: 'studio',
      run: async (page) => {
        await page.click('[data-tab="matrix"]');
        await page.waitForTimeout(200);
        await page.click('[data-m-submode="STUDIO"]');
        await page.waitForTimeout(250);
      }
    },
    {
      name: 'articles',
      run: async (page) => {
        await page.click('[data-tab="articles"]');
        await page.waitForTimeout(200);
        await page.click('[data-doc-mode="ARTICLES"]');
        await page.waitForTimeout(250);
      }
    },
    {
      name: 'disc',
      run: async (page) => {
        await page.click('[data-tab="articles"]');
        await page.waitForTimeout(200);
        await page.click('[data-doc-mode="DISC"]');
        await page.waitForTimeout(250);
      }
    },
    {
      name: 'apihub',
      run: async (page) => {
        await page.click('[data-tab="apihub"]');
        await page.waitForTimeout(250);
      }
    }
  ]
};
