'use strict';
/* TypeSafe(Jev) 검토 — 울타리 세 가지가 «실제로 붙어 있는가» (2026-09-20 대표 지시 「고쳐라」)
 * + 여러 화면이 나눠 쓸 수 있는 «공용 부품»인가 (2026-09-20 대표 지시 「통합시스템 전체에서」)
 *
 * ■ 무엇이 있었나
 * 9-20 에 이 연결이 배포됐는데, 서버 기록을 읽어 보니 «한 번도 안 불린» 채였다.
 * 그 상태에서 울타리 셋이 비어 있었다 —
 *   ㉠ 실패 까닭이 전부 한 마디로 뭉뚱그려져 있었다(열쇠 문제인지 업체 장애인지 못 가린다)
 *   ㉡ 떠 있는 단추가 «로그인 화면 위에도» 보였다
 *   ㉢ 하루 한도가 «없었다» — 로그인한 직원 누구나 무제한
 * 셋을 고친 뒤, 대표가 「이알피 안에서만 쓰지 말고 통합시스템 전체에서 쓸 수 있게」라고
 * 하셔서 화면 쪽 코드를 js/pu-typesafe.js(공용 부품)로 뽑았다(pu-gate.js·pu-backup.js 와 같은 길).
 * ⚠ 뽑아낸 것 자체가 «켰다»는 뜻은 아니다 — 지금은 pu-erp.html 만 그 부품을 부른다.
 *   다른 화면에 붙이는 것은 대표 판단 셋(이름·국외보관·사용범위)이 끝난 뒤의 걸음이다.
 *
 * ■ 여기서 보는 것 — «값»이 아니라 «규칙»이다
 * 문구·숫자·좌표는 안 본다(그것은 typesafe-evaluate.test.js 가 규칙으로 본다).
 * 여기서는 **이은 자리**만 본다: 부르기 «전»에 막는가, 성공한 것만 세는가,
 * 로그아웃하면 감추는가, 그리고 그 감춤이 «이 화면만»의 것이 아니라 다른 화면에
 * 붙여도 먹히는가. 이 넷은 한 곳이라도 끊기면 울타리가 통째로 없는 것과 같다. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { cutFn } = require('./cut-fn');
const { stripComments, stripJs } = require('./strip-comments');

const ROOT = path.join(__dirname, '..');
const FN = fs.readFileSync(path.join(ROOT, 'functions', 'index.js'), 'utf8');
const ERP = fs.readFileSync(path.join(ROOT, 'pu-erp.html'), 'utf8');
const WIDGET = fs.readFileSync(path.join(ROOT, 'js', 'pu-typesafe.js'), 'utf8');

/* 손잡이 하나 — 서버 쪽 판단이 한 곳에 모여 있어야 여기서 볼 수 있다 */
const 맡은곳 = FN.slice(FN.indexOf('exports.typeSafeEvaluate'));
const 본체 = 맡은곳.slice(0, 맡은곳.indexOf('\n/* 열쇠를 얻는다'));

test('하루 문은 업체를 부르기 «전»에 선다', () => {
  const 셈본자리 = 본체.indexOf('typeSafeDayLeft');
  const 부른자리 = 본체.indexOf('TypeSafeEvaluate.evaluate');
  assert.ok(셈본자리 > 0, '하루 몫을 읽는 자리가 없습니다 — 한도가 없는 것과 같습니다.');
  assert.ok(부른자리 > 0, '업체를 부르는 자리를 못 찾았습니다.');
  assert.ok(셈본자리 < 부른자리,
    '한도를 «부른 뒤»에 보면 글은 이미 업체로 나간 뒤입니다 — 막는 뜻이 없습니다.');
  /* 넘었으면 거기서 끝나야 한다 — 보기만 하고 지나가면 문이 아니다 */
  const 사이 = 본체.slice(셈본자리, 부른자리);
  assert.match(사이, /\breturn\b/,
    '한도를 넘었을 때 되돌아가는 자리가 없습니다 — 읽기만 하고 그냥 부릅니다.');
});

test('센다 — 성공한 것만, 그리고 셈이 막히는 문이 되지는 않는다', () => {
  assert.match(본체, /result\.ok[\s\S]{0,200}bumpTypeSafeTally/,
    '성공 갈래 안에서 세야 합니다 — 열쇠가 거절된 부름은 글이 남지 않았으므로 몫을 먹이지 않습니다.');

  const 읽개 = cutFn(FN, 'async function typeSafeDayLeft(');
  assert.match(읽개, /catch/, '셈을 못 읽을 때를 받는 자리가 없습니다.');
  assert.match(읽개, /over:\s*false/,
    '실시간DB 가 잠깐 흔들릴 때 기능이 통째로 멎습니다 — 못 읽으면 막지 않아야 합니다.');

  const 적개 = cutFn(FN, 'async function bumpTypeSafeTally(');
  assert.match(적개, /transaction/,
    '거래로 올려야 여럿이 같은 때 눌러도 셈이 어긋나지 않습니다.');
});

test('남은 횟수를 돌려준다 — 화면이 스스로 셈을 읽지 않아도 되게', () => {
  assert.match(본체, /result\.left\s*=/,
    '남은 횟수를 안 돌려주면 화면은 셈 자리를 직접 읽어야 하고, 그러면 규칙을 새로 열어야 합니다.');
});

