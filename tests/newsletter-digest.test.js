/* 편지는 «요약»만 보내고, 자세한 것은 웹 쪽에서 본다
   ═══════════════════════════════════════════════════════════════════════════
   대표 지시 2026-09-12: 「주간뉴스가 한페이지에 너무 길게 나온다 전체적으로 한화면에
   모든내용의 요약만 나오게 만들고 클릭하면 … 확인할 수 있게 해달라.
   고용노동정책 판례등도 간략하게 핵심만 보게하고 클릭하면 나오게 해달라.
   그리고 팝업화면에 좌우 에 잘리는 내용 없이 다 보이게 해라」
   대표 결정: 「받는 분의 편지 — 요약만 보내고 「자세히 보기」는 웹 페이지로」

   ★ 이 검사가 지키는 «규칙»
     ① 요약판에는 «줄 요약»만 든다 — 자료 카드·판례 상자·기사 문단이 새면 길이가 돌아온다
     ② 「자세히 보기」가 갈 곳이 없으면 요약판을 «만들지 않는다» — 내용이 통째로 빠진다
     ③ 웹 쪽은 편지를 «다시 짓지 않는다» — 보낼 때 담아 둔 전문을 꺼내 줄 뿐이다
     ④ 웹 쪽은 «전문 한 칸만» 읽는다 — 회차 안에는 받는 분들의 주소가 있다
     ⑤ 지난 회차는 «그때 나간 그대로» — 회차에 적어 둔 꼴이 이긴다 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { stripComments } = require('./strip-comments');
const Tpl = require('../js/pu-news-tpl.js');
const NV = require('../functions/news-view.js');

const ROOT = path.join(__dirname, '..');
const 읽기 = (f) => stripComments(fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n/g, '\n'));
const news = 읽기('pu-news.html');
const idx = 읽기('functions/index.js');
const 밑주소 = 'https://asia-northeast3-pureun-erp.cloudfunctions.net';

function 설정(추가) {
  return Object.assign({ 회사이름: '푸른노무법인', 범위: '자문중', 추적밑주소: 밑주소 }, 추가 || {});
}
function 회차(추가) {
  return Object.assign({
    회차: { 열쇠: '2026-09-w1', 이름: '2026년 09월 1주차' },
    상태: '초안',
    안: {
      news: [{ 갈래: '기사', 제목: '옛 제목', 언론사: '매일노동뉴스',
               링크: 'https://example.com/a',
               우리말: '쟁의 중에 사람을 넣는 방식이 바뀌고 있습니다. 둘째 문장은 요약에 안 들어갑니다.' }],
      policy: [{ 갈래: '자료', 제목: '단기 육아휴직 제도 안내', 기관: '고용노동부',
                 링크: 'https://example.com/b' }],
      case: [{ 갈래: '판례', 제목: '취업규칙 불이익변경', 인용: '대법원 2025다215010',
               링크: 'https://example.com/c' }]
    },
    우리글: '9월 18일, 배우자 휴가 제도가 또 한 번 바뀝니다. 둘째 문장.'
  }, 추가 || {});
}
const 짓기 = (d, s, o) => Tpl.편지짓기(d, s || 설정(), o);

/* ══════ ① 요약판에는 «줄 요약»만 든다 ══════ */

/* 전문에만 있는 자국 둘 — 이것이 요약판에 남으면 길이가 그대로 돌아온다.
   ⚠ 「내려받기」로 보지 말 것 — 자료 카드의 그 단추는 «파일이 붙은 칸»에만 그려져,
     파일 없는 본보기로는 전문에도 안 나온다(그러면 검사가 헛돈다). */
const 전문자국 = {
  기사본문: '위 정리는 푸른노무법인이 썼습니다',
  /* ⚠ 「전문 보기 ↗」로 보지 말 것 — 요약판 맨 위 띠에도 그 글귀가 있어 늘 걸린다 */
  판례상자: '[판례]'
};

