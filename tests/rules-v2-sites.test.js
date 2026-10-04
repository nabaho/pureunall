// 취업규칙(새) 「🏢 사업장」 줄 셈 — 순수 모듈 검사. 이름은 가짜(가나상사)만.
const test = require('node:test');
const assert = require('node:assert/strict');
const O = require('../js/rules-v2/lib-order.js');
const L = require('../js/rules-v2/lib-sites.js');
const D = (ms) => Date.UTC(2026, 0, 1) + ms * 864e5;            // 2026-01-01 + n일
function doc(id, o) {
  o = o || {};
  return Object.assign({ id, kind: '규칙본문', status: '담김', name: id + '.hwp', dir: '보냄',
    createdAt: 1, mail: { src: 'imap', box: 'a', key: o.mk || id, date: D(o.d || 0) }, companyCand: o.cand || [] }, o.doc || {});
}
const CO = [{ id: 'c1', name: '가나상사', bizNo: '123-45-67890', status: 'active', employmentInsuredCount: 23, bizType: '제조업' },
  { id: 'c2', name: '나다물산', status: 'active', employmentInsuredCount: 8 },
  { id: 'c3', name: '라마전자', status: 'closed' },
  { id: 'c4', name: '바사식품', status: 'closed' }];
const LINK = (co) => ({ companyId: co, companyLinkStatus: 'linked' });
// 문서 몇 개를 담아 자료 한 벌로 만든다. 사람 칸은 {id: human} 로 따로 준다
function pack(list, human, rounds) {
  const docs = {}; list.forEach((d) => { docs[d.id] = d; });
  return { docs, human: human || {}, rounds: rounds || {} };
}
const byId = (rows, id) => rows.find((r) => r.id === id);
// 확정 1건짜리 c1 — 최종본 셈을 보는 바탕
function c1Base() {
  return pack([doc('a', { d: 0 }), doc('b', { d: 10 })], { a: LINK('c1'), b: LINK('c1') });
}

test('띠 경계', () => {
  assert.equal(L.band(4), '5인 미만'); assert.equal(L.band(5), '5~9인'); assert.equal(L.band(9), '5~9인');
  assert.equal(L.band(10), '10~29인'); assert.equal(L.band(29), '10~29인'); assert.equal(L.band(30), '30인 이상');
  assert.equal(L.band(0), ''); assert.equal(L.band(undefined), ''); assert.equal(L.band('abc'), '');
});

test('대상 — 닫힌 업체는 자료가 있어야 들어온다, id 없는 업체는 뺀다', () => {
  const data = pack([doc('a', { d: 1 })], { a: LINK('c4') });
  const rows = L.model(data, CO.concat([{ name: '아이디없음' }]));
  assert.equal(byId(rows, 'c3'), undefined);
  assert.ok(byId(rows, 'c4')); assert.equal(byId(rows, 'c4').closed, true);
  assert.ok(byId(rows, 'c1') && byId(rows, 'c2'));            // 열린 업체는 자료가 없어도 줄이 있다
  assert.equal(rows.some((r) => !r.id), false);
});

test('줄에 사업장 정보가 실린다', () => {
  const r = byId(L.model(pack([]), CO), 'c1');
  assert.equal(r.size, 23); assert.equal(r.band, '10~29인'); assert.equal(r.bizType, '제조업');
  assert.equal(r.bizNo, '123-45-67890'); assert.equal(r.closed, false);
  assert.equal(byId(L.model(pack([]), CO), 'c2').size, 8);
  assert.equal(byId(L.model(pack([]), CO), 'c3'), undefined);
});

test('후보 셈 — 확정·이을 필요 없음·기타는 후보가 아니다', () => {
  const c2 = [{ companyId: 'c2' }];
  const data = pack([
    doc('x1', { mk: 'm1', cand: c2 }), doc('x2', { mk: 'm1', cand: c2 }),       // 후보 둘, 같은 메일
    doc('y', { mk: 'm2', cand: c2 }),                                          // 확정됨
    doc('z', { mk: 'm3', cand: c2 }),                                          // 이을 필요 없음
    doc('w', { mk: 'm4', cand: c2, doc: { kind: '기타' } }),                    // 기타
  ], { y: LINK('c1'), z: { companyLinkStatus: 'not_required' } });
  let r = byId(L.model(data, CO), 'c2');
  assert.equal(r.cand, 2); assert.equal(r.candMails, 1); assert.deepEqual(r.candIds.slice().sort(), ['x1', 'x2']);
  data.docs.v = doc('v', { mk: 'm5', cand: c2 });                               // 다른 메일 하나 더
  r = byId(L.model(data, CO), 'c2');
  assert.equal(r.cand, 3); assert.equal(r.candMails, 2);
});

