'use strict';
/* 포털(enter.html) 폰 화면 점검 시드 — 기본 홈 화면 + 오케스트레이션 컴팩트 팝업(#orchModal) 열림 상태 측정 */
const NOW = Date.UTC(2026, 9, 18, 1, 0, 0);

module.exports = {
  data: {
    data: {
      companies: {
        v: [
          { id: 'co-p1', name: '(주)가나정밀기계', bizNo: '123-81-10001', puNo: 10101, typeCode: '자문', status: 'active', managerMain: 'P001' }
        ]
      },
      contract_requests: {
        'creq-p1': { id: 'creq-p1', companyId: 'co-p1', companyName: '(주)가나정밀기계', contractType: '노무자문', status: 'pending', createdAt: NOW - 86400000 * 3, managerMain: 'P001' },
        'creq-p2': { id: 'creq-p2', companyName: '(주)신규의뢰상담처', contractType: '사건수임', status: 'pending', createdAt: NOW - 86400000 * 1 }
      },
      cases: {
        v: [
          { id: 'cs-p1', companyId: 'co-p1', title: '부당해고 구제신청 사건 마감 점검', status: 'progress', dueDate: '2026-10-18', managerMain: 'P001' }
        ]
      }
    }
  },
  views: [
    {
      name: 'orch-popup',
      async run(page) {
        await page.evaluate(() => {
          const tile = document.querySelector('#appRows .tile[data-key="orch"]') || document.querySelector('.tile[data-key="orch"]');
          if (tile) tile.click();
        });
        await page.waitForTimeout(350);
      }
    }
  ]
};
