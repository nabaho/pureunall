/* 편지와 화면이 «한눈에» 들어와야 한다 (대표 지시 2026-09-14)
   ═══════════════════════════════════════════════════════════════════════════
   ①「인사노무관리 내용은 모두 보여야 확인한다 한번에 보이게 해라」
     글 쓰는 칸이 rows="4" 로 묶여 있어 긴 글이 칸 «안에서» 잘렸다. 확인하려면
     안에서 굴려야 했고, 굴려서 보는 글은 한눈에 안 들어온다 — 무엇이 빠졌는지 못 찾는다.

   ②「판례나 첨부 참조등은 깔끔하게 위치등을 정렬해라」
     곁말(매체·사건번호·날짜·내려받기)이 문장 «뒤에 붙어» 흘렀다. 줄마다 문장이
     끝나는 자리가 달라 곁말이 여기저기 흩어졌고, 좌우 두 칸이라 남은 자리가 좁으면
     「매일노 / 동뉴스」, 「(20 / 24. 12. 10.)」처럼 한 이름과 한 날짜가 두 동강 났다. */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripComments, stripJs } = require('./strip-comments');
const { cutFn } = require('./cut-fn');

const Core = require('../js/pu-news-core.js');
const Tpl = require('../js/pu-news-tpl.js');
const NV = require('../functions/news-view.js');

const ROOT = path.join(__dirname, '..');
const 화면 = stripComments(fs.readFileSync(path.join(ROOT, 'pu-news.html'), 'utf8')
  .replace(/\r\n/g, '\n'));

/* 견본은 늘 홍길동·가나상사 — 진짜 의뢰인 이름을 쓰지 않는다 */
function 요약편지(항목) {
  const d = {
    열쇠: '2026-09-w2', 상태: '초안', 범위: '자문중', 회차: Core.회차('2026-09-10'),
    우리글: '', 안: { news: [], policy: [], case: [항목], hr: [] }, 지역뉴스: [],
  };
  const 편 = Tpl.편지짓기(d, { 회사이름: '푸른노무법인',
    추적밑주소: 'https://example.kr' }, { 요약: true, 미리보기: true });
  assert.ok(편.서식.indexOf('newsView?i=') >= 0,
    '요약판이 안 켜졌다 — 그린 것을 믿을 수 없다');
  return 편.서식;
}

/* ══════ ① 글칸은 쓴 만큼 늘어난다 ══════ */

/* 글칸맞추기 를 꺼내 «가짜 칸» 하나로 실제로 돌려 본다 —
   「scrollHeight 라는 글자가 있다」로는 못 잡는다(한쪽 가지에만 남아 있어도 통과한다). */
function 칸맞춰보기(칸) {
  const 짐 = {
    document: { querySelectorAll: () => [칸] },
    getComputedStyle: () => ({ boxSizing: 칸._꼴 || 'border-box',
      paddingTop: '9px', paddingBottom: '9px' }),
    parseFloat: parseFloat,
  };
  vm.createContext(짐);
  vm.runInContext(cutFn(화면, 'function 글칸맞추기('), 짐);
  vm.runInContext('글칸맞추기()', 짐);
  return 칸.style.height;
}

test('★★★ 글 높이를 «실제로 재서» 늘린다 — 잘리지 않는다', () => {
  /* 테두리 1px 씩이라 offsetHeight - clientHeight = 2. 글이 300 이면 302 여야 한다. */
  const 칸 = { style: {}, scrollHeight: 300, offsetHeight: 100, clientHeight: 98 };
  assert.equal(칸맞춰보기(칸), '302px', '글 높이를 안 재고 고정값을 쓴다 — 긴 글이 잘린다');
  /* 줄어들 때도 맞아야 한다 — 먼저 'auto' 로 풀지 않으면 한 번 커진 칸이 안 줄어든다 */
  const 짧은칸 = { style: { height: '900px' }, scrollHeight: 80, offsetHeight: 100, clientHeight: 98 };
  assert.equal(칸맞춰보기(짧은칸), '82px', '먼저 풀지 않아 «줄어들 때» 안 맞는다');
});

test('★★ 위쪽 한도를 두지 않는다 — 길수록 도로 잘린다', () => {
  const 몸 = cutFn(화면, 'function 글칸맞추기(');
  assert.ok(!/max-?[Hh]eight/.test(몸),
    '위쪽 한도를 둔다 — 길수록 더 봐야 하는데 길수록 도로 잘린다');
  const 긴칸 = { style: {}, scrollHeight: 4000, offsetHeight: 100, clientHeight: 98 };
  assert.equal(칸맞춰보기(긴칸), '4002px', '긴 글에서 한도에 걸린다');
});

test('★★ 다시 그릴 때마다·치는 동안 «둘 다» 맞춘다', () => {
  const r = cutFn(화면, 'function render(');
  assert.match(r, /글칸맞추기\(\)/, '다시 그리면 칸이 새로 생기는데 안 맞춘다');
  const w = cutFn(화면, 'function 우리글바뀜(');
  assert.match(w, /글칸맞추기\(\)/, '치는 동안 안 늘어난다 — 700ms 를 기다리게 된다');
});

