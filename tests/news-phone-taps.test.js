/* 뉴스레터 — 폰화면관리 (대표 지시 2026-10-18 「폰화면관리」)

   360·411px 폰으로 «로그인한 채» 그려 본 것(tools/phone-audit, 지어낸 자료)에서 나온 둘:
     ① 이번 회차 기사 줄의 ㅁ(싣기)·✕(빼기)가 17px — 손가락으로 안 맞았다.
     ② 받는 명단 머리줄의 ☐(보이는 것 모두)만 13px 로 남아 있었다 — 줄의 ☐ 는 이미 폰에서 키웠는데,
        머리줄 ☐ 는 이름표(class)가 없어 그 규칙에서 빠졌다.
   (2026-10-11·12 폰 콤팩트 — tests/news-phone-compact.test.js — 가 정한 모양은 그대로다)

   지키는 규칙(값이 아니라 뜻):
     · 폰의 ㅁ 는 PC 의 ㅁ 보다 크다 · ✕ 는 손가락 크기(24px)를 넘는다 — 둘 다 감추지 않는다
     · 받는 명단 머리줄 ☐ 는 줄 ☐ 와 «같은 규칙»으로 커진다
     · 모두 폰 구간(@media max-width:560px) 안에만 — PC 는 그대로
   실행: node --test tests/news-phone-taps.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const src = fs.readFileSync(path.join(__dirname, '..', 'pu-news.html'), 'utf8');
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
function 규칙(덩어리, 선택자) {
  const esc = 선택자.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const ms = [...덩어리.matchAll(new RegExp('(?:^|[\\s}])' + esc + '\\{([^}]*)\\}', 'g'))];
  return ms.length ? ms.map(m => m[1]).join(';') : null;
}
const px = (s, k) => { const m = (s || '').match(new RegExp('(?:^|;)\\s*' + k + ':\\s*([\\d.]+)px')); return m ? Number(m[1]) : null; };

test('① 폰의 기사 줄 ㅁ 는 PC 보다 크다 — 손가락으로 싣고 뺀다', () => {
  assert.ok(폰.length > 1000, '폰 구간을 못 찾았습니다');
  const 폰ㅁ = 규칙(폰, '.item>.ck') || '';
  const pcㅁ = 규칙(바탕, '.item>.ck') || '';
  assert.ok(px(pcㅁ, 'width'), 'PC 의 ㅁ 크기 규칙을 못 찾았습니다');
  assert.ok((px(폰ㅁ, 'width') || 0) > px(pcㅁ, 'width') && (px(폰ㅁ, 'height') || 0) > px(pcㅁ, 'height'),
    '★ 폰 ㅁ 가 PC 와 같거나 작습니다');
  assert.doesNotMatch(폰ㅁ, /display:\s*none/, '★ 폰에서 ㅁ 를 감췄습니다 — 빼기와 «싣지 않기»가 갈리지 않습니다');
});

test('① 폰의 ✕(목록에서 빼기)는 손가락 크기다 — 감추지 않는다', () => {
  const x = 규칙(폰, '.item .x') || '';
  const 가로 = px(x, 'min-width') || px(x, 'width') || 0;
  const 세로 = px(x, 'min-height') || px(x, 'height') || 0;
  assert.ok(Math.max(가로, 세로) >= 24, '★ ✕ 가 가로·세로 모두 24px 미만입니다');
  assert.doesNotMatch(x, /display:\s*none/);
  /* ✕ 는 ㅁ 와 «반대쪽 끝»에 그대로 — 바둑판의 마지막 칸 */
  assert.match(x, /grid-column:\s*3/);
});

test('② 받는 명단 머리줄 ☐ 는 줄 ☐ 와 같은 규칙으로 커진다', () => {
  /* 줄 ☐(input.chk)를 키우는 규칙 덩이를 찾아, 그 선택자 목록에 머리줄 ☐ 도 들었는지 본다 */
  const m = 폰.match(/((?:#main\[data-tab=[a-z]+\][^{}]*,\s*)*#main\[data-tab=who\] table\.list input\.chk,[^{}]*)\{([^}]*)\}/);
  assert.ok(m, '받는 명단 줄 ☐ 를 키우는 폰 규칙을 못 찾았습니다');
  assert.match(m[1], /#main\[data-tab=who\] table\.list th\.ck\s*>\s*input\[type=checkbox\]/,
    '★ 머리줄 ☐(보이는 것 모두)가 줄 ☐ 와 같은 크기로 안 커집니다 — 13px 로 남습니다');
  /* 그 선택자가 실제 마크업을 짚는가 — 머리줄 ☐ 는 th.ck 바로 안의 checkbox 다 */
  assert.match(src, /const 머리체크 = '<th class="ck"><input type="checkbox"/,
    '받는 명단 머리줄 ☐ 의 모양이 바뀌었습니다 — 폰 규칙이 짚는지 다시 보십시오');
});

test('폰 규칙은 폰 구간 안에만 — PC 는 그대로다', () => {
  assert.doesNotMatch(바탕, /\.item \.x\{[^}]*min-height/, '✕ 키우기가 폰 밖으로 샜습니다');
  assert.doesNotMatch(바탕, /th\.ck\s*>\s*input\[type=checkbox\]\s*[,{][^}]*width:20px/, '머리줄 ☐ 키우기가 폰 밖으로 샜습니다');
});
