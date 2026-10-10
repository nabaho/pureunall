'use strict';
/* 컨설팅보고서 앱 검사용 합성 자료 (2026-10-10) — 공개 저장소다, 실제 업체·사람 이름을 넣지 않는다.
 * 오늘 = 2026-10-10
 *   c1 가나상사 · t1 기술보호 2026 — 3회 끝, 종료 표시 2026-09-01, 저장본 초안(9/20 고침, AI 칸 있음) → 초안 20일
 *   c1 가나상사 · t2 일터혁신 2026 — 대형이라 줄이 없다
 *   c2 다라정밀 · t3 충남북부 인사노무 2026 — 3회 중 2회 → 작성 전 (부담당 a1)
 *   c3 마바산업 · t4 상공회의소 인사노무 2026 — 3/3 회 끝(종료 표시 없음), 양식 고르기(ask) → 미작성 151일
 *   c4 지운업체 · t1 — 지운 업체라 줄이 없다
 *   c5 사아테크 · t1 기술보호 2025 — 검토완료 v2 */
function seed() {
  return {
    scal_staff: [{ id: 'a1', name: '홍길동' }, { id: 'a2', name: '김가나' }],
    scal_types: [
      { id: 't1', name: '기술보호', fullName: '기술보호 컨설팅', agency: '', rounds: 3 },
      { id: 't2', name: '일터혁신', fullName: '일터혁신 컨설팅', agency: '', rounds: 8 },
      { id: 't3', name: '인사노무', fullName: '충남북부 인사노무 컨설팅', agency: '', rounds: 3 },
      { id: 't4', name: '상공회의소 인사노무', fullName: '', agency: '상공회의소', rounds: 3 },
    ],
    scal_cos: [
      { id: 'c1', name: '가나상사', types: ['t1', 't2'], defAtt: 'a1', endedTypes: { t1: '2026-09-01' } },
      { id: 'c2', name: '다라정밀', types: ['t3'], defAtt: 'a2', defCoAtts: ['a1'] },
      { id: 'c3', name: '마바산업', types: ['t4'], defAtt: 'a2' },
      { id: 'c4', name: '지운업체', types: ['t1'], defAtt: 'a1', deleted: true },
      { id: 'c5', name: '사아테크', types: ['t1'], defAtt: 'a1', endedTypes: { t1: '2025-06-30' } },
    ],
    scal_scheds: [
      { id: 's0', coId: 'c1', typeId: 't1', date: '2026-05-20', round: 1, phase: 'pre', isField: true },
      { id: 's1', coId: 'c1', typeId: 't1', date: '2026-06-02', round: 1, isField: true },
      { id: 's2', coId: 'c1', typeId: 't1', date: '2026-07-07', round: 2, isField: false },
      { id: 's3', coId: 'c1', typeId: 't1', date: '2026-08-04', round: 3, isField: true },
      { id: 's4', coId: 'c1', typeId: 't2', date: '2026-05-01', round: 1, isField: true },
      { id: 's5', coId: 'c2', typeId: 't3', date: '2026-08-10', round: 1, isField: true },
      { id: 's6', coId: 'c2', typeId: 't3', date: '2026-09-14', round: 2, isField: true },
      { id: 's7', coId: 'c3', typeId: 't4', date: '2026-03-03', round: 1, isField: true },
      { id: 's8', coId: 'c3', typeId: 't4', date: '2026-04-07', round: 2, isField: false },
      { id: 's9', coId: 'c3', typeId: 't4', date: '2026-05-12', round: 3, isField: true },
      { id: 's10', coId: 'c4', typeId: 't1', date: '2026-04-01', round: 1, isField: true },
      { id: 's11', coId: 'c5', typeId: 't1', date: '2025-04-01', round: 1, isField: true },
      { id: 's12', coId: 'c5', typeId: 't1', date: '2025-05-06', round: 2, isField: true },
      { id: 's13', coId: 'c5', typeId: 't1', date: '2025-06-03', round: 3, isField: true },
    ],
    scal_reports: {
      c1: {
        t1_2026: { formKey: 'techguard', typeId: 't1', state: '초안', ver: 0, updatedAt: Date.UTC(2026, 8, 20, 3),
          updatedBy: '홍길동', aiFields: ['summary.overall'], report: { summary: { overall: '본문은 목록에 나오면 안 된다' } } },
      },
      c5: {
        t1_2025: { formKey: 'techguard', typeId: 't1', state: '검토완료', ver: 2, updatedAt: Date.UTC(2025, 6, 10, 3),
          updatedBy: '홍길동', report: {} },
        t1_2025_v2: { formKey: 'techguard', state: '검토완료', ver: 2, report: {} },
      },
    },
    scal_rptFormsIndex: {
      techguard: { main: { 2024: { at: 1, size: 3, name: 'a.hwpx' } } },
      'cci-seosan': { visit: { 2024: { at: 1, size: 3, name: 'v.hwpx' } } },
    },
    data: { user_dir: [{ sid: 'P-009', name: '홍길동', status: 'active' }, { sid: 'P-010', name: '김가나', status: 'retired' }] },
  };
}
/* 모듈 입력 꼴로 */
function input(today) {
  const s = seed();
  return { cos: s.scal_cos, types: s.scal_types, scheds: s.scal_scheds, staff: s.scal_staff,
    reports: s.scal_reports, today: today || '2026-10-10' };
}
module.exports = { seed, input };
