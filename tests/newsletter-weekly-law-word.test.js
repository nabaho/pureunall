'use strict';
/* 「이번 주 한마디」는 «주간 노동법률 사항»이다 · 창 머리에 꼭지 이름이 뜬다
   ═══════════════════════════════════════════════════════════════════════════
   대표 지시 2026-09-26:
     「이번주 한마디도 주간 노동법률사항을 니가 넣어라 그리고 팝업장에도 내용이 나와야 한다」

   ■ 이 검사가 지키는 것
     ㉠ 한마디 지시가 «법령·판례·확인할 것»을 차례로 요구한다
     ㉡ «담긴 것 밖»으로 못 나간다 — 없으면 그 대목을 빼라고 못 박는다
        ⚠ 법률 글은 틀리면 더 나쁘다. 시행일 하루가 어긋나면 사업장이 그대로 따라 한다.
     ㉢ 법률을 쓰려면 있어야 할 것(시행일·사건번호)을 «실제로 넘긴다»
        — 제목 한 줄만 넘기면 AI 는 날짜를 모르니 지어내거나 뭉갠다
     ㉣ 빈 칸은 안 넘긴다 — 빈 칸을 주면 AI 가 그 자리를 채우려 든다
     ㉤★ 창(팝업) 머리에 «꼭지 이름»이 뜬다 — 영문 딱지가 아니라
        ⚠ 실측 2026-09-26: 한마디를 누르면 「TREND」, 기사는 「BEST」가 떴다. */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { 주석걷기, 함수몸 } = require('./helpers/strip-comments.js');

const 뿌리 = path.join(__dirname, '..');
const 화면 = 주석걷기(fs.readFileSync(path.join(뿌리, 'pu-news.html'), 'utf8'));
const C = require('../js/pu-news-core.js');
const T = require('../js/pu-news-tpl.js');
const NV = require('../functions/news-view.js');

const 한마디 = () => {
  const 몸 = 함수몸(화면, '한마디초안짓기');
  assert.ok(몸, '한마디초안짓기 를 못 찾았다');
  return 몸;
};

/* ═══ ㉠ 법령 → 판례 → 확인할 것 ═══════════════════════════════════════ */
test('★★★ 한마디 지시가 «노동법률 사항»을 차례로 요구한다', () => {
  const 몸 = 한마디();
  assert.ok(/노동법률/.test(몸), '★★★ 「노동법률」이라는 말이 지시에 없다 — 예전 흐름 글로 돌아갔다');
  assert.ok(/법령|제도/.test(몸) && /언제부터|시행/.test(몸),
    '★★★ 「무엇이 언제부터」를 안 시킨다 — 법률 사항의 알맹이가 빠진다');
  assert.ok(/판례|행정해석/.test(몸), '★★★ 판례가 정한 기준을 안 시킨다');
  assert.ok(/확인/.test(몸), '★★★ 사업장에서 확인할 것을 안 시킨다 — 읽고 할 일이 없다');
});

/* ═══ ㉡ 담긴 것 밖으로 안 나간다 ═════════════════════════════════════ */
test('★★★ 없는 것은 «빼라»고 못 박는다 — 법률 글은 틀리면 더 나쁘다', () => {
  const 몸 = 한마디();
  assert.ok(/지어내/.test(몸), '★★★ 지어내지 말라는 말이 없다');
  assert.ok(/빼세요|빼라|통째로/.test(몸),
    '★★★ 「없으면 그 대목을 빼라」가 없다 — AI 가 빈 자리를 그럴듯한 날짜로 채운다');
  assert.ok(/적힌 그대로/.test(몸), '★★★ 시행일·사건번호를 «적힌 그대로»만 쓰라는 말이 없다');
  /* 앞날 이야기도 막는다 — 목록에 근거가 없다 */
  assert.ok(/예정|앞날|곧/.test(몸), '★★★ 근거 없는 앞날 이야기를 안 막는다');
});

