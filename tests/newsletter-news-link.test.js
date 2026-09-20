/* 기사 링크는 «그 기사»로 간다 (대표 지시 2026-09-20)
   ═══════════════════════════════════════════════════════════════════════════
   「매일노동뉴스에 클릭하니 뉴스정면이 나오고 그 뉴스가 안나온다.
     노동뉴스는 팝업이 메인화면이 아닌 당해 뉴스를 팝업하게 해라.」

   ■ 무슨 일이 있었나
     연습 표본의 기사 셋이 모두 신문사 «대문»(https://www.labortoday.co.kr/)을
     링크로 갖고 있었다. 대표께서 「원문 ↗」을 눌러 보시고 매일노동뉴스 첫 화면이
     떠서 그 기사를 손으로 다시 찾아야 하셨다.
     ★ 판례에는 이미 같은 잣대를 두었는데(대문이면 「전문 보기」를 안 단다),
       기사에는 없었다. 같은 실수가 두 꼭지에서 따로 났다.

   ■ 이 검사가 지키는 것
     ㉠ 대문 주소에는 「원문 ↗」을 안 단다 — 서식·평문 둘 다
     ㉡ 링크를 떼어도 «출처»는 남는다 — 어느 매체를 봤는지는 밝힌다
     ㉢ 그려 놓지도 않을 주소가 «추적 목록»에 번호를 차지하지 않는다
     ㉣ 연습 표본이 «진짜 모양»이다 — 대문 주소를 연습시키지 않는다
     ㉤ 창(팝업)이 «그 기사의 것»으로 보인다 — 매체와 원문 단추를 달 쪽지가 있다 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const 뿌리 = path.join(__dirname, '..');
const C = require('../js/pu-news-core.js');
const T = require('../js/pu-news-tpl.js');
const NV = require('../functions/news-view.js');
const 보는쪽 = fs.readFileSync(path.join(뿌리, 'functions/news-view.js'), 'utf8');

const 설 = { 회사이름: '푸른노무법인', 보내는주소: '370-6@hanmail.net' };
const 기사 = (덧) => Object.assign({ 갈래: '기사', 제목: '어느 기사입니다',
  언론사: '매일노동뉴스' }, 덧 || {});
const 한건 = 'https://www.labortoday.co.kr/news/articleView.html?idxno=236865';
const 대문 = 'https://www.labortoday.co.kr/';

function 편지(줄들, 옵) {
  return T.편지짓기({ 회차: C.회차('2026-09-14'), 안: { news: 줄들 }, 우리글: '' },
    설, Object.assign({ 미리보기: true }, 옵 || {}));
}

/* ═══ ㉠㉡ 대문에는 안 달고, 출처는 남긴다 ══════════════════════════════ */

test('★★★ 신문사 «대문» 주소에는 「원문 ↗」을 안 단다', () => {
  const h = 편지([기사({ 링크: 대문 })]).서식;
  assert.ok(!/원문\s*↗/.test(h),
    '★★★ 대문으로 가는 「원문 ↗」이 그대로 있다 — 눌러도 그 기사가 안 나온다');
  assert.ok(h.indexOf(대문) < 0, '★★★ 대문 주소가 아직 편지에 박혀 있다');
});

test('★★★ «그 기사» 주소에는 그대로 단다', () => {
  const h = 편지([기사({ 링크: 한건 })]).서식;
  assert.ok(/원문\s*↗/.test(h),
    '(재기 값) 멀쩡한 기사 링크까지 사라졌다 — 잣대가 너무 좁다');
  assert.ok(h.indexOf(한건) >= 0, '★★★ 그 기사로 가는 주소가 편지에 없다');
});

test('★★ 링크를 떼어도 «출처»는 남는다', () => {
  /* 어느 매체를 참고했는지는 꼭지마다 밝힌다 — 꼬리가 그렇게 약속하고 있다. */
  const h = 편지([기사({ 링크: 대문 })]).서식;
  assert.match(h, /매일노동뉴스/,
    '★★ 링크를 떼면서 출처까지 지웠다 — 어디서 왔는지 알 수 없게 된다');
  assert.ok(h.indexOf('어느 기사입니다') >= 0, '★★ 기사 자체가 사라졌다');
});

test('★★ 평문도 «같은 잣대»다', () => {
  /* ⚠ 한쪽만 고치면 서식 못 읽는 프로그램으로 받으신 분만 대문으로 가게 된다. */
  const 본 = (링크) => 편지([기사({ 링크: 링크 })]).본문;
  assert.ok(본(대문).indexOf(대문) < 0, '★★ 평문에 대문 주소가 그대로 적힌다');
  assert.ok(본(한건).indexOf(한건) >= 0, '(재기 값) 평문에서 멀쩡한 주소까지 사라졌다');
});

