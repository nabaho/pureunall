'use strict';
/* 기금관리 — 폰에서 «양옆 빈자리» 없이 화면 폭을 다 쓴다 (대표 지시 2026-10-18 「양옆 빈공백이 많다 … 좌우 옆공간 모두 채워서」)

   무엇이 문제였나 (411px, 지어낸 기금 32개):
     본문 여백(8px) + 패널 테두리 + 패널 안 여백(10px) + 표 칸 여백이 쌓여 기금명이 화면 끝에서 21~51px,
     기금 정보 묶음 상자(.secbox, 둥근 상자 안 여백 16px) 글이 25px 안쪽에서 시작했다.

   지키는 규칙 (px 값을 박지 않는다 — PC 값·서로의 값과 «견준다»):
     ① 폰 본문(#app) 옆 여백은 PC 보다 작다 — 패널이 화면 끝에 닿는다
     ② 패널·묶음 상자는 옆 테두리·둥근 모서리를 걷고, 안 여백은 PC 보다 작다
     ③ ★ 패널 «밖»에 바로 놓인 줄(기금 머리·월마감 줄)은 패널과 같은 여백을 갖는다 — 본문 여백을 걷었으니 안 주면 글이 화면 끝에 붙는다
     ④ 창(모달)은 폰에서 넓은 화면(860px 이하)보다 양옆을 더 쓴다
   실행: node --test tests/fund-phone-edge.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

/* ── CSS 읽개 (이 검사만 쓴다) ──
   base(선택자)  : @media 밖(PC 에도 걸리는) 규칙의 선언 — 같은 선택자가 여럿이면 뒤의 것이 이긴다
   phone(선택자) : 폰 폭(max-width ≤ LIMIT, min-width 없음) @media 안 규칙의 선언(나온 차례대로 이어 붙임)
   side(선언, 'padding'|'margin', 'left'|'right') : 마지막으로 정한 옆 값(px) — 줄임꼴(1~4값)도 푼다 */
/* CSS 주석만 걷는다 — CSS 에는 // 주석이 없어(url(http://…) 를 주석으로 읽으면 안 된다) 공용 걷개(strip-comments.js, JS·HTML 용)와 일이 다르다 */
function cssBare(s) { return s.replace(/\/\*[\s\S]*?\*\//g, ' '); }
function blocks(css) {
  const out = []; const re = /@media([^{]*)\{/g; let m, last = 0, base = '';
  while ((m = re.exec(css))) {
    base += css.slice(last, m.index);
    let i = m.index + m[0].length, d = 1; const s = i;
    while (i < css.length && d > 0) { if (css[i] === '{') d++; else if (css[i] === '}') d--; i++; }
    out.push({ q: m[1], body: css.slice(s, i - 1) }); last = i; re.lastIndex = i;
  }
  return { base: base + css.slice(last), media: out };
}
function rules(body) { const r = /([^{}]+)\{([^{}]*)\}/g, out = []; let x; while ((x = r.exec(body))) out.push([x[1].trim(), x[2]]); return out; }
function pick(list, sel) { return list.filter(([s]) => s.split(',').map((t) => t.trim()).includes(sel)).map(([, d]) => d).join(';'); }
function side(decl, prop, which) {
  let v = null;
  decl.split(';').forEach((one) => {
    const m = one.match(/^\s*([a-z-]+)\s*:\s*([^;]+?)\s*(!important)?\s*$/); if (!m) return;
    if (m[1] === prop + '-' + which) v = parseFloat(m[2]);
    else if (m[1] === prop) { const p = m[2].trim().split(/\s+/).map(parseFloat); v = p.length === 1 ? p[0] : (which === 'left' ? (p[3] != null ? p[3] : p[1]) : p[1]); }
  });
  return v;
}

const SRC = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8');
const CSS = cssBare([...SRC.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n'));
const B = blocks(CSS);
const BASE = rules(B.base);
const mq = (lo, hi) => [].concat(...B.media.filter((b) => { const w = Number((b.q.match(/max-width\s*:\s*(\d+)px/) || [])[1]); return w && w > lo && w <= hi && !/min-width/.test(b.q); }).map((b) => rules(b.body)));
const TAB = mq(600, 860), PH = mq(0, 600);
const base = (s) => pick(BASE, s);
const all = (s) => base(s) + ';' + pick(TAB, s) + ';' + pick(PH, s);   // 폰에서 실제로 걸리는 차례(PC → 860 → 600)

test('★① 폰 본문(#app) 옆 여백은 PC 보다 작다', () => {
  const pc = side(base('#app'), 'padding', 'left');
  assert.ok(pc > 0, 'PC 본문 여백을 못 읽었다');
  assert.ok(side(all('#app'), 'padding', 'left') < pc, '본문 옆 여백이 PC 보다 작지 않다');
  assert.ok(side(all('#app'), 'padding', 'right') < side(base('#app'), 'padding', 'right'));
  // 0 은 «패널이 화면 끝에 닿는다»는 뜻 그 자체라 값이 곧 규칙이다 — 글 여백은 패널 안 여백이 맡는다 검사고정-허용
  assert.equal(side(all('#app'), 'padding', 'left'), 0, '본문 여백이 남으면 패널 바깥에 빈 띠가 생긴다'); // 검사고정-허용: 0 = 화면 끝에 닿음
});

test('★② 패널·묶음 상자는 옆 테두리·둥근 모서리를 걷고, 안 여백은 PC 보다 작다', () => {
  ['.panel', '.secbox'].forEach((sel) => {
    const p = pick(PH, sel);
    assert.match(p, /border-left\s*:\s*0/, sel + ' 옆 테두리가 남는다');
    assert.match(p, /border-right\s*:\s*0/, sel + ' 옆 테두리가 남는다');
    assert.match(p, /border-radius\s*:\s*0/, sel + ' 둥근 모서리가 남는다');
    assert.ok(side(all(sel), 'padding', 'left') < side(base(sel), 'padding', 'left'), sel + ' 안 여백이 PC 보다 작지 않다');
  });
});

test('★③ 패널 밖에 바로 놓인 줄(기금 머리·월마감 줄)은 패널과 같은 여백을 갖는다', () => {
  const pan = side(all('.panel'), 'padding', 'left');
  ['#fundhead', '#app>.row'].forEach((sel) => {
    assert.equal(side(pick(PH, sel), 'padding', 'left'), pan, sel + ' 여백이 패널 글과 다르면 글줄이 어긋나거나 화면 끝에 붙는다');
  });
  // 월마감 줄은 실제로 «패널 밖, 본문 바로 아래»에 놓인다 — 그래서 위 규칙이 필요하다
  assert.match(SRC, /\+monthLockBar\(arr\)/, '월마감 줄을 그리는 자리가 바뀌었다 — 이 검사를 다시 본다');
});

test('④ 창(모달)은 폰에서 넓은 화면보다 양옆을 더 쓴다', () => {
  const tab = side(pick(TAB, '#modalbg'), 'padding', 'left'), ph = side(pick(PH, '#modalbg'), 'padding', 'left');
  assert.ok(tab > 0 && ph != null, '창 여백 규칙을 못 읽었다');
  assert.ok(ph < tab, '폰의 창 바깥 여백(' + ph + ')이 860px 구간(' + tab + ')보다 작지 않다');
  assert.ok(side(pick(PH, '#modalbg>div'), 'padding', 'left') < side(pick(TAB, '#modalbg>div'), 'padding', 'left'), '창 안 여백이 줄지 않았다');
});
