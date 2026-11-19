/* 정부사업신청 — 🤖 AI 사업 탭 (대표 지시 2026-11-19 「ai 관련 사업 별도로 탭만들어달라」)
   ═══════════════════════════════════════════════════════════════════════════
   ★ 이 검사가 못 박는 규칙
     ① AI 갈래(GovG2b.judgeAi)는 대표가 붙여 준 사업(HR플랫폼·스마트서비스·AI/클라우드 바우처·스마트공장)과 넓은 AI 도입 지원을 잡고,
        「AI」 낱말만 있는 IT 용역·AI 컨설팅 용역·알리오 직원 채용은 안 잡는다.
     ② 받을 때 — 찾는 말에 안 걸려도 AI 갈래에 걸리면 버리지 않고 ai 표시를 붙여 담는다(나라장터·기업마당·서버 받은 함 모두).
     ③ «AI 로만 걸린 공고»는 🤖 탭에만 — 공고 모아보기·📍 지역 탭·🎯 추천·CSV 에는 안 섞는다. ai 표시 없는 줄은 절대 안 뺀다.
     ④ 재판정(rejudge)은 AI 줄을 숨기지 않는다(처음 붙일 때만 알린다). 기계가 숨겼던 AI 줄은 되살려 🤖 탭으로.
     ⑤ 🤖 탭은 📍 탭과 «한 벌»(lens*) — 탭 전환·고르기·★ 가 같은 길로 돈다. 서버 모집 글도 AI 쪽 게시판·기관·제목이면 들어온다.
     ⑥ 기업마당 «기술» 분야를 전국 길로 더 받는다 · 서버 사본(functions/vendor)은 js/ 와 같다(functions/gov-feed-collect.test.js).
   실행: node --test tests/gov-ai.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const G = require('../js/gov-g2b.js');
const A = require('../js/gov-ai.js');
const I = require('../js/gov-inbox.js');
const B = require('../js/gov-bizinfo.js');
const src = fs.readFileSync(path.join(__dirname, '..', 'gov.html'), 'utf8');
const watchSrc = fs.readFileSync(path.join(__dirname, '..', 'functions', 'recruit-watch.js'), 'utf8');
const recruitSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'gov-recruit.js'), 'utf8');

/* ───────── ① 갈래 규칙 ───────── */
test('★★★ 대표가 붙여 준 사업 넷 + AI 도입 지원은 잡는다', () => {
  const j = (nm, extra) => G.judgeAi(Object.assign({ nm }, extra || {}));
  assert.deepEqual(j('2027년 영세사업장 인사노무관리체계 구축 지원사업 공급기업 모집'), ['hr']);
  assert.deepEqual(j('2027년 중소기업 스마트서비스 지원사업 공고'), ['smart']);
  assert.deepEqual(j('2027년 AI바우처 지원사업 공급기업 등록 안내'), ['voucher'], '좁은 갈래가 걸리면 넓은 갈래(ai)는 겹쳐 안 붙인다');
  assert.deepEqual(j('클라우드서비스 보급·확산 사업 공급기업 모집'), ['voucher']);
  assert.deepEqual(j('2027 데이터바우처 지원사업 수요기업 모집'), ['voucher']);
  assert.deepEqual(j('2027년 스마트공장 구축 및 고도화 지원사업 공고'), ['factory']);
  assert.deepEqual(j('제조AI 특화 스마트제조 혁신 지원사업'), ['factory']);
  assert.deepEqual(j('2027년 소상공인 AI 도입 지원사업 참여기업 모집'), ['ai']);
  assert.deepEqual(j('중소기업 AX 전환 지원사업 공고'), ['ai']);
  assert.deepEqual(j('지역 중소기업 디지털 전환 지원사업'), ['ai']);
  assert.deepEqual(j('2027 비대면 서비스 지원', { src: '기업마당', tags: '인공지능,바우처' }), ['voucher'], '기업마당은 해시태그까지 본다');
});

