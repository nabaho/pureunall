/* 확정본이 «준비한 그때 그대로»일 때만 나간다
   ═══════════════════════════════════════════════════════════════════════════
   자동발송 확정본(weeklyReady)은 준비한 순간의 편지를 봉인한다. 그래서 그 뒤에
   회차를 고쳐도 확정본은 그대로다 — 화면에는 고친 것이 보이는데 월요일에는
   «고치기 전 것»이 나간다. 화면은 「고치면 다시 준비해야 합니다」라고 준비할 때
   한 번 적어 두었을 뿐, 아무도 막지 않았다. 자문사로 나가면 되돌릴 수 없다.

   ★★ 이 검사의 핵심은 «두 도장이 같은 값을 내는가»다. 서버 배포에 js/ 가 안 올라가서
     같은 함수를 두 벌 둘 수밖에 없었다 — 둘이 어긋나면 멀쩡한 확정본이 매주 버려진다.
     그건 조용히 나빠진다(아무도 안 보내진 줄 모른다). 그래서 값으로 견준다. */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { stripComments } = require('./strip-comments');
const { cutFn } = require('./cut-fn');

const Core = require('../js/pu-news-core.js');
const NR = require('../functions/news-ready.js');

const ROOT = path.join(__dirname, '..');
const 읽기 = (p) => stripComments(fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n'));
const 서버 = 읽기('functions/index.js');
const 화면 = 읽기('pu-news.html');

function 자동몸() {
  const a = 서버.indexOf('exports.weeklyNewsletterSend');
  assert.ok(a >= 0, 'weeklyNewsletterSend 를 못 찾았다');
  const b = 서버.indexOf('\nexports.', a + 10);
  assert.ok(b > a, '함수 끝을 못 찾았다');
  return 서버.slice(a, b);
}

/* 실제 회차와 같은 모양 — 이름은 늘 홍길동·가나상사 (진짜 의뢰인을 적지 않는다) */
const 회차하나 = () => ({
  열쇠: '2026-09-w1', 회차: { 이름: '2026년 9월 1주' }, 범위: '자문중',
  우리글: '이번 주 한마디입니다.',
  안: {
    news: [{ 제목: '원문 제목', 한줄: '한 줄 제목', 우리말: '우리가 쓴 글',
      링크: 'https://example.kr/a', 언론사: '가나일보' }],
    policy: [{ 제목: '고시 제2026-1호', 링크: 'https://moel.go.kr/x' }],
  },
  지역뉴스: [{ 제목: '지역 소식', 지역: '충북', 링크: 'https://cb.go.kr/1', 상태: '승인' }],
  /* 아래는 «편지에 안 실리는» 칸들이다 */
  상태: '초안', 고친때: 1, 전문: '아주 긴 전문…', 받는이: { a1: 'hong@example_kr' },
});

/* ══════ ① 두 도장이 «같은 값»을 낸다 ══════ */

test('★★ 화면과 서버의 도장이 같은 값을 낸다', () => {
  const 것들 = [
    회차하나(), {}, null, { 안: {} },
    { 회차: '들', 범위: '', 우리글: null, 안: { a: [{}, { 제목: '가' }] }, 지역뉴스: [] },
    { 안: { z: [{ 제목: '나', 안실음: true }], a: [{ 한줄: '다' }] } },
    { 우리글: '  앞뒤 빈칸  ', 지역뉴스: [{ 상태: '철회', 제목: '라' }] },
  ];
  것들.forEach(function (x, i) {
    assert.equal(Core.바탕도장(x), NR.바탕도장(x),
      i + '번째에서 화면과 서버의 도장이 다르다 — 멀쩡한 확정본이 매주 버려진다');
  });
});

test('★★ 편지에 «실리는 칸»이 바뀌면 도장이 바뀐다', () => {
  const 바꿔보기 = [
    ['우리글', (d) => { d.우리글 = '다른 한마디'; }],
    ['범위', (d) => { d.범위 = '전체'; }],
    ['기사 한 줄 제목', (d) => { d.안.news[0].한줄 = '다른 한 줄'; }],
    ['기사 우리말', (d) => { d.안.news[0].우리말 = '다르게 썼다'; }],
    ['기사 링크', (d) => { d.안.news[0].링크 = 'https://example.kr/b'; }],
    ['기사를 뺌(ㅁ 끄기)', (d) => { d.안.news[0].안실음 = true; }],
    ['기사 한 건 더', (d) => { d.안.news.push({ 제목: '새 줄', 우리말: '새 글' }); }],
    ['꼭지 하나 통째', (d) => { delete d.안.policy; }],
    ['지역뉴스 철회', (d) => { d.지역뉴스[0].상태 = '철회'; }],
    ['회차 이름', (d) => { d.회차 = { 이름: '다른 주' }; }],
  ];
  const 처음 = Core.바탕도장(회차하나());
  바꿔보기.forEach(function (한벌) {
    const d = 회차하나(); 한벌[1](d);
    assert.notEqual(Core.바탕도장(d), 처음,
      한벌[0] + ' 이 바뀌었는데 도장이 그대로다 — 고치기 전 편지가 나간다');
  });
});

test('★★ 편지에 «안 실리는 칸»이 바뀌면 도장이 그대로다', () => {
  /* 시험 한 통 보내면 상태가 초안→시험이 된다. 그것으로 확정본이 날아가면
     「준비해 두고 시험해 보시라」는 말 자체가 성립하지 않는다. */
  const 처음 = Core.바탕도장(회차하나());
  [['상태', (d) => { d.상태 = '시험'; }],
    ['고친때', (d) => { d.고친때 = Date.now(); }],
    ['전문', (d) => { d.전문 = '다시 지은 전문'; }],
    ['받는이 대장', (d) => { d.받는이 = { b2: 'kim@example_kr' }; }],
    ['꼭지 차례', (d) => { const a = d.안; d.안 = { policy: a.policy, news: a.news }; }],
  ].forEach(function (한벌) {
    const d = 회차하나(); 한벌[1](d);
    assert.equal(Core.바탕도장(d), 처음,
      한벌[0] + ' 만 바뀌었는데 확정본이 버려진다 — 준비해 두고 시험할 수가 없다');
  });
});

/* ══════ ② 내보낼까 — 「모르겠으면 안 보낸다」 ══════ */

test('★★ 도장이 같으면 내보낸다', () => {
  const d = 회차하나();
  const r = NR.내보낼까({ 바탕도장: NR.바탕도장(d) }, d);
  assert.equal(r.ok, true, '멀쩡한 확정본을 막는다 — 매주 아무것도 안 나간다');
});

test('★★ 준비한 뒤에 고쳤으면 «안 보낸다»', () => {
  const 준비할때 = 회차하나();
  const 확정본 = { 바탕도장: NR.바탕도장(준비할때) };
  const 고친뒤 = 회차하나(); 고친뒤.우리글 = '고쳤습니다';
  const r = NR.내보낼까(확정본, 고친뒤);
  assert.equal(r.ok, false, '고치기 전 편지가 그대로 나간다 — 되돌릴 수 없다');
  assert.equal(r.다름, true);
  assert.match(r.까닭, /다시 눌러/, '까닭에 «무엇을 하면 되는지»가 없다');
});

test('★★ 도장이 «아예 없으면» 안 보낸다 — 견줄 것이 없으면 같다고 말할 수 없다', () => {
  /* ⚠ 「안 보낸다」만 보면 안 된다 — 까닭이 «바뀌었습니다»로 나오면 대표는 고친 적도
       없는 것을 찾으신다. 도장이 없는 것은 «다른 일»이라 다르게 말해야 한다. */
  [{ 상태: '준비' }, { 바탕도장: '' }, null].forEach(function (확정본, i) {
    const r = NR.내보낼까(확정본, 회차하나());
    assert.equal(r.ok, false, i + '번째: 견줄 것 없이 내보낸다');
    assert.match(r.까닭, /도장이 없/, i + '번째: 「내용이 바뀌었다」고 엉뚱하게 말한다');
    assert.ok(!r.다름, i + '번째: 바뀐 것처럼 표시한다');
  });
});

test('★ 회차를 못 찾았으면 안 보낸다', () => {
  const 확정본 = { 바탕도장: NR.바탕도장(회차하나()) };
  assert.equal(NR.내보낼까(확정본, null).ok, false, '빈 회차로 편지가 나간다');
});

/* ══════ ③ 실제로 그 자리에서 쓰이는가 ══════ */

test('★★ 자동발송이 «걸기 전에» 도장을 견준다', () => {
  const 몸 = 자동몸();
  const 견줌 = 몸.indexOf('NR.내보낼까(');
  const 대기열 = 몸.indexOf('MB.buildQueue(');
  assert.ok(견줌 >= 0, '자동발송이 도장을 안 본다 — 고치기 전 편지가 나간다');
  assert.ok(대기열 > 견줌, '대기열을 만든 뒤에 견준다 — 그때는 이미 나간 뒤다');
  assert.match(몸, /상태:\s*"어긋남"/, '왜 안 나갔는지를 아무 데도 안 적는다');
});

test('★★ 견주려고 회차를 «통째로» 읽지 않는다', () => {
  /* 회차 안에는 25,000자 전문과 119곳의 주소가 있다. 도장은 다섯 칸이면 된다. */
  const 몸 = 자동몸();
  assert.ok(!/issueRef\.once\(/.test(몸), '회차를 통째로 읽는다');
  assert.match(몸, /issueRef\.child\(k\)\.once|바탕칸/, '칸을 골라 읽지 않는다');
});

test('★★ 준비할 때 도장을 «함께» 봉인한다', () => {
  const 몸 = cutFn(화면, 'async function 자동발송준비(');
  assert.match(몸, /바탕도장:\s*Core\.바탕도장\(d\)/,
    '확정본에 도장을 안 넣는다 — 서버가 견줄 것이 없어 매주 안 나간다');
  const 도장 = 몸.indexOf('바탕도장:');
  const 쓰기 = 몸.indexOf("db.ref('newsletter/weeklyReady').set(");
  assert.ok(도장 >= 0 && 쓰기 > 도장, '도장 없이 먼저 써 둔다');
});

test('★★ 화면이 «낡았다»를 말한다 — 준비할 때 한 번이 아니라 늘', () => {
  const 몸 = cutFn(화면, 'function 예약본상태(');
  assert.match(몸, /Core\.바탕도장\(d\)/, '지금 내용으로 도장을 다시 안 찍는다');
  /* ⚠ 「어딘가에 warn 이 있다」로는 모자란다 — 두 자리(낡음·어긋남) 각각을 본다.
       한쪽만 평범한 단추가 되면, 대표는 그 주에만 아무 표시 없이 지나치신다. */
  assert.match(몸, /꼴:\s*'warn',\s*글:\s*'⚠ 확정본이 낡았습니다/,
    '낡았는데 평범한 단추로 보인다');
  assert.match(몸, /꼴:\s*'warn',\s*글:\s*'⚠ 확정본이 낡아 안 나갔습니다/,
    '안 나간 뒤인데 평범한 단추로 보인다');
  assert.ok(/안 나갑니다|안 나갔습니다/.test(몸),
    '「이대로 두면 어떻게 되는지」를 안 말한다');
  const 부름 = 화면.indexOf('예약본상태(d)');
  assert.ok(부름 >= 0, '아무 데서도 안 부른다 — 화면에 영영 안 보인다');
});

/* ══════ ④ 화면의 판단을 «실제로 돌려» 본다 ══════ */

/* 원본에서 함수를 꺼내 stub 과 함께 돌린다 — 「warn 이라는 글자가 있다」가 아니라
   「낡았을 때 실제로 warn 을 내놓는가」를 본다. */
function 화면판단(예약본, 회차) {
  const vm = require('node:vm');
  const 짐 = { App: { 예약본: 예약본 }, Core: Core, esc: (s) => String(s) };
  vm.createContext(짐);
  vm.runInContext(cutFn(화면, 'function 예약본상태('), 짐);
  return vm.runInContext('예약본상태(' + JSON.stringify(회차) + ')', 짐);
}

test('★★ 준비한 뒤에 고치면 화면이 «낡았다»고 말한다', () => {
  const d = 회차하나();
  const 확정본 = { 상태: '준비', 회차열쇠: d.열쇠, 보낼날: '2026-09-15',
    바탕도장: Core.바탕도장(d) };

  const 그대로 = 화면판단(확정본, d);
  assert.equal(그대로.꼴, '', '안 고쳤는데 빨간 단추가 뜬다 — 늑대야가 된다');
  assert.match(그대로.글, /확정본/, '준비된 줄을 안 알려 준다');

  const 고친뒤 = 회차하나(); 고친뒤.우리글 = '고쳤습니다';
  const 낡음 = 화면판단(확정본, 고친뒤);
  assert.equal(낡음.꼴, 'warn', '고쳤는데 평범한 단추로 보인다');
  assert.match(낡음.곁, /안 나갑니다/, '이대로 두면 어떻게 되는지를 안 말한다');
});

test('★ 확정본이 «다른 회차»면 이 회차가 낡았다고 하지 않는다', () => {
  const d = 회차하나();
  const 남의것 = { 상태: '준비', 회차열쇠: '2026-08-w5', 보낼날: '2026-09-01',
    바탕도장: 'zzz' };
  const r = 화면판단(남의것, d);
  assert.equal(r.꼴, '', '다른 회차의 확정본을 이 회차가 낡은 것처럼 말한다');
});

test('★ 확정본이 아예 없으면 예전 그대로 «준비» 단추다', () => {
  const r = 화면판단(null, 회차하나());
  assert.equal(r.꼴, '');
  assert.match(r.글, /자동발송 준비/);
});

test('★ 확정본을 화면이 «읽어 온다»', () => {
  assert.match(화면, /db\.ref\('newsletter\/weeklyReady'\)\.once/,
    '확정본을 안 읽으면 낡았는지 알 길이 없다');
  assert.match(화면, /App\.예약본\s*=/, '읽어 놓고 안 담는다');
});

test('★ 자를 고쳤으면 캐시 번호를 올린다', () => {
  /* ⚠ 안 올리면 대표 화면은 옛 자를 들고 있어, 멀쩡한 확정본이 «낡았다»로 보인다 */
  const 원본 = fs.readFileSync(path.join(ROOT, 'pu-news.html'), 'utf8');
  const m = /js\/pu-news-core\.js\?v=(\d+)/.exec(원본);
  assert.ok(m, '캐시 번호가 없다');
  assert.ok(Number(m[1]) >= 34, '자(바탕도장)를 넣었는데 캐시 번호가 그대로다');
});
