/* 폰·PC 화면 실측 점검용 합성 자료 (chamber.html) — 모두 지어낸 값이다. */
'use strict';
const NOW = Date.UTC(2026, 10, 28, 1, 0, 0);

module.exports = {
  data: {
    scal_chamber: {
      projects: {
        'pr_chamber_1': {
          id: 'pr_chamber_1',
          entityType: 'Project',
          schemaVersion: 1,
          contractVersion: 1,
          createdAt: NOW - 864e5 * 10,
          updatedAt: NOW - 3600e3,
          revision: 1,
          companyName: '(주)가나북부상공회의소샘플',
          caseNo: '인사충남-2026-001',
          year: 2026,
          trackId: 'ch_chungnam',
          trackName: '충남북부상공회의소 인사노무컨설팅',
          stage: 'visit',
          workerCount: 25,
          consultantName: '점검노무사',
          status: 'active',
          summaryNote: '충남북부상의 회원사 현장 점검 진행 중'
        },
        'pr_chamber_2': {
          id: 'pr_chamber_2',
          entityType: 'Project',
          schemaVersion: 1,
          contractVersion: 1,
          createdAt: NOW - 864e5 * 20,
          updatedAt: NOW - 864e5 * 2,
          revision: 1,
          companyName: '(주)다라서산상공회의소샘플',
          caseNo: '인사서산-2026-001',
          year: 2026,
          trackId: 'ch_seosan',
          trackName: '서산상공회의소 인사노무컨설팅',
          stage: 'design',
          workerCount: 30,
          consultantName: '점검노무사',
          status: 'active',
          summaryNote: '서산상의 회원사 근로계약·임금 정비 중'
        },
        'pr_chamber_3': {
          id: 'pr_chamber_3',
          entityType: 'Project',
          schemaVersion: 1,
          contractVersion: 1,
          createdAt: NOW - 864e5 * 400,
          updatedAt: NOW - 864e5 * 365,
          revision: 1,
          companyName: '(주)마바과거북부샘플',
          year: 2025,
          trackId: 'ch_chungnam',
          trackName: '충남북부상공회의소 인사노무컨설팅',
          stage: 'followup',
          workerCount: 40,
          consultantName: '점검노무사',
          status: 'done',
          summaryNote: '2025 충남북부상의 결과보고 완료 (과거이력)'
        }
      },
      regions: {
        'ch_reg_demo': {
          id: 'ch_reg_demo',
          entityType: 'Document',
          schemaVersion: 1,
          contractVersion: 1,
          createdAt: NOW - 864e5 * 5,
          updatedAt: NOW - 864e5 * 5,
          revision: 1,
          name: '천안아산상공회의소 인사노무컨설팅',
          shortName: '천안아산상의',
          agency: '상공회의소',
          keywords: '천안상의,아산상의',
          sortOrder: 101
        }
      },
      checks: {
        'pr_chamber_1': {
          main: {
            id: 'main',
            projectId: 'pr_chamber_1',
            entityType: 'Document',
            schemaVersion: 1,
            contractVersion: 1,
            createdAt: NOW - 864e5 * 8,
            updatedAt: NOW - 3600e3,
            revision: 1,
            pre: {"ch_pre_1":{"status":"ok","note":"사전확인"},"ch_pre_2":{"status":"ok","note":"사전확인"}},
            domain: {"ch_chk_1":{"status":"ok","note":"점검중"},"ch_chk_2":{"status":"fix","note":"점검중"}},
            docs: {"ch_doc_1":{"status":"ok","note":"확보"}}
          }
        }
      },
      comms: {
        'pr_chamber_1': {
          cm_1: {
            id: 'cm_1',
            projectId: 'pr_chamber_1',
            entityType: 'Document',
            schemaVersion: 1,
            contractVersion: 1,
            createdAt: NOW - 864e5 * 2,
            updatedAt: NOW - 864e5 * 2,
            revision: 1,
            source: 'imap',
            date: '2026-11-26',
            subject: '[상공회의소컨설팅] 사전 점검 자료 송부',
            maskedPreview: '상공회의소 관련 기초 서식 전달드립니다.',
            atts: ['사전질의표.xlsx']
          }
        }
      },
      reports: {}
    }
  }
};
