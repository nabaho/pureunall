'use strict';
/* 정부사업신청 — 폰 한 화면 (대표 지시 2026-10-17 「정부사업신청 폰화면에서 한화면에서보게 정리해」)

   무슨 일이 있었나
   공고 표가 13칸(902px)이라 폰(384px)에서는 옆으로 밀어야 했고, 공고명은 「[공…」 두 글자만 보였다.
   머리·탭(글자가 두 줄로 접힘)·거르개(다섯 줄)·찾는 말(네 줄)이 첫 화면을 다 먹었다.

   지키는 것
   ① PC 는 그대로 — 폰 조각(.m-only)은 넓은 화면에서 숨고, 바꾸는 규칙은 640px 이하에만 산다
   ② 폰에서 표 줄은 «두 줄 카드»가 되고 ★·☐·№·이름 칸만 남는다 — ☐·№ 는 절대 숨기지 않는다(자료 목록 규칙)
   ③ 둘째 줄은 «말을 하는 값»만 — 없는 기관·금액·마감, 「새 공고」 같은 기본 상태는 그리지 않는다
   ④ 거르개는 세 줄 — ① 검색·별표 ② 거르개 ③ 건수·표시·받기 (줄 끊기는 ::before·::after)
   ⑤ 떠 있는 「즐겨찾기」 손잡이는 폰에서 숨고 머리 ⭐ 가 같은 목록을 연다 — 열린 채 누르면 닫힌다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'gov.html'), 'utf8');
const CSS = src.slice(0, src.indexOf('</style>'));
const MARK = '폰 한 화면 (대표 지시 2026-10-17';
const bare = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '');

/* 표시 뒤 첫 «@media (max-width:640px){» 덩이 — 주석은 걷는다(설명 글자에 걸려 초록이 되지 않게) */
function phoneBlock() {
  const at = CSS.indexOf(MARK);
  assert.ok(at > 0, '폰 한 화면 덩이를 찾지 못했습니다');
  const mq = CSS.indexOf('@media (max-width:640px){', at);
  assert.ok(mq > 0, '폰 한 화면 규칙이 640px 이하 매체 질의 안에 있지 않습니다');
  let d = 0, i = CSS.indexOf('{', mq);
  for (; i < CSS.length; i++) { if (CSS[i] === '{') d++; else if (CSS[i] === '}') { d--; if (!d) break; } }
  return { head: bare(CSS.slice(CSS.lastIndexOf('/*', at), mq)), body: bare(CSS.slice(CSS.indexOf('{', mq) + 1, i)) };
}
/* 덩이 안 규칙을 [선택자 목록, 몸통] 으로 */
function rules(body) {
  return [...body.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ sel: m[1].trim().split(',').map((s) => s.trim()), body: m[2] }));
}
function orderOf(R, want) {
  const r = R.find((x) => x.sel.some((s) => want.test(s)) && /order:\d+/.test(x.body));
  assert.ok(r, '순서(order)가 없습니다: ' + want);
  return Number(/order:(\d+)/.exec(r.body)[1]);
}

