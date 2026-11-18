'use strict';
/* 카카오 우편번호 CDN 도메인 종료 방어 (2026-11-18)
   ═══════════════════════════════════════════════════════════════════════════
   카카오 우편번호 서비스(kakao-postcode#1562)가 2026-11-30 부로 옛 도메인
   t1.daumcdn.net(및 그 이전 spi.maps.daum.net · i1.daumcdn.net · s1.daumcdn.net)을 종료한다.
   12월 1일부터 옛 주소는 스크립트·이미지가 내려오지 않아 주소 검색 창이 깨진다.

   또한 postcode.v2.js 는 자체 검사(_validParam_)로 주소 뒤에 ?v=… 같은 쿼리 파라미터가 붙으면
   작동을 중지시킨다 — 우리 스크립트처럼 캐시 번호를 붙이면 안 된다.

   ★ 규칙:
     1) 실행 코드(주석 제외)에 종료 대상 도메인을 쓰지 않는다.
     2) postcode.v2.js 를 부르는 모든 자리는 쿼리 없는
        https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js 를 쓴다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const 종료도메인 = [
  't1.daumcdn.net',
  'spi.maps.daum.net',
  'i1.daumcdn.net',
  's1.daumcdn.net',
];
const 정식주소 = 'https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';

function 알맹이(s, html) {
  if (html) s = s.replace(/<!--[\s\S]*?-->/g, ' ');
  s = s.replace(/\/\*[\s\S]*?\*\//g, ' ');
  s = s.replace(/(^|[^:"'\\`])\/\/[^\n]*/g, '$1 ');
  return s;
}

function 대상들() {
  const out = [];
  for (const f of fs.readdirSync(ROOT)) if (f.endsWith('.html')) out.push(f);
  function 훑기(d) {
    if (!fs.existsSync(path.join(ROOT, d))) return;
    for (const e of fs.readdirSync(path.join(ROOT, d), { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const p = d + '/' + e.name;
      if (e.isDirectory()) 훑기(p);
      else if (/\.(html|js|mjs)$/.test(e.name) && !e.name.endsWith('.test.js')) out.push(p);
    }
  }
  훑기('js');
  훑기('functions');
  훑기('fund-erp/static');
  훑기('tools');
  return out;
}

function 주소검사(코드) {
  const 어김 = [];
  for (const h of 종료도메인) {
    if (코드.includes(h)) 어김.push('종료 도메인(' + h + ')');
  }
  const 조각들 = 코드.match(/(?:https?:)?\/\/[^\s"'`<>]*postcode\.v2\.js[^\s"'`<>]*/g) || [];
  for (const u of 조각들) {
    if (u !== 정식주소) 어김.push('비표준 또는 쿼리 붙은 우편번호 주소(' + u + ')');
  }
  return 어김;
}

test('검사기가 옛 도메인·프로토콜 생략 주소·쿼리 붙은 postcode.v2.js 를 실제로 잡는다', () => {
  assert.equal(주소검사(알맹이('<!-- https://t1.daumcdn.net/x -->', true)).length, 0, '주석은 잡지 않아야 한다');
  assert.ok(주소검사('<script src="https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js"></script>').length >= 1);
  assert.ok(주소검사('<script src="//t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js"></script>').length >= 1, 'https 고정 아닌 프로토콜 생략 주소도 잡는다');
  assert.ok(주소검사("var s = '" + 정식주소 + "?t=1';").length >= 1, '쿼리 파라미터가 붙으면 카카오 API 가 작동을 멈춘다');
  assert.deepEqual(주소검사('<script src="' + 정식주소 + '"></script>'), []);
});

test('★★ 실행 코드 어디에도 종료 대상 우편번호 도메인(t1.daumcdn.net 등)이 없다', () => {
  const 걸림 = [];
  let 우편번호앱수 = 0;
  for (const f of 대상들()) {
    const 원문 = fs.readFileSync(path.join(ROOT, f), 'utf8');
    const 코드 = 알맹이(원문, f.endsWith('.html'));
    if (코드.includes('postcode.v2.js')) 우편번호앱수++;
    const 어김 = 주소검사(코드);
    if (어김.length) 걸림.push(f + ': ' + 어김.join(', '));
  }
  assert.ok(우편번호앱수 >= 4, '우편번호를 쓰는 앱 화면(이알피·기금·경력·기업정보함)을 훑지 못했다');
  assert.deepEqual(걸림, [],
    '★★ 종료 예정 우편번호 도메인 또는 잘못된 주소가 남아 있습니다: ' + 걸림.join(' · ')
    + ' → ' + 정식주소 + ' 로 바꾸세요');
});
