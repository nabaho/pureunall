'use strict';
/* 기금관리 — 폰 화면 다섯 군데 (폰화면관리 2026-10-18)

   무엇이 문제였나 (지어낸 기금 32개·참여사업장 28곳·거래 40줄, 360·411px 크로미움):
     ① 상단바가 넘쳐 「로그아웃」이 화면 밖으로 잘렸다(360) · 두 줄로 접혔다(411).
     ② 기금 머리 — 「공/동」 딱지가 세로로 쌓이고 「🔖 상태 👤 담당」이 화면 밖으로 잘렸다.
     ③ 고르는 알약(협력·사용자대표 없음…)이 «협/력» 처럼 두 줄로 접혔고, 사업장 찾기칸(박힌 폭)이 잘렸다.
     ④ 거래·분개입력 표 — 폰에서는 ☐·번호·일자·적요까지만 보이고 «금액»이 화면 밖이었다.
     ⑤ ★ 기금 현황 표 머리가 줄 «사이»(284px)에 떠서 셋째 기금을 가렸다 —
        폰에서 .panel 이 가로 스크롤 상자라 붙은 머리가 «그 상자» 기준으로 128px 내려가 앉았다.

   지키는 규칙 (px 값을 박지 않는다):
     ① 저장 알림은 점만(실패는 글씨까지) · 로그아웃은 한 줄
     ② 기금 머리는 두 줄로 접힌다(줄 바꿈 조각) · 이름은 넘치면 … · 딱지는 한 줄
     ③ 알약은 한 줄(넘치면 옆으로) · 찾기칸의 박힌 폭을 푼다
     ④ ★ 거래표는 두 줄 카드 — 금액이 «첫 줄»에 선다. CSS 가 기대는 칸 차례(5·6째 = 입금·출금)가 실제 머리와 맞다
     ⑤ ★ 표를 담은 상자는 폰에서 스크롤 상자를 풀고, :has 를 모르는 브라우저에서는 붙이기를 끈다
   실행: node --test tests/fund-phone-screens.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { cutFn } = require('./cut-fn');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8');
const STYLE = [...SRC.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');

function phoneRules(css, limit) {
  css = css.replace(/\/\*[\s\S]*?\*\//g, ' ');
  const out = [];
  const re = /@media([^{]*)\{/g;
  let m;
  while ((m = re.exec(css))) {
    const q = m[1];
    const w = (q.match(/max-width\s*:\s*(\d+)px/) || [])[1];
    if (!w || Number(w) > limit || /min-width/.test(q)) continue;
    let i = m.index + m[0].length, d = 1;
    const s = i;
    while (i < css.length && d > 0) { if (css[i] === '{') d++; else if (css[i] === '}') d--; i++; }
    const body = css.slice(s, i - 1);
    const r = /([^{}]+)\{([^{}]*)\}/g;
    let x;
    while ((x = r.exec(body))) out.push([x[1].trim(), x[2], Number(w)]);
  }
  return out;
}
function decl(rules, re) {
  return rules.filter(([sel]) => sel.split(',').some((one) => re.test(one.trim()))).map(([, d]) => d).join(';');
}
const P6 = phoneRules(STYLE, 600);
const P8 = phoneRules(STYLE, 860);

test('★① 상단바 — 저장 알림은 점만(실패는 글씨까지), 로그아웃은 한 줄', () => {
  assert.match(decl(P6, /^#saveState$/), /font-size\s*:\s*0/, '「저장 완료」 글씨가 상단바를 넘치게 한다');
  assert.doesNotMatch(decl(P6, /^#saveState\.failed$/), /font-size\s*:\s*0/, '실패 알림까지 점으로 줄이면 놓친다');
  assert.match(decl(P6, /^#saveState\.failed$/), /font-size\s*:\s*\d/, '실패일 때는 글씨를 되살려야 한다');
  assert.match(decl(P6, /^#logoutbtn$/), /white-space\s*:\s*nowrap/, '「로그/아웃」으로 접힌다');
});

test('★② 기금 머리 — 두 줄로 접히고, 이름은 넘치면 …, 딱지는 한 줄', () => {
  assert.match(decl(P6, /^\.fhead$/), /flex-wrap\s*:\s*wrap/, '한 줄에 우겨 넣으면 「공/동」이 세로로 쌓이고 상태·담당이 잘린다');
  assert.match(decl(P6, /^\.fhead::before$/), /flex-basis\s*:\s*100%/, '첫 줄과 둘째 줄을 가르는 조각이 없다');
  assert.match(decl(P6, /^\.fhead h1$/), /text-overflow\s*:\s*ellipsis/);
  assert.match(decl(P6, /^\.fhead \.tag$/), /white-space\s*:\s*nowrap/);
});

test('★③ 알약은 한 줄(넘치면 옆으로) · 사업장 찾기칸은 박힌 폭을 푼다', () => {
  assert.match(decl(P6, /^\.seg$/), /white-space\s*:\s*nowrap/, '알약이 「협/력」으로 접힌다');
  assert.match(decl(P6, /^\.segbar$/), /overflow-x\s*:\s*auto/);
  assert.match(SRC, /id="siteQ"[^>]*style="width:\d+px/, '찾기칸에 박힌 폭이 없어졌다면 이 검사와 @media 를 함께 고친다');
  assert.match(decl(P6, /^#siteQ$/), /width\s*:\s*auto\s*!important/, '줄마다 박힌 폭(style=)은 !important 가 있어야 풀린다');
});

test('★④ 거래표는 두 줄 카드 — 금액이 첫 줄에 서고, 기대는 칸 차례가 실제 머리와 맞다', () => {
  const chips = cutFn(SRC, 'function _ledChips(');
  assert.match(chips, /class="row ledchips"/, '거래표를 가리킬 손잡이(거르기 줄 이름표)가 없다');
  const body = cutFn(SRC, 'function closeBodyHTML(');
  assert.match(body, /_ledChips\(\)\+'<div class="ledgerwrap"/, '거래표가 거르기 줄 «바로 뒤»에 와야 폰 규칙이 걸린다');
  // 머리 칸 차례 — 5·6째가 입금·출금이어야 금액이 첫 줄에 선다
  const at = body.indexOf("_ledChips()+'<div class=\"ledgerwrap\"");
  const head = body.slice(at, body.indexOf('</tr></thead>', at));
  const ths = [...head.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/g)].map((m) => m[1].replace(/<[^>]+>/g, '').replace(/'\+[^+]+\+'/g, '').trim());
  assert.ok(ths.length >= 12, '거래표 칸 수가 바뀌었다 — @media ④ 의 칸 차례를 함께 고친다');
  assert.equal(ths[4], '입금'); assert.equal(ths[5], '출금');
  const S = '.ledchips+.ledgerwrap';
  const esc = (s) => s.replace(/[.+()[\]]/g, '\\$&');
  assert.match(decl(P6, new RegExp('^' + esc(S + ' tr') + '$')), /display\s*:\s*flex/, '거래 줄이 표 줄 그대로면 금액이 화면 밖이다');
  const ord = (sel) => Number((decl(P6, new RegExp('^' + esc(S + ' ' + sel) + '$')).match(/order\s*:\s*(\d+)/) || [])[1]);
  const brk = ord('tbody tr::after');
  assert.ok(brk > 0, '첫 줄과 둘째 줄을 가르는 조각이 없다');
  assert.ok(ord('td:nth-child(5)') < brk && ord('td:nth-child(6)') < brk, '금액이 첫 줄에 서야 한다');
  assert.ok(ord('td:nth-last-child(4)') > brk, '승인은 둘째 줄 — 첫 줄을 금액에 비워 둔다');
});

test('★⑤ 표를 담은 상자는 폰에서 스크롤 상자를 풀고, :has 를 모르면 붙이기를 끈다', () => {
  assert.match(decl(P8, /^\.panel$/), /overflow-x\s*:\s*auto/, '전제 — 폰에서 .panel 은 가로 스크롤 상자다(이것이 바뀌면 이 검사를 다시 본다)');
  assert.match(decl(P8, /^\.panel:has\(\.tblwrap\)$/), /overflow-x\s*:\s*visible/, '스크롤 상자 안의 붙은 머리는 그 상자 기준으로 내려앉아 줄을 가린다');
  assert.match(decl(P8, /^\.tblwrap thead th$/), /position\s*:\s*static/, ':has 를 모르는 브라우저에서 머리가 줄을 가린다');
  assert.match(decl(P8, /^\.panel:has\(\.tblwrap\) \.tblwrap:not\(\.scrollx\) thead th$/), /position\s*:\s*sticky/, '고친 뒤에는 틀 고정(대표 지시)이 폰에서도 살아 있어야 한다');
});
