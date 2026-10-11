'use strict';
/* 홈페이지 월간 자동 연결 — 서버 입구(functions/index.js)의 «문»을 본다 (설계 2026-10-05).
   고르는 규칙은 homepage-auto.test.js 가 실제로 돌려 본다. 여기서는 서버가
   ① 관리자만 열고 ② 매달 서울 시각으로 돌고 ③ 게시판을 확인한 «뒤»에만 휴지통으로 보내는지 본다.
   ★ 주석을 걷고 본다 — 잘 쓴 주석이 검사를 통과시키면 안 된다. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const HA = require('../functions/homepage-auto.js');

const 원문 = fs.readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8');
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
  const 끝 = 주석뺌.slice(i).search(/\n}\r?\n/);
  return 주석뺌.slice(i, 끝 < 0 ? undefined : i + 끝);
}

test('homepageAuto 는 총괄관리자만 연다', () => {
  const b = 덩어리('homepageAuto');
  assert.match(b, /verifyIdToken\(/);
  assert.match(b, /isAdmin\s*!==\s*true/);
  const 문 = b.indexOf('isAdmin'), 일 = b.indexOf('홈자동한번(');
  assert.ok(문 > 0 && 일 > 문, '관리자 확인이 일보다 먼저여야 합니다');
});

test('homepageAuto 가 받는 방식은 보기·돌리기·승인뿐이고, 모르면 보기다', () => {
  const b = 덩어리('homepageAuto');
  const m = /\[([^\]]*"보기"[^\]]*)\]\.indexOf\(/.exec(b);
  assert.ok(m, '방식 목록이 없습니다');
  const 방식들 = m[1].split(',').map(s => s.trim().replace(/^"|"$/g, '')).sort();
  assert.deepStrictEqual(방식들, ['돌리기', '보기', '승인'].sort());
  assert.match(b, /:\s*"보기"\s*;/, '모르는 방식은 «보기»로 떨어져야 합니다');
});

test('monthlyHomepageAuto 는 «매달» 서울 시각으로 돈다', () => {
  const b = 덩어리('monthlyHomepageAuto');
  const m = /schedule\("([^"]+)"\)/.exec(b);
  assert.ok(m, '일정이 없습니다');
  const 칸 = m[1].trim().split(/\s+/);
  assert.strictEqual(칸.length, 5, 'cron 다섯 칸이어야 합니다: ' + m[1]);
  assert.match(칸[2], /^\d+$/, '날짜 칸이 숫자(매달 그 날)여야 합니다: ' + m[1]);
  assert.strictEqual(칸[3], '*', '달 칸은 * (매달): ' + m[1]);
  assert.strictEqual(칸[4], '*', '요일 칸은 *: ' + m[1]);
  assert.match(b, /timeZone\("Asia\/Seoul"\)/);
  assert.match(b, /홈자동한번\(\s*"돌리기"/, '매달 도는 것은 «돌리기»여야 합니다(보기면 아무 일도 안 한다)');
});

test('자동 내리기는 게시판 확인을 거친 «뒤»에만 휴지통 몸통을 짓는다', () => {
  const b = 함수몸('홈자동내리기');
  const 확인 = b.indexOf('HW.게시판확인('), 몸통 = b.indexOf('HW.휴지통몸통(');
  assert.ok(확인 > 0, '게시판 확인이 없습니다');
  assert.ok(몸통 > 확인, '게시판 확인이 휴지통 몸통보다 먼저여야 합니다');
  assert.match(b, /!==\s*"ok"\)\s*\{[^\n]*continue;/, '확인이 ok 가 아니면 건너뛰어야 합니다');
  assert.ok(!/["'](delete|move|copy)["']/.test(b), '지우기·옮기기 글자가 들어 있습니다');
});

test('자동 내리기는 확인표가 없으면 하나도 안 보낸다', () => {
  const b = 함수몸('홈자동내리기');
  const 없으면 = b.search(/if\s*\(\s*!확인표\s*\)\s*return/);
  assert.ok(없으면 > 0 && 없으면 < b.indexOf('for (const x of'), '확인표 없음을 먼저 막아야 합니다');
});

test('두 함수 모두 홈페이지 비밀값을 받는다', () => {
  for (const 이름 of ['homepageAuto', 'monthlyHomepageAuto']) {
    const b = 덩어리(이름);
    assert.match(b, /"HOME_ADMIN_ID"/, 이름);
    assert.match(b, /"HOME_ADMIN_PW"/, 이름);
  }
});

test('고르는 규칙은 homepage-auto.js 한 곳 — 서버가 따로 퇴사·종료를 판정하지 않는다', () => {
  const i = 주석뺌.indexOf('async function 홈자동내리기');
  const j = 주석뺌.indexOf('exports.monthlyHomepageAuto');
  assert.ok(i > 0 && j > i);
  const 구간 = 주석뺌.slice(i, j);
  assert.ok(!/["']retired["']|["']closed["']/.test(구간), '서버에 판정 규칙이 또 생겼습니다');
  assert.match(구간, /HA\.돌기\(/);
});

test('자동 정찰은 «읽기만» 한다 — 보내기(POST)가 없고, 적는 자리는 정찰 기록 하나다', () => {
  const b = 함수몸('홈자동정찰');
  assert.ok(!/method\s*:\s*["']POST/i.test(b), '정찰에서 무언가를 보냅니다');
  assert.ok(!/휴지통몸통|저장할act|사진몸통/.test(b), '정찰에서 쓰는 길을 부릅니다');
  /* 읽는 자리(once)는 괜찮다 — «쓰는» 자리(set·update·push·remove)가 정찰 기록 하나여야 한다 */
  const 쓰는자리 = [...b.matchAll(/ref\(\s*["']([^"']+)["']\s*\)\s*\.(set|update|push|remove|transaction)\(/g)].map(m => m[1]);
  assert.deepStrictEqual(쓰는자리, ['homepage/auto/recon']);
  assert.ok(!/\.(update|push|remove|transaction)\(/.test(b), '정찰에서 다른 쓰기를 합니다');
  assert.match(b, /HW\.자동정찰자리\(/, '정해 둔 자리 말고 다른 곳을 엽니다');
});

test('3차 정찰 — 레이아웃 화면은 «정해 둔 도우미»로만 열고, 직원 이름은 공개 쪽에서 읽는다', () => {
  const b = 함수몸('홈자동정찰');
  /* 주소를 손으로 짓지 않는다 — 번호는 숫자만 받는 HW.레이아웃자리 로만 */
  assert.match(b, /HW\.레이아웃번호들\(/);
  assert.match(b, /HW\.레이아웃자리\(/);
  assert.ok(!/dispLayoutAdmin/.test(b), '정찰 함수에 레이아웃 주소가 직접 적혀 있습니다 — 숫자 검사를 거치지 않습니다');
  assert.ok(!/proc[A-Z]/.test(b.replace(/\/\*[\s\S]*?\*\//g, ' ')), '정찰에서 «하는»(proc…) 길을 부릅니다');
  /* 이름은 «공개 홈페이지의 직원 줄»에서 — 구성원 자료엔 노무사뿐이라 2차 정찰은 이름을 못 찾았다 */
  assert.match(b, /HW\.직원이름뽑기\(/);
  /* 값·코드는 기록에 안 담는다 — 담는 칸은 모양 도우미(정찰·채운칸들·이름자리모양)가 낸 것뿐이다 */
  assert.match(b, /HW\.이름자리모양\(화면, 직원이름들\)/);
});

test('3차 정찰 — 레이아웃 번호를 «두 목록 모두»에서 모은다(한쪽이 비어도 다른 쪽에서)', () => {
  const b = 함수몸('홈자동정찰');
  assert.match(b, /이름 === "레이아웃목록"\s*\|\|\s*이름 === "레이아웃인스턴스"/,
    '레이아웃 번호를 한쪽 목록에서만 읽습니다 — 그 목록이 비면 레이아웃 정찰이 통째로 빕니다');
});

test('정찰 판 번호 — 서버(homepage-auto)가 기록에 쓰는 판과 같다', () => {
  assert.match(함수몸('홈자동정찰'), /판:\s*HA\.정찰판/);
  assert.ok(HA.정찰판 >= 3, '레이아웃 정찰을 넣었는데 판 번호를 안 올렸습니다 — 화면이 다시 정찰하지 않습니다');
});

test('4차 정찰 — 열린 «모든 화면»에서 이름이 든 칸 이름을 본다(공통 기록에도, 레이아웃 기록에도)', () => {
  const b = 함수몸('홈자동정찰');
  const 수 = (b.match(/HW\.이름든칸들\(화면, 직원이름들\)/g) || []).length;
  assert.ok(수 >= 2, '이름든칸들 를 쓰는 기록이 ' + 수 + '곳뿐입니다 — 일반 화면과 레이아웃 화면 둘 다 필요합니다');
  assert.ok(HA.정찰판 >= 4, '4차 정찰을 넣었는데 판 번호를 안 올렸습니다 — 화면이 다시 정찰하지 않습니다');
});

test('정찰은 «미리 보기» 때만 돈다 — 매달 돌기·승인에는 안 끼어든다', () => {
  const b = 함수몸('홈자동한번');
  const i = b.indexOf('홈자동정찰(');
  assert.ok(i > 0);
  assert.match(b.slice(Math.max(0, i - 200), i), /방식 === "보기"/);
});
test('자동 올리기 — 몸통을 «안전 확인(새구성원몸통)»으로 지은 뒤에만 보내고, 보낸 뒤 게시판을 확인한다', () => {
  const b = 함수몸('홈자동올리기');
  const 짓기 = b.indexOf('HW.새구성원몸통('), 보냄 = b.indexOf('method: "POST"'), 확인 = b.indexOf('HW.게시판확인(');
  assert.ok(짓기 > 0 && 보냄 > 짓기, '안전 확인 전에 보냅니다');
  assert.match(b.slice(짓기, 보냄), /if \(!지음\.ok\)[^\n]*continue;/, '안전 확인에 걸려도 보냅니다');
  assert.ok(확인 > 보냄, '보낸 뒤 게시판 확인이 없습니다');
  assert.ok(!/휴지통몸통|["'](delete|move|copy)["']/.test(b), '올리기에서 지우는 길을 부릅니다');
});

test('자동 올리기 — 모르는 종류는 보내지 않고 까닭을 남긴다', () => {
  const b = 함수몸('홈자동올리기');
  const i = b.indexOf('x.종류 !== "새구성원"');
  assert.ok(i > 0);
  assert.match(b.slice(i, i + 300), /됐나: false[\s\S]*continue;/);
});

test('한 번 돌기가 올리기 도구를 넘긴다', () => {
  assert.match(함수몸('홈자동한번'), /올리기:\s*async/);
});
test('정찰 기록은 «undefined» 를 거른 뒤 적는다 — 데이터베이스가 통째로 거부한다', () => {
  const b = 함수몸('홈자동정찰');
  assert.ok(!/:\s*undefined\b/.test(b), '기록에 undefined 칸을 넣습니다');
  assert.match(b, /ref\("homepage\/auto\/recon"\)\.set\(JSON\.parse\(JSON\.stringify\(/, '적기 전에 거르지 않습니다');
});
test('로고 올리기 — 짓기·확인을 하나씩 거친 뒤에만 보낸다(올리기 → 답 확인 → 새 글 → 게시판 확인)', () => {
  const b = 함수몸('홈로고올리기');
  const 차례 = ['HW.로고올리기몸통(', 'HW.올리기답풀기(', 'HW.로고새글몸통(', 'HW.게시판확인('].map(s => b.indexOf(s));
  차례.forEach((i, n) => assert.ok(i > 0, n + '번째 걸음이 없습니다'));
  for (let n = 1; n < 차례.length; n++) assert.ok(차례[n] > 차례[n - 1], '걸음 차례가 바뀌었습니다');
  ['올몸', '올림', '글몸'].forEach(v => assert.match(b, new RegExp('if \\(!' + v + '\\.ok\\) return'), v + ' 가 안 됐는데 계속 갑니다'));
  assert.ok(!/휴지통몸통|["'](delete|move|copy)["']/.test(b));
});