/* ═══ ㉢ 추적 목록을 더럽히지 않는다 ═══════════════════════════════════ */

test('★★ 그려 놓지도 않을 대문 주소가 «추적 목록»에 번호를 차지하지 않는다', () => {
  /* ⚠ href() 는 부르는 순간 목록에 한 줄을 넣는다. 「달까 말까」를 href() 로
       물으면, 안 달기로 한 주소까지 번호를 차지한다 — 아무도 안 누르는 번호다. */
  const r = T.편지짓기({ 회차: C.회차('2026-09-14'), 우리글: '',
    안: { news: [기사({ 링크: 대문 })] } },
  Object.assign({}, 설, { 추적밑주소: 'https://fn.example.com' }), {});
  const 주소들 = (r.링크들 || []).map((x) => (x && typeof x === 'object') ? x.주소 : x);
  assert.ok(주소들.indexOf(대문) < 0,
    '★★ 안 그리기로 한 대문 주소가 추적 목록에 들어갔다: ' + JSON.stringify(주소들));
});

/* ═══ ㉣ 연습 표본이 진짜 모양이다 ═════════════════════════════════════ */

test('★★★ 연습 표본의 기사 링크가 «대문»이 아니다', () => {
  /* ⚠⚠ 연습이 진짜 모양이 아니면, 연습이 아니라 «헛걸음»을 가르치는 것이 된다.
       대표께서 실제로 그 줄을 눌러 보시고 매일노동뉴스 첫 화면을 보셨다. */
  const 연 = C.연습샘플();
  (연.news || []).forEach((x) => {
    const h = 편지([Object.assign({}, x, { 우리말: '' })]).서식;
    assert.ok(/원문\s*↗/.test(h),
      '★★★ 연습 기사 「' + String(x.제목).slice(0, 24) + '」의 링크가 대문이다: ' + x.링크);
  });
  assert.ok((연.news || []).length >= 3, '연습 기사가 줄었다');
});

/* ═══ ㉤ 창이 «그 기사의 것»으로 보인다 ════════════════════════════════ */

test('★★★ 기사 줄에 창이 쓸 «쪽지»(매체·원문)가 붙는다', () => {
  const h = 편지([기사({ 링크: 한건 })]).서식;
  const 줄 = (/id="n-news-0"[\s\S]*?>/.exec(h) || [''])[0];
  assert.match(줄, /data-src="매일노동뉴스"/,
    '★★★ 창이 «어느 매체 기사인지»를 알 길이 없다');
  assert.ok(줄.indexOf('data-url=') >= 0, '★★★ 창에 원문 단추를 달 주소가 없다');
});

test('★★ 대문 주소면 «원문 쪽지»를 안 단다 — 헛단추를 만들지 않는다', () => {
  const h = 편지([기사({ 링크: 대문 })]).서식;
  const 줄 = (/id="n-news-0"[\s\S]*?>/.exec(h) || [''])[0];
  assert.ok(줄.indexOf('data-url=') < 0, '★★ 대문으로 가는 단추를 창에 달았다');
  assert.match(줄, /data-src=/, '★ 매체 쪽지까지 없앴다 — 출처는 밝혀야 한다');
});

/* 창을 «실제로 열어» 본다.
   ⚠⚠ 글자로만 보면(「기사 원문 보기 가 적혀 있다」) 그 글자를 만드는 가지가
     통째로 죽어 있어도 통과한다 — 2026-09-20 이빨 확인에서 실제로 그렇게 빠져나갔다
     (if(주소){…} 를 if(false){…} 로 바꿔도 검사가 초록이었다).
   ★ 그래서 가짜 쪽을 세우고 창스크립트를 돌린 뒤, 창 «안에 무엇이 담겼는지»를 본다. */
