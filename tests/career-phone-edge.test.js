/* 경력관리 — 폰에서 양옆 빈자리를 걷는다 (대표 지시 2026-10-18
   「양옆 빈공백이 많다 — 좌우 옆공간 모두 채워서 쓰게」)

   무엇이 문제였나(411px 실측, tools/phone-audit): 목록 카드 글이 화면 끝에서 21~24px 안쪽에서 시작했다.
   쪽 여백(12) + 표 바깥 상자(흰 바탕·테두리·그림자) + 카드 테두리 + 카드 안 여백(10)이 겹겹이 쌓였다(상자 2겹).
   ⚠ 게다가 앞쪽 520px 덩이의 .page{padding:…!important} 는 «듣지 않고» 있었다 — 뒤쪽 780px 덩이의 같은 무게
     규칙이 이겼다. 그래서 폰 규칙은 «맨 뒤» 덩이에 둔다.
   고친 뒤: 쪽 여백 6px · 상자 한 겹 · 글은 끝에서 14px 안.

   지키는 규칙(값이 아니라 뜻):
     · 폰 폭에서 «이기는» 쪽 여백(.page)이 PC 보다 작다 — 0 은 아니다(상자 밖 글이 끝에 붙지 않게)
     · 표 바깥 상자는 폰에서 바탕·테두리·둥근 모서리·그림자가 없다(카드 한 겹)
     · 카드·툴바·작은 상자의 안 여백 양옆이 PC 보다 작다
     · 모두 폰 구간(@media max-width:520px) 안에만 — PC 는 그대로
   실행: node --test tests/career-phone-edge.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const kc = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');
const css = kc.slice(0, kc.indexOf('</style>'));

function 미디어덩이() {
  const out = [];
  const re = /@media\s*\(\s*max-width\s*:\s*(\d+)px\s*\)\s*\{/g;
  let m;
  while ((m = re.exec(css))) {
    let d = 0, i = css.indexOf('{', m.index);
    const s = i;
    for (; i < css.length; i++) {
      if (css[i] === '{') d++;
      else if (css[i] === '}' && --d === 0) break;
    }
    out.push({ w: Number(m[1]), body: css.slice(s + 1, i), from: m.index, to: i + 1 });
  }
  return out;
}
const 덩이 = 미디어덩이();
/* 어떤 @media(인쇄 포함)에도 안 든 «바탕» CSS — 넓은 화면(PC)이 보는 것 */
const 바탕 = (() => {
  let s = '', at = 0, i;
  while ((i = css.indexOf('@media', at)) >= 0) {
    s += css.slice(at, i);
    let d = 0, k = css.indexOf('{', i);
    for (; k < css.length; k++) { if (css[k] === '{') d++; else if (css[k] === '}' && --d === 0) break; }
    at = k + 1;
  }
  return s + css.slice(at);
})();
/* 선택자 목록(쉼표) 안에 그 선택자가 든 규칙 — [{몸, 자리}] (자리 = 원문 안 위치, 차례 견주기용) */
function 든규칙들(덩어리, 선택자, 밑 = 0) {
  const out = [];
  for (const m of 덩어리.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const 목록 = m[1].replace(/\/\*[\s\S]*?\*\//g, '').split(',').map(s => s.trim());
    if (목록.includes(선택자)) out.push({ 몸: m[2], 자리: 밑 + m.index });
  }
  return out;
}
function 양옆(몸) {
  let L = null, R = null;
  for (const m of (몸 || '').matchAll(/(?:^|;)\s*(padding|padding-left|padding-right)\s*:\s*([^;!}]+)/g)) {
    const v = m[2].trim().split(/\s+/).map(x => parseFloat(x) || 0);
    if (m[1] === 'padding') { const r = v.length === 1 ? v[0] : v[1]; const l = v.length === 4 ? v[3] : r; L = l; R = r; }
    else if (m[1] === 'padding-left') L = v[0]; else R = v[0];
  }
  return { L, R };
}
/* 폰 폭(411px)에서 듣는 덩이 전부 — max-width 가 411 이상인 것. 그 안에서 «뒤에 오는 !important» 가 이긴다 */
const 폰에듣는 = 덩이.filter(b => b.w >= 411 && b.w <= 820);
const 폰만 = 덩이.filter(b => b.w <= 520);

