/* 폰·PC 화면 실측 점검용 합성 자료 (clinic.html) — 모두 지어낸 값이다. */
'use strict';
const NOW = Date.UTC(2026, 10, 28, 1, 0, 0);

module.exports = {
  data: {
    scal_clinic: {
      projects: {
        'pr_clinic_2': { id: 'pr_clinic_2', entityType: 'Project', schemaVersion: 1, contractVersion: 1, createdAt: NOW - 864e5 * 90, updatedAt: NOW - 864e5 * 60, revision: 1,
          companyName: '(주)나다클리닉샘플', caseNo: '현장클리-2026-901', year: 2026, trackId: 'cl_clinic', trackName: '비즈니스지원단 현장클리닉 (1~3일/회차)', stage: 'followup', workerCount: 30, consultantName: '점검노무사', status: 'done', summaryNote: '[ERP] ERP 수임(현장클리-2026-901)' },
        'pr_clinic_3': { id: 'pr_clinic_3', entityType: 'Project', schemaVersion: 1, contractVersion: 1, createdAt: NOW - 864e5 * 60, updatedAt: NOW - 864e5 * 40, revision: 1,
          companyName: '(주)다라클리닉샘플', caseNo: '현장클리-2026-902', year: 2026, trackId: 'cl_clinic', trackName: '비즈니스지원단 현장클리닉 (1~3일/회차)', stage: 'followup', workerCount: 18, consultantName: '점검노무사', status: 'done', summaryNote: '성과추적 건 — 사후 점검 기록' },
        'pr_clinic_4': { id: 'pr_clinic_4', entityType: 'Project', schemaVersion: 1, contractVersion: 1, createdAt: NOW - 864e5 * 400, updatedAt: NOW - 864e5 * 380, revision: 1,
          companyName: '(주)마바클리닉샘플', year: 2025, trackId: 'cl_clinic', trackName: '비즈니스지원단 현장클리닉 (1~3일/회차)', stage: 'followup', workerCount: 40, consultantName: '점검노무사', status: 'done', summaryNote: '2025 수행 완료 (메모 직접 작성)' },
        'pr_clinic_1': {
          id: 'pr_clinic_1',
          entityType: 'Project',
          schemaVersion: 1,
          contractVersion: 1,
          createdAt: NOW - 864e5 * 10,
          updatedAt: NOW - 3600e3,
          revision: 1,
          companyName: '(주)가나현장클리닉샘플',
          caseNo: '현장클리-2026-900',
          year: 2026,
          trackId: 'cl_clinic',
          trackName: '비즈니스지원단 현장클리닉 (1~3일/회차)',
          stage: 'visit',
          workerCount: 25,
          consultantName: '점검노무사',
          status: 'active',
          summaryNote: '현장클리닉 현장 점검 진행 중 (연락처 010-0000-1001)'
        }
      },
      checks: {
        'pr_clinic_1': {
          main: {
            id: 'main',
            projectId: 'pr_clinic_1',
            entityType: 'Document',
            schemaVersion: 1,
            contractVersion: 1,
            createdAt: NOW - 864e5 * 8,
            updatedAt: NOW - 3600e3,
            revision: 1,
            pre: {"cl_pre_1":{"status":"ok","note":"사전확인"},"cl_pre_2":{"status":"ok","note":"사전확인"}},
            domain: {"cl_chk_1":{"status":"ok","note":"점검중"},"cl_chk_2":{"status":"fix","note":"점검중"}},
            docs: {"cl_doc_1":{"status":"ok","note":"확보"}}
          }
        }
      },
      comms: {
        'pr_clinic_1': {
          cm_1: {
            id: 'cm_1',
            projectId: 'pr_clinic_1',
            entityType: 'Document',
            schemaVersion: 1,
            contractVersion: 1,
            createdAt: NOW - 864e5 * 2,
            updatedAt: NOW - 864e5 * 2,
            revision: 1,
            source: 'imap',
            date: '2026-11-26',
            subject: '[현장클리닉] 사전 점검 자료 송부',
            maskedPreview: '현장클리닉 관련 기초 서식 전달드립니다.',
            atts: ['사전질의표.xlsx']
          }
        }
      },
      reports: {}
    }
    ,
    // ── 회차 표시 점검용 합성 자료(지어낸 값) — 사건번호로 이알피 컨설팅(data/consultings)에 이어진다 ──
    scal_types: { t3: { id: 't3', name: '현장클리닉', rounds: 3 } },
    scal_cos: { co_a: { id: 'co_a', name: '(합성)가나', erpId: 'cs_a' } },
    scal_scheds: {
      sa1: { id: 'sa1', coId: 'co_a', typeId: 't3', round: 1, date: '2026-03-10', isField: true },
      sa2: { id: 'sa2', coId: 'co_a', typeId: 't3', round: 2, date: '2026-04-14', isField: true },
      sa3: { id: 'sa3', coId: 'co_a', typeId: 't3', round: 3, date: '2026-12-15', isField: true }
    },
    data: {
      consultings: [
        { id: 'cs_a', no: '현장클리-2026-900', consultDays: 3, status: 'progress' },
        { id: 'cs_b', no: '현장클리-2026-901', consultDays: 2, status: 'closed' },
        { id: 'cs_c', no: '현장클리-2026-902', consultDays: 2, perfTrack: true, status: 'closed' }
      ]
    }
  },
  // 진행·체크 탭(회차 현황 표)과 보고서·RAG 탭(기관 서식 안내·접힌 일반 원고)도 눌러서 그려 본다
  views: [
    { name: 'detail', run: async (p) => { await p.click('#projectsBox [data-pick]'); } },
    { name: 'report', run: async (p) => { await p.click('#tabs button[data-tab="report"]'); } }
  ]
};