test('★★★ 「AI」 낱말만 있는 IT 용역·AI 컨설팅 용역·직원 채용은 안 잡는다', () => {
  const j = (nm, extra) => G.judgeAi(Object.assign({ nm }, extra || {}));
  ['AI 기반 하천 수위 감시 CCTV 구축 용역', 'KDB AI 거버넌스 수립 컨설팅', '스마트폰 앱 유지관리 용역', '2027년 인사제도 개선 컨설팅',
    'MAINTAIN 시스템 고도화', '태국(Thai) 진출 지원사업']
    .forEach((nm) => assert.deepEqual(j(nm), [], nm));
  assert.deepEqual(j('AI 바우처 사업 계약직 채용', { src: '알리오' }), [], '알리오 직원 채용은 사업이 아니다');
  assert.deepEqual(j(''), []);
});

/* ───────── ② 받을 때 ───────── */
test('★★★ 합칠 때 — 찾는 말에 안 걸려도 AI 갈래면 담고(kw 비고 ai 표시), 찾는 말 줄에도 AI 갈래면 표시를 단다', () => {
  const m = G.merge([], [
    { src: '나라장터', no: 'R1-000', nm: '2027년 AI바우처 지원사업 운영 용역' },
    { src: '나라장터', no: 'R2-000', nm: '2026년 직원 근무평정 대행 용역' },
    { src: '나라장터', no: 'R3-000', nm: 'AI 기반 하천 감시 시스템 구축' },
    { src: '기업마당', no: 'PBLN_1', nm: '영세사업장 인사노무관리체계 구축 지원사업' }
  ], G.KEYWORDS_DEFAULT, '2026-11-19');
  const by = Object.fromEntries(m.adds.map((r) => [r.no, r]));
  assert.deepEqual(Object.keys(by).sort(), ['PBLN_1', 'R1-000', 'R2-000']);
  assert.equal(by['R1-000'].kw, ''); assert.equal(by['R1-000'].ai, 'voucher');
  assert.equal(by['R2-000'].ai, undefined, '노무 공고에는 AI 표시가 없다');
  assert.ok(by['PBLN_1'].kw.length > 0, '노무 말에도 걸린다'); assert.equal(by['PBLN_1'].ai, 'hr');
  assert.equal(m.unmatched, 1, 'AI 기반 하천 감시는 버린다');
});

test('★★ 서버 받은 함 — ai 표시를 데려간다 · 기업마당 «기술» 분야를 더 받는다', () => {
  const m = I.merge([], { a: { no: 'X1', nm: 'AI바우처 공급기업 모집', src: '기업마당', kw: '', ai: 'voucher', at: '2026-11-19T00:00:00Z' } }, {});
  assert.equal(m.adds[0].ai, 'voucher');
  assert.ok(B.FIELDS_AI.includes('02'), '기술 분야');
  assert.ok(!B.FIELDS_DEFAULT.includes('02'), '찾는 말 쪽 분야(인력·경영)는 그대로');
});

