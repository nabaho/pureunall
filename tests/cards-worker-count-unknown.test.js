/* ══════ 👷 「근로자 0명」은 «모른다»는 뜻이었다 (대표 지시 2026-09-12 「2번」) ═══════
   점검 보고의 ②. 대표 화면에서 옆줄 딱지가 늘 「근로자 0」이었다.

   ■ 무엇이 문제였나 — 실측으로 찾았다
   사람 목록은 푸른이알피 «사건»에서 조립된다. 그런데 옆줄 딱지는 명함 화면을 그릴 때
   이미 한 번 그려진다 — 그때는 이알피를 아직 안 읽었다. `wkList()` 가 그 **빈 답을
   그대로 기억해 버려서** 0 이 굳었다. 자료가 나중에 와도 기억이 앞을 막아,
   근로자 화면을 «직접 열기 전»까지 영영 0명이었다.

   화면에서 재 본 것:
     ① 이알피 오기 전 → 0
     ② 이알피 온 뒤   → 0   ← 자료는 왔는데 숫자가 안 변한다
     ③ 기억을 지우면  → 2

   ★ 못 박는 것
     ① «모르는 답»은 기억하지 않는다 — 기억하면 그 순간이 굳는다.
     ② 온 답은 기억한다 — 안 그러면 옆줄을 그릴 때마다 사건 전부를 다시 조립한다.
     ③ 화면은 「모른다」와 「없다」를 **다르게 적는다**. 0명은 «없다»는 말이라
        사람이 눌러 보지 않는다 — 40명이 걸려 있어도 그렇다.
     ④ 기억을 지우는 자리는 loadErpCaseCons «한 곳»이다. 그래야 기업 상세를 열어
        자료를 받았을 뿐인데도 옆줄 숫자가 제자리를 찾는다.

   node --test tests/cards-worker-count-unknown.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { cutFn } = require('./cut-fn');
const R = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(R, 'pu-cards.html'), 'utf8');
const NSRC = SRC.split('\r\n').join('\n');

function grab(re, what) {
  const m = SRC.match(re);
  assert.ok(m, what + ' 를 찾지 못했습니다');
  return m[0];
}
const cut = n => cutFn(SRC, 'function ' + n + '(');

/* 사건 하나 — 이알피에 저장되는 꼴 그대로(workers 가 맨 위에 있다) */
const 사건 = ws => ({ id:'C1', typeName:'임금체불 진정', status:'run', year:2026,
  companyName:'해찬솔에프쓰리', bizNo:'312-81-49225', _kind:'case', workers:ws });
const 이알피 = ws => ({ byBiz: { '3128149225': [사건(ws)] }, byName: {} });

/* 사람 목록을 만드는 «진짜» 함수를 떠서 돌린다 */
function load() {
  const ctx = { console, Object, Array, String, Number, Boolean, Math, Date, JSON, RegExp,
    esc: v => String(v == null ? '' : v),
    digits: v => String(v || '').replace(/\D/g, ''),
    state: { view:'wk', wkQ:'', wkFolder:'' },
    _erpHistTypes: {},
    erpHistVisible: () => true,
    erpHistName: r => String((r && r.typeName) || ''),
    erpHistStat: () => 'run',
    erpHistYear: r => Number((r && r.year) || 0),
    erpHistMd: v => String(v || ''),
    erpMgrName: sid => (sid ? '노무사' + sid : '') };
  vm.createContext(ctx);
  vm.runInContext([
    grab(/^const _norm = [^\n]*;\r?$/m, '_norm'),
    /* ⚠ vm 최상위 let 은 컨텍스트 값이 안 된다 — var 로 바꿔 실어야 밖에서 손댄다 */
    'var _wkInfo = {}, _wkListMemo = null, _erpCaseCons = null;',
    grab(/const WK_DOC_LABEL = \{[\s\S]*?\};/, 'WK_DOC_LABEL'),
    grab(/const WK_FOLDERS = \[[\s\S]*?\n\];/, 'WK_FOLDERS'),
    cut('wkSafe'), cut('wkKeyOf'), cut('wkCaseWorkers'), cut('wkCaseTitle'),
    cut('wkCaseRow'), cut('wkAllCases'), cut('wkListBuild'),
    cut('wkListBust'), cut('wkListKnown'), cut('wkCountLabel'), cut('wkList'),
    cut('wkFolderPick'), cut('wkMatch'), cut('wkVisible')
  ].join('\n'), ctx);
  return ctx;
}