test('★ 요약판에 자료 카드·판례 상자·기사 문단이 «안» 들어간다', () => {
  const 요 = 짓기(회차(), 설정(), { 요약: true, 지역: '전국' });
  const 전 = 짓기(회차(), 설정(), { 요약: false, 미리보기: true, 지역: '전국' });
  Object.keys(전문자국).forEach((이름) => {
    assert.ok(전.서식.includes(전문자국[이름]),
      '전문에 ' + 이름 + ' 이 있어야 한다 — 본보기가 어긋났다');
    assert.ok(!요.서식.includes(전문자국[이름]),
      '요약판에 ' + 이름 + ' 이 남았다 — 남으면 길이가 그대로 돌아온다');
  });
});

/* 실제 회차만 한 분량 — 기사 다섯·자료 넷·판례 셋에 우리 말이 300자씩.
   ⚠ 작은 본보기로 길이를 재면 안 된다. 요약판은 맨 위 띠와 꼭지마다 「자세히 보기」를
     더하므로, 내용이 한두 줄뿐이면 «요약이 더 길다». 그것은 요약이 나쁜 것이 아니라
     본보기가 현실과 다른 것이다. */
function 큰회차() {
  const 긴글 = (n) => '이번 주 ' + n + '번째 소식입니다. ' + '자세한 사정을 우리 말로 풀어 적습니다. '.repeat(6);
  const 기사 = [1, 2, 3, 4, 5].map((n) => ({
    갈래: '기사', 제목: '기사 ' + n, 언론사: '매일노동뉴스',
    링크: 'https://example.com/n' + n, 우리말: 긴글(n)
  }));
  const 자료 = [1, 2, 3, 4].map((n) => ({
    갈래: '자료', 제목: '고용노동부 자료 ' + n, 기관: '고용노동부',
    링크: 'https://example.com/p' + n, 파일이름: '자료' + n + '.pdf', 파일크기: 500000
  }));
  const 판례 = [1, 2, 3].map((n) => ({
    갈래: '판례', 제목: '판시사항 '.repeat(20) + n,
    인용: '대법원 2025다' + n, 링크: 'https://example.com/c' + n
  }));
  return 회차({ 안: { news: 기사, policy: 자료, case: 판례 } });
}

/* 대표께서 보시는 것은 «태그»가 아니라 «글자»다 — 보이는 글자로 잰다.
   ⚠ 서식 길이로 재면 안 된다. 요약판은 줄마다 표를 쓰느라 뼈대가 늘어, 글이 반으로
     줄어도 서식은 얼마 안 준다. 그러면 검사가 「안 줄었다」고 우긴다. */
function 보이는글자(html) {
  return String(html || '').replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/g, ' ')
    .replace(/\s+/g, ' ').trim().length;
}

test('★★ 실제 분량에서 요약판의 «보이는 글자»가 훨씬 적다', () => {
  const 요 = 짓기(큰회차(), 설정(), { 요약: true, 지역: '전국' });
  const 전 = 짓기(큰회차(), 설정(), { 요약: false, 미리보기: true, 지역: '전국' });
  const ㄱ = 보이는글자(요.서식), ㄴ = 보이는글자(전.서식);
  assert.ok(1 - ㄱ / ㄴ > 0.35,
    '요약판이 전문의 ' + Math.round((ㄱ / ㄴ) * 100) + '% 나 된다 — 요약이 요약이 아니다'
    + ' (요약 ' + ㄱ + '자 · 전문 ' + ㄴ + '자)');
});

test('★ 꼭지마다 「자세히 보기」가 «한 줄»이다 — 줄마다 달면 눈이 쉴 곳이 없다', () => {
  const 요 = 짓기(회차(), 설정(), { 요약: true, 지역: '전국' });
  const 몇 = 요.서식.split('자세히 보기 ↗').length - 1;
  assert.equal(몇, 4, '꼭지 넷에 하나씩이어야 한다 (찾은 것 ' + 몇 + ')');
});

test('요약 한 줄은 «우리말»에서 온다 — 옛 제목이 아니라', () => {
  const 요 = 짓기(회차(), 설정(), { 요약: true, 지역: '전국' });
  assert.ok(요.서식.includes('쟁의 중에 사람을 넣는 방식이 바뀌고 있습니다.'),
    '우리말 첫 문장이 요약에 없다');
  assert.ok(!요.서식.includes('옛 제목'),
    '우리말이 있는데 제목이 실렸다 — 우리가 쓴 글이 우선이다');
  assert.ok(!요.서식.includes('둘째 문장은 요약에 안 들어갑니다'),
    '첫 문장만 실어야 한다');
});