function runApp(seed) {
  const els = {};
  function el(id) {
    if (!els[id]) els[id] = { id, innerHTML: '', textContent: '', value: '', className: '', title: '',
      style: {}, classList: { add(){}, remove(){} } };
    return els[id];
  }
  const store = {};
  Object.keys(seed || {}).forEach((k) => { store['gov3_' + k] = typeof seed[k] === 'string' ? seed[k] : JSON.stringify(seed[k]); });
  const ctx = {
    console, setTimeout, clearTimeout, Math, JSON, Date, String, Number, Object, Array, RegExp, Promise,
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
    document: { getElementById: el, createElement: () => ({ click(){}, style:{} }), addEventListener(){}, querySelector: () => null },
    location: { protocol: 'https:' }, navigator: {},
    GovG2b: require('../js/gov-g2b.js'), GovPlan: require('../js/gov-plan.js'), GovCareer: require('../js/gov-career.js'),
    KcareerAdvSummary: require('../js/kcareer-adv-summary.js'), GovAlio: require('../js/gov-alio.js'),
    GovBizinfo: require('../js/gov-bizinfo.js'), GovRecruit: require('../js/gov-recruit.js'),
    GovSubmit: require('../js/gov-submit.js'), GovMatch: require('../js/gov-match.js'), GovOrgRec: require('../js/gov-orgrec.js'),
    GovInbox: require('../js/gov-inbox.js'), GovSync: require('../js/gov-sync.js'),
    firebase: undefined, fetch: () => Promise.reject(new Error('no net')),
    AbortController: function(){ this.abort = () => {}; this.signal = null; },
    URL: { createObjectURL: () => 'blob:x', revokeObjectURL(){} }, Blob: function(){},
    prompt: () => null, confirm: () => true, open(){}
  };
  ctx.window = ctx;
  const code = [...src.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
    .map((m) => m[1]).join('\n').replace(/\bboot\(\);\s*$/, '');
  vm.runInNewContext(code + '\n;globalThis.__api={draw,planDraw,periodHtml,matchChip,favDown,favOpen,'
    + 'toast:function(f){ toast=f; }};', ctx);
  ctx.__api.toast(() => {});
  return { api: ctx.__api, el, ctx };
}
const day = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const rowOf = (h, nm) => h.split('<tr').find((x) => x.indexOf(nm) >= 0) || '';
const msubOf = (row) => { const m = /<div class="m-only msub">([\s\S]*?)<\/div><\/td>/.exec(row); assert.ok(m, '둘째 줄(msub)이 없습니다'); return m[1]; };

test('① PC 는 그대로 — 폰 조각은 넓은 화면에서 숨고, 바꾸는 규칙은 640px 이하에만', () => {
  const B = phoneBlock();
  assert.match(B.head, /\.m-only\{display:none\}/, '폰 조각이 PC 에서도 보입니다');
  const R = rules(B.body);
  assert.ok(R.some((r) => r.sel.some((s) => /td\.nm>\.msub/.test(s)) && /display:flex/.test(r.body)), '폰에서 둘째 줄이 안 보입니다');
  assert.ok(R.some((r) => r.sel.some((s) => /td\.nm>\.mdd/.test(s)) && /display:inline-flex/.test(r.body)), '폰에서 남은 날이 안 보입니다');
  /* 덩이 «밖»에서 떠 있는 손잡이를 숨기면 PC 에서도 즐겨찾기가 사라진다 */
  const outside = bare(CSS.replace(CSS.slice(CSS.indexOf(MARK)), ''));
  assert.doesNotMatch(outside, /\[data-pu-appbar-tab\][^{]*\{display:none/, 'PC 에서 즐겨찾기 손잡이를 숨겼습니다');
});

test('② 폰 표 줄 = 두 줄 카드 — ★·☐·№·이름만 남고, ☐·№ 는 어떤 규칙도 숨기지 않는다', () => {
  const R = rules(phoneBlock().body);
  ['#pgFeed', '#pgPlan'].forEach((t) => {
    assert.ok(R.some((r) => r.sel.includes(t + ' tr') && /display:flex/.test(r.body)), t + ' 줄이 카드(flex)가 아닙니다 — 13칸 표가 그대로 옆으로 밀립니다');
    assert.ok(R.some((r) => r.sel.some((s) => s.indexOf(t + ' tr.fr>td:not(') === 0) && /display:none/.test(r.body)), t + ' 의 나머지 칸이 남아 있습니다');
  });
  /* :not(…) 을 걷고도 고르기·번호·이름을 가리키는 «숨김» 규칙이 있으면 안 된다 */
  R.filter((r) => /display:none/.test(r.body)).forEach((r) => r.sel.forEach((s) => {
    const plain = s.replace(/:not\([^)]*\)/g, '');
    assert.doesNotMatch(plain, /\.chk|\.rn\b|\.stc|td\.nm(?![>\w-])|#fSelAll|#pSelAll|\.row-chk/, '폰에서 고르기·번호·이름 칸을 숨깁니다: ' + s);
  }));
  assert.ok(R.some((r) => r.sel.some((s) => /\.row-chk/.test(s)) && /width:\d+px/.test(r.body) && /height:\d+px/.test(r.body)),
    '폰에서 고르기 칸을 손가락 크기로 키우지 않았습니다');
});

test('③ 둘째 줄은 «말을 하는 값»만 — 기관·금액·마감이 없으면 자리도 없다', () => {
  const r = runApp({ feed: [
    { id: 'A', src: '나라장터', type: '새 공고', nm: '노무 진단 용역', org: '한국가나다공단', closeDt: day(5), prc: 45000000 },
    { id: 'B', src: '기업마당', type: '새 공고', nm: '빈 칸 공고' },
    { id: 'C', src: '나라장터', type: '지원함', nm: '지원한 공고', org: '라마바시', closeDt: day(9) },
    { id: 'D', src: '나라장터', type: '지나감', nm: '지난 공고', org: '사아자구', closeDt: day(-3), mthd: '수의계약' }
  ] });
  r.api.draw();
  const h = r.el('tb').innerHTML;
  const A = rowOf(h, '노무 진단 용역'), B = rowOf(h, '빈 칸 공고'), C = rowOf(h, '지원한 공고'), D = rowOf(h, '지난 공고');
  /* 1줄: 이름 다음에 남은 날 · 2줄: 금액·기관 (2026-10-18 — 줄이 넘치면 끝이 잘리므로 잘려도 되는 기관을 뒤로) */
  assert.match(A, /<b>노무 진단 용역<\/b><span class="m-only mdd"><span class="tag[^"]*">D-\d+<\/span><\/span>/);
  assert.match(msubOf(A), /<span class="mpr">4,500만원<\/span><span class="mog">한국가나다공단<\/span>/);
  assert.doesNotMatch(msubOf(A), /새 공고/, '기본 상태(새 공고)는 둘째 줄을 채우지 않는다');
  /* 없는 값은 안 그린다 — 자리만 먹는 「-」를 두지 않는다 */
  assert.doesNotMatch(B, /class="m-only mdd"/, '마감을 모르는데 남은 날 자리를 그렸습니다');
  assert.doesNotMatch(msubOf(B), /mog|만원|-/, '없는 기관·금액을 그렸습니다');
  assert.match(msubOf(C), /<span class="tag">지원함<\/span>/, '「지원함」은 말을 하는 상태다');
  /* 마감 지난 「지나감」은 남은 날 칸의 「지남」이 이미 말한다 — 두 번 말하지 않는다 */
  assert.match(D, /class="m-only mdd"><span class="tag">지남<\/span>/);
  assert.doesNotMatch(msubOf(D), /지나감/);
  assert.match(msubOf(D), /수의계약/, '폰에서도 수의계약은 보여야 한다(대표 2026-10-10)');
  assert.equal(r.el('cnt').title, r.el('cnt').textContent, '폰에서 줄인 건수의 전문을 title 로');
});

test('③-2 이력 — 견줄 것이 «있을 때만» 단추, 없으면 빈칸(「—」 자리를 두지 않는다)', () => {
  const r = runApp({ feed: [{ id: 'A', src: '나라장터', type: '새 공고', nm: '임금체계 용역', org: '가나공단' }] });
  const t = () => ({ key: 'f|A', orgId: '', orgNames: ['가나공단'], title: '임금체계 용역' });
  assert.equal(r.api.matchChip(t), '', '경력 자료가 없을 때');
  r.ctx.matchRecs = () => [];
  r.ctx.matchFind = () => ({ same: [], similar: [], no: [] });
  assert.equal(r.api.matchChip(t), '', '견줄 것이 없을 때');
  r.ctx.matchFind = () => ({ same: [{ mark: '' }], similar: [{ mark: '' }, { mark: '' }], no: [] });
  assert.match(r.api.matchChip(t), /<button class="mtb"[^>]*onclick="event\.stopPropagation\(\);matchOpen\('f\|A'\)"/);
  r.api.draw();
  assert.match(msubOf(rowOf(r.el('tb').innerHTML, '임금체계 용역')), /class="mtb"/, '둘째 줄에 이력 단추가 없습니다');
});

test('③-3 발주 예정 — 1줄 끝은 예정월, 둘째 줄 상태는 짧게(전문은 title)', () => {
  const ym = (n) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + n); return d.toISOString().slice(0, 7); };
  const r = runApp({ plan: [{ no: 'P1', kind: 'plan', nm: '노무 자문 용역', org: '가나다구청', ym: ym(0), prc: 12000000, mthd: '수의계약' }] });
  r.el('pView').value = 'ahead';
  r.api.planDraw();
  const row = rowOf(r.el('ptb').innerHTML, '노무 자문 용역');
  assert.match(row, /<b>노무 자문 용역<\/b><span class="m-only mdd sml">\d{4}\.\d{2}<\/span>/);
  const m = /<span class="tag [a-z]+ mst" title="([^"]*)">([^<]*)<\/span>/.exec(msubOf(row));
  assert.ok(m, '둘째 줄에 상태가 없습니다');
  assert.ok(m[2].length < m[1].length && m[1].indexOf(m[2]) === 0, '폰 상태는 전문의 앞부분이어야 합니다: ' + m[2] + ' / ' + m[1]);
  assert.match(msubOf(row), /수의계약[\s\S]*<span class="mpr">1,200만원<\/span><span class="mog">가나다구청<\/span>/);
});