/* ── ①② 기억 ───────────────────────────────────────────────────────────── */

test('★★★ 이알피가 «아직 안 왔으면» 그 빈 답을 기억하지 않는다', () => {
  const c = load();
  assert.equal(c.wkList().length, 0, '자료가 없으면 당연히 0이다');
  /* 자료가 도착했다 — 아무도 기억을 지워 주지 않아도 바로 보여야 한다 */
  c._erpCaseCons = 이알피([{ name:'류재혁' }, { name:'김수' }]);
  assert.equal(c.wkList().length, 2,
    '★★★ 빈 답을 기억하면 「근로자 0명」이 굳는다 — 대표 화면에서 실제로 그랬다');
});

test('★★ 답이 «온 뒤»에는 기억한다 — 옆줄을 그릴 때마다 사건 전부를 다시 조립하면 안 된다', () => {
  const c = load();
  c._erpCaseCons = 이알피([{ name:'류재혁' }]);
  const a = c.wkList();
  assert.equal(c.wkList(), a,
    '★★ 같은 목록을 다시 조립하고 있다 — 명함 화면을 그릴 때마다 이 값이 든다');
  /* 그리고 지우면 다시 만든다 — 「지우는 문」이 정말 듣는지 */
  c.wkListBust();
  assert.notEqual(c.wkList(), a, '★★ 기억을 지워도 옛 목록이 그대로다');
});

/* ── ③ 「모른다」와 「없다」를 가른다 ─────────────────────────────────────── */

test('★★★ 모를 때와 없을 때를 «다르게» 말한다', () => {
  const c = load();
  assert.equal(c.wkListKnown(), false);
  assert.equal(c.wkCountLabel(), '…',
    '★★★ 모르는데 0 이라고 적으면, 사람이 그 말을 믿고 안 눌러 본다');
  c._erpCaseCons = 이알피([{ name:'류재혁' }, { name:'김수' }]);
  assert.equal(c.wkListKnown(), true);
  assert.equal(c.wkCountLabel(), '2', '★★ 자료가 왔는데도 숫자를 안 적는다');
  /* 진짜 0 은 0 이라고 적는다 — 모른다와 섞으면 「없다」를 말할 길이 없어진다 */
  c.wkListBust(); c._erpCaseCons = { byBiz:{}, byName:{} };
  assert.equal(c.wkCountLabel(), '0',
    '★★★ 정말 아무도 없을 때까지 「…」이면, 다 읽고도 늘 읽는 중으로 보인다');
});

test('★★★ 옆줄 딱지가 그 잣대를 «실제로» 쓴다', () => {
  /* 옆줄의 근로자 단추 한 줄을 원본에서 떠서 그려 본다 — 글자만 찾으면
     `wkCountLabel()` 을 적어 놓고 쓰지 않아도 통과한다. */
  const line = grab(/\n[^\n]*openWkPage\(\)[^\n]*👷[^\n]*\n/, '옆줄 근로자 단추');
  const ctx = { onWk:false, _불렸나:false,
    wkCountLabel(){ ctx._불렸나 = true; return '…'; } };
  vm.createContext(ctx);
  const h = vm.runInContext('(`' + line.trim() + '`)', ctx);
  assert.equal(ctx._불렸나, true, '★★★ 옆줄이 제 잣대를 따로 두면 0 이 다시 굳는다');
  assert.match(h, /<span>…<\/span>/, '★★ 모를 때 「…」이 안 적힌다');
});

test('★★ 근로자 화면 머리줄도 모를 때는 숫자를 «안 적는다»', () => {
  const ctx = { console, String, Number, Object,
    state: { wkView:'' }, esc: v => String(v == null ? '' : v),
    wkVisible: () => [], wkList: () => [], wkListKnown: () => false };
  vm.createContext(ctx);
  vm.runInContext(cut('wkHeadHtml'), ctx);
  assert.match(ctx.wkHeadHtml(), /👷 근로자 …/,
    '★★ 읽는 중인데 「근로자 0명」이라고 적혀 있다');
  ctx.wkListKnown = () => true;
  assert.match(ctx.wkHeadHtml(), /👷 근로자 0명/,
    '★★ 다 읽고 정말 없을 때는 0명이라고 말해야 한다');
});

