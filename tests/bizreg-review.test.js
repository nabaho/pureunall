/* 📥 사업자등록증 자동 검토 — 서버 (대표 지시 2026-10-12, 목업 승인)

   ★ 못 박는 것
     ① 등록증·고유번호증만 검토한다(신청서·확인서는 아니다)
     ② 국세청 상태·대조 결과를 기업 상세 칸에 매달 함수와 «같은 자리»로 적고, 검토 기록을 남긴다
     ③ 대조는 «이번 등록증이 말한 값»(덮지 못한 conflicts 의 새 값)으로 한다
     ④ 오늘 이미 물은 곳은 국세청에 다시 묻지 않는다
     ⑤ 옛 번호 찾기는 대표·상호가 «둘 다» 같을 때만 — 이름 하나로 잇지 않는다
     ⑥ 업체·명함을 고치거나 잇지 않는다 — 적는 곳은 coInfo 의 국세청 칸·공용 자리·검토 기록뿐
     ⑦ 함수는 서울
   ⚠ 예시는 가짜다(가나상사).
   node --test tests/bizreg-review.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const BR = require('../functions/bizreg-review.js');
const NTSM = require('../functions/nts-monthly.js');

const NO = '1234567890';
function fakeDb(vals) {
  const writes = {};
  const db = { ref: (p) => ({
    once: async () => ({ val: () => (p in writes ? writes[p] : vals[p] === undefined ? null : vals[p]) }),
    update: async (u) => Object.assign(writes, u), set: async (v) => { writes[p] = v; } }) };
  return { db, writes };
}
function nts(state, valid) {
  const sent = [];
  const f = async (u, init) => {
    const body = init && init.body ? JSON.parse(init.body) : null;
    sent.push(u.split('?')[0].split('/').pop());
    if (/\/status/.test(u)) return { ok: true, json: async () => ({ data: [{ b_no: NO, b_stt: state, end_dt: state === '폐업자' ? '20240131' : '' }] }) };
    if (/\/validate/.test(u)) return { ok: true, json: async () => ({ data: body.businesses.map((b) => ({ request_param: b, valid: valid })) }) };
    return { ok: true, json: async () => ({ response: { body: { items: { item: [{ saeopjangNm: '가나상사', opaBoheomFg: '2', sangsiInwonCnt: 7 }] } } } }) };
  };
  f.sent = sent;
  return f;
}

test('★★ ① 등록증·고유번호증만', () => {
  assert.ok(BR.isBizDoc({ name: '사업자등록증' })); assert.ok(BR.isBizDoc({ name: '사업자등록증명원' }), '등록증명원도 등록증이다');
  assert.ok(BR.isBizDoc({ name: '고유번호증' }));
  assert.ok(!BR.isBizDoc({ name: '중소기업확인서' })); assert.ok(!BR.isBizDoc({ name: '통합 기술보호지원반 신청서' })); assert.ok(!BR.isBizDoc(null));
});

test('★★★ ② ③ 폐업 등록증 — 국세청 칸·대조·4대보험을 적고, 사람 확인 줄이 된다 · 대조는 새 값으로', async () => {
  const NOW = Date.UTC(2026, 9, 13, 3);
  const { db, writes } = fakeDb({ ['pucards/coInfo/' + NO]: { company: '가나상사', ceo: '홍길동', openDate: '2015-03-01',
    conflicts: { ceo: { got: '김철수' } }, docs: { d1: { name: '사업자등록증' } } }, 'pucards/coInfo': {} });
  const f = nts('폐업자', '01');
  let asked;
  const wrap = async (u, init) => { if (/\/validate/.test(u)) asked = JSON.parse(init.body).businesses[0]; return f(u, init); };
  const r = await BR.reviewOne({ getDatabase: () => db, fetch: wrap }, NO, 'doc', 'd1', null, { key: 'K', now: NOW });
  assert.equal(writes['pucards/coInfo/' + NO + '/ntsState'], '폐업자', '★★★ 국세청 상태를 기업 상세에 안 적었다');
  assert.equal(writes['pucards/coInfo/' + NO + '/ntsEndDt'], '2024-01-31');
  assert.equal(asked.p_nm, '김철수', '★★★ 이번 등록증이 말한 대표자(conflicts 새 값)로 대조하지 않았다');
  assert.equal(writes['pubdata/co/' + NO + '/ei'].gy, 7, '4대보험을 안 받았다');
  const rec = writes['pucards/bizreg/' + BR.reviewKey(NO, 'd1')];
  assert.ok(rec, '★★ 검토 기록이 없다');
  assert.equal(rec.need, true, '★★ 폐업인데 사람 확인 줄이 아니다');
  assert.deepEqual(rec.conflicts, ['ceo']);
  assert.equal(rec.ei.n, 7);
});

test('★★ ④ 오늘 이미 물은 곳은 다시 안 묻는다 · 다 맞으면 «끝»', async () => {
  const NOW = Date.UTC(2026, 9, 13, 3);
  const day = NTSM.todayKst(NOW);
  const co = { company: '가나상사', ceo: '홍길동', openDate: '2015-03-01', ntsState: '계속사업자', ntsAt: day };
  const sig = NTSM.matchReq({ key: NO, bizno: NO, extra: co }).sig;
  Object.assign(co, { ntsMatch: 'ok', ntsMatchOf: sig, folder: 'f' });
  const { db, writes } = fakeDb({ ['pucards/coInfo/' + NO]: co, 'pucards/coInfo': {}, ['pubdata/co/' + NO]: { ei: { at: NOW - 1000, rows: [{}], gy: 3, n: 1 } } });
  const f = nts('계속사업자', '01');
  const r = await BR.reviewOne({ getDatabase: () => db, fetch: f }, NO, 'doc', 'd2', null, { key: 'K', now: NOW });
  assert.equal(f.sent.length, 0, '★★ 오늘 이미 물은 곳을 국세청·공단에 또 물었다: ' + f.sent);
  assert.equal(r.need, false); assert.equal(r.link, 'existing'); assert.equal(r.match, 'ok');
  assert.ok(!Object.keys(writes).some((k) => /ntsState/.test(k)));
});

test('★★★ ⑤ 옛 번호는 대표·상호가 둘 다 같을 때만', () => {
  const all = { '1111111111': { ceo: '홍길동', company: '(주)가나상사', ntsState: '폐업자' },
    '2222222222': { ceo: '홍길동', company: '다라물산' }, '3333333333': { ceo: '김영희', company: '가나상사' }, n가나: { ceo: '홍길동', company: '가나상사' } };
  const got = BR.oldNos(NO, { ceo: '홍길동 외 1명', company: '가나상사' }, all);
  assert.deepEqual(got.map((x) => x.no), ['1111111111'], '★★★ 대표나 상호 하나만 같은 곳·이름 열쇠를 이었다');
  assert.equal(got[0].state, '폐업자');
  assert.deepEqual(BR.oldNos(NO, { ceo: '', company: '가나상사' }, all), [], '대표자 없이 상호만으로 찾았다');
});

test('★★★ ⑥ 적는 곳은 국세청 칸·공용 자리·검토 기록뿐', async () => {
  const { db, writes } = fakeDb({ ['pucards/coInfo/' + NO]: { company: '가나상사', ceo: '홍길동', openDate: '2015-03-01' }, 'pucards/coInfo': {} });
  await BR.reviewOne({ getDatabase: () => db, fetch: nts('계속사업자', '02') }, NO, 'card', 'it1', { ceo: '홍길동', company: '가나상사' }, { key: 'K', now: 5 });
  const bad = Object.keys(writes).filter((k) => !/^pucards\/coInfo\/\d{10}\/nts(State|At|EndDt|Match|MatchAt|MatchOf)$/.test(k)
    && !/^pubdata\/co\/\d{10}\/(ei|eiHist\/\d{6})$/.test(k) && !/^pucards\/bizreg\//.test(k)
    /* 옮기는 동안(functions/pubdata.js OLD_TOO) 고용·산재는 옛 자리에도 같이 쓴다 — 5단계에서 빠진다 */
    && !/^pucards\/coInfo\/\d{10}\/(ei|eiHist\/\d{6})$/.test(k));
  assert.deepEqual(bad, [], '★★★ 검토가 업체·명함 등 다른 자리를 고쳤다');
});

test('★★ ⑦ 트리거 — 서울 · 등록증 아닌 서류·명함은 그냥 지나간다', async () => {
  const regions = []; const h = {};
  const chain = { region: (r) => { regions.push(r); return chain; }, runWith: () => chain,
    database: { ref: (p) => ({ onCreate: (fn) => { h[p] = fn; return p; } }) } };
  const made = BR({ functions: chain, getDatabase: () => { throw new Error('검토하면 안 되는 것을 검토했다'); }, MAIL_REGION: 'asia-northeast3' });
  assert.deepEqual(regions, ['asia-northeast3'], '★★ 서울이 아니다');
  assert.ok(made.bizregReviewDoc && made.bizregReviewCard);
  await h['/pucards/coInfo/{no}/docs/{dk}']({ val: () => ({ name: '중소기업확인서' }) }, { params: { no: NO, dk: 'x' } });
  await h['/pucards/items/{id}']({ val: () => ({ kind: 'card', bizno: NO }) }, { params: { id: 'c1' } });
  await h['/pucards/items/{id}']({ val: () => ({ kind: 'biz', bizno: '123' }) }, { params: { id: 'c2' } });
});
