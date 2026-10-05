/* 컨설팅·기금·기타사업 표 — «처음 열 때»도 휴지통(_deleted) 줄을 뺀다 (2026-10-05 대표 「동일건이다 하나 삭제해라」).
   서버에서는 옛 이음센터-2026-001 이 이미 휴지통이었는데, 처음 상태만 안 걸러 두 줄로 보였다.
   박는 것은 «처음 상태도 거른다»는 규칙이다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const src = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n').replace(/\/\*[\s\S]*?\*\//g, '');
const fn = src.slice(src.indexOf('function ProjectManagementShared('), src.indexOf('function refreshItems(', src.indexOf('function ProjectManagementShared(')));

test('★ 처음 상태(items)에서 _deleted 줄을 뺀다', () => {
  const m = fn.match(/var s = useState\(([\s\S]*?)\); var items = s\[0\];/);
  assert.ok(m, 'items 첫 상태를 찾지 못했습니다');
  assert.match(m[1], /_deleted === true/, '★ 처음 열 때 휴지통 줄이 표에 남습니다');
});
