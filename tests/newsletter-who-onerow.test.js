/* 받는 곳을 «한 줄»로 — 사업장 하나에 대표자와 담당자가 나란히
   ═══════════════════════════════════════════════════════════════════════════
   대표 지시 2026-09-13:
     「캡1 한줄로 정리해달라. 사업장의 대표와 담당자를 한줄에 넣고 각각 수신거부
      또는 변경되어서 다른사람으로 바뀔경우 변경할 수 있게 해달라.」
     「주소가 없어 못보내는곳은 기업정보함에 찾을 수 있게 해달라.
      그리고 대표자메일과 담당자 메일이 같은 곳은 같은 메일이라고 표시해달라.」

   ★ 여기서 못 박는 것은 «값»이 아니라 «규칙»이다:
     ① 사업장 하나가 «한 줄»이다 — 대표자 표·담당자 표로 갈라 두지 않는다
     ② 대표자와 담당자에 «각각» 수신거부와 바꾸기가 있다
     ③ 바꾸기는 «업체관리 자료»를 고친다 — 뉴스레터가 사본을 따로 갖지 않는다
     ④ 대표자 주소와 담당자 주소가 같으면 «같은 메일»이라 밝힌다
     ⑤ 주소가 없어 못 보내는 곳마다 «기업정보함으로 가는 길»이 있다

   ⚠ 실측 2026-09-13: 대표자 주소가 담당자 주소와 같으면 사업장에서명단 안의
     이집[] 겹침막이가 «대표자 줄을 통째로 삼킨다». 그래서 화면에는 담당자 한 줄만
     남고, 「같은 메일」인지 「대표자 주소가 아예 없는지」 가릴 길이 없었다.
     ★ 그래서 줄마다 대표주소를 싣는다 — 화면이 견줄 것이 있어야 한다. */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { stripComments } = require('./strip-comments');
const C = require('../js/pu-news-core.js');

const ROOT = path.join(__dirname, '..');
const 읽기 = (f) => stripComments(fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n/g, '\n'));
const news = 읽기('pu-news.html');
const cards = 읽기('pu-cards.html');

const 집 = (추가) => Object.assign({ id: 'c1', name: '어떤회사', status: 'active' }, 추가 || {});
const 명단 = (사업장들) => C.명단다듬기(
  C.사업장에서명단(사업장들, '자문중', { 대표자도: true }).줄들, {});

/* ══════════════════════════════════════════════════════════════════════════
   ① 줄마다 «대표주소»를 싣는다 — 화면이 견줄 것이 있어야 한다
   ══════════════════════════════════════════════════════════════════════════ */

test('★ 담당자 줄도 그 사업장의 «대표주소»를 안다', () => {
  const r = 명단([집({
    ceo: '김대표', ceoEmail: 'ceo@x.com',
    primaryContactName: '홍길동', primaryContactEmail: 'staff@x.com',
  })]);
  const 담 = r.ok.find((x) => x.email === 'staff@x.com');
  assert.ok(담, '담당자 줄이 없다');
  assert.equal(담.대표주소, 'ceo@x.com',
    '★ 담당자 줄에 대표주소가 없다 — 화면이 「같은 메일」인지 가릴 수 없다');
});

test('★★ 대표자 주소가 담당자와 «같으면» 줄은 하나뿐이다 — 그래도 대표주소는 남는다', () => {
  /* ⚠ 여기가 이 검사의 알맹이다. 겹침막이(이집[])가 대표자 줄을 삼키므로
       줄만 보아서는 「같은 메일」과 「대표 주소가 없음」이 똑같아 보인다. */
  const r = 명단([집({
    ceo: '김대표', ceoEmail: 'same@x.com',
    primaryContactName: '홍길동', primaryContactEmail: 'same@x.com',
  })]);
  assert.equal(r.ok.filter((x) => x.사업장 === 'c1').length, 1,
    '같은 주소로 두 통이 나간다 — 겹침막이가 무너졌다');
  assert.equal(r.ok[0].대표주소, 'same@x.com',
    '★★ 대표주소가 안 실렸다 — 「같은 메일」을 밝힐 길이 없다');
});

test('대표자 주소 칸이 비면 «회사 메일»이 대표주소가 된다 — 화면이 그대로 견준다', () => {
  const r = 명단([집({ ceo: '김대표', email: 'co@x.com', primaryContactEmail: 'co@x.com' })]);
  assert.equal(r.ok[0].대표주소, 'co@x.com',
    '회사 메일로 물러설 때 대표주소를 안 싣는다');
});

test('대표자도 회사 메일도 없으면 대표주소는 «빈 칸»이다 — 지어내지 않는다', () => {
  const r = 명단([집({ primaryContactEmail: 'staff@x.com' })]);
  assert.equal(String(r.ok[0].대표주소 || ''), '',
    '없는 대표주소를 지어냈다');
});

/* ══════════════════════════════════════════════════════════════════════════
   ② 화면 — 사업장 하나가 한 줄
   ══════════════════════════════════════════════════════════════════════════ */

test('★ 사업장별로 «한 줄»로 묶는 자리가 있다', () => {
  assert.ok(news.indexOf('function 사업장으로묶기(') >= 0,
    '★ 사업장으로묶기 가 없다 — 대표자 표·담당자 표가 갈린 채로다');
  assert.ok(news.indexOf('받는분칸 = function(') >= 0,
    '한 줄 안에서 사람 하나를 그리는 자리가 없다');
  /* ★ 갈라져 있던 두 표가 «사라졌는지»까지 본다 — 새 표만 더하고 옛 표를 남기면
       같은 사람이 두 번 나와 명단이 두 배로 보인다. */
  assert.ok(news.indexOf('const 담당표 =') < 0 && news.indexOf('const 대표표 =') < 0,
    '★ 옛 담당자 표·대표자 표가 아직 남아 있다 — 한 줄로 합친 뜻이 없다');
});

