/* 회차 머리 «폴더 탭» — 두 줄이 각자 제 줄에 다 들어간다 (대표 지시 2026-09-27)
   ═══════════════════════════════════════════════════════════════════════════
   「추천대로 하되 아래줄로 내려오게 말고 각자 자기줄에 내용이 모두 들어갈수 있게 정렬해라」

   ■ 무엇이 문제였나
     단추가 넘쳐 머리가 «네 줄»로 접혔다 — 보내기 둘·명절 인사·연습용 샘플이 아랫줄로
     떨어졌다. 색도 넷(갈색·옅은 갈색·주황·회색)이 섞여 있었다.

   ■ 이 검사가 지키는 «규칙» (값이 아니다 — CLAUDE.md 「지금 값이 아니라 규칙」)
     ① 두 줄 모두 «안 접힌다» (폰만 예외 — 375px 에 두 줄은 안 들어간다)
     ② 자리가 모자라면 «글을 줄인다» — 걷을 수 있는 조각마다 걷는 규칙이 «있다»
     ③ 걷은 글은 사라지지 않는다 — 그 손잡이의 title 에 남는다
     ④ 가로 굴림으로 풀지 않는다 — ⓘ 풀이가 굴림 상자 안에서 잘린다
     ⑤ 긴 말(확정본 상태)은 단추 대신 title 로 — 짧은 말이 «모든» 경우에 있다
     ⑥ 「0」은 안 그린다 — 건수 알약은 건수가 있을 때만
     ⑦ 잘 안 쓰는 두 길(연습용 샘플·그대로 전달)이 넓은 화면에도 폰에도 «있다»

   ⚠ 문턱 px 는 못 박지 않는다 — 머리만 떼어 실제 코드로 그려 «재서» 정한 값이라
     단추가 늘면 다시 재야 한다(pu-news.html 주석에 잰 값을 적어 두었다). */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { 주석걷기, 함수몸 } = require('./helpers/strip-comments.js');

const 원문 = fs.readFileSync(path.join(__dirname, '..', 'pu-news.html'), 'utf8');
const 화면 = 주석걷기(원문);
/* 머리 <style> 만 — CSS 주석을 걷고 줄바꿈을 눌러 한 줄로 */
const 꾸밈 = (원문.slice(0, 원문.indexOf('</head>')).match(/<style>[\s\S]*?<\/style>/g) || [])
  .join('\n').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s*\r?\n\s*/g, '');
const 이번 = 함수몸(화면, '이번회차화면');
/* 머리 덩이의 틀 — 여는 자리부터 「/nowtop」 표까지 (걷개는 HTML 주석을 안 걷는다 — 여기서 걷는다) */
const 덩이 = (function () {
  const i = 이번.indexOf('<div class="nowtop">');
  const j = 이번.indexOf('<!-- /nowtop', i);
  assert.ok(i > 0 && j > i, '머리 덩이(nowtop)를 못 찾았다');
  return 이번.slice(i, j).replace(/<!--[\s\S]*?-->/g, '');
})();

/* @media / @container 블록을 «바깥 규칙»과 가른다 */
function 블록들(css, 머리) {
  const 나온 = [];
  let i = 0;
  while ((i = css.indexOf(머리, i)) >= 0) {
    const 열 = css.indexOf('{', i);
    let 깊이 = 1, k = 열 + 1;
    for (; k < css.length && 깊이; k++) { if (css[k] === '{') 깊이++; else if (css[k] === '}') 깊이--; }
    나온.push({ 조건: css.slice(i + 머리.length, 열).trim(), 몸: css.slice(열 + 1, k - 1), 끝: k });
    i = k;
  }
  return 나온;
}
/* 어느 @media 에도 안 든 규칙 — 넓은 화면의 «기본» 모양 (안에 든 @container 도 함께 빠진다) */
function 바깥만(css) {
  let 밖 = '', 자리 = 0;
  블록들(css, '@media').forEach(function (b) {
    밖 += css.slice(자리, css.indexOf('@media', 자리));
    자리 = b.끝;
  });
  return 밖 + css.slice(자리);
}
const 밖규칙 = 바깥만(꾸밈);
const 폰 = 블록들(꾸밈, '@media').filter((b) => /max-width:\s*5\d\dpx/.test(b.조건)).map((b) => b.몸).join('');
const 줄임 = 블록들(꾸밈, '@container').filter((b) => /nowtop/.test(b.조건)).map((b) => b.몸).join('');

