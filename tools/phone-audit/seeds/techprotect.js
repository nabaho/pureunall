/* 폰·PC 화면 실측 점검용 합성 자료 (techprotect.html) — 모두 지어낸 값이다. */
'use strict';
const NOW = Date.UTC(2026, 10, 28, 1, 0, 0);

module.exports = {
  data: {
    scal_techprotect: {
      projects: {
        'pr_techprotect_1': {
          id: 'pr_techprotect_1',
          entityType: 'Project',
          schemaVersion: 1,
          contractVersion: 1,
          createdAt: NOW - 864e5 * 10,
          updatedAt: NOW - 3600e3,
          revision: 1,
          companyName: '(주)가나기술보호샘플',
          year: 2026,
          trackId: 'tp_basic',
          trackName: '통합 기술보호지원반 (초기·진단)',
          stage: 'visit',
          workerCount: 25,
          consultantName: '점검노무사',
          status: 'active',
          summaryNote: '기술보호컨설팅 현장 점검 진행 중 (연락처 010-0000-1001)'
        }
      },
      checks: {
        'pr_techprotect_1': {
          main: {
            id: 'main',
            projectId: 'pr_techprotect_1',
            entityType: 'Document',
            schemaVersion: 1,
            contractVersion: 1,
            createdAt: NOW - 864e5 * 8,
            updatedAt: NOW - 3600e3,
            revision: 1,
            pre: {"tp_pre_1":{"status":"ok","note":"사전확인"},"tp_pre_2":{"status":"ok","note":"사전확인"}},
            domain: {"tp_chk_1":{"status":"ok","note":"점검중"},"tp_chk_2":{"status":"fix","note":"점검중"}},
            docs: {"tp_doc_1":{"status":"ok","note":"확보"}}
          }
        }
      },
      comms: {
        'pr_techprotect_1': {
          cm_1: {
            id: 'cm_1',
            projectId: 'pr_techprotect_1',
            entityType: 'Document',
            schemaVersion: 1,
            contractVersion: 1,
            createdAt: NOW - 864e5 * 2,
            updatedAt: NOW - 864e5 * 2,
            revision: 1,
            source: 'imap',
            date: '2026-11-26',
            subject: '[기술보호컨설팅] 사전 점검 자료 송부',
            maskedPreview: '기술보호 관련 기초 서식 전달드립니다.',
            atts: ['사전질의표.xlsx']
          }
        }
      },
      reports: {}
    }
  }
};
