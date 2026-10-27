'use strict';
/* 🗂 사무관리기준 업무유형 카드 — PC 와 폰이 «같은 글자»를 보인다 (대표 지시 2026-10-26)

   ■ 왜 생겼나
   환경설정 › 사무관리기준의 컨설팅 유형 카드에는 이름 옆에 칩(수행기관 · 1일 단가 · 셈 묶음)이 붙는다.
   예전엔 이름과 칩을 «한 덩어리에 말줄임(…)»으로 담았고, 카드 다섯 장이 같은 폭이었다.
     · PC(카드 5장) — 컨설팅 카드가 좁아 「셈: 현장클리닉」 칩이 통째로 안 보이고 단가도 「1일 350,000원…」으로 잘렸다
     · 폰(카드 1장) — 넓지만 「셈:…」 「1회 300,000원…」 으로 잘렸다. 폰에는 마우스 말풍선(title)이 없어 잘린 글자를 볼 길도 없다
   그래서 두 화면이 «다른 글자»를 봤다. 위험성평가 같은 새 유형도 기타(999) 뒤(1009)에 달려 PC·폰 모두 맨 아래에 붙었다.

   ★ 규칙 (값이 아니라 규칙)
     ① 이름 칸은 «이름 한 줄 + 칩은 같은 줄에 나란히, 모자랄 때만 아래 줄» — 칩을 말줄임으로 가두지 않는다
     ② 폰(768px 이하)은 카드 한 칸, 컨설팅 «두 칸» 은 중간 폭에만 건다(한 칸짜리 그리드에 span 2 가 남으면 가로로 밀려난다)
     ③ PC(1100px 이상) 칸 수는 카드 수와 같고, 칩이 붙는 컨설팅 카드가 가장 넓다
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
const CSS = read('css/pu-erp.css');

/* ── CSS 에서 @media 블록과 최상위 규칙을 가른다 ── */
function mediaBlocks(css) {
  const out = [];
  const re = /@media\s*([^{]+)\{/g;
  let m;
  while ((m = re.exec(css))) {
    let i = re.lastIndex, d = 1;
    for (; i < css.length && d; i++) { if (css[i] === '{') d++; else if (css[i] === '}') d--; }
    out.push({ cond: m[1].replace(/\s+/g, ' ').trim(), body: css.slice(re.lastIndex, i - 1), start: m.index, end: i });
  }
  return out;
}
function topLevel(css) {
  let s = css, bs = mediaBlocks(css);
  for (let k = bs.length - 1; k >= 0; k--) s = s.slice(0, bs[k].start) + s.slice(bs[k].end);
  return s;
}
/* 「.biz-type-card-consulting 에 span 2 를 거는 자리」가 중간 폭(769~1099) 말고 어디 있나 */
function spanOutsideMid(css) {
  const bad = [];
  const spanRe = /\.biz-type-card-consulting\s*\{[^}]*grid-column\s*:\s*span\s*2/;
  if (spanRe.test(topLevel(css))) bad.push('최상위');
  mediaBlocks(css).forEach((b) => {
    if (spanRe.test(b.body) && !/min-width:\s*769px\)\s*and\s*\(max-width:\s*1099px/.test(b.cond)) bad.push(b.cond);
  });
  return bad;
}

/* ── ① 이름 칸 ── */
test('①★ 이름 칸은 칩을 말줄임으로 가두지 않는다 — 한 줄에 나란히, 모자랄 때만 줄바꿈', () => {
  const card = cutFn(ERP, 'function BizTypeCard(props)');
  const at = card.indexOf("className:'biz-type-name'");
  assert.ok(at > 0, '이름 칸(biz-type-name)이 없습니다');
  const box = card.slice(at, at + 400);
  assert.match(box, /display:'flex'/, '이름 칸이 flex 가 아닙니다');
  assert.match(box, /flexWrap:'wrap'/, '★ 이름 칸이 줄바꿈을 안 합니다 — 칩이 잘려 PC·폰이 다른 글자를 봅니다');
  assert.ok(!/overflow:'hidden'[^}]*whiteSpace:'nowrap'|whiteSpace:'nowrap'[^}]*overflow:'hidden'/.test(box.split('h(\'span\'')[0]),
    '★ 이름 칸 자체에 말줄임(overflow hidden + nowrap)을 걸었습니다 — 칩이 잘립니다');
  /* 칩 셋(수행기관·단가·셈)은 이름 칸 «안»에 있고, 각각 제 글자는 한 덩어리로(nowrap) 둔다 */
  const end = card.indexOf('togglePersonal(x)', at);
  const inside = card.slice(at, end);
  ['x.agency', 'x.dayFee', "CONS_ROLE_LABEL[consTypeRole(x)]"].forEach((k) => {
    assert.ok(inside.includes(k), '칩(' + k + ')이 이름 칸 밖에 있습니다');
  });
  /* 칩은 span 하나씩(둥근 알약 borderRadius 10px) — 수행기관·단가·셈 묶음. 속성 순서(title 이 앞인 것도 있다)와 무관하게 잘라 본다 */
  const chips = inside.split("h('span',").filter((p) => /borderRadius:'10px'/.test(p));
  assert.ok(chips.length >= 3, '칩 셋을 못 찾았습니다: ' + chips.length);
  chips.forEach((c) => {
    assert.match(c, /whiteSpace:'nowrap'/, '칩이 중간에서 줄바꿈됩니다');
    assert.ok(!/marginLeft:'6px'/.test(c), '칩 간격을 marginLeft 로 줍니다 — 줄이 바뀌면 왼쪽이 어긋납니다(gap 을 쓴다)');
  });
});

