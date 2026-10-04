/* 정부사업신청 — 틀고정 + 📅 받은 범위 (대표 지시 2026-10-04 「틀고정」·「기간 표시 언제까지인지 기간 확인필요」)
   ═══════════════════════════════════════════════════════════════════════════
   ★ 지키는 것
     ① 머리줄과 탭이 «한 덩어리»(#head)로 붙는다 — 따로 붙이면 머리줄이 접힐 때 탭이 숨는다
     ② 목록 위에 «공고일 ~ · 마감은 ~까지 · 마지막으로 받은 때»를 보인다
     ③ 숨긴 공고도 범위에 센다 — 「전체 0건 · 숨김 32건」(대표 화면)에서 범위가 비면 안 된다
     ④ 「새로 받기」가 받은 때(last_at)·범위(last_win)를 남기고, 클라우드에도 싣는다
   gov.html 의 스크립트를 vm 에 올려 «실제로» 돌린다. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'gov.html'), 'utf8');

function FixedDate(now) {
  const Real = Date;
  function D(...a) { return a.length ? new Real(...a) : new Real(now); }
  D.now = () => new Real(now).getTime(); D.prototype = Real.prototype;
  return D;
}
function runApp(seed, opt) {
  opt = opt || {};
  const els = {};
  function el(id) {
    if (!els[id]) els[id] = { id, innerHTML: '', textContent: '', value: '', className: '',
      style: {}, classList: { add(){}, remove(){} } };
    return els[id];
  }
  const store = {};
  Object.keys(seed || {}).forEach((k) => {
    store['gov3_' + k] = typeof seed[k] === 'string' ? seed[k] : JSON.stringify(seed[k]); });
  const ctx = {
    console, setTimeout, clearTimeout, Math, JSON, String, Number, Object, Array, RegExp, Promise,
    Date: opt.Date || Date,
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
    document: { getElementById: el, createElement: () => ({ click(){}, style:{} }), addEventListener(){} },
    location: { protocol: 'https:' }, navigator: {},
    GovG2b: require('../js/gov-g2b.js'), GovCareer: require('../js/gov-career.js'),
    KcareerAdvSummary: require('../js/kcareer-adv-summary.js'), GovAlio: require('../js/gov-alio.js'),
    GovBizinfo: require('../js/gov-bizinfo.js'), GovRecruit: require('../js/gov-recruit.js'),
    GovSubmit: require('../js/gov-submit.js'), GovSync: require('../js/gov-sync.js'),
    firebase: undefined, fetch: opt.fetch || (() => Promise.reject(new Error('no net'))),
    AbortController: function(){ this.abort = () => {}; this.signal = null; },
    URL: { createObjectURL: () => 'blob:x', revokeObjectURL(){} }, Blob: function(){},
    prompt: () => null, confirm: () => true, open(){},
    TextDecoder, Uint8Array
  };
  ctx.window = ctx;
  const code = [...src.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
    .map((m) => m[1]).join('\n').replace(/\bboot\(\);\s*$/, '');
  vm.runInNewContext(code + '\n;globalThis.__api={draw,feedPeriod,periodHtml,fetchAll,cloudPush,'
    + 'toast:function(f){ toast=f; },setFb:function(db,uid){fbDb=db;fbUid=uid;}};', ctx);
  ctx.__api.toast(() => {});
  return { api: ctx.__api, el, store };
}

const FEED = [
  { id: 'G0001', src: '나라장터', nm: '노무관리 컨설팅 용역', org: '가', openDt: '2026-09-28 10:00', closeDt: '2026-10-12 18:00', type: '새 공고' },
  { id: 'G0002', src: '나라장터', nm: '조직진단 용역', org: '나', openDt: '2026-10-03 09:00', closeDt: '2026-10-20 17:00', type: '새 공고', hidden: true },
  { id: 'G0003', src: '알리오', nm: '경영평가위원 위촉', org: '다', openDt: '2026-09-21', closeDt: '2026-10-08', type: '새 공고', hidden: true },
  { id: 'G0004', src: '기업마당', nm: '날짜 없는 공고', org: '라', openDt: '', closeDt: '', type: '새 공고' }
];

test('★ 범위 셈 — 공고일 가장 이른 날 ~ 가장 늦은 날, 마감은 가장 늦은 날, 날짜 없는 줄은 건너뛴다', () => {
  const r = runApp({});
  const p = r.api.feedPeriod(FEED, '', '2026-10-04');
  assert.equal(p.from, '2026-09-21');
  assert.equal(p.to, '2026-10-03');
  assert.equal(p.closeTo, '2026-10-20');
  assert.equal(p.lastAt, '2026-10-04', '받은 때(시각)를 모르면 받은 날로');
  assert.equal(p.n, 4);
  const e = r.api.feedPeriod([], '', '');
  assert.equal(e.from, ''); assert.equal(e.lastAt, '');
});

test('★★ 「전체 0건 · 숨김 N건」이어도 범위가 보인다 — 숨긴 것도 센다 (대표 화면)', () => {
  const 다숨김 = FEED.map((x) => Object.assign({}, x, { hidden: true }));
  const r = runApp({ feed: 다숨김, last: '2026-10-04', last_at: '2026-10-04T06:20:00.000Z' }, { Date: FixedDate('2026-10-04T16:00:00') });
  r.api.draw();
  assert.match(r.el('cnt').textContent, /전체 0건 · 숨김 4건/);
  const h = r.el('period').innerHTML;
  assert.match(h, /공고일 <b>2026-09-21<\/b> ~ <b>2026-10-03<\/b>/);
  assert.match(h, /마감은 <b>2026-10-20<\/b>까지/);
  assert.match(h, /마지막으로 받은 때 <b>2026-10-04 \d\d:20<\/b>/);
  assert.match(h, /지난 7일치/, '나라장터가 7일치씩 온다는 것을 밝혀야 «언제까지»를 안다');
});

test('★ 받은 것이 하나도 없고 받은 적도 없으면 범위 줄을 비운다(빈 말을 늘어놓지 않는다)', () => {
  const r = runApp({});
  r.api.draw();
  assert.equal(r.el('period').innerHTML, '');
});

test('★★ 「새로 받기」가 받은 때·범위를 남긴다 — 그래야 다음에 «언제까지»를 말한다', async () => {
  const empty = { response: { header: { resultCode: '00', resultMsg: 'OK' }, body: { items: [], totalCount: 0, pageNo: 1, numOfRows: 999 } } };
  const r = runApp({ key_data: 'K', feed: FEED }, {
    Date: FixedDate('2026-10-04T15:20:00'),
    fetch: () => Promise.resolve({ json: () => Promise.resolve(empty) })
  });
  await r.api.fetchAll();
  assert.ok(r.store.gov3_last_at, 'last_at 을 남기지 않았다');
  assert.equal(new Date(r.store.gov3_last_at).getTime(), new Date('2026-10-04T15:20:00').getTime());
  assert.equal(r.store.gov3_last_win, '2026-09-27~2026-10-04', '나라장터에 물은 범위(지난 7일)');
  assert.match(r.el('period').innerHTML, /마지막으로 받은 때 <b>2026-10-04 15:20<\/b>/);
});

test('★ 받은 때를 클라우드에도 싣는다 — 다른 기기에서도 같은 범위를 말하게', async () => {
  const r = runApp({ last: '2026-10-04', last_at: '2026-10-04T06:20:00.000Z' });
  let 실은 = null;
  r.api.setFb({ ref: () => ({ update: (v) => { 실은 = Object.assign(실은 || {}, v); return Promise.resolve(); }, once: () => Promise.resolve({ val: () => null }) }) }, 'U1');
  r.api.cloudPush();
  await new Promise((ok) => setTimeout(ok, 2800));   /* 받기(1.2초) → 보내기(1.2초) */
  assert.ok(실은, '클라우드에 쓰지 않았다');
  assert.equal(실은.last_at, '2026-10-04T06:20:00.000Z');
  assert.ok(require('../js/gov-sync.js').field('last_at'), '받은 때가 합치기 칸 목록에 있어야 기기 사이로 간다');
});

