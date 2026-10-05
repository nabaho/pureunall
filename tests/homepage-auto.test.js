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

/* ══════ 2단계 — 새 거래처 로고 «올리기» 고르기 ══════ */
const 올릴회사 = (더) => Object.assign({ posted: true, consent: { date: '2026-10-05', by: '관리자', at: 1 },
  logo: { bytes: 9000, w: 300, h: 80, at: 1 } }, 더 || {});

test('올림 표시·공개 동의·로고가 다 있고 아직 안 이은 거래 중 회사는 올릴 것에 든다', () => {
  const r = HA.고르기(기본({ partners: { C1: 올릴회사() } }));
  assert.strictEqual(r.올릴것.length, 1);
  assert.strictEqual(r.올릴것[0].종류, '새거래처');
  assert.strictEqual(r.올릴것[0].게시판, HA.게시판.자문사);
  assert.strictEqual(r.올릴것[0].companyId, 'C1');
});

test('공개 동의가 없으면 올리지 않는다 — 고객사 이름·로고 공개는 동의가 먼저다', () => {
  for (const 동의 of [undefined, null, {}, { by: 'x' }]) {
    const r = HA.고르기(기본({ partners: { C1: 올릴회사({ consent: 동의 }) } }));
    assert.strictEqual(r.올릴것.length, 0, JSON.stringify(동의));
  }
});

test('로고가 없거나 «안 올림»·표시 안 함이면 올리지 않는다', () => {
  assert.strictEqual(HA.고르기(기본({ partners: { C1: 올릴회사({ logo: null }) } })).올릴것.length, 0);
  assert.strictEqual(HA.고르기(기본({ partners: { C1: 올릴회사({ logo: { bytes: 0 } }) } })).올릴것.length, 0);
  assert.strictEqual(HA.고르기(기본({ partners: { C1: 올릴회사({ posted: false }) } })).올릴것.length, 0);
  assert.strictEqual(HA.고르기(기본({ partners: { C1: 올릴회사({ posted: undefined }) } })).올릴것.length, 0);
});

test('이미 로고와 이었거나(boardSrl) 내린 적이 있으면 다시 올리지 않는다', () => {
  assert.strictEqual(HA.고르기(기본({ partners: { C1: 올릴회사({ boardSrl: 185 }) } })).올릴것.length, 0);
  assert.strictEqual(HA.고르기(기본({ partners: { C1: 올릴회사({ takenDown: { at: 1 } }) } })).올릴것.length, 0);
});

test('거래가 끝났거나 사무대행이거나 업체관리에 없으면 올리지 않는다', () => {
  for (const 상태 of ['closed', 'suboffice']) {
    const r = HA.고르기(기본({ companies: [업체('C1', 상태)], partners: { C1: 올릴회사() } }));
    assert.strictEqual(r.올릴것.length, 0, 상태);
  }
  assert.strictEqual(HA.고르기(기본({ partners: { C9: 올릴회사() } })).올릴것.length, 0);
});

test('명부·업체관리를 못 읽으면 올리지도 않는다', () => {
  const r = HA.고르기(기본({ companies: null, partners: { C1: 올릴회사() } }));
  assert.strictEqual(r.ok, false);
  assert.strictEqual((r.올릴것 || []).length, 0);
});

function 올리기가짜(자료, 답) {
  const g = 가짜(자료);
  g.올린것 = [];
  g.도구.올리기 = async (목록) => { g.올린것.push(...목록); return 목록.map(x => Object.assign({}, x, 답 ? 답(x) : { 됐나: true, srl: 777 })); };
  return g;
}
const 올리기자료 = () => Object.assign(퇴사자료(), {
  'data/companies': [업체('C1', 'closed'), 업체('C2', 'active')],
  'homepage/partners': { C1: { boardSrl: 185 }, C2: 올릴회사() }
});

test('돌리기는 올릴 것을 올리고, 새 글 번호를 그 회사에 «이어 둔다»(다음에 계약이 끝나면 내려가게)', async () => {
  const g = 올리기가짜(올리기자료());
  const r = await HA.돌기('돌리기', '', g.도구);
  assert.strictEqual(g.올린것.length, 1);
  assert.strictEqual(r.올림.length, 1);
  const 이음 = g.쓴것.find(([p]) => p === 'homepage/partners/C2/boardSrl');
  assert.ok(이음 && 이음[1] === 777, '새 글 번호를 안 이었습니다');
  assert.ok(g.붙인것.some(([p]) => p === 'homepage/writeLog/777'));
  const 기록 = g.붙인것.find(([p]) => p === 'homepage/auto/runs/2026-11');
  assert.strictEqual(기록[1].올림.length, 1);
});

