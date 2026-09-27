/* 움직이는 화면 + 창고 사진 (대표 지시 2026-09-23)
   ═══════════════════════════════════════════════════════════════════════════
   「추석 설 명절 인사등을 영상 또는 화면으로도 보내고 싶은데」
   대표 결정: 「영상 말고 «움직이는 화면»만」 · 「얼굴은 창고 + 함수」

   ■ 이 검사가 지키는 것 — 대부분 «새는 구멍»이다
     ㉠ 남의 서버 그림은 어디에도 안 실린다 (화면·서버 문지기·발송기 세 곳이 «같은 목록»)
     ㉡ 창고 문(?img=)은 «우리가 지은 열쇠 모양»만 받는다 — ../ 로 급여자료를 못 꺼낸다
     ㉢ 창고 문은 실시간DB 를 «안 연다». 움직이는 화면 문은 «두 칸만» 읽는다(받는이 금지)
     ㉣ 초안은 안 보여 준다
     ㉤ 움직임을 줄여 달라는 분께는 «저절로 넘기지 않는다»
     ㉥ ▶ 는 «실제로 지어질 쇼»가 있을 때만 — 편지와 화면이 같은 잣대를 쓴다
     ㉦ 올리기 전에 사진을 «다시 그린다» — 찍은 자리(GPS)가 빠진다 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { 주석걷기, 함수몸 } = require('./helpers/strip-comments.js');

const 뿌리 = path.join(__dirname, '..');
const S = require('../js/pu-news-show.js');
const C = require('../js/pu-news-core.js');
const T = require('../js/pu-news-tpl.js');
const NV = require('../functions/news-view.js');
const 읽기 = (p) => fs.readFileSync(path.join(뿌리, p), 'utf8');
const 화면 = 주석걷기(읽기('pu-news.html'));
const 서버 = 주석걷기(읽기('functions/index.js'));
const 발송기 = 주석걷기(읽기('functions/mail-send.js'));

const 우리 = 'https://nabaho.github.io/pureunall/img/news-banner.png';
const 창고 = 'https://asia-northeast3-pureun-erp.cloudfunctions.net/newsView?img='
  + 'a'.repeat(32) + '.jpg';
const 남 = 'https://evil.example.com/pixel.png';

/* ═══ 짓기 ═══════════════════════════════════════════════════════════════ */
test('장면이 없으면 «안 짓는다» — 빈 쪽을 담지 않는다', () => {
  assert.strictEqual(S.쇼짓기({}), null);
  assert.strictEqual(S.쇼짓기({ 장면들: [] }), null);
  assert.strictEqual(S.쇼짓기({ 장면들: [{ 그림: '', 글: '  ' }, {}] }), null);
});

test('★★ 남의 서버 그림은 «그림만» 버리고 글은 남긴다', () => {
  const h = S.쇼짓기({ 장면들: [{ 그림: 남, 글: '남의 그림 장면' }, { 그림: 우리 }, { 그림: 창고 }] });
  assert.ok(h, '쇼가 지어져야 한다');
  assert.ok(!h.includes('evil.example.com'), '남의 서버 그림이 실렸다 — 열람이 샌다');
  assert.ok(h.includes('남의 그림 장면'), '그림이 걸려도 글은 남아야 한다');
  assert.ok(h.includes(우리) && h.includes(창고.replace(/&/g, '&amp;')), '우리 그림은 실려야 한다');
  /* 남의 그림«만» 있고 글이 없는 장면은 통째로 빠진다 */
  assert.strictEqual(S.쇼짓기({ 장면들: [{ 그림: 남 }] }), null);
});

test('장면은 한도까지만 — 넘으면 인사가 아니라 발표가 된다', () => {
  const 많이 = Array.from({ length: S.장면한도 + 8 }, (_, i) => ({ 글: '장면 ' + i }));
  const h = S.쇼짓기({ 장면들: 많이 });
  assert.strictEqual((h.match(/<figure /g) || []).length, S.장면한도);
});

