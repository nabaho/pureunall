/* 특별 판례 꼭지 — 부정기로 큰 판례 하나를 따로 세운다 (대표 지시 2026-09-23)
   ═══════════════════════════════════════════════════════════════════════════
   「부정기적인 특별 판례나 추석 설 명절 인사등을 … 보내고 싶은데」

   ■ 왜 «꼭지»로 만들었나 — 인사 칸처럼 따로 짓지 않고
     인사는 «글 세 줄»이라 따로 짓는 편이 쌌다. 특별 판례는 사건번호·제목·요지·
     전문 보기까지 있는 «건»이다. 꼭지로 두면 담는 화면·요약·평문·틀고정 차림표가
     전부 딸려 온다 — 따로 지으면 그 넷을 손으로 다시 써야 한다.

   ■ 이 검사가 지키는 것
     ㉠ 안 담으면 «아예 안 나온다» — 차림표에도 안 선다
     ㉡ 담으면 나오고, 평소 판례 꼭지와 «색이 다르다»(같으면 왜 판례가 둘이냐가 된다)
     ㉢ 저절로 담기지 않는다 — 손으로만 담는다
     ㉣★ 차림표 칸 수와 «자리표» 수가 맞는다  ← 고쳐 둔 자리다, 아래를 읽을 것 */

/* ★★★ ㉣ 는 «이번에 찾은 고장»이다 (2026-09-23)
   ═══════════════════════════════════════════════════════════════════════════
   차림표는 꼭지 넷을 «늘» 그렸다. 그런데 빈 꼭지는 아예 안 그려지므로 자리표
   (id="g-…")는 «실제로 그려진 만큼»만 생긴다.
   틀고정 차림표(functions/news-view.js)는 둘을 «번호로» 짝지어 누른 자리로
   내려앉힌다 — 그러니 빈 꼭지가 하나라도 있으면 «한 칸씩 밀린다».
   실측: 고용·노동정책이 빈 회차에서 「고용·노동정책」을 누르면 판례로 내려갔다.
   ⚠ 특별 판례를 더하면 이 어긋남이 «늘 한 칸»이 되어 매주 틀린다. 그래서 같이 고쳤다. */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { 주석걷기, 함수몸 } = require('./helpers/strip-comments.js');

const C = require('../js/pu-news-core.js');
const T = require('../js/pu-news-tpl.js');
const 화면 = 주석걷기(fs.readFileSync(path.join(__dirname, '..', 'pu-news.html'), 'utf8'));

const 설 = { 회사이름: '푸른노무법인' };
const 기사 = { 갈래: '기사', 제목: '기사 제목', 우리말: '우리가 쓴 줄입니다.',
  언론사: '매일노동뉴스', 링크: 'https://www.labortoday.co.kr/news/articleView.html?idxno=1' };
const 판례 = (제목) => ({ 갈래: '판례', 딱지: '[판례]', 제목: 제목 || '보통 판례',
  링크: 'https://www.law.go.kr/LSW/precInfoP.do?target=prec&ID=622111' });

function 편지(안, 옵션) {
  return T.편지짓기({ 회차: C.회차('2026-09-28'), 안: 안, 우리글: '' }, 설,
    Object.assign({ 미리보기: true, 요약: false }, 옵션 || {}));
}
/* 차림표 칸 — 폭이 몇 %든 세어진다(칸 수가 바뀌면 폭도 바뀌므로 폭을 박지 않는다) */
const 차림표칸 = (h) => (h.match(/<td align="center" width="\d+(?:\.\d+)?%"/g) || []).length;
const 자리표 = (h) => (h.match(/id="g-([a-z]+)"/g) || [])
  .map((s) => /id="g-([a-z]+)"/.exec(s)[1]);

/* ═══ ㉠ 안 담으면 아예 안 나온다 ═══════════════════════════════════════ */
test('★★ 특별 판례를 안 담으면 편지 어디에도 안 나온다', () => {
  const h = 편지({ news: [기사], policy: [], case: [판례()], hr: [] }).서식;
  assert.ok(!h.includes('특별 판례'), '안 담았으면 이름조차 안 나와야 한다');
  assert.ok(!자리표(h).includes('special'), '자리표도 없어야 한다');
});

/* ═══ ㉡ 담으면 나오고, 색이 다르다 ═════════════════════════════════════
   ⚠ 빛깔 «값»을 박지 않는다 — 「평소 판례와 다른가」만 본다.
     값을 박으면 팔레트를 손볼 때 기능이 멀쩡한데 검사가 깨진다. */
