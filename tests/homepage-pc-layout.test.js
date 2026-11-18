/* 홈페이지 PC 화면 — 업무 격자 · 머리띠 고정 · 브리핑 법령 열 (대표 지시 2026-11-18)
   「추천대로 캡쳐의 열을 일치시켜라」 · 「상단은 고정이 필요하다 그래야 다른 내용 찾는다」

   지키는 것
   ① 첫 화면 업무는 격자 카드이고, 카드마다 «있는 쪽»으로 간다(#자리까지 있으면 그 자리도 있다)
   ② 모든 쪽이 공용 꾸밈(assets/css/pu-site.css)을 «제 깊이에 맞는 주소»로 싣는다 — 머리띠 고정이 거기 있다
   ③ 공용 꾸밈이 테마의 .fixed 표시에 PC·폰 머리띠 고정 모양을 준다
   ④ 브리핑 법령은 PC 구간에서 격자(열)로 선다 */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const R = path.join(__dirname, '..');
const SITE = path.join(R, 'site');
const 있나 = fs.existsSync(path.join(SITE, 'index.html'));

function 쪽들() {
  const out = [];
  (function 훑기(dir) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) 훑기(p);
      else if (e.name === 'index.html') out.push(p);
    });
  })(SITE);
  return out;
}

test('① 첫 화면 업무는 격자 카드이고, 카드마다 있는 쪽·자리로 간다', { skip: !있나 }, () => {
  const h = fs.readFileSync(path.join(SITE, 'index.html'), 'utf8');
  assert.match(h, /class="pu_biz_grid"/, '★ 업무 격자가 없습니다');
  const 카드 = [...h.matchAll(/<a class="pu_biz_card" href="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(카드.length >= 8, '★ 업무 카드가 ' + 카드.length + '개뿐입니다 — PC 에서 업무를 더 보이자는 것이 이 격자의 뜻입니다');
  카드.forEach((주소) => {
    const [쪽, 자리] = 주소.split('#');
    const 파일 = path.join(SITE, 쪽, 'index.html');
    assert.ok(fs.existsSync(파일), '★ 카드가 없는 쪽으로 갑니다: ' + 주소);
    if (자리) {
      assert.ok(fs.readFileSync(파일, 'utf8').indexOf('id="' + 자리 + '"') >= 0, '★ 카드가 없는 자리로 갑니다: ' + 주소);
    }
  });
  [...h.matchAll(/class="pu_biz_img"><img src="([^"]+)"/g)].forEach((m) =>
    assert.ok(fs.existsSync(path.join(SITE, m[1])), '★ 카드 그림이 없습니다: ' + m[1]));
  assert.match(h, /pu_biz_grid\{[^}]*grid-template-columns/, '★ 격자 칸 나눔이 없습니다');
  assert.match(h, /@media \(max-width:\d+px\)\{\.pu_biz_grid\{grid-template-columns:1fr/, '★ 폰에서 한 줄 카드로 바뀌지 않습니다');
});

test('② 모든 쪽이 공용 꾸밈을 제 깊이에 맞는 주소로 싣는다', { skip: !있나 }, () => {
  const 목록 = 쪽들();
  assert.ok(목록.length >= 10, '쪽을 못 찾았습니다');
  목록.forEach((p) => {
    const 이름 = path.relative(SITE, p);
    const 깊이 = 이름.split(path.sep).length - 1;
    const 줄 = /<link[^>]+href="([^"]*assets\/css\/pu-site\.css)"/.exec(fs.readFileSync(p, 'utf8'));
    assert.ok(줄, '★ ' + 이름 + ' 이(가) 공용 꾸밈을 안 싣습니다 — 그 쪽만 머리띠가 안 붙습니다');
    assert.equal(줄[1], '../'.repeat(깊이) + 'assets/css/pu-site.css', '★ ' + 이름 + ' 의 꾸밈 주소 깊이가 틀립니다');
  });
  const 없는쪽 = fs.readFileSync(path.join(SITE, '404.html'), 'utf8');
  assert.match(없는쪽, /href="\/assets\/css\/pu-site\.css"/, '★ 404 쪽은 어느 주소에서 열려도 되게 뿌리 주소로 실어야 합니다');
});

test('③ 공용 꾸밈이 PC·폰 머리띠 고정 모양을 준다', { skip: !있나 }, () => {
  const css = fs.readFileSync(path.join(SITE, 'assets', 'css', 'pu-site.css'), 'utf8');
  assert.match(css, /\.header_wrap\.fixed[^{]*\{[^}]*position:fixed/, '★ PC 머리띠가 고정되지 않습니다');
  assert.match(css, /\.header_wrap\.fixed[^{]*\{[^}]*top:0/, '★ PC 머리띠가 맨 위에 붙지 않습니다');
  assert.match(css, /\.mobile_header_wrap\.fixed[^{]*\{[^}]*background/, '★ 폰 머리띠가 글 위에 투명하게 겹칩니다');
  /* 테마 스크립트가 실제로 .fixed 를 붙여야 이 꾸밈이 산다 */
  const 테마 = path.join(SITE, 'files', 'cache', 'assets', 'minified', 'layouts.laborpureun.layout.min.js');
  if (fs.existsSync(테마)) {
    const js = fs.readFileSync(테마, 'utf8');
    assert.match(js, /header_wrap[\s\S]{0,200}addClass\("fixed"\)/, '★ 테마가 .fixed 를 더는 안 붙입니다 — 고정 방식을 다시 보십시오');
  }
});

test('④ 브리핑 법령은 PC 구간에서 열(격자)로 선다', { skip: !있나 }, () => {
  const css = fs.readFileSync(path.join(SITE, 'assets', 'css', 'pu-brief.css'), 'utf8');
  const m = /@media \(min-width:\d+px\)\{([\s\S]*?)\n\}/.exec(css);
  assert.ok(m, '★ PC 구간 꾸밈이 없습니다');
  assert.match(m[1], /\.pb_law li\{[^}]*display:grid/, '★ 법령 줄이 격자가 아닙니다 — 딱지·원문 링크가 줄마다 들쭉날쭉합니다');
  assert.match(m[1], /\.pb_name em\{[^}]*grid-column:2/, '★ 종류·개정 딱지가 제 열에 서지 않습니다');
  assert.match(m[1], /\.pb_meta a\{[^}]*grid-column:3/, '★ 원문 링크가 제 열에 서지 않습니다');
});
