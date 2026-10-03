/* ⚡ 메일함 뜨거운 자리 둘 — 대표 화면 2026-10-02
   「기업정보함이 처음 뜰 때 느린 까닭 · 10초 중 676ms 멈춤 · mbWhoKey 70ms(186,969번) · mbSpamWhy 32ms(15,056번)」
   ★ 못 박는 것
     ① mbWhoKey 는 답을 기억한다 — 답은 예전과 «글자 하나까지» 같고, 상자는 5만 개를 넘지 않는다
     ② mbIsSpam 은 한 번 그리는 동안 같은 메일을 «한 번만» 판정한다 · 그리기가 새로 시작되면 다시 본다
   node --test tests/cards-mb-hot-memo.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8').split('\r\n').join('\n');

test('★★★ ① mbWhoKey — 예전과 같은 답 · 기억 상자는 5만 개에서 비운다', () => {
  const ctx = { String, Map };
  vm.createContext(ctx);
  vm.runInContext(cutFn(SRC, 'function mbWhoKey('), ctx);
  const old = s => String(s || '').toLowerCase().replace(/[.#$\[\]/]/g, ',');
  for (const s of ['A.B@Ex.co.kr', '@ex.com', 'INBOX-x:12.3', '', null, undefined, 'a#b$c[d]e/f', 0, 12.5]) {
    assert.equal(ctx.mbWhoKey(s), old(s), '★★★ 열쇠가 달라졌다 — 사람이 정한 담당자를 못 찾는다: ' + s);
    assert.equal(ctx.mbWhoKey(s), old(s), '★ 두 번째(기억한 답)가 다르다');
  }
  for (let i = 0; i < 50010; i++) ctx.mbWhoKey('u' + i + '@x.kr');
  assert.ok(ctx.mbWhoKey._c.size <= 50000, '★ 기억 상자가 끝없이 커진다');
});

/* ② 판정 기억은 그리기를 «넘어» 산다 — 설정 서명이 같으면 이어 쓰고, 다르면 버린다 (2026-10-03 메일창 확인 → 진행) */
function judgeCtx(over) {
  let n = 0;
  const ctx = Object.assign({ WeakMap, JSON, String, Object, _mbMemo: null, _mbJudge: null,
    _mbPut: {}, _mbBinRule: {}, _mbWhoMsg: {}, _mbCo: {}, _mbNotSpam: {}, _mbSpamOff: false, _mbBins: {}, _mbFolders: { IN: { kind: 'inbox', path: 'INBOX' } },
    mbSpamWhy: v => { n++; return v.bad ? '까닭' : ''; } }, over || {});
  vm.createContext(ctx);
  vm.runInContext(['function mbMemoClear(){ _mbMemo = null; }', cutFn(SRC, 'function mbMemoOf('),
    cutFn(SRC, 'function mbJudgeKey('), cutFn(SRC, 'function mbJudgeSig('), cutFn(SRC, 'function mbJudge('),
    cutFn(SRC, 'function mbIsSpam(')].join('\n'), ctx);
  ctx._n = () => n;
  return ctx;
}
test('★★★ ② mbIsSpam — 설정이 같으면 다시 그려도 이어 쓰고, 설정을 고치면 다시 판정', () => {
  const c = judgeCtx();
  const a = { bad: true }, b = { bad: false };
  assert.equal(c.mbIsSpam(a), true); assert.equal(c.mbIsSpam(b), false);
  c.mbIsSpam(a); c.mbIsSpam(b);
  assert.equal(c._n(), 2, '★★★ 한 번 그리는 동안 같은 메일을 또 판정했다');
  c.mbMemoClear(); c.mbIsSpam(a); c.mbIsSpam(b);
  assert.equal(c._n(), 2, '★★★ 설정이 그대로인데 새로 그릴 때마다 다시 판정했다 — 그것이 처음 열 때 느린 뿌리다');
  c.mbIsSpam({ _src: a, _reuse: 1 });
  assert.equal(c._n(), 2, '★ 원본을 가리키는 줄 사본은 원본의 판정을 같이 써야 한다');
  c._mbNotSpam['x@y,kr'] = 1;                      /* 「스팸 아님」을 그 자리에서 고쳤다 */
  c.mbMemoClear(); a.bad = false; 
  assert.equal(c.mbIsSpam(a), false, '★★★ 설정을 고쳤는데 옛 판정을 썼다 — 「스팸 아님」이 안 듣는다');
  assert.equal(c._n(), 3);
  assert.match(SRC, /mbMemoClear\(\);\s+\/\* 그리는 «동안»만 사는 셈을 버린다/, '★ 그리기 시작에 셈을 버리는 자리가 없다');
});

