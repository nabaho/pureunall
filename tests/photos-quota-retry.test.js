'use strict';
/* 한도로 못 읽은 사진이 «갇히지» 않는다 · 손으로 옮기면 옛 실패가 남지 않는다
   실행: node --test tests/photos-quota-retry.test.js
   대표 지적 2026-09-10 「여전히 사진이 서류로 된 곳이 있다」
                        「마우스로 드레그 서류 옴김 안되는게」

   ★★ 짐작하지 말 것 — 이 두 고침은 **실측으로** 찾았다.
     2026년 사진 695장을 재 보니 서류 칸에 남아 있던 현장 사진의 정체는
     「서류로 보이지 않음」이 아니라 **판독 실패 27장(전부 한도 초과)** 이었다.
     그 앞의 두 짐작(①안 읽은 것 ②other+값없음)은 이 자료에 한 장도 없었다.
     화면 캡처만 보고 고치면 «있지도 않은 것»을 고치게 된다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn.js');
const { stripComments } = require('./strip-comments.js');

const R = path.join(__dirname, '..');
const APP = fs.readFileSync(path.join(R, 'pu-photos.html'), 'utf8');

/* 구글이 «단정해» 보내는 한도 초과 글 — 실제로 사진첩에 담겨 있던 것이다
   (검사고정-허용: 이 글자가 곧 갈래를 가르는 기준이다). */
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
    APP.match(/^const LANE_PIC_KINDS = \{[^}]*\};/m)[0].replace('const ', 'var '),
    cutFn(APP, 'function readFailKind('),
    cutFn(APP, 'function ymdKST('),
    cutFn(APP, 'function worthRetry('),
    cutFn(APP, 'function readAnyField('),
    cutFn(APP, 'function laneOf(')
  ].join('\n'), ctx);
  return ctx;
}
function 건다(read) {
  const ctx = 상자();
  ctx.__r = read;
  return vm.runInContext('worthRetry(__r)', ctx);
}
function 갈래(meta) {
  const ctx = 상자();
  ctx.__it = { id: 'p1', meta: meta };
  return vm.runInContext('laneOf(__it)', ctx);
}

/* ══════ ① 한도 초과는 «날이 바뀌면» 다시 걸 값이 있다 ═══════════════════════ */

test('★★★ 어제 한도로 못 읽은 것은 «다시 걸 값이 있다» — 하루 몫은 자정에 되살아난다', () => {
  assert.equal(건다({ error: 한도글, at: Date.now() - 3 * 하루 }), true,
    '★★★ 사흘 전 한도로 못 읽은 사진이 영영 갇힙니다 — 「안 읽은 서류」에도 안 뜨고 '
    + '「서류」 딱지를 단 채 서류 칸에 남습니다(2026-09-07 에 27장이 그렇게 됐습니다)');
});

test('★★ 오늘 한도로 못 읽은 것은 «안» 건다 — 걸 때마다 한도를 더 먹고 답은 같다', () => {
  assert.equal(건다({ error: 한도글, at: Date.now() }), false,
    '★★ 같은 날 다시 겁니다 — 헛수고를 자동으로 되풀이하며 한도를 더 먹습니다');
});

test('★ 언제 실패했는지 모르면 «안» 건다 — 모르면 안 거는 쪽이 이 규칙의 원래 뜻이다', () => {
  assert.equal(건다({ error: 한도글 }), false,
    '★ 시각이 없는데 겁니다 — 옛 기록 전부가 한꺼번에 대기열에 들어갑니다');
  /* ⚠ 위 한 줄만으로는 «막이가 정말 있는지» 못 잰다 — 시각이 없으면 ymdKST 가
       오늘로 답해서 견주기가 어차피 거짓이 된다(되돌림에서 드러났다).
     ★ 0 은 «있지만 뜻이 없는» 시각이다. 막이가 없으면 1970년으로 읽혀 «걸어야 한다»가
       되고, 시각이 망가진 옛 기록이 통째로 대기열에 들어간다. */
  assert.equal(건다({ error: 한도글, at: 0 }), false,
    '★ 시각이 0 인 기록을 1970년으로 읽고 겁니다 — 망가진 옛 기록이 통째로 걸립니다');
});

test('여러 번 실패한 것은 날이 바뀌어도 «손으로» — 눌러도 같은 답이다', () => {
  assert.equal(건다({ error: 한도글, at: Date.now() - 3 * 하루, fails: 3 }), false,
    '★ 세 번 넘게 실패한 것까지 자동으로 겁니다');
});

test('「잠시 바쁨」은 날과 상관없이 그대로 건다 — 그쪽은 조금 뒤면 된다', () => {
  assert.equal(건다({ error: '판독기가 잠시 바쁩니다', at: Date.now() }), true);
});

