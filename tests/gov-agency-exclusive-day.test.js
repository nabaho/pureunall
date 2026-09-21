/* 수행기관 자체가 하루에 한 사업장만 — 담당자가 달라도 막는다 (대표 지시 2026-09-21
 * 「능률협회는 1일 하나의 사업장만 컨설팅 가능하다」)
 *
 * 왜 필요한가 — 기존 「하루 1건」(checkConflictMatrix)은 2026-07-14에 일부러
 * «같은 주담당»일 때만 겹치는 것으로 좁혀졌다(전역 단독실시가 과잉 차단하던
 * 것을 고친 결정). 그런데 능률협회 같은 곳은 «내부 담당자가 누구든» 그 기관이
 * 하루에 한 곳만 컨설팅할 수 있다는 «외부 기관 용량» 제약이다 — 담당자 기준으로는
 * 못 잡는다. 그래서 새 칸(agencyExclusiveDay)을 따로 두고, 담당자를 안 따지는
 * checkAgencyExclusive / agencyOtherSiteOn 을 추가했다.
 *
 * 못 박는 것은 «지금 값»이 아니라 규칙이다 (CLAUDE.md) — 진짜 함수를 돌려서 본다.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const test = require('node:test');
const assert = require('node:assert');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'gov-consulting.html'), 'utf8');

function grab(n) {
  const i = SRC.search(new RegExp('(?:async\\s+)?function ' + n + '\\('));
  assert.ok(i >= 0, n + ' 을(를) 못 찾았다');
  let d = 0, st = false;
  for (let j = i; j < SRC.length; j++) {
    if (SRC[j] === '{') { d++; st = true; }
    else if (SRC[j] === '}') { d--; if (st && !d) return SRC.slice(i, j + 1); }
  }
}

const TYPES = [
  { id: 't1', name: '구조혁신', fullName: '산업일자리전환컨설팅(구조혁신)', agency: '능률협회', agencyExclusiveDay: true },
  { id: 't2', name: '일터혁신', fullName: '일터혁신 컨설팅', agency: 'FM협회', agencyExclusiveDay: false },
];
const COS = [
  { id: 'c1', name: '승진택라인' },
  { id: 'c2', name: '태양농산' },
];

function world(scheds) {
  const state = { scheds: scheds.slice() };
  const ctx = {
    console, Math, Number, String, Array, Object, Set, Date, RegExp,
    getScheds: () => state.scheds,
    getTypes: () => TYPES,
    getCos: () => COS,
  };
  vm.createContext(ctx);
  vm.runInContext([grab('checkAgencyExclusive'), grab('agencyOtherSiteOn')].join('\n'), ctx);
  return ctx;
}

test('★ 기관 하루1건 유형 — 다른 사업장이 같은 날 같은 유형을 쓰면 담당자와 무관하게 막는다', () => {
  const ctx = world([{ id: 's1', coId: 'c2', typeId: 't1', date: '2026-08-15', attId: 'aX' }]);
  const msg = ctx.checkAgencyExclusive('c1', 't1', '2026-08-15');
  assert.ok(msg, '막아야 하는데 통과됐다');
  assert.match(msg, /능률협회/, '어느 기관 때문인지 메시지에 없다');
  assert.match(msg, /태양농산/, '이미 쓴 사업장 이름이 메시지에 없다');
});

test('★ 같은 사업장(coId 같음)이면 막지 않는다 — 자기 자신과는 안 겹친다', () => {
  const ctx = world([{ id: 's1', coId: 'c1', typeId: 't1', date: '2026-08-15', attId: 'aX' }]);
  assert.strictEqual(ctx.checkAgencyExclusive('c1', 't1', '2026-08-15'), null);
});

test('기관 하루1건이 «꺼진» 유형(t2)은 다른 사업장이 써도 막지 않는다', () => {
  const ctx = world([{ id: 's1', coId: 'c2', typeId: 't2', date: '2026-08-15', attId: 'aX' }]);
  assert.strictEqual(ctx.checkAgencyExclusive('c1', 't2', '2026-08-15'), null);
});

test('excludeId 로 자기 자신 수정 중인 일정은 걸리지 않는다', () => {
  const ctx = world([{ id: 's1', coId: 'c1', typeId: 't1', date: '2026-08-15', attId: 'aX' }]);
  assert.strictEqual(ctx.checkAgencyExclusive('c1', 't1', '2026-08-15', 's1'), null);
});

test('agencyOtherSiteOn — 달력 칸 표시용, 이미 쓴 «다른 사업장 이름」을 낸다', () => {
  const ctx = world([{ id: 's1', coId: 'c2', typeId: 't1', date: '2026-08-15', attId: 'aX' }]);
  assert.strictEqual(ctx.agencyOtherSiteOn('c1', 't1', '2026-08-15'), '태양농산');
});

test('agencyOtherSiteOn — 기관 하루1건이 꺼진 유형은 비운다', () => {
  const ctx = world([{ id: 's1', coId: 'c2', typeId: 't2', date: '2026-08-15', attId: 'aX' }]);
  assert.strictEqual(ctx.agencyOtherSiteOn('c1', 't2', '2026-08-15'), '');
});
