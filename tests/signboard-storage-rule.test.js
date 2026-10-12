/* 전광판 창고(Storage) 규칙 — 직원만 읽고 쓰고, 지우기 금지, 사진은 okImage() 재사용 (2026-10-12)
   ★ 사진 한도를 새로 적지 않는다 — 배포 검사(storage-rules-deploy.test)가 «첫 번째로 나오는 같은 글자»를 조여 보는데,
     같은 글자가 이 칸에 먼저 나오면 엉뚱한 칸을 조여 검사가 이빨을 잃는다(2026-10-12 실제로 걸렸다). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const TXT = fs.readFileSync(path.join(ROOT, 'docs', 'firebase-storage-전체(붙여넣기용).txt'), 'utf8').replace(/\r\n/g, '\n');
const at = TXT.indexOf('match /signboard/{file}');
const BLOCK = at < 0 ? '' : TXT.slice(at, TXT.indexOf('\n    }\n', at) + 7);

test('signboard 칸이 있다', () => { assert.ok(at > 0, '창고 규칙에 match /signboard/{file} 이 없다'); });

test('직원(@pureun.kr)만 읽고 쓴다 — 읽기·쓰기 모두 isStaff()', () => {
  assert.match(BLOCK, /allow read:\s+if isStaff\(\);/);
  assert.match(BLOCK, /allow write:\s+if isStaff\(\)/);
});

test('지우기는 막는다 — 올린 기록으로 되돌릴 때 그 판의 파일이 남아 있어야 한다', () => {
  assert.match(BLOCK, /allow delete:\s+if false;/);
});

test('사진은 okImage() 를 그대로 쓴다 — 같은 숫자를 이 칸에 새로 적지 않는다', () => {
  assert.match(BLOCK, /okImage\(\)/);
  assert.equal(BLOCK.indexOf('10 * 1024 * 1024'), -1, '10MB 를 이 칸에 새로 적었다');
  /* 배포 검사는 파일에서 «첫 번째로 나오는» 10MB 한도를 1KB 로 바꿔 본다 — 그것이 okImage() 안이어야 한다 */
  const first = TXT.indexOf('request.resource.size < 10 * 1024 * 1024'), fn = TXT.indexOf('function okImage()');
  assert.ok(fn > 0 && first > fn && first < fn + 200, '첫 번째 10MB 한도가 okImage() 안에 있지 않다');
});

test('동영상 보조 함수 okSignVideo() 가 있고 video/ 만 받으며 50MB 미만이다', () => {
  const f = TXT.slice(TXT.indexOf('function okSignVideo()'));
  assert.ok(f.length > 0 && TXT.indexOf('function okSignVideo()') > 0);
  const body = f.slice(0, f.indexOf('}') + 1);
  assert.match(body, /request\.resource\.size < 50 \* 1024 \* 1024/);
  assert.match(body, /contentType\.matches\('video\/\.\*'\)/);
  assert.match(BLOCK, /okSignVideo\(\)/);
});

test('규칙 한도가 규칙 모듈(js/pu-signboard-core.js)의 한도와 같다', () => {
  const C = require('../js/pu-signboard-core.js');
  assert.equal(C.MAX_IMAGE_BYTES, 10 * 1024 * 1024);
  assert.equal(C.MAX_VIDEO_BYTES, 50 * 1024 * 1024);
});

test('앱이 실제로 쓰는 자리 목록(storage-rules-deploy)에 signboard 길이 적혀 있다', () => {
  const s = fs.readFileSync(path.join(ROOT, 'scripts', 'storage-rules-deploy.js'), 'utf8');
  assert.match(s, /\['signboard\/[^']+', '[^']*pu-signboard\.html[^']*'\]/);
});
