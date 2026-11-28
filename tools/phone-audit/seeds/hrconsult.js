/* 폰·PC 화면 실측 점검용 합성 자료 (hrconsult.html) — 모두 지어낸 값이다. */
'use strict';
const NOW = Date.UTC(2026, 10, 28, 1, 0, 0);

module.exports = {
  data: {
    scal_hrconsult: {
      projects: {
        'pr_hrconsult_1': {
          id: 'pr_hrconsult_1',
          entityType: 'Project',
          schemaVersion: 1,
          contractVersion: 1,
          createdAt: NOW - 864e5 * 10,
          updatedAt: NOW - 3600e3,
          revision: 1,
          companyName: '(주)가나기초인사노무샘플',
          year: 2026,
          trackId: 'hr_contract',
          trackName: '근로·연봉·단시간·프리랜서/도급계약서 정비 (메일 1,667통)',
          stage: 'visit',
          workerCount: 25,
          consultantName: '점검노무사',
          status: 'active',
          summaryNote: '기초인사노무 현장 점검 진행 중 (연락처 010-0000-1001)'
        },
        // 같은 사업장이 해마다 쌓인 건 — «사업장 한 줄 + 연도 칩» 으로 묶여 보여야 한다(지어낸 값)
        'pr_hrconsult_2': {
          id: 'pr_hrconsult_2', entityType: 'Project', schemaVersion: 1, contractVersion: 1,
          createdAt: NOW - 864e5 * 400, updatedAt: NOW - 864e5 * 40, revision: 1,
          companyName: '(주)가나기초인사노무샘플', year: 2025, trackId: 'hr_rules', trackName: '취업규칙·인사/복무/보수규정 연계 정비 (기업규정집 연동)',
          stage: 'followup', workerCount: 24, consultantName: '점검노무사', status: 'done',
          summaryNote: '지난해 취업규칙 정비 완료(지어낸 값)'
        },
        'pr_hrconsult_3': {
          id: 'pr_hrconsult_3', entityType: 'Project', schemaVersion: 1, contractVersion: 1,
          createdAt: NOW - 864e5 * 760, updatedAt: NOW - 864e5 * 400, revision: 1,
          companyName: '(주)가나기초인사노무샘플', year: 2024, trackId: 'hr_contract', trackName: '근로·연봉·단시간·프리랜서/도급계약서 정비 (메일 1,667통)',
          stage: 'followup', workerCount: 22, consultantName: '점검노무사', status: 'done',
          summaryNote: '근로계약서 정비 완료(지어낸 값)'
        },
        'pr_hrconsult_4': {
          id: 'pr_hrconsult_4', entityType: 'Project', schemaVersion: 1, contractVersion: 1,
          createdAt: NOW - 864e5 * 20, updatedAt: NOW - 3600e3 * 5, revision: 1,
          companyName: '나다기초인사노무샘플(주)', year: 2026, trackId: 'hr_pay', trackName: '급여설계·통상/포괄임금·교대제·근로시간 개편 (메일 1,027통)',
          stage: 'collect', workerCount: 40, consultantName: '점검노무사', status: 'active',
          summaryNote: '급여설계 착수(지어낸 값)'
        },
        'pr_hrconsult_5': {
          id: 'pr_hrconsult_5', entityType: 'Project', schemaVersion: 1, contractVersion: 1,
          createdAt: NOW - 864e5 * 500, updatedAt: NOW - 864e5 * 300, revision: 1,
          companyName: '나다기초인사노무샘플(주)', year: 2023, trackId: 'hr_pay', trackName: '급여설계·통상/포괄임금·교대제·근로시간 개편 (메일 1,027통)',
          stage: 'followup', workerCount: 38, consultantName: '점검노무사', status: 'done',
          summaryNote: '지난 급여설계(지어낸 값)'
        },
        'pr_hrconsult_6': {
          id: 'pr_hrconsult_6', entityType: 'Project', schemaVersion: 1, contractVersion: 1,
          createdAt: NOW - 864e5 * 900, updatedAt: NOW - 864e5 * 700, revision: 1,
          companyName: '다라장수기초인사노무샘플', year: 2022, trackId: 'hr_contract', trackName: '근로·연봉·단시간·프리랜서/도급계약서 정비 (메일 1,667통)',
          stage: 'followup', workerCount: 12, consultantName: '점검노무사', status: 'done',
          summaryNote: '해마다 이어진 건 1(지어낸 값)'
        },
        'pr_hrconsult_7': {
          id: 'pr_hrconsult_7', entityType: 'Project', schemaVersion: 1, contractVersion: 1,
          createdAt: NOW - 864e5 * 800, updatedAt: NOW - 864e5 * 600, revision: 1,
          companyName: '다라장수기초인사노무샘플', year: 2021, trackId: 'hr_contract', trackName: '근로·연봉·단시간·프리랜서/도급계약서 정비 (메일 1,667통)',
          stage: 'followup', workerCount: 12, consultantName: '점검노무사', status: 'done',
          summaryNote: '해마다 이어진 건 2(지어낸 값)'
        },
        'pr_hrconsult_8': {
          id: 'pr_hrconsult_8', entityType: 'Project', schemaVersion: 1, contractVersion: 1,
          createdAt: NOW - 864e5 * 700, updatedAt: NOW - 864e5 * 500, revision: 1,
          companyName: '다라장수기초인사노무샘플', year: 2023, trackId: 'hr_rules', trackName: '취업규칙·인사/복무/보수규정 연계 정비 (기업규정집 연동)',
          stage: 'followup', workerCount: 12, consultantName: '점검노무사', status: 'done',
          summaryNote: '해마다 이어진 건 3(지어낸 값)'
        },
        'pr_hrconsult_9': {
          id: 'pr_hrconsult_9', entityType: 'Project', schemaVersion: 1, contractVersion: 1,
          createdAt: NOW - 864e5 * 500, updatedAt: NOW - 864e5 * 400, revision: 1,
          companyName: '다라장수기초인사노무샘플', year: 2024, trackId: 'hr_rules', trackName: '취업규칙·인사/복무/보수규정 연계 정비 (기업규정집 연동)',
          stage: 'followup', workerCount: 12, consultantName: '점검노무사', status: 'done',
          summaryNote: '해마다 이어진 건 4(지어낸 값)'
        },
        'pr_hrconsult_10': {
          id: 'pr_hrconsult_10', entityType: 'Project', schemaVersion: 1, contractVersion: 1,
          createdAt: NOW - 864e5 * 300, updatedAt: NOW - 864e5 * 200, revision: 1,
          companyName: '다라장수기초인사노무샘플', year: 2025, trackId: 'hr_pay', trackName: '급여설계·통상/포괄임금·교대제·근로시간 개편 (메일 1,027통)',
          stage: 'followup', workerCount: 12, consultantName: '점검노무사', status: 'done',
          summaryNote: '해마다 이어진 건 5(지어낸 값)'
        },
        'pr_hrconsult_11': {
          id: 'pr_hrconsult_11', entityType: 'Project', schemaVersion: 1, contractVersion: 1,
          createdAt: NOW - 864e5 * 100, updatedAt: NOW - 864e5 * 30, revision: 1,
          companyName: '다라장수기초인사노무샘플', year: 2026, trackId: 'hr_pay', trackName: '급여설계·통상/포괄임금·교대제·근로시간 개편 (메일 1,027통)',
          stage: 'followup', workerCount: 12, consultantName: '점검노무사', status: 'done',
          summaryNote: '해마다 이어진 건 6 — 칩이 5개를 넘으면 +1(지어낸 값)'
        }
      },
      checks: {
        'pr_hrconsult_1': {
          main: {
            id: 'main',
            projectId: 'pr_hrconsult_1',
            entityType: 'Document',
            schemaVersion: 1,
            contractVersion: 1,
            createdAt: NOW - 864e5 * 8,
            updatedAt: NOW - 3600e3,
            revision: 1,
            pre: {"hr_pre_1":{"status":"ok","note":"사전확인"},"hr_pre_2":{"status":"ok","note":"사전확인"}},
            domain: {"hr_chk_1":{"status":"ok","note":"점검중"},"hr_chk_2":{"status":"fix","note":"점검중"}},
            docs: {"hr_doc_1":{"status":"ok","note":"확보"}}
          }
        }
      },
      comms: {
        'pr_hrconsult_1': {
          cm_1: {
            id: 'cm_1',
            projectId: 'pr_hrconsult_1',
            entityType: 'Document',
            schemaVersion: 1,
            contractVersion: 1,
            createdAt: NOW - 864e5 * 2,
            updatedAt: NOW - 864e5 * 2,
            revision: 1,
            source: 'imap',
            date: '2026-11-26',
            subject: '[기초인사노무] 사전 점검 자료 송부',
            maskedPreview: '기초인사노무 관련 기초 서식 전달드립니다.',
            atts: ['사전질의표.xlsx']
          }
        }
      },
      reports: {}
    }
  }
};
