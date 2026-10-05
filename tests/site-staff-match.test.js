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
  /* 부담당이 있는 곳은 두 사람 묶음에 다 들어간다(2026-10-05) — 그래서 줄 수가 아니라
     «서로 다른 사업장 수»를 센다. */
  const all = new Set(g.flatMap(x => x.rows.map(r => r.site))).size;
  assert.equal(all, 3);                 // 셋 다 어딘가에는 있다
});

/* ══════ 이름표 — 번호가 열쇠다 (대표 지시 2026-10-05 「이름표 맞추기는 내가」) ══════ */
const COS_ID = COS.map((c, i) => Object.assign({ id: 'co_' + (i + 1) }, c));
const ID_OF = n => COS_ID.find(c => c.name === n).id;

test('★ 이름표의 번호가 이름보다 먼저다 — 업체관리에서 이름을 고쳐도 이어진다', () => {
  const renamed = COS_ID.map(c => c.name === '두레' ? Object.assign({}, c, { name: '두레 본점' }) : c);
  const links = { '두레': { coId: ID_OF('두레'), coName: '두레' } };
  const r = S.staffFor('두레', { companies: renamed, dir: DIR, links });
  assert.equal(r.업체, '두레 본점');
  assert.equal(r.coId, ID_OF('두레'));
  assert.equal(r.확정, true);
});

test('★ 짐작이 남의 회사를 고르면 이름표로 바로잡힌다 — 「정확」이 아니라고 알려 준다', () => {
  /* 급여 명단에 같은 알맹이 이름이 없으면 «품고 있는» 다른 회사를 고른다 — 실제로 겪은 꼴 */
  const onlyLong = COS_ID.filter(c => c.name !== '두레');
  const g = S.staffFor('두레', { companies: onlyLong, dir: DIR, links: {} });
  assert.equal(g.업체, '두레가축약품');
  assert.equal(g.정확, false, '이름이 다른데 「정확」이라 하면 한꺼번에 확정에 섞인다');
  const fixed = S.staffFor('두레', { companies: COS_ID, dir: DIR,
    links: { '두레': { coId: ID_OF('두레'), coName: '두레' } } });
  assert.equal(fixed.업체, '두레');
});

test('꼬리표만 다른 짐작은 「정확」이다 — 한꺼번에 확정해도 되는 것', () => {
  const r = S.staffFor('나라앤드씨_급여자료10일', { companies: COS_ID, dir: DIR, links: {} });
  assert.equal(r.업체, '㈜나라앤드씨');
  assert.equal(r.정확, true);
});

test('「업체 아님」으로 정리한 이름은 따로 모이고, 담당 묶음에 섞이지 않는다', () => {
  const links = { '이전 파일': { none: true } };
  const r = S.staffFor('이전 파일', { companies: COS_ID, dir: DIR, links });
  assert.equal(r.업체아님, true);
  const g = S.groupByStaff(['이전 파일', '두레'], { companies: COS_ID, dir: DIR, links });
  assert.equal(g[g.length - 1].담당, '업체 아님');
  assert.equal(g.filter(x => !x.업체아님).some(x => x.rows.some(r => r.site === '이전 파일')), false);
});

test('★ 부담당도 자기 묶음에서 그 회사를 본다 — 급여데이터함과 같은 규칙', () => {
  const g = S.groupByStaff(['나라앤드씨'], { companies: COS_ID, dir: DIR, links: {} });
  const names = g.map(x => x.담당);
  assert.deepEqual(names, ['최기운', '주민정']);          // 사번 순(A-001 → A-004)
  assert.equal(g[0].rows[0].역할, '부');
  assert.equal(g[1].rows[0].역할, '주');
});

/* ══════ 도착 알림 붙이기 ══════ */

test('★ 번호가 같으면 이름 글자가 달라도 도착이다', () => {
  const links = { '다온원 아산': { coId: 'co_1', coName: '다온원' } };
  const rec = { 사업장: '농업회사법인 주식회사 다온원', companyId: 'co_1', 월: '2026-10' };
  assert.equal(S.arrivalMatches(rec, '다온원 아산', links), true);
});

test('★ 번호가 다르면 이름이 같아도 도착이 아니다 — 같은 이름의 지점이 있다', () => {
  const links = { '다온원': { coId: 'co_1', coName: '다온원' } };
  const rec = { 사업장: '다온원', companyId: 'co_2', 월: '2026-10' };
  assert.equal(S.arrivalMatches(rec, '다온원', links), false);
});

test('번호가 없는 옛 알림은 이름표의 업체 이름으로도 붙는다', () => {
  const links = { '나라앤드씨_급여자료10일': { coId: 'co_6', coName: '㈜나라앤드씨' } };
  assert.equal(S.arrivalMatches({ 사업장: '㈜나라앤드씨' }, '나라앤드씨_급여자료10일', links), true);
  assert.equal(S.arrivalMatches({ 사업장: '두레' }, '나라앤드씨_급여자료10일', links), false);
});

test('「업체 아님」 이름에는 아무 알림도 붙지 않는다', () => {
  assert.equal(S.arrivalMatches({ 사업장: '이전 파일' }, '이전 파일', { '이전 파일': { none: true } }), false);
});

test('고르기 후보는 지금 급여를 하는 곳이 먼저다', () => {
  const c = S.candidates('두레', COS_ID);
  assert.equal(c[0].name, '두레');
  assert.ok(c.some(x => x.name === '두레가축약품'));
  const all = S.candidates('', COS_ID);
  assert.ok(all.every(x => S.isPayrollCo(x)), '빈 검색은 급여 업체만 보여 줍니다');
});

test('사번을 이메일로 바꾸는 규칙이 이알피와 같다', () => {
  assert.equal(S.sidToEmail('A-004'), 'a004@pureun.kr');
  assert.equal(S.sidToEmail('P-001'), 'p001@pureun.kr');
});

test('★ 업체 명단이 «번호 → 업체» 객체로 와도 읽는다 — 2026-10 실데이터의 꼴', () => {
  /* 9월엔 배열이었다. 배열만 믿고 .filter 를 부르면 회사 화면이 통째로 죽는다. */
  const box = { v: { co_a: { id: 'co_a', name: '다온원', typeCode: '급여', status: 'active', managerMain: 'A-004' },
                     co_b: { name: '두레', typeCode: '급여', status: 'active', managerMain: 'A-003' } } };
  assert.equal(S.payrollCos(box).length, 2);
  assert.equal(S.staffFor('다온원', { companies: box, dir: DIR, links: {} }).coId, 'co_a');
  assert.equal(S.staffFor('두레', { companies: box, dir: DIR, links: {} }).coId, 'co_b', '칸에 id 가 없으면 열쇠가 번호다');
  assert.equal(S.candidates('두레', box)[0].id, 'co_b');
});
