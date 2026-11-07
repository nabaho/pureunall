'use strict';
/* 견적 기록·금액 규칙 — 금액은 대표·총괄관리자(isAdmin)·재무(fin)·그 건의 확정 담당자만 읽는다.
   ★ 파이어베이스는 부모에서 준 읽기를 아래에서 거둘 수 없다 — 그래서 pu_quote_amt 위에는 LOGIN 읽기를 두지 않는다. */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { test } = require('node:test');
const { execFileSync } = require('child_process');

const R = path.join(__dirname, '..');
const APPLY = JSON.parse(fs.readFileSync(path.join(R, 'docs/firebase-rules-전체-적용본.json'), 'utf8'));
const PASTE = JSON.parse(fs.readFileSync(path.join(R, 'docs/rules-paste.json'), 'utf8'));
const GEN = JSON.parse(execFileSync(process.execPath, [path.join(R, 'scripts/make-firebase-rules.js')], { encoding: 'utf8' }));

test('견적 기록 읽기는 재직 직원, 지우기는 관리자', () => {
  const r = GEN.rules.pu_quotes;
  assert.match(r['.read'], /status/);
  assert.match(r.$q['.write'], /newData\.exists\(\) \|\| .*isAdmin/);
});
test('★★ 금액 전체 읽기는 isAdmin·fin 만', () => {
  const r = GEN.rules.pu_quote_amt['.read'];
  assert.match(r, /isAdmin/); assert.match(r, /'fin'/);
  assert.doesNotMatch(r, /isSubAdmin|status/);
});
test('★★ 한 건 읽기는 확정 담당자만 더', () => {
  assert.match(GEN.rules.pu_quote_amt.$q['.read'], /data\.child\('owner'\)\.val\(\) === auth\.uid/);
});
test('★ 담당자 바꾸기는 isAdmin 만 — 새로 쓸 때는 나 또는 빈칸', () => {
  const w = GEN.rules.pu_quote_amt.$q['.write'];
  assert.match(w, /!data\.exists\(\)/); assert.match(w, /isAdmin/);
  assert.match(w, /newData\.child\('owner'\)\.val\(\) === auth\.uid/);
  assert.match(w, /newData\.child\('owner'\)\.val\(\) === ''/);
});
test('★★ 금액 읽기를 넓히는 규칙이 위에 없다(뿌리·pu_quote_amt 자신)', () => {
  const root = GEN.rules;
  assert.ok(!('.read' in root), '뿌리에 .read 가 있으면 금액까지 열린다');
  /* 금액은 견적 기록(pu_quotes) 아래에 두지 않는다 */
  assert.ok(!JSON.stringify(GEN.rules.pu_quotes).includes('amount'));
});
test('칸 검사 — 금액은 0 이상 숫자, vat 는 세 값, 모르는 칸 금지', () => {
  const q = GEN.rules.pu_quote_amt.$q;
  assert.match(q.amount['.validate'], /isNumber\(\)/); assert.match(q.amount['.validate'], />= 0/);
  assert.match(q.vat['.validate'], /incl/); assert.match(q.vat['.validate'], /excl/);
  assert.match(q.owner['.validate'], /<= 40/);
  assert.strictEqual(q.$other['.validate'], false);
  assert.strictEqual(GEN.rules.pu_quotes.$q.$other['.validate'], false);
});
test('견적 기록 칸 길이 · by 는 내 이름 또는 그대로', () => {
  const q = GEN.rules.pu_quotes.$q;
  assert.match(q.co['.validate'], /<= 80`?|<= 80/); assert.match(q.scope['.validate'], /<= 300/);
  assert.match(q.period['.validate'], /<= 60/); assert.match(q.ownerGuess['.validate'], /<= 60/);
  assert.match(q.srcKey['.validate'], /<= 200/);
  assert.match(q.staff['.validate'], /isNumber/);
  assert.match(q.by['.validate'], /auth\.uid/);
  assert.deepStrictEqual(GEN.rules.pu_quotes['.indexOn'], ['srcKey', 'at']);
});
test('적용본이 만들개와 같다', () => {
  assert.deepStrictEqual(APPLY.rules.pu_quotes, GEN.rules.pu_quotes);
  assert.deepStrictEqual(APPLY.rules.pu_quote_amt, GEN.rules.pu_quote_amt);
  assert.deepStrictEqual(PASTE.rules.pu_quotes, GEN.rules.pu_quotes);
  assert.deepStrictEqual(PASTE.rules.pu_quote_amt, GEN.rules.pu_quote_amt);
});