test('우리말이 없으면 제목에서 온다 — 자료·판례가 그렇다', () => {
  const 요 = 짓기(회차(), 설정(), { 요약: true, 지역: '전국' });
  assert.ok(요.서식.includes('단기 육아휴직 제도 안내'), '자료 제목이 없다');
  assert.ok(요.서식.includes('취업규칙 불이익변경'), '판례 제목이 없다');
});

test('★ 길면 자르되 「…」을 붙인다 — 잘렸다는 것을 숨기지 않는다', () => {
  const 긴 = '가'.repeat(200);
  const d = 회차({ 안: { news: [{ 갈래: '기사', 우리말: 긴, 링크: 'https://example.com/a' }] },
                   우리글: '' });
  const 요 = 짓기(d, 설정(), { 요약: true, 지역: '전국' });
  assert.ok(요.서식.includes('…'), '자른 자리에 「…」이 없다');
  assert.ok(!요.서식.includes('가'.repeat(120)), '안 자르고 다 실었다');
});

test('「우리 사업장은」 갈피표로 시작해도 그 표는 요약에 안 남는다', () => {
  const d = 회차({ 안: { news: [{ 갈래: '기사', 링크: 'https://example.com/a',
                                  우리말: '▸ 우리 사업장은 — 확인하십시오.' }] }, 우리글: '' });
  const 요 = 짓기(d, 설정(), { 요약: true, 지역: '전국' });
  assert.ok(!/·\s*▸/.test(요.서식), '갈피표(▸)가 요약 줄머리에 남았다');
});

/* ══════ ② 갈 곳이 없으면 요약판을 만들지 않는다 ══════ */

test('★★ 「자세히 보기」가 갈 곳이 없으면 «전문»으로 물러선다', () => {
  /* 추적밑주소가 없으면 웹 쪽 주소를 만들 수 없다. 그때 요약만 보내면
     받는 분에게는 «내용이 통째로 빠진 편지»가 간다. */
  const 요 = 짓기(회차(), 설정({ 추적밑주소: '' }), { 요약: true, 지역: '전국' });
  assert.ok(요.서식.includes(전문자국.기사본문),
    '갈 곳이 없는데 요약만 보냈다 — 내용이 통째로 빠진 편지가 나간다');
});

/* ══════ ③ 웹 쪽 주소 ══════ */

test('★ 「자세히 보기」는 그 회차의 웹 쪽으로 간다 — 꼭지마다 제자리로', () => {
  /* 미리보기가 아니면 추적으로 감싸이므로, 감싸기 전 목록(링크들)으로 본다 */
  const 요 = 짓기(회차(), 설정(), { 요약: true, 지역: '전국' });
  const 것 = 요.링크들.filter((u) => u.indexOf('/newsView?i=') >= 0);
  assert.ok(것.length >= 5, '웹 쪽 링크가 모자란다 (' + 것.length + ')');
  assert.ok(것.some((u) => u.endsWith('newsView?i=2026-09-w1')), '맨 위 「전문 보기」가 없다');
  ['news', 'policy', 'case', 'hr'].forEach((k) => {
    assert.ok(것.some((u) => u.endsWith('#g-' + k)), k + ' 꼭지로 가는 자리표가 없다');
  });
});

test('★ 꼭지 제목에 «자리표»가 있다 — 없으면 눌러도 맨 위로만 간다', () => {
  const 전 = 짓기(회차(), 설정(), { 요약: false, 미리보기: true, 지역: '전국' });
  ['news', 'policy', 'case', 'hr'].forEach((k) => {
    assert.ok(전.서식.includes('id="g-' + k + '"'), k + ' 자리표가 전문에 없다');
  });
});

/* ══════ ④ 지난 회차는 «그때 나간 그대로» ══════ */

