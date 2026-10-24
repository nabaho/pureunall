'use strict';
/* 성공보수 연체이율 연 12% 통일 (대표 「추천대로 — 연 12%」 2026-10-24)
   소송촉진법 이율(연 12%)을 넘지 않게 — 서버 서식 21개는 화면에서 바꿨고, 여기서는 코드 안 문구(전자위임장·기본 양식)를 지킨다 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { test } = require('node:test');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

test('위임약정서 문구의 연체이율은 연 12% 하나', () => {
  ['js/esign-docs.js', 'js/pu-contract-forms.js'].forEach((f) => {
    const s = read(f);
    assert.ok(!/연 ?(15|20) ?%의 ?이자/.test(s), f + ' 에 옛 이율이 남았습니다');
    assert.match(s, /연 12%의 이자/, f);
  });
});
