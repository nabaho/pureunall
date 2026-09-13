'use strict';
/* 판독 — 같은 서류를 «두 번 읽지 않는다» (지문 기억).
   실행: node --test tests/*.test.js

   대표 지시 2026-09-13: 「중복해서 판독하는 경우도 정말 많은데
   이 부분은 중복으로 안 읽게 할 수 없나?」

   ── 무엇을 보고 만들었나 (서버 셈판 실측 2026-09-13) ──────────────────
   판독 한 번이 약 4원이다(wonPerRead). 그날 하루 146번이 나갔고 그중 123번이
   경력관리였다 — 그날 들어간 「폴더 스캔」이 위촉장 112건을 한꺼번에 읽은 것이다.
   그 전 날들은 하루 5~37번이었다. 같은 폴더를 두 번 스캔하면 224번이 된다.

   ── 이 검사가 못 박는 것 ──────────────────────────────────────────
     ① 지문이 «사진과 물음 둘 다»에서 나온다 (사진만 보면 옛 답을 새 물음에 붙인다)
     ② 기억은 «이 브라우저 안»에만 둔다 — 서버에 두면 주민번호·계좌가 한 벌 더 복제된다
     ③ 유료 판독으로 가는 «유일한 문» 앞에 둔다 (네 갈래에 따로 달면 하나를 빠뜨린다)
     ④ 기억이 안 되는 곳에서도 판독은 «그대로 돌아야» 한다 (조용히 넘어간다)
     ⑤ 낡은 기억은 버린다                                                            */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { cutFn } = require('./cut-fn.js');

const R = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(R, 'js', 'pu-doc-read.js'), 'utf8').replace(/\r\n/g, '\n');
const bare = src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');

/* ══════ ① 지문 ══════ */

test('★★ 지문은 사진과 «물음»을 둘 다 본다 — 사진만 보면 옛 답을 새 물음에 붙인다', () => {
  const fn = cutFn(src, 'function partsFingerprint(parts)');
  assert.match(fn, /inline_data/, '★★ 사진을 지문에 안 넣습니다');
  assert.match(fn, /p\.text/, '★★ 물음(프롬프트)을 지문에 안 넣습니다 — 같은 사진에 다른 것을 물어도 옛 답이 나옵니다');
  assert.match(fn, /SHA-256/, '★ 지문을 뜨는 방법이 없습니다');
});

test('★★ 지문을 못 뜨면 «판독을 막지 않는다» — 빈 값을 주고 그냥 읽는다', () => {
  const fn = cutFn(src, 'function partsFingerprint(parts)');
  /* 옛 브라우저·http 에서는 crypto.subtle 이 없다. 거기서 판독이 멎으면 안 된다. */
  assert.match(fn, /if\s*\(!subtle[^)]*\)\s*return Promise\.resolve\(''\)/,
    '★★ 지문을 못 뜨는 곳에서 판독이 멎습니다');
  assert.match(fn, /\.catch\(function \(\) \{ return ''; \}\)/,
    '★★ 지문 뜨다 넘어지면 판독까지 죽습니다');
});

/* ══════ ② 기억은 브라우저 안에만 ══════ */

