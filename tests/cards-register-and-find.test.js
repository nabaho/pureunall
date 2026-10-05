'use strict';
/* 「＋ 정보등록」 · 🔎 전체에서 찾기 (대표 지시 2026-10-05)
   「명함등록을 바꾸고 정보등록 으로 해라. 그리고 명함 사업자 근로자 등의 정보를 각 대시보드에
    클릭시 각 대시보드 정보입력 항목과 같이 팝업창을 띄워서 입력하게 해라」
   「저장된것 전체를 검색하게 할수 있을까 … 한번에 관련사항을 찾게」 → 목업 → 모두 «추천대로»

   ■ 여기서 못 박는 것 — 함수를 떼어 «실제로 돌린다»
     ① 「＋ 정보등록」은 «지금 보는 화면»의 입력 칸을 띄운다 (명함·사업자·기업 상세→사업자 칸)
     ② 「📁 파일로 읽기」로 고른 갈래가 읽기에 쓰이고 한 번 쓰면 비워진다
     ③ 전체 찾기는 각 화면과 «같은 잣대»로 걸고, 잠긴 폴더 명함은 새지 않는다
     ④ 근로자 사건을 못 읽는 때에도 찾기가 끝없이 맴돌지 않는다(2026-10-05 실제로 멎었다)
   ⚠ 예시는 가짜다(홍길동·가나상사, 사업자번호 123-). */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { cutFn } = require('./cut-fn');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8').replace(/\r\n/g, '\n');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');
const grab = (re) => { const m = SRC.match(re); assert.ok(m, re + ' 를 못 찾았다'); return m[0]; };

/* ══════════ ① 「＋ 정보등록」 ══════════ */

function regWorld(st) {
  const calls = [];
  const ctx = { console, state: Object.assign({ view: 'list', tab: 'card' }, st || {}),
    openEditor: (item, photo, pre, opt) => calls.push({ item, photo, pre, opt }),
    toast: (m) => calls.push({ toast: m }) };
  vm.createContext(ctx);
  vm.runInContext(grab(/const REG_LABEL = [^;]+;/).replace('const ', 'var ') + '\n' + cutFn(SRC, 'function openRegister('), ctx);
  ctx.openRegister();
  return calls;
}

test('★★ 단추 이름은 「＋ 정보등록」 — 누르면 openRegister (단축키 N 도)', () => {
  const btn = grab(/<button class="pcbtn-primary"[^>]*>[^<]*<\/button>/);
  assert.match(btn, /＋ 정보등록/, '★ 단추 이름이 바뀌지 않았습니다');
  assert.match(btn, /onclick="openRegister\(\)"/, '★ 단추가 예전 작은 창(openAddSheet)으로 갑니다');
  assert.doesNotMatch(strip(SRC), /＋ 명함 등록<\/button>/, '「＋ 명함 등록」 단추가 남아 있습니다');
  assert.match(SRC, /\(e\.key==='n'\|\|e\.key==='N'\)[^\n]*openRegister\(\)/, '★ 단축키 N 이 예전 창을 엽니다');
});

test('★★★ 지금 보는 화면의 입력 칸이 뜬다 — 명함·사업자·기업 상세', () => {
  let c = regWorld({ view: 'list', tab: 'card' })[0];
  assert.equal(c.opt.kind, 'card'); assert.equal(c.opt.reg, 'card');
  c = regWorld({ view: 'list', tab: 'biz' })[0];
  assert.equal(c.opt.kind, 'biz'); assert.equal(c.opt.reg, 'biz');
  /* 기업 상세는 새 저장소를 안 만든다 — 사업자 자료 한 장으로 */
  c = regWorld({ view: 'co', tab: 'card' })[0];
  assert.equal(c.opt.kind, 'biz', '★★★ 기업 상세에서 명함 칸이 떴습니다 — 회사는 사업자 칸으로 넣어야 기업 상세가 모읍니다');
  assert.equal(c.opt.reg, 'co');
  assert.equal(c.item, null, '새로 넣는 창이어야 합니다');
});

test('★ 근로자 화면에서는 명함 칸을 «엉뚱하게» 띄우지 않는다', () => {
  const calls = regWorld({ view: 'wk', tab: 'card' });
  assert.ok(!calls.some((x) => x.opt), '★ 근로자 화면에서 명함·사업자 입력 칸이 떴습니다');
});

