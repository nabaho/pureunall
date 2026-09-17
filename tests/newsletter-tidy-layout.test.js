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
const { stripComments } = require('./strip-comments');
const { cutFn } = require('./cut-fn');

const Core = require('../js/pu-news-core.js');
const Tpl = require('../js/pu-news-tpl.js');

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
  assert.ok(m && Number(m[1]) >= 21, '편지 서식을 고치고 캐시 번호를 안 올렸다');
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

test('★★★ 전문 보기 쪽은 «그대로» 둔다', () => {
  /* 요약만 고쳤는데 전문이 함께 흔들리면, 자세히 보러 가신 분이 다른 편지를 본다.
     ⚠ 차림표는 전문(웹)에서 «붙잡히는 줄»이라 실제로 일을 한다(news-view.js). */
  const h = 편지(false);
  assert.match(h, /WEEKLY NEWS LETTER/, '전문에서 배너가 사라졌다');
  assert.match(h, /data-stick/, '전문에서 차림표가 사라졌다 — 붙잡히는 줄이 없어진다');
  assert.ok(h.indexOf('주간 노무 브리핑') < 0, '전문에 요약 머리가 섞였다');
});

test('★★ 가는 줄은 «칸에 색을 깔아» 만든다 — div 테두리는 아웃룩에서 사라진다', () => {
  const 몸 = stripComments(fs.readFileSync(path.join(ROOT, 'js/pu-news-tpl.js'), 'utf8'));
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
  const 꼬리여백 = /padding:30px (\d+)px 0 \1px;/.exec(h);
  assert.ok(몸여백 && 꼬리여백, '여백을 못 읽었다');
  assert.equal(꼬리여백[1], 몸여백[1],
    '꼬리(' + 꼬리여백[1] + ')와 몸통(' + 몸여백[1] + ')의 여백이 다르다');
});

test('★★ 요약판은 전문보다 «여백이 좁다» — 줄칸을 넓게 쓴다', () => {
  /* 대표 지시 2026-09-17 「줄칸등을 좀더 넓게 사용해서」. 좌우 두 칸이라 여백 6px 이
     칸 하나에서 «줄 하나»를 좌우한다 — 줄이 덜 꺾이면 편지가 그만큼 짧아진다.
     ⚠ 몸통과 꼬리가 «같은지»만 보면, 둘 다 28 로 되돌려도 안 걸린다. */
  const m = /padding:18px (\d+)px 0 \1px;/.exec(편지(true));
  assert.ok(m, '요약 몸통 여백을 못 읽었다');
  assert.ok(Number(m[1]) < 28,
    '요약 여백이 ' + m[1] + ' — 전문(28)과 같거나 더 넓다. 줄칸을 넓게 쓰지 않는다');
});

test('★ 명조는 «웹폰트가 아니다» — 못 받아 오면 글자가 통째로 바뀐다', () => {
  const 몸 = stripComments(fs.readFileSync(path.join(ROOT, 'js/pu-news-tpl.js'), 'utf8'));
  const m = /var 세리프 = "([^"]+)"/.exec(몸);
  assert.ok(m, '명조를 못 찾았다');
  assert.ok(!/http|@import|fonts\./.test(m[1]), '웹폰트를 쓴다');
  assert.match(m[1], /serif/, '마지막 기댈 곳(serif)이 없다');
});
