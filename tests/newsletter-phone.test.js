/* 폰에서 편하게 보이는가 (대표 지시 2026-09-12 「폰화면에서 편하게 보게 깔끔히 정리해라」)
   ═══════════════════════════════════════════════════════════════════════════
   ★ 375px 짜리 화면에서 재 보고 고친 자리들이다. 값(px)이 아니라 «규칙»을 못 박는다.

   ■ 실측으로 드러난 것 (2026-09-12, 375×812)
     · 「이번 회차」 한 장이 2,058px — 단추 넷이 세 줄, 담는 법 다섯이 세 줄
     · 줄마다 ▲▼ 와 매체 이름이 가로를 먹어 제목이 «네 줄»로 쏟아졌다
     · 탭 다섯이 469px 라 오른쪽 둘(보낸 결과·설정)이 화면 밖에 있었다
     · 받는 명단 표가 회사 이름을 «한 글자씩 세로로» 쏟아 23,345px 가 되었다
     · 바둑판 칸이 안 줄어들어(min-width:auto) 칸이 665px 로 벌어졌다 —
       겉으로는 가로 스크롤도 안 생겨 「글이 짧아진 것」처럼 보였다 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { stripComments } = require('./strip-comments');
const { 함수몸 } = require('./helpers/strip-comments.js');

const ROOT = path.join(__dirname, '..');
const 원본 = fs.readFileSync(path.join(ROOT, 'pu-news.html'), 'utf8').replace(/\r\n/g, '\n');
const news = stripComments(원본);

/* 폰 규칙 덩이만 떼어 본다 — 다른 미디어쿼리의 규칙이 섞여 통과하면 안 된다 */
function 폰규칙() {
  /* ⚠ 「@media(max-width:560px)」 는 «여럿»이다(설정 칸·접는 줄 …).
       첫 것을 잡으면 엉뚱한 덩이를 보게 된다 — 폰 손질을 모아 둔 «마지막» 덩이다. */
  const i = news.lastIndexOf('@media(max-width:560px){');
  assert.ok(i >= 0, '폰 규칙 덩이가 없다');
  /* 중괄호를 세어 그 덩이만 */
  let d = 0, k = news.indexOf('{', i);
  for (; k < news.length; k++) {
    if (news[k] === '{') d++;
    else if (news[k] === '}') { d--; if (!d) break; }
  }
  return news.slice(i, k + 1);
}
const 폰 = 폰규칙();

/* ══════ ① 탭이 다 보인다 ══════ */

test('★★ 폰에서 탭 다섯이 «다 보인다» — 굴려서 찾게 두지 않는다', () => {
  /* 폰에서는 가로로 굴릴 수 있다는 것이 눈에 안 띈다 — 없는 탭으로 여기게 된다. */
  assert.match(폰, /#tabs button\{[^}]*flex:1/,
    '탭이 남는 자리를 나눠 갖지 않는다 — 다섯째가 화면 밖으로 나간다');
  assert.match(폰, /#tabs button\{[^}]*min-width:0/,
    '탭이 안 줄어든다 — 글자 폭만큼 벌어져 또 넘친다');
});

