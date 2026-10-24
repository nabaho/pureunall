'use strict';
/* 근로자 사건은 모두 부가세 포함 (대표 2026-10-24) — 채우기 창의 위임계약 「부가세」 고르기가 근로자측 양식이면 「포함」에서 시작한다 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { test } = require('node:test');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'js/pu-contract-forms.js'), 'utf8').replace(/\r\n/g, '\n');

test('근로자측 양식만 골랐으면 부가세는 포함에서 시작', () => {
  const i = SRC.indexOf("wi: { on: false, task: '', wtask: '', vat: 'excl'");
  const j = SRC.indexOf("if (fms.every(function (fm) { return sideOf(fm) === 'worker'; })) st.wi.vat = 'incl';");
  assert.ok(i > 0 && j > i, '근로자측 기본값이 포함이 아닙니다');
});
