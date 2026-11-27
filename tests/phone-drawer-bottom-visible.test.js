'use strict';
/* 폰 왼쪽 메뉴(서랍)의 «맨 아래 줄 — ⚙ 환경설정»이 화면 밖으로 밀리지 않는다 (2026-11-22)
   대표 폰(크롬 맞춤 탭)에서 서랍이 100vh 라 아래가 잘려 환경설정 줄이 «아예 안 보였다».
   값이 아니라 규칙을 본다 — 폰 구간의 서랍 높이가 dvh 를 쓰고, 그 앞에 dvh 를 모르는 브라우저용 줄이 있다. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const CSS = fs.readFileSync(path.join(__dirname, '..', 'css', 'pu-erp.css'), 'utf8');
const ERP = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8');

test('폰 서랍(.sb) 높이: 보이는 높이(dvh)를 쓰고 vh 는 대비용으로 앞에만 둔다', () => {
  const media = CSS.slice(CSS.indexOf('@media (max-width: 768px)'));
  const rule = media.match(/\n\s*\.sb \{[^}]*\}/);
  assert.ok(rule, '폰 구간에서 .sb 규칙을 못 찾았다');
  const body = rule[0];
  assert.match(body, /height:\s*100vh;\s*height:\s*100dvh/, '★ 서랍 높이가 dvh 가 아니다 — 맞춤 탭에서 아래 줄이 잘린다');
});

test('서랍 바닥 줄(환경설정)은 늘 그려지고 맨 아래에 붙는다', () => {
  const at = ERP.indexOf("메뉴 바닥 고정: 옵시디언 업무요약 · 환경설정");
  assert.ok(at > 0);
  const seg = ERP.slice(at, at + 1800);
  assert.match(seg, /marginTop:'auto', flexShrink:0/, '바닥 줄이 줄어들거나 위로 올라갔다');
  assert.match(seg, /onSelect\('env\/settings'\)/, '환경설정 줄이 사라졌다');
});
