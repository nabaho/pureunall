/* 회생광고 — 폰 한 화면에 다 보이는가 (대표 지시 2026-10-17 「회생광고 폰화면 한화면에 모두볼 수 있게 정열해라」)

   ★ 고치기 전(412px 실측)
     표 폭 1280px — 화면의 3배. ☐·★·번호·회사명 넷만 보이고 구분·공고·대표자·거래·지역·연락처·발송·상태
     여덟 칸은 화면 밖이었다. 상태 탭은 좁은 칸에 눌려 「전/체」「미/검/토」로 세로로 갈라졌다.

   ★ 고친 방식 — 줄 하나를 «카드 두 줄»로. 첫 줄은 ☐ ★ 번호 회사명, 둘째 줄(td.mm)에 접은 칸의 값을 모은다.
     실측(Playwright · 가짜 공고 72건): 412·360px 모두 가로 넘침 0, 표 폭 = 화면 폭. PC(1400px)는 화면이 고치기 전과 한 점도 안 다르다.

   ★ 이 검사가 못 박는 것은 «몇 px» 이 아니라 규칙이다
     ① 폰에서 표의 가로 최소폭을 푼다 — 안 그러면 다시 옆으로 밀린다
     ② 폰에서도 ☐ 고르기 칸과 번호는 남는다(CLAUDE.md «자료 목록의 맨 왼쪽» 규칙)
     ③ 폰에서 접은 칸의 값은 둘째 줄(td.mm)에 살아 있다 — 접기가 «지우기»가 되면 안 된다
     ④ 탭 글자는 줄바꿈하지 않는다(세로로 갈라지던 것)
     ⑤ 탭·빠른 단추가 넘치면 «다음 줄로» — 옆으로 밀어 숨기지 않는다
     ⑥ 넓은 화면에서는 둘째 줄(td.mm)과 폰 글자가 안 보인다

   실행: node --test tests/rehab-ad-phone-fit.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const src = fs.readFileSync(path.join(__dirname, '..', 'rehab-ad.html'), 'utf8');
const css = (src.match(/<style>([\s\S]*?)<\/style>/) || [, ''])[1].replace(/\/\*[\s\S]*?\*\//g, ' ');
const js = src.slice(src.indexOf('function draw(){'));

/* @media 몸통을 괄호 짝으로 떼어 낸다 — 폰 구간(max-width ≤ 640)과 그 밖을 가른다 */
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
const phone = blocks.filter((b) => { const w = (b.cond.match(/max-width\s*:\s*(\d+)px/) || [])[1]; return w && Number(w) <= 640; });
const outside = blocks.reduceRight((s, b) => s.slice(0, b.from) + s.slice(b.to), css);
function rules(body) { return [...body.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((r) => ({ sel: r[1].trim(), body: r[2] })); }
const phoneRules = phone.flatMap((b) => rules(b.body));

test('① 폰에서 표의 가로 최소폭을 푼다', () => {
  assert.ok(phone.length >= 1, '폰 구간(max-width ≤ 640px)을 못 찾음');
  const ok = phoneRules.some((r) => /\btable\b/.test(r.sel) && /min-width\s*:\s*(0|auto|none)\b/.test(r.body));
  assert.ok(ok, '폰 구간에서 table 의 min-width 를 풀지 않았다 — 표가 다시 화면 밖으로 밀린다');
});

test('② 폰에서도 ☐ 고르기 칸과 번호 칸은 숨기지 않는다', () => {
  for (const r of phoneRules) {
    if (!/display\s*:\s*none/.test(r.body)) continue;
    for (const one of r.sel.split(',')) {
      assert.ok(!/(td|th)\.(ck|no)\b/.test(one) || /:not\(/.test(one), '폰에서 「' + one.trim() + '」을 숨긴다 — ☐·번호는 폰에서도 남아야 한다');
    }
  }
});

/* draw() 가 그 칸에 넣는 값의 출처 — 함수 부르기(esc 제외), 없으면 속성 읽기(n.id 제외) */
function sourcesOf(code) {
  const bare = code.replace(/'(?:[^'\\]|\\.)*'/g, '');
  const calls = [...bare.matchAll(/\b([A-Za-z_$][\w$]*)\(/g)].map((m) => m[1]).filter((f) => f !== 'esc');
  if (calls.length) return calls;
  return [...bare.matchAll(/\b([a-z_$][\w$]*\.[A-Za-z_$][\w$]*)/g)].map((m) => m[1]).filter((p) => p !== 'n.id');
}

test('③ 폰에서 접은 칸의 값은 둘째 줄(td.mm)에 살아 있다', () => {
  const hidden = new Set();
  for (const r of phoneRules) {
    if (!/display\s*:\s*none/.test(r.body)) continue;
    for (const one of r.sel.split(',')) { const m = one.match(/#rows\s+td\.([\w-]+)\s*$/); if (m) hidden.add(m[1]); }
  }
  /* st-new: 상태가 «미검토»인 줄의 딱지만 뺀다 — 탭 숫자가 같은 것을 알려 주고, 다른 상태 딱지는 그대로 보인다 */
  hidden.delete('st-new');
  assert.ok(hidden.size >= 1, '폰에서 접는 칸을 못 찾음 — 이 검사의 찾는 법을 고쳐야 한다');
  const metaFn = (src.match(/function phoneMeta\([^)]*\)\{([\s\S]*?)\n\}/) || [])[1];
  assert.ok(metaFn, 'phoneMeta(둘째 줄을 그리는 함수)가 없다');
  assert.ok(/'<td class="mm">'\+phoneMeta\(/.test(js), 'draw() 가 줄마다 td.mm 에 phoneMeta 를 넣지 않는다');
  for (const cls of hidden) {
    const at = js.indexOf('<td class="' + cls + '"');
    assert.ok(at >= 0, 'draw() 에서 td.' + cls + ' 를 못 찾음');
    const cell = js.slice(at - 1, js.indexOf('</td>', at));   // 여는 따옴표부터 — 글자열 짝이 맞아야 값 출처만 남는다
    const srcs = sourcesOf(cell);
    assert.ok(srcs.length, 'td.' + cls + ' 의 값 출처를 못 읽음');
    assert.ok(srcs.some((s) => metaFn.includes(s)), '폰에서 td.' + cls + ' 를 숨기는데 그 값(' + srcs.join('·') + ')이 둘째 줄에 없다 — 폰에서 사라진다');
  }
});

test('④ 탭 글자는 줄바꿈하지 않는다 — 「전/체」로 세로로 갈라지지 않게', () => {
  const ok = rules(outside).some((r) => /\.tab\b/.test(r.sel) && /white-space\s*:\s*nowrap/.test(r.body));
  assert.ok(ok, '탭 글자에 줄바꿈 금지가 없다 — 좁은 폰에서 글자가 한 자씩 세로로 쌓인다');
});

test('⑤ 폰에서 탭·빠른 단추를 옆으로 밀어 숨기지 않는다', () => {
  for (const r of phoneRules) {
    if (!/(\.tabs|#tabs|#funnel)\b/.test(r.sel)) continue;
    assert.ok(!/flex-wrap\s*:\s*nowrap/.test(r.body) && !/overflow(-x)?\s*:\s*(auto|scroll|hidden)/.test(r.body),
      '「' + r.sel + '」이 넘칠 때 옆으로 숨긴다 — 다음 줄로 내려야 한다(숨은 단추는 없는 것과 같다)');
  }
});

test('⑥ 넓은 화면에서는 둘째 줄(td.mm)과 폰 글자를 숨기고, 폰에서만 보인다', () => {
  const base = rules(outside);
  assert.ok(base.some((r) => /^td\.mm$/.test(r.sel) && /display\s*:\s*none/.test(r.body)), '넓은 화면에서 td.mm 이 보인다 — PC 표에 칸이 하나 늘어난다');
  assert.ok(base.some((r) => /^\.phone-only$/.test(r.sel) && /display\s*:\s*none/.test(r.body)), '넓은 화면에서 폰 글자(.phone-only)가 보인다');
  assert.ok(phoneRules.some((r) => /td\.mm/.test(r.sel) && /display\s*:\s*(flex|block|grid)/.test(r.body)), '폰에서 td.mm 을 보이게 하지 않았다');
  assert.ok(phoneRules.some((r) => /\.wide-only/.test(r.sel) && /display\s*:\s*none/.test(r.body)), '폰에서 긴 글자(.wide-only)를 접지 않았다');
});
