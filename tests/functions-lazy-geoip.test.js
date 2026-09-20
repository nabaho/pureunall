/* 무거운 꾸러미는 «맨 위»에서 부르지 않는다 (2026-09-20 배포가 실제로 막혔다)
   ═══════════════════════════════════════════════════════════════════════════
   ■ 무슨 일이 있었나
     functions/index.js 맨 위에 `const geoip = require("geoip-lite")` 가 있었다.
     이 꾸러미는 나라 대역표를 통째로 메모리에 올린다. 클라우드 함수는 파일 하나를
     통째로 싣고 그 안의 함수를 고르는 꼴이라, «어느 함수를 부르든» 콜드 스타트마다
     그 값을 치른다 — 정작 쓰는 데는 파일 안에 한 곳뿐이다.

     ① 2026-09-20 newsFullPage(256MB) 배포 직후 크래시 —
        "Memory limit of 256 MiB exceeded with 384 MiB used"
     ② 같은 날 newsClick(128MB) 은 배포 «자체»가 막혔다 —
        "Function failed on loading user code … function load attempt timed out"
     ①은 그 함수만 512MB 로 올려 막았다. 그때 「다른 128/256MB 함수도 같은 위험을
     안고 있다」고 적어 두었고, 그 다음 배포에서 그대로 터졌다.

   ■ 고친 길 — 쓰는 자리에서 부른다(느린 부르기).
     require 는 한 번 부르면 갈무리되므로 쓰는 함수도 두 번째부터는 값을 안 치르고,
     나머지 함수는 아예 안 치른다.

   ■ 이 검사가 지키는 것
     ㉠ geoip-lite 가 «맨 위»로 돌아오지 않는다 — 돌아오면 배포부터 막힌다
     ㉡ 그래도 나라 찾기는 «돈다» — 느리게 부른다고 기능이 사라지면 안 된다
     ㉢ 못 찾거나 터져도 빈 글자 — 로그인 보고가 이것 때문에 멎으면 안 된다 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const 뿌리 = path.join(__dirname, '..');
const 원문 = fs.readFileSync(path.join(뿌리, 'functions/index.js'), 'utf8');

/* 주석을 걷어 낸다 — 위 설명글에 적힌 낱말이 검사에 걸리면 안 된다 */
const 몸 = 원문
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^[ \t]*\/\/.*$/gm, '');

test('★★★ geoip-lite 부르기가 «모두 함수 안»이다 — 밖에 있으면 배포부터 막힌다', () => {
  /* ⚠⚠ 「맨 윗줄에 없다」로만 보면 안 된다. 들여 쓴 채로 함수 «밖»에 두어도
       파일을 실을 때 같이 실려 똑같이 터진다. 그래서 «부르는 자리 하나하나»가
       geoip나라() 의 몸 안에 들어 있는지를 본다. */
  const 몸통 = /function geoip나라\(ip\)\s*\{[\s\S]*?\n\}/.exec(몸);
  assert.ok(몸통, '★★ geoip나라() 가 없다');
  const 안시작 = 몸.indexOf(몸통[0]);
  const 안끝 = 안시작 + 몸통[0].length;

  const 자리들 = [...몸.matchAll(/require\(["']geoip-lite["']\)/g)].map((m) => m.index);
  assert.ok(자리들.length, '(재기 값) geoip-lite 를 아예 안 쓴다 — 나라 찾기가 통째로 사라졌다');
  자리들.forEach((i) => {
    assert.ok(i >= 안시작 && i < 안끝,
      '★★★ 함수 «밖»에서 geoip-lite 를 부른다 (글자 ' + i + '번째) — '
      + '이 파일의 모든 함수가 콜드 스타트마다 그 값을 치르고, 128MB 짜리는 배포부터 막힌다');
  });
});

test('★★ 부르는 자리가 «함수 안»이다', () => {
  const m = /function geoip나라\(ip\)\s*\{[\s\S]*?\n\}/.exec(몸);
  assert.ok(m, '★★ geoip나라() 가 없다');
  assert.match(m[0], /require\(["']geoip-lite["']\)/,
    '★★ 부르기가 함수 밖으로 나갔다 — 느리게 부르는 뜻이 없어진다');
  assert.match(m[0], /catch\s*\([^)]*\)\s*\{\s*return\s+["']["']\s*;/,
    '★★ 터졌을 때 빈 글자로 안 물러선다 — 로그인 보고가 이것 때문에 멎는다');
});

test('★★ 나라 찾기가 «실제로» 돈다 — 느리게 불러도 기능은 그대로', () => {
  /* ⚠ 글자만 보면(「require 가 함수 안에 있다」) 안이 비어 있어도 통과한다.
       그래서 «같은 몸»을 떼어 내 진짜로 돌려 본다. */
  const m = /function geoip나라\(ip\)\s*\{[\s\S]*?\n\}/.exec(몸);
  /* ⚠ geoip-lite 는 functions/node_modules 에 있다 — 여기서 그냥 require 하면
       못 찾고, 못 찾은 것이 catch 에 삼켜져 «기능이 죽어도 초록»이 된다.
       그래서 «그 파일 자리에서 부르는» require 를 만들어 넘긴다. */
  const 그자리require = require('node:module')
    .createRequire(path.join(뿌리, 'functions/index.js'));
  try { 그자리require('geoip-lite'); }
  catch (e) { assert.fail('geoip-lite 를 못 읽는다 — functions 에서 npm install 을 하셔야 합니다'); }
  // eslint-disable-next-line no-new-func
  const geoip나라 = new Function('require', 'return (' + m[0] + ')')(그자리require);

  assert.equal(geoip나라('8.8.8.8'), 'US',
    '★★ 아는 주소(구글 DNS)의 나라를 못 찾는다 — 느리게 부르다 기능을 잃었다');
  assert.equal(typeof geoip나라('1.1.1.1'), 'string', '나라가 글자가 아니다');
  ['', null, undefined, '집주소아님', '999.999.999.999'].forEach((나쁨) => {
    assert.equal(geoip나라(나쁨), '',
      '★★ 이상한 값(' + JSON.stringify(나쁨) + ')에 빈 글자를 안 준다 — 로그인 보고가 멎는다');
  });
});