test('★★ 대표자와 담당자에 «각각» 수신거부와 바꾸기가 붙는다', () => {
  const i = news.indexOf('받는분칸 = function(');
  assert.ok(i > 0, '받는분칸 을 못 찾음');
  const fn = news.slice(i, i + 2600);
  assert.ok(fn.indexOf('수신거부넣기(') >= 0,
    '★ 사람칸에 수신거부가 없다 — 한 줄로 묶으면서 손잡이를 잃었다');
  assert.ok(fn.indexOf('사람바꾸기(') >= 0,
    '★★ 바꾸기가 없다 — 사람이 바뀌어도 고칠 길이 없다');
});

test('★★★ 바꾸기는 «업체관리 자료»를 고친다 — 뉴스레터가 사본을 따로 갖지 않는다', () => {
  /* ⚠⚠ 여기가 무너지면 뉴스레터만 아는 주소가 생긴다. 계약이 끝나도 안 빠지고,
       업체관리에서 사람을 바꿔도 옛 주소로 계속 나간다 — 「따로 더한 분」이
       사본이라 손으로 빼야 하는 것과 똑같은 함정이다. */
  const i = news.indexOf('async function 사람바꾸기(');
  assert.ok(i > 0, '사람바꾸기 를 못 찾음');
  /* ⚠ 창을 넉넉히 잡으면 «다음 함수»까지 삼켜 엉뚱한 것을 보고 통과한다.
       함수가 끝나는 자리(맨 왼쪽 })까지만 본다. */
  const 끝 = news.indexOf('\n}', i);
  assert.ok(끝 > i, '사람바꾸기 의 끝을 못 찾음');
  const fn = news.slice(i, 끝);
  assert.ok(fn.indexOf("db.ref('data/companies/v/'") >= 0,
    '★★★ 업체관리 자리를 안 고친다 — 뉴스레터만 아는 사본이 생긴다');
  assert.ok(fn.indexOf('ceoEmail') >= 0, '대표자 주소 칸을 안 고친다');
  assert.ok(fn.indexOf('primaryContactEmail') >= 0, '주담당자 주소 칸을 안 고친다');
  assert.ok(fn.indexOf('.update(') >= 0 && fn.indexOf('.set(') < 0,
    '칸 하나만 update 해야 한다 — set 으로 통째 쓰면 다른 방이 고치던 것을 덮는다');
});

test('바꾸기는 «빈 주소»로 덮지 않는다 — 실수로 받는 곳을 지우면 안 된다', () => {
  const i = news.indexOf('async function 사람바꾸기(');
  const fn = news.slice(i, news.indexOf('\n}', i));
  assert.ok(/if\s*\(\s*!\s*주소\s*\)/.test(fn) || fn.indexOf('if(!주소)') >= 0,
    '빈 주소를 막지 않는다');
});

/* ══════════════════════════════════════════════════════════════════════════
   ③ 「같은 메일」 — 대표자와 담당자가 한 주소를 쓰는 곳
   ══════════════════════════════════════════════════════════════════════════ */

test('★ 대표자 메일과 담당자 메일이 같으면 «같은 메일»이라 밝힌다', () => {
  assert.ok(news.indexOf('같은 메일') >= 0,
    '★ 「같은 메일」이라 적는 자리가 없다 — 대표 지시 2026-09-13');
  const i = news.indexOf('function 사업장으로묶기(');
  const fn = news.slice(i, i + 3000);
  assert.ok(fn.indexOf('.toLowerCase()') >= 0,
    '주소를 대소문자 가려 견준다 — A@x.com 과 a@x.com 은 같은 주소다');
});

/* ══════════════════════════════════════════════════════════════════════════
   ④ 주소가 없어 못 보내는 곳 — 기업정보함으로 가는 길
   ══════════════════════════════════════════════════════════════════════════ */

test('★ 못 보내는 곳마다 «기업정보함에서 찾기»가 있다', () => {
  assert.ok(news.indexOf('function 기업정보함에서찾기(') >= 0,
    '★ 기업정보함으로 가는 길이 없다 — 「채우십시오」라고만 하고 길은 안 알려 준다');
  const i = news.indexOf('function 기업정보함에서찾기(');
  const fn = news.slice(i, i + 700);
  assert.ok(/pu-cards\.html\?q=/.test(fn),
    '기업정보함의 찾기 길(?q=)로 안 간다');
  assert.ok(fn.indexOf('encodeURIComponent(') >= 0,
    '회사 이름을 안 싸서 보낸다 — 괄호·&가 든 이름이 깨진다');
});

test('기업정보함이 «?q=»를 아직 읽는다 — 저쪽이 바뀌면 여기서 걸린다', () => {
  /* ⚠ 값이 아니라 «두 앱이 같은 길을 쓰는가»를 못 박는다. */
  assert.ok(cards.indexOf("new URLSearchParams(location.search).get('q')") >= 0,
    '기업정보함이 ?q= 를 안 읽는다 — 뉴스레터의 「기업정보함에서 찾기」가 헛손질이 된다');
});
