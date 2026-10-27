'use strict';
/* 📱 사용자 표 — 폰에서 숨기는 칸이 «이름으로 본 그 칸»이다 (2026-10-26)

   ■ 왜 생겼나
   css/pu-erp.css 는 폰에서 사용자 표(.user-tbl)의 칸을 «번호(nth-child)»로 숨긴다.
   2026-10-25 에 사번·아이디 칸을 표에서 빼자 번호가 한 칸씩 밀렸는데 CSS 는 그대로여서,
   폰에서 엉뚱한 칸(권한·상태…)이 사라지고 직책·지사가 남을 뻔했다. 검사가 «번호»가 아니라
   «그 번호가 가리키는 칸의 이름»을 본다 — 칸이 또 늘고 줄어도 같은 일이 안 생기게.

   ★ 규칙
     ① 폰에서 숨기는 칸은 직책·지사·담당·비번(보조 정보)뿐이다
     ② 이름·권한·상태·관리는 폰에서도 보인다 (사람을 알아보고, 상태를 바꾸고, 관리 단추를 누르는 데 필요하다)
     ③ 사번·아이디 칸은 표에 없다 (tests/sid-never-shown.test.js 도 지킨다) */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { stripComments } = require('./strip-comments');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

/* 표 머리글 — pu-erp.html 의 사용자 표 한 벌에서 순서대로 */
function headers() {
  const src = stripComments(read('pu-erp.html'));
  const at = src.indexOf("className:'dt user-tbl'");
  assert.ok(at > 0, '사용자 표(dt user-tbl)를 못 찾았습니다');
  const head = src.slice(at, src.indexOf('h(\'tbody\'', at));
  /* th 하나씩 잘라 «마지막 글자열» 을 칸 이름으로 — 속성 객체가 중첩 중괄호여도 안 놓친다(첫 칸은 폭만 있는 빈 칸) */
  return head.split("h('th'").slice(1).map((seg) => {
    const all = [...seg.matchAll(/,\s*'([^']*)'\s*\)/g)];
    return all.length ? all[all.length - 1][1] : '';
  });
}

/* 폰(480px 이하) 규칙에서 .user-tbl 칸 번호 */
function hiddenIdx() {
  const css = read('css/pu-erp.css');
  const at = css.indexOf('.user-tbl th:nth-child(');
  assert.ok(at > 0, '폰에서 사용자 표 칸을 숨기는 규칙이 없습니다');
  const end = css.indexOf('}', at);
  const block = css.slice(at, end);
  const set = new Set();
  const re = /\.user-tbl th:nth-child\((\d+)\)/g;
  let m;
  while ((m = re.exec(block))) set.add(Number(m[1]));
  return [...set].sort((a, b) => a - b);
}

test('①★ 폰에서 숨기는 칸은 «직책·지사·담당·비번» 칸이다 — 번호가 아니라 이름으로 견준다', () => {
  const hs = headers();
  assert.ok(hs.length >= 8, '표 머리글을 못 읽었습니다: ' + hs.join('|'));
  const hidden = hiddenIdx().map((i) => hs[i - 1]);
  const bad = hidden.filter((n) => !/^(직책|지사|담당|아이디|비번)$/.test(String(n || '')));
  assert.deepEqual(bad, [], '★ 폰에서 숨기면 안 되는 칸이 숨겨집니다 — 칸 번호가 어긋났습니다: ' + hidden.join(', '));
  ['직책', '지사', '담당', '비번'].forEach((n) => {
    assert.ok(hidden.includes(n), '폰에서 「' + n + '」 칸을 숨기지 않습니다 — 칸이 너무 많이 남아 한 줄이 넘칩니다');
  });
});

test('②★ 이름·권한·상태·관리 칸은 폰에서도 보인다', () => {
  const hs = headers();
  const hidden = new Set(hiddenIdx().map((i) => hs[i - 1]));
  ['이름', '권한', '상태', '관리'].forEach((n) => {
    assert.ok(hs.includes(n), '표에 「' + n + '」 칸이 없습니다');
    assert.ok(!hidden.has(n), '폰에서 「' + n + '」 칸이 숨겨집니다');
  });
});

test('③★ 사용자 표에 사번·아이디 칸이 없다', () => {
  const hs = headers();
  assert.ok(!hs.includes('사번'), '사번 칸이 되살아났습니다');
  assert.ok(!hs.includes('아이디'), '아이디 칸이 되살아났습니다');
});

test('③★ (이빨) 번호가 어긋난 CSS 는 잡힌다 — 옛 번호(4·6·8·10·11)로는 이 검사가 빨갛게 된다', () => {
  const hs = headers();
  const old = [4, 6, 8, 10, 11].map((i) => hs[i - 1]);
  const bad = old.filter((n) => !/^(직책|지사|담당|아이디|비번)$/.test(String(n || '')));
  assert.ok(bad.length > 0, '옛 번호가 지금 표에서도 맞는다면 이 검사는 아무것도 못 잡습니다');
});
