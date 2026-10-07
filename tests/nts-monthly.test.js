'use strict';
/* 🏛 국세청 폐업·대표자 확인 — 매달 서버가 (대표 결정 2026-10-07 기업정보함 점검 4절 「월 1회 자동」)
   ① 서버 셈이 화면(pu-cards.html coNts*)과 «같은 물음에 같은 답»을 낸다 — 둘을 실제로 돌려 견준다.
      한쪽만 고치면 화면 단추와 매달 훑기가 다른 곳을 묻거나 다른 자리에 적는다.
   ② 가짜 서버·가짜 국세청으로 한 바퀴: 번호로 맞춰 적고, 잠긴 폴더·지운 명함은 안 보고,
      한 묶음이 실패해도 나머지는 가고, 열쇠가 없으면 아무것도 안 보낸다.
   ③ 배포 목록·일정 — 매달 1일, 서울 시각.
   ⚠ 예시는 가짜다(가나상사·홍길동·123-). */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { sliceFn } = require('./fnslice');

const 뿌리 = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(뿌리, 'pu-cards.html'), 'utf8').split('\r\n').join('\n');
const S = require('../functions/nts-monthly.js');
const J = (v) => JSON.stringify(v);

function screen() {
  const ctx = { console: { log() {}, warn() {} }, Date };
  vm.createContext(ctx);
  const line = (re) => { const m = SRC.match(re); assert.ok(m, '못 찾음 ' + re); return m[0]; };
  vm.runInContext([
    "function digits(s){ return String(s == null ? '' : s).replace(/[^0-9]/g, ''); }",
    sliceFn(SRC, 'function coVal('), line(/const NTS_VALIDATE_CAP = [^\n]*/), line(/const NTS_CHUNK = [^\n]*/),
    line(/const NTS_SKIP_DAYS = [^\n]*/), line(/const BULK_PATCH_CHUNK = [^\n]*/),
    ...['coNtsWord(', 'coNtsCls(', 'coNtsEnd(', 'coNtsCeo(', 'coNtsDay(', 'coNtsName(', 'coNtsNameVariants(', 'coNtsMatchOf(',
      'coNtsMatchReq(', 'coNtsReqId(', 'coNtsMatchChunks(', 'coNtsMatchBody(', 'coNtsMatchJudge(', 'coNtsMatchWrites(',
      'coNtsMatchState(', 'coNtsMatchTargets(', 'coNtsTargets(', 'coNtsChunks(', 'coNtsMatch(', 'coNtsWrites(', 'coSmeDays(']
      .map((h) => sliceFn(SRC, 'function ' + h)),
    'var LIST = []; function coList(){ return LIST; }',
  ].join('\n'), ctx);
  return ctx;
}
const B1 = '1230000001', B2 = '1230000002', B3 = '1230000003';
const 회사 = [
  { key: B1, bizno: B1, ceo: '홍길동 외 1명', openDate: '2015.03.02', company: '㈜가나상사', extra: { ntsAt: '2026-08-01', ntsState: '계속사업자' } },
  { key: B2, bizno: B2, ceo: '김철수', openDate: '20180105', company: '다라물류', extra: { ntsAt: '2026-09-30', ntsState: '계속사업자', ntsMatch: 'ok', ntsMatchAt: '2026-09-30' } },
  { key: B3, bizno: B3, ceo: '', openDate: '', company: '마바상회', extra: { ntsState: '폐업자', ntsAt: '2026-09-29' } },
  { key: 'n마바', bizno: '', company: '번호없음' },
];