test('★★ 입력 창 — 갈래를 받아 열고, 제목에 어느 화면 것인지 · 맨 위에 «사진으로 읽기» 줄', () => {
  const ed = strip(cutFn(SRC, 'function openEditor('));
  assert.match(ed, /const kind = item \? item\.kind : \(o\.kind \|\| state\.tab\)/, '★ 기업 상세에서 열 때 갈래(사업자)를 못 받습니다');
  assert.match(ed, /'＋ 정보등록 — ' \+ regLabel/, '제목에 어느 화면 것인지 적어야 합니다');
  assert.match(ed, /\(regLabel && !photoObj\) \? regStripHtml\(kind, o\.reg\)/, '★ 사진에서 읽어 온 창에도 «읽기» 줄이 붙거나, 정보등록 창에 안 붙습니다');
  /* 명함만 촬영이 있다 — 촬영은 사진첩 카메라(명함 전용)로 간다 */
  const ctx = { console, esc: (s) => String(s) };
  vm.createContext(ctx);
  vm.runInContext(cutFn(SRC, 'function regStripHtml('), ctx);
  assert.match(ctx.regStripHtml('card', 'card'), /regRead\('camera','card'\)/);
  assert.match(ctx.regStripHtml('card', 'card'), /regRead\('file','card'\)/);
  assert.doesNotMatch(ctx.regStripHtml('biz', 'co'), /camera/, '사업자등록증은 사진첩 카메라(명함 전용)로 보내지 않습니다');
  assert.match(ctx.regStripHtml('biz', 'co'), /regRead\('file','biz'\)/);
});

