'use strict';
/* 급여데이터함 — 폰에서 «양옆 빈자리»가 돌아오지 않게 (대표 지시 2026-10-18 「양옆 빈공백이 많다 — 좌우 옆공간 모두 채워서」)
   실행: node --test tests/paydata-phone-edge.test.js

   ⚠ 왜 이 검사가 생겼나 — 411px 로 재 보니 글이 화면 끝에서 23~25px 안쪽에서 시작했다.
     본문 여백(12) + 카드 테두리(1) + 줄 안쪽 여백(12~14)이 겹겹이 쌓인 것이다.
     폰에서는 본문 여백을 줄이고, 카드·띠는 음수 margin 으로 화면 끝 가까이 넓히고, 줄 안쪽 여백도 줄였다.
   ⚠ px 값을 박지 않는다 — «폰 값이 PC 값보다 작은가 / 넓힌 만큼이 본문 여백을 넘지 않는가(화면 밖으로 안 나가는가)» 를 본다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'pu-paydata.html'), 'utf8');
const css = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));

/* CSS 를 «폰 구간»과 «바탕»으로 가른다 — 중괄호 짝을 센다 */
function split() {
  const phone = [];
  let base = '', i = 0;
  while (i < css.length) {
    const at = css.indexOf('@media', i);
    if (at < 0) { base += css.slice(i); break; }
    base += css.slice(i, at);
    const open = css.indexOf('{', at);
    const cond = css.slice(at, open);
    let depth = 0, k = open;
    for (; k < css.length; k++) {
      if (css[k] === '{') depth++;
      else if (css[k] === '}') { depth--; if (!depth) break; }
    }
    const mw = cond.match(/max-width:\s*(\d+)px/);
    if (mw && !/min-width/.test(cond)) phone.push({ w: +mw[1], body: css.slice(open + 1, k) });
    i = k + 1;
  }
  return { phone, base };
}
function rulesOf(block) {
  const out = [];
  const re = /([^{}]+)\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(block))) out.push({ sel: m[1].replace(/\/\*[\s\S]*?\*\//g, '').trim(), body: m[2] });
  return out;
}
const { phone, base } = split();
/* 폰 구간의 바깥 경계 = 사이드 칸(.colist)을 감추는 폭(숫자를 박지 않고 CSS 에서 읽는다) */
const SIDE_HIDE = phone.filter(b => /\.colist[^{]*\{[^}]*display:none/.test(b.body)).map(b => b.w)[0];
/* 측정 폭(폰)에서 실제로 걸리는 규칙만 — 바탕 → 넓은 폰 구간 → 좁은 폰 구간 차례(뒤에 온 것이 이긴다) */
const PHONE = [].concat(...phone.filter(b => b.w <= SIDE_HIDE).map(b => rulesOf(b.body)));
const BASE = rulesOf(base);

function decl(rules, selRe, prop) {
  let v = null;
  rules.forEach(r => {
    if (!r.sel.split(',').some(s => selRe.test(s.trim()))) return;
    const m = r.body.match(new RegExp('(?:^|;)\\s*' + prop + '\\s*:\\s*([^;]+)'));
    if (m) v = m[1].trim();
  });
  return v;
}
/* padding/margin 의 «왼쪽» 값(px) — 줄임꼴(1~4개)과 -left 낱꼴을 모두 읽는다(뒤에 온 것이 이긴다) */
function sideOf(rules, selRe, prop) {
  let v = null;
  rules.forEach(r => {
    if (!r.sel.split(',').some(s => selRe.test(s.trim()))) return;
    const re = new RegExp('(?:^|;)\\s*' + prop + '(-left)?\\s*:\\s*([^;]+)', 'g');
    let m;
    while ((m = re.exec(r.body))) {
      if (m[1]) { v = parseFloat(m[2]); continue; }
      const p = m[2].trim().split(/\s+/).map(parseFloat);
      v = p.length === 1 ? p[0] : p.length <= 3 ? p[1] : p[3];
    }
  });
  return v;
}

test('폰 구간이 있다 — 사이드 칸을 감추는 폭을 CSS 에서 읽었다', () => {
  assert.ok(SIDE_HIDE > 0);
});

test('★ 폰에서 본문 양옆 여백은 PC 보다 좁다', () => {
  const pc = sideOf(BASE, /^main$/, 'padding');
  const ph = sideOf(PHONE, /^(#main|main)$/, 'padding');
  assert.ok(pc > 0, 'PC 본문 여백을 못 읽었습니다');
  assert.ok(ph !== null && ph < pc, '★ 폰 본문 여백(' + ph + ')이 PC(' + pc + ')보다 좁지 않습니다 — 양옆이 빈 채로 남습니다');
});

test('★ 폰에서 카드·띠는 화면 끝 쪽으로 넓힌다(음수 margin) — 그러나 본문 여백을 넘어 화면 밖으로 나가지 않는다', () => {
  const pad = sideOf(PHONE, /^(#main|main)$/, 'padding');
  ['#main>\\.card', '#main>\\.mailbar', '#main>\\.warnbar'].forEach(sel => {
    const m = sideOf(PHONE, new RegExp('^' + sel + '$'), 'margin');
    assert.ok(m !== null && m < 0, '★ ' + sel + ' 가 폰에서 넓혀지지 않습니다 — 겉 여백이 그대로입니다');
    assert.ok(-m <= pad, '★ ' + sel + ' 가 본문 여백보다 더 나가 화면 밖으로 삐집니다');
  });
});

test('★ 붙어 있는 머리(.stickhead)는 폰 본문 여백만큼 정확히 넓힌다 — 덜 넓히면 뒤로 목록이 비친다', () => {
  const pad = sideOf(PHONE, /^(#main|main)$/, 'padding');
  const m = sideOf(PHONE, /^\.stickhead$/, 'margin');
  assert.equal(m, -pad, '머리 바탕이 화면 끝까지 안 덮습니다 — 그 틈으로 지나가는 자료가 비칩니다');
});

test('★ 폰에서 카드 안 줄의 안쪽 여백은 PC 보다 좁다', () => {
  const pc = sideOf(BASE, /^\.row$/, 'padding');
  ['#main>\\.card>\\.row', '#main>\\.card>\\.grp', '#main>\\.card>\\.pkbar'].forEach(sel => {
    const ph = sideOf(PHONE, new RegExp('^' + sel + '$'), 'padding');
    assert.ok(ph !== null && ph < pc, '★ ' + sel + ' 안쪽 여백이 PC 줄(' + pc + ')보다 좁지 않습니다');
  });
});

/* 카드 줄의 글이 화면 끝에서 몇 px 에서 시작하나 = 본문 여백 + 카드 넓힘(음수) + 카드 테두리 + 줄 안쪽 여백.
   ⚠ 14 는 «지금 값»이 아니라 목표다 — 총괄 기준 「글은 화면 끝에서 8~14px 안에서 시작한다」(대표 지시 2026-10-18). 검사고정-허용 */
test('★ 폰에서 카드 줄의 글은 화면 끝 가까이(목표 14px 이내)에서 시작한다 — 여백이 다시 겹겹이 쌓이면 걸린다', () => {
  const pad = sideOf(PHONE, /^(#main|main)$/, 'padding');
  const grow = sideOf(PHONE, /^#main>\.card$/, 'margin') || 0;
  const border = parseFloat(decl(BASE, /^\.card$/, 'border')) || 0;
  /* 폰 규칙이 없으면 PC 줄 여백이 그대로 걸린다 */
  const rowPh = sideOf(PHONE, /^#main>\.card>\.row$/, 'padding');
  const row = rowPh !== null ? rowPh : sideOf(BASE, /^\.row$/, 'padding');
  const start = pad + grow + border + row;
  assert.ok(start <= 14, '★ 카드 줄 글이 화면 끝에서 ' + start + 'px 에서 시작합니다(목표 14 이내) — 검사고정-허용');
  assert.ok(start >= 6, '글이 화면 끝에 딱 붙습니다(' + start + 'px)');
});

test('★ 상자 안의 상자를 걷는다 — 펼친 줄(.gl)은 폰에서 제 바탕을 내려놓는다(고른 줄 색은 남긴다)', () => {
  assert.match(decl(BASE, /^\.gl$/, 'background') || '', /#fff|white/, '(PC 규칙) 펼친 줄 바탕');
  const ph = decl(PHONE, /^\.gl:not\(\.pkon\)$/, 'background');
  assert.match(ph || '', /transparent|none/, '★ 펼친 줄이 카드 안에서 또 한 겹 상자가 됩니다');
});

test('★ 창(모달)은 폰에서 화면 끝까지 넓게 — 겉 여백이 PC 보다 좁다', () => {
  const pc = sideOf(BASE, /^\.modalWrap$/, 'padding');
  const ph = sideOf(PHONE, /^\.modalWrap$/, 'padding');
  assert.ok(ph !== null && ph < pc, '★ 창이 폰에서도 작은 상자로 떠 글이 접힙니다');
});

test('★ PC 는 그대로 — 넓히는 규칙은 바탕(@media 밖)에 없다', () => {
  ['#main>.card', '.stickhead .seatbar', '.gl:not(.pkon)'].forEach(sel => {
    const hit = BASE.some(r => r.sel.split(',').some(s => s.trim() === sel));
    assert.equal(hit, false, '★ ' + sel + ' 규칙이 @media 밖에 있습니다 — PC 화면이 바뀝니다');
  });
});
