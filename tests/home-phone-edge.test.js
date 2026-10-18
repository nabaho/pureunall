/* 홈페이지 관리 — 폰에서 양옆 빈자리를 걷는다 (대표 지시 2026-10-18
   「양옆 빈공백이 많다 — 좌우 옆공간 모두 채워서 쓰게」)

   무엇이 문제였나(411px 실측, tools/phone-audit): 글이 화면 끝에서 21~39px 안쪽에서 시작했다.
   겉 여백(main) + 틀(.app) 테두리 + 할 일 칸 여백 + 카드 여백이 겹겹이 쌓여서다(상자 2~3겹).
   고친 뒤: 글이 끝에서 8~10px 에서 시작하고 상자는 한 겹.

   지키는 규칙(값이 아니라 뜻):
     · 폰에서 겉 여백(main)의 양옆이 PC 보다 작다 · 틀(.app)은 옆 테두리·둥근 모서리가 없다
     · 안쪽 상자(할 일 카드·경력 상자)는 옆 테두리·둥근 모서리를 걷어 한 겹이다(급함 표시 왼쪽 색 선은 남긴다)
     · 편집칸의 흰 바탕 겹(편집칸·붙는 머리)을 걷는다 · 편집칸 여백 양옆이 PC 보다 작다
     · 모두 폰 구간(@media max-width:560px) 안에만 — PC 는 그대로
   실행: node --test tests/home-phone-edge.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const src = fs.readFileSync(path.join(__dirname, '..', 'pu-home.html'), 'utf8');
const css = src.slice(0, src.indexOf('</style>'));

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
const 폰 = 덩이.filter(b => b.w <= 560).map(b => b.body).join('\n');
const 바탕 = (() => {
  let s = '', at = 0;
  덩이.forEach(b => { if (b.from >= at) { s += css.slice(at, b.from); at = b.to; } });
  return s + css.slice(at);
})();
/* 그 선택자 «하나만» 쓴 규칙의 몸 — 여럿이면 이어 붙인다(뒤의 것이 이긴다) */
function 규칙(덩어리, 선택자) {
  const esc = 선택자.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const ms = [...덩어리.matchAll(new RegExp('(?:^|[\\s}])' + esc + '\\{([^}]*)\\}', 'g'))];
  return ms.length ? ms.map(m => m[1]).join(';') : null;
}
/* 몸에서 «마지막» padding 의 왼·오른 값(px) */
function 양옆(몸) {
  let L = null, R = null;
  for (const m of (몸 || '').matchAll(/(?:^|;)\s*(padding|padding-left|padding-right)\s*:\s*([^;!}]+)/g)) {
    const v = m[2].trim().split(/\s+/).map(x => parseFloat(x) || 0);
    if (m[1] === 'padding') { const r = v.length === 1 ? v[0] : v[1]; const l = v.length === 4 ? v[3] : r; L = l; R = r; }
    else if (m[1] === 'padding-left') L = v[0]; else R = v[0];
  }
  return { L, R };
}

test('폰에서 겉 여백(main)의 양옆이 PC 보다 작다 — 화면 폭을 그대로 쓴다', () => {
  assert.ok(폰.length > 500, '폰 구간을 못 찾았습니다');
  const pc = 양옆(규칙(바탕, 'main'));
  const 폰값 = 양옆(규칙(폰, 'main'));
  assert.ok(pc.L > 0, 'PC 겉 여백을 못 읽었습니다');
  assert.ok(폰값.L !== null && 폰값.L < pc.L && 폰값.R < pc.R, '★ 폰 겉 여백이 PC 와 같거나 큽니다 — 양옆이 비어 보입니다');
});

test('폰에서 틀(.app)은 옆 테두리·둥근 모서리가 없다 — 겹을 하나 덜어 낸다', () => {
  const app = 규칙(폰, '.app') || '';
  assert.match(app, /border:\s*0|border-(?:left|right)(?:-width)?:\s*0/, '★ 폰 틀에 옆 테두리가 남아 있습니다');
  assert.match(app, /border-radius:\s*0/);
  /* 틀의 흰 바탕을 걷으면 페이지 바탕이 그 색을 이어받아야 한다 — 화면 색이 바뀌면 안 된다 */
  assert.match(app, /background:\s*transparent/);
  assert.match(규칙(폰, 'body') || '', /background:\s*var\(--card\)/, '틀 바탕을 걷었는데 페이지 바탕이 그 색을 안 이어받았습니다');
});

test('폰에서 안쪽 상자는 한 겹 — 옆 테두리·둥근 모서리를 걷는다(급함 표시 왼쪽 색 선은 남긴다)', () => {
  const job = 규칙(폰, '.job') || '';
  assert.match(job, /border-radius:\s*0/, '★ 할 일 카드에 둥근 모서리가 남아 있습니다 — 상자 안의 상자로 보입니다');
  const bw = (job.match(/border-width:\s*([^;]+)/) || [])[1];
  assert.ok(bw, '할 일 카드 테두리 폭 규칙이 없습니다');
  const [t, r, b, l] = (bw.trim().split(/\s+/).concat(['', '', ''])).slice(0, 4).map(parseFloat);
  assert.equal(r || 0, 0, '★ 할 일 카드 오른쪽 테두리가 남아 있습니다');
  assert.ok((l || 0) > 0, '★ 급함을 알리는 왼쪽 색 선까지 걷었습니다');
  assert.match(규칙(폰, '.todo') || '', /background:\s*transparent/, '할 일 칸 바탕이 카드 바깥에 또 한 겹 깔립니다');
  const car = 규칙(폰, '.car') || '';
  assert.match(car, /border-left:\s*0/);
  assert.match(car, /border-right:\s*0/);
  assert.match(car, /border-radius:\s*0/);
});

test('폰에서 편집칸의 흰 바탕 겹을 걷고, 여백 양옆이 PC 보다 작다', () => {
  assert.match(규칙(폰, '.edit') || '', /background:\s*transparent/);
  assert.match(규칙(폰, '.stick') || '', /background:\s*transparent/);
  for (const 칸 of ['.esc', '.eft', '.ehd']) {
    const pc = 양옆(규칙(바탕, 칸)), 폰값 = 양옆(규칙(폰, 칸));
    assert.ok(pc.L > 0 && 폰값.L !== null && 폰값.L < pc.L && 폰값.R < pc.R, '★ ' + 칸 + ' 여백이 폰에서 줄지 않았습니다');
    assert.ok(폰값.L > 0, '★ ' + 칸 + ' 여백이 0 이면 글이 화면 끝에 붙습니다');
  }
});

test('PC 는 그대로다 — 폰 규칙이 폰 구간 밖으로 새지 않는다', () => {
  assert.doesNotMatch(규칙(바탕, '.app') || '', /background:\s*transparent/);
  assert.match(규칙(바탕, '.app') || '', /border:\s*1px/, 'PC 틀의 테두리가 사라졌습니다');
  assert.match(규칙(바탕, '.job') || '', /border-radius:\s*[1-9]/, 'PC 할 일 카드의 둥근 모서리가 사라졌습니다');
});
