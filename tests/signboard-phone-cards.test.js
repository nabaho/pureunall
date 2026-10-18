/* 전광판 — 폰에서 표를 «줄마다 두 줄 카드»로 (대표 지시 2026-10-18 「폰화면관리」)

   ★ 고치기 전(360·411px 실측 — 가짜 광고 26건·올린 판 12·활동 기록 40건)
     표 넷(광고·올린 기록·지운 광고·활동 기록)이 모두 옆으로 미는 상자라 ☐·번호·제목만 보였다.
     켜기·상태·전광판 반영·되돌리기·되살리기·«그때 내용» 단추는 옆으로 밀어야 보였고,
     머리(세 줄)·올리기 띠(두 줄)·탭(두 줄)이 첫 화면 절반을 먹었다.

   ★ 이 검사가 못 박는 것은 «몇 px» 이 아니라 규칙이다
     ① 폰 구간에서 표(data-name)를 카드로 편다 — 다시 옆으로 밀리지 않게
     ② 화면 부품이 그리는 칸에는 모두 손잡이(data-k 또는 c·n·ti)가 있다 — 새 칸이 손잡이 없이 끼면 카드에서 길을 잃는다
     ③ 폰 CSS 가 붙잡는 칸 이름(data-k)은 화면 부품이 실제로 그린다 — 이름이 어긋나면 규칙이 «조용히» 안 먹는다
     ④ 폰에서도 광고 표의 ☐ 고르기 칸과 번호는 남는다(CLAUDE.md «자료 목록의 맨 왼쪽» 규칙)
     ⑤ 폰에서 칸(td)을 숨겨 값을 지우지 않는다 — 머리줄(th)만 접는다
     ⑥ 탭은 한 줄(두 줄로 접지 않는다)
     ⑦ 넓은 화면에서는 폰 글자(.phone-only)가 안 보이고, 폰에서는 긴 글자(.wide-only)를 접는다
     ⑧ 편집 창의 «저장»은 폰에서 아래에 붙어 늘 보인다(긴 입력 칸 밑으로 사라지지 않게)

   실행: node --test tests/signboard-phone-cards.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const C = require('../js/pu-signboard-core.js');
const V = require('../js/pu-signboard-view.js');

const src = fs.readFileSync(path.join(__dirname, '..', 'pu-signboard.html'), 'utf8');
const css = (src.match(/<style>([\s\S]*?)<\/style>/) || [, ''])[1].replace(/\/\*[\s\S]*?\*\//g, ' ');

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
const sels = (r) => r.sel.split(',').map((x) => x.trim());

/* 화면 부품이 그리는 표 넷 — 값이 다 차 있는 자료로 */
const NOW = Date.UTC(2026, 9, 15, 3, 0, 0);
function ad(id, order, over) { const a = C.newAd('text', { id, order }); a.title = '광고 ' + id; a.text.string = '문구'; return Object.assign(a, over || {}); }
const ads = [ad('ad_a', 1, { period: { start: '2026-10-01', end: '2026-12-31', weekdays: ['Mon'], times: [{ start: '08:00', end: '20:00' }] } }), ad('ad_b', 2, { enabled: false }), ad('ad_c', 3)];
const pub = { version: 3, publishedAt: NOW, publishedBy: 'P001', note: '메모', ads: [C.snapshotAd(ads[0])] };
const TABLES = {
  ads: V.adsTable(ads, { now: NOW, publishedAds: pub.ads }),
  hist: V.historyTable([C.historyRecord(pub), Object.assign(C.historyRecord(pub), { version: 2 })], 3),
  log: V.logTable([C.logRecord('create', { now: NOW, actor: 'P001', actorName: '점검', ad: ads[0] }), C.logRecord('publish', { now: NOW, actor: 'P001', version: 3, count: 1 })]),
  del: V.deletedTable([ad('ad_d', 4, { _deleted: true, deletedAt: NOW, deletedBy: 'P001' })]),
};

test('① 폰 구간에서 표(data-name)를 줄마다 카드로 편다', () => {
  assert.ok(phone.length >= 1, '폰 구간(max-width ≤ 640px)을 못 찾음');
  const tbl = phoneRules.some((r) => sels(r).some((s) => /\.t\[data-name\]\s*(,|$)/.test(s + ',')) && /display\s*:\s*block/.test(r.body));
  assert.ok(tbl, '폰에서 표(.t[data-name])를 block 으로 풀지 않았다 — 다시 옆으로 밀린다');
  const row = phoneRules.some((r) => sels(r).some((s) => /\.t\[data-name\]\s+tbody\s+tr$/.test(s)) && /display\s*:\s*(flex|grid)/.test(r.body));
  assert.ok(row, '폰에서 줄(tr)을 카드(flex·grid)로 펴지 않았다');
  for (const [name, h] of Object.entries(TABLES)) assert.match(h, new RegExp('<table[^>]*data-name="' + name + '"'), name + ' 표에 data-name 이 없다 — 폰 카드 규칙이 안 먹는다');
});

