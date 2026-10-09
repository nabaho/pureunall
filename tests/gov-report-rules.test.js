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

test('scal_reports — 확정본(_v숫자)은 없을 때만 쓰기, 지우기는 관리자만 / 본기록은 직원 쓰기·관리자 삭제', () => {
  const r = rules.scal_reports;
  const login = rules.scal_scheds['.read'];            /* LOGIN 식 그대로 */
  const admin = rules.serverBackups['.read'];          /* ADMIN 식 그대로 */
  assert.equal(r['.read'], login, '읽기는 다른 scal_* 와 같은 로그인');
  /* 위쪽 칸이 열려 있으면 아래 확정본 잠금이 뚫린다 — 관리자 전용이어야 한다 */
  assert.equal(r['.write'], admin, '루트 쓰기는 관리자 전용');
  assert.equal(r.$co['.write'], admin, '$co 쓰기는 관리자 전용');
  const w = r.$co.$rid['.write'];
  assert.ok(w.startsWith('(' + login + ') && '), '로그인이 먼저 필요');
  assert.ok(w.includes("$rid.matches(/_v[0-9]+$/)"), '_v숫자 로 끝나는 rid 를 가린다');
  assert.ok(w.includes('!data.exists()'), '확정본은 «없을 때만» 쓴다(덮어쓰기 금지)');
  assert.ok(w.includes('(!newData.exists() && ' + admin + ')'), '확정본 지우기는 관리자만');
  assert.ok(w.includes('(newData.exists() || ' + admin + ')'), '본기록은 직원 쓰기, 지우기는 관리자');
  assert.deepEqual(Object.keys(r.$co).sort(), ['$rid', '.write']);
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
