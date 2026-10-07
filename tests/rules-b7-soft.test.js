/* B7 임금지급 4대원칙 — 노동부 표준을 넣어도 «위반의심»이 뜨던 것 (대표 「추천대로」 2026-10-07)
   📝 질문으로 바로 작성을 만들며 찾았다: 표준취업규칙(2026)으로 지은 한 권에서 B7 만 빨갛게, 그것도 제7조(수습)를 짚었다.

   ■ 까닭 둘
     ① 자리 — 「같은조:임금>전액」은 «임금»이 든 조의 맨 앞을 짚었다. 그게 「평균임금」을 말하는 수습 조였다.
     ② 판정 — 4대원칙(통화·직접·전액·정기)은 근로기준법 §43 이 바로 적용된다. 취업규칙에 낱말을 다시 안 적었다고
        위반이 아니다(표준도 안 적는다). 위반은 «어긋나는 문안»(현물 지급·근거 없는 공제)이고, 그건 사람이 본다.
   ■ 지키는 규칙
     ① 같은조 판정은 제목에 앵커가 든 조를 먼저 본다 — B7 은 「임금의 계산 및 지급방법」, B10 은 「해고의 통지」
     ② soft 가 붙은 규칙(B7)은 낱말이 없어도 «수동확인(보완 권고)» — 위반의심이 아니다
     ③ soft 가 없는 규칙(B10)은 그대로 위반의심을 낸다
   실행: node --test tests/rules-b7-soft.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/pu-rules-criteria.js');
const { parseArticles, STD_TEXT } = require('./lib-rules-std.js');

const arts = parseArticles(STD_TEXT);
const 판 = (a, id) => C.evaluate(a, '30인이상', new Set(), '2026-10-07').find((f) => f.rule.id === id);
const 제목 = (a, label) => (a.find((x) => x.label === label) || {}).title;

test('① B7 은 임금 지급 조를 짚는다 — 수습 조가 아니라', () => {
  const f = 판(arts, 'B7');
  assert.equal(제목(arts, f.loc), '임금의 계산 및 지급방법', '★ ' + f.loc + '(' + 제목(arts, f.loc) + ')를 짚었다');
  const g = 판(arts, 'B10');
  assert.equal(제목(arts, g.loc), '해고의 통지');
});

test('② 표준을 넣으면 B7 은 «보완 권고» — 위반의심이 아니다', () => {
  const f = 판(arts, 'B7');
  assert.equal(f.status, '수동확인', '★ 노동부 표준이 위반의심으로 뜬다');
  assert.match(f.note, /^보완 권고: .*§43/);
  assert.equal(C.evaluate(arts, '30인이상', new Set(), '2026-10-07').filter((x) => x.status === '위반의심').length, 0,
    '표준취업규칙(2026)에 위반의심이 남았다');
});

test('③ soft 가 없는 규칙은 그대로 짚는다 — B10 해고 서면통지', () => {
  const 서면없음 = parseArticles('제1조(해고의 통지) 회사는 사원을 해고하는 경우 그 사유와 날짜를 통지한다.\n제2조(임금) 임금은 매월 25일 지급한다.');
  assert.equal(판(서면없음, 'B10').status, '위반의심', '★ soft 를 모든 규칙에 걸었다');
  assert.notEqual(판(서면없음, 'B7').status, '위반의심');
});
