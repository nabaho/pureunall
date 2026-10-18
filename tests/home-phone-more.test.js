/* 홈페이지 관리 — 폰화면관리 (대표 지시 2026-10-18 「폰화면관리」)

   360·411px 폰으로 «로그인한 채» 그려 본 것(tools/phone-audit, 지어낸 자료)에서 나온 넷:
     ① 위 띠의 ⋯(가끔 쓰는 것)가 화면 «왼쪽 밖»으로 펴졌다 — 360px 에서 칸 왼끝 -155px.
        띠가 세 줄로 접혀 ⋯ 가 왼쪽 끝에 오는데, 칸은 ⋯ 의 오른끝에 맞춰 왼쪽으로 폈다.
        「⚙ 채우기 단추 넣기」·「🕘 바뀐 기록」을 폰에서 아무도 못 눌렀다.
     ② 접는 안내 한 줄(.note1)의 이름표가 한 글자씩 접혔다(「줄을/하나/씩」).
     ③ 주요업무 쪽 차례 ▲▼ 가 20×13px — 손가락으로 못 누른다(폰은 끌기가 잘 안 먹어 ▲▼ 가 유일한 길).
     ④ 긴 업체명이 두 줄로 접혀 목록 줄마다 키가 커졌다(「한 칸은 한 줄」).

   지키는 규칙(값이 아니라 뜻):
     · 폰에서 ⋯ 칸은 «띠»에 걸려 양옆이 띠 안에 있다 — ⋯ 가 어디 오든 화면 밖으로 안 나간다
     · 폰에서 접는 안내는 글처럼 흐른다(이름표·풀이·단추가 폭을 나눠 갖지 않는다)
     · 폰에서 ▲▼ 는 감추지 않고, 한쪽이라도 손가락 크기(24px)를 넘는다
     · 폰 목록 이름은 한 줄(… + title 에 전문)
     · 모두 폰 구간(@media max-width:560px) 안에만 — PC 는 그대로
   실행: node --test tests/home-phone-more.test.js */
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
/* 그 선택자 «하나만» 쓴 규칙의 몸 — 여럿이면 이어 붙인다 */
function 규칙(덩어리, 선택자) {
  const esc = 선택자.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const ms = [...덩어리.matchAll(new RegExp('(?:^|[\\s}])' + esc + '\\{([^}]*)\\}', 'g'))];
  return ms.length ? ms.map(m => m[1]).join(';') : null;
}
const px = (s, k) => { const m = (s || '').match(new RegExp('(?:^|;)\\s*' + k + ':\\s*([\\d.]+)px')); return m ? Number(m[1]) : null; };

test('① 폰에서 위 띠의 ⋯ 칸은 «띠»에 걸린다 — 양옆이 띠 안이라 화면 밖으로 안 나간다', () => {
  assert.ok(폰.length > 500, '폰 구간을 못 찾았습니다');
  /* 띠가 칸의 기준이 되고, ⋯ 자신은 기준에서 빠진다 */
  assert.match(규칙(폰, '.appbar') || '', /position:\s*relative/, '★ 띠가 칸의 기준(relative)이 아닙니다');
  assert.match(규칙(폰, '.appbar .more') || '', /position:\s*static/,
    '★ ⋯ 가 여전히 칸의 기준이면 ⋯ 가 왼쪽 끝에 올 때 칸이 화면 왼쪽 밖으로 나갑니다');
  /* 칸은 왼쪽·오른쪽을 «둘 다» 띠에 건다 — 한쪽만 걸면 다른 쪽이 넘칠 수 있다 */
  const box = 규칙(폰, '.appbar .morebox') || '';
  assert.match(box, /(?:^|;)\s*left:\s*\d/, '★ 칸의 왼쪽이 띠에 걸려 있지 않습니다');
  assert.match(box, /(?:^|;)\s*right:\s*\d/, '★ 칸의 오른쪽이 띠에 걸려 있지 않습니다');
  /* 펴는 방향은 «아래» — 위로 펴면 틀 밖으로 나가 잘린다(2026-10-03 실측) */
  assert.match(box, /top:/);
});

