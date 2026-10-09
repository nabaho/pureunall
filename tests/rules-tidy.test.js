// 취업규칙(새) 「🧹 정리하기」 셈 — 순수 모듈 검사. 이름·주소는 가짜만.
// ★ 못 박는 것은 규칙: 우리 쪽 메일은 한 통씩 · 이름 단서는 골라 두지 않는다 · 섞이면 골라 두지 않는다 · 일괄은 주소 일치만
const test = require('node:test');
const assert = require('node:assert/strict');
global.PuRulesV2Order = require('../js/rules-v2/lib-order.js');
global.PuRulesV2Topics = require('../js/rules-v2/lib-topics.js');
const T = require('../js/rules-v2/lib-tidy.js');

const D = (n) => Date.UTC(2026, 0, 1) + n * 864e5;
function doc(id, o) {
  o = o || {};
  return Object.assign({ id, kind: '규칙본문', status: '담김', name: o.name || id + '.hwp', dir: o.dir || '받음', createdAt: 1,
    mail: { src: 'pop3', box: '', key: o.mk || id, date: D(o.d || 0), from: o.from || '', to: o.to || '', subject: o.subj || '' },
    companyCand: o.cand || [] }, o.doc || {});
}
function pack(list, human, rounds) { const docs = {}; list.forEach((d) => { docs[d.id] = d; }); return { docs, human: human || {}, rounds: rounds || {} }; }
const LINK = (co) => ({ companyId: co, companyLinkStatus: 'linked' });
const CO = [{ id: 'c1', name: '(주)가나상사', bizNo: '123-45-67890' }, { id: 'c2', name: '다라산업' },
  { id: 'c3', name: '가나' }, { id: 'c9', name: '지운회사', _deleted: true }];
const g = (list, key) => list.find((x) => x.key === key);

test('주소 — 받음은 보낸 사람, 보냄은 우리 쪽이 아닌 첫 받는 사람, 꺾쇠 안만·소문자', () => {
  assert.equal(T.addrOf(doc('a', { from: '홍길동 <Hong@GanaSangsa.co.kr>' })), 'hong@ganasangsa.co.kr');
  assert.equal(T.addrOf(doc('b', { dir: '보냄', from: T.SELF, to: '370-6@daum.net, dara.hr@naver.com' })), 'dara.hr@naver.com');
  assert.equal(T.addrOf(doc('c', { from: 'staff@fairrunlabor.com' })), '', '우리 직원이 전달한 메일');
  assert.equal(T.addrOf(doc('d', { from: '' })), '');
  assert.equal(T.isOurs('370-6@daum.net'), true);
  assert.equal(T.isOurs('kim@naver.com'), false);
});

test('열린 서류 — 기타·확정·사업장 없음은 빼고, 보류는 넣는다', () => {
  const data = pack([doc('a'), doc('b', { doc: { kind: '기타' } }), doc('c'), doc('d'), doc('e', { doc: { status: '보류', kind: '신고서' } })],
    { c: LINK('c1'), d: { companyId: null, companyLinkStatus: 'not_required' } });
  const ids = T.groups(data, CO).flatMap((x) => x.ids).sort();
  assert.deepEqual(ids, ['a', 'e']);
});

test('묶음 — 같은 주소는 한 묶음, 우리 쪽·빈 주소는 메일 한 통씩', () => {
  const data = pack([doc('a', { from: 'hong@ganasangsa.co.kr', mk: 'm1' }), doc('b', { from: 'hong@ganasangsa.co.kr', mk: 'm2' }),
    doc('c', { from: 'staff@fairrunlabor.com', mk: 'm3' }), doc('d', { from: 'staff@fairrunlabor.com', mk: 'm4' })]);
  const list = T.groups(data, CO);
  const a = g(list, 'a:hong@ganasangsa.co.kr');
  assert.deepEqual(a.ids.sort(), ['a', 'b']);
  assert.ok(a.mails >= 2);
  assert.equal(list.filter((x) => x.ours).length, 2, '우리 쪽 메일은 한 통씩');
});