test('★★ 폰·태블릿에서 위가 «붙는다» — 붙일 것은 #tabs 가 아니라 #top', () => {
  /* ⚠⚠ #tabs 에는 예전부터 position:sticky 가 있었는데 «폰에서는 안 붙었다».
       붙는 것은 «제 부모의 상자 안»에서만이다 — 부모(#top)가 화면 밖으로 밀려 나가면
       그 안의 붙임도 같이 나간다. 실측 2026-09-12: 900px 굴리니 탭이 -858px 였다.
     ⚠ 981px 이상에는 걸지 않는다 — 거기서는 껍데기(flex)가 이미 얼린다. */
  const i = news.lastIndexOf('@media(max-width:980px){');
  assert.ok(i >= 0, '넓은 화면 밖에서 위를 붙이는 덩이가 없다');
  let d = 0, k = news.indexOf('{', i);
  for (; k < news.length; k++) {
    if (news[k] === '{') d++;
    else if (news[k] === '}') { d--; if (!d) break; }
  }
  const 덩이 = news.slice(i, k + 1);
  assert.match(덩이, /#top\{[^}]*position:sticky/,
    '#top 이 안 붙는다 — #tabs 만 붙여 두면 부모가 나갈 때 같이 나간다');
  assert.match(덩이, /#top\{[^}]*top:0/, '붙는 자리가 맨 위가 아니다');
  assert.match(덩이, /#top\{[^}]*z-index:\d+/, '겹침 차례가 없어 내용이 위를 덮는다');
  assert.match(덩이, /#top\{[^}]*background:/,
    '바탕이 없어 붙은 머리 뒤로 글이 비친다');
});

/* ══════ ② 줄 목록 ══════ */

test('★★ 줄 목록이 «우리가 쓴 한 줄»을 보여 준다 — 매체 제목은 네 줄로 쏟아졌다', () => {
  const fn = 함수몸(news, '꼭지칸하나');
  assert.ok(fn, '꼭지칸하나 를 못 찾았다');
  assert.match(fn, /esc\(x\.한줄\s*\|\|\s*x\.제목/,
    '줄에 매체 제목만 그린다 — 우리 한 줄이 있으면 그것이 먼저다');
});

test('★ 폰에서 ▲▼ 를 감추고, 출처는 제목 «아래»로 내린다', () => {
  /* ▲▼ 는 손가락보다 작아 눌러도 안 맞는다. 차례 바꾸기는 PC 에서 한다.
     ⚠ 출처를 «지우지» 않는다 — 어느 매체인지는 남아야 한다. 자리만 옮긴다. */
  assert.match(폰, /\.item \.mv\{display:none\}/, '폰에서 ▲▼ 가 그대로 자리를 먹는다');
  assert.ok(!/\.item \.src\{display:none\}/.test(폰),
    '출처를 아예 감췄다 — 어느 매체인지 알 길이 없어진다');
  assert.match(폰, /\.item \.src\{[^}]*grid-row:2/, '출처가 제목 아래로 안 내려간다');
  assert.match(폰, /\.item\{[^}]*display:grid/, '줄을 바둑판으로 안 짰다');
});

/* ══════ ③ 칸이 줄어든다 ══════ */

test('★★ 바둑판 칸이 «줄어들 수 있다» — 안 줄면 화면 밖으로 벌어진다', () => {
  /* 바둑판 칸은 기본이 min-width:auto 라, 안에 안 접히는 줄이 하나만 있어도
     그 줄의 온폭만큼 칸이 벌어진다. 그러면 오른쪽이 조용히 잘린다. */
  assert.match(폰, /\.cols>\*\{min-width:0\}/, '칸에 줄어들 수 있다는 규칙이 없다');
});

/* ══════ ④ 표 ══════ */

test('★★ 폰에서 표는 «옆으로 굴려» 본다 — 한 글자씩 세로로 쏟아지지 않게', () => {
  assert.match(폰, /table\.list th,table\.list td\{white-space:nowrap\}/,
    '표 칸이 접힌다 — 회사 이름이 한 글자씩 세로로 쏟아진다');
  assert.match(폰, /table\.list\{min-width:\d+px\}/, '표가 제 폭을 못 가진다');
  assert.match(폰, /\.box\{overflow-x:auto\}/, '표를 굴릴 자리가 없다');
});

/* ══════ ⑤ 단추 ══════ */

test('★ 회차 단추는 두 칸으로, «보내기»만 제 줄을 온전히 쓴다', () => {
  /* 되돌릴 수 없는 일이라 옆 단추와 나란히 두면 엄지로 잘못 누르기 쉽다. */
  assert.match(폰, /\.hdbar>\.btn\{[^}]*flex:1 1 calc\(50% - \d+px\)/,
    '단추가 두 칸으로 안 선다 — 넷이 세 줄을 먹는다');
  assert.match(폰, /\.hdbar>\.btn\.pri\{flex:1 1 100%\}/,
    '보내기가 제 줄을 안 쓴다 — 잘못 눌리기 쉬운 자리다');
});

/* ══════ ⑥ 얼리기가 폰으로 새지 않는다 ══════ */

test('★★ 위를 얼리는 규칙은 «넓은 화면에만» 있다 — 폰에서 새면 아무것도 못 본다', () => {
  /* 이미 다른 검사가 보는 규칙이지만, 폰 규칙을 만지다 새기 쉬운 자리라 여기서도 본다. */
  assert.ok(!/overflow:hidden/.test(폰.slice(0, 폰.indexOf('.item'))),
    '폰 규칙 안에 쪽을 안 구르게 하는 것이 들어갔다');
  assert.match(news, /@media\(min-width:981px\)\{[\s\S]{0,200}?html,body\{height:100%;overflow:hidden\}/,
    '얼리기가 넓은 화면 조건 밖으로 나갔다');
});
