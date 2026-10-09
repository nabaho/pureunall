/* 더빌 받기 스크립트 — 조회 말고는 누르지 않는다, 연락처를 담지 않는다 (2026-10-09) */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'thebill-pull.js'), 'utf8');
const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1');

test('누를 수 있는 단추는 허용 목록뿐이고, 삭제·출금·재출금은 그 안에 없다', () => {
  const m = code.match(/ALLOWED_BUTTONS\s*=\s*\[([^\]]*)\]/);
  assert.ok(m, 'ALLOWED_BUTTONS 가 있어야 한다');
  assert.match(m[1], /조회/);
  assert.doesNotMatch(m[1], /삭제|출금|재출금|등록|해지/);
  // click() 은 «조회 단추»(clickAllowed)와 «쪽 넘기기»(clickPage) 두 함수 안에서만
  let rest = code;
  ['async function clickAllowed(', 'async function clickPage('].forEach(h => {
    const i = rest.indexOf(h); assert.ok(i >= 0, h + ' 가 있어야 한다');
    let j = rest.indexOf('{', i), d = 0; for (; j < rest.length; j++) { if (rest[j] === '{') d++; else if (rest[j] === '}' && --d === 0) break; }
    rest = rest.slice(0, i) + rest.slice(j + 1);
  });
  assert.doesNotMatch(rest, /\.click\(\)/, '두 함수 밖에서 click() 하지 않는다');
});
test('비밀번호 칸을 건드리지 않는다', () => {
  assert.doesNotMatch(code, /loginpw|type=password|\.fill\(/);
});
test('표 읽기는 공용 모듈 parsePayTable 을 쓴다 — 담는 칸이 한 곳에서 정해진다', () => {
  assert.match(code, /require\(['"]\.\.\/js\/pu-cms-auto\.js['"]\)/);
  assert.match(code, /parsePayTable\(/);
});
test('서버엔 표 통째가 아니라 줄 하나씩 더한다', () => {
  assert.match(code, /cms_pull\/rows\//);
  assert.doesNotMatch(code, /database:set/);
});