test('글자는 씻긴다 — 장면 글·제목의 태그가 살아나지 않는다', () => {
  const h = S.쇼짓기({ 제목: '<b>제</b>', 서명: '"드림"', 장면들: [{ 글: '<script>alert(1)</script>' }] });
  assert.ok(!h.includes('<script>alert'), '장면 글의 태그가 그대로 나갔다');
  assert.ok(!h.includes('<b>제</b>'), '제목의 태그가 그대로 나갔다');
  assert.ok(h.includes('&lt;script&gt;'), '글자로 바뀌어 보여야 한다');
});

/* ═══ ㉠ 세 곳이 «같은 목록» ═════════════════════════════════════════════
   ⚠⚠ 화면(쇼짓기)·서버 문지기(CSP)·발송기(IMG_HOST_OK). 하나만 넓어지면 거기로 샌다. */
test('★★★ 우리 그림 목록이 발송기(IMG_HOST_OK)와 «똑같다»', () => {
  const m = /const IMG_HOST_OK\s*=\s*\[([\s\S]*?)\]/.exec(발송기);
  assert.ok(m, '발송기에서 IMG_HOST_OK 를 못 찾았다');
  const 발 = (m[1].match(/'[^']+'|"[^"]+"/g) || []).map((s) => s.slice(1, -1));
  assert.deepStrictEqual(S.우리주소들.slice().sort(), 발.slice().sort(),
    '움직이는 화면의 목록이 발송기와 다르다 — 넓은 쪽으로 샌다');
});

test('★★★ 서버 문지기(CSP)도 «그 두 곳»만 그림을 허락한다', () => {
  const 줄 = /img-src ([^;]+);/.exec(NV.쇼보안);
  assert.ok(줄, 'CSP 에 img-src 가 없다 — 그러면 default-src 를 따른다');
  const 허락 = 줄[1].trim().split(/\s+/).sort();
  const 기대 = [...new Set(S.우리주소들.map((u) => new URL(u).origin))].sort();
  assert.deepStrictEqual(허락, 기대, 'CSP 그림 허락이 우리 목록과 다르다');
  assert.match(NV.쇼보안, /default-src 'none'/, '기본이 «아무것도 안 됨»이 아니다');
  assert.match(NV.쇼보안, /frame-ancestors 'none'/, '남의 쪽 안에 끼워 넣을 수 있다');
});

/* ═══ ㉡ 창고 문의 열쇠 ═══════════════════════════════════════════════════ */
test('★★★ 창고 문은 «우리가 지은 열쇠 모양»만 받는다', () => {
  const 좋 = NV.그림열쇠('0123456789abcdef0123456789abcdef.jpg');
  assert.ok(좋, '제대로 된 열쇠가 막혔다');
  assert.strictEqual(좋.자리, 'newsletter_img/0123456789abcdef0123456789abcdef.jpg');
  assert.strictEqual(좋.종류, 'image/jpeg');
  [
    '../pu_paydata/x/y.jpg',                              // 남의 자리로 나가기
    '0123456789abcdef0123456789abcdef.jpg/../../a',
    '0123456789ABCDEF0123456789ABCDEF.jpg',               // 대문자 — 우리는 안 짓는다
    '0123456789abcdef0123456789abcde.jpg',                // 31자리
    '0123456789abcdef0123456789abcdef.svg',               // svg 는 스크립트를 품는다
    '0123456789abcdef0123456789abcdef.html',
    '0123456789abcdef0123456789abcdef.jpg ',
    '', null, undefined, {}, ['x']
  ].forEach((v) => assert.strictEqual(NV.그림열쇠(v), null, JSON.stringify(v) + ' 가 통과했다'));
});

/* ═══ ㉢ 서버가 읽는 것 ══════════════════════════════════════════════════ */
function newsView몸() {
  const i = 서버.indexOf('exports.newsView');
  assert.ok(i >= 0, 'newsView 가 없다');
  return 서버.slice(i, 서버.indexOf('exports.', i + 10));
}

test('★★★ 창고 문은 실시간DB 를 «안 연다» — 그리고 회차 읽기보다 «먼저» 갈라진다', () => {
  const 몸 = newsView몸();
  const 시작 = 몸.indexOf('req.query.img != null');
  assert.ok(시작 > 0, '창고 문 갈래를 못 찾았다');
  const 끝 = 몸.indexOf('NV.읽기(req.query)');
  assert.ok(끝 > 시작, '창고 문이 회차 읽기보다 «뒤»에 있다');
  const 갈래 = 몸.slice(시작, 끝);
  assert.ok(갈래.includes('NV.그림열쇠'), '열쇠를 씻지 않고 창고를 연다');
  assert.ok(!/getDatabase|db\.ref|newsletter\//.test(갈래), '창고 문이 실시간DB 를 연다');
  assert.ok(/NEWS_IMG_BUCKET/.test(갈래), '창고를 이름 없이(기본값으로) 연다');
});

test('★★★ newsView 는 회차에서 «허락한 칸»만 읽는다 — 받는이 금지', () => {
  const 몸 = newsView몸();
  const 칸들 = (몸.match(/db\.ref\(밑\s*\+\s*"([^"]+)"\)/g) || [])
    .map((s) => /"([^"]+)"/.exec(s)[1]);
  assert.ok(칸들.length >= 3, '읽는 칸을 못 찾았다');
  칸들.forEach((k) => assert.ok(['상태', '전문', '제목', '쇼'].indexOf(k) >= 0,
    'newsView 가 «' + k + '» 를 읽는다 — 허락한 칸이 아니다'));
  assert.ok(!몸.includes('받는이'), 'newsView 가 받는이를 만진다');
});

test('★★ 움직이는 화면 갈래는 문지기(CSP)를 붙이고 «상태·쇼»만 읽는다', () => {
  const 몸 = newsView몸();
  const i = 몸.indexOf('if (q.쇼)');
  assert.ok(i > 0, '움직이는 화면 갈래를 못 찾았다');
  /* ⚠ 줄끝으로 자르지 않는다 — 윈도(CRLF)와 CI(LF)가 달라 한쪽에서 헛돈다.
       다음 갈래(전문)가 시작되는 글자까지 자른다. */
  const 끝 = 몸.indexOf('const [상태, 전문]', i);
  assert.ok(끝 > i, '전문 갈래를 못 찾았다 — 움직이는 화면 갈래가 그 «앞»에 있어야 한다');
  const 갈래 = 몸.slice(i, 끝);
  assert.ok(갈래.includes('Content-Security-Policy') && 갈래.includes('NV.쇼보안'),
    '문지기(CSP) 없이 내준다');
  assert.ok(갈래.includes('NV.쇼볼수있나'), '초안 거르기 없이 내준다');
  assert.ok(!갈래.includes('"전문"'), '움직이는 화면 갈래가 전문까지 읽는다');
});

/* ═══ ㉣ 초안은 안 보여 준다 ═══════════════════════════════════════════ */
test('★★ 초안의 움직이는 화면은 안 보여 준다', () => {
  assert.strictEqual(NV.쇼볼수있나('초안', '<html>').ok, false);
  assert.strictEqual(NV.쇼볼수있나('초안', '<html>').까닭, '초안');
  assert.strictEqual(NV.쇼볼수있나('발송', '').까닭, '쇼없음');
  assert.strictEqual(NV.쇼볼수있나('', '<html>').까닭, '없음');
  assert.strictEqual(NV.쇼볼수있나('발송', '<html>').ok, true);
  assert.ok(NV.까닭말['쇼없음'], '「없다」는 말이 사람 말로 적혀 있어야 한다');
  assert.strictEqual(NV.읽기({ i: '2026-09-w4', show: '1' }).쇼, true);
  assert.strictEqual(NV.읽기({ i: '2026-09-w4' }).쇼, false);
});

/* ═══ ㉤ 움직임을 줄여 달라는 분 ════════════════════════════════════════
   ⚠ 글자로 보지 않고 «돌려» 본다 — matchMedia 가 reduce 면 넘기기 타이머가 안 선다. */
function 돌려보기(줄여달라) {
  const h = S.쇼짓기({ 장면들: [{ 글: '하나' }, { 글: '둘' }, { 글: '셋' }] });
  const m = /<script>([\s\S]*?)<\/script>/.exec(h);
  assert.ok(m, '쇼에 스크립트가 없다');
  const 요소 = () => ({ classList: { toggle() {} }, setAttribute() {}, getAttribute() { return '0'; },
    textContent: '', onclick: null });
  const 판 = { 타이머: 0 };
  const 짐 = {
    document: {
      querySelectorAll: () => [요소(), 요소(), 요소()],
      getElementById: () => 요소(),
      addEventListener() {}
    },
    window: { matchMedia: () => ({ matches: 줄여달라 }) },
    setInterval: () => { 판.타이머++; return 1; },
    clearInterval() {}
  };
  vm.createContext(짐);
  vm.runInContext(m[1], 짐);
  return 판.타이머;
}
test('★★ 움직임을 줄여 달라는 분께는 저절로 넘기지 않는다', () => {
  assert.strictEqual(돌려보기(true), 0, '줄여 달라고 했는데 저절로 넘긴다');
  assert.ok(돌려보기(false) >= 1, '평소에는 저절로 넘겨야 한다');
});

/* ═══ ㉥ 편지의 ▶ ═══════════════════════════════════════════════════════ */
const 설 = { 회사이름: '푸른노무법인', 추적밑주소: 'https://asia-northeast3-pureun-erp.cloudfunctions.net' };
const 기사 = { 갈래: '기사', 제목: '제목', 우리말: '우리 말', 언론사: '매일노동뉴스',
  링크: 'https://www.labortoday.co.kr/news/articleView.html?idxno=1' };
function 편지(인사) {
  return T.편지짓기({ 회차: C.회차('2026-09-28'), 안: { news: [기사] }, 우리글: '', 인사: 인사 },
    설, { 미리보기: true });
}

test('★★ 장면이 있으면 ▶ 가 «그 회차의 움직이는 화면»을 가리킨다 — 평문에도', () => {
  const r = 편지({ 제목: '풍성한 한가위', 그림: 우리, 장면들: [{ 글: '한 장' }] });
  const 회열 = C.회차('2026-09-28').열쇠;
  const 주소 = 설.추적밑주소 + '/newsView?i=' + encodeURIComponent(회열) + '&show=1';
  assert.ok(r.서식.includes('▶'), '▶ 가 없다');
  assert.ok(r.서식.includes(주소.replace(/&/g, '&amp;')), '▶ 가 그 회차의 쇼를 안 가리킨다');
  assert.ok(r.본문.includes(주소), '평문에 보는 주소가 없다 — 서식만 고친 것이다');
});

test('★★ 쇼가 «안 지어질» 장면이면 ▶ 도 없다 — 편지와 화면이 같은 잣대', () => {
  /* 남의 그림뿐인 장면 — 화면 쪽이 버리므로 쇼가 안 지어진다. ▶ 가 있으면 헛손잡이다. */
  const r = 편지({ 제목: '인사', 그림: 우리, 장면들: [{ 그림: 남 }] });
  assert.ok(!r.서식.includes('▶'), '쇼가 없는데 ▶ 를 그렸다 — 누르면 «없다»가 뜬다');
  const 없 = 편지({ 제목: '인사', 그림: 우리 });
  assert.ok(!없.서식.includes('▶'), '장면이 없는데 ▶ 를 그렸다');
});

/* ═══ 화면 쪽 ═══════════════════════════════════════════════════════════ */
test('★★ 화면이 편지 짓개보다 «먼저» 움직이는 화면 층을 싣는다 — 캐시 번호도', () => {
  const 쇼 = 화면.search(/<script src="js\/pu-news-show\.js\?v=\d+"/);
  const 편 = 화면.search(/<script src="js\/pu-news-tpl\.js\?v=\d+"/);
  assert.ok(쇼 > 0, 'pu-news-show.js 를 안 싣거나 캐시 번호가 없다');
  assert.ok(편 > 쇼, '편지 짓개가 먼저 실린다 — 그러면 ▶ 가 영영 안 나온다');
  assert.ok(/firebase-storage-compat\.js/.test(화면), '창고 SDK 가 없다 — 사진을 못 올린다');
});

test('★★ 전문을 담을 때 움직이는 화면도 «같이» 담는다 — 없으면 지운다', () => {
  const 몸 = 함수몸(화면, '전문담기');
  assert.ok(몸, '전문담기 가 없다');
  assert.ok(몸.includes('Show.쇼짓기'), '받는 분이 볼 것과 다른 짓개로 짓는다');
  assert.match(몸, /쇼:\s*쇼\s*\|\|\s*null/, '장면을 다 뺐을 때 옛 쇼를 안 지운다');
});

test('★★ 미리 보기도 «같은 짓개»로, 이름 붙은 한 창에 띄운다', () => {
  const 몸 = 함수몸(화면, '쇼미리보기');
  assert.ok(몸 && 몸.includes('Show.쇼짓기'), '미리 보기가 다른 것을 보여 준다');
  assert.ok(!/_blank/.test(몸), '누를 때마다 탭이 쌓인다');
});

/* ═══ ㉦ 올리기 ═════════════════════════════════════════════════════════ */
test('★★★ 올리기 전에 사진을 «다시 그린다» — 찍은 자리(GPS)가 빠진다', () => {
  const 몸 = 함수몸(화면, '창고에올리기');
  assert.ok(몸, '창고에올리기 가 없다');
  assert.ok(/createImageBitmap/.test(몸) && /toBlob/.test(몸),
    '사진을 그대로 올린다 — 폰 사진의 찍은 자리가 함께 나간다');
  assert.match(몸, /getRandomValues\(\s*알\s*\)/, '열쇠를 «찍어서 못 맞히게» 짓지 않는다');
  assert.match(몸, /new Uint8Array\(16\)/, '열쇠가 짧다 — 32자리(16바이트)라야 한다');
  assert.ok(몸.includes("'newsletter_img/'"), '올리는 자리가 newsletter_img/ 가 아니다');
  /* 지어진 열쇠 모양이 서버가 받는 모양과 같아야 한다 */
  assert.ok(NV.그림열쇠('f'.repeat(32) + '.jpg') && NV.그림열쇠('f'.repeat(32) + '.gif'),
    '앱이 짓는 열쇠를 서버가 안 받는다');
});

test('★★ 창고 규칙에 newsletter_img 칸이 있다 — 읽기는 막고, 쓰기는 사진만', () => {
  const 규칙 = 읽기('docs/firebase-storage-전체(붙여넣기용).txt');
  const m = /match \/newsletter_img\/\{file\}\s*\{([\s\S]*?)\n\s*\}/.exec(규칙);
  assert.ok(m, '창고 규칙에 newsletter_img 칸이 없다 — 사진 올리기가 막힌다');
  assert.match(m[1], /allow read:\s*if false;/, '창고 주소로 바로 읽힌다 — 서버 문을 거치지 않는다');
  assert.match(m[1], /allow write:\s*if isStaff\(\) && okImage\(\);/, '사진 아닌 것도 올라간다');
});
