/* 직원 주민번호·계좌 금고(staff_secret) 규칙 — 대표 승인 2026-11-01 (개인정보 2단계)
 *   보는 사람 = 대표(isAdmin)뿐. 위임관리인·재무 권한자는 못 본다. 접속기록은 새로 쓰기만.
 * 글자가 아니라 «성질»을 본다(CLAUDE.md) — 만들개 출력을 떠서 조건마다 있는지/없는지.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const rules = JSON.parse(execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'make-firebase-rules.js')],
  { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })).rules;
const ss = rules.staff_secret;

test('자리가 있다', () => { assert.ok(ss && ss.$sid, 'staff_secret/$sid 규칙이 없습니다'); });

test('★★ 읽기 — 재직자 + 대표뿐. 위임관리인·재무 권한자는 못 읽는다', () => {
  const v = String(ss['.read'] || '');
  assert.match(v, /child\('status'\)\.val\(\) === 'active'/, '재직자를 안 봅니다');
  assert.match(v, /child\('isAdmin'\)/, '대표가 못 봅니다');
  assert.doesNotMatch(v, /isSubAdmin/, '★★ 위임관리인이 봅니다');
  assert.doesNotMatch(v, /child\('fin'\)/, '★★ 재무 권한자가 봅니다 — 금고는 대표만');
});

for (const f of ['rrn', 'account', 'holder']) {
  test('★★ ' + f + ' 쓰기 — 재직자 + 대표뿐, 길이 한도', () => {
    const c = ss.$sid[f];
    assert.ok(c, f + ' 칸 규칙이 없습니다');
    const w = String(c['.write'] || '');
    assert.match(w, /child\('isAdmin'\)/);
    assert.doesNotMatch(w, /isSubAdmin|child\('fin'\)/, '대표 말고 쓸 수 있습니다');
    assert.match(c['.validate'], /isString\(\)/);
    assert.match(c['.validate'], /length <= \d+/);
  });
}

test('★★ 위(금고 전체·한 사람 전체)에는 쓰기를 열지 않는다 — 열면 기록을 지울 수 있다', () => {
  assert.equal(ss['.write'], undefined, '금고 전체 쓰기가 열려 있습니다');
  assert.equal(ss.$sid['.write'], undefined, '한 사람 전체 쓰기가 열려 있습니다 — _log 를 지울 수 있습니다');
});

test('★★ 기록(_log)은 «새로 쓰기만» — 고치기·지우기 불가, 값 칸 없음', () => {
  const l = ss.$sid._log && ss.$sid._log.$id;
  assert.ok(l, '_log 규칙이 없습니다');
  assert.match(l['.write'], /!data\.exists\(\)/, '★★ 기록을 고칠 수 있습니다');
  assert.match(l['.write'], /newData\.exists\(\)/, '★★ 기록을 지울 수 있습니다');
  assert.match(l['.write'], /child\('isAdmin'\)/);
  assert.deepEqual(Object.keys(l).filter((k) => k[0] !== '$' && k[0] !== '.').sort(), ['act', 'at', 'by', 'byName', 'field'],
    '기록에 값(주민번호 등)을 실을 칸이 생기면 안 됩니다');
  assert.equal(l.$other['.validate'], false);
});

test('칸은 셋뿐 + 기록 — 다른 것은 못 넣는다', () => {
  assert.equal(ss.$sid.$other['.validate'], false);
  assert.deepEqual(Object.keys(ss.$sid).filter((k) => k[0] !== '$' && k[0] !== '.').sort(), ['_log', 'account', 'holder', 'rrn']);
});
