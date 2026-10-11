'use strict';
/* 휴가관리 «이번 연차 기간» (2026-10-11 대표 「휴가관리 시안대로 진행」)
   입사일 기준인데 표가 달력 연도로 잘라 세어, 작년 11월에 생긴 15일을 올해 쓰면 «부여 0 · 사용 5 · 잔여 −5» 로 보였다.
   ★ 일수는 근로기준법 제60조 그 자체라 박는다(검사고정-허용).
   실행: node --test tests/hr-leave-cycle.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');
function fnSrc(name){
  const i = SRC.indexOf('\nfunction ' + name + '(');
  assert.ok(i >= 0, name + ' 함수를 못 찾았습니다');
  const j = SRC.indexOf('\nfunction ', i + 10);
  return SRC.slice(i + 1, j < 0 ? undefined : j);
}
function env(){
  const ctx = { Math, Number, String, parseInt, isNaN, Date, Object, dbGet: (k, d) => d, todayYMD: () => '2026-10-11', localYMD: () => '2026-10-11',
    PuWork: { leaveUsed: rs => rs.reduce((t, r) => t + (r.type === 'leave' ? 1 : /^halfday/.test(r.type) ? 0.5 : 0), 0) } };
  vm.createContext(ctx);
  vm.runInContext('var PUREUN_5IN_DATE = "2021-06-01";\n' +
    ['getLeaveStartDate', '_lvYmd', '_lvParse', '_lvAddMonths', '_lvDayBefore', '_lvGrantsFrom', 'erpLeaveGrants', 'erpLeaveCycleNow'].map(fnSrc).join('\n') +
    '\nthis.C = erpLeaveCycleNow;', ctx);
  return ctx;
}
const leave = (sid, dates) => dates.map(d => ({ sid, date: d, type: 'leave' }));

test('★ 작년 11월에 생긴 15일을 올해 5일 쓰면 «생긴 15 · 쓴 5 · 남은 10» — −5 가 아니다', () => {
  const c = env().C({ sid: 'X', hireDate: '2023-11-20' }, '2026-10-11', leave('X', ['2026-01-08', '2026-02-13', '2026-06-24', '2026-06-25', '2026-06-26']), {});
  assert.equal(c.start, '2025-11-20'); assert.equal(c.end, '2026-11-19');
  assert.equal(c.granted, 15); assert.equal(c.used, 5); assert.equal(c.remain, 10);
  assert.equal(JSON.stringify(c.next), JSON.stringify({ date: '2026-11-20', days: 16 }), '3년 근속 = 15 + 가산 1');
});

test('기간 밖(지난 연차 기간)에 쓴 것은 세지 않는다', () => {
  const c = env().C({ sid: 'X', hireDate: '2023-11-20' }, '2026-10-11', leave('X', ['2025-11-19', '2025-11-20']), {});
  assert.equal(c.used, 1);
});

test('입사 1년 미만 — 매달 1일씩, 기간은 입사일부터, 다음은 다음 달', () => {
  const c = env().C({ sid: 'Y', hireDate: '2026-03-16' }, '2026-10-11', [], {});
  assert.equal(c.firstYear, true); assert.equal(c.start, '2026-03-16'); assert.equal(c.granted, 6);
  assert.equal(c.next.date, '2026-10-16'); assert.equal(c.next.days, 1);
});

test('2021-06-01 전 입사자 — 전환 보정분까지 이번 기간에 들어간다 (17 + 1)', () => {
  const c = env().C({ sid: 'Z', hireDate: '2019-07-18' }, '2026-10-11', [], {});
  assert.equal(c.granted, 18);
});

test('손으로 고친 부여일수는 그 해 값 + 이월로 본다 · 퇴직자는 다음 연차가 없다', () => {
  const E = env();
  assert.equal(E.C({ sid: 'X', hireDate: '2023-11-20' }, '2026-10-11', [], { X: { '2025': { total: 16, carryOver: 2 } } }).granted, 18);
  const r = E.C({ sid: 'X', hireDate: '2023-11-20', status: 'retired', lastWorkDate: '2026-08-31' }, '2026-10-11', [], {});
  assert.equal(r.next, null); assert.equal(r.end, '2026-11-19');
});

test('휴가관리 표가 «지금 기준/연도별» 로 갈리고, 촉진은 한 칸 · 이름 칸은 한 줄', () => {
  assert.match(SRC, /usePersistedState\('leave_view', 'now'\)/);
  assert.match(SRC, /\['이번 연차 기간','left'\]/);
  assert.doesNotMatch(SRC, /'\\uD83D\\uDCE2 \\uC0AC\\uC6A9\\uCD09\\uC9C4\\uC2DC\\uD589'/, '촉진 두 칸 머리줄이 남았습니다');
  assert.doesNotMatch(SRC, /h\('div',\{style:\{fontSize:'10\.5px',color:'#94a3b8',fontWeight:400\}\},u\.title\)/, '직책이 이름 아래 둘째 줄로 남았습니다');
});
