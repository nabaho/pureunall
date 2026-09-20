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
 *   다른 화면에 붙이는 것은 대표 판단 나머지 둘(이름·국외보관)이 끝난 뒤의 걸음이다.
 * 세 판단 가운데 «사용범위»는 2026-09-20 에 정해졌다 — 「관리자만 일단쓴다」.
 * 화면(단추 숨김)과 서버(functions/index.js typeSafeIsAdmin) **둘 다** 본다 —
 * 화면 판정은 표시일 뿐이고, 진짜 자격은 서버가 매번 다시 검사한다.
 *
 * ■ 여기서 보는 것 — «값»이 아니라 «규칙»이다
 * 문구·숫자·좌표는 안 본다(그것은 typesafe-evaluate.test.js 가 규칙으로 본다).
 * 여기서는 **이은 자리**만 본다: 부르기 «전»에 막는가, 성공한 것만 세는가,
 * 로그아웃하면 감추는가, 관리자가 아니면 막는가, 그리고 그 감춤이 «이 화면만»의
 * 것이 아니라 다른 화면에 붙여도 먹히는가. 이 다섯은 한 곳이라도 끊기면
 * 울타리가 통째로 없는 것과 같다. */

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

/* ══ 관리자만 (2026-09-20 대표 결정 「관리자만 일단쓴다」) ══════════════════════ */

test('관리자 확인은 로그인 다음, «무엇보다 먼저» 선다', () => {
  const 확인자리 = 본체.indexOf('typeSafeIsAdmin(who');
  const 열쇠확인자리 = 본체.indexOf('noKey');
  const 셈본자리 = 본체.indexOf('typeSafeDayLeft');
  const 부른자리 = 본체.indexOf('TypeSafeEvaluate.evaluate');
  assert.ok(확인자리 > 0, '관리자 확인 자리를 못 찾았습니다 — 아무나 쓸 수 있는 것과 같습니다.');
  assert.ok(확인자리 < 열쇠확인자리,
    '관리자 확인이 열쇠 확인보다 뒤에 있습니다 — 관리자가 아닌 사람에게 「열쇠가 없다」같은' +
    ' 서버 금고 상태까지 알려 줄 까닭이 없습니다.');
  assert.ok(확인자리 < 셈본자리 && 확인자리 < 부른자리,
    '관리자 확인이 하루 문·업체 호출보다 뒤에 있습니다 — 자격 없는 사람의 글이 먼저 나갈 수 있습니다.');
  /* 넘겼으면(아니면) 거기서 끝나야 한다 */
  const 사이 = 본체.slice(확인자리, 열쇠확인자리);
  assert.match(사이, /\breturn\b/,
    '관리자가 아닐 때 되돌아가는 자리가 없습니다 — 확인만 하고 그냥 넘어갑니다.');
  assert.match(사이, /403/, '권한 없음은 403 으로 답해야 합니다(401 은 «로그인 안 함»과 헷갈립니다).');
});

