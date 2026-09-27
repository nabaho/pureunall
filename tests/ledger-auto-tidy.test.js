'use strict';
/* 거래내역 «🤖 저절로 확정» (대표 「추천대로」 2026-09-27)

   ■ 배경
     엄격한 세 조건 검사 erpAutoTidyOk(입금자 3번 확정 · 금액 꼭 같음 · 점수 90)가 만들어져 있었지만
     «아무 데서도» 안 불렸다. 2026-08-09 에 자동 갈래를 걷어낸 까닭은 «갈래마다 저장이 달라
     결과가 어긋났다»였다 — 그래서 이번에는 저장 길을 새로 만들지 않는다.
   ■ 규칙
     ⓐ 대상은 «초록(확정 가능)» 줄 안에서만, 그 검사를 통과한 것만 — 사람이 고른 줄·수수료 뺀 줄 제외.
     ⓑ 저장은 일괄 확정과 «같은 길»(confirmReadyList) 하나.
     ⓒ 처음에는 꺼져 있다 — 켜는 것은 대표(모든 PC 공통 app_settings.ledgerAutoTidy).
     ⓓ 켜져도 관리자 화면·입금 탭·추천 셈이 끝난 뒤·같은 추천 지문으로 한 번만 돈다.
     ⓔ 후보 수를 늘 보인다 — 켜기 전에 몇 건인지 눈으로 보고 정한다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { stripComments } = require('./strip-comments');

const SRC = stripComments(fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n'));
const UI = SRC.slice(SRC.indexOf('function FinanceLedger('), SRC.indexOf('\nfunction FinanceIncome('));

test('ⓐ ★★ 대상은 초록 줄 안에서, 세 조건 검사를 통과한 것만', () => {
  const at = UI.indexOf('var autoRows = readyRows.filter(');
  assert.ok(at > 0, '★★ 저절로 확정 대상이 초록 줄(readyRows)에서 나오지 않습니다');
  const f = UI.slice(at, at + 400);
  assert.match(f, /erpAutoTidyOk\(g\.head, /, '★★ 세 조건 검사를 안 거칩니다 — 금액만 맞으면 엉뚱한 업체에 붙습니다(2026-09-15 사고)');
  assert.match(f, /g\.picked/, '★ 사람이 골라 둔 줄까지 저절로 확정합니다');
  assert.match(f, /r\.fee/, '★ 수수료를 뺀 줄까지 저절로 확정합니다');
});

test('ⓑ ★★ 저장은 일괄 확정과 같은 길 하나', () => {
  assert.equal((UI.match(/function confirmReadyList\(/g) || []).length, 1);
  assert.match(UI, /confirmReadyList\(readyRows\)/, '일괄 확정이 같은 길을 안 씁니다');
  assert.match(UI, /confirmReadyList\(autoRows\)/, '★★ 저절로 확정이 따로 저장합니다 — 갈래가 둘이 되면 결과가 어긋납니다');
});

test('ⓒ ★★ 처음에는 꺼져 있다 — 모든 PC 공통 칸, «참»일 때만 켜짐', () => {
  assert.match(UI, /return st\.ledgerAutoTidy === true;/, '★★ 값이 없을 때 켜집니다 — 돈을 사람 대신 적는 일은 대표가 켜야 합니다');
  assert.match(UI, /dbSet\('app_settings', Object\.assign\(\{\}, cur, \{ ledgerAutoTidy:v \}\)\)/, '★ 설정이 이 PC 에만 남습니다');
});

test('ⓓ ★★ 켜져도 조건이 다 맞을 때 한 번만', () => {
  const at = UI.indexOf('if(!autoTidyOn || !_meNow().isAdmin');
  assert.ok(at > 0, '★★ 저절로 확정이 켜기·관리자 조건 없이 돕니다');
  const g = UI.slice(at, at + 400);
  assert.match(g, /ldTabEff !== 'inc'/, '★ 출금 탭에서도 돕니다');
  assert.match(g, /_sugComputing/, '★★ 추천 셈이 끝나기 전에 옛 추천으로 확정합니다 — 방금 받은 것을 또 받습니다');
  assert.match(g, /_autoTidyDone\.current === _sugSig/, '★ 같은 추천으로 되풀이합니다');
});

test('ⓔ ★ 후보 수를 늘 보이고, 눌러서 그 줄만 본다 · 확정 단추는 여전히 하나', () => {
  assert.match(UI, /'🤖 저절로 확정 후보 '\+autoRows\.length\+'건'/, '★ 후보 수가 안 보입니다');
  assert.match(UI, /if\(ldStF === 'auto'\) return !!autoKeys\[r\._k\];/, '★ 후보만 보는 거르개가 없습니다');
  assert.equal((UI.match(/모두 확정/g) || []).length, 1, '확정 단추가 둘이 됐습니다');
});
