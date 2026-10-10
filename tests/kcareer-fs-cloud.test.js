'use strict';
/* ☁ 서류 폴더 원본의 클라우드 사본 (대표 지시 2026-10-10 「2」)
   위촉장·자격증 등 폴더로 붙인 원본(실측 194건·68MB)이 그 PC 에만 있던 것.
   못 박는 것:
     ① 올리기 — 권한을 «묻지 않는다»(queryPermission 만) · 바뀐 파일만(경로|크기|수정일) · 25MB 아래 · 직원 보기 전용 X
     ② 적기 — 올리는 사이 기록이 바뀌었으면(경로가 달라짐) 안 적는다 · 중간중간 적어 끊겨도 이어진다
     ③ 열기 — 폴더가 있으면 늘 폴더 원본, 없거나 옮겨졌을 때만 사본 (두 입구 모두) */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
function 떼기(머리) {
  const i = SRC.indexOf(머리); assert.ok(i > 0, 머리);
  let d = 0, s = false;
  for (let p = i; p < SRC.length; p++) { if (SRC[p] === '{') { d++; s = true; } else if (SRC[p] === '}') { d--; if (s && !d) return SRC.slice(i, p + 1); } }
}

test('① 권한을 묻지 않고 · 바뀐 것만 · 25MB 아래 · 직원 보기 전용은 안 돈다', () => {
  const q = strip(떼기('async function _fsRootQuiet('));
  assert.ok(/queryPermission/.test(q) && !/requestPermission/.test(q), '열 때마다 권한 창이 뜨면 안 된다');
  const up = strip(떼기('async function kcFsBackupUp('));
  assert.ok(/_fsRootQuiet\(\)/.test(up), '조용한 문으로만');
  assert.ok(/r\.fsCloudKey!==_fsKeyOf\(r\)/.test(up), '이미 올린 같은 파일은 건너뛴다');
  assert.ok(/25\*1024\*1024/.test(up), '창고 규칙 25MB');
  assert.ok(/kcIsStaff\(\)/.test(up), '직원 보기 전용 X');
  assert.ok(/kcFormUpload\(/.test(up), '올리는 길은 공용(본인만 읽는 자리)');
  assert.ok(/n%10===0\) 적기\(\)/.test(up), '열 건마다 적는다 — 끊겨도 이어진다');
  assert.ok(/_fsKeyOf\(r\)===u\.key/.test(up), '올리는 사이 기록이 바뀌었으면 안 적는다');
  assert.ok(/_fsKeyOf/.test(떼기('function _fsKeyOf(')) && /relPath[\s\S]*fileSize[\s\S]*fileMtime/.test(떼기('function _fsKeyOf(')));
});

test('② 언제 도나 — 열고 30초 뒤(허락된 기기만) · 폴더를 이은 뒤', () => {
  assert.match(SRC, /setTimeout\(function\(\)\{ if\(typeof kcFsBackupUp==='function'\) kcFsBackupUp\(true\)/);
  assert.ok(/kcFsBackupUp\(false\)/.test(strip(떼기('async function fsConnectFolder('))));
});

test('③ 열기 — 폴더 원본이 먼저, 없을 때만 사본 (두 입구)', () => {
  const o = strip(떼기('async function openLocalOriginal('));
  assert.ok(o.indexOf('_fsFileOf(relPath)') < o.indexOf('_fsCloudFile(relPath)'), '폴더가 먼저');
  assert.ok(/if\(!f\)\{[\s\S]*_fsCloudFile/.test(o), '폴더에 없을 때만 사본');
  const r = strip(떼기('async function recFileAsync('));
  assert.ok(r.indexOf('_fsFileOf(rec.relPath)') < r.indexOf('_fsCloudFile(rec.relPath)'), '서식 채우기·판독 입구도 같다');
  const c = strip(떼기('async function _fsCloudFile('));
  assert.ok(/r\.relPath===relPath && r\.fsCloud/.test(c), '그 경로를 가진 기록의 사본만');
  assert.ok(/KC_FS_STORES/.test(c));
});
