'use strict';
/* 회차 머리와 「담는 법」을 «붙여 둔다» (틀고정)
   ═══════════════════════════════════════════════════════════════════════════
   대표 지시 2026-09-14: 「이부분 틀고정 해라」 — 회차 줄(크게 보기·시험 발송·
   N곳에 보내기)과 담는 법 띠를 가리키셨다.

   ★ 왜 이 둘인가 — 꼭지를 훑어 내려가는 동안 «지금 몇 주차를 짓고 있나»와
     «어떻게 담나»를 잃으면, 다시 맨 위로 굴려 올라가서 확인해야 한다.

   ★ 여기서 못 박는 것은 «값»이 아니라 «규칙»이다:
     ① 둘이 «한 덩이»로 붙는다 — 따로 붙이면 둘째 것의 top 을 px 로 박아야 한다
     ② 바탕이 «비치지 않는다» — 비치면 글이 겹쳐 찍힌다
     ③ 붙는 자리는 «재서» 넣는다 — 위(앱바+탭)가 얼마나 차지하는지는 창마다 다르다
     ④ 위에 얹혀 있는 것(앱바·팝업)보다 «아래» 층이다 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const 쪽 = () => fs.readFileSync(path.join(__dirname, '..', 'pu-news.html'), 'utf8');

test('★★★ 회차 머리와 담는 법이 «한 덩이»로 묶여 있다', () => {
  /* ⚠⚠ 따로따로 붙이면 둘째 것(담는 법)의 top 을 첫째 것의 «높이»로 줘야 한다.
       그 높이는 글자 크기·단추 줄바꿈에 따라 달라져, 창을 좁히면 겹치거나 뜬다.
       한 덩이로 묶으면 top 하나면 된다. */
  const s = 쪽();
  const m = /<div class="nowtop">([\s\S]*?)<div class="ways">/.exec(s);
  assert.ok(m, '★★★ nowtop 덩이가 없다 — 둘이 따로 붙어 있다');
  assert.ok(/<div class="hdbar">/.test(m[1]),
    '★★★ 회차 머리(hdbar)가 nowtop 안에 없다');
});

test('★★★ 그 덩이가 «붙는다» — position:sticky', () => {
  const s = 쪽();
  const m = /\.colL>\.nowtop\{([^}]*)\}/.exec(s);
  assert.ok(m, '★★★ .colL>.nowtop 규칙이 없다');
  assert.ok(/position:\s*sticky/.test(m[1]), '★★★ 안 붙는다 — position:sticky 가 없다');
  assert.ok(/top:/.test(m[1]), '★★★ 붙을 자리(top)가 없다');
});

test('★★★ 바탕이 «비치지 않는다» — 비치면 글이 겹쳐 찍힌다', () => {
  /* ⚠⚠ 회차 머리와 담는 법은 저마다 흰 상자지만 «사이가 벌어져» 있다.
       덩이에 바탕이 없으면 그 틈으로 아래 기사 제목이 지나가는 것이 보인다.
       실제로 그렇게 만들면 「글자가 두 겹으로 찍힌다」로 겪는다. */
  const m = /\.colL>\.nowtop\{([^}]*)\}/.exec(쪽());
  assert.ok(m, '.colL>.nowtop 규칙이 없다');
  assert.ok(/background:/.test(m[1]), '★★★ 덩이에 바탕이 없다 — 아래 글이 비친다');
  assert.ok(!/background:\s*(transparent|none|rgba\([^)]*,\s*0?\.\d+\s*\))/.test(m[1]),
    '★★★ 바탕이 비친다');
});

test('★★★ 붙을 자리를 «재서» 넣는다 — px 로 박지 않는다', () => {
  /* ⚠⚠ 980px 아래에서는 앱바+탭(#top)이 이미 위에 붙어 있다. 그 높이만큼
       내려 붙이지 않으면 덩이가 #top «뒤로» 들어가 안 보인다.
       그 높이는 글자 크기·탭 줄바꿈에 따라 달라진다 — 이 파일의 오랜 규칙대로
       숫자를 박지 않고 잰다. */
  const s = 쪽();
  const m = /\.colL>\.nowtop\{([^}]*)\}/.exec(s);
  assert.ok(/top:\s*var\(--tophi/.test(m[1]),
    '★★★ top 을 숫자로 박았다 — 창이 바뀌면 어긋난다');
  assert.ok(/setProperty\(\s*['"]--tophi['"]/.test(s),
    '★★★ --tophi 를 아무도 재서 넣지 않는다 — 늘 0 이라 #top 뒤에 숨는다');
  assert.ok(/getBoundingClientRect\(\)\.height/.test(s),
    '★★★ 높이를 «재는» 줄이 없다');
});

test('★★ #top 이 붙어 있지 않을 때는 «0» 이다 — 넓은 화면에서 헛자리가 생기지 않게', () => {
  /* ⚠ 981px 이상에서는 #top 이 안 붙는다(껍데기가 이미 위를 얼린다).
       그때도 그 높이만큼 내려 붙이면, 덩이 위에 100px 짜리 빈 자리가 생긴다. */
  const s = 쪽();
  assert.ok(/position\s*===\s*['"]sticky['"]/.test(s),
    '★★ 「#top 이 지금 붙어 있나」를 안 보고 높이를 넣는다');
});

test('★★ 위에 얹힌 것보다 «아래» 층이다 — 앱바를 가리지 않는다', () => {
  const s = 쪽();
  const m = /\.colL>\.nowtop\{([^}]*)\}/.exec(s);
  const z = /z-index:\s*(\d+)/.exec(m[1]);
  assert.ok(z, '★★ 층(z-index)이 없다 — 굴러 지나가는 줄이 위로 올라온다');
  const 위층 = /#top\{position:sticky;top:0;z-index:(\d+)/.exec(s);
  assert.ok(위층, '#top 의 층을 못 찾았다');
  assert.ok(Number(z[1]) < Number(위층[1]),
    '★★ 덩이가 앱바(#top)보다 위층이다 — 앱바를 덮는다');
});

test('★★ 덩이가 «제 키만» 쓴다 — 넓은 화면의 flex 칸에서 늘어나지 않게', () => {
  /* ⚠ hdbar·ways 가 이제 .colL 의 «손자»다. 옛 규칙(.colL>.hdbar)은 손자에게
       안 걸린다. 덩이 스스로 flex:0 0 auto 라야, 꼭지가 남은 자리를 다 갖는다. */
  const m = /\.colL>\.nowtop\{([^}]*)\}/.exec(쪽());
  assert.ok(m, '.colL>.nowtop 규칙이 없다');
  assert.ok(/flex:\s*0 0 auto/.test(m[1]),
    '★★ 덩이에 flex:0 0 auto 가 없다 — 꼭지 자리를 빼앗는다');
});

test('★ 낮은 창에서는 얼리기를 «끈다» — 안 예쁜 것보다 못 쓰는 것이 나쁘다', () => {
  /* ⚠ 넓지만 낮은 창(브라우저 도구를 열면 이렇다)에서 머리가 화면을 거의 다 먹으면
       정작 꼭지를 못 본다. 이 파일에는 이미 그 안전판이 있다 — 덩이도 함께 풀어 준다. */
  const s = 쪽();
  const m = /@media\(min-width:981px\) and \(max-height:620px\)\{([\s\S]*?)\n\}/.exec(s);
  assert.ok(m, '낮은 창 안전판을 못 찾았다');
  assert.ok(/nowtop\{position:\s*static/.test(m[1]),
    '★ 낮은 창에서 덩이를 안 풀어 준다 — 머리만 보이고 꼭지를 못 본다');
});
