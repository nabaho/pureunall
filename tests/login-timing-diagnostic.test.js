'use strict';
/* 휴대전화 로그인 지연은 서버·브라우저·카카오 화면을 나눠 재야 한다.
   개인정보나 인증표를 진단 저장소에 남기지 않고, 관리자에게 이 기기 시간만 보여 준다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'enter.html'), 'utf8');

test('탐색 시작부터 재고 인증 스크립트보다 먼저 시각을 잡는다', () => {
  const start = html.indexOf('window.__puLoginNavAt =');
  const sdk = html.indexOf('firebase-auth-compat.js');
  assert.ok(start > 0 && sdk > start);
  assert.match(html.slice(start, sdk), /performance\.timeOrigin/);
});

test('카카오 복귀의 서버·저장소·Firebase·타일과 재방문의 인증 복원을 따로 기록한다', () => {
  const ret = html.slice(html.indexOf('function kkHandleReturn(){'), html.indexOf('function enterPortal(user'));
  assert.match(ret, /kkServerMs/);
  assert.match(ret, /kkStoreMs/);
  assert.match(ret, /kkFirebaseMs/);
  assert.match(ret, /firebaseNetworkMs:kkFirebaseNetworkMs/);
  assert.match(ret, /authReadyBeforeSignIn:kkAuthReadyBeforeSignIn/);
  assert.match(ret, /identitytoolkit\|securetoken/);
  const portal = html.slice(html.indexOf('function enterPortal(user'), html.indexOf('function renderPortal(acct'));
  assert.match(portal, /mode:'kakao'/);
  assert.match(portal, /mode:'session'/);
  assert.match(portal, /puLoginTimingSave/);
});

test('Firebase 네트워크 진단은 요청 주소·인증표를 저장하지 않고 시간과 건수만 기록한다', () => {
  const measured = html.slice(html.indexOf('var resources = window.performance.getEntriesByType'),
    html.indexOf('window.__kkReturning = false;', html.indexOf('var resources = window.performance.getEntriesByType')));
  assert.match(measured, /kkFirebaseNetworkCount\+\+/);
  assert.match(measured, /kkFirebaseNetworkMs \+=/);
  assert.doesNotMatch(measured, /entry\.name\s*[,}]/);
});

test('관리자만 로컬 측정치를 보고, 진단 저장에는 계정과 인증표를 담지 않는다', () => {
  const saveAt = html.indexOf('function puLoginTimingSave(value)');
  const save = html.slice(saveAt, html.indexOf('  try {\n    if(localStorage.getItem', saveAt));
  assert.match(save, /localStorage\.setItem/);
  const view = html.slice(html.indexOf("var _cfgLoginTiming = $('cfgLoginTiming')"), html.indexOf('kkHandleReturn();', html.indexOf("var _cfgLoginTiming = $('cfgLoginTiming')")));
  assert.match(view, /if\(!sgIsAdmin\(\)\) return/);
  assert.match(view, /textContent/);
  assert.doesNotMatch(view, /fetch\(|db\.ref\(/);
  const measured = html.slice(html.indexOf("puLoginTimingSave({mode:'kakao'"), html.indexOf("sessionStorage.removeItem('pu_kakao_login_tap_at')"));
  assert.doesNotMatch(measured, /email|uid|sid|token|profile|name/);
});
