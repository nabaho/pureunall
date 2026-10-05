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

test('지문은 차례와 상관없이 같은 목록이면 같다', () => {
  const a = [{ 게시판: 'people_board', srl: 2 }, { 게시판: 'partner_board', srl: 1 }];
  assert.strictEqual(HA.지문(a), HA.지문(a.slice().reverse()));
  assert.notStrictEqual(HA.지문(a), HA.지문(a.slice(0, 1)));
});