test('폰 폭에서 «이기는» 쪽 여백(.page)이 PC 보다 작다 — 0 은 아니다', () => {
  const pc = 양옆(든규칙들(바탕, '.page').map(x => x.몸).join(';'));
  assert.ok(pc.L > 0, 'PC 쪽 여백을 못 읽었습니다');
  /* !important 로 .page 여백을 정한 폰 쪽 규칙들 가운데 원문에서 «가장 뒤»의 것이 이긴다 */
  const 후보 = [];
  폰에듣는.forEach(b => 든규칙들(b.body, '.page', b.from).forEach(x => { if (/padding[^;]*!important/.test(x.몸)) 후보.push({ ...x, w: b.w }); }));
  assert.ok(후보.length, '폰 쪽 .page 여백 규칙을 못 찾았습니다');
  const 이김 = 후보.sort((a, b) => a.자리 - b.자리).pop();
  assert.ok(이김.w <= 520, '★ 폰 폭에서 이기는 .page 여백이 ' + 이김.w + 'px 덩이의 것입니다 — 폰(520px) 규칙이 안 듣습니다');
  const 폰값 = 양옆(이김.몸);
  assert.ok(폰값.L < pc.L && 폰값.R < pc.R, '★ 폰 쪽 여백이 PC 와 같거나 큽니다');
  assert.ok(폰값.L > 0 && 폰값.R > 0, '★ 쪽 여백이 0 이면 상자 밖 글(제목·접는 줄)이 화면 끝에 붙습니다');
});

test('표 바깥 상자는 폰에서 바탕·테두리·둥근 모서리·그림자가 없다 — 카드 한 겹', () => {
  /* PC 에는 그 상자가 있다(흰 바탕·테두리) — 없으면 이 검사를 다시 보라 */
  const pc = 든규칙들(바탕, '.dt table').map(x => x.몸).join(';');
  assert.match(pc, /background:\s*#fff/);
  assert.match(pc, /box-shadow:/);
  const 폰 = 폰만.map(b => 든규칙들(b.body, '.dt table').map(x => x.몸).join(';')).join(';');
  assert.match(폰, /background:\s*transparent/, '★ 폰에서 표 바깥 상자의 흰 바탕이 남아 있습니다');
  assert.match(폰, /border:\s*0/, '★ 폰에서 표 바깥 상자의 테두리가 남아 있습니다');
  assert.match(폰, /border-radius:\s*0!important/, '★ 둥근 모서리는 !important 규칙(12px)을 이겨야 합니다');
  assert.match(폰, /box-shadow:\s*none/, '★ 그림자가 남으면 상자가 한 겹 더 보입니다');
});

test('카드·툴바·작은 상자의 안 여백 양옆이 PC 보다 작다', () => {
  const 폰몸 = (선택자) => 폰만.map(b => 든규칙들(b.body, 선택자).map(x => x.몸).join(';')).join(';');
  const 마지막폰 = (선택자) => { const 마지막 = 폰만[폰만.length - 1]; return 든규칙들(마지막.body, 선택자).map(x => x.몸).join(';'); };
  /* 카드 — PC .card 안 여백보다 작다 */
  const card = 양옆(든규칙들(바탕, '.card').map(x => x.몸).join(';'));
  const 폰card = 양옆(마지막폰('.card'));
  assert.ok(card.L > 0 && 폰card.L !== null && 폰card.L < card.L, '★ 폰 카드 안 여백이 줄지 않았습니다');
  /* 툴바 */
  const tb = 양옆(든규칙들(바탕, '.toolbar').map(x => x.몸).join(';'));
  const 폰tb = 양옆(마지막폰('.toolbar'));
  assert.ok(tb.L > 0 && 폰tb.L !== null && 폰tb.L < tb.L, '★ 폰 툴바 안 여백이 줄지 않았습니다');
  /* 목록 카드(줄) — PC 칸 여백보다 작다 */
  const td = 양옆(든규칙들(바탕, '.dt tbody td').map(x => x.몸).join(';'));
  const 폰tr = 양옆(폰몸('.dt tr'));
  assert.ok(td.L > 0 && 폰tr.L !== null && 폰tr.L < td.L && 폰tr.L > 0, '★ 폰 목록 카드 안 여백이 줄지 않았습니다');
});

test('PC 는 그대로다 — 폰 규칙이 폰 구간 밖으로 새지 않는다', () => {
  assert.doesNotMatch(든규칙들(바탕, '.dt table').map(x => x.몸).join(';'), /transparent|box-shadow:\s*none/);
  /* 쪽 여백을 줄이는 규칙은 폰 덩이에만 — 넓은 화면(바탕)의 .page 에는 !important 여백이 없다 */
  assert.ok(!든규칙들(바탕, '.page').some(x => /padding[^;]*!important/.test(x.몸)), '쪽 여백 줄이기가 폰 밖으로 샜습니다');
});
