'use strict';
/* 기업정보함 — 폰 화면의 띠·메뉴·근로자 머리 (폰화면관리 2026-10-18 · 대표 지시 「폰화면관리」)
   실행: node --test tests/cards-phone-bars.test.js

   폰 폭(360·411)에서 가짜 로그인으로 실제로 그려 재 보니(tools/phone-audit) 이랬다.
   ① ✎ 편집으로 명함을 고르면 아래 띠의 「1개 선택」이 「1 / 개 / 선 / 택」으로 세로로 쌓이고
      「삭제」 단추가 화면 밖으로 나갔다(360px). 411px 에서도 「1 / 개」로 접혔다.
   ② ☰ 메뉴의 칸 이름이 「새 등록 / 증」·「엑셀로 내보내 / 기」처럼 낱말 가운데서 접혔다(360px).
   ③ 👷 근로자 화면 — 제목 「근로자 N명」이 PC 의 짙은 글씨 그대로라 검은 폰 바탕에 묻혔고,
      부제는 두 줄로 접혀 표를 밀었다. 집단 줄을 펴는 ▸ 는 16px 라 손끝이 옆 칸을 눌렀다.

   ⚠ px 값이 아니라 «규칙»을 본다 — 「한 줄인가」「넘치면 줄어드는가」「읽히는 빛깔인가」. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8').split('\r\n').join('\n');
const css = app.slice(app.indexOf('<style>'), app.indexOf('</style>')).replace(/\/\*[\s\S]*?\*\//g, ' ');

/* 폰 구간(@media max-width ≤ 760px) 안의 글만 */
function phoneCss() {
  const out = [];
  const re = /@media\s*\(\s*max-width\s*:\s*(\d+)px\s*\)\s*\{/g;
  let m;
  while ((m = re.exec(css))) {
    let d = 1, i = re.lastIndex;
    for (; i < css.length && d; i++) { if (css[i] === '{') d++; else if (css[i] === '}') d--; }
    if (Number(m[1]) <= 760) out.push(css.slice(re.lastIndex, i - 1));
  }
  return out.join('\n');
}
/* 폰 구간 «밖»(어느 @media 에도 안 든 것)만 — 기본 규칙 */
function baseCss() {
  let s = css, out = '';
  const re = /@media[^{]*\{/g;
  let last = 0, m;
  while ((m = re.exec(s))) {
    out += s.slice(last, m.index);
    let d = 1, i = re.lastIndex;
    for (; i < s.length && d; i++) { if (s[i] === '{') d++; else if (s[i] === '}') d--; }
    last = i; re.lastIndex = i;
  }
  return out + s.slice(last);
}
function rules(src, want) {
  const out = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(src))) {
    const sels = m[1].split(',').map((s) => s.trim());
    if (sels.some((s) => want.test(s))) out.push({ sel: m[1].trim(), body: m[2].replace(/\s+/g, ''), raw: m[2] });
  }
  return out;
}
const has = (rs, re) => rs.some((x) => re.test(x.body));
/* padding 의 «좌우» 값(px) — 「0 2px」·「8px 6px 80px」·「6px」 모두 */
function padX(raw) {
  const v = (String(raw).match(/(?:^|;)\s*padding\s*:\s*([^;]+)/) || [])[1];
  if (!v) return NaN;
  const t = v.trim().split(/\s+/);
  return parseFloat(t.length > 1 ? t[1] : t[0]) || 0;
}
function dark(hex) {
  let h = String(hex).replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) < 0.5;
}