test('후보 — 사람이 갈래를 고쳐 «기타»로 한 것도 뺀다', () => {
  const data = pack([doc('x', { cand: [{ companyId: 'c2' }] })], { x: { kindFix: '기타' } });
  assert.equal(byId(L.model(data, CO), 'c2').cand, 0);
});

test('두 업체 후보인 문서는 두 줄 모두에 센다 — 확정하면 저절로 빠진다', () => {
  const data = pack([doc('x', { cand: [{ companyId: 'c1' }, { companyId: 'c2' }] })]);
  let rows = L.model(data, CO);
  assert.equal(byId(rows, 'c1').cand, 1); assert.equal(byId(rows, 'c2').cand, 1);
  data.human.x = LINK('c1');
  rows = L.model(data, CO);
  assert.equal(byId(rows, 'c1').cand, 0); assert.equal(byId(rows, 'c1').linked, 1);
  assert.equal(byId(rows, 'c2').cand, 0);
});

test('후보 — 한 문서가 같은 업체를 두 번 적어도 한 번만 센다', () => {
  const data = pack([doc('x', { cand: [{ companyId: 'c2' }, { companyId: 'c2' }] })]);
  assert.equal(byId(L.model(data, CO), 'c2').cand, 1);
});

test('확정 셈 — 기타는 안 센다', () => {
  const data = pack([doc('a'), doc('b', { doc: { kind: '기타' } }), doc('c', { doc: { kind: '신고서' } })],
    { a: LINK('c1'), b: LINK('c1'), c: LINK('c1') });
  assert.equal(byId(L.model(data, CO), 'c1').linked, 2);
});

test('last — 확정·후보 문서 중 가장 늦은 메일, 없으면 0', () => {
  const data = pack([doc('a', { d: 5 }), doc('x', { d: 40, cand: [{ companyId: 'c1' }] })], { a: LINK('c1') });
  const rows = L.model(data, CO);
  assert.equal(byId(rows, 'c1').last, D(40));
  assert.equal(byId(rows, 'c2').last, 0);
});

test('fin — 최종본 있음 → set + 날짜, 지우면 none, 확정 0 이면 빈 상태', () => {
  const data = c1Base();
  const g = O.companyGroups(O.merge(data.docs, data.human), data.rounds)[0];
  data.rounds[g.roundId] = { finalDocId: 'b', finalBy: 'x', finalAt: 1 };
  let r = byId(L.model(data, CO), 'c1');
  assert.equal(r.fin.state, 'set'); assert.equal(r.fin.docId, 'b'); assert.equal(r.fin.at, D(10));
  delete data.rounds[g.roundId];
  r = byId(L.model(data, CO), 'c1');
  assert.equal(r.fin.state, 'none');
  assert.equal(byId(L.model(data, CO), 'c2').fin.state, '');   // 확정 0
});

test('fin — 규칙 본문 회차가 하나도 없으면 none', () => {
  const data = pack([doc('r', { doc: { kind: '신고서' } })], { r: LINK('c1') });
  assert.equal(byId(L.model(data, CO), 'c1').fin.state, 'none');
});

test('groups — 그 사업장 것만, 최근 회차 먼저', () => {
  const data = pack([doc('a', { d: 0 }), doc('b', { d: 400 }), doc('o', { d: 100 })],
    { a: LINK('c1'), b: LINK('c1'), o: LINK('c2') });
  const g = byId(L.model(data, CO), 'c1').groups;
  assert.equal(g.length, 2); assert.ok(g.every((x) => x.companyId === 'c1'));
  assert.ok(g[0].last >= g[1].last);
  assert.ok(g.every((x) => Array.isArray(x.rows) && x.roundKey && 'finalDocId' in x && x.items));
});

test('startDoc — 최종본이 있으면 그것', () => {
  const data = c1Base();
  const g = O.companyGroups(O.merge(data.docs, data.human), data.rounds)[0];
  data.rounds[g.roundId] = { finalDocId: 'a' };
  const s = L.startDoc(byId(L.model(data, CO), 'c1'));
  assert.equal(s.docId, 'a'); assert.equal(s.notFinal, false); assert.equal(s.roundKey, g.roundKey);
});

