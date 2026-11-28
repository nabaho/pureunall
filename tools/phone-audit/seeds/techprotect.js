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
        },
        'pr_techprotect_2': {
          id: 'pr_techprotect_2',
          entityType: 'Project',
          schemaVersion: 1,
          contractVersion: 1,
          createdAt: NOW - 864e5 * 20,
          updatedAt: NOW - 864e5 * 3,
          revision: 1,
          companyName: '(주)나다ERP샘플',
          year: 2026,
          trackId: 'tp_basic',
          trackName: '통합 기술보호지원반 (초기·진단)',
          stage: 'followup',
          consultantName: '점검노무사',
          status: 'done',
          caseNo: '기술보호-2026-901',
          summaryNote: '[ERP] ERP 수임(기술보호-2026-901)'
        },
        'pr_techprotect_3': {
          id: 'pr_techprotect_3',
          entityType: 'Project',
          schemaVersion: 1,
          contractVersion: 1,
          createdAt: NOW - 864e5 * 20,
          updatedAt: NOW - 864e5 * 3,
          revision: 1,
          companyName: '(주)다라로컬샘플',
          year: 2025,
          trackId: 'tp_basic',
          trackName: '통합 기술보호지원반 (초기·진단)',
          stage: 'followup',
          consultantName: '점검노무사',
          status: 'done',
          caseNo: '기술보호-2025-902',
          summaryNote: '[ERP+로컬] ERP 수임(기술보호-2025-902) · 2025 통합 기술보호지원반 (6파일)'
        },
        'pr_techprotect_4': {
          id: 'pr_techprotect_4',
          entityType: 'Project',
          schemaVersion: 1,
          contractVersion: 1,
          createdAt: NOW - 864e5 * 20,
          updatedAt: NOW - 864e5 * 3,
          revision: 1,
          companyName: '(주)라마메일샘플',
          year: 2026,
          trackId: 'tp_basic',
          trackName: '통합 기술보호지원반 (초기·진단)',
          stage: 'collect',
          consultantName: '점검노무사',
          status: 'active',
          summaryNote: '[메일] 메일 1통 자동분류'
        },
        'pr_techprotect_5': {
          id: 'pr_techprotect_5',
          entityType: 'Project',
          schemaVersion: 1,
          contractVersion: 1,
          createdAt: NOW - 864e5 * 20,
          updatedAt: NOW - 864e5 * 3,
          revision: 1,
          companyName: '(주)마바안내샘플',
          year: 2026,
          trackId: 'tp_basic',
          trackName: '통합 기술보호지원반 (초기·진단)',
          stage: 'intake',
          consultantName: '점검노무사',
          status: 'active',
          kind: 'guide',
          guideSentAt: '2026-11-10',
          summaryNote: ''
        },
        'pr_techprotect_6': {
          id: 'pr_techprotect_6',
          entityType: 'Project',
          schemaVersion: 1,
          contractVersion: 1,
          createdAt: NOW - 864e5 * 20,
          updatedAt: NOW - 864e5 * 3,
          revision: 1,
          companyName: '(주)바사신청샘플',
          year: 2026,
          trackId: 'tp_basic',
          trackName: '통합 기술보호지원반 (초기·진단)',
          stage: 'intake',
          consultantName: '점검노무사',
          status: 'active',
          kind: 'guide',
          guideSentAt: '2026-11-05',
          guideResponse: 'apply',
          guideRespondedAt: '2026-11-12',
          guideNote: '내년 상반기 신청하겠다고 함',
          summaryNote: ''
        },
        'pr_techprotect_7': {
          id: 'pr_techprotect_7',
          entityType: 'Project',
          schemaVersion: 1,
          contractVersion: 1,
          createdAt: NOW - 864e5 * 20,
          updatedAt: NOW - 864e5 * 3,
          revision: 1,
          companyName: '(주)사아타사샘플',
          year: 2026,
          trackId: 'tp_basic',
          trackName: '통합 기술보호지원반 (초기·진단)',
          stage: 'intake',
          consultantName: '점검노무사',
          status: 'active',
          kind: 'guide',
          guideSentAt: '2026-10-20',
          guideResponse: 'othercons',
          guideRespondedAt: '2026-10-27',
          guideNote: '다른 기관 컨설팅 진행 중이라 이번엔 어렵다',
          summaryNote: ''
        },
        'pr_techprotect_8': {
          id: 'pr_techprotect_8',
          entityType: 'Project',
          schemaVersion: 1,
          contractVersion: 1,
          createdAt: NOW - 864e5 * 20,
          updatedAt: NOW - 864e5 * 3,
          revision: 1,
          companyName: '(주)아자거절샘플',
          year: 2025,
          trackId: 'tp_basic',
          trackName: '통합 기술보호지원반 (초기·진단)',
          stage: 'followup',
          consultantName: '점검노무사',
          status: 'done',
          kind: 'guide',
          guideSentAt: '2025-09-02',
          guideResponse: 'decline',
          guideRespondedAt: '2025-09-05',
          guideNote: '인력이 없어 거절',
          summaryNote: ''
        },
        'pr_techprotect_9': {
          id: 'pr_techprotect_9',
          entityType: 'Project',
          schemaVersion: 1,
          contractVersion: 1,
          createdAt: NOW - 864e5 * 20,
          updatedAt: NOW - 864e5 * 3,
          revision: 1,
          companyName: '(주)자차무응답샘플',
          year: 2025,
          trackId: 'tp_basic',
          trackName: '통합 기술보호지원반 (초기·진단)',
          stage: 'followup',
          consultantName: '점검노무사',
          status: 'done',
          kind: 'guide',
          guideSentAt: '2025-09-02',
          guideResponse: 'noreply',
          summaryNote: ''
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
  },
  // 안내·기타 탭 / 수행 탭 갈무리용 — 모두 지어낸 기업·메모
  views: [
    { name: 'guide', run: async (page) => { await page.click('[data-tab="guide"]'); await page.waitForSelector('#guideBox table.t'); } },
    { name: 'inbox', run: async (page) => { await page.click('[data-tab="inbox"]'); await page.waitForTimeout(300); } },
    { name: 'report', run: async (page) => { await page.click('[data-tab="report"]'); await page.waitForTimeout(300); } }
  ]
};
