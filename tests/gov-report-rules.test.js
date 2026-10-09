'use strict';
/* 정부컨설팅 보고서 자리의 실시간DB 규칙 (2026-10-09, 2단계 Task 3)
   - scal_reports      : 다른 scal_* 과 같은 꼴 (읽기 로그인 · $k/$k2 쓰기 로그인 · 부모 지우기 관리자)
   - scal_rptForms,
     scal_rptFormsIndex: 읽기 로그인 · 쓰기 관리자 — 양식 등록은 관리자만 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const cp = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const out = cp.execFileSync('node', [path.join(ROOT, 'scripts', 'make-firebase-rules.js')], { encoding: 'utf8' });
const rules = JSON.parse(out).rules;

test('세 자리가 생성기 출력에 있다', () => {
  for (const k of ['scal_reports', 'scal_rptForms', 'scal_rptFormsIndex']) {
    assert.ok(rules[k], k + ' 자리가 없습니다');
  }
});

test('scal_reports 는 다른 scal_* (scal_scheds) 와 같은 꼴이다', () => {
  assert.deepEqual(rules.scal_reports, rules.scal_scheds);
  assert.ok(rules.scal_reports.$k && rules.scal_reports.$k.$k2, '$k/$k2 구조가 있어야 합니다');
});

test('scal_rptForms·scal_rptFormsIndex — 읽기는 로그인, 쓰기는 관리자(양식 등록은 관리자만)', () => {
  const adminW = rules.serverBackups['.read'];          /* ADMIN 식 그대로 (읽기가 ADMIN 인 자리) */
  const loginR = rules.scal_scheds['.read'];            /* LOGIN 식 그대로 */
  for (const k of ['scal_rptForms', 'scal_rptFormsIndex']) {
    assert.equal(rules[k]['.write'], adminW, k + ' 쓰기가 관리자 식과 다릅니다');
    assert.equal(rules[k]['.read'], loginR, k + ' 읽기가 로그인 식과 다릅니다');
    assert.deepEqual(Object.keys(rules[k]).sort(), ['.read', '.write'], k + ' 에 군더더기가 있습니다');
  }
});