test('★★★ 이미 쓰신 글은 여전히 «덮지 않는다» — 되돌릴 길이 없다', () => {
  /* ⚠ 「어딘가에 우리글 검사가 있다」로는 부족하다 — 되돌림 검사에서 헛돌았다.
       AI 를 부른 «뒤»에도 같은 모양의 검사가 하나 더 있어서, 앞의 문지기를
       통째로 없애도 통과했다. 문지기는 «부르기 전»에 서야 한다. */
  const 몸 = 한마디();
  const 문지기 = 몸.search(/if\s*\(\s*String\(\s*d\.우리글/);
  const 부름 = 몸.indexOf('PuAiCall.ask');
  assert.ok(문지기 >= 0, '★★★ 이미 쓴 글이 있는지 보는 문지기가 없다');
  assert.ok(부름 > 문지기, '★★★ 문지기가 AI 를 부른 뒤에 있다 — 사람 글을 덮게 된다');
  assert.ok(/return false/.test(몸.slice(문지기, 문지기 + 260)),
    '★★★ 이미 쓰셨는데 돌아서지 않는다');
});

/* ═══ ㉢㉣ 법률을 쓸 거리를 «실제로» 넘긴다 ════════════════════════════
   ⚠ 글자로 「시행일이 적혀 있다」를 보지 않는다 — 돌려서 «정말 담기는지» 본다. */
function 거리뽑기(안) {
  const 몸 = 한마디();
  const i = 몸.indexOf('const 거리 = [];');
  const j = 몸.indexOf('if(거리.length');
  assert.ok(i > 0 && j > i, '거리를 모으는 대목을 못 찾았다');
  const 짐 = { Core: C, d: { 안: 안 }, 거리: null };
  vm.createContext(짐);
  vm.runInContext('const d = this.d;' + 몸.slice(i, j) + 'this.거리 = 거리;', 짐);
  return 짐.거리;
}

test('★★★ 시행일·사건번호를 «정말» 넘긴다 — 제목 한 줄만 주면 날짜를 지어낸다', () => {
  const 거리 = 거리뽑기({
    policy: [{ 갈래: '법령', 제목: '근로기준법 시행령 개정', 시행일: '2026-10-01', 발행처: '고용노동부' }],
    case: [{ 갈래: '판례', 딱지: '[판례]', 제목: '포괄임금 약정보다 기록이 앞선다',
      인용: '대법원 2026. 8. 27. 선고 2025다301142', 요지: '기록이 있으면 약정이 그 부분을 덮지 못한다' }],
    news: [{ 갈래: '기사', 제목: '기사 제목', 우리말: '우리가 쓴 줄' }]
  });
  const 법 = 거리.find((x) => x.시행일);
  assert.ok(법, '★★★ 시행일을 안 넘긴다 — AI 가 「언제부터」를 쓸 수 없다');
  assert.strictEqual(법.시행일, '2026-10-01');
  const 판 = 거리.find((x) => x.사건번호);
  assert.ok(판, '★★★ 사건번호를 안 넘긴다 — 어느 사건이 정한 것인지 못 쓴다');
  assert.ok(판.사건번호.includes('2025다301142'));
  assert.strictEqual(판.딱지, '[판례]', '판례인지 행정해석인지 구별을 안 넘긴다');
  assert.ok(String(판.요지 || '').length > 0, '요지를 안 넘긴다');
});

test('★★ 빈 칸은 «아예 안 넘긴다» — 빈 칸을 주면 AI 가 채우려 든다', () => {
  const 거리 = 거리뽑기({ news: [{ 갈래: '기사', 제목: '제목만 있는 줄', 우리말: '우리가 쓴 줄' }] });
  assert.strictEqual(거리.length, 1);
  const x = 거리[0];
  ['시행일', '사건번호', '딱지', '발행처', '요지'].forEach((k) => {
    assert.ok(!(k in x), '빈 «' + k + '» 칸을 넘긴다: ' + JSON.stringify(x));
  });
  assert.ok(x.글 && x.꼭지, '글·꼭지는 넘겨야 한다');
});

test('★ 한마디 꼭지 자신은 거리에 안 넣는다 — 제 글을 보고 제 글을 쓰게 된다', () => {
  const 우리글꼭지 = C.꼭지들.find((g) => g.갈래 === '우리글');
  const 거리 = 거리뽑기({ [우리글꼭지.키]: [{ 갈래: '자료', 제목: '연구자료', 우리말: '우리 정리' }],
    news: [{ 갈래: '기사', 제목: 'ㄱ', 우리말: 'ㄴ' }] });
  assert.ok(!거리.some((x) => x.꼭지 === 우리글꼭지.이름), '우리글 꼭지를 거리에 넣었다');
});

/* ═══ ㉤ 창 머리에 꼭지 이름 ═══════════════════════════════════════════
   ★★ 글자로 「꼭지이름이 있다」를 보지 않는다 — 진짜 편지를 지어 «눌러» 본다. */
function 눌러보기(안, 우리글) {
  const 편 = T.편지짓기({ 회차: C.회차('2026-09-28'), 안: 안, 우리글: 우리글 || '' },
    { 회사이름: '푸른노무법인' }, { 미리보기: true, 요약: false });
  assert.ok(편, '편지가 지어져야 한다');
  const 쪽 = NV.쪽('t', 편.서식);
  const 통 = (쪽.match(/<script>([\s\S]*?)<\/script>/g) || [])
    .map((s) => s.replace(/^<script>|<\/script>$/g, '')).find((s) => s.includes('function 꼭지이름('));
  assert.ok(통, '창 스크립트를 못 찾았다');
  /* ⚠ 스크립트가 상자(IIFE) 안에 있어 밖에서는 못 부른다 — 그 함수만 떼어 낸다.
       떼어 내도 «배포되는 그 글자» 그대로다(베껴 적지 않는다). */
  const 글 = 함수몸(통, '꼭지이름');
  assert.ok(글, '꼭지이름 을 못 떼어 냈다');

  /* 편지 서식에서 «자리표 → 그 뒤 형제들»을 아주 작게 흉내 낸다.
     ⚠ 진짜 구조 그대로다: a, div(딱지), div(이름), div(빈칸), table(줄띠) */
  const 꼭지들 = [];
  const re = /id="g-([a-z]+)"><\/a>([\s\S]*?)<table/g;
  let m;
  while ((m = re.exec(편.서식))) {
    /* ⚠ 브라우저는 &nbsp; 를 «공백 글자»( )로 읽는다. 글자 그대로 두면
         빈 칸이 「&nbsp;」라는 «글이 있는 칸»으로 보여 흉내가 거짓말을 한다. */
    const 칸 = (m[2].match(/<div[^>]*>([\s\S]*?)<\/div>/g) || [])
      .map((s) => s.replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&'));
    꼭지들.push({ 키: m[1], 칸: 칸 });
  }
  assert.ok(꼭지들.length, '자리표를 못 찾았다');

  return 꼭지들.map((g) => {
    /* ⚠ 줄띠(table) «뒤»에도 형제가 이어진다 — 진짜 편지가 그렇다(그 아래가 본문이다).
         뒤를 비워 두면 「줄띠에서 안 멈춰도」 우연히 맞아, 검사가 헛돈다. */
    const 형제 = g.칸.map((t) => ({ tagName: 'DIV', textContent: t, nextElementSibling: null }));
    const 줄띠 = { tagName: 'TABLE', textContent: '본문이 여기서부터입니다',
      nextElementSibling: { tagName: 'DIV', textContent: '첫 기사 줄', nextElementSibling: null } };
    형제.forEach((e, i) => { e.nextElementSibling = 형제[i + 1] || 줄띠; });
    const 앵커 = { nextElementSibling: 형제[0],
      compareDocumentPosition: () => 4 /* DOCUMENT_POSITION_FOLLOWING */ };
    const 짐 = {
      Node: { DOCUMENT_POSITION_FOLLOWING: 4 },
      /* ⚠ 한 <script> 안에 차림표·전문펴기 스크립트가 함께 있다 — 그쪽이 부르는 것만
           빈 흉내로 채운다(querySelector 가 null 이면 차림표는 곧바로 돌아선다). */
      document: {
        getElementById: () => ({}),
        querySelector: () => null,
        querySelectorAll: (q) => (String(q).indexOf('g-') >= 0 ? [앵커] : []),
        addEventListener() {}
      },
      location: { hash: '', pathname: '', search: '' },
      window: { scrollY: 0, scrollTo() {}, addEventListener() {} },
      결과: ''
    };
    vm.createContext(짐);
    vm.runInContext(글 + '\nthis.결과 = 꼭지이름({});', 짐);
    return { 키: g.키, 제목: 짐.결과 };
  });
}

test('★★★ 창 머리가 «꼭지 이름»이다 — 영문 딱지(TREND·BEST)가 아니다', () => {
  const 본 = 눌러보기({
    news: [{ 갈래: '기사', 제목: 'ㄱ', 우리말: '우리가 쓴 줄' }],
    case: [{ 갈래: '판례', 딱지: '[판례]', 제목: '판례 하나',
      링크: 'https://www.law.go.kr/LSW/precInfoP.do?target=prec&ID=622111' }]
  }, '이번 주 한마디입니다.');
  assert.ok(본.length, '꼭지를 하나도 못 읽었다');
  본.forEach((r) => {
    const g = C.꼭지찾기(r.키);
    assert.ok(g, '모르는 꼭지 키: ' + r.키);
    assert.strictEqual(r.제목, g.이름,
      '★★★ «' + r.키 + '» 창 머리가 「' + r.제목 + '」이다 — 「' + g.이름 + '」이라야 한다');
    assert.notStrictEqual(r.제목.toUpperCase(), String(g.딱지 || '').toUpperCase(),
      '★★★ 영문 딱지가 창 머리에 떴다');
  });
});

test('★★ 한마디(우리글) 창도 «인사·노무관리»로 뜬다 — 대표가 누르신 그 자리', () => {
  const 우리글꼭지 = C.꼭지들.find((g) => g.갈래 === '우리글');
  const 본 = 눌러보기({ news: [{ 갈래: '기사', 제목: 'ㄱ', 우리말: 'ㄴ' }] },
    '개정 노조법 시행 여섯 달을 짚습니다.');
  const 한 = 본.find((r) => r.키 === 우리글꼭지.키);
  assert.ok(한, '한마디 꼭지의 자리표가 없다');
  assert.strictEqual(한.제목, 우리글꼭지.이름,
    '한마디 창 머리가 「' + 한.제목 + '」이다 — 「' + 우리글꼭지.이름 + '」이라야 한다');
});

test('★★ 한마디는 «눌러서 볼 수 있는 칸»이다 — 표시가 붙어 있다', () => {
  const 편 = T.편지짓기({ 회차: C.회차('2026-09-28'), 안: { news: [{ 갈래: '기사', 제목: 'ㄱ', 우리말: 'ㄴ' }] },
    우리글: '한마디입니다.' }, { 회사이름: '푸른노무법인' }, { 미리보기: true, 요약: false });
  assert.match(편.서식, /id="n-hr-w"[^>]*data-pop="1"/,
    '★★ 한마디에 창 표시가 없다 — 눌러도 아무 일이 없다');
});
