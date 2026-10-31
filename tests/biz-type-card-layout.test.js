'use strict';
/* 🗂 사무관리기준 업무유형 카드 — PC 와 폰이 «같은 글자»를 보이고, 컨설팅 카드는 «칸이 세로로 맞는다»
   (대표 지시 2026-10-26 → 2026-10-31 「컨설팅유형에서 열 정리해달라」)

   ■ 규칙이 이렇게 바뀌었다 (왜 이 파일의 ①②③ 이 10/26 판과 다른가)
   10/26 규칙은 「이름 + 칩(수행기관·단가·셈)을 한 덩어리에 나란히, 모자랄 때만 줄바꿈」이었다.
   그 모양은 칩이 이름 길이마다 다른 자리에 붙고, 오른쪽 «👤 개인» 단추 폭도 켜짐·꺼짐에 따라 달라 줄마다 들쭉날쭉했다.
   10/31 대표가 «제안 A» 를 골랐다 — 컨설팅 카드만 칸(약어 | 사업명 | 수행기관 | 단가·셈 | 개인입금 | ✏ | ×)을 세로로 맞춘 «표 줄»로,
   카드는 윗줄 «전체 폭», 나머지 네 카드는 아래 한 줄. 카드 폭이 모자라면(폰 포함) 두 줄로 접는다(컨테이너 쿼리).
   ★ 취지는 그대로다: PC 와 폰이 «같은 글자»를 보이고, 칩이 말줄임(…)으로 사라지지 않는다. 바뀐 것은 «방법»이다 — 줄바꿈 → 카드 폭에 따라 한 줄/두 줄.

   ★ 규칙 (값이 아니라 규칙)
     ① 컨설팅 줄은 «칸이 같은 표 줄» — 머리글과 줄이 같은 칸 모양(8칸)이고, 빈 값도 칸을 둔다(비면 뒤 칸이 앞으로 밀려 어긋난다)
        · 칩(단가·셈)은 어떤 폭에서도 안 잘린다(nowrap, 말줄임 없음) · 카드 폭이 모자라면 «창 폭이 아니라 카드 폭» 으로 두 줄로 접는다
        · 다른 네 카드(업체·사건·기금·기타사업)의 줄은 예전 모양 그대로다
     ② 컨설팅 카드는 769px 이상에서만 윗줄 전체 폭(order -1)이다 — 폰(768 이하)은 한 칸 그리드이고 카드 순서도 그대로
     ③ PC(1100px 이상) 칸 수는 «컨설팅을 뺀» 카드 수와 같고, 이름이 긴 기금 카드가 그 가운데 가장 넓다
     ④ 새 유형은 «끝 자리»(기타 = 900 이상) 앞에 놓인다 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn');
const { stripComments } = require('./strip-comments');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const ERP = stripComments(read('pu-erp.html'));
const CSS = read('css/pu-erp.css').replace(/\r\n/g, '\n');

/* ── CSS 에서 @media·@container 블록과 최상위 규칙을 가른다 ── */
function atBlocks(css, kind) {
  const out = [];
  const re = new RegExp('@' + kind + '\\s*([^{]+)\\{', 'g');
  let m;
  while ((m = re.exec(css))) {
    let i = re.lastIndex, d = 1;
    for (; i < css.length && d; i++) { if (css[i] === '{') d++; else if (css[i] === '}') d--; }
    out.push({ cond: m[1].replace(/\s+/g, ' ').trim(), body: css.slice(re.lastIndex, i - 1), start: m.index, end: i });
  }
  return out;
}
const mediaBlocks = (css) => atBlocks(css, 'media');
const containerBlocks = (css) => atBlocks(css, 'container');
function topLevel(css) {
  let s = css;
  const bs = mediaBlocks(css).concat(containerBlocks(css)).sort((a, b) => a.start - b.start);
  for (let k = bs.length - 1; k >= 0; k--) s = s.slice(0, bs[k].start) + s.slice(bs[k].end);
  return s;
}
/* 「컨설팅 카드를 윗줄 전체 폭·맨 앞으로 올리는 자리」가 769px 이상 말고 어디 있나 */
function placedOutsideWide(css) {
  const bad = [];
  const re = /\.biz-type-card-consulting\s*\{[^}]*(grid-column\s*:|order\s*:)/;
  if (re.test(topLevel(css))) bad.push('최상위');
  mediaBlocks(css).forEach((b) => {
    if (re.test(b.body) && !/^\(min-width:\s*769px\)$/.test(b.cond)) bad.push(b.cond);
  });
  return bad;
}
/* grid-template-columns 값의 «칸 수» — minmax(…) 안의 쉼표·공백은 한 칸이다 */
function tracks(v) {
  let d = 0, cur = '', n = 0;
  for (const ch of v.trim()) {
    if (ch === '(') d++;
    if (ch === ')') d--;
    if (/\s/.test(ch) && !d) { if (cur) n++; cur = ''; } else cur += ch;
  }
  return cur ? n + 1 : n;
}

