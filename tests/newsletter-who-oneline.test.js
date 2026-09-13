/* 받는 곳 한 줄을 «진짜 한 줄»로 — 칸 안에서도 줄이 안 쌓이게
   ═══════════════════════════════════════════════════════════════════════════
   대표 지시 2026-09-13:
     「셀1줄씩으로 넣어라 대표자 담당자 정보와 수신거부 바꾸기도 1줄로 해라
      캡쳐2는 줄을 줄여라 너무 많이 내려올 필요없다.」

   ⚠ 사업장 표를 «한 줄»로 합쳤는데, 칸 «안»에서 다시 세 줄로 쌓고 있었다:
     ① 이름·직책  ② 주소  ③ 수신거부·바꾸기.
     줄 하나가 세 줄 높이라 113곳을 보려면 화면을 한참 내려야 한다 —
     합친 뜻이 반만 산 셈이다.
   ⚠ 머리도 넉 줄이었다: 받는 곳 띠 · 유형 칩 · 누구 칩 · 명함 안내.
     표가 시작하기도 전에 화면 절반이 없어진다.

   ★ 여기서 못 박는 것은 «값»이 아니라 «규칙»이다:
     ① 사람 칸은 «한 줄»이다 — 칸 안에서 div 를 쌓지 않는다
     ② 수신거부·바꾸기가 «같은 줄»에 있다
     ③ 주소가 길어도 줄을 «안 늘린다» — 넘치면 … 로 자르고 전체는 title 로 보여 준다
     ④ 유형 칩과 누구 칩이 «한 줄»에 선다

   ⚠ 화면 글을 읽는 검사다. 인터넷도 브라우저도 두드리지 않는다. */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { stripComments } = require('./strip-comments');

const ROOT = path.join(__dirname, '..');
const news = stripComments(
  fs.readFileSync(path.join(ROOT, 'pu-news.html'), 'utf8').replace(/\r\n/g, '\n'));

const 받는분칸 = () => {
  const i = news.indexOf('받는분칸 = function(');
  assert.ok(i > 0, '받는분칸 을 못 찾음');
  return news.slice(i, news.indexOf('\n  };', i));
};

test('★★ 사람 칸은 «한 줄»이다 — 칸 안에서 줄을 쌓지 않는다', () => {
  const fn = 받는분칸();
  /* ⚠ div 를 이어 붙이면 그만큼 줄이 쌓인다. 한 줄짜리 칸에는 div 가 필요 없다. */
  const div수 = (fn.match(/<div/g) || []).length;
  assert.ok(div수 <= 1,
    '★★ 칸 안에 div 가 ' + div수 + '개다 — 그만큼 줄이 쌓여 표가 세 배로 길어진다');
});

test('★★ 수신거부와 바꾸기가 «같은 줄»에 있다', () => {
  const fn = 받는분칸();
  assert.ok(fn.indexOf('수신거부넣기(') >= 0, '수신거부가 없다');
  assert.ok(fn.indexOf('사람바꾸기(') >= 0, '바꾸기가 없다');
  /* 단추를 따로 감싸 아래로 내리던 자리가 없어야 한다 */
  assert.ok(!/padding-top:\s*3px/.test(fn),
    '★★ 단추를 아래 줄로 내리는 여백이 남아 있다');
});

test('★★★ 주소가 길어도 줄을 «안 늘린다» — 넘치면 잘라 보여 준다', () => {
  /* ⚠⚠ 이메일에는 띄어쓰기가 없어, 그냥 두면 칸 너비를 넘겨 줄이 늘어난다.
       예전에는 word-break:break-all 로 «두 줄로 접었다» — 그러면 한 줄이 아니다.
     ★ 잘라 보여 주되 «전체는 title 로» 알려 준다 — 안 그러면 주소를 확인할 길이 없다.
     ⚠⚠ 이 검사는 처음에 «함수만» 보다가 이빨이 없었다. 꾸밈을 CSS 로 옮기자
       함수에서 word-break 가 사라져 저절로 통과했다 — 정작 지켜야 할 «꾸밈 줄»은
       안 보고 있었다. 그래서 여기서는 CSS 줄을 못 박는다. */
  const fn = 받는분칸();
  assert.ok(fn.indexOf('주소글') >= 0, '주소를 따로 다루는 자리가 없다');
  assert.ok(/title="/.test(fn), '★ 자른 주소의 전체를 알려 주지 않는다');

  const m = /\.one\s+\.mail\{([^}]*)\}/.exec(news);
  assert.ok(m, '★★★ .one .mail 꾸밈이 없다 — 주소가 칸을 밀어낸다');
  const 꾸밈 = m[1];
  assert.ok(/text-overflow:\s*ellipsis/.test(꾸밈),
    '★★★ 넘치는 주소를 안 자른다 — 줄이 늘어난다');
  assert.ok(/overflow:\s*hidden/.test(꾸밈), '자르려면 overflow 를 숨겨야 한다');
  /* ⚠⚠ min-width:0 이 없으면 flex 칸이 «안 줄어들어» ellipsis 가 아예 안 먹는다.
       겉보기에는 다 맞춰 놓고 실제로는 표가 옆으로 밀리는, 알아채기 어려운 자리다. */
  assert.ok(/min-width:\s*0/.test(꾸밈),
    '★★★ min-width:0 이 없다 — 자르기가 안 먹고 표가 옆으로 밀린다');
  assert.ok(!/word-break/.test(꾸밈), '★★★ 주소를 접어서 두 줄로 만든다');

  const o = /\.one\{([^}]*)\}/.exec(news);
  assert.ok(o, '.one 꾸밈이 없다');
  assert.ok(/white-space:\s*nowrap/.test(o[1]), '★★ 칸이 줄바꿈을 허용한다');
  assert.ok(/min-width:\s*0/.test(o[1]), '★★ 칸이 안 줄어들어 표를 밀어낸다');
});

test('★ 한 줄로 만들면서 «무엇도 잃지 않는다»', () => {
  /* ⚠ 좁히려다 이름·직책·연락처·딱지를 빼면 명단을 못 읽는다. */
  const fn = 받는분칸();
  ['글칸(x.name', '전화칸(x.전화', '같은 메일', '출처딱지(x.출처']
    .forEach((s) => assert.ok(fn.indexOf(s) >= 0, '한 줄로 줄이며 잃었다: ' + s));
});

test('빈 자리도 «한 줄»이다 — 기업정보함으로 가는 길은 그대로', () => {
  const i = news.indexOf('빈받는분칸 = function(');
  assert.ok(i > 0, '빈받는분칸 을 못 찾음');
  const fn = news.slice(i, news.indexOf('\n  };', i));
  assert.ok((fn.match(/<div/g) || []).length <= 1, '빈 칸이 두 줄이다');
  assert.ok(fn.indexOf('기업정보함에서찾기(') >= 0, '기업정보함으로 가는 길이 사라졌다');
});

test('★★ 유형 칩과 누구 칩이 «한 줄»에 선다 — 머리가 넉 줄이었다', () => {
  /* ⚠ 칩을 두 줄로 두면 표가 시작하기도 전에 화면이 내려간다.
     ★ 두 축을 갈라 두는 뜻(「급여 업체의 대표자만」)은 그대로여야 한다 —
       한 줄에 놓되 «칸막이»로 가른다. */
  assert.ok(news.indexOf('칩묶음') >= 0,
    '★★ 유형 칩과 누구 칩을 한 줄로 묶는 자리가 없다');
  assert.ok(news.indexOf('유형칩누르기(') >= 0 && news.indexOf('누구칩누르기(') >= 0,
    '두 축 가운데 하나가 사라졌다');
});
