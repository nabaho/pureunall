'use strict';
/* 포털(enter.html) 폰 화면 점검 시드 — 기본 홈 화면 + 오케스트레이션 컴팩트 팝업(#orchModal) 열림 상태 측정 */
const NOW = Date.UTC(2026, 9, 18, 1, 0, 0);

/* 📋 머리줄 «내 업무» 단추 숫자(work_erp/mysum/{사번}) — 업무관리가 적는 한 줄을 지어낸다(2026-11-21).
   날짜는 «점검하는 날» 기준으로 만든다 — 오래된 값(14일 넘음)은 단추가 숫자를 안 보이기 때문이다. */
const 오늘 = new Date();
const 날 = (n) => { const d = new Date(오늘.getTime() + n * 86400000); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

module.exports = {
  /* 📋 «내 업무» 첫 안내(2026-11-22)는 기본 화면에선 «이미 봤음»으로 둔다 — 홈 화면 잰값이 안내 때문에 흔들리지 않게.
     안내가 열린 모습은 아래 화면 'mywork-tip' 에서 잰다. */
  localStorage: { 'pu_mywork_tip_ok:pa-uid-1': '1' },
  data: {
    work_erp: {
      mysum: {
        /* 열쇠는 로그인 UID(규칙이 본인 자리만 쓰게 막는다) — 가짜 로그인의 UID(seed.js 의 UID).
           ⚠ seed.js 를 require 하면 «서로 부르기»가 되어 UID 가 undefined 로 온다 — 다른 씨앗처럼 글자로 적는다 */
        'pa-uid-1': { v: 1, n: 12, dd: [날(-1), 날(3), 날(20)], nx: [날(0)], at: Date.now() - 3600000 }
      }
    },
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
    },
    {
      /* 📋 로그인하면 «내 업무» 단추 아래 뜨는 첫 안내 — 화면 안에 들어오는지·단추를 가리키는지 */
      name: 'mywork-tip',
      async run(page) {
        /* 앞 화면(orch-popup)이 연 창을 가린다 — 화면들은 한 장에서 차례로 돈다 */
        await page.evaluate(() => { const m = document.getElementById('orchModal'); if (m) m.hidden = true; });
        await page.evaluate(() => window.portalMyWorkTip && window.portalMyWorkTip(true));
        await page.waitForFunction(() => !!document.getElementById('mwTip'), null, { timeout: 5000 });
        await page.waitForTimeout(400);
      }
    }
  ]
};