/* ══ 여기부터 — 공용 부품(js/pu-typesafe.js)이 «어느 화면에 붙여도» 옳게 도는가 ══ */

test('로그인 여부는 호스트 화면이 알려 줄 수 있고, 안 알려 주면 파이어베이스로 판단한다', () => {
  const bare = stripJs(WIDGET);
  const 판단개 = cutFn(bare, 'function isLoggedIn(');
  assert.match(판단개, /PU_TYPESAFE_IS_LOGGED_IN/,
    '호스트 화면이 더 정확한 로그인 판정을 넘길 길이 없으면, 이알피처럼 «통합 로그인은 됐지만' +
    ' 진짜 로그인은 아직»인 화면에서 단추가 잘못 보입니다.');
  assert.match(판단개, /firebase\.auth\(\)\.currentUser/,
    '호스트가 안 알려 줘도 기본으로 판단할 길이 있어야, 아무 화면에나 붙여도 돌아갑니다.');
});

test('감추는 표시는 «이 부품 자신의» 이름이다 — 호스트 화면의 이름을 빌리지 않는다', () => {
  const bare = stripJs(WIDGET);
  assert.match(bare, /body\.pu-typesafe-hidden\s+#pu-typesafe-review-button\s*\{[^}]*display:\s*none/,
    '단추를 감추는 규칙이 없습니다.');
  assert.match(bare, /body\.pu-typesafe-hidden\s+#pu-typesafe-review\s*\{[^}]*display:\s*none/,
    '열려 있던 창까지 감추지 않으면, 열어 둔 채 로그아웃했을 때 창만 남습니다.');
  /* ⚠ 호스트 화면 고유의 이름(pe-logged-out 등)에 기대면, 이 부품을 다른 화면에
     붙였을 때 그 이름을 아무도 안 걸어 줘 항상 안 감춰지거나 항상 감춰집니다. */
  assert.doesNotMatch(bare, /\bpe-logged-out\b/,
    '이알피만 아는 이름에 기대고 있습니다 — 다른 화면에 붙이면 안 먹습니다.');
});

test('공용 부품은 «혼자서도» 돈다 — 이알피의 전역 도우미에 기대지 않는다', () => {
  const bare = stripJs(WIDGET);
  /* fetchT·CURRENT_USER·PuBack 은 pu-erp.html 안에서만 정의된다. 이런 이름을
     그대로 쓰면 다른 화면에 붙이는 순간 ReferenceError 로 죽는다. */
  ['fetchT(', 'CURRENT_USER', 'PuBack.'].forEach((전용) => {
    const 안전패턴 = 전용.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.doesNotMatch(bare, new RegExp(안전패턴),
      '이알피 전용 도우미(' + 전용 + ')를 씁니다 — 다른 화면에 붙이면 정의돼 있지 않습니다.');
  });
});

test('이알피는 자기가 아는 «진짜 로그인»을 공용 부품에 넘긴다', () => {
  const bare = stripComments(ERP);
  assert.match(bare, /window\.PU_TYPESAFE_IS_LOGGED_IN\s*=\s*function\s*\(\s*\)\s*\{\s*return\s+isLoggedIn/,
    '이알피가 자기만 아는 로그인 상태를 부품에 안 알려 주면, 부품은 파이어베이스 로그인만' +
    ' 보고 판단해 통합 로그인 중 화면에서도 단추가 보일 수 있습니다.');
  assert.match(bare, /PuTypeSafe\.refresh/,
    '로그인 상태가 바뀐 뒤 부품에 다시 보라고 알려 주지 않으면, 로그아웃해도 단추가 그대로 남습니다.');
  assert.match(bare, /<script src="js\/pu-typesafe\.js\?v=\d+"><\/script>/,
    '공용 부품 파일을 안 부르면 위의 넘겨주는 코드가 아무 소용이 없습니다.');
});

test('화면은 까닭(why)을 «무엇을 하면 되는지»로 바꿔 보인다', () => {
  const bare = stripJs(WIDGET);
  const 바꾸개 = cutFn(bare, 'function failure(');
  assert.match(바꾸개, /\bwhy\b/, '서버가 갈라 준 까닭을 안 읽으면 가른 뜻이 없습니다.');
  assert.match(바꾸개, /hint/, '업체가 보낸 한마디를 버리면 첫 시험에서 무엇이 문제인지 못 봅니다.');

  /* 까닭표에 서버의 갈래가 모두 들어 있어야 한다 — 하나라도 빠지면 그 실패만
     «무엇을 하라»는 말 없이 남는다. 문구는 안 본다, 열쇠만 본다. */
  const 서버갈래 = require('../functions/typesafe-evaluate').FAILURES
    .map((f) => f.why).concat(['network', 'dayLimit', 'noKey']);
  const NEXT시작 = bare.search(/var\s+NEXT\s*=\s*\{/);
  assert.ok(NEXT시작 >= 0, '까닭 → 할 일 표(NEXT)를 못 찾았습니다.');
  const 표 = bare.slice(NEXT시작);
  [...new Set(서버갈래)].forEach((why) => {
    assert.ok(new RegExp('\\b' + why + '\\s*:').test(표.slice(0, 900)),
      '「' + why + '」 갈래에 다음에 할 일이 안 적혀 있습니다.');
  });
});
