/* 폰·PC 화면 실측 점검용 합성 자료 (specialcons.html) — 모두 지어낸 값이다. */
'use strict';
const NOW = Date.UTC(2026, 10, 28, 1, 0, 0);

module.exports = {
  data: {
    scal_specialcons: {
      projects: {
        'pr_specialcons_1': {
          id: 'pr_specialcons_1',
          entityType: 'Project',
          schemaVersion: 1,
          contractVersion: 1,
          createdAt: NOW - 864e5 * 10,
          updatedAt: NOW - 3600e3,
          revision: 1,
          companyName: '(주)가나특화위탁샘플',
          year: 2026,
          trackId: 'sp_kosmes',
          trackName: '중진공 혁신바우처 · 통상변화대응 기술경영혁신',
          stage: 'visit',
          workerCount: 25,
          consultantName: '점검노무사',
          status: 'active',
          summaryNote: '특화·위탁컨설팅 현장 점검 진행 중 (연락처 010-0000-1001)'
        },
        'pr_specialcons_2': {
          id: 'pr_specialcons_2',
          entityType: 'Project',
          schemaVersion: 1,
          contractVersion: 1,
          createdAt: NOW - 864e5 * 400,
          updatedAt: NOW - 864e5 * 300,
          revision: 1,
          companyName: '(주)다라특화위탁샘플',
          year: 2025,
          trackId: 'sp_samsung',
          trackName: '대기업(삼성 등) 협력업체 노무/HR 컨설팅',
          stage: 'followup',
          workerCount: 40,
          consultantName: '점검노무사',
          status: 'done',
          summaryNote: '다른 기관(세부 트랙) 사업 — 왼쪽 대시보드 점검용 지어낸 자료'
        }
      },
      checks: {
        'pr_specialcons_1': {
          main: {
            id: 'main',
            projectId: 'pr_specialcons_1',
            entityType: 'Document',
            schemaVersion: 1,
            contractVersion: 1,
            createdAt: NOW - 864e5 * 8,
            updatedAt: NOW - 3600e3,
            revision: 1,
            pre: {"sp_pre_1":{"status":"ok","note":"사전확인"},"sp_pre_2":{"status":"ok","note":"사전확인"}},
            domain: {"sp_chk_1":{"status":"ok","note":"점검중"},"sp_chk_2":{"status":"fix","note":"점검중"}},
            docs: {"sp_doc_1":{"status":"ok","note":"확보"}}
          }
        }
      },
      comms: {
        'pr_specialcons_1': {
          cm_1: {
            id: 'cm_1',
            projectId: 'pr_specialcons_1',
            entityType: 'Document',
            schemaVersion: 1,
            contractVersion: 1,
            createdAt: NOW - 864e5 * 2,
            updatedAt: NOW - 864e5 * 2,
            revision: 1,
            source: 'imap',
            date: '2026-11-26',
            subject: '[특화·위탁컨설팅] 사전 점검 자료 송부',
            maskedPreview: '특화위탁 관련 기초 서식 전달드립니다.',
            atts: ['사전질의표.xlsx']
          }
        }
      },
      reports: {}
    }
  }
};
