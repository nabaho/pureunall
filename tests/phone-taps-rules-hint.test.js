'use strict';
/* 폰 점검 마무리 — 취업규칙 갈래 띠와 로그인 안내문 (대표 「추천대로」 2026-10-05)

   ★ ① 갈래 띠 단추가 손가락 크기인가
     배포본에서 재 보니 36×29 였다. 손가락 끝이 닿는 넓이는 44 쯤이라 옆 것이 같이 눌린다.
     집 안의 기준은 푸른이알피의 min-height:38px 다.
     ⚠ 이 단추는 <a> 라 그냥 두면 inline 이고, inline 에는 min-height 가 안 듣는다.
       그래서 «세우는 것»(inline-flex)까지 함께 있어야 한다 — 하나만 있으면 아무 일도 안 난다.

   ★ ② 로그인 안내문이 폰에서 잘리지 않는가
     375px 에서 안내문이 칸보다 40px 넘쳐 「아이디 (예: p001@pureur」로 잘렸다.
     잘린 안내는 없느니만 못하다. 폰에서는 짧은 쪽을 쓴다 — 칸은 사번도 메일주소도 받으므로
     짧은 쪽만 보여 줘도 뜻이 온전하다.

   ⚠ 글자(「아이디 (예: p001)」)를 박지 않는다 — 「폰에서 더 짧은가 · 둘 다 보기가 들어 있는가」만 본다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn');

const ROOT = path.join(__dirname, '..');
const 읽기 = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

/* 폰 크기(max-width ≤ 768)에서 .rmode a 에 최소 높이를 주는 규칙이 있는가 */
function 띠규칙(css) {
  const 미디어 = /@media([^{]*)\{/g;
  let m;
  while ((m = 미디어.exec(css))) {
    const 폭 = (m[1].match(/max-width\s*:\s*(\d+)px/) || [])[1];
    if (!폭 || Number(폭) > 768) continue;
    let i = m.index + m[0].length, 깊이 = 1, 시작 = i;
    while (i < css.length && 깊이 > 0) {
      if (css[i] === '{') 깊이++;
      else if (css[i] === '}') 깊이--;
      i++;
    }
    const 규칙 = /([^{}]+)\{([^{}]*)\}/g;
    let r;
    while ((r = 규칙.exec(css.slice(시작, i - 1)))) {
      if (!/\.rmode\s+a\b/.test(r[1])) continue;
      const 높이 = (r[2].match(/min-height\s*:\s*(\d+(?:\.\d+)?)px/) || [])[1];
      if (높이 && Number(높이) >= 36) return r[2];
    }
  }
  return '';
}

test('★ 취업규칙 갈래 띠 — 폰에서 누를 수 있는 크기다', () => {
  const css = 읽기('css/rules-shell.css').replace(/\/\*[\s\S]*?\*\//g, ' ');
  const 속 = 띠규칙(css);
  assert.ok(속, '폰 크기에서 .rmode a 에 최소 높이가 없다 — 36×29 로 돌아간다');
  assert.match(속, /display\s*:\s*(inline-)?flex/,
    '<a> 는 inline 이라 min-height 가 안 듣는다 — 세워야(flex) 실제로 커진다');
});

test('그 띠를 쓰는 앱들이 바뀐 판을 싣는다 — 안 올리면 캐시에 묵은 것이 그대로다', () => {
  ['rules-v2.html', 'rules.html'].forEach((f) => {
    assert.match(읽기(f), /css\/rules-shell\.css\?v=(\d+)/, f + ' 가 띠 모양 파일을 안 싣는다');
    const v = Number(읽기(f).match(/css\/rules-shell\.css\?v=(\d+)/)[1]);
    assert.ok(v >= 2, f + ' 의 판 번호가 안 올라갔다(' + v + ')');
  });
});

test('★ 로그인 안내문 — 폰에서는 짧은 쪽을 쓴다 (잘리던 것)', () => {
  const 글 = 읽기('enter.html');
  const 몸 = cutFn(글, 'function fitIdHint(');
  assert.ok(몸, 'fitIdHint 가 없다');

  /* 실제로 돌려 본다 — 좁은 창과 넓은 창에서 각각 무엇이 들어가는지 */
  function 돌리기(폭) {
    const 칸 = { placeholder: '' };
    const 상자 = { window: { innerWidth: 폭 }, $: () => 칸 };
    상자.ID_HINT_LONG = '아이디 (예: p001@pureun.kr)';
    상자.ID_HINT_SHORT = '아이디 (예: p001)';
    vm.createContext(상자);
    vm.runInContext(몸 + '\nfitIdHint();', 상자);
    return 칸.placeholder;
  }
  const 폰 = 돌리기(375), 피시 = 돌리기(1280);
  assert.ok(폰.length < 피시.length, '폰에서도 긴 안내문을 쓰면 그대로 잘린다');
  [폰, 피시].forEach((s) => {
    assert.match(s, /아이디/, '무엇을 넣는 칸인지가 빠졌다');
    assert.match(s, /p001/, '보기가 빠지면 사번을 넣는지 메일주소를 넣는지 모른다');
  });
});

test('창을 눕혀 넓어지면 긴 안내문으로 돌아온다 — 한 번만 고르고 끝내지 않는다', () => {
  const 글 = 읽기('enter.html');
  assert.match(글, /addEventListener\('resize',\s*fitIdHint\)/,
    '창 크기가 바뀔 때 다시 고르지 않으면 폰을 눕혀도 짧은 채로 남는다');
});