test('★ 늘어나야 할 칸에 «표»가 붙어 있다', () => {
  /* 표가 없으면 글칸맞추기 가 아무 칸도 못 찾아 조용히 아무 일도 안 한다 */
  assert.match(화면, /id="myWrite" class="grow"/, '이번 주 한마디 칸에 표가 없다');
  assert.match(화면, /id="rowW" class="grow"/, '줄 고치는 칸에 표가 없다');
});

/* ══════ ② 곁말은 제 줄에, 덩이는 안 끊기게 ══════ */

test('★★ 곁말이 문장 «뒤»가 아니라 제 줄에 있다', () => {
  const h = 요약편지({ 갈래: '판례', 한줄: '이번 주 가장 중요한 판결입니다.',
    링크: 'https://scourt.go.kr/c1', 기관: '대법원 2018다296229 (2026. 5. 21.)' });
  const i = h.indexOf('대법원');
  assert.ok(i > 0, '곁말이 아예 없다');
  /* 곁말 바로 앞이 «새 줄을 여는 자리»여야 한다 */
  assert.ok(/<div style="margin-top:[^"]*"[^>]*>(?:<span[^>]*>)?대법원/.test(h)
    || h.slice(Math.max(0, i - 220), i).includes('<div'),
    '곁말이 문장과 같은 줄에 흐른다 — 줄마다 시작 자리가 달라진다');
});

test('★★★ 괄호 안 날짜가 «두 동강» 나지 않는다', () => {
  /* 「법제처 24-0835 (20 / 24. 12. 10.)」 — 실제로 이렇게 갈라져 있었다 */
  const h = 요약편지({ 갈래: '판례', 한줄: '압류할 수 없다고 정하고 있습니다.',
    링크: 'https://law.go.kr/c3', 기관: '법제처 24-0835 (2024. 12. 10.)' });
  const m = /<span style="white-space:nowrap;">\(2024\.[^<]*\)<\/span>/.exec(h);
  assert.ok(m, '괄호 안 날짜가 한 덩이가 아니다 — 줄 끝에서 갈라진다');
});

test('★★ 매체 이름 한 덩이가 갈라지지 않는다', () => {
  const h = 요약편지({ 갈래: '기사', 한줄: '첫 사례입니다.', 우리말: '첫 사례입니다.',
    링크: 'https://example.kr/a1', 언론사: '매일노동뉴스' });
  assert.match(h, /<span style="white-space:nowrap;">매일노동뉴스<\/span>/,
    '「매일노 / 동뉴스」로 갈라진다');
});

test('★★ 덩이 «사이»에서는 끊길 수 있다 — 안 그러면 칸을 넘친다', () => {
  /* 좌우 두 칸이라 폭이 좁다. 곁말 전체를 한 덩이로 묶으면 칸 밖으로 나간다. */
  const h = 요약편지({ 갈래: '판례', 한줄: '가리는 기준입니다.',
    링크: 'https://scourt.go.kr/c2', 기관: '대법원 2024도5902 (2026. 6. 25.)' });
  const 덩이 = h.match(/<span style="white-space:nowrap;">[^<]*<\/span>/g) || [];
  assert.ok(덩이.length >= 3,
    '곁말을 통째로 묶었다(' + 덩이.length + '덩이) — 좁은 칸을 넘친다');
});

test('★ 내려받기 표시는 «표시»일 뿐 — 링크로 만들지 않는다', () => {
  /* 한 줄에 링크가 둘이면 어디로 가는지 흐려지고 추적이 한 건을 두 번 센다 */
  const h = 요약편지({ 갈래: '자료', 한줄: '정부 표준안을 내놓았습니다.',
    링크: 'https://moel.go.kr/p2', 기관: '고용노동부', 파일: 'https://example.kr/f2.hwp' });
  const i = h.indexOf('⬇ 내려받기');
  assert.ok(i > 0, '내려받을 것이 있는데 표시가 없다');
  const 조각 = h.slice(Math.max(0, i - 200), i);
  assert.ok(!/<a\s/.test(조각.slice(조각.lastIndexOf('</a>') + 4)),
    '내려받기 표시를 링크로 만들었다');
});

test('★ 파일이 «없으면» 내려받기 표시를 안 붙인다', () => {
  /* 눌러도 받을 것이 없으면 다음부터 이 표시를 안 믿는다 — 붙인 뜻이 없어진다 */
  const h = 요약편지({ 갈래: '자료', 한줄: '정부 표준안을 내놓았습니다.',
    링크: 'https://moel.go.kr/p2', 기관: '고용노동부' });
  assert.ok(h.indexOf('⬇ 내려받기') < 0, '받을 것이 없는데 표시를 붙였다');
});

test('★ 캐시 번호를 올렸다', () => {
  const 원본 = fs.readFileSync(path.join(ROOT, 'pu-news.html'), 'utf8');
  const m = /js\/pu-news-tpl\.js\?v=(\d+)/.exec(원본);
  assert.ok(m && Number(m[1]) >= 22, '편지 서식을 고치고 캐시 번호를 안 올렸다');
});

