'use strict';
/* 거래·분개입력 — 아주 넓은 화면에서 결산·재무제표를 오른쪽에 붙박이로 (2026-10-11, 대표 「b」= 목업 안 B). 이름은 전부 가짜. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8').replace(/\r\n/g, '\n');
const fnSrc = (n) => { const i = SRC.indexOf('function ' + n + '('); assert.ok(i >= 0, '없음 ' + n); let d = 0;
  for (let k = SRC.indexOf('{', i); k < SRC.length; k++) { if (SRC[k] === '{') d++; else if (SRC[k] === '}') { d--; if (!d) return SRC.slice(i, k + 1); } } };

test('★ 판 나누기 — 거래표 판 · 결산 판(붙박이) · 아래 판(시산표·전기이월), 승인 거래가 없으면 결산 판 없음', () => {
  const b = fnSrc('closeBodyHTML');
  assert.ok(b.includes("var _fp=finPanel(arr);") && b.includes("_fp.indexOf('closeside')>=0?' hasside'"), '결산 판이 있을 때만 좌우로 나눈다');
  assert.ok(b.includes('<div class="panel closemain">'), '거래표 판에 closemain 이 없다');
  assert.ok(b.includes("+_fp+'</div>'"), '결산 판을 묶음 안에 안 넣는다');
  const f = fnSrc('finPanel');
  assert.ok(f.includes('<div class="panel closeside">'), '결산 판에 closeside 가 없다');
  assert.ok(f.includes('<div class="panel closerest"><details>'), '시산표·전기이월이 아래 판으로 안 갈렸다');
  assert.ok(f.includes("if(!f.appr) return '<div class=\"panel closerest\">"), '승인 거래가 없는데 결산 판을 만든다');
  assert.ok(f.includes('미승인 \'+_un+\'건은 아직 이 숫자에 들어 있지 않습니다'), '미승인이 빠졌다는 안내가 없다');
  /* 전기이월 입력은 그대로 아래 판에 — 저장 방식은 안 바뀌었다 */
  assert.ok(f.includes("+openingHtml+'</div>';") && f.includes('saveOpening()'), '전기이월 입력·저장이 사라졌다');
});

test('★ 넓은 화면만 — 좁으면 예전처럼 쌓이고, 붙박이는 머리 높이 아래에 붙으며 따로 스크롤, 거래표 폭을 줄인다', () => {
  const a = SRC.indexOf('@media(min-width:1850px){'); assert.ok(a >= 0, '넓은 화면 규칙이 없다');
  const css = SRC.slice(a, SRC.indexOf('\n  }\n', a));
  assert.ok(/\.closesplit\.hasside\{display:grid;grid-template-columns:minmax\(0,1fr\) 420px/.test(css), '좌우로 안 나눈다');
  assert.ok(css.includes('.closesplit.hasside>.closeside{') && css.includes('position:sticky') && css.includes('var(--closehead-h,156px)') && css.includes('overflow:auto'), '붙박이가 아니다');
  assert.ok(css.includes('.closerest{grid-column:1 / -1'), '아래 판이 전체 폭이 아니다');
  assert.ok(css.includes('.closemain select{width:130px}') && css.includes('white-space:normal!important'), '거래표 폭을 안 줄인다 — 결산 판 밑으로 삐져나간다');
  /* 규칙이 다른 화면 폭에 새면 안 된다 — 좌우 나눔은 이 미디어 안에만 */
  assert.equal((SRC.match(/\.closesplit\.hasside\{display:grid/g) || []).length, 1);
  assert.ok(!/\n\s*\.closesplit\.hasside\{display:grid/.test(SRC.slice(0, a)), '넓은 화면 밖에도 좌우 나눔이 걸린다');
});