test('★★★ 서버 셈이 화면과 «같은 답»이다 — 무엇을 묻고, 어떻게 맞추고, 어디에 적나', () => {
  const C = screen();
  vm.runInContext('LIST = ' + J(회사), C);
  /* 견준 뒤 값이 안 바뀐 «ok» 판정을 만들어 둔다(30일 안이면 다시 안 묻는다) */
  회사[1].extra.ntsMatchOf = S.matchOf(회사[1]);
  vm.runInContext('LIST = ' + J(회사), C);
  const today = '2026-10-07';
  assert.equal(J(S.statusTargets(회사, today).map((o) => o.key)), J(vm.runInContext('coNtsTargets(' + J(today) + ').map(o=>o.key)', C)),
    '★★★ 상태를 물을 곳이 화면과 다르다');
  assert.equal(J(S.matchTargets(회사, today)), J(vm.runInContext('coNtsMatchTargets(' + J(today) + ')', C)), '★★★ 대조할 곳이 화면과 다르다');
  const reqs = S.matchTargets(회사, today);
  assert.equal(J(S.matchChunks(reqs, 3)), J(vm.runInContext('coNtsMatchChunks(' + J(reqs) + ', 3)', C)));
  assert.equal(J(S.matchBody(reqs)), J(vm.runInContext('coNtsMatchBody(' + J(reqs) + ')', C)));
  const vrows = [{ request_param: reqs[0].core, valid: '01' }, { request_param: reqs[0].names[0], valid: '02' }];
  assert.equal(J(S.matchJudge(reqs, vrows)), J(vm.runInContext('coNtsMatchJudge(' + J(reqs) + ',' + J(vrows) + ')', C)));
  const srows = [{ b_no: B1, b_stt: '폐업자', end_dt: '20240131' }, { b_no: '9990000000', b_stt: '계속사업자' },
    { b_no: B3, b_stt: '', tax_type: '국세청에 등록되지 않은 사업자등록번호입니다.' }];
  const ch = 회사.slice(0, 3);
  assert.equal(J(S.statusMatch(ch, srows)), J(vm.runInContext('coNtsMatch(' + J(ch) + ',' + J(srows) + ')', C)), '★★★ 답을 맞추는 법이 다르다');
  const hits = S.statusMatch(ch, srows);
  assert.equal(J(S.statusWrites(hits, today)), J(vm.runInContext('coNtsWrites(' + J(hits) + ',' + J(today) + ')', C)), '★★★ 적는 자리가 다르다');
  const mh = S.matchJudge(reqs, vrows);
  assert.equal(J(S.matchWrites(mh, today)), J(vm.runInContext('coNtsMatchWrites(' + J(mh) + ',' + J(today) + ')', C)));
  ['폐업자', '휴업자', '계속사업자', '국세청에 등록되지 않은 사업자등록번호입니다.', '?'].forEach((w) =>
    assert.equal(S.cls(w), vm.runInContext('coNtsCls(' + J(w) + ')', C)));
});

/* ── 가짜 서버·가짜 국세청 ── */
function fakeDb(tree) {
  const writes = [];
  const get = (p) => p.split('/').reduce((o, k) => (o == null ? undefined : o[k]), tree);
  return { writes, ref: (p) => ({
    once: async () => ({ val: () => { const v = get(p); return v === undefined ? null : JSON.parse(JSON.stringify(v)); } }),
    update: async (u) => { writes.push(u); }, set: async (v) => { writes.push({ [p]: v }); },
  }) };
}
const 등록증 = (id, no, o) => Object.assign({ id, kind: 'biz', bizno: no, ceo: '홍길동', openDate: '2015-03-02', company: '가나상사', updatedAt: 1 }, o || {});
function 국세청(opt) {
  const sent = [];
  const f = async (url, init) => {
    const body = JSON.parse(init.body); sent.push({ url, body });
    if (opt && opt.fail) return { ok: false, status: 500 };
    if (body.b_no) return { ok: true, json: async () => ({ data: body.b_no.map((n) => ({ b_no: n, b_stt: n === B2 ? '폐업자' : '계속사업자', end_dt: n === B2 ? '20240131' : '' })) }) };
    return { ok: true, json: async () => ({ data: body.businesses.map((b) => ({ request_param: b, valid: '01' })) }) };
  };
  f.sent = sent; return f;
}