test('④ 거르개 세 줄 — 검색·별표 → (끊기) → 거르개 → (끊기) → 건수·표시·받기', () => {
  const R = rules(phoneBlock().body);
  const B = '.tab-stick>.bar:first-child';
  const seq = [/>input$/, />#fStarBtn$/, /::before$/, />select$/, /::after$/, />\.sub$/]
    .map((re) => orderOf(R, new RegExp('^' + B.replace(/[.>]/g, (c) => '\\' + c) + re.source.replace(/^\//, ''))));
  seq.forEach((n, i) => { if (i) assert.ok(n > seq[i - 1], '줄 차례가 어긋났습니다: ' + seq.join(',')); });
  assert.ok(R.some((r) => r.sel.includes(B + '::before') && /flex-basis:100%/.test(r.body)), '줄을 끊는 칸이 폭 100% 가 아닙니다');
  /* 단추 글자는 폰에서 그림만 — 글자는 .mx 안, 이름은 title 로 남는다 */
  assert.match(src, /title="새로 받기">🔄<span class="mx"> 새로 받기<\/span><\/button>/);
  assert.ok(R.some((r) => r.sel.includes('.mx') && /display:none/.test(r.body)));
  /* 찾는 말은 한 줄로 옆으로 민다 */
  assert.ok(R.some((r) => r.sel.includes('#kwBox') && /flex-wrap:nowrap/.test(r.body) && /overflow-x:auto/.test(r.body)));
});

test('④-2 받은 범위의 설명 문단은 폰에서 접힌다 — 줄바꿈(<br>)도 함께', () => {
  const r = runApp({ feed: [{ id: 'A', src: '나라장터', type: '새 공고', nm: 'x', openDt: day(-1), closeDt: day(3) }], last_at: new Date().toISOString() });
  const h = r.api.periodHtml();
  assert.match(h, /<span class="sml per-why"><br>[^<]*지난 7일치/, '설명 문단 밖에 줄바꿈이 남으면 폰에 빈 줄이 생깁니다');
  assert.ok(rules(phoneBlock().body).some((x) => x.sel.includes('#period .per-why') && /display:none/.test(x.body)));
});

test('⑤ 즐겨찾기 — 폰에서 떠 있는 손잡이는 숨고 머리 ⭐ 가 같은 목록을 연다(열린 채 누르면 닫힘)', () => {
  const R = rules(phoneBlock().body);
  assert.ok(R.some((r) => r.sel.includes('[data-pu-appbar-tab]') && /display:none/.test(r.body)), '손잡이가 목록 오른쪽 끝을 덮습니다');
  assert.match(src, /<button class="btn m-only" id="mFavBtn"[^>]*onpointerdown="favDown\(this\)" onclick="favOpen\(this\)"/);
  const r = runApp({});
  let opened = 0;
  r.ctx.PuAppBar = { open: () => { opened++; } };
  const b = {};
  r.ctx.document.querySelector = () => null;           // 닫혀 있을 때 누르면 연다
  r.api.favDown(b); r.api.favOpen(b);
  assert.equal(opened, 1);
  r.ctx.document.querySelector = () => ({});           // 열린 채 누르면 — 바깥 누름으로 이미 닫혔으니 다시 열지 않는다
  r.api.favDown(b); r.api.favOpen(b);
  assert.equal(opened, 1, '열린 목록의 ⭐ 를 누르면 닫혀야 하는데 다시 열렸습니다');
  r.ctx.document.querySelector = () => null;
  r.api.favDown(b); r.api.favOpen(b);
  assert.equal(opened, 2, '한 번 닫은 뒤에는 다시 열려야 합니다');
});

test('⑥ 컨설턴트 모집 표 — 폰에서 카드(제목이 첫 줄), 옛 «세로 쌓기»는 되살리지 않는다', () => {
  /* 옛 규칙: 칸 너비를 못박은 표(.rec-fixed) 안에서 줄을 block 으로 쌓자 줄 전체가 첫 칸(32px)에 갇혀 한 글자씩 내려갔다 */
  assert.doesNotMatch(bare(CSS), /\.rec-hits tr\{display:block/, '옛 세로 쌓기 규칙이 돌아왔습니다 — 폰에서 한 글자씩 내려갑니다');
  const R = rules(phoneBlock().body);
  assert.ok(R.some((r) => r.sel.includes('.rec-hits') && /display:block/.test(r.body)), '표 자체를 풀지 않으면 줄이 첫 칸에 갇힙니다');
  assert.ok(R.some((r) => r.sel.includes('.rec-hits tbody tr') && r.sel.includes('#recTb tr') && /display:flex/.test(r.body) && /flex-wrap:wrap/.test(r.body)));
  assert.ok(R.some((r) => r.sel.includes('.rec-hits tbody td.tt') && r.sel.includes('#recTb td.onm') && /order:-1/.test(r.body) && /flex:1 0 100%/.test(r.body)),
    '제목(기관)이 첫 줄을 차지해야 합니다');
  /* ☐·№ 는 숨기지 않고 왼쪽에 붙인다 */
  assert.ok(R.some((r) => r.sel.includes('.rec-hits tbody td.chk') && /position:absolute/.test(r.body) && !/display:none/.test(r.body)));
  /* 칸 이름표 — 폰 카드가 자리를 정하는 데 쓴다 */
  const r = runApp({ recruit_scan: [{ y: String(new Date().getFullYear()), name: new Date().getFullYear() + ' 지방공기업평가원 자문위원 신청서', t: 0 }] });
  r.ctx.recDraw();
  const tb = r.el('recTb').innerHTML;
  ['onm', 'omo', 'oyr', 'ost', 'act'].forEach((c) => assert.match(tb, new RegExp('<td class="' + c + '"'), '지원 이력 칸 이름표 ' + c + ' 가 없습니다'));
  assert.match(src, /'<td class="kd"><span class="sml">'\+ki\.icon/, '갈래 칸 이름표(kd)가 없습니다 — 폰에서 못 숨깁니다');
});
