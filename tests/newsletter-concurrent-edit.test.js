/* 「마지막에 누른 사람이 이긴다」를 없앤다 · 조용한 고장을 화면에 꺼내 놓는다
   ═══════════════════════════════════════════════════════════════════════════
   ① 회차저장 은 «안 을 통째로» 덮어쓴다. 화면이 든 안 은 읽어 온 그때 것이라,
      그 사이 다른 관리자가 기사 한 줄을 더했으면 내가 저장하는 순간 그 줄이 사라진다.
      서로 «다른 기사»를 고쳐도 그렇다 — 아무도 덮어썼다는 것을 모른다.
   ② 「새 검토후보가 없습니다」는 두 가지를 뜻했다 — 「새 기사가 없다」와
      「몇 주째 못 읽고 있다」. 둘이 똑같아 보이면 고장이 조용히 이어진다.
   ③ 거래(transaction)를 회차 «통째»에 걸면 30,000자 전문까지 읽어 다시 쓴다. */

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripComments } = require('./strip-comments');
const { cutFn } = require('./cut-fn');

const Review = require('../js/pu-news-review.js');
const Ont = require('../js/pu-ontology.js');

const ROOT = path.join(__dirname, '..');
const 읽기 = (p) => stripComments(fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n'));
const 화면 = 읽기('pu-news.html');
const 서버 = 읽기('functions/index.js');

/* ══════ ① 동시 손질 — 남의 글을 조용히 지우지 않는다 ══════ */

test('★★ 저장은 «내가 읽어 온 판»일 때만 통과한다', () => {
  /* 판올리기 를 꺼내 두 관리자가 같은 판에서 저장하는 상황을 만든다 */
  const 자리 = { 판: 3 };
  const 짐 = { db: { ref: () => ({
    once: async () => ({ val: () => 자리.판 }),
    transaction: async (fn) => {
      const 다음 = fn(자리.판);
      if (다음 === undefined) return { committed: false };
      자리.판 = 다음; return { committed: true };
    },
  }) } };
  vm.createContext(짐);
  vm.runInContext(cutFn(화면, 'async function 판올리기('), 짐);

  return (async () => {
    const 갑 = await vm.runInContext('판올리기("k", 3)', 짐);
    assert.equal(갑, 4, '먼저 저장한 쪽이 막혔다');
    const 을 = await vm.runInContext('판올리기("k", 3)', 짐);
    assert.equal(을, 0, '옛 판으로 덮어썼다 — 남이 더한 기사가 조용히 사라진다');
    const 을다시 = await vm.runInContext('판올리기("k", 4)', 짐);
    assert.equal(을다시, 5, '새로 읽은 뒤에도 못 저장한다');
  })();
});

test('★★ 찬 자리에서 «헛되이» 막지 않는다 — 한 번 더 확인한다', () => {
  /* 거래는 지금 손안에 있는 값으로 먼저 불린다. 그 값이 아직 안 와서 접혔을 뿐인데
     「남이 고쳤습니다」를 띄우면, 아무도 안 건드렸는데 저장이 막힌다. */
  let 부른수 = 0;
  const 짐 = { db: { ref: () => ({
    once: async () => ({ val: () => 0 }),
    transaction: async (fn) => {
      부른수++;
      /* 첫 번은 «찬 자리»(null) 흉내 — 접힌다. 두 번째는 제대로 온다. */
      const 값 = 부른수 === 1 ? null : 0;
      const 다음 = fn(값);
      return { committed: 다음 !== undefined && 부른수 > 1 };
    },
  }) } };
  vm.createContext(짐);
  vm.runInContext(cutFn(화면, 'async function 판올리기('), 짐);
  return vm.runInContext('판올리기("k", 0)', 짐).then(function (r) {
    assert.equal(r, 1, '한 번 접혔다고 포기한다 — 멀쩡한 저장이 막힌다');
  });
});

test('★★ 막혔을 때 «덮어쓰지 않았다»고 말하고 화면을 새로 읽는다', () => {
  const 몸 = cutFn(화면, 'async function 회차저장(');
  assert.match(몸, /회차다시읽기\(/, '막히고도 옛 화면을 그대로 둔다');
  assert.match(몸, /덮어쓰지 않았습니다/, '무슨 일이 일어났는지 안 말한다');
  assert.match(몸, /return false/, '막혔는데 저장된 것처럼 돌려준다');
  assert.match(몸, /판:\s*새판/, '올린 판을 안 적는다 — 다음 저장이 또 막힌다');
});

test('★★ 저장이 막혔으면 «담았다»고 말하지 않는다', () => {
  /* 「담았습니다」 토스트만 뜨고 실제로는 안 담긴 것이 가장 나쁘다 */
  const 자리들 = [...화면.matchAll(/await 회차저장\(d\)/g)];
  assert.ok(자리들.length >= 4, '회차저장을 기다리는 자리를 못 찾았다');
  let 지킨수 = 0;
  자리들.forEach(function (m) {
    const 앞 = 화면.slice(Math.max(0, m.index - 40), m.index + 30);
    if (/if\(!\(await 회차저장\(d\)\)\) return/.test(앞)) 지킨수++;
  });
  assert.ok(지킨수 >= 4, '막혀도 그냥 이어 가는 자리가 있다 (' + 지킨수 + '/' + 자리들.length + ')');
});

test('★★ 보내기 직전에도 «내가 본 것»인지 본다', () => {
  /* 확정본을 도장으로 지키는 것과 같은 까닭 — 대표가 확인하신 것과 다른 편지가
     119곳에 나가면 되돌릴 수 없다. */
  const 몸 = cutFn(화면, 'async function 진짜보내기(');
  const 견줌 = 몸.indexOf("'/판'");
  const 걸기 = 몸.indexOf('await 걸기(');
  assert.ok(견줌 >= 0, '보내기 전에 판을 안 본다 — 남이 고친 편지가 나간다');
  assert.ok(걸기 > 견줌, '걸고 나서 견준다 — 그때는 이미 나간 뒤다');
});

/* ══════ ② 거래는 «칸 하나»에만 ══════ */

test('★★ 목록추가 는 빈 자리에서도 «더한 목록»을 준다', () => {
  /* 찬 자리(null)에서 접으면 서버에 묻지도 않고 끝난다 */
  const 뉴스 = { id: 'a1', 제목: '가' };
  assert.deepEqual(Review.목록추가(null, 뉴스), [뉴스], 'null 에서 접는다 — 첫 등록이 막힌다');
  assert.deepEqual(Review.목록추가([], 뉴스), [뉴스]);
});

test('★ 목록추가 는 같은 것을 두 번 담지 않는다', () => {
  const 뉴스 = { id: 'a1', 후보Id: 'c1' };
  assert.equal(Review.목록추가([뉴스], 뉴스), null, '같은 id 가 두 번 들어간다');
  assert.equal(Review.목록추가([{ 후보Id: 'c1' }], 뉴스), null, '같은 후보가 두 번 들어간다');
  assert.equal(Review.목록추가([{ id: 'b2' }], 뉴스).length, 2);
  assert.equal(Review.목록추가([], null), null, '빈 것을 담는다');
});

test('★★ 회차추가 와 목록추가 가 «같은 잣대»다', () => {
  /* 두 길이 갈리면, 한쪽으로는 담기고 한쪽으로는 안 담긴다 */
  const 뉴스 = { id: 'a1', 후보Id: 'c1' };
  [[{ id: 'b2' }], [뉴스], [{ 후보Id: 'c1' }], []].forEach(function (목록, i) {
    const 회차 = { 상태: '초안', 지역뉴스: 목록 };
    assert.deepEqual(회차추가목록(회차, 뉴스), Review.목록추가(목록, 뉴스),
      i + '번째에서 두 길이 갈린다 — 한쪽으로는 담기고 한쪽으로는 안 담긴다');
  });
  assert.equal(Review.회차추가({ 상태: '발송' }, 뉴스, {}, '나', 1), null, '보낸 회차에 담긴다');
  function 회차추가목록(c, n) {
    const r = Review.회차추가(c, n, { 회차: {} }, '나', 1);
    return r ? r.지역뉴스 : null;
  }
});

test('★★ 지역뉴스 등록이 회차 «통째»에 거래를 걸지 않는다', () => {
  /* 2026-09-13 실측: 회차 하나 47.8KB 중 전문이 30.3KB. 회차가 쌓일수록 무거워진다. */
  const 몸 = cutFn(화면, 'function 지역뉴스담기(');
  assert.match(몸, /'\/지역뉴스'\)/, '거래를 지역뉴스 칸에 안 건다');
  assert.match(몸, /목록추가\(/, '회차 통째를 다루는 자를 쓴다');
  assert.ok(!/db\.ref\('newsletter\/issues\/'\+d\.열쇠\)\s*;/.test(몸), '회차 통째를 잡는다');
});

test('★★ 철회도 «찬 자리»에서 헛되이 막히지 않는다', () => {
  const 몸 = cutFn(화면, 'function 지역뉴스빼기(');
  const 데움 = 몸.indexOf(".once('value')");
  const 거래 = 몸.indexOf('.transaction(');
  assert.ok(데움 >= 0 && 거래 > 데움,
    '거래 앞에 안 데운다 — 아무도 안 건드렸는데 「먼저 변경했습니다」가 뜬다');
});

/* ══════ ③ 조용한 고장을 꺼내 놓는다 ══════ */

test('★★ 모으개가 출처마다 «됐나 안 됐나»를 남긴다', () => {
  const i = 서버.indexOf('exports.dailyRegionalNewsCollect');
  const 몸 = 서버.slice(i, 서버.indexOf('\nexports.', i + 10));
  /* ⚠ 「출처별 이라는 글자가 있다」로는 모자란다 — 모아 놓고 «안 적으면» 화면은
       여전히 깜깜하다. 실제로 남기는 자리에 실려 나가는지를 본다. */
  assert.match(몸, /출처별:\s*출처별/, '출처별 결과를 모으고도 안 남긴다 — 화면이 알 길이 없다');
  assert.match(몸, /막힌출처:/, '몇 곳이 막혔는지 안 남긴다');
  assert.match(몸, /연속실패:\s*Number\(옛\.연속실패/, '「몇 번째로 못 읽나」를 안 이어 센다');
  assert.match(몸, /마지막성공:\s*Number\(옛\.마지막성공/,
    '실패하면 마지막 성공까지 지운다 — 「언제부터」가 사라진다');
});

test('★★ 화면이 「없다」와 「못 읽었다」를 «가려» 말한다', () => {
  const 빈말 = (수집결과) => {
    const 짐 = { App: { 수집결과: 수집결과 }, esc: (s) => String(s) };
    vm.createContext(짐);
    vm.runInContext(cutFn(화면, 'function 며칠전('), 짐);
    vm.runInContext(cutFn(화면, 'function 수집빈말('), 짐);
    return vm.runInContext('수집빈말()', 짐);
  };
  assert.match(빈말({}), /한 번도 안 돌았/, '한 번도 안 돌았는데 「새 기사가 없다」고 한다');
  assert.match(빈말({ 마지막수집: Date.now(), 읽은출처: 3, 막힌출처: 0 }), /새 기사가 없는 것/,
    '다 읽었는데 그렇다고 말해 주지 않는다');
  const 막힘 = 빈말({ 마지막수집: Date.now(), 읽은출처: 2, 막힌출처: 1 });
  assert.ok(!/새 기사가 없는 것/.test(막힘) && /못 읽고 있어/.test(막힘),
    '못 읽고 있는데 「새 기사가 없습니다」로 보인다 — 고장이 조용히 이어진다');
});

test('★★ 못 읽는 출처를 «목록으로» 보여 준다', () => {
  const 짐 = { App: { 수집결과: { 마지막수집: Date.now(), 출처별: {
    a: { 이름: '가나노동청', 지역: '충남', 됐나: false, 연속실패: 3, 마지막성공: Date.now() - 3 * 86400000, 탈: 'fetch failed' },
    b: { 이름: '다라시청', 지역: '충북', 됐나: true, 마지막성공: Date.now() },
  } } }, esc: (s) => String(s) };
  vm.createContext(짐);
  vm.runInContext(cutFn(화면, 'function 며칠전('), 짐);
  vm.runInContext(cutFn(화면, 'function 수집상태줄('), 짐);
  const r = vm.runInContext('수집상태줄()', 짐);
  assert.match(r.딱지, /1곳 못 읽음/, '몇 곳이 막혔는지 안 보인다');
  assert.match(r.몸, /가나노동청/, '어느 출처인지 안 보인다');
  assert.match(r.몸, /3번째/, '몇 번째 실패인지 안 보인다');
  assert.ok(!/다라시청/.test(r.몸), '멀쩡한 출처까지 늘어놓아 눈이 흐려진다');

  const 다됨 = { App: { 수집결과: { 마지막수집: Date.now(), 출처별: {
    b: { 이름: '다라시청', 됐나: true } } } }, esc: (s) => String(s) };
  vm.createContext(다됨);
  vm.runInContext(cutFn(화면, 'function 며칠전('), 다됨);
  vm.runInContext(cutFn(화면, 'function 수집상태줄('), 다됨);
  assert.equal(vm.runInContext('수집상태줄()', 다됨).몸, '', '멀쩡할 때도 자리를 차지한다');
});

test('★ 「주소를 못 읽은 곳」을 전국 셈에서 꺼내 말한다', () => {
  const 짐 = { 명단셈: () => ({ ok: [{ 지역: '충남' }, { 지역: '전국' }, { 지역: '전국' }] }) };
  vm.createContext(짐);
  vm.runInContext(cutFn(화면, 'function 주소못읽은말('), 짐);
  assert.match(vm.runInContext('주소못읽은말()', 짐), /2곳/,
    '주소를 못 읽은 곳이 「전국 N」에 섞여 안 보인다');
  const 다읽음 = { 명단셈: () => ({ ok: [{ 지역: '충남' }] }) };
  vm.createContext(다읽음);
  vm.runInContext(cutFn(화면, 'function 주소못읽은말('), 다읽음);
  assert.match(vm.runInContext('주소못읽은말()', 다읽음), /모두 읽었습니다/);
});

/* ══════ ④ 어긋난 안내는 없는 것보다 나쁘다 ══════ */

test('★★ 온톨로지 등록부가 «실제로 하는 일»을 적는다', () => {
  /* 2026-09-13 이전에는 「명단은 여기가 정본이고 기업정보함을 실시간으로 끌어오지
     않는다」고 거꾸로 적혀 있었다 — 코드와 대표 지시 둘 다의 반대다. */
  const news = Ont.PROGRAMS.news;
  assert.ok(news, '뉴스레터가 등록부에 없다');
  assert.ok(news.sharedRoots.indexOf('data/companies') >= 0,
    '받는 명단을 읽는 자리(data/companies)가 안 적혀 있다');
  const 원본 = fs.readFileSync(path.join(ROOT, 'js/pu-ontology.js'), 'utf8');
  const i = 원본.indexOf('뉴스레터 관리 —');
  const 설명 = 원본.slice(i, 원본.indexOf('entityTypes', i));
  assert.ok(!/명단은 «여기가 정본»이다/.test(설명), '거꾸로 적힌 옛 설명이 남아 있다');
  assert.match(설명, /그때그때 읽는다|사본을 두지 않는다/, '실제로 하는 일이 안 적혀 있다');
});