test('startDoc — 최종본이 없으면 마지막 판 + notFinal + 판 번호', () => {
  const r = byId(L.model(c1Base(), CO), 'c1');
  const s = L.startDoc(r);
  const rows = r.groups[0].rows;
  assert.equal(s.notFinal, true); assert.equal(s.docId, rows[rows.length - 1].item.id);
  assert.equal(s.no, rows[rows.length - 1].no); assert.equal(s.roundKey, r.groups[0].roundKey);
});

test('startDoc — 최근 회차에 본문이 없으면 앞 회차의 것', () => {
  const data = pack([doc('a', { d: 0 }), doc('rep', { d: 300, doc: { kind: '신고서' } })], { a: LINK('c1'), rep: LINK('c1') });
  const r = byId(L.model(data, CO), 'c1');
  assert.equal(r.groups[0].rows.length, 0);                        // 최근 회차는 신고서뿐
  const s = L.startDoc(r);
  assert.equal(s.docId, 'a'); assert.equal(s.notFinal, true);
  assert.equal(r.fin.state, 'none');
});

test('startDoc — 본문이 전혀 없으면 null', () => {
  assert.equal(L.startDoc(byId(L.model(pack([]), CO), 'c1')), null);
  const data = pack([doc('rep', { doc: { kind: '신고서' } })], { rep: LINK('c1') });
  assert.equal(L.startDoc(byId(L.model(data, CO), 'c1')), null);
});

test('거르개·셈 — has / wait / all 길이가 counts 와 맞는다', () => {
  const data = pack([doc('a', { d: 1 }), doc('x', { d: 2, cand: [{ companyId: 'c2' }] })], { a: LINK('c1') });
  const rows = L.model(data, CO.concat([{ id: 'c5', name: '아자기업', status: 'active' }])), c = L.counts(rows);
  assert.equal(L.filter(rows, 'has').length, c.has); assert.equal(L.filter(rows).length, c.has);
  assert.equal(L.filter(rows, 'wait').length, c.wait); assert.equal(L.filter(rows, 'all').length, c.all);
  assert.ok(c.has >= c.wait && c.all >= c.has);
  assert.deepEqual(L.filter(rows, 'wait').map((r) => r.id), ['c2']);
  assert.deepEqual(L.filter(rows, 'has').map((r) => r.id).sort(), ['c1', 'c2']);
  assert.ok(L.filter(rows, 'all').some((r) => r.linked + r.cand === 0));
});

test('검색 — 이름(법인 꼬리표·띄어쓰기 무시)과 사업자번호 숫자', () => {
  const rows = L.model(pack([]), CO);
  const ids = (q) => L.filter(rows, 'all', q).map((r) => r.id);
  assert.deepEqual(ids('가나'), ['c1']);
  assert.deepEqual(ids('㈜가나 상사'), ['c1']);
  assert.deepEqual(ids('(주)가나상사'), ['c1']);
  assert.deepEqual(ids('12345'), ['c1']);
  assert.deepEqual(ids('99999'), []);
  assert.equal(ids('').length, L.counts(rows).all);
  assert.deepEqual(ids('12'), []);                              // 숫자 3자 미만은 사업자번호로 안 찾는다
});

test('normName', () => {
  assert.equal(L.normName(' ㈜ 가나 상사 '), '가나상사');
  assert.equal(L.normName('주식회사 ABC (서울)'), 'abc서울');
  assert.equal(L.normName(null), '');
});

test('차례 — 후보 있는 줄 먼저, 그다음 last 내림, 이름순', () => {
  const co = CO.concat([{ id: 'c5', name: '아자기업', status: 'active' }]);
  const data = pack([
    doc('a', { d: 50 }), doc('b', { d: 20 }),
    doc('x', { d: 5, cand: [{ companyId: 'c2' }] }),
  ], { a: LINK('c1'), b: LINK('c5') });
  const ids = L.model(data, co).map((r) => r.id);
  assert.equal(ids[0], 'c2');                                      // 후보 있는 줄
  assert.deepEqual(ids.slice(1, 3), ['c1', 'c5']);                // last 내림
  const ties = L.model(pack([]), co).map((r) => r.name);          // 자료 없으면 이름순
  assert.deepEqual(ties, ties.slice().sort((p, q) => p.localeCompare(q, 'ko')));
});
