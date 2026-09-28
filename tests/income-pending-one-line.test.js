'use strict';
/* 입금관리 › 미입금 대기 표 — 한 칸은 «한 줄» (대표 지시 2026-09-28
   「입금관리에서 종류 관리번호 담당자 시작일 등이 두줄로 될 필요가 없다. 조정해서 한줄로 될 수
    있게 전체 좌우넓이 조정해달라」). CLAUDE.md 「표의 한 칸은 한 줄」 규칙의 이 표 몫이다.

   ■ 무엇이 있었나
     칸에 «한 줄» 표시가 없어 표가 좁아지면 「컨설팅」·「기술보호-2026-013」·「2026-09-18」·
     「권형하」 가 두 줄로 꺾였고, 담당자는 주·부를 «세로로» 쌓아 부담당이 있는 줄만 서너 줄이 됐다.
   ■ 못 박는 것(규칙 — 폭 숫자는 박지 않는다)
     ① 이 표의 몸 칸은 whiteSpace:nowrap 인 td1 을 쓴다(옛 tdS 를 그대로 쓰는 칸이 없다).
     ② 담당자 칸은 주·부를 옆으로 놓는다(flexDirection:column 이 없다).
     ③ 업체명은 길면 「…」 로 줄이고 title 에 전문을 둔다(한 줄을 지키려다 이름을 잃지 않게).
     ④ 머리글도 같은 여백(th1)을 쓴다 — 머리글만 넓으면 칸이 도로 벌어진다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { stripJs } = require('./strip-comments');

const RAW = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');
const BARE = stripJs(RAW);

function 표() {
  const a = BARE.indexOf("h('thead', { style:{position:'sticky',top:0,zIndex:2} }, h('tr', null,");
  const t = BARE.indexOf("'부가세포함 ↕'", a);
  assert.ok(a > 0 && t > a, '미입금 대기 표의 머리글을 못 찾았습니다');
  const end = BARE.indexOf('deletePendingItem(p)', t);
  assert.ok(end > t, '미입금 대기 표의 끝을 못 찾았습니다');
  const body = BARE.indexOf("h('tbody', null,", t);
  return { head: BARE.slice(a, body), body: BARE.slice(body, end) };
}

test('① ★★ td1 은 한 줄(nowrap)이고, 표의 몸 칸은 모두 td1 을 쓴다', () => {
  const m = BARE.match(/var td1 = Object\.assign\(\{\}, tdS, \{([^}]*)\}\)/);
  assert.ok(m, 'td1 이 없습니다');
  assert.match(m[1], /whiteSpace:'nowrap'/, '★★ td1 이 한 줄이 아닙니다 — 칸이 다시 두 줄로 꺾입니다');
  const { body } = 표();
  const 옛칸 = body.match(/h\('td', \{style:(?:tdS|Object\.assign\(\{\},tdS,)/g) || [];
  assert.equal(옛칸.length, 0, '★★ 한 줄 표시가 없는 칸(tdS)이 ' + 옛칸.length + '곳 남았습니다');
});

test('② ★ 담당자 칸은 주·부를 옆으로 놓는다', () => {
  const { body } = 표();
  const at = body.indexOf("'주'");
  assert.ok(at > 0, '담당자 칸을 못 찾았습니다');
  const 칸 = body.slice(body.lastIndexOf("h('td'", at), at);
  assert.doesNotMatch(칸, /flexDirection:'column'/, '★ 주·부를 세로로 쌓아 부담당이 있는 줄만 높아집니다');
});

test('③ ★ 업체명은 길면 「…」 로 줄이고 전문을 title 에 둔다', () => {
  const { body } = 표();
  const at = body.indexOf("coName || '-',");
  const 칸 = body.slice(body.lastIndexOf("h('td'", at), at);
  assert.match(칸, /textOverflow:'ellipsis'/, '업체명이 길면 표가 옆으로 밀립니다');
  assert.match(칸, /maxWidth:/, '줄일 폭이 없어 「…」 가 안 생깁니다');
  assert.match(칸, /title:\s*coName/, '★ 줄인 이름의 전문을 볼 길이 없습니다');
});

test('④ 머리글도 같은 여백(th1)을 쓴다', () => {
  const { head } = 표();
  assert.doesNotMatch(head, /Object\.assign\(\{\},thS,/, '머리글이 옛 여백을 써 칸이 도로 벌어집니다');
  assert.match(BARE, /var th1 = Object\.assign\(\{\}, thS, \{/, 'th1 이 없습니다');
});