test('① 닫힌 ⋯ 칸은 폰에서 자리도 안 잡는다 · 단추는 그대로 다 있다', () => {
  assert.match(폰, /\.more:not\(\[open\]\)\s*>\s*\.morebox\{display:none\}/);
  /* 칸 안 단추를 빼지 않았다 — 「채우기 단추 넣기」·「바뀐 기록」은 폰에서도 이 칸이 유일한 문이다 */
  const at = src.indexOf('<details class="more"><summary class="btn" title="가끔 쓰는 것들">');
  assert.ok(at > 0, '위 띠의 ⋯ 를 못 찾았습니다');
  const 칸 = src.slice(at, src.indexOf("'</div></details>'", at));
  assert.match(칸, /openFillSetup\(\)/);
  assert.match(칸, /openChangeLog\(\)/);
});

test('② 폰에서 접는 안내 한 줄은 글처럼 흐른다 — 이름표가 한 글자씩 접히지 않는다', () => {
  const sm = 규칙(폰, '.note1 > summary') || '';
  assert.ok(sm, '폰에서 접는 안내 줄 규칙이 없습니다');
  assert.doesNotMatch(sm, /display:\s*(?:inline-)?flex/, '★ 폰에서도 flex 면 이름표·풀이·단추가 폭을 셋으로 나눠 이름표가 접힙니다');
  assert.match(sm, /display:\s*block/);
  /* PC 는 그대로 한 줄 flex 다 */
  assert.match(규칙(바탕, '.note1 > summary') || '', /display:\s*flex/);
});

test('③ 폰에서 쪽 차례 ▲▼ 는 감추지 않고 손가락 크기다', () => {
  const ob = 규칙(폰, '.ob') || '';
  assert.ok(ob, '폰에서 ▲▼ 크기 규칙이 없습니다');
  assert.ok(Math.max(px(ob, 'width') || 0, px(ob, 'height') || 0) >= 24,
    '★ ▲▼ 가 가로·세로 모두 24px 미만입니다 — 폰에서 손가락으로 못 누릅니다');
  /* PC 보다 커졌다 — 같으면 폰 규칙이 안 듣는 것이다 */
  const pc = 규칙(바탕, '.ob') || '';
  assert.ok((px(ob, 'height') || 0) > (px(pc, 'height') || 0), '폰 ▲▼ 가 PC 보다 크지 않습니다');
  assert.doesNotMatch(폰, /\.(?:ob|ord)[^{}]*\{[^}]*display:\s*none/, '★ 폰에서 ▲▼ 를 감췄습니다 — 차례를 바꿀 길이 없어집니다');
});

test('④ 폰 목록 이름은 한 줄 — 넘치면 … 이고 전문은 title 에', () => {
  const nm = 규칙(폰, '.list .nm') || '';
  assert.match(nm, /white-space:\s*nowrap/);
  assert.match(nm, /text-overflow:\s*ellipsis/);
  assert.match(nm, /overflow:\s*hidden/);
  /* 잘린 이름을 볼 길 — 줄 이름에 title 이 붙는다 */
  assert.match(src, /<div class="nm" title="' \+ esc\(r\.name\) \+ '">/, '★ 잘린 이름의 전문(title)이 없습니다');
});

test('폰 규칙은 폰 구간 안에만 — PC 는 그대로다', () => {
  assert.equal(규칙(바탕, '.appbar .more'), null, '⋯ 기준 바꾸기가 폰 밖으로 샜습니다');
  assert.doesNotMatch(규칙(바탕, '.list .nm') || '', /nowrap/, '이름 한 줄 자르기가 폰 밖으로 샜습니다');
  /* PC 의 ⋯ 칸은 여전히 ⋯ 에 붙어 편다 */
  assert.match(규칙(바탕, '.more') || '', /position:\s*relative/);
});
