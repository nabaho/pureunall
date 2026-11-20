/* PC 메일 목록 — 읽은 메일과 안 읽은 메일이 «한눈에» 갈린다 (폰과 같은 차이)
   대표 지시 2026-11-18: 「PC도 같은 차에 나게 해라」 (폰은 tests/mail-phone-unread-mark.test.js)

   ① 무슨 일이었나 — PC 목록(.dm-row)은 안 읽은 줄이 «굵기 하나»로만 갈렸다.
   ② 고친 결 — 안 읽은 줄: 바탕 + 보낸이·제목 굵게 + 받은 시각 강조. 읽은 줄: 보낸이·제목 회색.
   ③ 함정 셋 — 이 검사가 지키는 것
      ㉠ PC 의 «왼쪽 띠»는 방향키로 짚은 줄(.cur) 표시다. 안 읽은 줄까지 띠를 쓰면 둘이 헷갈린다.
      ㉡ 안 읽은 바탕이 :hover·.pick·.cur 보다 «뒤»에 있으면, 같은 무게라 그 셋의 바탕을 덮는다.
      ㉢ .dm-row 는 다른 표(담당자 현황 등)도 쓴다. 읽은 줄을 :not(.unread) 로 걸면 그 표들이 통째로 회색이 된다.
   ⚠ 색 값은 박지 않는다 — «있는가·다른가·어느 순서인가»만 본다.
   실행: node --test tests/mail-pc-unread-mark.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { stripComments } = require('./strip-comments');

const raw = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8').replace(/\r\n/g, '\n');
const src = stripComments(raw);

/* 선택자 그대로의 규칙 덩어리(쉼표로 묶인 것 포함)를 모두 모아 온다 + 첫 자리 */
function 규칙(선택자) {
  const esc = 선택자.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('(?:^|[\\n,}])\\s*' + esc + '\\s*(?:,[^{]*)?\\{([^}]*)\\}', 'g');
  const out = [];
  let m, at = -1;
  while ((m = re.exec(src))) { if (at < 0) at = m.index; out.push(m[1].replace(/\s+/g, '')); }
  return { body: out.join(';'), at };
}

test('★ 안 읽은 줄에는 바탕 표시가 있고, 보낸이·제목은 굵다', () => {
  const r = 규칙('.dm-row.unread');
  assert.ok(r.at >= 0, '.dm-row.unread 규칙이 사라졌습니다 — PC 가 다시 굵기로만 갈립니다');
  assert.match(r.body, /background:/, '★ 안 읽은 줄의 바탕 표시가 없습니다');
  assert.match(규칙('.dm-row.unread .who').body, /font-weight:(700|bold)/, '안 읽은 보낸이가 굵지 않습니다');
  assert.match(규칙('.dm-row.unread .sub').body, /font-weight:(700|bold)/, '안 읽은 제목이 굵지 않습니다');
  const at = 규칙('.dm-row.unread .at').body;
  assert.match(at, /color:/, '안 읽은 줄의 받은 시각 강조(색)가 없습니다');
});

test('★ 읽은 줄은 보낸이·제목 색을 낮춘다 — 안 읽은 줄과 다른 색', () => {
  const 읽음 = /(?:^|;)color:([^;]+)/.exec(규칙('.dm-row.read .who').body);
  assert.ok(읽음, '★ 읽은 줄 보낸이의 색이 없습니다 — 읽은 줄과 안 읽은 줄이 같은 색입니다');
  assert.match(규칙('.dm-row.read .sub').body, /color:/, '읽은 줄 제목의 색이 없습니다');
  const 기본 = /(?:^|;)color:([^;]+)/.exec(규칙('.dm-row').body);
  assert.ok(기본, '.dm-row 기본 글자색을 못 찾았습니다');
  assert.notEqual(읽음[1].toLowerCase(), 기본[1].toLowerCase(),
    '★ 읽은 줄 글자색이 안 읽은 줄(기본)과 같습니다 — 색으로 안 갈립니다');
});

test('★ 안 읽은 바탕은 :hover·.pick·.cur «앞»에 있다 — 뒤에 두면 그 셋의 바탕을 덮는다', () => {
  const un = 규칙('.dm-row.unread').at;
  for (const s of ['.dm-row:hover', '.dm-row.pick', '.dm-row.cur']) {
    const o = 규칙(s).at;
    assert.ok(o >= 0, s + ' 규칙을 못 찾았습니다');
    assert.ok(un < o, '★ .dm-row.unread 가 ' + s + ' 보다 뒤에 있습니다 — 안 읽은 줄에서 그 표시의 바탕이 사라집니다');
  }
});

test('★ 안 읽은 줄은 왼쪽 띠(inset 그림자)를 안 쓴다 — 그 자리는 방향키로 짚은 줄(.cur)이다', () => {
  assert.match(규칙('.dm-row.cur').body, /box-shadow:inset/, '짚은 줄 띠가 사라졌습니다');
  for (const s of ['.dm-row.unread', '.dm-row.read']) {
    assert.doesNotMatch(규칙(s).body, /box-shadow/, '★ ' + s + ' 에 띠가 있습니다 — 짚은 줄과 헷갈립니다');
  }
});

test('★ 읽은 줄은 .read 로 건다 — :not(.unread) 는 다른 표의 .dm-row 까지 회색으로 만든다', () => {
  assert.doesNotMatch(src, /(?:^|[\n,}])\s*\.dm-row:not\(\.unread\)/,
    '★ .dm-row:not(.unread) 규칙이 있습니다 — 담당자 현황처럼 읽음 여부가 없는 표가 통째로 회색이 됩니다');
  /* 메일 목록 줄은 읽었으면 read, 아니면 unread 를 단다 */
  const at = raw.indexOf('<div class="dm-row ${Number(v.r||0)');
  assert.ok(at > 0, 'PC 메일 목록 줄을 그리는 자리를 못 찾았습니다');
  const tag = raw.slice(at, raw.indexOf('"', at + 12));
  assert.match(tag, /'read'/, '★ 읽은 줄에 read 표시가 안 붙습니다 — 읽은 줄 회색이 듣지 않습니다');
  assert.match(tag, /'unread'/, '안 읽은 줄에 unread 표시가 안 붙습니다');
});