test('★★ 회차에 적어 둔 꼴이 «옵션 없이도» 이긴다', () => {
  const 요 = 짓기(회차({ 꼴: '요약' }), 설정(), { 미리보기: true, 지역: '전국' });
  assert.ok(!요.서식.includes(전문자국.기사본문), '요약으로 나간 회차가 전문으로 다시 그려졌다');
});

test('꼴이 없는 옛 회차는 전문으로 그려진다 — 그때는 전문만 있었다', () => {
  const 전 = 짓기(회차(), 설정(), { 미리보기: true, 지역: '전국' });
  assert.ok(전.서식.includes(전문자국.기사본문), '옛 회차가 요약으로 그려졌다');
});

/* ══════ ⑤ 보내기 «전»에 전문을 담는다 ══════ */

test('★★ 전문을 «걸기 전»에 담는다 — 먼저 열어 보신 분이 빈 쪽을 보면 안 된다', () => {
  const i = news.indexOf('async function 진짜보내기');
  assert.ok(i >= 0, '진짜보내기 를 못 찾았다');
  const 본 = news.slice(i, i + 7000);
  const 담 = 본.indexOf('전문담기(');
  const 걸 = 본.indexOf('await 걸기(');
  assert.ok(담 >= 0, '보내기가 전문을 안 담는다');
  assert.ok(걸 >= 0, '걸기를 못 찾았다');
  assert.ok(담 < 걸, '전문을 «건 뒤»에 담고 있다 — 먼저 열어 보신 분에게 빈 쪽이 뜬다');
});

test('★ 전문을 못 담으면 «걸지 않는다» — 내용 빠진 편지를 내보내지 않는다', () => {
  const i = news.indexOf('async function 진짜보내기');
  const 본 = news.slice(i, i + 7000);
  assert.match(본, /if\(!\(await 전문담기\([^)]*\)\)\) throw/,
    '전문 담기가 실패해도 그대로 보낸다');
});

test('시험 발송도 전문을 담는다 — 시험은 진짜와 같아야 시험이다', () => {
  const i = news.indexOf('async function 시험발송');
  assert.ok(i >= 0, '시험발송 을 못 찾았다');
  const 본 = news.slice(i, i + 4000);
  assert.ok(본.includes('전문담기('), '시험 발송이 전문을 안 담는다');
});

test('★ 전문은 «미리보기 꼴»로 짓는다 — 웹 쪽에는 추적열쇠가 없다', () => {
  const i = news.indexOf('async function 전문담기');
  assert.ok(i >= 0, '전문담기 를 못 찾았다');
  const fn = news.slice(i, news.indexOf('\n}', i));
  assert.match(fn, /미리보기:\s*true/, '전문에 추적을 걸고 있다 — 웹 쪽에서 링크가 다 튕긴다');
  assert.match(fn, /요약:\s*false/, '전문 자리에 요약을 담고 있다');
  assert.match(fn, /꼴:\s*'요약'/, '회차에 꼴을 안 적는다 — 지난 회차가 달리 그려진다');
});

test('★ 나가는 편지는 요약이다 — 미리보기도 같은 모습이어야 시험이 된다', () => {
  const i = news.indexOf('function 지금편지');
  const fn = news.slice(i, news.indexOf('\n}', i));
  assert.match(fn, /요약:\s*true/, '나가는 편지가 요약이 아니다');
});

/* ══════ ⑥ 웹 쪽(newsView) ══════ */

test('★★ 초안은 내주지 않는다 — 회차 열쇠는 규칙이라 누구나 지어 볼 수 있다', () => {
  assert.equal(NV.볼수있나('초안', '<b>전문</b>').ok, false);
  assert.equal(NV.볼수있나('초안', '<b>전문</b>').까닭, '초안');
  assert.equal(NV.볼수있나('시험', '<b>전문</b>').ok, true);
  assert.equal(NV.볼수있나('발송', '<b>전문</b>').ok, true);
});

test('전문이 없으면 «없다»고 말한다 — 빈 쪽을 내주지 않는다', () => {
  assert.equal(NV.볼수있나('발송', '').ok, false);
  assert.equal(NV.볼수있나('발송', '').까닭, '전문없음');
  assert.equal(NV.볼수있나('', 'x').까닭, '없음');
});

