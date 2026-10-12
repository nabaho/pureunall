/* 🗂 공공데이터 공용 자리 pubdata (대표 「진행」 2026-10-11, 구조 목업 승인)

   ★ 못 박는 것
     ① 쓰기는 서버만 — 규칙이 화면 쓰기를 막고, 읽기는 기업정보함(pucards)과 «같은» 범위다(넓어지지 않는다)
     ② «받아 달라» 요청은 번호 10자리·정해진 칸만 받는다
     ③ 서버는 새 자리에 쓰고, 옮기는 동안 옛 자리(pucards/coInfo)에도 «같은 값»을 쓴다
     ④ 요청 처리: 하루 안에 받은 갈래는 안 묻는다 · 고른 사업장이 바뀌면 다시 묻는다 · 명함 전체를 안 읽는다 · 요청을 지운다
     ⑤ 공휴일: 쉬는 날만 · 종류 가르기 · 0건이면 그 해를 지우지 않는다
     ⑥ 손으로 넣은 공휴일이 이기고, 받은 것은 «없는 날만» 더한다
   ⚠ 예시는 가짜다(가나상사).
   node --test tests/pubdata.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');

const PUBD = require('../functions/pubdata.js');
const NPSM = require('../functions/nps-monthly.js');
const NTSM = require('../functions/nts-monthly.js');
const RULES = JSON.parse(execFileSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'make-firebase-rules.js')], { encoding: 'utf8', maxBuffer: 64 << 20 })).rules;

function fakeDb(vals) {
  const writes = {}, reads = [], removed = [];
  const db = { ref: (p) => ({
    once: async () => { reads.push(p); return { val: () => (vals[p] === undefined ? null : vals[p]) }; },
    update: async (u) => Object.assign(writes, u),
    set: async (v) => { writes[p] = v; },
    remove: async () => { removed.push(p); } }) };
  return { db, writes, reads, removed };
}
const okJson = (body) => ({ ok: true, json: async () => ({ response: { body } }) });
const EI = [{ saeopjangNm: '가나상사(주)', opaBoheomFg: '2', sangsiInwonCnt: 12, gyEopjongNm: '도매업', seongripDt: '20200101', addr: '가나시 1' }];

test('★★★ ① 규칙 — pubdata 는 화면이 못 쓰고, 읽기는 pucards 와 같다', () => {
  assert.equal(RULES.pubdata['.write'], false, '★★★ 화면이 공용 자리를 고칠 수 있습니다');
  assert.equal(RULES.pubdata['.read'], RULES.pucards['.read'], '★★ 읽는 사람이 기업정보함과 다릅니다(넓어지면 보고가 필요합니다)');
  assert.ok(!('.read' in (RULES.pubdata_req || {})), '요청 자리는 아무도 읽지 않습니다');
});

test('★★ ② 요청 규칙 — 번호 10자리 · at 숫자 · k 는 ei/nps · 다른 칸 막음', () => {
  const r = RULES.pubdata_req.$no;
  assert.match(r['.validate'], /\$no\.matches\(\/\^\[0-9\]\{10\}\$\/\)/);
  assert.match(r['.validate'], /child\('at'\)\.isNumber\(\)/);
  assert.match(r['.validate'], /'ei'/); assert.match(r['.validate'], /'nps'/);
  assert.ok(r.$other && /\$other === 'at'/.test(r.$other['.validate']), '정해지지 않은 칸을 막지 않습니다');
});

test('★★★ ③ 매달 — 새 자리와 옛 자리에 같은 값, 공휴일은 공용 자리에', async () => {
  const NOW = Date.UTC(2026, 9, 11);
  const { db, writes } = fakeDb({
    'pucards/items': { a: { kind: 'biz', bizno: '1234567890', company: '가나상사' } }, 'pucards/groups': {},
    'pucards/coInfo': { '1234567890': { nps: { none: { at: 1 } } } }, 'pubdata/co': null });
  const fetchFn = async (u) => /gySjb/.test(u) ? okJson({ items: { item: EI } })
    : /SpcdeInfoService/.test(u) ? okJson({ items: { item: /solYear=2027/.test(u) ? [{ locdate: 20270101, dateName: '1월1일', isHoliday: 'Y' }] : [] } })
    : okJson({ items: '' });
  const r = await NPSM.runOnce({ getDatabase: () => db, fetch: fetchFn }, { key: 'k', now: NOW });
  assert.equal(r.ei.got, 1);
  assert.equal(writes['pubdata/co/1234567890/ei'].gy, 12, '★★★ 공용 자리에 안 썼습니다');
  assert.deepEqual(writes['pucards/coInfo/1234567890/ei'], writes['pubdata/co/1234567890/ei'], '★★ 옮기는 동안 옛 자리도 같아야 합니다');
  assert.equal(writes['pubdata/co/1234567890/eiHist/202610'], 12);
  assert.equal(writes['pubdata/common/holidays/2027'].list[0].date, '2027-01-01', '★★ 내년 공휴일을 안 받았습니다');
  assert.ok(!('pubdata/common/holidays/2026' in writes), '★★ 0건인 해를 덮어 지웠습니다');
});

test('★★ 국세청 상태도 공용 자리에 — 번호 아닌 열쇠는 건너뜀', () => {
  const u = NTSM.pubStatusWrites([{ key: '1234567890', state: '폐업자', end: '20260301' }, { key: 'x', state: '계속사업자' }], '2026-10-01');
  assert.deepEqual(Object.keys(u), ['pubdata/co/1234567890/nts']);
  assert.equal(u['pubdata/co/1234567890/nts'].end, '20260301');
});

test('★★★ ④ 요청 — 명함 전체를 안 읽고, 하루 안이면 안 묻고, 끝나면 지운다', async () => {
  const NOW = Date.UTC(2026, 9, 11);
  const urls = [];
  const fetchFn = async (u) => { urls.push(u); return /gySjb/.test(u) ? okJson({ items: { item: EI } }) : okJson({ items: '' }); };
  /* 어제 받은 고용·산재 → 안 묻는다 */
  let f = fakeDb({ 'pucards/coInfo/1234567890': {}, 'pubdata/co/1234567890': { ei: { at: NOW - 3600000 } } });
  let r = await NPSM.askOnce({ getDatabase: () => f.db, fetch: fetchFn }, '1234567890', { k: 'ei' }, { key: 'k', now: NOW });
  assert.equal(urls.length, 0, '★★ 한 시간 전에 받은 것을 또 물었습니다');
  assert.deepEqual(f.removed, ['pubdata_req/1234567890'], '★★ 요청을 안 지웠습니다');
  assert.ok(!f.reads.some(p => p === 'pucards/items'), '★★★ 요청 하나에 명함 전체를 읽습니다(요금)');
  /* 이틀 전 → 묻고 두 자리에 쓴다 */
  f = fakeDb({ 'pucards/coInfo/1234567890': {}, 'pubdata/co/1234567890': { ei: { at: NOW - 2 * 86400000 } } });
  r = await NPSM.askOnce({ getDatabase: () => f.db, fetch: fetchFn }, '1234567890', { k: 'ei' }, { key: 'k', now: NOW });
  assert.deepEqual(r.did, ['ei']);
  assert.equal(f.writes['pubdata/co/1234567890/ei'].gy, 12);
  /* 번호가 아니면 아무것도 안 묻는다 */
  urls.length = 0;
  f = fakeDb({});
  r = await NPSM.askOnce({ getDatabase: () => f.db, fetch: fetchFn }, '12345', {}, { key: 'k', now: NOW });
  assert.equal(urls.length, 0); assert.equal(r.why, '번호 아님');
});

