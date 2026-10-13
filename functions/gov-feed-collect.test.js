'use strict';
/* 정부사업신청 — 매일 공고 모으기(서버) 검사. 대표 지시 2026-10-12 「매일매일 공고를 크롤링 하고 모을 수 있나?」 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const C = require('./gov-feed-collect.js');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const INDEX = read(path.join(__dirname, 'index.js'));

/* ── 화면과 같은 모듈 ── */
test('★★★ 서버가 쓰는 걸러내기·주소 모듈은 화면(js/)과 «글자까지 같다» — 두 벌이 갈라지면 화면엔 걸리는데 서버는 못 잡는다', () => {
  ['gov-g2b.js', 'gov-alio.js', 'gov-bizinfo.js'].forEach((f) => {
    assert.equal(read(path.join(__dirname, 'vendor', f)), read(path.join(ROOT, 'js', f)),
      'functions/vendor/' + f + ' 가 js/' + f + ' 와 다르다 — js/ 를 고쳤으면 복사해 오세요: cp js/' + f + ' functions/vendor/');
  });
});

/* ── 가짜 서버 ── */
const g2bRow = (no, nm) => ({ bidNtceNo: no, bidNtceOrd: '000', bidNtceNm: nm, dminsttNm: '어느 기관', ntceInsttNm: '어느 기관', bidNtceDt: '2026-10-11 09:00:00', bidClseDt: '2026-10-20 10:00:00', presmptPrce: '10000000', cntrctCnclsMthdNm: '제한경쟁', bidNtceDtlUrl: 'https://g2b.go.kr/x' });
const g2bResp = (items, total) => ({ response: { header: { resultCode: '00' }, body: { items, totalCount: total == null ? items.length : total } } });
const alioResp = (items) => ({ response: { body: { items: { item: items }, totalCount: items.length } } });
const bizResp = (items) => ({ jsonArray: items.map((x) => Object.assign({ totCnt: items.length }, x)) });
function fake(over) {
  over = over || {};
  const calls = [];
  const getJson = async (u) => {
    calls.push(u);
    if (over.fail && over.fail(u)) throw new Error(over.failMsg || 'fetch failed ' + u);
    if (/BidPublicInfoService/.test(u)) { const p = Number((u.match(/pageNo=(\d+)/) || [])[1]); return (over.g2b || ((pp) => g2bResp([g2bRow('R1', '노무 컨설팅 용역'), g2bRow('R2', '수출기업 해외마케팅 컨설팅')])))(p); }
    if (/recruitment\/list/.test(u)) return (over.alio || (() => alioResp([{ recrutPblntSn: '9001', recrutPbancTtl: '경영평가 외부 위원 모집', instNm: '공단', pbancBgngYmd: '20261001', pbancEndYmd: '20261030' }, { recrutPblntSn: '9002', recrutPbancTtl: '직원 채용', instNm: '공단' }])))();
    if (/bizinfoApi/.test(u)) return (over.biz || (() => bizResp([{ pblancId: 'PBLN_1', pblancNm: '2026년 일터혁신 상생컨설팅 지원', jrsdInsttNm: '충청남도', excInsttNm: '충남경제진흥원', reqstBeginEndDe: '2026-10-07 ~ 2026-10-30', creatPnttm: '2026-10-08 10:00:00', pblancUrl: 'https://www.bizinfo.go.kr/x', hashtags: '일터혁신,컨설팅' }])))(u);
    throw new Error('모르는 주소 ' + u);
  };
  return { getJson, calls };
}
const NOW = new Date('2026-10-12T07:40:00+09:00');