test('★★ 웹 쪽은 «전문 한 칸만» 읽는다 — 회차 안에는 받는 분들의 주소가 있다', () => {
  const i = idx.indexOf('exports.newsView');
  assert.ok(i >= 0, 'newsView 가 없다');
  const 몸 = idx.slice(i, idx.indexOf('exports.', i + 10));
  assert.ok(몸.includes('"상태"') && 몸.includes('"전문"'),
    '상태·전문 두 칸을 따로 안 읽는다');
  assert.ok(!/ref\(밑\)\s*\./.test(몸) && !/issues\/"\s*\+\s*q\.회차\)/.test(몸),
    '회차를 통째로 읽는다 — 받는이(주소 대장)가 그대로 새 나간다');
  assert.ok(!몸.includes('받는이'), 'newsView 가 받는이를 만진다');
});

test('회차 열쇠를 «추적 쪽과 같은 잣대»로 씻는다 — 다르면 자리가 어긋난다', () => {
  const NT = require('../functions/news-track.js');
  ['a.b#c', '../x', 'a'.repeat(60)].forEach((v) => {
    assert.equal(NV.회차열쇠(v), NT.회차열쇠 ? NT.회차열쇠(v) : NV.회차열쇠(v));
  });
  assert.ok(!NV.회차열쇠('a.b#c$d/e[f]g').match(/[.#$/[\]]/), '못 쓰는 글자가 남았다');
});

test('★ 폰에서 좌우가 안 잘린다 — viewport 를 편지 폭으로 못 박는다', () => {
  /* ⚠ width=device-width 로 두면 폰에서 700px 가 그대로 깔려 오른쪽이 잘린다
       (실측 2026-09-12: 375px 폰에서 325px 가 화면 밖으로 나갔다). */
  const 쪽 = NV.쪽('제목', '<b>속</b>');
  assert.match(쪽, /<meta name="viewport" content="width=700">/,
    '폰에서 편지가 잘린다 — viewport 를 700 으로 못 박아야 브라우저가 줄여 준다');
  assert.ok(!쪽.includes('device-width'), 'device-width 가 남아 있다');
  assert.ok(쪽.includes('<b>속</b>'), '전문이 안 들어갔다');
});

test('없는 회차에도 «우리 얼굴»을 보여 준다 — 깨진 쪽을 내주지 않는다', () => {
  const 쪽 = NV.없는쪽('초안');
  assert.ok(쪽.includes('푸른노무법인'));
  assert.ok(쪽.includes(NV.까닭말['초안']));
});

/* ══════ ⑦ 크게 보기 창이 안 자른다 ══════ */

test('★★ 「크게 보기」 창이 편지를 «자르지 않는다» (대표 지시 2026-09-12)', () => {
  /* 예전에는 창이 680px 인데 편지가 700px 이라 오른쪽 76px 이 잘려 나갔다.
     ⚠ 값이 아니라 «규칙»을 본다 — 창이 편지보다 좁으면 줄여서 다 보여야 한다. */
  const i = news.indexOf('function 편지창채우기');
  assert.ok(i >= 0, '편지창채우기 가 없다 — 세 곳이 다시 따로 그리고 있다');
  const fn = news.slice(i, news.indexOf('\n}', i));
  assert.match(fn, /Math\.min\(1,\s*쓸폭\s*\/\s*편지폭\)/, '좁을 때 줄이지 않는다');
  assert.match(fn, /paddingLeft/, '안쪽 여백을 안 뺀다 — 그만큼 가로로 넘친다');
  assert.match(fn, /scale\(/, '줄이는 길이 없다');

  /* 세 곳이 «한 곳»을 쓴다 — 따로 두면 한 군데만 고쳐져 어떤 창은 잘린 채 남는다 */
  const 몇 = news.split('편지창채우기(').length - 1;
  assert.ok(몇 >= 3, '편지창채우기 를 쓰는 곳이 모자란다 (' + 몇 + ')');
  assert.ok(!/id="bigF"/.test(news), '옛 방식(bigF 를 직접 만드는 곳)이 남아 있다');
});