test('보기는 올리지 않는다 — 올릴 것만 알려 준다', async () => {
  const g = 올리기가짜(올리기자료());
  const r = await HA.돌기('보기', '', g.도구);
  assert.strictEqual(g.올린것.length, 0);
  assert.strictEqual(r.올릴것.length, 1);
});

test('못 올렸거나 글 번호를 못 받았으면 잇지 않고 «못 올림»으로 남긴다', async () => {
  for (const 답 of [{ 됐나: false, 까닭: '홈페이지가 안 받음' }, { 됐나: true, srl: 0 }]) {
    const g = 올리기가짜(올리기자료(), () => 답);
    const r = await HA.돌기('돌리기', '', g.도구);
    assert.ok(!g.쓴것.some(([p]) => p === 'homepage/partners/C2/boardSrl'), JSON.stringify(답));
    assert.strictEqual(r.못올림.length, 1, JSON.stringify(답));
  }
});

test('승인(멈춘 내리기 승인)은 올리지 않는다 — 올리기는 매달 돌기에서만', async () => {
  const 자료 = 올리기자료();
  const 여럿 = 퇴사여럿(HA.멈춤문턱 + 1);
  자료['data/user_dir'] = 여럿.roster; 자료['homepage/members'] = 여럿.members;
  const 본 = await HA.돌기('보기', '', 가짜(자료).도구);
  const g = 올리기가짜(자료);
  await HA.돌기('승인', 본.지문, g.도구);
  assert.strictEqual(g.올린것.length, 0);
});

test('올리기 도구가 없으면(아직 못 짓는 단계) 올리지 않고 조용히 넘어가지도 않는다', async () => {
  const g = 가짜(올리기자료());
  const r = await HA.돌기('돌리기', '', g.도구);
  assert.strictEqual(r.올림.length, 0);
  assert.ok(r.올리기안됨, '올릴 것이 있는데 못 올린 사실을 안 알립니다');
});

/* ══════ 3단계 — 새 노무사 «올리기» 고르기 ══════ */
const 새노무사 = (더) => Object.assign({ name: '홍길동', kind: 'labor', position2: '공인노무사', srl: '',
  sid: 'S1', careers: ['現 가나상사 자문'], photo: { bytes: 20000 }, publishOk: { at: 1, by: '관리자', 경력글: '現 가나상사 자문' } }, 더 || {});

test('재직·노무사·사진·경력·올리기 허락이 다 있고 글 번호가 없으면 올릴 것에 든다', () => {
  const r = HA.고르기(기본({ members: { n1: 새노무사() } }));
  assert.strictEqual(r.올릴것.length, 1);
  assert.strictEqual(r.올릴것[0].종류, '새구성원');
  assert.strictEqual(r.올릴것[0].게시판, HA.게시판.구성원);
  assert.strictEqual(r.올릴것[0].key, 'n1');
});

test('올리기 허락이 없으면 올리지 않는다 — 사람 소개는 대표가 보고 허락한 것만', () => {
  for (const 허락 of [undefined, null, {}]) {
    assert.strictEqual(HA.고르기(기본({ members: { n1: 새노무사({ publishOk: 허락 }) } })).올릴것.length, 0, JSON.stringify(허락));
  }
});

test('사진·경력이 없으면 올리지 않는다(반쪽 소개가 공개되지 않게)', () => {
  assert.strictEqual(HA.고르기(기본({ members: { n1: 새노무사({ photo: null }) } })).올릴것.length, 0);
  assert.strictEqual(HA.고르기(기본({ members: { n1: 새노무사({ careers: [] }) } })).올릴것.length, 0);
  assert.strictEqual(HA.고르기(기본({ members: { n1: 새노무사({ publishOk: { at: 1, 경력글: ' ' } }) } })).올릴것.length, 0);
});

