/* 급여 사업장 ↔ 업체관리 잇기 (js/pu-site-staff.js)
 *
 * ■ 왜 이 검사가 있나
 *   대표 지시(2026-09-13) "담당자별로 정리하고, 기업별로 근태·휴가·퇴직·명세서를
 *   하나의 플로어로." 담당 배정을 급여관리 안에 또 만들면 업체관리와 어긋나므로
 *   **업체관리(data/companies)의 주담당이 원본**이고, 급여관리는 이름으로 붙여 읽는다.
 *
 * ■ 붙이기는 «짐작»이다 — 실측(2026-09-13, 급여 업체 113곳 / 급여관리 46곳)
 *   자동으로 붙은 곳 33, 못 붙은 곳 13. 못 붙는 까닭이 다섯 갈래였고,
 *   그중 넷은 **업체관리를 고쳐야** 풀린다. 그래서 이 검사는 값이 아니라 규칙을 못 박는다:
 *     ① 사람이 확정한 짝이 짐작을 이긴다
 *     ② 못 찾으면 «왜 못 찾았는지»를 말해 준다 (조용히 빈칸으로 두지 않는다)
 *     ③ 그대로 같은 이름이 있으면 그것이 먼저다 (천성 ≠ 두레가축약품)
 *     ④ 담당을 못 찾은 사업장은 목록에서 사라지지 않는다
 *
 * 실행: node --test tests/site-staff-match.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../js/pu-site-staff.js');

/* 업체관리 실제 모양을 줄여 옮긴 것 (사번은 실제 배정과 같다) */
const COS = [
  { name: '다온원', typeCode: '급여', status: 'active', managerMain: 'A-004' },
  { name: '주식회사 다온원(천안점)', typeCode: '급여', status: 'active', managerMain: 'A-004' },
  { name: '새별반찬(배방점)', typeCode: '급여', status: 'active', managerMain: 'A-005' },
  { name: '두레', typeCode: '급여', status: 'active', managerMain: 'A-003' },
  { name: '두레가축약품', typeCode: '급여', status: 'active', managerMain: 'A-002' },
  { name: '㈜나라앤드씨', typeCode: '급여', status: 'active', managerMain: 'A-004', managerSubs: ['A-001'] },
  { name: '엽떡신방점', typeCode: '자문', status: 'closed', managerMain: 'A-005' },
  { name: '가온기술 주식회사', typeCode: '급여', status: 'closed', managerMain: 'A-005' },
  { name: '나루육가공 2공장', typeCode: '급여', status: 'active' },
];
const DIR = { v: [
  { sid: 'A-001', name: '최기운' }, { sid: 'A-002', name: '신욱임' },
  { sid: 'A-003', name: '김보람' }, { sid: 'A-004', name: '주민정' },
  { sid: 'A-005', name: '박은비' },
] };
const OPTS = { companies: COS, dir: DIR, links: {} };

test('이름 다듬기 — 낱말을 글자 묶음으로 지우지 않는다', () => {
  assert.equal(S.coreName('한식당'), '한식당');      // [주식회사] 였다면 「한당」
  assert.equal(S.coreName('대주건설'), '대주건설');
  assert.equal(S.coreName('㈜나라앤드씨'), '나라앤드씨');
  assert.equal(S.coreName('새별반찬(배방점)'), '새별반찬');
});

test('그대로 같은 이름이 먼저다 — 천성은 두레가축약품이 아니다', () => {
  const co = S.matchCompany('두레', S.payrollCos(COS));
  assert.equal(co.name, '두레');
  assert.equal(S.staffFor('두레', OPTS).담당, '김보람');
});

test('업체관리 주담당을 그대로 읽는다 — 폴더 이름이 아니라', () => {
  const r = S.staffFor('나라앤드씨', OPTS);
  assert.equal(r.업체, '㈜나라앤드씨');
  assert.equal(r.담당, '주민정');
  assert.deepEqual(r.부담당, ['최기운']);
  assert.equal(r.짐작, true);          // 사람이 확정하기 전이므로 짐작이라고 밝힌다
});

test('사람이 확정한 짝이 짐작을 이긴다', () => {
  /* 「다온원 천안점」은 「다온원」에도 걸릴 수 있다 — 말로는 못 가르는 자리라
     사람이 고른 것이 이겨야 한다. */
  const links = { '다온원 천안점': { coName: '주식회사 다온원(천안점)', by: 'p001@pureun.kr', at: 1 } };
  const r = S.staffFor('다온원 천안점', { companies: COS, dir: DIR, links: links });
  assert.equal(r.업체, '주식회사 다온원(천안점)');
  assert.equal(r.확정, true);
  assert.equal(r.짐작, false);
});

test('유형이 「자문」이면 담당은 알려 주되 왜 안 붙는지 말한다', () => {
  const r = S.staffFor('엽떡신방점', OPTS);
  assert.equal(r.업체, '엽떡신방점');
  assert.equal(r.담당, '박은비');
  assert.match(r.경고, /자문/);          // 업체관리를 고쳐야 하는 곳임을 화면이 말해 준다
});

test('계약 종료된 곳은 종료라고 말한다 — 조용히 빈칸으로 두지 않는다', () => {
  const r = S.staffFor('가온기술', OPTS);
  assert.equal(r.담당, '박은비');
  assert.match(r.경고, /종료/);
});

test('파일 꼬리표가 붙은 이름도 찾아 준다', () => {
  assert.equal(S.stripTag('가온기술_급여자료10일'), '가온기술');
  assert.equal(S.stripTag('현진글로벌 외 3곳'), '현진글로벌');
  assert.equal(S.staffFor('가온기술_급여자료10일', OPTS).담당, '박은비');
});

test('업체관리에 없는 이름은 «없다»고 답한다', () => {
  const r = S.staffFor('세창ENG', OPTS);
  assert.equal(r.업체, '');
  assert.equal(r.담당, '');
  assert.match(r.경고, /못 찾았습니다/);
});

test('주담당이 비어 있는 업체는 비었다고 말한다', () => {
  const r = S.staffFor('나루육가공 2공장', OPTS);
  assert.equal(r.업체, '나루육가공 2공장');
  assert.equal(r.담당, '');
  assert.match(r.경고, /주담당/);
});

test('담당을 못 찾은 사업장도 목록에서 사라지지 않는다', () => {
  const g = S.groupByStaff(['나라앤드씨', '두레', '세창ENG'], OPTS);
  const last = g[g.length - 1];
  assert.equal(last.담당, '담당 미확인');
  assert.equal(last.rows[0].site, '세창ENG');
  const all = g.reduce((n, x) => n + x.rows.length, 0);
  assert.equal(all, 3);                 // 셋 다 어딘가에는 있다
});

test('사번을 이메일로 바꾸는 규칙이 이알피와 같다', () => {
  assert.equal(S.sidToEmail('A-004'), 'a004@pureun.kr');
  assert.equal(S.sidToEmail('P-001'), 'p001@pureun.kr');
});
