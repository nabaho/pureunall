'use strict';
/* 프로필 1장 — 한 화면에 한 장이 다 보이고, 크게도 볼 수 있다 (대표 지적 2026-10-11 「글자가 안 보인다 · 위아래 이동」)
   규칙만 못 박는다: 높이에 맞추는 갈래가 있고 · 폭 맞춤 · 전체 화면 길이 있고 · 서류 크기(A4)는 그대로. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
function 떼기(머리) {
  const i = SRC.indexOf(머리); assert.ok(i > 0, 머리);
  let d = 0, s = false;
  for (let p = i; p < SRC.length; p++) { if (SRC[p] === '{') { d++; s = true; } else if (SRC[p] === '}') { d--; if (s && !d) return SRC.slice(i, p + 1); } }
}
test('한 화면 맞춤은 «높이»를 본다 — 가로만 보면 위아래로 움직여야 한다', () => {
  const f = strip(떼기('function _p1Scale('));
  assert.ok(/innerHeight/.test(f) && /1123/.test(f), '창 높이로 줄임비를 잰다');
  assert.ok(/Math\.min\([^)]*availH\/1123/.test(f), '한 화면 갈래는 높이 한도를 min 에 넣는다');
});
test('폭 맞춤 · 전체 화면 길이 있고, 서류 크기는 그대로(A4 794×1123)', () => {
  assert.ok(/function p1Zoom\(/.test(SRC) && /function p1Full\(/.test(SRC), '보는 크기 바꾸기');
  assert.ok(/requestFullscreen/.test(strip(떼기('function p1Full('))), '전체 화면');
  assert.ok(/fullscreenchange/.test(SRC), '전체 화면에서 나오면 다시 맞춤');
  assert.ok(/width:794px;height:1123px/.test(SRC), '서류(인쇄·저장) 크기는 그대로');
  assert.ok(/id="p1Zoom"/.test(SRC), '단추 자리');
});