test('★★★ 빈 목록이 «읽는 중»과 «없다»를 가려 말한다', () => {
  const ctx = { console, String, Number, Object, Array,
    state: { wkQ:'', wkFolder:'' }, esc: v => String(v == null ? '' : v),
    wkVisible: () => [], wkFoldRows: () => [], wkListKnown: () => false };
  vm.createContext(ctx);
  vm.runInContext(cut('wkListHtml'), ctx);
  assert.match(ctx.wkListHtml(), /불러오는 중/,
    '★★★ 읽는 중에 「사람이 없습니다」라고 하면 사람은 그 말을 믿고 화면을 닫는다');
  ctx.wkListKnown = () => true;
  assert.match(ctx.wkListHtml(), /아직 사람이 없습니다/,
    '★★ 다 읽고도 「불러오는 중」이면 영영 기다리게 된다');
  ctx.state.wkQ = '홍길동';
  assert.match(ctx.wkListHtml(), /찾는 말과 맞는 사람이 없습니다/,
    '★ 찾기로 좁혀 비었을 때까지 「없습니다」면 찾기를 지울 생각을 못 한다');
});

/* ── ④ 지우는 자리가 «한 곳» ─────────────────────────────────────────────── */

test('★★★ 이알피를 다 읽으면 «부른 사람과 상관없이» 기억을 지우고 옆줄을 고쳐 그린다', () => {
  /* 진짜로 돌린다 — 기업 상세를 열어 이 자료를 받았을 뿐인데도 옆줄이 따라와야 한다.
     ⚠ 이것을 글자로만 확인하면 `if(false)` 로 꺼 놔도 통과한다. */
  const 그림 = { bust:0, side:0 };
  const snap = { val: () => ({}) };
  const ctx = { console, Object, Array, String, Number, Promise, JSON,
    digits: v => String(v || '').replace(/\D/g, ''),
    Store: { mode:'firebase' },
    firebase: { database: () => ({ ref: () => ({ once: () => Promise.resolve(snap) }) }) },
    erpUnwrapList: () => [],
    document: { body: { classList: { contains: () => true } } },
    wkListBust(){ 그림.bust++; },
    renderPCSide(){ 그림.side++; } };
  vm.createContext(ctx);
  vm.runInContext([
    'var _erpCaseCons = null, _erpCaseConsLoading = false, _erpConsTypes = null,'
      + ' _erpHistTypes = {}, _erpCaseConsWaiters = [];',
    grab(/const ERP_HIST_KINDS = \[[\s\S]*?\n\];/, 'ERP_HIST_KINDS'),
    cut('loadErpCaseCons')
  ].join('\n'), ctx);

  return new Promise(done => {
    ctx.loadErpCaseCons(() => {
      assert.equal(그림.bust, 1,
        '★★★ 기억을 안 지우면, 자료를 받아 놓고도 옆줄은 「근로자 0」인 채다');
      assert.equal(그림.side, 1,
        '★★ 고쳐 그리지 않으면 숫자는 맞는데 화면이 옛 것을 붙들고 있다');
      done();
    });
  });
});

test('★★ 기억을 지우는 자리가 «한 곳»이다 — 두 곳이면 다음에 한쪽만 고쳐진다', () => {
  const enter = cutFn(NSRC, 'function enterWkView(');
  assert.match(enter, /loadErpCaseCons\(/, '★ 근로자 화면이 사건을 아예 안 읽는다');
  assert.ok(!/wkListBust\(\)/.test(enter),
    '★★ 근로자 화면이 또 지우고 있다 — 지우는 규칙이 두 벌이 된다');
  const load = cutFn(NSRC, 'function loadErpCaseCons(');
  assert.match(load, /wkListBust\(\)/, '★★★ 자료를 받는 자리에서 안 지운다');
});
