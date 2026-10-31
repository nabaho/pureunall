/* 컨설팅정산 보안 규칙(scripts/make-firebase-rules.js → rules.settle) — 재무관리와 같은 사람만, 지우기 금지 (2026-10-31)
   ★ 적용본(docs/firebase-rules-전체-적용본.json)이 만들개 출력과 같은지는 tests/firebase-rules-apply.test.js 가 본다. 여기서는 «뜻»을 본다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const J = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'docs', 'firebase-rules-전체-적용본.json'), 'utf8').replace(/^﻿/, ''));
const S = (J.rules || J).settle;

function writes(node, at, out) {
  Object.keys(node || {}).forEach((k) => {
    if (k === '.write') out.push([at, node[k]]);
    else if (k[0] !== '.' && node[k] && typeof node[k] === 'object') writes(node[k], at + '/' + k, out);
  });
  return out;
}

test('settle 자리가 있고, 읽기는 재직 + 관리자·위임관리인·재무권한 셋 다 든 조건이다', () => {
  assert.ok(S, 'rules.settle 이 없다');
  const r = S['.read'];
  assert.match(r, /status'\)\.val\(\) === 'active'/, '재직 확인');
  assert.match(r, /'isAdmin'\)\.val\(\) == true/);
  assert.match(r, /'isSubAdmin'\)\.val\(\) == true/);
  assert.match(r, /'fin'\)\.val\(\) == true/);
});

test('쓰기는 자리마다만 열리고(최상위 쓰기 없음), 모두 지우기 금지(newData.exists)이며 읽기와 같은 사람이다', () => {
  assert.equal(S['.write'], undefined, 'settle 최상위에 쓰기가 열렸다');
  const w = writes(S, 'settle', []);
  ['settle/rules/$t', 'settle/links/$kind/$key', 'settle/notices/$id', 'settle/runs/$id', 'settle/adjusts/$id'].forEach((p) =>
    assert.ok(w.some(([at]) => at === p), p + ' 쓰기 자리가 없다'));
  w.forEach(([at, rule]) => {
    assert.match(rule, /newData\.exists\(\)/, at + ' 에서 지우기가 막혀 있지 않다');
    assert.match(rule, /'fin'\)\.val\(\) == true/, at);
  });
});

test('레코드 id 가 열쇠와 같아야 하고, 연결은 업체·사람 두 갈래뿐이다', () => {
  assert.match(S.rules.$t['.validate'], /=== \$t/);
  ['notices', 'runs', 'adjusts'].forEach((k) => assert.match(S[k].$id['.validate'], /newData\.child\('id'\)\.val\(\) === \$id/, k));
  const v = S.links.$kind.$key['.validate'];
  assert.match(v, /=== \$key/); assert.match(v, /'company'/); assert.match(v, /'person'/);
});