test('주소 일치 — 골라 두고(pre) 층 1, 모두 주소 일치면 일괄 가능', () => {
  const cand = [{ companyId: 'c1', why: '주소' }];
  const data = pack([doc('a', { from: 'hong@ganasangsa.co.kr', cand }), doc('b', { from: 'hong@ganasangsa.co.kr', cand })]);
  const x = T.groups(data, CO)[0];
  assert.equal(x.pre, 'c1'); assert.equal(x.tier, 1); assert.equal(x.bulkOk, true);
  assert.ok(x.cands.find((c) => c.companyId === 'c1').whys.includes(T.W_ADDR));
});

test('이름 단서만 — 보이되 골라 두지 않고 일괄에도 없다 · 짧은 이름은 긴 이름에 먹힌다', () => {
  const data = pack([doc('a', { from: 'kim@naver.com', subj: '[가나상사] 취업규칙 개정안' })]);
  const x = T.groups(data, CO)[0];
  const ids = x.cands.map((c) => c.companyId);
  assert.ok(ids.includes('c1'), '가나상사가 단서로 보인다');
  assert.equal(ids.includes('c3'), false, '「가나」는 「가나상사」 안에 들어가 버린다');
  assert.equal(x.pre, ''); assert.equal(x.tier, 4); assert.equal(x.bulkOk, false);
});

test('앞서 확정 — 같은 주소를 사람이 이은 회사가 후보(층 2), 일괄은 아니다', () => {
  const data = pack([doc('a', { from: 'sajang77@hanmail.net', mk: 'm1' }), doc('b', { from: 'sajang77@hanmail.net', mk: 'm2' })], { a: LINK('c2') });
  const x = T.groups(data, CO)[0];
  assert.deepEqual(x.ids, ['b']);
  assert.equal(x.pre, 'c2'); assert.equal(x.tier, 2); assert.equal(x.bulkOk, false);
  assert.ok(x.cands[0].whys.includes(T.W_LEARN));
});

test('섞임 — 이름 단서가 두 회사거나 서류마다 서버 후보가 다르면 골라 두지 않는다', () => {
  const two = pack([doc('a', { from: 'tax@naver.com', subj: '가나상사 규칙' }), doc('b', { from: 'tax@naver.com', mk: 'm2', subj: '다라산업 규칙' })]);
  const x = T.groups(two, CO)[0];
  assert.equal(x.mixed, true); assert.equal(x.pre, '');
  const diff = pack([doc('a', { from: 'x@y.kr', cand: [{ companyId: 'c1', why: '주소' }] }),
    doc('b', { from: 'x@y.kr', mk: 'm2', cand: [{ companyId: 'c2', why: '주소' }] })]);
  const y = T.groups(diff, CO)[0];
  assert.equal(y.mixed, true); assert.equal(y.pre, ''); assert.equal(y.bulkOk, false);
});

test('이름 단서가 주소 일치와 다른 회사면 골라 두지 않는다 · 지운 회사는 후보에서 뺀다', () => {
  const data = pack([doc('a', { from: 'hong@ganasangsa.co.kr', subj: '다라산업 건', cand: [{ companyId: 'c1', why: '주소' }, { companyId: 'c9', why: '도메인' }] })]);
  const x = T.groups(data, CO)[0];
  assert.equal(x.pre, '');
  assert.equal(x.cands.some((c) => c.companyId === 'c9'), false);
});

test('차례 — 층 → 서류 많은 묶음 → 최근', () => {
  const addr = [{ companyId: 'c1', why: '주소' }];
  const data = pack([
    doc('n1', { from: 'none@naver.com', d: 9 }),
    doc('a1', { from: 'a@ganasangsa.co.kr', cand: addr, d: 1 }),
    doc('s1', { from: 'small@naver.com', subj: '다라산업', d: 5 }),
    doc('b1', { from: 'big@naver.com', subj: '다라산업', d: 2 }), doc('b2', { from: 'big@naver.com', mk: 'mb', subj: '다라산업', d: 3 })]);
  const keys = T.groups(data, CO).map((x) => x.key);
  assert.deepEqual(keys, ['a:a@ganasangsa.co.kr', 'a:big@naver.com', 'a:small@naver.com', 'a:none@naver.com']);
});