/* ── ① 고른 뒤 띠 ── */
test('★★ ① 폰 «고른 뒤 띠»의 「N개 선택」은 한 줄이고 줄어들지 않는다', () => {
  /* 고른 수는 띠의 «바로 아래 첫 <span>» 이다 — 아래 규칙(#selbar>span)이 그것을 집는다. 글귀는 따지지 않는다 */
  const at = app.indexOf('function renderSelbar(');
  assert.ok(at > 0, 'renderSelbar 를 못 찾았습니다');
  assert.match(app.slice(at, app.indexOf('\n}', at)), /innerHTML\s*=\s*`\s*<span/,
    '고른 수 글자가 띠 바로 아래 <span> 이 아닙니다 — 아래 규칙이 헛돌 수 있습니다');
  const r = rules(phoneCss(), /^#selbar\s*>?\s*span$/);
  assert.ok(has(r, /white-space:nowrap/), '★★ 「1개 선택」이 접힙니다 — 폰에서 한 글자씩 세로로 쌓입니다');
  assert.ok(has(r, /flex:none|flex-shrink:0|flex:0 0/), '★★ 「1개 선택」 칸이 줄어듭니다 — 단추 넷에게 자리를 내주고 세로로 쌓입니다');
});

test('★ ① 띠 단추 글자도 접지 않고, 그래도 좁으면 띠 안에서 옆으로 민다(화면 밖으로 안 나간다)', () => {
  const ph = phoneCss();
  assert.ok(has(rules(ph, /^#selbar\s+\.btn$/), /white-space:nowrap/), '띠 단추 글자가 두 줄로 접힙니다');
  assert.ok(has(rules(ph, /^#selbar$/), /overflow-x:(auto|scroll)/), '★ 좁은 폰에서 「삭제」가 화면 밖으로 나가 못 누릅니다');
});

/* ── ② ☰ 메뉴 ── */
test('★★ ② 폰 ☰ 메뉴의 칸 이름은 한 줄 — 줄어드는 것은 오른쪽 설명뿐', () => {
  assert.ok(has(rules(phoneCss(), /^#menuM\s+\.sheetbtn$/), /white-space:nowrap/),
    '★★ 메뉴 칸 이름이 낱말 가운데서 접힙니다(「새 등록 / 증」)');
  const sub = rules(css, /^#menuM\s+\.sheetbtn\s+\.msub$/);
  assert.ok(has(sub, /min-width:0/) && has(sub, /overflow:hidden/) && has(sub, /text-overflow:ellipsis/),
    '오른쪽 설명이 줄어들지 못합니다 — 이름을 한 줄로 두면 칸이 화면 밖으로 밀립니다');
});

/* ── ③ 👷 근로자 머리 ── */
test('★★ ③ 폰 근로자 화면 제목은 검은 바탕에서 읽히는 빛깔이다', () => {
  const base = rules(baseCss(), /^\.wkbar\s+b$/).map((x) => (x.body.match(/color:(#[0-9a-f]{3,6})/i) || [])[1]).filter(Boolean);
  const ph = rules(phoneCss(), /^\.wkmob\s+\.wkbar\s+b$/);
  if (base.some(dark)) {
    assert.ok(ph.length, '★★ 제목이 PC 의 짙은 글씨 그대로입니다 — 검은 폰 바탕에 묻힙니다');
    ph.forEach((x) => {
      const c = (x.body.match(/color:([^;]+)/) || [])[1] || '';
      assert.ok(/^var\(--ink\)$/.test(c) || (/^#/.test(c) && !dark(c)), '★★ 폰 제목 빛깔이 어둡습니다(' + c + ')');
    });
  }
});

test('③ 폰 근로자 화면 부제는 한 줄 — 넘치면 … 로 줄인다', () => {
  const r = rules(phoneCss(), /^\.wkmob\s+\.wkhint$/);
  assert.ok(has(r, /white-space:nowrap/), '부제가 두 줄로 접혀 표를 밀어 냅니다');
  assert.ok(has(r, /overflow:hidden/) && has(r, /text-overflow:ellipsis/), '한 줄로 두었는데 자르지 않으면 화면 밖으로 나갑니다');
});

test('③ 폰에서 집단 줄을 펴는 ▸ 는 기본보다 넓게 누른다', () => {
  const w = (rs) => rs.map((x) => Number((x.body.match(/(?:^|;)width:(\d+)px/) || [])[1])).filter((n) => n > 0);
  const base = w(rules(baseCss(), /^\.wkfold$/));
  const ph = w(rules(phoneCss(), /^\.wkmob\s+\.wkfold$/));
  assert.ok(base.length, '▸ 의 기본 규칙을 못 찾았습니다');
  assert.ok(ph.length && Math.max(...ph) > Math.max(...base), '★ 폰에서 ▸ 누를 자리가 PC 그대로 좁습니다 — 손끝이 옆 칸을 누릅니다');
});

/* ── ④ 📥 연락처 정리 표 ── */
/* 360px 폰에서 실제로 걸리는 규칙만 차례대로 모아, 칸마다 «이기는» 너비를 셈한다.
   (어느 @media 에도 안 든 것 + max-width 가 360 이상인 @media 안의 것. body.pc 선택자는 뺀다.
    body:not(.pc) 가 붙은 선택자는 붙지 않은 것을 이긴다 — 나머지는 뒤에 적은 것이 이긴다) */
function widthsAt(W) {
  const out = {};
  const put = (sel, body, order) => {
    if (/body\.pc/.test(sel)) return;
    const k = (sel.match(/\.cn-t(?:\.todo)?\s+col(?:\.([a-z]+)|:nth-child\((\d)\))$/) || []);
    if (!k[0]) return;
    const key = k[1] || ('n' + k[2]);
    const w = (body.match(/(?:^|;)width:([^;]+)/) || [])[1];
    if (w === undefined) return;
    const rank = /^body:not\(\.pc\)/.test(sel) ? 1 : 0;
    if (!out[key] || rank > out[key].rank || (rank === out[key].rank && order > out[key].order)) out[key] = { w, rank, order };
  };
  let order = 0;
  const walk = (src, applies) => {
    const re = /@media([^{]*)\{|([^{}@]+)\{([^{}]*)\}/g;
    let m;
    while ((m = re.exec(src))) {
      if (m[1] !== undefined) {
        let d = 1, i = re.lastIndex;
        for (; i < src.length && d; i++) { if (src[i] === '{') d++; else if (src[i] === '}') d--; }
        const mx = (m[1].match(/max-width\s*:\s*(\d+)px/) || [])[1], mn = (m[1].match(/min-width\s*:\s*(\d+)px/) || [])[1];
        const ok = /\(\s*(max|min)-width/.test(m[1]) && (!mx || W <= Number(mx)) && (!mn || W >= Number(mn));
        if (ok && applies) walk(src.slice(re.lastIndex, i - 1), true);
        re.lastIndex = i;
        continue;
      }
      if (!applies) continue;
      const body = m[3].replace(/\s+/g, '');
      m[2].split(',').map((s) => s.trim()).forEach((s) => put(s, body, ++order));
    }
  };
  walk(css, true);
  return out;
}

test('★★ ④ 📥 연락처 정리 표는 가장 좁은 폰(360px)에도 들어간다 — 맨 오른쪽 🙈 가 잘리지 않게', () => {
  const W = 360;
  const ws = widthsAt(W);
  ['ck', 'no', 'nm', 'act'].forEach((k) => assert.ok(ws[k], 'col.' + k + ' 의 너비 규칙을 못 찾았습니다'));
  const px = (k) => { const v = ws[k] && ws[k].w; return /^\d+px$/.test(v || '') ? Number(v.replace('px', '')) : 0; };   /* auto·0 은 «남는 자리» */
  const fixed = ['ck', 'no', 'nm', 'em', 'n5', 'sg', 'act'].reduce((a, k) => a + px(k), 0);
  const pad = rules(css, /^body:not\(\.pc\)\s+\.cn$/).map((x) => padX(x.raw)).filter((n) => !isNaN(n));
  const room = W - 2 * (pad.length ? Math.max(...pad) : 0) - 2;   /* 표 테두리 1px 씩 */
  assert.ok(fixed <= room, '★★ 360px 폰에서 칸 너비 합(' + fixed + 'px)이 자리(' + room + 'px)보다 넓습니다 — 맨 오른쪽 단추가 잘립니다');
});

test('④ 폰 연락처 정리의 ☐ 고르기 칸은 손끝 크기로 키우되, 제 칸 안에 들어간다(잘리지 않는다)', () => {
  const ph = phoneCss();
  const box = rules(ph, /\.cn-t\s+\.ck\s+input$/).map((x) => Number((x.body.match(/(?:^|;)width:(\d+)px/) || [])[1])).filter((n) => n > 0);
  assert.ok(box.length, '폰에서 고르기 칸을 키우는 규칙이 없습니다 — 13px 기본 크기는 손끝에 작습니다');
  const tdPad = rules(ph, /\.cn-t\s+td\.ck$/).map((x) => padX(x.raw)).filter((n) => !isNaN(n));
  const col = widthsAt(360).ck;
  const colW = Number(String(col && col.w).replace('px', ''));
  const pad = tdPad.length ? Math.min(...tdPad) : 6;
  assert.ok(Math.max(...box) + 2 * pad <= colW, '★ 고르기 칸(' + Math.max(...box) + 'px)이 제 칸(' + colW + 'px) 안에 안 들어가 잘립니다');
});
