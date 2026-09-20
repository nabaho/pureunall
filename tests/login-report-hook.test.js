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

/* 2026-09-20 재검토(최종 리뷰 뒤 발견) — 성공 보고의 이메일은 «증표에 적힌 것만» 믿어야
   한다. `verified.email || parsed.email` 처럼 증표에 이메일이 없을 때(익명 로그인 등)
   본문 값으로 도로 떨어지면, 익명으로 로그인한 누구나 «증표는 있다»는 사실만으로
   실제 직원 이메일을 자처해 가짜 성공 기록·경보를 만들 수 있다 — 값이 아니라
   «그 패턴이 없는가»만 본다(다른 코드가 바뀌어도 이 검사는 안 흔들린다). */
test('성공 보고의 이메일은 본문으로 대체되지 않는다 (증표에 없으면 그냥 막는다)', () => {
  const serverSrc = fs.readFileSync(path.join(ROOT, 'functions', 'index.js'), 'utf8');
  assert.ok(
    !/verified\.email\s*\|\|\s*parsed\.email/.test(serverSrc),
    'functions/index.js 에 「증표 이메일이 없으면 본문 이메일로 대체」하는 자리가 있습니다'
      + ' — 익명 로그인 증표로도 남의 이메일을 자처할 수 있게 됩니다',
  );
});

test('성공 보고는 비밀번호 로그인 증표만 받는다 (익명 로그인 증표는 막는다)', () => {
  const serverSrc = fs.readFileSync(path.join(ROOT, 'functions', 'index.js'), 'utf8');
  assert.match(
    serverSrc,
    /sign_in_provider\s*!==\s*["']password["']/,
    'functions/index.js 에 로그인 방식(sign_in_provider)이 비밀번호인지 가르는 자리가 없습니다',
  );
});
