/* 폰·PC 화면 실측 점검용 합성 자료 (pubconsult.html) — 모두 지어낸 값이다. */
'use strict';
const NOW = Date.UTC(2026, 10, 28, 1, 0, 0);

module.exports = {
  data: {
    scal_pubconsult: {
      projects: {
        'pr_pubconsult_1': {
          id: 'pr_pubconsult_1',
          entityType: 'Project',
          schemaVersion: 1,
          contractVersion: 1,
          createdAt: NOW - 864e5 * 10,
          updatedAt: NOW - 3600e3,
          revision: 1,
          companyName: '(주)가나공공기관샘플',
          year: 2026,
          trackId: 'pub_welfare',
          trackName: '사회서비스원·복지시설 품질관리/처우/노무컨설팅',
          stage: 'visit',
          workerCount: 25,
          consultantName: '점검노무사',
          status: 'active',
          summaryNote: '공공기관컨설팅 현장 점검 진행 중 (연락처 010-0000-1001)'
        },
        'pr_pubconsult_2': {
          id: 'pr_pubconsult_2',
          entityType: 'Project',
          schemaVersion: 1,
          contractVersion: 1,
          createdAt: NOW - 864e5 * 400,
          updatedAt: NOW - 864e5 * 300,
          revision: 1,
          companyName: '(주)다라공공기관샘플',
          year: 2025,
          trackId: 'pub_gov',
          trackName: '지자체·공공기관 공무직 규정·용역원가·대행 자문',
          stage: 'followup',
          workerCount: 40,
          consultantName: '점검노무사',
          status: 'done',
          summaryNote: '다른 기관(세부 트랙) 사업 — 왼쪽 대시보드 점검용 지어낸 자료'
        }
      },
      checks: {
        'pr_pubconsult_1': {
          main: {
            id: 'main',
            projectId: 'pr_pubconsult_1',
            entityType: 'Document',
            schemaVersion: 1,
            contractVersion: 1,
            createdAt: NOW - 864e5 * 8,
            updatedAt: NOW - 3600e3,
            revision: 1,
            pre: {"pub_pre_1":{"status":"ok","note":"사전확인"},"pub_pre_2":{"status":"ok","note":"사전확인"}},
            domain: {"pub_chk_1":{"status":"ok","note":"점검중"},"pub_chk_2":{"status":"fix","note":"점검중"}},
            docs: {"pub_doc_1":{"status":"ok","note":"확보"}}
          }
        }
      },
      comms: {
        'pr_pubconsult_1': {
          cm_1: {
            id: 'cm_1',
            projectId: 'pr_pubconsult_1',
            entityType: 'Document',
            schemaVersion: 1,
            contractVersion: 1,
            createdAt: NOW - 864e5 * 2,
            updatedAt: NOW - 864e5 * 2,
            revision: 1,
            source: 'imap',
            date: '2026-11-26',
            subject: '[공공기관컨설팅] 사전 점검 자료 송부',
            maskedPreview: '공공기관 관련 기초 서식 전달드립니다.',
            atts: ['사전질의표.xlsx']
          }
        }
      },
      reports: {}
    }
  },
  // 왼쪽 대시보드(기관별) — 기관 하나를 고르면 그 기관 사업만, 보고서 탭에서는 대시보드가 접힌다 (2026-11-28 12개 앱 공통)
  views: [
    { name: 'track', run: async (p) => { await p.click('#leftDash .ld-item:nth-child(2) .ld-item-btn'); } },
    { name: 'report', run: async (p) => { await p.click('#tabs button[data-tab="report"]'); } }
  ]
};