test('★★★ 두 줄 모두 «안 접힌다» — 넓은 화면에서 아랫줄로 떨어지지 않는다', () => {
  assert.match(밖규칙, /\.nowtop \.hdbar\{[^}]*flex-wrap:\s*nowrap/,
    '★★★ 회차 줄이 접힌다 — 보내기 단추가 아랫줄로 떨어진다(대표 화면 2026-09-27)');
  assert.match(밖규칙, /\.nowtop \.ways\{[^}]*flex-wrap:\s*nowrap/,
    '★★★ 담는 법 탭줄이 접힌다 — 명절 인사·연습용 샘플이 아랫줄로 떨어진다');
  /* 알맹이가 줄어들어 글자가 겹치지 않게 — 제 폭을 지킨다 */
  assert.match(밖규칙, /\.nowtop \.hdbar>\*\{[^}]*flex:\s*0 0 auto/, '회차 줄 알맹이가 짜부라진다');
  assert.match(밖규칙, /\.nowtop \.ways>\*\{[^}]*flex:\s*0 0 auto/, '탭 알맹이가 짜부라진다');
});

test('★★ 폰에서만은 «접는다» — 375px 에 두 줄은 안 들어간다', () => {
  assert.ok(폰, '폰 규칙(max-width:5xxpx)을 못 찾았다');
  assert.match(폰, /\.nowtop \.hdbar,\s*\.nowtop \.ways\{[^}]*flex-wrap:\s*wrap/,
    '★★ 폰에서도 안 접힌다 — 보내기 단추가 화면 밖으로 밀려 나가 못 누른다');
});

