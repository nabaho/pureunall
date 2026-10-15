/* 뉴스레터 «지난 회차» 미리보기는 한눈에 보인다 — 줄여서 폭에 맞추고, 안쪽 스크롤 상자가 없다 (대표 지시 2026-10-13)
   ═══════════════════════════════════════════════════════════════════════
   「지난회차 보는부분 한눈에 보게 해라 그래야 앞으로 수정가능하다」

   ★ 고치기 전 실측(진짜 Edge, 1600px): 편지(980px)가 758px 틀에 갇혀 오른쪽 237px 이 잘리고(틀 안 가로 스크롤),
     그 틀이 또 560~630px 높이의 «스크롤 상자»(.paper max-height:70vh) 안에 있어 안쪽에서 한 번 더 굴려야 했다.
     대표 화면에서 꼬리 문장이 «밝힙»에서 잘려 보인 것이 이것이다.
   ★ 이 검사는 «값»이 아니라 «규칙»을 본다 — 몇 px·몇 배인가가 아니라
       ① 안쪽 스크롤 상자가 없는가 ② 줄여서 맞추는 길을 쓰는가 ③ 틀이 여럿이어도 각자 맞춰지는가
       ④ 틀 안에 스크롤바가 끼지 않는가 ⑤ 폰 폭에서는 안 줄이는가.
   ⚠ 주석은 걷고 본다 — 되살리지 말라는 «경고 글»에 그 글귀가 들어 있어서다(tests-must-strip-comments). */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.join(__dirname, '..');

const 화면 = fs.readFileSync(path.join(ROOT, 'pu-news.html'), 'utf8');
const 짓는층 = fs.readFileSync(path.join(ROOT, 'js', 'pu-news-tpl.js'), 'utf8');

/* 주석 걷기 — 문자열 속의 // (주소) 는 건드리지 않게 «줄 처음의 //» 만 걷는다 */
function 주석걷기(s) {
  return String(s).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
}

/* 함수 몸통 — 이름으로 찾아 중괄호를 맞춰 끝까지. 못 찾으면 null */
function 함수몸(src, 이름) {
  const i = src.indexOf('function ' + 이름 + '(');
  if (i < 0) return null;
  let j = src.indexOf('{', i), 깊이 = 0;
  for (let k = j; k < src.length; k++) {
    if (src[k] === '{') 깊이++;
    else if (src[k] === '}' && --깊이 === 0) return 주석걷기(src.slice(j, k + 1));
  }
  return null;
}

const 코드 = 주석걷기(화면);

test('★★ 지난 회차 미리보기 칸에 «안쪽 스크롤 상자»가 없다 — 한눈에 못 본다', () => {
  /* ⚠ «선택자가 정확히 .pv .paper» 인 규칙만 본다. `.wrap.now .pv .paper{…}` 는 이번 회차 탭 껍데기용이라
       지난 회차 탭(.pv 가 쓰이는 유일한 곳)에는 걸리지 않는다 — 그걸 잡으면 엉뚱한 곳에서 운다. */
  const 규칙들 = (코드.match(/(?:^|[},\n])\s*\.pv \.paper\{[^}]*\}/g) || []).map(function (r) { return r.replace(/^[},\n\s]+/, ''); });
  assert.ok(규칙들.length >= 1, '.pv .paper 규칙을 못 찾았다');
  규칙들.forEach(function (r) {
    assert.ok(!/max-height\s*:\s*(?!none)/.test(r), '★★ 미리보기 칸이 높이에 갇힌다 — 안쪽에서 또 굴려야 한다: ' + r);
    assert.ok(!/overflow(?:-y)?\s*:\s*(?:auto|scroll)/.test(r), '★★ 미리보기 칸이 스크롤 상자가 된다: ' + r);
  });
});

