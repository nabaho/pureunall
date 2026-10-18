'use strict';
/* 정부지원금 — 매일 기업마당 공고 감시(서버) 검사. 대표 지시 2026-10-12 「매년 사업관련 자동 업데이트」 → 「둘다」.
   ★ 이 검사는 «규칙»을 본다: 이름은 제안만 · 사람이 이은 공고만 접수 상태를 바꾼다 · 사람이 정한 접수 상태·처리는 덮지 않는다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const W = require('./govaid-notice-watch.js');

const TODAY = '2026-10-12', NOW = Date.UTC(2026, 9, 12, 0, 0, 0);
const row = (no, nm, startDt, closeDt) => ({ src: '기업마당', no, nm, inst: '어느 기관', ntce: '중소벤처기업부', startDt, closeDt, openDt: '2026-09-01', field: '인력', url: 'https://www.bizinfo.go.kr/x?id=' + no, memo: '요약' });
const prog = (id, name, over) => Object.assign({ id, name, status: 'confirmed', baseYear: 2026, revision: 3 }, over || {});

test('이름 비슷함 — 해·괄호·차수를 떼고 견주며, 비슷한 사전 사업을 «제안»만 한다', () => {
  const ps = [prog('a', '2026년 중소기업 혁신바우처 사업'), prog('b', '고용유지지원금'), prog('c', '스마트공장 구축지원')];
  const s = W.suggest(row('P1', '2027년 중소기업 혁신바우처 사업 (1차) 모집 공고', '', ''), ps);
  assert.equal(s[0].id, 'a');
  assert.ok(s[0].score >= 0.5);
  assert.ok(!s.some((x) => x.id === 'b'), '전혀 다른 사업은 제안하지 않는다');
  assert.deepEqual(W.suggest(row('P2', '청년 창업 경진대회', '', ''), ps), []);
});

test('접수 상태 — 접수기간 끝났으면 접수 마감, 기간 안이면 접수 중, 날짜를 모르면 아무것도 아님', () => {
  assert.deepEqual(W.closureFromPeriod('2026-09-01', '2026-10-01', TODAY), { state: 'closed', reason: 'deadline', closedAt: '2026-10-01' });
  assert.equal(W.closureFromPeriod('2026-10-01', '2026-10-31', TODAY).state, 'open');
  assert.equal(W.closureFromPeriod('2026-11-01', '2026-11-30', TODAY).state, 'open', '접수 예정도 열린 것으로(메모로 예정일)');
  assert.match(W.closureFromPeriod('2026-11-01', '2026-11-30', TODAY).note, /접수 예정/);
  assert.equal(W.closureFromPeriod('', '', TODAY), null);
});

test('새 공고는 통째로 넣고, 이미 있는 공고는 «서버 칸»만 고친다 — 사람이 누른 처리(decision)는 건드리지 않는다', () => {
  const ps = [prog('a', '중소기업 혁신바우처')];
  const existing = { P9: { id: 'P9', no: 'P9', nm: '옛 이름', decision: 'ignore', decidedBy: 'A-001', firstSeen: 1, revision: 2 } };
  const r = W.plan({ rows: [row('P1', '중소기업 혁신바우처 사업 공고', '2026-10-01', '2026-10-31'), row('P9', '새 이름', '2026-10-01', '2026-10-31')], programs: ps, existing, today: TODAY, nowMs: NOW });
  const n = r.updates['notices/P1'];
  assert.equal(n.id, 'P1');
  assert.equal(n.entityType, 'Document');
  assert.equal(n.docKind, 'govNotice');
  assert.equal(n.suggest[0].id, 'a');
  assert.equal(r.updates['notices/P9'], undefined, '있는 공고를 통째로 덮지 않는다');
  assert.equal(r.updates['notices/P9/nm'], '새 이름');
  assert.ok(!Object.keys(r.updates).some((k) => /^notices\/P9\/(decision|decidedBy|decidedAt|firstSeen)$/.test(k)), '사람 칸·처음 본 날은 그대로');
});

test('사람이 이은 공고(program.bizinfo)만 그 사업의 접수 상태를 바꾼다 — 이름만 비슷한 사업은 안 바꾼다', () => {
  const ps = [prog('linked', '스마트공장 구축지원', { bizinfo: ['P1'] }), prog('similar', '스마트공장 구축지원 사업')];
  const r = W.plan({ rows: [row('P1', '2026년 스마트공장 구축지원 사업 공고', '2026-03-01', '2026-04-30')], programs: ps, existing: {}, today: TODAY, nowMs: NOW });
  const c = r.updates['programs/linked/closure'];
  assert.equal(c.state, 'closed');
  assert.equal(c.reason, 'deadline');
  assert.equal(c.closedAt, '2026-04-30');
  assert.equal(c.by, W.AUTO_BY);
  assert.equal(r.updates['programs/linked/revision'], 4, '판 번호를 올린다(화면 관문이 다음 저장에서 견준다)');
  assert.equal(r.updates['programs/similar/closure'], undefined);
});

test('사람이 표시한 접수 상태는 덮지 않는다 · 같은 상태면 다시 쓰지 않는다', () => {
  const human = prog('h', '가 사업', { bizinfo: ['P1'], closure: { state: 'open', by: 'A-001' } });
  const same = prog('s', '나 사업', { bizinfo: ['P2'], closure: { state: 'closed', reason: 'deadline', closedAt: '2026-04-30', by: W.AUTO_BY } });
  const r = W.plan({ rows: [row('P1', '가', '2026-03-01', '2026-04-30'), row('P2', '나', '2026-03-01', '2026-04-30')], programs: [human, same], existing: {}, today: TODAY, nowMs: NOW });
  assert.equal(r.updates['programs/h/closure'], undefined, '사람 표시를 덮었다');
  assert.equal(r.updates['programs/s/closure'], undefined, '같은 상태를 또 썼다');
});

test('한 사업에 공고가 여럿(1차·2차)이면 하나라도 열려 있으면 접수 중', () => {
  const p = prog('m', '다 사업', { bizinfo: ['P1', 'P2'], closure: { state: 'closed', reason: 'deadline', by: W.AUTO_BY } });
  const r = W.plan({ rows: [row('P1', '다 1차', '2026-03-01', '2026-04-30'), row('P2', '다 2차', '2026-10-01', '2026-10-31')], programs: [p], existing: {}, today: TODAY, nowMs: NOW });
  assert.equal(r.updates['programs/m/closure'].state, 'open');
});

test('지운 사업·초안도 잇기만 했으면 상태를 맞춘다, 지운 사업은 건너뛴다', () => {
  const del = prog('d', '라', { bizinfo: ['P1'], _deleted: true });
  const r = W.plan({ rows: [row('P1', '라', '2026-03-01', '2026-04-30')], programs: [del], existing: {}, today: TODAY, nowMs: NOW });
  assert.equal(r.updates['programs/d/closure'], undefined);
});

test('오래 안 보이고 사람이 처리하지 않은 공고는 덜어낸다 — 처리한 공고는 남긴다', () => {
  const old = NOW - 200 * 86400000;
  const existing = { A: { id: 'A', seenAt: old }, B: { id: 'B', seenAt: old, decision: 'linked' }, C: { id: 'C', seenAt: NOW } };
  const r = W.plan({ rows: [], programs: [], existing, today: TODAY, nowMs: NOW });
  assert.equal(r.updates['notices/A'], null);
  assert.equal(r.updates['notices/B'], undefined);
  assert.equal(r.updates['notices/C'], undefined);
});

test('run — 인증키가 없으면 까닭을 남기고 던지지 않는다 · 있으면 받은 것을 쓴다 · 오류 글에 열쇠가 안 남는다', async () => {
  const writes = [];
  const base = { roles: async () => ({ u1: { isAdmin: true, status: 'active' } }), programs: async () => ({}), existing: async () => ({}),
    write: async (u) => { writes.push(u); }, now: new Date(NOW) };
  const r0 = await W.run(Object.assign({}, base, { cfg: async () => ({}), getJson: async () => ({}) }));
  assert.equal(r0.ok, false);
  assert.match(writes[0].noticeLast.error, /인증키/);
  const KEY = 'secret-key-1234';
  const r1 = await W.run(Object.assign({}, base, { cfg: async () => ({ keyBiz: KEY }),
    getJson: async (u) => { if (/searchLclasId=01/.test(u)) throw new Error('boom ' + KEY); return { jsonArray: [{ pblancId: 'P1', pblancNm: '어느 공고', reqstBeginEndDe: '2026-10-01 ~ 2026-10-31', pblancUrl: 'https://www.bizinfo.go.kr/a' }] }; } }));
  assert.equal(r1.ok, true);
  const last = writes[writes.length - 1];
  assert.ok(last['notices/P1'], '받은 공고를 쓴다');
  assert.ok(!JSON.stringify(last).includes(KEY), '열쇠가 결과에 남았다');
});

test('제안은 «거의 같은 이름»만 — 낱말 몇 개만 겹치는 다른 사업은 제안하지 않는다(2026-10-12 첫 실측에서 틀린 짝)', () => {
  const ps = [prog('ei', '소상공인 고용보험료 지원사업(자영업자 고용보험 가입 지원)')];
  assert.deepEqual(W.suggest(row('P1', '[부산] 영도구 2026년 소상공인 보증료 지원사업 공고', '', ''), ps), [], '보증료 ≠ 고용보험료');
  assert.equal(W.suggest(row('P2', '[울산] 2026년 소상공인 고용보험료 지원사업 공고', '', ''), ps)[0].id, 'ei', '같은 사업의 지역 공고는 제안한다');
});
