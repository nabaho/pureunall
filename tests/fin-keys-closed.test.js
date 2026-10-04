'use strict';
/* 돈·급여 자리는 재무 권한자만 — $other(재직 직원 누구나 읽고 쓰기)로 떨어지지 않는다 (2026-10-04 보안 점검)
   ── 무엇이 열려 있었나
     data 아래 153자리 중 120자리가 규칙에 이름이 없어 $other 로 떨어졌다. 그 가운데 돈·급여:
     법인카드 전체 번호(accounts) · 직원별 급여 바뀌기 전·후 값(payroll_audit_log) · CMS 출금 장부 ·
     통장 입금 처리 기록 · 거래내역 보류·고름·나눔 · 입금자 별칭 · 이체수수료 기억.
     자문료 수입(finance_income)은 막혀 있는데 이것들은 열려 있었다.
   ── 못 박는 것(규칙)
   ① 이 자리들은 규칙 만들개에서 finOnly 다
   ② 이알피의 재무 열쇠 목록(FB_FIN_KEYS — 규칙과 1:1)에도 있다 — 재무 권한 없는 기기의 남은 사본을 지운다
   ③ 카드·계좌 비밀번호를 적는 칸이 없다 — 비밀번호는 어디에도 적지 않는다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const { stripJs } = require('./strip-comments.js');

const R = path.join(__dirname, '..');
const KEYS = ['payroll_audit_log', 'cms_ledger', 'bank_processed', 'ledger_held', 'ledger_picks',
  'ledger_split_recipes', 'payer_aliases', 'finance_bank_fee_last', 'accounts'];

test('① ★★ 돈·급여 자리는 규칙에서 재무 권한자만', () => {
  const out = cp.execFileSync(process.execPath, [path.join(R, 'scripts', 'make-firebase-rules.js')], { cwd: R, encoding: 'utf8' });
  const rules = JSON.parse(out.slice(out.indexOf('{')));
  const d = rules.rules.data;
  const fin = d.finance_income;                  // 이미 막혀 있던 자리와 «같은 잣대»여야 한다
  assert.ok(fin && fin['.read'], 'finance_income 규칙을 못 찾았습니다 — 검사가 헛돕니다');
  KEYS.forEach((k) => {
    assert.ok(d[k], '★★ ' + k + ' 에 규칙 이름이 없습니다 — 재직 직원 누구나 읽고 씁니다($other)');
    assert.equal(d[k]['.read'], fin['.read'], '★★ ' + k + ' 를 재무 권한 없는 사람이 읽습니다');
    assert.equal(d[k]['.write'], fin['.write'], '★ ' + k + ' 를 재무 권한 없는 사람이 씁니다');
  });
});

test('② 이알피의 재무 열쇠 목록에도 있다 — 남은 사본을 지운다 · 부팅 때 안 받는다', () => {
  const B = stripJs(fs.readFileSync(path.join(R, 'pu-erp.html'), 'utf8'));
  const list = (name) => { const m = B.match(new RegExp('var ' + name + ' = \\[([\\s\\S]*?)\\];')); assert.ok(m, name + ' 없음'); return m[1]; };
  const fk = list('FB_FIN_KEYS'), gated = list('FB_FIN_GATED');
  KEYS.forEach((k) => assert.match(fk, new RegExp("'" + k + "'"), '★ ' + k + ' 가 재무 열쇠 목록에 없습니다 — 재무 권한 없는 기기에 옛 사본이 남습니다'));
  // payroll_audit_log 는 «아무에게도 부팅 때 안 받는» 목록(FB_COLD_KEYS)이 맡는다
  KEYS.filter((k) => k !== 'payroll_audit_log').forEach((k) =>
    assert.match(gated, new RegExp("'" + k + "'"), k + ' 를 재무 권한 없는 기기가 부팅 때 받으려 합니다 — 막혀 «못 읽음»이 됩니다'));
});

test('③ ★★ 카드·계좌 비밀번호를 적는 칸이 없다', () => {
  const B = stripJs(fs.readFileSync(path.join(R, 'pu-erp.html'), 'utf8'));
  assert.doesNotMatch(B, /카드 비밀번호/, '★★ 카드 비밀번호 칸이 돌아왔습니다 — 서버에 그대로 적혀 볼 수 있는 누구에게나 보입니다');
  assert.doesNotMatch(B, /value:f\.pin\b/, '★★ 비밀번호(pin)를 입력받는 칸이 있습니다');
});
