/* 법 개정 감시의 거짓 경보 — «안내문»이 빠진 것을 «개정»으로 읽지 않는다 (2026-10-03)

   ■ 무엇이 있었나
   2026-10-01 새벽 감시가 「근로기준법 제55조(휴일) 개정 · 2026-10-02 시행」을 사건으로 적었다.
   그런데 앞뒤 본문을 견주면 **한 글자도 안 바뀌었다.** 바뀐 것은 원문 끝에 붙어 있던
     [시행일] 제55조제2항의 개정규정은 다음 각 호의 구분에 따른 날부터 시행한다.
     1\. 상시 300명 이상 … 2020년 1월 1일 …
   이라는 «단계 시행 안내»가 법령 자료에서 빠진 것뿐이다(2022년에 이미 다 끝난 단계다).
   감시가 이 안내까지 글자로 견주어 「개정」으로 읽었다.
   그대로 두면 완료 회차가 있는 사업장이 **모두** 「다시 볼 곳」으로 뜬다 —
   노무사가 공휴일 조문을 사업장마다 다시 열어 볼 일이 «없는 개정» 때문에 생긴다.

   ■ 지키는 규칙
     ① 견줄 때는 «본문만» — 날짜 꼬리표(<개정 2018.3.20>)와 [시행일]·[본조신설] 같은 안내를 뗀다
     ② 진짜 개정은 그대로 잡는다 — 「최초 2일」→「최초 4일」 한 글자도 놓치지 않는다
     ③ 잣대는 «하나» — 서버(새 사건을 안 만든다)와 화면(이미 적힌 사건을 거른다)이 같은 함수를 쓴다
     ④ 모르는 것은 숨기지 않는다 — 앞 글자를 모르는 사건·신설·삭제·글자 상한에 걸려 잘린 글은 안 거른다
   실행: node --test tests/rules-lawwatch-noise.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const S = require('../functions/rules-lawwatch');
const C = require('../js/pu-rules-lawwatch');

/* 실제 원문 (법령은 공개 자료다) — 2026-10-01 사건 그대로 */
const 전55 = '① 사용자는 근로자에게 1주에 평균 1회 이상의 유급휴일을 보장하여야 한다. <개정 2018.3.20>\n'
  + '② 사용자는 근로자에게 대통령령으로 정하는 휴일을 유급으로 보장하여야 한다. 다만, 근로자대표와 서면으로 합의한 경우 특정한 근로일로 대체할 수 있다. <신설 2018.3.20>\n'
  + '[시행일] 제55조제2항의 개정규정은 다음 각 호의 구분에 따른 날부터 시행한다.\n'
  + '1\\. 상시 300명 이상의 근로자를 사용하는 사업 또는 사업장: 2020년 1월 1일\n'
  + '2\\. 상시 30명 이상 300명 미만의 근로자를 사용하는 사업 또는 사업장: 2021년 1월 1일\n'
  + '3\\. 상시 5인 이상 30명 미만의 근로자를 사용하는 사업 또는 사업장: 2022년 1월 1일';
const 후55 = '① 사용자는 근로자에게 1주에 평균 1회 이상의 유급휴일을 보장하여야 한다. <개정 2018.3.20>\n'
  + '② 사용자는 근로자에게 대통령령으로 정하는 휴일을 유급으로 보장하여야 한다. 다만, 근로자대표와 서면으로 합의한 경우 특정한 근로일로 대체할 수 있다. <신설 2018.3.20>';
const 전난임 = '① 사업주는 … 연간 6일 이내의 휴가를 주어야 하며, 이 경우 최초 2일은 유급으로 한다. <개정 2024.10.22>';
const 후난임 = '① 사업주는 … 연간 6일 이내의 휴가를 주어야 하며, 이 경우 최초 4일은 유급으로 한다. <개정 2024.10.22, 2026.5.26>';

function 판(arts) { return { no: '1', promulgated: '2026-08-04', effective: '2026-10-02', addenda: [], arts: arts }; }

/* ══════ ① 본문만 견준다 ══════ */

test('★★★ 「[시행일]」 안내가 빠진 것은 개정이 아니다 — 2026-10-01 제55조 거짓 경보', () => {
  assert.equal(S.lawBody(전55), S.lawBody(후55),
    '★★★ 안내문이 빠진 것을 개정으로 읽습니다 — 사업장이 모두 「다시 볼 곳」으로 뜹니다');
  const d = S.diffWatched(판({ 55: { title: '휴일', text: 전55 } }), 판({ 55: { title: '휴일', text: 후55 } }), ['55']);
  assert.deepEqual(Object.keys(d.arts), [], '★★★ 서버가 제55조를 사건으로 적습니다');
});

test('날짜 꼬리표만 붙거나 빠진 것도 개정이 아니다', () => {
  assert.equal(S.lawBody('② 휴게시간은 자유롭게 이용할 수 있다.'),
    S.lawBody('② 휴게시간은 자유롭게 이용할 수 있다. <개정 2012.2.1, 2017.11.28>'));
  assert.equal(S.lawBody('제5조 삭제 <2020.1.1>'), S.lawBody('제5조 삭제'));
  assert.equal(S.lawBody('① 가나다.\n[본조신설 2012.2.1]'), S.lawBody('① 가나다.'));
});

