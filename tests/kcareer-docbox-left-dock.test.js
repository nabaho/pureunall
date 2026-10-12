'use strict';
/* 서류 보관함 — 탭·검색·단추는 «왼쪽 목록 칸 맨 위», 오른쪽 문서는 화면 맨 위에서 (대표 승인 2026-10-12 목업 ②)
   규칙만 못 박는다: 다시 그릴 때 지워지지 않게 «돌려놓고 → 그리고 → 얹는다» · 옮길 뿐 새로 만들지 않는다 · 미리보기는 맨 위에 붙는다. */
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
test('다시 그리기 전에 줄을 제자리로 돌려놓고, 그린 뒤에 목록 맨 위로 얹는다', () => {
  const r = strip(떼기('function renderDocStore('));
  const park = r.search(/_dsHeadPark/), set = r.search(/body\.innerHTML=`<div class="ds-split"/), dock = r.search(/_dsHeadDock\(domain\)/);
  assert.ok(park > 0 && set > park && dock > set, '돌려놓기 → 그리기 → 얹기 차례');
  assert.ok(/id="dsHead-\$\{domain\}"/.test(r), '목록 맨 위 자리(dsHead)');
});
test('옮길 뿐 새로 만들지 않는다 — 단추 이벤트·검색칸 값이 산다', () => {
  const a = strip(떼기('function _dsHeadPark(')), b = strip(떼기('function _dsHeadDock('));
  [a, b].forEach((f) => { assert.ok(/appendChild\(el\)/.test(f) && !/innerHTML|createElement|cloneNode/.test(f)); assert.ok(/db-tabrow/.test(f) && /dbTools/.test(f)); });
});
test('왼쪽 맨 위에 얹었을 때만 위 가로줄을 접고, 미리보기는 맨 위에 붙는다', () => {
  assert.ok(/#page-docbox\.ds-docked \.db-top\{display:none\}/.test(SRC));
  assert.ok(/#page-docbox\.ds-docked \.ds-prev\{top:0/.test(SRC));
  assert.ok(/classList\.add\('ds-docked'\)/.test(strip(떼기('function _dsHeadDock('))));
  assert.ok(/classList\.remove\('ds-docked'\)/.test(strip(떼기('function _dsHeadPark('))), '돌려놓으면 가로줄이 다시 보인다');
});