function 창열어보기(줄쪽지, 줄속) {
  const vm = require('node:vm');
  const 만들기 = () => ({ className: '', innerHTML: '', style: {}, textContent: '',
    _자식: [], appendChild(x) { this._자식.push(x); },
    removeAttribute() {}, querySelector() { return null; },
    setAttribute() {}, getAttribute() { return null; } });
  const 속 = 만들기();          /* #popb — 창의 몸 */
  const 머 = 만들기();          /* #popt — 창의 이름표 */
  const 창 = 만들기();          /* #pop */
  const 줄 = Object.assign(만들기(), {
    getAttribute(k) { return 줄쪽지[k] == null ? null : 줄쪽지[k]; },
    cloneNode() { return Object.assign(만들기(), { innerHTML: 줄속 || '' }); }
  });
  const 짐 = {
    Node: { DOCUMENT_POSITION_FOLLOWING: 4 },
    document: {
      _클릭: null,
      getElementById(id) { return id === 'pop' ? 창 : (id === 'popb' ? 속 : (id === 'popt' ? 머 : null)); },
      addEventListener(t, f) { if (t === 'click' && !this._클릭) this._클릭 = f; },
      createElement() { return 만들기(); },
      querySelector() { return null; },
      querySelectorAll() { return []; },
      documentElement: { style: {} }
    },
    window: { addEventListener() {}, scrollY: 0, scrollTo() {} },
    location: { hash: '', pathname: '/newsView', search: '' },
    history: { replaceState() {} }
  };
  짐.window.document = 짐.document;
  vm.createContext(짐);
  const m = /<script>([\s\S]*?)<\/script>/.exec(NV.쪽('제목', '<div>속</div>'));
  assert.ok(m, '껍데기에 스크립트가 없다');
  vm.runInContext(m[1], 짐);
  assert.ok(짐.document._클릭, '누르기를 잡는 손잡이가 없다');
  짐.document._클릭({
    target: { closest: (sel) => (sel === '[data-pop]' ? 줄 : null) },
    preventDefault() {}, stopPropagation() {}
  });
  return { 담긴것: 속._자식 };
}

test('★★★ 창이 그 쪽지로 «원문 단추»를 만든다 — 실제로 열어 본다', () => {
  const r = 창열어보기({ 'data-pop': '1', 'data-src': '매일노동뉴스', 'data-url': 한건 },
    '어느 기사입니다');
  const 발 = r.담긴것.find((x) => x.className === 'popf');
  assert.ok(발, '★★★ 창에 원문 단추가 안 붙었다 — 열어도 제목만 되풀이한다');
  assert.ok(발.innerHTML.indexOf(한건) >= 0,
    '★★★ 단추가 그 기사로 안 간다: ' + 발.innerHTML);
  assert.match(발.innerHTML, /매일노동뉴스에서 기사 원문 보기 ↗/,
    '★★★ 어느 매체 기사인지 안 적는다: ' + 발.innerHTML);
});

test('★★ 원문 쪽지가 없으면 단추도 «안» 만든다', () => {
  const r = 창열어보기({ 'data-pop': '1', 'data-src': '매일노동뉴스' }, '어느 기사입니다');
  assert.ok(!r.담긴것.some((x) => x.className === 'popf'),
    '★★ 갈 곳이 없는데 단추를 만들었다 — 눌러도 아무 일이 안 난다');
});

test('★★ 창의 꾸밈과 머리표 지우기가 자리에 있다', () => {
  assert.match(보는쪽, /#pop \.popf a\{/, '★★ 원문 단추의 꾸밈이 없다');
  assert.match(보는쪽, /u2014/,
    '★★ 목록의 머리표(—)를 창에서 안 지운다 — 창 한복판에 점 하나가 남는다');
});

test('★★★ 기사 «본문»은 창에도 쪽에도 안 싣는다 — 남의 저작물이다', () => {
  /* functions/news-brief.js 맨 위 규칙: 「기사 본문은 옮기지 않는다 … 이건 취향이
     아니라 저작권이다. (법령은 저작권 대상이 아니라 그대로 실어도 된다.)」
     ★ 판례를 우리 양식으로 펼 수 있는 까닭이 바로 그 괄호다 — 판결문은 저작물이
       아니다(저작권법 제7조). 기사에까지 그 길을 열면 안 된다.
     ⚠ 값이 아니라 «문이 열려 있는가»를 본다 — newsFull 은 법제처 둘만 연다. */
  const NF = require('../functions/news-full.js');
  ['news', 'article', 'labortoday', '', 'law'].forEach((t) => {
    assert.equal(NF.갈래고르기(t), '',
      '★★★ 법제처(prec·expc) 말고 「' + t + '」까지 열린다 — 남의 기사를 우리 서버가 퍼 온다');
  });
  assert.equal(NF.갈래고르기('prec'), 'prec', '(재기 값) 판례 문까지 닫혔다');
  assert.equal(NF.갈래고르기('expc'), 'expc', '(재기 값) 해석례 문까지 닫혔다');
});
