'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('../js/pu-gov-report-build.js');

const base = () => ({
  co: { id: 'c1', name: '가나상사', defAtt: 's1', defCoAtts: [], erpId: 'k1' },
  type: { id: 'bxeyzrxm', name: '인사충남', fullName: '인사노무컨설팅충남북부상의', agency: '충남북부상공회의소' },
  scheds: [
    { id: 'a', date: '2025-10-02', round: 2, phase: '', isField: false, memo: '임금체계 검토', typeId: 'bxeyzrxm', coId: 'c1' },
    { id: 'b', date: '2025-09-04', round: 1, phase: '', isField: true, memo: '취업규칙 개정 요청', typeId: 'bxeyzrxm', coId: 'c1' },
    { id: 'p', date: '2025-08-20', round: 0, phase: 'pre', isField: true, memo: '사전진단', typeId: 'bxeyzrxm', coId: 'c1' },
  ],
  cons: { programName: '인사노무컨설팅충남북부상의', company: { name: '가나상사', bizNo: '123-45-67890', ceo: '김가나',
    address: '충남 천안시 가나로 1', bizType: '제조업', bizCategory: '금속', employmentInsuredCount: 9,
    contacts: [{ name: '홍길동', role: '총무팀/대리', phone: '041-000-0000', email: 'hong@example.com', isPrimary: true }] } },
  mail: [{ d: '2025-09-02', io: 'in', s: '취업규칙 검토 요청', w: '홍길동', att: ['취업규칙.hwp'] },
         { d: '2025-09-20', io: 'in', s: '9월 급여', w: '홍길동', att: ['급여대장_9월.xlsx'] }],
  sent: [{ d: '2025-10-02', name: '임금체계 검토 의견서.hwp' }],
  staffName: '이푸른', today: '2025-11-20', saved: null,
});

test('resolveFormKey — 사업 종류 이름·정식명·이알피 사업명으로 고른다, 애매하면 묻는다', () => {
  assert.equal(B.resolveFormKey({ name: '인사충남' }, '').formKey, 'cci-north');
  assert.equal(B.resolveFormKey({ name: '인사서산' }, '').formKey, 'cci-seosan');
  assert.equal(B.resolveFormKey({ name: '기술보호', fullName: '기술보호울타리' }, '').formKey, 'techguard');
  assert.equal(B.resolveFormKey({ name: '인사노무', agency: '상공회의소' }, '인사노무컨설팅서산').formKey, 'cci-seosan');
  const amb = B.resolveFormKey({ name: '인사노무', agency: '상공회의소' }, '');
  assert.equal(amb.formKey, null); assert.equal(amb.ask, true); assert.deepEqual(amb.choices, ['cci-north', 'cci-seosan']);
  assert.equal(B.resolveFormKey({ name: '일터혁신' }, '').formKey, null);       // 대형 — 2단계 대상 아님
});
test('buildReport — 기업정보는 이알피 계약에서, 근로자수는 비우고 경고(피보험자수 안 씀)', () => {
  const r = B.buildReport(base());
  assert.equal(r.formKey, 'cci-north');
  assert.equal(r.report.company.name, '가나상사');
  assert.equal(r.report.company.bizType, '제조업');
  assert.equal(r.report.company.contact, '홍길동');
  assert.equal(r.report.company.contactTitle, '총무팀/대리');
  assert.equal(r.report.company.workers, '');
  assert.equal(r.src['업체명'], '이알피 계약');
  assert.ok(r.warnings.some((w) => /근로자수/.test(w)));
});
test('buildReport — 회차는 사전진단 빼고 날짜순, 방문 여부·메모를 옮긴다', () => {
  const r = B.buildReport(base());
  assert.deepEqual(r.report.rounds.map((x) => x.date), ['2025-09-04', '2025-10-02']);
  assert.equal(r.report.rounds[0].visit, true);
  assert.equal(r.report.rounds[1].visit, false);
  assert.equal(r.report.rounds[0].advice, '취업규칙 개정 요청');
  assert.equal(r.report.consultant, '이푸른');
  assert.equal(r.report.writtenAt, '2025-11-20');
});
test('buildReport — 회차가 기관 기준보다 적으면 경고(충남북부 3회)', () => {
  assert.ok(B.buildReport(base()).warnings.some((w) => /3회/.test(w)));
});
test('buildReport — 출처 목록: 일정·받은 메일·보낸 서류가 날짜순, 개인 단위 첨부는 priv', () => {
  const f = B.buildReport(base()).feed;
  assert.deepEqual(f.map((x) => x.d + ' ' + x.kind),
    ['2025-09-02 받은 메일', '2025-09-04 일정', '2025-09-20 받은 메일', '2025-10-02 일정', '2025-10-02 보낸 서류']);
  assert.ok(f.find((x) => /급여/.test(x.text)).priv);
  assert.ok(!f.find((x) => /취업규칙 검토/.test(x.text)).priv);
  for (let i = 1; i < f.length; i++) assert.ok(f[i - 1].d <= f[i].d, '날짜순');
});
test('buildReport — 산출물은 보낸 서류로 채운다', () => {
  assert.deepEqual(B.buildReport(base()).report.summary.outputs, ['임금체계 검토 의견서']);
});
test('buildReport — 저장된 초안이 있으면 그 값이 이긴다(사람이 고친 것)', () => {
  const i = base(); i.saved = { report: { company: { workers: '12' }, summary: { etc: '없음' } } };
  const r = B.buildReport(i);
  assert.equal(r.report.company.workers, '12');
  assert.equal(r.report.summary.etc, '없음');
  assert.ok(!r.warnings.some((w) => /근로자수/.test(w)));
});
test('buildReport — 기술보호는 딱지를 단다', () => {
  const i = base(); i.type = { id: 't4', name: '기술보호', fullName: '기술보호울타리' };
  assert.equal(B.buildReport(i).techguard, true);
});
