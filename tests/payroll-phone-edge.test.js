'use strict';
/* 급여관리 — 폰에서 «양옆 빈자리» 없이 화면 폭을 다 쓴다 (대표 지시 2026-10-18 「양옆 빈공백이 많다 … 좌우 옆공간 모두 채워서」)

   무엇이 문제였나 (411px, 지어낸 30곳):
     본문 여백(12px) 안에 흰 카드(둥근 모서리·테두리 — 줄마다 style= 로 박힘) 안에 줄 여백(16px)이 겹쳐,
     한눈에·근태·급여 화면의 글이 화면 끝에서 29px 안쪽에서 시작했다. 오른쪽 «›»·값도 같은 만큼 안쪽에서 끝났다.

   지키는 규칙 (px 값을 박지 않는다 — PC 값·서로의 값과 «견준다»):
     ① 폰 본문 옆 여백은 PC 보다 작다
     ② ★ 본문 바로 아래 흰 카드는 «본문 여백만큼» 밖으로 펴서 화면 끝에 닿는다(음수 여백 = 본문 여백) · 둥근 모서리·옆 테두리를 걷는다
     ③ 카드 안 줄 여백은 박힌 값(16px)보다 작다 · 설정 카드도 옆 테두리를 걷는다
     ④ CSS 가 기대는 «박힌 모양»(둥근 카드·줄 여백)이 원본에 아직 있다 — 모양이 바뀌면 이 규칙이 헛돈다
   실행: node --test tests/payroll-phone-edge.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

/* ── CSS 읽개 (이 검사만 쓴다) ──
   base(선택자)  : @media 밖(PC 에도 걸리는) 규칙의 선언 — 같은 선택자가 여럿이면 뒤의 것이 이긴다
   phone(선택자) : 폰 폭(max-width ≤ LIMIT, min-width 없음) @media 안 규칙의 선언(나온 차례대로 이어 붙임)
   side(선언, 'padding'|'margin', 'left'|'right') : 마지막으로 정한 옆 값(px) — 줄임꼴(1~4값)도 푼다 */
function stripComments(s) { return s.replace(/\/\*[\s\S]*?\*\//g, ' '); }
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

const SRC = fs.readFileSync(path.join(__dirname, '..', 'payroll-os.html'), 'utf8');
const CSS = stripComments([...SRC.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n'));
const B = blocks(CSS);
const BASE = rules(B.base);
const PHONE = [].concat(...B.media.filter((b) => { const w = (b.q.match(/max-width\s*:\s*(\d+)px/) || [])[1]; return w && Number(w) <= 760 && !/min-width/.test(b.q); }).map((b) => rules(b.body)));
const base = (s) => pick(BASE, s), phone = (s) => pick(PHONE, s);
const mainSide = side(base('main') + ';' + phone('main'), 'padding', 'left');

test('★① 폰 본문 옆 여백은 PC 보다 작다', () => {
  const pc = side(base('main'), 'padding', 'left');
  assert.ok(pc > 0, 'PC 본문 여백을 못 읽었다');
  assert.ok(mainSide < pc, '폰 본문 옆 여백(' + mainSide + ')이 PC(' + pc + ')보다 작지 않다');
});

test('★② 본문 바로 아래 흰 카드는 본문 여백만큼 밖으로 펴 화면 끝에 닿고, 둥근 모서리·옆 테두리를 걷는다', () => {
  const d = phone('#main>[style*="border-radius:14px"]');
  assert.ok(d, '본문 바로 아래 둥근 카드(줄마다 박힌 style)를 가리키는 폰 규칙이 없다');
  assert.equal(side(d, 'margin', 'left'), -mainSide, '카드를 편 만큼(' + side(d, 'margin', 'left') + ')이 본문 여백(' + mainSide + ')과 다르면 화면 끝에 안 닿거나 넘친다');
  assert.equal(side(d, 'margin', 'right'), -mainSide);
  assert.match(d, /border-radius\s*:\s*0\s*!important/, '줄마다 박힌 style 은 !important 로만 덮인다');
  assert.match(d, /border-left\s*:\s*0\s*!important/);
  assert.match(phone('#main .tabbody>[style*="border-radius:14px"]'), /margin-left/, '회사 한 장(탭 안)의 카드도 같아야 한다');
});

test('★③ 카드 안 줄 여백은 박힌 값보다 작다 · 설정 카드도 옆 테두리를 걷는다', () => {
  const row = phone('#main [style*="px 16px"]');
  assert.ok(row, '줄 여백(…px 16px)을 덮는 폰 규칙이 없다');
  assert.ok(side(row, 'padding', 'left') < 16 && side(row, 'padding', 'right') < 16, '줄 여백이 박힌 16px 그대로다');
  const c = phone('.c');
  assert.match(c, /border-left\s*:\s*0/); assert.match(c, /border-radius\s*:\s*0/);
  assert.ok(side(base('.c') + ';' + c, 'padding', 'left') < side(base('.c'), 'padding', 'left'), '설정 카드 안 여백이 PC 보다 작지 않다');
});

test('④ CSS 가 기대는 박힌 모양이 원본에 아직 있다', () => {
  assert.ok((SRC.match(/style="background:#fff;border:1px solid var\(--line\);border-radius:14px/g) || []).length >= 1, '둥근 흰 카드 모양이 바뀌었다 — 폰 규칙의 선택자를 함께 고친다');
  assert.ok((SRC.match(/padding:1\dpx 16px/g) || []).length >= 1, '줄 여백 모양이 바뀌었다 — 폰 규칙의 선택자를 함께 고친다');
});