test('★★ 담으면 나오고, 평소 판례 꼭지와 색이 다르다', () => {
  const h = 편지({ news: [기사], policy: [], case: [판례('보통 판례입니다')],
    hr: [], special: [판례('특별한 판례입니다')] }).서식;
  assert.ok(h.includes('특별한 판례입니다'), '특별 판례가 실려야 한다');
  assert.ok(h.includes('보통 판례입니다'), '평소 판례도 그대로 실려야 한다');
  assert.ok(자리표(h).includes('special'), '자리표가 있어야 차림표가 내려앉는다');

  /* 꼭지 «제목»의 빛깔을 뽑아 견준다.
     ⚠⚠ 이름으로 찾지 말 것 — 차림표에도 같은 이름이 서 있어서 indexOf 가
       «차림표 칸»을 먼저 집는다. 2026-09-23 에 이 검사가 그래서 헛돌았다:
       제목 색을 둘 다 같게 만들어도 통과했다(차림표 색과 견주고 있었다).
     ★ 자리표(id="g-…")에서 시작한다 — 제목 덩이에만 붙는 표시다. */
  const 빛 = (키) => {
    const i = h.indexOf('id="g-' + 키 + '"');
    assert.ok(i > 0, 키 + ' 꼭지 제목을 찾지 못했다');
    const m = /font-size:17px;font-weight:bold;color:(#[0-9a-f]{6})/i.exec(h.slice(i));
    assert.ok(m, 키 + ' 의 빛깔을 읽지 못했다');
    return m[1].toLowerCase();
  };
  assert.notStrictEqual(빛('special'), 빛('case'),
    '특별 판례는 평소 판례와 «다른 색»이라야 한다 — 같으면 왜 판례가 둘이냐가 된다');
});

/* ═══ ㉢ 저절로 담기지 않는다 ═══════════════════════════════════════════
   ⚠ 「특별」은 대표께서 고르시는 것이다. 기계가 골라 넣으면 특별하지 않다. */
test('★★ 특별 판례는 «저절로» 담기지 않는다 — 손으로만', () => {
  const 모음 = {};
  ['판례', '대법원 판결', '행정해석', '근로기준법 개정', '임금 체불'].forEach((t, i) => {
    모음['k' + i] = { 제목: t + ' 소식', 링크: 'https://x.test/' + i,
      언론사: '매일노동뉴스', 모은날: '2026-09-25' };
  });
  const 안 = C.자동으로담기(모음, { 자료: [], 판례: [판례()], 법령: [] }, C.회차('2026-09-28'));
  assert.deepStrictEqual(안.special || [], [], '자동으로는 한 건도 안 담겨야 한다');
  /* 그래도 «자리»는 있어야 한다 — 없으면 화면이 담을 곳을 못 찾는다 */
  assert.ok(Object.prototype.hasOwnProperty.call(안, 'special'),
    '자리는 있어야 한다(빈 배열) — 없으면 담을 곳이 없다');
});

/* ═══ ㉣ 차림표 칸 수 = 자리표 수 ═══════════════════════════════════════
   ★★ 틀고정 차림표는 둘을 «번호로» 짝짓는다. 하나라도 어긋나면 누른 자리와
     내려앉는 자리가 달라진다 — 고장인데 «조용히» 틀린다. */
test('★★★ 차림표 칸 수와 자리표 수가 «늘» 맞는다', () => {
  const 판 = [
    ['꼭지 하나만', { news: [기사], policy: [], case: [], hr: [] }],
    ['판례만 빔', { news: [기사], policy: [], case: [], hr: [], special: [판례()] }],
    ['특별까지 다 참', { news: [기사], policy: [], case: [판례()], hr: [], special: [판례('특')] }],
    ['특별만 있음', { news: [], policy: [], case: [], hr: [], special: [판례('특')] }]
  ];
  판.forEach(([이름, 안]) => {
    const r = 편지(안);
    assert.ok(r, 이름 + ' : 편지가 만들어져야 한다');
    const 칸 = 차림표칸(r.서식), 표 = 자리표(r.서식);
    assert.strictEqual(칸, 표.length,
      이름 + ' : 차림표 ' + 칸 + '칸인데 자리표는 ' + 표.length + '개다 — 누르면 밀린다');
    assert.ok(칸 > 0, 이름 + ' : 차림표가 있어야 한다');
    /* ⚠ 폭이 «합해서 한 줄»이라야 한다. 25% 로 박아 두면 꼭지가 다섯이 되는 순간
         125% 가 되어 마지막 칸이 아래로 떨어진다 — 메일에서는 표가 그렇게 무너진다. */
    const 폭 = (r.서식.match(/<td align="center" width="(\d+(?:\.\d+)?)%"/g) || [])
      .map((s) => Number(/width="(\d+(?:\.\d+)?)%"/.exec(s)[1]))
      .reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(폭 - 100) <= 1,
      이름 + ' : 차림표 폭이 합해서 ' + 폭 + '% 다 — 한 줄에 안 들어간다');
  });
});