test('② 화면 부품이 그리는 칸에는 모두 손잡이(data-k 또는 c·n·ti)가 있다', () => {
  for (const [name, h] of Object.entries(TABLES)) {
    const tds = [...h.matchAll(/<td\b[^>]*>/g)].map((m) => m[0]);
    assert.ok(tds.length >= 3, name + ' 표의 칸을 못 읽음');
    for (const td of tds) assert.ok(/\bdata-k="[\w-]+"/.test(td) || /class="(c|n|ti)"/.test(td), name + ' 표에 손잡이 없는 칸: ' + td);
  }
});

test('③ 폰 CSS 가 붙잡는 칸 이름(data-k)은 화면 부품이 실제로 그린다', () => {
  const all = Object.values(TABLES).join('');
  const used = new Set([...phone.map((b) => b.body).join('').matchAll(/data-k="([\w-]+)"/g)].map((m) => m[1]));
  assert.ok(used.size >= 5, '폰 CSS 에서 칸 이름을 못 찾음 — 이 검사의 찾는 법을 고쳐야 한다');
  for (const k of used) assert.ok(all.includes('data-k="' + k + '"'), '폰 CSS 의 data-k="' + k + '" 를 화면 부품이 안 그린다 — 그 규칙이 조용히 안 먹는다');
});

test('④ 폰에서도 광고 표의 ☐ 고르기 칸과 번호는 숨기지 않는다', () => {
  for (const r of phoneRules) {
    if (!/display\s*:\s*none/.test(r.body)) continue;
    for (const s of sels(r)) assert.ok(!/(td|th)\.(c|n)\b/.test(s) || /:not\(/.test(s), '폰에서 「' + s + '」을 숨긴다 — ☐·번호는 폰에서도 남아야 한다');
  }
  /* 광고 표 머리줄은 접어도 ☐(보이는 것 모두)는 다시 보이게 한다 */
  assert.ok(phoneRules.some((r) => sels(r).some((s) => /\[data-name=ads\][^,]*th\.c\b/.test(s)) && /display\s*:\s*(block|flex|inline|table-cell)/.test(r.body)),
    '폰에서 광고 표 머리줄의 ☐(보이는 것 모두 고르기)가 안 보인다');
});

test('⑤ 폰에서 칸(td)을 숨겨 값을 지우지 않는다 — 머리줄(th)만 접는다', () => {
  for (const r of phoneRules) {
    if (!/display\s*:\s*none/.test(r.body)) continue;
    for (const s of sels(r)) assert.ok(!/\btd\b[^\s>+~]*$/.test(s), '폰에서 칸 「' + s + '」을 통째로 숨긴다 — 그 값이 폰에서 사라진다');
  }
});

test('⑥ 탭은 한 줄 — 두 줄로 접지 않는다', () => {
  const r = phoneRules.find((x) => sels(x).includes('.tabs'));
  assert.ok(r, '폰 구간에 .tabs 규칙이 없다');
  assert.match(r.body, /flex-wrap\s*:\s*nowrap/, '폰에서 탭이 두 줄로 접힌다');
});

test('⑦ 넓은 화면에서는 폰 글자가 안 보이고, 폰에서는 긴 글자를 접는다', () => {
  assert.ok(rules(outside).some((r) => /^\.phone-only$/.test(r.sel) && /display\s*:\s*none/.test(r.body)), '넓은 화면에서 .phone-only 가 보인다');
  assert.ok(phoneRules.some((r) => /\.wide-only/.test(r.sel) && /display\s*:\s*none/.test(r.body)), '폰에서 .wide-only 를 접지 않았다');
  assert.ok(phoneRules.some((r) => /\.phone-only/.test(r.sel) && /display\s*:\s*inline/.test(r.body)), '폰에서 .phone-only 를 보이게 하지 않았다');
});

test('⑧ 편집 창의 아래 단추 줄(저장)은 폰에서 붙어 있다', () => {
  assert.ok(phoneRules.some((r) => sels(r).includes('.mfoot') && /position\s*:\s*sticky/.test(r.body) && /bottom\s*:/.test(r.body)),
    '폰에서 편집 창 «저장» 줄이 긴 입력 칸 밑으로 사라진다');
});
