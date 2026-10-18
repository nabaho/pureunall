'use strict';
/* 취업규칙 — 폰에서 «양옆 빈자리» 없이 화면 폭을 다 쓴다 (대표 지시 2026-10-18 「양옆 빈공백이 많다 … 좌우 옆공간 모두 채워서」)

   무엇이 문제였나 (411px, 지어낸 업체 40곳):
     회색 바탕 위 바깥 상자(#sites·#lib·#topics — 여백 6px·테두리·둥근 모서리·옅은 바탕) 안에 흰 줄·흰 카드가 또 겹쳐(겹 2),
     사업장 이름이 화면 끝에서 45px, 조별 문안 글이 44px 안쪽에서 시작했다.

   지키는 규칙 (px 값을 박지 않는다 — PC 값과 «견준다»):
     ① 폰에서 바깥 상자의 옆 여백은 PC 보다 작고, 테두리·바탕이 없다(겹으로 안 센다)
     ② 바깥 상자를 걷어도 줄(사업장 줄)은 제 바탕으로 «한 겹» 선다 — 줄이 회색 바탕에 뜨지 않게
     ③ 조별 문안 — 본문 칸 옆 여백이 PC 보다 작고, 문안 카드는 옆 테두리·둥근 모서리·바탕을 걷는다(위아래 선만)
   실행: node --test tests/rules-phone-edge.test.js */
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

const SRC = fs.readFileSync(path.join(__dirname, '..', 'rules-v2.html'), 'utf8');
const CSS = stripComments([...SRC.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n'));
const B = blocks(CSS);
const BASE = rules(B.base);
const PHONE = [].concat(...B.media.filter((b) => { const w = (b.q.match(/max-width\s*:\s*(\d+)px/) || [])[1]; return w && Number(w) <= 900 && !/min-width/.test(b.q); }).map((b) => rules(b.body)));
const base = (s) => pick(BASE, s), phone = (s) => pick(PHONE, s);

test('★① 바깥 상자(#sites·#lib·#topics)는 폰에서 옆 여백이 PC 보다 작고, 테두리·바탕이 없다', () => {
  ['#sites', '#lib', '#topics'].forEach((sel) => {
    const pc = side(base(sel), 'margin', 'left'), ph = side(base(sel) + ';' + phone(sel), 'margin', 'left');
    assert.ok(pc > 0, sel + ' — PC 옆 여백을 못 읽었다');
    assert.ok(ph < pc, sel + ' 폰 옆 여백(' + ph + ')이 PC(' + pc + ')보다 작지 않다 — 양옆 빈자리가 그대로다');
    const p = phone(sel);
    assert.match(p, /border\s*:\s*0/, sel + ' 폰에서 테두리가 남아 상자가 한 겹 더 쌓인다');
    assert.match(p, /background\s*:\s*transparent/, sel + ' 폰에서 바탕이 남아 상자가 한 겹 더 쌓인다');
  });
});

test('★② 바깥 상자를 걷어도 사업장 줄은 제 바탕으로 한 겹 선다', () => {
  assert.match(phone('#sites .sites tbody tr'), /background\s*:\s*#(fff|ffffff)\b/i, '줄 바탕이 없으면 회색 바탕 위에 글이 뜬다');
  assert.match(base('#sites .flt') || base('.flt'), /background/, '거르개 띠도 제 바탕이 있어야 한다');
});

test('★③ 조별 문안 — 본문 칸 옆 여백은 PC 보다 작고, 카드는 옆 테두리·둥근 모서리·바탕을 걷는다', () => {
  const pc = side(base('#topics .main'), 'padding', 'left');
  const ph = side(base('#topics .main') + ';' + phone('#topics .main'), 'padding', 'left');
  assert.ok(ph < pc, '본문 칸 옆 여백(' + ph + ')이 PC(' + pc + ')보다 작지 않다');
  const card = phone('#topics .card');
  assert.match(card, /border-left\s*:\s*0/); assert.match(card, /border-right\s*:\s*0/);
  assert.match(card, /border-radius\s*:\s*0/, '둥근 카드가 본문 안에 또 앉으면 겹이 2 가 된다');
  assert.match(card, /background\s*:\s*transparent/);
  const pcIn = side(base('#topics .txt'), 'padding', 'left'), phIn = side(base('#topics .txt') + ';' + phone('#topics .txt'), 'padding', 'left');
  assert.ok(phIn <= pcIn, '카드 안 글 여백이 PC 보다 크다');
});