test('★ 세 곳에서 받아 «화면과 같은 규칙»으로 거른다 — 노무 용역·위원 위촉·일터혁신은 걸리고, 마케팅 컨설팅·직원 채용은 안 걸린다', async () => {
  const f = fake();
  const r = await C.collect({ keyData: 'KD', keyBiz: 'KB', today: '2026-10-12', now: NOW, getJson: f.getJson });
  assert.deepEqual(r.rows.map((x) => x.nm).sort(), ['2026년 일터혁신 상생컨설팅 지원', '경영평가 외부 위원 모집', '노무 컨설팅 용역'].sort());
  assert.equal(r.counts.g2b, 2); assert.equal(r.counts.alio, 2); assert.ok(r.counts.biz >= 1);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.rows.map((x) => x.src).sort(), ['기업마당', '나라장터', '알리오']);
});
test('★ 나라장터는 «지난 7일»을 묻고, 총 건수가 더 많으면 다음 쪽도 받는다(뚜껑 8쪽)', async () => {
  const f = fake({ g2b: (p) => g2bResp([g2bRow('R' + p, '노무 용역 ' + p)], 3) });
  const r = await C.collect({ keyData: 'KD', today: '2026-10-12', now: NOW, getJson: f.getJson });
  const g = f.calls.filter((u) => /BidPublicInfoService/.test(u));
  assert.equal(g.length, 3, '3건이 될 때까지 쪽을 넘겨야 한다');
  assert.match(g[0], /inqryBgnDt=202610050000/); assert.match(g[0], /inqryEndDt=202610122359/);
  assert.equal(r.rows.filter((x) => x.src === '나라장터').length, 3);
  const f2 = fake({ g2b: () => g2bResp([g2bRow('X', '노무 용역')], 99999) });
  const r2 = await C.collect({ keyData: 'KD', today: '2026-10-12', now: NOW, getJson: f2.getJson });
  assert.equal(f2.calls.filter((u) => /BidPublicInfoService/.test(u)).length, 8, '뚜껑(8쪽)을 넘겨 부르면 하루 1,000회를 넘긴다');
  assert.equal(C.PAGE_MAX.g2b, 8); assert.equal(C.PAGE_MAX.alio, 10);
  assert.ok(r2.errors.some((e) => /쪽 뚜껑/.test(e)), '뚜껑에 걸렸으면 말한다');
});
test('★ 인증키가 없는 쪽은 아예 부르지 않는다 — 기업마당 키만 있으면 나라장터·알리오를 안 부른다', async () => {
  const f = fake();
  await C.collect({ keyBiz: 'KB', today: '2026-10-12', now: NOW, getJson: f.getJson });
  assert.equal(f.calls.filter((u) => /BidPublicInfoService|recruitment\/list/.test(u)).length, 0);
  const g = fake();
  await C.collect({ keyData: 'KD', today: '2026-10-12', now: NOW, getJson: g.getJson });
  assert.equal(g.calls.filter((u) => /bizinfoApi/.test(u)).length, 0);
});
test('★★★ 인증키는 오류 글에 «한 글자도» 안 남는다 — 주소에 키가 든 오류가 와도 지운다', async () => {
  const SECRET = 'SECRETKEY123456';
  const f = fake({ fail: () => true, failMsg: 'fetch failed https://apis.data.go.kr/x?serviceKey=' + SECRET + '&pageNo=1' });
  const r = await C.collect({ keyData: SECRET, keyBiz: 'BIZSECRET9999', today: '2026-10-12', now: NOW, getJson: f.getJson });
  const all = JSON.stringify(r);
  assert.doesNotMatch(all, /SECRETKEY123456|BIZSECRET9999/, '키가 결과에 샜다');
  assert.ok(r.errors.length >= 2, '출처마다 오류를 남긴다');
});
test('★ 한 출처가 실패해도 나머지는 받는다 — 나라장터가 죽어도 알리오·기업마당은 들어온다', async () => {
  const f = fake({ fail: (u) => /BidPublicInfoService/.test(u) });
  const r = await C.collect({ keyData: 'KD', keyBiz: 'KB', today: '2026-10-12', now: NOW, getJson: f.getJson });
  assert.ok(r.errors.some((e) => /^나라장터/.test(e)));
  assert.ok(r.rows.some((x) => x.src === '알리오') && r.rows.some((x) => x.src === '기업마당'));
});
test('★ 사용자 낱말(kw)을 따른다 — 낱말을 줄이면 그것만 걸린다', async () => {
  const f = fake();
  const r = await C.collect({ keyData: 'KD', keyBiz: 'KB', kws: ['노무'], today: '2026-10-12', now: NOW, getJson: f.getJson });
  assert.deepEqual(r.rows.map((x) => x.nm).sort(), ['경영평가 외부 위원 모집', '노무 컨설팅 용역'].sort(), '나라장터는 사용자 낱말(노무)만 · 알리오는 «위원·고문 위촉» 규칙이라 낱말과 무관(화면과 같다) · 기업마당 일터혁신은 낱말에서 빠졌으니 안 걸린다');
});

