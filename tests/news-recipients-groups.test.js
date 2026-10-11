'use strict';
/* 받는 곳 — 고객사 · 지인·잠재 · 해지한 곳 + 화면 정리 (대표 지시 2026-10-11 「추천대로 둘다」)
   「뉴스레터에 자문 이외 지인이나 친한사람에게도 보내고 싶다 … 고정 고객이 되면 위치 옮기고
    계약해지하면 별도로 관리」 · 「ui 가 잘 눈에 안들어온다」

   ■ 이 검사가 지키는 «규칙»
     ① 해지한 곳 — 해지일부터 6개월은 보낸다, 그 뒤·해지일 없음은 «동의한 곳만»
        (정보통신망법 제50조 제1항 제1호 · 시행령 제61조 제1항, 2026-10-11 원문 확인)
     ② 범위가 이미 해지까지 보면(자문끝·명함전부) 해지 칸은 따로 안 싣는다 — 두 번 안 간다
     ③ 지인 — 동의한 분에게만 간다 · 같은 주소가 고객사에 있으면 고객사 줄이 남는다(「고객이 됨」)
     ④ 화면과 서버(금요일 준비)가 «같은» 모으기를 쓴다
     ⑤ 업체관리 원장은 안 쓴다 — 해지 동의는 newsletter/해지동의 에만
     ⑥ 화면 — 탭 둘이 서고, 작은 탭은 밑줄, 거르개에 그림문자가 없고, 내보내기는 하나다 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const C = require('../js/pu-news-core.js');
const { stripComments, stripJs } = require('./strip-comments.js');
const 화면 = stripComments(fs.readFileSync(path.join(__dirname, '..', 'pu-news.html'), 'utf8')).replace(/\r\n/g, '\n');
const 금요일 = stripJs(fs.readFileSync(path.join(__dirname, '..', 'functions', 'news-friday.js'), 'utf8')).replace(/\r\n/g, '\n');
const 함 = (n) => { const i = 화면.indexOf('function ' + n + '('); assert.ok(i >= 0, n + ' 이 없다'); return 화면.slice(i, 화면.indexOf('\n}\n', i) + 2); };

/* 서울 2026-10-11 낮 */
const 지금 = Date.parse('2026-10-11T03:00:00Z');
const 곳 = (id, o) => Object.assign({ id, name: id + '상사', status: 'closed', primaryContactEmail: id + '@example.com' }, o || {});

test('① 해지일부터 6개월은 보내고, 지나면 멈춘다', () => {
  const r = C.해지한곳명단([
    곳('a', { closedDate: '2026-05-01' }),          /* 기한 2026-11-01 — 안 */
    곳('b', { closedDate: '2026-04-10' }),          /* 기한 2026-10-10 — 어제 지남 */
    곳('c', { contractEndDate: '2026.06.30' })      /* closedDate 없으면 계약 종료일 */
  ], {}, 지금);
  const 판 = Object.fromEntries(r.곳들.map((x) => [x.사업장, x.보냄]));
  assert.strictEqual(판.a, true, '6개월 안인데 안 보낸다');
  assert.strictEqual(판.b, false, '6개월이 지났는데 동의 없이 보낸다 — 법 밖이다');
  assert.strictEqual(판.c, true, '계약 종료일로 물러서지 않는다');
  assert.deepStrictEqual(r.줄들.map((x) => x.email).sort(), ['a@example.com', 'c@example.com']);
  assert.ok(r.줄들.every((x) => x.해지 === true), '해지 줄에 표시가 없다 — 화면이 고객사와 못 가른다');
});

test('① 해지일이 없으면 «지났다»로 본다 — 동의가 있어야 간다', () => {
  const r = C.해지한곳명단([곳('d'), 곳('e')], { e: { 동의: true, 동의날: '2026-10-01' } }, 지금);
  const 판 = Object.fromEntries(r.곳들.map((x) => [x.사업장, x]));
  assert.strictEqual(판.d.보냄, false, '날짜를 모르는데 보낸다');
  assert.match(판.d.까닭, /해지일 없음/);
  assert.strictEqual(판.e.보냄, true, '동의했는데 안 보낸다');
  assert.ok(!r.곳들.some((x) => x.사업장 === 'zz'));
});

test('① 6개월 셈 — 달 끝날은 그 달 끝으로', () => {
  assert.strictEqual(C.여섯달뒤('2026-08-31'), '2027-02-28');
  assert.strictEqual(C.여섯달뒤('2026-07-15'), '2027-01-15');
  assert.strictEqual(C.여섯달뒤('2026-03-31'), '2026-09-30');
  assert.strictEqual(C.날짜만('2026.6.3'), '2026-06-03');
  assert.strictEqual(C.날짜만('엉망'), '');
});

