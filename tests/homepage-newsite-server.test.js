'use strict';
/* 새 사이트 지킴이 — 서버 입구(functions/index.js)가 «실제로 잇고 있는지» 본다 (2026-10-31)
   규칙은 functions/homepage-newsite.test.js 가 실제로 돌려 본다. 여기서는 서버가
   ① 매달 자동 연결 «뒤에» 새 사이트를 돌리고 ② 매일 열쇠를 점검하고 ③ 손으로 올린 것도 기록하는지 본다.
   ★ 주석을 걷고 본다 — 잘 쓴 주석이 검사를 통과시키면 안 된다. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const 원문 = fs.readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8').replace(/\r\n/g, '\n');
const 주석뺌 = 원문.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

function 덩어리(이름) {
  const i = 주석뺌.indexOf('exports.' + 이름 + ' =');
  assert.ok(i >= 0, 이름 + ' 이 없습니다');
  const j = 주석뺌.indexOf('\nexports.', i + 10);
  return 주석뺌.slice(i, j < 0 ? undefined : j);
}
function 함수몸(이름) {
  const i = 주석뺌.indexOf('async function ' + 이름 + '(');
  assert.ok(i >= 0, 이름 + ' 이 없습니다');
  const 끝 = 주석뺌.slice(i).search(/\n}\n/);
  return 주석뺌.slice(i, 끝 < 0 ? undefined : i + 끝);
}

test('★ 매달 자동 연결은 내리기를 «마친 뒤» 새 사이트도 돌린다 — 열쇠를 쥐고', () => {
  const b = 덩어리('monthlyHomepageAuto');
  assert.match(b, /secrets:\s*\[[^\]]*"GITHUB_AUTOMATION_TOKEN"/, '★ 열쇠 없이는 새 사이트에 못 올린다');
  const 앞 = b.indexOf('홈자동한번('), 뒤 = b.indexOf('새사이트한번(');
  assert.ok(앞 > 0, '홈페이지 자동 연결이 빠졌다');
  assert.ok(뒤 > 앞, '★ 새 사이트를 내리기 «뒤에» 돌려야 방금 내린 사람도 함께 빠진다');
  assert.match(b, /await 새사이트한번\(/, '기다리지 않으면 함수가 먼저 끝나 올리다 끊긴다');
});

test('★ 새사이트한번 은 규칙 한 곳(homepage-newsite.돌기)을 부르고, 화면의 올리기와 같은 두 저장소에 올린다', () => {
  const f = 함수몸('새사이트한번');
  assert.match(f, /HN\.돌기\(/);
  assert.match(f, /올리기\(githubRequest, 토큰, SITE_REPO,/, '사람이 보는 새 사이트 저장소');
  assert.match(f, /올리기\(githubRequest, 토큰, REPO, HN\.사본자리/, '우리 사본');
  assert.ok(f.indexOf('SITE_REPO') < f.indexOf('REPO, HN.사본자리'), '사람이 보는 쪽 먼저 — publishSite 와 같은 차례');
});

test('★ 매일 아침 열쇠 점검이 서울 시각으로 돈다', () => {
  const b = 덩어리('dailyHomepageKeyCheck');
  assert.match(b, /\.pubsub\.schedule\("\d+ \d+ \* \* \*"\)/, '날마다 도는 일정이 아니다');
  assert.match(b, /\.timeZone\("Asia\/Seoul"\)/);
  assert.match(b, /secrets:\s*\[[^\]]*"GITHUB_AUTOMATION_TOKEN"/);
  assert.match(b, /HN\.열쇠점검\(/);
  assert.match(b, /SITE_REPO/); assert.match(b, /REPO, HN\.사본자리/, '두 저장소를 다 읽어 봐야 한다');
});

test('★ 손으로 구성원 쪽을 올리면 새 사이트 기록도 바뀐다 — 고친 뒤에도 실패 띠가 남지 않게', () => {
  const b = 덩어리('publishSite');
  const 성공 = b.indexOf('const 답 = await 올리기(');
  const 기록 = b.indexOf('ref("homepage/auto/newsite")');
  assert.ok(기록 > 성공 && 성공 > 0, '★ 올린 «뒤에» 기록해야 한다 — 실패했는데 성공으로 적으면 띠가 거짓말한다');
  assert.match(b, /if \(path === HN\.사본자리\)/, '구성원 쪽일 때만 — 다른 쪽을 올렸다고 구성원 기록을 바꾸면 안 된다');
});