test('★★ 자리가 모자라면 «글을 줄인다» — 걷을 조각마다 걷는 규칙이 있다', () => {
  assert.match(꾸밈, /\.nowtop\{[^}]*container:\s*nowtop\s*\/\s*inline-size/,
    '★★ 덩이 폭을 재는 그릇(container)이 없다 — 창 폭으로 재면 두 칸 화면에서 넘친다');
  const 조각 = Array.from(new Set((덩이.match(/class="(lng|ful|yr|t|t2|ic)"/g) || [])
    .map((s) => s.slice(7, -1))));
  assert.ok(조각.length >= 3, '걷을 조각이 거의 없다 — 모자라면 넘칠 수밖에 없다');
  조각.forEach(function (c) {
    const 규칙 = new RegExp('\\.' + c + '(?![\\w-])[^{]*\\{[^}]*display:\\s*none');
    assert.match(줄임, 규칙, '★★ .' + c + ' 를 걷는 규칙이 없다 — 좁아지면 그 줄이 넘친다');
  });
  /* 폰에서는 글을 안 걷는다 — 아이콘만 남은 단추는 손가락으로 무엇인지 모른다 */
  assert.match(꾸밈, /@media\(min-width:5\d\dpx\)\{@container nowtop/,
    '줄이기가 폰에도 걸린다 — 폰은 두 줄이라 넉넉하고, 글이 있어야 누를 수 있다');
});

test('★★ 걷은 글은 사라지지 않는다 — 그 손잡이의 title 에 남는다', () => {
  /* 걷히는 조각을 품은 단추·링크마다 title 이 있어야 한다 */
  const 손잡이 = 덩이.match(/<(button|a)\b[^>]*>[\s\S]*?<\/\1>/g) || [];
  const 걷히는 = 손잡이.filter((h) => /class="(ful|t|t2|ic)"/.test(h));
  assert.ok(걷히는.length >= 5, '걷히는 손잡이를 못 찾았다 — 검사가 헛돈다');
  걷히는.forEach(function (h) {
    /* 보내기 단추는 «곳 수»가 남아 뜻이 산다 — 그 밖은 title 이 있어야 한다 */
    if (/진짜보내기\(\)/.test(h)) return;
    assert.match(h, /\stitle="/, '★★ 글이 걷히면 무엇인지 알 길이 없다: ' + h.slice(0, 80));
  });
  /* 가장 좁을 때 걷는 「실린 것」은 회차 이름의 title 에 남는다 */
  assert.match(덩이, /class="no" title="[^"]*실린 것/, '★ 「실린 것」이 걷히면 어디에도 없다');
});

test('★ 가로 굴림으로 풀지 않는다 — ⓘ 풀이가 굴림 상자 안에서 잘린다', () => {
  assert.ok(!/\.nowtop \.(hdbar|ways)\{[^}]*overflow(-x)?:\s*(auto|scroll|hidden)/.test(꾸밈),
    '★ 머리 줄에 굴림을 걸었다 — ⓘ 풀이(.tip)가 잘려 안 보이고, 굴릴 수 있다는 것도 안 보인다');
});

test('★★ 확정본 상태의 긴 말은 title 로 — 짧은 말이 «모든» 경우에 있다', () => {
  const 몸 = 함수몸(화면, '예약본상태');
  assert.ok(몸, '예약본상태 를 못 찾았다');
  const 짐 = vm.createContext({ App: {}, esc: String, Core: { 바탕도장: () => '도장' } });
  vm.runInContext(몸, 짐);
  const 판들 = [
    null,
    { 상태: '어긋남', 오류: '바뀜' },
    { 상태: '보냄' },
    { 상태: '준비', 회차열쇠: '다른회차' },
    { 상태: '준비', 회차열쇠: 'k', 바탕도장: '도장', 보낼날: '2026-10-05' },
    { 상태: '준비', 회차열쇠: 'k', 바탕도장: '옛도장', 보낼날: '2026-10-05' }
  ];
  판들.forEach(function (r) {
    짐.App.예약본 = r;
    const s = vm.runInContext('예약본상태({ 열쇠: "k" })', 짐);
    assert.ok(s.짧은, '★★ 짧은 말이 없다 — 긴 말이 단추에 서서 머리가 넘친다: ' + JSON.stringify(r));
    assert.ok(s.짧은.length < s.글.length || s.짧은 === s.글, '짧은 말이 더 길다: ' + s.짧은);
  });
  /* 단추는 짧은 말을 쓰고, 긴 말은 title 로 간다 */
  const i = 덩이.indexOf('onclick="자동발송준비()"');
  const 단추 = 덩이.slice(i, 덩이.indexOf('</button>', i));
  assert.match(단추, /예약\.짧은/, '★★ 단추가 긴 말을 그대로 쓴다');
  assert.match(단추, /title="\$\{esc\(예약\.글/, '★ 긴 말이 title 에도 없다 — 무슨 상태인지 알 길이 없다');
});

test('★ 「0」은 안 그린다 — 건수 알약은 건수가 있을 때만 (CLAUDE.md 「한 칸은 한 줄」)', () => {
  const 알약 = 덩이.match(/<span class="cnt">/g) || [];
  assert.ok(알약.length >= 2, '건수 알약을 못 찾았다 — 검사가 헛돈다');
  /* 알약은 모두 «? ' <span class="cnt">' … : ''» 꼴 안에서만 난다 */
  const 조건부 = 덩이.match(/\?\s*' <span class="cnt">'/g) || [];
  assert.strictEqual(조건부.length, 알약.length,
    '★ 건수가 0 이어도 알약을 그리는 자리가 있다 — 「0」은 아무것도 안 알려 주면서 자리만 먹는다');
});

test('★★ 잘 안 쓰는 두 길(연습용 샘플·그대로 전달)이 «있다» — 넓은 화면에도 폰에도', () => {
  assert.match(덩이, /onclick="연습채우기\(\)"/, '★★ 연습용 샘플로 갈 길이 없어졌다');
  assert.match(덩이, /onclick="길바꾸기\('fwd'\)"/, '★★ 그대로 전달로 갈 길이 없어졌다');
  /* ⚠ 옛 폰 규칙 「.ways .tail{display:none}」 이 두 길을 폰에서 통째로 감춘다 — 되살려야 한다 */
  if (/\.ways \.tail\{display:\s*none/.test(폰)) {
    assert.match(폰, /\.nowtop \.ways \.tail\{display:\s*inline/,
      '★★ 폰에서 연습용 샘플·그대로 전달이 사라진다(removing-a-path)');
  }
});

test('★ 담는 법 탭은 «누른 것만» 갈색이다 — 색을 하나로', () => {
  /* 예전에는 노무사회 단추만 옅은 갈색 바탕을 따로 칠해, 색이 넷 섞였다 */
  const 탭 = 덩이.match(/<button class="wt[^"]*"[^>]*>/g) || [];
  assert.ok(탭.length >= 5, '담는 법 탭을 못 찾았다');
  탭.forEach(function (b) {
    assert.ok(!/style="/.test(b), '★ 탭 하나에 따로 색을 칠했다: ' + b.slice(0, 70));
  });
  assert.match(밖규칙, /\.nowtop \.wt\.on\{[^}]*var\(--brown\)/, '누른 탭이 갈색이 아니다');
});
