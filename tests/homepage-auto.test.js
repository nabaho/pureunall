'use strict';
/* 홈페이지 월간 자동 연결 — «무엇을 내릴지» 고르는 규칙을 실제로 돌려 본다 (설계 2026-10-05).
   ★ 이름은 예시(홍길동·가나상사)만 쓴다. */
const test = require('node:test');
const assert = require('node:assert');
const HA = require('../functions/homepage-auto.js');

const 명부 = (줄) => ({ u: 1, v: 줄 });
const 사람 = (sid, status) => ({ sid, name: '홍길동', status });
const 업체 = (id, status) => ({ id, name: '가나상사', status });
const 기본 = (더) => Object.assign({
  roster: 명부([사람('S1', 'active')]),
  companies: [업체('C1', 'active')],
  members: {}, partners: {}
}, 더 || {});

test('퇴사(retired)·연결된 구성원 글은 내릴 것에 든다', () => {
  const r = HA.고르기(기본({ roster: 명부([사람('S1', 'retired')]),
    members: { m1: { name: '홍길동', srl: 101, sid: 'S1' } } }));
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.내릴것.length, 1);
  assert.strictEqual(r.내릴것[0].종류, '퇴사');
  assert.strictEqual(r.내릴것[0].srl, 101);
  assert.strictEqual(r.내릴것[0].게시판, HA.게시판.구성원);
});

test('재직(active)은 내리지 않는다', () => {
  const r = HA.고르기(기본({ members: { m1: { srl: 101, sid: 'S1' } } }));
  assert.strictEqual(r.내릴것.length, 0);
});

test('휴직(leave)은 내리지 않는다', () => {
  const r = HA.고르기(기본({ roster: 명부([사람('S1', 'leave')]),
    members: { m1: { srl: 101, sid: 'S1' } } }));
  assert.strictEqual(r.내릴것.length, 0);
});

test('sid 가 없으면 이름이 같아도 내리지 않고 연결 확인으로 보낸다', () => {
  const r = HA.고르기(기본({ roster: 명부([사람('S1', 'retired')]),
    members: { m1: { name: '홍길동', srl: 101 } } }));
  assert.strictEqual(r.내릴것.length, 0);
  assert.ok(r.연결확인.some(x => x.key === 'm1'));
});

test('명부에서 sid 를 못 찾으면 내리지 않는다', () => {
  const r = HA.고르기(기본({ members: { m1: { srl: 101, sid: 'S9' } } }));
  assert.strictEqual(r.내릴것.length, 0);
  assert.ok(r.연결확인.some(x => x.key === 'm1'));
});

test('«안 이어짐»과 «명부에서 못 찾음»은 다른 까닭으로 알린다 — 할 일이 다르다', () => {
  const 안이음 = HA.고르기(기본({ members: { m1: { srl: 101 } } })).연결확인[0];
  const 못찾음 = HA.고르기(기본({ members: { m1: { srl: 101, sid: 'S9' } } })).연결확인[0];
  assert.ok(안이음 && 못찾음 && 안이음.까닭 && 못찾음.까닭);
  assert.notStrictEqual(안이음.까닭, 못찾음.까닭);
});

test('「홈페이지에 남기기」(사유 있음)는 내리지 않는다', () => {
  const r = HA.고르기(기본({ roster: 명부([사람('S1', 'retired')]),
    members: { m1: { srl: 101, sid: 'S1', keepOnSite: { why: '지사장' } } } }));
  assert.strictEqual(r.내릴것.length, 0);
});

test('사유 없는 남기기는 남기기가 아니다', () => {
  const r = HA.고르기(기본({ roster: 명부([사람('S1', 'retired')]),
    members: { m1: { srl: 101, sid: 'S1', keepOnSite: {} } } }));
  assert.strictEqual(r.내릴것.length, 1);
});

test('글 번호가 겹치면 내리지 않는다', () => {
  const r = HA.고르기(기본({ roster: 명부([사람('S1', 'retired'), 사람('S2', 'active')]),
    members: { m1: { srl: 101, sid: 'S1' }, m2: { srl: 101, sid: 'S2' } } }));
  assert.strictEqual(r.내릴것.length, 0);
});

test('이미 내린 것(takenDown)은 다시 고르지 않는다', () => {
  const r = HA.고르기(기본({ roster: 명부([사람('S1', 'retired')]),
    members: { m1: { srl: 101, sid: 'S1', takenDown: { at: 1 } } } }));
  assert.strictEqual(r.내릴것.length, 0);
});

test('계약 종료(closed)·연결된 로고 글은 내릴 것에 든다', () => {
  const r = HA.고르기(기본({ companies: [업체('C1', 'closed')],
    partners: { C1: { posted: true, boardSrl: 185 } } }));
  assert.strictEqual(r.내릴것.length, 1);
  assert.strictEqual(r.내릴것[0].종류, '계약종료');
  assert.strictEqual(r.내릴것[0].게시판, HA.게시판.자문사);
  assert.strictEqual(r.내릴것[0].companyId, 'C1');
});