test('★★ 「📁 파일로 읽기」로 고른 갈래로 읽고, 한 번 쓰면 비운다', () => {
  const pump = strip(cutFn(SRC, 'async function pumpQueue('));
  assert.match(pump, /const kind = _regKind \|\| state\.tab; _regKind = '';/, '★★ 기업 상세에서 고른 등록증이 명함(탭)으로 읽힙니다 — 또는 한 번 쓰고 안 비웁니다');
  assert.match(pump, /aiExtract\(photo, kind\)/);
  assert.match(pump, /openEditor\(null, \{photo, thumb\}, pre, \{ kind \}\)/);
  const rr = strip(cutFn(SRC, 'function regRead('));
  assert.match(rr, /editorDirty\(\) && !confirm\(/, '★ 적던 내용을 묻지 않고 버립니다');
  assert.match(rr, /_regKind = kind;\s*fileInput\.click\(\)/);
});

/* ══════════ ③ 🔎 전체에서 찾기 ══════════ */

function findWorld(o) {
  const x = o || {};
  const ctx = { console,
    state: { groups: x.groups || {}, unlocked: x.unlocked || {}, group: 'all' },
    canSeeGroup: (g) => !g.others,
    digits: (s) => String(s || '').replace(/\D/g, ''),
    chosung: (s) => String(s || ''),
    allItems: () => x.items || {},
    coList: () => x.cos || [],
    wkList: () => x.wks || [],
    wkMatch: (p, q) => [p.name, p.company].join(' ').toLowerCase().indexOf(q) >= 0 };
  vm.createContext(ctx);
  vm.runInContext(['function itemLockShown(', 'function itemQueryHit(', 'function coQueryHit(', 'function gsCollect(']
    .map((d) => cutFn(SRC, d)).join('\n'), ctx);
  return ctx;
}
const 명함 = (id, x) => Object.assign({ id, kind: 'card', name: '홍길동', company: '가나상사', mobile: '010-1111-2222' }, x || {});

test('★★★ 한 번에 — 명함·사업자·기업 상세·근로자를 갈래별로', () => {
  const w = findWorld({
    items: { c1: 명함('c1'), c2: 명함('c2', { name: '김철수', company: '다라산업' }),
      b1: { id: 'b1', kind: 'biz', company: '가나상사', bizno: '123-45-67890', ceo: '홍길동' } },
    cos: [{ key: 'k1', name: '가나상사', bizno: '1234567890', ceo: '홍길동' }, { key: 'k2', name: '다라산업' }],
    wks: [{ key: 'w1', name: '김가나', company: '가나상사' }, { key: 'w2', name: '박영희', company: '다라산업' }] });
  const got = w.gsCollect('가나');
  assert.deepEqual(Array.from(got.card, (r) => r.id), ['c1']);
  assert.deepEqual(Array.from(got.biz, (r) => r.id), ['b1']);
  assert.deepEqual(Array.from(got.co, (r) => r.key), ['k1']);
  assert.deepEqual(Array.from(got.wk, (r) => r.key), ['w1']);
  /* 전화 숫자로도 — 명함 목록과 같은 잣대 */
  assert.equal(w.gsCollect('1111').card.length, 2, '숫자 셋 이상이면 전화번호로도 걸려야 합니다(명함 목록과 같게)');
  assert.equal(w.gsCollect('   ').card.length, 0, '빈 글자로는 아무것도 펴지 않습니다');
});

test('★★★ 잠긴 폴더의 명함은 펼침으로 «새지 않는다» — 풀었으면 보인다', () => {
  const groups = { g1: { locked: true }, g2: { locked: true, others: true } };
  const items = { c1: 명함('c1', { group: 'g1' }), c2: 명함('c2', { group: 'g2' }), c3: 명함('c3') };
  let got = findWorld({ items, groups }).gsCollect('홍길동');
  assert.deepEqual(Array.from(got.card, (r) => r.id), ['c3'], '★★★ 잠긴 폴더 명함이 전체 찾기에 떴습니다');
  got = findWorld({ items, groups, unlocked: { g1: true } }).gsCollect('홍길동');
  assert.deepEqual(Array.from(got.card, (r) => r.id).sort(), ['c1', 'c3'], '이번에 푼 폴더는 보여야 합니다 — 남의 잠긴 폴더는 여전히 안 보입니다');
});

test('★★ 걸리는 잣대는 각 화면과 «같은 함수» — 따로 두면 펼침과 화면이 어긋난다', () => {
  const li = strip(cutFn(SRC, 'function listItems('));
  assert.match(li, /\.filter\(itemLockShown\)/, '★ 명함 목록이 잠긴 폴더를 다른 잣대로 거릅니다');
  assert.match(li, /itemQueryHit\(it, q, qc, isCho\)/, '★ 명함 목록이 찾기를 다른 잣대로 겁니다');
  assert.match(strip(cutFn(SRC, 'function coFilteredList(')), /coQueryHit\(o, q\)/, '★ 기업 상세 목록이 찾기를 다른 잣대로 겁니다');
  const gc = strip(cutFn(SRC, 'function gsCollect('));
  assert.match(gc, /wkMatch\(p, ql\)/, '근로자는 근로자 화면의 찾기(wkMatch)를 그대로 씁니다');
  /* 주민번호·계좌로는 안 찾는다 */
  assert.doesNotMatch(gc + strip(cutFn(SRC, 'function itemQueryHit(')), /rrn|bankAcct|account/, '★★ 주민번호·계좌로 찾고 있습니다');
});

test('★★ 근로자 사건을 못 읽어도 찾기가 «끝없이 맴돌지» 않는다', () => {
  /* 로그인 전처럼 읽개가 곧바로 빈손으로 돌아오는 때 — 예전에는 다시 그리기가 또 읽으러 가 화면이 멎었다 */
  const el = { value: '가나' };
  /* 만든 상자를 세어 둔다 — 읽개가 곧바로 답하면 안에서 한 번 그려지므로 «두 겹»이 될 수 있다 */
  const made = { gsBox: 0, gsBoxM: 0 }, dom = {};
  const sb = { classList: { contains: () => true }, insertAdjacentElement(_w, b) { dom[b.id] = b; } };
  let asked = 0;
  const ctx = { console, state: {}, esc: (s) => String(s), fmtBizno: (s) => String(s || ''),
    document: { activeElement: el, body: { classList: { contains: () => ctx._pc } },
      createElement: () => new Proxy({ remove() { delete dom[this.id]; } },
        { set(t, k, v) { t[k] = v; if (k === 'id') made[v]++; return true; } }) },
    $: (id) => (id === 'pcSearch' || id === 'search' ? el : id === 'pcSearchWrap' ? { appendChild(b) { dom[b.id] = b; } }
      : id === 'searchbar' ? sb : (dom[id] || null)),
    _erpCaseCons: null, _pc: true,
    loadErpCaseCons: (cb) => { asked++; if (asked > 50) throw new Error('맴돈다'); cb(null); },
    wkListBust() {}, gsCollect: () => ({ card: [], biz: [], co: [], wk: [] }) };
  vm.createContext(ctx);
  const load = () => vm.runInContext(grab(/const GS_SHOW = [^;]+;/).replace('const ', 'var ') + '\n'
    + grab(/const GS_KINDS = \[[\s\S]*?\];/).replace('const ', 'var ') + '\n'
    + 'var _gsSel = -1, _gsRows = [], _gsErpAsked = false;\n'
    + grab(/const gsIsPc = [^\n]+/).replace('const ', 'var ') + '\n'
    + ['function gsRowHtml(', 'function gsBodyHtml(', 'function gsAskErp(', 'function gsPaint(', 'function gsPaintMobile(']
      .map((d) => cutFn(SRC, d)).join('\n'), ctx);
  load();
  ctx.gsPaint();
  assert.equal(asked, 1, '★★ 사건 읽기를 ' + asked + '번 불렀습니다 — 한 번만이어야 합니다');
  ctx.gsPaint();
  assert.equal(asked, 1, '다시 쳐도 또 읽으러 가지 않습니다');
  assert.equal(made.gsBox, 1, '★ 펼침 상자를 ' + made.gsBox + '개 만들었습니다 — 두 겹이 됩니다');
  /* 폰 띠도 같은 문을 지난다 */
  asked = 0; ctx._pc = false; load();
  ctx.gsPaintMobile(); ctx.gsPaintMobile();
  assert.equal(asked, 1, '★★ 폰 찾기 띠가 사건 읽기를 ' + asked + '번 불렀습니다');
  assert.equal(made.gsBoxM, 1, '★ 폰 띠를 ' + made.gsBoxM + '겹 만들었습니다(2026-10-05 실제로 두 겹이었다)');
});

test('★★ 폰 — ＋ 를 길게 누르면 「＋ 정보등록」(누르면 촬영은 그대로) · 🔍 찾기도 전체에서', () => {
  const s = strip(SRC);
  assert.match(s, /timer = setTimeout\(\(\) => \{ longFired = true; openRegister\(\); \}, 550\)/, '★★ ＋ 길게 누르기가 「정보등록」으로 안 갑니다');
  assert.match(s, /if\(longFired\)\{[^}]*\}[\s\S]{0,80}openCamera\(\);/, '★ 그냥 누르면 바로 촬영 — 대표가 가장 자주 쓰는 길입니다');
  assert.doesNotMatch(s, /function openAddSheet\(/, '쓰는 곳 없는 작은 창이 남아 있습니다');
  assert.doesNotMatch(s, /id="addBg"/, '쓰는 곳 없는 작은 창 자리가 남아 있습니다');
  assert.match(strip(cutFn(SRC, 'function onMobileSearchInput(')), /render\(\);\s*gsPaintMobile\(\);/, '★★ 폰 찾기 칸이 전체 찾기 띠를 안 그립니다');
  assert.match(s, /search\.focus\(\);gsPaintMobile\(\)">🔍<\/button>/, '🔍 로 칸을 닫으면 띠도 닫혀야 합니다');
  const m = strip(cutFn(SRC, 'function gsPaintMobile('));
  assert.match(m, /if\(!q \|\| !sb\.classList\.contains\('open'\)\)\{[^}]*remove\(\); return; \}/, '칸이 닫혔거나 글자가 없으면 띠를 걷어야 합니다');
  assert.match(m, /gsBodyHtml\(q, gsCollect\(q\)/, '★ 폰 띠는 PC 와 «같은 몸»(gsBodyHtml·gsCollect)을 써야 합니다');
});

test('★ 폰은 어두운 바탕 — 근로자 사건 고르기 글자를 짙은 색으로 박지 않는다', () => {
  /* 2026-10-05 폰 목업에서 업체 이름이 «어두운 바탕 + 짙은 글자»로 안 보였다 */
  const head = SRC.slice(0, SRC.indexOf('</head>'));
  const rule = (head.match(/\.wrcases \.wrcase\{([^}]*)\}/) || [])[1] || '';
  assert.match(rule, /color:var\(--ink\)/, '★ 사건 줄 글자가 화면 변수(--ink)를 안 따릅니다 — 폰에서 안 보입니다');
  assert.doesNotMatch(head, /\n\.wrcases \.wrcase\.on,\.wrcases \.wrcase:hover\{background:#eff6ff/, '밝은 칠은 PC 에서만(body.pc) — 폰에서는 글자가 묻힙니다');
});

test('★ Esc 는 펼침부터 닫는다 — 한 번 더 누르면 글자를 지운다', () => {
  const s = strip(SRC);
  const i = s.indexOf("$('gsBox')){ e.stopPropagation(); gsClose(); return; }");
  const j = s.indexOf('p.value){ e.stopPropagation(); clearPcSearch(); }');
  assert.ok(i > 0 && j > 0 && i < j, '★ Esc 가 펼침을 닫기 전에 찾던 글자부터 지웁니다');
});
