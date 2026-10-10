'use strict';
/* 노무사 기수 — 강사카드 「기수 ※노무사만 기입」 (대표 지시 2026-10-10 「노무사 19기」)
   규칙: 담는 칸 · 알아보는 말 · 내보내는 값 · 손으로 짚는 목록 «네 곳»이 짝이다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');
const FILL = fs.readFileSync(path.join(__dirname, '..', 'js', 'kcareer-hwpxfill.js'), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('기수 칸이 네 곳에 짝으로 있다', () => {
  const h = strip(HTML), f = strip(FILL);
  assert.ok(/\['licenseGen','노무사 기수'\]/.test(h), '환경설정 담는 칸');
  assert.ok(/RH_KEYS\s*=\s*\[[\s\S]*?\['licenseGen','노무사 기수'\]/.test(h), '손으로 짚는 목록');
  assert.ok(/licenseGen:info\.licenseGen\|\|''/.test(h), '내보내는 값');
  assert.ok(/key:\s*'licenseGen'/.test(f) && /FIELD_FILL_KEYS\s*=\s*\[[\s\S]*?'licenseGen'/.test(f), '알아보는 말 + 채울 수 있는 열쇠');
});

test('「기수」 라벨이 licenseGen 으로 읽힌다', () => {
  const m = strip(FILL).match(/\{ re: (\/\^\(기수[^\n]*?\$\/), key: 'licenseGen' \}/);
  assert.ok(m, '라벨 규칙');
  const re = eval(m[1]);
  assert.ok(re.test('기수') && re.test('노무사기수'));
  assert.ok(!re.test('성명'));
});
