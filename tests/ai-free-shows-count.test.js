'use strict';
/* 무료로 쓰는 중이면 «금액 대신 횟수»를 보인다 (대표 지시 2026-09-12 「무료는 횟수만 보이게」)

   ■ 왜
     화면이 「AI 판독 ₩44 / 30,000」 이라 적고 있었는데, 그 ₩44 는 진짜 청구액이 아니라
     «판독 횟수 × 단가(기본 ₩4)» 로 낸 어림이다. 무료 등급으로 쓰는 동안에는
     실제로 나가는 돈이 없는데도 금액이 쌓이는 것처럼 보인다.

   ■ 규칙
     단가(wonPerRead)가 0 이면 «무료»다 → 금액을 감추고 몇 번 썼는지를 보인다.
   ⚠ ₩0 이라고 적지 «말 것» — 「안 썼다」로 읽힌다. 쓴 것은 맞고 돈이 안 들 뿐이다.
   ⚠ 무료라고 «세기»를 멈추지 말 것 — 유료로 바뀌는 날 단가만 채우면 그날부터 맞는다. */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');
const { test } = require('node:test');
const { cutFn } = require('./cut-fn');

const R = path.join(__dirname, '..');

/* 화면 쪽 셈을 «진짜 파일»에서 그대로 싣는다 — pu-billing.js 는 브라우저용이라 require 로는 안 열린다 */
const PB = (function () {
  const box = { window: undefined };
  box.globalThis = box;
  vm.createContext(box);
  vm.runInContext(fs.readFileSync(path.join(R, 'js', 'pu-billing.js'), 'utf8'), box);
  return box.PuBilling;
})();
const ENTER = fs.readFileSync(path.join(R, 'enter.html'), 'utf8').replace(/\r\n/g, '\n');
const PHOTOS = fs.readFileSync(path.join(R, 'pu-photos.html'), 'utf8').replace(/\r\n/g, '\n');

const 셈 = function (won, reads) {
  return PB.aiSummarize({ limit: 30000, warn: 25000, wonPerRead: won }, { _all: { n: reads } });
};

test('① ★★ 단가가 0 이면 «무료»로 본다', function () {
  assert.equal(셈(0, 11).free, true, '★★ 단가 0 인데 무료로 안 봅니다');
  assert.equal(셈(4, 11).free, false, '★ 단가가 있는데 무료로 봅니다');
});

test('② ★ 무료여도 «횟수는 그대로 센다» — 유료로 바뀌는 날의 근거다', function () {
  const s = 셈(0, 11);
  assert.equal(s.has, true, '★ 무료라고 아예 안 그립니다');
  assert.equal(s.reads, 11, '★★ 무료면 횟수를 안 셉니다 — 나중에 근거가 사라집니다');
  assert.equal(s.spent, 0, '단가 0 이면 어림값도 0 입니다');
});

test('③ ★★ 무료일 때 «막지» 않는다 — 돈이 안 드는데 멈추면 안 된다', function () {
  const s = 셈(0, 99999);
  assert.equal(s.over, false, '★★ 무료인데 한도에 걸려 판독이 멈춥니다');
  assert.equal(s.near, false, '★ 무료인데 경고가 뜹니다');
  assert.equal(s.tone, 'ok');
});

test('④ ★ 유료면 예전 그대로 — 금액·한도·경고가 살아 있다', function () {
  assert.equal(셈(4, 11).spent, 44, '★ 어림 셈이 바뀌었습니다 (11 × 4)');
  assert.equal(셈(4, 7600).over, true, '★ 한도를 안 막습니다');   /* 7,600 × 4 = 30,400 > 30,000 */
  assert.equal(셈(4, 6300).near, true, '★ 경고선을 안 봅니다');
});

test('⑤ ★★ 포털 딱지가 무료일 때 «횟수»를 그린다 — ₩0 을 띄우지 않는다', function () {
  const at = ENTER.indexOf('function aiChipPaint(');
  assert.ok(at > 0, '포털 딱지 그리는 자리를 못 찾았습니다');
  const 구역 = ENTER.slice(at, at + 2200);
  assert.match(구역, /if\(s\.free\)\{/, '★★ 무료 갈래가 없습니다 — ₩0 이 그대로 뜹니다');
  /* 무료 갈래가 «먼저» 와야 한다 — 뒤에 두면 금액 줄이 이미 그려 버린다 */
  assert.ok(구역.indexOf('if(s.free){') < 구역.indexOf("$('aiAmt').textContent = (s.over"),
    '★★ 금액을 먼저 그린 뒤에 무료를 봅니다 — 순서가 뒤집혔습니다');
  assert.match(구역, /s\.reads\.toLocaleString\('ko-KR'\) \+ '번'/, '★ 횟수를 안 그립니다');
});

test('⑥ ★ 사진첩 설정 카드도 같은 규칙이다 — 두 화면이 다른 말을 하면 안 된다', function () {
  /* ⚠ 자릿수로 잘라 보지 «말 것» — 함수가 길어지면 창 밖으로 밀려나 헛도는 검사가 된다
     (2026-09-12 에 실제로 그렇게 됐다). 중괄호를 세어 함수 전체를 그대로 본다. */
  const 구역 = cutFn(PHOTOS, 'function renderAiBudget(');
  assert.match(구역, /else if \(s\.free\)/, '★★ 사진첩은 아직 ₩0 이라 적습니다');
  assert.match(구역, /무료/, '★ 무료라는 말이 없습니다');
});

test('⑦ ★ 셈은 «한 곳»에만 — 화면이 제 나름대로 무료를 판단하지 않는다', function () {
  /* free 를 화면에서 다시 셈하면(=== 0 을 또 적으면) 한쪽만 고쳐져 어긋난다 */
  const 포털 = ENTER.slice(ENTER.indexOf('function aiChipPaint('), ENTER.indexOf('function aiChipPaint(') + 2200);
  assert.ok(!/wonPerRead\s*===\s*0/.test(포털),
    '★ 포털이 무료 여부를 제 나름대로 셉니다 — pu-billing 의 s.free 만 볼 것');
  const 사진 = cutFn(PHOTOS, 'function renderAiBudget(');
  assert.ok(!/wonPerRead\s*===\s*0/.test(사진), '★ 사진첩이 무료 여부를 제 나름대로 셉니다');
});