/* ── 하루 한 번(run) ── */
function adapters(over) {
  const written = []; over = over || {};
  const f = over.fake || fake();
  return { written, calls: f.calls, a: {
    roles: async () => over.roles || { U1: { isAdmin: true }, U2: { isAdmin: false }, U3: { isAdmin: true, status: 'resigned' } },
    cfg: async (uid) => (over.cfg ? over.cfg(uid) : (uid === 'U1' ? { keyData: 'KD', keyBiz: 'KB', kw: null } : {})),
    existing: async () => over.existing || {},
    write: async (u) => { if (over.writeFail) throw new Error('permission_denied'); written.push(u); },
    getJson: f.getJson, now: NOW } };
}
test('★★ run — 새 공고만 gov_feed/rows 에 담고 last 에 건수·시각을 남긴다 · 이미 있는 번호는 안 건드린다', async () => {
  const k = C.safeKey('R1-000');
  const x = adapters({ existing: { [k]: { no: 'R1-000', nm: '옛 줄', at: '2026-10-11T00:00:00.000Z' } } });
  const r = await C.run(x.a);
  assert.equal(r.ok, true);
  const u = x.written[0];
  assert.ok(!(('rows/' + k) in u), '이미 받은 번호를 또 쓰면 안 된다');
  const rowKeys = Object.keys(u).filter((p) => p.startsWith('rows/') && u[p]);
  assert.equal(rowKeys.length, 2, '새로 걸린 둘(알리오·기업마당)만');
  assert.equal(u.last.added, 2); assert.equal(u.last.today, '2026-10-12'); assert.ok(u.last.at);
  assert.equal(u[rowKeys[0]].at, NOW.toISOString());
});
test('★★★ run 은 gov_feed 밖에 «아무것도» 안 쓴다 — 쓰는 칸이 rows/* 와 last 뿐이고, 대표의 목록(gov/{uid}/feed)은 건드리지 않는다', async () => {
  const x = adapters();
  await C.run(x.a);
  Object.keys(x.written[0]).forEach((p) => assert.ok(/^rows\/[^/]+$/.test(p) || p === 'last', '엉뚱한 칸에 쓴다: ' + p));
  const fn = INDEX.slice(INDEX.indexOf('exports.govFeedCollect'));
  assert.doesNotMatch(fn, /db\.ref\("gov\/"[^)]*\)\.(set|update|push|remove)|child\("feed"\)\.(set|update)/, '대표 목록에 쓰는 코드가 있다');
  assert.match(fn, /write: \(updates\) => feed\.update\(updates\)/);
});
test('★ 인증키를 가진 관리자를 찾는다 — 퇴사한 관리자·일반 직원은 건너뛴다 · 아무도 없으면 까닭을 last 에 남기고 멈춘다', async () => {
  const none = adapters({ cfg: () => ({}) });
  const r = await C.run(none.a);
  assert.equal(r.ok, false); assert.match(none.written[0].last.error, /인증키를 찾지 못했습니다/);
  assert.equal(none.calls.length, 0, '키가 없는데 서버를 부르면 안 된다');
  const seen = [];
  const y = adapters({ roles: { U2: { isAdmin: false }, U3: { isAdmin: true, status: 'resigned' }, U1: { isAdmin: true } }, cfg: (uid) => { seen.push(uid); return uid === 'U1' ? { keyData: 'KD' } : { keyData: 'OTHER' }; } });
  await C.run(y.a);
  assert.deepEqual(seen, ['U1'], '일반 직원(U2)·퇴사 관리자(U3)의 자리를 읽으면 안 된다');
});
test('★ 한쪽 키만 있으면 그렇다고 last.note 에 밝힌다(조용히 반쪽만 받지 않는다)', async () => {
  const x = adapters({ cfg: () => ({ keyBiz: 'KB' }) });
  await C.run(x.a);
  assert.match(x.written[0].last.note, /공공데이터포털 인증키가 없어 기업마당만/);
});
test('★★ run 은 «절대 던지지 않는다» — 서버가 다 죽어도·쓰기가 막혀도 last 에 까닭을 남기거나 조용히 끝난다', async () => {
  const x = adapters({ fake: fake({ fail: () => true }) });
  const r = await C.run(x.a);
  assert.equal(r.ok, true, '출처 오류는 «받은 만큼» 정상 종료 — 까닭은 errors 에');
  assert.ok(x.written[0].last.errors.length >= 2);
  const w = adapters({ writeFail: true });
  const r2 = await C.run(w.a);
  assert.equal(r2.ok, false);
});
test('★ 오래된 줄(120일)·상한(1,500줄) 넘는 줄은 덜어낸다 — 가장 오래된 것부터', () => {
  const now = Date.parse('2026-10-12T00:00:00Z'), day = 86400000;
  const ex = { old: { at: new Date(now - 130 * day).toISOString() }, fresh: { at: new Date(now - 10 * day).toISOString() } };
  assert.deepEqual(C.pruneKeys(ex, now), ['old']);
  const big = {}; for (let i = 0; i < C.KEEP_MAX + 3; i++) big['k' + i] = { at: new Date(now - (C.KEEP_MAX + 3 - i) * 60000).toISOString() };
  assert.deepEqual(C.pruneKeys(big, now).sort(), ['k0', 'k1', 'k2']);
});
test('★ 받은 함 줄은 화면이 쓸 만큼만 · https 가 아닌 주소는 버린다', () => {
  const r = C.toInbox({ no: 'A', src: '기업마당', nm: 'n', org: 'o', ntce: 't', openDt: '2026-10-01', closeDt: '2026-10-30', prc: '5', mthd: '', url: 'javascript:alert(1)', kw: '노무', secret: 'x' }, 'T');
  assert.equal(r.url, ''); assert.equal(r.prc, 5); assert.equal(r.at, 'T'); assert.equal('secret' in r, false);
  assert.equal(C.toInbox({ no: 'B', url: 'https://a.kr/x' }, 'T').url, 'https://a.kr/x');
});
test('★ 열쇠에 못 쓰는 글자(. # $ / [ ])는 «_» 로 — 번호 때문에 저장이 통째로 멈추면 안 된다', () => {
  assert.equal(C.safeKey('R26.BK/01#$[1]'), 'R26_BK_01___1_');
});

/* ── 등록 ── */
test('★ 예약 — 매일 07:40(서울), 컨설턴트 모집 감시(07:20) 뒤 · 비밀값을 묶지 않는다(키는 대표 자리에서 읽는다)', () => {
  const fn = INDEX.slice(INDEX.indexOf('exports.govFeedCollect'));
  assert.match(fn, /\.pubsub\.schedule\("every day 07:40"\)\s*\.timeZone\("Asia\/Seoul"\)/);
  assert.doesNotMatch(fn.slice(0, fn.indexOf('.onRun')), /secrets:/);
  assert.match(fn, /timeoutSeconds: 300/);
  assert.match(INDEX, /const GovFeedCollect = require\("\.\/gov-feed-collect"\)/);
});
