'use strict';
/* 🗂 사무관리기준 업무유형 카드 — PC 와 폰이 «같은 글자»를 보이고, 컨설팅 카드는 «개인입금|법인 입금 두 묶음 + 칸이 세로로 맞는 줄»,
   전체는 «한 화면에 최대한» (대표 지시 2026-10-26 → 10-31 「컨설팅유형에서 열 정리」 「개인입금도 정리·한 화면에 최대한」 「맞아요 진행」)

   ■ 규칙이 이렇게 바뀌었다 (왜 10/26·10/31 오전 판과 다른가)
   10/26 «이름+칩 줄바꿈» → 10/31 오전 «칸을 세로로 맞춘 표 줄 + 카드 폭에 따라 한 줄/두 줄»(컨테이너 쿼리) → 10/31 오후 대표가 목업에서 고른 것:
     · 개인입금은 칸(알약 단추)이 아니라 «묶음» — 👤 개인입금 사업 | 🏢 법인 입금 사업. 개인입금 값에서 «자동으로» 갈리고 줄 끝 ⇄ 로 옮긴다
     · 한 화면: 줄을 낮추고(약 34px → 23px) «추가» 입력줄은 평소 접어 둔다 · 전체는 컨설팅 윗줄 + 아래 3열 [사건 | 기타사업 | 업체 위·기금 아래]
   ★ 취지는 그대로다: PC 와 폰이 «같은 글자»를 보이고, 칩이 말줄임(…)으로 사라지지 않는다.

   ★ 규칙 (값이 아니라 규칙)
     ① 컨설팅 줄은 «칸이 같은 표 줄» — 머리글과 줄이 같은 칸 모양이고, 빈 값도 칸을 둔다 · 칩(단가·셈)은 안 잘린다 · 접는 것은 «카드 폭» 컨테이너 쿼리
        · 다른 네 카드(업체·사건·기금·기타사업)의 줄은 예전 한 줄 모양 그대로(높이만 낮춤)
     ② 컨설팅은 개인입금 값으로 «자동으로» 두 묶음에 갈린다 · 묶음 사이는 ⇄ 로(끌어서는 안 옮김)
     ③ 카드 배치: 컨설팅 769px↑ 윗줄 전체 폭 · 1100px↑ 3열 영역(사건|기타|업체·기금 쌓음) · 폰은 한 칸·순서 그대로 — 영역·순서 규칙이 폰에 새면 안 된다
     ④ 한 화면: 줄 위아래 여백 0 · 추가 입력줄은 «+ 새 유형» 단추로 펼칠 때만
     ⑤ 새 유형은 «끝 자리»(기타 = 900 이상) 앞에 놓인다 */

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
/* 「카드 배치 규칙(grid-area·grid-column·order)을 거는 자리」가 허용된 폭 말고 어디 있나 — 허용: 컨설팅 전체 폭·order 는 769px↑, 영역 이름은 1100px↑ */
const PLACE = /\.biz-type-card-(consulting|case|other|company|fund)\s*\{[^}]*(grid-area\s*:|grid-column\s*:|order\s*:)/;
function placedOutsideWide(css) {
  const bad = [];
  if (PLACE.test(topLevel(css))) bad.push('최상위');
  mediaBlocks(css).forEach((b) => {
    if (PLACE.test(b.body) && !/^\(min-width:\s*(769|1100)px\)$/.test(b.cond)) bad.push(b.cond);
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
const CARD = cutFn(ERP, 'function BizTypeCard(props)');

/* ── ① 컨설팅 줄 — 칸이 같은 표 줄 ── */
test('①★ 머리글과 줄이 «같은 칸 모양»(7칸)이다 — 다르면 줄마다 칸이 어긋난다', () => {
  const m = /\.bt-row,\s*\.bt-head\s*\{[^}]*grid-template-columns:\s*([^;]+);/.exec(topLevel(CSS));
  assert.ok(m, '★ .bt-row 와 .bt-head 가 같은 규칙(같은 칸 모양)에 있지 않습니다 — 머리글이 줄과 어긋납니다');
  assert.equal(tracks(m[1]), 7, '칸 수가 7(⋮⋮·약어·사업명·수행기관단가셈·⇄·✏·×)이 아닙니다: ' + m[1]);
  const head = /\['',\s*'약어'[^\]]*\]/.exec(CARD);
  assert.ok(head, '머리글 줄이 없습니다');
  assert.equal([...head[0].matchAll(/'([^']*)'/g)].length, 7, '★ 머리글 칸 수가 줄과 다릅니다');
  assert.ok(head[0].includes("'약어'") && head[0].includes("'사업명'") && /수행기관/.test(head[0]), '머리글에 약어·사업명·수행기관이 없습니다');
  /* 묶음 폭(≥1120)의 칸 모양도 7칸 — 줄과 머리글이 같은 규칙이다 */
  const wide = containerBlocks(CSS).find((b) => /min-width:\s*1120px/.test(b.cond));
  assert.ok(wide, '1120px 이상 규칙이 없습니다');
  const w = /\.bt-row,\s*\.bt-head\s*\{[^}]*grid-template-columns:\s*([^;]+);/.exec(wide.body);
  assert.ok(w && tracks(w[1]) === 7, '★ 넓은 묶음 폭에서 머리글·줄 칸 수가 7이 아닙니다');
});

test('①★ 줄의 칸 — 수행기관·단가·셈 칸은 «비어 있어도» 둔다 · .bt-l2 는 넓을 때 칸에 직접 앉는다 · 개인입금 칸(알약)은 없다', () => {
  const at = CARD.indexOf("className:'bt-row'");
  assert.ok(at > 0, '컨설팅 줄(bt-row)이 없습니다');
  const end = CARD.indexOf("return h('div', Object.assign({ key:x.code, style:Object.assign", at);
  assert.ok(end > at, '컨설팅 줄과 다른 카드 줄의 경계를 못 찾았습니다');
  const row = CARD.slice(at, end);
  ['bt-name', 'bt-l2', 'bt-ag', 'bt-swap', 'bt-edit', 'bt-del'].forEach((c) => assert.ok(row.includes(c), '칸(' + c + ')이 없습니다'));
  assert.ok(!/&&\s*h\('span', \{ className:'bt-ag'/.test(row), '★ 수행기관·단가·셈 칸을 «값이 있을 때만» 그립니다 — 비면 뒤 칸이 앞으로 밀려 줄마다 어긋납니다');
  assert.ok(!/bt-pd|bt-agency|bt-fee/.test(row), '★ 예전 개인입금 칸(bt-pd)·분리된 칸이 남아 있습니다 — 개인입금은 이제 묶음입니다');
  assert.ok(/\.bt-l2\s*\{\s*display:\s*contents/.test(topLevel(CSS)), '★ .bt-l2 가 넓을 때 display:contents 가 아닙니다 — 칸이 바깥 줄 칸에 안 앉습니다');
  /* ⇄ 는 개인입금을 바꾸는 «그» 단추다 — 확인창·일괄 변경(togglePersonal)을 그대로 거친다 */
  assert.ok(/className:'bt-swap', onClick:function\(e\)\{ e\.stopPropagation\(\); togglePersonal\(x\); \}/.test(row), '★ ⇄ 단추가 togglePersonal 을 안 부릅니다');
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
  assert.ok(/className:'bt-chip bt-chip-agency', title:x\.agency/.test(CARD), '잘릴 수 있는 수행기관 칩에 전문 말풍선(title)이 없습니다');
});

test('①★ 카드 «자신의 폭»으로 가른다 — 창 폭(@media)이 아니라 컨테이너 쿼리 (넓으면 좌우 묶음 · 좁으면 두 줄)', () => {
  assert.ok(/\.biz-type-card-consulting\s*\{[^}]*container-type:\s*inline-size/.test(topLevel(CSS)), '컨설팅 카드가 컨테이너가 아닙니다');
  const narrow = containerBlocks(CSS).filter((b) => /^biztype \(max-width:\s*(\d+)px\)$/.test(b.cond));
  assert.equal(narrow.length, 1, '★ 카드 폭으로 접는 컨테이너 쿼리가 없습니다');
  const nw = Number(/(\d+)px/.exec(narrow[0].cond)[1]);
  assert.ok(nw >= 600 && nw <= 900, '접는 폭(' + nw + 'px)이 한 줄 칸이 들어가는 폭과 안 맞습니다');
  const nb = narrow[0].body;
  assert.ok(/\.bt-l2\s*\{[^}]*display:\s*flex[^}]*flex-wrap:\s*wrap/.test(nb), '접힌 모양에서 둘째 줄이 줄바꿈하지 않습니다');
  assert.ok(/\.bt-head\s*\{\s*display:\s*none/.test(nb), '접힌 모양에서 머리글이 남습니다 — 줄과 안 맞습니다');
  ['bt-swap', 'bt-edit', 'bt-del'].forEach((c) => assert.ok(new RegExp('\\.' + c + '\\s*\\{[^}]*grid-row:\\s*1').test(nb), '접힌 모양에서 ' + c + ' 가 첫 줄에 고정돼 있지 않습니다 — 둘째 줄 뒤로 밀려납니다'));
  assert.ok(/\.bt-l2:not\(:has\(\.bt-chip\)\)\s*\{\s*display:\s*none/.test(nb), '★ 수행기관·단가·셈이 없는 줄에도 빈 둘째 줄이 남습니다 — 폰 목록이 두 배로 길어집니다(한 칸은 한 줄)');
  assert.ok(/\.bt-name\s*\{[^}]*white-space:\s*normal/.test(nb) && !/\.bt-name\s*\{[^}]*text-overflow:\s*ellipsis/.test(nb), '★ 접힌 모양(폰)에서 사업명이 …로 잘립니다 — 폰에는 말풍선이 없어 잘린 글자를 볼 길이 없습니다');
  /* 넓은 모양: 두 묶음을 좌우로 */
  const wide = containerBlocks(CSS).filter((b) => /^biztype \(min-width:\s*(\d+)px\)$/.test(b.cond));
  assert.equal(wide.length, 1, '★ 두 묶음을 좌우로 앉히는 컨테이너 쿼리가 없습니다');
  const ww = Number(/(\d+)px/.exec(wide[0].cond)[1]);
  assert.ok(ww > nw && ww <= 1400, '좌우 묶음 폭(' + ww + 'px)이 접는 폭(' + nw + 'px)보다 크고 현실적이어야 합니다');
  assert.ok(/\.bt-groups\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*minmax\(0,\s*1fr\)/.test(wide[0].body), '넓을 때 묶음이 좌우 두 칸이 아닙니다');
  /* 접거나 가르는 일을 창 폭 @media 로 하지 않는다 — 사이드바·창 크기에 따라 카드 폭은 달라진다 */
  mediaBlocks(CSS).forEach((b) => assert.ok(!/\.bt-l2|\.bt-row|\.bt-groups/.test(b.body), '★ 창 폭(@media ' + b.cond + ')으로 컨설팅 줄·묶음을 가릅니다 — 카드 폭과 어긋납니다'));
});

test('①★ 다른 네 카드의 줄은 예전 한 줄 모양 그대로다 — 표 줄·묶음은 컨설팅에만 (높이만 낮춤)', () => {
  assert.ok(/if\(cat\.key === 'consulting'\)\{\s*return h\('div', Object\.assign\(\{ key:x\.code, className:'bt-row'/.test(CARD), '컨설팅만 새 줄을 쓰는 분기가 아닙니다');
  const at = CARD.indexOf("className:'biz-type-name', title:tipName,");
  assert.ok(at > 0, '다른 카드 줄의 이름 칸이 없습니다');
  const box = CARD.slice(at, at + 330);
  assert.match(box, /display:'flex'/); assert.match(box, /flexWrap:'wrap'/);
  assert.ok(/shown\.map\(renderRow\)/.test(CARD), '다른 카드는 «숨기지 않은 것»만 한 줄씩 그립니다(숨긴 것은 보관 칸)');
  assert.ok(/cat\.key === 'consulting' \? consGroups : shown\.map\(renderRow\)/.test(CARD), '묶음(consGroups)은 컨설팅에만 쓰입니다');
});

/* ── ② 묶음은 개인입금 값에서 «자동으로» ── */
test('②★ 컨설팅은 개인입금 값으로 두 묶음에 자동으로 갈린다 — 값은 그대로, 보이는 자리만', () => {
  assert.ok(/btGroup\('👤', '개인입금 사업', 'bt-priv', shown\.filter\(function\(x\)\{ return !!x\.personalDeposit; \}\)\)/.test(CARD), '개인입금 묶음이 personalDeposit 값에서 안 갈립니다');
  assert.ok(/btGroup\('🏢', '법인 입금 사업', 'bt-corp', shown\.filter\(function\(x\)\{ return !x\.personalDeposit; \}\)\)/.test(CARD), '법인 입금 묶음이 그 나머지가 아닙니다 — 어느 쪽에도 안 든 유형이 생깁니다');
  const drop = cutFn(CARD, 'function onDrop(targetCode, e)');
  assert.ok(/personalDeposit !== !!_tx\.personalDeposit[\s\S]*return;/.test(drop), '★ 묶음 사이로 끌어 옮기는 길이 막혀 있지 않습니다 — 순서만 바뀌고 묶음은 안 바뀌어 헷갈립니다');
});

/* ── ③ 카드 배치 ── */
test('③★ 컨설팅 카드는 769px 이상에서만 윗줄 전체 폭이다 — 폰은 한 칸이고 순서도 그대로', () => {
  assert.ok(/\.biz-type-grid\s*\{[^}]*display:\s*grid/.test(topLevel(CSS)), '.biz-type-grid 가 없습니다');
  const wide = mediaBlocks(CSS).find((b) => /^\(min-width:\s*769px\)$/.test(b.cond) && /\.biz-type-card-consulting/.test(b.body));
  assert.ok(wide, '★ 769px 이상에서 컨설팅 카드를 윗줄로 올리는 규칙이 없습니다');
  assert.ok(/grid-column:\s*1\s*\/\s*-1/.test(wide.body) && /order:\s*-1/.test(wide.body), '전체 폭(grid-column 1 / -1)과 맨 앞(order -1)이어야 합니다');
  const phone = mediaBlocks(CSS).filter((b) => /max-width:\s*768px/.test(b.cond) && /\.biz-type-grid\s*\{[^}]*grid-template-columns:\s*1fr\s*;?/.test(b.body));
  assert.ok(phone.length >= 1, '★ 폰에서 카드를 한 칸으로 만드는 규칙이 없습니다');
  assert.deepEqual(placedOutsideWide(CSS), [], '★ 카드 배치 규칙(영역·전체 폭·순서)이 허용된 폭 밖에 걸려 있습니다 — 폰의 카드 순서가 바뀌거나 가로로 밀려납니다');
});

test('③★ PC(1100px 이상)는 3열 영역 — 컨설팅 윗줄 전체 폭 · 사건·기타사업은 두 줄 높이 · 업체 위·기금 아래', () => {
  const cats = [...ERP.slice(ERP.indexOf('var BIZ_CATS'), ERP.indexOf('];', ERP.indexOf('var BIZ_CATS'))).matchAll(/\{\s*key:'(\w+)'/g)].map((m) => m[1]);
  assert.deepEqual([...cats].sort(), ['case', 'company', 'consulting', 'fund', 'other'], '카드 목록이 바뀌었습니다 — 영역 배치를 다시 봐야 합니다: ' + cats);
  const pc = mediaBlocks(CSS).find((b) => /^\(min-width:\s*1100px\)$/.test(b.cond) && /\.biz-type-grid/.test(b.body));
  assert.ok(pc, 'PC 폭 규칙이 없습니다');
  const cols = /grid-template-columns:\s*([^;]+);/.exec(pc.body)[1];
  assert.equal(tracks(cols), 3, '★ PC 칸이 3열이 아닙니다: ' + cols);
  const areasM = /grid-template-areas:\s*((?:"[^"]*"\s*)+);/.exec(pc.body);
  assert.ok(areasM, '영역(grid-template-areas)이 없습니다');
  const rows = [...areasM[1].matchAll(/"([^"]*)"/g)].map((m) => m[1].trim().split(/\s+/));
  assert.ok(rows.length === 3 && rows.every((r) => r.length === 3), '영역이 3줄×3열이 아닙니다');
  assert.deepEqual(rows[0], ['cons', 'cons', 'cons'], '★ 컨설팅이 윗줄 전체 폭이 아닙니다');
  const flat = rows.flat();
  const AREA = { consulting: 'cons', case: 'case', other: 'other', company: 'comp', fund: 'fund' };
  Object.keys(AREA).forEach((k) => {
    assert.ok(new RegExp('\\.biz-type-card-' + k + '\\s*\\{[^}]*grid-area:\\s*' + AREA[k] + '\\s*;').test(pc.body), '카드(' + k + ')에 영역 이름(' + AREA[k] + ')이 안 걸려 있습니다');
    assert.ok(flat.includes(AREA[k]), '영역 표에 ' + AREA[k] + ' 가 없습니다');
  });
  assert.ok(rows[1][0] === 'case' && rows[2][0] === 'case' && rows[1][1] === 'other' && rows[2][1] === 'other', '★ 사건·기타사업이 두 줄 높이를 쓰지 않습니다 — 카드 밖 빈 자리가 생깁니다');
  assert.ok(rows[1][2] === 'comp' && rows[2][2] === 'fund', '★ 업체 위·기금 아래로 쌓지 않았습니다');
});

test('③★ (이빨) 카드 배치 규칙을 폰·최상위에 거는 CSS 는 잡힌다', () => {
  assert.ok(placedOutsideWide('.biz-type-card-consulting { grid-column: 1 / -1; order: -1; }').length >= 1, '최상위를 못 잡습니다');
  assert.ok(placedOutsideWide('@media (max-width: 768px) { .biz-type-card-case { grid-area: case; } }').length >= 1, '폰을 못 잡습니다');
  assert.deepEqual(placedOutsideWide('@media (min-width: 769px) { .biz-type-card-consulting { grid-column: 1 / -1; order: -1; } }'), [], '769 이상은 허용인데 헛경고');
  assert.deepEqual(placedOutsideWide('@media (min-width: 1100px) { .biz-type-card-fund { grid-area: fund; } }'), [], '1100 이상은 허용인데 헛경고');
});

test('①★ (이빨) 머리글과 줄의 칸 모양이 다르면 잡힌다', () => {
  assert.equal(tracks('12px 56px minmax(0, 1.1fr) minmax(0, 1.5fr) 20px 20px 20px'), 7);
  assert.notEqual(tracks('12px 56px minmax(0, 1.1fr) minmax(0, 1.5fr) 20px 20px'), 7, '칸 하나가 모자란 것을 못 셉니다');
});

/* ── ④ 한 화면 ── */
test('④★ 한 화면에 최대한 — 줄 위아래 여백 0 · 단추 20px · 추가 입력줄은 «+ 새 유형» 으로 펼칠 때만', () => {
  assert.ok(/\.bt-row\s*\{[^}]*padding:\s*0 5px/.test(topLevel(CSS)), '★ 컨설팅 줄에 위아래 여백이 있습니다 — 한 화면 높이가 늘어납니다');
  assert.ok(/gap:'4px', padding:'0 5px', borderRadius:'4px', marginBottom:'1px'/.test(CARD), '★ 다른 카드 줄에 위아래 여백이 있습니다');
  assert.ok(/height:'20px'/.test(CARD) && !/height:'22px', fontSize:'11px', cursor:'pointer' \} \}, '✏'/.test(CARD), '줄의 ✏·× 단추 높이가 20px 가 아닙니다');
  /* 추가 입력줄 */
  assert.ok(/var adS = useState\(false\)/.test(CARD), '★ 추가 입력줄이 처음부터 펼쳐져 있습니다(기본은 접힘)');
  assert.ok(/addOpen && h\('div', \{ style:\{ padding:'4px 6px', borderTop:'1px solid #f8fafc'/.test(CARD), '입력줄이 addOpen 일 때만 그려지지 않습니다');
  assert.ok(/className:'biz-type-add-toggle'/.test(CARD) && /'\+ 새 유형'/.test(CARD), '머리줄에 「+ 새 유형」 단추가 없습니다');
});

/* ── ⑤ 새 유형 자리 ── */
test('⑤★ 새 유형은 «끝 자리»(기타) 앞에 놓인다 — 기타 뒤(1009)에 붙지 않는다', () => {
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
  assert.ok(/var nextOrder = bizTypeNextOrder\(cur\)/.test(CARD), 'add() 가 bizTypeNextOrder 를 안 씁니다');
});
