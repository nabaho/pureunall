/* 회생광고 — reload() 가 «번호로» 읽는 결과가 제자리인가.
   2026-10-13 아침: 목록이 통째로 안 떴다(「불러오지 못했습니다: Cannot read properties of undefined (reading 'val')」).
   원인: Promise.all([...]) 중간에 새 읽기(loadFsc)를 끼워, 뒤에서 r[3] 으로 읽던 «법원 수집 기록»이 한 칸 밀렸다.
   규칙: r[N] 으로 읽는 칸이 가리키는 «N번째 읽기»가 정말 그 자료여야 한다.
   실행: node --test tests/rehab-ad-reload-index.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const src = fs.readFileSync(path.join(__dirname, '..', 'rehab-ad.html'), 'utf8');
const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/* 최상위 쉼표로만 가른다(괄호 안의 쉼표는 두고) */
function splitTop(body) {
  const out = []; let depth = 0, cur = '';
  for (const ch of body) {
    if ('([{'.includes(ch)) depth++;
    if (')]}'.includes(ch)) depth--;
    if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

const m = code.match(/var r\s*=\s*await Promise\.all\(\[([\s\S]*?)\]\);/);

test('① reload 의 Promise.all 을 찾는다', () => {
  assert.ok(m, 'reload() 의 병렬 읽기 줄을 못 찾음 — 이 검사의 찾는 법을 고쳐야 한다');
});

test('② r[N] 으로 읽는 칸이 가리키는 읽기가 맞는 자료다', () => {
  const items = splitTop(m[1]);
  const fn = code.slice(code.indexOf('async function reload'), code.indexOf('async function reload') + 900);
  const noticesIdx = Number((fn.match(/NOTICES\s*=\s*r\[(\d+)\]/) || [])[1]);
  const runsIdx = Number((fn.match(/var runs\s*=\s*r\[(\d+)\]/) || [])[1]);
  assert.ok(Number.isInteger(noticesIdx) && Number.isInteger(runsIdx), 'r[N] 읽는 줄을 못 찾음');
  assert.match(items[noticesIdx] || '', /rehab_ad\/notices/, 'NOTICES 가 읽는 r[' + noticesIdx + '] 는 notices 가 아니다 — 읽기 순서가 밀렸다');
  assert.match(items[runsIdx] || '', /rehab_ad\/runs/, '수집 기록이 읽는 r[' + runsIdx + '] 는 runs 가 아니다 — 읽기 순서가 밀렸다');
});

test('③ 값을 돌려주지 않는 읽기(load*)는 r[N] 으로 읽는 칸 «뒤»에 둔다 — 중간에 끼우면 번호가 밀린다', () => {
  const items = splitTop(m[1]);
  const fn = code.slice(code.indexOf('async function reload'), code.indexOf('async function reload') + 900);
  const used = new Set([...fn.matchAll(/\br\[(\d+)\]/g)].map((x) => Number(x[1])));
  for (const i of used) assert.ok(!/^load\w+\(\)$/.test(items[i] || ''), 'r[' + i + '] 는 값을 돌려주지 않는 load*() 를 읽는다');
});
