/* 뉴스레터 — 폰에서 양옆 빈자리를 걷는다 (대표 지시 2026-10-18
   「양옆 빈공백이 많다 — 좌우 옆공간 모두 채워서 쓰게」)

   무엇이 문제였나(411px 실측, tools/phone-audit): 글이 화면 끝에서 19~52px 안쪽에서 시작·끝났다.
   겉 여백(.wrap) + 상자 테두리·둥근 모서리 + 상자 안 여백(.pad 15px)이 겹쳤다.
   고친 뒤: 상자가 화면 폭 그대로(위아래 줄로만 가름), 글은 끝에서 10px 안팎.

   지키는 규칙(값이 아니라 뜻):
     · 폰에서 겉 여백(.wrap)의 양옆이 PC 보다 작다
     · 폰에서 상자(.box·.note·미리보기·회차 머리·담는 법·꼭지 탭·받는 곳 작은 탭·거르개)는 옆 테두리·둥근 모서리가 없다
     · 폰에서 상자 안 여백(.pad·상자 제목)의 양옆이 PC 보다 작다(0 은 아니다)
     · 상자 밖에 선 보낸 결과 머리는 제 여백을 갖는다(겉 여백을 걷어도 끝에 안 붙는다)
     · 이번 회차 머리 덩이는 폰에서 바탕을 한 번 더 깔지 않는다(PC·태블릿에서는 붙어 다니므로 바탕이 있다)
     · 모두 폰 구간(@media max-width:560px) 안에만 — PC 는 그대로
   실행: node --test tests/news-phone-edge.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const src = fs.readFileSync(path.join(__dirname, '..', 'pu-news.html'), 'utf8');
const css = (src.slice(0, src.indexOf('</head>')).match(/<style>[\s\S]*?<\/style>/g) || []).join('\n');

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
/* 선택자 목록(쉼표) 안에 그 선택자가 든 규칙의 몸을 모두 모은다 */
function 든규칙(덩어리, 선택자) {
  const out = [];
  for (const m of 덩어리.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const 목록 = m[1].replace(/\/\*[\s\S]*?\*\//g, '').split(',').map(s => s.trim());
    if (목록.includes(선택자)) out.push(m[2]);
  }
  return out.join(';');
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

test('폰에서 겉 여백(.wrap)의 양옆이 PC 보다 작다', () => {
  assert.ok(폰.length > 1000, '폰 구간을 못 찾았습니다');
  const pc = 양옆(든규칙(바탕, '.wrap'));
  const 폰값 = 양옆(든규칙(폰, '.wrap'));
  assert.ok(pc.L > 0, 'PC 겉 여백을 못 읽었습니다');
  assert.ok(폰값.L !== null && 폰값.L < pc.L && 폰값.R < pc.R, '★ 폰 겉 여백이 PC 와 같거나 큽니다 — 양옆이 비어 보입니다');
});

test('폰에서 상자는 화면 폭 그대로 — 옆 테두리·둥근 모서리가 없다', () => {
  for (const 상자 of ['#main .box', '#main .note', '#main .hdbar', '#main .jarpanel', '#main .subtabs.bar', '#main .chips.tight.filt', '#main[data-tab=res] table.list']) {
    const 몸 = 든규칙(폰, 상자);
    assert.match(몸, /border-left-width:\s*0/, '★ 폰에서 ' + 상자 + ' 에 왼쪽 테두리가 남아 있습니다');
    assert.match(몸, /border-right-width:\s*0/, '★ 폰에서 ' + 상자 + ' 에 오른쪽 테두리가 남아 있습니다');
    assert.match(몸, /border-radius:\s*0/, '★ 폰에서 ' + 상자 + ' 에 둥근 모서리가 남아 있습니다');
  }
});

test('폰에서 상자 안 여백의 양옆이 PC 보다 작다 — 0 은 아니다(글이 끝에 붙지 않게)', () => {
  for (const [폰선택자, pc선택자] of [['#main .pad', '.pad'], ['#main .box>h3', '.box>h3']]) {
    const pc = 양옆(든규칙(바탕, pc선택자)), 폰값 = 양옆(든규칙(폰, 폰선택자));
    assert.ok(pc.L > 0, pc선택자 + ' PC 여백을 못 읽었습니다');
    assert.ok(폰값.L !== null && 폰값.L < pc.L && 폰값.R < pc.R, '★ 폰 ' + 폰선택자 + ' 여백이 줄지 않았습니다');
    assert.ok(폰값.L > 0 && 폰값.R > 0, '★ 폰 ' + 폰선택자 + ' 여백이 0 이면 글이 화면 끝에 붙습니다');
  }
  /* 상자 밖에 선 보낸 결과 머리 — 겉 여백을 걷었으니 제 여백이 있어야 한다 */
  const 머리 = 양옆(든규칙(폰, '#main[data-tab=res] .res-head'));
  assert.ok((머리.L || 0) > 0 && (머리.R || 0) > 0, '★ 보낸 결과 머리(회차 고르기·숫자 칩)가 화면 끝에 붙습니다');
});

test('이번 회차 머리 덩이 — 폰에서는 바탕을 한 겹 덜 깐다(PC·태블릿은 붙어 다니므로 바탕이 있다)', () => {
  assert.match(든규칙(폰, '.colL>.nowtop'), /background:\s*transparent/);
  assert.match(든규칙(바탕, '.colL>.nowtop'), /background:\s*var\(--paper\)/, 'PC 머리 덩이의 바탕이 사라졌습니다 — 붙을 때 뒤 글이 비칩니다');
});

test('PC 는 그대로다 — 폰 규칙이 폰 구간 밖으로 새지 않는다', () => {
  assert.match(든규칙(바탕, '.box'), /border-radius:\s*[1-9]/, 'PC 상자의 둥근 모서리가 사라졌습니다');
  assert.doesNotMatch(바탕, /#main \.box[^{}]*\{[^}]*border-left-width:\s*0/, '상자 옆 테두리 걷기가 폰 밖으로 샜습니다');
});