/* ── ① 컨설팅 줄 — 칸이 같은 표 줄 ── */
test('①★ 머리글과 줄이 «같은 칸 모양»(8칸)이다 — 다르면 줄마다 칸이 어긋난다', () => {
  const m = /\.bt-row,\s*\.bt-head\s*\{[^}]*grid-template-columns:\s*([^;]+);/.exec(topLevel(CSS));
  assert.ok(m, '★ .bt-row 와 .bt-head 가 같은 규칙(같은 칸 모양)에 있지 않습니다 — 머리글이 줄과 어긋납니다');
  assert.equal(tracks(m[1]), 8, '칸 수가 8(⋮⋮·약어·사업명·수행기관·단가셈·개인·✏·×)이 아닙니다: ' + m[1]);
  const card = cutFn(ERP, 'function BizTypeCard(props)');
  const head = /className:'bt-head'\s*\},\s*\[([^\]]*)\]\.map/.exec(card);
  assert.ok(head, '머리글 줄이 없습니다');
  assert.equal([...head[1].matchAll(/'([^']*)'/g)].length, 8, '★ 머리글 칸 수가 줄과 다릅니다');
  ['약어', '사업명', '수행기관', '단가·셈', '개인입금'].forEach((t) => assert.ok(head[1].includes("'" + t + "'"), '머리글에 「' + t + '」 가 없습니다'));
});

