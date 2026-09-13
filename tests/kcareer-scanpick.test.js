'use strict';
/* 폴더 스캔 — 「어느 화면에 넣을지」 골라서 등록 (대표 지시 2026-09-13 「폴더 스캔 위촉장 다시 넣어라」)
   ────────────────────────────────────────────────────────────────────────
   ■ 왜  스캔은 «다섯 화면에 한꺼번에» 들어가는데 고를 길이 없었다.
     실측(대표 서류 폴더 3,986개): 승격 **359건** =
       위촉장 112 · 협약서 13 · 표창 24 · 자격·수료 37 · 경력증명서 173.
     「위촉장만」 다시 넣고 싶어도 359건이 통째로 들어간다.
     ⚠ 자격·수료는 이미 22건이 있고, 스캔 줄은 기관·내용이 «비어 있어» 중복 판정에 걸리지도
       않는다 — 그대로 누르면 중복이 쌓인다(9월 12일에 실제로 79건이 그렇게 쌓였다).
   ■ 잣대
     · 갈래는 «창고 + 유형» — 위촉장·표창·협약서는 한 창고(wiccok)에 있어 창고만으로는 못 가른다.
     ⚠★ 기본값은 «모두 켜짐» — 오늘까지 하던 것이 그대로 되어야 한다(새 기능이 되던 것을 막으면 안 된다). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');

function 떼기(머리) {
  const i = SRC.indexOf(머리);
  assert.ok(i > 0, 머리 + ' 를 못 찾았습니다');
  let d = 0, started = false;
  for (let p = i; p < SRC.length; p++) {
    const c = SRC[p];
    if (c === '{') { d++; started = true; }
    else if (c === '}') { d--; if (started && d === 0) return SRC.slice(i, p + 1); }
  }
  assert.fail(머리 + ' 의 끝을 못 찾았습니다');
}

function 무대() {
  const ctx = { console: { warn: function () {} }, _scanCtx: null };
  vm.createContext(ctx);
  vm.runInContext([떼기('function _scanGroupKey('),
    SRC.slice(SRC.indexOf('var SCAN_GROUP_LABEL ='), SRC.indexOf('function _scanGroupName(')),
    떼기('function _scanGroupName('), 떼기('function _scanGroups('), 떼기('function _scanPicked(')]
    .join('\n').replace(/^(\s*)const /gm, '$1var '), ctx);
  return ctx;
}

/* 실측 구성 그대로 (359건) */
function 승격더미() {
  const out = [];
  const 넣기 = (n, store, type) => { for (let i = 0; i < n; i++) out.push({ store: store, type: type, name: store + i }); };
  넣기(112, 'wiccok', '위촉장');
  넣기(13, 'wiccok', '협약서');
  넣기(24, 'wiccok', '표창');
  넣기(37, 'cert', '');
  넣기(173, 'certdoc', '');
  return out;
}

/* ══════ 갈래 ══════ */

test('★★★ 한 창고에 든 위촉장·표창·협약서를 «갈라» 센다', () => {
  const ctx = 무대();
  ctx.목록 = 승격더미();
  const g = vm.runInContext('_scanGroups(목록)', ctx);
  const 표 = {}; Array.from(g).forEach(function (x) { 표[x.key] = x.n; });
  assert.equal(표['wiccok|위촉장'], 112, '★★★ 위촉장만 골라낼 수 없으면 359건이 통째로 들어갑니다');
  assert.equal(표['wiccok|협약서'], 13);
  assert.equal(표['wiccok|표창'], 24);
  assert.equal(표['cert'], 37);
  assert.equal(표['certdoc'], 173);
});

test('★★ 많은 것부터 보여 준다 — 무엇이 쏟아지는지 먼저 눈에 들어와야 한다', () => {
  const ctx = 무대();
  ctx.목록 = 승격더미();
  const g = Array.from(vm.runInContext('_scanGroups(목록)', ctx));
  assert.equal(g[0].key, 'certdoc', '가장 많은 것이 맨 앞이어야 합니다');
  assert.equal(g[0].n, 173);
});

test('★ 갈래 이름을 사람 말로 보여 준다 — 창고 이름(certdoc)으로는 무엇인지 모른다', () => {
  const ctx = 무대();
  assert.equal(vm.runInContext('_scanGroupName("wiccok|위촉장")', ctx), '위촉장');
  assert.equal(vm.runInContext('_scanGroupName("wiccok|표창")', ctx), '표창 및 포상');
  assert.equal(vm.runInContext('_scanGroupName("cert")', ctx), '자격증·수료증');
  assert.equal(vm.runInContext('_scanGroupName("certdoc")', ctx), '경력증명서');
  /* 모르는 갈래도 「wiccok|」 같은 속말이 새지 않아야 한다 */
  assert.equal(vm.runInContext('_scanGroupName("wiccok|기타")', ctx), '기타');
});

