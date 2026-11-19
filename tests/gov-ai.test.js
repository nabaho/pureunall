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
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
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
  vm.runInNewContext(code + '\n;globalThis.__api={setTab,draw,lensDraw,lensDo,lensTog,lensBulk,lensGrp,get,recObj,rejudge,feedMainRows,pickRank,starAllItems,inboxPull,fetchAll,'
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
