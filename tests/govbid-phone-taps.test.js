/* 정부사업신청 — 폰에서 ☐ 고르기 칸이 «모두» 손끝 크기인가 (대표 지시 2026-10-18 「폰화면관리」)

   ★ 어제(2026-10-17) 폰 정리 뒤 가짜 자료(공고 32·발주 예정 26·모집 글 28)로 다시 재 보니 남은 흠
     · 줄 ☐ 가 20px — 「작은단추」 23~27건이 전부 이것
     · 컨설턴트 모집 표의 머리 ☐(보이는 것 모두)는 id·class 가 없어 폰 크기 규칙을 못 받고 13px 그대로였다
       (recChkHead 가 그리는 것 — 공고·발주 머리 ☐ 는 #fSelAll·#pSelAll 이름으로 받았다)

   ★ 이 검사가 못 박는 규칙(지금 px 이 아니라)
     폰 구간에서 줄 ☐(.row-chk)와 «모든» 머리 ☐ 가 누를 수 있는 최소 크기(WCAG 2.5.8 «24px» — 이 수 자체가 규칙이다) 이상.
     머리 ☐ 는 이름(id)이 있든 없든 빠지지 않아야 한다 — 이름 없는 머리 ☐ 가 있으면 th.chk 로 받는 규칙이 있어야 한다.

   실행: node --test tests/govbid-phone-taps.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const src = fs.readFileSync(path.join(__dirname, '..', 'gov.html'), 'utf8');
const css = (src.match(/<style>([\s\S]*?)<\/style>/) || [, ''])[1].replace(/\/\*[\s\S]*?\*\//g, ' ');
const MIN_TAP = 24;   // WCAG 2.5.8 «누를 것의 최소 크기» — 이 수 자체가 규칙이다

function phoneBodies() {
  const out = [];
  const re = /@media([^{]*)\{/g;
  let m;
  while ((m = re.exec(css))) {
    let i = m.index + m[0].length, depth = 1;
    const start = i;
    while (i < css.length && depth > 0) { if (css[i] === '{') depth++; else if (css[i] === '}') depth--; i++; }
    const w = (m[1].match(/max-width\s*:\s*(\d+)px/) || [])[1];
    if (w && Number(w) <= 640) out.push(css.slice(start, i - 1));
  }
  return out.join('\n');
}
const phoneRules = [...phoneBodies().matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((r) => ({ sels: r[1].split(',').map((s) => s.trim()), body: r[2] }));
/* 손끝 크기 이상을 매기는 선택자들 */
const big = new Set();
phoneRules.forEach((r) => {
  const w = Number((r.body.match(/(^|;)\s*width\s*:\s*(\d+)px/) || [])[2] || 0), h = Number((r.body.match(/(^|;)\s*height\s*:\s*(\d+)px/) || [])[2] || 0);
  if (w >= MIN_TAP && h >= MIN_TAP) r.sels.forEach((s) => big.add(s));
});
const headSel = [...big].some((s) => /^th\.chk\s*>?\s*input(\[type=checkbox\])?$/.test(s));

test('폰에서 줄 ☐(.row-chk)는 손끝 크기 이상', () => {
  assert.ok(big.has('.row-chk'), '폰 구간에 .row-chk 를 ' + MIN_TAP + 'px 이상으로 매기는 규칙이 없다');
});

test('폰에서 «모든» 머리 ☐ 가 손끝 크기 이상 — 이름이 있는 것은 이름으로, 없는 것은 th.chk 로', () => {
  /* 마크업·그리는 코드에 있는 머리 ☐ 를 모두 찾는다 */
  const heads = [...src.matchAll(/<th class="chk"><input type="checkbox"([^>]*)>/g)].map((m) => m[1]);
  assert.ok(heads.length >= 3, '머리 ☐ 를 못 찾음 — 이 검사의 찾는 법을 고쳐야 한다');
  for (const a of heads) {
    const id = (a.match(/\bid="([\w-]+)"/) || [])[1];
    const ok = headSel || (id && big.has('#' + id));
    assert.ok(ok, '폰에서 작게 남는 머리 ☐: ' + (id ? '#' + id : '(이름 없음)' + a.slice(0, 60)) + ' — th.chk 로 받는 규칙을 더하세요');
  }
});

/* 2026-10-18 전수점검 뒤 덧붙임 — 폰 둘째 줄이 넘치면 «끝»이 잘린다. 잘려도 되는 것은 기관(전문은 상세)이고 금액은 아니다. */
test('폰 둘째 줄: 금액은 기관보다 앞에 — 넘치면 기관이 잘린다', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const src = fs.readFileSync(path.join(__dirname, '..', 'gov.html'), 'utf8').replace(/\r\n/g, '\n');
  for (const fn of ['function feedMobile(', 'function planMobile(']) {
    const at = src.indexOf(fn);
    assert.ok(at >= 0, fn + ' 를 못 찾았습니다');
    const body = src.slice(at, src.indexOf('\n}\n', at));
    const 금액 = body.indexOf('class="mpr"'), 기관 = body.indexOf('class="mog"');
    assert.ok(금액 > 0 && 기관 > 0, fn + ' — 금액(mpr)·기관(mog) 조각이 없습니다');
    assert.ok(금액 < 기관, fn + ' — 기관이 금액보다 앞이면 줄이 넘칠 때 금액 끝이 잘립니다');
  }
});
