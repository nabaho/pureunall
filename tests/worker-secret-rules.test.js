/* 근로자 주민번호·계좌·예금주 담당자 칸(worker_secret)의 규칙 — 대표 결정 2026-10-15
 *   보는 사람 = 대표(isAdmin) + 그 건의 주담당·부담당. 위임관리인은 담당일 때만.
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
const rec = rules.worker_secret && rules.worker_secret.$kind && rules.worker_secret.$kind.$rec;

test('자리가 있고, 위(표 단위)에서는 아무것도 열지 않는다 — 통째 읽기 금지', () => {
  assert.ok(rec, 'worker_secret/$kind/$rec 규칙이 없습니다');
  assert.equal(rules.worker_secret['.read'], undefined, '★★ 담당자 칸 전체를 한 번에 읽을 수 있습니다');
  assert.equal(rules.worker_secret.$kind['.read'], undefined, '★★ 한 표의 담당자 칸을 통째로 읽을 수 있습니다');
});

for (const k of ['.read', '.write']) {
  test('★★ ' + k + ' — 재직자 + (대표 또는 그 건의 담당자)', () => {
    const v = String(rec[k] || '');
    assert.match(v, /child\('status'\)\.val\(\) === 'active'/, '재직자를 안 봅니다');
    assert.match(v, /child\('isAdmin'\)/, '대표가 못 봅니다');
    assert.match(v, /child\('managerMain'\)/, '주담당을 안 봅니다');
    assert.match(v, /child\('managerSubs'\)\.child\('0'\)/, '부담당을 안 봅니다');
    assert.match(v, /child\('data'\)\.child\(\$kind\)\.child\('v'\)\.child\(\$rec\)/, '«그 건»의 담당자 칸을 안 봅니다');
    assert.match(v, /child\('sid'\)\.val\(\) != null/, '★ 내 사번이 없을 때 null === null 로 열립니다');
    assert.doesNotMatch(v, /isSubAdmin/, '★★ 위임관리인이 담당이 아니어도 봅니다 — 대표 결정은 «담당일 때만»');
  });
}

test('★ 칸은 셋뿐 — 다른 것은 못 넣는다, 길이 한도', () => {
  const w = rec.$wid;
  assert.equal(w.$other['.validate'], false);
  assert.deepEqual(Object.keys(w).filter((k) => k[0] !== '$').sort(), ['account', 'holder', 'rrn']);
  assert.match(w.rrn['.validate'], /isString\(\)/);
});

test('표 이름은 다섯뿐 — 다른 이름으로 아무 데나 쓰지 못한다', () => {
  assert.match(rec['.validate'], /cases\|contracts\|consultings\|funds\|other_projects/);
});
