'use strict';
/* 푸른 메일 «쓰기» — 폰 (대표 지시 2026-10-26 「메일함 UI 너무 이상하다 깔끔하게 … 셀픽도 좀 저장해라
   … 위로 올라가니까 틀 고정 안 돼 있어서 다 안 보인다」)

   ★ 못 박는 것 — 규칙 (폰 구간 #mmBody 에서만, PC #pcMail 은 그대로)
     ① 보내기 줄은 틀 고정 — 머리칸 겹을 풀어(display:contents) 쓰기 화면 «전체»에서 붙고,
        위의 「‹ 목록」 줄(.mmbar) «밑»에 붙는다(덮지 않는다). 바탕을 칠한다.
     ② 받는사람 「누구인지」는 입력칸 아랫줄 — 입력칸을 짓눌러 빈 네모로 만들지 않는다
     ③ 찾기 목록은 줄을 꺾지 않는다 — 이름·회사가 한 글자씩 세로로 서지 않는다
     ④ 이름표(보내는사람)는 한 줄
     ⑤ 글꼴·크기는 기억하고, 기억한 값은 «실제로» 켠다(보여만 주면 거짓말) */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { cutFn } = require('./cut-fn');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8');
/* 폰 메일 구간 — 「⑥ 메일 쓰기」 덩이 */
const at = SRC.indexOf('/* ⑥ 메일 쓰기');
assert.ok(at > 0, '폰 메일 쓰기 CSS 덩이를 못 찾았습니다');
const media = SRC.lastIndexOf('@media', at);
assert.match(SRC.slice(media, media + 30), /@media\s*\(max-width:\s*7\d\dpx\)/, '⑥ 덩이가 폰 구간 안이 아닙니다');
const CSS = SRC.slice(at, SRC.indexOf('body.matview #tabs', at));
const rule = (sel) => {
  const i = CSS.indexOf(sel + '{');
  assert.ok(i >= 0, sel + ' 규칙이 없습니다');
  return CSS.slice(i, CSS.indexOf('}', i));
};

test('①★★ 보내기 줄은 틀 고정 — 쓰기 화면 전체에서, 「‹ 목록」 줄 밑에', () => {
  assert.match(rule('#mmBody .cphead'), /display:\s*contents/, '★ 머리칸 안에서만 붙어 첨부 칸이 끝나면 같이 올라갑니다');
  const r = rule('#mmBody .mtop');
  assert.match(r, /position:\s*sticky/, '★ 보내기 줄이 안 붙습니다');
  assert.match(r, /top:\s*var\(--mmbarH/, '★ 「‹ 목록」 줄을 덮습니다 — 그 높이만큼 밑에 붙어야 합니다');
  assert.match(r, /background:\s*#[0-9a-f]{3,6}/i, '바탕이 투명하면 본문이 비칩니다');
  const fn = cutFn(SRC, 'function renderMailMobile(');
  assert.match(fn, /setProperty\('--mmbarH'/, '「‹ 목록」 줄 높이를 안 잽니다');
  assert.match(rule('#mmBody .mtop .setback,#mmBody .mtop .mauto'), /display:\s*none/, '바로 위 「‹ 목록」과 같은 「← 목록으로」가 남았습니다');
});

test('②★ 받는사람 「누구인지」는 입력칸 아랫줄', () => {
  const r = rule('#mmBody .cptowho');
  assert.match(r, /flex:\s*1 0 100%/, '★ 「누구인지」가 입력칸 옆에서 자리를 먹어 입력칸이 빈 네모가 됩니다');
  assert.match(CSS, /:has\(>\.cptowho\)\{flex-wrap:wrap\}/, '줄이 안 바뀌어 아랫줄로 못 내려갑니다');
});

test('③★ 찾기 목록은 줄을 꺾지 않는다 — 아이콘은 이름과 한 덩이', () => {
  assert.match(rule('#mmBody .cpsi>*'), /white-space:\s*nowrap/, '★ 이름·회사가 한 글자씩 세로로 섭니다');
  assert.match(rule('#mmBody .cpsi>*'), /text-overflow:\s*ellipsis/);
  /* 👤 가 따로 떨어진 글자면 격자의 한 칸을 먹어 줄이 어긋난다 */
  assert.match(SRC, /<div class="cpsi[^>]*>\s*<b>👤 \$\{esc\(it\.name/, '👤 가 이름 밖에 따로 있습니다');
});

test('④ 이름표는 한 줄', () => {
  assert.match(rule('#mmBody .cpk'), /white-space:\s*nowrap/, '「보내는 / 사람」 처럼 두 줄로 꺾입니다');
});

test('⑤★ 글꼴·크기는 기억하고, 본문을 처음 누를 때 실제로 켠다', () => {
  assert.match(SRC, /onchange="edKeepSet\('font',this\.value\);edCmd\('fontName',this\.value\)"/, '글꼴을 기억하지 않습니다');
  assert.match(SRC, /onchange="edKeepSet\('pt',this\.value\);edFontSize\(this\.value\)"/, '크기를 기억하지 않습니다');
  assert.match(SRC, /f===edKeep\('font'\)\?'selected'/, '기억한 글꼴로 상자를 열지 않습니다');
  assert.match(SRC, /n===edKeep\('pt'\)\?'selected'/, '기억한 크기로 상자를 열지 않습니다');
  assert.match(SRC, /id="cpBody" class="cpbody" contenteditable="true"[\s\S]{0,200}onfocus="edKeepApply\(\)"/, '★ 기억한 값을 보여만 주고 켜지 않습니다');
  const ap = cutFn(SRC, 'function edKeepApply(');
  assert.match(ap, /_compose\._edKeep/, '편지마다 한 번만이어야 합니다 — 누를 때마다 켜면 고친 서식을 덮습니다');
  assert.match(ap, /edCmd\('fontName'/); assert.match(ap, /edFontSize\(/);
});
