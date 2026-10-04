'use strict';
/* 「배경 그만두고 걸러내는 것」 (대표 지시 2026-10-04)
   ── 무엇이 있었나: 이알피 목록의 «상태» 칸을 「종료」로 바꾸면 status 만 closed 가 되고
      closedDate·closedAt 은 «빈 채»다(「종료」 단추를 눌렀을 때만 closedAt 이 적힌다).
      가져오기 로직은 날짜 칸만 보고 거르던 터라 배경건설(현클-2026-004, 상태만 종료)이
      «새 사업장 추가»로 떴다. 끝난 일을 진행중 사업장으로 넣으면 회차가 계속 밀려 나온다.
   ── 고침: 「끝났나」를 erpIsClosed 하나로 모으고, 거르는 세 곳(가져오기 계획·연결표 건수·사업장 짝짓기)과
      일정관리 자동 종료(erpClosedOn)가 같은 잣대를 쓴다.

   못 박는 것(규칙) — «실제 함수를 돌려» 본다:
   ① 상태만 종료 · 날짜만 종료 · 둘 다 — 어느 모양이든 끝난 것으로 본다
   ② 가져오기 계획·사업장 짝짓기·연결표 건수에서 끝난 건이 빠지고, 안 끝난 건은 그대로 남는다
   ③ «가져오라는 건이 자동 종료 대상»이 되는 어긋남이 없다(둘의 잣대가 같다) */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

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
function grabLine(re) { const m = SRC.match(re); assert.ok(m, re + ' 줄을 못 찾았다'); return m[0].replace(/^const /, 'var '); }

const TODAY = '2026-10-04';
function 세상(consultings) {
  const ctx = {
    console, String, Array, Object, Number, Boolean, Math, RegExp, Date, JSON,
    localStorage: { getItem: () => null },
    ERP: { types: [{ code: 'TY1', name: '현장클리닉', short: '현클' }], consultings, dir: [], loaded: true, err: '' },
    _TMAP: { TY1: 't1' }, _TRUN: {},
    _COS: ['가나상사', '다라상사', '마바상사', '사아상사', '자차상사'].map((n, i) => ({ id: 'c' + i, name: n, types: ['t1'], defAtt: 'a1' })),
    _STAFF: [{ id: 'a1', name: '홍길동' }],
    todayStr: () => TODAY,
    getErpTypeMap: () => ctx._TMAP, getErpTypeRun: () => ctx._TRUN,
    erpTypeRuns: (c) => ctx._TRUN[c] !== false,
    getCos: () => ctx._COS, getStaff: () => ctx._STAFF,
    erpTypeLabel: (c) => c,
  };
  vm.createContext(ctx);
  vm.runInContext([
    grabLine(/const _en=[^\n]*/), grabLine(/const CO_CORP_RE=[^\n]*/),
    grab('erpConsCode'), grab('erpConsRawType'), grab('coKey'), grab('coKeyLoose'), grab('findCoForErp'),
    grab('erpSidName'), grab('govStaffIdByErp'), grab('govStaffIdByName'),
    grab('erpIsClosed'), grab('erpClosedOn'), grab('erpBuildPlan'), grab('erpConsByCo'), grab('erpMappableTypes'),
  ].join('\n'), ctx);
  return ctx;
}
/* 이알피 한 건 — 진행중이 기본 */
const E = (id, name, o) => Object.assign({ id, companyName: name, typeCode: 'TY1', managerMain: 'P-1', status: 'pending' }, o);
const 건들 = () => [
  E('e0', '가나상사'),                                                              // 안 끝남
  E('e1', '다라상사', { status: 'closed' }),                                        // ★ 상태만 종료(배경건설 모양)
  E('e2', '마바상사', { closedAt: '2026-09-01T00:00:00.000Z' }),                    // 날짜(closedAt)만
  E('e3', '사아상사', { closedDate: '2026-09-01' }),                                // 날짜(closedDate)만
  E('e4', '자차상사', { status: 'closed', closedAt: '2026-09-01T00:00:00.000Z' }),  // 「종료」 단추(둘 다)
];

test('① ★★ 끝났나 — 상태만·날짜만·둘 다 어느 모양이든 끝난 것', () => {
  const w = 세상([]);
  assert.equal(w.erpIsClosed(E('x', 'a')), false, '진행중 건이 끝난 것으로 읽힙니다');
  assert.equal(w.erpIsClosed(E('x', 'a', { status: 'closed' })), true, '★★ 상태만 종료인 건을 끝난 것으로 안 봅니다 — 배경건설이 새 사업장으로 뜹니다');
  assert.equal(w.erpIsClosed(E('x', 'a', { closedAt: '2026-09-01' })), true);
  assert.equal(w.erpIsClosed(E('x', 'a', { closedDate: '2026-09-01' })), true);
  assert.equal(w.erpIsClosed(null), false);
  assert.equal(w.erpIsClosed(undefined), false);
});

test('② ★★ 가져오기 계획 — 끝난 건은 빠지고 진행중 건만 남는다', () => {
  const plan = 세상(건들()).erpBuildPlan();
  assert.deepEqual(Array.from(plan, (r) => r.name), ['가나상사'],
    '★★ 끝난 건이 가져오기 목록에 뜹니다(상태만 종료·날짜만 종료 가운데 하나가 샌 것)');
});

test('③ ★★ 사업장 짝짓기 — 끝난 건은 사업장에 붙지 않는다', () => {
  const map = 세상(건들()).erpConsByCo();
  assert.deepEqual(Object.keys(map), ['c0'], '끝난 건이 일정관리 사업장에 짝지어집니다');
});

test('④ ★★ 연결표 건수 — 끝난 건은 세지 않는다', () => {
  const t = Array.from(세상(건들()).erpMappableTypes()).find((x) => x.code === 'TY1');
  assert.equal(t.cnt, 1, '★ 연결표가 끝난 건까지 센다(5건 중 진행중은 1건)');
});

test('⑤ ★★ 가져오라는 건이 자동 종료 대상이 되는 어긋남이 없다 — 두 잣대가 같다', () => {
  const w = 세상([]);
  [undefined, 'pending', 'closed'].forEach((status) => [undefined, '', '2026-09-01'].forEach((closedDate) =>
    [undefined, '', '2026-09-01T00:00:00.000Z'].forEach((closedAt) => {
      const c = E('x', 'a', { status, closedDate, closedAt });
      assert.equal(!!w.erpClosedOn(c), w.erpIsClosed(c),
        '★ 자동 종료와 거르기의 잣대가 다릅니다 ' + JSON.stringify({ status, closedDate, closedAt }));
    })));
});