/* ══════════════════════════════════════════════════════════════════════════
   ③ 요약판은 «신문 머리» 하나로 연다 (대표 결정 2026-09-17)
   ══════════════════════════════════════════════════════════════════════════
   「좀더 세련되게 … 줄칸등을 좀더 넓게 사용해서 화면을 너무 아래로 안 내려오게」
   재 보니 내용이 시작되기 «전에» 400px 을 썼다 — 큰 사진 띠 184 + 차림표 85 +
   머리·안내 134. 그중 차림표는 메일에서 «눌러도 아무 데도 안 간다». */

function 편지(요약) {
  const d = {
    열쇠: '2026-09-w2', 상태: '초안', 범위: '자문중', 회차: Core.회차('2026-09-10'),
    우리글: '', 지역뉴스: [],
    안: { news: [], policy: [{ 갈래: '자료', 한줄: '난임치료휴가는 연 6일입니다.',
      링크: 'https://moel.go.kr/p1', 기관: '고용노동부' }], case: [], hr: [] },
  };
  const 설 = { 회사이름: '푸른노무법인' };
  if (요약) 설.추적밑주소 = 'https://example.kr';
  const 편 = Tpl.편지짓기(d, 설, { 요약: !!요약, 미리보기: true });
  /* ⚠ 요약판은 «전문이 있는 자리»가 있어야 켜진다 — 안 주면 조용히 전문으로 그려져
       「고쳤는데 그대로」인 검사가 된다. 그린 것을 믿기 전에 확인한다. */
  if (요약) assert.ok(편.서식.indexOf('newsView?i=') >= 0, '요약판이 안 켜졌다');
  return 편.서식;
}

test('★★★ 요약판에서 «큰 사진 띠»와 «차림표»를 걷었다', () => {
  const h = 편지(true);
  assert.ok(h.indexOf('height:184px') < 0, '큰 사진 띠가 남아 있다 — 그것만 184px 이다');
  assert.ok(h.indexOf('data-stick') < 0,
    '차림표가 남아 있다 — 메일에서는 눌러도 아무 데도 안 가면서 85px 을 먹는다');
  assert.match(h, /주간 노무 브리핑/, '신문 머리가 없다');
});

test('★★★ 요약과 전문이 «같은 얼굴»이다 (대표 지시 2026-09-17 「전문보기도 맞춰라」)', () => {
  /* 다르면 「자세히 보기」로 넘어가는 순간 다른 편지처럼 보인다.
     ⚠ 차림표만은 전문에 남는다 — 웹에서는 «붙잡히는 줄»이라 실제로 일을 한다
       (news-view.js). 메일에서는 눌러도 아무 데도 안 가면서 85px 을 먹는다. */
  const 요 = 편지(true), 전 = 편지(false);
  [['머리', /주간 노무 브리핑/], ['꼭지 영문 표시', /letter-spacing:2px/]].forEach(function (한벌) {
    assert.match(요, 한벌[1], '요약에 ' + 한벌[0] + ' 이 없다');
    assert.match(전, 한벌[1], '전문에 ' + 한벌[0] + ' 이 없다 — 두 쪽이 갈렸다');
  });
  assert.ok(전.indexOf('WEEKLY NEWS LETTER') < 0, '전문에 옛 사진 띠가 남았다');
  assert.ok(전.indexOf('border-radius:14px') < 0, '전문에 옛 알약 딱지가 남았다');
  assert.match(전, /data-stick/, '전문에서 차림표가 사라졌다 — 붙잡히는 줄이 없어진다');
  assert.ok(요.indexOf('data-stick') < 0, '요약에 차림표가 남았다');
});

test('★★ 요약과 전문이 «같은 여백»을 쓴다', () => {
  /* 다르면 「자세히 보기」로 넘어가는 순간 글이 좌우로 움찔한다 */
  /* ⚠ 꼬리를 «위 여백 숫자»로 찾지 않는다 — 2026-09-18 에 30→20 으로 죄자 이 검사가
       깨졌다. 여기서 보는 것은 «좌우» 여백이 같은가지, 위 여백이 얼마인가가 아니다.
       꼬리는 «갈색 두 겹 윗줄»로 찾는다 — 그것이 꼬리의 표다. */
  const 재기 = (h) => {
    const m = /padding:\d+px (\d+)px 0 \1px;"><table[^>]*border-top:2px solid/.exec(h);
    assert.ok(m, '꼬리 여백을 못 읽었다');
    return m[1];
  };
  assert.equal(재기(편지(false)), 재기(편지(true)), '요약과 전문의 여백이 다르다');
});

test('★★ 가는 줄은 «칸에 색을 깔아» 만든다 — div 테두리는 아웃룩에서 사라진다', () => {
  const 몸 = stripJs(fs.readFileSync(path.join(ROOT, 'js/pu-news-tpl.js'), 'utf8'));
  const i = 몸.indexOf('function _줄띠(');
  assert.ok(i > 0, '줄 긋는 자를 못 찾았다');
  const f = 몸.slice(i, 몸.indexOf('\n  function ', i + 10));
  assert.match(f, /background-color/, '색을 안 깔고 테두리로 그린다');
  assert.ok(!/border-top|border-bottom/.test(f), '테두리로 그린다 — 아웃룩에서 사라진다');
});

