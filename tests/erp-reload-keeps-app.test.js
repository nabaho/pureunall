'use strict';
/* 새 판 새로고침이 ?app=hr·fin 을 남긴다 (2026-10-11 실제 화면에서 찾음 — 인사관리 창이 새 판을 받는 순간 «푸른이알피»로 바뀌었다)
   실행: node --test tests/erp-reload-keeps-app.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { stripJs } = require('./strip-comments.js');
const SRC = stripJs(fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n'));

test('erpReloadUrl — app 꼬리는 남기고 v 만 바꾼다', () => {
  const m = SRC.match(/function erpReloadUrl\(\)\{[\s\S]*?\n\}/);
  assert.ok(m, 'erpReloadUrl 을 못 찾았습니다');
  const run = (search) => new Function('location', 'Date', m[0] + '; return erpReloadUrl();')({ pathname: '/p/pu-erp.html', search }, { now: () => 7 });
  assert.equal(run('?app=hr&sso=1&v=1'), '/p/pu-erp.html?app=hr&v=7');   // 검사고정-허용: 꾸민 입력·시계(7)로 만든 주소 — 캐시 번호가 아니다
  assert.equal(run('?app=fin'), '/p/pu-erp.html?app=fin&v=7');   // 검사고정-허용: 꾸민 입력
  assert.equal(run('?v=3'), '/p/pu-erp.html?v=7');   // 검사고정-허용: 꾸민 입력
});

test('★ app 꼬리를 버리는 새로고침(location.pathname + ?v=)이 남지 않았다', () => {
  assert.doesNotMatch(SRC, /location\.pathname ?\+ ?'\?v=' ?\+/, 'pathname + ?v= 로 바꾸는 자리가 남았습니다 — erpReloadUrl() 을 쓰세요');
});
