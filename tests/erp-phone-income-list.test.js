/* 이알피 입금관리 «입금 리스트» — 폰에서는 줄마다 카드 (대표 지시 2026-10-18 「좌우 옆공간 모두 채워서」)
 *
 * ★ 여덟 칸 표(# · 입금일 · 출처 · 관련번호 · 업체명 · 유형 · 입금액 · 관리)라 폰에서는 업체명이 잘리고
 *   유형·입금액·관리가 옆으로 밀어야 보였다.
 *
 * ★ 무엇을 못 박나 — 지금 값이 아니라 규칙
 *   · 표에 .inc-tb 이름이 붙어 있고, 폰 구간(640px 이하)에서 줄(tr)이 카드(flex/grid)로 바뀐다 — 넓은 화면은 그대로 표
 *   · 머리줄은 «정렬 줄»로 남는다(입금일·업체명·유형·입금액) — 통째로 숨기면 폰에서 정렬·유형 깔때기가 사라진다
 *   · 업체명(다섯째 칸)은 카드 첫 줄 — order 로 앞세운다. «보는 번호»(№)는 왼쪽 끝에 남는다
 *   · 「등록된 데이터가 없습니다」(colSpan 한 칸)는 카드 규칙에서 뺀다
 *   · 위쪽 `.dt td { padding … !important }` 와 같은 세기이므로 카드의 여백·글씨 규칙에도 !important 가 있다
 *   ⚠ 칸 위치(nth-child)가 열 순서에 묶여 있다 — 열을 늘리거나 순서를 바꾸면 이 검사가 걸린다
 *
 * 실행: node --test tests/erp-phone-income-list.test.js
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n/g, '\n');
const HTML = read('pu-erp.html');
const CSS = read('css/pu-erp.css').replace(/\/\*[\s\S]*?\*\//g, ' ');

/* 폭 640px 이하 @media 덩어리 안만 */
function phoneBlocks(css) {
  let out = '';
  const re = /@media\s*\(\s*max-width\s*:\s*(\d+)px\s*\)\s*\{/g;
  let m;
  while ((m = re.exec(css))) {
    let d = 1, j = re.lastIndex;
    for (; j < css.length && d; j++) { if (css[j] === '{') d++; else if (css[j] === '}') d--; }
    if (+m[1] <= 640) out += css.slice(re.lastIndex, j - 1) + '\n';
    re.lastIndex = j;
  }
  return out;
}
const PHONE = phoneBlocks(CSS);
const rule = (css, sel) => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .filter((r) => r[1].split(',').some((s) => s.trim().replace(/\s+/g, ' ') === sel)).map((r) => r[2]).join(';');

test('① 입금 리스트 표에 .inc-tb 이름이 붙어 있다 (IncomeListTab)', () => {
  const a = HTML.indexOf('function IncomeListTab(){');
  const b = HTML.indexOf('// ── 업체입금 탭 ──');
  assert.ok(a > 0 && b > a, 'IncomeListTab 를 못 찾았습니다 — 이 검사의 찾는 법을 고쳐 주세요');
  assert.match(HTML.slice(a, b), /h\('table',\s*\{\s*className:\s*'dt inc-tb'/, '입금 리스트 표에 inc-tb 이름이 없습니다 — 폰 카드 규칙이 먹지 않고 표가 옆으로 밀립니다');
});

test('② 폰 구간에서 줄(tr)이 카드가 되고, 넓은 화면은 그대로 표', () => {
  const tr = rule(PHONE, '.dt.inc-tb tbody tr');
  assert.match(tr, /display\s*:\s*(flex|grid)/, '폰 구간에 입금 리스트 줄을 카드(flex/grid)로 바꾸는 규칙이 없습니다');
  assert.match(rule(PHONE, '.dt.inc-tb tbody'), /display\s*:\s*block/, '표 짜임을 풀지 않아 tr 이 카드가 되지 못합니다');
  const top = CSS.replace(/@media\s*\([^)]*\)\s*\{(?:[^{}]|\{[^{}]*\})*\}/g, '');
  assert.ok(!/\.dt\.inc-tb/.test(top), '카드 규칙(.dt.inc-tb)이 폰 구간 «밖»에 있습니다 — PC 표가 깨집니다');
});

test('③ 머리줄은 정렬 줄로 남고(입금일·업체명·유형·입금액), 업체명은 카드 첫 줄', () => {
  assert.ok(!/\.dt\.inc-tb\s+thead\s*\{[^}]*display\s*:\s*none/.test(PHONE), '머리줄을 통째로 숨기면 폰에서 정렬·유형 깔때기를 쓸 수 없습니다');
  [2, 5, 6, 7].forEach((n) => assert.match(rule(PHONE, '.dt.inc-tb thead th:nth-child(' + n + ')'), /display\s*:\s*block/, n + '번째 머리 칸(정렬)이 폰에서 숨었습니다'));
  assert.match(rule(PHONE, '.dt.inc-tb tbody td:nth-child(5)'), /order\s*:\s*-1/, '업체명(다섯째 칸)이 카드 첫 줄로 올라오지 않습니다');
  /* «보는 번호» 는 왼쪽 끝 */
  assert.match(rule(PHONE, '.dt.inc-tb tbody td:nth-child(1)'), /position\s*:\s*absolute[^;]*;[^]*left\s*:\s*\d/, '번호(№)가 카드 왼쪽 끝에 붙어 있지 않습니다');
});

test('④ colSpan 한 줄(데이터 없음)은 카드 규칙에서 빠지고, 카드의 여백·글씨는 위쪽 !important 를 이긴다', () => {
  assert.match(rule(PHONE, '.dt.inc-tb tbody td[colspan]'), /display\s*:\s*block/, '「등록된 데이터가 없습니다」 줄이 카드 규칙에 말려듭니다');
  assert.match(rule(PHONE, '.dt.inc-tb tbody td'), /padding[^;]*!important/, '카드 칸 여백에 !important 가 없습니다 — 위쪽 .dt td 규칙에 져서 칸 간격이 돌아옵니다');
  assert.match(rule(PHONE, '.dt.inc-tb tbody td'), /font-size[^;]*!important/, '카드 칸 글씨에 !important 가 없습니다 — 위쪽 .dt td 규칙에 집니다');
  assert.match(HTML, /css\/pu-erp\.css\?v=\d+/, 'css/pu-erp.css 에 캐시 번호가 없습니다');
});
