/* 폰·PC 화면 실측 점검용 합성 자료 (sixthind.html) — 모두 지어낸 값이다. */
'use strict';
const NOW = Date.UTC(2026, 10, 28, 1, 0, 0);

module.exports = {
  data: {
    scal_sixthind: {
      projects: {
        'pr_sixthind_1': {
          id: 'pr_sixthind_1',
          entityType: 'Project',
          schemaVersion: 1,
          contractVersion: 1,
          createdAt: NOW - 864e5 * 10,
          updatedAt: NOW - 3600e3,
          revision: 1,
          companyName: '(주)가나6차산업샘플',
          year: 2026,
          trackId: 'sx_sejong',
          trackName: '세종 농촌융복합(6차)산업지원센터 현장코칭·전문상담',
          stage: 'visit',
          workerCount: 25,
          consultantName: '점검노무사',
          status: 'active',
          summaryNote: '6차산업컨설팅 현장 점검 진행 중 (연락처 010-0000-1001)'
        },
        'pr_sixthind_2': {
          id: 'pr_sixthind_2', entityType: 'Project', schemaVersion: 1, contractVersion: 1,
          createdAt: NOW - 864e5 * 12, updatedAt: NOW - 3600e3 * 2, revision: 1,
          companyName: '(주)나다충남농원', year: 2026, trackId: 'sx_chungnam', trackName: '충남 농촌융복합산업지원센터 현장코칭·인증지원',
          stage: 'visit', workerCount: 12, consultantName: '점검노무사', status: 'active',
          summaryNote: '충남 샘플(지어낸 값)'
        },
        'pr_sixthind_3': {
          id: 'pr_sixthind_3', entityType: 'Project', schemaVersion: 1, contractVersion: 1,
          createdAt: NOW - 864e5 * 13, updatedAt: NOW - 3600e3 * 3, revision: 1,
          companyName: '다라충북영농조합법인', year: 2026, trackId: 'sx_chungbuk', trackName: '충북 농촌융복합산업지원센터 전문상담·현장코칭',
          stage: 'visit', workerCount: 13, consultantName: '점검노무사', status: 'active',
          summaryNote: '충북 샘플(지어낸 값)'
        },
        'pr_sixthind_4': {
          id: 'pr_sixthind_4', entityType: 'Project', schemaVersion: 1, contractVersion: 1,
          createdAt: NOW - 864e5 * 14, updatedAt: NOW - 3600e3 * 4, revision: 1,
          companyName: '(주)라마세종팜', year: 2025, trackId: 'sx_sejong', trackName: '세종 농촌융복합(6차)산업지원센터 현장코칭·전문상담',
          stage: 'followup', workerCount: 14, consultantName: '점검노무사', status: 'done',
          summaryNote: '세종 샘플(지어낸 값)'
        },
        'pr_sixthind_5': {
          id: 'pr_sixthind_5', entityType: 'Project', schemaVersion: 1, contractVersion: 1,
          createdAt: NOW - 864e5 * 15, updatedAt: NOW - 3600e3 * 5, revision: 1,
          companyName: '마바충남발효', year: 2025, trackId: 'sx_chungnam', trackName: '충남 농촌융복합산업지원센터 현장코칭·인증지원',
          stage: 'followup', workerCount: 15, consultantName: '점검노무사', status: 'done',
          summaryNote: '충남 샘플(지어낸 값)'
        },
        'pr_sixthind_6': {
          id: 'pr_sixthind_6', entityType: 'Project', schemaVersion: 1, contractVersion: 1,
          createdAt: NOW - 864e5 * 16, updatedAt: NOW - 3600e3 * 6, revision: 1,
          companyName: '6차산업 인증샘플(제외대상)', year: 2025, trackId: 'sx_cert', trackName: '6차산업(농촌융복합) 인증지원 현장평가 · 상생프로젝트',
          stage: 'followup', workerCount: 16, consultantName: '점검노무사', status: 'done',
          summaryNote: '제외 트랙 샘플 — 화면에 보이면 안 됨'
        },
        'pr_sixthind_7': {
          id: 'pr_sixthind_7', entityType: 'Project', schemaVersion: 1, contractVersion: 1,
          createdAt: NOW - 864e5 * 17, updatedAt: NOW - 3600e3 * 7, revision: 1,
          companyName: '경기샘플농장(제외대상)', year: 2026, trackId: 'sx_gyeonggi', trackName: '경기·기타 광역 6차산업 지원센터',
          stage: 'visit', workerCount: 17, consultantName: '점검노무사', status: 'active',
          summaryNote: '제외 트랙 샘플 — 화면에 보이면 안 됨'
        }
      },
      checks: {
        'pr_sixthind_1': {
          main: {
            id: 'main',
            projectId: 'pr_sixthind_1',
            entityType: 'Document',
            schemaVersion: 1,
            contractVersion: 1,
            createdAt: NOW - 864e5 * 8,
            updatedAt: NOW - 3600e3,
            revision: 1,
            pre: {"sx_pre_1":{"status":"ok","note":"사전확인"},"sx_pre_2":{"status":"ok","note":"사전확인"}},
            domain: {"sx_chk_1":{"status":"ok","note":"점검중"},"sx_chk_2":{"status":"fix","note":"점검중"}},
            docs: {"sx_doc_1":{"status":"ok","note":"확보"}}
          }
        }
      },
      comms: {
        'pr_sixthind_1': {
          cm_1: {
            id: 'cm_1',
            projectId: 'pr_sixthind_1',
            entityType: 'Document',
            schemaVersion: 1,
            contractVersion: 1,
            createdAt: NOW - 864e5 * 2,
            updatedAt: NOW - 864e5 * 2,
            revision: 1,
            source: 'imap',
            date: '2026-11-26',
            subject: '[6차산업컨설팅] 사전 점검 자료 송부',
            maskedPreview: '6차산업 관련 기초 서식 전달드립니다.',
            atts: ['사전질의표.xlsx']
          }
        }
      },
      reports: {}
    }
  }
};