test('★★ 꼬리 여백이 몸통과 «같다»', () => {
  /* 다르면 꼬리만 안쪽으로 밀려 들어가 눈에 띈다 */
  const h = 편지(true);
  const 몸여백 = /padding:18px (\d+)px 0 \1px;/.exec(h);
  const 꼬리여백 = /padding:\d+px (\d+)px 0 \1px;"><table[^>]*border-top:2px solid/.exec(h);
  assert.ok(몸여백 && 꼬리여백, '여백을 못 읽었다');
  assert.equal(꼬리여백[1], 몸여백[1],
    '꼬리(' + 꼬리여백[1] + ')와 몸통(' + 몸여백[1] + ')의 여백이 다르다');
});

test('★★ 여백을 옛 28 로 되돌리지 않는다 — 줄칸을 넓게 쓴다', () => {
  /* 대표 지시 2026-09-17 「줄칸등을 좀더 넓게 사용해서」. 좌우 두 칸이라 여백 6px 이
     칸 하나에서 «줄 하나»를 좌우한다 — 줄이 덜 꺾이면 편지가 그만큼 짧아진다.
     ⚠ 요약과 전문이 «같은지»만 보면, 둘 다 28 로 되돌려도 안 걸린다. */
  const m = /padding:18px (\d+)px 0 \1px;/.exec(편지(true));
  assert.ok(m, '요약 몸통 여백을 못 읽었다');
  assert.ok(Number(m[1]) < 28, '여백이 ' + m[1] + ' — 옛 28 로 되돌아갔다');
});

/* ══════════════════════════════════════════════════════════════════════════
   ④ 전문 보기는 «메일이 아니다» — 넓게 짓는다 (대표 지시 2026-09-17)
   ══════════════════════════════════════════════════════════════════════════
   「너무 화면 길게 내려온다 한화면에 나오게 좌우로 넓게 만들어봐라」
   700 은 메일의 한계다(창이 좁고, 넓으면 옆으로 잘린다). 그런데 전문 보기는
   브라우저 쪽인데 거기까지 700 으로 지어, 자료 카드 글이 좁은 통에서 줄줄이 꺾였다. */

function 폭읽기(h) {
  const m = /<table[^>]*\swidth="(\d{3,4})"[^>]*style="width:\1px;background-color:#ffffff/.exec(h);
  assert.ok(m, '바깥 표의 폭을 못 읽었다');
  return Number(m[1]);
}
/* 살구 판이 몇 칸으로 놓였나.
   ⚠ <td> 를 세면 «카드 안»의 칸(표지·글)까지 세어 늘 3 이 나온다 — 처음에 그렇게
     짜서 아무것도 못 잡았다. 바깥 칸만 가리키는 것은 «폭 몫»(50%)과 «칸틀의 열 수»다.
   ⚠ 넓은 쪽은 «칸틀(grid)»이고 메일은 «표»다 — 두 꼴을 다 읽는다. */
