/* enter.html 의 로그인 기록 손잡이가 «달려 있는가» (2026-09-20 보안검토 IMPORTANT 9)
 *
 * ■ 왜 이 검사가 있나
 *   로그인 시도를 서버에 알리는 두 자리(성공·실패)는 5000줄짜리 enter.html 안에 있고,
 *   설계상 «조용히 실패»한다 — 안 불려도 화면에는 아무 표시가 없다.
 *   그래서 나중에 doLogin() 을 손대다 한쪽을 떨어뜨려도 아무도 모른다.
 *   무단 로그인 감지가 통째로 눈이 머는데 검사는 전부 초록이다.
 *
 * ■ 무엇을 보는가 — «손잡이가 달렸는가»만 본다(값·문구·줄번호는 안 본다)
 *   ① 성공 자리에서 부르는가   ② 실패 자리에서 부르는가
 *   ③ 화면이 부르는 함수 이름과 서버에 «실제로 있는» 함수 이름이 같은가
 *      (주소는 그대로인데 서버 함수 이름만 바뀌면 그날부터 조용히 아무 일도 안 한다)
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ENTER = fs.readFileSync(path.join(ROOT, 'enter.html'), 'utf8');

test('성공한 로그인도 보고한다 (reportLogin 성공 자리)', () => {
  assert.ok(
    /reportLogin\(\s*email\s*,\s*true/.test(ENTER),
    'enter.html 에 성공 보고 자리(reportLogin(email, true …))가 없습니다',
  );
});

test('실패한 로그인도 보고한다 (reportLogin 실패 자리)', () => {
  assert.ok(
    /reportLogin\(\s*email\s*,\s*false/.test(ENTER),
    'enter.html 에 실패 보고 자리(reportLogin(email, false …))가 없습니다',
  );
});

test('화면이 부르는 함수 이름이 서버에 실제로 있다', () => {
  const m = /LOGIN_LOG_URL\s*=\s*['"]([^'"]+)['"]/.exec(ENTER);
  assert.ok(m, 'enter.html 에 LOGIN_LOG_URL 이 없습니다');

  const fnName = m[1].split('?')[0].replace(/\/+$/, '').split('/').pop();
  assert.ok(/^[A-Za-z_$][\w$]*$/.test(fnName), '주소 끝이 함수 이름 꼴이 아닙니다: ' + fnName);

  const serverSrc = fs.readFileSync(path.join(ROOT, 'functions', 'index.js'), 'utf8');
  const exported = new RegExp('exports\\.' + fnName + '\\s*=').test(serverSrc);
  assert.ok(
    exported,
    '화면은 ' + fnName + ' 을 부르는데 functions/index.js 에 exports.' + fnName + ' 이 없습니다'
      + ' — 주소와 서버 함수 이름이 어긋나면 로그인 감지가 조용히 멎습니다',
  );
});
