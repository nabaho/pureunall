'use strict';
/* 비용은 «관리자만» 본다 (대표 지시 2026-09-12 「다른직원들은 비용나가는것 못보고 관리자만 볼수 있게」)

   ■ 어디가 새고 있었나
     포털 딱지(enter.html)는 처음부터 관리자에게만 떴다. 새는 자리는 **사진첩**이었다 —
     ⚙ 설정의 「이번 달 요금」 줄과 판독 띠·물음창이 직원 누구에게나 ₩ 를 적었다.
     사진첩은 전 직원이 쓰는 앱이라, 그 줄은 사실상 모두에게 보인다.

   ■ 규칙
     ⓐ 금액(₩)을 그리는 자리는 모두 moneyOpen() 을 먼저 본다.
     ⓑ 「멈췄다」는 사실은 **그대로 모두에게** 알린다 — 감추는 것은 «얼마»뿐이다.
     ⓒ 관리자 판정은 한 곳(moneyOpen)에서만 한다 — 화면마다 제 나름대로 재면
        한 자리만 고쳐지고 나머지가 남는다. */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { test } = require('node:test');
const { stripComments: strip } = require('./strip-comments');
const { cutFn } = require('./cut-fn');

const R = path.join(__dirname, '..');
const PHOTOS = strip(fs.readFileSync(path.join(R, 'pu-photos.html'), 'utf8').replace(/\r\n/g, '\n'));
const ENTER = strip(fs.readFileSync(path.join(R, 'enter.html'), 'utf8').replace(/\r\n/g, '\n'));

test('① ★★ 관리자 판정은 «한 곳»에만 있다 — moneyOpen', function () {
  assert.match(PHOTOS, /function moneyOpen\(\)/, '★★ 돈 보임을 가리는 자리가 없습니다');
  assert.match(cutFn(PHOTOS, 'function moneyOpen('), /amAdmin\(\)/,
    '★ moneyOpen 이 관리자 여부를 안 봅니다');
});

test('② ★★ 설정의 「이번 달 요금」 줄이 직원에게 ₩ 를 안 적는다', function () {
  const fn = cutFn(PHOTOS, 'function renderAiBudget(');
  assert.ok(fn, '설정 카드 그리는 자리를 못 찾았습니다');
  /* 금액을 그리는 줄(wonText)은 moneyOpen 갈래 «뒤»에 와야 한다 */
  const 갈래 = fn.indexOf('!moneyOpen()');
  assert.ok(갈래 > 0, '★★ 관리자 아닌 사람 갈래가 없습니다 — ₩ 가 그대로 보입니다');
  assert.ok(갈래 < fn.indexOf('wonText(s.spent)'),
    '★★ 금액을 먼저 그린 뒤에 관리자인지 봅니다 — 순서가 뒤집혔습니다');
  /* ⚠ 조건에 «다른 것을 덧붙이지» 말 것 — 「!moneyOpen() && 무엇」 이 되는 순간
     그 무엇이 거짓인 직원에게는 금액 줄이 그대로 그려진다. 관리자가 아니면
     **언제나** 이 갈래로 가야 한다. 검사고정-허용: 이 «모양»이 곧 규칙이다. */
  assert.match(fn, /\}\s*else if \(!moneyOpen\(\)\) \{/,
    '★★ 직원 갈래에 다른 조건이 붙었습니다 — 어떤 직원에게는 ₩ 가 그대로 보입니다');
  /* 대신 «횟수»는 적는다 — 빈 자리로 두면 고장인지 안 쓴 것인지 모른다 */
  const 뒤 = fn.slice(갈래, fn.indexOf('wonText(s.spent)'));
  assert.match(뒤, /s\.reads\.toLocaleString\('ko-KR'\) \+ '번'/,
    '★ 금액을 감추면서 횟수도 안 보여 줍니다');
});

test('③ ★★ 경고선 조각은 직원에게 아예 안 나온다', function () {
  const fn = cutFn(PHOTOS, 'function aiSpendChip(');
  assert.ok(fn, '경고 조각 자리를 못 찾았습니다');
  assert.ok(fn.indexOf('!moneyOpen()') > 0 && fn.indexOf('!moneyOpen()') < fn.indexOf('wonText('),
    '★★ 경고 조각이 직원에게 금액을 적습니다');
});

test('④ ★★ 「한도 다 씀」 띠는 «모두에게» 그대로 뜬다 — 감추는 것은 금액뿐이다', function () {
  const at = PHOTOS.indexOf('🛑 이번 달 AI 판독 한도를 다 썼습니다');
  assert.ok(at > 0, '한도 초과 띠를 못 찾았습니다');
  const 구역 = PHOTOS.slice(at - 700, at + 900);
  assert.match(구역, /moneyOpen\(\)/, '★★ 띠가 직원에게 금액을 그대로 적습니다');
  /* ⚠ 띠 «자체»를 관리자로 막으면 안 된다 — 왜 안 읽히는지 알 길이 없어진다 */
  assert.ok(!/if\s*\(\s*!moneyOpen\(\)\s*\)\s*\{?\s*(return|el\.style\.display\s*=\s*'none')/.test(구역),
    '★★ 관리자가 아니라고 띠를 통째로 감췄습니다 — 「왜 안 읽히나」에 답이 없어집니다');
  assert.match(구역, /자동만 멈췄습니다/, '★ 멈췄다는 말이 사라졌습니다');
});

test('⑤ ★ 한도 넘은 뒤 물음창도 직원에게는 금액을 안 적는다 — 묻기는 그대로 묻는다', function () {
  const fn = cutFn(PHOTOS, 'function okOverBudget(');
  assert.ok(fn, '물음창 자리를 못 찾았습니다');
  assert.match(fn, /moneyOpen\(\)/, '★★ 물음창이 직원에게 금액을 적습니다');
  assert.match(fn, /confirm\(/, '★ 물음 자체가 사라졌습니다 — 모르고 돈을 쓰게 됩니다');
});

test('⑥ ★★ 포털 딱지 둘은 예전 그대로 관리자 전용이다', function () {
  ['function billStart(', 'function aiChipStart('].forEach(function (n) {
    const fn = cutFn(ENTER, n);
    assert.ok(fn, n + ' 자리를 못 찾았습니다');
    assert.match(fn, /billIsAdmin\(role\)/, '★★ ' + n + ' 이 관리자 확인을 안 합니다');
  });
});

test('⑦ ★ 진짜 요금(billing) 읽기는 서버 규칙이 관리자로 막고 있다', function () {
  const RULES = fs.readFileSync(path.join(R, 'scripts', 'make-firebase-rules.js'), 'utf8');
  const at = RULES.indexOf('rules.billing = {');
  assert.ok(at > 0, '요금 규칙 자리를 못 찾았습니다');
  const 구역 = RULES.slice(at, at + 400);
  assert.match(구역, /'\.read':\s*`auth != null && \$\{ADMIN\}`/,
    '★★ 진짜 요금을 직원 누구나 읽습니다 — 화면만 감춰서는 못 막습니다');
});