/* ── ②③ 카드 폭 ── */
test('②★ 폰(768px 이하)은 카드 한 칸 — span 2 는 중간 폭에만 건다', () => {
  assert.ok(/\.biz-type-grid\s*\{[^}]*display:\s*grid/.test(topLevel(CSS)), '.biz-type-grid 가 없습니다');
  const phone = mediaBlocks(CSS).filter((b) => /max-width:\s*768px/.test(b.cond) && /\.biz-type-grid\s*\{[^}]*grid-template-columns:\s*1fr\s*;?/.test(b.body));
  assert.ok(phone.length >= 1, '★ 폰에서 카드를 한 칸으로 만드는 규칙이 없습니다');
  assert.deepEqual(spanOutsideMid(CSS), [], '★ 컨설팅 카드 span 2 가 중간 폭 밖에 걸려 있습니다 — 폰에서 가로로 밀려납니다');
  assert.ok(/min-width:\s*769px\)\s*and\s*\(max-width:\s*1099px/.test(mediaBlocks(CSS).map((b) => b.cond).join('\n')) , '중간 폭 규칙이 없습니다');
});

test('③★ PC(1100px 이상) 칸 수는 카드 수와 같고 컨설팅 카드가 가장 넓다', () => {
  const cats = [...ERP.slice(ERP.indexOf('var BIZ_CATS'), ERP.indexOf('];', ERP.indexOf('var BIZ_CATS'))).matchAll(/\{\s*key:'(\w+)'/g)].map((m) => m[1]);
  assert.ok(cats.length >= 4 && cats.includes('consulting'), '카드 목록을 못 읽었습니다: ' + cats);
  const pc = mediaBlocks(CSS).find((b) => /min-width:\s*1100px/.test(b.cond) && /\.biz-type-grid/.test(b.body));
  assert.ok(pc, 'PC 폭 규칙이 없습니다');
  const tpl = /grid-template-columns:\s*([^;]+);/.exec(pc.body)[1];
  const w = [...tpl.matchAll(/minmax\(0,\s*([\d.]+)fr\)/g)].map((m) => Number(m[1]));
  assert.equal(w.length, cats.length, '★ PC 칸 수(' + w.length + ')가 카드 수(' + cats.length + ')와 다릅니다 — 카드가 줄바꿈되거나 빈 칸이 생깁니다');
  const ci = cats.indexOf('consulting');
  assert.equal(w[ci], Math.max.apply(null, w), '★ 컨설팅 카드가 가장 넓지 않습니다 — 칩이 다시 잘립니다');
});

test('②★ (이빨) span 2 를 폰·최상위에 거는 CSS 는 잡힌다', () => {
  const top = '.biz-type-card-consulting { grid-column: span 2; }';
  assert.ok(spanOutsideMid(top).length >= 1, '최상위 span 을 못 잡습니다');
  const phone = '@media (max-width: 768px) { .biz-type-card-consulting { grid-column: span 2; } }';
  assert.ok(spanOutsideMid(phone).length >= 1, '폰 span 을 못 잡습니다');
  const ok = '@media (min-width: 769px) and (max-width: 1099px) { .biz-type-card-consulting { grid-column: span 2; } }';
  assert.deepEqual(spanOutsideMid(ok), [], '중간 폭 span 은 허용인데 헛경고');
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
