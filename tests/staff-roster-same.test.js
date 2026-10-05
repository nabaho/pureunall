'use strict';
/* 급여관리와 급여데이터함의 담당자 명단이 «같은 답»을 내나 (대표 지시 2026-10-05)
 *
 * ■ 왜 이 검사가 있나
 *   대표: 「형태나 유형 등을 일치시켜서 연결성이 강하게」.
 *   두 앱이 담당자를 따로 셌다 — 데이터함은 주담당+부담당, 급여관리는 주담당만.
 *   그래서 같은 사람이 두 앱에서 다른 숫자를 봤다.
 *   규칙을 한 파일로 옮기면 데이터함(5천 줄, 여러 방이 동시에 손댐)을 크게 흔들어야
 *   한다. 대신 **두 함수를 같은 자료에 실제로 돌려** 답이 같은지 본다 —
 *   어느 한쪽 규칙이 바뀌면 여기서 바로 깨진다.
 *
 * ■ 견주는 것
 *   ① 담당자 차례(사번 순, 사번 아닌 값은 맨 뒤)
 *   ② 사람마다 맡은 회사 목록(주·부 모두)
 *   ③ 담당이 아무도 없는 회사
 *
 * 실행: node --test tests/staff-roster-same.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Staff = require('../js/pu-site-staff.js');

function loadPaydataStore() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'pu-paydata-store.js'), 'utf8');
  const sandbox = { window: {}, console };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  new vm.Script(src, { filename: 'pu-paydata-store.js' }).runInContext(sandbox);
  return sandbox.window.PuPaydataStore;
}

/* 가짜 업체 — 실제로 겪은 꼴을 고루 담는다:
   부담당 있는 곳 · 주·부에 같은 사람이 두 번 적힌 곳 · 사번 순서가 글자순과 다른 곳(A-9 < A-10) ·
   사번 아닌 글자가 담당 칸에 든 곳 · 담당이 아무도 없는 곳 */
const COS = [
  { id: 'c1', name: '다온원', typeCode: '급여', status: 'active', managerMain: 'A-004' },
  { id: 'c2', name: '새별반찬', typeCode: '급여', status: 'active', managerMain: 'A-005', managerSubs: ['A-003'] },
  { id: 'c3', name: '두레', typeCode: '급여', status: 'active', managerMain: 'A-003', managerSubs: ['A-003'] },
  { id: 'c4', name: '나라앤드씨', typeCode: '급여', status: 'active', managerMain: 'A-10', managerSubs: ['A-9'] },
  { id: 'c5', name: '가온기술', typeCode: '급여', status: 'active', managerMain: '김담당(박담당)' },
  { id: 'c6', name: '나루육가공', typeCode: '급여', status: 'active' },
  { id: 'c7', name: '한빛상사', typeCode: '급여', status: 'active', managerMain: 'A-001', managerSubs: ['A-004', 'A-005'] },
];
const DIR = { v: [
  { sid: 'A-001', name: '가사람' }, { sid: 'A-003', name: '나사람' }, { sid: 'A-004', name: '다사람' },
  { sid: 'A-005', name: '라사람' }, { sid: 'A-9', name: '마사람' }, { sid: 'A-10', name: '바사람' },
] };
/* 급여관리 쪽 이름은 폴더 이름이라 업체 이름과 다르다 — 이름표로 번호를 잇는다 */
const SITES = COS.map(c => c.name + '_급여자료');
const LINKS = {};
COS.forEach(c => { LINKS[c.name + '_급여자료'] = { coId: c.id, coName: c.name }; });

test('★★ 두 앱의 담당자 명단이 «차례까지» 같다', () => {
  const P = loadPaydataStore();
  const pay = P.managerRoster(COS, DIR, {});
  const mine = Staff.groupByStaff(SITES, { companies: COS, dir: DIR, links: LINKS }).filter(g => g.sid);
  assert.deepEqual(Array.from(mine, g => g.sid), Array.from(pay.people, p => p.sid),
    '담당자 차례가 다릅니다 — 한쪽 규칙(사번 순·사번 아닌 값 맨 뒤)이 바뀌었습니다');
});

test('★★ 사람마다 맡은 회사가 같다 — 부담당까지', () => {
  const P = loadPaydataStore();
  const pay = P.managerRoster(COS, DIR, {});
  const mine = Staff.groupByStaff(SITES, { companies: COS, dir: DIR, links: LINKS }).filter(g => g.sid);
  pay.people.forEach(p => {
    const g = mine.find(x => x.sid === p.sid);
    assert.ok(g, p.sid + ' 이(가) 급여관리 명단에 없습니다');
    assert.deepEqual(Array.from(g.rows, r => r.staff.coId).sort(), Array.from(p.companies, c => c.id).sort(),
      p.sid + ' 의 회사 목록이 두 앱에서 다릅니다');
  });
});

test('담당이 아무도 없는 회사도 두 앱이 똑같이 가려낸다', () => {
  const P = loadPaydataStore();
  const pay = P.managerRoster(COS, DIR, {});
  const none = Staff.groupByStaff(SITES, { companies: COS, dir: DIR, links: LINKS }).find(g => g.미확인);
  assert.deepEqual((none ? Array.from(none.rows, r => r.staff.coId) : []).sort(), Array.from(pay.unassigned, c => c.id).sort());
});

test('사번을 이메일로 바꾸는 규칙도 같다', () => {
  const P = loadPaydataStore();
  ['A-001', 'A-10', 'P-001'].forEach(sid => assert.equal(Staff.sidToEmail(sid), P.sidToEmail(sid)));
});
