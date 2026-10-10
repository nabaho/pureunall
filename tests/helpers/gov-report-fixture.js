'use strict';
/* 컨설팅보고서 앱 검사용 합성 자료 (2026-10-10) — 공개 저장소다, 실제 업체·사람 이름을 넣지 않는다.
 * 오늘 = 2026-10-10
 *   c1 가나상사 · t1 기술보호 2026 — 3회 끝, 종료 표시 2026-09-01, 저장본 초안(9/20 고침, AI 칸 있음) → 초안 20일
 *   c1 가나상사 · t2 일터혁신 2026 — 대형이라 줄이 없다
 *   c2 다라정밀 · t3 충남북부 인사노무 2026 — 3회 중 2회 → 작성 전 (부담당 a1)
 *   c3 마바산업 · t4 상공회의소 인사노무 2026 — 3/3 회 끝(종료 표시 없음), 양식 고르기(ask) → 미작성 151일
 *   c4 지운업체 · t1 — 지운 업체라 줄이 없다
 *   c5 사아테크 · t1 기술보호 2025 — 검토완료 v2
 * 서류 관리(2026-10-10, 설계 2026-10-10-gov-report-docs-design.md) — 사업 이름·기관은 공개 사업명, 업체는 합성
 *   이알피 사업: 01 현장클리닉(→t9, 정부사업일정에 없는 번호) · 02 일터상생혁신컨설팅(→t2) · 03 통합기술보호지원단(→t1)
 *     · 04 인사노무컨설팅충남북부상의(→t3) · 05 인사노무컨설팅서산(→t4) · 06·07 산업일자리 · 09 농촌융복합 · 10 기초컨설팅푸른법인(sortOrder 없음)
 *     · 08 일터혁신상생컨설팅(hidden, 02 로 합침) · 11 혁신바우처컨설팅(mergedInto 만) — 둘은 목록에 안 나온다
 *   이알피 계약: k1 (주)가나상사 03 (2026-05-01~09-30, 담당 P-009) · k2 다라정밀 04 (담당 P-404 = 명부에 없음) — 마바산업은 계약 없음 */
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
    data: {
      user_dir: [{ sid: 'P-009', name: '홍길동', status: 'active' }, { sid: 'P-010', name: '김가나', status: 'retired' }],
      biz_cons_types: { u: 1, v: [
        { code: 'consulting-01', name: '현장클리닉', short: '클리닉', agency: '비즈니스지원단(중기청)', sortOrder: 1 },
        { code: 'consulting-02', name: '일터상생혁신컨설팅', short: '일터', agency: '', sortOrder: 2 },
        { code: 'consulting-03', name: '통합기술보호지원단', short: '기술보호', agency: '비즈니스지원단(중기청)', sortOrder: 3 },
        { code: 'consulting-04', name: '인사노무컨설팅충남북부상의', short: '충남북부', agency: '충남북부상공회의소', sortOrder: 4 },
        { code: 'consulting-05', name: '인사노무컨설팅서산', short: '서산', agency: '서산상공회의소', sortOrder: 5 },
        { code: 'consulting-06', name: '산업일자리전환컨설팅충남', short: '산일충남', agency: '충남경제진흥원', sortOrder: 6 },
        { code: 'consulting-07', name: '산업일자리전환컨설팅능률', short: '산일능률', agency: '한국능률협회', sortOrder: 7 },
        { code: 'consulting-08', name: '일터혁신상생컨설팅', short: '', agency: '', sortOrder: 8, hidden: true, mergedInto: 'consulting-02' },
        { code: 'consulting-09', name: '농촌융복합6차산업현장코칭', short: '6차', agency: '', sortOrder: 9 },
        { code: 'consulting-10', name: '기초컨설팅푸른법인', short: '기초', agency: '' },
        { code: 'consulting-11', name: '혁신바우처컨설팅', short: '바우처', agency: '', sortOrder: 11, mergedInto: 'consulting-10' },
      ] },
      consultings: { u: 1, v: {
        k1: { id: 'k1', companyName: '(주)가나상사', bizNo: '000-00-00001', typeCodes: { consulting: 'consulting-03' },
          programName: '통합기술보호지원단', startDate: '2026-05-01', endDate: '2026-09-30', status: 'active', managerMain: 'P-009',
          amount: 9900000, contacts: [{ name: '연락담당', phone: '010-0000-0000', isPrimary: true }] },
        k2: { id: 'k2', companyName: '다라정밀', typeCodes: { consulting: 'consulting-04' },
          startDate: '2026-08-01', endDate: '2026-12-31', status: 'active', managerMain: 'P-404' },
      } },
    },
    scal_erpTypeMap: { 'consulting-01': 't9', 'consulting-02': 't2', 'consulting-03': 't1', 'consulting-04': 't3', 'consulting-05': 't4' },
  };
}
/* 모듈 입력 꼴로 */
function input(today) {
  const s = seed();
  return { cos: s.scal_cos, types: s.scal_types, scheds: s.scal_scheds, staff: s.scal_staff,
    reports: s.scal_reports, today: today || '2026-10-10' };
}
/* 서류 관리 모듈 입력 꼴로 */
function docs() {
  const s = seed();
  return { biz: s.data.biz_cons_types, cons: s.data.consultings, tmap: s.scal_erpTypeMap, dir: s.data.user_dir };
}
module.exports = { seed, input, docs };