/* ═══ 옛 회차 — 이미 보내 전문을 다시 못 담는 것 ═══════════════════════
   ★★ 틀고정 차림표가 짝을 «이름»으로 맺는지 «돌려» 본다.
     옛 전문은 차림표 넷 · 자리표 셋(빈 꼭지)이다. 차례로 맺으면 한 칸씩 밀린다. */
function 차림표돌려보기(칸이름들, 꼭지들) {
  const NV = require('../functions/news-view.js');
  const 쪽 = NV.쪽('t', '<div id="wrap"></div>');
  const 글 = (쪽.match(/<script>([\s\S]*?)<\/script>/g) || [])
    .map((s) => s.replace(/^<script>|<\/script>$/g, '')).find((s) => s.includes('function 짝('));
  assert.ok(글, '차림표 스크립트를 못 찾았다');
  const 간곳 = [];
  const 칸 = 칸이름들.map((t) => ({ textContent: t, className: '', 손: {},
    setAttribute() {}, addEventListener(k, f) { this.손[k] = f; } }));
  const 줄 = { offsetHeight: 40, querySelectorAll: () => 칸 };
  const 자리 = 꼭지들.map(([id, 제목], i) => ({ id, 제목, y: 300 + i * 500,
    closest() { return { textContent: this.제목 }; },
    getBoundingClientRect() { return { top: this.y }; } }));
  /* ⚠ 한 <script> 안에 창 띄우기·전문 펴기 스크립트가 함께 있다 — 그쪽이 부르는
       것(getElementById·addEventListener·location)만 빈 흉내로 채운다. */
  const 짐 = {
    document: {
      querySelector: () => 줄,
      querySelectorAll: () => 자리,
      getElementById: () => ({}),
      addEventListener() {}
    },
    location: { hash: '', pathname: '', search: '' },
    window: { scrollY: 0, scrollTo: (o) => 간곳.push(o.top), addEventListener() {} }
  };
  vm.createContext(짐);
  vm.runInContext(글, 짐);
  return 칸.map((c) => {
    if (!c.손.click) return c.textContent + '→(못누름)';
    간곳.length = 0; c.손.click();
    const y = 간곳[0] + 줄.offsetHeight + 14;
    const 맞 = 자리.find((a) => Math.abs(a.y - y) <= 1);
    return c.textContent + '→' + (맞 ? 맞.id : '?');
  });
}

test('★★★ 옛 회차(빈 꼭지)의 차림표도 «제 꼭지»로 내려앉는다 — 짝을 이름으로', () => {
  const r = 차림표돌려보기(
    ['주간노동뉴스', '고용·노동정책', '판례·재결례', '인사·노무관리'],
    [['g-news', 'BEST주간노동뉴스'], ['g-case', 'ATTENTION판례·재결례·행정해석'],
     ['g-hr', 'TREND인사·노무관리']]);
  assert.deepStrictEqual(r, ['주간노동뉴스→g-news', '고용·노동정책→(못누름)',
    '판례·재결례→g-case', '인사·노무관리→g-hr'],
    '차례로 짝지으면 「고용·노동정책」이 판례로 간다 — 그 고장이 되살아났다');
});

/* 차림표에 «없는 꼭지 이름»이 서 있으면 안 된다 — 거짓말하는 차림표 */
test('★★ 차림표는 편지에 «실제로 있는» 꼭지만 부른다', () => {
  const r = 편지({ news: [기사], policy: [], case: [], hr: [] });
  /* 차림표 띠 — data-stick 이 붙은 줄이 그것이다(틀고정하는 그 줄) */
  const 띠 = /<tr data-stick="1">([\s\S]*?)<\/tr><\/table>/.exec(r.서식);
  assert.ok(띠, '차림표 띠를 찾아야 한다');
  assert.ok(!띠[1].includes('판례'), '빈 판례 꼭지가 차림표에 서 있으면 안 된다');
  assert.ok(띠[1].includes('주간노동뉴스'), '실린 꼭지는 차림표에 있어야 한다');
});