test('관리자 확인은 «진짜 역할표»를 본다 — 아무나 통과시키지 않는다', () => {
  const 확인개 = cutFn(FN, 'async function typeSafeIsAdmin(');
  const try부분 = 확인개.slice(확인개.indexOf('try'), 확인개.indexOf('catch'));
  assert.match(try부분, /role\.isAdmin\s*\|\|\s*role\.isSubAdmin/,
    '성공 갈래가 role.isAdmin/isSubAdmin 을 안 봅니다 — 값을 못 박지 않고 그냥 true 를' +
    ' 돌려줘도 이 검사를 통과할 수 있다는 뜻입니다(그러면 아무나 관리자가 됩니다).');
  /* 서버가 보는 자리(uid_roles)와 이알피가 이미 아는 자리(CURRENT_USER.isAdmin/isSubAdmin)가
     «같은 기준»이어야 한다 — 다르면 화면엔 단추가 안 보이는데 서버는 통과시키거나,
     그 반대가 된다. isSubAdmin 을 하나만 빠뜨려도 이 검사가 잡는다. */
  assert.match(try부분, /uid_roles\//, 'uid_roles 를 안 봅니다 — 이 저장소의 다른 관리자 확인과 기준이 달라집니다.');
});

test('관리자 판정은 «못 읽으면 막는다» — 하루 문과 반대 방향이다', () => {
  const 확인개 = cutFn(FN, 'async function typeSafeIsAdmin(');
  assert.match(확인개, /catch/, '못 읽을 때를 받는 자리가 없습니다.');
  /* 하루 문(typeSafeDayLeft)은 못 읽으면 over:false(연다) — 여긴 반대로 false(막는다)여야 한다.
     ⚠ 값이 아니라 «방향»을 본다: catch 블록이 true 를 돌려주면(열어 버리면) 이 검사가 잡는다. */
  const catch부분 = 확인개.slice(확인개.indexOf('catch'));
  assert.doesNotMatch(catch부분, /return\s+true/,
    '못 읽었는데 관리자로 쳐 줍니다 — 권한 확인은 «모르면 막는다»가 안전합니다.');
  assert.match(catch부분, /return\s+false/,
    '못 읽었을 때 명시적으로 막지 않습니다.');
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

test('관리자가 아니면(또는 모르면) 단추를 감춘다 — «모르면 보여 준다»가 아니다', () => {
  const bare = stripJs(WIDGET);
  assert.match(bare, /toggle\(\s*'pu-typesafe-hidden'\s*,\s*!\(\s*isLoggedIn\(\)\s*&&\s*isAdmin\(\)\s*\)\s*\)/,
    '감추는 판정이 로그인 «그리고» 관리자 둘 다를 보지 않습니다.');

  const 넘김개 = cutFn(bare, 'function adminOverride(');
  /* ⚠ 이름이 «어딘가에 있다»만 보면 안 된다 — 지키개(guard) 줄이 지워져 그 아래 줄이
     죽은 코드로 남아도 이름은 여전히 파일 어딘가에 있어 통과해 버린다. 그래서
     «호스트가 안 정의했으면 null」을 가르는 지키개 자체의 모양을 못 박는다. */
  assert.match(넘김개, /typeof\s+w\.PU_TYPESAFE_IS_ADMIN\s*!==\s*'function'/,
    '호스트가 정의했는지 가르는 지키개 줄이 없습니다 — 그 아래 «호스트 판정을 실제로 부르는»' +
    ' 코드가 죽은 자리에 남아 있을 수 있습니다(항상 그 앞에서 return 됨).');
  assert.match(넘김개, /return\s+!!w\.PU_TYPESAFE_IS_ADMIN\(\)/,
    '호스트 화면이 더 정확한 관리자 판정을 넘길 길이 없으면, 이알피처럼 이미 아는 화면도' +
    ' 서버(uid_roles)를 다시 왕복해야 합니다.');
  /* fail-closed — 넘긴 게 없을 때(모를 때) 참을 돌려주면 로그인 직후 한순간 단추가 보입니다. */
  const 판단개 = cutFn(bare, 'function isAdmin(');
  assert.doesNotMatch(판단개, /return\s+true\s*;\s*$/m,
    '모를 때 기본으로 참을 돌려줍니다 — 관리자 판정은 «모르면 막는다»가 안전합니다.');
});

test('호스트가 안 알려 주면 uid_roles 를 스스로 읽고, 못 읽으면 «아니다»로 정한다', () => {
  const bare = stripJs(WIDGET);
  assert.match(bare, /uid_roles\//, 'uid_roles 를 읽는 자리가 없습니다 — pu-backup.js 와 다른 기준을 쓰게 됩니다.');
  const 읽개 = cutFn(bare, 'function lookUpAdminIfNeeded(');
  assert.match(읽개, /isAdmin\s*\|\|[\s\S]{0,20}isSubAdmin/,
    '관리자 판정에 부관리자(isSubAdmin)를 안 넣었습니다 — 이 저장소의 다른 관리자 전용 기능과' +
    ' 기준이 달라집니다(pu-erp.html 의 CURRENT_USER.isAdmin || CURRENT_USER.isSubAdmin 과 비교).');
  assert.match(읽개, /_adminKnownValue\s*=\s*false/,
    '서버 읽기가 실패했을 때 «아니다»로 정하는 자리가 없습니다.');
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

test('이알피는 자기가 아는 «진짜 로그인» 과 «관리자 여부»를 공용 부품에 넘긴다', () => {
  const bare = stripComments(ERP);
  assert.match(bare, /window\.PU_TYPESAFE_IS_LOGGED_IN\s*=\s*function\s*\(\s*\)\s*\{\s*return\s+isLoggedIn/,
    '이알피가 자기만 아는 로그인 상태를 부품에 안 알려 주면, 부품은 파이어베이스 로그인만' +
    ' 보고 판단해 통합 로그인 중 화면에서도 단추가 보일 수 있습니다.');
  assert.match(bare, /window\.PU_TYPESAFE_IS_ADMIN\s*=\s*function\s*\(\s*\)\s*\{\s*return\s*!!\(\s*CURRENT_USER\.isAdmin\s*\|\|\s*CURRENT_USER\.isSubAdmin\s*\)/,
    '이알피가 이미 아는 CURRENT_USER.isAdmin/isSubAdmin 을 부품에 안 넘기면, 이미 아는' +
    ' 값이 있는데도 부품이 굳이 서버(uid_roles)를 다시 왕복합니다.');
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
    .map((f) => f.why).concat(['network', 'dayLimit', 'noKey', 'adminOnly']);
  const NEXT시작 = bare.search(/var\s+NEXT\s*=\s*\{/);
  assert.ok(NEXT시작 >= 0, '까닭 → 할 일 표(NEXT)를 못 찾았습니다.');
  const 표 = bare.slice(NEXT시작);
  [...new Set(서버갈래)].forEach((why) => {
    assert.ok(new RegExp('\\b' + why + '\\s*:').test(표.slice(0, 900)),
      '「' + why + '」 갈래에 다음에 할 일이 안 적혀 있습니다.');
  });
});

/* ══ 우리가 아는 이름·업체명 가리기 (2026-09-20 대표 결정 「우리 목록만」) ═════════
   값·경계는 tests/typesafe-local-redact.test.js 가 vm 으로 실제로 돌려 본다.
   여기서는 «이어진 자리»만 본다 — 언제 부르는가, 없으면 어떻게 되는가. */

test('업체를 부르기 «전»에 이름·업체명을 먼저 가린다', () => {
  const bare = stripJs(WIDGET);
  const 함수몸 = cutFn(bare, 'async function run(');
  const 가리는자리 = 함수몸.indexOf('localRedact(text)');
  const 부르는자리 = 함수몸.indexOf('fetchTimeout(FN_URL');
  assert.ok(가리는자리 > 0, 'localRedact 를 부르는 자리를 못 찾았습니다.');
  assert.ok(가리는자리 < 부르는자리,
    '가리기를 «부른 뒤»에 하면 원문이 이미 업체로 나간 뒤입니다.');
  /* 가린 결과를 실제로 text 에 다시 담아야 한다 — 계산만 하고 안 쓰면 소용없다 */
  assert.match(함수몸.slice(가리는자리, 부르는자리), /text\s*=\s*local\.text/,
    '가린 결과를 text 에 다시 담지 않으면 원문이 그대로 나갑니다.');
});

test('호스트가 안 가려 줘도(다른 화면) 죽지 않고 원문을 그대로 쓴다', () => {
  const bare = stripJs(WIDGET);
  const 가리개 = cutFn(bare, 'function localRedact(');
  assert.match(가리개, /typeof\s+w\.PU_TYPESAFE_LOCAL_REDACT\s*!==\s*'function'/,
    '정의 여부를 가르는 지키개가 없습니다 — 다른 화면(정의 안 함)에서 그냥 죽을 수 있습니다.');
  assert.match(가리개, /catch/, '가리는 함수가 죽어도 판단 자체는 막지 말아야 하는데, 받는 자리가 없습니다.');
});

test('가린 항목 안내에 «우리 목록» 가림과 서버(번호) 가림이 함께 보인다', () => {
  const bare = stripJs(WIDGET);
  const 함수몸 = cutFn(bare, 'async function run(');
  assert.match(함수몸, /local\.localMaskedKinds\.concat\(\s*data\.maskedKinds/,
    '화면 쪽(이름·업체명) 가림과 서버 쪽(번호) 가림을 한 자리에 안 합칩니다 — 무엇이' +
    ' 가려졌는지 한쪽만 보이면 나머지는 가려진 줄 착각하기 쉽습니다.');
});

test('이알피는 우리가 아는 이름·업체명 가리기 함수를 공용 부품에 실제로 넘긴다', () => {
  const bare = stripComments(ERP);
  assert.match(bare, /window\.PU_TYPESAFE_LOCAL_REDACT\s*=\s*typeSafeLocalRedact/,
    '전역에 안 걸면 js/pu-typesafe.js 가 이 함수를 찾지 못해 번호만 가려진 채 나갑니다.');
  const 가리개 = cutFn(bare, 'function typeSafeLocalRedact(');
  assert.match(가리개, /dbGet\(\s*'user_accounts'/, '직원 명부를 안 봅니다.');
  assert.match(가리개, /dbGet\(\s*'companies'/, '업체관리 목록을 안 봅니다.');
});