test('★★ ④ 고른 사업장이 바뀌면 하루 안이라도 다시 받는다', async () => {
  const NOW = Date.UTC(2026, 9, 11);
  const asked = [];
  const fetchFn = async (u) => { asked.push(u.split('?')[0].split('/').pop());
    return /getDetail/.test(u) ? okJson({ items: { item: { jnngpCnt: 7, dataCrtYm: '202609' } } }) : okJson({ items: { item: {} } }); };
  const f = fakeDb({ 'pucards/coInfo/1234567890': { nps: { pick: { seq: '99' } } },
    'pubdata/co/1234567890': { nps: { now: { at: NOW - 60000, cnt: 3 }, nowSeq: '13' } } });
  const r = await NPSM.askOnce({ getDatabase: () => f.db, fetch: fetchFn }, '1234567890', { k: 'nps' }, { key: 'k', now: NOW });
  assert.deepEqual(r.did, ['nps'], '★★ 사업장을 바꿨는데 옛 숫자가 남습니다');
  assert.equal(f.writes['pubdata/co/1234567890/nps/nowSeq'], '99');
  assert.equal(f.writes['pubdata/co/1234567890/nps/now'].cnt, 7);
});

test('★★ ⑤ 공휴일 — 쉬는 날만, 종류 가르기', () => {
  const rows = PUBD.holiRows([{ locdate: 20270209, dateName: '대체공휴일(설날)', isHoliday: 'Y' },
    { locdate: 20270501, dateName: '노동절', isHoliday: 'Y' }, { locdate: 20270405, dateName: '식목일', isHoliday: 'N' },
    { locdate: 20280412, dateName: '국회의원선거일', isHoliday: 'Y' }, { locdate: 20250127, dateName: '임시공휴일', isHoliday: 'Y' }]);
  assert.equal(rows.length, 4, '쉬지 않는 날(N)이 섞였습니다');
  assert.equal(rows[0].kind, '임시공휴일', '이알피 종류 낱말(임시공휴일)과 다릅니다');
  rows.shift();
  assert.equal(rows[0].kind, '대체공휴일'); assert.equal(rows[1].kind, '법정공휴일'); assert.equal(rows[2].kind, '선거일');
  assert.equal(rows[1].date, '2027-05-01');
});

