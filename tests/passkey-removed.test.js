/* 지문·간편 로그인 화면은 «없다» (대표 지시 2026-10-09 「폰에서 지문 로그인 기능 삭제해라 필요없다」)
   2026-08-16 에 중단했던 기능을 화면에서 걷어냈다. 다시 붙이려면 대표 지시가 먼저다.
   ⚠ 비밀번호·카카오 로그인까지 같이 지우면 안 된다 — 그 둘은 남았는지도 본다. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const raw = fs.readFileSync(path.join(ROOT, 'enter.html'), 'utf8').replace(/\r\n/g, '\n');
/* 주석은 걷고 본다 — 「걷어냈다」는 설명 글에 걸리지 않게 */
const code = raw.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('포털에 지문 로그인 단추·등록 안내·판단 파일이 없다', () => {
  assert.ok(!/id="pkBtn"|id="pkRegRow"|id="pkRegBtn"/.test(code), '지문 로그인 단추·등록 띠가 다시 생겼다');
  assert.ok(!/pu-passkey\.js/.test(code), '지문 판단 파일을 다시 싣는다');
  assert.ok(!/PuPasskey\./.test(code), '지문 로그인을 부르는 곳이 남았다');
  assert.ok(!fs.existsSync(path.join(ROOT, 'js', 'pu-passkey.js')), 'js/pu-passkey.js 가 되살아났다');
});

test('이 기기에 남은 지문 등록 표를 지운다', () => {
  assert.match(code, /localStorage\.removeItem\('pu_passkey_sid'\)/);
});

test('비밀번호 로그인과 카카오 로그인은 그대로 있다', () => {
  assert.match(code, /id="loginForm"/);
  assert.match(code, /addEventListener\('submit', function\(e\)\{ e\.preventDefault\(\); doLogin\(\); \}\)/);
  assert.match(code, /pu-kakao\.js/);
});
