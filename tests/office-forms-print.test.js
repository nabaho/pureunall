'use strict';
/* 계약서 양식 — 🖨 인쇄 · 옆 미리보기 · 큰 「찾아서 채우기」 (대표 2026-10-09) — 가짜 자료만
   ⓐ 빈 양식 인쇄 — 값 없이(오늘 날짜도 안 넣음) 채워 ＿＿＿ 밑줄, 보기 칸 머리와 아래 막대(고른 양식 한 번에) 둘 다
   ⓑ 채운 본 이름 — 원본이 .hwpx 여도 채운 본은 .hwp(미리보기 사본만 .hwpx) — 엔진이 확장자로 거절하지 않게
   ⓒ 인쇄는 촘촘히(dpr) · 엑셀은 건너뛰고 알린다 · 인쇄 틀에 값을 저장하지 않는다
   ⓓ 채우기 창 — 🖨 인쇄 단추, 「열어 보기」는 옆(넓은 화면)·닫기 단추는 다 그린 뒤
   ⓔ 「📝 찾아서 채우기」는 큰 주 단추 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { test } = require('node:test');
const R = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(R, f), 'utf8').replace(/\r\n/g, '\n');
const CF = read('js/pu-contract-forms.js');
const cut = (start) => { const a = CF.indexOf(start); assert.ok(a >= 0, start); const b = CF.indexOf('\n  }\n', a); return CF.slice(a, b); };
const cutIn = (start) => { const a = CF.indexOf(start); assert.ok(a >= 0, start); const b = CF.indexOf('\n    }\n', a); return CF.slice(a, b); };

test('ⓐ 빈 양식 인쇄 — 값 없이, 두 자리', () => {
  const pb = cutIn('    function printBlank(');
  assert.match(pb, /printForms\(fms, \{\}, host,/, '빈 값으로 채운다(오늘 날짜도 넣지 않는다)');
  assert.match(cut('    function toolbar('), /printBlank\((?:withPower\()?\[fm\]\)/);
  assert.match(cut('    function drawBar('), /printBlank\((?:withPower\()?checkedForms\(\)\)/);
});

test('ⓑ 채운 본 이름 — .hwp / 미리보기 사본 .hwpx', () => {
  const f = cut('  function fillForPrint(');
  assert.match(f, /\(r\.preview \? '\.hwpx' : '\.hwp'\)/);
  assert.match(f, /isXlsxName\(src\.name\)\) return Promise\.resolve\(\{ xlsx: true/);
});

test('ⓒ 촘촘히 · 엑셀 알림 · 저장 없음', () => {
  assert.match(cut('  function pagesOf('), /renderPreview\(box, doc\.bytes, doc\.name, \{ dpr: opt\.dpr \|\| 2\.5 \}\)/, '인쇄는 기본 2.5배(서명 요청 그림만 가볍게)');
  assert.match(read('js/pu-hwp-engine.js'), /\(extra && extra\.dpr\) \|\| global\.devicePixelRatio/);
  assert.match(cut('  function printNote('), /엑셀로 열어 인쇄/);
  const pp = cut('  function printPages(');
  assert.doesNotMatch(pp, /localStorage|\.ref\(|\.set\(|\.push\(/);
  assert.match(pp, /@page land\{size:A4 landscape/);
});

test('ⓓ 채우기 창 — 인쇄 · 옆 미리보기', () => {
  const m = cut('  function openFill(');
  assert.match(m, /text: one \? '🖨 인쇄' : '🖨 ' \+ items\.length \+ '개 한 번에 인쇄', onclick: doPrint/);
  assert.match(m, /m\.classList\.add\('side'\)/);
  assert.match(m, /\.then\(prevClose\)/, '엔진이 칸을 비우므로 닫기는 다 그린 뒤');
  assert.match(CF, /@media\(min-width:1100px\)\{\.pcf-m\.side\{/, '좁은 화면은 아래 그대로');
});

test('ⓔ 큰 주 단추', () => {
  assert.match(cut('    function toolbar('), /'class': 'pcf-fillbig'[^)]*text: '📝 찾아서 채우기'/);
  assert.match(CF, /\.pcf-fillbig\{[^}]*font-size:14\.5px/);
});
