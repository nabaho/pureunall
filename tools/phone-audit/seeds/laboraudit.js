/* 폰·PC 화면 실측 점검용 합성 자료 (laboraudit.html) — 모두 지어낸 값이다. */
'use strict';
const NOW = Date.UTC(2026, 10, 28, 1, 0, 0);

module.exports = {
  data: {
    scal_laboraudit: {
      projects: {
        'pr_laboraudit_1': {
          id: 'pr_laboraudit_1',
          entityType: 'Project',
          schemaVersion: 1,
          contractVersion: 1,
          createdAt: NOW - 864e5 * 10,
          updatedAt: NOW - 3600e3,
          revision: 1,
          companyName: '(주)가나자율점검샘플',
          year: 2026,
          trackId: 'la_self',
          trackName: '기초노동질서 자율점검 배정사업장 일괄관리 (노동부·노사민정)',
          stage: 'visit',
          workerCount: 25,
          consultantName: '점검노무사',
          status: 'active',
          summaryNote: '자율점검·근로감독 현장 점검 진행 중 (연락처 010-0000-1001)'
        }
      },
      checks: {
        'pr_laboraudit_1': {
          main: {
            id: 'main',
            projectId: 'pr_laboraudit_1',
            entityType: 'Document',
            schemaVersion: 1,
            contractVersion: 1,
            createdAt: NOW - 864e5 * 8,
            updatedAt: NOW - 3600e3,
            revision: 1,
            pre: {"la_pre_1":{"status":"ok","note":"사전확인"},"la_pre_2":{"status":"ok","note":"사전확인"}},
            domain: {"la_chk_1":{"status":"ok","note":"점검중"},"la_chk_2":{"status":"fix","note":"점검중"}},
            docs: {"la_doc_1":{"status":"ok","note":"확보"}}
          }
        }
      },
      comms: {
        'pr_laboraudit_1': {
          cm_1: {
            id: 'cm_1',
            projectId: 'pr_laboraudit_1',
            entityType: 'Document',
            schemaVersion: 1,
            contractVersion: 1,
            createdAt: NOW - 864e5 * 2,
            updatedAt: NOW - 864e5 * 2,
            revision: 1,
            source: 'imap',
            date: '2026-11-26',
            subject: '[자율점검·근로감독] 사전 점검 자료 송부',
            maskedPreview: '자율점검 관련 기초 서식 전달드립니다.',
            atts: ['사전질의표.xlsx']
          }
        }
      },
      reports: {}
    }
  }
};
