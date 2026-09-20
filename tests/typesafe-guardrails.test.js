'use strict';
/* TypeSafe(Jev) 검토 — 울타리 세 가지가 «실제로 붙어 있는가» (2026-09-20 대표 지시 「고쳐라」)

   ■ 무엇이 있었나
   9-20 에 이 연결이 배포됐는데, 서버 기록을 읽어 보니 «한 번도 안 불린» 채였다.
   그 상태에서 셋이 비어 있었다 —
     ㉠ 실패 까닭이 전부 한 마디로 뭉뚱그려져 있었다(열쇠 문제인지 업체 장애인지 못 가린다)
     ㉡ 떠 있는 단추가 «로그인 화면 위에도» 보였다
     ㉢ 하루 한도가 «없었다» — 로그인한 직원 누구나 무제한
   ㉢ 이 특히 나쁘다. 이름·업체명·주소는 가려지지 않은 채 미국 업체로 나가고,
   공식 API 직접 호출에는 「안 남기기」 선택이 없어 보낸 글이 그쪽에 남는다.

   ■ 여기서 보는 것 — «값»이 아니라 «규칙»이다
   문구·숫자·좌표는 안 본다(그것은 typesafe-evaluate.test.js 가 규칙으로 본다).
   여기서는 **이은 자리**만 본다: 부르기 «전»에 막는가, 성공한 것만 세는가,
   로그아웃하면 감추는가. 이 셋은 한 곳이라도 끊기면 울타리가 통째로 없는 것과 같다. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { cutFn } = require('./cut-fn');
const { stripComments } = require('./strip-comments');

const ROOT = path.join(__dirname, '..');
const FN = fs.readFileSync(path.join(ROOT, 'functions', 'index.js'), 'utf8');
const ERP = fs.readFileSync(path.join(ROOT, 'pu-erp.html'), 'utf8');

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

test('떠 있는 단추는 로그인 전에 감춘다', () => {
  const bare = stripComments(ERP);
  /* ① 리액트가 «진짜 로그인»을 몸통 표시로 내보낸다 — 파이어베이스 로그인만으로는
        못 가른다(통합 로그인은 됐는데 직원표에 짝이 없는 동안에도 currentUser 는 있다). */
  assert.match(bare, /classList\.toggle\(\s*'pe-logged-out'\s*,\s*!isLoggedIn\s*\)/,
    '로그인 여부를 몸통 표시로 내보내는 자리가 없습니다.');
  /* ② 그 표시가 걸리면 단추가 사라져야 한다 */
  assert.match(bare, /body\.pe-logged-out\s+#pu-typesafe-review-button\s*\{[^}]*display:\s*none/,
    '표시만 걸고 감추지 않으면 아무 일도 안 일어납니다.');
  /* ③ 열려 있던 창도 함께 — 열어 둔 채 로그아웃하면 창만 남는다 */
  assert.match(bare, /body\.pe-logged-out\s+#pu-typesafe-review\s*\{[^}]*display:\s*none/,
    '창을 열어 둔 채 로그아웃하면 창이 그대로 남습니다.');
});

test('화면은 까닭(why)을 «무엇을 하면 되는지»로 바꿔 보인다', () => {
  const bare = stripComments(ERP);
  const 바꾸개 = cutFn(bare, 'function failure(');
  assert.match(바꾸개, /\bwhy\b/, '서버가 갈라 준 까닭을 안 읽으면 가른 뜻이 없습니다.');
  assert.match(바꾸개, /hint/, '업체가 보낸 한마디를 버리면 첫 시험에서 무엇이 문제인지 못 봅니다.');

  /* 까닭표에 서버의 갈래가 모두 들어 있어야 한다 — 하나라도 빠지면 그 실패만
     «무엇을 하라»는 말 없이 남는다. 문구는 안 본다, 열쇠만 본다. */
  const 서버갈래 = require('../functions/typesafe-evaluate').FAILURES
    .map((f) => f.why).concat(['network', 'dayLimit', 'noKey']);
  const 표 = bare.slice(bare.indexOf('var NEXT={'));
  [...new Set(서버갈래)].forEach((why) => {
    assert.ok(new RegExp('\\b' + why + '\\s*:').test(표.slice(0, 900)),
      '「' + why + '」 갈래에 다음에 할 일이 안 적혀 있습니다.');
  });
});