test('휴직·퇴사·명부에 없음·직원(노무사 아님)·새 홈페이지에서 뺌이면 올리지 않는다', () => {
  for (const 상태 of ['leave', 'retired']) {
    assert.strictEqual(HA.고르기(기본({ roster: 명부([사람('S1', 상태)]), members: { n1: 새노무사() } })).올릴것.length, 0, 상태);
  }
  assert.strictEqual(HA.고르기(기본({ members: { n1: 새노무사({ sid: 'S9' }) } })).올릴것.length, 0);
  assert.strictEqual(HA.고르기(기본({ members: { n1: 새노무사({ sid: '' }) } })).올릴것.length, 0);
  assert.strictEqual(HA.고르기(기본({ members: { n1: 새노무사({ kind: 'staff' }) } })).올릴것.length, 0);
  assert.strictEqual(HA.고르기(기본({ members: { n1: 새노무사({ offSite: true }) } })).올릴것.length, 0);
});

test('이미 글 번호가 있거나, 한 번 올려 둔(uploadedAt) 사람은 다시 올리지 않는다 — 두 장이 걸린다', () => {
  assert.strictEqual(HA.고르기(기본({ members: { n1: 새노무사({ srl: '190' }) } })).올릴것.length, 0);
  assert.strictEqual(HA.고르기(기본({ members: { n1: 새노무사({ uploadedAt: 5 }) } })).올릴것.length, 0);
  assert.strictEqual(HA.고르기(기본({ partners: { C1: 올릴회사({ uploadedAt: 5 }) } })).올릴것.length, 0);
});

test('올렸는데 글 번호를 못 받았어도 «올린 표시»(uploadedAt)는 남긴다 — 다음 달에 또 올리지 않게', async () => {
  const 자료 = 퇴사자료(); 자료['homepage/members'] = { n1: 새노무사() }; 자료['data/user_dir'] = 명부([사람('S1', 'active')]);
  const g = 올리기가짜(자료, () => ({ 됐나: true, srl: 0 }));
  const r = await HA.돌기('돌리기', '', g.도구);
  assert.ok(g.쓴것.some(([p]) => p === 'homepage/members/n1/uploadedAt'), '올린 표시를 안 남겼습니다');
  assert.ok(!g.쓴것.some(([p]) => p === 'homepage/members/n1/srl'));
  assert.strictEqual(r.못올림.length, 1);
});

test('새 노무사를 올리면 받은 글 번호를 그 사람(srl)에 잇는다', async () => {
  const 자료 = 퇴사자료(); 자료['homepage/members'] = { n1: 새노무사() }; 자료['data/user_dir'] = 명부([사람('S1', 'active')]);
  const g = 올리기가짜(자료);
  const r = await HA.돌기('돌리기', '', g.도구);
  assert.strictEqual(r.올림.length, 1);
  const 이음 = g.쓴것.find(([p]) => p === 'homepage/members/n1/srl');
  assert.ok(이음 && 이음[1] === '777');
});

test('지문은 차례와 상관없이 같은 목록이면 같다', () => {
  const a = [{ 게시판: 'people_board', srl: 2 }, { 게시판: 'partner_board', srl: 1 }];
  assert.strictEqual(HA.지문(a), HA.지문(a.slice().reverse()));
  assert.notStrictEqual(HA.지문(a), HA.지문(a.slice(0, 1)));
});

test('★ 이미 홈페이지에 없는 글은 «내림»이 아니라 «이미 없음» — 표시만 남기고 경보·기록 글은 안 남긴다', async () => {
  const g = 가짜(퇴사자료(), (x) => (x.key ? { 됐나: true, 이미: true, 까닭: '이미 홈페이지에 없음' } : { 됐나: true }));
  const r = await HA.돌기('돌리기', '', g.도구);
  assert.strictEqual(r.이미.length, 1);
  assert.strictEqual(r.못내림.length, 0, '이미 없는 글을 못 내림으로 알립니다');
  assert.ok(g.쓴것.some(([p]) => p === 'homepage/members/m1/takenDown'), '표시를 안 남겼습니다 — 다음 달에 또 내리려 한다');
  assert.ok(!g.붙인것.some(([p]) => p === 'homepage/writeLog/101'), '내리지도 않았는데 휴지통으로 옮겼다고 적었습니다');
  assert.ok(!r.내림.some(x => x.srl === 101));
});