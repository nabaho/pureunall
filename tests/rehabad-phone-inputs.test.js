/* 회생광고 — 폰에서 입력칸 글씨가 «정말» 16px 인가 (대표 지시 2026-10-18 「폰화면관리」)

   ★ 어제(2026-10-17) 폰 정리 뒤 가짜 자료로 다시 재 보니 남은 흠
     폰 구간에 «input,select,textarea{16px}» 는 있었다(tests/phone-input-zoom 은 그것만 본다).
     그런데 더 센 규칙 — .bar select{12.5px} · .moreF select{12.5px} · 상세 .f input{font:inherit → 12.5px} —
     이 그것을 이겨 거르개 셋·필터 여섯·상세 입력 여섯이 12.5px 이었다. 아이폰은 누를 때마다 화면을 키운다.

   ★ 이 검사가 못 박는 규칙(px 값이 아니라)
     폰 구간 «밖»에서 입력칸(input·select·textarea)에 글씨(font-size·font)를 매기는 «센» 규칙은
     폰 구간에서 같은 선택자로 16px 이상(아이폰이 확대하지 않는 하한 — 이 수 자체가 규칙이다)을 다시 매긴다.
     맨 요소 규칙(input 하나만)은 폰 구간의 맨 요소 규칙이 이긴다 — 따로 볼 것 없다.
     화면에 없는 이름(옛 .tools 처럼 아무 데도 안 쓰는 class)은 뺀다.

   실행: node --test tests/rehabad-phone-inputs.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const src = fs.readFileSync(path.join(__dirname, '..', 'rehab-ad.html'), 'utf8');
const css = (src.match(/<style>([\s\S]*?)<\/style>/) || [, ''])[1].replace(/\/\*[\s\S]*?\*\//g, ' ');
const markup = src.replace(/<style>[\s\S]*?<\/style>/, '');
const NO_ZOOM = 16;   // 아이폰이 입력칸을 누를 때 화면을 키우지 않는 글씨 하한 — 이 수 자체가 규칙이다

function mediaBlocks() {
  const out = [];
  const re = /@media([^{]*)\{/g;
  let m;
  while ((m = re.exec(css))) {
    let i = m.index + m[0].length, depth = 1;
    const start = i;
    while (i < css.length && depth > 0) { if (css[i] === '{') depth++; else if (css[i] === '}') depth--; i++; }
    out.push({ cond: m[1], body: css.slice(start, i - 1), from: m.index, to: i });
  }
  return out;
}
const blocks = mediaBlocks();
const isPhone = (b) => { const w = (b.cond.match(/max-width\s*:\s*(\d+)px/) || [])[1]; return w && Number(w) <= 640; };
const phone = blocks.filter(isPhone);
/* 폰 구간 밖 = 맨 바깥 + 폰이 아닌 @media 안 */
const outsideCss = blocks.reduceRight((s, b) => s.slice(0, b.from) + s.slice(b.to), css) + '\n' + blocks.filter((b) => !isPhone(b)).map((b) => b.body).join('\n');
function rules(body) { return [...body.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((r) => ({ sels: r[1].split(',').map((s) => s.trim().replace(/\s+/g, ' ')), body: r[2] })); }
const phoneRules = phone.flatMap((b) => rules(b.body));

/* 입력칸을 겨누는가(마지막 마디가 input·select·textarea) · 맨 요소인가 */
const targetsInput = (s) => /(^|[\s>+~])(input|select|textarea)(\[[^\]]*\])*(:[\w-]+)*$/.test(s);
const bare = (s) => /^(input|select|textarea)$/.test(s);
/* 화면에 실제로 있는 이름인가 — 첫 class·id 가 마크업이나 그리는 코드에 나오는가 */
function used(s) {
  const m = s.match(/[.#]([\w-]+)/);
  if (!m) return true;
  return new RegExp('(class|id)="[^"]*\\b' + m[1] + '\\b|[\'"]' + m[1] + '[\'"\\s]|class=\\\\?"[^"]*\\b' + m[1] + '\\b').test(markup);
}

test('폰 구간 밖에서 입력칸 글씨를 매기는 센 규칙은 폰 구간에서 같은 선택자로 16px 이상을 다시 매긴다', () => {
  assert.ok(phone.length >= 1, '폰 구간(max-width ≤ 640px)을 못 찾음');
  const need = [];
  for (const r of rules(outsideCss)) {
    if (!/(^|;)\s*font(-size)?\s*:/.test(r.body)) continue;
    for (const s of r.sels) if (targetsInput(s) && !bare(s) && used(s)) need.push(s);
  }
  assert.ok(need.length >= 2, '입력칸 글씨를 매기는 규칙을 못 찾음 — 이 검사의 찾는 법을 고쳐야 한다');
  const ok = new Set();
  for (const r of phoneRules) {
    const fs = Number((r.body.match(/font-size\s*:\s*(\d+(?:\.\d+)?)px/) || [])[1] || 0);
    if (fs >= NO_ZOOM) r.sels.forEach((s) => ok.add(s));
  }
  const miss = need.filter((s) => !ok.has(s));
  assert.deepEqual(miss, [], '폰에서 16px 아래로 남는 입력칸: ' + miss.join(' · ') + ' — 폰 구간에 같은 선택자로 font-size 16px 이상을 더하세요');
});

test('폰에서 ☐ 고르기 칸은 손가락으로 누를 최소 크기(WCAG 2.5.8 «24px» — 이 수 자체가 규칙이다) 이상', () => {
  const r = phoneRules.find((x) => x.sels.includes('td.ck input'));
  assert.ok(r, '폰 구간에 ☐(td.ck input) 크기 규칙이 없다');
  const w = Number((r.body.match(/(^|;)\s*width\s*:\s*(\d+)px/) || [])[2] || 0), h = Number((r.body.match(/(^|;)\s*height\s*:\s*(\d+)px/) || [])[2] || 0);
  assert.ok(w >= 24 && h >= 24, '폰 ☐ 가 손끝보다 작다(' + w + '×' + h + ')');
});
