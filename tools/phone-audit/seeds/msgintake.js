/* 폰·PC 화면 실측 점검용 합성 자료 (pu-msg-intake.html) */
'use strict';
const NOW = Date.UTC(2026, 10, 28, 2, 0, 0);
module.exports = {
  data: {
    msg_intake: {
      items: {
        mi_seed_1: {
          id: 'mi_seed_1',
          entityType: 'Document',
          schemaVersion: 1,
          contractVersion: 1,
          createdAt: NOW - 3600e3,
          updatedAt: NOW - 3600e3,
          revision: 1,
          channel: 'kakao_export',
          msgDate: '2026-11-28',
          title: '[카톡:(주)가나농업] 6차산업 현장코칭 일정 문의',
          maskedBody: '현장코칭 사전질의표.xlsx 첨부드립니다. 담당자 010-0000-2002',
          summary: '현장코칭 사전질의표 전달 및 일정 확인',
          attNames: ['사전질의표.xlsx'],
          targetApp: 'sixthind',
          targetApps: ['sixthind'],
          matchedReasons: ['키워드: 6차산업 · 현장코칭'],
          status: 'pending'
        }
      }
    }
  }
};