test('거래 중인 업체 로고는 내리지 않는다', () => {
  const r = HA.고르기(기본({ partners: { C1: { boardSrl: 185 } } }));
  assert.strictEqual(r.내릴것.length, 0);
});

test('로고 «남기기»(사유 있음)는 계약이 끝나도 내리지 않는다', () => {
  const r = HA.고르기(기본({ companies: [업체('C1', 'closed')],
    partners: { C1: { boardSrl: 185, keep: { why: '실적' } } } }));
  assert.strictEqual(r.내릴것.length, 0);
});

test('로고 글 번호가 겹치면 내리지 않는다', () => {
  const r = HA.고르기(기본({ companies: [업체('C1', 'closed'), 업체('C2', 'active')],
    partners: { C1: { boardSrl: 185 }, C2: { boardSrl: 185 } } }));
  assert.strictEqual(r.내릴것.length, 0);
});

test('업체관리에서 사라진 회사는 내리지 않고 연결 확인으로 보낸다', () => {
  const r = HA.고르기(기본({ partners: { C9: { boardSrl: 185 } } }));
  assert.strictEqual(r.내릴것.length, 0);
  assert.ok(r.연결확인.some(x => x.companyId === 'C9'));
});

function 퇴사여럿(n) {
  const roster = [], members = {};
  for (let i = 0; i < n; i++) { roster.push(사람('S' + i, 'retired')); members['m' + i] = { srl: 200 + i, sid: 'S' + i }; }
  return { roster: 명부(roster), members };
}

test('멈춤 문턱을 넘으면 보낼 것이 0건이다', () => {
  const n = HA.멈춤문턱 + 1;
  const r = HA.고르기(기본(퇴사여럿(n)));
  assert.strictEqual(r.내릴것.length, n);
  assert.strictEqual(r.보낼것.length, 0);
  assert.ok(r.멈춤);
});

test('문턱과 같으면 멈추지 않는다', () => {
  const n = HA.멈춤문턱;
  const r = HA.고르기(기본(퇴사여럿(n)));
  assert.strictEqual(r.보낼것.length, n);
  assert.strictEqual(r.멈춤, '');
});

test('멈춤 문턱은 너무 크지 않다 — 한 번에 홈페이지를 통째로 비울 수 없게', () => {
  assert.ok(Number.isInteger(HA.멈춤문턱) && HA.멈춤문턱 >= 1 && HA.멈춤문턱 <= 10);
});

test('명부·업체관리를 못 읽었거나 비었으면 실패이고 아무것도 안 고른다', () => {
  for (const 빈 of [null, undefined, [], { u: 1, v: [] }]) {
    const a = HA.고르기(기본({ roster: 빈, members: { m1: { srl: 1, sid: 'S1' } } }));
    assert.strictEqual(a.ok, false); assert.strictEqual(a.보낼것.length, 0); assert.ok(a.실패);
    const b = HA.고르기(기본({ companies: 빈 }));
    assert.strictEqual(b.ok, false); assert.strictEqual(b.보낼것.length, 0); assert.ok(b.실패);
  }
});

/* ══════ 한 번 돌기 — 도구(읽기·쓰기·내리기)를 가짜로 넣어 실제로 돌린다 ══════ */
function 가짜(자료, 내리기답) {
  const 쓴것 = [], 붙인것 = [], 내린것 = [];
  return {
    쓴것, 붙인것, 내린것,
    도구: {
      읽기: async (p) => 자료[p],
      쓰기: async (p, v) => { 쓴것.push([p, v]); },
      덧붙이기: async (p, v) => { 붙인것.push([p, v]); },
      내리기: async (목록) => {
        내린것.push(...목록);
        return 목록.map(x => Object.assign({}, x, 내리기답 ? 내리기답(x) : { 됐나: true }));
      },
      지금: () => 1000, 달: () => '2026-11', 누가: 'auto'
    }
  };
}
const 퇴사자료 = () => ({
  'homepage/auto/config': null,
  'data/user_dir': 명부([사람('S1', 'retired')]),
  'data/companies': [업체('C1', 'closed')],
  'homepage/members': { m1: { srl: 101, sid: 'S1' } },
  'homepage/partners': { C1: { boardSrl: 185 } }
});
function 멈춤자료() {
  const 자료 = 퇴사자료();
  const 여럿 = 퇴사여럿(HA.멈춤문턱 + 1);
  자료['data/user_dir'] = 여럿.roster; 자료['homepage/members'] = 여럿.members;
  return 자료;
}

test('보기는 아무것도 쓰지도 내리지도 않는다', async () => {
  const g = 가짜(퇴사자료());
  const r = await HA.돌기('보기', '', g.도구);
  assert.strictEqual(r.내릴것.length, 2);
  assert.strictEqual(g.내린것.length + g.쓴것.length + g.붙인것.length, 0);
});