test('★★★ ⑥ 손입력이 이기고, 없는 날만 더한다 — 지우지 않는다', () => {
  const ctx = { console, String, Array, Object, Promise };
  ctx.globalThis = ctx; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'pu-pubdata.js'), 'utf8'), ctx);
  const manual = [{ date: '2027-08-27', name: '창립기념일(가나상사)', kind: '약정휴일' }, { date: '2027-01-01', name: '신정', kind: '법정공휴일' }];
  const got = JSON.parse(JSON.stringify(ctx.PuPubdata.mergeHolidays(manual, [{ date: '2027-01-01', name: '1월1일', kind: '법정공휴일' }, { date: '2027-05-01', name: '노동절', kind: '법정공휴일' }])));
  assert.equal(got.length, 3);
  assert.equal(got.find(x => x.date === '2027-01-01').name, '신정', '★★★ 손으로 넣은 이름을 덮었습니다');
  assert.ok(got.some(x => x.date === '2027-08-27'), '★★★ 손으로 넣은 약정휴일이 사라졌습니다');
  assert.equal(got.find(x => x.date === '2027-05-01').src, 'kasi', '받은 날에 출처 표시가 없습니다');
  assert.deepEqual(got.map(x => x.date), [...got.map(x => x.date)].sort());
});

test('★ 화면 읽기 도구는 쓰지 않는다 — 요청 자리 말고는 set/update 가 없다', () => {
  const code = fs.readFileSync(path.join(__dirname, '..', 'js', 'pu-pubdata.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const writes = code.match(/\.ref\(([^)]*)\)\.(set|update|push|remove)\(/g) || [];
  assert.ok(writes.length >= 1 && writes.every(w => /pubdata_req/.test(w)), '★★ 화면이 공용 자리에 씁니다: ' + writes.join(' | '));
});

test('★★★ 요청 함수는 서울 — 매달 함수와 같은 지역(공공데이터포털은 바깥 아이피를 막는다)', () => {
  const regions = []; let made_n = 0;
  const chain = { region: (r) => { regions.push(r); return chain; }, runWith: () => { made_n++; return chain; },
    pubsub: { schedule: () => ({ timeZone: () => ({ onRun: () => 'sched' }) }) },
    database: { ref: () => ({ onCreate: () => 'ask', onWrite: () => 'mirror' }) } };
  const made = NPSM({ functions: chain, getDatabase: () => null, MAIL_REGION: 'asia-northeast3' });
  assert.equal(made.pubdataAsk, 'ask'); assert.equal(made.pubdataNtsMirror, 'mirror');
  assert.equal(regions.length, made_n, '★★★ 지역을 안 적은 함수가 있습니다 — 기본(us-central1)에서는 「fetch failed」');
  assert.ok(regions.every(r => r === 'asia-northeast3'), '★★★ 서울이 아닙니다: ' + regions);
});

test('★★ 요청 — 한 갈래가 실패해도 오류로 끝나지 않고, 요청은 지운다', async () => {
  const f = fakeDb({ 'pucards/coInfo/1234567890': {}, 'pubdata/co/1234567890': null });
  const r = await NPSM.askOnce({ getDatabase: () => f.db, fetch: async () => { throw new Error('fetch failed'); } }, '1234567890', {}, { key: 'k', now: 1 });
  assert.ok(r.failed && r.failed.length >= 1, '실패를 적지 않았습니다');
  assert.deepEqual(f.removed, ['pubdata_req/1234567890']);
});

test('★★ 국세청 상태 옮겨 적기 — 그대로 옮기고, 번호 아닌 열쇠·빈 상태는 건너뛴다', () => {
  assert.deepEqual(PUBD.ntsMirrorOf('1234567890', { ntsState: '폐업자', ntsAt: '2026-10-12', ntsEndDt: '2024-01-31', folder: 'x' }),
    { 'pubdata/co/1234567890/nts': { state: '폐업자', at: '2026-10-12', end: '2024-01-31' } });
  assert.equal(PUBD.ntsMirrorOf('n가나상사', { ntsState: '계속사업자' }), null, '★★ 이름 열쇠를 공용 자리에 적었습니다');
  assert.equal(PUBD.ntsMirrorOf('123-45-67890', { ntsState: '계속사업자' }), null, '열쇠는 숫자 열 자리 그대로여야 합니다');
  assert.equal(PUBD.ntsMirrorOf('1234567890', { folder: 'x' }), null, '상태가 없는데 적었습니다');
  assert.ok(PUBD.NTS_FIELDS.ntsState && PUBD.NTS_FIELDS.ntsAt && !PUBD.NTS_FIELDS.folder, '국세청 칸이 아닌 것에도 반응합니다');
});