test('② 범위가 해지까지 보면 해지 칸은 따로 안 싣는다 — 같은 곳에 두 번 안 간다', () => {
  const 사업장들 = [곳('a', { closedDate: '2026-09-01' })];
  const 끝 = C.명단모으기({ 사업장들, 범위: '자문끝', 지금 });
  assert.strictEqual(끝.해지.줄들.length, 0);
  assert.strictEqual(끝.d.ok.length, 1, '자문끝이면 받는 명단이 해지한 곳을 이미 싣는다');
  assert.strictEqual(끝.d.셈.겹침, 0, '같은 곳을 두 번 실었다');
  const 중 = C.명단모으기({ 사업장들, 범위: '자문중', 지금 });
  assert.strictEqual(중.d.ok.length, 1, '자문중이면 해지 칸이 6개월 안의 곳을 싣는다');
  assert.strictEqual(중.d.ok[0].해지, true);
});

test('③ 지인 — 동의한 분만, 고객사와 같은 주소면 고객사 줄이 남는다', () => {
  const r = C.명단모으기({
    사업장들: [{ id: 'k', name: '가나상사', status: 'active', primaryContactEmail: 'hong@example.com' }],
    더한분들: {
      p1: { 이름: '홍길동', 주소: 'HONG@example.com', 동의: true },   /* 계약해서 고객이 된 분 */
      p2: { 이름: '김철수', 주소: 'kim@example.com', 동의: true },
      p3: { 이름: '이영희', 주소: 'lee@example.com' }                  /* 동의 받기 전 */
    }, 지금 });
  const 주소 = r.d.ok.map((x) => x.email.toLowerCase() + ':' + x.누구).sort();
  assert.deepStrictEqual(주소, ['hong@example.com:담당자', 'kim@example.com:더한분'],
    '고객이 된 분이 지인 줄로 가거나, 동의 안 한 분이 들어갔다');
  assert.strictEqual(r.d.셈.겹침, 1, '고객이 된 분이 두 통 받는다');
});

