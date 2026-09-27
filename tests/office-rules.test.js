'use strict';
/* 사무관리서류 보관함 규칙 (설계 §6)
   ★★ 보관함은 «지울 수 없어야» 한다 — 원본이 계속 보관되는 것이 대표 지시의 핵심이다.
      RTDB 색인은 «새로 쓰기만», 창고는 update·delete 가 false.
   ★ 읽기는 직원 전체(계약서는 법인 업무기록 — 서고와 같은 결). */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { test } = require('node:test');
const { execFileSync } = require('child_process');

const R = path.join(__dirname, '..');
const APPLY = JSON.parse(fs.readFileSync(path.join(R, 'docs/firebase-rules-전체-적용본.json'), 'utf8'));
const GEN = JSON.parse(execFileSync(process.execPath, [path.join(R, 'scripts/make-firebase-rules.js')], { encoding: 'utf8' }));
const ST = fs.readFileSync(path.join(R, 'docs/firebase-storage-전체(붙여넣기용).txt'), 'utf8').replace(/\r\n/g, '\n');

test('적용본이 만들개와 같다(pu_docs)', () => {
  assert.deepStrictEqual(APPLY.rules.pu_docs, GEN.rules.pu_docs, '★ 만들개를 고치고 적용본을 다시 안 냈습니다');
});

test('★★ 색인·해시는 새로 쓰기만 — 덮어쓰기·지우기 불가', () => {
  const p = GEN.rules.pu_docs;
  assert.ok(p, 'pu_docs 규칙이 없습니다');
  assert.match(p.originals.$id['.write'], /!data\.exists\(\)/, '★★ 보관함 색인을 덮어쓰거나 지울 수 있습니다');
  assert.match(p.hash.$h['.write'], /!data\.exists\(\)/, '★★ 해시를 바꿔 다른 파일을 가리키게 할 수 있습니다');
  assert.match(p.hash.$h['.validate'], /child\('sha256'\)\.val\(\) === \$h/, '★★ 해시 키가 그 원본의 sha256 과 맞는지 안 봅니다 — 남이 미리 엉뚱한 fileId 에 진짜 해시를 심어 둘 수 있습니다');
  assert.equal(p.originals.$id.$other['.validate'], false, '정해 둔 칸 말고 아무거나 넣을 수 있습니다');
  assert.match(p.originals.$id.by['.validate'], /auth\.uid/, '올린 사람을 남의 것으로 적을 수 있습니다');
  assert.match(p.originals.$id.path['.validate'], /beginsWith\('pu_docs\/originals\/' \+ \$id/, '색인이 엉뚱한 창고 자리를 가리킬 수 있습니다');
});

test('★ 읽기는 재직 직원(LOGIN)', () => {
  const p = GEN.rules.pu_docs;
  assert.match(p['.read'], /uid_roles/, '읽기가 재직자 확인 없이 열려 있습니다');
  assert.match(p['.read'], /status/);
});

test('★ 기업·연결은 칸을 못 박는다', () => {
  const p = GEN.rules.pu_docs;
  assert.equal(p.co.$k.$other['.validate'], false);
  assert.equal(p.co_docs.$k.$d.$other['.validate'], false);
  assert.match(p.co_docs.$k.$d.src['.validate'], /'photo'/);
  assert.match(p.co_docs.$k.$d.fileId['.validate'], /pu_docs\/originals/, '연결이 없는 파일을 가리킬 수 있습니다');
  assert.match(p.co_docs.$k.$d.by['.validate'], /auth\.uid/, '연결을 남긴 사람을 남의 것으로 적을 수 있습니다');
});

function seg() {
  const i = ST.indexOf('match /pu_docs/originals/');
  assert.ok(i >= 0, '창고 규칙에 보관함 칸이 없습니다 — 원본이 「전부 막는다」에 걸립니다');
  const j = ST.indexOf('}', ST.indexOf('allow update', i));
  return ST.slice(i, j + 1);
}
test('★★ 창고 — 자리·읽기·새로 쓰기·영구 보관', () => {
  const s = seg();
  assert.match(s, /match \/pu_docs\/originals\/\{fileId\}\/\{file\}/);
  assert.match(s, /allow read:\s*if isStaff\(\)/);
  assert.match(s, /allow create:\s*if isStaff\(\)/);
  assert.match(s, /request\.resource\.size\s*<\s*25\s*\*\s*1024\s*\*\s*1024/);
  assert.match(s, /allow update, delete:\s*if false/, '★★ 원본을 지우거나 덮어쓸 수 있습니다');
  assert.ok(!/allow write/.test(s), '★★ write 는 update·delete 까지 엽니다 — create 만 씁니다');
});
test('창고 보관함 칸이 「전부 막는다」보다 앞에 있다', () => {
  assert.ok(ST.indexOf('match /pu_docs/originals/') < ST.indexOf('match /{allPaths=**}'));
});
