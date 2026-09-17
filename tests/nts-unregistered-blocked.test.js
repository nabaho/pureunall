/* ══════ 국세청에 «없는» 사업자등록번호를 사진첩이 막는다 (대표 지시 2026-09-17) ══════

   ■ 무엇이 있었나
     대표께서 기업정보함의 한 회사를 짚으시며 「캡쳐3 정보는 오류로 잘못 입력된 것이다.
     이런부분은 사진첩에 어떻게 처리하는게 좋은가?」 하셨다.
     그 회사의 사업자번호는 `587-86-01913` — **국세청에 없는 번호**다.

   ★★★ 왜 체크섬이 못 막았나
     587-86-01913 은 검산을 «통과한다». 앞 아홉 자리 가중합이 137 이라 검사자리가 3 이고,
     적힌 것도 3 이다. 자릿수도 맞다. 즉 **기계적으로는 흠이 없는 번호**다.
     이런 번호는 오직 국세청만 가려낼 수 있다.

   ★★★ 그런데 그 답을 우리가 «안 읽고 있었다»
     국세청은 없는 번호에 대해 `b_stt`(상태)를 **비우고** `tax_type` 에
     「국세청에 등록되지 않은 사업자등록번호입니다.」를 담아 준다.
     `js/pu-doc-read.js` 는 `out.ntsState = row.b_stt || null` 로 **b_stt 만** 봤다.
     그래서 없는 번호가 「물어봤는데 아무 말도 없더라」가 되어
     **자동 입력 문이 그냥 열렸다.** 그 값이 기업정보함까지 걸어 들어간 것이다.

   ⚠ 이 검사는 실제 서버에 붙지 않는다 — fetch 를 가짜로 주입한다.
     검사에 쓰는 번호는 체크섬으로 만든 값이거나 대표가 짚어 주신 그 번호다.

   node --test tests/nts-unregistered-blocked.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { cutFn } = require('./cut-fn');

const ROOT = path.join(__dirname, '..');
const DR_SRC = fs.readFileSync(path.join(ROOT, 'js', 'pu-doc-read.js'), 'utf8');
const CARDS = fs.readFileSync(path.join(ROOT, 'pu-cards.html'), 'utf8').split('\r\n').join('\n');
const PHOTOS = fs.readFileSync(path.join(ROOT, 'pu-photos.html'), 'utf8').split('\r\n').join('\n');

function loadRead() {
  const sandbox = { window: {}, console };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  new vm.Script(DR_SRC, { filename: 'pu-doc-read.js' }).runInContext(sandbox);
  return sandbox.window.PuDocRead;
}

/* 1x1 png — 사진이 «있기»만 하면 된다(판독은 가짜 서버가 한다) */
const DUMMY_IMG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

/* 국세청이 실제로 주는 꼴 — 없는 번호는 b_stt 가 비고 tax_type 에 안내문이 온다.
   (PR #1239 때 진짜 응답으로 확인해 둔 꼴이다 — pu-cards 의 coNtsWord 머리 주석에도 적혀 있다.) */
const 없는번호답 = { data: [{ b_no: '5878601913', b_stt: '', tax_type: '국세청에 등록되지 않은 사업자등록번호입니다.' }] };

