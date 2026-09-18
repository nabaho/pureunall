'use strict';
/* 주석 걷개를 «잘못 든 쪽»에 쓰는 일이 되풀이되지 않게 한다.

   ■ 무엇이 문제였나 (2026-09-18)

   `stripComments` 는 주석을 **<script>·<style> 태그 «안»에서만** 걷는다.
   그렇게 만든 까닭은 마크업의 `accept="image/*"` 를 주석 시작으로 읽고
   673KB 중 230KB(34%)를 삼킨 사고가 2026-08-30 에 있었기 때문이다.

   뒤집어 보면 **태그가 없으면 한 글자도 안 걷는다.** 그런데 검사 47파일이
   함수 «조각»과 «.js 파일»에 그대로 쓰고 있었다 — 약 120곳.

       const fn = stripComments(cutFn(RAW, 'function autoReadPending('));   // ✗
       const IDX = stripComments(fs.readFileSync('functions/index.js'));     // ✗

   그러면 두 방향으로 어긋난다:
     ① `assert.match(fn, /무엇/)` 이 **주석에 그 낱말이 있으면 통과한다** —
        코드가 규칙을 안 지켜도 조용히 초록이다. 이쪽이 훨씬 무섭다.
     ② `assert.ok(!/옛길/.test(fn))` 이 주석의 «설명»만으로 깨진다.
        실제로 2026-09-18 에 그렇게 깨졌다(nas-connect-fail-help).

   ■ 여기서 무엇을 보나

   ⚠ 「stripComments 를 조각에 쓰지 마라」를 **글자로 찾지 않는다.** 그것은
     모양을 못 박는 검사가 되어(CLAUDE.md 「검사를 쓰는 규칙」) 부르는 방식이
     조금만 달라져도 헛돈다. 부르는 길은 cutFn·grab·조각·.slice·변수로 받은 것
     등 제각각이라 글자로는 어차피 다 못 찾는다.

   그래서 **걷개 자신에게 문지기를 달고**(tests/strip-comments.js),
   여기서는 그 문지기가 «실제로 살아 있는가»를 본다 —
   ① 조각을 넣으면 정말 소리를 내는가(이빨이 있는가)
   ② 통째 HTML 은 그대로 지나가는가(헛소리를 안 하는가)
   ③ 옛 사고(마크업 삼키기)가 되살아나지 않았는가

   조각에 stripComments 를 쓰는 검사는 그 검사가 돌 때 **그 자리에서** 터진다.
   여기 목록을 손으로 늘릴 일이 없다는 뜻이다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { stripComments, stripJs } = require('./strip-comments.js');

/* ══════ ① 문지기에 이빨이 있다 ══════ */

test('★★ 함수 «조각»을 stripComments 에 넣으면 그 자리에서 소리 낸다', () => {
  const 조각 = 'function readWaitOf(it) {\n' +
               '  /* 하루 몫이 없으면 readQuotaOut 으로 막는다 */\n' +
               '  return 1;\n}';
  /* 주석에만 있는 낱말 — 코드에는 없다 */
  assert.ok(조각.indexOf('readQuotaOut') > 0, '표본이 잘못됐습니다');

  assert.throws(() => stripComments(조각), /통째 HTML 문서/,
    '★★ 조각을 넣어도 조용히 지나갑니다 — 그러면 검사가 «주석을 보고» 통과합니다');

  /* 옳은 쪽은 주석을 실제로 걷는다 */
  assert.ok(stripJs(조각).indexOf('readQuotaOut') < 0,
    '★★ stripJs 가 주석을 안 걷습니다 — 걷개가 통째로 헛돕니다');
});

test('★★ .js 파일을 통째로 넣어도 소리 낸다 — 거기에도 <script> 태그가 없다', () => {
  const js = '/* 판독 대리인 — 서버가 AI 를 부른다 */\nfunction run() { return 2; }\n';
  assert.throws(() => stripComments(js), /통째 HTML 문서/,
    '★★ .js 파일은 통째로 코드입니다 — stripComments 는 여기서 아무 일도 못 합니다');
  assert.ok(stripJs(js).indexOf('판독 대리인') < 0, '★ stripJs 가 걷지 못했습니다');
});