test('★★★ 한 바퀴 — 번호로 맞춰 적고, 잠긴 폴더·지운 명함은 안 보내고, 한 일을 남긴다', async () => {
  const db = fakeDb({ pucards: {
    items: { a: 등록증('a', B1), b: 등록증('b', B2), c: 등록증('c', B3, { group: 'g-lock' }), d: 등록증('d', '1230000004', { _deletedAt: 5 }),
      e: { id: 'e', kind: 'card', name: '홍길동', bizno: '1230000005' } },
    groups: { 'g-lock': { locked: true } }, coInfo: {} } });
  const nts = 국세청();
  const r = await S.runOnce({ getDatabase: () => db, fetch: nts }, { key: 'K', now: Date.UTC(2026, 9, 1, 0) });
  const sentNos = nts.sent.filter((x) => x.body.b_no).flatMap((x) => x.body.b_no);
  assert.deepEqual(sentNos.sort(), [B1, B2], '★★★ 잠긴 폴더·지운 명함·명함(사업자 아님)의 번호를 보냈다');
  const all = Object.assign({}, ...db.writes);
  assert.equal(all['pucards/coInfo/' + B2 + '/ntsState'], '폐업자');
  assert.equal(all['pucards/coInfo/' + B2 + '/ntsEndDt'], '2024-01-31');
  assert.equal(all['pucards/coInfo/' + B1 + '/ntsMatch'], 'ok');
  assert.ok(all['pucards/config/ntsMonthly'] && all['pucards/config/ntsMonthly'].status.gone === 1, '★ 한 일을 남겨야 화면이 말할 수 있다');
  assert.ok(Object.keys(all).every((k) => k.indexOf('pucards/coInfo/') === 0 || k === 'pucards/config/ntsMonthly'),
    '★★★ 기업 상세 밖(명함·업체)을 고쳤다 — 결과는 «표시만» 한다');
  assert.equal(r.status.gone, 1);
});

test('★★ 열쇠가 없으면 아무것도 안 보낸다 · 묶음이 실패하면 아무것도 안 적고 센다', async () => {
  let nts = 국세청();
  const tree = () => ({ pucards: { items: { a: 등록증('a', B1) }, groups: {}, coInfo: {} }, data: { app_config: {} } });
  let db = fakeDb(tree());
  const old = process.env.NTS_KEY; delete process.env.NTS_KEY;
  const r0 = await S.runOnce({ getDatabase: () => db, fetch: nts }, {});
  if (old !== undefined) process.env.NTS_KEY = old;
  assert.equal(r0.ran, false); assert.equal(nts.sent.length, 0);
  nts = 국세청({ fail: true }); db = fakeDb(tree());
  const r = await S.runOnce({ getDatabase: () => db, fetch: nts }, { key: 'K' });
  assert.equal(r.status.failed, 1);
  assert.ok(!db.writes.some((w) => Object.keys(w).some((k) => k.indexOf('/ntsState') > 0)), '★★ 실패한 묶음에 무언가를 적었다');
});

test('★ 배포 목록에 올라 있다 — 매달 1일, 서울 시각', () => {
  const idx = fs.readFileSync(path.join(뿌리, 'functions', 'index.js'), 'utf8');
  assert.match(idx, /exports\.ntsMonthly = NTSM\.ntsMonthly;/, '★ index.js 에 안 적으면 함수가 아예 안 올라간다');
  const src = fs.readFileSync(path.join(뿌리, 'functions', 'nts-monthly.js'), 'utf8');
  assert.match(src, /pubsub\.schedule\("0 6 1 \* \*"\)\s*\n\s*\.timeZone\("Asia\/Seoul"\)/);
  assert.ok(!/secrets\s*:/.test(src), '없는 비밀을 적으면 배포 전체가 멈춘다 — 열쇠는 process.env 와 app_config 에서 읽는다');
});
