/* 폰·PC 화면 실측 점검용 합성 자료 (socialent.html) — 모두 지어낸 값이다. */
'use strict';
const NOW = Date.UTC(2026, 10, 28, 1, 0, 0);

module.exports = {
  data: {
    scal_socialent: {
      projects: {
        'pr_socialent_1': {
          id: 'pr_socialent_1',
          entityType: 'Project',
          schemaVersion: 1,
          contractVersion: 1,
          createdAt: NOW - 864e5 * 10,
          updatedAt: NOW - 3600e3,
          revision: 1,
          companyName: '(주)가나사회적기업샘플',
          year: 2026,
          trackId: 'se_seed',
          trackName: '충남사회적경제지원센터 씨앗컨설팅 (초기·진입)',
          stage: 'visit',
          workerCount: 25,
          consultantName: '점검노무사',
          status: 'active',
          summaryNote: '사회적기업·씨앗 현장 점검 진행 중 (연락처 010-0000-1001)'
        },
        'pr_socialent_2': {
          id: 'pr_socialent_2',
          entityType: 'Project',
          schemaVersion: 1,
          contractVersion: 1,
          createdAt: NOW - 864e5 * 400,
          updatedAt: NOW - 864e5 * 300,
          revision: 1,
          companyName: '(주)다라사회적기업샘플',
          year: 2025,
          trackId: 'se_cert',
          trackName: '(예비)사회적기업 인증·지정 노무요건 정비',
          stage: 'followup',
          workerCount: 40,
          consultantName: '점검노무사',
          status: 'done',
          summaryNote: '다른 기관(세부 트랙) 사업 — 왼쪽 대시보드 점검용 지어낸 자료'
        }
      },
      checks: {
        'pr_socialent_1': {
          main: {
            id: 'main',
            projectId: 'pr_socialent_1',
            entityType: 'Document',
            schemaVersion: 1,
            contractVersion: 1,
            createdAt: NOW - 864e5 * 8,
            updatedAt: NOW - 3600e3,
            revision: 1,
            pre: {"se_pre_1":{"status":"ok","note":"사전확인"},"se_pre_2":{"status":"ok","note":"사전확인"}},
            domain: {"se_chk_1":{"status":"ok","note":"점검중"},"se_chk_2":{"status":"fix","note":"점검중"}},
            docs: {"se_doc_1":{"status":"ok","note":"확보"}}
          }
        }
      },
      comms: {
        'pr_socialent_1': {
          cm_1: {
            id: 'cm_1',
            projectId: 'pr_socialent_1',
            entityType: 'Document',
            schemaVersion: 1,
            contractVersion: 1,
            createdAt: NOW - 864e5 * 2,
            updatedAt: NOW - 864e5 * 2,
            revision: 1,
            source: 'imap',
            date: '2026-11-26',
            subject: '[사회적기업·씨앗] 사전 점검 자료 송부',
            maskedPreview: '사회적기업 관련 기초 서식 전달드립니다.',
            atts: ['사전질의표.xlsx']
          }
        }
      },
      reports: {}
    }
  }
};