/* ══════ 고르기 ══════ */

test('★★★ 「위촉장」만 켜면 위촉장 112건만 들어간다', () => {
  const ctx = 무대();
  ctx.목록 = 승격더미();
  ctx.pick = { 'wiccok|위촉장': true, 'wiccok|협약서': false, 'wiccok|표창': false,
               cert: false, certdoc: false };
  const 남음 = Array.from(vm.runInContext('_scanPicked(목록, pick)', ctx));
  assert.equal(남음.length, 112, '★★★ 실제 ' + 남음.length + '건 — 고른 것만 들어가야 합니다');
  남음.forEach(function (p) { assert.equal(p.type, '위촉장'); });
});

test('★★★ 안 고르면 «모두»다 — 오늘까지 하던 것이 그대로여야 한다', () => {
  const ctx = 무대();
  ctx.목록 = 승격더미();
  assert.equal(Array.from(vm.runInContext('_scanPicked(목록, null)', ctx)).length, 359,
    '★★★ 새 기능이 되던 것을 막았습니다');
  assert.equal(Array.from(vm.runInContext('_scanPicked(목록, {})', ctx)).length, 359,
    '★★ 아직 아무것도 안 만진 상태도 «모두»입니다');
});

test('★★ 켠 것만 «참»이 아니라, «끈 것»만 뺀다 — 새 갈래가 생겨도 안 사라진다', () => {
  /* ⚠ 켜짐 목록으로 다루면, 나중에 새 종류가 늘었을 때 목록에 없어 조용히 빠진다 */
  const ctx = 무대();
  ctx.목록 = 승격더미().concat([{ store: 'edu', type: '' }]);
  ctx.pick = { certdoc: false };                 /* 경력증명서만 껐다 */
  const 남음 = Array.from(vm.runInContext('_scanPicked(목록, pick)', ctx));
  assert.equal(남음.length, 359 - 173 + 1, '★★ 끄지 않은 새 갈래(학력)가 사라졌습니다');
});

test('빈 것·이상한 것에 터지지 않는다', () => {
  const ctx = 무대();
  assert.doesNotThrow(function () { vm.runInContext('_scanGroups(null)', ctx); });
  assert.doesNotThrow(function () { vm.runInContext('_scanPicked(null, {})', ctx); });
  assert.equal(vm.runInContext('_scanGroupKey(null)', ctx), '?');
});

/* ══════ 앱에 이어져 있나 ══════ */

test('★★ 미리보기에 고르개가 나오고, 숫자가 «고른 것»을 따라간다', () => {
  const fn = 떼기('function renderScanPreview(){');
  assert.match(fn, /_scanPicked\(r\.promotions, _scanCtx\.pickStore\)/, '★★ 고른 것을 안 추립니다');
  assert.match(fn, /_scanCard\('🟢 확실', 고른것\.length/,
    '★★ 머리 숫자가 «전부»면 359 라 적혀 있는데 112건만 들어갑니다');
  assert.match(fn, /data-grp="/, '★★ 고르는 칸이 없습니다');
  assert.match(fn, /어느 화면에 넣을까요\?/, '무엇을 고르는지 말해야 합니다');
  assert.match(fn, /scanPickAll\(true\)/, '★ 「모두」로 되돌릴 길이 있어야 합니다');
  assert.match(fn, /scanPickAll\(false\)/, '★ 「모두 끄기」가 있어야 하나씩 안 끕니다');
  assert.match(fn, /고른것\.slice\(0,50\)/, '목록도 고른 것만 보여야 합니다');
});

test('★★★ 등록도 «고른 것만» 넣는다 — 미리보기와 어긋나면 안 된다', () => {
  const fn = 떼기('function fsCommitScan(){');
  assert.match(fn, /var _쓸것 = _scanPicked\(r\.promotions, _scanCtx\.pickStore\)/,
    '★★★ 미리보기에서 112건을 보고 눌렀는데 359건이 들어갑니다');
  assert.match(fn, /_쓸것\.forEach\(function\(p\)\{/, '★★ 추린 것을 써야 합니다');
  assert.ok(!/r\.promotions\.forEach\(function\(p\)\{\s*\n\s*var hit = fsFindAttachTarget\(p, buf\)/.test(fn),
    '★ 옛 길이 남아 있습니다');
  assert.match(fn, /넣을 것이 하나도 없습니다/, '★ 다 껐는데 조용히 끝나면 고장으로 읽힙니다');
});

test('★★ 처음 열 때는 아무것도 안 꺼져 있다 — 기본은 «모두»', () => {
  const fn = 떼기('async function openScanPreview(){');
  assert.match(fn, /pickStore:null/, '★★ 처음부터 걸러 두면 되던 것이 막힙니다');
});
