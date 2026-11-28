/* 폰·PC 화면 실측 점검용 합성 자료 (laboraudit.html — 근로감독 대응·이력) — 모두 지어낸 값이다. */
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
          companyName: '(주)가나근로감독샘플',
          year: 2026,
          trackId: 'la_regular',
          trackName: '정기근로감독 (고용노동부 정기·기획 감독 수검)',
          stage: 'design',
          workerCount: 42,
          consultantName: '점검노무사',
          status: 'active',
          inspPeriod: '2026-10-14 ~ 2026-10-16',
          inspOffice: '천안지청',
          inspDue: '2026-11-30',
          inspIssues: '근로계약서 · 연장근로 가산수당 체불 · 노사협의회',
          inspResult: '진행중',
          summaryNote: '정기근로감독 현장수검 후 시정지시 대응 중'
        },
        'pr_laboraudit_2': {
          id: 'pr_laboraudit_2',
          entityType: 'Project',
          schemaVersion: 1,
          contractVersion: 1,
          createdAt: NOW - 864e5 * 390,
          updatedAt: NOW - 864e5 * 360,
          revision: 1,
          companyName: '(주)다라전자샘플',
          year: 2025,
          trackId: 'la_remedy',
          trackName: '시정지시서 수령 · 시정완료 보고 · 소명 대응',
          stage: 'followup',
          workerCount: 68,
          consultantName: '점검노무사',
          status: 'done',
          inspPeriod: '2025-05-12 ~ 2025-05-14',
          inspOffice: '서산출장소',
          inspDue: '2025-06-10',
          inspIssues: '임금명세서 교부 · 취업규칙 게시 · 연차유급휴가',
          inspResult: '시정완료',
          summaryNote: '시정완료 보고서 제출 및 행정종결 확인'
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
            pre: { la_pre_1: { status: 'ok', note: '정기감독 확인' }, la_pre_2: { status: 'ok', note: '10대 장부 확보' } },
            domain: { la_chk_1: { status: 'fix', note: '보완 교부중' }, la_chk_2: { status: 'fix', note: '수당 정산중' } },
            docs: { la_doc_1: { status: 'ok', note: '시정지시서 접수' } }
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
            source: 'mail',
            date: '2026-10-18',
            subject: '[천안지청] 정기근로감독 시정지시서 및 지적사항 대응 요청',
            maskedPreview: '감독기간 2026.10.14~10.16, 근로계약서 및 연장수당·노사협의회 시정지시서 송부드립니다.',
            atts: ['시정지시서.pdf']
          }
        }
      },
      reports: {}
    }
  }
};