test('★★★ 진짜 개정은 그대로 잡는다 — 「최초 2일」→「최초 4일」', () => {
  assert.notEqual(S.lawBody(전난임), S.lawBody(후난임), '★★★ 진짜 개정을 놓칩니다');
  const d = S.diffWatched(판({ '18의3': { title: '난임치료휴가', text: 전난임 } }),
    판({ '18의3': { title: '난임치료휴가', text: 후난임 } }), ['18의3']);
  assert.deepEqual(Object.keys(d.arts), ['18의3']);
  assert.equal(d.arts['18의3'].before, 전난임, '사건에는 «원문 그대로» 적는다 — 뗀 글을 적지 않는다');
});

test('★★ 안내가 빠지면서 본문도 바뀌면 — 개정이다', () => {
  const 후 = 후55.replace('1주에 평균 1회', '1주에 평균 2회');
  assert.notEqual(S.lawBody(전55), S.lawBody(후));
});

test('★★ 안내 «뒤»에 오는 항은 떼지 않는다 — 안내만 뗀다', () => {
  /* [시행일] 뒤를 통째로 자르면, 그 뒤에 이어진 항이 바뀌어도 못 본다. */
  const 앞 = '① 가.\n[시행일] 제1항은 2020년 1월 1일부터 시행한다.\n② 나는 다라고 한다.';
  const 뒤 = '① 가.\n[시행일] 제1항은 2020년 1월 1일부터 시행한다.\n② 나는 마라고 한다.';
  assert.notEqual(S.lawBody(앞), S.lawBody(뒤), '★★ 안내 뒤의 항을 함께 지웠습니다');
});

test('다른 조 셈(otherChanged)도 같은 잣대 — 안내만 빠진 조는 안 센다', () => {
  const d = S.diffWatched(판({ 55: { title: '휴일', text: 전55 }, 1: { title: '목적', text: '가.' } }),
    판({ 55: { title: '휴일', text: 후55 }, 1: { title: '목적', text: '가.' } }), ['1']);
  assert.equal(d.otherChanged, 0, '안내만 빠진 조를 «바뀐 조»로 셉니다');
});

test('빈 값에 안 터진다', () => {
  [undefined, null, '', 0].forEach(v => assert.equal(typeof S.lawBody(v), 'string'));
});

/* ══════ ② 화면 — 이미 적힌 거짓 사건을 거른다 ══════ */

function 사건(arts) { return { id: 'x', lawKey: '근로기준법', effective: '2026-10-02', arts: arts }; }

test('★★★ 화면이 이미 적힌 거짓 사건을 거른다 — 서버를 다시 올려도 DB 의 옛 사건은 남는다', () => {
  const ev = 사건({ 55: { art: '55', title: '휴일', kind: '개정', before: 전55, after: 후55, effective: '2026-10-02' } });
  assert.deepEqual(C.artsOf(ev), [], '★★★ 화면이 안내문만 빠진 조를 「바뀐 조」로 보입니다');
  assert.deepEqual(C.sortEvents({ x: ev }), [], '★★★ 바뀐 조가 하나도 없는 사건이 목록에 뜹니다');
});

test('★★ 진짜 바뀐 조와 섞여 있으면 거짓 조만 빠진다', () => {
  const ev = 사건({
    55: { art: '55', title: '휴일', kind: '개정', before: 전55, after: 후55, effective: '2026-10-02' },
    '18의3': { art: '18의3', title: '난임치료휴가', kind: '개정', before: 전난임, after: 후난임, effective: '2026-11-27' } });
  assert.deepEqual(C.artsOf(ev).map(a => a.art), ['18의3']);
  assert.equal(C.sortEvents({ x: ev }).length, 1);
});

test('★★ 모르는 것은 숨기지 않는다 — 앞 글 모름 · 신설 · 삭제 · 잘린 글', () => {
  const 잘림 = 'ㄱ'.repeat(4000);
  [
    { art: '1', kind: '개정', before: '', after: 후55, beforeUnknown: true },
    { art: '2', kind: '신설', before: '', after: '① 새 조.' },
    { art: '3', kind: '삭제', before: '① 옛 조.', after: '' },
    { art: '4', kind: '개정', before: 잘림, after: 잘림 }       // 4000자에서 잘려 같아 보일 뿐일 수 있다
  ].forEach(a => {
    assert.equal(C.artsOf(사건({ [a.art]: a })).length, 1, '숨기면 안 되는 조를 숨겼습니다: ' + a.kind + (a.beforeUnknown ? '(앞 글 모름)' : ''));
  });
});

/* ══════ ③ 잣대는 하나 ══════ */

test('★★★ 서버와 화면의 lawBody 가 «같은 함수»다 — 둘이 갈리면 서버가 안 적은 것을 화면이 띄운다', () => {
  assert.equal(typeof C.lawBody, 'function', '화면 쪽에 lawBody 가 없습니다');
  const 몸 = (f) => String(f).replace(/\s+/g, '');
  assert.equal(몸(C.lawBody), 몸(S.lawBody),
    '★★★ 서버와 화면의 lawBody 가 다릅니다 — functions/ 는 따로 올라가 js/ 를 못 불러 «두 벌»이다. 한쪽을 고치면 다른 쪽도 고친다');
  [전55, 후55, 전난임, 후난임, '', '제5조 삭제 <2020.1.1>'].forEach(t => assert.equal(C.lawBody(t), S.lawBody(t)));
});