test('★★ 지난 회차는 «줄여서 폭에 맞추는 길»(편지창채우기)로 그린다 — 맨 iframe 이 아니다', () => {
  const 몸 = 함수몸(화면, '지난미리보기그리기');
  assert.ok(몸, '지난미리보기그리기 를 못 찾았다');
  assert.match(몸, /편지창채우기\(/, '★★ 줄여 맞추는 길을 안 쓴다 — 980px 편지가 좁은 칸에서 잘린다');
  assert.ok(!/\.srcdoc\s*=/.test(몸), '★★ 맨 iframe 에 직접 srcdoc 을 넣는다 — 폭에 안 맞춰져 오른쪽이 잘린다');
  assert.match(몸, /좁으면그대로\s*:\s*true/, '폰 폭에서도 줄인다 — 글자가 못 읽을 만큼 작아진다');
  assert.match(몸, /틀스크롤없이\s*:\s*true/, '틀 안에 스크롤바가 낀다 — 폭이 15px 줄어 오른쪽이 잘린다');
  assert.ok(!/id="pastFrame"/.test(코드), '옛 맨 iframe(pastFrame)이 남아 있다');
});

test('★★ 줄여 맞추는 틀이 «여럿»이어도 각자 맞춰진다 — 크게 창이 옆 틀을 덮어쓰지 않는다', () => {
  const 몸 = 함수몸(화면, '편지창채우기');
  assert.ok(몸, '편지창채우기 를 못 찾았다');
  /* 예전에는 맞추는 함수를 하나만 기억했다(let _편지맞추기 = 맞추기). 크게 창을 열면 지난 회차 옆 틀이
     등록에서 밀려나, 창 크기를 바꿔도 옆 틀이 안 맞춰졌다. */
  assert.match(몸, /_맞추기들\[\s*자리\s*\]\s*=/, '★★ 틀을 자리별로 등록하지 않는다 — 나중에 그린 틀이 앞 틀을 덮어쓴다');
  assert.ok(!/_편지맞추기\s*=\s*맞추기/.test(몸), '★★ 맞추는 함수를 하나만 기억하는 옛 방식이다');
  const 모두 = 코드.match(/let _편지맞추기\s*=\s*function\(\)\{[\s\S]*?\n\};/);
  assert.ok(모두 && /Object\.keys\(_맞추기들\)/.test(모두[0]), '★★ 등록된 틀을 «전부» 맞추지 않는다');
  assert.match(몸, /ResizeObserver/, '★ 칸 폭이 바뀌는 것(세로 스크롤바가 생겨 칸이 좁아짐)을 지켜보지 않는다 — 창 크기 이벤트만으로는 못 잡는다');
});

test('★ 크게 창을 닫아도 «맞추는 함수»는 남는다 — 지난 회차 옆 틀이 계속 맞춰져야 한다', () => {
  const 몸 = 함수몸(화면, 'closeBig');
  assert.ok(몸, 'closeBig 를 못 찾았다');
  assert.ok(!/_편지맞추기\s*=\s*null/.test(몸), '★★ closeBig 이 맞추는 함수를 통째로 지운다 — 옆 틀이 더는 안 맞춰진다');
  assert.match(몸, /delete\s+_맞추기들/, '크게 창의 틀을 등록에서 안 뺀다 — 닫힌 창을 계속 맞추려 한다');
});

test('★★ 틀 안에 스크롤바가 끼지 않게 끌 수 있다 — 틀 키가 편지 키라 안쪽 스크롤이 필요 없다', () => {
  const 몸 = 함수몸(화면, '편지창채우기');
  assert.match(몸, /틀스크롤없이/, '스크롤바를 끄는 옵션이 없다');
  assert.match(몸, /scrolling="no"/, '옵션이 있어도 실제로 scrolling="no" 를 안 건다');
});

test('★★ 좁은 칸(폰 폭)에서는 «안 줄이고» 편지가 스스로 접히게 둔다 — 그 폭은 편지의 폰 모양 기준 아래다', () => {
  const 몸 = 함수몸(화면, '편지창채우기');
  assert.match(몸, /쓸폭\s*<\s*폰꼴폭/, '좁은 칸 분기가 없다');
  const m = /const 폰꼴폭\s*=\s*(\d+)\s*;/.exec(코드);
  assert.ok(m, '폰꼴폭 을 못 찾았다');
  /* 줄이지 않는 폭에서는 편지가 «자기 폰 모양»으로 그려져야 읽을 만하다 — 편지의 폰 모양 기준(반응 규칙의 max-width)보다
     좁은 쪽에서만 줄이지 않아야 한다. 안 그러면 중간 폭에서 980px 편지가 줄지도 접히지도 않아 오른쪽이 잘린다. */
  const 기준 = /@media only screen and \(max-width:(\d+)px\)/.exec(주석걷기(짓는층));
  assert.ok(기준, '편지 짓는 층의 폰 모양 기준(반응 규칙)을 못 찾았다');
  assert.ok(Number(m[1]) <= Number(기준[1]),
    '★★ 줄이지 않는 폭(' + m[1] + ')이 편지의 폰 모양 기준(' + 기준[1] + ')보다 넓다 — 그 사이 폭에서 오른쪽이 잘린다');
  /* 줄이는 쪽은 그대로여야 한다 — 크게 창이 같은 길을 쓴다 */
  assert.match(몸, /Math\.min\(1,\s*쓸폭\s*\/\s*편지폭\)/, '줄이는 길이 사라졌다');
});

test('★ 넓은 화면에서 지난 회차 목록 칸에는 «최소 폭»이 있다 — 없으면 배지·이름이 세로로 쪼개진다', () => {
  const 규칙 = /#main\[data-tab=past\] \.cols\{[^}]*grid-template-columns\s*:\s*([^;}]*)/.exec(코드);
  assert.ok(규칙, '지난 회차 칸 나눔 규칙을 못 찾았다');
  assert.match(규칙[1], /minmax\(\s*\d+px\s*,/, '★ 목록 칸에 최소 폭이 없다 — 1100px 창에서 「시험」 배지가 세로로 쪼개지고 이름이 두 줄로 꺾인다');
  /* 이 규칙은 «넓은 화면 껍데기» 안에 있어야 한다 — 폰·태블릿(1칸)에 새면 한 칸 배치가 깨진다.
     (껍데기 찾는 방식은 newsletter-app.test.js 와 같다: 처음 나오는 @media(min-width:981px){ 의 중괄호가 닫힐 때까지) */
  const 열쇠 = '@media(min-width:981px){';
  const a = 코드.indexOf(열쇠);
  let i = a + 열쇠.length, 깊이 = 1;
  while (i < 코드.length && 깊이 > 0) { if (코드[i] === '{') 깊이++; else if (코드[i] === '}') 깊이--; i++; }
  assert.ok(/#main\[data-tab=past\] \.cols\{/.test(코드.slice(a, i)),
    '★★ 지난 회차 칸 나눔이 넓은 화면 껍데기 «밖»에 있다 — 폰·태블릿에 샌다');
  /* ⚠ 처음 나오는 @media(min-width:981px){…} 가 «진짜 껍데기»여야 한다 — 다른 검사들(newsletter-app)이 «처음 나오는 것»을 껍데기로 본다.
     (예전 단언 둘은 `a` 를 indexOf 로 정한 뒤 같은 식과 견줘 «항상 참»이었다 — 2026-10-15 Codex 검토 12번. 껍데기의 «내용»으로 견준다.) */
  assert.ok(/html,body\{[^}]*overflow:hidden/.test(코드.slice(a, i)),
    '★★ 처음 나오는 @media(min-width:981px){…} 가 «넓은 화면 껍데기»가 아니다 — 껍데기보다 앞에 같은 조건의 블록이 생겼다(다른 검사들이 처음 나오는 것을 껍데기로 본다)');
});
