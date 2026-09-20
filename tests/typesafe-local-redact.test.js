'use strict';
/* TypeSafe(Jev) 검토 — «우리가 아는» 이름·업체명 가리기 (2026-09-20 대표 결정)

   대표: 「이름 업체명 등 없이 판단해야하는데 어떻게 해야하나 보안에 대한 부분」
   → 「우리 목록만 (추천)」을 고름.

   ■ 왜 서버가 아니라 화면(pu-erp.html)에서 하나
   서버(functions/typesafe-evaluate.js)는 번호(주민번호·전화·계좌 등)만 가린다 —
   그건 모양이 정해져 있어 기계가 확실히 찾을 수 있어서다. 이름·회사 이름은 그런
   모양이 없다. 대신 «우리가 이미 아는» 직원 명부·업체관리 이름은 확실히 가릴 수
   있는데, 그걸 서버에서 하려면 명부 전체를 서버로 넘겨야 한다 — 가리려던 명부
   자체가 새는 셈이라 화면에서 끝낸다(window.PU_TYPESAFE_LOCAL_REDACT).

   ■ 여기서 보는 것
   실제로 함수를 돌려 «값»을 확인한다(다른 typesafe 검사들처럼 구조만 보지 않는다) —
   가리기는 값이 틀리면 곧바로 새는 정보이므로 규칙만으로는 부족하다.
   ⚠ 그래도 «완벽히 가린다»를 검사하지 않는다 — 목록에 없는 이름은 원래 못 잡는다.
     여기서는 «목록에 있는 것은 확실히 잡히는가»만 본다. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { cutFn } = require('./cut-fn');

const ROOT = path.join(__dirname, '..');
const RAW = fs.readFileSync(path.join(ROOT, 'pu-erp.html'), 'utf8');

/* dbGet·USERS_SEED 를 가짜로 채운 창에 실제 함수를 올려 돌린다.
   ⚠ 흉내 내지 않는다 — 진짜 pu-erp.html 안의 함수 그대로를 잘라 쓴다. */
function load(users, companies) {
  const ctx = {
    console, String, Number, Math, Array, Object, JSON,
    window: {},
    USERS_SEED: users || [],
    dbGet: function (store, fallback) {
      if (store === 'user_accounts') return users || fallback;
      if (store === 'companies') return companies || fallback;
      return fallback;
    }
  };
  vm.createContext(ctx);
  /* cutFn 은 함수 «그 자체»만 자른다 — 바로 뒤의 window.PU_TYPESAFE_LOCAL_REDACT = ...
     한 줄은 안 딸려 온다. 전역에 거는 것까지 진짜 코드 그대로 확인하려고 붙여 돈다. */
  vm.runInContext(
    cutFn(RAW, 'function typeSafeLocalRedact(') + '\n' +
    'window.PU_TYPESAFE_LOCAL_REDACT = typeSafeLocalRedact;',
    ctx);
  return ctx;
}

const 직원들 = [{ name: '홍길동', sid: 'X-001' }, { name: '가나다', sid: 'X-002' }];
const 업체들 = [{ name: '가나상사', id: 'co-1' }, { name: '가나', id: 'co-2' }];

test('목록에 있는 직원 이름은 확실히 가려진다', () => {
  const ctx = load(직원들, []);
  const got = ctx.typeSafeLocalRedact('홍길동 님이 계약 마감을 물었습니다.');
  assert.doesNotMatch(got.text, /홍길동/);
  assert.match(got.text, /\[직원1\]/);
});

test('목록에 있는 업체 이름도 가려진다', () => {
  const ctx = load([], 업체들.slice(0, 1));
  const got = ctx.typeSafeLocalRedact('가나상사와 계약이 곧 끝납니다.');
  assert.doesNotMatch(got.text, /가나상사/);
  assert.match(got.text, /\[업체1\]/);
});

test('같은 이름은 같은 표(placeholder)로 — 문맥이 유지된다', () => {
  const ctx = load(직원들, []);
  const got = ctx.typeSafeLocalRedact('홍길동이 물었는데 홍길동에게 아직 답장을 못 했습니다.');
  const 개수 = (got.text.match(/\[직원1\]/g) || []).length;
  assert.equal(개수, 2, '같은 사람인데 다른 번호로 갈라지면 Jev 가 두 사람으로 착각합니다.');
  assert.doesNotMatch(got.text, /\[직원2\]/, '한 사람만 나왔는데 두 번째 번호가 생겼습니다.');
});