test('돌리기는 내리고, 내린 표시와 기록을 남긴다', async () => {
  const g = 가짜(퇴사자료());
  const r = await HA.돌기('돌리기', '', g.도구);
  assert.strictEqual(g.내린것.length, 2);
  assert.strictEqual(r.내림.length, 2);
  assert.ok(g.쓴것.some(([p]) => p === 'homepage/members/m1/takenDown'));
  assert.ok(g.쓴것.some(([p]) => p === 'homepage/partners/C1/takenDown'));
  assert.ok(g.붙인것.some(([p]) => p === 'homepage/auto/runs/2026-11'));
  assert.ok(g.붙인것.some(([p]) => p === 'homepage/writeLog/101'));
  assert.ok(g.붙인것.some(([p]) => p === 'homepage/writeLog/185'));
});

test('못 내린 것에는 내린 표시를 남기지 않고, 못 내림으로 알린다', async () => {
  const g = 가짜(퇴사자료(), () => ({ 됐나: false, 까닭: '게시판 확인 실패' }));
  const r = await HA.돌기('돌리기', '', g.도구);
  assert.strictEqual(r.못내림.length, 2);
  assert.strictEqual(r.내림.length, 0);
  assert.ok(!g.쓴것.some(([p]) => /takenDown/.test(p)));
  assert.ok(!g.붙인것.some(([p]) => /writeLog/.test(p)));
});

test('꺼져 있으면(off) 읽지도 내리지도 기록하지도 않는다', async () => {
  const 자료 = 퇴사자료(); 자료['homepage/auto/config'] = { off: true };
  const g = 가짜(자료);
  const r = await HA.돌기('돌리기', '', g.도구);
  assert.strictEqual(g.내린것.length + g.붙인것.length + g.쓴것.length, 0);
  assert.ok(r.꺼짐);
});

test('멈춤이면 돌리기는 0건을 내리고 멈춤을 기록한다', async () => {
  const g = 가짜(멈춤자료());
  const r = await HA.돌기('돌리기', '', g.도구);
  assert.strictEqual(g.내린것.length, 0);
  assert.ok(r.멈춤);
  const 기록 = g.붙인것.find(([p]) => p === 'homepage/auto/runs/2026-11');
  assert.ok(기록 && 기록[1].멈춤);
  assert.strictEqual(기록[1].후보.length, HA.멈춤문턱 + 2);
});

test('승인은 지문이 같을 때만 멈춘 목록을 모두 내린다', async () => {
  const 본 = await HA.돌기('보기', '', 가짜(멈춤자료()).도구);
  const 틀림 = 가짜(멈춤자료());
  const r1 = await HA.돌기('승인', 'people_board:1', 틀림.도구);
  assert.strictEqual(틀림.내린것.length, 0);
  assert.strictEqual(r1.ok, false);
  const 맞음 = 가짜(멈춤자료());
  const r2 = await HA.돌기('승인', 본.지문, 맞음.도구);
  assert.strictEqual(맞음.내린것.length, HA.멈춤문턱 + 2);
  assert.strictEqual(r2.내림.length, HA.멈춤문턱 + 2);
});

test('승인은 빈 지문으로 «아무것도 없음»을 승인하지 못한다', async () => {
  const 자료 = 퇴사자료(); 자료['homepage/members'] = {}; 자료['homepage/partners'] = {};
  const g = 가짜(자료);
  const r = await HA.돌기('승인', '', g.도구);
  assert.strictEqual(r.ok, false);
});

test('명부를 못 읽은 달은 내리지 않고 실패를 기록한다', async () => {
  const 자료 = 퇴사자료(); 자료['data/user_dir'] = null;
  const g = 가짜(자료);
  const r = await HA.돌기('돌리기', '', g.도구);
  assert.strictEqual(g.내린것.length, 0);
  assert.strictEqual(r.ok, false);
  const 기록 = g.붙인것.find(([p]) => p === 'homepage/auto/runs/2026-11');
  assert.ok(기록 && 기록[1].실패);
});

test('기록에는 이름을 담지 않는다', async () => {
  const 자료 = 퇴사자료(); 자료['homepage/members'].m1.name = '홍길동';
  자료['data/companies'][0].name = '가나상사';
  const g = 가짜(자료);
  await HA.돌기('돌리기', '', g.도구);
  const 글 = JSON.stringify(g.붙인것) + JSON.stringify(g.쓴것);
  assert.ok(!글.includes('홍길동'));
  assert.ok(!글.includes('가나상사'));
});

test('지문은 차례와 상관없이 같은 목록이면 같다', () => {
  const a = [{ 게시판: 'people_board', srl: 2 }, { 게시판: 'partner_board', srl: 1 }];
  assert.strictEqual(HA.지문(a), HA.지문(a.slice().reverse()));
  assert.notStrictEqual(HA.지문(a), HA.지문(a.slice(0, 1)));
});