function 가짜서버(geminiText, ntsResult) {
  const seen = { nts: 0 };
  const fn = function (url) {
    if (String(url).indexOf('odcloud') >= 0) {
      seen.nts++;
      return Promise.resolve({ ok: true, json: () => Promise.resolve(ntsResult) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({
      candidates: [{ content: { parts: [{ text: geminiText }] } }] }) });
  };
  fn.seen = seen;
  return fn;
}

function 등록증읽기(bizno, ntsResult) {
  const R = loadRead();
  const f = 가짜서버(JSON.stringify({ kind: 'bizreg', company: '가나상사', bizno: bizno }), ntsResult);
  R.init({ fetch: f, getKey: () => Promise.resolve('KEY'), getNtsKey: () => Promise.resolve('NTS') });
  return R.read(DUMMY_IMG).then(r => ({ R, r, f }));
}

/* ── ★ 왜 체크섬으로는 못 막는가 ───────────────────────────────────────── */

test('★★★ 대표가 짚으신 그 번호는 체크섬을 «통과한다» — 국세청만 가릴 수 있다', () => {
  const R = loadRead();
  assert.equal(R.bizNoValid('587-86-01913'), true,
    '★★★ 이것이 이 일의 전부다 — 검산으로 막을 수 있었다면 국세청을 안 물어도 됐다');
});

/* ── ★★★ 진짜 문제: 없는 번호가 자동으로 들어갔다 ───────────────────── */

test('★★★ 국세청에 «없는» 번호는 자동으로 안 들어간다', async () => {
  const { R, r } = await 등록증읽기('587-86-01913', 없는번호답);
  assert.equal(r.bizNoOk, true, '번호 «모양»은 멀쩡하다 — 그래서 이 문이 필요하다');
  assert.equal(r.ntsChecked, true);
  const v = R.autoOk(r);
  assert.equal(v.auto, false,
    '★★★ 여기가 열려 있어서 587-86-01913 이 기업정보함까지 걸어 들어갔다');
  assert.match(v.why, /없는 사업자등록번호/);
});

test('★★★ 안내문을 «담는다» — b_stt 만 보던 옛 길에서는 여기가 null 이었다', async () => {
  const { r } = await 등록증읽기('587-86-01913', 없는번호답);
  assert.equal(r.ntsState, '국세청에 등록되지 않은 사업자등록번호입니다.');
  assert.equal(r.ntsFound, false, '★★ 「없다」를 «값으로» 남긴다 — 글을 다시 뒤지지 않게');
});

test('★★ 「국세청에 국세청에 …」로 겹쳐 적지 않는다 — 사람이 읽을 글이다', async () => {
  const { R, r } = await 등록증읽기('587-86-01913', 없는번호답);
  const why = R.autoOk(r).why;
  assert.ok(why.indexOf('국세청에 국세청에') < 0, '겹쳐 적힌 글: ' + why);
  assert.ok(!/[A-Za-z]{4,}/.test(why), '영어 내부 용어가 노출됩니다: ' + why);
});

/* ── ⚠ 「없다」와 「못 물어봤다」를 가른다 ─────────────────────────────── */

test('★★★ 못 물어봤으면 «막지 않는다» — 모르는 것을 「없다」로 단정하지 않는다', () => {
  const R = loadRead();
  const v = R.autoOk({ kind: 'bizreg', fields: { company: '가나상사' },
    bizNoOk: true, ntsChecked: false, ntsState: null, ntsFound: null, error: null });
  assert.equal(v.auto, true,
    '★★★ 국세청이 답을 안 줬다고 멀쩡한 등록증을 「확인 필요」로 쌓으면, 치울 수 없는 할 일이 목록을 못 믿게 만든다');
});

test('★★ 열쇠가 없어 아예 안 물어본 때도 그대로 자동이다', async () => {
  const R = loadRead();
  const f = 가짜서버('{"kind":"bizreg","company":"가나상사","bizno":"220-81-62517"}', 없는번호답);
  R.init({ fetch: f, getKey: () => Promise.resolve('KEY'), getNtsKey: () => Promise.resolve('') });
  const r = await R.read(DUMMY_IMG);
  assert.equal(f.seen.nts, 0, '열쇠가 없으면 부를 수 없다');
  assert.equal(r.ntsChecked, false);
  assert.equal(r.ntsFound, null);
  assert.equal(R.autoOk(r).auto, true);
});

test('★★ 국세청이 상태도 안내문도 안 주면 «막지 않는다»', () => {
  const R = loadRead();
  assert.equal(R.ntsFound({ b_stt: '', tax_type: '' }), null);
  const v = R.autoOk({ kind: 'bizreg', fields: { company: '가나상사' },
    bizNoOk: true, ntsChecked: true, ntsState: null, ntsFound: null, error: null });
  assert.equal(v.auto, true);
});

/* ── ⚠⚠ 옛 결과를 깨뜨리지 않는다 ──────────────────────────────────────
   ntsFound 는 오늘 생긴 칸이다. 이미 읽어 둔 결과에는 «없다».
   없다고 「모른다」로 두면 지난주에 읽어 둔 「폐업자」가 오늘 갑자기 자동으로 통과한다. */

test('★★★ 옛 결과(ntsFound 가 아예 없다)의 폐업자는 «여전히» 막힌다', () => {
  const R = loadRead();
  const v = R.autoOk({ kind: 'bizreg', fields: { company: '가나상사' },
    bizNoOk: true, ntsChecked: true, ntsState: '폐업자', error: null });
  assert.equal(v.auto, false,
    '★★★ 새 칸이 없다고 옛 결과가 풀리면, 고치려던 것보다 더 나쁜 구멍이 된다');
  assert.match(v.why, /폐업/);
});

test('★★ 옛 결과의 계속사업자는 «여전히» 자동이다', () => {
  const R = loadRead();
  const v = R.autoOk({ kind: 'bizreg', fields: { company: '가나상사' },
    bizNoOk: true, ntsChecked: true, ntsState: '계속사업자', error: null });
  assert.equal(v.auto, true);
});

test('★★ 안내문만 남아 있는 옛 결과도 «글을 보고» 막는다', () => {
  const R = loadRead();
  const v = R.autoOk({ kind: 'bizreg', fields: { company: '가나상사' }, bizNoOk: true,
    ntsChecked: true, ntsState: '국세청에 등록되지 않은 사업자등록번호입니다.', error: null });
  assert.equal(v.auto, false);
  assert.match(v.why, /없는 사업자등록번호/);
});

/* ── 멀쩡한 번호는 건드리지 않는다 ───────────────────────────────────── */

test('★★ 계속사업자는 그대로 자동으로 들어간다', async () => {
  const { R, r } = await 등록증읽기('220-81-62517',
    { data: [{ b_stt: '계속사업자', tax_type: '부가가치세 일반과세자' }] });
  assert.equal(r.ntsState, '계속사업자', '★★ 세금 갈래가 상태말을 밀어내면 안 된다');
  assert.equal(r.ntsFound, true);
  assert.equal(R.autoOk(r).auto, true);
});

test('★ 휴업자는 국세청이 준 말 그대로 사람에게 보인다', async () => {
  const { R, r } = await 등록증읽기('220-81-62517', { data: [{ b_stt: '휴업자' }] });
  const v = R.autoOk(r);
  assert.equal(v.auto, false);
  assert.match(v.why, /휴업자/);
});

test('★★ 국세청 답이 이상해도 판독 결과는 살린다 — 회사 이름은 그대로 있다', async () => {
  const { r } = await 등록증읽기('587-86-01913', 없는번호답);
  assert.equal(r.fields.company, '가나상사');
  assert.equal(r.error, null, '★★ 국세청 일이 판독 실패로 번지면 사진이 통째로 버려진다');
});

/* ── 한 묶음에 서류가 여럿일 때 ───────────────────────────────────────── */

test('★★ 쪽마다 갈라 읽어도 «없다»가 딸려 간다 — docs 에서 빠지면 그 쪽만 샌다', async () => {
  const R = loadRead();
  const f = 가짜서버(JSON.stringify({ docs: [
    { pages: [1], kind: 'bizreg', fields: { company: '가나상사', bizno: '587-86-01913' } },
    { pages: [2], kind: 'card', fields: { name: '홍길동' } }
  ] }), 없는번호답);
  R.init({ fetch: f, getKey: () => Promise.resolve('KEY'), getNtsKey: () => Promise.resolve('NTS') });
  const r = await R.read(DUMMY_IMG);
  assert.ok(Array.isArray(r.docs) && r.docs.length === 2, '두 서류로 갈리지 않았습니다');
  assert.equal(r.docs[0].ntsFound, false, '★★ 여기가 비면 쪽으로 갈린 등록증만 조용히 통과한다');
  assert.equal(r.docs[0].ntsState, '국세청에 등록되지 않은 사업자등록번호입니다.');
});

/* ── ★★★ 기업정보함과 «같은 규칙»인가 ────────────────────────────────
   국세청 응답을 읽는 자리가 둘이다(사진첩 판독층 · 기업정보함 훑기).
   두 곳이 같은 답을 다르게 읽으면 한쪽만 막는 구멍이 다시 생긴다. */

function 기업정보함규칙() {
  const ctx = { console, String, Object };
  vm.createContext(ctx);
  vm.runInContext([cutFn(CARDS, 'function coNtsWord('), cutFn(CARDS, 'function coNtsCls(')].join('\n'), ctx);
  return ctx;
}

test('★★★ 사진첩과 기업정보함이 «같은 말»을 뽑는다 — 한 응답, 한 답', () => {
  const R = loadRead();
  const co = 기업정보함규칙();
  const 답들 = [
    { b_stt: '계속사업자', tax_type: '부가가치세 일반과세자' },
    { b_stt: '폐업자' },
    { b_stt: '휴업자' },
    { b_stt: '', tax_type: '국세청에 등록되지 않은 사업자등록번호입니다.' },
    { b_stt: '', tax_type: '' },
    {}
  ];
  답들.forEach(function (row) {
    assert.equal(R.ntsWord(row), co.coNtsWord(row),
      '★★★ 두 곳이 갈리면 한쪽만 막는 구멍이 다시 생긴다: ' + JSON.stringify(row));
  });
});

test('★★ 기업정보함은 그 안내문을 «흐린 빛»으로 본다 — 좋지도 나쁘지도 않다', () => {
  const co = 기업정보함규칙();
  assert.equal(co.coNtsCls('국세청에 등록되지 않은 사업자등록번호입니다.'), 'dim');
});

/* ── ★★ 사진첩 화면이 «거짓말»하지 않는다 ───────────────────────────── */

test('★★★ 사진첩 한 줄이 「번호 확인됨」이라고 하지 않는다 — 막은 까닭을 적는다', async () => {
  const { R, r } = await 등록증읽기('587-86-01913', 없는번호답);
  const v = R.autoOk(r);

  /* pu-photos 의 그 함수를 «실제로 돌린다» — 글자만 찾으면 순서가 뒤집혀도 통과한다 */
  const ctx = { console, String };
  vm.createContext(ctx);
  vm.runInContext([
    'function readLabel(){ return "사업자등록증"; }',
    'function readAnyField(){ return true; }',
    cutFn(PHOTOS, 'function readLine(')
  ].join('\n'), ctx);

  const 줄 = ctx.readLine(Object.assign({}, r, { auto: v.auto, why: v.why }));
  assert.ok(줄.indexOf('번호 확인됨') < 0,
    '★★★ 없는 번호를 「번호 확인됨」이라 적으면 사람이 그대로 믿고 넘긴다: ' + 줄);
  assert.match(줄, /없는 사업자등록번호/);
});