function 자료칸수(h) {
  const g = /grid-template-columns:repeat\((\d)/.exec(h);
  if (g) return Number(g[1]);
  const i = h.indexOf('background-color:#fbf4ea');
  assert.ok(i > 0, '자료 칸(살구 판)을 못 찾았다');
  if (h.slice(i).indexOf('width="50%"') >= 0) return 2;
  assert.fail('자료 칸의 칸 수를 못 읽었다');
}
/* 자료 판만 잘라 본다 — 넓은 쪽은 칸틀, 메일은 살구 표 */
function 자료판(h) {
  const i = h.indexOf('display:grid');
  const j = i >= 0 ? i : h.indexOf('background-color:#fbf4ea');
  assert.ok(j >= 0, '자료 칸을 못 찾았다');
  return h.slice(j);
}
function 전문편지(옵션) {
  const d = {
    열쇠: '2026-09-w2', 상태: '초안', 범위: '자문중', 회차: Core.회차('2026-09-10'),
    우리글: '', 지역뉴스: [], 안: { news: [], case: [], hr: [],
      policy: [1, 2, 3, 4, 5, 6].map((i) => ({ 갈래: '자료', 제목: '자료 ' + i,
        발행처: '고용노동부', 한줄: '한 줄 ' + i, 링크: 'https://moel.go.kr/' + i })) },
  };
  return Tpl.편지짓기(d, { 회사이름: '푸른노무법인' },
    Object.assign({ 요약: false, 미리보기: true }, 옵션 || {})).서식;
}

test('★★★ 안 주면 «메일 폭» 그대로다 — 메일은 아무것도 안 바뀐다', () => {
  const h = 전문편지();
  assert.equal(폭읽기(h), 700, '부르는 쪽이 안 줬는데 폭이 바뀌었다 — 메일이 옆으로 잘린다');
  assert.equal(자료칸수(h), 2, '좁은데 세 칸이다 — 한 칸이 200px 남짓이라 글이 쏟아진다');
});

test('★★★ 넓게 주면 «넓게» 짓고 자료 카드를 셋씩 놓는다', () => {
  const h = 전문편지({ 넓이: Tpl.전문넓이 });
  assert.ok(Tpl.전문넓이 >= 900, '전문 폭이 안 넓다');
  assert.equal(폭읽기(h), Tpl.전문넓이, '준 폭으로 안 지었다');
  assert.equal(자료칸수(h), 3, '넓은데 세 칸이 아니다 — 오른쪽이 통째로 빈다');
});

test('★★★ 넓은 쪽 자료 카드는 «줄과 열이 맞는다» (대표 지시 2026-09-18)', () => {
  /* 「줄 이나 열을 좀 정렬 해라」.
     ⚠ 표로 놓으면 줄·열은 맞지만 «발행처와 내려받기 단추»가 카드마다 다른 높이에 뜬다.
       칸의 키가 저절로(auto)라 속의 height:100% 가 갈 곳이 없기 때문이다
       (2026-09-18 실측 1015/932/973). 칸틀의 칸은 줄 키만큼 늘어나 그 100% 가 산다. */
  const 판 = 자료판(전문편지({ 넓이: Tpl.전문넓이 }));
  assert.match(판, /display:grid/, '넓은 쪽을 칸틀로 안 놓는다 — 바닥이 안 맞는다');
  assert.ok(판.indexOf('width="33%"') < 0, '아직 표로 놓는다 — 단추 높이가 제각각이 된다');
  assert.match(판, /display:flex;flex-direction:column/, '칸이 늘어나는 꼴이 아니다');
  /* ★ 늘임은 «사슬»이다 — 칸 → 카드 → 속표. 한 마디만 빠져도 바닥이 안 붙는다.
     ⚠ 판 전체에서 height:100% 를 세면 안 된다 — 속표에만 둘이 있어 사슬이 끊겨도 통과한다
       (2026-09-18 이빨 확인에서 그 구멍으로 빠져나갔다). 카드 «그 태그»를 콕 집는다. */
  const 카드표 = /<table[^>]*id="n-policy-0"[^>]*>/.exec(판);
  assert.ok(카드표, '카드를 못 찾았다');
  assert.match(카드표[0], /height:100%/, '★ 카드가 칸 키만큼 안 늘어난다 — 사슬이 끊겼다');
  const 속표 = /<table(?:(?!<\/table>)[\s\S])*?<td valign="bottom"/.exec(판);
  assert.ok(속표 && /height:100%/.test(속표[0]), '★ 카드 속표가 안 늘어난다 — 사슬이 끊겼다');
  assert.match(판, /valign="bottom"/, '발행처·내려받기가 바닥에 안 붙는다');
});

test('★★ 마지막 줄이 덜 차도 «칸»은 만든다 — 안 만들면 가로줄이 도중에 끊긴다', () => {
  /* ⚠ 여섯 장으로 보면 안 걸린다 — 6 은 이미 3의 배수라 «안 만들어도» 수가 맞는다.
       2026-09-18 이빨 확인에서 실제로 그 구멍으로 빠져나갔다. 넷으로 본다. */
  [4, 5, 7].forEach((몇) => {
    const d = { 열쇠: '2026-09-w2', 상태: '초안', 범위: '자문중', 회차: Core.회차('2026-09-10'),
      우리글: '', 지역뉴스: [], 안: { news: [], case: [], hr: [],
        policy: Array.from({ length: 몇 }, (_, i) => ({ 갈래: '자료', 제목: '자료 ' + (i + 1),
          발행처: '고용노동부' })) } };
    const 판 = 자료판(Tpl.편지짓기(d, { 회사이름: '푸른노무법인' },
      { 요약: false, 미리보기: true, 넓이: Tpl.전문넓이 }).서식);
    const 칸수 = (판.match(/display:flex;flex-direction:column/g) || []).length;
    assert.equal(칸수, Math.ceil(몇 / 3) * 3,
      '자료 ' + 몇 + '장인데 칸이 ' + 칸수 + '개다 — 마지막 줄의 빈 칸을 안 만들었다');
  });
});

test('★★★ 넓게 한 번 지은 뒤에도 «메일은 그대로»다', () => {
  /* 폭을 되돌리지 않으면 전문을 한 번 넓게 지은 뒤 메일까지 넓은 줄 알고 그려진다 —
     그 편지는 받는 쪽에서 오른쪽이 잘린다. */
  전문편지({ 넓이: Tpl.전문넓이 });
  const h = 전문편지();
  assert.equal(폭읽기(h), 700, '앞서 넓게 지은 것이 메일에 새 나갔다');
  assert.equal(자료칸수(h), 2, '앞서 넓게 지은 것이 메일 카드 수에 새 나갔다');
});

test('★★ 웹 쪽 껍데기가 폭을 «지어진 전문에서» 읽는다', () => {
  /* 숫자를 두 곳에 적으면 한쪽만 바뀌어 쪽이 잘리거나 가운데로 쏠린다.
     ⚠ 옛 회차는 700 으로 담겨 있다 — 그때 담긴 대로 보여야 맞다. */
  assert.equal(NV.전문폭(전문편지({ 넓이: Tpl.전문넓이 })), Tpl.전문넓이, '넓은 전문을 못 읽었다');
  assert.equal(NV.전문폭(전문편지()), 700, '옛 폭(700) 전문을 못 읽었다');
  assert.equal(NV.전문폭(''), 700, '못 읽으면 700 으로 물러서야 한다');
  assert.equal(NV.전문폭('<table width="9999" style="width:9999px;background-color:#ffffff">'), 700,
    '터무니없는 폭을 그대로 믿는다');
  const 쪽 = NV.쪽('제목', 전문편지({ 넓이: Tpl.전문넓이 }));
  assert.ok(쪽.indexOf('content="width=' + Tpl.전문넓이 + '"') >= 0,
    '폰에서 줄여 보일 폭이 편지와 다르다 — 오른쪽이 잘린다');
  /* ⚠ 2026-09-20 부터 폭은 «떠 있는 흰 종이»(#card)가 갖는다 — 편지(#wrap)는 그 안에서
       100% 다. 규칙은 그대로다: «껍데기 폭을 편지에서 읽어 한 곳에만 적는다». */
  assert.ok(쪽.indexOf('#card{position:relative;z-index:1;width:' + Tpl.전문넓이 + 'px') >= 0,
    '껍데기 폭이 편지와 다르다');
  assert.ok(쪽.indexOf('#wrap{width:100%') >= 0,
    '편지가 종이 폭을 안 따라간다 — 숫자가 두 곳에 적히면 한쪽만 바뀐다');
});

test('★★ 전문을 담을 때 «넓은 폭»으로 짓는다', () => {
  const 몸 = cutFn(화면, 'async function 전문담기(');
  assert.match(몸, /넓이:\s*Tpl\.전문넓이/, '전문을 메일 폭으로 담는다 — 웹에서 쪽이 길어진다');
});

test('★★★ 이미 «보낸» 회차의 전문은 다시 담지 않는다', () => {
  /* 그 쪽은 받으신 분이 편지의 링크로 여는 자리다 — 그때 나간 것과 달라지면 안 된다 */
  const 몸 = cutFn(화면, 'async function 전문다시담기(');
  const 막음 = 몸.indexOf("d.상태 === '발송'");
  const 담기 = 몸.indexOf('전문담기(');
  assert.ok(막음 >= 0, '보낸 회차를 안 막는다');
  assert.ok(담기 > 막음, '막기 전에 담는다 — 이미 나간 쪽이 바뀐다');
  /* ⚠ 함수 «선언»도 전문다시담기() 를 품는다 — 누르는 자리를 콕 집어 본다 */
  assert.match(화면, /onclick="전문다시담기\(\)"/, '누를 단추가 없다 — 아무 데서도 못 부른다');
});

/* ══════════════════════════════════════════════════════════════════════════
   ⑤ 「더 줄여라」 (대표 지시 2026-09-18)
   ══════════════════════════════════════════════════════════════════════════
   앞선 손질(700→980·셋씩)로도 전문이 3,438px 이었다. 줄이는 길은 둘뿐이다 —
   ① 글이 «아닌» 것을 걷는다(장식 그림·되풀이 표지)  ② 넓은 자리를 옆으로 쓴다(단).
   ⚠ 글은 하나도 안 버렸다. 검사도 그것을 지킨다 — 실린 글자가 줄면 걸린다. */

/* 넓은 쪽·좁은 쪽을 같은 거리로 지어 견준다 */
function 두꼴(안내용, 우리글) {
  const d = () => ({ 열쇠: '2026-09-w2', 상태: '초안', 범위: '자문중',
    회차: Core.회차('2026-09-10'), 우리글: 우리글 || '', 지역뉴스: [],
    안: Object.assign({ news: [], case: [], hr: [], policy: [] }, 안내용) });
  const 짓 = (넓이) => Tpl.편지짓기(d(), { 회사이름: '푸른노무법인' },
    Object.assign({ 요약: false, 미리보기: true }, 넓이 ? { 넓이 } : {})).서식;
  return { 메일: 짓(0), 넓은: 짓(Tpl.전문넓이) };
}

test('★★★ 넓은 쪽은 «단»으로 흘린다 — 메일에는 절대 안 샌다', () => {
  /* ⚠⚠ 아웃룩은 column-count 를 모른다. 하나라도 메일에 새면 그 편지는 한 줄로
       주르륵 쏟아진다 — 그래서 «없는지»를 본다. */
  const { 메일, 넓은 } = 두꼴({
    news: [{ 갈래: '기사', 한줄: '한 줄', 우리말: '우리가 쓴 글', 언론사: '매일노동뉴스' }],
    policy: [1, 2, 3].map((i) => ({ 갈래: '자료', 제목: '자료 ' + i, 발행처: '고용노동부' })),
  }, '이번 주 한마디입니다.');
  /* ⚠⚠ 메일에는 «웹에서만 되는 것»이 하나도 없어야 한다 — 단·칸틀·늘임 모두. */
  ['column-count', 'break-inside', 'display:grid', 'display:flex'].forEach((것) => {
    assert.ok(메일.indexOf(것) < 0, '⚠ 메일에 ' + 것 + ' 이 샜다 — 아웃룩이 모른다');
  });
  /* 넓은 쪽: 글(기사·우리 글)은 «두 단», 자료 카드는 «세 열 칸틀» */
  const 단수 = (넓은.match(/column-count:2/g) || []).length;
  assert.ok(단수 >= 2, '넓은 쪽 글이 두 단인 곳이 ' + 단수 + '곳뿐이다 — 기사와 우리 글 둘이어야 한다');
  assert.match(넓은, /grid-template-columns:repeat\(3/, '자료 카드가 세 열이 아니다');
  assert.ok(넓은.indexOf('column-count:3') < 0,
    '자료 카드를 단에 «쌓는다» — 그러면 줄이 어긋난다 (대표 지시 2026-09-18)');
});

test('★★★ 판례는 넓어도 «한 단»이다 — 나눠 봤고 더 길어졌다', () => {
  /* 2026-09-18 실측 482px → 564px. 단을 반으로 좁히면 한 건의 키가 1.8배가 되는데
     건이 셋뿐이라 줄 수는 둘밖에 안 준다. 단이 이기는 것은 «빈 자리»가 있을 때뿐이다.
     ⚠ 이 검사가 없으면 다음 사람이 「여기도 단으로」 하고 도로 늘려 놓는다. */
  const { 넓은 } = 두꼴({ case: [1, 2, 3].map((i) => ({
    갈래: '판례', 딱지: '[판례]', 제목: '판례 ' + i, 인용: '대법원 2026다' + i })) });
  const i = 넓은.indexOf('data-tag="판례"');
  assert.ok(i > 0, '판례 칸을 못 찾았다');
  const 앞 = 넓은.slice(Math.max(0, i - 600), i);
  assert.ok(앞.indexOf('column-count') < 0, '판례를 단으로 나눴다 — 재 보면 더 길어진다');
});

test('★★★ 글은 하나도 안 버렸다 — 줄인 것은 «글이 아닌 것»뿐이다', () => {
  /* ⚠⚠ 이 검사가 이 판의 뼈대다. 높이를 줄이는 가장 쉬운 길은 글을 자르는 것인데,
       그것은 대표께서 쓰신 글을 숨기는 것이라 절대 안 된다.
     ⚠ 글을 «길게» 넣고 «끝자락»을 본다. 짧은 글로 보면 40자쯤에서 자르는 손질이
       그대로 지나간다 — 2026-09-18 이빨 확인에서 실제로 뚫렸다. */
  const 긴글 = '이번 주 한마디입니다. '.repeat(12) + '여기까지가 대표님 글의 끝자락입니다.';
  const 긴우리말 = '자료에 붙인 우리 설명입니다. '.repeat(8) + '설명의 끝자락입니다.';
  const 긴기사 = '기사를 우리가 정리한 글입니다. '.repeat(8) + '기사 정리의 끝자락입니다.';
  const { 넓은 } = 두꼴({
    news: [{ 갈래: '기사', 한줄: '한 줄', 우리말: 긴기사, 언론사: '매일노동뉴스' }],
    policy: [{ 갈래: '자료', 제목: '자료 제목 하나', 발행처: '고용노동부',
      우리말: 긴우리말, 파일: 'https://moel.go.kr/1.pdf' }],
  }, 긴글);
  [['대표님 글', '여기까지가 대표님 글의 끝자락입니다.'],
   ['자료에 붙인 우리 설명', '설명의 끝자락입니다.'],
   ['기사 정리', '기사 정리의 끝자락입니다.'],
   ['자료 제목', '자료 제목 하나'],
   ['발행처', '고용노동부']].forEach(([무엇, 글]) => {
    assert.ok(넓은.indexOf(글) >= 0, '★ ' + 무엇 + '이 잘렸거나 사라졌다');
  });
  assert.match(넓은, /내려받기/, '내려받기 단추가 사라졌다');
});

test('★★ 표지가 없으면 «칸 자체»가 없다 — 빈 96px 은 글을 좁힌다', () => {
  /* 표지 그림을 안 그리기로 해 놓고 칸만 남기면 글이 96px 만큼 좁아져 줄이 늘어난다 —
     걷어 낸 까닭이 그대로 사라진다. */
  const { 넓은 } = 두꼴({ policy: [{ 갈래: '자료', 제목: '자료 하나', 발행처: '고용노동부' }] });
  assert.ok(!/<td width="96"[^>]*><\/td>/.test(넓은), '★ 빈 96px 칸이 남아 있다');
  assert.ok(넓은.indexOf('width="96"') < 0, '★ 표지도 없는데 96px 칸을 만든다');
});

/* ══════════════════════════════════════════════════════════════════════════
   ⑥ 제호와 틀고정 (대표 지시 2026-09-18 「상단을 좀더 이쁘게」·「캡쳐2 틀고정」)
   ══════════════════════════════════════════════════════════════════════════ */

test('★★ 제호는 «가운데로 쌓인다» — 영문 한 줄 · 이름 · 회차', () => {
  /* 종전에는 이름 왼쪽·회차 오른쪽 «한 줄»이라 제목이 아니라 머리글처럼 읽혔다.
     ⚠ 글자 크기를 못 박지 않는다 — 규칙은 «셋이 가운데로 선다»는 것이다. */
  const h = 편지(true);
  const 영 = h.indexOf('PUREUN LABOR LAW FIRM');
  const 이 = h.indexOf('주간 노무 브리핑');
  const 회 = h.indexOf('주차');
  assert.ok(영 > 0, '★ 영문 한 줄이 없다');
  assert.ok(영 < 이 && 이 < 회, '★ 영문·이름·회차 차례가 아니다');
  /* 제호는 «굵은 줄»에서 시작해 회차까지다 — 글자 크기를 못 박지 않는다 */
  const 시 = h.indexOf('background-color:#241a13');
  assert.ok(시 > 0 && 시 < 영, '제호를 닫는 굵은 줄을 못 찾았다');
  const 제호 = h.slice(시, 회 + 40);
  assert.ok((제호.match(/align="center"/g) || []).length >= 3,
    '★ 제호가 가운데로 안 섰다 — 영문·이름·회차 셋이 가운데여야 한다');
  assert.ok(제호.indexOf('align="right"') < 0, '★ 회차가 아직 오른쪽에 붙어 있다');
});

test('★ 제호 위아래는 «겹줄»이다 — 한 줄만 그으면 칸막이로 보인다', () => {
  const 몸 = stripComments(fs.readFileSync(path.join(ROOT, 'js/pu-news-tpl.js'), 'utf8'));
  const f = cutFn(몸, 'function 요약머리(');
  assert.ok((f.match(/_줄띠\(/g) || []).length >= 3, '제호를 닫는 줄이 모자란다');
});

test('★★ 로고를 넣어도 제호가 «가운데»에 남는다', () => {
  /* align 만으로는 그림+글자 덩이가 안 가운데 온다 — 안쪽 표가 있어야 한다.
     ⚠ 남의 서버 그림은 여기서 걸린다(열람 추적이 새는 자리다). */
  const d = { 열쇠: '2026-09-w2', 상태: '초안', 범위: '자문중', 회차: Core.회차('2026-09-10'),
    우리글: '', 지역뉴스: [], 안: { news: [], case: [], hr: [],
      policy: [{ 갈래: '자료', 제목: '자료 하나', 발행처: '고용노동부' }] } };
  const 짓 = (로고) => Tpl.편지짓기(d, { 회사이름: '푸른노무법인', 로고그림: 로고 },
    { 요약: false, 미리보기: true }).서식;
  const 우리 = 짓('https://nabaho.github.io/pureunall/img/logo.png');
  assert.match(우리, /<table[^>]*align="center"[^>]*>(?:(?!<\/table>)[\s\S])*?logo\.png/,
    '★ 로고가 가운데 덩이 밖에 있다 — 제호가 왼쪽으로 쏠린다');
  assert.ok(짓('https://evil.example.com/logo.png').indexOf('evil.example.com') < 0,
    '⚠ 남의 서버 로고가 나갔다 — 열람 추적이 새는 자리다');
});

test('★★★ 틀고정한 차림표가 «일한다» — 누르면 그 꼭지로 간다', () => {
  /* 대표 지시 2026-09-18 「캡쳐2 틀고정」. 지금까지는 따라오기만 하고 눌러도
     아무 일이 없었다 — 값이 없는 띠였다.
     ⚠ 편지(pu-news-tpl.js)가 아니라 «웹 껍데기»가 붙인다. 메일 프로그램은 같은 편지
       안 자리이동을 무시하므로, 편지에 링크를 넣으면 눌러도 헛일이 된다. */
  const 전 = 전문편지({ 넓이: Tpl.전문넓이 });
  const 쪽 = NV.쪽('제목', 전);
  assert.match(전, /data-stick/, '붙잡을 줄이 편지에 없다');
  assert.ok(전.indexOf('<a href="#g-') < 0, '⚠ 편지에 자리이동 링크를 넣었다 — 메일에서 헛일이 된다');
  assert.match(쪽, /data-stick/, '껍데기가 붙잡는 규칙을 잃었다');
  assert.match(쪽, /td\[align=center\]/, '차림표 칸을 못 찾게 되어 있다');
  assert.match(쪽, /addEventListener\("click",가자\)/, '눌러도 가는 길이 없다');
  assert.match(쪽, /td\.nav\.on/, '지금 보는 꼭지에 표시가 없다');
  /* ⚠ 누를 때 초점이 잡히면 창이 좁을 때 쪽이 «옆으로» 밀려 왼쪽이 잘린다 */
  assert.match(쪽, /addEventListener\("mousedown"[\s\S]{0,60}?preventDefault/,
    '⚠ 누를 때 쪽이 옆으로 밀린다 — 왼쪽이 잘린다');
  /* ⚠ 내려앉는 자리와 «지금 어디냐»의 잣대가 어긋나면 눌러도 옛 꼭지에 밑줄이 남는다 */
  const 앉 = /offsetHeight-(\d+)/.exec(쪽), 잣 = /offsetHeight\+(\d+)/.exec(쪽);
  assert.ok(앉 && 잣, '내려앉는 자리나 잣대를 못 읽었다');
  assert.ok(Number(잣[1]) > Number(앉[1]),
    '내려앉은 꼭지가 안 켜진다 (' + 앉[1] + ' vs ' + 잣[1] + ')');
});

test('★ 명조는 «웹폰트가 아니다» — 못 받아 오면 글자가 통째로 바뀐다', () => {
  const 몸 = stripJs(fs.readFileSync(path.join(ROOT, 'js/pu-news-tpl.js'), 'utf8'));
  const m = /var 세리프 = "([^"]+)"/.exec(몸);
  assert.ok(m, '명조를 못 찾았다');
  assert.ok(!/http|@import|fonts\./.test(m[1]), '웹폰트를 쓴다');
  assert.match(m[1], /serif/, '마지막 기댈 곳(serif)이 없다');
});
