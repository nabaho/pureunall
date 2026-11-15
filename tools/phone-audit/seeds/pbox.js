'use strict';
/* P박스(pu-pbox.html) 폰 화면 점검용 자료 — 내장 국가법령 색인 및 공개 판례 코퍼스로 즉시 렌더링한다 */
module.exports = {
  data: {},
  views: [
    {
      name: 'workspace',
      run: async (page) => {
        await page.evaluate(() => {
          if (window.PuPBoxStore && window.PuPBoxStore.saveThread) {
            window.PuPBoxStore.saveThread({
              title: '용역계약서 내용 검토 및 위험조항 진단_' + '가'.repeat(120),
              mode: 'review',
              workflowStyle: 'lbox',
              sourceText: '제1조 (위약금) 을이 중도 퇴사 시 월 보수의 2배를 위약금으로 공제한다.\n\n제2조 (포괄임금) 연장근로수당 일체를 기본급에 포괄한다.',
              answer: '### ✦ 문서 내용 검토 보고서\n근로기준법 제20조 및 대법원 2020다247190 판결 기준 검토 본문입니다.'
            });
          }
          if (window.PuPBoxApp) {
            window.PuPBoxApp.switchView('workspace');
          }
        });
      }
    },
    {
      name: 'recents',
      run: async (page) => {
        await page.evaluate(() => {
          if (window.PuPBoxStore && window.PuPBoxStore.recordRecent) {
            window.PuPBoxStore.recordRecent({
              id: 'doc:prec-sc-2020da247190',
              kind: 'doc',
              title: '대법원 2024. 12. 19. 선고 2020다247190 전원합의체 판결_' + '나'.repeat(120),
              sub: '대법원 · 2020다247190'
            });
          }
          if (window.PuPBoxApp) window.PuPBoxApp.switchView('recents');
        });
      }
    },
    {
      name: 'tasks',
      run: async (page) => {
        await page.evaluate(() => {
          if (window.PuPBoxStore && window.PuPBoxStore.saveThread) {
            window.PuPBoxStore.saveThread({
              title: '취업규칙 불이익변경 검토_' + '다'.repeat(120),
              mode: 'review',
              workflowStyle: 'lbox',
              query: '취업규칙 검토',
              answer: '근로기준법 제94조제1항 단서 검토'
            });
          }
          if (window.PuPBoxApp) window.PuPBoxApp.switchView('tasks');
        });
      }
    },
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
