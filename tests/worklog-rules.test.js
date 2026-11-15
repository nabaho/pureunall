'use strict';
/* 작업 기록 규칙 — 읽기는 총괄관리자만, 쓰기는 «새로 쓰기만»(덮어쓰기·지우기 불가), 내 이름으로만 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { test } = require('node:test');
const { execFileSync } = require('child_process');

const R = path.join(__dirname, '..');
const APPLY = JSON.parse(fs.readFileSync(path.join(R, 'docs/firebase-rules-전체-적용본.json'), 'utf8'));
const GEN = JSON.parse(execFileSync(process.execPath, [path.join(R, 'scripts/make-firebase-rules.js')], { encoding: 'utf8' }));

test('적용본이 만들개와 같다(pu_worklog)', () => {
  assert.ok(GEN.rules.pu_worklog, 'pu_worklog 규칙이 없습니다');
  assert.deepStrictEqual(APPLY.rules.pu_worklog, GEN.rules.pu_worklog, '★ 만들개를 고치고 적용본을 다시 안 냈습니다');
});
test('읽기는 총괄관리자만', () => {
  assert.match(GEN.rules.pu_worklog['.read'], /isAdmin/);
  assert.doesNotMatch(GEN.rules.pu_worklog['.read'], /isSubAdmin|fin/);
});
test('새로 쓰기만 · 내 이름으로만', () => {
  const r = GEN.rules.pu_worklog.$m.$id;
  assert.match(r['.write'], /!data\.exists\(\)/); assert.match(r.by['.validate'], /auth\.uid/);
  assert.strictEqual(r.$other['.validate'], false);
});
test('달 열쇠는 숫자 6자리', () => assert.match(GEN.rules.pu_worklog.$m['.validate'], /\[0-9\]\{6\}/));
test('글자 수 한도가 모듈과 같다', () => {
  const r = GEN.rules.pu_worklog.$m.$id;
  assert.match(r.target['.validate'], /<= 120/); assert.match(r.note['.validate'], /<= 200/);
  assert.match(r.auto['.validate'], /<= 60/); assert.match(r.byName['.validate'], /<= 60/);
});
