'use strict';
/* 포털 — 폰에서 양옆 빈자리를 줄인다 (대표 지시 2026-10-18 「양옆 빈공백 … 좌우 옆공간 모두 채워서」)
   겉 여백(.wrap 양옆)이 머리 카드·타일 줄 양옆을 늘 비워 두었다.
   ★ 지키는 것 — px 값이 아니라 «폰 구간의 포털 겉 여백이 기본(넓은 화면) 겉 여백보다 작은가»와
     «로그인 화면은 안 건드리는가»(포털 화면에서만)다.
   실행: node --test tests/portal-phone-edge.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const css = fs.readFileSync(path.join(__dirname, '..', 'enter.html'), 'utf8').replace(/\r\n/g, '\n').replace(/\/\*[\s\S]*?\*\//g, ' ');

function 겉여백(body) {
  const l = /padding-left\s*:\s*(\d+(?:\.\d+)?)px/.exec(body);
  if (l) return Number(l[1]);
  const p = /padding\s*:\s*([^;}]+)/.exec(body);
  if (!p) return null;
  const v = p[1].trim().split(/\s+/).map((x) => parseFloat(x));
  return v.length === 1 ? v[0] : v[1];
}

test('폰 구간의 포털 겉 여백은 기본 겉 여백보다 작다', () => {
  const 기본 = /(^|\n)\.wrap\s*\{([^}]*)\}/.exec(css);
  assert.ok(기본, '포털 .wrap 기본 규칙을 못 찾았습니다');
  const 넓은화면 = 겉여백(기본[2]);
  assert.ok(넓은화면 > 0, '기본 겉 여백을 못 읽었습니다');
  /* 폰 구간(max-width ≤ 640px) 안의 포털 화면 겉 여백 */
  const 폰 = [...css.matchAll(/@media\s*\(max-width\s*:\s*(\d+)px\)\s*\{\s*body\.portal-mode \.wrap\s*\{([^}]*)\}/g)]
    .filter((m) => Number(m[1]) <= 640).map((m) => 겉여백(m[2])).filter((v) => v != null);
  assert.ok(폰.length >= 1, '폰에서 포털 겉 여백을 줄이는 규칙이 없습니다 — 양옆이 늘 비어 있습니다');
  assert.ok(Math.min(...폰) < 넓은화면, '폰 겉 여백(' + Math.min(...폰) + 'px)이 넓은 화면(' + 넓은화면 + 'px)보다 작지 않습니다');
});

test('로그인 화면 겉 여백은 그대로 — 포털(타일) 화면에서만 줄인다', () => {
  const 전부 = [...css.matchAll(/@media\s*\(max-width\s*:\s*\d+px\)\s*\{\s*([^{]*)\{[^}]*padding-left/g)].map((m) => m[1].trim());
  for (const sel of 전부.filter((s) => /\.wrap\b/.test(s))) {
    assert.match(sel, /body\.portal-mode/, '포털 화면이 아닌 곳의 .wrap 겉 여백까지 줄였습니다: ' + sel);
  }
});