/* ═══ 평문에도 실린다 ══════════════════════════════════════════════════ */
test('★ 평문에도 특별 판례가 실린다', () => {
  const r = 편지({ news: [기사], policy: [], case: [], hr: [],
    special: [판례('특별한 판례입니다')] });
  assert.ok(r.본문.includes('특별 판례'), '평문에 꼭지 이름이 있어야 한다');
  assert.ok(r.본문.includes('특별한 판례입니다'), '평문에 그 건이 있어야 한다');
});

/* ═══ 손으로 담을 때 «그 꼭지의 갈래»로 담긴다 ══════════════════════════
   ⚠⚠ 글자로 보지 않고 «실제로 눌러» 본다. 예전에는 늘 갈래:'기사' 로 담겨,
     판례 꼭지에 손으로 담으면 사건번호도 「전문 보기」도 없는 기사 한 줄이 됐다.
   ★ 이 검사가 없으면 특별 판례를 손으로 담는 «유일한 길»이 조용히 망가진다. */
function 손으로담아보기(칸, 답들) {
  const 몸 = 함수몸(화면, '손으로담기');
  assert.ok(몸, 'pu-news.html 에 손으로담기 가 없다');
  const 회차 = { 열쇠: 'x', 안: {} };
  let 남은 = 답들.slice();
  const 짐 = {
    Core: C,
    prompt: () => (남은.length ? 남은.shift() : ''),
    지금회차: () => 회차,
    회차저장: () => ({ then: () => {} }),
    render: () => {}
  };
  vm.createContext(짐);
  vm.runInContext(몸 + '\n손으로담기(' + JSON.stringify(칸) + ');', 짐);
  return (회차.안[칸] || [])[0] || null;
}

test('★★ 판례 꼭지에 손으로 담으면 «판례»로 담긴다 — 기사로 담기지 않는다', () => {
  const x = 손으로담아보기('special',
    ['포괄임금보다 기록이 앞선다', '대법원 2026. 8. 27. 선고 2025다301142',
     'https://www.law.go.kr/LSW/precInfoP.do?target=prec&ID=622111']);
  assert.ok(x, '담기지 않았다');
  assert.strictEqual(x.갈래, '판례', '판례 꼭지인데 기사로 담겼다');
  assert.ok(String(x.인용 || '').includes('2025다301142'), '사건번호가 안 담겼다');
  assert.ok(String(x.링크 || '').includes('law.go.kr'), '링크가 안 담겼다');
  /* 그리고 실제로 판례 «카드»로 그려져야 한다 — 담기는 것과 그려지는 것은 다른 일이다 */
  const h = 편지({ news: [기사], policy: [], case: [], hr: [], special: [x] }).서식;
  assert.ok(h.includes('2025다301142'), '편지에 사건번호가 안 나온다');
});

test('★ 기사 꼭지는 그대로 «기사»로 담긴다 — 판례 꼭지만 달라진다', () => {
  const x = 손으로담아보기('news', ['기사 제목', 'https://n.kr/1']);
  assert.ok(x, '담기지 않았다');
  assert.strictEqual(x.갈래, '기사', '기사 꼭지가 판례로 담기면 안 된다');
  assert.strictEqual(x.링크, 'https://n.kr/1', '둘째 물음이 링크라야 한다');
});

/* ═══ 새 꼭지에도 «담는 자리»가 있다 ════════════════════════════════════
   ⚠ 솔직히 적어 둔다 (2026-09-23 되돌림 검사에서 드러났다):
     「안」을 손으로 적은 목록(news/policy/case/hr)으로 만들던 자리가 둘 있었고
     그것을 꼭지들에서 짓게 고쳤다. 그런데 이 검사는 그 고침을 «못 잡는다» —
     자동으로담기 끝머리의 상한 자르기가 꼭지들을 돌며 자리를 «다시» 만들기 때문이다.
     그러니 옛 목록도 실제 고장은 아니었다. 고친 까닭은 «앞에서 읽는 자리»
     (예: 안.policy.length)가 새 꼭지에 생기면 그때 터지지 않게 하려는 것이다.
   ★ 이 검사가 지키는 것은 «결과»다 — 어떤 길로든 새 꼭지에 자리가 있는가. */
test('★ 새 꼭지에도 «담는 자리»가 있다', () => {
  const 안 = C.자동으로담기({}, { 자료: [], 판례: [], 법령: [] }, C.회차('2026-09-28'));
  C.꼭지들.forEach((g) => {
    assert.ok(Object.prototype.hasOwnProperty.call(안, g.키),
      g.이름 + ' 을 담을 자리가 없다 — 손으로 적은 목록이 남아 있다');
  });
});