test('긴 이름부터 바꾼다 — 짧은 이름이 긴 이름(업체명)을 먼저 망가뜨리지 않는다', () => {
  /* 「가나」(2자)가 «가나상사»(4자) 안에 들어 있다. 짧은 것을 먼저 바꾸면
     "가나상사"가 "[업체1]상사"처럼 반쪽만 가려진 채 남는다 — 회사 이름의 나머지
     절반이 그대로 새어 나간다.
     ⚠ 목록(원본 배열)에는 «짧은 것을 먼저» 넣는다 — 함수가 «정렬해서» 도는지를
       보려는 검사인데, 목록 순서가 이미 긴 것부터라면 정렬을 지워도 우연히
       통과해 버린다(실제로 그렇게 통과하는 구멍이 있었다: 이빨 확인 참고). */
  const 순서뒤섞인목록 = [{ name: '가나' }, { name: '가나상사' }];
  const ctx = load([], 순서뒤섞인목록);
  const got = ctx.typeSafeLocalRedact('가나상사 소속 가나 대리점 문의입니다.');
  assert.doesNotMatch(got.text, /가나상사/, '업체명 전체가 안 가려졌습니다.');
  /* ⚠ \b(단어 경계)는 한글 앞뒤에서 못 믿는다 — 자바스크립트 정규식의 \w 는
     한글을 «단어 글자»로 안 쳐서, "]상사" 같은 자리에도 경계를 못 잡을 수 있다.
     그래서 손상되는 «정확한 모양»(닫는 괄호 바로 뒤에 «상사»가 붙어 나오는 것)을
     직접 짚는다. */
  assert.doesNotMatch(got.text, /\]상사/, '짧은 이름을 먼저 바꿔 «상사» 글자가 반쪽으로 남았습니다.');
});

test('두 사람·두 업체가 섞이면 번호가 갈라진다', () => {
  const ctx = load(직원들, 업체들.slice(0, 1));
  const got = ctx.typeSafeLocalRedact('홍길동과 가나다가 가나상사 건으로 통화했습니다.');
  assert.match(got.text, /\[직원1\]/);
  assert.match(got.text, /\[직원2\]/);
  assert.match(got.text, /\[업체1\]/);
});

test('가린 항목 표는 몇 건 가렸는지 사람 말로 알려 준다', () => {
  const ctx = load(직원들, 업체들.slice(0, 1));
  const got = ctx.typeSafeLocalRedact('홍길동과 가나다가 가나상사 건으로 통화했습니다.');
  assert.ok(got.localMaskedKinds.some((k) => /직원 이름 2건/.test(k)));
  assert.ok(got.localMaskedKinds.some((k) => /업체명 1건/.test(k)));
});

test('목록에 없으면 그대로 둔다 — «목록에 있는 것만» 가린다는 뜻을 지킨다', () => {
  const ctx = load(직원들, 업체들);
  const got = ctx.typeSafeLocalRedact('외부인 김철수 씨가 문의했습니다.');
  assert.match(got.text, /김철수/, '이 검사는 «목록에 없으면 못 잡는다»는 한계를 확인하는 것이지, 못 잡아야 정상입니다.');
  /* ⚠ vm 상자 안에서 만든 배열은 밖에서 만든 []과 겉보기는 같아도 실현계(realm)가
     달라 deepEqual 이 튕긴다 — 길이로 본다(tests-must-have-teeth 메모 참고). */
  assert.equal(got.localMaskedKinds.length, 0);
});

test('명부·업체 목록이 비어 있어도 죽지 않는다', () => {
  const ctx = load([], []);
  assert.doesNotThrow(() => ctx.typeSafeLocalRedact('아무 문의나 넣어 봅니다.'));
});

test('dbGet 이 죽어도(예외) 판단 자체를 막지 않는다 — 원문 그대로 돌려준다', () => {
  const ctx = load(직원들, []);
  ctx.dbGet = function () { throw new Error('일부러 죽인다'); };
  const 원문 = '홍길동 관련 문의입니다.';
  const got = ctx.typeSafeLocalRedact(원문);
  assert.equal(got.text, 원문, '명부를 못 읽으면 가리기만 건너뛰어야지, 검토 자체가 죽으면 안 됩니다.');
});

test('한 글자짜리 이름은 후보에서 뺀다 — 아무 문장에나 나오는 흔한 글자를 지우면 안 된다', () => {
  const ctx = load([{ name: '이' }], []);   // 있을 수 없는 값이지만 방어선을 본다
  const got = ctx.typeSafeLocalRedact('이 문의는 이번 주 안에 처리해야 합니다.');
  assert.match(got.text, /^이 문의는 이번/, '한 글자 이름까지 후보로 삼으면 문장 전체가 망가집니다.');
});

test('전역 이름(window.PU_TYPESAFE_LOCAL_REDACT)에 스스로를 건다', () => {
  const ctx = load(직원들, []);
  assert.equal(typeof ctx.window.PU_TYPESAFE_LOCAL_REDACT, 'function',
    '전역에 안 걸리면 js/pu-typesafe.js 가 이 함수를 찾을 수 없습니다.');
});
