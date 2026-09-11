'use strict';
/* 「요금이 떨어졌다」는 «한도»가 아니다 — 기다려도 안 풀린다 (대표 제보 2026-09-11)
   실행: node --test tests/photos-read-fail-prepay.test.js

   ■ 무슨 일이 있었나
   사진첩 판독 실패 칸에 이 영어가 그대로 떴다:
     「Your prepayment credits are depleted. Please go to AI Studio at
      https://ai.studio/projects to manage your project and billing.」

   ★ 「한도(quota)」 규칙에 한 글자도 안 걸려 'other' 로 떨어졌다.
     other 는 worthRetry 가 «참»이라 **자동으로 계속 다시 걸었다**(실측 fails 2).
     충전하기 전에는 몇 번을 걸어도 같은 답이다.

   ★★ 한도와 «갈라야» 하는 까닭 — 한도는 기다리면 풀리고, 돈은 사람이 넣어야 풀린다.
     섞으면 「1분쯤 뒤 다시」라고 안내하게 되고, 그 말을 믿고 기다리면 영영 안 된다.
     2026-09-07 에 quota 를 other 에서 가른 것과 «똑같은» 까닭이다.

   ⚠ 아래 영어 글월은 «값 자체가 규칙»이다 — 구글이 보내는 말이 곧 갈래를 가르는
     기준이다(검사고정-허용). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn.js');

const R = path.join(__dirname, '..');
const APP = fs.readFileSync(path.join(R, 'pu-photos.html'), 'utf8');

/* 실제로 사진첩에 담겨 있던 글 그대로 (2026-09-11 실측) */
const 요금글 = 'Your prepayment credits are depleted. Please go to AI Studio at '
  + 'https://ai.studio/projects to manage your project and billing. '
  + 'Learn more at https://ai.google.dev/gemini-api/docs/billing#prepay. ';
/* 갈라야 할 짝 — 이쪽은 «기다리면» 풀린다 */
const 한도글 = 'You exceeded your current quota, please check your plan and billing details. '
  + 'Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests';
const 하루 = 24 * 3600 * 1000;

function 상자() {
  const ctx = { console, Object, String, Number, Array, Boolean, Date, Math };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext([
    APP.match(/^const FAIL_GIVEUP = \d+;/m)[0].replace('const ', 'var '),
    APP.match(/^const READ_FAIL_RULES = \[[\s\S]*?^\];/m)[0].replace('const ', 'var '),
    cutFn(APP, 'function readFailKind('),
    cutFn(APP, 'function ymdKST('),
    cutFn(APP, 'function worthRetry('),
    cutFn(APP, 'function readFailAdvice(')
  ].join('\n'), ctx);
  return ctx;
}
const 부르기 = function (식, 값) {
  const ctx = 상자();
  ctx.__r = 값;
  return vm.runInContext(식, ctx);
};
const 갈래 = (r) => 부르기('readFailKind(__r)', r);
const 다시걸까 = (r) => 부르기('worthRetry(__r)', r);
const 안내 = (r) => 부르기('readFailAdvice(__r)', r);

/* ══════ ① 갈래를 가른다 ═════════════════════════════════════════════════ */

test('★★★ 「요금이 떨어졌다」를 «따로» 가린다 — 안 가르면 other 가 되어 자동으로 되풀이한다', () => {
  assert.equal(갈래({ error: 요금글 }), 'bill',
    '★★★ 이 글을 못 가립니다. other 로 떨어지면 worthRetry 가 참이라\n' +
    '  충전하기 전까지 몇 번이고 자동으로 다시 겁니다(실측 fails 2).');
});

test('★★ 한도와 «섞지» 않는다 — 하나는 기다리면 풀리고 하나는 사람이 넣어야 풀린다', () => {
  assert.equal(갈래({ error: 한도글 }), 'quota',
    '★ 한도 글이 요금 갈래로 넘어갔습니다 — 자정이면 풀릴 것을 「충전하라」고 합니다');
  assert.notEqual(갈래({ error: 요금글 }), 'quota',
    '★★ 요금 떨어진 것을 한도로 읽으면 「1분쯤 뒤 다시」라고 안내하게 됩니다 —\n' +
    '  그 말을 믿고 기다리면 영영 안 됩니다.');
});

test('구글이 보내는 말 어느 쪽이 와도 가린다 (짧은 판·주소만 있는 판)', () => {
  ['Your prepayment credits are depleted.',
   'credits are depleted, please top up',
   'see https://ai.google.dev/gemini-api/docs/billing#prepay',
   'go to AI Studio at https://ai.studio/projects'].forEach(function (s) {
    assert.equal(갈래({ error: s }), 'bill', '★ 못 가린 글: ' + s);
  });
});

/* ══════ ② 자동으로 다시 걸지 않는다 ═════════════════════════════════════ */

test('★★★ 요금이 떨어진 것은 «자동으로 다시 걸지 않는다» — 눌러도 같은 답이다', () => {
  assert.equal(다시걸까({ error: 요금글, at: Date.now() }), false,
    '★★★ 자동으로 다시 겁니다 — 충전 전에는 몇 번이고 같은 답입니다.');
});

test('★★ 날이 바뀌어도 안 건다 — 한도와 «다른» 점이 바로 이것이다', () => {
  const 어제 = Date.now() - 2 * 하루;
  assert.equal(다시걸까({ error: 한도글, at: 어제, failAt: 어제 }), true,
    '한도는 자정에 되살아나므로 다음 날 한 번은 걸어야 한다');
  assert.equal(다시걸까({ error: 요금글, at: 어제, failAt: 어제 }), false,
    '★★ 돈은 날이 바뀐다고 들어오지 않습니다 — 사람이 충전해야 합니다.');
});

/* ══════ ③ 무엇을 해야 하는지 «한글»로 적는다 ═══════════════════════════ */

test('★★ 안내에 «할 일»과 «할 사람»이 있다 — 영어를 그대로 쏟지 않는다', () => {
  const s = 안내({ error: 요금글, fails: 1 });
  assert.match(s, /충전/, '★ 무엇을 해야 하는지가 없습니다');
  assert.match(s, /대표/, '★ 누가 해야 하는지가 없습니다 — 직원은 충전할 수 없습니다');
  assert.doesNotMatch(s, /prepayment|credits|http/i,
    '★★ 영어 원문을 딱지에 그대로 쏟고 있습니다 — 읽는 사람이 할 일을 모릅니다');
  assert.doesNotMatch(s, /1분|기다/,
    '★★ 「기다리면 된다」고 말하고 있습니다 — 기다려도 안 풀립니다');
});

test('★ 몇 번 실패했든 안내가 같다 — 열 번 걸려도 할 일은 «충전» 하나다', () => {
  const 한번 = 안내({ error: 요금글, fails: 1 });
  const 다섯번 = 안내({ error: 요금글, fails: 5 });
  assert.equal(한번, 다섯번,
    '★ 「N번 실패 — 손으로 적어 주세요」가 가로챘습니다.\n' +
    '  손으로 적는 것은 답이 아닙니다 — 충전하면 그대로 읽힙니다.');
  assert.match(다섯번, /충전/);
});

test('다른 갈래의 안내는 그대로다 — 이 고침이 남의 말을 안 바꾼다', () => {
  assert.match(안내({ error: 한도글, fails: 1 }), /한도/);
  assert.match(안내({ error: '로그인이 필요합니다', fails: 1 }), /로그인/);
  assert.match(안내({ error: '잠시 바쁩니다', fails: 1 }), /다시 판독|바쁩/);
});
