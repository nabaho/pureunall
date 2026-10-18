/* 폰 양옆 빈자리 — 정부사업신청·회생광고·전광판·계약서등관리 (대표 지시 2026-10-18
   「양옆 빈공백이 많다, 좌우 옆공간 모두 채워서 쓰게」)

   ★ 고치기 전(411px 실측 — 글이 화면 끝에서 몇 px 에서 시작/끝나나 · 글을 감싼 상자 몇 겹)
     정부사업신청 15~20px · 회생광고 17~21px(설정·안내 칸 세 겹) · 전광판 17~25px · 계약서등관리 19~24px(양식 칸 세 겹)
     까닭은 같다 — 겉 여백(본문 6~10px) + 카드 테두리 + 카드 안 여백 + 카드 안 상자의 테두리·여백이 겹겹이 쌓였다.

   ★ 이 검사가 못 박는 규칙(px 값이 아니라)
     ① 폰 구간에서 겉 여백(본문 틀의 좌우 padding)이 넓은 화면보다 «작고», 지침의 상한(6px) 안이다
     ② 폰 구간에서 카드는 화면 폭 그대로 — 옆 테두리(또는 그림자)·둥근 모서리를 걷는다
     ③ 카드 안의 상자는 폰에서 옆 테두리·바탕을 걷어 한 겹으로 (앱마다 그 상자 이름)
     ⚠ 넓은 화면은 그대로다 — 모두 폰 구간(@media max-width)에서만 바꾼다.

   실행: node --test tests/phone-edge-four-apps.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const OUTER_MAX = 6;   // 폰 겉 여백(화면 끝 ~ 첫 상자) 상한 — 「폰화면관리」 양옆 빈자리 지침(0~6px)의 규칙 수다
function styleOf(file) {
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  return [...src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n').replace(/\/\*[\s\S]*?\*\//g, ' ');
}
/* 폰 구간(max-width ≤ maxW)과 그 밖(넓은 화면 기본)을 가른다 */
function split(css, maxW) {
  const phone = [];
  let wide = '', i = 0;
  const re = /@media([^{]*)\{/g;
  let m;
  while ((m = re.exec(css))) {
    wide += css.slice(i, m.index);
    let j = re.lastIndex, d = 1;
    for (; j < css.length && d; j++) { if (css[j] === '{') d++; else if (css[j] === '}') d--; }
    const w = (m[1].match(/max-width\s*:\s*(\d+)px/) || [])[1];
    if (w && Number(w) <= maxW && !/min-width/.test(m[1])) phone.push(css.slice(re.lastIndex, j - 1));
    i = j; re.lastIndex = j;
  }
  wide += css.slice(i);
  const rules = (body) => [...body.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((r) => ({ sels: r[1].split(',').map((s) => s.trim().replace(/\s+/g, ' ')), body: r[2] }));
  return { phone: rules(phone.join('\n')), wide: rules(wide) };
}
/* 그 선택자에 매긴 마지막 값 */
function prop(rules, sel, name) {
  let v = null;
  rules.forEach((r) => {
    if (!r.sels.includes(sel)) return;
    const re = new RegExp('(?:^|;)\\s*' + name + '\\s*:\\s*([^;]+)', 'g');
    let m; while ((m = re.exec(r.body))) v = m[1].trim();
  });
  return v;
}
/* padding 줄임말 → 왼쪽·오른쪽 px */
function sidePad(rules, sel) {
  const v = prop(rules, sel, 'padding');
  if (v == null) return null;
  const p = v.split(/\s+/).map((x) => parseFloat(x) || 0);
  const r = p.length === 1 ? p[0] : p[1], l = p.length === 4 ? p[3] : (p.length === 1 ? p[0] : p[1]);
  return Math.max(l, r);
}
const zero = (v) => v != null && /^(0|0px|none)$/.test(v.replace(/!important/, '').trim());

function edgeRules(t) {
  const S = split(styleOf(t.file), t.maxW);
  test(t.name + ' ① 폰에서 겉 여백(' + t.outer + ')이 넓은 화면보다 작다', () => {
    const pc = sidePad(S.wide, t.outerWide || t.outer), ph = sidePad(S.phone, t.outer);
    assert.ok(pc != null, '넓은 화면의 ' + t.outer + ' 여백을 못 찾음 — 이 검사의 찾는 법을 고쳐야 한다');
    assert.ok(ph != null, '폰 구간에 ' + t.outer + ' 여백 규칙이 없다');
    assert.ok(ph < pc, '폰 겉 여백(' + ph + 'px)이 넓은 화면(' + pc + 'px)보다 작지 않다 — 양옆 빈자리가 그대로다');
    assert.ok(ph <= OUTER_MAX, '폰 겉 여백(' + ph + 'px)이 ' + OUTER_MAX + 'px 를 넘는다 — 카드 안 여백과 겹쳐 글이 화면 끝에서 멀어진다');
  });
  test(t.name + ' ② 폰에서 카드(' + t.card + ')는 화면 폭 그대로 — 둥근 모서리와 옆 테두리(또는 그림자)를 걷는다', () => {
    assert.ok(zero(prop(S.phone, t.card, 'border-radius')), '폰에서 ' + t.card + ' 의 둥근 모서리를 안 걷었다');
    const sideGone = (zero(prop(S.phone, t.card, 'border-left')) && zero(prop(S.phone, t.card, 'border-right'))) || zero(prop(S.phone, t.card, 'box-shadow'));
    assert.ok(sideGone, '폰에서 ' + t.card + ' 의 옆 테두리(또는 그림자)를 안 걷었다 — 화면 끝에 상자 테두리가 한 겹 더 선다');
  });
  test(t.name + ' ③ 카드 안의 상자는 폰에서 옆 테두리·바탕을 걷어 한 겹으로', () => {
    for (const [sel, kind] of t.inner) {
      if (kind === 'side') assert.ok((zero(prop(S.phone, sel, 'border-left')) && zero(prop(S.phone, sel, 'border-right'))) || zero(prop(S.phone, sel, 'border')),
        '폰에서 ' + sel + ' 의 옆 테두리를 안 걷었다 — 상자 안의 상자가 남는다');
      if (kind === 'bg') assert.ok(zero(prop(S.phone, sel, 'background')), '폰에서 ' + sel + ' 의 바탕을 안 걷었다 — 상자 안의 상자가 남는다');
    }
  });
}

edgeRules({ name: '전광판', file: 'pu-signboard.html', maxW: 640, outer: 'main', card: '.card', inner: [] });
edgeRules({ name: '회생광고', file: 'rehab-ad.html', maxW: 640, outer: 'main', card: '.tbl', inner: [['.guide .gs', 'side'], ['.guide .gs', 'bg'], ['.auto', 'side'], ['.auto', 'bg'], ['#fixbar', 'bg']] });
edgeRules({ name: '정부사업신청', file: 'gov.html', maxW: 640, outer: '.wrap', card: '.card', inner: [['.sel-bar', 'side'], ['.sel-bar', 'bg']] });
edgeRules({ name: '계약서등관리', file: 'docs-esign.html', maxW: 700, outer: '.shell .main', card: '.card',
  inner: [['#paneForms .pcf-lp', 'side'], ['#paneForms .pcf-vp .pcf-top', 'side'], ['#paneForms .pcf-sheetwrap', 'side'], ['#paneForms .pcf-lp', 'bg'], ['#paneForms .pcf-sheetwrap', 'bg']] });