test('④ 서버(금요일 준비)도 «같은» 모으기를 쓰고 해지 동의를 읽는다', () => {
  assert.match(금요일, /Core\.명단모으기\(\{[\s\S]*?해지동의: 자료\.해지동의/, '서버가 따로 모은다 — 화면과 다른 곳에 간다');
  assert.match(금요일, /읽\('newsletter\/해지동의', \{\}\)/, '서버가 해지 동의를 안 읽는다');
  assert.match(금요일, /노무사회, 해지동의 \};/, '읽은 해지 동의를 안 넘긴다');
  /* 실제로 돌려 같은지 본다 */
  const NF = require('../functions/news-friday.js');
  const 자료 = { 설정: { 범위: '자문중' }, 사업장들: [곳('a', { closedDate: '2026-09-01' }),곳('b')],
    해지동의: { b: { 동의: true } }, 더한분들: {}, 막은주소: {}, 지금 };
  const 서버 = NF.명단짓기(자료).ok.map((x) => x.email).sort();
  const 화 = C.명단모으기({ 사업장들: 자료.사업장들, 범위: '자문중', 해지동의: 자료.해지동의, 지금 }).d.ok.map((x) => x.email).sort();
  assert.deepStrictEqual(서버, 화);
  assert.deepStrictEqual(서버, ['a@example.com', 'b@example.com']);
  /* 화면 명단셈도 같은 것을 부른다 */
  assert.match(함('명단셈'), /Core\.명단모으기\(\{[\s\S]*해지동의: App\.해지동의/);
  assert.match(화면, /db\.ref\('newsletter\/해지동의'\)\.once/, '화면이 해지 동의를 안 읽는다');
});

test('⑤ 해지 동의는 newsletter/해지동의 에만 쓴다 — 업체관리 원장은 안 건드린다', () => {
  const b = 함('해지동의바꾸기');
  assert.match(b, /db\.ref\('newsletter\/해지동의\/' \+ id\)\.set\(/);
  assert.match(b, /db\.ref\('newsletter\/해지동의\/' \+ id\)\.remove\(/);
  assert.ok(!/data\/companies/.test(b), '해지 동의가 원장을 고친다');
  assert.ok(!/data\/companies/.test(함('해지화면') + 함('지인화면')), '화면이 원장을 쓴다');
  /* 동의는 «어떻게» 받았는지도 남긴다 */
  assert.match(b, /방법:/);
  assert.match(함('더한분동의'), /동의방법: 방법/);
});

test('⑥ 화면 — 탭 둘이 서고, render 가 그린다', () => {
  assert.match(화면, /\{ t:'friend', 이름:'지인·잠재'/);
  assert.match(화면, /\{ t:'closed', 이름:'해지한 곳'/);
  assert.match(화면, /friend:'who', closed:'who'/, '새 탭이 «받는 곳» 묶음 밑이 아니다');
  assert.match(화면, /if\(App\.tab==='friend'\) m\.innerHTML = 지인화면\(\)/);
  assert.match(화면, /if\(App\.tab==='closed'\) m\.innerHTML = 해지화면\(\)/);
  /* 두 표 모두 머리와 줄의 칸 수가 같다 */
  [['지인화면', '표'], ['해지화면', '표']].forEach(([f]) => {
    const b = 함(f);
    const 머 = /<table class="list"><tr>([\s\S]*?)<\/tr>\$\{표\}/.exec(b);
    assert.ok(머, f + ' 표 머리를 못 찾았다');
    const th = (머[1].match(/<th/g) || []).length;
    const 줄 = b.slice(b.indexOf('const 표 ='), b.indexOf("}).join('')", b.indexOf('const 표 =')));
    assert.strictEqual((줄.match(/<td/g) || []).length, th, f + ' — 머리와 줄의 칸 수가 다르다');
  });
  /* 받는 명단 사업장 표에는 고객사만 */
  assert.match(함('명단화면'), /사업장으로묶기\(고객사줄들\(r, true\)\)/, '해지·지인이 사업장 표에 섞인다');
});

test('⑥ 디자인 — 작은 탭은 밑줄, 거르개에 그림문자 없음, 내보내기 하나', () => {
  const css = /\.subtabs button\{([^}]*)\}/.exec(화면);
  assert.ok(css && /border-bottom:2px solid/.test(css[1]) && !/border-radius:99px/.test(css[1]),
    '작은 탭이 다시 알약이다 — 거르개와 헷갈린다');
  const 명 = 함('명단화면');
  ['📊', '👥', '👔 대표자', '🧑‍💼 담당자', '🏢 사업장', '📇 명함에만'].forEach((x) =>
    assert.ok(!명.includes(x), '받는 명단에 그림문자가 돌아왔다: ' + x));
  assert.match(명, /class="seg"/, '거르개가 붙은 단추 한 덩이가 아니다');
  assert.ok(!/btn pri" onclick="노무사회엑셀/.test(명), '공인노무사회 엑셀이 다시 큰 갈색 단추다');
  const 내 = 함('내보내기단추');
  assert.match(내, /명단내보내기\(\)/);
  assert.match(내, /노무사회엑셀\(\)/);
  assert.match(명, /내보내기단추\(\)/);
  /* 긴 안내는 ⓘ 로 — 표 밑 네 줄 안내·큰 법 상자가 돌아오지 않았다 */
  assert.ok(!/명단 범위가 곧 법 판단입니다 \(정보통신망법 50조\)\.<\/b><br>/.test(명), '큰 법 안내 상자가 돌아왔다');
  assert.match(명, /오른도움\(/);
});

/* ★★★ 화면을 «실제로 돌려» 본다 (2026-10-11) — 거르개·머리 단추를 만드는 코드가 통째로
   지워졌는데 문법 검사는 통과했다. 쓰는 자리가 템플릿 안이라 화면을 열어야 터진다. */
test('★★★ 받는 곳 다섯 화면이 가짜 자료로 «실제로» 그려진다', () => {
  const vm = require('node:vm');
  const { 화면올리기 } = require('./helpers/news-screen-vm.js');
  const 짐 = 화면올리기();
  assert.ok(!짐.올림오류, '화면 스크립트가 올라가다 멈췄다: ' + (짐.올림오류 && 짐.올림오류.message));
  vm.runInContext("App.설정 = {범위:'자문중'}; App.명함들 = {}; App.막은주소 = {}; App.해지동의 = {};"
    + "App.사업장들 = {a:{id:'a',name:'가나상사',status:'active',typeCode:'advisory',ceo:'홍',ceoEmail:'ceo@ga.example',primaryContactEmail:'kim@ga.example'},"
    + "b:{id:'b',name:'다라산업',status:'closed',closedDate:'2026-08-01',primaryContactEmail:'lee@da.example'},"
    + "d:{id:'d',name:'사아정밀',status:'active'}};"
    + "App.더한분들 = {p1:{이름:'예시',주소:'f@example.com',동의:true,동의날:'2026-01-02'},p2:{이름:'대기',주소:'w@example.com'}};", 짐);
  const 그림 = {};
  [['who', '명단화면'], ['friend', '지인화면'], ['closed', '해지화면'], ['noaddr', '주소없는곳화면'], ['bounce', '반송화면']]
    .forEach(([t, f]) => {
      그림[t] = vm.runInContext("App.tab='" + t + "'; " + f + '()', 짐);
      assert.ok(그림[t].length > 200, f + ' 가 비었다');
      assert.ok(!/undefined|\[object Object\]|NaN/.test(그림[t].replace(/<[^>]+>/g, ' ')), f + ' 에 빈 값이 찍혔다');
    });
  assert.match(그림.who, /class="seg"/, '받는 명단 거르개가 안 그려졌다');
  assert.match(그림.who, /내보내기/, '내보내기 단추가 안 그려졌다');
  assert.match(그림.who, /가나상사/);
  assert.ok(!/다라산업/.test(그림.who), '해지한 곳이 받는 명단 사업장 표에 섞였다');
  assert.match(그림.closed, /다라산업/);
  assert.match(그림.friend, /동의 받기 전/);
});
