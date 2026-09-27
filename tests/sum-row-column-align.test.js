'use strict';
/* 합계 줄과 돈 열이 «같은 자리»에 선다 (대표 지시 2026-09-13 「금액 합계 라인 열 일치 시켜 달라」)

   ■ 무엇이 있었나
     돈 칸에는 오른쪽 정렬(.ar 또는 textAlign:'right')이 걸려 있다. 그런데 칸 «안»이
     display:flex 였다. flex 항목은 text-align 이 아니라 justify-content 를 따르고
     그 기본값은 왼쪽이다 — 그래서 정렬이 «조용히» 무시됐다.
     합계 줄은 평범한 글자라 오른끝에 서고, 데이터는 왼쪽에 붙어 열이 어긋났다.

   ■ ★★ 실측 (2026-09-13 · 실제 CSS 를 그대로 옮긴 판에서 잰 값)
     | | 지금 | row-reverse 뒤 |
     |---|---:|---:|
     | 계약금 열 어긋남 | 80.4px | 0.0px |
     | 잔금 열 어긋남   | 24.0px | 0.0px |
     | 같은 열 안 줄끼리 | 7.0px 제각각 | 0.0px |

   ■ 왜 justify-content:flex-end 가 아니라 row-reverse 인가
     flex-end 로 하면 «곁들이»(✓입금일·일부입금 메모·복원 단추)가 오른끝을 차지하고
     금액이 그 왼쪽으로 밀린다. 줄마다 곁들이 유무가 달라 다시 들쭉날쭉해진다.
     오른끝에 서야 하는 것은 «금액»이다. row-reverse 는 첫 자식(금액)을 오른끝에 세운다.

   ■ 이 검사가 지키는 것
     ① 합계 줄이 있는 돈 칸은, 안이 flex 면 «오른끝»으로 세운다
     ② 합계 숫자에도 「원」이 붙는다 (안 붙으면 자릿수가 원 글자만큼 어긋나 보인다) */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { test } = require('node:test');
const { stripComments } = require('./strip-comments');

const R = path.join(__dirname, '..');
/* ⚠ 주석을 먼저 걷는다 — 이 고침을 설명한 주석에 'row-reverse' 가 들어 있어서,
   날것으로 찾으면 «코드를 도로 빼도» 검사가 통과한다. */
const bare = stripComments(fs.readFileSync(path.join(R, 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n'));

/* 합계 줄이 «있는» 돈 칸들 — 열이 맞아야 하는 자리는 여기뿐이다 */
const 돈칸 = [
  { 이름: '사건관리 착수금', 여는말: "colVis.retainerFee && h('td'" },
  { 이름: '컨설팅류 계약금', 여는말: "colVis.contractFee && h('td'" },
  { 이름: '컨설팅류 잔금',   여는말: "colVis.balanceFee && h('td'" }
];

test('① ★★ 돈 칸 안이 flex 면 «오른끝»으로 세운다 — 안 그러면 합계와 열이 어긋난다', function () {
  돈칸.forEach(function (c) {
    const at = bare.indexOf(c.여는말);
    assert.ok(at > 0, '★ ' + c.이름 + ' 칸을 못 찾았습니다 (' + c.여는말 + ')');
    const 칸 = bare.slice(at, at + 900);

    /* 오른쪽 정렬이 걸려 있는 칸인가 — 이 검사의 전제다 */
    assert.ok(/className:'ar'|textAlign:'right'/.test(칸),
      '★ ' + c.이름 + ' 칸에 오른쪽 정렬이 없습니다 — 돈 열은 오른쪽 정렬이어야 합니다');

    /* 안이 flex 가 아니면 text-align 이 제대로 먹으므로 더 볼 것이 없다 */
    if (!/display:'flex'/.test(칸)) return;

    assert.ok(/flexDirection:'row-reverse'|justifyContent:'flex-end'/.test(칸),
      '★★ ' + c.이름 + ' — 칸에 오른쪽 정렬이 걸려 있는데 안이 flex 라 «그 정렬이 무시됩니다».\n' +
      '   flex 항목은 text-align 이 아니라 justify-content 를 따릅니다(기본값 왼쪽).\n' +
      '   그러면 금액은 칸 왼쪽, 합계는 오른끝에 서서 열이 어긋납니다(실측 최대 80.4px).\n' +
      "   flexDirection:'row-reverse' 를 넣으세요 — 금액이 오른끝에 섭니다.");
  });
});

test('② ★ 합계 숫자에도 「원」이 붙는다 — 자릿수까지 맞춘다', function () {
  /* 데이터 칸은 「400,000원」이다. 합계만 「38,372,728」이면 오른끝은 맞아도
     원 글자 너비만큼 자릿수가 밀려 보인다 — 대표가 보는 것은 «자릿수»다. */
  const 합계들 = bare.match(/'합계 ' \+ filtered[\s\S]{0,1200}?colSpan:(?:rightCols|\(colVis\.status)/g) || [];
  assert.ok(합계들.length >= 2,
    '★ 합계 줄을 못 찾았습니다 (' + 합계들.length + '개) — 자리가 바뀌었는지 보세요');
  합계들.forEach(function (줄, i) {
    const 돈칸수 = (줄.match(/toLocaleString\(\)/g) || []).length;
    const 원붙은수 = (줄.match(/toLocaleString\(\)\s*\+\s*'원'/g) || []).length;
    assert.strictEqual(원붙은수, 돈칸수,
      '★★ ' + (i + 1) + '번째 합계 줄 — 돈 칸 ' + 돈칸수 + '개 가운데 ' + 원붙은수 + '개만 「원」이 붙었습니다.\n' +
      '   데이터 칸은 「400,000원」인데 합계가 「38,372,728」이면 자릿수가 어긋나 보입니다.');
  });
});