/* ───────── ③④⑤ 화면에서 «실제로» ───────── */
function FixedDate(now) {
  const Real = Date;
  function D(...a) { return a.length ? new Real(...a) : new Real(now); }
  D.now = () => new Real(now).getTime(); D.prototype = Real.prototype; D.parse = Real.parse; D.UTC = Real.UTC;
  return D;
}
function runApp(seed, opt) {
  opt = opt || {};
  const els = {}, toasts = [], urls = [];
  function el(id) {
    if (!els[id]) els[id] = { id, innerHTML: '', textContent: '', value: '', className: '', checked: false, title: '',
      style: {}, classList: { add(){}, remove(){} } };
    return els[id];
  }
  const store = {};
  Object.keys(seed || {}).forEach((k) => { store['gov3_' + k] = typeof seed[k] === 'string' ? seed[k] : JSON.stringify(seed[k]); });
  const ctx = {
    console, setTimeout, clearTimeout, Math, JSON, String, Number, Object, Array, RegExp, Promise,
    Date: FixedDate('2026-11-19T10:00:00'),
    localStorage: { getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { if (opt.lsFail && opt.lsFail.test(k)) { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; } store[k] = String(v); } },
    document: { getElementById: el, createElement: () => ({ click(){}, style:{} }), addEventListener(){} },
    location: { protocol: 'https:' }, navigator: {},
    GovG2b: G, GovPlan: require('../js/gov-plan.js'), GovCareer: require('../js/gov-career.js'),
    KcareerAdvSummary: require('../js/kcareer-adv-summary.js'), GovAlio: require('../js/gov-alio.js'),
    GovBizinfo: B, GovRecruit: require('../js/gov-recruit.js'),
    GovSubmit: require('../js/gov-submit.js'), GovMatch: require('../js/gov-match.js'), GovOrgRec: require('../js/gov-orgrec.js'),
    GovInbox: I, GovPick: require('../js/gov-pick.js'), GovSync: require('../js/gov-sync.js'),
    GovRegion: require('../js/gov-region.js'), GovAi: A,
    firebase: undefined, fetch: () => Promise.reject(new Error('no net')),
    AbortController: function(){ this.abort = () => {}; this.signal = null; },
    URL: { createObjectURL: () => 'blob:x', revokeObjectURL(){} }, Blob: function(){},
    prompt: () => null, confirm: () => true, open: () => null,
    screen: { availWidth: 1600, availHeight: 900 }, TextDecoder, Uint8Array
  };
  ctx.window = ctx;
  const code = [...src.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
    .map((m) => m[1]).join('\n').replace(/\bboot\(\);\s*$/, '');
  vm.runInNewContext(code + '\n;globalThis.__api={setTab,draw,lensDraw,lensDo,lensTog,lensBulk,lensGrp,lensSub,aiBackfill,aiBackStop,starGo,get,recObj,rejudge,feedMainRows,pickRank,starAllItems,inboxPull,fetchAll,'
    + 'setBackMonths:function(m){ _aiBack.months=m; },'
    + 'getSel:function(id){ return _lens[id].sel; },setWatch:function(w){ _recWatch=w; },setFb:function(db,uid){ fbDb=db; fbUid=uid; },'
    + 'setPull:function(f){ pull=f; },toast:function(f){ toast=f; }};', ctx);
  ctx.__api.toast((m) => toasts.push(m));
  return { api: ctx.__api, el, store, toasts, urls };
}
const FEED = [
  { id: 'G0001', src: '나라장터', type: '새 공고', nm: '2027년 AI바우처 지원사업 운영 용역', org: '정보통신산업진흥원', closeDt: '2026-11-30 18:00', savedAt: '2026-11-18T09:00:00Z', kw: '', ai: 'voucher' },
  { id: 'G0002', src: '나라장터', type: '새 공고', nm: '대전광역시 노무관리 컨설팅 용역', org: '대전광역시', closeDt: '2026-11-28 18:00', savedAt: '2026-11-18T09:00:00Z', kw: '노무' },
  { id: 'G0003', src: '기업마당', type: '새 공고', nm: '영세사업장 인사노무관리체계 구축 지원사업', org: '고용노동부', closeDt: '2026-12-10', savedAt: '2026-11-18T09:00:00Z', kw: '노무,인사', ai: 'hr' },
  { id: 'G0004', src: '나라장터', type: '새 공고', nm: '대전 스마트공장 구축 지원사업 운영 용역', org: '대전테크노파크', closeDt: '2026-12-05 18:00', savedAt: '2026-11-18T09:00:00Z', kw: '', ai: 'factory' }
];
const WATCH = { hits: {
  v1: { key: 'v1', board: 'voucher', boardName: '데이터산업진흥원 알림', title: '2027 데이터 공급기업 풀 평가위원 모집', date: '2026-11-17', href: 'https://example.com/v1', per: { to: '2026-11-29' } },
  a1: { key: 'a1', board: 'nosa', boardName: '노사발전재단', title: '2027 AX 전환 지원사업 컨설턴트 모집', date: '2026-11-16', href: 'https://example.com/a1', per: { to: '2026-12-01' } },
  n1: { key: 'n1', board: 'nosa', boardName: '노사발전재단', title: '일터혁신 컨설턴트 모집', date: '2026-11-16', href: 'https://example.com/n1' }
}, last: { at: Date.now() } };
const rowsOf = (h) => (h.match(/<tr class="rr/g) || []).length;

test('★★★ 탭이 있고(폰에서는 「AI」 글만), 열면 이 화면만 보인다', () => {
  const tb = (src.match(/<button class="tb" id="tbAi" onclick="setTab\('ai'\)"[^>]*>([\s\S]*?)<\/button>/) || [])[1];
  assert.ok(tb, '🤖 탭 단추가 없다');
  assert.equal(tb.replace(/<[^>]+>/g, ''), '🤖 AI 사업', 'PC 에서 읽히는 탭 이름');
  assert.equal(tb.replace(/<span class="mx">[^<]*<\/span>/g, ''), 'AI', '폰(.mx 숨음)에서는 「AI」');
  assert.match(src, /<script src="js\/gov-ai\.js\?v=\d+"><\/script>/);
  const r = runApp({ feed: FEED });
  r.api.setTab('ai');
  assert.equal(r.el('pgAi').style.display, ''); assert.equal(r.el('pgRgn').style.display, 'none'); assert.equal(r.el('pgFeed').style.display, 'none');
  assert.match(r.el('tbAi').className, /\bon\b/);
  r.api.setTab('feed'); assert.equal(r.el('pgAi').style.display, 'none');
});

test('★★★ «AI 로만 걸린 공고»는 🤖 탭에만 — 공고 모아보기·📍 지역 탭·🎯 추천에는 안 섞는다', () => {
  const r = runApp({ feed: FEED });
  r.api.setWatch(WATCH);
  const main = r.api.feedMainRows().map((x) => x.id);
  assert.deepEqual(main, ['G0002', 'G0003'], 'AI 로만 걸린 G0001·G0004 는 빠지고, 노무 말에도 걸린 G0003 은 남는다');
  r.api.draw();
  assert.doesNotMatch(r.el('tb').innerHTML, /AI바우처|스마트공장/);
  assert.match(r.el('cnt').textContent, /전체 2건/);
  r.api.setTab('rgn');
  assert.doesNotMatch(r.el('rgnTb').innerHTML, /스마트공장/, '대전 공고라도 AI 로만 걸린 것은 📍 탭에 안 섞는다');
  assert.match(r.el('rgnTb').innerHTML, /대전광역시 노무관리/);
  assert.ok(!r.api.pickRank().items.some((x) => /AI바우처|스마트공장/.test(x.title)), '🎯 추천에도 안 섞는다');
  r.api.setTab('ai');
  const h = r.el('aiTb').innerHTML;
  assert.match(h, /AI바우처 지원사업/); assert.match(h, /스마트공장 구축/); assert.match(h, /인사노무관리체계/, '노무 말에도 걸린 AI 공고는 두 곳 모두에');
  assert.doesNotMatch(h, /대전광역시 노무관리/, 'AI 와 무관한 노무 공고는 🤖 탭에 안 온다');
  assert.match(h, /데이터 공급기업 풀 평가위원/, 'AI 사업 쪽 게시판(데이터바우처)의 모집 글');
  assert.match(h, /AX 전환 지원사업 컨설턴트/, '전국 게시판이라도 제목이 AI 갈래면');
  assert.doesNotMatch(h, />일터혁신 컨설턴트 모집</);
  assert.equal(rowsOf(h), 5);
  assert.match(r.el('aiChips').innerHTML.replace(/<span class="mx">[^<]*<\/span>/g, ''), /AI·클라우드 바우처 <span class="n">2<\/span>/);
  r.api.lensGrp('ai', 'factory');
  assert.equal(rowsOf(r.el('aiTb').innerHTML), 1);
});

test('★★★ ai 표시가 없는 줄은 절대 안 뺀다 — 짐작으로 숨기면 공고가 사라진다', () => {
  const r = runApp({ feed: [{ id: 'G0009', src: '나라장터', type: '새 공고', nm: '옛 줄 — 낱말이 바뀌어 지금은 안 걸리는 용역', kw: '' }] });
  assert.deepEqual(r.api.feedMainRows().map((x) => x.id), ['G0009']);
});

test('★★ ★·고르기는 📍 탭과 같은 길 — 공고 별은 상태 「관심」, 별표 모음에서는 🤖 칸으로 따로', () => {
  const r = runApp({ feed: FEED });
  r.api.setWatch(WATCH); r.api.setTab('ai');
  r.api.lensDo('f:G0001', 'star');
  assert.equal(r.api.get('feed').find((x) => x.id === 'G0001').type, '관심');
  const S = r.api.starAllItems();
  assert.deepEqual(S.ai.map((x) => x.id), ['G0001']); assert.equal(S.feed.length, 0, 'AI 로만 걸린 별은 「공고 모아보기」 칸에 안 넣는다');
  r.api.lensTog('ai', 'f:G0004', true);
  assert.match(r.el('aiSel').innerHTML, /<b>1건<\/b> 선택/);
  r.api.setTab('feed');
  assert.equal(Object.keys(r.api.getSel('ai')).length, 0, '화면을 떠나면 고른 것을 비운다');
});

test('★★★ 재판정 — AI 줄은 숨기지 않는다(처음 붙일 때만 알림) · 기계가 숨겼던 AI 줄은 되살려 🤖 탭으로', () => {
  const r = runApp({ feed: [
    { id: 'G1', src: '나라장터', no: 'R1', nm: '2027년 AI바우처 지원사업 운영 용역', type: '새 공고', kw: '', ai: 'voucher' },
    { id: 'G2', src: '나라장터', no: 'R2', nm: '중소기업 AX 전환 지원사업 운영', type: '새 공고', kw: '컨설팅' },
    { id: 'G3', src: '나라장터', no: 'R3', nm: '2027년 스마트공장 구축 지원사업', type: '새 공고', hidden: true, ruleOut: true },
    { id: 'G4', src: '나라장터', no: 'R4', nm: '청사 청소 용역', type: '새 공고' }
  ] });
  assert.equal(r.api.rejudge(), 1, '숨기는 것은 AI 와 무관한 청소 용역 하나');
  const f = JSON.parse(r.store.gov3_feed), by = Object.fromEntries(f.map((x) => [x.id, x]));
  assert.ok(!by.G1.hidden && !by.G2.hidden && !by.G3.hidden && by.G4.hidden);
  assert.equal(by.G2.ai, 'ai', '처음 AI 표시를 붙인다'); assert.equal(by.G3.ai, 'factory');
  assert.ok(r.toasts.some((t) => /🤖 AI 사업 탭/.test(t)));
  r.toasts.length = 0;
  assert.equal(r.api.rejudge(), 0);
  assert.ok(!r.toasts.length, '두 번째부터는 조용히(멱등)');
});

test('★★ 서버 받은 함에서 — AI 갈래만 걸린 줄도 합치고 ai 표시를 붙인다', async () => {
  const r = runApp({ feed: [] });
  const rows = { k1: { no: 'S1', nm: '2027 데이터바우처 지원사업 공급기업 모집', src: '기업마당', kw: '', at: '2026-11-19T00:00:00Z' },
    k2: { no: 'S2', nm: '청사 경비 용역', src: '나라장터', kw: '', at: '2026-11-19T00:00:00Z' } };
  r.api.setFb({ ref: () => ({ once: () => Promise.resolve({ val: () => ({ rows }) }) }) }, 'U1');
  await r.api.inboxPull();
  const f = r.api.get('feed');
  assert.deepEqual(f.map((x) => x.no), ['S1']); assert.equal(f[0].ai, 'voucher');
});

test('★★ 새로 받기 — 기업마당 «기술» 분야를 전국 길로 한 번 더 부른다', async () => {
  const r = runApp({ feed: [], key_biz: 'K' });
  const urls = [];
  r.api.setPull(async (u) => { urls.push(u); return { jsonArray: [] }; });
  await r.api.fetchAll();
  assert.ok(urls.some((u) => /searchLclasId=02/.test(u) && !/hashtags=/.test(u)), '기술 분야(02) 전국 길: ' + urls.join('\n'));
});

/* ═════════ 📁 지난 공고 (대표 지시 2026-11-19 「AI 관련 이미 지난것도 올려달라 그래야 비교 분석 가능하다 지난것 별도 하위 탭으로」) ═════════ */
test('★★★ 나라장터 오류 묶음(ResponseError)은 «오류»다 «0건»이 아니다 — 03(데이터 없음)만 빈 결과', () => {
  const e07 = G.parse({ 'nkoneps.com.response.ResponseError': { header: { resultCode: '07', resultMsg: '입력범위값 초과 에러' } } });
  assert.equal(e07.ok, false); assert.match(e07.err, /입력범위값 초과/); assert.match(e07.err, /07/);
  const e03 = G.parse({ 'nkoneps.com.response.ResponseError': { header: { resultCode: '03', resultMsg: '데이터 없음' } } });
  assert.equal(e03.ok, true); assert.deepEqual(e03.rows, []);
});
test('★★★ 한 번에 «오늘 포함 7일»만 묻는다(2026-11-10 부터 7일 제한) · 몰아 받을 때도 7일 창으로 자른다', () => {
  const to = new Date('2026-11-19T10:00:00+09:00');
  const u = G.buildUrl({ key: 'K', from: G.recentFrom(to), to, page: 1 });
  assert.match(u, /inqryBgnDt=202611130000/); assert.match(u, /inqryEndDt=202611192359/);
  const from = new Date('2026-08-19T10:00:00+09:00'), ws = G.weekWindows(from, to);
  const ymd = (d) => new Date(d.getTime() + 9 * 3600e3).toISOString().slice(0, 10);
  const span = (w) => Math.round((Date.parse(ymd(w[1])) - Date.parse(ymd(w[0]))) / 864e5) + 1;
  assert.ok(ws.length >= 13);
  ws.forEach((w) => assert.ok(span(w) <= 7, '창이 7일을 넘는다: ' + ymd(w[0]) + '~' + ymd(w[1])));
  assert.equal(ymd(ws[0][1]), '2026-11-19', '최근 창부터'); assert.equal(ymd(ws[ws.length - 1][0]), '2026-08-19', '고른 첫날까지 덮는다');
  for (let i = 1; i < ws.length; i++) assert.equal(Math.round((Date.parse(ymd(ws[i - 1][0])) - Date.parse(ymd(ws[i][1]))) / 864e5), 1, '창 사이에 빈 날·겹친 날이 없다');
});
test('★★ 기업마당 쪽 넘기기 주소 — 전체(searchCnt 없음) + pageUnit·pageIndex', () => {
  const u = B.buildUrl({ key: 'K', count: 0, pageUnit: 500, pageIndex: 2 });
  assert.doesNotMatch(u, /searchCnt=/); assert.match(u, /pageUnit=500/); assert.match(u, /pageIndex=2/);
});

const PAST_FEED = [
  { id: 'G0101', src: '나라장터', type: '지나감', nm: '2026년 AI바우처 지원사업 운영 용역', org: '정보통신산업진흥원', openDt: '2026-03-02 10:00:00', closeDt: '2026-03-20 18:00', kw: '', ai: 'voucher' },
  { id: 'G0102', src: '기업마당', type: '새 공고', nm: '2025 스마트공장 구축 지원사업 공고', org: '중소벤처기업부', openDt: '2025-05-01', closeDt: '', kw: '', ai: 'factory' },
  { id: 'G0103', src: '기업마당', type: '새 공고', nm: '중소기업 스마트서비스 지원사업(상시)', org: '중소벤처기업부', openDt: '2026-11-10', closeDt: '', kw: '', ai: 'smart' },
  { id: 'G0104', src: '나라장터', type: '새 공고', nm: '2027년 AI바우처 지원사업 운영 용역', org: '정보통신산업진흥원', openDt: '2026-11-15 10:00:00', closeDt: '2026-11-30 18:00', kw: '', ai: 'voucher' }
];
test('★★★ 하위 탭 — 🟢 진행 중 / 📁 지난 공고로 가르고, 지난 공고에는 공고일 기준 «해마다 몇 건»', () => {
  const r = runApp({ feed: PAST_FEED });
  r.api.setTab('ai');
  assert.match(r.el('aiSubs').innerHTML, /🟢 진행 중 <span class="n">2<\/span>/); assert.match(r.el('aiSubs').innerHTML, /📁 지난 공고 <span class="n">2<\/span>/);
  let h = r.el('aiTb').innerHTML;
  assert.match(h, /2027년 AI바우처/); assert.match(h, /스마트서비스 지원사업\(상시\)/, '마감 모름이라도 공고한 지 90일 안이면 진행 중');
  assert.doesNotMatch(h, /2026년 AI바우처|2025 스마트공장/);
  assert.equal(r.el('aiPast').innerHTML, '', '진행 중에는 지난 공고 칸이 없다');
  r.api.lensSub('ai', 'past');
  h = r.el('aiTb').innerHTML;
  assert.match(h, /2026년 AI바우처/); assert.match(h, /2025 스마트공장/, '마감 모름 + 공고한 지 90일 넘음 → 지난 공고');
  assert.match(h, /마감 모름 · 공고 \d+일 지남/, '마감일을 지어내지 않고 밝힌다');
  assert.doesNotMatch(h, /2027년 AI바우처/);
  assert.match(h, /<td class="rdt sml">2026-03-02<\/td>/, '날짜 칸은 공고일');
  assert.match(r.el('aView').innerHTML, /value="past"/); assert.doesNotMatch(r.el('aView').innerHTML, /value="live"/, '지난 공고에는 «마감 안 지난 것» 보기가 없다');
  const past = r.el('aiPast').innerHTML;
  assert.match(past, /공고일 기준.*2026년 <b>1<\/b>건 · 2025년 <b>1<\/b>건/);
  assert.match(past, /📥 불러오기/);
  assert.equal(r.store.gov3_ai_sub, 'past', '고른 하위 탭은 이 기기에서 기억한다');
  r.api.lensSub('ai', 'live');
  assert.match(r.el('aView').innerHTML, /value="live"/);
});

/* 가짜 나라장터·기업마당 — 창(inqryBgnDt)마다 AI 공고 1 + 무관 공고 1 */
const g2bOf = (u) => { const d = (u.match(/inqryBgnDt=(\d{8})/) || [])[1];
  return { response: { header: { resultCode: '00' }, body: { totalCount: 2, items: [
    { bidNtceNo: 'AI' + d, bidNtceOrd: '000', bidNtceNm: d.slice(0, 4) + '년 AI바우처 지원사업 운영 용역', ntceInsttNm: '정보통신산업진흥원', bidNtceDt: d.slice(0, 4) + '-' + d.slice(4, 6) + '-' + d.slice(6) + ' 10:00:00', bidClseDt: '2026-10-01 10:00' },
    { bidNtceNo: 'CL' + d, bidNtceOrd: '000', bidNtceNm: '청사 청소 용역', ntceInsttNm: '가', bidNtceDt: '2026-10-01 10:00:00', bidClseDt: '2026-10-05 10:00' }] } } }; };
const BIZ = { jsonArray: [
  { pblancId: 'PBLN_9001', pblancNm: '2025 스마트공장 구축 지원사업 공고', jrsdInsttNm: '중소벤처기업부', creatPnttm: '2025-05-01 09:00:00', reqstBeginEndDe: '2025-05-01 ~ 2025-05-31' },
  { pblancId: 'PBLN_9002', pblancNm: '소상공인 경영 교육 수강생 모집', jrsdInsttNm: '가', creatPnttm: '2025-06-01 09:00:00' }] };

test('★★★ 📥 지난 공고 불러오기 — 7일 창마다 받아 AI 갈래만 담고(r.back), 노무 쪽 목록에는 안 섞는다 · 받은 주는 다음에 건너뛴다', async () => {
  const r = runApp({ feed: [], key_data: 'K', key_biz: 'B' });
  const urls = [];
  r.api.setPull(async (u) => { urls.push(u); return /bizinfo/.test(u) ? BIZ : g2bOf(u); });
  r.api.setBackMonths(1);
  await r.api.aiBackfill();
  const g2b = urls.filter((u) => /BidPublicInfoService/.test(u));
  assert.ok(g2b.length >= 4 && g2b.length <= 6, '한 달 = 7일 창 다섯 안팎: ' + g2b.length);
  assert.ok(urls.some((u) => /bizinfo/.test(u) && /pageIndex=1/.test(u) && !/searchCnt=/.test(u)), '기업마당은 전체를 쪽으로');
  const f = r.api.get('feed');
  assert.ok(f.length === g2b.length + 1, 'AI 공고만(창마다 1 + 기업마당 1): ' + f.length);
  assert.ok(f.every((x) => x.back === 1 && x.ai), '몰아 받은 줄 표시(back)와 AI 갈래');
  assert.ok(!f.some((x) => /청소|경영 교육/.test(x.nm)), 'AI 와 무관한 공고는 안 담는다');
  assert.deepEqual(r.api.feedMainRows(), [], '공고 모아보기·📍·🎯 에는 안 섞는다');
  const info = JSON.parse(r.store.gov3_ai_back);
  assert.equal(Object.keys(info.weeks).length, g2b.length); assert.equal(info.adds, f.length);
  assert.ok(r.toasts.some((t) => /지난 AI 공고 \d+건을 담았습니다/.test(t)));
  /* 다시 누르면 — 받은 주는 건너뛰고(나라장터 0회), 이미 있는 공고는 두 번 안 담는다 */
  urls.length = 0;
  await r.api.aiBackfill();
  assert.equal(urls.filter((u) => /BidPublicInfoService/.test(u)).length, 0);
  assert.equal(r.api.get('feed').length, f.length);
  r.api.setTab('ai'); r.api.lensSub('ai', 'past');
  assert.match(r.el('aiTb').innerHTML, /2025 스마트공장/);
});

test('★★ 불러오다 오류(열쇠·한도·기간)면 멈추고 «받은 주»로 적지 않는다 — 다음에 다시 받는다', async () => {
  const r = runApp({ feed: [], key_data: 'K' });
  let n = 0;
  r.api.setPull(async () => { n++; return { 'nkoneps.com.response.ResponseError': { header: { resultCode: '22', resultMsg: '서비스 요청제한횟수 초과에러' } } }; });
  r.api.setBackMonths(3);
  await r.api.aiBackfill();
  assert.equal(n, 1, '첫 창에서 멈춘다');
  assert.deepEqual(JSON.parse(r.store.gov3_ai_back).weeks, {});
  assert.ok(r.toasts.some((t) => /요청제한횟수/.test(t)));
});

test('★★ 저장 공간이 모자라 못 담았으면 «받은 주»도 안 적는다 — 다음에 그 주를 다시 받는다(2026-11-19 검토 낮음)', async () => {
  const r = runApp({ feed: [], key_data: 'K' }, { lsFail: /^gov3_feed$/ });
  r.api.setPull(async (u) => g2bOf(u));
  r.api.setBackMonths(1);
  await r.api.aiBackfill();
  assert.deepEqual(JSON.parse(r.store.gov3_ai_back).weeks, {});
  assert.ok(r.toasts.some((t) => /저장 공간이 모자라/.test(t)));
});
test('★ 🤖 탭을 한 번도 안 열었어도 별표 모음 → 「이 탭에서 별표만 보기」가 별표 보기로 연다(2026-11-19 검토 낮음)', () => {
  const r = runApp({ feed: FEED });
  r.api.starGo('ai');
  assert.equal(r.el('aView').value, 'star');
  assert.equal(r.el('pgAi').style.display, '');
});

/* ───────── 맞물림 ───────── */
test('★★ 서버 게시판·기관 번호는 서버·사전에 있다 — 바꾸면 여기도', () => {
  Object.keys(A.BOARD_AI).forEach((id) => assert.match(watchSrc, new RegExp("id: '" + id + "'"), '서버 게시판 ' + id));
  Object.keys(A.ORG_AI).forEach((id) => assert.match(recruitSrc, new RegExp("id: '" + id + "'"), '기관 사전 ' + id));
});
test('★ 폰에서 🤖 탭의 「표시」 글자도 숨는다 · 찾는 말을 바꿀 때 AI 안내를 다른 알림으로 덮지 않는다(2026-11-19 검토 낮음)', () => {
  assert.match(src, /#aPerBox label[^{]*\{font-size:0\}|#aPerBox label\{font-size:0\}/);
  const kc = src.slice(src.indexOf('function kwChanged'), src.indexOf('function kwTog'));
  assert.match(kc, /!rejudge\.last\.ai/);
});
test('★ 태블릿 — 🤖 표도 최소 폭 ≥ 고정 칸 합 + 제목 자리', () => {
  const page = src.slice(src.indexOf('<div class="wrap lens" id="pgAi"'), src.indexOf('id="aiTb"'));
  const fixed = [...page.matchAll(/<col style="width:(\d+)px">/g)].map((m) => Number(m[1]));
  assert.ok(fixed.length >= 8);
  const m = src.match(/@media \(min-width:(\d+)px\)\{\s*\.lens \.rec-fixed\{min-width:(\d+)px\}\s*\}/);
  assert.ok(m && Number(m[2]) >= fixed.reduce((a, b) => a + b, 0) + 150);
});