test('★ 한도 판정은 «구글이 단정한 말»로만 한다 — 우리 짐작 문구로 넓히지 않는다', () => {
  const ctx = 상자();
  ctx.__r = { error: 한도글 };
  assert.equal(vm.runInContext('readFailKind(__r)', ctx), 'quota');
  /* 우리가 만든 한글 안내문은 「짐작」이라 busy 가 맡는다 — 그것까지 quota 로 보면
     날이 바뀔 때까지 안 걸어 잠시 바쁜 것이 하루를 기다린다. */
  ctx.__r2 = { error: 'AI 키의 하루 사용량을 다 썼을 수 있습니다' };
  assert.notEqual(vm.runInContext('readFailKind(__r2)', ctx), 'quota',
    '★ 우리 짐작 문구까지 한도로 봅니다 — 잠시 바쁜 것이 하루를 기다리게 됩니다');
});

/* ══════ ② 날을 «한국 시각»으로 가른다 ══════════════════════════════════════ */

test('★ 날은 한국 날짜로 가른다 — 서버 셈(ymdKST)과 같은 날을 봐야 한다', () => {
  const ctx = 상자();
  /* 한국으로 9월 9일 새벽 5시인 순간(UTC 로는 아직 9월 8일 20시) */
  assert.equal(vm.runInContext('ymdKST(' + Date.parse('2026-09-08T20:00:00Z') + ')', ctx), '2026-09-09',
    '★ UTC 로 가릅니다 — 자정 언저리에 하루 몫이 언제 되살아나는지가 어긋납니다');
});

test('셈을 읽는 곳도 «같은» 함수를 쓴다 — 두 벌로 두면 한쪽만 고쳐진다', () => {
  assert.match(stripComments(cutFn(APP, 'function loadReadTally(')), /ymdKST\(\)/,
    '★ 날짜 만드는 식을 또 적었습니다 — 한 곳만 고쳐지면 셈과 되걸기가 서로 다른 날을 봅니다');
});

/* ══════ ③ 손으로 옮기면 옛 «실패»가 남지 않는다 ═════════════════════════════ */

test('★★★ 분류를 손으로 정하면 옛 error 를 지운다 — 안 지우면 끌어다 놓아도 제자리다', () => {
  const fn = stripComments(cutFn(APP, 'function retagPhotos('));
  assert.match(fn, /error:\s*null/,
    '★★★ 옛 실패가 그대로 남습니다 — Object.assign 이 앞 것의 칸을 물려받아, '
    + '판독이 실패했던 사진은 사람이 분류를 정해도 갈래가 안 바뀝니다(끌어놓기가 헛돕니다)');
  /* 순서도 뜻이다 — 앞 기록(it.meta.read)을 편 «뒤»에 지워야 덮인다.
     ⚠ 「Object.assign 보다 뒤인가」로는 모자랐다 — 첫 자리에 옮겨 놓아도 그 견주기는
       참이라 되돌림이 살아남았다(2026-09-10). 앞 기록 «자체»와 견준다. */
  assert.ok(fn.indexOf('it.meta.read') < fn.indexOf('error: null'),
    '★ error 를 앞 기록보다 먼저 적습니다 — 옛 실패가 덮여 되살아납니다');
});

test('★★★ 실패했던 사진을 사진 칸으로 옮기면 «사진 갈래»가 된다 (끌어놓기가 실제로 듣는다)', () => {
  /* retagPhotos 가 만드는 모양 그대로 재 본다 */
  assert.equal(갈래({ kind: 'doc', read: { kind: 'meeting', error: null, ack: true, fields: {} } }), 'pic',
    '★★★ 사진 칸에 놓아도 서류로 남습니다 — 대표 지적 「드레그 서류 옴김 안되는게」 그대로입니다');
  /* 안 지웠을 때 어떻게 되는지도 함께 못박는다 — 이것이 무엇을 고친 것인지의 증거다 */
  assert.equal(갈래({ kind: 'doc', read: { kind: 'meeting', error: '한도', ack: true, fields: {} } }), 'doc',
    '이 줄이 깨지면 laneOf 가 실패를 무시하게 된 것입니다 — 못 읽은 서류가 사진 칸에 숨습니다');
});

test('★ 서류 칸으로 옮긴 것도 마찬가지다 — 양쪽이 같은 규칙이어야 한다', () => {
  assert.equal(갈래({ kind: 'doc', read: { kind: 'other', error: null, ack: true, fields: {} } }), 'doc',
    '★ 서류 칸에 놓은 것이 사진으로 되돌아갑니다');
});

/* ══════ ④ 실패는 여전히 «서류» 쪽이다 (③㉮ — 모르면 서류) ═══════════════════ */

test('★★ 사람이 손대지 «않은» 판독 실패는 서류 갈래로 남는다 — 사진 칸에 숨으면 안 읽힌다', () => {
  assert.equal(갈래({ kind: 'doc', read: { kind: 'meeting', error: 한도글, fields: {} } }), 'doc',
    '★★ 못 읽은 사진이 사진 칸에 숨었습니다 — 아무도 다시 읽히지 않습니다');
});