test('★★★ ③ mbWhoWhy — 그리는 동안 주소 하나에 한 번 · 색인이 바뀌거나 새로 그리면 다시', () => {
  let n = 0;
  let IDX = { byAddr: {}, byDom: {} };
  const ctx = { Map, String, _mbMemo: null, mbWhoIndex: () => IDX,
    mbWhoWhyOf: (em) => { n++; return { who: em === 'a@x.kr' ? '김담당' : '', why: 'card' }; } };
  vm.createContext(ctx);
  vm.runInContext(['function mbMemoClear(){ _mbMemo = null; }', cutFn(SRC, 'function mbMemoOf('),
    cutFn(SRC, 'function mbWhoWhy(')].join('\n'), ctx);
  assert.equal(ctx.mbWhoWhy('A@x.kr').who, '김담당');
  for (let i = 0; i < 5; i++) { ctx.mbWhoWhy('a@x.kr'); ctx.mbWhoWhy('b@x.kr', IDX); }
  assert.equal(n, 2, '★★★ 한 번 그리는 동안 같은 주소를 또 판정했다');
  IDX = { byAddr: {}, byDom: {} };                 // 명함이 흘러 들어와 색인이 새로 만들어졌다
  ctx.mbWhoWhy('a@x.kr');
  assert.equal(n, 3, '★★★ 색인이 바뀌었는데 옛 판정을 썼다 — 새 명함의 담당자가 안 보인다');
  ctx.mbMemoClear(); ctx.mbWhoWhy('a@x.kr');
  assert.equal(n, 4, '★ 새로 그렸는데 옛 판정이 남았다');
  ctx.mbWhoIndex = () => ({ byAddr: {}, byDom: {} }); // 그때그때 새것 — 판이 다르다
  ctx.mbWhoWhy('a@x.kr'); ctx.mbWhoWhy('a@x.kr');
  assert.equal(n, 6, '★ 다른 판의 색인인데 옛 판정을 썼다');
  assert.deepEqual([ctx.mbWhoWhy('').who, ctx.mbWhoWhy(' ').who], ['', ''], '★ 빈 주소에 담당자가 붙었다');
  assert.equal(n, 6, '★ 빈 주소까지 판정했다');
  /* 넘겨받은 색인이 있으면 색인을 또 찾지 않는다 */
  let calls = 0; const FIX = { byAddr: {}, byDom: {} }; ctx.mbWhoIndex = () => { calls++; return FIX; };
  for (let i = 0; i < 50; i++) ctx.mbWhoWhy('c' + i + '@x.kr', FIX);
  assert.equal(calls, 0, '★★ 줄마다 색인을 또 찾는다 — 메일 수만큼 늘어난다');
});

test('★★ ④ 사람이 담당자·스팸을 바꾸면(mbWhoBust) 담아 둔 판정을 버린다', () => {
  const bust = cutFn(SRC, 'function mbWhoBust(');
  for (const k of ['whoWhy', 'whoWhyIdx', 'spamWhy']) assert.match(bust, new RegExp('delete m0\.' + k + ';'), '★ ' + k + ' 를 안 버린다 — 바꾼 것이 안 보인다');
});

test('★★★ ⑤ 메일 줄 모음(mbAllRows)은 그리는 동안 한 벌 · 받는 쪽은 사본을 받는다 (2026-10-03 메일창 확인)', () => {
  const f = cutFn(SRC, 'function mbAllRows(');
  assert.match(f, /if\(_c && _c\[id\]\) return _c\[id\]\.slice\(\);/, '★★★ 그릴 때마다 1,887통을 새 줄로 또 만든다');
  assert.match(f, /return _c \? rows\.slice\(\) : rows;/, '★ 담아 둔 배열을 그대로 건넨다 — 받는 쪽이 줄 세우면 바뀐다');
});

test('★★★ ⑥ 돌려 쓰는 객체는 원본(_src)을 가리킬 때만 기억한다 — 첫 메일 답이 모든 메일에 가면 안 된다', () => {
  let n = 0;
  const ctx = { WeakMap, JSON, String, Object, _mbMemo: null, _mbJudge: null, _mbPut: {}, _mbBinRule: {}, _mbWhoMsg: {}, _mbCo: {}, _mbNotSpam: {},
    _mbSpamOff: false, _mbBins: {}, _mbFolders: {},
    mbPutOf: () => '', mbRuleBinOf: v => (n++, v.e === 'a' ? 'A' : 'B'), mbBinOfFolder: () => null };
  vm.createContext(ctx);
  vm.runInContext(['function mbMemoClear(){ _mbMemo = null; }', cutFn(SRC, 'function mbMemoOf('), cutFn(SRC, 'function mbJudgeKey('),
    cutFn(SRC, 'function mbJudgeSig('), cutFn(SRC, 'function mbJudge('), cutFn(SRC, 'function mbBinIdOfRow(')].join('\n'), ctx);
  const v = { e: 'a', _reuse: 1 };
  assert.equal(ctx.mbBinIdOfRow(v), 'A'); v.e = 'b';
  assert.equal(ctx.mbBinIdOfRow(v), 'B', '★★★ 원본 없이 돌려 쓰는 객체에 첫 답을 또 줬다 — 담당자 셈이 통째로 틀린다');
  const ra = { e: 'a' }, rb = { e: 'b' };
  v.e = 'a'; v._src = ra; assert.equal(ctx.mbBinIdOfRow(v), 'A');
  v.e = 'b'; v._src = rb; assert.equal(ctx.mbBinIdOfRow(v), 'B', '★★★ 원본이 바뀌었는데 앞 메일 답을 줬다');
  const before = n; ctx.mbMemoClear(); ctx.mbBinIdOfRow({ _src: ra, e: 'a' });
  assert.equal(n, before, '★ 같은 원본은 다시 그려도 한 번만 판정');
  assert.ok(SRC.includes("v.e = row.e; v.r = row.r; v._slug = slug; v._key = slug + ':' + uid; v._src = row;"), '★★ 담당자 셈이 원본을 안 가리킨다');
  assert.ok(SRC.includes("_key:slug+':'+uid, _src:v }));"), '★★ 메일 줄 모음이 원본을 안 가리킨다');
  assert.ok(cutFn(SRC, 'function mbWhoBust(').includes('delete m0.judge;'), '★ 담당자·분류가 바뀌어도 그리는 동안의 판정 서명을 붙든다');
});