test('★★ 판독 결과를 «서버에» 담지 않는다 — 주민번호·계좌가 한 벌 더 복제된다', () => {
  const put = cutFn(src, 'function cachePut(fp, reply)');
  const get = cutFn(src, 'function cacheGet(fp)');
  [['담는', put], ['꺼내는', get]].forEach(function (p) {
    assert.doesNotMatch(p[1], /firebase|\.ref\(|database|fetch\(/,
      '★★ 기억을 ' + p[0] + ' 곳이 서버를 만집니다 — 판독 결과에는 개인정보가 들어 있고, '
      + '그 자리는 로그인한 직원이 다 읽습니다');
  });
  assert.match(cutFn(src, 'function cacheOpen()'), /indexedDB/,
    '★ 기억을 이 브라우저 안(IndexedDB)에 두어야 합니다');
});

test('★★ 무엇을 읽었는지는 «한 글자도» 안 센다 — 세는 것은 횟수뿐이다', () => {
  const fn = cutFn(src, 'function readSavedCount()');
  assert.match(fn, /return _saved/, '★ 아낀 횟수를 못 꺼냅니다');
  /* 아낀 횟수를 올리는 자리가 «서버를 안 부른 그 자리»여야 한다 */
  assert.match(bare, /_saved\+\+/, '★★ 아낀 횟수를 세지 않습니다 — 화면이 「0원」이라 말할 수 없습니다');
});

/* ══════ ③ 유일한 문 앞에 ══════ */

test('★★ 유료 판독으로 가는 «유일한 문» 앞에 둔다', () => {
  const fn = cutFn(src, 'function askProxy(parts, opts)');
  assert.match(fn, /partsFingerprint/, '★★ 문 앞에서 지문을 안 봅니다');
  assert.match(fn, /cacheGet/, '★★ 지난 결과를 안 찾습니다 — 매번 돈이 나갑니다');
  assert.match(fn, /cachePut/, '★★ 읽은 결과를 안 담습니다 — 다음에 또 읽습니다');
  /* ⚠ 서버를 부르는 일은 «그 뒤»에 있어야 한다. 앞에 있으면 돈이 먼저 나간다. */
  assert.doesNotMatch(fn, /deps\.fetch/,
    '★★ 기억을 보기 «전»에 서버를 부릅니다 — 아끼는 뜻이 없습니다');

  /* 부르는 곳이 넷인데 한 곳만 빠뜨려도 그 길은 계속 돈을 태운다 */
  const 부름 = (bare.match(/askProxy\(/g) || []).length;
  assert.ok(부름 >= 4, '★ askProxy 를 부르는 곳이 ' + 부름 + '군데뿐입니다 — 찾는 방식이 낡았는지 보십시오');
  assert.equal((bare.match(/function askProxyNet\(/g) || []).length, 1,
    '★ 서버를 실제로 부르는 함수가 하나여야 합니다');
});

test('★ 「다시 읽기」는 기억을 건너뛴다 — 판독이 틀렸을 때 갇히면 안 된다', () => {
  const fn = cutFn(src, 'function askProxy(parts, opts)');
  assert.match(fn, /opts && opts\.fresh/,
    '★ 강제로 새로 읽는 길이 없습니다 — 한 번 틀리면 90일 동안 그 답이 나옵니다');
});

/* ══════ ④⑤ 넘어져도 판독은 돈다 · 낡은 것은 버린다 ══════ */

test('★★ 기억이 안 되는 곳에서도 판독은 그대로 돈다', () => {
  ['function cacheOpen()', 'function cacheGet(fp)', 'function cachePut(fp, reply)']
    .forEach(function (name) {
      const fn = cutFn(src, name);
      assert.match(fn, /catch|onerror/,
        '★★ ' + name + ' 가 넘어지면 판독까지 죽습니다 — 기억은 «덤»이지 조건이 아닙니다');
    });
  assert.match(cutFn(src, 'function cacheOpen()'), /if \(!idb\) return Promise\.resolve\(null\)/,
    '★★ IndexedDB 가 없는 곳(사생활 보호 창 등)에서 판독이 멎습니다');
});

test('★ 낡은 기억은 버린다 — 안 버리면 브라우저 저장칸이 조용히 차오른다', () => {
  assert.match(bare, /CACHE_DAYS\s*=\s*\d+/, '★ 보관 기간이 없습니다');
  const get = cutFn(src, 'function cacheGet(fp)');
  assert.match(get, /Date\.now\(\) - v\.at > CACHE_DAYS/,
    '★★ 낡았는지 안 보고 그대로 씁니다 — 몇 해 전 답이 나옵니다');
});

/* ══════ 화면에 닿는가 ══════ */

test('판독 층을 고쳤으니 «부르는 화면 전부»의 캐시 번호가 올라가 있다', () => {
  /* ⚠ 화면 이름을 손으로 적지 않는다 — 2026-09-13 에 다섯 화면 중 «셋»만 적었다가
       gov-consulting·pu-paydata 를 빠뜨려 검사 다섯이 한꺼번에 걸렸다.
       부르는 화면을 «찾아서» 본다. 새 화면이 붙어도 따라온다. */
  const 화면 = fs.readdirSync(R).filter(function (n) { return /\.html$/.test(n); })
    .map(function (n) {
      const m = fs.readFileSync(path.join(R, n), 'utf8').match(/js\/pu-doc-read\.js\?v=(\d+)/);
      return m ? { n: n, v: Number(m[1]) } : null;
    }).filter(Boolean);
  assert.ok(화면.length >= 5,
    '★ 판독 층을 부르는 화면이 ' + 화면.length + '개뿐입니다 — 찾는 방식이 낡았는지 보십시오');
  화면.forEach(function (f) {
    assert.ok(f.v >= 41,   // 검사고정-허용: 이 변경이 들어간 판
      '★★ ' + f.n + ' 의 캐시 번호가 ' + f.v + ' 입니다 — 옛 판독 층을 써서 '
      + '그 화면만 중복 막기가 안 닿습니다');
  });
});