test('★★ 틀고정 — 머리줄과 탭이 «한 덩어리»(#head)로 붙는다', () => {
  const body = src.slice(src.indexOf('<body>'));
  const head = body.indexOf('<div id="head">'), top = body.indexOf('<div id="top">'), tabs = body.indexOf('<div id="tabs">');
  const feed = body.indexOf('<div class="wrap" id="pgFeed">');
  assert.ok(head >= 0 && head < top && top < tabs && tabs < feed, '머리줄·탭이 #head 안에 차례로 있어야 한다');
  /* #head 가 닫힌 «뒤»에 본문이 온다 — 본문까지 #head 에 들어가면 화면 전체가 붙어 버린다 */
  const between = body.slice(tabs, feed);
  assert.equal((between.match(/<\/div>/g) || []).length, 2, '탭 줄과 #head 를 닫는 </div> 두 개');
  const css = src.slice(0, src.indexOf('</style>'));
  const rule = (sel) => { const m = new RegExp('(?:^|\\n)' + sel + '\\{([^}]*)\\}').exec(css); return m ? m[1] : ''; };
  assert.match(rule('#head'), /position:sticky/);
  assert.match(rule('#head'), /top:0/);
  assert.doesNotMatch(rule('#top'), /sticky/, '#top 이 따로 붙으면 탭과 어긋난다');
  assert.doesNotMatch(rule('#tabs'), /sticky/, '#tabs 가 따로 붙으면 머리줄이 접힐 때 숨는다');
});
