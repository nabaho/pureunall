'use strict';
/* 폰에서 입력칸을 누를 때 «화면이 확 커지는» 것을 막는다 (대표 지시 2026-10-04
   「폰화면에서 오류나 문제 있는지 검토해달라」 — 전수점검에서 16개 앱 전부에 있었다)

   ★ 왜 생기나
     아이폰 사파리는 «글씨가 16px 보다 작은» 입력칸에 손을 대면 그 칸이 읽히도록
     화면을 스스로 확대한다. 그러면 한 칸 칠 때마다 사람이 손으로 다시 줄여야 한다.
     배포본에서 재 보니 11~15px 였다(기업정보함 14px, 캘린더 11.5px, 로그인 15px …).

   ★ 무엇을 보는가 — «지금 값»이 아니라 규칙이다
     「폰 크기(max-width ≤ 768px)에서 input·select·textarea 글씨가 16px 이상이 되는
     규칙이 있는가」만 본다. 몇 px 로 적든, 어느 자리에 적든, 어떤 선택자로 적든 통과한다.

   ⚠ 확대를 «막아서» 고치지 말 것 — user-scalable=no / maximum-scale=1 은 증상은
     없애지만 눈이 어두운 사람이 손가락으로 키울 길까지 막는다. 그래서 그것도 함께 막는다.

   실행: node --test tests/phone-input-zoom.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');


const ROOT = path.join(__dirname, '..');
const 읽기 = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

/* 포털이 실제로 내거는 앱 목록에서 읽는다 — 손으로 적으면 새 앱을 빠뜨린다 */
function 폰화면들() {
  const enter = 읽기('enter.html');
  const 앱 = [...new Set([...enter.matchAll(/url:\s*'([a-z0-9-]+\.html)'/g)].map((m) => m[1]))];
  const 전부 = ['enter.html', ...앱, 'sign.html'];   // sign.html 은 근로자가 폰으로 여는 화면
  return 전부.filter((f) => fs.existsSync(path.join(ROOT, f)));
}

/* 그 앱의 CSS 를 모은다 — 스타일이 파일로 빠져 있으면 그 파일까지.
   ⚠ pu-erp.html 은 <style> 이 «전부 인쇄용 글자열 속»이라 링크한 css 를 봐야 한다. */
function 앱의CSS(f) {
  const 원문 = 읽기(f);
  let css = '';
  const 머리끝 = 원문.indexOf('</head>');
  const 닫음 = 원문.indexOf('</style>');
  if (닫음 > 0 && 머리끝 > 0 && 닫음 < 머리끝) {
    css += [...원문.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
  }
  [...원문.matchAll(/<link[^>]+href="(css\/[a-z0-9-]+\.css)(?:\?[^"]*)?"/g)].forEach((m) => {
    const p = path.join(ROOT, m[1]);
    if (fs.existsSync(p)) css += '\n' + fs.readFileSync(p, 'utf8');
  });
  /* CSS 주석만 걷는다 — HTML 걷개는 문서 전체를 받아야 하고, CSS 에는 // 주석이 없다
     (http:// 같은 것을 주석으로 잘못 보면 규칙이 통째로 사라진다). */
  return css.replace(/\/\*[\s\S]*?\*\//g, ' ');
}

/* 폰 크기에서 입력칸 글씨를 16px 이상으로 만드는 규칙이 «있는가» */
function 폰에서16px인가(css) {
  const 미디어 = /@media([^{]*)\{/g;
  let m;
  while ((m = 미디어.exec(css))) {
    const 조건 = m[1];
    const 폭 = (조건.match(/max-width\s*:\s*(\d+)px/) || [])[1];
    if (!폭 || Number(폭) > 768) continue;             // 폰 크기를 겨냥한 것만
    // 이 @media 의 몸통을 괄호 짝으로 떼어 낸다
    let i = m.index + m[0].length, 깊이 = 1, 시작 = i;
    while (i < css.length && 깊이 > 0) {
      if (css[i] === '{') 깊이++;
      else if (css[i] === '}') 깊이--;
      i++;
    }
    const 몸통 = css.slice(시작, i - 1);
    const 규칙 = /([^{}]+)\{([^{}]*)\}/g;
    let r;
    while ((r = 규칙.exec(몸통))) {
      const 선택자 = r[1], 속 = r[2];
      if (!/\b(input|select|textarea)\b/i.test(선택자)) continue;
      const 글씨 = (속.match(/font-size\s*:\s*(\d+(?:\.\d+)?)px/) || [])[1];
      if (글씨 && Number(글씨) >= 16) return true;
    }
  }
  return false;
}

test('★ 폰에서는 입력칸 글씨가 16px 이상이다 — 아니면 누를 때마다 화면이 확대된다', () => {
  const 빠진것 = 폰화면들().filter((f) => !폰에서16px인가(앱의CSS(f)));
  assert.deepEqual(빠진것, [],
    '이 앱들은 폰에서 입력칸에 손을 댈 때마다 화면이 커진다 — 폰 규칙에 '
    + 'input,select,textarea{font-size:16px} 를 넣으십시오');
});

test('★ 확대를 «막아서» 고치지 않는다 — 손가락으로 키울 길을 뺏으면 안 된다', () => {
  const 막은것 = 폰화면들().filter((f) => {
    const vp = (읽기(f).match(/<meta[^>]+name=["']viewport["'][^>]*>/i) || [''])[0];
    return /user-scalable\s*=\s*no|maximum-scale\s*=\s*1/i.test(vp);
  });
  assert.deepEqual(막은것, [], '확대 자체를 막으면 눈이 어두운 분이 글씨를 키울 수 없다');
});

test('모든 폰 화면에 뷰포트 설정이 있다 — 없으면 PC 화면이 통째로 줄어 보인다', () => {
  const 없는것 = 폰화면들().filter((f) =>
    !/width=device-width/i.test((읽기(f).match(/<meta[^>]+name=["']viewport["'][^>]*>/i) || [''])[0]));
  assert.deepEqual(없는것, []);
});