test('①★ 줄의 칸 — 수행기관·단가·셈·개인 칸은 «비어 있어도» 둔다 · .bt-l2 는 넓을 때 칸에 직접 앉는다', () => {
  const card = cutFn(ERP, 'function BizTypeCard(props)');
  const at = card.indexOf("className:'bt-row'");
  assert.ok(at > 0, '컨설팅 줄(bt-row)이 없습니다');
  const end = card.indexOf("return h('div', Object.assign({ key:x.code, style:Object.assign", at);
  assert.ok(end > at, '컨설팅 줄과 다른 카드 줄의 경계를 못 찾았습니다');
  const row = card.slice(at, end);
  ['bt-name', 'bt-l2', 'bt-agency', 'bt-fee', 'bt-pd', 'bt-edit', 'bt-del'].forEach((c) => assert.ok(row.includes(c), '칸(' + c + ')이 없습니다'));
  assert.ok(!/&&\s*h\('span', \{ className:'bt-(agency|fee|pd)'/.test(row),
    '★ 수행기관·단가·셈·개인 칸을 «값이 있을 때만» 그립니다 — 비면 뒤 칸이 앞으로 밀려 줄마다 어긋납니다');
  assert.ok(/\.bt-l2\s*\{\s*display:\s*contents/.test(topLevel(CSS)), '★ .bt-l2 가 넓을 때 display:contents 가 아닙니다 — 칸이 바깥 줄 칸에 안 앉습니다');
});

test('①★ 칩(수행기관·단가·셈)은 안 잘린다 — 단가·셈은 nowrap·말줄임 없음, 수행기관만 극단에서 …(말풍선에 전문)', () => {
  const top = topLevel(CSS);
  assert.ok(/\.bt-chip\s*\{[^}]*white-space:\s*nowrap/.test(top), '칩이 중간에서 줄바꿈됩니다');
  assert.ok(/\.bt-chip\s*\{[^}]*flex-shrink:\s*0/.test(top), '칩이 줄어듭니다');
  ['bt-chip-fee', 'bt-chip-role'].forEach((c) => {
    const r = new RegExp('\\.' + c + '\\s*\\{([^}]*)\\}').exec(top);
    assert.ok(r, c + ' 규칙이 없습니다');
    assert.ok(!/overflow|text-overflow|max-width/.test(r[1]), '★ ' + c + ' 에 말줄임·폭 제한이 있습니다 — 단가·셈 칩이 잘립니다');
  });
  const card = cutFn(ERP, 'function BizTypeCard(props)');
  assert.ok(/className:'bt-chip bt-chip-agency', title:x\.agency/.test(card), '잘릴 수 있는 수행기관 칩에 전문 말풍선(title)이 없습니다');
});

test('①★ 카드 «자신의 폭»으로 두 줄로 접는다 — 창 폭(@media)이 아니라 컨테이너 쿼리', () => {
  assert.ok(/\.biz-type-card-consulting\s*\{[^}]*container-type:\s*inline-size/.test(topLevel(CSS)), '컨설팅 카드가 컨테이너가 아닙니다');
  const cq = containerBlocks(CSS).filter((b) => /^biztype \(max-width:\s*(\d+)px\)$/.test(b.cond));
  assert.equal(cq.length, 1, '★ 카드 폭으로 접는 컨테이너 쿼리가 없습니다');
  const w = Number(/(\d+)px/.exec(cq[0].cond)[1]);
  assert.ok(w >= 600 && w <= 900, '접는 폭(' + w + 'px)이 한 줄 일곱 칸이 들어가는 폭과 안 맞습니다');
  assert.ok(/\.bt-l2\s*\{[^}]*display:\s*flex[^}]*flex-wrap:\s*wrap/.test(cq[0].body), '접힌 모양에서 둘째 줄이 줄바꿈하지 않습니다');
  assert.ok(/\.bt-head\s*\{\s*display:\s*none/.test(cq[0].body), '접힌 모양에서 머리글이 남습니다 — 줄과 안 맞습니다');
  ['bt-pd', 'bt-edit', 'bt-del'].forEach((c) => assert.ok(new RegExp('\\.' + c + '\\s*\\{[^}]*grid-row:\\s*1').test(cq[0].body),
    '접힌 모양에서 ' + c + ' 가 첫 줄에 고정돼 있지 않습니다 — 둘째 줄 뒤로 밀려납니다'));
  assert.ok(/\.bt-l2:not\(:has\(\.bt-chip\)\)\s*\{\s*display:\s*none/.test(cq[0].body),
    '★ 수행기관·단가·셈이 없는 줄에도 빈 둘째 줄이 남습니다 — 폰 목록이 두 배로 길어집니다(한 칸은 한 줄)');
  assert.ok(/\.bt-name\s*\{[^}]*white-space:\s*normal/.test(cq[0].body) && !/\.bt-name\s*\{[^}]*text-overflow:\s*ellipsis/.test(cq[0].body),
    '★ 접힌 모양(폰)에서 사업명이 …로 잘립니다 — 폰에는 말풍선이 없어 잘린 글자를 볼 길이 없습니다');
  /* 접는 일을 창 폭 @media 로 하지 않는다 — 사이드바·창 크기에 따라 카드 폭은 달라진다 */
  mediaBlocks(CSS).forEach((b) => assert.ok(!/\.bt-l2|\.bt-row/.test(b.body), '★ 창 폭(@media ' + b.cond + ')으로 컨설팅 줄을 접습니다 — 카드 폭과 어긋납니다'));
});

test('①★ 다른 네 카드의 줄은 예전 모양 그대로다 — 새 칸 표는 컨설팅에만', () => {
  const card = cutFn(ERP, 'function BizTypeCard(props)');
  assert.ok(/if\(cat\.key === 'consulting'\)\{\s*return h\('div', Object\.assign\(\{ key:x\.code, className:'bt-row'/.test(card), '컨설팅만 새 줄을 쓰는 분기가 아닙니다');
  const at = card.indexOf("className:'biz-type-name', title:tipName,");
  assert.ok(at > 0, '다른 카드 줄의 이름 칸이 없습니다');
  const box = card.slice(at, at + 330);
  assert.match(box, /display:'flex'/); assert.match(box, /flexWrap:'wrap'/);
  assert.ok(/shown\.map\(function\(x\)\{/.test(card), '줄은 «숨기지 않은 것»만 그립니다(숨긴 것은 보관 칸)');
});

/* ── ②③ 카드 폭 ── */
test('②★ 컨설팅 카드는 769px 이상에서만 윗줄 전체 폭이다 — 폰은 한 칸이고 순서도 그대로', () => {
  assert.ok(/\.biz-type-grid\s*\{[^}]*display:\s*grid/.test(topLevel(CSS)), '.biz-type-grid 가 없습니다');
  const wide = mediaBlocks(CSS).find((b) => /^\(min-width:\s*769px\)$/.test(b.cond) && /\.biz-type-card-consulting/.test(b.body));
  assert.ok(wide, '★ 769px 이상에서 컨설팅 카드를 윗줄로 올리는 규칙이 없습니다');
  assert.ok(/grid-column:\s*1\s*\/\s*-1/.test(wide.body) && /order:\s*-1/.test(wide.body), '전체 폭(grid-column 1 / -1)과 맨 앞(order -1)이어야 합니다');
  const phone = mediaBlocks(CSS).filter((b) => /max-width:\s*768px/.test(b.cond) && /\.biz-type-grid\s*\{[^}]*grid-template-columns:\s*1fr\s*;?/.test(b.body));
  assert.ok(phone.length >= 1, '★ 폰에서 카드를 한 칸으로 만드는 규칙이 없습니다');
  assert.deepEqual(placedOutsideWide(CSS), [], '★ 컨설팅 카드를 윗줄로 올리는 규칙이 769px 미만에도 걸려 있습니다 — 폰의 카드 순서가 바뀝니다');
});

test('③★ PC(1100px 이상) 칸 수는 «컨설팅을 뺀» 카드 수와 같고 이름이 긴 기금 카드가 가장 넓다', () => {
  const cats = [...ERP.slice(ERP.indexOf('var BIZ_CATS'), ERP.indexOf('];', ERP.indexOf('var BIZ_CATS'))).matchAll(/\{\s*key:'(\w+)'/g)].map((m) => m[1]);
  assert.ok(cats.length >= 4 && cats.includes('consulting') && cats.includes('fund'), '카드 목록을 못 읽었습니다: ' + cats);
  const pc = mediaBlocks(CSS).find((b) => /min-width:\s*1100px/.test(b.cond) && /\.biz-type-grid/.test(b.body));
  assert.ok(pc, 'PC 폭 규칙이 없습니다');
  const tpl = /grid-template-columns:\s*([^;]+);/.exec(pc.body)[1];
  const w = [...tpl.matchAll(/minmax\(0,\s*([\d.]+)fr\)/g)].map((m) => Number(m[1]));
  const rest = cats.filter((c) => c !== 'consulting');
  assert.equal(w.length, rest.length, '★ PC 칸 수(' + w.length + ')가 컨설팅을 뺀 카드 수(' + rest.length + ')와 다릅니다 — 카드가 줄바꿈되거나 빈 칸이 생깁니다');
  assert.equal(w[rest.indexOf('fund')], Math.max.apply(null, w), '★ 기금 카드가 가장 넓지 않습니다 — 긴 이름(지역공동근로복지기금)이 …로 잘립니다');
});

test('②★ (이빨) 컨설팅 카드를 폰·최상위에 올리는 CSS 는 잡힌다', () => {
  assert.ok(placedOutsideWide('.biz-type-card-consulting { grid-column: 1 / -1; order: -1; }').length >= 1, '최상위를 못 잡습니다');
  assert.ok(placedOutsideWide('@media (max-width: 768px) { .biz-type-card-consulting { order: -1; } }').length >= 1, '폰을 못 잡습니다');
  assert.deepEqual(placedOutsideWide('@media (min-width: 769px) { .biz-type-card-consulting { grid-column: 1 / -1; order: -1; } }'), [], '769 이상은 허용인데 헛경고');
});

test('①★ (이빨) 머리글과 줄의 칸 모양이 다르면 잡힌다', () => {
  assert.equal(tracks('12px 56px minmax(0, 1.3fr) minmax(0, 1fr) 172px 66px 20px 20px'), 8);
  assert.notEqual(tracks('12px 56px minmax(0, 1.3fr) minmax(0, 1fr) 172px 66px 20px'), 8, '칸 하나가 모자란 것을 못 셉니다');
});

/* ── ④ 새 유형 자리 ── */
test('④★ 새 유형은 «끝 자리»(기타) 앞에 놓인다 — 기타 뒤(1009)에 붙지 않는다', () => {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(cutFn(ERP, 'function bizTypeNextOrder(cur)') + '\nthis.f = bizTypeNextOrder;', ctx);
  const f = ctx.f;
  const live = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 115, 999].map((n) => ({ sortOrder: n }));
  const n1 = f(live);
  assert.ok(n1 > 115 && n1 < 999, '★ 새 유형이 기타(999) 앞이 아닙니다: ' + n1);
  assert.equal(f([]), 10, '빈 사전은 10 부터');
  assert.equal(f([{ sortOrder: 10 }, { sortOrder: 20 }]), 30, '끝 자리가 없으면 맨 끝에 붙는다');
  const n2 = f(live.concat([{ sortOrder: n1 }]));
  assert.ok(n2 > n1 && n2 < 999, '두 번째 새 유형도 기타 앞에 이어 붙어야 합니다: ' + n2);
  assert.ok(f([{ sortOrder: 895 }, { sortOrder: 999 }]) < 999, '자리가 거의 찼어도 기타 앞이어야 합니다');
  /* add() 가 이 함수를 쓴다 */
  assert.ok(/var nextOrder = bizTypeNextOrder\(cur\)/.test(cutFn(ERP, 'function BizTypeCard(props)')), 'add() 가 bizTypeNextOrder 를 안 씁니다');
});
