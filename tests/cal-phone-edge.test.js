'use strict';
// 📱 푸른 캘린더 — 폰에서 «양옆 빈자리·상자 겹»을 걷는다 (대표 지시 2026-10-18 「양옆 빈공백이 많다 — 좌우 옆공간 모두 채워서」)
// node --test tests/cal-phone-edge.test.js
//
// ■ 무엇이 나빴나 (411px 실측 · tools/phone-audit 「양옆 L/R·겹」)
//   · 달력 판: 화면 끝까지 닿아 있었지만 같은 바탕을 «세 겹»(#app · 판 틀 · 달력) 칠해 겹 3~4
//   · 「일정」 보기: 날짜 열·카드 양옆 16px — 글이 16/30px 안쪽
//   · 인원 현황: 틀 상자 + 640px 표 — 글이 25px 안쪽, 법률상담·연락처·비고는 옆으로 밀어야 보였다(오른쪽 122px 빔)
//
// ■ 이 검사가 지키는 것 — «규칙»이지 지금 px 값이 아니다
//   ① 폰 달력에서 판 틀·달력 바탕을 걷는다 — 그리고 그 규칙이 «월 보기 칠하기» 규칙보다 세다(지면 겹이 그대로)
//   ② 「일정」 보기의 양옆 여백이 넓은 화면 값보다 작다
//   ③ 인원 현황은 폰에서 화면 폭 다(겉 여백만큼 음수 여백)이고, 표는 줄마다 «두 줄 카드»다
//   ④ 넓은 화면은 그대로

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const 캘 = fs.readFileSync(path.join(__dirname, '..', 'pu-cal.html'), 'utf8').replace(/\r\n/g, '\n');
const CSS = (() => {
  const head = 캘.slice(0, 캘.indexOf('</head>'));
  return [...head.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, ' ');
})();
function mediaBlocks(css) {
  const out = []; const re = /@media([^{]*)\{/g; let m;
  while ((m = re.exec(css))) {
    let d = 1, i = re.lastIndex;
    for (; i < css.length && d; i++) { if (css[i] === '{') d++; else if (css[i] === '}') d--; }
    out.push({ cond: m[1].trim(), body: css.slice(re.lastIndex, i - 1), start: m.index, end: i });
    re.lastIndex = i;
  }
  return out;
}
const BLOCKS = mediaBlocks(CSS);
const maxW = (c) => +((c.match(/max-width\s*:\s*(\d+)px/) || [])[1] || 0);
const PHONE = BLOCKS.filter((b) => maxW(b.cond) && maxW(b.cond) <= 700 && !/min-width/.test(b.cond)).map((b) => b.body).join('\n');
const WIDE = (() => { let s = '', p = 0; BLOCKS.forEach((b) => { s += CSS.slice(p, b.start); p = b.end; }); return s + CSS.slice(p); })();
function rules(css) {
  const out = []; const re = /([^{}]+)\{([^{}]*)\}/g; let m;
  while ((m = re.exec(css))) m[1].split(',').forEach((s) => out.push({ sel: s.trim().replace(/\s+/g, ' '), body: m[2] }));
  return out;
}
const decls = (css, selRe) => rules(css).filter((r) => selRe.test(r.sel)).map((r) => r.body).join(';');
function last(body, prop) {
  const re = new RegExp('(?:^|;)\\s*' + prop + '\\s*:\\s*([^;!]+)', 'g'); let m, v = null;
  while ((m = re.exec(body))) v = m[1].trim();
  return v;
}
function padSide(body, side) {
  const one = last(body, 'padding-' + side); if (one) return parseFloat(one);
  const p = last(body, 'padding'); if (!p) return null;
  const v = p.split(/\s+/).map(parseFloat);
  if (side === 'left') return v.length === 4 ? v[3] : v.length >= 2 ? v[1] : v[0];
  return v.length >= 2 ? v[1] : v[0];
}
/* 선택자 세기 [아이디, 클래스·의사클래스, 태그] — 같은 칸을 칠하는 규칙끼리 누가 이기나 */
function spec(sel) {
  const s = sel.replace(/::?[a-z-]+(\([^)]*\))?/g, (m) => (m.startsWith('::') ? ' T' : ' .p'));
  return [(s.match(/#[\w-]+/g) || []).length, (s.match(/\.[\w-]+|\[[^\]]+\]/g) || []).length,
    (s.match(/(^|[\s>+~])[a-z][\w-]*/gi) || []).length];
}
const beats = (a, b) => { for (let i = 0; i < 3; i++) { if (a[i] !== b[i]) return a[i] > b[i]; } return false; };

// ══════════════════════════════════════════════════════════════════
test('① ★ 폰 달력은 같은 바탕을 겹겹이 칠하지 않는다 — 판 틀·달력 바탕을 걷고, 그 규칙이 이긴다', () => {
  const all = rules(CSS);
  ['calwrap', 'cal'].forEach((c) => {
    const 걷개 = all.filter((r) => /^body\.mob\b/.test(r.sel) && new RegExp('\\.' + c + '$').test(r.sel)
      && /background:\s*transparent/.test(r.body));
    assert.ok(걷개.length, '★ 폰 달력에서 .' + c + ' 바탕을 걷는 규칙이 없습니다 — 같은 색 상자가 겹겹입니다');
    /* 같은 칸을 «칠하는» 폰 규칙(월 보기 gm 등)보다 세야 실제로 걷힌다 */
    const 칠개 = all.filter((r) => /^body\.mob/.test(r.sel) && new RegExp('\\.' + c + '$').test(r.sel)
      && /background:\s*var\(/.test(r.body));
    칠개.forEach((p) => assert.ok(걷개.some((g) => beats(spec(g.sel), spec(p.sel))),
      '★ 「' + p.sel + '」 가 .' + c + ' 를 다시 칠합니다 — 걷는 규칙이 약해 겹이 그대로입니다'));
  });
  /* 주·일 보기 격자 — #app 이 이미 같은 색이다 */
  assert.ok(all.some((r) => /^body\.mob\.gv\b.*\.tgrid\.wide$/.test(r.sel) && /background:\s*transparent/.test(r.body)),
    '주·일 보기 격자 바탕이 #app 위에 한 겹 더 칠해집니다');
});

test('② 「일정」 보기 — 폰의 날짜 열·카드 양옆 여백이 넓은 화면 값보다 작다', () => {
  const wide = decls(WIDE, /^\.sday$/), ph = decls(CSS, /^body\.mob \.sday$/);
  ['left', 'right'].forEach((s) => {
    const w = padSide(wide, s), p = padSide(ph, s);
    assert.ok(p != null, '★ 폰 「일정」 보기 ' + s + ' 여백 규칙이 없습니다');
    assert.ok(p < w, '★ 폰 「일정」 보기 ' + s + ' 여백이 넓은 화면보다 작지 않습니다');
  });
  const cw = decls(WIDE, /^\.scard$/), cp = decls(CSS, /^body\.mob \.scard$/);
  assert.ok(padSide(cp, 'right') < padSide(cw, 'right'), '카드 안 오른쪽 여백이 그대로입니다');
});

test('③ ★ 인원 현황 — 폰에서 화면 폭 다(겉 여백만큼 음수 여백), 표는 줄마다 두 줄 카드', () => {
  const app = padSide(decls(PHONE, /^#app$/), 'left');
  assert.ok(app > 0, '폰 #app 겉 여백을 못 찾았습니다');
  ['.ieumbar', '.ppltable'].forEach((c) => {
    const b = decls(PHONE, new RegExp('^' + c.replace('.', '\\.') + '$'));
    assert.equal(parseFloat(last(b, 'margin-left')), -app, '★ ' + c + ' 가 겉 여백만큼 펴지지 않습니다');
    assert.match(b, /border-left-width:\s*0/, c + ' 옆 테두리가 남았습니다');
    assert.match(b, /border-radius:\s*0/);
  });
  /* 표 → 카드: 머리줄을 숨기고, 줄은 접히는 flex, «둘째 줄로 끊는 자리»(폭 100% 빈 칸)가 있다 */
  assert.match(decls(PHONE, /^\.ppltable thead$/), /display:\s*none/, '★ 폰에서 표 머리줄이 그대로입니다');
  const row = decls(PHONE, /^\.ppltable tr\.prow$/);
  assert.match(row, /display:\s*flex/, '★ 인원 현황 줄이 카드가 아니라 표 줄입니다(옆으로 밀어야 보임)');
  assert.match(row, /flex-wrap:\s*wrap/);
  assert.match(decls(PHONE, /^\.ppltable tr\.prow::after$/), /flex:\s*0 0 100%|flex-basis:\s*100%/, '둘째 줄로 끊는 자리가 없습니다');
  assert.match(decls(PHONE, /^\.ppltable table$/), /min-width:\s*0/, '★ 표의 최소 폭(넓은 화면 값)이 남아 옆으로 밀립니다');
  /* 말 없는 칸(—)은 안 그린다 */
  assert.ok(rules(PHONE).some((r) => /\.ppltable tr\.prow > td:has\(> \.dash:only-child\)$/.test(r.sel) && /display:\s*none/.test(r.body)),
    '말 없는 칸(—)을 그대로 그립니다');
  /* ☐+번호 규칙 — 번호는 카드 맨 앞에 남는다 */
  assert.doesNotMatch(decls(PHONE, /td\.no$/), /display:\s*none/, '카드에서 번호를 뺐습니다');
});

test('④ 넓은 화면은 그대로 — 인원 현황 표·일정 보기 규칙이 PC 로 새지 않는다', () => {
  assert.doesNotMatch(decls(WIDE, /^\.ppltable thead$/), /display:\s*none/);
  assert.doesNotMatch(decls(WIDE, /^\.ppltable tr\.prow$/), /display:\s*flex/);
  assert.equal(decls(WIDE, /^\.(ieumbar|ppltable)$/).match(/margin-left:\s*-/), null, '넓은 화면 인원 현황이 음수 여백을 갖습니다');
});
