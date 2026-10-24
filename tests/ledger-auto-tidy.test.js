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
  /* 대상은 초록 줄(readyRows)에서만 고른다 — 고르는 꼴(filter/forEach)은 바뀌어도 된다(2026-10-24 계산서 길 추가) */
  const at = UI.search(/var autoRows = (readyRows\.filter\(|\[\];\s*readyRows\.forEach\()/);
  assert.ok(at > 0, '★★ 저절로 확정 대상이 초록 줄(readyRows)에서 나오지 않습니다');
  const f = UI.slice(at, at + 700);
  assert.match(f, /erpAutoTidyOk\(g\.head, /, '★★ 세 조건 검사를 안 거칩니다 — 금액만 맞으면 엉뚱한 업체에 붙습니다(2026-09-15 사고)');
  assert.match(f, /g\.picked/, '★ 사람이 골라 둔 줄까지 저절로 확정합니다');
  assert.match(f, /r\.fee/, '★ 수수료를 뺀 줄까지 저절로 확정합니다');
});

test('ⓑ ★★ 저장은 일괄 확정과 같은 길 하나', () => {
  assert.equal((UI.match(/function confirmReadyList\(/g) || []).length, 1);
  assert.match(UI, /confirmReadyList\(readyRows\)/, '일괄 확정이 같은 길을 안 씁니다');
  /* 저절로 확정은 autoRows(또는 그 안에서 스위치로 거른 것)를 같은 함수로 저장한다 */
  const m = UI.match(/confirmReadyList\((\w+)\)/g) || [];
  const autoCall = m.some(x => x === 'confirmReadyList(autoRows)') ||
    (m.some(x => x === 'confirmReadyList(_go)') && /var _go = autoRows\.filter\(/.test(UI));
  assert.ok(autoCall, '★★ 저절로 확정이 따로 저장합니다 — 갈래가 둘이 되면 결과가 어긋납니다');
});

test('ⓒ ★★ 처음에는 꺼져 있다 — 모든 PC 공통 칸, «참»일 때만 켜짐', () => {
  assert.match(UI, /return st\.ledgerAutoTidy === true;/, '★★ 값이 없을 때 켜집니다 — 돈을 사람 대신 적는 일은 대표가 켜야 합니다');
  assert.match(UI, /dbSet\('app_settings', Object\.assign\(\{\}, cur, \{ ledgerAutoTidy:v \}\)\)/, '★ 설정이 이 PC 에만 남습니다');
});

test('ⓓ ★★ 켜져도 조건이 다 맞을 때 한 번만', () => {
  const at = UI.search(/if\(\(?!autoTidyOn(?: && !autoInvOn\))? \|\| !_meNow\(\)\.isAdmin/);
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

/* ── 🧾 두 번째 길 — 세금계산서 일치 (대표 「시안대로」 2026-10-24) ── */
const FN = (() => { const i = SRC.indexOf('function erpInvoiceAutoOk('); return i < 0 ? '' : SRC.slice(i, SRC.indexOf('\n}\n', i)); })();
test('ⓕ ★★ 계산서 일치 검사 — 점수·CMS 제외·금액 정확·120일·번호로 업체', () => {
  assert.ok(FN, '★★ erpInvoiceAutoOk 가 없습니다');
  assert.match(FN, /< 90\) return false/, '★★ 추천 점수 90 아래도 확정합니다');
  assert.match(FN, /erpIsCmsMemo\(memo\)/, '★★ CMS 적요도 이 길로 갑니다 — 9/15 사고 자리');
  assert.match(FN, /nicebill/, '★★ 나이스빌 묶음도 이 길로 갑니다');
  assert.match(FN, /erpAmountExact\(amt,/, '★★ 금액이 꼭 같은지 안 봅니다');
  assert.match(FN, /gap > 120/, '★ 발행 뒤 기간을 안 봅니다');
  assert.match(FN, /gap < 0/, '★ 입금보다 나중에 끊은 계산서도 증거로 씁니다');
  assert.match(FN, /eb === biz/, '★★ 사업자번호로 업체를 안 봅니다');
  assert.match(FN, /payerOk/, '★★ 입금자가 그 업체인지 안 봅니다');
});
test('ⓖ ★★ 계산서 길은 따로 켠다 — 처음 꺼짐, 그 줄은 그 스위치로만', () => {
  assert.match(UI, /return st\.ledgerAutoTidyInv === true;/, '★★ 값이 없을 때 켜집니다');
  assert.match(UI, /\{ ledgerAutoTidyInv:v \}/, '★ 설정이 모든 PC 공통 칸에 안 남습니다');
  assert.match(UI, /r\.why === 'invoice' \? autoInvOn : autoTidyOn/, '★★ 계산서 줄이 다른 스위치로 확정됩니다');
  assert.match(UI, /erpInvoiceAutoOk\(g\.head, r\.pItem, r\.row\)/, '★★ 계산서 길이 초록 줄 밖에서 돕니다');
});