/* ══════ ② 헛소리는 안 한다 ══════ */

test('★ 통째 HTML 문서는 그대로 지나간다 — 문지기가 제 일을 막으면 안 된다', () => {
  const html = '<!doctype html>\n<!-- 설명 -->\n<style>/* 색 */ .a{color:red}</style>\n' +
               '<script>\n/* 걷힐 주석 */\nvar a = 1;\n</script>\n';
  const bare = stripComments(html);
  assert.ok(bare.indexOf('걷힐 주석') < 0, '★ <script> 안 주석을 안 걷었습니다');
  assert.ok(bare.indexOf('설명') < 0, '★ HTML 주석을 안 걷었습니다');
  assert.ok(bare.indexOf('var a = 1') > 0, '★ 코드까지 삼켰습니다');
});

test('★ 주석이 아예 없는 조각은 안 운다 — 오늘 결과가 같은 것까지 막지 않는다', () => {
  assert.doesNotThrow(() => stripComments('function f() { return 1; }'));
});

/* ══════ ③ 2026-08-30 사고가 되살아나지 않았다 ══════ */

test('★★★ 마크업의 accept="image/*" 를 주석으로 읽지 않는다 — 230KB 를 삼켰던 자리다', () => {
  const html = '<input type="file" accept="image/*">\n' +
               '<div id="kindPopupTitle">갈래</div>\n' +
               '<script>var x = 1;</script>\n';
  const bare = stripComments(html);
  assert.ok(bare.indexOf('kindPopupTitle') > 0,
    '★★★ 별표 앞 빗금을 주석 시작으로 읽고 뒤를 통째로 삼켰습니다 (2026-08-30 사고)');
});

/* ══════ ④ 걷개가 실제로 쓰이고 있다 ══════ */

test('★ 검사들이 걷개를 «한 곳»에서 꺼내 쓴다 — 손으로 적으면 조용히 어긋난다', () => {
  const TDIR = __dirname;
  const 제손으로 = [];
  fs.readdirSync(TDIR).filter(f => f.endsWith('.test.js')).forEach(function (tf) {
    if (tf === path.basename(__filename)) return;
    const t = fs.readFileSync(path.join(TDIR, tf), 'utf8');
    /* 「stripComments/stripJs 를 제 파일 안에서 정의」하고 있으면 사본이다 */
    if (/^\s*(?:function|const)\s+strip(?:Comments|Js)\s*[=(]/m.test(t)) 제손으로.push(tf);
  });
  assert.deepEqual(제손으로, [],
    '★ 걷개를 검사 파일 안에서 따로 만들었습니다. 사본은 본을 따라오지 않습니다 —\n' +
    "  tests/strip-comments.js 에서 꺼내 쓰세요: const { stripJs } = require('./strip-comments.js');\n" +
    '  (조각·.js 는 stripJs, 통째 HTML 문서는 stripComments)');
});

test('★★ 이 검사에 «이빨»이 있다 — 문지기를 떼면 위 검사들이 실제로 깨진다', () => {
  /* 걷개 원본에 문지기가 «살아 있는지»를 결과로 확인한다.
     ⚠ 글자로 찾지 않는다 — 함수 이름이 바뀌어도 돌아야 한다. */
  const src = fs.readFileSync(path.join(__dirname, 'strip-comments.js'), 'utf8');
  const 문지기없이 = src.replace(/if \(걷을것이없나\(s\)\) \{[\s\S]*?\n  \}/, '');
  assert.notEqual(문지기없이, src,
    '★★ 문지기를 찾지 못했습니다 — 이름이 바뀌었다면 이 검사도 함께 고쳐 주세요');

  const mod = { exports: {} };
  new Function('module', 'exports', 문지기없이)(mod, mod.exports);
  assert.doesNotThrow(() => mod.exports.stripComments('/* 주석 */ var a = 1;'),
    '★★ 문지기를 뺐는데도 터집니다 — 위 검사가 다른 까닭으로 통과하고 있습니다');
});
